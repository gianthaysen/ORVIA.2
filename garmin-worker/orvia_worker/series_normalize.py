"""GM7.4 · Produktive Parser/Normalisierung der zeitaufgelösten Garmin-Rohdaten:
Aktivitätsdetails (Route + Streams) und Nacht-/Intraday-Serien (Schlafstadien,
Schlaf-HF/Atmung/Stress/Body-Battery, Intraday-Stress, Body-Battery-intraday).

Verlustarm + rückwärtskompatibel; fehlende Felder ⇒ keine Emission (kein 0-/
Demo-Platzhalter). Route/Streams gedeckelt (Anfang/Ende erhalten). Serien liefern
[offset_s, wert] bzw. [offset_s, dur_s, stage] — offset ab Serienbeginn; die
Tageszuordnung (Europe/Berlin) + jsonb-Persistenz erfolgt in der Sync-/DB-Schicht
(user_metric_series, Migration 0028). KEINE erfundenen Kurven, keine Interpolation.
"""

from __future__ import annotations

import datetime
import math
from typing import Any

from .activity_details import reduce_route

STREAM_MAX = 300           # Deckel je Aktivitäts-Stream
SERIES_MAX = 1000          # Deckel je Tages-Serie (DB-Guard ≤2000)

# Garmin sleepLevels.activityLevel → Stadium (empirisch gegen die Skalar-Sekunden
# des Fixtures bestätigt: 0=deep, 1=light, 2=rem, 3=awake).
STAGE_MAP = {0.0: "deep", 1.0: "light", 2.0: "rem", 3.0: "awake"}


def _num(v: Any):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else None


def _downsample(seq: list, maxn: int) -> list:
    if len(seq) <= maxn:
        return seq
    step = math.ceil(len(seq) / maxn)
    ds = seq[::step]
    if ds[-1] != seq[-1]:
        ds.append(seq[-1])
    if len(ds) > maxn:
        ds = ds[:maxn - 1] + [seq[-1]]
    return ds


def _sample_indices(n: int, maxn: int) -> list[int]:
    """Indizes einer gleichmaessigen Ausduennung auf hoechstens maxn Punkte; erster und
    letzter Punkt bleiben. EINE Indexliste fuer ALLE Messreihen einer Aktivitaet — nur so
    gehoert Punkt i in jeder Reihe zum selben Messzeitpunkt.

    v8-447 (Befund): _downsample() haengt das Ende nach einem WERT-Vergleich an
    (`ds[-1] != seq[-1]`). Stimmt der letzte ausgeduennte Wert zufaellig mit dem echten
    Ende ueberein (im Mitschnitt: Hoehe), fehlt dieser Reihe ein Punkt — die Reihen
    liefen am Ende um eine Stelle auseinander. Hier entscheidet der INDEX."""
    if n <= 0:
        return []
    if n <= maxn:
        return list(range(n))
    step = math.ceil(n / maxn)
    idx = list(range(0, n, step))
    if idx[-1] != n - 1:
        idx.append(n - 1)
    if len(idx) > maxn:
        idx = idx[:maxn - 1] + [n - 1]
    return idx


def _iso_ms(s: str):
    if not isinstance(s, str) or "T" not in s:
        return None
    core = s.split(".")[0].replace("Z", "")
    try:
        t = datetime.datetime.fromisoformat(core)
    except Exception:
        return None
    return int(t.replace(tzinfo=datetime.timezone.utc).timestamp() * 1000)


# ---------------------------------------------------------------------------
# Aktivitätsdetails: Route + Streams (HF/Kadenz/Höhe/Tempo/Distanz)
# ---------------------------------------------------------------------------

def parse_activity_details(raw: Any) -> dict:
    out = {"hasRoute": False, "route": [], "streams": {}, "stream_units": {}, "stream_meta": {},
           "splits": None, "hasSplits": False, "hasStreams": False}
    if not isinstance(raw, dict):
        return out

    # --- Route aus geoPolylineDTO.polyline ---
    poly = (raw.get("geoPolylineDTO") or {}).get("polyline") if isinstance(raw.get("geoPolylineDTO"), dict) else None
    if isinstance(poly, list):
        pts = []
        for p in poly:
            if isinstance(p, dict):
                la, lo = _num(p.get("lat")), _num(p.get("lon"))
                if la is not None and lo is not None:
                    pts.append([la, lo])
        red = reduce_route(pts, 600)
        if len(red) > 1:
            out["route"] = red
            out["hasRoute"] = True

    # --- Streams aus metricDescriptors + activityDetailMetrics ---
    desc = {}
    desc_unit = {}
    for md in raw.get("metricDescriptors") or []:
        if isinstance(md, dict) and "key" in md and "metricsIndex" in md:
            desc[md["key"]] = md["metricsIndex"]
            u = md.get("unit")
            if isinstance(u, dict) and isinstance(u.get("key"), str):
                desc_unit[md["key"]] = u["key"]
    rows = raw.get("activityDetailMetrics") or []
    keep = _sample_indices(len(rows), STREAM_MAX)

    def column(key):
        idx = desc.get(key)
        if idx is None:
            return None
        vals = []
        for r in rows:
            m = r.get("metrics") if isinstance(r, dict) else None
            vals.append(_num(m[idx]) if isinstance(m, list) and idx < len(m) else None)
        return vals if any(v is not None for v in vals) else None

    def emit(name, vals, unit, kind, source):
        out["streams"][name] = [vals[i] for i in keep]
        out["stream_units"][name] = unit
        meta = {"kind": kind, "unit": unit, "source": source}
        gu = desc_unit.get(source)
        if gu:
            meta["garmin_unit"] = gu
        out["stream_meta"][name] = meta

    # kanonischer Name → (Descriptor-Key(s), Einheit, Bedeutung)
    SIMPLE = [
        ("heart_rate", ("directHeartRate",), "bpm", "heart_rate_bpm"),
        ("power", ("directPower",), "W", "power_w"),
        ("elevation", ("directElevation", "directCorrectedElevation"), "m", "elevation_m"),
        ("speed", ("directSpeed",), "mps", "speed_mps"),
        ("distance", ("sumDistance",), "m", "distance_m"),
    ]
    for name, keys, unit, kind in SIMPLE:
        for k in keys:
            vals = column(k)
            if vals is not None:
                emit(name, vals, unit, kind, k)
                break

    # --- Kadenz: EINE Reihe, aber mit Bedeutung -------------------------------
    # v8-447 (Befund): bis Details-Version 2 wurde fuer Laeufe `directRunCadence`
    # gelesen und als "spm" gespeichert. Im echten Mitschnitt steht dort 80,
    # in `directDoubleCadence` 161 und in `directFractionalCadence` 0.5 —
    # directRunCadence ist die Frequenz EINES Beins (ganzzahlig), Fractional ihr
    # Nachkommaanteil, Double die Schrittfrequenz beider Beine: 2 × (80 + 0.5) = 161.
    # Reihenfolge: Schrittfrequenz, wie Garmin sie liefert (Double). Fehlt sie,
    # wird sie aus Run + Fractional GEBILDET und als abgeleitet gekennzeichnet —
    # nie eine pauschale Verdopplung eines Wertes unbekannter Bedeutung.
    # Rad (directBikeCadence, rpm) ist eine andere Groesse und laeuft durch keine
    # dieser Regeln. Der Feldname der Rad-Reihe ist weiter eine Annahme (kein
    # Rad-Mitschnitt im Repo): fehlt er in der Antwort, entsteht keine Reihe.
    double = column("directDoubleCadence")
    run = column("directRunCadence")
    bike = column("directBikeCadence")
    if double is not None:
        emit("cadence", double, "spm", "running_cadence_spm", "directDoubleCadence")
    elif run is not None:
        frac = column("directFractionalCadence")
        vals = []
        for i, v in enumerate(run):
            if v is None:
                vals.append(None)
            else:
                f = frac[i] if (frac is not None and i < len(frac) and frac[i] is not None) else 0.0
                vals.append(round(2 * (v + f)))
        emit("cadence", vals, "spm", "running_cadence_spm", "directRunCadence")
        out["stream_meta"]["cadence"]["derived"] = "2*(directRunCadence+directFractionalCadence)"
    elif bike is not None:
        emit("cadence", bike, "rpm", "cycling_cadence_rpm", "directBikeCadence")
    out["hasStreams"] = bool(out["streams"])

    # --- Splits/Laps: in get_activity_details NICHT enthalten → keine Erfindung ---
    laps = raw.get("splitSummaries") or raw.get("laps")
    if isinstance(laps, list) and laps:
        out["splits"] = laps
        out["hasSplits"] = True
    return out


def build_activity_metrics(existing: Any, details: dict, max_route_points: int = 600) -> dict:
    """Merged Detail-Ausgaben rückwärtskompatibel in ein vorhandenes metrics-Dict
    (bestehende Felder bleiben; fehlende Daten erzeugen kein Feld)."""
    out = dict(existing) if isinstance(existing, dict) else {}
    if details.get("hasRoute") and len(details.get("route") or []) > 1:
        out["route"] = reduce_route(details["route"], max_route_points)
        out["hasRoute"] = True
    if details.get("hasStreams"):
        out["streams"] = details["streams"]
        out["stream_units"] = details.get("stream_units", {})
        # v8-447: Bedeutung jeder Messreihe (kind / unit / Quellfeld). Wird mit den Reihen
        # ERSETZT, nie mit einem aelteren Stand gemischt.
        out["stream_meta"] = details.get("stream_meta", {})
    if details.get("hasSplits"):
        out["splits"] = details["splits"]
    return out


# ---------------------------------------------------------------------------
# Schlaf-Serien: Hypnogramm + Nacht-HF/Stress/BodyBattery/HRV/Atmung
# ---------------------------------------------------------------------------

def _epoch_pair_series(seq, valkey, tskey):
    if not isinstance(seq, list) or not seq:
        return None
    base = None
    rows = []
    for e in seq:
        if not isinstance(e, dict):
            continue
        ts, v = _num(e.get(tskey)), _num(e.get(valkey))
        if ts is None or v is None:
            continue
        if base is None:
            base = ts
        rows.append([int((ts - base) // 1000), v])
    return _downsample(rows, SERIES_MAX) if rows else None


def normalize_sleep_series(raw: Any) -> dict:
    out = {"series": [], "scalars": {}}
    if not isinstance(raw, dict):
        return out

    # Hypnogramm aus sleepLevels [{startGMT ISO, endGMT ISO, activityLevel}]
    levels = raw.get("sleepLevels")
    if isinstance(levels, list) and levels:
        base = None
        pts = []
        for s in levels:
            if not isinstance(s, dict):
                continue
            ms0, ms1 = _iso_ms(s.get("startGMT")), _iso_ms(s.get("endGMT"))
            if ms0 is None or ms1 is None:
                continue
            if base is None:
                base = ms0
            stage = STAGE_MAP.get(s.get("activityLevel"))
            if stage is None:
                continue
            pts.append([int((ms0 - base) // 1000), int((ms1 - ms0) // 1000), stage])
        if pts:
            out["series"].append({"metric_type": "sleep_stages", "unit": "sleep_stage", "points": pts})

    for key, mt, unit, valkey, tskey in (
        ("sleepHeartRate", "sleep_hr", "bpm", "value", "startGMT"),
        ("sleepStress", "sleep_stress", "stress_score", "value", "startGMT"),
        ("sleepBodyBattery", "sleep_body_battery", "bb_level", "value", "startGMT"),
        ("hrvData", "sleep_hrv", "ms", "value", "startGMT"),
        ("wellnessEpochRespirationDataDTOList", "sleep_respiration", "brpm", "respirationValue", "startTimeGMT"),
    ):
        ser = _epoch_pair_series(raw.get(key), valkey, tskey)
        if ser:
            out["series"].append({"metric_type": mt, "unit": unit, "points": ser})

    return out


# ---------------------------------------------------------------------------
# Persistenz: normalisierte Serien → user_metric_series-Upsert-Zeilen (0028)
# ---------------------------------------------------------------------------

def build_series_rows(user_id: str, provider_id, metric_date: str, timezone: str,
                      normalized: dict, provider: str = "garmin_unofficial") -> list:
    """Wandelt `normalize_*_series()`-Ausgaben in Upsert-Zeilen für
    public.user_metric_series (Migration 0028). Deterministische
    source_record_id ⇒ idempotent; Dedupe-Schlüssel = (user_id, metric_type,
    metric_date) == db.ON_CONFLICT['user_metric_series']."""
    rows = []
    for s in (normalized.get("series") or []):
        pts = s.get("points") or []
        rows.append({
            "user_id": user_id,
            "metric_type": s["metric_type"],
            "metric_date": metric_date,
            "timezone": timezone,
            "unit": s.get("unit"),
            "points": pts,
            "point_count": len(pts),
            "source_type": "device_measurement",
            "source_record_id": f"{provider}:series:{metric_date}:{s['metric_type']}",
            "provider_id": provider_id,
        })
    return rows


# ---------------------------------------------------------------------------
# Intraday-Stress + Body-Battery (bereits relative Offset-Arrays)
# ---------------------------------------------------------------------------

def normalize_stress_series(raw: Any) -> dict:
    out = {"series": []}
    if not isinstance(raw, dict):
        return out

    arr = raw.get("stressValuesArray")
    if isinstance(arr, list) and arr:
        pts = []
        for row in arr:
            if isinstance(row, list) and len(row) >= 2:
                off, lvl = _num(row[0]), _num(row[1])
                if off is not None and lvl is not None and lvl >= 0:   # -1/-2 = keine Daten
                    pts.append([int(off // 1000), lvl])
        if pts:
            out["series"].append({"metric_type": "stress_intraday", "unit": "stress_score",
                                  "points": _downsample(pts, SERIES_MAX)})

    # bodyBatteryValuesArray: descriptor index 0=timestamp,1=status,2=level,3=version
    bb = raw.get("bodyBatteryValuesArray")
    if isinstance(bb, list) and bb:
        pts = []
        for row in bb:
            if isinstance(row, list) and len(row) >= 3:
                off, lvl = _num(row[0]), _num(row[2])
                if off is not None and lvl is not None and 0 <= lvl <= 100:
                    pts.append([int(off // 1000), lvl])
        if pts:
            out["series"].append({"metric_type": "body_battery_intraday", "unit": "bb_level",
                                  "points": _downsample(pts, SERIES_MAX)})

    return out
