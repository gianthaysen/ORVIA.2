# Echte, anonymisierte Mitschnitte je Garmin-Typ

Dieser Ordner ist absichtlich (noch) leer. Dateien entstehen durch

    python scripts/capture_activity_payloads.py

(aus `garmin-worker/`, Python ≥ 3.12 — siehe `app/docs/GARMIN-CAPABILITY-MATRIX.md`, Abschnitt 13).

Eine Datei je Garmin-Typ, Name `<orvia-sportart>__<garmin-typ>.json`, Inhalt:
`list_entry`, `activity`, `details`, `splits`, `typed_splits`, `split_summaries`, `hr_zones`,
`power_zones` (Rad/Lauf), `exercise_sets` (Kraft), `_meta`.

Keine Zugangsdaten, keine E-Mail, keine Namen, keine Orte, keine Kennungen, nicht das echte Datum;
ohne `--with-gps` keine Koordinaten. Das Skript prüft das vor dem Schreiben selbst, und
`tests/test_capture_script.py` prüft jede hier liegende Datei bei jedem Testlauf erneut.

Sobald hier eine Datei liegt, kann die Belegstufe der betreffenden Felder in
`orvia_worker/garmin_fields.py` von `assumed` / `library` auf `fixture` gehoben werden.
