"""S2c · Kopplung Geräteaufzeichnung ↔ ORVIA-Workout (Worker-Regel + DB-Schritt)."""
import asyncio

from orvia_worker.activity_link import autolink_recording, find_link_candidate

U = "u-1"


def _w(id_, start, mins, **kw):
    row = {"id": id_, "user_id": U, "source": "orvia_workout", "sport_id": "gym",
           "started_at": start, "ended_at": None, "duration_seconds": mins * 60, "linked_activity_id": None}
    row.update(kw)
    return row


def _g(id_, start, mins, **kw):
    row = {"id": id_, "user_id": U, "source": "garmin", "sport_id": "gym",
           "started_at": start, "ended_at": None, "duration_seconds": mins * 60}
    row.update(kw)
    return row


def test_pair_within_tolerance():
    g = _g("g1", "2026-06-23 14:02:00", 104)
    ws = [_w("w1", "2026-06-23T14:03:00+00:00", 103)]
    assert find_link_candidate(g, ws) == "w1"


def test_delta_over_tolerance_no_pair():
    g = _g("g2", "2026-06-24 10:25:00", 55)
    ws = [_w("w2", "2026-06-24 10:00:00", 60)]
    assert find_link_candidate(g, ws) is None
    assert find_link_candidate(g, ws, tolerance_min=30) == "w2"


def test_no_overlap_no_pair():
    # Δ 15 min, aber Workout endet vor Start der Aufzeichnung → kein Paar
    g = _g("g3", "2026-06-24 10:15:00", 40)
    ws = [_w("w3", "2026-06-24 10:00:00", 10)]
    assert find_link_candidate(g, ws) is None


def test_nearest_candidate_wins():
    g = _g("g4", "2026-06-25 17:58:00", 63)
    ws = [_w("wa", "2026-06-25 18:10:00", 50), _w("wb", "2026-06-25 18:00:00", 60)]
    assert find_link_candidate(g, ws) == "wb"


def test_sport_mismatch_and_other_user_and_linked_primary_ignored():
    g = _g("g5", "2026-06-26 12:03:00", 37)
    ws = [
        _w("w-run", "2026-06-26 12:00:00", 60, sport_id="running"),
        _w("w-other", "2026-06-26 12:00:00", 60, user_id="u-2"),
        _w("w-linked", "2026-06-26 12:00:00", 60, linked_activity_id="x"),
    ]
    assert find_link_candidate(g, ws) is None
    assert find_link_candidate(dict(g, sport_id="running"), ws) is None  # nur gym koppelbar


def test_autolink_updates_row_and_skips_taken_primary(fake_db):
    fake_db.tables["activities"] = [
        _w("w1", "2026-06-23 14:03:00", 103),
        _w("w2", "2026-06-25 11:15:00", 73),
        _g("g-old", "2026-06-25 11:16:00", 72, linked_activity_id="w2", link_kind="device_recording"),
    ]
    g1 = _g("g1", "2026-06-23 14:02:00", 104)
    g2 = _g("g2", "2026-06-25 11:17:00", 70)   # w2 bereits durch g-old belegt
    fake_db.tables["activities"] += [g1, g2]

    assert asyncio.run(autolink_recording(fake_db, U, g1)) == "w1"
    assert asyncio.run(autolink_recording(fake_db, U, g2)) is None
    rows = {r["id"]: r for r in fake_db.tables["activities"]}
    assert rows["g1"]["linked_activity_id"] == "w1" and rows["g1"]["link_kind"] == "device_recording"
    assert rows["g2"].get("linked_activity_id") is None


def test_autolink_never_raises(monkeypatch, fake_db):
    async def boom(*a, **k):
        raise RuntimeError("db down")
    monkeypatch.setattr(fake_db, "select", boom)
    g = _g("g9", "2026-06-23 14:02:00", 10)
    assert asyncio.run(autolink_recording(fake_db, U, g)) is None
