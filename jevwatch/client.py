"""Thin client for TypeSafe's systemone endpoint. Same request shape as jev-bench."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

import requests

from .questions import BLAST_RADIUS, QUESTIONS, request_questions

API_URL = "https://api.typesafe.ai/v1/systemone"
RETRY_STATUSES = {429, 500, 502, 503, 504}


@dataclass
class Answer:
    flags: dict[str, float]        # question key -> probability of "yes"
    blast_radius: list[float]      # distribution over BLAST_RADIUS
    input_tokens: int


class JevClient:
    def __init__(self, api_key: str | None = None, model: str = "jev-latest", timeout: float = 60.0):
        self.api_key = api_key or os.environ["TYPESAFE_API_KEY"]
        self.model = model
        self.timeout = timeout
        self.session = requests.Session()

    def ask(self, state: str) -> Answer:
        body = {"state": state, "model": self.model, "questions": request_questions()}
        last = None
        for attempt in range(6):
            r = self.session.post(API_URL, json=body, timeout=self.timeout,
                                  headers={"Authorization": f"Bearer {self.api_key}"})
            if r.status_code in RETRY_STATUSES:
                last = RuntimeError(f"{r.status_code}: {r.text[:200]}")
                time.sleep(float(r.headers.get("retry-after", min(2 ** attempt, 30))))
                continue
            r.raise_for_status()
            return _parse(r.json())
        raise RuntimeError(f"jev request failed after retries: {last}")


def _parse(d: dict) -> Answer:
    a = d["answers"]
    flags = {k: float(a[k]["noul"]) for k in QUESTIONS}
    br = [float(a["blast_radius"]["probabilities"][str(i)]) for i in range(len(BLAST_RADIUS))]
    return Answer(flags=flags, blast_radius=br, input_tokens=int(d["usage"]["input_tokens"]))
