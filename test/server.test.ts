import { afterEach, describe, expect, it } from "vitest";
import { startServer } from "../src/server.js";
import type { Finding } from "../src/types.js";

const finding: Finding = {
  path: "src/a.py", lines: "8-23", radius: "module", at: 1700000000000,
  rows: [{ n: 1, mark: "!!", key: "network", label: "Network call is made", p: 0.91 }],
};

let stop: (() => Promise<void>) | undefined;
afterEach(async () => { await stop?.(); stop = undefined; });

describe("server", () => {
  it("serves the page with the logo and the name", async () => {
    const s = await startServer(0);
    stop = s.close;
    const html = await (await fetch(`${s.url}/`)).text();
    expect(html).toContain("<svg");
    expect(html).toContain("side-eye");
    expect(html).toContain("/events");
  });

  it("lists findings as json, newest first", async () => {
    const s = await startServer(0);
    stop = s.close;
    s.push(finding);
    s.push({ ...finding, path: "src/b.py", at: 1700000001000 });
    const r = await fetch(`${s.url}/api/findings`);
    expect(r.headers.get("content-type")).toContain("application/json");
    const body = await r.json();
    expect(body.findings.map((f: Finding) => f.path)).toEqual(["src/b.py", "src/a.py"]);
  });

  it("clears older findings for the same file on a new save", async () => {
    const s = await startServer(0);
    stop = s.close;
    s.push(finding);
    s.clean("src/a.py");
    s.push({ ...finding, lines: "1-3", at: 1700000002000 });
    const body = await (await fetch(`${s.url}/api/findings`)).json();
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0].lines).toBe("1-3");
  });

  it("streams findings over server-sent events", async () => {
    const s = await startServer(0);
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

  it("404s anything else", async () => {
    const s = await startServer(0);
    stop = s.close;
    expect((await fetch(`${s.url}/nope`)).status).toBe(404);
  });
});
