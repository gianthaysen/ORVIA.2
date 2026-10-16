"""v8-449.1 · Aktive Trainingsbestzeit — Strecken-Bestwerte auf der TIMER-Achse (sumDuration).

A   Rechenregel: Timer-Differenz zwischen zwei echten Messzeilen, gleiche Fenstersuche wie bei der
    verstrichenen Zeit; Pausen fallen heraus, die Distanz bleibt unveraendert
P   Pausen: eine, mehrere; Strecke waehrend angehaltenem Timer = Widerspruch → Reihe getrennt
V   Validierung: Timer rueckwaerts / schneller als die Uhr, fehlende Werte, fehlende Spalte
I   Einbau: Detailantwort → best_efforts.distance_active; nur Fuss-Sportarten; Neuabruf-Schalter

Die Reihen sind SYNTHETISCH und von Hand nachrechenbar. Der Fall „13.08." bildet die Eckdaten der echten
Einheit nach (5006 m, Timer 1418 s, verstrichen 1997 s), nicht ihre Messzeilen.
"""

import asyncio

from orvia_worker import best_efforts as B, detail_sync, series_normalize as S
from orvia_worker.config import Settings
from tests.conftest import FakeDb

T0 = 1_767_225_600_000


def _rows(segments, speed=3.5):
    """segments: [('run', s) | ('pause', s) | ('pause_moving', s, m)] → (timer, elapsed, dist) je Sekunde."""
    t = e = d = 0.0
    out = [(t, e, d)]
    for seg in segments:
        if seg[0] == "run":
            for _ in range(int(seg[1])):
                t += 1; e += 1; d += speed
                out.append((t, e, d))
        elif seg[0] == "pause":
            e += seg[1]                                   # Uhr steht: keine Zeile, Timer und Distanz stehen
        elif seg[0] == "pause_moving":
            e += seg[1]; d += seg[2]                       # Strecke im angehaltenen Zustand (Widerspruch)
    return [r[0] for r in out], [r[1] for r in out], [r[2] for r in out]


def _details(timer, elapsed, dist, with_timer=True):
    desc = [{"metricsIndex": 0, "key": "directTimestamp"}, {"metricsIndex": 1, "key": "sumDistance"},
            {"metricsIndex": 2, "key": "sumElapsedDuration"}]
    if with_timer:
        desc.append({"metricsIndex": 3, "key": "sumDuration"})
    rows = [{"metrics": [T0 + int(e * 1000), d, e] + ([t] if with_timer else [])} for t, e, d in zip(timer, elapsed, dist)]
    return {"metricDescriptors": desc, "activityDetailMetrics": rows, "totalMetricsCount": len(rows)}


# ── A · Rechenregel ────────────────────────────────────────────────────────────

def test_active_window_excludes_pause_elapsed_keeps_it():
    """5 km mit 3,5 m/s und einer Pause von 9:39 in der Mitte: aktiv 1429 s, verstrichen 1429 + 579 s."""
    tm, el, ds = _rows([("run", 700), ("pause", 579), ("run", 729)])
    act = B.distance_best_active(tm, el, ds)
    ela = B.distance_best(el, ds)
    a5, e5 = act["targets"]["5000"], ela["targets"]["5000"]
    assert act["status"] == "ok" and act["basis"] == "timer" and act["pauses"] == 1 and act["paused_s"] == 579.0
    assert a5["q"] == "measured" and a5["s"] == 1429.0 and a5["over_m"] < 10           # 1429 · 3,5 = 5001,5 m
    assert e5["s"] == a5["s"] + 579                                                   # dieselbe Strecke, Pause zaehlt mit
    assert act["total_m"] == ela["total_m"]                                           # Distanz nicht veraendert


def test_window_inside_a_long_run_uses_only_active_seconds():
    """10 km aktiv in einem 15-km-Lauf mit zwei Pausen: Teilstrecke, Timer-Differenz."""
    tm, el, ds = _rows([("run", 1500), ("pause", 120), ("run", 1500), ("pause", 300), ("run", 1300)], speed=3.6)
    act = B.distance_best_active(tm, el, ds)
    assert act["pauses"] == 2 and act["paused_s"] == 420.0
    t10 = act["targets"]["10000"]
    assert t10["q"] == "measured" and t10["s"] == 2778.0                               # ceil(10000 / 3,6) aktive Sekunden
    assert B.distance_best(el, ds)["targets"]["10000"]["s"] >= t10["s"] + 120          # verstrichen: mindestens eine Pause im Fenster


def test_no_pause_active_equals_elapsed():
    tm, el, ds = _rows([("run", 1500)])
    assert B.distance_best_active(tm, el, ds)["targets"]["5000"]["s"] == B.distance_best(el, ds)["targets"]["5000"]["s"]


def test_case_13_08_upper_bound_from_full_rows():
    """Eckdaten der echten Einheit: 5006 m, Timer 1418 s, verstrichen 1997 s → aktive 5 km ≤ 1418 s."""
    v = 5006 / 1418
    tm, el, ds = _rows([("run", 600), ("pause", 300), ("run", 500), ("pause", 279), ("run", 318)], speed=v)
    act = B.distance_best_active(tm, el, ds)
    assert act["timer_s"] == 1418.0 and act["paused_s"] == 579.0
    assert act["targets"]["5000"]["s"] <= 1418.0 and act["targets"]["5000"]["q"] == "measured"


# ── P · Pausen und Widerspruch ────────────────────────────────────────────────

def test_distance_while_paused_splits_the_series():
    """500 m Strecke bei stehendem Timer (z. B. Uhr angehalten, weitergegangen): kein Fenster ueberspannt das."""
    tm, el, ds = _rows([("run", 400), ("pause_moving", 300, 500.0), ("run", 400)])
    act = B.distance_best_active(tm, el, ds)
    assert act["conflicts"] == 1 and act["conflict_m"] == 503.5             # 500 m im Stillstand + 1 s Laufen bis zur naechsten Zeile
    assert act["targets"]["1000"]["q"] == "measured" and act["targets"]["1000"]["s"] == 286.0   # innerhalb EINES Abschnitts
    assert act["targets"]["5000"]["q"] == "split_by_conflict"                                  # nur ueber den Widerspruch erreichbar


def test_small_gps_jump_on_resume_is_not_a_conflict():
    tm, el, ds = _rows([("run", 400), ("pause_moving", 60, 4.0), ("run", 400)])
    act = B.distance_best_active(tm, el, ds)
    assert "conflicts" not in act and act["pauses"] == 1


def test_auto_and_manual_pause_are_not_distinguished():
    tm, el, ds = _rows([("run", 300), ("pause", 8), ("run", 300)])
    assert B.distance_best_active(tm, el, ds)["pause_kind"] == "unknown"


# ── V · Validierung ───────────────────────────────────────────────────────────

def test_timer_running_backwards_or_faster_than_clock_is_rejected():
    tm, el, ds = _rows([("run", 100)])
    back = list(tm); back[50] = back[49] - 5
    assert B.distance_best_active(back, el, ds)["status"] == "invalid_timer_axis"
    fast = [t * 3 for t in tm]
    assert B.distance_best_active(fast, el, ds)["status"] == "invalid_timer_axis"


def test_missing_values_drop_rows_never_interpolate():
    tm, el, ds = _rows([("run", 400)])
    holes = list(tm); holes[100] = None; holes[101] = None
    act = B.distance_best_active(holes, el, ds)
    assert act["status"] == "ok" and act["rows"] == len(tm) - 2 and act["targets"]["1000"]["s"] >= 286.0


def test_no_timer_column_is_reported_not_guessed():
    tm, el, ds = _rows([("run", 400)])
    out = S.parse_activity_details(_details(tm, el, ds, with_timer=False))
    assert out["best"]["distance_active"] == {"v": 1, "basis": "timer", "status": "no_timer_column"}
    assert "targets" not in out["best"]["distance_active"]


# ── I · Einbau ───────────────────────────────────────────────────────────────

def test_parsed_details_carry_both_time_bases():
    tm, el, ds = _rows([("run", 700), ("pause", 579), ("run", 729)])
    best = S.parse_activity_details(_details(tm, el, ds))["best"]
    assert best["distance"]["basis"] == "elapsed" and best["distance_active"]["basis"] == "timer"
    assert best["distance_active"]["targets"]["5000"]["s"] == 1429.0 and best["distance"]["targets"]["5000"]["s"] == 2008.0


def test_refetch_active_only_when_switched_on_and_only_foot_sports():
    def act(sport, be):
        return {"sport_id": sport, "metrics": {"detailsVersion": 3, "detailsFetchedAt": "2026-10-01T00:00:00+00:00", "route": [[0, 0]],
                                                 "best_efforts": be}}
    old = act("running", {"distance": {"basis": "elapsed"}})
    done = act("running", {"distance": {"basis": "elapsed"}, "distance_active": {"status": "no_timer_column"}})
    ride = act("cycling", {"power": {}})
    assert detail_sync._needs_active(old) and not detail_sync._needs_active(done) and not detail_sync._needs_active(ride)
    assert Settings.from_env({"SUPABASE_URL": "u", "SUPABASE_SERVICE_ROLE_KEY": "k", "TOKEN_ENCRYPTION_KEY": "t"}).detail_refetch_active is False
    assert Settings.from_env({"SUPABASE_URL": "u", "SUPABASE_SERVICE_ROLE_KEY": "k", "TOKEN_ENCRYPTION_KEY": "t", "DETAIL_REFETCH_ACTIVE": "1"}).detail_refetch_active is True
    st = detail_sync.backfill_status([old, done, ride], refetch_active=True)
    assert st["active_pending"] == 1 and detail_sync.backfill_status([old], refetch_active=False)["active_pending"] == 0


def test_distance_active_is_dropped_for_non_foot_sports_on_sync():
    async def run():
        db = FakeDb(); uid = "a1"
        await db.insert("activities", [{"user_id": uid, "source": "garmin", "source_record_id": "ride", "sport_id": "cycling", "metrics": {}},
                                       {"user_id": uid, "source": "garmin", "source_record_id": "run", "sport_id": "running", "metrics": {}}])
        tm, el, ds = _rows([("run", 700), ("pause", 60), ("run", 729)])
        await detail_sync.sync_activity_details(db, uid, lambda aid: _details(tm, el, ds), limit=5)
        m = {r["source_record_id"]: r["metrics"] for r in await db.select("activities", {"user_id": uid})}
        assert "distance_active" in m["run"]["best_efforts"] and "distance_active" not in (m["ride"].get("best_efforts") or {})
    asyncio.run(run())
