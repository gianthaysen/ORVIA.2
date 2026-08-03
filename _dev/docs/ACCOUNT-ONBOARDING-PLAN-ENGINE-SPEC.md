# ORVIA · Kernblock-Spezifikation — Account, Athletenprofil, Plan-Engine
**Batch 1 (nur Spezifikation & Datenmodell — keine UI-Implementierung)**
Version 1.2 · Status: **Batch 1 freigegeben** (A–C entschieden)

> **Änderungen ggü. 1.1:** §10 A–C entschieden; §1.2 Sonderfelder feldweise eingeordnet (recoveryFocus/pauses/checkinMode behalten & migrieren; nutritionFocus/hideAnkle/planAdjustments verschieben; cycle = späteres sensibles Modul); §2.1 Capability-Metadaten je Sportart + Spezialisierungs-Staffelung; §3.2 cycle als separates Einwilligungsmodul; §11 auf 1.2.
> **Änderungen 1.0→1.1:** Equipment-Tabelle; Sportart vs. Disziplin; Cold-Start-Felder erhalten; erweiterte Termin-Typen; mehrere Verfügbarkeitsfenster/Tag; Consent-Versionierung; Onboarding-Statusmodell; Plan-Snapshot/Engine-Version + Determinismus; sport_details normalisiert + jsonb; Wertquellen/Confidence; Verfügbarkeit vs. Belastbarkeit.

---

## 0. Zweck & Geltung
Diese Datei ist die verbindliche Grundlage für den Umbau von Account-Erstellung, Athletenprofil und automatischer Planerstellung. **Vor dieser Prüfung wird keine große UI neu gebaut.** Reihenfolge: Datenmodell → Abhängigkeiten → Planlogik → erst danach UI (Batch 2+).

---

## 1. IST-Analyse — bestehender Code

### 1.1 Onboarding (Quelle: `js/profile.js`)
- `OB_STEPS` (Zeilen ~180–220): eine flache Schrittliste mit Typen `welcome | choice | multi | fields | photo | goals | done`.
- `openOnboarding(fresh)` / `renderOB()` / `obNext()` / `obPrev()` / `obFinish()` (Z. 223–293).
- **Autosave/Wiederaufnahme: FEHLT.** `OB` ist eine In-Memory-Kopie; bei Abbruch gehen Antworten verloren. Kein Fortschritt-Persist, kein „Später fortsetzen".
- **Sportartspezifische Folgefragen: FEHLEN.** Es gibt eine globale Sport-Mehrfachauswahl (`sports`), aber keine bedingten Detailfragen je Sportart.
- `obFinish()` schreibt ALLES in den flachen `PROFILE`-Blob (`localStorage 'orvia_profile_v1'`) und ruft zusätzlich `profileStore.persist()` (mapped Felder → `user_profiles`).

### 1.2 Profil-Datenmodell (Quelle: `js/profile.js` `PROFILE_DEFAULTS`)
Flacher Blob mit ~45 Feldern. Klassifikation:

**Aktiv genutzt (Plan/Logik-relevant):**
| Feld | Verwendet in |
|---|---|
| `name, birthDate, ageEstimate, age, sex, heightCm, weightKg` | `profile-store.js` → `user_profiles`, `calc.js` (_hrMax), `nutrition.js` |
| `hfMaxMeasured, restingHrMeasured, hfMax, rhrBaseline, sleepGoalH` | `calc.js` (Zonen, Readiness), `profile-store.js` |
| `sports[]` | `ui.js generateWeekPlan`, `renderTrainingSetup` |
| `level` | `ui.js generateWeekPlan/planDaysTarget`, `workout-ui.js` |
| `primaryGoal, primaryGoalLabel, goal, raceName, raceDate, hmTargetMin` | `ui.js goalOf/isRaceGoal/generateWeekPlan`, `extras.js` |
| `secondaryGoals[]` | nur Anzeige (kaum in Planlogik) |
| `trainingDays, gymDays` | `ui.js generateWeekPlan` (Tagesobergrenze, Gym-Teilmenge) |
| `fixedEvents[]` | `ui.js renderFixedEventsBox` — **aber NICHT in `generateWeekPlan` einberechnet** |
| `adaptationMode, riskTolerance` | `ui.js` Adapt-Engine (Tagesanpassung), nicht Wochenplan |
| `issues[]` | `issues.js`, `ui.js` gymInjuryHint |
| `equipment[]` | nur Anzeige/teilweise |
| `musclePriority{}` | `ui.js` Körperkarte |
| `weekPlan` | gespeicherter generierter/editierter Wochenplan |
| `dataSources[], coachingIntensity` | `orvia-pro.js` Data-Hub |

**Cold-Start-Felder — NICHT löschen, in `sport_details` migrieren (optional, importierbar):**
`weeklyKm`, `longestRunKm`, `typicalRunKm`, `recentRunsPerWeek`, `sessionMinutes`. Diese Werte sind die wichtigsten Eingaben der Plan-Engine, solange keine Garmin-/Strava-Historie vorliegt. Sie wandern in das passende `sport_details`-Objekt (z. B. running), sind optional und werden nach Import ersetzt/neu bewertet — aber **nie still** (Wertquelle, §2.2).

**Entfernen oder ableiten:**
- `age`/`ageEstimate` (Doppelung) → Alter dynamisch aus `birthDate`/`birthYear` ableiten, nicht getrennt persistieren.
- `_planUndo` → nur Laufzeitstatus, gehört NICHT ins persistente Profil.
- `gear` → eigenes Geräte-/Equipment-Modell (`user_equipment`, §3.2).
- `customExercises` → eigene Übungsdatenstruktur (Exercise-Bibliothek).
- `PHASES`, `WEEK_TARGETS` (Gian-hartcodiert) → **vollständig entfernen**, keine nutzerspezifischen Konstanten.

**Sonderfelder — feldweise entschieden (v1.2):**
| Feld | Entscheidung |
|---|---|
| `recoveryFocus` | **behalten** als optionale Präferenz unter Regeneration |
| `pauses` | **behalten**, migrieren in strukturiertes **Wiedereinstiegsmodell** (letzte regelmäßige Trainingsphase, Pausendauer, bisheriges Niveau, Wiedereinstiegsdatum). Fachlich relevant: Wiedereinsteiger mit 6 Monaten Pause ≠ aktuell trainierender Fortgeschrittener. |
| `checkinMode` | **behalten**, aber als spätere **App-Einstellung**, kein zentraler Plan-Input/Kern-Onboarding |
| `nutritionFocus` | **aus Plan-Onboarding entfernen** → späteres Ernährungsmodul |
| `hideAnkle` | **nicht ins Athletenprofil** → lokale UI-/Darstellungseinstellung |
| `planAdjustments` | **kein freies Profilfeld** → aus Anpassungsmodus + Planänderungshistorie ableiten |
| `cycle` | **optional behalten, NICHT in Batch 2 abfragen** → separates sensibles Modul (§3.3) |

### 1.3 Plan-Engine (Quelle: `js/ui.js generateWeekPlan`, Z. 46–106)
- Reine **Heuristik per if/else über Sport-Kombinationen** (run/bike/gym/swim). Hardcodierte Einheiten via `gpR/gpB/gpS/gpG/gpM`.
- `planDaysTarget()` Z. 33: Tagesobergrenze aus `trainingDays` oder Level-Default.
- **Kennt KEINE:** Mannschaftssportarten, Positionen, feste Termine als Belastung, Spieltage, Interferenzregeln, Regenerationssicherung, Progression/Tapering aus Profil, Plausibilitätsprüfungen.
- `PHASES`/`WEEK_TARGETS` (Z. 129–134): **hartcodiert auf Gians Halbmarathon-Daten** → muss raus (kein nutzerspezifischer Default).
- Rückgabe: `w[7]` Array von Tagen mit `{t,l,d,kind}` — kein Plan-Objekt mit Begründung/Warnungen/Confidence.

### 1.4 Bereits vorhandene, aber UNGENUTZTE Infrastruktur (Phase 4.1)
**Wichtigster Befund.** Das normalisierte Modell existiert größtenteils schon in Supabase, wird vom Live-Onboarding/Plan aber nicht verwendet:

- `js/training-domain.js`: `SPORTS`, `POSITIONS` (football/handball), `SEASON_PHASES`, `EXPERIENCE_LEVELS`, `GOAL_TYPES`, `GYM_GOAL_TYPES`, `MOVEMENT_PATTERNS`, `MUSCLE_GROUPS`, `EQUIPMENT`, `TRAINING_QUALITIES`, `normSport()`, deutsche Labels, `valid.*`.
- `js/repos/sportRepository.js`: `listSports/listPositions/listTrainingQualities`, `user_sports` (mit `role, position_key, season_phase, level, orvia_plans, external_plan, priority, active`), `user_goals` (mit `goal_type, sport_key, position_key, gym_goal_type, priority, status, target_date`).
- Supabase-Tabellen (0002/0003): `user_profiles`, `user_goals`, `user_sports`, `weekly_availability` (weekday 0–6), `fixed_schedule_items` (type in `training/match/competition/course/blocked`), Kataloge `sports`, `sport_positions`, `training_qualities`.

**Konsequenz:** Der Umbau ist überwiegend ein **Anschluss-/Migrations-Projekt** (Onboarding & Plan-Engine auf bestehende normalisierte Tabellen heben), nicht ein Greenfield-Neubau des Datenmodells.

---

## 2. ZIEL-Datenmodell (drei Ebenen)

### Ebene A — `account` (technisch; Auth, bestehend `js/auth.js` + Supabase Auth)
```js
account = { userId, email, emailVerified,
  termsVersion, privacyVersion, acceptedTermsAt, acceptedPrivacyAt }
```
Quelle: Supabase Auth + `user_profiles`. Consent **revisionssicher** (Version + Zeitpunkt) → Re-Consent bei neuer Rechtsfassung. Spalten s. §3.2. **Auth-Flow gilt als unverifiziert** bis zum Live-Audit in Batch 2 (§10).

### Ebene B — Athletenprofil (normalisiert, mehrere Tabellen)
```js
athleteProfile  = { displayName, birthYear, sex, heightCm, weightKg, country, timezone, unitSystem, level }   // → user_profiles (+ country, unit_system, timezone)
sportsProfile   = { selectedSports[], sportDetails{ [sportKey]: {…} } }                                        // → user_sports + NEU sport_details (jsonb)
goalProfile     = { primaryGoal, secondaryGoals[], eventGoals[] }                                              // → user_goals (priority: primary|secondary|optional)
availabilityProfile = { trainingDays, availableWindows[], fixedEvents[] }                                      // → weekly_availability + fixed_schedule_items
constraintProfile   = { complaints[], limitations[], equipment[] }                                            // → user_profiles.issues / NEU user_complaints, user_equipment
adaptationProfile   = { adjustmentMode, riskPreference }                                                       // → user_profiles (adjustment_mode, risk_preference)
onboarding = { version:2, status:'not_started'|'in_progress'|'ready_for_review'|'completed',
               currentStep, completedSteps:[], draftData, startedAt, completedAt }                              // → user_profiles
```
**Onboarding gilt erst nach Bestätigung der Zusammenfassung (`status='completed'`) als abgeschlossen** — nicht, weil alle Seiten besucht wurden.

### Ebene C — Plan-Engine (rein, deterministisch; neue Datei `js/plan-engine.js`)
Nimmt das vollständige Athletenprofil, gibt `generatedPlan` zurück (§5). Keine DOM-, keine DB-Zugriffe (testbar wie `calc.js`).

### 2.1 Sportart vs. Disziplin (verbindlich)
Disziplinen/Varianten sind **keine** eigenen Hauptsportarten. Trennung in drei Ebenen:
```js
{ sportKey: 'cycling', disciplineKey: 'road' | 'gravel' | 'mtb' | 'indoor' }
{ sportKey: 'running', disciplineKey: 'road' | 'trail' | 'track' | 'treadmill' }
{ sportKey: 'swimming', disciplineKey: 'pool' | 'open_water' }
{ sportKey: 'football', disciplineKey: 'club' | 'casual' | 'futsal' }
{ sportKey: 'tennis',  disciplineKey: 'singles' | 'doubles' }
{ sportKey: 'skiing',  disciplineKey: 'alpine' | 'nordic' }
```
**Echte zusätzliche Sportarten** (eigene Katalogeinträge `sports`/`sport_positions`): basketball, volleyball, hockey, rugby, american_football, badminton, squash, table_tennis, martial_arts, rowing, climbing. `mobility` bleibt **Modalität** (`session_type='mobility'`, `sport_key='gym'`), keine Hauptsportart.
Umsetzung: Katalogdaten (`sports.discipline_keys`, `sport_positions`), **kein** Code je Sportart.

**Capability-Metadaten je Sportart (verbindlich, v1.2).** Alle Sportarten kommen als Katalogdaten, aber keine erscheint „voll unterstützt", solange kein geprüftes spezialisiertes Regelset existiert. Pro `sports`-Eintrag:
```js
{ onboardingSupported, fixedScheduleSupported, genericPlanningSupported,
  specializedPlanningSupported, positionsSupported }
```
**Staffelung der Plan-Unterstützung:**
- **Voll spezialisiert (Regelset zuerst):** running, cycling, swimming, triathlon, gym, football, handball, tennis, padel → `specializedPlanningSupported:true`.
- **Generisch sportartspezifisch:** basketball, volleyball, hockey, rugby, american_football, badminton, squash, table_tennis, rowing → `genericPlanningSupported:true, specializedPlanningSupported:false`. Berücksichtigen bereits: feste Trainings, Spiele/Wettkämpfe, Position (optional), Saisonphase, Belastungsintensität, Zeitbedarf, Interferenz mit Gym/Ausdauer, Regeneration — aber **keine scheinbar hochspezialisierten Einheiten** ohne geprüftes Regelset.
- **Nur Erfassung + Terminbelastung:** martial_arts, skiing, climbing, weitere benutzerdefinierte → `genericPlanningSupported:false` (Profil/Termine/Belastung erfassen, generische Ergänzung).
Die Engine darf spezialisierte Inhalte nur erzeugen, wenn `specializedPlanningSupported:true`.

### 2.2 `sportDetails` — normalisierte Kernspalten + jsonb-Zusatz
Häufig abgefragte Kernfelder bleiben **normale Spalten** in `user_sports` (`role, position_key, season_phase, level, priority, active`, dazu `discipline_key`). `sport_details jsonb` NUR für variierende Zusatzinfos:
```js
user_sports.sport_details = {          // jsonb — variierende Zusatzdaten
  // Ausdauer: currentVolume, longestRecent, bestTimes:{}, surfaces:[], preferredDays:[]
  // Schwimmen: poolLength, openWater
  // Kraft: gymGoal, split, env, priorityMuscles:[], maintainMuscles:[], avoidExercises:[]
  // Team/Schläger: dominantHand, focusAreas:[], limitations:[]
  // (Cold-Start-Werte aus §1.2 landen hier, jeweils mit Wertquelle, s. u.)
}
```
**Wertquelle/Confidence (Pflicht für importierbare Kennzahlen):** Trainingsumfang, Bestzeiten, längste Einheit, Ruhepuls, HFmax, Gewicht, Leistungswerte werden als getrackter Wert gespeichert:
```js
{ value, source: 'user' | 'garmin' | 'strava' | 'calculated', updatedAt, confidence }
```
Importierte Daten dürfen Nutzereingaben **nie still** überschreiben — bei Konflikt sichtbarer Hinweis/Wahl.

### 2.3 Team-/Schlägersport-Modell
`teamSportProfile` (Spec §5.9) = Kernfelder als Spalten (`position_key`, `season_phase`, `level`, `priority`) + Termine in `fixed_schedule_items` (§3.2) + Zusatz in `sport_details`. EIN gemeinsames Modell; sportartspezifische Unterschiede aus `training-domain`-Konfiguration (`POSITIONS`, fokussierte `TRAINING_QUALITIES`, Interferenzregeln).

---

## 3. Migrationsstrategie

### 3.1 Legacy-`PROFILE` → normalisiert
- `onboardingVersion` einführen; bestehende Profile = `1`, neue = `2`.
- Migrationsfunktion `migrateProfileV1toV2(PROFILE)`: mappt flache Felder auf die Ebenen-Objekte; tote Felder (§1.2) verwerfen oder archivieren.
- Bestandsnutzer: kein Datenverlust — flacher Blob bleibt lesbar, wird beim ersten Profilöffnen migriert und in normalisierte Tabellen geschrieben.

### 3.2 Supabase — neue Spalten/Tabellen (Migration 0009, Entwurf)

**`user_profiles` — neue Spalten:**
`+ country text, + unit_system text, + adjustment_mode text, + risk_preference text`
Consent **revisionssicher**: `+ terms_version text, + privacy_version text, + accepted_terms_at timestamptz, + accepted_privacy_at timestamptz` (Re-Consent bei neuer Version möglich).
Onboarding-Status: `+ onboarding_version int default 1, + onboarding_status text default 'not_started', + onboarding_current_step text, + onboarding_completed_steps text[], + onboarding_draft jsonb, + onboarding_started_at timestamptz, + onboarding_completed_at timestamptz`. Constraint `onboarding_status in ('not_started','in_progress','ready_for_review','completed')`.

**`user_sports` — neue Spalten:** `+ discipline_key text, + sport_details jsonb default '{}'` (Kernfelder bleiben Spalten, §2.2).

**NEU `user_equipment`:**
```sql
create table public.user_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_key text,
  equipment_key text not null,
  available boolean not null default true,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sport_key, equipment_key)
);
```
RLS pro `auth.uid()`. `gear` (Legacy) wird hierher migriert.

**NEU `user_complaints`:** `region, intensity int (0–10), acute bool, recurring bool, avoid_movements text[], avoid_exercises text[], checked_by text, cleared bool`. RLS.

**`fixed_schedule_items` — Typmodell erweitern (Kategorie + Subtyp):**
`+ category text` (`sport | work | education | travel | health | blocked`), `+ subtype text` (`team_training | individual_training | match | competition | course | work | school | travel | physiotherapy | blocked | other`). Bestehender `type`-Constraint wird durch category/subtype ersetzt/ergänzt.
Pro Termin: Datum **oder** Wiederholungsregel, `start_time`, `end_time`/`duration_min`, `timezone`, `sport_key` (optional), `intensity` (bei sportlicher Last), `fixed bool`, `season_start`/`season_end` (optional), `exceptions` (abgesagte Einzeltermine, jsonb/Array).

**`weekly_availability` — mehrere Fenster/Tag:** Modell als Zeilen `(weekday, start_time, end_time)` — mehrere pro Wochentag erlaubt. Zusatz: `+ max_sessions_per_day int, + preferred bool, + blocked bool, + flexible bool`, plus `availability_exceptions` (einzelne Daten). Beispiel:
```js
[ { weekday:1, startTime:'06:00', endTime:'07:30' },
  { weekday:1, startTime:'18:00', endTime:'20:00' } ]
```
**Verfügbarkeit ≠ Belastbarkeit** (s. §5.0).

**`sports` (Katalog) — Capability-Spalten:** `+ discipline_keys text[], + onboarding_supported bool, + fixed_schedule_supported bool, + generic_planning_supported bool, + specialized_planning_supported bool, + positions_supported bool` (Werte gemäß Staffelung §2.1).

- Alles SECURITY INVOKER + RLS pro `auth.uid()` (Muster wie 0002–0008). Tests env-gated. **Migration wird erst nach Spec-Freigabe geschrieben.**

### 3.3 `cycle` — sensibles, freiwilliges Modul (NICHT Batch 2)
Zyklusdaten werden **nicht** als generische Zeichenkette gespeichert und **nicht** im Account-/Plan-Onboarding abgefragt. Eigenes späteres Modul mit: klarer Zweckbeschreibung, **expliziter Einwilligung**, vollständiger Löschmöglichkeit, enger Datenminimierung, **keiner Pflichtangabe**, **keiner stillen Ableitung**. In der Roadmap als nachgelagertes Modul geführt.

### 3.4 Reihenfolge
0009-Migration erst **nach** Freigabe dieser Spec; Live-Test gegen DB Pflicht vor „fertig".

---

## 4. Onboarding-Architektur (Spezifikation, Bau in Batch 2–4)
- Ein Schritt pro Themenblock; Überschrift + kurze Erklärung; Fortschrittsanzeige; Zurück/Weiter; **Autosave** (`onboarding_progress` jsonb); „Später fortsetzen"; Zusammenfassung vor Planerstellung.
- Reihenfolge (Spec §4): Willkommen → Basisprofil → Trainingsniveau → Sportarten → **bedingte sportartspezifische Folgefragen** → Hauptziel → Nebenziele (max 2) → Verfügbarkeit → feste Termine → Beschwerden → Equipment → Datenquellen → Anpassungsmodus → Zusammenfassung.
- Bedingte Anzeige: Folgefragen NUR für gewählte Sportarten (kein Gym-Block ohne Gym, keine Team-Fragen ohne Teamsport).
- Keine Gian-Defaults; keine vorausgewählten 6 Trainingstage; keine Wochenkilometer-Pflicht (Schätzung + späterer Import).
- Responsive: klein = einspaltig; groß = Leerraum für Erklärungen/Zusammenfassung.

---

## 5. Plan-Engine — Eingabe/Ausgabe & Regeln (neue Datei `js/plan-engine.js`)

### 5.0 Verfügbarkeit ≠ Belastbarkeit (Grundprinzip)
Die Engine unterscheidet **verfügbare** Zeitfenster (Kalender) von **belastbaren** Trainingstagen (Physiologie). Fünf freie Tage ⇒ nicht automatisch fünf sinnvolle Trainingstage. Belastbarkeit ergibt sich aus Niveau, Historie, festen Belastungen (Teamtraining/Spiel zählen mit), Beschwerden, Regenerationsbedarf, Reise/Arbeit. Verfügbarkeit ist Obergrenze, Belastbarkeit ist Steuergröße.

### 5.1 Eingabe
Vollständiges Athletenprofil (Ebene B) + Datenqualität (vorhandene Tage/Importe). Cold-Start-Werte (§1.2) wenn keine Historie.

### 5.2 Ausgabe
```js
generatedPlan = {
  version, generatedAt, primaryGoal,
  profileSnapshotVersion, profileSnapshotHash,   // Nachvollziehbarkeit: warum entstand dieser Plan
  engineVersion, rulesetVersion,                 // welche Engine/Regeln erzeugten ihn
  inputSnapshot,                                 // optional: reduzierter fachlicher Input
  weeklyStructure:[ /* je Wochentag: PlannedUnit[] */ ],
  progressionRules:{}, adjustmentRules:{}, warnings:[], assumptions:[],
  confidence:{ level, missingData:[] }
}
PlannedUnit = { id, weekday, sport, title, sessionType, priority, durationMin,
  distance, intensity, structure, fixed, movable, source, rationale }
```
Jede Einheit zeigt: was, wie lange, wie intensiv, warum, ob verschiebbar, Verhalten bei schlechter Tagesform.

**Determinismus (Testdefinition):** Bei **identischem fachlichem Input + identischer `engineVersion` + identischem `rulesetVersion`** müssen `weeklyStructure` (Einheiten + Entscheidungen) identisch sein. Vom Vergleich ausgenommen: `generatedAt`, technische IDs, sonstige Metadaten.

### 5.3 Stufenreihenfolge (deterministisch)
1. **Feste Belastungen setzen** — Mannschaftstraining, Spiele, Wettkämpfe, Kurse, nicht verschiebbare Termine (aus `fixed_schedule_items`). Zählen als reale Trainingstage.
2. **Hauptziel-Schlüsseleinheiten** platzieren (Long Run/Tempo/Intervalle; Spiel+Sprint/Kraft; Match+laterale Schnelligkeit; priorisierte Kraftsessions).
3. **Interferenzen vermeiden** (§5.4).
4. **Ergänzende Einheiten** verteilen (Gym, Mobility, Technik, Core, Prävention, lockere Ausdauer).
5. **Regeneration sichern** — Mindesterholung nach Level/Reise/Arbeit; keine künstliche Vollbelegung.
6. **Volumen festlegen** aus Niveau, Historie, Zeitbudget, Hauptziel, Sportanzahl, festen Belastungen, Beschwerden, Datenqualität — **nicht** aus erfundenem Wochenkilometerwert.
7. **Progression** — konservativer Einstieg, Steigerung, Entlastungswochen, Wettkampf-Tapering, Saisonphase, Reduktion bei Schmerz/schlechter Form.

### 5.4 Interferenzregeln (harte Verbote)
- Kein schweres Beintraining direkt vor Spiel/Match.
- Keine harten Intervalle direkt nach Spiel.
- Keine schwere Schulter-/Wurfbelastung vor Handball/Tennis/Padel.
- Keine zwei maximalen Unterkörpertage hintereinander.
- Kein Long Run direkt vor Fußballspiel.
- Keine hohe Sprungbelastung an mehreren Folgetagen.
- Gym wird **um** Teamsport/Ausdauer herum geplant; Mannschaftstraining-Beinlast wird mitgezählt.

### 5.5 Positions-/Sportlogik (aus Konfiguration)
Position ändert ergänzende Einheiten, **nicht** die Mannschaftstermine. Beispiele: Flügel → Beschleunigung/Wiederholungssprints/COD; Innenverteidiger → Maximalkraft/Sprungkraft; Torwart → Explosivität/lateral/Schulter; Tennis/Padel → Rotation/Anti-Rotation/Schulterstabilität/laterale Schnelligkeit, Schonung der Schlagschulter vor Match.

---

## 6. Plausibilitätsprüfungen (vor Planerstellung; verständlich anzeigen, nicht still korrigieren)
Gym-Tage > Trainingstage · mehrere feste Termine zeitgleich · Spieltag + schweres Beintraining davor · Hauptziel widerspricht Zeitbudget · zu viele intensive Einheiten · Anfänger mit Profi-Volumen · Wettkampfdatum in Vergangenheit · Teamsport ohne Mannschaftstermine · Triathlon ohne ≥2 Disziplinen · Zielzeit unrealistisch zur Historie · Beschwerden vs. geplante Belastung. → klare Meldung + automatische, erklärte Reduktion (mind. 1 Erholungstag).

---

## 7. Profiländerung & Neuplanung (Spezifikation)
Relevante Änderungen (neue Teamtermine, Spieltag, Hauptziel, neue Beschwerden, weniger Tage, neue Sportart) → Vorschau + betroffener Planbereich + Wahl: „ab nächster Woche / sofort neu planen / nur speichern". Plan nie still überschreiben.

---

## 8. Testmatrix (für Batch 5+; deterministische Engine ⇒ Node-testbar)
- **Account:** Registrierung, E-Mail-Bestätigung, ungültige E-Mail, schwaches Passwort, Passwort vergessen, unterbrochenes Onboarding fortsetzen, Account löschen.
- **Onboarding:** nur Laufen / nur Gym / nur Fußball / Fußball+Gym / Fußball+Laufen+Gym / Tennis+Gym / Triathlon; Anfänger/Wiedereinsteiger/Leistung; keine Wochen-km bekannt; Beschwerden; feste Termine; Zeitkonflikte.
- **Plan-Engine:** Mannschaftstraining zählt als Trainingstag · Spieltag höchste Priorität · kein schweres Beintraining vor Spiel · keine Schulterlast vor Tennis/Handball · Hauptziel gewinnt Zielkonflikt · Nebenziel erhalten · Anfänger konservativ · Zeitbudget eingehalten · keine Einheit außerhalb Fenster · Mindestregeneration · **deterministisch bei gleicher Eingabe** · **verschiedene Profile ⇒ verschiedene Pläne** · **keine Gian-Defaults**.
- **Persistenz:** Reload · anderer Browser · neues Gerät · Onboarding fortsetzen · Profiländerung · Neuplanung · keine Fremddaten (RLS).

---

## 9. Implementierungsreihenfolge (Batches)
- **Batch 1 (DIESE DATEI):** Spezifikation, IST-Analyse, Zielmodell, Migrationsbedarf, Engine-I/O, Regeln. Keine große UI.
- **Batch 2:** Account + Onboarding-Shell (Auth, Fortschritt, Autosave, Navigation, responsive).
- **Batch 3:** Basisprofil, Sportarten, dynamische Folgefragen, Team-/Schläger-Modell, Validierungen.
- **Batch 4:** Ziele, Verfügbarkeit, feste Termine, Kalenderlogik.
- **Batch 5:** Plan-Engine v1 (`js/plan-engine.js`) + Tests.
- **Batch 6:** Zusammenfassung + Planvorschau (Gründe/Warnungen/Bearbeiten).
- **Batch 7:** Persistenz, Migration 0009, RLS, Reload, neuer Login, iPhone, Responsive, Accessibility.
Nach jedem Batch: Tests · geänderte Dateien · offene Punkte · keine falsche Fertigmeldung.

---

## 10. Entscheidungen (im Review verbindlich festgelegt)
1. **Auth-Flow:** NICHT als funktionierend voraussetzen. Batch 2 startet mit echtem Audit: Supabase Site URL, erlaubte Redirect URLs, Registrierungsbestätigung, Passwort-Reset-Link, Rückkehr in installierte PWA, abgelaufene/mehrfach genutzte Links, erneutes Senden, E-Mail-Wechsel, Login nach Bestätigung. Status bis Live-Test: *„vorhandener Auth-Code, vollständiger Account-Flow noch nicht verifiziert"*.
2. **Equipment:** normalisierte Tabelle `user_equipment` (§3.2), **kein** globales JSON-Feld.
3. **Sportart vs. Disziplin:** drei Ebenen `sportKey/disciplineKey/Variante` (§2.1); echte neue Sportarten als Katalogeinträge; Mobility bleibt Modalität.
4. **Cold-Start-Felder bleiben erhalten** (§1.2) und wandern in `sport_details` mit Wertquelle.
5. **`generateWeekPlan` ablösen:** neue `js/plan-engine.js` ersetzt die Heuristik vollständig; `generateWeekPlan` wird Dünn-Adapter oder entfällt. `weekPlan` (`w[7]` von `{t,l,d}`) → `PlannedUnit` migrieren. `PHASES`/`WEEK_TARGETS` entfallen.

### A–C entschieden (v1.2)
- **A. Auth:** Batch 2 erhebt selbst Supabase Site URL + alle Redirect URLs (Browser/GitHub-Pages/installierte PWA/iPhone), prüft Registrierungsbestätigung, Passwort-Reset, abgelaufene/mehrfach genutzte Links, Rückkehr + Login nach Bestätigung. Status bis Live-Test: *„Vorhandener Auth-Code, vollständiger Account-Flow nicht verifiziert."*
- **B. Sonderfelder:** feldweise gemäß §1.2-Tabelle; `cycle` als sensibles Modul §3.3 (nicht Batch 2).
- **C. Katalog:** alle Sportarten als Katalogdaten + Capability-Metadaten (§2.1); spezialisierte Regelsets gestaffelt, keine Sportart erscheint „voll unterstützt" ohne geprüftes Regelset.

### Weiterhin offene **technische Audit**-Punkte (getrennt von Produktentscheidungen, in Batch 2 zu klären)
- Supabase Site URL + Redirect-URL-Konfiguration (Ist-Stand unbekannt).
- Funktioniert Deep-Link-Rückkehr in die **installierte PWA** auf iOS real?
- Verhalten bei abgelaufenen/mehrfach genutzten Bestätigungs-/Reset-Links.
- E-Mail-Wechsel-Flow vorhanden?

---

## 11. Abnahmekriterien Batch 1 (v1.2 — FREIGEGEBEN)
**Status: Batch 1 freigegeben.** A–C entschieden (§10). Folgende Punkte sind eingebaut:
1. Profilfelder klassifiziert; **Cold-Start-Felder bleiben erhalten** (§1.2).
2. Anschluss an bestehende Supabase-Tabellen beschrieben (§1.4).
3. Zielmodell trennt drei Ebenen sauber (§2).
4. **Sportart vs. Disziplin** definiert (§2.1).
5. **`user_equipment`-Tabelle** spezifiziert (§3.2).
6. **Mehrere Verfügbarkeitsfenster pro Tag** modelliert (§3.2).
7. **Vollständige Termin-Typen** (Kategorie + Subtyp) (§3.2).
8. **Consent-Versionierung** (§2/§3.2).
9. **Onboarding-Statusmodell** (`not_started/in_progress/ready_for_review/completed`) (§2/§3.2).
10. **Plan-Snapshot + Engine/Ruleset-Version** und Determinismus-Definition (§5.2).
11. **`sport_details` normalisiert + jsonb**, Kernfelder als Spalten (§2.2).
12. **Wertquellen/Confidence** für importierbare Kennzahlen (§2.2).
13. **Verfügbarkeit ≠ Belastbarkeit** als Engine-Prinzip (§5.0).
14. Migrationsbedarf (0009 + Legacy-Mapping) benannt (§3).
15. Plan-Engine-I/O, Stufen-/Interferenzregeln, Plausibilität (§5/§6).
16. Offene Punkte A–C (§10) beantwortet. ✓
17. Capability-Metadaten je Sportart + Staffelung (§2.1). ✓
18. Sonderfelder feldweise eingeordnet, `cycle` als sensibles Modul (§1.2/§3.3). ✓

**Spec-Status: freigegeben.** **Batch 2** baut ausschließlich: (1) Auth-Audit, (2) Account-Flow, (3) Onboarding-Shell, (4) Fortschritt + Autosave, (5) responsive Navigation. **Noch keine** vollständigen Sportfragebögen, **keine** Migration 0009, **keine** Plan-Engine.
