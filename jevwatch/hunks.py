"""Turn a working tree change into small pieces of diff text, one file at a time."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass

CAP = 2000  # characters per request, the state size jev-bench measured at


@dataclass(frozen=True)
class Hunk:
    path: str
    text: str


def _git(repo, *args) -> str:
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout


def changed_files(repo) -> list[str]:
    """Modified, staged and untracked files relative to HEAD, sorted."""
    out = _git(repo, "status", "--porcelain", "--untracked-files=all")
    return sorted(line[3:] for line in out.splitlines() if line and line[1] != "D" and line[0] != "D")


def hunks_for(repo, path: str) -> list[Hunk]:
    tracked = _git(repo, "ls-files", "--", path).strip() != ""
    diff = _git(repo, "diff", "HEAD", "--", path) if tracked else _untracked_diff(repo, path)
    body = diff.split("\n@@", 1)
    if len(body) < 2:
        return []
    return [Hunk(path, "@@" + part) for part in body[1].split("\n@@")]


def _untracked_diff(repo, path: str) -> str:
    # git diff --no-index exits 1 when files differ, so check=True cannot be used.
    r = subprocess.run(["git", "diff", "--no-index", "--", "/dev/null", path],
                       cwd=repo, capture_output=True, text=True)
    return r.stdout


def split_hunks(hunks: list[Hunk], cap: int = CAP) -> list[Hunk]:
    out = []
    for h in hunks:
        if len(h.text) <= cap:
            out.append(h)
            continue
        lines, piece = h.text.split("\n"), []
        for line in lines:
            if piece and len("\n".join(piece + [line])) > cap:
                out.append(Hunk(h.path, "\n".join(piece)))
                piece = []
            piece.append(line)
        out.append(Hunk(h.path, "\n".join(piece)))
    return out
