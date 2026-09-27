// The browser UI: three plain files (html, css, js) in the ui/ folder next to this module, served as-is. No build step, no external assets.

import { readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";

const FILES: Record<string, { name: string; type: string }> = {
  "/": { name: "index.html", type: "text/html; charset=utf-8" },
  "/style.css": { name: "style.css", type: "text/css; charset=utf-8" },
  "/app.js": { name: "app.js", type: "text/javascript; charset=utf-8" },
};

/** Serves one of the UI's files. Returns false when the path is not part of the UI. */
export function serveUiFile(pathname: string, res: ServerResponse): boolean {
  const file = FILES[pathname];
  if (!file) return false;
  res.writeHead(200, { "content-type": file.type });
  res.end(readFileSync(new URL(`./ui/${file.name}`, import.meta.url)));
  return true;
}
