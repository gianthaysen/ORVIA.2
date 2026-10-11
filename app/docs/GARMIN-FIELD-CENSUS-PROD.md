# Garmin-Feldzensus — Produktion

**Status: NOCH NICHT ERHOBEN** · angelegt mit v8-447.1 am 2026-10-07

Dieses Dokument enthält noch **keine** Produktionsdaten. Es wird vollständig überschrieben, sobald der
Zensus gelaufen ist — bis dahin gilt für jede Zeile der Fähigkeits-Matrix die Belegstufe aus dem Code
(`OBSERVED_FIXTURE` / `LIBRARY_DOCUMENTED` / `ASSUMED`); nichts ist `OBSERVED_PRODUCTION`.

## Erhebung

1. Voraussetzung: der Worker **v8-447.1** läuft (prüfbar ohne Anmeldung: `GET /healthz` nennt `worker` und
   `detailsContract`) und hat einige Sync-Läufe hinter sich. Sinnvoll, sobald der Großteil der Aktivitäten
   auf Details-Vertrag 3 steht.
2. Supabase → SQL Editor → Inhalt von `supabase/scripts/garmin_field_census.sql` einfügen → Run → Export CSV.
   Die Abfrage liest nur; ihr Ergebnis enthält ausschließlich Namen und Zählungen.
3. `python garmin-worker/scripts/census_report.py --csv <datei> --worker v8-447.1`
   schreibt dieses Dokument, `GARMIN-BACKFILL-STATUS.md` und `garmin-worker/census/observed.json`.
4. `python garmin-worker/scripts/gen_capability_matrix.py` — die Matrix bildet ihre Belegstufen neu.

## Was dann hier steht

Je Sportart: Grundlage (Aktivitäten, mit Rohfeldern, auf aktuellem Vertrag) · Garmin-Typ → Sportart ·
gefüllte Herkunftsschlüssel · kanonische Messreihen mit Garmin-Quelle · Abtastung (vollständig / ausgedünnt) ·
erhaltene Felder und Zusatzreihen mit **Abdeckung in %** · Güte der Bestwerte · geliefert, aber nicht
gespeichert · erlaubte Felder in unerwarteter Form · und der Abgleich „Annahmen des Codes gegen den Zensus"
(bestätigt / widerlegt / offen / neu).

Regel: Ein Feld wird nur `OBSERVED_PRODUCTION`, wenn es gezählt wurde. `ABSENT` nur, wenn mindestens fünf
passende Aktivitäten vorliegen und keine es trug. Dazwischen bleibt die bisherige Stufe.
