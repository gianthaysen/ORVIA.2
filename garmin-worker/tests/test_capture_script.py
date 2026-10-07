"""v8-447 · Commit D — das Mitschnitt-Skript (scripts/capture_activity_payloads.py).

Geprueft wird OHNE Netz und ohne Garmin: die Anonymisierung, die Selbstpruefung vor dem
Schreiben, die Auswahl je Sportart und der Bericht. Die Rohdaten hier sind SYNTHETISCH und
enthalten absichtlich alles, was nie in eine Datei gelangen darf.

Liegen echte Mitschnitte unter tests/fixtures/garmin/captures/, prueft der letzte Abschnitt
jede Datei: sauber, lesbar fuer den Parser, und der Worker verliert kein benanntes Messfeld.
"""

import importlib.util
import json
from pathlib import Path

import pytest

from orvia_worker import garmin_fields as GF, normalize, series_normalize as S

ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / "tests" / "fixtures" / "garmin" / "captures"

_spec = importlib.util.spec_from_file_location("capture_activity_payloads", ROOT / "scripts" / "capture_activity_payloads.py")
CAP = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(CAP)

EMAIL = "gian.beispiel@example.org"


def _raw_payload():
    entry = {
        "activityId": 21234567890, "activityName": "Feierabendrunde Hamburg", "ownerId": 87654321,
        "ownerDisplayName": "gian.beispiel", "ownerFullName": "Gian Beispiel", "deviceId": 3344556677,
        "ownerProfileImageUrlSmall": "https://example.org/a.png", "locationName": "Hamburg",
        "activityType": {"typeId": 2, "typeKey": "road_biking", "parentTypeId": 2, "isHidden": False},
        "startTimeLocal": "2026-07-12 18:30:00", "startTimeGMT": "2026-07-12 16:30:00",
        "startLatitude": 53.5511, "startLongitude": 9.9937, "endLatitude": 53.56, "endLongitude": 10.01,
        "duration": 3600.5, "movingDuration": 3500.0, "distance": 30123.4, "avgPower": 212.0, "normPower": 228.0,
        "averageBikingCadenceInRevPerMinute": 92.0, "hasPolyline": True, "timeZoneId": 124,
        "description": f"Schreib mir: {EMAIL}",
    }
    details = {
        "activityId": 21234567890,
        "metricDescriptors": [
            {"metricsIndex": 0, "key": "directTimestamp", "unit": {"id": 120, "key": "gmt", "factor": 0.0}},
            {"metricsIndex": 1, "key": "directLatitude", "unit": {"key": "dd"}},
            {"metricsIndex": 2, "key": "directLongitude", "unit": {"key": "dd"}},
            {"metricsIndex": 3, "key": "directPower", "unit": {"key": "watt"}},
            {"metricsIndex": 4, "key": "directBikeCadence", "unit": {"key": "revolutionsPerMinute"}},
            {"metricsIndex": 5, "key": "directLeftBalance", "unit": {"key": "percent"}},
        ],
        "activityDetailMetrics": [{"metrics": [1_783_874_400_000 + i * 1000, 53.55 + i * 1e-4, 9.99 + i * 1e-4, 200.0 + i, 90.0, 49.5]}
                                  for i in range(30)],
        "geoPolylineDTO": {"polyline": [{"lat": 53.55 + i * 1e-4, "lon": 9.99 + i * 1e-4, "time": 1_783_874_400_000 + i * 1000}
                                        for i in range(30)], "minLat": 53.55, "maxLon": 9.993},
        "totalMetricsCount": 3600,
    }
    splits = {"activityId": 21234567890, "lapDTOs": [
        {"lapIndex": 1, "distance": 10000.0, "duration": 1200.0, "averagePower": 215.0, "startLatitude": 53.55,
         "startLongitude": 9.99, "startTimeGMT": "2026-07-12T16:30:00.0", "intensityType": "ACTIVE"}]}
    return {"list_entry": entry, "details": details, "splits": splits,
            "hr_zones": [{"zoneNumber": 1, "secsInZone": 600.0, "zoneLowBoundary": 100}],
            "power_zones": {"error": "HTTPError"}}


# ---- Anonymisierung ----------------------------------------------------------

def test_capture_contains_no_identity_and_no_location():
    anon = CAP.anonymize_payload(_raw_payload())
    blob = json.dumps(anon, ensure_ascii=False)
    for secret in ("Gian", "gian.beispiel", "Beispiel", "Hamburg", "Feierabendrunde", EMAIL, "example.org", "https://",
                   "21234567890", "87654321", "3344556677", "53.55", "9.99", "2026-07-12", "1783874"):
        assert secret not in blob, secret
    assert CAP.self_check(anon, secrets=(EMAIL, "gian.beispiel")) == []


def test_capture_keeps_what_the_matrix_needs():
    anon = CAP.anonymize_payload(_raw_payload())
    e = anon["list_entry"]
    assert e["activityType"] == {"typeId": 2, "typeKey": "road_biking", "parentTypeId": 2, "isHidden": False}
    assert (e["duration"], e["movingDuration"], e["avgPower"], e["averageBikingCadenceInRevPerMinute"]) == (3600.5, 3500.0, 212.0, 92.0)
    # Feldnamen bleiben — auch die privater Felder (der Name ist die Information, der Wert nicht)
    assert e["ownerDisplayName"] == "REDACTED" and e["ownerId"] in (0, 1111111111) and "startLatitude" in e
    # Ortszeit und GMT behalten ihren ABSTAND: der Worker bildet daraus denselben Versatz
    assert GF.time_provenance(e)["utc_offset_s"] == 7200
    d = anon["details"]
    assert [m["key"] for m in d["metricDescriptors"]][3:] == ["directPower", "directBikeCadence", "directLeftBalance"]
    assert d["metricDescriptors"][4]["unit"]["key"] == "revolutionsPerMinute"       # Einheiten bleiben lesbar
    assert d["totalMetricsCount"] == 3600 and len(d["activityDetailMetrics"]) == 30
    ts = [r["metrics"][0] for r in d["activityDetailMetrics"]]
    assert ts[0] == 1767225600000 and ts[1] - ts[0] == 1000                         # Zeitabstaende bleiben, Datum nicht
    assert anon["power_zones"] == {"error": "HTTPError"}                            # ein fehlgeschlagener Abruf wird benannt
    assert anon["splits"]["lapDTOs"][0]["intensityType"] == "ACTIVE" and anon["splits"]["lapDTOs"][0]["averagePower"] == 215.0


def test_gps_is_off_by_default_and_shifted_when_asked_for():
    off = CAP.anonymize_payload(_raw_payload())
    geo = off["details"]["geoPolylineDTO"]
    assert geo["polyline"] == [] and geo["_removed_points"] == 30 and geo["_point_keys"] == ["lat", "lon", "time"]
    assert all(r["metrics"][1] == 0.0 and r["metrics"][2] == 0.0 for r in off["details"]["activityDetailMetrics"])
    assert off["list_entry"]["startLatitude"] == 0.0 and off["splits"]["lapDTOs"][0]["startLongitude"] == 0.0
    on = CAP.anonymize_payload(_raw_payload(), with_gps=True)
    poly = on["details"]["geoPolylineDTO"]["polyline"]
    assert len(poly) == 30 and poly[0]["lat"] == 0.0 and abs(poly[5]["lat"] - 0.0005) < 1e-9   # Form bleibt, Ort nicht
    assert CAP.self_check(on, secrets=(EMAIL,), with_gps=True) == []
    assert CAP.self_check(on, secrets=(EMAIL,), with_gps=False) != []                # ohne Freigabe waere das ein Befund


def test_self_check_refuses_dirty_output():
    dirty = CAP.anonymize_payload(_raw_payload())
    dirty["list_entry"]["someNewField"] = EMAIL
    assert "E-Mail-Adresse im Mitschnitt" in CAP.self_check(dirty)
    d2 = CAP.anonymize_payload(_raw_payload()); d2["list_entry"]["startLatitude"] = 53.55
    assert any("Koordinate" in p for p in CAP.self_check(d2))
    d3 = CAP.anonymize_payload(_raw_payload()); d3["splits"]["lapDTOs"][0]["gearId"] = 55667788
    assert any("Kennung" in p for p in CAP.self_check(d3))
    d4 = CAP.anonymize_payload(_raw_payload()); d4["list_entry"]["x"] = "geheimwort"
    assert CAP.self_check(d4, secrets=("GEHEIMWORT",)) == ["geheimer Wert im Mitschnitt gefunden"]
    d5 = CAP.anonymize_payload(_raw_payload()); d5["list_entry"]["link"] = "ftp://x/y"
    assert "Adresse (URL) im Mitschnitt" in CAP.self_check(d5)


def test_strict_scrub_rules():
    s = CAP.strict_scrub
    assert s("Mein Lauf am See") == "REDACTED" and s("Hamburg") == "REDACTED"       # freier Text, Eigennamen
    assert s("lap_swimming") == "lap_swimming" and s("stepsPerMinute") == "stepsPerMinute" and s("BENCH_PRESS") == "BENCH_PRESS"
    assert s("2026-01-01T02:00:00.0") == "2026-01-01T02:00:00.0" and s("Europe/Berlin") == "REDACTED"
    assert s({"ownerDTO": {"a": 1, "b": 2}}) == {"ownerDTO": {"_redacted_keys": ["a", "b"]}}
    assert s({"userRoles": ["A", "B"]}) == {"userRoles": {"_redacted_items": 2}}
    assert s({"deviceId": 77, "lapIndex": 3, "typeId": 5, "isFavorite": True}) == {"deviceId": 0, "lapIndex": 3, "typeId": 5, "isFavorite": True}
    assert s({"avgVerticalOscillation": 8.4}) == {"avgVerticalOscillation": 8.4}    # „lat" in „oscillation" ist kein Ort


# ---- Auswahl und Dateiname ---------------------------------------------------

def test_one_activity_per_garmin_type_newest_first():
    entries = [
        {"activityId": 5, "activityType": {"typeKey": "running"}},
        {"activityId": 4, "activityType": {"typeKey": "lap_swimming"}},
        {"activityId": 3, "activityType": {"typeKey": "running"}},
        {"activityId": 2, "activityType": {"typeKey": "open_water_swimming"}},
        {"activityId": 1, "activityType": {"typeKey": "curling"}},
        "muell",
    ]
    assert [e["activityId"] for e in CAP.pick_activities(entries, None, None)] == [5, 4, 2, 1]   # Bahn UND Freiwasser
    assert [e["activityId"] for e in CAP.pick_activities(entries, ("swimming",), None)] == [4, 2]
    assert [e["activityId"] for e in CAP.pick_activities(entries, None, "3")] == [3]
    assert CAP.pick_activities(entries, ("golf",), None) == []
    assert CAP.file_name(entries[1]) == "swimming__lap_swimming.json"
    hostile = CAP.file_name({"activityType": {"typeKey": "../../etc/Passwd"}})
    assert hostile == "other___etc_passwd.json" and "/" not in hostile and ".." not in hostile   # kein Pfad aus Garmin-Text


def test_calls_follow_the_sport_and_one_failure_does_not_stop_the_capture():
    class Api:
        def __init__(self):
            self.seen = []

        def __getattr__(self, name):
            if not name.startswith("get_activity"):
                raise AttributeError(name)

            def call(aid):
                self.seen.append(name)
                if name == "get_activity_splits":
                    raise RuntimeError("429")
                return {"ok": name}
            return call

    api = Api()
    p = CAP.fetch_payload(api, {"activityId": 1, "activityType": {"typeKey": "strength_training"}})
    assert "get_activity_exercise_sets" in api.seen and "get_activity_power_in_timezones" not in api.seen
    assert p["splits"] == {"error": "RuntimeError"} and p["details"] == {"ok": "get_activity_details"}
    api2 = Api()
    CAP.fetch_payload(api2, {"activityId": 2, "activityType": {"typeKey": "road_biking"}})
    assert "get_activity_power_in_timezones" in api2.seen and "get_activity_exercise_sets" not in api2.seen


# ---- Bericht -----------------------------------------------------------------

def test_report_names_what_is_recognised_kept_and_not_kept():
    rep = CAP.coverage_report(CAP.anonymize_payload(_raw_payload()))
    le = rep["list_entry"]
    assert {"avgPower", "normPower", "movingDuration", "averageBikingCadenceInRevPerMinute"} <= set(le["known"])
    assert le["evidence"]["avgPower"] == "library" and le["evidence"]["averageBikingCadenceInRevPerMinute"] == "assumed"
    assert "hasPolyline" in le["not_retained"] and le["private_dropped"] >= 5
    assert rep["sport"] == {"garmin_type": "road_biking", "orvia_sport": "cycling"}
    d = rep["details"]
    assert d["canonical_streams"] == ["cadence", "power", "time"] and d["extra_series_kept"] == ["directLeftBalance"]
    assert d["stream_meta"]["cadence"]["kind"] == "cycling_cadence_rpm" and d["units"]["directBikeCadence"] == "revolutionsPerMinute"
    assert d["sampling"] == {"rows": 30, "kept": 30, "total": 3600}
    assert rep["power_zones"] == {"error": "HTTPError"} and rep["splits"]["shape"] and rep["hr_zones"]["kept_by_worker"]
    blob = json.dumps(rep)
    assert "53.5" not in blob and "REDACTED" not in blob                             # Bericht: Namen und Zahlen der Struktur, keine Inhalte


# ---- echte Mitschnitte (falls vorhanden) --------------------------------------

_FILES = sorted(CAPTURES.glob("*.json")) if CAPTURES.is_dir() else []


@pytest.mark.skipif(not _FILES, reason="kein echter Mitschnitt unter tests/fixtures/garmin/captures/ — Belegstufe bleibt library/assumed")
@pytest.mark.parametrize("path", _FILES, ids=[p.name for p in _FILES])
def test_real_capture_is_clean_parses_and_loses_no_named_measurement(path):
    cap = json.loads(path.read_text(encoding="utf-8"))
    gps = bool((cap.get("_meta") or {}).get("gps"))
    assert CAP.self_check(cap, with_gps=gps) == []
    entry = cap.get("list_entry")
    if isinstance(entry, dict):
        act = normalize.normalize_activity(entry)
        assert act is not None and act.metrics["garmin"].get("type_key")
        cov = GF.coverage(entry)
        assert set(cov["known"]) - {k for k in cov["known"] if isinstance(entry[k], (dict, list))} <= set(cov["retained"])
    det = cap.get("details")
    if isinstance(det, dict) and det.get("metricDescriptors"):
        out = S.parse_activity_details(det)
        lens = {len(v) for v in out["streams"].values()}
        assert len(lens) <= 1                                                        # gleicher Index fuer alle Reihen
        keys = {m.get("key") for m in det["metricDescriptors"] if isinstance(m, dict)}
        if "directTimestamp" in keys and out["streams"]:
            assert "time" in out["streams"]
