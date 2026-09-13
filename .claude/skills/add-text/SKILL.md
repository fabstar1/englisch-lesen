---
name: add-text
description: Legt einen englischen Text für den Reader an (aus URL, Datei oder eingefügtem Text), übersetzt jedes Wort im Kontext ins Deutsche, prüft und verschlüsselt. Nutzen, wenn der Nutzer einen Text hinzufügen, importieren oder übersetzen lassen will.
---

# Text hinzufügen

Eingabe (Argument oder Nachricht des Nutzers): eine URL, ein Dateipfad oder direkt eingefügter Text. Fehlt alles, nachfragen. Alle Befehle aus dem Projektstamm ausführen. Datum = heute als JJJJ-MM-TT.

## Ablauf

1. **Beschaffen.** URL: mit WebFetch laden, Prompt: „Gib den vollständigen Artikeltext wörtlich zurück: Titel, Autor, Zwischenüberschriften und alle Absätze in Originalreihenfolge. Keine Navigation, Werbung, Bildunterschriften, Kommentare oder verwandten Links. Nichts kürzen, nichts umformulieren." Scheitert das (Paywall, Blockierung, leerer Inhalt): den Nutzer bitten, den Text einzufügen oder als Datei zu speichern, und hier abbrechen. Dateipfad: Datei lesen. Eingefügter Text: direkt verwenden.
2. **Extrahieren.** Titel; Autor, falls erkennbar (sonst `""`); Absätze in Lesereihenfolge; Zwischenüberschriften als `h2`; eingerückte Zitate als `quote`. Wortlaut exakt erhalten. Jeder Absatz ist eine Zeile ohne Zeilenumbrüche. Nichts kürzen, umformulieren oder zusammenfassen.
3. **Metadaten.** `id` = Datum + `-` + Slug des Titels (Kleinbuchstaben, nur a-z, 0-9 und Bindestrich, höchstens 40 Zeichen; existiert die Datei schon, `-2` anhängen). `level` nach GER schätzen (A2 bis C2). `summary` = ein deutscher Satz zum Inhalt. `source` = URL oder Angabe des Nutzers, sonst `""`.
4. **Klartext schreiben.** `library/<id>.json` im Format unten, `glosses` ist `{}`.
5. **Wortliste.** `node tools/words.mjs library/<id>.json --chunk 150 --json` liefert Blöcke von Wortschlüsseln ohne Eintrag (Wörter der Grundliste sind schon abgezogen).
6. **Übersetzen.** Ein Block: selbst übersetzen und als `library/.parts/<id>/1.json` schreiben. Mehrere Blöcke: je Block einen Unteragenten parallel starten (Agent-Tool, `subagent_type` `general-purpose`) mit dem Prompt unten; Block `n` schreibt `library/.parts/<id>/<n>.json`. Zusätzlich in einem eigenen Teil `library/.parts/<id>/wendungen.json`: Phrasal Verbs, Redewendungen und feste Ausdrücke aus dem Text als Einträge mit Leerzeichen-Schlüssel (2 bis 4 Wörter, in Kleinschreibung, genau so aufeinander folgend wie im Text, z.B. `gave up`, nicht `give up`, wenn im Text `gave up` steht).
7. **Mergen.** `node tools/merge.mjs library/<id>.json`. Verworfene Einträge (Meldungen auf stderr) korrigieren, als neuen Teil schreiben, erneut mergen.
8. **Prüfen.** `node tools/validate.mjs library/<id>.json`. Fehlende Wörter selbst nachliefern (`library/.parts/<id>/fehlend.json`), mergen, prüfen, bis die letzte Zeile mit `OK:` beginnt. Warnungen zu Wendungen ohne Vorkommen beheben (Schlüssel an den Text anpassen oder Eintrag aus der Datei entfernen).
9. **Verschlüsseln.** `node tools/encrypt.mjs <id>`. Bei Exit-Code 2 fehlt das Passwort: den Nutzer bitten, im Terminal `npm run setup` auszuführen, danach `npm run encrypt`. Meldet es, dass `library/` leer ist, fehlen die Klartexte (frischer Klon): `npm run restore` holt sie zurück.
10. **Bericht.** Titel, Wortzahl, Anzahl Einträge, Niveau. Frage: „Committen und pushen?" Bei Ja: `git add docs/texts && git commit -m "Text hinzugefügt: <Titel>" && git push`.

## Format `library/<id>.json`

```json
{
  "id": "2026-09-13-the-open-window",
  "title": "The Open Window",
  "author": "Saki",
  "source": "https://example.org/the-open-window",
  "addedAt": "2026-09-13",
  "level": "B2",
  "summary": "Ein nervöser Besucher gerät an eine Nichte mit lebhafter Fantasie.",
  "paragraphs": [
    { "type": "p", "text": "Erster Absatz im Originalwortlaut." },
    { "type": "h2", "text": "Zwischenüberschrift" },
    { "type": "quote", "text": "Eingerücktes Zitat." }
  ],
  "glosses": {}
}
```

Ein Wörterbucheintrag (Schlüssel = Wort in Kleinschreibung mit geradem Apostroph, so wie `words.mjs` es ausgibt):

```json
"presently": { "de": "gleich / in Kürze", "base": "", "pos": "Adverb", "note": "Hier im älteren Sinn von 'bald', nicht 'derzeit'." }
```

- `de` (Pflicht): Bedeutung, wie das Wort in diesem Text gebraucht wird. 1 bis 6 Wörter, Varianten mit ` / `. Substantive mit Artikel („der Ausflug"), Verben im Infinitiv („zögern"), Adjektive in der Grundform.
- `base`: Grundform nur bei flektierten Formen (`ran` → `run`, `children` → `child`), sonst `""`.
- `pos`: eine Wortart aus: Substantiv, Verb, Adjektiv, Adverb, Pronomen, Präposition, Konjunktion, Artikel, Zahlwort, Interjektion, Eigenname, Phrasal Verb, Wendung, Abkürzung.
- `note`: 1 bis 2 kurze deutsche Sätze, höchstens etwa 200 Zeichen, nur wenn sie etwas bringen: Nuance, Register (förmlich, umgangssprachlich, veraltet, literarisch), Gebrauch im Satz, wörtliche gegenüber übertragener Bedeutung. Kommt das Wort im Text in zwei Bedeutungen vor, beide nennen mit Absatzangabe. Bei einfachen Wörtern `""`.

## Stilregeln

- Deutsch, knapp, nie Englisch außer dem Wort selbst.
- Eigennamen: `de` = Name mit kurzer Einordnung („Nuttel (Nachname des Besuchers)"), `pos` Eigenname.
- Abkürzungen und Zahlen mit Buchstaben (`1990s`, `mp3`) kurz erklären.
- Wörter aus `docs/base-words.json` nur eintragen, wenn sie im Text eine andere Bedeutung haben als dort (`will` als Testament, `can` als Dose).
- Jeder Schlüssel aus der Wortliste bekommt genau einen Eintrag. Keine Schlüssel erfinden, die nicht in der Liste oder als Wendung im Text stehen.

## Prompt für Unteragenten

```
Du übersetzt englische Wörter im Kontext eines Textes ins Deutsche für einen Lern-Reader.

Hier ist der vollständige Text (Absätze nummeriert):
TEXT

Übersetze GENAU diese Wörter, jedes so, wie es in diesem Text gebraucht wird:
WORTLISTE

Schreibe die Datei PFAD als JSON-Objekt. Schlüssel = das Wort exakt wie in der Liste. Wert = Objekt mit den Feldern de, base, pos, note:
- de (Pflicht): Bedeutung im Kontext, 1 bis 6 Wörter, Varianten mit " / ". Substantive mit Artikel, Verben im Infinitiv, Adjektive in Grundform.
- base: Grundform nur bei flektierten Formen (ran -> run, children -> child), sonst "".
- pos: genau eine Wortart aus: Substantiv, Verb, Adjektiv, Adverb, Pronomen, Präposition, Konjunktion, Artikel, Zahlwort, Interjektion, Eigenname, Phrasal Verb, Wendung, Abkürzung.
- note: 1 bis 2 kurze deutsche Sätze (höchstens 200 Zeichen), nur wenn hilfreich: Nuance, Register, Gebrauch im Satz, übertragene Bedeutung; bei zwei Bedeutungen im Text beide mit Absatzangabe. Sonst "".

Regeln: Deutsch, knapp, nie Englisch außer dem Wort selbst. Eigennamen mit kurzer Einordnung und pos Eigenname. Jedes Wort der Liste genau einmal, keine zusätzlichen Schlüssel. Gültiges JSON, UTF-8, keine Kommentare. Schreibe die Datei mit dem Write-Werkzeug und antworte danach nur mit der Anzahl der Einträge.
```
