# ORVIA · Goal / Capacity / Periodization — Vertrag (Batch 3)

Status: **Batch 3a + Korrekturbatches 3a.1/3a.2 IMPLEMENTIERT (Shadow-only, keine UI-Umschaltung)** · 3b/3c OFFEN
Stand: 2026-07-19 · Modul: `js/engine/goal-portfolio.js` (`ORVIA.goalPortfolio`, **PORTFOLIO_VERSION 2, RULE_VERSION `gp-v2.0.0`** — nach den 3a.1-Vertragsänderungen erhöht; v1/`gp-v1.0.0` erzeugten anderes Verhalten und werden nie wiederverwendet)
Tests: `supabase/tests/batch3a_goal_portfolio_test.mjs` (68 Fälle inkl. N0–N9)

**Katalogkohärenz (3a.2, kanonische Entscheidung):** `ftp` ist bekannte `sport_performance`-Kategorie (Power-Metrik); `target_bodyfat` ist die kanonische Weight-Kategorie (`goalMetricTypeFor` ⇒ `weight`); `body_fat` ist Legacy und wird ausschließlich über den dokumentierten Alias `GOAL_ID_ALIASES.body_fat → target_bodyfat` normalisiert.

**Reconciliation-Hinweis (3a.2):** Die parallele Garmin-Korrektur vom 19.07. (~08:03 — `autoMaxAgeDays:0` durchgängig für automatische Morgenmetriken, F7/F7b-Gegenproben, SW `orvia-v8-194`) war auf Baseline-Dateiständen aufgebaut und hatte kumulative Batch-0/1/2-Stände von `checkin-fields.js`/`training-input-resolver.js`/`training_input_p8_test.mjs` überschrieben. Per Drei-Wege-Merge wurden die Garmin-Änderungen vollständig erhalten und Red-Flag-Registry, kumulativer Resolver (Safety, Snapshot-Adapter, kanonische Tageslast, `collectRaw`/`collectSnapshot`, Batch-2-Qualitäts-/Tages-/Occurrence-/Dedupe-Regeln) sowie die fail-closed-Testverträge wiederhergestellt.

---

## 0. Batch-Abgrenzung (verbindlich)

| Batch | Inhalt | Ausdrücklich NICHT enthalten |
|---|---|---|
| **3a (dieses Dokument, implementiert)** | Zielportfolio + Allokation: Rollen, Modi, relative Budget-Ranges, Mindestdosen, Konflikte, Mehrjahres-Abhängigkeiten, Transitionen, Horizonte (deklarativ), Missingness/Confidence | Scheduler, Wochenplan, Training Prescription, absolute Volumina, Feasibility-Urteile |
| **3b (offen)** | Sportartspezifische AKTUELLE Capacity (§7 des Engine-Prompts): konservative Bandbreiten je Sport/Belastungsdimension mit Confidence | Zielbewertung, Planerzeugung |
| **3c (offen)** | Feasibility (realistisch/ambitioniert/unwahrscheinlich als SZENARIEN), Phasen, 7-Tage-/4–8-Wochen-/Mehrjahreshorizonte inhaltlich | endgültige Erfolgsaussagen |
| **4 (offen)** | Constraint-Scheduler + Planned Sessions (hier werden Ruhetage/Fenster TERMINIERT) | — |
| **5/6 (offen)** | Konkrete Prescriptions + Sport-Rule-Packs | — |

Keine bestehende UI wird in Batch 3 sichtbar auf die neue Logik umgeschaltet. Integration ausschließlich über Tests und später Shadow-Ausgabe.

---

## 1. Ist-Abgleich Zielquellen (Batch-3a-Pflichtanalyse)

**Kanonische Quelle:** `PROFILE.goals` — normalisiert durch `profile-model.js` (`normalizeGoal`/`normalizeGoals`, SCHEMA_VERSION 2). Felder: `id`, `title`, `category` (kanonischer Namespace = `GOAL_CATEGORIES`, Aliase via `canonGoalCategory`: `halfmarathon→half_marathon`, `fast5k→run_5k`, `fast10k→run_10k`, `cycling_event→cycling_race`), `group` (= `categoryOf(category)`), `priority` **1..4** (1 = höchste; max. 2 aktive Prio-1 via `MAX_TOP_PRIORITY_GOALS`), `timeHorizon`, `targetDate` (`YYYY-MM-DD`), `status` (`active|paused|achieved|abandoned|archived`), `metricType` (`time|distance|pace|weight|power|percent|count`), `currentValue`/`targetValue` (bei `time` **Sekunden**), `unit` (bei `time` `'s'`), `sports`, `categoryData`, `milestones`.

**DB-Spiegel:** `user_goals` (Migrationen 0002/0012/0016). Rollen-Mapping in `repos/goalRepository.js`: `priority 1..4 → primary/secondary/maintain/longterm` (`ROLE_TO_DB`) — **deckungsgleich mit den Batch-3a-Rollen** `main/secondary/maintain/longterm`. Cross-Device-Dedupe über `client_goal_id` + `goalSemanticKey` (0016).

**Legacy-Felder (nur noch Spiegel, NICHT Quelle):** `DB._hmTargetMin`, `PROFILE.hmTargetMin`, `RACE.date`; `ui.js goalOf()/goalTargetMin()` liest Ziel-SSOT zuerst (`_canonicalId`), Legacy nur als Fallback (Ziel-SSOT-Fix, siehe Obsidian `ORVIA-Ziel-SSOT-Fix`).

**Einheiten:** Zielzeiten Sekunden (`unit:'s'`); Legacy `hmTargetMin` Minuten (nur Spiegel); Distanzen im Aktivitätsmodell km (`summary.distanceKm`) bzw. m; Datum lokale `YYYY-MM-DD`.

**Dokumentierte Lücken/Konflikte (Ist):**
1. `half_ironman`, `sprint_triathlon`, `olympic_triathlon`, `rowing2k` stehen in `TIME_GOAL_CATEGORIES`, aber **nicht** in `GOAL_CATEGORIES.endurance` ⇒ `categoryOf()` liefert für sie `general`. GELÖST in 3a.1 über die kanonische Katalogquelle `profileModel.isKnownGoalCategory(cat)` (= GOAL_CATEGORIES aller Gruppen + TIME_GOAL_CATEGORIES nach Alias-Normalisierung, EINE Wahrheit); die kind-Einordnung als Ausdauer-Wettkampf läuft weiterhin über den dokumentierten Adapter `ENDURANCE_RACE_CATEGORIES` im goal-portfolio.
2. Es gibt kein persistiertes Rollenfeld getrennt von `priority`; Rolle wird deterministisch aus `priority` abgeleitet (eine Wahrheit, kein zweiter Namespace). **3a.1:** `role` ist IMMER die unveränderte Ableitung aus der Nutzerpriorität — der Fokus schreibt Rollen nie um; nur ganzzahlige Prioritäten 1–4 sind gültig, alles andere ⇒ `needs_review` (keine stille 5→longterm-Abbildung).
3. **Ironman-Ziel 2028: die aktuelle ausdrückliche Vorgabe des Nutzers lautet Sub-10** (metricType `time`, targetValue 36000 s) — das ist die Referenzanforderung. Die ältere Obsidian-Formulierung „Ironman Hamburg 2028 finishen" (Stand 2026-07-12) ist ein **veralteter Quellenkonflikt (stale/source-conflict)**, KEINE offene Nutzerentscheidung. Laufzeitquelle in der App bleibt selbstverständlich das kanonisch gespeicherte Profil; Chat-/Doku-Daten werden nicht in Produktcode eingebaut.
4. Kein FTP-/Kraftwerte-Bestand (Obsidian `Training-Offene-Punkte`) ⇒ 3b muss ohne erfundene Watt-/Kraftpräzision auskommen.
5. `EngineInputSnapshot` v1 trägt `goals`/`sports` als Kopien und `goalContext.daysToEvent`; `capacity/planHistory/outcomeHistory` sind `not_supported` — 3a konsumiert ausschließlich diesen Snapshot (+ injizierte Evidenz, die beim Eingang tief kopiert wird).

---

## 2. Portfolio-Vertrag (implementiert, `buildPortfolio(snapshot, opts)`)

```js
{
  version: 1, ruleVersion: 'gp-v1.0.0',
  asOf,                    // NUR aus snapshot.now (injizierte Uhr), sonst null + missing
  focusGoalId,             // aktives Prio-1-Ziel; nie aus Dringlichkeit erfunden
  allocations: [{
    goalId, kind,          // finish|time|performance|weight|technique|health|general|unknown
    role,                  // main|secondary|maintain|longterm — IMMER unveränderte Ableitung aus priority 1..4;
                           // ungültige Priorität (fehlend/String/NaN/0/negativ/>4/nicht ganzzahlig) ⇒ role null + needs_review
    mode,                  // focus|develop|maintain|foundation|staggered|paused|needs_review — NUR der Fokusstand,
                           // fälscht nie die Rolle (zweites Prio-1-Ziel: role 'main' + mode 'staggered')
    weeklyBudgetRange,     // {min,max, unit:'share_of_available_training_budget', basis} | null
    budgetPolicy,          // 'role_default' | 'reduced_while_staggered' | 'paused' | null — erklärt Budgetabweichungen
    minimumDose,           // [{capability, type, min, purpose, status}] | null (Frequenz-Floors, kein Volumen)
    target,                // {metricType, value, unit, date, interpretation:'aspiration'} | null
    evidenceRefs,          // [{ref: groupId, kind:'longest_grouped_session'}] — GENAU einmal, am Fokusziel
    daysToTarget, rationaleCodes, dependencies, confidence
  }],
  conflicts,               // urgency_vs_priority | dual_top_priority | competing_races | physiologisch (injiziert)
                           // competing_races hängt NUR an zwei gültigen Zielkalenderdaten — wird auch ohne
                           // Fokusziel und ohne Uhr erkannt; Fokus-/Dringlichkeitskonflikte verlangen die Uhr
  dependencies,            // Portfolio-Ebene, dedupliziert, mit setup_required-Status
  minimumDoses,            // AGGREGIERT je Capability: {capability, type, min (MAXIMALWERT, nie Summe), purpose,
                           //  status, neededForGoalIds, shareableAcrossGoals:true} — SCHEDULER-VERTRAG: eine
                           //  passende Einheit bedient mehrere Ziele; niemals je Ziel addieren
  transitionPlan,          // [{fromGoalId, toGoalId, trigger, recoveryThenBuildWeeksRange, scheduling:'deferred_to_batch_4'}]
  horizons,                // next7Days / weeks4to8 / multiYear — DEKLARATIV, prescriptionLevel verweist auf 3c/4
  evidence,                // injiziert (evidenceFromActivities), beim Eingang TIEF KOPIERT (keine Referenzteilung)
  capacity: null,          // IMMER null in 3a — kommt aus Batch 3b
  safetyPolicy: 'tighten_only',
  missingData,             // dedupliziert (Pfad+Art)
  assumptions, confidence  // high|medium|low, deterministisch an ZIELRELEVANTE Missingness gekoppelt:
                           // fehlende Prioritätsordnung +2, stale/conflict-Inputs +1, needs_review-Ziele +1,
                           // fehlende benötigte Sportarten (1–2 Capabilities +1, ≥3 +2); rein additiv (monoton);
                           // irrelevante fehlende Readiness-Felder zählen nicht
}
```

**Kalenderdaten (strikt):** nur exakt `YYYY-MM-DD` mit Parse-/ISO-Roundtrip auf denselben Tag — `2027-02-29`, `2027-02-30`, `2026-04-31`, Monat 13 und angehängter Text sind ungültig (⇒ `needs_review`, kein Fokus, kein Budget); gültige Schaltjahresdaten (z. B. `2028-02-29`) sind zulässig.

**Regel-Immutabilität:** `BUDGET_BY_ROLE`, `DEPENDENCY_MODEL`, `HEURISTICS` und der gesamte Export sind tief eingefroren; Mutation exportierter Regelobjekte verändert weder Regeln noch zukünftige Ergebnisse (byte-stabil bei gleichem Snapshot + Rule-Version).

**Kategorien (fail-closed):** Bekanntheit wird über die kanonische Quelle `profileModel.isKnownGoalCategory` geprüft (injizierbar via `opts.isKnownCategory`); `custom` ist bekannt; eine unbekannte Kategorie bleibt `unknown/needs_review`, auch wenn der Normalizer `group:'general'` gesetzt hat. Ohne Katalogquelle arbeitet die Factory fail-closed (nur Kategorien mit eigener Fachbehandlung) und meldet `goalCategoryCatalog:module_missing`.

**Reinheitsgarantien (getestet):** kein DOM/localStorage/globales PROFILE/`Date.now()`; nicht mutierend (Object.freeze-fest); deterministisch/idempotent (byte-stabil); Zeit nur über injizierte Uhr.

**Evidenz-Adapter:** `evidenceFromActivities(activities, { groupSessions, sportId })` — Batch-2-Gruppierung wird INJIZIERT (`activityConfig.groupActivitySessions`, eine Quelle); Split-Aufzeichnungen zählen als EINE Session; Referenzierung im Portfolio genau einmal (Golden-Test K1/K6, 12,41 km / 3 Segmente).

**Mehrjahres-Abhängigkeiten (Datenvertrag `DEPENDENCY_MODEL` v1):** Kette `half_marathon → half_ironman → ironman`; Capabilities `run_durability`, `swim_technique` (Wasserkompetenz), `bike_base`, `strength_stability`, `fueling_gut_training`, `brick_experience`, `race_experience`; Mindestdosen als Frequenz-Floors (Schwimmtechnik/Radbasis/Kraft ≥1×/Woche für secondary/longterm-Triathlonziele; Fueling/Bricks/Rennen periodisch ohne erfundene Zahlen); Übergänge deklarieren 1–3 Wochen Recovery-then-Build (Terminierung Batch 4). Fehlende Sportart ⇒ `setup_required` + missingData, nie stillschweigend.

## 3. Heuristiken (versioniert, `HEURISTICS`)

`H_ROLE_FROM_PRIORITY` (Rolle = Nutzerpriorität, deckungsgleich 0012), `H_FOCUS_USER_PRIORITY` (Dringlichkeit ersetzt Fokus nie still), `H_FOCUS_TIEBREAK` (dual-top: früheres Datum, dann id — immer mit explizitem Konflikt), `H_BUDGET_SHARES` (main 0.60–0.75, secondary 0.10–0.20, maintain 0.05–0.10, longterm 0.00–0.05 — Anteile statt erfundener Stunden), `H_BUDGET_NORMALIZE` (Summe der Obergrenzen ≤ 1, proportional, 4 Nachkommastellen), `H_MIN_DOSE_TRIATHLON`, `H_MIN_DOSE_HEALTH` (Frequenz vor Volumen), `H_COMPETING_RACES` (<42 Tage ⇒ Staffelung), `H_TRANSITION_RECOVERY`, `H_CONFIDENCE_LADDER`. Begründungstexte stehen versioniert im Modul.

## 4. Offene Datenlücken für 3b/3c

Keine Capacity-Basis (FTP, Kraftwerte, Schwimmniveau unbekannt); Long-Run-Verträglichkeit/24-48h-Reaktion noch nicht als Zeitreihe; Ironman-Ziel 2028 = Sub-10 (aktuelle ausdrückliche Vorgabe; die Obsidian-„finishen"-Formulierung ist als stale/source-conflict dokumentiert, siehe §1.3); `EngineInputSnapshot.activities` weiterhin null (Evidenz wird injiziert, bis der Snapshot kanonische Aktivitäten trägt). Die frühere Katalog-Lücke `half_ironman` ist über `profileModel.isKnownGoalCategory` geschlossen (§1.1).

## 5. Migration / Deploy / Service Worker

Batch 3a: **keine Migration, kein Deploy, kein SW-Bump** (Modul ist nicht in `index.html`/`sw.js` eingetragen; rein testgetragen). Release-Reihenfolge der Batch-2-Migrationen (0025/0026 vor Client-Bundle) bleibt unverändert gültig; 0026 ist ab jetzt unveränderlich, Korrekturen nur als 0027+.
