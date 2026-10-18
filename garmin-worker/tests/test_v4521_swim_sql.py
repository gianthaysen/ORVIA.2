"""v8-452.1 · Sicherung, Kontrolle, Rueckweg und Wiederherstellung fuer Runden/Bahnen — gegen ein ECHTES Postgres.

Die Zeilen baut der Worker-Code selbst (Details laden, dann Zusatzabrufe nachholen), die SQL-Dateien sind genau die,
die Gian im Supabase-SQL-Editor ausfuehrt:
    supabase/scripts/v4521_swim_extras_backup.sql
    supabase/scripts/v4521_swim_extras_check.sql      (nur lesend)
    supabase/scripts/v4521_swim_extras_rollback.sql
    supabase/scripts/v4521_swim_extras_restore.sql
Ohne Postgres-Programme wird das Modul UEBERSPRUNGEN (= nicht geprueft).
"""

import asyncio
import copy
import json

from orvia_worker import detail_sync as DS
from tests.conftest import FakeDb
from tests.test_sql_on_postgres import DETAILS, SQL, _q, pg  # noqa: F401 — pg ist das Postgres-Fixture

ON = ("splits", "typed_splits")
CORR = {"duration": {"manual": 3000, "source": 4170, "unit": "s", "at": "2026-10-12T18:00:00.000Z", "method": "manual"}}
SPLITS = {"activityId": 7, "lapDTOs": [
    {"lapIndex": 1, "distance": 50.0, "duration": 70.0, "numberOfActiveLengths": 2, "totalNumberOfStrokes": 30,
     "lengthDTOs": [{"distance": 25.0, "duration": 35.0}, {"distance": 25.0, "duration": 35.0}]},
    {"lapIndex": 2, "distance": 0.0, "duration": 40.0}]}


def _rows():
    """before = Stand nach normalem Details-Laden (ohne Zusatzabrufe); after = nach dem Nachholen."""
    async def build():
        db = FakeDb(); uid = "u"
        base = [
            {"user_id": uid, "source": "garmin", "source_record_id": "S1", "sport_id": "swimming", "started_at": "2026-10-11T11:00:00+00:00",
             "metrics": {"garmin": {"v": 1, "type_key": "lap_swimming"}, "ext": {"v": 1, "fields": {"activeLengths": 2, "poolLength": 2500}},
                         "corrections": copy.deepcopy(CORR)}},
            {"user_id": uid, "source": "garmin", "source_record_id": "S2", "sport_id": "swimming", "started_at": "2026-06-19T12:00:00+00:00",
             "metrics": {"garmin": {"v": 1, "type_key": "open_water_swimming"}, "ext": {"v": 1, "fields": {"distance": 900}}}},
            {"user_id": uid, "source": "garmin", "source_record_id": "R1", "sport_id": "running", "started_at": "2026-10-10T07:00:00+00:00",
             "metrics": {"garmin": {"v": 1, "type_key": "running"}, "splits": [{"distance": 1000.0, "duration": 300.0}]}},
        ]
        await db.insert("activities", copy.deepcopy(base))
        await DS.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
        before = copy.deepcopy(db.tables["activities"])
        await DS.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10,
                                       get_extra=lambda name, aid: SPLITS if name == "splits" else {"activityId": 7, "splits": []},
                                       extras=ON, refetch_extras=True, extras_sports=("swimming",))
        after = copy.deepcopy(db.tables["activities"])
        return before, after
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


def test_backup_check_rollback_restore_on_postgres(pg):
    before, after = _rows()
    assert after[2]["metrics"] == before[2]["metrics"]                       # Lauf vom Nachholen unberuehrt
    assert after[0]["metrics"]["ext"]["extras"] == {"splits": "ok", "typed_splits": "empty"}
    assert after[1]["metrics"]["ext"]["extras"] == {"splits": "ok"}         # Freiwasser: keine Bahnen-Abfrage

    # 1 · Sicherung VOR dem Nachholen (Stand before)
    _load(pg, before)
    out = pg(file=SQL / "scripts" / "v4521_swim_extras_backup.sql", csv=True)
    assert "2" in out.splitlines()[-1].split(",")[0]
    # 2 · Nachholen (so schreibt es der Worker)
    for i, r in enumerate(after, start=1):
        pg(f"update public.activities set metrics = {_q(r['metrics'])} where id = {i};")
    # zweite Sicherung ueberschreibt die erste nicht
    pg(file=SQL / "scripts" / "v4521_swim_extras_backup.sql")
    n = pg("select count(*) from orvia_backup.activities_swim_v4521 where metrics ? 'splits';", csv=True).splitlines()[1]
    assert n == "0"

    # 3 · Kontrolle: Bahnen roh = Listeneintrag; keine andere Sportart mit Zusatzdaten
    chk = pg(file=SQL / "scripts" / "v4521_swim_extras_check.sql", csv=True)
    lines = chk.splitlines()
    head = lines[0].split(",")
    pool = dict(zip(head, [x for x in lines if ",lap_swimming," in x][0].split(",")))
    assert pool["runden_abruf"] == "ok" and pool["runden"] == "2" and pool["aktive_bahnen_roh"] == "2" and pool["bahnen_liste"] == "2"
    assert pool["manuelle_korrektur"] == "t"
    assert "running" not in chk                                              # zweite Abfrage leer
    for secret in ("S1", "R1", "activityId"):
        assert secret not in chk

    # 4 · Rueckweg: exakt der Stand vor dem Nachholen (bis auf den Zeitstempel des Detailabrufs)
    pg("update public.activities set metrics = jsonb_set(metrics, '{plannedSessionId}', '\"plan-9\"') where id = 2;")   # Client schreibt dazwischen
    pg(file=SQL / "scripts" / "v4521_swim_extras_rollback.sql")
    got = _metrics(pg)
    want = [copy.deepcopy(r["metrics"]) for r in before]
    want[1]["plannedSessionId"] = "plan-9"
    assert [_no_ts(m) for m in got] == [_no_ts(m) for m in want]
    assert got[2] == before[2]["metrics"]                                    # Lauf: fremde Runden bleiben
    pg(file=SQL / "scripts" / "v4521_swim_extras_rollback.sql")             # zweiter Lauf aendert nichts
    assert _metrics(pg) == got

    # 5 · Wiederherstellung aus der Sicherung: aktuelle Korrektur (zurueckgenommen) und Plan-Zuordnung bleiben
    for i, r in enumerate(after, start=1):
        pg(f"update public.activities set metrics = {_q(r['metrics'])} where id = {i};")
    pg("update public.activities set metrics = (metrics - 'corrections') where id = 1;")                    # Korrektur zurueckgenommen
    pg("update public.activities set metrics = jsonb_set(metrics, '{plannedSessionId}', '\"plan-9\"') where id = 2;")
    pg(file=SQL / "scripts" / "v4521_swim_extras_restore.sql")
    got = _metrics(pg)
    exp0 = copy.deepcopy(before[0]["metrics"]); exp0.pop("corrections")
    exp1 = copy.deepcopy(before[1]["metrics"]); exp1["plannedSessionId"] = "plan-9"
    assert got[0] == exp0 and got[1] == exp1
    assert got[2] == after[2]["metrics"]                                     # nicht gesichert → nicht angefasst
    pg(file=SQL / "scripts" / "v4521_swim_extras_restore.sql")
    assert _metrics(pg) == got
