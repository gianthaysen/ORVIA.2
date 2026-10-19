# Sportartspezifische Aktivitätsanalyse (v8-452 · v8-453 · v8-454)

**Status: IMPLEMENTED** (App v8-453 live) · **App v8-454 gebaut, nicht ausgeliefert** (universelle Intervalle Laufen/Rad, Neugestaltung der Aktivitätsseite, §10) · Worker v8-452.1 live (`DETAIL_EXTRAS=splits`, `DETAIL_EXTRAS_SPORTS=swimming`) · **Worker v8-454 vorbereitet, nicht ausgerollt** · keine Migration

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

## 10 · v8-454 Universelle Intervalle Laufen · Rad · Schwimmen (gebaut, nicht ausgeliefert)

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
