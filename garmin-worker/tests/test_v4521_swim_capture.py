"""v8-452.1 · Runden/Bahnen am ECHTEN anonymisierten Mitschnitt einer Beckeneinheit (captures/swimming__lap_swimming.json).

Uebersprungen, solange der Mitschnitt nicht im Repo liegt. Sonst:
C1  Die Rundenantwort hat die erwartete Grundform (Liste von Runden mit Distanz und Dauer).
C2  Der Worker erhaelt JEDES Messfeld einer Runde und einer Bahn (keine Kappung durch keep_structure).
C3  Summe der Rundendistanzen = Distanz des Listeneintrags (± eine Bahn).
C4  Anzahl der aktiven Bahnen (Bahnen mit Distanz > 0) = activeLengths des Listeneintrags.
C5  Die schlanke Rundenform (metrics.splits) entsteht und traegt die Schwimmfelder, die Garmin je Runde liefert.
C6  Kein privates Feld, keine Kennung im abgelegten Rohblock.
"""

import json
from pathlib import Path

import pytest

from orvia_worker import detail_sync as DS, garmin_fields as GF

CAP = Path(__file__).parent / "fixtures" / "garmin" / "captures" / "swimming__lap_swimming.json"
pytestmark = pytest.mark.skipif(not CAP.exists(), reason="kein Mitschnitt einer Beckeneinheit im Repo")


def _cap():
    return json.load(open(CAP, encoding="utf-8"))


def _laps(splits):
    for k in ("lapDTOs", "laps", "splits"):
        if isinstance(splits, dict) and isinstance(splits.get(k), list):
            return splits[k]
    return splits if isinstance(splits, list) else []


def _lengths(lap):
    for k in ("lengthDTOs", "lengths"):
        if isinstance(lap.get(k), list):
            return lap[k]
    return []


def _measured_scalars(d):
    return {k for k, v in d.items() if not isinstance(v, (dict, list)) and not GF._is_private(k, v) and GF._scalar(v) is not None}


def test_c1_shape():
    laps = _laps(_cap()["splits"])
    assert laps, "keine Runden in der Antwort"
    assert all(isinstance(l.get("distance"), (int, float)) for l in laps)
    assert all(any(isinstance(l.get(d), (int, float)) for d in ("duration", "elapsedDuration", "movingDuration")) for l in laps)


def test_c2_every_measured_field_is_kept():
    raw = _cap()["splits"]
    kept = GF.keep_structure(raw)
    for i, (lap, klap) in enumerate(zip(_laps(raw), _laps(kept))):
        missing = _measured_scalars(lap) - set(klap)
        assert not missing, f"Runde {i}: nicht erhalten {sorted(missing)}"
        for j, (ln, kln) in enumerate(zip(_lengths(lap), _lengths(klap))):
            miss = _measured_scalars(ln) - set(kln)
            assert not miss, f"Runde {i} Bahn {j}: nicht erhalten {sorted(miss)}"


def test_c3_lap_distance_sums_to_total():
    c = _cap()
    total = c["list_entry"]["distance"]
    pool = (c["list_entry"].get("poolLength") or 0) / 100.0
    s = sum(l["distance"] for l in _laps(c["splits"]))
    assert abs(s - total) <= max(pool, 1.0), (s, total)


def test_c4_active_lengths_match():
    c = _cap()
    want = c["list_entry"].get("activeLengths")
    lengths = [ln for lap in _laps(c["splits"]) for ln in _lengths(lap)]
    if not lengths:
        pytest.skip("Runden ohne Bahnen")
    active = [ln for ln in lengths if (ln.get("distance") or 0) > 0]
    assert len(active) == want, (len(active), want)


def test_c5_slim_laps_carry_swim_fields():
    c = _cap()
    laps = DS._slim_laps(c["splits"])
    assert laps and len(laps) == len(_laps(c["splits"]))
    raw = _laps(c["splits"])
    for want in DS.SWIM_LAP_FIELDS:
        if any(want in l for l in raw):
            assert any(want in l for l in laps), want


def test_c6_no_private_fields_in_stored_block():
    m = DS.merge_extras({}, "swimming", {"splits": _cap()["splits"], "typed_splits": _cap().get("typed_splits")})
    blob = json.dumps(m["ext"])
    for bad in ("activityId", "Latitude", "Longitude", "ownerId", "deviceId"):
        assert bad not in blob, bad
