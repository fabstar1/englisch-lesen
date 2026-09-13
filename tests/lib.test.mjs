import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkGloss, checkSchema, coverage, phraseOccurs, validateText, chunk, readPassword, paths, LEVELS, POS,
} from "../tools/lib.mjs";

const fixture = () => ({
  id: "2026-09-13-test",
  title: "Test",
  author: "",
  source: "",
  addedAt: "2026-09-13",
  level: "B1",
  summary: "Ein Test.",
  paragraphs: [{ type: "p", text: "The quick fox." }],
  glosses: {
    quick: { de: "schnell", base: "", pos: "Adjektiv", note: "" },
    fox: { de: "der Fuchs", base: "", pos: "Substantiv", note: "" },
  },
});
const base = { the: { de: "der", pos: "Artikel" } };

test("Konstanten", () => {
  assert.deepEqual(LEVELS, ["A2", "B1", "B2", "C1", "C2"]);
  assert.ok(POS.includes("Phrasal Verb"));
});

test("checkGloss: gültiger Eintrag", () => {
  assert.deepEqual(checkGloss("fox", { de: "der Fuchs", pos: "Substantiv" }), []);
  assert.deepEqual(checkGloss("give up", { de: "aufgeben" }), []);
});

test("checkGloss: Fehler werden gemeldet", () => {
  assert.ok(checkGloss("Don’t", { de: "nicht" }).some((e) => /normalisiert/.test(e)));
  assert.ok(checkGloss("a b c d e", { de: "x" }).some((e) => /mehr als 4/.test(e)));
  assert.ok(checkGloss("fox", { pos: "Substantiv" }).some((e) => /de fehlt/.test(e)));
  assert.ok(checkGloss("fox", { de: "", pos: "Substantiv" }).some((e) => /de fehlt/.test(e)));
  assert.ok(checkGloss("fox", { de: "x", pos: "Nomen" }).some((e) => /Wortart/.test(e)));
  assert.ok(checkGloss("fox", { de: "x", note: 5 }).some((e) => /note/.test(e)));
  assert.ok(checkGloss("fox", "nur ein String").some((e) => /kein Objekt/.test(e)));
  assert.ok(checkGloss("", { de: "x" }).length > 0);
});

test("checkSchema: gültiger Text", () => {
  assert.deepEqual(checkSchema(fixture()), []);
});

test("checkSchema: Fehler nennen das Feld", () => {
  const t = fixture();
  t.id = "Kein-Slug";
  t.level = "D1";
  t.summary = "";
  t.paragraphs.push({ type: "h3", text: "x\ny" });
  t.glosses.bad = { pos: "Verb" };
  const errors = checkSchema(t);
  assert.ok(errors.some((e) => /^id/.test(e)));
  assert.ok(errors.some((e) => /^level/.test(e)));
  assert.ok(errors.some((e) => /^summary/.test(e)));
  assert.ok(errors.some((e) => /Absatz 2: type/.test(e)));
  assert.ok(errors.some((e) => /Absatz 2: text enthält Zeilenumbrüche/.test(e)));
  assert.ok(errors.some((e) => /Eintrag "bad"/.test(e)));
  assert.deepEqual(checkSchema(null), ["Text ist kein Objekt"]);
});

test("coverage: vollständig, Grundliste zählt", () => {
  assert.deepEqual(coverage(fixture(), base), { missing: [], extra: [], badPhrases: [] });
});

test("coverage: fehlende, überzählige und falsche Wendungen", () => {
  const t = fixture();
  delete t.glosses.fox;
  t.glosses.cat = { de: "die Katze" };
  t.glosses["quick fox"] = { de: "schneller Fuchs" };
  t.glosses["fox quick"] = { de: "falsch" };
  assert.deepEqual(coverage(t, base), { missing: ["fox"], extra: ["cat"], badPhrases: ["fox quick"] });
});

test("phraseOccurs: nur aufeinander folgende Wörter", () => {
  const paras = [{ type: "p", text: "I gave it up, then gave up." }];
  assert.equal(phraseOccurs(paras, "gave up"), true);
  assert.equal(phraseOccurs(paras, "gave it up"), true);
  assert.equal(phraseOccurs(paras, "up then"), false);
});

test("validateText: Schemafehler stoppen die Abdeckungsprüfung", () => {
  const r = validateText({ id: "x" }, base);
  assert.ok(r.errors.length > 0);
  assert.deepEqual(r.missing, []);
  assert.equal(r.wordCount, 0);
});

test("validateText: Zähler", () => {
  const r = validateText(fixture(), base);
  assert.deepEqual(r.errors, []);
  assert.equal(r.wordCount, 3);
  assert.equal(r.glossCount, 2);
});

test("chunk", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
});

test("readPassword: Umgebungsvariable, Datei, sonst Fehler", () => {
  const saved = process.env.READER_PASSWORD;
  const root = mkdtempSync(join(tmpdir(), "pw-"));
  try {
    process.env.READER_PASSWORD = "aus-env";
    assert.equal(readPassword(root), "aus-env");
    delete process.env.READER_PASSWORD;
    assert.throws(() => readPassword(root), /npm run setup/);
    writeFileSync(paths(root).passwordFile, "aus-datei\r\n");
    assert.equal(readPassword(root), "aus-datei");
  } finally {
    if (saved === undefined) delete process.env.READER_PASSWORD;
    else process.env.READER_PASSWORD = saved;
  }
});
