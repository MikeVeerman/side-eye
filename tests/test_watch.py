import os
import subprocess
import time

import pytest

from jevwatch.client import Answer
from jevwatch.watch import watch


def git(repo, *args):
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)


@pytest.fixture
def repo(tmp_path):
    git(tmp_path, "init", "-q", "-b", "main")
    git(tmp_path, "config", "user.email", "t@t")
    git(tmp_path, "config", "user.name", "t")
    (tmp_path / "a.py").write_text("x = 1\n")
    git(tmp_path, "add", ".")
    git(tmp_path, "commit", "-q", "-m", "init")
    return tmp_path


class FakeClient:
    def __init__(self, p=0.9):
        self.states, self.p = [], p

    def ask(self, state):
        self.states.append(state)
        return Answer(flags={"network": self.p}, blast_radius=[1, 0, 0, 0], input_tokens=5)


def touch(path, text, later=1):
    path.write_text(text)
    t = time.time() + later
    os.utime(path, (t, t))


def test_watch_checks_a_file_once_per_save(repo, capsys):
    fake = FakeClient()
    touch(repo / "a.py", "import requests\n")
    watch(repo, fake, sure=0.8, maybe=0.5, rounds=3, sleep=lambda s: None)
    assert len(fake.states) == 1
    out = capsys.readouterr().out
    assert "watching" in out and "a.py" in out and "Network call" in out


def test_watch_rechecks_after_another_save(repo):
    fake = FakeClient()
    touch(repo / "a.py", "import requests\n", later=1)
    watch(repo, fake, sure=0.8, maybe=0.5, rounds=1, sleep=lambda s: None)
    touch(repo / "a.py", "import requests\nimport os\n", later=2)
    watch(repo, fake, sure=0.8, maybe=0.5, rounds=1, sleep=lambda s: None, seen=None)
    assert len(fake.states) == 2


def test_watch_keeps_state_between_rounds(repo):
    fake = FakeClient()
    touch(repo / "a.py", "import requests\n", later=1)
    seen = {}
    watch(repo, fake, sure=0.8, maybe=0.5, rounds=1, sleep=lambda s: None, seen=seen)
    watch(repo, fake, sure=0.8, maybe=0.5, rounds=1, sleep=lambda s: None, seen=seen)
    assert len(fake.states) == 1


def test_watch_ignores_non_source_files(repo):
    fake = FakeClient()
    touch(repo / "users.json", '{"email": "a@b.c"}\n')
    watch(repo, fake, sure=0.8, maybe=0.5, rounds=2, sleep=lambda s: None)
    assert fake.states == []


def test_watch_says_ok_when_nothing_flagged(repo, capsys):
    touch(repo / "a.py", "y = 2\n")
    watch(repo, FakeClient(p=0.1), sure=0.8, maybe=0.5, rounds=1, sleep=lambda s: None)
    assert "ok  a.py" in capsys.readouterr().out


def test_watch_sleeps_between_rounds(repo):
    slept = []
    watch(repo, FakeClient(), sure=0.8, maybe=0.5, rounds=3, interval=0.25, sleep=slept.append)
    assert slept == [0.25, 0.25, 0.25]
