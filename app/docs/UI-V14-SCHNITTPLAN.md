# ORVIA · Schnittplan Prototyp v14 → App (Option C: Look **mit** Verknüpfung, Screen für Screen)

Stand: 12.09.2026 · Referenz: `Downloads/ORVIA-Prototyp-Profil-Ziele-Community-v14.html` (22.08.2026, 5.406 Zeilen, 483 KB; Design-Tokens 1:1 aus `app/styles.css`, GM7-Ebene).
Vorgänger: `UI-V5-MIGRATION-PLAN.md` / `GOLDEN-MASTER-MAPPING.md` (v5-Prototyp, Juli — Dashboard, Plan, Aktivität, Analyse, Shell sind danach gebaut, Tests `gm1`–`gm7`).

## 0 · Entscheidung und Regel

**Entscheidung 12.09.:** kein „UI zuerst, Verknüpfung später" (jeder Screen zweimal, monatelang Attrappen), sondern **vertikale Schnitte**: ein Screen = Look aus v14 + alle Zustände (leer/laden/Fehler/offline/Datenlücke) + echte Datenquelle + Test → deploy → nächster Screen. B-13 (i18n) ist eingefroren (Stand grün, Katalog bleibt), B-10/B-11 (Engine-Canary) geparkt bis Schnitt 3.

**Regel je Schnitt:** Der Screen zeigt nur, was wirklich da ist; sonst der Leerzustand aus dem Prototyp („Datenlücke ≠ Wert"). Kein Wert aus dem Prototyp (Demo-Zahlen) landet im Code. Neue Renderer kommen in `js/screens/<name>.js` (nicht in ui.js); ui.js verliert je Schnitt den alten Renderer.

## 1 · Inventar Prototyp v14 ↔ App

| v14-Screen / Fläche | Prototyp-Kennung | App heute | Datenquelle (vorhanden?) | Lücke | Schnitt |
|---|---|---|---|---|---|
| Profil · Tab **Über** (Sportarten, Saison im Überblick, Zielreise, Kennzahlen) | `ptUeber` | Profilzentrale (`profile-center.js`) — andere Struktur, keine Saisonleiste, keine Zielreise | Sportarten ✅, Phasen `Calc.racePhases`/goal-plan-input ✅, Wochen-km/ACWR ✅ | Layout, Saisonleiste, Zielreise-Karte | **S1** |
| Profil · Tab **Ziele** (Aktiv/Erreicht/Konflikte, Karten mit Prognose + Planwirkung, Neues Ziel) | `ptZiele` | Modal „Ziele verwalten" (Screenshot 12.09.) | Ziele ✅, Prognose (Feasibility) ✅, Konflikte ✅, „% Wochenvolumen" ❌ (Engine liefert keine Zielanteile) | Modal → Tab; Zielanteil = Leerzustand oder Engine-Erweiterung | **S1** |
| Profil · Tab **Leistung** (VO₂max, Fitness, ACWR, Bestzeiten, Kraftwerte, HFmax, Ruhepuls, Schwellenpace) | `ptLeistung` | verteilt: Profilzentrale/Analyse | metric-resolver, run-bests, Kraftwerte ✅, Schwellenpace (abgeleitet) ✅ | Zusammenführung, Herkunfts-Badges | **S1** |
| Profil · Tab **Community** | `ptKomm` | — | — | ganz | S7 (Tab bis dahin ausgeblendet) |
| Sheet **Neues Ziel** (Kategorie → Ziel → Wert/Datum → Priorität, ein Sheet) | `shNewGoal` | 7-Schritt-Wizard `openGoalEditor` | ✅ | **Entscheidung:** Sheet ersetzt Wizard oder Wizard bleibt für Spezialfälle | **S1** |
| Sheet **Ziel bearbeiten** (mit „Auswirkung dieser Änderung") | `shEditGoal` | Wizard | Auswirkung: planKey-Vergleich (B-01) ✅ | Sheet + Auswirkungszeile | **S1** |
| Seite **Ziel-Detail** | `pgGoal` | ✅ B-02 (`goal-detail.js`, aus diesem Prototyp) | ✅ | Sichtprüfung | S1 (Abgleich) |
| Seite **Profilstärke** | `pgStrength` | ✅ B-03 (Karte in Profilzentrale) | ✅ | eigene Seite mit Vorhanden/Geschätzt/Fehlt-Gruppen | S6 |
| Seite **Sichtbarkeit** (Feld für Feld) | `pgVis` | — | ❌ Datenmodell fehlt (Spalten/Tabelle + RLS) | Backend + Seite | S6 |
| Seite **Einstellungen** (Darstellung, Detailtiefe, Community, Konto) | `pgSettings` | Teile in Profilzentrale/Account-Karte | ✅ (Theme, Detailtiefe, Export/Löschen) | Zusammenführung | S6 |
| **Kraftprofil** (1RM-Verlauf, Muskelkarte, Progression) | `scrStr`/`kpRender` | Muskelkarte ✅ (`gymVolume`), Kraftwerte im Profil | strength-progression, gym-volume, 1RM-Schätzung ✅ | eigene Seite | **S2** |
| **Plan** (Planvariante, Diese Woche, Wochenblättern) | `scrPlan`/`planRender` | ✅ GM2 | ✅ | Delta-Abgleich v5→v14 (Planvariante A/B/C = Engine-Erweiterung, ohne Engine als Leerzustand) | S3 |
| Sheet **Schnellstart** (Einheit starten / schnell eintragen / Neues Ziel / Beitrag teilen) | `shQuick` | Quick-Actions (FAB) ✅ | ✅ | Delta; „Beitrag teilen" erst S7 | S3 |
| **Dashboard** (Hero, Adaptive, Check-in, Module, Race-Karte, Debrief-Teaser) | `scrDash` | ✅ GM1/GM6 | ✅ inkl. Adaptive-Karte | Delta-Abgleich | S4 |
| **Score-Seite** | `pgScore` | Score-Sheet | ✅ | Delta | S4 |
| **Debrief** (Zählt voll/teilweise/frei/ohne HF/Gym) | `scrDebrief` | ✅ `gmOpenDebriefAt` + session-debrief | ✅ | Look, fünf Fälle als Zustände | S5 |
| **Rückblick** (Woche/Monat) | `scrReview` | ✅ Wochenreview-Sheet auf dem Plan-Tab | ✅ | Look, Monatsansicht | S5 |
| **Pace-/Wettkampfrechner** | `scrRace`/`rcRender` | ✅ seit v8-219 (`gmProfPaceCalc`) | ✅ | Delta (Wetter-Zeile nur mit Quelle) | S5 |
| **Spotlight** (Erstnutzer-Tour) | `spot*` | teilweise (coachmarks) | — | Delta | S4 |
| **Aktivitäten** | `scrActs` | ✅ GM3 | ✅ | Delta | S3 |
| **Onboarding v2-Look** | `ob2` | ✅ übernommen (86 CSS-Regeln, `onboarding-ui.js`) | ✅ | Rest = B-04 §2 (Leistungs-Schritt, 6 IDs streichen) | B-04 |
| **Community**: Feed, Athleten finden, Follower, Fremdprofil, Reaktionen, Gruppen-Challenge, Flyby | `scrFeed`, `scrDisc`, `pgFollowers`, `pgOther` | — | ❌ komplett neu: `profiles_public`, `follows`, `feed_items`, Reaktionen, Sichtbarkeit je Feld, RLS; Karten-Unkenntlichmachung | Backend-Paket + 4 Screens; **Datenschutz** (Gesundheitsdaten) | S7 |
| **Tabbar v14**: Dashboard · Plan · Aktivität · **Community** · Profil (Analyse → in Dashboard/Profil) | `tabbar` | Dashboard · Plan · Aktivität · Analyse · Profil | — | **Entscheidung:** Analyse-Tab weicht Community erst mit S7 | S7 |

## 2 · Reihenfolge (nach täglicher Nutzung × sichtbarem Wert × Datenlage)

| # | Schnitt | Warum jetzt | Aufwand | DoD |
|---|---|---|---|---|
| **S1** | **Profil (Über/Ziele/Leistung) + Ziel-Sheets** | Der Screenshot vom 12.09. ist dieser Screen; Daten sind komplett vorhanden; ersetzt das älteste Modal der App | 10–14 h | Profil-Tab = v14-Struktur; „Ziele verwalten"-Modal entfernt; Neues Ziel/Bearbeiten als Sheet mit Auswirkungszeile; alle Leerzustände; Tests je Tab; Sichtprüfung am Gerät |
| **S2** | **Kraftprofil-Seite** | Gym-Strang ist live, Engines (1RM, Progression, Muskelvolumen) liegen brach ohne Seite | 6–8 h | Seite aus Profil/Leistung erreichbar, nur echte Sätze/1RM, Leerzustand ohne Gym-Historie |
| **S3** | **Plan-Tab + Schnellstart** Delta v14 | Täglich genutzt; Planvariante = Leerzustand, bis Engine Varianten liefert | 8–10 h | Delta-Liste abgearbeitet, `gm2_plan_parity` gegen v14 |
| **S4** | **Dashboard + Score** Delta v14 | Täglich genutzt, aber schon GM-migriert — kleinstes Delta | 4–6 h | `gm1`/`gm6` gegen v14 |
| **S5** | **Debrief + Rückblick + Rechner** Look | Hohe Nutzung nach jeder Einheit | 8–10 h | fünf Debrief-Fälle als Zustände; Monatsrückblick |
| **S6** | **Sichtbarkeit + Profilstärke-Seite + Einstellungen** | Voraussetzung für S7 (Sichtbarkeit ist das Datenmodell der Community) | 6–8 h + Migration | Sichtbarkeit je Feld persistent (Tabelle + RLS), Vorschau „so sieht dich ein fremder Athlet" |
| **S7** | **Community** | Größtes Paket, eigenes Backend, Datenschutzentscheidungen | 30–40 h | eigener Umsetzungsplan vorab (Tabellen, RLS, Missbrauch, Karten-Unkenntlichmachung, Reaktionen) |

Summe S1–S6 ≈ 42–56 h autonom + je Schnitt 5–10 min Sichtprüfung von dir. S7 separat entscheiden.

## 3 · Offene Entscheidungen (Gian)

1. **Ziel-Editor:** v14-Sheet (ein Bildschirm) ersetzt den 7-Schritt-Wizard — oder Wizard bleibt für Spezialkategorien (Fußball, Custom)? Empfehlung: Sheet als Standard, Wizard nur über „Mehr Optionen".
2. **„% Wochenvolumen" je Ziel** (v14 zeigt es auf jeder Zielkarte): Engine liefert heute keine Zielanteile. Leerzustand („wird berechnet, sobald der Planer Anteile ausweist") oder Engine-Erweiterung in S3?
3. **Community-Umfang** (S7): jetzt mitplanen oder nach S6 neu bewerten? Berührt Gesundheitsdaten Dritter, Standort (Flyby), Moderation. Empfehlung: nach S6 entscheiden, dann eigener Plan.
4. **Referenzstand:** v14 vom 22.08. — gibt es eine neuere Fassung?

## 4 · Technischer Rahmen je Schnitt

- Renderer in `js/screens/<name>.js` (IIFE, `ORVIA.screens.<name>`), Daten ausschließlich über bestehende Stores/Engines; ui.js gibt den alten Renderer ab (Funktion bleibt als Weiche, ruft das Modul).
- CSS additiv unter Präfix (`.pf2-*`, `.kp-*`, …), Tokens unverändert (v14 = App-Tokens).
- Tests: Mini-DOM-Test je Screen (Muster `goals_manager_list_test`), Zustandstest (leer/laden/Fehler/Datenlücke), Paritätstest gegen v14-Markup-Struktur (Muster `gm2_plan_parity`).
- Texte über `t()` (Katalog ist da; neue Screens von Anfang an ohne Literale).
- Ein Schnitt = ein Deploy (`v8-3xx`), Sichtprüfung am Gerät vor dem nächsten.
