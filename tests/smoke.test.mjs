import { test } from "node:test";
import assert from "node:assert/strict";

test("Node-Version ist 22 oder neuer", () => {
  const major = Number(process.versions.node.split(".")[0]);
  assert.ok(major >= 22, `Node ${process.versions.node} ist zu alt`);
});
