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
