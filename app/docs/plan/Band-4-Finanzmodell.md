# ORVIA Masterplan — Band 4: Finanzmodell

**Stand:** August 2026 · **Planungshorizont:** Mai 2027 – April 2030 (36 Monate) · **Status:** Verbindliche Planungsgrundlage, jährlich zu revidieren

> **Methodik-Hinweis:** Alle Zahlen in diesem Band wurden mit einem Python-Modell durchgerechnet (Skript im Anhang dokumentiert). Externe Benchmarks stammen aus dem RevenueCat *State of Subscription Apps 2026* und Adapty-Daten für Health & Fitness (H&F). Eigene Setzungen sind durchgängig als **[Annahme]** gekennzeichnet. Beträge in Euro, kaufmännisch gerundet.

---

## 1. Preis-Design im Detail

### 1.1 Preisarchitektur und Anker

| Tier | Preis | Netto nach Store-Cut (15 %) | Funktion im Pricing |
|---|---|---|---|
| Free | 0 € | — | Akquise, Trichter-Eingang, Word-of-Mouth |
| Pro monatlich | 9,99 €/Monat | 8,49 €/Monat | **Anker** — macht das Jahresabo attraktiv |
| Pro jährlich | 79,99 €/Jahr (14 d Trial) | 67,99 €/Jahr | Kernprodukt, Cashflow-Vorzieher |
| Founder-Lifetime | 149 € einmalig (~500 Stück) | 126,65 € | Launch-Kapital + Community-Kern |

Der Monatspreis 9,99 € ist bewusst **nicht** der Preis, den die meisten zahlen sollen — er ist der Referenzpunkt (Ankereffekt), gegen den 79,99 €/Jahr als „spare 33 %" wirkt. Die Benchmark stützt das: **68 % aller Abonnenten in Subscription-Apps wählen Jahresabos** (RevenueCat SoSA 2026). Die Paywall zeigt daher das Jahresabo vorselektiert, den Monatspreis daneben als Vergleichsgröße.

**Rechenweg Jahresrabatt:**

```
79,99 € / 12 = 6,666 €/Monat effektiv
Rabatt = 1 − 6,666/9,99 = 1 − 0,667 = 33,3 %
```

33 % liegt im branchenüblichen Korridor (25–50 %): hoch genug, um die Jahresentscheidung zu kippen, niedrig genug, um den Monatspreis nicht als „Abzocke" wirken zu lassen und um bei der bekannten Jahres-Renewal-Schwäche (**nur ~33 % verlängern nach Jahr 1**, RevenueCat) nicht zu viel Marge verschenkt zu haben.

**Blended-Umsatz pro Abonnent (verbindliche Modellgröße):**

```
0,32 × 9,99 € + 0,68 × 6,67 € = 3,20 € + 4,53 € = 7,73 € brutto/Monat
7,73 € × 0,85 (Store-Cut 15 %, Small Business Program) = 6,57 € netto/Monat
```

### 1.2 Trial-Länge: 14 Tage statt 7

Entscheidung: **14 Tage Trial auf dem Jahresabo, kein Trial auf dem Monatsabo.**

Begründung entlang der Benchmarks:

1. **Trial→Paid ist der stärkste Hebel im Trichter:** Median 37,7 %, Top-Quartil >51 %. Ein Trainings-Companion braucht mindestens zwei Trainingswochen, damit der Nutzer den Kernwert (Trainingssteuerung, Fortschritt, Sync) real erlebt — bei 7 Tagen hat ein 3×/Woche-Läufer erst 3 Einheiten absolviert, bei 14 Tagen 6. Der Aha-Moment (erster erkennbarer Trend) ist bei 14 Tagen deutlich wahrscheinlicher.
2. Die H&F-Retention (D1 20–27 %, D30 3–8 %) zeigt: Wer Tag 10–14 noch aktiv ist, gehört bereits zur obersten Nutzerschicht — genau diese Selektion soll die Trial-Conversion treffen.
3. Gegenargument (kürzere Trials konvertieren pro Start oft höher, weil die Kaufentscheidung nicht „versandet") wird durch die Trial-Erinnerung an Tag 12 (Push + E-Mail, wie von Apple ohnehin teilweise erzwungen) und ein In-Trial-Onboarding mit klarer Fortschrittsanzeige adressiert.
4. **[Annahme]** Ziel-Trial→Paid: 35 % im Jahr 1 (knapp unter Median, konservativ), 45 % ab Jahr 2.

Kontrollrechnung Download→Paid über den Trichter:

```
Median:      6,9 % (DL→Trial) × 37,7 % (Trial→Paid) = 2,60 %
Top-Quartil: 13,5 %            × 51 %               = 6,89 %
```

Das deckt sich mit dem direkt gemessenen Benchmark Download→Paid D35: Median 2,9 %, Top ~6 %. Das Basis-Szenario (Kap. 2) rechnet mit **2,9 %**, Worst mit 1,5 %, Best mit 6 %.

### 1.3 Paywall-Platzierung: Onboarding-Paywall + Feature-Gates (Hybrid)

Die Datenlage (RevenueCat-Ökosystem, Auswertungen über zehntausende Apps) ist eindeutig in der Richtung, wenn auch nicht in jeder Einzelzahl:

- **Freemium ohne Onboarding-Paywall konvertiert am schlechtesten pro Download:** Freemium-Median Download→Paid liegt bei **2,1 %** vs. 2,9 % Gesamt-Median (RevenueCat SoSA). Harte bzw. früh gezeigte Paywalls erzielen pro Download ein Mehrfaches an Conversion; ein dokumentierter Sub-Club-Case (RevenueCat) berichtet **+75 % LTV nach Umstellung von Freemium auf harte Paywall**. Auswertungen auf Basis von ~75.000 RevenueCat-Apps (Airbridge 2026) bestätigen: Onboarding-Paywalls maximieren Umsatz pro Install, Freemium maximiert Installs/Virality.
- ORVIA lebt aber vom Community-/Netzwerkeffekt und von organischem Wachstum (kein Ad-Budget) — eine vollharte Paywall würde den Free-Trichter abschneiden.

**Entscheidung (Hybrid):**

| Element | Platzierung | Zweck |
|---|---|---|
| Onboarding-Paywall (soft, wegklickbar) | Nach Onboarding-Schritt 4 (Zielsetzung), vor erstem Home-Screen | Fängt die Kaufbereiten früh; erwartete Haupt-Trial-Quelle |
| Feature-Gates | Erweiterte Analysen, Trainingspläne >1, Export, Coach-Sharing | Konvertiert engagierte Free-Nutzer ab Woche 2–4 |
| Kontextuelle Paywall | Nach 3. abgeschlossenem Training („Dein Trend ist da — schalte ihn frei") | Aha-Moment-Kopplung |

**Messregel:** Paywall-View→Trial-Start pro Platzierung wird ab Tag 1 getrennt getrackt (RevenueCat Paywalls + Experimente); die Onboarding-Paywall wird nie entfernt, nur variiert (A/B: Preisreihenfolge, Trial-Badge, Social Proof).

### 1.4 Founder-Lifetime-Mechanik

**Parameter:** 149 € einmalig, limitiert auf ~500 Stück, nur in den ersten Monaten nach Launch, danach dauerhaft entfernt.

**Rechenwege:**

```
Preisäquivalenz:      149 € / 79,99 € = 1,86 Jahresabos
Netto pro Stück:      149 € × 0,85 = 126,65 €
Maximalerlös (500):   500 × 149 € = 74.500 € brutto = 63.325 € netto
[Annahme] Absatz:     150 Stück in Monat 1–6 (25/Monat ≈ 2 % der frühen Downloads)
                      → 150 × 126,65 € = 18.997,50 € netto Launch-Kapital
```

Der volle Sellout (500 Stück) wäre bei ~7.300 Downloads in den ersten 6 Monaten eine Kaufquote von ~7 % auf ein 149-€-Produkt — unrealistisch; 150 Stück (~2 %) ist die Planungsgröße, 500 der Deckel.

**Kannibalisierungs-Risiko und Gegenmaßnahmen:**

| Risiko | Bewertung | Maßnahme |
|---|---|---|
| Lifetime-Käufer wären sonst Jahres-Abonnenten gewesen | Real, aber begrenzt: Break-even erst nach 1,86 Jahren; bei ~33 % Jahres-Renewal ist der Erwartungswert eines Jahresabo-Kunden über 2 Jahre ≈ 67,99 € + 0,33 × 67,99 € = 90,43 € netto < 126,65 € netto | Lifetime ist im Erwartungswert **besser** als ein Durchschnitts-Jahresabonnent — Kannibalisierung ist erst ab dem sehr loyalen Segment (>2 Renewals) negativ |
| Dauerhafte Serverkosten ohne wiederkehrenden Umsatz | 500 × Supabase-Grenzkosten ≈ vernachlässigbar (<0,05 €/Nutzer/Monat) | Deckel bei 500, keine zweite Lifetime-Runde |
| Signal „App könnte sterben" (Lifetime = Kassemachen) | Reputationsrisiko in Communities | Framing als „Founder-Programm": Name in Credits, Feature-Voting, Discord-Rolle |
| MRR-Optik verzerrt | Lifetime zählt nicht in MRR | In Reports strikt getrennt ausweisen (einmalig vs. MRR) |

### 1.5 Intro-Offers

**[Annahme]** Ab Monat 7 (nach stabiler Baseline) werden Intro-Offers getestet, nicht ab Launch (sonst keine saubere Trial-Baseline):

- **Win-back:** 39,99 € für das erste Jahr (−50 %) an gechurnte Trial-Nutzer nach 30 Tagen — adressiert die größte Verlustmasse im Trichter (62 % der Trials konvertieren nicht).
- **Saisonal:** Jahresstart (Januar) und Frühjahr — H&F-Nachfragespitzen; Angebot 59,99 € Jahr 1.
- **Regel:** Nie den Monatspreis rabattieren (zerstört den Anker), nie mehr als 2 Aktionen/Jahr (Rabatt-Erwartungshaltung), Renewal immer zum Vollpreis mit transparenter Ankündigung.

### 1.6 Regionale Preise

**[Annahme]** Orientierung an Apple-Preisstaffeln, Launch nur DE+EN, Stores aber global offen:

| Region | Monat | Jahr | Lifetime (Founder) | Logik |
|---|---|---|---|---|
| Euro-Zone | 9,99 € | 79,99 € | 149 € | Basis |
| USA | $9.99 | $79.99 | $149 | 1:1-Tier, kein Umrechnungs-Feintuning |
| UK | £8.99 | £69.99 | £129 | Apple-Standard-Tier unterhalb der Euro-Optik |
| Übrige (Tier-2/3-Märkte) | Auto-Preisstaffel der Stores | | — | Erst ab Lokalisierung >2 Sprachen aktiv bewerben |

Kein aggressives Emerging-Market-Pricing vor 2029: Support- und Churn-Kosten dieser Kohorten übersteigen bei einem Solo-Entwickler den Ertrag (LTV Jahr 1 Median liegt global bei nur ~$36/Zahler — in Tier-3-Märkten deutlich darunter).

---

## 2. 36-Monats-Finanzmodell — Basis-Szenario (Mai 2027 – April 2030)

### 2.1 Annahmen (vollständig)

| # | Parameter | Wert | Quelle/Status |
|---|---|---|---|
| A1 | Downloads Monat 1 | 1.000 | **[Annahme]** (Launch-Push: Product Hunt, Reddit, Lauf-Foren) |
| A2 | Download-Wachstum | +8 %/Monat bis Deckel 6.000/Monat | **[Annahme]** organisch + ASO; Deckel erreicht in Monat ~25 |
| A3 | Download→Paid | 2,9 % | Benchmark-Median D35 (RevenueCat) |
| A4 | Monatlicher Churn (blended) | 8 % | Oberkante „gut" (5–8 %) für H&F; **[Annahme]**: vereinfachend auf den ganzen Bestand angewendet, obwohl Jahresabos real klumpig churnen (~33 % Renewal) — die 8 %-Blended-Rate approximiert genau das |
| A5 | Netto-Umsatz/Abonnent | 6,57 €/Monat | Herleitung Kap. 1.1 |
| A6 | Founder-Lifetime | 150 Stück à 126,65 € netto, Monat 1–6 | **[Annahme]**, siehe 1.4 |
| A7 | Kosten | Supabase Pro ~23 €/Mo ab Monat 1; Apple 99 €/J; Domain 15 €/J; Google 23 € + Gewerbe 30 € + Steuerberater 250 € einmalig (M1); Steuerberater laufend 600 €/J ab Jahr 2 **[Annahme]**; RevenueCat 1 % des Brutto-MRR sobald >2.300 €/Mo | Faktenliste + [Annahme] |
| A8 | Marketing-Budget | 0 € (rein organisch) | Verbindlich bis LTV:CAC-Freigabe (Kap. 4) |
| A9 | Neuzahler-Timing | Conversion im Download-Monat wirksam | **[Annahme]** (vereinfacht; real +1 Monat Trial-Versatz — Effekt <1 Monatsumsatz Verschiebung) |

### 2.2 Modellmechanik (Formeln)

```
Downloads(m)   = min(1.000 × 1,08^(m−1), 6.000)
Neuzahler(m)   = Downloads(m) × 2,9 %
Abgänge(m)     = Bestand(m−1) × 8 %
Bestand(m)     = Bestand(m−1) − Abgänge(m) + Neuzahler(m)
MRR_brutto(m)  = Bestand(m) × 7,73 €      MRR_netto(m) = Bestand(m) × 6,57 €
Steady State   = Neuzahler/Churn = (6.000 × 0,029)/0,08 = 174/0,08 = 2.175 Abonnenten
                 → theoretisches MRR-netto-Plateau ≈ 14.290 €/Monat (asymptotisch, in 36 M nicht erreicht)
```

### 2.3 Quartalsverdichtete Ergebnistabelle (Basis)

Alle Werte gerundet; „Ende" = letzter Monat des Quartals; Umsatz enthält in Q1/Q2 die Founder-Erlöse (je 9.499 € netto).

| Quartal | Downloads Σ | Neuzahler Σ | Abgänge Σ | Bestand Ende | MRR netto Ende | Umsatz netto Σ | Kosten Σ | Kum. Gewinn |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Q1 (Mai–Jul 27) | 3.246 | 94 | 7 | 87 | 573 € | 10.643 € | 486 € | 10.157 € |
| Q2 (Aug–Okt 27) | 4.090 | 119 | 28 | 178 | 1.168 € | 12.398 € | 69 € | 22.486 € |
| Q3 (Nov 27–Jan 28) | 5.152 | 149 | 50 | 277 | 1.818 € | 4.788 € | 69 € | 27.205 € |
| Q4 (Feb–Apr 28) | 6.490 | 188 | 75 | 390 | 2.561 € | 6.915 € | 150 € | 33.970 € |
| Q5 (Mai–Jul 28) | 8.175 | 237 | 104 | 523 | 3.437 € | 9.400 € | 444 € | 42.926 € |
| Q6 (Aug–Okt 28) | 10.298 | 299 | 138 | 684 | 4.493 € | 12.377 € | 365 € | 54.938 € |
| Q7 (Nov 28–Jan 29) | 12.973 | 376 | 179 | 881 | 5.788 € | 16.009 € | 407 € | 70.539 € |
| Q8 (Feb–Apr 29) | 16.342 | 474 | 230 | 1.125 | 7.390 € | 20.491 € | 460 € | 90.571 € |
| Q9 (Mai–Jul 29) | 18.000 | 522 | 290 | 1.357 | 8.917 € | 25.310 € | 631 € | 115.250 € |
| Q10 (Aug–Okt 29) | 18.000 | 522 | 341 | 1.538 | 10.106 € | 29.196 € | 562 € | 143.883 € |
| Q11 (Nov 29–Jan 30) | 18.000 | 522 | 381 | 1.679 | 11.032 € | 32.222 € | 598 € | 175.507 € |
| Q12 (Feb–Apr 30) | 18.000 | 522 | 412 | 1.789 | 11.753 € | 34.579 € | 626 € | 209.460 € |

### 2.4 Schlüsselmonate im Detail

| Monat | Downloads | Neuzahler | Abgänge | Bestand | MRR brutto | MRR netto | Kosten/Mo | Kum. Gewinn |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| M1 (Mai 27) | 1.000 | 29 | 0 | 29 | 224 € | 191 € | 440 € | 2.917 € |
| M6 (Okt 27) | 1.469 | 43 | 12 | 178 | 1.374 € | 1.168 € | 23 € | 22.486 € |
| M12 (Apr 28) | 2.332 | 68 | 28 | 390 | 3.013 € | 2.561 € | 53 € | 33.970 € |
| M18 (Okt 28) | 3.700 | 107 | 50 | 684 | 5.286 € | 4.493 € | 126 € | 54.938 € |
| M24 (Apr 29) | 5.871 | 170 | 83 | 1.125 | 8.695 € | 7.390 € | 160 € | 90.571 € |
| M30 (Okt 29) | 6.000 | 174 | 119 | 1.538 | 11.890 € | 10.106 € | 192 € | 143.883 € |
| M36 (Apr 30) | 6.000 | 174 | 140 | 1.789 | 13.827 € | 11.753 € | 211 € | 209.460 € |

**Interpretation:**
- Nach 12 Monaten: 390 zahlende Abonnenten, **MRR netto ~2.560 €**. Das entspricht grob $3k MRR — damit läge ORVIA bereits über der $1k-MRR-Schwelle, die **nur ~17 % neuer Apps** je erreichen. Das Basis-Szenario ist also *kein* Erwartungswert, sondern ein „es funktioniert"-Szenario; der Erwartungswert der Branche liegt näher am Worst Case.
- Die $10k-MRR-Marke (~4,6 % aller Apps) fällt im Modell in Monat ~27–30.
- Der Bestand hängt in Monat 36 (1.789) noch deutlich unter dem Steady State (2.175) — Churn frisst mit wachsendem Bestand einen immer größeren Teil der Neuzahler (M36: 140 Abgänge vs. 174 Neue).

### 2.5 Cashflow-Sicht: Jahresabos, Deferred Revenue und die Renewal-Klippe

Das Modell rechnet MRR-glatt (79,99 €/12). Kassenwirksam fließen Jahresabos aber **als Vorauszahlung im Abschlussmonat**. Zwei Konsequenzen:

1. **Cash läuft dem MRR voraus.** Rechenbeispiel Monat 12 (Basis): 68 Neuzahler, davon 68 % Jahresabos ≈ 46 × 67,99 € netto = **3.127 € Sofort-Cash** allein aus neuen Jahresabos — zusätzlich zu den anteiligen Bestandsumsätzen. Für die Liquiditätsplanung ist das angenehm, für die Erfolgsmessung gefährlich: Gemessen wird deshalb ausschließlich MRR (RevenueCat normalisiert das automatisch), Kontostand ist keine KPI.
2. **Die Renewal-Klippe ab Monat 13.** Die Jahresabo-Kohorte aus Monat 1 (29 Neuzahler × 68 % ≈ 20 Jahresabos) steht in Monat 13 zur Verlängerung; bei Benchmark-Renewal von ~33 % verlängern ~7, ~13 fallen weg — **auf einen Schlag**, nicht verteilt. Der blended 8 %-Churn des Modells verteilt diese Klumpen rechnerisch glatt; real werden die Monate 13–18 (Verlängerungen der Launch-Kohorten) im MRR-Chart sichtbar durchhängen. Planungsregel: Der Ist-Pfad wird gegen den Modellpfad auf **Quartalsbasis** verglichen, nicht monatsscharf, und ab Monat 11 läuft eine dedizierte Pre-Renewal-Kampagne (In-App-Jahresrückblick „Dein Trainingsjahr", 2 Wochen vor Ablauf) — das ist der billigste MRR-Hebel des gesamten zweiten Jahres.

### 2.6 Preisänderungs-Politik

**[Annahme/Policy]** Bestandskunden werden bei künftigen Preiserhöhungen für mindestens 12 Monate im Alt-Preis belassen (Grandfathering); Erhöhungen (>15 %) frühestens ab 2029 und nur nach nachgewiesenem Mehrwert (Feature-Log als Begründung im Ankündigungstext). Begründung: Bei ~33 % Jahres-Renewal ist jeder zusätzliche Kündigungsanlass teurer als der Preisaufschlag; die Preiserhöhung wirkt ohnehin voll auf Neukunden, die im Wachstumsmodell den Bestand dominieren (M24: 170 Neue/Monat auf 1.125 Bestand = 15 %/Monat Zufluss).

---

## 3. Worst- und Best-Szenario (Kurzfassung)

**Worst [Annahmen]:** 800 Downloads/Monat flach, 1,5 % Conversion, 12 % Churn, keine Founder-Verkäufe eingerechnet (konservativ).
**Best [Annahmen]:** Start 2.000 Downloads, +12 %/Monat bis Deckel 15.000 (erreicht M~19), 6 % Conversion, 5 % Churn, Founder wie Basis.

| Monat | Worst: Bestand | Worst: MRR netto | Worst: Kum. Gewinn | Best: Bestand | Best: MRR netto | Best: Kum. Gewinn |
|---|---:|---:|---:|---:|---:|---:|
| M6 | 54 | 352 € | 807 € | 874 | 5.745 € | 37.059 € |
| M12 | 78 | 515 € | 3.412 € | 2.369 | 15.562 € | 102.187 € |
| M18 | 90 | 591 € | 6.246 € | 5.148 | 33.822 € | 251.462 € |
| M24 | 95 | 626 € | 9.491 € | 8.552 | 56.191 € | 532.240 € |
| M36 | 99 | 650 € | 16.210 € | 12.895 | 84.721 € | 1.398.000 € |

**Steady States (Bestand = Neuzahler/Churn):**

```
Worst: (800 × 0,015)/0,12 = 12/0,12 = 100 Abonnenten → MRR netto ~657 € (in M36 praktisch erreicht)
Basis: 174/0,08 = 2.175 → ~14.290 €
Best:  (15.000 × 0,06)/0,05 = 900/0,05 = 18.000 → ~118.260 € (M36 erst bei 72 % davon)
```

**Lesart:** Selbst das Worst-Szenario ist bei der schlanken Kostenbasis nie existenzbedrohend (kumuliert +16 k€ nach 3 Jahren) — es ist nur *bedeutungslos* als Geschäft. Das eigentliche Risiko ist nicht Verlust, sondern verschwendete Lebenszeit; daraus leiten sich die Kill-Kriterien (Kap. 7) ab. Das Best-Szenario (85 k€ MRR netto) entspräche ~$1,1 M ARR netto und läge im obersten Promille-Bereich für Solo-Apps — es dient als Obergrenze für Kapazitätsplanung (Band 8), nicht als Planungsbasis.

---

## 4. Unit Economics: LTV, CAC und die Paid-Ads-Freigabe

### 4.1 LTV je Szenario

Formel (geometrische Reihe der Verweildauer): **LTV = ARPU_netto / Churn**

| Szenario | Churn | Rechnung | LTV netto | Erwartete Verweildauer |
|---|---|---|---:|---:|
| Best | 5 % | 6,57 / 0,05 | **131,40 €** | 20 Monate |
| Basis | 8 % | 6,57 / 0,08 | **82,13 €** | 12,5 Monate |
| Worst | 12 % | 6,57 / 0,12 | **54,75 €** | 8,3 Monate |

Plausibilisierung: Der Branchen-Median „realisierter LTV Jahr 1" liegt bei ~$36/Zahler — deutlich unter dem theoretischen Basis-LTV, weil der Median-Anbieter schlechtere Renewals hat. Der Basis-LTV von 82 € ist also ein *Modellwert unter der Bedingung 8 % Churn*, kein garantierter Cash-LTV. Für Ausgabenentscheidungen gilt konservativ der **Jahr-1-Cap: max. 12 × 6,57 € = 78,84 €**.

### 4.2 CAC-Grenzen und Payback

Regel: **LTV:CAC ≥ 3** und **Payback ≤ 6 Monate** — beide Bedingungen müssen gleichzeitig erfüllt sein.

| Churn-Lage | LTV | Max. CAC (LTV/3) | Payback bei Max-CAC (CAC/6,57 €) |
|---|---:|---:|---:|
| 5 % | 131,40 € | 43,80 € | 6,7 Monate ⚠ (verletzt Payback-Regel → praktisch max. ~39 €) |
| 8 % | 82,13 € | 27,38 € | 4,2 Monate ✓ |
| 12 % | 54,75 € | 18,25 € | 2,8 Monate ✓ |

Benchmark-Realität: **Cost per Subscription liegt bei Meta-Ads bei ~$45–60 (~42–56 €)**; Payback dafür wäre 6,4–8,5 Monate.

### 4.3 Paid-Ads-Freigabeformel (verbindlich)

```
Paid Ads erlaubt ⇔ (gemessener Churn ≤ 6 % über 3 Monate)
                 ∧ (gemessener CAC im Testbudget ≤ LTV_gemessen / 3)
                 ∧ (CAC ≤ 6 × 6,57 € = 39,42 €)
                 ∧ (MRR netto ≥ 5.000 €, damit ein Fehlschlag <10 % Jahresgewinn kostet)
```

Konsequenz: Bei Benchmark-CAC (42–56 €) und Basis-Churn (8 %, max. CAC 27 €) sind Meta-Ads **rechnerisch verboten**. Paid Acquisition wird erst denkbar, wenn entweder (a) Churn Richtung 5 % gedrückt ist *und* Creatives einen Unter-Benchmark-CAC beweisen, oder (b) der ARPU steigt (Preiserhöhung, B2B-Mix, Band 8). Bis dahin: 100 % organisch (ASO, Content, Communities) — das Testbudget von max. 500 € **[Annahme]** dient nur der CAC-*Messung*, nicht der Skalierung.

---

## 5. Sensitivitätsanalyse: MRR netto nach 24 Monaten

Basis-Download-Rampe (1.000 → +8 % → 6.000) konstant gehalten; variiert werden Churn × Conversion. Python-berechnet.

| MRR netto M24 | Conversion 1,5 % | Conversion 2,9 % | Conversion 6,0 % |
|---|---:|---:|---:|
| **Churn 5 %** | 4.586 € | 8.866 € | 18.343 € |
| **Churn 8 %** | 3.823 € | **7.390 € (Basis)** | 15.290 € |
| **Churn 12 %** | 3.102 € | 5.997 € | 12.407 € |

**Ablesbare Hebel-Hierarchie:**
1. **Conversion dominiert:** 1,5 % → 6 % vervierfacht das MRR (Faktor 4,0) — identisch zum Verhältnis der Raten, weil Conversion linear wirkt.
2. **Churn wirkt unterproportional auf 24-Monats-Sicht** (5 % vs. 12 % = Faktor ~1,5), aber seine Wirkung wächst mit der Zeit (Steady-State-Faktor wäre 12/5 = 2,4). Wer nur 24 Monate misst, unterschätzt Churn systematisch.
3. Für den Solo-Entwickler mit 20 h/Woche heißt das: **Priorität 1 Onboarding/Paywall (Conversion), Priorität 2 Habit-Features (Churn)** — in dieser Reihenfolge, aber beides vor jedem neuen Feature.

---

## 6. Break-even, Kostenstruktur und Steuern

### 6.1 Kostenaufbau und Break-even

| Kostenblock | Betrag | Fälligkeit |
|---|---|---|
| Einmalig M1: Google 23 € + Gewerbe 30 € + Steuerberater 250 € | 303 € | Monat 1 |
| Jährlich: Apple 99 € + Domain 15 € | 114 € | M1, M13, M25 |
| Laufend: Supabase Pro ~23 €/Monat | 23 €/Mo | ab M1 **[Annahme: ab Launch, wegen Sync-Last]** |
| Steuerberater laufend | 50 €/Mo | ab M13 **[Annahme 600 €/J]** |
| RevenueCat | 1 % vom Brutto-MRR | sobald MRR > ~2.300 € (Basis: ab M~10) |

**Break-even-Rechnung:**

```
Gesamtkosten Monat 1: 303 + 114 + 23 = 440 €
Basis: Umsatz M1 = 191 € MRR netto + 3.166 € Founder → Break-even im Monat 1
Ohne Founder-Verkäufe: MRR netto (M2: 381 €) > lfd. Kosten (23 €) → operativer Break-even ab Monat 2;
kumulierter Break-even (440 € Anlauf) bei ~67 Abonnenten-Monaten ≈ Ende Monat 2.
Worst (ohne Founder): M1 −361 €; kumuliert positiv ab Monat ~4.
```

Fazit: Das Projekt hat **kein Kosten-Risiko**, nur ein Opportunitätskosten-Risiko. Der maximale Cash-Drawdown liegt im Worst Case bei rund −440 €.

### 6.2 Steuern: Kleinunternehmergrenze und Rückstellungs-Faustregeln

**Kleinunternehmerregelung (§ 19 UStG, Rechtsstand seit 2025):** Grenze 25.000 € Gesamtumsatz im *Vorjahr* (und 100.000 € im laufenden Jahr, deren Überschreiten sofort wirkt).

**Wann reißt die Grenze im Basis-Szenario?**

```
Netto-Zuflüsse Basis, Kalenderjahr 2027 (Mai–Dez, M1–M8):
  MRR-Summe ≈ 7.014 € + Founder 18.998 € = 26.011 €  → >25.000 € bereits im Dezember 2027 (M8)
  → ab 1.1.2028 Regelbesteuerung (Umsatzsteuer-Voranmeldungen).
Kalenderjahr 2028 (M9–M20): ≈ 40.731 € · 2029 (M21–M32): ≈ 101.975 €
Worst-Szenario: 2027 ≈ 2.171 €, 2028 ≈ 6.525 € → bleibt dauerhaft Kleinunternehmer.
```

**Wichtige Feinheit [mit Steuerberater zu klären]:** App-Store-Erlöse laufen im Kommissionärsmodell als B2B-Leistung an Apple (Irland) bzw. Google — umsatzsteuerlich Reverse-Charge/nicht steuerbare Auslandsumsätze; die USt auf die Endkundenpreise führen die Stores selbst ab. Welche Umsätze exakt in die 25.000-€-Prüfung einfließen (und wie künftige direkt fakturierte B2B-Coach-Umsätze zählen), gehört in das Erstgespräch (die budgetierten 250 €). Planungsleitlinie: **konservativ davon ausgehen, dass die Grenze Ende 2027 fällt.**

**Rückstellungs-Faustregeln [Annahmen, keine Steuerberatung]:**

| Regel | Wert | Begründung |
|---|---|---|
| Einkommensteuer-Rückstellung | **30 % jedes Gewinn-Euros** auf Tagesgeldkonto | App-Gewinn stapelt sich auf das Azubi-Gehalt → Grenzsteuersatz steigt schnell über 25 % |
| Ab Regelbesteuerung | Vereinnahmte USt (sofern anfallend, z. B. B2B-Inland) sofort separieren | Fremdgeld, nie Liquidität |
| Gewerbesteuer | Erst ab 24.500 € Gewerbeertrag/Jahr relevant → im Basis ab 2028 zusätzlich ~5 % zurücklegen | Freibetrag Einzelunternehmen |
| EÜR-Puffer | ESt-Vorauszahlungen kommen nach dem ersten Bescheid ruckartig (Nachzahlung + Vorauszahlung gleichzeitig) | Klassische Solo-Gründer-Liquiditätsfalle im Jahr 2 |

### 6.3 Vollständigkeit: Was im Modell fehlt (bewusst)

Nicht modelliert, da <5 % Effekt oder nicht quantifizierbar: Refunds/Chargebacks (~1–3 % der Bruttoerlöse, **[Annahme]**), Wechselkurseffekte USD/GBP, Apple-Small-Business-Verlust bei >$1 M Erlös (erst im Best-Case-Jahr 3 relevant, dann 30 % statt 15 % Cut auf Neuumsatz — würde Best-MRR netto um ~18 % drücken), Gerätekosten/Testgeräte (~500 €/Jahr **[Annahme]**).

---

## 7. Kill-/Pivot-Kriterien (verbindlich, messbar)

Logik: Jedes Kriterium kombiniert eine **Ergebnis-Metrik** (Zahler/MRR) mit einer **Ursachen-Metrik** (Retention/Conversion), damit nicht ein einzelner schwacher Kanal ein funktionierendes Produkt killt — und umgekehrt kein „Hoffnungs-Zombie" weiterläuft. Referenzpfad = Basis-Szenario; Schwellen bei ~50 % bzw. ~25 % des Pfads.

| Zeitpunkt | Schwelle (UND-verknüpft) | Aktion | Begründung |
|---|---|---|---|
| **M3 (Jul 27)** | < 40 Zahler UND Trial-Start-Rate < 4 % | Onboarding-/Paywall-Rebuild als einziges Projekt für 6 Wochen | Basispfad M3 = 87 Zahler; Trial-Start 4 % ≈ 60 % des Medians (6,9 %) — Trichter-Eingang ist kaputt, nicht das Produkt |
| **M6 (Okt 27)** | < 75 Zahler UND D30-Retention < 3 % | **Strategie-Review:** Positionierung/Zielgruppe neu, ggf. Nischen-Pivot | 75 = ~42 % des Basispfads (178); D30 < 3 % = unterste Kante des H&F-Korridors (3–8 %) → Produkt erzeugt keine Gewohnheit |
| **M9 (Jan 28)** | Trial→Paid < 25 % über 3 Monate (trotz M3-Maßnahmen) | Preis-/Paketierungs-Pivot (Preistest ±30 %, Feature-Umverteilung Free/Pro) | 25 % = zwei Drittel des Medians (37,7 %) — Wertversprechen und Preis passen nicht zusammen |
| **M12 (Apr 28)** | MRR netto < 1.300 € ODER < 200 Zahler | **Kill-or-Pivot-Entscheidung:** B2B-First-Pivot (Band 8) oder geordneter Sunset | 1.300 € ≈ 50 % des Basispfads (2.561 €); unterhalb dessen ist der Vollzeit-Pfad rechnerisch tot (Kap. Band 8), und 20 h/Woche sind anderswo besser investiert |
| **M12, Zusatz** | Churn > 12 % über 3 Folgemonate | Feature-Freeze, 100 % der Zeit auf Retention; Paid-Ads-Verbot bleibt | Bei 12 % Churn ist LTV (54,75 €) < Benchmark-CAC → Wachstum wäre Geldvernichtung |
| **M18 (Okt 28)** | MRR netto < 2.500 € trotz aller Pivots | **Kill:** App in Wartungsmodus, kein Neuaufwand; Founder-Käufer behalten Zugang | Unter 2.500 € nach 18 Monaten liegt das Projekt unter dem Worst-Case-Nutzen jeder Alternativverwendung von ~1.500 h Arbeitszeit |
| Dauerregel | Crash-Rate > 2 % der Sessions ODER Sync-Erfolg < 95 % über 2 Wochen | Feature-Stopp bis behoben | Qualitäts-Churn ist der einzige vollständig selbstverschuldete Churn |

**Positiv-Trigger (Gegenstück):** Liegt ORVIA in M6 über 250 Zahlern (Best-Pfad-Nähe) bei Churn ≤ 6 %, wird die B2B-Roadmap (Band 8) um zwei Quartale vorgezogen und das Paid-Ads-Testbudget freigegeben, sofern Formel 4.3 erfüllt ist.

**Governance der Kriterien:** Die Schwellen werden im Monats-Review (Band 8, Kap. 1.5) explizit mit Ja/Nein und Datum protokolliert. Änderungen an den Schwellen sind nur *vor* Erreichen des jeweiligen Zeitpunkts zulässig und müssen schriftlich begründet werden — nachträgliches Verschieben („diesmal zählt es nicht, weil…") ist der klassische Weg, wie Solo-Gründer Kill-Kriterien entwerten. Ein einmal ausgelöstes Strategie-Review dauert maximal 4 Wochen und endet mit einer dokumentierten Entscheidung; ein ausgelöster Kill wird binnen 8 Wochen umgesetzt (Store-Delisting für Neukunden, Wartungsmodus für Bestand, Founder-Zusagen werden gehalten).

**Warum die Schwellen dort liegen, wo sie liegen:** Die 50 %-Pfad-Logik (M12: 1.300 € ≈ 50 % von 2.561 €) markiert den Punkt, ab dem selbst eine anschließende Rückkehr auf Basis-Wachstumsraten den Vollzeit-Sprung (Band 8: Schwelle 4.000 €/Monat) um mehr als 12 Monate nach hinten schöbe — der Plan verlöre seine Kopplung an das Ausbildungsende. Die Ursachen-Metriken (D30, Trial→Paid) sind jeweils an die *untere Kante* der publizierten Benchmark-Korridore gelegt: Wer dauerhaft unter dem 25. Perzentil der Branche liegt, hat kein Vermarktungs-, sondern ein Produktproblem, und das löst man nicht durch Durchhalten im gleichen Setup.

---

## Anhang: Reproduzierbarkeit

Modell-Kern (Python, vollständige Parameter in Kap. 2.1):

```python
GROSS = 0.32*9.99 + 0.68*(79.99/12)   # 7,73 €
NET   = GROSS * 0.85                  # 6,57 €
for m in range(1, 37):
    dl   = min(1000 * 1.08**(m-1), 6000)
    new  = dl * 0.029
    subs = subs * (1 - 0.08) + new
    mrr_netto = subs * NET
```

**Quellen:** RevenueCat [State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps) · RevenueCat Sub Club: [Hard paywall vs. freemium — 75 % LTV lift](https://www.revenuecat.com/blog/growth/hard-paywall-vs-freemium) · [Airbridge: Hard Paywall vs Freemium 2026 (75k-Apps-Auswertung)](https://www.airbridge.io/en/blog/hard-paywall-vs-freemium-2026) · [RevenueCat: Guide to mobile paywalls](https://www.revenuecat.com/blog/growth/guide-to-mobile-paywalls-subscription-apps)
