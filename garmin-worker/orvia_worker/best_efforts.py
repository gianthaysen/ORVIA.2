"""v8-447.1 · Bestwerte einer Aktivitaet — gerechnet aus ALLEN gelieferten Messzeilen,
BEVOR die Messreihen fuer die Anzeige ausgeduennt werden.

Grundsatz (gilt ab hier fuer jede Auswertung, die spaeter festgeschrieben werden kann):

    Rohdaten / volle Aufloesung   →  Auswertung   (dieses Modul)
    ausgeduennte Messreihen       →  Anzeige      (metrics.streams, hoechstens 300 Punkte)

Aus einer Anzeige-Reihe wird nie ein Rekord gerechnet: im echten Mitschnitt liegen zwischen
zwei gespeicherten Punkten im Mittel rund 20 Sekunden.

Dieses Modul RECHNET nur und beschreibt ehrlich, wie belastbar jede Zahl ist. Es schreibt
keine Rekorde fest und vergleicht nichts ueber Aktivitaeten hinweg — das ist Sache des
Leistungsregisters (v8-448), das hier nur seine Grundlage bekommt.

──────────────────────────────────────────────────────────────────────────────────────────
LEISTUNG — beste Durchschnittsleistung ueber ein Zeitfenster [t, t + D]
──────────────────────────────────────────────────────────────────────────────────────────
Zeitachse   VERSTRICHENE Zeit (Uhrzeit der Messzeile). Nie „N Messpunkte", nie Bewegungszeit.
Pause       gehoert in das Fenster und zaehlt mit 0 W. Ein 20-Minuten-Fenster mit 2 Minuten
            Pause ist ein 20-Minuten-Fenster — Bewegungsabschnitte werden nicht zusammengeklebt.
Signal      Eine Messzeile zum Zeitpunkt t steht fuer das Stueck Zeit, das an t ENDET (so
            zeichnet die Uhr auf). Liegt die vorige Zeile hoechstens zwei uebliche Abstaende
            zurueck, reicht das Stueck bis dorthin; liegt sie weiter zurueck (Pause, Aussetzer),
            steht die Zeile nur fuer EINEN ueblichen Abstand und die Luecke davor zaehlt 0 W.
0 W         ist ein Messwert (Rollen) und zaehlt als 0.
fehlend     Zeile ohne Leistungswert (Sensor weg): zaehlt als 0 W — NICHT interpoliert, nicht
            uebersprungen. Das Ergebnis kann dadurch nur zu niedrig werden, nie zu hoch; die
            betroffene Zeit steht am Fenster (miss_s) und in der Summe (missing_s).

Guete je Fenster (q):
  exact         Garmin hat ALLE aufgezeichneten Zeilen geliefert (rows == total) und die Uhr
                hat sekuendlich aufgezeichnet: die Zahl ist die Messung.
  approx        Zeilen fehlen (Garmin hat ausgeduennt) oder die Aufzeichnung ist nicht
                sekuendlich, aber im Fenster liegen mindestens APPROX_MIN_SAMPLES uebliche
                Abstaende: brauchbare Naeherung fuer die Anzeige — KEIN Rekord.
  insufficient  Fenster kuerzer als die Aufloesung hergibt: es wird KEINE Zahl gespeichert.

──────────────────────────────────────────────────────────────────────────────────────────
STRECKE — schnellste Zeit ueber eine Zieldistanz
──────────────────────────────────────────────────────────────────────────────────────────
Gesucht wird das kuerzeste Stueck zwischen zwei ECHTEN Messzeilen, dessen Distanz die
Zieldistanz erreicht. Keine Interpolation: die Zeit ist gemessen, die Strecke mindestens die
Zieldistanz (Ueberhang over_m steht dabei). Die Zahl ist damit eine OBERGRENZE der wahren
Bestzeit — nie zu schnell. Zeitachse wie oben: verstrichene Zeit, Pausen zaehlen mit.

Rein: keine Netzaufrufe, kein Zustand, keine Uhr.
"""

from __future__ import annotations

import math
from typing import Any

BEST_VERSION = 1

POWER_WINDOWS_S = (1, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600)
DISTANCE_TARGETS_M = (400.0, 1000.0, 5000.0, 10000.0, 21097.5, 42195.0)

# Sportarten, fuer die „schnellste Zeit ueber eine Strecke" eine klare Bedeutung hat. Fuer alle
# anderen wird der Strecken-Teil nicht gespeichert (Rad: gelaendeabhaengig; Schwimmen/Rudern:
# Bedeutung der Distanzreihe unbelegt).
DISTANCE_SPORTS = ("running", "walking", "hiking")

APPROX_MIN_SAMPLES = 8        # so viele uebliche Abstaende muessen in ein Naeherungs-Fenster passen
NATIVE_INTERVAL_MAX_S = 1.0   # „sekuendlich aufgezeichnet"
HOLD_FACTOR = 2.0             # bis zu diesem Vielfachen des ueblichen Abstands gilt eine Zeile durchgehend
OVER_MAX_REL = 0.01           # Strecke: Ueberhang hoechstens 1 % …
OVER_MAX_ABS_M = 10.0         # … oder 10 m, je nachdem, was groesser ist


def _num(v: Any) -> float | None:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    f = float(v)
    return f if math.isfinite(f) else None


def _median(xs: list[float]) -> float | None:
    if not xs:
        return None
    s = sorted(xs)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2.0


def time_axis(times_ms: Any = None, elapsed_s: Any = None) -> dict:
    """Zeitachse in Sekunden seit der ersten Zeile.
    { ok, t: [sek | None …], source, reason } — `t` hat dieselbe Laenge wie die Eingabe."""
    out: dict[str, Any] = {"ok": False, "t": [], "source": None, "reason": "no_time_axis"}
    src, vals = None, None
    if isinstance(times_ms, list) and any(_num(v) is not None for v in times_ms):
        first = next(_num(v) for v in times_ms if _num(v) is not None)
        vals = [None if _num(v) is None else (_num(v) - first) / 1000.0 for v in times_ms]
        src = "directTimestamp"
    elif isinstance(elapsed_s, list) and any(_num(v) is not None for v in elapsed_s):
        first = next(_num(v) for v in elapsed_s if _num(v) is not None)
        vals = [None if _num(v) is None else _num(v) - first for v in elapsed_s]
        src = "sumElapsedDuration"
    if vals is None:
        return out
    out["t"], out["source"] = vals, src
    prev = None
    for v in vals:
        if v is None:
            continue
        if prev is not None and v < prev - 1e-9:
            out["reason"] = "invalid_time_axis"          # laeuft rueckwaerts: kein Messtraeger
            return out
        prev = v
    if sum(1 for v in vals if v is not None) < 2:
        out["reason"] = "no_time_axis"
        return out
    out["ok"], out["reason"] = True, None
    return out


def _interval(ts: list[float]) -> float | None:
    """Ueblicher Abstand zweier Messzeilen (Median der positiven Abstaende)."""
    return _median([b - a for a, b in zip(ts, ts[1:]) if b - a > 1e-9])


# ---------------------------------------------------------------------------
# Leistung
# ---------------------------------------------------------------------------

def _segments(ts: list[float], vals: list[float | None], h: float):
    """Messzeilen → nicht ueberlappende Stuecke (start, ende, watt, fehlend?)."""
    cap = HOLD_FACTOR * h + 1e-9
    starts, ends, watts, miss = [], [], [], []
    prev_t = None
    for t, v in zip(ts, vals):
        if prev_t is None:
            dur = h
        else:
            dt = t - prev_t
            if dt <= 1e-9:
                prev_t = t
                continue                                 # zweite Zeile zur selben Sekunde: kein Zeitanteil
            dur = dt if dt <= cap else h
        starts.append(t - dur)
        ends.append(t)
        watts.append(0.0 if v is None else v)
        miss.append(v is None)
        prev_t = t
    return starts, ends, watts, miss


class _Integral:
    """Integral ueber die Stuecke (Energie, fehlende Zeit, abgedeckte Zeit). Abfragen laufen
    ueber einen Zeiger, den der Aufrufer fuehrt: bei wachsendem x insgesamt O(n)."""

    def __init__(self, starts, ends, watts, miss):
        self.s, self.e, self.w, self.m = starts, ends, watts, miss
        n = len(starts)
        self.pe = [0.0] * (n + 1)      # Energie
        self.pm = [0.0] * (n + 1)      # fehlende Zeit
        self.pc = [0.0] * (n + 1)      # abgedeckte Zeit
        for i in range(n):
            d = ends[i] - starts[i]
            self.pe[i + 1] = self.pe[i] + watts[i] * d
            self.pm[i + 1] = self.pm[i] + (d if miss[i] else 0.0)
            self.pc[i + 1] = self.pc[i] + d
        self.n = n

    def at(self, x: float, ptr: int):
        """(Energie, fehlend, abgedeckt) bis x — und der weitergerueckte Zeiger."""
        e, n = self.e, self.n
        while ptr < n and e[ptr] <= x:
            ptr += 1
        if ptr >= n:
            return self.pe[n], self.pm[n], self.pc[n], ptr
        part = x - self.s[ptr]
        if part <= 0:
            return self.pe[ptr], self.pm[ptr], self.pc[ptr], ptr
        return (self.pe[ptr] + self.w[ptr] * part,
                self.pm[ptr] + (part if self.m[ptr] else 0.0),
                self.pc[ptr] + part, ptr)


def _quality(window: float, h: float, native: bool) -> str:
    if native and h <= NATIVE_INTERVAL_MAX_S + 1e-9 and window >= h - 1e-9:
        return "exact"
    if window >= APPROX_MIN_SAMPLES * h - 1e-9:
        return "approx"
    return "insufficient"


def power_best(times_s: Any, power: Any, *, rows_total: Any = None, windows=POWER_WINDOWS_S) -> dict:
    """Beste Durchschnittsleistung je Fenster.

    times_s   Sekunden seit Beginn je Messzeile (aus time_axis), None erlaubt
    power     Watt je Messzeile, None = Zeile ohne Leistungswert
    rows_total  wie viele Zeilen die Uhr aufgezeichnet hat (Garmins totalMetricsCount) — nur
                wenn geliefert; ohne diese Zahl ist „vollstaendig geliefert" nicht belegt.
    """
    out: dict[str, Any] = {"v": BEST_VERSION, "basis": "elapsed", "status": "no_data", "windows": {}}
    if not isinstance(times_s, list) or not isinstance(power, list) or len(times_s) != len(power):
        return out
    rows = [(t, _num(p)) for t, p in zip(times_s, power) if _num(t) is not None]
    if len(rows) < 2 or not any(p is not None for _, p in rows):
        return out
    ts = [float(t) for t, _ in rows]
    if any(b < a - 1e-9 for a, b in zip(ts, ts[1:])):
        out["status"] = "invalid_time_axis"
        return out
    h = _interval(ts)
    if h is None:
        out["status"] = "invalid_time_axis"
        return out
    vals = [None if (p is None or p < 0) else p for _, p in rows]     # negative Leistung gibt es nicht: fehlend
    starts, ends, watts, miss = _segments(ts, vals, h)
    integ = _Integral(starts, ends, watts, miss)
    lo, hi = starts[0], ends[-1]
    span = hi - lo
    total = int(rows_total) if isinstance(rows_total, int) and not isinstance(rows_total, bool) and rows_total > 0 else None
    native = total is not None and len(times_s) >= total
    out.update({
        "status": "ok", "rows": len(times_s), "total": total, "native": native,
        "interval_s": round(h, 3), "span_s": round(span, 1),
        "missing_s": round(integ.pm[-1], 1), "gap_s": round(span - integ.pc[-1], 1),
    })
    for window in windows:
        key = str(int(window))
        d = float(window)
        if d > span + 1e-9:
            out["windows"][key] = {"q": "too_short"}
            continue
        q = _quality(d, h, native)
        if q == "insufficient":
            out["windows"][key] = {"q": q}
            continue
        best = None
        # Das beste Fenster beginnt oder endet an einer Stueckgrenze (die Energie ist dazwischen
        # stueckweise linear) — beide Kandidatenfolgen wachsen, deshalb zwei Durchlaeufe in O(n).
        top = hi - d
        for cands in ((min(s, top) for s in starts), (min(max(e - d, lo), top) for e in ends)):
            pa = pb = 0
            for x in cands:
                e0, m0, c0, pa = integ.at(x, pa)
                e1, m1, c1, pb = integ.at(x + d, pb)
                avg = (e1 - e0) / d
                if best is None or avg > best[0] + 1e-12:
                    best = (avg, x, m1 - m0, d - (c1 - c0))
        avg, x, miss_s, gap_s = best
        item: dict[str, Any] = {"w": round(avg, 1), "at": int(round(x - ts[0] if x > ts[0] else 0)), "q": q}
        if miss_s > 0.05:
            item["miss_s"] = round(miss_s, 1)
        if gap_s > 0.05:
            item["gap_s"] = round(gap_s, 1)
        out["windows"][key] = item
    return out


# ---------------------------------------------------------------------------
# Strecke
# ---------------------------------------------------------------------------

def distance_best(times_s: Any, distance_m: Any, *, targets=DISTANCE_TARGETS_M) -> dict:
    """Schnellste Zeit je Zieldistanz, zwischen zwei echten Messzeilen (keine Interpolation)."""
    out: dict[str, Any] = {"v": BEST_VERSION, "basis": "elapsed", "status": "no_data", "targets": {}}
    if not isinstance(times_s, list) or not isinstance(distance_m, list) or len(times_s) != len(distance_m):
        return out
    rows = [(float(t), float(_num(d))) for t, d in zip(times_s, distance_m) if _num(t) is not None and _num(d) is not None]
    if len(rows) < 2:
        return out
    for (t0, d0), (t1, d1) in zip(rows, rows[1:]):
        if t1 < t0 - 1e-9:
            out["status"] = "invalid_time_axis"
            return out
        if d1 < d0 - 1e-6:
            out["status"] = "invalid_distance_axis"      # kumulative Distanz faellt: kein Messtraeger
            return out
    ts = [r[0] for r in rows]
    ds = [r[1] for r in rows]
    n = len(rows)
    out.update({"status": "ok", "rows": n, "total_m": round(ds[-1] - ds[0], 1)})
    for target in targets:
        key = str(int(round(target)))
        if ds[-1] - ds[0] < target - 1e-6:
            out["targets"][key] = {"q": "too_short"}
            continue
        best = None
        j = 0
        for i in range(n):
            if j < i + 1:
                j = i + 1
            while j < n and ds[j] - ds[i] < target - 1e-6:
                j += 1
            if j >= n:
                break
            sec = ts[j] - ts[i]
            if sec <= 0:
                continue
            if best is None or sec < best[0] - 1e-9:
                best = (sec, ds[j] - ds[i] - target, ts[i])
        if best is None:
            out["targets"][key] = {"q": "too_short"}
            continue
        sec, over, at = best
        q = "measured" if over <= max(OVER_MAX_ABS_M, OVER_MAX_REL * target) + 1e-9 else "coarse"
        out["targets"][key] = {"s": round(sec, 1), "over_m": round(over, 1), "at": int(round(at - ts[0])), "q": q}
    return out


# ---------------------------------------------------------------------------
# Kennwerte einer Messreihe — aus allen gelieferten Zeilen
# ---------------------------------------------------------------------------

def series_stats(values: Any) -> dict | None:
    """Mittel und Maximum EINER Messreihe ueber alle gelieferten Zeilen (ungewichtet je Zeile).

    Bewusst roh: `avg` zaehlt Nullen mit, `avg_nz` laesst sie weg (nur angegeben, wenn es
    Nullen gibt) — welche der beiden Zahlen Garmins „Durchschnitt" entspricht, ist je Groesse
    verschieden und hier nicht belegt. Zeilen ohne Wert zaehlen nicht. Hat Garmin ausgeduennt,
    ist das Mittel eine Naeherung (steht am Block: native)."""
    if not isinstance(values, list):
        return None
    nums = [f for f in (_num(v) for v in values) if f is not None]
    if not nums:
        return None
    out: dict[str, Any] = {"n": len(nums), "avg": round(sum(nums) / len(nums), 2), "max": round(max(nums), 2)}
    nz = [v for v in nums if v > 0]
    if nz and len(nz) != len(nums):
        out["avg_nz"] = round(sum(nz) / len(nz), 2)
        out["n_zero"] = len(nums) - len(nz)
    return out


def compact(result: dict, key: str) -> dict | None:
    """Fuer die Zeile: nur behalten, wenn es mindestens EINE Zahl gibt. Sonst nichts speichern."""
    if not isinstance(result, dict) or result.get("status") != "ok":
        return None
    items = result.get(key) or {}
    if not any(isinstance(v, dict) and ("w" in v or "s" in v) for v in items.values()):
        return None
    return result
