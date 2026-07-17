"""API-Auth: geschützte Endpunkte ohne/mit ungültigem JWT -> 401 (mocked verify)."""

import pytest
from fastapi.testclient import TestClient

from orvia_worker.api import create_app

USER = "00000000-0000-0000-0000-000000000001"

PROTECTED = [
    ("GET", "/status", None),
    ("POST", "/connect", {"email": "a@b.c", "password": "x"}),
    ("POST", "/connect/mfa", {"mfa_code": "123456"}),
    ("POST", "/connect/token-import", {"token_data": "t" * 600}),
    ("POST", "/sync", None),
    ("DELETE", "/connection", None),
]


@pytest.fixture
def client(fake_db, test_crypto, test_settings):
    fake_db.jwt_map["good-jwt"] = USER

    def provider_factory(*args, **kwargs):  # darf in Auth-Tests nie Garmin bauen
        class _NeverConnects:
            def connect(self, *a, **k):
                raise AssertionError("Provider darf ohne Auth nicht erreicht werden")

        return _NeverConnects()

    app = create_app(
        settings=test_settings,
        db=fake_db,
        crypto=test_crypto,
        provider_factory=provider_factory,
    )
    return TestClient(app)


def _request(client, method, path, body, headers=None):
    return client.request(method, path, json=body, headers=headers or {})


def test_healthz_needs_no_auth(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


@pytest.mark.parametrize("method,path,body", PROTECTED)
def test_missing_token_is_401(client, method, path, body):
    r = _request(client, method, path, body)
    assert r.status_code == 401


@pytest.mark.parametrize("method,path,body", PROTECTED)
def test_invalid_token_is_401(client, method, path, body):
    r = _request(client, method, path, body,
                 headers={"Authorization": "Bearer bad-jwt"})
    assert r.status_code == 401


@pytest.mark.parametrize("method,path,body", PROTECTED)
def test_wrong_scheme_is_401(client, method, path, body):
    r = _request(client, method, path, body,
                 headers={"Authorization": "Basic good-jwt"})
    assert r.status_code == 401


def test_valid_token_reaches_status(client):
    r = client.get("/status", headers={"Authorization": "Bearer good-jwt"})
    assert r.status_code == 200
    assert r.json() == {"ok": True, "connectionStatus": "not_connected"}


def test_valid_token_sync_without_connection_is_409(client):
    r = client.post("/sync", headers={"Authorization": "Bearer good-jwt"})
    assert r.status_code == 409
    assert r.json()["code"] == "NOT_CONNECTED"


def test_error_responses_contain_no_stacktrace(client):
    r = client.get("/status", headers={"Authorization": "Bearer bad-jwt"})
    text = r.text.lower()
    assert "traceback" not in text
    assert "exception" not in text
