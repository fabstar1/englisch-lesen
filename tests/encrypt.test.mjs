import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveKey, decryptJson } from "../docs/crypto.js";

const TOOL = fileURLToPath(new URL("../tools/encrypt.mjs", import.meta.url));
const BASE = fileURLToPath(new URL("../docs/base-words.json", import.meta.url));

function makeText(id, title, addedAt, complete = true) {
  return {
    id, title, author: "A", source: "", addedAt, level: "B1", summary: "S.",
    paragraphs: [{ type: "p", text: "The fox runs." }],
    glosses: complete
      ? { fox: { de: "der Fuchs" }, runs: { de: "rennt", base: "run" } }
      : { fox: { de: "der Fuchs" } },
  };
}

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "enc-"));
  mkdirSync(join(root, "library"), { recursive: true });
  mkdirSync(join(root, "docs", "texts"), { recursive: true });
  copyFileSync(BASE, join(root, "docs", "base-words.json"));
  const put = (t) => writeFileSync(join(root, "library", `${t.id}.json`), JSON.stringify(t));
  put(makeText("2026-09-01-alt", "Alt", "2026-09-01"));
  put(makeText("2026-09-13-neu", "Neu", "2026-09-13"));
  put(makeText("2026-09-13-kaputt", "Kaputt", "2026-09-13", false));
  writeFileSync(join(root, "docs", "texts", "2020-01-01-verwaist.json"), "{}");
  return root;
}

const run = (root, ...args) => spawnSync("node", [TOOL, "--root", root, ...args], {
  encoding: "utf8",
  env: { ...process.env, READER_PASSWORD: "test-passwort" },
});

test("encrypt: verschlüsselt gültige Texte, meldet ungültige, entfernt Verwaiste, baut Index", async () => {
  const root = makeRoot();
  const r = run(root);
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /2026-09-13-kaputt: nicht verschlüsselt/);
  const texts = join(root, "docs", "texts");
  assert.ok(existsSync(join(texts, "salt.json")));
  assert.ok(existsSync(join(texts, "2026-09-01-alt.json")));
  assert.ok(existsSync(join(texts, "2026-09-13-neu.json")));
  assert.equal(existsSync(join(texts, "2026-09-13-kaputt.json")), false);
  assert.equal(existsSync(join(texts, "2020-01-01-verwaist.json")), false);

  const salt = JSON.parse(readFileSync(join(texts, "salt.json"), "utf8"));
  assert.equal(salt.iterations, 310000);
  assert.equal(salt.kdf, "PBKDF2-SHA256");
  const key = await deriveKey("test-passwort", salt.salt, salt.iterations);
  const index = await decryptJson(key, JSON.parse(readFileSync(join(texts, "index.json"), "utf8")));
  assert.equal(index.v, 1);
  assert.deepEqual(index.texts.map((t) => t.id), ["2026-09-13-neu", "2026-09-01-alt"]);
  assert.equal(index.texts[0].wordCount, 3);
  assert.equal(index.texts[0].title, "Neu");
  const text = await decryptJson(key, JSON.parse(readFileSync(join(texts, "2026-09-13-neu.json"), "utf8")));
  assert.equal(text.paragraphs[0].text, "The fox runs.");
});

test("encrypt: nur eine id verschlüsseln, Salt bleibt gleich, Index bleibt vollständig", async () => {
  const root = makeRoot();
  run(root);
  const saltFile = join(root, "docs", "texts", "salt.json");
  const saltBefore = readFileSync(saltFile, "utf8");
  const r = run(root, "2026-09-01-alt");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /verschlüsselt: 2026-09-01-alt/);
  assert.doesNotMatch(r.stdout, /verschlüsselt: 2026-09-13-neu/);
  assert.equal(readFileSync(saltFile, "utf8"), saltBefore);
  const salt = JSON.parse(saltBefore);
  const key = await deriveKey("test-passwort", salt.salt, salt.iterations);
  const index = await decryptJson(key, JSON.parse(readFileSync(join(root, "docs", "texts", "index.json"), "utf8")));
  assert.equal(index.texts.length, 2);
});

test("encrypt: ohne Passwort Exit 2 mit Hinweis", () => {
  const root = makeRoot();
  const env = { ...process.env };
  delete env.READER_PASSWORD;
  const r = spawnSync("node", [TOOL, "--root", root], { encoding: "utf8", env });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /npm run setup/);
});
