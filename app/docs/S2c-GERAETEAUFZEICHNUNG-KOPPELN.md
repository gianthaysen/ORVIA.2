# S2c · Geräteaufzeichnung an ORVIA-Workout koppeln (Umsetzungsplan)

Stand: 2026-09-15 · Status: PLAN, wartet auf Freigabe · Vorgänger: v8-386/387 (Satzdetails, Nachladen), Backfill Juni

## 1. Aktueller Zustand (Befund)

Eine Krafteinheit, bei der die Garmin-Uhr mitläuft, existiert zweimal in `activities`:

| Quelle | source | Inhalt | Beispiel 23.06. |
|---|---|---|---|
| ORVIA Live-Workout | `orvia_workout` (+ `workout_session_id`) | Übungen, Sätze, Volumen, Dauer aus Start/Ende | 14:03 · 7 Übungen · 1 h 43 |
| Garmin-Import (Worker) | `garmin` | Ø HF, Kalorien, Dauer der Uhr, Streams | 14:02 · 93 bpm · 1 h 44 |

`mergeAllActivities` (activity-config.js) dedupliziert nur über id / clientRecordId / source+sourceRecordId / workoutSessionId — die beiden Datensätze teilen keinen dieser Schlüssel und gelten als zwei Einheiten. `load-history.js` (`identityOf`) sieht ebenfalls zwei Identitäten.

Auswirkung (belegt, nicht vermutet):
- Wochenlast / ACWR: Dauer und systemische Last der Einheit doppelt (≈ 3,5 h statt 1,7 h je Kraftsession mit Uhr).
- Einheitenzähler (Analyse, Profil, Kraftprofil-Teaser „n Krafteinheiten"): +1 je gekoppelter Session.
- Aktivitätsliste: zwei Karten für ein Training; Ø HF steht auf der Karte ohne Sätze, Sätze auf der Karte ohne HF.
- Muskelvolumen / Kraftprofil: NICHT betroffen (lesen Sessions/Sätze, nicht Activities).

## 2. Zielzustand

Eine Einheit = eine Aktivität. Die ORVIA-Workout-Aktivität ist der Primärdatensatz; die Geräteaufzeichnung wird als **gekoppelte Aufzeichnung** daran gebunden:
- Server: `activities.linked_activity_id uuid` (FK auf activities, `on delete set null`) + `link_kind text` (`'device_recording'`). Der Garmin-Datensatz bleibt vollständig erhalten, ist nur nicht mehr eigenständig.
- Liste: eine Karte, Quelle „ORVIA Workout + Garmin"; Metriken: Übungen · Dauer (Uhr, wenn vorhanden, sonst Workout) · — · Ø HF (Uhr).
- Detail: Sätze aus dem Workout, HF-/Kalorien-/Stream-Karten aus der Aufzeichnung.
- Last: genau einmal, mit der verlässlicheren Dauer (Uhr).
- Kopplung ist rückgängig machbar (Detail → „Aufzeichnung lösen"), Regeln deterministisch, kein Datum-only-Match.

Kopplungsregel (beide Richtungen, gleicher Nutzer): Sportart beider = `gym`; Zeitfenster überlappen sich; |Δ Start| ≤ 20 min. Bei mehreren Kandidaten gewinnt der kleinste |Δ Start|. Keine automatische Kopplung, wenn eine Seite bereits gekoppelt ist.

## 3. Betroffene Dateien

- `supabase/migrations/0048_activity_link.sql` — Spalten, Index, RPC `orvia_link_activities(p_primary uuid, p_recording uuid)` / `orvia_unlink_activity(p_recording uuid)` (security invoker, RLS), Backfill-Funktion `orvia_autolink_recordings()` für Bestand.
- `garmin-worker/orvia_worker/sync.py` — nach Insert einer Gym-Aktivität: Kandidat suchen (`select activities where source='orvia_workout' and sport_id='gym' and started_at between …`), bei Treffer `update … linked_activity_id`.
- `app/js/activity-config.js` — `mergeAllActivities`: gekoppelte Aufzeichnungen aus der Hauptliste nehmen und als `a.recording` an den Primärdatensatz hängen; `activityKeys` unverändert.
- `app/js/activity-normalize.js` — `normalizeActivityRecord`: `linkedActivityId`, `linkKind` übernehmen.
- `app/js/activity-store.js` — Merge/Sync: Felder durchreichen; `isTombstoned` unverändert.
- `app/js/activity.js` — `activityDetailViewModel`: HF/Kalorien/Streams aus `a.recording` auffüllen, wenn Workout sie nicht hat; `source`-Label kombiniert.
- `app/js/ui.js` — Listenkarte (Quelle, Ø HF), Detailseite (Karte „Aufzeichnung (Garmin)", Button „Aufzeichnung lösen"), Diagnose.
- `app/js/engine/load-history.js` — `asUnit`/`loadOf`: Dauer aus `recording` bevorzugen; gekoppelte Aufzeichnungen sind nicht mehr in der Eingabeliste (Merge liefert sie nicht einzeln).
- `app/js/repos/activityRepository.js` — `link(primaryId, recordingId)`, `unlink(recordingId)`.
- `app/locales/de.js` — `ui.act_quelle_kombi`, `ui.aufzeichnung_loesen`, `ui.aufzeichnung_karte`.
- Tests: `activity_link_test.mjs` (Regel, Kandidatenwahl, Merge), `load_history` Erweiterung (einmalige Zählung), `activity_detail_ad1_contract` Erweiterung (HF aus recording), SQL-Test lokal (Migration + RPC + Backfill).

## 4. Technische Abhängigkeiten

- Migration 0048 muss VOR dem Deploy der Client-Änderung angewendet sein (Client liest neue Spalten tolerant: fehlen sie, verhält er sich wie heute).
- Worker-Deploy (Railway) unabhängig vom App-Deploy; ohne Worker-Änderung koppelt der Backfill nur den Bestand, neue Importe bleiben ungekoppelt bis der Worker nachzieht.
- Konsumenten, die `activityStore.listActivities()` direkt lesen (orvia-pro.js, profile.js, capacity-adapter.js), sehen die Kopplung nur, wenn der lokale Store die Felder trägt → Merge muss die Aufzeichnung auch im lokalen Store als gekoppelt markieren.

## 5. Risiken

- Fehlkopplung (zwei echte Trainings kurz nacheinander): durch Sport=gym + Überlappung + ≤ 20 min sehr unwahrscheinlich; bleibt über „lösen" korrigierbar.
- Tombstone-Semantik: Löschen des Workouts → Aufzeichnung wird durch `on delete set null` wieder eigenständig (gewollt, nichts geht verloren).
- Doppelte Dauerkorrektur: „Dauer korrigieren" schreibt heute auf die Workout-Aktivität; nach Kopplung muss klar sein, welche Dauer gilt (Regel: Korrektur gewinnt vor Uhr vor Workout).
- Legacy-Pfad `legacy_local` unberührt.

## 6. Reihenfolge

1. Migration 0048 + lokaler SQL-Test (Cloud-Postgres, wie 0047) → Gian wendet an.
2. Read-only-SQL zur Kandidatenzählung (siehe unten) → Erwartung mit Gian abgleichen.
3. Backfill `select orvia_autolink_recordings()` (mit Claims, wie Backfill Juni).
4. Client: normalize → store → merge → load-history → detail/list → Tests → Build v8-388.
5. Worker: Auto-Link nach Insert + Test.

## 7. Teststrategie

- Unit: Kopplungsregel (Treffer, Δ 21 min = kein Treffer, zwei Kandidaten → nächster, bereits gekoppelt → kein Treffer).
- Merge: Liste enthält Aufzeichnung nicht einzeln; Primär trägt `recording`.
- Last: eine Einheit, Dauer der Uhr; Korrektur schlägt Uhr.
- Detail: Sätze + HF sichtbar; „lösen" stellt zwei Karten wieder her.
- Live: 23.06. (ORVIA 14:03 / Garmin 14:02) als Referenzfall.

## 8. Definition of Done

- Kein Tag mit zwei Gym-Aktivitäten, deren Fenster überlappen, ohne Kopplung (SQL-Prüfung liefert 0).
- Wochenlast KW 26 entspricht einmaliger Zählung (Vorher/Nachher-Wert dokumentiert).
- Suite grün, Deploy-Verify bestanden, Worker-Test grün.

## Anhang · Read-only-SQL: Kandidaten zählen

```sql
with me as (select id from auth.users where email = 'gianthaysen76@gmail.com')
select w.started_at::date as tag,
       w.started_at as orvia_start, g.started_at as garmin_start,
       round(extract(epoch from (g.started_at - w.started_at))/60) as delta_min,
       w.duration_seconds as orvia_s, g.duration_seconds as garmin_s,
       w.id as orvia_activity, g.id as garmin_activity
from public.activities w
join public.activities g
  on g.user_id = w.user_id and g.source = 'garmin' and g.sport_id = 'gym'
 and tstzrange(g.started_at, coalesce(g.ended_at, g.started_at + make_interval(secs => coalesce(g.duration_seconds,0))))
     && tstzrange(w.started_at, coalesce(w.ended_at, w.started_at + make_interval(secs => coalesce(w.duration_seconds,0))))
 and abs(extract(epoch from (g.started_at - w.started_at))) <= 20*60
join me on me.id = w.user_id
where w.source = 'orvia_workout' and w.sport_id = 'gym'
order by w.started_at;
```
