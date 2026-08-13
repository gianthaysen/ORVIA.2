#!/usr/bin/env python3
"""Erfasst die Sätze einer Kraft-Aktivität BEREINIGT — für Gate G2 und G3.

Läuft LOKAL (Residential-IP), nicht im Worker. Der Ablauf ist derselbe wie bei
scripts/local_login.py: Token einmal lokal erzeugen, hier hereinreichen.

WAS HERAUSKOMMT
Genau die Felder, die Gian für das Protokoll benannt hat:
  activityId · workoutId (falls vorhanden) · category · name · setType ·
  repetitionCount · weight · duration · wktStepIndex · probability

WAS NICHT HERAUSKOMMT
Alles andere. Das Skript arbeitet mit einer ERLAUBNISLISTE, nicht mit einer
Verbotsliste: es kopiert nur die oben genannten Felder heraus, statt zu
versuchen, Unerwünschtes zu entfernen. Eine Verbotsliste vergisst
zwangsläufig irgendwann ein Feld — eine Erlaubnisliste kann das nicht.
Tokens, E-Mail-Adressen, Namen, GPS-Spuren und vollständige Rohantworten
verlassen dieses Skript nie.

AUFRUF
  python3 scripts/capture_workout_sets.py \\
      --token-file ~/garmin-token.txt \\
      --activity-id 12345678901 \\
      --out geraetetest-g2.json

  # Aktivität noch nicht bekannt? Die letzten Krafteinheiten anzeigen:
  python3 scripts/capture_workout_sets.py --token-file ~/… --list
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Erlaubnisliste je Satz. Was hier nicht steht, wird nicht ausgegeben.
SET_FIELDS = (
    "setType", "repetitionCount", "weight", "duration", "wktStepIndex",
    "startTimeGMT", "exercises",
)
EXERCISE_FIELDS = ("category", "name", "probability")
# Aus der Aktivitätsübersicht nur das, was den Bezug belegt.
ACTIVITY_FIELDS = ("activityId", "workoutId", "duration", "startTimeLocal")


def _pick(src: dict, fields) -> dict:
    return {k: src.get(k) for k in fields if k in src}


def sanitize_sets(raw: dict) -> list[dict]:
    """exerciseSets -> bereinigte Satzliste. Nur Erlaubnisliste."""
    out = []
    for s in (raw or {}).get("exerciseSets", []) or []:
        if not isinstance(s, dict):
            continue
        row = _pick(s, SET_FIELDS)
        row["exercises"] = [
            _pick(e, EXERCISE_FIELDS) for e in (s.get("exercises") or [])
            if isinstance(e, dict)
        ]
        out.append(row)
    return out


def sanitize_activity(raw: dict) -> dict:
    """Aktivitätskopf -> nur die Felder, die den Workout-Bezug belegen."""
    act = _pick(raw or {}, ACTIVITY_FIELDS)
    # workoutId liegt je nach Endpunkt eine Ebene tiefer.
    if "workoutId" not in act:
        for key in ("workout", "metadataDTO", "summaryDTO"):
            sub = (raw or {}).get(key)
            if isinstance(sub, dict) and sub.get("workoutId") is not None:
                act["workoutId"] = sub["workoutId"]
                act["workoutIdFoundUnder"] = key
                break
    return act


def build_protocol(activity: dict, sets: list[dict]) -> dict:
    """Fasst zusammen, was die Gates beantworten müssen — ohne zu werten."""
    step_indexes = [s.get("wktStepIndex") for s in sets]
    weights = [s.get("weight") for s in sets if s.get("weight") is not None]
    names = sorted({
        (e.get("category"), e.get("name"))
        for s in sets for e in (s.get("exercises") or [])
    })
    return {
        "activity": activity,
        "sets": sets,
        "beobachtungen": {
            "anzahlSaetze": len(sets),
            "wktStepIndexGesetzt": any(i is not None for i in step_indexes),
            "wktStepIndexWerte": step_indexes,
            "aktivitaetNenntWorkoutId": activity.get("workoutId") is not None,
            "kategorienUndNamen": [{"category": c, "name": n} for c, n in names],
            "gewichtsRohwerte": weights,
        },
        "hinweis": (
            "Nur Erlaubnisliste — keine Tokens, Namen, E-Mail-Adressen, "
            "GPS-Daten oder vollstaendigen Rohantworten."
        ),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--token-file", required=True,
                    help="Datei mit dem lokal erzeugten Garmin-Token (client.dumps()).")
    ap.add_argument("--activity-id", help="Garmin activityId der Testeinheit.")
    ap.add_argument("--list", action="store_true",
                    help="Die letzten Aktivitaeten anzeigen, um die ID zu finden.")
    ap.add_argument("--out", help="Zieldatei fuer das bereinigte Protokoll (JSON).")
    args = ap.parse_args()

    token = Path(args.token_file).expanduser().read_text(encoding="utf-8").strip()
    if not token:
        print("Token-Datei ist leer.", file=sys.stderr)
        return 2

    from garminconnect import Garmin  # lazy: das Skript ist ohne Netz importierbar

    api = Garmin()
    api.login(token)

    if args.list:
        acts = api.get_activities(0, 15)
        print(f"{'activityId':>14}  {'typ':<22} {'start':<20} name")
        for a in acts or []:
            t = ((a.get("activityType") or {}).get("typeKey")) or "?"
            # Der Aktivitaetsname kann Freitext des Nutzers sein — deshalb nur
            # auf dem Bildschirm, nie in der Ausgabedatei.
            print(f"{a.get('activityId'):>14}  {t:<22} "
                  f"{str(a.get('startTimeLocal'))[:19]:<20} {a.get('activityName')}")
        return 0

    if not args.activity_id:
        print("Ohne --activity-id gibt es nichts zu erfassen (oder --list nutzen).",
              file=sys.stderr)
        return 2

    detail = api.get_activity(args.activity_id) if hasattr(api, "get_activity") else {}
    raw_sets = api.get_activity_exercise_sets(args.activity_id)

    protocol = build_protocol(sanitize_activity(detail or {}), sanitize_sets(raw_sets))
    text = json.dumps(protocol, indent=2, ensure_ascii=False)

    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"Bereinigtes Protokoll geschrieben: {args.out}")
    print(text)

    b = protocol["beobachtungen"]
    print("\n--- Kurzbefund fuer die Abnahmetabelle ---")
    print(f"  Saetze erfasst              : {b['anzahlSaetze']}")
    print(f"  G2 · wktStepIndex gesetzt   : {'JA' if b['wktStepIndexGesetzt'] else 'NEIN'}")
    print(f"  G2 · Activity nennt workoutId: {'JA' if b['aktivitaetNenntWorkoutId'] else 'NEIN'}")
    print(f"  G2 · Kategorien/Namen       : {b['kategorienUndNamen']}")
    print(f"  G3 · Gewichts-Rohwerte      : {b['gewichtsRohwerte']}")
    print("\n  G3 gilt erst als belegt, wenn BEIDE Gewichte dieselbe Beziehung")
    print("  zum gesendeten Wert zeigen (20 kg und 30 kg). Eine einzelne Zahl")
    print("  laesst sich auf zu viele Arten erklaeren.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
