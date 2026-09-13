// Entwicklungshilfe: Screenshots der App per Chrome/Edge headless (DevTools-Protokoll).
// Aufruf: node tools/screenshot.mjs <url> <passwort> [outDir]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, password, outDir = "screenshots"] = process.argv.slice(2);
if (!url || !password) {
  console.error("Aufruf: node tools/screenshot.mjs <url> <passwort> [outDir]");
  process.exit(2);
}

const env = process.env;
const candidates = [
  env.BROWSER_PATH,
  join(env.ProgramFiles ?? "", "Google/Chrome/Application/chrome.exe"),
  join(env["ProgramFiles(x86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
  join(env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
  join(env["ProgramFiles(x86)"] ?? "", "Microsoft/Edge/Application/msedge.exe"),
  join(env.ProgramFiles ?? "", "Microsoft/Edge/Application/msedge.exe"),
].filter((c) => c && c.length > 0);
const browser = candidates.find((c) => existsSync(c));
if (!browser) {
  console.error("Kein Chrome/Edge gefunden. Pfad in BROWSER_PATH setzen.");
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), "shot-"));
const proc = spawn(browser, [
  "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const wsBrowser = await new Promise((resolve, reject) => {
  let buf = "";
  proc.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  proc.on("exit", () => reject(new Error("Browser beendet: " + buf)));
  setTimeout(() => reject(new Error("Browser meldet keinen DevTools-Port")), 15000);
});
const port = new URL(wsBrowser).port;
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = () => reject(new Error("WebSocket-Verbindung fehlgeschlagen"));
});

let nextId = 1;
const pending = new Map();
const listeners = new Set();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method) {
    for (const l of listeners) l(msg);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const waitEvent = (method) => new Promise((resolve) => {
  const l = (msg) => {
    if (msg.method !== method) return;
    listeners.delete(l);
    resolve(msg.params);
  };
  listeners.add(l);
});
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    const detail = r.exceptionDetails.exception ? r.exceptionDetails.exception.description : "";
    throw new Error(`${r.exceptionDetails.text} ${detail}`);
  }
  return r.result.value;
}
const waitFor = (cond, ms = 20000) => evaluate(
  `new Promise((res, rej) => { const t0 = Date.now(); (function tick() {` +
  ` if (${cond}) return res(true); if (Date.now() - t0 > ${ms}) return rej(new Error("Timeout: " + ${JSON.stringify(cond)}));` +
  ` setTimeout(tick, 100); })(); })`,
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`gespeichert: ${name}.png`);
}

mkdirSync(outDir, { recursive: true });
await send("Page.enable");
const devices = [
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "tablet", width: 820, height: 1180, mobile: true },
  { name: "desktop", width: 1280, height: 800, mobile: false },
];
try {
  for (const scheme of ["light", "dark"]) {
    for (const d of devices) {
      await send("Emulation.setDeviceMetricsOverride", { width: d.width, height: d.height, deviceScaleFactor: 2, mobile: d.mobile });
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
      await send("Page.navigate", { url });
      await waitEvent("Page.loadEventFired");
      await waitFor(`document.querySelector("#password, .card, .msg")`);
      if (await evaluate(`!!document.querySelector("#password")`)) {
        await shot(`${scheme}-${d.name}-1-passwort`);
        await evaluate(`(() => { const i = document.querySelector("#password"); i.value = ${JSON.stringify(password)}; i.form.requestSubmit(); })()`);
        await waitFor(`document.querySelector(".card") || (document.querySelector(".error") || {}).textContent`);
        const error = await evaluate(`(document.querySelector(".error") || {}).textContent || ""`);
        if (error) throw new Error(`Anmeldung fehlgeschlagen: ${error}`);
      }
      await shot(`${scheme}-${d.name}-2-bibliothek`);
      const id = await evaluate(`(() => { const c = document.querySelector(".card"); return c ? c.getAttribute("href").slice(4) : ""; })()`);
      if (!id) continue;
      await evaluate(`location.hash = "#/t/" + ${JSON.stringify(id)}`);
      await waitFor(`document.querySelectorAll(".w").length > 20`);
      await sleep(400);
      await shot(`${scheme}-${d.name}-3-text`);
      await evaluate(`document.querySelectorAll(".w")[25].click()`);
      await sleep(300);
      await shot(`${scheme}-${d.name}-4-popup`);
      await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`);
    }
  }
} finally {
  ws.close();
  proc.kill();
}
process.exit(0);
