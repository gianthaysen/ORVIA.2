"""v8-452 · Zusatzabrufe (z. B. Runden beim Beckenschwimmen) fuer bereits geladene Aktivitaeten nachholen.

DETAIL_REFETCH_EXTRAS laedt eine Aktivitaet auf aktuellem Details-Vertrag EINMAL neu, wenn ein eingeschalteter
Zusatzabruf, der fuer sie in Frage kommt, noch keinen Befund an der Zeile hat. Standard AUS; ohne DETAIL_EXTRAS wirkungslos.
"""
from orvia_worker import detail_sync as DS
from orvia_worker.config import Settings


def _swim(type_key="lap_swimming", extras=None, streams=("heart_rate",)):
    m = {"detailsFetchedAt": "2026-10-01T00:00:00Z", "detailsVersion": DS.DETAILS_CONTRACT_VERSION,
         "garmin": {"type_key": type_key}, "streams": {k: [1, 2, 3] for k in streams}, "ext": {"v": 1, "fields": {"distance": 1000}}}
    if extras is not None:
        m["ext"]["extras"] = extras
    return {"sport_id": "swimming", "source_record_id": "1", "metrics": m}


def test_default_off():
    base = {"SUPABASE_URL": "u", "SUPABASE_SERVICE_ROLE_KEY": "k", "TOKEN_ENCRYPTION_KEY": "t"}
    assert Settings.from_env(base).detail_refetch_extras is False
    assert Settings.from_env({**base, "DETAIL_REFETCH_EXTRAS": "1"}).detail_refetch_extras is True


def test_needs_extras_only_for_enabled_and_matching():
    act = _swim()
    assert DS._needs_extras(act, ("splits", "typed_splits")) is True
    assert DS._needs_extras(act, ()) is False                                     # nichts eingeschaltet
    assert DS._needs_extras(_swim(type_key="open_water_swimming"), ("typed_splits",)) is False   # Bahnen nur im Becken
    assert DS._needs_extras(_swim(extras={"splits": "ok", "typed_splits": "empty"}), ("splits", "typed_splits")) is False
    assert DS._needs_extras(_swim(extras={"splits": "failed"}), ("splits",)) is False             # Befund steht: kein Endlosabruf
    assert DS._needs_extras(_swim(extras={"splits": "ok"}), ("splits", "typed_splits")) is True


def test_needs_details_respects_flag():
    act = _swim()
    assert DS._needs_details(act) is False
    assert DS._needs_details(act, refetch_extras=("splits",)) is True
    assert DS._needs_details(act, refetch_extras=None) is False


def test_backfill_status_counts_extras_pending():
    st = DS.backfill_status([_swim(), _swim(extras={"splits": "ok"})], refetch_extras=("splits",))
    assert st["extras_pending"] == 1
    assert DS.backfill_status([_swim()])["extras_pending"] == 0
