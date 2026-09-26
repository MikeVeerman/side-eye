export interface Rule {
  key: string;
  label: string;
  question: string;
}

export interface Config {
  extensions: string[];
  sure: number;
  maybe: number;
  blastRadius: string[];
  rules: Rule[];
}

export interface Hunk {
  path: string;
  text: string;
  header: string; // the "@@ ... @@" line, kept when a hunk is split
}

export interface Answer {
  flags: Record<string, number>; // rule key -> probability of "yes"
  blastRadius: number[];         // distribution over config.blastRadius
  inputTokens: number;
}

export interface Row {
  n: number;
  mark: "!!" | "maybe";
  key: string;
  label: string;
  p: number;
}

export interface Finding {
  path: string;
  lines: string;
  radius: string;
  rows: Row[];
  at: number;
}

export interface Client {
  ask(state: string, rules: Rule[], blastRadius: string[]): Promise<Answer>;
}
