# Deploy-Auftrag ORVIA · Standardfassung

**Für jeden künftigen Upload in die Repo-Wurzel. Ersetzt den Einzelauftrag vom 16.08.**
Gilt ab Version `v8-356`. Stand dieser Fassung: 17.08.2026.

---

## 0 · Vorgeschichte, die diesen Auftrag erklärt

Zwei Deploys, zwei Vorfälle — beide bei grüner Testsuite:

| Datum | Was passierte | Warum es niemand merkte |
|---|---|---|
| 16.08. | `styles.css` kam nicht mit hoch, `sw.js` meldete trotzdem die neue Version | Der Service Worker legt pro Version einen Cache an, füllt ihn einmal, löscht die alten. Geräte mit v8-354 hatten die **alte CSS unter der neuen Nummer einbetoniert** und hätten sie nie nachgeladen |
| 17.08. | Der Upload ersetzte die **komplette Historie** von `main` per Force-Push (2 Commits, abgekoppelt) | Der Inhalt war zufällig korrekt. Hätte derselbe Force-Push das lokale `app/`-Layout getroffen, wäre GitHub Pages im selben Moment tot gewesen — kein `index.html`, kein `sw.js`, auf allen Geräten |

Die CI prüft `entwicklung`. Die Wurzel von `main` prüfte **niemand**. Deshalb Abschnitt 5.

---

## 1 · Ausgangslage

| | Wert |
|---|---|
| Repository | `gianthaysen/ORVIA.2` |
| Zielzweig | `main` |
| Live-URL | `https://gianthaysen.github.io/ORVIA.2/` |
| Lokale Quelle | `~/Claude/Projects/Strava/app/` |
| Auslieferung | GitHub Pages von `main` / `(root)` |

**Zwei Layouts, ein Repo.** Lokal liegt die App unter `app/`. Auf GitHub liegt sie in der **Wurzel**. Hochgeladen wird der **Inhalt** von `app/` — nicht der Ordner.

---

## 2 · Der Upload-Satz

Aus `app/` in die Wurzel:

| Quelle | Ziel |
|---|---|
| `app/index.html` | `index.html` |
| `app/styles.css` | `styles.css` |
| `app/sw.js` | `sw.js` |
| `app/env.js` | `env.js` (nur Supabase-URL + anon key — öffentlich, gehört dorthin) |
| `app/manifest.webmanifest` | `manifest.webmanifest` |
| `app/js/` | `js/` (138 `.js`-Dateien) |
| `app/assets/` | `assets/` (15 Dateien) |

**159 Dateien insgesamt.** `index.html` lädt 139 lokale Skripte einzeln per `<script src=…>`; eine einzige fehlende Datei erzeugt eine weiße Seite oder einen still kaputten Bereich.

**Nicht hochladen:** `app/docs/`, `app/supabase/`, `app/tools/`, `app/baseline/`, `app/package*.json`, `app/real_app_smoke.mjs`, `app/README.md`, `app/env.example.js`, `.DS_Store`, sowie alles außerhalb von `app/`.

---

## 3 · Verbote — der wichtigste Teil

**3.1 Kein Force-Push. Unter keinen Umständen.**
Kein `git push --force`, kein `--force-with-lease`, kein `+`-Präfix in der Refspec, kein `git push` nach einem `git reset --hard` auf einen fremden Stand. Der neue Stand wird als **normaler Commit auf den bestehenden `main` gesetzt**:

```bash
git fetch origin
git checkout -B deploy origin/main      # auf dem AKTUELLEN Fernstand aufsetzen
# … Dateien ersetzen …
git add -A && git commit -m "Deploy ORVIA v8-XXX (Stand <lokaler-commit>)"
git push origin deploy:main             # normaler, vorspulender Push
```

Wird der Push mit **`push declined due to repository rule violations`** abgelehnt, ist das **kein Fehler, den man mit `--force` löst**. Dann ist die Vorgehensweise falsch — abbrechen und melden.

**3.2 Den lokalen Zweig `main` niemals auf `origin/main` pushen.** Der lokale `main` trägt das `app/`-Layout. Der Entwicklungsstand geht ausschließlich nach `entwicklung`: `git push origin main:entwicklung`.

**3.3 Keine Datei in der Wurzel löschen, die nicht im Upload-Satz steht** (`README.md`, `package.json`, `package-lock.json`, `real_app_smoke.mjs` liegen dort; sie stören nicht).

**3.4 Kein Umbenennen, kein Umsortieren, keine „Aufräumarbeiten".** Es wird ausschließlich ersetzt und hinzugefügt.

**3.5 `git add -A` nur nach Sichtprüfung.** Die Wurzel von `main` hat **keine `.gitignore`**. Ein `git add -A` erfasst dort alles, was herumliegt — genau so entstand am 16.08. ein Commit über 3.441 Dateien inklusive `garmin-worker/.venv/`. Vorher zwingend `git status --short | head -30` lesen.

---

## 4 · Reihenfolge, die nicht verhandelbar ist

> **Die SW-Version steigt, wenn die Dateien OBEN SIND — nicht, wenn sie hochgeladen werden sollen.**

1. Alle 159 Dateien hochladen
2. Abnahme aus Abschnitt 5 fahren
3. **Erst wenn sie grün ist**, die nächste Version vergeben

Der umgekehrte Weg hat am 16.08. den Cache mit einem halben Stand zementiert. Eine erneute Übertragung derselben Datei hätte daran nichts geändert — nur eine weitere Versionsnummer.

---

## 5 · Abnahme (ersetzt jedes „müsste passen")

```bash
cd ~/Claude/Projects/Strava
bash app/tools/deploy-verify.sh
```

Das Skript vergleicht **jede der 159 Dateien byteweise** über den Git-Blob-Hash zwischen lokalem `app/` und `origin/main` und prüft zusätzlich:

| Prüfung | fängt ab |
|---|---|
| Historie fortgeschrieben? | Force-Push / Historien-Ersatz (Vorfall 17.08.) |
| Layout der Wurzel, kein `app/` darin | den tödlichen Fall: falsches Layout live |
| fehlende Dateien | Teildeploy (Vorfall 16.08.) |
| abweichende Dateien | alter Stand oben, obwohl „hochgeladen" |
| `sw.js` ↔ `index.html`-Marker ↔ lokal | Versionsanzeige, die lügt |

Exit 0 = bestanden, Exit 1 = nicht abgenommen. Bei Bestehen merkt sich das Skript den Fernstand in `app/tools/.deploy-main-tip` — daraus entsteht beim nächsten Lauf die Historienprüfung.

**Die Live-URL prüft es bewusst nicht.** GitHub Pages liefert gecacht aus; ein Abruf dort beruhigt falsch. Wenn doch von Hand geprüft wird, immer mit Cache-Buster: `…/sw.js?p=356`.

---

## 6 · Abnahme am Gerät (danach, nicht überspringen)

Desktop **und** iPhone, jeweils hart neu laden (iPhone: App vom Home-Bildschirm schließen und neu öffnen):

| # | Prüfung | Erwartung |
|---|---|---|
| 1 | aktive SW-Version in DevTools | die neue Nummer |
| 2 | Login nach Neuladen | kein Auth-Fehler |
| 3 | Wochenplan erzeugen | Plan erscheint |
| 4 | Gym-Workout → **Übung hinzufügen** → Satz speichern | funktioniert |
| 5 | Bei offenem Workout einen Fehler auslösen (Flugmodus) | Toast erscheint **über** dem Overlay |
| 6 | Satz auf Gerät A, Ansicht auf Gerät B | identisch, keine Dublette |
| 7 | Flugmodus-Kaltstart | App startet vollständig |
| 8 | Startseite | keine roten Konsolenfehler |
| 9 | Score-Zahl | plausibel |

**Wenn etwas rot ist:** nicht nachbessern, sondern den vorherigen Stand als **neuen Commit** wiederherstellen (`git revert` oder Inhalt zurückschreiben) — **niemals per Force-Push**. Symptom und Screenshot festhalten.
