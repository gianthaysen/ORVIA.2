# Athlete Performance Ledger

**Status: IMPLEMENTIERT, INTEGRIERT HINTER FLAG (`performance_ledger`, Standard aus, keine sichtbare Änderung)** · Rechenversion `ledger@2` · v8-449.1

> Erzeugt: `node app/tools/gen-ledger-doc.mjs`. Definitionen und Freigaben kommen aus dem Code
> (`app/js/engine/performance-ledger.js`, `app/js/engine/metric-eligibility.js`); ein Test vergleicht Datei und Code.

## 1 · Aufbau

| Baustein | Datei | Aufgabe |
|---|---|---|
| Rechenkern (rein) | `app/js/engine/performance-ledger.js` | Definitionen, Einträge, Rekordhistorie, Meilensteine, inkrementelle Aktualisierung |
| Urteil + Wert | `app/js/engine/metric-eligibility.js` | einzige Stelle, die entscheidet, ob ein Wert zählt — und welcher (`evaluate().value`) |
| Wirksamer Wert | `app/js/activity-effective.js` | manuelle Korrekturen (z. B. 341 → 75 min) |
| Doppelte | `app/js/activity-config.js` `attachRecordings` | gekoppelte Uhr-Aufzeichnung ist keine eigene Einheit |
| Nachführen | `app/js/performance-ledger-store.js` | Flag (fail-closed, je Sitzung fest), vollständiger Bestand (Index + Änderungen), IndexedDB-Zwischenspeicher je Nutzer, Speichern in Teilen, Probelauf `dryRun()` |
| Umschalten | `app/js/engine/records-bridge.js` | einzige Stelle, die entscheidet, ob run-bests / pb-sync / achievements aus dem Register lesen (`off` · `pending` · `on`) |
| Speichern | `app/js/repos/performanceLedgerRepository.js` | RPC `orvia_ledger_apply` (eine Transaktion) |
| Datenbank | `supabase/migrations/0051_performance_ledger.sql` | Tabellen, RLS, Konsistenzregeln, „neu zu berechnen", Flag-Name |
| Ansicht | `app/js/screens/performance-ledger-view.js` | „Leistungsentwicklung": Bestwerte, Verlauf, Verbesserungen, Sportart-Überblick, Monatsumfang, Meilensteine, Herkunft je Rekord, Wartendes |

## 2 · Regeln

- **Eintrag** je Aktivität × Definition: `value`/`unit` nur, wenn die Eligibility freigibt; sonst `blocked` mit Grund und **ohne Wert**.
- **Kennzahl** = `<sportart>.<rekord>@<kontextklasse>`. Kontextklassen: `standard` (nicht als indoor/virtuell belegt), `indoor`, `virtual`, `pool`, `open_water`.
  Verschiedene Klassen werden **nie** verglichen (Rolle ≠ Straße, Laufband ≠ draußen, Becken ≠ Freiwasser). Kontext kommt aus dem Garmin-Typ
  oder — bei eigenen Daten — aus der Eingabe des Nutzers; nie aus GPS, Titel oder Uhrzeit.
- **Historie** je Kennzahl aus allen freigegebenen Einträgen, sortiert nach dem **UTC-Zeitpunkt der Aktivität** (nie Importzeit; angezeigt in Ortszeit):
  `first` · `improved` (echt besser auf der Genauigkeitsstufe der Einheit: s 0.1, m 1, kg 0.1, W 1, bpm 1, spm 0.1, s/km 0.1) · `equalled` (gleich; der frühere Halter bleibt).
  Jede Verbesserung trägt Vorgänger, Verbesserung (absolut, %), Tage seit dem Vorgänger, Datum.
- **Neuberechnung** immer vollständig für genau die betroffenen Kennzahlen → Nachimport älterer Einheiten, Korrektur, Löschung und
  Reimport ergeben dieselbe Historie wie eine Berechnung von Grund auf (Test). Jede Änderung steht im Protokoll (`performance_ledger_log`).
- **Geltungsbereich:** „ORVIA-Bestwert seit <erste Aktivität der Sportart>". Ein Allzeitrekord wird nie behauptet.
- **Inkrementell:** Fingerabdruck je Aktivität (Eingabe ohne volle Messreihen + Belegstand der Eligibility). Unverändert = nicht neu geprüft.
  Steigt eine Belegstufe (z. B. nach dem Census), rechnet das Register automatisch alles neu.

## 3 · Rekorde je Sportart

Freigabe heute: **Garmin** = Bezugs-Aktivität mit bestmöglichem Beleg (Vertrag 3, volle Auflösung, Herkunft vollständig) · **eigene Daten** = manuelle Einheit / ORVIA-Workout.

| Sportart | Rekord | Art | Kennzahl (Eligibility) | Garmin | eigene Daten |
|---|---|---|---|---|---|
| Laufen | Schnellste 400 m | schnellste Zeit (niedriger ist besser) | `distanceBestActive` (400 m) | **frei** | `missing_data` |
| Laufen | Schnellste 400 m | schnellste Zeit (niedriger ist besser) | `distanceBest` (400 m) | **frei** | `unsupported_source` |
| Laufen | Schnellster Kilometer | schnellste Zeit (niedriger ist besser) | `distanceBestActive` (1000 m) | **frei** | `missing_data` |
| Laufen | Schnellster Kilometer | schnellste Zeit (niedriger ist besser) | `distanceBest` (1000 m) | **frei** | `unsupported_source` |
| Laufen | Schnellste 5 km | schnellste Zeit (niedriger ist besser) | `distanceBestActive` (5000 m) | **frei** | `missing_data` |
| Laufen | Schnellste 5 km | schnellste Zeit (niedriger ist besser) | `distanceBest` (5000 m) | **frei** | `unsupported_source` |
| Laufen | Schnellste 10 km | schnellste Zeit (niedriger ist besser) | `distanceBestActive` (10000 m) | **frei** | **frei** |
| Laufen | Schnellste 10 km | schnellste Zeit (niedriger ist besser) | `distanceBest` (10000 m) | **frei** | `unsupported_source` |
| Laufen | Schnellster Halbmarathon | schnellste Zeit (niedriger ist besser) | `distanceBestActive` (21098 m) | **frei** | `missing_data` |
| Laufen | Schnellster Halbmarathon | schnellste Zeit (niedriger ist besser) | `distanceBest` (21098 m) | **frei** | `unsupported_source` |
| Laufen | Schnellster Marathon | schnellste Zeit (niedriger ist besser) | `distanceBestActive` (42195 m) | **frei** | `missing_data` |
| Laufen | Schnellster Marathon | schnellste Zeit (niedriger ist besser) | `distanceBest` (42195 m) | **frei** | `unsupported_source` |
| Laufen | Längster Lauf | längste Distanz | `distance` | **frei** | **frei** |
| Laufen | Längste Laufzeit | längste Dauer | `duration` | **frei** | **frei** |
| Gehen | Längster Spaziergang | längste Distanz | `distance` | `unverified_semantics` | **frei** |
| Gehen | Längste Dauer | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Wandern | Längste Wanderung | längste Distanz | `distance` | `unverified_semantics` | **frei** |
| Wandern | Längste Dauer | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Radfahren | Längste Fahrt | längste Distanz | `distance` | `unverified_semantics` | **frei** |
| Radfahren | Längste Fahrzeit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Radfahren | Beste Leistung 5 s | höchster Wert | `powerBest` (5 s) | `unverified_semantics` | `unsupported_source` |
| Radfahren | Beste Leistung 1 min | höchster Wert | `powerBest` (60 s) | `unverified_semantics` | `unsupported_source` |
| Radfahren | Beste Leistung 5 min | höchster Wert | `powerBest` (300 s) | `unverified_semantics` | `unsupported_source` |
| Radfahren | Beste Leistung 20 min | höchster Wert | `powerBest` (1200 s) | `unverified_semantics` | `unsupported_source` |
| Radfahren | Beste Leistung 60 min | höchster Wert | `powerBest` (3600 s) | `unverified_semantics` | `unsupported_source` |
| Schwimmen | Längste Schwimmeinheit | längste Distanz | `distance` | `unverified_semantics` | **frei** |
| Schwimmen | Längste Schwimmzeit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Rudern | Längste Rudereinheit | längste Distanz | `distance` | `unverified_semantics` | **frei** |
| Rudern | Längste Ruderzeit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Krafttraining | Höchstes Trainingsvolumen | größtes Volumen | `strengthVolume` | `unverified_semantics` | **frei** |
| Krafttraining | Längstes Krafttraining | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Triathlon | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Fußball | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Handball | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Padel | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Tennis | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Leichtathletik | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Basketball | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Mobility | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Volleyball | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Hockey | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Rugby | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Badminton | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Golf | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Klettern | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| Yoga | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |
| HYROX | Längste Einheit | längste Dauer | `duration` | `unverified_semantics` | **frei** |

Sportarten nur mit „Längste Einheit" (Dauer): Triathlon, Fußball, Handball, Padel, Tennis, Leichtathletik, Basketball, Mobility, Volleyball, Hockey, Rugby, Badminton, Golf, Klettern, Yoga, HYROX.
`other` hat bewusst keinen Rekord (unvergleichbar).

## 4 · Meilensteine

| Meilenstein | Regel |
|---|---|
| Erste 5 km | erste Einheit mit freigegebener Distanz ≥ 5000 m (running) |
| Erste 10 km | erste Einheit mit freigegebener Distanz ≥ 10000 m (running) |
| Erster Halbmarathon | erste Einheit mit freigegebener Distanz ≥ 21097.5 m (running) |
| Erster Marathon | erste Einheit mit freigegebener Distanz ≥ 42195 m (running) |
| 100 Laufkilometer in einem Monat | Kalendermonat (Ortszeit) mit Summe freigegebener Distanzen ≥ 100000 m; gesperrte zählen nicht (Summe = Untergrenze, markiert) |
| Erste 100 km auf dem Rad | erste Einheit mit freigegebener Distanz ≥ 100000 m (cycling) |
| Erster Kilometer im Wasser | erste Einheit mit freigegebener Distanz ≥ 1000 m (swimming) |
| Persönlicher Distanzrekord | jede Verbesserung einer Distanz-Kennzahl |

## 5 · Was wartet

Gesperrt bleibt alles, was die Eligibility nicht freigibt — heute vor allem `unverified_semantics` (Bedeutung der Garmin-Quelle für die Sportart
nicht belegt): Garmin-Distanz/-Dauer bei Rad, Schwimmen, Gehen, Wandern, Rudern, Kraft; Leistungs-Bestwerte. Sobald der Census bzw. ein Vergleich mit
Garmin Connect die Belegstufe hebt (`EVIDENCE` in metric-eligibility.js), werden diese Kennzahlen ohne Codeänderung am Register frei und die Historie
wird rückwirkend rekonstruiert.

## 6 · Zeit

- **Reihenfolge** = UTC-Zeitpunkt: `garmin.start_gmt` → `startedAt` mit Zonenangabe → Wanduhrzeit, umgerechnet mit der Zeitzone des Nutzers.
  Herbst-Umstellung (doppelte Stunde): erste Stunde. Frühjahrs-Lücke: nach vorn verschoben. Die Grundlage steht je Eintrag (`utcBasis`).
- **Anzeige** = Ortszeit der Aktivität (Kalendertag, Monat). Eine Reise über Zeitzonen ändert die Reihenfolge nicht.

## 7 · Verhältnis zu bestehenden Auswertungen (records-bridge)

| Bestehend | Flag aus (`off`) | Flag an, Register lädt (`pending`) | Register bereit (`on`) |
|---|---|---|---|
| `run-bests.js` Lauf 1 km … Marathon, einschließlich Pausen (`k1…k42`) | seit v8-451: Läufe mit Worker-Bestwerten über `metric-eligibility` (= Register-Prüfung), übrige bisherige Fenster | unverändert angezeigt | **nur** Register (`…m@standard`) |
| `run-bests.js` Lauf, aktive Trainingsbestzeit (`active.k1…k42`) | seit v8-451: wie links (`distanceBestActive`), übrige: Timer der ganzen Aktivität, Teilstücke als Obergrenze | unverändert angezeigt | **nur** Register (`…m_active@standard`) |
| `run-bests.js` Rad / Schwimmen | unverändert | unverändert | unverändert (kennt das Register nicht) |
| `engine/pb-sync.js` → Profil, Zonen, Prognose | Bestzeit **einschließlich Pausen** | **pausiert** (kein Hin-und-her) | Register, **einschließlich Pausen** — nie die aktive |
| `achievements.js` Einzelmaxima | unverändert | unverändert | nur freigegebene Distanzen, Kontext standard |
| `achievements.js` Summen | unverändert | unverändert | nur freigegebene Distanzen, alle Kontexte |
| `engine/highlights.js` (vorbereitet) | — | — | bekommt künftig Rekord-Ereignisse als belegte Kandidaten |

Kein Rekord wird an zwei Stellen gerechnet: was das Register kennt, kommt bei `on` nur aus dem Register. Jede Bestzeit trägt ihre Zeitkategorie (`timing`).

## 8 · Vollständiger Bestand

Die App lädt sonst nur die jüngsten 200 Aktivitäten. Das Register liest einen schlanken Index über **alle** Aktivitäten (Schlüssel-Blättern,
je 1000), holt nur geänderte Zeilen (`updated_at`) mit genau den Feldern der Prüfung und gilt erst dann als vollständig, wenn jede Seite gelesen wurde.
Eine Aktivität gilt nur als gelöscht, wenn (a) der Index vollständig ist **und** die Gegenprobe ihre Abwesenheit bestätigt, oder (b) sie lokal
ausdrücklich gelöscht wurde (Tombstone). Nicht geladen heißt nie gelöscht.

## 9 · Freigabeplan (nicht Teil dieses Schritts — jeder Schritt durch Gian)

1. **App ausliefern, Flag aus** (Build ≥ v8-448). Erwartung: keine sichtbare Änderung; run-bests, Profil-Bestzeiten und Medaillen identisch.
2. **Echtdaten-Probelauf, schreibt nichts, braucht keine Migration:** angemeldet in der Desktop-Konsole
   `await ORVIA.performanceLedgerStore.dryRun()` → `report.meta` (`complete: true`, `indexed` = Anzahl Aktivitäten),
   `report.records`, `report.waiting`, `report.legacyComparison.running` (je Distanz `gleich` / `abweichend` / `nur_bisher` / `nur_register`).
   Jede Abweichung erklären, bevor es weitergeht (typisch: Laufband-Einheit, gesperrte Distanz, Einheit außerhalb der 200 geladenen).
3. **Migration 0051** im SQL-Editor (vorher lokal geprüft: `supabase/tests/performance_ledger_db_v448_test.mjs`).
   Rückweg: `supabase/migrations_rollback/0051_performance_ledger_rollback.sql`.
4. **Flag nur für das eigene Konto** (service_role, Befehl im Kopf der Migration). Erster Lauf vollständig, danach inkrementell.
5. **Prüfen:** Profil → Bestzeiten → „Leistungsentwicklung"; Herkunft je Rekord; Tabelle `performance_ledger_log`; zweites Gerät / Neustart (Zwischenspeicher).
6. **Rücknahme** jederzeit: Flag aus (sofort wirksam) → bisherige Anzeigen wie vor dem Einschalten; Daten bleiben unberührt.
7. Erst nach mehreren Tagen ohne Abweichung: weitere Konten.

## 10 · Echtdaten-Abgleich (v8-448C, Probelauf 16.10.2026)

65 Aktivitäten (41 Garmin, 24 ORVIA-Workout; 2 gekoppelte Kraft-Aufzeichnungen), 15 Läufe, alle Vertrag 3 mit voller Auflösung.
Werkzeug: `app/tools/ledger-reconcile-console.js` (nur lesen, in der Konsole), `dryRun().report.legacyComparison` nennt je Distanz die Ursache.

| Distanz | bisher | Register | Ursache | fachlich richtig |
|---|---|---|---|---|
| 1 km | 4:24 (29.07., Anzeige-Reihe 273 Punkte) | 4:21 (29.07., alle 2175 Messzeilen) | dieselbe Aktivität, gröbere Reihe | Register |
| 5 km | 23:39 (13.08., Gesamtaktivität) | 29:11 (06.09., im Halbmarathon) | bisher **Timer-Dauer** 1418 s ohne 9:39 angehaltene Pause; verstrichen 1997 s | Register |
| 10 km | 57:55 (15.07., Gesamtaktivität) | 1:01:49 (06.09.) | bisher Timer-Dauer 3475 s ohne 15:23 Pause; verstrichen 4398 s | Register |
| Halbmarathon | 2:21:08 (06.09., 296 Punkte) | 2:20:47 (06.09., alle 8533 Messzeilen) | dieselbe Aktivität, gröbere Reihe | Register |

Behoben (run-bests, gilt auch bei ausgeschaltetem Flag): Gesamtzeit einer Aktivität = verstrichene Zeit (`totalTimeOf`:
manuelle Korrektur → Garmin `elapsed_duration_s` → Dauer der Zeile), Rundenfenster für Bestzeiten mit verstrichener Rundenzeit.
Die Profil-Bestzeiten (pb-sync) übernehmen das beim nächsten Abgleich von selbst.

## 11 · Zeitkategorien (v8-449.1)

Produktentscheidung (Gian, 16.10.2026): eine bewusst pausierte Trainingsleistung zählt als **aktive Trainingsbestzeit**; sie wird aber nie als
durchgehende Leistung oder Wettkampfergebnis ausgegeben. Drei Kategorien, je eigene Kennzahl und eigene Historie, nie miteinander verglichen:

| Kategorie | Kennzahl | Zeit | Grundlage | wofür |
|---|---|---|---|---|
| aktive Trainingsbestzeit | `running.fastest_<m>m_active@<kontext>` | Timer läuft (manuelle **und** Auto-Pause ausgeschlossen — die Detailantwort unterscheidet sie nicht) | kleinster von: Timer-Fenster aus allen Messzeilen (Worker v8-449.1, `best_efforts.distance_active`) · Timer-Summe und Distanz der **letzten Messzeile**, wenn die ganze Aktivität die Zielstrecke trifft (Überhang ≤ 10 m / 1 %) · Teilstück auf verstrichener Zeit (Obergrenze) | Standardanzeige, Trainingsanalyse |
| Bestzeit einschließlich Pausen | `running.fastest_<m>m@<kontext>` | verstrichene Zeit vom Anfang bis zum Ende des Teilstücks | `best_efforts.distance` (alle Messzeilen) | Prognosen, Zonen, Ziel-Engine, pb-sync |
| Wettkampfbestzeit (vorbereitet) | `running.race_<m>m@<kontext>` | ganze Aktivität, verstrichen | nur vom Nutzer im Ziel **bestätigte** Ergebnisse (`goal.result.activityId`) | Wettkampfhistorie |

Nicht verwendet: Bewegungszeit (Garmins Schätzung), Timer-Ereignisse (nicht geliefert), Interpolation. Wächst die Distanz bei **stehendem** Timer
(Strecke im angehaltenen Zustand), trennt der Worker die Reihe; die Gesamtzeit der Aktivität zählt dann nicht (Grund `pause_conflict`).
Eigene Daten (manuell, ORVIA-Workout): nur aktive Trainingsbestzeit, nur als ganze Einheit, gekennzeichnet „deine Angabe".

Echtdaten (15 Läufe): aktive 5 km **23:38** (13.08., Timer der ganzen Aktivität, 5,006 km, 9:39 angehalten) · einschließlich Pausen **29:11** (06.09.);
aktive 10 km **57:55** (15.07., 10,041 km, 15:23 angehalten) · einschließlich Pausen **1:01:49**; 1 km 4:21 und Halbmarathon 2:20:47 in beiden Kategorien gleich.
Der Listenwert der Dauer (1419 s, ganzzahlig gerundet) und die Timer-Summe der letzten Messzeile (1418 s) unterscheiden sich um eine Sekunde; verwendet wird
die Zeile, aus der auch die Distanz stammt.

Exakte aktive Teilstücke (z. B. 5 km aus einem 7-km-Lauf mit Pause) brauchen die Timer-Summe **je Messzeile** — die rechnet erst der Worker v8-449.1
(`best_efforts.distance_active`); für den Bestand einmaliger Neuabruf mit `DETAIL_REFETCH_ACTIVE=1`. Bis dahin: Gesamtzeit oder Obergrenze, je Wert benannt.

## 12 · Eine Rechnung auch bei ausgeschaltetem Flag (v8-451)

Befund 17.10.2026: Mit Flag aus zeigte die App 1 km 4:24, 5 km (Gesamtzeit) 29:29, Halbmarathon 2:21:08; der Probelauf 4:21 / 29:11 / 2:20:47.
Ursache: `run-bests` rechnete die Fenster aus der Anzeige-Reihe (≤ 300 Punkte), das Register aus `best_efforts` des Workers (alle Messzeilen).

Regel seit v8-451 (je Aktivität, nie gemischt):

| Lauf | Rechnung |
|---|---|
| Garmin, aktueller Details-Vertrag, `best_efforts.distance` vorhanden | **nur** `metric-eligibility.evaluate(a, 'distanceBest' / 'distanceBestActive', {targetM})` — nicht zulässig (z. B. Laufband, Korrekturkonflikt) = kein Kandidat dieser Aktivität |
| sonst (Altbestand, eigene Eingaben) | bisherige Fenster (Runden, Messreihe, ganze Aktivität), unverändert |

Folge: Flag aus und Flag an liefern auf den 15 echten Läufen identische Werte (Test `best_times_v451` D3/S6). `dryRun().report.legacyComparison`
zeigt deshalb für Läufe mit Worker-Bestwerten `gleich` (vorher `genauer`). Laufband-Läufe zählen auch bei ausgeschaltetem Flag nicht mehr.
Jede Bestzeit trägt ihre tatsächliche Strecke `distM` (Ziel + Überhang des Workers bzw. Distanz der letzten Messzeile); die Brücke reicht sie für beide
Zeitkategorien durch. Neue Methode `worker_window` (Etikett „gemessen · alle Messpunkte der Uhr").

