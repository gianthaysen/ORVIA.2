# Handoff · Garmin-Worker: Zeitachse für Aktivitäts-Streams

**Datum:** 2026-08-04 · **Ziel:** sekundengenaue Bestzeiten (`stream_window`) aktivieren

## Ausgangslage

Der Worker speichert je Aktivität `metrics.streams` mit den Schlüsseln
`heart_rate`, `speed`, `cadence`, `elevation`, `distance` (kumulative Meter) —
**aber keine Zeitachse**. Quelle: `get_activity_details` (garminconnect); die
Rohantwort enthält `metricDescriptors` mit `directTimestamp` bzw. `sumDuration`,
die beim Parsen bisher verworfen werden.

Die App (js/run-bests.js, `bestWindowFromStreams`) kann seit v8-223 sekunden­genaue
Bestzeit-Fenster aus `streams.distance` + `streams.time` berechnen. Sie leitet
**bewusst keine** Zeit aus `Δdistance / speed` ab: das wäre eine Schätzung mit
Mess-Etikett (Negativkontrolle in `supabase/tests/batch_2026_08_04_test.mjs`).
Bis der Worker die Zeitachse liefert, bleiben die Runden (`metrics.splits`) die
feinste Messquelle — rundengenau, nicht sekundengenau: ein 1-km-Bestwert
**innerhalb** einer 3-km-Runde ist heute unsichtbar.

## Änderung im Worker (garmin-worker, auf dem eigenen Rechner)

Im Detail-Parser (dort, wo `distance`/`speed` aus `activityDetailMetrics`
extrahiert werden):

1. Aus `metricDescriptors` den Index von `sumDuration` (Sekunden seit Start,
   kumulativ) ermitteln — Fallback: `directTimestamp` (ms-Epoche) minus erstem
   Wert, durch 1000.
2. Als `streams.time` (Sekunden, kumulativ, gleiche Sample-Reihenfolge wie
   `distance`) speichern und `stream_units.time = "s"` ergänzen.
3. Nichts weiter — die App erkennt `time` automatisch (`streamTimeAxis` prüft
   `time`/`elapsed`/`elapsed_time`/`timestamp`/`duration`).

## Abnahme

- Neue Synchronisation einer Laufaktivität → `metrics.streams.time` vorhanden,
  gleiche Länge wie `distance`, monoton steigend.
- In der App erscheint die 1-km-Bestzeit dieser Aktivität mit Quelle
  „gemessen · Messreihen der Uhr" (`method: 'stream_window'`), sobald sie das
  Runden-Ergebnis unterbietet.
- `node supabase/tests/batch_2026_08_04_test.mjs` bleibt grün (der Test deckt
  beide Zustände: mit und ohne Zeitachse).
