"""jevwatch check [paths...] | jevwatch watch  -- flag externalities in uncommitted source changes."""

from __future__ import annotations

import argparse
import os
import sys

from .checker import check_file
from .client import JevClient
from .hunks import changed_files
from .watch import watch
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
        check_file(repo, client, path, sure, maybe)
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="jevwatch")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="check uncommitted changes (or the given files)")
    c.add_argument("paths", nargs="*")
    c.add_argument("--sure", type=float, default=0.8)
    c.add_argument("--maybe", type=float, default=0.5)
    w = sub.add_parser("watch", help="re-check source files as you save them")
    w.add_argument("--sure", type=float, default=0.8)
    w.add_argument("--maybe", type=float, default=0.5)
    w.add_argument("--interval", type=float, default=1.0)
    w.add_argument("--rounds", type=int, default=None, help="stop after this many polls (default: forever)")
    args = ap.parse_args(argv)
    repo = os.getcwd()
    load_dotenv(repo)
    client = JevClient()
    if args.cmd == "watch":
        return watch(repo, client, args.sure, args.maybe, args.interval, args.rounds)
    return check(repo, client, args.sure, args.maybe, args.paths or None)


if __name__ == "__main__":
    sys.exit(main())
