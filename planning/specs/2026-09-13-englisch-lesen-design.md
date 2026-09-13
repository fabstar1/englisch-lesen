# Englisch-Lesen: Design-Spezifikation

Stand: 2026-09-13. Freigegeben im Brainstorming mit dem Nutzer.

## 1. Ziel

Eine Web-App zum Englischlernen durch Lesen. Der Nutzer liest englische Texte auf Handy, iPad oder PC und tippt auf ein beliebiges Wort. Ein Popup zeigt die deutsche Übersetzung, wie das Wort in diesem Text gemeint ist, plus Grundform, Wortart und eine kurze Erklärung. Texte kommen per URL oder als eingefügter Text ins System; die KI extrahiert und übersetzt.

## 2. Entscheidungen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Wo läuft die KI? | In Claude Code, über einen Projekt-Skill `/add-text`. Die Web-App selbst ruft keine KI auf. | Der Nutzer will sein Claude-Abo nutzen, keinen API-Key. Das Abo deckt Claude Code ab, nicht API-Aufrufe aus dem Browser. |
| Hosting | GitHub Pages, Ordner `docs/` auf Branch `main`. | Kostenlos, HTTPS, überall erreichbar, Deploy per `git push`. |
| Zugriffsschutz | Texte werden lokal mit einem Passwort verschlüsselt (AES-256-GCM, Schlüssel per PBKDF2) und nur verschlüsselt committet. Die Seite entschlüsselt im Browser. | GitHub Pages kann keinen Passwortschutz. Verschlüsselung im Browser ist rein statisch und kostet nichts. |
| Datenmodell | Wörterbuch pro Text: jedes vorkommende Wort einmal, übersetzt im Kontext dieses Textes. Wendungen (z.B. `give up`) als eigene Einträge. | Kleine Dateien, von Hand korrigierbar, einfache Erzeugung. Grenze: ein Wort mit zwei Bedeutungen im selben Text bekommt einen Eintrag, der beide nennt. |
| Technik | Statisches HTML/CSS/JS ohne Framework, ohne Build-Schritt, ohne npm-Abhängigkeiten. Node 22 nur für lokale Werkzeuge. | So wenig bewegliche Teile wie möglich. |
| Ablage der Planung | `planning/` statt `docs/superpowers/`. | `docs/` ist die veröffentlichte Website. |

## 3. Ordnerstruktur

```
Englisch-Lesen/
├── docs/                      # Website (GitHub Pages root)
│   ├── index.html             # App-Gerüst, lädt app.js als ES-Modul
│   ├── app.js                 # UI, Routing, Zustand, Popup
│   ├── styles.css             # Layout, Typografie, Hell/Dunkel
│   ├── tokenizer.js           # Tokenizer, geteilt mit Node-Werkzeugen
│   ├── crypto.js              # Schlüsselableitung + AES-GCM, geteilt mit Node
│   ├── base-words.json        # Grundliste häufiger Funktionswörter
│   ├── manifest.webmanifest   # "Zum Home-Bildschirm"
│   ├── icons/                 # icon-180.png, icon-192.png, icon-512.png
│   ├── fonts/                 # Literata (woff2), falls beschaffbar
│   └── texts/
│       ├── salt.json          # KDF-Parameter (öffentlich)
│       ├── index.json         # verschlüsselter Index
│       └── <id>.json          # verschlüsselter Text
├── library/                   # Klartexte (gitignored)
│   ├── <id>.json
│   └── .parts/<id>/<n>.json   # Zwischenstände beim Übersetzen
├── tools/                     # Node-Skripte, keine Abhängigkeiten
│   ├── setup.mjs              # Passwort festlegen, Salt anlegen (interaktiv)
│   ├── words.mjs              # Wortliste eines Textes ausgeben
│   ├── merge.mjs              # Übersetzungs-Teile in den Text mergen
│   ├── validate.mjs           # Schema und Abdeckung prüfen
│   ├── encrypt.mjs            # library/ -> docs/texts/ verschlüsseln, Index bauen
│   ├── serve.mjs              # lokaler Server für docs/
│   └── make-icons.mjs         # PNG-Icons erzeugen
├── tests/                     # node --test
├── .claude/skills/add-text/SKILL.md
├── planning/specs/            # diese Spezifikation
├── planning/plans/            # Umsetzungsplan
├── .password                  # lokales Passwort (gitignored)
├── .gitignore
├── package.json               # "type": "module", npm-Skripte
└── README.md                  # Bedienung auf Deutsch
```

`.gitignore` enthält: `library/`, `.password`, `node_modules/`.

## 4. Datenformate

### 4.1 Klartext `library/<id>.json`

```json
{
  "id": "2026-09-13-the-open-window",
  "title": "The Open Window",
  "author": "Saki (H. H. Munro)",
  "source": "https://en.wikisource.org/wiki/The_Open_Window",
  "addedAt": "2026-09-13",
  "level": "B2",
  "summary": "Ein nervöser Besucher auf dem Land gerät an eine Nichte mit lebhafter Fantasie.",
  "paragraphs": [
    { "type": "h2", "text": "Part One" },
    { "type": "p", "text": "\"My aunt will be down presently, Mr. Nuttel,\" said a very self-possessed young lady of fifteen." },
    { "type": "quote", "text": "An indented quotation would go here." }
  ],
  "glosses": {
    "presently": { "de": "gleich / in Kürze", "base": "", "pos": "Adverb", "note": "Hier im älteren Sinn von 'bald', nicht 'derzeit'." },
    "self-possessed": { "de": "selbstbeherrscht, souverän", "base": "", "pos": "Adjektiv", "note": "" },
    "give up": { "de": "aufgeben", "base": "", "pos": "Phrasal Verb", "note": "" }
  }
}
```

Felder:

- `id`: `JJJJ-MM-TT-slug`. Slug = Titel in Kleinbuchstaben, nur `a-z0-9-`, höchstens 40 Zeichen. Bei Kollision `-2`, `-3` anhängen.
- `title`, `author`, `source`: Strings. `author` und `source` dürfen leer sein. `source` ist eine URL oder eine Quellenangabe.
- `addedAt`: `JJJJ-MM-TT`.
- `level`: eins aus `A2`, `B1`, `B2`, `C1`, `C2` (Schätzung der KI).
- `summary`: ein deutscher Satz.
- `paragraphs`: Liste in Lesereihenfolge. `type` ist `h2` (Zwischenüberschrift), `p` (Absatz) oder `quote` (Zitat/eingerückt). `text` ist der Originalwortlaut ohne Zeilenumbrüche.
- `glosses`: Objekt. Schlüssel = Wortschlüssel laut Tokenizer (Abschnitt 5) oder Wendung (2 bis 4 Schlüssel durch je ein Leerzeichen). Wert:
  - `de` (Pflicht): Übersetzung im Kontext, 1 bis 6 Wörter, Varianten mit ` / ` getrennt. Substantive mit Artikel, Verben im Infinitiv.
  - `base` (optional): Grundform, wenn das Wort flektiert ist (`ran` -> `run`, `children` -> `child`). Leer, wenn identisch.
  - `pos` (optional): eine Wortart aus: Substantiv, Verb, Adjektiv, Adverb, Pronomen, Präposition, Konjunktion, Artikel, Zahlwort, Interjektion, Eigenname, Phrasal Verb, Wendung, Abkürzung.
  - `note` (optional): 1 bis 2 kurze deutsche Sätze, höchstens etwa 200 Zeichen. Nuance, Register (förmlich, umgangssprachlich, veraltet, literarisch), Gebrauch im Satz, bei Mehrdeutigkeit im Text beide Bedeutungen mit Absatzangabe.

`wordCount` wird nicht gespeichert, sondern beim Verschlüsseln berechnet.

### 4.2 Grundliste `docs/base-words.json`

Objekt mit etwa 250 sehr häufigen Funktionswörtern und Kurzformen (Artikel, Pronomen, Präpositionen, Konjunktionen, Hilfs- und Modalverben samt Formen, Kurzformen wie `don't`, `it's`, `i'll`, häufige Adverbien wie `very`, `also`, `never`, Determinierer wie `some`, `every`, `other`, Zahlwörter eins bis zehn). Werte haben dieselbe Form wie Gloss-Einträge (`de`, `pos`, optional `note`). Beim Nachschlagen gewinnt der Text-Eintrag vor der Grundliste, so kann ein Text `will` als „das Testament" überschreiben.

### 4.3 Verschlüsselte Dateien

`docs/texts/salt.json` (Klartext):

```json
{ "v": 1, "kdf": "PBKDF2-SHA256", "iterations": 310000, "salt": "<base64, 16 Bytes>" }
```

`docs/texts/index.json` und `docs/texts/<id>.json` (Container):

```json
{ "v": 1, "iv": "<base64, 12 Bytes>", "data": "<base64, Chiffrat inkl. GCM-Tag>" }
```

Klartext des Containers ist der jeweilige JSON-Text in UTF-8. Entschlüsselter Index:

```json
{
  "v": 1,
  "generatedAt": "2026-09-13T20:15:00Z",
  "texts": [
    { "id": "...", "title": "...", "author": "...", "source": "...", "addedAt": "...", "level": "B2", "summary": "...", "wordCount": 1240 }
  ]
}
```

Sortierung: `addedAt` absteigend, dann `title` aufsteigend.

## 5. Tokenizer (`docs/tokenizer.js`)

Ein ES-Modul, das Browser und Node identisch nutzen. Damit passen die Schlüssel im Wörterbuch exakt zu den anklickbaren Wörtern.

- `segment(text)` zerlegt einen Absatz lückenlos in Segmente. Die Verkettung aller `text`-Felder ergibt wieder die Eingabe.
  - `{ type: "word", text, key }`: Ein Wort ist eine Folge aus Buchstaben oder Ziffern (Unicode), optional mit inneren Apostrophen oder Bindestrichen: `don't`, `it's`, `o'clock`, `well-known`, `twenty-one`. Regulärer Ausdruck: `[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*`. Führende oder nachgestellte Apostrophe gehören nicht zum Wort (`'tis` -> `tis`, `boys'` -> `boys`).
  - `{ type: "number", text }`: Token ohne einen einzigen Buchstaben (z.B. `1914`, `3,5`). Nicht anklickbar.
  - `{ type: "other", text }`: Leerraum und Satzzeichen.
- `key` = `text` in Kleinbuchstaben (`toLowerCase()`), typografische Apostrophe `‘ ’` zu `'` normalisiert, Unicode-Bindestrich-Varianten (U+2010, U+2011) zu `-`.
- `annotate(segments, hasKey)` fasst 2 bis 4 aufeinander folgende Wortsegmente, die durch genau ein Segment getrennt sind, das nur aus Leerzeichen besteht, zu `{ type: "phrase", text, key, parts }` zusammen, wenn `hasKey(zusammengesetzter Schlüssel)` wahr ist. Längster Treffer zuerst, von links nach rechts, keine Überlappung.
- `keysOf(paragraphs)` liefert alle Wortschlüssel eines Textes als sortierte Menge (für die Werkzeuge).

## 6. Web-App

### 6.1 Ansichten und Routing

Hash-Routing: `#/` Bibliothek, `#/t/<id>` Leseansicht. Zurück-Taste des Browsers funktioniert.

**Passwort-Ansicht.** Erscheint, wenn kein Schlüssel auf dem Gerät gespeichert ist oder der gespeicherte Schlüssel den Index nicht entschlüsseln kann. Ein Passwortfeld, ein Knopf, Fehlermeldung „Falsches Passwort" bei Fehlschlag. Nach Erfolg wird der abgeleitete Schlüssel als Base64 unter `reader.key` in `localStorage` gespeichert.

**Bibliothek.** Liste aller Texte aus dem Index: Titel, Autor, Quelle (nur Domain, als Link), Niveau als Badge, Wortzahl und Lesezeit („1.240 Wörter · ca. 6 Min" bei 200 Wörtern pro Minute), Datum, Einzeiler. Unten ein kleiner Link „Abmelden", der `reader.key` löscht. Ist der Index leer: „Noch keine Texte. Füge in Claude Code mit /add-text einen hinzu."

**Leseansicht.** Kopfzeile mit Zurück-Knopf, A− und A+, Hell/Dunkel-Schalter. Darunter Titel (h1), Zeile mit Autor, Quelle (Link), Niveau, Wortzahl. Dann die Absätze: `h2` als Zwischenüberschrift, `p` als Absatz, `quote` als eingerücktes Zitat. Jedes Wort und jede erkannte Wendung ist ein `<span class="w" data-key="...">`. Klick-Behandlung über Event-Delegation am Artikel-Container. Der Text wird entschlüsselt im Speicher gehalten (Map je Sitzung), nicht auf dem Gerät gespeichert.

### 6.2 Popup

- Schmale Bildschirme (Breite unter 700 px): ein Blatt am unteren Rand, volle Breite, Rand für den Home-Balken (`env(safe-area-inset-bottom)`), maximal 45 % der Höhe, scrollbar, Schließen-Knopf. Tippen außerhalb schließt.
- Breite Bildschirme: ein Kästchen (max. 360 px) neben dem Wort, oberhalb oder unterhalb je nach Platz, innerhalb des sichtbaren Bereichs.
- Geräte mit Maus (`@media (pointer: fine)`): Verweilen mit der Maus zeigt das Kästchen nach 250 ms und blendet es beim Verlassen aus; ein Klick hält es fest, bis erneut geklickt, außerhalb geklickt oder Escape gedrückt wird.
- Inhalt in dieser Reihenfolge: Wort wie im Text (bei Wendungen die ganze Wendung), daneben Grundform in Klammern falls vorhanden, Wortart als Badge, Übersetzung groß, Erklärung kleiner. Ohne Eintrag: das Wort und „Keine Übersetzung gespeichert."
- Das angetippte Wort ist hervorgehoben, solange das Popup offen ist. Nur ein Popup zugleich.

### 6.3 Einstellungen und Speicherung (`localStorage`)

| Schlüssel | Inhalt | Standard |
|---|---|---|
| `reader.key` | abgeleiteter AES-Schlüssel, Base64 | keiner |
| `reader.theme` | `light` oder `dark` | Systemeinstellung (`prefers-color-scheme`) |
| `reader.fontSize` | Schriftgröße in px, 15 bis 27, Schritt 2 | 19 |
| `reader.pos.<id>` | Scrollposition als Anteil 0 bis 1 | 0 |

Die Scrollposition wird beim Scrollen gedrosselt gespeichert und beim Öffnen nach dem Rendern wiederhergestellt.

### 6.4 Gestaltung

- Schrift: `"Literata", ui-serif, Charter, "Iowan Old Style", Georgia, "Noto Serif", serif`. Literata (SIL Open Font License) wird als woff2 in `docs/fonts/` mitgeliefert (Regular, Italic, Bold). Ist sie bei der Umsetzung nicht beschaffbar, greift die Systemschrift; die App bleibt voll funktionsfähig.
- Zeilenlänge maximal 65 Zeichen (`max-width: 65ch`), Zeilenabstand 1,6, Absatzabstand 1 em, Überschriften mit derselben Schrift.
- Hell: warmweißer Hintergrund (etwa `#f8f5ef`), dunkelgrauer Text (etwa `#2b2a27`). Dunkel: dunkelgrauer Hintergrund (etwa `#1e1f22`), heller Text (etwa `#d8d5cf`). Akzentfarbe warm (Braun/Bernstein) für Badges, Links und Hervorhebung. Anklickbare Wörter ohne dauerhafte Unterstreichung; das aktive Wort bekommt einen Hintergrund in der Akzentfarbe mit geringer Deckkraft.
- Farben sind CSS-Variablen; `data-theme="light|dark"` am `<html>` schaltet um. Ohne Attribut gilt `prefers-color-scheme`.
- Tipp-Ziele in der Kopfzeile mindestens 44 × 44 px. Kein horizontales Scrollen. `viewport-fit=cover`, Ränder über `env(safe-area-inset-*)`.
- Meta für iOS: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon` (180 px), `theme-color` je Farbschema. Manifest mit Name „Englisch lesen", `display: standalone`, Icons 192 und 512 px.
- Icons: einfache geometrische Grafik (abgerundetes Quadrat in Akzentfarbe mit stilisiertem Buch), vom Skript `make-icons.mjs` ohne Abhängigkeiten als PNG erzeugt.

### 6.5 Startablauf

1. `salt.json` und `index.json` laden. Fehlt eine Datei: Hinweis „Noch keine Texte veröffentlicht."
2. Gespeicherten Schlüssel laden. Vorhanden: Index entschlüsseln. Fehlschlag: Schlüssel löschen, Passwort-Ansicht mit Hinweis „Passwort geändert oder falsch."
3. Kein Schlüssel: Passwort-Ansicht. Nach Eingabe Schlüssel ableiten, Index entschlüsseln, bei Erfolg speichern.
4. Route auswerten und rendern. Beim Öffnen eines Textes die Datei laden, entschlüsseln, Grundliste und Text-Wörterbuch zusammenführen, Absätze tokenisieren, Wendungen annotieren, rendern.

## 7. Werkzeuge (`tools/`)

Alle Skripte: Node 22, ES-Module, keine npm-Abhängigkeiten, laufen nicht-interaktiv (außer `setup.mjs`). Aufruf über npm-Skripte in `package.json`.

| Skript / npm | Aufgabe |
|---|---|
| `setup.mjs` / `npm run setup` | Fragt das Passwort zweimal ab, schreibt `.password`, legt `docs/texts/salt.json` an, falls nicht vorhanden. Existiert der Salt schon und das Passwort ändert sich, weist es darauf hin, dass alle Texte neu verschlüsselt werden müssen (`npm run encrypt`). Wird vom Nutzer im eigenen Terminal ausgeführt. |
| `words.mjs <library-datei> [--all] [--chunk N] [--json]` / `npm run words` | Gibt die Wortschlüssel des Textes aus, die noch keinen Eintrag haben (weder im Text-Wörterbuch noch in der Grundliste). `--all` ignoriert die Grundliste. `--chunk N` teilt in Blöcke von N Wörtern. `--json` gibt ein Array von Arrays aus. |
| `merge.mjs <library-datei>` / `npm run merge` | Liest alle `library/.parts/<id>/*.json`, prüft die Einträge auf Form, mergt sie in `glosses` (neu überschreibt alt), löscht die Teile und meldet die Anzahl. |
| `validate.mjs <library-datei>` / `npm run validate` | Prüft Schema (Pflichtfelder, `level`, Absatztypen, Gloss-Form) und Abdeckung: fehlende Schlüssel (nicht im Wörterbuch, nicht in der Grundliste), Wendungen, die nicht als aufeinander folgende Wörter im Text vorkommen, sowie überzählige Einträge (Warnung). Exit-Code 1 bei Schemafehler oder fehlenden Schlüsseln. |
| `encrypt.mjs [id]` / `npm run encrypt` | Liest das Passwort (siehe 8), leitet den Schlüssel ab, validiert und verschlüsselt alle Texte (oder nur `id`) nach `docs/texts/`, baut den Index neu aus allen `library/*.json`, entfernt verschlüsselte Dateien ohne Klartext-Gegenstück. `wordCount` = Anzahl der Wortsegmente. |
| `serve.mjs [port]` / `npm run serve` | Statischer Server für `docs/` auf `http://localhost:8080`, korrekte MIME-Typen, `Cache-Control: no-store`. |
| `make-icons.mjs` / `npm run icons` | Erzeugt die drei PNG-Icons. |
| `npm test` | `node --test tests/` |
| `npm run publish` | `encrypt`, dann `git add docs/texts`, Commit „Texte aktualisiert", `git push`. |

Passwortquelle für `encrypt.mjs`: Umgebungsvariable `READER_PASSWORD`, sonst Datei `.password`, sonst Abbruch mit Hinweis auf `npm run setup`.

## 8. Verschlüsselung (`docs/crypto.js`)

Ein ES-Modul auf Basis von `globalThis.crypto.subtle`, das im Browser und in Node 22 identisch läuft.

- `deriveKey(password, saltBase64, iterations)`: PBKDF2 mit SHA-256, 310.000 Runden, ergibt einen 256-Bit-AES-GCM-Schlüssel (exportierbar, damit er auf dem Gerät gespeichert werden kann).
- `encryptJson(key, obj)`: zufällige 12-Byte-IV, AES-GCM, liefert den Container aus 4.3.
- `decryptJson(key, container)`: prüft `v`, entschlüsselt, parst JSON. Wirft bei falschem Schlüssel (GCM-Authentifizierung schlägt fehl).
- `exportKey(key)` / `importKey(base64)` für die Speicherung im Browser.

Sicherheitsrahmen: Der Salt ist öffentlich, das ist bei PBKDF2 vorgesehen. Die Stärke hängt vom Passwort ab; das README empfiehlt mindestens 12 Zeichen. Web Crypto ist nur unter HTTPS oder `localhost` verfügbar; GitHub Pages ist HTTPS, lokal wird über `serve.mjs` getestet. Das Passwort steht in `.password` (gitignored); Claude liest diese Datei nicht.

## 9. Skill `/add-text` (`.claude/skills/add-text/SKILL.md`)

Eingabe: eine URL, ein Dateipfad oder direkt eingefügter Text.

Ablauf:

1. **Beschaffen.** URL: Seite per WebFetch laden. Schlägt das fehl (Paywall, Blockierung), den Nutzer bitten, den Text einzufügen oder als Datei zu speichern. Datei: lesen. Eingefügter Text: direkt verwenden.
2. **Extrahieren.** Titel, Autor (falls erkennbar), Absätze, Zwischenüberschriften, Zitate. Navigation, Werbung, Bildunterschriften, „Weiterlesen"-Links, Kommentare weglassen. Der Wortlaut bleibt exakt erhalten, nichts wird umformuliert oder gekürzt. Bei eingefügtem Text nur Absätze erkennen.
3. **Metadaten.** `id` nach 4.1, `level` schätzen, `summary` formulieren, `source` setzen (URL oder Angabe des Nutzers).
4. **Klartext schreiben.** `library/<id>.json` mit leerem `glosses`.
5. **Wortliste.** `node tools/words.mjs library/<id>.json --chunk 150 --json`.
6. **Übersetzen.** Ein Block: selbst übersetzen. Mehrere Blöcke: parallele Unteragenten (Agent-Tool), je Block einer. Jeder Unteragent bekommt den gesamten Text, seine Wortliste, die Stilregeln (unten) und schreibt `library/.parts/<id>/<n>.json` als Objekt `{ "<key>": { de, base, pos, note }, ... }`. Zusätzlich sollen Übersetzer Wendungen (Phrasal Verbs, Redewendungen, feste Ausdrücke) aus dem Text als eigene Einträge mit Leerzeichen-Schlüssel anlegen, 2 bis 4 Wörter, exakt so aufeinander folgend wie im Text.
7. **Mergen.** `node tools/merge.mjs library/<id>.json`.
8. **Prüfen.** `node tools/validate.mjs library/<id>.json`. Fehlende Wörter selbst nachliefern (als weiterer Teil), erneut mergen und prüfen, bis nichts mehr fehlt.
9. **Verschlüsseln.** `node tools/encrypt.mjs <id>`.
10. **Bericht.** Titel, Wortzahl, Anzahl Einträge, Niveau. Frage: „Committen und pushen?" Bei Ja: `git add docs/texts`, Commit „Text hinzugefügt: <Titel>", `git push`.

Stilregeln für Einträge (stehen im Skill):

- Deutsch, knapp. `de` gibt die Bedeutung wieder, wie das Wort **in diesem Text** gebraucht wird. Substantive mit Artikel („der Ausflug"), Verben im Infinitiv („zögern"), Adjektive in der Grundform.
- `base` nur bei flektierten Formen. `pos` aus der Liste in 4.1.
- `note`: nur, wenn sie etwas bringt: Nuance, Register, Gebrauch im Satz, wörtliche vs. übertragene Bedeutung. Bei Mehrdeutigkeit im Text beide Bedeutungen mit Absatzangabe. Bei einfachen Wörtern leer.
- Eigennamen: `de` = Name mit kurzer Einordnung („Nuttel (Nachname des Besuchers)"), `pos` Eigenname.
- Abkürzungen und Zahlen mit Buchstaben (z.B. `1990s`, `mp3`) kurz erklären.
- Wörter aus der Grundliste nur dann eintragen, wenn sie im Text eine andere Bedeutung haben als in der Grundliste (z.B. `will` als Testament, `can` als Dose).
- Keine englischen Erklärungen außer dem Wort selbst.

## 10. Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| Falsches Passwort | Meldung im Passwortfeld, Feld bleibt gefüllt, kein Schlüssel gespeichert. |
| Gespeicherter Schlüssel passt nicht mehr (Passwort geändert) | Schlüssel löschen, Passwort-Ansicht mit Hinweis. |
| `index.json` oder `salt.json` fehlt | Hinweis „Noch keine Texte veröffentlicht." mit kurzer Anleitung. |
| Textdatei fehlt oder lässt sich nicht entschlüsseln | Meldung in der Leseansicht mit Zurück-Link. |
| Wort ohne Eintrag | Popup zeigt das Wort und „Keine Übersetzung gespeichert." |
| Browser ohne Web Crypto (unsicherer Kontext) | Meldung: Seite über HTTPS oder `localhost` öffnen. |
| `encrypt.mjs` ohne Passwortquelle | Abbruch mit Hinweis auf `npm run setup`. |
| `validate.mjs` findet fehlende Wörter | Exit-Code 1, Liste der Wörter; `encrypt.mjs` verschlüsselt den Text dann nicht. |
| WebFetch scheitert im Skill | Nutzer um Text oder Datei bitten. |

## 11. Tests

`node --test tests/`, keine Abhängigkeiten:

- **tokenizer**: einfache Wörter, Kurzformen mit geradem und typografischem Apostroph, Bindestrich-Wörter, Zahlen nicht anklickbar, Satzzeichen an Wortgrenzen, Unicode-Buchstaben (`café`), Verkettung ergibt die Eingabe, Wendungen längster Treffer zuerst, keine Wendung über Satzzeichen hinweg.
- **crypto**: Verschlüsseln und Entschlüsseln ergibt das Original, falscher Schlüssel wirft, Container hat die Form aus 4.3, Export und Import des Schlüssels.
- **validate**: erkennt fehlende Schlüssel, akzeptiert Grundlisten-Wörter, meldet Wendungen, die nicht im Text stehen, meldet Schemafehler.
- **words**: schließt Grundliste aus, `--all` nicht, `--chunk` teilt korrekt.
- **merge**: mergt Teile, verwirft fehlerhafte Einträge mit Meldung, löscht Teile.
- **encrypt/index**: Index sortiert, `wordCount` gesetzt, verwaiste verschlüsselte Dateien entfernt.

Manuelle Prüfliste (README): iPhone Safari, iPad Safari, Desktop Chrome; jeweils Hell und Dunkel; Passwort-Ansicht; Bibliothek; Text öffnen; Wort tippen (Blatt bzw. Kästchen); Wendung tippen; Maus-Hover am Desktop; A−/A+; Scrollposition; Zurück-Taste; „Zum Home-Bildschirm"; Abmelden.

## 12. Veröffentlichung und Bedienung (README)

1. Einmalig: `npm run setup` (Passwort), `npm run icons`.
2. Repo auf github.com anlegen (öffentlich oder privat), Remote setzen, `git push -u origin main`.
3. In den Repo-Einstellungen unter „Pages": Source „Deploy from a branch", Branch `main`, Ordner `/docs`. Die URL steht danach dort.
4. Auf Handy und iPad die URL öffnen, Passwort eingeben, „Zum Home-Bildschirm" wählen.
5. Neuer Text: in Claude Code `/add-text <URL>`, danach pushen (der Skill bietet es an) oder `npm run publish`.
6. Lokal testen: `npm run serve`, dann `http://localhost:8080`.
7. Passwort ändern: `npm run setup`, dann `npm run encrypt`, pushen; auf jedem Gerät „Abmelden" und neu anmelden.

Ein gemeinfreier Beispieltext (Kurzgeschichte, etwa 1.200 Wörter) wird bei der Umsetzung angelegt, damit die Pipeline einmal vollständig durchläuft.

## 13. Nicht enthalten

Bewusst weggelassen, später möglich: Offline-Modus per Service Worker, Liste gemerkter Wörter, Satzübersetzung auf Knopfdruck, Vorlesen, Suche in der Bibliothek, Texte direkt aus der Seite heraus hinzufügen (bräuchte einen API-Key im Browser oder einen lokalen Server).
