"""v8-447 · Commit C — sportartspezifische Rohdaten.

C1  Zusatzreihen der Detailantwort (Laufdynamik, Pedalwerte, Zugfrequenz) bleiben unter
    Garmin-Namen erhalten: gleicher Index, gleicher Zeitbezug, keine Umrechnung.
C2  Sportartspezifische Groessen laufen durch keine fremde Regel (Schwimm-Zugfrequenz ist
    keine Laufkadenz; Rad-Trittfrequenz wird nicht verdoppelt).
C3  Verlustbericht: was Garmin liefert und NICHT erhalten wird, steht dem NAMEN nach in der
    Zeile — ohne Werte, ohne private Felder.
C4  Nichts wird erfunden: der echte Lauf-Mitschnitt erzeugt keine Zusatzreihe.

Belegstufe: ALLE Namen der Zusatzreihen sind Annahmen (im Repo liegt nur ein Lauf-Mitschnitt
ohne Laufdynamik). Die Tests belegen die Regeln; welche Reihen Garmin je Sportart wirklich
liefert, zeigt erst ein Mitschnitt bzw. der Feldzensus (docs/GARMIN-CAPABILITY-MATRIX.md).
"""

import json
from pathlib import Path

from orvia_worker import garmin_fields as GF, normalize, series_normalize as S

FIX = Path(__file__).parent / "fixtures" / "garmin"
DETAILS = json.load(open(FIX / "activity_details.json", encoding="utf-8"))
T0 = 1_767_225_600_000


def _details(cols: dict, n: int = 12, units: dict | None = None):
    """Synthetische Detailantwort im belegten Schema; `cols`: key → Funktion(i) oder Konstante."""
    keys = ["directTimestamp"] + list(cols)
    desc = []
    for i, k in enumerate(keys):
        d = {"metricsIndex": i, "key": k}
        if units and k in units:
            d["unit"] = {"key": units[k]}
        desc.append(d)
    rows = []
    for r in range(n):
        vals = [T0 + r * 5000]
        for k in cols:
            c = cols[k]
            vals.append(c(r) if callable(c) else c)
        rows.append({"metrics": vals})
    return {"metricDescriptors": desc, "activityDetailMetrics": rows}


# ---- C1 · Zusatzreihen ------------------------------------------------------

def test_running_dynamics_are_kept_under_garmin_names_with_time_reference():
    raw = _details({
        "directHeartRate": lambda i: 140 + i, "directDoubleCadence": 172.0,
        "directGroundContactTime": lambda i: 245.0 + i, "directVerticalOscillation": 8.4,
        "directStrideLength": 112.5, "directVerticalRatio": 7.5,
    }, units={"directGroundContactTime": "ms", "directVerticalOscillation": "centimeter", "directStrideLength": "centimeter"})
    out = S.parse_activity_details(raw)
    xs = out["ext_series"]
    assert set(xs) == {"directGroundContactTime", "directVerticalOscillation", "directStrideLength", "directVerticalRatio"}
    n = len(out["streams"]["time"])
    assert all(len(v["values"]) == n for v in xs.values())          # gleicher Index wie die Zeitachse
    assert xs["directGroundContactTime"]["values"][3] == 248.0       # Rohwert, nicht gerundet/umgerechnet
    assert xs["directGroundContactTime"]["garmin_unit"] == "ms"
    assert xs["directStrideLength"] == {"values": [112.5] * n, "garmin_unit": "centimeter"}
    assert "garmin_unit" not in xs["directVerticalRatio"]            # keine Einheit behauptet, wenn keine geliefert
    assert out["streams"]["cadence"][0] == 172.0 and out["series_unparsed"] == []
    m = S.build_activity_metrics({"ext": {"v": 1, "fields": {"distance": 1.0}}}, out)
    assert m["ext"]["fields"] == {"distance": 1.0} and set(m["ext"]["series"]) == set(xs)
    assert "directGroundContactTime" not in m["streams"]             # kanonische Reihen bleiben schlank


def test_reload_replaces_extra_series_and_keeps_list_fields():
    old = {"ext": {"v": 1, "fields": {"distance": 1.0}, "series": {"directStale": {"values": [1]}},
                   "series_unparsed": ["directOld"]}, "streams": {"heart_rate": [1]}}
    out = S.parse_activity_details(_details({"directHeartRate": 150, "directRespirationRate": 31.0}))
    m = S.build_activity_metrics(old, out)
    assert list(m["ext"]["series"]) == ["directRespirationRate"] and "series_unparsed" not in m["ext"]
    assert m["ext"]["fields"] == {"distance": 1.0}
    plain = S.build_activity_metrics(old, S.parse_activity_details(_details({"directHeartRate": 150})))
    assert "series" not in plain["ext"] and plain["ext"]["fields"] == {"distance": 1.0}


def test_extra_series_are_capped_known_first():
    cols = {"directHeartRate": 150}
    for i in range(12):
        cols[f"directSomePowerThing{i:02d}"] = float(i)
    cols["directGroundContactTime"] = 240.0
    out = S.parse_activity_details(_details(cols))
    kept = list(out["ext_series"])
    assert len(kept) == GF.SERIES_MAX and kept[0] == "directGroundContactTime"
    assert len(out["series_unparsed"]) == 13 - GF.SERIES_MAX       # der Rest: nur dem Namen nach


# ---- C2 · keine fremde Regel ------------------------------------------------

def test_swim_stroke_rate_is_not_running_cadence():
    out = S.parse_activity_details(_details({"directHeartRate": 130, "directSwimCadence": 27.0, "directSwolf": 38.0}))
    assert "cadence" not in out["streams"]                           # keine Laufkadenz aus Zuegen
    assert out["ext_series"]["directSwimCadence"]["values"][0] == 27.0   # nicht verdoppelt
    assert out["ext_series"]["directSwolf"]["values"][0] == 38.0


def test_bike_cadence_stays_rpm_and_pedal_values_are_kept():
    out = S.parse_activity_details(_details({"directPower": 210.0, "directBikeCadence": 92.0,
                                             "directLeftBalance": 49.5, "directRightPedalSmoothness": 21.0}))
    assert out["streams"]["cadence"][0] == 92.0 and out["stream_meta"]["cadence"]["kind"] == "cycling_cadence_rpm"
    assert out["stream_units"]["cadence"] == "rpm"
    assert set(out["ext_series"]) == {"directLeftBalance", "directRightPedalSmoothness"}


def test_rowing_and_swim_summary_fields_keep_their_own_names():
    row = normalize.normalize_activity({"activityId": 5, "activityType": {"typeKey": "indoor_rowing"},
                                        "startTimeGMT": "2026-07-12 06:30:00", "strokes": 840.0,
                                        "avgStrokeCadence": 24.0, "avgStrokeDistance": 9.1, "avgPower": 180.0})
    f = row.metrics["ext"]["fields"]
    assert row.sport_id == "rowing" and f["strokes"] == 840.0 and f["avgStrokeCadence"] == 24.0
    assert "averageRunningCadenceInStepsPerMinute" not in f          # nichts in ein Lauf-Feld umgedeutet


# ---- C3 · Verlustbericht ----------------------------------------------------

def test_unretained_list_fields_are_reported_by_name_only():
    raw = {"activityId": 9, "activityType": {"typeKey": "running"}, "startTimeGMT": "2026-07-12 06:30:00",
           "distance": 5000.0, "hasPolyline": True, "pr": False, "purposeful": True,
           "ownerDisplayName": "jemand", "locationName": "Irgendwo", "deviceId": 1,
           "weirdBlock": {"a": 1}, "splitSummaries": [{"distance": 5000.0, "splitType": "RWD_RUN", "noOfSplits": 3}]}
    ext = normalize.normalize_activity(raw).metrics["ext"]
    assert ext["unrecognized"] == ["hasPolyline", "pr", "purposeful", "weirdBlock"]
    assert ext["list"]["splitSummaries"] == [{"distance": 5000.0, "noOfSplits": 3, "splitType": "RWD_RUN"}]
    blob = json.dumps(ext)
    for word in ("jemand", "Irgendwo", "ownerDisplayName", "locationName", "deviceId"):
        assert word not in blob, word                                # private Felder auch nicht dem Namen nach


def test_unparsed_series_are_reported_by_name_only():
    out = S.parse_activity_details(_details({"directHeartRate": 150, "directMystery": 3.0, "ownerThing": 1.0,
                                             "directLatitude": 54.1, "directBodyBattery": 40.0}))
    assert out["series_unparsed"] == ["directMystery"]               # weder Messwort noch bekannt
    assert out["ext_series"] == {}
    m = S.build_activity_metrics({}, out)
    assert m["ext"] == {"v": 1, "series_unparsed": ["directMystery"]}
    assert "54.1" not in json.dumps(m["ext"])


def test_series_classification():
    c = GF.classify_series
    assert c("directHeartRate") == "canonical" and c("directLatitude") == "canonical"
    assert c("directGroundContactTime") == "known" and c("directSwimCadence") == "known"
    assert c("directLeftPowerPhase") == "measured"
    assert c("userProfileThing") == "private" and c("directFoo") == "unrecognized" and c(None) == "unrecognized"
    assert all(f["evidence"] == "assumed" for f in GF.SERIES_KNOWN)  # ehrlich: nichts davon ist belegt


# ---- C4 · nichts erfunden ---------------------------------------------------

def test_real_run_capture_creates_no_extra_series_and_no_names():
    out = S.parse_activity_details(DETAILS)
    assert out["ext_series"] == {} and out["series_unparsed"] == []
    m = S.build_activity_metrics({"training_load": 1}, out)
    assert "ext" not in m                                            # kein leerer Block
    keys = {d["key"] for d in DETAILS["metricDescriptors"]}
    assert keys <= GF.SERIES_SKIP                                    # jede Reihe des Mitschnitts ist zugeordnet


def test_known_tables_are_consistent():
    keys = [f["key"] for f in GF.KNOWN]
    assert len(keys) == len(set(keys))
    assert all(f["evidence"] in ("fixture", "library", "assumed") for f in GF.KNOWN + GF.SERIES_KNOWN)
    assert all(f["unit"] and f["group"] and f["sports"] for f in GF.KNOWN + GF.SERIES_KNOWN)
    assert not (set(GF.SERIES_KNOWN_BY_KEY) & GF.SERIES_SKIP)
    # kein bekanntes Feld wird vom Privatschutz verschluckt
    assert [k for k in keys if GF._is_private(k, 1.0)] == []
    assert [k for k in GF.SERIES_KNOWN_BY_KEY if GF._is_private(k)] == []


# ---- C5 · Sportarten-Zuordnung (Garmin-Typ → Katalog) ------------------------

import re  # noqa: E402

CATALOG_24 = {"gym", "running", "cycling", "swimming", "triathlon", "football", "handball", "padel", "tennis",
              "athletics", "basketball", "rowing", "hiking", "walking", "mobility", "other", "volleyball", "hockey",
              "rugby", "badminton", "golf", "climbing", "yoga", "hyrox"}
# (Gleichstand dieser Liste mit der App: supabase/tests/activity_capabilities_test.mjs, E5.)
# Katalog-Sportarten OHNE eigenen Garmin-Typ — bewusst: Leichtathletik zeichnet Garmin als
# Lauf auf (track_running → running); "other" ist der Rueckfall selbst.
NO_GARMIN_TYPE = {"athletics", "other"}


def test_every_garmin_type_maps_into_the_catalog_and_every_sport_is_reachable():
    assert set(normalize.SPORT_MAP.values()) <= CATALOG_24 - {"other"}
    reachable = set(normalize.SPORT_MAP.values())
    assert CATALOG_24 - reachable == NO_GARMIN_TYPE                  # 22 von 24 haben mindestens einen Garmin-Typ
    assert all(k == k.strip().lower() and re.fullmatch(r"[a-z0-9_]+", k) for k in normalize.SPORT_MAP)


def test_subtypes_no_longer_fall_to_other_and_keep_their_garmin_type():
    for key, sport in (("track_running", "running"), ("street_running", "running"), ("virtual_run", "running"),
                       ("cyclocross", "cycling"), ("e_bike_mountain", "cycling"), ("speed_walking", "walking"),
                       ("field_hockey", "hockey"), ("tennis_v2", "tennis"), ("TRACK_RUNNING ", "running")):
        act = normalize.normalize_activity({"activityId": 1, "activityType": {"typeKey": key}, "startTimeGMT": "2026-07-12 06:30:00"})
        assert act.sport_id == sport, key
        assert act.metrics["garmin"]["type_key"] == key.strip().lower()   # der Untertyp bleibt lesbar
    for key in ("ice_hockey", "american_football", "hiit", "pilates", "quidditch"):
        act = normalize.normalize_activity({"activityId": 1, "activityType": {"typeKey": key}, "startTimeGMT": "2026-07-12 06:30:00"})
        assert act.sport_id == "other" and act.metrics["source_sport_raw"] == key and act.metrics["garmin"]["type_key"] == key
