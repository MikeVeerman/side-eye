#!/usr/bin/env node
// side-eye init | check [paths...] | watch [--port N] [--interval MS]

import { parseArgs } from "node:util";
import { checkRepo } from "./checker.js";
import { JevClient } from "./client.js";
import { initConfig, loadConfig, saveConfig } from "./config.js";
import { loadDotenv } from "./dotenv.js";
import { render } from "./report.js";
import { startServer } from "./server.js";
import { watch } from "./watch.js";

const USAGE = `usage:
  side-eye init                     write a default .side-eye file here
  side-eye check [paths...]         flag uncommitted source changes (or just these files)
  side-eye watch [--port 4242] [--interval 1000] [--no-server]
                                    re-check source files as you save them, with a local page`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv, allowPositionals: true,
    options: { port: { type: "string", default: "4242" }, interval: { type: "string", default: "1000" }, "no-server": { type: "boolean", default: false } },
  });
  const [cmd, ...paths] = positionals;
  const repo = process.cwd();

  if (cmd === "init") {
    console.log(`wrote ${initConfig(repo)}`);
    return 0;
  }
  if (cmd !== "check" && cmd !== "watch") {
    console.log(USAGE);
    return cmd === undefined || cmd === "help" ? 0 : 2;
  }

  loadDotenv(repo);
  const cfg = loadConfig(repo);
  const client = new JevClient({});

  if (cmd === "check") {
    const { findings, skipped } = await checkRepo(repo, client, cfg, paths.length ? paths : undefined);
    for (const p of skipped) console.log(`skipped ${p} (not a source file, never sent)`);
    for (const f of findings) console.log(render(f));
    return 0;
  }

  const server = values["no-server"] ? null : await startServer(Number(values.port), cfg, (c) => saveConfig(repo, c));
  console.log(`side-eye watching ${repo} (source files only, ctrl-c to stop)`);
  if (server) console.log(`page: ${server.url}`);
  await watch(repo, client, cfg, {
    interval: Number(values.interval),
    onStart: (path) => server?.clean(path),
    onFinding: (f) => { console.log(render(f)); server?.push(f); },
    onClean: (path) => console.log(`ok  ${path}`),
    onConfig: (c) => console.log(`.side-eye changed: ${c.rules.length} rules, re-checking every changed file`),
    onConfigError: (e) => console.error(`.side-eye changed but could not be loaded, keeping old rules: ${e.message}`),
  });
  return 0;
}

main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
