"""GM7.4 · Begrenzter, idempotenter Activity-Details-Backfill.

Leitplanken (Design):
  * nur NEUE bzw. ausdrücklich ausgewählte, noch nicht detaillierte Aktivitäten,
  * gedeckelt (`limit`) — KEIN unbeschränkter historischer Vollabruf,
  * bereits detaillierte werden NIE erneut geladen (Idempotenz über `already_detailed`),
  * Retry mit Begrenzung (`max_retries`) bei transienten Fehlern (Rate-Limit/Unavailable),
    optionaler `on_rate_limit`-Hook (z.B. Backoff/Sleep — injizierbar, testbar),
  * Teilfehler überspringen statt Gesamtabbruch (`failed`-Liste).

Der eigentliche Garmin-Aufruf ist als `fetch_details(activity_id)` injiziert — im
Betrieb der Provider (`get_activity_details`), im Test das Fixture. Speicherung
erfolgt außerhalb über `series_normalize.build_activity_metrics` → activities.metrics
(jsonb, cloud-synchron) bzw. für Serien über `build_series_rows` → user_metric_series.
"""

from __future__ import annotations

from typing import Any, Callable

from .activity_details import select_activities_needing_details
from .providers.base import ProviderUnavailable, RateLimited
from .series_normalize import parse_activity_details

_TRANSIENT = (RateLimited, ProviderUnavailable)


def backfill_activity_details(
    candidate_ids: Any,
    already_detailed: Any,
    fetch_details: Callable[[str], Any],
    *,
    limit: int,
    max_retries: int = 2,
    on_rate_limit: Callable[[int], None] | None = None,
) -> dict:
    """Wählt bounded/idempotent aus, ruft je Aktivität EINMAL erfolgreich ab
    (mit begrenztem Retry auf transiente Fehler), parst die Detailstruktur und
    gibt {selected, details:{id→parsed}, failed:[ids]} zurück."""
    selected = select_activities_needing_details(candidate_ids, already_detailed, limit)
    details: dict[str, Any] = {}
    failed: list[str] = []
    for aid in selected:
        raw = None
        attempt = 0
        while True:
            try:
                raw = fetch_details(aid)
                break
            except _TRANSIENT:
                attempt += 1
                if attempt > max_retries:
                    raw = None
                    break
                if on_rate_limit is not None:
                    on_rate_limit(attempt)
            except Exception:
                # nicht-transienter Fehler bei genau dieser Aktivität → überspringen,
                # NICHT den ganzen Backfill abbrechen.
                raw = None
                break
        if raw is None:
            failed.append(aid)
            continue
        details[aid] = parse_activity_details(raw)
    return {"selected": selected, "details": details, "failed": failed}
