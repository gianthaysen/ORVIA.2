# ORVIA · Profil-, Onboarding- & First-Run-Redesign — Plan (P3)

Status: FREIGEGEBEN mit Revision 1 (Gian, 2026-07-02) — Implementierung paketweise nach Einzelfreigabe. Revision 1 eingearbeitet: Welcome kombiniert, max. 8 Arbeitsschritte, Körperdaten/Geschlecht optional, keine Empfehlungs-Zusage vor Check-in, Orientierung+Coachmarks statt 5-Schritt-Tour, Cloud-Write nur mit Vollzyklus (ADR D5), M-Pakete einzeln. Verbindliche Begleitdokumente: PROFILE-FIELD-MATRIX.md · PROFILE-DATA-CONTRACT-ADR-DRAFT.md.
Kein Code geändert. Basis: 4 Read-only-Audits (Datenmodell, Onboarding-Flow, Editor-UX/Design-Tokens, Architektur) mit file:line-Belegen + Lead-Synthese (Design, Conversion, Sportwissenschaft, Adversarial).
Hinweis Evidenz: UI-Aussagen stammen aus Code/CSS-Analyse; die von Gian erwähnten Profil-Screenshots lagen dieser Session nicht vor — seine Beschreibung (Chip-Wüsten, Dichte, Formularcharakter) wurde im Code verifiziert (s. B).

---

## A. Executive Summary

**Größte Probleme (verifiziert):**
1. Onboarding v2 endet in drei Placeholder-Schritten und wirft den Nutzer danach kommentarlos in die App — kein Welcome-Erlebnis, kein Tutorial, Async-Race beim Abschluss (onboarding-ui.js:253–265, kein await/Fehlerbehandlung).
2. Die Profilverwaltung ist eine Sammlung von 14 Editoren auf zwei Overlay-Systemen; das Fußball-Sportprofil kostet ~35 Taps mit drei Chip-Listen >8 Optionen; Zielart hat 20+ Chips (Audit C).
3. Fachliche Tiefe existiert (profile-model.js: ~95 aktive Felder, saubere Schemas), aber ~14 Ballast-Felder, 6 Schema-ohne-Editor-Lücken und Tri-Duplikate (level ×3) erzeugen Rauschen (Audit A §12/13/15).
4. Kein Vollständigkeits-/Aktualitäts-Modell: Section-updatedAt existiert teils, wird aber nirgends angezeigt; keine source-Kennzeichnung außer performance.* (Audit A §14).
5. Alles außer 13 Identitätsfeldern ist Single-Device (blob-only) — neue UX auf dieser Basis zementiert das Multi-Device-Problem (Audit H §4).

**Zielbild:** Ein First-Run in drei Ebenen (Essential ≤ 4 Min, max. 8 Arbeitsschritte → Personalisierung optional → Advanced on demand), eine kurze Orientierung plus kontextuelle Coachmarks statt Tour, und eine Profilzentrale mit konkretem Vollständigkeits-/Aktualitätsstatus und Smart Prompts — alles auf EINEM Komponentensystem, EINEM Schreibpfad (`_profileSave`) und den EXISTIERENDEN Validatoren/State-Machines.

**Kernprinzipien:** Progressive Disclosure statt Kürzung der Tiefe · jede Frage mit sichtbarem Zweck · keine erfundenen Defaults (Essential ersetzt den 70 kg/175 cm-Fallback durch echte Eingaben) · ChoiceCards statt Chip-Wüsten · ein Overlay-Standard · Wiederverwendung vor Neubau · inkrementelle Migration ohne parallele Wahrheitsquellen.

**Gesamtstrategie:** Kein Big-Bang. Die solide Basis (State machine, Store, Validatoren, openSheet, Event-System, Design-Tokens) bleibt; ersetzt werden Informationsarchitektur, Schrittinhalte, Komponenten und die Completion-Logik. 12 kleine Pakete (K).

---

## B. Verifizierter Ist-Zustand (Kurzreferenz, Belege in den Audits)

- **Datenmodell:** profile-model.js als kanonisches Modell mit 9 Sections (PROFILE_SECTIONS, profile-model.js:365–375, planImpact-Flag vorhanden!), goals-v2 mit Legacy-Projektion (applyLegacyProjection, profile.js:156–160), Sport-Profile-Schemas inkl. performancePriorities/fields (Editor fehlt), Verfügbarkeits-Slot-Modell inkl. Doppeleinheiten, performance.* mit source+measuredAt (einziger Bereich mit echten Metadaten).
- **Onboarding:** 6 Schritte, 3 davon Placeholder; Draft user-scoped `orvia_onboarding_v2:<userId>` mit Corruption-Backup (solide); Resume/Later funktioniert; Completion ohne await/Fehlerpfad (Race, ui.js:264); danach KEIN Tutorial; Einstieg via 400ms-setTimeout (auth.js:239).
- **Profilverwaltung:** 7 Sheet- + 7 Modal-Editoren; Interaktionskosten: Gewicht 6 Taps (ok), Fußballprofil ~35 Taps (nicht ok), Ziel 15–25 Taps über 7-Schritt-Wizard; Chips ~35px Touch-Target (<44px), aria-pressed fehlt, ein color-only-State (Goal-Progress).
- **Design-Tokens (vorhandene Marke!):** Gold #C9AE7C/#DCC79A/#8E7647, dunkle Karten (#121a26→#0c131d-Gradients), Radius 22 (Cards)/30 (Chips)/12–18 (Inputs), Schatten 0 14px 34px rgba(0,0,0,.45), Fokusring rgba(201,174,124,.18), 16px Basis, tabular-nums für KPIs.
- **Architektur:** `_profileSave()` = einziger legitimer Schreibpfad + `orvia:profile-updated`-Event (profile.js:162–179); Validatoren modular und doppelt nutzbar; onboarding-logic zu ~70 % bereit (fehlt: STEP_CONFIG/tier/skippedSteps); Cloud-Lücke sports/availability (Repos existieren, unverdrahtet).

---

## C. Profil-Feldmatrix

**Verbindlich ausgelagert nach `docs/PROFILE-FIELD-MATRIX.md`** (M1a, 2026-07-02) — dort: alle Felder mit Ebene (E/E?/B/C/nie/Ballast), Konsumenten mit Evidenzgrad, Persistenz, Validatoren, Duplikaten und der finalen Essential-Minimalmenge (§11). Die folgende Tabelle ist nur noch historischer Planungskontext; bei Abweichung gilt die Matrix:

**Ebenen-Zuordnung (Pflicht = Essential):**
| Ebene | Felder |
|---|---|
| **A Essential** | name, birthDate (oder ageEstimate), sex (optional, „keine Angabe"), heightCm, weightKg, sports[] (min. 1 + primary), sports[primary].level + sessionsPerWeek, goals[0] (category + optional title/targetDate), availability kompakt (Tage-Set + typische Dauer → days[].available + singleSession.maxMinutes + maxSessionsPerWeek), Sicherheitscheck (constraintsList minimal: bodyRegion + intensity, nur wenn vorhanden) |
| **B Personalisierung** | sportProfile je Sport (role/position/fields/performancePriorities), weitere goals + priority, availability im Detail (Slots, Doppeleinheiten, preferredRestDays, fixedCommitments), performance.maxHr/restingHr (gemessen!), sleepGoalH + recovery.* (sleep/stress/workPattern/nutritionState), preferences.* |
| **C Advanced** | devices.equipment/trainingLocations, Integrationen (ehrlich als „in Vorbereitung"), performance.ftp/thresholdPace/personalBests/strengthRecords, seasonPhase, gear (km-Tracking), checkinMode/riskTolerance/adaptationMode |
| **Nie abfragen (berechnet/projiziert)** | age, hfMax/rhrBaseline (Spiegel), primaryGoal/raceDate/hmTargetMin/issues[] (Projektionen) |
| **Ballast (nicht in neue UX übernehmen, Felder unangetastet lassen)** | raceName, goal(v1), nutrition, cycle, pauses, customExercises, hideAnkle, trainingDays, gymDays, recoveryFocus, nutritionFocus, coachingIntensity, fixedEvents(top-level) |

**Sportwissenschaftliche Begründung (F):** Essential enthält exakt die Felder, die Readiness/Load/Zonen HEUTE konsumieren (weightKg→Load, birthDate→Tanaka-Fallback, level+sessionsPerWeek→Ausgangsvolumen, constraints→Safety-Gates) plus die Plan-Minimalbasis (Sport, Ziel, Tage). hfMax/rhr sind NICHT Essential: ohne Messung ist Tanaka der ehrlichere Wert als eine geratene Eingabe — dafür Personalisierungs-Prompt „nur eintragen, wenn gemessen".

---

## D. Neuer First-Run Flow (Revision 1: 1 Welcome + 8 Arbeitsschritte, Ziel ≤ 4 Min)

Gemeinsames Gerüst: ProgressHeader („Schritt x von 8" ab A1), primärer Button unten fix (Safe-Area), sekundär „Später fortsetzen" (persistiert Draft, bestehende Later-Logik), Autosave je Eingabe (bestehendes persist()). **Arbeitsschritt** = Screen mit Eingabe/Entscheidung; Welcome zählt nicht.

| # | Screen | Inhalt / Komponente | Pflicht | Validierung | Dauer |
|---|---|---|---|---|---|
| A0 | **Welcome (kombiniert)** | Logo, „Know your state." + 3 Nutzen-Bullets (Plan · Tagesform · Ziele) + kompakte Vertrauenszeile („Deine Daten gehören dir — jederzeit änderbar, jederzeit löschbar", Link Datenschutz) + „Dauert ~4 Minuten" | — | — | 15 s |
| A1 | **Über dich** | Name (Text), Geburtsdatum (Date-Picker, alternativ „nur Alter angeben"); Geschlecht als 4 ChoiceCards inkl. „Keine Angabe" — **optional, vorausgewählt „Keine Angabe"**, InlineHelp | Name, Geb./Alter | validateProfile (13–100 J.) | 35 s |
| A2 | **Deine Sportarten** | Sport-Katalog als ChoiceCard-Grid (Icon+Label, 2-spaltig), Mehrfachwahl; darunter „Dein Hauptsport?" (Single aus Auswahl) | ≥1 + Primary | validateSportsSelection | 30 s |
| A3 | **Dein Trainingsstand** | „Wie trainierst du aktuell?" (4 ChoiceCards mit Subtext) + „Wie oft pro Woche?" (Segmented 1–2/3–4/5–6/7+) → sports[primary].level/sessionsPerWeek | ja | enum/Zahl | 20 s |
| A4 | **Dein Ziel** | Zielkategorie als ChoiceCards (gruppiert: Ausdauer/Kraft/Gesundheit/Event); Titel + Datum als Expandable „Details" (optional) | Kategorie | validateGoal | 25 s |
| A5 | **Verfügbarkeit kompakt** | 7 Tages-Kreise (Mo–So, Multi-Toggle) + „typische Dauer" (Segmented 30/45/60/90+) + InlineHelp | ≥1 Tag | — | 20 s |
| A6 | **Kurzer Sicherheits-Check** | „Hast du aktuell Beschwerden?" Ja/Nein-Cards; bei Ja: Region (BODY_REGIONS-Liste) + Intensität (Segmented) + med. Abgrenzungszeile | Frage ja | — | 15–45 s |
| A7 | **Körperdaten (optional)** | Größe + Gewicht als 2 große Inputs, InlineHelp „Warum"; prominenter Sekundär-Button **„Später ergänzen"** (Skip ohne Schuldgefühl; Smart Prompt fasst nach) | **optional** | 100–250 / 30–300 | 0–25 s |
| A8 | **Zusammenfassung** | ReviewCards je Bereich (Tap = zurück zum Schritt), „Profil erstellen" → Erfolgs-Screen | — | Review-Prädikat | 20 s |

**Erfolgs-Screen (ehrlich, keine ungedeckte Zusage):** „Dein Profil steht." + primärer CTA **„Ersten Check-in machen"** (erst NACH dem Check-in entsteht die erste Tagesempfehlung — so wird es auch gesagt: „Nach deinem ersten Check-in bekommst du deine erste Empfehlung."). Sekundär: „Profil verfeinern (5 Min)" (Ebene B) · „Zur App".

**Completion (ersetzt Race):** await auf updateSection/profileStore.persist, Fehlerpfad mit Retry-Hinweis, erst dann Draft completed + closeShell (Fix onboarding-ui.js:253–265). Ebene B = dieselben Step-Container als einzeln abschließbare Module (jedes speichert sofort).

**Conversion-Sicherungen (E):** Time-to-Value über Check-in-CTA statt falscher Sofort-Empfehlung · kein Screen >6 Eingabeelemente · sensible Fragen (Geschlecht, Beschwerden, Körper) optional bzw. mit Begründung · Fortschritt ehrlich (8 Schritte) · „Später fortsetzen" überall · keine Geräte-/Marketing-Fragen im Essential.

---

## E. Neue Profilzentrale (ersetzt Modal-Sammlung; Vollbild-Ansicht via Avatar)

1. **Header:** Avatar, Name, Hauptsport-Badge, Top-Ziel mit Datum, Vollständigkeits-Ring (aus computeCompleteness), „zuletzt aktualisiert" (max über _sectionMeta).
2. **Smart Prompts (max 2, priorisiert):** Regeln datengetrieben, z. B. fehlendes goals[0].targetDate → „Dein Hauptziel hat noch kein Datum" · _sectionMeta.availability.updatedAt > 8 Wochen → „Verfügbarkeit prüfen" · performance.maxHr fehlt UND Ausdauer-Hauptsport → „Für präzisere Zonen: gemessene HFmax eintragen" · Integrationen: NUR anzeigen, wenn Feature live (keine erfundenen Funktionen).
3. **Bereichs-Gruppen (priorisiert, je Card: Titel, 1-Zeilen-Summary, Status-Chip vollständig/fehlt/veraltet, planImpact-Badge „beeinflusst Plan"):**
   - Training: Sportarten & Sportprofile · Ziele · Verfügbarkeit
   - Gesundheit & Regeneration: Beschwerden · Regeneration & Alltag
   - Leistung & Daten: Leistungswerte · Geräte & Datenquellen
   - Einstellungen: Persönliche Daten · Präferenzen · Datenschutz & Account (Export/Löschung als ehrliche „in Vorbereitung"-Einträge, verlinkt auf bestehende Funktionen sobald da)
4. **Profile Health:** kein nackter Prozentwert; pro Bereich konkret: „vollständig ✓ / 2 Angaben fehlen / seit 9 Wochen unverändert / automatisch importiert (Garmin) / manuell". Datenbasis: _sectionMeta {updatedAt, source} + computeCompleteness (Architektur J).

---

## F. Neue Editor-Konzepte (je Hauptbereich)

**Standard:** Ein Overlay-System — FullScreenEditor (= bestehendes openSheet size:full) für Bereiche, BottomSheet für Quick-Edits (Gewicht: 2 Taps vom Header-Prompt). Modals nur noch für Bestätigen/Löschen. Jeder Editor: expliziter Save mit Toast, Cancel mit Discard-Warnung nur bei Änderungen (existiert im Goal-Wizard, vereinheitlichen).

- **Sportprofil (Beispiel Fußball, ersetzt ~35-Tap-Formular):** 5 Steps im StepContainer: ① Rolle & Niveau (2× ChoiceCards) ② Position (Grid mit Positions-Karten, Zusatzpositionen als Multi mit Zusammenfassungszeile) ③ Einsatzprofil (Segmented) ④ Trainingsumfang (Tage-Kreise + Minuten-Stepper) ⑤ Spielrhythmus (Spieltag-Auswahl) + ExpandableSection „Erweitert" (performancePriorities, fields{}) — Tiefe identisch, gleichzeitig sichtbar: 1 Frageblock.
- **Ziele:** bestehenden 7-Step-Wizard auf 3 Steps straffen (Kategorie-Cards → Details [Titel/Wert/Datum] → Priorität), Manager-Liste mit Status-Segmenten statt 6 Einzelbuttons.
- **Verfügbarkeit:** Wochenraster als 7 Tages-Karten; Tap öffnet BottomSheet je Tag (verfügbar/Ruhetag/Slot/Doppel); Kompakt-Zusammenfassung oben; fixedCommitments als Liste mit Add-Sheet (schließt Schema-Lücke).
- **Beschwerden:** Liste aktiver Constraints als Karten (Region-Icon, Intensität, Status-Segment); Editor als BottomSheet; Warnsignal-Felder (Safety-Gates) klar getrennt mit med. Abgrenzungstext.
- **Leistungswerte:** KPI-Karten (HFmax, Ruhepuls, VO2max, FTP, Schwellen-Pace) mit source+measuredAt sichtbar („gemessen · Garmin · 12.05."), Edit per BottomSheet; „nur gemessene Werte eintragen"-Hinweis; PB-/1RM-Listen als Advanced.
- **Regeneration/Präferenzen:** je ein FullScreenEditor mit Segmented/ChoiceCards statt Freitext; _legacyText nur lesend anzeigen, nie neu schreiben.
- **Geräte & Quellen:** Statuskarten je Integration (ehrlich not_connected/in Vorbereitung), Equipment/Locations als Advanced-Listen.

---

## G. Designsystem (verankert an bestehenden Tokens, kein Fremd-Redesign)

- **Farben:** bestehende Palette bleibt (Gold-Akzent #C9AE7C/#DCC79A, Flächen #0c131d/#121a26, border/-strong, text/-muted/-faint); NEU nur semantische Zustände: success (gedämpftes Grün), warning (Bernstein), danger (bestehendes Rot) — nie color-only, immer mit Icon/Text.
- **Typo-Rollen:** Display 28/800 (Screen-Titel), Title 20/700 (Cards), Body 16/500, Caption 13.5 muted, KPI tabular-nums (bestehend).
- **Spacing/Radius:** 4-px-Skala (4/8/12/16/24/32); Radius: Card 22, Control 12–14, Pill 30 (bestehend).
- **Komponenten (CSS-Präfix `pf-`):** ChoiceCard (min-height 56px, Icon+Label+Subtext, checked-State: Goldrahmen + Häkchen, aria-pressed), SegmentedControl (role=radiogroup), Stepper, TagInput mit Summary, ExpandableSection (aria-expanded), InlineHelp (?-Button → BottomSheet-Popover „Warum fragen wir das"), ProgressHeader, ReviewCard, SectionCard (Zentrale), SmartPrompt, StatusChip. Buttons/Inputs/Sheets: bestehende .btn/.orvia-sheet weiterverwenden.
- **Interaktion:** Touch-Targets ≥44px überall (behebt Chip-35px), sichtbarer Fokus (bestehender Goldring), Motion 200 ms ease (Slide-in Steps, Fade Overlays) mit prefers-reduced-motion-Respekt; Haptics als Kommentar für spätere Native-Phase.
- **Illustration/Icons:** bestehende Linien-Icons (SVG, stroke 2.2) fortführen; keine Stock-Illustrationen; Sport-Icons aus vorhandenem Katalog.

---

## H. Microcopy (deutsch, du-Form — Auszug als verbindlicher Ton)

- **Welcome:** „ORVIA erstellt dein persönliches Leistungsprofil. Training, Tagesform und Ziele — präzise auf dich abgestimmt." · „Dauert etwa 3 Minuten. Alles lässt sich später ändern."
- **Datenschutz:** „Deine Daten gehören dir. Sie bleiben in deinem Konto, du kannst sie jederzeit ändern oder löschen."
- **Geschlecht:** „Optional. Hilft bei der Einordnung von Herzfrequenz- und Belastungswerten." — Option „Keine Angabe".
- **Körper:** „Warum? Gewicht und Größe fließen in Belastung und Trainingszonen ein — nicht in Bewertungen."
- **Niveau:** „Wie trainierst du aktuell?" + „Damit ordnet ORVIA Umfang, Intensität und Progression realistisch ein."
- **Ziel:** „Was willst du erreichen?" + „Ein Ziel reicht für den Start. Weitere kannst du jederzeit ergänzen."
- **Verfügbarkeit:** „An welchen Tagen kannst du meistens trainieren?" + „ORVIA plant nur, was in dein Leben passt."
- **Beschwerden:** „Hast du aktuell Schmerzen oder Einschränkungen?" + „ORVIA passt dein Training an — ersetzt aber keine ärztliche Abklärung."
- **Geräte (ehrlich):** „Garmin- und Strava-Import sind in Vorbereitung. Bis dahin erfasst du Einheiten direkt in ORVIA."
- **Zusammenfassung:** „Sieht gut aus. Prüfe kurz — dann legt ORVIA los."
- **Erfolg:** „Dein Profil steht. Nach deinem ersten Check-in bekommst du deine erste Empfehlung." Primär: „Ersten Check-in machen" · Sekundär: „Profil verfeinern (5 Min)" / „Zur App".
- **Skip:** „Später ergänzen" (nie „Überspringen und verlieren"). **Fehler:** „Das hat nicht geklappt. Deine Eingaben sind gesichert — versuch es gleich nochmal."

---

## I. Orientierung + kontextuelle Coachmarks (Revision 1 — keine 5-Schritt-Tour nach langem Onboarding)

**Sofort nach dem Erfolgs-Screen (1 Moment, kein Block):** Ein einziger Orientierungs-Hinweis auf dem Heute-Tab: Spotlight auf die Check-in-Karte — „Starte mit deinem ersten Check-in. Daraus entsteht deine erste Empfehlung." (primäre Handlung = Lerneffekt; kein passives Durchklicken nach 4 Minuten Setup).

**Kontextuelle Coachmarks (je EINMAL, beim ersten echten Besuch):** Training-Tab → „Hier startest und erfasst du Einheiten." · Fortschritt-Tab → „Trends und Wochenlast findest du hier." · Avatar/Profil → „Hier änderst du jederzeit alle Angaben." · Nach dem ersten Check-in → Spotlight auf Score+Empfehlung („Dein Tagesstatus — und was ORVIA dir heute rät.").

Regeln: jede Coachmark einzeln dismissbar, Flags `orvia_coachmarks_v1:<userId>` (Set je Marke), nie zweimal automatisch, gesammelt wiederholbar über Profilzentrale → Hilfe → „Einführung erneut zeigen", blockiert nichts, erklärt NUR existierende Funktionen.

---

## J. Technische Zielarchitektur (Wiederverwendung zuerst)

- **State:** onboarding-logic.js erweitern (nicht ersetzen): `STEP_CONFIG {id, tier:'essential'|'personalization'|'advanced', required, skippable}`, `skippedSteps[]` im Draft, `skipStep()`/`isStepOptional()`; Draft-Version 2→3 mit Migration (bestehendes normalizeDraft-Muster). Draft-Persistenz: onboarding-store unverändert (user-scoped, Backup vorhanden); Cloud-Draft bewusst NICHT in v1 (dokumentierte Grenze).
- **Feld-/Section-Metadaten (verbindlich: ADR-Entwurf D1–D4):** `PROFILE._sectionMeta = {sectionId:{updatedAt, source}}` separat, flache Felder unangetastet. **Completeness und Staleness sind getrennte pure Funktionen** — `computeCompleteness()` liest nur Feldwerte (Required-Sets aus PROFILE-FIELD-MATRIX §11), `isStale()` liest nur `_sectionMeta` mit den Kategorien **zeitkritisch / regelmäßig prüfenswert / stabil** (ADR D4, inkl. staleAfter-Richtwerten).
- **Schreibpfad (unverhandelbar):** ALLE neuen Komponenten schreiben über `ORVIA.profile.updateSection()` → `_profileSave(sections)` → Legacy-Projektion → Event `orvia:profile-updated`. Kein zweiter Pfad, kein direktes saveProfile aus UI.
- **Cloud-Wiring (Revision 1, ADR D5):** **Kein neuer Cloud-Schreibpfad ohne vollständigen Zyklus** (Write + Read/Hydration + Reload-Test + Konfliktregel im SELBEN Paket). `profileStore.persist(sections)` wird erst nach beschlossenem Persistenzvertrag (ADR) erweitert. Bis dahin: sports/availability/goals bleiben blob-autoritativ; Editor-Pakete (M11) liefern KEINEN Write-through nebenbei.
- **Komponenten (vanilla, ein File `js/profile-ui-kit.js` + CSS-Block):** ProfileFlow (nutzt onboarding-logic), StepContainer, ChoiceCard, SegmentedControl, Stepper, InlineHelp, ProgressHeader, ReviewCard, SectionCard, StatusChip, SmartPrompt, FullScreenEditor (Wrapper um openSheet), BottomSheet (vorhanden). Onboarding UND Zentrale nutzen dieselben Komponenten + dieselben Validatoren (onboarding-profile-logic/-sports-logic/profile-model — bereits modular, Audit H §3).
- **Events:** bestehendes `orvia:profile-updated` mit changedSections reicht; Zentrale re-rendert selektiv darüber.

---

## K. Migrationsplan (kleine Pakete, jedes einzeln deploybar + getestet)

**Revision 1: M1/M2/M3 sind GETRENNTE Pakete mit je eigener Freigabe und eigenem Test-Satz — kein gemeinsames Umsetzungspaket.**

| Paket | Inhalt | Abhängigkeit |
|---|---|---|
| M1a ✅ | Feldmatrix (PROFILE-FIELD-MATRIX.md) + Datenvertrag-Entwurf (ADR-DRAFT) + Planrevision — NUR Doku (erledigt 2026-07-02) | — |
| M1b ✅ | UMGESETZT 2026-07-02 (ADR D1–D8 beschlossen): ensureSectionMeta/touchSectionMeta (D2 inkl. schemaVersion), computeSectionCompleteness/computeProfileCompleteness (Required-Sets = Matrix §11, Essential-Score über 5 Sections), getSectionFreshness (unknown/current/review_recommended/stale, FRESHNESS_CONFIG zentral) + goalDateNeedsReview (Event-Regel separat); _profileSave setzt source='editor'. Tests: profile_meta_completeness_test 54/54 (RED→GREEN). Recovery-Flow (D8) bewusst NICHT enthalten. | erledigt |
| M2 ✅ | UMGESETZT 2026-07-02: `js/profile-ui-kit.js` (5 Factories: ChoiceCard/Segmented/Stepper/InlineHelp/ProgressHeader; zustandsarm, ohne Persistenz-Kopplung, InlineHelp delegiert ans bestehende openSheet) + abgegrenzter pf-CSS-Block (Token-Aliasse, 44px-Ziele, focus-visible, reduced-motion; disjunkt zu Alt-`pf-`-Planerfüllungs-Chips). Tests: profile_ui_kit_test 56/56 (RED→GREEN, Mini-DOM in _helpers). Noch NICHT in index.html/sw.js eingebunden — Einbindung erfolgt mit erstem Konsumenten (M5), daher kein Deploy-Impact. | erledigt |
| M3 ✅ | UMGESETZT 2026-07-02: STEP_CONFIG (16 Steps, 3 Tiers, active-Flag; STEP_IDS abgeleitet = unveränderter v2-Flow), Draft-v3 (skippedSteps; v2 wird migriert, unbekannte Felder bleiben, idempotent), skipStep/completeStep (Result-Objekte; profile/sports nur via Fachvalidierung), getNext-/getPreviousStep (nur aktive Steps, Tier-Wechsel nur explizit), getProgress (countsTowardProgress, Skip=erledigt), isTierComplete (Flow-Sicht, strikt getrennt von Profil-Completeness). PLACEHOLDER_ALIASES_V4 dokumentiert (goals_placeholder→goals, schedule_placeholder→availability, review_placeholder→review; Aktivierung inkl. currentStep+completedSteps-Mapping in M7, Draft v3→v4). Tests: onboarding_state_v3_test 63/63 (RED→GREEN); Bestandssuiten grün (onboarding_logic_test-Versionspin bewusst auf 3 angepasst). Keine UI-/Store-/Persistenzänderung. | erledigt |
| M4 ✅ | UMGESETZT 2026-07-02: transaktionaler Abschluss (completeOnboardingFlow, DI-testbar; persist awaited; synced/pending/local/failed; Event `orvia:onboarding-completed` 1×; Fehlerpfad resümierbar mit Retry; minimaler Erfolgs-Screen „Dein Profil steht." ohne Auto-Close — Check-in-CTA folgt, sobald stabiler Entry-Point existiert). Mapping-Fix: experienceLevel→sports[primary].level. Behebt KNOWN_ISSUES #5. Tests 26/26. | erledigt |
| M5a ✅ | UMGESETZT 2026-07-02: First-Run-Rahmen + Welcome (A0) + „Über dich" (A1). A0: ORVIA-Branding, Claim, 3 Nutzenpunkte, Vertrauenszeile, ~4-Minuten-Hinweis, „Profil einrichten"/„Später fortsetzen", KEINE Eingaben, zählt nicht zum Fortschritt. A1: Name Pflicht („Wie dürfen wir dich nennen?"), Geburtsdatum ODER Alter 13–100 (SegmentedControl, Wechsel leert die andere Angabe — UI-Moduszustand S.birthMode), Geschlecht optional als ChoiceCards („Keine Angabe" neutral vorbelegt OHNE Draft-Write, InlineHelp). ProgressHeader-Zahlen ausschließlich aus getProgress() (aktuell „1 von 5"). Validator: ageEstimate ergänzt, sex/height/weight/level nur bei Angabe geprüft (Größe/Gewicht → A7/M5c, Niveau → A3/M5b). UI-Kit produktiv eingebunden (index.html + sw.js, fail-closed ohne Kit); Kit-Erweiterung: optionale Option-IDs im SegmentedControl. Tests: onboarding_m5a_first_run_test 43/43, onboarding_dom_test auf M5a-Vertrag angepasst 143/143. Deploy-Bündel v8-176. | erledigt (M2+M3) |
| M5b/M5c | Rest von M5: A3 Trainingsstand (M5b), A7 Körper (Größe/Gewicht, M5c) | M5a |
| M6 | Essential Screens 5–6 (Sportarten/Hauptsport-Einstieg) | M5 |
| M7 | Essential Screens 7–9 (Ziel/Verfügbarkeit kompakt/Sicherheitscheck) — ersetzt die drei Placeholder | M6 |
| M8 | Review + Erfolg + Ebene-B-Einstieg (Modul-Liste) | M7, M4 |
| M9 | Orientierung + kontextuelle Coachmarks (Abschnitt I, Rev. 1) | M8 |
| M10 | Profilzentrale Shell: Header, Completeness, Smart Prompts, SectionCards (liest nur; Editoren verlinken zunächst auf Bestand) | M1+M2 |
| M11 | Editor-Migration einzeln: ① Gewicht/Body-Quick ② Ziele (Wizard straffen) ③ Verfügbarkeit (+fixedCommitments-Editor) ④ Sportprofil-Wizard ⑤ Beschwerden ⑥ Leistung ⑦ Regeneration/Präferenzen ⑧ Geräte — **alle OHNE Cloud-Write** (ADR D5) | M10, je einzeln |
| M11-C | Cloud-Vollzyklen je Section (Write+Hydration+Reload+Konfliktregel), Reihenfolge sports → availability → goals | ADR-Beschluss, je einzeln |
| M12 | Legacy-Editoren/Modals abschalten, toter Code raus, iPhone-E2E-Runde, Doku | alle |

Regeln je Paket: eigener Test-Satz, ein Cache-Bump pro deploybarem Bündel, alte und neue Editoren koexistieren NUR über den gemeinsamen Schreibpfad, Rollback = Paket-Dateien zurück.

---

## L. Testplan

- **Unit:** computeCompleteness/staleness (Grenzfälle), STEP_CONFIG/skipStep/Draft-v3-Migration (idempotent), Validatoren-Wiederverwendung (Zentrale ruft identische Fn), Ebenen-Zuordnung (Essential-Felder vollständig).
- **Integration (Muster migrate_blob_test):** Essential-Durchlauf → PROFILE korrekt + _sectionMeta gesetzt + KEINE Defaults (70/175 dürfen nirgends auftauchen, wenn Nutzer 68/182 eingibt); Resume mitten in Schritt 6; Accountwechsel während Draft; Completion-Fehlerpfad (persist failure → Draft bleibt in_progress).
- **DOM (Element-Registry/vm-Sandbox):** Navigation vor/zurück/skip, Pflichtfeld-Fehleranzeige (aria-describedby), ChoiceCard aria-pressed, Doppel-Tap-Schutz, Tutorial ein/aus/wiederholen, Zentrale rendert Status-Chips korrekt aus _sectionMeta-Fixtures.
- **Browser-E2E (iPhone-Checkliste):** kompletter First-Run auf iPhone Safari (Hochformat, Tastatur über Feldern, Safe-Area, große Schrift), Reload in jedem Schritt, Offline-Zwischenspeicherung, Abbruch+Resume nach App-Kill, Ebene B einzeln, Editor-Roundtrips.
- **UX-Akzeptanz (messbar, Revision 1 — Zielwerte für Beta):**
  - Median-Dauer Essential ≤ 4 Min, P90 ≤ 7 Min
  - Abbruchrate je Schritt < 5 %, kein Einzelschritt > 10 %
  - Skip-Rate A7 Körperdaten < 50 % (höher → Fragestellung überarbeiten); Skip Geschlecht frei (kein Ziel)
  - Validierungs-Fehlerrate: Median < 0,5 Fehler pro Schritt
  - Resume-Rate nach „Später fortsetzen": > 60 % kehren binnen 7 Tagen zurück
  - Zeit bis erster Check-in: > 70 % noch in derselben Session nach Setup-Abschluss
  - Zeit bis erste sinnvolle Empfehlung: > 60 % binnen 24 h (= erster Check-in erfolgt)
  - Statisch: kein Screen > 6 Eingabeelemente, keine Chip-Liste > 6 ohne Karten-/Suchersatz, Touch ≥ 44 px, jede Pflichtfrage mit Begründung, kein stilles Speichern, Fortschritt immer sichtbar
  - Messmethode v1: lokale Zähler im Draft (`draft.metrics`: Schritt-Enter/Exit-Timestamps, Skips, Validierungsfehler) + manueller Export bei Beta-Testern; echte Telemetrie = offene Produktentscheidung (N)

---

## M. Risiken

| Risiko | Schwere | Mitigation |
|---|---|---|
| Datenverlust bei Editor-Migration (alte+neue parallel) | HOCH | einziger Schreibpfad `_profileSave`, Editor-für-Editor, Regressionstests je Paket |
| Scope-Explosion (12 Pakete werden 30) | HOCH | Ebene B/C strikt NACH Essential-Launch; M-Pakete einzeln freigeben |
| Cloud-Halbsync sports (Write ohne Read-Hydration) | MITTEL | dokumentierte LWW-Grenze, Hydration als eigenes Folgepaket, P2-Konfliktregel-ADR davor |
| Abbruchrate steigt statt sinkt | MITTEL | Messpunkte einbauen (Schritt-Abschluss-Events lokal), Essential bewusst kurz, Weiche statt Zwang |
| Bestandsnutzer (Gian, Partnerin!) erneut ins Onboarding gezwungen | HOCH | isOnboardingComplete-Auto-Complete bleibt unverändert; Zentrale+Prompts holen Lücken ab; expliziter Test |
| Performance (profile.js wächst weiter) | NIEDRIG | neues UI-Kit als eigene Datei, Legacy-Abbau in M12 |
| A11y-Regressionen | NIEDRIG | Komponenten bringen ARIA mit; DOM-Tests je Komponente |
| Tutorial nervt | NIEDRIG | einmalig, überspringbar, Flag getestet |

---

## N. Entscheidungen (Stand Revision 1)

**Entschieden (Gian, 2026-07-02):** ① Name erst im Setup ② Geschlecht optional, nicht zwingend Essential ③ Größe/Gewicht optional (eigener skippbarer Schritt A7, Smart Prompt fasst nach) ④ Drei-Ebenen-Modell bestätigt, Essential max. 7–8 Arbeitsschritte, Welcome kombiniert ⑤ KEIN sports-Cloud-Write ohne Vollzyklus (ADR D5) ⑦ keine 5-Schritt-Tour — Orientierung + kontextuelle Coachmarks.

**Offen:**
1. **Avatar-Upload** behalten oder streichen? (N6 alt)
2. **ADR-Beschluss** (PROFILE-DATA-CONTRACT-ADR-DRAFT.md): D1–D8 bestätigen + offene Punkte dort (Konfliktregel erster Cloud-Zyklus, staleAfter-Werte, Recovery-UX-Wortlaut, _sectionMeta-Backfill).
3. **Telemetrie:** UX-Metriken nur lokal (Beta-Export) oder echte Messinfrastruktur (Datenschutz-Implikation)?

---

## O. Empfehlung

**10/10-Potenzial:** Drei-Ebenen-Setup + Profilzentrale mit ehrlichem Status-Modell, gebaut auf den EXISTIERENDEN Validatoren/State-Machine/Tokens — weil es die reale Stärke (fachliche Tiefe im Modell) sichtbar macht, statt sie hinter Formularen zu verstecken, und weil es ohne Big-Bang in 12 kontrollierbaren Paketen erreichbar ist.

**Ausdrücklich NICHT tun:** komplettes CSS-/Brand-Redesign (Tokens sind gut) · per-Feld-Metadaten-Umbau (bricht 6+ Konsumenten, Audit H §5) · Onboarding-Draft in die Cloud (v1) · goals-Bi-Sync vor Konfliktregel-ADR · Integrations-Screens für nicht existierende Features · Placeholder-Steps „aufhübschen" statt ersetzen.

**Erstes Implementierungspaket nach ADR-Beschluss (Revision 1):** **M1b allein** (Metadaten-Fundament: _sectionMeta, computeCompleteness, isStale — rein additiv, komplett offline testbar, null UI-Risiko). Danach einzeln freizugeben: M2 (Komponenten-Basis), M3 (State-Machine), M4 (Completion-Race-Fix, behebt KNOWN_ISSUES #5).
