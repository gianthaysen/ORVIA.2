# Band 0 — Übersicht und Steuerung des ORVIA-Masterplan-Pakets

Stand: 15.08.2026 · Das Paket besteht aus dem strategischen Masterplan (Hauptdokument) und neun Detailbänden mit zusammen ~33.000 Wörtern. Dieses Dokument ist Einstieg, Landkarte und Betriebsanleitung.

---

## 1 · Die Dokumente und wann du welches brauchst

| Dokument | Inhalt | Du brauchst es, wenn … |
|---|---|---|
| **ORVIA-Masterplan-2026-08-15.md** | Strategie-Gesamtbild: Kernergebnis, Realitätscheck, Meilensteine M1–M6, Tiers, Timeline, Risiken | … du die Richtung prüfst oder jemandem das Projekt erklärst |
| **Band 1 — Phasenplan-Detail** | Phasen A–F auf Sprint-/Arbeitspaket-Ebene mit Stunden, Abhängigkeiten, DoD, Gates, Cut-Linien | … du deine nächsten 2 Wochen planst (dein wichtigstes Arbeitsdokument) |
| **Band 2 — Feature-Spezifikationen** | 10 Kern-Features als Mini-Specs mit UX-Fluss, Code-Anschluss, Edge Cases, Evidenz-Leitplanken, 435 h Summe | … du ein Feature baust oder beauftragst |
| **Band 3 — Konkurrenz-Dossiers** | 15 Einzeldossiers, 26×12-Feature-Matrix, Positionierungs-Landkarte, Monitoring-Plan | … du Positionierung, Pricing oder ein Feature gegen den Markt prüfst (quartalsweise lesen) |
| **Band 4 — Finanzmodell** | Preis-Design, 36-Monats-Modell (3 Szenarien), Unit Economics, Sensitivitäten, Kill-Kriterien | … du Preise festlegst, Zahlen prüfst oder eine Pivot-Entscheidung ansteht |
| **Band 5 — Marketing-Playbook** | Personas, ASO-Keywords DE/EN, Kanal-Playbooks, Warteliste, Launch-Sequenz W−8…+4, Content-Kalender | … ab Phase C (Warteliste) und dauerhaft ab Launch (4 h/Woche) |
| **Band 6 — Store & Technik-Checklisten** | Capacitor Schritt für Schritt, Apple-/Google-Checklisten, RevenueCat, i18n, QA, Launch-Runbook, Incident-Plan | … in Phase C und am Launch-Tag (abhaken, nicht lesen) |
| **Band 7 — Recht & Firma** | Gründungs-Checkliste, DSGVO-Dokumentenpaket, Consent-Spec, MDR-Formulierungsleitfaden (verboten→erlaubt), AGB-Gliederung, Compliance-Kalender | … Phase A (Gewerbe/StB) und Phase C (alles andere); Formulierungsleitfaden gilt ab sofort für jeden Text |
| **Band 8 — B2B, KPI & Skalierung** | KPI-Definitionen + Dashboard, Coach-Tier-Plan, Corporate-Pfad, Skalierungs-/Kapital-Optionen | … ab Phase E (KPI ab Launch), B2B ab 2028 |

**Ergänzende, bereits existierende Grundlagen:** technische Roadmap (Metaanalyse 15.08.), Evidenz-Bestandsbericht + Studien-Inventar-CSV (im Studienordner), Roadmap-Artefakt in der Cowork-Seitenleiste.

---

## 2 · Das Steuerungssystem (so bleibt der Plan lebendig)

**North-Star-Metrik:** WAU-2 — wochenaktive Nutzer mit ≥ 2 geloggten Einheiten. Jede Produktentscheidung muss begründen können, wie sie WAU-2 oder die Free→Pro-Conversion verbessert.

**Wochenrhythmus (30 min, fester Termin):** Sprint-Fortschritt gegen Band 1 prüfen → ein Satz ins Entscheidungslog (was entschieden, warum) → nächste 20 h priorisieren → ab Launch zusätzlich: KPI-Blatt aus Band 8 füllen.

**Monatsrhythmus (2 h):** Phase-Gate-Status prüfen (Band 1) → Budget/Zeit-Ist gegen Plan → ein Band gezielt nachlesen (Rotation) → Konkurrenz-Signale (Band 3 Monitoring-Liste, quartalsweise voll).

**Gate-Disziplin (deine bewährte Regel, jetzt fürs Ganze):** Keine Phase beginnt, bevor das Gate der vorherigen dokumentiert bestanden ist. Gates stehen in Band 1; die Kill-/Pivot-Kriterien für die Zeit nach dem Launch stehen in Band 4 §7 — **lege sie jetzt fest, nicht wenn es emotional wird.**

**Änderungsführung:** Dieses Paket ist Stand 15.08.2026. Bei relevanten Abweichungen (> 4 Wochen Verzug, Marktereignis, Gate-Fail) wird nicht der ganze Plan neu geschrieben, sondern der betroffene Band fortgeschrieben + eine Zeile hier ins Änderungslog.

| Datum | Änderung |
|---|---|
| 15.08.2026 | Erstfassung des Gesamtpakets |

---

## 3 · Konsolidierte offene Entscheidungen (aus allen Bänden)

| # | Entscheidung | Empfehlung | Band | bis wann |
|---|---|---|---|---|
| 1 | Phasenrahmen A–F freigeben | ja | Masterplan/1 | jetzt |
| 2 | Preis Pro 9,99 €/79,99 € | ja (nicht unterpreisen) | 4 | vor Phase C |
| 3 | Founder-Lifetime 149 €, ~500 Stück | ja | 4 | vor Warteliste |
| 4 | Trial 14 Tage, Paywall nach Aha-Moment | ja | 4/2 (F8) | Phase C |
| 5 | Warteliste öffentlich ab Phase C | ja | 5 | Phase B-Ende |
| 6 | Analytics-Tool (EU-datenschutzkonform) | TelemetryDeck o. PostHog EU | 8 | Phase C |
| 7 | Gewerbe + StB-Termin | sofort in Phase A | 7 | Sep 2026 |
| 8 | Prototyp-Konflikte (Tab 4, Zielhierarchie, Sichtbarkeit) | Empfehlungen aus Metaanalyse | tech. Roadmap | Phase B-Start |
| 9 | Kill-/Pivot-Schwellen schriftlich fixieren | Band-4-Vorschlag übernehmen | 4 | vor Launch |

---

## 4 · Die fünf Sätze, die das ganze Paket tragen

1. Die Marktlücke — ein gemeinsames Belastungsmodell für Ausdauer und Kraft, evidenz-ehrlich erklärt — ist real, belegt und aktuell unbesetzt.
2. Der schwerste Teil (Engine, App, Evidenzschicht) existiert; der Weg zum Produkt ist Verdrahten, Verpacken, Verkaufen.
3. Geplant wird in Gates, nicht in Wünschen: A Fundament → B Produktkern → C Store-Ready → D Launch (Mai 2027) → E Wachstum → F Ausbau.
4. Distribution ist das größte Risiko, nicht Technik — deshalb sind Marketing 20 % der Zeit und die Conversion-Benchmarks die Messlatte.
5. Das 500-Mio.-Ziel bleibt Richtung am Horizont; jede echte Entscheidung optimiert auf das nächste Gate — so, und nur so, planen Profis große Projekte.
