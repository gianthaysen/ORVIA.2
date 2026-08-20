# ORVIA Masterplan — vom heutigen Stand zum marktfähigen Produkt

Stand: 15.08.2026 · Planungsannahmen: 15–25 h/Woche (gerechnet mit 20 h), zweisprachig DE+EN ab Launch, Capacitor-Wrapper für die Stores. Alle Marktzahlen sind recherchiert und mit Quellen belegt (Recherche-Stand August 2026); alle App-Befunde stammen aus dem Code-Audit v8-353.

---

## 1 · Kernergebnis und Realitätscheck

**ORVIA hat eine echte, belegbare Marktlücke — aber der Weg zum Ziel führt über Meilensteine, nicht über das Endziel.**

Die Marktlücke ist real und in der Konkurrenzanalyse präzise belegt: **Niemand rechnet Ausdauer-Last und Kraft-Last in ein gemeinsames Belastungs-/Readiness-Modell, das beide Planarten steuert.** Ausdauer-Apps mit Readiness (Whoop, enduco, AI Endurance) haben keine ernsthafte Gym-Progression; Gym-Apps mit exzellenter Progression (Hevy, Alpha Progression, JuggernautAI) ignorieren HRV/Schlaf/Ausdauerlast komplett — Hevys fehlender Recovery-Input wird in Reviews explizit als Lücke benannt. Der einzige echte Multi-Sport-Coach (Humango) gilt als überladen und teuer. Dazu kommt ein Timing-Rückenwind: Garmin hat 2026 TrainingPeaks und JOIN aufgekauft und verärgert mit der Connect+-Paywall die eigene Community — Nachfrage nach unabhängigen, ehrlichen Tools wächst. ORVIAs „ehrliche Evidenz“-Philosophie (fail-closed, keine Scheinwerte, Quellen hinter jedem Hinweis) ist exakt der Kontrast zu den kritisierten Black-Box-Algorithmen (Fitbod „algorithm is broken“, Runna-Verletzungsdebatte).

**Realitätscheck 500-Mio.-€-Unternehmen — ehrlich, weil du es so willst:** Ein Unternehmenswert von 500 Mio. € entspricht bei üblichen Bewertungsmultiples (5–10× Umsatz) einem ARR von 50–100 Mio. € — das ist die Liga von Whoop (~1,1 Mrd. $ ARR, 10 Mrd. $ Bewertung) und oberhalb von Strava (~490 Mio. $ ARR). Die RevenueCat-Daten über 115.000 Apps zeigen: nur ~17 % aller neuen Apps erreichen überhaupt 1.000 $ MRR, nur ~4,6 % erreichen 10.000 $ MRR, deutlich unter 1 % erreichen 1 Mio. $ ARR. **Das heißt nicht, dass das Ziel falsch ist — es heißt, dass kein seriöser Plan „bis 500 Mio. €“ durchplanen kann.** Seriös planbar ist der Weg bis ~10k € MRR (als Solo-Entwickler nachweislich erreichbar, ~2.100 zahlende Abonnenten); jeder Meilenstein danach ist eine neue Entscheidungssituation (Investoren? Team? B2B-Pivot?), die man erst mit den Daten des vorherigen Meilensteins gut treffen kann. Genau so planen Profis: **Meilenstein-Gates statt Endzustands-Fantasie.** Dieser Plan führt dich konkret bis Meilenstein M3 und skizziert M4–M6.

| Meilenstein | Definition | realistischer Zeitpunkt (20 h/Wo) |
|---|---|---|
| **M1 — Produktkern fertig** | Ziel→Plan-Kette geschlossen, Engine v2 aktiv, Gym-UX auf Hevy-Niveau, DE+EN | ~Feb. 2027 |
| **M2 — Store-Launch** | App Store + Play Store live, Free/Pro-Abo funktioniert, rechtlich sauber | ~Mai 2027 |
| **M3 — Tragfähigkeit** | 1.000–2.000 zahlende Abos ≈ 5–10k € MRR | 2027/2028 (abhängig von Distribution) |
| M4 — Wachstum | 100k € MRR ≈ 21.000 Zahler — erfordert Top-1-%-Distribution, vermutlich Team/Kapital | offen |
| M5 — B2B-Skalierung | Coach-/Team-Tier, Corporate-Kanäle | nach M3 |
| M6 — 500-Mio.-Pfad | 50–100 Mio. € ARR — erfordert Fremdkapital, Team, vermutlich Hardware- oder Plattform-Play | Option, kein Plan |

---

## 2 · Lernteil: Wie Großprojekte professionell geplant werden

Da du das explizit lernen willst — das ist das Handwerkszeug, nach dem dieser gesamte Plan aufgebaut ist:

1. **Discovery vor Delivery.** Erst verstehen (Ist-Zustand, Markt, Nutzer, Evidenz), dann bauen. Deine Metaanalyse + Studienbibliothek + diese Konkurrenzanalyse sind die Discovery-Phase. Der häufigste Anfängerfehler ist, diese Phase zu überspringen und 6 Monate das Falsche zu bauen.
2. **Meilenstein-Gates statt Wasserfall.** Jede Phase endet mit einem prüfbaren Gate („Suite grün + Live-Abnahme“, „100 Beta-Tester, D30-Retention > 8 %“). Erst wenn das Gate steht, wird die nächste Phase begonnen — du kennst das Prinzip bereits aus deinen Berichts-Gates. Große Projekte scheitern selten an schlechten Ideen, meist an übersprungenen Gates.
3. **Kritischer Pfad.** Nicht alles ist gleich dringend. Der kritische Pfad ist die Kette von Aufgaben, deren Verzögerung das Ganze verzögert — hier: Ziel→Plan-Kette → Engine-Aktivierung → Capacitor → Store-Review. Alles andere (Community, B2B, weitere Wearables) ist parallelisierbar oder verschiebbar.
4. **Priorisierung mit RICE** (Reach × Impact × Confidence ÷ Effort): Jedes Feature bekommt eine Zahl statt eines Bauchgefühls. Die Tier-Tabelle in §5 ist so priorisiert.
5. **North-Star-Metrik.** Eine Zahl, an der alle Entscheidungen gemessen werden. Für ORVIA empfohlen: **Wochenaktive Nutzer mit ≥ 2 geloggten Einheiten** (WAU-2) — sie verbindet Nutzung, Nutzen und Abo-Wahrscheinlichkeit. Umsatz ist eine Folge, keine Steuergröße.
6. **Budget in drei Dimensionen:** Zeit (20 h/Wo = ~85 h/Monat — die härteste Grenze), Geld (§12: < 1.000 € bis Launch), Aufmerksamkeit (max. 1–2 parallele Baustellen, sonst leidet alles).
7. **Build–Measure–Learn.** Nach dem Launch zählt Lerngeschwindigkeit: jede Woche eine Hypothese („Onboarding-Schritt X kostet 20 % Abbrecher“), messen, anpassen. Die Conversion-Benchmarks in §10 sind deine Vergleichslatte.
8. **Risiken aktiv führen** (§13): Ein Risiko, das aufgeschrieben und mit Gegenmaßnahme versehen ist, ist ein Planungselement. Eines, das ignoriert wird, ist eine Zeitbombe.

---

## 3 · Ist-Zustand-Inventar

Legende: ✅ vorhanden und tragfähig · 🔧 vorhanden, verbessern · 🔗 gebaut, aber nicht verknüpft/aktiviert · 🐛 fehlerhaft · ❌ fehlt

| Bereich | Status | Detail | Phase |
|---|---|---|---|
| Dashboard (modular, 3 Stufen, Score-Ring, Body Battery) | ✅ | live, ausgereift, Zustandssystematik vorbildlich | — |
| Tabs Plan/Aktivitäten/Analyse/Profil (GM-Renderer) | ✅ | inkl. Planvarianten A/B/C, Muskelkarte, Bestzeiten | — |
| Wochenplan ← Ziel (B1) | 🔗 | liest nur Kategorie (ui.js:275); targetValue/targetDate ungenutzt | A |
| Engine v2 (Readiness/Decision/Scheduler/Prescription) | 🔗 | komplett gebaut, shadow-only; Aktivierungspfad dreifach gesichert vorhanden | B |
| Resolver-Schlüssel (B4) | 🐛 | training-input-resolver.js:521 — 2-Zeilen-Fix | A |
| Onboarding-Zielwert (B5) | 🔗 | Schritt `goals_detail` gebaut, aber inaktiv | A |
| knowledge_targets_test | 🐛 | ROT (4 QUELLE-14-Ziele fehlen im Vokabular) | A |
| **Gym: Übung in laufendem Workout hinzufügen** | 🐛 | Dein Befund. Im Code v8-353 existiert der „+ Übung“-Footer-Button (workout-ui.js:544 → addExercise-Kette komplett bis workoutRepository). **Live läuft aber v8-343.** Diagnose: erst Deploy-Bündel ausliefern, dann erneut testen; falls es weiter scheitert, liefert der Fehler-Toast (humanErr) die Ursache | A |
| Deploy-Rückstand | 🐛 | 10 Versionen (v8-344…353) nicht veröffentlicht — wahrscheinliche Ursache mehrerer „Bugs“ | A |
| CI / Branch-Schutz | ❌ | 268 Tests laufen nur manuell; Force-Push-Gefahr | A |
| Gym-Logger-UX (Auto-Fill, Supersets, Satz-Typen) | 🔧 | Grundfunktionen da; Hevy-Standard (Auto-Fill letzte Werte ✅, Supersets/Dropsets ❌, Plate-Rechner ❌) ist die Messlatte | B |
| Satzgenaue Progressionsempfehlung („2,5 kg mehr“) | ❌ | Konkurrenz-Standard (Alpha Progression, Fitbod); ORVIA hat die Bausteine (RIR, Wissen, Historie) — Evidenzgrenze beachten (keine belegten Korridore je Muskelgruppe) | B |
| Plan-Neuberechnung bei verpassten Einheiten/Krankheit | 🔧 | Woche-für-Woche-Generierung existiert; explizite Krankheits-/Ausfall-Logik als sichtbares Feature fehlt (meistgelobtes Feature adaptiver Konkurrenz) | B |
| Workouts auf Garmin-Uhr pushen | 🔗 | garmin-worker `/workout/push` gebaut, aber hinter Gates gesperrt; ohne das gilt Garmin-Sync im Markt als halbfertig | C/E |
| Garmin-Datenimport | 🔧 | läuft über inoffizielle API (Cloudflare-blockiert, fragil); offizieller API-Antrag nötig | C→E |
| Wissens-/Evidenzschicht (Vertrag v7, Hinweise mit Quellen) | ✅ | Alleinstellungsmerkmal; 30/30 Ziele kommen an | — |
| Ziel-Detailseite, Profilstärke, Onboarding v3 | 🔗 | Prototyp fertig, wartet auf Ziel→Plan-Kette | B |
| Community/Social | ❌ | Greenfield, bewusst nach hinten | F |
| Englisch-Lokalisierung | ❌ | App ist rein deutsch; i18n-Struktur fehlt | B/C |
| Konto-Löschung in der App | ❌ | Apple-Pflicht 5.1.1(v) — ohne sie keine Freigabe | C |
| Abo/Bezahlung (IAP) | ❌ | RevenueCat + StoreKit/Play Billing | C |
| Rechtliches (Impressum, DSE, AVV, Consent Art. 9) | ❌ | Platzhalter; vor Beta Pflicht | C |
| Gewerbe/Steuern | ❌ | vor ersten Einnahmen Pflicht (als Azubi: Nebentätigkeit anzeigen) | A |

---

## 4 · Konkurrenz: die wichtigsten Lehren (Vollanalyse in der Recherche dokumentiert)

**Preisanker (verifiziert, 2025/26):** Gym-Logger 24–60 €/Jahr (Hevy 23,99 $, Alpha Progression 59,99 €) · Insight-Abos 70–87 €/Jahr (Strava ~75 €, Garmin Connect+ ~87 €) · adaptive Coaches 100–135 €/Jahr (Runna 119,99 $, JOIN 119,99 €, TrainingPeaks 134,99 $) · Multi-Sport-Premium bis 265 $/Jahr (Humango) · Kraft-Spezialist 349 $/Jahr (JuggernautAI) · Whoop 199–359 $/Jahr inkl. Hardware.

**Was Nutzer nachweislich erwarten (Top 5, in ORVIA noch offen):** Workouts auf die Garmin-Uhr pushen · Hevy-Niveau im Live-Logger (Supersets, 2-Tap-Übungstausch) · satzgenaue Zahlenempfehlung · sichtbare Plan-Neuberechnung bei Ausfall · Klartext-Erklärung der Tagesempfehlung (die ORVIA mit Quellen-/Konfidenzangabe besser kann als alle).

**Was ORVIA NICHT kopieren sollte:** Fitbods Blackbox-Progression (Trustpilot: „algorithm is broken“) · Runnas zu aggressive Pläne (Verletzungsdebatte) · Whoops Miet-Lock-in · Garmins Paywall-Nachschieben. ORVIAs Gegenposition: erklärbar, evidenz-ehrlich, Daten gehören dem Nutzer (Export ist Free-Feature).

**Positionierung in einem Satz:** *„Der einzige Trainingscoach, der Ausdauer und Krafttraining in einem Belastungsmodell zusammen denkt — und dir ehrlich sagt, was die Wissenschaft trägt und was nicht.“*

---

## 5 · Produkt-Tiers: Free / Pro / Founder (+ späteres Coach-Tier)

Empfehlung: **zwei Consumer-Tiers zum Launch** (Free + Pro), nicht drei — jede weitere Stufe kostet Erklärbarkeit und Conversion. „Max“ wird später das B2B-/Coach-Tier (§11). Preise: **Pro 9,99 €/Monat · 79,99 €/Jahr (≈ 6,67 €/Monat) · 14 Tage Voll-Trial**; global 9,99 $/79,99 $. Das unterbietet Runna/JOIN/TrainingPeaks um 25–40 %, liegt bewusst über dem Logger-Segment und auf dem akzeptierten Strava/Connect+-Preispunkt. Dazu einmalig **Founder-Lifetime 149 €** (limitiert, z. B. 500 Stück) als Vertrauens- und Frühfinanzierungssignal — Hevy beweist, dass Lifetime als Solo-Dev-Signal funktioniert.

Freemium-Schnitt nach dem Hevy-Prinzip (großzügiges Logging, Paywall bei Intelligenz und Tiefe) — nicht nach dem Fitbod-Prinzip (harte Wand), das Vertrauen kostet:

| Feature | Free | Pro | Begründung des Schnitts |
|---|---|---|---|
| Workout-Logging (Gym + Ausdauer), unbegrenzt | ✅ | ✅ | Logging ist Table Stakes; Beschneiden killt Gewohnheitsbildung |
| Garmin-/HealthKit-/Health-Connect-Import | ✅ | ✅ | Datenzufluss ist Voraussetzung für alles — nie paywallen |
| Tages-Readiness (Score + Kurzbegründung) | ✅ | ✅ | der tägliche Öffnungsgrund; Free-Version zeigt Score + 1 Satz |
| Readiness-Tiefe (Faktoren, Baseline, Konfidenz, Verlauf) | ❌ | ✅ | Insight-Tiefe = Zahlwert (Garmin/Whoop-Muster) |
| Wochenplan (1 aktives Ziel, Basisplan) | ✅ | ✅ | Kernversprechen muss erlebbar sein |
| Adaptive Planung (Zielwert→Machbarkeit, Neuberechnung, Taper, Mehrziel) | ❌ | ✅ | **das** Pro-Feature; entspricht Coach-Wert der 100-€+-Konkurrenz |
| Ziel-Detailseite (Machbarkeit, Evidenz, Einzahlung) | ❌ | ✅ | sichtbarster Pro-Mehrwert aus dem Prototyp |
| Satzgenaue Gym-Progression + Muskelgruppen-Analyse | ❌ | ✅ | Differenzierer ggü. Hevy/Strong |
| Analyse-Historie | 3 Monate | unbegrenzt | Hevy-Muster; Historie-Cap konvertiert nachweislich |
| Wissens-Hinweise mit Quellenangabe | Basis | voll | Evidenz-USP anfüttern, Tiefe monetarisieren |
| Workout-Push auf Garmin-Uhr | ❌ | ✅ | Premium-Erwartungsfeature (sobald offizielle API da) |
| Datenexport (eigene Daten) | ✅ | ✅ | bewusstes Anti-Lock-in-Statement — Marketing-Argument |
| Erfahrungsstufen, Check-in, Modul-Dashboard | ✅ | ✅ | Personalisierung treibt Retention, nicht Conversion |

---

## 6 · Engine-Arbeitsplan (strukturiert, mit Evidenz-Leitplanken)

| # | Arbeitspaket | Inhalt | Evidenz-Leitplanke (aus deiner Studienbibliothek) | Phase |
|---|---|---|---|---|
| E1 | Ziel-SSOT (B1/B4/B5) | mainGoalOf(), Zielobjekt in Wochenplan (erst Shadow), goals_detail aktivieren, goal-feasibility-Leser, Taper-Anbindung | Taper-Korridore sind belegt (Volumen −41–60 %, ≤ 21 d, Intensität halten) — als einer der wenigen Bereiche „verordnungsreif“ | A |
| E2 | Engine-v2-Aktivierung | Canary via `engine_v2_plan`, Beobachtung, v1 stilllegen | — | B |
| E3 | Readiness ehrlich halten | Score bleibt erklärbar + konfidenzbehaftet; KEIN „HRV entscheidet allein“, keine Verletzungs-„Vorhersage“ | kein validierter Composite-Score in der Literatur; objektiv/subjektiv korrelieren nicht → getrennt zeigen, transparent gewichten | B |
| E4 | Gym-Progression | satzgenaue Empfehlungen aus Historie + RIR + Wissensregeln; als „Vorschlag mit Begründung“, nie Blackbox | Last/Volumen/Frequenz meta-analytisch gut belegt (Currier, Pelland); Failure nicht nötig; MVT-1RM-Schätzung vermeiden (überschätzt) | B |
| E5 | Ausfall-/Krankheitslogik | sichtbare Plan-Neuberechnung („Woche angepasst, weil …“) | keine belegten Rampenraten → konservative Heuristik, als solche gekennzeichnet | B |
| E6 | Kraft+Ausdauer-Interferenzmodell | gemeinsames Belastungsbudget beider Welten — der USP | Umbrella-Review 2026: kein relevanter Interferenzeffekt auf Freizeitniveau, keine Reihenfolgeregel ableitbar → Budget-Logik ja, Dogmen nein | B/E |
| E7 | Zonen/Schwellen | HF-/Pace-Zonen aus Nutzerdaten, ehrlich als Schätzung markiert | Schwellenkonzepte nicht synonym (±30 %); keine validierten Feldverfahren → Konfidenz anzeigen | B |
| E8 | Sperr-Lesertyp Negativaussagen + Zahlen aus Notizen | aus deiner bestehenden Wissens-Roadmap | QUELLE-12/13/14-Negativaussagen brauchen Sperren, keine Zahlen | B |

---

## 7 · Integrationen: Reihenfolge, Prozesse, Kosten

| Plattform | Zugang | Kosten | Wartezeit | Wann |
|---|---|---|---|---|
| **Apple HealthKit** | Capacitor-Plugin (@capgo/capacitor-health), kein Antrag | 0 € | — | C (Launch) |
| **Google Health Connect** | Play-Console-Deklaration (Health Apps Declaration + Begründung je Permission) | 0 € | Teil des Play-Reviews | C (Launch) |
| **Polar AccessLink** | Self-Service online | 0 € | Tage | E |
| **Whoop** | Self-Service Developer Dashboard, App-Approval für Public | 0 € (eigene Mitgliedschaft zum Testen) | Sandbox sofort | E |
| **Suunto / Wahoo** | Formular/Partnervertrag | 0 € | ~2 Wochen | E |
| **Garmin (offiziell)** | Developer-Program-Antrag: Use Case, Datenschutz-Doku, **Gewerbe faktisch Voraussetzung**; Evaluation → Production-Review | Basis 0 €, ggf. Lizenz für Premium-Metriken | Antrag ~2 Werktage, Integration 1–4 Wo | **Antrag in C nach Gewerbeanmeldung**, Umstellung E |
| **Strava** | Self-Service — **ABER: Nov-2024-Terms verbieten Strava-Daten in KI/ML-Modellen** und Fremdanzeige | 0 € | sofort | E, nur als Anzeige-Quelle; Strava-Daten strikt aus der Engine heraushalten oder schriftlich klären |
| Aggregator (Terra ab 499 $/Mo) | — | zu teuer | — | erst ab Umsatz relevant |

Wichtig: HealthKit + Health Connect zuerst — sie decken Apple Watch und die meisten Android-Wearables **ohne Partnerverträge** ab und sind zugleich dein stärkstes Argument gegen Apples „4.2 Minimum Functionality“-Ablehnung. Der fragile inoffizielle Garmin-Pfad bleibt Übergangslösung nur für dein eigenes Konto, nie für fremde Nutzer.

---

## 8 · Store-Launch-Plan (Capacitor)

**Konten & Kosten:** Apple Developer 99 €/Jahr (+ Small Business Program beantragen → 15 % statt 30 % Provision) · Google Play 25 $ einmalig · RevenueCat kostenlos bis 2.500 $ Monatsumsatz, danach ~1 %.

**Technischer Weg (Aufwand realistisch 4–8 Wochen bei 20 h/Wo):** Capacitor-Projekt um die bestehende PWA; **Web-Assets ins Bundle** (niemals die GitHub-Pages-URL live laden — häufigster Ablehnungsgrund); Plugins: Health (capgo), Push, RevenueCat (purchases-capacitor); In-App-Kontolöschung (Supabase Edge Function, Apple-Pflicht 5.1.1(v)); Offline-Fähigkeit hast du bereits (Service Worker) — im Review-Notes-Feld explizit auflisten: HealthKit, Push, Offline, Haptics.

**Die 8 häufigsten Ablehnungsgründe und deine Absicherung:** 4.2-Web-Wrapper (→ HealthKit + Offline + Push sichtbar), Remote-Loading (→ Bundle), fehlende Kontolöschung (→ bauen), IAP umgangen (→ nur RevenueCat/IAP, keine externen Zahllinks), Health-Claims (→ §9 Formulierungsaudit), inkonsistente Privacy Labels (→ mit DSE abgleichen), fehlender Demo-Account (→ Review-Testkonto mit gefüllten Daten), kaputtes iPad-Layout (→ responsive testen).

**Play-Besonderheit:** Neue Personal-Konten brauchen **Closed Testing mit 12 Testern über 14 Tage durchgehend**, bevor Production beantragt werden kann → sofort zu Beginn von Phase C starten (deine Beta-Tester sind ohnehin geplant), realistisch 3–4 Wochen einplanen.

---

## 9 · Recht & Firma (Deutschland, als Azubi)

1. **Gewerbeanmeldung vor ersten Einnahmen** (20–60 €), steuerliche Erfassung; **Kleinunternehmerregelung** (seit 2025: 25.000 € Vorjahresgrenze) nutzen, aber: Apple/Google rechnen über Reverse-Charge ab → USt-IdNr. nötig. **Eine Stunde Steuerberater (~150–300 €) ist hier Pflicht, nicht Luxus.** Nebentätigkeit dem Ausbildungsbetrieb anzeigen (Ausbildungsvertrag prüfen). UG erst bei relevantem Umsatz/Haftungsrisiko — Einzelunternehmen reicht zum Start.
2. **DSGVO Art. 9:** HF/HRV/Schlaf sind Gesundheitsdaten. Pflichten: expliziter, granularer Consent-Screen vor erster Verarbeitung · Supabase-DPA abschließen + EU-Region verifizieren · Datenschutzerklärung (App + beide Stores, DE+EN) · Verarbeitungsverzeichnis · Datenschutz-Folgenabschätzung (bei Gesundheitsdaten regelmäßig nötig) · Export/Löschung (deckt sich mit Apple-Pflicht). Dein Community-Konzept (Sichtbarkeit default privat) passt bereits.
3. **MDR-Abgrenzung (kritisch für Formulierungen!):** Fitness/Wellness-Zweckbestimmung ist safe harbor; **riskant sind Diagnose-, Krankheits- und Vorhersage-Formulierungen** — „verhindert Verletzungen“, „erkennt Übertraining als Gesundheitsrisiko“ könnten die App zum Medizinprodukt Klasse IIa machen. Konsequenz: einmaliges **Formulierungsaudit über App, Store-Texte und Marketing (DE und EN)**: „Readiness für deine Trainingssteuerung“ ✅, „Verletzungsvorhersage“ ❌. Das entschärft MDR und Apple-Review gleichzeitig. Deine Evidenz-Philosophie hilft hier ausnahmsweise doppelt: ORVIA behauptet ohnehin nicht mehr, als die Literatur trägt.
4. **Sonstiges:** Impressum (App + Store), AGB mit „kein medizinischer Rat“-Klausel, Widerrufsbelehrung (Abwicklung über Stores), EU AI Act: Trainingsempfehlungs-Engine = minimales Risiko, keine besonderen Pflichten (nur KI-Chat kennzeichnen, falls später).

---

## 10 · Monetarisierung: erwartbare Conversion und Szenarien

**Benchmarks (RevenueCat 2026, >115.000 Apps; Adapty Health&Fitness):** Download→Paid (Freemium, Median) **2,9 %** · Trial→Paid **37,7 %** · monatlicher Churn Fitness Median **9–13 %**, gut **5–8 %** · Anteil Jahresabos H&F **68 %** · typischer Preis Median 9,99 $/Monat.

**Rechenweg (Basis aller Szenarien):** Blended-Umsatz je Abonnent = 0,32 × 9,99 € + 0,68 × (79,99 €/12) ≈ **7,73 €/Monat brutto** → nach 15 % Store-Cut **≈ 6,57 € netto**. Steady-State-Abobestand = (Downloads/Monat × Conversion) ÷ Churn.

| Szenario | Downloads/Monat | Free→Paid | Churn | Zahler (steady state) | **MRR netto** |
|---|---|---|---|---|---|
| **Worst** (kein Distributionserfolg) | 800 | 1,5 % | 12 % | ~100 | **~660 €** |
| **Basis** (solides ASO + Kurzvideo) | 3.000 | 2,9 % | 8 % | ~1.090 | **~7.150 €** |
| **Best** (Top-Quartil-Produkt + viraler Kanal) | 8.000 | 6 % | 5 % | ~9.600 | **~63.000 €** |

Interpretation: Das Basis-Szenario — für einen Solo-Dev mit gutem Produkt und konsequentem ASO/Content erreichbar — trägt dich in die Nähe von M3 (10k € MRR ≈ 2.100 Zahler bei ~6.000 Downloads/Monat). Das Worst-Szenario ist kein Scheitern des Produkts, sondern der Distribution — deshalb ist Marketing ab Phase D ein fester Wochenblock (~20 % deiner Zeit), kein Nachgedanke. **Paid Ads rechnen sich anfangs nicht** (Cost per Subscription ~45–60 $ vs. Jahr-1-LTV Median ~36 $): deine Kanäle sind ASO, Kurzvideo (Demo-Clips der Muskelkarte/Readiness-Erklärung), Reddit/Communities, Build-in-public und die deutsche Nische (enduco kann kein Gym, Alpha Progression kein Cardio — dieses Argument ist dein Content).

---

## 11 · B2B-Schiene (nach M3, nicht vorher)

| Modell | Vorbild | Mechanik | Voraussetzung |
|---|---|---|---|
| **Coach-Tier** („ORVIA Coach“) | TrainingPeaks: ~22 $/Mo Basis + ~9 $/Athlet | Trainer sieht/steuert Athleten; deine Multi-User-/RLS-Architektur + Sichtbarkeitsmodell sind die technische Basis | Community-Phase (Sichtbarkeit, orvia_can_see) fertig; owner_all entschärft |
| Vereins-/Team-Lizenzen | Whoop Unite | Paket je Team, Trainer-Dashboard | Coach-Tier + Referenzen |
| Corporate Wellness | Wellhub/EGYM Wellpass Partner | Distribution ohne CAC, Vergütung pro aktivem Nutzer (unter Consumer-ARPU) | Markenbekanntheit; erst ab M4 sinnvoll |

B2B verdoppelt den adressierbaren Markt, aber jedes B2B-Feature vor M3 verlangsamt den Consumer-Kern. Die richtige Vorbereitung jetzt: Datenmodell-Entscheidungen (Handle, Sichtbarkeit, Rollen) so treffen, dass das Coach-Tier später kein Umbau ist — das tust du in Phase B ohnehin.

---

## 12 · Gesamt-Timeline und Kosten (20 h/Woche)

| Phase | Zeitraum | Inhalt (Kurzform) | Gate am Ende | Kosten |
|---|---|---|---|---|
| **A — Fundament** | Sep–Okt 2026 (~150 h) | Roadmap-Phase 0+1: roter Test, B4, Deploy v8-344+, CI, Branch-Schutz, Ziel-SSOT (E1); **Gym-Bug nach Deploy retesten**; Gewerbe + Steuerberater | Suite grün in CI, Live-Abnahme, Zielobjekt im Shadow-Log | ~100 € (Gewerbe) + ~250 € (StB) |
| **B — Produktkern** | Nov 2026–Feb 2027 (~300 h) | Ziel-Detail, Onboarding v3, Gym-UX auf Hevy-Niveau (Supersets, 2-Tap-Flows), satzgenaue Progression (E4), Ausfall-Logik (E5), Engine-v2-Canary→aktiv (E2/E3), i18n-Struktur + EN-Übersetzung | **M1**: 2 Wochen Eigenbetrieb v2-gesteuert, DE+EN vollständig | 0 € |
| **C — Store-Ready** | Feb–Apr 2027 (~200 h) | Capacitor + HealthKit/Health Connect + Push + RevenueCat + Kontolöschung; Consent/DSE/Impressum/AGB DE+EN; MDR-Formulierungsaudit; Play Closed Test (12 Tester/14 Tage); Garmin-Antrag stellen; Beta (~50–100 Tester) | Beide Store-Reviews bestanden (TestFlight/Closed → Production freigegeben) | ~125 € (Konten) |
| **D — Launch** | Mai 2027 | Launch DE+EN, Free/Pro live, Founder-Lifetime-Aktion, Launch-Content (Product Hunt, Reddit, dt. Lauf-/Triathlon-Foren) | **M2**: App live in beiden Stores, erste zahlende Nutzer | Puffer ~200 € |
| **E — Wachstum** | Jun–Dez 2027 | Wochentakt Build–Measure–Learn; ASO-Iteration; Kurzvideo-Kanal; Garmin-offiziell-Umstellung + Workout-Push; Polar/Whoop; Retention-Arbeit (D30 > 8 %) | **M3**: 1.000+ Zahler / ~5–10k € MRR ODER dokumentierte Pivot-Entscheidung | Supabase Pro ~25 $/Mo ab Last |
| **F — Ausbau** | 2028 | Community-Schicht (deine fertige Sicherheits-Reihenfolge), Coach-Tier (B2B), ggf. Team/Kapital-Entscheidung | M4/M5-Gates | nach Umsatzlage |

**Gesamtkosten bis Launch: < 1.000 €.** Laufend danach: ~30–60 €/Monat (Supabase, Apple-Jahresgebühr anteilig, Domain) + RevenueCat 1 % ab 2.500 $/Monat. Die Timeline enthält ~15 % Puffer; dein Ausbildungsalltag (Prüfungsphasen!) ist der größte Timeline-Treiber — plane Prüfungsmonate als halbe Kapazität.

---

## 13 · Risiken (Top 6, mit Gegenmaßnahme)

| Risiko | Wahrscheinlichkeit | Wirkung | Gegenmaßnahme |
|---|---|---|---|
| Garmin lehnt Solo-Dev-Antrag ab / verzögert | mittel | hoch (Kernintegration) | HealthKit/Health Connect zuerst (deckt Apple Watch + Android ab); Antrag mit Gewerbe + sauberer Datenschutz-Doku; Polar/Whoop als Ausweich-Story |
| Apple 4.2-Ablehnung (Web-Wrapper) | mittel | mittel (Iterationsschleifen) | Assets bundeln, HealthKit/Push/Offline nativ, Review-Notes; 2–3 Review-Runden einplanen |
| Distribution bleibt aus (Worst-Szenario) | mittel-hoch | hoch | Marketing als fester Wochenblock ab D; North-Star + Kill-/Pivot-Kriterien an M3-Gate definieren, bevor der Launch emotional wird |
| Zeitbudget kollabiert (Ausbildung/Prüfungen) | mittel | mittel | Meilenstein- statt Datumsbindung; kritischer Pfad geschützt, alles andere verschiebbar |
| MDR-/Review-Problem durch Gesundheits-Formulierungen | niedrig (nach Audit) | hoch | Formulierungsaudit in C, Wellness-Zweckbestimmung dokumentieren |
| Ein-Personen-Risiko (Bus-Faktor, Burnout) | dauerhaft | hoch | CI + Doku (existiert bereits vorbildlich); 25-h-Wochen als Obergrenze ernst nehmen — dein eigenes Belastungsmanagement ist Teil des Projekts |

---

## 14 · Offene Entscheidungen (deine)

1. Freigabe dieser Phasenstruktur A–F als verbindlicher Rahmen (ersetzt nicht die technische Roadmap — sie ist deren Obermenge).
2. Preis final: 9,99 €/79,99 € wie empfohlen, oder Einstieg 7,99 €/59,99 € (mehr Volumen, weniger Marge — nicht empfohlen, Underpricing ist im Markt verbreiteter Fehler).
3. Founder-Lifetime ja/nein und Stückzahl.
4. Name der Tiers („Pro“ empfohlen; „Max“ für später reservieren).
5. Beta-Tester-Rekrutierung: privater Kreis vs. öffentliche Warteliste (Warteliste = früher Marketing-Asset, empfohlen).
6. Termin Steuerberater + Gewerbeanmeldung (Phase A, konkret: vor dem ersten Founder-Euro).

---

## 15 · Fazit

Der Plan ist bewusst konservativ gerechnet und an jeder Stelle mit Marktdaten unterlegt: ~9 Monate bis zum Store-Launch bei 20 h/Woche, unter 1.000 € Kapitalbedarf, ein klar definierter Freemium-Schnitt auf einem verifizierten Preispunkt, und eine Positionierung, die eine nachweislich unbesetzte Lücke trifft. Die größte Stärke des Projekts ist, dass der schwerste Teil — eine funktionierende, getestete, evidenz-ehrliche Engine samt App — zu großen Teilen existiert; die Restarbeit ist Verdrahten, Verpacken und Verkaufen. Die größte Gefahr ist nicht Technik, sondern Distribution und dein Zeitbudget. Deshalb: Meilenstein-Gates, North-Star-Metrik, Marketing als Pflichtblock — und das 500-Mio.-Ziel als Richtung am Horizont, während jede tatsächliche Entscheidung auf das nächste Gate optimiert. Genau so werden große Projekte geplant: nicht als Sprung zum Endzustand, sondern als Kette prüfbarer Zwischenzustände, von denen jeder einzelne schon für sich wertvoll ist.
