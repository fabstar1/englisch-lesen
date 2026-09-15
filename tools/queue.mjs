// Liest und leert die Warteschlange aus queue/.
// Aufruf: node tools/queue.mjs list|show <datei>|clear <datei>... [--root DIR]
//         node tools/queue.mjs clear --all
//         node tools/queue.mjs apply-deletes   (vorgemerkte Loeschungen ausfuehren)
import { readdirSync, existsSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { paths, readJson, readPassword, ROOT } from "./lib.mjs";
import { deriveKey, decryptJson } from "../docs/crypto.js";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = rootIndex >= 0 ? args[rootIndex + 1] : ROOT;
const skip = rootIndex >= 0 ? rootIndex + 1 : -1;
const rest = args.filter((a, i) => i !== rootIndex && i !== skip);
const befehl = rest[0];
const ziele = rest.slice(1);

if (!["list", "show", "clear", "apply-deletes"].includes(befehl)) {
  console.error("Aufruf: node tools/queue.mjs list | show <datei> | clear <datei>... | clear --all | apply-deletes");
  process.exit(2);
}

const p = paths(root);
const queueDir = join(root, "queue");
const dateien = existsSync(queueDir)
  ? readdirSync(queueDir).filter((f) => f.endsWith(".json")).sort()
  : [];

if (befehl === "clear") {
  if (!ziele.length) {
    console.error("Welche Datei? Name angeben oder --all verwenden.");
    process.exit(2);
  }
  const zuLoeschen = ziele.includes("--all") ? dateien : ziele.map((z) => basename(z));
  let n = 0;
  for (const name of zuLoeschen) {
    const f = join(queueDir, name);
    if (existsSync(f)) {
      unlinkSync(f);
      n++;
      console.log(`gelöscht: ${name}`);
    } else {
      console.error(`nicht gefunden: ${name}`);
    }
  }
  console.log(`${n} Einträge entfernt, ${dateien.length - n} verbleiben`);
  process.exit(0);
}

if (dateien.length === 0) {
  if (befehl === "list") console.log("[]");
  console.error("Die Warteschlange ist leer.");
  process.exit(0);
}

let password;
try {
  password = readPassword(root);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
const saltFile = join(p.texts, "salt.json");
if (!existsSync(saltFile)) {
  console.error(`Kein ${saltFile}. Zuerst npm run setup ausführen.`);
  process.exit(2);
}
const salt = readJson(saltFile);
const key = await deriveKey(password, salt.salt, salt.iterations);

async function entschluesseln(name) {
  const eintrag = await decryptJson(key, readJson(join(queueDir, name)));
  return { file: name, ...eintrag };
}

if (befehl === "apply-deletes") {
  // Vorgemerkte Loeschungen ausfuehren: Klartext entfernen, Marke aufraeumen.
  // docs/texts/ raeumt danach encrypt.mjs auf, weil der Klartext fehlt.
  let geloescht = 0;
  let uebersprungen = 0;
  for (const name of dateien) {
    let eintrag;
    try {
      eintrag = await entschluesseln(name);
    } catch (e) {
      console.error(`${name}: ${e.message}`);
      continue;
    }
    if (eintrag.kind !== "delete") continue;
    const klartext = join(p.library, `${eintrag.id}.json`);
    if (existsSync(klartext)) {
      unlinkSync(klartext);
      console.log(`Klartext entfernt: ${eintrag.id}${eintrag.title ? ` (${eintrag.title})` : ""}`);
      geloescht++;
    } else {
      console.log(`kein Klartext vorhanden: ${eintrag.id}`);
      uebersprungen++;
    }
    unlinkSync(join(queueDir, name));
  }
  if (geloescht + uebersprungen === 0) console.error("Keine Loeschungen vorgemerkt.");
  else console.log(`${geloescht} geloescht, ${uebersprungen} ohne Klartext. Jetzt npm run encrypt ausfuehren.`);
  process.exit(0);
}

if (befehl === "show") {
  const name = basename(ziele[0] || "");
  if (!dateien.includes(name)) {
    console.error(`nicht gefunden: ${name}`);
    process.exit(1);
  }
  console.log(JSON.stringify(await entschluesseln(name), null, 2));
  process.exit(0);
}

const eintraege = [];
let fehler = 0;
for (const name of dateien) {
  try {
    eintraege.push(await entschluesseln(name));
  } catch (e) {
    console.error(`${name}: ${e.message}`);
    fehler++;
  }
}
console.log(JSON.stringify(eintraege, null, 2));
console.error(`${eintraege.length} Einträge${fehler ? `, ${fehler} nicht lesbar` : ""}`);
process.exit(fehler ? 1 : 0);
