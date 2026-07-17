# ORVIA — Deploy-Checkliste (gianthaysen.github.io)

## AKTUELL: Deploy-Plan Bündel v8-184 (R1 — Kritische Datenintegrität)

Basis: v8-183 muss live sein (Incident-Fix). KEINE neue Migration (user_goals.goal_type
hat keinen CHECK — kanonische IDs sind DB-kompatibel; 0012-Constraints betreffen nur
priority/status/metric_type).

R1-Inhalte:
- R1.1 Live-Fremdsport: recordLiveToActivity nutzt zentrale legacySessionKey()
  (activity-config) — Fußball/Tennis/… landen NIE mehr als „Gym" im Tagesspeicher;
  sportId wird an der Session mitgespeichert; neuer Key vor savePost-Löschung geschützt.
- R1.2 Ziel-IDs kanonisch (half_marathon/run_5k/run_10k): profileModel.canonGoalCategory,
  normalizeGoal kanonisiert beim Lesen (id stabil, keine Dubletten), Race-Editor schreibt
  nur noch kanonisch; gcat() in ui.js; RACE_DIST/RACE_LABELS_P kanonische Keys.
- R1.3 Entscheidung: renderCommand ohne Calc.ampel (dayState-SSoT, Fallback 'y');
  unitGuidance + „Nächster Lauf" (Insights) aus getDecision(); Calc.ampel offiziell als
  HISTORICAL-DECISION-API dokumentiert (nur Vergangenheit + insights-Rückblick).
- R1.4 Belastung: NEU Calc.loadSeries (eine Kurvenquelle); drawForm, ACWR-Karte,
  buildGoal-CTL und Coach-Report laufen über loadSeries/loadModel (acute/chronic im
  loadModel-Output); keine Calc.acwr/ewma-Direktrechnung mehr in UI-Pfaden.
- R1.5 Nutzermodus: profileModel.normalizeLevelKey + primarySportLevel (Kit-Level vor
  Legacy PROFILE.level); userLevel() delegiert; workout-ui isPro() aus kanonischem Level,
  Fehler/fehlend ⇒ false (vorher: Default-Profi für jeden Beginner).

Geänderte Dateien (ATOMAR, sw.js ZULETZT):
- [ ] js/calc.js           (loadSeries, loadModel+acute/chronic, ampel-Doku)
- [ ] js/profile-model.js  (canonGoalCategory, TIME-Liste kanonisch, normalizeLevelKey, primarySportLevel)
- [ ] js/ui.js             (gcat, kanonische Ziel-Lookups, renderCommand/unitGuidance/SegAusdauer auf SSoT, ACWR-Karte/buildGoal/Report auf loadModel/loadSeries, userLevel)
- [ ] js/charts.js         (drawForm → Calc.loadSeries)
- [ ] js/activity-config.js (legacySessionKey NEU)
- [ ] js/workout-ui.js     (recordLiveToActivity ohne Gym-Fallback, isPro kanonisch)
- [ ] js/profile.js        (GOAL_LABELS kanonische Keys additiv, primaryGoal-Anzeige beide Namespaces)
- [ ] js/insights.js       (Historical-API-Doku)
- [ ] sw.js                (v8-184) — ZULETZT

Live-Abnahme v8-184:
1. [ ] Konsole: orvia-v8-184, keine 404/Mischversion.
2. [ ] R1.1: Fußball (oder Tennis) als Profilsport → Live-Training starten/beenden →
       Heute/Verlauf zeigen die Einheit als Fußball, NICHT als Gym; Wochen-Load zählt sie.
3. [ ] R1.2: Bestehendes HM-Ziel erscheint weiter korrekt im Race-Header (Zielzeit erhalten);
       Ziel-Editor öffnen → Distanz vorausgewählt; neues 5-km-Ziel speichern → Header ok.
4. [ ] R1.3: Heute-Karte, Einheiten-Hinweis (Plan-Detail) und „Nächster Lauf" (Insights →
       Ausdauer) zeigen KEINE widersprüchlichen Freigaben; vergangene Tage weiter mit Ampel.
5. [ ] R1.4: Insights → Form-Chart lädt; ACWR-Karte zeigt Wert + Akut/Chronisch oder
       ehrlichen Hinweis (<21 Tage); keine NaN.
6. [ ] R1.5: Testprofil Primärsport-Level „Beginner" → Gym-Logger OHNE RIR/Satztyp-Felder;
       Level „Competitive" → Felder sichtbar.

Rollback: Dateien auf v8-183 + sw 'orvia-v8-183'. Keine Datenmigration nötig; bereits
kanonisch gespeicherte Ziel-IDs bleiben auch für v8-183 lesbar? NEIN — v8-183 kennt
half_marathon nicht in RACE_DIST → bei Rollback zeigt der Race-Header „Ziel" statt Label,
Daten bleiben aber erhalten. Rollback daher nur bei kritischem Fehler.

## AKTUELL: Deploy-Plan Bündel v8-183 (ERSETZT das nie deployte v8-182 — Engine E1–E3 + INCIDENT-FIX)

INCIDENT (live gemeldet): Dauer-Dialog „Lokale Daten gefunden" bei jedem Start,
blockierte Tabs, Trägheit, halber Tab-Zustand. Root Causes: (1) iOS killt den
JS-Kontext beim Schließen oft VOR markRev → eigene Cloud-Daten galten als fremd;
(2) onAuthed lief beim Kaltstart doppelt → gestapelte Dialog-Backdrops blockierten
die Tabbar. Fixes in diesem Bündel:
- sync.js: Dialog NUR bei fremder device_id UND numerisch neuerer Cloud-Rev;
  eigenes Gerät nie; start()-Reentrancy-Guard; Dialog-Singleton; Buttons sperren
  + Sofort-Feedback („Übertrage…/Lade Cloud…").
- auth.js: onAuthed-Latch je Nutzer (kein Doppel-Init), Reset bei SIGNED_OUT.
- ui.js: showTab kapselt jeden Renderer einzeln (nie mehr Button aktiv + Panel leer).
- ui-refresh.js: 150 ms Debounce (Login-Hydrations-Burst = 1 Render statt 4).

Voraussetzung: v8-181 live (0015 + delete-account ✓). KEINE neue Migration.

Geänderte/neue Dateien (ATOMAR, sw.js ZULETZT; js/engine/ MIT hochladen — Shadow-Mode):
- [ ] js/sync.js, js/auth.js, js/ui-refresh.js   (Incident-Fixes)
- [ ] js/profile.js       (E1 _planDecide('now') baut real neu)
- [ ] js/ui.js            (E1 planRebuildBanner/orviaRebuildPlan/resetPlan; E2 Shadow-Hook; Incident showTab-Kapselung)
- [ ] js/calc.js          (E3 Calc.loadModel)
- [ ] js/engine/engine-contracts.js, readiness-engine-v2.js, decision-engine-v2.js, plan-engine-v2.js, shadow-runner.js (NEU ausgeliefert)
- [ ] index.html          (E2 Engine-Script-Tags)
- [ ] sw.js               (v8-183, ASSETS +5) — ZULETZT

Live-Abnahme v8-183:
1. [ ] Konsole: orvia-v8-183, keine 404 (engine/*!), keine Mischversion.
2. [ ] INCIDENT: App mehrfach schließen/öffnen (gleiches Gerät) → KEIN „Lokale Daten"-Dialog mehr; Start flüssig; alle Tabs sofort klickbar; Tab-Optik immer konsistent.
3. [ ] Zweitgeräte-GEGENPROBE: Gerät A Plan ändern + App schließen → Gerät B öffnen → Dialog erscheint GENAU EINMAL, Buttons reagieren sofort, danach nie wieder bis zur nächsten fremden Änderung.
4. [ ] E1: Wizard-Ziel ändern → „Plan jetzt neu aufbauen" → Wochenplan folgt sofort dem neuen Ziel; Beginner-Läufer ohne Intervalle; Triathlon = Lauf+Rad+Schwimmen.
5. [ ] E1: „Später neu berechnen" → Banner im Plan-Tab → Button baut neu.
6. [ ] E2: ORVIA.engineShadow.report() in der Konsole → {days:≥1}; Anzeige bleibt v1-gesteuert.

Rollback: Dateien auf v8-181 + sw 'orvia-v8-181' (engine/-Dateien können liegen bleiben).

## Deploy-Plan Bündel v8-181 (Stand 2026-07-11 — Live-Härtung H1–H5 — DEPLOYT, Abnahme 8/9 + E-Fixes)

VORAUSSETZUNGEN (vor dem Frontend-Deploy, einmalig):
1. [ ] Migration 0015_checkin_evening_fields.sql im SQL-Editor ausführen.
2. [ ] Edge Function deployen: supabase functions deploy delete-account
       (Repo: supabase/functions/delete-account/index.ts; nutzt Standard-Secrets).
(Ohne 0015 schlägt nur der evening-Cloud-Persist kontrolliert fehl; ohne die
Function meldet „Konto löschen" einen Serverfehler und löscht NICHTS lokal.)

Geänderte Dateien (ATOMAR, sw.js ZULETZT; js/engine/ weiter NICHT hochladen):
- [ ] js/ui.js            (H1 Flags/userLevel/gymDays, H2 goalOf/saveGoal, H3 _persistEve, H5 AdaptCard/Routinen)
- [ ] js/issues.js        (H3 kanonischer Constraints-Pfad)
- [ ] js/sync.js          (H3 Zweitgeräte-Merge statt Blind-Push)
- [ ] js/activity.js      (H3 Import → kanonischer Store)
- [ ] js/checkin-store.js, js/repos/checkinRepository.js (H3 evening)
- [ ] js/auth.js          (H3 evening-Hydrate, H4 PW/E-Mail/Löschung)
- [ ] js/profile-center.js (H4 Account-Karte), js/profile.js (H5 deprecated-Marker)
- [ ] js/quick-actions.js (H5 Routinen-Flag), js/gym-volume.js (H5 Escape)
- [ ] index.html          (H5 cdPlan raus)
- [ ] sw.js               (v8-181) — ZULETZT

Live-Abnahme v8-181 (Kern):
1. [ ] Konsole: orvia-v8-181, keine 404/Mischversion.
2. [ ] H1: Läufer-Testprofil (running primary, level beginner, KEIN Rennziel) → Wochenplan neu generieren → Laufeinheiten (Z2, kein Intervall, KEIN reiner Kraftplan); mit Gym-Nebensport (2×/Woche) → genau 2 Gym-Einheiten.
3. [ ] H2: Ziel im Wizard anlegen (HM 1:50) → Plan-Tab-Race-Header zeigt es; „Ziel bearbeiten" im Plan-Tab ändern → user_goals aktualisiert (eine Zeile, keine Dublette).
4. [ ] H3a: Abend-Check-in ausfüllen → daily_checkins-Zeile checkin_type=evening; Zweitgerät zeigt Stimmung/Energie/Notiz (Protein/Flüssigkeit bewusst nur lokal).
5. [ ] H3b: GPX-Import → Aktivität erscheint in activities (source=import) und auf Zweitgerät.
6. [ ] H3c: Im Check-in eine Beschwerde >0 setzen → user_constraints-Zeile entsteht; „Modul pausieren" → Status observed.
7. [ ] H3d: Gerät A Wochenplan ändern → Gerät B öffnen → Dialog „Lokale Daten gefunden" statt stillem Überschreiben; beide Optionen testen.
8. [ ] H4: Passwort ändern (eingeloggt) → neu einloggen; E-Mail ändern → Bestätigungslink; TESTKONTO löschen → Login unmöglich, Tabellen leer (NUR lolipophans08-Alias!).
9. [ ] H5: Heute-Karte „Tagesentscheidung" ohne doppelte Warum-Liste; Quick-Add „Routinen" zeigt Karte auch wenn alles erledigt.

Rollback: Dateien auf v8-180 + sw 'orvia-v8-180'. 0015 kann stehen bleiben (additiv); Edge Function kann deaktiviert werden.

## Deploy-Plan Bündel v8-180 (Stand 2026-07-11 — Produktreife-Programm P1–P10 — DEPLOYT)

VORAUSSETZUNG (SQL-Editor, in dieser Reihenfolge, VOR dem Frontend-Deploy):
1. [ ] Migration 0012_goal_enums_and_fields.sql
2. [ ] Migration 0013_availability_profile_sync.sql
3. [ ] Migration 0014_user_constraints.sql
(Alle additiv/idempotent. Ohne sie schlagen die neuen Sync-Upserts kontrolliert fehl —
Blob bleibt Quelle, kein Datenverlust; aber die P9-Zyklen wären live wirkungslos.)

Geänderte/neue Dateien (ATOMAR, sw.js ZULETZT; js/engine/ weiter NICHT hochladen):
- [ ] js/ui-refresh.js                 (NEU — P1 zentraler Rerender-Consumer)
- [ ] js/repos/constraintRepository.js (NEU — P9)
- [ ] js/ui.js            (P1 showTab/heute + Hook, P3 Ampel-Historie, P4 Generator+Setup read-only, P7 Routinen)
- [ ] js/profile.js       (P1 age, P2 Seed/Mirror, P4 Präferenz-Felder, P5 Wizard, P6 Equipment, P10 SECTION_DEFS.body raus)
- [ ] js/profile-model.js (P4 effectiveTrainingConfig, P5 metricType, P6 Katalog+Migration, P4 Preferences-Felder)
- [ ] js/profile-store.js (P9 Sektions-Zyklen + MAPPED-Autopush + clear)
- [ ] js/repos/profileRepository.js, js/repos/availabilityRepository.js, js/repos/goalRepository.js (P5/P9)
- [ ] js/auth.js          (P9 Hydrationen)
- [ ] js/intelligence.js  (P3 Safety-Gate)
- [ ] js/calc.js          (P4 Doku-Kommentar)
- [ ] js/nutrition.js, js/supplements.js, js/activity.js (P2 ehrliche Werte/Neutralisierung)
- [ ] js/quick-actions.js (P8 Favoriten)
- [ ] index.html          (P7 routinesCard/Badge, P9 constraintRepository-Script)
- [ ] styles.css          (P2 time-Inputs, P3 amp-hist, P7 Nav+Badge, P8 Favoriten)
- [ ] sw.js               (v8-180, ASSETS +2) — ZULETZT

Live-Abnahme v8-180 (Kern):
1. [ ] Konsole: `[ORVIA SW] orvia-v8-180`, keine 404 (ui-refresh/constraintRepository), keine Mischversion.
2. [ ] P1: Namen im Profil ändern → Kopfzeile/Heute sofort aktuell ohne Neustart; Tab „Heute" öffnen rendert frisch.
3. [ ] P2: Gewicht/HFmax im Körper-Editor ändern (Altwerte 198/58/75/175 sichtbar+editierbar) → Karte/Zonen/Profilkarte sofort; Feld leeren → „Nicht angegeben"; Ernährung ohne Körperdaten zeigt Hinweis statt Zahlen.
4. [ ] P3: Krankheitssymptome im Check-in + hohe Readiness → KEIN „Guter Tag für Qualität"; Insights verweisen auf die Tagesentscheidung; vergangene Tage: Ampel als „Historische Einordnung".
5. [ ] P4: Verfügbarkeit mit 5 Tagen setzen → neu generierter Wochenplan hat 5 Einheiten nur auf diesen Tagen (bestehender gespeicherter Plan bleibt bis zur Neu-Generierung); Trainings-Setup ist read-only mit Links.
6. [ ] P5: Ziel „Ironman" anlegen mit Zielzeit 10:00:00 → gespeichert+angezeigt; eigenes Ziel mit eigener Kategorie.
7. [ ] P6: Equipment-Editor zeigt nur Typen der aktiven Sportarten; bestehende Schuhe/Rad (km-Zähler) unverändert sichtbar.
8. [ ] P7: Training-Tab inaktiv GRAU (kein Ring); Routinen-Karte erscheint nur mit offenen Aufgaben („x offen").
9. [ ] P8: Plus → Favoriten sichtbar, „Favoriten anpassen" (sortieren, max 6), Reihenfolge übersteht Reload; „Ziel hinzufügen" nur unter „Alle Aktionen".
10. [ ] P9 ZWEI GERÄTE: Verfügbarkeit/Ziel/Beschwerde auf Gerät A ändern → Gerät B nach Login identisch; Kontowechsel A→B→A ohne Leak; Offline-Änderung synct nach Flush; user_goals: Alt-Seed-Zeilen (blob:…) wurden durch echte Ziel-IDs ersetzt.
11. [ ] 320/375/390/430 px: Recovery-Editor (Zeiten), Verfügbarkeit, Quick-Add, Profil — kein horizontaler Overflow.
Testkonten NUR lolipophans08-Aliase; Produktivkonten unangetastet.

Rollback: Bündel-Dateien auf v8-179-Stand + sw.js 'orvia-v8-179' (ein Revert). Migrationen 0012–0014 sind additiv und können stehen bleiben (Alt-Client ignoriert die Spalten/Tabelle).

## Deploy-Plan Bündel v8-179 (Stand 2026-07-09 spät — DEPLOYT)

Voraussetzung: v8-178 ist live. Eigener Cache-Bump (v8-179).

Geänderte Dateien (ATOMAR, sw.js ZULETZT; `js/engine/` weiterhin NICHT hochladen):
- [ ] js/profile-center.js   (onClose schließt Sheet wirklich; Einfach-Bindung der Karten)
- [ ] js/profile.js          (Beschwerden-Manager: „Alle Änderungen werden sofort gespeichert")
- [ ] styles.css             (gm-inline-Checkbox-Fix, overflow-x:hidden im Sheet, 48px-X-Touchfläche)
- [ ] sw.js                  (v8-179) — ZULETZT

Live-Abnahme v8-179:
1. [ ] Konsole: `[ORVIA SW] orvia-v8-179`, keine 404, keine Mischversion.
2. [ ] Profil-Center: X oben rechts schließt beim ERSTEN Tap (iPhone Safari/PWA).
3. [ ] Center offen lassen → Beschwerde löschen/hinzufügen → Karte + Header aktualisieren SOFORT (korrekte Anzahl, kein App-Neustart).
4. [ ] Verfügbarkeit: Tag verfügbar machen → Speichern → Karte sofort „Vollständig", Header zählt runter.
5. [ ] Verfügbarkeits-Editor auf 320/375/390/430 px: „Verfügbar", „Als Ruhetag festlegen", „Doppeleinheit möglich" vollständig sichtbar, kein horizontales Scrollen.
6. [ ] Karten-Tap öffnet Editor genau EINMAL (kein Doppel-Öffnen/Flackern).
7. [ ] Beschwerden-Manager zeigt den Auto-Save-Hinweis; nach jeder Aktion Toast.

Rollback: die 4 Dateien auf v8-178-Stand + sw.js zurück auf 'orvia-v8-178' (ein Revert, keine Datenmigration betroffen).

## Deploy-Plan Bündel v8-178 (Stand 2026-07-09 — Profil-Completion-Fixpaket — DEPLOYT)

Voraussetzung: v8-177 ist live (inkl. 2B-①, Migration 0011 ausgeführt). Kleines
Nachfolge-Bündel, eigener Cache-Bump (v8-178), da v8-177 ausgeliefert wurde.

Geänderte Dateien (ATOMAR, sw.js ZULETZT; `js/engine/` weiterhin NICHT hochladen):
- [ ] js/profile-model.js    (ESSENTIAL_FIELD_LABELS)
- [ ] js/profile.js          (Trainingsstand-Block im Sportprofil-Editor, orviaAcknowledgeNoConstraints, _missingHintHTML, _sppMergeSport)
- [ ] js/profile-center.js   (Karten nennen fehlende Angaben konkret)
- [ ] styles.css             (.tabbar button.nav-plus Spezifitäts-Fix, .gm-miss/.gm-missing-hint)
- [ ] sw.js                  (v8-178) — ZULETZT

Live-Abnahme v8-178:
1. [ ] Konsole: `[ORVIA SW] orvia-v8-178`, keine 404, keine Mischversion.
2. [ ] Plus-Button: 52-px-Gold-Kreis, ragt sauber über die Pill, kein Clipping/Linie/abgeschnittener Glow; 320 px: 48 px.
3. [ ] Profil-Center: Karten mit Lücken zeigen „Fehlt: Trainingsniveau · Einheiten pro Woche · Typische Dauer" (statt nur „3 Angaben fehlen"-Pauschale in der Unterzeile).
4. [ ] Hauptsportart → „Profil bearbeiten": Hinweis „Fehlende Angaben: …" oben, markierte Felder; Trainingsniveau + Einheiten/Woche + Dauer ausfüllen → Speichern → Karte „Vollständig", Header-Zähler sinkt sofort.
5. [ ] Beschwerden: „Ich habe aktuell keine Beschwerden" bestätigen → Karte „Vollständig".
6. [ ] Verfügbarkeit: einen Tag verfügbar machen → Speichern → „Vollständig"; danach Header „Profil vollständig" + Ring ✓.
7. [ ] HARTER Reload: alles bleibt (Blob) UND user_sports enthält level/sessions_per_week/typical_duration_min (2B-①-Autosync nach Editor-Save).
8. [ ] Sportprofil öffnen und OHNE Änderung schließen → kein „Änderungen verwerfen?"-Dialog.

Rollback: die 5 Dateien auf v8-177-Stand + sw.js zurück auf 'orvia-v8-177' (ein Revert, keine Datenmigration betroffen).

## Deploy-Plan Bündel v8-177 (Stand 2026-07-03 inkl. Phase 1A — DEPLOYT 2026-07-09)

**Phase-1A-Erweiterung (Vertrauensbrüche; KEIN neuer Cache-Bump — v8-177 wurde nie ausgeliefert,
eine Version je ausgeliefertem Bündel):** zusätzlich geändert: js/ui.js (Runna→ORVIA-Laufplan,
applyDayLock sperrt Buttons, markPlannedDone ohne erfundene Werte, Slogans raus, fmtDe),
js/activity.js (orviaConfirm statt confirm, fmtDe), js/profile.js (orviaConfirm-Helfer),
js/checkin-extra.js (Accordion), js/orvia-pro.js (Quick-Actions-Karte raus), index.html, styles.css.
Zusätzliche Live-Abnahme: 8. [ ] Plan-Tab zeigt „ORVIA-Laufplan"; 9. [ ] Gestern: Chips/Slider
ausgegraut und ohne Reaktion, Banner + „Korrektur erfassen" funktioniert; 10. [ ] Aktivität
bearbeiten: Sportartwechsel/Löschen/Plausibilität als ORVIA-Modal (kein weißes Popup);
11. [ ] Plan-Einheit „erledigt": Detailansicht zeigt KEINE RPE/Performance; 12. [ ] Distanzen
mit Komma (z. B. „7,2 km"); 13. [ ] Heute: kein Slogan, keine Quick-Actions-Karte,
Zwischen-Check-in eingeklappt.

**Phase-2B-①-Erweiterung (sports-Vollzyklus + E7; weiterhin KEIN neuer Cache-Bump — v8-177
nie ausgeliefert):** zusätzlich geändert: js/profile-store.js (persistSports/hydrateSports,
K1/K2, Event-Hook, clear-Erweiterung), js/repos/sportRepository.js (replaceUserSports),
js/auth.js (E7 awaited Flush mit 4s-Timeout + hydrateSports im Login-Pfad).
VORAUSSETZUNG vor dem Live-Test: `supabase/migrations/0011_user_sports_sync.sql` manuell
im Supabase-SQL-Editor ausführen (rein additiv, idempotent). OHNE 0011 schlägt der
Set-Sync-Upsert fehl (unbekannte Spalten) → Sports blieben Blob-only, kein Datenverlust.
Zusätzliche Live-Abnahme: 14. [ ] Migration 0011 ausgeführt (Spalten section_updated_at,
client_role, sessions_per_week, typical_duration_min, custom_name vorhanden);
15. [ ] Testaccount: Sportarten im Editor ändern → Zeilen in user_sports korrekt
(role-Mapping, section_updated_at gesetzt); 16. [ ] ZWEITGERÄT/Privat-Fenster, gleicher
Account, leerer Speicher: Login → Sportarten erscheinen inkl. Level/Einheiten;
17. [ ] Konfliktprobe: Gerät A ändert, danach Gerät B einloggen → B übernimmt A-Stand
(kein stilles Überschreiben mit altem B-Blob); 18. [ ] Offline-Probe: Flugmodus, Sportart
ändern, online + Reload → Änderung in user_sports; Login hängt nie >5 s im Flush;
19. [ ] Kontowechsel auf Zweitaccount: keine Sportarten des ersten Accounts sichtbar.

Ersetzt/umfasst das nie ausgelieferte v8-176-Bündel (KNOWN_ISSUES #17). ALLE Dateien ATOMAR
zusammen hochladen, sw.js ZULETZT. `js/engine/` NICHT hochladen (parallel, inaktiv).

Geänderte/neue Dateien:
- [ ] js/profile-store.js                  (2B-①: sports-Zyklus K1/K2, Event-Hook, clear)
- [ ] js/repos/sportRepository.js          (2B-①: replaceUserSports Set-Sync)
- [ ] js/auth.js                           (2B-①/E7: awaited Flush + Timeout, hydrateSports)
- [ ] js/profile.js                        (A0-Fix ×4, D7-Defaults null, M10-Einstieg openProfileCenterEntry)
- [ ] js/profile-model.js                  (validateEssentialGoals/-Availability/SafetyCheck)
- [ ] js/profile-ui-kit.js                 (iconRef-SVG, SegmentedControl allowEmpty)
- [ ] js/profile-center.js                 (NEU — M10 Profilzentrale)
- [ ] js/coachmarks.js                     (NEU — M9 Spotlight)
- [ ] js/quick-actions.js                  (NEU — Track B Plus-Schnellzugriff)
- [ ] js/onboarding/onboarding-logic.js    (v4, Steps training_level/goals/availability/safety/body, advance*-Fachfunktionen, Rückführungs-Walk)
- [ ] js/onboarding/onboarding-sports-logic.js (level/sessionsPerWeek/typicalDuration, Bänder, Validatoren)
- [ ] js/onboarding/onboarding-steps.js    (neue Step-Metadaten)
- [ ] js/onboarding/onboarding-ui.js       (Essential-Renderer A2–A8, Completion-Mapping inkl. Safety/ageEstimate, Erfolgsscreen)
- [ ] js/ui.js                             (Tabbar-Bindung nur [data-tab])
- [ ] index.html                           (Plus-Button, 5 neue Sport-Icons, Script-Tags profile-center/coachmarks/quick-actions)
- [ ] styles.css                           (Blöcke OB3-Erweiterung, PC, CM, QA)
- [ ] sw.js                                (v8-177, ASSETS +3 Dateien) — ZULETZT

Live-Abnahme v8-177 (nach Deploy):
1. [ ] Konsole: `[ORVIA SW] orvia-v8-177`, keine 404 (profile-center/coachmarks/quick-actions.js), keine Mischversion.
2. [ ] A0-REGRESSION: Editor-Save (z. B. Ziel-Titel ändern) → HARTER Reload direkt danach → Wert bleibt (vorher verloren!).
3. [ ] Neuer Testaccount (lolipophans08-Alias): kompletter First-Run A0→A8 — 8 Schritte, keine vorausgewählten Tage, Sicherheits-Check Pflicht, Körper skippbar, Review ehrlich, Erfolgsscreen → „Ersten Check-in machen" → Heute-Tab + Spotlight (einmalig).
4. [ ] Bestandsaccount gianthaysen76: KEIN erneutes Onboarding; „Profil öffnen" zeigt die Zentrale mit echten Werten/Chips; Karten öffnen die bekannten Editoren; Smart Prompts plausibel (max 2).
5. [ ] Alt-Draft-Fall (falls vorhanden): Resume führt auf den ersten neuen Pflichtschritt zurück, Daten intakt (KNOWN_ISSUES #20).
6. [ ] Plus-Button: mittig, Sheet öffnet/schließt, morgens Morgen-Check-in oben, Aktionen landen in bestehenden Flows, Tab-Wechsel unbeeinträchtigt.
7. [ ] iPhone SE (320 px): Grid 1-spaltig, Tages-Kreise umbrechen, Plus 48 px, keine horizontale Scrollbar.

Rollback: Dateien des Bündels auf den v8-176-Stand zurücklegen + sw.js zurück auf 'orvia-v8-176' (ein Commit-Revert); Draft-v4-Nutzerdaten bleiben lesbar? NEIN — v4-Drafts würden von v8-176 als korrupt archiviert (Backup-Key, Neustart an sicherer Stelle, PROFILE unangetastet). Für Bestandsnutzer ohne offenen Draft ist der Rollback folgenlos.


Stand: 2026-06-21 08:40, Service-Worker-Version in sw.js:
    const C = 'orvia-v8-106';

Alle folgenden Dateien müssen am EXAKT gleichen Pfad im GitHub-Repo liegen.
Größe = lokaler Stand (zur groben Plausibilitätsprüfung).

## Kerndateien (Root)
- [ ] index.html                  30377 Bytes
- [ ] styles.css                 142156 Bytes
- [ ] sw.js                        3112 Bytes
- [ ] manifest.webmanifest          648 Bytes

## JavaScript (js/ und js/repos/) — Reihenfolge wie in index.html geladen
- [ ] js/4.4.1/chart.umd.min.js                FEHLT LOKAL
- [ ] js/config.js                               1448 Bytes
- [ ] js/supplements.js                         12353 Bytes
- [ ] js/calc.js                                64057 Bytes
- [ ] js/data.js                                14458 Bytes
- [ ] js/profile.js                             27043 Bytes
- [ ] js/issues.js                              14890 Bytes
- [ ] js/intelligence.js                         9893 Bytes
- [ ] js/orvia-pro.js                           17215 Bytes
- [ ] js/charts.js                               4538 Bytes
- [ ] js/ui.js                                 183031 Bytes
- [ ] js/activity.js                            27340 Bytes
- [ ] js/nutrition.js                           12430 Bytes
- [ ] js/insights.js                             8543 Bytes
- [ ] js/race.js                                 4168 Bytes
- [ ] js/story.js                               14173 Bytes
- [ ] js/extras.js                               9802 Bytes
- [ ] js/repos/repoBase.js                       4909 Bytes
- [ ] js/repos/profileRepository.js              1905 Bytes
- [ ] js/repos/checkinRepository.js              2840 Bytes
- [ ] js/repos/trainingLoadRepository.js         6828 Bytes
- [ ] js/repos/readinessRepository.js            2793 Bytes
- [ ] js/repos/goalRepository.js                 1855 Bytes
- [ ] js/repos/availabilityRepository.js         1817 Bytes
- [ ] js/training-domain.js                     13095 Bytes
- [ ] js/repos/exerciseRepository.js             2846 Bytes
- [ ] js/repos/sportRepository.js                2886 Bytes
- [ ] js/repos/trainingPlanRepository.js         4710 Bytes
- [ ] js/repos/workoutRepository.js             13452 Bytes
- [ ] js/offline-queue.js                        9069 Bytes
- [ ] js/profile-store.js                        7881 Bytes
- [ ] js/checkin-store.js                        8004 Bytes
- [ ] js/migrate-blob.js                         7487 Bytes
- [ ] js/readiness-source.js                     7760 Bytes
- [ ] js/readiness-store.js                      8228 Bytes
- [ ] js/training-migration.js                   3002 Bytes
- [ ] js/workout-store.js                       30236 Bytes
- [ ] js/sync.js                                 9702 Bytes
- [ ] js/auth.js                                16816 Bytes
- [ ] js/checkin-extra.js                        7454 Bytes
- [ ] js/workout-ui.js                          52592 Bytes

## Assets (Icons/Branding)
- [ ] assets/.DS_Store                                 6148 Bytes
- [ ] assets/brand/orvia-favicon.svg                    550 Bytes
- [ ] assets/brand/orvia-icon-dark.svg                  948 Bytes
- [ ] assets/brand/orvia-icon-light.svg                 954 Bytes
- [ ] assets/brand/orvia-icon.svg                      1504 Bytes
- [ ] assets/brand/orvia-lockup-horizontal.svg         1341 Bytes
- [ ] assets/brand/orvia-lockup-stacked.svg            1269 Bytes
- [ ] assets/brand/orvia-og-image.png                 78153 Bytes
- [ ] assets/brand/orvia-symbol-only.svg                698 Bytes
- [ ] assets/brand/orvia-wordmark.svg                   481 Bytes
- [ ] assets/icons/apple-touch-icon.png               14982 Bytes
- [ ] assets/icons/icon-192.png                       16136 Bytes
- [ ] assets/icons/icon-512.png                       50467 Bytes
- [ ] assets/icons/maskable-icon-512.png              39172 Bytes
- [ ] assets/og/orvia-og-image.png                    78153 Bytes

## NUR in Supabase ausführen (NICHT auf github.io hochladen)
- [ ] supabase/migrations/0002_core_data_foundation.sql
- [ ] supabase/migrations/0003_training_domain.sql
- [ ] supabase/migrations/0004_live_workout.sql
- [ ] supabase/migrations/0005_live_workout_hardening.sql
- [ ] supabase/migrations/0006_exercise_library_expansion.sql
- [ ] supabase/migrations/0007_workout_terminal_rpc.sql

Hinweis: Der Ordner supabase/tests/ und supabase/migrations/ gehören NICHT auf die Website.

## Edge-Function-Deploy: register-with-invite (Dashboard-Verfahren, Stand 2026-07-02)

Die Function besteht im Repo aus ZWEI Dateien:
`supabase/functions/register-with-invite/index.ts` + `handler.mjs`.

LIVE (Dashboard-Editor) heißt die zweite Datei **`handler.ts`** (der Editor legte kein
`.mjs` an) und der Import in der Live-`index.ts` lautet entsprechend `'./handler.ts'`.
Das ist eine BEWUSSTE, dokumentierte Abweichung — Inhalt ist identisch (reines ESM-JS,
läuft unter beiden Endungen). Kanonische Quelle bleibt das Repo (`handler.mjs`).

Verfahren bei Änderungen (bis CLI eingerichtet ist):
1. Supabase → Edge Functions → register-with-invite → Tab „Code".
2. Vorher „Download" klicken (Rollback-Sicherung).
3. Inhalt von Repo-`handler.mjs` → in Live-`handler.ts` einfügen (⌘A, ⌘V).
4. Inhalt von Repo-`index.ts` → in Live-`index.ts` einfügen und **Zeile 2 anpassen**:
   `'./handler.mjs'` → `'./handler.ts'`.
5. „Deploy updates" → Bestätigen → oben muss „a few seconds ago" erscheinen.
6. Smoke: Registrierungsversuch mit ungültigem Code → 400 invalid_invite.

Sobald Supabase-CLI eingerichtet ist (`supabase functions deploy register-with-invite`
aus `app/`): deployt beide Repo-Dateien 1:1 — dann heißt die Live-Datei wieder
`handler.mjs` und dieser Abschnitt entfällt.

## Live-Abnahme v8-176 (First-Run M5a + Issue-#6-Fix) — NACH dem Frontend-Deploy

Dateien des Bündels: siehe KNOWN_ISSUES #17. Atomar hochladen, dann prüfen:

1. [ ] Neuer bestätigter Account → Welcome A0 erscheint (Claim, Nutzenpunkte, keine Eingabefelder, kein Schrittzähler).
2. [ ] „Profil einrichten" → A1 „Über dich" erscheint mit „Schritt 1 von 5".
3. [ ] Name + Alter 13 (Modus „Nur Alter angeben") → Weiter funktioniert.
4. [ ] Geburtsdatum so, dass der 13. Geburtstag MORGEN ist (Nutzer noch 12) → blockiert mit Altersfehler.
5. [ ] Geburtsdatum so, dass der 13. Geburtstag HEUTE ist → gültig. (4+5 hängen am lokalen Gerätedatum.)
6. [ ] Geschlecht unberührt lassen („Keine Angabe" nur vorbelegt) → im Draft/Profil bleibt das Feld leer; erst aktiver Klick schreibt einen Wert.
7. [ ] „Später fortsetzen" auf A1 → Shell schließt; Reload/App-Neustart → setzt direkt bei A1 fort (nicht Welcome, kein Legacy-Flow).
8. [ ] Bestandsaccount (gianthaysen76) → KEIN erneutes Onboarding; Profil bearbeiten weiterhin über den Editor-Einstieg möglich.
9. [ ] Restflow bis zum Abschluss (Sport → Platzhalter → Zusammenfassung → „Profil erstellen") → M4-Erfolgsscreen „Dein Profil steht.", KEIN Auto-Close vor dem Persist-Ergebnis; bei Fehler Retry-Angebot.
10. [ ] Konsole/Netzwerk: keine 404 (insbesondere js/profile-ui-kit.js — neu im Bündel), kein „profileUiKit undefined", SW-Log zeigt genau `[ORVIA SW] orvia-v8-176`, keine Mischversion (harter Reload + einmal App schließen/öffnen).

Offline-Absicherung derselben Punkte: onboarding_m5a_first_run_test (1–3, 6, 7),
age_boundary_issue6_test (4, 5), onboarding_dom_test (7, 8), onboarding_completion_m4_test (9).
Punkt 10 ist NUR live prüfbar.
