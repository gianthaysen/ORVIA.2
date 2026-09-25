# S5 · Debrief + Rückblick + Rechner — Delta v14 (Stand 2026-09-26)

Vergleich Prototyp v14 (`scrDebrief`/`dbFull…dbGym`, `scrReview`/`revWeek`/`revMonth`,
`scrRace`/`rcRender`) gegen die App.

| # | Prototyp v14 | App | Status | Build |
|---|---|---|---|---|
| 1 | Debrief: fünf Fälle als Zustände (voll / teilweise / frei / ohne HF / Gym) | `gmDebriefVerdict` — sieben Zustände (+ Abgebrochen, Rückmeldung fehlt) aus dem kanonischen Record | **umgesetzt** | v8-411 |
| 2 | Debrief: Soll/Ist-Zeilen (Intervalle, Pace, HF-Zone, Dauer) | Dauer, Distanz, Pace-Band, RPE-Erwartung — aus `record.snapshot` (eingefroren) + Ist der Aktivität | **umgesetzt** (HF-Zone: kein Zonen-Ist im Record) | v8-411 |
| 3 | Debrief: Mitnahmen (Beibehalten / Nächstes Mal / Auswirkung) | nur aus Record-Feldern (zoneHit, completionPct, adherence, deltaRpe, pain, reason) | **umgesetzt** | v8-411 |
| 4 | Debrief: Tiefenanalyse Profi (HF-Drift, Decoupling, Kadenz) | — kein Produzent für Drift/Decoupling je Einheit | bewusst nicht | — |
| 5 | Debrief: Kontext (letzte 4 Tempoläufe, Trefferquote) | — `toleranceState` existiert (Verträglichkeit), aber keine Serien-Vergleiche je Einheitstyp | offen (Kandidat S5e) | — |
| 6 | Aktivitätsliste zeigt das Urteil | Plan-Karte trägt „Debrief: Zählt voll" bei erledigten Einheiten mit Record | **umgesetzt** (Plan statt Liste) | v8-411 |
| 7 | Rückblick Woche: Ring, KPIs, stärkste Einheit, Belastung, Stellschraube, Erholung, Vergleich | `review-v14.js` model/html — alle aus echten Quellen | **umgesetzt** | v8-412 |
| 8 | Rückblick: HF-Drift Long Run, Pace bei gleicher HF | — kein Produzent | bewusst nicht | — |
| 9 | Rückblick Monat: Serie, 12-Wochen-Kurve, Kalender | `monthModel/monthHtml` | **umgesetzt** (Balken statt Kurve; Kurve erst ab 2 Wochen) | v8-414 |
| 10 | Rechner: Pacing-Plan (negativer Split, Hälften) | `engine/pacing-plan.js` + Karte im Pace-Rechner | **umgesetzt** | v8-413 |
| 11 | Rechner/Renntag: Wetter-Zeile, Zeitplan, Checkliste, Plan B | — Wetter ohne Quelle; Renntag-Modus (race.js) bleibt Textliste | bewusst nicht / offen | — |

## Entscheidungen

- **Debrief-Quelle** ist ausschließlich `PROFILE.performance.debriefs` (debrief-record@5). Nichts wird
  live nachgerechnet — ein Debrief-Urteil darf sich später nicht ändern (eingefrorene Vorgabe).
  Ohne Record, aber mit Plan-Verknüpfung: „Rückmeldung fehlt" + Weg zum Plan.
- **Freie Einheiten** behalten die bisherige Einordnung (`rateActivity`) als Text — sie ist
  Beschreibung, kein Urteil.
- **Rückblick Belastung (ACWR)** nur für die laufende Woche: es ist ein Jetzt-Wert, keine Wochenbilanz.
- **Vergleich zur Vorwoche** nur bei vollständiger Messbasis beider Wochen (`completeness`).
- **Serie** zählt erfüllte Wochenpläne (done ≥ planned, Woche abgeschlossen, Plan vorhanden).
- **Pacing-Plan**: HM-Grenzen 5/15 km wie im Prototyp; kürzere und längere Strecken proportional
  (25 %/75 %). Unplausible Eingaben ⇒ null, kein Plan.

Tests: `debrief_v14_s5a` (34), `review_v14_s5b` (37), `pacing_plan_v14` (13).
