"""v8-447.1 · Bedeutungspruefung: Summenwert des Listeneintrags gegen die Aufzeichnung.

Der Zensus zeigt, DASS Garmin ein Feld liefert. Was es BEDEUTET, zeigt nur der Vergleich zweier
unabhaengiger Angaben derselben Aktivitaet:

    Listeneintrag (Garmins Summenwert)   ↔   Detailantwort (alle gelieferten Messzeilen)

Je Beziehung werden mehrere KANDIDATEN gerechnet (z. B. Kadenz beider Beine / eines Beins,
Mittel mit / ohne Nullen, zeitgewichtet / je Zeile) und es wird festgehalten, welcher passt.
Passt keiner, wird die Abweichung so beschrieben, dass sich die Ursache nachvollziehen laesst
(`hints`), statt nur „mismatch" zu melden.

Warum zeitgewichtet: Garmin duennt die Detailantwort ungleichmaessig aus (im echten Mitschnitt
Abstaende von 1 s bis 460 s). Ein Mittel „je Zeile" ueberbewertet dann dicht abgetastete
Abschnitte. Mit vollstaendiger Antwort (maxchart hoch genug, Abstand 1 s) fallen beide
Rechnungen fast zusammen — deshalb gehoert jede Pruefung auch auf die VOLLSTAENDIGE Antwort.

Rein: keine Netzaufrufe, kein Zustand. Ausgabe enthaelt Urteile und ABWEICHUNGEN (Differenzen,
Verhaeltnisse) — keine Rohwerte der Aktivitaet, keine Kennungen.
"""

from __future__ import annotations

import math
from typing import Any

SEM_VERSION = 1

# Toleranzen je Beziehung: (absolut, relativ) — es gilt die groessere.
TOL = {
    "duration": (5.0, 0.01),
    "movingDuration": (5.0, 0.01),
    "elapsedDuration": (5.0, 0.01),
    "distance": (20.0, 0.01),
    "averageHR": (2.0, 0.0),
    "maxHR": (3.0, 0.0),
    "averageRunningCadence": (3.0, 0.0),
    "maxRunningCadence": (3.0, 0.0),
    "averageBikingCadence": (2.0, 0.0),
    "avgPower": (3.0, 0.02),
    "maxPower": (5.0, 0.02),
    "averageSpeed": (0.05, 0.02),
}

HOLD_FACTOR = 2.0       # wie best_efforts: bis zum Doppelten des ueblichen Abstands gilt eine Zeile durchgehend


def _num(v: Any) -> float | None:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    f = float(v)
    return f if math.isfinite(f) else None


def _columns(details: Any) -> tuple[dict, list]:
    if not isinstance(details, dict):
        return {}, []
    desc = {}
    for m in details.get("metricDescriptors") or []:
        if isinstance(m, dict) and isinstance(m.get("key"), str) and isinstance(m.get("metricsIndex"), int):
            desc[m["key"]] = m["metricsIndex"]
    rows = [r.get("metrics") for r in (details.get("activityDetailMetrics") or [])
            if isinstance(r, dict) and isinstance(r.get("metrics"), list)]
    return desc, rows


def _col(desc: dict, rows: list, key: str) -> list[float | None] | None:
    idx = desc.get(key)
    if idx is None:
        return None
    vals = [(_num(r[idx]) if idx < len(r) else None) for r in rows]
    return vals if any(v is not None for v in vals) else None


def _weights(times_s: list[float | None]) -> list[float]:
    """Zeitanteil je Zeile: Stueck bis zur vorigen Zeile, gedeckelt auf HOLD_FACTOR × ueblicher
    Abstand (Pausen und Aussetzer zaehlen nicht als Zeit des Messwerts)."""
    ts = [t for t in times_s if t is not None]
    gaps = sorted(b - a for a, b in zip(ts, ts[1:]) if b - a > 1e-9)
    h = gaps[len(gaps) // 2] if gaps else 1.0
    cap = HOLD_FACTOR * h
    out, prev = [], None
    for t in times_s:
        if t is None:
            out.append(0.0)
            continue
        if prev is None:
            w = h
        else:
            dt = t - prev
            w = 0.0 if dt <= 1e-9 else (dt if dt <= cap + 1e-9 else h)
        out.append(w)
        prev = t
    return out


def aggregates(details: Any) -> dict:
    """Kennwerte aus ALLEN gelieferten Zeilen der Detailantwort — je Groesse mehrere Lesarten."""
    desc, rows = _columns(details)
    out: dict[str, Any] = {"v": SEM_VERSION, "rows": len(rows)}
    total = details.get("totalMetricsCount") if isinstance(details, dict) else None
    out["total"] = total if isinstance(total, int) and not isinstance(total, bool) else None
    out["complete"] = bool(out["total"] is not None and len(rows) >= out["total"])
    if not rows:
        return out
    ts_ms = _col(desc, rows, "directTimestamp")
    times = None
    if ts_ms is not None:
        first = next(v for v in ts_ms if v is not None)
        times = [None if v is None else (v - first) / 1000.0 for v in ts_ms]
        gaps = sorted(b - a for a, b in zip([t for t in times if t is not None], [t for t in times if t is not None][1:]) if b - a > 1e-9)
        out["interval_s"] = gaps[len(gaps) // 2] if gaps else None
        tt = [t for t in times if t is not None]
        out["elapsed_by_timestamps"] = (tt[-1] - tt[0]) if len(tt) > 1 else None
    # Gewicht je Zeile = Timer-Zeit, die sie vertritt (Zuwachs von sumDuration). Die Timer-Zeit
    # steht waehrend einer Pause still — Pausen bekommen so kein Gewicht — und ueberbrueckt die
    # Luecken der Ausduennung richtig. Ohne Timer-Spalte: Zeitstempel mit gedeckelten Luecken
    # (dann sind Ausduennungs-Luecken und Pausen nicht zu unterscheiden).
    timer = _col(desc, rows, "sumDuration")
    if timer is not None:
        w, prev = [], None
        for v in timer:
            if v is None:
                w.append(0.0)
                continue
            w.append(0.0 if prev is None else max(0.0, v - prev))
            prev = v
        if w and w[0] == 0.0 and len(w) > 1:
            pos = sorted(x for x in w if x > 0)
            w[0] = pos[len(pos) // 2] if pos else 1.0          # erste Zeile: ueblicher Abstand
        out["weights"] = "timer"
    elif times is not None:
        w = _weights(times)
        out["weights"] = "timestamps"
    else:
        w = [1.0] * len(rows)
        out["weights"] = "rows"

    def last(key):
        c = _col(desc, rows, key)
        return next((v for v in reversed(c) if v is not None), None) if c else None

    def mx(key):
        c = _col(desc, rows, key)
        return max(v for v in c if v is not None) if c else None

    def means(key):
        c = _col(desc, rows, key)
        if c is None:
            return None
        res = {}
        for label, keep in (("all", lambda v: True), ("nz", lambda v: v > 0)):
            pts = [(v, wi) for v, wi in zip(c, w) if v is not None and keep(v)]
            if not pts:
                continue
            res["point_" + label] = sum(v for v, _ in pts) / len(pts)
            sw = sum(wi for _, wi in pts)
            if sw > 0:
                res["time_" + label] = sum(v * wi for v, wi in pts) / sw
        return res or None

    for name, key in (("timer_end", "sumDuration"), ("moving_end", "sumMovingDuration"),
                      ("elapsed_end", "sumElapsedDuration"), ("distance_end", "sumDistance")):
        v = last(key)
        if v is not None:
            out[name] = v
    md = mx("sumDistance")
    if md is not None:
        out["distance_max"] = md
    for name, key in (("heart_rate", "directHeartRate"), ("double_cadence", "directDoubleCadence"),
                      ("run_cadence", "directRunCadence"), ("bike_cadence", "directBikeCadence"),
                      ("power", "directPower"), ("speed", "directSpeed")):
        m = means(key)
        if m:
            out[name] = m
            mv = mx(key)
            if mv is not None:
                out[name]["max"] = mv
    # Zeit mit Bewegung laut Geschwindigkeitsreihe (> 0) — eine Lesart von „Bewegungszeit"
    sp = _col(desc, rows, "directSpeed")
    if sp is not None and times is not None:
        out["time_speed_gt0"] = sum(wi for v, wi in zip(sp, w) if v is not None and v > 0)
    return out


def _f(fields: dict, key: str) -> float | None:
    return _num(fields.get(key)) if isinstance(fields, dict) else None


def _pool_length_m(fields: dict) -> list[tuple[str, float]]:
    """Bahnlaenge in Metern — in beiden Lesarten des Listenfelds, weil die Einheit unbelegt ist:
    poolLength in Metern ODER in Zentimetern (unitOfPoolLength.factor = 100 bei Metern)."""
    pl = _f(fields, "poolLength")
    if pl is None or pl <= 0:
        return []
    unit = fields.get("unitOfPoolLength")
    factor = _num(unit.get("factor")) if isinstance(unit, dict) else None
    key = (unit.get("unitKey") if isinstance(unit, dict) else unit) or ""
    yard = 0.9144 if str(key).lower().startswith("yard") else 1.0
    out = [("poolLength als Meter", pl * yard), ("poolLength als Zentimeter", pl / 100.0 * yard)]
    if factor and factor not in (1.0, 100.0):
        out.append((f"poolLength / {factor:g}", pl / factor * yard))
    return out


def relations(fields: dict, agg: dict) -> dict:
    """Je Beziehung: {verdict: match|mismatch|n/a, matches, best, diff, rel_pct, hints}."""
    out: dict[str, Any] = {}
    if not isinstance(fields, dict) or not isinstance(agg, dict):
        return out
    delivery = "complete" if agg.get("complete") else ("thinned" if agg.get("total") else "unknown")

    def g(path):
        cur: Any = agg
        for p in path.split("."):
            cur = cur.get(p) if isinstance(cur, dict) else None
        return _num(cur)

    def rel(name, list_key, cands):
        lv = _f(fields, list_key)
        cs = {k: v for k, v in cands.items() if v is not None}
        if lv is None or not cs:
            out[name] = {"verdict": "n/a", "matches": None}
            return None
        a, r = TOL[name]
        tol = lambda x: max(a, r * max(abs(lv), abs(x)))  # noqa: E731
        hit = [k for k, v in cs.items() if abs(lv - v) <= tol(v)]
        best = min(cs, key=lambda k: abs(lv - cs[k]))
        d = lv - cs[best]
        item = {"verdict": "match" if hit else "mismatch", "matches": hit or None, "best": best,
                "diff": round(d, 2), "rel_pct": round(100.0 * d / cs[best], 2) if cs[best] else None, "hints": []}
        if not hit and delivery == "thinned":
            item["hints"].append("thinned_response: Garmin hat ausgeduennt — mit vollstaendiger Antwort erneut pruefen")
        out[name] = item
        return item

    rel("duration", "duration", {"sumDuration (Timer)": g("timer_end"), "sumMovingDuration": g("moving_end"),
                                  "sumElapsedDuration": g("elapsed_end")})
    mv = rel("movingDuration", "movingDuration", {"sumMovingDuration": g("moving_end"), "sumDuration (Timer)": g("timer_end"),
                                                   "Zeit mit Geschwindigkeit > 0": g("time_speed_gt0")})
    if mv and mv["verdict"] == "mismatch" and g("moving_end") is not None:
        mv["hints"].append("two_definitions: Listen- und Aufzeichnungs-Bewegungszeit nutzen verschiedene Schwellen — "
                           "nicht austauschbar; je Auswertung EINE Quelle festlegen")
    if mv and mv.get("matches") == ["sumDuration (Timer)"]:
        mv["hints"].append("list_moving_equals_timer: der Listenwert ist hier die Timer-Zeit")
    rel("elapsedDuration", "elapsedDuration", {"sumElapsedDuration": g("elapsed_end"), "Zeitstempel letzte − erste Zeile": g("elapsed_by_timestamps")})

    dist_cands = {"sumDistance (letzte Zeile)": g("distance_end"), "sumDistance (Maximum)": g("distance_max")}
    al = _f(fields, "activeLengths")
    for label, plm in _pool_length_m(fields):
        if al is not None:
            dist_cands[f"activeLengths × {label}"] = al * plm
    dist = rel("distance", "distance", dist_cands)
    if dist and dist["verdict"] != "n/a":
        for label, plm in _pool_length_m(fields):
            ref = g("distance_end")
            if ref is not None and plm > 0:
                n = (_f(fields, "distance") - ref) / plm
                if abs(n - round(n)) < 0.05 and round(n) != 0:
                    dist["hints"].append(f"pool_lengths: Abweichung = {round(n):+d} Bahn(en) bei {label} — "
                                         "Laengen-Raster der Aufzeichnung (letzte Bahn / Pause / Uebung)")
        if g("distance_end") is not None and g("distance_max") is not None and g("distance_max") - g("distance_end") > 1:
            dist["hints"].append("distance_end_below_max: die letzte Zeile traegt nicht die groesste Distanz")

    rel("averageHR", "averageHR", {"zeitgewichtet": g("heart_rate.time_all"), "je Zeile": g("heart_rate.point_all")})
    rel("maxHR", "maxHR", {"Maximum directHeartRate": g("heart_rate.max")})
    cad = rel("averageRunningCadence", "averageRunningCadenceInStepsPerMinute", {
        "directDoubleCadence zeitgewichtet ohne Nullen": g("double_cadence.time_nz"),
        "directDoubleCadence zeitgewichtet mit Nullen": g("double_cadence.time_all"),
        "directDoubleCadence je Zeile ohne Nullen": g("double_cadence.point_nz"),
        "directRunCadence zeitgewichtet ohne Nullen (ein Bein)": g("run_cadence.time_nz"),
    })
    if cad and cad["verdict"] != "n/a":
        lv = _f(fields, "averageRunningCadenceInStepsPerMinute")
        dc = g("double_cadence.time_nz")
        if lv and dc:
            ratio = lv / dc
            if abs(ratio - 0.5) < 0.03:
                cad["hints"].append("half_value: der Listenwert ist die Frequenz EINES Beins")
            elif abs(ratio - 1.0) < 0.03 and cad["verdict"] == "mismatch":
                cad["hints"].append("near_full: Listenwert ≈ Schrittfrequenz beider Beine, Abweichung im Rahmen der Mittelung")
        if cad.get("matches") and all("Nullen" in m for m in cad["matches"]):
            if not any("mit Nullen" in m for m in cad["matches"]):
                cad["hints"].append("excludes_zero: Garmins Mittel laesst Stillstand (0 spm) weg")
    rel("maxRunningCadence", "maxRunningCadenceInStepsPerMinute", {"Maximum directDoubleCadence": g("double_cadence.max"),
                                                                    "Maximum directRunCadence (ein Bein)": g("run_cadence.max")})
    rel("averageBikingCadence", "averageBikingCadenceInRevPerMinute", {
        "directBikeCadence zeitgewichtet ohne Nullen": g("bike_cadence.time_nz"),
        "directBikeCadence zeitgewichtet mit Nullen": g("bike_cadence.time_all")})
    rel("avgPower", "avgPower", {"directPower zeitgewichtet mit Nullen": g("power.time_all"),
                                 "directPower zeitgewichtet ohne Nullen": g("power.time_nz")})
    rel("maxPower", "maxPower", {"Maximum directPower": g("power.max")})
    timer, moving, dist_end = g("timer_end"), g("moving_end"), g("distance_end")
    rel("averageSpeed", "averageSpeed", {
        "Distanz / Timer": (dist_end / timer) if dist_end and timer else None,
        "Distanz / Bewegungszeit": (dist_end / moving) if dist_end and moving else None,
        "directSpeed zeitgewichtet": g("speed.time_all")})
    out["_delivery"] = {"rows": agg.get("rows"), "total": agg.get("total"), "complete": agg.get("complete"),
                        "interval_s": agg.get("interval_s")}
    return out


def compact_for_row(rels: dict) -> dict | None:
    """Fuer metrics.ext.semantics: nur Beziehungen mit Urteil, ohne leere Felder."""
    if not isinstance(rels, dict):
        return None
    out: dict[str, Any] = {"v": SEM_VERSION}
    for k, v in rels.items():
        if k == "_delivery":
            out["delivery"] = v
            continue
        if not isinstance(v, dict) or v.get("verdict") == "n/a":
            continue
        out[k] = {kk: vv for kk, vv in v.items() if vv not in (None, [], "")}
    return out if any(k not in ("v", "delivery") for k in out) else None


# Listenfeld je Beziehung — fuer `confirmed`
LIST_KEY = {
    "duration": "duration", "movingDuration": "movingDuration", "elapsedDuration": "elapsedDuration",
    "distance": "distance", "averageHR": "averageHR", "maxHR": "maxHR",
    "averageRunningCadence": "averageRunningCadenceInStepsPerMinute", "maxRunningCadence": "maxRunningCadenceInStepsPerMinute",
    "averageBikingCadence": "averageBikingCadenceInRevPerMinute", "avgPower": "avgPower", "maxPower": "maxPower",
    "averageSpeed": "averageSpeed",
}


def confirmed(fields: dict, rels: dict) -> dict:
    """{beziehung: {reading, list}} fuer jede Beziehung mit Urteil `match` — der Listenwert ist dann
    durch die Aufzeichnung bestaetigt, `reading` nennt die passende Lesart. Nur aufrufen, wenn die
    Lieferung VOLLSTAENDIG war (der Aufrufer prueft das)."""
    out: dict[str, Any] = {}
    if not isinstance(fields, dict) or not isinstance(rels, dict):
        return out
    for name, r in rels.items():
        if name.startswith("_") or not isinstance(r, dict) or r.get("verdict") != "match":
            continue
        lv = _f(fields, LIST_KEY.get(name, ""))
        if lv is None:
            continue
        m = r.get("matches") or []
        out[name] = {"reading": m[0] if m else None, "list": round(lv, 2)}
    return out
