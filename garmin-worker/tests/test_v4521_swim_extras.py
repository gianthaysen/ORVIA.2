"""v8-452.1 · Runden und Bahnen beim Schwimmen: Eingrenzung je Sportart und Schutz des Bestands.

S1  DETAIL_EXTRAS_SPORTS: Standard leer (Verhalten wie v8-452), Werte klein geschrieben.
S2  Mit DETAIL_EXTRAS_SPORTS=swimming bekommt KEINE andere Sportart einen Zusatzabruf — weder neu noch beim
    Nachholen (DETAIL_REFETCH_EXTRAS). Grund: run-bests liest metrics.splits als Rueckfall fuer Laufbestzeiten.
S3  Nachholen zaehlt und laedt nur Schwimmeinheiten; Laeufe/Rad/Kraft bleiben Byte fuer Byte unveraendert.
S4  Runden anderer Quelle (Detailantwort / eigene Daten) werden nie ersetzt; der Rohblock wird trotzdem abgelegt.
S5  Nachholen bei einer Schwimmeinheit: manuelle Korrekturen, Plan-Zuordnung, Rohfelder des Listeneintrags und
    Herkunft bleiben; ein Fehlschlag eines Zusatzabrufs zerstoert nichts und wird nicht endlos wiederholt.

Belegstufe: Antwortformen synthetisch (Feldnamen wie in der Bibliothek); die echte Form prueft
test_v4521_swim_capture.py am anonymisierten Mitschnitt, sobald er im Repo liegt.
"""

import asyncio
import copy
import json
from pathlib import Path

from orvia_worker import detail_sync as DS
from orvia_worker.config import Settings
from tests.conftest import FakeDb

FIX = Path(__file__).parent / "fixtures" / "garmin"
DETAILS = json.load(open(FIX / "activity_details.json", encoding="utf-8"))
BASE_ENV = {"SUPABASE_URL": "u", "SUPABASE_SERVICE_ROLE_KEY": "k", "TOKEN_ENCRYPTION_KEY": "t"}
ON = ("splits", "typed_splits")
CORR = {"duration": {"manual": 3000, "source": 4170, "unit": "s", "at": "2026-10-12T18:00:00.000Z", "method": "manual"}}


def _row(rid, sport, type_key, **m_over):
    m = {"detailsFetchedAt": "2026-10-15T00:00:00Z", "detailsVersion": DS.DETAILS_CONTRACT_VERSION, "detailsMaxchart": 20000,
         "garmin": {"v": 1, "type_key": type_key, "start_gmt": "2026-10-11T11:13:00Z", "timer_duration_s": 4171},
         "streams": {"heart_rate": [100, 110, 120]},
         "ext": {"v": 1, "fields": {"distance": 1350, "poolLength": 2500, "activeLengths": 54}}}
    m.update(m_over)
    return {"user_id": "u1", "source": "garmin", "source_record_id": rid, "sport_id": sport, "metrics": m}


def _swim_splits():
    return {"activityId": 1, "lapDTOs": [
        {"lapIndex": 1, "distance": 100.0, "duration": 130.0, "movingDuration": 122.0, "averageHR": 140,
         "lengthDTOs": [{"distance": 25.0, "duration": 30.5, "lengthIndex": 1}, {"distance": 25.0, "duration": 31.0, "lengthIndex": 2}]},
        {"lapIndex": 2, "distance": 0.0, "duration": 60.0, "elapsedDuration": 60.0, "averageHR": 120}]}


# ---- S1 ---------------------------------------------------------------------

def test_setting_default_empty_and_parsed():
    assert Settings.from_env(BASE_ENV).detail_extras_sports == ()
    assert Settings.from_env({**BASE_ENV, "DETAIL_EXTRAS_SPORTS": " Swimming , "}).detail_extras_sports == ("swimming",)


# ---- S2 ---------------------------------------------------------------------

def test_extras_for_respects_sport_scope():
    f = DS.extras_for
    assert f("running", ON, type_key="running", sports=("swimming",)) == []
    assert f("cycling", ON, type_key="road_biking", sports=("swimming",)) == []
    assert f("swimming", ON, type_key="lap_swimming", sports=("swimming",)) == ["splits"]          # v8-454: Intervall-Abruf nur Laufen
    assert f("swimming", ON, type_key="open_water_swimming", sports=("swimming",)) == ["splits"]   # Bahnen nur im Becken
    assert f("running", ON, type_key="running") == ["splits", "typed_splits"]                       # leer = wie v8-452
    assert f("running", ON, type_key="running", sports=()) == ["splits", "typed_splits"]


def test_needs_extras_and_status_respect_sport_scope():
    swim, run = _row("S", "swimming", "lap_swimming"), _row("R", "running", "running")
    assert DS._needs_extras(run, ON, ("swimming",)) is False
    assert DS._needs_extras(swim, ON, ("swimming",)) is True
    assert DS._needs_details(run, refetch_extras=ON, extras_sports=("swimming",)) is False
    assert DS._needs_details(swim, refetch_extras=ON, extras_sports=("swimming",)) is True
    st = DS.backfill_status([swim, run, _row("G", "gym", "strength_training")], refetch_extras=ON, extras_sports=("swimming",))
    assert st["extras_pending"] == 1
    assert DS.backfill_status([swim, run], refetch_extras=ON)["extras_pending"] == 2                # ohne Eingrenzung


# ---- S3 ---------------------------------------------------------------------

def test_refetch_touches_only_swims():
    async def run():
        db = FakeDb()
        rows = [_row("S1", "swimming", "lap_swimming"), _row("R1", "running", "running", splits=[{"distance": 1000.0, "duration": 300.0}]),
                _row("C1", "cycling", "road_biking"), _row("G1", "gym", "strength_training")]
        await db.insert("activities", copy.deepcopy(rows))
        calls = []

        def get_details(aid):
            calls.append(("details", aid))
            return DETAILS

        def get_extra(name, aid):
            calls.append((name, aid))
            return _swim_splits() if name == "splits" else {"activityId": 1, "splits": []}

        res = await DS.sync_activity_details(db, "u1", get_details, limit=10, get_extra=get_extra, extras=ON,
                                             refetch_extras=True, extras_sports=("swimming",))
        assert res["selected"] == ["S1"] and res["updated"] == 1
        assert {aid for _, aid in calls} == {"S1"}
        after = {r["source_record_id"]: r for r in await db.select("activities", {"user_id": "u1"})}
        for rid, before in (("R1", rows[1]), ("C1", rows[2]), ("G1", rows[3])):
            assert after[rid]["metrics"] == before["metrics"], rid                               # unveraendert
        assert after["S1"]["metrics"]["ext"]["extras"] == {"splits": "ok"}
        assert res["status"]["extras_pending"] == 0
        # zweiter Lauf: Befund steht → kein weiterer Abruf
        calls.clear()
        res2 = await DS.sync_activity_details(db, "u1", get_details, limit=10, get_extra=get_extra, extras=ON,
                                              refetch_extras=True, extras_sports=("swimming",))
        assert res2["selected"] == [] and calls == []
    asyncio.run(run())


# ---- S4 ---------------------------------------------------------------------

def test_foreign_splits_are_never_replaced():
    own = [{"distance": 1000.0, "duration": 300.0}]
    m = DS.merge_extras({"splits": copy.deepcopy(own)}, "running", {"splits": _swim_splits()})
    assert m["splits"] == own and "splits_source" not in m
    assert m["ext"]["splits"]["lapDTOs"][0]["distance"] == 100.0                                  # Rohblock trotzdem da
    m2 = DS.merge_extras({"splits": [{"distance": 1.0, "duration": 1.0}], "splits_source": "garmin_splits"}, "swimming",
                         {"splits": _swim_splits()})
    assert [l["distance"] for l in m2["splits"]] == [100.0, 0.0] and m2["splits_source"] == "garmin_splits"
    m3 = DS.merge_extras({}, "swimming", {"splits": _swim_splits()})
    assert m3["splits_source"] == "garmin_splits" and len(m3["splits"]) == 2


def test_nested_lengths_survive_keep_structure():
    m = DS.merge_extras({}, "swimming", {"splits": _swim_splits()})
    lengths = m["ext"]["splits"]["lapDTOs"][0]["lengthDTOs"]
    assert [x["duration"] for x in lengths] == [30.5, 31.0]
    assert "activityId" not in json.dumps(m["ext"])


# ---- S5 ---------------------------------------------------------------------

def test_swim_refetch_keeps_user_and_garmin_data():
    async def run():
        db = FakeDb()
        row = _row("S2", "swimming", "lap_swimming", corrections=copy.deepcopy(CORR), durationCorrection={"seconds": 3000},
                   plannedSessionId="plan-7")
        row["duration_seconds"] = 4171
        await db.insert("activities", [copy.deepcopy(row)])

        def get_extra(name, aid):
            if name == "splits":
                raise RuntimeError("429")
            return _swim_splits()

        await DS.sync_activity_details(db, "u1", lambda aid: DETAILS, limit=5, get_extra=get_extra, extras=ON,
                                       refetch_extras=True, extras_sports=("swimming",))
        r = (await db.select("activities", {"user_id": "u1", "source_record_id": "S2"}))[0]
        m = r["metrics"]
        assert m["corrections"] == CORR and m["durationCorrection"] == {"seconds": 3000} and m["plannedSessionId"] == "plan-7"
        assert r["duration_seconds"] == 4171
        assert m["ext"]["fields"]["poolLength"] == 2500 and m["ext"]["fields"]["activeLengths"] == 54   # Listeneintrag bleibt
        assert m["garmin"]["type_key"] == "lap_swimming"
        assert m["ext"]["extras"] == {"splits": "failed"} and "splits" not in m
        assert m["detailsVersion"] == DS.DETAILS_CONTRACT_VERSION
        # 'failed' ist ein Befund → kein Endlosabruf
        assert DS._needs_extras(r, ON, ("swimming",)) is False
    asyncio.run(run())
