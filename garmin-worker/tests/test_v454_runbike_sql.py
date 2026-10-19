"""v8-454 · Sicherung, Kontrolle, Rueckweg und Wiederherstellung fuer Runden/Intervalle Laufen und Rad — gegen ein ECHTES Postgres.

Ausgangslage = Produktion nach v8-452.1: Schwimmeinheiten haben bereits Garmin-Runden/Bahnen (DETAIL_EXTRAS_SPORTS=swimming).
Dann (nur nach Freigabe) DETAIL_EXTRAS=splits,typed_splits und DETAIL_EXTRAS_SPORTS=swimming,running,cycling mit einmaligem Nachholen.
Die Zeilen baut der Worker-Code selbst; die SQL-Dateien sind genau die, die Gian im Supabase-SQL-Editor ausfuehrt:
    supabase/scripts/v454_runbike_extras_backup.sql
    supabase/scripts/v454_runbike_extras_check.sql      (nur lesend)
    supabase/scripts/v454_runbike_extras_rollback.sql
    supabase/scripts/v454_runbike_extras_restore.sql
Ohne Postgres-Programme wird das Modul UEBERSPRUNGEN (= nicht geprueft).
"""

import asyncio
import copy
import json

from orvia_worker import detail_sync as DS
from tests.conftest import FakeDb
from tests.test_sql_on_postgres import DETAILS, SQL, _q, pg  # noqa: F401 — pg ist das Postgres-Fixture

CORR = {"duration": {"manual": 3000, "source": 3100, "unit": "s", "at": "2026-10-12T18:00:00.000Z", "method": "manual"}}
SWIM = {"activityId": 7, "lapDTOs": [{"lapIndex": 1, "distance": 50.0, "duration": 70.0, "lengthDTOs": [{"distance": 25.0, "duration": 35.0}]}]}
RUN = {"activityId": 8, "lapDTOs": [
    {"lapIndex": 1, "distance": 1000.0, "duration": 300.0, "averageRunCadence": 170.0, "intensityType": "ACTIVE", "wktStepIndex": 0},
    {"lapIndex": 2, "distance": 1000.0, "duration": 305.0, "averageRunCadence": 171.0, "intensityType": "ACTIVE", "wktStepIndex": 0}]}
TYPED = {"activityId": 8, "splits": [{"type": "INTERVAL_ACTIVE", "distance": 2000.0, "duration": 605.0, "lapIndexes": [1, 2]}]}
BIKE = {"activityId": 9, "lapDTOs": [{"lapIndex": 1, "distance": 5000.0, "duration": 750.0, "averageBikeCadence": 80.0},
                                     {"lapIndex": 2, "distance": 5000.0, "duration": 740.0, "averageBikeCadence": 82.0}]}


def _extra(name, aid):
    if name == "typed_splits":
        return TYPED if aid == "R2" else {"activityId": 1, "splits": []}
    return {"S1": SWIM, "R2": RUN, "C1": BIKE}.get(aid, {"activityId": 1, "lapDTOs": []})


def _rows():
    """swim = Stand nach v8-452.1 (Schwimmen mit Runden); before = vor dem v8-454-Nachholen; after = danach."""
    async def build():
        db = FakeDb(); uid = "u"
        base = [
            {"user_id": uid, "source": "garmin", "source_record_id": "S1", "sport_id": "swimming", "started_at": "2026-10-11T11:00:00+00:00",
             "metrics": {"garmin": {"v": 1, "type_key": "lap_swimming"}, "ext": {"v": 1, "fields": {"activeLengths": 2}}}},
            {"user_id": uid, "source": "garmin", "source_record_id": "R1", "sport_id": "running", "started_at": "2026-10-10T07:00:00+00:00",
             "metrics": {"garmin": {"v": 1, "type_key": "running"}, "splits": [{"distance": 1000.0, "duration": 300.0}]}},       # fremde Runden
            {"user_id": uid, "source": "garmin", "source_record_id": "R2", "sport_id": "running", "started_at": "2026-10-15T07:00:00+00:00",
             "metrics": {"garmin": {"v": 1, "type_key": "running"}, "corrections": copy.deepcopy(CORR)}},
            {"user_id": uid, "source": "garmin", "source_record_id": "C1", "sport_id": "cycling", "started_at": "2026-10-16T07:00:00+00:00",
             "metrics": {"garmin": {"v": 1, "type_key": "road_biking"}}},
            {"user_id": uid, "source": "garmin", "source_record_id": "G1", "sport_id": "gym", "started_at": "2026-10-17T07:00:00+00:00",
             "metrics": {"garmin": {"v": 1, "type_key": "strength_training"}}},
        ]
        await db.insert("activities", copy.deepcopy(base))
        await DS.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
        # v8-452.1 (Produktion): nur Schwimmen
        await DS.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10, get_extra=_extra, extras=("splits",),
                                       refetch_extras=True, extras_sports=("swimming",))
        before = copy.deepcopy(db.tables["activities"])
        # v8-454 (nach Freigabe): Laufen und Rad dazu, Intervall-Antwort nur Laufen
        calls = []
        await DS.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10,
                                       get_extra=lambda n, aid: (calls.append((n, aid)), _extra(n, aid))[1],
                                       extras=("splits", "typed_splits"), refetch_extras=True,
                                       extras_sports=("swimming", "running", "cycling"))
        after = copy.deepcopy(db.tables["activities"])
        return before, after, calls
    return asyncio.run(build())


def _load(pg, rows):
    pg("drop table if exists public.activities; drop schema if exists orvia_backup cascade;"
       "create table public.activities (id serial primary key, user_id text, source text, sport_id text,"
       " started_at timestamptz, metrics jsonb);")
    for r in rows:
        pg(f"insert into public.activities (user_id, source, sport_id, started_at, metrics) values "
           f"('{r['user_id']}', 'garmin', '{r['sport_id']}', '{r['started_at']}', {_q(r['metrics'])});")


def _metrics(pg):
    out = pg("select encode(convert_to(coalesce(json_agg(metrics order by id), '[]')::text, 'UTF8'), 'hex') "
             "from public.activities;", csv=True).splitlines()
    return json.loads(bytes.fromhex(out[1].strip()).decode("utf-8"))


def _no_ts(m):
    m = copy.deepcopy(m)
    m.pop("detailsFetchedAt", None)
    return m


def test_worker_refetch_scope():
    before, after, calls = _rows()
    # Schwimmen: Befund steht seit v8-452.1 → kein neuer Abruf, Daten unveraendert
    assert after[0]["metrics"] == before[0]["metrics"] and before[0]["metrics"]["splits_source"] == "garmin_splits"
    assert {aid for _, aid in calls} == {"R1", "R2", "C1"}
    assert ("typed_splits", "C1") not in calls                                          # Intervall-Antwort nur Laufen
    r1, r2, c1, g1 = after[1]["metrics"], after[2]["metrics"], after[3]["metrics"], after[4]["metrics"]
    assert r1["splits"] == before[1]["metrics"]["splits"] and "splits_source" not in r1    # fremde Runden bleiben
    assert r2["splits_source"] == "garmin_splits" and [l["averageRunCadence"] for l in r2["splits"]] == [170.0, 171.0]
    assert [l["wktStepIndex"] for l in r2["splits"]] == [0, 0]
    assert r2["ext"]["typed_splits"]["splits"][0]["lapIndexes"] == [1, 2]
    assert r1["ext"]["extras"] == {"splits": "empty", "typed_splits": "empty"} or r1["ext"]["extras"].get("typed_splits") == "empty"
    assert r2["corrections"] == CORR                                                    # Korrektur bleibt
    assert c1["splits_source"] == "garmin_splits" and "typed_splits" not in c1["ext"] and c1["ext"]["extras"] == {"splits": "ok"}
    assert g1 == before[4]["metrics"]                                                   # Kraft unberuehrt


def test_backup_check_rollback_restore_on_postgres(pg):
    before, after, _ = _rows()
    # 1 · Sicherung VOR dem Nachholen
    _load(pg, before)
    out = pg(file=SQL / "scripts" / "v454_runbike_extras_backup.sql", csv=True)
    assert "cycling,1" in out and "running,2" in out
    # 2 · Nachholen (so schreibt es der Worker)
    for i, r in enumerate(after, start=1):
        pg(f"update public.activities set metrics = {_q(r['metrics'])} where id = {i};")
    pg(file=SQL / "scripts" / "v454_runbike_extras_backup.sql")                          # zweite Sicherung ueberschreibt nicht
    assert pg("select count(*) from orvia_backup.activities_runbike_v454 where metrics ->> 'splits_source' = 'garmin_splits';",
              csv=True).splitlines()[1] == "0"

    # 3 · Kontrolle (nur lesend)
    chk = pg(file=SQL / "scripts" / "v454_runbike_extras_check.sql", csv=True)
    lines = chk.splitlines()
    head = lines[0].split(",")
    agg = {row[0]: dict(zip(head, row)) for row in (x.split(",") for x in lines[1:3])}
    assert agg["running"]["einheiten"] == "2" and agg["running"]["runden_garmin"] == "1" and agg["running"]["runden_fremd"] == "1"
    assert agg["running"]["intervalle_ok"] == "1" and agg["running"]["manuelle_korrektur"] == "1"
    assert agg["cycling"]["runden_ok"] == "1" and agg["cycling"]["intervalle_ok"] == "0"
    assert "unerwartet" in chk and "gym" not in chk.split("unerwartet")[1]              # dritte Abfrage leer
    for secret in ("R1", "R2", "C1", "activityId"):
        assert secret not in chk
    assert _metrics(pg)[0] == after[0]["metrics"]                                       # Kontrolle aendert nichts

    # 4 · Rueckweg: exakt der Stand vor dem Nachholen; Schwimmen behaelt seine Runden/Bahnen
    pg("update public.activities set metrics = jsonb_set(metrics, '{plannedSessionId}', '\"plan-9\"') where id = 4;")   # Client schreibt dazwischen
    pg(file=SQL / "scripts" / "v454_runbike_extras_rollback.sql")
    got = _metrics(pg)
    want = [copy.deepcopy(r["metrics"]) for r in before]
    want[3]["plannedSessionId"] = "plan-9"
    assert [_no_ts(m) for m in got] == [_no_ts(m) for m in want]
    assert got[0]["splits_source"] == "garmin_splits" and got[0]["ext"]["splits"]["lapDTOs"]                # Schwimmen unberuehrt
    assert got[1]["splits"] == before[1]["metrics"]["splits"]                           # fremde Runden bleiben
    pg(file=SQL / "scripts" / "v454_runbike_extras_rollback.sql")                       # zweiter Lauf aendert nichts
    assert _metrics(pg) == got

    # 5 · Wiederherstellung: aktuelle Korrektur (zurueckgenommen) und Plan-Zuordnung bleiben; Schwimmen/Kraft nicht angefasst
    for i, r in enumerate(after, start=1):
        pg(f"update public.activities set metrics = {_q(r['metrics'])} where id = {i};")
    pg("update public.activities set metrics = (metrics - 'corrections') where id = 3;")
    pg("update public.activities set metrics = jsonb_set(metrics, '{plannedSessionId}', '\"plan-9\"') where id = 4;")
    pg(file=SQL / "scripts" / "v454_runbike_extras_restore.sql")
    got = _metrics(pg)
    exp2 = copy.deepcopy(before[2]["metrics"]); exp2.pop("corrections")
    exp3 = copy.deepcopy(before[3]["metrics"]); exp3["plannedSessionId"] = "plan-9"
    assert got[2] == exp2 and got[3] == exp3 and got[1] == before[1]["metrics"]
    assert got[0] == after[0]["metrics"] and got[4] == after[4]["metrics"]
    pg(file=SQL / "scripts" / "v454_runbike_extras_restore.sql")
    assert _metrics(pg) == got
