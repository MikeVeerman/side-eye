from jevwatch.client import Answer
from jevwatch.hunks import Hunk
from jevwatch.questions import LABELS, QUESTIONS
from jevwatch.report import classify, render


def answer(**flags):
    base = {"network": 0.05, "secrets": 0.05, "auth": 0.05}
    base.update(flags)
    return Answer(flags=base, blast_radius=[0.1, 0.6, 0.2, 0.1], input_tokens=10)


def hunk():
    return Hunk("src/a.py", "@@ -1,2 +8,16 @@\n+x")


def test_every_question_has_a_label():
    assert set(LABELS) == set(QUESTIONS)


def test_classify_splits_sure_maybe_and_silent():
    a = answer(network=0.91, secrets=0.6, auth=0.2)
    sure, maybe = classify(a, sure=0.8, maybe=0.5)
    assert sure == [("network", 0.91)]
    assert maybe == [("secrets", 0.6)]


def test_classify_sorts_by_probability_desc():
    a = answer(network=0.85, secrets=0.95)
    sure, _ = classify(a, sure=0.8, maybe=0.5)
    assert [k for k, _ in sure] == ["secrets", "network"]


def test_render_header_has_path_line_range_and_blast_radius():
    out = render(hunk(), answer(network=0.91)).splitlines()
    assert out[0] == "src/a.py  lines 8-23  [module]"


def test_render_numbers_rows_and_uses_labels():
    out = render(hunk(), answer(network=0.91, auth=0.85, secrets=0.6)).splitlines()
    assert out[1] == "  1. !! Network call is made          91%"
    assert out[2] == "  2. !! Auth or permissions change    85%"
    assert out[3] == "  3. maybe Secrets are exposed        60%"


def test_render_is_quiet_when_nothing_flagged():
    assert render(hunk(), answer()) == ""
