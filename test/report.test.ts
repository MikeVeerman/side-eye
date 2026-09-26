import { describe, expect, it } from "vitest";
import { classify, render, toFinding } from "../src/report.js";
import { RULES } from "./helpers.js";
import type { Answer, Hunk } from "../src/types.js";

const RADIUS = ["local", "module", "service", "system-wide"];
const hunk: Hunk = { path: "src/a.py", text: "@@ -1,2 +8,16 @@\n+x", header: "@@ -1,2 +8,16 @@" };

function answer(flags: Partial<Record<string, number>> = {}): Answer {
  return { flags: { network: 0.05, secrets: 0.05, auth: 0.05, ...flags }, blastRadius: [0.1, 0.6, 0.2, 0.1], inputTokens: 10 };
}

describe("classify", () => {
  it("splits sure, maybe and silent", () => {
    const { sure, maybe } = classify(answer({ network: 0.91, secrets: 0.6, auth: 0.2 }), 0.8, 0.5);
    expect(sure).toEqual([["network", 0.91]]);
    expect(maybe).toEqual([["secrets", 0.6]]);
  });
  it("sorts by probability, highest first", () => {
    const { sure } = classify(answer({ network: 0.85, secrets: 0.95 }), 0.8, 0.5);
    expect(sure.map(([k]) => k)).toEqual(["secrets", "network"]);
  });
});

describe("toFinding", () => {
  it("returns null when nothing is flagged", () => {
    expect(toFinding(hunk, answer(), RULES, RADIUS, 0.8, 0.5)).toBeNull();
  });
  it("builds numbered rows with labels and the blast radius", () => {
    const f = toFinding(hunk, answer({ network: 0.91, auth: 0.85, secrets: 0.6 }), RULES, RADIUS, 0.8, 0.5)!;
    expect(f.path).toBe("src/a.py");
    expect(f.lines).toBe("8-23");
    expect(f.radius).toBe("module");
    expect(f.rows).toEqual([
      { n: 1, mark: "!!", key: "network", label: "Network call is made", p: 0.91 },
      { n: 2, mark: "!!", key: "auth", label: "Auth or permissions change", p: 0.85 },
      { n: 3, mark: "maybe", key: "secrets", label: "Secret or credential is read", p: 0.6 },
    ]);
    expect(typeof f.at).toBe("number");
  });
  it("carries the hunk diff so the page can show it", () => {
    const f = toFinding(hunk, answer({ network: 0.91 }), RULES, RADIUS, 0.8, 0.5)!;
    expect(f.diff).toBe(hunk.text);
  });
});

describe("render", () => {
  it("prints the header and aligned numbered rows", () => {
    const f = toFinding(hunk, answer({ network: 0.91, auth: 0.85, secrets: 0.6 }), RULES, RADIUS, 0.8, 0.5)!;
    expect(render(f).split("\n")).toEqual([
      "src/a.py  lines 8-23  [module]",
      "  1. !! Network call is made          91%",
      "  2. !! Auth or permissions change    85%",
      "  3. maybe Secret or credential is read 60%",
    ]);
  });
});
