"""Scheduler: synct verbundene Nutzer, Backoff pro Nutzer bei Fehlern."""

import asyncio

import orvia_worker.scheduler as scheduler_mod
from orvia_worker.scheduler import SyncScheduler

USER_OK = "00000000-0000-0000-0000-0000000000aa"
USER_BAD = "00000000-0000-0000-0000-0000000000bb"


def _make(fake_db, test_crypto, test_settings):
    return SyncScheduler(
        db=fake_db,
        crypto=test_crypto,
        settings=test_settings,
        provider_factory=lambda token=None: None,
    )


def test_run_once_syncs_only_connected_users(
    fake_db, test_crypto, test_settings, monkeypatch
):
    fake_db.tables["data_providers"] = [
        {"user_id": USER_OK, "provider_type": "garmin_unofficial",
         "connection_status": "connected"},
        {"user_id": USER_BAD, "provider_type": "garmin_unofficial",
         "connection_status": "disconnected"},
    ]
    synced = []

    async def fake_sync(user_id, **kwargs):
        synced.append(user_id)
        return {"ok": True}

    monkeypatch.setattr(scheduler_mod, "sync_user", fake_sync)
    s = _make(fake_db, test_crypto, test_settings)
    asyncio.run(s.run_once())
    assert synced == [USER_OK]


def test_failure_registers_backoff_and_skips(
    fake_db, test_crypto, test_settings, monkeypatch
):
    fake_db.tables["data_providers"] = [
        {"user_id": USER_BAD, "provider_type": "garmin_unofficial",
         "connection_status": "connected"},
    ]
    calls = []

    async def failing_sync(user_id, **kwargs):
        calls.append(user_id)
        return {"ok": False, "errors": ["x"]}

    monkeypatch.setattr(scheduler_mod, "sync_user", failing_sync)
    s = _make(fake_db, test_crypto, test_settings)
    asyncio.run(s.run_once())
    assert calls == [USER_BAD]
    assert s._failures[USER_BAD] == 1
    # Backoff aktiv: zweiter Durchlauf überspringt den Nutzer
    asyncio.run(s.run_once())
    assert calls == [USER_BAD]


def test_success_clears_backoff(fake_db, test_crypto, test_settings, monkeypatch):
    fake_db.tables["data_providers"] = [
        {"user_id": USER_OK, "provider_type": "garmin_unofficial",
         "connection_status": "connected"},
    ]

    async def ok_sync(user_id, **kwargs):
        return {"ok": True}

    monkeypatch.setattr(scheduler_mod, "sync_user", ok_sync)
    s = _make(fake_db, test_crypto, test_settings)
    s._failures[USER_OK] = 3
    s._next_allowed[USER_OK] = 0  # Backoff abgelaufen
    asyncio.run(s.run_once())
    assert USER_OK not in s._failures
    assert USER_OK not in s._next_allowed
