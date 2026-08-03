# ORVIA · Garmin-Integration & zentrale Provider-Datenarchitektur

Status: **Phasen 1–4 IMPLEMENTIERT (Fundament), Phasen 5–9 PROPOSAL**
Erstellt: 2026-07-17 · Grundlage: Bestandsaudit (3 Teilaudits) + Nutzerentscheidungen

Entscheidungen (Gian, 2026-07-17):

1. Garmin-Sync läuft als **gehosteter Python-Worker** (Railway/Fly.io/Render), nicht in Supabase Edge Functions (Deno kann kein python-garminconnect) und nicht lokal.
2. **Fundament zuerst**: Design, DB-Migration, Worker, Metric Store, Resolver-Kerne mit Tests. Profil-/Check-in-/Kalorien-UI-Umbau in getrennten Folgephasen.
3. **Kein Live-Garmin-Test in dieser Phase** — Worker und Normalisierung sind gegen Fixtures getestet; Live-Verbindung ist ein separater kontrollierter Schritt.

---

## 1. Architektur (IMPLEMENTIERT im Fundament)

```text
python-garminconnect (0.3.2, gepinnt)
        ↓
GarminUnofficialProvider          garmin-worker/orvia_worker/providers/garmin_unofficial.py
        ↓
Normalization Layer               garmin-worker/orvia_worker/normalize.py
        ↓
Metric Validation + Anomalien     garmin-worker/orvia_worker/validation.py
        ↓
User Metric Store (Supabase)      public.user_metrics (Migration 0019)
        ↓
Metric Source Resolver (pure JS)  app/js/metrics/metric-resolver.js
        ↓
Profile / Check-in / Calorie / Engine Resolver   (Phasen 5–8, PROPOSAL)
        ↓
UI
```

Nachgelagerte Systeme kennen NUR das interne ORVIA-Modell (`user_metrics`
+ `metric-registry.js`). Der Wechsel zur offiziellen Garmin-API ersetzt
ausschließlich `providers/garmin_unofficial.py` + Authentifizierung; alles ab
der Normalisierung bleibt unverändert (Akzeptanzkriterium 15/§29).

### Single Source of Truth

- **Metrik-Katalog**: `app/js/metrics/metric-registry.js` (42 Metriken: ID,
  Einheit, editMode, Plausibilitätsgrenzen, Sprunggrenzen, Staleness,
  Prioritätsränge). Der Python-Worker konsumiert ein daraus GENERIERTES JSON
  (`node app/js/metrics/export-registry.mjs > garmin-worker/orvia_worker/metric_registry.json`).
  Vertragstest `supabase/tests/metric_registry_test.mjs` erzwingt Gleichstand.
- **Auflösungslogik**: `metric-resolver.js` (pure, idempotent, non-mutating).
- **Dedupe**: deterministische `source_record_id`
  (`<provider>:daily:<datum>:<metric>` bzw. Provider-Record-IDs) + partieller
  Unique-Index. Kein Fuzzy-Dedupe für Provider-Daten.

## 2. Datenklassifizierung (§3 der Anforderung)

- **Manuell statisch** (Geburtsdatum, Größe, Ziele, Verfügbarkeit …): bleiben im
  bestehenden Profilmodell (`profile-model.js`), unverändert.
- **Automatisch messbar**: ausschließlich `user_metrics` über den Worker.
  Katalog = metric-registry.
- **Subjektiv** (Befinden, Muskelkater, RPE …): bleiben Check-in (Phase 6
  reduziert nur die objektiven Fragen).
- **ORVIA-berechnet** (Recovery Score, TDEE, ACWR …): `readiness_scores`,
  `daily_energy_expenditure`, `training_load_daily` — werden NIE als
  Garmin-Werte ausgegeben (`calculated_read_only`).

## 3. Datenbank (Migration `0019_provider_metrics_foundation.sql`, IMPLEMENTIERT)

Tabellen: `data_providers`, `provider_credentials` (RLS ohne Nutzer-Policies →
service_role-only, wie `oauth_tokens`), `connected_devices`,
`device_capabilities` (Owner per SECURITY-DEFINER-Trigger `dc_force_owner`,
Konvention aus 0002/`rc_force_owner`), `user_metrics`,
`profile_metric_settings` (nur Abweichungen vom Registry-Default),
`daily_energy_expenditure`, `metric_anomalies`.
Konventionen aus 0002/0017 eingehalten: `touch_updated_at()` wiederverwendet,
RLS enable+force+eigene-Zeilen-Policies, jeder Worker-`on_conflict` hat einen
passenden Unique-Index (Lehre aus Incident 0017/42P10), Abschluss in
`schema_migrations`. `activities_source_chk` um `'garmin'`/`'strava'`
erweitert (nur falls 0009-Constraint existiert).

**Historisierung**: `user_metrics` ist append-only pro Messung
(`source_record_id`-Idempotenz). Es gibt keinen "aktuellen Wert" in der DB —
der aktive Wert ist IMMER das Ergebnis des Resolvers über die Historie.
Overrides referenzieren das Original (`original_metric_id`), Originale werden
nie gelöscht (§32).

## 4. Source-Resolution (IMPLEMENTIERT: `metric-resolver.js`)

Prioritätsränge (§8): lab_test 100 > device_measurement 90 >
provider_calculation 80 > manual_override 70 > manual_entry 60 >
orvia_estimate 40 > historical 20.

Regeln (Reihenfolge):

1. `validity != 'valid'` → nie aktiv (suspect/invalid bleiben Rohhistorie).
2. Aktiver manueller Override gewinnt, SOLANGE keine gültige automatische
   Messung mit `measured_at` NACH dem Override existiert (Override korrigiert
   einen konkreten falschen Wert; neue echte Messung beendet ihn). Abschaltbar
   über `profile_metric_settings.manual_override_enabled=false`.
3. Sonst: höchster Prioritätsrang unter den frischen Kandidaten
   (`staleDays` aus Registry); Gleichstand → jüngste Messung.
4. Keine frischen Kandidaten → jüngster gültiger Wert mit `stale:true`
   (UI muss Veraltung anzeigen, §28 "keine veralteten Werte als aktuell").
5. Gar kein Kandidat → `null` (Feld wird ausgeblendet, §10 — keine leeren
   Karten, keine Nullwerte).

## 5. Anomalie-Erkennung (IMPLEMENTIERT: Worker `validation.py`)

- Außerhalb `plausible[min,max]` → `validity='invalid'` + Anomalie
  `out_of_range` (Bsp. Ruhepuls 220, Schlaf 18 h → Registry-Grenzen).
- Änderung ggü. letztem gültigen Wert > `jumpMax` × Tage (gedeckelt) →
  `validity='suspect'` + Anomalie `implausible_jump` (Bsp. VO₂max 50→68,
  Gewicht −5 kg/Tag, FTP −45 %). Vorheriger gültiger Wert bleibt aktiv.
- Anomalien landen in `metric_anomalies` (resolution_status `open`); Nutzer
  kann später akzeptieren (`accepted` → Wert wird per Re-Validierung aktiv).

## 6. Garmin-Worker (IMPLEMENTIERT: `garmin-worker/`, Deploy separat)

- **Auth**: `Garmin(email, password, return_on_mfa=True)`; MFA über
  `resume_login(client_state, code)`. Tokens (`client.dumps()`, garth-OAuth,
  ~1 Jahr gültig) werden Fernet-verschlüsselt in `provider_credentials`
  gespeichert; Passwort wird NIE persistiert (nur transient für den
  Login-Request). Folge-Syncs laufen ausschließlich über Tokens.
- **API** (FastAPI): `POST /connect`, `POST /connect/mfa`, `POST /sync`,
  `DELETE /connection`, `GET /status`, `GET /healthz`. Jeder Endpunkt
  verifiziert das Supabase-JWT des Nutzers gegen `/auth/v1/user`
  (Nutzerisolation; niemals client-gelieferte user_id vertrauen).
- **Scheduler**: Intervall-Loop (Default 30 min, konfigurierbar) über alle
  `connection_status='connected'`-Nutzer; Backoff bei Fehlern;
  `reauthentication_required` bei Token-Verlust (fail closed, kein stiller
  Passwort-Fallback).
- **Sync-Pipeline** (§24): Geräte → Capabilities → Profil-/Leistungsdaten →
  Tageswerte → Schlaf/HRV/RHR → Körperdaten → Aktivitäten → normalisieren →
  validieren → idempotent upserten → `data_providers.last_successful_sync_at`.
- **Capabilities**: beobachtete Daten haben Vorrang vor der Modellmatrix
  (§12): liefert ein Abruf echte Werte → `observed`; 404/leer nach
  mehreren Versuchen → `not_observed`; Fehler → `sync_failed`.
- **Aktivitäten**: `source='garmin'`, `source_record_id=<garmin activityId>`,
  Sport-Normalisierung über eigenes Mapping auf kanonische sport_ids
  (gym/running/cycling/swimming/…, `other`-Fallback wie `orvia_norm_sport`).
  Rohtyp bleibt in `metrics.source_sport_raw`.
- Verwendete garminconnect-Methoden (0.3.2, verifiziert):
  `get_devices, get_device_last_used, get_primary_training_device,
  get_user_profile, get_unit_system, get_user_summary, get_rhr_day,
  get_hrv_data, get_sleep_data, get_stress_data, get_body_battery,
  get_training_readiness, get_training_status, get_max_metrics,
  get_race_predictions, get_endurance_score, get_hill_score,
  get_running_tolerance, get_lactate_threshold, get_cycling_ftp,
  get_body_composition, get_daily_weigh_ins, get_fitnessage_data,
  get_daily_steps, get_intensity_minutes_data, get_spo2_data,
  get_respiration_data, get_floors, get_activities_by_date`.
- **Nicht-Ziele des Workers**: kein Schreiben in `app_state` (Blob gehört dem
  Gerät), keine ORVIA-Scores, keine UI-Logik.

## 7. Sicherheit (§27)

- service_role-Key + Fernet-Key + Garmin-Tokens existieren nur als
  Env-Variablen des Workers. Nichts davon erreicht Browser, env.js, Logs
  oder Git.
- `provider_credentials`: RLS aktiv, keine authenticated-Policies.
- Worker loggt Ereignisse ohne Payloads (kein Garmin-RohJSON in Logs).
- Client ↔ Worker nur über HTTPS + Supabase-JWT.

## 8. Migrationsweg zur offiziellen Garmin-API (§29)

Ersetzt werden NUR: `providers/garmin_unofficial.py` (→
`garmin_official.py` mit OAuth), `credential_kind` (`session_tokens` →
`oauth_tokens`), `provider_type` (`garmin_unofficial` → `garmin_official`,
beide bereits im Enum). `normalize.py` abwärts bleibt identisch, ebenso DB,
Resolver, UI. Historische `user_metrics`-Zeilen behalten ihren Provider —
keine Datenmigration nötig.

---

## 9. Folgephasen (PROPOSAL — noch NICHT implementiert)

**Phase 5 – Profil**: `ProfileMetricResolver` verbindet `metricsRepository` +
`metric-resolver` mit dem Profil-UI. Automatische Werte erscheinen in einem
neuen Bereich "Automatisch synchronisierte Daten" (Wert, Quelle, Gerät,
Zeitpunkt, Trend); editMode steuert Renderer (`_gwField` bekommt
locked/override-Varianten). Kritisch (Audit-Befund): die Doppelwelt
`weightKg`/`hfMaxMeasured`/`restingHrMeasured` (flach, cloud) vs.
`performance.body` (Metric, lokal) wird über den Resolver aufgelöst —
aufgelöste Garmin-Werte speisen die flachen kanonischen Felder über den
offiziellen Schreibpfad mit `source`-Stempel; `_metricSet`/
`_perfMirrorCanonical` dürfen Garmin-Quellen nicht mehr stillschweigend als
'manual' überschreiben.

**Phase 6 – Check-ins**: `renderMorning()`/`renderEve()` werden deklarativ
(Feldliste mit id/typ/range/default/condition). `CheckinFieldResolver`
blendet objektive Fragen aus, wenn ein frischer `user_metrics`-Wert existiert
(sleep_duration_min, hrv_ms, resting_hr, body_battery, steps …), und zeigt
sie kompakt als "Automatisch von Garmin". Fallback: Sync-Fehler/stale →
Frage wieder einblenden. Vorbedingungen (Audit-Befunde, VOR Phase 6 fixen):
(a) `ill`/`illness`-Feldbruch in `gatherMorning`/`checkinRepository`,
(b) Hydration überschreibt Blob-Morgen ohne Merge (weight/ankle-Verlust),
(c) stille Slider-Defaults (420/7/7/2) als echte Messwerte.

**Phase 7 – Kalorien**: `EnergyExpenditureResolver` ersetzt
`Calc.nutritionTargets`-Aktivitätsfaktor-Logik durch dynamischen TDEE
(BMR Mifflin/Katch-McArdle bei validem Körperfett + Schrittenergie +
Trainingsenergie + TEF + adaptive Korrektur über 14–28-Tage-Gewichtstrend);
Provider-Modus (Garmin total) vs. ORVIA-Modus parallel berechnet, Ergebnis in
`daily_energy_expenditure`. Double-Counting-Matrix: Garmin active_kcal ⊃
{Schritte, aufgezeichnete Workouts} — nie addieren, nur größere Quelle wählen.
Bestehender Bug (Audit): Aktivitätsfaktor + Trainingsburn addieren sich schon
heute; Fix gehört in diese Phase.

**Phase 8 – Engine-Input**: `TrainingInputResolver` bedient exakt den
v2-Vertrag (`readiness-engine-v2.js`/`decision-engine-v2.js`) aus
`user_metrics` + Check-ins + `training_load_daily`. Vorbedingung
(Audit-Befund): Shadow-Runner verletzt den v2-Vertrag heute
(doms/soreness, restingHrBaseline/rhrBaseline, safetyFlags-Shape) — erst
fixen, sonst validiert das Shadow-Gate falsche Daten. Garmin Training
Readiness bekommt wie Body Battery Gewicht 0 im v2-Score
(Komposit-Doppelzählung), bleibt aber als Anzeige-/Kontextwert.

**Phase 9 – Tests/Livegang**: Live-Connect mit echtem Konto, RLS-Livetests,
iPhone-Verifikation, Deploy-Checkliste (ein SW-Bump für das gesamte
Client-Paket der Phasen 5–6).

## 10. Offene Risiken

1. Inoffizielle API: Garmin kann SSO/Endpunkte jederzeit ändern
   (Cloudflare-Blocks sind dokumentiert) — Worker meldet dann `sync_failed`/
   `reauth_required`, App fällt kontrolliert auf manuelle Eingaben zurück.
   Genau dafür existiert die Provider-Abstraktion.
2. ToS-Risiko: python-garminconnect nutzt den mobilen SSO-Flow; für den
   kommerziellen Betrieb bleibt das offizielle Developer Program das Ziel.
3. Live-Schema kann von den Migrationsdateien abweichen (Alt-`activities` aus
   schema.sql vs. 0009) — vor dem ersten Worker-Livelauf Schema live prüfen.
4. Strava-Altdaten liegen nur im Tagesblob ohne Provider-Record-IDs —
   Garmin-Backfill derselben Zeiträume kann Dubletten neben Blob-Einträgen
   erzeugen; Backfill-Start deshalb konfigurierbar (`SYNC_BACKFILL_START`).
