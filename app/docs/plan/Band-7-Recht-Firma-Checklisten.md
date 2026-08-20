# ORVIA Masterplan — Band 7: Recht, Firma & Compliance-Checklisten

**Stand:** August 2026 · **Kontext:** Solo-Entwickler, Azubi in Deutschland, Nebengewerbe · **Launch:** Mai 2027

**Grundsatz dieses Bandes:** Alles hier ist Arbeitsgrundlage und Checkliste, **kein Rechtsrat**. Punkte mit ⚖️ sind vor Verwendung **anwaltlich zu prüfen**. Budget-Realität: Rechtsberatung gezielt einkaufen (AGB + Datenschutz-Review), Rest sauber selbst vorbereiten — gute Vorbereitung senkt die Anwaltskosten erheblich.

---

## 1. Gründungs-Checkliste (chronologisch)

Empfohlene Rechtsform zum Start: **Einzelunternehmen (Kleingewerbe)** — kostengünstig, schnell, für App-Umsätze in der Startphase ausreichend. UG/GmbH erst prüfen, wenn nennenswerter Umsatz oder Haftungsrisiko wächst (⚖️ + Steuerberater).

| # | Schritt | Details | Frist/Timing |
|---|---|---|---|
| 0 | **Minderjährig?** | Falls bei Gründung noch unter 18: Gewerbe nur mit Einwilligung der Eltern **und** Genehmigung des Familiengerichts (§ 112 BGB) — ⚖️ frühzeitig klären. Falls volljährig: entfällt. | Vor allem anderen |
| 1 | **Ausbildungsbetrieb informieren** | Nebentätigkeit schriftlich anzeigen (viele Ausbildungs-/Arbeitsverträge verlangen das). Zusage schriftlich geben lassen. Argument: kein Wettbewerb, außerhalb der Arbeitszeit, Ausbildung hat Vorrang. Ohne diese Klärung kein Schritt 2. | ~Monat −10 (Sommer 2026) |
| 2 | **Gewerbeanmeldung** | Gewerbeamt der Stadt (oft online), Tätigkeit: „Entwicklung und Vertrieb von Software/Apps". Kosten ca. 15–60 € je nach Kommune. Nebengewerbe ankreuzen. | Vor erster Einnahme; realistisch Monat −8 |
| 3 | **Fragebogen zur steuerlichen Erfassung** | Kommt via ELSTER (selbst aktiv ausfüllen, nicht auf Post warten). Entscheidungen darin: Kleinunternehmerregelung § 19 UStG ja/nein (s. u.), Gewinnschätzung konservativ (zu hohe Schätzung = hohe Vorauszahlungen). Frist: binnen eines Monats nach Eröffnung. | Direkt nach Schritt 2 |
| 4 | **USt-IdNr. beantragen** | Im ELSTER-Fragebogen ankreuzen oder beim BZSt nachbeantragen. **Auch als Kleinunternehmer nötig**, weil Apple/Google/Supabase Reverse-Charge-Leistungen aus dem EU-Ausland abrechnen (§ 13b UStG — als Kleinunternehmer trotzdem USt auf bezogene Auslandsleistungen abführen!). ⚖️/Steuerberater: genaue Behandlung der App-Store-Erlöse (Kommissionärsmodell Apple/Google) klären. | Mit Schritt 3 |
| 5 | **Steuerberater-Ersttermin** | Einmalige Beratung (150–400 € Schätzung) statt Dauermandat. Agenda s. Kasten unten. | Monat −7 |
| 6 | **Geschäftskonto trennen** | Separates (Business-)Konto, auch als Einzelunternehmer: saubere Trennung = einfache EÜR, weniger Steuerberater-Aufwand. Kostenlose/insolvenzferne Optionen vergleichen; darauf achten, dass App-Store-Auszahlungen (Apple/Google) und RevenueCat-relevante Konten dort landen. | Monat −7 |
| 7 | **Buchhaltungs-Setup (einfach)** | EÜR reicht (keine Bilanz nötig unter den Schwellen). Setup: Buchhaltungstool (z. B. Lexware Office/sevdesk, ~10–20 €/Monat) **oder** zu Beginn diszipliniertes Spreadsheet + Belegordner (digital, GoBD-gedanklich: unveränderbar ablegen). Monatsroutine 30 min: Belege ablegen, Konto abgleichen, Apple/Google-Reports exportieren. | Monat −7 |
| 8 | **Verträge & Accounts aufs Gewerbe umstellen** | Apple Developer Program (99 $/Jahr, als Organisation oder Individual — Entscheidung dokumentieren), Google Play (25 $ einmalig, seit 2023 mit Händler-Verifizierung/D-U-N-S ggf.), Supabase/RevenueCat-Accounts mit Geschäftsadresse + USt-IdNr. | Monat −6 |
| 9 | **Impressum & rechtliche Basisseiten** | Impressum (§ 5 DDG) auf Website **und** in App erreichbar; Datenschutzerklärungen (s. Kap. 2). | Vor Landing-Page-Livegang |
| 10 | **Versicherung prüfen** | S. Kap. 6. | Spätestens Monat −2 vor Launch |

**Kleinunternehmerregelung (§ 19 UStG):** Zum Start sinnvoll (keine USt auf eigene Umsätze, weniger Bürokratie), Grenzen seit 2025: 25.000 € Vorjahr / 100.000 € laufendes Jahr. **Aber:** Apple/Google rechnen als Kommissionär ab — die umsatzsteuerliche Behandlung der Store-Erlöse und der Reverse-Charge-Eingangsleistungen ist genau der Punkt für den Steuerberater. ⚖️/Steuerberater.

**Buchhaltungs-Monatsroutine (30–45 min, fester Termin am Monatsersten):**

1. Kontoauszug Geschäftskonto exportieren, jede Buchung kategorisieren (Einnahme Store / Ausgabe Tool / Privat-Fehlbuchung markieren).
2. Apple-„App Store Connect Payments"-Report + Google-Play-Auszahlungsbericht + RevenueCat-Übersicht als PDF ablegen (Ordnerstruktur: `JJJJ/MM/einnahmen` bzw. `/ausgaben`).
3. Eingangsrechnungen (Supabase, Tools) aus den Portalen ziehen — **sofort**, viele Portale halten Rechnungen nur begrenzt vor; auf ausgewiesene USt/Reverse-Charge-Vermerk achten.
4. Kilometerstand/Fahrten, falls relevant, und Bar-Belege digitalisieren.
5. Offene Fragen in einer Liste für den Steuerberater sammeln (nicht einzeln anrufen — spart Honorar).

Diese Routine ist die günstigste „Versicherung" des ganzen Kapitels: Ein sauberer Belegordner halbiert real die Steuerberaterkosten und macht jede spätere Betriebsprüfung entspannt.

### Steuerberater-Termin: die 8 konkreten Fragen

1. Wie werden **App-Store-Erlöse** (Apple/Google als Kommissionär, Auszahlung aus Irland/Luxemburg) umsatzsteuerlich korrekt erfasst — und was heißt das für/gegen die Kleinunternehmerregelung?
2. Muss ich als Kleinunternehmer für **Reverse-Charge-Eingangsleistungen** (Supabase, RevenueCat, Cloud-Dienste aus dem Ausland) USt anmelden und abführen — und in welchem Turnus (USt-Voranmeldung)?
3. Reicht die **EÜR**, und welche Belegstruktur wollen Sie von mir sehen, damit der Jahresabschluss günstig bleibt?
4. Wie behandle ich **Eigenleistungen/Entwicklungskosten** und Anschaffungen (Laptop, Testgeräte) — Abschreibung, GWG, häusliches Arbeitszimmer/Homeoffice-Pauschale neben der Ausbildung?
5. Was bedeutet das Nebengewerbe für meine **Einkommensteuer** neben dem Azubi-Gehalt (Progression, Vorauszahlungen, Freibeträge) — und ab welchem Gewinn ändert sich etwas Wesentliches?
6. **Sozialversicherung:** Ab wann gefährdet das Gewerbe meinen Status (hauptberuflich vs. nebenberuflich, Krankenkassen-Meldung)?
7. Ab welchen Kennzahlen lohnt der Wechsel in eine **UG/GmbH** (Haftung, Steuerlast, Ausland-Umsätze) — was wäre der Migrationspfad?
8. Was kostet mich bei Ihnen ein **Jahres-Setup** (EÜR + ESt-Erklärung + punktuelle Fragen), und was kann ich selbst vorbereiten, um die Rechnung zu senken?

---

## 2. DSGVO-Dokumentenpaket

ORVIA verarbeitet **Gesundheitsdaten (Art. 9 DSGVO)** — Trainings-, Herzfrequenz-, Schlaf-/Readiness-Daten. Das ist die höchste Sensibilitätsstufe: ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a), DSFA erforderlich, EU-Hosting wo möglich (Supabase-Projekt in EU-Region anlegen!).

### 2.1 Pflichtdokumente (Liste)

| # | Dokument | Inhalt/Zweck | Status-Hinweis |
|---|---|---|---|
| 1 | **Datenschutzerklärung App (DE + EN)** | Alle Verarbeitungen in der App: Account, Gesundheitsdaten, Wearable-Sync (HealthKit/Health Connect — Apple & Google verlangen eigene Aussagen: HealthKit-Daten nie für Werbung!), Push, Analytics, Abo/RevenueCat. Rechtsgrundlagen je Zweck, Speicherdauern, Empfänger, Drittland, Betroffenenrechte. In beiden Stores verlinkt (Pflichtfeld) + in-App erreichbar. | ⚖️ Review |
| 2 | **Datenschutzerklärung Website/Landing Page** | Getrennt von der App-DSE: Hosting, Newsletter (Double-Opt-in!), Analytics (cookiefrei → ggf. ohne Banner, Konfiguration dokumentieren). | ⚖️ Review |
| 3 | **AVV-Liste (Auftragsverarbeiter)** | S. Tabelle 2.2 — je Prozessor: AVV/DPA abgeschlossen + abgelegt, Drittlandtransfer-Mechanismus (SCC/DPF) notiert. | Selbst pflegbar |
| 4 | **Verzeichnis von Verarbeitungstätigkeiten (Art. 30)** | Pflicht (Ausnahme des Art. 30 Abs. 5 greift nicht: Gesundheitsdaten + nicht nur gelegentlich). Gliederung s. 2.3. | Selbst erstellbar |
| 5 | **DSFA (Art. 35)** | Pflicht: Gesundheitsdaten in großem Umfang + neue Technologien (Scoring/Readiness). Gliederung + ORVIA-Risiken s. 2.4. | Selbst erstellen, ⚖️ Review |
| 6 | **TOM-Liste (Art. 32)** | S. 2.5. | Selbst erstellbar |
| 7 | **Löschkonzept** | S. 2.6. | Selbst erstellbar |
| 8 | **Consent-Records-Spezifikation** | Wie Einwilligungen protokolliert werden (Zeitstempel, Textversion, Widerruf) — Nachweispflicht Art. 7 Abs. 1. | Selbst erstellbar |
| 9 | **Prozess Betroffenenrechte** | Auskunft/Export (Art. 15/20 — ORVIA-USP „Export frei" erfüllt Art. 20 fast nebenbei), Löschung ≤ 1 Monat, Identitätsprüfung. | Selbst erstellbar |
| 10 | **Meldeprozess Datenpannen** | 72-h-Meldung Art. 33 an Landesdatenschutzbehörde; Vorlage-Mail + Entscheidungsbaum („meldepflichtig ja/nein") vorab schreiben. | Selbst erstellbar |
| 11 | **DSB-Prüfvermerk** | Benennungspflicht eines Datenschutzbeauftragten prüfen: § 38 BDSG (i. d. R. ≥ 20 Personen — Solo: nein) **aber** Art. 37 DSGVO Kerntätigkeit umfangreiche Verarbeitung besonderer Kategorien — Grenzfall bei Gesundheits-Apps! | ⚖️ prüfen lassen |

### 2.2 AVV-/Prozessoren-Liste (initial)

| Prozessor | Zweck | Datenkategorien | Sitz/Drittland | AVV-Quelle |
|---|---|---|---|---|
| Supabase | Backend, DB, Auth | Account + **Gesundheitsdaten** | US-Anbieter, **EU-Region wählen**; DPA + SCC | Supabase DPA (self-serve) |
| RevenueCat | Abo-Verwaltung | Pseudonyme User-ID, Kaufdaten (keine Gesundheitsdaten dorthin!) | US; DPA + SCC/DPF | RevenueCat DPA |
| Analytics (z. B. PostHog EU / Plausible) | Produkt-/Web-Analyse | Pseudonyme Events, **keine Gesundheitsrohdaten** | EU-Hosting wählen | Anbieter-DPA |
| Push (APNs / FCM) | Benachrichtigungen | Token, Gerätedaten | Apple/Google; FCM: Google-DPA | Apple/Google Terms + DPA |
| E-Mail (z. B. Brevo/Buttondown/Resend) | Newsletter, Transaktionsmails | E-Mail, Name | EU-Anbieter bevorzugen | Anbieter-AVV |
| Hosting Landing Page | Website | Logs/IP | EU bevorzugen | Anbieter-AVV |

Regel: **Gesundheitsdaten verlassen Supabase-EU nicht.** Jeder neue Dienst kommt erst nach AVV-Check + Eintrag hier + Update DSE + ggf. DSFA-Nachtrag.

### 2.3 Verarbeitungsverzeichnis — Template-Gliederung

1. Verantwortlicher (Name, Anschrift, Kontakt) · 2. je Verarbeitungstätigkeit ein Blatt: (a) Bezeichnung + Zweck, (b) Kategorien betroffener Personen, (c) Datenkategorien (Gesundheitsdaten markieren), (d) Rechtsgrundlage, (e) Empfänger/Prozessoren, (f) Drittlandtransfer + Garantien, (g) Löschfrist, (h) TOM-Verweis. — **Initiale Blätter:** Account-Verwaltung · Trainingsplanung/Readiness (Art. 9!) · Wearable-Sync · Abo/Zahlung · Push · Produkt-Analytics · Newsletter · Support-Mails · Bewerbungs-/Vertragspartnerdaten (später).

### 2.4 DSFA — Gliederung mit ORVIA-spezifischen Risiken

Gliederung: 1. Beschreibung der Verarbeitung + Datenflüsse (Diagramm Wearable→App→Supabase) · 2. Notwendigkeit/Verhältnismäßigkeit (Datenminimierung: Welche Rohdaten braucht das Belastungsmodell wirklich?) · 3. Risikoanalyse · 4. Abhilfemaßnahmen · 5. Ergebnis + Freigabe + Review-Datum.

| ORVIA-spezifisches Risiko | Szenario | Maßnahme |
|---|---|---|
| Rückschluss auf Gesundheitszustand | HF-/HRV-/Schlafdaten erlauben Rückschlüsse auf Erkrankungen | Verschlüsselung at rest/in transit, RLS in Supabase, Zugriff nur Nutzer selbst |
| Fehlinterpretation Readiness → Überlastung | Nutzer trainiert trotz Warnsignalen „nach Score" | Klare Nicht-Medizin-Disclaimer (s. Kap. 3), konservative Defaults, Erklärtexte |
| Datenpanne mit Art.-9-Daten | Leak = hohes Melde-/Bußgeldrisiko | Minimalspeicherung, Backup-Verschlüsselung, Zugriffs-Logging, Notfallplan (2.1 #10) |
| Drittlandtransfer | US-Anbieter (Supabase-Org, RevenueCat) | EU-Region, SCC/DPF dokumentieren, keine Gesundheitsdaten an US-Only-Dienste |
| Solo-Betreiber-Risiko | Eine Person = Schlüsselpersonenrisiko (Zugänge, Incident Response) | Passwort-Manager, 2FA überall, dokumentierte Runbooks, Notfallkontakt |
| Minderjährige Nutzer | Trainings-App zieht ggf. < 16-Jährige an | Altersabfrage ≥ 16 im Onboarding (Art. 8), Store-Alterseinstufung konsistent |
| Koppelungsrisiko Einwilligung | App „funktioniert nicht ohne alles" | Granularer Consent (s. 2.7): Kernfunktion ohne Analytics/Sync nutzbar |

### 2.5 TOM-Liste (Auszug, als lebendes Dokument)

Zugriffskontrolle: 2FA auf allen Admin-Accounts (Supabase, Stores, RevenueCat, Domain, E-Mail); Passwort-Manager. — Datenkontrolle: Row Level Security je Nutzer; TLS überall; Verschlüsselung at rest (Supabase-Standard) — Pseudonymisierung: Analytics nur mit zufälliger ID, keine Klarnamen/Gesundheitsrohdaten in Events. — Verfügbarkeit: tägliche Backups + Restore-Test quartalsweise. — Trennung: Dev-/Prod-Umgebung getrennt, Prod-Daten nie lokal. — Protokollierung: Admin-Zugriffe geloggt. — Organisatorisch: jährliche Selbst-Schulung (Datenschutz-Update), Geräteverschlüsselung, Bildschirmsperre.

### 2.6 Löschkonzept (Kernfristen)

| Datenart | Löschung |
|---|---|
| Account + Gesundheitsdaten | Bei Konto-Löschung: sofortige Löschung/Anonymisierung in Prod, Backups rollieren binnen ≤ 35 Tagen aus |
| Inaktive Accounts | Nach 24 Monaten Inaktivität: Erinnerung → 30 Tage → Löschung (in DSE ankündigen) |
| Analytics-Events | Max. 14 Monate, dann aggregiert/gelöscht |
| Newsletter | Bei Abmeldung sofort (nur Sperrvermerk der E-Mail für Ausschlussliste) |
| Rechnungs-/Steuerdaten | 10 Jahre (§ 147 AO — Aufbewahrungspflicht schlägt Löschwunsch) |
| Support-Mails | 12 Monate nach Abschluss |
| Consent-Records | Solange Konto besteht + Verjährung (Nachweispflicht) |

**In-App-Kontolöschung ist Pflicht** (Apple-Guideline 5.1.1(v) + Google-Play-Vorgabe): 1-Klick-Flow einbauen, nicht nur E-Mail-Weg.

### 2.7 Consent-Flow-Spezifikation (Onboarding)

Granularität: 4 getrennte Entscheidungen, **keine** Sammel-Checkbox; Ablehnen gleich einfach wie Annehmen; jederzeit widerrufbar in Einstellungen → „Datenschutz-Center".

| Screen | Zweck | Rechtsgrundlage | Textbaustein-Entwurf (DE, ⚖️ Review) |
|---|---|---|---|
| C1 Basis-Account | Registrierung, Abo, Kernfunktion | Art. 6 (1) b (Vertrag) — **keine Einwilligung nötig**, nur Information | „Für deinen Account verarbeiten wir E-Mail und Anmeldedaten sowie deine Trainingsplan-Einstellungen. Das brauchen wir, damit ORVIA funktioniert. Details: Datenschutzerklärung." + [Weiter] |
| C2 Gesundheitsdaten-Verarbeitung | Belastungsmodell, Readiness | Art. 9 (2) a (ausdrückliche Einwilligung) | „ORVIA analysiert deine Trainings- und Körperdaten (z. B. Herzfrequenz, Trainingsdauer, Schlaf), um Belastung und Readiness zu berechnen. Das sind Gesundheitsdaten. Wir verarbeiten sie nur mit deiner ausdrücklichen Einwilligung, speichern sie in der EU und geben sie nie für Werbung weiter. Du kannst die Einwilligung jederzeit widerrufen — dann löschen wir diese Daten." + [Ich willige ein] / [Ohne fortfahren*] (*App im eingeschränkten Modus: manuelle Planung ohne Readiness) |
| C3 Wearable-Sync | HealthKit / Health Connect / Garmin | Art. 9 (2) a + OS-Berechtigungsdialog (zusätzlich!) | „Verbinde Apple Health, Health Connect oder Garmin, damit ORVIA deine Einheiten automatisch importiert. Es gelten zusätzlich die Berechtigungsdialoge deines Systems — du wählst dort, welche Datentypen ORVIA lesen darf. HealthKit-Daten verwenden wir niemals für Werbung oder Weitergabe." + [Verbinden] / [Später] |
| C4 Optionale Analytics | Produktverbesserung | Art. 6 (1) a (Einwilligung), Opt-in, Default AUS | „Hilf uns, ORVIA zu verbessern: anonymisierte Nutzungsstatistiken (welche Screens genutzt werden — nie deine Gesundheitswerte). Optional, jederzeit abschaltbar." + [Ja, helfen] / [Nein danke] — beide Buttons gleichwertig gestaltet |

Technische Anforderungen: Consent-Version + Zeitstempel je Nutzer speichern; bei Textänderung Re-Consent; Widerruf triggert Datenlöschung des jeweiligen Zwecks; EN-Texte funktional identisch übersetzen (nicht frei variieren — eine Wahrheit, zwei Sprachen).

---

## 3. MDR-Formulierungsleitfaden

**Rahmen:** Ob Software ein Medizinprodukt ist, entscheidet die **Zweckbestimmung** (Intended Purpose) — maßgeblich [MDCG 2019-11](https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf) (Qualifizierung/Klassifizierung von Software unter MDR, vgl. auch [Johner-Institut](https://blog.johner-institute.com/iec-62304-medical-software/software-as-medical-device-definition-and-classification/)). Apps für **Fitness, Wellbeing und allgemeine Trainingszwecke ohne medizinische Zweckbestimmung** sind kein Medizinprodukt. Die Grenze ziehen die eigenen Aussagen: Wer Diagnose, Therapie, Verhütung/Vorhersage von Krankheiten oder **Verletzungen** verspricht, argumentiert sich selbst in die MDR (und zugleich ins Heilmittelwerberecht, HWG). Deshalb: eiserne Sprachdisziplin in App, Stores, Website, Videos, Support-Antworten.

### 3.1 Formulierungspaare VERBOTEN → ERLAUBT

| # | ❌ VERBOTEN (DE) | ✅ ERLAUBT (DE) | ❌ EN | ✅ EN |
|---|---|---|---|---|
| 1 | „verhindert Verletzungen" | „unterstützt deine Belastungssteuerung" | "prevents injuries" | "supports your training load management" |
| 2 | „senkt dein Verletzungsrisiko" | „hilft dir, Belastung und Erholung auszubalancieren" | "reduces injury risk" | "helps you balance load and recovery" |
| 3 | „erkennt Übertraining" | „zeigt dir, wenn deine Belastung ungewöhnlich stark steigt" | "detects overtraining" | "shows you when your training load rises unusually fast" |
| 4 | „diagnostiziert deinen Erschöpfungszustand" | „fasst deine Trainings- und Erholungsdaten zusammen" | "diagnoses fatigue" | "summarizes your training and recovery data" |
| 5 | „misst deine Regeneration medizinisch präzise" | „schätzt deine Readiness auf Basis deiner Daten" | "medically accurate recovery measurement" | "estimates readiness from your data" |
| 6 | „verbessert deine Herzgesundheit" | „unterstützt dein Ausdauertraining" | "improves heart health" | "supports your endurance training" |
| 7 | „beugt Überlastungsschäden vor" | „macht deine Belastungsspitzen sichtbar" | "prevents overuse damage" | "makes load spikes visible" |
| 8 | „therapiert / behandelt …" | „begleitet dein Training" | "treats / therapy for …" | "guides your training" |
| 9 | „erkennt Herzrhythmusstörungen / auffällige Werte" | (ersatzlos streichen — keine Bewertung von Vitalwerten als normal/abnormal) | "detects abnormal heart values" | (remove — no normal/abnormal judgment) |
| 10 | „bei Schmerzen empfiehlt ORVIA …" | „bei Schmerzen: Pausiere und sprich mit Ärztin/Arzt" | "if you feel pain, ORVIA recommends …" | "if you feel pain: rest and consult a doctor" |
| 11 | „schützt vor Übertrainingssyndrom" | „hilft dir, geplante Erholung ernst zu nehmen" | "protects against overtraining syndrome" | "helps you take planned recovery seriously" |
| 12 | „dein digitaler Sportarzt" | „dein datenbasierter Trainingsbegleiter" | "your digital sports doctor" | "your data-driven training companion" |
| 13 | „medizinisch validiert" | „basiert auf sportwissenschaftlichen Studien (Quellen in der App)" | "medically validated" | "based on sports-science research (sources in app)" |
| 14 | „erkennt, wann dein Körper krank wird" | „zeigt Abweichungen von deinem üblichen Trainingsmuster" | "detects when you're getting sick" | "shows deviations from your usual training pattern" |
| 15 | „optimiert deine Gesundheit" | „optimiert deine Trainingsplanung" | "optimizes your health" | "optimizes your training planning" |
| 16 | „Reha nach Verletzung mit ORVIA" | „Wiedereinstieg ins Training planen — nach ärztlicher Freigabe" | "rehab your injury with ORVIA" | "plan your return to training — once cleared by a doctor" |
| 17 | „ORVIA warnt dich vor gesundheitlichen Risiken" | „ORVIA weist auf hohe Trainingsbelastung hin" | "warns you of health risks" | "flags high training load" |
| 18 | „bekämpft Stress / verbessert deinen Schlaf" | „berücksichtigt deine Schlafdaten in der Planung" | "fights stress / improves your sleep" | "factors your sleep data into planning" |
| 19 | „für Patienten mit …" (jede Krankheit) | „für gesunde, ambitionierte Freizeitathleten" | "for patients with …" | "for healthy, ambitious recreational athletes" |
| 20 | „Herzfrequenz-Analyse zur Früherkennung" | „Herzfrequenz-Trends für deine Trainingssteuerung" | "heart-rate analysis for early detection" | "heart-rate trends for training control" |

**Merkregel:** Erlaubt ist die Sprache von **Training, Leistung, Planung, Sichtbarkeit** („zeigt, schätzt, plant, unterstützt"). Verboten ist die Sprache von **Krankheit, Verletzung, Diagnose, Prävention, Therapie, Risiko** („verhindert, erkennt [Zustand], schützt, behandelt, warnt vor Gesundheits-X").

### 3.2 Zweckbestimmungs-Statement (Entwurf zum Ablegen, ⚖️ final prüfen)

> **Zweckbestimmung ORVIA (Intended Purpose):** ORVIA ist eine Trainings- und Lifestyle-Anwendung für gesunde, sportlich aktive Erwachsene. Sie dient ausschließlich der Planung, Aufzeichnung und Auswertung von Freizeit-Sporttraining (Laufen, Radfahren, Schwimmen, Krafttraining) sowie der Darstellung von Trainingsbelastungs- und Erholungs-Kennzahlen zu Fitness- und Wellbeing-Zwecken. ORVIA hat **keine medizinische Zweckbestimmung**: Sie ist nicht bestimmt zur Diagnose, Verhütung, Überwachung, Vorhersage, Prognose, Behandlung oder Linderung von Krankheiten oder Verletzungen und ersetzt keine ärztliche oder therapeutische Beratung. Datum/Version/Unterschrift.

Ablage: im Compliance-Ordner, versioniert; Referenz für jede Marketing-/Produkttext-Entscheidung und Basis der Nicht-Qualifizierung als Medizinprodukt nach MDCG 2019-11.

### 3.3 Prüfprozess für künftige Texte

1. **Checkliste je Text** (Store-Update, Video-Skript, Blogpost, Push-Text): Enthält er Wörter aus der Verboten-Spalte oder Krankheits-/Verletzungs-/Diagnose-Vokabular? → umformulieren nach Tabelle. 2. **Feature-Gate:** Jedes neue Feature vor Entwicklung gegen das Zweckbestimmungs-Statement prüfen — Features, die Vitalwerte als „normal/abnormal" bewerten oder Krankheits-/Verletzungsbezug haben, sind Design-verboten (oder lösen ⚖️ MDR-Beratung aus). 3. **Jahres-Review:** 1×/Jahr alle öffentlichen Texte (Stores, Website, Top-Videos) gegen die Tabelle prüfen (s. Kap. 5). 4. **Support-Makros:** Vorformulierte Antworten für Gesundheitsfragen von Nutzern („Bitte ärztlich abklären — ORVIA gibt keine medizinischen Empfehlungen").

---

## 4. AGB / EULA — Gliederung mit Kernklauseln

> ⚖️ **Gesamtdokument final anwaltlich erstellen/prüfen lassen.** Kostenrahmen laut Marktübersicht: Festpreise für AGB-Erstellung bewegen sich grob im Bereich **~500–1.500 €** je nach Komplexität (Abo-App mit Verbrauchern eher oberes Drittel); vgl. Festpreis-Angebote z. B. bei [derstartupanwalt.de](https://www.derstartupanwalt.de/news/agb-erstellen-lassen), [advocado](https://www.advocado.de/ratgeber/unternehmensrecht-und-betriebsnachfolge/agb/agb-erstellen-lassen.html) und spezialisierte [App-AGB-Anbieter](https://anwalt-kg.de/allgemeine-geschaeftsbedingungen/android-ios-app-agb/). Diese Gliederung senkt den Erstellungsaufwand.

1. **Geltungsbereich & Vertragspartner** — Verbraucher-App B2C; Verhältnis zu Apple-/Google-Store-Bedingungen (Kauf läuft über Store).
2. **Leistungsbeschreibung** — Trainingsplanungs-App, Free-Umfang vs. Pro-Umfang klar abgegrenzt; Recht auf Weiterentwicklung/Änderung von Features mit Zumutbarkeitsgrenze (⚖️ § 327r BGB Änderungen bei digitalen Produkten).
3. **KEIN medizinischer Rat (Kernklausel)** — App ist kein Medizinprodukt, ersetzt keine ärztliche Beratung; Nutzung auf eigenes Risiko im Rahmen gesunder Freizeitsportler; Aufforderung, vor intensivem Training bei Vorerkrankungen ärztlichen Rat einzuholen. Konsistent mit Kap. 3 formulieren!
4. **Registrierung & Konto** — Mindestalter (16, konsistent mit Consent-Flow), Wahrheitspflicht, Kontosicherheit.
5. **Abo-Bedingungen** — Preise (9,99 €/Monat, 79,99 €/Jahr), Abwicklung/Kündigung über App-Store-Mechanismen, automatische Verlängerung mit Hinweispflichten, Preisänderungsklausel (⚖️ eng!), ggf. Testphasen, Founder-Preis-Konditionen.
6. **Widerrufsrecht** — Digitale Inhalte/Dienstleistungen, Belehrung + Muster; Zusammenspiel mit Store-Erstattungsregeln (⚖️).
7. **Verfügbarkeit** — Angemessene Verfügbarkeit ohne Garantie (Formulierungsziel: keine konkrete SLA-Zusage im B2C, aber § 327e BGB Mängelrechte beachten), Wartungsfenster, Abhängigkeit von Dritt-Diensten (Garmin/Apple/Google-APIs können sich ändern).
8. **Nutzungsrechte & Pflichten** — Einfache Lizenz, kein Reverse Engineering (Grenzen beachten), Fair Use, keine Weitergabe.
9. **Nutzerdaten & Export** — Verweis auf DSE; Bestätigung des freien Datenexports (USP vertraglich verankern — Vertrauenssignal).
10. **Haftungsbegrenzung (Kernklausel)** — Unbeschränkt für Vorsatz/grobe Fahrlässigkeit sowie Leben/Körper/Gesundheit (zwingend, nicht abdingbar!); im Übrigen Begrenzung auf vorhersehbare, vertragstypische Schäden bei Verletzung wesentlicher Pflichten; Klarstellung: keine Haftung für Trainingsentscheidungen des Nutzers, für Richtigkeit von Wearable-Fremddaten (⚖️ — AGB-rechtlich heikelster Teil, Standard-Formulierungen vom Anwalt).
11. **Laufzeit, Kündigung, Kontolöschung** — inkl. In-App-Löschweg.
12. **Änderungen der AGB** — Mitteilungs-/Zustimmungsmechanik (⚖️).
13. **Schlussbestimmungen** — Deutsches Recht mit Verbraucherschutz-Vorbehalt, Streitbeilegungs-Hinweise (Verbraucherschlichtung), salvatorische Klausel.

EN-Version: Übersetzung derselben AGB (nicht separates US-Rechtsdokument) mit Klausel „deutsche Fassung maßgeblich" — Verkauf in weitere Rechtsräume später gesondert prüfen ⚖️.

---

## 5. Jahres-Compliance-Kalender

| Rhythmus | Monat (Vorschlag) | Aufgabe |
|---|---|---|
| Quartal | Mär/Jun/Sep/Dez | Backup-Restore-Test; Zugriffs-/2FA-Check aller Admin-Accounts; AVV-Liste gegen tatsächlich genutzte Dienste abgleichen (Schatten-Dienste?) |
| Quartal | dito | Stores: Privacy-Nutrition-Label (Apple) & Data-Safety-Formular (Google) gegen realen Datenfluss prüfen (Pflichtangaben ändern sich mit Features!) |
| Jährlich | Januar | USt-/ESt-Fristen mit Steuerberater fixieren; EÜR-Vorbereitung; Kleinunternehmergrenzen (25 T€/100 T€) gegen Ist-Umsatz prüfen |
| Jährlich | Februar | DSE App+Web Review: neue Features/Prozessoren eingepflegt? Consent-Versionen aktuell? Löschkonzept-Fristen laufen technisch? |
| Jährlich | März | DSFA-Review (neue Risiken? neue Datenarten?); TOM-Liste aktualisieren; Datenpannen-Prozess einmal trocken durchspielen |
| Jährlich | April | MDR-Sprach-Audit: alle Store-Texte, Website, Top-20-Videos gegen Kap.-3-Tabelle; Zweckbestimmungs-Statement re-signieren; Regulatorik-News prüfen (MDR-Guidance, HWG, EU Data Act/AI-Act-Relevanz ⚖️ bei Unklarheit) |
| Jährlich | Mai (Launch-Jubiläum) | AGB-Review-Anlass sammeln: Gab es Streitfälle/Störungen? Preisänderungen geplant? → ggf. Anwalts-Update |
| Jährlich | Juli | Versicherungscheck (Deckungssumme vs. gewachsenem Umsatz/Nutzerzahl, s. Kap. 6); Apple-Developer-Renewal (99 $) |
| Jährlich | Oktober | Betroffenenrechte-Selbsttest: einmal selbst Auskunft + Export + Löschung als Testnutzer durchspielen und Zeit messen (< 1 Monat?) |
| Laufend | — | Jede Store-Ablehnung / Behördenpost / Abmahnung: dokumentieren, Fristen notieren, bei Rechtsthemen sofort ⚖️ |

---

## 6. Versicherungen (kurz)

| Versicherung | Wann sinnvoll | Kostenrahmen (Recherche) |
|---|---|---|
| **IT-Berufs-/Vermögensschadenhaftpflicht** (inkl. Betriebshaftpflicht-Baustein) | **Spätestens zum Public Launch** (zahlende Nutzer + Gesundheitsdaten = reale Anspruchsszenarien: Datenpanne, Sync-Fehler mit Folgeschaden-Behauptung, Abmahn-Abwehrkosten oft mitversichert). Für die reine Beta mit Handvoll Testern noch verzichtbar — Risikoabwägung. | Für Solo-IT-Freelancer/Entwickler ab ca. **12,50 €/Monat**, typisch grob **150–500 €/Jahr** je nach Umsatz und Deckung (Anbieter u. a. exali, Hiscox, andsafe); vgl. [finanzchecks.de IT-Haftpflicht-Vergleich](https://www.finanzchecks.de/berufshaftpflichtversicherung/it-haftpflichtversicherung/vergleich), [Hiscox IT-Haftpflicht](https://www.hiscox.com/small-business-insurance/professional-business-insurance/it-insurance). Beim Abschluss explizit angeben: App mit Gesundheits-/Fitnessdaten, B2C, USA-Nutzer ja/nein (US-Deckung ist oft Ausschluss/ Aufpreis — für EN-Launch klären!) |
| **Cyber-Baustein** | Oft in IT-Policen integrierbar (Eigenschäden, Forensik, DSGVO-Bußgeld-Abwehr soweit versicherbar) | Aufpreis meist im niedrigen zweistelligen €/Monat-Bereich — Angebot einholen |
| **Rechtsschutz (Firmen)** | Optional Jahr 2+, wenn Abmahn-/Vertragsrisiken real werden | Nachrangig bei knappem Budget |
| Private Absicherung | Unabhängig von ORVIA: private Haftpflicht + BU als Azubi ohnehin sinnvoll | — |

**Nicht nötig zum Start:** Betriebsinhalts-, D&O- (keine Kapitalgesellschaft), Produkthaftpflicht für physische Produkte.

---

## Quellen (Auswahl)

- MDR/Software-Qualifizierung: [MDCG 2019-11 (EU-Kommission, PDF)](https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf), [Johner-Institut zu Software als Medizinprodukt](https://blog.johner-institute.com/iec-62304-medical-software/software-as-medical-device-definition-and-classification/), [mediacc zu MDCG 2019-11](https://www.mediacc.de/en/medizinprodukte-wiki/mdcg-2019-11-leitfaden-zur-qualifizierung-und-klassifizierung-von-software-unter-mdr-ivdr)
- AGB-Kosten: [derstartupanwalt.de](https://www.derstartupanwalt.de/news/agb-erstellen-lassen), [advocado AGB-Ratgeber](https://www.advocado.de/ratgeber/unternehmensrecht-und-betriebsnachfolge/agb/agb-erstellen-lassen.html), [KRAUS GHENDLER App-AGB](https://anwalt-kg.de/allgemeine-geschaeftsbedingungen/android-ios-app-agb/)
- IT-Haftpflicht: [finanzchecks.de Vergleich (ab 12,50 €/Monat)](https://www.finanzchecks.de/berufshaftpflichtversicherung/it-haftpflichtversicherung/vergleich), [Hiscox](https://www.hiscox.com/small-business-insurance/professional-business-insurance/it-insurance)

*Alle mit ⚖️ markierten Punkte sowie DSE, AGB, Zweckbestimmung und die umsatzsteuerliche Behandlung der Store-Erlöse sind vor Verwendung anwaltlich bzw. steuerlich prüfen zu lassen. Dieses Dokument ersetzt keine Rechts- oder Steuerberatung.*
