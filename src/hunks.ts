// Turn a working tree change into small pieces of diff text, one file at a time.

import { execFileSync, spawnSync } from "node:child_process";
import type { Hunk } from "./types.js";

export const CAP = 2000; // characters per request, the state size jev-bench measured at

function git(repo: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
}

/** Modified, staged and untracked files relative to HEAD, sorted. */
export function changedFiles(repo: string): string[] {
  const out = git(repo, "status", "--porcelain", "--untracked-files=all");
  return out.split("\n")
    .filter((l) => l && l[0] !== "D" && l[1] !== "D")
    .map((l) => l.slice(3))
    .sort();
}

export function hunksFor(repo: string, path: string): Hunk[] {
  const tracked = git(repo, "ls-files", "--", path).trim() !== "";
  const diff = tracked ? git(repo, "diff", "HEAD", "--", path) : untrackedDiff(repo, path);
  const parts = diff.split("\n@@");
  if (parts.length < 2) return [];
  return parts.slice(1).map((p) => {
    const text = "@@" + p;
    return { path, text, header: text.split("\n", 1)[0] };
  });
}

function untrackedDiff(repo: string, path: string): string {
  // git diff --no-index exits 1 when the files differ, so a throwing call cannot be used.
  return spawnSync("git", ["diff", "--no-index", "--", "/dev/null", path], { cwd: repo, encoding: "utf8" }).stdout;
}

/** Line range in the new file, read from the @@ header. Jev answers per hunk, not per line. */
export function lineRange(header: string): string {
  const m = /@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(header);
  if (!m) return "?";
  const start = Number(m[1]);
  const count = m[2] === undefined ? 1 : Number(m[2]);
  return count === 1 ? String(start) : `${start}-${start + count - 1}`;
}

export function splitHunks(hunks: Hunk[], cap = CAP): Hunk[] {
  const out: Hunk[] = [];
  for (const h of hunks) {
    if (h.text.length <= cap) { out.push(h); continue; }
    let piece: string[] = [];
    for (const line of h.text.split("\n")) {
      if (piece.length && [...piece, line].join("\n").length > cap) {
        out.push({ path: h.path, text: piece.join("\n"), header: h.header });
        piece = [];
      }
      piece.push(line);
    }
    out.push({ path: h.path, text: piece.join("\n"), header: h.header });
  }
  return out;
}
