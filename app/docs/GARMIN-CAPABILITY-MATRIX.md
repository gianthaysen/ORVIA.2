# Garmin-Fähigkeits-Matrix

**Status: IMPLEMENTED** · Stand v8-447 · Worker Details-Vertrag 3 · Rohblock-Version 1

> Diese Datei wird **erzeugt**: `python garmin-worker/scripts/gen_capability_matrix.py`.
> Die Tabellen stammen aus dem Code des Workers (`garmin_fields.py`, `detail_sync.py`, `normalize.py`).
> Nicht von Hand ändern — ein Test vergleicht Datei und Code.

Was Garmin je Aktivität liefert, was davon importiert, gespeichert und angezeigt wird, was dabei
verloren geht und wie gut jede Aussage belegt ist. Grundsatz seit v8-447: **erhalten, nicht deuten** —
Rohwerte bleiben unter ihrem Garmin-Namen, nichts wird erfunden, nichts stillschweigend umgerechnet.

## 1 · Wie belastbar ist eine Zeile? (Belegstufen)

| Stufe | Bedeutung | Anzahl Zeilen |
|---|---|---|
| **fixture** | in einem echten, anonymisierten Mitschnitt im Repo gesehen | 12 |
| **library** | im typisierten Modell der eingesetzten Bibliothek (garminconnect 0.3.6) benannt | 43 |
| **assumed** | üblicher Garmin-Connect-Name, hier **nicht** belegt | 67 |

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
| Start (UTC) | alle | get_activities_by_date | `startTimeGMT` | laut Bibliothek | ja | `activities.started_at` | ja | summary | UTC | keine | nein | ja | — |
| Start (Ortszeit) | alle | get_activities_by_date | `startTimeLocal` | laut Bibliothek | ja | `metrics.garmin.start_local` | ja | summary | Wandzeit | keine | nein | ja | neu in v8-447; bis v8-446 verworfen |
| UTC-Versatz | alle | get_activities_by_date | `startTimeLocal − startTimeGMT` | laut Bibliothek | ja | `metrics.garmin.utc_offset_s` | nein | summary | s | Differenz der zwei gelieferten Zeiten | nein | ja | nur in Viertelstunden, sonst kein Wert |
| Sportart | alle | get_activities_by_date | `activityType.typeKey` | laut Bibliothek | ja | `activities.sport_id` | ja | summary | enum | SPORT_MAP (viele → eine) | ja: Untertyp | ja | — |
| Garmin-Typ | alle | get_activities_by_date | `activityType.typeKey` | laut Bibliothek | ja | `metrics.garmin.type_key` | nein | summary | enum | Kleinschreibung | nein | ja | neu in v8-447: Bahn / Freiwasser, Trail / Laufband, Rolle / Strasse |
| Garmin-Obertyp | alle | get_activities_by_date | `activityType.parentTypeId` | laut Bibliothek | ja | `metrics.garmin.parent_type_id` | nein | summary | enum-Nr. | keine | nein | nein | — |
| Dauer (Timer) | alle | get_activities_by_date | `duration` | laut Bibliothek | ja | `activities.duration_seconds` | ja | summary | s | auf ganze Sekunden gerundet | ja: < 1 s | ja | Rohwert zusaetzlich in metrics.ext.fields.duration |
| Distanz | alle | get_activities_by_date | `distance` | laut Bibliothek | ja | `summary.distance_m` | ja | summary | m | keine | nein | ja | — |
| Ø Herzfrequenz | alle | get_activities_by_date | `averageHR` | laut Bibliothek | ja | `summary.avg_hr` | ja | summary | bpm | keine | nein | ja | — |
| Max. Herzfrequenz | alle | get_activities_by_date | `maxHR` | laut Bibliothek | ja | `summary.max_hr` | ja | summary | bpm | keine | nein | ja | — |
| Kalorien | alle | get_activities_by_date | `calories` | laut Bibliothek | ja | `summary.calories_kcal` | ja | summary | kcal | keine | nein | nein | — |
| Hoehenmeter | alle | get_activities_by_date | `elevationGain` | laut Bibliothek | ja | `summary.elevation_gain_m` | ja | summary | m | keine | nein | ja | — |
| Ø Geschwindigkeit | alle | get_activities_by_date | `averageSpeed` | laut Bibliothek | ja | `summary.avg_speed_mps` | ja | summary | m/s | keine | nein | ja | — |
| Ø Leistung | cycling, running | get_activities_by_date | `avgPower` | laut Bibliothek | ja | `summary.avg_power_w` | ja | summary | W | keine | nein | nach Mitschnitt | — |
| Max. Leistung | cycling, running | get_activities_by_date | `maxPower` | laut Bibliothek | ja | `summary.max_power_w` | ja | summary | W | keine | nein | nach Mitschnitt | — |
| Normalisierte Leistung | cycling, running | get_activities_by_date | `normPower` | laut Bibliothek | ja | `summary.norm_power_w` | ja | summary | W | keine | nein | nach Mitschnitt | — |
| Trainingsbelastung | alle | get_activities_by_date | `activityTrainingLoad` | laut Bibliothek | ja | `metrics.training_load` | ja | summary | Garmin-Last | keine | nein | nein | — |
| Titel | alle | get_activities_by_date | `activityName` | laut Bibliothek | ja | `summary.name` | ja | summary | Text | keine | nein | nein | frei geschriebener Text des Nutzers — bleibt in summary, nie im Rohblock |
| Zeitachse | alle | get_activity_details | `directTimestamp` | ja (Mitschnitt Lauf) | ja | `metrics.streams.time` | indirekt (Bestzeiten) | series | s seit Beginn | ms GMT → Sekunden seit der ersten Zeile | ja: Ausduennung | ja | neu in v8-447; Ersatzquelle sumElapsedDuration; nur lueckenlos und monoton |
| Herzfrequenz | alle | get_activity_details | `directHeartRate` | ja (Mitschnitt Lauf) | ja | `metrics.streams.heart_rate` | ja | series | bpm | keine | ja: Ausduennung | ja | — |
| Geschwindigkeit | alle | get_activity_details | `directSpeed` | ja (Mitschnitt Lauf) | ja | `metrics.streams.speed` | ja | series | m/s | keine | ja: Ausduennung | ja | — |
| Distanz (kumulativ) | alle | get_activity_details | `sumDistance` | ja (Mitschnitt Lauf) | ja | `metrics.streams.distance` | indirekt (Bestzeiten) | series | m | keine | ja: Ausduennung | ja | — |
| Hoehe | alle | get_activity_details | `directElevation \| directCorrectedElevation` | ja (Mitschnitt Lauf) | ja | `metrics.streams.elevation` | ja | series | m | keine | ja: Ausduennung | ja | — |
| Schrittfrequenz | running | get_activity_details | `directDoubleCadence` | ja (Mitschnitt Lauf) | ja | `metrics.streams.cadence` | ja | series | spm | keine (kind running_cadence_spm) | ja: Ausduennung | ja | bis v8-446 wurde directRunCadence (ein Bein) gelesen — halber Wert |
| Schrittfrequenz (Ersatz) | running | get_activity_details | `directRunCadence + directFractionalCadence` | ja (Mitschnitt Lauf) | ja | `metrics.streams.cadence` | ja | series | spm | 2 × (Run + Fractional), markiert als derived | ja: Ausduennung | ja | nur wenn directDoubleCadence fehlt |
| Trittfrequenz | cycling | get_activity_details | `directBikeCadence` | unbelegt | ja | `metrics.streams.cadence` | ja | series | rpm | keine (kind cycling_cadence_rpm) | ja: Ausduennung | nach Mitschnitt | Name unbelegt — kein Rad-Mitschnitt |
| Leistung | cycling, running | get_activity_details | `directPower` | unbelegt | ja | `metrics.streams.power` | ja | series | W | keine | ja: Ausduennung | nach Mitschnitt | Name unbelegt; fuer 1–15-s-Bestwerte reicht die Aufloesung nicht |
| Strecke | alle | get_activity_details | `geoPolylineDTO.polyline[].lat/lon` | ja (Mitschnitt Lauf) | ja | `metrics.route` | ja | series | Grad | auf hoechstens 600 Punkte reduziert | ja: Zeit, Hoehe und Tempo je Punkt | ja | — |
| Bewegungszeit | alle | get_activity_details | `sumMovingDuration (letzte Zeile)` | ja (Mitschnitt Lauf) | ja | `metrics.garmin.moving_duration_s` | nein | summary | s | auf 0,1 s gerundet | nein | ja | neu in v8-447; Listenfeld movingDuration zusaetzlich im Rohblock |
| Verstrichene Zeit | alle | get_activity_details | `sumElapsedDuration (letzte Zeile)` | ja (Mitschnitt Lauf) | ja | `metrics.garmin.elapsed_duration_s` | nein | summary | s | auf 0,1 s gerundet | nein | ja | neu in v8-447 |
| Timer-Zeit | alle | get_activity_details | `sumDuration (letzte Zeile)` | ja (Mitschnitt Lauf) | ja | `metrics.garmin.timer_duration_s` | nein | summary | s | auf 0,1 s gerundet | nein | ja | neu in v8-447 |
| Abtastung | alle | get_activity_details | `totalMetricsCount / Zeilenzahl` | ja (Mitschnitt Lauf) | ja | `metrics.garmin.stream_total / stream_rows / stream_kept` | nein | summary | Anzahl | keine | nein | nein | aufgezeichnet → von Garmin geliefert → gespeichert |

## 7 · Teil B — Rohfelder des Listeneintrags (`metrics.ext.fields`)

Erhalten wird jedes dieser Felder **genau dann**, wenn Garmin es liefert — unter seinem Garmin-Namen, ohne
Umrechnung. Zusätzlich bleibt jedes weitere skalare Feld erhalten, dessen Name nach einem Messwert aussieht
(`MEASURE_PARTS`); alles Übrige wird dem Namen nach vermerkt (`metrics.ext.unrecognized`).
`metrics.ext` liegt nur auf dem Server und in der Serverliste der App, nie im lokalen Speicher des Geräts.

| FIELD | SPORT | ENDPOINT | RAW FIELD NAME | RAW AVAILABLE? | IMPORTED? | STORED? | DISPLAYED? | SERIES/SUMMARY | UNITS | NORMALIZATION | LOSSY? | HIGHLIGHT-READY? | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Zeit | alle | get_activities_by_date | `duration` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.duration` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | Timer-Dauer; wird in die Spalte duration_seconds uebernommen |
| Zeit | alle | get_activities_by_date | `movingDuration` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.movingDuration` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zeit | alle | get_activities_by_date | `elapsedDuration` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.elapsedDuration` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `distance` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.distance` | nein | summary | m | keine (Rohwert) | nein | nach Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `elevationGain` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.elevationGain` | nein | summary | m | keine (Rohwert) | nein | nach Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `elevationLoss` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.elevationLoss` | nein | summary | m | keine (Rohwert) | nein | nach Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `minElevation` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.minElevation` | nein | summary | m | keine (Rohwert) | nein | nach Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `maxElevation` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.maxElevation` | nein | summary | m | keine (Rohwert) | nein | nach Mitschnitt | — |
| Umfang | alle | get_activities_by_date | `steps` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.steps` | nein | summary | count | keine (Rohwert) | nein | nach Mitschnitt | — |
| Struktur | alle | get_activities_by_date | `lapCount` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.lapCount` | nein | summary | count | keine (Rohwert) | nein | nach Mitschnitt | — |
| Tempo | alle | get_activities_by_date | `averageSpeed` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.averageSpeed` | nein | summary | m/s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Tempo | alle | get_activities_by_date | `maxSpeed` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.maxSpeed` | nein | summary | m/s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Herz | alle | get_activities_by_date | `averageHR` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.averageHR` | nein | summary | bpm | keine (Rohwert) | nein | nach Mitschnitt | — |
| Herz | alle | get_activities_by_date | `maxHR` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.maxHR` | nein | summary | bpm | keine (Rohwert) | nein | nach Mitschnitt | — |
| Herz | alle | get_activities_by_date | `minHR` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.minHR` | nein | summary | bpm | keine (Rohwert) | nein | nach Mitschnitt | — |
| Energie | alle | get_activities_by_date | `calories` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.calories` | nein | summary | kcal | keine (Rohwert) | nein | nach Mitschnitt | — |
| Energie | alle | get_activities_by_date | `bmrCalories` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.bmrCalories` | nein | summary | kcal | keine (Rohwert) | nein | nach Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `activityTrainingLoad` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.activityTrainingLoad` | nein | summary | garmin_load | keine (Rohwert) | nein | nach Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `aerobicTrainingEffect` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.aerobicTrainingEffect` | nein | summary | 0-5 | keine (Rohwert) | nein | nach Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `anaerobicTrainingEffect` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.anaerobicTrainingEffect` | nein | summary | 0-5 | keine (Rohwert) | nein | nach Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `trainingEffectLabel` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.trainingEffectLabel` | nein | summary | enum | keine (Rohwert) | nein | nach Mitschnitt | Hauptnutzen laut Garmin |
| Belastung / Wirkung | alle | get_activities_by_date | `aerobicTrainingEffectMessage` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.aerobicTrainingEffectMessage` | nein | summary | enum | keine (Rohwert) | nein | nach Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `anaerobicTrainingEffectMessage` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.anaerobicTrainingEffectMessage` | nein | summary | enum | keine (Rohwert) | nein | nach Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `moderateIntensityMinutes` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.moderateIntensityMinutes` | nein | summary | min | keine (Rohwert) | nein | nach Mitschnitt | — |
| Belastung / Wirkung | alle | get_activities_by_date | `vigorousIntensityMinutes` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.vigorousIntensityMinutes` | nein | summary | min | keine (Rohwert) | nein | nach Mitschnitt | — |
| Belastung / Wirkung | running, cycling | get_activities_by_date | `vO2MaxValue` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.vO2MaxValue` | nein | summary | ml/kg/min | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | alle | get_activities_by_date | `hrTimeInZone_1` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.hrTimeInZone_1` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | alle | get_activities_by_date | `hrTimeInZone_2` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.hrTimeInZone_2` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | alle | get_activities_by_date | `hrTimeInZone_3` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.hrTimeInZone_3` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | alle | get_activities_by_date | `hrTimeInZone_4` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.hrTimeInZone_4` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | alle | get_activities_by_date | `hrTimeInZone_5` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.hrTimeInZone_5` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | cycling, running | get_activities_by_date | `powerTimeInZone_1` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_1` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | cycling, running | get_activities_by_date | `powerTimeInZone_2` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_2` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | cycling, running | get_activities_by_date | `powerTimeInZone_3` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_3` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | cycling, running | get_activities_by_date | `powerTimeInZone_4` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_4` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | cycling, running | get_activities_by_date | `powerTimeInZone_5` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_5` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | cycling | get_activities_by_date | `powerTimeInZone_6` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_6` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Zonen | cycling | get_activities_by_date | `powerTimeInZone_7` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.powerTimeInZone_7` | nein | summary | s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Leistung | cycling, running | get_activities_by_date | `avgPower` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.avgPower` | nein | summary | W | keine (Rohwert) | nein | nach Mitschnitt | — |
| Leistung | cycling, running | get_activities_by_date | `maxPower` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.maxPower` | nein | summary | W | keine (Rohwert) | nein | nach Mitschnitt | — |
| Leistung | cycling, running | get_activities_by_date | `normPower` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.normPower` | nein | summary | W | keine (Rohwert) | nein | nach Mitschnitt | — |
| Leistung | cycling | get_activities_by_date | `max20MinPower` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.max20MinPower` | nein | summary | W | keine (Rohwert) | nein | nach Mitschnitt | — |
| Leistung | cycling | get_activities_by_date | `intensityFactor` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.intensityFactor` | nein | summary | ratio | keine (Rohwert) | nein | nach Mitschnitt | — |
| Leistung | cycling | get_activities_by_date | `trainingStressScore` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.trainingStressScore` | nein | summary | tss | keine (Rohwert) | nein | nach Mitschnitt | — |
| Leistung | cycling | get_activities_by_date | `avgLeftBalance` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.avgLeftBalance` | nein | summary | % | keine (Rohwert) | nein | nach Mitschnitt | — |
| Laufdynamik | running | get_activities_by_date | `averageRunningCadenceInStepsPerMinute` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.averageRunningCadenceInStepsPerMinute` | nein | summary | spm | keine (Rohwert) | nein | nach Mitschnitt | Name sagt Schritte/min — ob voller Wert oder ein Bein, ist am Listeneintrag NICHT belegt; die Messreihe (directDoubleCadence) ist der belegte Wert |
| Laufdynamik | running | get_activities_by_date | `maxRunningCadenceInStepsPerMinute` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.maxRunningCadenceInStepsPerMinute` | nein | summary | spm | keine (Rohwert) | nein | nach Mitschnitt | siehe Durchschnitt |
| Laufdynamik | running | get_activities_by_date | `avgStrideLength` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.avgStrideLength` | nein | summary | cm | keine (Rohwert) | nein | nach Mitschnitt | Einheit unbelegt |
| Laufdynamik | running | get_activities_by_date | `avgGroundContactTime` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.avgGroundContactTime` | nein | summary | ms | keine (Rohwert) | nein | nach Mitschnitt | — |
| Laufdynamik | running | get_activities_by_date | `avgVerticalOscillation` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.avgVerticalOscillation` | nein | summary | cm | keine (Rohwert) | nein | nach Mitschnitt | Einheit unbelegt |
| Laufdynamik | running | get_activities_by_date | `avgVerticalRatio` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.avgVerticalRatio` | nein | summary | % | keine (Rohwert) | nein | nach Mitschnitt | — |
| Laufdynamik | running | get_activities_by_date | `avgGroundContactBalance` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.avgGroundContactBalance` | nein | summary | % | keine (Rohwert) | nein | nach Mitschnitt | — |
| Laufdynamik | running | get_activities_by_date | `avgGradeAdjustedSpeed` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.avgGradeAdjustedSpeed` | nein | summary | m/s | keine (Rohwert) | nein | nach Mitschnitt | — |
| Rad | cycling | get_activities_by_date | `averageBikingCadenceInRevPerMinute` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.averageBikingCadenceInRevPerMinute` | nein | summary | rpm | keine (Rohwert) | nein | nach Mitschnitt | — |
| Rad | cycling | get_activities_by_date | `maxBikingCadenceInRevPerMinute` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.maxBikingCadenceInRevPerMinute` | nein | summary | rpm | keine (Rohwert) | nein | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activities_by_date | `poolLength` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.poolLength` | nein | summary | siehe unitOfPoolLength | keine (Rohwert) | nein | nach Mitschnitt | Meter oder Yards |
| Schwimmen / Rudern | swimming | get_activities_by_date | `unitOfPoolLength` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.unitOfPoolLength` | nein | summary | enum | keine (Rohwert) | nein | nach Mitschnitt | geschachtelt: unitKey |
| Schwimmen / Rudern | swimming | get_activities_by_date | `activeLengths` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.activeLengths` | nein | summary | count | keine (Rohwert) | nein | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming, rowing | get_activities_by_date | `strokes` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.strokes` | nein | summary | count | keine (Rohwert) | nein | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activities_by_date | `avgStrokes` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.avgStrokes` | nein | summary | count/length | keine (Rohwert) | nein | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activities_by_date | `averageSwolf` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.averageSwolf` | nein | summary | swolf | keine (Rohwert) | nein | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activities_by_date | `averageSwimCadenceInStrokesPerMinute` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.averageSwimCadenceInStrokesPerMinute` | nein | summary | strokes/min | keine (Rohwert) | nein | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activities_by_date | `maxSwimCadenceInStrokesPerMinute` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.maxSwimCadenceInStrokesPerMinute` | nein | summary | strokes/min | keine (Rohwert) | nein | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming, rowing | get_activities_by_date | `avgStrokeDistance` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.avgStrokeDistance` | nein | summary | cm | keine (Rohwert) | nein | nach Mitschnitt | Einheit unbelegt |
| Kraft | gym | get_activities_by_date | `totalSets` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.totalSets` | nein | summary | count | keine (Rohwert) | nein | nach Mitschnitt | — |
| Kraft | gym | get_activities_by_date | `activeSets` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.activeSets` | nein | summary | count | keine (Rohwert) | nein | nach Mitschnitt | — |
| Kraft | gym | get_activities_by_date | `totalReps` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.totalReps` | nein | summary | count | keine (Rohwert) | nein | nach Mitschnitt | — |
| Kraft | gym | get_activities_by_date | `totalVolume` | laut Bibliothek | ja, wenn geliefert | `metrics.ext.fields.totalVolume` | nein | summary | g? | keine (Rohwert) | nein | nach Mitschnitt | Einheit unbelegt (Gramm oder Kilogramm) |
| Umgebung | alle | get_activities_by_date | `minTemperature` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.minTemperature` | nein | summary | °C | keine (Rohwert) | nein | nach Mitschnitt | — |
| Umgebung | alle | get_activities_by_date | `maxTemperature` | unbelegt | ja, wenn geliefert | `metrics.ext.fields.maxTemperature` | nein | summary | °C | keine (Rohwert) | nein | nach Mitschnitt | — |

## 8 · Teil C — Zusatz-Messreihen der Detailantwort (`metrics.ext.series`)

Höchstens 8 Reihen je Aktivität, bekannte zuerst. Jede weitere Reihe, deren Name nach einem
Messwert aussieht, bleibt ebenfalls erhalten; der Rest wird dem Namen nach vermerkt
(`metrics.ext.series_unparsed`). **Alle Namen dieser Tabelle sind Annahmen.**

| FIELD | SPORT | ENDPOINT | RAW FIELD NAME | RAW AVAILABLE? | IMPORTED? | STORED? | DISPLAYED? | SERIES/SUMMARY | UNITS | NORMALIZATION | LOSSY? | HIGHLIGHT-READY? | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Laufdynamik | running | get_activity_details | `directGroundContactTime` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directGroundContactTime` | nein | series | ms (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Laufdynamik | running | get_activity_details | `directVerticalOscillation` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directVerticalOscillation` | nein | series | cm (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | Einheit laut Antwort (garmin_unit) |
| Laufdynamik | running | get_activity_details | `directStrideLength` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directStrideLength` | nein | series | cm (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | Einheit laut Antwort (garmin_unit) |
| Laufdynamik | running | get_activity_details | `directVerticalRatio` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directVerticalRatio` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Laufdynamik | running | get_activity_details | `directGroundContactBalanceLeft` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directGroundContactBalanceLeft` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Laufdynamik | running | get_activity_details | `directGradeAdjustedSpeed` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directGradeAdjustedSpeed` | nein | series | m/s (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Rad | cycling | get_activity_details | `directLeftBalance` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directLeftBalance` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Rad | cycling | get_activity_details | `directLeftTorqueEffectiveness` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directLeftTorqueEffectiveness` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Rad | cycling | get_activity_details | `directRightTorqueEffectiveness` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directRightTorqueEffectiveness` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Rad | cycling | get_activity_details | `directLeftPedalSmoothness` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directLeftPedalSmoothness` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Rad | cycling | get_activity_details | `directRightPedalSmoothness` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directRightPedalSmoothness` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activity_details | `directSwimCadence` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directSwimCadence` | nein | series | strokes/min (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming, rowing | get_activity_details | `directStrokeCadence` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directStrokeCadence` | nein | series | strokes/min (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming | get_activity_details | `directSwolf` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directSwolf` | nein | series | swolf (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Schwimmen / Rudern | swimming, rowing | get_activity_details | `directStrokes` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directStrokes` | nein | series | count (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Umgebung | alle | get_activity_details | `directAirTemperature` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directAirTemperature` | nein | series | °C (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Belastung / Wirkung | alle | get_activity_details | `directRespirationRate` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directRespirationRate` | nein | series | breaths/min (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Belastung / Wirkung | running, cycling | get_activity_details | `directPerformanceCondition` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directPerformanceCondition` | nein | series | score (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Belastung / Wirkung | running, cycling | get_activity_details | `directAvailableStamina` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directAvailableStamina` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |
| Belastung / Wirkung | running, cycling | get_activity_details | `directPotentialStamina` | unbelegt | ja, wenn geliefert | `metrics.ext.series.directPotentialStamina` | nein | series | % (maßgeblich: garmin_unit der Antwort) | keine (Rohwert, gleicher Index wie die Zeitachse) | ja: Ausdünnung | nach Mitschnitt | — |

## 9 · Teil D — Zusatzabrufe je Aktivität

Verdrahtet, aber **standardmäßig aus**: jede Zeile ist ein weiterer Abruf je Aktivität an einer
inoffiziellen Schnittstelle, und keine der Antwortformen ist im Repo belegt. Einschalten über die
Einstellung `DETAIL_EXTRAS` (Abschnitt 14) — sinnvoll erst nach einem Mitschnitt je Sportart.
Ein fehlgeschlagener Abruf wird als `failed` vermerkt (`metrics.ext.extras`) und bricht nichts ab.

| FIELD | SPORT | ENDPOINT | RAW FIELD NAME | RAW AVAILABLE? | IMPORTED? | STORED? | DISPLAYED? | SERIES/SUMMARY | UNITS | NORMALIZATION | LOSSY? | HIGHLIGHT-READY? | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| volle Zusammenfassung (summaryDTO) | alle | get_activity | Antwortform unbelegt | laut Bibliothek (Methode); Form unbelegt | nur mit `DETAIL_EXTRAS` | `metrics.ext.fields (ergänzt, Listeneintrag bleibt führend)` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS |
| Runden | alle | get_activity_splits | Antwortform unbelegt | laut Bibliothek (Methode); Form unbelegt | nur mit `DETAIL_EXTRAS` | `metrics.ext.splits + metrics.splits (schlanke Form)` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS |
| Intervalle / Bahnen | swimming, running, cycling | get_activity_typed_splits | Antwortform unbelegt | laut Bibliothek (Methode); Form unbelegt | nur mit `DETAIL_EXTRAS` | `metrics.ext.typed_splits` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS |
| Zeit je Herzfrequenz-Zone | alle | get_activity_hr_in_timezones | Antwortform unbelegt | laut Bibliothek (Methode); Form unbelegt | nur mit `DETAIL_EXTRAS` | `metrics.ext.hr_zones` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS |
| Zeit je Leistungs-Zone | cycling, running | get_activity_power_in_timezones | Antwortform unbelegt | laut Bibliothek (Methode); Form unbelegt | nur mit `DETAIL_EXTRAS` | `metrics.ext.power_zones` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS |
| Sätze (Übung, Wiederholungen, Gewicht) | gym | get_activity_exercise_sets | Antwortform unbelegt | laut Bibliothek (Methode); Form unbelegt | nur mit `DETAIL_EXTRAS` | `metrics.ext.exercise_sets` | nein | structure | — | Form erhalten, nur Messwerte (keep_structure) | ja: private Felder, Koordinaten, Deckel 400 Einträge | nach Mitschnitt | standardmäßig AUS |

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
-- ORVIA · Feldzensus der Garmin-Aktivitaeten (v8-447)
-- ------------------------------------------------------------
-- Zweck: zeigt, welche Felder und Messreihen Garmin JE SPORTART wirklich liefert —
-- ohne Mitschnitt, ohne Login, ohne Token. Grundlage ist, was der Worker seit v8-447
-- je Aktivitaet festhaelt (metrics.garmin, metrics.ext).
--
-- NUR LESEND. Das Ergebnis enthaelt ausschliesslich NAMEN und ZAEHLUNGEN:
-- keine Messwerte, keine Zeiten, keine Orte, keine Nutzerkennungen. Es kann
-- unbedenklich kopiert und weitergegeben werden.
--
-- Ausfuehren: Supabase → SQL Editor → einfuegen → Run → Ergebnis als CSV kopieren.
-- Sinnvoll, sobald der Worker (railway up) einige Laeufe gemacht hat; die Zeile
-- "details_version" zeigt, wie weit das einmalige Nachladen ist (Ziel: alles auf 3).
--
-- Spalte art:
--   typ                  Garmin-Typ → ORVIA-Sportart (prueft die Zuordnung)
--   details_version      Stand des Nachladens (3 = aktuell)
--   zeitachse            Aktivitaeten mit / ohne echte Zeitachse
--   feld                 erhaltenes Feld des Listeneintrags (metrics.ext.fields)
--   feld_nicht_erhalten  geliefert, aber nicht gespeichert (nur der Name)
--   struktur             erhaltener geschachtelter Block des Listeneintrags
--   reihe                erhaltene Zusatz-Messreihe (metrics.ext.series)
--   reihe_nicht_erhalten gelieferte Messreihe, die nicht gespeichert wird (nur der Name)
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
         case when jsonb_typeof(metrics -> 'ext') = 'object' then metrics -> 'ext' else '{}'::jsonb end as ext
  from g
)
select 'typ' as art, sport_id,
       coalesce(metrics -> 'garmin' ->> 'type_key', metrics ->> 'source_sport_raw', '(unbekannt)') as name,
       count(*) as aktivitaeten
from x group by 1, 2, 3

union all
select 'details_version', sport_id, coalesce(metrics ->> 'detailsVersion', '(keine Details)'), count(*)
from x group by 1, 2, 3

union all
select 'zeitachse', sport_id,
       case when jsonb_typeof(metrics -> 'streams' -> 'time') = 'array' then 'mit' else 'ohne' end, count(*)
from x group by 1, 2, 3

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
select 'struktur', sport_id, k, count(*)
from x cross join lateral jsonb_object_keys(
  case when jsonb_typeof(ext -> 'list') = 'object' then ext -> 'list' else '{}'::jsonb end) as k
group by 1, 2, 3

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
| `DETAIL_EXTRAS` | leer (aus) | kommagetrennt aus: activity, splits, typed_splits, hr_zones, power_zones, exercise_sets |
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
