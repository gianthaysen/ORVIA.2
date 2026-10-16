# Performance-Daten: Was darf ins Leistungsregister?

**Status: IMPLEMENTIERT, AUSGELIEFERT HINTER FLAG (`performance_ledger`, Standard aus)** · Stand v8-449.1 · Prüfinstanz des Athlete Performance Ledger

> Diese Datei wird **erzeugt**: `node app/tools/gen-eligibility-doc.mjs`. Die Spalten *ledger eligible?* und *reason*
> sind das Urteil von `app/js/engine/metric-eligibility.js` — nicht von Hand geschrieben. Ein Test vergleicht Datei und Code.
> Das Modul wird seit v8-448B von der App geladen und ist die **einzige** Prüfinstanz des Leistungsregisters.
> Es wirkt erst, wenn das Flag `performance_ledger` für ein Konto an ist; bis dahin ruft es niemand auf.

## 1 · Die Frage

„Welche meiner ORVIA-Daten darf ich guten Gewissens für historische Rekorde, Fortschritte, Ziele und Highlights verwenden?"

Antwort je **Kennzahl**, nicht je Aktivität: eine Einheit kann eine belastbare Distanz und eine unbelegte Kadenz tragen.
`ORVIA.metricEligibility.evaluate(aktivität, kennzahl)` liefert `{ eligible, reason, reasons, provenance }`.

Eine Kennzahl ist zulässig, wenn sie

1. **vorhanden** ist — der Wert steht in der Zeile;
2. **normalisiert** ist — Garmin-Zeile auf Details-Vertrag 3, Bedeutung der Messreihe vermerkt;
3. **belegt** ist — die *Bedeutung* der Quelle ist für diese Sportart nachgewiesen (Mitschnitt, dokumentierter Vergleich mit Garmin Connect, oder eigene Daten);
4. **gestützt** ist — wo es zwei unabhängige Angaben gibt (Listenwert und Aufzeichnung), stimmen sie überein.

Sonst: nicht zulässig, mit Grund. „Wahrscheinlich richtig" gibt es nicht.

## 2 · Gründe

| reason | Bedeutung |
|---|---|
| `missing_data` | Wert oder Grundlage fehlt |
| `legacy_schema` | noch nicht nachgeladen |
| `unverified_semantics` | Bedeutung der Quelle nicht belegt |
| `insufficient_resolution` | Auflösung reicht nicht |
| `invalid_time_axis` | Zeitachse fehlt / ungültig |
| `unsupported_source` | Quelle kann das nicht tragen |
| `unsupported_sport` | gibt es für die Sportart nicht |
| `manual_override_conflict` | manuelle Korrektur widerspricht der Aufzeichnung |
| `not_completed` | nicht abgeschlossen |
| `unverified_context` | kontextgebundene Auswertung verlangt, Kontext nicht belegt |
| `pause_conflict` | Strecke bei angehaltenem Timer |
| `unknown_metric` | unbekannt |

## 3 · Belege heute

Zulässig machen nur die Stufen **fixture, validated, own**. Der einzige echte Mitschnitt im Repo ist die Detailantwort **eines Laufs**.

| Beleg | Sportarten mit Nachweis | sonst |
|---|---|---|
| `details.time` | running: fixture | assumed |
| `details.distance` | running: fixture | assumed |
| `details.heart_rate` | running: fixture | assumed |
| `details.durations` | running: fixture | assumed |
| `details.running_cadence` | running: validated | assumed |
| `details.cycling_cadence` | — | assumed |
| `details.power` | — | assumed |
| `list.swim` | — | assumed |
| `list.training_effect` | — | library |
| `list.strength` | — | library |
| `list.calories` | — | library |
| `own` | — | own |

Im Produktions-Zensus **geliefert** heißt nicht **belegt**: der Zensus zeigt, dass Garmin ein Feld schickt — nicht, was es bedeutet.
Hochgestuft wird eine Zeile erst durch einen Mitschnitt (`fixture`) oder einen dokumentierten Vergleich mit Garmin Connect
(`validated`, mit Datum in `VALIDATIONS`). Dokumentierte Vergleiche bisher: 1.

## 4 · Je Sportart — bester Fall

Bezugs-Aktivitäten: Garmin, Details-Vertrag 3, **vollständig geliefert**, alle Felder vorhanden. Ist selbst dieser Fall nicht
zulässig, fehlt ein Beleg — nicht ein Wert.

| sport | metric | source | observed? | normalized? | quality conditions | manual override behavior | ledger eligible? | reason | historical backfill safe? | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| running | Dauer | Spalte `duration_seconds` (Garmin: Timer-Dauer des Listeneintrags; ORVIA-Workout: Zeitstempel der Session) | details.durations: ja — Mitschnitt | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und `garmin.timer_duration_s` weicht höchstens 5 s / 1 % ab | wirksamer Wert zählt; bleibt als manuell markiert; Quelle bleibt erhalten | **ja** | — | ja, sobald nachgeladen | Bewegungs- und verstrichene Zeit stehen getrennt in `metrics.garmin` |
| running | Distanz | `summary.distanceM` (Garmin: Listenfeld `distance`) | details.distance: ja — Mitschnitt | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und Ende der Reihe `streams.distance` weicht höchstens 20 m / 1 % ab | Modell vorbereitet, Eingabe in der App nicht freigegeben | **ja** | — | ja, sobald nachgeladen | Schwimmen: Distanz = Bahnen × Bahnlänge laut Uhr — Bedeutung unbelegt |
| running | Tempo (Ø) | Distanz / Dauer (beide wirksam) | details.durations: ja — Mitschnitt; details.distance: ja — Mitschnitt | ja (Vertrag 3) | wie Dauer und Distanz | erbt die Markierung von Dauer / Distanz | **ja** | — | ja, sobald nachgeladen | nur Lauf, Gehen, Wandern |
| running | Herzfrequenz (Ø) | `best_efforts.stats.heart_rate.avg` — alle gelieferten Zeilen | details.heart_rate: ja — Mitschnitt | ja (Vertrag 3) | Details-Vertrag 3; weicht höchstens 2 bpm vom Listenwert ab; bei Ausdünnung als Näherung gekennzeichnet | keine Korrektur vorgesehen | **ja** | — | ja, sobald nachgeladen | nicht aus der Anzeige-Reihe |
| running | Herzfrequenz (Max) | `best_efforts.stats.heart_rate.max` | details.heart_rate: ja — Mitschnitt | ja (Vertrag 3) | nur wenn Garmin alle Zeilen lieferte — ein Maximum aus ausgedünnten Zeilen ist eine Untergrenze | keine Korrektur vorgesehen | **ja** | — | nur mit vollständiger Lieferung | Listenfeld `maxHR` ist nicht belegt |
| running | Schrittfrequenz (Ø) | `best_efforts.stats.cadence` aus `directDoubleCadence` | details.running_cadence: ja — gegen Garmin Connect geprüft | ja (Vertrag 3) | Details-Vertrag 3, Bedeutung der Reihe = `running_cadence_spm` | keine Korrektur vorgesehen | **ja** | — | ja, sobald nachgeladen — Altwerte (Halbwert-Verdacht) nie | Listenfeld der Ø-Kadenz wird nicht benutzt |
| running | Leistung (Ø) | `best_efforts.stats.power` | details.power: nein — angenommen | ja (Vertrag 3) | Details-Vertrag 3 | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | Quellname `directPower` unbelegt |
| running | Leistungs-Bestwert (alle Fenster) | `best_efforts.power.windows` — Worker, vor der Ausdünnung | details.power: nein — angenommen; details.time: ja — Mitschnitt | ja (Vertrag 3) | Güte `exact`: Garmin lieferte alle Zeilen, sekündliche Aufzeichnung; kein Sensor-Aussetzer im Fenster; Fenster auf verstrichener Zeit | Konflikt, wenn die korrigierte Dauer kürzer ist als das Fenster | **nein** | `unverified_semantics` | erst nach Beleg und nur bei vollständiger Lieferung | Fenster: 1 s … 60 min |
| running | Strecken-Bestzeit (alle Distanzen) | `best_efforts.distance.targets` — Worker, vor der Ausdünnung | details.distance: ja — Mitschnitt; details.time: ja — Mitschnitt | ja (Vertrag 3) | Güte `measured`: zwischen zwei echten Messzeilen, Überhang ≤ 1 % / 10 m; verstrichene Zeit | Konflikt, wenn die korrigierte Dauer kürzer ist als die Bestzeit | **ja** | — | ja, sobald nachgeladen | gemessene Obergrenze der wahren Bestzeit — nie zu schnell |
| running | Aktive Strecken-Bestzeit (alle Distanzen) | kleinster von: `best_efforts.distance_active.targets` (Timer-Achse, Worker v8-449.1) · ganze Aktivität mit `garmin.timer_duration_s`, wenn ihre Distanz die Zielstrecke trifft · verstrichenes Fenster als Obergrenze | details.distance: ja — Mitschnitt; details.durations: ja — Mitschnitt | ja (Vertrag 3) | Timer = Garmin `sumDuration` (manuelle und Auto-Pause ausgeschlossen, nicht unterscheidbar); ganze Aktivität nur bei Überhang ≤ 10 m / 1 %; Strecke bei stehendem Timer = `pause_conflict` | korrigierte Dauer zählt als Gesamtzeit der Aktivität (manuell markiert) | **ja** | — | ja — Messgrundlage je Wert benannt | aktive Trainingsbestzeit, nie mit der Bestzeit einschließlich Pausen verglichen; keine Bewegungszeit |
| running | Wettkampf-Bestzeit (alle Distanzen) | ganze Aktivität, verstrichene Zeit (`garmin.elapsed_duration_s`; eigene Daten: Angabe) | — | ja (Vertrag 3) | nur, wenn du die Aktivität als Wettkampfergebnis bestätigt hast; Distanz trifft die Wettkampfstrecke (≤ 10 m / 1 %) | wirksame Dauer bei eigenen Daten | **nein** | `unsupported_source` | vorbereitet — nur bestätigte Ergebnisse | nie aus Sportart oder Datum geraten |
| running | Training Effect | `ext.fields.aerobicTrainingEffect` | list.training_effect: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | nur im Rohblock (Serverliste) |
| running | Kalorien | `summary.caloriesKcal` (Garmin-Listenfeld) | list.calories: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | keine Leistungskennzahl |
| cycling | Dauer | Spalte `duration_seconds` (Garmin: Timer-Dauer des Listeneintrags; ORVIA-Workout: Zeitstempel der Session) | details.durations: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und `garmin.timer_duration_s` weicht höchstens 5 s / 1 % ab | wirksamer Wert zählt; bleibt als manuell markiert; Quelle bleibt erhalten | **nein** | `unverified_semantics` | nach Beleg | Bewegungs- und verstrichene Zeit stehen getrennt in `metrics.garmin` |
| cycling | Distanz | `summary.distanceM` (Garmin: Listenfeld `distance`) | details.distance: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und Ende der Reihe `streams.distance` weicht höchstens 20 m / 1 % ab | Modell vorbereitet, Eingabe in der App nicht freigegeben | **nein** | `unverified_semantics` | nach Beleg | Schwimmen: Distanz = Bahnen × Bahnlänge laut Uhr — Bedeutung unbelegt |
| cycling | Herzfrequenz (Ø) | `best_efforts.stats.heart_rate.avg` — alle gelieferten Zeilen | details.heart_rate: nein — angenommen | ja (Vertrag 3) | Details-Vertrag 3; weicht höchstens 2 bpm vom Listenwert ab; bei Ausdünnung als Näherung gekennzeichnet | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nach Beleg | nicht aus der Anzeige-Reihe |
| cycling | Herzfrequenz (Max) | `best_efforts.stats.heart_rate.max` | details.heart_rate: nein — angenommen | ja (Vertrag 3) | nur wenn Garmin alle Zeilen lieferte — ein Maximum aus ausgedünnten Zeilen ist eine Untergrenze | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nur mit vollständiger Lieferung | Listenfeld `maxHR` ist nicht belegt |
| cycling | Trittfrequenz (Ø) | `best_efforts.stats.cadence` aus `directBikeCadence` | details.cycling_cadence: nein — angenommen | ja (Vertrag 3) | Details-Vertrag 3, Bedeutung = `cycling_cadence_rpm` | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | Quellname unbelegt (kein Rad-Mitschnitt) |
| cycling | Leistung (Ø) | `best_efforts.stats.power` | details.power: nein — angenommen | ja (Vertrag 3) | Details-Vertrag 3 | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | Quellname `directPower` unbelegt |
| cycling | Leistungs-Bestwert (alle Fenster) | `best_efforts.power.windows` — Worker, vor der Ausdünnung | details.power: nein — angenommen; details.time: nein — angenommen | ja (Vertrag 3) | Güte `exact`: Garmin lieferte alle Zeilen, sekündliche Aufzeichnung; kein Sensor-Aussetzer im Fenster; Fenster auf verstrichener Zeit | Konflikt, wenn die korrigierte Dauer kürzer ist als das Fenster | **nein** | `unverified_semantics` | erst nach Beleg und nur bei vollständiger Lieferung | Fenster: 1 s … 60 min |
| cycling | Training Effect | `ext.fields.aerobicTrainingEffect` | list.training_effect: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | nur im Rohblock (Serverliste) |
| cycling | Kalorien | `summary.caloriesKcal` (Garmin-Listenfeld) | list.calories: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | keine Leistungskennzahl |
| cycling | FTP | keine Aktivitäts-Kennzahl (Tagesmessung `user_metrics.ftp_watts`) | — | — | — | — | **nein** | `unsupported_source` | nein (nicht aus Aktivitäten) | gehört dem Athleten, nicht der Einheit |
| swimming | Dauer | Spalte `duration_seconds` (Garmin: Timer-Dauer des Listeneintrags; ORVIA-Workout: Zeitstempel der Session) | details.durations: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und `garmin.timer_duration_s` weicht höchstens 5 s / 1 % ab | wirksamer Wert zählt; bleibt als manuell markiert; Quelle bleibt erhalten | **nein** | `unverified_semantics` | nach Beleg | Bewegungs- und verstrichene Zeit stehen getrennt in `metrics.garmin` |
| swimming | Distanz | `summary.distanceM` (Garmin: Listenfeld `distance`) | list.swim: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und Ende der Reihe `streams.distance` weicht höchstens 20 m / 1 % ab | Modell vorbereitet, Eingabe in der App nicht freigegeben | **nein** | `unverified_semantics` | nach Beleg | Schwimmen: Distanz = Bahnen × Bahnlänge laut Uhr — Bedeutung unbelegt |
| swimming | Herzfrequenz (Ø) | `best_efforts.stats.heart_rate.avg` — alle gelieferten Zeilen | details.heart_rate: nein — angenommen | ja (Vertrag 3) | Details-Vertrag 3; weicht höchstens 2 bpm vom Listenwert ab; bei Ausdünnung als Näherung gekennzeichnet | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nach Beleg | nicht aus der Anzeige-Reihe |
| swimming | Herzfrequenz (Max) | `best_efforts.stats.heart_rate.max` | details.heart_rate: nein — angenommen | ja (Vertrag 3) | nur wenn Garmin alle Zeilen lieferte — ein Maximum aus ausgedünnten Zeilen ist eine Untergrenze | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nur mit vollständiger Lieferung | Listenfeld `maxHR` ist nicht belegt |
| swimming | SWOLF | `ext.fields.averageSwolf` | list.swim: nein — angenommen | ja (Vertrag 3) | Garmin-Typ `lap_swimming`, Bahnlänge bekannt | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | alle Schwimm-Felder unbelegt |
| swimming | Zugfrequenz | `ext.fields.averageSwimCadenceInStrokesPerMinute` | list.swim: nein — angenommen | ja (Vertrag 3) | Garmin-Typ `lap_swimming`, Bahnlänge bekannt | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | eigene Größe — nie in der Reihe `cadence` |
| swimming | Training Effect | `ext.fields.aerobicTrainingEffect` | list.training_effect: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | nur im Rohblock (Serverliste) |
| swimming | Kalorien | `summary.caloriesKcal` (Garmin-Listenfeld) | list.calories: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | keine Leistungskennzahl |
| gym | Dauer | Spalte `duration_seconds` (Garmin: Timer-Dauer des Listeneintrags; ORVIA-Workout: Zeitstempel der Session) | details.durations: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und `garmin.timer_duration_s` weicht höchstens 5 s / 1 % ab | wirksamer Wert zählt; bleibt als manuell markiert; Quelle bleibt erhalten | **nein** | `unverified_semantics` | nach Beleg | Bewegungs- und verstrichene Zeit stehen getrennt in `metrics.garmin` |
| gym | Distanz | `summary.distanceM` (Garmin: Listenfeld `distance`) | — | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und Ende der Reihe `streams.distance` weicht höchstens 20 m / 1 % ab | Modell vorbereitet, Eingabe in der App nicht freigegeben | **nein** | `missing_data` | nach Beleg | Schwimmen: Distanz = Bahnen × Bahnlänge laut Uhr — Bedeutung unbelegt |
| gym | Herzfrequenz (Ø) | `best_efforts.stats.heart_rate.avg` — alle gelieferten Zeilen | details.heart_rate: nein — angenommen | ja (Vertrag 3) | Details-Vertrag 3; weicht höchstens 2 bpm vom Listenwert ab; bei Ausdünnung als Näherung gekennzeichnet | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nach Beleg | nicht aus der Anzeige-Reihe |
| gym | Herzfrequenz (Max) | `best_efforts.stats.heart_rate.max` | details.heart_rate: nein — angenommen | ja (Vertrag 3) | nur wenn Garmin alle Zeilen lieferte — ein Maximum aus ausgedünnten Zeilen ist eine Untergrenze | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nur mit vollständiger Lieferung | Listenfeld `maxHR` ist nicht belegt |
| gym | Training Effect | `ext.fields.aerobicTrainingEffect` | list.training_effect: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | nur im Rohblock (Serverliste) |
| gym | Kraft-Volumen | ORVIA-Workout: `summary.totalVolumeKg` | list.strength: nur Bibliothek | ja (Vertrag 3) | eigene Sätze mit Gewicht | folgt den Sätzen des Workouts | **nein** | `unverified_semantics` | nach Beleg | Garmin `totalVolume`: Einheit unbelegt |
| gym | Kalorien | `summary.caloriesKcal` (Garmin-Listenfeld) | list.calories: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | keine Leistungskennzahl |
| walking | Dauer | Spalte `duration_seconds` (Garmin: Timer-Dauer des Listeneintrags; ORVIA-Workout: Zeitstempel der Session) | details.durations: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und `garmin.timer_duration_s` weicht höchstens 5 s / 1 % ab | wirksamer Wert zählt; bleibt als manuell markiert; Quelle bleibt erhalten | **nein** | `unverified_semantics` | nach Beleg | Bewegungs- und verstrichene Zeit stehen getrennt in `metrics.garmin` |
| walking | Distanz | `summary.distanceM` (Garmin: Listenfeld `distance`) | details.distance: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und Ende der Reihe `streams.distance` weicht höchstens 20 m / 1 % ab | Modell vorbereitet, Eingabe in der App nicht freigegeben | **nein** | `unverified_semantics` | nach Beleg | Schwimmen: Distanz = Bahnen × Bahnlänge laut Uhr — Bedeutung unbelegt |
| walking | Tempo (Ø) | Distanz / Dauer (beide wirksam) | details.durations: nein — angenommen; details.distance: nein — angenommen | ja (Vertrag 3) | wie Dauer und Distanz | erbt die Markierung von Dauer / Distanz | **nein** | `unverified_semantics` | nach Beleg | nur Lauf, Gehen, Wandern |
| walking | Herzfrequenz (Ø) | `best_efforts.stats.heart_rate.avg` — alle gelieferten Zeilen | details.heart_rate: nein — angenommen | ja (Vertrag 3) | Details-Vertrag 3; weicht höchstens 2 bpm vom Listenwert ab; bei Ausdünnung als Näherung gekennzeichnet | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nach Beleg | nicht aus der Anzeige-Reihe |
| walking | Herzfrequenz (Max) | `best_efforts.stats.heart_rate.max` | details.heart_rate: nein — angenommen | ja (Vertrag 3) | nur wenn Garmin alle Zeilen lieferte — ein Maximum aus ausgedünnten Zeilen ist eine Untergrenze | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nur mit vollständiger Lieferung | Listenfeld `maxHR` ist nicht belegt |
| walking | Strecken-Bestzeit (alle Distanzen) | `best_efforts.distance.targets` — Worker, vor der Ausdünnung | details.distance: nein — angenommen; details.time: nein — angenommen | ja (Vertrag 3) | Güte `measured`: zwischen zwei echten Messzeilen, Überhang ≤ 1 % / 10 m; verstrichene Zeit | Konflikt, wenn die korrigierte Dauer kürzer ist als die Bestzeit | **nein** | `unverified_semantics` | nach Beleg | gemessene Obergrenze der wahren Bestzeit — nie zu schnell |
| walking | Aktive Strecken-Bestzeit (alle Distanzen) | kleinster von: `best_efforts.distance_active.targets` (Timer-Achse, Worker v8-449.1) · ganze Aktivität mit `garmin.timer_duration_s`, wenn ihre Distanz die Zielstrecke trifft · verstrichenes Fenster als Obergrenze | details.distance: nein — angenommen; details.durations: nein — angenommen | ja (Vertrag 3) | Timer = Garmin `sumDuration` (manuelle und Auto-Pause ausgeschlossen, nicht unterscheidbar); ganze Aktivität nur bei Überhang ≤ 10 m / 1 %; Strecke bei stehendem Timer = `pause_conflict` | korrigierte Dauer zählt als Gesamtzeit der Aktivität (manuell markiert) | **nein** | `unverified_semantics` | nach Beleg | aktive Trainingsbestzeit, nie mit der Bestzeit einschließlich Pausen verglichen; keine Bewegungszeit |
| walking | Wettkampf-Bestzeit (alle Distanzen) | ganze Aktivität, verstrichene Zeit (`garmin.elapsed_duration_s`; eigene Daten: Angabe) | — | ja (Vertrag 3) | nur, wenn du die Aktivität als Wettkampfergebnis bestätigt hast; Distanz trifft die Wettkampfstrecke (≤ 10 m / 1 %) | wirksame Dauer bei eigenen Daten | **nein** | `unsupported_source` | vorbereitet — nur bestätigte Ergebnisse | nie aus Sportart oder Datum geraten |
| walking | Training Effect | `ext.fields.aerobicTrainingEffect` | list.training_effect: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | nur im Rohblock (Serverliste) |
| walking | Kalorien | `summary.caloriesKcal` (Garmin-Listenfeld) | list.calories: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | keine Leistungskennzahl |
| hiking | Dauer | Spalte `duration_seconds` (Garmin: Timer-Dauer des Listeneintrags; ORVIA-Workout: Zeitstempel der Session) | details.durations: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und `garmin.timer_duration_s` weicht höchstens 5 s / 1 % ab | wirksamer Wert zählt; bleibt als manuell markiert; Quelle bleibt erhalten | **nein** | `unverified_semantics` | nach Beleg | Bewegungs- und verstrichene Zeit stehen getrennt in `metrics.garmin` |
| hiking | Distanz | `summary.distanceM` (Garmin: Listenfeld `distance`) | details.distance: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und Ende der Reihe `streams.distance` weicht höchstens 20 m / 1 % ab | Modell vorbereitet, Eingabe in der App nicht freigegeben | **nein** | `unverified_semantics` | nach Beleg | Schwimmen: Distanz = Bahnen × Bahnlänge laut Uhr — Bedeutung unbelegt |
| hiking | Tempo (Ø) | Distanz / Dauer (beide wirksam) | details.durations: nein — angenommen; details.distance: nein — angenommen | ja (Vertrag 3) | wie Dauer und Distanz | erbt die Markierung von Dauer / Distanz | **nein** | `unverified_semantics` | nach Beleg | nur Lauf, Gehen, Wandern |
| hiking | Herzfrequenz (Ø) | `best_efforts.stats.heart_rate.avg` — alle gelieferten Zeilen | details.heart_rate: nein — angenommen | ja (Vertrag 3) | Details-Vertrag 3; weicht höchstens 2 bpm vom Listenwert ab; bei Ausdünnung als Näherung gekennzeichnet | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nach Beleg | nicht aus der Anzeige-Reihe |
| hiking | Herzfrequenz (Max) | `best_efforts.stats.heart_rate.max` | details.heart_rate: nein — angenommen | ja (Vertrag 3) | nur wenn Garmin alle Zeilen lieferte — ein Maximum aus ausgedünnten Zeilen ist eine Untergrenze | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nur mit vollständiger Lieferung | Listenfeld `maxHR` ist nicht belegt |
| hiking | Strecken-Bestzeit (alle Distanzen) | `best_efforts.distance.targets` — Worker, vor der Ausdünnung | details.distance: nein — angenommen; details.time: nein — angenommen | ja (Vertrag 3) | Güte `measured`: zwischen zwei echten Messzeilen, Überhang ≤ 1 % / 10 m; verstrichene Zeit | Konflikt, wenn die korrigierte Dauer kürzer ist als die Bestzeit | **nein** | `unverified_semantics` | nach Beleg | gemessene Obergrenze der wahren Bestzeit — nie zu schnell |
| hiking | Aktive Strecken-Bestzeit (alle Distanzen) | kleinster von: `best_efforts.distance_active.targets` (Timer-Achse, Worker v8-449.1) · ganze Aktivität mit `garmin.timer_duration_s`, wenn ihre Distanz die Zielstrecke trifft · verstrichenes Fenster als Obergrenze | details.distance: nein — angenommen; details.durations: nein — angenommen | ja (Vertrag 3) | Timer = Garmin `sumDuration` (manuelle und Auto-Pause ausgeschlossen, nicht unterscheidbar); ganze Aktivität nur bei Überhang ≤ 10 m / 1 %; Strecke bei stehendem Timer = `pause_conflict` | korrigierte Dauer zählt als Gesamtzeit der Aktivität (manuell markiert) | **nein** | `unverified_semantics` | nach Beleg | aktive Trainingsbestzeit, nie mit der Bestzeit einschließlich Pausen verglichen; keine Bewegungszeit |
| hiking | Wettkampf-Bestzeit (alle Distanzen) | ganze Aktivität, verstrichene Zeit (`garmin.elapsed_duration_s`; eigene Daten: Angabe) | — | ja (Vertrag 3) | nur, wenn du die Aktivität als Wettkampfergebnis bestätigt hast; Distanz trifft die Wettkampfstrecke (≤ 10 m / 1 %) | wirksame Dauer bei eigenen Daten | **nein** | `unsupported_source` | vorbereitet — nur bestätigte Ergebnisse | nie aus Sportart oder Datum geraten |
| hiking | Training Effect | `ext.fields.aerobicTrainingEffect` | list.training_effect: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | nur im Rohblock (Serverliste) |
| hiking | Kalorien | `summary.caloriesKcal` (Garmin-Listenfeld) | list.calories: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | keine Leistungskennzahl |
| rowing | Dauer | Spalte `duration_seconds` (Garmin: Timer-Dauer des Listeneintrags; ORVIA-Workout: Zeitstempel der Session) | details.durations: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und `garmin.timer_duration_s` weicht höchstens 5 s / 1 % ab | wirksamer Wert zählt; bleibt als manuell markiert; Quelle bleibt erhalten | **nein** | `unverified_semantics` | nach Beleg | Bewegungs- und verstrichene Zeit stehen getrennt in `metrics.garmin` |
| rowing | Distanz | `summary.distanceM` (Garmin: Listenfeld `distance`) | details.distance: nein — angenommen | ja (Vertrag 3) | Garmin: Details-Vertrag 3 und Ende der Reihe `streams.distance` weicht höchstens 20 m / 1 % ab | Modell vorbereitet, Eingabe in der App nicht freigegeben | **nein** | `unverified_semantics` | nach Beleg | Schwimmen: Distanz = Bahnen × Bahnlänge laut Uhr — Bedeutung unbelegt |
| rowing | Herzfrequenz (Ø) | `best_efforts.stats.heart_rate.avg` — alle gelieferten Zeilen | details.heart_rate: nein — angenommen | ja (Vertrag 3) | Details-Vertrag 3; weicht höchstens 2 bpm vom Listenwert ab; bei Ausdünnung als Näherung gekennzeichnet | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nach Beleg | nicht aus der Anzeige-Reihe |
| rowing | Herzfrequenz (Max) | `best_efforts.stats.heart_rate.max` | details.heart_rate: nein — angenommen | ja (Vertrag 3) | nur wenn Garmin alle Zeilen lieferte — ein Maximum aus ausgedünnten Zeilen ist eine Untergrenze | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | nur mit vollständiger Lieferung | Listenfeld `maxHR` ist nicht belegt |
| rowing | Leistung (Ø) | `best_efforts.stats.power` | details.power: nein — angenommen | ja (Vertrag 3) | Details-Vertrag 3 | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | Quellname `directPower` unbelegt |
| rowing | Leistungs-Bestwert (alle Fenster) | `best_efforts.power.windows` — Worker, vor der Ausdünnung | details.power: nein — angenommen; details.time: nein — angenommen | ja (Vertrag 3) | Güte `exact`: Garmin lieferte alle Zeilen, sekündliche Aufzeichnung; kein Sensor-Aussetzer im Fenster; Fenster auf verstrichener Zeit | Konflikt, wenn die korrigierte Dauer kürzer ist als das Fenster | **nein** | `unverified_semantics` | erst nach Beleg und nur bei vollständiger Lieferung | Fenster: 1 s … 60 min |
| rowing | Training Effect | `ext.fields.aerobicTrainingEffect` | list.training_effect: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | nur im Rohblock (Serverliste) |
| rowing | Kalorien | `summary.caloriesKcal` (Garmin-Listenfeld) | list.calories: nur Bibliothek | ja (Vertrag 3) | Feld geliefert | keine Korrektur vorgesehen | **nein** | `unverified_semantics` | erst nach Beleg | keine Leistungskennzahl |

## 5 · Eigene Daten (ORVIA-Workout, manuelle Eingabe)

| sport | metric | source | ledger eligible? | reason | notes |
|---|---|---|---|---|---|
| gym (orvia_workout) | Dauer | duration_seconds | **ja** | — | — |
| gym (orvia_workout) | Herzfrequenz (Ø) | — | **nein** | `missing_data` | eingegebener Wert |
| gym (orvia_workout) | Kraft-Volumen | summary.totalVolumeKg | **ja** | — | — |
| running (manual) | Dauer | duration_seconds | **ja** | — | — |
| running (manual) | Distanz | summary.distance | **ja** | — | — |
| running (manual) | Tempo (Ø) | distance / duration (wirksam) | **ja** | — | — |
| running (manual) | Herzfrequenz (Ø) | summary.avgHr | **ja** | — | eingegebener Wert |
| running (manual) | Strecken-Bestzeit | — | **nein** | `unsupported_source` | keine Aufzeichnung — kein Bestwert |
| running (manual) | Leistungs-Bestwert | — | **nein** | `unsupported_source` | keine Aufzeichnung — kein Bestwert |

## 6 · Zwei Fälle, die das Register kennen muss

- **Garmin hat ausgedünnt** (im einzigen Mitschnitt: 1855 von 5527 Zeilen): ein Leistungs-Bestwert ist dann höchstens eine
  Näherung → `insufficient_resolution` — auch wenn die Bedeutung der Leistungsreihe belegt wäre. Zulässig wird er nur, wenn Garmin alle Zeilen liefert.
- **Altzeile** (Details-Vertrag < 3): die Schrittfrequenz kann der Halbwert sein → `legacy_schema`. Sie wird nie umgerechnet, nur neu geladen.

## 7 · Manuelle Korrekturen

- Das Register benutzt den **wirksamen** Wert (`activityEffective`): korrigiert ist korrigiert.
- Jede Antwort trägt `provenance.manual`. Ein Rekord aus einem korrigierten Wert ist möglich, bleibt aber als solcher erkennbar;
  die Quelle steht weiter in `metrics.corrections`.
- **Konflikt** (`manual_override_conflict`): ein Bestwert aus der Aufzeichnung, dessen Fenster länger ist als die manuell korrigierte Dauer,
  kann nicht stimmen — dann zählt keiner von beiden.

## 8 · Empfehlung für v8-448

Registerfähig bei vollständig gelieferten Daten (heutiger Belegstand; das Nachladen auf Vertrag 3 ist abgeschlossen):

**Ja:** running: Dauer · running: Distanz · running: Tempo (Ø) · running: Herzfrequenz (Ø) · running: Herzfrequenz (Max) · running: Schrittfrequenz (Ø) · running: Strecken-Bestzeit (alle Distanzen) · running: Aktive Strecken-Bestzeit (alle Distanzen)

**Eigene Daten:** Dauer (alle Quellen), Kraft-Volumen (ORVIA-Workout), Distanz und Tempo manueller Einheiten.

**Noch nicht** (58 Zeilen) — fast immer `unverified_semantics`: der Wert ist da, aber seine Bedeutung für diese Sportart ist nicht belegt. Der Weg dorthin: Feldzensus (Lieferung), dann Mitschnitt oder Vergleich mit Garmin Connect (Bedeutung).

## 9 · Freigabe je Kennzahl (finales Gate v8-447.3)

Drei Stände je Kennzahl, alle vom Modul geurteilt (Bezugs-Aktivität wie Abschnitt 4):

- **heute** — Stand 15.10.2026 für 40 von 41 Garmin-Aktivitäten: vollständige Auflösung (maxchart=20000), aber ohne Garmin-Typ,
  ohne Startzeiten, ohne Rohfelder des Listeneintrags.
- **nach Herkunfts-Backfill** — `PROVENANCE_BACKFILL=apply`: Typ, UTC-/Ortszeit, Versatz und Rohfelder ergänzt (nur Liste, keine Detailabrufe).
- **nach Neuprüfung** — `DETAIL_REFETCH_SEMANTICS=1`: Details einmal neu geladen, damit die Bedeutungsprüfung mit den nun vorhandenen
  Rohfeldern läuft (nur dafür nötig: sie braucht alle Messzeilen).

| Freigabe | Bedeutung |
|---|---|
| **FREI** | heute registerfähig |
| **FREI NACH HERKUNFTS-BACKFILL** | registerfähig, sobald der Metadaten-Backfill gelaufen ist |
| **FREI NACH NEUPRÜFUNG** | zusätzlich erst nach dem einmaligen Neuladen für die Bedeutungsprüfung |
| **NICHT FREI** | Grund in Klammern — es fehlt ein Beleg; Backfill und Neuladen ändern daran nichts |

| Sportart | Kennzahl | Freigabe |
|---|---|---|
| running | Dauer | **FREI** |
| running | Distanz | **FREI** |
| running | Tempo (Ø) | **FREI** |
| running | Herzfrequenz (Ø) | **FREI** |
| running | Herzfrequenz (Max) | **FREI** |
| running | Schrittfrequenz (Ø) | **FREI NACH NEUPRÜFUNG** |
| running | Leistung (Ø) | NICHT FREI (`unverified_semantics`) |
| running | Leistungs-Bestwert (alle Fenster) | NICHT FREI (`unverified_semantics`) |
| running | Strecken-Bestzeit (alle Distanzen) | **FREI** |
| running | Aktive Strecken-Bestzeit (alle Distanzen) | **FREI** |
| running | Wettkampf-Bestzeit (alle Distanzen) | NICHT FREI (`unsupported_source`) |
| running | Training Effect | NICHT FREI (`unverified_semantics`) |
| running | Kalorien | NICHT FREI (`unverified_semantics`) |
| cycling | Dauer | NICHT FREI (`unverified_semantics`) |
| cycling | Distanz | NICHT FREI (`unverified_semantics`) |
| cycling | Herzfrequenz (Ø) | NICHT FREI (`unverified_semantics`) |
| cycling | Herzfrequenz (Max) | NICHT FREI (`unverified_semantics`) |
| cycling | Trittfrequenz (Ø) | NICHT FREI (`unverified_semantics`) |
| cycling | Leistung (Ø) | NICHT FREI (`unverified_semantics`) |
| cycling | Leistungs-Bestwert (alle Fenster) | NICHT FREI (`unverified_semantics`) |
| cycling | Training Effect | NICHT FREI (`unverified_semantics`) |
| cycling | Kalorien | NICHT FREI (`unverified_semantics`) |
| cycling | FTP | NICHT FREI (`unsupported_source`) |
| swimming | Dauer | NICHT FREI (`unverified_semantics`) |
| swimming | Distanz | NICHT FREI (`unverified_semantics`) |
| swimming | Herzfrequenz (Ø) | NICHT FREI (`unverified_semantics`) |
| swimming | Herzfrequenz (Max) | NICHT FREI (`unverified_semantics`) |
| swimming | SWOLF | NICHT FREI (`unverified_semantics`) |
| swimming | Zugfrequenz | NICHT FREI (`unverified_semantics`) |
| swimming | Training Effect | NICHT FREI (`unverified_semantics`) |
| swimming | Kalorien | NICHT FREI (`unverified_semantics`) |
| gym | Dauer | NICHT FREI (`unverified_semantics`) |
| gym | Distanz | NICHT FREI (`missing_data`) |
| gym | Herzfrequenz (Ø) | NICHT FREI (`unverified_semantics`) |
| gym | Herzfrequenz (Max) | NICHT FREI (`unverified_semantics`) |
| gym | Training Effect | NICHT FREI (`unverified_semantics`) |
| gym | Kraft-Volumen | NICHT FREI (`unverified_semantics`) |
| gym | Kalorien | NICHT FREI (`unverified_semantics`) |
| walking | Dauer | NICHT FREI (`unverified_semantics`) |
| walking | Distanz | NICHT FREI (`unverified_semantics`) |
| walking | Tempo (Ø) | NICHT FREI (`unverified_semantics`) |
| walking | Herzfrequenz (Ø) | NICHT FREI (`unverified_semantics`) |
| walking | Herzfrequenz (Max) | NICHT FREI (`unverified_semantics`) |
| walking | Strecken-Bestzeit (alle Distanzen) | NICHT FREI (`unverified_semantics`) |
| walking | Aktive Strecken-Bestzeit (alle Distanzen) | NICHT FREI (`unverified_semantics`) |
| walking | Wettkampf-Bestzeit (alle Distanzen) | NICHT FREI (`unsupported_source`) |
| walking | Training Effect | NICHT FREI (`unverified_semantics`) |
| walking | Kalorien | NICHT FREI (`unverified_semantics`) |
| hiking | Dauer | NICHT FREI (`unverified_semantics`) |
| hiking | Distanz | NICHT FREI (`unverified_semantics`) |
| hiking | Tempo (Ø) | NICHT FREI (`unverified_semantics`) |
| hiking | Herzfrequenz (Ø) | NICHT FREI (`unverified_semantics`) |
| hiking | Herzfrequenz (Max) | NICHT FREI (`unverified_semantics`) |
| hiking | Strecken-Bestzeit (alle Distanzen) | NICHT FREI (`unverified_semantics`) |
| hiking | Aktive Strecken-Bestzeit (alle Distanzen) | NICHT FREI (`unverified_semantics`) |
| hiking | Wettkampf-Bestzeit (alle Distanzen) | NICHT FREI (`unsupported_source`) |
| hiking | Training Effect | NICHT FREI (`unverified_semantics`) |
| hiking | Kalorien | NICHT FREI (`unverified_semantics`) |
| rowing | Dauer | NICHT FREI (`unverified_semantics`) |
| rowing | Distanz | NICHT FREI (`unverified_semantics`) |
| rowing | Herzfrequenz (Ø) | NICHT FREI (`unverified_semantics`) |
| rowing | Herzfrequenz (Max) | NICHT FREI (`unverified_semantics`) |
| rowing | Leistung (Ø) | NICHT FREI (`unverified_semantics`) |
| rowing | Leistungs-Bestwert (alle Fenster) | NICHT FREI (`unverified_semantics`) |
| rowing | Training Effect | NICHT FREI (`unverified_semantics`) |
| rowing | Kalorien | NICHT FREI (`unverified_semantics`) |
| eigene Daten | Dauer (ORVIA-Workout, manuell) | **FREI** — manuell korrigierte Werte zählen mit ihrem wirksamen Wert und bleiben gekennzeichnet |
| eigene Daten | Kraft-Volumen (ORVIA-Workout) | **FREI** |
| eigene Daten | Distanz / Tempo (manuelle Einheit) | **FREI** — Bestzeiten nicht (keine Aufzeichnung) |

Eine unvollständige Herkunft sperrt **keine** Kennzahl pauschal: Dauer, Distanz, Tempo, Herzfrequenz und Strecken-Bestzeit des Laufs
brauchen weder Typ noch Ortszeit. Gesperrt wird nur, was den Kontext oder die Rohfelder wirklich braucht.

## 10 · Kontext: Laufband, Rolle, Becken, Freiwasser

Kontext kommt **nur** aus Garmins Typ (`metrics.garmin.type_key`) und nur, wenn der Name ihn ausdrücklich nennt. Ein generischer Typ
(`running`, `cycling`) oder ein fehlender Typ = **unbelegt** (nicht „draußen"). Kein Raten aus GPS — auch virtuelle Fahrten haben eine
Strecke —, aus dem Titel oder der Uhrzeit. Kontextgebundene Auswertungen fragen mit `opts.environment` und bekommen sonst `unverified_context`.

| Garmin-Typ | Kontext |
|---|---|
| `treadmill_running` | indoor |
| `indoor_running` | indoor |
| `indoor_cycling` | indoor |
| `indoor_rowing` | indoor |
| `indoor_cardio` | indoor |
| `indoor_climbing` | indoor |
| `virtual_ride` | virtual |
| `virtual_run` | virtual |
| `lap_swimming` | pool |
| `open_water_swimming` | open_water |
| `trail_running` | outdoor |
| `street_running` | outdoor |
| `road_biking` | outdoor |
| `gravel_cycling` | outdoor |
| `mountain_biking` | outdoor |
| `cyclocross` | outdoor |
| `downhill_biking` | outdoor |
| alle anderen / keiner | unbelegt |

| Fall | Urteil |
|---|---|
| Lauf `running`: 5-km-Bestzeit | **ja** |
| Lauf ohne Garmin-Typ: 5-km-Bestzeit | **ja** |
| Lauf `treadmill_running`: 5-km-Bestzeit | nein (`unsupported_source`) |
| Lauf `running`: 5-km-Bestzeit **draußen** verlangt | nein (`unverified_context`) |
| Lauf `trail_running`: 5-km-Bestzeit **draußen** verlangt | **ja** |
| Rad `virtual_ride`: 20-min-Leistung **draußen** verlangt (Beleg Leistung angenommen) | nein (`unverified_context`) |
| Rad `road_biking`: 20-min-Leistung **draußen** verlangt (Beleg Leistung angenommen) | **ja** |
| Schwimmen `lap_swimming`: SWOLF (Beleg angenommen) | **ja** |
| Schwimmen `open_water_swimming`: SWOLF | nein (`unsupported_source`) |
| Schwimmen ohne Garmin-Typ: SWOLF | nein (`missing_data`) |

## 11 · Protokoll der Gates

| Datum | Prüfung | Ergebnis | Folge |
|---|---|---|---|
| 2026-10-11 | Nachladen auf Details-Vertrag 3 | 40 von 40 Garmin-Aktivitaeten aktuell, keine Fehler, keine Rueckstellungen | Grund legacy_schema entfaellt fuer den Bestand |
| 2026-10-11 | Laufkadenz am iPhone gegen Garmin Connect | stimmt | Schrittfrequenz (Lauf): validated |
| 2026-10-11 | Manuelle Dauer-Korrektur (Kraft, 341 → 75 min) nach Neustart und Sync | bleibt 75 min | Dauer: wirksamer Wert haelt; Korrektur bleibt gekennzeichnet (provenance.manual) |
| 2026-10-11 | Aufloesungspruefung maxchart=20000 an 8 Aktivitaeten (Mitschnitt-Skript, Probelauf, nichts gespeichert) | alle liefern saemtliche gemeldeten Zeilen, Median-Abstand 1 s | Leistungs-Bestwerte KOENNEN exakt werden — erst nach DETAIL_MAXCHART=20000 und gezieltem Neuladen (DETAIL_REFETCH_RESOLUTION); bis dahin insufficient_resolution |
| 2026-10-11 | Bedeutungspruefung (Probelauf, ausgeduennte Antwort) | Abweichungen bei Laufkadenz, Beckenschwimm-Distanz und Bewegungszeiten | nicht als Beleg gewertet; Pruefung laeuft jetzt auch auf der vollstaendigen Antwort und im Worker (metrics.ext.semantics) und benennt die Ursache |
| 2026-10-15 | Neuladen mit maxchart=20000 (Worker v8-447.2, DETAIL_REFETCH_RESOLUTION danach aus) | 41 von 41 Garmin-Aktivitaeten: Vertrag 3, maxchart=20000, vollstaendige Abtastung | insufficient_resolution entfaellt fuer den Bestand; Max-HF frei; Leistungs-Bestwerte nur noch am fehlenden Bedeutungsbeleg gesperrt |
| 2026-10-15 | Feldzensus Herkunft | 40 von 41 mit unvollstaendiger Herkunft (ohne Typ und Zeit): 15 Lauf, 12 Rad, 8 Kraft, 5 Schwimmen | Ursache: Herkunft kam nur aus dem Listeneintrag im Sync-Fenster (2 Tage), der Block stammte vom Nachladen der Details. Metadaten-Backfill v8-447.3 (nur Liste). Ohne Rohfelder lief keine Bedeutungspruefung → Oe-Laufkadenz erst nach Backfill + Neupruefung |
