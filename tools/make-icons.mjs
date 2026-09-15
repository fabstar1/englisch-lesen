// Erzeugt die App-Icons als PNG ohne Abhängigkeiten.
// Aufruf: node tools/make-icons.mjs [--out DIR]
import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./lib.mjs";

const ACCENT = [184, 116, 58]; // #b8743a
const PAGE = [251, 247, 240]; // #fbf7f0
const LINE = [224, 195, 160]; // #e0c3a0

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Kodiert RGBA-Pixel (Buffer, 4 Byte je Pixel) als PNG. */
export function encodePng(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // Filtertyp: keiner
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // Farbtyp RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Liegt der Punkt im abgerundeten Rechteck? */
function inRoundRect(x, y, s) {
  if (x < s.x || y < s.y || x >= s.x + s.w || y >= s.y + s.h) return false;
  const cx = Math.max(s.x + s.r, Math.min(x, s.x + s.w - s.r));
  const cy = Math.max(s.y + s.r, Math.min(y, s.y + s.h - s.r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= s.r * s.r;
}

/** Zeichnet Formen (letzte gewinnt) mit 3x3 Subpixeln für weiche Kanten. */
function paint(size, shapes) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, covered = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          let color = null;
          for (const s of shapes) if (inRoundRect(px, py, s)) color = s.color;
          if (color) {
            r += color[0]; g += color[1]; b += color[2]; covered++;
          }
        }
      }
      const i = (y * size + x) * 4;
      if (covered > 0) {
        buf[i] = Math.round(r / covered);
        buf[i + 1] = Math.round(g / covered);
        buf[i + 2] = Math.round(b / covered);
        buf[i + 3] = Math.round((covered / (SS * SS)) * 255);
      }
    }
  }
  return buf;
}

/** Bernsteinfarbenes Quadrat mit aufgeschlagenem Buch. */
export function icon(S) {
  const shapes = [{ x: 0, y: 0, w: S, h: S, r: 0, color: ACCENT }];
  for (const px of [0.17, 0.52]) {
    shapes.push({ x: px * S, y: 0.27 * S, w: 0.31 * S, h: 0.46 * S, r: 0.04 * S, color: PAGE });
    [0.36, 0.44, 0.52, 0.6].forEach((ly, i) => {
      shapes.push({ x: (px + 0.05) * S, y: ly * S, w: (i === 3 ? 0.13 : 0.21) * S, h: 0.035 * S, r: 0.0175 * S, color: LINE });
    });
  }
  return encodePng(S, S, paint(S, shapes));
}

// Nur ausführen, wenn direkt aufgerufen, nicht beim Importieren der Hilfsfunktionen.
const direktAufgerufen = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (direktAufgerufen) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : join(ROOT, "docs", "icons");
  mkdirSync(outDir, { recursive: true });
  for (const size of [180, 192, 512]) {
    writeFileSync(join(outDir, `icon-${size}.png`), icon(size));
    console.log(`geschrieben: icon-${size}.png`);
  }
}
