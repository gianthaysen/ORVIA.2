# ORVIA · ENGINE-CONTRACT-AUDIT (C1)

Status: AUDIT ABGESCHLOSSEN (2026-07-03, High-Capacity-Session). Grundlage: vollständige Lektüre von calc.js, intelligence.js, readiness-source.js, readiness-store.js, checkin-store.js, data.js, workout-store.js, gym-volume.js, issues.js sowie der konsumierenden ui.js-Pfade. Alle file:line-Angaben gegen den Stand v8-176 verifiziert.

---

## 1. Inputs der aktiven Engine (calc.js)

| Input | Quelle | Fallback | Bewertung |
|---|---|---|---|
| sleepMin / sleepQ / feel / legs / doms | Morgen-Check-in (ui.js gatherMorning:644–662) | Formular-Voreinstellungen **420 min / 6 / 7 / 7 / 2** werden als Messwerte persistiert | **ERFUNDEN** — unberührte Slider erzeugen Daten (Hauptbefund E1) |
| rhr, bb, hrvMs, hrv-Status | Check-in | null | ehrlich |
| knee / issues[key] | Check-in + issues.js (:81–165) | prev/null | ehrlich |
| fever, chestPain, shortnessOfBreath, dizziness, neurologicalSymptoms, accidentPain, swelling, instability | **werden an die Engine übergeben (ui.js:523–524), aber NIRGENDS erhoben** | undefined | **Safety-Gate praktisch tot** außer Schmerz>7 |
| hrvBase7/hrvSd28 (ln, SWC 0,5×SD) | ui.js recoveryCtx:170–183 | — | Methode korrekt; `hrvLowStreak` ist IMMER 0 (ui.js:178 testet Garmin-Pfad gegen ms-Branch) → Zwei-Marker-Regel (calc.js:353) tot |
| rhrBase | Median 28 T, ≥7 Werte | ohne Baseline neutral | korrekt |
| sleepDebt | calc.js:489–491 | fixe **480 min** statt Profil-Schlafziel | pauschal statt individuell |
| load3/load7 | lokaler Blob, sessionLoad=dur×RPE (calc.js:47–54) | **RPE-Default 5** | zweite, abweichende Last-Pipeline neben training_load_daily (loadSpikeInfo calc.js:1065) — Trend und Entscheidung können sich widersprechen |
| plannedToday/weekPlan/fixedEvents | ui.js:325–333, 107–122, 382–387 | — | Plan-Generierung liegt in der UI-Schicht |
| Ziele | buildGoal → progress-Subscore | — | Ziele treiben den Plan NICHT (nur Anzeige-Subscore, durch combineScore-Bypass sogar score-inert) |
| Verfügbarkeit (availability.days) | — | — | **wird von adaptWeekPlan NICHT konsumiert** (nur fixedEvents) |

## 2. Outputs

`buildTrainingDecision` (calc.js:896–991) → `{ dayState, score, subscores, statusText, triggers(≤2), readinessReasons, riskFlags, todayAction, recommendedSession, avoidedSession, weekAdjustments, weekPlanAdjusted, recovery, painDoms, load, userMessage, coachSummary, confidence, dataQuality, safety, deficits }`; danach `escalateWithExtras` (nur Verschärfung; Score unverändert). Persistierte Verbraucher: workout-store.js:39–48 schreibt dayState/statusText/todayAction/reasons in workout_sessions; readiness-store speist sich aus privaten Feldern `_r/_m/_ctx` (ui.js:538/677).

## 3. Regelquellen (Kurzinventar; Details im Sessions-Audit)

- **Readiness** calc.js:317–347 — Gewichte 25/20/18/15/14/12/10/10/8 (Heuristik, untestet); Knie-Caps ≤40/≤65 (:341–342).
- **Legacy-Ampel** calc.js:350–376 — ZWEITE Entscheidungslogik, weiter aktiv über ui.js:287/706/1667/2124 + insights.js:23.
- **dayStateEngine** calc.js:585–618 — RED/ORANGE/YELLOW-Schwellen inkl. **erfundener Defaults** sleepH=7/sleepQ=6/feel=7 (:588–589); Lastsprung load3/load7>1,4 (überlappende Fenster).
- **safetyCheck** calc.js:756–781 — fachlich richtig, aber ohne UI-Erhebung wirkungslos (s. o.).
- **applyDecisionCaps** calc.js:839–858 — State-Caps 100/79/64/44; Ausnahme load-only-ORANGE (Test vorhanden).
- **adaptSessionPlan** calc.js:622–652 / **adaptWeekPlan** calc.js:656–694 — Ersatztag nur später in derselben Woche; „harte Tage in Folge“ wird nur PROTOKOLLIERT, nicht mutiert (:686–690); ignoriert trainingDays/availability/gymDays/Ziele.
- **Volumenleiter** weekKmTarget/runnaWeek/racePhases — **hart auf RACE_DATE '2026-09-06' verdrahtet** (calc.js:6), nicht multisportfähig.
- **intelligence.js** riskCard/recoveryDebt/tipEngine — dritte Mini-Engine mit eigenen Schwellen.

## 4. Testabdeckung (verifiziert per grep)

Gepinnt: Extras-Eskalation, load-only-ORANGE, loadSpikeInfo-Gates, trainingLoad-Aggregation, Baseline-Statistik, uncapped persistierte Readiness, calc-Zahlengrenzen. **KEIN Test** für: dayStateEngine-Schwellen, adaptSessionPlan, adaptWeekPlan, safetyCheck, Einzel-Caps, nextRunRec, calculateRecommendedWeeklyRunVolume, Readiness-Gewichte, ampel.

## 5. Hauptprobleme (Ranking)

1. Erfundene Neutralwerte kontaminieren die Historie irreversibel (E1).
2. Ein Input (Schmerz) wirkt vierfach (Gewicht, Readiness-Cap, State, Decision-Cap).
3. Lastmodell dünn und doppelt (Blob vs. Tabelle; acute 3d ⊂ chronic 7d; kein Monotony/Strain).
4. Safety-Schicht dekorativ (Flags ohne Erhebung).
5. Inkonsistente Baseline-Statistik (SD vs. MAD; toter hrvLowStreak); zwei Score-Semantiken (gecappt angezeigt vs. uncapped persistiert).

→ Konsequenzen und Zielarchitektur: ENGINE-V2-DESIGN.md. Die neue Engine v2 (js/engine/) behebt 1–5 als PARALLELE Schicht; Aktivierung erst nach C8-Gate.
