import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkFile, checkRepo } from "../src/checker.js";
import { defaultConfig } from "../src/config.js";
import { FakeClient, RULES, makeRepo, scopesOf } from "./helpers.js";

const cfg = scopesOf({ ...defaultConfig(), rules: RULES });

describe("checkFile", () => {
  it("sends each hunk and returns findings", async () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "a.py"), "import requests\n");
    const fake = new FakeClient();
    const found = await checkFile(repo, fake, cfg, "a.py");
    expect(fake.states).toHaveLength(1);
    expect(fake.states[0]).toContain("+import requests");
    expect(found).toHaveLength(1);
    expect(found[0].rows[0].label).toBe("Network call is made");
  });

  it("returns no findings when nothing is flagged", async () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "a.py"), "y = 2\n");
    expect(await checkFile(repo, new FakeClient({ network: 0.1 }), cfg, "a.py")).toEqual([]);
  });
});

describe("checkFile in a nested folder", () => {
  it("asks the merged rules and marks where each came from", async () => {
    const repo = makeRepo();
    mkdirSync(join(repo, "frontend"));
    writeFileSync(join(repo, "frontend", "a.ts"), "fetch(x)\n");
    const scopes = scopesOf({ ...defaultConfig(), rules: RULES }, { frontend: [{ key: "css", label: "Inline css", question: "Css?" }] });
    const fake = new FakeClient({ network: 0.9, css: 0.95 });
    const found = await checkFile(repo, fake, scopes, "frontend/a.ts");
    expect(fake.asked).toEqual([["network", "secrets", "auth", "css"]]);
    expect(found[0].rows.map((r) => [r.key, r.from])).toEqual([["css", "frontend"], ["network", ""]]);
  });
});

describe("checkRepo", () => {
  it("only sends whitelisted changed files and reports skips", async () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "a.py"), "import requests\n");
    writeFileSync(join(repo, "secrets.json"), '{"email": "x@y.z"}\n');
    const fake = new FakeClient();
    const { findings, skipped } = await checkRepo(repo, fake, cfg);
    expect(fake.states).toHaveLength(1);
    expect(fake.states.some((s) => s.includes("x@y.z"))).toBe(false);
    expect(findings).toHaveLength(1);
    expect(skipped).toEqual(["secrets.json"]);
  });

  it("checks only the given paths when asked", async () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "a.py"), "import requests\n");
    writeFileSync(join(repo, "b.py"), "import requests\n");
    const fake = new FakeClient();
    await checkRepo(repo, fake, cfg, ["b.py"]);
    expect(fake.states).toHaveLength(1);
  });

  it("sends nothing on a clean tree", async () => {
    const fake = new FakeClient();
    const r = await checkRepo(makeRepo(), fake, cfg);
    expect(fake.states).toEqual([]);
    expect(r.findings).toEqual([]);
  });
});
