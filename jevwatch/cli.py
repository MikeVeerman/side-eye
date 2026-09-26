"""jevwatch check [paths...]  -- flag externalities in your uncommitted source changes."""

from __future__ import annotations

import argparse
import os
import sys

from .client import JevClient
from .hunks import changed_files, hunks_for, split_hunks
from .report import render
from .whitelist import is_source


def load_dotenv(repo) -> None:
    p = os.path.join(repo, ".env")
    if not os.path.exists(p):
        return
    for line in open(p):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def check(repo, client, sure: float, maybe: float, paths: list[str] | None = None) -> int:
    paths = paths if paths is not None else changed_files(repo)
    for path in paths:
        if not is_source(path):
            print(f"skipped {path} (not a source file, never sent)")
            continue
        for h in split_hunks(hunks_for(repo, path)):
            out = render(h, client.ask(h.text), sure, maybe)
            if out:
                print(out)
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="jevwatch")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="check uncommitted changes (or the given files)")
    c.add_argument("paths", nargs="*")
    c.add_argument("--sure", type=float, default=0.8)
    c.add_argument("--maybe", type=float, default=0.5)
    args = ap.parse_args(argv)
    repo = os.getcwd()
    load_dotenv(repo)
    return check(repo, JevClient(), args.sure, args.maybe, args.paths or None)


if __name__ == "__main__":
    sys.exit(main())
