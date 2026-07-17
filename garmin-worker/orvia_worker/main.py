"""App-Assembly: Settings (fail-fast beim Boot) + API + Scheduler-Lifespan.

Start: uvicorn orvia_worker.main:app
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from .api import create_app
from .config import get_settings
from .crypto import TokenCrypto
from .db import SupabaseDb
from .providers.garmin_unofficial import GarminUnofficialProvider
from .scheduler import SyncScheduler


def _provider_factory(token_str: str | None = None) -> GarminUnofficialProvider:
    provider = GarminUnofficialProvider()
    if token_str:
        provider.login_with_tokens(token_str)
    return provider


def build_app():
    settings = get_settings()  # fail-fast bei fehlenden Pflicht-Vars
    logging.basicConfig(
        level=getattr(logging, settings.log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    db = SupabaseDb(settings)
    crypto = TokenCrypto.from_settings(settings)
    scheduler = SyncScheduler(
        db=db, crypto=crypto, settings=settings, provider_factory=_provider_factory
    )

    @asynccontextmanager
    async def lifespan(app):
        task = asyncio.create_task(scheduler.run_forever())
        try:
            yield
        finally:
            scheduler.stop()
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
            await db.aclose()

    app = create_app(
        settings=settings,
        db=db,
        crypto=crypto,
        provider_factory=_provider_factory,
    )
    app.router.lifespan_context = lifespan
    return app


app = build_app()
