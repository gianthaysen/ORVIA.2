"""v8-447.3 · Garmin-Herkunft: Status, verlustfreies Zusammenfuehren, Metadaten-Backfill.

Befund (v8-447.3, am Code und am Produktions-Zensus nachgewiesen):
  * Typ und Startzeiten stehen NUR im Listeneintrag (get_activities_by_date). Die Detailantwort
    (activityId, measurementCount, metricsCount, totalMetricsCount, metricDescriptors,
    activityDetailMetrics, geoPolylineDTO, heartRateDTOs, pendingData, detailsAvailable) traegt
    weder Typ noch Startzeit.
  * Bis v8-446 schrieb der Import keinen Herkunftsblock (nur source_sport_raw fuer 'other').
  * Das Nachladen der Details (v8-447, unabhaengig vom Sync-Fenster, alle Zeilen) legte
    metrics.garmin mit Dauern und Abtastung an — ohne Typ und Zeit.
  * Der Herkunfts-Nachtrag sieht nur Listeneintraege des Sync-Fensters; das ist im Dauerbetrieb
    [gestern, heute]. Der weite Rueckblick (ACTIVITY_PROVENANCE_BACKFILL_DAYS) ist standardmaessig 0.
  → Zeilen, die vor v8-447 importiert wurden, bekamen den Block nie vollstaendig.

Datenmodell — KEIN zweiter Block. Alles bleibt in metrics.garmin (klein, auf jedem Geraet):
  type_key        Garmins Aktivitaetstyp (activityType.typeKey), z. B. virtual_ride, lap_swimming
  parent_type_id  Garmins uebergeordneter Typ als Zahl (activityType.parentTypeId), roh
  start_gmt       Startzeit UTC laut Garmin (startTimeGMT)
  start_local     Wandzeit am Ort laut Garmin (startTimeLocal)
  utc_offset_s    aus GENAU diesen beiden gebildet (Sommer-/Winterzeit steckt darin)
  v               Version der Normalisierung (garmin_fields.EXT_VERSION)
  prov_status     complete | partial | unavailable | inconsistent (zuletzt gepruefter Stand)
  prov_checked_at wann der Backfill die Zeile zuletzt gegen die Liste geprueft hat
  prov_unavailable  Schluessel, die Garmin beim Pruefen NICHT geliefert hat
  prov_not_listed   true: die Liste fuer diesen Tag enthielt die Aktivitaet nicht
  prov_conflicts  Schluessel, bei denen Liste und Zeile sich widersprechen (nichts ersetzt)
  prov_backfill   {at, garmin:[…], ext:[…], ext_created?} — was der Backfill ergaenzt hat (Rueckweg)
  prov_block_created  true: metrics.garmin gab es vorher nicht (Rueckweg entfernt den leeren Block)
Einen eigenen Garmin-„Subtyp" gibt es im Listeneintrag nicht: typeKey IST der konkrete Typ
(virtual_ride unter cycling). Es wird keiner erfunden. Kanonische Sportart = activities.sport_id.
Quelle = activities.source.

Rein bis auf `backfill` (DB + ein Listenabruf je Zeitfenster). Keine Rohwerte, keine Kennungen
in Protokollen.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable

logger = logging.getLogger("orvia.provenance")

# Was eine VOLLSTAENDIGE Herkunft ausmacht. parent_type_id ist hilfreich, aber nicht Pflicht.
REQUIRED = ("type_key", "start_gmt", "start_local", "utc_offset_s")
# Schluessel, die aus dem Listeneintrag in metrics.garmin kommen (nie ersetzt, nur ergaenzt).
LIST_KEYS = ("type_key", "parent_type_id", "start_gmt", "start_local", "utc_offset_s", "v")
# Teile von metrics.ext, die aus dem Listeneintrag stammen (Rohfelder). Messreihen der
# Detailantwort (series, unrecognized_series …) kommen NICHT von hier.
LIST_EXT_KEYS = ("fields", "unrecognized", "rejected", "structures")
MARKERS = ("prov_status", "prov_checked_at", "prov_unavailable", "prov_not_listed",
           "prov_conflicts", "prov_backfill", "prov_block_created")
STATUSES = ("complete", "partial", "unavailable", "inconsistent")
START_TOLERANCE_S = 120          # Liste vs. activities.started_at
WINDOW_GAP_DAYS = 7              # Tage zwischen Zeilen, bis ein neues Abfragefenster beginnt
WINDOW_MAX_DAYS = 120            # laengstes Fenster je Listenabruf
MAX_WINDOWS_PER_RUN = 6          # Listenabrufe je Lauf (Rest im naechsten Lauf)
MODES = ("off", "dry", "apply")


def _obj(v: Any) -> dict:
    return v if isinstance(v, dict) else {}


def _present(v: Any) -> bool:
    return v is not None and not (isinstance(v, str) and not v.strip())


def _parse_utc(value: Any) -> datetime | None:
    """activities.started_at (Garmins GMT-Text, teils ohne Zone) oder start_gmt → aware UTC."""
    if not isinstance(value, str) or not value.strip():
        return None
    s = value.strip().replace(" ", "T").replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def status(metrics: Any) -> dict:
    """Herkunftsstatus einer Zeile — rein, aus dem gespeicherten Stand.

    complete      alle REQUIRED vorhanden, kein Widerspruch
    inconsistent  ein Widerspruch ist vermerkt (prov_conflicts)
    unavailable   was fehlt, hat Garmin beim Pruefen nachweislich nicht geliefert
    partial       es fehlt etwas, das noch nicht geprueft ist (auch: kein Block)
    """
    m = _obj(metrics)
    g = _obj(m.get("garmin"))
    missing = [k for k in REQUIRED if not _present(g.get(k))]
    conflicts = [k for k in (g.get("prov_conflicts") or []) if isinstance(k, str)]
    unavailable = [k for k in (g.get("prov_unavailable") or []) if isinstance(k, str)]
    if conflicts:
        st = "inconsistent"
    elif not missing:
        st = "complete"
    elif all(k in unavailable for k in missing):
        st = "unavailable"
    else:
        st = "partial"
    return {"status": st, "missing": missing, "unavailable": unavailable, "conflicts": conflicts,
            "has_block": bool(g), "not_listed": g.get("prov_not_listed") is True}


def gap_kind(metrics: Any) -> str | None:
    """Zensus-Kategorie der Luecke: None (vollstaendig) | ohne_typ_und_utc | ohne_typ | ohne_utc |
    ohne_ortszeit (Typ und UTC da, Ortszeit/Versatz fehlen)."""
    g = _obj(_obj(metrics).get("garmin"))
    t, u = _present(g.get("type_key")), _present(g.get("start_gmt"))
    if not t and not u:
        return "ohne_typ_und_utc"
    if not t:
        return "ohne_typ"
    if not u:
        return "ohne_utc"
    if not (_present(g.get("start_local")) and _present(g.get("utc_offset_s"))):
        return "ohne_ortszeit"
    return None


def needs_backfill(metrics: Any) -> bool:
    """Nur 'partial' ist ein Kandidat. 'unavailable' und 'inconsistent' sind Endzustaende — sie
    loesen keinen weiteren Abruf aus (sonst fragte jeder Lauf erneut nach einer geloeschten
    Aktivitaet)."""
    return status(metrics)["status"] == "partial"


def merge(cur_metrics: Any, list_metrics: Any, *, started_at: Any = None, now: str | None = None,
          listed: bool = True) -> tuple[dict, dict]:
    """Ergaenzt fehlende Herkunft aus dem Listeneintrag. Rein, veraendert die Eingaben nicht.

    Regeln: nur FEHLENDE Schluessel werden gesetzt; ein vorhandener, abweichender Wert bleibt und
    wird als Widerspruch vermerkt; ausserhalb von metrics.garmin / metrics.ext wird nichts
    beruehrt (corrections, plannedSessionId, streams, best_efforts, summary, sport_id, started_at).
    Rueckgabe: (neue metrics, Bericht {added_garmin, added_ext, conflicts, unavailable, changed}).
    """
    cur = dict(_obj(cur_metrics))
    lm = _obj(list_metrics)
    lg, lext = _obj(lm.get("garmin")), _obj(lm.get("ext"))
    block_created = not isinstance(cur.get("garmin"), dict)
    g = dict(_obj(cur.get("garmin")))
    if block_created:
        g["prov_block_created"] = True
    now = now or datetime.now(timezone.utc).isoformat()
    before = dict(g)
    added_g: list[str] = []
    conflicts: list[str] = list(g.get("prov_conflicts") or [])

    if listed:
        for k in LIST_KEYS:
            if k not in lg or not _present(lg.get(k)):
                continue
            if not _present(g.get(k)):
                g[k] = lg[k]
                added_g.append(k)
            elif k != "v" and g[k] != lg[k] and k not in conflicts:
                conflicts.append(k)                               # nichts ersetzen — nur vermerken
        # beide Zeiten geliefert, aber kein plausibler Versatz (time_provenance verwirft ihn) → Widerspruch
        if _present(lg.get("start_gmt")) and _present(lg.get("start_local")) and not _present(lg.get("utc_offset_s")) \
                and "utc_offset_s" not in conflicts and not _present(g.get("utc_offset_s")):
            conflicts.append("utc_offset_s")
        # Startzeit der Zeile (activities.started_at) gegen Garmins UTC-Zeit — nie korrigiert
        a, b = _parse_utc(started_at), _parse_utc(lg.get("start_gmt"))
        if a is not None and b is not None and abs((a - b).total_seconds()) > START_TOLERANCE_S \
                and "started_at" not in conflicts:
            conflicts.append("started_at")

    ext_existed = isinstance(cur.get("ext"), dict)
    ext = dict(_obj(cur.get("ext")))
    added_ext: list[str] = []
    if listed and lext:
        for kk in LIST_EXT_KEYS:
            if kk in lext and kk not in ext:
                ext[kk] = lext[kk]
                added_ext.append(kk)
        if added_ext and not ext_existed:
            ext = {"v": lext.get("v", 1), **ext}

    missing_after = [k for k in REQUIRED if not _present(g.get(k))]
    unavailable = sorted(set(missing_after) - set(conflicts))
    if unavailable:
        g["prov_unavailable"] = unavailable
    else:
        g.pop("prov_unavailable", None)
    if not listed:
        g["prov_not_listed"] = True
    else:
        g.pop("prov_not_listed", None)
    if conflicts:
        g["prov_conflicts"] = sorted(set(conflicts))
    if added_g or added_ext:
        prev = _obj(g.get("prov_backfill"))
        g["prov_backfill"] = {"at": now,
                              "garmin": sorted(set(list(prev.get("garmin") or []) + added_g)),
                              "ext": sorted(set(list(prev.get("ext") or []) + added_ext))}
        if (added_ext and not ext_existed) or prev.get("ext_created"):
            g["prov_backfill"]["ext_created"] = True
    out = dict(cur)
    out["garmin"] = g
    if ext_existed or added_ext:
        out["ext"] = ext
    st = status(out)["status"]
    g["prov_status"] = st
    # Pruefzeit nur, wenn sich sonst etwas aendert — ein unveraenderter zweiter Lauf schreibt nichts.
    meaningful = bool(added_g or added_ext) or any(
        before.get(k) != g.get(k) for k in ("prov_status", "prov_unavailable", "prov_conflicts", "prov_not_listed"))
    if meaningful:
        g["prov_checked_at"] = now
    report = {"added_garmin": added_g, "added_ext": added_ext, "conflicts": sorted(set(conflicts)),
              "unavailable": unavailable, "status": st, "changed": meaningful}
    return out, report


def carry_forward(merged: dict, fresh: Any) -> dict:
    """Fuer Schreibpfade, die metrics als Ganzes ersetzen (Nachladen der Details): Herkunft, die
    INZWISCHEN in der Zeile steht (anderer Lauf, Backfill), bleibt erhalten. Nur Ergaenzung."""
    f = _obj(fresh)
    fg, fext = _obj(f.get("garmin")), _obj(f.get("ext"))
    if fg:
        g = dict(_obj(merged.get("garmin")))
        for k in LIST_KEYS + MARKERS:
            if k in fg and k not in g:
                g[k] = fg[k]
        merged["garmin"] = g
    if fext:
        ext = dict(_obj(merged.get("ext")))
        if ext or any(k in fext for k in LIST_EXT_KEYS):
            ext.setdefault("v", fext.get("v", 1))
            for k in LIST_EXT_KEYS:
                if k in fext and k not in ext:
                    ext[k] = fext[k]
            merged["ext"] = ext
    return merged


def windows(dates: list[date], *, gap_days: int = WINDOW_GAP_DAYS, max_days: int = WINDOW_MAX_DAYS) -> list[tuple[date, date]]:
    """Startdaten → wenige Abfragefenster [erster−1, letzter+1] (Garmin filtert nach ORTSdatum,
    die Zeile traegt UTC: ±1 Tag deckt jede Zone). Ein neues Fenster beginnt, wenn zwischen zwei
    Tagen mehr als `gap_days` liegen oder das Fenster laenger als `max_days` wuerde. Neueste zuerst."""
    ds = sorted(set(d for d in dates if isinstance(d, date)))
    out: list[tuple[date, date]] = []
    last: date | None = None
    for d in ds:
        if out and last is not None and (d - last).days <= gap_days and (d - out[-1][0]).days <= max_days:
            out[-1] = (out[-1][0], d + timedelta(days=1))
        else:
            out.append((d - timedelta(days=1), d + timedelta(days=1)))
        last = d
    return list(reversed(out))


def _category(exc: BaseException) -> str:
    from .backfill import classify_failure
    return classify_failure(exc)


async def backfill(db, user_id: str, list_fn: Callable[[str, str], list], *, mode: str = "dry",
                   max_windows: int = MAX_WINDOWS_PER_RUN, now: str | None = None) -> dict:
    """Metadaten-Backfill: ergaenzt fehlende Herkunft aus der Garmin-LISTE. Keine Detailabrufe.

    mode  'dry'   nur zaehlen, nichts schreiben
          'apply' schreiben (je Zeile frisch gelesen, nur garmin/ext ergaenzt)
    Idempotent: Kandidaten sind nur Zeilen mit Status 'partial'. Fortsetzbar: hoechstens
    `max_windows` Listenabrufe je Lauf; der Rest bleibt 'partial' fuer den naechsten Lauf.
    AUTH / RATE_LIMIT beenden den Lauf sofort (aborted), nichts wird einer Zeile angelastet.
    """
    if mode not in ("dry", "apply"):
        return {"mode": "off"}
    now = now or datetime.now(timezone.utc).isoformat()
    rows = await db.select("activities", {"user_id": user_id, "source": "garmin"})
    cands = [r for r in rows if r.get("source_record_id") and needs_backfill(r.get("metrics"))]
    res: dict[str, Any] = {"mode": mode, "candidates": len(cands), "windows": 0, "list_calls": 0,
                           "changed": 0, "added_type": 0, "added_utc": 0, "added_local": 0, "added_fields": 0,
                           "unavailable": 0, "not_listed": 0, "inconsistent": 0, "complete_after": 0,
                           "no_date": 0, "remaining": 0, "aborted": None, "errors": 0}
    if not cands:
        return res
    by_day: dict[date, list[dict]] = {}
    for r in cands:
        t = _parse_utc(r.get("started_at"))
        if t is None:
            res["no_date"] += 1
            continue
        by_day.setdefault(t.date(), []).append(r)
    wins = windows(list(by_day))
    for i, (a, b) in enumerate(wins):
        if i >= max_windows:
            res["remaining"] += sum(len(v) for d, v in by_day.items() if a <= d <= b)
            continue
        try:
            entries = list_fn(a.isoformat(), b.isoformat())
        except Exception as e:  # noqa: BLE001 — Taxonomie entscheidet
            cat = _category(e)
            res["errors"] += 1
            if cat in ("AUTH", "RATE_LIMIT"):
                res["aborted"] = cat
                res["remaining"] += sum(len(v) for d, v in by_day.items()
                                        if any(w[0] <= d <= w[1] for w in wins[i:]))
                logger.warning("provenance backfill aborted category=%s window=%s/%s", cat, i + 1, len(wins))
                break
            logger.warning("provenance backfill window=%s/%s status=failed category=%s", i + 1, len(wins), cat)
            res["remaining"] += sum(len(v) for d, v in by_day.items() if a <= d <= b)
            continue
        res["windows"] += 1
        res["list_calls"] += 1
        listed = {}
        for e in entries or ():
            rid = getattr(e, "source_record_id", None)
            if rid:
                listed[str(rid)] = _obj(getattr(e, "metrics", None))
        for d, rs in by_day.items():
            if not (a <= d <= b):
                continue
            for r in rs:
                rid = str(r.get("source_record_id"))
                lm = listed.get(rid)
                flt = {"user_id": user_id, "source": "garmin", "source_record_id": r.get("source_record_id")}
                base = r.get("metrics")
                if mode == "apply":
                    try:
                        fresh = await db.select("activities", flt, limit=1)
                        if not fresh:
                            continue
                        base = fresh[0].get("metrics")
                        if not needs_backfill(base):          # inzwischen erledigt (anderer Lauf)
                            continue
                        r = fresh[0]
                    except Exception:  # noqa: BLE001
                        res["errors"] += 1
                        continue
                new, rep = merge(base, lm or {}, started_at=r.get("started_at"), now=now, listed=lm is not None)
                if lm is None:
                    res["not_listed"] += 1
                res["added_type"] += int("type_key" in rep["added_garmin"])
                res["added_utc"] += int("start_gmt" in rep["added_garmin"])
                res["added_local"] += int("start_local" in rep["added_garmin"] or "utc_offset_s" in rep["added_garmin"])
                res["added_fields"] += int("fields" in rep["added_ext"])
                res[{"complete": "complete_after", "unavailable": "unavailable",
                     "inconsistent": "inconsistent"}.get(rep["status"], "remaining")] += 1
                if not rep["changed"]:
                    continue
                res["changed"] += 1
                if mode == "apply":
                    try:
                        await db.update("activities", flt, {"metrics": new})
                    except Exception:  # noqa: BLE001 — Speichern gescheitert: naechster Lauf
                        res["errors"] += 1
                        res["changed"] -= 1
    logger.info("provenance backfill mode=%s candidates=%s windows=%s lists=%s changed=%s type=%s utc=%s "
                "local=%s fields=%s complete=%s unavailable=%s not_listed=%s inconsistent=%s remaining=%s aborted=%s",
                mode, res["candidates"], res["windows"], res["list_calls"], res["changed"], res["added_type"],
                res["added_utc"], res["added_local"], res["added_fields"], res["complete_after"], res["unavailable"],
                res["not_listed"], res["inconsistent"], res["remaining"], res["aborted"] or "-")
    return res


def summary_line(res: dict) -> str:
    """Kurzform fuer result['steps'] — nur Zahlen."""
    if not res or res.get("mode") == "off":
        return "off"
    parts = [f"{res['mode']}", f"candidates:{res['candidates']}"]
    for k in ("list_calls", "changed", "added_type", "added_utc", "added_local", "added_fields", "complete_after",
              "unavailable", "not_listed", "inconsistent", "remaining", "no_date", "errors"):
        if res.get(k):
            parts.append(f"{k}:{res[k]}")
    if res.get("aborted"):
        parts.append(f"aborted:{res['aborted']}")
    return " ".join(parts)
