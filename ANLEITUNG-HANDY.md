# Check-in-App aufs Handy bringen (GitHub Pages)

Dauer: ~10 Minuten, kostenlos. Danach hast du die App mit eigenem Icon auf dem Homescreen, offline-fähig, Daten bleiben dauerhaft erhalten.

## Schritt 1: GitHub-Account

1. Gehe auf https://github.com/signup und erstelle einen kostenlosen Account (falls noch keiner vorhanden).

## Schritt 2: Repository anlegen

1. Oben rechts auf **+** → **New repository**.
2. Name: z. B. `checkin` · Sichtbarkeit: **Public** (nötig für kostenloses Pages; die URL ist nicht gelistet, aber theoretisch öffentlich — deine Trainingsdaten liegen NICHT darin, nur die leere App).
3. **Create repository** klicken.

## Schritt 3: Dateien hochladen

1. Im neuen Repo: **uploading an existing file** (oder **Add file → Upload files**).
2. Ziehe den **kompletten Inhalt des Ordners `app/`** ins Upload-Feld (inklusive des `js/`-Unterordners — einfach alle Dateien/Ordner markieren und reinziehen):
   `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `tests.html` und der Ordner `js/` (5 Dateien)
3. Unten **Commit changes** klicken.

## Schritt 4: GitHub Pages aktivieren

1. Im Repo: **Settings** → links **Pages**.
2. Unter „Build and deployment": Source = **Deploy from a branch**, Branch = **main**, Ordner = **/ (root)** → **Save**.
3. Nach 1–2 Minuten erscheint oben die URL, z. B.
   `https://DEINNAME.github.io/checkin/`

## Schritt 5: Auf dem iPhone installieren

1. Die URL in **Safari** öffnen (muss Safari sein).
2. **Teilen-Symbol** (Quadrat mit Pfeil) → **„Zum Home-Bildschirm"** → **Hinzufügen**.
3. Fertig: Die App startet im Vollbild mit eigenem Icon und funktioniert nach dem ersten Öffnen auch offline.

## Wichtig zu den Daten

- Die Daten liegen **nur auf dem jeweiligen Gerät** (localStorage). Handy und PC sind getrennt.
- Übertragen: Profil-Tab → **Backup (JSON)** auf Gerät A → Datei auf Gerät B → **Import**.
- Bei installierten Homescreen-Apps löscht iOS die Daten nicht automatisch — trotzdem regelmäßig Backup machen (die App erinnert dich alle 7 Tage).

## Updates später

Wenn ich die App weiterentwickle: einfach die neue `index.html` im Repo hochladen (gleicher Name, „Commit changes"). Auf dem Handy die App einmal schließen und neu öffnen — ggf. zweimal, bis der Cache die neue Version zieht.
