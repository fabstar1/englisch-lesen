// Gemeinsamer Lesecode: Darstellung der Absätze und Wort-Popup (Bibliothek und öffentliche Leseseite).
import { absatzTeile } from "./lesen-logik.js?v=a5a0dc0d";

export const has = (obj, key) => obj !== null && typeof obj === "object" && Object.hasOwn(obj, key);
export const isNarrow = () => matchMedia("(max-width: 699px)").matches;

/** Element bauen: el("a", { class: "x", href: "#", text: "Hi", onclick: fn }, [kinder]) */
export function el(tag, attrs = {}, children = []) {
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

/** Absatz darstellen; Wörter aus hervorheben bekommen zusätzlich die Klasse "v". */
export function renderParagraph(p, hasKey, hervorheben = new Set()) {
  const frag = document.createDocumentFragment();
  for (const seg of absatzTeile(p.text, hasKey, hervorheben)) {
    if (seg.type === "word" || seg.type === "phrase") {
      const klasse = (seg.type === "phrase" ? "w phrase" : "w") + (seg.markiert ? " v" : "");
      frag.append(el("span", { class: klasse, "data-key": seg.key, text: seg.text }));
    } else {
      frag.append(seg.text);
    }
  }
  if (p.type === "h2") return el("h2", {}, [frag]);
  if (p.type === "quote") return el("blockquote", {}, [el("p", {}, [frag])]);
  return el("p", {}, [frag]);
}

// ---------- Popup ----------
// Öffnet nur per Klick oder Tippen, auf allen Geräten gleich. Kein Hover.

/** Wort-Popup einrichten. lookup(key) liefert die Übersetzung oder null. Gibt { close } zurück. */
export function popupEinrichten(main, popup, lookup) {
  let offen = null; // { span } des gerade geöffneten Popups

  function fillPopup(span) {
    const g = lookup(span.dataset.key);
    popup.replaceChildren();
    if (isNarrow()) popup.append(el("button", { class: "pop-close", "aria-label": "Schließen", onclick: close, text: "×" }));
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

  function open(span) {
    if (offen && offen.span !== span) offen.span.classList.remove("active");
    fillPopup(span);
    span.classList.add("active");
    offen = { span };
    popup.hidden = false;
    if (isNarrow()) {
      popup.style.left = "";
      popup.style.top = "";
    } else {
      positionPopup(span);
    }
  }

  function close() {
    if (!offen) return;
    offen.span.classList.remove("active");
    offen = null;
    popup.hidden = true;
  }

  main.addEventListener("click", (ev) => {
    const span = ev.target.closest(".w");
    if (!span) return;
    ev.stopPropagation();
    // Dasselbe Wort noch einmal antippen schließt das Popup.
    if (offen && offen.span === span) {
      close();
      return;
    }
    open(span);
  });

  document.addEventListener("click", (ev) => {
    if (!offen || popup.contains(ev.target)) return;
    close();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") close();
  });

  window.addEventListener("resize", () => {
    if (offen && !isNarrow()) positionPopup(offen.span);
  });

  return { close };
}
