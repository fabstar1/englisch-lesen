import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeKey } from "../docs/tokenizer.js";

const base = JSON.parse(readFileSync(new URL("../docs/base-words.json", import.meta.url), "utf8"));

test("Grundliste hat mindestens 200 Einträge", () => {
  assert.ok(Object.keys(base).length >= 200);
});

test("Alle Schlüssel sind normalisierte Einzelwörter", () => {
  for (const key of Object.keys(base)) {
    assert.equal(key, normalizeKey(key), `Schlüssel nicht normalisiert: ${key}`);
    assert.ok(!key.includes(" "), `Schlüssel enthält Leerzeichen: ${key}`);
  }
});

test("Alle Einträge haben de und pos", () => {
  for (const [key, value] of Object.entries(base)) {
    assert.ok(typeof value.de === "string" && value.de.length > 0, `de fehlt bei ${key}`);
    assert.ok(typeof value.pos === "string" && value.pos.length > 0, `pos fehlt bei ${key}`);
    if ("note" in value) assert.equal(typeof value.note, "string");
  }
});

test("Wichtige Wörter sind enthalten", () => {
  for (const key of ["the", "a", "don't", "it's", "i'll", "of", "and", "very", "will"]) {
    assert.ok(key in base, `${key} fehlt`);
  }
});
