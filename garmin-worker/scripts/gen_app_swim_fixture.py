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
OUT_RR = HERE.parent.parent / "supabase" / "tests" / "fixtures" / "run_ride_capture_v454.json"
RUN_RIDE = ("running__running__intervals", "running__running__steady", "cycling__road_biking__intervals",
            "cycling__cycling__steady", "cycling__virtual_ride__indoor")


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


def build_run_ride() -> dict:
    """v8-454 · Lauf/Rad: Zeile so, wie der Worker v8-454 sie mit DETAIL_EXTRAS=splits,typed_splits schreiben wuerde
    (typed_splits nur Laufen). Mit Messreihen (fuer Rundenfenster und Diagramme), ohne Route."""
    out = {"_info": "erzeugt von garmin-worker/scripts/gen_app_swim_fixture.py (build_run_ride) aus den anonymisierten Mitschnitten — nicht von Hand aendern"}
    for name in RUN_RIDE:
        cap = json.load(open(CAP / f"{name}.json", encoding="utf-8"))
        act = normalize.normalize_activity(cap["list_entry"])
        metrics = S.build_activity_metrics(act.metrics, S.parse_activity_details(cap["details"]))
        fetched = {"splits": cap["splits"]}
        if act.sport_id == "running":
            fetched["typed_splits"] = cap["typed_splits"]
        metrics = DS.merge_extras(metrics, act.sport_id, fetched)
        keep = {k: metrics[k] for k in ("splits", "splits_source", "streams", "stream_meta") if k in metrics}
        keep["ext"] = {k: metrics["ext"][k] for k in ("v", "fields", "splits", "typed_splits", "extras", "series") if k in metrics["ext"]}
        keep["garmin"] = {k: metrics.get("garmin", {}).get(k) for k in ("type_key", "start_gmt", "timer_duration_s", "elapsed_duration_s", "moving_duration_s")}
        le = cap["list_entry"]
        out[name] = {"sport": act.sport_id, "distance_m": le.get("distance"), "duration_s": le.get("duration"), "avg_hr": le.get("averageHR"),
                     "max_hr": le.get("maxHR"), "avg_speed": le.get("averageSpeed"), "avg_power": le.get("avgPower"), "metrics": keep}
    return out


if __name__ == "__main__":
    OUT_RR.write_text(json.dumps(build_run_ride(), ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    print("geschrieben:", OUT_RR)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(build(), ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print("geschrieben:", OUT)
