"""Sync-Orchestrator (Design §6): ein Lauf pro Nutzer.

Pipeline: Tokens laden -> Provider -> Geräte -> Tagesmetriken (heute +
Backfill beim Erstsync) -> normalisieren -> validieren -> idempotent upserten
-> Aktivitäten -> Capabilities -> data_providers-Status.

Fehler je Teilschritt sind isoliert: ein fehlgeschlagener Abruf bricht nicht
den ganzen Sync; am Ende steht ein ehrlicher Status (last_error_code gesetzt,
last_successful_sync_at nur bei fehlerfreiem Lauf).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from .capabilities import derive_capability
from .providers.base import (
    AuthError,
    NormalizedActivity,
    NormalizedDevice,
    NormalizedMetric,
    ProviderError,
)
from .validation import validate_metric

logger = logging.getLogger("orvia.sync")

PROVIDER_TYPE = "garmin_unofficial"

# Metriken der Waage werden dem smart_scale-Gerät zugeordnet, alles andere
# der primären Uhr (device_hint aus der Normalisierung).
_SCALE_HINT = "smart_scale"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_today(tz_name: str, fallback_tz: str) -> Any:
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo(fallback_tz)
    return datetime.now(tz).date()


def _ended_at_from(activity: NormalizedActivity) -> str | None:
    """ended_at = started_at + duration, wenn beides vorhanden und parsebar."""
    if not activity.started_at or not activity.duration_seconds:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            start = datetime.strptime(activity.started_at, fmt)
            end = start + timedelta(seconds=float(activity.duration_seconds))
            return end.strftime(fmt)
        except ValueError:
            continue
    return None


async def sync_user(
    user_id: str,
    *,
    db,
    crypto,
    settings,
    provider_factory,
    today=None,
) -> dict:
    """Ein vollständiger Sync-Lauf. Rückgabe: ehrlicher Ergebnisbericht.

    provider_factory(token_str) -> eingeloggter HealthDataProvider
    (wirft AuthError bei ungültigen Tokens — fail closed, kein Passwort-Fallback).
    """
    result: dict[str, Any] = {"ok": False, "user_id": user_id, "steps": {}, "errors": []}

    # -- 1) Providerzeile + Credentials --------------------------------------
    prov_rows = await db.select(
        "data_providers", {"user_id": user_id, "provider_type": PROVIDER_TYPE}
    )
    if not prov_rows:
        result["errors"].append("provider_row_missing")
        return result
    prov_row = prov_rows[0]
    provider_id = prov_row.get("id")

    cred_rows = await db.select(
        "provider_credentials",
        {
            "user_id": user_id,
            "provider_type": PROVIDER_TYPE,
            "credential_kind": "session_tokens",
        },
    )
    if not cred_rows:
        await db.update(
            "data_providers",
            {"user_id": user_id, "provider_type": PROVIDER_TYPE},
            {
                "connection_status": "reauth_required",
                "reauthentication_required": True,
                "last_error_code": "TOKENS_MISSING",
                "last_sync_at": _now_iso(),
            },
        )
        result["errors"].append("tokens_missing")
        return result

    try:
        token_str = crypto.decrypt_str(
            cred_rows[0]["encrypted_payload"], cred_rows[0].get("key_version", 1)
        )
        provider = await asyncio.to_thread(provider_factory, token_str)
    except (AuthError, Exception) as e:
        code = getattr(e, "code", "TOKEN_DECRYPT_FAILED")
        await db.update(
            "data_providers",
            {"user_id": user_id, "provider_type": PROVIDER_TYPE},
            {
                "connection_status": "reauth_required",
                "reauthentication_required": True,
                "last_error_code": code,
                "last_sync_at": _now_iso(),
            },
        )
        result["errors"].append(f"login:{code}")
        return result
    result["steps"]["login"] = "ok"

    # -- 2) Zeitzone & Zieltage ----------------------------------------------
    tz_name = settings.default_timezone
    try:
        profile_rows = await db.select(
            "user_profiles", {"user_id": user_id}, columns="timezone", limit=1
        )
        if profile_rows and profile_rows[0].get("timezone"):
            tz_name = profile_rows[0]["timezone"]
    except Exception:
        result["errors"].append("timezone_lookup_failed")

    today = today or _user_today(tz_name, settings.default_timezone)
    if prov_row.get("last_successful_sync_at"):
        # Folge-Sync: heute + gestern (spät ankommende Schlaf-/Waagen-Daten).
        dates = [today - timedelta(days=1), today]
    else:
        # Erstsync: Backfill.
        n = max(0, int(settings.sync_backfill_days))
        dates = [today - timedelta(days=i) for i in range(n, -1, -1)]
    date_strs = [d.isoformat() for d in dates]

    # -- 3) Geräte ------------------------------------------------------------
    devices: list[NormalizedDevice] = []
    device_rows: list[dict] = []
    try:
        devices = await asyncio.to_thread(provider.get_devices)
        if devices:
            rows = [
                {
                    "user_id": user_id,
                    "provider_id": provider_id,
                    "provider_device_id": d.provider_device_id,
                    "unit_id": d.unit_id,
                    "product_id": d.product_id,
                    "device_name": d.device_name,
                    "model_name": d.model_name,
                    "device_type": d.device_type,
                    "software_version": d.software_version,
                    "is_primary_wearable": d.is_primary_wearable,
                    "is_primary_training_device": d.is_primary_training_device,
                    "is_last_used": d.is_last_used,
                    "last_seen_at": _now_iso(),
                }
                for d in devices
            ]
            device_rows = await db.upsert("connected_devices", rows, returning=True)
        result["steps"]["devices"] = f"ok:{len(devices)}"
    except ProviderError as e:
        result["errors"].append(f"devices:{e.code}")
        result["steps"]["devices"] = "failed"

    device_id_by_provider_device: dict[str, str] = {
        r["provider_device_id"]: r["id"]
        for r in device_rows
        if r.get("id") and r.get("provider_device_id")
    }

    def _device_uuid_for(hint: str | None) -> str | None:
        """device_hint -> connected_devices.id (Waage vs. primäre Uhr)."""
        wanted_scale = hint == _SCALE_HINT
        candidates = [
            d for d in devices
            if (d.device_type == "smart_scale") == wanted_scale
        ]
        if not candidates:
            return None
        primary = sorted(
            candidates,
            key=lambda d: (not d.is_primary_wearable, not d.is_last_used, d.provider_device_id),
        )[0]
        return device_id_by_provider_device.get(primary.provider_device_id)

    # -- 4) Metriken abrufen + normalisieren ---------------------------------
    metrics: list[NormalizedMetric] = []
    # outcome je (Metrik-ID): 'value' > 'error' > 'empty' über alle Tage
    outcome_by_metric: dict[str, str] = {}

    def _record_outcome(metric_ids: list[str], outcome: str) -> None:
        rank = {"empty": 0, "error": 1, "value": 2}
        for mid in metric_ids:
            prev = outcome_by_metric.get(mid, "empty")
            if rank[outcome] > rank[prev]:
                outcome_by_metric[mid] = outcome
            else:
                outcome_by_metric.setdefault(mid, prev)

    fetch_errors = 0
    for d in date_strs:
        for category, metric_ids in provider.daily_category_metrics.items():
            try:
                got = await asyncio.to_thread(provider.get_daily_metrics, category, d)
                metrics.extend(got)
                emitted = {m.metric_type for m in got}
                _record_outcome([m for m in metric_ids if m in emitted], "value")
                _record_outcome([m for m in metric_ids if m not in emitted], "empty")
            except ProviderError as e:
                fetch_errors += 1
                result["errors"].append(f"{category}:{d}:{e.code}")
                _record_outcome(metric_ids, "error")

    today_str = today.isoformat()
    for category, metric_ids in provider.performance_category_metrics.items():
        try:
            got = await asyncio.to_thread(
                provider.get_performance_metrics, category, today_str
            )
            metrics.extend(got)
            emitted = {m.metric_type for m in got}
            _record_outcome([m for m in metric_ids if m in emitted], "value")
            _record_outcome([m for m in metric_ids if m not in emitted], "empty")
        except ProviderError as e:
            fetch_errors += 1
            result["errors"].append(f"{category}:{e.code}")
            _record_outcome(metric_ids, "error")

    result["steps"]["fetch"] = f"metrics:{len(metrics)},fetch_errors:{fetch_errors}"

    # -- 5) Validieren + user_metrics upserten -------------------------------
    metric_rows: list[dict] = []
    anomalies: list[tuple[str, dict]] = []  # (source_record_id, anomaly)
    # Ältestes Datum zuerst, damit Backfill-Sprünge chronologisch geprüft werden.
    metrics_sorted = sorted(metrics, key=lambda m: (m.metric_date, m.metric_type))
    last_valid_cache: dict[str, tuple[float, str] | None] = {}

    for m in metrics_sorted:
        last_valid = None
        if m.value_numeric is not None:
            if m.metric_type not in last_valid_cache:
                try:
                    prev_rows = await db.select(
                        "user_metrics",
                        {
                            "user_id": user_id,
                            "metric_type": m.metric_type,
                            "validity": "valid",
                            "metric_date": ("lt", m.metric_date),
                        },
                        order="metric_date.desc",
                        limit=1,
                    )
                    if prev_rows and prev_rows[0].get("value_numeric") is not None:
                        last_valid_cache[m.metric_type] = (
                            float(prev_rows[0]["value_numeric"]),
                            str(prev_rows[0]["metric_date"]),
                        )
                    else:
                        last_valid_cache[m.metric_type] = None
                except Exception:
                    last_valid_cache[m.metric_type] = None
            last_valid = last_valid_cache.get(m.metric_type)

        days_between = None
        prev_value = None
        if last_valid is not None:
            prev_value = last_valid[0]
            try:
                d0 = datetime.strptime(last_valid[1], "%Y-%m-%d").date()
                d1 = datetime.strptime(m.metric_date, "%Y-%m-%d").date()
                days_between = max(1, (d1 - d0).days)
            except ValueError:
                days_between = None

        validity, anomaly = validate_metric(m, prev_value, days_between)
        if validity == "valid" and m.value_numeric is not None:
            # Neuer gültiger Wert wird Referenz für spätere Tage im Lauf.
            last_valid_cache[m.metric_type] = (m.value_numeric, m.metric_date)
        if anomaly is not None:
            anomalies.append((m.source_record_id, anomaly))

        metric_rows.append({
            "user_id": user_id,
            "provider_id": provider_id,
            "device_id": _device_uuid_for(m.device_hint),
            "metric_type": m.metric_type,
            "value_numeric": m.value_numeric,
            "value_text": m.value_text,
            "unit": m.unit,
            "metric_date": m.metric_date,
            "measured_at": m.measured_at,
            "source_type": m.source_type,
            "source_record_id": m.source_record_id,
            "quality": m.quality,
            "confidence": m.confidence,
            "validity": validity,
        })

    stored_rows: list[dict] = []
    if metric_rows:
        try:
            stored_rows = await db.upsert("user_metrics", metric_rows, returning=True)
            result["steps"]["user_metrics"] = f"ok:{len(metric_rows)}"
        except Exception:
            result["errors"].append("user_metrics_upsert_failed")
            result["steps"]["user_metrics"] = "failed"
    else:
        result["steps"]["user_metrics"] = "ok:0"

    # -- 6) Anomalien (dedupliziert über offene Anomalie je Metrikzeile) -----
    metric_id_by_record = {
        r.get("source_record_id"): r.get("id") for r in stored_rows if r.get("id")
    }
    anomaly_count = 0
    for record_id, anomaly in anomalies:
        metric_uuid = metric_id_by_record.get(record_id)
        try:
            if metric_uuid is not None:
                existing = await db.select(
                    "metric_anomalies", {"metric_id": metric_uuid}, limit=1
                )
                if existing:
                    continue  # zweiter Lauf: keine Doppel-Anomalie
            await db.insert("metric_anomalies", [{
                "user_id": user_id,
                "metric_type": anomaly.get("detail", {}).get("metric_type")
                or record_id.split(":")[-1],
                "metric_id": metric_uuid,
                "anomaly_type": anomaly["anomaly_type"],
                "severity": anomaly.get("severity", "warning"),
                "previous_value": anomaly.get("previous_value"),
                "new_value": anomaly.get("new_value"),
                "detail": {**anomaly.get("detail", {}), "source_record_id": record_id},
            }])
            anomaly_count += 1
        except Exception:
            result["errors"].append("anomaly_insert_failed")
    result["steps"]["anomalies"] = f"ok:{anomaly_count}"

    # -- 7) Aktivitäten -------------------------------------------------------
    try:
        acts = await asyncio.to_thread(
            provider.get_activities, date_strs[0], date_strs[-1]
        )
        new_count = 0
        for act in acts:
            # Kein verlässlicher Unique-Index auf activities (0009 nicht Teil
            # dieses Vertrags) -> deterministisches select-then-insert-Dedupe.
            existing = await db.select(
                "activities",
                {
                    "user_id": user_id,
                    "source": "garmin",
                    "source_record_id": act.source_record_id,
                },
                limit=1,
            )
            if existing:
                continue
            # duration_seconds ist in der DB eine Ganzzahl-Spalte; Garmin
            # liefert Sekunden mit Nachkommastellen (z.B. 3475.136962890625).
            # Live-Fehler (2026-07-17): Postgres 22P02 "invalid input syntax
            # for type integer" bei unverändertem Float-Wert.
            duration_int = (
                round(act.duration_seconds) if act.duration_seconds is not None else None
            )
            await db.insert("activities", [{
                "user_id": user_id,
                "sport_id": act.sport_id,
                "source": "garmin",
                "source_record_id": act.source_record_id,
                "started_at": act.started_at,
                "ended_at": _ended_at_from(act),
                "duration_seconds": duration_int,
                # activities_status_chk (live verifiziert, 2026-07-17) erlaubt
                # nur 'completed'/'aborted'/'cancelled'/'planned' — 'final' gab
                # es in diesem Enum nie. Aus Garmin importierte Aktivitäten
                # sind historische, abgeschlossene Trainings -> 'completed'.
                "status": "completed",
                "summary": act.summary,
                "metrics": act.metrics,
            }])
            new_count += 1
        result["steps"]["activities"] = f"ok:{new_count}/{len(acts)}"
    except ProviderError as e:
        result["errors"].append(f"activities:{e.code}")
        result["steps"]["activities"] = "failed"
    except Exception:
        result["errors"].append("activities_store_failed")
        result["steps"]["activities"] = "failed"

    # -- 8) Capabilities ------------------------------------------------------
    cap_count = 0
    try:
        scale_metric_hints = {
            m.metric_type: m.device_hint for m in metrics if m.device_hint
        }
        for metric_type, outcome in sorted(outcome_by_metric.items()):
            device_uuid = _device_uuid_for(scale_metric_hints.get(metric_type))
            if device_uuid is None:
                continue
            prior_rows = await db.select(
                "device_capabilities",
                {"device_id": device_uuid, "metric_type": metric_type},
                limit=1,
            )
            prior = prior_rows[0].get("capability_status") if prior_rows else None
            status = derive_capability(prior, outcome)
            now = _now_iso()
            row = {
                "device_id": device_uuid,
                "user_id": user_id,
                "metric_type": metric_type,
                "capability_status": status,
                "last_observed_at": now,
            }
            if outcome == "value":
                row["last_valid_value_at"] = now
                if not prior_rows or not prior_rows[0].get("first_observed_at"):
                    row["first_observed_at"] = now
            await db.upsert("device_capabilities", [row])
            cap_count += 1
        result["steps"]["capabilities"] = f"ok:{cap_count}"
    except Exception:
        result["errors"].append("capabilities_failed")
        result["steps"]["capabilities"] = "failed"

    # -- 9) Providerstatus (ehrlich) ------------------------------------------
    ok = not any(
        e for e in result["errors"]
        if not e.startswith("timezone_lookup")  # weicher Fehler mit Fallback
    )
    patch: dict[str, Any] = {
        "connection_status": "connected",
        "last_sync_at": _now_iso(),
        "last_error_code": None if ok else _first_error_code(result["errors"]),
        "reauthentication_required": False,
    }
    if ok:
        patch["last_successful_sync_at"] = _now_iso()
    status_extra = {}
    try:
        status_extra = await asyncio.to_thread(provider.get_profile_metrics)
    except Exception:
        pass
    if status_extra:
        patch["provider_status"] = status_extra
    await db.update(
        "data_providers",
        {"user_id": user_id, "provider_type": PROVIDER_TYPE},
        patch,
    )
    result["ok"] = ok
    return result


def _first_error_code(errors: list[str]) -> str:
    if not errors:
        return "SYNC_PARTIAL"
    first = errors[0]
    return first.rsplit(":", 1)[-1][:64] if ":" in first else first[:64]
