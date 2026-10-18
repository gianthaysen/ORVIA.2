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


def test_c7_typed_splits_and_split_summaries_are_empty():
    """Becken UND Freiwasser: Intervall-Abruf (typedsplits) und split_summaries liefern leere Listen — Intervalle und
    Bahnen stecken vollstaendig in der Rundenantwort. Deshalb Freigabe nur mit DETAIL_EXTRAS=splits (spart einen Abruf)."""
    c = _cap()
    assert c["typed_splits"].get("splits") == [] and c["split_summaries"].get("splitSummaries") == []
    ow = CAP.with_name("swimming__open_water_swimming.json")
    if ow.exists():
        o = json.load(open(ow, encoding="utf-8"))
        assert o["typed_splits"].get("splits") == []


def test_c8_semantics_of_laps_and_lengths():
    """Belegte Bedeutung (Mitschnitt 18.10.2026):
      Runde ohne Distanz = Pause (eine Bahn ohne Distanz)          · Bahn ohne Distanz in einer Runde = Pause in der Runde
      Runde.movingDuration = Summe der aktiven Bahnen             · Listeneintrag.movingDuration = Summe der Runden-movingDuration
      Bahn.averageSWOLF = Zuege + gerundete Sekunden              · Runde.averageSpeed (Becken) = Distanz / movingDuration
      Summe Zuege der Runden = strokes des Listeneintrags"""
    c = _cap()
    laps, le = _laps(c["splits"]), c["list_entry"]
    mov = 0.0
    for lap in laps:
        act = [x for x in _lengths(lap) if (x.get("distance") or 0) > 0]
        if (lap.get("distance") or 0) == 0:
            assert not act and lap.get("movingDuration", 0) == 0
            continue
        assert abs(sum(x["duration"] for x in act) - lap["movingDuration"]) < 0.05
        assert lap["numberOfActiveLengths"] == len(act)
        assert lap["totalNumberOfStrokes"] == sum(x.get("totalNumberOfStrokes") or 0 for x in act)
        assert abs(lap["averageSpeed"] - lap["distance"] / lap["movingDuration"]) < 0.005
        for x in act:
            assert abs(x["averageSWOLF"] - (x["totalNumberOfStrokes"] + round(x["duration"]))) <= 1
        mov += lap["movingDuration"]
    assert abs(mov - le["movingDuration"]) < 0.1
    assert sum(l.get("totalNumberOfStrokes") or 0 for l in laps) == le["strokes"]


def test_c9_worker_end_to_end_with_the_real_capture():
    """Listeneintrag → Zeile, Details + Runden aus dem Mitschnitt durch den echten Sync-Pfad (FakeDb). Ergebnis:
    schlanke Runden mit Schwimmfeldern, Bahnen im Rohblock, Befund an der Zeile, Rohfelder bleiben, Zeilengroesse begrenzt."""
    import asyncio
    from orvia_worker import normalize
    from tests.conftest import FakeDb

    c = _cap()
    act = normalize.normalize_activity(c["list_entry"])

    async def run():
        db = FakeDb()
        await db.insert("activities", [{"user_id": "u", "source": "garmin", "source_record_id": act.source_record_id,
                                        "sport_id": act.sport_id, "metrics": act.metrics}])
        res = await DS.sync_activity_details(db, "u", lambda aid: c["details"], limit=5,
                                             get_extra=lambda name, aid: c[name], extras=("splits",),
                                             extras_sports=("swimming",))
        assert res["updated"] == 1 and res["extras"] == 1
        return (await db.select("activities", {"user_id": "u"}))[0]["metrics"]

    m = asyncio.run(run())
    laps = m["splits"]
    assert m["splits_source"] == "garmin_splits" and len(laps) == len(_laps(c["splits"]))
    active = [l for l in laps if l["distance"] > 0]
    assert sum(l["numberOfActiveLengths"] for l in active) == c["list_entry"]["activeLengths"]
    assert all("averageSWOLF" in l and "swimStroke" in l and "movingDuration" in l for l in active)
    assert m["ext"]["extras"] == {"splits": "ok"}
    raw_lengths = [ln for lap in m["ext"]["splits"]["lapDTOs"] for ln in lap.get("lengthDTOs", [])]
    assert len(raw_lengths) == sum(len(_lengths(l)) for l in _laps(c["splits"]))
    assert m["ext"]["fields"]["poolLength"] == c["list_entry"]["poolLength"]
    assert len(json.dumps(m["ext"]["splits"])) < 60_000                         # Rohblock je Einheit (78 Bahnen ~ 24 kB)
    assert len(json.dumps(m["splits"])) < 6_000                                # landet auch im lokalen Speicher
