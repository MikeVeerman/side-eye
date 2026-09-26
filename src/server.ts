// A small local server so the flags also show up in a browser. Node's http module, nothing else.

import { createServer, type ServerResponse } from "node:http";
import { PAGE } from "./page.js";
import type { Config, Finding } from "./types.js";

export interface SideEyeServer {
  url: string;
  push(f: Finding): void;
  clean(path: string): void;
  close(): Promise<void>;
}

export function startServer(port: number, cfg: Config): Promise<SideEyeServer> {
  let findings: Finding[] = [];
  const clients = new Set<ServerResponse>();

  const send = (event: string, data: unknown) => {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) c.write(msg);
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
    } else if (url.pathname === "/api/findings") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ findings }));
    } else if (url.pathname === "/api/config") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(cfg));
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
