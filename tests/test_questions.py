from jevwatch.questions import QUESTIONS, BLAST_RADIUS, request_questions


def test_every_question_has_key_and_instruction():
    for key, text in QUESTIONS.items():
        assert key and text.endswith("?"), key


def test_request_questions_has_one_noul_per_question_plus_score():
    qs = request_questions()
    assert set(qs) == set(QUESTIONS) | {"blast_radius"}
    for key in QUESTIONS:
        assert qs[key] == {"type": "noul", "instructions": QUESTIONS[key]}
    assert qs["blast_radius"]["type"] == "score"
    assert qs["blast_radius"]["criteria"] == BLAST_RADIUS
