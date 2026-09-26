// Turn probabilities into something worth reading. Sure flags loud, maybes dim, the rest silent.

import { lineRange } from "./hunks.js";
import type { Answer, Finding, Hunk, Row, Rule } from "./types.js";

export function classify(a: Answer, sure: number, maybe: number): { sure: [string, number][]; maybe: [string, number][] } {
  const ranked = Object.entries(a.flags).sort((x, y) => y[1] - x[1]);
  return {
    sure: ranked.filter(([, p]) => p >= sure),
    maybe: ranked.filter(([, p]) => p >= maybe && p < sure),
  };
}

export function toFinding(h: Hunk, a: Answer, rules: Rule[], blastRadius: string[], sure: number, maybe: number): Finding | null {
  const c = classify(a, sure, maybe);
  if (!c.sure.length && !c.maybe.length) return null;
  const labels = Object.fromEntries(rules.map((r) => [r.key, r.label]));
  const rows: Row[] = [
    ...c.sure.map(([key, p]) => ({ mark: "!!" as const, key, p })),
    ...c.maybe.map(([key, p]) => ({ mark: "maybe" as const, key, p })),
  ].map((r, i) => ({ n: i + 1, mark: r.mark, key: r.key, label: labels[r.key] ?? r.key, p: r.p }));
  const top = a.blastRadius.indexOf(Math.max(...a.blastRadius));
  return { path: h.path, lines: lineRange(h.header), radius: blastRadius[top], rows, at: Date.now(), diff: h.text };
}

export function render(f: Finding): string {
  const lines = [`${f.path}  lines ${f.lines}  [${f.radius}]`];
  for (const r of f.rows) {
    const width = 31 - r.mark.length;
    lines.push(`  ${r.n}. ${r.mark} ${r.label.padEnd(width)} ${Math.round(r.p * 100)}%`);
  }
  return lines.join("\n");
}
