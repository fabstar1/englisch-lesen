import { test } from "node:test";
import assert from "node:assert/strict";
import { segment, annotate, keysOf, countWords, normalizeKey } from "../docs/tokenizer.js";

const words = (segs) => segs.filter((s) => s.type === "word").map((s) => s.key);

test("normalizeKey: Kleinschreibung, Apostrophe und Bindestriche", () => {
  assert.equal(normalizeKey("Don’t"), "don't");
  assert.equal(normalizeKey("WELL\u2011Known"), "well-known");
});

test("segment: Wörter, Leerraum, Satzzeichen", () => {
  assert.deepEqual(segment("Hello, world!"), [
    { type: "word", text: "Hello", key: "hello" },
    { type: "other", text: ", " },
    { type: "word", text: "world", key: "world" },
    { type: "other", text: "!" },
  ]);
});

test("segment: Verkettung ergibt die Eingabe", () => {
  const text = "It’s a well-known fact: 1914 wasn't 'easy'. (Really?)";
  assert.equal(segment(text).map((s) => s.text).join(""), text);
});

test("segment: Kurzformen mit geradem und typografischem Apostroph", () => {
  assert.deepEqual(words(segment("don't It’s o'clock")), ["don't", "it's", "o'clock"]);
});

test("segment: führende und nachgestellte Apostrophe gehören nicht zum Wort", () => {
  const texts = segment("'tis the boys' ball").filter((s) => s.type === "word").map((s) => s.text);
  assert.deepEqual(texts, ["tis", "the", "boys", "ball"]);
});

test("segment: Bindestrich-Wörter bleiben ein Wort", () => {
  assert.deepEqual(words(segment("twenty-one well-known")), ["twenty-one", "well-known"]);
});

test("segment: Zahlen ohne Buchstaben sind number, mit Buchstaben word", () => {
  const segs = segment("in 1914 the 42nd time");
  assert.deepEqual(segs.filter((s) => s.type === "number").map((s) => s.text), ["1914"]);
  assert.deepEqual(words(segs), ["in", "the", "42nd", "time"]);
});

test("segment: Unicode-Buchstaben", () => {
  assert.deepEqual(words(segment("a café, naïve")), ["a", "café", "naïve"]);
});

test("segment: leerer Text", () => {
  assert.deepEqual(segment(""), []);
});

test("annotate: längster Treffer zuerst, Text bleibt erhalten", () => {
  const keys = new Set(["give up", "give it up"]);
  const out = annotate(segment("I will give it up now"), (k) => keys.has(k));
  const phrase = out.find((s) => s.type === "phrase");
  assert.equal(phrase.key, "give it up");
  assert.equal(phrase.text, "give it up");
  assert.equal(phrase.parts.length, 3);
  assert.equal(out.map((s) => s.text).join(""), "I will give it up now");
});

test("annotate: keine Wendung über Satzzeichen hinweg", () => {
  const out = annotate(segment("give, up"), (k) => k === "give up");
  assert.equal(out.some((s) => s.type === "phrase"), false);
});

test("annotate: keine Überlappung, von links nach rechts", () => {
  const keys = new Set(["look up", "up to"]);
  const out = annotate(segment("look up to"), (k) => keys.has(k));
  assert.deepEqual(out.map((s) => [s.type, s.text]), [
    ["phrase", "look up"],
    ["other", " "],
    ["word", "to"],
  ]);
});

test("annotate: Wendung mit typografischem Apostroph im Text", () => {
  const out = annotate(segment("I don’t know"), (k) => k === "don't know");
  assert.equal(out.find((s) => s.type === "phrase").key, "don't know");
});

test("keysOf: sortiert und eindeutig, Strings oder Absatzobjekte", () => {
  assert.deepEqual(keysOf([{ text: "The cat. The dog!" }, "a cat"]), ["a", "cat", "dog", "the"]);
});

test("countWords: zählt nur Wortsegmente", () => {
  assert.equal(countWords(["One two 3", { text: "four" }]), 3);
});
