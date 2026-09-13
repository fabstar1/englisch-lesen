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
