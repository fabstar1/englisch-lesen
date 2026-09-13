import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveKey, encryptJson, decryptJson, exportKey, importKey,
  toBase64, fromBase64, randomBytes, DEFAULT_ITERATIONS,
} from "../docs/crypto.js";

const SALT = toBase64(new Uint8Array(16)); // fester Salt für Tests
const FAST = 1000; // wenige Runden, damit die Tests schnell laufen

test("Standard sind 310.000 Runden", () => {
  assert.equal(DEFAULT_ITERATIONS, 310000);
});

test("Base64 hin und zurück, auch für große Puffer", () => {
  const bytes = randomBytes(100000);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
});

test("deriveKey ist deterministisch für gleiches Passwort und Salt", async () => {
  const a = await exportKey(await deriveKey("geheim", SALT, FAST));
  const b = await exportKey(await deriveKey("geheim", SALT, FAST));
  const c = await exportKey(await deriveKey("anders", SALT, FAST));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("encryptJson/decryptJson: Objekt kommt unverändert zurück", async () => {
  const key = await deriveKey("geheim", SALT, FAST);
  const obj = { title: "Über Äpfel", n: 3, list: ["a", "ß"], nested: { ok: true } };
  const container = await encryptJson(key, obj);
  assert.deepEqual(await decryptJson(key, container), obj);
});

test("Container hat Version 1, 12-Byte-IV und Daten", async () => {
  const key = await deriveKey("geheim", SALT, FAST);
  const c = await encryptJson(key, { x: 1 });
  assert.deepEqual(Object.keys(c).sort(), ["data", "iv", "v"]);
  assert.equal(c.v, 1);
  assert.equal(fromBase64(c.iv).length, 12);
  assert.ok(fromBase64(c.data).length > 16, "Chiffrat enthält mindestens den GCM-Tag");
});

test("Zwei Verschlüsselungen desselben Objekts unterscheiden sich (zufällige IV)", async () => {
  const key = await deriveKey("geheim", SALT, FAST);
  const a = await encryptJson(key, { x: 1 });
  const b = await encryptJson(key, { x: 1 });
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.data, b.data);
});

test("Falscher Schlüssel wirft verständlichen Fehler", async () => {
  const good = await deriveKey("geheim", SALT, FAST);
  const bad = await deriveKey("falsch", SALT, FAST);
  const c = await encryptJson(good, { x: 1 });
  await assert.rejects(decryptJson(bad, c), /Falsches Passwort/);
});

test("Unbekannte Version wird abgelehnt", async () => {
  const key = await deriveKey("geheim", SALT, FAST);
  await assert.rejects(decryptJson(key, { v: 2, iv: "", data: "" }), /Dateiformat/);
});

test("exportKey/importKey: importierter Schlüssel entschlüsselt", async () => {
  const key = await deriveKey("geheim", SALT, FAST);
  const c = await encryptJson(key, { ok: true });
  const again = await importKey(await exportKey(key));
  assert.deepEqual(await decryptJson(again, c), { ok: true });
});
