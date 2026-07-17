# ORVIA · HIGH-CAPACITY-SESSION-HANDOFF (2026-07-03)

Vollständiger Übergabebericht der High-Capacity-Session (Tracks A/B/C). Kein Push, kein Deployment erfolgt.

---

## A. Ausgangsstand

v8-176 live deployt und abgenommen; M1a–M5a + Issue-#6-Fix fertig; 74 Offline-Suiten grün (Baseline zu Sessionbeginn selbst verifiziert), 5 Live-Suiten credentials-pflichtig. Onboarding endete nach A1 in drei Placeholdern; Profil-UI = 14 Editoren auf zwei Overlay-Systemen; Engine = calc.js-Monolith mit dokumentierten Schwächen.

## B. Vorgenommene Änderungen (chronologisch)

1. **4 Read-only-Audits** (Architektur, Engine+Sportwissenschaft, Onboarding-Verträge, Entry-Point-Inventar) — zentrale Befunde selbst im Code verifiziert.
2. **A0 (ungeplant, KRITISCH):** _profileSave-Persistenzbug — `save()` (DB) statt `saveProfile()` an 4 Stellen; Editor-/Onboarding-Saves erreichten `orvia_profile_v1` nicht zuverlässig; Cloud-Snapshot stale. Test-first gefixt.
3. **M5b:** Sportauswahl als Essential-ChoiceCard-Grid (24 Karten, SVG-Icons, 5 neue Symbole) + Hauptsport-Wahl; NEUER Schritt Trainingsstand (Level-Karten + Frequenzband → sports[primary].level/sessionsPerWeek, Bänder 1-2→2/3-4→4/5-6→6/7+→7 dokumentiert); Ebene-B-UI (Modus/Sichtbarkeit/Priorität) aus dem Essential entfernt, Daten verlustfrei; fail-closed-Rückführung für Alt-Drafts (neuer Pflichtschritt).
4. **M6:** Draft v4 (goals_placeholder→goals, schedule→availability, review_placeholder→review; Aliasse dauerhaft); Essential-Zielschritt: 16 kuratierte GOAL_CATEGORIES-Karten in 4 Gruppen, EIN Ziel, Auto-Titel aus Label (editierbar), optionales Datum, Bestandsziele unangetastet; validateEssentialGoals (profile-model); advanceGoals fail-closed.
5. **M7 (+M5c):** Verfügbarkeit kompakt (7 Tages-Kreise + Dauerband → typicalDuration + maxMinutes; **Fix: leere Woche statt normalizeDay-Default „alle verfügbar“**); Sicherheits-Check (Ja/Nein Pflicht, Region/Intensität(Stepper 1–10)/Seite, med. Abgrenzung; Completion setzt constraintsAcknowledgedAt + kanonischen Constraint, issues nur Projektion); Körper-Schritt aktiv (optional, skippbar, „Später ergänzen“); **D7: PROFILE_DEFAULTS 70 kg/175 cm → null** (Konsumenten null-sicher verifiziert); Progress = 8 Arbeitsschritte.
6. **M8:** Review mit ReviewCards je Bereich (echte Werte, Rücksprung in jeden Schritt inkl. body), EHRLICHE Vollständigkeit über buildCompletionPatch+computeProfileCompleteness; Erfolgsscreen (✓-Hero, CTA „Ersten Check-in machen“ → Heute-Tab+Scroll, „Zur App“); **Fix: ageEstimate-Mapping** (Nur-Alter-Nutzer verloren ihr Alter beim Abschluss); Legacy-„vormerken“ aus aktivem Flow entfernt.
7. **M9:** js/coachmarks.js — einmaliges Check-in-Spotlight (Flag `orvia_coachmarks_v1:<uid>`, gesetzt vom Erfolgsscreen; dismissbar; nicht bei erledigtem Check-in; reset() für „erneut zeigen“).
8. **M10:** js/profile-center.js — Profilzentrale (Header mit Ring, max. 2 Smart Prompts, 4 Gruppen, Status-Chips, planImpact-Badges, ehrliche Konto-Karte); nur lesend, Delegation über openProfileSection; primärer Einstieg „Profil öffnen“ (fail-soft alter Manager).
9. **Track B:** js/quick-actions.js + #navPlus (Registry/Ranking/Sheet, nur Delegation); ui.js-Tabbar-Bindung auf [data-tab] (Root-Cause-Fix); Design-Doc.
10. **Track C:** docs/ENGINE-CONTRACT-AUDIT.md (C1); js/engine/{engine-contracts, readiness-engine-v2, decision-engine-v2, plan-engine-v2}.js PARALLEL (C2–C7), docs/ENGINE-V2-DESIGN.md inkl. Aktivierungsgate (C8) — NICHT aktiv, nicht in index.html/sw.js.
11. sw.js → **v8-177** (einmaliger Bump, Bündel komplett).

## C. Dateien pro Paket

| Paket | Dateien |
|---|---|
| A0 | js/profile.js · tests/profile_save_wiring_a0_test.mjs |
| M5b | onboarding-sports-logic.js, onboarding-logic.js, onboarding-ui.js, profile-ui-kit.js, index.html (Icons), styles.css · tests/onboarding_m5b_training_test.mjs (+5 Suiten aktualisiert) |
| M6 | onboarding-logic.js (v4), profile-model.js, onboarding-ui.js, onboarding-steps.js, styles.css · tests/onboarding_m6_goals_test.mjs |
| M7/M5c | onboarding-sports-logic.js, profile-model.js, onboarding-logic.js, onboarding-ui.js, profile.js (D7), styles.css · tests/onboarding_m7_availability_safety_test.mjs |
| M8 | onboarding-ui.js, styles.css · tests/onboarding_m8_review_test.mjs |
| M9 | js/coachmarks.js (NEU), index.html, sw.js, styles.css · tests/coachmarks_m9_test.mjs |
| M10 | js/profile-center.js (NEU), js/profile.js, index.html, sw.js, styles.css · tests/profile_center_m10_test.mjs |
| B | js/quick-actions.js (NEU), js/ui.js, index.html, sw.js, styles.css · tests/quick_actions_b_test.mjs · docs/PLUS-QUICK-ACTIONS-DESIGN.md |
| C | js/engine/*.js (4 NEU, inaktiv) · tests/engine_v2_test.mjs · docs/ENGINE-CONTRACT-AUDIT.md, ENGINE-V2-DESIGN.md |

## D. Testresultate pro Paket

A0 12/12 · M5b 73/73 · M6 38/38 · M7 59/59 · M8 16/16 · M9 13/13 · M10 33/33 · B 21/21 · C 130/130. Aktualisierte Bestandssuiten (Produktänderung dokumentiert): onboarding_state_v3 63/63, onboarding_logic 86/86, onboarding_dom 132/132, onboarding_steps_4i1 20/20, onboarding_m5a 43/43.

## E. Vollständige Testbaseline (Sessionende)

**88 Suiten: 83 offline GRÜN, 0 rot.** Skipped: 5 Live-Suiten (rls, training_rls, live_workout_rls, live_workout_rpc_smoke, muscle_volume_sql — Credentials erforderlich). Nicht ausgeführt: manuelle iPhone-Checklisten (DEPLOY_CHECKLISTE v8-177). Syntax-Checks + Secrets-Scan grün.

## F. Visuelle Änderungen

Neuer First-Run A2–A8 (ChoiceCard-Grids mit Sport-Icons, Level-Karten, Tages-Kreise, Stepper, ReviewCards, Vollständigkeits-Banner, Erfolgs-Hero); Profilzentrale (Ring, Chips, Prompts, Gruppen); Plus-Button (Gold, erhaben) + Quick-Action-Sheet; Check-in-Spotlight. Alles auf bestehenden Tokens (Gold/Dark), ≥44 px, reduced-motion, 320-px-Breakpoints.

## G. Engine Alt/Neu

Alt bleibt AKTIV und unverändert produktiv. Neu (js/engine/) parallel: getrennte Schichten, Reason-Codes, ehrliche missingData/Confidence, keine erfundenen Defaults. Vergleich (engine_v2_test V1–V3): gute Nacht → beide ≥75; leerer Check-in → alt liefert Zahl, neu ehrlich null (BEABSICHTIGTE Differenz); Schmerz 8 → beide RED. Aktivierungsgate offen: UI-Darstellung, Feature-Flag, Shadow-Mode ≥14 Tage, Ablösung der 6 Duplikat-Leser (ENGINE-V2-DESIGN §5).

## H. Offene Risiken

1. **Rollback-Nuance Draft v4:** unter v8-176 würde ein offener v4-Draft als korrupt archiviert (Backup-Key; PROFILE unberührt) — nur relevant, wenn zwischen Deploy und Rollback jemand im Setup steckt.
2. Alt-Draft-Rückführung (KNOWN_ISSUES #20): gewollt, aber live an Punkt 5 der Abnahme prüfen.
3. Persistenz-Asymmetrie (KNOWN_ISSUES #1) besteht weiter: sports/goals/availability/constraints bleiben blob-autoritativ (ADR D5) — der A0-Fix macht den Blob jetzt aber zuverlässig; Cloud-Vollzyklen sind M11-C.
4. D7-Rest (#19): level/primaryGoal-Alt-Defaults.
5. Profilzentrale zeigt Freshness erst sinnvoll, wenn _sectionMeta gefüllt ist (Backfill beim ersten Save je Bereich; bis dahin „unbekannt“→ok-Chip-Logik greift über Completeness).
6. Live-RLS/Zwei-Konten-Suiten weiter nur mit Credentials.

## I. Nicht abgeschlossene Arbeit

M11 (Editor-Migration einzeln) · M11-C (Cloud-Vollzyklen) · M12 (Legacy-Abbau) · Zukunfts-Nav (Start|Training|+|Fortschritt|Profil) · Engine-v2-Aktivierung (C8) · Monotony/Strain auf Tabellen-Lastserie · D8-Recovery-Flow · Telemetrie-Entscheidung (N3).

## J. Exakte nächste Schritte

1. Bündel v8-177 deployen (DEPLOY_CHECKLISTE, atomar, sw.js zuletzt) + Live-Abnahme 1–7; A0-Regression (Punkt 2) ist der wichtigste Einzelcheck.
2. Danach M11-① (Gewicht/Body-Quick über die Zentrale) als erstes Editor-Paket.
3. Engine v2: Shadow-Mode-Paket (Flag + Logging Alt/Neu je Check-in) vor jeder UI-Umstellung.
4. Live-Suiten mit Credentials einmal fahren (rls + app_state-Zweikonten).

## K. Vorgeschlagenes Deployment-Bündel

Siehe DEPLOY_CHECKLISTE „v8-177“ (14 Dateien + sw.js zuletzt; js/engine/ ausdrücklich NICHT).

## L. Rollback-Plan

Alle Bündel-Dateien auf v8-176-Stand zurück + sw.js 'orvia-v8-176' in EINEM Deploy; Verhalten für Bestandsnutzer identisch zu vorher (keine Migrationen an Nutzerdaten außer additiven Draft-Feldern; PROFILE-Änderungen der Session sind additiv/null-Defaults und von v8-176-Code tolerant lesbar). Offene v4-Drafts: siehe H1.
