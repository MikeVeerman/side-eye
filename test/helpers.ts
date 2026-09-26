import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Answer, Rule } from "../src/types.js";

export function git(repo: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
}

export function makeRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "side-eye-"));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t");
  git(repo, "config", "user.name", "t");
  writeFileSync(join(repo, "a.py"), "x = 1\n");
  writeFileSync(join(repo, "data.json"), "{}\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "init");
  return repo;
}

export function touch(repo: string, name: string, text: string, later = 1): void {
  const p = join(repo, name);
  writeFileSync(p, text);
  const t = Date.now() / 1000 + later;
  utimesSync(p, t, t);
}

export const RULES: Rule[] = [
  { key: "network", label: "Network call is made", question: "Does this make a network call?" },
  { key: "secrets", label: "Secret or credential is read", question: "Does this read a secret?" },
  { key: "auth", label: "Auth or permissions change", question: "Does this touch auth?" },
];

export class FakeClient {
  states: string[] = [];
  constructor(private flags: Record<string, number> = { network: 0.9, secrets: 0.1, auth: 0.1 }) {}
  async ask(state: string): Promise<Answer> {
    this.states.push(state);
    return { flags: { ...this.flags }, blastRadius: [1, 0, 0, 0], inputTokens: 5 };
  }
}
