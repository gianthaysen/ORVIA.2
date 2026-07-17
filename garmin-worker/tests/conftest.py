"""Test-Infrastruktur: Fixture-Loader, FakeDb, FakeGarminApi.

Alle Tests laufen offline — Garmin und Supabase sind vollständig gemockt;
kein Test öffnet Netzwerkverbindungen.
"""

from __future__ import annotations

import copy
import itertools
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from orvia_worker.db import ON_CONFLICT  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures" / "garmin"


def load_fixture(name: str):
    with open(FIXTURES / name, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def fixture():
    return load_fixture


# ---------------------------------------------------------------------------
# FakeDb — In-Memory-Nachbildung der PostgREST-Verträge aus db.py
# ---------------------------------------------------------------------------

class FakeDb:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {}
        self._ids = itertools.count(1)
        self.jwt_map: dict[str, str] = {}

    def _table(self, name: str) -> list[dict]:
        return self.tables.setdefault(name, [])

    @staticmethod
    def _matches(row: dict, filters: dict | None) -> bool:
        for field, cond in (filters or {}).items():
            value = row.get(field)
            if isinstance(cond, tuple):
                op, v = cond
                if op == "lt":
                    if not (value is not None and str(value) < str(v)):
                        return False
                elif op == "gt":
                    if not (value is not None and str(value) > str(v)):
                        return False
                else:
                    raise AssertionError(f"FakeDb: Operator {op} nicht unterstützt")
            elif cond is None:
                if value is not None:
                    return False
            else:
                if value != cond:
                    return False
        return True

    async def select(self, table, filters=None, columns="*", order=None, limit=None):
        rows = [copy.deepcopy(r) for r in self._table(table) if self._matches(r, filters)]
        if order:
            field, _, direction = order.partition(".")
            rows.sort(key=lambda r: str(r.get(field) or ""),
                      reverse=(direction == "desc"))
        if limit is not None:
            rows = rows[:limit]
        return rows

    async def upsert(self, table, rows, on_conflict=None, returning=False):
        conflict = on_conflict or ON_CONFLICT.get(table)
        assert conflict, f"FakeDb: kein on_conflict für {table}"
        keys = [k.strip() for k in conflict.split(",")]
        stored = []
        for row in rows:
            row = copy.deepcopy(row)
            existing = None
            for r in self._table(table):
                if all(r.get(k) == row.get(k) for k in keys):
                    existing = r
                    break
            if existing is not None:
                existing.update(row)
                stored.append(copy.deepcopy(existing))
            else:
                row.setdefault("id", f"{table}-{next(self._ids)}")
                self._table(table).append(row)
                stored.append(copy.deepcopy(row))
        return stored if returning else []

    async def insert(self, table, rows, returning=False):
        stored = []
        for row in rows:
            row = copy.deepcopy(row)
            row.setdefault("id", f"{table}-{next(self._ids)}")
            self._table(table).append(row)
            stored.append(copy.deepcopy(row))
        return stored if returning else []

    async def update(self, table, filters, patch):
        for r in self._table(table):
            if self._matches(r, filters):
                r.update(copy.deepcopy(patch))

    async def delete(self, table, filters):
        assert filters, "FakeDb: delete ohne Filter"
        self.tables[table] = [
            r for r in self._table(table) if not self._matches(r, filters)
        ]

    async def verify_supabase_jwt(self, user_jwt):
        return self.jwt_map.get(user_jwt)


@pytest.fixture
def fake_db():
    return FakeDb()


# ---------------------------------------------------------------------------
# FakeGarminApi — garminconnect-Methodennamen, Antworten aus Fixtures
# ---------------------------------------------------------------------------

class FakeGarminApi:
    """Liefert für jede Abfrage tiefe Kopien der Fixture-Antworten."""

    def __init__(self, overrides: dict | None = None, failing: set | None = None):
        self._overrides = overrides or {}
        self._failing = failing or set()
        self.calls: list[tuple] = []

    def _get(self, fixture_name: str, method: str):
        self.calls.append((method,))
        if method in self._failing:
            raise RuntimeError(f"simulated failure: {method}")
        if fixture_name in self._overrides:
            return copy.deepcopy(self._overrides[fixture_name])
        return load_fixture(fixture_name)

    def get_devices(self):
        return self._get("devices.json", "get_devices")

    def get_device_last_used(self):
        return self._get("device_last_used.json", "get_device_last_used")

    def get_primary_training_device(self):
        return self._get("primary_training_device.json", "get_primary_training_device")

    def get_full_name(self):
        return "Test Athlet"

    def get_unit_system(self):
        return "metric"

    def get_user_summary(self, d):
        return self._get("user_summary.json", "get_user_summary")

    def get_rhr_day(self, d):
        return self._get("rhr.json", "get_rhr_day")

    def get_hrv_data(self, d):
        return self._get("hrv.json", "get_hrv_data")

    def get_sleep_data(self, d):
        return self._get("sleep.json", "get_sleep_data")

    def get_stress_data(self, d):
        return self._get("stress.json", "get_stress_data")

    def get_body_battery(self, start, end=None):
        return self._get("body_battery.json", "get_body_battery")

    def get_spo2_data(self, d):
        return self._get("spo2.json", "get_spo2_data")

    def get_respiration_data(self, d):
        return self._get("respiration.json", "get_respiration_data")

    def get_floors(self, d):
        return self._get("floors.json", "get_floors")

    def get_intensity_minutes_data(self, d):
        return self._get("intensity.json", "get_intensity_minutes_data")

    def get_training_readiness(self, d):
        return self._get("training_readiness.json", "get_training_readiness")

    def get_daily_weigh_ins(self, d):
        return self._get("weigh_ins.json", "get_daily_weigh_ins")

    def get_body_composition(self, start, end=None):
        return self._get("body_composition.json", "get_body_composition")

    def get_training_status(self, d):
        return self._get("training_status.json", "get_training_status")

    def get_max_metrics(self, d):
        return self._get("max_metrics.json", "get_max_metrics")

    def get_race_predictions(self, *a, **k):
        return self._get("race_predictions.json", "get_race_predictions")

    def get_endurance_score(self, start, end=None):
        return self._get("endurance.json", "get_endurance_score")

    def get_hill_score(self, start, end=None):
        return self._get("hill.json", "get_hill_score")

    def get_running_tolerance(self, start, end, aggregation="weekly"):
        return self._get("running_tolerance.json", "get_running_tolerance")

    def get_lactate_threshold(self, **kwargs):
        return self._get("lactate.json", "get_lactate_threshold")

    def get_cycling_ftp(self):
        return self._get("ftp.json", "get_cycling_ftp")

    def get_fitnessage_data(self, d):
        return self._get("fitness_age.json", "get_fitnessage_data")

    def get_activities_by_date(self, start, end=None, *a, **k):
        return self._get("activities.json", "get_activities_by_date")


@pytest.fixture
def fake_garmin_api():
    return FakeGarminApi()


# ---------------------------------------------------------------------------
# Settings + Crypto für Tests
# ---------------------------------------------------------------------------

@pytest.fixture
def test_settings():
    from cryptography.fernet import Fernet

    from orvia_worker.config import Settings

    return Settings(
        supabase_url="http://supabase.test",
        supabase_service_role_key="service-role-test-key",
        token_encryption_key=Fernet.generate_key().decode(),
        sync_interval_minutes=30,
        sync_backfill_days=2,
        default_timezone="Europe/Vienna",
        allowed_origins=("http://localhost:3000",),
    )


@pytest.fixture
def test_crypto(test_settings):
    from orvia_worker.crypto import TokenCrypto

    return TokenCrypto.from_settings(test_settings)
