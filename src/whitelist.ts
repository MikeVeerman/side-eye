// The PII wall. One rule: only source code files leave the machine.
// Config, env, data and lock files are never sent, whatever folder they live in.
// The rule is by extension only, on purpose. Path rules would be a second thing to reason about.

import { extname } from "node:path";

export const DEFAULT_EXTENSIONS = [
  ".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs", ".rb", ".kt",
  ".cs", ".c", ".cpp", ".h", ".hpp",
];

export function isSource(path: string, extensions: string[]): boolean {
  return extensions.includes(extname(path).toLowerCase());
}
