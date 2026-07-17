#!/usr/bin/env python3
"""Einmaliger lokaler Garmin-Login + Token-Import in den ORVIA-Worker.

Zweck: Garmin/Cloudflare blockt Passwort-Logins von Cloud-IPs (Railway) mit
429. Dieses Skript läuft auf DEINEM Rechner (Residential-IP), loggt sich dort
bei Garmin ein und schickt nur das resultierende Session-Token per HTTPS an
den Worker-Endpunkt /connect/token-import. Passwort und Token werden nie
angezeigt, nie gespeichert und landen nicht in der Shell-History.

Aufruf (aus garmin-worker/, venv aktiv):
    python scripts/local_login.py
"""

from __future__ import annotations

import getpass
import json
import sys
import urllib.error
import urllib.request

WORKER_DEFAULT = "https://orvia-garmin-worker-production.up.railway.app"


def _fail(msg: str) -> None:
    print(f"FEHLER: {msg}")
    sys.exit(1)


def main() -> None:
    try:
        from garminconnect import Garmin
    except ImportError:
        _fail("garminconnect fehlt. Erst venv aktivieren: source .venv/bin/activate")

    worker = input(f"Worker-URL [{WORKER_DEFAULT}]: ").strip() or WORKER_DEFAULT
    email = input("Garmin-E-Mail: ").strip()
    password = getpass.getpass("Garmin-Passwort (Eingabe bleibt unsichtbar): ")
    if not email or not password:
        _fail("E-Mail und Passwort sind erforderlich.")

    # Versionskontrolle: der Worker läuft mit garminconnect 0.3.2. Nur diese
    # Version erzeugt ein Token, das der Worker unverändert laden kann.
    try:
        from importlib.metadata import version as _pkg_version
        ver = _pkg_version("garminconnect")
    except Exception:
        ver = "unbekannt"
    if ver != "0.3.2":
        _fail(f"Falsche garminconnect-Version installiert ({ver}). Der Worker "
              "braucht 0.3.2. Bitte ausführen:\n"
              "  pip3 install --user 'garminconnect==0.3.2'\n"
              "und das Skript erneut starten.")

    print("Melde bei Garmin an … (kann 15–60 s dauern)")
    try:
        garmin = Garmin(email=email, password=password, return_on_mfa=True)
        result = garmin.login()
    except Exception as e:  # keine Payloads/Credentials ausgeben
        _fail(f"Garmin-Login fehlgeschlagen ({type(e).__name__}). "
              "Zugangsdaten auf connect.garmin.com prüfen.")

    # login() gibt bei 0.3.2 (mfa_status, client_state) zurück.
    status = result[0] if isinstance(result, tuple) else None
    if status == "needs_mfa":
        code = input("Garmin-MFA-Code (aus E-Mail/App): ").strip()
        try:
            garmin.client.resume_login(None, code)
        except Exception as e:
            _fail(f"MFA fehlgeschlagen ({type(e).__name__}).")

    tokens = garmin.client.dumps()
    del password
    print("Garmin-Login erfolgreich. Token erzeugt (wird nicht angezeigt).")

    print("Jetzt das Supabase-JWT aus der Browser-Konsole einfügen "
          "(Eingabe bleibt unsichtbar, mit Enter bestätigen).")
    jwt = getpass.getpass("Supabase-JWT: ").strip()
    if jwt.startswith("[Log] "):  # Safari-Konsolen-Präfix automatisch entfernen
        jwt = jwt[len("[Log] "):]
    if not jwt.startswith("eyJ"):
        _fail("Das sieht nicht nach einem JWT aus (muss mit 'eyJ' beginnen).")

    req = urllib.request.Request(
        worker.rstrip("/") + "/connect/token-import",
        data=json.dumps({"token_data": tokens}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {jwt}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    print("Sende Token an den Worker …")
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            print("Worker-Antwort:", r.read().decode("utf-8"))
            print("Fertig. Erstsync läuft im Hintergrund; Status in 1–2 Minuten "
                  "über GET /status oder Supabase Table Editor prüfen.")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"Worker antwortete mit HTTP {e.code}: {body}")
        sys.exit(1)
    except urllib.error.URLError as e:
        _fail(f"Worker nicht erreichbar: {e.reason}")


if __name__ == "__main__":
    main()
