// Zugriff auf das GitHub-Repository aus dem Browser.
// Lesen geht ohne Token (öffentliches Repo), Schreiben braucht eines.
const API = "https://api.github.com";
const TOKEN_KEY = "reader.ghtoken";

/** Text als Base64, UTF-8-sicher (btoa allein verträgt keine Umlaute). */
export function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Base64 zurück zu Text. */
export function base64ToUtf8(b64) {
  const clean = b64.replace(/\s+/g, "");
  const s = atob(clean);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Dateiname für einen neuen Eintrag: Zeitstempel plus Zufall, sortierbar. */
export function queueFileName(now = new Date(), random = Math.random) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
  const suffix = Math.floor(random() * 0x10000).toString(16).padStart(4, "0");
  return `${stamp}-${suffix}.json`;
}

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* privater Modus */ }
};
export const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignorieren */ }
};

function headers(token) {
  const h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * Listet die Dateien in queue/. Ohne Token, weil das Repo öffentlich ist.
 * Liefert [] wenn der Ordner fehlt, das Netz streikt oder die Ratengrenze greift.
 */
export async function listQueue(config) {
  if (!config || !config.repo) return [];
  try {
    const r = await fetch(`${API}/repos/${config.repo}/contents/queue?ref=${config.branch || "main"}`, {
      headers: headers(getToken()),
      cache: "no-store",
    });
    if (!r.ok) return [];
    const files = await r.json();
    if (!Array.isArray(files)) return [];
    return files
      .filter((f) => f.type === "file" && f.name.endsWith(".json"))
      .sort((a, b) => (a.name < b.name ? 1 : -1));
  } catch {
    return [];
  }
}

/** Lädt den Inhalt einer Warteschlangen-Datei als Objekt. */
export async function fetchQueueFile(file) {
  const r = await fetch(file.download_url, { cache: "no-store" });
  if (!r.ok) throw new Error("Eintrag nicht ladbar");
  return r.json();
}

/**
 * Schreibt eine Datei ins Repo. Bei einem Konflikt (jemand war schneller)
 * wird einmal mit der neuen Version erneut versucht.
 */
export async function putFile(config, path, contentObject, message) {
  const token = getToken();
  if (!token) throw new Error("Kein GitHub-Token hinterlegt.");
  const url = `${API}/repos/${config.repo}/contents/${path}`;
  const body = {
    message,
    content: utf8ToBase64(JSON.stringify(contentObject)),
    branch: config.branch || "main",
  };
  for (let versuch = 0; versuch < 2; versuch++) {
    const existing = await fetch(`${url}?ref=${config.branch || "main"}`, { headers: headers(token), cache: "no-store" });
    if (existing.ok) body.sha = (await existing.json()).sha;
    const r = await fetch(url, { method: "PUT", headers: { ...headers(token), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) return r.json();
    if (r.status === 409 || r.status === 422) continue; // Konflikt: noch einmal
    if (r.status === 401 || r.status === 403) throw new Error("Token abgelehnt. Stimmen Berechtigung und Ablaufdatum?");
    if (r.status === 404) throw new Error("Repository nicht gefunden oder Token ohne Zugriff.");
    throw new Error(`GitHub meldet Fehler ${r.status}.`);
  }
  throw new Error("Bitte noch einmal versuchen.");
}
