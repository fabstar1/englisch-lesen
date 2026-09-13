// Verschlüsselung, geteilt zwischen Browser (docs/app.js) und Node (tools/encrypt.mjs).
// PBKDF2-SHA256 leitet aus dem Passwort einen AES-256-GCM-Schlüssel ab.
const subtle = globalThis.crypto.subtle;

export const DEFAULT_ITERATIONS = 310000;

export function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n) {
  // getRandomValues füllt laut Web-Crypto-Spezifikation höchstens 65536 Byte je Aufruf.
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) globalThis.crypto.getRandomValues(out.subarray(i, Math.min(i + 65536, n)));
  return out;
}

/** Leitet aus Passwort und Salt (Base64) einen exportierbaren AES-GCM-Schlüssel ab. */
export async function deriveKey(password, saltB64, iterations = DEFAULT_ITERATIONS) {
  const material = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltB64), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Verschlüsselt ein JSON-fähiges Objekt in den Container { v, iv, data }. */
export async function encryptJson(key, obj) {
  const iv = randomBytes(12);
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { v: 1, iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) };
}

/** Entschlüsselt einen Container. Wirft bei falschem Schlüssel oder beschädigten Daten. */
export async function decryptJson(key, container) {
  if (!container || container.v !== 1) throw new Error("Unbekanntes Dateiformat");
  let plain;
  try {
    plain = await subtle.decrypt({ name: "AES-GCM", iv: fromBase64(container.iv) }, key, fromBase64(container.data));
  } catch {
    throw new Error("Falsches Passwort oder beschädigte Datei");
  }
  return JSON.parse(new TextDecoder().decode(plain));
}

export async function exportKey(key) {
  return toBase64(new Uint8Array(await subtle.exportKey("raw", key)));
}

export async function importKey(b64) {
  return subtle.importKey("raw", fromBase64(b64), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}
