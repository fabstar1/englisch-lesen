// Reader: Passwort-Ansicht, Bibliothek, Leseansicht, Popup.
import { segment, annotate } from "./tokenizer.js?v=0ae7071f";
import { deriveKey, decryptJson, encryptJson, exportKey, importKey } from "./crypto.js?v=0ae7071f";
import { listQueue, fetchQueueFile, putFile, deleteFile, queueFileName, getToken } from "./github.js?v=0ae7071f";
import { openAddSheet } from "./add.js?v=0ae7071f";

const bar = document.getElementById("bar");
const main = document.getElementById("main");
const popup = document.getElementById("popup");

const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* privater Modus */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* ignorieren */ }
  },
};

const state = {
  salt: null,
  indexFile: null,
  key: null,
  index: null,
  base: {},
  texts: new Map(), // id -> entschlüsselter Text (nur im Speicher)
  fontSize: 19,
  current: null, // { id, title, glosses } in der Leseansicht
  popup: null, // { span } des gerade geöffneten Popups
  config: null, // docs/config.json, fehlt = kein Hinzufügen möglich
  queue: [], // entschlüsselte Warteschlangen-Einträge, je { file, kind, ... }
};

const has = (obj, key) => obj !== null && typeof obj === "object" && Object.hasOwn(obj, key);
const isNarrow = () => matchMedia("(max-width: 699px)").matches;

// ---------- Hilfen ----------

/** Element bauen: el("a", { class: "x", href: "#", text: "Hi", onclick: fn }, [kinder]) */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c !== null && c !== undefined) node.append(c);
  return node;
}

function domainOf(source) {
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return source;
  }
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatWords(n) {
  return `${n.toLocaleString("de-DE")} Wörter · ca. ${Math.max(1, Math.round(n / 200))} Min`;
}

function sourceLink(source) {
  if (/^https?:\/\//.test(source)) return el("a", { href: source, target: "_blank", rel: "noopener", text: domainOf(source) });
  return el("span", { text: source });
}

async function fetchJson(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ---------- Farbschema und Schriftgröße ----------

function applyTheme() {
  const t = store.get("reader.theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === "dark";
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function toggleTheme() {
  store.set("reader.theme", isDark() ? "light" : "dark");
  applyTheme();
  renderBar();
}

function applyFontSize() {
  document.documentElement.style.setProperty("--font-size", `${state.fontSize}px`);
}

function changeFontSize(delta) {
  state.fontSize = Math.min(27, Math.max(15, state.fontSize + delta));
  store.set("reader.fontSize", String(state.fontSize));
  applyFontSize();
}

// ---------- Kopfzeile ----------

function renderBar() {
  bar.replaceChildren();
  if (!state.key) return;
  const themeBtn = el("button", {
    class: "theme",
    "aria-label": isDark() ? "Hellen Modus einschalten" : "Dunklen Modus einschalten",
    title: "Hell / Dunkel",
    onclick: toggleTheme,
    text: isDark() ? "☀" : "☾",
  });
  if (state.current) {
    bar.append(
      el("button", { class: "back", "aria-label": "Zurück zur Bibliothek", onclick: () => { location.hash = "#/"; }, text: "‹ Zurück" }),
      el("span", { class: "title", text: state.current.title }),
      el("button", { class: "a-minus", "aria-label": "Schrift kleiner", onclick: () => changeFontSize(-2), text: "A−" }),
      el("button", { class: "a-plus", "aria-label": "Schrift größer", onclick: () => changeFontSize(2), text: "A+" }),
      themeBtn,
    );
  } else {
    bar.append(el("span", { class: "title", text: "Englisch lesen" }));
    if (state.config && state.config.repo) {
      bar.append(el("button", {
        class: "add",
        "aria-label": "Text oder Link hinzufügen",
        title: "Hinzufügen",
        text: "+",
        onclick: () => openAddSheet({
          key: state.key,
          config: state.config,
          onDone: async (modus, wirdUebersetzt) => {
            renderMessage(
              modus === "url" ? "Link gespeichert." : "Text gespeichert.",
              wirdUebersetzt
                ? "Er steht in der Warteschlange und wird zuerst ins Englische übersetzt. Das macht /add-text in Claude Code."
                : "Er steht jetzt in der Warteschlange. In Claude Code holt /add-text ihn ab und übersetzt ihn.",
            );
            await loadQueue();
            setTimeout(() => { if (!state.current) renderLibrary(); }, 1400);
          },
        }),
      }));
    }
    bar.append(themeBtn);
  }
}

// ---------- Start und Passwort ----------

async function boot() {
  applyTheme();
  state.fontSize = Number(store.get("reader.fontSize", "19")) || 19;
  applyFontSize();
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    renderMessage("Web Crypto ist nicht verfügbar.", "Bitte die Seite über HTTPS oder localhost öffnen.");
    return;
  }
  const [salt, indexFile, base, config] = await Promise.all([
    fetchJson("texts/salt.json"),
    fetchJson("texts/index.json"),
    fetchJson("base-words.json"),
    fetchJson("config.json"),
  ]);
  state.base = base || {};
  state.config = config;
  if (!salt || !indexFile) {
    renderMessage("Noch keine Texte veröffentlicht.", "In Claude Code mit /add-text einen Text anlegen, dann npm run encrypt ausführen und pushen.");
    return;
  }
  state.salt = salt;
  state.indexFile = indexFile;
  const cached = store.get("reader.key");
  if (cached) {
    try {
      const key = await importKey(cached);
      state.index = await decryptJson(key, indexFile);
      state.key = key;
    } catch {
      store.del("reader.key");
      renderPassword("Passwort geändert oder falsch. Bitte neu eingeben.");
      return;
    }
  }
  if (!state.key) {
    renderPassword();
    return;
  }
  route();
  refreshQueue();
}

/** Warteschlange nachladen und die Bibliothek auffrischen, falls sie gerade offen ist. */
async function refreshQueue() {
  await loadQueue();
  if (!state.current && state.key) renderLibrary();
}

async function unlock(password) {
  const key = await deriveKey(password, state.salt.salt, state.salt.iterations);
  const index = await decryptJson(key, state.indexFile); // wirft bei falschem Passwort
  state.key = key;
  state.index = index;
  store.set("reader.key", await exportKey(key));
}

function logout() {
  store.del("reader.key");
  state.key = null;
  state.index = null;
  state.texts.clear();
  state.queue = [];
  if (location.hash !== "" && location.hash !== "#/") location.hash = "#/";
  renderPassword();
}

function renderPassword(hint = "") {
  state.current = null;
  closePopup();
  renderBar();
  const input = el("input", { type: "password", id: "password", autocomplete: "current-password", placeholder: "Passwort" });
  const error = el("p", { class: "error", text: hint });
  const button = el("button", { class: "btn", type: "submit", text: "Öffnen" });
  const form = el("form", {
    class: "gate",
    onsubmit: async (ev) => {
      ev.preventDefault();
      if (!input.value) return;
      button.disabled = true;
      button.textContent = "Prüfe…";
      error.textContent = "";
      try {
        await unlock(input.value);
        route();
        refreshQueue();
      } catch (e) {
        error.textContent = /Passwort/.test(e.message) ? "Falsches Passwort." : e.message;
        button.disabled = false;
        button.textContent = "Öffnen";
        input.focus();
      }
    },
  }, [
    el("h1", { text: "Englisch lesen" }),
    el("p", { text: "Bitte das Passwort eingeben." }),
    input,
    button,
    error,
  ]);
  main.className = "view";
  main.replaceChildren(form);
  input.focus();
}

function renderMessage(title, detail = "") {
  state.current = null;
  closePopup();
  renderBar();
  main.className = "view";
  main.replaceChildren(el("div", { class: "msg" }, [el("p", { text: title }), detail ? el("p", { text: detail }) : null]));
}

// ---------- Routing ----------

function route() {
  if (!state.key) {
    renderPassword();
    return;
  }
  closePopup();
  const t = location.hash.match(/^#\/t\/([A-Za-z0-9-]+)$/);
  if (t) return renderText(t[1]);
  const q = location.hash.match(/^#\/q\/([A-Za-z0-9.-]+)$/);
  if (q) return renderQueued(q[1]);
  renderLibrary();
}

// ---------- Warteschlange ----------

/** Holt die Warteschlange aus dem Repo und entschlüsselt sie. Fehler sind kein Drama. */
async function loadQueue() {
  if (!state.config || !state.config.repo || !state.key) {
    state.queue = [];
    return;
  }
  const dateien = await listQueue(state.config);
  const eintraege = [];
  for (const datei of dateien) {
    try {
      eintraege.push({ file: datei.name, sha: datei.sha, ...(await decryptJson(state.key, await fetchQueueFile(datei))) });
    } catch {
      /* Eintrag überspringen, etwa nach einem Passwortwechsel */
    }
  }
  state.queue = eintraege;
}

/** Löschen geht nur mit hinterlegtem Token, sonst bleibt der Knopf weg. */
function darfSchreiben() {
  return Boolean(state.config && state.config.repo && getToken());
}

/** Ids, für die eine Löschung vorgemerkt ist. Diese Texte blendet die Bibliothek aus. */
function geloeschteIds() {
  return new Set(state.queue.filter((e) => e.kind === "delete").map((e) => e.id));
}

/**
 * Merkt einen veröffentlichten Text zum Löschen vor. Der Eintrag verschwindet sofort
 * auf allen Geräten; die Dateien selbst entfernt Claude Code beim nächsten /add-text.
 */
async function loescheText(id, titel) {
  const name = queueFileName();
  const eintrag = { v: 1, kind: "delete", addedAt: new Date().toISOString(), id, title: titel };
  await putFile(state.config, `queue/${name}`, await encryptJson(state.key, eintrag), "Warteschlange: Text zum Löschen vorgemerkt");
}

/** Entfernt einen Warteschlangen-Eintrag sofort und endgültig. */
async function loescheWarteschlangenEintrag(eintrag) {
  await deleteFile(state.config, `queue/${eintrag.file}`, eintrag.sha, "Warteschlange: Eintrag entfernt");
}

/**
 * Baut den Löschen-Knopf einer Karte. Erster Klick fragt nach, zweiter löscht.
 * `ausfuehren` ist die eigentliche Löschung, `was` erscheint in der Rückfrage.
 */
function loeschKnopf(was, ausfuehren) {
  const leiste = el("div", { class: "kartenaktion" });
  const zeigeFrage = () => {
    leiste.replaceChildren(
      el("span", { class: "frage", text: `${was} löschen?` }),
      el("button", {
        type: "button",
        class: "gefahr",
        text: "Löschen",
        onclick: async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const knopf = ev.currentTarget;
          knopf.disabled = true;
          knopf.textContent = "Lösche…";
          try {
            await ausfuehren();
            await loadQueue();
            renderLibrary();
          } catch (e) {
            leiste.replaceChildren(el("span", { class: "frage fehler", text: e.message }));
          }
        },
      }),
      el("button", {
        type: "button",
        class: "abbrechen",
        text: "Abbrechen",
        onclick: (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          zeigeStart();
        },
      }),
    );
  };
  const zeigeStart = () => {
    leiste.replaceChildren(el("button", {
      type: "button",
      class: "loeschen",
      "aria-label": `${was} löschen`,
      title: "Löschen",
      text: "Löschen",
      onclick: (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        zeigeFrage();
      },
    }));
  };
  zeigeStart();
  return leiste;
}

/** Absätze aus eingefügtem Text: an Leerzeilen trennen. */
function bodyToParagraphs(body) {
  return body
    .split(/\n\s*\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((text) => ({ type: "p", text }));
}

function renderQueued(file) {
  const eintrag = state.queue.find((e) => e.file === file);
  if (!eintrag || eintrag.kind !== "text") {
    main.className = "view";
    main.replaceChildren(el("div", { class: "msg" }, [
      el("p", { text: "Dieser Eintrag ist nicht lesbar." }),
      el("p", {}, [el("a", { href: "#/", text: "Zurück zur Bibliothek" })]),
    ]));
    return;
  }
  const titel = eintrag.title || "Ohne Titel";
  state.current = { id: `q/${file}`, title: titel, glosses: {} };
  renderBar();
  const paragraphs = bodyToParagraphs(eintrag.body);
  main.className = "view";
  main.replaceChildren(el("article", { class: "article" }, [
    el("h1", { text: titel }),
    el("div", { class: "meta byline" }, [
      el("span", { class: "badge wartet", text: "noch nicht übersetzt" }),
      el("span", { text: formatWords(paragraphs.reduce((n, p) => n + segment(p.text).filter((s) => s.type === "word").length, 0)) }),
    ]),
    el("p", { class: "hinweis", text: eintrag.translate
      ? `Dieser Text ist noch auf Deutsch. In Claude Code überträgt /add-text ihn ins Englische (Niveau ${eintrag.targetLevel || "B2"}) und übersetzt dann jedes Wort.`
      : "Die Übersetzungen fehlen noch. Häufige Wörter kommen aus der Grundliste. In Claude Code holt /add-text den Text ab und übersetzt ihn vollständig." }),
    ...paragraphs.map((p) => renderParagraph(p, () => false)),
  ]));
  restoreScroll(`q/${file}`);
}

/** Karten für die Warteschlange unterhalb der fertigen Texte. */
function queueCards() {
  const sichtbar = state.queue.filter((e) => e.kind !== "delete");
  if (!sichtbar.length) return [];
  const karten = sichtbar.map((e) => {
    if (e.kind === "text") {
      const titel = e.title || "Ohne Titel";
      return el("a", { class: "card wartend", href: `#/q/${e.file}` }, [
        el("h2", { text: titel }),
        el("div", { class: "meta" }, [
          el("span", { class: "badge wartet", text: e.translate ? `wird ins Englische übersetzt, ${e.targetLevel || "B2"}` : "noch nicht übersetzt" }),
          el("span", { text: formatDate(e.addedAt.slice(0, 10)) }),
        ]),
        el("p", { text: e.body.replace(/\s+/g, " ").slice(0, 140) + (e.body.length > 140 ? "…" : "") }),
        loeschKnopf("Eintrag", () => loescheWarteschlangenEintrag(e)),
      ]);
    }
    return el("div", { class: "card wartend" }, [
      el("h2", { text: domainOf(e.url) }),
      el("div", { class: "meta" }, [
        el("span", { class: "badge wartet", text: e.translate ? `wird ins Englische übersetzt, ${e.targetLevel || "B2"}` : "wartet auf Verarbeitung" }),
        el("span", { text: formatDate(e.addedAt.slice(0, 10)) }),
      ]),
      el("p", { class: "url", text: e.url }),
      loeschKnopf("Eintrag", () => loescheWarteschlangenEintrag(e)),
    ]);
  });
  return [el("h2", { class: "abschnitt", text: "Warteschlange" }), ...karten];
}

// ---------- Bibliothek ----------

function renderLibrary() {
  state.current = null;
  renderBar();
  main.className = "view library";
  const weg = geloeschteIds();
  const texts = ((state.index && state.index.texts) || []).filter((t) => !weg.has(t.id));
  const cards = texts.map((t) => el("a", { class: "card", href: `#/t/${t.id}` }, [
    el("h2", { text: t.title }),
    el("div", { class: "meta" }, [
      t.author ? el("span", { text: t.author }) : null,
      t.source ? el("span", { text: domainOf(t.source) }) : null,
      el("span", { class: "badge", text: t.level }),
      t.translatedFrom ? el("span", { class: "badge uebersetzt", text: `aus dem ${t.translatedFrom}` }) : null,
      el("span", { text: formatWords(t.wordCount) }),
      el("span", { text: formatDate(t.addedAt) }),
    ]),
    t.summary ? el("p", { text: t.summary }) : null,
    darfSchreiben() ? loeschKnopf("Text", () => loescheText(t.id, t.title)) : null,
  ]));
  const leer = cards.length === 0 && queueCards().length === 0;
  main.replaceChildren(
    el("h1", { text: "Bibliothek" }),
    ...(leer ? [el("p", { class: "msg", text: "Noch keine Texte. Tippe oben auf + oder lege in Claude Code mit /add-text einen an." })] : cards),
    ...queueCards(),
    el("div", { class: "footer" }, [el("button", { class: "link-muted", onclick: logout, text: "Abmelden" })]),
  );
  window.scrollTo(0, 0);
}

// ---------- Leseansicht ----------

async function loadText(id) {
  if (state.texts.has(id)) return state.texts.get(id);
  const file = await fetchJson(`texts/${id}.json`);
  if (!file) throw new Error("Text nicht gefunden.");
  const text = await decryptJson(state.key, file);
  state.texts.set(id, text);
  return text;
}

async function renderText(id) {
  const meta = ((state.index && state.index.texts) || []).find((t) => t.id === id);
  main.className = "view";
  main.replaceChildren(el("p", { class: "msg", text: "Lade…" }));
  let text;
  try {
    text = await loadText(id);
  } catch (e) {
    state.current = null;
    renderBar();
    main.replaceChildren(el("div", { class: "msg" }, [
      el("p", { text: e.message }),
      el("p", {}, [el("a", { href: "#/", text: "Zurück zur Bibliothek" })]),
    ]));
    return;
  }
  if (location.hash !== `#/t/${id}`) return; // inzwischen woanders
  state.current = { id, title: text.title, glosses: text.glosses || {} };
  renderBar();
  const hasKey = (k) => has(state.current.glosses, k);
  const article = el("article", { class: "article" }, [
    el("h1", { text: text.title }),
    el("div", { class: "meta byline" }, [
      text.author ? el("span", { text: text.author }) : null,
      text.source ? sourceLink(text.source) : null,
      el("span", { class: "badge", text: text.level }),
      text.translatedFrom ? el("span", { class: "badge uebersetzt", text: `aus dem ${text.translatedFrom} übersetzt` }) : null,
      meta ? el("span", { text: formatWords(meta.wordCount) }) : null,
    ]),
    ...text.paragraphs.map((p) => renderParagraph(p, hasKey)),
  ]);
  main.replaceChildren(article);
  restoreScroll(id);
}

function renderParagraph(p, hasKey) {
  const frag = document.createDocumentFragment();
  for (const seg of annotate(segment(p.text), hasKey)) {
    if (seg.type === "word" || seg.type === "phrase") {
      frag.append(el("span", { class: seg.type === "phrase" ? "w phrase" : "w", "data-key": seg.key, text: seg.text }));
    } else {
      frag.append(seg.text);
    }
  }
  if (p.type === "h2") return el("h2", {}, [frag]);
  if (p.type === "quote") return el("blockquote", {}, [el("p", {}, [frag])]);
  return el("p", {}, [frag]);
}

// ---------- Leseposition ----------

let scrollTimer = 0;
window.addEventListener("scroll", () => {
  if (!state.current || scrollTimer) return;
  scrollTimer = setTimeout(() => {
    scrollTimer = 0;
    if (!state.current) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max > 0) store.set(`reader.pos.${state.current.id}`, (window.scrollY / max).toFixed(4));
  }, 250);
}, { passive: true });

function restoreScroll(id) {
  const frac = Number(store.get(`reader.pos.${id}`, "0"));
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, frac > 0 && max > 0 ? frac * max : 0);
  });
}

// ---------- Popup ----------
// Öffnet nur per Klick oder Tippen, auf allen Geräten gleich. Kein Hover.

function lookup(key) {
  if (state.current && has(state.current.glosses, key)) return state.current.glosses[key];
  if (has(state.base, key)) return state.base[key];
  return null;
}

function fillPopup(span) {
  const g = lookup(span.dataset.key);
  popup.replaceChildren();
  if (isNarrow()) popup.append(el("button", { class: "pop-close", "aria-label": "Schließen", onclick: closePopup, text: "×" }));
  const head = el("div", { class: "pop-head" }, [el("span", { class: "pop-word", text: span.textContent })]);
  if (g && g.base) head.append(el("span", { class: "pop-base", text: `(${g.base})` }));
  if (g && g.pos) head.append(el("span", { class: "badge", text: g.pos }));
  popup.append(head);
  if (g) {
    popup.append(el("div", { class: "pop-de", text: g.de }));
    if (g.note) popup.append(el("div", { class: "pop-note", text: g.note }));
  } else {
    popup.append(el("div", { class: "pop-de muted", text: "Keine Übersetzung gespeichert." }));
  }
}

function positionPopup(span) {
  const r = span.getBoundingClientRect();
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  const margin = 8;
  const gap = 8;
  let left = r.left + r.width / 2 - pw / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
  let top = r.bottom + gap;
  if (top + ph > window.innerHeight - margin && r.top - gap - ph >= margin) top = r.top - gap - ph;
  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(top)}px`;
}

function openPopup(span) {
  if (state.popup && state.popup.span !== span) state.popup.span.classList.remove("active");
  fillPopup(span);
  span.classList.add("active");
  state.popup = { span };
  popup.hidden = false;
  if (isNarrow()) {
    popup.style.left = "";
    popup.style.top = "";
  } else {
    positionPopup(span);
  }
}

function closePopup() {
  if (!state.popup) return;
  state.popup.span.classList.remove("active");
  state.popup = null;
  popup.hidden = true;
}

main.addEventListener("click", (ev) => {
  const span = ev.target.closest(".w");
  if (!span) return;
  ev.stopPropagation();
  // Dasselbe Wort noch einmal antippen schließt das Popup.
  if (state.popup && state.popup.span === span) {
    closePopup();
    return;
  }
  openPopup(span);
});

document.addEventListener("click", (ev) => {
  if (!state.popup || popup.contains(ev.target)) return;
  closePopup();
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closePopup();
});

window.addEventListener("resize", () => {
  if (state.popup && !isNarrow()) positionPopup(state.popup.span);
});

window.addEventListener("hashchange", route);

boot();
