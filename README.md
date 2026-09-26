# side-eye

Gives your side effects the side-eye.

side-eye watches your uncommitted source changes and flags externalities as you save: network
calls, secrets being read, auth changes, schema changes, swallowed exceptions, background tasks
and so on. Each flag comes with a calibrated confidence, not a verdict. It buys attention, not judgment.

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
  "blastRadius": ["local", "module", "service", "system-wide"],
  "rules": [
    { "key": "network", "label": "Network call is made",
      "question": "Does this code change make a network call or add a new outbound host?" }
  ]
}
```

Each rule is one yes/no question Jev answers per diff hunk. `label` is what you see, `question`
is what Jev is asked. Keep them saying the same thing. Flags at or above `sure` print loud,
between `maybe` and `sure` print dim, the rest stay silent.

## Development

```
npm install
npm test                         # vitest with coverage, report in coverage/
npm run build                    # tsc to dist/
node dist/cli.js watch
```
