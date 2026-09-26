// The rules live in the target repo, in a .side-eye file, so a team can commit and tune them.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Config, Rule } from "./types.js";
import { DEFAULT_EXTENSIONS } from "./whitelist.js";

export const CONFIG_FILE = ".side-eye";

export function defaultConfig(): Config {
  return {
    extensions: [...DEFAULT_EXTENSIONS],
    sure: 0.8,
    maybe: 0.5,
    blastRadius: ["local", "module", "service", "system-wide"],
    rules: [
      { key: "network", label: "Network call is made",
        question: "Does this code change make a network call or add a new outbound host?" },
      { key: "secrets", label: "Secret or credential is read",
        question: "Does this code change read environment variables, secrets, credentials or API keys?" },
      { key: "auth", label: "Auth or permissions change",
        question: "Does this code change touch authentication, sessions or permission checks?" },
      { key: "schema", label: "Database schema changes",
        question: "Does this code change alter a database schema, table or migration?" },
      { key: "filesystem", label: "Files written outside project",
        question: "Does this code change write files outside the project directory?" },
      { key: "dependency", label: "Dependency added or changed",
        question: "Does this code change add, remove or upgrade a third-party dependency?" },
      { key: "swallow", label: "Exception is swallowed",
        question: "Does this code change catch an exception and silently ignore it?" },
      { key: "public_api", label: "Public API changes",
        question: "Does this code change alter a public function signature, route or API contract?" },
      { key: "logging", label: "User data may be logged",
        question: "Does this code change log or print a value that could be user data?" },
      { key: "background", label: "Background task started",
        question: "Does this code change start a background job, thread, timer or scheduled task?" },
    ],
  };
}

export function initConfig(repo: string): string {
  const p = join(repo, CONFIG_FILE);
  if (existsSync(p)) throw new Error(`${p} already exists`);
  writeFileSync(p, JSON.stringify(defaultConfig(), null, 2) + "\n");
  return p;
}

/** Throws a plain-language error if the rules cannot be used. Keys become question ids in the Jev request. */
export function validateRules(rules: unknown): asserts rules is Rule[] {
  if (!Array.isArray(rules) || rules.length === 0) throw new Error(`"rules" must be a non-empty list`);
  const seen = new Set<string>();
  for (const r of rules as Partial<Rule>[]) {
    for (const f of ["key", "label", "question"] as const) {
      if (typeof r[f] !== "string" || !r[f].trim()) throw new Error(`every rule needs a "${f}"`);
    }
    if (!/^[A-Za-z0-9_]+$/.test(r.key!)) throw new Error(`key "${r.key}" may only use letters, digits and underscores`);
    if (r.key === "blast_radius") throw new Error(`key "blast_radius" is reserved`);
    if (seen.has(r.key!)) throw new Error(`duplicate key "${r.key}"`);
    seen.add(r.key!);
  }
}

export function loadConfig(repo: string): Config {
  const p = join(repo, CONFIG_FILE);
  if (!existsSync(p)) throw new Error(`no ${CONFIG_FILE} in ${repo}. Run: side-eye init`);
  const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<Config>;
  try {
    validateRules(raw.rules);
  } catch (e) {
    throw new Error(`${CONFIG_FILE}: ${(e as Error).message}`);
  }
  return { ...defaultConfig(), ...raw, rules: raw.rules };
}

export function saveConfig(repo: string, cfg: Config): void {
  writeFileSync(join(repo, CONFIG_FILE), JSON.stringify(cfg, null, 2) + "\n");
}
