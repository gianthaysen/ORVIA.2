# Athlete Performance Ledger

**Status: IMPLEMENTIERT, INTEGRIERT HINTER FLAG (`performance_ledger`, Standard aus, keine sichtbare Änderung)** · Rechenversion `ledger@1` · v8-448B

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
| Laufen | Schnellste 400 m | schnellste Zeit (niedriger ist besser) | `distanceBest` (400 m) | **frei** | `unsupported_source` |
| Laufen | Schnellster Kilometer | schnellste Zeit (niedriger ist besser) | `distanceBest` (1000 m) | **frei** | `unsupported_source` |
| Laufen | Schnellste 5 km | schnellste Zeit (niedriger ist besser) | `distanceBest` (5000 m) | **frei** | `unsupported_source` |
| Laufen | Schnellste 10 km | schnellste Zeit (niedriger ist besser) | `distanceBest` (10000 m) | **frei** | `unsupported_source` |
| Laufen | Schnellster Halbmarathon | schnellste Zeit (niedriger ist besser) | `distanceBest` (21098 m) | **frei** | `unsupported_source` |
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
| `run-bests.js` Lauf 1 km … Marathon | unverändert | unverändert angezeigt | **nur** Register (Kontext standard) |
| `run-bests.js` Rad / Schwimmen | unverändert | unverändert | unverändert (kennt das Register nicht) |
| `engine/pb-sync.js` → Profil | unverändert | **pausiert** (kein Hin-und-her) | aus Register-Bestzeiten |
| `achievements.js` Einzelmaxima | unverändert | unverändert | nur freigegebene Distanzen, Kontext standard |
| `achievements.js` Summen | unverändert | unverändert | nur freigegebene Distanzen, alle Kontexte |
| `engine/highlights.js` (vorbereitet) | — | — | bekommt künftig Rekord-Ereignisse als belegte Kandidaten |

Kein Rekord wird an zwei Stellen gerechnet: was das Register kennt, kommt bei `on` nur aus dem Register.

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
