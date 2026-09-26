// Re-check a source file every time it is saved. Polls modification times once per interval.
// No extra dependency, and a second of lag is fine next to a 300 ms round trip to Jev.

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { checkFile } from "./checker.js";
import { CONFIG_FILE, loadConfig } from "./config.js";
import { changedFiles } from "./hunks.js";
import type { Client, Config, Finding } from "./types.js";
import { isSource } from "./whitelist.js";

export interface WatchOptions {
  interval?: number;                       // ms between polls
  rounds?: number;                         // stop after this many polls; undefined means forever
  sleep?: (ms: number) => Promise<void>;
  seen?: Map<string, number>;              // path -> mtime already checked
  configMtime?: { value: number };         // last seen mtime of .side-eye; -1 means not yet looked
  onStart?: (path: string) => void;        // a file is about to be re-checked
  onFinding?: (f: Finding) => void;
  onClean?: (path: string) => void;
  onConfig?: (cfg: Config) => void;       // .side-eye changed on disk and was reloaded
  onConfigError?: (e: Error) => void;     // .side-eye changed but could not be loaded; old rules stay
}

function configMtime(repo: string): number {
  const p = join(repo, CONFIG_FILE);
  return existsSync(p) ? statSync(p).mtimeMs : 0;
}

/** Reloads cfg in place when .side-eye changed. Returns true when the rules changed. */
function reloadIfChanged(repo: string, cfg: Config, last: { value: number }, o: WatchOptions): boolean {
  const mtime = configMtime(repo);
  if (last.value < 0) { last.value = mtime; return false; }
  if (mtime === last.value) return false;
  last.value = mtime;
  try {
    Object.assign(cfg, loadConfig(repo));
    o.onConfig?.(cfg);
    return true;
  } catch (e) {
    o.onConfigError?.(e as Error);
    return false;
  }
}

export async function watch(repo: string, client: Client, cfg: Config, o: WatchOptions = {}): Promise<void> {
  const interval = o.interval ?? 1000;
  const sleep = o.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const seen = o.seen ?? new Map<string, number>();
  const last = o.configMtime ?? { value: -1 };
  for (let done = 0; o.rounds === undefined || done < o.rounds; done++) {
    if (reloadIfChanged(repo, cfg, last, o)) seen.clear();   // new rules: every changed file gets asked again
    for (const path of changedFiles(repo)) {
      if (!isSource(path, cfg.extensions)) continue;
      const mtime = statSync(join(repo, path)).mtimeMs;
      if (seen.get(path) === mtime) continue;
      seen.set(path, mtime);
      o.onStart?.(path);
      const found = await checkFile(repo, client, cfg, path);
      if (found.length) found.forEach((f) => o.onFinding?.(f));
      else o.onClean?.(path);
    }
    await sleep(interval);
  }
}
