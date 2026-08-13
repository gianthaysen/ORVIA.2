"""Vertragstests: on_conflict-Strings gegen 0019-SQL + sync_user-Durchlauf."""

import asyncio
import re
from pathlib import Path

import pytest

from orvia_worker.db import ON_CONFLICT
from orvia_worker.providers.garmin_unofficial import GarminUnofficialProvider
from orvia_worker.sync import sync_user

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "app" / "supabase" / "migrations" / "0019_provider_metrics_foundation.sql"
)

USER = "00000000-0000-0000-0000-000000000001"


# ---------------------------------------------------------------------------
# 1) on_conflict-Verträge == Kommentarblock in 0019
# ---------------------------------------------------------------------------

def test_on_conflict_matches_migration_comment_block():
    if not MIGRATION.exists():
        pytest.skip(f"0019-Migration nicht verfügbar unter {MIGRATION}")
    text = MIGRATION.read_text(encoding="utf-8")
    # Kommentarblock: '--    <tabelle>   (col, col, ...)' [optional ' [partial]']
    pattern = re.compile(r"^--\s+(\w+)\s+\(([^)]+)\)(?:\s*\[partial\])?\s*$", re.M)
    from_sql = {}
    for table, cols in pattern.findall(text):
        from_sql[table] = ",".join(c.strip() for c in cols.split(","))
    assert from_sql, "Kommentarblock in 0019 nicht gefunden — Format geändert?"
    assert from_sql == ON_CONFLICT


def test_on_conflict_matches_unique_indexes_in_sql():
    if not MIGRATION.exists():
        pytest.skip(f"0019-Migration nicht verfügbar unter {MIGRATION}")
    text = MIGRATION.read_text(encoding="utf-8")
    idx_pattern = re.compile(
        r"create unique index if not exists \w+\s*\n?\s*on public\.(\w+)\s*\(([^)]+)\)",
        re.I,
    )
    indexes = {
        table: ",".join(c.strip() for c in cols.split(","))
        for table, cols in idx_pattern.findall(text)
    }
    for table, conflict in ON_CONFLICT.items():
        assert indexes.get(table) == conflict, (
            f"{table}: on_conflict '{conflict}' hat keinen passenden "
            f"Unique-Index in 0019 ({indexes.get(table)})"
        )


# ---------------------------------------------------------------------------
# 2) sync_user gegen FakeDb + Fixture-Provider
# ---------------------------------------------------------------------------

def _seed(fake_db, test_crypto):
    fake_db.tables["data_providers"] = [{
        "id": "prov-1",
        "user_id": USER,
        "provider_type": "garmin_unofficial",
        "connection_status": "connected",
        "last_successful_sync_at": None,
    }]
    ciphertext, version = test_crypto.encrypt_str('{"di_token":"x"}')
    fake_db.tables["provider_credentials"] = [{
        "id": "cred-1",
        "user_id": USER,
        "provider_type": "garmin_unofficial",
        "credential_kind": "session_tokens",
        "encrypted_payload": ciphertext,
        "key_version": version,
    }]


def _run_sync(fake_db, test_crypto, test_settings, api):
    provider = GarminUnofficialProvider(api=api)
    return asyncio.run(sync_user(
        USER,
        db=fake_db,
        crypto=test_crypto,
        settings=test_settings,
        provider_factory=lambda token_str: provider,
    ))


def test_sync_writes_expected_rows(fake_db, test_crypto, test_settings, fake_garmin_api):
    _seed(fake_db, test_crypto)
    result = _run_sync(fake_db, test_crypto, test_settings, fake_garmin_api)
    assert result["ok"] is True, result["errors"]

    # Geräte
    devices = fake_db.tables["connected_devices"]
    assert {d["provider_device_id"] for d in devices} == {"3499633930", "3311224455"}
    assert all(d["provider_id"] == "prov-1" for d in devices)

    # Metriken: Fixtures liefern u.a. diese IDs, je Tag ein Singleton
    metrics = fake_db.tables["user_metrics"]
    ids = {m["metric_type"] for m in metrics}
    for expected in ("steps", "resting_hr", "hrv_ms", "sleep_duration_min",
                     "weight_kg", "vo2max_running", "ftp_watts",
                     "race_prediction_5k", "training_readiness", "body_battery"):
        assert expected in ids, expected
    # source_record_id-Vertrag und Validity gesetzt
    for m in metrics:
        assert m["source_record_id"].startswith("garmin_unofficial:daily:")
        assert m["validity"] in ("valid", "suspect", "invalid")
        assert not (m["value_numeric"] is None and m["value_text"] is None)

    # Waagen-Metrik hängt am smart_scale-Gerät
    scale_id = next(d["id"] for d in devices if d["device_type"] == "smart_scale")
    weight_rows = [m for m in metrics if m["metric_type"] == "weight_kg"]
    assert weight_rows and all(m["device_id"] == scale_id for m in weight_rows)

    # Aktivitäten: 3 Fixture-Aktivitäten, Sport-Mapping + Rohtyp-Erhalt
    acts = fake_db.tables["activities"]
    assert len(acts) == 3
    by_rec = {a["source_record_id"]: a for a in acts}
    assert by_rec["19788811001"]["sport_id"] == "running"
    assert by_rec["19788811002"]["sport_id"] == "gym"
    assert by_rec["19788811003"]["sport_id"] == "other"
    assert by_rec["19788811003"]["metrics"]["source_sport_raw"] == "ice_hockey"
    # Testkorrektur 2026-08-12: die Erwartung stand auf 'final'. Diesen Wert
    # gab es im Enum nie — supabase/migrations/0009_canonical_activities.sql
    # erlaubt per activities_status_chk ausschliesslich
    # ('completed','aborted','cancelled','planned'). sync.py schreibt seit der
    # Live-Verifikation vom 2026-07-17 korrekt 'completed' (siehe Kommentar
    # dort); nur diese Erwartung wurde damals nicht mitgezogen.
    # KEINE Produktaenderung — haette man umgekehrt sync.py auf 'final'
    # gezogen, waere jeder Aktivitaets-Insert am CHECK gescheitert.
    assert all(a["source"] == "garmin" and a["status"] == "completed" for a in acts)
    assert by_rec["19788811001"]["ended_at"] == "2026-07-16 16:48:05"

    # Capabilities beobachtet
    caps = fake_db.tables["device_capabilities"]
    cap_status = {(c["device_id"], c["metric_type"]): c["capability_status"] for c in caps}
    watch_id = next(d["id"] for d in devices if d["device_type"] == "watch")
    assert cap_status[(watch_id, "resting_hr")] == "observed"
    assert cap_status[(scale_id, "weight_kg")] == "observed"

    # Providerstatus ehrlich gepflegt
    prov = fake_db.tables["data_providers"][0]
    assert prov["connection_status"] == "connected"
    assert prov["last_successful_sync_at"] is not None
    assert prov["last_error_code"] is None


def test_second_run_is_idempotent(fake_db, test_crypto, test_settings, fake_garmin_api):
    _seed(fake_db, test_crypto)
    first = _run_sync(fake_db, test_crypto, test_settings, fake_garmin_api)
    assert first["ok"] is True
    metric_count = len(fake_db.tables["user_metrics"])
    activity_count = len(fake_db.tables["activities"])
    device_count = len(fake_db.tables["connected_devices"])
    anomaly_count = len(fake_db.tables.get("metric_anomalies", []))

    second = _run_sync(fake_db, test_crypto, test_settings, fake_garmin_api)
    assert second["ok"] is True
    # Gleiche source_record_ids -> keine Doppel-Emission
    assert len(fake_db.tables["user_metrics"]) == metric_count
    assert len(fake_db.tables["activities"]) == activity_count
    assert len(fake_db.tables["connected_devices"]) == device_count
    assert len(fake_db.tables.get("metric_anomalies", [])) == anomaly_count

    records = [m["source_record_id"] for m in fake_db.tables["user_metrics"]]
    assert len(records) == len(set(records)), "source_record_id nicht eindeutig"


def test_partial_failure_isolated_and_reported(
    fake_db, test_crypto, test_settings
):
    from conftest import FakeGarminApi

    _seed(fake_db, test_crypto)
    api = FakeGarminApi(failing={"get_sleep_data", "get_cycling_ftp"})
    result = _run_sync(fake_db, test_crypto, test_settings, api)

    # Fehlgeschlagene Kategorien brechen den Lauf nicht ab …
    ids = {m["metric_type"] for m in fake_db.tables["user_metrics"]}
    assert "steps" in ids and "resting_hr" in ids
    assert "sleep_duration_min" not in ids
    assert "ftp_watts" not in ids
    # … aber der Status ist ehrlich: nicht ok, Fehlercode gesetzt
    assert result["ok"] is False
    assert any(e.startswith("sleep:") for e in result["errors"])
    prov = fake_db.tables["data_providers"][0]
    assert prov["last_error_code"] is not None
    assert prov.get("last_successful_sync_at") is None


def test_missing_tokens_fail_closed(fake_db, test_crypto, test_settings, fake_garmin_api):
    fake_db.tables["data_providers"] = [{
        "id": "prov-1",
        "user_id": USER,
        "provider_type": "garmin_unofficial",
        "connection_status": "connected",
    }]
    result = _run_sync(fake_db, test_crypto, test_settings, fake_garmin_api)
    assert result["ok"] is False
    prov = fake_db.tables["data_providers"][0]
    assert prov["connection_status"] == "reauth_required"
    assert prov["reauthentication_required"] is True
    assert fake_db.tables.get("user_metrics", []) == []
