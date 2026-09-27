import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE, defaultConfig, initConfig, loadConfig, saveConfig, validateRules } from "../src/config.js";
import { makeRepo } from "./helpers.js";

describe("config", () => {
  it("init writes a .side-eye file with the defaults", () => {
    const repo = makeRepo();
    initConfig(repo);
    const p = join(repo, CONFIG_FILE);
    expect(existsSync(p)).toBe(true);
    expect(JSON.parse(readFileSync(p, "utf8"))).toEqual(defaultConfig());
  });

  it("init refuses to overwrite an existing file", () => {
    const repo = makeRepo();
    initConfig(repo);
    expect(() => initConfig(repo)).toThrow(/already exists/);
  });

  it("load reads the file back", () => {
    const repo = makeRepo();
    initConfig(repo);
    expect(loadConfig(repo)).toEqual(defaultConfig());
  });

  it("load fails clearly when the file is missing", () => {
    const repo = makeRepo();
    expect(() => loadConfig(repo)).toThrow(/side-eye init/);
  });

  it("load fills in missing optional fields from the defaults", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, CONFIG_FILE), JSON.stringify({
      rules: [{ key: "x", label: "X", question: "X?" }],
    }));
    const c = loadConfig(repo);
    expect(c.rules).toHaveLength(1);
    expect(c.extensions).toEqual(defaultConfig().extensions);
    expect(c.sure).toBe(0.8);
    expect(c.maybe).toBe(0.5);
  });

  it("load drops fields it does not know, such as the old blastRadius", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, CONFIG_FILE), JSON.stringify({ blastRadius: ["a"], rules: [{ key: "x", label: "X", question: "X?" }] }));
    expect(Object.keys(loadConfig(repo)).sort()).toEqual(["extensions", "maybe", "rules", "sure"]);
  });

  it("load rejects a file without rules", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, CONFIG_FILE), JSON.stringify({ sure: 0.9 }));
    expect(() => loadConfig(repo)).toThrow(/rules/);
  });

  it("load rejects a rule missing key, label or question", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, CONFIG_FILE), JSON.stringify({ rules: [{ key: "x", label: "X" }] }));
    expect(() => loadConfig(repo)).toThrow(/question/);
  });

  it("defaults are the three AI coding habits, one sentence each", () => {
    const c = defaultConfig();
    expect(c.rules.map((r) => r.key)).toEqual(["comments", "fallback", "leftovers", "type_escape", "naming"]);
    for (const r of c.rules) {
      expect(r.question.endsWith("?")).toBe(true);
      expect(r.question.split("?")).toHaveLength(2); // exactly one question, no preamble
    }
  });
});

describe("validateRules", () => {
  const ok = [{ key: "network", label: "Network", question: "Net?" }];
  it("accepts a good list", () => { expect(() => validateRules(ok)).not.toThrow(); });
  it("rejects an empty list", () => { expect(() => validateRules([])).toThrow(/non-empty/); });
  it("rejects a missing field", () => {
    expect(() => validateRules([{ key: "a", label: "A" }])).toThrow(/question/);
    expect(() => validateRules([{ key: "a", question: "A?" }])).toThrow(/label/);
  });
  it("rejects duplicate keys", () => {
    expect(() => validateRules([...ok, { key: "network", label: "B", question: "B?" }])).toThrow(/duplicate key "network"/);
  });
  it("rejects a key that is not a plain identifier", () => {
    expect(() => validateRules([{ key: "has space", label: "A", question: "A?" }])).toThrow(/letters, digits and underscores/);
    expect(() => validateRules([{ key: "Ok_1", label: "A", question: "A?" }])).not.toThrow();
  });
});

describe("saveConfig", () => {
  it("writes the file so loadConfig reads the same thing back", () => {
    const repo = makeRepo();
    const c = { ...defaultConfig(), sure: 0.9, rules: [{ key: "x", label: "X", question: "X?" }] };
    saveConfig(repo, c);
    expect(loadConfig(repo)).toEqual(c);
    expect(readFileSync(join(repo, CONFIG_FILE), "utf8").endsWith("\n")).toBe(true);
  });
});
