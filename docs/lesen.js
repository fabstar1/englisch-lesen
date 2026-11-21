// Öffentliche Leseseite: zeigt einen Text, den die Lernspiele über eine signierte Adresse bereitstellen.
// Kein Passwort, keine Bibliothek. Die Adresse kommt aus ?text=… und muss in config.json → lesequellen stehen.
import { has, el, renderParagraph, popupEinrichten } from "./leser.js?v=a5a0dc0d";
import { quelleErlaubt, textFehler, stimmeWaehlen } from "./lesen-logik.js?v=a5a0dc0d";

const main = document.getElementById("main");
const popup = document.getElementById("popup");
const WEG = "Dieser Text ist nicht mehr verfügbar. Öffne ihn bitte neu über die Lernspiele.";
let aktuell = { glosses: {} };
let basis = {};

function meldung(text) { main.replaceChildren(el("div", { class: "msg" }, [el("p", { text })])); }

async function json(url, optionen) {
  const r = await fetch(url, optionen);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/* Stimmen kommen in manchen Browsern erst nach voiceschanged */
function stimme() {
  if (!("speechSynthesis" in window)) return Promise.resolve(null);
  const jetzt = stimmeWaehlen(speechSynthesis.getVoices());
  if (jetzt) return Promise.resolve(jetzt);
  return new Promise((fertig) => {
    const t = setTimeout(() => fertig(null), 1500);
    speechSynthesis.addEventListener("voiceschanged", () => { clearTimeout(t); fertig(stimmeWaehlen(speechSynthesis.getVoices())); }, { once: true });
  });
}

function vorlesen(text, s) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = s;
  u.lang = s.lang;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

async function start() {
  const adresse = new URLSearchParams(location.search).get("text");
  let quellen = [];
  try { quellen = (await json("config.json", { cache: "no-store" })).lesequellen || []; } catch { /* dann ist nichts erlaubt */ }
  if (!quelleErlaubt(adresse, quellen)) { meldung("Dieser Link ist ungültig. Öffne den Text bitte über die Lernspiele."); return; }
  let text;
  try {
    text = await json(adresse, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error" });
  } catch { meldung(WEG); return; }
  if (textFehler(text)) { meldung(WEG); return; }
  // Grundliste wie in der Bibliothek (app.js): gleiche Datei, bei Fehler leer.
  try { basis = await json("base-words.json", { cache: "no-store" }); } catch { basis = {}; }
  aktuell = { glosses: text.glosses || {} };
  document.title = text.title;
  const hasKey = (k) => has(aktuell.glosses, k) || has(basis, k);
  const markiert = new Set(text.hervorheben || []);
  const s = await stimme();
  const absaetze = text.paragraphs.map((p) => {
    const knoten = renderParagraph(p, hasKey, markiert);
    if (!s || p.type === "h2") return knoten;
    const knopf = el("button", { class: "vorlesen", type: "button", "aria-label": "Absatz vorlesen", text: "🔊",
                                 onclick: (ev) => { ev.stopPropagation(); vorlesen(p.text, s); } });
    return el("div", { class: "absatz" }, [knopf, knoten]);
  });
  main.replaceChildren(el("article", { class: "article" }, [
    el("h1", { text: text.title }),
    el("div", { class: "meta byline" }, [text.level ? el("span", { class: "badge", text: text.level }) : null]),
    ...absaetze,
  ]));
}

popupEinrichten(main, popup, (key) => {
  if (has(aktuell.glosses, key)) return aktuell.glosses[key];
  if (has(basis, key)) return basis[key];
  return null;
});
start();
