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

    # Versionskontrolle (gelockert 2026-08-03).
    #
    # Vorher war exakt 0.3.2 erzwungen. Begruendung damals: "Nur diese Version
    # erzeugt ein Token, das der Worker unveraendert laden kann." Das ist eine
    # Vorsichtsmassnahme, keine nachgewiesene Inkompatibilitaet — der Token
    # stammt aus garth (garmin.client.dumps()), dessen Format ueber die
    # 0.3.x-Reihe stabil ist. Gekoppelt ist nur die Rueckgabeform von login().
    #
    # Notwendig wurde die Lockerung, weil Garmin seit Maerz 2026 Cloudflare vor
    # den SSO-Login gesetzt hat und den mobilen Pfad IP-unabhaengig mit 429
    # blockt. Der Widget-Pfad umgeht das, ist in 0.3.2 aber gegen die aktuelle
    # Garmin-Seite kaputt ("unexpected title"). 0.3.6 bringt die mehrstufige
    # Strategie mit.
    #
    # WICHTIG: Laedt der Worker (0.3.2) den erzeugten Token nicht, muss dort
    # ebenfalls auf 0.3.6 gehoben und neu deployt werden.
    SUPPORTED = ("0.3.2", "0.3.6")
    try:
        from importlib.metadata import version as _pkg_version
        ver = _pkg_version("garminconnect")
    except Exception:
        ver = "unbekannt"
    if ver not in SUPPORTED:
        _fail(f"Nicht unterstuetzte garminconnect-Version ({ver}). "
              f"Getestet: {' oder '.join(SUPPORTED)}. Installieren mit:\n"
              "  pip install 'garminconnect==0.3.6'")
    if ver != "0.3.2":
        print(f"Hinweis: Anmeldung laeuft mit garminconnect {ver}, "
              "der Worker nutzt 0.3.2. Sollte der Worker den Token ablehnen, "
              "dort ebenfalls auf {ver} heben und neu deployen.")

    print("Melde bei Garmin an … (kann 15–60 s dauern)")
    try:
        garmin = Garmin(email=email, password=password, return_on_mfa=True)
        result = garmin.login()
    except Exception as e:  # keine Payloads/Credentials ausgeben
        # Frueher stand hier pauschal "Zugangsdaten pruefen". Das ist bei einem
        # 429 oder einem Titel-Mismatch schlicht falsch und schickt in die
        # falsche Richtung. Jetzt nach Ursache getrennt.
        msg = str(e)
        if "429" in msg or "rate limit" in msg.lower():
            _fail("Garmin blockt die Anmeldung derzeit (429). Das ist KEIN Problem "
                  "mit deinen Zugangsdaten: Garmin blockt programmatische Logins "
                  "seit Maerz 2026 IP-unabhaengig ueber Cloudflare. Spaeter erneut "
                  "versuchen; wiederholte Versuche verlaengern die Sperre.")
        if "title" in msg.lower():
            _fail(f"Der Login-Pfad kennt die aktuelle Garmin-Seite nicht ({msg}). "
                  "Neuere garminconnect-Version noetig, nicht andere Zugangsdaten.")
        _fail(f"Garmin-Login fehlgeschlagen ({type(e).__name__}: {msg}).")

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
