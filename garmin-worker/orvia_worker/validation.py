"""Metrik-Validierung nach Registry-Grenzen (Design §5). Pure Funktionen.

Regeln:
- außerhalb plausible[min,max]  -> validity='invalid'  + Anomalie out_of_range
- |delta| > jumpMax * Tagesfaktor -> validity='suspect' + Anomalie implausible_jump
  (Tagesfaktor = max(1, Tage), gedeckelt bei 7 — lange Lücken erlauben nicht
  beliebige Sprünge)
- sonst 'valid'.

Text-Metriken und Metriken ohne Grenzen sind immer 'valid'.
"""

from __future__ import annotations

from .providers.base import NormalizedMetric
from .registry import load_registry

JUMP_DAYS_CAP = 7


def validate_metric(
    metric: NormalizedMetric,
    last_valid_value: float | None = None,
    days_between: float | None = None,
) -> tuple[str, dict | None]:
    """-> (validity, anomaly|None).

    anomaly: {"anomaly_type", "severity", "previous_value", "new_value", "detail"}
    passend zu metric_anomalies (0019).
    """
    spec = load_registry().get(metric.metric_type)
    value = metric.value_numeric

    if spec is None or value is None:
        # Unbekannte Metrik wird vom Sync gar nicht emittiert; Text-Werte
        # haben keine numerischen Grenzen.
        return "valid", None

    plausible = spec.get("plausible")
    if isinstance(plausible, (list, tuple)) and len(plausible) == 2:
        lo, hi = plausible
        if value < lo or value > hi:
            return "invalid", {
                "anomaly_type": "out_of_range",
                "severity": "warning",
                "previous_value": last_valid_value,
                "new_value": value,
                "detail": {"plausible": [lo, hi], "unit": spec.get("unit")},
            }

    jump_max = spec.get("jumpMax")
    if jump_max is not None and last_valid_value is not None:
        days = days_between if days_between is not None and days_between > 0 else 1.0
        factor = max(1.0, min(float(days), float(JUMP_DAYS_CAP)))
        allowed = float(jump_max) * factor
        delta = abs(value - last_valid_value)
        if delta > allowed:
            return "suspect", {
                "anomaly_type": "implausible_jump",
                "severity": "warning",
                "previous_value": last_valid_value,
                "new_value": value,
                "detail": {
                    "jump_max": jump_max,
                    "days_between": days,
                    "allowed_delta": allowed,
                    "observed_delta": delta,
                    "unit": spec.get("unit"),
                },
            }

    return "valid", None
