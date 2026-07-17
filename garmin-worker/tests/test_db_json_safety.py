"""_strict_json_bytes: NaN/Infinity müssen VOR dem Request laut scheitern,
nicht als stilles HTTP 400 bei PostgREST (das den Batch komplett ablehnt,
ohne dass wir den Grund loggen dürfen — siehe db.py-Kommentar).

Live-Vorfall (2026-07-17): garmin-worker-Sync schlug bei user_metrics UND
activities mit HTTP 400 fehl, ohne Detailmeldung. Ursache: Garmins Rohdaten
enthielten einen nicht-endlichen Float (z.B. averageSpeed bei Distanz 0),
der über normalize.py ungeprüft bis in den PostgREST-Request durchreichte.
"""

from __future__ import annotations

import json

import pytest

from orvia_worker.db import DbError, _strict_json_bytes


def test_finite_rows_serialize_normally():
    rows = [{"a": 1, "b": 2.5, "c": None, "d": "text"}]
    body = _strict_json_bytes(rows, context="upsert user_metrics")
    assert json.loads(body) == rows


def test_nan_raises_clear_dberror_without_leaking_value():
    rows = [{"user_id": "u1", "metric_type": "resting_hr", "value_numeric": float("nan")}]
    with pytest.raises(DbError) as exc:
        _strict_json_bytes(rows, context="upsert user_metrics")
    msg = str(exc.value)
    assert "value_numeric" in msg
    assert "upsert user_metrics" in msg
    # Der eigentliche (kaputte) Wert darf nicht im Fehlertext auftauchen.
    assert "nan" not in msg.lower()


def test_infinity_raises_clear_dberror():
    rows = [{"metric_type": "vo2max_running", "value_numeric": float("inf")}]
    with pytest.raises(DbError) as exc:
        _strict_json_bytes(rows, context="insert activities")
    assert "value_numeric" in str(exc.value)


def test_second_row_nan_still_detected():
    rows = [
        {"metric_type": "steps", "value_numeric": 100.0},
        {"metric_type": "hrv_ms", "value_numeric": float("-inf")},
    ]
    with pytest.raises(DbError):
        _strict_json_bytes(rows, context="upsert user_metrics")
