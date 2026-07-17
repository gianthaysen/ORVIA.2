from orvia_worker.providers.base import NormalizedMetric
from orvia_worker.registry import daily_record_id
from orvia_worker.validation import validate_metric


def _metric(metric_type, value, date="2026-07-16"):
    return NormalizedMetric(
        metric_type=metric_type,
        value_numeric=value,
        metric_date=date,
        source_type="device_measurement",
        source_record_id=daily_record_id("garmin_unofficial", date, metric_type),
    )


def test_rhr_220_invalid_out_of_range():
    validity, anomaly = validate_metric(_metric("resting_hr", 220))
    assert validity == "invalid"
    assert anomaly["anomaly_type"] == "out_of_range"
    assert anomaly["new_value"] == 220


def test_weight_minus_5kg_per_day_suspect():
    # jumpMax 3 kg/Tag; 76 -> 71 an einem Tag = 5 kg Sprung
    validity, anomaly = validate_metric(
        _metric("weight_kg", 71.0), last_valid_value=76.0, days_between=1
    )
    assert validity == "suspect"
    assert anomaly["anomaly_type"] == "implausible_jump"
    assert anomaly["previous_value"] == 76.0


def test_vo2max_50_to_68_suspect():
    validity, anomaly = validate_metric(
        _metric("vo2max_running", 68.0), last_valid_value=50.0, days_between=1
    )
    assert validity == "suspect"
    assert anomaly["anomaly_type"] == "implausible_jump"


def test_normal_values_valid():
    assert validate_metric(_metric("resting_hr", 47))[0] == "valid"
    assert validate_metric(
        _metric("weight_kg", 76.2), last_valid_value=76.4, days_between=1
    ) == ("valid", None)
    assert validate_metric(
        _metric("vo2max_running", 52.0), last_valid_value=51.0, days_between=3
    ) == ("valid", None)


def test_jump_scales_with_days_but_capped_at_7():
    # 14 Tage Lücke: erlaubt bleibt 3*7=21, nicht 3*14=42
    validity, _ = validate_metric(
        _metric("weight_kg", 100.0), last_valid_value=70.0, days_between=14
    )
    assert validity == "suspect"
    # innerhalb der 7-Tage-Deckelung erlaubt
    validity, anomaly = validate_metric(
        _metric("weight_kg", 90.0), last_valid_value=70.0, days_between=14
    )
    assert (validity, anomaly) == ("valid", None)


def test_no_jump_check_without_previous_value():
    assert validate_metric(_metric("weight_kg", 76.0)) == ("valid", None)


def test_metric_without_jump_max_never_jump_suspect():
    # steps hat jumpMax null
    assert validate_metric(
        _metric("steps", 45000), last_valid_value=2000, days_between=1
    ) == ("valid", None)


def test_text_metric_valid():
    m = NormalizedMetric(
        metric_type="hrv_status",
        value_text="BALANCED",
        metric_date="2026-07-16",
        source_type="provider_calculation",
        source_record_id="garmin_unofficial:daily:2026-07-16:hrv_status",
    )
    assert validate_metric(m) == ("valid", None)


def test_boundary_values_are_valid():
    assert validate_metric(_metric("resting_hr", 110))[0] == "valid"
    assert validate_metric(_metric("resting_hr", 25))[0] == "valid"
    assert validate_metric(_metric("resting_hr", 24))[0] == "invalid"
