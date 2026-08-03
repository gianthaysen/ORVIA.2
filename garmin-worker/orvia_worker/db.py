"""PostgREST-Client (Supabase) via httpx — service_role, server-only.

Die on_conflict-Strings sind der VERTRAG mit Migration
0019_provider_metrics_foundation.sql (Unique-Indizes). Nicht ohne Migration
ändern; tests/test_sync_contract.py vergleicht sie gegen die SQL-Datei.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

logger = logging.getLogger("orvia.db")


def _strict_json_bytes(rows: list[dict], *, context: str) -> bytes:
    """Serialisiert mit allow_nan=False.

    Pythons json.dumps lässt NaN/Infinity standardmäßig als (ungültige)
    JSON-Literale durch; PostgREST lehnt das für den GESAMTEN Batch mit
    HTTP 400 ab, ohne dass wir Payloads loggen dürfen um die Ursache zu
    sehen. Mit allow_nan=False scheitert es hier stattdessen laut, mit
    Feldname + Zeilenindex (kein Wert, keine Nutzerdaten) im Log — sollte
    durch normalize.py._num()/_json_safe() ohnehin nie mehr auftreten,
    das hier ist die zweite Verteidigungslinie.
    """
    try:
        return json.dumps(rows, allow_nan=False).encode("utf-8")
    except ValueError:
        bad_field = None
        bad_index = None
        for i, row in enumerate(rows):
            if isinstance(row, dict):
                for k, v in row.items():
                    if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
                        bad_field, bad_index = k, i
                        break
            if bad_field:
                break
        logger.error(
            "%s: nicht-endlicher Zahlenwert (NaN/Infinity) in Zeile %s, Feld %r "
            "— Batch abgebrochen statt an PostgREST gesendet.",
            context, bad_index, bad_field,
        )
        raise DbError(
            f"{context}: nicht-endlicher Wert in Feld {bad_field!r} (Zeile {bad_index})"
        ) from None

# Exakt die Uniques aus 0019 (Kommentarblock Kopf der Migration).
ON_CONFLICT: dict[str, str] = {
    "data_providers": "user_id,provider_type",
    "provider_credentials": "user_id,provider_type,credential_kind",
    "connected_devices": "user_id,provider_id,provider_device_id",
    "device_capabilities": "device_id,metric_type",
    "user_metrics": "user_id,metric_type,source_record_id",
    "profile_metric_settings": "user_id,metric_type",
    "daily_energy_expenditure": "user_id,metric_date",
    # GM7.4: Tages-Zeitreihen (Migration 0028). Eine Serie je Nutzer+Metrik+Tag.
    "user_metric_series": "user_id,metric_type,metric_date",
}


class DbError(RuntimeError):
    """Supabase/PostgREST-Fehler ohne sensible Payloads."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _filters_to_params(filters: dict[str, Any] | None) -> dict[str, str]:
    """Filter-Dict -> PostgREST-Query. Wert = eq, ("op", wert) = anderer Operator."""
    params: dict[str, str] = {}
    for field, value in (filters or {}).items():
        if isinstance(value, tuple) and len(value) == 2:
            op, v = value
            params[field] = f"{op}.{v}"
        elif value is None:
            params[field] = "is.null"
        else:
            params[field] = f"eq.{value}"
    return params


class SupabaseDb:
    """Dünner asynchroner PostgREST-Wrapper. Kein Logging von Row-Inhalten."""

    def __init__(self, settings, client: httpx.AsyncClient | None = None) -> None:
        self._base = settings.supabase_url
        self._key = settings.supabase_service_role_key
        self._client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            headers={
                "apikey": self._key,
                "Authorization": f"Bearer {self._key}",
            },
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    def _url(self, table: str) -> str:
        return f"{self._base}/rest/v1/{table}"

    @staticmethod
    def _raise_for_status(resp: httpx.Response, context: str) -> None:
        if resp.status_code >= 400:
            logger.error("PostgREST %s fehlgeschlagen: HTTP %s", context, resp.status_code)
            raise DbError(f"{context}: HTTP {resp.status_code}", resp.status_code)

    async def select(
        self,
        table: str,
        filters: dict[str, Any] | None = None,
        columns: str = "*",
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict]:
        params: dict[str, str] = {"select": columns}
        params.update(_filters_to_params(filters))
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)
        resp = await self._client.get(self._url(table), params=params)
        self._raise_for_status(resp, f"select {table}")
        return resp.json()

    async def upsert(
        self,
        table: str,
        rows: list[dict],
        on_conflict: str | None = None,
        returning: bool = False,
    ) -> list[dict]:
        """Idempotenter Upsert über die 0019-Uniques (merge-duplicates)."""
        if not rows:
            return []
        conflict = on_conflict or ON_CONFLICT.get(table)
        if not conflict:
            raise DbError(f"Kein on_conflict-Vertrag für Tabelle {table}")
        prefer = "resolution=merge-duplicates," + (
            "return=representation" if returning else "return=minimal"
        )
        body = _strict_json_bytes(rows, context=f"upsert {table}")
        resp = await self._client.post(
            self._url(table),
            params={"on_conflict": conflict},
            headers={"Prefer": prefer, "Content-Type": "application/json"},
            content=body,
        )
        self._raise_for_status(resp, f"upsert {table}")
        return resp.json() if returning else []

    async def insert(self, table: str, rows: list[dict], returning: bool = False) -> list[dict]:
        if not rows:
            return []
        prefer = "return=representation" if returning else "return=minimal"
        body = _strict_json_bytes(rows, context=f"insert {table}")
        resp = await self._client.post(
            self._url(table),
            headers={"Prefer": prefer, "Content-Type": "application/json"},
            content=body,
        )
        self._raise_for_status(resp, f"insert {table}")
        return resp.json() if returning else []

    async def update(self, table: str, filters: dict[str, Any], patch: dict) -> None:
        resp = await self._client.patch(
            self._url(table),
            params=_filters_to_params(filters),
            headers={"Prefer": "return=minimal"},
            json=patch,
        )
        self._raise_for_status(resp, f"update {table}")

    async def delete(self, table: str, filters: dict[str, Any]) -> None:
        if not filters:
            raise DbError(f"delete {table} ohne Filter verweigert")
        resp = await self._client.delete(
            self._url(table), params=_filters_to_params(filters)
        )
        self._raise_for_status(resp, f"delete {table}")

    async def verify_supabase_jwt(self, user_jwt: str) -> str | None:
        """Verifiziert ein Nutzer-JWT gegen GoTrue; Rückgabe user_id oder None.

        Niemals client-gelieferten user_ids vertrauen — nur diesem Ergebnis.
        """
        if not user_jwt:
            return None
        try:
            resp = await self._client.get(
                f"{self._base}/auth/v1/user",
                headers={
                    "apikey": self._key,
                    "Authorization": f"Bearer {user_jwt}",
                },
            )
        except httpx.HTTPError:
            logger.error("JWT-Verifikation: Auth-Endpoint nicht erreichbar")
            return None
        if resp.status_code != 200:
            return None
        body = resp.json()
        user_id = body.get("id")
        return user_id if isinstance(user_id, str) and user_id else None
