#!/usr/bin/env python3
"""v8-453 · App-Testdaten aus den echten Garmin-Mitschnitten (captures/swimming__*.json) — GENAU so, wie der Worker die
Zeile schreibt: Listeneintrag → normalize, Details → build_activity_metrics, Runden → merge_extras.
Ausgabe: supabase/tests/fixtures/swim_capture_v453.json (je Garmin-Typ: metrics der Zeile ohne Messreihen + Eckdaten).
Aufruf (aus garmin-worker/):  python scripts/gen_app_swim_fixture.py      Pruefung: tests/test_v453_app_fixture.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from orvia_worker import detail_sync as DS, normalize, series_normalize as S  # noqa: E402

CAP = HERE.parent / "tests" / "fixtures" / "garmin" / "captures"
OUT = HERE.parent.parent / "supabase" / "tests" / "fixtures" / "swim_capture_v453.json"


def build() -> dict:
    out = {"_info": "erzeugt von garmin-worker/scripts/gen_app_swim_fixture.py aus den anonymisierten Mitschnitten — nicht von Hand aendern"}
    for name in ("lap_swimming", "open_water_swimming"):
        cap = json.load(open(CAP / f"swimming__{name}.json", encoding="utf-8"))
        act = normalize.normalize_activity(cap["list_entry"])
        metrics = S.build_activity_metrics(act.metrics, S.parse_activity_details(cap["details"]))
        metrics = DS.merge_extras(metrics, "swimming", {"splits": cap["splits"]})
        keep = {k: metrics[k] for k in ("splits", "splits_source") if k in metrics}
        keep["ext"] = {k: metrics["ext"][k] for k in ("v", "fields", "splits", "extras") if k in metrics["ext"]}
        keep["garmin"] = {k: metrics.get("garmin", {}).get(k) for k in ("type_key", "timer_duration_s", "elapsed_duration_s", "moving_duration_s")}
        out[name] = {"distance_m": cap["list_entry"].get("distance"),
                     "duration_s": cap["list_entry"].get("duration"), "metrics": keep}
    return out


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(build(), ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print("geschrieben:", OUT)
