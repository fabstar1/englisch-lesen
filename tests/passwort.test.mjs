import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { passwortFehler, tokenTeilenErlaubt, PASSWORT_MIN, TOKEN_TEILEN_MIN } from "../docs/crypto.js";
import { tokenTeilenSetzen } from "../tools/lib.mjs";

test("Passwort: ab 4 Zeichen erlaubt, also auch eine vierstellige PIN", () => {
  assert.equal(PASSWORT_MIN, 4);
  assert.equal(passwortFehler("1234"), null);
  assert.match(passwortFehler("123"), /mindestens 4/);
  assert.match(passwortFehler(""), /mindestens 4/);
});

test("Token teilen nur, wenn config.json es ausdrücklich erlaubt", () => {
  assert.equal(TOKEN_TEILEN_MIN, 12);
  assert.equal(tokenTeilenErlaubt({ repo: "a/b", tokenTeilen: true }), true);
  assert.equal(tokenTeilenErlaubt({ repo: "a/b", tokenTeilen: false }), false);
  assert.equal(tokenTeilenErlaubt({ repo: "a/b" }), false);
  assert.equal(tokenTeilenErlaubt(null), false);
});

function wurzel() {
  const root = mkdtempSync(join(tmpdir(), "el-pw-"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs", "config.json"), JSON.stringify({ repo: "a/b", branch: "main" }));
  return root;
}

test("tokenTeilenSetzen: kurzes Passwort sperrt und löscht ein hinterlegtes Token", () => {
  const root = wurzel();
  writeFileSync(join(root, "docs", "token.json"), "{}");
  assert.equal(tokenTeilenSetzen(root, "1234"), true);
  const config = JSON.parse(readFileSync(join(root, "docs", "config.json"), "utf8"));
  assert.deepEqual(config, { repo: "a/b", branch: "main", tokenTeilen: false });
  assert.equal(existsSync(join(root, "docs", "token.json")), false);
});

test("tokenTeilenSetzen: langes Passwort erlaubt das Teilen, ohne etwas zu löschen", () => {
  const root = wurzel();
  writeFileSync(join(root, "docs", "token.json"), "{}");
  assert.equal(tokenTeilenSetzen(root, "ein langes passwort"), false);
  assert.equal(JSON.parse(readFileSync(join(root, "docs", "config.json"), "utf8")).tokenTeilen, true);
  assert.equal(existsSync(join(root, "docs", "token.json")), true);
});

test("tokenTeilenSetzen: ohne config.json passiert nichts", () => {
  const root = mkdtempSync(join(tmpdir(), "el-pw-"));
  assert.equal(tokenTeilenSetzen(root, "1234"), false);
});
