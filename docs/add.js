// Formular zum Hinzufügen: eine URL oder ein eingefügter Text landen verschlüsselt
// in queue/ im Repo. Claude Code übersetzt sie später.
import { encryptJson } from "./crypto.js?v=2c4b5999";
import { getToken, setToken, clearToken, putFile, queueFileName, checkToken } from "./github.js?v=2c4b5999";

/** Element bauen, wie in app.js. */
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

const TOKEN_HILFE = "https://github.com/settings/personal-access-tokens/new";

/**
 * Zeigt das Formular. onDone() wird nach erfolgreichem Speichern gerufen.
 * key = der AES-Schlüssel der Sitzung, config = docs/config.json.
 */
export function openAddSheet({ key, config, onDone }) {
  const vorhandene = document.getElementById("addsheet");
  if (vorhandene) vorhandene.remove();

  const status = el("p", { class: "error" });
  const urlFeld = el("input", { type: "url", inputmode: "url", autocomplete: "off", placeholder: "https://…" });
  const titelFeld = el("input", { type: "text", autocomplete: "off", placeholder: "Titel (darf leer bleiben)" });
  const textFeld = el("textarea", { rows: "7", placeholder: "Text hier einfügen" });
  const speichern = el("button", { class: "btn", type: "submit", text: "Speichern" });

  let modus = "url";
  const urlBereich = el("div", {}, [urlFeld]);
  const textBereich = el("div", { hidden: "" }, [titelFeld, textFeld]);
  const tabUrl = el("button", { type: "button", class: "tab aktiv", text: "Link" });
  const tabText = el("button", { type: "button", class: "tab", text: "Text" });
  const wechseln = (neu) => {
    modus = neu;
    tabUrl.classList.toggle("aktiv", neu === "url");
    tabText.classList.toggle("aktiv", neu === "text");
    urlBereich.hidden = neu !== "url";
    textBereich.hidden = neu !== "text";
    status.textContent = "";
    (neu === "url" ? urlFeld : textFeld).focus();
  };
  tabUrl.addEventListener("click", () => wechseln("url"));
  tabText.addEventListener("click", () => wechseln("text"));

  // Token-Bereich. Ist schon eines hinterlegt, bleibt das Feld sichtbar, damit ein
  // abgelehntes Token ersetzt werden kann, ohne es vorher löschen zu müssen.
  const tokenFeld = el("input", { type: "password", autocomplete: "off" });
  const tokenText = el("p", {});
  const tokenBereich = el("div", { class: "tokenbox" }, [
    tokenText,
    tokenFeld,
    el("p", { class: "klein" }, [
      "Fine-grained Token, nur für dieses eine Repository, Berechtigung „Contents: Read and write“. ",
      el("a", { href: TOKEN_HILFE, target: "_blank", rel: "noopener", text: "Token erstellen" }),
    ]),
  ]);
  const tokenZeigen = () => {
    const vorhanden = Boolean(getToken());
    tokenText.textContent = vorhanden
      ? "Auf diesem Gerät ist ein Token hinterlegt. Zum Ersetzen hier ein neues einfügen."
      : "Zum Speichern braucht dieses Gerät einmalig ein GitHub-Token.";
    tokenFeld.placeholder = vorhanden ? "Neues Token (nur zum Ersetzen)" : "github_pat_…";
  };
  tokenZeigen();

  const pruefen = el("button", {
    type: "button",
    class: "link-muted",
    text: "Token prüfen",
    onclick: async (ev) => {
      if (tokenFeld.value.trim()) {
        setToken(tokenFeld.value.trim());
        tokenFeld.value = "";
        tokenZeigen();
      }
      ev.target.disabled = true;
      status.className = "error";
      status.textContent = "Prüfe…";
      const ergebnis = await checkToken(config);
      status.className = ergebnis.ok ? "erfolg" : "error";
      status.textContent = ergebnis.text;
      ev.target.disabled = false;
    },
  });

  const abmelden = el("button", {
    type: "button",
    class: "link-muted",
    text: "Token von diesem Gerät löschen",
    onclick: () => {
      clearToken();
      tokenZeigen();
      status.className = "error";
      status.textContent = "Token gelöscht.";
    },
  });

  const formular = el("form", {
    class: "addform",
    onsubmit: async (ev) => {
      ev.preventDefault();
      status.textContent = "";
      if (tokenFeld.value.trim()) {
        setToken(tokenFeld.value.trim());
        tokenFeld.value = "";
        tokenZeigen();
      }
      if (!getToken()) {
        status.textContent = "Bitte zuerst ein Token eintragen.";
        return;
      }
      const eintrag = { v: 1, kind: modus, addedAt: new Date().toISOString() };
      if (modus === "url") {
        const url = urlFeld.value.trim();
        if (!/^https?:\/\/\S+$/.test(url)) {
          status.textContent = "Das sieht nicht nach einer Adresse aus.";
          return;
        }
        eintrag.url = url;
      } else {
        const body = textFeld.value.trim();
        if (body.length < 40) {
          status.textContent = "Der Text ist sehr kurz. Bitte mehr einfügen.";
          return;
        }
        eintrag.title = titelFeld.value.trim();
        eintrag.body = body;
      }
      speichern.disabled = true;
      speichern.textContent = "Speichere…";
      try {
        const name = queueFileName();
        const container = await encryptJson(key, eintrag);
        await putFile(config, `queue/${name}`, container, `Warteschlange: ${modus === "url" ? "Link" : "Text"} hinzugefügt`);
        schliessen();
        onDone(modus);
      } catch (e) {
        status.textContent = e.message;
        speichern.disabled = false;
        speichern.textContent = "Speichern";
      }
    },
  }, [
    el("div", { class: "tabs" }, [tabUrl, tabText]),
    urlBereich,
    textBereich,
    tokenBereich,
    speichern,
    status,
    el("p", { class: "klein", text: "Der Eintrag wird verschlüsselt gespeichert. In Claude Code holt /add-text ihn ab und übersetzt ihn." }),
    el("div", { class: "footer" }, [pruefen, el("span", { class: "trenner", text: " · " }), abmelden]),
  ]);

  const blatt = el("div", { class: "sheet", id: "addsheet" }, [
    el("div", { class: "sheet-inner" }, [
      el("div", { class: "sheet-kopf" }, [
        el("h2", { text: "Hinzufügen" }),
        el("button", { type: "button", class: "pop-close", "aria-label": "Schließen", onclick: () => schliessen(), text: "×" }),
      ]),
      formular,
    ]),
  ]);
  blatt.addEventListener("click", (ev) => {
    if (ev.target === blatt) schliessen();
  });

  function schliessen() {
    document.removeEventListener("keydown", beiEscape);
    blatt.remove();
  }
  function beiEscape(ev) {
    if (ev.key === "Escape") schliessen();
  }
  document.addEventListener("keydown", beiEscape);
  document.body.append(blatt);
  wechseln("url");
}
