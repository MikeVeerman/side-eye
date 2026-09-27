// The rules live in the target repo, in a .side-eye file, so a team can commit and tune them.
// The defaults target habits of AI-written code. Keep each question to one sentence: explanation
// around it dilutes the answer.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, normalize, posix } from "node:path";
import type { Config, Rule, ScopedRule, Scopes } from "./types.js";
import { DEFAULT_EXTENSIONS } from "./whitelist.js";

export const CONFIG_FILE = ".side-eye";

export function defaultConfig(): Config {
  return {
    extensions: [...DEFAULT_EXTENSIONS],
    sure: 0.8,
    maybe: 0.5,
    rules: [
      { key: "comments", label: "Comment restates the code",
        question: "Does this code change add a comment that describes what the code obviously does instead of why?" },
      { key: "fallback", label: "Fallback hides missing data",
        question: "Does this code change add a default, guard or fallback for a parameter, response or value that should always be present, instead of failing loudly?" },
      { key: "leftovers", label: "Debug leftovers",
        question: "Does this code change leave debug prints, commented-out code, stale TODO notes or unused imports behind?" },
      { key: "type_escape", label: "Type system bypassed",
        question: "Does this code change bypass the type system with any, unknown casts, type-ignore comments or untyped objects where a real type was possible?" },
      { key: "naming", label: "Vague names",
        question: "Does this code change introduce variable or function names that are generic, like data, result, tmp, obj, val or single letters, instead of saying what they hold?" },
    ],
  };
}

/** Writes the root file with the defaults, or an empty nested file when a folder is given. */
export function initConfig(repo: string, dir = ""): string {
  const p = join(repo, dir, CONFIG_FILE);
  if (existsSync(p)) throw new Error(`${p} already exists`);
  writeFileSync(p, JSON.stringify(dir ? { rules: [] } : defaultConfig(), null, 2) + "\n");
  return p;
}

/** Throws a plain-language error if the rules cannot be used. Keys become question ids in the Jev request. */
export function validateRules(rules: unknown, allowEmpty = false): asserts rules is Rule[] {
  if (!Array.isArray(rules)) throw new Error(`"rules" must be a list`);
  if (rules.length === 0 && !allowEmpty) throw new Error(`"rules" must be a non-empty list`);
  const seen = new Set<string>();
  for (const r of rules as Partial<Rule>[]) {
    for (const f of ["key", "label", "question"] as const) {
      if (typeof r[f] !== "string" || !r[f].trim()) throw new Error(`every rule needs a "${f}"`);
    }
    if (!/^[A-Za-z0-9_]+$/.test(r.key!)) throw new Error(`key "${r.key}" may only use letters, digits and underscores`);
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
  const d = defaultConfig();
  return { extensions: raw.extensions ?? d.extensions, sure: raw.sure ?? d.sure, maybe: raw.maybe ?? d.maybe, rules: raw.rules };
}

export function saveConfig(repo: string, cfg: Config): void {
  writeFileSync(join(repo, CONFIG_FILE), JSON.stringify(cfg, null, 2) + "\n");
}

/** Creates the folder when it does not exist yet, so rules can be set up before the first file lands there. */
export function saveNested(repo: string, dir: string, rules: Rule[]): void {
  mkdirSync(join(repo, dir), { recursive: true });
  writeFileSync(join(repo, dir, CONFIG_FILE), JSON.stringify({ rules }, null, 2) + "\n");
}

/** Folder must be a relative path that stays inside the repo. Returns it normalised, "" for the root. */
export function normalizeDir(dir: string): string {
  let d = posix.normalize(dir.replace(/\\/g, "/"));
  if (d.startsWith("./")) d = d.slice(2);
  d = d.replace(/\/+$/, "");
  if (d === "." || d === "") return "";
  if (d === ".." || d.startsWith("../") || posix.isAbsolute(d)) throw new Error(`folder must be inside the repo: ${dir}`);
  return d;
}

/** Every folder with a .side-eye that git can see (tracked or untracked, not ignored). "" is the root. */
export function discoverConfigs(repo: string): string[] {
  const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: repo, encoding: "utf8" });
  const dirs = out.split("\n").filter((f) => f && basename(f) === CONFIG_FILE).map((f) => {
    const d = dirname(f);
    return d === "." ? "" : d;
  });
  return [...new Set(dirs)].sort();
}

function loadNested(repo: string, dir: string): Rule[] {
  const raw = JSON.parse(readFileSync(join(repo, dir, CONFIG_FILE), "utf8")) as { rules?: unknown };
  try {
    validateRules(raw.rules, true);
  } catch (e) {
    throw new Error(`${posix.join(dir, CONFIG_FILE)}: ${(e as Error).message}`);
  }
  return raw.rules;
}

export function loadScopes(repo: string): Scopes {
  const root = loadConfig(repo);
  const nested = new Map<string, Rule[]>();
  for (const dir of discoverConfigs(repo)) if (dir !== "") nested.set(dir, loadNested(repo, dir));
  return { root, nested };
}

/** Rules for one file: root first, then every nested .side-eye on the way down, merged by key so the nearest wins. */
export function rulesFor(path: string, scopes: Scopes): ScopedRule[] {
  const merged: ScopedRule[] = scopes.root.rules.map((r) => ({ ...r, from: "" }));
  const apply = (rules: Rule[], from: string) => {
    for (const r of rules) {
      const i = merged.findIndex((m) => m.key === r.key);
      if (i >= 0) merged[i] = { ...r, from };
      else merged.push({ ...r, from });
    }
  };
  const parts = normalize(path).split("/").slice(0, -1);
  for (let i = 1; i <= parts.length; i++) {
    const dir = parts.slice(0, i).join("/");
    const rules = scopes.nested.get(dir);
    if (rules) apply(rules, dir);
  }
  return merged;
}
