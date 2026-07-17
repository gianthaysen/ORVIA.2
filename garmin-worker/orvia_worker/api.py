"""FastAPI-Endpunkte des Workers.

Jeder geschützte Endpunkt verifiziert das Supabase-JWT des Nutzers gegen
/auth/v1/user — client-gelieferte user_ids werden NIE verwendet.
Keine Stacktraces, Secrets, Tokens oder Roh-Payloads in Responses/Logs.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .providers.base import AuthError, MfaRequired, ProviderError, RateLimited
from .sync import PROVIDER_TYPE, sync_user

logger = logging.getLogger("orvia.api")

MFA_PENDING_TTL_SECONDS = 10 * 60


class ConnectBody(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)
    mfa_code: Optional[str] = None


class MfaBody(BaseModel):
    mfa_code: str = Field(min_length=1)


class TokenImportBody(BaseModel):
    # garminconnect erkennt Token-Strings an >512 Zeichen (client.dumps()-Format).
    token_data: str = Field(min_length=512)


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={
        "ok": False, "code": code, "message": message,
    })


def create_app(*, settings, db, crypto, provider_factory, registry=None) -> FastAPI:
    """App-Fabrik. provider_factory() -> frischer HealthDataProvider (unauth.),
    provider_factory(token_str) -> eingeloggter Provider (für sync_user)."""

    app = FastAPI(title="ORVIA Garmin Worker", docs_url=None, redoc_url=None)
    app.state.settings = settings
    app.state.db = db
    app.state.crypto = crypto
    app.state.provider_factory = provider_factory
    # MFA-Zwischenzustand im Prozess (primärer Pfad); DB-mfa_state ist der
    # Fallback für Prozess-Neustarts.
    app.state.pending_mfa: dict[str, tuple[Any, float]] = {}

    if settings.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.allowed_origins),
            allow_methods=["GET", "POST", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
        )

    async def current_user_id(
        authorization: str = Header(default=""),
    ) -> str:
        token = ""
        if authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Nicht angemeldet")
        user_id = await db.verify_supabase_jwt(token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Sitzung ungültig")
        return user_id

    # -- interne Helfer -------------------------------------------------------

    async def _set_provider_status(user_id: str, patch: dict) -> None:
        await db.upsert("data_providers", [{
            "user_id": user_id,
            "provider_type": PROVIDER_TYPE,
            **patch,
        }])

    async def _store_credential(user_id: str, kind: str, plaintext: str) -> None:
        ciphertext, key_version = crypto.encrypt_str(plaintext)
        await db.upsert("provider_credentials", [{
            "user_id": user_id,
            "provider_type": PROVIDER_TYPE,
            "credential_kind": kind,
            "encrypted_payload": ciphertext,
            "key_version": key_version,
        }])

    async def _delete_credential(user_id: str, kind: str) -> None:
        try:
            await db.delete("provider_credentials", {
                "user_id": user_id,
                "provider_type": PROVIDER_TYPE,
                "credential_kind": kind,
            })
        except Exception:
            logger.warning("Credential-Löschung fehlgeschlagen (kind=%s)", kind)

    async def _run_sync(user_id: str) -> None:
        try:
            await sync_user(
                user_id,
                db=db,
                crypto=crypto,
                settings=settings,
                provider_factory=provider_factory,
            )
        except Exception:
            # Kein Payload-Logging; sync_user pflegt den DB-Status selbst.
            logger.exception("Hintergrund-Sync fehlgeschlagen (user=%s)", user_id)

    async def _finish_connect(
        user_id: str, tokens: str, background: BackgroundTasks
    ) -> JSONResponse:
        await _store_credential(user_id, "session_tokens", tokens)
        await _delete_credential(user_id, "mfa_state")
        app.state.pending_mfa.pop(user_id, None)
        await _set_provider_status(user_id, {
            "connection_status": "connected",
            "reauthentication_required": False,
            "last_error_code": None,
        })
        background.add_task(_run_sync, user_id)
        return JSONResponse({"ok": True, "connectionStatus": "connected",
                             "syncQueued": True})

    def _provider_error_response(e: ProviderError) -> JSONResponse:
        if isinstance(e, AuthError):
            return _err(400, e.code, "Garmin-Anmeldung fehlgeschlagen. "
                                     "Bitte E-Mail und Passwort prüfen.")
        if isinstance(e, RateLimited):
            return _err(429, e.code, "Garmin begrenzt derzeit Anfragen. "
                                     "Bitte später erneut versuchen.")
        return _err(502, e.code, "Garmin ist derzeit nicht erreichbar.")

    # -- Endpunkte ------------------------------------------------------------

    @app.get("/healthz")
    async def healthz() -> dict:
        return {"ok": True}

    @app.get("/status")
    async def status(user_id: str = Depends(current_user_id)) -> dict:
        rows = await db.select(
            "data_providers", {"user_id": user_id, "provider_type": PROVIDER_TYPE}
        )
        if not rows:
            return {"ok": True, "connectionStatus": "not_connected"}
        r = rows[0]
        return {
            "ok": True,
            "connectionStatus": r.get("connection_status"),
            "lastSyncAt": r.get("last_sync_at"),
            "lastSuccessfulSyncAt": r.get("last_successful_sync_at"),
            "lastErrorCode": r.get("last_error_code"),
            "reauthenticationRequired": bool(r.get("reauthentication_required")),
        }

    @app.post("/connect")
    async def connect(
        body: ConnectBody,
        background: BackgroundTasks,
        user_id: str = Depends(current_user_id),
    ):
        await _set_provider_status(user_id, {"connection_status": "connecting"})
        provider = provider_factory()
        try:
            tokens = await asyncio.to_thread(
                provider.connect, body.email, body.password, body.mfa_code
            )
        except MfaRequired as e:
            # Live-Instanz für gleichen Prozess behalten …
            app.state.pending_mfa[user_id] = (provider, time.monotonic())
            # … und serialisierten Zustand verschlüsselt für Neustarts ablegen.
            try:
                await _store_credential(
                    user_id, "mfa_state", json.dumps(e.client_state)
                )
            except Exception:
                logger.warning("mfa_state konnte nicht gespeichert werden")
            await _set_provider_status(user_id, {"connection_status": "mfa_required"})
            return JSONResponse(status_code=409, content={
                "ok": False, "mfaRequired": True, "code": "MFA_REQUIRED",
                "message": "Bitte den Garmin-Bestätigungscode eingeben.",
            })
        except ProviderError as e:
            await _set_provider_status(user_id, {
                "connection_status": "error", "last_error_code": e.code,
            })
            return _provider_error_response(e)
        # Passwort ist hier bereits verworfen (nur transient im Request).
        return await _finish_connect(user_id, tokens, background)

    @app.post("/connect/mfa")
    async def connect_mfa(
        body: MfaBody,
        background: BackgroundTasks,
        user_id: str = Depends(current_user_id),
    ):
        provider = provider_factory()
        pending = app.state.pending_mfa.get(user_id)
        try:
            if pending and (time.monotonic() - pending[1]) < MFA_PENDING_TTL_SECONDS:
                # Primärer Pfad: Live-Instanz aus demselben Prozess.
                live_provider = pending[0]
                tokens = await asyncio.to_thread(
                    live_provider.resume_pending, body.mfa_code
                )
            else:
                # Prozess wurde neu gestartet: mfa_state aus DB rekonstruieren.
                rows = await db.select("provider_credentials", {
                    "user_id": user_id,
                    "provider_type": PROVIDER_TYPE,
                    "credential_kind": "mfa_state",
                })
                if not rows:
                    return _err(410, "MFA_STATE_EXPIRED",
                                "Die MFA-Sitzung ist abgelaufen. "
                                "Bitte Verbindung neu starten.")
                state = json.loads(crypto.decrypt_str(
                    rows[0]["encrypted_payload"], rows[0].get("key_version", 1)
                ))
                tokens = await asyncio.to_thread(
                    provider.resume_mfa, state, body.mfa_code
                )
        except ProviderError as e:
            await _set_provider_status(user_id, {
                "connection_status": "error", "last_error_code": e.code,
            })
            return _provider_error_response(e)
        return await _finish_connect(user_id, tokens, background)

    @app.post("/connect/token-import")
    async def connect_token_import(
        body: TokenImportBody,
        background: BackgroundTasks,
        user_id: str = Depends(current_user_id),
    ):
        """Import eines lokal (Residential-IP) erzeugten Session-Tokens.

        Umgeht den Passwort-Login über die Cloud-IP (Garmin/Cloudflare blockt
        Rechenzentrums-IPs beim SSO-Login mit 429). Token-basierte API-Calls
        sind davon nicht betroffen. Das Token wird vor dem Speichern mit einem
        leichten API-Abruf validiert.
        """
        await _set_provider_status(user_id, {"connection_status": "connecting"})
        provider = provider_factory()
        try:
            await asyncio.to_thread(provider.login_with_tokens, body.token_data)
            # Leichte Validierung: ein echter, günstiger API-Abruf. Schlägt er
            # fehl, wird kein unbrauchbares Token gespeichert.
            await asyncio.to_thread(provider.get_devices)
        except ProviderError as e:
            await _set_provider_status(user_id, {
                "connection_status": "error", "last_error_code": e.code,
            })
            if isinstance(e, AuthError):
                return _err(400, "TOKEN_INVALID",
                            "Das importierte Garmin-Token ist ungültig oder "
                            "abgelaufen. Bitte lokal neu einloggen.")
            return _provider_error_response(e)
        return await _finish_connect(user_id, body.token_data, background)

    @app.post("/sync")
    async def manual_sync(
        background: BackgroundTasks,
        user_id: str = Depends(current_user_id),
    ):
        rows = await db.select(
            "data_providers", {"user_id": user_id, "provider_type": PROVIDER_TYPE}
        )
        if not rows or rows[0].get("connection_status") != "connected":
            return _err(409, "NOT_CONNECTED", "Garmin ist nicht verbunden.")
        background.add_task(_run_sync, user_id)
        return JSONResponse(status_code=202, content={"ok": True, "queued": True})

    @app.delete("/connection")
    async def disconnect(user_id: str = Depends(current_user_id)) -> dict:
        # Tokens + MFA-Zustand löschen; user_metrics bleiben (Nutzerdaten).
        await _delete_credential(user_id, "session_tokens")
        await _delete_credential(user_id, "mfa_state")
        app.state.pending_mfa.pop(user_id, None)
        await _set_provider_status(user_id, {
            "connection_status": "disconnected",
            "reauthentication_required": False,
            "last_error_code": None,
        })
        return {"ok": True, "connectionStatus": "disconnected"}

    return app
