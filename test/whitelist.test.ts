import { describe, expect, it } from "vitest";
import { isSource, DEFAULT_EXTENSIONS } from "../src/whitelist.js";

describe("isSource", () => {
  it.each(["app.py", "src/a.ts", "src/a.tsx", "web/x.js", "Main.java", "cmd/main.go", "lib.rs",
           "app.rb", "A.kt", "Prog.cs", "x.c", "x.cpp", "x.h"])("passes source file %s", (p) => {
    expect(isSource(p, DEFAULT_EXTENSIONS)).toBe(true);
  });

  it.each(["config.json", "settings.yaml", "pyproject.toml", "schema.sql", "users.csv", "README.md",
           ".env", ".env.local", "package-lock.json", "uv.lock", "dump.txt", "notes", "keys.pem",
           ".side-eye"])("refuses config, env and data file %s", (p) => {
    expect(isSource(p, DEFAULT_EXTENSIONS)).toBe(false);
  });

  it("is by extension only, never by path", () => {
    expect(isSource("tests/fixtures/sample.py", DEFAULT_EXTENSIONS)).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isSource("Main.PY", DEFAULT_EXTENSIONS)).toBe(true);
  });

  it("honours a custom list", () => {
    expect(isSource("a.vue", [".vue"])).toBe(true);
    expect(isSource("a.py", [".vue"])).toBe(false);
  });
});
