// Send one source file to Jev, hunk by hunk, and collect what comes back.

import { rulesFor } from "./config.js";
import { changedFiles, hunksFor, splitHunks } from "./hunks.js";
import { toFinding } from "./report.js";
import type { Client, Finding, Scopes } from "./types.js";
import { isSource } from "./whitelist.js";

export async function checkFile(repo: string, client: Client, scopes: Scopes, path: string): Promise<Finding[]> {
  const out: Finding[] = [];
  const rules = rulesFor(path, scopes);
  if (!rules.length) return out;
  for (const h of splitHunks(hunksFor(repo, path))) {
    const a = await client.ask(h.text, rules);
    const f = toFinding(h, a, rules, scopes.root.sure, scopes.root.maybe);
    if (f) out.push(f);
  }
  return out;
}

export async function checkRepo(repo: string, client: Client, scopes: Scopes, paths?: string[]): Promise<{ findings: Finding[]; skipped: string[] }> {
  const findings: Finding[] = [];
  const skipped: string[] = [];
  for (const path of paths ?? changedFiles(repo)) {
    if (!isSource(path, scopes.root.extensions)) { skipped.push(path); continue; }
    findings.push(...(await checkFile(repo, client, scopes, path)));
  }
  return { findings, skipped };
}
