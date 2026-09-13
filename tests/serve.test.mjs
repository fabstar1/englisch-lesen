import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("../tools/serve.mjs", import.meta.url));

function startServer(dir) {
  const proc = spawn("node", [TOOL, "0", dir], { stdio: ["ignore", "pipe", "pipe"] });
  const port = new Promise((resolve, reject) => {
    let buf = "";
    proc.stdout.on("data", (d) => {
      buf += d;
      const m = buf.match(/localhost:(\d+)/);
      if (m) resolve(Number(m[1]));
    });
    proc.on("exit", () => reject(new Error("Server beendet: " + buf)));
  });
  return { proc, port };
}

test("serve: index.html, MIME-Typen, no-store, 404, kein Zugriff außerhalb", async () => {
  const dir = mkdtempSync(join(tmpdir(), "serve-"));
  writeFileSync(join(dir, "index.html"), "<h1>Hallo</h1>");
  writeFileSync(join(dir, "a.json"), "{}");
  writeFileSync(join(dir, "..", "geheim-serve-test.txt"), "geheim");
  const { proc, port } = startServer(dir);
  const base = `http://127.0.0.1:${await port}`;
  try {
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type"), /text\/html/);
    assert.equal(await home.text(), "<h1>Hallo</h1>");
    const json = await fetch(`${base}/a.json`);
    assert.match(json.headers.get("content-type"), /application\/json/);
    assert.equal(json.headers.get("cache-control"), "no-store");
    assert.equal((await fetch(`${base}/fehlt.txt`)).status, 404);
    assert.notEqual((await fetch(`${base}/%2e%2e/geheim-serve-test.txt`)).status, 200);
    assert.notEqual((await fetch(`${base}/..%5Cgeheim-serve-test.txt`)).status, 200);
  } finally {
    proc.kill();
  }
});
