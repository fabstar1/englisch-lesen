# Warteschlange: Texte von unterwegs hinzufügen

Stand: 2026-09-14. Ergänzung zu `2026-09-13-englisch-lesen-design.md`.

## Ziel

Einen Link oder einen kopierten Text unterwegs auf dem Handy erfassen, ohne Claude Code zu starten. Die Übersetzung passiert später gesammelt am PC. Kein Server, keine laufenden Kosten.

## Warum so

Der Browser darf fremde Seiten nicht laden (CORS), eine URL kann er also nicht selbst auslesen. Er darf aber mit der GitHub-API sprechen; ein Preflight für `PUT .../contents/...` liefert `Access-Control-Allow-Origin: *` und erlaubt den `Authorization`-Header. Die Seite schreibt Einträge daher direkt ins Repo, und Claude Code holt sie beim nächsten Lauf ab.

Übersetzen im Browser scheidet aus: das Claude-Abo deckt Claude Code ab, nicht API-Aufrufe aus einer eigenen Seite. Gemessen an der Übersetzung vom 2026-09-14 kostete ein Artikel mit 4.084 Wörtern rund 662.000 Tokens, also je nach Modell 0,93 bis 4,64 US-Dollar. Das bleibt deshalb beim Abo.

## Ablauf

1. Auf dem Handy in der Bibliothek auf **+** tippen.
2. Entweder eine URL einfügen oder Titel und Text einfügen.
3. Die Seite verschlüsselt den Eintrag mit demselben Schlüssel wie die Texte und legt ihn als `queue/<id>.json` im Repo ab.
4. Ein eingefügter Text ist sofort lesbar, mit den Übersetzungen aus der Grundliste, aber ohne textspezifische Einträge. Er ist als „noch nicht übersetzt" markiert.
5. Am PC: `/add-text` ohne Argument in Claude Code. Es holt die Warteschlange, verarbeitet jeden Eintrag wie bisher, verschlüsselt, löscht den Eintrag und pusht.

## Datenformat

`queue/<JJJJ-MM-TTTHHMMSS>-<4 Hexzeichen>.json` ist ein verschlüsselter Container wie in Abschnitt 4.3 der Hauptspezifikation. Der Klartext:

```json
{
  "v": 1,
  "kind": "url",
  "addedAt": "2026-09-14T08:30:00.000Z",
  "url": "https://example.org/artikel"
}
```

oder

```json
{
  "v": 1,
  "kind": "text",
  "addedAt": "2026-09-14T08:30:00.000Z",
  "title": "Mein Titel",
  "body": "Erster Absatz.\n\nZweiter Absatz."
}
```

`title` darf bei `kind: "text"` leer sein; dann bildet Claude Code ihn aus dem Anfang des Textes. Die Einträge liegen verschlüsselt im öffentlichen Repo, sind also für andere unlesbar.

## Konfiguration

`docs/config.json` (öffentlich, enthält kein Geheimnis):

```json
{ "repo": "fabstar1/englisch-lesen", "branch": "main" }
```

Fehlt die Datei, blendet die Seite den **+**-Knopf aus und verhält sich wie bisher. So bleibt die App auch ohne GitHub nutzbar.

## Zugriffstoken

Zum Schreiben braucht die Seite ein GitHub-Token. Es wird einmal pro Gerät eingegeben und unter `reader.ghtoken` in `localStorage` abgelegt.

Empfohlen: ein **fine-grained Personal Access Token**, eingeschränkt auf genau dieses eine Repository, mit der Berechtigung **Contents: Read and write**, mit Ablaufdatum.

Risiko, offen benannt: Wer das Token vom Gerät erbeutet, kann in dieses eine Repository schreiben. Er kann damit weder die Texte lesen (sie sind verschlüsselt) noch an andere Repositories. Der Schaden wäre Vandalismus an diesem Projekt, rückgängig zu machen über die Git-Historie. Wer das nicht will, lässt das Token weg und nutzt weiter `/add-text` am PC.

Lesen braucht kein Token, weil das Repository öffentlich ist.

## Anzeige der Warteschlange

Die Bibliothek listet `queue/` über `GET https://api.github.com/repos/<repo>/contents/queue` (ohne Token, 60 Anfragen je Stunde und IP reichen). Jeder Eintrag wird geladen, entschlüsselt und angezeigt:

- `kind: "text"` als anklickbare Karte mit dem Vermerk „noch nicht übersetzt". Route `#/q/<dateiname>`. Absätze entstehen durch Trennung an Leerzeilen. Wörter sind anklickbar; Treffer kommen aus der Grundliste, sonst erscheint „Keine Übersetzung gespeichert."
- `kind: "url"` als nicht anklickbare Zeile mit Domain und dem Vermerk „wartet auf Verarbeitung".

Schlägt die Abfrage fehl (kein Netz, Ratengrenze), zeigt die Bibliothek nur die fertigen Texte und keine Fehlermeldung. Die Warteschlange ist Beiwerk, nicht der Hauptzweck.

## Werkzeug `tools/queue.mjs`

| Aufruf | Wirkung |
|---|---|
| `node tools/queue.mjs list` | Entschlüsselt alle `queue/*.json` und gibt sie als JSON-Array mit `file`, `kind`, `addedAt`, `url`, `title`, `body` aus |
| `node tools/queue.mjs show <datei>` | Gibt einen Eintrag als JSON aus |
| `node tools/queue.mjs clear <datei> [...]` | Löscht die genannten Dateien |
| `node tools/queue.mjs clear --all` | Löscht die gesamte Warteschlange |

Passwortquelle wie bei `encrypt.mjs`: `READER_PASSWORD`, sonst `.password`. `--root DIR` für Tests. Ohne Warteschlange: Hinweis und Exit-Code 0.

## Skill `/add-text`

Ohne Argument: `git pull`, dann `node tools/queue.mjs list`. Ist die Warteschlange leer, das sagen und aufhören. Sonst jeden Eintrag der Reihe nach wie bisher verarbeiten (`kind: "url"` wie eine URL, `kind: "text"` wie eingefügter Text), danach `node tools/queue.mjs clear <datei>`. Am Ende einmal committen und pushen, mit `queue/` im selben Commit.

Mit Argument: unverändert wie bisher.

## Grenzen

- Ein eingefügter Text in der Warteschlange zählt nicht zur Wortzahl der Bibliothek und taucht nicht im verschlüsselten Index auf. Erst nach der Verarbeitung wird er ein vollwertiger Text.
- Zwei Geräte, die im selben Moment schreiben, können kollidieren. Die GitHub-API lehnt den zweiten Schreibvorgang mit einem Konflikt ab; die Seite versucht es einmal erneut und meldet sonst „Bitte noch einmal versuchen."
- Die Warteschlange ist bewusst nicht Teil von `npm run encrypt`. Dadurch kann sie die veröffentlichten Texte nicht beschädigen.
