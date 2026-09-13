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
