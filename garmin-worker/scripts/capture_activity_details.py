#!/usr/bin/env python3
"""GM7.4 · EINMALIGER, read-only Abruf EINER get_activity_details-Antwort
zur Ermittlung der ECHTEN Garmin-Detail-Struktur — und sofortige, lokale
Anonymisierung in ein Fixture. Nichts wird bei Garmin verändert.

Du (Gian) führst dieses Skript lokal aus. Es:
  1. loggt interaktiv bei Garmin ein (Passwort wird NICHT gespeichert/geloggt),
  2. wählt GENAU EINE Laufaktivität (jüngste, oder --activity-id),
  3. ruft get_activity_details() für GENAU DIESE eine Aktivität ab (read-only),
  4. anonymisiert die Rohantwort LOKAL:
       - Aktivitäts-ID, Owner-/User-/Device-Kennungen → feste Platzhalter
       - Koordinaten (lat/lon) → auf neutralen Ursprung verschoben (relative
         Form/Abstände bleiben, echter Ort verschwindet)
       - Orts-/Namens-/Adressfelder → "REDACTED"
       - ISO-Zeitstempel → festes Datum (Tageszeit + Intra-Aktivitäts-Abstände
         bleiben); Epoch-Arrays [ts,wert] → auf 0 relativ (Zeitabstände bleiben)
       - Feldnamen, Arrayformen und Zahlenstruktur bleiben unverändert,
  5. schreibt AUSSCHLIESSLICH tests/fixtures/garmin/activity_details.json,
  6. druckt nur eine STRUKTUR-Zusammenfassung (Schlüssel, Array-Längen) —
     KEINE rohe Route, KEINE Koordinaten, KEINE Tokens.

Aufruf (aus garmin-worker/, venv aktiv):
    python scripts/capture_activity_details.py            # jüngster Lauf
    python scripts/capture_activity_details.py --activity-id 12345678901
"""

from __future__ import annotations

import argparse
import getpass
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from anonymize import full_anon, summarize  # noqa: E402  (geteilter Anonymizer inkl. Zeitstempel-Scrub)

FIXTURE = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "garmin" / "activity_details.json"

# Platzhalter (deterministisch, keine echten Werte)
PH_ACTIVITY_ID = 9999999999
PH_OWNER_ID = 1111111111
PH_DEVICE_ID = 2222222222
NEUTRAL_LAT = 0.0          # neutraler Ursprung; relative Deltas bleiben erhalten
NEUTRAL_LON = 0.0
FIXED_DATE = "2026-01-01"  # Datum-Anker; Tageszeit + Intra-Abstände bleiben

# Schlüssel-Muster (case-insensitiv, Teilstring)
LATKEYS = ("latitude", "startlat", "endlat", "lat")
LONKEYS = ("longitude", "startlon", "endlon", "lon", "lng")
NAMEKEYS = ("locationname", "activityname", "ownerdisplayname", "ownerfullname",
            "username", "fullname", "address", "city", "country", "place")
IDKEYS = ("ownerid", "userprofilepk", "userprofileid", "userid", "profileid")
DEVKEYS = ("deviceid", "unitid")


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


def _pick_running_activity(garmin, activity_id):
    if activity_id:
        return str(activity_id)
    today = date.today()
    start = (today - timedelta(days=45)).isoformat()
    end = today.isoformat()
    try:
        acts = garmin.get_activities_by_date(start, end)
    except Exception as e:
        _fail(f"get_activities_by_date fehlgeschlagen ({type(e).__name__}).")
    for a in acts if isinstance(acts, list) else []:
        tk = ((a.get("activityType") or {}).get("typeKey") or "")
        if "running" in tk:
            return str(a.get("activityId"))
    _fail("Keine Laufaktivität in den letzten 45 Tagen gefunden. Nutze --activity-id.")


def _looks_epoch(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v > 1_000_000_000


def _anon(obj, ctx):
    """Rekursive, struktur-erhaltende Anonymisierung. ctx trägt die Koordinaten-
    Baseline (erste gesehene lat/lon) und die Epoch-Baseline für Zeitreihen."""
    if isinstance(obj, dict):
        # Koordinaten-Baseline aus dem ersten lat/lon-Paar dieses Objekts ziehen
        out = {}
        for k, v in obj.items():
            kl = str(k).lower()
            if any(s in kl for s in LATKEYS) and isinstance(v, (int, float)) and not isinstance(v, bool):
                if ctx.get("lat0") is None:
                    ctx["lat0"] = v
                out[k] = round(NEUTRAL_LAT + (v - ctx["lat0"]), 6)
            elif any(s in kl for s in LONKEYS) and isinstance(v, (int, float)) and not isinstance(v, bool):
                if ctx.get("lon0") is None:
                    ctx["lon0"] = v
                out[k] = round(NEUTRAL_LON + (v - ctx["lon0"]), 6)
            elif kl == "activityid" or kl.endswith("activityid"):
                out[k] = PH_ACTIVITY_ID
            elif any(s in kl for s in IDKEYS):
                out[k] = PH_OWNER_ID
            elif any(s in kl for s in DEVKEYS):
                out[k] = PH_DEVICE_ID
            elif any(s in kl for s in NAMEKEYS):
                out[k] = "REDACTED" if isinstance(v, str) else v
            elif isinstance(v, str) and len(v) >= 10 and v[:4].isdigit() and v[4] in "-/":
                # ISO-artiger Zeitstempel: Datum auf FIXED_DATE, Tageszeit behalten
                out[k] = FIXED_DATE + v[10:]
            else:
                out[k] = _anon(v, ctx)
        return out
    if isinstance(obj, list):
        # Zeitreihen als [epoch, wert]: Epoch relativ auf 0 (Abstände bleiben)
        if obj and isinstance(obj[0], list) and obj[0] and _looks_epoch(obj[0][0]):
            base = obj[0][0]
            red = []
            for row in obj:
                if isinstance(row, list) and row and _looks_epoch(row[0]):
                    red.append([row[0] - base] + [_anon(x, ctx) for x in row[1:]])
                else:
                    red.append(_anon(row, ctx))
            return red
        return [_anon(x, ctx) for x in obj]
    return obj


def _summary(obj, depth=0, path="root"):
    """Nur STRUKTUR: Schlüssel + Array-Längen. Keine Werte, keine Koordinaten."""
    lines = []
    if isinstance(obj, dict):
        lines.append(f"{'  '*depth}{path}: dict[{len(obj)}] keys={sorted(obj.keys())[:20]}")
        for k, v in list(obj.items())[:12]:
            if isinstance(v, (dict, list)):
                lines += _summary(v, depth + 1, str(k))
    elif isinstance(obj, list):
        lines.append(f"{'  '*depth}{path}: list[{len(obj)}]" + (f" elem0={type(obj[0]).__name__}" if obj else ""))
        if obj and isinstance(obj[0], (dict, list)):
            lines += _summary(obj[0], depth + 1, f"{path}[0]")
    return lines


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--activity-id", default=None)
    args = ap.parse_args()

    garmin = _login()
    aid = _pick_running_activity(garmin, args.activity_id)
    print(f"Gewählte Aktivität (wird gleich anonymisiert): …{str(aid)[-4:]}")

    print("Rufe get_activity_details() ab (GENAU EIN read-only Aufruf) …")
    try:
        raw = garmin.get_activity_details(aid)
    except Exception as e:
        _fail(f"get_activity_details fehlgeschlagen ({type(e).__name__}): {e}")

    anon = full_anon(raw)
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(json.dumps(anon, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nAnonymisiertes Fixture geschrieben: {FIXTURE}")
    print("\n--- STRUKTUR-Zusammenfassung (keine Rohwerte) ---")
    for line in summarize(anon)[:60]:
        print(line)
    print("\nBitte diese Datei committen bzw. mir zur Verfügung stellen — "
          "sie enthält keine echten Koordinaten, IDs oder Namen mehr.")


if __name__ == "__main__":
    main()
