// Tokenizer, geteilt zwischen Browser (docs/app.js) und Node (tools/).
// Ein Wort: Buchstaben/Ziffern, optional mit inneren Apostrophen oder Bindestrichen.
const WORD_RE = /[\p{L}\p{N}]+(?:['’‘\-\u2010\u2011][\p{L}\p{N}]+)*/gu;
const LETTER_RE = /\p{L}/u;

/** Schlüssel für das Wörterbuch: Kleinschreibung, gerade Apostrophe, einfacher Bindestrich. */
export function normalizeKey(text) {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[\u2010\u2011]/g, "-");
}

/** Zerlegt einen Absatz lückenlos in Segmente vom Typ word, number oder other. */
export function segment(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(WORD_RE)) {
    if (m.index > last) out.push({ type: "other", text: text.slice(last, m.index) });
    const t = m[0];
    if (LETTER_RE.test(t)) out.push({ type: "word", text: t, key: normalizeKey(t) });
    else out.push({ type: "number", text: t });
    last = m.index + t.length;
  }
  if (last < text.length) out.push({ type: "other", text: text.slice(last) });
  return out;
}

/** n aufeinander folgende Wortsegmente ab i, getrennt durch je ein reines Leerraum-Segment. */
function wordRun(segments, i, n) {
  const words = [];
  let j = i;
  for (;;) {
    const s = segments[j];
    if (!s || s.type !== "word") return null;
    words.push(s);
    j++;
    if (words.length === n) return { words, end: j };
    const gap = segments[j];
    if (!gap || gap.type !== "other" || !/^\s+$/.test(gap.text)) return null;
    j++;
  }
}

/**
 * Fasst Wortfolgen zu Wendungen zusammen, wenn hasKey(zusammengesetzter Schlüssel) wahr ist.
 * Längster Treffer zuerst, von links nach rechts, keine Überlappung.
 */
export function annotate(segments, hasKey, maxWords = 4) {
  const out = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (seg.type !== "word") {
      out.push(seg);
      i++;
      continue;
    }
    let hit = null;
    for (let n = maxWords; n >= 2 && !hit; n--) {
      const run = wordRun(segments, i, n);
      if (!run) continue;
      const key = run.words.map((w) => w.key).join(" ");
      if (hasKey(key)) hit = { run, key };
    }
    if (!hit) {
      out.push(seg);
      i++;
      continue;
    }
    out.push({
      type: "phrase",
      text: segments.slice(i, hit.run.end).map((s) => s.text).join(""),
      key: hit.key,
      parts: hit.run.words,
    });
    i = hit.run.end;
  }
  return out;
}

const textOf = (p) => (typeof p === "string" ? p : p.text);

/** Alle Wortschlüssel eines Textes, sortiert und eindeutig. */
export function keysOf(paragraphs) {
  const keys = new Set();
  for (const p of paragraphs) for (const s of segment(textOf(p))) if (s.type === "word") keys.add(s.key);
  return [...keys].sort();
}

/** Anzahl der Wortsegmente eines Textes. */
export function countWords(paragraphs) {
  let n = 0;
  for (const p of paragraphs) for (const s of segment(textOf(p))) if (s.type === "word") n++;
  return n;
}
