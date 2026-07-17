# ORVIA · PROFILE-FIELD-MATRIX (verbindlich)

Status: VERBINDLICH für das Profil-/Onboarding-Redesign (M-Pakete). Stand: 2026-07-02.
Quellen: `js/profile.js:9–23` (PROFILE_DEFAULTS), `js/profile-model.js` (PROFILE_SECTIONS:365–375, Normalizer 387–620, Legacy-Projektion 221 ff.), `js/profile-store.js:14–15` (MAPPED = cloud13), Repos.
Evidenz je Konsument: [V] direkt verifiziert · [A] Audit 2026-07-02 · [U] ungeprüft (vor Verlass prüfen).
Ebene: **E** = Essential (Pflicht) · **E?** = Essential optional (skippbar) · **B** = Personalisierung · **C** = Advanced · **nie** = nie abfragen (berechnet/projiziert) · **†** = Ballast (nicht in neue UX übernehmen, Feld unangetastet lassen).

## 1. personal (planImpact: false)

| Feld | Typ | Ebene | Quelle | Konsument | Persistenz | Validator | Status/Zukunft · Begründung |
|---|---|---|---|---|---|---|---|
| name | string | **E** | Setup S1 | UI-Header [V] | cloud13 | validateProfile | behalten · Ansprache/Identität |
| birthDate (alt.: ageEstimate) | ISO-Date / int | **E** | Setup S1 | calc: HFmax-Tanaka-Fallback, Zonen [V] | cloud13 | validateProfile (13–100 J.) | behalten · einziger Alters-Input; eines von beiden Pflicht |
| age | int | nie | berechnet (computeAge) | überall Anzeige [V] | abgeleitet | — | nie abfragen · dynamisch aus birthDate/ageEstimate |
| sex | enum(+leer) | **E?** | Setup S1 (optional, „keine Angabe") | derzeit kein Engine-Konsum [A] | cloud13 | validateProfile | behalten optional · künftige HF-/Referenzwerte; Begründungstext Pflicht |
| heightCm | int | **E?** | Setup S7 (skippbar) | UI/BMI-Anzeige [A], kein Engine-Konsum [A] | cloud13 | 100–250 | behalten optional · **DEFAULT:175 entfernen** (ADR: fehlend=null) |
| weightKg | number | **E?** | Setup S7 (skippbar) | UI (W/kg, Ernährung) [A]; Load nutzt dur×rpe, NICHT Gewicht [V] | cloud13 | 30–300 | behalten optional · **DEFAULT:70 entfernen**; Smart Prompt statt Pflicht |
| timezone | string | nie | Browser-Detect | Anzeige/Tagesgrenzen [A] | cloud13 | — | automatisch · nie abfragen |
| avatar | dataURL | C | Zentrale | UI [V] | blob | — | behalten (Entscheidung N6 offen) |
| location | string | † | Alt-Editor | keiner [A] | blob | — | Ballast · kein Leser |
| sleepGoalH | number | B | Regeneration | calc/Anzeige Schlafsoll [A] | cloud13 | — | behalten B · Fallback 8 nur lokal, nie persistiert [V] |
| hfMaxMeasured / restingHrMeasured | int | B | Leistung („nur gemessen!") | calc Readiness/Zonen [V] | cloud13 | — | behalten B · Spiegel hfMax/rhrBaseline sind Projektionen (nie abfragen) [V] |

## 2. sports (planImpact: true) — je Eintrag `sports[]` (normalizeSport:498)

| Feld | Typ | Ebene | Quelle | Konsument | Persistenz | Validator | Status/Zukunft |
|---|---|---|---|---|---|---|---|
| sportId (+customName) | katalog-ID | **E** | Setup S2 (ChoiceCards) | activity-config Trainingsoptionen [V], Plan [A] | blob (Repo vorbereitet, unverdrahtet) | validateSportsSelection | behalten · min. 1 |
| role | primary/secondary/supplemental/occasional | **E** (nur primary-Wahl) | Setup S2 | Plan-Priorisierung [A] | blob | validateSportsSelection | behalten · Essential fragt nur „Hauptsport?", Rest default supplemental |
| level | enum | **E** (nur primary) | Setup S3 | UI lvl-Klasse [V], Plan-Heuristik [U] | blob | enum | behalten · **ersetzt globales PROFILE.level (Duplikat ×3: top-level/legacy/je Sport [A]) — kanonisch: sports[].level** |
| sessionsPerWeek | int | **E** (nur primary) | Setup S3 | Ausgangsvolumen Plan [A] | blob | 0–14 | behalten · Kernfrage Trainingsstand |
| typicalDuration | min | **E** (kompakt via S5) | Setup S5 | Plan [A] | blob | — | behalten · aus „typische Dauer"-Segment |
| activeInApp / includeInPlan | bool | B | Sportprofil-Editor | Sichtbarkeit/Plan [A] | blob | — | behalten B · enabled≠visible≠planning (CLAUDE.md) |
| preferredDays | array | B | Sportprofil-Editor | Plan [U] | blob | — | behalten B |
| seasonPhase | enum | C | Sportprofil-Editor | Plan [U] | blob | — | behalten C |
| sportProfile.* (role/position/zusatzpositionen/einsatz/fields{}/performancePriorities) | schema je Sport | B/C | Sportprofil-Wizard (5 Steps) | Plan sportartspezifisch [A]; performancePriorities/fields z. T. ohne Editor (Schema-Lücke [A]) | blob | schema-Normalizer | behalten · Editor-Lücken in M11-④ schließen |

## 3. goals (planImpact: true) — goals-v2 (normalizeGoals:95, validateGoal:148)

| Feld | Typ | Ebene | Quelle | Konsument | Persistenz | Validator | Status/Zukunft |
|---|---|---|---|---|---|---|---|
| goals[0].category/type | Katalog (GOAL_CATEGORIES:18) | **E** | Setup S4 | buildGoal→Progress-Subscore [V]; Plan nutzt Ziele NICHT direkt [V] | blob + user_goals (nur Migration) | validateGoal | behalten · 1 Ziel Pflicht |
| goals[].title/targetValue/unit/targetDate | mixed | B (im Setup optional expandierbar) | Setup S4 / Ziel-Editor | Anzeige/Progress [V] | blob | validateGoal | behalten · Datum via Smart Prompt nachfassen |
| goals[].priority/status/milestones | enum/array | B | Ziel-Manager | Anzeige [V] | blob | validateGoal | behalten B · Wizard 7→3 Steps |
| primaryGoal/primaryGoalLabel/raceDate/hmTargetMin/secondaryGoals | legacy | nie | Projektion (applyLegacyProjection [V]) | calc/ui Alt-Leser [V] | blob | — | nie abfragen · nur von Projektion geschrieben |
| goal (v1), raceName | legacy | † | — | keiner [A] | blob | — | Ballast |

## 4. availability (planImpact: true) — normalizeAvailability:460

| Feld | Typ | Ebene | Quelle | Konsument | Persistenz | Validator | Status/Zukunft |
|---|---|---|---|---|---|---|---|
| days{mo..so}.available | bool | **E** | Setup S5 (7 Tages-Kreise) | Plan [U — Engine-Konsum aktuell NICHT verifiziert, adaptWeekPlan nutzt nur fixedEvents [V]] | blob (Repo unverdrahtet) | ≥1 Tag | behalten · Engine-Anbindung = Plan-Engine-Phase |
| days{}.slots/doubleSession | struct | B | Verfügbarkeits-Editor | Plan [U] | blob | — | behalten B |
| maxSessionsPerWeek/maxIntenseSessions/preferredRestDays/minimumFullRestDays | int/array | B | Editor | Plan [U] | blob | — | behalten B |
| fixedCommitments | array | B | Editor (Schema da, Editor fehlt [A]) | adaptWeekPlan via fixedEvents-Projektion [V] | blob | — | Editor in M11-③ ergänzen |
| trainingDays/gymDays/fixedEvents (top-level) | legacy | † | — | trainingDays: keiner [V] | blob | — | Ballast/Duplikat zu availability |

## 5. body/performance (planImpact: false) — normalizePerformance:527, EINZIGER Bereich mit source+measuredAt [V]

| Feld | Typ | Ebene | Konsument | Zukunft |
|---|---|---|---|---|
| performance.body.{height,weight,bodyFat,leanMass,waist,restingHr,maxHr} (je {value,unit,source,measuredAt}) | Metric | B | Anzeige [A]; maxHr/restingHr → calc [V] | behalten · Vorbild fürs Metadaten-Muster |
| weightHistory[] | array | B | Trend-Anzeige [A] | behalten |
| vo2max/ftp/thresholdPace/cssPace/rowing2k/hyroxBest | Metric+extras | C | Zonen/Anzeige [A/U] | behalten C · „nur gemessen"-Hinweis |
| personalBests[]/strengthRecords[] (inkl. Epley-1RM estimate [V]) | arrays | C | gym-volume/Anzeige [A] | behalten C |
| weeklyKm/longestRunKm/typicalRunKm/recentRunsPerWeek/sessionMinutes | legacy flach | B→migrieren | calc nextRun/Plan [A] | in performance/sports überführen (M11-⑥), bis dahin lesen |

## 6. recovery (planImpact: false) — normalizeRecovery:387

sleep{averageHours,quality,consistency,bedtime,wakeTime} · stress{generalLevel,workSchoolLevel} · workPattern{type,shiftType,physicallyDemanding} · nutritionState{mode,energyAvailabilityLimited} · recoveryPreferences{preferredRestDays,activeRecoveryAllowed} — **alle Ebene B**, Quelle Regenerations-Editor, Konsument: Readiness-Kontext [A]/Anzeige, Persistenz blob, `_legacyText` nur lesend [V]. recoveryFocus/nutritionFocus (top-level) = † Ballast.

## 7. constraints (planImpact: true)

| Feld | Typ | Ebene | Konsument | Zukunft |
|---|---|---|---|---|
| constraintsList[].{bodyRegion(BODY_REGIONS:377),side,intensity,status,triggers,affectedActivities,adaptations,notes} | struct | **E** (nur Ja/Nein + Region+Intensität bei Ja), Rest B | Safety-Gates/issues-Projektion → calc [V] | behalten · Kern des Sicherheitschecks |
| issues[] (top-level) | legacy | nie | Alt-Leser [V] | Projektion aus constraintsList — nie abfragen |

## 8. preferences (planImpact: false) — normalizePreferences:401

preferredSports, dislikedTrainingForms(+Custom), preferredSessionDurations, preferredEnvironment, preferredTimes, intensityPreference, socialPreference, avoidedExercises[] (mit constraintId-Verknüpfung), varietyPreference, coachingStyle — **alle Ebene B**, blob, Konsument Plan/Anzeige [U/A]. coachingIntensity (top-level) = † Duplikat zu coachingStyle.

## 9. devices (planImpact: false) — normalizeDevices:572

equipment[]/trainingLocations[] = **C** (Advanced-Listen) · integrations{strava,garmin,appleHealth} = **C**, nur ehrlicher Status (Feature nicht live!) · manualSources[] = C · dataSources(top-level, DEFAULT:['Manuell']) = † Duplikat. gear[] (km-Tracking) = C/†-Kandidat (Leser prüfen [U]).

## 10. Steuerfelder (nie abfragen)

v, onboarded, weekPlan, planAdjustments, pauses†, customExercises†, hideAnkle†, adaptationMode/riskTolerance/checkinMode (=C-Einstellungen, Zentrale→Einstellungen), cycle†, nutrition†.

## 11. Essential-Minimalmenge (final, verbindlich)

**Pflicht (7 Essential-Bereiche mit ungefähr 10 Kerneingaben):** name · birthDate|ageEstimate · sports[]≥1 mit primary · sports[primary].level · sports[primary].sessionsPerWeek · sports[primary].typicalDuration · goals[0].category · availability.days≥1 · Sicherheitsfrage beantwortet (constraintsAcknowledgedAt bzw. constraintsList befüllt). Kodiert als Required-Sets in profile-model.js (`ESSENTIAL_REQUIREMENTS`, M1b) — Matrix und Code müssen synchron bleiben.
**Optional im Essential (ein skippbarer Schritt):** sex, heightCm, weightKg.
**Reicht für:** vollständige Profil-Grundlage + ersten Check-in (Check-in benötigt keine Pflicht-Profilfelder; Zonen fallen auf Tanaka zurück [V]).
**Reicht bewusst NICHT für:** vollständigen Trainingsplan (fehlend: Sportprofil-Details, Slots/Doppeleinheiten, Leistungswerte) — Ebene B, per Smart Prompts nachgefasst.
**Konsequenz:** PROFILE_DEFAULTS 70 kg/175 cm/„fortgeschritten" werden mit dem neuen Setup obsolet (ADR: fehlend = null; Umsetzung M1b/M5, nicht hier).

## 12. Duplikate/Ballast (Abbau-Reihenfolge in M11/M12, bis dahin nicht anfassen)

Duplikate: level ×3 (top-level [DEFAULT:'fortgeschritten'] / sports[].level / sportProfile) → kanonisch sports[].level · trainingDays+gymDays vs. availability · dataSources vs. devices · coachingIntensity vs. preferences.coachingStyle · body-Werte flach vs. performance.body.
Ballast (keine Leser [A]): location, raceName, goal(v1), nutrition, cycle, pauses, customExercises, hideAnkle, recoveryFocus, nutritionFocus, fixedEvents(top-level, durch Projektion ersetzt), gear[U].
