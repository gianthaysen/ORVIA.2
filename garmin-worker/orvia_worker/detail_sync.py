"""GM7.4 · Verdrahtung von Details-Backfill + Serien-Upsert in die Sync-Kette.

Bindet die reinen Bausteine (backfill_activity_details, series_normalize) an die
DB an. Leitplanken:
  * Aktivitätsdetails nur für noch NICHT detaillierte Aktivitäten (kein route in
    metrics) — bounded (`limit`), idempotent, Route/Streams verlustfrei in
    activities.metrics (jsonb) gemerged;
  * Serien idempotent nach user_metric_series (Dedupe user_id+metric_type+
    metric_date via ON_CONFLICT, Migration 0028);
  * fehlt user_metric_series (noch nicht migriert): KONTROLLIERTER Zustand
    (skipped) statt Endlosschleife/stillem Verlust;
  * Teilfehler brechen den übrigen Sync nicht ab (in backfill isoliert).
KEINE Engine-Berührung; kein Remote-Deploy.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

from .backfill import backfill_activity_details
from .series_normalize import (
    build_activity_metrics,
    build_series_rows,
    normalize_sleep_series,
    normalize_stress_series,
)

# Marker für "Tabelle fehlt" (PostgREST/Postgres) — fail-closed statt Loop.
_MISSING_TABLE_MARKERS = ("does not exist", "42P01", "PGRST205", "could not find the table")

# GM7.4.1 · Detailvollständigkeitsvertrag: aktuelle Version des Detail-Merge-
# Kontrakts. Erhöhen, falls sich Feldbedeutung/Parser-Semantik künftig ändert
# und Altbestand kontrolliert erneut angereichert werden soll.
DETAILS_CONTRACT_VERSION = 1


def _details_complete(metrics: Any) -> bool:
    """GM7.4.1-Fix: Vollständigkeits-Signal NICHT mehr an metrics.route gekoppelt.
    Befund: `route`-Präsenz ist weder hinreichend noch notwendig für "Details
    bereits geladen" — (a) eine Indoor-/GPS-lose Garmin-Aktivität hat NIE eine
    Route, obwohl get_activity_details für sie bereits erfolgreich Streams
    geliefert haben kann (route-basiert hätte sie bei JEDEM Sync erneut
    abgerufen — Idempotenz-Bruch); (b) jede Aktivität, die aus irgendeinem
    Pfad außerhalb von get_activity_details bereits eine Route trägt (z.B. ein
    künftiger Direktschreibpfad), würde route-basiert fälschlich als fertig
    übersprungen — ihre HF-/Kadenz-/Höhen-Streams blieben für immer ungeladen.
    Stattdessen ein expliziter Abschluss-Marker, gesetzt NUR nach einem
    tatsächlich erfolgreichen get_activity_details-Merge für GENAU diese
    Aktivität — unabhängig vom Inhalt der Antwort (auch eine routenlose,
    streamlose Antwort zählt als "abgefragt")."""
    return isinstance(metrics, dict) and bool(metrics.get("detailsFetchedAt"))


async def sync_activity_details(
    db, user_id: str, get_details: Callable[[str], Any], *, limit: int, max_retries: int = 2,
    on_rate_limit: Callable[[int], None] | None = None,
) -> dict:
    """Bounded, idempotenter Details-Backfill: nur Aktivitäten OHNE metrics.route
    werden detailliert; Ergebnis verlustfrei in activities.metrics gemerged."""
    acts = await db.select("activities", {"user_id": user_id, "source": "garmin"})
    candidates = [a.get("source_record_id") for a in acts if a.get("source_record_id")]
    already = [a["source_record_id"] for a in acts if _details_complete(a.get("metrics"))]
    by_id = {a.get("source_record_id"): a for a in acts}

    plan = backfill_activity_details(
        candidates, already, get_details, limit=limit, max_retries=max_retries,
        on_rate_limit=on_rate_limit,
    )
    updated = 0
    for aid, parsed in plan["details"].items():
        act = by_id.get(aid) or {}
        merged = build_activity_metrics(act.get("metrics"), parsed)
        # GM7.4.1: Abschluss-Marker NUR nach einem tatsächlich erfolgreichen,
        # gemergten Abruf setzen — nie bei einem Fehlschlag (siehe `failed`).
        merged["detailsFetchedAt"] = datetime.now(timezone.utc).isoformat()
        merged["detailsVersion"] = DETAILS_CONTRACT_VERSION
        await db.update(
            "activities",
            {"user_id": user_id, "source": "garmin", "source_record_id": aid},
            {"metrics": merged},
        )
        updated += 1
    return {"selected": plan["selected"], "updated": updated, "failed": plan["failed"]}


async def sync_day_series(
    db, user_id: str, provider_id, metric_date: str, timezone: str,
    *, sleep_raw: Any = None, stress_raw: Any = None,
) -> dict:
    """Normalisiert Schlaf-/Stress-Rohantworten zu Serien und upsertet sie
    idempotent nach user_metric_series. Fehlt die Tabelle: kontrolliert skipped."""
    rows: list[dict] = []
    if isinstance(sleep_raw, dict):
        rows += build_series_rows(user_id, provider_id, metric_date, timezone,
                                  normalize_sleep_series(sleep_raw))
    if isinstance(stress_raw, dict):
        rows += build_series_rows(user_id, provider_id, metric_date, timezone,
                                  normalize_stress_series(stress_raw))
    if not rows:
        return {"upserted": 0, "series": 0}
    try:
        await db.upsert("user_metric_series", rows, on_conflict="user_id,metric_type,metric_date")
    except Exception as e:  # noqa: BLE001 — gezielt auf "Tabelle fehlt" prüfen
        msg = str(e).lower()
        if any(m in msg for m in _MISSING_TABLE_MARKERS):
            return {"upserted": 0, "series": len(rows), "skipped": "user_metric_series_missing"}
        raise
    return {"upserted": len(rows), "series": len(rows)}
