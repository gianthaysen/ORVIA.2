# Stufe D · Beschwerden wirken auf den Plan (14.09.2026, Build v8-377, Migration **0046**)

**Auslöser.** Produktionsbefund 13.09.: Knie links 9/10 im Profil (Stressreaktion nach dem HM), Tageszustand RED – der Wochenplan zeigte weiter Intervalle und Long Run.

## 1 · Ist-Zustand (gelesen)
- `engine/absence-replanner@3` (B-09) kennt Verletzung: Laufen → Mobility, Beinkraft → Oberkörper, Rad/Schwimmen bleiben. Quelle `injuryFromConstraints(PROFILE.constraintsList)` (currentlyTrainable false · Laufen betroffen · untere Extremität ≥ 7/10). Läuft im Lesepfad (`applyAbsenceToPlan`), nicht persistierend.
- Hinter Flag `absence_replanner` (0040), **nie gesetzt** → wirkungslos in Produktion.
- Kein Weg zurück: Beschwerde aktiv = alles raus; Beschwerde „behoben“ = sofort alles frei.
- Decision-Engine (v1 REST / v2 seit 13.09. REST) steuert nur den Tag, nicht die Woche.

## 2 · Zielzustand
Aktive Beschwerde → Plan ersetzt sichtbar und benannt („angepasst · Knie links“); Rückkehr über eine Leiter mit Kriterien statt nach Gefühl; Meilensteine im Rückkehrfenster als gefährdet markiert; Flag für alle Konten an.

## 3 · Umsetzung
| Datei | Änderung |
|---|---|
| `engine/return-ladder.js` (neu, rein) | Stufen 0 Schonung → 1 Gehen frei (3 T) → 2 Geh-Lauf (4 T) → 3 Locker kurz (4 T) → 4 Locker normal (5 T) → 5 Frei. `evaluate` (Tage in Stufe, Schmerz ≥ 5 seit Stufenbeginn = Blocker + Rückschlag-Hinweis), `advance`/`setback` (Kopie, append-only `returnLog`, Stufe 5 ⇒ Status `improved`), `policyFor`, `estimateDaysToFree`. Zustand an der Beschwerde: `returnStage`, `returnStageSince`, `returnLog` (Profil-jsonb, keine Migration). |
| `engine/absence-replanner@4` | Ersetzung nach Policy: none → Mobility · walkrun → „Geh-Lauf“ · easy_short → „Z2 Dauerlauf kurz“ · easy → Intervalle/Tempo → Z2, Long Run kurz · all → nichts. Beinkraft nur bei Policy. `affectedActivities` cycling/swimming → ebenfalls Mobility. Jedes Item trägt `absenceReason:'injury'` + `absenceLabel` („Knie links“). `injuryFromConstraints` liefert Label/Stufe/Policy, führend = strengste Beschwerde; Status `improved` mit Stufe < 5 bleibt wirksam. |
| `ui.js` | `gmPlanConstraintHTML()` unter dem Plan-Kopf (Slot `plan-constraint`): Banner „Wegen Knie links: n Einheiten ersetzt“, Leiter mit 6 Stufen, aktuelle Stufe + Kriterium der nächsten, Buttons „Stufe geschafft“/„Rückschlag“, Restdauer. Schmerztage aus `morning.knee` (nur Knie hat ein Tagesfeld). Badge „angepasst · Knie links“ an ersetzten Einheiten. |
| `profile.js` | `constraintLadderAdvance/Setback` – einziger Schreibpfad, über `_persistConstraints()`; Aufstieg blockiert mit Grund (Schmerz / fehlende Tage). |
| `goal-detail.js` | Meilensteine mit Datum ≤ geschätztes Rückkehrende → „gefährdet · Rückkehr nach Beschwerde“. |
| `0046_absence_replanner_default.sql` | CHECK idempotent (falls 0040 nie lief), Flag für alle Konten, Trigger-Funktion seedet beide Standardflags. |

## 4 · Risiken / bewusste Grenzen
- Rückkehr-Kriterien sind konservative Annahmen (Mindesttage), keine Messwerte – der Arzt/Physio schlägt sie. Die Leiter ersetzt keine Abklärung; Schmerz ≥ 8 bleibt Tageszustand RED/REST.
- Nur Knie hat ein Tages-Schmerzfeld im Check-in; andere Regionen laufen über die Intensität an der Beschwerde (Nutzerpflege). Folgearbeit: Check-in-Schmerz je Region.
- Stufe 0 → 1 ist ein Nutzerkriterium („schmerzfrei über die Auslöseschwelle gehen“), kein Tageszähler.
- Ohne Migration 0046 bleibt die Anzeige „Beschwerde aktiv – Plananpassung folgt nach Freischaltung“ (ehrlich, kein stiller Ausfall).

## 5 · Tests · DoD
`return_ladder_test` 27 (Leiter A1–A10, Ersetzung B1–B9, Verdrahtung C1–C7), `absence_replanner_test` 38 unverändert, `goal_detail_test` 36, Vorschau der Leiterkarte (Stufe 1 und 3) per Playwright. DoD: Beschwerde aktiv ⇒ keine Laufeinheit im gelesenen Plan, sichtbar begründet; Aufstieg nur mit Kriterium; Rückschlag eine Stufe zurück; nichts persistiert außer dem Leiterzustand an der Beschwerde.
