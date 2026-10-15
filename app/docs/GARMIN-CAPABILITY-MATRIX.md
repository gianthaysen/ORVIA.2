# Garmin-Fähigkeits-Matrix

**Status: IMPLEMENTED** · Stand Worker v8-447.3 · Details-Vertrag 3 · Rohblock-Version 1

> Diese Datei wird **erzeugt**: `python garmin-worker/scripts/gen_capability_matrix.py`.
> Die Tabellen stammen aus dem Code des Workers (`garmin_fields.py`, `detail_sync.py`, `normalize.py`).
> Nicht von Hand ändern — ein Test vergleicht Datei und Code.

Was Garmin je Aktivität liefert, was davon importiert, gespeichert und angezeigt wird, was dabei
verloren geht und wie gut jede Aussage belegt ist. Grundsatz seit v8-447: **erhalten, nicht deuten** —
Rohwerte bleiben unter ihrem Garmin-Namen, nichts wird erfunden, nichts stillschweigend umgerechnet.

## 1 · Wie belastbar ist eine Zeile? (Belegstufen)

| Stufe | Bedeutung | Zeilen (Teil A–C) |
|---|---|---|
| **OBSERVED_PRODUCTION** | im Produktions-Zensus für die Sportart gezählt | 0 |
| **OBSERVED_FIXTURE** | in einem echten, anonymisierten Mitschnitt im Repo gesehen | 12 |
| **LIBRARY_DOCUMENTED** | im typisierten Modell der eingesetzten Bibliothek (garminconnect 0.3.6) benannt | 43 |
| **ASSUMED** | üblicher Garmin-Connect-Name, hier **nicht** belegt | 67 |
| **ABSENT** | im Zensus nie geliefert, obwohl mindestens 5 passende Aktivitäten vorliegen | 0 |

**Noch kein Produktions-Zensus erhoben.** Jede Zeile steht auf der Stufe aus dem Code; `OBSERVED_PRODUCTION` und `ABSENT` kommen erst mit dem Zensus (Abschnitt 12).

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
- Jede Reihe trägt ihre Bedeutung: `metrics.stream_meta.<reihe> = {kind, unit, source, garmin_unit}`.

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
| gespeichert | `stream_kept` (Deckel 300 je Reihe) | 266 |

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

| FIELD | SPORT | ENDPOINT | RAW FIELD NAME | RAW AVAILABLE? | IMPORTED? | STORED? | DISPLAYED? | SERIES/SUMMARY | UNITS | NORMALIZATION | LOSSY? | HIGHLIGHT-READY? | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Start (UTC) | alle | get_activities_by_date | `startTimeGMT` | LIBRARY_DOCUMENTED | ja | `activities.started_at` | ja | summary | UTC | keine | nein | ja | — |
| Start (Ortszeit) | alle | get_activities_by_date | `startTimeLocal` | LIBRARY_DOCUMENTED | ja | `metrics.garmin.start_local` | ja | summary | Wandzeit | keine | nein | ja | neu in v8-447; bis v8-446 verworfen |
| UTC-Versatz | alle | get_activities_by_date | `startTimeLocal − startTimeGMT` | LIBRARY_DOCUMENTED | ja | `metrics.garmin.utc_offset_s` | nein | summary | s | Differenz der zwei gelieferten Zeiten | nein | ja | nur in Viertelstunden, sonst kein Wert |
| Sportart | alle | get_activities_by_date | `activityType.typeKey` | LIBRARY_DOCUMENTED | ja | `activities.sport_id` | ja | summary | enum | SPORT_MAP (viele → eine) | ja: Untertyp | ja | — |
| Garmin-Typ | alle | get_activities_by_date | `activityType.typeKey` | LIBRARY_DOCUMENTED | ja | `metrics.garmin.type_key` | nein | summary | enum | Kleinschreibung | nein | ja | neu in v8-447: Bahn / Freiwasser, Trail / Laufband, Rolle / Strasse |
| Garmin-Obertyp | alle | get_activities_by_date | `activityType.parentTypeId` | LIBRARY_DOCUMENTED | ja | `metrics.garmin.parent_type_id` | nein | summary | enum-Nr. | keine | nein | nein | — |
| Dauer (Timer) | alle | get_activities_by_date | `duration` | LIBRARY_DOCUMENTED | ja | `activities.duration_seconds` | ja | summary | s | auf ganze Sekunden gerundet | ja: < 1 s | ja | Rohwert zusaetzlich in metrics.ext.fields.duration |
| Distanz | alle | get_activities_by_date | `distance` | LIBRARY_DOCUMENTED | ja | `summary.distance_m` | ja | summary | m | keine | nein | ja | — |
| Ø Herzfrequenz | alle | get_activities_by_date | `averageHR` | LIBRARY_DOCUMENTED | ja | `summary.avg_hr` | ja | summary | bpm | keine | nein | ja | — |
| Max. Herzfrequenz | alle | get_activities_by_date | `maxHR` | LIBRARY_DOCUMENTED | ja | `summary.max_hr` | ja | summary | bpm | keine | nein | ja | — |
| Kalorien | alle | get_activities_by_date | `calories` | LIBRARY_DOCUMENTED | ja | `summary.calories_kcal` | ja | summary | kcal | keine | nein | nein | — |
| Hoehenmeter | alle | get_activities_by_date | `elevationGain` | LIBRARY_DOCUMENTED | ja | `summary.elevation_gain_m` | ja | summary | m | keine | nein | ja | — |
| Ø Geschwindigkeit | alle | get_activities_by_date | `averageSpeed` | LIBRARY_DOCUMENTED | ja | `summary.avg_speed_mps` | ja | summary | m/s | keine | nein | ja | — |
| Ø Leistung | cycling, running | get_activities_by_date | `avgPower` | LIBRARY_DOCUMENTED | ja | `summary.avg_power_w` | ja | summary | W | keine | nein | nach Mitschnitt | — |
| Max. Leistung | cycling, running | get_activities_by_date | `maxPower` | LIBRARY_DOCUMENTED | ja | `summary.max_power_w` | ja | summary | W | keine | nein | nach Mitschnitt | — |
| Normalisierte Leistung | cycling, running | get_activities_by_date | `normPower` | LIBRARY_DOCUMENTED | ja | `summary.norm_power_w` | ja | summary | W | keine | nein | nach Mitschnitt | — |
| Trainingsbelastung | alle | get_activities_by_date | `activityTrainingLoad` | LIBRARY_DOCUMENTED | ja | `metrics.training_load` | ja | summary | Garmin-Last | keine | nein | nein | — |
| Titel | alle | get_activities_by_date | `activityName` | LIBRARY_DOCUMENTED | ja | `summary.name` | ja | summary | Text | keine | nein | nein | frei geschriebener Text des Nutzers — bleibt in summary, nie im Rohblock |
| Zeitachse | alle | get_activity_details | `directTimestamp` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.streams.time` | indirekt (Bestzeiten) | series | s seit Beginn | ms GMT → Sekunden seit der ersten Zeile | ja: Ausduennung | ja | neu in v8-447; Ersatzquelle sumElapsedDuration; nur lueckenlos und monoton |
| Herzfrequenz | alle | get_activity_details | `directHeartRate` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.streams.heart_rate` | ja | series | bpm | keine | ja: Ausduennung | ja | — |
| Geschwindigkeit | alle | get_activity_details | `directSpeed` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.streams.speed` | ja | series | m/s | keine | ja: Ausduennung | ja | — |
| Distanz (kumulativ) | alle | get_activity_details | `sumDistance` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.streams.distance` | indirekt (Bestzeiten) | series | m | keine | ja: Ausduennung | ja | — |
| Hoehe | alle | get_activity_details | `directElevation \| directCorrectedElevation` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.streams.elevation` | ja | series | m | keine | ja: Ausduennung | ja | — |
| Schrittfrequenz | running | get_activity_details | `directDoubleCadence` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.streams.cadence` | ja | series | spm | keine (kind running_cadence_spm) | ja: Ausduennung | ja | bis v8-446 wurde directRunCadence (ein Bein) gelesen — halber Wert |
| Schrittfrequenz (Ersatz) | running | get_activity_details | `directRunCadence + directFractionalCadence` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.streams.cadence` | ja | series | spm | 2 × (Run + Fractional), markiert als derived | ja: Ausduennung | ja | nur wenn directDoubleCadence fehlt |
| Trittfrequenz | cycling | get_activity_details | `directBikeCadence` | ASSUMED | ja | `metrics.streams.cadence` | ja | series | rpm | keine (kind cycling_cadence_rpm) | ja: Ausduennung | nach Mitschnitt | Name unbelegt — kein Rad-Mitschnitt |
| Leistung | cycling, running | get_activity_details | `directPower` | ASSUMED | ja | `metrics.streams.power` | ja | series | W | keine | ja: Ausduennung | nach Mitschnitt | Name unbelegt; fuer 1–15-s-Bestwerte reicht die Aufloesung nicht |
| Strecke | alle | get_activity_details | `geoPolylineDTO.polyline[].lat/lon` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.route` | ja | series | Grad | auf hoechstens 600 Punkte reduziert | ja: Zeit, Hoehe und Tempo je Punkt | ja | — |
| Bewegungszeit | alle | get_activity_details | `sumMovingDuration (letzte Zeile)` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.garmin.moving_duration_s` | nein | summary | s | auf 0,1 s gerundet | nein | ja | neu in v8-447; Listenfeld movingDuration zusaetzlich im Rohblock |
| Verstrichene Zeit | alle | get_activity_details | `sumElapsedDuration (letzte Zeile)` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.garmin.elapsed_duration_s` | nein | summary | s | auf 0,1 s gerundet | nein | ja | neu in v8-447 |
| Timer-Zeit | alle | get_activity_details | `sumDuration (letzte Zeile)` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.garmin.timer_duration_s` | nein | summary | s | auf 0,1 s gerundet | nein | ja | neu in v8-447 |
| Abtastung | alle | get_activity_details | `totalMetricsCount / Zeilenzahl` | OBSERVED_FIXTURE (Mitschnitt Lauf) | ja | `metrics.garmin.stream_total / stream_rows / stream_kept` | nein | summary | Anzahl | keine | nein | nein | aufgezeichnet → von Garmin geliefert → gespeichert |

## 7 · Teil B — Rohfelder des Listeneintrags (`metrics.ext.fields`)

Erhalten wird jedes dieser Felder **genau dann**, wenn Garmin es liefert — unter seinem Garmin-Namen, ohne
Umrechnung. Zusätzlich bleibt jedes weitere skalare Feld erhalten, dessen Name nach einem Messwert aussieht
(`MEASURE_PARTS`); alles Übrige wird dem Namen nach vermerkt (`metrics.ext.unrecognized`).
`metrics.ext` liegt nur auf dem Server und in der Serverliste der App, nie im lokalen Speicher des Geräts.

| FIELD | SPORT | ENDPOINT | RAW FIELD NAME | RAW AVAILABLE? | IMPORTED? | STORED? | DISPLAYED? | SERIES/SUMMARY | UNITS | NORMALIZATION | LOSSY? | HIGHLIGHT-READY? | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Zeit | alle | get_activities_by_date | `duration` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.duration` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | Timer-Dauer; wird in die Spalte duration_seconds uebernommen |
| Zeit | alle | get_activities_by_date | `movingDuration` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.movingDuration` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zeit | alle | get_activities_by_date | `elapsedDuration` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.elapsedDuration` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `distance` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.distance` | nein | summary | m | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `elevationGain` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.elevationGain` | nein | summary | m | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `elevationLoss` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.elevationLoss` | nein | summary | m | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `minElevation` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.minElevation` | nein | summary | m | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `maxElevation` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.maxElevation` | nein | summary | m | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `steps` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.steps` | nein | summary | count | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Struktur | alle | get_activities_by_date | `lapCount` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.lapCount` | nein | summary | count | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Tempo | alle | get_activities_by_date | `averageSpeed` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.averageSpeed` | nein | summary | m/s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Tempo | alle | get_activities_by_date | `maxSpeed` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.maxSpeed` | nein | summary | m/s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Herz | alle | get_activities_by_date | `averageHR` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.averageHR` | nein | summary | bpm | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Herz | alle | get_activities_by_date | `maxHR` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.maxHR` | nein | summary | bpm | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Herz | alle | get_activities_by_date | `minHR` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.minHR` | nein | summary | bpm | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Energie | alle | get_activities_by_date | `calories` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.calories` | nein | summary | kcal | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Energie | alle | get_activities_by_date | `bmrCalories` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.bmrCalories` | nein | summary | kcal | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `activityTrainingLoad` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.activityTrainingLoad` | nein | summary | garmin_load | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `aerobicTrainingEffect` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.aerobicTrainingEffect` | nein | summary | 0-5 | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `anaerobicTrainingEffect` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.anaerobicTrainingEffect` | nein | summary | 0-5 | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `trainingEffectLabel` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.trainingEffectLabel` | nein | summary | enum | keine (Rohwert) | nein | nach Zensus / Mitschnitt | Hauptnutzen laut Garmin |
| Belastung / Wirkung | alle | get_activities_by_date | `aerobicTrainingEffectMessage` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.aerobicTrainingEffectMessage` | nein | summary | enum | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `anaerobicTrainingEffectMessage` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.anaerobicTrainingEffectMessage` | nein | summary | enum | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `moderateIntensityMinutes` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.moderateIntensityMinutes` | nein | summary | min | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `vigorousIntensityMinutes` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.vigorousIntensityMinutes` | nein | summary | min | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | running, cycling | get_activities_by_date | `vO2MaxValue` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.vO2MaxValue` | nein | summary | ml/kg/min | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | alle | get_activities_by_date | `hrTimeInZone_1` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.hrTimeInZone_1` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | alle | get_activities_by_date | `hrTimeInZone_2` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.hrTimeInZone_2` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | alle | get_activities_by_date | `hrTimeInZone_3` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.hrTimeInZone_3` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | alle | get_activities_by_date | `hrTimeInZone_4` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.hrTimeInZone_4` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | alle | get_activities_by_date | `hrTimeInZone_5` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.hrTimeInZone_5` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | cycling, running | get_activities_by_date | `powerTimeInZone_1` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_1` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | cycling, running | get_activities_by_date | `powerTimeInZone_2` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_2` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | cycling, running | get_activities_by_date | `powerTimeInZone_3` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_3` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | cycling, running | get_activities_by_date | `powerTimeInZone_4` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_4` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | cycling, running | get_activities_by_date | `powerTimeInZone_5` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_5` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | cycling | get_activities_by_date | `powerTimeInZone_6` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_6` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Zonen | cycling | get_activities_by_date | `powerTimeInZone_7` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_7` | nein | summary | s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Leistung | cycling, running | get_activities_by_date | `avgPower` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.avgPower` | nein | summary | W | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Leistung | cycling, running | get_activities_by_date | `maxPower` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.maxPower` | nein | summary | W | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Leistung | cycling, running | get_activities_by_date | `normPower` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.normPower` | nein | summary | W | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Leistung | cycling | get_activities_by_date | `max20MinPower` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.max20MinPower` | nein | summary | W | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Leistung | cycling | get_activities_by_date | `intensityFactor` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.intensityFactor` | nein | summary | ratio | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Leistung | cycling | get_activities_by_date | `trainingStressScore` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.trainingStressScore` | nein | summary | tss | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Leistung | cycling | get_activities_by_date | `avgLeftBalance` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.avgLeftBalance` | nein | summary | % | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Laufdynamik | running | get_activities_by_date | `averageRunningCadenceInStepsPerMinute` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.averageRunningCadenceInStepsPerMinute` | nein | summary | spm | keine (Rohwert) | nein | nach Zensus / Mitschnitt | Name sagt Schritte/min — ob voller Wert oder ein Bein, ist am Listeneintrag NICHT belegt; die Messreihe (directDoubleCadence) ist der belegte Wert |
| Laufdynamik | running | get_activities_by_date | `maxRunningCadenceInStepsPerMinute` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.maxRunningCadenceInStepsPerMinute` | nein | summary | spm | keine (Rohwert) | nein | nach Zensus / Mitschnitt | siehe Durchschnitt |
| Laufdynamik | running | get_activities_by_date | `avgStrideLength` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.avgStrideLength` | nein | summary | cm | keine (Rohwert) | nein | nach Zensus / Mitschnitt | Einheit unbelegt |
| Laufdynamik | running | get_activities_by_date | `avgGroundContactTime` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.avgGroundContactTime` | nein | summary | ms | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Laufdynamik | running | get_activities_by_date | `avgVerticalOscillation` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.avgVerticalOscillation` | nein | summary | cm | keine (Rohwert) | nein | nach Zensus / Mitschnitt | Einheit unbelegt |
| Laufdynamik | running | get_activities_by_date | `avgVerticalRatio` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.avgVerticalRatio` | nein | summary | % | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Laufdynamik | running | get_activities_by_date | `avgGroundContactBalance` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.avgGroundContactBalance` | nein | summary | % | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Laufdynamik | running | get_activities_by_date | `avgGradeAdjustedSpeed` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.avgGradeAdjustedSpeed` | nein | summary | m/s | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Rad | cycling | get_activities_by_date | `averageBikingCadenceInRevPerMinute` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.averageBikingCadenceInRevPerMinute` | nein | summary | rpm | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Rad | cycling | get_activities_by_date | `maxBikingCadenceInRevPerMinute` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.maxBikingCadenceInRevPerMinute` | nein | summary | rpm | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activities_by_date | `poolLength` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.poolLength` | nein | summary | siehe unitOfPoolLength | keine (Rohwert) | nein | nach Zensus / Mitschnitt | Meter oder Yards |
| Schwimmen / Rudern | swimming | get_activities_by_date | `unitOfPoolLength` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.unitOfPoolLength` | nein | summary | enum | keine (Rohwert) | nein | nach Zensus / Mitschnitt | geschachtelt: unitKey |
| Schwimmen / Rudern | swimming | get_activities_by_date | `activeLengths` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.activeLengths` | nein | summary | count | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming, rowing | get_activities_by_date | `strokes` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.strokes` | nein | summary | count | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activities_by_date | `avgStrokes` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.avgStrokes` | nein | summary | count/length | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activities_by_date | `averageSwolf` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.averageSwolf` | nein | summary | swolf | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activities_by_date | `averageSwimCadenceInStrokesPerMinute` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.averageSwimCadenceInStrokesPerMinute` | nein | summary | strokes/min | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activities_by_date | `maxSwimCadenceInStrokesPerMinute` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.maxSwimCadenceInStrokesPerMinute` | nein | summary | strokes/min | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming, rowing | get_activities_by_date | `avgStrokeDistance` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.avgStrokeDistance` | nein | summary | cm | keine (Rohwert) | nein | nach Zensus / Mitschnitt | Einheit unbelegt |
| Kraft | gym | get_activities_by_date | `totalSets` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.totalSets` | nein | summary | count | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Kraft | gym | get_activities_by_date | `activeSets` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.activeSets` | nein | summary | count | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Kraft | gym | get_activities_by_date | `totalReps` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.totalReps` | nein | summary | count | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Kraft | gym | get_activities_by_date | `totalVolume` | LIBRARY_DOCUMENTED | ja, wenn geliefert | `metrics.ext.fields.totalVolume` | nein | summary | g? | keine (Rohwert) | nein | nach Zensus / Mitschnitt | Einheit unbelegt (Gramm oder Kilogramm) |
| Umgebung | alle | get_activities_by_date | `minTemperature` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.minTemperature` | nein | summary | °C | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |
| Umgebung | alle | get_activities_by_date | `maxTemperature` | ASSUMED | ja, wenn geliefert | `metrics.ext.fields.maxTemperature` | nein | summary | °C | keine (Rohwert) | nein | nach Zensus / Mitschnitt | — |

## 8 · Teil C — Zusatz-Messreihen der Detailantwort (`metrics.ext.series`)

Höchstens 8 Reihen je Aktivität, bekannte zuerst. Jede weitere Reihe, deren Name nach einem
Messwert aussieht, bleibt ebenfalls erhalten; der Rest wird dem Namen nach vermerkt
(`metrics.ext.series_unparsed`). **Alle Namen dieser Tabelle sind Annahmen.**

| FIELD | SPORT | ENDPOINT | RAW FIELD NAME | RAW AVAILABLE? | IMPORTED? | STORED? | DISPLAYED? | SERIES/SUMMARY | UNITS | NORMALIZATION | LOSSY? | HIGHLIGHT-READY? | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Laufdynamik | running | get_activity_details | `directGroundContactTime` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directGroundContactTime` | nein | series | ms (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Laufdynamik | running | get_activity_details | `directVerticalOscillation` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directVerticalOscillation` | nein | series | cm (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | Einheit laut Antwort (garmin_unit) |
| Laufdynamik | running | get_activity_details | `directStrideLength` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directStrideLength` | nein | series | cm (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | Einheit laut Antwort (garmin_unit) |
| Laufdynamik | running | get_activity_details | `directVerticalRatio` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directVerticalRatio` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Laufdynamik | running | get_activity_details | `directGroundContactBalanceLeft` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directGroundContactBalanceLeft` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Laufdynamik | running | get_activity_details | `directGradeAdjustedSpeed` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directGradeAdjustedSpeed` | nein | series | m/s (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Rad | cycling | get_activity_details | `directLeftBalance` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directLeftBalance` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Rad | cycling | get_activity_details | `directLeftTorqueEffectiveness` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directLeftTorqueEffectiveness` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Rad | cycling | get_activity_details | `directRightTorqueEffectiveness` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directRightTorqueEffectiveness` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Rad | cycling | get_activity_details | `directLeftPedalSmoothness` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directLeftPedalSmoothness` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Rad | cycling | get_activity_details | `directRightPedalSmoothness` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directRightPedalSmoothness` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activity_details | `directSwimCadence` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directSwimCadence` | nein | series | strokes/min (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming, rowing | get_activity_details | `directStrokeCadence` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directStrokeCadence` | nein | series | strokes/min (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activity_details | `directSwolf` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directSwolf` | nein | series | swolf (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Schwimmen / Rudern | swimming, rowing | get_activity_details | `directStrokes` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directStrokes` | nein | series | count (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Umgebung | alle | get_activity_details | `directAirTemperature` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directAirTemperature` | nein | series | °C (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | alle | get_activity_details | `directRespirationRate` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directRespirationRate` | nein | series | breaths/min (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | running, cycling | get_activity_details | `directPerformanceCondition` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directPerformanceCondition` | nein | series | score (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | running, cycling | get_activity_details | `directAvailableStamina` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directAvailableStamina` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |
| Belastung / Wirkung | running, cycling | get_activity_details | `directPotentialStamina` | ASSUMED | ja, wenn geliefert | `metrics.ext.series.directPotentialStamina` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Zensus / Mitschnitt | — |

## 9 · Teil D — Zusatzabrufe je Aktivität

Verdrahtet, aber **standardmäßig aus**: jede Zeile ist ein weiterer Abruf je Aktivität an einer
inoffiziellen Schnittstelle, und keine der Antwortformen ist im Repo belegt. Einschalten über die
Einstellung `DETAIL_EXTRAS` (Abschnitt 14) — sinnvoll erst nach einem Mitschnitt je Sportart.
Ein fehlgeschlagener Abruf wird als `failed` vermerkt (`metrics.ext.extras`) und bricht nichts ab.

| FIELD | SPORT | ENDPOINT | RAW FIELD NAME | RAW AVAILABLE? | IMPORTED? | STORED? | DISPLAYED? | SERIES/SUMMARY | UNITS | NORMALIZATION | LOSSY? | HIGHLIGHT-READY? | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| volle Zusammenfassung (summaryDTO) | alle | get_activity | Antwortform unbelegt | LIBRARY_DOCUMENTED (Methode); Form ASSUMED | nur mit `DETAIL_EXTRAS` | `metrics.ext.fields (ergänzt, Listeneintrag bleibt führend)` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS · keine Zusatzbedingung |
| Runden | running, cycling, swimming, rowing, hiking, walking, triathlon, athletics, hyrox | get_activity_splits | Antwortform unbelegt | LIBRARY_DOCUMENTED (Methode); Form ASSUMED | nur mit `DETAIL_EXTRAS` | `metrics.ext.splits + metrics.splits (schlanke Form)` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS · keine Zusatzbedingung |
| Intervalle / Bahnen | swimming, running, cycling | get_activity_typed_splits | Antwortform unbelegt | LIBRARY_DOCUMENTED (Methode); Form ASSUMED | nur mit `DETAIL_EXTRAS` | `metrics.ext.typed_splits` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS · swimming nur bei Garmin-Typ `lap_swimming` |
| Zeit je Herzfrequenz-Zone | alle | get_activity_hr_in_timezones | Antwortform unbelegt | LIBRARY_DOCUMENTED (Methode); Form ASSUMED | nur mit `DETAIL_EXTRAS` | `metrics.ext.hr_zones` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS · nur wenn die Aufzeichnung die Reihe `heart_rate` hat |
| Zeit je Leistungs-Zone | cycling | get_activity_power_in_timezones | Antwortform unbelegt | LIBRARY_DOCUMENTED (Methode); Form ASSUMED | nur mit `DETAIL_EXTRAS` | `metrics.ext.power_zones` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS · nur wenn die Aufzeichnung die Reihe `power` hat |
| Sätze (Übung, Wiederholungen, Gewicht) | gym | get_activity_exercise_sets | Antwortform unbelegt | LIBRARY_DOCUMENTED (Methode); Form ASSUMED | nur mit `DETAIL_EXTRAS` | `metrics.ext.exercise_sets` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS · keine Zusatzbedingung |

## 10 · Bewusst nicht gespeichert

**Nie**, auch nicht dem Namen nach: Felder, deren Name eines dieser Wörter enthält —
address, avatar, birth, birthday, city, comment, comments, conversation, country, course, description, device, email, favorite, gear, gender, image, kudos, lat, latitude, lng, location, lon, longitude, mail, note, notes, owner, password, photo, place, privacy, profile, role, roles, secret, serial, token, uri, url, user, uuid — sowie jede Kennung (`…Id`, `…Pk`) außer
`eventTypeId`, `parentTypeId`, `sportTypeId`, `typeId`. Geprüft wird je Wort des Feldnamens
(`avgVerticalOscillation` fällt nicht wegen „lat" weg). Frei geschriebener Text bleibt nur an einer
Stelle: der Titel der Aktivität in `summary.name`.

Reihen der Detailantwort, die nicht zusätzlich abgelegt werden:

| Reihe der Detailantwort | Was damit geschieht |
|---|---|
| `directBikeCadence` | steht als streams.cadence (Trittfrequenz) |
| `directBodyBattery` | Tageswert, keine Trainingsmessreihe (steht in user_metrics) — nicht gespeichert |
| `directCorrectedElevation` | Ersatzquelle für streams.elevation |
| `directDoubleCadence` | steht als streams.cadence (Schrittfrequenz) |
| `directElevation` | steht als streams.elevation |
| `directFractionalCadence` | Nachkommaanteil von directRunCadence |
| `directHeartRate` | steht als streams.heart_rate |
| `directLatitude` | steht als Strecke (route) |
| `directLongitude` | steht als Strecke (route) |
| `directPower` | steht als streams.power |
| `directRunCadence` | ein Bein; nur zur Bildung der Schrittfrequenz, wenn Double fehlt |
| `directSpeed` | steht als streams.speed |
| `directTimestamp` | steht als Zeitachse (streams.time) |
| `directUncorrectedElevation` | Rohhöhe vor Korrektur — nicht gespeichert |
| `directVerticalSpeed` | Ableitung der Höhe — nicht gespeichert |
| `sumDistance` | steht als streams.distance |
| `sumDuration` | letzter Wert als garmin.timer_duration_s |
| `sumElapsedDuration` | letzter Wert als garmin.elapsed_duration_s; Ersatzquelle der Zeitachse |
| `sumMovingDuration` | letzter Wert als garmin.moving_duration_s |

Außerdem: Die Strecke wird auf höchstens 600 Punkte reduziert; Zeit, Höhe und Tempo **je Streckenpunkt**
(`geoPolylineDTO.polyline[].time/altitude/speed`) gehen dabei verloren — sie stehen in den Messreihen.

## 11 · Sportarten: Garmin-Typ → ORVIA

Der Katalog hat 24 Sportarten. 52 Garmin-Typen führen auf 22 davon;
ohne eigenen Garmin-Typ sind `athletics` (Garmin zeichnet Bahnläufe als Lauf auf) und `other` (der
Rückfall selbst). Jeder andere Typ wird `other` — der Garmin-Typ bleibt dabei **immer** erhalten
(`metrics.garmin.type_key`, zusätzlich `metrics.source_sport_raw`), eine fehlende Zeile ist also
nachträglich korrigierbar. Die Typnamen sind nicht am Abruf belegt; der Feldzensus zeigt die
tatsächlich vorkommenden (Zeilen `typ`).

| ORVIA-Sportart | Garmin-Typen (typeKey) |
|---|---|
| badminton | `badminton` |
| basketball | `basketball` |
| climbing | `bouldering`, `indoor_climbing`, `rock_climbing` |
| cycling | `bmx`, `cycling`, `cyclocross`, `downhill_biking`, `e_bike_fitness`, `e_bike_mountain`, `gravel_cycling`, `indoor_cycling`, `mountain_biking`, `recumbent_cycling`, `road_biking`, `track_cycling`, `virtual_ride` |
| football | `soccer` |
| golf | `golf` |
| gym | `indoor_cardio`, `strength_training` |
| handball | `handball` |
| hiking | `hiking` |
| hockey | `field_hockey` |
| hyrox | `hyrox` |
| mobility | `mobility` |
| padel | `padel` |
| rowing | `indoor_rowing`, `rowing`, `rowing_v2` |
| rugby | `rugby` |
| running | `indoor_running`, `obstacle_run`, `running`, `street_running`, `track_running`, `trail_running`, `treadmill_running`, `ultra_run`, `virtual_run` |
| swimming | `lap_swimming`, `open_water_swimming` |
| tennis | `tennis`, `tennis_v2` |
| triathlon | `multi_sport`, `triathlon` |
| volleyball | `volleyball` |
| walking | `casual_walking`, `speed_walking`, `walking` |
| yoga | `yoga` |

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
-- ============================================================
-- ORVIA · Feldzensus und Nachlade-Stand der Garmin-Aktivitaeten (v8-447.3)
-- ------------------------------------------------------------
-- Zweck: zeigt, welche Felder und Messreihen Garmin JE SPORTART wirklich liefert, wie weit
-- das Nachladen auf den aktuellen Details-Vertrag ist und wie belastbar die Bestwerte sind —
-- ohne Mitschnitt, ohne Login, ohne Token. Grundlage ist, was der Worker je Aktivitaet
-- festhaelt (metrics.garmin, metrics.ext, metrics.best_efforts, Vermerke des Nachladens).
--
-- NUR LESEND. Das Ergebnis enthaelt ausschliesslich NAMEN und ZAEHLUNGEN (und den Zeitpunkt
-- des letzten Worker-Laufs): keine Messwerte, keine Trainingszeiten, keine Orte, keine
-- Nutzer- oder Garmin-Kennungen. Es kann unbedenklich kopiert und weitergegeben werden.
--
-- Ausfuehren: Supabase → SQL Editor → einfuegen → Run → „Export → CSV" (oder kopieren).
-- Auswerten:  python garmin-worker/scripts/census_report.py --csv <datei>
--             schreibt app/docs/GARMIN-FIELD-CENSUS-PROD.md und app/docs/GARMIN-BACKFILL-STATUS.md
--
-- Spalte art:
--   basis                Nenner je Sportart: alle · mit_herkunft · mit_rohfeldern · details_aktuell
--   typ                  Garmin-Typ → ORVIA-Sportart (prueft die Zuordnung; „other" = nicht zugeordnet)
--   herkunft             gefuellte Schluessel des Herkunftsblocks (type_key, start_local, utc_offset_s, Dauern …)
--   nachladen            aktuell · offen_alt · offen_neu · fehler:<Klasse> · zurueckgestellt:<Klasse>
--   tempo                in den letzten 24 h nachgeladen · Zeitpunkt des letzten Nachladens
--   abtastung            vollstaendig (Garmin lieferte alle Zeilen) · ausgeduennt · gesamtzahl_unbekannt
--   aufloesung           mit welchem maxChartSize die Details geladen wurden (standard / maxchart=…)
--   herkunft_unvollstaendig  Herkunftsblock fehlt oder ohne Garmin-Typ / GMT-Startzeit
--   herkunft_status      complete · partial · unavailable · inconsistent (v8-447.3, wie provenance.status)
--   herkunft_luecke      ohne_typ_und_utc · ohne_typ · ohne_utc · ohne_ortszeit · nicht_gelistet ·
--                        nicht_geliefert:<schluessel> · widerspruch:<schluessel>
--   herkunft_nachgetragen  vom Metadaten-Backfill ergaenzt: zeilen · garmin.<schluessel> · ext.<schluessel>
--   bedeutung            Listenwert gegen Aufzeichnung: Beziehung = Urteil [passende Lesart] (Lieferung)
--   bedeutung_hinweis    Ursache einer Abweichung (z. B. two_definitions, pool_lengths, half_value)
--   messreihe            kanonische Messreihe ← Garmin-Quelle [Bedeutung]
--   feld                 erhaltenes Feld des Listeneintrags (metrics.ext.fields)
--   feld_nicht_erhalten  geliefert, aber nicht gespeichert (nur der Name)
--   feld_verworfen       auf der Erlaubnisliste, geliefert, aber in unerwarteter Form (nur der Name)
--   struktur             erhaltener geschachtelter Block des Listeneintrags
--   reihe                erhaltene Zusatz-Messreihe (metrics.ext.series)
--   reihe_nicht_erhalten gelieferte Messreihe, die nicht gespeichert wird (nur der Name)
--   bestwert             Bestwert-Fenster = Guete (exact / approx / insufficient / measured / coarse / too_short)
--   kennwert             Kennwerte aus allen gelieferten Zeilen (welche Reihen)
--   zusatzabruf          Ergebnis der Zusatzabrufe (nur wenn DETAIL_EXTRAS gesetzt ist)
--   zusatz_schluessel    Schluessel in den Antworten der Zusatzabrufe (Form, keine Werte)
-- ============================================================
with g as (
  select sport_id, metrics
  from public.activities
  where source = 'garmin' and jsonb_typeof(metrics) = 'object'
),
x as (
  select sport_id,
         metrics,
         case when jsonb_typeof(metrics -> 'ext') = 'object' then metrics -> 'ext' else '{}'::jsonb end as ext,
         case when jsonb_typeof(metrics -> 'garmin') = 'object' then metrics -> 'garmin' else '{}'::jsonb end as gm,
         case when jsonb_typeof(metrics -> 'best_efforts') = 'object' then metrics -> 'best_efforts' else '{}'::jsonb end as be,
         (case when jsonb_typeof(metrics -> 'detailsVersion') = 'number' then (metrics ->> 'detailsVersion')::numeric >= 3 else false end
            and coalesce(metrics ->> 'detailsFetchedAt', '') <> '') as cur,
         coalesce(metrics ->> 'detailsFetchedAt', '') <> '' as fetched,
         case when jsonb_typeof(metrics -> 'detailsFailCount') = 'number' then (metrics ->> 'detailsFailCount')::numeric else 0 end as fails,
         case when (metrics ->> 'detailsFailedAt') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' then (metrics ->> 'detailsFailedAt')::timestamptz end as failed_at,
         case when (metrics ->> 'detailsFetchedAt') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' then (metrics ->> 'detailsFetchedAt')::timestamptz end as fetched_at,
         coalesce(metrics ->> 'detailsFailCategory', 'UNKNOWN') as fail_cat
  from g
)
-- ---- Nenner ---------------------------------------------------------------
select 'basis' as art, sport_id, 'alle' as name, count(*) as aktivitaeten from x group by 1, 2, 3
union all
select 'basis', sport_id, 'mit_herkunft', count(*) from x where gm ? 'type_key' group by 1, 2, 3
union all
select 'basis', sport_id, 'mit_rohfeldern', count(*) from x where jsonb_typeof(ext -> 'fields') = 'object' group by 1, 2, 3
union all
select 'basis', sport_id, 'details_aktuell', count(*) from x where cur group by 1, 2, 3

-- ---- Zuordnung ------------------------------------------------------------
union all
select 'typ', sport_id, coalesce(gm ->> 'type_key', metrics ->> 'source_sport_raw', '(unbekannt)'), count(*)
from x group by 1, 2, 3

-- ---- Herkunftsblock: welche Schluessel der Worker fuellen konnte --------------
union all
select 'herkunft', sport_id, k, count(*)
from x cross join lateral jsonb_object_keys(gm) as k
group by 1, 2, 3

-- ---- Nachladen ------------------------------------------------------------
union all
select 'nachladen', sport_id,
       case when cur then 'aktuell'
            when fails >= 3 and failed_at is not null and failed_at > now() - interval '7 days' then 'zurueckgestellt:' || fail_cat
            when fails > 0 then 'fehler:' || fail_cat
            when fetched then 'offen_alt'
            else 'offen_neu' end,
       count(*)
from x group by 1, 2, 3
union all
select 'tempo', '(alle)', 'nachgeladen_letzte_24h', count(*) from x where cur and fetched_at > now() - interval '24 hours'
union all
select 'tempo', '(alle)', 'zuletzt_nachgeladen:' || to_char(max(fetched_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"'), count(*)
from x where cur and fetched_at is not null having count(*) > 0

-- ---- Abtastung ------------------------------------------------------------
union all
select 'abtastung', sport_id,
       case when gm -> 'stream_total' is null or jsonb_typeof(gm -> 'stream_total') <> 'number' then 'gesamtzahl_unbekannt'
            when (gm ->> 'stream_rows')::numeric >= (gm ->> 'stream_total')::numeric then 'vollstaendig'
            else 'ausgeduennt' end,
       count(*)
from x where jsonb_typeof(gm -> 'stream_rows') = 'number' group by 1, 2, 3

-- ---- Aufloesung, mit der die Details geladen wurden (v8-447.1) ----------------
-- 'standard' = maxChartSize der Bibliothek (2000) bzw. vor v8-447.1 nicht vermerkt
union all
select 'aufloesung', sport_id,
       case when jsonb_typeof(metrics -> 'detailsMaxchart') = 'number' and (metrics ->> 'detailsMaxchart')::numeric > 0
            then 'maxchart=' || (metrics ->> 'detailsMaxchart') else 'standard' end,
       count(*)
from x where cur group by 1, 2, 3

-- ---- Herkunftsblock vorhanden, aber unvollstaendig (v8-447.1) -----------------
-- Garmin-Typ oder GMT-Startzeit fehlt — z. B. Block nur vom Nachladen der Details angelegt
union all
select 'herkunft_unvollstaendig', sport_id,
       case when gm = '{}'::jsonb then 'kein_block'
            when coalesce(gm ->> 'type_key', '') = '' and coalesce(gm ->> 'start_gmt', '') = '' then 'ohne_typ_und_zeit'
            when coalesce(gm ->> 'type_key', '') = '' then 'ohne_typ'
            else 'ohne_zeit' end,
       count(*)
from x where coalesce(gm ->> 'type_key', '') = '' or coalesce(gm ->> 'start_gmt', '') = '' group by 1, 2, 3

-- ---- Herkunft: Status je Zeile (v8-447.3, gleiche Regel wie orvia_worker/provenance.status) ----
-- complete      Typ, UTC-Start, Ortszeit-Start und Versatz vorhanden, kein Widerspruch
-- partial       es fehlt etwas, das noch nicht gegen die Garmin-Liste geprueft ist (Backfill-Kandidat)
-- unavailable   was fehlt, hat Garmin beim Pruefen nachweislich nicht geliefert
-- inconsistent  Liste und Zeile widersprechen sich (nichts ersetzt; prov_conflicts)
union all
select 'herkunft_status', sport_id, p.st, count(*)
from x cross join lateral (
  select case
    when jsonb_typeof(gm -> 'prov_conflicts') = 'array' and jsonb_array_length(gm -> 'prov_conflicts') > 0 then 'inconsistent'
    when cardinality(mi.missing) = 0 then 'complete'
    when mi.missing <@ coalesce(array(select jsonb_array_elements_text(
           case when jsonb_typeof(gm -> 'prov_unavailable') = 'array' then gm -> 'prov_unavailable' else '[]'::jsonb end)), '{}')
      then 'unavailable'
    else 'partial' end as st
  from (select array(select k from unnest(array['type_key', 'start_gmt', 'start_local', 'utc_offset_s']) as k
                     where coalesce(gm ->> k, '') = '') as missing) mi
) p
group by 1, 2, 3

-- ---- Herkunft: welche Luecke (v8-447.3) ----------------------------------------
-- ohne_typ_und_utc · ohne_typ · ohne_utc · ohne_ortszeit (Typ und UTC da, Ortszeit/Versatz fehlen)
-- nicht_gelistet (die Garmin-Liste fuer den Tag enthielt die Aktivitaet nicht)
-- nicht_geliefert:<schluessel> (Garmin lieferte den Schluessel nicht) · widerspruch:<schluessel>
union all
select 'herkunft_luecke', sport_id,
       case when coalesce(gm ->> 'type_key', '') = '' and coalesce(gm ->> 'start_gmt', '') = '' then 'ohne_typ_und_utc'
            when coalesce(gm ->> 'type_key', '') = '' then 'ohne_typ'
            when coalesce(gm ->> 'start_gmt', '') = '' then 'ohne_utc'
            else 'ohne_ortszeit' end,
       count(*)
from x where coalesce(gm ->> 'type_key', '') = '' or coalesce(gm ->> 'start_gmt', '') = ''
          or coalesce(gm ->> 'start_local', '') = '' or coalesce(gm ->> 'utc_offset_s', '') = ''
group by 1, 2, 3
union all
select 'herkunft_luecke', sport_id, 'nicht_gelistet', count(*) from x where gm -> 'prov_not_listed' = 'true'::jsonb group by 1, 2, 3
union all
select 'herkunft_luecke', sport_id, 'nicht_geliefert:' || k, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(gm -> 'prov_unavailable') = 'array' then gm -> 'prov_unavailable' else '[]'::jsonb end) as k
group by 1, 2, 3
union all
select 'herkunft_luecke', sport_id, 'widerspruch:' || k, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(gm -> 'prov_conflicts') = 'array' then gm -> 'prov_conflicts' else '[]'::jsonb end) as k
group by 1, 2, 3

-- ---- Herkunft: vom Metadaten-Backfill ergaenzt (v8-447.3) — zeigt die behobenen Faelle ----
union all
select 'herkunft_nachgetragen', sport_id, 'zeilen', count(*) from x where jsonb_typeof(gm -> 'prov_backfill') = 'object' group by 1, 2, 3
union all
select 'herkunft_nachgetragen', sport_id, 'garmin.' || k, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(gm -> 'prov_backfill' -> 'garmin') = 'array' then gm -> 'prov_backfill' -> 'garmin' else '[]'::jsonb end) as k
group by 1, 2, 3
union all
select 'herkunft_nachgetragen', sport_id, 'ext.' || k, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(gm -> 'prov_backfill' -> 'ext') = 'array' then gm -> 'prov_backfill' -> 'ext' else '[]'::jsonb end) as k
group by 1, 2, 3

-- ---- Bedeutungspruefung: Listenwert gegen Aufzeichnung (v8-447.1) ---------------
-- name = Beziehung = Urteil [passende Lesart] (Lieferung) — keine Werte
union all
select 'bedeutung', sport_id,
       r.key || ' = ' || coalesce(r.value ->> 'verdict', '?')
         || coalesce(' [' || (select string_agg(m, '; ' order by m) from jsonb_array_elements_text(
                                case when jsonb_typeof(r.value -> 'matches') = 'array' then r.value -> 'matches' else '[]'::jsonb end) as m) || ']', '')
         || ' (' || case when (ext -> 'semantics' -> 'delivery' ->> 'complete') = 'true' then 'vollstaendig' else 'ausgeduennt' end || ')',
       count(*)
from x cross join lateral jsonb_each(
  case when jsonb_typeof(ext -> 'semantics') = 'object' then ext -> 'semantics' else '{}'::jsonb end) as r
where r.key not in ('v', 'delivery') and jsonb_typeof(r.value) = 'object'
group by 1, 2, 3

-- ---- Bedeutungspruefung: Hinweise zur Ursache einer Abweichung -----------------
union all
select 'bedeutung_hinweis', sport_id, r.key || ': ' || split_part(h, ':', 1), count(*)
from x cross join lateral jsonb_each(
  case when jsonb_typeof(ext -> 'semantics') = 'object' then ext -> 'semantics' else '{}'::jsonb end) as r
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(r.value -> 'hints') = 'array' then r.value -> 'hints' else '[]'::jsonb end) as h
where r.key not in ('v', 'delivery')
group by 1, 2, 3

-- ---- kanonische Messreihen: Quelle und Bedeutung ----------------------------
union all
select 'messreihe', sport_id,
       s.key || ' <- ' || coalesce(s.value ->> 'source', '?') || ' [' || coalesce(s.value ->> 'kind', '?') || ']'
         || case when s.value ? 'derived' then ' (abgeleitet)' else '' end,
       count(*)
from x cross join lateral jsonb_each(
  case when jsonb_typeof(metrics -> 'stream_meta') = 'object' then metrics -> 'stream_meta' else '{}'::jsonb end) as s
where jsonb_typeof(s.value) = 'object'
group by 1, 2, 3

-- ---- Listeneintrag --------------------------------------------------------
union all
select 'feld', sport_id, k, count(*)
from x cross join lateral jsonb_object_keys(
  case when jsonb_typeof(ext -> 'fields') = 'object' then ext -> 'fields' else '{}'::jsonb end) as k
group by 1, 2, 3
union all
select 'feld_nicht_erhalten', sport_id, n, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(ext -> 'unrecognized') = 'array' then ext -> 'unrecognized' else '[]'::jsonb end) as n
group by 1, 2, 3
union all
select 'feld_verworfen', sport_id, n, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(ext -> 'rejected') = 'array' then ext -> 'rejected' else '[]'::jsonb end) as n
group by 1, 2, 3
union all
select 'struktur', sport_id, k, count(*)
from x cross join lateral jsonb_object_keys(
  case when jsonb_typeof(ext -> 'list') = 'object' then ext -> 'list' else '{}'::jsonb end) as k
group by 1, 2, 3

-- ---- Zusatzreihen ---------------------------------------------------------
union all
select 'reihe', sport_id, k, count(*)
from x cross join lateral jsonb_object_keys(
  case when jsonb_typeof(ext -> 'series') = 'object' then ext -> 'series' else '{}'::jsonb end) as k
group by 1, 2, 3
union all
select 'reihe_nicht_erhalten', sport_id, n, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(ext -> 'series_unparsed') = 'array' then ext -> 'series_unparsed' else '[]'::jsonb end) as n
group by 1, 2, 3

-- ---- Bestwerte und Kennwerte ------------------------------------------------
union all
select 'bestwert', sport_id, 'power:' || w.key || 's = ' || coalesce(w.value ->> 'q', '?'), count(*)
from x cross join lateral jsonb_each(
  case when jsonb_typeof(be -> 'power' -> 'windows') = 'object' then be -> 'power' -> 'windows' else '{}'::jsonb end) as w
group by 1, 2, 3
union all
select 'bestwert', sport_id, 'distance:' || w.key || 'm = ' || coalesce(w.value ->> 'q', '?'), count(*)
from x cross join lateral jsonb_each(
  case when jsonb_typeof(be -> 'distance' -> 'targets') = 'object' then be -> 'distance' -> 'targets' else '{}'::jsonb end) as w
group by 1, 2, 3
union all
select 'bestwert', sport_id,
       'power:aufzeichnung = ' || case when be -> 'power' ->> 'native' = 'true' and (be -> 'power' ->> 'interval_s')::numeric <= 1 then 'vollstaendig_sekuendlich'
                                       when be -> 'power' ->> 'native' = 'true' then 'vollstaendig_nicht_sekuendlich'
                                       else 'ausgeduennt' end,
       count(*)
from x where jsonb_typeof(be -> 'power' -> 'interval_s') = 'number' group by 1, 2, 3
union all
select 'kennwert', sport_id, k || case when k = 'cadence' then ' [' || coalesce(be -> 'stats' -> 'cadence' ->> 'kind', '?') || ']' else '' end, count(*)
from x cross join lateral jsonb_object_keys(
  case when jsonb_typeof(be -> 'stats') = 'object' then be -> 'stats' else '{}'::jsonb end) as k
group by 1, 2, 3

-- ---- Zusatzabrufe -----------------------------------------------------------
union all
select 'zusatzabruf', sport_id, e.key || ' = ' || e.value, count(*)
from x cross join lateral jsonb_each_text(
  case when jsonb_typeof(ext -> 'extras') = 'object' then ext -> 'extras' else '{}'::jsonb end) as e
group by 1, 2, 3
union all
select 'zusatz_schluessel', sport_id, z.name || '.' || k, count(*)
from x
cross join lateral (values ('splits'), ('typed_splits'), ('hr_zones'), ('power_zones'), ('exercise_sets')) as z(name)
cross join lateral jsonb_object_keys(
  case jsonb_typeof(ext -> z.name)
    when 'object' then ext -> z.name
    when 'array' then case when jsonb_typeof(ext -> z.name -> 0) = 'object' then ext -> z.name -> 0 else '{}'::jsonb end
    else '{}'::jsonb
  end) as k
group by 1, 2, 3
union all
select 'zusatz_schluessel', sport_id, z.name || '.' || t.key || '[].' || k2, count(*)
from x
cross join lateral (values ('splits'), ('typed_splits'), ('hr_zones'), ('power_zones'), ('exercise_sets')) as z(name)
cross join lateral jsonb_each(
  case when jsonb_typeof(ext -> z.name) = 'object' then ext -> z.name else '{}'::jsonb end) as t
cross join lateral jsonb_object_keys(
  case when jsonb_typeof(t.value) = 'array' and jsonb_typeof(t.value -> 0) = 'object' then t.value -> 0 else '{}'::jsonb end) as k2
group by 1, 2, 3

order by 1, 2, 4 desc, 3;
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
| `DETAIL_EXTRAS` | leer (aus) | kommagetrennt aus: activity, splits, typed_splits, hr_zones, power_zones, exercise_sets |
| `ACTIVITY_PROVENANCE_BACKFILL_DAYS` | 0 | **abgelöst durch `PROVENANCE_BACKFILL`** (wird ignoriert, sobald jener an ist). Fester Rückblick: so viele Tage zurück wird die Liste gelesen, solange eine Zeile mit Status `partial` existiert. |
| `PROVENANCE_BACKFILL` | `off` | v8-447.3 · Metadaten-Backfill der Herkunft aus der **Liste** (Abschnitt 15b) — keine Detailabrufe. `dry` = nur zählen, nichts schreiben (Ergebnis im Sync-Schritt `provenance_backfill`); `apply` = schreiben. Nur Zeilen mit Status `partial`; höchstens 6 Listenabrufe je Lauf; Abbruch bei 401/429 (dann auch keine Detail- und Tagesabrufe in dem Lauf). |
| `DETAIL_REFETCH_SEMANTICS` | aus | v8-447.3 · lädt Aktivitäten auf Vertrag 3, deren Bedeutungsprüfung nie lief (Rohfelder kamen erst später, Marker `detailsSemantics` fehlt), **einmal** neu. Erst **nach** dem Metadaten-Backfill sinnvoll. Gleiche Grenzen wie `DETAIL_REFETCH_RESOLUTION`. |
| `DETAIL_REFETCH_RESOLUTION` | aus | lädt Aktivitäten, die schon auf Details-Vertrag 3 stehen, aber mit kleinerem `maxChartSize` geholt wurden, **einmal** neu (`detailsMaxchart` < `DETAIL_MAXCHART`). Nur zusammen mit `DETAIL_MAXCHART` > 0. Reihenfolge: nie geladene → Altvertrag → Auflösung, je neueste zuerst; dieselbe Grenze `DETAIL_BACKFILL_LIMIT`; Abbruch bei 429/401. Manuelle Korrekturen und Planverknüpfung bleiben erhalten. |

## 15 · Auswertung und Anzeige sind getrennt

Grundsatz seit v8-447.1:

| | Grundlage | Zweck |
|---|---|---|
| **Auswertung** | alle von Garmin gelieferten Messzeilen, vor der Ausdünnung | Bestwerte, Kennwerte — alles, was später festgeschrieben werden kann |
| **Anzeige** | `metrics.streams`, höchstens 300 Punkte je Reihe | Diagramme |

Aus einer Anzeige-Reihe wird nie ein Rekord gerechnet. Der Worker rechnet beim Import und legt das Ergebnis
an die Aktivität (`metrics.best_efforts`); er schreibt keine Rekorde fest und vergleicht nichts über Aktivitäten hinweg.

**Leistung** (`best_efforts.power.windows`) — beste Durchschnittsleistung über 1 s, 5 s, 10 s, 15 s, 30 s, 1 min, 2 min, 5 min, 10 min, 20 min, 30 min, 60 min:

- Fenster `[t, t + D]` auf der **verstrichenen** Zeit. Nie „N Messpunkte", nie Bewegungszeit.
- Eine **Pause** gehört in das Fenster und zählt 0 W. Bewegungsabschnitte werden nicht zusammengeklebt.
- **0 W** ist ein Messwert. Eine Zeile **ohne** Leistungswert zählt als 0 W — nicht interpoliert, nicht übersprungen;
  die betroffene Zeit steht am Fenster (`miss_s`). Das Ergebnis kann dadurch nur zu niedrig werden, nie zu hoch.
- Güte je Fenster: `exact` (Garmin lieferte alle Zeilen **und** die Uhr zeichnete sekündlich auf — die Zahl ist die
  Messung) · `approx` (ausgedünnt oder nicht sekündlich, mindestens 8 Abstände im Fenster —
  Näherung, **kein Rekord**) · `insufficient` (Auflösung reicht nicht — **keine Zahl gespeichert**).

**Strecke** (`best_efforts.distance.targets`, nur running, walking, hiking) — schnellste Zeit über 400 m, 1 km, 5 km, 10 km, 21.0975 km, 42.195 km:
das kürzeste Stück zwischen zwei **echten** Messzeilen, das die Zieldistanz erreicht. Keine Interpolation; die Zeit ist
gemessen, der Überhang (`over_m`) steht dabei. Die Zahl ist eine Obergrenze der wahren Bestzeit — nie zu schnell.

**Kennwerte** (`best_efforts.stats`) — Mittel und Maximum je Reihe aus allen gelieferten Zeilen; `avg` mit Nullen,
`avg_nz` ohne. Hat Garmin ausgedünnt (`native: false`), ist das Mittel eine Näherung.

**Auflösung:** Im ersten Mitschnitt lieferte Garmin mit dem Standard 1855 von 5527 aufgezeichneten Zeilen (Abstand 3 s) —
Leistungsfenster unter 24 s wären `insufficient`, alle längeren `approx`. Die Auflösungsprüfung
vom 11.10.2026 (Gian, Trockenlauf, keine Dateien gespeichert) zeigt für **acht von acht** Aktivitäten: mit `maxChartSize=20000`
kommen sämtliche gemeldeten Zeilen, Median-Abstand 1 s. In Produktion ist das erst belegt, wenn der Worker mit
`DETAIL_MAXCHART=20000` gelaufen ist und der Zensus (Art `aufloesung`, `abtastung`) es zeigt.

## 15a · Bedeutungsprüfung

Ob ein Summenwert des Listeneintrags das bedeutet, was sein Name sagt, prüft der Worker gegen **alle gelieferten
Messzeilen** derselben Aktivität (`orvia_worker/semantic_checks.py`, Version 1). Je Beziehung werden
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

## 15b · Herkunft (v8-447.3)

Typ und Startzeiten liefert **nur der Listeneintrag**; die Detailantwort enthält
`activityId, measurementCount, metricsCount, totalMetricsCount, metricDescriptors, activityDetailMetrics, geoPolylineDTO,
heartRateDTOs, pendingData, detailsAvailable` — weder Typ noch Startzeit (Test `test_detail_response_carries_neither_type_nor_start_time`).

**Befund 15.10.2026:** 40 von 41 Aktivitäten ohne Typ und Zeit. Ursache im Code nachgestellt
(`test_root_cause_detail_backfill_creates_block_without_type_and_time_and_window_never_reaches_it`): bis v8-446 schrieb der Import
keinen Herkunftsblock; das Nachladen der Details (alle Zeilen, ohne Fenster) legte `metrics.garmin` mit Dauern und Abtastung an; der
Herkunfts-Nachtrag sieht nur die Liste des Sync-Fensters — im Dauerbetrieb [vorgestern, heute]. Ältere Zeilen wurden nie ergänzt.

Modell — **ein** Block, `metrics.garmin` (kein zweiter):

| Schlüssel | Bedeutung |
|---|---|
| `type_key` | Garmins Typ (`activityType.typeKey`), z. B. `virtual_ride`, `treadmill_running`, `lap_swimming` — der konkrete Typ. Einen eigenen „Subtyp" liefert die Liste nicht; es wird keiner erfunden. |
| `parent_type_id` | Garmins übergeordneter Typ als Zahl, roh (kein Name: die Zuordnung Zahl → Name ist nicht belegt) |
| `start_gmt` / `start_local` | Startzeit UTC / Wandzeit am Ort, wie geliefert |
| `utc_offset_s` | nur aus genau diesen beiden gebildet (Sommer-/Winterzeit steckt darin); kein fester Versatz |
| `v` | Version der Normalisierung |
| `prov_status` | `complete` · `partial` · `unavailable` · `inconsistent` |
| `prov_unavailable` / `prov_not_listed` | Garmin lieferte den Schlüssel nicht / die Liste enthielt die Aktivität nicht |
| `prov_conflicts` | Widerspruch (z. B. `started_at` > 120 s neben Garmins UTC-Zeit) — nichts ersetzt |
| `prov_backfill` | was der Backfill ergänzt hat (Rückweg: `supabase/scripts/provenance_backfill_rollback.sql`) |

Kanonische Sportart = `activities.sport_id`, Quelle = `activities.source`. Vollständig = `type_key`, `start_gmt`, `start_local`, `utc_offset_s`.

Backfill-Regeln: nur fehlende Schlüssel; nie `sport_id`, `started_at`, `duration_seconds`, `summary`, Messreihen, Bestwerte,
`corrections`, `plannedSessionId`; jede Zeile direkt vor dem Schreiben frisch gelesen; das Nachladen der Details übernimmt
inzwischen geschriebene Herkunft (`carry_forward`). Probelauf ohne Garmin: `supabase/scripts/provenance_backfill_dryrun.sql`.

## 16 · Fehlerklassen des Nachladens

| Klasse | Auslöser | Folge |
|---|---|---|
| `AUTH` | Sitzung ungültig (401) | Lauf endet sofort; Sync gilt als nicht erfolgreich; nichts wird einer Aktivität angelastet |
| `RATE_LIMIT` | Garmin bremst (429) | wie `AUTH`; der Zeitplaner verlängert die Pause; keine sofortige Wiederholung |
| `NETWORK` | nicht erreichbar, 5xx, Zeitüberschreitung | zählt nicht; nach 2 in Folge endet der Lauf |
| `NOT_FOUND` | Garmin kennt die Aktivität nicht (404/410) | zählt |
| `UNSUPPORTED` | Anfrage abgelehnt (400/405/406/409/415/422) | zählt |
| `MALFORMED` | Antwort ist keine lesbare Struktur | zählt |
| `PERSISTENCE` | Speichern in der Datenbank fehlgeschlagen | zählt nicht; nächster Lauf versucht es erneut |
| `UNKNOWN` | nicht einzuordnen (auch 403) | zählt nur, wenn im selben Lauf eine andere Aktivität gelang |

Nach 3 gezählten Fehlern wird eine Aktivität 7 Tage zurückgestellt
(`detailsFailCount`, `detailsFailedAt`, `detailsFailCategory`). Ein Erfolg löscht den Vermerk. Stand: `GARMIN-BACKFILL-STATUS.md`.

## 17 · Altlasten und offene Punkte

1. **Kadenz im Altbestand** — nicht umgerechnet, bis zum Nachladen ausgeblendet (Abschnitt 4).
2. **Bestzeiten können sich ändern**, sobald eine Aktivität ihre echte Zeitachse hat: die App rechnet
   Fenster dann mit gemessener statt gleichverteilter Zeit. Deshalb werden in v8-447 keine Rekorde
   festgeschrieben; `activityCapabilities.ledgerEligible` sperrt Zeilen unter Vertrag 3.
3. **Herkunft und Rohfelder im Altbestand** — Metadaten-Backfill `PROVENANCE_BACKFILL` (Abschnitt 15b);
   der Zensus zählt `herkunft_status`, `herkunft_luecke`, `herkunft_nachgetragen`.
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
