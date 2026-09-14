# Englisch lesen

Englische Texte lesen und jedes Wort antippen: Ein Popup zeigt die deutsche Übersetzung, wie das Wort in diesem Text gemeint ist, dazu Grundform, Wortart und eine kurze Erklärung. Läuft als Website auf GitHub Pages, gut lesbar auf Handy, iPad und PC, mit Tag- und Nachtmodus.

Texte kommen auf zwei Wegen hinein: unterwegs per **+** auf der Seite selbst, oder am PC in Claude Code mit `/add-text`. Übersetzt wird immer in Claude Code, das kostet nichts über dein Abo hinaus. Alles wird passwortverschlüsselt veröffentlicht; auf GitHub liegt nur Datensalat, und die Seite entschlüsselt im Browser, nachdem du das Passwort einmal pro Gerät eingegeben hast.

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

### Unterwegs, auf dem Handy

In der Bibliothek oben auf **+** tippen. Dort entweder einen Link einfügen oder einen kopierten Text. Der Eintrag landet verschlüsselt in der Warteschlange. Ein eingefügter Text ist sofort lesbar, nur ohne die textspezifischen Übersetzungen.

Beim ersten Mal fragt das Formular nach einem GitHub-Token. Du brauchst es einmal pro Gerät.

1. [Fine-grained Token erstellen](https://github.com/settings/personal-access-tokens/new)
2. Bei „Repository access" **Only select repositories** wählen und dieses Repository auswählen
3. Unter „Permissions" → „Repository permissions" bei **Contents** auf **Read and write** stellen
4. Ablaufdatum setzen, Token erzeugen, in das Formular einfügen

Das Token liegt danach nur auf diesem Gerät. Wer es erbeutet, kann in dieses eine Repository schreiben, aber deine Texte nicht lesen (sie sind verschlüsselt) und an kein anderes Repository. Im Formular unten kannst du es wieder löschen.

### Am PC, in Claude Code

    /add-text

ohne Argument holt alles aus der Warteschlange, übersetzt es und fragt am Ende, ob es pushen soll.

    /add-text https://beispiel.org/artikel

geht weiterhin direkt, ebenso `/add-text pfad/zur/datei.txt` oder ein eingefügter Text. Ein längerer Artikel braucht einige Minuten.

Warteschlange von Hand ansehen oder leeren:

    npm run queue list
    npm run queue clear --all

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

- `docs/` die Website (wird veröffentlicht), darin `texts/` mit den verschlüsselten Texten und `config.json` mit dem Repo-Namen
- `library/` Klartexte (bleiben lokal)
- `queue/` verschlüsselte Einträge vom Handy, die noch übersetzt werden müssen
- `tools/` Skripte: `setup`, `words`, `merge`, `validate`, `encrypt`, `restore`, `queue`, `serve`, `icons`, `fonts`
- `.claude/skills/add-text/` der Skill
- `planning/` Spezifikation und Umsetzungsplan

## Tests

    npm test

## Manuelle Prüfliste

iPhone Safari, iPad Safari, Desktop Chrome; jeweils Hell und Dunkel: Passwort-Ansicht, Bibliothek, Text öffnen, Wort tippen (Blatt bzw. Kästchen), Wendung tippen, zweites Tippen schließt, Escape schließt, A−/A+, Scrollposition nach Zurück und erneutem Öffnen, Zurück-Taste des Browsers, „Zum Home-Bildschirm", Abmelden.
