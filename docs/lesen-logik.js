// Prüfbare Logik der öffentlichen Leseseite (ohne DOM).
import { segment, annotate } from "./tokenizer.js?v=a5a0dc0d";

const LOKAL = new Set(["localhost", "127.0.0.1"]);

/** Nur https (oder http auf localhost für die lokale Probe); Herkunft und Pfad müssen genau einem Eintrag aus lesequellen entsprechen, die Abfrage ist frei. */
export function quelleErlaubt(adresse, quellen) {
  if (typeof adresse !== "string" || adresse === "") return false;
  let url;
  try { url = new URL(adresse); } catch { return false; }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOKAL.has(url.hostname))) return false;
  const ohneAbfrage = url.origin + url.pathname;
  return (quellen || []).some((q) => ohneAbfrage === q);
}

/** Teile eines Absatzes wie annotate, Wörter zusätzlich mit markiert (Vokabel des Themas). */
export function absatzTeile(text, hasKey, hervorheben) {
  return annotate(segment(text), hasKey).map((seg) =>
    seg.type === "word" || seg.type === "phrase" ? { ...seg, markiert: hervorheben.has(seg.key) } : seg);
}

/** null, wenn der Text dargestellt werden kann, sonst ein kurzer Grund. */
export function textFehler(t) {
  if (!t || typeof t !== "object") return "kein Text";
  if (typeof t.title !== "string") return "title";
  if (!Array.isArray(t.paragraphs) || t.paragraphs.some((p) => !p || typeof p.text !== "string")) return "paragraphs";
  if (t.glosses !== undefined && (typeof t.glosses !== "object" || t.glosses === null)) return "glosses";
  if (t.hervorheben !== undefined && !Array.isArray(t.hervorheben)) return "hervorheben";
  return null;
}

/** Englische Stimme: en-GB, sonst en-US, sonst irgendeine englische, sonst null. */
export function stimmeWaehlen(stimmen) {
  const norm = (v) => String(v.lang || "").replace("_", "-").toLowerCase();
  return stimmen.find((v) => norm(v) === "en-gb") || stimmen.find((v) => norm(v) === "en-us")
    || stimmen.find((v) => norm(v).startsWith("en")) || null;
}
