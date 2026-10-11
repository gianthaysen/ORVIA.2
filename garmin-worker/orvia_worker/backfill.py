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
from .providers.base import (
    AuthError,
    MfaRequired,
    NotFound,
    ProviderUnavailable,
    RateLimited,
    Unsupported,
)
from .series_normalize import parse_activity_details

# ---------------------------------------------------------------------------
# v8-447.1 · Fehlerklassen des Nachladens
# ---------------------------------------------------------------------------
# Bis v8-447 gab es zwei Sorten: "voruebergehend" (Rate-Limit, nicht erreichbar) und "alles
# andere". Das reichte nicht: ein 404 kam als "nicht erreichbar" an (also voruebergehend, nie
# zurueckgestellt), ein Anmeldefehler als "alles andere" (also der Aktivitaet angelastet —
# eine abgelaufene Sitzung haette nach und nach den ganzen Bestand zurueckgestellt), und
# nach einem 429 wurde ohne Pause weitergefragt.
#
#   AUTH         Sitzung ungueltig          betrifft ALLES   → Lauf sofort beenden
#   RATE_LIMIT   Garmin bremst (429)        betrifft ALLES   → Lauf sofort beenden
#   NETWORK      nicht erreichbar / 5xx     voruebergehend   → nach 2 in Folge Lauf beenden
#   NOT_FOUND    Garmin kennt sie nicht     diese Aktivitaet → zaehlt
#   UNSUPPORTED  Anfrage abgelehnt (4xx)    diese Aktivitaet → zaehlt
#   MALFORMED    Antwort unlesbar           diese Aktivitaet → zaehlt
#   PERSISTENCE  Speichern fehlgeschlagen   unsere Seite     → zaehlt nicht
#   UNKNOWN      nicht einzuordnen          unklar           → zaehlt nur, wenn im selben
#                                                              Lauf eine andere gelang
FAILURE_CATEGORIES = ("AUTH", "RATE_LIMIT", "NOT_FOUND", "UNSUPPORTED", "NETWORK", "MALFORMED", "PERSISTENCE", "UNKNOWN")
ABORT_RUN = ("AUTH", "RATE_LIMIT")
ACTIVITY_SPECIFIC = ("NOT_FOUND", "UNSUPPORTED", "MALFORMED")
NETWORK_ABORT_AFTER = 2


def classify_failure(exc: BaseException) -> str:
    """Ausnahme → Fehlerklasse. Nach der KLASSE der Ausnahme, nie nach ihrem Text."""
    if isinstance(exc, (AuthError, MfaRequired)):
        return "AUTH"
    if isinstance(exc, RateLimited):
        return "RATE_LIMIT"
    if isinstance(exc, NotFound):
        return "NOT_FOUND"
    if isinstance(exc, Unsupported):
        return "UNSUPPORTED"
    if isinstance(exc, (ProviderUnavailable, TimeoutError, ConnectionError)):
        return "NETWORK"
    return "UNKNOWN"


def backfill_activity_details(
    candidate_ids: Any,
    already_detailed: Any,
    fetch_details: Callable[[str], Any],
    *,
    limit: int,
    max_retries: int = 2,
    on_rate_limit: Callable[[int], None] | None = None,
) -> dict:
    """Wählt bounded/idempotent aus, ruft je Aktivität ab, parst die Detailstruktur.

    Rueckgabe:
      selected        ausgewaehlte IDs (hoechstens `limit`)
      details         {id → geparst} der gelungenen
      failed          IDs, bei denen der Abruf scheiterte (in Reihenfolge)
      failures        {id → Fehlerklasse}
      failed_transient  die davon, die NICHT der Aktivitaet anzulasten sind
      aborted         Fehlerklasse, die den Lauf beendet hat — oder None
      not_attempted   ausgewaehlt, aber wegen Abbruch nicht mehr angefragt

    Wiederholungen: NUR wenn `on_rate_limit` (eine Wartefunktion) uebergeben ist, wird ein
    voruebergehender Fehler bis zu `max_retries`-mal wiederholt. Ohne Wartefunktion — so
    laeuft der Betrieb — gibt es keine sofortige Wiederholung: die Bibliothek wiederholt
    Serverfehler selbst mit Pause, und auf ein 429 antwortet man nicht mit der naechsten Anfrage.
    """
    selected = select_activities_needing_details(candidate_ids, already_detailed, limit)
    details: dict[str, Any] = {}
    failed: list[str] = []
    failures: dict[str, str] = {}
    aborted: str | None = None
    not_attempted: list[str] = []
    network_streak = 0
    for pos, aid in enumerate(selected):
        if aborted is not None:
            not_attempted = list(selected[pos:])
            break
        raw = None
        category: str | None = None
        attempt = 0
        while True:
            try:
                raw = fetch_details(aid)
                category = None
                break
            except Exception as e:  # noqa: BLE001 — jede Ausnahme wird eingeordnet, keine geht verloren
                category = classify_failure(e)
                if category in ("RATE_LIMIT", "NETWORK") and on_rate_limit is not None and attempt < max_retries:
                    attempt += 1
                    on_rate_limit(attempt)
                    continue
                break
        if category is None and not isinstance(raw, dict):
            category = "MALFORMED"                       # Antwort da, aber keine Struktur
        if category is None:
            try:
                details[aid] = parse_activity_details(raw)
            except Exception:  # noqa: BLE001 — unlesbare Antwort ist ein Befund, kein Absturz
                category = "MALFORMED"
        if category is None:
            network_streak = 0
            continue
        failed.append(aid)
        failures[aid] = category
        if category in ABORT_RUN:
            aborted = category
        elif category == "NETWORK":
            network_streak += 1
            if network_streak >= NETWORK_ABORT_AFTER:
                aborted = "NETWORK"
        else:
            network_streak = 0
    else:
        not_attempted = []
    if aborted is not None and not not_attempted:
        not_attempted = [a for a in selected if a not in details and a not in failures]
    transient = [a for a in failed if failures[a] not in ACTIVITY_SPECIFIC and failures[a] != "UNKNOWN"]
    return {"selected": selected, "details": details, "failed": failed, "failures": failures,
            "failed_transient": transient, "aborted": aborted, "not_attempted": not_attempted}
