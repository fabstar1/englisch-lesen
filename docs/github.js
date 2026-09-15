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

// Pfad des geteilten Tokens: im Repo unter docs/, ausgeliefert als token.json.
export const SHARED_TOKEN_REPO_PATH = "docs/token.json";
export const SHARED_TOKEN_URL = "token.json";

/** Holt den verschlüsselten Behälter mit dem geteilten Token, oder null. */
export async function fetchSharedTokenFile() {
  try {
    const r = await fetch(SHARED_TOKEN_URL, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Löscht eine Datei im Repo. `sha` stammt aus listQueue oder einer vorherigen Abfrage. */
export async function deleteFile(config, path, sha, message) {
  const token = getToken();
  if (!token) throw new Error("Kein GitHub-Token hinterlegt.");
  const branch = config.branch || "main";
  const url = `${API}/repos/${config.repo}/contents/${path}`;
  let version = sha;
  if (!version) {
    const vorhanden = await fetch(`${url}?ref=${branch}`, { headers: headers(token), cache: "no-store" });
    if (vorhanden.status === 404) return; // schon weg, nichts zu tun
    if (!vorhanden.ok) throw new Error(`GitHub meldet Fehler ${vorhanden.status}.`);
    version = (await vorhanden.json()).sha;
  }
  const r = await fetch(url, {
    method: "DELETE",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha: version, branch }),
  });
  if (r.ok || r.status === 404) return;
  if (r.status === 401 || r.status === 403) {
    const pruefung = await checkToken(config);
    throw new Error(pruefung.text);
  }
  throw new Error(`GitHub meldet Fehler ${r.status}.`);
}

/**
 * Prüft das hinterlegte Token gegen das Repository und sagt genau, was fehlt.
 * Liefert { ok, text } mit einer verständlichen deutschen Erklärung.
 */
export async function checkToken(config) {
  const token = getToken();
  if (!token) return { ok: false, text: "Auf diesem Gerät ist noch kein Token hinterlegt." };
  if (!/^gh[ps]_|^github_pat_/.test(token)) {
    return { ok: false, text: "Das sieht nicht nach einem GitHub-Token aus. Es beginnt normalerweise mit github_pat_ oder ghp_." };
  }
  let r;
  try {
    r = await fetch(`${API}/repos/${config.repo}`, { headers: headers(token), cache: "no-store" });
  } catch {
    return { ok: false, text: "Keine Verbindung zu GitHub. Ist das Gerät online?" };
  }
  if (r.status === 401) {
    return { ok: false, text: "GitHub kennt dieses Token nicht. Es ist abgelaufen, widerrufen oder beim Einfügen unvollständig kopiert worden. Bitte ein neues erstellen." };
  }
  if (r.status === 404) {
    return { ok: false, text: `Das Token darf ${config.repo} nicht sehen. Beim Erstellen unter „Repository access“ muss genau dieses Repository ausgewählt sein.` };
  }
  if (!r.ok) return { ok: false, text: `GitHub antwortet mit Fehler ${r.status}.` };

  const repo = await r.json();
  const darfSchreiben = repo.permissions && repo.permissions.push;
  if (!darfSchreiben) {
    return { ok: false, text: "Das Token darf lesen, aber nicht schreiben. Es fehlt die Berechtigung „Contents: Read and write“. Bitte im Token unter Permissions ergänzen." };
  }
  const ablauf = r.headers.get("github-authentication-token-expiration");
  const zusatz = ablauf ? ` Gültig bis ${ablauf.slice(0, 10)}.` : "";
  return { ok: true, text: `Token in Ordnung, Schreibzugriff auf ${config.repo} besteht.${zusatz}` };
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
    if (r.status === 401 || r.status === 403 || r.status === 404) {
      // Genau sagen, woran es liegt, statt nur „abgelehnt".
      const pruefung = await checkToken(config);
      throw new Error(pruefung.text);
    }
    throw new Error(`GitHub meldet Fehler ${r.status}.`);
  }
  throw new Error("Bitte noch einmal versuchen.");
}
