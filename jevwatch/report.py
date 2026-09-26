"""Turn probabilities into something worth reading. Sure flags loud, maybes dim, rest silent."""

from __future__ import annotations

from .client import Answer
from .hunks import Hunk
from .questions import BLAST_RADIUS


def classify(a: Answer, sure: float, maybe: float):
    ranked = sorted(a.flags.items(), key=lambda kv: -kv[1])
    return ([kv for kv in ranked if kv[1] >= sure],
            [kv for kv in ranked if maybe <= kv[1] < sure])


def render(h: Hunk, a: Answer, sure: float = 0.8, maybe: float = 0.5) -> str:
    sure_flags, maybe_flags = classify(a, sure, maybe)
    if not sure_flags and not maybe_flags:
        return ""
    radius = BLAST_RADIUS[max(range(len(a.blast_radius)), key=a.blast_radius.__getitem__)]
    lines = [f"{h.path}  [{radius}]"]
    lines += [f"  !! {k:<11} {p:.0%}" for k, p in sure_flags]
    lines += [f"  maybe {k:<8} {p:.0%}" for k, p in maybe_flags]
    return "\n".join(lines)
