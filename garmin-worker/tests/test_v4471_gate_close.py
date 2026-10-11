"""v8-447.1 · Abschluss des Validierungs-Gates.

G1  Herkunfts-Nachtrag erkennt auch einen VORHANDENEN, aber unvollstaendigen Garmin-Block.
G2  Gezielter erneuter Detailabruf fuer Aktivitaeten, die schon auf Vertrag 3 stehen, aber mit
    kleinerem maxChartSize geladen wurden: nur wenn eingeschaltet, nach allem anderen, begrenzt,
    Abbruch bei 429, manuelle Korrekturen bleiben, Bestwerte werden aus der vollen Antwort neu
    gerechnet, danach nie wieder.
G3  Bedeutungspruefung im Worker: Urteile (keine Rohwerte) in metrics.ext.semantics.
"""

import asyncio
import json
from pathlib import Path

from orvia_worker import detail_sync, normalize, semantic_checks as SC
from orvia_worker.config import Settings
from orvia_worker.providers.base import RateLimited
from tests.conftest import FakeDb

FIX = Path(__file__).parent / "fixtures" / "garmin"
DETAILS = json.load(open(FIX / "activity_details.json", encoding="utf-8"))
T0 = 1_767_225_600_000
BASE_ENV = {"SUPABASE_URL": "https://x.invalid", "SUPABASE_SERVICE_ROLE_KEY": "k", "TOKEN_ENCRYPTION_KEY": "k"}


def _full_ride(n=1200, total=None):
    """Synthetische, VOLLSTAENDIGE Radantwort: 1 Zeile je Sekunde, ein 5-s-Sprint bei 600 W."""
    keys = ["directTimestamp", "sumDuration", "sumMovingDuration", "sumElapsedDuration", "sumDistance",
            "directHeartRate", "directPower", "directBikeCadence", "directSpeed"]
    rows = []
    for i in range(n):
        p = 600.0 if 300 <= i < 305 else 200.0
        rows.append({"metrics": [T0 + i * 1000, float(i), float(i), float(i), i * 8.0, 140.0, p, 90.0, 8.0]})
    return {"metricDescriptors": [{"metricsIndex": i, "key": k} for i, k in enumerate(keys)],
            "activityDetailMetrics": rows, "totalMetricsCount": total if total is not None else n}


def _thinned_ride():
    full = _full_ride()
    rows = full["activityDetailMetrics"][::3]
    return {**full, "activityDetailMetrics": rows}           # totalMetricsCount bleibt 1200: ausgeduennt


CORR = {"duration": {"manual": 4500, "source": 1199, "unit": "s", "at": "2026-10-11T08:00:00.000Z", "method": "manual"}}


def _v3_row(rid, started, *, maxchart=None, extra=None):
    m = {"detailsFetchedAt": "2026-10-09T10:00:00+00:00", "detailsVersion": 3,
         "garmin": {"v": 1, "type_key": "virtual_ride", "start_gmt": "2026-10-01T06:00:00Z", "stream_rows": 400, "stream_total": 1200},
         "ext": {"v": 1, "fields": {"avgPower": 201.7, "maxPower": 600.0, "averageHR": 140.0, "duration": 1199.0}},
         "streams": {"power": [1, 2]}}
    if maxchart is not None:
        m["detailsMaxchart"] = maxchart
    m.update(extra or {})
    return {"user_id": "u", "source": "garmin", "source_record_id": rid, "sport_id": "cycling", "started_at": started, "metrics": m}


# ---- G1 · Herkunft ------------------------------------------------------------

def test_incomplete_provenance_block_is_recognised():
    pi = detail_sync.provenance_incomplete
    assert pi({}) and pi(None) and pi({"garmin": []})
    assert pi({"garmin": {"moving_duration_s": 3301, "stream_rows": 1855}})            # vom Nachladen angelegt: unvollstaendig
    assert pi({"garmin": {"type_key": "running"}})                                       # Ortszeit/GMT fehlt
    assert pi({"garmin": {"type_key": "", "start_gmt": "2026-07-12T06:30:00Z"}})
    assert not pi({"garmin": {"type_key": "running", "start_gmt": "2026-07-12T06:30:00Z", "moving_duration_s": 1}})


def test_wide_lookback_now_picks_up_rows_with_an_incomplete_block(fake_db, test_crypto, test_settings, fake_garmin_api):
    from tests.test_v447_retention import USER, _seed, _sync
    import dataclasses
    _seed(fake_db, test_crypto)
    _sync(fake_db, test_crypto, test_settings, fake_garmin_api)
    # Zeile ausserhalb des Sync-Fensters: Details schon geladen (Block mit Dauern), Herkunft fehlt
    fake_db.tables["activities"].append({"id": 998, "user_id": USER, "source": "garmin", "source_record_id": "old-2",
                                         "sport_id": "running", "metrics": {"garmin": {"moving_duration_s": 3000.0}}})
    wide = dataclasses.replace(test_settings, activity_provenance_backfill_days=400)
    n0 = len(fake_garmin_api.calls)
    res = _sync(fake_db, test_crypto, wide, fake_garmin_api)
    lists = sum(1 for c in fake_garmin_api.calls[n0:] if c[0] == "get_activities_by_date")
    assert lists == 2                                                                   # bis v8-447.1: 1 — die Zeile galt als „hat Herkunft"
    assert "provenance_incomplete:1" in res["steps"]["backfill"]


def test_status_counts_incomplete_provenance():
    rows = [_v3_row("a", "2026-10-01T06:00:00+00:00"),
            {"source_record_id": "b", "sport_id": "running", "metrics": {"garmin": {"stream_rows": 10}}}]
    st = detail_sync.backfill_status(rows)
    assert st["provenance_incomplete"] == 1


# ---- G2 · gezielter erneuter Detailabruf ----------------------------------------

def test_refetch_is_off_by_default_and_needs_maxchart():
    s = Settings.from_env(BASE_ENV)
    assert s.detail_refetch_resolution is False and s.detail_maxchart == 0
    s2 = Settings.from_env({**BASE_ENV, "DETAIL_REFETCH_RESOLUTION": "1", "DETAIL_MAXCHART": "20000"})
    assert s2.detail_refetch_resolution is True and s2.detail_maxchart == 20000

    async def run():
        db = FakeDb()
        await db.insert("activities", [_v3_row("r1", "2026-10-01T06:00:00+00:00")])
        calls = []
        def fetch(aid):
            calls.append(aid)
            return _full_ride()
        # eingeschaltet, aber ohne maxchart → nichts (ein Neuladen mit gleicher Aufloesung waere sinnlos)
        res = await detail_sync.sync_activity_details(db, "u", fetch, limit=10, maxchart=0, refetch_resolution=True)
        assert res["selected"] == [] and calls == []
        # maxchart gesetzt, aber nicht eingeschaltet → nichts
        res = await detail_sync.sync_activity_details(db, "u", fetch, limit=10, maxchart=20000, refetch_resolution=False)
        assert res["selected"] == [] and calls == []
    asyncio.run(run())


def test_refetch_comes_after_everything_else_and_is_bounded():
    async def run():
        db = FakeDb()
        await db.insert("activities", [
            _v3_row("v3-new", "2026-10-09T06:00:00+00:00"),
            _v3_row("v3-old", "2026-09-01T06:00:00+00:00"),
            _v3_row("v3-done", "2026-10-05T06:00:00+00:00", maxchart=20000),
            {"user_id": "u", "source": "garmin", "source_record_id": "legacy", "sport_id": "running",
             "started_at": "2026-08-01T06:00:00+00:00", "metrics": {"detailsFetchedAt": "x", "detailsVersion": 2}},
            {"user_id": "u", "source": "garmin", "source_record_id": "never", "sport_id": "running",
             "started_at": "2026-07-01T06:00:00+00:00", "metrics": {}},
        ])
        res = await detail_sync.sync_activity_details(db, "u", lambda aid: _full_ride(), limit=3, maxchart=20000, refetch_resolution=True)
        assert res["selected"] == ["never", "legacy", "v3-new"]                         # nie geladen → alt → Aufloesung (neueste zuerst)
        assert res["status"]["resolution_pending"] == 1                                  # v3-old bleibt fuer den naechsten Lauf
        res2 = await detail_sync.sync_activity_details(db, "u", lambda aid: _full_ride(), limit=3, maxchart=20000, refetch_resolution=True)
        assert res2["selected"] == ["v3-old"]
        res3 = await detail_sync.sync_activity_details(db, "u", lambda aid: _full_ride(), limit=3, maxchart=20000, refetch_resolution=True)
        assert res3["selected"] == [] and res3["status"]["resolution_pending"] == 0     # danach nie wieder
        rows = {r["source_record_id"]: r["metrics"] for r in await db.select("activities", {"user_id": "u"})}
        assert all(rows[k]["detailsMaxchart"] == 20000 for k in ("never", "legacy", "v3-new", "v3-old", "v3-done"))
    asyncio.run(run())


def test_refetch_recomputes_best_efforts_from_the_full_answer_and_keeps_corrections():
    async def run():
        db = FakeDb()
        await db.insert("activities", [_v3_row("r1", "2026-10-01T06:00:00+00:00", extra={
            "corrections": json.loads(json.dumps(CORR)), "durationCorrection": {"fromMin": 20, "toMin": 75},
            "plannedSessionId": "po:x"})])
        # Ausgangslage wie in Produktion: mit Standard-Aufloesung geladen → Bestwerte nur Naeherung
        thin = await detail_sync.sync_activity_details(db, "u", lambda aid: _thinned_ride(), limit=5, maxchart=0)
        assert thin["selected"] == []                                                    # v3 ohne Nachholbedarf ohne Einschalten
        row = (await db.select("activities", {"user_id": "u"}))[0]
        await db.update("activities", {"user_id": "u", "source_record_id": "r1"},
                        {"metrics": {**row["metrics"], "detailsVersion": 2}})          # wie ein Altbestand vor v8-447
        await detail_sync.sync_activity_details(db, "u", lambda aid: _thinned_ride(), limit=5, maxchart=0)
        before = (await db.select("activities", {"user_id": "u"}))[0]["metrics"]
        w5_before = before["best_efforts"]["power"]["windows"]["5"]
        assert w5_before.get("q") in ("insufficient", "approx") and before["detailsMaxchart"] == 0
        # Gezielt neu laden mit maxchart=20000: vollstaendige Antwort
        res = await detail_sync.sync_activity_details(db, "u", lambda aid: _full_ride(), limit=5, maxchart=20000, refetch_resolution=True)
        assert res["selected"] == ["r1"] and res["updated"] == 1
        after = (await db.select("activities", {"user_id": "u"}))[0]["metrics"]
        w5 = after["best_efforts"]["power"]["windows"]["5"]
        # der 5-s-Sprint, exakt. Er beginnt bei 299 s: die Zeile von Sekunde 300 steht fuer die
        # Sekunde, die dort ENDET (best_efforts.py, Regel „Signal").
        assert w5 == {"w": 600.0, "at": 299, "q": "exact"}
        assert after["best_efforts"]["native"] is True and after["garmin"]["stream_total"] == 1200
        assert after["corrections"] == CORR and after["durationCorrection"] == {"fromMin": 20, "toMin": 75}
        assert after["plannedSessionId"] == "po:x" and after["detailsMaxchart"] == 20000
        assert len(after["streams"]["power"]) <= 300                                     # Anzeige-Reihe bleibt klein
    asyncio.run(run())


def test_refetch_stops_at_rate_limit_and_counts_nothing():
    async def run():
        db = FakeDb()
        await db.insert("activities", [_v3_row(f"r{i}", f"2026-10-0{i + 1}T06:00:00+00:00") for i in range(4)])
        calls = []
        def fetch(aid):
            calls.append(aid)
            raise RateLimited("429")
        res = await detail_sync.sync_activity_details(db, "u", fetch, limit=10, maxchart=20000, refetch_resolution=True)
        assert len(calls) == 1 and res["aborted"] == "RATE_LIMIT" and len(res["not_attempted"]) == 3
        rows = await db.select("activities", {"user_id": "u"})
        assert all("detailsFailCount" not in r["metrics"] and "detailsMaxchart" not in r["metrics"] for r in rows)
    asyncio.run(run())


def test_sync_passes_the_refetch_switch_only_together_with_maxchart(fake_db, test_crypto, test_settings, fake_garmin_api):
    from tests.test_v447_retention import _seed, _sync
    import dataclasses
    _seed(fake_db, test_crypto)
    _sync(fake_db, test_crypto, test_settings, fake_garmin_api)                         # alles auf v3, maxchart 0
    n0 = len(fake_garmin_api.calls)
    on_no_mc = dataclasses.replace(test_settings, detail_refetch_resolution=True)
    _sync(fake_db, test_crypto, on_no_mc, fake_garmin_api)
    assert not any(c[0] == "get_activity_details" for c in fake_garmin_api.calls[n0:])  # ohne maxchart kein Neuladen
    n1 = len(fake_garmin_api.calls)
    on = dataclasses.replace(test_settings, detail_refetch_resolution=True, detail_maxchart=20000)
    res = _sync(fake_db, test_crypto, on, fake_garmin_api)
    assert sum(1 for c in fake_garmin_api.calls[n1:] if c[0] == "get_activity_details") == 3
    assert "resolution_pending" not in res["steps"]["backfill"]                          # alle drei in einem Lauf erledigt
    n2 = len(fake_garmin_api.calls)
    _sync(fake_db, test_crypto, on, fake_garmin_api)
    assert not any(c[0] == "get_activity_details" for c in fake_garmin_api.calls[n2:])  # danach nie wieder


# ---- G3 · Bedeutungspruefung im Worker ---------------------------------------------

def test_semantic_verdicts_are_stored_without_raw_values():
    async def run():
        db = FakeDb()
        row = _v3_row("r1", "2026-10-01T06:00:00+00:00", extra={"detailsVersion": 2})
        await db.insert("activities", [row])
        await detail_sync.sync_activity_details(db, "u", lambda aid: _full_ride(), limit=5, maxchart=20000)
        m = (await db.select("activities", {"user_id": "u"}))[0]["metrics"]
        sem = m["ext"]["semantics"]
        assert sem["delivery"]["complete"] is True and sem["delivery"]["interval_s"] == 1.0
        assert sem["avgPower"]["verdict"] == "match" and "directPower zeitgewichtet mit Nullen" in sem["avgPower"]["matches"]
        assert sem["maxPower"]["verdict"] == "match" and sem["averageHR"]["verdict"] == "match"
        assert "sumDuration (Timer)" in sem["duration"]["matches"]
        blob = json.dumps(sem)
        assert "201.7" not in blob and "\"140.0\"" not in blob                           # keine Rohwerte
    asyncio.run(run())


def test_real_run_capture_aggregates():
    """Am echten Mitschnitt (ausgeduennt, 1855 von 5527): zeitgewichtet und je Zeile liegen hier
    nah beieinander — die Ausduennung allein erklaert eine Kadenz-Abweichung von mehr als 1 spm
    also nicht; dann bleibt die Frage der Nullen (Stillstand) oder der Definition."""
    a = SC.aggregates(DETAILS)
    assert (a["rows"], a["total"], a["complete"], a["weights"]) == (1855, 5527, False, "timer")
    dc = a["double_cadence"]
    assert abs(dc["time_all"] - dc["point_all"]) < 0.2 and abs(dc["time_nz"] - dc["point_nz"]) < 0.2
    assert 0.4 < dc["time_nz"] - dc["time_all"] < 1.0                                    # Nullen machen hier ~0,6 spm aus
    assert (a["timer_end"], a["moving_end"], a["elapsed_end"]) == (5514.0, 5509.0, 6766.0)
    assert a["elapsed_by_timestamps"] == 6766.0


def test_relations_never_raise_on_garbage():
    assert SC.relations(None, None) == {} and SC.relations({}, {}) .get("_delivery") is not None
    assert SC.aggregates(None)["rows"] == 0 and SC.compact_for_row({"x": {"verdict": "n/a"}}) is None
