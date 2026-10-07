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

from orvia_worker import detail_sync, garmin_fields as GF, normalize, series_normalize  # noqa: E402

DOC = HERE.parents[1] / "app" / "docs" / "GARMIN-CAPABILITY-MATRIX.md"

HEAD = ("FIELD", "SPORT", "ENDPOINT", "RAW FIELD NAME", "RAW AVAILABLE?", "IMPORTED?", "STORED?", "DISPLAYED?",
        "SERIES/SUMMARY", "UNITS", "NORMALIZATION", "LOSSY?", "HIGHLIGHT-READY?", "NOTES")
EP = {"list": "get_activities_by_date", "details": "get_activity_details"}
AVAIL = {"fixture": "ja (Mitschnitt Lauf)", "library": "laut Bibliothek", "assumed": "unbelegt"}
READY = {"fixture": "ja", "library": "nach Mitschnitt", "assumed": "nach Mitschnitt"}
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
    return [(c["field"], _sports(c["sports"]), EP[c["ep"]], f"`{c['raw']}`", AVAIL[c["evidence"]], "ja", f"`{c['stored']}`",
             c["shown"], c["shape"], c["unit"], c["norm"], c["lossy"], c["ready"], c["note"]) for c in GF.CANONICAL]


def rows_known() -> list[tuple]:
    return [(GROUP[f["group"]], _sports(f["sports"]), EP["list"], f"`{f['key']}`", AVAIL[f["evidence"]], "ja, wenn geliefert",
             f"`metrics.ext.fields.{f['key']}`", "nein", "summary", f["unit"], "keine (Rohwert)", "nein", READY[f["evidence"]], f["note"])
            for f in GF.KNOWN]


def rows_series() -> list[tuple]:
    return [(GROUP[f["group"]], _sports(f["sports"]), EP["details"], f"`{f['key']}`", AVAIL[f["evidence"]], "ja, wenn geliefert",
             f"`metrics.ext.series.{f['key']}`", "nein", "series", f["unit"] + " (maßgeblich: garmin_unit der Antwort)",
             "keine (Rohwert, gleicher Index wie die Zeitachse)", "ja: Ausdünnung", READY[f["evidence"]], f["note"])
            for f in GF.SERIES_KNOWN]


def rows_extras() -> list[tuple]:
    return [(EXTRA_WHAT[name], _sports(sports), EXTRA_METHOD[name], "Antwortform unbelegt", AVAIL["library"] + " (Methode); Form unbelegt",
             "nur mit `DETAIL_EXTRAS`", f"`{EXTRA_STORE[name]}`", "nein", "structure", "—",
             "Form erhalten, nur Messwerte (keep_structure)", "ja: private Felder, Koordinaten, Deckel 400 Einträge", "nach Mitschnitt",
             "standardmäßig AUS") for name, sports in detail_sync.EXTRAS.items()]


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
    n_fix = sum(1 for c in GF.CANONICAL if c["evidence"] == "fixture")
    n_lib = sum(1 for f in GF.KNOWN if f["evidence"] == "library") + sum(1 for c in GF.CANONICAL if c["evidence"] == "library")
    n_ass = (sum(1 for f in GF.KNOWN if f["evidence"] == "assumed") + len(GF.SERIES_KNOWN)
             + sum(1 for c in GF.CANONICAL if c["evidence"] == "assumed"))
    reach = sorted(set(normalize.SPORT_MAP.values()))
    parts = [f"""# Garmin-Fähigkeits-Matrix

**Status: IMPLEMENTED** · Stand v8-447 · Worker Details-Vertrag {detail_sync.DETAILS_CONTRACT_VERSION} · Rohblock-Version {GF.EXT_VERSION}

> Diese Datei wird **erzeugt**: `python garmin-worker/scripts/gen_capability_matrix.py`.
> Die Tabellen stammen aus dem Code des Workers (`garmin_fields.py`, `detail_sync.py`, `normalize.py`).
> Nicht von Hand ändern — ein Test vergleicht Datei und Code.

Was Garmin je Aktivität liefert, was davon importiert, gespeichert und angezeigt wird, was dabei
verloren geht und wie gut jede Aussage belegt ist. Grundsatz seit v8-447: **erhalten, nicht deuten** —
Rohwerte bleiben unter ihrem Garmin-Namen, nichts wird erfunden, nichts stillschweigend umgerechnet.

## 1 · Wie belastbar ist eine Zeile? (Belegstufen)

| Stufe | Bedeutung | Anzahl Zeilen |
|---|---|---|
| **fixture** | in einem echten, anonymisierten Mitschnitt im Repo gesehen | {n_fix} |
| **library** | im typisierten Modell der eingesetzten Bibliothek (garminconnect 0.3.6) benannt | {n_lib} |
| **assumed** | üblicher Garmin-Connect-Name, hier **nicht** belegt | {n_ass} |

Im Repo liegt genau **ein** echter Mitschnitt: die Detailantwort **eines Laufs**
(`garmin-worker/tests/fixtures/garmin/activity_details.json`). Es gibt keinen echten Listeneintrag,
keinen Rad-, Schwimm- oder Kraft-Mitschnitt und keine Antwort der Zusatzabrufe. Alles
Sportartspezifische außerhalb der Lauf-Messreihen ist deshalb *library* oder *assumed*.
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
| `DETAIL_EXTRAS` | leer (aus) | kommagetrennt aus: {", ".join(detail_sync.EXTRAS)} |
| `ACTIVITY_PROVENANCE_BACKFILL_DAYS` | 0 | einmaliger Rückblick: so viele Tage zurück wird die **Liste** gelesen (ein Abruf), um Garmin-Typ, Ortszeit und Rohfelder bei Altzeilen nachzutragen. Endet von selbst, sobald keine Zeile mehr ohne Herkunftsblock ist. |

## 15 · Altlasten und offene Punkte

1. **Kadenz im Altbestand** — nicht umgerechnet, bis zum Nachladen ausgeblendet (Abschnitt 4).
2. **Bestzeiten können sich ändern**, sobald eine Aktivität ihre echte Zeitachse hat: die App rechnet
   Fenster dann mit gemessener statt gleichverteilter Zeit. Deshalb werden in v8-447 keine Rekorde
   festgeschrieben; `activityCapabilities.ledgerEligible` sperrt Zeilen unter Vertrag 3.
3. **Rohfelder des Listeneintrags im Altbestand** — bestehende Zeilen werden nur innerhalb des
   Sync-Fensters nachgetragen; für die Zeit davor `ACTIVITY_PROVENANCE_BACKFILL_DAYS` setzen.
4. **Tageszuordnung manueller Einträge** (Abschnitt 3).
5. **Zusatzabrufe** sind aus, bis ihre Antwortformen belegt sind (Abschnitt 9).
6. **Einheiten** `avgStrideLength`, `avgVerticalOscillation`, `avgStrokeDistance`, `totalVolume` sind
   unbelegt — die Werte bleiben roh, eine Anzeige braucht erst den Beleg.
7. **Ø-Kadenz des Listeneintrags** (`averageRunningCadenceInStepsPerMinute`): ob voller Wert oder ein
   Bein, ist nicht belegt. Maßgeblich ist die Messreihe.
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
