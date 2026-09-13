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

const published = readdirSync(p.texts).filter(
  (n) => n.endsWith(".json") && n !== "index.json" && n !== "salt.json",
);

// Schutz vor Datenverlust: library/ ist nicht im Repo. Auf einem frischen Klon ist es leer,
// und ohne diese Sperre würden alle veröffentlichten Texte als verwaist gelöscht.
if (files.length === 0 && published.length > 0) {
  console.error(`library/ ist leer, aber ${published.length} Texte sind veröffentlicht.`);
  console.error("Es wird nichts gelöscht. Klartexte zurückholen mit: npm run restore");
  process.exit(1);
}

for (const name of published) {
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
