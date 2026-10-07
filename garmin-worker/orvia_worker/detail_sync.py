"""GM7.4 · Verdrahtung von Details-Backfill + Serien-Upsert in die Sync-Kette.

Bindet die reinen Bausteine (backfill_activity_details, series_normalize) an die
DB an. Leitplanken:
  * Aktivitätsdetails nur für noch NICHT detaillierte Aktivitäten (kein route in
    metrics) — bounded (`limit`), idempotent, Route/Streams verlustfrei in
    activities.metrics (jsonb) gemerged;
  * Serien idempotent nach user_metric_series (Dedupe user_id+metric_type+
    metric_date via ON_CONFLICT, Migration 0028);
  * fehlt user_metric_series (noch nicht migriert): KONTROLLIERTER Zustand
    (skipped) statt Endlosschleife/stillem Verlust;
  * Teilfehler brechen den übrigen Sync nicht ab (in backfill isoliert).
KEINE Engine-Berührung; kein Remote-Deploy.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

from .backfill import backfill_activity_details
from .series_normalize import (
    build_activity_metrics,
    build_series_rows,
    normalize_sleep_series,
    normalize_stress_series,
)

# Marker für "Tabelle fehlt" (PostgREST/Postgres) — fail-closed statt Loop.
_MISSING_TABLE_MARKERS = ("does not exist", "42P01", "PGRST205", "could not find the table")

# GM7.4.1 · Detailvollständigkeitsvertrag: aktuelle Version des Detail-Merge-
# Kontrakts. Erhöhen, falls sich Feldbedeutung/Parser-Semantik künftig ändert
# und Altbestand kontrolliert erneut angereichert werden soll.
DETAILS_CONTRACT_VERSION = 3

# v8-424 · Version 2 ergaenzt die Leistungs-Messreihe (directPower) und die Rad-
# Trittfrequenz. Kontrolliert erneut angereichert wird NUR, wo das neue Feld
# ueberhaupt vorkommen kann — Radaktivitaeten —, nicht die gesamte Historie
# (jede Nachladung ist ein Garmin-Abruf; begrenzt durch detail_backfill_limit).
_REENRICH_SPORTS_V2 = ("cycling",)

# v8-447 · Version 3: Schrittfrequenz statt Ein-Bein-Frequenz, Zeitachse, Bedeutung je
# Messreihe, einheitliche Ausduennung, Bewegungs-/verstrichene Zeit. Das betrifft JEDE
# Sportart — Zeitachse und Dauern fehlen ueberall, die Laufkadenz ist im Altbestand
# nicht sicher die Schrittfrequenz. Deshalb wird der gesamte Bestand einmal erneut
# geladen: neueste zuerst, hoechstens detail_backfill_limit je Lauf (Standard 10).
# Nachgeladen wird von Garmin — der gespeicherte Altwert wird nie umgerechnet.
_REENRICH_ALL_BELOW = 3

# Zusatzabrufe je Aktivitaet (Runden, Zonen, Saetze, volle Zusammenfassung). Jeder ist ein
# weiterer Garmin-Abruf und seine Antwortform ist im Repo NICHT belegt — deshalb sind sie
# standardmaessig AUS (Einstellung DETAIL_EXTRAS) und werden erst nach einem echten
# Mitschnitt je Sportart eingeschaltet (scripts/capture_activity_payloads.py).
#   name → Sportarten, fuer die der Abruf ueberhaupt sinnvoll ist ("*" = alle)
EXTRAS: dict[str, tuple[str, ...]] = {
    "activity": ("*",),            # get_activity: volle Zusammenfassung (summaryDTO)
    "splits": ("*",),              # get_activity_splits: Runden
    "typed_splits": ("swimming", "running", "cycling"),   # Intervalle / Bahnen
    "hr_zones": ("*",),            # get_activity_hr_in_timezones
    "power_zones": ("cycling", "running"),                # get_activity_power_in_timezones
    "exercise_sets": ("gym",),     # get_activity_exercise_sets
}

# Schluessel in activities.metrics, die der CLIENT fuehrt (Plan-Zuordnung,
# Dauerkorrektur). Der Worker liest die Zeile zu Beginn des Laufs und schreibt
# sie nach den Garmin-Abrufen zurueck — dazwischen kann der Client genau diese
# Felder gesetzt haben. Sie werden vor dem Schreiben frisch nachgelesen.
# v8-447: + "corrections" (Quelle / manuell / wirksam, App v8-445) — eine manuelle Korrektur
# darf durch das Zurueckschreiben der Details nie verloren gehen.
CLIENT_OWNED_METRIC_KEYS = ("plannedSessionId", "planLinkCorrection", "durationCorrection", "corrections")


def _details_complete(metrics: Any) -> bool:
    """GM7.4.1-Fix: Vollständigkeits-Signal NICHT mehr an metrics.route gekoppelt.
    Befund: `route`-Präsenz ist weder hinreichend noch notwendig für "Details
    bereits geladen" — (a) eine Indoor-/GPS-lose Garmin-Aktivität hat NIE eine
    Route, obwohl get_activity_details für sie bereits erfolgreich Streams
    geliefert haben kann (route-basiert hätte sie bei JEDEM Sync erneut
    abgerufen — Idempotenz-Bruch); (b) jede Aktivität, die aus irgendeinem
    Pfad außerhalb von get_activity_details bereits eine Route trägt (z.B. ein
    künftiger Direktschreibpfad), würde route-basiert fälschlich als fertig
    übersprungen — ihre HF-/Kadenz-/Höhen-Streams blieben für immer ungeladen.
    Stattdessen ein expliziter Abschluss-Marker, gesetzt NUR nach einem
    tatsächlich erfolgreichen get_activity_details-Merge für GENAU diese
    Aktivität — unabhängig vom Inhalt der Antwort (auch eine routenlose,
    streamlose Antwort zählt als "abgefragt")."""
    return isinstance(metrics, dict) and bool(metrics.get("detailsFetchedAt"))


def _neg_ts(started_at: Any) -> float:
    """Sortierschluessel „neueste zuerst"; unlesbares/fehlendes Datum ans Ende."""
    try:
        s = str(started_at).replace("Z", "+00:00").replace(" ", "T")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return -dt.timestamp()
    except (TypeError, ValueError):
        return float("inf")


# v8-447 · Dauerhaft fehlschlagende Aktivitaeten (bei Garmin geloescht, Antwort unlesbar)
# duerfen das Nachladen nicht blockieren: die Auswahl nimmt je Lauf die ersten `limit`
# Kandidaten — zehn Dauerfehler am Anfang haetten den ganzen uebrigen Bestand fuer immer
# ausgesperrt. Nach DETAIL_FAIL_MAX dauerhaften Fehlern wird eine Aktivitaet zurueckgestellt
# und nur noch alle DETAIL_FAIL_RETRY_DAYS Tage erneut versucht. Voruebergehende Fehler
# (Rate-Limit, Dienst nicht erreichbar) zaehlen NICHT. Ein Erfolg loescht den Zaehler.
DETAIL_FAIL_MAX = 3
DETAIL_FAIL_RETRY_DAYS = 7


def _parked(metrics: Any, now: datetime | None = None) -> bool:
    """True, wenn die Aktivitaet wegen wiederholter Dauerfehler gerade zurueckgestellt ist."""
    if not isinstance(metrics, dict):
        return False
    try:
        n = int(metrics.get("detailsFailCount") or 0)
    except (TypeError, ValueError):
        return False
    if n < DETAIL_FAIL_MAX:
        return False
    try:
        at = datetime.fromisoformat(str(metrics.get("detailsFailedAt")).replace("Z", "+00:00"))
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return False                       # ohne lesbaren Zeitpunkt lieber erneut versuchen
    now = now or datetime.now(timezone.utc)
    return (now - at).total_seconds() < DETAIL_FAIL_RETRY_DAYS * 86400


def _needs_details(act: Any) -> bool:
    """True, wenn fuer diese Aktivitaet (noch einmal) Details zu laden sind."""
    metrics = act.get("metrics") if isinstance(act, dict) else None
    if _parked(metrics):
        return False
    if not _details_complete(metrics):
        return True
    try:
        return int(metrics.get("detailsVersion") or 1) < _REENRICH_ALL_BELOW
    except (TypeError, ValueError):
        return True


def extras_for(sport_id: Any, enabled: Any) -> list[str]:
    """Welche der eingeschalteten Zusatzabrufe fuer diese Sportart gelten (feste Reihenfolge)."""
    on = [str(e).strip() for e in (enabled or ()) if str(e).strip()]
    return [name for name in EXTRAS if name in on and ("*" in EXTRAS[name] or sport_id in EXTRAS[name])]


def _slim_laps(raw: Any) -> list | None:
    """Runden in der Form, die die App schon liest (metrics.splits: distance + eine Dauer +
    averageHR). Nur echte Felder des Rohobjekts; passt die Antwort nicht, entsteht nichts."""
    cands = []
    if isinstance(raw, dict):
        for k in ("lapDTOs", "laps", "splits"):
            if isinstance(raw.get(k), list):
                cands.append(raw[k])
    elif isinstance(raw, list):
        cands.append(raw)
    keep = ("distance", "duration", "movingDuration", "elapsedDuration", "averageHR", "maxHR",
            "averageSpeed", "elevationGain", "lapIndex", "startTimeGMT")
    for lst in cands:
        out = []
        for lap in lst[:200]:
            if not isinstance(lap, dict):
                continue
            num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)  # noqa: E731
            if not num(lap.get("distance")) or not any(num(lap.get(d)) for d in ("duration", "movingDuration", "elapsedDuration")):
                continue
            out.append({k: lap[k] for k in keep if lap.get(k) is not None and not isinstance(lap[k], (dict, list))})
        if out:
            return out
    return None


def merge_extras(metrics: dict, sport_id: Any, fetched: dict) -> dict:
    """Antworten der Zusatzabrufe in metrics.ext ablegen: Form erhalten, nur Messwerte
    (garmin_fields.keep_structure). `fetched`: name → Rohantwort | None (None = fehlgeschlagen)."""
    from . import garmin_fields as GF
    ext = dict(metrics.get("ext")) if isinstance(metrics.get("ext"), dict) else {"v": GF.EXT_VERSION}
    got = dict(ext.get("extras")) if isinstance(ext.get("extras"), dict) else {}
    for name, raw in fetched.items():
        if raw is None:
            got[name] = "failed"
            continue
        if name == "activity" and isinstance(raw, dict):
            # volle Zusammenfassung: dieselbe Erlaubnisliste wie der Listeneintrag
            summ = raw.get("summaryDTO") if isinstance(raw.get("summaryDTO"), dict) else raw
            more = GF.retain_fields(summ)
            if more:
                fields = dict(ext.get("fields")) if isinstance(ext.get("fields"), dict) else {}
                for k, v in more.items():
                    fields.setdefault(k, v)          # der Listeneintrag bleibt fuehrend
                ext["fields"] = fields
            got[name] = "ok"
            continue
        kept = GF.keep_structure(raw)
        if kept in (None, {}, []):
            got[name] = "empty"
            continue
        ext[name] = kept
        got[name] = "ok"
        if name == "splits":
            laps = _slim_laps(raw)
            if laps:
                metrics["splits"] = laps
                metrics["splits_source"] = "garmin_splits"
    ext["extras"] = got
    metrics["ext"] = ext
    return metrics


# Schluessel, die der Herkunfts-Nachtrag setzen darf — und NUR, wenn sie noch fehlen.
_PROVENANCE_KEYS = ("garmin", "ext")


async def patch_provenance(db, user_id: str, acts: Any) -> dict:
    """v8-447 · Herkunftsblock fuer BEREITS importierte Aktivitaeten nachtragen.

    `acts`: normalisierte Listeneintraege (NormalizedActivity) — sie kommen aus demselben
    Listenabruf, den der Sync ohnehin macht; hier entsteht KEIN zusaetzlicher Garmin-Abruf.
    Regeln:
      * ergaenzt wird ausschliesslich metrics.garmin / metrics.ext, und nur wo sie fehlen —
        kein vorhandener Wert wird ersetzt, keine Messreihe, keine Korrektur beruehrt;
      * sport_id wird nur von 'other' auf die erkannte Sportart gehoben, und nur wenn die
        Zeile nachweislich wegen der damals fehlenden Zuordnung 'other' wurde
        (metrics.source_sport_raw == Garmin-Typ von heute). Eine vom Nutzer gewaehlte
        Sportart wird nie ueberschrieben;
      * jede Zeile fuer sich abgesichert — ein Fehler bricht nichts ab.
    """
    patched = 0
    upgraded = 0
    for act in acts or ():
        try:
            rid = getattr(act, "source_record_id", None)
            am = getattr(act, "metrics", None)
            if not rid or not isinstance(am, dict) or not isinstance(am.get("garmin"), dict):
                continue
            flt = {"user_id": user_id, "source": "garmin", "source_record_id": rid}
            rows = await db.select("activities", flt, limit=1)
            if not rows:
                continue
            row = rows[0]
            cur = row.get("metrics") if isinstance(row.get("metrics"), dict) else {}
            patch: dict[str, Any] = {}
            merged = dict(cur)
            # Das Nachladen der Details kann beide Bloecke schon angelegt haben (garmin: Dauern,
            # Abtastung · ext: Zusatzreihen), bevor der Listeneintrag sie fuellt. Deshalb je
            # Block: fehlt er, wird er uebernommen; ist er da, werden nur die FEHLENDEN
            # Schluessel ergaenzt. Ein vorhandener Wert wird nie ersetzt.
            for k in _PROVENANCE_KEYS:
                if not isinstance(am.get(k), dict):
                    continue
                if isinstance(cur.get(k), dict):
                    block = dict(cur[k])
                    for kk, vv in am[k].items():
                        block.setdefault(kk, vv)
                    merged[k] = block
                elif k not in cur:
                    merged[k] = am[k]
            if merged != cur:
                patch["metrics"] = merged
            new_sport = getattr(act, "sport_id", None)
            type_key = (am.get("garmin") or {}).get("type_key")
            if (row.get("sport_id") == "other" and new_sport and new_sport != "other"
                    and type_key and cur.get("source_sport_raw") == type_key):
                patch["sport_id"] = new_sport
                upgraded += 1
            if patch:
                await db.update("activities", flt, patch)
                patched += 1
        except Exception:  # noqa: BLE001 — Nachtrag darf den Sync nie abbrechen
            continue
    return {"patched": patched, "sport_upgraded": upgraded}


async def sync_activity_details(
    db, user_id: str, get_details: Callable[[str], Any], *, limit: int, max_retries: int = 2,
    on_rate_limit: Callable[[int], None] | None = None,
    get_extra: Callable[[str, str], Any] | None = None, extras: Any = None,
) -> dict:
    """Bounded, idempotenter Details-Backfill: nur Aktivitäten OHNE metrics.route
    werden detailliert; Ergebnis verlustfrei in activities.metrics gemerged."""
    acts = await db.select("activities", {"user_id": user_id, "source": "garmin"})
    # v8-424b · Reihenfolge der Auswahl (vorher: Tabellenreihenfolge, also die aeltesten
    # zuerst). Mit dem einmaligen Nachladen der Radeinheiten haette eine FRISCHE
    # Aktivitaet hinter dem ganzen Rueckstand gewartet — Route und Messreihen des
    # heutigen Trainings kaemen erst nach mehreren Laeufen. Deshalb:
    #   1. nie detaillierte vor nachzuladenden,
    #   2. innerhalb jeder Gruppe die neuesten zuerst.
    def _prio(a: Any) -> tuple:
        fresh = 0 if not _details_complete(a.get("metrics")) else 1
        return (fresh, _neg_ts(a.get("started_at")))
    acts = sorted(acts, key=_prio)
    candidates = [a.get("source_record_id") for a in acts if a.get("source_record_id")]
    already = [a["source_record_id"] for a in acts
               if a.get("source_record_id") and not _needs_details(a)]
    by_id = {a.get("source_record_id"): a for a in acts}

    plan = backfill_activity_details(
        candidates, already, get_details, limit=limit, max_retries=max_retries,
        on_rate_limit=on_rate_limit,
    )
    updated = 0
    extras_count = 0
    for aid, parsed in plan["details"].items():
        act = by_id.get(aid) or {}
        merged = build_activity_metrics(act.get("metrics"), parsed)
        # GM7.4.1: Abschluss-Marker NUR nach einem tatsächlich erfolgreichen,
        # gemergten Abruf setzen — nie bei einem Fehlschlag (siehe `failed`).
        merged["detailsFetchedAt"] = datetime.now(timezone.utc).isoformat()
        merged["detailsVersion"] = DETAILS_CONTRACT_VERSION
        merged.pop("detailsFailCount", None)        # Erfolg: Fehlerzaehler weg
        merged.pop("detailsFailedAt", None)
        # v8-447 · Zusatzabrufe (nur wenn eingeschaltet). Jeder fuer sich abgesichert: ein
        # Fehler markiert genau diesen Abruf als "failed" und bricht nichts ab.
        if get_extra is not None:
            fetched: dict[str, Any] = {}
            for name in extras_for(act.get("sport_id"), extras):
                try:
                    fetched[name] = get_extra(name, aid)
                except Exception:  # noqa: BLE001 — Zusatzdaten duerfen den Sync nie abbrechen
                    fetched[name] = None
            if fetched:
                merged = merge_extras(merged, act.get("sport_id"), fetched)
                extras_count += sum(1 for v in fetched.values() if v is not None)
        # v8-424: clientgefuehrte Felder frisch nachlesen (siehe CLIENT_OWNED_METRIC_KEYS).
        # Schlaegt das Nachlesen fehl, bleibt der zu Laufbeginn gelesene Stand — der
        # Sync bricht deshalb nie ab.
        try:
            fresh = await db.select(
                "activities",
                {"user_id": user_id, "source": "garmin", "source_record_id": aid},
            )
            fm = (fresh[0].get("metrics") if fresh else None) or {}
            if isinstance(fm, dict):
                for k in CLIENT_OWNED_METRIC_KEYS:
                    if k in fm:
                        merged[k] = fm[k]
                    else:
                        merged.pop(k, None)
        except Exception:
            pass
        await db.update(
            "activities",
            {"user_id": user_id, "source": "garmin", "source_record_id": aid},
            {"metrics": merged},
        )
        updated += 1
    # Dauerfehler vermerken (nur Zaehler + Zeitpunkt; alle uebrigen Felder der Zeile bleiben,
    # frisch gelesen — der Client kann inzwischen geschrieben haben).
    transient = set(plan.get("failed_transient") or ())
    for aid in plan["failed"]:
        if aid in transient:
            continue
        try:
            flt = {"user_id": user_id, "source": "garmin", "source_record_id": aid}
            fresh = await db.select("activities", flt)
            if not fresh:
                continue
            fm = dict(fresh[0].get("metrics")) if isinstance(fresh[0].get("metrics"), dict) else {}
            try:
                n = int(fm.get("detailsFailCount") or 0)
            except (TypeError, ValueError):
                n = 0
            fm["detailsFailCount"] = n + 1
            fm["detailsFailedAt"] = datetime.now(timezone.utc).isoformat()
            await db.update("activities", flt, {"metrics": fm})
        except Exception:  # noqa: BLE001 — Buchfuehrung darf den Sync nie abbrechen
            continue
    return {"selected": plan["selected"], "updated": updated, "failed": plan["failed"], "extras": extras_count}


async def sync_day_series(
    db, user_id: str, provider_id, metric_date: str, timezone: str,
    *, sleep_raw: Any = None, stress_raw: Any = None,
) -> dict:
    """Normalisiert Schlaf-/Stress-Rohantworten zu Serien und upsertet sie
    idempotent nach user_metric_series. Fehlt die Tabelle: kontrolliert skipped."""
    rows: list[dict] = []
    if isinstance(sleep_raw, dict):
        rows += build_series_rows(user_id, provider_id, metric_date, timezone,
                                  normalize_sleep_series(sleep_raw))
    if isinstance(stress_raw, dict):
        rows += build_series_rows(user_id, provider_id, metric_date, timezone,
                                  normalize_stress_series(stress_raw))
    if not rows:
        return {"upserted": 0, "series": 0}
    try:
        await db.upsert("user_metric_series", rows, on_conflict="user_id,metric_type,metric_date")
    except Exception as e:  # noqa: BLE001 — gezielt auf "Tabelle fehlt" prüfen
        msg = str(e).lower()
        if any(m in msg for m in _MISSING_TABLE_MARKERS):
            return {"upserted": 0, "series": len(rows), "skipped": "user_metric_series_missing"}
        raise
    return {"upserted": len(rows), "series": len(rows)}
