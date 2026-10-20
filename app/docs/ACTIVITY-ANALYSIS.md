# Sportartspezifische Aktivitätsanalyse (v8-452 · v8-453 · v8-454 · v8-454.1 · v8-456)

**Status: IMPLEMENTED** (App v8-454 live) · **App v8-454.1 gebaut, nicht ausgeliefert** (Build orvia-v8-455: neue Aktivitätsansicht, Zeitquellen, Leistungskurve, §11) · Worker v8-452.1 live (`DETAIL_EXTRAS=splits`, `DETAIL_EXTRAS_SPORTS=swimming`) · Worker v8-454 vorbereitet, nicht ausgerollt · keine Migration

## 1 · Warum beim Schwimmen fast nur die Herzfrequenz erschien

Belegt im Code (Datenfluss Garmin → Worker → Supabase → App):

| Stufe | Befund |
|---|---|
| Worker, Listeneintrag | Schwimmfelder (`poolLength`, `activeLengths`, `strokes`, `avgStrokes`, `averageSwolf`, `averageSwimCadenceInStrokesPerMinute`, `maxSwim…`, `avgStrokeDistance`) werden **unter ihrem Garmin-Namen erhalten** (`metrics.ext.fields`, `garmin_fields.py`), Belegstufe `assumed`. |
| Worker, Detailantwort | Kanonische Reihen: Herzfrequenz, Tempo (`directSpeed`), Distanz, Zeitachse. Zugfrequenz / SWOLF / Züge als Reihe gehen nach `metrics.ext.series` (Garmin-Name), **nicht** in `streams`. |
| Worker, Zusatzabrufe | Runden (`get_activity_splits`) und Bahnen (`get_activity_typed_splits`, nur `lap_swimming`) nur mit `DETAIL_EXTRAS` — **Standard aus**. Für bereits geladene Einheiten gab es keinen Nachholweg. |
| App, lokaler Speicher | `metrics.ext` wird beim Abgleich **bewusst verworfen** (`activity-store.SERVER_ONLY_METRIC_KEYS`, Umfang). |
| App, Aktivitätsseite | löst die Aktivität zuerst aus dem lokalen Speicher auf → **sah den Rohblock nie**; Schwimmkacheln: Distanz, Dauer, Tempo, Puls, Kalorien, Belastung; Diagramme nur aus `streams` (also Puls, ggf. Tempo). |
| Freigabe | `metric-eligibility`: Beleg `list.swim` leer → alle Schwimmfelder `unverified_semantics`; Herzfrequenz-Beleg nur für Laufen. |

Ergebnis: vorhandene Schwimmwerte lagen (soweit Garmin sie lieferte) auf dem Server, wurden aber nicht geladen und nicht gezeigt; Runden/Bahnen wurden nie abgefragt.
Welche Werte Garmin für die echten Einheiten tatsächlich geliefert hat, zeigt das Audit (Abschnitt 6).

## 2 · Kette

```
Aktivität
  → Sportart + Kontext        metric-eligibility.contextOf (Becken / Freiwasser / Indoor / virtuell, nur aus dem Typnamen)
  → Kennzahlen mit Urteil      metric-eligibility.describeActivity  (activity-metrics@1)
  → Darstellung je Sportart    engine/activity-analysis.js PROFILES (Hauptkennzahlen, Karten, Diagramme, Intervalle, Effizienz)
  → Oberfläche                 ui.js gmOpenActivityPage (zeichnet nur das Modell)
```

Keine zweite Aktivitäts-Engine: das Leistungsregister liest weiter **nur** `evaluate()`; `describeActivity()` ändert kein Urteil und keinen Beleg (Test `activity_analysis_v452` L3).

## 3 · Urteil je Kennzahl

| Feld | Werte |
|---|---|
| `status` | `available` · `not_delivered` (Garmin lieferte nicht) · `not_imported` (nie abgefragt: Zusatzabruf aus, Details nicht geladen, Altzeile ohne Rohblock) · `not_stored` (geliefert, vom Worker nicht erhalten) · `not_loaded` (gespeichert, in der App nicht geladen) · `not_applicable` |
| `validation` | `validated` (Beleg fixture/validated/eigene Daten) · `consistent` (in DIESER Einheit durch zweite Angabe bestätigt) · `unverified` (Quellwert) · `blocked` (unplausibel / Einheit ungeklärt / Form unbelegt) |
| `method` | `measured` · `derived` (feste Formel) · `manual` — nie geschätzt |
| `source` | `garmin_list` · `garmin_details` · `garmin_extras` · `own` · `manual` · `derived` |
| `ledger` | nur `available` + `validated` darf in Langzeitauswertungen |

Anzeige: `validated`/`consistent` als Messung, `unverified` als Quellwert (Hinweis „von Garmin übernommen", Messdetails „ungeprüft"), `blocked` nie.

Schwimm-Gegenprüfung: aktive Längen × Bahnlänge = Distanz (± eine Bahn bzw. 1 %) → Distanz, Längen, Bahnlänge `consistent`. Bahnlänge: Einheit des Listenfelds unbelegt (Meter oder Zentimeter, ggf. Yards) — nur die eine plausible Lesart (10–100 m) gilt.
Gesperrt: `avgStrokeDistance`, `avgStrideLength`, Garmin-`totalVolume` (Einheit unbelegt), `typed_splits` (Form unbelegt, kein Mitschnitt), unplausible Werte (Grenzen in `PLAUSIBILITY`).

## 4 · Schwimmansicht

Hauptkennzahl Distanz (Sportfarbe), Dauer, Ø Tempo /100 m (Zeitgrundlage wie Garmins `averageSpeed`: Becken Bewegungszeit, Freiwasser Timer) · Karten (höchstens sechs, nur vorhandene, in dieser Reihenfolge): Puls, Bahnen, SWOLF, Zugfrequenz, Ruhezeit, Bahnlänge, Tempo in Bewegung / Gesamttempo (nur bei echtem Unterschied), Züge je Bahn, Züge, Zuglänge, Max. Puls, angehaltene Zeit, Kalorien, Training Effect · Pulszonen (Garmin, ungeprüft) ·
Verlauf mit Auswahl (Tempo, Puls, Zugfrequenz, SWOLF — je nach Reihe) · Intervalle aus Garmin-Runden (Zeit und Distanz derselben Runde, Pausen getrennt) · Gleichmäßigkeit (Variationskoeffizient des Intervall-Tempos, ab drei Intervallen) ·
Messdetails eingeklappt (angezeigt / vorhanden, nicht angezeigt / nicht verfügbar mit Grund).
Andere Sportarten: bisherige Seite unverändert, Messdetails kommen dazu.

## 5 · Worker (vorbereitet, nicht ausgerollt)

Worker-Stand **v8-452.1** (Standard: alles aus, ein Deploy allein löst keinen Abruf aus):
- `DETAIL_EXTRAS` — Zusatzabrufe (`splits` = Runden inkl. Bahnen je Runde, `typed_splits` = Intervalle, nur Becken).
- `DETAIL_EXTRAS_SPORTS` — **neu**: Zusatzabrufe nur für diese Sportarten. Leer = alle (Verhalten v8-452). Für die Freigabe **`swimming`**, weil die Laufbestzeiten `metrics.splits` als Rückfall lesen (`run-bests.js`) — Garmin-Runden für Läufe brauchen einen eigenen Beleg.
- `DETAIL_REFETCH_EXTRAS` — lädt Einheiten auf Vertrag 3 einmal neu, wenn ein eingeschalteter Zusatzabruf noch keinen Befund hat (`ext.extras`: ok / empty / failed). Nur innerhalb von `DETAIL_EXTRAS_SPORTS`. Je Lauf höchstens `DETAIL_BACKFILL_LIMIT`.
- Runden anderer Quelle in `metrics.splits` werden **nie ersetzt**; der Rohblock (`ext.splits`) wird trotzdem abgelegt.
- Schlanke Runden (`metrics.splits`) tragen zusätzlich die Schwimmfelder je Runde (`SWIM_LAP_FIELDS`), soweit Garmin sie liefert.
- Keine Migration (alles in `activities.metrics`).

Freigabe-Reihenfolge (Gian) — **Stand nach dem Mitschnitt vom 18.10.2026 (§8)**:
1. ~~Mitschnitt~~ erledigt (Becken 11.10., Freiwasser 26.06.; `tests/test_v4521_swim_capture.py` C1–C9 grün).
2. **App v8-453 zuerst ausliefern** (gebaut, §9): Intervall-Tempo auf Schwimmzeit, Pausen getrennt, Bahnen, Plausibilität. v8-452 zeigte für ein Intervall mit Pause darin 5:43 statt 2:41 /100 m.
3. Sicherung: `supabase/scripts/v4521_swim_extras_backup.sql`.
4. `railway up` → `/healthz` `worker: v8-452.1` (ohne neue Variablen ändert sich nichts).
5. Railway: `DETAIL_EXTRAS=splits` (**ohne** `typed_splits` — Antwort leer, §8), `DETAIL_EXTRAS_SPORTS=swimming`, einmalig `DETAIL_REFETCH_EXTRAS=1` → Protokoll `extras_pending:` fällt auf 0 (6 Einheiten, 1 Lauf).
6. Kontrolle: `supabase/scripts/v4521_swim_extras_check.sql`.
7. `DETAIL_REFETCH_EXTRAS` löschen; `DETAIL_EXTRAS` + `DETAIL_EXTRAS_SPORTS` bleiben.
8. Validierung einer Einheit gegen Garmin Connect → Belege in `metric-eligibility`.

Rückweg: `DETAIL_EXTRAS` löschen (stoppt jeden Abruf) → `v4521_swim_extras_rollback.sql` (entfernt genau Runden/Bahnen, sonst nichts) · Notfall: `v4521_swim_extras_restore.sql` (Stand der Sicherung, aktuelle Korrekturen bleiben) · Worker: in Railway die vorige Bereitstellung (v8-447.3) erneut ausrollen. Alle SQL-Dateien sind gegen ein echtes Postgres getestet (`test_v4521_swim_sql.py`).

## 6 · Audit echter Einheiten

Werkzeug: `app/tools/activity-audit-console.js` (nur lesen, in der Konsole; keine GPS-Punkte, keine Titel, keine Kennungen, keine Messreihen außer Kennwerten).
Interne Diagnose je Einheit: `ORVIA.activityDiagnose('<id>')` (Konsole) — geliefert / gespeichert / geprüft / angezeigt je Kennzahl mit Grund.

Lauf vom 18.10.2026 (Build `orvia-v8-451`, `452-swim-audit-1`): 65 Aktivitäten, 41 aus Garmin, **6 Schwimmeinheiten** (4 × Becken `lap_swimming`, 2 × Freiwasser `open_water_swimming`). Testdaten daraus (ohne Kennungen/Titel/GPS): `supabase/tests/_swim-realdata.mjs`.

## 7 · Ergebnis des Audits

### 7.1 Abdeckung je Kennzahl (echte Einheiten)

| Kennzahl | Becken (4) | Freiwasser (2) | Prüfung | Anzeige v8-452 |
|---|---|---|---|---|
| Distanz, Timer, verstrichene Zeit | geliefert, gespeichert | geliefert, gespeichert | Becken: Längen × Bahnlänge = Distanz in **4/4** → bestätigt | Hauptkennzahl |
| Bewegungszeit | Listenfeld `movingDuration` geliefert; Detail-Bewegungszeit = **0** | beides geliefert | Becken: `averageSpeed` = Distanz ÷ Listen-Bewegungszeit → bestätigt | Grundlage Ø Tempo |
| Ø Tempo /100 m | abgeleitet (Bewegungszeit, wie Garmin) | abgeleitet (Timer, wie Garmin) | gegen `averageSpeed` (± 2 %) | Hauptkennzahl, Formel in Messdetails |
| Ruhezeit (Timer − Bewegung) | abgeleitet | abgeleitet | — | Karte |
| Puls Ø/max, Pulsreihe, Zeitachse | geliefert, gespeichert, geladen | dito | Beleg vorhanden | Karte, Verlauf |
| Pulszonen 1–5 (`hrTimeInZone_*`) | geliefert | geliefert | ungeprüft (Garmin-Zonengrenzen) | Zonenkarte |
| Bahnlänge (`poolLength`) | geliefert, **in cm** (5000 / 2500) | nicht zutreffend | nur Lesart 10–100 m; bestätigt über Distanz | Karte |
| Bahnen (`activeLengths`) | geliefert | n. z. | bestätigt über Distanz | Karte |
| Züge, Züge/Bahn, SWOLF, Zugfrequenz | geliefert | Züge, SWOLF, Zugfrequenz geliefert | in sich stimmig (Züge/Bahn × Bahnen = Züge; SWOLF-Definition; Züge je Bewegungsminute) → bestätigt | Karten |
| Zuglänge (`avgStrokeDistance`) | **0** → nicht geliefert | geliefert, **in cm**, stimmig | Becken: nicht geliefert · Freiwasser: bestätigt | nur Freiwasser |
| Tempo-Reihe | nicht geliefert (Distanzreihe leer) | geliefert | Plausibilitätsfilter | Freiwasser-Verlauf |
| Zugfrequenz-Reihe (`directSwimCadence`) | nicht geliefert | geliefert (`ext.series`) | — | Freiwasser-Verlauf |
| Route | nicht zutreffend | geliefert | — | wie bisher |
| Runden / Intervalle | `lapCount` 6–14, **nie abgefragt** (`DETAIL_EXTRAS` aus) | `lapCount` 1–2, nie abgefragt | — | nicht importiert (Grund in Messdetails) |
| Bahnen einzeln (`typed_splits`) | nie abgefragt; Form unbelegt | n. z. | gesperrt bis Mitschnitt | — |
| `splitSummaries` | nur Name in `unrecognized` (Inhalt nicht erhalten) | dito | Form unbekannt | — |
| Kalorien, Training Effect | geliefert | geliefert | ungeprüft | Messdetails / Karte |

### 7.2 Befunde

1. **Ursache bestätigt:** Die Schwimmfelder lagen in allen 6 Einheiten in `metrics.ext`, wurden aber nie geladen (lokaler Speicher ohne Rohblock). Kein Datenverlust beim Import für Summenwerte; verloren bzw. nie abgefragt sind nur Runden/Bahnen.
2. **Tempo-Grundlage unterscheidet sich je Umgebung:** Becken = Bewegungszeit (Listenfeld), Freiwasser = Timer. Die App übernimmt je Einheit genau die Grundlage, die zu Garmins `averageSpeed` passt; die andere Lesart erscheint nur bei echtem Unterschied (> 5 %).
3. **Sehr große Ruhezeiten im Becken** (z. B. 51:03 von 1:08:07): Folge der Garmin-Bewegungszeit (nur Schwimmlängen). Deshalb werden Tempo in Bewegung und Gesamttempo getrennt ausgewiesen.
4. **Hypothese 20.09.2026:** 1:16 /100 m und 19,8 Züge je „50-m-Bahn" passen nicht zu den übrigen Einheiten (1:48–2:26 /100 m auf 25 m bzw. 50 m). Wahrscheinlich war die Bahnlänge auf der Uhr falsch (25 m-Becken als 50 m). **Nicht korrigiert** — die Konsistenzprüfung kann das nicht erkennen (Längen × Bahnlänge stimmt mit der falsch eingestellten Länge). Prüfung in Garmin Connect nötig.
5. **Langzeitfreigabe:** alle Schwimmfelder bleiben im Leistungsregister `unverified`, bis eine Einheit gegen Garmin Connect verglichen ist (Abschnitt 5, Schritt 5). Keine Prognose und kein Rekord aus Schwimm-Quellwerten.

## 8 · Mitschnitt 18.10.2026 (Runden, Bahnen, Intervalle)

Dateien: `garmin-worker/tests/fixtures/garmin/captures/swimming__lap_swimming.json` (Einheit 11.10., 1.350 m, 25-m-Becken) und `swimming__open_water_swimming.json` (26.06., 900 m). Anonymisiert, ohne GPS; Selbstprüfung des Skripts und `test_capture_script` grün.

| Abruf | Becken | Freiwasser |
|---|---|---|
| `splits` (`get_activity_splits`) | `lapDTOs` 10 Runden = **3 Schwimm-Intervalle + 7 Pausen** (Distanz 0); je Runde `lengthDTOs` (78 Einträge, 54 aktiv) + `eventDTOs` (Timer) | 1 Runde, keine Bahnen |
| `typed_splits` | **leer** (`splits: []`) | leer |
| `split_summaries` | leer | leer |
| `hr_zones` | 5 Zonen mit `secsInZone`, `zoneLowBoundary` | dito |

Belegte Bedeutung (Test C8):
- Runde ohne Distanz = Pause; **Bahn ohne Distanz innerhalb einer Runde = Pause im Intervall** (Intervall 3: 46 aktive Bahnen, 14 Pausen-„Bahnen" mit 1.052 s).
- `Runde.movingDuration` = Summe der aktiven Bahnen; Summe über alle Runden = `movingDuration` des Listeneintrags (1.456,9 s). Das erklärt Garmins Bewegungszeit im Becken vollständig.
- `Runde.duration` enthält die Pausen im Intervall → **Intervall-Tempo nur auf movingDuration** (Intervall 1: 2:41 statt 5:43 /100 m).
- Summen stimmen exakt: Distanz 75+125+1.150 = 1.350 m, aktive Bahnen 3+5+46 = 54, Züge 72+90+511 = 673.
- `Bahn.averageSWOLF` = Züge + gerundete Sekunden (54/54); `Runde.averageSWOLF` = Mittel der Bahnen. Schreibweise in Runde/Bahn: `averageSWOLF` (Listeneintrag: `averageSwolf`).
- `Runde.averageSpeed` = Distanz ÷ movingDuration im Becken, Distanz ÷ Timer im Freiwasser (wie beim Listeneintrag).
- Je Bahn: `distance, duration, averageSpeed, maxSpeed, averageHR, maxHR, totalNumberOfStrokes, averageSWOLF, swimStroke, lengthIndex, startTimeGMT` — keine Zugfrequenz, keine Bewegungszeit. Lagen: FREESTYLE, BREASTSTROKE, BACKSTROKE; Runde mit gemischten Lagen = MIXED.
- **Nicht eindeutig**: `averageStrokes` und `averageSwimCadence` einer MIXED-Runde (13,9 bzw. 33 statt 11,1 Züge/Bahn bzw. 26,7 Züge/min aus den Bahnen) → bleiben ungeprüft.
- `averageStrokeDistance`: Runde in **m** (Freiwasser 0,82), Listeneintrag in **cm** (82); Becken 0 → nicht in die schlanke Form übernommen.
- **Plausibilität**: 7 von 54 Bahnen unter 15 s je 25 m (schnellste 11,8 s ≈ 0:47 /100 m), 9 Bahnen mit ≤ 5 Zügen. Für diese Einheit (Median 24,9 s, 12 Züge) unplausibel — vermutlich Wenden-/Bahnerkennung der Uhr. Nicht korrigieren, in der App markieren; vor Validierung keine Bestzeiten je 25/50 m aus Bahnen.

Worker-Prüfung am Mitschnitt (C9, echter Sync-Pfad): schlanke Runden mit Schwimmfeldern (3,6 kB, landet auch im lokalen Speicher), Rohblock mit allen Bahnen (24 kB, nur Server/bei Bedarf), Befund `ext.extras.splits = ok`, Rohfelder des Listeneintrags unverändert, kein privates Feld, keine Kappung (`keep_structure`: Runde 23 bzw. 31 Schlüssel < 80).

## 9 · v8-453 Schwimmintervalle, Pausen, Bahnen (live)

Kette: `metrics.splits` (schlanke Runden, lokal) + `metrics.ext.splits` (Rohrunden mit Bahnen, bei Bedarf vom Server) → `engine/swim-intervals.js` (`swim-intervals@1`, rein) → `activity-analysis.analyze().swim` → ui.js zeichnet nur. Kein Eingriff in Register, Bestzeiten, Korrekturen, Flags, Worker.

| Größe | Rechnung | Herkunft |
|---|---|---|
| Schwimmzeit je Intervall | `movingDuration` der Runde; sonst Summe der aktiven Bahnen; sonst **keine** | gemessen (Garmin) / Summe |
| Intervallzeit | `duration` der Runde (inkl. Pausen im Intervall) | gemessen |
| Pause im Intervall | Summe der Bahnen ohne Distanz; ohne Bahnen: Intervallzeit − Schwimmzeit | gemessen / abgeleitet (benannt) |
| Pausenrunde | Runde mit Distanz 0 — nie einem Intervall zugeschlagen; aufeinanderfolgende = ein Pausenblock (Anzeige) | gemessen |
| Schwimmtempo | Schwimmzeit ÷ Distanz × 100 | abgeleitet |
| Intervall-Tempo inkl. Pausen | Intervallzeit ÷ Distanz × 100 — nur angezeigt, wenn keine Schwimmzeit vorliegt, dann ausdrücklich „inkl. Pausen" | abgeleitet |
| Züge je Bahn | Züge ÷ aktive Bahnen — **nur bei einer Lage** | abgeleitet |
| SWOLF | Garmin je Bahn/Intervall; Gegenprobe Bahn = Züge + Sekunden (± 1), Intervall = Mittel der Bahnen | gemessen, geprüft |
| Gleichmäßigkeit | Variationskoeffizient des Schwimmtempos, nur ≥ 3 Intervalle ≥ 50 m **derselben bekannten Lage** | abgeleitet |

Lagen: Garmin-Werte FREESTYLE / BREASTSTROKE / BACKSTROKE / BUTTERFLY / MIXED → Kraul / Brust / Rücken / Schmetterling / Gemischt; alles andere „Lage unbekannt" (Rohwert bleibt). Nie aus Tempo oder Zugzahl geschätzt. Intervall gemischt, wenn Garmin MIXED liefert oder die Bahnen mehrere Lagen tragen.

Plausibilität je Bahn (nie korrigiert): *ausgeschlossen* = schneller als der Weltrekord-Schnitt der Lage (50 m Kurzbahn: 2,47 / 2,26 / 2,00 / 2,35 m/s); *möglicherweise ungenau* = ≥ 1,6 × eigener Median derselben Lage und Bahnlänge, ≤ 40 % der eigenen Median-Zugzahl, 0 Züge oder SWOLF-Widerspruch; *plausibel* = mit ≥ 5 Vergleichsbahnen geprüft; *ohne Vergleich* sonst. Keine Bahn ist gegen Garmin Connect validiert; nichts davon geht in Rekorde, Bestzeiten oder Prognosen (Register-Ledger `false`).

Einheit 11.10.2026 (echter Mitschnitt): Intervalle 75 / 125 / 1.150 m mit **2:41 / 2:29 / 1:40 /100 m** (v8-452: 5:43 / 3:41 / 3:11), Pausen im Intervall 2:17 / 1:29 / 17:32, Pausenblöcke 7:02 (4 Runden) / 7:27 / 9:27. Summen 1.350 m · 54 Bahnen · 673 Züge · 1.456,9 s; Zeitbilanz Schwimmzeit + Pausen = Timer (4.170,6 s). 11 von 54 Bahnen auffällig (10 möglicherweise ungenau, 1 ausgeschlossen: 25 m Brust in 12,3 s). SWOLF-Verlauf Kraul (28 plausible Bahnen): 42 → 44.

Oberfläche: Verlauf mit „Tempo je Bahn" / Puls / „SWOLF je Bahn" (auffällige Bahnen = Lücke) · Karte „Intervalle" mit Zusammenfassung (Schwimmzeit, Pausen gesamt, Tempo), Intervallkarten und Pausenblöcken · Bahnen erst beim Antippen eines Intervalls (eine Tabelle, Pausenbahnen grau, auffällige mit „≈") · Messdetails: Zeitdefinition, Pausenerkennung, Summenprüfung, Plausibilität, Validierung. Ohne Runden (heutige Produktion): kein Intervall-Block, Ansicht wie v8-452. Bahnen kommen nach, sobald der Rohblock geladen ist; keine Duplikate (nur Anzeige, nichts gespeichert).

Tests: `swim_intervals_v453` (53, echter Mitschnitt, 50-m-Becken, Fehlerfälle, Register), `swim_intervals_v453_ui_e2e` (23, 320–1200 px). App-Testdaten `supabase/tests/fixtures/swim_capture_v453.json` = Worker-Ausgabe (`garmin-worker/scripts/gen_app_swim_fixture.py`, Gleichheit: `test_v453_app_fixture.py`).

## 10 · v8-454 Universelle Intervalle Laufen · Rad · Schwimmen (live)

### 10.1 Audit echter Einheiten (Mitschnitt 19.10.2026, `capture_activity_payloads.py --interval-audit`)

Belegt an 2 Läufen (Workout-Lauf 17 km mit 4 Schritten, gleichmäßiger Lauf 3,3 km) und 3 Radfahrten (Rennrad 27,6 km mit 6 Auto-Runden, Rad 4,8 km eine Runde, Zwift 1:02 h eine Runde). Rohdaten: `garmin-worker/tests/fixtures/garmin/captures/{running,cycling}__*.json`; App-Testdaten `supabase/tests/fixtures/run_ride_capture_v454.json` = Worker-Ausgabe (Gleichheit: `test_v453_app_fixture.py`).

Spalten: **geliefert** = im Garmin-Rohabruf vorhanden · **verarbeitet** = Worker v8-454 übernimmt es · **gespeichert** = heute in Produktion in `activities.metrics` · **geladen** = App liest es · **geprüft** = Gegenprobe mit Beleg · **sichtbar** = v8-454-Oberfläche.

| Kennzahl | geliefert | verarbeitet (v8-454) | gespeichert heute | geladen | geprüft (Beleg) | sichtbar |
|---|---|---|---|---|---|---|
| Runden: Distanz, Timer, Gesamtzeit, Bewegungszeit | Lauf + Rad (`lapDTOs`) | ja (schlank + Rohblock) | **nein** (nur Schwimmen) | ja | Summe = Einheit: Lauf 17.002 / 17.002 m, Timer 6.066 / 6.064 s; Rad 27.604 / 27.604 m, 4.070 / 4.071 s | Karten, Zeitstrahl |
| Runden: Ø/Max-Puls | ja | ja | nein | ja | gegen Messreihe: 17 + 4 + 6 + 1 + 1 Runden „stimmt", 1 ohne Reihe | Karte (Rad), Detail |
| Laufkadenz je Runde (`averageRunCadence`, voller spm-Wert) | ja | ja | nein | ja | gegen Kadenzreihe (ohne Nullen): 15 gemessen + passend, 2 abgeleitet, 1 ohne | Detail (mit Qualität) |
| Schrittlänge je Runde | ja | **nein** | nein | nein | widersprüchlich zur Kadenz × Tempo → gesperrt | nein |
| Radkadenz je Runde | nur Zwift | ja | nein | ja | gegen Reihe (Zwift) | Detail |
| Leistung je Runde (Ø, Max, NP) | nur Zwift | ja | nein | ja | Ø gegen Leistungsreihe (Zwift); Max/NP **ungeprüft** | Detail; Hero nur bei gemessener Leistung |
| Höhenmeter je Runde | ja | ja | nein | ja | **ungeprüft** (Barometer, keine Gegenprobe) | Detail „ungeprüft"; Ausschluss im Vergleich |
| Max. Geschwindigkeit je Runde | ja | ja | nein | ja | nur Plausibilität (≤ 1,6 × Ø) | „Bestes Tempo" ungeprüft |
| `intensityType` je Runde | ja | ja | nein | ja | **unzuverlässig, wenn einheitlich** (Workout-Lauf: alle ACTIVE; normaler Lauf: alle INTERVAL) → zählt nur mit ≥ 2 Arten | nur als Einordnung |
| Workout-Schritt je Runde (`wktStepIndex`) | Lauf mit Workout | ja | nein | ja | Schrittgruppen = Garmin-Intervallantwort (4 / 4 / 8 / 2 Runden) | Abschnitte |
| Intervallantwort (`typed_splits`: INTERVAL_*, `lapIndexes`) | Lauf; Rad nur Untergrund; Schwimmen leer | **nur Laufen** | nein | ja | Summen der Runden je Schritt = Schrittwerte | Abschnitte / Intervalle |
| Messreihen (Puls, Tempo, Kadenz, Leistung, Höhe) | ja | unverändert seit v8-447 | **ja** | ja | v8-452 | Diagramme |
| Leistung Einheit (Rad draußen) | **nein** (kein Leistungsmesser) | — | — | — | — | nie geschätzt; kein Leistungs-Hero |

Befund: In Gians echten Daten gibt es **keine** echte Belastungs-/Erholungs-Einheit. Der Workout-Lauf hat 4 gleichartige „ACTIVE"-Schritte (6:50 / 6:07 / 5:16 / 7:05 /km), die Radfahrten Auto-Runden oder eine Runde, draußen ohne Leistung. Belastung/Erholung ist deshalb nur synthetisch (mit den belegten Feldnamen) getestet.

Die Konsolen-Prüfung `app/tools/activity-audit-run-ride-console.js` (nur lesend, im eingeloggten Browser) steht noch aus — sie belegt den **gespeicherten** Stand aller Lauf-/Radeinheiten.

### 10.2 Kette und Engine

`metrics.splits` (schlanke Runden, lokal) + `metrics.ext.splits` / `ext.typed_splits` (Rohblock, bei Bedarf vom Server) + Messreihen → `engine/intervals.js` (`intervals@1`, rein, keine DOM-/Speicherzugriffe) → `activity-analysis.analyze()` (`intervals`, `timeline`, `efficiency`) → ui.js formatiert nur. Schwimmen delegiert unverändert an `swim-intervals.js` (v8-453). **Eine** Engine, keine zweite.

1. **Normalisierung** `lapsOf`: schlanke und Rohrunden über `lapIndex` zusammengeführt; Altbestand aus der verknüpften Trainingssession (`km/sec/hr`) mit Herkunft `legacy_session`. Kaputte Runden (Text, null, negative Distanz, ohne Zeit) fallen weg — nichts geraten.
2. **Identifikation** `classify` (Runden) und `stepsOf` (Abschnitte):
   - Garmin-Einordnung (`intensityType`) nur bei ≥ 2 verschiedenen Arten → Herkunft `garmin`.
   - Garmin-Auslöser (`lapTrigger`) → manuell / automatisch laut Garmin.
   - Gleich lange Runden (± 1,5 %, ≥ 3 bewegte, letzte ≤) → `auto_lap`, Herkunft `rule`.
   - Belastung/Erholung aus Wechseln: Laufen über Tempo (Lücke ≥ 1,2 ×), Rad **nur mit gemessener Leistung** (≥ 1,3 ×); in sich geschlossen (Verhältnis ≥ 1,08, Größen-Streuung ≤ 25 %); sonst `unknown`.
   - Abschnitte: Intervallantwort (≥ 2 INTERVAL_*-Einträge, Runden über `lapIndexes`) oder `wktStepIndex`-Gruppen. Alle gleich (z. B. alles ACTIVE) → „Abschnitt", **keine** erfundene Belastung/Erholung.
   - Herkunft je Abschnitt: `garmin` / `rule` / `none`; `plan` ist vorgesehen, wird aber noch nicht befüllt (keine Planverknüpfung je Runde).
3. **Zeitsemantik** (getrennt, nie verrechnet): *Timer* (`duration`, Uhr läuft) = Grundlage für Tempo/Geschwindigkeit; *Gesamtzeit* (`elapsedDuration`) = Breite im Zeitstrahl; *Bewegungszeit* (`movingDuration`); *Uhr angehalten* = Gesamtzeit − Timer (berechnet). Ohne Timer: Gesamtzeit als Grundlage, ausdrücklich `timeBasis: elapsed`. Beispiel Abschnitt 2 des Workout-Laufs: Timer 24:29, Gesamtzeit 32:29, 7:59 angehalten — Tempo 6:07 /km auf dem Timer.
4. **Sportmetriken** je Abschnitt/Runde: Tempo/Geschwindigkeit, Puls (+ Gegenprobe Reihe), Kadenz (gemessen / abgeleitet / ungeprüft), Leistung nur wenn gemessen (Ø / Max / NP), Höhenmeter, bestes Tempo (≤ 1,6 × Ø).
5. **Qualität** je Runde, nie korrigiert: schneller als Weltrekord-Schnitt, Rad > 90 km/h draußen, Puls weicht von der Reihe ab.
6. **Analyse** `analyticsOf` — nur vergleichbare Gruppen:
   - Kandidaten: Belastungen; sonst Auto-Runden ohne die Teilrunde am Ende; bei Abschnitten ohne Vergleich die gleich langen Runden im längsten Abschnitt („Kilometer in Abschnitt 3").
   - Rad ohne Leistung: **kein** Vergleich (Wind, Gelände, Ampeln) — `no_power`.
   - Gruppe: gleiche Distanz ± 7 % (Rad-Belastungen: gleiche Dauer); Ausschluss bei Gelände (Höhenmeter/km > 15 m vom Median) und Stillstand (Bewegungszeit < 90 % Timer), Anzahl genannt.
   - Ergebnis: Streuung (CV), schnellste/langsamste mit der Nummer, die auf der Karte steht (Belastung n bzw. Runde n), Verlauf per Regression — **nur** bei ≥ 4 Belastungen bzw. ≥ 5 Runden, |Änderung| ≥ 3 % und R² ≥ 0,5, formuliert als Beobachtung („über die Wiederholungen 7,1 % langsamer"), nie als Form-/Fitnessurteil. Puls erste → letzte.
7. **Darstellung**: Zeitstrahl (Breite = Gesamtzeit, sonst Timer, benannt; fehlt eine Dauer → kein Zeitstrahl).

### 10.3 Neugestaltung der Aktivitätsseite (Lauf, Rad, Schwimmen)

A Hero: **eine** große Zahl (Laufen/Schwimmen/Rad draußen: Distanz; Rad drinnen mit Leistung: Ø Leistung) · B höchstens 3 Kennzahlen darunter · C Diagramme (Rad drinnen ohne Geschwindigkeit/Höhe; Tempo-Ausreißer > 2 × Median als Lücke) · D Zeitstrahl: Breite = Dauer, Art über Füllung **und** Muster (Erholung schraffiert, Auf-/Auslaufen Verlauf + Linie) **und** Legende, antippbar → markiert die Karte, für Screenreader `role=img` mit Klartext · E kompakte Karten (2 Zeilen: Hauptwert + Tempo/Geschwindigkeit, darunter Zeit · Art), echte Knöpfe mit `aria-expanded` · F Details erst beim Aufklappen (Raster mit Qualitätsangabe, Runden-Tabelle; Inhalt wird erst dann gebaut) · G „Alle Kennzahlen" und Messdetails eingeklappt. Bis 16 Einträge alles sichtbar, darüber 12 + „Alle n anzeigen".

Datenqualität sichtbar als: gemessen (ohne Marke) · berechnet · geschätzt · ungeprüft · möglicherweise fehlerhaft · nicht verfügbar.

### 10.4 Schutz von Register und Bestzeiten

`run-bests.js` liest Runden aus `metrics.splits` **nicht**, wenn `splits_source = 'garmin_splits'` — Garmin-Runden können keine Bestzeit erzeugen oder überschreiben. Register (5 km aktiv 23:38, 10 km aktiv 57:55, 5 km gesamt 29:11, 10 km gesamt 1:01:49) mit hinzugefügten Garmin-Runden unverändert: `intervals_v454` L1–L6. Prognosen, Zonen, Korrekturen, Historien unberührt. Deshalb **App v8-454 vor jedem Lauf-/Rad-Nachholen** ausliefern.

### 10.5 Worker v8-454 (vorbereitet, nicht ausgerollt)

- `typed_splits` nur noch für **Laufen** (Rad liefert nur Untergrund, Schwimmen leer).
- Schlanke Runden tragen zusätzlich `RUN_BIKE_LAP_FIELDS` (Lauf-/Radkadenz, Leistung Ø/Max/NP, Höhenverlust, Max-Geschwindigkeit, Workout-Schritt).
- Ohne Änderung der Railway-Variablen verhält sich v8-454 wie v8-452.1 (`DETAIL_EXTRAS_SPORTS=swimming` → Lauf/Rad bekommen nichts).

Freigabe-Reihenfolge (nur nach ausdrücklicher Freigabe durch Gian):
1. App v8-454 ausliefern (`deploy.sh`, Suite-Marker = HEAD) — Bestzeitenschutz liegt in der App.
2. Konsolen-Prüfung `activity-audit-run-ride-console.js` ausführen und Ergebnis prüfen.
3. Sicherung: `supabase/scripts/v454_runbike_extras_backup.sql`.
4. `railway up` → `/healthz` meldet `worker: v8-454` (ohne neue Variablen ändert sich nichts).
5. Railway: `DETAIL_EXTRAS=splits,typed_splits`, `DETAIL_EXTRAS_SPORTS=swimming,running,cycling`, einmalig `DETAIL_REFETCH_EXTRAS=1` → Protokoll `extras_pending:` fällt auf 0 (je Lauf höchstens `DETAIL_BACKFILL_LIMIT`; bei 429 später weiter).
6. Kontrolle: `v454_runbike_extras_check.sql` (fremde Runden unverändert, Rad ohne Intervallantwort, keine andere Sportart betroffen).
7. `DETAIL_REFETCH_EXTRAS` löschen.
8. In der App: Bestzeiten-Seite unverändert (23:38 / 57:55 / 29:11 / 1:01:49).

Rückweg: `DETAIL_EXTRAS_SPORTS=swimming` (stoppt Lauf/Rad sofort) → `v454_runbike_extras_rollback.sql` (entfernt bei Lauf/Rad genau Runden/Intervalle, Schwimmen und fremde Runden bleiben) · Notfall: `v454_runbike_extras_restore.sql` (Stand der Sicherung, aktuelle Korrekturen bleiben) · Worker: vorige Bereitstellung (v8-452.1) in Railway erneut ausrollen. Alle vier SQL-Dateien gegen echtes Postgres getestet (`test_v454_runbike_sql.py`).

### 10.6 Tests

`intervals_v454` (49: echte Einheiten, synthetische Workouts, Zeitsemantik, fehlende Daten, Leistung/Indoor, Register, Quellvertrag, 50 Runden), `intervals_v454_ui_e2e` (40: Hero, Zeitstrahl, Antippen, Aufklappen, Tastatur, Rad/Zwift, 50 Runden, Rohblock fehlt, 320–1200 px), Worker `test_v454_runbike_sql.py` (Umfang des Nachholens, Sicherung/Kontrolle/Rückweg/Wiederherstellung auf Postgres) sowie angepasste v452/v453/v447/visual-Tests.

## 11 · v8-454.1 Premium Activity Experience (live · Build orvia-v8-455)

Gilt für Laufen, Rad, Schwimmen (`gmAxPageHtml` in ui.js, CSS-Block „v8-454.1" am Ende von styles.css, `js/activity-chart.js`). Alle übrigen Sportarten behalten die bisherige Seite. Die Seite rechnet nichts: sie formatiert das Modell (`activity-analysis@2` → `intervals` / `swim-intervals` → `metric-eligibility`).

### 11.1 Befunde der Bestandsanalyse (v8-454, echte Mitschnitte, 390 und 1440 px)

| Problem | Ursache im Code | Lösung |
|---|---|---|
| Titel dreimal (Kopfleiste, Kennzeichen, Überschrift) | `page-head` + `detail-title` + `plan-kicker` | Titel genau einmal im Hero; Kopfleiste nur „Zurück"; Kennzeichen entfällt, wenn der Titel die Sportart wiederholt |
| Verwaltung vor der Analyse | Debrief/Plan-Zuordnung direkt nach dem Hero | Reihenfolge = Hierarchie (11.2); Korrektur/Löschen am Ende |
| Kachelwand, Qualitätsetikett an jeder Zahl | `aa-card` + `aa-q`-Pillen | Hero ohne Flächen; Bibliothek als gruppierte Zeilen; Qualität als 7-px-Ring + Vorlesetext, Erklärung beim Antippen |
| kleines Diagramm, schwache Achsen | Chart.js-Karte 180 px, Index-Achse | eigenes SVG-Diagramm 220/260/300 px, Zeitachse, Fadenkreuz, Tooltip, Tastatur, Vergleich |
| Desktop = Telefonspalte | `.gm-page{max-width:430px}` | `.ax-page` bis 1240 px (≥ 1440: 1320), Mehrspalten ab 1024 px |
| „Leistungskurve: [object Object]" | `gmAaFmt` default `String(v)` für die Struktur `best_efforts.power.windows` | eigener Fall `powerCurve` („n Zeitfenster"), jede andere Struktur „n Einträge" — nie ein Objekt als Text |
| Zwift: Timer 1:13:21 = Gesamtzeit, Uhr angehalten 0 s | Timer aus dem Ende von `sumDuration` der Detail-Antwort | siehe 11.3 |
| Max. Leistung 214 W (Seite) vs. 326 W (Garmin) | Rückfall „Maximum der Reihe" auf die ausgedünnte Reihe | Garmin-Wert zuerst; aus ausgedünnter Reihe kein Maximum |
| Leistungskurve 164 W statt Garmins 162 W (30 s) | Worker-Näherung aus 2-s-Abtastung | Garmins `maxAvgPower_*` zuerst (11.4) |
| Debrief zeigt beim Rad einen Läufer | Symbol fest `run` | `run` nur bei Tempo-Sportarten, sonst neutral |
| dunkler Fleck am unteren Rand (hell deutlich) | Schatten geschlossener Blätter (`.sheet` bei translateY 102 %) | Schatten nur bei offenem Blatt |
| heller Modus: Titel dunkel auf dunkel | Seite nutzte feste dunkle Farben | eigene Tokens `--ax-*` für hell/dunkel (Kontrast geprüft) |

### 11.2 Informationshierarchie

1. **Kopfbild**: echte GPS-Strecke = Kartenfeld (Gestaltung v8-441 unverändert, volle Breite); virtuelle Strecke = Linie ohne Landkarte mit „Virtuelle Strecke (Spielwelt, kein GPS)"; Schwimmen ohne Strecke = Wellenfeld.
2. **Hauptleistung**: Kennzeichen (Sportart · Umgebung), Titel einmal, Datum; eine Hauptzahl (Distanz bzw. gemessene Ø-Leistung bei Rolle/virtuell); höchstens drei Kennzahlen; „Highlights ansehen" und „Garmin ⓘ" (öffnet die Datenherkunft).
3. **Verlauf**: Diagramm mit Reitern je Messreihe, „Ø im Diagramm" + Bereich (aus genau den gezeichneten Punkten — keine Vermischung mit Garmin-Summenwerten), Achse benannt (Gesamtzeit / je Bahn), optional Vergleich mit einer zweiten Reihe derselben Zeitachse (eigenes Diagramm darunter, gemeinsames Fadenkreuz — nie zwei y-Achsen).
4. **Intervalle/Runden**: Zeitstrahl (Werkzeugleiste, ein Tab-Halt, Pfeiltasten), Spaltenkopf mit Einheit, Zeilen aus Nummer + drei Werten (Laufen: Distanz · Zeit · Tempo; Rad: Zeit · Distanz · Leistung bzw. km/h; Schwimmen: Distanz · Schwimmzeit · Tempo /100 m). Art über das Zeichen links (gleiches Muster wie im Zeitstrahl) und den Vorlesetext. Details erst beim Aufklappen.
5. **Analyse**: Gleichmäßigkeit (nur vergleichbare Gruppen, Nummern wie auf den Zeilen), Leistung je Dauer, Zeit in Pulszonen.
6. **Trainingsbewertung**: Debrief, Plan-Zuordnung.
7. **Alle Kennzahlen** (Telefon eingeklappt, Desktop offen): Gruppen Leistung · Herzfrequenz · Bewegung · Zeiten (mit Definition) · Trainingsbelastung · Weitere; Zeile antippen = Quelle, Prüfstand, Grund.
8. **Datenherkunft** (eingeklappt): Quelle, Umgebung, Messreihen (gespeichert/geliefert), Zeitdefinitionen, Widersprüche, virtuelle Werte, „ungeprüft"-Definition, geliefert-aber-nicht-angezeigt, nicht verfügbar; darunter Einstellungen (Aufzeichnung lösen, Dauer korrigieren, vom Plan lösen, löschen).

Layout: 320–767 px eine Spalte; 768 px größere Typografie, Bibliothek zweispaltig; ≥ 1024 px Hauptzahl neben den Kennzahlen, Intervalle und Analyse/Bewertung nebeneinander, Diagramm über die volle Breite (300 px hoch); ≥ 1440 px Bibliothek dreispaltig.

### 11.3 Zeitquellen (Zwift 07.10.2026, echter Mitschnitt)

| Quelle | Feld | Wert |
|---|---|---|
| Listeneintrag / Zusammenfassung / Runde | `duration` | 3734 s (1:02:14) |
| Listeneintrag / Zusammenfassung / Runde | `elapsedDuration` | 4401 s (1:13:21) |
| Listeneintrag / Zusammenfassung / Runde | `movingDuration` | 3698 s (1:01:38) |
| Detail-Antwort (Messzeilen) | `sumDuration` letzte Zeile | 4401 s — **läuft in jeder Zeile gleich `sumElapsedDuration`** |
| Detail-Antwort | Zeitstempel | 3 Lücken ohne Messzeile: 191 s, 234 s, 249 s (674 s) |
| Detail-Antwort | `totalMetricsCount` | 3734 Messpunkte (1/s) |

Folgerung: Die Detail-Uhr hält bei dieser Aufzeichnung nicht an; sie ist dort keine Timer-Zeit. Regel (`metric-eligibility` `timer`): Weicht die Aufzeichnung um > 5 s / 1 % von der Zusammenfassung ab **und** ist sie gleich der Gesamtzeit, gilt die Zusammenfassung — mit `conflict {series, summary, elapsed, use:'summary', reason:'series_timer_without_stops'}`; jeder andere Widerspruch lässt die Aufzeichnung stehen, Prüfstand „ungeprüft". Manuell korrigierte Dauer: kein Ersatz. Kein Garmin-Wert wird verändert; die Seite nennt den Widerspruch in der Dauer-Zeile und in der Datenherkunft. Folge: „Uhr angehalten" = 667 s (11:07) statt 0 s. Läufe (Abweichung ≤ 2 s) unverändert.

Weitere Prüfung derselben Einheit: Ø-Leistung 112 W (Garmin) = Mittel aller 1.877 gelieferten Zeilen 112,4 W; Max 326 W = Maximum der Zeilen; NP 116 W ungeprüft (aus 2-s-Abtastung nicht nachrechenbar); virtuelle Distanz 14,28 km = `sumDistance` letzte Zeile; Max-Geschwindigkeit 45,9 km/h und Höhenmeter 395 m aus der Spielwelt (gekennzeichnet „(virtuell)"); Diagrammwerte = gespeicherte Reihe (269 von 1.877 Punkten, Hinweis im Diagramm), Zeitachse Gesamtzeit mit Lücken als Linienbruch.

Worker: unverändert (Freigabe nötig). Vorschlag für einen späteren Worker-Schritt: `timer_duration_s` bei dieser Konstellation aus dem Listeneintrag statt aus `sumDuration`.

### 11.4 Leistungskurve

`powerCurve`: zuerst Garmins Bestwerte des Listeneintrags (`maxAvgPower_1 … _3600`, aus allen Messpunkten, Quelle „Garmin (Zusammenfassung)", ungeprüft), sonst die Näherung des Workers (`best_efforts.power`, „≈", Lücken als 0 W benannt). Validierungsregeln (`evaluate('powerBest')`) unverändert; nichts geht ins Register.

### 11.5 Datenqualität sichtbar

gemessen (ohne Zeichen) · berechnet (gepunkteter Ring) · geschätzt (gepunkteter Ring) · ungeprüft (Ring) · möglicherweise fehlerhaft (gefüllter Ring, Warnfarbe) · nicht verfügbar (Datenherkunft). Jede Zeile nennt beim Antippen Quelle und Prüfstand; Hero-Werte tragen den Ring mit Vorlesetext.

### 11.6 Tests

`activity_experience_v4541` (34: Zeitquellen, Leistung, Bibliothek, Diagramm-Geometrie, Register, Quelltext), `activity_experience_v4541_ui_e2e` (41: Hierarchie, Renderfehler in allen Sportarten, Zwift, Diagramme mit Zeiger/Tastatur/Vergleich, Bibliothek, hell/dunkel/Kontrast, reduzierte Bewegung, 320–1440 px). Angepasst an die neue Struktur (gleiche Regeln): `visual_v3_e2e`, `activity_theme_e2e`, `data_integrity_v447_e2e`, `activity_analysis_v452_ui_e2e`, `swim_intervals_v453_ui_e2e`, `intervals_v454_ui_e2e`. Testdaten tragen jetzt den Details-Stand (`detailsVersion`), wie die Produktion.


## 12 · v8-456 Unified Activity Experience Quality Pass + Teilen aus den Highlights (live · Build orvia-v8-456)

Status: IMPLEMENTIERT im Repo, NICHT deployt. Keine Migration, kein Worker-Rollout, keine Railway-Änderung, keine Änderung an
Rekordberechnung, Rohdaten, Korrekturen oder Plan-Zuordnungen.

### 12.1 Eine Ansicht für alle Sportarten
- `gmOpenActivityPage` führt **jede** Sportart mit Analyse-Modell in die gemeinsame Ansicht (`gmAxPageHtml`). Vorher: nur
  Laufen/Rad/Schwimmen; Kraft und alle anderen auf der Altseite.
- Kraft: Hauptzahl Volumen (Zusammenfassung; fehlt sie, dieselbe Satz-Summe wie bisher `gmActGymAgg`, als „berechnet"
  gekennzeichnet), dann Dauer · Sätze · RPE. Abschnitt „Übungen & Sätze" (`gmActGymRowsHtml`, EINE Funktion für beide
  Seitenfassungen, inkl. Nachladen aus der Cloud und Satz-Diagnose). Sonstige: Dauer, Distanz, Puls; echte Runden als Liste.
- Erhalten: Dauer korrigieren, gekoppelte Aufzeichnung, Debrief, Plan-Zuordnung, Highlights, Lösen/Löschen, Trainingslast.
- Anzeigemodus (`uiDetailMode` → `gmLevel`) steuert NUR die Startaufklappung: Anfänger zu, Profi „Alle Kennzahlen" und
  „Datenherkunft" offen, Fortgeschritten am Desktop Kennzahlen offen. Gleiche Werte, gleiche Rechnung in allen Modi (Test M2).

### 12.2 Diagrammsystem `activity-chart@2`
- Kein schwebender Hinweis mehr. Auswahl = Punkt + Führungslinie; Wert steht in der **festen Ablesezeile über dem Diagramm**
  (`#gmAxRead`): Position („Kilometer 12,4 · 32:41", „Bahn 25 · 25 Meter · 31 Sekunden · Kraul") · Wert · Vergleichswert ·
  Kennzeichnung („Stillstand", „möglicherweise ungenau: …"). Vorlesen gedrosselt über `aria-live`.
- Kopf: Ø/Max/Anstieg der **ganzen Aktivität** (`chart.ref` → `md.metrics`); nur ohne Kennzahl „Ø im Diagramm".
  Gestrichelte Ø-Linie = derselbe Wert (nur bei gleicher Einheit).
- Markierte Punkte gehören nie zur Linie, bleiben sichtbar und wählbar: `stop` (≤ 0,3 m/s, Strich am Grund, auch ohne Wert),
  `flag`/`excl` (Bahn möglicherweise ungenau / ausgeschlossen, Grund beim Antippen), `out` (außerhalb der robusten Tempoachse
  2.–98. Perzentil ± 15 %, Dreieck am Rand).
- Zeitachse: Abschnitte ohne Messwerte (Zeitsprung > max(3 × Median, 60 s)) → Umschalter „Aktive Zeit" (Standard, Lücke auf
  einen Messabstand verkürzt, gestrichelt) | „Gesamtzeit" (volle Achse, schattierte Fläche). Nie gemischt.
- Vergleich nur zwischen Reihen derselben Messpunkte (gleiche Achse, gleiche Länge) — jetzt auch Tempo ↔ SWOLF je Bahn.
- Tastatur: Reiter mit Pfeiltasten (roving tabindex), Diagramm ← → Pos1 Ende (Umschalt = 10), Esc. Touch: Wählen nur mit
  gedrücktem Finger, vertikal scrollt. Tab/Vergleich/Achse bauen nur den Verlauf neu (Scrollposition und Fokus bleiben).

### 12.3 Pausen und Zeitachsen (P0)
- `metric-eligibility` gibt der Pause eine Belegstärke `evidence`: `timer_counter` (Garmin-Timer belegt angehaltene Uhr),
  `unclear` (Garmin-Zeiten widersprechen sich: Messreihe = Gesamtzeit), `derived_only` (nur Gesamt − Dauer), `none` (≤ 2 s).
- **Zwift 07.10.:** 11:07 bleibt sichtbar, heißt aber „Zeit ohne Aufzeichnung — Ursache nicht eindeutig" (nicht mehr „Uhr
  angehalten"). Die 3 Abschnitte ohne Zeilen (191/234/249 s) sind im Diagramm markiert. Ob Pause oder Aufzeichnungslücke:
  mit den vorhandenen Daten NICHT entscheidbar → offen.
- **HM 06.09. (Tempo-/Kadenzeinbrüche):** 1 Hz, keine Zeitsprünge; Bewegung − Timer = 163 s. Wahrscheinlichste Ursache:
  Stillstandszeilen, die durch die Punktauswahl des Workers (jede n-te Zeile) als einzelne Einbrüche erscheinen. Seit v8-456 als
  Stillstand markiert statt als Linieneinbruch; nichts gelöscht. **Nicht verifiziert** gegen die Produktionszeile → Konsolen-Audit
  `app/tools/activity-dips-console.js` (nur lesen) für Gian.
- v8-454 löschte Tempopunkte > 2 × Median (Linie brach). Seit v8-456: Werte 100–3600 s/km bleiben Messwerte; Darstellung über
  die robuste Achse.

### 12.4 Schwimmen
- Bahnen je Diagramm: alle Bahnen sind Punkte; auffällige als Ring/Kreuz mit Grund; Ø und Bereich nur aus plausiblen Bahnen.
- Wellenfeld: wird in der gemessenen Breite gezeichnet (`gmActWavesFit`, 1 Einheit = 1 px). Ursache des Desktop-Zerfalls:
  390-px-Feld per viewBox auf ~1300 px gestreckt + `non-scaling-stroke` + `pathLength`-Strichmuster. Danach langsame Drift;
  „Bewegung reduzieren" = still.
- Highlights: Pausenrunden zählen nie. Rundenseite = Intervalle **derselben Lage** ≥ 50 m (dieselbe Gruppe wie die
  Gleichmäßigkeit). Vorher „Schnellste Runde 0:01" aus einer 0-m-Pausenrunde.

### 12.5 Rad
- Zwift-Strecke: wieder im vollen Kartenfeld eingepasst (route-map mit `tiles:false`), ohne Landkarte, „Spielwelt"-Kennzeichnung
  bleibt. Ursache der Regression v8-454.1: Linienzeichnung mit eigenem dunklen Rechteck, nicht eingepasst.
- Watt: Überschrift 112 W / Max 326 W aus der Aktivität; Diagrammpunkte erreichen 214 W (Auswahl von 269 aus 1.877 Zeilen) →
  Hinweis, keine zweite Wahrheit.
- **Vorschlag Worker (NICHT umgesetzt, Freigabe nötig — Worker ist geschützt):** `_sample_indices` (jede ceil(n/300)-te Zeile)
  durch eimerweise Auswahl ersetzen, die je Eimer Min und Max (Leistung, Puls) und eine Stillstandszeile behält
  (LTTB-ähnlich, ≤ 300 Punkte, gemeinsamer Index). Effekt im Zwift-Mitschnitt: Max im Diagramm 326 statt 214 W. Benötigt
  Worker-Tests + Neuabruf; ändert keine gespeicherten Kennzahlen.

### 12.6 Laufen und Bestzeiten in den Highlights
- Highlights-Bestzeit (`gmStoryPbOf`, auch für das Teilen): Kategorie wie im Register — „Aktive Trainingsbestzeit" (Timer) oder
  „Bestzeit einschließlich Pausen"; alle Distanzen bis Marathon; längste Distanz gewinnt, bei gleicher die aktive. Zeitformat
  h:mm:ss (vorher „61:49"). HM-Fall: „10 km 1:01:49" erscheint nur noch als „Bestzeit einschließlich Pausen"; die aktive
  10-km-Bestzeit 57:55 stammt aus einem anderen Lauf und wird dieser Einheit nicht zugeschrieben.
- Bestätigte Wettkampfbestzeiten (dritte Kategorie) behauptet die Story nicht.
- Rundenseite: nur die vergleichbare Gruppe der Intervall-Engine (`analytics.values/dists/times` neu), Wert je Metrik
  (Tempo /km, Watt, km/h). Ohne vergleichbare Gruppe keine Rundenseite.
- Strecke zeichnet sich mit **2 s je km** (`GM_STORY_ROUTE_SPKM`, einstellbar über `localStorage.orvia_story_route_spkm`
  0,5–5), min. 2 s, max. 90 s, gleichmäßige Geschwindigkeit; die Seite bleibt bis Zeichnungsende + 2,5 s. Reduzierte Bewegung:
  keine Verlängerung.

### 12.7 Herzfrequenzzonen (Dokumentation + Konzept, nichts geändert)
- Heute: Zeit je Zone = Garmins `hrTimeInZone_1…5` (Zonen-Einstellung in Garmin Connect). Grenzen werden in der Produktion
  **nicht** gespeichert. Im Mitschnitt (Endpoint hrZones) belegt: Laufen 97/111/140/159/178, Rad 99/119/139/158/178 bpm (Untergrenzen).
- Konzept ORVIA-Zonen (Folgephase, eigene Freigabe): (1) Worker speichert Garmin-Grenzen je Aktivität (`metrics.garmin.hr_zones`,
  versioniert); (2) Profil: Zonenmodell je Sportart (Garmin übernehmen | % HFmax | % LTHR), Gültig-ab-Datum; (3) Zeit je
  ORVIA-Zone aus der Pulsreihe nur für Aktivitäten **ab** dem Gültig-ab-Datum — keine rückwirkende Umdeutung; Garmin-Zeiten
  bleiben daneben sichtbar; (4) Migration nur additiv. Keine Änderung in v8-456.

### 12.8 Teilen aus den Highlights (`js/story-share.js`, `story-share@1`)
- Einstieg: Teilen-Symbol (Quadrat mit Pfeil) oben in der Story und „Teilen" auf der neuen Abschlussseite (bleibt stehen,
  „Fertig" schließt). Beide rufen `gmStoryShare`. Story pausiert; nach Schließen läuft dieselbe Seite neu an.
- Daten: `gmShareData` — Analyse-Modell, `gmAxOk` (gesperrte Werte nie), `gmAaFmt`, Bezeichnungen der App, virtuelle Werte
  gekennzeichnet; Bestzeit über `gmStoryPbOf`. Das Modul rechnet keine Kennzahl.
- Karten (PNG 1080 × 1920): Hauptwert · Drei Werte · Strecke · Strecke + Werte · Bestzeit · Zusammenfassung. Inhalte zwischen
  ~250 px oben/unten (Instagram-Bedienflächen). Logo = Originalgeometrie aus `assets/brand/orvia-lockup-horizontal.svg` als
  Path2D (Test vergleicht mit der Datei).
- Aufkleber (PNG mit Alpha-Kanal, Ecken Alpha 0): Hauptwert · Zeit · Tempo/Leistung · Drei Werte · Strecke · Strecke + Werte ·
  Statistik · Bestzeit. Schachbrett nur in der Vorschau (CSS).
- Strecke ohne Kartenkacheln (keine Attributionspflicht, kein gesperrtes Canvas). Start/Ziel ausblenden: Aus / 200 m
  (Standard) / 500 m — nur in der Exportkopie; zu kurze Strecke (< 3 × Bereich) → keine Strecke. Spielwelt: kein Ausblenden.
- Teilen: Datei wird beim Auswählen vorbereitet; der Tipp ruft `navigator.share({files})` sofort (WebKit: `share()` verbraucht
  die kurze Nutzeraktivierung). Nur nach `navigator.canShare({files})`; sonst kein Teilen-Knopf, „Bild speichern" ist Hauptweg.
  Abbruch (AbortError) ohne Meldung. „Aufkleber kopieren": `ClipboardItem({'image/png'})`, Erfolg erst nach `write()`
  (Safari ≥ 13.1 unterstützt image/png).
- Plattform-Fakten: Eine Web-App kann Instagram Stories **nicht** gezielt öffnen/befüllen (das geht nur nativ über
  `instagram-stories://` + UIPasteboard + Facebook-App-ID). Instagram erscheint nur, wenn iOS/Android es im System-Teilen-Menü
  anbietet. Firefox Desktop: kein `share()` (Fallback Speichern).
- **Video: kein Knopf.** Folgephase „Video-Export": MP4 (H.264) 1080 × 1920 aus derselben Zeichenschicht (Canvas →
  `captureStream` + MediaRecorder nur wo MP4 unterstützt, sonst serverseitig); erst mit zuverlässigem Renderer.
- Getestet: Chromium (Desktop, Mobil-Emulation 320–1440 px), Mocks für share/clipboard. **Offen (Gerätetest):** iPhone Safari,
  installierte iPhone-PWA, Android Chrome, Desktop Safari, tatsächliche Übergabe an Instagram.

### 12.9 Tests
`activity_quality_v456_test` (19), `activity_quality_v456_ui_e2e_test` (28), `story_share_v456_test` (34),
`story_share_v456_ui_e2e_test` (32); angepasst: intervals_v454 P5 (neue Regel), activity_experience_v4541_ui_e2e (Ablesezeile,
Zwift-Pause unklar, Spielwelt-Feld), activity_theme_e2e 5b, effective_metric_e2e (Dauer im neuen Kopf), visual_v3_e2e E6,
route_map G1.

## 13 · v8-457 Running Experience Premium Quality Pass (gebaut, nicht ausgeliefert · Build orvia-v8-457)

Grundlage: Gians 33 Bilder vom 20.10. (Halbmarathon Flensburg 06.09., 21,18 km; v8-456 live) + Auftrag „Running Experience
Premium Quality Pass". Die 17-km-Bilder der Designreferenzen sind ein anderer Lauf (Intervalllauf 07.10.) — nicht vermischt.
Kein Deploy, keine Migration, kein Worker, keine Railway-Aenderung, keine Rekordberechnung geaendert.

### 13.1 Audit (Phase A) — Befund · Art · Ursache (nachgewiesen/vermutet) · Korrektur · Risiko

| Befund (Bild) | Art | Ursache | Korrektur v8-457 | Risiko |
|---|---|---|---|---|
| 21,2 km auf Seite/Karten, 21,18 in der Story | Darstellung | gmAaFmt rundete auf eine Stelle (fmtDe), Story nahm das Anzeige-Modell (2 Stellen) — nachgewiesen | EINE Funktion gmDistTxt: Lauf-Familie 2 Stellen, mathematisch gerundet; Rad/Sonstige unveraendert | gering (nur Anzeige) |
| 150 spm (Seite/Karte) vs. 149 (Story „Deine Zahlen") | Daten-Konflikt | Seite: Garmin-Mittel aller Messzeilen (metric-eligibility runningCadence, validiert); Story: Mittel der 296 gespeicherten Punkte (vm.cadence) — nachgewiesen | Story nimmt dieselbe Kennzahl (M('runningCadence')) | keins |
| „2 h 22 min" (Story) vs. „2:22:12" | Darstellung | Story nahm vm.durationLabel | Story: Dauer h:mm:ss aus dem Modell | keins |
| 312 m „Höhenmeter" | Definition | Garmin elevationGain = kumulierter Anstieg (summiert), nicht Hoehendifferenz/absolute Hoehe — nachgewiesen (sumRead elevationM) | Bezeichnung „Anstieg" in Story; Definition „bergauf, summiert (Garmin)" in der Bibliothek | keins |
| 2:20:47 Halbmarathon bei 2:22:12 Dauer | geprueft, kein Fehler | Schnellstes 21,0975-km-Fenster aus allen 8.533 Messzeilen (Worker-Fenster „alle Messpunkte"). 21,18 km − 21,0975 km = 82,5 m in 85 s (≈ 17 min/km) → Stehen an Start/Ziel ausserhalb des Fensters. Timer = Gesamtzeit (0 s angehalten) → aktiv = einschliesslich Pausen. Kategorie „Aktive Trainingsbestzeit" = Register | unveraendert; Story nennt Kategorie, Distanz, Zeit — ohne Rechensatz | — |
| „Halbmaratho / in 2:20:47" | Fehler | `.wst-prval` mit fester Groesse + Silbentrennung im schmalen Story-Rahmen | Bestleistung als Komposition: Kategorie · Distanzname (eigene Zeile, nowrap, Groesse nach Containerbreite) · Zeit; Text „Deine schnellste aufgezeichnete Halbmarathonzeit" | gering |
| Titel „… Jacob Cemen…" abgeschnitten (Karten, Story-Kopf, Aufkleber) | Fehler | eine Zeile + Auslassung mitten im Wort | gmShortTitle (Anzeige: „Jacob Cement Halbmarathon"), Originaltitel bleibt gespeichert und steht in der Datenherkunft/Tooltip; Karten: erst kleiner, dann Umbruch an Wortgrenzen | gering |
| Desktop: lange Titelzeile, Karte flach (Streifen) | Gestaltung | Kopf einspaltig, Karte 340 px Streifen | Desktop zweispaltig: links Kopf, rechts Karte im Seitenverhaeltnis der Strecke (380–560 px); gegen „Karte oben, 460 px" verglichen (Bilder) — zweispaltig gewaehlt (alles ueber der Falz, Karte doppelt so gross) | mittel (Layout) |
| Teilen nur in den Highlights | Funktion | — | „Teilen" im Kopf, gmShareOpen = dieselbe Auswahl (keine zweite Engine) | gering |
| Tempo-Einbrueche bis 15–17 min/km, Uhr nie angehalten | Daten — offen | Gespeichert sind 296 von 8.533 Zeilen (jede 29.). Die Einbrueche sind keine Stopps (≤ 0,3 m/s), sondern langsame Bewegung 1–1,7 m/s. Ob Gehen (Anstiege, Verpflegung) oder GPS-Geschwindigkeitsfehler, laesst sich nur mit Kadenz an diesen Punkten entscheiden — **nicht verifiziert** | nichts geloescht; Konsole `activity-dips-console.js` (v2) mit Gegenprobe Kadenz/Puls an den langsamen Punkten; Abgleich mit dem Tempo-Verlauf in Garmin Connect | — |
| 296 von 8.533 Punkten | Datenreduktion | Worker speichert Punktauswahl (series_normalize _sample_indices) | Vorschlag Extremwert-erhaltende Reduktion (Min/Max je Zeitfenster) steht in §12 — Worker-Aenderung braucht Freigabe | — |
| Z5 = 74 %, Grenzen unbekannt | Herkunft | Garmin liefert je Aktivitaet nur hrTimeInZone_1…5; die Grenzwerte speichert ORVIA nicht | „Zonengrenzen ansehen": Herkunft, „Grenzen liegen nicht vor" (nichts geschaetzt), wo in Garmin Connect/auf der Uhr; keine Umrechnung alter Aktivitaeten | keins |
| Halbmarathon 06.09. ↔ „Long Run Sa 5.9. automatisch zugeordnet" | Zuordnung, kein Fehler | plan-auto-link@5: offene Einheit derselben Sportart in derselben Woche, naechster Tag, bei Gleichstand die fruehere — der Samstag-Lauf war offen | unveraendert (Gian kann „Ändern"/„Lösen") | — |
| „Intervalle / Runden: wird von ORVIA noch nicht abgerufen" | Verfuegbarkeit | Runden fuer Laufen kommen erst mit Worker v8-454 (nicht ausgerollt) | keine Abschnitte-/Intervallkarte fuer diesen Lauf (keine erfundenen) | — |
| Highlights zu langsam beim Wiedersehen | Gestaltung | 8,5 s je Szene + Strecke 2 s/km (HM 42 s) | Quick Highlights 3,6 s je Szene, Strecke 2,2 s fix (≈ 18 s gesamt); Cinematic Replay getrennt | gering |
| Strecken dick/unscharf (Karte, Story, Karten, Aufkleber) | Gestaltung | Linie 4,5 px + Rand 7,5 px bei 65 %; Karten 11–16 px mit dunkler Kontur und starkem Leuchten | Karte 3 px + Rand 4,5 px bei 40 %; Start r 5 / Ziel r 3,5; Karten 6–7 px (1080er), leiser Schein, keine Kontur; Aufkleber 8–9 px mit kaum sichtbarer Kante | gering |
| Aufkleber auf hellem Grund unlesbar, grauer Hof | Gestaltung | weisse Schrift, Schatten 16 px Blur | Schrift hell/dunkel waehlbar, Schatten 5 px; eng zugeschnitten (Inhalt + 28 px) | gering |
| Karten mit Quellenzeile „Daten: Garmin · ORVIA" | Text | — | entfernt (keine Kartenkacheln → keine Attributionspflicht) | keins |
| Exporte 1080 × 1920 | Qualitaet | Massstab 1 | 4K: gezeichnet in 2160 × 3840 (Massstab 2, Vektor); Standard 1080 × 1920 waehlbar; Rueckfall auf 1080 bei Speicherproblem mit Hinweis | mittel (Speicher aelterer iPhones) |

### 13.2 Highlights: drei Wiedergaben
- **Quick Highlights** (Standard): Szene 3,6 s (`GM_STORY_MS`), Strecke 2,2 s unabhaengig von der Distanz, Seite steht 1,6 s
  nach der Zeichnung. Tippen links/rechts, Gedrueckthalten haelt an (Loslassen setzt fort, kein Weiterblaettern), Pause-Knopf,
  Taste P; Teilen haelt an und setzt danach mit der Restzeit fort. Fortschrittsbalken ist eine CSS-Animation (anhaltbar).
- **Cinematic Replay** („Strecke abspielen" auf der Abschlussseite): eigene Seite, distanzgetreu — Laufen 2 s/km, Rad 0,6 s/km,
  sonst 1,5 s/km; 0,5× / 1× / 2×; 4–120 s. Ein Punkt faehrt die Linie ab (CSS `offset-path` = derselbe Pfad, gleiche Dauer und
  lineare Kurve wie der Strich — er kann nicht springen). Keine neue Video-Infrastruktur.
- **Social Highlight / Videoexport**: Folgephase. Kein Video-Knopf.

### 13.3 Teilen — Vorlagen (Abgleich mit den zehn freigegebenen Richtungen)
| # | Richtung | Stand v8-457 | Bedingung |
|---|---|---|---|
| 1 | Minimal | `hero`: grosse Zahl + zwei Werte | ≥ 1 Wert |
| 2 | Strecke im Fokus | `route`, `route_plus`: feine echte GPS-Linie, leiser Schein, **ohne** Kartengrund | Strecke |
| 3 | Bestleistung | `pb`: Kategorie (Register) · Distanz · Zeit · Datum | Bestzeit aus genau dieser Aktivitaet |
| 4 | Signature Ring | `ring`: leuchtender Ring als Dekoration (kein Anteil/Fortschritt) | ≥ 1 Wert |
| 5 | Photo Experience | `photo`: eigenes Foto (lokal gelesen, nie hochgeladen; Standortdaten der Datei fallen beim Neuzeichnen weg) | Foto gewaehlt |
| 6 | Splits | `splits`: vergleichbare Belastungen/Runden der Intervall-Engine; Abweichung zum Schnitt der Gruppe (Plan-Ziele sind nicht angebunden — beschriftet „Δ zum Schnitt") | ≥ 3 vergleichbare |
| 7 | Elevation Pro | `elev`: Hoehe ueber Distanz (Messreihe), Anstieg = Garmin, hoechster/tiefster Punkt aus der Reihe | Hoehenreihe + Anstieg |
| 8 | Intervallverlauf | `intervals`: Tempo/Leistung ueber Zeit, Belastungen als Baender | ≥ 2 echte Belastungen, Zeitachsen passend |
| 9 | Transparenter Sticker | `s_stack`: Titel · Distanz · Dauer · Tempo · Logo (+ alle bisherigen Aufkleber) | ≥ 3 Werte |
| 10 | Contour Minimal | `contour`: abstrakte Linien (aus der Aktivitaets-ID, kein Gelaende) + drei Werte | ≥ 3 Werte |
Standardvorlage: Bestzeit → `pb`, echte Intervalle → `intervals`, sonst `trio`; Aufkleber `s_stack`; eine von Hand gewaehlte
Vorlage bleibt fuer diese Aktivitaet (Sitzung) vorn. Datenschutz: „Standort beim Teilen schuetzen" (Aus/200/500 m, entlang der
Strecke gemessen — `privacyTrim` summiert Haversine-Abstaende), unter „Weitere Optionen", nur im Export.
Karte mit Kartengrund (Mockup #2): bewusst nicht — MapTiler-Bedingungen fuer geteilte Bilder und das Ausblenden der Umgebung
von Start/Ziel sind ungeklaert (Folgephase).

### 13.4 Offen / nicht geprueft
- Echte Geraete: iPhone Safari, iPhone-PWA, Android Chrome, Desktop Safari — nicht getestet (nur Chromium in der Cloud).
- Bereits funktionierendes Kopieren → Instagram (Gians Test 20.10.) mit 4K-Aufklebern erneut pruefen (Dateigroesse 0,1–0,6 MB).
- 4K-Karten (≈ 3–6 MB PNG) auf aelteren iPhones: Speicher-Rueckfall ist eingebaut, aber nicht auf Geraet geprueft.
- Tempo-Einbrueche HM: Konsole (Kadenz-Gegenprobe) bzw. Garmin Connect.
- Kartenkacheln (MapTiler) sind in der Cloud nicht erreichbar — die Bilder der Aktivitaetsseite zeigen die Ersatzzeichnung.
