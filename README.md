# Englisch lesen

Englische Texte lesen und jedes Wort antippen: Ein Popup zeigt die deutsche Übersetzung, wie das Wort in diesem Text gemeint ist, dazu Grundform, Wortart und eine kurze Erklärung. Läuft als Website auf GitHub Pages, gut lesbar auf Handy, iPad und PC, mit Tag- und Nachtmodus.

Texte werden hier in Claude Code angelegt (Skill `/add-text`) und passwortverschlüsselt veröffentlicht. Auf GitHub liegt nur Datensalat; die Seite entschlüsselt im Browser, nachdem du das Passwort einmal pro Gerät eingegeben hast.

## Einmalige Einrichtung

Voraussetzungen: Node 22 oder neuer, git, ein GitHub-Konto.

1. Passwort festlegen (mindestens 12 Zeichen empfohlen):

       npm run setup

   Das Passwort landet in `.password` (nicht im Repo). Vergisst du es: `npm run setup` erneut, dann `npm run encrypt`.

2. Repo auf github.com anlegen (Name frei, öffentlich oder privat), dann:

       git remote add origin https://github.com/DEIN-NAME/DEIN-REPO.git
       git push -u origin main

3. Auf github.com im Repo unter Settings → Pages: Source „Deploy from a branch", Branch `main`, Ordner `/docs`, Save. Nach einer Minute steht dort die Adresse der Seite.

4. Auf Handy und iPad die Adresse in Safari öffnen, Passwort eingeben, dann Teilen → „Zum Home-Bildschirm". Die Seite verhält sich danach wie eine App.

## Text hinzufügen

In Claude Code, im Projektordner:

    /add-text https://beispiel.org/artikel

oder `/add-text pfad/zur/datei.txt`, oder den Text direkt in die Nachricht einfügen. Claude holt den Text, übersetzt alle Wörter im Kontext, prüft die Datei, verschlüsselt sie und fragt am Ende, ob es committen und pushen soll. Ein längerer Artikel braucht einige Minuten. Danach erscheint der Text auf allen Geräten in der Bibliothek.

Von Hand veröffentlichen:

    npm run publish

## Lokal ansehen

    npm run serve

Dann `http://localhost:8080` öffnen. (Nur `localhost` oder HTTPS funktionieren, weil die Entschlüsselung die Web-Crypto-API braucht.)

## Passwort ändern

    npm run setup
    npm run encrypt
    git add docs/texts && git commit -m "Texte neu verschlüsselt" && git push

Danach auf jedem Gerät unten in der Bibliothek „Abmelden" wählen und neu anmelden.

## Einträge korrigieren

Die Klartexte liegen in `library/<id>.json`. Einträge dort ändern, dann `npm run encrypt` und pushen. Prüfen mit `node tools/validate.mjs library/<id>.json`.

## Auf einem zweiten Rechner arbeiten

`library/` liegt bewusst nicht im Repo, ein frischer Klon hat also keine Klartexte. Hol sie dir einmalig aus den verschlüsselten Dateien zurück:

    npm run setup      # dasselbe Passwort wie bisher eingeben
    npm run restore

Danach ist `library/` wieder vollständig. Solange die Klartexte fehlen, weigert sich `npm run encrypt` und löscht nichts. Das ist Absicht: ohne diese Sperre würde es die veröffentlichten Texte für verwaist halten und entfernen.

## Ordner

- `docs/` die Website (wird veröffentlicht), darin `texts/` mit den verschlüsselten Texten
- `library/` Klartexte (bleiben lokal)
- `tools/` Skripte: `setup`, `words`, `merge`, `validate`, `encrypt`, `restore`, `serve`, `icons`, `fonts`
- `.claude/skills/add-text/` der Skill
- `planning/` Spezifikation und Umsetzungsplan

## Tests

    npm test

## Manuelle Prüfliste

iPhone Safari, iPad Safari, Desktop Chrome; jeweils Hell und Dunkel: Passwort-Ansicht, Bibliothek, Text öffnen, Wort tippen (Blatt bzw. Kästchen), Wendung tippen, Maus-Hover am Desktop, A−/A+, Scrollposition nach Zurück und erneutem Öffnen, Zurück-Taste des Browsers, „Zum Home-Bildschirm", Abmelden.
