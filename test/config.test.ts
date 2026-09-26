import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE, defaultConfig, initConfig, loadConfig } from "../src/config.js";
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
    expect(c.blastRadius).toEqual(defaultConfig().blastRadius);
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

  it("defaults have ten rules with unique keys and questions ending in ?", () => {
    const c = defaultConfig();
    expect(c.rules).toHaveLength(10);
    expect(new Set(c.rules.map((r) => r.key)).size).toBe(10);
    for (const r of c.rules) expect(r.question.endsWith("?")).toBe(true);
    expect(c.rules.find((r) => r.key === "secrets")!.label).toBe("Secret or credential is read");
  });
});
