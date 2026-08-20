# ORVIA Masterplan — Band 8: KPI-System, B2B-Detailplan und Skalierungspfad

**Stand:** August 2026 · **Bezug:** Band 4 (Finanzmodell) liefert die Szenarien Basis/Worst/Best; dieser Band definiert, *woran* der Fortschritt gemessen wird, *wie* aus B2C ein zweites Standbein wird und *wann* welche Skalierungsschritte rechnerisch vertretbar sind. Eigene Setzungen sind als **[Annahme]** gekennzeichnet; alle Rechenwege sind gezeigt.

---

## 1. KPI-System

### 1.1 North-Star-Metrik: WAU-2

**Definition:** *WAU-2 = Anzahl Nutzer, die in einer Kalenderwoche an mindestens 2 verschiedenen Tagen eine Kernaktion ausgeführt haben* (Kernaktion = Training aufgezeichnet/synchronisiert ODER Trainingsplan-Einheit abgehakt ODER Analyse-Screen ≥ 30 s betrachtet).

Warum WAU-2 und nicht MAU oder Downloads:
1. Sie misst **Gewohnheit**, nicht Neugier — und Gewohnheit ist bei 9–13 % Median-Churn (Fitness) der einzige Churn-Schutz. Ein Nutzer mit 2+ aktiven Tagen/Woche hat die App in seine Trainingsroutine integriert.
2. Sie ist vom Solo-Entwickler **direkt beeinflussbar** (Onboarding, Plan-Erinnerungen, Sync-Zuverlässigkeit), während Downloads stark von externem Rauschen abhängen.
3. Sie führt kausal zu Umsatz: zahlende Nutzer rekrutieren sich fast ausschließlich aus habitualisierten Nutzern (H&F-D30-Retention 3–8 % vs. Download→Paid 2,9 % — die Mengen sind fast deckungsgleich).

**Abgeleitete Kennzahl:** WAU-2-Quote = WAU-2 / MAU. **[Annahme] Ziel: ≥ 25 % ab Monat 6.**

### 1.2 Metrik-Katalog (vollständig)

| Metrik | Definition (exakt) | Messmethode/Tool | Ziel Phase 1 (M1–6) | Ziel Phase 2 (M7–18) | Ziel Phase 3 (M19+) |
|---|---|---|---|---|---|
| **WAU-2** (North Star) | s. o., Kalenderwoche Mo–So | TelemetryDeck-Signal `core_action` mit Tages-Dedupe | Wachsend, >500 | >2.000 | >6.000 |
| D1-Retention | Anteil einer Install-Kohorte mit Session an Tag 1 | TelemetryDeck Kohorten | ≥ 22 % (H&F-Korridor 20–27 %) | ≥ 25 % | ≥ 27 % |
| D7-Retention | dito Tag 7 | TelemetryDeck | ≥ 10 % **[Annahme: Interpolation D1/D30]** | ≥ 12 % | ≥ 14 % |
| D30-Retention | dito Tag 30 | TelemetryDeck | ≥ 4 % (Korridor 3–8 %) | ≥ 6 % | ≥ 8 % |
| Trial-Start-Rate | Trials gestartet / Downloads (D30) | RevenueCat | ≥ 6,9 % (Median) | ≥ 9 % | ≥ 13,5 % (Top-Quartil) |
| Trial→Paid | bezahlte Konversionen / abgelaufene Trials | RevenueCat | ≥ 30 % | ≥ 37,7 % (Median) | ≥ 45 % |
| Download→Paid (D35) | Zahler / Downloads der Kohorte | RevenueCat | ≥ 2,1 % (Freemium-Median) | ≥ 2,9 % | ≥ 4,5 % |
| Monatl. Churn (blended) | gekündigte + nicht verlängerte Abos / Bestand Monatsanfang | RevenueCat Charts | ≤ 9 % | ≤ 8 % | ≤ 6 % |
| Jahres-Renewal | Verlängerungsquote der Jahresabo-Kohorte | RevenueCat | — (erste Kohorte M13) | ≥ 33 % (Benchmark) | ≥ 40 % |
| NPS | Standardfrage in-App, Skala 0–10, %Promotoren − %Detraktoren; Sample ≥ 30/Quartal | Eigenes In-App-Sheet → Supabase (keine Drittanbieter nötig) | > 20 | > 35 | > 45 |
| Sync-Erfolgsrate | erfolgreiche Sync-Jobs / gestartete Sync-Jobs (Server-seitig) | Supabase-Logs + eigene Metrik-Tabelle | ≥ 97 % | ≥ 98,5 % | ≥ 99 % |
| Crash-Rate | crashfreie Sessions / Sessions | Sentry (EU-Datenresidenz) oder Xcode Organizer/Play Vitals | ≥ 99 % | ≥ 99,5 % | ≥ 99,7 % |
| MRR netto / Zahler-Bestand | It. Band 4 | RevenueCat | Pfad Band 4 | Pfad Band 4 | Pfad Band 4 |

### 1.3 Tool-Entscheidung: datenschutzkonforme Analytics für eine Health-App

Randbedingung: ORVIA verarbeitet Gesundheits-/Trainingsdaten (DSGVO Art. 9). **Verbindliche Regel: Trainings- und Körperdaten verlassen nie den Produkt-Backend-Pfad (Supabase, EU-Region); in Analytics-Tools fließen ausschließlich anonyme Nutzungsereignisse ohne Gesundheitsinhalt** (z. B. `workout_synced` ja/nein, nie Puls/Pace/Gewicht).

Geprüfte Optionen (Websuche, Stand 2026):

| Tool | Sitz/Hosting | Bewertung für ORVIA |
|---|---|---|
| **TelemetryDeck** | Deutschland/EU, privacy-first, anonymisiert client-seitig; Anbieter positioniert sich explizit als DSGVO-konform ohne personenbezogene Profile → i. d. R. kein Consent-Banner für die reine Nutzungsstatistik nötig | **Gewählt** für Produkt-Analytics: geringes Volumen-Pricing, Swift-/Kotlin-SDKs, kein PII-Risiko |
| PostHog (EU-Cloud Frankfurt) | US-Anbieter, EU-Datenresidenz wählbar | Zweite Wahl / spätere Option ab Phase 3, wenn Funnels/Feature-Flags/Session-Analyse nötig werden; erfordert saubere AVV- und Consent-Prüfung |
| Firebase/GA4 | US | **Ausgeschlossen** (Datentransfer-/Einwilligungsrisiko bei Health-Kontext, Schrems-Folgerisiken) |
| RevenueCat | Abo-Infrastruktur | Gesetzt für alle Monetarisierungs-KPIs; kostenlos bis $2.500/Monat, danach ~1 % (in Band 4 eingepreist) |

Rechtlicher Rest **[mit Anwalt/Datenschutz-Generator zu validieren]**: Datenschutzerklärung mit TelemetryDeck/RevenueCat/Sentry als Empfängern, AVVs abschließen, App-Store-Privacy-Labels konsistent halten.

### 1.4 Wöchentliches Dashboard-Template

Jeden Montag, 30 Minuten, feste Tabelle (Notion/Sheet, Werte aus RevenueCat + TelemetryDeck kopiert):

```
Woche __ / KW __        Vorwoche   Diese Woche   Δ %   Ziel   Status
Downloads                ______     ______       __    __     🟢🟡🔴
Trial-Starts             ______     ______       __    __
Trial-Start-Rate         ______     ______       __    ≥6,9%
Neue Zahler              ______     ______       __    __
Kündigungen              ______     ______       __    __
Zahler-Bestand           ______     ______       __    Pfad B4
MRR netto                ______     ______       __    Pfad B4
WAU-2 ★                  ______     ______       __    __
D1 / D30 (letzte Kohorte)______     ______       __    22%/4%
Sync-Erfolg              ______     ______       __    ≥97%
Crash-frei               ______     ______       __    ≥99%
Top-Anomalie der Woche: ____________  → 1 Maßnahme: ____________
```

Regel: **Pro Woche wird genau eine Metrik zur „Fokus-Metrik" erklärt** und genau eine Maßnahme dagegen gestellt — mehr ist bei 20 h/Woche Selbstbetrug.

### 1.5 Monats-Review-Ritual (erster Samstag, 2 h)

1. **Ist vs. Band-4-Pfad** (Zahler, MRR, Kosten) — Abweichung > ±25 % schriftlich erklären.
2. **Kohortenblick:** D1/D7/D30 der letzten 3 Install-Kohorten nebeneinander — verbessert sich die *jüngste* Kohorte? (Nur das beweist, dass Maßnahmen wirken.)
3. **Kill-Kriterien-Check** (Band 4, Kap. 7): jede Schwelle explizit mit Ja/Nein beantworten und datieren.
4. **Churn-Autopsie:** 5 Exit-Antworten oder Support-Fälle lesen; 1 Retention-Hypothese für den Folgemonat.
5. **Entscheidungslog:** eine Seite — was wurde entschieden, was bewusst *nicht* getan. (Schützt vor Zick-Zack bei Solo-Entscheidungen.)

---

## 2. B2B-Detailplan: Coach-Tier

### 2.1 Produktspezifikation

**Rollenmodell:** Coach (Verwaltung, Plan-Zuweisung, Einsicht) · Athlet (normale App, teilt Daten explizit pro Coach frei — DSGVO: Einwilligung je Datenkategorie, widerrufbar) · später Vereins-Admin (Abrechnung, Gruppenverwaltung).

**Funktionsumfang Coach-Tier (MVP → Ausbau):**

| Stufe | Funktionen |
|---|---|
| MVP (Pilot) | Coach-Webansicht: Athletenliste, Wochen-Compliance (geplant vs. absolviert), Kommentarfunktion, Plan-Vorlagen zuweisen |
| V2 | Plan-Builder mit Bausteinen, Auto-Alerts (verpasste Einheiten, Belastungssprünge), Gruppen |
| V3 | Vereinsverwaltung, CSV/TrainingPeaks-Import, Abrechnung pro Untergruppe |

Athleten eines zahlenden Coaches erhalten Pro-Funktionen kostenlos **[Annahme]** — das macht das Coach-Abo zum Akquisekanal (jeder Coach bringt ~10 Endnutzer, die nach Coach-Ende zu regulären Pro-Kandidaten werden).

### 2.2 Preismodell: drei Varianten durchgerechnet

Vorbild TrainingPeaks: ~$21,99/Monat Basis + $9 pro Premium-Athlet, gestaffelt bis $4,50 ab 1.000 Athleten. ORVIA positioniert sich **deutlich darunter** (junges Produkt, kein Feature-Parität-Anspruch).

**Varianten [alle Preise Annahmen]:**
- **A — Pro Athlet:** 6 €/Athlet/Monat, kein Grundpreis.
- **B — Flat:** 39 €/Monat, unbegrenzte Athleten.
- **C — Staffel (Empfehlung):** 19 €/Monat Grundpreis inkl. 5 Athleten, +4 €/Athlet (6.–20.), +3 €/Athlet ab dem 21.

Monatskosten je Coach nach Athletenzahl (Python-berechnet):

| Athleten | A (6 €/Athlet) | B (Flat 39 €) | C (Staffel) | Günstigste |
|---:|---:|---:|---:|---|
| 5 | 30 € | 39 € | 19 € | C |
| 8 | 48 € | 39 € | 31 € | C |
| 12 | 72 € | 39 € | 47 € | B |
| 20 | 120 € | 39 € | 79 € | B |
| 30 | 180 € | 39 € | 109 € | B |

Bewertung:
- **A** skaliert sauber mit dem Wert, bestraft aber genau die attraktiven großen Coaches (72 €+ ist über TrainingPeaks-Niveau → Abwanderungsgrund) und hat keine Einstiegs-Hürdensenkung.
- **B** ist maximal einfach, lässt aber bei großen Coaches massiv Geld liegen (30 Athleten für 1,30 €/Athlet) und zieht „Sammelaccounts" an (ein Flat-Account für den ganzen Verein).
- **C** kombiniert niedrigen Einstieg (19 € — unter TrainingPeaks-Basis) mit fairer Skalierung und deckelt den Großkunden-Preis durch die 3-€-Stufe. **Entscheidung: Variante C**, Jahresvorauszahlung −15 % **[Annahme]**, direkt fakturiert (Web-Checkout/Stripe, kein Store-Cut — dafür USt-Pflicht beachten, Band 4 Kap. 6.2).

### 2.3 Zielkunden und Vertriebsweg (DACH-first)

| Segment | Größe/Charakteristik | Zugang |
|---|---|---|
| Selbstständige Lauf-Coaches | viele Einzelkämpfer, 5–30 Athleten, preissensibel, oft nur WhatsApp+Excel | Lauf-Communities (Foren, Instagram-Coaches, laufen.de-Umfeld), direkte Ansprache **[Annahme: 10 Erstgespräche/Monat machbar bei 2 h/Woche Vertrieb]** |
| Triathlon-Coaches | TrainingPeaks-sozialisiert, anspruchsvoll, zahlungskräftiger | Tri-Vereine, Wettkampf-Expos, Differenzierung über Preis + deutsche UX + Datenschutz |
| Vereine (DLV-/DTU-Landesverbände, LG-Trainingsgruppen) | lange Entscheidungswege, aber hohe Stückzahlen und geringe Kündigung | Verbandskooperationen erst ab Referenzen (2029+); Einstieg über einzelne Übungsleiter |

Vertriebsprinzip: **kein Outbound-Kaltvertrieb im großen Stil** (Zeitbudget!), sondern (1) In-App-Brücke — Athleten laden ihren Coach ein, (2) Community-Content (Fallstudien der Piloten), (3) Empfehlungsprogramm Coach-wirbt-Coach (1 Monat frei) **[Annahme]**.

### 2.4 Pilotprogramm (Q1–Q2 2028)

**Design:** 5 Coaches · 3 Monate kostenlos · schriftliche Gegenleistung: 2 Feedback-Calls à 30 min/Monat, Erlaubnis zur anonymisierten Fallstudie, Preisbereitschafts-Interview am Ende.

**Erfolgskriterien (vorab fixiert, UND-verknüpft für „Go"):**

| Kriterium | Schwelle | Messung |
|---|---|---|
| Aktivierung | ≥ 4 von 5 Coaches legen ≥ 5 Athleten an und weisen Pläne zu | Admin-Daten |
| Nutzung | Coach-Login ≥ 2×/Woche über die Monate 2–3 | TelemetryDeck (Coach-Web) |
| Athleten-Effekt | WAU-2-Quote der Coach-Athleten ≥ 1,5× der Normalnutzer | Kohortenvergleich |
| Zahlungsbereitschaft | ≥ 3 von 5 wollen zu Variante-C-Preisen verlängern | Interview + tatsächliche Konversion |

„Go" → öffentlicher Coach-Launch Q3 2028. Zwei oder mehr Kriterien verfehlt → B2B um 12 Monate verschieben, Ursachen in V2-Backlog.

### 2.5 Corporate-Wellness-Pfad (Wellhub / EGYM Wellpass)

Fakten: Vergütung erfolgt pro aktivem Nutzer; Konditionen sind nicht öffentlich und werden verhandelt; Aufnahme als App-Partner ist realistisch **erst mit Markenbekanntheit**. Whoop bedient Firmen über „Unite" mit verhandelten Enterprise-Konditionen — d. h. auch dort: kein Selbstbedienungs-Listing, sondern BD-Arbeit.

Konsequenz für ORVIA:

| Voraussetzung vor Erstkontakt | Zielwert | Frühester Zeitpunkt |
|---|---|---|
| Nachweisbare aktive Basis | ≥ 10.000 MAU, WAU-2-Quote ≥ 25 % | frühestens 2029 (Basis-Szenario) **[Annahme]** |
| Firmentaugliche Features | SSO-freie einfache Einlösung, Nutzungsreport je Arbeitgeber, DSGVO-Auftragsverarbeitung | V3 |
| Payout-Logik verstehen | Vergütung pro *aktivem* Nutzer/Monat → das KPI-System (WAU-2!) ist exakt die Währung dieser Deals | — |

Planungsregel: Corporate Wellness wird bis 2029 mit **0 € Umsatz** angesetzt (Option, kein Plan) — jede frühere Energie darauf wäre Ablenkung ohne Verhandlungsposition.

### 2.6 B2B-Umsatzmodell 2028–2030 (Szenariorechnung)

**[Annahmen]:** Variante C, Ø 10 Athleten/Coach → 19 € + 5 × 4 € = **39 €/Coach/Monat**; Coach-Churn vernachlässigt (Jahresrechnungen, B2B churnt träger); Pilot (5 Coaches) unbezahlt; Basis-Hochlauf zahlender Coaches: Ende 2028: 15 · Ende 2029: 40 · Ende 2030: 90. Konservativ-Variante: die Hälfte; Ambitioniert: 200 Coaches Ø 12 Athleten (C(12) = 19 + 4×7 = 47 €).

| Jahr (Endstand) | Konservativ | Basis | Ambitioniert |
|---|---:|---:|---:|
| 2028: Coaches / B2B-MRR | 8 / 312 € | 15 / 585 € | 25 / 1.175 € |
| 2029: Coaches / B2B-MRR | 20 / 780 € | 40 / 1.560 € | 90 / 4.230 € |
| 2030: Coaches / B2B-MRR | 45 / 1.755 € | 90 / 3.510 € | 200 / 9.400 € |
| 2030: B2B-Jahresumsatz (Run-Rate) | ~21.060 € | **~42.120 €** | ~112.800 € |

Einordnung: Im Basis-Fall liefert B2B Ende 2030 ~3.500 €/Monat zusätzlich zu ~12–14 k€ B2C-MRR (Band 4) — **~20 % Umsatzanteil ohne Store-Cut**, mit strukturell niedrigerem Churn und als strategische Absicherung gegen B2C-Plattformrisiken. Zweiteffekt unbeziffert: 90 Coaches × 10 Athleten = 900 gebundene Endnutzer als Retention- und Akquise-Anker.

---

## 3. Skalierungspfad

### 3.1 Erste Freelancer (Trigger-basiert, nicht datumsbasiert)

| Rolle | Trigger (messbar) | Umfang/Kosten [Annahme] | Begründung |
|---|---|---|---|
| Support (VA, DE/EN) | > 1.500 zahlende Nutzer ODER > 25 Tickets/Woche ODER Antwortzeit > 48 h über 4 Wochen | 5–10 h/Woche, ~300–600 €/Monat | Bei ~1 Ticket/Woche je 60 Zahler **[Annahme]** kippt Support ab ~1.500 Zahlern das 20-h-Budget; im Basis-Szenario ~Monat 33, im Best-Fall Monat ~10 |
| Übersetzung (FR/ES/IT) | Entscheidung 3. Sprache, frühestens nach stabiler EN-Kohorten-Retention (D30 ≥ 4 % in EN) | projektweise ~1.500–2.500 €/Sprache | Lokalisierung vor Produkt-Fit verbrennt Geld doppelt (jede Iteration × n Sprachen) |
| Design (UI-Polish, Store-Assets) | punktuell ab Launch; fest ab MRR netto > 5.000 € | projektweise 500–1.500 € | Conversion-Hebel (Paywall/Screenshots) rechtfertigt Zukauf früher als alles andere |
| Content/ASO | MRR netto > 3.000 € und organischer Kanal nachweislich konvertierend | 200–500 €/Monat | Skaliert den einzigen erlaubten Akquisekanal (Band 4: Paid-Ads-Sperre) |

Reihenfolge im Zweifel: **Support vor Content vor Design vor Übersetzung** — alles, was Gründerzeit freisetzt, schlägt alles, was Output hübscher macht.

### 3.2 Vollzeit-Sprung des Gründers (konservativ gerechnet)

**Rechenweg [Annahmen gekennzeichnet]:**

```
Azubi-Nettogehalt heute:            ~1.100 €/Monat [Annahme]
Lebenshaltung selbständig:          ~2.600 €/Monat netto [Annahme, inkl. Miete/Puffer]
+ KV/PV freiwillig, Altersvorsorge, ESt → benötigter Gewinn vor Steuern/Abgaben:
  2.600 € / (1 − 0,35) = 4.000 €/Monat [Faustregel 35 % Abgabenlast]
Schwelle: MRR netto − laufende Kosten ≥ 4.000 €  … über 6 Monate in Folge
+ Rücklage: 6 Monatsausgaben ≈ 6 × 2.600 € ≈ 16.000 € liquide [Annahme]
```

**Abgleich mit den Szenarien (Band 4):**

| Szenario | MRR netto − Kosten ≥ 4.000 € erstmals | + 6 Monate Bestätigung | Realistischer Vollzeit-Termin |
|---|---|---|---|
| Basis | Monat 18 (Okt 2028) | Monat 24 (Apr 2029) | **Mitte 2029** — passt zum Azubi-Abschluss **[Annahme: Ausbildungsende ≈ Sommer 2029]**; Rücklage ist aus kumuliertem Gewinn (M24: ~90 k€ vor Steuern) mehrfach gedeckt |
| Best | Monat 5–6 (Herbst 2027) | Frühjahr 2028 | Vollzeit ab 2028 möglich; Ausbildung trotzdem abschließen **[Empfehlung: Fallback-Wert des Abschlusses > 12 Monate Zeitgewinn]** |
| Worst | nie (Plateau ~650 €/Monat) | — | Kein Vollzeit-Pfad; Kill-Kriterien Band 4 greifen vorher |

Harte Regel: **Kein Vollzeit-Sprung auf Basis eines einzelnen guten Monats oder von Founder-/Lifetime-Einmalerlösen — nur wiederkehrender MRR zählt.**

### 3.3 Team-Aufbau-Reihenfolge (nach Vollzeit-Sprung)

1. Freelancer-Gerüst festigen (Support, Content) — keine Festanstellungen unter 15 k€ MRR netto **[Annahme]**.
2. Zweite Entwicklerkraft (Freelance → Teilzeit) ab ~20 k€ MRR **[Annahme]**: zuerst Plattform-Doppelung (Android/iOS-Parität), nicht neue Features.
3. B2B-Care (Teilzeit) sobald > 50 zahlende Coaches — B2B-Kunden erwarten Ansprechbarkeit.
4. Erst danach Marketing-Rolle; bis dahin bleibt Wachstum Gründer-Aufgabe.

### 3.4 Finanzierung: Bootstrapping vs. Angel vs. VC — für *diesen* Fall

| Option | Pro (ORVIA-spezifisch) | Contra (ORVIA-spezifisch) | Urteil |
|---|---|---|---|
| **Bootstrapping** | Kostenbasis ~23–200 €/Monat ist selbstfinanzierend ab Monat 2 (Band 4); volle Kontrolle; Kill-Kriterien bleiben ehrlich; kein Druck, Health-Daten zu monetarisieren | Langsamer; 20-h-Flaschenhals bleibt bis 2029 | **Standardpfad.** Ein profitables Solo-Abo-Geschäft braucht kein Fremdkapital |
| **Angel (25–100 k€)** | Könnte Freelancer-Budget und Vollzeit-Sprung ~12 Monate vorziehen; Smart Money öffnet ggf. Wellpass-/Verbandstüren | Minderjährigkeits-/Ausbildungssituation und Einzelunternehmen erfordern erst GmbH-Umwandlung (Kosten, Notar, Buchhaltungspflichten ~5–10 k€/Jahr Mehraufwand **[Annahme]**); Bewertungsverhandlung vor Traction ist strukturell schlecht | Nur sinnvoll **nach** nachgewiesenem Basis-Pfad (M12-Meilenstein erreicht) und nur mit branchenkundigem Angel |
| **VC** | Einziger Weg zum 500-Mio-Pfad (s. u.) | Passt nicht zum Ist-Zustand: VC braucht GmbH, Vollzeit-Founder(-Team), Top-1-%-Metriken und Health-Daten-Compliance auf Enterprise-Niveau; ein 20-h-Azubi-Solo-Projekt ist nicht investierbar und *sollte* es zu diesem Preis (Kontrollverlust, Wachstumszwang, Datennutzungsdruck) auch nicht sein | Frühestens 2029/2030, und nur bei Best-Case-Metriken **und** explizitem Wunsch, aus dem Lifestyle-Business ein Venture-Business zu machen |

### 3.5 Was ein 500-Mio-Pfad konkret erfordern würde

Referenzpunkte (Websuche + Faktenliste): **Whoop** — ~$1,1 Mrd ARR; Series G über **$575 Mio bei $10,1 Mrd Bewertung (März 2026)**, davor über Serien A–F kumuliert deutlich über eine halbe Milliarde USD eingesammelt; Hardware+Subscription, ~10 Jahre bis zur Milliarden-ARR. **Strava** — gegründet 2009, ~$490 Mio ARR bei ~50 Mio MAU und nur ~2 % Zahlern; brauchte **15+ Jahre** und Wagniskapital im hohen zweistelligen bis dreistelligen Millionenbereich (u. a. $110 Mio Series F 2020, Bewertung $1,5 Mrd), um dahin zu kommen.

Rückrechnung auf ORVIA:

```
500 Mio € Bewertung bei SaaS-Multiple 8–10× ARR  →  benötigt ~50–60 Mio € ARR
Strava-Modell (2 % zahlend, ~6,57 € netto/Monat): 50 Mio € ARR / (78,84 €/Zahler/Jahr)
  ≈ 634.000 Zahler  →  bei 2 % Zahlerquote ≈ 30+ Mio Nutzer
Zum Vergleich Basis-Szenario M36: 1.789 Zahler → Faktor ~350×
```

Erforderliche Meilensteine (jeder einzelne ist Bedingung, keiner hinreichend):

| Stufe | Meilenstein | Kapitalbedarf-Größenordnung **[Annahme, an Whoop/Strava-Historie kalibriert]** |
|---|---|---|
| 1 (2027–29) | Top-1-%-Metriken organisch beweisen: D30 ≥ 8 %, Trial→Paid > 50 %, Churn ≤ 5 % | 0 € (Bootstrapping) |
| 2 (2029–30) | GmbH, Vollzeit-Team 3–5, 1 Mio+ Downloads/Jahr, ~1–2 Mio € ARR | Seed 1–3 Mio € |
| 3 (2031–33) | Internationalisierung 10+ Märkte, Zahlerbasis > 100 k, ggf. Hardware-/Sensor-Integration als Differenzierung | Series A/B 10–40 Mio € |
| 4 (2034+) | 30+ Mio Nutzer oder Whoop-artiger High-ARPU-Pivot (Hardware-Abo) | kumuliert 100 Mio €+ |

**Nüchternes Fazit:** Der 500-Mio-Pfad ist mit diesem Setup eine Option mit Wahrscheinlichkeit im Promillebereich und würde das Geschäftsmodell (Solo, datensparsam, bootstrapped) vollständig ersetzen. Der Masterplan optimiert deshalb auf den kontrollierbaren Pfad — profitables 10–15 k€-MRR-Geschäft bis 2030 mit B2B-Zweitstandbein — und hält den Venture-Pfad ausschließlich als dokumentierte Abzweigung bereit, deren Eintrittskarte die Stufe-1-Metriken sind. Diese Metriken zu erreichen ist ohnehin identisch mit dem, was der Bootstrap-Pfad verlangt: Es gibt bis mindestens 2029 **keinen Zielkonflikt**.

---

**Quellen:** [TelemetryDeck: Europe-based app analytics](https://telemetrydeck.com/blog/europe-based-app-analytics-service/) · [TelemetryDeck: Best App Analytics Services 2026](https://telemetrydeck.com/app-analytics-tools-you-should-know-about/) · [PostHog: GA4-Alternativen (EU-Hosting)](https://posthog.com/blog/ga4-alternatives) · [TechCrunch: Whoop Series G, $10 Mrd Bewertung](https://techcrunch.com/2026/03/31/whoop-valuation-10b-series-g-fundraise/) · [Whoop Pressemitteilung: $575 Mio Series G](https://www.whoop.com/us/en/press-center/whoop-announces-series-g-funding/) · [Sacra: Whoop revenue & funding](https://sacra.com/c/whoop/) · [CB Insights: Strava Financials](https://www.cbinsights.com/company/strava/financials) · RevenueCat [State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps)
