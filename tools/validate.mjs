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
