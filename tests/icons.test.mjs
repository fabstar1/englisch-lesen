import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "../tools/make-icons.mjs";

const TOOL = fileURLToPath(new URL("../tools/make-icons.mjs", import.meta.url));
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("encodePng: Signatur, IHDR und Rohdaten", () => {
  const rgba = Buffer.alloc(2 * 2 * 4, 255);
  const png = encodePng(2, 2, rgba);
  assert.deepEqual(png.subarray(0, 8), SIGNATURE);
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 2);
  const idatLen = png.readUInt32BE(33);
  assert.equal(png.subarray(37, 41).toString("ascii"), "IDAT");
  const raw = inflateSync(png.subarray(41, 41 + idatLen));
  assert.equal(raw.length, (2 * 4 + 1) * 2);
  assert.equal(png.subarray(png.length - 8, png.length - 4).toString("ascii"), "IEND");
});

test("make-icons: schreibt drei PNGs mit richtigen Maßen", () => {
  const out = mkdtempSync(join(tmpdir(), "icons-"));
  execFileSync("node", [TOOL, "--out", out], { encoding: "utf8" });
  for (const size of [180, 192, 512]) {
    const png = readFileSync(join(out, `icon-${size}.png`));
    assert.deepEqual(png.subarray(0, 8), SIGNATURE);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});
