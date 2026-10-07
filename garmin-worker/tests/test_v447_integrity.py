"""v8-447 · Datenintegritaet des Garmin-Imports.

A  Kadenz: die SCHRITTfrequenz eines Laufs wird nicht mehr halbiert; Rad-Trittfrequenz
   laeuft durch keine Lauf-Regel; jede Messreihe traegt ihre Bedeutung.
Geprueft gegen den ECHTEN anonymisierten Mitschnitt (tests/fixtures/garmin/activity_details.json)
— wo kein Mitschnitt vorliegt (Rad), steht das am Test.
"""

import json
from pathlib import Path

from orvia_worker import series_normalize as S

FIX = Path(__file__).parent / "fixtures" / "garmin"
DETAILS = json.load(open(FIX / "activity_details.json", encoding="utf-8"))


def _col(raw, key):
    idx = {m["key"]: m["metricsIndex"] for m in raw["metricDescriptors"]}[key]
    return [r["metrics"][idx] for r in raw["activityDetailMetrics"]]


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs)


# ---- A · Kadenz ------------------------------------------------------------

def test_fixture_documents_the_three_cadence_fields():
    """Beleg fuer die Bedeutung der Felder, am echten Mitschnitt:
    directRunCadence = ein Bein (ganzzahlig), Fractional = Nachkommaanteil,
    directDoubleCadence = Schrittfrequenz beider Beine = 2 × (Run + Fractional)."""
    run, dbl, frac = _col(DETAILS, "directRunCadence"), _col(DETAILS, "directDoubleCadence"), _col(DETAILS, "directFractionalCadence")
    assert (run[0], frac[0], dbl[0]) == (80.0, 0.5, 161.0)
    assert round(_mean(run), 2) == 80.05 and round(_mean(dbl), 2) == 160.98
    both = [(r, f, d) for r, f, d in zip(run, frac, dbl) if None not in (r, f, d)]
    assert len(both) > 1500
    assert all(abs(2 * (r + f) - d) < 1e-6 for r, f, d in both)


def test_running_cadence_is_step_frequency_not_halved():
    out = S.parse_activity_details(DETAILS)
    cad = out["streams"]["cadence"]
    assert cad[0] == 161.0                                   # bis v8-446: 80.0
    assert 155 <= _mean(cad) <= 167, _mean(cad)              # Schritte je Minute, nicht ~80
    assert out["stream_units"]["cadence"] == "spm"
    meta = out["stream_meta"]["cadence"]
    assert meta["kind"] == "running_cadence_spm"
    assert meta["source"] == "directDoubleCadence"
    assert meta["garmin_unit"] == "stepsPerMinute"
    assert "derived" not in meta                             # Messwert der Quelle, nichts gerechnet


def test_running_cadence_without_double_field_is_built_and_marked_derived():
    raw = json.loads(json.dumps(DETAILS))
    raw["metricDescriptors"] = [m for m in raw["metricDescriptors"] if m["key"] != "directDoubleCadence"]
    out = S.parse_activity_details(raw)
    assert out["streams"]["cadence"][0] == 161                # 2 × (80 + 0.5)
    meta = out["stream_meta"]["cadence"]
    assert meta["kind"] == "running_cadence_spm" and meta["source"] == "directRunCadence"
    assert meta["derived"] == "2*(directRunCadence+directFractionalCadence)"
    # ohne Fractional: 2 × Run (Garmin liefert Run ganzzahlig), weiter als abgeleitet gekennzeichnet
    raw["metricDescriptors"] = [m for m in raw["metricDescriptors"] if m["key"] != "directFractionalCadence"]
    out2 = S.parse_activity_details(raw)
    assert out2["streams"]["cadence"][0] == 160 and "derived" in out2["stream_meta"]["cadence"]


def _ride(cadence=92, power=210):
    """Synthetische RAD-Antwort. Die Feldnamen directBikeCadence / directPower sind eine
    ANNAHME (kein Rad-Mitschnitt im Repo) — der Test belegt die Regel, nicht Garmins Nutzlast."""
    return {
        "metricDescriptors": [
            {"metricsIndex": 0, "key": "directHeartRate", "unit": {"key": "bpm"}},
            {"metricsIndex": 1, "key": "directBikeCadence", "unit": {"key": "rpm"}},
            {"metricsIndex": 2, "key": "directPower", "unit": {"key": "watt"}},
        ],
        "activityDetailMetrics": [{"metrics": [130, cadence, power]} for _ in range(12)],
    }


def test_cycling_cadence_stays_untouched():
    out = S.parse_activity_details(_ride(cadence=92))
    assert out["streams"]["cadence"] == [92] * 12              # raw 92 → 92, keine Lauf-Regel
    assert out["stream_units"]["cadence"] == "rpm"
    assert out["stream_meta"]["cadence"] == {"kind": "cycling_cadence_rpm", "unit": "rpm", "source": "directBikeCadence", "garmin_unit": "rpm"}
    assert out["stream_meta"]["power"]["kind"] == "power_w" and out["streams"]["power"][0] == 210


def test_every_stream_carries_its_meaning():
    out = S.parse_activity_details(DETAILS)
    assert set(out["stream_meta"].keys()) == set(out["streams"].keys())
    for name, meta in out["stream_meta"].items():
        assert meta["kind"] and meta["unit"] and meta["source"], name
        assert meta["unit"] == out["stream_units"][name]
    assert out["stream_meta"]["heart_rate"]["source"] == "directHeartRate"
    assert out["stream_meta"]["speed"]["garmin_unit"] == "mps"
    # nichts erfunden: keine Leistung im Lauf-Mitschnitt ⇒ keine Reihe, keine Beschreibung
    assert "power" not in out["streams"] and "power" not in out["stream_meta"]


def test_streams_stay_index_aligned():
    """Alle Reihen haben dieselbe Laenge und dieselbe Ausduennung — Punkt i gehoert
    in jeder Reihe zum selben Messzeitpunkt."""
    out = S.parse_activity_details(DETAILS)
    lens = {k: len(v) for k, v in out["streams"].items()}
    assert len(set(lens.values())) == 1, lens          # bis v8-446: Hoehe 265, die anderen 266
    n = len(DETAILS["activityDetailMetrics"])
    keep = S._sample_indices(n, S.STREAM_MAX)
    assert keep[0] == 0 and keep[-1] == n - 1 and len(keep) <= S.STREAM_MAX and keep == sorted(set(keep))
    for name, key in (("heart_rate", "directHeartRate"), ("elevation", "directElevation"), ("distance", "sumDistance"), ("cadence", "directDoubleCadence")):
        col = _col(DETAILS, key)
        # Punkt i = Messzeile keep[i], in jeder Reihe. Verglichen wird die 32-Bit-Messung
        # (46.79999923706055 wird als 46.8 gespeichert — dieselbe Zahl, siehe _compact).
        want = [col[i] for i in keep]
        got = out["streams"][name]
        assert len(got) == len(want), name
        assert all((a is None) == (b is None) and (a is None or S._f32(a) == S._f32(b)) for a, b in zip(want, got)), name


def test_sample_indices_edges():
    assert S._sample_indices(0, 300) == [] and S._sample_indices(1, 300) == [0]
    assert S._sample_indices(300, 300) == list(range(300))
    for n in (301, 599, 600, 601, 1855, 9000):
        k = S._sample_indices(n, 300)
        assert len(k) <= 300 and k[0] == 0 and k[-1] == n - 1 and all(b > a for a, b in zip(k, k[1:])), n


def test_merge_replaces_stream_meta_with_streams():
    old = {"streams": {"cadence": [80, 81]}, "stream_units": {"cadence": "spm"}, "training_load": 99,
           "durationCorrection": {"fromMin": 60, "toMin": 45}}
    merged = S.build_activity_metrics(old, S.parse_activity_details(DETAILS))
    assert merged["streams"]["cadence"][0] == 161.0
    assert merged["stream_meta"]["cadence"]["kind"] == "running_cadence_spm"
    assert merged["training_load"] == 99 and merged["durationCorrection"]["toMin"] == 45   # Fremdes bleibt
