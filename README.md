# side-eye

Giving agent quirks the side-eye.

side-eye watches your uncommitted source changes and flags habits of AI-written code as you
save. The example rules catch five of them:

- comments that say what the code does instead of why
- fallbacks and guards that hide missing data instead of failing loudly
- debug leftovers: stray prints, commented-out code, stale TODOs, unused imports
- type system bypasses: `any`, unknown casts, type-ignore comments
- vague names: `data`, `result`, `tmp`, `obj`, single letters

The system uses [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) for instant and dirt-cheap checks as your agent builds. It requires a TYPESAFE_API_KEY.

Let you agent watch the command line feedback or keep an eye on them in the web UI.

Only source code files tracked by git are ever sent to Jev. Config, env, secrets, PII data and lock
files never leave the machine. That list lives in `.side-eye`.

## Setup

```
npm install -g side-eye-cli      # or: npx side-eye-cli
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

## For agents

Claude Code or any other agent reads the same plain text you do. No JSON to parse.

```
side-eye check                                        # current uncommitted changes
curl http://127.0.0.1:4242/findings                   # same text while side-eye watch runs
curl http://127.0.0.1:4242/findings?path=src/a.ts     # just the file the agent is editing
```

The text looks like this:

```
side-eye: 3 flags in 2 files. !! = sure (80% and up), maybe = uncertain (50% to 80%).

src/a.ts  lines 8-23
  1. !! Fallback hides missing data     94%  [fallback]
  2. maybe Vague names                  61%  [naming]

frontend/Button.tsx  lines 1-14
  1. !! Inline styles used              97%  [inline_style, frontend/.side-eye]

skipped (not source files, never sent): config.json
```

The first line is the summary and the legend. Each block is one diff hunk: path, line range in
the new file, then the rules that fired, highest first. The bracket holds the rule key and, for a
nested rule, the `.side-eye` it came from. When nothing fired the whole output is one line:
`side-eye: no flags.`

A line for the project's `CLAUDE.md`:

```
After editing source files, run `side-eye check` (or GET http://127.0.0.1:4242/findings if
side-eye watch is running) and fix every row marked "!!" before reporting done.
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
is what Jev is asked. Flags at or above `sure` print loud, between `maybe`
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
