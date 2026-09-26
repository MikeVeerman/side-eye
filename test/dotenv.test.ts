import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDotenv } from "../src/dotenv.js";

describe("loadDotenv", () => {
  it("sets missing variables only", () => {
    const dir = mkdtempSync(join(tmpdir(), "env-"));
    writeFileSync(join(dir, ".env"), "TYPESAFE_API_KEY=abc\n# comment\nOTHER=1\n");
    process.env.OTHER = "keep";
    delete process.env.TYPESAFE_API_KEY;
    loadDotenv(dir);
    expect(process.env.TYPESAFE_API_KEY).toBe("abc");
    expect(process.env.OTHER).toBe("keep");
  });

  it("does nothing without a file", () => {
    expect(() => loadDotenv(mkdtempSync(join(tmpdir(), "env-")))).not.toThrow();
  });
});
