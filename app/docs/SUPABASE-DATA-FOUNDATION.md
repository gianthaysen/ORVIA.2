# ORVIA · Datenfundament (Supabase-Tabellen + RLS) — Phasenbericht

Ziel: verbindliche **serverseitige** Nutzertrennung statt nur lokalem Owner-Stempel.
Diese Phase liefert Tabellen, RLS, Repositories, idempotente Migration, Offline-Strategie
und Readiness-Zugriff über die neuen Tabellen. Onboarding/Planer bleiben unberührt.

---

## 1. Bestehende Datenarchitektur (Ist-Zustand)

- **Stack:** Vanilla-JS, kein Build-Step. Persistenz = `localStorage`, synchronisiert als **ein JSONB-Blob pro `user_id`** in `public.app_state` (`data.keys[...]`).
- **localStorage-Keys:**
  - `gian_checkins_v2` → die App-„DB": `{_v:4, "YYYY-MM-DD":{morning,eve,sessions,routines,subs,hsr?}, _stack, _hmTargetMin, _lastBackup}`
  - `orvia_profile_v1` → `PROFILE` (Name, Alter, Sex, height/weight, hfMax, rhrBaseline, sleepGoalH, Ziele, Sportarten …)
  - `orvia_consent`, `orvia_device`, `orvia_active_user`, `orvia_data_owner` (neu), `orvia_sync_rev`, `orvia_onboard_pending`
- **Nur lokal (bisher nicht normalisiert):** alle Check-ins, Trainingssessions, Readiness (wurde nie persistiert, nur berechnet), Ziele, Sportarten.
- **Bereits synchronisiert:** der gesamte Blob (Last-Write-Wins auf Snapshot-Ebene).
- **Historisch zu erhalten:** alle Tages-Check-ins + Trainingssessions (Gesundheits-/Last-Verlauf). Nichts wird gelöscht.

### Blob → Tabelle Mapping

| Blob-Feld | Zieltabelle | Zielspalte(n) | Migrationsregel | Konfliktregel |
|---|---|---|---|---|
| `orvia_profile_v1` | `user_profiles` | name, age, sex, height_cm, weight_kg, sleep_goal_h, timezone | 1:1 je Nutzer | Upsert PK `user_id` |
| `…profile.hfMax/rhrBaseline` | `user_profiles.hf_max / resting_hr` | nur wenn **gemessen** | Defaults (190/60) NICHT übernehmen → NULL | — |
| `DB[date].morning` | `daily_checkins` | sleep_*, resting_hr, hrv_*, body_battery, stress, feel, leg_strength, doms, complaints | je Tag, type=`morning` | Upsert `user_id,local_date,checkin_type` |
| `DB[date].eve` | `daily_checkins` | (Abend-Subset) | je Tag, type=`evening` | dito |
| `DB[date].sessions[sport]` | `training_load_daily` | sport, duration_min, distance_km, intensity, session_rpe, computed_load, client_session_id, external_id | je Einheit | Upsert ext: `user_id,source,external_id`; sonst `user_id,client_session_id` (deterministisch `blob:<date>:<sport>`); **keine** (date,sport)-Eindeutigkeit → mehrere Einheiten/Tag möglich |
| `profile.primaryGoal/secondaryGoals` | `user_goals` | client_goal_id, goal_type, title, target_date, priority | primär+sekundär | Upsert `user_id,client_goal_id` (deterministisch `blob:primary:<typ>` / `blob:secondary:<typ>`) |
| (berechnet) | `readiness_baselines` / `_scores` / `_components` | robuste Baselines + Scores | von der Engine geschrieben | `user_id,metric` bzw. `user_id,local_date,engine_version` |

---

## 2. Kernschema (SQL)

Datei: `supabase/migrations/0002_core_data_foundation.sql` — **11 Tabellen** (10 Kern + `orvia_migrations`).
Enthält Indizes (user_id, date) und Constraints/Dedupe:
- `daily_checkins` unique `(user_id, local_date, checkin_type)`
- `training_load_daily`: partielle Unique-Indizes für externe (`user,source,external_id`) **und** Client-Sessions (`user,client_session_id`) → keine Dubletten aus Strava/Garmin/manuell, aber mehrere Einheiten je Tag/Sportart möglich
- `readiness_baselines` unique `(user_id, metric)`, `readiness_scores` unique `(user_id, local_date, engine_version)`
- `user_sports`/`weekly_availability` unique je Nutzer

Bewusste Löschregeln: `user_id → auth.users ON DELETE CASCADE` (greift nur bei Konto-Löschung). `readiness_components → readiness_scores CASCADE` (Komponenten sind Score-Bestandteil). **Keine** Cascades zwischen unabhängigen Verlaufstabellen (checkins/training_load/baselines).

---

## 3. Row Level Security (aktiv)

`ENABLE` **und** `FORCE ROW LEVEL SECURITY` auf allen 11 Tabellen. Pro Tabelle vier Policies:

- **SELECT** `using (auth.uid() = user_id)`
- **INSERT** `with check (auth.uid() = user_id)` → keine fremde `user_id` einfügbar
- **UPDATE** `using (auth.uid()=user_id) with check (auth.uid()=user_id)` → `user_id` nicht auf anderen umschreibbar
- **DELETE** `using (auth.uid() = user_id)`

`readiness_components` zusätzlich mit **Parent-Konsistenz**: INSERT/UPDATE nur, wenn der referenzierte `readiness_score` ebenfalls dem Nutzer gehört.

---

## 4. Datenzugriffsschicht (Vanilla-JS Repositories)

`js/repos/repoBase.js` erzwingt: aktiver Auth-Nutzer, `user_id`-Scoping, erzwungene eigene `user_id` bei jedem Schreibvorgang (`stampUser`), strukturierte Fehler, Offline-Bewusstsein, sichere Upserts. Darauf:
`profileRepository`, `checkinRepository`, `readinessRepository`, `trainingLoadRepository`, `goalRepository` (+ `sports`), `availabilityRepository` (+ `fixedSchedule`). Die UI macht **keine** direkten Supabase-Abfragen mehr — alles über Repos.

---

## 5. Migration aus `app_state` (idempotent)

`js/migrate-blob.js` → `ORVIA.blobMigration.run()`, automatisch nach Login (best-effort).
- liest Blob + Profil, validiert, ordnet der aktuellen `user_id` zu
- schreibt über Repos (Upserts = Dedupe, wiederholbar)
- Status in `public.orvia_migrations`: `not_started → in_progress → completed | completed_with_warnings | failed`
- Report je Teilbereich (gefunden/migriert/Warnungen)
- markiert Blob als `blob_legacy=true`, **löscht ihn aber nicht** (Fallback bleibt)
- korrupter Blob → `failed`, Original unangetastet

---

## 6. Lokale Speicherung / Offline (neu begrenzt)

`js/offline-queue.js` → **IndexedDB**-Queue. Jeder Eintrag trägt `user_id, table(datentyp), version, created, sync_status` (`local_only|pending|syncing|synced|conflict|failed`). `flush()` synchronisiert **strikt nur die aktuelle `user_id`** → Offline-Daten von A landen nie unter B. localStorage bleibt nur für UI-Präferenzen/Onboarding-Zwischenstand/Gerätekennung; Gesundheits-/Last-/Baseline-Daten gehören in die Tabellen.

---

## 7. Readiness auf neue Quelle

`js/readiness-source.js` baut den ctx aus `daily_checkins` (serverseitig, isoliert) mit **robusten** Baselines (rollierender Median + MAD), persistiert Baselines/Scores/Komponenten. Regeln eingehalten: keine globalen/fremden Fallbacks, keine 190er-HFmax-Annahme, keine Strafe für fehlende HRV/Baseline, Cold-Start senkt **Konfidenz** nicht Score, Score/Entscheidung getrennt, `engine_version` gespeichert. Die bestehende **Safety-Cap-Logik in `calc.js` bleibt unverändert** (Knie ≥6 → rot etc.).

---

## 8. Tests — was tatsächlich ausgeführt wurde

**Von mir ausgeführt (lokal, Node):**
- Syntax-Check (`node --check`) aller neuen Module + SQL-Sanity → grün.
- Logik-Simulation der Multi-User-Isolation (localStorage/Owner-Stempel) → 6/6 Szenarien grün (aus voriger Phase).

**NOCH ausstehend — von dir gegen Live-Supabase auszuführen** (ich habe keinen Zugriff auf dein Projekt/Service-Key und kann keine echten Auth-Konten anlegen):
1. Migration `0002_core_data_foundation.sql` im SQL-Editor ausführen.
2. Zwei bestätigte Test-Accounts via Beta-Code anlegen.
3. RLS-Test starten:
   ```bash
   SUPABASE_URL="https://qzfaawmsurfzxmtysbbu.supabase.co" SUPABASE_ANON_KEY="sb_publishable_..." \
   A_EMAIL=… A_PW=… B_EMAIL=… B_PW=… node supabase/tests/rls_test.mjs
   ```
   Erwartung: A kann B weder lesen/ändern/einfügen/löschen — alle Versuche blockiert.
4. Accountwechsel-Test (UI): A Check-in/Ziel speichern → Logout → B anders → mehrfach wechseln → keine Fremddaten/Baselines/Ziele sichtbar.
5. Legacy-Migration-Test: Bestandsnutzer (Blob) vs. neuer Nutzer; Migration zweimal starten (keine Dubletten); Offline-Unterbrechung.

---

## 9. Gefundene Probleme / offene Risiken

- **Doppelte Persistenz-Phase:** Solange Blob + Tabellen parallel laufen, ist der Blob weiterhin „Quelle der Wahrheit" für die bestehende UI. Die UI liest noch NICHT aus den Repos — das ist bewusst Teil der NÄCHSTEN Phase (UI-Umstellung), sonst wären zu viele gleichzeitige Änderungen riskant.
- **`hf_max`/`resting_hr`:** Im Altprofil sind 190/60 Defaults (keine Messung). Migration übernimmt sie als NULL → korrekt, aber Gian/Bestandsnutzer sollten gemessene Werte nachtragen.
- **Konflikt-/Mehrgeräte-Merge:** weiterhin Last-Write-Wins; echter Feldmerge ist späterer Schritt.
- **RLS real ungetestet:** bis Schritt 8.3 grün ist, gilt die serverseitige Trennung als *implementiert, aber nicht verifiziert*.

## 10. Noch im Legacy-Blob (nicht migriert)

Bewusst **nicht** Teil dieses Fundaments (folgt mit Planer/Onboarding-Phasen):
`routines` (z.B. ssReps), `subs`/`_stack` (Supplement-Stack), `hsr`, `_hmTargetMin`, Gear/Equipment, `weekPlan`, `planAdjustments`, `cycle`, Routen-Polylines der Sessions (nur Last-Kennzahlen migriert, nicht die GPS-Strecke). Diese bleiben im Blob als Fallback erhalten.

---

### Geänderte/neue Dateien
**Neu:** `supabase/migrations/0002_core_data_foundation.sql`, `js/repos/{repoBase,profileRepository,checkinRepository,trainingLoadRepository,readinessRepository,goalRepository,availabilityRepository}.js`, `js/offline-queue.js`, `js/migrate-blob.js`, `js/readiness-source.js`, `supabase/tests/rls_test.mjs`.
**Geändert:** `index.html` (Script-Einbindung), `sw.js` (Cache `orvia-v8-63` + Assets), `js/auth.js` (`onAuthed`: Queue-Flush + Migration).

---

## Review-Korrekturen (vor Live-Ausführung umgesetzt)

1. **Manuelle Einheiten nicht mehr auf 1/Tag/Sport begrenzt** — der Index `(user_id,local_date,sport)` wurde entfernt (`drop index`). Dedupe jetzt über `external_id` (Importe) bzw. **`client_session_id`** (deterministische Client-ID). Mehrere Läufe/Gym-Sessions/Verein+Indi am selben Tag sind möglich.
2. **Idempotenz der Migration bewiesen** — `user_goals` hat `client_goal_id` mit Unique `(user_id, client_goal_id)`; `training_load_daily` `client_session_id`. `migrate-blob.js` bildet deterministische IDs (`blob:primary:<typ>`, `blob:<date>:<sport>`) → zweite Migration erzeugt identische Keys → Upsert statt Insert. Per Node-Lauf verifiziert (Lauf1===Lauf2).
3. **Echte Idempotenz/Robustheit** — explizite `add column if not exists`, Constraints per `drop+add`, Typänderungen/Spalten-Umbenennung (`age`→`age_estimate`, `start_time text`→`time`) als gezielte `ALTER`-Blöcke, Versions-Registry `schema_migrations`. Robust gegen Teilausführung/ältere Tabellen.
4. **`age` entfernt** — `birth_date` ist primäre Altersgrundlage, App rechnet dynamisch; `age_estimate` nur als Fallback ohne Geburtsdatum.
5. **`start_time` ist jetzt `time`** (mit sicherem Cast bestehender Textwerte → ungültige → NULL).
6. **Check-Constraints** für alle Wertebereiche (Schlafqualität/Befinden/Beinkraft 1–10, DOMS 0–10, Body Battery 0–100, Readiness 0–100, Dauer/Distanz ≥0, Gewicht/Größe/HFmax/Ruhepuls plausibel, Enums für stress/hrv_status/priority/status/type).
7. **Parent-Konsistenz `readiness_components` auf DB-Ebene** — BEFORE-Trigger `rc_force_owner()` übernimmt `user_id` zwingend aus dem Parent-Score (gilt auch für service_role/admin/Migration), nicht nur via RLS.
8. **Explizite Rechte** — `revoke all from anon, public` + `grant select,insert,update,delete to authenticated` je Tabelle. RLS begrenzt danach auf eigene Zeilen.
9. **Pflicht-Backup** — die Migration legt zu Beginn `private.app_state_backup` (geschütztes Schema, gesperrt) einmalig an, bevor irgendetwas geschieht. Details siehe Abschnitt „Zweite Korrekturrunde".

**Testskript** erweitert: prüft **alle** Tabellen generisch (SELECT-0-Zeilen + INSERT-mit-Fremd-`user_id`), unterscheidet **echte RLS-Blockade (SQLSTATE 42501 / „row-level security")** von Schemafehlern (die jetzt als Fehlschlag zählen), validiert alle ENV inkl. Passwörter, testet `readiness_components` cross-user (Positivkontrolle + zwei Blockade-Fälle) und räumt eigene Testdaten am Ende auf.

### Zweite Korrekturrunde (Backup-Sicherheit, start_time, Positivtests)

- **Backup im geschützten Schema** — `private.app_state_backup` (nicht `public`). `revoke all` für `anon/authenticated/public` auf dem Schema **und** der Tabelle; die App liest/schreibt sie nie. Zugriff nur durch privilegierte Serverrollen (Superuser/Datenbankadmin, `service_role` mit gesetztem `search_path`). Idempotent: bestehendes Backup wird nicht überschrieben, produktive Daten unverändert. Defensiv wird auch ein evtl. früher in `public` angelegtes Backup hart gesperrt.
- **`start_time` fehlertolerant** — Cast über `CASE … WHEN trim ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN …::time ELSE NULL END`. Akzeptiert `8:30`, `08:30`, `8:30:00`, `08:30:00`; ungültige Werte (`25:99`, `18:78`, `abends`) → NULL, **brechen die Migration nicht ab**. Behandelt: Spalte ist bereits `time` / noch `text` / fehlt / erneuter Lauf nach Teilabbruch.
- **Positivkontrollen je Tabelle** — der RLS-Test legt jetzt für **jede** der 11 Tabellen einen eigenen Datensatz an, liest, aktualisiert und löscht ihn (Nutzer A; Stichprobe auch Nutzer B für `daily_checkins`, `user_goals`, `training_load_daily`). `readiness_components` mit echtem Parent-Score. Damit kann ein versehentliches **Komplettverbot** nicht mehr als „erfolgreiche Isolation" durchgehen — es fällt als Positiv-Fehlschlag auf. Eindeutige Testmarkierung (`TAG`/`TDATE`), Exit-Code 1 bei jedem Fehlschlag, vollständiges Cleanup.
