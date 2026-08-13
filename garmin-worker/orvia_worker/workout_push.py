"""Kraft-Workout-Push (Kraftplan v2, K5) — Prüfung, Idempotenz, Persistenz.

KONTROLLIERTER SPIKE, KEINE FREIGABE. Die numerische Sport-ID und die
numerische ID der Abbruchbedingung `reps` sind weiterhin unbelegt (Gate G1).
Solange sie fehlen, lehnt dieser Endpunkt jedes Payload im REGELBETRIEB ab.
Nur ein SERVERSEITIG freigeschalteter Gerätetestmodus lässt sie durch — ein
Client-Flag allein genügt ausdrücklich nicht.

VERTRAG
  200 {workoutId, status}
  409 {code:'already_pushed', workoutId, status}
  409 {code:'client_ref_conflict', workoutId, status}   ← Erweiterung, s. u.
  401 {code:'reauthentication_required'}
  422 {code:'invalid_workout', details:[…]}
  502 {code:'garmin_unavailable', retryAfter?, detail?}

Die Erweiterung `client_ref_conflict` ist nötig, weil der Auftrag zwei
verschiedene 409-Fälle unterscheidet: derselbe clientRef mit demselben
Payload-Hash ist ein harmloser Wiederholungsversuch (`already_pushed`);
derselbe clientRef mit ANDEREM Hash ist ein echter Konflikt — der Plan hat
sich seit dem Push geändert. Ein bestehendes Garmin-Workout wird dabei NIEMALS
still ersetzt.

SICHERHEIT
  · Der Nutzer stammt ausschliesslich aus dem serverseitig verifizierten
    Supabase-JWT. Ein `user_id` im Body wird nicht gelesen — es existiert
    schlicht kein Feld dafür (Pydantic-Modell mit forbid).
  · Keine Tokens, Passwörter oder vollständigen Payloads in Logs oder in
    `last_error`. Gespeichert wird ausschliesslich ein bereinigter Code aus
    einer festen Liste.
  · Kein Passwort-Fallback. Fehlt oder greift das Token nicht, endet der
    Vorgang mit `reauthentication_required` — fail closed.
"""

from __future__ import annotations

import logging
from typing import Any

from .providers.base import AuthError, ProviderError, RateLimited
from .sync import PROVIDER_TYPE

logger = logging.getLogger("orvia.workout_push")

TABLE = "strength_workout_exports"
ON_CONFLICT_EXPORTS = "user_id,client_ref"   # Unique aus Migration 0035

MAX_CLIENT_REF = 200
MAX_BINDINGS = 200
MAX_STEPS = 400

# Fester Vorrat an Fehlercodes für `last_error`. Alles, was nicht hier steht,
# wird zu 'unknown' — so kann keine Fremdnachricht (und damit kein Geheimnis)
# in die Datenbank sickern.
SAFE_ERROR_CODES = {
    "auth_failed", "rate_limited", "provider_unavailable", "garmin_no_workout_id",
    "tokens_missing", "token_decrypt_failed", "invalid_workout", "unknown",
}


def _safe_code(code: Any) -> str:
    c = str(code or "").strip().lower()
    return c if c in SAFE_ERROR_CODES else "unknown"


# ---------------------------------------------------------------------------
# Prüfung (rein, ohne Netz und ohne Datenbank)
# ---------------------------------------------------------------------------

def _walk_steps(steps: Any, out: list, depth: int = 0) -> None:
    if not isinstance(steps, list) or depth > 4:
        return
    for s in steps:
        if isinstance(s, dict):
            out.append(s)
            _walk_steps(s.get("workoutSteps"), out, depth + 1)


def validate_push_request(
    *, workout: Any, step_bindings: Any, client_ref: Any, occurrence_id: Any,
    payload_version: Any, mapping_version: Any, payload_hash: Any,
    device_test: bool,
) -> list[str]:
    """Liefert eine Liste von Beanstandungen (leer = in Ordnung).

    Die Beanstandungen nennen NUR Feldpfade und Gründe — niemals Werte aus dem
    Payload. Sie gehen unverändert an den Client und dürfen deshalb nichts
    enthalten, was nicht ohnehin von ihm kam.
    """
    d: list[str] = []

    def _nonempty_str(v, name, limit=200):
        if not isinstance(v, str) or not v.strip():
            d.append(f"{name}: fehlt oder leer")
        elif len(v) > limit:
            d.append(f"{name}: zu lang (max {limit})")

    _nonempty_str(client_ref, "clientRef", MAX_CLIENT_REF)
    _nonempty_str(payload_version, "payloadVersion")
    _nonempty_str(mapping_version, "mappingVersion")
    _nonempty_str(payload_hash, "payloadHash")
    if not isinstance(occurrence_id, str) or not occurrence_id.startswith("po:"):
        d.append("occurrenceId: muss mit 'po:' beginnen")

    if not isinstance(workout, dict):
        d.append("workout: kein Objekt")
        return d
    if not isinstance(workout.get("workoutName"), str) or not workout["workoutName"].strip():
        d.append("workout.workoutName: fehlt oder leer")

    sport = workout.get("sportType")
    if not isinstance(sport, dict):
        d.append("workout.sportType: fehlt")
    else:
        if not sport.get("sportTypeKey"):
            d.append("workout.sportType.sportTypeKey: fehlt")
        if sport.get("sportTypeId") is None and not device_test:
            d.append("workout.sportType.sportTypeId: nicht belegt (Gate G1) — "
                     "im Regelbetrieb gesperrt")

    segments = workout.get("workoutSegments")
    if not isinstance(segments, list) or not segments:
        d.append("workout.workoutSegments: fehlt oder leer")
        return d

    steps: list = []
    for seg in segments:
        if isinstance(seg, dict):
            _walk_steps(seg.get("workoutSteps"), steps)
    if not steps:
        d.append("workout.workoutSegments[].workoutSteps: keine Schritte")
        return d
    if len(steps) > MAX_STEPS:
        d.append(f"workout: zu viele Schritte (max {MAX_STEPS})")

    missing_cond = 0
    weights = 0
    for s in steps:
        ec = s.get("endCondition")
        if isinstance(ec, dict) and ec.get("conditionTypeId") is None:
            missing_cond += 1
        if "weightValue" in s:
            weights += 1
    if missing_cond and not device_test:
        d.append(f"workout: {missing_cond} Schritt(e) ohne belegte "
                 f"endCondition.conditionTypeId (Gate G1) — im Regelbetrieb gesperrt")
    # G3: der Worker ergaenzt oder skaliert NIE ein Gewicht. Kommt eines an,
    # obwohl das Gate zu ist, wurde es clientseitig im Testmodus erzeugt —
    # das ist im Regelbetrieb ein Fehler, kein stillschweigendes Entfernen.
    if weights and not device_test:
        d.append(f"workout: {weights} Schritt(e) mit weightValue, aber Gate G3 "
                 f"ist geschlossen — im Regelbetrieb gesperrt")

    if not isinstance(step_bindings, list) or not step_bindings:
        d.append("stepBindings: fehlt oder leer")
    elif len(step_bindings) > MAX_BINDINGS:
        d.append(f"stepBindings: zu viele Eintraege (max {MAX_BINDINGS})")
    else:
        for i, b in enumerate(step_bindings):
            if not isinstance(b, dict):
                d.append(f"stepBindings[{i}]: kein Objekt")
                continue
            if not isinstance(b.get("stepOrder"), int):
                d.append(f"stepBindings[{i}].stepOrder: fehlt")
            if not isinstance(b.get("exerciseId"), str) or not b["exerciseId"]:
                d.append(f"stepBindings[{i}].exerciseId: fehlt")
            if not isinstance(b.get("plannedIndex"), int):
                d.append(f"stepBindings[{i}].plannedIndex: fehlt")
            if not isinstance(b.get("mappingVersion"), str) or not b["mappingVersion"]:
                d.append(f"stepBindings[{i}].mappingVersion: fehlt")
        bound = {b.get("stepOrder") for b in step_bindings if isinstance(b, dict)}
        payload_orders = {s.get("stepOrder") for s in steps}
        if bound != payload_orders:
            d.append("stepBindings: deckt nicht genau die Schritte des Payloads ab")

    return d


# ---------------------------------------------------------------------------
# Ergebnisobjekt — der Endpunkt uebersetzt es nur noch in HTTP
# ---------------------------------------------------------------------------

class PushResult:
    __slots__ = ("status_code", "body")

    def __init__(self, status_code: int, body: dict) -> None:
        self.status_code = status_code
        self.body = body


def _ok(workout_id: str, status: str) -> PushResult:
    return PushResult(200, {"ok": True, "workoutId": workout_id, "status": status})


def _conflict(code: str, row: dict) -> PushResult:
    return PushResult(409, {
        "ok": False, "code": code,
        "workoutId": row.get("garmin_workout_id"),
        "status": row.get("status"),
    })


# ---------------------------------------------------------------------------
# Ablauf
# ---------------------------------------------------------------------------

async def _mark(db, user_id: str, client_ref: str, patch: dict) -> None:
    await db.update(TABLE, {"user_id": user_id, "client_ref": client_ref}, patch)


# Eigene Erlaubnisliste für `data_providers.last_error_code` (v8-330).
# BEFUND einer Mutationsprobe: `_safe_code` wurde ausschliesslich mit
# KONSTANTEN aufgerufen und filterte damit nichts — die einzige Stelle mit
# FREMDDATEN (`getattr(e, "code", ...)` aus einer Garmin-AuthError) ging
# ungefiltert an `_set_reauth` und landete so in der Datenbank. Eine
# Fremd-Exception kann in `code` beliebigen Text tragen, einschliesslich
# Token-Resten oder Adressen. Die Codes hier sind GROSS geschrieben, weil
# `data_providers` diese Schreibweise fuehrt — sie sind bewusst nicht mit
# SAFE_ERROR_CODES (klein, fuer `last_error`) zusammengelegt.
SAFE_REAUTH_CODES = {
    "TOKENS_MISSING", "TOKEN_DECRYPT_FAILED", "AUTH_FAILED", "UNKNOWN",
}


def _safe_reauth_code(code: Any) -> str:
    c = str(code or "").strip().upper()
    return c if c in SAFE_REAUTH_CODES else "UNKNOWN"


async def _set_reauth(db, user_id: str, code: str) -> None:
    # Die Bereinigung sitzt HIER und nicht bei den Aufrufern: so kann kein
    # spaeterer Aufrufer sie versehentlich umgehen.
    safe = _safe_reauth_code(code)
    try:
        await db.update(
            "data_providers",
            {"user_id": user_id, "provider_type": PROVIDER_TYPE},
            {"connection_status": "reauth_required",
             "reauthentication_required": True,
             "last_error_code": safe},
        )
    except Exception:
        logger.warning("Reauth-Status konnte nicht gesetzt werden (user=%s)", user_id)


async def push_strength_workout(
    *, user_id: str, body: dict, db, crypto, settings, provider_factory,
) -> PushResult:
    """Der vollstaendige Vorgang. `user_id` MUSS aus dem verifizierten JWT kommen."""

    client_ref = body.get("clientRef")
    device_test_requested = bool(body.get("deviceTest"))
    server_allows_test = bool(getattr(settings, "strength_push_device_test", False))
    device_test = device_test_requested and server_allows_test

    # Ein Client-Flag allein schaltet nichts frei — und das wird BENANNT,
    # statt still in den Regelbetrieb zu fallen.
    if device_test_requested and not server_allows_test:
        return PushResult(422, {"ok": False, "code": "invalid_workout",
                                "details": ["deviceTest: serverseitig nicht freigeschaltet"]})

    details = validate_push_request(
        workout=body.get("workout"), step_bindings=body.get("stepBindings"),
        client_ref=client_ref, occurrence_id=body.get("occurrenceId"),
        payload_version=body.get("payloadVersion"), mapping_version=body.get("mappingVersion"),
        payload_hash=body.get("payloadHash"), device_test=device_test,
    )
    if details:
        return PushResult(422, {"ok": False, "code": "invalid_workout", "details": details})

    payload_hash = body["payloadHash"]

    # --- 1) Bestehenden Export suchen -------------------------------------
    rows = await db.select(TABLE, {"user_id": user_id, "client_ref": client_ref})
    row = rows[0] if rows else None

    if row is None:
        # --- 2) Entwurfszeile anlegen. Der Unique-Index (user_id, client_ref)
        # aus Migration 0035 ist der eigentliche Schutz gegen gleichzeitige
        # Doppelrequests: der zweite Insert scheitert mit 409, und wir lesen
        # dann den Stand des ersten. Ein SELECT davor allein waere ein Rennen.
        draft = {
            "user_id": user_id,
            "occurrence_id": body.get("occurrenceId"),
            "client_ref": client_ref,
            "mapping_version": body.get("mappingVersion"),
            "payload_version": body.get("payloadVersion"),
            "payload_hash": payload_hash,
            "step_bindings": body.get("stepBindings"),
            "status": "draft",
        }
        try:
            await db.insert(TABLE, [draft])
        except Exception as e:
            if getattr(e, "status_code", None) != 409:
                logger.error("Export-Entwurf konnte nicht angelegt werden (user=%s)", user_id)
                raise
            rows = await db.select(TABLE, {"user_id": user_id, "client_ref": client_ref})
            row = rows[0] if rows else None
            if row is None:
                return PushResult(502, {"ok": False, "code": "garmin_unavailable",
                                        "detail": "export_row_unavailable"})

    if row is not None:
        # --- 3) Konflikt oder Wiederholung? --------------------------------
        if row.get("payload_hash") != payload_hash:
            # Der Plan hat sich seit dem Push geaendert. NIEMALS still ersetzen.
            return _conflict("client_ref_conflict", row)
        if row.get("status") in ("pushed", "scheduled") and row.get("garmin_workout_id"):
            return _conflict("already_pushed", row)
        # draft/failed mit gleichem Hash -> erneuter Versuch ist zulaessig.

    # --- 4) Token laden. Kein Passwort-Fallback. --------------------------
    creds = await db.select("provider_credentials", {
        "user_id": user_id, "provider_type": PROVIDER_TYPE,
        "credential_kind": "session_tokens",
    })
    if not creds:
        await _mark(db, user_id, client_ref, {"status": "failed", "last_error": "tokens_missing"})
        await _set_reauth(db, user_id, "TOKENS_MISSING")
        return PushResult(401, {"ok": False, "code": "reauthentication_required"})

    try:
        token_str = crypto.decrypt_str(creds[0]["encrypted_payload"], creds[0].get("key_version", 1))
        provider = provider_factory(token_str)
    except AuthError:
        await _mark(db, user_id, client_ref, {"status": "failed", "last_error": "auth_failed"})
        await _set_reauth(db, user_id, "AUTH_FAILED")
        return PushResult(401, {"ok": False, "code": "reauthentication_required"})
    except Exception:
        # Kein Klartext der Ausnahme in die Datenbank — nur der feste Code.
        logger.error("Token konnte nicht verwendet werden (user=%s)", user_id)
        await _mark(db, user_id, client_ref, {"status": "failed", "last_error": "token_decrypt_failed"})
        await _set_reauth(db, user_id, "TOKEN_DECRYPT_FAILED")
        return PushResult(401, {"ok": False, "code": "reauthentication_required"})

    # --- 5) Uebertragen ---------------------------------------------------
    if not hasattr(provider, "upload_strength_workout"):
        await _mark(db, user_id, client_ref, {"status": "failed", "last_error": "provider_unavailable"})
        return PushResult(502, {"ok": False, "code": "garmin_unavailable",
                                "detail": "provider_without_workout_support"})
    try:
        workout_id = provider.upload_strength_workout(body["workout"])
    except AuthError as e:
        await _mark(db, user_id, client_ref, {"status": "failed", "last_error": _safe_code("auth_failed")})
        await _set_reauth(db, user_id, getattr(e, "code", "AUTH_FAILED"))
        return PushResult(401, {"ok": False, "code": "reauthentication_required"})
    except RateLimited:
        await _mark(db, user_id, client_ref, {"status": "failed", "last_error": "rate_limited"})
        return PushResult(502, {"ok": False, "code": "garmin_unavailable", "retryAfter": 300})
    except ProviderError:
        await _mark(db, user_id, client_ref, {"status": "failed", "last_error": "provider_unavailable"})
        return PushResult(502, {"ok": False, "code": "garmin_unavailable"})
    except Exception:
        # Auch ein Timeout oder ein unerwarteter Fehler darf nichts durchlassen
        # und nichts Fremdes speichern.
        logger.error("Workout-Push fehlgeschlagen (user=%s)", user_id)
        await _mark(db, user_id, client_ref, {"status": "failed", "last_error": "provider_unavailable"})
        return PushResult(502, {"ok": False, "code": "garmin_unavailable"})

    # --- 6) Nur eine belastbare ID gilt als Erfolg ------------------------
    if not workout_id:
        await _mark(db, user_id, client_ref, {"status": "failed", "last_error": "garmin_no_workout_id"})
        return PushResult(502, {"ok": False, "code": "garmin_unavailable",
                                "detail": "no_workout_id"})

    await _mark(db, user_id, client_ref, {
        "status": "pushed", "garmin_workout_id": str(workout_id), "last_error": None,
    })
    logger.info("Kraft-Workout uebertragen (user=%s, clientRef=%s)", user_id, client_ref)
    return _ok(str(workout_id), "pushed")
