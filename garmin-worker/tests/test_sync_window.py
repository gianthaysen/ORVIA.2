"""Vertragstest für das Zeitfenster eines Sync-Laufs (_target_dates).

Anlass (19.08.2026): Folge-Syncs holten fest `heute` und `gestern`. Stand der
Worker länger still — am 18.08.2026 gleichzeitig durch einen von Garmin
verworfenen Token (AUTH_FAILED) und einen abgelaufenen Railway-Trial —, holte
kein späterer Lauf die dazwischenliegenden Tage nach. Die Metriken fehlten
dauerhaft, obwohl die Engine genau darauf rechnet.

Diese Tests sichern beide Richtungen ab: das Fenster wächst nach einem Ausfall,
und es wächst im Normalbetrieb NICHT (sonst wäre die Korrektur eine stille
Verdopplung der Garmin-Last).
"""

from dataclasses import replace
from datetime import date, timedelta

from orvia_worker.sync import _local_date, _target_dates

TZ = "Europe/Berlin"
TODAY = date(2026, 8, 19)


def _dates(last_ok, backfill_days=30, today=TODAY):
    return _target_dates(today, last_ok, tz_name=TZ, fallback_tz="UTC",
                         backfill_days=backfill_days)


# -- Normalbetrieb: keine zusätzliche Last -----------------------------------

def test_regelbetrieb_bleibt_bei_gestern_und_heute():
    """Letzter Erfolg heute -> genau [gestern, heute], wie vor der Änderung."""
    assert _dates("2026-08-19T09:32:52.024387+00:00") == [
        date(2026, 8, 18), date(2026, 8, 19)]


def test_zeitzone_entscheidet_ueber_den_kalendertag():
    """23:30 UTC ist in Berlin schon der Folgetag — sonst würde ein Tag doppelt
    oder gar nicht geholt."""
    assert _dates("2026-08-18T23:30:00+00:00") == [
        date(2026, 8, 18), date(2026, 8, 19)]


# -- Ausfall: Fenster wächst --------------------------------------------------

def test_ausfall_von_fuenf_tagen_wird_nachgeholt():
    """Kernfall. Vorher gingen 17.–14.08. dauerhaft verloren."""
    got = _dates("2026-08-14T06:00:00+00:00")
    assert got[0] == date(2026, 8, 13)      # ein Tag Vorlauf für Schlafdaten
    assert got[-1] == TODAY
    assert got == [TODAY - timedelta(days=i) for i in range(6, -1, -1)]


def test_ausfall_ist_gedeckelt():
    """Monatelanger Ausfall läuft nicht in einen unbegrenzten Abruf."""
    got = _dates("2026-01-01T00:00:00+00:00", backfill_days=5)
    assert len(got) == 6                   # cap + heute
    assert got[0] == TODAY - timedelta(days=5)


# -- Erstsync + Robustheit ---------------------------------------------------

def test_erstsync_macht_weiter_backfill():
    got = _dates(None, backfill_days=30)
    assert len(got) == 31 and got[-1] == TODAY


def test_unparsebarer_zeitstempel_faellt_konservativ_zurueck():
    """Müll im Feld darf keinen 30-Tage-Abruf und keinen Absturz auslösen."""
    for kaputt in ("keine-zeit", "2026-13-45T99:99:99Z", 12345):
        assert _dates(kaputt) == [date(2026, 8, 18), TODAY], kaputt


def test_leeres_feld_gilt_wie_nie_synchronisiert():
    """Leer/None = kein erfolgreicher Lauf hinterlegt -> Backfill, wie bisher."""
    for leer in (None, "", 0):
        assert len(_dates(leer, backfill_days=7)) == 8, leer


def test_zeitstempel_in_der_zukunft_erzeugt_keine_leere_liste():
    """Uhrenversatz darf nicht in eine leere oder absteigende Liste laufen."""
    got = _dates("2026-08-25T00:00:00+00:00")
    assert got == [date(2026, 8, 18), TODAY]


def test_local_date_ohne_zeitzone_wird_als_utc_gelesen():
    assert _local_date("2026-08-19T00:30:00", TZ, "UTC") == date(2026, 8, 19)


# -- Durchlauf durch sync_user (echtes Verhalten, nicht nur Helfer) ----------

def test_sync_user_fragt_die_ausgefallenen_tage_wirklich_ab(
        fake_db, test_crypto, test_settings, fake_garmin_api):
    import asyncio

    from orvia_worker.providers.garmin_unofficial import GarminUnofficialProvider
    from orvia_worker.sync import sync_user

    user = "00000000-0000-0000-0000-000000000001"
    fake_db.tables["data_providers"] = [{
        "id": "prov-1", "user_id": user, "provider_type": "garmin_unofficial",
        "connection_status": "connected",
        "last_successful_sync_at": "2026-08-16T06:00:00+00:00",   # 3 Tage Ausfall
    }]
    ciphertext, version = test_crypto.encrypt_str('{"di_token":"x"}')
    fake_db.tables["provider_credentials"] = [{
        "id": "cred-1", "user_id": user, "provider_type": "garmin_unofficial",
        "credential_kind": "session_tokens",
        "encrypted_payload": ciphertext, "key_version": version,
    }]

    gefragt = []

    class Spion:
        def __init__(self, inner):
            self._inner = inner

        def get_user_summary(self, d):
            gefragt.append(d)
            return self._inner.get_user_summary(d)

        def __getattr__(self, name):
            return getattr(self._inner, name)

    settings = replace(test_settings, sync_backfill_days=30)
    provider = GarminUnofficialProvider(api=Spion(fake_garmin_api))
    result = asyncio.run(sync_user(
        user, db=fake_db, crypto=test_crypto, settings=settings,
        provider_factory=lambda token_str: provider, today=TODAY,
    ))

    assert result["ok"] is True, result["errors"]
    assert gefragt == ["2026-08-15", "2026-08-16", "2026-08-17",
                       "2026-08-18", "2026-08-19"]
