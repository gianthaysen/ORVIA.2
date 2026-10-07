#!/usr/bin/env python3
"""v8-447 · Mitschnitt der Garmin-Antworten EINER Aktivitaet je Sportart — nur fuer die
Entwicklung, lokal, read-only, sofort anonymisiert.

WOZU
Die Faehigkeits-Matrix (app/docs/GARMIN-CAPABILITY-MATRIX.md) kennt drei Belegstufen:
fixture / library / assumed. Im Repo liegt genau EIN echter Mitschnitt (ein Lauf, nur die
Detailantwort). Fast alle sportartspezifischen Feldnamen (Schwimmen, Rad-Leistung, Runden,
Zonen, Saetze) sind deshalb Annahmen. Dieses Skript macht aus Annahmen Belege.

WAS ES TUT
  1. meldet interaktiv bei Garmin an (E-Mail + Passwort + ggf. MFA im Terminal; nichts davon
     wird gespeichert, geloggt oder in eine Datei geschrieben — es gibt KEINE Token-Datei),
  2. liest die Aktivitaetsliste der letzten Tage und waehlt je Sportart die juengste
     Aktivitaet (oder genau die mit --activity-id),
  3. ruft fuer jede gewaehlte Aktivitaet read-only ab: Listeneintrag, get_activity,
     get_activity_details, Runden, Intervalle, HF-Zonen, Leistungszonen, Saetze,
  4. anonymisiert LOKAL (scripts/anonymize.py + strenge Nachpruefung, siehe unten),
  5. schreibt je Aktivitaet eine Datei nach tests/fixtures/garmin/captures/,
  6. druckt einen Bericht: erkannt / erhalten / nicht erhalten — nur FELDNAMEN.

WAS NIE IN DER DATEI STEHT
  Zugangsdaten, Tokens, E-Mail-Adresse, Namen (auch der Titel der Aktivitaet), Orte,
  Konto-, Profil-, Geraete- und Aktivitaetskennungen, das echte Datum.
  GPS: standardmaessig KEINE Koordinaten (Strecke geleert, Koordinatenspalten auf 0).
  Mit --with-gps bleibt die FORM der Strecke, auf den Ursprung 0/0 verschoben.
  Vor dem Schreiben prueft das Skript die Datei selbst (self_check) und bricht ab, wenn
  etwas davon noch auffindbar ist.

AUFRUF (aus garmin-worker/, in einer Umgebung mit Python ≥ 3.12 und garminconnect)
    python scripts/capture_activity_payloads.py                    # je Sportart die juengste, 120 Tage
    python scripts/capture_activity_payloads.py --sports swimming,cycling
    python scripts/capture_activity_payloads.py --activity-id 12345678901
    python scripts/capture_activity_payloads.py --dry-run          # nur Bericht, keine Datei

Hinweis: ein Passwort-Login bei Garmin ist der einzige Schritt mit Sperr-Risiko (429).
Einmal ausfuehren, nicht in Schleife. Wer gar nicht anmelden will: der Feldzensus per SQL
(Matrix, Abschnitt „Feldzensus") liefert die Feldnamen ohne jeden Login.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))

from anonymize import full_anon, summarize  # noqa: E402
from orvia_worker import garmin_fields as GF  # noqa: E402
from orvia_worker import normalize, series_normalize  # noqa: E402

OUT_DIR = HERE.parent / "tests" / "fixtures" / "garmin" / "captures"
CAPTURE_VERSION = 1

# Abrufe je Aktivitaet: name → (Methode der Bibliothek, Sportarten oder "*")
CALLS: list[tuple[str, str, tuple[str, ...]]] = [
    ("activity", "get_activity", ("*",)),
    ("details", "get_activity_details", ("*",)),
    ("splits", "get_activity_splits", ("*",)),
    ("typed_splits", "get_activity_typed_splits", ("*",)),
    ("split_summaries", "get_activity_split_summaries", ("*",)),
    ("hr_zones", "get_activity_hr_in_timezones", ("*",)),
    ("power_zones", "get_activity_power_in_timezones", ("cycling", "running")),
    ("exercise_sets", "get_activity_exercise_sets", ("gym",)),
]

_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}")
_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?)?$")
# Aufzaehlungswerte und Einheiten: GROSS_MIT_UNTERSTRICH, klein_mit_unterstrich oder camelCase
# (stepsPerMinute). Ein gross beginnendes Wort (Name, Ort) faellt NICHT darunter.
_ENUM = re.compile(r"^(?:[A-Z0-9]+(?:_[A-Z0-9]+)*|[a-z][A-Za-z0-9]*(?:_[a-z0-9]+)*)$")
_SPACE_TS = re.compile(r"^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)$")
PLACEHOLDER_IDS = (9999999999, 1111111111, 2222222222)


def _is_coord_key(key: str) -> bool:
    toks = GF._tokens(key)
    return any(t in ("lat", "lon", "lng", "latitude", "longitude") for t in toks)


# ---------------------------------------------------------------------------
# Strenge Nachbehandlung (nach anonymize.full_anon)
# ---------------------------------------------------------------------------

def strict_scrub(obj, with_gps: bool = False):
    """Zweite Stufe nach full_anon — arbeitet mit denselben Wort-Regeln wie der Worker
    (garmin_fields._is_private), damit im Mitschnitt nichts steht, was der Worker nie
    speichern wuerde, ausser der FORM:
      - Wert eines privaten Schluessels: Text → "REDACTED", Zahl → 0, Struktur → geleert
        (Schluesselnamen bleiben, sie sind die Information, die wir suchen)
      - Text mit '@' oder '://' irgendwo → "REDACTED"
      - freier Text (kein Aufzaehlungswert, kein Zeitstempel) → "REDACTED"
      - Koordinaten: ohne with_gps → 0.0
    """
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            key = str(k)
            if _is_coord_key(key) and isinstance(v, (int, float)) and not isinstance(v, bool):
                out[key] = v if with_gps else 0.0
                continue
            if key in ("activityId", "activityType", "startTimeGMT", "startTimeLocal") or key in GF.ID_ALLOWED:
                out[key] = strict_scrub(v, with_gps)
                continue
            if GF._is_private(key, v):
                if isinstance(v, str):
                    out[key] = "REDACTED"
                elif isinstance(v, bool) or v is None:
                    out[key] = v
                elif isinstance(v, (int, float)):
                    out[key] = 0
                elif isinstance(v, dict):
                    out[key] = {"_redacted_keys": sorted(str(x) for x in v.keys())[:40]}
                elif isinstance(v, list):
                    out[key] = {"_redacted_items": len(v)}
                else:
                    out[key] = None
                continue
            out[key] = strict_scrub(v, with_gps)
        return out
    if isinstance(obj, list):
        return [strict_scrub(x, with_gps) for x in obj]
    if isinstance(obj, str):
        s = obj.strip()
        if "@" in s or "://" in s:
            return "REDACTED"
        if _ISO.match(s) or (_ENUM.match(s) and len(s) <= 48):
            return obj
        return "REDACTED"
    return obj


def strip_gps(details):
    """Ohne --with-gps: Strecke und Koordinatenspalten der Detailantwort entfernen.
    Die Anzahl der Punkte bleibt als Zahl stehen (sie ist Strukturinformation)."""
    if not isinstance(details, dict):
        return details
    out = dict(details)
    geo = out.get("geoPolylineDTO")
    if isinstance(geo, dict):
        poly = geo.get("polyline")
        n = len(poly) if isinstance(poly, list) else 0
        first_keys = sorted(poly[0].keys()) if n and isinstance(poly[0], dict) else []
        out["geoPolylineDTO"] = {"polyline": [], "_removed_points": n, "_point_keys": first_keys}
    desc = {}
    for md in out.get("metricDescriptors") or []:
        if isinstance(md, dict) and "key" in md and "metricsIndex" in md:
            desc[md["key"]] = md["metricsIndex"]
    cols = [desc[k] for k in ("directLatitude", "directLongitude") if k in desc]
    if cols and isinstance(out.get("activityDetailMetrics"), list):
        rows = []
        for r in out["activityDetailMetrics"]:
            m = r.get("metrics") if isinstance(r, dict) else None
            if isinstance(m, list):
                m = [0.0 if (i in cols and v is not None) else v for i, v in enumerate(m)]
                rows.append({**r, "metrics": m})
            else:
                rows.append(r)
        out["activityDetailMetrics"] = rows
    return out


def _space_ts_to_t(obj):
    """'2026-07-12 08:30:00' → '2026-07-12T08:30:00'. anonymize.full_anon ersetzt ein Datum
    OHNE 'T' durch ein festes Datum und verliert dabei die Uhrzeit — damit waere der Abstand
    Ortszeit ↔ GMT (der UTC-Versatz, den der Worker bildet) im Mitschnitt nicht mehr pruefbar.
    Mit 'T' rueckt full_anon alle Zeitpunkte gemeinsam auf den neutralen Anker: das echte
    Datum verschwindet, die Abstaende bleiben."""
    if isinstance(obj, dict):
        return {k: _space_ts_to_t(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_space_ts_to_t(v) for v in obj]
    if isinstance(obj, str):
        m = _SPACE_TS.match(obj.strip())
        if m:
            return f"{m.group(1)}T{m.group(2)}"
    return obj


def anonymize_payload(payload: dict, with_gps: bool = False) -> dict:
    """Ein kompletter Mitschnitt (alle Abrufe einer Aktivitaet) → anonymisierte Form."""
    out = {}
    for name, raw in payload.items():
        if name.startswith("_"):
            out[name] = raw
            continue
        if isinstance(raw, dict) and set(raw.keys()) == {"error"}:
            out[name] = raw
            continue
        a = full_anon(_space_ts_to_t(json.loads(json.dumps(raw))))
        if name == "details" and not with_gps:
            a = strip_gps(a)
        out[name] = strict_scrub(a, with_gps)
    return out


def self_check(anon: dict, secrets=(), with_gps: bool = False) -> list[str]:
    """Letzte Pruefung vor dem Schreiben. Liefert eine Liste von Befunden (leer = sauber)."""
    problems: list[str] = []
    blob = json.dumps(anon, ensure_ascii=False)
    for s in secrets:
        if s and len(str(s)) >= 4 and str(s).lower() in blob.lower():
            problems.append("geheimer Wert im Mitschnitt gefunden")
    if _EMAIL.search(blob):
        problems.append("E-Mail-Adresse im Mitschnitt")
    if "://" in blob:
        problems.append("Adresse (URL) im Mitschnitt")

    def walk(o, path):
        if isinstance(o, dict):
            for k, v in o.items():
                key = str(k)
                if _is_coord_key(key) and isinstance(v, (int, float)) and not isinstance(v, bool):
                    if not with_gps and v != 0:
                        problems.append(f"Koordinate bei {path}.{key}")
                    if with_gps and abs(v) > 2:
                        problems.append(f"Koordinate nicht am Ursprung bei {path}.{key}")
                tk = GF._tokens(key)
                if tk and tk[-1] in GF.ID_TOKENS and key not in GF.ID_ALLOWED and isinstance(v, (int, float)) \
                        and not isinstance(v, bool) and v not in (0,) + PLACEHOLDER_IDS:
                    problems.append(f"Kennung bei {path}.{key}")
                walk(v, f"{path}.{key}")
        elif isinstance(o, list):
            for x in o[:2000]:
                walk(x, path + "[]")

    for name, part in anon.items():
        if not name.startswith("_"):
            walk(part, name)
    return sorted(set(problems))


# ---------------------------------------------------------------------------
# Bericht: erkannt / erhalten / nicht erhalten — nur Namen
# ---------------------------------------------------------------------------

def coverage_report(payload: dict) -> dict:
    """Was der Worker aus diesem Mitschnitt machen wuerde. Enthaelt nur Feldnamen und Zahlen."""
    rep: dict = {}
    entry = payload.get("list_entry")
    if isinstance(entry, dict):
        cov = GF.coverage(entry)
        rep["list_entry"] = {
            "known": cov["known"], "evidence": cov["evidence"], "measured_unnamed": cov["measured"],
            "structures_kept": cov["retained_structures"], "not_retained": GF.unretained_names(entry),
            "private_dropped": len(cov["private"]),
        }
        act = normalize.normalize_activity(entry)
        if act is not None:
            rep["sport"] = {"garmin_type": act.sport_raw, "orvia_sport": act.sport_id}
    summ = payload.get("activity")
    if isinstance(summ, dict):
        dto = summ.get("summaryDTO") if isinstance(summ.get("summaryDTO"), dict) else summ
        cov = GF.coverage(dto)
        rep["activity_summary"] = {"known": cov["known"], "measured_unnamed": cov["measured"],
                                   "not_retained": GF.unretained_names(dto), "top_level_keys": sorted(summ.keys())[:60]}
    det = payload.get("details")
    if isinstance(det, dict):
        keys = [m.get("key") for m in det.get("metricDescriptors") or [] if isinstance(m, dict)]
        units = {m.get("key"): (m.get("unit") or {}).get("key") for m in det.get("metricDescriptors") or [] if isinstance(m, dict)}
        parsed = series_normalize.parse_activity_details(det)
        rep["details"] = {
            "series_delivered": sorted(k for k in keys if isinstance(k, str)),
            "units": {k: units[k] for k in sorted(units) if isinstance(k, str)},
            "canonical_streams": sorted(parsed["streams"].keys()),
            "stream_meta": parsed["stream_meta"],
            "extra_series_kept": sorted(parsed["ext_series"].keys()),
            "series_not_kept": parsed["series_unparsed"],
            "durations": parsed["durations"], "sampling": parsed["sampling"],
            "top_level_keys": sorted(det.keys()),
        }
    for name in ("splits", "typed_splits", "split_summaries", "hr_zones", "power_zones", "exercise_sets"):
        raw = payload.get(name)
        if raw is None:
            continue
        if isinstance(raw, dict) and set(raw.keys()) == {"error"}:
            rep[name] = raw
            continue
        rep[name] = {"shape": summarize(raw)[:25], "kept_by_worker": summarize(GF.keep_structure(raw))[:25]}
    return rep


# ---------------------------------------------------------------------------
# Abruf
# ---------------------------------------------------------------------------

def _fail(msg: str) -> None:
    print(f"FEHLER: {msg}")
    sys.exit(1)


def _login():
    """Interaktiv; gibt (api, e_mail) zurueck — die E-Mail nur fuer den self_check."""
    import getpass
    try:
        from garminconnect import Garmin
    except ImportError:
        _fail("garminconnect fehlt. Umgebung mit Python ≥ 3.12 anlegen und "
              "'pip install -r requirements.txt' ausfuehren (siehe Matrix, Abschnitt Mitschnitt).")
    email = input("Garmin-E-Mail: ").strip()
    password = getpass.getpass("Garmin-Passwort (Eingabe bleibt unsichtbar): ")
    if not email or not password:
        _fail("E-Mail und Passwort sind erforderlich.")
    print("Melde bei Garmin an … (kann 15–60 s dauern)")
    try:
        api = Garmin(email=email, password=password, return_on_mfa=True)
        result = api.login()
    except Exception as e:  # noqa: BLE001
        _fail(f"Garmin-Login fehlgeschlagen ({type(e).__name__}). NICHT sofort wiederholen (Sperr-Risiko).")
    del password
    if (result[0] if isinstance(result, tuple) else None) == "needs_mfa":
        code = input("Garmin-MFA-Code (aus E-Mail/App): ").strip()
        try:
            api.client.resume_login(None, code)
        except Exception as e:  # noqa: BLE001
            _fail(f"MFA fehlgeschlagen ({type(e).__name__}).")
    return api, email


def pick_activities(entries: list, sports: tuple[str, ...] | None, activity_id: str | None) -> list[dict]:
    """Je ORVIA-Sportart der juengste Listeneintrag (die Liste kommt neueste-zuerst)."""
    if activity_id:
        hit = [e for e in entries if isinstance(e, dict) and str(e.get("activityId")) == str(activity_id)]
        return hit[:1]
    seen: dict[tuple[str, str], dict] = {}
    for e in entries:
        if not isinstance(e, dict):
            continue
        tk = ((e.get("activityType") or {}).get("typeKey") or "unknown")
        sport = normalize.map_sport(tk)
        if sports and sport not in sports:
            continue
        seen.setdefault((sport, tk), e)        # je Garmin-Typ einer: Bahn UND Freiwasser, Rolle UND Strasse
    return list(seen.values())


def fetch_payload(api, entry: dict) -> dict:
    aid = entry.get("activityId")
    sport = normalize.map_sport(((entry.get("activityType") or {}).get("typeKey") or ""))
    payload: dict = {"list_entry": entry}
    for name, method, only in CALLS:
        if "*" not in only and sport not in only:
            continue
        fn = getattr(api, method, None)
        if fn is None:
            payload[name] = {"error": "method_missing"}
            continue
        try:
            payload[name] = fn(aid)
        except Exception as e:  # noqa: BLE001 — ein Abruf darf den Mitschnitt nicht abbrechen
            payload[name] = {"error": type(e).__name__}
    return payload


def file_name(entry: dict) -> str:
    tk = ((entry.get("activityType") or {}).get("typeKey") or "unknown")
    tk = re.sub(r"[^a-z0-9_]+", "_", str(tk).lower())[:40] or "unknown"
    return f"{normalize.map_sport(tk)}__{tk}.json"


def main() -> int:
    ap = argparse.ArgumentParser(description="Anonymisierter Mitschnitt der Garmin-Antworten je Sportart.")
    ap.add_argument("--sports", default="", help="kommagetrennte ORVIA-Sportarten (Standard: alle gefundenen)")
    ap.add_argument("--activity-id", default=None, help="genau diese Aktivitaet")
    ap.add_argument("--days", type=int, default=120, help="so viele Tage zurueck suchen (Standard 120)")
    ap.add_argument("--with-gps", action="store_true", help="Streckenform behalten (auf 0/0 verschoben). Standard: keine Koordinaten")
    ap.add_argument("--dry-run", action="store_true", help="nur den Bericht drucken, keine Datei schreiben")
    ap.add_argument("--out-dir", default=str(OUT_DIR))
    args = ap.parse_args()
    sports = tuple(s.strip().lower() for s in args.sports.split(",") if s.strip()) or None

    api, email = _login()
    today = date.today()
    try:
        entries = api.get_activities_by_date((today - timedelta(days=args.days)).isoformat(), today.isoformat())
    except Exception as e:  # noqa: BLE001
        _fail(f"Aktivitaetsliste nicht lesbar ({type(e).__name__}).")
    picked = pick_activities(entries if isinstance(entries, list) else [], sports, args.activity_id)
    if not picked:
        _fail("Keine passende Aktivitaet gefunden (--days erhoehen oder --activity-id nutzen).")
    try:
        import garminconnect
        lib_version = getattr(garminconnect, "__version__", None)
    except Exception:  # noqa: BLE001
        lib_version = None

    out_dir = Path(args.out_dir)
    written = 0
    for entry in picked:
        name = file_name(entry)
        print(f"\n=== {name} ===")
        payload = fetch_payload(api, entry)
        anon = anonymize_payload(payload, with_gps=args.with_gps)
        anon["_meta"] = {"capture_version": CAPTURE_VERSION, "library": "garminconnect", "library_version": lib_version,
                         "gps": bool(args.with_gps), "calls": sorted(k for k in payload if not k.startswith("_"))}
        problems = self_check(anon, secrets=(email, email.split("@")[0]), with_gps=args.with_gps)
        report = coverage_report(anon)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        if problems:
            print("NICHT GESCHRIEBEN — die Selbstpruefung hat etwas gefunden:")
            for p in problems:
                print("  -", p)
            continue
        if args.dry_run:
            continue
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / name).write_text(json.dumps(anon, indent=1, ensure_ascii=False), encoding="utf-8")
        written += 1
        print(f"geschrieben: {out_dir / name}")
    print(f"\n{written} Datei(en) geschrieben. Bitte committen bzw. Claude zur Verfuegung stellen — "
          "danach traegt die Matrix fuer diese Sportarten die Belegstufe 'fixture'.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
