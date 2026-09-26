// Thin client for TypeSafe's systemone endpoint.

import type { Answer, Client, Rule } from "./types.js";

export const API_URL = "https://api.typesafe.ai/v1/systemone";
const RETRY = new Set([429, 500, 502, 503, 504]);

export function requestQuestions(rules: Rule[], blastRadius: string[]): Record<string, unknown> {
  const qs: Record<string, unknown> = {};
  for (const r of rules) qs[r.key] = { type: "noul", instructions: r.question };
  qs.blast_radius = { type: "score", instructions: "How far could a bug in this code change reach?", criteria: blastRadius };
  return qs;
}

export interface ClientOptions {
  apiKey?: string;
  model?: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class JevClient implements Client {
  private apiKey: string;
  private model: string;
  private fetchFn: typeof fetch;
  private sleep: (ms: number) => Promise<void>;

  constructor(o: ClientOptions) {
    const key = o.apiKey ?? process.env.TYPESAFE_API_KEY;
    if (!key) throw new Error("TYPESAFE_API_KEY is not set (put it in .env or export it)");
    this.apiKey = key;
    this.model = o.model ?? "jev-latest";
    this.fetchFn = o.fetchFn ?? fetch;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async ask(state: string, rules: Rule[], blastRadius: string[]): Promise<Answer> {
    const body = JSON.stringify({ state, model: this.model, questions: requestQuestions(rules, blastRadius) });
    let last = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const r = await this.fetchFn(API_URL, {
        method: "POST", body,
        headers: { "content-type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      });
      if (RETRY.has(r.status)) {
        last = `${r.status}: ${(await r.text()).slice(0, 200)}`;
        const after = Number(r.headers.get("retry-after"));
        await this.sleep(after > 0 ? after * 1000 : Math.min(2 ** attempt, 30) * 1000);
        continue;
      }
      if (!r.ok) throw new Error(`jev request failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
      return parse(await r.json(), rules, blastRadius);
    }
    throw new Error(`jev request failed after retries: ${last}`);
  }
}

interface Raw {
  answers: Record<string, { noul?: number; probabilities?: Record<string, number> }>;
  usage: { input_tokens: number };
}

function parse(d: Raw, rules: Rule[], blastRadius: string[]): Answer {
  const flags: Record<string, number> = {};
  for (const r of rules) flags[r.key] = Number(d.answers[r.key].noul);
  const br = blastRadius.map((_, i) => Number(d.answers.blast_radius.probabilities![String(i)]));
  return { flags, blastRadius: br, inputTokens: Number(d.usage.input_tokens) };
}
