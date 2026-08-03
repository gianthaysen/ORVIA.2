"""GM7.4 · Geteilte, struktur-erhaltende Anonymisierung für Capture-Skripte.

Regeln (identisch für Aktivitäts- und Serien-Fixtures):
  - Aktivitäts-/Owner-/User-/Device-IDs  → feste Platzhalter
  - Koordinaten (lat/lon)                → neutraler Ursprung, relative Deltas bleiben
  - Orts-/Namens-/Adressfelder           → "REDACTED"
  - ISO-Zeitstempel                      → festes Datum (Tageszeit bleibt)
  - Epoch-Arrays [ts, ...]               → relativ auf 0 (Zeitabstände bleiben)
  - Feldnamen, Arrayformen, Zahlenstruktur bleiben unverändert
Es werden KEINE Tokens/Credentials verarbeitet (die Skripte reichen keine durch).
"""

from __future__ import annotations

PH_ACTIVITY_ID = 9999999999
PH_OWNER_ID = 1111111111
PH_DEVICE_ID = 2222222222
NEUTRAL_LAT = 0.0
NEUTRAL_LON = 0.0
FIXED_DATE = "2026-01-01"

LATKEYS = ("latitude", "startlat", "endlat", "lat")
LONKEYS = ("longitude", "startlon", "endlon", "lon", "lng")
NAMEKEYS = ("locationname", "activityname", "ownerdisplayname", "ownerfullname",
            "username", "fullname", "address", "city", "country", "place")
IDKEYS = ("ownerid", "userprofilepk", "userprofileid", "userid", "profileid")
DEVKEYS = ("deviceid", "unitid")


def _looks_epoch(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v > 1_000_000_000


def _is_iso_ts(v):
    return isinstance(v, str) and len(v) >= 10 and v[:4].isdigit() and v[4] in "-/"


def anon(obj, ctx=None):
    """Rekursiv, struktur-erhaltend. ctx trägt die Koordinaten-Baseline."""
    if ctx is None:
        ctx = {"lat0": None, "lon0": None}
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            kl = str(k).lower()
            if any(s in kl for s in LATKEYS) and isinstance(v, (int, float)) and not isinstance(v, bool):
                if ctx.get("lat0") is None:
                    ctx["lat0"] = v
                out[k] = round(NEUTRAL_LAT + (v - ctx["lat0"]), 6)
            elif any(s in kl for s in LONKEYS) and isinstance(v, (int, float)) and not isinstance(v, bool):
                if ctx.get("lon0") is None:
                    ctx["lon0"] = v
                out[k] = round(NEUTRAL_LON + (v - ctx["lon0"]), 6)
            elif kl == "activityid" or kl.endswith("activityid"):
                out[k] = PH_ACTIVITY_ID
            elif any(s in kl for s in IDKEYS):
                out[k] = PH_OWNER_ID
            elif any(s in kl for s in DEVKEYS):
                out[k] = PH_DEVICE_ID
            elif any(s in kl for s in NAMEKEYS):
                out[k] = "REDACTED" if isinstance(v, str) else v
            elif isinstance(v, str) and _is_iso_ts(v) and "T" not in v:
                out[k] = FIXED_DATE          # reines Datum: neutralisieren (keine Sequenz)
            else:
                # ISO-DATETIME (mit Uhrzeit) NICHT hier naiv ersetzen (würde
                # tagesübergreifende Sequenzen kollabieren) — full_anon() rebasiert
                # sie zeitachsen-treu über denselben Epoch-Anker.
                out[k] = anon(v, ctx)
        return out
    if isinstance(obj, list):
        # Zeitreihe [epoch, wert, ...]: Epoch relativ auf 0 (Abstände bleiben)
        if obj and isinstance(obj[0], list) and obj[0] and _looks_epoch(obj[0][0]):
            base = obj[0][0]
            red = []
            for row in obj:
                if isinstance(row, list) and row and _looks_epoch(row[0]):
                    red.append([row[0] - base] + [anon(x, ctx) for x in row[1:]])
                else:
                    red.append(anon(row, ctx))
            return red
        return [anon(x, ctx) for x in obj]
    return obj


EPOCH_MS_BASE = 1767225600000  # 2026-01-01T00:00:00Z — neutraler Anker
import datetime as _dt  # noqa: E402


def _iso_epoch_ms(s):
    """ISO-Datetime-String → Epoch-ms (UTC) oder None. Toleriert '.0'-Fraktion."""
    if not _is_iso_ts(s) or "T" not in s:
        return None
    core = s.split(".")[0].replace("Z", "")
    try:
        t = _dt.datetime.fromisoformat(core)
    except Exception:
        return None
    return int(t.replace(tzinfo=_dt.timezone.utc).timestamp() * 1000)


def _iso_from_epoch_ms(ms):
    t = _dt.datetime.fromtimestamp(ms / 1000, tz=_dt.timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%S") + ".0"


def _min_epoch(o, acc):
    if isinstance(o, dict):
        for v in o.values():
            _min_epoch(v, acc)
    elif isinstance(o, list):
        for v in o:
            _min_epoch(v, acc)
    elif isinstance(o, (int, float)) and not isinstance(o, bool) and o > 1_000_000_000_000:
        acc[0] = o if acc[0] is None else min(acc[0], o)
    elif isinstance(o, str):
        e = _iso_epoch_ms(o)
        if e is not None:
            acc[0] = e if acc[0] is None else min(acc[0], e)


def _scrub_epoch(o, mn):
    if isinstance(o, dict):
        return {k: _scrub_epoch(v, mn) for k, v in o.items()}
    if isinstance(o, list):
        return [_scrub_epoch(v, mn) for v in o]
    if isinstance(o, (int, float)) and not isinstance(o, bool) and o > 1_000_000_000_000:
        return EPOCH_MS_BASE + (o - mn)   # Delta bleibt, absolutes Datum weg
    if isinstance(o, str):
        e = _iso_epoch_ms(o)
        if e is not None:
            return _iso_from_epoch_ms(EPOCH_MS_BASE + (e - mn))  # zeitachsen-treu rebasiert
    return o


def _scrub_detail_coords(o):
    """Garmin activity-details: directLatitude/directLongitude liegen als ARRAY-
    SPALTEN in activityDetailMetrics[i].metrics (Index via metricDescriptors), NICHT
    als lat/lon-Dict-Keys — sonst würde die echte GPS-Spur ungefiltert durchrutschen.
    Verschiebt diese Spalten auf den neutralen Ursprung (relative Spur bleibt)."""
    if not (isinstance(o, dict) and isinstance(o.get("metricDescriptors"), list)
            and isinstance(o.get("activityDetailMetrics"), list)):
        return o
    desc = {}
    for md in o["metricDescriptors"]:
        if isinstance(md, dict) and "key" in md and "metricsIndex" in md:
            desc[md["key"]] = md["metricsIndex"]
    for ck, target in (("directLatitude", NEUTRAL_LAT), ("directLongitude", NEUTRAL_LON)):
        i = desc.get(ck)
        if i is None:
            continue
        base = None
        for r in o["activityDetailMetrics"]:
            m = r.get("metrics") if isinstance(r, dict) else None
            if isinstance(m, list) and i < len(m) and isinstance(m[i], (int, float)) \
               and not isinstance(m[i], bool) and abs(m[i]) > 0.01:
                base = m[i]
                break
        if base is None:
            continue
        for r in o["activityDetailMetrics"]:
            m = r.get("metrics") if isinstance(r, dict) else None
            if isinstance(m, list) and i < len(m) and isinstance(m[i], (int, float)) and not isinstance(m[i], bool):
                m[i] = round(target + (m[i] - base), 6)
    return o


def full_anon(obj):
    """anon() + Garmin-Detail-Koordinatenspalten-Scrub + globaler Zeitstempel-Scrub.
    Alle absoluten Epoch-ms (>1e12, egal ob Dict-Wert wie startGMT/time oder in
    Arrays) werden auf einen neutralen 2026-01-01-Anker rebasiert (Zeitabstände
    bleiben); descriptor-indizierte GPS-Spalten werden auf den neutralen Ursprung
    verschoben. Fängt genau die Fälle, die reine Schlüssel-Erkennung nicht sieht."""
    a = _scrub_detail_coords(anon(obj))
    acc = [None]
    _min_epoch(a, acc)
    return _scrub_epoch(a, acc[0]) if acc[0] is not None else a


def summarize(obj, depth=0, path="root"):
    """Nur STRUKTUR: Schlüssel + Array-Längen. Keine Werte, keine Koordinaten."""
    lines = []
    if isinstance(obj, dict):
        lines.append(f"{'  '*depth}{path}: dict[{len(obj)}] keys={sorted(map(str, obj.keys()))[:20]}")
        for k, v in list(obj.items())[:12]:
            if isinstance(v, (dict, list)):
                lines += summarize(v, depth + 1, str(k))
    elif isinstance(obj, list):
        lines.append(f"{'  '*depth}{path}: list[{len(obj)}]" + (f" elem0={type(obj[0]).__name__}" if obj else ""))
        if obj and isinstance(obj[0], (dict, list)):
            lines += summarize(obj[0], depth + 1, f"{path}[0]")
    return lines
