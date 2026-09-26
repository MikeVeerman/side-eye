import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { changedFiles, hunksFor, lineRange, splitHunks } from "../src/hunks.js";
import { makeRepo } from "./helpers.js";

describe("changedFiles", () => {
  it("lists modified and untracked files, sorted", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "a.py"), "x = 2\n");
    writeFileSync(join(repo, "b.py"), "y = 1\n");
    writeFileSync(join(repo, "data.json"), '{"k":1}\n');
    expect(changedFiles(repo)).toEqual(["a.py", "b.py", "data.json"]);
  });

  it("is empty when the tree is clean", () => {
    expect(changedFiles(makeRepo())).toEqual([]);
  });
});

describe("hunksFor", () => {
  it("returns the added lines of a modified file", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "a.py"), "import os\n\nx = os.environ['X']\n");
    const hs = hunksFor(repo, "a.py");
    expect(hs).toHaveLength(1);
    expect(hs[0].path).toBe("a.py");
    expect(hs[0].text).toContain("+import os");
    expect(hs[0].text).toContain("+x = os.environ['X']");
  });

  it("treats an untracked file as all added", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "b.py"), "x = 1\ny = 2\n");
    const hs = hunksFor(repo, "b.py");
    expect(hs).toHaveLength(1);
    expect(hs[0].text).toContain("+x = 1");
    expect(hs[0].text).toContain("+y = 2");
  });

  it("is empty for an unchanged file", () => {
    expect(hunksFor(makeRepo(), "a.py")).toEqual([]);
  });
});

describe("lineRange", () => {
  it("reads the new-file range from the @@ header", () => {
    expect(lineRange("@@ -1,2 +8,16 @@ def f():")).toBe("8-23");
  });
  it("shows a single line without a dash", () => {
    expect(lineRange("@@ -0,0 +1 @@")).toBe("1");
  });
});

describe("splitHunks", () => {
  it("keeps every piece under the cap and keeps the header", () => {
    const header = "@@ -1,3 +4,400 @@";
    const text = header + "\n" + Array.from({ length: 400 }, (_, i) => `+line ${i}`).join("\n");
    const parts = splitHunks([{ path: "a.py", text, header }], 500);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.text.length).toBeLessThanOrEqual(500);
      expect(p.path).toBe("a.py");
      expect(p.header).toBe(header);
    }
    expect(parts.map((p) => p.text).join("\n")).toBe(text);
  });

  it("leaves a small hunk alone", () => {
    const h = { path: "a.py", text: "@@ -1 +1 @@\n+x", header: "@@ -1 +1 @@" };
    expect(splitHunks([h], 500)).toEqual([h]);
  });
});
