// Hängt an alle Modul- und Stilverweise eine Versionskennung aus dem Dateiinhalt an.
// Dadurch lädt der Browser nach einer Änderung sofort die neue Fassung, statt bis zu
// zehn Minuten die zwischengespeicherte alte zu verwenden (GitHub Pages: max-age=600).
// Aufruf: node tools/stamp.mjs [--check] [--root DIR]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./lib.mjs";

// Dateien, deren Inhalt in die Kennung eingeht und in denen Verweise gestempelt werden.
export const DATEIEN = ["index.html", "app.js", "add.js", "github.js", "crypto.js", "tokenizer.js", "styles.css"];

/** Entfernt vorhandene Kennungen, damit die Berechnung nicht von sich selbst abhängt. */
export const ohneStempel = (text) => text.replace(/\?v=[0-9a-f]{8}/g, "");

/** Kennung aus dem Inhalt aller beteiligten Dateien. */
export function berechneVersion(inhalte) {
  const hash = createHash("sha256");
  for (const name of DATEIEN) hash.update(name + "\0" + ohneStempel(inhalte[name] ?? "") + "\0");
  return hash.digest("hex").slice(0, 8);
}

/** Setzt die Kennung an jeden Verweis auf eine der Dateien. */
export function stempeln(text, version) {
  let out = ohneStempel(text);
  for (const name of DATEIEN) {
    if (name === "index.html") continue;
    // ./name.js  oder  "name.js"  in import-Anweisungen, src- und href-Attributen
    out = out.replaceAll(`./${name}"`, `./${name}?v=${version}"`);
    out = out.replaceAll(`"${name}"`, `"${name}?v=${version}"`);
  }
  return out;
}

// Nur ausführen, wenn direkt aufgerufen. Sonst würde ein Import der Hilfsfunktionen
// (etwa aus den Tests) ungewollt die echten Dateien verändern.
const direktAufgerufen = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (direktAufgerufen) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf("--root");
  const root = rootIndex >= 0 ? args[rootIndex + 1] : ROOT;
  const nurPruefen = args.includes("--check");
  const docs = join(root, "docs");

  const inhalte = {};
  for (const name of DATEIEN) {
    const f = join(docs, name);
    if (!existsSync(f)) {
      console.error(`fehlt: docs/${name}`);
      process.exit(1);
    }
    inhalte[name] = readFileSync(f, "utf8");
  }

  const version = berechneVersion(inhalte);
  let geaendert = 0;
  for (const name of DATEIEN) {
    const neu = stempeln(inhalte[name], version);
    if (neu === inhalte[name]) continue;
    geaendert++;
    if (!nurPruefen) writeFileSync(join(docs, name), neu);
  }

  if (nurPruefen) {
    console.log(geaendert === 0 ? `Version ${version}, alles gestempelt` : `Version ${version}, ${geaendert} Dateien nicht aktuell`);
    process.exit(geaendert === 0 ? 0 : 1);
  }
  console.log(`Version ${version}${geaendert ? `, ${geaendert} Dateien aktualisiert` : ", alles war schon aktuell"}`);
}
