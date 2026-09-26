"""Send one source file to Jev, hunk by hunk, and print what comes back."""

from __future__ import annotations

from .hunks import hunks_for, split_hunks
from .report import render


def check_file(repo, client, path: str, sure: float, maybe: float) -> bool:
    """Send every hunk of one source file. Returns True if anything was flagged."""
    flagged = False
    for h in split_hunks(hunks_for(repo, path)):
        out = render(h, client.ask(h.text), sure, maybe)
        if out:
            print(out)
            flagged = True
    return flagged
