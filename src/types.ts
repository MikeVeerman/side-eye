export interface Rule {
  key: string;
  label: string;
  question: string;
}

export interface Config {
  extensions: string[];
  sure: number;
  maybe: number;
  rules: Rule[];
}

/** A rule together with the folder whose .side-eye defined it. "" is the repo root. */
export interface ScopedRule extends Rule {
  from: string;
}

/** The root .side-eye plus every nested one, keyed by folder. Shared by watcher and server, updated in place. */
export interface Scopes {
  root: Config;
  nested: Map<string, Rule[]>;
}

export interface Hunk {
  path: string;
  text: string;
  header: string; // the "@@ ... @@" line, kept when a hunk is split
}

export interface Answer {
  flags: Record<string, number>; // rule key -> probability of "yes"
  inputTokens: number;
}

export interface Row {
  n: number;
  mark: "!!" | "maybe";
  key: string;
  label: string;
  p: number;
  from: string; // folder of the .side-eye that defined the rule, "" for root
}

export interface Finding {
  path: string;
  lines: string;
  rows: Row[];
  at: number;
  diff: string; // the hunk that was sent, so the page can show what was judged
}

export interface Client {
  ask(state: string, rules: Rule[]): Promise<Answer>;
}
