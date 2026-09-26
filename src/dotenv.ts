import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Reads KEY=value lines from .env in the repo. Never overrides a variable already set. */
export function loadDotenv(repo: string): void {
  const p = join(repo, ".env");
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    if (process.env[k] === undefined) process.env[k] = line.slice(i + 1).trim();
  }
}
