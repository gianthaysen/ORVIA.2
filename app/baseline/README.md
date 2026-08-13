# ORVIA · Baseline `v8-219-audit-baseline`

**Erfasst:** Phase 0 der Gap-Analyse (`docs/GAP-ANALYSE-2026-08.md`, `docs/UMSETZUNGSPLAN-2026-08.md`)

## Leitsatz

> Die Baseline dokumentiert, **was aktuell passiert** — sie bestätigt **nicht**,
> dass der Zustand fachlich korrekt ist.

Deshalb sind bekannte Defekte in `known-failures.json` **getrennt** geführt.
Ein Test, der eines dieser Verhalten als Soll-Zustand assertiert, ist per
Definition falsch und muss abgelehnt werden.

## Dateien

| Datei | Inhalt |
|---|---|
| `environment.json` | Laufzeit, Manifest-Hash, 345 Dateien mit SHA-256 |
| `structural-parity.json` | collision_scan, Testsuite (186), Paritäts-Status |
| `smoke-results.json` | 74 Assertions einzeln, inkl. Aufrufhinweis |
| `known-failures.json` | 14 bekannte Defekte KF-001 … KF-014 |
| `action-reachability.json` | Live-Probe der Aktions-Erreichbarkeit |
| `screenshots/` | 11 Screenshots der fünf Hauptbereiche |

## Reproduktion

```bash
node tools/real_app_smoke.mjs /absoluter/pfad/zur/app baseline-v8-219
node tools/collision_scan.mjs
node tools/build_baseline.mjs
node tools/probe_actions_live.mjs /absoluter/pfad/zur/app
```

> `appRoot` MUSS absolut sein. Bei relativem Pfad (`.`) schlägt der Pfad-Guard in
> `real_app_smoke.mjs:78` fehl, der Server liefert für jede Datei 404 und der Lauf
> meldet 48 Fehlschläge, die nicht existieren.

## Stand bei Erfassung

| Prüfung | Ergebnis |
|---|---|
| real_app_smoke | 74 / 74 |
| collision_scan | OK, 80 Skripte |
| Testsuite | 178 / 186 — **0 echte Codedefekte** |
| Golden-Master-Parität | **nicht lauffähig** (Fixtures fehlen) → KF-013 in Phase 0 aufgelöst |
| Aktionen auflösbar | 13 / 13 |
| Aktionen still tot | **2** (`training_start`, `training_continue`) |

## Kein Git

Das Arbeitsverzeichnis ist kein Git-Checkout; der Live-Repo-Klon liegt separat
(`github.com/gianthaysen/ORVIA.2`). Das Einfrieren erfolgt hier über
`manifest.sha256` je Datei. **Beim nächsten Upload ins Repo ist zusätzlich der
Tag `v8-219-audit-baseline` zu setzen.**

## Nach Phase 0

`known-failures.json` wird beim Beheben fortgeschrieben — so war der Vertrag angelegt.
Der eingefrorene Stand bleibt abrufbar:

```bash
git show v8-219-audit-baseline:baseline/known-failures.json
```

| Eintrag | Status |
|---|---|
| KF-013 Golden-Master-Parität | **resolved** — repo-interner Strukturvertrag |
| KF-008 `runAction` meldet Erfolg | **partially_resolved** — erkennt Dispatch-Fehler, keine semantisch erfolglosen Handler |
| KF-001 / KF-003 | offen, erwartet bis Phase 1 |

`phase0-verification.json` belegt, dass die Phase-0-Änderungen keine Regression
erzeugt haben. Das ist **keine neue Baseline** — die Baseline bleibt an den Tag
`v8-219-audit-baseline` gebunden.
