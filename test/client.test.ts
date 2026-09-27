import { describe, expect, it } from "vitest";
import { JevClient, requestQuestions } from "../src/client.js";
import { RULES } from "./helpers.js";

function payload() {
  const answers: Record<string, unknown> = {};
  for (const r of RULES) answers[r.key] = { noul: 0.1 };
  answers.network = { noul: 0.93 };
  return { answers, usage: { input_tokens: 123 } };
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("requestQuestions", () => {
  it("has one noul question per rule and nothing else", () => {
    const qs = requestQuestions(RULES);
    expect(Object.keys(qs).sort()).toEqual(["auth", "network", "secrets"]);
    expect(qs.network).toEqual({ type: "noul", instructions: "Does this make a network call?" });
  });
});

describe("JevClient.ask", () => {
  it("posts state and questions and parses the answer", async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
      sent = { url: String(url), init: init! };
      return response(200, payload());
    };
    const c = new JevClient({ apiKey: "k", fetchFn, sleep: async () => {} });
    const a = await c.ask("+import requests", RULES);
    expect(sent!.url).toBe("https://api.typesafe.ai/v1/systemone");
    expect((sent!.init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    const body = JSON.parse(sent!.init.body as string);
    expect(body.state).toBe("+import requests");
    expect(body.model).toBe("jev-latest");
    expect(Object.keys(body.questions).sort()).toEqual(["auth", "network", "secrets"]);
    expect(a.flags.network).toBe(0.93);
    expect(a.flags.secrets).toBe(0.1);
    expect(a.inputTokens).toBe(123);
  });

  it("retries on 429 then succeeds", async () => {
    let calls = 0;
    const fetchFn = async () => (++calls === 1 ? response(429, {}) : response(200, payload()));
    const c = new JevClient({ apiKey: "k", fetchFn, sleep: async () => {} });
    expect((await c.ask("x", RULES)).flags.network).toBe(0.93);
    expect(calls).toBe(2);
  });

  it("gives up after retries", async () => {
    const c = new JevClient({ apiKey: "k", fetchFn: async () => response(503, {}), sleep: async () => {} });
    await expect(c.ask("x", RULES)).rejects.toThrow(/after retries/);
  });

  it("throws on a non-retryable error status", async () => {
    const c = new JevClient({ apiKey: "k", fetchFn: async () => response(401, { error: "bad key" }), sleep: async () => {} });
    await expect(c.ask("x", RULES)).rejects.toThrow(/401/);
  });

  it("needs an api key", () => {
    delete process.env.TYPESAFE_API_KEY;
    expect(() => new JevClient({})).toThrow(/TYPESAFE_API_KEY/);
  });
});
