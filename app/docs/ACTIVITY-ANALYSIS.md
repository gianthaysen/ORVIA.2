# Sportartspezifische Aktivitätsanalyse (v8-452)

**Status: IMPLEMENTED** (App, live seit v8-452) · Worker v8-452.1 **vorbereitet, nicht ausgerollt** · keine Migration

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

Freigabe-Reihenfolge (Gian):
1. Mitschnitt lokal: `cd ~/Claude/Projects/Strava/garmin-worker && .venv-login/bin/python scripts/capture_activity_payloads.py --sports swimming` → Auswertung durch Claude (`tests/test_v4521_swim_capture.py` läuft dann mit).
2. Sicherung: `supabase/scripts/v4521_swim_extras_backup.sql` (Schema `orvia_backup`, nicht über die API erreichbar).
3. `railway up` → `/healthz` `worker: v8-452.1`. Ohne Variablen ändert sich nichts.
4. Railway: `DETAIL_EXTRAS=splits,typed_splits`, `DETAIL_EXTRAS_SPORTS=swimming`, einmalig `DETAIL_REFETCH_EXTRAS=1` → Sync-Protokoll `extras_pending:` fällt auf 0 (6 Schwimmeinheiten, ≤ 1 Lauf bei Limit 10).
5. Kontrolle: `supabase/scripts/v4521_swim_extras_check.sql` (nur lesend).
6. `DETAIL_REFETCH_EXTRAS` löschen. `DETAIL_EXTRAS` + `DETAIL_EXTRAS_SPORTS` bleiben (neue Schwimmeinheiten bekommen Runden direkt beim ersten Laden).
7. Validierung gegen Garmin Connect → Beleg `list.swim` / Bahnen in `metric-eligibility`.

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
