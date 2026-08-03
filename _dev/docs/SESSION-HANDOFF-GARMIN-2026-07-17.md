# Session-Handoff · Garmin-Integration Fundament (2026-07-17)

Status: Phasen 1–4 IMPLEMENTIERT (offline verifiziert), NICHT deployt, kein Live-Garmin-Test.
Verbindliche Architektur: `app/docs/GARMIN-INTEGRATION-DESIGN.md`.
Entscheidungen (Gian): gehosteter Python-Worker (Railway/Fly), Fundament zuerst, Live-Test als separater Schritt.

## Nächste Schritte (Reihenfolge)
1. SQL `app/supabase/migrations/0019_provider_metrics_foundation.sql` im Supabase SQL-Editor ausführen.
2. `garmin-worker/` auf Railway deployen (README.md im Ordner; Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TOKEN_ENCRYPTION_KEY=Fernet-Key, ALLOWED_ORIGINS).
3. Live-Connect mit echtem Garmin-Konto → alle "FIXTURE-ANNAHME"-Kommentare in `normalize.py`/`garmin_unofficial.py` gegen echte Responses verifizieren.
4. Phase 5 (Profil-UI + Wiring metric-resolver/metricsRepository in index.html+sw.js, EIN SW-Bump), dann Phasen 6–8 (Design §9).

## Wichtig
- `js/metrics/*` und `js/repos/metricsRepository.js` sind bewusst NOCH NICHT in index.html/sw.js eingebunden.
- Registry-SSOT: `js/metrics/metric-registry.js`; Worker-JSON regenerieren mit
  `node js/metrics/export-registry.mjs > ../garmin-worker/orvia_worker/metric_registry.json` (Vertragstest erzwingt Gleichstand).
- Tests: `python -m pytest tests/ -q` (72/72) im Worker; `node supabase/tests/metric_registry_test.mjs` (13), `metric_resolver_test.mjs` (33), `provider_metrics_0019_test.mjs` (19) aus app/.

## Audit-Bugbefunde (Vorbedingungen für Phasen 6–8, NICHT gefixt)
1. `ill`/`illness`-Bruch: `gatherMorning` schreibt `ill`, `checkinRepository.toRow` liest `m.illness` → Morgen-Krankheit wird nie persistiert; `rowToCheckin` liefert `illness`, UI liest `m.ill` → nach Hydration auch lokal weg.
2. Check-in-Hydration ersetzt `DB[date].morning` ohne Merge → `weight`/`ankle` gehen verloren (betrifft Gewichtstrend/Nutrition).
3. Shadow-Runner verletzt Engine-v2-Vertrag: `doms` statt `soreness`, `restingHrBaseline` statt `rhrBaseline`, safetyFlags als Array statt Objekt, prüft nicht existentes `m.pain` → Shadow-Gate-Vergleich verzerrt.
4. Kalorienrechner: statischer Aktivitätsfaktor + Trainingsburn addieren sich (Double Counting heute schon); kein Gewichtstrend-Feedback trotz gegenteiligem UI-Text.
5. `readiness-store` persistiert v1-Score unter `engine_version='v2'`.
6. Stille Check-in-Slider-Defaults (Schlaf 420 / feel 7 / legs 7 / doms 2) landen als echte Messwerte in `daily_checkins` und Baselines.
7. Doppelwelt Körperdaten: flache kanonische Felder (weightKg, hfMaxMeasured, restingHrMeasured; cloud-synced, ohne source) vs. `performance.body` (Metric mit source/measuredAt; nur lokal); `_metricSet` stempelt jede UI-Änderung pauschal 'manual'.

Hinweis: In der Bausession war `device_commit_files`/`project_memory_write` der Desktop-Bridge nicht verfügbar — dieser Handoff ersetzt den Memory-Eintrag; in der nächsten Session bitte ins Projekt-Gedächtnis übernehmen.
