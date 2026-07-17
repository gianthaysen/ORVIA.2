"""Intervall-Scheduler: synct alle verbundenen Nutzer (Design §6).

Läuft als Lifespan-Task der FastAPI-App. Fehler-Backoff pro Nutzer:
nach n Fehlschlägen in Folge wird der Nutzer erst nach
interval * 2^n (gedeckelt bei 8x) wieder versucht.
"""

from __future__ import annotations

import asyncio
import logging
import time

from .sync import PROVIDER_TYPE, sync_user

logger = logging.getLogger("orvia.scheduler")

BACKOFF_CAP_FACTOR = 8


class SyncScheduler:
    def __init__(self, *, db, crypto, settings, provider_factory) -> None:
        self._db = db
        self._crypto = crypto
        self._settings = settings
        self._provider_factory = provider_factory
        self._failures: dict[str, int] = {}
        self._next_allowed: dict[str, float] = {}
        self._stopped = asyncio.Event()

    def stop(self) -> None:
        self._stopped.set()

    async def run_forever(self) -> None:
        interval = max(60, self._settings.sync_interval_minutes * 60)
        logger.info("Scheduler gestartet (Intervall %ss)", interval)
        while not self._stopped.is_set():
            try:
                await self.run_once()
            except Exception:
                logger.exception("Scheduler-Durchlauf fehlgeschlagen")
            try:
                await asyncio.wait_for(self._stopped.wait(), timeout=interval)
            except asyncio.TimeoutError:
                continue

    async def run_once(self) -> None:
        rows = await self._db.select(
            "data_providers",
            {"provider_type": PROVIDER_TYPE, "connection_status": "connected"},
            columns="user_id",
        )
        now = time.monotonic()
        for row in rows:
            user_id = row.get("user_id")
            if not user_id:
                continue
            if self._next_allowed.get(user_id, 0) > now:
                continue  # Backoff aktiv
            try:
                result = await sync_user(
                    user_id,
                    db=self._db,
                    crypto=self._crypto,
                    settings=self._settings,
                    provider_factory=self._provider_factory,
                )
                if result.get("ok"):
                    self._failures.pop(user_id, None)
                    self._next_allowed.pop(user_id, None)
                else:
                    self._register_failure(user_id)
            except Exception:
                logger.exception("Sync fehlgeschlagen (user=%s)", user_id)
                self._register_failure(user_id)

    def _register_failure(self, user_id: str) -> None:
        n = self._failures.get(user_id, 0) + 1
        self._failures[user_id] = n
        interval = max(60, self._settings.sync_interval_minutes * 60)
        factor = min(2 ** n, BACKOFF_CAP_FACTOR)
        self._next_allowed[user_id] = time.monotonic() + interval * factor
        logger.warning("Backoff für user=%s: Faktor %s (Fehler in Folge: %s)",
                       user_id, factor, n)
