# Übergabe · Garmin-Aktivitätsdetails unvollständig angezeigt — BEHOBEN & VERIFIZIERT

Status: **BEHOBEN (Batch 3b.1b/3b.1c, 2026-07-19), test-verifiziert; noch nicht deployt (Deploy-Stopp aktiv).**

Live-Befund 19.07.2026 (Screenshot Gian): Detailansicht eines Garmin-gesyncten Laufs
(So. 19.07., 10:20, 59 min) zeigte nur Sportart/Datum/Uhrzeit/Dauer — keine Distanz,
Pace, HF, Kalorien, Höhenmeter, obwohl alle Daten in der DB lagen.

## Ursache (ursprünglicher Befund)

Schlüsselnamen-Konflikt zwischen Worker-Schreibform und Client-Leseform im
`summary`-JSONB der `activities`-Zeile:

- Worker schreibt snake_case (`garmin-worker/orvia_worker/normalize.py`):
  `distance_m`, `calories_kcal`, `avg_hr`, `max_hr`, `elevation_gain_m`,
  `avg_speed_mps`, `name`.
- Client-Renderer las camelCase (`app/js/activity.js`, `renderGeneralActivityDetails`):
  `s.distanceM`/`s.distanceKm`/`s.avgHr`/`s.elevationM` — und `name` aus metrics statt
  summary. Kein Schlüssel matchte ⇒ Felder wurden ausgeblendet.
- `summary` passierte die Normalisierung ungemappt; `calories_kcal`/`max_hr`/
  `avg_speed_mps` wurden zudem nie gerendert.

## Korrektur (implementiert, NICHT nur gelesen)

Der Fix betrifft ausdrücklich Normalisierung, Anzeige UND Engine-Evidenz — es ist
KEIN reines Anzeigeproblem mehr:

- **Zentrale Normalisierung an EINER Grenze**: neue pure, idempotente, nicht-mutierende
  `activityNormalize.normalizeActivitySummary(summary, sportId)` (Home in
  `app/js/activity-normalize.js`). Beide Serverpfade delegieren dorthin
  (`normalizeActivityRecord` direkt, `activityConfig.normalizeServerActivity` via `AN()`)
  ⇒ Store-Merge, Serverliste, Anzeige und Engine-Gruppierung erhalten byte-identische
  kanonische Felder. snake→camel für `distance_m/distance_km/avg_hr/max_hr/
  elevation_gain_m/calories_kcal/avg_speed_mps/name`; meterbasierte Sportarten
  (swimming, rowing) → `distanceM`, sonst → `distanceKm`; camelCase gewinnt vor
  snake_case; unbekannte Felder bleiben erhalten; `avgSpeedKmh` abgeleitet.
- **Härtung gegen unmögliche Werte (3b.1c)**: negative/NaN/Infinity und nur teilweise
  numerische Strings (`'100abc'`) werden verworfen (nicht geclampt, nicht erfunden);
  Höhengewinn/HF/Kalorien/Distanz/Geschwindigkeit nie negativ.
- **Detailanzeige**: der Renderer konsumiert die pure `activityDetailModel(...)`:
  Name aus `summary.name` (metrics nur Fallback); Laufpace primär aus Dauer/Distanz,
  Fallback aus gültiger `avgSpeedKmh`/`avgSpeedMps`; Schwimmen sport-bewusst pro 100 m;
  zusätzlich Kalorien und Max-HF; niemals negative/ungültige Werte.
- **Engine-Evidenz**: die Long-Run-Evidenz rekonstruiert Distanz/Startzeit/Segmente
  ausschließlich aus den referenzierten echten Activities (kein Vertrauen in
  `totalDistanceKm` der Gruppierung), inkl. Batch-2-Gap-Vertrag; aus nuller/ungültiger
  Distanz entsteht kein Long Run.

## Prognose-/Zielpfad

`ui.js` `_storeRunsByDay` liest `s.distance_m` mit `distanceKm`-Fallback bereits korrekt
— unverändert. Die zentrale Normalisierung liefert jetzt zusätzlich konsistente
kanonische Felder für alle Konsumenten.

## Verifikation

Vertragstests: `app/supabase/tests/batch3b1b_activity_summary_test.mjs` (Garmin
Running/Swimming/Rowing snake_case → kanonisch, camel-Priorität, Idempotenz/Nicht-
Mutation, beide Serverpfade byte-identisch, kein m→km ohne Sportkontext, unmögliche
Werte verworfen, pure Detailaufbereitung inkl. Pace-Fallback über Geschwindigkeit) und
`app/supabase/tests/batch3b1_running_capacity_test.mjs` (Engine-Evidenz). Volle
Mac-Regression grün außer den bekannten 6 ENV-Suiten.

Kontext: SW-Stand v8-194 gebaut, aber NICHT deployt (Deploy-Stopp aktiv). `activity.js`,
`activity-normalize.js`, `activity-config.js` sind produktiv geladen; dieser Fix gehört
ins nächste Deploy-Paket (atomar mit SW-Bump).
