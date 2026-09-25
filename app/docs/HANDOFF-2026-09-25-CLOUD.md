# Übergabe · Nachtarbeit 25./26.09.2026 (Cloud-Klon, Mac offline)

Gians Auftrag: „mach unendlich weiter mit dem Prototyp, ich gucke morgen." Der Mac ging um
~16:20 UTC offline; die Arbeit lief im Cloud-Klon von `origin/entwicklung` (Stand v8-401) weiter.

## Ausgangslage — wichtig für das Zusammenführen

- Auf dem **Mac** liegen zwei Commits, die nie gepusht wurden: `759193e` + `2f242d1` (v8-402,
  Ziel-Realismus). Im Cloud-Klon habe ich denselben Inhalt als `b23e55d` nachgebaut
  (byte-gleich in den Quelldateien, andere Commit-Hashes).
- Die Nacht-Commits (v8-403 … v8-407) setzen auf `b23e55d` auf. Sie liegen als Patches in
  `patches/` (git format-patch) und sind mit `git am -3` auf `2f242d1` anwendbar.

## Zusammenführen auf dem Mac (Reihenfolge, nicht verhandelbar)

```bash
cd ~/Claude/Projects/Strava && git status --short          # sauber? sonst stash
git log --oneline -1                                       # muss 2f242d1 sein
git am -3 <Pfad>/patches/*.patch                           # Nacht-Commits auf den Mac-Stand
node supabase/tests/run-all.mjs                            # Suite gruen fahren (Marker)
git push origin main:entwicklung                           # danach Standard-Deploy-Block
```
Bei einem `git am`-Konflikt: `git am --abort`, mir das Log geben — nicht von Hand mergen.

## Was in der Nacht entstanden ist

| Build | Inhalt | Tests |
|---|---|---|
| v8-403 | Plan-Tab S3b: Adaptive als ein Statement (+Pill, Details einklappbar), rückt vor Planqualität; Badges „Geplant" / genau ein „Nächster Reiz" | plan_v14_s3b (20) |
| v8-404 | Schnellzugriff S3c: Block „Einheit starten" mit Kacheln aus den aktiven Sportarten + „Mehr"; eine Sportliste für Start-Sheet und Schnellzugriff | plan_v14_s3c (15) |
| v8-405 | P2 **Shadow**: `long-run-progression.js` (Regeln 1–5) rechnet den datengetriebenen Long-Run-Kandidaten; `lrKm` zeigt weiter die Tabelle, protokolliert daneben (`orvia_shadow_lr_v1`, `lrShadowReport()`) | long_run_progression (18) |
| v8-406 | Zielkarten: „Anteil am Trainingsbudget 60–75 % · Fokus" aus `goalPortfolio.buildPortfolio` (Rollenheuristik, so beschriftet) | goal_share_v14 (10) |
| v8-407 | Prognosekarte: Prognosezeit groß, Ziel und Abstand in % | plan_v14_s3b E1–E3 |
| — | Test `sw_assets_parity`: jede in index.html geladene Datei steht in sw.js ASSETS | (4) |
| — | Doc `TRAINING-BEINE-VORSCHLAG-2026-09.md` — Beintraining-Vorschlag (S2-Befund: null Beinsätze) | — |

Suite im Cloud-Klon nach v8-407: grün, 318 geprüft, 7 übersprungen (nur die, die eine
echte Supabase-Instanz brauchen) — mehr als auf der VM, weil hier Chromium für die
Browser-Tests vorhanden ist.

## Was ohne den Prototyp NICHT ging

S4 (Dashboard + Score), S5 (Debrief/Rückblick/Rechner), S6 (Sichtbarkeit/Profilstärke/
Einstellungen) brauchen `Downloads/ORVIA-Prototyp-Profil-Ziele-Community-v14.html` — die Datei
liegt nur auf dem Mac. Sobald der Mac online ist, geht es damit weiter. Alternativ: die Datei in
`app/docs/gm-ref/` ins Repo legen (483 KB), dann ist sie auch im Cloud-Klon verfügbar.

## Offene Entscheidungen (unverändert)

1. Aufräumen des deploy-Zweigs (2 451 Fremddateien öffentlich) — Block liegt in der Chat-Historie.
2. P2-Umschaltung nach Sichtung des Shadow-Protokolls (`lrShadowReport()` in der Konsole).
3. Delta-Doc S3 Punkte 7/8 (Reihenfolge, Sektionen) — umgesetzt wie empfohlen, revidierbar.
4. B-04 §2 (sechs reservierte Onboarding-IDs streichen).
