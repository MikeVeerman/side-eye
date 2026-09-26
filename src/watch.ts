// Re-check a source file every time it is saved. Polls modification times once per interval.
// No extra dependency, and a second of lag is fine next to a 300 ms round trip to Jev.

import { statSync } from "node:fs";
import { join } from "node:path";
import { checkFile } from "./checker.js";
import { changedFiles } from "./hunks.js";
import type { Client, Config, Finding } from "./types.js";
import { isSource } from "./whitelist.js";

export interface WatchOptions {
  interval?: number;                       // ms between polls
  rounds?: number;                         // stop after this many polls; undefined means forever
  sleep?: (ms: number) => Promise<void>;
  seen?: Map<string, number>;              // path -> mtime already checked
  onStart?: (path: string) => void;        // a file is about to be re-checked
  onFinding?: (f: Finding) => void;
  onClean?: (path: string) => void;
}

export async function watch(repo: string, client: Client, cfg: Config, o: WatchOptions = {}): Promise<void> {
  const interval = o.interval ?? 1000;
  const sleep = o.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const seen = o.seen ?? new Map<string, number>();
  for (let done = 0; o.rounds === undefined || done < o.rounds; done++) {
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
