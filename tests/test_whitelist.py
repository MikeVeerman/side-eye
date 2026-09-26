import pytest

from jevwatch.whitelist import is_source


@pytest.mark.parametrize("path", [
    "app.py", "src/a.ts", "src/a.tsx", "web/x.js", "Main.java", "cmd/main.go",
    "lib.rs", "app.rb", "A.kt", "Prog.cs", "x.c", "x.cpp", "x.h",
])
def test_source_files_pass(path):
    assert is_source(path)


@pytest.mark.parametrize("path", [
    "config.json", "settings.yaml", "settings.yml", "pyproject.toml", "schema.sql",
    "users.csv", "README.md", ".env", ".env.local", "package-lock.json", "uv.lock",
    "dump.txt", "notes", "data/users.jsonl", "keys.pem",
])
def test_config_env_and_data_are_refused(path):
    assert not is_source(path)


def test_rule_is_by_extension_only_not_path():
    # A source file inside a fixtures folder still passes. Path rules are on purpose absent.
    assert is_source("tests/fixtures/sample.py")


def test_extension_check_is_case_insensitive():
    assert is_source("Main.PY")
