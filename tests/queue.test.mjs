import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveKey, encryptJson, toBase64 } from "../docs/crypto.js";
import { utf8ToBase64, base64ToUtf8, queueFileName } from "../docs/github.js";

const TOOL = fileURLToPath(new URL("../tools/queue.mjs", import.meta.url));
const PW = { ...process.env, READER_PASSWORD: "test-passwort" };
const SALT = { v: 1, kdf: "PBKDF2-SHA256", iterations: 1000, salt: toBase64(new Uint8Array(16)) };

/** Wurzel mit Salt und optional verschlüsselten Warteschlangen-Einträgen. */
async function makeRoot(eintraege = []) {
  const root = mkdtempSync(join(tmpdir(), "queue-"));
  mkdirSync(join(root, "docs", "texts"), { recursive: true });
  writeFileSync(join(root, "docs", "texts", "salt.json"), JSON.stringify(SALT));
  if (eintraege.length) mkdirSync(join(root, "queue"), { recursive: true });
  const key = await deriveKey("test-passwort", SALT.salt, SALT.iterations);
  for (const [name, obj] of eintraege) {
    writeFileSync(join(root, "queue", name), JSON.stringify(await encryptJson(key, obj)));
  }
  return root;
}
const run = (root, ...args) => spawnSync("node", [TOOL, "--root", root, ...args], { encoding: "utf8", env: PW });

const URL_EINTRAG = { v: 1, kind: "url", addedAt: "2026-09-14T08:30:00.000Z", url: "https://example.org/a" };
const TEXT_EINTRAG = { v: 1, kind: "text", addedAt: "2026-09-14T09:00:00.000Z", title: "Über Äpfel", body: "Erster Absatz.\n\nZweiter Absatz." };

test("utf8ToBase64/base64ToUtf8: Umlaute und Emoji überstehen den Weg", () => {
  for (const s of ["einfach", "Über Äpfel und Straßen", "Zeilen\numbruch", "😀 mit Emoji", ""]) {
    assert.equal(base64ToUtf8(utf8ToBase64(s)), s);
  }
});

test("base64ToUtf8 verträgt Zeilenumbrüche, wie GitHub sie liefert", () => {
  const b64 = utf8ToBase64("Hallo Welt");
  assert.equal(base64ToUtf8(b64.slice(0, 4) + "\n" + b64.slice(4)), "Hallo Welt");
});

test("queueFileName: sortierbar, eindeutig, gültiger Dateiname", () => {
  const name = queueFileName(new Date("2026-09-14T08:30:05.123Z"), () => 0.5);
  assert.equal(name, "20260914T083005-8000.json");
  assert.match(name, /^[0-9A-Za-z-]+\.json$/);
  const frueher = queueFileName(new Date("2026-09-13T00:00:00Z"), () => 0);
  assert.ok(frueher < name, "ältere Einträge sortieren zuerst");
});

test("list: leere Warteschlange ergibt leeres Array und Exit 0", async () => {
  const r = run(await makeRoot(), "list");
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), []);
  assert.match(r.stderr, /leer/);
});

test("list: entschlüsselt Einträge und sortiert sie nach Dateinamen", async () => {
  const root = await makeRoot([
    ["20260914T090000-bbbb.json", TEXT_EINTRAG],
    ["20260914T083000-aaaa.json", URL_EINTRAG],
  ]);
  const r = run(root, "list");
  assert.equal(r.status, 0, r.stderr);
  const eintraege = JSON.parse(r.stdout);
  assert.equal(eintraege.length, 2);
  assert.deepEqual(eintraege.map((e) => e.kind), ["url", "text"]);
  assert.equal(eintraege[0].url, "https://example.org/a");
  assert.equal(eintraege[1].title, "Über Äpfel");
  assert.equal(eintraege[1].body, "Erster Absatz.\n\nZweiter Absatz.");
  assert.equal(eintraege[0].file, "20260914T083000-aaaa.json");
});

test("show: gibt einen einzelnen Eintrag aus", async () => {
  const root = await makeRoot([["20260914T083000-aaaa.json", URL_EINTRAG]]);
  const r = run(root, "show", "20260914T083000-aaaa.json");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).url, "https://example.org/a");
});

test("show: unbekannte Datei ergibt Exit 1", async () => {
  const root = await makeRoot([["20260914T083000-aaaa.json", URL_EINTRAG]]);
  assert.equal(run(root, "show", "gibtsnicht.json").status, 1);
});

test("clear: löscht genannte Dateien, lässt andere stehen", async () => {
  const root = await makeRoot([
    ["20260914T083000-aaaa.json", URL_EINTRAG],
    ["20260914T090000-bbbb.json", TEXT_EINTRAG],
  ]);
  const r = run(root, "clear", "20260914T083000-aaaa.json");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(existsSync(join(root, "queue", "20260914T083000-aaaa.json")), false);
  assert.ok(existsSync(join(root, "queue", "20260914T090000-bbbb.json")));
});

test("clear --all: leert die Warteschlange", async () => {
  const root = await makeRoot([
    ["20260914T083000-aaaa.json", URL_EINTRAG],
    ["20260914T090000-bbbb.json", TEXT_EINTRAG],
  ]);
  assert.equal(run(root, "clear", "--all").status, 0);
  assert.equal(readdirSync(join(root, "queue")).length, 0);
});

test("clear ohne Angabe ergibt Exit 2", async () => {
  assert.equal(run(await makeRoot(), "clear").status, 2);
});

test("beschädigter Eintrag wird gemeldet, der Rest kommt durch", async () => {
  const root = await makeRoot([["20260914T090000-bbbb.json", TEXT_EINTRAG]]);
  writeFileSync(join(root, "queue", "20260914T083000-kaputt.json"), JSON.stringify({ v: 1, iv: "AAAA", data: "AAAA" }));
  const r = run(root, "list");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /kaputt/);
  assert.equal(JSON.parse(r.stdout).length, 1);
});

test("ohne Passwort Exit 2 mit Hinweis", async () => {
  const root = await makeRoot([["20260914T083000-aaaa.json", URL_EINTRAG]]);
  const env = { ...process.env };
  delete env.READER_PASSWORD;
  const r = spawnSync("node", [TOOL, "--root", root, "list"], { encoding: "utf8", env });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /npm run setup/);
});

test("unbekannter Befehl ergibt Exit 2", async () => {
  assert.equal(run(await makeRoot(), "quatsch").status, 2);
});

const DELETE_EINTRAG = { v: 1, kind: "delete", addedAt: "2026-09-15T10:00:00.000Z", id: "2026-09-13-alt", title: "Alter Text" };

/** Wurzel mit Warteschlange und einer Klartextdatei in library/. */
async function makeRootMitText(eintraege, textIds = []) {
  const root = await makeRoot(eintraege);
  mkdirSync(join(root, "library"), { recursive: true });
  for (const id of textIds) writeFileSync(join(root, "library", `${id}.json`), JSON.stringify({ id }));
  return root;
}

test("apply-deletes entfernt den Klartext und die Loeschmarke", async () => {
  const root = await makeRootMitText([["20260915T100000-dddd.json", DELETE_EINTRAG]], ["2026-09-13-alt"]);
  const r = run(root, "apply-deletes");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Klartext entfernt: 2026-09-13-alt \(Alter Text\)/);
  assert.equal(existsSync(join(root, "library", "2026-09-13-alt.json")), false);
  assert.equal(existsSync(join(root, "queue", "20260915T100000-dddd.json")), false);
});

test("apply-deletes laesst andere Eintraege und Texte in Ruhe", async () => {
  const root = await makeRootMitText(
    [["20260915T100000-dddd.json", DELETE_EINTRAG], ["20260914T083000-aaaa.json", URL_EINTRAG]],
    ["2026-09-13-alt", "2026-09-14-bleibt"],
  );
  assert.equal(run(root, "apply-deletes").status, 0);
  assert.ok(existsSync(join(root, "library", "2026-09-14-bleibt.json")), "anderer Text bleibt");
  assert.ok(existsSync(join(root, "queue", "20260914T083000-aaaa.json")), "URL-Eintrag bleibt");
});

test("apply-deletes ohne Klartext raeumt die Marke trotzdem ab", async () => {
  const root = await makeRootMitText([["20260915T100000-dddd.json", DELETE_EINTRAG]], []);
  const r = run(root, "apply-deletes");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /kein Klartext vorhanden/);
  assert.equal(existsSync(join(root, "queue", "20260915T100000-dddd.json")), false);
});

test("apply-deletes ohne Loeschungen meldet das und aendert nichts", async () => {
  const root = await makeRootMitText([["20260914T083000-aaaa.json", URL_EINTRAG]], ["2026-09-14-bleibt"]);
  const r = run(root, "apply-deletes");
  assert.equal(r.status, 0);
  assert.match(r.stderr, /Keine Loeschungen vorgemerkt/);
  assert.ok(existsSync(join(root, "library", "2026-09-14-bleibt.json")));
  assert.ok(existsSync(join(root, "queue", "20260914T083000-aaaa.json")));
});

test("list zeigt Loeschmarken mit id an", async () => {
  const root = await makeRoot([["20260915T100000-dddd.json", DELETE_EINTRAG]]);
  const eintraege = JSON.parse(run(root, "list").stdout);
  assert.equal(eintraege[0].kind, "delete");
  assert.equal(eintraege[0].id, "2026-09-13-alt");
});
