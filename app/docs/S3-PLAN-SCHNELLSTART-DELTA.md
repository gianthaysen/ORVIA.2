# S3 · Plan-Tab + Schnellstart — Delta Prototyp v14 → App

Stand 25.09.2026 · Referenz `Downloads/ORVIA-Prototyp-Profil-Ziele-Community-v14.html`
(`scrPlan`/`planRender`, `shQuick`) gegen `renderGMPlan` (ui.js, GM2) und `quick-actions.js`.
Regel aus dem Schnittplan: Look aus v14 **mit** echter Datenquelle; kein Demo-Wert, keine
Sektion ohne Quelle; „Datenlücke ≠ Wert".

## Kernergebnis

Der Plan-Tab ist näher an v14 als das Inventar vom 12.09. vermuten ließ: Planvariante A/B/C
mit Wochen-Kennzahlen, Adaptive Einschätzung, Zielprognose, Phasen und Wochenblättern sind
bereits da (GM2 aus v5, plan-variants-Engine). Das echte Delta sind **vier Dinge**, davon drei
in S3a umgesetzt; der Rest ist eine Reihenfolge-Entscheidung und der Schnellstart.

## Delta-Liste

| # | v14 | App vor S3 | Quelle | Entscheidung | Stand |
|---|---|---|---|---|---|
| 1 | Kopfzeile „… · Halbmarathon in 61 Tagen" | Phase + Woche, kein Countdown | `daysToSafe()`, `raceLabel()` | übernehmen, nur mit echtem Zieldatum | **S3a** |
| 2 | Kernreiz-Marker (goldenes Icon) + Notiz unter der Liste | GM7.5g hatte Label-Heuristik-Badges zu Recht entfernt | `planVariants.isKey` über `loadProfile.systemic ≥ .7` — dieselbe Einstufung, die die Variantenkarte als „Kernreize" zählt | übernehmen, **nur mit Engine** (Regex-Rückfall ⇒ kein Marker); Tage in der Notiz sind echt, nicht „Di/Do/So" | **S3a** |
| 3 | Karte „Deine Pace-Zonen" (5 Zonen) | nur Legacy `#paceZonesBox` aus der Zielzeit (verborgen) | `performanceResolver.resolveAll().sports.running.zones` (Referenz, Konfidenz, Alter) | übernehmen aus dem **kanonischen Leistungsbild**, nicht aus der Zielzeit (v14 sagt „aus HM-Ziel 1:50" — Aspiration ist keine Messung); ohne Referenz Leerzustand mit Grund | **S3a** |
| 4 | Variantenkarte mit 4 Kennzahlen | identisch vorhanden | plan-variants | kein Delta | — |
| 5 | Adaptive Einschätzung = EIN Statement + Pill | `gmAdaptiveSection` (adaptive-card.js, vollständige Ausgabe) | adaptive-card | Delta prüfen: ein Statement oben, Details einklappbar | S3b |
| 6 | Zielprognose: Prognosezeit groß, Balken, Puffer %, Engpass, „erwarteter Effekt" | `gmGoalForecastCard` (Feasibility) | goal-feasibility | Balken/Puffer/Engpass nur, wenn Feasibility sie liefert; „erwarteter Effekt" = Engine-Erweiterung, bis dahin weglassen | S3b |
| 7 | Reihenfolge: Kontext (Variante → Adaptive → Prognose → Phasen → Zonen) **vor** „Diese Woche" | Variante → Woche → Qualität → Prognose → Adaptive → Phasen → km → Tagesziele | — | **Empfehlung: nicht übernehmen.** Die Wochenliste ist das täglich genutzte Element; sie unter fünf Kontextkarten zu schieben kostet jeden Tag Scrollen. Beibehalten: Woche oben. Adaptive vor Planqualität ziehen (Statement vor Diagnose). | Entscheidung Gian |
| 8 | Keine Sektionen Planqualität / Wochenkilometer / Tagesziele im Plan | vorhanden, echte Quellen | E3, E2, daily goals | **behalten** — echte Engine-Ausgaben nicht wegen eines Prototyps entfernen; Planqualität ggf. in die Adaptive-Karte einklappen (S3b) | Entscheidung Gian |
| 9 | Zustands-Badges „Nächster Reiz / Geplant / Abgeschlossen / Entfällt in B" | „Erledigt / — / Entfällt (B)" | Resolver | „Nächster Reiz" für die nächste offene Kernreiz-Einheit ergänzen; „—" für offene Einheiten durch „Geplant" ersetzen | S3b |
| 10 | Schnellstart: Sport-Kacheln (Laufen/Kraft/Rad/Mehr) oben, darunter „Schnell eintragen" (Check-in, Gewicht, Neues Ziel, Beitrag teilen) | Quick-Actions: kontextgerankt + Favoriten (mächtiger als v14) | quick-actions | Sport-Kacheln **aus den aktiven Sportarten des Profils** (nicht hart Laufen/Kraft/Rad) als ersten Block übernehmen; Ranking/Favoriten behalten; „Beitrag teilen" erst S7 | S3c |

## S3a — umgesetzt (v8-401)

- `gmPlanRaceCountdown()`: Countdown nur mit echtem, zukünftigem Zieldatum.
- `gmPlanIsKeyUnit(it)`: Engine-Einstufung oder nichts; `.session-card.key` (goldenes Icon, erledigt gewinnt); Notiz mit echten Tagen.
- `gmPaceZonesModel/Section(perfBySport)`: Sektion `plan-pace-zones` nach den Phasen; 5 Zeilen (recovery, easy, half, threshold, vo2), Quelle (Wettkampf/Test/harter Lauf/langer Lauf), Konfidenz-Marker, Alter der Referenz; Leerzustand mit Grund; der Renderer rechnet keine Zonen aus der Zielzeit (Test C5).
- Tests: `plan_v14_s3a_test.mjs` (19), `gm2_plan_parity` Sektionsfolge aktualisiert.

## Offen

- S3b (Adaptive-Statement, Prognose-Karte, Badges) und S3c (Schnellstart-Kacheln) — je ein Build.
- Entscheidungen 7 und 8 von Gian; ohne Rückmeldung bleibt die App-Reihenfolge, Adaptive rückt vor Planqualität.
