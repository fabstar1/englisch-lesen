// Lokaler Server für docs/. Aufruf: node tools/serve.mjs [port] [dir]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, extname, sep } from "node:path";
import { ROOT } from "./lib.mjs";

const port = Number(process.argv[2] ?? 8080);
const dir = resolve(process.argv[3] ?? join(ROOT, "docs"));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let file = resolve(join(dir, urlPath));
  if (file !== dir && !file.startsWith(dir + sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Verboten");
  } else {
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Nicht gefunden: " + urlPath);
    }
  }
  console.log(`${res.statusCode} ${urlPath}`);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Läuft auf http://localhost:${server.address().port}/  (Ordner: ${dir})`);
});
