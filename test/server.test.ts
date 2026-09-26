import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { startServer } from "../src/server.js";
import type { Finding } from "../src/types.js";

const finding: Finding = {
  path: "src/a.py", lines: "8-23", radius: "module", at: 1700000000000,
  diff: "@@ -1,2 +8,16 @@\n-old()\n+import requests\n+requests.get(url)",
  rows: [{ n: 1, mark: "!!", key: "network", label: "Network call is made", p: 0.91 }],
};

const cfg = { ...defaultConfig(), sure: 0.85 };
let stop: (() => Promise<void>) | undefined;
afterEach(async () => { await stop?.(); stop = undefined; });

describe("server", () => {
  it("serves the page with the logo and the name", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const html = await (await fetch(`${s.url}/`)).text();
    expect(html).toContain("<svg");
    expect(html).toContain("side-eye");
    expect(html).toContain("/events");
  });

  it("has a flags tab and a rules tab", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const html = await (await fetch(`${s.url}/`)).text();
    expect(html).toContain('data-tab="flags"');
    expect(html).toContain('data-tab="rules"');
    expect(html).toContain("/api/config");
  });

  it("serves the loaded config as json", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    const r = await fetch(`${s.url}/api/config`);
    expect(r.headers.get("content-type")).toContain("application/json");
    const body = await r.json();
    expect(body.sure).toBe(0.85);
    expect(body.rules).toHaveLength(10);
    expect(body.rules[0]).toEqual(cfg.rules[0]);
  });

  it("includes the diff in the findings json and has a diff panel in the page", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    s.push(finding);
    const body = await (await fetch(`${s.url}/api/findings`)).json();
    expect(body.findings[0].diff).toContain("+import requests");
    const html = await (await fetch(`${s.url}/`)).text();
    expect(html).toContain('class="diff"');
    expect(html).toContain('class="fold"');
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

  it("404s anything else", async () => {
    const s = await startServer(0, cfg);
    stop = s.close;
    expect((await fetch(`${s.url}/nope`)).status).toBe(404);
  });
});
