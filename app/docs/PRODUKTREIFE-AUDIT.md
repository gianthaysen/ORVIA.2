# ORVIA · PRODUKTREIFE-AUDIT & ROADMAP ZUM ENDPRODUKT

Status: AUDIT (2026-07-03, nach High-Capacity-Session, Code-Stand Bündel v8-177). Kein Code geändert.
Grundlage: Gians Master-Liste (25 Blöcke, nicht repo-verifiziert) abgeglichen gegen den VERIFIZIERTEN Repository-Stand + frisches Mobile-UI-Audit der Legacy-Oberflächen (file:line-Evidenz). Legende: ✅ ERLEDIGT (verifiziert) · 🟡 TEILWEISE · ❌ OFFEN · ⚠️ ANNAHME KORRIGIERT.

---

## A. Kernergebnis

Die Diagnose der Master-Liste stimmt: **das Problem ist Konsolidierung, nicht fehlende Einzelteile.** Der Stand hat sich aber seit ihrer Erstellung deutlich verschoben — von den drei kritischen Blöcken ist Block 3 (Premium-UI) zur Hälfte erledigt (Onboarding, Profilzentrale, Plus-Button sind auf Produktniveau), Block 2 (Trainingsintelligenz) liegt als fertige, getestete Engine v2 parallel bereit und wartet nur auf die Aktivierung, und in Block 1 (Fundament) ist der gefährlichste Einzelfehler (A0-Persistenzbug) beseitigt. **Die drei größten verbleibenden Risiken zur Produktreife sind:** (1) die Persistenz-Asymmetrie (Ziele/Sport/Verfügbarkeit/Beschwerden nur im lokalen Blob → Gerätewechsel = Datenverlust), (2) der ungeteilte Alltag der Legacy-Oberflächen (Heute-Tab mit bis zu 15 Karten, 7 Overlay-Systeme, native confirm()-Popups) und (3) die fehlende rechtliche Basis (Impressum/DSE/Account-Löschung) — ohne die weder Beta-Ausweitung noch Monetarisierung vertretbar sind.

---

## B. Abgleich Master-Liste ↔ Repo-Stand (mit Lösung je offenem Punkt)

### 1 · Produktpositionierung
✅ Performance- statt Medizin-App ist im Code verankert (Sicherheits-Check mit med. Abgrenzung, keine Heilversprechen, CLAUDE.md §13/24). ✅ Multi-User-Basis (Supabase Auth, user-scoped Keys, Kontowechsel-Guards). 🟡 Beginner/Advanced/Profi-Modi: Level existiert kanonisch je Sport (sports[].level, M5b) und steuert Engine-v2-Progression; ein UI-„Modus" (einfachere/tiefere Ansichten) fehlt. **Lösung:** kein eigener Modus-Schalter — Level + checkinMode (quick/full) + Progressive Disclosure decken es ab; erst nach Beta-Feedback entscheiden. 🟡 enabled≠visible≠planning ist im Datenmodell umgesetzt; die Sichtbarkeits-Steuerung der Tabs/Kacheln nach Sportart ist teilweise (activityConfig.userSportTiles) — Rest in M11.

### 2 · Branding/Design
✅ Logo/Icons/Manifest vorhanden und im Welcome hochwertig inszeniert; App-Icon fürs iPhone existiert (apple-touch-icon, maskable). ✅ Einheitliches Komponentensystem für NEUE Flächen (profile-ui-kit, pc-/qa-/ob3-/cm-Blöcke). ❌ Loading-/Splash-Page mit Logo+Slogan: fehlt. **Lösung:** kleines Paket — statischer Splash in index.html (Logo + „Know your state."), per CSS bis App-Boot sichtbar; iOS-Splash über apple-touch-startup-image optional später. 🟡 Farbsystem: Gold/Dark final; „Blau/Grün" existieren nur als Statusfarben — Empfehlung: dabei belassen (Gold+Dark ist die Marke; mehr Farben verwässern). ❌ Daily Motivation: vorhanden, aber als englische Slogans (ui.js:1360–1373) — **Empfehlung: ersatzlos streichen** (UI-Audit #24; Floskeln widersprechen „Analyse statt Motivation" aus Block 13). 🟡 Ziel-Tage in Gold: Race-Header existiert; goldene Hervorhebung von Ziel-Tagen im Wochenplan = Mini-Task in R1. ❌ Einheitlicher Look ALLER Module: siehe UI-Audit (Abschnitt C) — das ist der Kern von R1/R2.

### 3 · Navigation
✅ Plus-Button + Quick-Action-Sheet mit Kontext-Ranking sind implementiert (v8-177; Registry deckt Training/Erfassen/Check-ins/Gewicht/Beschwerde/Ziel/Messwert/Termin ab). 🟡 Quick Add „Schlaf/HRV" und „Notiz": Schlaf/HRV laufen über den Morgen-Check-in (bewusst — zweiter Schreibpfad wäre verboten); Notizen existieren nur je Training. **Lösung:** „Notiz" erst mit klarem Konsumenten (sonst Datenfriedhof). ❌ Redundante CTAs/leuchtender Ring/„heute trainiert"-Redundanz: bestätigt (UI-Audit #1/#5/#10). ⚠️ Gestern-Logik: bereits bewusst gesperrt (nur Heute editierbar, Korrektur-Modus existiert) — ABER der Lock ist halbgar (Chips bleiben tappbar, Änderung wird still verworfen; UI-Audit #3) und die Verlauf-Copy verspricht „Bearbeiten" (#21). **Lösung in R1:** applyDayLock auf Buttons/Chips ausweiten + Copy „Tippen für Details".

### 4 · Onboarding
✅ Weitestgehend ERLEDIGT (M5a–M9): 8 Essential-Schritte, ein Dispatcher (openOrviaOnboarding), fail-closed, Draft v4 mit Resume/Rückführung, dynamisch auf Hauptsport bezogen (Trainingsstand/Dauer je Primary), keine Pflicht-Wochenkilometer (Engine legt Volumen fest), Erfolgsscreen + Spotlight. ⚠️ „Legacy-Fallback entfernen": bereits erledigt — Legacy nur noch hinter Debug-Flag (onboarding-ui.js:822); der tote 18-Step-Code in profile.js (~300 Zeilen) fliegt in M12. 🟡 Sportart-dynamische TIEFE (Triathlon → 3 Disziplinen, Fußball → Position): das ist Ebene B (sport_profile-Step, STEP_CONFIG vorhanden, inaktiv) → Paket R2/M11-④. ❌ PWA-Install-Tutorial („Zum Home-Bildschirm"): fehlt. **Lösung:** eine Coachmark/Hilfe-Karte in der Profilzentrale-Gruppe Einstellungen (iOS-Share-Sheet-Anleitung), 1–2 h Aufwand.

### 5 · Profil
✅ Profilzentrale (M10), kanonische Sections, ORVIA.profile als einzige API, ein Schreibpfad (nach A0-Fix auch real zuverlässig), Sportkatalog kanonisch (24 Einträge), Stammdaten/Tagesdaten getrennt. ❌ Die 14 Alt-Editoren selbst (enge Modals, 35-Tap-Sportprofil, Chip-Wüsten) sind unverändert → **M11-Pakete ①–⑧** (Reihenfolge im Redesign-Plan K; Gewicht/Body zuerst, Sportprofil-Wizard als größter Brocken). Sportart/Training nachträglich ändern: ✅ möglich (Sports-Editor; Aktivitätstyp-Wechsel existiert — aber via natives confirm(), UI-Audit #7).

### 6 · Ziele
🟡 Essential-Ziel mit Datum ✅ (M6, kuratierte Kategorien inkl. 5k/10k/HM/Marathon/Triathlon/Kraft/Körper); Mehrfachziele+Prioritäten+Konflikt-Erkennung existieren im Modell (goals[], MAX_TOP_PRIORITY, detectGoalConflicts + Konflikt-UI). ❌ Zielrückrechnung/Prognose/Countdown: Alt-Engine kann nur den hartkodierten HM (calc.js RACE_DATE!); Engine v2 Plan nutzt targetDate für Taper, rechnet aber noch keine Volumen-Periodisierung zurück. **Lösung (R3, nach Engine-Aktivierung):** Plan-Engine-v2-Erweiterung „Makrozyklus": Wochen bis targetDate → Basis/Build/Peak/Taper-Blöcke mit begrenzter Progression (+Deload alle 4 Wochen), Zielprognose als ehrliches Band (Reason-Codes, confidence) statt Einzelzahl; Countdown = triviale UI auf targetDate.

### 7+8 · Plan & adaptive Logik — DER Kernblock
🟡 Fast alles hier ist in **Engine v2 bereits gebaut und getestet** (Verfügbarkeit, Ruhetage, keine harten Tage in Folge, Beginner-Deckel, Wiedereinstieg, Taper, Beschwerden-Gates, Readiness ohne erfundene Defaults, Confidence, Reason-Codes — 130 Testfälle, 15 Fixtures), aber **NICHT AKTIV**. Die produktive App fährt noch die Alt-Engine mit ihren dokumentierten Schwächen (ENGINE-CONTRACT-AUDIT). **Lösung = R3 (wichtigstes Funktionspaket):**
1. Shadow-Mode-Paket: Feature-Flag ORVIA_CFG.engineV2Shadow, je Check-in beide Engines rechnen, Differenz lokal loggen (14 Tage echte Daten von dir + Partnerin).
2. UI-Adapter: Command-/Adapt-Karte auf Decision-v2-Output (Reasons/Confidence/missingData sichtbar machen — genau die geforderte Erklärbarkeit).
3. Wochen-Rebalancing: adaptWeekPlan-Ablösung durch Plan-v2 (verschieben statt nur streichen).
4. Duplikat-Leser abbauen (ampel, unitGuidance, intelligence-Karten, CSV) — sonst widersprechen sich Tabs.
Soll-vs-Ist: 🟡 Basis existiert (Plan-Erfüllungs-Chips, markPlannedDone) — aber markPlannedDone erfindet RPE 5/Perf 6 (UI-Audit #10, **Datenkorrektheits-Bug → R1**).

### 9 · Tracking
✅ Live-Workout (Start/Pause/Stop, serverseitiger Lifecycle mit RPC, Offline-Queue, Restore), Gym mit Übungen/Sätzen/Volumen, manuelle Erfassung je Sport-Schema, Historie/Details, RPE/Notizen. 🟡 Typ nachträglich ändern: vorhanden, aber confirm()-UI (R1). ❌ GPS/Route/Karte: nicht vorhanden — **ehrliche Einordnung: als Browser-PWA ist Hintergrund-GPS nicht zuverlässig machbar; Karte/Route gehört in die Import-Schiene (Garmin/GPX bringt Routen mit) bzw. in eine spätere native Phase. Nicht in der PWA versprechen.** ❌ Dezimalspam („7.20 km", Punkt statt Komma): bestätigt (UI-Audit #15) → R1 (fmtDe existiert bereits).

### 10 · Check-ins
✅ Morgen/Abend/Zwischen-Check-in, Quick-Modus, dynamische Beschwerdefelder, Werte fließen in die Entscheidung, Verlauf vorhanden. 🟡 „Nicht zu lang": Ausführlich-Modus = 13+ Felder in einer Karte (UI-Audit #9) → R1 Gruppierung; Quick als Default prüfen. 🟡 Krankheits-/Belastungs-Dynamik: teils (ill-Chip ändert Logik); mehr Dynamik erst mit Engine v2 aktiv (Reason-getriebene Zusatzfragen).

### 11 · Beschwerden
✅ Kanonisches System (constraintsList, BODY_REGIONS 13, Intensität 0–10, Status active/improved/resolved/observed, Safety-Check im Onboarding, issues nur Projektion, Engine-Gates kontextsensitiv in v2, med. Abgrenzung). 🟡 Verlauf/Belastungs-vs-Ruhe-Schmerz: Modell hat triggers/notes, differenzierte Zeitpunkte fehlen. ❌ Auto-Archivierung („2 Wochen auf 0 → aus aktiver Ansicht"): fehlt. **Lösung (klein, R2):** pure Regel in profile-model (constraint.status='resolved'-Vorschlag als Smart Prompt in der Zentrale — NICHT still automatisch, Nutzer bestätigt).

### 12+13 · Regeneration/Insights
🟡 Erfassung vollständig; Analyse existiert, aber als 13+-Karten-Sammelsurium mit Duplikaten (UI-Audit #17) und drei konkurrierenden Mini-Engines. FFF/Formkurve: ACWR-artige Trends vorhanden, echtes Fitness/Fatigue-Modell fehlt. **Lösung:** Insights-Kuration in R7 (nach Engine v2: Karten aus Reason-Codes speisen = „erklären, warum" gratis); FFF-Modell erst auf der Tabellen-Lastserie (ehrliche Datengates) — Folgepaket nach R3.

### 14 · Kraft/Bodymap
✅ Volumen je Muskelgruppe, Wochenvolumen, Übungsbibliothek, eigene Übungen, 1RM-Schätzung (Epley, als Schätzung markiert). ❌ Bodymap wirkt billig — bestätigt: rohe Low-Poly-Polygone, 12 Farbtöne ohne Daten, 6er-Legende (UI-Audit #19). **Lösung (R7):** neue SVG-Silhouette mit Kurvenpfaden im Icon-Stil (stroke 2.2 + Gold-Füllstufen), max. 4 Zustände (kein Training/leicht/moderat/hoch), Muskelbegriffe aus bestehender Gruppenliste; Dysbalance-/Regenerations-Hinweise erst mit Tabellen-Lastserie.

### 15 · Ernährung
⚠️ Modul existiert (nutrition.js), ist aber laut Feldmatrix bewusst Ballast. **Produktentscheidung nötig:** entweder (a) schlankes Performance-Modul neu auf kanonischem Modell (Kalorien/Protein grob, Trainingstag-Unterscheidung, Race-Fueling) oder (b) vorerst ausblenden. Empfehlung: (b) bis Block 1–3 fertig — Ernährung ist der größte Scope-Sauger.

### 16 · Datenquellen
🟡 GPX/TCX/JSON-Import + Dedupe (activityDuplicate) + Quellenfeld vorhanden; Strava-API-Sync und Garmin fehlen (devices-Sektion sagt ehrlich „in Vorbereitung"). **Lösung (R5):** ① Strava-OAuth-Sync reparieren/bauen (mit has_heartrate=false-Behandlung, Dedupe über natural keys), ② Garmin danach (offizielle API braucht Developer-Zugang — Antrag früh stellen), ③ Konfliktregel „importiert überschreibt manuell nie" als Vertragstest.

### 17 · Backend/Accounts
✅ Auth live-verifiziert (2026-07-02, E2E), Invite-Codes, RLS auf Kerntabellen, Migrationen versioniert, Offline-Queue, Kontowechsel-Guards. ❌ **Kritisch offen:** Persistenz-Asymmetrie (KNOWN_ISSUES #1 — Ziele/Sport/Verfügbarkeit/Beschwerden nur Blob) → **R4 = M11-C Cloud-Vollzyklen** (je Section: Write+Hydration+Reload-Test+Konfliktregel, Reihenfolge sports→availability→goals→constraints). ❌ Account-Löschung (Stub!), Datenexport, E-Mail-Änderung → R4/R6 (rechtlich zwingend vor Beta-Ausweitung). 🟡 profiles-Tabelle ohne dokumentierte RLS-Policy (#3), Passwort-Reset-Link: PKCE-recovery-Flow ist implementiert — Live-Verifikation steht aus → in die v8-177-Live-Abnahme aufnehmen. env.js: fail-closed-Gate existiert (config.js gated + auth fail-closed) — Annahme „fail-open" ⚠️ so nicht bestätigt, bei Livecheck verifizieren.

### 18 · PWA/Offline
✅ SW mit sauberer Versionierung (v8-177, ausfalltolerantes Precaching, network-first env.js), Offline-Queue für Workouts/Checkins, Sync-Status-Badge, installierbar (Manifest). 🟡 Offline-Matrix „was geht offline" als Nutzer-Doku fehlt (Hilfe-Karte, R6); Splash s. Block 2.

### 19 · KI-Coach
❌ Nicht vorhanden — und die Reihenfolge in der Master-Liste ist richtig: erst regelbasiert. **Wichtig: Engine v2 IST die Vorstufe** — Reason-Codes + inputValues + confidence sind exakt der strukturierte, datensparsame Kontext, den ein LLM-Coach braucht (kein Rohdaten-Dump, Datenschutz!). **Lösung (R8):** Edge Function als Proxy (Key serverseitig), Kontext = Reasons+Wochenaggregat, harte Guardrails (keine Diagnosen, keine Steigerungsempfehlung gegen Engine-Invarianten — Engine-Output ist bindend, KI erklärt nur), Tokenbudget je Nutzer/Tag, Pro-Feature. Lifetime-Preismodell dafür ausschließen (laufende API-Kosten) — Monatsabo.

### 20–22 · Monetarisierung/Recht/Store
❌ Komplett offen, Reihenfolge zwingend: **Recht vor Geld** (R6 vor R9). R6: Impressum, DSE (Gesundheitsdaten-Einwilligung!), AVV-Liste (Supabase, GitHub Pages, später Anthropic/OpenAI, Stripe), Account-Löschung+Export funktionsfähig, Haftungs-/Medizin-Disclaimer (Texte teils vorhanden). R9: Free/Pro-Schnitt (Vorschlag: Free = Tracking+Check-ins+1 Ziel+Basisplan; Pro = adaptive Engine-Tiefe, Multi-Ziel, Integrationen, KI, Export), Stripe + Entitlement-Flag in Supabase. App Store: PWA bleibt der Weg bis Kernprodukt stabil; danach Capacitor-Wrapper prüfen (bringt HealthKit+Push+GPS in Reichweite — löst Block 9-GPS sauberer als jede PWA-Bastelei).

### 23 · Bekannte Bugs (Abgleich)
Erledigt in dieser Session: ✅ A0-Persistenz, ✅ Onboarding-Legacy produktiv raus, ✅ Plus-Button, ✅ Tabbar-Falle, ✅ ageEstimate-Verlust, ✅ Verfügbarkeits-Default, ✅ Cache-Disziplin (ein Bump je Bündel, Checkliste). Bestätigt offen (neu verortet): confirm()-Dialoge, Dezimalformat, Locked-Day-Chips, Runna-Wording (NEU gefunden — rechtlich relevant!), markPlannedDone-Fake-RPE, Doppel-Scroll/Sticky-Bars in Alt-Editoren, native selects/checkboxen, Bodymap. Strava-HR + Reset-Link: in Live-Abnahme/R5 verifizieren.

### 24 · QA/Admin
🟡 Teststand stark (83 Offline-Suiten, test-first etabliert, Fixtures decken Beginner/Läufer/Triathlet/Beschwerden/Zeitmangel via Engine-Fixtures ab); Deploy-Checkliste existiert. ❌ Fehler-/Crash-Tracking, Feedback-Kanal, Changelog: **Lösung (R6):** schlankes window.onerror→Supabase-Tabelle (errors, RLS, ohne PII) + Feedback-Button in der Zentrale; Changelog als docs-Datei je Bündel.

---

## C. Kritisches UI-Audit (Legacy-Flächen, verifiziert mit file:line)

Die 30 Einzelbefunde liegen priorisiert vor (Mobile-UI-Audit 2026-07-03); die strukturellen Muster dahinter:

1. **Dichte statt Hierarchie (HOCH):** Heute = bis zu 15 Karten (index.html:104–174), Insights = 13+ Karten mit Duplikaten, Plan = 11 Karten. Dieselbe Entscheidung wird 3–4× erklärt (Command ui.js:315, Adapt ui.js:556, Tips intelligence.js:120, Warum-Modal orvia-pro.js:91). → **Kuratieren, nicht dekorieren:** eine Entscheidungs-Karte als Single Surface; Zwischen-Check-in/Nutrition/Quick-Actions-Karte einklappen bzw. streichen (Plus-Button übernimmt); Ziel ≤6 Karten auf Heute.
2. **System-UI bricht die Marke (HOCH):** native confirm() an 5 Stellen (activity.js:189–204,542), native <select> (ui.js:1582,1280; workout-ui.js:524), Emoji-Buttons im Live-Overlay (workout-ui.js:395–439), JSON-Placeholder als Import-UX. → orviaConfirm-Modal (Pattern existiert), Segment-Controls, Sprite-Icons.
3. **7 Overlay-Systeme, 23 ad-hoc-Modals (HOCH):** → Konsolidierung auf openSheet+_modal als einziges Paar; ad-hoc-Call-Sites über eine Factory kapseln (M11/M12-Begleitarbeit, pro berührtem Editor migrieren statt Big-Bang).
4. **Vertrauensbrüche (HOCH):** Locked-Day-Chips reagieren, speichern aber nicht (ui.js:1415 vs. 165/643); markPlannedDone erfindet RPE 5/Perf 6 (ui.js:1799) und verfälscht Lastdaten; „Runna-Plan" als Fremdmarke im UI (ui.js:1477). → alle drei sind kleine, hochwirksame Fixes.
5. **Inkonsequente Details (MITTEL):** Punkt- statt Komma-Dezimalen trotz vorhandenem fmtDe (activity.js:82 u. a.), 14 parallele Border-Radii, zwei Readiness-Ring-Implementierungen (heute vs. gestern), Farbe-als-einziger-Zustand in Heatmap/Dots, chips() ohne aria-pressed (zentral nachrüstbar in ui.js:162–165).
6. **Tote Gewichte (MITTEL):** hartkodierte HM-Konstanten WEEKPLAN/PHASES/WEEK_TARGETS (ui.js:19–26,129–134), HM-Pace-Rechner-Karte statisch (index.html:201), Legacy-18-Step-Onboarding in profile.js, What-if/Coach-Karten mit Textbausteinen statt Daten (orvia-pro.js:34–79). → M12-Löschliste.

**Top-5 nach Premium-Wirkung pro Aufwand:** ① Heute-Tab kurieren ② confirm()/<select> ersetzen ③ „Runna"-Wording entfernen (2 Strings, sofort) ④ applyDayLock-Fix ⑤ de-DE-Zahlenformat.

---

## D. Roadmap zum Endprodukt (Pakete, je einzeln testbar & deploybar)

| # | Paket | Inhalt | Löst Blöcke | Aufwand |
|---|---|---|---|---|
| R0 | **v8-177 deployen + Live-Abnahme** (7 Punkte, DEPLOY_CHECKLISTE; + Reset-Link & env.js-Gate verifizieren) | — | 23 | klein |
| R1 | **UI-Vertrauens- & Feinschliff-Paket** (v8-178): Heute kuratieren, Entscheidungs-Karte mergen, Runna-Wording, applyDayLock, fmtDe überall, confirm()→orviaConfirm, native selects raus, markPlannedDone ohne Fake-RPE, Motivation raus, aria-pressed zentral, Verlauf-Copy | 2,3,9,13,23 | mittel |
| R2 | **M11 Editor-Migration** (①Gewicht ②Ziele ③Verfügbarkeit ④Sportprofil-Wizard ⑤Beschwerden inkl. Auto-Archiv-Prompt ⑥Leistung ⑦Regeneration ⑧Geräte) + Overlay-Konsolidierung pro Editor | 5,11 | groß, gut teilbar |
| R3 | **Engine v2 aktivieren**: Shadow-Mode (14 T) → Flag-Umschaltung → UI zeigt Reasons/Confidence → Duplikat-Leser abbauen → Plan-v2 mit Makrozyklus/Zielrückrechnung/Prognoseband | 6,7,8,12,13 | groß, in 4 Stufen |
| R4 | **M11-C Cloud-Vollzyklen** (sports→availability→goals→constraints, je Write+Hydration+Reload+Konfliktregel) + Account-Löschung + Export | 17 | groß, je Section klein |
| R5 | **Datenquellen**: Strava-OAuth-Sync (HR-Fallback, Dedupe) → Garmin-API (Antrag sofort stellen) | 16 | mittel/groß |
| R6 | **Recht/Beta-Härtung**: Impressum, DSE inkl. Gesundheitsdaten-Einwilligung, Offline-/Hilfe-Doku, PWA-Install-Anleitung, Error-Tracking + Feedback, Splash | 21,24,2 | mittel |
| R7 | **Analyse-Premium**: Insights-Kuration (Reason-gespeist), Bodymap-Redesign, FFF-Formkurve auf Tabellen-Lastserie | 12,13,14 | mittel |
| R8 | **KI-Coach** (Edge-Proxy, Reason-Kontext, Guardrails, Budget) | 19 | mittel |
| R9 | **Monetarisierung**: Free/Pro-Schnitt, Stripe, Entitlements; danach Capacitor/Store-Prüfung | 20,22 | mittel |
| M12 | Löschliste: Legacy-Onboarding, HM-Konstanten, tote Karten, ampel-Restleser | quer | klein, laufend |

Reihenfolge-Logik: R0→R1 sofort (sichtbare Qualität + Vertrauen), R3 und R4 sind die beiden strategischen Blöcke und können parallel zu R2 laufen (verschiedene Dateien), R6 MUSS vor jeder Beta-Ausweitung fertig sein, R9 zuletzt. **Ausdrücklich nicht tun:** Ernährung ausbauen, GPS in der PWA, Nav-Big-Bang, KI vor Engine-Aktivierung.
