# Band 2 — Feature-Spezifikationen (Kern-Features bis Launch)

Jede Spezifikation folgt demselben Schema: Nutzerwert → UX-Fluss → technischer Anschluss (konkrete ORVIA-Module aus dem Code-Audit v8-353) → Edge Cases → Evidenz-Leitplanke → Aufwand/Tier/Phase → Definition of Done. Aufwände sind Schätzungen auf Basis der bisherigen Batch-Geschwindigkeit; Modul-/Zeilenangaben sind verifizierte Audit-Befunde.

---

## F1 · Gym-Live-Logger auf Hevy-Niveau

**Nutzerwert:** Der Live-Logger ist der am häufigsten benutzte Screen eines Gym-Nutzers (3–5×/Woche, 45–90 min offen). Hevy/Strong definieren die Erwartung: jede Interaktion ≤ 2 Taps, nie Datenverlust, nie Nachdenken über die App statt übers Training.

**Ist-Stand (verifiziert):** Overlay-Rendering in `workout-ui.js` (860 Z.), Store in `workout-store.js` (712 Z.) mit Offline-Pfad, Satz-Typen vorhanden (`SET_TYPE_DE`), „+ Übung“-Footer (Z. 544), Ersetzen/Entfernen je Übung, Satzpausen-Timer mit +15s/Skip, „Letzte Leistung“-Anzeige (`loadLast`). Der von dir gefundene Bug (Übung im laufenden Workout nicht hinzufügbar) ist im v8-353-Code nicht reproduzierbar — Retest nach Deploy ist Arbeitspaket A.

**Delta zur Messlatte (Neubau in Phase B):**

| Teilfeature | Spezifikation | Anschluss |
|---|---|---|
| Supersets/Dropsets | Übungen gruppierbar (Superset-Klammer in `wo-exnav`); Dropset als Satz-Typ mit gekoppelter Gewichtsreduktion; Pausen-Timer versteht Superset (Pause erst nach letzter Übung der Gruppe) | neues Feld `group_id` an `workoutExercise`; Migration nötig; `fmtSet`/Renderer erweitern |
| 2-Tap-Übungstausch | „Ersetzen“ öffnet Picker bereits vorgefiltert auf gleiche Muskelgruppe/`movement_pattern`; zuletzt-benutzt zuerst (Recent-Logik existiert: `pushRecentExercise`) | `replaceExercise` (Z. 681) + Picker-Filter |
| Plate-Rechner | Tap auf Gewichtsfeld → Sheet „welche Scheiben pro Seite“ (Hantelstange konfigurierbar 20/15 kg) | reine UI, `LOC`-Präferenz |
| Auto-Vorschlag nächster Satz | Eingabefeld vorbefüllt aus letztem Satz gleicher Übung + Progressionsempfehlung (F2), überschreibbar | `loadLast` + F2-Ausgabe |
| Wiederholen-Flow | „Letztes Workout wiederholen“ vom Aktivitäten-Hub (Vorlage inkl. Übungen/Sätze) | `startFromTemplate`-Pfad existiert teilweise (`pres.success`-Zweig, workout-store:179) |

**Edge Cases:** App-Kill mitten im Workout (Store-Recovery existiert — Regressionstest ausweiten) · Offline-Start, Online-Ende (Sync-Konfliktfall in QA-Plan Band 6) · Übung entfernen, die schon Sätze hat (Bestätigung + Sätze bleiben im Log) · Superset über Gerätewechsel.

**Evidenz-Leitplanke:** Keine — reine UX. Aufwand: **~45 h** · Tier: Free (Logging) · Phase B · **DoD:** 10 dokumentierte Kern-Flows je ≤ 2 Taps, Playwright-Smoke je Flow, kein Datenverlust in 3 Abbruch-Szenarien.

---

## F2 · Satzgenaue Progressionsempfehlung

**Nutzerwert:** „Nimm 32,5 kg, Ziel 8 Wdh, RIR 2“ statt Chart-Deutung — der Konkurrenz-Standard (Alpha Progression, Fitbod, JuggernautAI), aber bei ORVIA **erklärbar statt Blackbox** (Fitbods Trustpilot-Debakel ist die Warnung).

**Logik (dreistufig, fail-closed):**
1. **Datenbasis:** letzte 2–4 Leistungen derselben Übung (`activityRepository`/Workout-Historie) + erfasstes RIR (Reliabilität belegt, Lovegrove 2022 — aber nur bei Novizen validiert → Konfidenz anzeigen).
2. **Regelwerk:** Doppelte Progression als Default (erst Wdh. im Zielbereich hoch, dann Last +2,5 %/kleinste Scheibe) — kompatibel mit der Evidenz (Chaves 2024: Last- und Wdh.-Progression gleichwertig bei Anfängern; keine belegte Überlegenheit einer Methode → Default ist Produktentscheidung, so kennzeichnen). Stagnations-Erkennung: 3 Einheiten ohne Fortschritt → Vorschlag Variation/Deload-Hinweis (Heuristik, gekennzeichnet).
3. **Readiness-Modulation (der USP):** niedrige Tages-Readiness → Vorschlag konservativer (Last halten, RIR +1), mit sichtbarer Begründung „heute −1 Satz, weil …“. **Genau das hat kein Gym-Konkurrent.**

**Anschluss:** neues Engine-Modul `strength-progression.js` neben `prescription-factory` (GELESENE_ZIELE-Mechanik wiederverwenden); Ausgabe in Satz-Eingabefeld (F1) + Session-Seite; Wissensregeln (Friedmann-Satzpausen, GYM-HYP-Korridore) fließen als Hinweis, nie als stille Zahl.

**Edge Cases:** Übung erstmalig (keine Historie → Einrichtungs-Vorschlag statt Zahl) · Übungstausch (Historie der Ersatzübung, nicht der Original) · lange Pause (> 4 Wo → Wiedereinstiegs-Abschlag, als Heuristik gekennzeichnet — Rampenraten sind unbelegt, Studienbibliothek §6) · Einseitige Übungen/Zusatzgewicht.

**Evidenz-Leitplanke:** Jede Empfehlung trägt Herkunft (`historie`/`heuristik`/`wissen:<regel>`) — konsistent mit dem bestehenden Flag-System (`exercises_aus_wissen`). Aufwand: **~50 h** · Tier: **Pro** · Phase B · **DoD:** Vertragstest „keine Empfehlung ohne Herkunft“, 15 Szenario-Tests, Shadow-Vergleich 2 Wochen Eigenbetrieb.

---

## F3 · Ausfall- und Krankheitslogik (sichtbare Plan-Neuberechnung)

**Nutzerwert:** Das meistgelobte Feature adaptiver Konkurrenz (Runna, Humango, enduco): Leben passiert, Plan reagiert — sichtbar und begründet.

**Auslöser & Reaktion:**

| Auslöser | Erkennung | Reaktion |
|---|---|---|
| Einheit verpasst | geplant + nicht absolviert + Tag vorbei | Kernreiz? → Umplanungsvorschlag in Restwoche (Policy-Regeln aus `week-plan-policy` wiederverwenden); flexibel? → ersatzlos, Wochenziel neu ausweisen |
| Krankheit gemeldet | Check-in-Flag / Beschwerde-Eintrag | Plan pausieren, Wiedereinstieg gestaffelt (konservative Heuristik, gekennzeichnet — belegte Rampenraten existieren nicht), Safety-Hinweis bei Fieber (Wellness-Formulierung! MDR-Leitfaden Band 7) |
| Mehrere rote Readiness-Tage | bestehende Decision-Kette | Intensitätsreduktion der Folge-Einheiten mit Begründungskarte |

**UX:** Karte „Dein Plan wurde angepasst“ auf dem Dashboard (bestehendes Modulsystem, `ALLMOD`-Eintrag) mit Vorher/Nachher und „Warum“-Aufklapper — die Transparenz-Mechanik unterscheidet ORVIA von Runnas stillem Umbau.

**Anschluss:** `week-plan-designer`/`week-plan-policy` (live), `logWeekDecision`-Kette (existiert — Entscheidungslog wird zur Begründungsquelle), nach Engine-v2-Aktivierung `scheduler-v2`-Pfad. **Wichtig:** erst nach E1/E2 bauen, sonst doppelte Logik in v1 und v2.

**Edge Cases:** Rückwirkendes Nachtragen einer „verpassten“ Einheit · Krankheit endet mitten in der Woche · Wettkampf in < 14 Tagen (Taper-Schutz — Taper-Korridore sind belegt, Band Studienbibliothek).

Aufwand: **~40 h** · Tier: **Pro** (Basis-Hinweis Free) · Phase B · **DoD:** 8 Szenario-Tests, jede Anpassung im Entscheidungslog, keine Anpassung ohne sichtbare Begründung.

---

## F4 · Ziel-Detailseite mit Machbarkeit (aus Prototyp P2)

**Ist:** klickbarer Prototyp fertig (`.gd-*`-Präfixe, GM-Tokens); `goal-feasibility.js` (573 Z.) fail-closed gebaut, **null Produktiv-Leser**; blockiert durch Ziel-SSOT (B1/B5).

**Spezifikation:** Zielkopf (Zielwert, abgeleitete Pace, Countdown) · Machbarkeits-Verdikt mit Evidenzliste (nur bei ausreichender Datenlage — `insufficient_data` wird ehrlich angezeigt, nie Fantasie-Prognose; Abgrenzung zu Runna/Strava) · „Was der Plan daraus macht“ (Einheiten mit Einzahlungs-Anteil — erfordert Zielobjekt im Planner, E1) · Stellschrauben mit quantifiziertem Effekt **erst wenn** Prognosemodell validiert ist (Phase E, nicht zum Launch versprechen) · Ziel bearbeiten mit Auswirkungsvorschau.

**Anschluss:** `mainGoalOf()` (E1), `goal-feasibility`, `goal-portfolio.buildPortfolio()` (fertig, shadow) für Budgetanteile, Prototyp-HTML als verbindliche Spec.

**Edge Cases:** Ziel ohne Datum (keine Periodisierung — Warnung wie im Prototyp) · Zielwechsel mitten im Block · 2 Hauptziele mit Konflikt (Konflikterkennung existiert in goal-portfolio).

Aufwand: **~55 h** (inkl. Onboarding-Zielwert-Strecke) · Tier: **Pro** (Free sieht Karte + Verdikt-Teaser) · Phase B · **DoD:** fail-closed-Verhalten getestet (jede fehlende Datenlage → ehrlicher Zustand), Prototyp-Parität dokumentiert.

---

## F5 · Readiness-Tiefe + Klartext-Erklärung (Pro-Schnitt)

**Free:** Score + Statusfarbe + 1 Satz („Solide erholt — normales Training ist sinnvoll“). **Pro:** Faktoren-Aufschlüsselung (signierte Beiträge), Baseline-Abweichung, Konfidenz, 14-Tage-Verlauf, „Warum“-Text mit Quellen-Verweis auf die Wissensschicht.

**Evidenz-Leitplanke (hart):** Kein validierter Composite-Score existiert in der Literatur; objektive und subjektive Marker korrelieren nicht → ORVIA zeigt Domänen **getrennt** (Körpersignale vs. subjektives Empfinden), gewichtet transparent, nennt Konfidenz — und formuliert nie „HRV sagt, du darfst nicht trainieren“. Verbotene Formulierungen: Band 7 MDR-Leitfaden. Datenlücke ≠ schlechter Score (bestehendes Prinzip beibehalten).

**Anschluss:** `readiness-engine-v2` + `decision-engine-v2` (Schatten → aktiv, E2), Score-Sheet existiert im Dashboard; Pro-Gating über Entitlement (F7).

Aufwand: **~25 h** (Engine steht; Arbeit = Tiefen-UI + Gating + Texte DE/EN) · Phase B/C · **DoD:** jeder Faktor rückverfolgbar bis Rohsignal, Konfidenz sichtbar, Formulierungsaudit bestanden.

---

## F6 · Workout-Push auf die Garmin-Uhr

**Ist:** `garmin-worker /workout/push` gebaut, hinter Gates G1/G3 gesperrt (numerische Sport-ID und reps-Abbruch unbelegt, `weightValue` abgewiesen) — die Gates sind korrekt, die Freischaltung braucht die **offizielle Training API** (Antrag Phase C, Umstellung E).

**Spezifikation:** Geplante Einheit → „An Uhr senden“ (Session-Seite + Pre-Start) · Struktur: Warm-up/Intervalle/Cool-down mit Zonen aus F5/E7-Zonenmodell · Statusrückmeldung (gesendet/auf Uhr/absolviert) · Nach Absolvierung: automatischer Abgleich geplant↔ist (Kette existiert über Activity-Import).

**Edge Cases:** Uhr offline · Einheit nach Senden geändert (Re-Push mit Versionierung) · Nutzer ohne Garmin (Feature unsichtbar, kein toter Button — bestehendes „ohne Vertrag: Slot sichtbar, Wert —“-Prinzip gilt hier NICHT, weil kein Datenvertrag existiert; Feature ganz ausblenden).

Aufwand: **~30 h** nach API-Zugang (Worker-Logik existiert) · Tier: **Pro** · Phase E · **DoD:** Device-Test-Protokoll auf realer Uhr (dein Gerät), Gate-Aufhebung nur mit dokumentiertem Testlauf je Sportprofil.

---

## F7 · Abo-Integration (Free/Pro-Gating in der App)

**Architektur:** RevenueCat-Entitlement `pro` als einzige Wahrheit; Capacitor-Plugin liefert Status → `ORVIA.entitlements`-Modul (neu, ~1 Datei) cached mit Offline-Grace (72 h) · Gating **deklarativ**: jedes Pro-Feature prüft `entitlements.has('pro')` an genau einer Stelle je Feature (kein verstreutes if) · Free-Zustände sind designte Zustände (Teaser-Karte mit echtem Mehrwert-Vorgeschmack), keine kaputten Screens — Konsistenz mit dem „keine Scheineinstellung“-Prinzip · Paywall-Screen nativ (RevenueCat Paywalls oder eigen, GM-Design) an 4 Kontaktpunkten: Onboarding-Ende (nach Aha-Moment, nicht davor), Ziel-Detail-Teaser, Historie-Grenze, Readiness-Tiefe.

**Edge Cases:** Kauf auf iOS, Nutzung auf Android (RevenueCat-App-User-ID = Supabase-User-ID) · Refund/Ablauf (Downgrade-Verhalten definiert: Daten bleiben, Pro-Ansichten sperren) · Family Sharing aus (v1) · Founder-Lifetime als Non-Consumable mit eigenem Entitlement-Mapping.

**Web-Sonderfall:** Die PWA bleibt parallel erreichbar — dort **kein Verkauf** (Apple-Konformität), nur Login + Nutzung vorhandener Entitlements.

Aufwand: **~50 h** inkl. Sandbox-Testmatrix (Band 6) · Phase C · **DoD:** 8 RevenueCat-Testfälle grün, Entitlement-Ausfall degradiert zu Free (nie zu Fehler), Restore-Purchases funktioniert.

---

## F8 · Onboarding v3 mit Aha-Moment

**Ist:** Drei-Stufen-Architektur angelegt (`onboarding-logic.js`, 9 aktive + 8 inaktive Schritte), Prototyp mit 11+ Schritten fertig (`.ob2-*`).

**Kernprinzip:** Time-to-Value < 3 Minuten. Reihenfolge: Sportarten → Ziel **mit Zielwert** (B5-Fix) → Verfügbarkeit → sofort **erster Wochenplan sichtbar** (der Payoff-Moment, heute fehlt er: `orvia:onboarding-completed` erzeugt keinen Plan) → optionale Tiefe (Leistungswerte, Gesundheit) danach, überspringbar mit ehrlicher Konsequenz-Anzeige („ohne Wert: Schätzung“ — Profilstärke-Mechanik aus P2). Wearable-Verbindung als eigener Schritt mit „später“-Option. Paywall **nach** dem ersten Plan, nicht davor (Benchmark-Begründung Band 4).

**Edge Cases:** Abbruch mittendrin (Wiedereinstieg am Schritt, Persistenz existiert seit A0-Fix) · Bestandsnutzer nach Update (kein erneutes Onboarding, Delta-Abfrage nur Zielwert) · EN-Texte (i18n von Anfang an in den neuen Schritten).

Aufwand: **~45 h** · Phase B · **DoD:** Funnel-Messpunkte je Schritt (KPI-System Band 8), Abbruchquote je Schritt < 15 % in Beta, Plan am Ende in 100 % der Test-Durchläufe.

---

## F9 · Konto-Löschung + Consent-Flow (Compliance-Feature)

**Konto-Löschung (Apple-Pflicht 5.1.1(v)):** In-App unter Konto & Sicherheit → zweistufige Bestätigung → Supabase Edge Function: `auth.admin.deleteUser` + kaskadierende Datenlöschung über alle 18 Tabellen (Löschkonzept Band 7) + Storage (Avatar-Bucket) + RevenueCat-Löschung → Bestätigungs-Mail. Soft-Delete-Fenster 14 Tage (Wiederherstellung), dann endgültig — im Löschtext transparent.

**Consent-Flow (Art. 9):** vor erster Gesundheitsdaten-Verarbeitung eigener Screen-Stack (Spezifikation + Textbausteine Band 7): Basis-Konto / Gesundheitsdaten-Verarbeitung (Pflicht für Kernfunktion, ehrlich gesagt) / Wearable-Sync (optional, je Anbieter) / Analytics (optional, default aus). Widerruf jederzeit in Datenschutz-Einstellungen; Widerruf Gesundheitsdaten = Funktionsverlust klar benannt. Persistenz in `consents`-Tabelle (existiert im Schema).

Aufwand: **~35 h** · Phase C · **DoD:** Löschung in Sandbox End-zu-End verifiziert (kein Orphan-Datensatz — SQL-Prüfskript), Consent-Zustände im Backend nachvollziehbar, RLS-Test für consents.

---

## F10 · i18n (DE+EN)

**Ansatz für Vanilla JS ohne Build-Schritt:** zentrale `i18n.js` mit Schlüssel-Katalogen `de.json`/`en.json`, Hilfsfunktion `t('key', params)`; Extraktion **modulweise entlang der GM-Sektionen** (nicht big-bang — ui.js hat 12.300 Zeilen; Reihenfolge: neue Features ab sofort nur mit t(), dann GM1–GM5 rückwirkend, Legacy-Bereiche zuletzt/nie, da GM7-Abbau sie entfernt). Pseudo-Locale-Test (Band 6) als Schutznetz gegen vergessene Strings; Zahlen-/Datums-/Einheitenformate (km vs. mi!) über `Intl`; Store-Metadaten + Rechtstexte + Wissens-Hinweise als eigene Übersetzungspakete (Wissens-Hinweise: fachliche Übersetzung, nicht maschinell ungeprüft — Evidenztexte sind Produktkern).

Aufwand: **~60 h** verteilt über B/C (größter Einzelposten neben Capacitor — der Preis der DE+EN-Entscheidung) · **DoD:** Pseudo-Locale ohne Roh-Strings in den 5 GM-Bereichen, EN-Review durch Muttersprachler oder KI+Stichproben-Gegenlesen, Einheiten-Umschaltung getestet.

---

## Aufwands-Summe der Spezifikationen

| Feature | h | Phase | Tier |
|---|---|---|---|
| F1 Gym-Logger | 45 | B | Free |
| F2 Progression | 50 | B | Pro |
| F3 Ausfall-Logik | 40 | B | Pro |
| F4 Ziel-Detail | 55 | B | Pro |
| F5 Readiness-Tiefe | 25 | B/C | Pro |
| F6 Garmin-Push | 30 | E | Pro |
| F7 Abo/Gating | 50 | C | — |
| F8 Onboarding v3 | 45 | B | Free |
| F9 Löschung/Consent | 35 | C | — |
| F10 i18n | 60 | B/C | — |
| **Summe** | **435 h** | | |

Die Summe passt zur Kapazität der Phasen B+C (~500 h inkl. Puffer) **nur**, weil Engine-Arbeit (E1–E3, in Band 1 budgetiert) und Feature-Arbeit sich Pakete teilen — die Detailabstimmung leistet der Sprint-Plan in Band 1. Cut-Linie bei Zeitnot (Reihenfolge des Streichens): F6 (ohnehin E), F3-Teilumfang (nur Verpasst-Fall, Krankheit später), F1-Plate-Rechner. **Nie streichen:** F7, F9, F10 (Launch-Blocker), F8 (Conversion-kritisch).
