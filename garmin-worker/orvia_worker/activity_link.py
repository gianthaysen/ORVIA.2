"""S2c · Geräteaufzeichnung an ORVIA-Workout koppeln (Worker-Seite).

Spiegelt die Regel der Migration 0048 (orvia_link_candidate): gleicher Nutzer,
gleiche Sportart, Zeitfenster überlappen, |Δ Start| ≤ Toleranz, Primär noch ohne
Aufzeichnung; bei mehreren Kandidaten gewinnt der kleinste |Δ Start|. Reine
Funktion für die Kandidatenwahl (testbar ohne DB) + dünner DB-Schritt, der den
Sync nie abbricht.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

TOLERANCE_MIN_DEFAULT = 20
LINK_KIND = "device_recording"
LINKABLE_SPORTS = ("gym",)


def _parse_ts(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        s = str(value).strip().replace(" ", "T")
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _window(row: dict) -> tuple[datetime, datetime] | None:
    start = _parse_ts(row.get("started_at"))
    if start is None:
        return None
    end = _parse_ts(row.get("ended_at"))
    if end is None:
        secs = row.get("duration_seconds") or 0
        try:
            end = start + timedelta(seconds=float(secs))
        except (TypeError, ValueError):
            end = start
    return start, end


def find_link_candidate(
    recording: dict,
    workouts: list[dict],
    tolerance_min: int = TOLERANCE_MIN_DEFAULT,
) -> str | None:
    """ID des passenden orvia_workout-Datensatzes oder None. Pure Funktion."""
    rw = _window(recording)
    if rw is None:
        return None
    r_start, r_end = rw
    r_sport = recording.get("sport_id")
    if r_sport not in LINKABLE_SPORTS:
        return None
    best_id: str | None = None
    best_delta: float | None = None
    for w in workouts or []:
        if not w or w.get("id") == recording.get("id"):
            continue
        if w.get("source") != "orvia_workout" or w.get("sport_id") != r_sport:
            continue
        if w.get("user_id") is not None and recording.get("user_id") is not None and w["user_id"] != recording["user_id"]:
            continue
        if w.get("linked_activity_id"):
            continue
        ww = _window(w)
        if ww is None:
            continue
        w_start, w_end = ww
        delta = abs((w_start - r_start).total_seconds())
        if delta > tolerance_min * 60:
            continue
        overlaps = w_start <= r_end and r_start <= w_end
        if not overlaps:
            continue
        if best_delta is None or delta < best_delta:
            best_delta, best_id = delta, w.get("id")
    return best_id


async def autolink_recording(db, user_id: str, recording: dict, tolerance_min: int = TOLERANCE_MIN_DEFAULT) -> str | None:
    """Nach dem Insert einer Geräteaufzeichnung: Kandidat suchen und koppeln.

    Liefert die gekoppelte Primär-ID oder None. Wirft nie — ein Fehler hier darf
    den Aktivitäts-Sync nicht abbrechen.
    """
    try:
        if not recording or not recording.get("id") or recording.get("sport_id") not in LINKABLE_SPORTS:
            return None
        start = _parse_ts(recording.get("started_at"))
        if start is None:
            return None
        lo = (start - timedelta(hours=6)).isoformat()
        hi = (start + timedelta(hours=6)).isoformat()
        workouts = await db.select(
            "activities",
            {
                "user_id": user_id,
                "source": "orvia_workout",
                "sport_id": recording["sport_id"],
                "started_at": ("gte", lo),
            },
            columns="id,user_id,source,sport_id,started_at,ended_at,duration_seconds,linked_activity_id",
            limit=20,
        )
        workouts = [w for w in workouts if (_parse_ts(w.get("started_at")) or start) <= _parse_ts(hi)]
        # Primär, der bereits eine andere Aufzeichnung trägt, ist nicht mehr frei.
        taken = await db.select(
            "activities",
            {"user_id": user_id, "linked_activity_id": ("not.is", "null")},
            columns="linked_activity_id",
            limit=200,
        )
        taken_ids = {t.get("linked_activity_id") for t in taken if t.get("linked_activity_id")}
        workouts = [w for w in workouts if w.get("id") not in taken_ids]
        cand = find_link_candidate(recording, workouts, tolerance_min)
        if not cand:
            return None
        await db.update(
            "activities",
            {"id": recording["id"], "user_id": user_id},
            {"linked_activity_id": cand, "link_kind": LINK_KIND},
        )
        return cand
    except Exception:  # noqa: BLE001 — bewusst: Kopplung ist Bonus, nie Abbruchgrund
        logger.warning("autolink_recording fehlgeschlagen (Aktivitaet %s)", recording.get("id") if recording else None)
        return None
