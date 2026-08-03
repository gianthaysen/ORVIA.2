#!/usr/bin/env python3
"""GM7.4 · EINMALIGER, read-only Abruf JE EINER Garmin-Antwort mit zeitlichen
Rohserien — Schlafstadien (sleepLevels) und Intraday-Stress (stressValuesArray) —
und sofortige LOKALE Anonymisierung in zwei Fixtures. Nichts wird bei Garmin
verändert. Keine Tokens/IDs/absoluten Zeitstempel/Standorte in Fixture/Terminal.

Ausgabe:
  tests/fixtures/garmin/sleep_series.json    (nur wenn sleepLevels vorhanden)
  tests/fixtures/garmin/stress_series.json   (nur wenn stressValuesArray vorhanden)

Liefert ein Endpunkt KEINE zeitlichen Segmente, wird KEINE Kurve erfunden — der
Punkt wird als Provider-Lücke gemeldet und kein Fixture geschrieben.

Aufruf (aus garmin-worker/, venv aktiv):
    python scripts/capture_series_fixtures.py                 # jüngster Tag mit Daten
    python scripts/capture_series_fixtures.py --date 2026-07-16
"""

from __future__ import annotations

import argparse
import getpass
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from anonymize import full_anon, summarize  # noqa: E402

FIX = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "garmin"


def _fail(msg: str) -> None:
    print(f"FEHLER: {msg}")
    sys.exit(1)


def _login():
    try:
        from garminconnect import Garmin
    except ImportError:
        _fail("garminconnect fehlt. Erst venv aktivieren: source .venv/bin/activate")
    email = input("Garmin-E-Mail: ").strip()
    password = getpass.getpass("Garmin-Passwort (Eingabe bleibt unsichtbar): ")
    if not email or not password:
        _fail("E-Mail und Passwort sind erforderlich.")
    print("Melde bei Garmin an … (kann 15–60 s dauern)")
    try:
        garmin = Garmin(email=email, password=password, return_on_mfa=True)
        result = garmin.login()
    except Exception as e:
        _fail(f"Garmin-Login fehlgeschlagen ({type(e).__name__}).")
    del password
    status = result[0] if isinstance(result, tuple) else None
    if status == "needs_mfa":
        code = input("Garmin-MFA-Code (aus E-Mail/App): ").strip()
        try:
            garmin.client.resume_login(None, code)
        except Exception as e:
            _fail(f"MFA fehlgeschlagen ({type(e).__name__}).")
    return garmin


def _has_time_segments_sleep(raw):
    lv = raw.get("sleepLevels") if isinstance(raw, dict) else None
    return isinstance(lv, list) and len(lv) > 0


def _has_intraday_stress(raw):
    arr = raw.get("stressValuesArray") if isinstance(raw, dict) else None
    return isinstance(arr, list) and len(arr) > 0


def _write(name, raw, present, label):
    if not present:
        print(f"PROVIDER-LÜCKE: {label} — Garmin lieferte keine zeitlichen Segmente. "
              f"Kein Fixture geschrieben, keine Kurve erfunden.")
        return
    anonymized = full_anon(raw)
    path = FIX / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(anonymized, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nAnonymisiertes Fixture geschrieben: {path}")
    print(f"--- STRUKTUR {label} (keine Rohwerte) ---")
    for line in summarize(anonymized)[:40]:
        print(line)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=None, help="YYYY-MM-DD; Default: jüngster Tag mit Daten")
    args = ap.parse_args()
    garmin = _login()

    # Kandidatentage: expliziter Tag, sonst die letzten 7 Tage durchprobieren.
    days = [args.date] if args.date else [(date.today() - timedelta(days=i)).isoformat() for i in range(1, 8)]

    sleep_done = stress_done = False
    for d in days:
        if not sleep_done:
            try:
                sraw = garmin.get_sleep_data(d)
            except Exception as e:
                sraw = None
                print(f"get_sleep_data({d}) fehlgeschlagen ({type(e).__name__}).")
            if isinstance(sraw, dict) and _has_time_segments_sleep(sraw):
                _write("sleep_series.json", sraw, True, "Schlafstadien (sleepLevels)")
                sleep_done = True
        if not stress_done:
            try:
                straw = garmin.get_stress_data(d)
            except Exception as e:
                straw = None
                print(f"get_stress_data({d}) fehlgeschlagen ({type(e).__name__}).")
            if isinstance(straw, dict) and _has_intraday_stress(straw):
                _write("stress_series.json", straw, True, "Intraday-Stress (stressValuesArray)")
                stress_done = True
        if sleep_done and stress_done:
            break

    if not sleep_done:
        _write("sleep_series.json", {}, False, "Schlafstadien (sleepLevels)")
    if not stress_done:
        _write("stress_series.json", {}, False, "Intraday-Stress (stressValuesArray)")
    print("\nBitte die erzeugten Fixtures committen bzw. mir geben — sie enthalten "
          "keine echten IDs, absoluten Zeitstempel oder Standortdaten mehr.")


if __name__ == "__main__":
    main()
