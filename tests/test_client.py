import pytest

from jevwatch.client import JevClient, Answer
from jevwatch.questions import QUESTIONS, BLAST_RADIUS


class FakeResponse:
    def __init__(self, status, payload):
        self.status_code = status
        self.headers = {}
        self.text = str(payload)
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)


def payload():
    answers = {k: {"noul": 0.1} for k in QUESTIONS}
    answers["network"] = {"noul": 0.93}
    answers["blast_radius"] = {"probabilities": {str(i): p for i, p in enumerate([0.7, 0.2, 0.1, 0.0])}}
    return {"answers": answers, "usage": {"input_tokens": 123}}


def test_ask_posts_state_and_questions_and_parses_answer(monkeypatch):
    sent = {}

    def post(url, json, timeout, headers):
        sent.update(url=url, body=json, headers=headers)
        return FakeResponse(200, payload())

    c = JevClient(api_key="k")
    monkeypatch.setattr(c.session, "post", post)
    a = c.ask("+import requests")
    assert sent["url"] == "https://api.typesafe.ai/v1/systemone"
    assert sent["headers"]["Authorization"] == "Bearer k"
    assert sent["body"]["state"] == "+import requests"
    assert sent["body"]["model"] == "jev-latest"
    assert set(sent["body"]["questions"]) == set(QUESTIONS) | {"blast_radius"}
    assert isinstance(a, Answer)
    assert a.flags["network"] == 0.93
    assert a.flags["secrets"] == 0.1
    assert a.blast_radius == [0.7, 0.2, 0.1, 0.0]
    assert a.input_tokens == 123


def test_ask_retries_on_429_then_succeeds(monkeypatch):
    calls = []

    def post(url, json, timeout, headers):
        calls.append(1)
        return FakeResponse(429, {}) if len(calls) == 1 else FakeResponse(200, payload())

    c = JevClient(api_key="k")
    monkeypatch.setattr(c.session, "post", post)
    monkeypatch.setattr("jevwatch.client.time.sleep", lambda s: None)
    assert c.ask("x").flags["network"] == 0.93
    assert len(calls) == 2


def test_ask_gives_up_after_retries(monkeypatch):
    c = JevClient(api_key="k")
    monkeypatch.setattr(c.session, "post", lambda *a, **kw: FakeResponse(503, {}))
    monkeypatch.setattr("jevwatch.client.time.sleep", lambda s: None)
    with pytest.raises(RuntimeError):
        c.ask("x")


def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    with pytest.raises(KeyError):
        JevClient()
