"""POST /connect/token-import — lokal erzeugtes Token importieren.

Deckt ab: Erfolg (Token validiert, verschlüsselt gespeichert, Sync gequeued),
ungültiges Token (kein Speichern), Provider nicht erreichbar, zu kurzes Token.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from orvia_worker.api import create_app
from orvia_worker.providers.base import AuthError, ProviderUnavailable

USER = "00000000-0000-0000-0000-000000000001"
VALID_TOKEN = "x" * 600  # >512 Zeichen wie client.dumps()


class FakeProvider:
    """Nur die für token-import relevanten Methoden."""

    def __init__(self, *, login_error=None, devices_error=None):
        self._login_error = login_error
        self._devices_error = devices_error
        self.logged_in_with: str | None = None
        self.devices_called = False

    def login_with_tokens(self, token_str: str) -> None:
        if self._login_error:
            raise self._login_error
        self.logged_in_with = token_str

    def get_devices(self):
        self.devices_called = True
        if self._devices_error:
            raise self._devices_error
        return []


@pytest.fixture
def make_client(fake_db, test_crypto, test_settings):
    fake_db.jwt_map["good-jwt"] = USER

    def _make(provider: FakeProvider):
        def provider_factory(*args, **kwargs):
            return provider

        app = create_app(
            settings=test_settings,
            db=fake_db,
            crypto=test_crypto,
            provider_factory=provider_factory,
        )
        return TestClient(app)

    return _make


AUTH = {"Authorization": "Bearer good-jwt"}


def test_success_stores_encrypted_token_and_queues_sync(make_client, fake_db, test_crypto):
    provider = FakeProvider()
    client = make_client(provider)
    r = client.post("/connect/token-import",
                    json={"token_data": VALID_TOKEN}, headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["connectionStatus"] == "connected"
    assert body["syncQueued"] is True
    # Provider wurde mit exakt dem Token eingeloggt und validiert.
    assert provider.logged_in_with == VALID_TOKEN
    assert provider.devices_called is True
    # Token liegt verschlüsselt (nie im Klartext) in provider_credentials.
    creds = fake_db.tables.get("provider_credentials", [])
    stored = [c for c in creds if c["credential_kind"] == "session_tokens"]
    assert len(stored) == 1
    assert stored[0]["encrypted_payload"] != VALID_TOKEN
    assert test_crypto.decrypt_str(
        stored[0]["encrypted_payload"], stored[0]["key_version"]
    ) == VALID_TOKEN
    # Provider-Status ist connected.
    dp = fake_db.tables["data_providers"][0]
    assert dp["connection_status"] == "connected"


def test_invalid_token_is_400_and_not_stored(make_client, fake_db):
    provider = FakeProvider(login_error=AuthError("ungültig"))
    client = make_client(provider)
    r = client.post("/connect/token-import",
                    json={"token_data": VALID_TOKEN}, headers=AUTH)
    assert r.status_code == 400
    assert r.json()["code"] == "TOKEN_INVALID"
    creds = fake_db.tables.get("provider_credentials", [])
    assert not [c for c in creds if c["credential_kind"] == "session_tokens"]
    assert fake_db.tables["data_providers"][0]["connection_status"] == "error"


def test_validation_failure_is_400_and_not_stored(make_client, fake_db):
    """Login lädt Token lokal, aber der Validierungs-Abruf scheitert an Auth."""
    provider = FakeProvider(devices_error=AuthError("Session ungültig"))
    client = make_client(provider)
    r = client.post("/connect/token-import",
                    json={"token_data": VALID_TOKEN}, headers=AUTH)
    assert r.status_code == 400
    assert r.json()["code"] == "TOKEN_INVALID"
    creds = fake_db.tables.get("provider_credentials", [])
    assert not [c for c in creds if c["credential_kind"] == "session_tokens"]


def test_provider_unavailable_is_502(make_client, fake_db):
    provider = FakeProvider(devices_error=ProviderUnavailable("down"))
    client = make_client(provider)
    r = client.post("/connect/token-import",
                    json={"token_data": VALID_TOKEN}, headers=AUTH)
    assert r.status_code == 502
    creds = fake_db.tables.get("provider_credentials", [])
    assert not [c for c in creds if c["credential_kind"] == "session_tokens"]


def test_short_token_is_422(make_client):
    client = make_client(FakeProvider())
    r = client.post("/connect/token-import",
                    json={"token_data": "zu-kurz"}, headers=AUTH)
    assert r.status_code == 422


def test_response_contains_no_token(make_client):
    provider = FakeProvider()
    client = make_client(provider)
    r = client.post("/connect/token-import",
                    json={"token_data": VALID_TOKEN}, headers=AUTH)
    assert VALID_TOKEN not in r.text
