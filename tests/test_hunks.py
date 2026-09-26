import subprocess

import pytest

from jevwatch.hunks import Hunk, changed_files, hunks_for, split_hunks


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout


@pytest.fixture
def repo(tmp_path):
    git(tmp_path, "init", "-q", "-b", "main")
    git(tmp_path, "config", "user.email", "t@t")
    git(tmp_path, "config", "user.name", "t")
    (tmp_path / "a.py").write_text("def a():\n    return 1\n")
    (tmp_path / "data.json").write_text("{}\n")
    git(tmp_path, "add", ".")
    git(tmp_path, "commit", "-q", "-m", "init")
    return tmp_path


def test_changed_files_lists_modified_and_untracked(repo):
    (repo / "a.py").write_text("def a():\n    return 2\n")
    (repo / "b.py").write_text("x = 1\n")
    (repo / "data.json").write_text('{"k": 1}\n')
    assert changed_files(repo) == ["a.py", "b.py", "data.json"]


def test_changed_files_empty_when_clean(repo):
    assert changed_files(repo) == []


def test_hunks_for_modified_file_contains_added_line(repo):
    (repo / "a.py").write_text("import os\n\ndef a():\n    return os.environ['X']\n")
    hs = hunks_for(repo, "a.py")
    assert len(hs) == 1
    assert hs[0].path == "a.py"
    assert "+import os" in hs[0].text
    assert "+    return os.environ['X']" in hs[0].text


def test_hunks_for_untracked_file_is_whole_file_as_added(repo):
    (repo / "b.py").write_text("x = 1\ny = 2\n")
    hs = hunks_for(repo, "b.py")
    assert len(hs) == 1
    assert "+x = 1" in hs[0].text and "+y = 2" in hs[0].text


def test_hunks_for_unchanged_file_is_empty(repo):
    assert hunks_for(repo, "a.py") == []


def test_split_hunks_keeps_each_piece_under_cap():
    big = Hunk("a.py", "\n".join(f"+line {i}" for i in range(400)))
    parts = split_hunks([big], cap=500)
    assert len(parts) > 1
    assert all(len(p.text) <= 500 for p in parts)
    assert all(p.path == "a.py" for p in parts)
    assert "\n".join(p.text for p in parts) == big.text


def test_split_hunks_leaves_small_hunk_alone():
    small = Hunk("a.py", "+x = 1")
    assert split_hunks([small], cap=500) == [small]
