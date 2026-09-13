// Holt die Klartexte aus den verschlüsselten Dateien zurück nach library/.
// Nötig nach einem frischen Klon, denn library/ liegt nicht im Repo.
// Aufruf: node tools/restore.mjs [id] [--force] [--root DIR]
import { readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { paths, readJson, writeJson, readPassword, ROOT } from "./lib.mjs";
import { deriveKey, decryptJson } from "../docs/crypto.js";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = rootIndex >= 0 ? args[rootIndex + 1] : ROOT;
const skip = rootIndex >= 0 ? rootIndex + 1 : -1;
const only = args.find((a, i) => !a.startsWith("--") && i !== skip);
const force = args.includes("--force");
const p = paths(root);

let password;
try {
  password = readPassword(root);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}

const saltFile = join(p.texts, "salt.json");
if (!existsSync(saltFile)) {
  console.error(`Kein ${saltFile} gefunden. Es gibt nichts wiederherzustellen.`);
  process.exit(1);
}
const salt = readJson(saltFile);
const key = await deriveKey(password, salt.salt, salt.iterations);

const names = readdirSync(p.texts).filter(
  (n) => n.endsWith(".json") && n !== "index.json" && n !== "salt.json",
).sort();
if (names.length === 0) {
  console.log("Keine verschlüsselten Texte vorhanden.");
  process.exit(0);
}

let restored = 0;
let skipped = 0;
let failed = 0;
for (const name of names) {
  const id = basename(name, ".json");
  if (only && only !== id) continue;
  const target = join(p.library, name);
  if (existsSync(target) && !force) {
    console.log(`übersprungen (gibt es schon): ${id}`);
    skipped++;
    continue;
  }
  try {
    const text = await decryptJson(key, readJson(join(p.texts, name)));
    writeJson(target, text);
    console.log(`wiederhergestellt: ${id} (${text.title})`);
    restored++;
  } catch (e) {
    console.error(`${id}: ${e.message}`);
    failed++;
  }
}
console.log(`${restored} wiederhergestellt, ${skipped} übersprungen, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
