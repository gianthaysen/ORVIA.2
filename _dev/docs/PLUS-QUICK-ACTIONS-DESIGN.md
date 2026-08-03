# ORVIA · PLUS-QUICK-ACTIONS-DESIGN (Track B)

Status: IMPLEMENTIERT (2026-07-03, Bündel v8-177). Modul: js/quick-actions.js · Tests: quick_actions_b_test.mjs (21 grün) · CSS: styles.css „QA (Track B)“ · Markup: index.html #navPlus.

## B1 · Ist-Inventar (verifizierte Entry-Points)

| Aktion | Entry-Point | Overlay | Anmerkung |
|---|---|---|---|
| Training starten/fortsetzen | ORVIA.workoutUI.openTrainingTab (workout-ui.js:41/96) | #workoutOverlay/Hub | startSport übernimmt Konflikt „Session aktiv“ selbst |
| Aktivität nachtragen | openManualActivity (activity.js:623) | ad-hoc Modal | kanonischer Store-Save |
| Morgen-/Abend-Check-in | showTab('heute') + Scroll #morningForm/#eveForm | Inline-Seite | Check-ins sind Seitenabschnitte, keine Flows |
| Gewicht / Messwerte | openPerformanceManager (profile.js:1104) | Sheet | openWeightAdd/openBodyEditor sind NICHT standalone (_perfEd) |
| Beschwerde erfassen | openModulePicker (issues.js:198) | #suppSheet | |
| Ziel hinzufügen | openGoalsManager (profile.js:550) | Modal→Wizard | bewusst NICHT das globale openGoalEditor (Namenskollision ui.js:1897 Race-Modal vs. profile.js:596 Wizard — ui.js gewinnt per Ladereihenfolge!) |
| Termin | openFixedEventEditor (ui.js:390) | ad-hoc Modal | engine-aktives System (PROFILE.fixedEvents), nicht die vorbereiteten fixedCommitments |
| Profil ergänzen | openProfileCenterEntry (profile.js, M10) | Sheet full | Kontextaktion |

## B2 · Contract

`QuickAction { id, label, description, icon, category('primary'|'secondary'|'context'), entryPoint('globalFn' | 'orvia:pfad.fn'), requiresProfile, requiresOnline, resultEvent }`. Keine Aktion ist im Plus-Modul implementiert — ausschließlich Delegation; nicht auflösbare Entry-Points werden ausgeblendet (fail-soft, kein toter Button). Quelltext-Vertrag im Test: keine direkten Writes (kein saveProfile/_profileSave/localStorage/repos).

## B3 · Kontext-Ranking (pur, getestet)

`buildContext()` → { hour, morningDone, eveningDone (DB[today]), activeWorkout (ORVIA.workout.session), profileIncomplete (computeProfileCompleteness), activeConstraint (activeConstraints), online }.
Regeln: <12 Uhr + Morgen offen → Morgen-Check-in zuerst · ≥18 Uhr + Abend offen → Abend zuerst · laufendes Training → „fortsetzen“ ersetzt „starten“ · unvollständiges Profil → Kontextkarte oben in Sekundär · aktive Beschwerde → „aktualisieren“ ersetzt „erfassen“ · max. 3 Primäraktionen. Keine künstliche „KI“-Aktion.

## B4 · UI

Runder Gold-Plus-Button mittig in der bestehenden Tabbar (index.html), −14 px angehoben, 52 px (≥44 px), Press-Animation (scale .92), aria-label „Schnellaktionen öffnen“, aria-haspopup="dialog", KEIN data-tab (ui.js bindet seit dieser Session nur `.tabbar button[data-tab]` — Root-Cause-Fix gegen showTab(undefined)). Sheet über bestehendes openSheet (size:large): Primärliste (Gold-Akzent) + „Mehr“-Sektion; Fokus/Escape/Backdrop/Safe-Area erbt die Sheet-Infrastruktur; Icons aus dem bestehenden SVG-Symbolkatalog.

## Zukünftige Navigation (entworfen, NICHT umgesetzt)

Ziel-Nav `Start | Training | + | Fortschritt | Profil` erfordert: Zusammenführung heute/plan→Start, dash→Fortschritt, Profil-Overlay→eigener Tab (Profilzentrale M10 als Inhalt). Der Plus-Button und das Quick-Action-Sheet sind darauf vorbereitet (positionsunabhängig, Registry-basiert). Eigenes Paket nach Beta-Feedback; kein Big-Bang in dieser Session.

## Manuelle iPhone-Prüfliste (nach Deploy)

1. Plus sichtbar/zentriert auf SE (320 px) bis Pro Max; keine horizontale Überfüllung.
2. Tap: Press-Animation, Sheet öffnet mit Safe-Area-Abstand; Backdrop/Escape schließt.
3. Morgens vor Check-in: „Morgen-Check-in“ oben; nach Check-in nicht mehr priorisiert.
4. Laufende Live-Einheit: „Training fortsetzen“ statt „starten“.
5. Jede Aktion landet im bestehenden Flow (kein Duplikat-Formular); Doppel-Tap öffnet nichts doppelt.
6. VoiceOver: Button als „Schnellaktionen öffnen, Taste, Popup“; Listeneinträge mit Label+Beschreibung.
