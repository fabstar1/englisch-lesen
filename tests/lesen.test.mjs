import { test } from "node:test";
import assert from "node:assert/strict";
import { quelleErlaubt, absatzTeile, textFehler, stimmeWaehlen } from "../docs/lesen-logik.js";

const QUELLEN = ["https://spiele.stilno.de/api/text.php"];

test("nur Adressen aus lesequellen", () => {
  assert.equal(quelleErlaubt("https://spiele.stilno.de/api/text.php?p=2&d=texte%2F001_x.json&a=1&s=x", QUELLEN), true);
  assert.equal(quelleErlaubt("https://spiele.stilno.de.evil.com/api/text.php?p=2", QUELLEN), false);
  assert.equal(quelleErlaubt("https://spiele.stilno.de/api/text.phpx?p=2", QUELLEN), false);
  assert.equal(quelleErlaubt("http://spiele.stilno.de/api/text.php?p=2", ["http://spiele.stilno.de/api/text.php"]), false);
  assert.equal(quelleErlaubt("http://localhost:8080/api/text.php?p=2", ["http://localhost:8080/api/text.php"]), true);
  assert.equal(quelleErlaubt("javascript:alert(1)", QUELLEN), false);
  assert.equal(quelleErlaubt("", QUELLEN), false);
  assert.equal(quelleErlaubt(null, QUELLEN), false);
  assert.equal(quelleErlaubt("https://spiele.stilno.de/api/text.php?p=2", undefined), false, "ohne lesequellen ist nichts erlaubt");
});

test("Absatz in Teile mit Hervorhebung", () => {
  const glosses = { "school bag": { de: "die Schultasche" }, ruler: { de: "das Lineal" } };
  const teile = absatzTeile("My School bag and a ruler.", (k) => Object.hasOwn(glosses, k), new Set(["school bag"]));
  const woerter = teile.filter((t) => t.type === "word" || t.type === "phrase");
  const tasche = woerter.find((t) => t.key === "school bag");
  assert.equal(tasche.type, "phrase");
  assert.equal(tasche.text, "School bag");
  assert.equal(tasche.markiert, true);
  assert.equal(woerter.find((t) => t.key === "ruler").markiert, false);
  assert.equal(woerter.find((t) => t.key === "my").markiert, false);
  assert.equal(teile.map((t) => t.text).join(""), "My School bag and a ruler.");
});

test("Textform wird geprüft", () => {
  const gut = { title: "My day", level: "A1", paragraphs: [{ type: "p", text: "Hi." }], glosses: {}, hervorheben: [] };
  assert.equal(textFehler(gut), null);
  assert.ok(textFehler(null));
  assert.ok(textFehler({ ...gut, paragraphs: "x" }));
  assert.ok(textFehler({ ...gut, paragraphs: [{ type: "p", text: 3 }] }));
  assert.ok(textFehler({ ...gut, title: 5 }));
  assert.equal(textFehler({ ...gut, hervorheben: undefined }), null, "hervorheben ist optional");
});

test("englische Stimme: en-GB vor en-US, sonst keine", () => {
  const s = (lang) => ({ lang, name: lang });
  assert.equal(stimmeWaehlen([s("de-DE"), s("en-US"), s("en-GB")]).lang, "en-GB");
  assert.equal(stimmeWaehlen([s("de-DE"), s("en_US")]).lang, "en_US");
  assert.equal(stimmeWaehlen([s("de-DE")]), null);
  assert.equal(stimmeWaehlen([]), null);
});
