// The rules live in the target repo, in a .side-eye file, so a team can commit and tune them.
// The defaults target habits of AI-written code. Keep each question to one sentence: explanation
// around it dilutes the answer.

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
      { key: "comments", label: "Comment restates the code",
        question: "Does this code change add a comment that describes what the code obviously does instead of why?" },
      { key: "fallback", label: "Fallback hides missing data",
        question: "Does this code change add a default, guard or fallback for a parameter, response or value that should always be present, instead of failing loudly?" },
      { key: "leftovers", label: "Debug leftovers",
        question: "Does this code change leave debug prints, commented-out code, stale TODO notes or unused imports behind?" },
      { key: "type_escape", label: "Type system bypassed",
        question: "Does this code change bypass the type system with any, unknown casts, type-ignore comments or untyped objects where a real type was possible?" },
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
