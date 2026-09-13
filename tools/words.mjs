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
