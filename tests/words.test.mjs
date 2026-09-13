import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("../tools/words.mjs", import.meta.url));

function fixtureFile(glosses = {}) {
  const dir = mkdtempSync(join(tmpdir(), "words-"));
  const file = join(dir, "2026-09-13-fox.json");
  writeFileSync(file, JSON.stringify({
    id: "2026-09-13-fox", title: "Fox", author: "", source: "", addedAt: "2026-09-13", level: "A2", summary: "Test.",
    paragraphs: [{ type: "p", text: "The quick brown fox jumps over the lazy dog." }],
    glosses,
  }));
  return file;
}
const withQuick = () => fixtureFile({ quick: { de: "schnell", pos: "Adjektiv" } });
const run = (...args) => execFileSync("node", [TOOL, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

test("words: ohne Grundlisten-Wörter und vorhandene Einträge", () => {
  assert.deepEqual(JSON.parse(run(withQuick(), "--json")), ["brown", "dog", "fox", "jumps", "lazy"]);
});

test("words: --all ignoriert die Grundliste", () => {
  const out = JSON.parse(run(fixtureFile(), "--all", "--json"));
  assert.ok(out.includes("the") && out.includes("over"));
});

test("words: --chunk teilt in Blöcke", () => {
  assert.deepEqual(JSON.parse(run(withQuick(), "--chunk", "2", "--json")), [["brown", "dog"], ["fox", "jumps"], ["lazy"]]);
});

test("words: Textausgabe eine Zeile pro Wort", () => {
  assert.deepEqual(run(withQuick()).trim().split("\n"), ["brown", "dog", "fox", "jumps", "lazy"]);
});

test("words: ohne Datei Exit-Code 2", () => {
  assert.throws(() => run(), (e) => e.status === 2);
});
