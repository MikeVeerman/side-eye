// A small local server so the flags also show up in a browser. Node's http module, nothing else.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { validateRules } from "./config.js";
import { serveUiFile } from "./ui.js";
import type { Config, Finding } from "./types.js";

export interface SideEyeServer {
  url: string;
  push(f: Finding): void;
  clean(path: string): void;
  close(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; });
    req.on("end", () => resolve(data));
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** cfg is shared with the watcher and updated in place, so a saved rule applies to the next check. */
export function startServer(port: number, cfg: Config, onSave?: (cfg: Config) => void): Promise<SideEyeServer> {
  let findings: Finding[] = [];
  const clients = new Set<ServerResponse>();

  const send = (event: string, data: unknown) => {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) c.write(msg);
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (serveUiFile(url.pathname, res)) return;
    if (url.pathname === "/api/findings") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ findings }));
    } else if (url.pathname === "/api/config") {
      json(res, 200, cfg);
    } else if (url.pathname === "/api/rules" && req.method === "PUT") {
      readBody(req).then((body) => {
        try {
          const rules = JSON.parse(body).rules;
          validateRules(rules);
          cfg.rules = rules;
          onSave?.(cfg);
          json(res, 200, cfg);
        } catch (e) {
          json(res, 400, { error: (e as Error).message });
        }
      });
    } else if (url.pathname === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.flushHeaders();
      clients.add(res);
      req.on("close", () => clients.delete(res));
    } else {
      res.writeHead(404);
      res.end("not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", (e: NodeJS.ErrnoException) => {
      reject(e.code === "EADDRINUSE" ? new Error(`port ${port} is already in use (try --port)`) : e);
    });
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const actual = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        url: `http://127.0.0.1:${actual}`,
        push(f) {
          findings = [f, ...findings].sort((a, b) => b.at - a.at);
          send("finding", f);
        },
        clean(path) {
          findings = findings.filter((f) => f.path !== path);
          send("clean", { path });
        },
        close() {
          for (const c of clients) c.end();
          clients.clear();
          return new Promise((r) => server.close(() => r()));
        },
      });
    });
  });
}
