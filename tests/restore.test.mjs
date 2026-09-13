import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ENCRYPT = fileURLToPath(new URL("../tools/encrypt.mjs", import.meta.url));
const RESTORE = fileURLToPath(new URL("../tools/restore.mjs", import.meta.url));
const BASE = fileURLToPath(new URL("../docs/base-words.json", import.meta.url));
const PW = { ...process.env, READER_PASSWORD: "test-passwort" };

/** Wurzel mit einem gültigen Text, bereits verschlüsselt. */
function published() {
  const root = mkdtempSync(join(tmpdir(), "restore-"));
  mkdirSync(join(root, "library"), { recursive: true });
  mkdirSync(join(root, "docs", "texts"), { recursive: true });
  copyFileSync(BASE, join(root, "docs", "base-words.json"));
  // Gleiche Schreibweise wie writeJson in tools/lib.mjs, inklusive abschließendem Zeilenumbruch.
  writeFileSync(join(root, "library", "2026-09-13-fuchs.json"), JSON.stringify({
    id: "2026-09-13-fuchs", title: "Der Fuchs", author: "A", source: "", addedAt: "2026-09-13",
    level: "B1", summary: "S.",
    paragraphs: [{ type: "p", text: "The fox runs." }],
    glosses: { fox: { de: "der Fuchs", base: "", pos: "Substantiv", note: "" }, runs: { de: "rennen", base: "run", pos: "Verb", note: "" } },
  }, null, 2) + "\n");
  const r = spawnSync("node", [ENCRYPT, "--root", root], { encoding: "utf8", env: PW });
  assert.equal(r.status, 0, r.stderr);
  return root;
}
const runRestore = (root, ...args) => spawnSync("node", [RESTORE, "--root", root, ...args], { encoding: "utf8", env: PW });
const runEncrypt = (root, ...args) => spawnSync("node", [ENCRYPT, "--root", root, ...args], { encoding: "utf8", env: PW });

test("encrypt löscht nichts, wenn library/ leer ist (frischer Klon)", () => {
  const root = published();
  rmSync(join(root, "library"), { recursive: true, force: true });
  const r = runEncrypt(root);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /library\/ ist leer/);
  assert.match(r.stderr, /npm run restore/);
  assert.ok(existsSync(join(root, "docs", "texts", "2026-09-13-fuchs.json")), "Text wurde gelöscht");
});

test("encrypt entfernt verwaiste Dateien weiterhin, wenn library/ Inhalt hat", () => {
  const root = published();
  writeFileSync(join(root, "docs", "texts", "2020-01-01-alt.json"), "{}");
  const r = runEncrypt(root);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /entfernt \(kein Klartext mehr\): 2020-01-01-alt/);
  assert.ok(existsSync(join(root, "docs", "texts", "2026-09-13-fuchs.json")));
});

test("restore holt den Klartext originalgetreu zurück", () => {
  const root = published();
  const before = readFileSync(join(root, "library", "2026-09-13-fuchs.json"), "utf8");
  rmSync(join(root, "library"), { recursive: true, force: true });
  const r = runRestore(root);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /wiederhergestellt: 2026-09-13-fuchs \(Der Fuchs\)/);
  assert.equal(readFileSync(join(root, "library", "2026-09-13-fuchs.json"), "utf8"), before);
});

test("restore überspringt vorhandene Dateien, --force überschreibt", () => {
  const root = published();
  const file = join(root, "library", "2026-09-13-fuchs.json");
  writeFileSync(file, "{}");
  assert.match(runRestore(root).stdout, /übersprungen \(gibt es schon\)/);
  assert.equal(readFileSync(file, "utf8"), "{}");
  assert.match(runRestore(root, "--force").stdout, /wiederhergestellt/);
  assert.ok(readFileSync(file, "utf8").includes("Der Fuchs"));
});

test("restore mit falschem Passwort meldet Fehler und schreibt nichts", () => {
  const root = published();
  rmSync(join(root, "library"), { recursive: true, force: true });
  const r = spawnSync("node", [RESTORE, "--root", root], {
    encoding: "utf8",
    env: { ...process.env, READER_PASSWORD: "falsch" },
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Falsches Passwort/);
  assert.equal(existsSync(join(root, "library")) && readdirSync(join(root, "library")).length > 0, false);
});

test("restore ohne Passwort Exit 2", () => {
  const root = published();
  const env = { ...process.env };
  delete env.READER_PASSWORD;
  const r = spawnSync("node", [RESTORE, "--root", root], { encoding: "utf8", env });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /npm run setup/);
});
