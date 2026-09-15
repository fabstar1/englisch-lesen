// Formular zum Hinzufügen: eine URL oder ein eingefügter Text landen verschlüsselt
// in queue/ im Repo. Claude Code übersetzt sie später.
import { encryptJson, decryptJson } from "./crypto.js?v=e377b79c";
import {
  getToken, setToken, clearToken, putFile, queueFileName, checkToken,
  fetchSharedTokenFile, SHARED_TOKEN_REPO_PATH,
} from "./github.js?v=e377b79c";

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

  // Deutsche Quelle: wird zuerst ins Englische übersetzt, dann wie üblich verglost.
  const uebersetzen = el("input", { type: "checkbox", id: "uebersetzen" });
  const niveau = el("select", { id: "niveau", hidden: "" }, [
    el("option", { value: "A2", text: "A2, sehr einfach" }),
    el("option", { value: "B1", text: "B1, einfach" }),
    el("option", { value: "B2", text: "B2, mittel" }),
    el("option", { value: "C1", text: "C1, anspruchsvoll" }),
  ]);
  niveau.value = "B2";
  const uebersetzenBereich = el("div", { class: "schalter" }, [
    el("label", { for: "uebersetzen" }, [uebersetzen, el("span", { text: " Quelle ist deutsch, ins Englische übersetzen" })]),
    el("div", { class: "niveauzeile", hidden: "" }, [el("label", { for: "niveau", text: "Englisch-Niveau: " }), niveau]),
  ]);
  uebersetzen.addEventListener("change", () => {
    uebersetzenBereich.querySelector(".niveauzeile").hidden = !uebersetzen.checked;
    niveau.hidden = !uebersetzen.checked;
  });

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
  // Bewusst kein type="password": Passwortmanager füllen solche Felder ungefragt
  // mit gespeicherten Zugangsdaten und überschreiben damit das eingefügte Token.
  // Verdeckt wird die Eingabe stattdessen per CSS (-webkit-text-security).
  const tokenFeld = el("input", {
    type: "text",
    class: "verdeckt",
    name: "reader-github-token",
    autocomplete: "off",
    autocapitalize: "off",
    autocorrect: "off",
    spellcheck: "false",
    "data-1p-ignore": "true",
    "data-lpignore": "true",
    "data-bwignore": "true",
  });
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
      : "Dieses Gerät hat noch kein Token. Entweder unten das geteilte holen oder hier eines einfügen.";
    tokenFeld.placeholder = vorhanden ? "Neues Token (nur zum Ersetzen)" : "github_pat_…";
  };
  tokenZeigen();

  /** Token verschlüsselt im Repo ablegen, damit alle Geräte es bekommen. */
  const teilen = el("button", {
    type: "button",
    class: "link-muted",
    text: "Für alle Geräte hinterlegen",
    onclick: async (ev) => {
      if (tokenFeld.value.trim()) {
        setToken(tokenFeld.value.trim());
        tokenFeld.value = "";
        tokenZeigen();
      }
      const token = getToken();
      if (!token) {
        status.className = "error";
        status.textContent = "Erst ein Token eintragen.";
        return;
      }
      ev.target.disabled = true;
      status.className = "error";
      status.textContent = "Prüfe und hinterlege…";
      try {
        const pruefung = await checkToken(config);
        if (!pruefung.ok) throw new Error(pruefung.text);
        await putFile(config, SHARED_TOKEN_REPO_PATH, await encryptJson(key, { v: 1, token }), "Token für alle Geräte hinterlegt");
        status.className = "erfolg";
        status.textContent = "Hinterlegt. Andere Geräte übernehmen es beim nächsten Öffnen, sofern dort noch keines liegt.";
      } catch (e) {
        status.className = "error";
        status.textContent = e.message;
      }
      ev.target.disabled = false;
    },
  });

  /** Geteiltes Token von diesem Gerät aus abrufen und lokal setzen. */
  const holen = el("button", {
    type: "button",
    class: "link-muted",
    text: "Geteiltes Token holen",
    onclick: async (ev) => {
      ev.target.disabled = true;
      status.className = "error";
      status.textContent = "Hole…";
      const behaelter = await fetchSharedTokenFile();
      if (!behaelter) {
        status.textContent = "Es ist kein geteiltes Token hinterlegt.";
        ev.target.disabled = false;
        return;
      }
      try {
        const { token } = await decryptJson(key, behaelter);
        setToken(token);
        tokenZeigen();
        const pruefung = await checkToken(config);
        status.className = pruefung.ok ? "erfolg" : "error";
        status.textContent = pruefung.ok ? `Übernommen. ${pruefung.text}` : pruefung.text;
      } catch {
        status.textContent = "Das geteilte Token lässt sich nicht entschlüsseln.";
      }
      ev.target.disabled = false;
    },
  });

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
      if (uebersetzen.checked) {
        eintrag.translate = true;
        eintrag.sourceLang = "Deutschen";
        eintrag.targetLevel = niveau.value;
      }
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
        onDone(modus, uebersetzen.checked);
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
    uebersetzenBereich,
    tokenBereich,
    speichern,
    status,
    el("p", { class: "klein", text: "Der Eintrag wird verschlüsselt gespeichert. In Claude Code holt /add-text ihn ab und übersetzt ihn." }),
    el("div", { class: "footer tokenlinks" }, [pruefen, teilen, holen, abmelden]),
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
