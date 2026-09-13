import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("../tools/merge.mjs", import.meta.url));

function fixture(parts) {
  const dir = mkdtempSync(join(tmpdir(), "merge-"));
  const file = join(dir, "2026-09-13-fox.json");
  writeFileSync(file, JSON.stringify({
    id: "2026-09-13-fox", title: "Fox", author: "", source: "", addedAt: "2026-09-13", level: "A2", summary: "Test.",
    paragraphs: [{ type: "p", text: "The quick brown fox jumps over the lazy dog." }],
    glosses: { quick: { de: "schnell", base: "", pos: "Adjektiv", note: "" } },
  }));
  const partsDir = join(dir, ".parts", "2026-09-13-fox");
  if (parts) {
    mkdirSync(partsDir, { recursive: true });
    for (const [name, content] of Object.entries(parts)) {
      writeFileSync(join(partsDir, name), typeof content === "string" ? content : JSON.stringify(content));
    }
  }
  return { file, partsDir };
}
const run = (...args) => execFileSync("node", [TOOL, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

test("merge: übernimmt gültige Einträge, verwirft ungültige, löscht Teile", () => {
  const { file, partsDir } = fixture({
    "1.json": { brown: { de: "braun", pos: "Adjektiv" }, "Don’t": { de: "nicht" } },
    "2.json": { bad: { pos: "Verb" }, lazy: { de: "faul", pos: "Adjektiv", note: "x" } },
  });
  const out = run(file);
  const text = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual(Object.keys(text.glosses), ["brown", "don't", "lazy", "quick"]);
  assert.deepEqual(text.glosses.brown, { de: "braun", base: "", pos: "Adjektiv", note: "" });
  assert.equal(existsSync(partsDir), false);
  assert.match(out, /3 Einträge übernommen, 1 verworfen, 4 gesamt/);
});

test("merge: neuer Eintrag überschreibt alten", () => {
  const { file } = fixture({ "1.json": { quick: { de: "flink", pos: "Adjektiv" } } });
  run(file);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).glosses.quick.de, "flink");
});

test("merge: unlesbare Teildatei wird gemeldet, Rest übernommen", () => {
  const { file } = fixture({ "1.json": "{ kaputt", "2.json": { fox: { de: "der Fuchs", pos: "Substantiv" } } });
  const out = run(file);
  assert.match(out, /1 Einträge übernommen/);
  assert.ok("fox" in JSON.parse(readFileSync(file, "utf8")).glosses);
});

test("merge: ohne Teile-Ordner Exit-Code 1", () => {
  const { file } = fixture(null);
  assert.throws(() => run(file), (e) => e.status === 1);
});
