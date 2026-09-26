import subprocess

import pytest

from jevwatch import cli
from jevwatch.client import Answer


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
    def __init__(self):
        self.states = []

    def ask(self, state):
        self.states.append(state)
        return Answer(flags={"network": 0.9, "secrets": 0.1}, blast_radius=[1, 0, 0, 0], input_tokens=5)


def test_check_only_sends_whitelisted_changed_files(repo, capsys):
    (repo / "a.py").write_text("import requests\n")
    (repo / "secrets.json").write_text('{"email": "x@y.z"}\n')
    fake = FakeClient()
    rc = cli.check(repo, fake, sure=0.8, maybe=0.5)
    assert rc == 0
    assert len(fake.states) == 1 and "+import requests" in fake.states[0]
    assert not any("x@y.z" in s for s in fake.states)
    out = capsys.readouterr().out
    assert "a.py" in out and "Network call is made" in out


def test_check_with_explicit_paths_refuses_non_source(repo, capsys):
    (repo / "a.py").write_text("import requests\n")
    (repo / "c.yaml").write_text("k: v\n")
    fake = FakeClient()
    cli.check(repo, fake, sure=0.8, maybe=0.5, paths=["c.yaml", "a.py"])
    assert len(fake.states) == 1
    assert "skipped c.yaml" in capsys.readouterr().out


def test_check_clean_tree_sends_nothing(repo, capsys):
    fake = FakeClient()
    assert cli.check(repo, fake, sure=0.8, maybe=0.5) == 0
    assert fake.states == []


def test_load_dotenv_sets_missing_vars_only(tmp_path, monkeypatch):
    (tmp_path / ".env").write_text("TYPESAFE_API_KEY=abc\nOTHER=1\n")
    monkeypatch.setenv("OTHER", "keep")
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    cli.load_dotenv(tmp_path)
    import os
    assert os.environ["TYPESAFE_API_KEY"] == "abc"
    assert os.environ["OTHER"] == "keep"


def test_main_runs_check_in_cwd(repo, monkeypatch, capsys):
    (repo / "a.py").write_text("import requests\n")
    monkeypatch.chdir(repo)
    monkeypatch.setenv("TYPESAFE_API_KEY", "k")
    monkeypatch.setattr(cli, "JevClient", lambda: FakeClient())
    assert cli.main(["check", "--sure", "0.85"]) == 0
    assert "Network call" in capsys.readouterr().out


def test_main_watch_subcommand(repo, monkeypatch, capsys):
    monkeypatch.chdir(repo)
    monkeypatch.setenv("TYPESAFE_API_KEY", "k")
    monkeypatch.setattr(cli, "JevClient", lambda: FakeClient())
    monkeypatch.setattr("jevwatch.watch.time.sleep", lambda s: None)
    assert cli.main(["watch", "--rounds", "1"]) == 0
    assert "watching" in capsys.readouterr().out
