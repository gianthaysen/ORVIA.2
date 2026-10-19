"""v8-453 · Die App-Testdaten (supabase/tests/fixtures/swim_capture_v453.json) sind GENAU das, was der Worker aus den
echten Mitschnitten in die Zeile schreibt — aendert sich der Worker, schlaegt dieser Test fehl, bis die Datei neu erzeugt ist
(python scripts/gen_app_swim_fixture.py)."""
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT.parent / "supabase" / "tests" / "fixtures" / "swim_capture_v453.json"
CAP = ROOT / "tests" / "fixtures" / "garmin" / "captures" / "swimming__lap_swimming.json"


@pytest.mark.skipif(not (FIX.exists() and CAP.exists()), reason="App-Testdaten oder Mitschnitt fehlen")
def test_app_fixture_matches_worker_output():
    spec = importlib.util.spec_from_file_location("gen_app_swim_fixture", ROOT / "scripts" / "gen_app_swim_fixture.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert json.loads(json.dumps(mod.build(), sort_keys=True)) == json.load(open(FIX, encoding="utf-8"))


RR = ROOT.parent / "supabase" / "tests" / "fixtures" / "run_ride_capture_v454.json"


@pytest.mark.skipif(not RR.exists(), reason="App-Testdaten Lauf/Rad fehlen")
def test_app_run_ride_fixture_matches_worker_output():
    spec = importlib.util.spec_from_file_location("gen_app_swim_fixture", ROOT / "scripts" / "gen_app_swim_fixture.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert json.loads(json.dumps(mod.build_run_ride(), sort_keys=True)) == json.load(open(RR, encoding="utf-8"))
