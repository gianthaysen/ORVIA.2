"""POST /workout/push — Kraft-Workout-Push (Kraftplan v2, K5).

KONTROLLIERTER SPIKE. Der produktive Pfad ist gesperrt, solange die
numerische Sport-ID und die numerische ID der Abbruchbedingung `reps`
unbelegt sind (Gate G1). Genau das prüft P4/P5 hier ausdrücklich mit.

Alle Tests laufen offline: Garmin und Supabase sind vollständig gefälscht.

  P1  gültiger Push (nur im serverseitig freigeschalteten Gerätetest)
  P2  wiederholter identischer Push -> already_pushed
  P3  gleicher clientRef, anderer Hash -> Konflikt, nichts wird ersetzt
  P4  Gate G1: null-IDs im Regelbetrieb -> invalid_workout
  P5  Gate G3: Gewicht im Regelbetrieb -> invalid_workout; nie skaliert
  P6  Testmodus serverseitig aus/an — ein Client-Flag allein reicht nicht
  P7  fremde user_id im Body wird abgewiesen
  P8  fehlendes/ungültiges JWT
  P9  Reauth erforderlich (Token fehlt / Token ungültig)
  P10 Garmin-Ausfall, Rate-Limit und Timeout
  P11 Garmin-Erfolg ohne belastbare workoutId gilt nicht als Erfolg
  P12 zwei parallele Requests — die DB-Eindeutigkeit entscheidet
  P13 keine Geheimnisse in last_error und in den Logs
  P14 Der Vertrag der Exportzeile ist an den Nutzer gebunden
"""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from orvia_worker.api import create_app
from orvia_worker.db import DbError
from orvia_worker.providers.base import (
    AuthError,
    ProviderUnavailable,
    RateLimited,
)
from orvia_worker.workout_push import TABLE, push_strength_workout

USER = "00000000-0000-0000-0000-000000000001"
OTHER = "00000000-0000-0000-0000-0000000000ff"
TOKEN = "t" * 600

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "app" / "supabase" / "migrations" / "0035_strength_targets_and_garmin_link.sql"
)
MIGRATION_ALT = (
    Path(__file__).resolve().parents[2]
    / "supabase" / "migrations" / "0035_strength_targets_and_garmin_link.sql"
)


# ---------------------------------------------------------------------------
# Payload-Bausteine
# ---------------------------------------------------------------------------

def _step(order, cond_id, *, weight=None):
    s = {
        "type": "ExecutableStepDTO", "stepOrder": order,
        "stepType": {"stepTypeId": 3, "stepTypeKey": "interval", "displayOrder": 3},
        "endCondition": {"conditionTypeId": cond_id, "conditionTypeKey": "reps",
                         "displayOrder": 10, "displayable": True},
        "endConditionValue": 8,
        "category": "bench_press", "exerciseName": "barbell_bench_press",
        "exerciseCategoryId": 0, "exerciseNameId": 1,
    }
    if weight is not None:
        s["weightValue"] = weight
        s["weightUnit"] = {"unitKey": "gram"}
    return s


def _rest(order):
    return {
        "type": "ExecutableStepDTO", "stepOrder": order,
        "stepType": {"stepTypeId": 5, "stepTypeKey": "rest", "displayOrder": 5},
        "endCondition": {"conditionTypeId": 2, "conditionTypeKey": "time",
                         "displayOrder": 2, "displayable": True},
        "endConditionValue": 120,
    }


def workout(*, sport_id=10, cond_id=10, weight=None):
    """Standard: die Gate-Kandidatenwerte (wie im Geraetetestmodus des Exporters)."""
    return {
        "workoutName": "Oberkörper",
        "sportType": {"sportTypeId": sport_id, "sportTypeKey": "strength_training",
                      "displayOrder": 5},
        "estimatedDurationInSecs": 640,
        "workoutSegments": [{
            "segmentOrder": 1,
            "sportType": {"sportTypeId": sport_id, "sportTypeKey": "strength_training",
                          "displayOrder": 5},
            "workoutSteps": [_step(1, cond_id, weight=weight), _rest(2)],
        }],
    }


def bindings():
    return [
        {"stepOrder": 1, "kind": "set", "exerciseId": "ex-1", "slug": "bench_press",
         "plannedIndex": 0, "mappingVersion": "garmin-exercise-map@1"},
        {"stepOrder": 2, "kind": "rest", "exerciseId": "ex-1", "slug": "bench_press",
         "plannedIndex": 0, "mappingVersion": "garmin-exercise-map@1"},
    ]


def body(**over):
    b = {
        "clientRef": "swe:po:2026-08-12:ps:g1:1",
        "occurrenceId": "po:2026-08-12:ps:g1",
        "payloadVersion": "garmin-workout-export@1",
        "mappingVersion": "garmin-exercise-map@1",
        "payloadHash": "strength-plan@1:deadbeef",
        "workout": workout(),
        "stepBindings": bindings(),
        "deviceTest": True,
    }
    b.update(over)
    return b


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

class UniqueFakeDb:
    """Umhuellt die FakeDb und erzwingt den Unique-Index aus Migration 0035.

    Die FakeDb aus conftest kennt fuer `insert` keine Eindeutigkeit — genau
    die ist hier aber der Schutz gegen gleichzeitige Doppelrequests. Ohne
    diese Nachbildung wuerde P12 etwas pruefen, das es nicht gibt.
    """

    def __init__(self, inner):
        self._inner = inner
        self.insert_calls = 0
        # Jede geschriebene Statusaenderung MIT dem, was im selben Schreibvorgang
        # sonst noch gesetzt wurde. Ohne diese Spur beobachtet kein Test den
        # Zwischenzustand — und ein "status=pushed" schon beim Anlegen bliebe
        # unbemerkt, weil der Erfolgsfall ihn ohnehin ueberschreibt
        # (Mutationsprobe W17 blieb genau deshalb gruen).
        self.status_writes: list[tuple[str, str | None]] = []

    def _note(self, patch):
        if isinstance(patch, dict) and "status" in patch:
            self.status_writes.append((patch["status"], patch.get("garmin_workout_id")))

    async def update(self, table, filters, patch):
        if table == TABLE:
            self._note(patch)
        return await self._inner.update(table, filters, patch)

    def __getattr__(self, name):
        return getattr(self._inner, name)

    async def select(self, *a, **kw):
        # Echte I/O gibt die Kontrolle ab — und zwar NACH dem Lesen. Genau so
        # entsteht der veraltete Lesestand, den zwei gleichzeitige Anfragen im
        # Betrieb haben: beide sehen "noch nichts da", beide versuchen den
        # Insert, und erst die Eindeutigkeit der Datenbank entscheidet.
        # (Erster Anlauf: sleep VOR dem Lesen — dann lief eine Coroutine
        # vollstaendig durch und das Rennen fand im Test gar nicht statt.)
        rows = await self._inner.select(*a, **kw)
        await asyncio.sleep(0)
        return rows

    async def insert(self, table, rows, returning=False):
        if table == TABLE:
            self.insert_calls += 1
            for r in rows:
                self._note(r)
                existing = await self._inner.select(
                    table, {"user_id": r["user_id"], "client_ref": r["client_ref"]}
                )
                if existing:
                    raise DbError("insert: HTTP 409", 409)
        return await self._inner.insert(table, rows, returning=returning)


class FakeProvider:
    """Bildet den ECHTEN Providervertrag nach.

    `result` ist die ROHE Garmin-Antwort; die Umwandlung in eine workoutId
    macht der ECHTE Extraktor aus garmin_unofficial.py. Ein handgeschriebener
    Ersatz koennte davon abdriften — dann pruefte P11 die Wirklichkeit nicht
    mehr.
    """

    def __init__(self, *, result=None, error=None):
        self._result = result
        self._error = error
        self.calls = 0
        self.seen_payload = None

    def upload_strength_workout(self, payload):
        from orvia_worker.providers.garmin_unofficial import (
            GarminUnofficialProvider as _P,
        )
        self.calls += 1
        self.seen_payload = payload
        if self._error:
            raise self._error
        return _P._extract_workout_id(self._result)


@pytest.fixture
def env(fake_db, test_crypto, test_settings):
    """Baut Client + Datenbank. `server_test` schaltet den Geraetetestmodus."""
    import dataclasses

    def _make(provider=None, *, server_test=True, seed_token=True, factory_error=None):
        db = UniqueFakeDb(fake_db)
        fake_db.jwt_map["good-jwt"] = USER
        fake_db.jwt_map["other-jwt"] = OTHER
        # data_providers existiert im Betrieb ab /connect — der Reauth-Status
        # wird gepatcht, nicht angelegt.
        for uid in (USER, OTHER):
            fake_db.tables.setdefault("data_providers", []).append({
                "user_id": uid, "provider_type": "garmin_unofficial",
                "connection_status": "connected", "reauthentication_required": False,
            })
        if seed_token:
            ct, kv = test_crypto.encrypt_str(TOKEN)
            for uid in (USER, OTHER):
                fake_db.tables.setdefault("provider_credentials", []).append({
                    "user_id": uid, "provider_type": "garmin_unofficial",
                    "credential_kind": "session_tokens",
                    "encrypted_payload": ct, "key_version": kv,
                })
        prov = provider if provider is not None else FakeProvider(result={"workoutId": 987654})

        def provider_factory(token_str=None):
            if factory_error:
                raise factory_error
            return prov

        settings = dataclasses.replace(test_settings, strength_push_device_test=server_test)
        app = create_app(settings=settings, db=db, crypto=test_crypto,
                         provider_factory=provider_factory)
        return TestClient(app), db, prov, settings

    return _make


def _post(client, b, token="good-jwt"):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.post("/workout/push", json=b, headers=headers)


def _rows(db):
    return db.tables.get(TABLE, [])


# ══ P1 · gültiger Push ══
def test_valid_push_persists_workout_id(env):
    client, db, prov, _ = env()
    r = _post(client, body())
    assert r.status_code == 200, r.text
    assert r.json()["workoutId"] == "987654"
    assert r.json()["status"] == "pushed"
    assert prov.calls == 1
    rows = _rows(db)
    assert len(rows) == 1
    row = rows[0]
    assert row["user_id"] == USER
    assert row["client_ref"] == "swe:po:2026-08-12:ps:g1:1"
    assert row["occurrence_id"] == "po:2026-08-12:ps:g1"
    assert row["garmin_workout_id"] == "987654"
    assert row["status"] == "pushed"
    assert row["last_error"] is None


def test_push_persists_versions_hash_and_bindings(env):
    client, db, _, _ = env()
    _post(client, body())
    row = _rows(db)[0]
    assert row["payload_version"] == "garmin-workout-export@1"
    assert row["mapping_version"] == "garmin-exercise-map@1"
    assert row["payload_hash"] == "strength-plan@1:deadbeef"
    assert len(row["step_bindings"]) == 2
    assert row["step_bindings"][0]["mappingVersion"] == "garmin-exercise-map@1"


def test_status_becomes_pushed_only_after_a_confirmed_answer(env):
    client, db, _, _ = env()
    _post(client, body())
    assert db.status_writes[0][0] == "draft", \
        f"die Zeile muss als Entwurf entstehen, nicht als 'pushed': {db.status_writes}"
    pushed = [w for w in db.status_writes if w[0] == "pushed"]
    assert len(pushed) == 1
    assert pushed[0][1] == "987654", \
        "'pushed' darf nur zusammen mit der Garmin-ID geschrieben werden"
    assert db.status_writes.index(("pushed", "987654")) > 0, "Entwurf kommt zuerst"


@pytest.mark.parametrize("err", [ProviderUnavailable("weg"), RateLimited("zu viel"),
                                 TimeoutError("boom"), AuthError("ungueltig")])
def test_a_failed_push_is_never_marked_pushed(env, err):
    client, db, _, _ = env(provider=FakeProvider(error=err))
    _post(client, body())
    assert all(w[0] != "pushed" for w in db.status_writes), db.status_writes
    assert _rows(db)[0]["status"] == "failed"


def test_unclear_answer_is_never_marked_pushed(env):
    client, db, _, _ = env(provider=FakeProvider(result={"workoutId": None}))
    _post(client, body())
    assert all(w[0] != "pushed" for w in db.status_writes), db.status_writes


def test_database_independently_forbids_pushed_without_id():
    """Der Riegel liegt nicht nur im Worker — 0035 verbietet es auch in der DB."""
    path = MIGRATION if MIGRATION.exists() else MIGRATION_ALT
    if not path.exists():
        pytest.skip("Migration 0035 nicht verfuegbar")
    sql = path.read_text(encoding="utf-8")
    assert "swe_pushed_needs_id" in sql
    assert re.search(r"swe_pushed_needs_id[\s\S]{0,200}?garmin_workout_id\s+is\s+not\s+null",
                     sql, re.I), "0035 muss 'pushed ohne ID' verbieten"


# ══ P2 · wiederholter identischer Push ══
def test_repeated_identical_push_is_already_pushed(env):
    client, db, prov, _ = env()
    assert _post(client, body()).status_code == 200
    r2 = _post(client, body())
    assert r2.status_code == 409
    assert r2.json()["code"] == "already_pushed"
    assert r2.json()["workoutId"] == "987654"
    assert r2.json()["status"] == "pushed"
    assert prov.calls == 1, "der zweite Versuch darf Garmin NICHT erneut aufrufen"
    assert len(_rows(db)) == 1


# ══ P3 · gleicher clientRef, anderer Hash ══
def test_same_client_ref_other_hash_is_conflict(env):
    client, db, prov, _ = env()
    assert _post(client, body()).status_code == 200
    r2 = _post(client, body(payloadHash="strength-plan@1:cafebabe"))
    assert r2.status_code == 409
    assert r2.json()["code"] == "client_ref_conflict"
    assert prov.calls == 1, "ein Konflikt darf nichts erneut uebertragen"
    row = _rows(db)[0]
    assert row["payload_hash"] == "strength-plan@1:deadbeef", "der alte Stand bleibt"
    assert row["garmin_workout_id"] == "987654", "das bestehende Workout wird nie ersetzt"


# ══ P4 · Gate G1 ══
@pytest.mark.parametrize("kw,needle", [
    ({"sport_id": None}, "sportTypeId"),
    ({"cond_id": None}, "conditionTypeId"),
])
def test_unverified_ids_are_rejected_in_normal_mode(env, kw, needle):
    client, db, prov, _ = env(server_test=False)
    r = _post(client, body(workout=workout(**kw), deviceTest=False))
    assert r.status_code == 422
    assert r.json()["code"] == "invalid_workout"
    assert any(needle in d for d in r.json()["details"])
    assert prov.calls == 0
    assert _rows(db) == [], "eine abgelehnte Anfrage legt keine Exportzeile an"


def test_unverified_ids_pass_only_in_device_test(env):
    client, _, prov, _ = env(server_test=True)
    r = _post(client, body(workout=workout(sport_id=None, cond_id=None)))
    assert r.status_code == 200, r.text
    assert prov.calls == 1


# ══ P5 · Gate G3 ══
def test_weight_is_rejected_in_normal_mode(env):
    client, db, prov, _ = env(server_test=False)
    r = _post(client, body(workout=workout(weight=82500), deviceTest=False))
    assert r.status_code == 422
    assert r.json()["code"] == "invalid_workout"
    assert any("weightValue" in d and "G3" in d for d in r.json()["details"])
    assert prov.calls == 0


def test_worker_never_adds_or_scales_weight(env):
    """Der Worker ergaenzt und skaliert NIE — er reicht durch, was ankommt."""
    client, _, prov, _ = env(server_test=True)
    _post(client, body(workout=workout(weight=82500)))
    step = prov.seen_payload["workoutSegments"][0]["workoutSteps"][0]
    assert step["weightValue"] == 82500, "unveraendert durchgereicht"
    _post(client, body(clientRef="ref-2", workout=workout()))
    step2 = prov.seen_payload["workoutSegments"][0]["workoutSteps"][0]
    assert "weightValue" not in step2, "ohne Gewicht wird keines ergaenzt"


# ══ P6 · Testmodus nur serverseitig ══
def test_client_flag_alone_does_not_enable_device_test(env):
    client, db, prov, _ = env(server_test=False)
    r = _post(client, body(deviceTest=True))
    assert r.status_code == 422
    assert r.json()["code"] == "invalid_workout"
    assert any("serverseitig nicht freigeschaltet" in d for d in r.json()["details"])
    assert prov.calls == 0
    assert _rows(db) == []


def test_device_test_off_by_default_in_settings(test_settings):
    assert test_settings.strength_push_device_test is False


def test_env_only_enables_on_explicit_yes():
    from orvia_worker.config import Settings
    base = {"SUPABASE_URL": "http://x", "SUPABASE_SERVICE_ROLE_KEY": "k",
            "TOKEN_ENCRYPTION_KEY": "k"}
    for raw, expected in [("", False), ("0", False), ("false", False), ("no", False),
                          ("maybe", False), ("1", True), ("true", True), ("YES", True)]:
        s = Settings.from_env({**base, "STRENGTH_PUSH_DEVICE_TEST": raw})
        assert s.strength_push_device_test is expected, raw


# ══ P7 · fremde user_id im Body ══
def test_foreign_user_id_in_body_is_rejected(env):
    client, db, prov, _ = env()
    r = _post(client, {**body(), "user_id": OTHER})
    assert r.status_code == 422, "Fremdfeld wird abgewiesen, nicht still ignoriert"
    assert prov.calls == 0
    assert _rows(db) == []


def test_user_comes_from_jwt_not_from_body(env):
    client, db, _, _ = env()
    assert _post(client, body(), token="other-jwt").status_code == 200
    assert _rows(db)[0]["user_id"] == OTHER, "der Nutzer stammt aus dem JWT"


# ══ P8 · JWT ══
@pytest.mark.parametrize("token", [None, "bad-jwt"])
def test_missing_or_invalid_jwt_is_401(env, token):
    client, db, prov, _ = env()
    r = _post(client, body(), token=token)
    assert r.status_code == 401
    assert prov.calls == 0
    assert _rows(db) == []


def test_wrong_auth_scheme_is_401(env):
    client, _, prov, _ = env()
    r = client.post("/workout/push", json=body(),
                    headers={"Authorization": "Basic good-jwt"})
    assert r.status_code == 401
    assert prov.calls == 0


# ══ P9 · Reauth ══
def test_missing_tokens_require_reauth(env):
    client, db, prov, _ = env(seed_token=False)
    r = _post(client, body())
    assert r.status_code == 401
    assert r.json()["code"] == "reauthentication_required"
    assert prov.calls == 0
    row = _rows(db)[0]
    assert row["status"] == "failed"
    assert row["last_error"] == "tokens_missing"


def test_invalid_token_requires_reauth_without_password_fallback(env):
    client, db, prov, _ = env(factory_error=AuthError("ungueltig"))
    r = _post(client, body())
    assert r.status_code == 401
    assert r.json()["code"] == "reauthentication_required"
    assert _rows(db)[0]["last_error"] == "auth_failed"
    assert "password" not in r.text.lower() and "passwort" not in r.text.lower()


def test_auth_error_from_garmin_sets_reauth_flag(env):
    client, db, _, _ = env(provider=FakeProvider(error=AuthError("Session ungueltig")))
    r = _post(client, body())
    assert r.status_code == 401
    mine = [p for p in db.tables.get("data_providers", []) if p["user_id"] == USER]
    assert mine and mine[0]["reauthentication_required"] is True
    assert mine[0]["connection_status"] == "reauth_required"
    others = [p for p in db.tables.get("data_providers", []) if p["user_id"] == OTHER]
    assert others and others[0]["reauthentication_required"] is False, \
        "der Reauth-Status darf NUR den eigenen Nutzer treffen"


def test_reauth_code_never_carries_foreign_text(env):
    """Luecke aus dem Probenlauf v8-330 (Muster fixture_masks).

    `_safe_code` wurde ausschliesslich mit KONSTANTEN aufgerufen und filterte
    damit nichts. Die einzige Stelle mit Fremddaten — `getattr(e, "code")` aus
    einer Garmin-AuthError — ging UNGEFILTERT an `_set_reauth` und landete in
    `data_providers.last_error_code`. Eine Fremd-Exception kann dort beliebigen
    Text tragen, einschliesslich Token-Resten oder Adressen.
    """
    boese = AuthError("Session ungueltig")
    boese.code = "host=1.2.3.4 token=SECRET user=gian@example.com"
    client, db, _, _ = env(provider=FakeProvider(error=boese))
    r = _post(client, body())
    assert r.status_code == 401
    mine = [p for p in db.tables.get("data_providers", []) if p["user_id"] == USER][0]
    assert mine["reauthentication_required"] is True
    assert mine["last_error_code"] == "UNKNOWN", \
        "unbekannter Fremdcode muss auf UNKNOWN fallen, nicht durchgereicht werden"
    gesamt = str(db.tables)
    for geheim in ("SECRET", "1.2.3.4", "gian@example.com"):
        assert geheim not in gesamt, f"{geheim} ist in die Datenbank gelangt"


def test_known_reauth_codes_survive_the_allowlist(env):
    """Gegenprobe: die Erlaubnisliste darf nicht einfach alles verwerfen."""
    from orvia_worker.workout_push import _safe_reauth_code
    for gut in ("TOKENS_MISSING", "TOKEN_DECRYPT_FAILED", "AUTH_FAILED"):
        assert _safe_reauth_code(gut) == gut
    assert _safe_reauth_code("auth_failed") == "AUTH_FAILED", "Schreibweise wird vereinheitlicht"
    for schlecht in (None, "", 42, [], {"code": "x"}, "DROP TABLE users"):
        assert _safe_reauth_code(schlecht) == "UNKNOWN"


def test_missing_tokens_also_set_the_reauth_flag(env):
    """Luecke aus dem Probenlauf v8-330 (Muster value_not_type).

    `test_missing_tokens_require_reauth` prueft Antwortcode, Status und
    `last_error` — aber NICHT, dass der Reauth-Status tatsaechlich gesetzt
    wurde. Das Entfernen von `_set_reauth` blieb deshalb gruen: die App
    haette den Nutzer nie zur Neuanmeldung aufgefordert.
    """
    client, db, prov, _ = env(seed_token=False)
    r = _post(client, body())
    assert r.status_code == 401
    assert prov.calls == 0, "ohne Tokens darf Garmin gar nicht erst gerufen werden"
    mine = [p for p in db.tables.get("data_providers", []) if p["user_id"] == USER][0]
    assert mine["reauthentication_required"] is True
    assert mine["connection_status"] == "reauth_required"
    assert mine["last_error_code"] == "TOKENS_MISSING"


# ══ P10 · Garmin-Ausfall ══
def test_provider_unavailable_is_502(env):
    client, db, _, _ = env(provider=FakeProvider(error=ProviderUnavailable("weg")))
    r = _post(client, body())
    assert r.status_code == 502
    assert r.json()["code"] == "garmin_unavailable"
    assert _rows(db)[0]["status"] == "failed"
    assert _rows(db)[0]["last_error"] == "provider_unavailable"


def test_rate_limited_is_502_with_retry_after(env):
    client, db, _, _ = env(provider=FakeProvider(error=RateLimited("zu viel")))
    r = _post(client, body())
    assert r.status_code == 502
    assert r.json()["code"] == "garmin_unavailable"
    assert r.json()["retryAfter"] == 300
    assert _rows(db)[0]["last_error"] == "rate_limited"


def test_timeout_is_502_and_stores_no_foreign_text(env):
    client, db, _, _ = env(provider=FakeProvider(error=TimeoutError("host=1.2.3.4 token=SECRET")))
    r = _post(client, body())
    assert r.status_code == 502
    assert r.json()["code"] == "garmin_unavailable"
    row = _rows(db)[0]
    assert row["status"] == "failed"
    assert row["last_error"] == "provider_unavailable"
    assert "SECRET" not in str(row) and "1.2.3.4" not in str(row)


def test_failed_push_may_be_retried_with_same_hash(env):
    """Ein Fehlschlag darf wiederholt werden — er ist kein `already_pushed`."""
    client, db, _, _ = env(provider=FakeProvider(error=ProviderUnavailable("weg")))
    assert _post(client, body()).status_code == 502
    # Zweiter Anlauf mit funktionierendem Provider im selben Datenbestand.
    import dataclasses
    prov2 = FakeProvider(result={"workoutId": 111})
    app2 = create_app(settings=dataclasses.replace(
        client.app.state.settings, strength_push_device_test=True),
        db=db, crypto=client.app.state.crypto, provider_factory=lambda t=None: prov2)
    r2 = TestClient(app2).post("/workout/push", json=body(),
                               headers={"Authorization": "Bearer good-jwt"})
    assert r2.status_code == 200
    assert _rows(db)[0]["garmin_workout_id"] == "111"
    assert len(_rows(db)) == 1


# ══ P11 · Erfolg ohne workoutId ══
@pytest.mark.parametrize("resp", [None, {}, {"workoutId": None}, {"workoutId": ""},
                                  {"workoutId": 0}, {"workoutId": True}, "ok", []])
def test_response_without_workout_id_is_not_success(env, resp):
    client, db, _, _ = env(provider=FakeProvider(result=resp))
    r = _post(client, body())
    assert r.status_code == 502, resp
    assert r.json()["code"] == "garmin_unavailable"
    assert r.json().get("detail") == "no_workout_id"
    row = _rows(db)[0]
    assert row["status"] == "failed"
    assert row.get("garmin_workout_id") in (None, "")
    assert row["last_error"] == "garmin_no_workout_id"


def test_extract_workout_id_accepts_only_solid_values():
    from orvia_worker.providers.garmin_unofficial import GarminUnofficialProvider as P
    assert P._extract_workout_id({"workoutId": 42}) == "42"
    assert P._extract_workout_id({"workoutId": " 42 "}) == "42"
    assert P._extract_workout_id({"workoutid": 7}) == "7"
    for bad in [None, {}, {"workoutId": None}, {"workoutId": 0}, {"workoutId": True},
                {"workoutId": []}, "nope", 5]:
        assert P._extract_workout_id(bad) is None, bad


def test_provider_without_session_fails_closed():
    from orvia_worker.providers.garmin_unofficial import GarminUnofficialProvider
    with pytest.raises(AuthError):
        GarminUnofficialProvider().upload_strength_workout({"workoutName": "x"})


# ══ P12 · parallele Requests ══
def test_two_parallel_requests_are_guarded_by_db_uniqueness(env):
    client, db, prov, settings = env()

    async def _both():
        return await asyncio.gather(
            push_strength_workout(user_id=USER, body=body(), db=db,
                                  crypto=client.app.state.crypto, settings=settings,
                                  provider_factory=lambda t=None: prov),
            push_strength_workout(user_id=USER, body=body(), db=db,
                                  crypto=client.app.state.crypto, settings=settings,
                                  provider_factory=lambda t=None: prov),
        )

    a, b = asyncio.run(_both())
    codes = sorted([a.status_code, b.status_code])
    assert len(_rows(db)) == 1, "die Eindeutigkeit laesst nur EINE Exportzeile zu"
    assert db.insert_calls == 2, "beide Anfragen haben den Insert wirklich versucht"
    assert codes in ([200, 200], [200, 409]), codes
    assert _rows(db)[0]["garmin_workout_id"] == "987654"


def test_migration_provides_the_uniqueness_this_relies_on():
    """Die Nachbildung in UniqueFakeDb ist nur zulaessig, wenn es sie WIRKLICH gibt."""
    path = MIGRATION if MIGRATION.exists() else MIGRATION_ALT
    if not path.exists():
        pytest.skip(f"Migration 0035 nicht verfuegbar ({MIGRATION} / {MIGRATION_ALT})")
    sql = path.read_text(encoding="utf-8")
    assert re.search(r"unique\s*\(\s*user_id,\s*client_ref\s*\)", sql, re.I), \
        "0035 muss (user_id, client_ref) eindeutig machen"


# ══ P13 · keine Geheimnisse ══
def test_last_error_only_uses_the_fixed_vocabulary(env):
    from orvia_worker.workout_push import SAFE_ERROR_CODES
    for err in [ProviderUnavailable("token=SECRET"), RateLimited("apikey=SECRET"),
                TimeoutError("Bearer SECRET"), AuthError("passwort=SECRET")]:
        client, db, _, _ = env(provider=FakeProvider(error=err))
        _post(client, body())
        row = _rows(db)[0]
        assert row["last_error"] in SAFE_ERROR_CODES, row["last_error"]
        assert "SECRET" not in str(row)


def test_no_secrets_or_payloads_in_logs(env, caplog):
    caplog.set_level(logging.DEBUG)
    client, _, _, _ = env(provider=FakeProvider(error=ProviderUnavailable("token=SECRET")))
    _post(client, body())
    client2, _, _, _ = env()
    _post(client2, body(clientRef="ref-log"))
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "SECRET" not in text
    assert TOKEN not in text
    assert "barbell_bench_press" not in text, "kein Roh-Payload im Log"
    assert "Bearer" not in text


def test_error_responses_carry_no_stacktrace(env):
    client, _, _, _ = env(provider=FakeProvider(error=TimeoutError("boom")))
    r = _post(client, body())
    low = r.text.lower()
    assert "traceback" not in low and "timeouterror" not in low


# ══ P14 · Bindung an den Nutzer ══
def test_export_rows_are_scoped_to_the_owner(env):
    client, db, _, _ = env()
    assert _post(client, body()).status_code == 200
    # Derselbe clientRef bei einem ANDEREN Nutzer ist ein eigener Vorgang und
    # darf die fremde Zeile weder sehen noch veraendern.
    r = _post(client, body(), token="other-jwt")
    assert r.status_code == 200
    rows = _rows(db)
    assert len(rows) == 2
    assert {x["user_id"] for x in rows} == {USER, OTHER}
    mine = [x for x in rows if x["user_id"] == USER][0]
    assert mine["garmin_workout_id"] == "987654"


def test_every_write_filters_on_user_id(env):
    """Kein Schreibpfad dieses Moduls darf ohne user_id filtern."""
    src = (Path(__file__).resolve().parents[1] /
           "orvia_worker" / "workout_push.py").read_text(encoding="utf-8")
    for call in re.findall(r"db\.update\(\s*([^)]*?)\)", src, re.S):
        assert "user_id" in call, call
    assert "db.delete(" not in src, "dieses Modul loescht nichts"
