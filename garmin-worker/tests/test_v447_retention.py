"""v8-447 · Commit B — was vom Garmin-Abruf ERHALTEN wird.

B1  Herkunft: Garmin-Typ bleibt auch bei bekannter Sportart, Ortszeit + UTC + Versatz.
B2  Rohfelder: nur was Garmin liefert, unter Garmin-Namen, ohne Umrechnung; nichts Privates.
B3  Zeitachse: jede Messreihe hat denselben Index und einen echten Zeitbezug.
B4  Dauern: Bewegungszeit / verstrichene Zeit / Timer getrennt erhalten.
B5  Zusatzabrufe: standardmaessig AUS, je Sportart, Fehler isoliert.
B6  Quelle / manuell / wirksam: eine manuelle Korrektur uebersteht Details-Nachladen,
    Herkunfts-Nachtrag und erneuten Listenabruf (341 min → 75 min bleibt 75 min).
B7  Herkunfts-Nachtrag fuer Altzeilen: ergaenzt nur, ersetzt nie.

Belegstufe: die Zeitachse und die Dauern sind am ECHTEN anonymisierten Lauf-Mitschnitt
geprueft. Listeneintraege und Zusatzabrufe sind SYNTHETISCH (im Repo liegt kein Mitschnitt)
— diese Tests belegen die Verdrahtung und die Regeln, nicht Garmins Nutzlast.
"""

import asyncio
import json
from pathlib import Path

from orvia_worker import detail_sync, garmin_fields as GF, normalize, series_normalize as S
from orvia_worker.config import Settings
from tests.conftest import FakeDb

FIX = Path(__file__).parent / "fixtures" / "garmin"
DETAILS = json.load(open(FIX / "activity_details.json", encoding="utf-8"))


def _entry(**over):
    """Synthetischer Listeneintrag (get_activities_by_date) — Feldnamen wie in der Bibliothek."""
    e = {
        "activityId": 4711, "activityName": "Morgenlauf am See",
        "activityType": {"typeId": 1, "typeKey": "running", "parentTypeId": 17},
        "startTimeLocal": "2026-07-12 08:30:00", "startTimeGMT": "2026-07-12 06:30:00",
        "duration": 3475.136962890625, "movingDuration": 3301.0, "elapsedDuration": 3620.5,
        "distance": 10012.3, "averageHR": 148.0, "maxHR": 171.0, "calories": 712.0,
        "ownerDisplayName": "jemand", "ownerId": 99, "deviceId": 12345,
        "locationName": "Irgendwo", "startLatitude": 54.1, "startLongitude": 9.9,
    }
    e.update(over)
    return e


# ---- B1 · Herkunft ----------------------------------------------------------

def test_garmin_type_is_kept_even_when_the_sport_is_known():
    """Bis v8-446 blieb der Garmin-Typ nur erhalten, wenn er auf `other` fiel."""
    for key, sport in (("lap_swimming", "swimming"), ("open_water_swimming", "swimming"),
                       ("treadmill_running", "running"), ("trail_running", "running"),
                       ("indoor_cycling", "cycling"), ("road_biking", "cycling")):
        act = normalize.normalize_activity(_entry(activityType={"typeId": 5, "typeKey": key, "parentTypeId": 26}))
        assert act.sport_id == sport, key
        assert act.metrics["garmin"]["type_key"] == key
        assert act.metrics["garmin"]["parent_type_id"] == 26
        assert "source_sport_raw" not in act.metrics            # nur beim echten Rueckfall


def test_local_time_utc_and_offset_are_kept_side_by_side():
    g = normalize.normalize_activity(_entry()).metrics["garmin"]
    assert g["start_local"] == "2026-07-12T08:30:00"            # Wandzeit am Ort
    assert g["start_gmt"] == "2026-07-12T06:30:00Z"
    assert g["utc_offset_s"] == 7200                            # Sommer, aus den zwei Zeiten
    w = normalize.normalize_activity(_entry(startTimeLocal="2026-01-12 08:30:00",
                                            startTimeGMT="2026-01-12 07:30:00")).metrics["garmin"]
    assert w["utc_offset_s"] == 3600                            # Winter — keine feste Verschiebung
    ny = GF.time_provenance({"startTimeLocal": "2026-07-12 08:30:00", "startTimeGMT": "2026-07-12 12:30:00"})
    assert ny["utc_offset_s"] == -14400                         # keine fest eingetragene Zone
    over = GF.time_provenance({"startTimeLocal": "2026-07-12 23:30:00", "startTimeGMT": "2026-07-13 01:30:00"})
    assert over["start_local"].startswith("2026-07-12") and over["utc_offset_s"] == -7200   # Tageswechsel


def test_offset_is_never_guessed():
    assert "utc_offset_s" not in GF.time_provenance({"startTimeLocal": "2026-07-12 08:30:00"})
    assert "utc_offset_s" not in GF.time_provenance({"startTimeGMT": "2026-07-12 06:30:00"})
    odd = GF.time_provenance({"startTimeLocal": "2026-07-12 08:30:07", "startTimeGMT": "2026-07-12 06:30:00"})
    assert "utc_offset_s" not in odd                            # kein Viertelstunden-Versatz → keiner
    far = GF.time_provenance({"startTimeLocal": "2026-07-14 08:30:00", "startTimeGMT": "2026-07-12 06:30:00"})
    assert "utc_offset_s" not in far
    assert GF.time_provenance(None) == {} and GF.provenance("x") == {"v": GF.EXT_VERSION}


def test_started_at_stays_the_utc_instant():
    act = normalize.normalize_activity(_entry())
    # Die Spalte traegt Garmins GMT-Zeit — nie die Ortszeit (die steht in metrics.garmin).
    assert str(act.started_at).replace("T", " ").startswith("2026-07-12 06:30:00")


# ---- B2 · Rohfelder ---------------------------------------------------------

def test_raw_fields_are_kept_under_garmin_names_without_conversion():
    act = normalize.normalize_activity(_entry(averageRunningCadenceInStepsPerMinute=161.4,
                                              aerobicTrainingEffect=3.4, trainingEffectLabel="TEMPO"))
    f = act.metrics["ext"]["fields"]
    assert f["movingDuration"] == 3301.0 and f["elapsedDuration"] == 3620.5
    assert f["duration"] == 3475.136962890625                   # Rohwert, ungerundet
    assert f["averageRunningCadenceInStepsPerMinute"] == 161.4  # NICHT verdoppelt, NICHT halbiert
    assert f["aerobicTrainingEffect"] == 3.4 and f["trainingEffectLabel"] == "TEMPO"


def test_nothing_is_invented_when_garmin_does_not_deliver():
    f = normalize.normalize_activity(_entry()).metrics["ext"]["fields"]
    for absent in ("avgPower", "normPower", "averageSwolf", "poolLength", "totalSets",
                   "aerobicTrainingEffect", "averageRunningCadenceInStepsPerMinute", "hrTimeInZone_1"):
        assert absent not in f, absent
    bare = normalize.normalize_activity({"activityId": 1, "activityType": {"typeKey": "yoga"},
                                         "startTimeGMT": "2026-07-12 06:30:00"})
    assert "ext" not in bare.metrics                            # kein leerer Block
    assert bare.metrics["garmin"] == {"v": 1, "type_key": "yoga", "start_gmt": "2026-07-12T06:30:00Z"}


def test_sport_specific_fields_survive_only_if_present():
    swim = normalize.normalize_activity(_entry(
        activityType={"typeKey": "lap_swimming"}, poolLength=25.0, unitOfPoolLength={"unitId": 1, "unitKey": "meter", "factor": 100.0},
        activeLengths=40, strokes=612.0, averageSwolf=38.0, averageSwimCadenceInStrokesPerMinute=27.0))
    f = swim.metrics["ext"]["fields"]
    assert (f["poolLength"], f["unitOfPoolLength"], f["activeLengths"], f["averageSwolf"]) == (25.0, "meter", 40, 38.0)
    assert f["averageSwimCadenceInStrokesPerMinute"] == 27.0    # Zuege/min — eigenes Feld, keine Laufkadenz
    ride = normalize.normalize_activity(_entry(
        activityType={"typeKey": "road_biking"}, avgPower=212.0, maxPower=640.0, normPower=228.0,
        averageBikingCadenceInRevPerMinute=92.0, max20MinPower=241.0)).metrics["ext"]["fields"]
    assert (ride["avgPower"], ride["normPower"], ride["averageBikingCadenceInRevPerMinute"]) == (212.0, 228.0, 92.0)
    gym = normalize.normalize_activity(_entry(
        activityType={"typeKey": "strength_training"}, totalSets=18, activeSets=15, totalReps=142,
        summarizedExerciseSets=[{"category": "BENCH_PRESS", "reps": 24, "sets": 3, "volume": 180000.0, "ownerId": 5}]))
    assert gym.metrics["ext"]["fields"]["totalSets"] == 18
    assert gym.metrics["ext"]["list"]["summarizedExerciseSets"] == [
        {"category": "BENCH_PRESS", "reps": 24, "sets": 3, "volume": 180000.0}]


def test_unknown_measurement_is_kept_not_dropped():
    """Ein Messfeld, dessen genauer Name hier (noch) nicht bekannt ist, geht nicht verloren."""
    raw = _entry(avgSomeNewPowerMetric=17.5, weirdThing="abc")
    cov = GF.coverage(raw)
    assert "avgSomeNewPowerMetric" in cov["measured"] and "avgSomeNewPowerMetric" in cov["retained"]
    assert "weirdThing" in cov["unrecognized"] and "weirdThing" not in cov["retained"]


def test_private_fields_never_enter_the_stored_row():
    act = normalize.normalize_activity(_entry(avgVerticalOscillation=8.4, userProfileId=7, ownerFullName="X Y",
                                              description="privat", startLatitude=54.1, endLongitude=9.9))
    blob = json.dumps(act.metrics)
    for word in ("jemand", "Irgendwo", "Morgenlauf", "54.1", "9.9", "12345", "privat", "X Y"):
        assert word not in blob, word
    f = act.metrics["ext"]["fields"]
    for key in ("ownerDisplayName", "ownerId", "deviceId", "locationName", "startLatitude",
                "startLongitude", "endLongitude", "userProfileId", "activityName", "description", "activityId"):
        assert key not in f, key
    assert f["avgVerticalOscillation"] == 8.4                   # „lat" in „oscillation" ist kein Ort


def test_structure_keeper_strips_private_and_caps_size():
    raw = {"lapDTOs": [{"distance": 1000.0, "duration": 300.0, "averageHR": 150, "startLatitude": 1.0,
                        "startTimeGMT": "2026-07-12T06:30:00.0", "ownerId": 3, "wktStepName": "Mein Intervall",
                        "intensityType": "ACTIVE"}] * 500}
    kept = GF.keep_structure(raw)
    assert len(kept["lapDTOs"]) == GF.LIST_MAX
    lap = kept["lapDTOs"][0]
    assert lap == {"distance": 1000.0, "duration": 300.0, "averageHR": 150,
                   "startTimeGMT": "2026-07-12T06:30:00.0", "intensityType": "ACTIVE"}


# ---- B3 · Zeitachse ---------------------------------------------------------

def test_every_stream_shares_one_index_and_has_a_time_axis():
    out = S.parse_activity_details(DETAILS)
    st = out["streams"]
    n = len(st["time"])
    assert n > 100
    assert {len(v) for v in st.values()} == {n}                 # kein Off-by-one zwischen Reihen
    assert st["time"][0] == 0
    assert all(b >= a for a, b in zip(st["time"], st["time"][1:]))
    assert all(isinstance(t, int) for t in st["time"])
    assert out["stream_meta"]["time"] == {"kind": "elapsed_s", "unit": "s", "source": "directTimestamp",
                                          "garmin_unit": out["stream_meta"]["time"]["garmin_unit"]}
    assert out["stream_units"]["time"] == "s"


def test_time_axis_is_the_real_recording_time_not_an_even_spread():
    """Garmin zeichnet nicht gleichmaessig auf — genau deshalb reicht die Reihenfolge nicht."""
    raw_idx = {m["key"]: m["metricsIndex"] for m in DETAILS["metricDescriptors"]}
    ts = [r["metrics"][raw_idx["directTimestamp"]] for r in DETAILS["activityDetailMetrics"]]
    ts = [t for t in ts if t is not None]
    gaps = sorted({round((b - a) / 1000) for a, b in zip(ts, ts[1:])})
    assert gaps[0] <= 1 and gaps[-1] > 60                       # Abstaende von 1 s bis Minuten
    out = S.parse_activity_details(DETAILS)
    t = out["streams"]["time"]
    assert t[-1] == round((ts[-1] - ts[0]) / 1000)              # Ende = echte verstrichene Zeit
    even = [round(i * t[-1] / (len(t) - 1)) for i in range(len(t))]
    assert t != even                                            # eine gleichmaessige Achse waere falsch
    assert out["sampling"] == {"rows": len(DETAILS["activityDetailMetrics"]), "kept": len(t)}


def test_time_axis_is_not_invented_when_garmin_gives_none():
    raw = {"metricDescriptors": [{"metricsIndex": 0, "key": "directHeartRate"}],
           "activityDetailMetrics": [{"metrics": [120 + i]} for i in range(30)]}
    out = S.parse_activity_details(raw)
    assert "heart_rate" in out["streams"] and "time" not in out["streams"]
    assert "time" not in out["stream_meta"] and out["durations"] == {}


def test_broken_time_axis_is_dropped_not_repaired():
    raw = {"metricDescriptors": [{"metricsIndex": 0, "key": "directHeartRate"}, {"metricsIndex": 1, "key": "directTimestamp"}],
           "activityDetailMetrics": [{"metrics": [120, 1_700_000_000_000 + (5 - i) * 1000]} for i in range(6)]}
    assert "time" not in S.parse_activity_details(raw)["streams"]        # laeuft rueckwaerts
    gap = {"metricDescriptors": raw["metricDescriptors"],
           "activityDetailMetrics": [{"metrics": [120, None if i == 3 else 1_700_000_000_000 + i * 1000]} for i in range(6)]}
    assert "time" not in S.parse_activity_details(gap)["streams"]        # Luecke


def test_elapsed_fallback_is_named_as_its_source():
    raw = {"metricDescriptors": [{"metricsIndex": 0, "key": "directHeartRate"}, {"metricsIndex": 1, "key": "sumElapsedDuration"}],
           "activityDetailMetrics": [{"metrics": [120, i * 2.0]} for i in range(6)]}
    out = S.parse_activity_details(raw)
    assert out["streams"]["time"] == [0, 2, 4, 6, 8, 10]
    assert out["stream_meta"]["time"]["source"] == "sumElapsedDuration"


# ---- B4 · Dauern ------------------------------------------------------------

def test_moving_elapsed_and_timer_duration_are_kept_apart():
    out = S.parse_activity_details(DETAILS)
    d = out["durations"]
    assert set(d) == {"timer_s", "moving_s", "elapsed_s"}
    assert d["moving_s"] <= d["timer_s"] <= d["elapsed_s"]      # am echten Mitschnitt
    assert d["elapsed_s"] - d["timer_s"] > 600                  # dieser Lauf hatte ueber 10 min Pause
    m = S.build_activity_metrics({"garmin": {"v": 1, "type_key": "running", "start_local": "2026-07-12T08:30:00"}}, out)
    g = m["garmin"]
    assert g["type_key"] == "running" and g["start_local"] == "2026-07-12T08:30:00"   # Herkunft bleibt
    assert (g["moving_duration_s"], g["timer_duration_s"], g["elapsed_duration_s"]) == (d["moving_s"], d["timer_s"], d["elapsed_s"])
    assert g["stream_rows"] == 1855 and g["stream_kept"] == len(out["streams"]["time"])


# ---- B5 · Zusatzabrufe ------------------------------------------------------

def test_extras_are_off_by_default():
    base = {"SUPABASE_URL": "https://x.invalid", "SUPABASE_SERVICE_ROLE_KEY": "k", "TOKEN_ENCRYPTION_KEY": "k"}
    assert Settings.from_env(base).detail_extras == ()
    assert Settings.from_env(base).detail_backfill_limit == 10
    assert Settings.from_env(base).activity_provenance_backfill_days == 0
    assert Settings.from_env({**base, "DETAIL_EXTRAS": " Splits, hr_zones ,"}).detail_extras == ("splits", "hr_zones")
    assert Settings.from_env({**base, "DETAIL_BACKFILL_LIMIT": "0"}).detail_backfill_limit == 1
    assert detail_sync.extras_for("running", ()) == [] and detail_sync.extras_for("running", None) == []

    async def run():
        db = FakeDb(); uid = "x1"
        await db.insert("activities", [{"user_id": uid, "source": "garmin", "source_record_id": "E1", "sport_id": "running", "metrics": {}}])
        calls = []
        res = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=5,
                                                      get_extra=lambda n, a: calls.append(n), extras=())
        assert calls == [] and res["extras"] == 0
        m = (await db.select("activities", {"user_id": uid, "source_record_id": "E1"}))[0]["metrics"]
        assert "ext" not in m
    asyncio.run(run())


def test_extras_follow_the_sport():
    on = ("activity", "splits", "typed_splits", "hr_zones", "power_zones", "exercise_sets")
    assert detail_sync.extras_for("gym", on) == ["activity", "splits", "hr_zones", "exercise_sets"]
    assert detail_sync.extras_for("swimming", on) == ["activity", "splits", "typed_splits", "hr_zones"]
    assert detail_sync.extras_for("cycling", on) == ["activity", "splits", "typed_splits", "hr_zones", "power_zones"]
    assert detail_sync.extras_for("yoga", on) == ["activity", "splits", "hr_zones"]
    assert detail_sync.extras_for("running", ("nonsense", "splits")) == ["splits"]


def test_extras_are_stored_as_delivered_and_failures_are_isolated():
    async def run():
        db = FakeDb(); uid = "x2"
        await db.insert("activities", [{"user_id": uid, "source": "garmin", "source_record_id": "E2", "sport_id": "running",
                                        "metrics": {"ext": {"v": 1, "fields": {"distance": 10012.3}}}}])
        def get_extra(name, aid):
            if name == "hr_zones":
                raise RuntimeError("boom")
            if name == "splits":
                return {"activityId": 4711, "lapDTOs": [
                    {"lapIndex": 1, "distance": 1000.0, "duration": 301.2, "movingDuration": 299.0, "averageHR": 151.0,
                     "startLatitude": 54.1, "startTimeGMT": "2026-07-12T06:30:00.0"},
                    {"lapIndex": 2, "distance": 1000.0, "duration": 296.8, "averageHR": 158.0}]}
            if name == "activity":
                return {"summaryDTO": {"distance": 1.0, "minHR": 96.0, "startLatitude": 54.1}}
            return {}
        res = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=5, get_extra=get_extra,
                                                      extras=("activity", "splits", "typed_splits", "hr_zones"))
        assert res["updated"] == 1 and res["failed"] == [] and res["extras"] == 3
        m = (await db.select("activities", {"user_id": uid, "source_record_id": "E2"}))[0]["metrics"]
        ext = m["ext"]
        assert ext["extras"] == {"activity": "ok", "splits": "ok", "typed_splits": "empty", "hr_zones": "failed"}
        assert ext["fields"] == {"distance": 10012.3, "minHR": 96.0}        # Listeneintrag bleibt fuehrend
        assert ext["splits"]["lapDTOs"][0]["movingDuration"] == 299.0       # Form und Namen von Garmin
        assert "startLatitude" not in json.dumps(ext) and "activityId" not in json.dumps(ext)
        assert [l["distance"] for l in m["splits"]] == [1000.0, 1000.0] and m["splits_source"] == "garmin_splits"
        assert "heart_rate" in m["streams"] and m["detailsVersion"] == 3    # Details trotz Teilfehler vollstaendig
    asyncio.run(run())


def test_laps_are_only_taken_when_the_shape_fits():
    assert detail_sync._slim_laps({"foo": 1}) is None
    assert detail_sync._slim_laps({"lapDTOs": [{"averageHR": 150}]}) is None       # ohne Distanz/Dauer keine Runde
    assert detail_sync._slim_laps([{"distance": 400.0, "elapsedDuration": 90.0}]) == [{"distance": 400.0, "elapsedDuration": 90.0}]


# ---- B6 · Quelle / manuell / wirksam ----------------------------------------

CORR = {"duration": {"manual": 4500, "source": 20460, "unit": "s", "at": "2026-10-01T18:00:00.000Z", "method": "manual"}}


def test_manual_correction_survives_detail_reload():
    """341 min (Quelle) → 75 min (manuell): Details nachladen aendert weder Korrektur noch Spalte."""
    async def run():
        db = FakeDb(); uid = "c1"
        await db.insert("activities", [{
            "user_id": uid, "source": "garmin", "source_record_id": "K1", "sport_id": "gym", "duration_seconds": 20460,
            "metrics": {"corrections": json.loads(json.dumps(CORR)), "durationCorrection": {"seconds": 4500},
                        "detailsFetchedAt": "2026-09-01T00:00:00+00:00", "detailsVersion": 2}}])
        res = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=5)
        assert res["selected"] == ["K1"]
        row = (await db.select("activities", {"user_id": uid, "source_record_id": "K1"}))[0]
        assert row["metrics"]["corrections"] == CORR
        assert row["metrics"]["durationCorrection"] == {"seconds": 4500}
        assert row["duration_seconds"] == 20460                 # die Spalte bleibt die QUELLE
        assert row["metrics"]["detailsVersion"] == 3
    asyncio.run(run())


def test_correction_made_during_the_reload_is_not_overwritten():
    async def run():
        db = FakeDb(); uid = "c2"
        await db.insert("activities", [{"user_id": uid, "source": "garmin", "source_record_id": "K2", "sport_id": "gym",
                                        "duration_seconds": 20460, "metrics": {}}])
        orig, state = db.select, {"n": 0}
        async def select(table, flt=None, **kw):
            state["n"] += 1
            if state["n"] == 2:                                 # 1 = Laufbeginn, 2 = frisches Nachlesen
                await db.update("activities", {"user_id": uid, "source_record_id": "K2"},
                                {"metrics": {"corrections": json.loads(json.dumps(CORR))}})
            return await orig(table, flt, **kw)
        db.select = select
        await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=5)
        db.select = orig
        m = (await db.select("activities", {"user_id": uid, "source_record_id": "K2"}))[0]["metrics"]
        assert m["corrections"] == CORR and "heart_rate" in m["streams"]
    asyncio.run(run())


def test_withdrawn_correction_is_not_revived():
    async def run():
        db = FakeDb(); uid = "c3"
        await db.insert("activities", [{"user_id": uid, "source": "garmin", "source_record_id": "K3", "sport_id": "gym",
                                        "metrics": {"corrections": json.loads(json.dumps(CORR))}}])
        orig, state = db.select, {"n": 0}
        async def select(table, flt=None, **kw):
            state["n"] += 1
            if state["n"] == 2:
                await db.update("activities", {"user_id": uid, "source_record_id": "K3"}, {"metrics": {}})
            return await orig(table, flt, **kw)
        db.select = select
        await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=5)
        db.select = orig
        m = (await db.select("activities", {"user_id": uid, "source_record_id": "K3"}))[0]["metrics"]
        assert "corrections" not in m
    asyncio.run(run())


# ---- B7 · Herkunfts-Nachtrag fuer Altzeilen ---------------------------------

def test_provenance_is_added_to_old_rows_without_touching_anything_else():
    async def run():
        db = FakeDb(); uid = "p1"
        await db.insert("activities", [{
            "user_id": uid, "source": "garmin", "source_record_id": "4711", "sport_id": "running",
            "duration_seconds": 20460, "summary": {"distance_m": 10012.3},
            "metrics": {"training_load": 148, "streams": {"heart_rate": [1, 2, 3]},
                        "corrections": json.loads(json.dumps(CORR))}}])
        act = normalize.normalize_activity(_entry())
        res = await detail_sync.patch_provenance(db, uid, [act])
        assert res == {"patched": 1, "sport_upgraded": 0}
        row = (await db.select("activities", {"user_id": uid, "source_record_id": "4711"}))[0]
        m = row["metrics"]
        assert m["garmin"]["start_local"] == "2026-07-12T08:30:00" and m["garmin"]["type_key"] == "running"
        assert m["ext"]["fields"]["movingDuration"] == 3301.0
        assert m["corrections"] == CORR and m["streams"] == {"heart_rate": [1, 2, 3]} and m["training_load"] == 148
        assert row["duration_seconds"] == 20460 and row["summary"] == {"distance_m": 10012.3} and row["sport_id"] == "running"
        again = await detail_sync.patch_provenance(db, uid, [act])
        assert again == {"patched": 0, "sport_upgraded": 0}     # idempotent
    asyncio.run(run())


def test_provenance_fills_gaps_but_never_replaces():
    async def run():
        db = FakeDb(); uid = "p2"
        await db.insert("activities", [{
            "user_id": uid, "source": "garmin", "source_record_id": "4711", "sport_id": "running",
            "metrics": {"garmin": {"moving_duration_s": 5509.0, "type_key": "trail_running"},
                        "ext": {"v": 1, "fields": {"distance": 1.0}}}}])
        await detail_sync.patch_provenance(db, uid, [normalize.normalize_activity(_entry())])
        m = (await db.select("activities", {"user_id": uid, "source_record_id": "4711"}))[0]["metrics"]
        assert m["garmin"]["moving_duration_s"] == 5509.0 and m["garmin"]["type_key"] == "trail_running"
        assert m["garmin"]["start_local"] == "2026-07-12T08:30:00"          # nur das Fehlende ergaenzt
        assert m["ext"] == {"v": 1, "fields": {"distance": 1.0}}            # vorhandener Block bleibt
    asyncio.run(run())


def test_sport_is_lifted_from_other_only_when_the_mapping_was_the_reason():
    async def run():
        db = FakeDb(); uid = "p3"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": "1", "sport_id": "other", "metrics": {"source_sport_raw": "yoga"}},
            {"user_id": uid, "source": "garmin", "source_record_id": "2", "sport_id": "other", "metrics": {}},
            {"user_id": uid, "source": "garmin", "source_record_id": "3", "sport_id": "hiking", "metrics": {"source_sport_raw": "yoga"}},
        ])
        acts = [normalize.normalize_activity(_entry(activityId=i, activityType={"typeKey": "yoga"})) for i in (1, 2, 3)]
        assert {a.sport_id for a in acts} == {"yoga"}
        res = await detail_sync.patch_provenance(db, uid, acts)
        assert res["sport_upgraded"] == 1
        sport = {r["source_record_id"]: r["sport_id"] for r in await db.select("activities", {"user_id": uid})}
        assert sport == {"1": "yoga", "2": "other", "3": "hiking"}          # 2: Grund unbekannt, 3: Nutzerwahl
    asyncio.run(run())


def test_provenance_patch_ignores_garbage_and_missing_rows():
    async def run():
        db = FakeDb()
        assert await detail_sync.patch_provenance(db, "p4", None) == {"patched": 0, "sport_upgraded": 0}
        assert await detail_sync.patch_provenance(db, "p4", [object(), normalize.normalize_activity(_entry())]) == {"patched": 0, "sport_upgraded": 0}
    asyncio.run(run())


# ---- B8 · Verdrahtung im Sync-Lauf (FakeDb + Fixture-Provider) ----------------

import dataclasses  # noqa: E402

from orvia_worker.providers.garmin_unofficial import GarminUnofficialProvider  # noqa: E402
from orvia_worker.sync import sync_user  # noqa: E402

USER = "user-b8"
EXTRA_METHODS = ("get_activity", "get_activity_splits", "get_activity_typed_splits",
                 "get_activity_hr_in_timezones", "get_activity_power_in_timezones", "get_activity_exercise_sets")


def _seed(fake_db, test_crypto):
    fake_db.tables["data_providers"] = [{"id": "prov-1", "user_id": USER, "provider_type": "garmin_unofficial",
                                         "connection_status": "connected", "last_successful_sync_at": None}]
    ciphertext, version = test_crypto.encrypt_str('{"di_token":"x"}')
    fake_db.tables["provider_credentials"] = [{"id": "cred-1", "user_id": USER, "provider_type": "garmin_unofficial",
                                               "credential_kind": "session_tokens", "encrypted_payload": ciphertext,
                                               "key_version": version}]


def _sync(fake_db, test_crypto, settings, api):
    provider = GarminUnofficialProvider(api=api)
    return asyncio.run(sync_user(USER, db=fake_db, crypto=test_crypto, settings=settings,
                                 provider_factory=lambda token_str: provider))


def test_sync_stores_provenance_on_new_activities_and_makes_no_extra_calls(fake_db, test_crypto, test_settings, fake_garmin_api):
    _seed(fake_db, test_crypto)
    res = _sync(fake_db, test_crypto, test_settings, fake_garmin_api)
    assert res["ok"] is True, res["errors"]
    acts = {a["source_record_id"]: a for a in fake_db.tables["activities"]}
    run = acts["19788811001"]["metrics"]
    assert run["garmin"]["type_key"] == "running" and "start_local" in run["garmin"] and "start_gmt" in run["garmin"]
    assert run["garmin"]["stream_rows"] == 1855 and "time" in run["streams"]     # Liste + Details im selben Block
    assert run["detailsVersion"] == 3
    assert acts["19788811003"]["metrics"]["garmin"]["type_key"] == "ice_hockey"
    called = {c[0] for c in fake_garmin_api.calls}
    assert not (called & set(EXTRA_METHODS))                                     # Zusatzabrufe: aus
    assert "activity_provenance" not in res["steps"]                             # nichts nachzutragen
    n_list = sum(1 for c in fake_garmin_api.calls if c[0] == "get_activities_by_date")
    assert n_list == 1


def test_resync_adds_provenance_to_old_rows_and_keeps_the_manual_correction(fake_db, test_crypto, test_settings, fake_garmin_api):
    """Der Kern der Regression: eine Zeile aus der Zeit vor v8-447 mit manueller Dauer-Korrektur
    (341 min → 75 min). Ein erneuter Garmin-Lauf traegt Herkunft und Details nach — Korrektur,
    Quelle (Spalte) und Sportart bleiben."""
    _seed(fake_db, test_crypto)
    _sync(fake_db, test_crypto, test_settings, fake_garmin_api)
    gym = next(a for a in fake_db.tables["activities"] if a["source_record_id"] == "19788811002")
    src = gym["duration_seconds"]
    gym["metrics"] = {"training_load": 61, "detailsFetchedAt": "2026-09-01T00:00:00+00:00", "detailsVersion": 2,
                      "streams": {"heart_rate": [100, 110]},
                      "corrections": {"duration": {"manual": 4500, "source": src, "unit": "s",
                                                   "at": "2026-10-01T18:00:00.000Z", "method": "manual"}},
                      "durationCorrection": {"seconds": 4500}}
    before_calls = len(fake_garmin_api.calls)
    res = _sync(fake_db, test_crypto, test_settings, fake_garmin_api)
    assert res["ok"] is True, res["errors"]
    assert res["steps"]["activity_provenance"] == "ok:1"
    gym = next(a for a in fake_db.tables["activities"] if a["source_record_id"] == "19788811002")
    m = gym["metrics"]
    assert m["corrections"]["duration"]["manual"] == 4500 and m["corrections"]["duration"]["source"] == src
    assert m["durationCorrection"] == {"seconds": 4500}
    assert gym["duration_seconds"] == src and gym["sport_id"] == "gym"           # Quelle unveraendert
    assert m["garmin"]["type_key"] == "strength_training" and m["training_load"] == 61
    assert m["detailsVersion"] == 3 and "time" in m["streams"]                   # einmal nachgeladen
    assert len(fake_db.tables["activities"]) == 3                                # keine Dublette
    assert sum(1 for c in fake_garmin_api.calls[before_calls:] if c[0] == "get_activities_by_date") == 1
    third = _sync(fake_db, test_crypto, test_settings, fake_garmin_api)
    assert "activity_provenance" not in third["steps"]                           # idempotent
    assert third["steps"]["activity_details"].startswith("ok:0 selected:0")


def test_wide_provenance_lookback_is_one_list_call_and_stops_when_done(fake_db, test_crypto, test_settings, fake_garmin_api):
    _seed(fake_db, test_crypto)
    _sync(fake_db, test_crypto, test_settings, fake_garmin_api)
    wide = dataclasses.replace(test_settings, activity_provenance_backfill_days=400)
    n0 = len(fake_garmin_api.calls)
    _sync(fake_db, test_crypto, wide, fake_garmin_api)
    assert sum(1 for c in fake_garmin_api.calls[n0:] if c[0] == "get_activities_by_date") == 1   # nichts fehlt → kein Rueckblick
    fake_db.tables["activities"].append({"id": 999, "user_id": USER, "source": "garmin", "source_record_id": "old-1",
                                         "sport_id": "running", "metrics": {"training_load": 5}})
    n1 = len(fake_garmin_api.calls)
    _sync(fake_db, test_crypto, wide, fake_garmin_api)
    assert sum(1 for c in fake_garmin_api.calls[n1:] if c[0] == "get_activities_by_date") == 2   # genau EIN weiterer Abruf


def test_enabled_extra_that_the_api_cannot_serve_does_not_break_the_sync(fake_db, test_crypto, test_settings, fake_garmin_api):
    _seed(fake_db, test_crypto)
    on = dataclasses.replace(test_settings, detail_extras=("splits",))
    res = _sync(fake_db, test_crypto, on, fake_garmin_api)                       # Attrappe kennt get_activity_splits nicht
    assert res["ok"] is True, res["errors"]
    run = next(a for a in fake_db.tables["activities"] if a["source_record_id"] == "19788811001")["metrics"]
    assert run["ext"]["extras"] == {"splits": "failed"} and "time" in run["streams"]
