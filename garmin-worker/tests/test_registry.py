from orvia_worker.registry import daily_record_id, load_registry


def test_registry_loads_metrics():
    reg = load_registry()
    assert reg.schema_version == 1
    assert len(reg.metric_ids) >= 40
    # Stichproben aus dem kanonischen Katalog
    for metric_id in ("weight_kg", "resting_hr", "hrv_ms", "vo2max_running",
                      "sleep_duration_min", "training_readiness"):
        assert reg.get(metric_id) is not None, metric_id


def test_registry_spec_shape():
    spec = load_registry().get("weight_kg")
    assert spec["unit"] == "kg"
    assert spec["plausible"] == [30, 250]
    assert spec["jumpMax"] == 3
    assert spec["dailySingleton"] is True


def test_source_priority_present():
    prio = load_registry().source_priority
    assert prio["device_measurement"] > prio["provider_calculation"]
    assert prio["lab_test"] == 100


def test_daily_record_id_contract():
    # Vertrag aus 0019: '<provider>:daily:<datum>:<metric>'
    assert (
        daily_record_id("garmin_unofficial", "2026-07-17", "vo2max_running")
        == "garmin_unofficial:daily:2026-07-17:vo2max_running"
    )


def test_daily_record_id_deterministic():
    a = daily_record_id("garmin_unofficial", "2026-07-16", "steps")
    b = daily_record_id("garmin_unofficial", "2026-07-16", "steps")
    assert a == b
