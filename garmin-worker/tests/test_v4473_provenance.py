"""v8-447.3 · Garmin-Herkunft: Ursache, Status, Metadaten-Backfill.

R   Ursache nachgestellt: Zeile aus v8-446 (kein Herkunftsblock) → Nachladen der Details legt
    metrics.garmin OHNE Typ und Zeit an → der Sync sieht im Dauerbetrieb nur [vorgestern, heute]
    → die Zeile wird nie ergaenzt. Genau der Produktionsbefund (40/41 „ohne_typ_und_zeit").
P   Status complete / partial / unavailable / inconsistent; Zusammenfuehren nur ergaenzend.
B   Backfill: nur Liste, idempotent, fortsetzbar, Probelauf, Abbruch bei 401/429, Korrekturen
    und Planverknuepfung bleiben, keine Doppelungen, keine Umklassifizierung.
"""

import asyncio
import copy
import dataclasses
import json
from datetime import date
from pathlib import Path

import pytest

from orvia_worker import detail_sync, normalize, provenance as PV
from orvia_worker.config import Settings
from orvia_worker.providers.base import AuthError, ProviderUnavailable, RateLimited
from orvia_worker.providers.garmin_unofficial import GarminUnofficialProvider
from orvia_worker.sync import sync_user
from tests.conftest import FakeDb, FakeGarminApi

FIX = Path(__file__).parent / "fixtures" / "garmin"
LIST = json.load(open(FIX / "activities.json", encoding="utf-8"))
DETAILS = json.load(open(FIX / "activity_details.json", encoding="utf-8"))
USER = "user-473"
BASE_ENV = {"SUPABASE_URL": "https://x.invalid", "SUPABASE_SERVICE_ROLE_KEY": "k", "TOKEN_ENCRYPTION_KEY": "k"}
NOW = "2026-10-15T09:00:00+00:00"
# Gians Kraft-Korrektur (341 → 75 min) und eine Planverknuepfung — muessen jeden Schritt ueberleben
CORR = {"duration": {"manual": 4500, "source": 20460, "unit": "s", "at": "2026-10-11T08:00:00.000Z", "method": "manual"}}


def _entry(aid, type_key, local, gmt, parent=None, **extra):
    at = {"typeId": 1, "typeKey": type_key}
    if parent is not None:
        at["parentTypeId"] = parent
    e = {"activityId": aid, "activityName": "x", "activityType": at, "duration": 3600.0, "distance": 10000.0,
         "averageHR": 140.0, "maxHR": 170.0, "calories": 600}
    if local is not None:
        e["startTimeLocal"] = local
    if gmt is not None:
        e["startTimeGMT"] = gmt
    e.update(extra)
    return e


def _legacy_row(rid, sport, started, metrics=None):
    """So steht eine vor v8-447 importierte Zeile in Produktion — nach dem Nachladen der Details."""
    m = {"detailsFetchedAt": "2026-10-12T10:00:00+00:00", "detailsVersion": 3, "detailsMaxchart": 20000,
         "garmin": {"moving_duration_s": 3500.0, "elapsed_duration_s": 3700.0, "timer_duration_s": 3600.0,
                    "stream_rows": 3600, "stream_kept": 600, "stream_total": 3600},
         "ext": {"v": 1, "series": {"directVerticalRatio": [1.0]}},
         "streams": {"time": [0, 1], "heart_rate": [130, 131]},
         "best_efforts": {"native": True, "stats": {"heart_rate": {"avg": 140}}}}
    m.update(metrics or {})
    return {"user_id": USER, "source": "garmin", "source_record_id": rid, "sport_id": sport,
            "started_at": started, "duration_seconds": 3600, "metrics": m}


def _lister(entries, calls=None, fail=None):
    """Datumsbewusste Liste wie Garmin: filtert nach ORTS-Datum des Starts."""
    def fn(start, end):
        if calls is not None:
            calls.append((start, end))
        if fail is not None:
            raise fail
        out = []
        for e in entries:
            d = (e.get("startTimeLocal") or e.get("startTimeGMT") or "")[:10]
            if start <= d <= end:
                a = normalize.normalize_activity(copy.deepcopy(e))
                if a:
                    out.append(a)
        return out
    return fn


def _db(*rows):
    db = FakeDb()
    asyncio.run(db.insert("activities", [copy.deepcopy(r) for r in rows]))
    return db


def _row(db, rid):
    return next(r for r in db.tables["activities"] if r["source_record_id"] == rid)


# ---- R · Ursache -------------------------------------------------------------------

class _DatedApi(FakeGarminApi):
    def get_activities_by_date(self, start, end=None, *a, **k):
        self.calls.append(("get_activities_by_date", start, end))
        return [copy.deepcopy(e) for e in LIST if start <= e["startTimeLocal"][:10] <= (end or start)]


def _seed(db, crypto, last_ok):
    db.tables["data_providers"] = [{"id": "prov-1", "user_id": USER, "provider_type": "garmin_unofficial",
                                    "connection_status": "connected", "last_successful_sync_at": last_ok}]
    ct, ver = crypto.encrypt_str('{"di_token":"x"}')
    db.tables["provider_credentials"] = [{"id": "cred-1", "user_id": USER, "provider_type": "garmin_unofficial",
                                          "credential_kind": "session_tokens", "encrypted_payload": ct, "key_version": ver}]


def _run(db, crypto, settings, api, today):
    provider = GarminUnofficialProvider(api=api)
    return asyncio.run(sync_user(USER, db=db, crypto=crypto, settings=settings, today=today,
                                 provider_factory=lambda token_str: provider))


def test_root_cause_detail_backfill_creates_block_without_type_and_time_and_window_never_reaches_it(fake_db, test_crypto, test_settings):
    """Nachbau des Produktionsbefunds mit dem echten Sync-Code."""
    _seed(fake_db, test_crypto, last_ok="2026-10-14T20:00:00+00:00")
    # drei Zeilen, importiert vor v8-447: kein metrics.garmin (damals nur source_sport_raw fuer 'other')
    for e in LIST:
        fake_db.tables.setdefault("activities", []).append({
            "id": f"a{e['activityId']}", "user_id": USER, "source": "garmin", "source_record_id": str(e["activityId"]),
            "sport_id": normalize.map_sport(e["activityType"]["typeKey"]), "started_at": e["startTimeGMT"],
            "metrics": {"source_sport_raw": "ice_hockey"} if e["activityType"]["typeKey"] == "ice_hockey" else {}})
    api = _DatedApi()
    res = _run(fake_db, test_crypto, test_settings, api, today=date(2026, 10, 15))
    lists = [c for c in api.calls if c[0] == "get_activities_by_date"]
    assert lists == [("get_activities_by_date", "2026-10-13", "2026-10-15")]        # Dauerbetrieb: nur die letzten Tage
    rows = fake_db.tables["activities"]
    for r in rows:
        assert r["metrics"]["detailsVersion"] == 3                                   # Details nachgeladen …
        assert PV.gap_kind(r["metrics"]) == "ohne_typ_und_utc"                       # … Block ohne Typ und Zeit
        assert PV.status(r["metrics"])["status"] == "partial"
        assert r["metrics"]["garmin"].get("stream_rows")                             # vom Nachladen angelegt
    assert "provenance_incomplete:3" in res["steps"]["backfill"]
    # weitere Laeufe aendern daran nichts — die Liste sieht die alten Tage nie
    _run(fake_db, test_crypto, test_settings, api, today=date(2026, 10, 16))
    assert all(PV.gap_kind(r["metrics"]) == "ohne_typ_und_utc" for r in fake_db.tables["activities"])
    # Behebung: Metadaten-Backfill liest die Liste fuer genau die betroffenen Tage
    s = dataclasses.replace(test_settings, provenance_backfill="apply")
    n0 = len(api.calls)
    res = _run(fake_db, test_crypto, s, api, today=date(2026, 10, 16))
    assert "provenance_backfill" in res["steps"] and "added_type:3" in res["steps"]["provenance_backfill"]
    assert not any(c[0] == "get_activity_details" for c in api.calls[n0:])          # keine Detailabrufe
    for r in fake_db.tables["activities"]:
        assert PV.status(r["metrics"])["status"] == "complete", r["metrics"]["garmin"]
        assert r["metrics"]["garmin"]["stream_rows"]                                  # Detail-Teil unberuehrt
    assert len(fake_db.tables["activities"]) == 3                                    # keine Doppelungen


def test_detail_response_carries_neither_type_nor_start_time():
    """Beleg aus dem echten, anonymisierten Mitschnitt: Typ und Startzeit gibt es nur in der Liste."""
    assert set(DETAILS) == {"activityId", "measurementCount", "metricsCount", "totalMetricsCount", "metricDescriptors",
                            "activityDetailMetrics", "geoPolylineDTO", "heartRateDTOs", "pendingData", "detailsAvailable"}
    flat = json.dumps(DETAILS["metricDescriptors"])
    assert "typeKey" not in flat and "startTime" not in flat


# ---- P · Status und Zusammenfuehren ---------------------------------------------

def _lm(e):
    return normalize.normalize_activity(copy.deepcopy(e)).metrics


def test_complete_provenance_from_list():
    e = _entry(1, "virtual_ride", "2026-07-16 18:03:00", "2026-07-16 16:03:00", parent=2)
    new, rep = PV.merge(_legacy_row("1", "cycling", "2026-07-16 16:03:00")["metrics"], _lm(e),
                        started_at="2026-07-16 16:03:00", now=NOW)
    g = new["garmin"]
    assert g["type_key"] == "virtual_ride" and g["parent_type_id"] == 2               # Typ erhalten, nicht „cycling"
    assert g["start_gmt"] == "2026-07-16T16:03:00Z" and g["start_local"] == "2026-07-16T18:03:00"
    assert g["utc_offset_s"] == 7200 and g["prov_status"] == "complete" and rep["status"] == "complete"
    assert "fields" in new["ext"] and new["ext"]["series"] == {"directVerticalRatio": [1.0]}   # Rohfelder ergaenzt, Reihen bleiben
    assert g["prov_backfill"]["garmin"] == ["parent_type_id", "start_gmt", "start_local", "type_key", "utc_offset_s", "v"]
    assert g["prov_backfill"]["ext"] == ["fields"] or "fields" in g["prov_backfill"]["ext"]


def test_generic_type_gets_no_invented_subtype():
    e = _entry(1, "running", "2026-07-16 18:03:00", "2026-07-16 16:03:00")
    new, _ = PV.merge({}, _lm(e), now=NOW)
    g = new["garmin"]
    assert g["type_key"] == "running" and "parent_type_id" not in g                  # nichts erfunden
    assert not any("subtype" in k for k in g)


def test_missing_local_start_is_unavailable_not_guessed():
    e = _entry(1, "lap_swimming", None, "2026-07-16 16:03:00")
    new, rep = PV.merge({"garmin": {"stream_rows": 10}}, _lm(e), started_at="2026-07-16 16:03:00", now=NOW)
    g = new["garmin"]
    assert "start_local" not in g and "utc_offset_s" not in g                         # nicht aus UTC + Zone geraten
    assert g["prov_unavailable"] == ["start_local", "utc_offset_s"]
    assert rep["status"] == "unavailable" and PV.status(new)["status"] == "unavailable"
    assert not PV.needs_backfill(new)                                                 # Endzustand: kein weiterer Abruf


def test_partial_when_block_has_only_details_keys():
    m = _legacy_row("1", "running", "2026-07-16 16:03:00")["metrics"]
    st = PV.status(m)
    assert st["status"] == "partial" and st["missing"] == list(PV.REQUIRED) and st["has_block"]
    assert PV.status({})["status"] == "partial" and not PV.status({})["has_block"]
    assert PV.gap_kind({"garmin": {"type_key": "running"}}) == "ohne_utc"
    assert PV.gap_kind({"garmin": {"start_gmt": "x"}}) == "ohne_typ"
    assert PV.gap_kind({"garmin": {"type_key": "running", "start_gmt": "x"}}) == "ohne_ortszeit"


def test_existing_correct_utc_is_kept_and_conflicts_are_flagged_not_overwritten():
    cur = {"garmin": {"start_gmt": "2026-07-16T16:03:00Z", "type_key": "treadmill_running"}}
    e = _entry(1, "running", "2026-07-16 18:03:00", "2026-07-16 16:03:00")
    new, rep = PV.merge(cur, _lm(e), started_at="2026-07-16 16:03:00", now=NOW)
    assert new["garmin"]["start_gmt"] == "2026-07-16T16:03:00Z"                       # unveraendert
    assert new["garmin"]["type_key"] == "treadmill_running"                           # nie ersetzt …
    assert rep["conflicts"] == ["type_key"] and new["garmin"]["prov_status"] == "inconsistent"   # … aber vermerkt
    assert not PV.needs_backfill(new)


def test_started_at_mismatch_is_inconsistent_and_started_at_is_not_touched():
    row = _legacy_row("1", "running", "2026-07-16 14:03:00")                          # 2 h daneben
    e = _entry(1, "running", "2026-07-16 18:03:00", "2026-07-16 16:03:00")
    new, rep = PV.merge(row["metrics"], _lm(e), started_at=row["started_at"], now=NOW)
    assert "started_at" in rep["conflicts"] and rep["status"] == "inconsistent"
    assert row["started_at"] == "2026-07-16 14:03:00"                                  # Eingabe unveraendert (rein)


def test_offsets_follow_daylight_saving_without_manual_hours():
    summer = _lm(_entry(1, "running", "2026-10-24 08:00:00", "2026-10-24 06:00:00"))
    winter = _lm(_entry(2, "running", "2026-10-26 08:00:00", "2026-10-26 07:00:00"))
    assert summer["garmin"]["utc_offset_s"] == 7200 and winter["garmin"]["utc_offset_s"] == 3600
    odd = _lm(_entry(3, "running", "2026-10-26 08:07:00", "2026-10-26 07:00:00"))        # kein plausibler Versatz
    new, rep = PV.merge({}, odd, now=NOW)
    assert "utc_offset_s" not in new["garmin"] and "utc_offset_s" in rep["conflicts"]


def test_merge_never_touches_user_owned_or_measured_keys():
    m = _legacy_row("1", "gym", "2026-07-15 05:10:00", {"corrections": CORR, "plannedSessionId": "ps-1",
                                                         "planLinkCorrection": {"x": 1}, "durationCorrection": {"y": 2},
                                                         "feedback": {"rpe": 7}, "summary_local": {"k": 1}})["metrics"]
    before = copy.deepcopy(m)
    e = _entry(1, "strength_training", "2026-07-15 07:10:00", "2026-07-15 05:10:00")
    new, _ = PV.merge(m, _lm(e), started_at="2026-07-15 05:10:00", now=NOW)
    assert m == before                                                                  # Eingabe unveraendert
    for k in before:
        if k not in ("garmin", "ext"):
            assert new[k] == before[k], k
    assert new["corrections"]["duration"]["manual"] == 4500


# ---- B · Backfill ----------------------------------------------------------------

def _rows():
    return [_legacy_row("10", "running", "2026-07-16 16:03:00", {"corrections": {"distance": {"manual": 10500, "at": "2026-07-17T00:00:00Z"}}}),
            _legacy_row("11", "gym", "2026-07-15 05:10:00", {"corrections": CORR, "plannedSessionId": "ps-11"}),
            _legacy_row("12", "cycling", "2026-08-30 17:00:00"),
            _legacy_row("13", "swimming", "2026-09-02 05:00:00")]


ENTRIES = [_entry(10, "running", "2026-07-16 18:03:00", "2026-07-16 16:03:00", parent=17),
           _entry(11, "strength_training", "2026-07-15 07:10:00", "2026-07-15 05:10:00", parent=29),
           _entry(12, "virtual_ride", "2026-08-30 19:00:00", "2026-08-30 17:00:00", parent=2),
           _entry(13, "lap_swimming", "2026-09-02 07:00:00", "2026-09-02 05:00:00", parent=26)]


def test_dry_run_counts_and_writes_nothing():
    db = _db(*_rows())
    before = copy.deepcopy(db.tables["activities"])
    calls = []
    res = asyncio.run(PV.backfill(db, USER, _lister(ENTRIES, calls), mode="dry", now=NOW))
    assert db.tables["activities"] == before
    assert res["candidates"] == 4 and res["changed"] == 4 and res["added_type"] == 4 and res["complete_after"] == 4
    assert res["list_calls"] == len(calls) == 2                                       # Juli · Ende Aug./Anfang Sep.
    assert PV.summary_line(res).startswith("dry candidates:4")


def test_windows_group_nearby_days_and_cover_timezones():
    w = PV.windows([date(2026, 7, 15), date(2026, 7, 16), date(2026, 8, 30), date(2026, 9, 2)])
    assert w == [(date(2026, 8, 29), date(2026, 9, 3)), (date(2026, 7, 14), date(2026, 7, 17))]


def test_apply_fills_only_missing_and_keeps_corrections_and_plan_links():
    db = _db(*_rows())
    res = asyncio.run(PV.backfill(db, USER, _lister(ENTRIES), mode="apply", now=NOW))
    assert res["changed"] == 4 and res["errors"] == 0
    gym = _row(db, "11")
    assert gym["metrics"]["corrections"] == CORR and gym["metrics"]["plannedSessionId"] == "ps-11"
    assert gym["sport_id"] == "gym" and gym["started_at"] == "2026-07-15 05:10:00" and gym["duration_seconds"] == 3600
    assert _row(db, "10")["metrics"]["corrections"]["distance"]["manual"] == 10500
    ride = _row(db, "12")
    assert ride["metrics"]["garmin"]["type_key"] == "virtual_ride" and ride["sport_id"] == "cycling"
    assert _row(db, "13")["metrics"]["garmin"]["type_key"] == "lap_swimming"
    for r in db.tables["activities"]:
        assert r["metrics"]["streams"] == {"time": [0, 1], "heart_rate": [130, 131]}  # Messreihen unberuehrt
        assert r["metrics"]["best_efforts"]["native"] is True
        assert PV.status(r["metrics"])["status"] == "complete"
    assert len(db.tables["activities"]) == 4


def test_second_run_is_a_no_op_without_garmin_calls():
    db = _db(*_rows())
    asyncio.run(PV.backfill(db, USER, _lister(ENTRIES), mode="apply", now=NOW))
    snap = copy.deepcopy(db.tables["activities"])
    calls = []
    res = asyncio.run(PV.backfill(db, USER, _lister(ENTRIES, calls), mode="apply", now="2026-10-16T09:00:00+00:00"))
    assert calls == [] and res["candidates"] == 0 and db.tables["activities"] == snap


def test_no_reclassification_even_when_garmin_type_points_elsewhere():
    rows = [_legacy_row("20", "gym", "2026-07-16 16:03:00"), _legacy_row("21", "other", "2026-07-16 18:00:00")]
    ent = [_entry(20, "running", "2026-07-16 18:03:00", "2026-07-16 16:03:00"),
           _entry(21, "yoga", "2026-07-16 20:00:00", "2026-07-16 18:00:00")]
    db = _db(*rows)
    asyncio.run(PV.backfill(db, USER, _lister(ent), mode="apply", now=NOW))
    assert _row(db, "20")["sport_id"] == "gym" and _row(db, "20")["metrics"]["garmin"]["type_key"] == "running"
    assert _row(db, "21")["sport_id"] == "other"                                       # Backfill hebt keine Sportart


def test_not_listed_activity_becomes_unavailable_and_is_not_asked_again():
    db = _db(_legacy_row("30", "running", "2026-07-16 16:03:00"))
    res = asyncio.run(PV.backfill(db, USER, _lister([]), mode="apply", now=NOW))
    g = _row(db, "30")["metrics"]["garmin"]
    assert res["not_listed"] == 1 and g["prov_not_listed"] is True and g["prov_status"] == "unavailable"
    assert sorted(g["prov_unavailable"]) == sorted(PV.REQUIRED) and "type_key" not in g
    calls = []
    asyncio.run(PV.backfill(db, USER, _lister([], calls), mode="apply", now=NOW))
    assert calls == []


@pytest.mark.parametrize("exc,cat", [(RateLimited("429"), "RATE_LIMIT"), (AuthError("401"), "AUTH")])
def test_rate_limit_and_auth_abort_without_writing(exc, cat):
    db = _db(*_rows())
    snap = copy.deepcopy(db.tables["activities"])
    calls = []
    res = asyncio.run(PV.backfill(db, USER, _lister(ENTRIES, calls, fail=exc), mode="apply", now=NOW))
    assert res["aborted"] == cat and len(calls) == 1 and db.tables["activities"] == snap
    assert res["remaining"] == 4


def test_network_error_skips_window_and_continues():
    db = _db(*_rows())
    n = {"i": 0}
    ok = _lister(ENTRIES)
    def flaky(a, b):
        n["i"] += 1
        if n["i"] == 1:
            raise ProviderUnavailable("503")
        return ok(a, b)
    res = asyncio.run(PV.backfill(db, USER, flaky, mode="apply", now=NOW))
    assert res["aborted"] is None and res["errors"] == 1 and res["changed"] == 2 and res["remaining"] == 2


def test_bounded_windows_per_run_resume_next_run():
    db = _db(*_rows())
    calls = []
    r1 = asyncio.run(PV.backfill(db, USER, _lister(ENTRIES, calls), mode="apply", max_windows=1, now=NOW))
    assert len(calls) == 1 and r1["changed"] == 2 and r1["remaining"] == 2
    r2 = asyncio.run(PV.backfill(db, USER, _lister(ENTRIES, calls), mode="apply", max_windows=1, now=NOW))
    assert len(calls) == 2 and r2["candidates"] == 2 and r2["changed"] == 2
    assert all(PV.status(r["metrics"])["status"] == "complete" for r in db.tables["activities"])


def test_client_edit_between_select_and_write_survives():
    """Der Backfill liest jede Zeile direkt vor dem Schreiben frisch."""
    db = _db(_legacy_row("11", "gym", "2026-07-15 05:10:00"))
    lister = _lister(ENTRIES)
    def list_then_client_edits(a, b):
        out = lister(a, b)
        r = _row(db, "11")
        r["metrics"]["corrections"] = CORR                                            # App schreibt waehrenddessen
        return out
    asyncio.run(PV.backfill(db, USER, list_then_client_edits, mode="apply", now=NOW))
    m = _row(db, "11")["metrics"]
    assert m["corrections"] == CORR and m["garmin"]["type_key"] == "strength_training"


def test_detail_reload_after_backfill_keeps_provenance_even_from_an_old_snapshot():
    """Server-Merge: das Nachladen der Details ersetzt metrics als Ganzes — Herkunft, die waehrend
    des Abrufs in die Zeile kam, muss bleiben (carry_forward)."""
    db = _db(_legacy_row("10", "running", "2026-07-16 16:03:00",
                         {"detailsVersion": 2, "corrections": CORR, "plannedSessionId": "ps-10"}))
    lister = _lister(ENTRIES)
    def details_while_backfill_runs(aid):
        # der Backfill schreibt, waehrend der Detailabruf laeuft (Thread des Abrufs)
        r = _row(db, "10")
        new, _ = PV.merge(r["metrics"], lister("2026-07-15", "2026-07-17")[0].metrics, started_at=r["started_at"], now=NOW)
        r["metrics"] = new
        return copy.deepcopy(DETAILS)
    res = asyncio.run(detail_sync.sync_activity_details(db, USER, details_while_backfill_runs, limit=5))
    assert res["updated"] == 1
    m = _row(db, "10")["metrics"]
    assert m["detailsVersion"] == 3
    assert m["garmin"]["type_key"] == "running" and m["garmin"]["start_local"] == "2026-07-16T18:03:00"
    assert m["garmin"]["stream_total"] == 5527                                          # Detail-Teil neu
    assert "fields" in m["ext"] and m["corrections"] == CORR and m["plannedSessionId"] == "ps-10"


# ---- Bedeutungspruefung nach dem Backfill ------------------------------------------

def test_semantics_refetch_only_when_switched_on_and_only_once():
    m = _legacy_row("10", "running", "2026-07-16 16:03:00")["metrics"]
    act = {"metrics": m}
    assert not detail_sync._needs_details(act, 0, True)                                # keine Rohfelder → nichts zu pruefen
    new, _ = PV.merge(m, _lm(ENTRIES[0]), now=NOW)
    act = {"metrics": new}
    assert not detail_sync._needs_details(act, 0, False)                               # Standard: aus
    assert detail_sync._needs_details(act, 0, True)
    db = _db({**_legacy_row("10", "running", "2026-07-16 16:03:00"), "metrics": new})
    calls = []
    def fetch(aid):
        calls.append(aid)
        return copy.deepcopy(DETAILS)
    r1 = asyncio.run(detail_sync.sync_activity_details(db, USER, fetch, limit=5, refetch_semantics=True))
    assert r1["updated"] == 1 and _row(db, "10")["metrics"]["detailsSemantics"] >= 1
    assert PV.status(_row(db, "10")["metrics"])["status"] == "complete"
    r2 = asyncio.run(detail_sync.sync_activity_details(db, USER, fetch, limit=5, refetch_semantics=True))
    assert r2["selected"] == [] and calls == ["10"]


# ---- Einstellungen und Sync -------------------------------------------------------

def test_settings_default_off_and_modes():
    assert Settings.from_env(BASE_ENV).provenance_backfill == "off"
    assert Settings.from_env({**BASE_ENV, "PROVENANCE_BACKFILL": "dry"}).provenance_backfill == "dry"
    assert Settings.from_env({**BASE_ENV, "PROVENANCE_BACKFILL": "1"}).provenance_backfill == "apply"
    assert Settings.from_env({**BASE_ENV, "PROVENANCE_BACKFILL": "vielleicht"}).provenance_backfill == "off"
    assert Settings.from_env(BASE_ENV).detail_refetch_semantics is False


def test_sync_skips_details_and_series_when_backfill_hits_rate_limit(fake_db, test_crypto, test_settings):
    _seed(fake_db, test_crypto, last_ok="2026-10-14T20:00:00+00:00")
    fake_db.tables["activities"] = [dict(_legacy_row("19788811001", "running", "2026-07-16 16:03:00", {"detailsVersion": 2}), id="a1")]

    class _Api(_DatedApi):
        def get_activities_by_date(self, start, end=None, *a, **k):
            if start < "2026-10-01":
                self.calls.append(("get_activities_by_date", start, end))
                from garminconnect import GarminConnectTooManyRequestsError
                raise GarminConnectTooManyRequestsError("429")
            return super().get_activities_by_date(start, end)
    api = _Api()
    s = dataclasses.replace(test_settings, provenance_backfill="apply")
    res = _run(fake_db, test_crypto, s, api, today=date(2026, 10, 15))
    assert "aborted:RATE_LIMIT" in res["steps"]["provenance_backfill"]
    assert res["steps"]["activity_details"] == "skipped:rate_limit"
    assert not any(c[0] == "get_activity_details" for c in api.calls)
    assert res["ok"] is False
    assert PV.status(fake_db.tables["activities"][0]["metrics"])["status"] == "partial"


def test_backfill_status_counts_provenance_states():
    rows = _rows()
    rows[0]["metrics"]["garmin"].update({"type_key": "running", "start_gmt": "a", "start_local": "b", "utc_offset_s": 0})
    rows[1]["metrics"]["garmin"].update({"prov_conflicts": ["type_key"]})
    rows[2]["metrics"]["garmin"].update({"type_key": "x", "start_gmt": "a", "prov_unavailable": ["start_local", "utc_offset_s"]})
    st = detail_sync.backfill_status(rows)
    assert st["provenance"] == {"complete": 1, "partial": 1, "unavailable": 1, "inconsistent": 1}
    assert st["provenance_incomplete"] == 1


def test_logs_carry_no_ids_or_values(caplog):
    import logging
    caplog.set_level(logging.INFO, logger="orvia.provenance")
    db = _db(*_rows())
    asyncio.run(PV.backfill(db, USER, _lister(ENTRIES), mode="apply", now=NOW))
    text = "\n".join(r.getMessage() for r in caplog.records)
    for secret in (USER, "virtual_ride", "2026-07-16", "ps-11", "19788811"):
        assert secret not in text
