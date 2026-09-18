#!/usr/bin/env python3
"""Einmaliger lokaler Garmin-Login + Token-Import in den ORVIA-Worker.

Zweck: Garmin/Cloudflare blockt Passwort-Logins von Cloud-IPs (Railway) mit
429. Dieses Skript läuft auf DEINEM Rechner (Residential-IP), loggt sich dort
bei Garmin ein und schickt nur das resultierende Session-Token per HTTPS an
den Worker-Endpunkt /connect/token-import. Passwort und Token werden nie
angezeigt, nie gespeichert und landen nicht in der Shell-History.

Aufruf (empfohlen über den Wrapper, der die Umgebung mitbaut):
    bash scripts/reauth.sh
Direkt (venv aktiv):
    python scripts/local_login.py

Reihenfolge (geändert 2026-08-18): Worker-Erreichbarkeit und JWT werden VOR
dem Garmin-Login geprüft. Grund: der Garmin-Login ist der einzige Schritt, der
bei Wiederholung eine 429-Sperre riskiert — er darf nicht an einem toten
Worker oder einem abgelaufenen JWT verbrannt werden.
"""

from __future__ import annotations

import getpass
import json
import os
import sys
import urllib.error
import urllib.request

WORKER_DEFAULT = os.environ.get("ORVIA_WORKER_URL") or (
    "https://orvia-garmin-worker-production.up.railway.app"
)


def _fail(msg: str) -> None:
    print(f"FEHLER: {msg}")
    sys.exit(1)


def _request(url: str, jwt: str | None = None, data: bytes | None = None,
             timeout: int = 30) -> tuple[int, str]:
    """GET/POST ohne Exceptions nach oben: (HTTP-Status, Body).

    Status 0 bedeutet: Verbindung gar nicht zustande gekommen (Body = Grund).
    """
    headers = {}
    if jwt:
        headers["Authorization"] = f"Bearer {jwt}"
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers,
                                 method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        return 0, str(e.reason)


def _preflight_worker(worker: str) -> None:
    """Läuft der Worker? Muss vor dem Garmin-Login geklärt sein."""
    code, body = _request(worker + "/healthz", timeout=30)
    if code == 200:
        print("Vorprüfung 1/2: Worker erreichbar.")
        return
    if code == 0:
        _fail(f"Worker nicht erreichbar: {body}\n"
              "  Internetverbindung und Worker-URL prüfen.")
    if code == 404 and "Application not found" in body:
        _fail(
            "Der Worker existiert unter dieser Adresse nicht (Railway-Edge "
            "antwortet mit 404 'Application not found').\n"
            "  Das ist KEIN Token- und kein Garmin-Problem: Domain, Service "
            "oder Projekt bei Railway sind weg, umbenannt oder pausiert.\n"
            "  Prüfen: Railway-Dashboard -> Service -> Settings -> Networking "
            "(aktuelle Public Domain), Deployment-Status, Zahlungsstatus.\n"
            "  Neue Domain danach so übergeben:\n"
            "    ORVIA_WORKER_URL='https://<neue-domain>' bash scripts/reauth.sh"
        )
    _fail(f"Worker antwortet auf /healthz mit HTTP {code}: {body[:200]}")


def _ask_jwt() -> str:
    print()
    print("Supabase-JWT aus der Browser-Konsole einfügen "
          "(Eingabe bleibt unsichtbar, mit Enter bestätigen).")
    print("  ORVIA im Browser öffnen, eingeloggt, Konsole:")
    print("  ORVIA.sb.auth.getSession().then(r => "
          "console.log(r.data.session.access_token))")
    jwt = getpass.getpass("Supabase-JWT: ").strip()
    if jwt.startswith("[Log] "):  # Safari-Konsolen-Präfix automatisch entfernen
        jwt = jwt[len("[Log] "):]
    jwt = jwt.strip().strip('"').strip("'")
    if not jwt.startswith("eyJ"):
        _fail("Das sieht nicht nach einem JWT aus (muss mit 'eyJ' beginnen).")
    return jwt


def _preflight_status(worker: str, jwt: str) -> None:
    """JWT gültig? Und den bisherigen Fehlercode sichern, bevor er überschrieben wird."""
    code, body = _request(worker + "/status", jwt=jwt, timeout=30)
    if code == 401:
        _fail("Der Worker lehnt das JWT ab (HTTP 401). Es ist abgelaufen "
              "(Laufzeit ca. 1 Stunde) oder unvollständig kopiert. "
              "Neu aus der Browser-Konsole holen und Skript erneut starten.")
    if code != 200:
        _fail(f"/status antwortet mit HTTP {code}: {body[:200]}")
    print("Vorprüfung 2/2: JWT akzeptiert.")
    try:
        st = json.loads(body)
    except Exception:
        return
    print("  Bisheriger Zustand — connectionStatus: "
          f"{st.get('connectionStatus')} · lastErrorCode: "
          f"{st.get('lastErrorCode')} · lastSuccessfulSyncAt: "
          f"{st.get('lastSuccessfulSyncAt')}")
    print("  (Dieser Fehlercode ist die einzige Spur zur Ursache — "
          "notieren, er wird beim Import überschrieben.)")


def main() -> None:
    try:
        from garminconnect import Garmin
    except ImportError:
        _fail("garminconnect fehlt. Einfacher Weg: bash scripts/reauth.sh")

    worker = (input(f"Worker-URL [{WORKER_DEFAULT}]: ").strip()
              or WORKER_DEFAULT).rstrip("/")

    # -- Vorprüfung 1: Worker erreichbar? ------------------------------------
    _preflight_worker(worker)

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
        print(f"Hinweis: Anmeldung laeuft mit garminconnect {ver}. Ist der "
              f"Worker noch auf 0.3.2 gepinnt und lehnt den Token mit "
              f"TOKEN_INVALID ab, dort in requirements.txt ebenfalls auf {ver} "
              f"heben und neu deployen.")

    # -- Vorprüfung 2: JWT gueltig? (vor dem teuren Garmin-Login) ------------
    jwt = _ask_jwt()
    _preflight_status(worker, jwt)

    # -- Garmin-Login: der einzige Schritt mit 429-Risiko --------------------
    print()
    email = input("Garmin-E-Mail: ").strip()
    password = getpass.getpass("Garmin-Passwort (Eingabe bleibt unsichtbar): ")
    if not email or not password:
        _fail("E-Mail und Passwort sind erforderlich.")

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

    # -- Import in den Worker ------------------------------------------------
    print("Sende Token an den Worker …")
    code, body = _request(worker + "/connect/token-import", jwt=jwt,
                          data=json.dumps({"token_data": tokens}).encode("utf-8"),
                          timeout=180)
    if code == 200:
        print("Worker-Antwort:", body)
        print("Fertig. Erstsync läuft im Hintergrund; Status in 1–2 Minuten "
              "über GET /status oder Supabase Table Editor prüfen.")
        return
    if code == 0:
        _fail(f"Worker nicht erreichbar: {body}")
    print(f"Worker antwortete mit HTTP {code}: {body}")
    if code == 401:
        print("→ Das JWT ist zwischenzeitlich abgelaufen. Skript erneut starten.")
    sys.exit(1)


if __name__ == "__main__":
    main()
