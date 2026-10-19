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

import asyncio
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from .backfill import ACTIVITY_SPECIFIC, FAILURE_CATEGORIES, backfill_activity_details
from .best_efforts import DISTANCE_SPORTS
from .series_normalize import (
    build_activity_metrics,
    build_series_rows,
    normalize_sleep_series,
    normalize_stress_series,
)

logger = logging.getLogger("orvia.details")

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
#
# v8-447.1 · Abruf-Regel: ein Zusatzabruf wird nur gemacht, wenn er fuer GENAU diese
# Aktivitaet etwas liefern kann — jeder Abruf an der inoffiziellen Schnittstelle kostet.
#   Runden          nur Sportarten mit Strecke oder Bahnen
#   Intervalle      Lauf/Rad; Schwimmen nur im Becken (Garmin-Typ lap_swimming)
#   HF-Zonen        nur wenn die Aufzeichnung eine Herzfrequenz-Reihe hat
#   Leistungszonen  nur Rad UND nur wenn die Aufzeichnung eine Leistungs-Reihe hat
#   Saetze          nur Kraft
LAP_SPORTS = ("running", "cycling", "swimming", "rowing", "hiking", "walking", "triathlon", "athletics", "hyrox")
EXTRAS: dict[str, tuple[str, ...]] = {
    "activity": ("*",),            # get_activity: volle Zusammenfassung (summaryDTO)
    "splits": LAP_SPORTS,          # get_activity_splits: Runden
    # v8-454: Intervalle (typedsplits) NUR Laufen — Mitschnitt 19.10.2026: Laufen liefert dort Garmin-Workout-Schritte
    # (INTERVAL_*, mit lapIndexes) und Lauf/Geh/Steh-Abschnitte (RWD_*); Becken und Freiwasser liefern leer, Rad nur
    # Untergrund-Abschnitte (SURFACE_TYPE_*). Bahnen stecken in der Rundenantwort (splits).
    "typed_splits": ("running",),
    "hr_zones": ("*",),            # get_activity_hr_in_timezones
    "power_zones": ("cycling",),   # get_activity_power_in_timezones
    "exercise_sets": ("gym",),     # get_activity_exercise_sets
}
# Zusatzbedingungen je Abruf (alle muessen gelten):
#   stream     diese Messreihe muss in der Detailantwort vorkommen
#   type_keys  {sportart: (garmin-typen …)} — fuer diese Sportart nur bei diesen Garmin-Typen
EXTRA_CONDITIONS: dict[str, dict] = {
    "hr_zones": {"stream": "heart_rate"},
    "power_zones": {"stream": "power"},
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


def _details_maxchart(metrics: Any) -> int:
    """Mit welchem maxChartSize die gespeicherten Details geladen wurden (0 = Standard der
    Bibliothek / vor v8-447.1 — damals nicht vermerkt)."""
    try:
        return int((metrics or {}).get("detailsMaxchart") or 0)
    except (TypeError, ValueError, AttributeError):
        return 0


def _needs_resolution_refetch(metrics: Any, refetch_maxchart: int) -> bool:
    """v8-447.1 · Gezielter erneuter Abruf einer Aktivitaet, die schon auf dem aktuellen Vertrag
    steht, aber mit kleinerem maxChartSize geladen wurde. Nur wenn ausdruecklich eingeschaltet
    (refetch_maxchart > 0). Bestwerte, Kennwerte und Bedeutungspruefung werden dabei aus der
    vollstaendigen Antwort neu gerechnet; die Anzeige-Reihen bleiben gleich gross."""
    if refetch_maxchart <= 0 or not isinstance(metrics, dict):
        return False
    return _details_maxchart(metrics) < refetch_maxchart


def _needs_semantics(metrics: Any) -> bool:
    """v8-447.3 · Details aktuell, Rohfelder des Listeneintrags vorhanden (metrics.ext.fields), aber
    die Bedeutungspruefung lief nie (Marker detailsSemantics fehlt) — z. B. weil die Rohfelder erst
    durch den Metadaten-Backfill in die Zeile kamen. Die Pruefung braucht ALLE Messzeilen, die nur
    die Detailantwort liefert; deshalb ist hier ein erneuter Abruf noetig."""
    if not isinstance(metrics, dict) or metrics.get("detailsSemantics") is not None:
        return False
    ext = metrics.get("ext")
    return isinstance(ext, dict) and isinstance(ext.get("fields"), dict) and bool(ext.get("fields"))


def _needs_active(act: Any) -> bool:
    """v8-449.1 · Details aktuell, Strecken-Bestwerte (verstrichene Zeit) vorhanden, aber noch kein Befund zur
    AKTIVEN Zeit (best_efforts.distance_active) — die Timer-Summe je Messzeile liefert nur die Detailantwort.
    Nach dem erneuten Abruf steht der Befund immer an der Zeile (auch 'no_timer_column'): kein Endlosabruf."""
    if not isinstance(act, dict) or act.get("sport_id") not in DISTANCE_SPORTS:
        return False
    m = act.get("metrics")
    be = m.get("best_efforts") if isinstance(m, dict) else None
    return isinstance(be, dict) and isinstance(be.get("distance"), dict) and "distance_active" not in be


def _needs_extras(act: Any, extras: Any, sports: Any = None) -> bool:
    """v8-452 · Details aktuell, aber ein eingeschalteter Zusatzabruf, der fuer GENAU diese Aktivitaet in Frage kommt
    (extras_for: Sportart, Garmin-Typ, vorhandene Messreihen), lief nie — kein Befund in metrics.ext.extras. Ein Befund
    ('ok' / 'empty' / 'failed') zaehlt als gelaufen: kein Endlosabruf."""
    if not extras or not isinstance(act, dict):
        return False
    m = act.get("metrics")
    if not isinstance(m, dict):
        return False
    g = m.get("garmin") if isinstance(m.get("garmin"), dict) else {}
    st = m.get("streams") if isinstance(m.get("streams"), dict) else {}
    wanted = extras_for(act.get("sport_id"), extras, type_key=g.get("type_key"), streams=st.keys(), sports=sports)
    ext = m.get("ext") if isinstance(m.get("ext"), dict) else {}
    got = ext.get("extras") if isinstance(ext.get("extras"), dict) else {}
    return any(w not in got for w in wanted)


def _needs_details(act: Any, refetch_maxchart: int = 0, refetch_semantics: bool = False, refetch_active: bool = False,
                   refetch_extras: Any = None, extras_sports: Any = None) -> bool:
    """True, wenn fuer diese Aktivitaet (noch einmal) Details zu laden sind."""
    metrics = act.get("metrics") if isinstance(act, dict) else None
    if _parked(metrics):
        return False
    if not _details_complete(metrics):
        return True
    try:
        if int(metrics.get("detailsVersion") or 1) < _REENRICH_ALL_BELOW:
            return True
    except (TypeError, ValueError):
        return True
    if refetch_semantics and _needs_semantics(metrics):
        return True
    if refetch_active and _needs_active(act):
        return True
    if refetch_extras and _needs_extras(act, refetch_extras, extras_sports):
        return True
    return _needs_resolution_refetch(metrics, refetch_maxchart)


# Schluessel, ohne die ein Herkunftsblock als UNVOLLSTAENDIG gilt. Das Nachladen der Details
# legt metrics.garmin mit Dauern und Abtastung an — ohne Garmin-Typ und Ortszeit. Bis
# v8-447.1 galt eine solche Zeile als „hat Herkunft" und wurde vom weiten Rueckblick nie erfasst.
# v8-447.3: dieselbe Definition wie der Metadaten-Backfill (provenance.REQUIRED) — Typ, UTC-Zeit,
# Ortszeit, Versatz. Unvollstaendig = Status 'partial' (noch nicht gegen die Liste geprueft);
# 'unavailable' (Garmin liefert es nachweislich nicht) und 'inconsistent' sind Endzustaende.
from .provenance import REQUIRED as PROVENANCE_REQUIRED  # noqa: E402


def provenance_incomplete(metrics: Any) -> bool:
    from .provenance import needs_backfill
    return needs_backfill(metrics)


def extras_for(sport_id: Any, enabled: Any, *, type_key: Any = None, streams: Any = None,
               sports: Any = None) -> list[str]:
    """Welche der eingeschalteten Zusatzabrufe fuer diese Aktivitaet gemacht werden (feste
    Reihenfolge). `type_key` = Garmin-Typ, `streams` = Namen der Messreihen der Detailantwort.
    Fehlt eine Angabe, die eine Bedingung braucht, gilt die Bedingung als NICHT erfuellt —
    im Zweifel kein Abruf.
    v8-452.1 · `sports` (DETAIL_EXTRAS_SPORTS): nur diese ORVIA-Sportarten; leer = alle, fuer die der
    Abruf sinnvoll ist (bisheriges Verhalten). Grund: Garmin-Runden ersetzen metrics.splits, und die
    Laufbestzeiten lesen metrics.splits als Rueckfall (run-bests) — Runden fuer Laeufe erst mit eigenem Beleg."""
    only_sports = {str(x).strip().lower() for x in (sports or ()) if str(x).strip()}
    if only_sports and str(sport_id or "").lower() not in only_sports:
        return []
    on = [str(e).strip() for e in (enabled or ()) if str(e).strip()]
    have = set(streams or ())
    out = []
    for name in EXTRAS:
        if name not in on or not ("*" in EXTRAS[name] or sport_id in EXTRAS[name]):
            continue
        cond = EXTRA_CONDITIONS.get(name) or {}
        if cond.get("stream") and cond["stream"] not in have:
            continue
        only = (cond.get("type_keys") or {}).get(sport_id)
        if only and type_key not in only:
            continue
        out.append(name)
    return out


# v8-452.1 · Schwimmfelder je Runde, die zusaetzlich in die schlanke Form gehen — nur wenn Garmin sie liefert und nur als
# Skalar. Feldnamen BELEGT am Mitschnitt vom 18.10.2026 (captures/swimming__*.json, test_v4521_swim_capture.py):
#   numberOfActiveLengths, totalNumberOfStrokes   Summe der Bahnen dieser Runde (Bahnen ohne Distanz = Pause in der Runde)
#   averageSWOLF                                  Mittel der Bahnen-SWOLF (Bahn: Zuege + Sekunden) — Schreibweise "SWOLF"
#   averageMovingSpeed                            Distanz / movingDuration (movingDuration = Summe der aktiven Bahnen)
#   averageStrokes, averageSwimCadence, maxSwimCadence, swimStroke (FREESTYLE / BREASTSTROKE / BACKSTROKE / MIXED), intensityType
# Bewusst NICHT: averageStrokeDistance — im Listeneintrag in cm, in der Rundenantwort in m (0 im Becken).
SWIM_LAP_FIELDS = ("numberOfActiveLengths", "totalNumberOfStrokes", "averageSWOLF", "averageMovingSpeed",
                   "averageStrokes", "averageSwimCadence", "maxSwimCadence", "swimStroke", "intensityType")
# v8-454 · Lauf-/Radfelder je Runde — Namen BELEGT am Mitschnitt vom 19.10.2026 (captures/running__*, cycling__*):
#   averageRunCadence / maxRunCadence (Schritte/min, voller Wert), averageBikeCadence / maxBikeCadence (U/min),
#   averagePower / maxPower / normalizedPower (W, nur mit Leistungsmessung), elevationLoss, maxSpeed,
#   wktStepIndex (Schritt eines Garmin-Workouts). Bewusst NICHT: strideLength (Rundenwert ≠ Listenwert, Einheit unbelegt).
RUN_BIKE_LAP_FIELDS = ("averageRunCadence", "maxRunCadence", "averageBikeCadence", "maxBikeCadence", "averagePower",
                       "maxPower", "normalizedPower", "elevationLoss", "maxSpeed", "wktStepIndex")


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
            "averageSpeed", "elevationGain", "lapIndex", "startTimeGMT") + SWIM_LAP_FIELDS + RUN_BIKE_LAP_FIELDS
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
            # v8-452.1 · Runden aus anderer Quelle (Detailantwort, eigene Daten) werden nie ersetzt — nur leere
            # oder bereits aus diesem Abruf stammende. Der Rohblock (ext.splits) wird in jedem Fall abgelegt.
            prev = metrics.get("splits")
            foreign = isinstance(prev, list) and bool(prev) and metrics.get("splits_source") != "garmin_splits"
            if laps and not foreign:
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


def _fail_count(metrics: Any) -> int:
    try:
        return int((metrics or {}).get("detailsFailCount") or 0)
    except (TypeError, ValueError, AttributeError):
        return 0


def _parse_ts(value: Any) -> datetime | None:
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def backfill_status(rows: Any, now: datetime | None = None, refetch_maxchart: int = 0,
                    refetch_semantics: bool = False, refetch_active: bool = False, refetch_extras: Any = None,
                    extras_sports: Any = None) -> dict:
    """v8-447.1 · Stand des Nachladens — nur ZAHLEN, keine Inhalte, keine Kennungen.

      total      Garmin-Aktivitaeten
      current    auf dem aktuellen Details-Vertrag
      pending    noch zu laden (davon `legacy`: alter Vertrag, `never`: noch nie geladen)
      failing    in `pending`, mit mindestens einem Dauerfehler (wird weiter versucht)
      deferred   zurueckgestellt (≥ DETAIL_FAIL_MAX Dauerfehler, naechster Versuch in ≤ 7 Tagen)
      by_category  Fehlerklasse → Anzahl (failing + deferred)
      by_sport     Sportart → {total, current}
      last_processed, processed_24h   Tempo
    """
    now = now or datetime.now(timezone.utc)
    out: dict[str, Any] = {"contract": DETAILS_CONTRACT_VERSION, "total": 0, "current": 0, "pending": 0,
                           "legacy": 0, "never": 0, "failing": 0, "deferred": 0, "by_category": {},
                           "by_sport": {}, "last_processed": None, "processed_24h": 0,
                           "resolution_pending": 0, "provenance_incomplete": 0, "semantics_pending": 0, "active_pending": 0, "extras_pending": 0,
                           "provenance": {k: 0 for k in ("complete", "partial", "unavailable", "inconsistent")}}
    last = None
    for r in rows or ():
        if not isinstance(r, dict):
            continue
        m = r.get("metrics") if isinstance(r.get("metrics"), dict) else {}
        sport = str(r.get("sport_id") or "?")
        sp = out["by_sport"].setdefault(sport, {"total": 0, "current": 0})
        out["total"] += 1
        sp["total"] += 1
        complete = _details_complete(m)
        from .provenance import status as _prov_status
        pst = _prov_status(m)["status"]
        out["provenance"][pst] += 1
        if pst == "partial":
            out["provenance_incomplete"] += 1
        try:
            ver = int(m.get("detailsVersion") or 1) if complete else 0
        except (TypeError, ValueError):
            ver = 0
        if complete and ver >= DETAILS_CONTRACT_VERSION and _needs_resolution_refetch(m, refetch_maxchart) and not _parked(m, now):
            out["resolution_pending"] += 1
        if complete and ver >= DETAILS_CONTRACT_VERSION and refetch_semantics and _needs_semantics(m) and not _parked(m, now):
            out["semantics_pending"] += 1
        if complete and ver >= DETAILS_CONTRACT_VERSION and refetch_active and _needs_active(r) and not _parked(m, now):
            out["active_pending"] += 1
        if complete and ver >= DETAILS_CONTRACT_VERSION and refetch_extras and _needs_extras(r, refetch_extras, extras_sports) and not _parked(m, now):
            out["extras_pending"] += 1
        if complete and ver >= DETAILS_CONTRACT_VERSION:
            out["current"] += 1
            sp["current"] += 1
            at = _parse_ts(m.get("detailsFetchedAt"))
            if at is not None:
                if last is None or at > last:
                    last = at
                if (now - at).total_seconds() <= 86400:
                    out["processed_24h"] += 1
            continue
        fails = _fail_count(m)
        cat = m.get("detailsFailCategory") if m.get("detailsFailCategory") in FAILURE_CATEGORIES else "UNKNOWN"
        if _parked(m, now):
            out["deferred"] += 1
            out["by_category"][cat] = out["by_category"].get(cat, 0) + 1
            continue
        out["pending"] += 1
        out["legacy" if complete else "never"] += 1
        if fails > 0:
            out["failing"] += 1
            out["by_category"][cat] = out["by_category"].get(cat, 0) + 1
    out["last_processed"] = last.isoformat() if last else None
    return out


def eta_runs(status: dict, limit: int) -> int | None:
    """Wie viele Sync-Laeufe das Nachladen noch braucht — wenn jeder Lauf `limit` schafft.
    Untergrenze, keine Zusage: Rate-Limits und Fehler verlaengern es."""
    try:
        pending = int(status.get("pending") or 0)
        return math.ceil(pending / max(1, int(limit)))
    except (TypeError, ValueError, AttributeError):
        return None


async def sync_activity_details(
    db, user_id: str, get_details: Callable[[str], Any], *, limit: int, max_retries: int = 2,
    on_rate_limit: Callable[[int], None] | None = None,
    get_extra: Callable[[str, str], Any] | None = None, extras: Any = None,
    maxchart: int = 0, refetch_resolution: bool = False, refetch_semantics: bool = False,
    refetch_active: bool = False, refetch_extras: bool = False, extras_sports: Any = None,
) -> dict:
    """Bounded, idempotenter Details-Backfill: nur Aktivitäten OHNE metrics.route
    werden detailliert; Ergebnis verlustfrei in activities.metrics gemerged.

    v8-447.1: `maxchart` = mit welchem maxChartSize `get_details` abfragt (wird an der Zeile
    vermerkt). `refetch_resolution` = Aktivitaeten, die mit kleinerem Wert geladen wurden,
    gezielt noch einmal laden — erst nach allen nie geladenen und veralteten."""
    refetch_mc = int(maxchart or 0) if refetch_resolution else 0
    refetch_sem = bool(refetch_semantics)
    refetch_act = bool(refetch_active)
    refetch_ex = tuple(str(e).strip() for e in (extras or ()) if str(e).strip()) if refetch_extras else None
    acts = await db.select("activities", {"user_id": user_id, "source": "garmin"})
    # v8-424b · Reihenfolge der Auswahl (vorher: Tabellenreihenfolge, also die aeltesten
    # zuerst). Mit dem einmaligen Nachladen der Radeinheiten haette eine FRISCHE
    # Aktivitaet hinter dem ganzen Rueckstand gewartet — Route und Messreihen des
    # heutigen Trainings kaemen erst nach mehreren Laeufen. Deshalb:
    #   1. nie detaillierte vor nachzuladenden,
    #   2. innerhalb jeder Gruppe die neuesten zuerst.
    def _prio(a: Any) -> tuple:
        m = a.get("metrics")
        if not _details_complete(m):
            group = 0                                   # noch nie geladen
        elif _needs_details(a, 0):
            group = 1                                   # alter Vertrag
        else:
            group = 2                                   # nur Aufloesung / Bedeutungspruefung nachholen
        return (group, _neg_ts(a.get("started_at")))
    acts = sorted(acts, key=_prio)
    candidates = [a.get("source_record_id") for a in acts if a.get("source_record_id")]
    already = [a["source_record_id"] for a in acts
               if a.get("source_record_id") and not _needs_details(a, refetch_mc, refetch_sem, refetch_act, refetch_ex, extras_sports)]
    by_id = {a.get("source_record_id"): a for a in acts}

    # v8-447.1 · Die Garmin-Abrufe laufen in einem eigenen Thread. Vorher blockierten sie die
    # Ereignisschleife des Dienstes (bis zu zehn Abrufe hintereinander, die Bibliothek wartet
    # bei Serverfehlern zusaetzlich) — der Statusendpunkt antwortete so lange nicht.
    plan = await asyncio.to_thread(
        backfill_activity_details,
        candidates, already, get_details, limit=limit, max_retries=max_retries,
        on_rate_limit=on_rate_limit,
    )
    failures: dict[str, str] = dict(plan.get("failures") or {})
    persist_failed: list[str] = []
    updated = 0
    extras_count = 0
    for aid, parsed in plan["details"].items():
        act = by_id.get(aid) or {}
        old_m = act.get("metrics") if isinstance(act.get("metrics"), dict) else {}
        merged = build_activity_metrics(act.get("metrics"), parsed)
        # v8-447.1: „schnellste Zeit ueber eine Strecke" nur fuer Sportarten, bei denen das eine
        # klare Bedeutung hat (best_efforts.DISTANCE_SPORTS). Sonst wird der Teil nicht gespeichert.
        be = merged.get("best_efforts")
        if isinstance(be, dict) and ("distance" in be or "distance_active" in be) and act.get("sport_id") not in DISTANCE_SPORTS:
            be = {k: v for k, v in be.items() if k not in ("distance", "distance_active")}
            if any(k in be for k in ("power", "stats")):
                merged["best_efforts"] = be
            else:
                merged.pop("best_efforts", None)
        # GM7.4.1: Abschluss-Marker NUR nach einem tatsächlich erfolgreichen,
        # gemergten Abruf setzen — nie bei einem Fehlschlag (siehe `failed`).
        merged["detailsFetchedAt"] = datetime.now(timezone.utc).isoformat()
        merged["detailsVersion"] = DETAILS_CONTRACT_VERSION
        merged["detailsMaxchart"] = int(maxchart or 0)          # v8-447.1: mit welcher Aufloesung geladen
        # v8-447.1 · Bedeutungspruefung: Summenwerte des Listeneintrags (metrics.ext.fields) gegen
        # die Kennwerte aus ALLEN gelieferten Zeilen. Nur Urteile und Abweichungen, nur Server.
        try:
            from . import semantic_checks as SC
            fields = ((merged.get("ext") or {}).get("fields")) if isinstance(merged.get("ext"), dict) else None
            agg = parsed.get("aggregates")
            if isinstance(fields, dict) and isinstance(agg, dict):
                rels = SC.relations(fields, agg)
                merged["detailsSemantics"] = SC.SEM_VERSION     # v8-447.3: Pruefung ist gelaufen
                sem = SC.compact_for_row(rels)
                ext = dict(merged["ext"])
                if sem:
                    ext["semantics"] = sem
                else:
                    ext.pop("semantics", None)
                merged["ext"] = ext
                # Klein und auf jedem Geraet (metrics.garmin): welche Summenwerte des Listeneintrags
                # gegen die VOLLSTAENDIGE Aufzeichnung bestaetigt sind — mit dem bestaetigten Wert.
                # Nur aus vollstaendiger Lieferung; sonst wird nichts behauptet (und Altes entfernt).
                g = dict(merged.get("garmin")) if isinstance(merged.get("garmin"), dict) else {}
                ok = SC.confirmed(fields, rels) if agg.get("complete") else {}
                if ok:
                    g["semantics_ok"] = ok
                else:
                    g.pop("semantics_ok", None)
                merged["garmin"] = g
        except Exception:  # noqa: BLE001 — eine Pruefung darf das Speichern nie verhindern
            logger.warning("details activity=%s sport=%s semantics=failed", act.get("id"), act.get("sport_id"))
        for k in ("detailsFailCount", "detailsFailedAt", "detailsFailCategory"):
            merged.pop(k, None)                     # Erfolg: Fehlervermerk weg
        # v8-447 · Zusatzabrufe (nur wenn eingeschaltet). Jeder fuer sich abgesichert: ein
        # Fehler markiert genau diesen Abruf als "failed" und bricht nichts ab.
        if get_extra is not None:
            fetched: dict[str, Any] = {}
            g = merged.get("garmin") if isinstance(merged.get("garmin"), dict) else {}
            wanted = extras_for(act.get("sport_id"), extras, type_key=g.get("type_key"),
                                streams=(parsed.get("streams") or {}).keys(), sports=extras_sports)
            for name in wanted:
                try:
                    fetched[name] = await asyncio.to_thread(get_extra, name, aid)
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
                # v8-447.3: Herkunft, die inzwischen in der Zeile steht (Backfill, anderer Lauf),
                # nie mit dem Stand vom Laufbeginn ueberschreiben — nur ergaenzen.
                from .provenance import carry_forward
                merged = carry_forward(merged, fm)
        except Exception:
            pass
        try:
            await db.update(
                "activities",
                {"user_id": user_id, "source": "garmin", "source_record_id": aid},
                {"metrics": merged},
            )
        except Exception:  # noqa: BLE001 — Speichern gescheitert: unsere Seite, nicht die Aktivitaet
            failures[aid] = "PERSISTENCE"
            persist_failed.append(aid)
            logger.warning("details activity=%s sport=%s status=failed category=PERSISTENCE",
                           act.get("id"), act.get("sport_id"))
            continue
        act["metrics"] = merged                       # fuer den Stand am Ende des Laufs
        updated += 1
        logger.info("details activity=%s sport=%s version=%s->%s status=ok rows=%s/%s",
                    act.get("id"), act.get("sport_id"), old_m.get("detailsVersion") or 0, DETAILS_CONTRACT_VERSION,
                    (parsed.get("sampling") or {}).get("rows"), (parsed.get("sampling") or {}).get("total"))

    # Fehler vermerken. Gezaehlt (und damit irgendwann zurueckgestellt) wird nur, was GENAU
    # DIESER Aktivitaet anzulasten ist: NOT_FOUND / UNSUPPORTED / MALFORMED immer; UNKNOWN nur,
    # wenn im selben Lauf eine andere Aktivitaet gelang (sonst kann es alles betreffen).
    # AUTH, RATE_LIMIT, NETWORK, PERSISTENCE zaehlen nie. Geschrieben werden nur die drei
    # Vermerk-Schluessel, auf frisch gelesenem Stand — der Client kann inzwischen geschrieben haben.
    now = datetime.now(timezone.utc)
    for aid in plan["failed"]:
        cat = failures.get(aid, "UNKNOWN")
        act = by_id.get(aid) or {}
        counts = cat in ACTIVITY_SPECIFIC or (cat == "UNKNOWN" and updated > 0)
        retry_after = None
        if counts:
            try:
                flt = {"user_id": user_id, "source": "garmin", "source_record_id": aid}
                fresh = await db.select("activities", flt)
                if fresh:
                    fm = dict(fresh[0].get("metrics")) if isinstance(fresh[0].get("metrics"), dict) else {}
                    n = _fail_count(fm) + 1
                    fm["detailsFailCount"] = n
                    fm["detailsFailedAt"] = now.isoformat()
                    fm["detailsFailCategory"] = cat
                    await db.update("activities", flt, {"metrics": fm})
                    act["metrics"] = fm
                    if n >= DETAIL_FAIL_MAX:
                        retry_after = (now + timedelta(days=DETAIL_FAIL_RETRY_DAYS)).date().isoformat()
            except Exception:  # noqa: BLE001 — Buchfuehrung darf den Sync nie abbrechen
                pass
        logger.warning("details activity=%s sport=%s status=failed category=%s counted=%s retry_after=%s",
                       act.get("id"), act.get("sport_id"), cat, counts, retry_after or "-")

    by_cat: dict[str, int] = {}
    for cat in failures.values():
        by_cat[cat] = by_cat.get(cat, 0) + 1
    status = backfill_status(acts, now, refetch_mc, refetch_sem, refetch_act, refetch_ex, extras_sports)
    return {"selected": plan["selected"], "updated": updated, "failed": list(plan["failed"]) + persist_failed,
            "extras": extras_count, "failures": failures, "by_category": by_cat, "aborted": plan.get("aborted"),
            "not_attempted": plan.get("not_attempted") or [], "status": status}


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
