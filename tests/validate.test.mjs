import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("../tools/validate.mjs", import.meta.url));

function fixtureFile(patch = {}) {
  const dir = mkdtempSync(join(tmpdir(), "validate-"));
  const file = join(dir, "2026-09-13-fox.json");
  writeFileSync(file, JSON.stringify({
    id: "2026-09-13-fox", title: "Fox", author: "", source: "", addedAt: "2026-09-13", level: "A2", summary: "Test.",
    paragraphs: [{ type: "p", text: "The quick fox." }],
    glosses: { quick: { de: "schnell", pos: "Adjektiv" }, fox: { de: "der Fuchs", pos: "Substantiv" } },
    ...patch,
  }));
  return file;
}
const run = (...args) => spawnSync("node", [TOOL, ...args], { encoding: "utf8" });

test("validate: gültiger Text, Exit 0, OK-Zeile", () => {
  const r = run(fixtureFile());
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^OK: 2026-09-13-fox, 3 Wörter, 2 Einträge/);
});

test("validate: fehlende Wörter, Exit 1, Liste auf stderr", () => {
  const r = run(fixtureFile({ glosses: { quick: { de: "schnell" } } }));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Fehlende Einträge \(1\)/);
  assert.match(r.stderr, /^fox$/m);
  assert.match(r.stdout, /^FEHLER/);
});

test("validate: Schemafehler, Exit 1", () => {
  const r = run(fixtureFile({ level: "Z9" }));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Schema: level/);
});

test("validate: Wendung ohne Vorkommen ist nur Warnung", () => {
  const r = run(fixtureFile({ glosses: { quick: { de: "schnell" }, fox: { de: "der Fuchs" }, "fox quick": { de: "x" } } }));
  assert.equal(r.status, 0);
  assert.match(r.stderr, /Warnung.*Wendungen nicht im Text.*fox quick/);
});

test("validate: ohne Datei Exit 2", () => {
  assert.equal(run().status, 2);
});
