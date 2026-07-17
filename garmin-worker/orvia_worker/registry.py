"""Zugriff auf den generierten kanonischen Metrik-Katalog.

Quelle: orvia_worker/metric_registry.json — GENERIERT aus
app/js/metrics/metric-registry.js (`node app/js/metrics/export-registry.mjs`).
Nicht von Hand editieren; bei Katalogänderungen neu exportieren.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

REGISTRY_PATH = Path(__file__).parent / "metric_registry.json"


class MetricRegistry:
    def __init__(self, data: dict) -> None:
        self._data = data
        self.schema_version: int = data.get("schemaVersion", 0)
        self.source_priority: dict[str, int] = dict(data.get("sourcePriority", {}))
        self.by_id: dict[str, dict] = {m["id"]: m for m in data.get("metrics", [])}

    @property
    def metric_ids(self) -> list[str]:
        return list(self.by_id.keys())

    def get(self, metric_id: str) -> dict | None:
        return self.by_id.get(metric_id)


@lru_cache(maxsize=1)
def load_registry(path: str | None = None) -> MetricRegistry:
    """Lädt den Katalog genau einmal pro Prozess."""
    p = Path(path) if path else REGISTRY_PATH
    with open(p, encoding="utf-8") as f:
        return MetricRegistry(json.load(f))


def daily_record_id(provider: str, metric_date: str, metric_id: str) -> str:
    """Deterministische source_record_id für Tages-Singleton-Metriken.

    Vertrag mit Migration 0019 (Kommentar am partiellen Unique-Index):
    '<provider>:daily:<datum>:<metric>' — NICHT ändern ohne Migration.
    """
    return f"{provider}:daily:{metric_date}:{metric_id}"
