"""Garmin-Roh-Antworten -> provider-neutrale NormalizedMetric/Device/Activity.

Eigenschaften (Spec §28 / CLAUDE.md 8.4):
- deterministisch und idempotent (gleicher Input -> identischer Output),
- non-mutating (Roh-Dicts werden nie verändert),
- tolerant gegen fehlende/kaputte Keys: fehlender Wert => Metrik wird NICHT
  emittiert (nie 0- oder None-Platzhalter).

Einheiten kanonisch laut Registry: Pace s/km, Gewicht/Massen kg (Garmin
liefert Gramm bei weigh-ins/body composition), Schlaf Minuten (Garmin
Sekunden), Race Predictions Sekunden.

Response-Shapes: wo die Struktur nicht gegen die Live-API verifiziert ist,
sind Parser mit "FIXTURE-ANNAHME: gegen Live-API verifizieren" markiert und
gegen tests/fixtures/garmin/*.json getestet.
"""

from __future__ import annotations

import math
from typing import Any

from .providers.base import NormalizedActivity, NormalizedDevice, NormalizedMetric
from .registry import daily_record_id, load_registry

# ---------------------------------------------------------------------------
# source_type-Klassifizierung (Spec: direkt gemessen vs. provider-berechnet)
# ---------------------------------------------------------------------------

DEVICE_MEASURED: frozenset[str] = frozenset({
    "weight_kg",
    "body_fat_pct",
    "body_water_pct",
    "muscle_mass_kg",
    "bone_mass_kg",
    "resting_hr",
    "hrv_ms",
    "sleep_duration_min",
    "steps",
    "floors_climbed",
    "spo2_avg",
    "respiration_avg",
    "max_hr",
})
# Alles andere (VO2max, FTP, race predictions, sleep_score, training_readiness,
# body_battery, stress_avg, fitness_age, endurance/hill score, acute_load,
# load_ratio, recovery_time_h, bmi, sleep_need_min, ...) ist provider_calculation.


def source_type_for(metric_id: str) -> str:
    return "device_measurement" if metric_id in DEVICE_MEASURED else "provider_calculation"


# ---------------------------------------------------------------------------
# Sport-Mapping Garmin typeKey -> kanonische ORVIA sport_ids
# (KEINE neuen Sport-IDs erfinden — Katalog aus training-domain.js)
# ---------------------------------------------------------------------------

SPORT_MAP: dict[str, str] = {
    "running": "running",
    "trail_running": "running",
    "treadmill_running": "running",
    "cycling": "cycling",
    "road_biking": "cycling",
    "gravel_cycling": "cycling",
    "mountain_biking": "cycling",
    "virtual_ride": "cycling",
    "indoor_cycling": "cycling",
    "lap_swimming": "swimming",
    "open_water_swimming": "swimming",
    "strength_training": "gym",
    "indoor_cardio": "gym",
    "walking": "walking",
    "hiking": "hiking",
    "tennis": "tennis",
    "padel": "padel",
    "soccer": "football",
    "handball": "handball",
    "basketball": "basketball",
    "rowing": "rowing",
    "indoor_rowing": "rowing",
    "multi_sport": "triathlon",
}


def map_sport(type_key: Any) -> str:
    if not isinstance(type_key, str):
        return "other"
    return SPORT_MAP.get(type_key.strip().lower(), "other")


# ---------------------------------------------------------------------------
# Hilfen
# ---------------------------------------------------------------------------

def _num(value: Any) -> float | None:
    """Zahl oder None — bools und kaputte Werte werden verworfen.

    NaN/Infinity werden explizit verworfen: Garmin liefert diese Werte
    gelegentlich für nicht berechenbare Felder (z.B. averageSpeed bei
    Distanz/Dauer 0). Pythons json-Modul akzeptiert sie beim Parsen und
    Serialisieren stillschweigend, aber PostgREST/Postgres lehnen sie als
    ungültiges JSON für den GESAMTEN Batch ab (HTTP 400, keine Detailzeile
    wegen bewusst payload-freiem Logging in db.py) — daher hier an der
    Quelle abfangen statt erst beim Schreiben scheitern.
    """
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        v = float(value)
        if math.isfinite(v):
            return v
        return None
    return None


def _get(d: Any, *path: str) -> Any:
    """Toleranter verschachtelter Zugriff; None bei jedem fehlenden Glied."""
    cur = d
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


class _Emitter:
    """Sammelt NormalizedMetric-Objekte; verwirft None/ungültige Werte."""

    def __init__(self, provider: str, metric_date: str) -> None:
        self.provider = provider
        self.metric_date = metric_date
        self.metrics: list[NormalizedMetric] = []
        self._registry = load_registry()

    def num(
        self,
        metric_id: str,
        value: Any,
        *,
        measured_at: str | None = None,
        device_hint: str | None = None,
    ) -> None:
        v = _num(value)
        if v is None:
            return  # fehlender Wert => keine Emission (§28: keine Nullwerte)
        spec = self._registry.get(metric_id)
        unit = spec.get("unit") if spec else None
        decimals = spec.get("decimals") if spec else None
        if isinstance(decimals, int):
            v = round(v, decimals)
        self.metrics.append(NormalizedMetric(
            metric_type=metric_id,
            value_numeric=v,
            unit=unit,
            metric_date=self.metric_date,
            measured_at=measured_at,
            source_type=source_type_for(metric_id),
            source_record_id=daily_record_id(self.provider, self.metric_date, metric_id),
            device_hint=device_hint,
        ))

    def text(self, metric_id: str, value: Any, *, measured_at: str | None = None) -> None:
        if not isinstance(value, str) or not value.strip():
            return
        self.metrics.append(NormalizedMetric(
            metric_type=metric_id,
            value_text=value.strip(),
            metric_date=self.metric_date,
            measured_at=measured_at,
            source_type=source_type_for(metric_id),
            source_record_id=daily_record_id(self.provider, self.metric_date, metric_id),
        ))


# ---------------------------------------------------------------------------
# Kategorie-Normalizer (raw -> list[NormalizedMetric])
# ---------------------------------------------------------------------------

def _norm_summary(e: _Emitter, raw: Any) -> None:
    # get_user_summary(date): Keys verifiziert übliche Garmin-Wellness-Namen.
    e.num("steps", _get(raw, "totalSteps"))
    e.num("active_kcal", _get(raw, "activeKilocalories"))
    e.num("resting_kcal", _get(raw, "bmrKilocalories"))
    e.num("total_kcal_provider", _get(raw, "totalKilocalories"))


def _norm_rhr(e: _Emitter, raw: Any) -> None:
    # get_rhr_day(date): allMetrics.metricsMap.WELLNESS_RESTING_HEART_RATE[0].value
    entries = _get(raw, "allMetrics", "metricsMap")
    if isinstance(entries, dict):
        lst = entries.get("WELLNESS_RESTING_HEART_RATE")
        if isinstance(lst, list) and lst and isinstance(lst[0], dict):
            e.num("resting_hr", lst[0].get("value"))
            return
    # Fallback-Shape mancher Versionen: {"restingHeartRate": 47}
    e.num("resting_hr", _get(raw, "restingHeartRate"))


def _norm_hrv(e: _Emitter, raw: Any) -> None:
    # get_hrv_data(date): hrvSummary.lastNightAvg / .status
    e.num("hrv_ms", _get(raw, "hrvSummary", "lastNightAvg"))
    e.text("hrv_status", _get(raw, "hrvSummary", "status"))


def _norm_sleep(e: _Emitter, raw: Any) -> None:
    dto = _get(raw, "dailySleepDTO")
    secs = _num(_get(dto, "sleepTimeSeconds"))
    if secs is not None and secs > 0:
        e.num("sleep_duration_min", secs / 60.0)  # Sekunden -> Minuten
    e.num("sleep_score", _get(dto, "sleepScores", "overall", "value"))
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — sleepNeed.actual in Minuten.
    e.num("sleep_need_min", _get(dto, "sleepNeed", "actual"))


def _norm_stress(e: _Emitter, raw: Any) -> None:
    # get_stress_data(date): avgStressLevel; -1/-2 = "keine Daten" bei Garmin.
    v = _num(_get(raw, "avgStressLevel"))
    if v is not None and v >= 0:
        e.num("stress_avg", v)


def _norm_body_battery(e: _Emitter, raw: Any) -> None:
    # get_body_battery(start,end) -> Liste von Tageseinträgen.
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — bodyBatteryValuesArray
    # enthält [timestamp, status, level, version]-Punkte (2-Tupel-Variante
    # [timestamp, level] wird ebenfalls akzeptiert); Tagesmaximum des Levels.
    if not isinstance(raw, list):
        return
    best: float | None = None
    for day in raw:
        arr = _get(day, "bodyBatteryValuesArray")
        if not isinstance(arr, list):
            continue
        for point in arr:
            if not isinstance(point, list) or len(point) < 2:
                continue
            level = _num(point[2]) if len(point) >= 3 else _num(point[1])
            if level is None or not (0 <= level <= 100):
                continue
            best = level if best is None else max(best, level)
    if best is not None:
        e.num("body_battery", best)


def _norm_spo2(e: _Emitter, raw: Any) -> None:
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — avgSleepSpO2 als Nachtmittel.
    v = _num(_get(raw, "avgSleepSpO2"))
    if v is None:
        v = _num(_get(raw, "averageSpO2"))
    e.num("spo2_avg", v)


def _norm_respiration(e: _Emitter, raw: Any) -> None:
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — avgSleepRespirationValue.
    v = _num(_get(raw, "avgSleepRespirationValue"))
    if v is None:
        v = _num(_get(raw, "avgWakingRespirationValue"))
    e.num("respiration_avg", v)


def _norm_floors(e: _Emitter, raw: Any) -> None:
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — floorsAscended (Tag).
    e.num("floors_climbed", _get(raw, "floorsAscended"))


def _norm_intensity(e: _Emitter, raw: Any) -> None:
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — Tageswerte moderate/vigorous.
    # Garmin zählt vigorous doppelt in Richtung Wochenziel.
    moderate = _num(_get(raw, "moderateIntensityMinutes"))
    vigorous = _num(_get(raw, "vigorousIntensityMinutes"))
    if moderate is None and vigorous is None:
        return
    e.num("intensity_minutes", (moderate or 0.0) + 2.0 * (vigorous or 0.0))


def _norm_training_readiness(e: _Emitter, raw: Any) -> None:
    # get_training_readiness(date) liefert je nach Version dict oder Liste.
    entry = raw[0] if isinstance(raw, list) and raw else raw
    e.num("training_readiness", _get(entry, "score"))
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — recoveryTime in Minuten.
    rec_min = _num(_get(entry, "recoveryTime"))
    if rec_min is not None:
        e.num("recovery_time_h", rec_min / 60.0)


def _norm_weigh_ins(e: _Emitter, raw: Any) -> None:
    # get_daily_weigh_ins(date): dateWeightList[].weight in GRAMM.
    entries = _get(raw, "dateWeightList")
    if not isinstance(entries, list) or not entries:
        return
    # Deterministisch: letzte Messung des Tages (nach timestampGMT sortiert,
    # fehlende Timestamps zuerst).
    def _ts(item: Any) -> tuple:
        t = _get(item, "timestampGMT")
        return (1, t) if isinstance(t, (int, float, str)) else (0, 0)

    latest = sorted((x for x in entries if isinstance(x, dict)), key=_ts)
    if not latest:
        return
    last = latest[-1]
    grams = _num(last.get("weight"))
    if grams is not None and grams > 0:
        measured_at = None
        cal_date = _get(last, "calendarDate")
        if isinstance(cal_date, str) and cal_date:
            measured_at = None  # Uhrzeit unklar; metric_date trägt den Tag
        e.num("weight_kg", grams / 1000.0, measured_at=measured_at,
              device_hint="smart_scale")


def _norm_body_composition(e: _Emitter, raw: Any) -> None:
    # get_body_composition(start,end): totalAverage mit Gramm-Massen.
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — Feldnamen bodyFat/bodyWater/
    # boneMass/muscleMass/visceralFat in totalAverage.
    avg = _get(raw, "totalAverage")
    if not isinstance(avg, dict):
        return
    e.num("bmi", avg.get("bmi"), device_hint="smart_scale")
    e.num("body_fat_pct", avg.get("bodyFat"), device_hint="smart_scale")
    e.num("body_water_pct", avg.get("bodyWater"), device_hint="smart_scale")
    bone_g = _num(avg.get("boneMass"))
    if bone_g is not None and bone_g > 0:
        e.num("bone_mass_kg", bone_g / 1000.0, device_hint="smart_scale")
    muscle_g = _num(avg.get("muscleMass"))
    if muscle_g is not None and muscle_g > 0:
        e.num("muscle_mass_kg", muscle_g / 1000.0, device_hint="smart_scale")
    e.num("visceral_fat_rating", avg.get("visceralFat"), device_hint="smart_scale")


def _norm_training_status(e: _Emitter, raw: Any) -> None:
    # get_training_status(date).
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — latestTrainingStatusData
    # ist device-id-keyed; trainingStatusFeedbackPhrase + acuteTrainingLoadDTO.
    data = _get(raw, "mostRecentTrainingStatus", "latestTrainingStatusData")
    if not isinstance(data, dict) or not data:
        return
    # Deterministisch: kleinste Device-ID (stringsortiert).
    entry = data[sorted(data.keys())[0]]
    status = _get(entry, "trainingStatusFeedbackPhrase")
    if not isinstance(status, str):
        status = _get(entry, "trainingStatus")
        status = status if isinstance(status, str) else None
    e.text("training_status", status)
    e.num("acute_load", _get(entry, "acuteTrainingLoadDTO", "acuteTrainingLoad"))
    e.num("load_ratio", _get(entry, "acuteTrainingLoadDTO", "dailyAcuteChronicWorkloadRatio"))


def _norm_max_metrics(e: _Emitter, raw: Any) -> None:
    # get_max_metrics(date): generic/cycling.vo2MaxPreciseValue.
    entry = raw[0] if isinstance(raw, list) and raw else raw
    e.num("vo2max_running", _get(entry, "generic", "vo2MaxPreciseValue"))
    e.num("vo2max_cycling", _get(entry, "cycling", "vo2MaxPreciseValue"))


def _norm_race_predictions(e: _Emitter, raw: Any) -> None:
    # get_race_predictions(): Sekunden je Distanz.
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — time5K/time10K/
    # timeHalfMarathon/timeMarathon (dict oder Liste mit jüngstem Eintrag zuerst).
    entry = raw[0] if isinstance(raw, list) and raw else raw
    e.num("race_prediction_5k", _get(entry, "time5K"))
    e.num("race_prediction_10k", _get(entry, "time10K"))
    e.num("race_prediction_half", _get(entry, "timeHalfMarathon"))
    e.num("race_prediction_marathon", _get(entry, "timeMarathon"))


def _norm_endurance(e: _Emitter, raw: Any) -> None:
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — overallScore.
    e.num("endurance_score", _get(raw, "overallScore"))


def _norm_hill(e: _Emitter, raw: Any) -> None:
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — overallScore.
    e.num("hill_score", _get(raw, "overallScore"))


def _norm_running_tolerance(e: _Emitter, raw: Any) -> None:
    # get_running_tolerance(start,end) -> Wochenliste.
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — Feldname der Toleranz
    # (weeklyTrainingLoad-Analogon); wir akzeptieren runningTolerance|tolerance.
    if not isinstance(raw, list) or not raw:
        return
    last = raw[-1]
    v = _num(_get(last, "runningTolerance"))
    if v is None:
        v = _num(_get(last, "tolerance"))
    e.num("running_tolerance", v)


def _norm_lactate(e: _Emitter, raw: Any) -> None:
    # get_lactate_threshold(latest=True).
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — heartRate bpm und
    # speed in m/s; Pace kanonisch als s/km (1000/speed).
    hr = _num(_get(raw, "heartRate"))
    if hr is None:
        hr = _num(_get(raw, "lactateThresholdHeartRate"))
    e.num("lactate_threshold_hr", hr)
    speed = _num(_get(raw, "speed"))
    if speed is None:
        speed = _num(_get(raw, "lactateThresholdSpeed"))
    if speed is not None and speed > 0:
        e.num("lactate_threshold_pace", 1000.0 / speed)


def _norm_ftp(e: _Emitter, raw: Any) -> None:
    # get_cycling_ftp() -> dict oder Liste.
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — ftpValue|ftp im jüngsten Eintrag.
    entry = raw[-1] if isinstance(raw, list) and raw else raw
    v = _num(_get(entry, "ftpValue"))
    if v is None:
        v = _num(_get(entry, "ftp"))
    e.num("ftp_watts", v)


def _norm_fitness_age(e: _Emitter, raw: Any) -> None:
    # FIXTURE-ANNAHME: gegen Live-API verifizieren — fitnessAge (Jahre).
    v = _num(_get(raw, "fitnessAge"))
    if v is None:
        v = _num(_get(raw, "achievableFitnessAge"))
    e.num("fitness_age", v)


# Kategorie -> (Normalizer, potenziell emittierte Metrik-IDs).
# Die Metrik-Listen speisen die Capability-Zustandsmaschine.
DAILY_CATEGORIES: dict[str, tuple] = {
    "summary": (_norm_summary, ["steps", "active_kcal", "resting_kcal", "total_kcal_provider"]),
    "rhr": (_norm_rhr, ["resting_hr"]),
    "hrv": (_norm_hrv, ["hrv_ms", "hrv_status"]),
    "sleep": (_norm_sleep, ["sleep_duration_min", "sleep_score", "sleep_need_min"]),
    "stress": (_norm_stress, ["stress_avg"]),
    "body_battery": (_norm_body_battery, ["body_battery"]),
    "spo2": (_norm_spo2, ["spo2_avg"]),
    "respiration": (_norm_respiration, ["respiration_avg"]),
    "floors": (_norm_floors, ["floors_climbed"]),
    "intensity": (_norm_intensity, ["intensity_minutes"]),
    "training_readiness": (_norm_training_readiness, ["training_readiness", "recovery_time_h"]),
    "weigh_ins": (_norm_weigh_ins, ["weight_kg"]),
    "body_composition": (_norm_body_composition, [
        "bmi", "body_fat_pct", "body_water_pct", "bone_mass_kg",
        "muscle_mass_kg", "visceral_fat_rating",
    ]),
}

PERFORMANCE_CATEGORIES: dict[str, tuple] = {
    "training_status": (_norm_training_status, ["training_status", "acute_load", "load_ratio"]),
    "max_metrics": (_norm_max_metrics, ["vo2max_running", "vo2max_cycling"]),
    "race_predictions": (_norm_race_predictions, [
        "race_prediction_5k", "race_prediction_10k",
        "race_prediction_half", "race_prediction_marathon",
    ]),
    "endurance": (_norm_endurance, ["endurance_score"]),
    "hill": (_norm_hill, ["hill_score"]),
    "running_tolerance": (_norm_running_tolerance, ["running_tolerance"]),
    "lactate": (_norm_lactate, ["lactate_threshold_hr", "lactate_threshold_pace"]),
    "ftp": (_norm_ftp, ["ftp_watts"]),
    "fitness_age": (_norm_fitness_age, ["fitness_age"]),
}


def normalize_category(
    category: str, raw: Any, *, provider: str, metric_date: str
) -> list[NormalizedMetric]:
    """Normalisiert die Roh-Antwort einer Abruf-Kategorie. Pure, non-mutating."""
    spec = DAILY_CATEGORIES.get(category) or PERFORMANCE_CATEGORIES.get(category)
    if spec is None:
        raise ValueError(f"Unbekannte Kategorie: {category}")
    emitter = _Emitter(provider, metric_date)
    if raw is not None:
        spec[0](emitter, raw)
    return emitter.metrics


def category_metric_ids(category: str) -> list[str]:
    spec = DAILY_CATEGORIES.get(category) or PERFORMANCE_CATEGORIES.get(category)
    return list(spec[1]) if spec else []


# ---------------------------------------------------------------------------
# Geräte
# ---------------------------------------------------------------------------

def classify_device_type(product_name: Any) -> str:
    """Heuristik aus Produktnamen -> device_type (Whitelist aus 0019)."""
    name = (product_name or "").lower() if isinstance(product_name, str) else ""
    if "scale" in name or "index" in name:
        return "smart_scale"
    if "edge" in name:
        return "cycling_computer"
    if "hrm" in name:
        return "chest_strap"
    return "watch"


def normalize_devices(
    raw_devices: Any,
    last_used_device_id: Any = None,
    primary_training_device_id: Any = None,
) -> list[NormalizedDevice]:
    """get_devices()-Antwort -> NormalizedDevice-Liste (deterministische Reihenfolge)."""
    if not isinstance(raw_devices, list):
        return []
    out: list[NormalizedDevice] = []
    for d in raw_devices:
        if not isinstance(d, dict):
            continue
        device_id = d.get("deviceId")
        if device_id is None:
            continue
        product = d.get("productDisplayName") or d.get("displayName")
        dtype = classify_device_type(product)
        out.append(NormalizedDevice(
            provider_device_id=str(device_id),
            unit_id=str(d["unitId"]) if d.get("unitId") is not None else None,
            product_id=str(d["productNumber"]) if d.get("productNumber") is not None else None,
            device_name=product if isinstance(product, str) else None,
            model_name=d.get("model") if isinstance(d.get("model"), str) else None,
            device_type=dtype,
            software_version=(
                str(d["softwareVersion"]) if d.get("softwareVersion") is not None else None
            ),
            is_primary_wearable=bool(d.get("primaryActivityTrackerIndicator")),
            is_primary_training_device=(
                primary_training_device_id is not None
                and str(device_id) == str(primary_training_device_id)
            ),
            is_last_used=(
                last_used_device_id is not None
                and str(device_id) == str(last_used_device_id)
            ),
        ))
    return sorted(out, key=lambda x: x.provider_device_id)


# ---------------------------------------------------------------------------
# Aktivitäten
# ---------------------------------------------------------------------------

def _iso_or_none(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _json_safe(value: Any) -> Any:
    """Rekursiv NaN/Infinity -> None. Schützt jsonb-Spalten (summary/metrics)
    vor demselben Batch-weiten HTTP-400-Effekt wie bei _num() beschrieben —
    hier reichen die Garmin-Rohwerte sonst ungeprüft (kein _num()-Aufruf)
    direkt in die JSON-Payload durch."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def normalize_activity(raw: Any) -> NormalizedActivity | None:
    """get_activities_by_date()-Eintrag -> NormalizedActivity (oder None)."""
    if not isinstance(raw, dict):
        return None
    activity_id = raw.get("activityId")
    if activity_id is None:
        return None
    type_key = _get(raw, "activityType", "typeKey")
    sport_raw = type_key if isinstance(type_key, str) else "unknown"
    sport_id = map_sport(sport_raw)

    summary: dict[str, Any] = {}
    for src_key, dst_key in (
        ("distance", "distance_m"),
        ("calories", "calories_kcal"),
        ("averageHR", "avg_hr"),
        ("maxHR", "max_hr"),
        ("elevationGain", "elevation_gain_m"),
        ("averageSpeed", "avg_speed_mps"),
        ("activityName", "name"),
    ):
        v = raw.get(src_key)
        if v is not None:
            summary[dst_key] = _json_safe(v)

    metrics: dict[str, Any] = {}
    if sport_id == "other":
        # Rohtyp erhalten (Design §6): keine neuen Sport-IDs, aber nichts verlieren.
        metrics["source_sport_raw"] = sport_raw
    training_load = raw.get("activityTrainingLoad")
    if training_load is not None:
        metrics["training_load"] = _json_safe(training_load)

    duration = _num(raw.get("duration"))
    started_at = _iso_or_none(raw.get("startTimeGMT")) or _iso_or_none(raw.get("startTimeLocal"))

    return NormalizedActivity(
        source_record_id=str(activity_id),
        sport_raw=sport_raw,
        sport_id=sport_id,
        started_at=started_at,
        ended_at=None,  # Garmin liefert kein Ende; sync leitet aus duration ab
        duration_seconds=duration,
        summary=summary,
        metrics=metrics,
    )
