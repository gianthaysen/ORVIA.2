"""GM7.4 · Vertragstests gegen die ECHTEN anonymisierten Fixtures
(activity_details / sleep_series / stress_series). Verhaltens-/Vertragstests —
kein String-Match: prüfen echte Parser-Ausgaben (Route, Streams, Hypnogramm,
Intraday-Serien) inkl. Cap, Anfang/Ende, Einheiten und Konsistenz mit den
Skalar-Dauern. RED zuerst, weil orvia_worker.series_normalize noch fehlt.
"""

import json
from pathlib import Path

from orvia_worker import series_normalize as S

FIX = Path(__file__).parent / "fixtures" / "garmin"


def _load(name):
    return json.load(open(FIX / f"{name}.json", encoding="utf-8"))


# ---- Aktivitätsdetails: Route + Streams ------------------------------------

def test_activity_details_route_capped_and_endpoints():
    raw = _load("activity_details")
    out = S.parse_activity_details(raw)
    assert out["hasRoute"] is True
    r = out["route"]
    assert 1 < len(r) <= 600
    # Anfang + Ende der Original-Polyline erhalten
    poly = raw["geoPolylineDTO"]["polyline"]
    assert r[0] == [poly[0]["lat"], poly[0]["lon"]]
    assert r[-1] == [poly[-1]["lat"], poly[-1]["lon"]]


def test_activity_details_streams_present_and_bounded():
    raw = _load("activity_details")
    out = S.parse_activity_details(raw)
    st = out["streams"]
    # Aus metricDescriptors abgeleitete Reihen: HF, Kadenz, Höhe, Tempo, Distanz.
    for key in ("heart_rate", "cadence", "elevation", "speed", "distance"):
        assert key in st and isinstance(st[key], list) and st[key], f"stream fehlt: {key}"
        assert len(st[key]) <= 300, f"{key} nicht gedeckelt"
    # Einheiten-Vertrag mitgeführt
    assert out["stream_units"]["heart_rate"] == "bpm"
    assert out["stream_units"]["speed"] == "mps"
    # Spot-Check: erster HF-Wert entspricht der ersten Sample-Zeile (idx directHeartRate)
    desc = {m["key"]: m["metricsIndex"] for m in raw["metricDescriptors"]}
    first_hr = raw["activityDetailMetrics"][0]["metrics"][desc["directHeartRate"]]
    assert st["heart_rate"][0] == first_hr


def test_activity_details_no_fabricated_splits():
    # Dieses Fixture hat KEINE Laps/Splits → Parser erfindet keine.
    raw = _load("activity_details")
    out = S.parse_activity_details(raw)
    assert out.get("splits") in (None, [])
    assert out.get("hasSplits") is False


# ---- Schlaf: Hypnogramm + Nachtserien --------------------------------------

def test_sleep_hypnogram_matches_scalar_durations():
    raw = _load("sleep_series")
    out = S.normalize_sleep_series(raw)
    series = {s["metric_type"]: s for s in out["series"]}
    hyp = series["sleep_stages"]
    assert hyp["unit"] == "sleep_stage"
    # points: [offset_s, dur_s, stage]
    from collections import defaultdict
    per = defaultdict(int)
    for off, dur, stage in hyp["points"]:
        per[stage] += dur
    dto = raw["dailySleepDTO"]
    assert per["deep"] == dto["deepSleepSeconds"]
    assert per["light"] == dto["lightSleepSeconds"]
    assert per["rem"] == dto["remSleepSeconds"]
    assert per["awake"] == dto["awakeSleepSeconds"]
    # monoton steigende Offsets
    offs = [p[0] for p in hyp["points"]]
    assert offs == sorted(offs)


def test_sleep_night_series_present():
    raw = _load("sleep_series")
    out = S.normalize_sleep_series(raw)
    series = {s["metric_type"]: s for s in out["series"]}
    for mt, unit in (("sleep_hr", "bpm"), ("sleep_stress", "stress_score"),
                     ("sleep_body_battery", "bb_level"), ("sleep_respiration", "brpm"),
                     ("sleep_hrv", "ms")):
        assert mt in series, f"Nacht-Serie fehlt: {mt}"
        assert series[mt]["unit"] == unit
        pts = series[mt]["points"]
        assert pts and all(len(p) == 2 for p in pts)         # [offset_s, value]
        assert pts[0][0] == 0                                 # self-relativ ab 0
        assert [p[0] for p in pts] == sorted(p[0] for p in pts)


# ---- Stress + Body Battery intraday ----------------------------------------

def test_stress_intraday_drops_no_data_and_offsets_seconds():
    raw = _load("stress_series")
    out = S.normalize_stress_series(raw)
    series = {s["metric_type"]: s for s in out["series"]}
    si = series["stress_intraday"]
    assert si["unit"] == "stress_score"
    # keine -1/-2 (keine Daten) im Ergebnis
    assert all(0 <= v <= 100 for _, v in si["points"])
    # Offsets in Sekunden (Array war [offset_ms, level]) — erstes = 0
    assert si["points"][0][0] == 0
    raw_arr = [row for row in raw["stressValuesArray"] if row[1] >= 0]
    assert si["points"][1][0] == raw_arr[1][0] // 1000
    # Body Battery intraday getrennt vorhanden
    bb = series["body_battery_intraday"]
    assert bb["unit"] == "bb_level" and bb["points"] and len(bb["points"][0]) == 2


# ---- Persistenz: Serien → user_metric_series-Upsert-Zeilen (Vertrag 0028) ----

def test_build_series_rows_matches_migration_contract():
    raw = _load("stress_series")
    norm = S.normalize_stress_series(raw)
    rows = S.build_series_rows("11111111-1111-1111-1111-111111111111", None,
                               "2026-07-16", "Europe/Berlin", norm)
    assert rows and all(r["metric_date"] == "2026-07-16" for r in rows)
    r = next(x for x in rows if x["metric_type"] == "stress_intraday")
    # Spalten exakt wie Migration 0028 / ON_CONFLICT(user_id,metric_type,metric_date)
    assert r["point_count"] == len(r["points"])
    assert r["source_record_id"] == "garmin_unofficial:series:2026-07-16:stress_intraday"
    assert r["timezone"] == "Europe/Berlin"
    assert r["source_type"] == "device_measurement"
    assert r["point_count"] <= 2000                      # DB-Guard
    # Determinismus/Idempotenz: gleicher Input ⇒ gleiche source_record_id
    rows2 = S.build_series_rows("11111111-1111-1111-1111-111111111111", None,
                                "2026-07-16", "Europe/Berlin", norm)
    assert {x["source_record_id"] for x in rows} == {x["source_record_id"] for x in rows2}
