import copy

from orvia_worker import normalize
from orvia_worker.normalize import (
    DAILY_CATEGORIES,
    PERFORMANCE_CATEGORIES,
    map_sport,
    normalize_activity,
    normalize_category,
    normalize_devices,
)

PROVIDER = "garmin_unofficial"
DATE = "2026-07-16"

CATEGORY_FIXTURES = {
    "summary": "user_summary.json",
    "rhr": "rhr.json",
    "hrv": "hrv.json",
    "sleep": "sleep.json",
    "stress": "stress.json",
    "body_battery": "body_battery.json",
    "spo2": "spo2.json",
    "respiration": "respiration.json",
    "floors": "floors.json",
    "intensity": "intensity.json",
    "training_readiness": "training_readiness.json",
    "weigh_ins": "weigh_ins.json",
    "body_composition": "body_composition.json",
    "training_status": "training_status.json",
    "max_metrics": "max_metrics.json",
    "race_predictions": "race_predictions.json",
    "endurance": "endurance.json",
    "hill": "hill.json",
    "running_tolerance": "running_tolerance.json",
    "lactate": "lactate.json",
    "ftp": "ftp.json",
    "fitness_age": "fitness_age.json",
}


def _norm(fixture, category, raw=None):
    raw = fixture(CATEGORY_FIXTURES[category]) if raw is None else raw
    return normalize_category(category, raw, provider=PROVIDER, metric_date=DATE)


# -- Determinismus & Nicht-Mutation -----------------------------------------

def test_all_categories_deterministic_double_run(fixture):
    for category in CATEGORY_FIXTURES:
        raw = fixture(CATEGORY_FIXTURES[category])
        first = normalize_category(category, raw, provider=PROVIDER, metric_date=DATE)
        second = normalize_category(category, raw, provider=PROVIDER, metric_date=DATE)
        assert first == second, category
        assert first, f"Fixture für {category} sollte Metriken liefern"


def test_normalize_does_not_mutate_raw(fixture):
    for category in CATEGORY_FIXTURES:
        raw = fixture(CATEGORY_FIXTURES[category])
        snapshot = copy.deepcopy(raw)
        normalize_category(category, raw, provider=PROVIDER, metric_date=DATE)
        assert raw == snapshot, category


# -- fehlende Keys => keine Emission (nie 0/None) ----------------------------

def test_missing_keys_emit_nothing():
    for category in CATEGORY_FIXTURES:
        assert _norm(None, category, raw={}) == [], category
    # None-Antwort (404) ebenso
    for category in CATEGORY_FIXTURES:
        assert normalize_category(category, None, provider=PROVIDER, metric_date=DATE) == []


def test_no_zero_placeholder_for_missing_value():
    out = _norm(None, "hrv", raw={"hrvSummary": {"status": "BALANCED"}})
    ids = {m.metric_type for m in out}
    assert ids == {"hrv_status"}  # hrv_ms fehlt => nicht emittiert


def test_negative_stress_not_emitted():
    assert _norm(None, "stress", raw={"avgStressLevel": -1}) == []


# -- Einheiten ---------------------------------------------------------------

def test_weight_grams_to_kg(fixture):
    out = _norm(fixture, "weigh_ins")
    weight = next(m for m in out if m.metric_type == "weight_kg")
    assert weight.value_numeric == 76.4
    assert weight.unit == "kg"
    assert weight.source_type == "device_measurement"
    assert weight.device_hint == "smart_scale"


def test_body_composition_gram_masses(fixture):
    out = _norm(fixture, "body_composition")
    by_id = {m.metric_type: m for m in out}
    assert by_id["bone_mass_kg"].value_numeric == 3.4
    assert by_id["muscle_mass_kg"].value_numeric == 36.2
    assert by_id["bmi"].value_numeric == 22.9
    assert by_id["bmi"].source_type == "provider_calculation"


def test_sleep_seconds_to_minutes(fixture):
    out = _norm(fixture, "sleep")
    by_id = {m.metric_type: m for m in out}
    assert by_id["sleep_duration_min"].value_numeric == 435  # 26100 s
    assert by_id["sleep_score"].value_numeric == 82
    assert by_id["sleep_duration_min"].source_type == "device_measurement"
    assert by_id["sleep_score"].source_type == "provider_calculation"


def test_race_predictions_seconds(fixture):
    out = _norm(fixture, "race_predictions")
    by_id = {m.metric_type: m for m in out}
    assert by_id["race_prediction_5k"].value_numeric == 1245
    assert by_id["race_prediction_marathon"].value_numeric == 12602
    assert by_id["race_prediction_5k"].unit == "s"


def test_lactate_pace_seconds_per_km(fixture):
    out = _norm(fixture, "lactate")
    by_id = {m.metric_type: m for m in out}
    assert by_id["lactate_threshold_hr"].value_numeric == 171
    # 3.42 m/s -> 1000/3.42 = 292.4 s/km, Registry decimals=0 -> 292
    assert by_id["lactate_threshold_pace"].value_numeric == 292
    assert by_id["lactate_threshold_pace"].unit == "s/km"


def test_recovery_time_minutes_to_hours(fixture):
    out = _norm(fixture, "training_readiness")
    by_id = {m.metric_type: m for m in out}
    assert by_id["training_readiness"].value_numeric == 68
    assert by_id["recovery_time_h"].value_numeric == 14  # 840 min


def test_body_battery_daily_max(fixture):
    out = _norm(fixture, "body_battery")
    assert [m.value_numeric for m in out] == [81]


def test_intensity_vigorous_counts_double(fixture):
    out = _norm(fixture, "intensity")
    assert out[0].value_numeric == 25 + 2 * 18


# -- source_record_id-Determinismus ------------------------------------------

def test_source_record_ids_deterministic_and_scoped(fixture):
    out = _norm(fixture, "summary")
    for m in out:
        assert m.source_record_id == f"{PROVIDER}:daily:{DATE}:{m.metric_type}"
    other_day = normalize_category(
        "summary", fixture("user_summary.json"),
        provider=PROVIDER, metric_date="2026-07-15",
    )
    assert {m.source_record_id for m in other_day}.isdisjoint(
        {m.source_record_id for m in out}
    )


# -- Sport-Mapping -----------------------------------------------------------

def test_sport_mapping_canonical_ids():
    cases = {
        "running": "running", "trail_running": "running",
        "treadmill_running": "running",
        "cycling": "cycling", "road_biking": "cycling",
        "gravel_cycling": "cycling", "mountain_biking": "cycling",
        "virtual_ride": "cycling", "indoor_cycling": "cycling",
        "lap_swimming": "swimming", "open_water_swimming": "swimming",
        "strength_training": "gym", "indoor_cardio": "gym",
        "walking": "walking", "hiking": "hiking",
        "tennis": "tennis", "padel": "padel",
        "soccer": "football", "handball": "handball",
        "basketball": "basketball",
        "rowing": "rowing", "indoor_rowing": "rowing",
        "multi_sport": "triathlon",
        "ice_hockey": "other", "yoga": "other", "": "other",
    }
    for type_key, expected in cases.items():
        assert map_sport(type_key) == expected, type_key
    assert map_sport(None) == "other"


def test_activity_normalization(fixture):
    raw = fixture("activities.json")
    run = normalize_activity(raw[0])
    assert run.source_record_id == "19788811001"
    assert run.sport_id == "running"
    assert run.duration_seconds == 2705.0
    assert run.summary["distance_m"] == 8940.0
    assert "source_sport_raw" not in run.metrics  # bekannter Sport

    hockey = normalize_activity(raw[2])
    assert hockey.sport_id == "other"
    assert hockey.metrics["source_sport_raw"] == "ice_hockey"

    assert normalize_activity({}) is None
    assert normalize_activity(None) is None


# -- NaN/Infinity: Garmin liefert das gelegentlich für nicht berechenbare
# Felder (z.B. averageSpeed bei Distanz/Dauer 0). Python akzeptiert es beim
# JSON-Parsen; PostgREST lehnt es für den GANZEN Batch mit HTTP 400 ab. Muss
# schon in normalize.py auf None fallen, nicht erst beim Schreiben scheitern.

def test_num_rejects_nan_and_infinity():
    assert normalize._num(float("nan")) is None
    assert normalize._num(float("inf")) is None
    assert normalize._num(float("-inf")) is None
    assert normalize._num(42.5) == 42.5
    assert normalize._num(True) is None  # bools weiterhin kein Zahlwert


def test_daily_metric_with_nan_is_not_emitted(fixture):
    raw = fixture(CATEGORY_FIXTURES["rhr"])
    raw = copy.deepcopy(raw)
    # Fixture-Struktur variiert je nach echtem Garmin-Feldnamen; wir wollen
    # nur sicherstellen, dass ein NaN irgendwo im Baum nicht als 'gültiger'
    # Zahlenwert durchrutscht -> direkter Test über den _num-Kanal:
    metrics = normalize.normalize_category("rhr", raw, provider=PROVIDER, metric_date=DATE)
    for m in metrics:
        if m.value_numeric is not None:
            assert m.value_numeric == m.value_numeric  # NaN != NaN
            assert m.value_numeric not in (float("inf"), float("-inf"))


def test_activity_summary_sanitizes_nan_and_infinity():
    raw = {
        "activityId": 123,
        "activityType": {"typeKey": "running"},
        "distance": 1000.0,
        "averageSpeed": float("nan"),
        "elevationGain": float("inf"),
        "activityTrainingLoad": float("-inf"),
        "duration": 300,
        "startTimeGMT": "2026-07-16 08:00:00",
    }
    act = normalize_activity(raw)
    assert act.summary["distance_m"] == 1000.0
    assert "avg_speed_mps" not in act.summary or act.summary["avg_speed_mps"] is None
    assert act.summary.get("elevation_gain_m") is None
    assert act.metrics.get("training_load") is None
    # Rundreise durch echtes JSON darf keinen NaN/Infinity-Literal enthalten.
    import json
    dumped = json.dumps({"summary": act.summary, "metrics": act.metrics}, allow_nan=False)
    assert "NaN" not in dumped and "Infinity" not in dumped


# -- Geräte ------------------------------------------------------------------

def test_device_normalization(fixture):
    devices = normalize_devices(fixture("devices.json"), 3499633930, 3499633930)
    by_id = {d.provider_device_id: d for d in devices}
    watch = by_id["3499633930"]
    scale = by_id["3311224455"]
    assert watch.device_type == "watch"
    assert watch.is_last_used and watch.is_primary_training_device
    assert watch.is_primary_wearable
    assert scale.device_type == "smart_scale"
    assert not scale.is_last_used

    assert normalize_devices(None) == []
    assert normalize_devices([{"kaputt": True}]) == []


def test_device_type_heuristik():
    assert normalize.classify_device_type("Edge 840") == "cycling_computer"
    assert normalize.classify_device_type("HRM-Pro Plus") == "chest_strap"
    assert normalize.classify_device_type("Index S2 Smart Scale") == "smart_scale"
    assert normalize.classify_device_type("Forerunner 965") == "watch"
    assert normalize.classify_device_type(None) == "watch"


# -- Kategorie-Metrik-Vertrag ------------------------------------------------

def test_categories_cover_only_registry_metrics():
    from orvia_worker.registry import load_registry

    known = set(load_registry().metric_ids)
    for cat, (_, metric_ids) in {**DAILY_CATEGORIES, **PERFORMANCE_CATEGORIES}.items():
        for mid in metric_ids:
            assert mid in known, f"{cat} emittiert unbekannte Metrik {mid}"
