import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATEIEN, ohneStempel, berechneVersion, stempeln } from "../tools/stamp.mjs";

const TOOL = fileURLToPath(new URL("../tools/stamp.mjs", import.meta.url));

/** Minimale docs/ mit denselben Verweismustern wie die echte App. */
function makeRoot(appExtra = "") {
  const root = mkdtempSync(join(tmpdir(), "stamp-"));
  mkdirSync(join(root, "docs"), { recursive: true });
  const dateien = {
    "index.html": '<link rel="stylesheet" href="styles.css">\n<script type="module" src="app.js"></script>',
    "app.js": 'import { segment } from "./tokenizer.js";\nimport { deriveKey } from "./crypto.js";\nimport { listQueue } from "./github.js";\nimport { openAddSheet } from "./add.js";\n' + appExtra,
    "add.js": 'import { encryptJson } from "./crypto.js";\nimport { getToken } from "./github.js";',
    "github.js": "export const API = 1;",
    "crypto.js": "export const K = 2;",
    "tokenizer.js": "export const T = 3;",
    "styles.css": ":root { --x: 1px; }",
  };
  for (const [name, inhalt] of Object.entries(dateien)) writeFileSync(join(root, "docs", name), inhalt);
  return root;
}
const run = (root, ...args) => spawnSync("node", [TOOL, "--root", root, ...args], { encoding: "utf8" });
const lies = (root, name) => readFileSync(join(root, "docs", name), "utf8");

test("DATEIEN enthält alle Module und die Stile", () => {
  for (const n of ["index.html", "app.js", "add.js", "github.js", "crypto.js", "tokenizer.js", "styles.css"]) {
    assert.ok(DATEIEN.includes(n), `${n} fehlt`);
  }
});

test("ohneStempel entfernt Kennungen restlos", () => {
  assert.equal(ohneStempel('import x from "./a.js?v=1a2b3c4d";'), 'import x from "./a.js";');
  assert.equal(ohneStempel('src="app.js?v=00112233"'), 'src="app.js"');
  assert.equal(ohneStempel('href="https://x/?v=abc"'), 'href="https://x/?v=abc"', "fremde Parameter bleiben");
});

test("berechneVersion ist stabil und hängt nicht vom eigenen Stempel ab", () => {
  const a = { "app.js": 'import "./crypto.js";', "crypto.js": "export const K = 2;" };
  const b = { "app.js": 'import "./crypto.js?v=deadbeef";', "crypto.js": "export const K = 2;" };
  assert.equal(berechneVersion(a), berechneVersion(b));
  assert.match(berechneVersion(a), /^[0-9a-f]{8}$/);
});

test("berechneVersion ändert sich, wenn sich eine Datei ändert", () => {
  const a = { "app.js": "eins" };
  const b = { "app.js": "zwei" };
  assert.notEqual(berechneVersion(a), berechneVersion(b));
});

test("stempeln fasst nur die eigenen Dateien an", () => {
  const text = 'import a from "./crypto.js";\nfetch("texts/index.json");\nel("a", { href: "https://github.com/x" });';
  const out = stempeln(text, "abcd1234");
  assert.ok(out.includes('"./crypto.js?v=abcd1234"'));
  assert.ok(out.includes('fetch("texts/index.json")'), "Datenpfade bleiben unberührt");
  assert.ok(out.includes('"https://github.com/x"'), "fremde Adressen bleiben unberührt");
});

test("stempeln ist wiederholbar und verdoppelt nichts", () => {
  const text = 'import a from "./crypto.js";';
  const einmal = stempeln(text, "abcd1234");
  assert.equal(stempeln(einmal, "abcd1234"), einmal);
  assert.equal(stempeln(einmal, "99999999"), 'import a from "./crypto.js?v=99999999";');
});

test("Werkzeug stempelt index.html und alle Module", () => {
  const root = makeRoot();
  const r = run(root);
  assert.equal(r.status, 0, r.stderr);
  const version = r.stdout.match(/Version ([0-9a-f]{8})/)[1];
  assert.ok(lies(root, "index.html").includes(`src="app.js?v=${version}"`));
  assert.ok(lies(root, "index.html").includes(`href="styles.css?v=${version}"`));
  assert.ok(lies(root, "app.js").includes(`"./tokenizer.js?v=${version}"`));
  assert.ok(lies(root, "app.js").includes(`"./github.js?v=${version}"`));
  assert.ok(lies(root, "add.js").includes(`"./crypto.js?v=${version}"`));
});

test("zweiter Lauf ändert nichts mehr", () => {
  const root = makeRoot();
  run(root);
  const vorher = DATEIEN.map((n) => lies(root, n));
  const r = run(root);
  assert.match(r.stdout, /alles war schon aktuell/);
  assert.deepEqual(DATEIEN.map((n) => lies(root, n)), vorher);
});

test("Änderung an einem Modul erzeugt eine neue Kennung überall", () => {
  const root = makeRoot();
  const alt = run(root).stdout.match(/Version ([0-9a-f]{8})/)[1];
  writeFileSync(join(root, "docs", "github.js"), "export const API = 2;");
  const neu = run(root).stdout.match(/Version ([0-9a-f]{8})/)[1];
  assert.notEqual(neu, alt);
  assert.ok(lies(root, "index.html").includes(`src="app.js?v=${neu}"`), "auch index.html bekommt die neue Kennung");
  assert.equal(lies(root, "app.js").includes(alt), false, "keine alte Kennung bleibt zurück");
});

test("--check meldet ungestempelte Dateien mit Exit 1 und ändert nichts", () => {
  const root = makeRoot();
  const vorher = lies(root, "app.js");
  const r = run(root, "--check");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /nicht aktuell/);
  assert.equal(lies(root, "app.js"), vorher);
});

test("--check ist zufrieden, nachdem gestempelt wurde", () => {
  const root = makeRoot();
  run(root);
  const r = run(root, "--check");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /alles gestempelt/);
});

test("fehlende Datei wird gemeldet", () => {
  const root = mkdtempSync(join(tmpdir(), "stamp-leer-"));
  mkdirSync(join(root, "docs"), { recursive: true });
  const r = run(root);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /fehlt: docs\//);
});
