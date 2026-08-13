# ORVIA · Engine 3c — Scheduler Phase S0: Ground-Truth-Audit & eingefrorener Scheduler-Vertrag

Status: **S0 → S0b korrigiert — nur Audit + eingefrorener Vertrag, KEIN Produktivcode, KEIN Test, KEINE Migration, KEIN Commit/Deploy/SW-Bump.**
Stand-Baseline (unverändert seit S0-Audit): HEAD `014ac6f` [ahead 1] · SW `orvia-v8-194` · tracked-M 28 · Hashes (Audit-Zeitpunkt): calc.js `7be492c…`, ui.js `aad2721…`, workout-ui.js `8c7aa74…`, activity-config.js `5b6fab8…`, sw.js `429726f…`.
Vorbedingung: I3 Part A + Part B (inkl. I3a.1–I3a.6, I3b.1) freigegeben — kanonische Wochen-/Lastdaten, CTL/ATL/TSB/ACWR + Confidence, fail-closed Missingness, kanonische Plan-Ist-Zuordnung, sessiongenaue Tageserfüllung, keine Tag+Sport-Automatik.

**S0b-Korrektur (dieser Stand):** schließt die in der S0a-Vertragsabnahme benannten Lücken. Änderungen: (1) Produktentscheidungen A–D vollständig eingearbeitet (nicht mehr offen, siehe §14/§15); (2) `preferredRestDays` explizit ausschließlich weich, `restDay` explizit hart, `minimumFullRestDays` explizit harte Wochenanzahl (§4, §6); (3) Knowledge-Regel-Metadatenvertrag mit Version/Evidenzstatus/Freigabestatus/Quellen/Safety (§10a); (4) tägliche sportartübergreifende Kapazitätsobergrenze (§4, §6); (5) Soft-Constraints melden `satisfied`/`violated`/`neutral` statt nur „angewendet" (§5, §7); (6) ID-Semantik in vier eindeutig getrennte Ebenen (Template/Occurrence/Workout/Activity) aufgelöst (§5a); (7) Aktivierungsgates 0–5, Shadow-Vergleichsmetriken, Rollback-Vertrag (§14); (8) erster Planungshorizont für S1 exakt auf 7 lokale Kalendertage festgeschrieben (§4, §12); (9) unbekannte Kapazität wird nie automatisch verplant, Doppel-Einheiten standardmäßig deaktiviert, keine erfundenen Belastungswerte ohne Kapazitätsmodell (§6).

---

## 1. Ist-Architektur

Es existieren **zwei parallele Trainingsplanungs-Welten**. Das ist der zentrale Befund von S0.

### 1.1 LIVE-Pfad (produktiv, sichtbar)
| Ebene | Ort | Charakter |
|---|---|---|
| Wochenplan-Erzeugung | `ui.js generateWeekPlan()` (Z. 54–183) | **Heuristik**, verzweigt über Sport-Flags × Zieltyp × Level; erzeugt `w[7]` von `{t,l,d}`. Hartcodierte `PHASES` (Datumsanker 2026-06/08/09) und `WEEK_TARGETS` (`[Laufen 3, Schwimmen 2, Gym 4, Rad 2]`) — **Gian-spezifische Defaults**. |
| Wochenplan-Persistenz | `PROFILE.weekPlan` (7×`{t,l,d,id}`), `activeWeekPlan()` (ui.js:224), Occurrence-IDs `plannedOccurrenceIdFor`/`planLocalDateForIndex` (ui.js:206/212), IDs `ensurePlannedSessionIds`/`ensureGeneratedPlanIds` | rekurrente Wochenstruktur, self-healing |
| Prescription (Anzeige) | `unitStruct`/`unitGuidance`/`lrKm`/`weekKmTarget`/`runnaWeek` (ui.js:2198, calc.js:117/134) | Pace/km nur bei HM gültig; sonst Anstrengungs-Cues |
| Tagesentscheidung | `Calc.buildTrainingDecision` (calc.js:962) + `dayStateEngine`/`adaptSessionPlan`/`adaptWeekPlan`/`safetyCheck` (calc.js:869/906/945/1045) | **einzige produktive Entscheidungsquelle** |
| Plan-Ist | `Calc.resolvePlanActual` (calc.js) + Adapter `planActualResolveForDates`/`planActualToday` (ui.js) + Chip/Wochenplan-✓ | I3 Part B, fail-closed, sessiongenau |

### 1.2 SHADOW-Pfad (Engine v2 — parallel, steuert NICHTS)
Eingebunden in `index.html` (Z. 465–470) **und** `sw.js` (Z. 9), laufen aber ausschließlich im Schatten (`shadow-runner.js`: „v2 STEUERT NICHTS. Die sichtbare Entscheidung bleibt buildTrainingDecision (v1)"). `ENGINE-V2-DESIGN.md` behauptet noch „NICHT in index.html/sw.js" — **das Doc ist stale**; die E2-Batch (2026-07-11) hat sie für Shadow-Parallelrechnung verdrahtet.

| Schicht | Datei | Frage / Output | Laufzeit |
|---|---|---|---|
| Readiness v2 | `engine/readiness-engine-v2.js` | „Wie belastbar heute?" → `{score,confidence,factors,warnings,missingData}` | shadow (via shadow-runner) |
| Decision v2 | `engine/decision-engine-v2.js` | „Was heute tun?" → `{dayState,action,recommendedSession,adjustment,reasons,safeguards,confidence,missingData}` | shadow (via shadow-runner `decisionEngineV2.evaluate`) |
| **Plan v2** | `engine/plan-engine-v2.js` | „Wie ist die Woche gebaut?" → `{week[7],reasons,confidence,volumeSummary}` | **geladen, aber zur Laufzeit nicht aufgerufen — nur Tests** |
| Verträge | `engine/engine-contracts.js` | Reason-Katalog, `confidenceFrom`, Validatoren | shadow |
| Input-Resolver | `engine/training-input-resolver.js` | baut v2-Input aus Check-in + user_metrics + Last | shadow |

### 1.3 Test-only Module (NICHT in index.html/sw.js)
| Modul | Datei | Scheduler-Ebene |
|---|---|---|
| Goal Portfolio (Batch 3a) | `engine/goal-portfolio.js` (`buildPortfolio`, PORTFOLIO_VERSION 2, `gp-v2.0.0`) | **Goal Allocation** — implementiert, deklarativ |
| Running Capacity (Batch 3b.1) | `engine/running-capacity-factory.js` | **Capacity** (nur running, beobachtend) |
| Knowledge (Batch 3b.0) | `engine/knowledge/{knowledge-contracts,knowledge-sources,running-knowledge-pack,sport-coverage-matrix}.js` | **Session Requirements / Evidenz** |

**Kernaussage:** Die 7 vom Auftrag geforderten Scheduler-Ebenen existieren als Fragmente über LIVE-Heuristik + Shadow-Engine + test-only Fabriken verteilt. Ein zusammenhängender, aktivierter Scheduler existiert nicht (`sport-coverage-matrix`: `plannerSupport` überall `false`).

---

## 2. Consumer-/Producer-Landkarte (Datei:Zeile)

**Producer (Plan/Struktur):**
- `ui.js:54 generateWeekPlan` → `PROFILE.weekPlan` (LIVE-SSOT der Wochenstruktur).
- `ui.js:820 adaptWeekPlan-Persistenz` (schreibt `d.weekPlanAdjusted` in `PROFILE.weekPlan`).
- `engine/plan-engine-v2.js:build` → `week[7]` (shadow, test-only).
- `engine/goal-portfolio.js:buildPortfolio` → `allocations/minimumDoses/horizons` (test-only).
- `engine/running-capacity-factory.js` → Capacity-Beschreibung (test-only).

**Consumer (Plan):**
- `ui.js:1913 renderWeekPlan` (Anzeige + ✓ via `planActualResolveForDates`).
- `workout-ui.js:84 planFulfillmentToday` (Heute-Chip via `planActualToday`).
- `ui.js:2062 unitPriority`, `ui.js:2198 unitStruct`, `renderPlanEditor` (Anzeige/Bearbeitung).
- `ui.js:809 applyWeekAdjustments` (nimmt `currentDecision().weekPlanAdjusted`).

**Producer (Entscheidung/Adaptation):** `calc.js:962 buildTrainingDecision` (LIVE); `engine/shadow-runner.js:72 decisionEngineV2.evaluate` (shadow).
**Consumer (Entscheidung):** `ui.js orviaScore/renderCommand/getDecision` (LIVE); shadow-log user-scoped `orvia_engine_shadow_<uid>`.

**Producer (Plan-Ist):** `calc.js resolvePlanActual` + `ui.js` Adapter. **Consumer:** renderWeekPlan-✓, Heute-Chip. (Goal/Decision/Coach konsumieren Plan-Ist bewusst NICHT — I3 Part B.)

**Input-Producer (Profil/Verfügbarkeit):** `profile-model.js` — `normalizeAvailability` (Z. 611), `normalizeDay` (Z. 592), `normalizeSport` (Z. 630), `effectiveTrainingConfig` (Z. 1445), `availabilitySummary` (Z. 608). **Ziel-SSOT:** `PROFILE.goals` normalisiert via `profile-model normalizeGoal` (SCHEMA_VERSION 2); DB-Spiegel `user_goals`.

---

## 3. Bestehende Parallelpfade / zweite Sources of Truth (MUSS in S1+ konsolidiert werden)

1. **Wochenplan-Erzeugung doppelt:** LIVE `generateWeekPlan` (Heuristik, Gian-Defaults) ↔ shadow `plan-engine-v2.build` (kanonische Invarianten). → S-Scheduler muss `generateWeekPlan` gemäß `ACCOUNT-ONBOARDING-PLAN-ENGINE-SPEC §10.5` ablösen (Dünn-Adapter oder Entfall); `PHASES`/`WEEK_TARGETS` entfallen.
2. **Tagesentscheidung doppelt:** LIVE `buildTrainingDecision` (calc.js) ↔ shadow `decision-engine-v2`. Ablösung ist **Engine-v2-Aktivierungsgate C8**, NICHT Teil des Schedulers — der Scheduler konsumiert die jeweils LIVE-Entscheidung als Daily-Adaptation-Eingang.
3. **Kapazität mehrfach:** `calc.js recentRunStats/calculateRecommendedWeeklyRunVolume/weekKmTarget/runnaWeek` (LIVE, teils Gian-verankert) ↔ `running-capacity-factory` (shadow, evidenzbasiert) ↔ `dailyLoadSeries` (I3a, kanonisch). → EINE Capacity-Quelle je Sport (3b) festlegen.
4. **Zielquelle:** kanonisch `PROFILE.goals`; Legacy-Spiegel `DB._hmTargetMin`/`PROFILE.hmTargetMin`/`RACE.date` (nur Fallback, `goalOf()` liest SSOT zuerst).
5. **Verfügbarkeit doppelt gelesen:** `effectiveTrainingConfig` (LIVE, `gymDays`/`targetDays`) ↔ `plan-engine-v2 availableDays` (shadow). → EIN Verfügbarkeitsvertrag (`normalizeAvailability`) als Solver-Input.
6. **Interferenz/Regeneration** deklarativ in `SPORT_PROFILES` (calc.js:1026) + hart in Spec §5.4 + Ansätze in `plan-engine-v2` (leg-pain-Gate, no-two-hard) — **keine gemeinsame Regelquelle**.
7. **Rest-day / fixed schedule:** `availability.days[d].restDay` + `fixedCommitments[]` (profile-model) sind kanonisch, werden aber vom LIVE-`generateWeekPlan` **nicht** gelesen (nur `gymDays`/Ziel). `adaptWeekPlan`/`buildTrainingDecision` bekommen `fixedEvents` erst zur Laufzeit injiziert.

---

## 4. Finaler Scheduler-Eingangsvertrag (`SchedulerInput`, eingefroren)

Deterministisch, rein, injizierte Uhr. Alle Felder aus kanonischen Quellen; jedes fehlende Pflichtfeld ⇒ `missingFields` + konservative/`not_assessable`-Planung (nie erfundene Defaults).

```js
SchedulerInput = {
  now,                       // injizierte Uhr (ISO) — NIE Date.now() intern
  timezone,                  // effectiveTimezone (profileStore) — lokale Tagesbildung
  planningHorizonDays,       // S0b BINDEND: erster Planungshorizont (S1) = exakt 7 lokale Kalendertage,
                              // gebildet aus `timezone` (kein UTC-Tageswechsel). Spätere Horizonte (28/mehrjährig)
                              // sind eine offene Rhythmus-Frage (§15 Punkt 5), NICHT der S1-Default.
  inputSnapshotId,           // Hash über die fachlichen Eingaben (Nachvollziehbarkeit)

  athlete: {                 // profile-model, Ebene B
    level,                   // beginner|intermediate|advanced|competitive|return_after_break (primärsport-kanonisch)
    sports: [ {              // PROFILE.sports normalisiert (profile-model normalizeSport)
      sportId, disciplineKey, role,       // primary|secondary|supplemental|occasional
      activeInApp, includeInPlan, level, sessionsPerWeek, preferredDays[], typicalDuration,
      seasonPhase, position/positionKey,  // team/racket: sport_positions
      specializedPlanningSupported, genericPlanningSupported   // Capability-Staffel (Spec §2.1)
    } ]
  },

  goals: {                   // goal-portfolio-Eingang
    list: [ { id, category(kanonisch), group, priority(1..4), role(main|secondary|maintain|longterm),
              timeHorizon, targetDate('YYYY-MM-DD'), status, metricType, targetValue, unit, sports[] } ],
    portfolio                // OPTIONAL: Ergebnis buildPortfolio(snapshot) — Goal Allocation (§ Ebene 1)
  },

  availability: {            // profile-model normalizeAvailability — EINZIGE Verfügbarkeitsquelle
    // S0b BINDENDE Ruhetag-Semantik (3 unterschiedliche Ebenen, nie verwechselbar):
    //   restDay===true          HART   — expliziter Ruhetag eines Wochentags, nie überplanbar (Hard #1).
    //   minimumFullRestDays     HART   — harte Mindestanzahl vollständig freier Tage/Woche (Hard #13); der
    //                                    Scheduler MUSS mindestens so viele Tage ohne jede Einheit lassen,
    //                                    unabhängig davon, welche Tage das im Detail sind.
    //   preferredRestDays[]     WEICH  — reine Präferenz (§7 Soft-Constraint „Regeneration/Kontinuität"),
    //                                    darf niemals wie restDay blockierend wirken (Hard #14).
    days: { mo..so: { available, restDay, singleSession:{preferredTime,maxMinutes,intensityAllowed,preferredSports[]},
                      doubleSession:{enabled}, fixedCommitments:[{type,sport,start,end,fixed:true}] } },
    maxSessionsPerWeek, maxIntenseSessions, preferredRestDays[], minimumFullRestDays,
    dailyCapacityCeiling: { maxMinutesAllSports, maxLoadAU, confidence, missingFields[] } | null
                              // S0b NEU: sportartübergreifende Tagesobergrenze (Hard #18). Fehlt sie ⇒
                              // konservativ: kein Stacking mehrerer Sportarten am selben Tag ohne Nachweis.
  },

  fixedEvents: [ { day/date, type:'match'|'race'|'team_training'|'course', sport, fixed:true } ],  // aus fixedCommitments + Wettkampfkalender

  constraints: [ { id, kind, bodyRegion, intensity(0..10), status:'active'|'resolved', redFlag(bool), source } ],  // Beschwerden/Verletzungen/Red Flags (safetyCheck-kanonisch)

  readinessToday: { dayState, action, score, confidence, missingData[] },   // aus LIVE buildTrainingDecision (Daily Adaptation)

  capacity: {                // Batch 3b — je Sport konservative Bandbreiten + Confidence; running via running-capacity-factory
    perSport: { sportId: { weeklySessions, weeklyMinutes, weeklyDistanceKm, weeklyLoadAU, longSessionCeiling, confidence, missingFields[] } } | null,
    // S0b BINDEND (Produktentscheidung C, § 15): fehlt `perSport[sport]` oder ist sie `not_assessable`,
    // plant der Scheduler für diese Sportart KEIN automatisches Volumen/keine Progression (Hard #15/#17).
    // Eine konservative Grundstruktur ist NUR zulässig, wenn sie ausschließlich aus availability/Trainingshistorie/
    // sicheren Produktregeln ableitbar ist; sie trägt dann Pflicht-`confidence:'low'`+`missingFields`+`rationale`
    // (kein Null- oder Durchschnittswert-Ersatz).
  },

  loadHistory: {             // I3a kanonisch (dailyLoadSeries / weeklyActivityTotals)
    ctl, atl, tsb, acwr, acwrConfidence, weeklyLoadAU[], knownWeeks, provenance, assessable
  },

  planActual: {              // I3 Part B — resolvePlanActual-Aggregat der jüngsten Wochen
    byDay: { date: {status, completedCount, plannedCount, assessable} }, unmatched[], missed[], ambiguous[]
  },

  userGymPlans: [ { id, locked:true, days:[...], source:'user' } ],   // selbst erstellte/gesperrte Gym-Pläne (nicht überschreibbar)
  equipment: [...],          // user_equipment (Trainingsorte/Geräte)
  preferences: { adaptationMode, riskTolerance, preferredRestDays[], continuity },
  dataQuality: { days, importsPresent }
}
```

---

## 5. Finaler Ausgabevertrag (`SchedulerResult`, versioniert, deterministisch)

Determinismus-Definition (analog Spec §5.2): **identischer fachlicher Input + `schedulerVersion` + `rulesetVersion` ⇒ identische `plannedSessions`/`restDays`/`goalAllocation`**. Vom Vergleich ausgenommen: `generatedAt`, technische IDs, sonstige Metadaten. Reihenfolgeunabhängig, nicht-mutierend, byte-stabil.

```js
SchedulerResult = {
  schedulerVersion,          // z. B. 'sched-v1.0.0'
  rulesetVersion,            // Regel-/Heuristik-Pin
  generatedAt,               // NUR aus now (injiziert)
  planningHorizon: { fromDate, toDate, days },
  inputSnapshotId,
  goalAllocation,            // aus goal-portfolio: [{goalId, role, mode, weeklyBudgetRange(share), minimumDose[], daysToTarget, confidence}]
  capacity,                  // je Sport übernommene Kapazität + Confidence + missingFields (nie scheinpräzise)
  constraints: {             // aufgelöste Constraint-Nachweise
    hardApplied: [{code, detail, sourceRef}],
    // S0b BINDEND (Produktentscheidung D, §15): JEDE bewertete Soft-Constraint wird gemeldet, nicht nur
    // die angewendeten — Status ist einer von 'satisfied' | 'violated' | 'neutral' (keine Datenbasis/nicht anwendbar).
    soft: [{code, weight, status:'satisfied'|'violated'|'neutral', rationale, sourceRef}]
  },
  activationMode,           // S0b NEU (Produktentscheidung A, §14 Gate 0–5): IMMER 'shadow_only' vor Gate 4;
                              // Scheduler-Output darf vor Gate 4/5 nie live schreiben/anzeigen.
  knowledgeRulesUsed: [ KnowledgeRuleUsage ],   // S0b NEU — s. §10a; leer, solange keine freigegebene Regel greift
  plannedSessions: [ PlannedSession ],   // s. u.
  restDays: [ { date, reason:'user_fixed'|'recovery'|'forced_no_7of7', assessable } ],
  unallocatedRequirements: [ { capability, goalId, reason } ],   // benötigt, aber nicht platzierbar
  warnings: [ {code, severity, detail} ],
  missingFields: [ path ],
  confidence: 'high'|'medium'|'low'|'not_assessable',
  explanations: [ {code, title, explanation, inputValues, ruleVersion} ],   // maschinenlesbar (engine-contracts REASONS)
  provenance: { schedulerVersion, rulesetVersion, capacitySource, knowledgeVersion, portfolioRuleVersion }
}

PlannedSession = {
  occurrenceId,              // 'po:<localDate>:<templateSessionId>' — kompatibel zu I3 Part B (resolvePlanActual)
  templateSessionId,
  date, timeWindow,          // timeWindow optional (aus availability.singleSession.preferredTime/maxMinutes)
  sport, disciplineKey, subType,
  goalRef,                   // welches Ziel diese Einheit bedient (Allocation)
  purpose,                   // z. B. 'aerobic_base'|'threshold'|'long'|'strength_maxforce'|'skill'|'recovery'
  prescription: {            // NUR wenn belastbar; sonst Struktur ohne Scheingenauigkeit
    durationMin, distanceKm, load: {value, unit:'orvia_load_au', basis}, intensity: {zone, rpe, cue},
    structure: {warmup, main, cooldown, sets, reps, restSec, intervals}, assessable, missingFields[]
  },
  constraintProof: { hard:[code], soft:[{code, weight, status:'satisfied'|'violated'|'neutral'}] },
  adaptationBounds: { minVolume, maxVolume, canSwapModality, canDowngradeToEasy },
  moveRules: { movable, earliest, latest, blockedBy:['fixed_event','rest_day'] },
  abortSafety: { onRedFlag:'block', onOrange:'swap_or_reduce', onYellow:'reduce' },
  confidence, provenance
}

KnowledgeRuleUsage = {               // S0b NEU — Pflichtvertrag für jede im Scheduler faktisch genutzte Regel
  ruleId, version,                   // z. B. 'RUN-EASY-004', 'v1'
  evidenceClass: 'A'|'B'|'C'|'D',    // A=hochwertige Evidenz … D=product_policy/fallback (KNOWLEDGE-EVIDENCE-CONTRACT v5)
  evidenceStatus: 'verified'|'unverified'|'pending_review',
  approvalStatus: 'approved'|'blocked'|'pending',
  sources: [ {type, ref} ],          // Primärquelle/Dokumentation
  safety: { medicallyReviewed: bool, blockedReason },
  usedAs: 'product_policy'|'shadow_only'   // NIE 'evidence_based', solange approvalStatus!=='approved'
}
```

### 5a. ID-Semantik (vier eindeutig getrennte Ebenen, S0b BINDEND)

Der Scheduler-Vertrag unterscheidet vier nicht austauschbare Identitätsebenen. Eine Vermischung ist verboten.

| Ebene | Feld/Ursprung | Bedeutung | Kardinalität |
|---|---|---|---|
| **Template-ID** | `templateSessionId` | abstrakte, wiederverwendbare Session-Vorlage ohne Datum (z. B. „long_run_easy", „gym_upper_A") | 1 Template → n Occurrences über die Zeit |
| **Occurrence-ID** | `occurrenceId`, Format `po:<localDate>:<templateSessionId>` (I3-Part-B-kompatibel) | konkrete, datierte geplante Einheit für einen Athleten in einer Woche | 1 Occurrence → höchstens 1 Workout (Hard #6) |
| **Workout-ID** | `workout_sessions.id` / `workout_session_id` | die vom Nutzer in der App tatsächlich durchgeführte/geloggte Einheit; kann via `planned_session_id` auf eine Occurrence verweisen | 1 Workout → genau 1 gespiegelte Activity (`upsertActivityFromWorkout`) |
| **Activity-ID** | `activityId` (activity-store) | normalisierte Aktivität aus beliebiger Quelle (App-Workout ODER Wearable-Import); trägt optional `metrics.plannedSessionId` | 1 Activity → höchstens 1 Occurrence, NUR bei explizitem `plannedSessionId`-Match (nie Fallback, Hard #6/#9) |

Diese vier Ebenen sind die einzige zulässige ID-Grundlage für Scheduler-Output, Persistenz und Plan-Ist-Abgleich (I3 Part B). Kein anderer, impliziter ID-Begriff (z. B. „Session-ID" als Synonym für eine der vier Ebenen) darf eingeführt werden.

---

## 6. Hard Constraints (dürfen nie still verletzt werden)

1. **Fester Ruhetag** (`availability.days[d].restDay===true`) bleibt Ruhetag — nie überplant. **Nicht** `preferredRestDays` (das ist ausschließlich weich, s. Hard #14) — eine Verwechslung der beiden ist selbst ein Vertragsbruch.
2. **Krankheit / Verletzung / Red Flags** (`constraints[].redFlag`/`safetyCheck`) haben Vorrang; blockieren/ersetzen relevante Belastung (kontextabhängig: Knie ≠ Oberkörper).
3. **Keine Einheit über nachweisbarer aktueller Kapazität** (`capacity.perSport`; fehlt sie ⇒ konservativ/`not_assessable`, kein erfundenes Volumen).
4. **Keine unrealistische Pace/Distanz/Last** ohne Leistungsnachweis (Szenario 2; keine Watt-/Pace-Präzision ohne Historie).
5. **Keine Doppelbelegung unmöglicher Zeitfenster** (`singleSession.maxMinutes`, kein Doppel wenn `doubleSession.enabled===false`).
6. **One-to-one Plan-Ist** (I3 Part B-Invariante): keine Activity zwei Occurrences, keine Occurrence zwei Activities.
7. **Selbst erstellte/gesperrte Gym-Pläne** (`userGymPlans[].locked`) werden nie überschrieben — nur erlaubte Assistance/Stabilität ergänzt.
8. **Wettkämpfe/Spiele/feste Teamtrainings** (`fixedEvents.fixed:true`) bleiben fix und zählen als reale Trainingslast (Spec §5.3 Stufe 1).
9. **Unbekannte Pflichtdaten** ⇒ `not_assessable`/konservativ + `missingFields`, nie erfundene Defaults.
10. **Heute/Vergangenheit** werden nicht rückwirkend als neue Pflichttrainings geplan­t (Horizon startet frühestens heute; I3 Part B: Vergangenes bleibt `missed`/`unmatched`, wird nicht „nachgeplant").
11. **Sportartspezifische Regeneration/Interferenz** (`SPORT_PROFILES`, Spec §5.4): kein schweres Bein vor Spiel, keine harten Intervalle nach Spiel, keine zwei Max-Unterkörpertage in Folge, kein Long Run vor Fußballspiel, keine Schulter-/Wurflast vor Handball/Tennis/Padel, keine hohe Sprunglast an Folgetagen.
12. **Zwei harte Belastungen** nur kombinierbar, wenn ein **freigegebener** fachlicher Vertrag es erlaubt — aktuell existiert **kein** wissenschaftlich freigegebenes Regelset (alle 14 Knowledge-Regeln ungeprüft) ⇒ Default: **nie** zwei harte Tage in Folge.
13. **`minimumFullRestDays` ist eine harte Wochenanzahl** (§4): der Scheduler muss mindestens so viele vollständig freie Tage pro Woche lassen, unabhängig von Zielpriorität oder Soft-Constraints — Unterschreitung ist nie zulässig, auch nicht durch Umverteilung verpasster Einheiten (Szenario 8).
14. **`preferredRestDays` ist ausschließlich weich** (§7): sie darf nie wie ein expliziter `restDay` (#1) behandelt oder wie eine harte Sperre durchgesetzt werden; eine Verletzung von `preferredRestDays` ist zulässig, wenn Ziel-/Kapazitäts-Constraints es verlangen.
15. **Unbekannte/nicht belegte Kapazität wird nie automatisch verplant** (`capacity.perSport[sport]` fehlt oder `not_assessable`): keine automatische Volumen-Zuteilung oder Progression für diese Sportart; nur explizit vom Nutzer vorgegebene Strukturen (z. B. gesperrter Gym-Plan, Hard #7) bleiben bestehen.
16. **Doppel-Einheiten sind standardmäßig deaktiviert** (`doubleSession.enabled` default `false`): der Scheduler schlägt eine zweite Einheit am selben Tag nur vor, wenn `doubleSession.enabled===true` explizit gesetzt ist.
17. **Keine erfundenen Belastungswerte für Sportarten ohne belegtes Kapazitätsmodell**: `prescription.load`/`prescription.intensity` bleiben `assessable:false` mit `missingFields`, niemals ein geschätzter Platzhalter- oder Durchschnittswert (Produktentscheidung C, §15).
18. **Tägliche sportartübergreifende Kapazitätsobergrenze** (`dailyCapacityCeiling`, §4): Summe aus Dauer/Last aller an einem Tag geplanten Einheiten (über alle Sportarten) darf `maxMinutesAllSports`/`maxLoadAU` nicht überschreiten; fehlt die Obergrenze ⇒ konservativ, kein ungeprüftes Stacking mehrerer Sportarten am selben Tag.

---

## 7. Soft Constraints (mit Gewicht, Grund und Status)

| Soft-Constraint | Quelle | Vorschlag Gewicht | Grund |
|---|---|---|---|
| bevorzugte Tage/Uhrzeiten | `preferredDays`, `singleSession.preferredTime` | 0.15 | Adhärenz |
| bevorzugte Sportarten/Formen | `singleSession.preferredSports`, sport.role | 0.15 | Motivation |
| Abwechslung / Multisport | sports[]≥2 | 0.08 | Monotonie senken |
| Zielpriorität | portfolio `weeklyBudgetRange` | 0.20 | Fokusziel bevorzugen |
| langfristige Entwicklung | portfolio `minimumDose` longterm | 0.08 | Mehrjahresvorbereitung |
| Skill-/Positionsbedarf | `sport_positions`, `TRAINING_QUALITIES` | 0.10 | Positionsanforderung |
| Krafttransfer | gym-role, `SPORT_PROFILES` | 0.06 | Verletzungsprophylaxe/Leistung |
| Regeneration/Kontinuität (inkl. `preferredRestDays`) | `preferredRestDays` (WEICH — Hard #14), bestehende Routine | 0.10 | Nachhaltigkeit |
| minimale Planänderung | vorheriger Plan (Diff) | 0.08 | Stabilität, Vertrauen |

Gewichte sind **deklarativ und versioniert** (`rulesetVersion`), deterministisch; Summe normiert; **jede** Soft-Constraint wird bewertet und erzeugt einen `soft`-`constraintProof`-Eintrag mit `rationale` und einem von drei Status: `satisfied` (erfüllt), `violated` (verletzt, aber zulässig da nur weich), `neutral` (keine Datenbasis/nicht anwendbar für diese Einheit). Es werden **nie nur die erfüllten** Constraints gemeldet. Soft darf **nie** ein Hard-Constraint aufweichen.

**Deterministisches Tie-Break (S0b NEU, allgemeingültig):** ergeben zwei Kandidaten-Optionen denselben gewichteten Soft-Score, entscheidet in dieser Reihenfolge: (1) die Option mit weniger `violated`-Soft-Constraints nach Gewicht absteigend, (2) bei weiterem Gleichstand die lexikographisch kleinere `templateSessionId`, (3) bei weiterem Gleichstand die lexikographisch kleinere `occurrenceId`. Array-Reihenfolge der Eingabe ist niemals Tie-Break-Kriterium.

**Aktivierungsstatus (Produktentscheidung D, §14):** Soft-Constraint-Gewichte werden bis einschließlich Gate 3 (§14) ausschließlich shadow-seitig ausgewertet — sie beeinflussen kein live sichtbares Ergebnis, solange `activationMode!=='live'`.

---

## 8. Konfliktauflösung (deterministisch, dokumentiert)

1. **Hard vor Soft, immer.** Safety/Red Flag/Ruhetag/fixes Event schlagen jede Präferenz.
2. **Zielkonflikt:** `goal-portfolio` entscheidet — Rolle strikt aus Nutzerpriorität (`H_ROLE_FROM_PRIORITY`); Dringlichkeit ersetzt Fokus nie still (`H_FOCUS_USER_PRIORITY`); dual-top-1 ⇒ früheres Datum, dann id, **immer mit explizitem Konflikt** (`dual_top_priority`); konkurrierende Rennen < 42 Tage ⇒ Staffelung (`H_COMPETING_RACES`).
3. **Kapazität vs. Ziel:** Kapazität begrenzt Volumen; unrealistisches Ziel ⇒ Warnung + konservativer Plan (Szenario 2/11), keine erfundene Progression.
4. **Interferenz vs. Wunschtag:** Interferenzregel (Hard) verschiebt/ersetzt die Einheit; Wunschtag (Soft) weicht.
5. **Unsicherheit:** gemischte/fehlende Daten ⇒ konservativere Wahl + niedrigere Confidence (nie Hochstufung zu completed/„sicher").
6. **Fachlich nicht auflösbar** ⇒ `unallocatedRequirements` + Warnung + `not_assessable`, statt zu raten.

---

## 9. Pflichtszenarien mit erwarteten Ergebnissen

1. **Do fester Ruhetag** → Do bleibt in `restDays` (`reason:'user_fixed'`); keine Einheit, auch nicht bei Umverteilung (Hard #1).
2. **HM in 9 Wochen, längster Lauf 12,5 km** → keine 9-km-Intervalle @4:42/km ohne Leistungsnachweis; Kapazität begrenzt Long-Run-Steigerung, Intensität nur im belegten Rahmen; sonst Struktur ohne Pace + `missingFields:['capacity.perSport.running']`, Warnung `unrealistic_target`.
3. **HM Hauptziel; Ironman 2028 (Sub-10) + 70.3 2027 Sekundär** → `goalAllocation`: HM `role:main mode:focus` (Budget 0.60–0.75), 70.3/Ironman `secondary/longterm` mit Minimum-Dosen (Schwimmtechnik/Radbasis/Kraft ≥1×/Wo als **shareable** Frequenz-Floors); Langfristziele „prepared", nicht dominant.
4. **Nur Gym, 6 Tage** → Split aus Ziel/Erfahrung/Regeneration/Präferenz (`gymSplit`), **kein** blindes Bro-Split/PPL; Ruhetag erzwungen (nie 7/7); ≤ erlaubte harte Tage.
5. **Eigener Gym-Plan vorhanden** (`userGymPlans[].locked`) → Scheduler terminiert ihn unverändert und ergänzt nur erlaubte Assistance/Stabilität; kein Überschreiben (Hard #7).
6. **Fußballspieler mit Position** → `sport_positions` steuert **ergänzende** Einheiten (Flügel: Sprint/COD; IV: Max-/Sprungkraft; TW: Explosiv/lateral/Schulter), nicht die Mannschaftstermine (fix); Interferenz vor/nach Spiel (Hard #11).
7. **Zwei Einheiten derselben Sportart/Tag** → zwei getrennte `PlannedSession` mit eigener `occurrenceId`; getrennte Erfüllung (I3 Part B session-genau; kein Sport-Set-Dedupe).
8. **Training verpasst** (`planActual.missed`) → sinnvolle Umverteilung im Horizon **ohne** Überladung: `adaptWeekPlan`-Prinzip (≥48 h Abstand, kein Event-Konflikt; wenn kein Platz ⇒ nicht nachholen, Woche bleibt realistisch); nie automatisch die ganze Woche verdichten.
9. **Ungeplante Garmin-Aktivität** → zählt zur Last (`loadHistory`, separater Pfad), erfüllt **ohne** plan-eigene ID **keine** Plan-Einheit (`unmatched`; I3 Part B).
10. **Red Flag am Trainingstag** → geplante Einheit `abortSafety.onRedFlag:'block'` bzw. Swap/Reduce; Daily Adaptation überschreibt die Prescription konservativ (Hard #2).
11. **Fehlende Lastdaten** → keine scheinpräzise Progression; `capacity`/`prescription.load` `assessable:false` + `missingFields`; Volumen konservativ eingefroren.
12. **Mehrere konkurrierende Ziele** → dokumentierte Priorisierung (`goalAllocation` + `conflicts`); < 42 Tage-Rennen gestaffelt; Konflikt sichtbar in `warnings`/`explanations`.

---

## 10. Missingness-/Confidence-Vertrag

- Jedes fehlende Pflichtfeld ⇒ `missingFields[path]` + **konservative** Wirkung; nie erfundener Default (Spec §5.6, goal-portfolio, I3a-fail-closed).
- `confidence` deterministisch aus Missingness (monoton additiv; irrelevante fehlende Felder zählen nicht — vgl. goal-portfolio `H_CONFIDENCE_LADDER`).
- Kapazität/Last ohne Belastbarkeit ⇒ `not_assessable` statt Zahl; ACWR/TSB nie scheinpräzise (I3a.2/.4/.5/.6-Kontrakt übernehmen).
- Fehlende Activity-/Planquelle ⇒ Plan-Ist `unknown` (nie `missed`/erfüllt; I3b.1 fail-closed).
- Knowledge: **alle 14 Regeln wissenschaftlich ungeprüft, keine Produktionsautorität**; RUN-SAFE-001/RUN-RTR-001 zusätzlich medizinisch gesperrt. Prescriptions dürfen sie nur als sichtbar `product_policy`/`shadow` nutzen, nie als Evidenzfreigabe.

### 10a. Knowledge-Regel-Metadatenvertrag (S0b BINDEND, Produktentscheidung B)

Jede Regel, die der Scheduler in irgendeiner Form konsultiert (auch nur als `product_policy`/Struktur-Hinweis), muss als `KnowledgeRuleUsage` (§5) mit vollständigen Metadaten erscheinen:

- **`version`** — Regel-Version (z. B. `v1`); Änderungen an einer Regel erzeugen eine neue Version, nie ein stilles Überschreiben.
- **`evidenceClass`** — `A`–`D` gemäß `KNOWLEDGE-EVIDENCE-CONTRACT.md` (v5); `D` = `product_policy`/Fallback, nie als Evidenzfreigabe interpretierbar.
- **`evidenceStatus`** — `verified` | `unverified` | `pending_review`. Aktueller Ist-Stand: **alle 14 Running-Pack-Regeln `unverified`.**
- **`approvalStatus`** — `approved` | `blocked` | `pending`. Nur `approved`-Regeln dürfen `usedAs:'evidence_based'`-artige Autorität beanspruchen (aktuell: keine). `RUN-SAFE-001`/`RUN-RTR-001` sind `blocked` (medizinisch gesperrt) bis zu einer expliziten fachärztlichen Freigabe.
- **`sources`** — Primärquelle(n)/Dokumentations-Referenz je Regel.
- **`safety`** — `{medicallyReviewed, blockedReason}`; medizinisch relevante Regeln bleiben gesperrt, bis `medicallyReviewed===true` UND eine explizite Freigabe vorliegt.

Eine Regel ohne vollständige Metadaten darf der Scheduler **nicht** konsultieren (fail-closed, analog I3a-Confidence-Normalisierung). Fehlen Metadaten ⇒ Regel wird ignoriert, nicht mit Default „hoch/erlaubt" behandelt.

---

## 11. Testmatrix (für S1+ zu bauen; deterministische Engine ⇒ Node-testbar)

| Kategorie | Fälle (min.) |
|---|---|
| Golden | je Pflichtszenario 1–12 ein erwartetes Ergebnis |
| Property | Reihenfolgeunabhängigkeit (Plan/Activity/Sport-Arrays); Determinismus (byte-stabil bei gleichem Input+Version); Nicht-Mutation; nie 7/7 |
| Invarianten | Ruhetag frei; kein zwei-harte-Tage-in-Folge; Verfügbarkeit nie ignoriert; keine Doppeleinheit über Fenster; nur aktive/`includeInPlan`-Sportarten; keine negativen Minuten; One-to-one Plan-Ist |
| Missingness | fehlende sessionsPerWeek/typicalDuration/Kapazität/Last/Ziel/Verfügbarkeit ⇒ konservativ + missingFields, nie erfunden |
| Constraint-Konflikt | Ruhetag vs. Wunscheinheit; fixes Event vs. Ziel-Schlüsseleinheit; Interferenz vor/nach Spiel; leg-pain ≥5 + Impact-Sport |
| Zeitzone/DST | Occurrence-Tag anhand injizierter tz; kein stiller UTC-Wechsel; DST-Übergang deterministisch |
| Multi-Sport-Interferenz | Fußball+Gym+Lauf; Tennis+Gym; Triathlon (≥2 Disziplinen) — §5.4-Verbote |
| Feste Ruhetage | `restDay`/`preferredRestDays`/`minimumFullRestDays` respektiert |
| Überlast/Red Flag | Red Flag blockt; ORANGE swap; YELLOW reduce; Kapazitätsobergrenze hält |
| Plan-Ist-Kompatibilität | Scheduler-`occurrenceId` = I3 Part B-Format; resolvePlanActual verlinkt neue Pläne korrekt |
| Anti-Gian | verschiedene Profile ⇒ verschiedene Pläne; **keine hartcodierten Gian-Defaults** (PHASES/WEEK_TARGETS entfernt) |

---

## 12. Implementierungsplan S1–S6 (kleine, getrennte Batches)

- **S1 — Scheduler-Input + Determinismus-Skelett.** Reine `buildSchedulerInput(profileSnapshot, goals, availability, capacity, loadHistory, planActual, now)` + `SchedulerResult`-Gerüst (leer, nur `provenance`/`missingFields`/`confidence`). **`planningHorizonDays` ist für S1 fest auf exakt 7 lokale Kalendertage** (aus `timezone` gebildet, kein UTC-Tageswechsel) — kein Rolling/28-Tage/mehrjährig in S1. `activationMode` immer `'shadow_only'`. Nur Verträge + Golden/Property-Tests. Kein Planinhalt. Keine UI, kein SW-Bump.
- **S2 — Goal Allocation-Adapter.** `goal-portfolio.buildPortfolio` in den Scheduler einhängen (`goalAllocation`, Minimum-Dosen als shareable Floors). Reuse, kein Zweit-SSOT.
- **S3 — Capacity-Adapter (3b).** `running-capacity-factory` + `dailyLoadSeries` → `capacity.perSport.running`; andere Sportarten `not_assessable` bis Regelset. Keine erfundenen Bänder.
- **S4 — Constraint Solver.** `plan-engine-v2.build` härten/übernehmen: Verfügbarkeit + `restDay` + `fixedEvents` + Interferenz (`SPORT_PROFILES`/§5.4) → `plannedSessions` mit `occurrenceId` (I3-kompatibel), `restDays`, `moveRules`. **Ablösung** von `generateWeekPlan` als Dünn-Adapter (Feature-Flag, Legacy-Fallback). `PHASES`/`WEEK_TARGETS` entfernen.
- **S5 — Session Prescription + Sport-Rule-Packs.** Dauer/Distanz/Intensität/Struktur **nur** aus belegter Kapazität + freigegebenem Wissen; solange Knowledge ungeprüft ⇒ Struktur/Cues ohne Scheingenauigkeit. Positions-/Sportlogik aus Konfiguration (`sport_positions`).
- **S6 — Daily Adaptation + Plan-Actual Learning-Integration.** Scheduler-Output ⇄ LIVE `buildTrainingDecision` (Adaptation) und `resolvePlanActual` (Erfüllung); verpasste/teilweise/ungeplante Einheiten fließen deterministisch in die nächste Planung (ohne Überladung). UI-Umschaltung erst nach Gate.

Jeder Batch: rote Vertragstests zuerst, minimaler Patch, volle Regression, Diff-/Hash-Audit, §22-Bericht, harter Stopp. Keine Migration/Commit/SW-Bump ohne getrennte Freigabe.

---

## 13. Modell-Empfehlung je Batch

| Batch | Empfehlung | Grund |
|---|---|---|
| S1 (Verträge/Skelett) | **Opus 4.8 High** | architektonische Vertragsfestlegung, weitreichend |
| S2 (Goal-Adapter) | Sonnet 5 High | Adaption bestehender, getesteter Fabrik |
| S3 (Capacity-Adapter) | **Opus 4.8 High** | Kapazitäts-/Evidenz-Semantik, fehleranfällig |
| S4 (Constraint Solver) | **Opus 4.8 High** | Kern-Scheduler, Interferenz/Ablösung generateWeekPlan |
| S5 (Prescription/Rule-Packs) | **Opus 4.8 High** | Sicherheits-/Evidenzgrenzen, Sport-Spezifik |
| S6 (Adaptation/Learning) | Sonnet 5 High → Opus für Integrationsentscheidungen | überwiegend Verdrahtung bestehender Verträge |

---

## 14. Aktivierungsgates, Shadow-Vergleichsmetriken & Rollback-Vertrag (S0b NEU, Produktentscheidung A)

**Grundsatz (bindend):** kein harter Cutover von `generateWeekPlan`. Der neue Scheduler läuft ab S1 ausschließlich mit `activationMode:'shadow_only'` — er darf `PROFILE.weekPlan` oder jede andere live sichtbare Struktur weder schreiben noch verändern noch anzeigen, bis Gate 4 explizit freigegeben ist. Alt- und Neu-Scheduler dürfen nie dauerhaft gleichzeitig als schreibende Quellen der Wahrheit existieren (kein permanentes Dual-SSOT) — der Übergang läuft über die Gates 0–5, danach wird `generateWeekPlan` abgelöst oder auf reinen Fallback reduziert.

**Gate 0 — Vertrag eingefroren.** Dieser Vertrag (S0b) ist freigegeben; keine offene Produktentscheidung A–D mehr unbeantwortet (dieses Dokument). Voraussetzung für den Start von S1.

**Gate 1 — Shadow-Mindestlaufzeit.** Der Scheduler läuft ausschließlich shadow (kein Schreiben/Anzeigen live) für **mindestens 4 Wochen** UND liefert in dieser Zeit **mindestens 100 auswertbare Shadow-Snapshots** (deterministische Tagesläufe mit vollständig befüllten Kernfeldern `plannedSessions`/`restDays`/`confidence`/`missingFields` — ein Lauf mit `confidence:'not_assessable'` wegen fehlender Kerndaten zählt nicht als auswertbar). Beide Bedingungen müssen gleichzeitig erfüllt sein, bevor Gate 2 geprüft werden darf.

**Gate 2 — Shadow-Vergleichsmetriken** (Legacy `generateWeekPlan`+`buildTrainingDecision` vs. neuer Scheduler, auf denselben Snapshots):
1. **Abdeckungsrate** — Anteil Tage mit vollständig auswertbarem Shadow-Ergebnis (Ziel: keine strukturelle Lücke gegenüber Legacy).
2. **Hard-Constraint-Verletzungsrate** — muss exakt **0** sein; jede beobachtete Verletzung blockiert Gate 2/3 automatisch.
3. **Divergenzrate** — Anteil Tage mit fachlich relevant abweichender Empfehlung ggü. Legacy, inkl. manueller Stichprobenprüfung durch den Produktverantwortlichen.
4. **Missingness-/Confidence-Verteilung** — Anteil `not_assessable`/`missingFields` darf nicht schlechter sein als der Legacy-Pfad bei identischem Input.
5. **Plan-Ist-Erfüllungsvergleich** (I3 Part B) — Vergleich der über `resolvePlanActual` tatsächlich erfüllten Einheiten zwischen den von Legacy und Scheduler vorgeschlagenen Plänen.

**Gate 3 — Soft-Gewichte-Produktfreigabe.** §7-Gewichte sind bis hier ausschließlich shadow-ausgewertet (kein Live-Einfluss); Gate 3 ist die fachliche Review-/Tuning-Freigabe der konkreten Zahlen — danach weiterhin `shadow_only`, bis Gate 4.
**Gate 4 — Pilot-Live-Freigabe.** Separate, ausdrückliche Nutzer-/Produktentscheidung für einen zeitlich/nutzerseitig begrenzten Piloten (Feature-Flag), inkl. jederzeit einsatzbereitem Rollback (s. u.).
**Gate 5 — Volle Live-Aktivierung.** Nur nach bestandenem Piloten; `generateWeekPlan` wird zeitgleich abgeschaltet oder auf reinen Fallback reduziert — nie dauerhaft parallele Schreibquelle.

**Rollback-Vertrag (bindend für Gate 4/5):**
- Solange kein Gate-5-Beschluss vorliegt, schreibt der Scheduler nie destruktiv in `PROFILE.weekPlan`; Ergebnisse werden in einem separaten Snapshot-Speicher gehalten.
- Rollback-Trigger: eine live beobachtete Hard-Constraint-Verletzung, ein Confidence-Absturz unterhalb eines vorab definierten Schwellwerts, oder eine Nutzer-Feedback-Schwelle.
- Rollback ist ein reines Feature-Flag-Zurücksetzen — deterministisch, ohne Migration, ohne Datenverlust, jederzeit möglich.

---

## 15. Offene echte Produktentscheidungen (reduziert — A–D sind entschieden, s. o.)

Produktentscheidungen A–D gelten ab diesem Dokument als **entschieden und eingearbeitet**: A → §14 (Gates/Rollback/kein Dual-SSOT); B → §10a (Knowledge-Metadatenvertrag); C → §4/§6 Nr. 15/17 (keine erfundene Nicht-Lauf-Kapazität, `not_assessable`-Default, Struktur nur wenn ableitbar); D → §5/§7 (versionierte Gewichte, `satisfied`/`violated`/`neutral`, deterministisches Tie-Break, shadow-only bis Gate 3). Weiterhin offen, nicht aus dem Repository ableitbar:

1. **Planungshorizont-Rhythmus nach S1:** S1 selbst ist fest auf 7 lokale Kalendertage (§4/§12); ob spätere Batches rollierend (täglich neu 7 Tage) oder in festen Wochenblöcken planen, und der genaue Neuplanungs-Trigger (sofort/ab nächster Woche/nur speichern), bleibt offen.
2. **Doppeleinheiten-Aktivierung:** Default ist deaktiviert (Hard #16); ob/unter welchen Bedingungen der Scheduler sie je aktiv vorschlägt, ist eine Produktentscheidung.
3. **Umgang mit „verfügbar aber unbelastbar":** wie aggressiv der Scheduler freie Tage füllt (Grundsatz vorhanden, konkrete Belastbarkeits-Obergrenze je Level ist Tuning).
4. **Team-/Saisonphasen-Quelle:** `seasonPhase` je Sport vorhanden, aber ein Saisonkalender (Vorbereitung/Wettkampf/Pause) als Zeitreihe fehlt — Produktentscheidung zur Erhebung.

---

**Harte Stopplinie:** S0b endet hier. Kein Produktivcode, kein Test, keine Migration, kein Commit/Push/Deploy/SW-Bump erstellt. Warten auf ausdrückliche Freigabe für **S1**.
