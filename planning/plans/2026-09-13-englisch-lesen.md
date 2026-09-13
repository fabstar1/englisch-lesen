# Englisch-Lesen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein statischer Englisch-Reader auf GitHub Pages: Wort antippen zeigt die deutsche Übersetzung im Kontext; Texte werden in Claude Code per Skill `/add-text` angelegt und passwortverschlüsselt veröffentlicht.

**Architecture:** `docs/` ist die veröffentlichte Website (HTML, CSS, ES-Module ohne Build). `library/` hält Klartexte (gitignored), `tools/` sind Node-22-Skripte ohne Abhängigkeiten, die Wortlisten erzeugen, Übersetzungen mergen, prüfen und nach `docs/texts/` verschlüsseln. Tokenizer und Krypto liegen als ES-Module in `docs/` und werden von Browser und Node identisch genutzt.

**Tech Stack:** HTML/CSS/JavaScript (ES-Module), Web Crypto API (PBKDF2 + AES-256-GCM), Node 22 (`node --test`, `node:zlib`, `node:http`), git, GitHub Pages.

**Spec:** `planning/specs/2026-09-13-englisch-lesen-design.md` (alle Abschnittsnummern unten beziehen sich darauf).

**Sprache:** Prosa, Kommentare, Meldungen und Commit-Nachrichten auf Deutsch. Bezeichner im Code auf Englisch. Jede Commit-Nachricht endet mit der Zeile `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

**Arbeitsweise:** Alle Befehle aus dem Projektstamm `C:\MyDrive\KI\Englisch-Lesen` ausführen. Tests mit `npm test` (Node-Test-Runner). Kein `npm install`, es gibt keine Abhängigkeiten.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `package.json` | `"type": "module"`, npm-Skripte |
| `.gitattributes` | LF-Zeilenenden, Binärdateien |
| `docs/tokenizer.js` | `segment`, `annotate`, `keysOf`, `countWords`, `normalizeKey` (Browser + Node) |
| `docs/crypto.js` | `deriveKey`, `encryptJson`, `decryptJson`, `exportKey`, `importKey`, Base64-Helfer (Browser + Node) |
| `docs/base-words.json` | Grundliste häufiger Funktionswörter |
| `docs/index.html` | App-Gerüst, Meta-Tags, lädt `app.js` |
| `docs/styles.css` | Layout, Typografie, Hell/Dunkel, Popup |
| `docs/app.js` | Zustand, Passwort-Ansicht, Bibliothek, Leseansicht, Popup |
| `docs/manifest.webmanifest`, `docs/icons/` | Home-Bildschirm |
| `docs/fonts/` | Literata (optional, per Skript geholt) |
| `docs/texts/` | `salt.json`, verschlüsselter `index.json`, verschlüsselte Texte |
| `tools/lib.mjs` | gemeinsame Helfer: Pfade, JSON lesen/schreiben, Schema- und Abdeckungsprüfung, Passwortquelle |
| `tools/words.mjs` | Wortliste ohne Eintrag ausgeben |
| `tools/merge.mjs` | Teile aus `library/.parts/<id>/` mergen |
| `tools/validate.mjs` | Prüfbericht, Exit-Code |
| `tools/encrypt.mjs` | Verschlüsseln, Index bauen, Verwaiste entfernen |
| `tools/setup.mjs` | Passwort setzen, Salt anlegen (interaktiv) |
| `tools/serve.mjs` | lokaler Server |
| `tools/make-icons.mjs` | PNG-Icons ohne Abhängigkeiten |
| `tools/fetch-fonts.mjs` | Literata von Google Fonts holen, `fonts/literata.css` schreiben |
| `tools/screenshot.mjs` | Entwicklungshilfe: Screenshots per Chrome/Edge headless |
| `tests/*.test.mjs` | Tests je Modul |
| `.claude/skills/add-text/SKILL.md` | Skill `/add-text` |
| `README.md` | Bedienung |

---

### Task 1: Projektgerüst

**Files:**
- Create: `package.json`
- Create: `.gitattributes`
- Create: `tests/smoke.test.mjs`

- [ ] **Step 1: package.json anlegen**

```json
{
  "name": "englisch-lesen",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Englisch lernen durch Lesen: Reader mit Wort-Popups",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "node --test \"tests/**/*.test.mjs\"",
    "setup": "node tools/setup.mjs",
    "words": "node tools/words.mjs",
    "merge": "node tools/merge.mjs",
    "validate": "node tools/validate.mjs",
    "encrypt": "node tools/encrypt.mjs",
    "serve": "node tools/serve.mjs",
    "icons": "node tools/make-icons.mjs",
    "fonts": "node tools/fetch-fonts.mjs",
    "publish": "node tools/encrypt.mjs && git add docs/texts && git commit -m \"Texte aktualisiert\" && git push"
  }
}
```

- [ ] **Step 2: .gitattributes anlegen**

```
* text=auto eol=lf
*.png binary
*.woff2 binary
```

- [ ] **Step 3: Smoke-Test schreiben**

`tests/smoke.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("Node-Version ist 22 oder neuer", () => {
  const major = Number(process.versions.node.split(".")[0]);
  assert.ok(major >= 22, `Node ${process.versions.node} ist zu alt`);
});
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test`
Expected: `# pass 1`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add package.json .gitattributes tests/smoke.test.mjs
git commit -m "Projektgerüst mit npm-Skripten und Smoke-Test" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Tokenizer

**Files:**
- Create: `docs/tokenizer.js`
- Test: `tests/tokenizer.test.mjs`

Regeln aus Spec Abschnitt 5: Wort = Buchstaben/Ziffern mit inneren Apostrophen oder Bindestrichen; Token ohne Buchstaben ist `number`; Schlüssel = Kleinschreibung mit normalisierten Apostrophen und Bindestrichen; Wendungen über `annotate` (längster Treffer zuerst, nur über reine Leerraum-Lücken).

- [ ] **Step 1: Tests schreiben**

`tests/tokenizer.test.mjs`:

```js
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
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/tokenizer.test.mjs`
Expected: Fehler `Cannot find module` für `docs/tokenizer.js`

- [ ] **Step 3: Tokenizer implementieren**

`docs/tokenizer.js`:

```js
// Tokenizer, geteilt zwischen Browser (docs/app.js) und Node (tools/).
// Ein Wort: Buchstaben/Ziffern, optional mit inneren Apostrophen oder Bindestrichen.
const WORD_RE = /[\p{L}\p{N}]+(?:['’‘\-\u2010\u2011][\p{L}\p{N}]+)*/gu;
const LETTER_RE = /\p{L}/u;

/** Schlüssel für das Wörterbuch: Kleinschreibung, gerade Apostrophe, einfacher Bindestrich. */
export function normalizeKey(text) {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[\u2010\u2011]/g, "-");
}

/** Zerlegt einen Absatz lückenlos in Segmente vom Typ word, number oder other. */
export function segment(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(WORD_RE)) {
    if (m.index > last) out.push({ type: "other", text: text.slice(last, m.index) });
    const t = m[0];
    if (LETTER_RE.test(t)) out.push({ type: "word", text: t, key: normalizeKey(t) });
    else out.push({ type: "number", text: t });
    last = m.index + t.length;
  }
  if (last < text.length) out.push({ type: "other", text: text.slice(last) });
  return out;
}

/** n aufeinander folgende Wortsegmente ab i, getrennt durch je ein reines Leerraum-Segment. */
function wordRun(segments, i, n) {
  const words = [];
  let j = i;
  for (;;) {
    const s = segments[j];
    if (!s || s.type !== "word") return null;
    words.push(s);
    j++;
    if (words.length === n) return { words, end: j };
    const gap = segments[j];
    if (!gap || gap.type !== "other" || !/^\s+$/.test(gap.text)) return null;
    j++;
  }
}

/**
 * Fasst Wortfolgen zu Wendungen zusammen, wenn hasKey(zusammengesetzter Schlüssel) wahr ist.
 * Längster Treffer zuerst, von links nach rechts, keine Überlappung.
 */
export function annotate(segments, hasKey, maxWords = 4) {
  const out = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (seg.type !== "word") {
      out.push(seg);
      i++;
      continue;
    }
    let hit = null;
    for (let n = maxWords; n >= 2 && !hit; n--) {
      const run = wordRun(segments, i, n);
      if (!run) continue;
      const key = run.words.map((w) => w.key).join(" ");
      if (hasKey(key)) hit = { run, key };
    }
    if (!hit) {
      out.push(seg);
      i++;
      continue;
    }
    out.push({
      type: "phrase",
      text: segments.slice(i, hit.run.end).map((s) => s.text).join(""),
      key: hit.key,
      parts: hit.run.words,
    });
    i = hit.run.end;
  }
  return out;
}

const textOf = (p) => (typeof p === "string" ? p : p.text);

/** Alle Wortschlüssel eines Textes, sortiert und eindeutig. */
export function keysOf(paragraphs) {
  const keys = new Set();
  for (const p of paragraphs) for (const s of segment(textOf(p))) if (s.type === "word") keys.add(s.key);
  return [...keys].sort();
}

/** Anzahl der Wortsegmente eines Textes. */
export function countWords(paragraphs) {
  let n = 0;
  for (const p of paragraphs) for (const s of segment(textOf(p))) if (s.type === "word") n++;
  return n;
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/tokenizer.test.mjs`
Expected: `# pass 15`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add docs/tokenizer.js tests/tokenizer.test.mjs
git commit -m "Tokenizer für Wörter, Zahlen und Wendungen" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 3: Krypto-Modul

**Files:**
- Create: `docs/crypto.js`
- Test: `tests/crypto.test.mjs`

Spec Abschnitt 8. Läuft im Browser und in Node 22 über `globalThis.crypto.subtle`. Tests nutzen wenige PBKDF2-Runden, damit sie schnell sind; der Standard bleibt 310.000.

- [ ] **Step 1: Tests schreiben**

`tests/crypto.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveKey, encryptJson, decryptJson, exportKey, importKey,
  toBase64, fromBase64, randomBytes, DEFAULT_ITERATIONS,
} from "../docs/crypto.js";

const SALT = toBase64(new Uint8Array(16)); // fester Salt für Tests
const FAST = 1000; // wenige Runden, damit die Tests schnell laufen

test("Standard sind 310.000 Runden", () => {
  assert.equal(DEFAULT_ITERATIONS, 310000);
});

test("Base64 hin und zurück, auch für große Puffer", () => {
  const bytes = randomBytes(100000);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
});

test("deriveKey ist deterministisch für gleiches Passwort und Salt", async () => {
  const a = await exportKey(await deriveKey("geheim", SALT, FAST));
  const b = await exportKey(await deriveKey("geheim", SALT, FAST));
  const c = await exportKey(await deriveKey("anders", SALT, FAST));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("encryptJson/decryptJson: Objekt kommt unverändert zurück", async () => {
  const key = await deriveKey("geheim", SALT, FAST);
  const obj = { title: "Über Äpfel", n: 3, list: ["a", "ß"], nested: { ok: true } };
  const container = await encryptJson(key, obj);
  assert.deepEqual(await decryptJson(key, container), obj);
});

test("Container hat Version 1, 12-Byte-IV und Daten", async () => {
  const key = await deriveKey("geheim", SALT, FAST);
  const c = await encryptJson(key, { x: 1 });
  assert.deepEqual(Object.keys(c).sort(), ["data", "iv", "v"]);
  assert.equal(c.v, 1);
  assert.equal(fromBase64(c.iv).length, 12);
  assert.ok(fromBase64(c.data).length > 16, "Chiffrat enthält mindestens den GCM-Tag");
});

test("Zwei Verschlüsselungen desselben Objekts unterscheiden sich (zufällige IV)", async () => {
  const key = await deriveKey("geheim", SALT, FAST);
  const a = await encryptJson(key, { x: 1 });
  const b = await encryptJson(key, { x: 1 });
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.data, b.data);
});

test("Falscher Schlüssel wirft verständlichen Fehler", async () => {
  const good = await deriveKey("geheim", SALT, FAST);
  const bad = await deriveKey("falsch", SALT, FAST);
  const c = await encryptJson(good, { x: 1 });
  await assert.rejects(decryptJson(bad, c), /Falsches Passwort/);
});

test("Unbekannte Version wird abgelehnt", async () => {
  const key = await deriveKey("geheim", SALT, FAST);
  await assert.rejects(decryptJson(key, { v: 2, iv: "", data: "" }), /Dateiformat/);
});

test("exportKey/importKey: importierter Schlüssel entschlüsselt", async () => {
  const key = await deriveKey("geheim", SALT, FAST);
  const c = await encryptJson(key, { ok: true });
  const again = await importKey(await exportKey(key));
  assert.deepEqual(await decryptJson(again, c), { ok: true });
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/crypto.test.mjs`
Expected: Fehler `Cannot find module` für `docs/crypto.js`

- [ ] **Step 3: Modul implementieren**

`docs/crypto.js`:

```js
// Verschlüsselung, geteilt zwischen Browser (docs/app.js) und Node (tools/encrypt.mjs).
// PBKDF2-SHA256 leitet aus dem Passwort einen AES-256-GCM-Schlüssel ab.
const subtle = globalThis.crypto.subtle;

export const DEFAULT_ITERATIONS = 310000;

export function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n) {
  // getRandomValues füllt laut Web-Crypto-Spezifikation höchstens 65536 Byte je Aufruf.
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) globalThis.crypto.getRandomValues(out.subarray(i, Math.min(i + 65536, n)));
  return out;
}

/** Leitet aus Passwort und Salt (Base64) einen exportierbaren AES-GCM-Schlüssel ab. */
export async function deriveKey(password, saltB64, iterations = DEFAULT_ITERATIONS) {
  const material = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltB64), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Verschlüsselt ein JSON-fähiges Objekt in den Container { v, iv, data }. */
export async function encryptJson(key, obj) {
  const iv = randomBytes(12);
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { v: 1, iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) };
}

/** Entschlüsselt einen Container. Wirft bei falschem Schlüssel oder beschädigten Daten. */
export async function decryptJson(key, container) {
  if (!container || container.v !== 1) throw new Error("Unbekanntes Dateiformat");
  let plain;
  try {
    plain = await subtle.decrypt({ name: "AES-GCM", iv: fromBase64(container.iv) }, key, fromBase64(container.data));
  } catch {
    throw new Error("Falsches Passwort oder beschädigte Datei");
  }
  return JSON.parse(new TextDecoder().decode(plain));
}

export async function exportKey(key) {
  return toBase64(new Uint8Array(await subtle.exportKey("raw", key)));
}

export async function importKey(b64) {
  return subtle.importKey("raw", fromBase64(b64), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/crypto.test.mjs`
Expected: `# pass 9`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add docs/crypto.js tests/crypto.test.mjs
git commit -m "Krypto-Modul: PBKDF2 und AES-GCM für Browser und Node" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Grundliste der Funktionswörter

**Files:**
- Create: `docs/base-words.json`
- Test: `tests/base-words.test.mjs`

Spec Abschnitt 4.2. Schlüssel müssen normalisiert sein (Kleinschreibung, gerader Apostroph), Werte haben `de` und `pos`, optional `note`.

- [ ] **Step 1: Test schreiben**

`tests/base-words.test.mjs`:

```js
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/base-words.test.mjs`
Expected: Fehler `ENOENT` für `docs/base-words.json`

- [ ] **Step 3: Grundliste schreiben**

`docs/base-words.json`:

```json
{
  "the": { "de": "der / die / das", "pos": "Artikel" },
  "a": { "de": "ein / eine", "pos": "Artikel" },
  "an": { "de": "ein / eine", "pos": "Artikel", "note": "Vor Vokallaut." },

  "i": { "de": "ich", "pos": "Pronomen" },
  "you": { "de": "du / ihr / Sie / dich / euch", "pos": "Pronomen" },
  "he": { "de": "er", "pos": "Pronomen" },
  "she": { "de": "sie (Einzahl)", "pos": "Pronomen" },
  "it": { "de": "es", "pos": "Pronomen" },
  "we": { "de": "wir", "pos": "Pronomen" },
  "they": { "de": "sie (Mehrzahl)", "pos": "Pronomen" },
  "me": { "de": "mich / mir", "pos": "Pronomen" },
  "him": { "de": "ihn / ihm", "pos": "Pronomen" },
  "her": { "de": "sie / ihr / ihre", "pos": "Pronomen", "note": "Objektform von she oder besitzanzeigend." },
  "us": { "de": "uns", "pos": "Pronomen" },
  "them": { "de": "sie / ihnen", "pos": "Pronomen" },
  "my": { "de": "mein / meine", "pos": "Pronomen" },
  "your": { "de": "dein / euer / Ihr", "pos": "Pronomen" },
  "his": { "de": "sein / seine", "pos": "Pronomen" },
  "its": { "de": "sein / seine / ihr (von it)", "pos": "Pronomen" },
  "our": { "de": "unser / unsere", "pos": "Pronomen" },
  "their": { "de": "ihr / ihre (Mehrzahl)", "pos": "Pronomen" },
  "mine": { "de": "meiner / meine / meins", "pos": "Pronomen" },
  "yours": { "de": "deiner / eurer / Ihrer", "pos": "Pronomen" },
  "hers": { "de": "ihrer / ihre / ihres", "pos": "Pronomen" },
  "ours": { "de": "unserer / unsere / unseres", "pos": "Pronomen" },
  "theirs": { "de": "ihrer / ihre / ihres (Mehrzahl)", "pos": "Pronomen" },
  "myself": { "de": "mich selbst / ich selbst", "pos": "Pronomen" },
  "yourself": { "de": "dich selbst / Sie selbst", "pos": "Pronomen" },
  "himself": { "de": "sich selbst / er selbst", "pos": "Pronomen" },
  "herself": { "de": "sich selbst / sie selbst", "pos": "Pronomen" },
  "itself": { "de": "sich selbst / es selbst", "pos": "Pronomen" },
  "ourselves": { "de": "uns selbst", "pos": "Pronomen" },
  "yourselves": { "de": "euch selbst", "pos": "Pronomen" },
  "themselves": { "de": "sich selbst (Mehrzahl)", "pos": "Pronomen" },
  "this": { "de": "dieser / diese / dieses / das hier", "pos": "Pronomen" },
  "that": { "de": "dass / jener, jene, jenes / der, die, das", "pos": "Pronomen", "note": "Als Konjunktion 'dass', als Relativpronomen 'der/die/das', als Demonstrativ 'jener'." },
  "these": { "de": "diese (Mehrzahl)", "pos": "Pronomen" },
  "those": { "de": "jene / diejenigen", "pos": "Pronomen" },
  "who": { "de": "wer / der, die, das (Person)", "pos": "Pronomen" },
  "whom": { "de": "wen / wem", "pos": "Pronomen", "note": "Objektform von who, eher förmlich." },
  "whose": { "de": "wessen / dessen / deren", "pos": "Pronomen" },
  "which": { "de": "welcher / welche / welches / der, die, das", "pos": "Pronomen" },
  "what": { "de": "was / welcher", "pos": "Pronomen" },
  "someone": { "de": "jemand", "pos": "Pronomen" },
  "somebody": { "de": "jemand", "pos": "Pronomen" },
  "something": { "de": "etwas", "pos": "Pronomen" },
  "anyone": { "de": "irgendjemand / jeder", "pos": "Pronomen" },
  "anybody": { "de": "irgendjemand / jeder", "pos": "Pronomen" },
  "anything": { "de": "irgendetwas / alles", "pos": "Pronomen" },
  "everyone": { "de": "jeder / alle", "pos": "Pronomen" },
  "everybody": { "de": "jeder / alle", "pos": "Pronomen" },
  "everything": { "de": "alles", "pos": "Pronomen" },
  "nobody": { "de": "niemand", "pos": "Pronomen" },
  "nothing": { "de": "nichts", "pos": "Pronomen" },
  "one": { "de": "eins / man / einer", "pos": "Pronomen", "note": "Zahlwort oder unbestimmtes Pronomen ('one never knows')." },
  "ones": { "de": "welche / die (Ersatz für ein Substantiv)", "pos": "Pronomen" },

  "of": { "de": "von / aus (Genitiv)", "pos": "Präposition" },
  "in": { "de": "in / im", "pos": "Präposition" },
  "on": { "de": "auf / an / über", "pos": "Präposition" },
  "at": { "de": "an / bei / um (Uhrzeit)", "pos": "Präposition" },
  "to": { "de": "zu / nach / um zu", "pos": "Präposition", "note": "Auch Infinitiv-Marker: to go = gehen." },
  "for": { "de": "für / seit / denn", "pos": "Präposition" },
  "with": { "de": "mit", "pos": "Präposition" },
  "by": { "de": "von / bei / durch / bis", "pos": "Präposition" },
  "from": { "de": "von / aus", "pos": "Präposition" },
  "about": { "de": "über / etwa / ungefähr", "pos": "Präposition" },
  "into": { "de": "in ... hinein", "pos": "Präposition" },
  "onto": { "de": "auf ... hinauf", "pos": "Präposition" },
  "over": { "de": "über / vorbei", "pos": "Präposition" },
  "under": { "de": "unter", "pos": "Präposition" },
  "between": { "de": "zwischen", "pos": "Präposition" },
  "among": { "de": "unter / zwischen (mehreren)", "pos": "Präposition" },
  "through": { "de": "durch", "pos": "Präposition" },
  "during": { "de": "während", "pos": "Präposition" },
  "before": { "de": "vor / bevor", "pos": "Präposition" },
  "after": { "de": "nach / nachdem", "pos": "Präposition" },
  "above": { "de": "über / oberhalb", "pos": "Präposition" },
  "below": { "de": "unter / unterhalb", "pos": "Präposition" },
  "across": { "de": "über ... hinweg / quer durch", "pos": "Präposition" },
  "against": { "de": "gegen", "pos": "Präposition" },
  "along": { "de": "entlang", "pos": "Präposition" },
  "around": { "de": "um ... herum / ungefähr", "pos": "Präposition" },
  "behind": { "de": "hinter", "pos": "Präposition" },
  "beside": { "de": "neben", "pos": "Präposition" },
  "beyond": { "de": "jenseits / über ... hinaus", "pos": "Präposition" },
  "near": { "de": "nahe / in der Nähe von", "pos": "Präposition" },
  "off": { "de": "weg / ab / aus", "pos": "Präposition" },
  "out": { "de": "hinaus / draußen / aus", "pos": "Präposition" },
  "up": { "de": "hinauf / oben / auf", "pos": "Präposition" },
  "down": { "de": "hinunter / unten", "pos": "Präposition" },
  "without": { "de": "ohne", "pos": "Präposition" },
  "within": { "de": "innerhalb", "pos": "Präposition" },
  "until": { "de": "bis", "pos": "Präposition" },
  "till": { "de": "bis", "pos": "Präposition" },
  "since": { "de": "seit / da, weil", "pos": "Präposition" },
  "towards": { "de": "in Richtung / gegenüber", "pos": "Präposition" },
  "toward": { "de": "in Richtung / gegenüber", "pos": "Präposition" },
  "upon": { "de": "auf / bei", "pos": "Präposition", "note": "Förmlicher als on." },
  "per": { "de": "pro / je", "pos": "Präposition" },
  "via": { "de": "über / mittels", "pos": "Präposition" },
  "than": { "de": "als (beim Vergleich)", "pos": "Konjunktion" },
  "as": { "de": "als / wie / während", "pos": "Konjunktion" },
  "like": { "de": "wie / mögen", "pos": "Präposition", "note": "Als Verb: mögen, gern haben." },
  "despite": { "de": "trotz", "pos": "Präposition" },
  "except": { "de": "außer", "pos": "Präposition" },
  "inside": { "de": "innen / innerhalb", "pos": "Präposition" },
  "outside": { "de": "außen / außerhalb", "pos": "Präposition" },
  "throughout": { "de": "überall in / während der ganzen", "pos": "Präposition" },

  "and": { "de": "und", "pos": "Konjunktion" },
  "or": { "de": "oder", "pos": "Konjunktion" },
  "but": { "de": "aber / sondern", "pos": "Konjunktion" },
  "nor": { "de": "noch (weder ... noch)", "pos": "Konjunktion" },
  "so": { "de": "so / also / deshalb", "pos": "Konjunktion" },
  "yet": { "de": "noch / dennoch", "pos": "Konjunktion" },
  "because": { "de": "weil", "pos": "Konjunktion" },
  "although": { "de": "obwohl", "pos": "Konjunktion" },
  "though": { "de": "obwohl / allerdings", "pos": "Konjunktion" },
  "if": { "de": "wenn / falls / ob", "pos": "Konjunktion" },
  "unless": { "de": "es sei denn / wenn nicht", "pos": "Konjunktion" },
  "while": { "de": "während", "pos": "Konjunktion" },
  "whereas": { "de": "wohingegen", "pos": "Konjunktion" },
  "whether": { "de": "ob", "pos": "Konjunktion" },
  "either": { "de": "entweder / auch (nicht)", "pos": "Konjunktion" },
  "neither": { "de": "weder / auch nicht", "pos": "Konjunktion" },
  "both": { "de": "beide / sowohl", "pos": "Pronomen" },
  "once": { "de": "einmal / sobald", "pos": "Konjunktion" },
  "when": { "de": "wann / als / wenn", "pos": "Konjunktion" },
  "whenever": { "de": "wann immer / jedes Mal wenn", "pos": "Konjunktion" },
  "where": { "de": "wo / wohin", "pos": "Adverb" },
  "wherever": { "de": "wo auch immer", "pos": "Konjunktion" },
  "why": { "de": "warum", "pos": "Adverb" },
  "how": { "de": "wie", "pos": "Adverb" },
  "however": { "de": "jedoch / wie auch immer", "pos": "Adverb" },
  "therefore": { "de": "deshalb / daher", "pos": "Adverb" },
  "thus": { "de": "so / folglich", "pos": "Adverb" },

  "be": { "de": "sein", "pos": "Verb" },
  "am": { "de": "bin", "pos": "Verb" },
  "is": { "de": "ist", "pos": "Verb" },
  "are": { "de": "sind / bist / seid", "pos": "Verb" },
  "was": { "de": "war", "pos": "Verb" },
  "were": { "de": "waren / warst / wart", "pos": "Verb" },
  "been": { "de": "gewesen", "pos": "Verb" },
  "being": { "de": "seiend / das Wesen", "pos": "Verb" },
  "have": { "de": "haben", "pos": "Verb" },
  "has": { "de": "hat", "pos": "Verb" },
  "had": { "de": "hatte / gehabt", "pos": "Verb" },
  "having": { "de": "habend", "pos": "Verb" },
  "do": { "de": "tun / machen (Hilfsverb)", "pos": "Verb" },
  "does": { "de": "tut / macht (Hilfsverb)", "pos": "Verb" },
  "did": { "de": "tat / machte (Hilfsverb)", "pos": "Verb" },
  "doing": { "de": "tuend / machend", "pos": "Verb" },
  "done": { "de": "getan / gemacht / fertig", "pos": "Verb" },
  "will": { "de": "werden (Zukunft)", "pos": "Verb", "note": "Als Substantiv: der Wille, das Testament." },
  "would": { "de": "würde / wollte", "pos": "Verb" },
  "shall": { "de": "werden / sollen", "pos": "Verb", "note": "Förmlich oder in Fragen: shall we?" },
  "should": { "de": "sollte", "pos": "Verb" },
  "can": { "de": "können", "pos": "Verb", "note": "Als Substantiv: die Dose." },
  "could": { "de": "konnte / könnte", "pos": "Verb" },
  "may": { "de": "dürfen / mögen / vielleicht", "pos": "Verb" },
  "might": { "de": "könnte / dürfte (vielleicht)", "pos": "Verb" },
  "must": { "de": "müssen", "pos": "Verb" },
  "ought": { "de": "sollte (ought to)", "pos": "Verb" },

  "don't": { "de": "nicht (do not)", "pos": "Verb" },
  "doesn't": { "de": "nicht (does not)", "pos": "Verb" },
  "didn't": { "de": "nicht (did not)", "pos": "Verb" },
  "isn't": { "de": "ist nicht", "pos": "Verb" },
  "aren't": { "de": "sind nicht", "pos": "Verb" },
  "wasn't": { "de": "war nicht", "pos": "Verb" },
  "weren't": { "de": "waren nicht", "pos": "Verb" },
  "hasn't": { "de": "hat nicht", "pos": "Verb" },
  "haven't": { "de": "haben nicht", "pos": "Verb" },
  "hadn't": { "de": "hatte nicht", "pos": "Verb" },
  "can't": { "de": "kann nicht", "pos": "Verb" },
  "cannot": { "de": "kann nicht", "pos": "Verb" },
  "couldn't": { "de": "konnte nicht", "pos": "Verb" },
  "won't": { "de": "wird nicht (will not)", "pos": "Verb" },
  "wouldn't": { "de": "würde nicht", "pos": "Verb" },
  "shouldn't": { "de": "sollte nicht", "pos": "Verb" },
  "mustn't": { "de": "darf nicht", "pos": "Verb" },
  "i'm": { "de": "ich bin", "pos": "Verb" },
  "i've": { "de": "ich habe", "pos": "Verb" },
  "i'll": { "de": "ich werde", "pos": "Verb" },
  "i'd": { "de": "ich würde / ich hatte", "pos": "Verb" },
  "you're": { "de": "du bist / ihr seid / Sie sind", "pos": "Verb" },
  "you've": { "de": "du hast / ihr habt", "pos": "Verb" },
  "you'll": { "de": "du wirst / ihr werdet", "pos": "Verb" },
  "you'd": { "de": "du würdest / du hattest", "pos": "Verb" },
  "he's": { "de": "er ist / er hat", "pos": "Verb" },
  "he'll": { "de": "er wird", "pos": "Verb" },
  "he'd": { "de": "er würde / er hatte", "pos": "Verb" },
  "she's": { "de": "sie ist / sie hat", "pos": "Verb" },
  "she'll": { "de": "sie wird", "pos": "Verb" },
  "she'd": { "de": "sie würde / sie hatte", "pos": "Verb" },
  "it's": { "de": "es ist / es hat", "pos": "Verb" },
  "it'll": { "de": "es wird", "pos": "Verb" },
  "it'd": { "de": "es würde / es hatte", "pos": "Verb" },
  "we're": { "de": "wir sind", "pos": "Verb" },
  "we've": { "de": "wir haben", "pos": "Verb" },
  "we'll": { "de": "wir werden", "pos": "Verb" },
  "we'd": { "de": "wir würden / wir hatten", "pos": "Verb" },
  "they're": { "de": "sie sind", "pos": "Verb" },
  "they've": { "de": "sie haben", "pos": "Verb" },
  "they'll": { "de": "sie werden", "pos": "Verb" },
  "they'd": { "de": "sie würden / sie hatten", "pos": "Verb" },
  "that's": { "de": "das ist", "pos": "Verb" },
  "there's": { "de": "es gibt / da ist", "pos": "Verb" },
  "here's": { "de": "hier ist", "pos": "Verb" },
  "what's": { "de": "was ist", "pos": "Verb" },
  "who's": { "de": "wer ist", "pos": "Verb" },
  "where's": { "de": "wo ist", "pos": "Verb" },
  "how's": { "de": "wie ist / wie geht", "pos": "Verb" },
  "let's": { "de": "lass uns / lasst uns", "pos": "Verb" },
  "there'd": { "de": "es würde / es hätte (there would)", "pos": "Verb" },
  "there'll": { "de": "es wird (there will)", "pos": "Verb" },

  "not": { "de": "nicht", "pos": "Adverb" },
  "no": { "de": "nein / kein", "pos": "Adverb" },
  "yes": { "de": "ja", "pos": "Adverb" },
  "very": { "de": "sehr", "pos": "Adverb" },
  "too": { "de": "auch / zu (sehr)", "pos": "Adverb" },
  "also": { "de": "auch / außerdem", "pos": "Adverb" },
  "just": { "de": "gerade / nur / genau", "pos": "Adverb" },
  "only": { "de": "nur / einzig", "pos": "Adverb" },
  "then": { "de": "dann / damals", "pos": "Adverb" },
  "now": { "de": "jetzt", "pos": "Adverb" },
  "here": { "de": "hier", "pos": "Adverb" },
  "there": { "de": "dort / da", "pos": "Adverb", "note": "there is / there are = es gibt." },
  "again": { "de": "wieder / noch einmal", "pos": "Adverb" },
  "always": { "de": "immer", "pos": "Adverb" },
  "never": { "de": "nie / niemals", "pos": "Adverb" },
  "often": { "de": "oft", "pos": "Adverb" },
  "sometimes": { "de": "manchmal", "pos": "Adverb" },
  "still": { "de": "noch / immer noch / dennoch", "pos": "Adverb" },
  "already": { "de": "schon / bereits", "pos": "Adverb" },
  "even": { "de": "sogar / selbst / eben", "pos": "Adverb" },
  "ever": { "de": "je / jemals", "pos": "Adverb" },
  "almost": { "de": "fast / beinahe", "pos": "Adverb" },
  "quite": { "de": "ziemlich / ganz", "pos": "Adverb" },
  "rather": { "de": "eher / ziemlich / lieber", "pos": "Adverb" },
  "really": { "de": "wirklich", "pos": "Adverb" },
  "perhaps": { "de": "vielleicht", "pos": "Adverb" },
  "maybe": { "de": "vielleicht", "pos": "Adverb" },
  "well": { "de": "gut / nun ja", "pos": "Adverb", "note": "Als Substantiv: der Brunnen." },
  "much": { "de": "viel / sehr", "pos": "Adverb" },
  "more": { "de": "mehr", "pos": "Adverb" },
  "most": { "de": "am meisten / die meisten / sehr", "pos": "Adverb" },
  "less": { "de": "weniger", "pos": "Adverb" },
  "least": { "de": "am wenigsten", "pos": "Adverb" },
  "enough": { "de": "genug", "pos": "Adverb" },
  "away": { "de": "weg / fort / entfernt", "pos": "Adverb" },
  "back": { "de": "zurück / hinten", "pos": "Adverb", "note": "Als Substantiv: der Rücken." },
  "indeed": { "de": "in der Tat / tatsächlich", "pos": "Adverb" },
  "instead": { "de": "stattdessen", "pos": "Adverb" },
  "later": { "de": "später", "pos": "Adverb" },
  "soon": { "de": "bald", "pos": "Adverb" },
  "today": { "de": "heute", "pos": "Adverb" },
  "tomorrow": { "de": "morgen", "pos": "Adverb" },
  "yesterday": { "de": "gestern", "pos": "Adverb" },
  "tonight": { "de": "heute Abend / heute Nacht", "pos": "Adverb" },
  "ago": { "de": "vor (zeitlich): two years ago", "pos": "Adverb" },
  "else": { "de": "sonst / anders", "pos": "Adverb" },
  "twice": { "de": "zweimal", "pos": "Adverb" },
  "together": { "de": "zusammen", "pos": "Adverb" },
  "anyway": { "de": "sowieso / jedenfalls", "pos": "Adverb" },
  "quickly": { "de": "schnell", "pos": "Adverb" },
  "slowly": { "de": "langsam", "pos": "Adverb" },
  "suddenly": { "de": "plötzlich", "pos": "Adverb" },

  "some": { "de": "einige / etwas / manche", "pos": "Pronomen" },
  "any": { "de": "irgendein / jeder / etwas", "pos": "Pronomen" },
  "each": { "de": "jeder / jede / jedes (einzeln)", "pos": "Pronomen" },
  "every": { "de": "jeder / jede / jedes", "pos": "Pronomen" },
  "all": { "de": "alle / alles / ganz", "pos": "Pronomen" },
  "few": { "de": "wenige", "pos": "Pronomen", "note": "a few = ein paar." },
  "many": { "de": "viele", "pos": "Pronomen" },
  "several": { "de": "mehrere", "pos": "Pronomen" },
  "other": { "de": "andere / anderer", "pos": "Pronomen" },
  "others": { "de": "andere (Mehrzahl)", "pos": "Pronomen" },
  "another": { "de": "ein anderer / noch ein", "pos": "Pronomen" },
  "such": { "de": "solch / so ein", "pos": "Pronomen" },
  "own": { "de": "eigen", "pos": "Adjektiv", "note": "Als Verb: besitzen." },
  "same": { "de": "derselbe / gleich", "pos": "Adjektiv" },
  "none": { "de": "keiner / keine / nichts", "pos": "Pronomen" },
  "little": { "de": "klein / wenig", "pos": "Adjektiv", "note": "a little = ein bisschen." },
  "lot": { "de": "viel (a lot of)", "pos": "Substantiv" },
  "lots": { "de": "viele / eine Menge", "pos": "Substantiv" },
  "plenty": { "de": "reichlich / genug", "pos": "Pronomen" },

  "two": { "de": "zwei", "pos": "Zahlwort" },
  "three": { "de": "drei", "pos": "Zahlwort" },
  "four": { "de": "vier", "pos": "Zahlwort" },
  "five": { "de": "fünf", "pos": "Zahlwort" },
  "six": { "de": "sechs", "pos": "Zahlwort" },
  "seven": { "de": "sieben", "pos": "Zahlwort" },
  "eight": { "de": "acht", "pos": "Zahlwort" },
  "nine": { "de": "neun", "pos": "Zahlwort" },
  "ten": { "de": "zehn", "pos": "Zahlwort" },
  "first": { "de": "erster / zuerst", "pos": "Zahlwort" },
  "second": { "de": "zweiter / die Sekunde", "pos": "Zahlwort" },
  "third": { "de": "dritter", "pos": "Zahlwort" },
  "hundred": { "de": "hundert", "pos": "Zahlwort" },
  "thousand": { "de": "tausend", "pos": "Zahlwort" },
  "million": { "de": "Million", "pos": "Zahlwort" },

  "mr": { "de": "Herr (Mister)", "pos": "Abkürzung" },
  "mrs": { "de": "Frau (verheiratet)", "pos": "Abkürzung" },
  "ms": { "de": "Frau (neutral)", "pos": "Abkürzung" },
  "dr": { "de": "Doktor", "pos": "Abkürzung" },
  "st": { "de": "Sankt / Straße (Saint, Street)", "pos": "Abkürzung" },
  "etc": { "de": "und so weiter", "pos": "Abkürzung" }
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `node --test tests/base-words.test.mjs`
Expected: `# pass 4`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add docs/base-words.json tests/base-words.test.mjs
git commit -m "Grundliste häufiger Funktionswörter" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 5: Gemeinsame Helfer für die Werkzeuge

**Files:**
- Create: `tools/lib.mjs`
- Test: `tests/lib.test.mjs`

Spec Abschnitte 4.1, 7, 8. Enthält Pfade, JSON-Helfer, Schema- und Abdeckungsprüfung, Blockbildung und Passwortquelle. Alle CLI-Skripte bauen darauf auf.

- [ ] **Step 1: Tests schreiben**

`tests/lib.test.mjs`:

```js
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
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/lib.test.mjs`
Expected: Fehler `Cannot find module` für `tools/lib.mjs`

- [ ] **Step 3: Helfer implementieren**

`tools/lib.mjs`:

```js
// Gemeinsame Helfer für die Werkzeuge (nur Node).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { keysOf, countWords, segment, annotate, normalizeKey } from "../docs/tokenizer.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const LEVELS = ["A2", "B1", "B2", "C1", "C2"];
export const PARA_TYPES = ["h2", "p", "quote"];
export const POS = [
  "Substantiv", "Verb", "Adjektiv", "Adverb", "Pronomen", "Präposition", "Konjunktion",
  "Artikel", "Zahlwort", "Interjektion", "Eigenname", "Phrasal Verb", "Wendung", "Abkürzung",
];
const ID_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,44}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Alle Projektpfade, optional relativ zu einem anderen Stammverzeichnis (für Tests). */
export function paths(root = ROOT) {
  return {
    root,
    library: join(root, "library"),
    texts: join(root, "docs", "texts"),
    baseWords: join(root, "docs", "base-words.json"),
    passwordFile: join(root, ".password"),
  };
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function writeJson(file, obj, { pretty = true } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, (pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj)) + "\n");
}

export function loadBaseWords(root = ROOT) {
  return readJson(paths(root).baseWords);
}

/** Eigene Eigenschaft vorhanden (schützt vor Prototyp-Schlüsseln wie "constructor"). */
export const has = (obj, key) => obj !== null && typeof obj === "object" && Object.hasOwn(obj, key);

/** Prüft einen Wörterbucheintrag. Liefert eine Liste von Fehlern (leer = in Ordnung). */
export function checkGloss(key, value) {
  if (typeof key !== "string" || key.length === 0) return ["Schlüssel fehlt"];
  const errors = [];
  if (key !== normalizeKey(key)) errors.push("Schlüssel nicht normalisiert (Kleinschreibung, gerader Apostroph)");
  if (key !== key.trim() || /\s{2,}/.test(key)) errors.push("Schlüssel mit überflüssigem Leerraum");
  if (key.split(" ").length > 4) errors.push("Wendung hat mehr als 4 Wörter");
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [...errors, "Eintrag ist kein Objekt"];
  if (typeof value.de !== "string" || value.de.trim().length === 0) errors.push("de fehlt oder leer");
  for (const f of ["base", "pos", "note"]) {
    if (f in value && typeof value[f] !== "string") errors.push(`${f} ist kein String`);
  }
  if (typeof value.pos === "string" && value.pos !== "" && !POS.includes(value.pos)) {
    errors.push(`unbekannte Wortart "${value.pos}"`);
  }
  return errors;
}

/** Prüft die Form einer Klartextdatei. Liefert eine Liste von Fehlern. */
export function checkSchema(text) {
  if (text === null || typeof text !== "object" || Array.isArray(text)) return ["Text ist kein Objekt"];
  const errors = [];
  if (typeof text.id !== "string" || !ID_RE.test(text.id)) errors.push("id fehlt oder hat nicht die Form JJJJ-MM-TT-slug");
  if (typeof text.title !== "string" || text.title.trim() === "") errors.push("title fehlt");
  for (const f of ["author", "source"]) {
    if (typeof text[f] !== "string") errors.push(`${f} fehlt (leerer String ist erlaubt)`);
  }
  if (typeof text.addedAt !== "string" || !DATE_RE.test(text.addedAt)) errors.push("addedAt fehlt oder hat nicht die Form JJJJ-MM-TT");
  if (!LEVELS.includes(text.level)) errors.push(`level muss eins von ${LEVELS.join(", ")} sein`);
  if (typeof text.summary !== "string" || text.summary.trim() === "") errors.push("summary fehlt");
  if (!Array.isArray(text.paragraphs) || text.paragraphs.length === 0) {
    errors.push("paragraphs fehlt oder ist leer");
  } else {
    text.paragraphs.forEach((p, i) => {
      if (p === null || typeof p !== "object") return errors.push(`Absatz ${i + 1}: kein Objekt`);
      if (!PARA_TYPES.includes(p.type)) errors.push(`Absatz ${i + 1}: type muss h2, p oder quote sein`);
      if (typeof p.text !== "string" || p.text.trim() === "") errors.push(`Absatz ${i + 1}: text fehlt`);
      else if (/[\r\n]/.test(p.text)) errors.push(`Absatz ${i + 1}: text enthält Zeilenumbrüche`);
    });
  }
  if (text.glosses === null || typeof text.glosses !== "object" || Array.isArray(text.glosses)) {
    errors.push("glosses fehlt oder ist kein Objekt");
  } else {
    for (const [k, v] of Object.entries(text.glosses)) {
      for (const e of checkGloss(k, v)) errors.push(`Eintrag "${k}": ${e}`);
    }
  }
  return errors;
}

/** Kommt die Wendung als aufeinander folgende Wörter in einem Absatz vor? */
export function phraseOccurs(paragraphs, phraseKey) {
  const n = phraseKey.split(" ").length;
  for (const p of paragraphs) {
    const text = typeof p === "string" ? p : p.text;
    if (annotate(segment(text), (k) => k === phraseKey, n).some((s) => s.type === "phrase")) return true;
  }
  return false;
}

/** Abdeckung: fehlende Wörter, Einträge ohne Vorkommen, Wendungen ohne Vorkommen. */
export function coverage(text, baseWords) {
  const keys = new Set(keysOf(text.paragraphs));
  const glosses = text.glosses || {};
  const missing = [...keys].filter((k) => !has(glosses, k) && !has(baseWords, k)).sort();
  const extra = [];
  const badPhrases = [];
  for (const k of Object.keys(glosses)) {
    if (k.includes(" ")) {
      if (!phraseOccurs(text.paragraphs, k)) badPhrases.push(k);
    } else if (!keys.has(k)) {
      extra.push(k);
    }
  }
  return { missing, extra: extra.sort(), badPhrases: badPhrases.sort() };
}

/** Schema plus Abdeckung plus Zähler. Bei Schemafehlern wird die Abdeckung übersprungen. */
export function validateText(text, baseWords) {
  const errors = checkSchema(text);
  if (errors.length) return { errors, missing: [], extra: [], badPhrases: [], wordCount: 0, glossCount: 0 };
  return {
    errors,
    ...coverage(text, baseWords),
    wordCount: countWords(text.paragraphs),
    glossCount: Object.keys(text.glosses).length,
  };
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Passwort aus READER_PASSWORD oder .password; sonst Fehler mit Hinweis. */
export function readPassword(root = ROOT) {
  const env = process.env.READER_PASSWORD;
  if (env && env.length > 0) return env;
  const file = paths(root).passwordFile;
  if (existsSync(file)) {
    const pw = readFileSync(file, "utf8").replace(/[\r\n]+$/, "");
    if (pw.length > 0) return pw;
  }
  throw new Error("Kein Passwort gefunden. Bitte zuerst `npm run setup` ausführen (oder READER_PASSWORD setzen).");
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/lib.test.mjs`
Expected: `# pass 12`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add tools/lib.mjs tests/lib.test.mjs
git commit -m "Helfer für Werkzeuge: Schema, Abdeckung, Passwortquelle" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 6: Werkzeug `words.mjs`

**Files:**
- Create: `tools/words.mjs`
- Test: `tests/words.test.mjs`

Spec Abschnitt 7: gibt Wortschlüssel ohne Eintrag aus; `--all` ignoriert die Grundliste; `--chunk N` bildet Blöcke; `--json` gibt JSON aus. Die Anzahl geht nach stderr, damit stdout rein bleibt.

- [ ] **Step 1: Tests schreiben**

`tests/words.test.mjs`:

```js
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
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/words.test.mjs`
Expected: alle Tests schlagen fehl (Modul fehlt, Exit-Code ungleich 0)

- [ ] **Step 3: Werkzeug implementieren**

`tools/words.mjs`:

```js
// Gibt die Wortschlüssel eines Textes aus, die noch keinen Eintrag haben.
// Aufruf: node tools/words.mjs <library-datei> [--all] [--chunk N] [--json]
import { readJson, loadBaseWords, chunk, has } from "./lib.mjs";
import { keysOf } from "../docs/tokenizer.js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
if (!file) {
  console.error("Aufruf: node tools/words.mjs <library-datei> [--all] [--chunk N] [--json]");
  process.exit(2);
}
const all = args.includes("--all");
const json = args.includes("--json");
const chunkIndex = args.indexOf("--chunk");
const size = chunkIndex >= 0 ? Number(args[chunkIndex + 1]) : 0;

const text = readJson(file);
const base = all ? {} : loadBaseWords();
const glosses = text.glosses || {};
const keys = keysOf(text.paragraphs).filter((k) => !has(glosses, k) && !has(base, k));
const blocks = size > 0 ? chunk(keys, size) : null;

if (json) console.log(JSON.stringify(blocks ?? keys));
else if (blocks) blocks.forEach((b, i) => console.log(`# Block ${i + 1}\n${b.join("\n")}`));
else console.log(keys.join("\n"));
console.error(`${keys.length} Wörter ohne Eintrag${blocks ? `, ${blocks.length} Blöcke` : ""}`);
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/words.test.mjs`
Expected: `# pass 5`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add tools/words.mjs tests/words.test.mjs
git commit -m "Werkzeug words: Wortliste ohne Eintrag" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Werkzeug `merge.mjs`

**Files:**
- Create: `tools/merge.mjs`
- Test: `tests/merge.test.mjs`

Spec Abschnitt 7: liest `library/.parts/<id>/*.json`, normalisiert Schlüssel, prüft Einträge, mergt (neu überschreibt alt), ergänzt fehlende Felder mit `""`, speichert die Einträge sortiert, löscht die Teile.

- [ ] **Step 1: Tests schreiben**

`tests/merge.test.mjs`:

```js
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
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/merge.test.mjs`
Expected: alle Tests schlagen fehl

- [ ] **Step 3: Werkzeug implementieren**

`tools/merge.mjs`:

```js
// Mergt Übersetzungs-Teile aus library/.parts/<id>/*.json in die Klartextdatei.
// Aufruf: node tools/merge.mjs <library-datei>
import { readdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { readJson, writeJson, checkGloss } from "./lib.mjs";
import { normalizeKey } from "../docs/tokenizer.js";

const file = process.argv[2];
if (!file) {
  console.error("Aufruf: node tools/merge.mjs <library-datei>");
  process.exit(2);
}
const text = readJson(file);
const partsDir = join(dirname(file), ".parts", text.id);
if (!existsSync(partsDir)) {
  console.error(`Kein Ordner ${partsDir}`);
  process.exit(1);
}

text.glosses = text.glosses || {};
let taken = 0;
let rejected = 0;
for (const name of readdirSync(partsDir).filter((f) => f.endsWith(".json")).sort()) {
  let part;
  try {
    part = readJson(join(partsDir, name));
  } catch (e) {
    console.error(`Teildatei ${name} nicht lesbar: ${e.message}`);
    continue;
  }
  for (const [rawKey, value] of Object.entries(part)) {
    const key = normalizeKey(rawKey.trim()).replace(/\s+/g, " ");
    const errors = checkGloss(key, value);
    if (errors.length) {
      rejected++;
      console.error(`Verworfen ${name} "${rawKey}": ${errors.join("; ")}`);
      continue;
    }
    text.glosses[key] = { de: value.de.trim(), base: value.base || "", pos: value.pos || "", note: value.note || "" };
    taken++;
  }
}
text.glosses = Object.fromEntries(Object.entries(text.glosses).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
writeJson(file, text);
rmSync(partsDir, { recursive: true, force: true });
console.log(`${taken} Einträge übernommen, ${rejected} verworfen, ${Object.keys(text.glosses).length} gesamt`);
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/merge.test.mjs`
Expected: `# pass 4`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add tools/merge.mjs tests/merge.test.mjs
git commit -m "Werkzeug merge: Übersetzungs-Teile zusammenführen" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Werkzeug `validate.mjs`

**Files:**
- Create: `tools/validate.mjs`
- Test: `tests/validate.test.mjs`

Spec Abschnitte 7 und 10: Bericht auf stderr, Ergebniszeile auf stdout, Exit-Code 1 bei Schemafehlern oder fehlenden Wörtern. Wendungen ohne Vorkommen und überzählige Einträge sind Warnungen.

- [ ] **Step 1: Tests schreiben**

`tests/validate.test.mjs`:

```js
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
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/validate.test.mjs`
Expected: alle Tests schlagen fehl

- [ ] **Step 3: Werkzeug implementieren**

`tools/validate.mjs`:

```js
// Prüft Schema und Abdeckung einer Klartextdatei.
// Aufruf: node tools/validate.mjs <library-datei>
import { readJson, loadBaseWords, validateText } from "./lib.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Aufruf: node tools/validate.mjs <library-datei>");
  process.exit(2);
}
const text = readJson(file);
const r = validateText(text, loadBaseWords());

for (const e of r.errors) console.error(`Schema: ${e}`);
if (r.missing.length) {
  console.error(`Fehlende Einträge (${r.missing.length}):`);
  console.error(r.missing.join("\n"));
}
if (r.badPhrases.length) console.error(`Warnung: Wendungen nicht im Text (${r.badPhrases.length}): ${r.badPhrases.join(", ")}`);
if (r.extra.length) console.error(`Warnung: Einträge ohne Vorkommen (${r.extra.length}): ${r.extra.join(", ")}`);

const ok = r.errors.length === 0 && r.missing.length === 0;
console.log(ok ? `OK: ${text.id}, ${r.wordCount} Wörter, ${r.glossCount} Einträge` : `FEHLER: ${text.id ?? file}`);
process.exit(ok ? 0 : 1);
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/validate.test.mjs`
Expected: `# pass 5`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add tools/validate.mjs tests/validate.test.mjs
git commit -m "Werkzeug validate: Schema und Abdeckung prüfen" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 9: Werkzeug `encrypt.mjs`

**Files:**
- Create: `tools/encrypt.mjs`
- Test: `tests/encrypt.test.mjs`

Spec Abschnitte 4.3, 7, 8. `--root DIR` erlaubt Tests in einem Wegwerf-Verzeichnis. Ungültige Texte werden nicht verschlüsselt und nicht in den Index aufgenommen; verschlüsselte Dateien ohne Klartext werden entfernt. Exit-Code 1, wenn mindestens ein Text fehlschlug; 2 ohne Passwort.

- [ ] **Step 1: Tests schreiben**

`tests/encrypt.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveKey, decryptJson } from "../docs/crypto.js";

const TOOL = fileURLToPath(new URL("../tools/encrypt.mjs", import.meta.url));
const BASE = fileURLToPath(new URL("../docs/base-words.json", import.meta.url));

function makeText(id, title, addedAt, complete = true) {
  return {
    id, title, author: "A", source: "", addedAt, level: "B1", summary: "S.",
    paragraphs: [{ type: "p", text: "The fox runs." }],
    glosses: complete
      ? { fox: { de: "der Fuchs" }, runs: { de: "rennt", base: "run" } }
      : { fox: { de: "der Fuchs" } },
  };
}

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "enc-"));
  mkdirSync(join(root, "library"), { recursive: true });
  mkdirSync(join(root, "docs", "texts"), { recursive: true });
  copyFileSync(BASE, join(root, "docs", "base-words.json"));
  const put = (t) => writeFileSync(join(root, "library", `${t.id}.json`), JSON.stringify(t));
  put(makeText("2026-09-01-alt", "Alt", "2026-09-01"));
  put(makeText("2026-09-13-neu", "Neu", "2026-09-13"));
  put(makeText("2026-09-13-kaputt", "Kaputt", "2026-09-13", false));
  writeFileSync(join(root, "docs", "texts", "2020-01-01-verwaist.json"), "{}");
  return root;
}

const run = (root, ...args) => spawnSync("node", [TOOL, "--root", root, ...args], {
  encoding: "utf8",
  env: { ...process.env, READER_PASSWORD: "test-passwort" },
});

test("encrypt: verschlüsselt gültige Texte, meldet ungültige, entfernt Verwaiste, baut Index", async () => {
  const root = makeRoot();
  const r = run(root);
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /2026-09-13-kaputt: nicht verschlüsselt/);
  const texts = join(root, "docs", "texts");
  assert.ok(existsSync(join(texts, "salt.json")));
  assert.ok(existsSync(join(texts, "2026-09-01-alt.json")));
  assert.ok(existsSync(join(texts, "2026-09-13-neu.json")));
  assert.equal(existsSync(join(texts, "2026-09-13-kaputt.json")), false);
  assert.equal(existsSync(join(texts, "2020-01-01-verwaist.json")), false);

  const salt = JSON.parse(readFileSync(join(texts, "salt.json"), "utf8"));
  assert.equal(salt.iterations, 310000);
  assert.equal(salt.kdf, "PBKDF2-SHA256");
  const key = await deriveKey("test-passwort", salt.salt, salt.iterations);
  const index = await decryptJson(key, JSON.parse(readFileSync(join(texts, "index.json"), "utf8")));
  assert.equal(index.v, 1);
  assert.deepEqual(index.texts.map((t) => t.id), ["2026-09-13-neu", "2026-09-01-alt"]);
  assert.equal(index.texts[0].wordCount, 3);
  assert.equal(index.texts[0].title, "Neu");
  const text = await decryptJson(key, JSON.parse(readFileSync(join(texts, "2026-09-13-neu.json"), "utf8")));
  assert.equal(text.paragraphs[0].text, "The fox runs.");
});

test("encrypt: nur eine id verschlüsseln, Salt bleibt gleich, Index bleibt vollständig", async () => {
  const root = makeRoot();
  run(root);
  const saltFile = join(root, "docs", "texts", "salt.json");
  const saltBefore = readFileSync(saltFile, "utf8");
  const r = run(root, "2026-09-01-alt");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /verschlüsselt: 2026-09-01-alt/);
  assert.doesNotMatch(r.stdout, /verschlüsselt: 2026-09-13-neu/);
  assert.equal(readFileSync(saltFile, "utf8"), saltBefore);
  const salt = JSON.parse(saltBefore);
  const key = await deriveKey("test-passwort", salt.salt, salt.iterations);
  const index = await decryptJson(key, JSON.parse(readFileSync(join(root, "docs", "texts", "index.json"), "utf8")));
  assert.equal(index.texts.length, 2);
});

test("encrypt: ohne Passwort Exit 2 mit Hinweis", () => {
  const root = makeRoot();
  const env = { ...process.env };
  delete env.READER_PASSWORD;
  const r = spawnSync("node", [TOOL, "--root", root], { encoding: "utf8", env });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /npm run setup/);
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/encrypt.test.mjs`
Expected: alle Tests schlagen fehl

- [ ] **Step 3: Werkzeug implementieren**

`tools/encrypt.mjs`:

```js
// Verschlüsselt Klartexte aus library/ nach docs/texts/ und baut den Index.
// Aufruf: node tools/encrypt.mjs [id] [--root DIR]
import { readdirSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { paths, readJson, writeJson, readPassword, validateText, ROOT } from "./lib.mjs";
import { deriveKey, encryptJson, randomBytes, toBase64, DEFAULT_ITERATIONS } from "../docs/crypto.js";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = rootIndex >= 0 ? args[rootIndex + 1] : ROOT;
const skip = rootIndex >= 0 ? rootIndex + 1 : -1;
const only = args.find((a, i) => !a.startsWith("--") && i !== skip);
const p = paths(root);

let password;
try {
  password = readPassword(root);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}

mkdirSync(p.texts, { recursive: true });
const saltFile = join(p.texts, "salt.json");
if (!existsSync(saltFile)) {
  writeJson(saltFile, { v: 1, kdf: "PBKDF2-SHA256", iterations: DEFAULT_ITERATIONS, salt: toBase64(randomBytes(16)) });
  console.log("Salt angelegt: docs/texts/salt.json");
}
const salt = readJson(saltFile);
const key = await deriveKey(password, salt.salt, salt.iterations);
const base = readJson(p.baseWords);

const files = existsSync(p.library) ? readdirSync(p.library).filter((f) => f.endsWith(".json")).sort() : [];
const ids = new Set();
const entries = [];
let failed = 0;

for (const name of files) {
  const id = basename(name, ".json");
  ids.add(id);
  const text = readJson(join(p.library, name));
  if (text.id !== id) {
    console.error(`${name}: id "${text.id}" passt nicht zum Dateinamen`);
    failed++;
    continue;
  }
  const r = validateText(text, base);
  const ok = r.errors.length === 0 && r.missing.length === 0;
  const target = join(p.texts, `${id}.json`);
  if (!only || only === id) {
    if (!ok) {
      failed++;
      for (const e of r.errors) console.error(`${id}: Schema: ${e}`);
      if (r.missing.length) console.error(`${id}: ${r.missing.length} fehlende Einträge (node tools/validate.mjs zeigt sie)`);
      console.error(`${id}: nicht verschlüsselt`);
    } else {
      writeJson(target, await encryptJson(key, text), { pretty: false });
      console.log(`verschlüsselt: ${id} (${r.wordCount} Wörter, ${r.glossCount} Einträge)`);
    }
  }
  if (ok && existsSync(target)) {
    entries.push({
      id, title: text.title, author: text.author, source: text.source, addedAt: text.addedAt,
      level: text.level, summary: text.summary, wordCount: r.wordCount,
    });
  }
}

for (const name of readdirSync(p.texts)) {
  if (!name.endsWith(".json") || name === "index.json" || name === "salt.json") continue;
  const id = basename(name, ".json");
  if (!ids.has(id)) {
    unlinkSync(join(p.texts, name));
    console.log(`entfernt (kein Klartext mehr): ${id}`);
  }
}

entries.sort((a, b) => {
  if (a.addedAt !== b.addedAt) return a.addedAt < b.addedAt ? 1 : -1;
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
});
const index = { v: 1, generatedAt: new Date().toISOString(), texts: entries };
writeJson(join(p.texts, "index.json"), await encryptJson(key, index), { pretty: false });
console.log(`Index: ${entries.length} Texte`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/encrypt.test.mjs`
Expected: `# pass 3`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add tools/encrypt.mjs tests/encrypt.test.mjs
git commit -m "Werkzeug encrypt: Texte verschlüsseln und Index bauen" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Werkzeug `setup.mjs`

**Files:**
- Create: `tools/setup.mjs`
- Test: `tests/setup.test.mjs`

Spec Abschnitt 7. Interaktiv, nur im Terminal des Nutzers. Automatisch testbar ist nur der Abbruch ohne Terminal.

- [ ] **Step 1: Test schreiben**

`tests/setup.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("../tools/setup.mjs", import.meta.url));

test("setup: ohne Terminal Abbruch mit Hinweis, Exit 1", () => {
  const r = spawnSync("node", [TOOL], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Terminal/);
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/setup.test.mjs`
Expected: Test schlägt fehl

- [ ] **Step 3: Werkzeug implementieren**

`tools/setup.mjs`:

```js
// Legt das Passwort (.password) und den Salt (docs/texts/salt.json) an. Interaktiv.
// Aufruf: npm run setup
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { paths, writeJson, ROOT } from "./lib.mjs";
import { randomBytes, toBase64, DEFAULT_ITERATIONS } from "../docs/crypto.js";

/** Liest eine Zeile ohne Echo (Passworteingabe). */
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return reject(new Error("Bitte in einem Terminal ausführen (npm run setup)."));
    stdout.write(question);
    let value = "";
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
    };
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n") {
        cleanup();
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        cleanup();
        stdout.write("\n");
        process.exit(130);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });
}

const p = paths(ROOT);
const saltFile = join(p.texts, "salt.json");
const old = existsSync(p.passwordFile) ? readFileSync(p.passwordFile, "utf8").replace(/[\r\n]+$/, "") : null;

try {
  console.log("Passwort für den Reader festlegen. Mindestens 12 Zeichen empfohlen.");
  const pw1 = await askHidden("Passwort: ");
  if (pw1.length < 8) {
    console.error("Zu kurz (mindestens 8 Zeichen).");
    process.exit(1);
  }
  const pw2 = await askHidden("Passwort wiederholen: ");
  if (pw1 !== pw2) {
    console.error("Die Passwörter stimmen nicht überein.");
    process.exit(1);
  }
  writeFileSync(p.passwordFile, pw1 + "\n", { mode: 0o600 });
  console.log("Gespeichert in .password (liegt nicht im Repo).");
  if (!existsSync(saltFile)) {
    mkdirSync(p.texts, { recursive: true });
    writeJson(saltFile, { v: 1, kdf: "PBKDF2-SHA256", iterations: DEFAULT_ITERATIONS, salt: toBase64(randomBytes(16)) });
    console.log("Salt angelegt: docs/texts/salt.json");
  }
  if (old !== null && old !== pw1) {
    console.log("Passwort geändert: jetzt `npm run encrypt` ausführen, pushen und auf jedem Gerät neu anmelden.");
  }
  console.log("Weiter mit: npm run encrypt");
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `node --test tests/setup.test.mjs`
Expected: `# pass 1`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add tools/setup.mjs tests/setup.test.mjs
git commit -m "Werkzeug setup: Passwort und Salt anlegen" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Werkzeug `serve.mjs`

**Files:**
- Create: `tools/serve.mjs`
- Test: `tests/serve.test.mjs`

Spec Abschnitt 7: statischer Server für `docs/` auf `localhost`, korrekte MIME-Typen, `Cache-Control: no-store`, kein Zugriff außerhalb des Ordners. Port `0` wählt einen freien Port (für Tests).

- [ ] **Step 1: Test schreiben**

`tests/serve.test.mjs`:

```js
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/serve.test.mjs`
Expected: Test schlägt fehl (Server beendet)

- [ ] **Step 3: Werkzeug implementieren**

`tools/serve.mjs`:

```js
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
```

- [ ] **Step 4: Test laufen lassen**

Run: `node --test tests/serve.test.mjs`
Expected: `# pass 1`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add tools/serve.mjs tests/serve.test.mjs
git commit -m "Werkzeug serve: lokaler Server für docs/" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 12: Icons erzeugen

**Files:**
- Create: `tools/make-icons.mjs`
- Create: `docs/icons/icon.svg`
- Test: `tests/icons.test.mjs`

Spec Abschnitt 6.4: PNG-Icons (180, 192, 512) ohne Abhängigkeiten. Motiv: bernsteinfarbenes Quadrat mit stilisiertem aufgeschlagenem Buch. Das SVG dient als Favicon.

- [ ] **Step 1: Test schreiben**

`tests/icons.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "../tools/make-icons.mjs";

const TOOL = fileURLToPath(new URL("../tools/make-icons.mjs", import.meta.url));
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("encodePng: Signatur, IHDR und Rohdaten", () => {
  const rgba = Buffer.alloc(2 * 2 * 4, 255);
  const png = encodePng(2, 2, rgba);
  assert.deepEqual(png.subarray(0, 8), SIGNATURE);
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 2);
  const idatLen = png.readUInt32BE(33);
  assert.equal(png.subarray(37, 41).toString("ascii"), "IDAT");
  const raw = inflateSync(png.subarray(41, 41 + idatLen));
  assert.equal(raw.length, (2 * 4 + 1) * 2);
  assert.equal(png.subarray(png.length - 8, png.length - 4).toString("ascii"), "IEND");
});

test("make-icons: schreibt drei PNGs mit richtigen Maßen", () => {
  const out = mkdtempSync(join(tmpdir(), "icons-"));
  execFileSync("node", [TOOL, "--out", out], { encoding: "utf8" });
  for (const size of [180, 192, 512]) {
    const png = readFileSync(join(out, `icon-${size}.png`));
    assert.deepEqual(png.subarray(0, 8), SIGNATURE);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `node --test tests/icons.test.mjs`
Expected: Fehler `Cannot find module` für `tools/make-icons.mjs`

- [ ] **Step 3: Skript implementieren**

`tools/make-icons.mjs`:

```js
// Erzeugt die App-Icons als PNG ohne Abhängigkeiten.
// Aufruf: node tools/make-icons.mjs [--out DIR]
import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./lib.mjs";

const ACCENT = [184, 116, 58]; // #b8743a
const PAGE = [251, 247, 240]; // #fbf7f0
const LINE = [224, 195, 160]; // #e0c3a0

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Kodiert RGBA-Pixel (Buffer, 4 Byte je Pixel) als PNG. */
export function encodePng(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // Filtertyp: keiner
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // Farbtyp RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Liegt der Punkt im abgerundeten Rechteck? */
function inRoundRect(x, y, s) {
  if (x < s.x || y < s.y || x >= s.x + s.w || y >= s.y + s.h) return false;
  const cx = Math.max(s.x + s.r, Math.min(x, s.x + s.w - s.r));
  const cy = Math.max(s.y + s.r, Math.min(y, s.y + s.h - s.r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= s.r * s.r;
}

/** Zeichnet Formen (letzte gewinnt) mit 3x3 Subpixeln für weiche Kanten. */
function paint(size, shapes) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, covered = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          let color = null;
          for (const s of shapes) if (inRoundRect(px, py, s)) color = s.color;
          if (color) {
            r += color[0]; g += color[1]; b += color[2]; covered++;
          }
        }
      }
      const i = (y * size + x) * 4;
      if (covered > 0) {
        buf[i] = Math.round(r / covered);
        buf[i + 1] = Math.round(g / covered);
        buf[i + 2] = Math.round(b / covered);
        buf[i + 3] = Math.round((covered / (SS * SS)) * 255);
      }
    }
  }
  return buf;
}

/** Bernsteinfarbenes Quadrat mit aufgeschlagenem Buch. */
export function icon(S) {
  const shapes = [{ x: 0, y: 0, w: S, h: S, r: 0, color: ACCENT }];
  for (const px of [0.17, 0.52]) {
    shapes.push({ x: px * S, y: 0.27 * S, w: 0.31 * S, h: 0.46 * S, r: 0.04 * S, color: PAGE });
    [0.36, 0.44, 0.52, 0.6].forEach((ly, i) => {
      shapes.push({ x: (px + 0.05) * S, y: ly * S, w: (i === 3 ? 0.13 : 0.21) * S, h: 0.035 * S, r: 0.0175 * S, color: LINE });
    });
  }
  return encodePng(S, S, paint(S, shapes));
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : join(ROOT, "docs", "icons");
  mkdirSync(outDir, { recursive: true });
  for (const size of [180, 192, 512]) {
    writeFileSync(join(outDir, `icon-${size}.png`), icon(size));
    console.log(`geschrieben: icon-${size}.png`);
  }
}
```

- [ ] **Step 4: Favicon als SVG anlegen**

`docs/icons/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#b8743a"/><rect x="17" y="27" width="31" height="46" rx="4" fill="#fbf7f0"/><rect x="52" y="27" width="31" height="46" rx="4" fill="#fbf7f0"/><g fill="#e0c3a0"><rect x="22" y="36" width="21" height="3.5" rx="1.75"/><rect x="22" y="44" width="21" height="3.5" rx="1.75"/><rect x="22" y="52" width="21" height="3.5" rx="1.75"/><rect x="22" y="60" width="13" height="3.5" rx="1.75"/><rect x="57" y="36" width="21" height="3.5" rx="1.75"/><rect x="57" y="44" width="21" height="3.5" rx="1.75"/><rect x="57" y="52" width="21" height="3.5" rx="1.75"/><rect x="57" y="60" width="13" height="3.5" rx="1.75"/></g></svg>
```

- [ ] **Step 5: Tests laufen lassen und Icons erzeugen**

Run: `node --test tests/icons.test.mjs && npm run icons`
Expected: `# pass 2`, danach drei Zeilen `geschrieben: icon-*.png`; die Dateien liegen in `docs/icons/`. Eine der PNGs mit dem Read-Werkzeug ansehen: bernsteinfarbenes Quadrat, zwei helle Seiten mit Linien.

- [ ] **Step 6: Commit**

```bash
git add tools/make-icons.mjs tests/icons.test.mjs docs/icons/
git commit -m "App-Icons als PNG und SVG" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Schrift Literata holen

**Files:**
- Create: `tools/fetch-fonts.mjs`
- Create (per Skript): `docs/fonts/*.woff2`, `docs/fonts/literata.css`

Spec Abschnitt 6.4: Literata (SIL Open Font License) wird mitgeliefert. Das Skript holt die Latin- und Latin-Ext-Teilmengen für Regular, Italic und Bold von Google Fonts und schreibt die `@font-face`-Regeln. Schlägt das Netz fehl, bleibt die App bei Systemschriften; das ist kein Fehler.

- [ ] **Step 1: Skript schreiben**

`tools/fetch-fonts.mjs`:

```js
// Holt Literata (OFL) von Google Fonts nach docs/fonts/ und schreibt docs/fonts/literata.css.
// Aufruf: npm run fonts   (bei Netzwerkfehler: Warnung, Exit 0; die App nutzt dann Systemschriften)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const CSS_URL = "https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400;0,700;1,400&display=swap";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const outDir = join(ROOT, "docs", "fonts");

try {
  const res = await fetch(CSS_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const css = await res.text();
  const blocks = [...css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face \{([^}]*)\}/g)];
  const wanted = blocks.filter((m) => m[1] === "latin" || m[1] === "latin-ext");
  if (wanted.length === 0) throw new Error("Keine @font-face-Blöcke gefunden");
  mkdirSync(outDir, { recursive: true });
  const rules = [];
  for (const [, subset, body] of wanted) {
    const style = body.match(/font-style:\s*(\w+)/)[1];
    const weight = body.match(/font-weight:\s*(\d+)/)[1];
    const url = body.match(/url\((https:[^)]+\.woff2)\)/)[1];
    const range = body.match(/unicode-range:\s*([^;]+);/)[1].trim();
    const name = `literata-${weight}-${style}-${subset}.woff2`;
    const font = await fetch(url);
    if (!font.ok) throw new Error(`HTTP ${font.status} für ${name}`);
    writeFileSync(join(outDir, name), Buffer.from(await font.arrayBuffer()));
    rules.push(
      `@font-face {\n  font-family: "Literata";\n  font-style: ${style};\n  font-weight: ${weight};\n` +
      `  font-display: swap;\n  src: url("${name}") format("woff2");\n  unicode-range: ${range};\n}`,
    );
    console.log(`geholt: ${name}`);
  }
  writeFileSync(join(outDir, "literata.css"), rules.join("\n\n") + "\n");
  console.log(`geschrieben: docs/fonts/literata.css (${rules.length} Regeln)`);
} catch (e) {
  console.warn(`Schrift nicht geholt (${e.message}). Die App nutzt Systemschriften.`);
}
```

- [ ] **Step 2: Skript ausführen**

Run: `npm run fonts`
Expected: sechs Zeilen `geholt: literata-...woff2` und `geschrieben: docs/fonts/literata.css (6 Regeln)`. Ohne Netz: die Warnung; dann weiter ohne `docs/fonts/`.

- [ ] **Step 3: Commit**

```bash
git add tools/fetch-fonts.mjs docs/fonts
git commit -m "Schrift Literata holen und einbinden" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

(Falls `docs/fonts/` nicht existiert, nur das Skript committen.)

---

### Task 14: HTML, CSS, Manifest

**Files:**
- Create: `docs/index.html`
- Create: `docs/styles.css`
- Create: `docs/manifest.webmanifest`

Spec Abschnitte 6.2, 6.4. Noch ohne `app.js` (Task 15). Farben als Variablen; `data-theme` am `<html>` überstimmt die Systemeinstellung. Popup ist unter 700 px ein Blatt am unteren Rand, darüber ein Kästchen.

- [ ] **Step 1: index.html schreiben**

`docs/index.html`:

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Englisch lesen</title>
  <meta name="description" content="Englische Texte lesen, Wort antippen, deutsche Übersetzung im Kontext.">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f8f5ef">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1e1f22">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Englisch lesen">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icons/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="icons/icon-180.png">
  <link rel="stylesheet" href="fonts/literata.css">
  <link rel="stylesheet" href="styles.css">
  <script>
    // Gespeichertes Farbschema vor dem ersten Rendern setzen, damit nichts aufblitzt.
    try { const t = localStorage.getItem("reader.theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  </script>
</head>
<body>
  <header class="bar" id="bar"></header>
  <main class="view" id="main"></main>
  <div class="popup" id="popup" role="dialog" aria-live="polite" hidden></div>
  <script type="module" src="app.js"></script>
  <noscript><p class="msg">Diese Seite braucht JavaScript.</p></noscript>
</body>
</html>
```

- [ ] **Step 2: styles.css schreiben**

`docs/styles.css`:

```css
:root {
  --font-size: 19px;
  --serif: "Literata", ui-serif, Charter, "Iowan Old Style", Georgia, "Noto Serif", serif;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --bg: #f8f5ef;
  --bg-elev: #fffdf9;
  --text: #2b2a27;
  --muted: #6f6b63;
  --accent: #a8622a;
  --accent-soft: rgba(184, 116, 58, 0.16);
  --accent-strong: rgba(184, 116, 58, 0.34);
  --border: rgba(43, 42, 39, 0.12);
  --error: #b3261e;
  --shadow: 0 8px 30px rgba(30, 20, 10, 0.18);
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #1e1f22;
    --bg-elev: #27282c;
    --text: #d8d5cf;
    --muted: #9a978f;
    --accent: #d9a76a;
    --accent-soft: rgba(217, 167, 106, 0.18);
    --accent-strong: rgba(217, 167, 106, 0.36);
    --border: rgba(216, 213, 207, 0.14);
    --error: #ff8a7a;
    --shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    color-scheme: dark;
  }
}

:root[data-theme="dark"] {
  --bg: #1e1f22;
  --bg-elev: #27282c;
  --text: #d8d5cf;
  --muted: #9a978f;
  --accent: #d9a76a;
  --accent-soft: rgba(217, 167, 106, 0.18);
  --accent-strong: rgba(217, 167, 106, 0.36);
  --border: rgba(216, 213, 207, 0.14);
  --error: #ff8a7a;
  --shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  color-scheme: dark;
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }

html { background: var(--bg); }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--serif);
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* Kopfzeile */
.bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 52px;
  padding: env(safe-area-inset-top) max(10px, env(safe-area-inset-right)) 0 max(10px, env(safe-area-inset-left));
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  font-family: var(--sans);
}
.bar:empty { display: none; }
.bar .title {
  flex: 1;
  min-width: 0;
  font-family: var(--serif);
  font-weight: 700;
  font-size: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 6px;
}
.bar button {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text);
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  border-radius: 10px;
  font: inherit;
  font-size: 16px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.bar button:hover { background: var(--accent-soft); }
.bar .a-minus { font-size: 14px; }
.bar .a-plus { font-size: 20px; }

/* Inhalt */
.view {
  max-width: 65ch;
  margin: 0 auto;
  padding: 16px max(16px, env(safe-area-inset-right)) 96px max(16px, env(safe-area-inset-left));
  font-size: var(--font-size);
  line-height: 1.6;
}
.view.library { max-width: 46rem; }

/* Passwort-Ansicht */
.gate {
  max-width: 22rem;
  margin: 12vh auto 0;
  text-align: center;
  font-family: var(--sans);
  font-size: 16px;
}
.gate h1 { font-family: var(--serif); font-size: 1.7em; margin: 0 0 4px; }
.gate p { color: var(--muted); margin: 0 0 16px; }
.gate input {
  width: 100%;
  font: inherit;
  font-size: 18px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  color: inherit;
  margin: 0 0 12px;
}
.btn {
  font: inherit;
  font-family: var(--sans);
  font-size: 17px;
  padding: 12px 22px;
  border-radius: 10px;
  border: 0;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  min-height: 44px;
}
.btn:disabled { opacity: 0.6; cursor: wait; }
.error { color: var(--error); margin: 10px 0 0; min-height: 1.4em; }

/* Meldungen */
.msg {
  font-family: var(--sans);
  font-size: 16px;
  color: var(--muted);
  text-align: center;
  margin: 10vh auto;
  max-width: 30rem;
}
.msg a { color: var(--accent); }
.link-muted {
  background: none;
  border: 0;
  padding: 8px;
  color: var(--muted);
  text-decoration: underline;
  font: inherit;
  font-family: var(--sans);
  font-size: 14px;
  cursor: pointer;
}
.footer { margin-top: 32px; text-align: center; }

/* Bibliothek */
.library h1 { font-size: 1.5em; margin: 8px 0 18px; }
.card {
  display: block;
  text-decoration: none;
  color: inherit;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
  margin: 0 0 14px;
  -webkit-tap-highlight-color: transparent;
}
.card:hover { border-color: var(--accent); }
.card h2 { margin: 0 0 6px; font-size: 1.15em; line-height: 1.3; }
.card p { margin: 8px 0 0; font-size: 0.95em; color: var(--muted); }
.meta {
  font-family: var(--sans);
  font-size: 0.78em;
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: center;
}
.meta a { color: var(--accent); text-decoration: none; }
.meta a:hover { text-decoration: underline; }
.badge {
  display: inline-block;
  font-family: var(--sans);
  font-size: 0.72em;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  vertical-align: middle;
}

/* Leseansicht */
.article h1 { font-size: 1.6em; line-height: 1.25; margin: 8px 0 8px; }
.article .byline { margin-bottom: 1.6em; }
.article h2 { font-size: 1.25em; line-height: 1.3; margin: 1.6em 0 0.6em; }
.article p { margin: 0 0 1em; }
.article blockquote {
  margin: 1em 0;
  padding: 0 0 0 1em;
  border-left: 3px solid var(--accent-strong);
  color: var(--muted);
  font-style: italic;
}
.article blockquote p { margin: 0; }

.w {
  cursor: pointer;
  border-radius: 4px;
  padding: 0 1px;
  margin: 0 -1px;
  transition: background-color 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.w.phrase {
  text-decoration: underline dotted var(--accent);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.w.active { background: var(--accent-strong); }
@media (hover: hover) and (pointer: fine) {
  .w:hover { background: var(--accent-soft); }
}

/* Popup */
.popup {
  position: fixed;
  z-index: 20;
  background: var(--bg-elev);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.45;
}
.pop-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; margin: 0 28px 6px 0; }
.pop-word { font-family: var(--serif); font-weight: 700; font-size: 1.15em; }
.pop-base { color: var(--muted); }
.pop-de { font-size: 1.1em; margin: 2px 0 4px; }
.pop-de.muted { color: var(--muted); font-style: italic; }
.pop-note { color: var(--muted); font-size: 0.93em; }
.pop-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--text);
  font-size: 18px;
  cursor: pointer;
}

@media (max-width: 699px) {
  .popup {
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 18px 18px 0 0;
    border-bottom: 0;
    padding: 16px 18px calc(16px + env(safe-area-inset-bottom));
    max-height: 45vh;
    overflow-y: auto;
  }
}
@media (min-width: 700px) {
  .popup {
    max-width: 360px;
    border-radius: 12px;
    padding: 12px 14px;
  }
  .pop-head { margin-right: 0; }
  .pop-close { display: none; }
}
```

- [ ] **Step 3: Manifest schreiben**

`docs/manifest.webmanifest`:

```json
{
  "name": "Englisch lesen",
  "short_name": "Englisch",
  "description": "Englische Texte lesen, Wort antippen, deutsche Übersetzung im Kontext.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#f8f5ef",
  "theme_color": "#b8743a",
  "lang": "de",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 4: Auslieferung prüfen**

Run (Server im Hintergrund starten, dann abfragen, dann beenden):

```bash
node tools/serve.mjs 8080 &
sleep 1
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8080/
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8080/styles.css
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8080/manifest.webmanifest
kill %1
```

Expected: `200 text/html; charset=utf-8`, `200 text/css; charset=utf-8`, `200 application/manifest+json`

- [ ] **Step 5: Commit**

```bash
git add docs/index.html docs/styles.css docs/manifest.webmanifest
git commit -m "App-Gerüst: HTML, Stile, Manifest" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 15: App-Logik `app.js`

**Files:**
- Create: `docs/app.js`

Spec Abschnitte 6.1 bis 6.5 und 10. Ein Modul, keine Abhängigkeiten. Alles Dynamische wird über `textContent` oder Textknoten eingefügt, nie über `innerHTML`. Sichtprüfung folgt in Task 18; hier nur Syntaxprüfung.

- [ ] **Step 1: app.js schreiben**

`docs/app.js`:

```js
// Reader: Passwort-Ansicht, Bibliothek, Leseansicht, Popup.
import { segment, annotate } from "./tokenizer.js";
import { deriveKey, decryptJson, exportKey, importKey } from "./crypto.js";

const bar = document.getElementById("bar");
const main = document.getElementById("main");
const popup = document.getElementById("popup");

const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* privater Modus */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* ignorieren */ }
  },
};

const state = {
  salt: null,
  indexFile: null,
  key: null,
  index: null,
  base: {},
  texts: new Map(), // id -> entschlüsselter Text (nur im Speicher)
  fontSize: 19,
  current: null, // { id, title, glosses } in der Leseansicht
  popup: null, // { span, pinned }
};

const has = (obj, key) => obj !== null && typeof obj === "object" && Object.hasOwn(obj, key);
const isNarrow = () => matchMedia("(max-width: 699px)").matches;
const hasHover = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

// ---------- Hilfen ----------

/** Element bauen: el("a", { class: "x", href: "#", text: "Hi", onclick: fn }, [kinder]) */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c !== null && c !== undefined) node.append(c);
  return node;
}

function domainOf(source) {
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return source;
  }
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatWords(n) {
  return `${n.toLocaleString("de-DE")} Wörter · ca. ${Math.max(1, Math.round(n / 200))} Min`;
}

function sourceLink(source) {
  if (/^https?:\/\//.test(source)) return el("a", { href: source, target: "_blank", rel: "noopener", text: domainOf(source) });
  return el("span", { text: source });
}

async function fetchJson(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ---------- Farbschema und Schriftgröße ----------

function applyTheme() {
  const t = store.get("reader.theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === "dark";
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function toggleTheme() {
  store.set("reader.theme", isDark() ? "light" : "dark");
  applyTheme();
  renderBar();
}

function applyFontSize() {
  document.documentElement.style.setProperty("--font-size", `${state.fontSize}px`);
}

function changeFontSize(delta) {
  state.fontSize = Math.min(27, Math.max(15, state.fontSize + delta));
  store.set("reader.fontSize", String(state.fontSize));
  applyFontSize();
}

// ---------- Kopfzeile ----------

function renderBar() {
  bar.replaceChildren();
  if (!state.key) return;
  const themeBtn = el("button", {
    class: "theme",
    "aria-label": isDark() ? "Hellen Modus einschalten" : "Dunklen Modus einschalten",
    title: "Hell / Dunkel",
    onclick: toggleTheme,
    text: isDark() ? "☀" : "☾",
  });
  if (state.current) {
    bar.append(
      el("button", { class: "back", "aria-label": "Zurück zur Bibliothek", onclick: () => { location.hash = "#/"; }, text: "‹ Zurück" }),
      el("span", { class: "title", text: state.current.title }),
      el("button", { class: "a-minus", "aria-label": "Schrift kleiner", onclick: () => changeFontSize(-2), text: "A−" }),
      el("button", { class: "a-plus", "aria-label": "Schrift größer", onclick: () => changeFontSize(2), text: "A+" }),
      themeBtn,
    );
  } else {
    bar.append(el("span", { class: "title", text: "Englisch lesen" }), themeBtn);
  }
}

// ---------- Start und Passwort ----------

async function boot() {
  applyTheme();
  state.fontSize = Number(store.get("reader.fontSize", "19")) || 19;
  applyFontSize();
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    renderMessage("Web Crypto ist nicht verfügbar.", "Bitte die Seite über HTTPS oder localhost öffnen.");
    return;
  }
  const [salt, indexFile, base] = await Promise.all([
    fetchJson("texts/salt.json"),
    fetchJson("texts/index.json"),
    fetchJson("base-words.json"),
  ]);
  state.base = base || {};
  if (!salt || !indexFile) {
    renderMessage("Noch keine Texte veröffentlicht.", "In Claude Code mit /add-text einen Text anlegen, dann npm run encrypt ausführen und pushen.");
    return;
  }
  state.salt = salt;
  state.indexFile = indexFile;
  const cached = store.get("reader.key");
  if (cached) {
    try {
      const key = await importKey(cached);
      state.index = await decryptJson(key, indexFile);
      state.key = key;
    } catch {
      store.del("reader.key");
      renderPassword("Passwort geändert oder falsch. Bitte neu eingeben.");
      return;
    }
  }
  if (!state.key) {
    renderPassword();
    return;
  }
  route();
}

async function unlock(password) {
  const key = await deriveKey(password, state.salt.salt, state.salt.iterations);
  const index = await decryptJson(key, state.indexFile); // wirft bei falschem Passwort
  state.key = key;
  state.index = index;
  store.set("reader.key", await exportKey(key));
}

function logout() {
  store.del("reader.key");
  state.key = null;
  state.index = null;
  state.texts.clear();
  if (location.hash !== "" && location.hash !== "#/") location.hash = "#/";
  renderPassword();
}

function renderPassword(hint = "") {
  state.current = null;
  closePopup();
  renderBar();
  const input = el("input", { type: "password", id: "password", autocomplete: "current-password", placeholder: "Passwort" });
  const error = el("p", { class: "error", text: hint });
  const button = el("button", { class: "btn", type: "submit", text: "Öffnen" });
  const form = el("form", {
    class: "gate",
    onsubmit: async (ev) => {
      ev.preventDefault();
      if (!input.value) return;
      button.disabled = true;
      button.textContent = "Prüfe…";
      error.textContent = "";
      try {
        await unlock(input.value);
        route();
      } catch (e) {
        error.textContent = /Passwort/.test(e.message) ? "Falsches Passwort." : e.message;
        button.disabled = false;
        button.textContent = "Öffnen";
        input.focus();
      }
    },
  }, [
    el("h1", { text: "Englisch lesen" }),
    el("p", { text: "Bitte das Passwort eingeben." }),
    input,
    button,
    error,
  ]);
  main.className = "view";
  main.replaceChildren(form);
  input.focus();
}

function renderMessage(title, detail = "") {
  state.current = null;
  closePopup();
  renderBar();
  main.className = "view";
  main.replaceChildren(el("div", { class: "msg" }, [el("p", { text: title }), detail ? el("p", { text: detail }) : null]));
}

// ---------- Routing ----------

function route() {
  if (!state.key) {
    renderPassword();
    return;
  }
  closePopup();
  const m = location.hash.match(/^#\/t\/([A-Za-z0-9-]+)$/);
  if (m) renderText(m[1]);
  else renderLibrary();
}

// ---------- Bibliothek ----------

function renderLibrary() {
  state.current = null;
  renderBar();
  main.className = "view library";
  const texts = (state.index && state.index.texts) || [];
  const cards = texts.map((t) => el("a", { class: "card", href: `#/t/${t.id}` }, [
    el("h2", { text: t.title }),
    el("div", { class: "meta" }, [
      t.author ? el("span", { text: t.author }) : null,
      t.source ? el("span", { text: domainOf(t.source) }) : null,
      el("span", { class: "badge", text: t.level }),
      el("span", { text: formatWords(t.wordCount) }),
      el("span", { text: formatDate(t.addedAt) }),
    ]),
    t.summary ? el("p", { text: t.summary }) : null,
  ]));
  main.replaceChildren(
    el("h1", { text: "Bibliothek" }),
    ...(cards.length ? cards : [el("p", { class: "msg", text: "Noch keine Texte. In Claude Code mit /add-text einen Text anlegen." })]),
    el("div", { class: "footer" }, [el("button", { class: "link-muted", onclick: logout, text: "Abmelden" })]),
  );
  window.scrollTo(0, 0);
}

// ---------- Leseansicht ----------

async function loadText(id) {
  if (state.texts.has(id)) return state.texts.get(id);
  const file = await fetchJson(`texts/${id}.json`);
  if (!file) throw new Error("Text nicht gefunden.");
  const text = await decryptJson(state.key, file);
  state.texts.set(id, text);
  return text;
}

async function renderText(id) {
  const meta = ((state.index && state.index.texts) || []).find((t) => t.id === id);
  main.className = "view";
  main.replaceChildren(el("p", { class: "msg", text: "Lade…" }));
  let text;
  try {
    text = await loadText(id);
  } catch (e) {
    state.current = null;
    renderBar();
    main.replaceChildren(el("div", { class: "msg" }, [
      el("p", { text: e.message }),
      el("p", {}, [el("a", { href: "#/", text: "Zurück zur Bibliothek" })]),
    ]));
    return;
  }
  if (location.hash !== `#/t/${id}`) return; // inzwischen woanders
  state.current = { id, title: text.title, glosses: text.glosses || {} };
  renderBar();
  const hasKey = (k) => has(state.current.glosses, k);
  const article = el("article", { class: "article" }, [
    el("h1", { text: text.title }),
    el("div", { class: "meta byline" }, [
      text.author ? el("span", { text: text.author }) : null,
      text.source ? sourceLink(text.source) : null,
      el("span", { class: "badge", text: text.level }),
      meta ? el("span", { text: formatWords(meta.wordCount) }) : null,
    ]),
    ...text.paragraphs.map((p) => renderParagraph(p, hasKey)),
  ]);
  main.replaceChildren(article);
  restoreScroll(id);
}

function renderParagraph(p, hasKey) {
  const frag = document.createDocumentFragment();
  for (const seg of annotate(segment(p.text), hasKey)) {
    if (seg.type === "word" || seg.type === "phrase") {
      frag.append(el("span", { class: seg.type === "phrase" ? "w phrase" : "w", "data-key": seg.key, text: seg.text }));
    } else {
      frag.append(seg.text);
    }
  }
  if (p.type === "h2") return el("h2", {}, [frag]);
  if (p.type === "quote") return el("blockquote", {}, [el("p", {}, [frag])]);
  return el("p", {}, [frag]);
}

// ---------- Leseposition ----------

let scrollTimer = 0;
window.addEventListener("scroll", () => {
  if (!state.current || scrollTimer) return;
  scrollTimer = setTimeout(() => {
    scrollTimer = 0;
    if (!state.current) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max > 0) store.set(`reader.pos.${state.current.id}`, (window.scrollY / max).toFixed(4));
  }, 250);
}, { passive: true });

function restoreScroll(id) {
  const frac = Number(store.get(`reader.pos.${id}`, "0"));
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, frac > 0 && max > 0 ? frac * max : 0);
  });
}

// ---------- Popup ----------

let hoverTimer = 0;
let leaveTimer = 0;

function lookup(key) {
  if (state.current && has(state.current.glosses, key)) return state.current.glosses[key];
  if (has(state.base, key)) return state.base[key];
  return null;
}

function fillPopup(span) {
  const g = lookup(span.dataset.key);
  popup.replaceChildren();
  if (isNarrow()) popup.append(el("button", { class: "pop-close", "aria-label": "Schließen", onclick: closePopup, text: "×" }));
  const head = el("div", { class: "pop-head" }, [el("span", { class: "pop-word", text: span.textContent })]);
  if (g && g.base) head.append(el("span", { class: "pop-base", text: `(${g.base})` }));
  if (g && g.pos) head.append(el("span", { class: "badge", text: g.pos }));
  popup.append(head);
  if (g) {
    popup.append(el("div", { class: "pop-de", text: g.de }));
    if (g.note) popup.append(el("div", { class: "pop-note", text: g.note }));
  } else {
    popup.append(el("div", { class: "pop-de muted", text: "Keine Übersetzung gespeichert." }));
  }
}

function positionPopup(span) {
  const r = span.getBoundingClientRect();
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  const margin = 8;
  const gap = 8;
  let left = r.left + r.width / 2 - pw / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
  let top = r.bottom + gap;
  if (top + ph > window.innerHeight - margin && r.top - gap - ph >= margin) top = r.top - gap - ph;
  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(top)}px`;
}

function openPopup(span, pinned) {
  if (state.popup && state.popup.span !== span) state.popup.span.classList.remove("active");
  fillPopup(span);
  span.classList.add("active");
  state.popup = { span, pinned };
  popup.hidden = false;
  if (isNarrow()) {
    popup.style.left = "";
    popup.style.top = "";
  } else {
    positionPopup(span);
  }
}

function closePopup() {
  clearTimeout(hoverTimer);
  clearTimeout(leaveTimer);
  if (!state.popup) return;
  state.popup.span.classList.remove("active");
  state.popup = null;
  popup.hidden = true;
}

main.addEventListener("click", (ev) => {
  const span = ev.target.closest(".w");
  if (!span) return;
  ev.stopPropagation();
  if (state.popup && state.popup.span === span && state.popup.pinned) {
    closePopup();
    return;
  }
  openPopup(span, true);
});

document.addEventListener("click", (ev) => {
  if (!state.popup || popup.contains(ev.target)) return;
  closePopup();
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closePopup();
});

if (hasHover()) {
  main.addEventListener("mouseover", (ev) => {
    const span = ev.target.closest(".w");
    if (!span || (state.popup && state.popup.pinned)) return;
    clearTimeout(hoverTimer);
    clearTimeout(leaveTimer);
    hoverTimer = setTimeout(() => openPopup(span, false), 250);
  });
  main.addEventListener("mouseout", (ev) => {
    if (!ev.target.closest(".w")) return;
    clearTimeout(hoverTimer);
    if (state.popup && !state.popup.pinned) leaveTimer = setTimeout(closePopup, 150);
  });
  popup.addEventListener("mouseenter", () => clearTimeout(leaveTimer));
  popup.addEventListener("mouseleave", () => {
    if (state.popup && !state.popup.pinned) closePopup();
  });
}

window.addEventListener("resize", () => {
  if (state.popup && !isNarrow()) positionPopup(state.popup.span);
});

window.addEventListener("hashchange", route);

boot();
```

- [ ] **Step 2: Syntax prüfen**

Run: `node --check docs/app.js && node --check docs/tokenizer.js && node --check docs/crypto.js`
Expected: keine Ausgabe, Exit-Code 0

- [ ] **Step 3: Startablauf ohne Texte prüfen**

Run (Server im Hintergrund, Seite abrufen, beenden):

```bash
node tools/serve.mjs 8080 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/app.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/texts/index.json
kill %1
```

Expected: `200` für `app.js`, `404` für `texts/index.json` (noch keine Texte; die App zeigt dann „Noch keine Texte veröffentlicht.")

- [ ] **Step 4: Commit**

```bash
git add docs/app.js
git commit -m "App-Logik: Passwort, Bibliothek, Leseansicht, Popup" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 16: Skill `/add-text`

**Files:**
- Create: `.claude/skills/add-text/SKILL.md`

Spec Abschnitt 9. Der Skill ist die Anleitung, nach der Claude Code Texte anlegt. Er beschreibt Ablauf, Dateiformat, Stilregeln und den Prompt für Unteragenten. Die Wörter in GROSSBUCHSTABEN im Unteragenten-Prompt sind Platzhalter, die der Skill beim Ausführen mit den echten Werten füllt.

- [ ] **Step 1: SKILL.md schreiben**

`.claude/skills/add-text/SKILL.md`:

````markdown
---
name: add-text
description: Legt einen englischen Text für den Reader an (aus URL, Datei oder eingefügtem Text), übersetzt jedes Wort im Kontext ins Deutsche, prüft und verschlüsselt. Nutzen, wenn der Nutzer einen Text hinzufügen, importieren oder übersetzen lassen will.
---

# Text hinzufügen

Eingabe (Argument oder Nachricht des Nutzers): eine URL, ein Dateipfad oder direkt eingefügter Text. Fehlt alles, nachfragen. Alle Befehle aus dem Projektstamm ausführen. Datum = heute als JJJJ-MM-TT.

## Ablauf

1. **Beschaffen.** URL: mit WebFetch laden, Prompt: „Gib den vollständigen Artikeltext wörtlich zurück: Titel, Autor, Zwischenüberschriften und alle Absätze in Originalreihenfolge. Keine Navigation, Werbung, Bildunterschriften, Kommentare oder verwandten Links. Nichts kürzen, nichts umformulieren." Scheitert das (Paywall, Blockierung, leerer Inhalt): den Nutzer bitten, den Text einzufügen oder als Datei zu speichern, und hier abbrechen. Dateipfad: Datei lesen. Eingefügter Text: direkt verwenden.
2. **Extrahieren.** Titel; Autor, falls erkennbar (sonst `""`); Absätze in Lesereihenfolge; Zwischenüberschriften als `h2`; eingerückte Zitate als `quote`. Wortlaut exakt erhalten. Jeder Absatz ist eine Zeile ohne Zeilenumbrüche. Nichts kürzen, umformulieren oder zusammenfassen.
3. **Metadaten.** `id` = Datum + `-` + Slug des Titels (Kleinbuchstaben, nur a-z, 0-9 und Bindestrich, höchstens 40 Zeichen; existiert die Datei schon, `-2` anhängen). `level` nach GER schätzen (A2 bis C2). `summary` = ein deutscher Satz zum Inhalt. `source` = URL oder Angabe des Nutzers, sonst `""`.
4. **Klartext schreiben.** `library/<id>.json` im Format unten, `glosses` ist `{}`.
5. **Wortliste.** `node tools/words.mjs library/<id>.json --chunk 150 --json` liefert Blöcke von Wortschlüsseln ohne Eintrag (Wörter der Grundliste sind schon abgezogen).
6. **Übersetzen.** Ein Block: selbst übersetzen und als `library/.parts/<id>/1.json` schreiben. Mehrere Blöcke: je Block einen Unteragenten parallel starten (Agent-Tool, `subagent_type` `general-purpose`) mit dem Prompt unten; Block `n` schreibt `library/.parts/<id>/<n>.json`. Zusätzlich in einem eigenen Teil `library/.parts/<id>/wendungen.json`: Phrasal Verbs, Redewendungen und feste Ausdrücke aus dem Text als Einträge mit Leerzeichen-Schlüssel (2 bis 4 Wörter, in Kleinschreibung, genau so aufeinander folgend wie im Text, z.B. `gave up`, nicht `give up`, wenn im Text `gave up` steht).
7. **Mergen.** `node tools/merge.mjs library/<id>.json`. Verworfene Einträge (Meldungen auf stderr) korrigieren, als neuen Teil schreiben, erneut mergen.
8. **Prüfen.** `node tools/validate.mjs library/<id>.json`. Fehlende Wörter selbst nachliefern (`library/.parts/<id>/fehlend.json`), mergen, prüfen, bis die letzte Zeile mit `OK:` beginnt. Warnungen zu Wendungen ohne Vorkommen beheben (Schlüssel an den Text anpassen oder Eintrag aus der Datei entfernen).
9. **Verschlüsseln.** `node tools/encrypt.mjs <id>`. Bei Exit-Code 2 fehlt das Passwort: den Nutzer bitten, im Terminal `npm run setup` auszuführen, danach `npm run encrypt`.
10. **Bericht.** Titel, Wortzahl, Anzahl Einträge, Niveau. Frage: „Committen und pushen?" Bei Ja: `git add docs/texts && git commit -m "Text hinzugefügt: <Titel>" && git push`.

## Format `library/<id>.json`

```json
{
  "id": "2026-09-13-the-open-window",
  "title": "The Open Window",
  "author": "Saki",
  "source": "https://example.org/the-open-window",
  "addedAt": "2026-09-13",
  "level": "B2",
  "summary": "Ein nervöser Besucher gerät an eine Nichte mit lebhafter Fantasie.",
  "paragraphs": [
    { "type": "p", "text": "Erster Absatz im Originalwortlaut." },
    { "type": "h2", "text": "Zwischenüberschrift" },
    { "type": "quote", "text": "Eingerücktes Zitat." }
  ],
  "glosses": {}
}
```

Ein Wörterbucheintrag (Schlüssel = Wort in Kleinschreibung mit geradem Apostroph, so wie `words.mjs` es ausgibt):

```json
"presently": { "de": "gleich / in Kürze", "base": "", "pos": "Adverb", "note": "Hier im älteren Sinn von 'bald', nicht 'derzeit'." }
```

- `de` (Pflicht): Bedeutung, wie das Wort in diesem Text gebraucht wird. 1 bis 6 Wörter, Varianten mit ` / `. Substantive mit Artikel („der Ausflug"), Verben im Infinitiv („zögern"), Adjektive in der Grundform.
- `base`: Grundform nur bei flektierten Formen (`ran` → `run`, `children` → `child`), sonst `""`.
- `pos`: eine Wortart aus: Substantiv, Verb, Adjektiv, Adverb, Pronomen, Präposition, Konjunktion, Artikel, Zahlwort, Interjektion, Eigenname, Phrasal Verb, Wendung, Abkürzung.
- `note`: 1 bis 2 kurze deutsche Sätze, höchstens etwa 200 Zeichen, nur wenn sie etwas bringen: Nuance, Register (förmlich, umgangssprachlich, veraltet, literarisch), Gebrauch im Satz, wörtliche gegenüber übertragener Bedeutung. Kommt das Wort im Text in zwei Bedeutungen vor, beide nennen mit Absatzangabe. Bei einfachen Wörtern `""`.

## Stilregeln

- Deutsch, knapp, nie Englisch außer dem Wort selbst.
- Eigennamen: `de` = Name mit kurzer Einordnung („Nuttel (Nachname des Besuchers)"), `pos` Eigenname.
- Abkürzungen und Zahlen mit Buchstaben (`1990s`, `mp3`) kurz erklären.
- Wörter aus `docs/base-words.json` nur eintragen, wenn sie im Text eine andere Bedeutung haben als dort (`will` als Testament, `can` als Dose).
- Jeder Schlüssel aus der Wortliste bekommt genau einen Eintrag. Keine Schlüssel erfinden, die nicht in der Liste oder als Wendung im Text stehen.

## Prompt für Unteragenten

```
Du übersetzt englische Wörter im Kontext eines Textes ins Deutsche für einen Lern-Reader.

Hier ist der vollständige Text (Absätze nummeriert):
TEXT

Übersetze GENAU diese Wörter, jedes so, wie es in diesem Text gebraucht wird:
WORTLISTE

Schreibe die Datei PFAD als JSON-Objekt. Schlüssel = das Wort exakt wie in der Liste. Wert = Objekt mit den Feldern de, base, pos, note:
- de (Pflicht): Bedeutung im Kontext, 1 bis 6 Wörter, Varianten mit " / ". Substantive mit Artikel, Verben im Infinitiv, Adjektive in Grundform.
- base: Grundform nur bei flektierten Formen (ran -> run, children -> child), sonst "".
- pos: genau eine Wortart aus: Substantiv, Verb, Adjektiv, Adverb, Pronomen, Präposition, Konjunktion, Artikel, Zahlwort, Interjektion, Eigenname, Phrasal Verb, Wendung, Abkürzung.
- note: 1 bis 2 kurze deutsche Sätze (höchstens 200 Zeichen), nur wenn hilfreich: Nuance, Register, Gebrauch im Satz, übertragene Bedeutung; bei zwei Bedeutungen im Text beide mit Absatzangabe. Sonst "".

Regeln: Deutsch, knapp, nie Englisch außer dem Wort selbst. Eigennamen mit kurzer Einordnung und pos Eigenname. Jedes Wort der Liste genau einmal, keine zusätzlichen Schlüssel. Gültiges JSON, UTF-8, keine Kommentare. Schreibe die Datei mit dem Write-Werkzeug und antworte danach nur mit der Anzahl der Einträge.
```
````

- [ ] **Step 2: Skill sichtbar machen**

Run: `ls .claude/skills/add-text/SKILL.md && head -4 .claude/skills/add-text/SKILL.md`
Expected: Pfad und die Frontmatter-Zeilen mit `name: add-text`. In einer neuen Claude-Code-Sitzung erscheint `/add-text` in der Skill-Liste.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/add-text/SKILL.md
git commit -m "Skill /add-text: Texte anlegen und übersetzen" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Beispieltext anlegen

**Files:**
- Create: `library/2026-09-13-the-open-window.json` (gitignored)
- Create (falls Passwort vorhanden): `docs/texts/*.json`

Spec Abschnitt 12: ein gemeinfreier Text, damit die Pipeline einmal vollständig läuft. Wahl: „The Open Window" von Saki (H. H. Munro, 1914, etwa 1.200 Wörter, gemeinfrei). Diese Task führt den Skill `/add-text` aus Task 16 Schritt für Schritt aus.

- [ ] **Step 1: Text beschaffen**

Run (Project Gutenberg, Sammlung „Beasts and Super-Beasts", Nr. 269):

```bash
mkdir -p "$TEMP/open-window"
curl -sL "https://www.gutenberg.org/cache/epub/269/pg269.txt" -o "$TEMP/open-window/pg269.txt"
grep -n -E "THE OPEN WINDOW|THE TREASURE-SHIP" "$TEMP/open-window/pg269.txt"
```

Expected: zwei Treffer für „THE OPEN WINDOW" (Inhaltsverzeichnis und Kapitelanfang) und zwei für die folgende Geschichte. Der Text liegt zwischen dem zweiten „THE OPEN WINDOW" und dem zweiten „THE TREASURE-SHIP". Mit `sed -n '<start>,<ende>p'` ausschneiden und lesen.

Falls die Datei nicht diese Nummer hat oder der Abruf scheitert: WebFetch auf `https://en.wikisource.org/wiki/The_Open_Window` mit dem Prompt aus dem Skill. Falls auch das scheitert: den Nutzer um einen beliebigen englischen Text bitten und den Rest der Task damit ausführen.

- [ ] **Step 2: Klartext schreiben**

`library/2026-09-13-the-open-window.json` mit `title` „The Open Window", `author` „Saki (H. H. Munro)", `source` „https://www.gutenberg.org/ebooks/269", `addedAt` „2026-09-13", `level` „B2", `summary` „Ein nervöser Besucher auf dem Land gerät an eine fünfzehnjährige Nichte mit sehr lebhafter Fantasie.", `paragraphs` = jeder Absatz der Geschichte als `{ "type": "p", "text": "..." }` (Gutenberg bricht Zeilen hart um: Zeilen eines Absatzes mit Leerzeichen zusammenfügen, Absätze sind durch Leerzeilen getrennt), `glosses` = `{}`.

Run: `node tools/validate.mjs library/2026-09-13-the-open-window.json`
Expected: `FEHLER` mit einer Liste fehlender Einträge (mehrere hundert), keine `Schema:`-Zeilen.

- [ ] **Step 3: Wortliste und Übersetzung**

Run: `node tools/words.mjs library/2026-09-13-the-open-window.json --chunk 150 --json`
Expected: etwa 3 bis 4 Blöcke.

Für jeden Block einen Unteragenten parallel starten mit dem Prompt aus `.claude/skills/add-text/SKILL.md` (TEXT = alle Absätze nummeriert, WORTLISTE = der Block als JSON-Array, PFAD = `library/.parts/2026-09-13-the-open-window/<n>.json`). Selbst dazu `library/.parts/2026-09-13-the-open-window/wendungen.json` mit den Wendungen der Geschichte anlegen (zum Beispiel `nerve cure`, `french window`, `self-possessed` ist ein Wort, keine Wendung).

- [ ] **Step 4: Mergen und prüfen**

Run:

```bash
node tools/merge.mjs library/2026-09-13-the-open-window.json
node tools/validate.mjs library/2026-09-13-the-open-window.json
```

Expected: `OK: 2026-09-13-the-open-window, <Wortzahl> Wörter, <Anzahl> Einträge`. Falls fehlende Wörter gemeldet werden: selbst als `library/.parts/2026-09-13-the-open-window/fehlend.json` nachliefern, mergen, erneut prüfen.

- [ ] **Step 5: Stichprobe lesen**

Zehn zufällige Einträge aus der Datei lesen und prüfen: deutsch, knapp, im Kontext richtig (etwa `presently` = „gleich", nicht „derzeit"), Eigennamen als Eigenname markiert. Falsche Einträge direkt in der Datei korrigieren.

- [ ] **Step 6: Verschlüsseln, falls das Passwort schon gesetzt ist**

Run: `test -f .password && node tools/encrypt.mjs 2026-09-13-the-open-window || echo "Kein .password: später npm run setup && npm run encrypt"`
Expected: entweder `verschlüsselt: 2026-09-13-the-open-window (...)` und `Index: 1 Texte`, oder der Hinweis.

- [ ] **Step 7: Commit (nur falls verschlüsselt wurde)**

```bash
git add docs/texts
git commit -m "Beispieltext: The Open Window (Saki)" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Sichtprüfung mit Screenshots

**Files:**
- Create: `tools/screenshot.mjs`
- Modify: `.gitignore` (Zeile `screenshots/` anhängen)

Entwicklungshilfe: steuert Chrome oder Edge headless über das DevTools-Protokoll (eingebautes `WebSocket` in Node 22), meldet sich mit dem Passwort an und fotografiert Passwort-Ansicht, Bibliothek, Text und Popup in drei Größen und beiden Farbschemata. Die Prüfung läuft gegen eine Wegwerf-Kopie mit Wegwerf-Passwort, damit weder das echte Passwort noch die echten verschlüsselten Dateien berührt werden.

- [ ] **Step 1: Skript schreiben**

`tools/screenshot.mjs`:

```js
// Entwicklungshilfe: Screenshots der App per Chrome/Edge headless (DevTools-Protokoll).
// Aufruf: node tools/screenshot.mjs <url> <passwort> [outDir]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, password, outDir = "screenshots"] = process.argv.slice(2);
if (!url || !password) {
  console.error("Aufruf: node tools/screenshot.mjs <url> <passwort> [outDir]");
  process.exit(2);
}

const env = process.env;
const candidates = [
  env.BROWSER_PATH,
  join(env.ProgramFiles ?? "", "Google/Chrome/Application/chrome.exe"),
  join(env["ProgramFiles(x86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
  join(env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
  join(env["ProgramFiles(x86)"] ?? "", "Microsoft/Edge/Application/msedge.exe"),
  join(env.ProgramFiles ?? "", "Microsoft/Edge/Application/msedge.exe"),
].filter((c) => c && c.length > 0);
const browser = candidates.find((c) => existsSync(c));
if (!browser) {
  console.error("Kein Chrome/Edge gefunden. Pfad in BROWSER_PATH setzen.");
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), "shot-"));
const proc = spawn(browser, [
  "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const wsBrowser = await new Promise((resolve, reject) => {
  let buf = "";
  proc.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  proc.on("exit", () => reject(new Error("Browser beendet: " + buf)));
  setTimeout(() => reject(new Error("Browser meldet keinen DevTools-Port")), 15000);
});
const port = new URL(wsBrowser).port;
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = () => reject(new Error("WebSocket-Verbindung fehlgeschlagen"));
});

let nextId = 1;
const pending = new Map();
const listeners = new Set();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method) {
    for (const l of listeners) l(msg);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const waitEvent = (method) => new Promise((resolve) => {
  const l = (msg) => {
    if (msg.method !== method) return;
    listeners.delete(l);
    resolve(msg.params);
  };
  listeners.add(l);
});
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    const detail = r.exceptionDetails.exception ? r.exceptionDetails.exception.description : "";
    throw new Error(`${r.exceptionDetails.text} ${detail}`);
  }
  return r.result.value;
}
const waitFor = (cond, ms = 20000) => evaluate(
  `new Promise((res, rej) => { const t0 = Date.now(); (function tick() {` +
  ` if (${cond}) return res(true); if (Date.now() - t0 > ${ms}) return rej(new Error("Timeout: " + ${JSON.stringify(cond)}));` +
  ` setTimeout(tick, 100); })(); })`,
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`gespeichert: ${name}.png`);
}

mkdirSync(outDir, { recursive: true });
await send("Page.enable");
const devices = [
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "tablet", width: 820, height: 1180, mobile: true },
  { name: "desktop", width: 1280, height: 800, mobile: false },
];
try {
  for (const scheme of ["light", "dark"]) {
    for (const d of devices) {
      await send("Emulation.setDeviceMetricsOverride", { width: d.width, height: d.height, deviceScaleFactor: 2, mobile: d.mobile });
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
      await send("Page.navigate", { url });
      await waitEvent("Page.loadEventFired");
      await waitFor(`document.querySelector("#password, .card, .msg")`);
      if (await evaluate(`!!document.querySelector("#password")`)) {
        await shot(`${scheme}-${d.name}-1-passwort`);
        await evaluate(`(() => { const i = document.querySelector("#password"); i.value = ${JSON.stringify(password)}; i.form.requestSubmit(); })()`);
        await waitFor(`document.querySelector(".card") || (document.querySelector(".error") || {}).textContent`);
        const error = await evaluate(`(document.querySelector(".error") || {}).textContent || ""`);
        if (error) throw new Error(`Anmeldung fehlgeschlagen: ${error}`);
      }
      await shot(`${scheme}-${d.name}-2-bibliothek`);
      const id = await evaluate(`(() => { const c = document.querySelector(".card"); return c ? c.getAttribute("href").slice(4) : ""; })()`);
      if (!id) continue;
      await evaluate(`location.hash = "#/t/" + ${JSON.stringify(id)}`);
      await waitFor(`document.querySelectorAll(".w").length > 20`);
      await sleep(400);
      await shot(`${scheme}-${d.name}-3-text`);
      await evaluate(`document.querySelectorAll(".w")[25].click()`);
      await sleep(300);
      await shot(`${scheme}-${d.name}-4-popup`);
      await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`);
    }
  }
} finally {
  ws.close();
  proc.kill();
}
process.exit(0);
```

- [ ] **Step 2: .gitignore ergänzen**

Run: `printf 'screenshots/\n' >> .gitignore && cat .gitignore`
Expected: vier Zeilen: `library/`, `.password`, `node_modules/`, `screenshots/`

- [ ] **Step 3: Wegwerf-Kopie verschlüsseln und fotografieren**

Run:

```bash
SCRATCH="$TEMP/reader-check"
rm -rf "$SCRATCH" && mkdir -p "$SCRATCH"
cp -r docs "$SCRATCH/docs" && cp -r library "$SCRATCH/library"
rm -rf "$SCRATCH/docs/texts"
READER_PASSWORD=probe-passwort node tools/encrypt.mjs --root "$SCRATCH"
node tools/serve.mjs 8123 "$SCRATCH/docs" &
sleep 1
node tools/screenshot.mjs http://localhost:8123/ probe-passwort "$SCRATCH/shots"
kill %1
ls "$SCRATCH/shots"
```

Expected: `Index: 1 Texte`, dann 24 Zeilen `gespeichert: ...png` (2 Schemata × 3 Geräte × 4 Ansichten; die Passwort-Ansicht nur beim ersten Durchlauf je Profil, also ggf. weniger).

- [ ] **Step 4: Screenshots ansehen und Prüfliste abarbeiten**

Jede PNG mit dem Read-Werkzeug öffnen. Prüfen:

- Passwort-Ansicht: Titel, Feld, Knopf zentriert; Hell warmweiß, Dunkel dunkelgrau, kein reines Schwarz.
- Bibliothek: Karte mit Titel, Autor, Domain, Badge „B2", Wortzahl mit Lesezeit, Datum, Einzeiler; „Abmelden" unten.
- Text: Kopfzeile mit „‹ Zurück", Titel (abgeschnitten mit …, falls lang), A−, A+, Schema-Schalter; Serifenschrift, Zeilenlänge etwa 65 Zeichen, kein horizontales Scrollen; auf dem Tablet breitere Spalte.
- Popup: Handy = Blatt am unteren Rand mit Schließen-Knopf; Tablet und Desktop = Kästchen nahe am Wort innerhalb des Bildschirms; Wort fett, Badge, Übersetzung, Erklärung; das angetippte Wort hinterlegt.

Bei Abweichungen `docs/styles.css` oder `docs/app.js` anpassen, Schritt 3 wiederholen. Zum Schluss `npm test` (alles grün).

- [ ] **Step 5: Commit**

```bash
git add tools/screenshot.mjs .gitignore docs/styles.css docs/app.js
git commit -m "Sichtprüfung per Screenshot-Werkzeug, Feinschliff" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: README

**Files:**
- Create: `README.md`

Spec Abschnitt 12. Zielgruppe: der Nutzer selbst, in einem Jahr, ohne Erinnerung an die Details.

- [ ] **Step 1: README schreiben**

`README.md`:

```markdown
# Englisch lesen

Englische Texte lesen und jedes Wort antippen: Ein Popup zeigt die deutsche Übersetzung, wie das Wort in diesem Text gemeint ist, dazu Grundform, Wortart und eine kurze Erklärung. Läuft als Website auf GitHub Pages, gut lesbar auf Handy, iPad und PC, mit Tag- und Nachtmodus.

Texte werden hier in Claude Code angelegt (Skill `/add-text`) und passwortverschlüsselt veröffentlicht. Auf GitHub liegt nur Datensalat; die Seite entschlüsselt im Browser, nachdem du das Passwort einmal pro Gerät eingegeben hast.

## Einmalige Einrichtung

Voraussetzungen: Node 22 oder neuer, git, ein GitHub-Konto.

1. Passwort festlegen (mindestens 12 Zeichen empfohlen):

       npm run setup

   Das Passwort landet in `.password` (nicht im Repo). Vergisst du es: `npm run setup` erneut, dann `npm run encrypt`.

2. Repo auf github.com anlegen (Name frei, öffentlich oder privat), dann:

       git remote add origin https://github.com/DEIN-NAME/DEIN-REPO.git
       git push -u origin main

3. Auf github.com im Repo unter Settings → Pages: Source „Deploy from a branch", Branch `main`, Ordner `/docs`, Save. Nach einer Minute steht dort die Adresse der Seite.

4. Auf Handy und iPad die Adresse in Safari öffnen, Passwort eingeben, dann Teilen → „Zum Home-Bildschirm". Die Seite verhält sich danach wie eine App.

## Text hinzufügen

In Claude Code, im Projektordner:

    /add-text https://beispiel.org/artikel

oder `/add-text pfad/zur/datei.txt`, oder den Text direkt in die Nachricht einfügen. Claude holt den Text, übersetzt alle Wörter im Kontext, prüft die Datei, verschlüsselt sie und fragt am Ende, ob es committen und pushen soll. Ein längerer Artikel braucht einige Minuten. Danach erscheint der Text auf allen Geräten in der Bibliothek.

Von Hand veröffentlichen:

    npm run publish

## Lokal ansehen

    npm run serve

Dann `http://localhost:8080` öffnen. (Nur `localhost` oder HTTPS funktionieren, weil die Entschlüsselung die Web-Crypto-API braucht.)

## Passwort ändern

    npm run setup
    npm run encrypt
    git add docs/texts && git commit -m "Texte neu verschlüsselt" && git push

Danach auf jedem Gerät unten in der Bibliothek „Abmelden" wählen und neu anmelden.

## Einträge korrigieren

Die Klartexte liegen in `library/<id>.json`. Einträge dort ändern, dann `npm run encrypt` und pushen. Prüfen mit `node tools/validate.mjs library/<id>.json`.

## Ordner

- `docs/` die Website (wird veröffentlicht), darin `texts/` mit den verschlüsselten Texten
- `library/` Klartexte (bleiben lokal)
- `tools/` Skripte: `setup`, `words`, `merge`, `validate`, `encrypt`, `serve`, `icons`, `fonts`
- `.claude/skills/add-text/` der Skill
- `planning/` Spezifikation und Umsetzungsplan

## Tests

    npm test

## Manuelle Prüfliste

iPhone Safari, iPad Safari, Desktop Chrome; jeweils Hell und Dunkel: Passwort-Ansicht, Bibliothek, Text öffnen, Wort tippen (Blatt bzw. Kästchen), Wendung tippen, Maus-Hover am Desktop, A−/A+, Scrollposition nach Zurück und erneutem Öffnen, Zurück-Taste des Browsers, „Zum Home-Bildschirm", Abmelden.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "README: Einrichtung und Bedienung" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: Abschluss

- [ ] **Step 1: Alle Tests**

Run: `npm test`
Expected: `# fail 0`; Summe der Tests aus den Tasks 1 bis 12 (`# pass 62`; ein anderer Wert ist nur dann in Ordnung, wenn `# fail 0` steht und die Abweichung erklärt ist).

- [ ] **Step 2: Arbeitsbaum sauber**

Run: `git status --short`
Expected: keine Ausgabe. Falls doch: prüfen, ob die Dateien in ein Commit gehören oder in `.gitignore`.

- [ ] **Step 3: Übergabe an den Nutzer**

Dem Nutzer melden, was fehlt und nur er tun kann, in dieser Reihenfolge:

1. `npm run setup` im Terminal (Passwort), danach `npm run encrypt` und `git add docs/texts && git commit -m "Texte verschlüsselt"` (falls Task 17 mangels Passwort nicht verschlüsseln konnte).
2. Repo auf github.com anlegen, `git remote add origin ...`, `git push -u origin main`.
3. Settings → Pages: Branch `main`, Ordner `/docs`.
4. Adresse auf Handy und iPad öffnen, Passwort eingeben, „Zum Home-Bildschirm".

Dazu die manuelle Prüfliste aus dem README nennen.

---

## Selbstprüfung des Plans

- **Spec-Abdeckung:** Abschnitt 3 Ordner → Tasks 1, 14, 16, 19. Abschnitt 4 Formate → Tasks 4, 5, 9. Abschnitt 5 Tokenizer → Task 2. Abschnitt 6 Web-App → Tasks 14, 15, 18 (6.4 Schrift → Task 13, Icons → Task 12). Abschnitt 7 Werkzeuge → Tasks 6 bis 13. Abschnitt 8 Verschlüsselung → Tasks 3, 9, 10. Abschnitt 9 Skill → Task 16. Abschnitt 10 Fehler → Tasks 8, 9, 15. Abschnitt 11 Tests → jede Task, manuelle Liste → Tasks 18, 19. Abschnitt 12 Veröffentlichung → Tasks 17, 19, 20. Abschnitt 13 bewusst nicht enthalten.
- **Namen über Tasks hinweg:** `segment`, `annotate`, `keysOf`, `countWords`, `normalizeKey` (Task 2) werden in Tasks 5, 15 so benutzt. `deriveKey`, `encryptJson`, `decryptJson`, `exportKey`, `importKey`, `toBase64`, `randomBytes`, `DEFAULT_ITERATIONS` (Task 3) in Tasks 9, 10, 15. `paths`, `readJson`, `writeJson`, `loadBaseWords`, `has`, `checkGloss`, `validateText`, `chunk`, `readPassword`, `ROOT` (Task 5) in Tasks 6 bis 12. `localStorage`-Schlüssel `reader.key`, `reader.theme`, `reader.fontSize`, `reader.pos.<id>` (Task 15) entsprechen Spec 6.3. Klassen `.w`, `.phrase`, `.active`, `.card`, `.gate`, `.msg`, `.error`, `.popup`, `.pop-*` in Tasks 14, 15 und 18 identisch.
- **Testsumme:** Task 1: 1, Task 2: 15, Task 3: 9, Task 4: 4, Task 5: 12, Task 6: 5, Task 7: 4, Task 8: 5, Task 9: 3, Task 10: 1, Task 11: 1, Task 12: 2 = 62. Task 20 Schritt 1 erwartet daher `# pass 62`.
