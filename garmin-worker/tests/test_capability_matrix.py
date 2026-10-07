"""v8-447 · Commit D — die Faehigkeits-Matrix ist aus dem Code erzeugt und bleibt es.

Die Datei app/docs/GARMIN-CAPABILITY-MATRIX.md darf dem Worker nicht davonlaufen: dieser Test
erzeugt sie neu und vergleicht. Ausserdem: die Tabelle der festen Plaetze (CANONICAL) nennt
nur Rohnamen, die der Parser wirklich liest.
"""

import importlib.util
import re
from pathlib import Path

from orvia_worker import detail_sync, garmin_fields as GF, normalize, series_normalize as S

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT.parent / "app" / "docs" / "GARMIN-CAPABILITY-MATRIX.md"

_spec = importlib.util.spec_from_file_location("gen_capability_matrix", ROOT / "scripts" / "gen_capability_matrix.py")
GEN = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(GEN)


def test_document_is_generated_from_the_code():
    if not DOC.parent.exists():
        return                                   # Worker allein ausgerollt (kein app/-Ordner)
    assert DOC.exists(), "Matrix fehlt — python garmin-worker/scripts/gen_capability_matrix.py"
    assert DOC.read_text(encoding="utf-8") == GEN.render(), "Matrix veraltet — scripts/gen_capability_matrix.py ausfuehren"


def test_every_table_has_the_requested_columns_and_full_rows():
    want = ("FIELD", "SPORT", "ENDPOINT", "RAW FIELD NAME", "RAW AVAILABLE?", "IMPORTED?", "STORED?", "DISPLAYED?",
            "SERIES/SUMMARY", "UNITS", "NORMALIZATION", "LOSSY?", "HIGHLIGHT-READY?", "NOTES")
    assert GEN.HEAD == want
    for rows in (GEN.rows_canonical(), GEN.rows_known(), GEN.rows_series(), GEN.rows_extras()):
        assert rows and all(len(r) == len(want) for r in rows)
    assert len(GEN.rows_canonical()) == len(GF.CANONICAL) and len(GEN.rows_known()) == len(GF.KNOWN)
    assert len(GEN.rows_series()) == len(GF.SERIES_KNOWN) and len(GEN.rows_extras()) == len(detail_sync.EXTRAS)
    text = GEN.render()
    for key in [f["key"] for f in GF.KNOWN] + [f["key"] for f in GF.SERIES_KNOWN] + list(normalize.SPORT_MAP) + sorted(GF.SERIES_SKIP):
        assert f"`{key}`" in text, key           # kein Feld, keine Reihe, kein Typ fehlt in der Matrix


def test_canonical_rows_describe_what_the_parser_reads():
    src_series = (ROOT / "orvia_worker" / "series_normalize.py").read_text(encoding="utf-8")
    src_norm = (ROOT / "orvia_worker" / "normalize.py").read_text(encoding="utf-8")
    src_gf = (ROOT / "orvia_worker" / "garmin_fields.py").read_text(encoding="utf-8")
    for c in GF.CANONICAL:
        assert c["evidence"] in ("fixture", "library", "assumed") and c["ep"] in ("list", "details")
        names = re.findall(r"[A-Za-z][A-Za-z0-9]+", c["raw"])
        raw_keys = [n for n in names if n not in ("letzte", "Zeile", "Zeilenzahl", "lat", "lon", "polyline")]
        hay = src_series if c["ep"] == "details" else (src_norm + src_gf)
        for key in raw_keys:
            assert f'"{key}"' in hay, (c["field"], key)        # der Rohname steht woertlich im Parser
    # jede Reihe, die der Parser kanonisch liest, ist als "nicht zusaetzlich gespeichert" erklaert
    assert GF.CANONICAL_SERIES_KEYS <= GF.SERIES_SKIP
    assert set(GEN.SKIP_WHY) == set(GF.SERIES_SKIP)
    # Belegstufe "fixture" nur fuer Reihen, die im echten Mitschnitt wirklich vorkommen
    import json
    fix = json.load(open(ROOT / "tests" / "fixtures" / "garmin" / "activity_details.json", encoding="utf-8"))
    have = {m["key"] for m in fix["metricDescriptors"]} | {"geoPolylineDTO", "totalMetricsCount", "polyline", "lat", "lon"}
    for c in GF.CANONICAL:
        if c["evidence"] == "fixture":
            keys = [n for n in re.findall(r"[A-Za-z][A-Za-z0-9]+", c["raw"]) if n not in ("letzte", "Zeile", "Zeilenzahl")]
            assert all(k in have for k in keys), (c["field"], keys)
    assert S.STREAM_MAX == 300 and detail_sync.DETAILS_CONTRACT_VERSION == 3
