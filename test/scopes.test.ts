import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE, defaultConfig, discoverConfigs, initConfig, loadScopes, rulesFor, saveNested } from "../src/config.js";
import { git, makeRepo, RULES, scopesOf } from "./helpers.js";

function nested(repo: string, dir: string, rules: unknown) {
  mkdirSync(join(repo, dir), { recursive: true });
  writeFileSync(join(repo, dir, CONFIG_FILE), JSON.stringify({ rules }));
}

describe("discoverConfigs", () => {
  it("finds the root and nested files, tracked or not, but not ignored ones", () => {
    const repo = makeRepo();
    initConfig(repo);
    nested(repo, "frontend", []);
    nested(repo, "services/billing", []);
    nested(repo, "node_modules/dep", []);
    writeFileSync(join(repo, ".gitignore"), "node_modules/\n");
    git(repo, "add", "frontend");
    expect(discoverConfigs(repo)).toEqual(["", "frontend", "services/billing"]);
  });
});

describe("loadScopes", () => {
  it("loads root and nested rules", () => {
    const repo = makeRepo();
    initConfig(repo);
    nested(repo, "frontend", [{ key: "css", label: "Inline css", question: "Inline css?" }]);
    const s = loadScopes(repo);
    expect(s.root.rules).toHaveLength(5);
    expect([...s.nested.keys()]).toEqual(["frontend"]);
    expect(s.nested.get("frontend")![0].key).toBe("css");
  });

  it("allows an empty nested rules list", () => {
    const repo = makeRepo();
    initConfig(repo);
    nested(repo, "frontend", []);
    expect(loadScopes(repo).nested.get("frontend")).toEqual([]);
  });

  it("names the nested file in its error", () => {
    const repo = makeRepo();
    initConfig(repo);
    nested(repo, "frontend", [{ key: "a b", label: "A", question: "A?" }]);
    expect(() => loadScopes(repo)).toThrow(/frontend\/\.side-eye.*letters, digits and underscores/);
  });

  it("still needs the root file", () => {
    const repo = makeRepo();
    nested(repo, "frontend", []);
    expect(() => loadScopes(repo)).toThrow(/side-eye init/);
  });
});

describe("rulesFor", () => {
  const root = { ...defaultConfig(), rules: RULES };
  const css = { key: "css", label: "Inline css", question: "Inline css?" };
  const naming2 = { key: "network", label: "Front-end network call", question: "Fetch from the browser?" };

  it("uses only root rules outside any nested folder", () => {
    const s = scopesOf(root, { frontend: [css] });
    expect(rulesFor("src/a.ts", s).map((r) => r.key)).toEqual(["network", "secrets", "auth"]);
    expect(rulesFor("src/a.ts", s).every((r) => r.from === "")).toBe(true);
  });

  it("adds nested rules for files under that folder and marks where they came from", () => {
    const s = scopesOf(root, { frontend: [css] });
    const rules = rulesFor("frontend/components/Button.tsx", s);
    expect(rules.map((r) => r.key)).toEqual(["network", "secrets", "auth", "css"]);
    expect(rules.find((r) => r.key === "css")!.from).toBe("frontend");
  });

  it("nearest file overrides a parent rule with the same key, keeping its position", () => {
    const s = scopesOf(root, { frontend: [naming2] });
    const rules = rulesFor("frontend/a.ts", s);
    expect(rules.map((r) => r.key)).toEqual(["network", "secrets", "auth"]);
    expect(rules[0].label).toBe("Front-end network call");
    expect(rules[0].from).toBe("frontend");
  });

  it("merges every level, deepest last", () => {
    const s = scopesOf(root, { frontend: [css], "frontend/admin": [{ key: "css", label: "Admin css", question: "Admin css?" }, { key: "perm", label: "Perm", question: "Perm?" }] });
    const rules = rulesFor("frontend/admin/x.ts", s);
    expect(rules.map((r) => r.key)).toEqual(["network", "secrets", "auth", "css", "perm"]);
    expect(rules.find((r) => r.key === "css")!.label).toBe("Admin css");
  });

  it("does not match a folder by name prefix", () => {
    const s = scopesOf(root, { frontend: [css] });
    expect(rulesFor("frontend-old/a.ts", s).map((r) => r.key)).toEqual(["network", "secrets", "auth"]);
  });
});

describe("saveNested and init for a folder", () => {
  it("writes a nested file that loads back", () => {
    const repo = makeRepo();
    initConfig(repo);
    mkdirSync(join(repo, "frontend"));
    saveNested(repo, "frontend", [{ key: "css", label: "C", question: "C?" }]);
    expect(loadScopes(repo).nested.get("frontend")).toHaveLength(1);
    expect(readFileSync(join(repo, "frontend", CONFIG_FILE), "utf8").endsWith("\n")).toBe(true);
  });

  it("creates the folder when it does not exist yet", () => {
    const repo = makeRepo();
    initConfig(repo);
    saveNested(repo, "services/billing", []);
    expect(loadScopes(repo).nested.has("services/billing")).toBe(true);
  });

  it("init with a folder writes an empty nested skeleton", () => {
    const repo = makeRepo();
    initConfig(repo);
    mkdirSync(join(repo, "frontend"));
    initConfig(repo, "frontend");
    expect(JSON.parse(readFileSync(join(repo, "frontend", CONFIG_FILE), "utf8"))).toEqual({ rules: [] });
    expect(() => initConfig(repo, "frontend")).toThrow(/already exists/);
  });
});
