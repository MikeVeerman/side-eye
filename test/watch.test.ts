import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { watch } from "../src/watch.js";
import { FakeClient, RULES, makeRepo, scopesOf, touch } from "./helpers.js";
import type { Finding } from "../src/types.js";

const cfg = scopesOf({ ...defaultConfig(), rules: RULES });
const noSleep = async () => {};

describe("watch", () => {
  it("checks a file once per save and reports it", async () => {
    const repo = makeRepo();
    touch(repo, "a.py", "import requests\n");
    const fake = new FakeClient();
    const seen: Finding[] = [];
    await watch(repo, fake, cfg, { rounds: 3, sleep: noSleep, onFinding: (f) => seen.push(f) });
    expect(fake.states).toHaveLength(1);
    expect(seen).toHaveLength(1);
    expect(seen[0].path).toBe("a.py");
  });

  it("rechecks after another save, keeps state between calls", async () => {
    const repo = makeRepo();
    const fake = new FakeClient();
    const state = new Map<string, number>();
    touch(repo, "a.py", "import requests\n", 1);
    await watch(repo, fake, cfg, { rounds: 1, sleep: noSleep, seen: state });
    await watch(repo, fake, cfg, { rounds: 1, sleep: noSleep, seen: state });
    expect(fake.states).toHaveLength(1);
    touch(repo, "a.py", "import requests\nimport os\n", 2);
    await watch(repo, fake, cfg, { rounds: 1, sleep: noSleep, seen: state });
    expect(fake.states).toHaveLength(2);
  });

  it("ignores non-source files", async () => {
    const repo = makeRepo();
    touch(repo, "users.json", '{"email": "a@b.c"}\n');
    const fake = new FakeClient();
    await watch(repo, fake, cfg, { rounds: 2, sleep: noSleep });
    expect(fake.states).toEqual([]);
  });

  it("reports a clean file through onClean", async () => {
    const repo = makeRepo();
    touch(repo, "a.py", "y = 2\n");
    const clean: string[] = [];
    await watch(repo, new FakeClient({ network: 0.1 }), cfg, { rounds: 1, sleep: noSleep, onClean: (p) => clean.push(p) });
    expect(clean).toEqual(["a.py"]);
  });

  it("sleeps the interval between rounds", async () => {
    const slept: number[] = [];
    await watch(makeRepo(), new FakeClient(), cfg, { rounds: 3, interval: 250, sleep: async (ms) => { slept.push(ms); } });
    expect(slept).toEqual([250, 250, 250]);
  });
});

describe("watch onStart", () => {
  it("fires before a file is re-checked", async () => {
    const repo = makeRepo();
    touch(repo, "a.py", "import requests\n");
    const order: string[] = [];
    await watch(repo, new FakeClient(), cfg, {
      rounds: 1, sleep: noSleep,
      onStart: (p) => order.push("start " + p),
      onFinding: (f) => order.push("finding " + f.path),
    });
    expect(order).toEqual(["start a.py", "finding a.py"]);
  });
});

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE, saveConfig } from "../src/config.js";

describe("watch reacts to .side-eye changes", () => {
  it("reloads the rules and re-checks every changed source file", async () => {
    const repo = makeRepo();
    const live = scopesOf({ ...cfg.root });
    saveConfig(repo, live.root);
    touch(repo, "a.py", "import requests\n", 1);
    const fake = new FakeClient();
    const state = new Map<string, number>();
    const cm = { value: -1 };
    const reloaded: string[][] = [];
    await watch(repo, fake, live, { rounds: 1, sleep: noSleep, seen: state, configMtime: cm, onConfig: (c) => reloaded.push(c.root.rules.map((r) => r.key)) });
    expect(fake.states).toHaveLength(1);

    const changed = { ...live.root, rules: [...RULES, { key: "money", label: "Money", question: "Money?" }] };
    saveConfig(repo, changed);
    const t = Date.now() / 1000 + 5;
    const { utimesSync } = await import("node:fs");
    utimesSync(join(repo, CONFIG_FILE), t, t);
    await watch(repo, fake, live, { rounds: 1, sleep: noSleep, seen: state, configMtime: cm, onConfig: (c) => reloaded.push(c.root.rules.map((r) => r.key)) });
    expect(fake.states).toHaveLength(2);
    expect(live.root.rules.map((r) => r.key)).toContain("money");
    expect(reloaded).toEqual([["network", "secrets", "auth", "money"]]);
  });

  it("keeps the old rules and reports the error when the file is broken", async () => {
    const repo = makeRepo();
    const live = scopesOf({ ...cfg.root });
    saveConfig(repo, live.root);
    const fake = new FakeClient();
    const state = new Map<string, number>();
    const cm = { value: -1 };
    await watch(repo, fake, live, { rounds: 1, sleep: noSleep, seen: state, configMtime: cm });
    const t = Date.now() / 1000 + 5;
    writeFileSync(join(repo, CONFIG_FILE), '{"rules": []}');
    const { utimesSync } = await import("node:fs");
    utimesSync(join(repo, CONFIG_FILE), t, t);
    const errors: string[] = [];
    await watch(repo, fake, live, { rounds: 1, sleep: noSleep, seen: state, configMtime: cm, onConfigError: (e) => errors.push(e.message) });
    expect(live.root.rules).toHaveLength(3);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/non-empty/);
  });

  it("does nothing special when there is no .side-eye file", async () => {
    const repo = makeRepo();
    await expect(watch(repo, new FakeClient(), scopesOf({ ...cfg.root }), { rounds: 2, sleep: noSleep })).resolves.toBeUndefined();
  });
});

describe("watch reacts to a nested .side-eye", () => {
  it("reloads when a nested file appears or changes", async () => {
    const repo = makeRepo();
    const live = scopesOf({ ...cfg.root });
    saveConfig(repo, live.root);
    mkdirSync(join(repo, "frontend"));
    touch(repo, "frontend/a.ts", "fetch(x)\n", 1);
    const fake = new FakeClient();
    const state = new Map<string, number>();
    const cm = { value: -1 };
    await watch(repo, fake, live, { rounds: 1, sleep: noSleep, seen: state, configMtime: cm });
    expect(fake.asked).toEqual([["network", "secrets", "auth"]]);
    writeFileSync(join(repo, "frontend", CONFIG_FILE), JSON.stringify({ rules: [{ key: "css", label: "C", question: "C?" }] }));
    const t = Date.now() / 1000 + 5;
    const { utimesSync } = await import("node:fs");
    utimesSync(join(repo, "frontend", CONFIG_FILE), t, t);
    await watch(repo, fake, live, { rounds: 1, sleep: noSleep, seen: state, configMtime: cm });
    expect(fake.asked[1]).toEqual(["network", "secrets", "auth", "css"]);
  });
});
