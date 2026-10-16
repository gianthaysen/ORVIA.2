"""v8-447.1 · Production Validation & Garmin Census — Worker-Teil.

P   Bestwerte aus allen gelieferten Zeilen (Leistung ueber Zeitfenster, Zeit ueber Strecke)
F   Fehlerklassen des Nachladens: was den Lauf beendet, was zaehlt, was nie zaehlt
S   Stand des Nachladens (nur Zahlen)
M   HTTP-Status → Fehlerklasse (mit der ECHTEN Bibliothek, wenn sie installiert ist)
D   kein stiller Verlust: erlaubtes Feld in unerwarteter Form wird gemeldet
C   Abtastung einstellbar (maxchart), Healthcheck nennt den Stand

Alle Messreihen hier sind SYNTHETISCH und so gebaut, dass das richtige Ergebnis von Hand
nachrechenbar ist. Die Tests belegen die Rechenregeln, nicht Garmins Nutzlast.
"""

import asyncio
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from orvia_worker import backfill, best_efforts as B, detail_sync, garmin_fields as GF, normalize, series_normalize as S
from orvia_worker.providers.base import AuthError, NotFound, ProviderUnavailable, RateLimited, Unsupported
from tests.conftest import FakeDb

FIX = Path(__file__).parent / "fixtures" / "garmin"
DETAILS = json.load(open(FIX / "activity_details.json", encoding="utf-8"))
T0 = 1_767_225_600_000


def _w(res, window):
    return res["windows"][str(window)]


# ═══════════════════════════════════════════════════════════════════════════
# P · Bestwerte
# ═══════════════════════════════════════════════════════════════════════════

def test_power_example_from_the_order():
    """0–9 s = 100 W, 10–14 s = 500 W, 15–59 s = 100 W  →  bester 5-s-Wert = 500 W."""
    t = [float(i) for i in range(60)]
    p = [100.0] * 10 + [500.0] * 5 + [100.0] * 45
    r = B.power_best(t, p, rows_total=60)
    assert r["status"] == "ok" and r["native"] is True and r["interval_s"] == 1.0
    assert _w(r, 1) == {"w": 500.0, "at": 9, "q": "exact"}
    assert _w(r, 5) == {"w": 500.0, "at": 9, "q": "exact"}
    assert _w(r, 10)["w"] == 300.0                      # 5 s × 500 + 5 s × 100
    assert _w(r, 15)["w"] == pytest.approx(233.3, abs=0.05)   # 5 × 500 + 10 × 100
    assert _w(r, 60)["w"] == pytest.approx(133.3, abs=0.05)   # die ganze Minute
    assert _w(r, 120) == {"q": "too_short"}             # laenger als die Aufzeichnung: keine Zahl
    assert r["missing_s"] == 0.0 and r["gap_s"] == 0.0


def test_power_window_is_time_not_sample_count():
    """Unregelmaessige Abtastung: 5 Messpunkte sind NICHT 5 Sekunden."""
    # 600 W an fuenf aufeinanderfolgenden Zeilen — aber im 2-s-Abstand (= 10 s Dauer)
    t = [0.0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 15, 16, 17, 18, 19, 20]
    p = [100.0, 100, 100, 100, 100, 600, 600, 600, 600, 600, 100, 100, 100, 100, 100, 100]
    r = B.power_best(t, p, rows_total=len(t))
    assert _w(r, 5)["w"] == 600.0 and _w(r, 10)["w"] == 600.0     # die 600 W dauern 10 s
    assert _w(r, 15)["w"] == pytest.approx((10 * 600 + 5 * 100) / 15, abs=0.05)
    # Gegenprobe „N Messpunkte": die besten 15 Zeilen in Folge haetten ~267 W ergeben
    naive15 = max(sum(p[i:i + 15]) / 15 for i in range(len(p) - 14))
    assert abs(naive15 - _w(r, 15)["w"]) > 100


def test_pause_stays_inside_the_window():
    """20-min-Fenster mit 2 min Pause: die Pause zaehlt als Zeit mit 0 W — Bewegungsabschnitte
    werden nicht zusammengeklebt."""
    t, p = [], []
    for i in range(540):                # 9 min @ 300 W
        t.append(float(i)); p.append(300.0)
    for i in range(540 + 120, 1200 + 1):  # 2 min Pause (keine Zeilen), dann bis Minute 20 @ 300 W
        t.append(float(i)); p.append(300.0)
    r = B.power_best(t, p, rows_total=len(t))
    w20 = _w(r, 1200)
    riding = 1200 - 120 + 1             # Sekunden mit Leistung im besten Fenster (Pause endet mit einer Zeile)
    assert w20["w"] == pytest.approx(300.0 * riding / 1200, abs=0.3)      # ≈ 270 W, nicht 300 W
    assert w20["w"] < 275 and w20["gap_s"] == pytest.approx(119.0, abs=1.0)
    assert r["gap_s"] == pytest.approx(119.0, abs=1.0)
    assert _w(r, 300)["w"] == 300.0 and "gap_s" not in _w(r, 300)         # 5 min ohne Pause gibt es


def test_missing_samples_count_as_zero_and_are_reported():
    """Sensor weg (Zeile ohne Leistungswert): 0 W, nicht interpoliert, nicht uebersprungen."""
    t = [float(i) for i in range(30)]
    p = [400.0] * 10 + [None] * 5 + [400.0] * 15
    r = B.power_best(t, p, rows_total=30)
    assert r["missing_s"] == 5.0
    assert _w(r, 10)["w"] == 400.0 and "miss_s" not in _w(r, 10)           # es gibt 10 s ohne Luecke
    w30 = _w(r, 30)
    assert w30["w"] == pytest.approx(400.0 * 25 / 30, abs=0.05) and w30["miss_s"] == 5.0
    interpolated = 400.0
    assert w30["w"] < interpolated                                          # Luecke hebt den Wert nie


def test_zero_power_is_a_measurement_not_a_gap():
    t = [float(i) for i in range(20)]
    r = B.power_best(t, [200.0] * 10 + [0.0] * 10, rows_total=20)
    assert r["missing_s"] == 0.0 and r["gap_s"] == 0.0
    assert _w(r, 15)["w"] == pytest.approx(200.0 * 10 / 15, abs=0.05)


def test_negative_power_is_treated_as_missing():
    t = [float(i) for i in range(10)]
    r = B.power_best(t, [200.0] * 5 + [-5.0] + [200.0] * 4, rows_total=10)
    assert r["missing_s"] == 1.0


def test_quality_depends_on_what_garmin_delivered():
    """Dieselbe Reihe, drei Lagen: vollstaendig + sekuendlich = exact; ausgeduennt = approx fuer
    lange, KEINE Zahl fuer kurze Fenster; Gesamtzahl unbekannt = nicht als vollstaendig belegt."""
    t = [float(i * 3) for i in range(400)]            # alle 3 s (wie der echte Mitschnitt)
    p = [200.0 + (i % 7) for i in range(400)]
    thinned = B.power_best(t, p, rows_total=1200)
    assert thinned["native"] is False and thinned["interval_s"] == 3.0
    assert _w(thinned, 1) == {"q": "insufficient"} and _w(thinned, 5) == {"q": "insufficient"}
    assert _w(thinned, 15) == {"q": "insufficient"}                         # 15 s < 8 × 3 s
    assert _w(thinned, 30)["q"] == "approx" and _w(thinned, 60)["q"] == "approx"
    unknown = B.power_best(t, p, rows_total=None)
    assert unknown["native"] is False and unknown["total"] is None          # nicht belegt ≠ vollstaendig
    full = B.power_best([float(i) for i in range(400)], p, rows_total=400)
    assert full["native"] is True and all(_w(full, w)["q"] == "exact" for w in (1, 5, 10, 15, 30, 60, 120, 300))
    smart = B.power_best(t, p, rows_total=400)                              # vollstaendig, aber nicht sekuendlich
    assert smart["native"] is True and _w(smart, 5) == {"q": "insufficient"} and _w(smart, 60)["q"] == "approx"


def test_power_matches_brute_force_on_random_irregular_series():
    rnd = random.Random(11)

    def brute(ts, ps, d):
        h = B._interval(ts)
        starts, ends, w, _ = B._segments(ts, ps, h)
        lo, hi = starts[0], ends[-1]

        def energy(x):
            return sum(v * max(0.0, min(x, e) - s) for s, e, v in zip(starts, ends, w))
        xs = [min(s, hi - d) for s in starts] + [min(max(e - d, lo), hi - d) for e in ends]
        xs += [lo + i * (hi - d - lo) / 500 for i in range(501)]
        return max((energy(x + d) - energy(x)) / d for x in xs)

    checked = 0
    for _ in range(25):
        ts = [0.0]
        for _i in range(rnd.randint(8, 80)):
            ts.append(ts[-1] + rnd.choice([1, 1, 1, 2, 3, 45]))
        ps = [rnd.choice([None, 0.0]) if rnd.random() < 0.15 else rnd.uniform(80, 700) for _ in ts]
        if not any(x is not None for x in ps):
            continue
        r = B.power_best(ts, ps, rows_total=len(ts))
        for d in (1, 5, 10, 30, 60):
            item = _w(r, d)
            if "w" in item:
                checked += 1
                assert item["w"] == pytest.approx(brute(ts, ps, float(d)), abs=0.06), (d, item)
    assert checked > 40


def test_power_refuses_unusable_input():
    assert B.power_best(None, None)["status"] == "no_data"
    assert B.power_best([0.0, 1.0], [None, None])["status"] == "no_data"
    assert B.power_best([0.0, 1.0, 0.5], [1.0, 2.0, 3.0])["status"] == "invalid_time_axis"
    assert B.power_best([5.0, 5.0, 5.0], [1.0, 2.0, 3.0])["status"] == "invalid_time_axis"   # kein Abstand
    assert B.power_best([0.0, 1.0], [1.0])["status"] == "no_data"
    assert B.compact(B.power_best([0.0, 1.0, 0.5], [1.0, 2.0, 3.0]), "windows") is None


def test_time_axis_rules():
    ok = B.time_axis([T0, T0 + 1000, None, T0 + 3000])
    assert ok["ok"] and ok["t"] == [0.0, 1.0, None, 3.0] and ok["source"] == "directTimestamp"
    assert B.time_axis([T0 + 2000, T0])["reason"] == "invalid_time_axis"
    assert B.time_axis(None, [0.0, 2.0, 4.0])["source"] == "sumElapsedDuration"
    assert B.time_axis(None, None) == {"ok": False, "t": [], "source": None, "reason": "no_time_axis"}
    assert B.time_axis([T0])["ok"] is False


def test_distance_best_uses_real_samples_and_is_an_upper_bound():
    # 1 km gleichmaessig in 300 s, dann 1 km schneller in 240 s, dann 1 km in 300 s; Zeilen alle 10 s
    t, d = [0.0], [0.0]
    for seg_s, seg_m in ((300, 1000.0), (240, 1000.0), (300, 1000.0)):
        steps = seg_s // 10
        for _ in range(steps):
            t.append(t[-1] + 10)
            d.append(d[-1] + seg_m / steps)
    r = B.distance_best(t, d)
    k1 = r["targets"]["1000"]
    assert k1["s"] == 240.0 and k1["q"] == "measured" and k1["over_m"] == pytest.approx(0.0, abs=0.01) and k1["at"] == 300
    k400 = r["targets"]["400"]
    # 400 m brauchen 10 Zeilen (9 schnelle Schritte à 41,67 m reichen nicht): 100 s. Zwei Fenster
    # sind gleich schnell (2 langsame + 8 schnelle Schritte = genau 400 m; 10 schnelle = 416,7 m) —
    # genommen wird das fruehere. Entscheidend: nie schneller als die wahre Bestzeit (96 s).
    assert k400["s"] == 100.0 and k400["q"] == "measured" and 0.0 <= k400["over_m"] <= 16.7
    assert k400["s"] >= 400 / (1000 / 240)
    assert r["targets"]["5000"] == {"q": "too_short"} and r["total_m"] == 3000.0


def test_distance_pause_counts_and_coarse_sampling_is_flagged():
    # 500 m in 100 s, 10 min Pause, 500 m in 100 s → der schnellste Kilometer enthaelt die Pause
    t = [0.0, 50, 100, 700, 750, 800]
    d = [0.0, 250, 500, 500, 750, 1000]
    r = B.distance_best(t, d, targets=(1000.0, 400.0))
    assert r["targets"]["1000"]["s"] == 800.0                                  # nicht 200 s
    assert r["targets"]["400"] == {"s": 100.0, "over_m": 100.0, "at": 0, "q": "coarse"}   # Ueberhang 25 %: kein Rekord
    assert B.distance_best([0.0, 10, 20], [0.0, 50, 40])["status"] == "invalid_distance_axis"
    assert B.distance_best([0.0, 10, 5], [0.0, 50, 90])["status"] == "invalid_time_axis"


def test_real_run_capture_gets_distance_bests_and_no_power():
    out = S.parse_activity_details(DETAILS)
    best = out["best"]
    assert "power" not in best and best["time_source"] == "directTimestamp" and best["v"] == 1
    tg = best["distance"]["targets"]
    assert tg["1000"]["q"] == "measured" and tg["5000"]["q"] == "measured" and tg["10000"]["q"] == "measured"
    assert tg["21098"] == {"q": "too_short"}                       # der Lauf war 15 km lang
    assert tg["1000"]["s"] * 5 <= tg["5000"]["s"] + 1e-6 and tg["5000"]["s"] * 2 <= tg["10000"]["s"] + 1e-6
    assert all(tg[k]["over_m"] < 10 for k in ("400", "1000", "5000", "10000"))
    # Auswertung aus ALLEN 1855 Zeilen — nicht aus den 266 gespeicherten
    assert best["distance"]["rows"] == 1855 and len(out["streams"]["time"]) < 300
    disp = B.distance_best([float(x) for x in out["streams"]["time"]], out["streams"]["distance"])
    assert disp["targets"]["1000"]["s"] >= tg["1000"]["s"]         # die Anzeige-Reihe waere nie schneller, meist langsamer
    assert disp["targets"]["400"]["over_m"] > tg["400"]["over_m"]


def _ride(n=120, step_ms=1000, total=None, hr=True):
    desc = [{"metricsIndex": 0, "key": "directTimestamp"}, {"metricsIndex": 1, "key": "directPower"},
            {"metricsIndex": 2, "key": "sumDistance"}]
    if hr:
        desc.append({"metricsIndex": 3, "key": "directHeartRate"})
    rows = [{"metrics": [T0 + i * step_ms, 500.0 if 30 <= i < 35 else 200.0, i * 8.0] + ([140.0] if hr else [])} for i in range(n)]
    raw = {"metricDescriptors": desc, "activityDetailMetrics": rows}
    if total is not None:
        raw["totalMetricsCount"] = total
    return raw


def test_best_efforts_are_stored_with_the_row_and_replaced_on_reload():
    out = S.parse_activity_details(_ride(total=120))
    pw = out["best"]["power"]
    assert pw["native"] is True and pw["windows"]["5"] == {"w": 500.0, "at": 29, "q": "exact"}
    m = S.build_activity_metrics({"best_efforts": {"stale": True}, "training_load": 3}, out)
    assert m["best_efforts"]["power"]["windows"]["5"]["w"] == 500.0 and "stale" not in m["best_efforts"]
    assert m["training_load"] == 3
    # Nachladen ohne Leistungsreihe: der alte Bestwert darf nicht stehen bleiben
    no_power = {"metricDescriptors": [{"metricsIndex": 0, "key": "directTimestamp"}, {"metricsIndex": 1, "key": "directHeartRate"}],
                "activityDetailMetrics": [{"metrics": [T0 + i * 1000, 120.0]} for i in range(10)]}
    again = S.build_activity_metrics(m, S.parse_activity_details(no_power))
    assert "power" not in again["best_efforts"] and set(again["best_efforts"]["stats"]) == {"heart_rate"}
    only_time = {"metricDescriptors": [{"metricsIndex": 0, "key": "directTimestamp"}, {"metricsIndex": 1, "key": "directElevation"}],
                 "activityDetailMetrics": [{"metrics": [T0 + i * 1000, 40.0]} for i in range(10)]}
    assert "best_efforts" not in S.build_activity_metrics(m, S.parse_activity_details(only_time))   # nichts Auswertbares: Block weg
    # leere Detailantwort: nichts wird angefasst
    assert S.build_activity_metrics(m, S.parse_activity_details({}))["best_efforts"] == m["best_efforts"]


def test_distance_bests_only_for_sports_where_they_mean_something():
    async def run():
        db = FakeDb(); uid = "be1"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": "ride", "sport_id": "cycling", "metrics": {}},
            {"user_id": uid, "source": "garmin", "source_record_id": "run", "sport_id": "running", "metrics": {}},
            {"user_id": uid, "source": "garmin", "source_record_id": "yoga", "sport_id": "yoga", "metrics": {}},
        ])
        await detail_sync.sync_activity_details(
            db, uid, lambda aid: _ride(total=120) if aid != "yoga" else {
                "metricDescriptors": [{"metricsIndex": 0, "key": "directTimestamp"}, {"metricsIndex": 1, "key": "sumDistance"}],
                "activityDetailMetrics": [{"metrics": [T0 + i * 1000, i * 5.0]} for i in range(200)]}, limit=5)
        m = {r["source_record_id"]: r["metrics"] for r in await db.select("activities", {"user_id": uid})}
        meta = {"v", "time_source", "rows", "total", "native"}
        assert set(m["ride"]["best_efforts"]) == {"power", "stats"} | meta                     # Rad: Leistung ja, Strecke nein
        assert set(m["run"]["best_efforts"]) == {"power", "distance", "distance_active", "stats"} | meta   # Lauf: beides
        assert m["run"]["best_efforts"]["distance_active"] == {"v": 1, "basis": "timer", "status": "no_timer_column"}   # v8-449.1: Befund steht, auch ohne Zahl
        assert "best_efforts" not in m["yoga"]                                                 # nichts Sinnvolles: nichts gespeichert
        st = m["ride"]["best_efforts"]["stats"]
        assert st["power"] == {"n": 120, "avg": 212.5, "max": 500.0} and st["heart_rate"]["avg"] == 140.0
        assert m["ride"]["best_efforts"]["native"] is True and m["ride"]["best_efforts"]["rows"] == 120
        assert all(x["detailsVersion"] == 3 for x in m.values())
    asyncio.run(run())


def test_windows_and_sports_are_the_agreed_ones():
    assert B.POWER_WINDOWS_S == (1, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600)
    assert B.DISTANCE_SPORTS == ("running", "walking", "hiking")
    assert B.APPROX_MIN_SAMPLES >= 5 and B.NATIVE_INTERVAL_MAX_S == 1.0


# ═══════════════════════════════════════════════════════════════════════════
# F · Fehlerklassen
# ═══════════════════════════════════════════════════════════════════════════

def test_failure_classification_is_by_exception_class():
    c = backfill.classify_failure
    assert c(AuthError("x")) == "AUTH" and c(RateLimited("x")) == "RATE_LIMIT"
    assert c(NotFound("x")) == "NOT_FOUND" and c(Unsupported("x")) == "UNSUPPORTED"
    assert c(ProviderUnavailable("x")) == "NETWORK" and c(TimeoutError()) == "NETWORK" and c(ConnectionError()) == "NETWORK"
    assert c(KeyError("404")) == "UNKNOWN" and c(ValueError("rate limit 429")) == "UNKNOWN"   # nie nach dem Text
    assert set(backfill.FAILURE_CATEGORIES) == {"AUTH", "RATE_LIMIT", "NOT_FOUND", "UNSUPPORTED", "NETWORK",
                                                "MALFORMED", "PERSISTENCE", "UNKNOWN"}


@pytest.mark.parametrize("exc,cat", [(RateLimited("429"), "RATE_LIMIT"), (AuthError("401"), "AUTH")])
def test_rate_limit_and_auth_end_the_run_at_once(exc, cat):
    calls = []

    def fetch(aid):
        calls.append(aid)
        if aid == "b":
            raise exc
        return DETAILS
    res = backfill.backfill_activity_details(["a", "b", "c", "d"], [], fetch, limit=10, max_retries=3)
    assert calls == ["a", "b"]                         # kein weiterer Abruf, keine sofortige Wiederholung
    assert res["aborted"] == cat and res["failures"] == {"b": cat}
    assert res["not_attempted"] == ["c", "d"] and set(res["details"]) == {"a"}
    assert res["failed_transient"] == ["b"]


def test_two_network_failures_in_a_row_end_the_run_one_does_not():
    def one(aid):
        if aid == "b":
            raise ProviderUnavailable("503")
        return DETAILS
    r1 = backfill.backfill_activity_details(["a", "b", "c"], [], one, limit=10)
    assert r1["aborted"] is None and set(r1["details"]) == {"a", "c"} and r1["failures"] == {"b": "NETWORK"}

    calls = []

    def two(aid):
        calls.append(aid)
        if aid in ("b", "c"):
            raise ProviderUnavailable("503")
        return DETAILS
    r2 = backfill.backfill_activity_details(["a", "b", "c", "d", "e"], [], two, limit=10)
    assert calls == ["a", "b", "c"] and r2["aborted"] == "NETWORK" and r2["not_attempted"] == ["d", "e"]


def test_malformed_answer_is_its_own_category():
    def fetch(aid):
        return {"a": "kein dict", "b": None, "c": ["liste"]}.get(aid, DETAILS)
    res = backfill.backfill_activity_details(["a", "b", "c", "d"], [], fetch, limit=10)
    assert res["failures"] == {"a": "MALFORMED", "b": "MALFORMED", "c": "MALFORMED"} and set(res["details"]) == {"d"}
    assert res["aborted"] is None and res["failed_transient"] == []


def test_only_activity_specific_failures_lead_to_deferral():
    """NOT_FOUND / UNSUPPORTED / MALFORMED zaehlen. AUTH / RATE_LIMIT / NETWORK nie — eine
    abgelaufene Sitzung darf nicht nach und nach den ganzen Bestand zurueckstellen."""
    async def run(exc_or_value, runs=4):
        db = FakeDb(); uid = "t1"
        await db.insert("activities", [{"id": 71, "user_id": uid, "source": "garmin", "source_record_id": "X", "sport_id": "running", "metrics": {"keep": 1}}])

        def fetch(aid):
            if isinstance(exc_or_value, BaseException):
                raise exc_or_value
            return exc_or_value
        last = None
        for _ in range(runs):
            last = await detail_sync.sync_activity_details(db, uid, fetch, limit=3)
        return (await db.select("activities", {"user_id": uid}))[0]["metrics"], last

    for exc, cat in ((NotFound("404"), "NOT_FOUND"), (Unsupported("400"), "UNSUPPORTED"), ("unlesbar", "MALFORMED")):
        m, last = asyncio.run(run(exc))
        assert m["detailsFailCount"] == 3 and m["detailsFailCategory"] == cat and m["keep"] == 1, cat
        assert last["selected"] == [] and last["status"]["deferred"] == 1          # 4. Lauf: zurueckgestellt
        assert last["status"]["by_category"] == {cat: 1}
    for exc in (AuthError("401"), RateLimited("429"), ProviderUnavailable("503")):
        m, last = asyncio.run(run(exc))
        assert "detailsFailCount" not in m and m == {"keep": 1}, type(exc).__name__
        assert last["selected"] == ["X"] and last["status"]["deferred"] == 0       # wird weiter versucht


def test_unknown_failure_counts_only_if_another_activity_succeeded():
    async def run(with_success):
        db = FakeDb(); uid = "t2"
        rows = [{"user_id": uid, "source": "garmin", "source_record_id": "bad", "sport_id": "running",
                 "started_at": "2026-09-02T06:00:00+00:00", "metrics": {}}]
        if with_success:
            rows.append({"user_id": uid, "source": "garmin", "source_record_id": "good", "sport_id": "running",
                         "started_at": "2026-09-01T06:00:00+00:00", "metrics": {}})
        await db.insert("activities", rows)

        def fetch(aid):
            if aid == "bad":
                raise RuntimeError("irgendwas")
            return DETAILS
        res = await detail_sync.sync_activity_details(db, uid, fetch, limit=5)
        return (await db.select("activities", {"user_id": uid, "source_record_id": "bad"}))[0]["metrics"], res
    m, res = asyncio.run(run(True))
    assert m["detailsFailCount"] == 1 and m["detailsFailCategory"] == "UNKNOWN" and res["by_category"] == {"UNKNOWN": 1}
    m2, res2 = asyncio.run(run(False))
    assert "detailsFailCount" not in m2 and res2["failures"] == {"bad": "UNKNOWN"}   # kann alles betreffen: nicht angelastet


def test_persistence_failure_is_not_blamed_on_the_activity_and_does_not_stop_the_rest():
    class FlakyDb(FakeDb):
        async def update(self, table, flt, patch):
            if table == "activities" and flt.get("source_record_id") == "A" and "streams" in (patch.get("metrics") or {}):
                raise RuntimeError("503 from PostgREST")
            return await super().update(table, flt, patch)

    async def run():
        db = FlakyDb(); uid = "t3"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": "A", "sport_id": "running", "started_at": "2026-09-02T06:00:00+00:00", "metrics": {}},
            {"user_id": uid, "source": "garmin", "source_record_id": "B", "sport_id": "running", "started_at": "2026-09-01T06:00:00+00:00", "metrics": {}}])
        res = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=5)
        assert res["updated"] == 1 and res["failed"] == ["A"] and res["failures"] == {"A": "PERSISTENCE"}
        rows = {r["source_record_id"]: r["metrics"] for r in await db.select("activities", {"user_id": uid})}
        assert rows["A"] == {} and rows["B"]["detailsVersion"] == 3
        assert res["status"]["pending"] == 1 and res["status"]["current"] == 1
    asyncio.run(run())


def test_success_clears_every_failure_marker():
    async def run():
        db = FakeDb(); uid = "t4"
        old = (datetime.now(timezone.utc) - timedelta(days=9)).isoformat()
        await db.insert("activities", [{"user_id": uid, "source": "garmin", "source_record_id": "P", "sport_id": "running",
                                        "metrics": {"detailsFailCount": 3, "detailsFailedAt": old, "detailsFailCategory": "NOT_FOUND"}}])
        await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=5)
        m = (await db.select("activities", {"user_id": uid}))[0]["metrics"]
        assert not any(k.startswith("detailsFail") for k in m) and m["detailsVersion"] == 3
    asyncio.run(run())


def test_log_lines_carry_internal_id_and_category_but_no_garmin_id(caplog):
    async def run():
        db = FakeDb(); uid = "t5"
        await db.insert("activities", [
            {"id": 9001, "user_id": uid, "source": "garmin", "source_record_id": "21234567890", "sport_id": "running",
             "started_at": "2026-09-02T06:00:00+00:00", "metrics": {}},
            {"id": 9002, "user_id": uid, "source": "garmin", "source_record_id": "21234567891", "sport_id": "cycling",
             "started_at": "2026-09-01T06:00:00+00:00", "metrics": {}}])

        def fetch(aid):
            if aid.endswith("1"):
                raise NotFound("404")
            return DETAILS
        await detail_sync.sync_activity_details(db, uid, fetch, limit=5)
    with caplog.at_level("INFO", logger="orvia.details"):
        asyncio.run(run())
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "activity=9001" in text and "status=ok" in text and "version=0->3" in text
    assert "activity=9002" in text and "category=NOT_FOUND" in text and "sport=cycling" in text
    assert "21234567890" not in text and "21234567891" not in text and "t5" not in text


# ═══════════════════════════════════════════════════════════════════════════
# S · Stand des Nachladens
# ═══════════════════════════════════════════════════════════════════════════

def test_backfill_status_counts():
    now = datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc)
    recent, old = (now - timedelta(hours=3)).isoformat(), (now - timedelta(days=3)).isoformat()
    parked_at = (now - timedelta(days=2)).isoformat()
    rows = (
        [{"sport_id": "running", "metrics": {"detailsFetchedAt": recent, "detailsVersion": 3}}] * 4
        + [{"sport_id": "cycling", "metrics": {"detailsFetchedAt": old, "detailsVersion": 3}}] * 2
        + [{"sport_id": "running", "metrics": {"detailsFetchedAt": old, "detailsVersion": 2}}] * 3            # legacy
        + [{"sport_id": "gym", "metrics": {}}] * 2                                                             # never
        + [{"sport_id": "gym", "metrics": {"detailsFailCount": 1, "detailsFailedAt": recent, "detailsFailCategory": "MALFORMED"}}]
        + [{"sport_id": "running", "metrics": {"detailsFetchedAt": old, "detailsVersion": 1, "detailsFailCount": 3,
                                               "detailsFailedAt": parked_at, "detailsFailCategory": "NOT_FOUND"}}]
        + [None, "muell"]
    )
    st = detail_sync.backfill_status(rows, now)
    assert (st["total"], st["current"], st["pending"], st["deferred"], st["failing"]) == (13, 6, 6, 1, 1)
    assert (st["legacy"], st["never"]) == (3, 3) and st["by_category"] == {"MALFORMED": 1, "NOT_FOUND": 1}
    assert st["processed_24h"] == 4 and st["last_processed"] == recent and st["contract"] == 3
    assert st["by_sport"]["running"] == {"total": 8, "current": 4} and st["by_sport"]["gym"] == {"total": 3, "current": 0}
    assert st["total"] == st["current"] + st["pending"] + st["deferred"]
    assert detail_sync.eta_runs(st, 10) == 1 and detail_sync.eta_runs({"pending": 31}, 10) == 4
    assert detail_sync.eta_runs({"pending": 0}, 10) == 0 and detail_sync.eta_runs(None, 10) is None
    assert "user" not in json.dumps(st) and "source_record_id" not in json.dumps(st)


def test_details_version_progresses_run_by_run_and_then_stops():
    """Resumable: jeder Lauf nimmt die naechsten `limit`, nichts wird doppelt geladen."""
    async def run():
        db = FakeDb(); uid = "s1"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": f"a{i:02d}", "sport_id": "running",
             "started_at": f"2026-08-{i + 1:02d}T06:00:00+00:00",
             "metrics": {"detailsFetchedAt": "2026-01-01T00:00:00+00:00", "detailsVersion": 2}} for i in range(7)])
        calls = []

        def fetch(aid):
            calls.append(aid)
            return DETAILS
        seen = []
        for _ in range(4):
            res = await detail_sync.sync_activity_details(db, uid, fetch, limit=3)
            seen.append((res["status"]["current"], res["status"]["pending"], len(res["selected"])))
        assert seen == [(3, 4, 3), (6, 1, 3), (7, 0, 1), (7, 0, 0)]
        assert len(calls) == 7 and len(set(calls)) == 7                # jede genau einmal
        assert calls[:3] == ["a06", "a05", "a04"]                      # neueste zuerst
    asyncio.run(run())


# ═══════════════════════════════════════════════════════════════════════════
# M · HTTP-Status → Fehlerklasse
# ═══════════════════════════════════════════════════════════════════════════

class _Resp:
    def __init__(self, code):
        self.status_code = code


def test_http_status_extraction_without_guessing():
    from orvia_worker.providers.garmin_unofficial import _http_status
    e = RuntimeError("x"); e.response = _Resp(404)
    assert _http_status(e) == 404
    inner = RuntimeError("inner"); inner.response = _Resp(429)
    try:
        try:
            raise inner
        except RuntimeError as ie:
            raise ValueError("outer") from ie
    except ValueError as outer:
        assert _http_status(outer) == 429                       # Ursache wird mitgelesen
    assert _http_status(RuntimeError("API call client error (404): not found")) == 404
    assert _http_status(RuntimeError("Mobile login failed (non-JSON): HTTP 403")) == 403
    assert _http_status(RuntimeError("activity 21234567890 kaputt")) is None      # eine Nummer ist kein Status
    assert _http_status(RuntimeError("")) is None


def test_library_errors_map_to_the_right_category():
    gc = pytest.importorskip("garminconnect", reason="garminconnect nicht installiert (braucht Python ≥ 3.12)")
    from orvia_worker.providers.garmin_unofficial import _map_exception

    def conn(status, with_response=True):
        e = gc.GarminConnectConnectionError(f"API call client error ({status}): x")
        if with_response:
            e.response = _Resp(status)
        return e
    for status, cls in ((404, NotFound), (410, NotFound), (400, Unsupported), (422, Unsupported),
                        (401, AuthError), (429, RateLimited), (500, ProviderUnavailable), (503, ProviderUnavailable),
                        (403, ProviderUnavailable)):
        assert type(_map_exception(conn(status))) is cls, status
        assert type(_map_exception(conn(status, with_response=False))) is cls, (status, "aus dem Text")
    assert type(_map_exception(gc.GarminConnectConnectionError("Verbindung weg"))) is ProviderUnavailable
    assert type(_map_exception(gc.GarminConnectTooManyRequestsError("x"))) is RateLimited
    assert type(_map_exception(gc.GarminConnectAuthenticationError("x"))) is AuthError
    assert backfill.classify_failure(_map_exception(conn(404))) == "NOT_FOUND"    # bis v8-447: „nicht erreichbar"
    msg = str(_map_exception(conn(404)))
    assert "x" not in msg.replace("Garmin kennt die Ressource nicht", "")         # kein Bibliothekstext in unserer Meldung


def test_deleted_activity_is_deferred_through_the_real_provider():
    """Ende-zu-Ende ueber den Provider: 404 von Garmin → NOT_FOUND → nach drei Laeufen zurueckgestellt."""
    gc = pytest.importorskip("garminconnect", reason="garminconnect nicht installiert (braucht Python ≥ 3.12)")
    from orvia_worker.providers.garmin_unofficial import GarminUnofficialProvider

    class Api:
        def get_activity_details(self, aid, *a):
            e = gc.GarminConnectConnectionError("API call client error (404): gone")
            e.response = _Resp(404)
            raise e
    provider = GarminUnofficialProvider(api=Api())

    async def run():
        db = FakeDb(); uid = "m1"
        await db.insert("activities", [{"user_id": uid, "source": "garmin", "source_record_id": "1", "sport_id": "running", "metrics": {}}])
        for _ in range(3):
            res = await detail_sync.sync_activity_details(db, uid, provider.get_activity_details, limit=3)
            assert res["failures"] == {"1": "NOT_FOUND"} and res["aborted"] is None
        m = (await db.select("activities", {"user_id": uid}))[0]["metrics"]
        assert m["detailsFailCount"] == 3 and m["detailsFailCategory"] == "NOT_FOUND"
        assert (await detail_sync.sync_activity_details(db, uid, provider.get_activity_details, limit=3))["selected"] == []
    asyncio.run(run())


# ═══════════════════════════════════════════════════════════════════════════
# D · kein stiller Verlust
# ═══════════════════════════════════════════════════════════════════════════

def test_allowlisted_field_in_unexpected_shape_is_reported_not_silently_dropped(caplog):
    raw = {"activityId": 1, "activityType": {"typeKey": "running"}, "startTimeGMT": "2026-07-12 06:30:00",
           "distance": 5000.0, "avgPower": {"value": 212.0}, "averageHR": float("nan"), "maxHR": None,
           "trainingEffectLabel": "x" * 80, "ownerDisplayName": {"a": 1}}
    assert GF.rejected_names(raw) == ["averageHR", "avgPower", "trainingEffectLabel"]
    with caplog.at_level("WARNING", logger="orvia.normalize"):
        act = normalize.normalize_activity(raw)
    ext = act.metrics["ext"]
    assert ext["rejected"] == ["averageHR", "avgPower", "trainingEffectLabel"] and ext["fields"] == {"distance": 5000.0}
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "avgPower" in text and "212" not in text and "sport=running" in text     # Namen ja, Werte nein
    clean = normalize.normalize_activity({"activityId": 2, "activityType": {"typeKey": "running"},
                                          "startTimeGMT": "2026-07-12 06:30:00", "distance": 1.0, "maxHR": None})
    assert "rejected" not in clean.metrics["ext"]                                   # None ist „nicht geliefert", kein Verlust
    assert GF.rejected_names(None) == [] and GF.rejected_names({"unitOfPoolLength": {"unitKey": "meter"}}) == []


# ═══════════════════════════════════════════════════════════════════════════
# C · Abtastung und Healthcheck
# ═══════════════════════════════════════════════════════════════════════════

def test_maxchart_is_passed_only_when_set():
    from orvia_worker.config import Settings
    from orvia_worker.providers.garmin_unofficial import GarminUnofficialProvider
    base = {"SUPABASE_URL": "https://x.invalid", "SUPABASE_SERVICE_ROLE_KEY": "k", "TOKEN_ENCRYPTION_KEY": "k"}
    assert Settings.from_env(base).detail_maxchart == 0
    assert Settings.from_env({**base, "DETAIL_MAXCHART": "8000"}).detail_maxchart == 8000
    assert Settings.from_env({**base, "DETAIL_MAXCHART": "999999"}).detail_maxchart == 30000   # gedeckelt
    assert Settings.from_env({**base, "DETAIL_MAXCHART": "-5"}).detail_maxchart == 0
    seen = []

    class Api:
        def get_activity_details(self, *args):
            seen.append(args)
            return {}
    p = GarminUnofficialProvider(api=Api())
    p.get_activity_details("7")
    p.get_activity_details("7", 8000)
    p.get_activity_details("7", 0)
    p.get_activity_details("7", True)
    assert seen == [("7",), ("7", 8000), ("7",), ("7",)]                           # Standard der Bibliothek bleibt unangetastet


def test_sync_passes_maxchart_and_reports_backfill_status(fake_db, test_crypto, test_settings, fake_garmin_api):
    import dataclasses

    from orvia_worker.providers.garmin_unofficial import GarminUnofficialProvider
    from orvia_worker.sync import sync_user
    user = "user-c1"
    fake_db.tables["data_providers"] = [{"id": "prov-1", "user_id": user, "provider_type": "garmin_unofficial",
                                         "connection_status": "connected", "last_successful_sync_at": None}]
    ciphertext, version = test_crypto.encrypt_str('{"di_token":"x"}')
    fake_db.tables["provider_credentials"] = [{"id": "cred-1", "user_id": user, "provider_type": "garmin_unofficial",
                                               "credential_kind": "session_tokens", "encrypted_payload": ciphertext,
                                               "key_version": version}]
    args_seen = []
    orig = fake_garmin_api.get_activity_details

    def spy(activity_id, *a, **k):
        args_seen.append(a)
        return orig(activity_id, *a, **k)
    fake_garmin_api.get_activity_details = spy
    provider = GarminUnofficialProvider(api=fake_garmin_api)
    res = asyncio.run(sync_user(user, db=fake_db, crypto=test_crypto,
                                settings=dataclasses.replace(test_settings, detail_maxchart=9000),
                                provider_factory=lambda token: provider))
    assert res["ok"] is True, res["errors"]
    assert args_seen and all(a == (9000,) for a in args_seen)
    assert res["steps"]["backfill"].startswith("v3:3/3 pending:0 failing:0 deferred:0")
    assert res["steps"]["activity_details"].startswith("ok:3 selected:3 failed:0")


def test_rate_limit_in_details_marks_the_run_and_skips_the_day_series(fake_db, test_crypto, test_settings, fake_garmin_api):
    from orvia_worker.providers.garmin_unofficial import GarminUnofficialProvider
    from orvia_worker.sync import sync_user
    user = "user-c2"
    fake_db.tables["data_providers"] = [{"id": "prov-1", "user_id": user, "provider_type": "garmin_unofficial",
                                         "connection_status": "connected", "last_successful_sync_at": None}]
    ciphertext, version = test_crypto.encrypt_str('{"di_token":"x"}')
    fake_db.tables["provider_credentials"] = [{"id": "cred-1", "user_id": user, "provider_type": "garmin_unofficial",
                                               "credential_kind": "session_tokens", "encrypted_payload": ciphertext,
                                               "key_version": version}]
    calls = {"details": 0}

    def limited(activity_id, *a, **k):
        calls["details"] += 1
        raise RateLimited("429")
    provider = GarminUnofficialProvider(api=fake_garmin_api)
    provider.get_activity_details = limited
    n_before = len(fake_garmin_api.calls)
    res = asyncio.run(sync_user(user, db=fake_db, crypto=test_crypto, settings=test_settings,
                                provider_factory=lambda token: provider))
    assert calls["details"] == 1                                                     # nach dem ersten 429 kein weiterer Abruf
    assert res["ok"] is False and "details:RATE_LIMITED" in res["errors"]            # der Zeitplaner verlaengert die Pause
    assert "aborted:RATE_LIMIT" in res["steps"]["activity_details"] and res["steps"]["series"] == "skipped:rate_limit"
    after = [c[0] for c in fake_garmin_api.calls[n_before:]]
    assert len(fake_db.tables["activities"]) == 3                                    # die Aktivitaeten selbst sind gespeichert
    assert all("detailsFailCount" not in (a["metrics"] or {}) for a in fake_db.tables["activities"])
    assert fake_db.tables["data_providers"][0]["last_error_code"] == "RATE_LIMITED"
    assert after                                                                     # (Abrufe davor liefen normal)


def test_series_stats_are_raw_facts_from_all_delivered_rows():
    """Mittel und Maximum aus ALLEN gelieferten Zeilen — nicht aus der Anzeige-Reihe."""
    assert B.series_stats([100.0, 200.0, None, 300.0]) == {"n": 3, "avg": 200.0, "max": 300.0}
    assert B.series_stats([0.0, 0.0, 90.0, 90.0]) == {"n": 4, "avg": 45.0, "max": 90.0, "avg_nz": 90.0, "n_zero": 2}
    assert B.series_stats([None, None]) is None and B.series_stats("x") is None and B.series_stats([]) is None
    out = S.parse_activity_details(DETAILS)
    st = out["best"]["stats"]
    assert st["cadence"]["kind"] == "running_cadence_spm" and 155 < st["cadence"]["avg"] < 167 and st["cadence"]["n"] == 1855
    assert st["heart_rate"]["n"] == 1855 and st["heart_rate"]["max"] == 185.0
    assert out["best"]["native"] is False and out["best"]["total"] == 5527      # Garmin hat ausgeduennt: Mittel = Naeherung
    disp = out["streams"]["heart_rate"]
    assert len(disp) < 300 and abs(sum(disp) / len(disp) - st["heart_rate"]["avg"]) < 3   # Anzeige-Reihe: aehnlich, nicht gleich
    ride = S.parse_activity_details(_ride(total=120))["best"]["stats"]
    assert "cadence" not in ride                                                # keine Kadenzreihe geliefert: kein Kennwert
