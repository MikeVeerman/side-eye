"""jevwatch watch -- re-check a source file every time it is saved.

Polls file modification times once per interval. No extra dependency, and a second of lag
is fine next to a 300 ms round trip to Jev.
"""

from __future__ import annotations

import os
import time

from .hunks import changed_files
from .checker import check_file
from .whitelist import is_source


def watch(repo, client, sure: float, maybe: float, interval: float = 1.0,
          rounds: int | None = None, sleep=time.sleep, seen: dict | None = None) -> int:
    seen = {} if seen is None else seen
    print(f"watching {repo} (source files only, ctrl-c to stop)")
    done = 0
    while rounds is None or done < rounds:
        for path in changed_files(repo):
            if not is_source(path):
                continue
            mtime = os.stat(os.path.join(repo, path)).st_mtime
            if seen.get(path) == mtime:
                continue
            seen[path] = mtime
            if not check_file(repo, client, path, sure, maybe):
                print(f"ok  {path}")
        sleep(interval)
        done += 1
    return 0
