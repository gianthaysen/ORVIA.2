#!/usr/bin/env python3
"""Diagnose: rohe get_devices()-Antwort von Garmin unverändert ausgeben.

Zweck: normalize_devices() in orvia_worker/normalize.py hat scheinbar ein
Gerät verschluckt (vívoactive 5 fehlt in connected_devices, obwohl im
Garmin-Konto aktiv und registriert). Dieses Skript zeigt die tatsächliche
Rohstruktur, die Garmin liefert — Grundlage für die Korrektur.

Enthält NUR Geräte-Metadaten (Modell, IDs, Softwareversion) — keine
Gesundheits-/Trainingsdaten, keine Zugangsdaten. Passwort wird nicht
gespeichert oder geloggt.

Aufruf (aus garmin-worker/, venv aktiv):
    python scripts/diag_devices.py
"""

from __future__ import annotations

import getpass
import json
import sys


def _fail(msg: str) -> None:
    print(f"FEHLER: {msg}")
    sys.exit(1)


def main() -> None:
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

    print("\n--- Rohe get_devices()-Antwort ---\n")
    try:
        devices = garmin.get_devices()
        print(json.dumps(devices, indent=2, ensure_ascii=False))
    except Exception as e:
        _fail(f"get_devices() fehlgeschlagen ({type(e).__name__}): {e}")

    print("\n--- Anzahl Geräte:", len(devices) if isinstance(devices, list) else "unbekannt", "---")

    # Zusätzlich: welche Schlüssel hat jedes Geräte-Objekt tatsächlich?
    if isinstance(devices, list):
        print("\n--- Vorhandene Schlüssel pro Gerät ---")
        for i, d in enumerate(devices):
            if isinstance(d, dict):
                print(f"Gerät {i}: {sorted(d.keys())}")


if __name__ == "__main__":
    main()
