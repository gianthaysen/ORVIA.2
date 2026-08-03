"""GM7.4-C · Struktur-UNABHÄNGIGE Sicherheits-Utilities für den optionalen,
begrenzten get_activity_details-Backfill.

Diese Tests sichern die Leitplanken (nur neue/undetaillierte Aktivitäten,
begrenzte Anzahl, verlustfreie aber gedeckelte Route mit Anfang+Ende, rückwärts-
kompatibles Metrik-Merge). Sie prüfen KEINE Garmin-Detail-Antwortstruktur — die
ist im Repo nicht belegt und der Parser bleibt bis zu einer echten, anonymisierten
Detail-Antwort bewusst ungebaut.
"""

from orvia_worker.activity_details import (
    build_detail_metrics,
    reduce_route,
    select_activities_needing_details,
)


def test_reduce_route_caps_and_keeps_start_end():
    pts = [[50.0 + i * 1e-4, 8.0 + i * 1e-4] for i in range(5000)]
    red = reduce_route(pts, max_points=600)
    assert len(red) <= 600
    assert red[0] == pts[0]          # Anfang erhalten
    assert red[-1] == pts[-1]        # Ende erhalten


def test_reduce_route_small_untouched_and_filters_invalid():
    pts = [[50.0, 8.0], "kaputt", [50.1, 8.1], [None, 3]]
    red = reduce_route(pts, max_points=600)
    assert red == [[50.0, 8.0], [50.1, 8.1]]


def test_select_only_new_bounded_and_idempotent():
    candidates = ["a", "b", "c", "d", "e"]
    already = ["b", "d"]
    sel = select_activities_needing_details(candidates, already, limit=2)
    assert sel == ["a", "c"]                         # nur neue, in Reihenfolge, gedeckelt
    # Idempotenz: nach dem Detaillieren gelten a,c als erledigt → nächster Lauf nimmt e
    sel2 = select_activities_needing_details(candidates, already + sel, limit=2)
    assert sel2 == ["e"]
    # Vollständig erledigt ⇒ leer (kein erneutes Laden)
    assert select_activities_needing_details(candidates, candidates, limit=10) == []


def test_build_detail_metrics_backward_compatible_merge():
    existing = {"training_load": 148.2}
    pts = [[50.0 + i * 1e-4, 8.0 + i * 1e-4] for i in range(3000)]
    splits = [{"km": 1, "sec": 300}, {"km": 2, "sec": 295}]
    out = build_detail_metrics(existing, route=pts, splits=splits, cadence_avg=172.0)
    assert out["training_load"] == 148.2             # Bestehendes bleibt erhalten
    assert out["hasRoute"] is True and len(out["route"]) <= 600
    assert out["route"][0] == pts[0] and out["route"][-1] == pts[-1]
    assert out["splits"] == splits
    assert out["cadence_avg"] == 172.0


def test_build_detail_metrics_no_data_adds_nothing():
    out = build_detail_metrics({"training_load": 10}, route=None, splits=None, cadence_avg=None)
    assert out == {"training_load": 10}              # kein erfundenes Feld
    # Route mit <2 gültigen Punkten ⇒ keine Route
    assert "route" not in build_detail_metrics({}, route=[[50.0, 8.0]])
