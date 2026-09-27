// Send one source file to Jev, hunk by hunk, and collect what comes back.

import { changedFiles, hunksFor, splitHunks } from "./hunks.js";
import { toFinding } from "./report.js";
import type { Client, Config, Finding } from "./types.js";
import { isSource } from "./whitelist.js";

export async function checkFile(repo: string, client: Client, cfg: Config, path: string): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const h of splitHunks(hunksFor(repo, path))) {
    const a = await client.ask(h.text, cfg.rules);
    const f = toFinding(h, a, cfg.rules, cfg.sure, cfg.maybe);
    if (f) out.push(f);
  }
  return out;
}

export async function checkRepo(repo: string, client: Client, cfg: Config, paths?: string[]): Promise<{ findings: Finding[]; skipped: string[] }> {
  const findings: Finding[] = [];
  const skipped: string[] = [];
  for (const path of paths ?? changedFiles(repo)) {
    if (!isSource(path, cfg.extensions)) { skipped.push(path); continue; }
    findings.push(...(await checkFile(repo, client, cfg, path)));
  }
  return { findings, skipped };
}
