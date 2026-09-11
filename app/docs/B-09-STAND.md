# B-09 · Ausfall-/Krankheitslogik — Stand

**Stand:** 04.09.2026 · Build **v8-366** · Flag **`absence_replanner`** (Migration 0040, Standard aus)
**DoD (Band 1):** *Alle definierten Ausfallszenarien erzeugen einen gültigen Folgeplan; kein Plan-Totalverlust möglich (Test).*

## Was es vorher gab — und die Lücke

`progression@9` regelt die **Wochenlast** nach einer Unterbrechung (Krankheit: Symptomfreiheit zuerst, kein Einstiegsprozent; Verletzung: Kriterien). `Calc.adaptWeekPlan` regelt nur den **heutigen Tag** und schreibt bei Krankheit eine Notiz `REBUILD_WEEK` — gebaut wurde nichts. `Calc.illnessReturnWindow` deckelt den Tageszustand. Ergebnis: Der Rest der Woche stand mit Intervallen und Long Run da, während der Nutzer krank war; verpasste Kernreize verschwanden still.

## Gebaut

`engine/absence-replanner.js` (rein, 30/30) — wirkt im **Lesepfad** (`activeWeekPlan`, alle drei Zweige, nach der Zielphase), nicht persistierend. Eingaben aus der App: Krankheit aus 14 Tagen Morgen-Check-in (`m.ill`), verpasste Kernreize aus dem Plan-Ist-Resolver (vergangene Tage dieser Woche, nur Priorität A), Phase und Renntag aus B-01.

| Szenario | Folgeplan | Strategie |
|---|---|---|
| **Krank heute** | heute frei; Rest der Woche: Intervalle/Tempo → Z2, Long Run/Long Ride weg, Kraft → Mobility | kürzen — nichts nachholen; Rennen diese Woche ⇒ `raceAtRisk` (Entscheidung beim Menschen) |
| **Nach Krankheit** (symptomfrei seit N, Dauer D) | Rückkehrfenster min(max(D,1),7) Tage ohne harte Reize, Long Run kurz und locker, Kraft leicht; danach unverändert | kürzen |
| **Verletzung** (Modul-Eingabe; UI-Anbindung offen) | Laufen → Mobility, Beinkraft → Oberkörper, Rad/Schwimmen bleiben | Kriterien-Rückkehr (progression@9) |
| **Verpasster Kernreiz**, Phase build | höchstens **einer** nachgeholt: freier späterer Tag, ≥ 1 Tag Abstand zu harten Tagen, nie Vortag des Rennens, nie danach; weitere gestrichen | nachholen / streichen |
| **Verpasst** in Taper/Rennwoche | nichts nachholen | streichen |
| krank **und** verpasst | Krankheit gewinnt | kürzen |

Garantien (getestet): Eingabe nie mutiert, immer 7 Tage, nie null, nie Wurf, nie zwei harte Tage hintereinander erzeugt, nie mehr Einheiten als im Eingabeplan. „Kein Plan-Totalverlust" heißt hier: der Plan bleibt ein gültiges 7-Tage-Objekt mit expliziten Änderungen (`ORVIA._lastAbsencePlan.changes`), auch wenn Tage bewusst leer sind.

## Bewusst offen

- ~~Verletzungs-Meldung in der UI~~ **erledigt 11.09.** (`absence-replanner@2`): Verletzung wird aus den Profil-Beschwerden abgeleitet (`constraintsList`, nur `status: active`): `currentlyTrainable === false`, **oder** Laufen unter „betroffene Sportarten", **oder** untere Extremität mit Intensität ≥ 7/10. Schulter 9/10 oder „beobachtet" sind keine Verletzung — sonst verlöre jeder mit einer Notiz seinen Laufplan. Keine neue UI: der bestehende Beschwerden-Editor ist die Meldung.
- **Strecken auf die Folgewoche** („Woche strecken"): Der Plan ist eine wiederkehrende Wochenstruktur ohne Kalenderdatum; ein Übertrag in die nächste Woche braucht das kanonische Plan-Modell mit Overrides (Phase 5F). Heute: kürzen oder innerhalb der Woche nachholen. Ehrlich benannt statt still simuliert.
- **Sichtbarkeit**: Änderungen sind über `absenceAdjusted: true` markiert; ein Badge im Wochenplan („angepasst: krank") ist 10 Zeilen in der Wochenansicht — nach Sichtprüfung.

## Einschalten (dein Konto)

```sql
-- erst Migration 0040 (supabase/migrations/0040_absence_replanner_flag.sql), dann:
insert into public.user_feature_flags (user_id, flag, enabled, reason)
select id, 'absence_replanner', true, 'B-09 ab 2026-09-04' from auth.users where email = 'gthaysen@thaysen.com'
on conflict (user_id, flag) do update set enabled = true, reason = excluded.reason;
```
Schnelltest: Morgen-Check-in „krank" setzen → Wochenplan: heute leer, Long Run weg, Kraft → Mobility. Check-in zurücksetzen → Plan wie vorher (nichts wurde gespeichert).
