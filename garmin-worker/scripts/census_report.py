#!/usr/bin/env python3
"""v8-447.1 · Auswertung des Feldzensus (supabase/scripts/garmin_field_census.sql).

Eingabe: das Ergebnis der Abfrage, so wie Supabase es exportiert (CSV mit Kopfzeile
art,sport_id,name,aktivitaeten) — oder die Tabellenausgabe von psql.
Die Eingabe enthaelt nur Namen und Zaehlungen; dieses Skript ruft nichts ab.

Ausgabe:
  app/docs/GARMIN-FIELD-CENSUS-PROD.md     was Garmin je Sportart wirklich liefert, mit Abdeckung
  app/docs/GARMIN-BACKFILL-STATUS.md       Stand des Nachladens auf den Details-Vertrag
  garmin-worker/census/observed.json       dieselben Zahlen maschinenlesbar — daraus bildet
                                           scripts/gen_capability_matrix.py die Belegstufen

    python scripts/census_report.py --csv ~/Downloads/census.csv
    python scripts/census_report.py --csv census.csv --date 2026-10-09 --worker v8-447.1

Belegstufen (fuer die Matrix):
  OBSERVED_PRODUCTION  im Zensus fuer die Sportart gesehen
  ABSENT               fuer die Sportart gibt es mindestens MIN_BASIS Aktivitaeten mit der noetigen
                       Grundlage — und das Feld kam bei KEINER vor
  (sonst bleibt die Stufe aus dem Code: OBSERVED_FIXTURE / LIBRARY_DOCUMENTED / ASSUMED)
Ein Feld wird nie hochgestuft, weil Garmin es „koennen muesste" — nur, weil es gezaehlt wurde.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from orvia_worker import garmin_fields as GF  # noqa: E402

DOCS = HERE.parents[1] / "app" / "docs"
CENSUS_DOC = DOCS / "GARMIN-FIELD-CENSUS-PROD.md"
BACKFILL_DOC = DOCS / "GARMIN-BACKFILL-STATUS.md"
OBSERVED = HERE.parent / "census" / "observed.json"

MIN_BASIS = 5          # so viele Aktivitaeten braucht es, bevor „nie gesehen" als ABSENT gilt
ARTEN = ("basis", "typ", "herkunft", "nachladen", "tempo", "abtastung", "messreihe", "feld", "feld_nicht_erhalten",
         "feld_verworfen", "struktur", "reihe", "reihe_nicht_erhalten", "bestwert", "kennwert", "zusatzabruf",
         "zusatz_schluessel", "aufloesung", "herkunft_unvollstaendig", "bedeutung", "bedeutung_hinweis")
# Nenner je Art: worauf sich „Abdeckung %" bezieht
DENOMINATOR = {"feld": "mit_rohfeldern", "feld_nicht_erhalten": "mit_rohfeldern", "feld_verworfen": "mit_rohfeldern",
               "struktur": "mit_rohfeldern", "herkunft": "alle", "typ": "alle", "abtastung": "details_aktuell",
               "messreihe": "details_aktuell", "reihe": "details_aktuell", "reihe_nicht_erhalten": "details_aktuell",
               "bestwert": "details_aktuell", "kennwert": "details_aktuell", "zusatzabruf": "details_aktuell",
               "zusatz_schluessel": "details_aktuell", "nachladen": "alle", "quelle": "details_aktuell",
               "aufloesung": "details_aktuell", "herkunft_unvollstaendig": "alle", "bedeutung": "details_aktuell",
               "bedeutung_hinweis": "details_aktuell"}
_SAFE_NAME = re.compile(r"^[A-Za-z0-9_.\-\[\]:<> =(),/;×−+äöüÄÖÜß]{1,300}$")


class CensusError(ValueError):
    pass


# ---------------------------------------------------------------------------
# Einlesen
# ---------------------------------------------------------------------------

def parse_rows(text: str) -> list[tuple[str, str, str, int]]:
    """CSV (Supabase-Export) oder psql-Tabelle → [(art, sport, name, anzahl)].
    Unbekannte Arten, kaputte Zeilen und alles, was nicht nach einem Namen aussieht, wird
    verworfen (die Eingabe ist ein Export — sie wird als Daten behandelt, nie ausgefuehrt)."""
    if not isinstance(text, str) or not text.strip():
        raise CensusError("leere Eingabe")
    rows: list[tuple[str, str, str, int]] = []
    lines = [ln for ln in text.splitlines() if ln.strip()]
    piped = sum(1 for ln in lines if ln.count("|") >= 3) > len(lines) / 2
    if piped:
        cells = [[c.strip() for c in ln.split("|")] for ln in lines if not set(ln.strip()) <= set("-+ ")]
        # psql: die erste Spalte kann leer sein (fuehrender Strich) — auf vier Spalten bringen
        cells = [[c for c in r] for r in cells]
        cells = [r[-4:] if len(r) >= 4 else r for r in cells]
    else:
        cells = [r for r in csv.reader(io.StringIO("\n".join(lines)))]
    for r in cells:
        if len(r) < 4:
            continue
        art, sport, name, n = r[0].strip(), r[1].strip(), r[2].strip(), r[3].strip()
        if art == "art" or art not in ARTEN:
            continue
        try:
            count = int(float(n))
        except ValueError:
            continue
        if count < 0 or not _SAFE_NAME.match(name) or not re.match(r"^[a-z_()]{1,32}$", sport):
            continue
        rows.append((art, sport, name, count))
    if not rows:
        raise CensusError("keine Zensus-Zeilen erkannt (erwartet: art, sport_id, name, aktivitaeten)")
    return rows


def build_observed(rows, *, census_date: str | None = None, worker: str | None = None) -> dict:
    out: dict = {"v": 1, "date": census_date or date.today().isoformat(), "worker": worker, "min_basis": MIN_BASIS,
                 "basis": {}}
    for art in ARTEN:
        if art != "basis":
            out[art] = {}
    for art, sport, name, n in rows:
        if art == "basis":
            out["basis"].setdefault(sport, {})[name] = n
        else:
            bucket = out[art].setdefault(sport, {})
            bucket[name] = bucket.get(name, 0) + n
    for sport in out["basis"]:
        for key in ("alle", "mit_herkunft", "mit_rohfeldern", "details_aktuell"):
            out["basis"][sport].setdefault(key, 0)
    # abgeleitet: Garmin-Quelle der kanonischen Messreihen je Sportart (aus den Zeilen „messreihe")
    quelle: dict[str, dict[str, int]] = {}
    for src, per_sport in stream_sources(out).items():
        for sport, n in per_sport.items():
            quelle.setdefault(sport, {})[src] = n
    out["quelle"] = quelle
    return out


# ---------------------------------------------------------------------------
# Belegstufen
# ---------------------------------------------------------------------------

BASE_LABEL = {"fixture": "OBSERVED_FIXTURE", "library": "LIBRARY_DOCUMENTED", "assumed": "ASSUMED"}


def _sports_for(sports, observed) -> list[str]:
    known = list((observed or {}).get("basis", {}))
    return known if tuple(sports) == ("*",) else [s for s in sports if s in known]


def evidence_label(key: str, sports, base: str, observed: dict | None, art: str = "feld") -> dict:
    """Belegstufe EINES Feldes nach dem Zensus.
    { label, seen: {sport: anzahl}, basis: {sport: nenner}, note }"""
    label = BASE_LABEL.get(base, "ASSUMED")
    res = {"label": label, "seen": {}, "basis": {}, "note": None}
    if not observed:
        return res
    denom = DENOMINATOR.get(art, "alle")
    relevant = _sports_for(sports, observed)
    enough = False
    for sport in relevant:
        n = int((observed.get(art, {}).get(sport, {}) or {}).get(key, 0))
        base_n = int(observed["basis"].get(sport, {}).get(denom, 0))
        if base_n:
            res["basis"][sport] = base_n
        if n > 0:
            res["seen"][sport] = n
        if base_n >= observed.get("min_basis", MIN_BASIS):
            enough = True
    if res["seen"]:
        res["label"] = "OBSERVED_PRODUCTION"
    elif enough:
        res["label"] = "ABSENT"
        res["note"] = "nie geliefert, obwohl genug Aktivitaeten vorliegen"
    elif relevant:
        res["note"] = f"zu wenige Aktivitaeten fuer ein Urteil (< {observed.get('min_basis', MIN_BASIS)})"
    else:
        res["note"] = "keine Aktivitaet dieser Sportart im Zensus"
    return res


def stream_sources(observed: dict | None) -> dict:
    """Aus den Zeilen „messreihe" (z. B. 'cadence <- directBikeCadence [cycling_cadence_rpm]'):
    {garmin-quelle: {sport: anzahl}} — damit werden die kanonischen Reihen belegt."""
    out: dict[str, dict[str, int]] = {}
    for sport, items in ((observed or {}).get("messreihe") or {}).items():
        for name, n in items.items():
            m = re.match(r"^\S+ <- (\S+) \[", name)
            if m:
                out.setdefault(m.group(1), {})[sport] = out.get(m.group(1), {}).get(sport, 0) + n
    return out


def verdicts(observed: dict) -> dict:
    """Welche Annahmen des Codes der Zensus bestaetigt / widerlegt — und was neu ist."""
    v = {"confirmed": [], "absent": [], "undecided": [], "new_measured": [], "not_retained": [], "rejected": [],
         "series_confirmed": [], "series_absent": [], "series_new": [], "series_not_retained": []}
    for f in GF.KNOWN:
        r = evidence_label(f["key"], f["sports"], f["evidence"], observed, "feld")
        row = {"key": f["key"], "was": BASE_LABEL[f["evidence"]], "seen": r["seen"], "basis": r["basis"]}
        (v["confirmed"] if r["label"] == "OBSERVED_PRODUCTION" else v["absent"] if r["label"] == "ABSENT" else v["undecided"]).append(row)
    for f in GF.SERIES_KNOWN:
        r = evidence_label(f["key"], f["sports"], f["evidence"], observed, "reihe")
        row = {"key": f["key"], "seen": r["seen"], "basis": r["basis"]}
        if r["label"] == "OBSERVED_PRODUCTION":
            v["series_confirmed"].append(row)
        elif r["label"] == "ABSENT":
            v["series_absent"].append(row)
    seen_fields: dict[str, dict[str, int]] = {}
    for sport, items in (observed.get("feld") or {}).items():
        for name, n in items.items():
            seen_fields.setdefault(name, {})[sport] = n
    v["new_measured"] = [{"key": k, "seen": s} for k, s in sorted(seen_fields.items()) if k not in GF.KNOWN_BY_KEY]
    for art, target in (("feld_nicht_erhalten", "not_retained"), ("feld_verworfen", "rejected"),
                        ("reihe_nicht_erhalten", "series_not_retained")):
        acc: dict[str, dict[str, int]] = {}
        for sport, items in (observed.get(art) or {}).items():
            for name, n in items.items():
                acc.setdefault(name, {})[sport] = n
        v[target] = [{"key": k, "seen": s} for k, s in sorted(acc.items())]
    seen_series: dict[str, dict[str, int]] = {}
    for sport, items in (observed.get("reihe") or {}).items():
        for name, n in items.items():
            seen_series.setdefault(name, {})[sport] = n
    v["series_new"] = [{"key": k, "seen": s} for k, s in sorted(seen_series.items()) if k not in GF.SERIES_KNOWN_BY_KEY]
    return v


# ---------------------------------------------------------------------------
# Nachladen
# ---------------------------------------------------------------------------

def backfill_summary(observed: dict, *, limit: int = 10, interval_min: int = 30) -> dict:
    tot = {"total": 0, "current": 0, "pending": 0, "legacy": 0, "never": 0, "failing": 0, "deferred": 0,
           "by_category": {}, "by_sport": {}, "last_processed": None, "processed_24h": 0}
    for sport, items in (observed.get("nachladen") or {}).items():
        sp = tot["by_sport"].setdefault(sport, {"total": 0, "current": 0})
        for name, n in items.items():
            tot["total"] += n
            sp["total"] += n
            if name == "aktuell":
                tot["current"] += n
                sp["current"] += n
            elif name.startswith("zurueckgestellt:"):
                tot["deferred"] += n
                cat = name.split(":", 1)[1]
                tot["by_category"][cat] = tot["by_category"].get(cat, 0) + n
            else:
                tot["pending"] += n
                if name == "offen_alt":
                    tot["legacy"] += n
                elif name == "offen_neu":
                    tot["never"] += n
                elif name.startswith("fehler:"):
                    tot["failing"] += n
                    cat = name.split(":", 1)[1]
                    tot["by_category"][cat] = tot["by_category"].get(cat, 0) + n
    for name, n in ((observed.get("tempo") or {}).get("(alle)") or {}).items():
        if name == "nachgeladen_letzte_24h":
            tot["processed_24h"] = n
        elif name.startswith("zuletzt_nachgeladen:"):
            tot["last_processed"] = name.split(":", 1)[1]
    runs = math.ceil(tot["pending"] / max(1, limit))
    tot["eta_runs"] = runs
    tot["eta_hours_min"] = round(runs * interval_min / 60.0, 1)
    tot["coverage_pct"] = round(100.0 * tot["current"] / tot["total"], 1) if tot["total"] else None
    return tot


# ---------------------------------------------------------------------------
# Dokumente
# ---------------------------------------------------------------------------

def _pct(n: int, d: int) -> str:
    return "—" if not d else f"{round(100.0 * n / d)} %"


def _seen(seen: dict) -> str:
    return ", ".join(f"{s} {n}" for s, n in sorted(seen.items())) or "—"


def render_census_md(observed: dict) -> str:
    v = verdicts(observed)
    sports = sorted(observed["basis"])
    out = [f"""# Garmin-Feldzensus — Produktion

**Stand: {observed['date']}** · Worker {observed.get('worker') or 'unbekannt'} · erzeugt durch `garmin-worker/scripts/census_report.py`
aus dem Ergebnis von `supabase/scripts/garmin_field_census.sql`.

Dieses Dokument enthält ausschließlich Feldnamen und Zählungen. Abdeckung = Anteil der Aktivitäten der
Sportart, bei denen das Feld vorkam, bezogen auf die Aktivitäten, bei denen es überhaupt vorkommen konnte
(Listenfelder: Aktivitäten mit Rohblock; Messreihen und Bestwerte: Aktivitäten auf dem aktuellen Details-Vertrag).

## 1 · Grundlage je Sportart

| Sportart | Aktivitäten | mit Herkunft | mit Rohfeldern | Details aktuell |
|---|---|---|---|---|"""]
    for s in sports:
        b = observed["basis"][s]
        out.append(f"| {s} | {b['alle']} | {b['mit_herkunft']} | {b['mit_rohfeldern']} | {b['details_aktuell']} |")
    out.append("\n## 2 · Garmin-Typ → ORVIA-Sportart\n\n| ORVIA-Sportart | Garmin-Typ | Aktivitäten |\n|---|---|---|")
    for s in sorted(observed.get("typ") or {}):
        for name, n in sorted(observed["typ"][s].items(), key=lambda kv: (-kv[1], kv[0])):
            out.append(f"| {s} | `{name}` | {n} |")
    other = (observed.get("typ") or {}).get("other") or {}
    out.append("\n" + (f"**Noch `other`:** {sum(other.values())} Aktivitäten mit den Typen "
                       + ", ".join(f"`{k}` ({n})" for k, n in sorted(other.items(), key=lambda kv: -kv[1])) + "."
                       if other else "**Keine Garmin-Aktivität steht auf `other`.**"))

    def table(art: str, title: str, intro: str):
        data = observed.get(art) or {}
        out.append(f"\n## {title}\n\n{intro}\n")
        if not any(data.values()):
            out.append("_Keine Einträge._")
            return
        out.append("| Sportart | Name | Aktivitäten | Abdeckung |\n|---|---|---|---|")
        for s in sorted(data):
            d = observed["basis"].get(s, {}).get(DENOMINATOR.get(art, "alle"), 0)
            for name, n in sorted(data[s].items(), key=lambda kv: (-kv[1], kv[0])):
                out.append(f"| {s} | `{name}` | {n} | {_pct(n, d)} |")

    table("herkunft", "3 · Herkunftsblock", "Welche Schlüssel von `metrics.garmin` gefüllt sind (Typ, Ortszeit, Versatz, Dauern, Abtastung).")
    table("messreihe", "4 · Kanonische Messreihen", "Reihe ← Garmin-Quelle [Bedeutung]. Belegt die Quellnamen je Sportart.")
    table("abtastung", "5 · Abtastung", "`vollstaendig` = Garmin lieferte alle aufgezeichneten Zeilen. Nur dann sind kurze Leistungs-Bestwerte exakt.")
    table("feld", "6 · Felder des Listeneintrags (erhalten)", "`metrics.ext.fields` — Rohwerte unter Garmin-Namen.")
    table("struktur", "7 · Geschachtelte Blöcke des Listeneintrags (erhalten)", "`metrics.ext.list`.")
    table("reihe", "8 · Zusatz-Messreihen (erhalten)", "`metrics.ext.series`.")
    table("bestwert", "9 · Bestwerte: Fenster und Güte", "`exact` = Messung · `approx` = Näherung (kein Rekord) · `insufficient` = Auflösung reicht nicht · `measured` = gemessene Obergrenze.")
    table("kennwert", "10 · Kennwerte aus allen gelieferten Zeilen", "Welche Reihen Mittel und Maximum tragen.")
    table("feld_nicht_erhalten", "11 · Geliefert, aber nicht gespeichert (Listeneintrag)", "Nur der Name steht in der Zeile. Kandidaten für die Erlaubnisliste — oder bewusst uninteressant.")
    table("reihe_nicht_erhalten", "12 · Geliefert, aber nicht gespeichert (Messreihen)", "Nur der Name steht in der Zeile.")
    table("feld_verworfen", "13 · Erlaubtes Feld in unerwarteter Form", "Auf der Erlaubnisliste, geliefert, aber nicht als einfacher Wert. **Jeder Eintrag hier ist ein Fehler in unserer Annahme.**")
    table("zusatzabruf", "14 · Zusatzabrufe", "Nur gefüllt, wenn `DETAIL_EXTRAS` gesetzt ist.")
    table("zusatz_schluessel", "15 · Form der Zusatzabrufe", "Schlüssel der Antworten (keine Werte).")
    table("aufloesung", "15a · Aufloesung der geladenen Details", "`standard` = maxChartSize der Bibliothek (2000) bzw. vor v8-447.1 · "
          "`maxchart=…` = gezielt neu geladen. Erst mit vollständiger Antwort sind kurze Leistungs-Bestwerte exakt.")
    table("herkunft_unvollstaendig", "15b · Herkunftsblock unvollständig", "Ohne Garmin-Typ oder GMT-Startzeit. Behebt der weite "
          "Rückblick (`ACTIVITY_PROVENANCE_BACKFILL_DAYS`).")
    table("bedeutung", "15c · Bedeutungsprüfung: Listenwert gegen Aufzeichnung", "Beziehung = Urteil [passende Lesart] (Lieferung). "
          "Nur Urteile aus **vollständiger** Lieferung zählen als Beleg der Bedeutung.")
    table("bedeutung_hinweis", "15d · Bedeutungsprüfung: Ursache einer Abweichung", "`two_definitions` = Listen- und Aufzeichnungswert "
          "folgen verschiedenen Definitionen · `pool_lengths` = Abweichung in ganzen Bahnen · `half_value` = Listenwert ist ein Bein · "
          "`thinned_response` = nur ausgedünnt geprüft.")

    out.append("\n## 16 · Annahmen des Codes gegen den Zensus\n")
    out.append(f"**Bestätigt** ({len(v['confirmed'])} Listenfelder, {len(v['series_confirmed'])} Zusatzreihen) — in Produktion gesehen:\n")
    out.append("| Feld | bisher | gesehen bei |\n|---|---|---|")
    for r in v["confirmed"]:
        out.append(f"| `{r['key']}` | {r['was']} | {_seen(r['seen'])} |")
    for r in v["series_confirmed"]:
        out.append(f"| `{r['key']}` (Reihe) | ASSUMED | {_seen(r['seen'])} |")
    out.append(f"\n**Widerlegt** ({len(v['absent'])} Listenfelder, {len(v['series_absent'])} Zusatzreihen) — nie geliefert, obwohl mindestens "
               f"{observed.get('min_basis', MIN_BASIS)} passende Aktivitäten vorliegen:\n")
    out.append("| Feld | bisher | geprüfte Grundlage |\n|---|---|---|")
    for r in v["absent"]:
        out.append(f"| `{r['key']}` | {r['was']} | {_seen(r['basis'])} |")
    for r in v["series_absent"]:
        out.append(f"| `{r['key']}` (Reihe) | ASSUMED | {_seen(r['basis'])} |")
    out.append(f"\n**Offen** — {len(v['undecided'])} Listenfelder: zu wenige oder keine Aktivitäten der betreffenden Sportart. "
               "Sie behalten ihre bisherige Stufe; nichts wird hochgestuft.\n")
    out.append(f"**Neu** — {len(v['new_measured'])} erhaltene Messfelder ohne Eintrag in der Erlaubnisliste"
               + (": " + ", ".join(f"`{r['key']}`" for r in v["new_measured"]) if v["new_measured"] else "") + ". "
               f"{len(v['series_new'])} erhaltene Zusatzreihen ohne Eintrag"
               + (": " + ", ".join(f"`{r['key']}`" for r in v["series_new"]) if v["series_new"] else "") + ".")
    return "\n".join(out).rstrip() + "\n"


def render_backfill_md(observed: dict, *, limit: int = 10, interval_min: int = 30) -> str:
    b = backfill_summary(observed, limit=limit, interval_min=interval_min)
    out = [f"""# Garmin-Nachladen — Stand

**Stand: {observed['date']}** · Worker {observed.get('worker') or 'unbekannt'} · erzeugt durch `garmin-worker/scripts/census_report.py`.
Nur Zählungen. Ziel: alle Garmin-Aktivitäten auf dem aktuellen Details-Vertrag (Version 3).

| Kennzahl | Wert |
|---|---|
| Garmin-Aktivitäten gesamt | {b['total']} |
| auf Details-Vertrag 3 | {b['current']} ({b['coverage_pct'] if b['coverage_pct'] is not None else '—'} %) |
| offen | {b['pending']} (alter Vertrag: {b['legacy']} · noch nie geladen: {b['never']} · mit Fehler: {b['failing']}) |
| zurückgestellt (≥ 3 Dauerfehler, nächster Versuch nach 7 Tagen) | {b['deferred']} |
| zuletzt nachgeladen | {b['last_processed'] or '—'} |
| in den letzten 24 h nachgeladen | {b['processed_24h']} |
| verbleibende Läufe (bei {limit} je Lauf) | {b['eta_runs']} |
| früheste Fertigstellung | in {b['eta_hours_min']} h (bei einem Lauf alle {interval_min} min; Rate-Limits und Fehler verlängern das) |

## Fehlerklassen (offen mit Fehler + zurückgestellt)

| Klasse | Aktivitäten | Bedeutung |
|---|---|---|"""]
    meaning = {"NOT_FOUND": "Garmin kennt die Aktivität nicht (gelöscht)", "UNSUPPORTED": "Garmin lehnt die Anfrage ab",
               "MALFORMED": "Antwort unlesbar", "UNKNOWN": "nicht einzuordnen", "NETWORK": "nicht erreichbar",
               "RATE_LIMIT": "Garmin bremst", "AUTH": "Sitzung ungültig", "PERSISTENCE": "Speichern fehlgeschlagen"}
    if b["by_category"]:
        for cat, n in sorted(b["by_category"].items(), key=lambda kv: -kv[1]):
            out.append(f"| {cat} | {n} | {meaning.get(cat, '—')} |")
    else:
        out.append("| — | 0 | keine Fehler vermerkt |")
    out.append("\n## Je Sportart\n\n| Sportart | gesamt | aktuell | Abdeckung |\n|---|---|---|---|")
    for s in sorted(b["by_sport"]):
        x = b["by_sport"][s]
        out.append(f"| {s} | {x['total']} | {x['current']} | {_pct(x['current'], x['total'])} |")
    out.append("""
## Wie das Nachladen arbeitet

- Je Sync-Lauf höchstens `DETAIL_BACKFILL_LIMIT` Aktivitäten (Standard 10), noch nie geladene zuerst, dann die neuesten.
- Fortsetzbar: der Stand steht an jeder Aktivität (`detailsVersion`, `detailsFetchedAt`); ein Neustart verliert nichts
  und lädt nichts doppelt.
- **Rate-Limit (429) oder ungültige Sitzung beenden den Lauf sofort**; der Lauf gilt als nicht erfolgreich, der
  Zeitplaner verlängert die Pause. Nichts davon wird einer Aktivität angelastet.
- Zwei Netzfehler in Folge beenden den Lauf ebenfalls.
- Nur Fehler, die genau eine Aktivität betreffen (`NOT_FOUND`, `UNSUPPORTED`, `MALFORMED`), zählen; nach drei
  solchen Fehlern wird die Aktivität sieben Tage zurückgestellt. Ein Erfolg löscht den Vermerk.
- Bewusst nicht beschleunigt: inoffizielle Schnittstelle, Stabilität vor Geschwindigkeit.
""")
    return "\n".join(out).rstrip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Feldzensus auswerten (nur Namen und Zaehlungen).")
    ap.add_argument("--csv", required=True, help="Export der Zensus-Abfrage (CSV oder psql-Tabelle)")
    ap.add_argument("--date", default=None, help="Datum der Erhebung (Standard: heute)")
    ap.add_argument("--worker", default=None, help="Stand des Workers zum Zeitpunkt der Erhebung (z. B. v8-447.1)")
    ap.add_argument("--limit", type=int, default=10, help="DETAIL_BACKFILL_LIMIT (Standard 10)")
    ap.add_argument("--interval", type=int, default=30, help="Sync-Intervall in Minuten (Standard 30)")
    ap.add_argument("--dry-run", action="store_true", help="nur Zusammenfassung drucken, nichts schreiben")
    args = ap.parse_args()
    text = Path(args.csv).expanduser().read_text(encoding="utf-8-sig")
    try:
        observed = build_observed(parse_rows(text), census_date=args.date, worker=args.worker)
    except CensusError as e:
        print(f"FEHLER: {e}")
        return 2
    b = backfill_summary(observed, limit=args.limit, interval_min=args.interval)
    v = verdicts(observed)
    print(f"Sportarten: {', '.join(sorted(observed['basis']))}")
    print(f"Nachladen: {b['current']}/{b['total']} aktuell, offen {b['pending']}, zurueckgestellt {b['deferred']}, "
          f"Fehler {b['by_category'] or '-'}, fertig fruehestens in {b['eta_hours_min']} h")
    print(f"Annahmen: bestaetigt {len(v['confirmed'])} + {len(v['series_confirmed'])} Reihen, "
          f"widerlegt {len(v['absent'])} + {len(v['series_absent'])} Reihen, offen {len(v['undecided'])}, "
          f"neu {len(v['new_measured'])}, verworfen {len(v['rejected'])}")
    if args.dry_run:
        return 0
    DOCS.mkdir(parents=True, exist_ok=True)
    CENSUS_DOC.write_text(render_census_md(observed), encoding="utf-8")
    BACKFILL_DOC.write_text(render_backfill_md(observed, limit=args.limit, interval_min=args.interval), encoding="utf-8")
    OBSERVED.parent.mkdir(parents=True, exist_ok=True)
    OBSERVED.write_text(json.dumps(observed, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    print(f"geschrieben: {CENSUS_DOC.name}, {BACKFILL_DOC.name}, {OBSERVED}")
    print("Danach: python scripts/gen_capability_matrix.py  (Belegstufen der Matrix neu bilden)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
