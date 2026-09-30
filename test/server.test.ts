import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { startServer } from "../src/server.js";
import { scopesOf } from "./helpers.js";
import type { Finding } from "../src/types.js";

const finding: Finding = {
  path: "src/a.py", lines: "8-23", at: 1700000000000,
  diff: "@@ -1,2 +8,16 @@\n-old()\n+import requests\n+requests.get(url)",
  rows: [{ n: 1, mark: "!!", key: "network", label: "Network call is made", p: 0.91, from: "" }],
};

const cfg = scopesOf({ ...defaultConfig(), sure: 0.85 });
let stop: (() => Promise<void>) | undefined;
afterEach(async () => { await stop?.(); stop = undefined; });

describe("server", () => {
  it("serves the page with the logo and the name", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const r = await fetch(`${s.url}/`);
    expect(r.headers.get("content-type")).toContain("text/html");
    const html = await r.text();
    expect(html).toContain("<svg");
    expect(html).toContain("side-eye");
  });

  it("has a flags tab and a rules tab", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const html = await (await fetch(`${s.url}/`)).text();
    expect(html).toContain('data-tab="flags"');
    expect(html).toContain('data-tab="rules"');
  });

  it("serves the stylesheet and the script the page links to", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const html = await (await fetch(`${s.url}/`)).text();
    expect(html).toContain('href="/style.css"');
    expect(html).toContain('src="/app.js"');
    const css = await fetch(`${s.url}/style.css`);
    expect(css.headers.get("content-type")).toContain("text/css");
    expect(await css.text()).toContain(".card");
    const js = await fetch(`${s.url}/app.js`);
    expect(js.headers.get("content-type")).toContain("text/javascript");
    const script = await js.text();
    expect(script).toContain("/events");
    expect(script).toContain("/api/config");
  });

  it("does not serve files outside the ui folder", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    expect((await fetch(`${s.url}/../server.ts`)).status).toBe(404);
    expect((await fetch(`${s.url}/ui.ts`)).status).toBe(404);
  });

  it("serves the loaded config as json", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const r = await fetch(`${s.url}/api/config`);
    expect(r.headers.get("content-type")).toContain("application/json");
    const body = await r.json();
    expect(body.sure).toBe(0.85);
    expect(body.rules).toHaveLength(5);
    expect(body.rules[0]).toEqual(cfg.root.rules[0]);
    expect(body.scopes).toEqual([]);
  });

  it("includes the diff in the findings json and has a diff panel in the page", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    s.push(finding);
    const body = await (await fetch(`${s.url}/api/findings`)).json();
    expect(body.findings[0].diff).toContain("+import requests");
    const script = await (await fetch(`${s.url}/app.js`)).text();
    expect(script).toContain('class="diff"');
    expect(script).toContain('class="fold"');
  });

  it("lists findings as json, newest first", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    s.push(finding);
    s.push({ ...finding, path: "src/b.py", at: 1700000001000 });
    const r = await fetch(`${s.url}/api/findings`);
    expect(r.headers.get("content-type")).toContain("application/json");
    const body = await r.json();
    expect(body.findings.map((f: Finding) => f.path)).toEqual(["src/b.py", "src/a.py"]);
  });

  it("filters findings by path so an agent can ask about the file it is editing", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    s.push(finding);
    s.push({ ...finding, path: "src/b.py", at: 1700000001000 });
    const body = await (await fetch(`${s.url}/api/findings?path=src/b.py`)).json();
    expect(body.findings.map((f: Finding) => f.path)).toEqual(["src/b.py"]);
    const none = await (await fetch(`${s.url}/api/findings?path=nope.py`)).json();
    expect(none.findings).toEqual([]);
  });

  it("serves the findings as agent-readable text at /findings, with a path filter", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    s.push(finding);
    s.push({ ...finding, path: "src/b.py", at: 1700000001000 });
    const r = await fetch(`${s.url}/findings`);
    expect(r.headers.get("content-type")).toContain("text/plain");
    const text = await r.text();
    expect(text.split("\n")[0]).toBe("side-eye: 2 flags in 2 files. !! = sure (85% and up), maybe = uncertain (50% to 85%).");
    expect(text).toContain("src/b.py  lines 8-23");
    expect(text).toContain("  1. !! Network call is made          91%  [network]");
    const one = await (await fetch(`${s.url}/findings?path=src/a.py`)).text();
    expect(one).toContain("src/a.py");
    expect(one).not.toContain("src/b.py");
    const none = await (await fetch(`${s.url}/findings?path=nope.py`)).text();
    expect(none).toBe("side-eye: no flags.");
  });

  it("clears older findings for the same file on a new save", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    s.push(finding);
    s.clean("src/a.py");
    s.push({ ...finding, lines: "1-3", at: 1700000002000 });
    const body = await (await fetch(`${s.url}/api/findings`)).json();
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0].lines).toBe("1-3");
  });

  it("streams findings over server-sent events", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const res = await fetch(`${s.url}/events`);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    s.push(finding);
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    expect(chunk).toContain("event: finding");
    expect(chunk).toContain('"src/a.py"');
    await reader.cancel();
  });

  it("fails clearly when the port is taken", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const port = Number(new URL(s.url).port);
    await expect(startServer(port, cfg)).rejects.toThrow(`port ${port} is already in use`);
  });

  it("has add, edit and delete controls in the rules tab", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const script = await (await fetch(`${s.url}/app.js`)).text();
    expect(script).toContain('data-act="new"');
    expect(script).toContain('data-act="edit"');
    expect(script).toContain('data-act="delete"');
    expect(script).toContain("/api/rules");
  });

  it("PUT /api/rules validates, updates the live config and calls onSave", async () => {
    const live = scopesOf({ ...defaultConfig() });
    const saved: string[] = [];
    const s = await startServer(0, live, (dir) => saved.push(dir));
    stop = s.close;
    const rules = [{ key: "network", label: "Net", question: "Net?" }, { key: "new_one", label: "New", question: "New?" }];
    const r = await fetch(`${s.url}/api/rules`, { method: "PUT", body: JSON.stringify({ dir: "", rules }), headers: { "content-type": "application/json" } });
    expect(r.status).toBe(200);
    expect((await r.json()).rules).toEqual(rules);
    expect(live.root.rules).toEqual(rules);
    expect(live.root.sure).toBe(0.8);
    expect(saved).toEqual([""]);
  });

  it("PUT /api/rules rejects bad rules with a message and changes nothing", async () => {
    const live = scopesOf({ ...defaultConfig() });
    const saved: string[] = [];
    const s = await startServer(0, live, (dir) => saved.push(dir));
    stop = s.close;
    const r = await fetch(`${s.url}/api/rules`, { method: "PUT", body: JSON.stringify({ dir: "", rules: [{ key: "a b", label: "A", question: "A?" }] }) });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/letters, digits and underscores/);
    expect(live.root.rules).toHaveLength(5);
    expect(saved).toEqual([]);
  });

  it("PUT /api/rules rejects malformed json", async () => {
    const s = await startServer(0, scopesOf({ ...defaultConfig() }));
    stop = s.close;
    const r = await fetch(`${s.url}/api/rules`, { method: "PUT", body: "{nope" });
    expect(r.status).toBe(400);
  });

  it("PUT /api/rules with a folder creates or updates that nested scope, empty allowed", async () => {
    const live = scopesOf({ ...defaultConfig() });
    const saved: string[] = [];
    const s = await startServer(0, live, (dir) => saved.push(dir));
    stop = s.close;
    const r = await fetch(`${s.url}/api/rules`, { method: "PUT", body: JSON.stringify({ dir: "frontend", rules: [] }) });
    expect(r.status).toBe(200);
    expect((await r.json()).scopes).toEqual([{ dir: "frontend", rules: [] }]);
    expect(live.nested.get("frontend")).toEqual([]);
    expect(saved).toEqual(["frontend"]);
    const css = [{ key: "css", label: "C", question: "C?" }];
    await fetch(`${s.url}/api/rules`, { method: "PUT", body: JSON.stringify({ dir: "frontend/", rules: css }) });
    expect(live.nested.get("frontend")).toEqual(css);
  });

  it("PUT /api/rules refuses a folder outside the repo", async () => {
    const s = await startServer(0, scopesOf({ ...defaultConfig() }));
    stop = s.close;
    const r = await fetch(`${s.url}/api/rules`, { method: "PUT", body: JSON.stringify({ dir: "../other", rules: [] }) });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/inside the repo/);
  });

  it("GET /api/rules-for shows the merged rules for a path", async () => {
    const live = scopesOf({ ...defaultConfig() }, { frontend: [{ key: "css", label: "C", question: "C?" }] });
    const s = await startServer(0, live);
    stop = s.close;
    const body = await (await fetch(`${s.url}/api/rules-for?path=frontend/a.ts`)).json();
    expect(body.rules.map((r: { key: string; from: string }) => [r.key, r.from])).toContainEqual(["css", "frontend"]);
    expect(body.rules).toHaveLength(6);
  });

  it("has a per-folder section and a preview box in the rules tab", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const js = await (await fetch(`${s.url}/app.js`)).text();
    expect(js).toContain("/api/rules-for");
    expect(js).toContain("add-scope");
  });

  it("404s anything else", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    expect((await fetch(`${s.url}/nope`)).status).toBe(404);
  });
});
