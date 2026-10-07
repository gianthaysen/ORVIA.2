"""v8-447 · Was vom Garmin-Abruf einer Aktivitaet ERHALTEN wird — und was bewusst nicht.

Ausgangslage (bis v8-446): aus dem Listeneintrag wurden zehn Felder gelesen, der Rest
verworfen; der Garmin-Typ ging verloren, sobald er auf eine ORVIA-Sportart passte; die
Rohantwort wurde nirgends aufbewahrt. Was einmal verworfen ist, kommt nicht wieder —
bestehende Zeilen werden nie aus der Liste aktualisiert.

Grundsatz dieses Moduls: ERHALTEN, NICHT DEUTEN.
  - Erhalten wird der ROHWERT unter seinem GARMIN-NAMEN (z. B. "movingDuration": 5509.0).
    Keine Umrechnung, keine Umbenennung, keine Rundung. Eine falsche Annahme ueber Einheit
    oder Bedeutung laesst sich dann spaeter in der Auswertung korrigieren, ohne neu zu
    importieren (die halbierte Laufkadenz war genau so ein Importfehler).
  - Erhalten werden nur MESSWERTE: Zahlen, Wahrheitswerte, kurze Aufzaehlungswerte.
    Nie Namen, Orte, Koordinaten, Konto-, Profil- oder Geraetekennungen (PRIVATE_TOKENS, ID_TOKENS).
  - Nichts wird erfunden: ein Feld, das Garmin nicht liefert, entsteht nicht.

Zwei Wege, wie ein Feld erhalten wird:
  1. KNOWN — namentlich bekannte Felder mit Einheit, Sportbezug und BELEGSTUFE:
       fixture   in einem echten, anonymisierten Mitschnitt im Repo gesehen
       library   im typisierten Modell der eingesetzten Bibliothek (garminconnect 0.3.6) benannt
       assumed   ueblicher Garmin-Connect-Name, hier NICHT belegt
  2. MEASURE_PARTS — jedes weitere skalare Feld, dessen Name nach einem Messwert aussieht
     (… cadence, power, swolf, stroke, zone …). Damit geht ein Feld auch dann nicht
     verloren, wenn sein genauer Name hier noch unbekannt ist. Es bleibt „unbeschrieben"
     (ohne Einheit) und wird vom Mitschnitt-Skript als solches gemeldet.

Ablage (Client-Sicht):
  metrics.garmin   klein, auf jedem Geraet: type_key, parent_type_id, start_local,
                   start_gmt, utc_offset_s
  metrics.ext      groesser, nur auf dem Server und im Listen-Zwischenspeicher der App:
                   fields (dieses Modul), spaeter laps / zones / sets (Zusatzabrufe)

Rein: keine Netzaufrufe, kein Zustand, keine Uhr.
"""

from __future__ import annotations

import math
import re
from datetime import datetime
from typing import Any

EXT_VERSION = 1

# --- nie erhalten ---------------------------------------------------------------
# Geprueft wird je WORT des Feldnamens (ownerDisplayName → owner, display, name), nicht
# per Teilstring — sonst fiele "avgVerticalOscillation" wegen "lat" weg und
# "velocity" wegen "city".
PRIVATE_TOKENS = frozenset((
    "owner", "user", "profile", "email", "mail", "token", "password", "secret", "serial",
    "location", "address", "city", "country", "place", "latitude", "longitude", "lat", "lon", "lng",
    "url", "uri", "image", "photo", "avatar", "comment", "description", "uuid", "conversation",
    "kudos", "privacy", "role", "roles", "birth", "birthday", "gender", "device", "gear", "course",
    "favorite", "notes", "note", "comments",
))
# Kennungen (…Id, …Pk) sind nie Messwerte — bis auf diese Aufzaehlungs-Nummern.
ID_TOKENS = frozenset(("id", "ids", "pk"))
ID_ALLOWED = frozenset(("typeId", "parentTypeId", "sportTypeId", "eventTypeId"))

# --- skalare Felder, deren Name nach einem Messwert aussieht -------------------
MEASURE_PARTS = (
    "cadence", "power", "speed", "pace", "distance", "duration", "elevation", "ascent", "descent",
    "heartrate", "averagehr", "maxhr", "minhr", "hr", "calorie", "stroke", "swolf", "pool", "length",
    "lap", "sets", "reps", "volume", "temperature", "trainingeffect", "trainingload", "stride",
    "vertical", "groundcontact", "balance", "intensity", "vo2", "zone", "steps", "split", "grade",
    "stamina", "respiration", "torque", "pedal", "threshold", "ftp", "efficiency", "tss", "normpower",
    "oscillation", "moving", "elapsed", "anaerobic", "aerobic", "benefit", "load", "watt", "rpm",
)

STRING_MAX = 48          # laengere Texte sind keine Aufzaehlungswerte
FIELDS_MAX = 120         # Deckel fuer metrics.ext.fields


def _f(key, unit, group, sports, evidence, note=None):
    return {"key": key, "unit": unit, "group": group, "sports": sports, "evidence": evidence, "note": note}


ALL = ("*",)
# Namentlich bekannte Felder des LISTENEINTRAGS (get_activities_by_date) bzw. der
# Zusammenfassung (get_activity → summaryDTO). Reihenfolge = Reihenfolge in der Matrix.
KNOWN: list[dict] = [
    # ---- Zeit / Umfang -------------------------------------------------------
    _f("duration", "s", "time", ALL, "library", "Timer-Dauer; wird in die Spalte duration_seconds uebernommen"),
    _f("movingDuration", "s", "time", ALL, "library"),
    _f("elapsedDuration", "s", "time", ALL, "library"),
    _f("distance", "m", "volume", ALL, "library"),
    _f("elevationGain", "m", "volume", ALL, "library"),
    _f("elevationLoss", "m", "volume", ALL, "library"),
    _f("minElevation", "m", "volume", ALL, "assumed"),
    _f("maxElevation", "m", "volume", ALL, "assumed"),
    _f("steps", "count", "volume", ALL, "assumed"),
    _f("lapCount", "count", "structure", ALL, "assumed"),
    # ---- Tempo / Herz / Energie ---------------------------------------------
    _f("averageSpeed", "m/s", "speed", ALL, "library"),
    _f("maxSpeed", "m/s", "speed", ALL, "library"),
    _f("averageHR", "bpm", "heart", ALL, "library"),
    _f("maxHR", "bpm", "heart", ALL, "library"),
    _f("minHR", "bpm", "heart", ALL, "assumed"),
    _f("calories", "kcal", "energy", ALL, "library"),
    _f("bmrCalories", "kcal", "energy", ALL, "library"),
    # ---- Belastung / Wirkung -------------------------------------------------
    _f("activityTrainingLoad", "garmin_load", "effect", ALL, "library"),
    _f("aerobicTrainingEffect", "0-5", "effect", ALL, "library"),
    _f("anaerobicTrainingEffect", "0-5", "effect", ALL, "library"),
    _f("trainingEffectLabel", "enum", "effect", ALL, "library", "Hauptnutzen laut Garmin"),
    _f("aerobicTrainingEffectMessage", "enum", "effect", ALL, "assumed"),
    _f("anaerobicTrainingEffectMessage", "enum", "effect", ALL, "assumed"),
    _f("moderateIntensityMinutes", "min", "effect", ALL, "assumed"),
    _f("vigorousIntensityMinutes", "min", "effect", ALL, "assumed"),
    _f("vO2MaxValue", "ml/kg/min", "effect", ("running", "cycling"), "assumed"),
    # ---- Zonen (Zeit je Zone im Listeneintrag) --------------------------------
    _f("hrTimeInZone_1", "s", "zones", ALL, "assumed"),
    _f("hrTimeInZone_2", "s", "zones", ALL, "assumed"),
    _f("hrTimeInZone_3", "s", "zones", ALL, "assumed"),
    _f("hrTimeInZone_4", "s", "zones", ALL, "assumed"),
    _f("hrTimeInZone_5", "s", "zones", ALL, "assumed"),
    _f("powerTimeInZone_1", "s", "zones", ("cycling", "running"), "assumed"),
    _f("powerTimeInZone_2", "s", "zones", ("cycling", "running"), "assumed"),
    _f("powerTimeInZone_3", "s", "zones", ("cycling", "running"), "assumed"),
    _f("powerTimeInZone_4", "s", "zones", ("cycling", "running"), "assumed"),
    _f("powerTimeInZone_5", "s", "zones", ("cycling", "running"), "assumed"),
    _f("powerTimeInZone_6", "s", "zones", ("cycling",), "assumed"),
    _f("powerTimeInZone_7", "s", "zones", ("cycling",), "assumed"),
    # ---- Leistung ------------------------------------------------------------
    _f("avgPower", "W", "power", ("cycling", "running"), "library"),
    _f("maxPower", "W", "power", ("cycling", "running"), "library"),
    _f("normPower", "W", "power", ("cycling", "running"), "library"),
    _f("max20MinPower", "W", "power", ("cycling",), "assumed"),
    _f("intensityFactor", "ratio", "power", ("cycling",), "assumed"),
    _f("trainingStressScore", "tss", "power", ("cycling",), "assumed"),
    _f("avgLeftBalance", "%", "power", ("cycling",), "assumed"),
    # ---- Laufen --------------------------------------------------------------
    _f("averageRunningCadenceInStepsPerMinute", "spm", "running", ("running",), "library",
       "Name sagt Schritte/min — ob voller Wert oder ein Bein, ist am Listeneintrag NICHT belegt; "
       "die Messreihe (directDoubleCadence) ist der belegte Wert"),
    _f("maxRunningCadenceInStepsPerMinute", "spm", "running", ("running",), "library", "siehe Durchschnitt"),
    _f("avgStrideLength", "cm", "running", ("running",), "assumed", "Einheit unbelegt"),
    _f("avgGroundContactTime", "ms", "running", ("running",), "assumed"),
    _f("avgVerticalOscillation", "cm", "running", ("running",), "assumed", "Einheit unbelegt"),
    _f("avgVerticalRatio", "%", "running", ("running",), "assumed"),
    _f("avgGroundContactBalance", "%", "running", ("running",), "assumed"),
    _f("avgGradeAdjustedSpeed", "m/s", "running", ("running",), "assumed"),
    # ---- Rad -----------------------------------------------------------------
    _f("averageBikingCadenceInRevPerMinute", "rpm", "cycling", ("cycling",), "assumed"),
    _f("maxBikingCadenceInRevPerMinute", "rpm", "cycling", ("cycling",), "assumed"),
    # ---- Schwimmen -----------------------------------------------------------
    _f("poolLength", "siehe unitOfPoolLength", "swimming", ("swimming",), "assumed", "Meter oder Yards"),
    _f("unitOfPoolLength", "enum", "swimming", ("swimming",), "assumed", "geschachtelt: unitKey"),
    _f("activeLengths", "count", "swimming", ("swimming",), "assumed"),
    _f("strokes", "count", "swimming", ("swimming", "rowing"), "assumed"),
    _f("avgStrokes", "count/length", "swimming", ("swimming",), "assumed"),
    _f("averageSwolf", "swolf", "swimming", ("swimming",), "assumed"),
    _f("averageSwimCadenceInStrokesPerMinute", "strokes/min", "swimming", ("swimming",), "assumed"),
    _f("maxSwimCadenceInStrokesPerMinute", "strokes/min", "swimming", ("swimming",), "assumed"),
    _f("avgStrokeDistance", "cm", "swimming", ("swimming", "rowing"), "assumed", "Einheit unbelegt"),
    # ---- Kraft ---------------------------------------------------------------
    _f("totalSets", "count", "strength", ("gym",), "library"),
    _f("activeSets", "count", "strength", ("gym",), "library"),
    _f("totalReps", "count", "strength", ("gym",), "library"),
    _f("totalVolume", "g?", "strength", ("gym",), "library", "Einheit unbelegt (Gramm oder Kilogramm)"),
    # ---- Umgebung ------------------------------------------------------------
    _f("minTemperature", "°C", "environment", ALL, "assumed"),
    _f("maxTemperature", "°C", "environment", ALL, "assumed"),
]
KNOWN_BY_KEY = {f["key"]: f for f in KNOWN}

# Felder des Listeneintrags, die an anderer Stelle der Zeile stehen (kein Verlust, keine Doppelung)
HANDLED_ELSEWHERE = ("activityId", "activityType", "startTimeGMT", "startTimeLocal")


_WORDS = re.compile(r"[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+")
_ENUM = re.compile(r"^[A-Z0-9]+(?:_[A-Z0-9]+)*$")


def _tokens(key: str) -> list[str]:
    out: list[str] = []
    for part in key.replace("-", "_").split("_"):
        out += [w.lower() for w in _WORDS.findall(part)]
    return out


def _is_private(key: str, value: Any = None) -> bool:
    toks = _tokens(key)
    if not toks:
        return True
    if any(t in PRIVATE_TOKENS for t in toks):
        return True
    if toks[-1] in ID_TOKENS and key not in ID_ALLOWED:
        return True
    if "name" in toks:
        # frei geschriebener Text ist privat; ein Aufzaehlungswert (BARBELL_BENCH_PRESS) nicht
        return not (isinstance(value, str) and _ENUM.match(value.strip() or "x") is not None)
    return False


def _looks_measured(key: str) -> bool:
    k = key.lower()
    return any(p in k for p in MEASURE_PARTS)


def _scalar(value: Any):
    """Zahl / Wahrheitswert / kurzer Aufzaehlungswert — sonst None (wird nicht erhalten)."""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value if math.isfinite(float(value)) else None
    if isinstance(value, str):
        v = value.strip()
        return v if 0 < len(v) <= STRING_MAX and "@" not in v and "://" not in v else None
    return None


def classify(key: str, value: Any) -> str:
    """'handled' | 'private' | 'known' | 'measured' | 'structure' | 'unrecognized' | 'empty'."""
    if key in HANDLED_ELSEWHERE:
        return "handled"
    if value is None:
        return "empty"
    if _is_private(key, value):
        return "private"
    if key in KNOWN_BY_KEY:
        return "known"
    if isinstance(value, (dict, list)):
        return "structure"
    if _scalar(value) is not None and _looks_measured(key):
        return "measured"
    return "unrecognized"


def retain_fields(raw: Any) -> dict:
    """Listeneintrag / Zusammenfassung → { garminName: rohwert }. Nur Skalare; bekannte
    Felder zuerst, danach unbeschriebene Messwerte; hoechstens FIELDS_MAX."""
    if not isinstance(raw, dict):
        return {}
    known: dict[str, Any] = {}
    extra: dict[str, Any] = {}
    for key, value in raw.items():
        if not isinstance(key, str):
            continue
        cls = classify(key, value)
        if cls == "known":
            # ein bekanntes Feld darf geschachtelt sein (unitOfPoolLength → unitKey)
            if isinstance(value, dict):
                inner = _scalar(value.get("unitKey")) if "unitKey" in value else None
                if inner is not None:
                    known[key] = inner
            else:
                s = _scalar(value)
                if s is not None:
                    known[key] = s
        elif cls == "measured":
            extra[key] = _scalar(value)
    out = dict(known)
    for key in sorted(extra):
        if len(out) >= FIELDS_MAX:
            break
        out[key] = extra[key]
    return out


def retain_structures(raw: Any) -> dict:
    """Geschachtelte Messwert-Bloecke des Listeneintrags (z. B. summarizedExerciseSets,
    splitSummaries) in ihrer Form erhalten — nur, wenn der Name nach Messwerten aussieht."""
    out: dict[str, Any] = {}
    if not isinstance(raw, dict):
        return out
    for key in sorted(k for k in raw if isinstance(k, str)):
        value = raw[key]
        if not isinstance(value, (dict, list)) or key in HANDLED_ELSEWHERE or key in KNOWN_BY_KEY:
            continue
        if _is_private(key, value) or not _looks_measured(key):
            continue
        kept = keep_structure(value)
        if kept not in (None, {}, []):
            out[key] = kept
    return out


def ext_block(raw: Any) -> dict:
    """Groesserer Herkunftsblock fuer metrics.ext (Server + Listen-Zwischenspeicher der App)."""
    out: dict[str, Any] = {"v": EXT_VERSION}
    fields = retain_fields(raw)
    if fields:
        out["fields"] = fields
    structs = retain_structures(raw)
    if structs:
        out["list"] = structs
    return out


def coverage(raw: Any) -> dict:
    """Erkannt gegen erhalten — fuer Mitschnitt-Skript und Tests. Nennt nur FELDNAMEN."""
    rep = {"known": [], "measured": [], "handled": [], "private": [], "structure": [], "unrecognized": [], "empty": []}
    if not isinstance(raw, dict):
        return rep
    for key in sorted(k for k in raw if isinstance(k, str)):
        rep[classify(key, raw[key])].append(key)
    rep["retained"] = sorted(retain_fields(raw).keys())
    rep["retained_structures"] = sorted(retain_structures(raw).keys())
    rep["evidence"] = {k: KNOWN_BY_KEY[k]["evidence"] for k in rep["known"]}
    return rep


# --- Zeit: Ortszeit und UTC nebeneinander erhalten -----------------------------

def _parse_wall(value: Any):
    if not isinstance(value, str) or not value.strip():
        return None
    s = value.strip().replace("T", " ").replace("Z", "")
    s = s.split(".")[0]
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def time_provenance(raw: Any) -> dict:
    """startTimeLocal (Wandzeit am Ort) + startTimeGMT → start_local, start_gmt, utc_offset_s.
    Der Versatz wird NUR aus den beiden gelieferten Zeiten gebildet (kein Zonenname noetig,
    Sommer-/Winterzeit steckt darin). Fehlt eine der beiden, entsteht kein Versatz."""
    out: dict[str, Any] = {}
    if not isinstance(raw, dict):
        return out
    loc, gmt = _parse_wall(raw.get("startTimeLocal")), _parse_wall(raw.get("startTimeGMT"))
    if loc is not None:
        out["start_local"] = loc.strftime("%Y-%m-%dT%H:%M:%S")
    if gmt is not None:
        out["start_gmt"] = gmt.strftime("%Y-%m-%dT%H:%M:%SZ")
    if loc is not None and gmt is not None:
        off = int(round((loc - gmt).total_seconds()))
        # plausibel sind −12 h … +14 h in Viertelstunden; sonst lieber kein Versatz
        if -12 * 3600 <= off <= 14 * 3600 and off % 900 == 0:
            out["utc_offset_s"] = off
    return out


def provenance(raw: Any) -> dict:
    """Kleiner Herkunftsblock fuer metrics.garmin (auf jedem Geraet gehalten)."""
    out: dict[str, Any] = {"v": EXT_VERSION}
    if not isinstance(raw, dict):
        return out
    at = raw.get("activityType")
    if isinstance(at, dict):
        tk = at.get("typeKey")
        if isinstance(tk, str) and tk.strip():
            out["type_key"] = tk.strip().lower()
        pt = at.get("parentTypeId")
        if isinstance(pt, int) and not isinstance(pt, bool):
            out["parent_type_id"] = pt
    out.update(time_provenance(raw))
    return out


# --- Zusatzabrufe (Runden, Zonen, Saetze): Struktur erhalten -------------------

LIST_MAX = 400
KEYS_MAX = 80
DEPTH_MAX = 4


def keep_structure(obj: Any, depth: int = 0) -> Any:
    """Geschachtelte Antwort → dieselbe Form, aber nur Messwerte: Skalare bleiben, private
    Felder und Koordinaten fallen weg, Listen/Schluessel sind gedeckelt. Feldnamen bleiben
    die von Garmin. Nichts wird umgerechnet."""
    if depth > DEPTH_MAX:
        return None
    if isinstance(obj, dict):
        out = {}
        for key in sorted(k for k in obj if isinstance(k, str)):
            if len(out) >= KEYS_MAX:
                break
            v = obj[key]
            if _is_private(key, v):
                continue
            if isinstance(v, (dict, list)):
                kept = keep_structure(v, depth + 1)
                if kept not in (None, {}, []):
                    out[key] = kept
            else:
                s = _scalar(v)
                if s is not None:
                    out[key] = s
        return out
    if isinstance(obj, list):
        out_l = []
        for item in obj[:LIST_MAX]:
            kept = keep_structure(item, depth + 1) if isinstance(item, (dict, list)) else _scalar(item)
            if kept not in (None, {}, []):
                out_l.append(kept)
        return out_l
    return _scalar(obj)
