import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("../tools/setup.mjs", import.meta.url));

test("setup: ohne Terminal Abbruch mit Hinweis, Exit 1", () => {
  const r = spawnSync("node", [TOOL], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Terminal/);
});
