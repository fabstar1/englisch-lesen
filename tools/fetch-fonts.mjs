// Holt Literata (OFL) von Google Fonts nach docs/fonts/ und schreibt docs/fonts/literata.css.
// Aufruf: npm run fonts   (bei Netzwerkfehler: Warnung, Exit 0; die App nutzt dann Systemschriften)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const CSS_URL = "https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400;0,700;1,400&display=swap";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const outDir = join(ROOT, "docs", "fonts");

try {
  const res = await fetch(CSS_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const css = await res.text();
  const blocks = [...css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face \{([^}]*)\}/g)];
  const wanted = blocks.filter((m) => m[1] === "latin" || m[1] === "latin-ext");
  if (wanted.length === 0) throw new Error("Keine @font-face-Blöcke gefunden");
  mkdirSync(outDir, { recursive: true });
  const rules = [];
  for (const [, subset, body] of wanted) {
    const style = body.match(/font-style:\s*(\w+)/)[1];
    const weight = body.match(/font-weight:\s*(\d+)/)[1];
    const url = body.match(/url\((https:[^)]+\.woff2)\)/)[1];
    const range = body.match(/unicode-range:\s*([^;]+);/)[1].trim();
    const name = `literata-${weight}-${style}-${subset}.woff2`;
    const font = await fetch(url);
    if (!font.ok) throw new Error(`HTTP ${font.status} für ${name}`);
    writeFileSync(join(outDir, name), Buffer.from(await font.arrayBuffer()));
    rules.push(
      `@font-face {\n  font-family: "Literata";\n  font-style: ${style};\n  font-weight: ${weight};\n` +
      `  font-display: swap;\n  src: url("${name}") format("woff2");\n  unicode-range: ${range};\n}`,
    );
    console.log(`geholt: ${name}`);
  }
  writeFileSync(join(outDir, "literata.css"), rules.join("\n\n") + "\n");
  console.log(`geschrieben: docs/fonts/literata.css (${rules.length} Regeln)`);
} catch (e) {
  console.warn(`Schrift nicht geholt (${e.message}). Die App nutzt Systemschriften.`);
}
