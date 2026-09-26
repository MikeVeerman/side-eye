from jevwatch.client import Answer
from jevwatch.hunks import Hunk
from jevwatch.report import classify, render


def answer(**flags):
    base = {"network": 0.05, "secrets": 0.05, "auth": 0.05}
    base.update(flags)
    return Answer(flags=base, blast_radius=[0.1, 0.6, 0.2, 0.1], input_tokens=10)


def test_classify_splits_sure_maybe_and_silent():
    a = answer(network=0.91, secrets=0.6, auth=0.2)
    sure, maybe = classify(a, sure=0.8, maybe=0.5)
    assert sure == [("network", 0.91)]
    assert maybe == [("secrets", 0.6)]


def test_classify_sorts_by_probability_desc():
    a = answer(network=0.85, secrets=0.95)
    sure, _ = classify(a, sure=0.8, maybe=0.5)
    assert [k for k, _ in sure] == ["secrets", "network"]


def test_render_shows_path_flags_and_blast_radius():
    out = render(Hunk("src/a.py", "+x"), answer(network=0.91, secrets=0.6))
    assert "src/a.py" in out
    assert "network" in out and "91%" in out
    assert "maybe" in out and "secrets" in out
    assert "module" in out  # argmax of blast radius


def test_render_is_quiet_when_nothing_flagged():
    assert render(Hunk("src/a.py", "+x"), answer()) == ""
