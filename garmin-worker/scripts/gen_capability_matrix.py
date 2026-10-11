#!/usr/bin/env python3
"""v8-447 · Erzeugt app/docs/GARMIN-CAPABILITY-MATRIX.md aus dem Code.

Die Tabellen kommen aus genau den Strukturen, mit denen der Worker arbeitet
(garmin_fields.CANONICAL / KNOWN / SERIES_KNOWN / SERIES_SKIP, detail_sync.EXTRAS,
normalize.SPORT_MAP). Ein Test (tests/test_capability_matrix.py) vergleicht die Datei mit
der Ausgabe dieses Skripts — die Matrix kann dem Code nicht davonlaufen.

    python scripts/gen_capability_matrix.py            # schreibt die Datei
    python scripts/gen_capability_matrix.py --check    # Rueckgabewert 1, wenn veraltet
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import json  # noqa: E402

from orvia_worker import WORKER_BUILD, backfill, best_efforts, detail_sync, garmin_fields as GF, normalize, semantic_checks, series_normalize  # noqa: E402

sys.path.insert(0, str(HERE))
import census_report as CR  # noqa: E402

DOC = HERE.parents[1] / "app" / "docs" / "GARMIN-CAPABILITY-MATRIX.md"


def load_observed() -> dict | None:
    """Zahlen des letzten Feldzensus (garmin-worker/census/observed.json) — oder None, wenn
    noch keiner erhoben wurde. Ohne Zensus bleibt jede Zeile auf der Stufe aus dem Code."""
    try:
        data = json.loads(CR.OBSERVED.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) and isinstance(data.get("basis"), dict) else None
    except (OSError, ValueError):
        return None


OBS = load_observed()

HEAD = ("FIELD", "SPORT", "ENDPOINT", "RAW FIELD NAME", "RAW AVAILABLE?", "IMPORTED?", "STORED?", "DISPLAYED?",
        "SERIES/SUMMARY", "UNITS", "NORMALIZATION", "LOSSY?", "HIGHLIGHT-READY?", "NOTES")
EP = {"list": "get_activities_by_date", "details": "get_activity_details"}
AVAIL = {"fixture": "OBSERVED_FIXTURE (Mitschnitt Lauf)", "library": "LIBRARY_DOCUMENTED", "assumed": "ASSUMED"}
READY_BY_LABEL = {"OBSERVED_PRODUCTION": "ja, wenn die Bedeutung geprüft ist", "OBSERVED_FIXTURE": "ja",
                  "LIBRARY_DOCUMENTED": "nach Zensus / Mitschnitt", "ASSUMED": "nach Zensus / Mitschnitt", "ABSENT": "nein"}
# Kanonische Zeilen (Teil A): woran der Zensus sie belegt — (Art, Name im Zensus)
CANON_CENSUS = {
    "Start (UTC)": ("herkunft", "start_gmt"), "Start (Ortszeit)": ("herkunft", "start_local"),
    "UTC-Versatz": ("herkunft", "utc_offset_s"), "Sportart": ("herkunft", "type_key"), "Garmin-Typ": ("herkunft", "type_key"),
    "Garmin-Obertyp": ("herkunft", "parent_type_id"), "Dauer (Timer)": ("feld", "duration"), "Distanz": ("feld", "distance"),
    "Ø Herzfrequenz": ("feld", "averageHR"), "Max. Herzfrequenz": ("feld", "maxHR"), "Kalorien": ("feld", "calories"),
    "Hoehenmeter": ("feld", "elevationGain"), "Ø Geschwindigkeit": ("feld", "averageSpeed"), "Ø Leistung": ("feld", "avgPower"),
    "Max. Leistung": ("feld", "maxPower"), "Normalisierte Leistung": ("feld", "normPower"),
    "Trainingsbelastung": ("feld", "activityTrainingLoad"),
    "Zeitachse": ("quelle", "directTimestamp"), "Herzfrequenz": ("quelle", "directHeartRate"),
    "Geschwindigkeit": ("quelle", "directSpeed"), "Distanz (kumulativ)": ("quelle", "sumDistance"),
    "Hoehe": ("quelle", "directElevation"), "Schrittfrequenz": ("quelle", "directDoubleCadence"),
    "Schrittfrequenz (Ersatz)": ("quelle", "directRunCadence"), "Trittfrequenz": ("quelle", "directBikeCadence"),
    "Leistung": ("quelle", "directPower"), "Bewegungszeit": ("herkunft", "moving_duration_s"),
    "Verstrichene Zeit": ("herkunft", "elapsed_duration_s"), "Timer-Zeit": ("herkunft", "timer_duration_s"),
    "Abtastung": ("herkunft", "stream_rows"),
}


def _evidence(key: str, sports, base: str, art: str) -> tuple[str, str]:
    """(Text fuer RAW AVAILABLE?, Text fuer HIGHLIGHT-READY?) — nach Zensus, sonst nach Code."""
    if OBS is None:
        label = CR.BASE_LABEL[base]
        return (AVAIL[base], READY_BY_LABEL[label])
    r = CR.evidence_label(key, sports, base, OBS, art)
    label = r["label"]
    if label == "OBSERVED_PRODUCTION":
        seen = ", ".join(f"{sp} {n}/{r['basis'].get(sp, '?')}" for sp, n in sorted(r["seen"].items()))
        text = f"OBSERVED_PRODUCTION ({seen})"
        if base == "fixture":
            text += " + Mitschnitt"
    elif label == "ABSENT":
        text = "ABSENT (" + ", ".join(f"{sp} 0/{n}" for sp, n in sorted(r["basis"].items())) + ")"
    else:
        text = AVAIL[base] + (f" — {r['note']}" if r.get("note") else "")
    return (text, READY_BY_LABEL[label])
GROUP = {"time": "Zeit", "volume": "Umfang", "structure": "Struktur", "speed": "Tempo", "heart": "Herz",
         "energy": "Energie", "effect": "Belastung / Wirkung", "zones": "Zonen", "power": "Leistung",
         "running": "Laufdynamik", "cycling": "Rad", "swimming": "Schwimmen / Rudern", "strength": "Kraft",
         "environment": "Umgebung"}
EXTRA_METHOD = {"activity": "get_activity", "splits": "get_activity_splits", "typed_splits": "get_activity_typed_splits",
                "hr_zones": "get_activity_hr_in_timezones", "power_zones": "get_activity_power_in_timezones",
                "exercise_sets": "get_activity_exercise_sets"}
EXTRA_WHAT = {"activity": "volle Zusammenfassung (summaryDTO)", "splits": "Runden", "typed_splits": "Intervalle / Bahnen",
              "hr_zones": "Zeit je Herzfrequenz-Zone", "power_zones": "Zeit je Leistungs-Zone", "exercise_sets": "Sätze (Übung, Wiederholungen, Gewicht)"}
EXTRA_STORE = {"activity": "metrics.ext.fields (ergänzt, Listeneintrag bleibt führend)", "splits": "metrics.ext.splits + metrics.splits (schlanke Form)",
               "typed_splits": "metrics.ext.typed_splits", "hr_zones": "metrics.ext.hr_zones", "power_zones": "metrics.ext.power_zones",
               "exercise_sets": "metrics.ext.exercise_sets"}
SKIP_WHY = {
    "directTimestamp": "steht als Zeitachse (streams.time)", "directLatitude": "steht als Strecke (route)",
    "directLongitude": "steht als Strecke (route)", "sumDistance": "steht als streams.distance",
    "sumDuration": "letzter Wert als garmin.timer_duration_s", "sumMovingDuration": "letzter Wert als garmin.moving_duration_s",
    "sumElapsedDuration": "letzter Wert als garmin.elapsed_duration_s; Ersatzquelle der Zeitachse",
    "directHeartRate": "steht als streams.heart_rate", "directPower": "steht als streams.power",
    "directSpeed": "steht als streams.speed", "directElevation": "steht als streams.elevation",
    "directCorrectedElevation": "Ersatzquelle für streams.elevation", "directUncorrectedElevation": "Rohhöhe vor Korrektur — nicht gespeichert",
    "directRunCadence": "ein Bein; nur zur Bildung der Schrittfrequenz, wenn Double fehlt",
    "directDoubleCadence": "steht als streams.cadence (Schrittfrequenz)", "directFractionalCadence": "Nachkommaanteil von directRunCadence",
    "directBikeCadence": "steht als streams.cadence (Trittfrequenz)", "directVerticalSpeed": "Ableitung der Höhe — nicht gespeichert",
    "directBodyBattery": "Tageswert, keine Trainingsmessreihe (steht in user_metrics) — nicht gespeichert",
}


def _cell(v) -> str:
    return str(v if v not in (None, "") else "—").replace("|", "\\|").replace("\n", " ")


def _table(rows: list[tuple]) -> str:
    out = ["| " + " | ".join(HEAD) + " |", "|" + "|".join("---" for _ in HEAD) + "|"]
    for r in rows:
        assert len(r) == len(HEAD), r
        out.append("| " + " | ".join(_cell(c) for c in r) + " |")
    return "\n".join(out)


def _sports(s) -> str:
    return "alle" if tuple(s) == ("*",) else ", ".join(s)


def rows_canonical() -> list[tuple]:
    out = []
    for c in GF.CANONICAL:
        art, key = CANON_CENSUS.get(c["field"], (None, None))
        avail, ready = _evidence(key, c["sports"], c["evidence"], art) if art else (AVAIL[c["evidence"]], None)
        # „ready" aus dem Code gilt nur, solange der Zensus nichts anderes sagt (ABSENT → nein)
        ready_txt = "nein" if (ready == "nein" and OBS is not None and art) else c["ready"]
        out.append((c["field"], _sports(c["sports"]), EP[c["ep"]], f"`{c['raw']}`", avail, "ja", f"`{c['stored']}`",
                    c["shown"], c["shape"], c["unit"], c["norm"], c["lossy"], ready_txt, c["note"]))
    return out


def rows_known() -> list[tuple]:
    out = []
    for f in GF.KNOWN:
        avail, ready = _evidence(f["key"], f["sports"], f["evidence"], "feld")
        out.append((GROUP[f["group"]], _sports(f["sports"]), EP["list"], f"`{f['key']}`", avail, "ja, wenn geliefert",
                    f"`metrics.ext.fields.{f['key']}`", "nein", "summary", f["unit"], "keine (Rohwert)", "nein", ready, f["note"]))
    return out


def rows_series() -> list[tuple]:
    out = []
    for f in GF.SERIES_KNOWN:
        avail, ready = _evidence(f["key"], f["sports"], f["evidence"], "reihe")
        out.append((GROUP[f["group"]], _sports(f["sports"]), EP["details"], f"`{f['key']}`", avail, "ja, wenn geliefert",
                    f"`metrics.ext.series.{f['key']}`", "nein", "series", f["unit"] + " (maßgeblich: garmin_unit der Antwort)",
                    "keine (Rohwert, gleicher Index wie die Zeitachse)", "ja: Ausdünnung", ready, f["note"]))
    return out


def _extra_condition(name: str) -> str:
    cond = detail_sync.EXTRA_CONDITIONS.get(name) or {}
    parts = []
    if cond.get("stream"):
        parts.append(f"nur wenn die Aufzeichnung die Reihe `{cond['stream']}` hat")
    for sport, keys in (cond.get("type_keys") or {}).items():
        parts.append(f"{sport} nur bei Garmin-Typ " + ", ".join(f"`{k}`" for k in keys))
    return "; ".join(parts) or "keine Zusatzbedingung"


def rows_extras() -> list[tuple]:
    return [(EXTRA_WHAT[name], _sports(sports), EXTRA_METHOD[name], "Antwortform unbelegt", "LIBRARY_DOCUMENTED (Methode); Form ASSUMED",
             "nur mit `DETAIL_EXTRAS`", f"`{EXTRA_STORE[name]}`", "nein", "structure", "—",
             "Form erhalten, nur Messwerte (keep_structure)", "ja: private Felder, Koordinaten, Deckel 400 Einträge", "nach Mitschnitt",
             "standardmäßig AUS · " + _extra_condition(name)) for name, sports in detail_sync.EXTRAS.items()]


def label_counts() -> dict:
    """Wie viele Zeilen (Teil A–C) auf welcher Belegstufe stehen."""
    counts = {"OBSERVED_PRODUCTION": 0, "OBSERVED_FIXTURE": 0, "LIBRARY_DOCUMENTED": 0, "ASSUMED": 0, "ABSENT": 0}
    for rows in (rows_canonical(), rows_known(), rows_series()):
        for r in rows:
            for label in counts:
                if r[4].startswith(label):
                    counts[label] += 1
                    break
    return counts


def sport_map_table() -> str:
    by: dict[str, list[str]] = {}
    for k, v in normalize.SPORT_MAP.items():
        by.setdefault(v, []).append(k)
    out = ["| ORVIA-Sportart | Garmin-Typen (typeKey) |", "|---|---|"]
    for sport in sorted(by):
        out.append(f"| {sport} | " + ", ".join(f"`{k}`" for k in sorted(by[sport])) + " |")
    return "\n".join(out)


def skip_table() -> str:
    out = ["| Reihe der Detailantwort | Was damit geschieht |", "|---|---|"]
    for k in sorted(GF.SERIES_SKIP):
        out.append(f"| `{k}` | {SKIP_WHY[k]} |")
    return "\n".join(out)


def census_sql() -> str:
    p = HERE.parents[1] / "supabase" / "scripts" / "garmin_field_census.sql"
    return p.read_text(encoding="utf-8").strip() if p.exists() else "-- supabase/scripts/garmin_field_census.sql"


def render() -> str:
    lc = label_counts()
    reach = sorted(set(normalize.SPORT_MAP.values()))
    if OBS is None:
        census_state = ("**Noch kein Produktions-Zensus erhoben.** Jede Zeile steht auf der Stufe aus dem Code; "
                        "`OBSERVED_PRODUCTION` und `ABSENT` kommen erst mit dem Zensus (Abschnitt 12).")
    else:
        n_act = sum(int(b.get("alle", 0)) for b in OBS["basis"].values())
        census_state = (f"**Zensus vom {OBS.get('date')}** (Worker {OBS.get('worker') or 'unbekannt'}, {n_act} Garmin-Aktivitäten, "
                        f"Sportarten: {', '.join(sorted(OBS['basis']))}). Einzelheiten: `GARMIN-FIELD-CENSUS-PROD.md`.")
    windows = ", ".join((f"{w} s" if w < 60 else f"{w // 60} min") for w in best_efforts.POWER_WINDOWS_S)
    targets = ", ".join((f"{int(t)} m" if t < 1000 else f"{t / 1000:g} km") for t in best_efforts.DISTANCE_TARGETS_M)
    parts = [f"""# Garmin-Fähigkeits-Matrix

**Status: IMPLEMENTED** · Stand Worker {WORKER_BUILD} · Details-Vertrag {detail_sync.DETAILS_CONTRACT_VERSION} · Rohblock-Version {GF.EXT_VERSION}

> Diese Datei wird **erzeugt**: `python garmin-worker/scripts/gen_capability_matrix.py`.
> Die Tabellen stammen aus dem Code des Workers (`garmin_fields.py`, `detail_sync.py`, `normalize.py`).
> Nicht von Hand ändern — ein Test vergleicht Datei und Code.

Was Garmin je Aktivität liefert, was davon importiert, gespeichert und angezeigt wird, was dabei
verloren geht und wie gut jede Aussage belegt ist. Grundsatz seit v8-447: **erhalten, nicht deuten** —
Rohwerte bleiben unter ihrem Garmin-Namen, nichts wird erfunden, nichts stillschweigend umgerechnet.

## 1 · Wie belastbar ist eine Zeile? (Belegstufen)

| Stufe | Bedeutung | Zeilen (Teil A–C) |
|---|---|---|
| **OBSERVED_PRODUCTION** | im Produktions-Zensus für die Sportart gezählt | {lc['OBSERVED_PRODUCTION']} |
| **OBSERVED_FIXTURE** | in einem echten, anonymisierten Mitschnitt im Repo gesehen | {lc['OBSERVED_FIXTURE']} |
| **LIBRARY_DOCUMENTED** | im typisierten Modell der eingesetzten Bibliothek (garminconnect 0.3.6) benannt | {lc['LIBRARY_DOCUMENTED']} |
| **ASSUMED** | üblicher Garmin-Connect-Name, hier **nicht** belegt | {lc['ASSUMED']} |
| **ABSENT** | im Zensus nie geliefert, obwohl mindestens {CR.MIN_BASIS} passende Aktivitäten vorliegen | {lc['ABSENT']} |

{census_state}

Regeln:

- Eine Zeile wird **nur** `OBSERVED_PRODUCTION`, wenn das Feld im Zensus gezählt wurde — nie, weil Garmin es
  „können müsste". Die Zahl dahinter (`running 118/120`) nennt Aktivitäten mit dem Feld / Aktivitäten der Sportart.
- `OBSERVED_PRODUCTION` belegt, dass Garmin das Feld **liefert** — nicht, was es **bedeutet**. Einheit und Bedeutung
  belegt erst ein Mitschnitt oder der Vergleich mit Garmin Connect (`PERFORMANCE-DATA-ELIGIBILITY.md`).
- Zu wenige Aktivitäten einer Sportart: die Zeile behält ihre bisherige Stufe. Unklar bleibt unklar.

Im Repo liegt genau **ein** echter Mitschnitt: die Detailantwort **eines Laufs**
(`garmin-worker/tests/fixtures/garmin/activity_details.json`). Es gibt keinen echten Listeneintrag,
keinen Rad-, Schwimm- oder Kraft-Mitschnitt und keine Antwort der Zusatzabrufe.
Ein angenommener Name, den Garmin nicht liefert, erzeugt schlicht kein Feld — er richtet keinen Schaden an.
Wie aus Annahmen Belege werden: Abschnitt 12 (Feldzensus, ohne Login) und Abschnitt 13 (Mitschnitt).

## 2 · Spalten

| Spalte | Bedeutung |
|---|---|
| FIELD | Größe bzw. Gruppe |
| SPORT | für welche ORVIA-Sportarten das Feld sinnvoll vorkommt |
| ENDPOINT | Methode der Bibliothek, aus deren Antwort das Feld stammt |
| RAW FIELD NAME | Name in Garmins Antwort |
| RAW AVAILABLE? | Belegstufe (Abschnitt 1) |
| IMPORTED? | liest der Worker das Feld |
| STORED? | wo es in der Zeile `activities` steht |
| DISPLAYED? | zeigt oder benutzt die App es |
| SERIES/SUMMARY | Messreihe über die Zeit, Einzelwert oder geschachtelte Struktur |
| UNITS | Einheit |
| NORMALIZATION | was beim Import mit dem Wert geschieht |
| LOSSY? | geht dabei etwas verloren |
| HIGHLIGHT-READY? | taugt als Grundlage für Highlights / Bestwerte: *ja* nur bei belegter Bedeutung |
| NOTES | Besonderheiten |

## 3 · Zeit

| Was | Wo | Bedeutung |
|---|---|---|
| Zeitpunkt (UTC) | `activities.started_at` | Garmins `startTimeGMT`. Maßgeblich für Reihenfolge und Dauer. |
| Ortszeit | `metrics.garmin.start_local` | Garmins `startTimeLocal`: Wandzeit **am Ort der Aktivität** — richtig auch auf Reisen. |
| UTC-Versatz | `metrics.garmin.utc_offset_s` | Differenz der beiden gelieferten Zeiten. Kein Zonenname, keine feste Verschiebung; Sommer-/Winterzeit steckt darin. Nur Viertelstunden-Werte zwischen −12 h und +14 h, sonst kein Wert. |

Anzeige in der App (`app/js/activity-time.js`, `localParts`), in dieser Reihenfolge:

1. `metrics.garmin.start_local`, wenn vorhanden (Basis `activity_local`);
2. bei manuell eingegebenen, importierten und alten lokalen Einträgen der eingegebene Text (Basis `wall_clock`);
3. sonst der UTC-Zeitpunkt in der Zeitzone des Profils bzw. des Geräts über `Intl` (Basis `timezone`);
4. ohne Zone der UTC-Text (Basis `utc_fallback`).

Bis v8-446 wurde die Uhrzeit aus dem UTC-Text geschnitten: im deutschen Sommer zwei, im Winter eine Stunde zu früh.

**Bekannter Rest (nicht in v8-447 geändert):** Die Tageszuordnung für Summen und Belastung
(`activityConfig.dayOfActLocal`) behandelt jede Quelle als UTC-Zeitpunkt. Für **manuell eingegebene**
Einheiten ist `startedAt` aber die eingegebene Wandzeit, die nach dem Weg über den Server ein „Z" trägt.
Eine nach 22 Uhr (Sommer) bzw. 23 Uhr (Winter) eingegebene Einheit kann deshalb in der Wochensumme dem
Folgetag zugerechnet werden. Garmin-Aktivitäten und ORVIA-Workouts sind nicht betroffen. Die Korrektur
berührt einen Test, der dieses Verhalten festschreibt, und die Belastungsrechnung — eigene Entscheidung.

## 4 · Kadenz

Die Detailantwort eines Laufs enthält drei Reihen (am echten Mitschnitt, alle 1855 Zeilen geprüft):

| Reihe | Wert im Mitschnitt | Bedeutung |
|---|---|---|
| `directRunCadence` | 80 | Frequenz **eines** Beins, ganzzahlig |
| `directFractionalCadence` | 0,5 | Nachkommaanteil dazu |
| `directDoubleCadence` | 161 | Schrittfrequenz beider Beine = 2 × (80 + 0,5) |

Bis v8-446 las der Worker `directRunCadence` und speicherte den Wert als „spm" — angezeigt wurde die halbe
Schrittfrequenz. Seit Details-Vertrag 3 gilt:

- Lauf: `directDoubleCadence`, unverändert. Fehlt sie, wird `2 × (Run + Fractional)` gebildet und als
  `derived` gekennzeichnet. Keine pauschale Verdopplung eines Wertes unbekannter Bedeutung.
- Rad: `directBikeCadence` in rpm — läuft durch keine Lauf-Regel (Name unbelegt).
- Schwimmen / Rudern: Zugfrequenz bleibt unter ihrem Garmin-Namen im Rohblock; sie wird **nicht** zur
  Reihe `cadence`.
- Jede Reihe trägt ihre Bedeutung: `metrics.stream_meta.<reihe> = {{kind, unit, source, garmin_unit}}`.

**Altbestand:** Garmin-Läufe ohne `stream_meta` tragen einen Wert, bei dem nicht entscheidbar ist, ob er
halbiert ist. Er wird **nicht** umgerechnet; die App zeigt ihn nicht an (`status: unverified`), bis der
Worker die Einheit neu von Garmin geladen hat. Das geschieht von selbst: alle Aktivitäten unter Vertrag 3
werden einmal nachgeladen, die neuesten zuerst, höchstens `DETAIL_BACKFILL_LIMIT` (Standard 10) je Lauf.

## 5 · Abtastung

Drei Stufen, jede steht in der Zeile (`metrics.garmin`):

| Stufe | Feld | Im Mitschnitt |
|---|---|---|
| von der Uhr aufgezeichnet | `stream_total` (`totalMetricsCount`) | 5527 |
| von Garmin geliefert | `stream_rows` | 1855 |
| gespeichert | `stream_kept` (Deckel {series_normalize.STREAM_MAX} je Reihe) | 266 |

- Alle Reihen einer Aktivität benutzen **dieselbe** Auswahl von Zeilen; Punkt *i* gehört in jeder Reihe
  zum selben Zeitpunkt `streams.time[i]`. (Bis v8-446 konnte eine Reihe um einen Punkt kürzer sein.)
- Die Zeitachse ist die **verstrichene** Zeit seit der ersten Zeile, Pausen eingeschlossen — bewusst
  nicht die Timer-Zeit: ein Bestzeit-Fenster über eine Pause hinweg soll langsamer sein, nicht schneller.
  Garmin zeichnet nicht gleichmäßig auf (Abstände im Mitschnitt von 1 s bis über 60 s) — genau deshalb
  reicht die Reihenfolge allein nicht.
- Für Bestzeiten über Strecken ab etwa 400 m genügt die Auflösung. Für Leistungs-Bestwerte über
  1–15 Sekunden genügt sie **nicht**; dafür müsste der Worker die Bestwerte beim Import aus allen
  gelieferten Zeilen bilden. Nicht Teil von v8-447.
- Messwerte werden als 32-Bit-Zahlen geliefert und standen bisher auf 64 Bit aufgebläht in der Zeile
  (46.79999923706055 statt 46.8). Seit v8-447 wird eine Reihe nur dann kürzer geschrieben, wenn jede
  Zahl danach exakt dieselbe 32-Bit-Messung ergibt. Eine voll angereicherte Aktivität belegt damit rund
  16 000 statt 25 000 Zeichen — trotz zusätzlicher Zeitachse.

## 6 · Teil A — Felder mit festem Platz

{_table(rows_canonical())}

## 7 · Teil B — Rohfelder des Listeneintrags (`metrics.ext.fields`)

Erhalten wird jedes dieser Felder **genau dann**, wenn Garmin es liefert — unter seinem Garmin-Namen, ohne
Umrechnung. Zusätzlich bleibt jedes weitere skalare Feld erhalten, dessen Name nach einem Messwert aussieht
(`MEASURE_PARTS`); alles Übrige wird dem Namen nach vermerkt (`metrics.ext.unrecognized`).
`metrics.ext` liegt nur auf dem Server und in der Serverliste der App, nie im lokalen Speicher des Geräts.

{_table(rows_known())}

## 8 · Teil C — Zusatz-Messreihen der Detailantwort (`metrics.ext.series`)

Höchstens {GF.SERIES_MAX} Reihen je Aktivität, bekannte zuerst. Jede weitere Reihe, deren Name nach einem
Messwert aussieht, bleibt ebenfalls erhalten; der Rest wird dem Namen nach vermerkt
(`metrics.ext.series_unparsed`). **Alle Namen dieser Tabelle sind Annahmen.**

{_table(rows_series())}

## 9 · Teil D — Zusatzabrufe je Aktivität

Verdrahtet, aber **standardmäßig aus**: jede Zeile ist ein weiterer Abruf je Aktivität an einer
inoffiziellen Schnittstelle, und keine der Antwortformen ist im Repo belegt. Einschalten über die
Einstellung `DETAIL_EXTRAS` (Abschnitt 14) — sinnvoll erst nach einem Mitschnitt je Sportart.
Ein fehlgeschlagener Abruf wird als `failed` vermerkt (`metrics.ext.extras`) und bricht nichts ab.

{_table(rows_extras())}

## 10 · Bewusst nicht gespeichert

**Nie**, auch nicht dem Namen nach: Felder, deren Name eines dieser Wörter enthält —
{", ".join(sorted(GF.PRIVATE_TOKENS))} — sowie jede Kennung (`…Id`, `…Pk`) außer
{", ".join(f"`{k}`" for k in sorted(GF.ID_ALLOWED))}. Geprüft wird je Wort des Feldnamens
(`avgVerticalOscillation` fällt nicht wegen „lat" weg). Frei geschriebener Text bleibt nur an einer
Stelle: der Titel der Aktivität in `summary.name`.

Reihen der Detailantwort, die nicht zusätzlich abgelegt werden:

{skip_table()}

Außerdem: Die Strecke wird auf höchstens 600 Punkte reduziert; Zeit, Höhe und Tempo **je Streckenpunkt**
(`geoPolylineDTO.polyline[].time/altitude/speed`) gehen dabei verloren — sie stehen in den Messreihen.

## 11 · Sportarten: Garmin-Typ → ORVIA

Der Katalog hat 24 Sportarten. {len(normalize.SPORT_MAP)} Garmin-Typen führen auf {len(reach)} davon;
ohne eigenen Garmin-Typ sind `athletics` (Garmin zeichnet Bahnläufe als Lauf auf) und `other` (der
Rückfall selbst). Jeder andere Typ wird `other` — der Garmin-Typ bleibt dabei **immer** erhalten
(`metrics.garmin.type_key`, zusätzlich `metrics.source_sport_raw`), eine fehlende Zeile ist also
nachträglich korrigierbar. Die Typnamen sind nicht am Abruf belegt; der Feldzensus zeigt die
tatsächlich vorkommenden (Zeilen `typ`).

{sport_map_table()}

Für **bereits importierte** Zeilen hebt der Worker `sport_id` nur dann von `other` auf die erkannte
Sportart, wenn `metrics.source_sport_raw` dem Garmin-Typ entspricht — also wenn die damals fehlende
Zuordnung der Grund war. Eine vom Nutzer gewählte Sportart wird nie überschrieben.

## 12 · Feldzensus — Belege ohne Login

Seit v8-447 hält der Worker je Aktivität fest, welche Felder und Reihen Garmin geliefert hat
(erhalten: Werte; nicht erhalten: nur der Name). Diese Abfrage zählt das je Sportart aus.
Sie ist **nur lesend**, ihr Ergebnis enthält ausschließlich Namen und Zählungen — keine Messwerte,
keine Zeiten, keine Orte, keine Nutzerkennungen.

Datei: `supabase/scripts/garmin_field_census.sql` · Supabase → SQL Editor → einfügen → Run.

```sql
{census_sql()}
```

## 13 · Mitschnitt — Belege für die Form der Antworten

`garmin-worker/scripts/capture_activity_payloads.py` ruft für je eine Aktivität je Garmin-Typ alle
Antworten ab und schreibt sie **anonymisiert** nach `garmin-worker/tests/fixtures/garmin/captures/`.

- Anmeldung interaktiv im Terminal (E-Mail, Passwort, ggf. MFA). Es gibt keine Token-Datei, nichts wird
  gespeichert.
- In der Datei stehen keine Zugangsdaten, keine E-Mail, keine Namen (auch nicht der Titel), keine Orte,
  keine Kennungen, nicht das echte Datum.
- GPS ist standardmäßig **aus**: Strecke geleert, Koordinaten auf 0. Mit `--with-gps` bleibt nur die
  Form der Strecke, auf 0/0 verschoben.
- Vor dem Schreiben prüft das Skript die Datei selbst und schreibt nicht, wenn etwas davon auffindbar ist.
- Es druckt einen Bericht: erkannt / erhalten / nicht erhalten — nur Feldnamen.

Voraussetzung: Python ≥ 3.12 (garminconnect 0.3.6). Einmalig aus `garmin-worker/`:

```
python3.12 -m venv .venv-capture && .venv-capture/bin/pip install -r requirements.txt
.venv-capture/bin/python scripts/capture_activity_payloads.py --dry-run
```

Ein Passwort-Login ist der einzige Schritt mit Sperr-Risiko bei Garmin (HTTP 429): einmal ausführen,
nicht wiederholen. Liegt ein Mitschnitt im Ordner, prüft `tests/test_capture_script.py` ihn automatisch.

## 14 · Einstellungen des Workers (Railway)

| Variable | Standard | Wirkung |
|---|---|---|
| `DETAIL_BACKFILL_LIMIT` | 10 | Aktivitäten je Sync-Lauf, für die Details (nach)geladen werden |
| `DETAIL_MAXCHART` | 0 (= Standard der Bibliothek, 2000) | wie viele Messzeilen Garmin je Aktivität höchstens liefern soll. Gleicher Abruf, gleiche Anzahl Calls, größere Antwort. Ob Garmin mehr als 2000 bedient, ist **nicht belegt** — ablesbar an `stream_rows` / `stream_total` (Zensus, Art `abtastung`). Gedeckelt auf 30 000. |
| `DETAIL_EXTRAS` | leer (aus) | kommagetrennt aus: {", ".join(detail_sync.EXTRAS)} |
| `ACTIVITY_PROVENANCE_BACKFILL_DAYS` | 0 | einmaliger Rückblick: so viele Tage zurück wird die **Liste** gelesen (ein Abruf), um Garmin-Typ, Ortszeit und Rohfelder bei Altzeilen nachzutragen. Erfasst Zeilen **ohne** Herkunftsblock und Zeilen, deren Block unvollständig ist (es fehlt {" oder ".join("`" + k + "`" for k in detail_sync.PROVENANCE_REQUIRED)}). Endet von selbst, sobald keine solche Zeile mehr im Fenster ist. |
| `DETAIL_REFETCH_RESOLUTION` | aus | lädt Aktivitäten, die schon auf Details-Vertrag {detail_sync.DETAILS_CONTRACT_VERSION} stehen, aber mit kleinerem `maxChartSize` geholt wurden, **einmal** neu (`detailsMaxchart` < `DETAIL_MAXCHART`). Nur zusammen mit `DETAIL_MAXCHART` > 0. Reihenfolge: nie geladene → Altvertrag → Auflösung, je neueste zuerst; dieselbe Grenze `DETAIL_BACKFILL_LIMIT`; Abbruch bei 429/401. Manuelle Korrekturen und Planverknüpfung bleiben erhalten. |

## 15 · Auswertung und Anzeige sind getrennt

Grundsatz seit v8-447.1:

| | Grundlage | Zweck |
|---|---|---|
| **Auswertung** | alle von Garmin gelieferten Messzeilen, vor der Ausdünnung | Bestwerte, Kennwerte — alles, was später festgeschrieben werden kann |
| **Anzeige** | `metrics.streams`, höchstens {series_normalize.STREAM_MAX} Punkte je Reihe | Diagramme |

Aus einer Anzeige-Reihe wird nie ein Rekord gerechnet. Der Worker rechnet beim Import und legt das Ergebnis
an die Aktivität (`metrics.best_efforts`); er schreibt keine Rekorde fest und vergleicht nichts über Aktivitäten hinweg.

**Leistung** (`best_efforts.power.windows`) — beste Durchschnittsleistung über {windows}:

- Fenster `[t, t + D]` auf der **verstrichenen** Zeit. Nie „N Messpunkte", nie Bewegungszeit.
- Eine **Pause** gehört in das Fenster und zählt 0 W. Bewegungsabschnitte werden nicht zusammengeklebt.
- **0 W** ist ein Messwert. Eine Zeile **ohne** Leistungswert zählt als 0 W — nicht interpoliert, nicht übersprungen;
  die betroffene Zeit steht am Fenster (`miss_s`). Das Ergebnis kann dadurch nur zu niedrig werden, nie zu hoch.
- Güte je Fenster: `exact` (Garmin lieferte alle Zeilen **und** die Uhr zeichnete sekündlich auf — die Zahl ist die
  Messung) · `approx` (ausgedünnt oder nicht sekündlich, mindestens {best_efforts.APPROX_MIN_SAMPLES} Abstände im Fenster —
  Näherung, **kein Rekord**) · `insufficient` (Auflösung reicht nicht — **keine Zahl gespeichert**).

**Strecke** (`best_efforts.distance.targets`, nur {", ".join(best_efforts.DISTANCE_SPORTS)}) — schnellste Zeit über {targets}:
das kürzeste Stück zwischen zwei **echten** Messzeilen, das die Zieldistanz erreicht. Keine Interpolation; die Zeit ist
gemessen, der Überhang (`over_m`) steht dabei. Die Zahl ist eine Obergrenze der wahren Bestzeit — nie zu schnell.

**Kennwerte** (`best_efforts.stats`) — Mittel und Maximum je Reihe aus allen gelieferten Zeilen; `avg` mit Nullen,
`avg_nz` ohne. Hat Garmin ausgedünnt (`native: false`), ist das Mittel eine Näherung.

**Auflösung:** Im ersten Mitschnitt lieferte Garmin mit dem Standard 1855 von 5527 aufgezeichneten Zeilen (Abstand 3 s) —
Leistungsfenster unter {best_efforts.APPROX_MIN_SAMPLES * 3} s wären `insufficient`, alle längeren `approx`. Die Auflösungsprüfung
vom 11.10.2026 (Gian, Trockenlauf, keine Dateien gespeichert) zeigt für **acht von acht** Aktivitäten: mit `maxChartSize=20000`
kommen sämtliche gemeldeten Zeilen, Median-Abstand 1 s. In Produktion ist das erst belegt, wenn der Worker mit
`DETAIL_MAXCHART=20000` gelaufen ist und der Zensus (Art `aufloesung`, `abtastung`) es zeigt.

## 15a · Bedeutungsprüfung

Ob ein Summenwert des Listeneintrags das bedeutet, was sein Name sagt, prüft der Worker gegen **alle gelieferten
Messzeilen** derselben Aktivität (`orvia_worker/semantic_checks.py`, Version {semantic_checks.SEM_VERSION}). Je Beziehung werden
mehrere Lesarten gerechnet — zeitgewichtet über die Timer-Zuwächse und je Messzeile, mit und ohne Nullwerte, voller Wert und
ein Bein (Kadenz), Bahnlänge in Metern und Zentimetern (Becken). Ergebnis je Beziehung: `match` (mit der passenden Lesart),
`mismatch` oder `n/a`, dazu Hinweise:

| Hinweis | Bedeutung |
|---|---|
| `thinned_response` | Garmin hat ausgedünnt — eine Abweichung kann von der Auflösung kommen, nicht von der Bedeutung |
| `two_definitions` | Bewegungszeit: Liste und Aufzeichnung nutzen verschiedene Stillstands-Schwellen — beide Zahlen sind „richtig“, aber nicht dieselbe Größe |
| `excludes_zero` | nur die Lesart ohne Nullwerte passt (Stillstand zählt nicht mit) |
| `list_moving_equals_timer` | Garmins Bewegungszeit ist gleich der Timerzeit — keine eigene Bewegungserkennung |
| `pool_lengths` | Beckendistanz weicht um ganze Bahnen ab (z. B. Start- oder Wendebahn nicht gezählt) |
| `distance_end_below_max` | die letzte Messzeile trägt nicht die größte Distanz (Korrektur am Ende der Aufzeichnung) |
| `half_value` / `near_full` | Kadenz entspricht einem Bein / knapp dem vollen Wert |

Gespeichert wird **nur das Urteil** (`metrics.ext.semantics`, serverseitig) und, bei vollständiger Lieferung, die bestätigte
Lesart (`metrics.garmin.semantics_ok`). Keine Rohwerte. Die App gibt die Ø-Laufkadenz nur frei, wenn sie so bestätigt ist.

Das Mitschnitt-Skript rechnet dieselbe Prüfung mit der Standard- **und** der vollständigen Antwort und benennt die Ursache
einer Abweichung: `stable` (gleiches Urteil), `thinning` (verschwindet mit voller Auflösung), `definition` (bleibt — die
Lesart unterscheidet sich).

## 16 · Fehlerklassen des Nachladens

| Klasse | Auslöser | Folge |
|---|---|---|
| `AUTH` | Sitzung ungültig (401) | Lauf endet sofort; Sync gilt als nicht erfolgreich; nichts wird einer Aktivität angelastet |
| `RATE_LIMIT` | Garmin bremst (429) | wie `AUTH`; der Zeitplaner verlängert die Pause; keine sofortige Wiederholung |
| `NETWORK` | nicht erreichbar, 5xx, Zeitüberschreitung | zählt nicht; nach {backfill.NETWORK_ABORT_AFTER} in Folge endet der Lauf |
| `NOT_FOUND` | Garmin kennt die Aktivität nicht (404/410) | zählt |
| `UNSUPPORTED` | Anfrage abgelehnt (400/405/406/409/415/422) | zählt |
| `MALFORMED` | Antwort ist keine lesbare Struktur | zählt |
| `PERSISTENCE` | Speichern in der Datenbank fehlgeschlagen | zählt nicht; nächster Lauf versucht es erneut |
| `UNKNOWN` | nicht einzuordnen (auch 403) | zählt nur, wenn im selben Lauf eine andere Aktivität gelang |

Nach {detail_sync.DETAIL_FAIL_MAX} gezählten Fehlern wird eine Aktivität {detail_sync.DETAIL_FAIL_RETRY_DAYS} Tage zurückgestellt
(`detailsFailCount`, `detailsFailedAt`, `detailsFailCategory`). Ein Erfolg löscht den Vermerk. Stand: `GARMIN-BACKFILL-STATUS.md`.

## 17 · Altlasten und offene Punkte

1. **Kadenz im Altbestand** — nicht umgerechnet, bis zum Nachladen ausgeblendet (Abschnitt 4).
2. **Bestzeiten können sich ändern**, sobald eine Aktivität ihre echte Zeitachse hat: die App rechnet
   Fenster dann mit gemessener statt gleichverteilter Zeit. Deshalb werden in v8-447 keine Rekorde
   festgeschrieben; `activityCapabilities.ledgerEligible` sperrt Zeilen unter Vertrag 3.
3. **Rohfelder des Listeneintrags im Altbestand** — bestehende Zeilen werden nur innerhalb des
   Sync-Fensters nachgetragen; für die Zeit davor `ACTIVITY_PROVENANCE_BACKFILL_DAYS` setzen. Unvollständige
   Blöcke zählt der Zensus (Art `herkunft_unvollstaendig`).
4. **Tageszuordnung manueller Einträge** (Abschnitt 3).
5. **Zusatzabrufe** sind aus, bis ihre Antwortformen belegt sind (Abschnitt 9).
6. **Einheiten** `avgStrideLength`, `avgVerticalOscillation`, `avgStrokeDistance`, `totalVolume` sind
   unbelegt — die Werte bleiben roh, eine Anzeige braucht erst den Beleg.
7. **Ø-Kadenz des Listeneintrags** (`averageRunningCadenceInStepsPerMinute`): welche Lesart gilt, entscheidet
   je Aktivität die Bedeutungsprüfung (Abschnitt 15a). Ohne Bestätigung bleibt der Wert gesperrt.
8. **Serverliste** — die App lädt beim Öffnen bis zu 200 Aktivitäten samt Messreihen. Der Rohblock
   vergrößert diese Antwort. Messreihen und Rohblock erst beim Öffnen einer Einheit zu laden, ist ein
   eigener Schritt.
9. **`started_at` ohne Zonenangabe** — der Worker schreibt Garmins GMT-Text ohne „Z"; richtig, solange
   die Datenbank in UTC läuft (Supabase-Standard).
"""]
    return "\n".join(parts).rstrip() + "\n"


def main() -> int:
    text = render()
    if "--check" in sys.argv:
        cur = DOC.read_text(encoding="utf-8") if DOC.exists() else ""
        if cur != text:
            print("GARMIN-CAPABILITY-MATRIX.md ist veraltet — scripts/gen_capability_matrix.py ausfuehren.")
            return 1
        print("Matrix aktuell.")
        return 0
    DOC.parent.mkdir(parents=True, exist_ok=True)
    DOC.write_text(text, encoding="utf-8")
    print(f"geschrieben: {DOC} ({len(text)} Zeichen)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
