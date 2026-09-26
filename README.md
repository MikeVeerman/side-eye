# jevwatch

Flags externalities in your uncommitted code changes using Jev, on your own machine.

Only source code files are ever sent (`.py`, `.ts`, `.java`, ...). Config, env, data and
lock files never leave the machine. See `jevwatch/whitelist.py`, that list is the whole rule.

```
uv venv && uv pip install -e ".[dev]"
echo "TYPESAFE_API_KEY=..." > .env
jevwatch check              # every changed source file
jevwatch check src/a.py     # just these
jevwatch watch              # re-check a source file each time you save it
```

Each diff hunk is sent with ten yes/no questions (network, secrets, auth, schema, ...) and one
blast-radius score. Flags at or above `--sure` (0.8) print loud, between `--maybe` (0.5) and
sure print dim, the rest stay silent.

Tests and coverage: `pytest` (coverage report in `htmlcov/`).
