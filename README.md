# side-eye

Giving agent quirks the side-eye.

side-eye watches your uncommitted source changes and flags habits of AI-written code as you
save. The default rules catch five of them:

- comments that say what the code does instead of why
- fallbacks and guards that hide missing data instead of failing loudly
- debug leftovers: stray prints, commented-out code, stale TODOs, unused imports
- type system bypasses: `any`, unknown casts, type-ignore comments
- vague names: `data`, `result`, `tmp`, `obj`, single letters

Each flag comes with a calibrated confidence, not a verdict. It buys attention, not judgment.
Rules are plain yes/no questions in a file, so add your own: network calls, secrets, schema
changes, whatever your team side-eyes.

Only source code files are ever sent (`.py`, `.ts`, `.java`, ...). Config, env, data and lock
files never leave the machine. That list lives in `.side-eye` and is the whole rule.

## Setup

```
npm install -g side-eye          # or: npx side-eye
cd your-repo
side-eye init                    # writes .side-eye, commit it
echo "TYPESAFE_API_KEY=..." > .env
```

## Use

```
side-eye check                   # every changed source file
side-eye check src/a.ts          # just these
side-eye watch                   # re-check on save, plus a live page at http://127.0.0.1:4242
side-eye watch --port 5000 --interval 2000 --no-server
```

## The .side-eye file

Committed in the target repo so the team shares one set of rules.

```json
{
  "extensions": [".py", ".ts", "..."],
  "sure": 0.8,
  "maybe": 0.5,
  "rules": [
    { "key": "leftovers", "label": "Debug leftovers",
      "question": "Does this code change leave debug prints, commented-out code, stale TODO notes or unused imports behind?" }
  ]
}
```

Each rule is one yes/no question Jev answers per diff hunk. `label` is what you see, `question`
is what Jev is asked. Keep them saying the same thing, and keep the question to one sentence:
explanation around it dilutes the answer. Flags at or above `sure` print loud, between `maybe`
and `sure` print dim, the rest stay silent.

Edit rules in the Rules tab of the page, or in the file by hand. Either way a running
`side-eye watch` notices the change, reloads the rules and re-checks every changed file.

## Rules for one folder

Put a second `.side-eye` inside a folder and its rules apply only to files under that folder,
on top of the root rules. It holds just a `rules` list:

```json
{
  "rules": [
    { "key": "inline_style", "label": "Inline styles used",
      "question": "Does this code change add inline style attributes instead of using a stylesheet or class?" }
  ]
}
```

Rules merge by key and the nearest file wins, so reusing a root key inside `frontend/.side-eye`
replaces that rule for front-end files only. Thresholds and the extension whitelist stay in the
root file. Create one with `side-eye init frontend`, or from the Rules tab, which also shows which
rules apply to any given path. A flag from a nested rule says so, both in the terminal and on the page.

## Development

```
npm install
npm test                         # vitest with coverage, report in coverage/
npm run build                    # tsc to dist/
node dist/cli.js watch
```
