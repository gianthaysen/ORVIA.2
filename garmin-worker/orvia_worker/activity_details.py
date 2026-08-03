"""GM7.4-C · Sicherheits-Utilities für den optionalen, begrenzten
get_activity_details-Backfill (Garmin-Sync GPS/Splits/Kadenz).

WICHTIG — Grenze dieses Moduls:
Diese Funktionen sind bewusst STRUKTUR-UNABHÄNGIG. Sie enthalten KEINEN Parser
für die Garmin-Detail-Antwort, weil deren tatsächliche Struktur im Repo nicht
belegt ist (kein activity_details-Fixture). Der eigentliche Fetch + Parser wird
erst gebaut, wenn EINE echte, anonymisierte Detail-Antwort als Fixture vorliegt.
Bis dahin liefern diese Utilities die Leitplanken:
  * `select_activities_needing_details` — nur neue/undetaillierte, begrenzte Anzahl,
    idempotent (bereits detaillierte werden nie erneut geladen) → expliziter,
    begrenzter Backfill statt automatischer Vollhistorie.
  * `reduce_route` — Payload deckeln, Anfang+Ende der Route erhalten (verlustarm).
  * `build_detail_metrics` — vorhandene bereits-extrahierte Streams verlustfrei und
    RÜCKWÄRTSKOMPATIBEL in das metrics-jsonb mergen (bestehende Felder bleiben,
    fehlende Daten erzeugen kein erfundenes Feld).

Der Provider ruft get_activity_details heute NIE auf (garmin_unofficial.py:
get_activities → nur get_activities_by_date). Integration = separater, expliziter
Schritt; diese Utilities sind pur und deterministisch testbar.
"""

from __future__ import annotations

import math
from typing import Any

ROUTE_MAX_POINTS = 600


def _finite(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(float(v))


def _valid_point(p: Any) -> bool:
    """Ein Routenpunkt ist [lat, lon] mit zwei endlichen Zahlen."""
    return (
        isinstance(p, (list, tuple))
        and len(p) >= 2
        and _finite(p[0])
        and _finite(p[1])
    )


def reduce_route(points: Any, max_points: int = ROUTE_MAX_POINTS) -> list:
    """Filtert ungültige Punkte und deckelt die Punktzahl auf max_points,
    wobei Anfang UND Ende der Route erhalten bleiben (gleiche Reduktions-
    Semantik wie der Datei-Import in activity-normalize.js buildImportMetrics)."""
    if not isinstance(points, (list, tuple)):
        return []
    pts = [list(p) for p in points if _valid_point(p)]
    if len(pts) <= max_points:
        return pts
    step = math.ceil(len(pts) / max_points)
    ds = pts[::step]
    if ds[-1] != pts[-1]:
        ds.append(pts[-1])
    # Harte Deckelung: Sampling + angehängtes Ende kann max_points um 1 überschreiten
    # (exaktes Vielfaches). Dann das vorletzte Element entfernen — Anfang+Ende bleiben.
    if len(ds) > max_points:
        ds = ds[:max_points - 1] + [pts[-1]]
    return ds


def select_activities_needing_details(
    candidate_ids: Any, already_detailed_ids: Any, limit: int | None
) -> list:
    """Deterministische, idempotente, begrenzte Auswahl der noch zu detaillierenden
    Aktivitäten. Reihenfolge = Eingabereihenfolge; bereits detaillierte werden nie
    erneut geladen; Duplikate entfernt; höchstens `limit` Einträge."""
    already = {str(x) for x in (already_detailed_ids or [])}
    out: list[str] = []
    seen: set[str] = set()
    for cid in (candidate_ids or []):
        s = str(cid)
        if s in already or s in seen:
            continue
        seen.add(s)
        out.append(s)
        if limit is not None and len(out) >= limit:
            break
    return out


def build_detail_metrics(
    existing_metrics: Any,
    route: Any = None,
    splits: Any = None,
    cadence_avg: Any = None,
    max_route_points: int = ROUTE_MAX_POINTS,
) -> dict:
    """Merged bereits EXTRAHIERTE Detail-Streams verlustfrei in ein vorhandenes
    metrics-Dict. Rückwärtskompatibel: bestehende Schlüssel bleiben unverändert,
    fehlende Daten erzeugen KEIN Feld (kein Platzhalter). Nimmt strukturneutrale
    Eingaben (route: Punktliste, splits: Liste von Dicts, cadence_avg: Zahl) —
    die Extraktion aus der Garmin-Detail-Antwort ist NICHT Teil dieses Moduls."""
    out = dict(existing_metrics) if isinstance(existing_metrics, dict) else {}
    if route is not None:
        red = reduce_route(route, max_route_points)
        if len(red) > 1:
            out["route"] = red
            out["hasRoute"] = True
    if isinstance(splits, list) and splits:
        out["splits"] = splits
    if _finite(cadence_avg):
        out["cadence_avg"] = float(cadence_avg)
    return out
