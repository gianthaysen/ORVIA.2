# Athlete Performance Ledger

**Status: IMPLEMENTIERT, VORBEREITET (nicht ausgeliefert, Flag `performance_ledger` aus)** · Rechenversion `ledger@1` · v8-448A

> Erzeugt: `node app/tools/gen-ledger-doc.mjs`. Definitionen und Freigaben kommen aus dem Code
> (`app/js/engine/performance-ledger.js`, `app/js/engine/metric-eligibility.js`); ein Test vergleicht Datei und Code.

## 1 · Aufbau

| Baustein | Datei | Aufgabe |
|---|---|---|
| Rechenkern (rein) | `app/js/engine/performance-ledger.js` | Definitionen, Einträge, Rekordhistorie, Meilensteine, inkrementelle Aktualisierung |
| Urteil + Wert | `app/js/engine/metric-eligibility.js` | einzige Stelle, die entscheidet, ob ein Wert zählt — und welcher (`evaluate().value`) |
| Wirksamer Wert | `app/js/activity-effective.js` | manuelle Korrekturen (z. B. 341 → 75 min) |
| Doppelte | `app/js/activity-config.js` `attachRecordings` | gekoppelte Uhr-Aufzeichnung ist keine eigene Einheit |
| Nachführen | `app/js/performance-ledger-store.js` | Flag (fail-closed), Zwischenspeicher je Nutzer, Speichern in Teilen |
| Speichern | `app/js/repos/performanceLedgerRepository.js` | RPC `orvia_ledger_apply` (eine Transaktion) |
| Datenbank | `supabase/migrations/0051_performance_ledger.sql` | Tabellen, RLS, Konsistenzregeln, „neu zu berechnen", Flag-Name |
| Ansicht | `app/js/screens/performance-ledger-view.js` | „Leistungsentwicklung", Leerzustand, Verlauf, Meilensteine, Wartendes |

## 2 · Regeln

- **Eintrag** je Aktivität × Definition: `value`/`unit` nur, wenn die Eligibility freigibt; sonst `blocked` mit Grund und **ohne Wert**.
- **Kennzahl** = `<sportart>.<rekord>@<kontextklasse>`. Kontextklassen: `standard` (nicht als indoor/virtuell belegt), `indoor`, `virtual`, `pool`, `open_water`.
  Verschiedene Klassen werden **nie** verglichen (Rolle ≠ Straße, Laufband ≠ draußen, Becken ≠ Freiwasser). Kontext kommt aus dem Garmin-Typ
  oder — bei eigenen Daten — aus der Eingabe des Nutzers; nie aus GPS, Titel oder Uhrzeit.
- **Historie** je Kennzahl aus allen freigegebenen Einträgen, sortiert nach der **Ortszeit der Aktivität** (nie Importzeit):
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

## 6 · Verhältnis zu bestehenden Auswertungen

| Bestehend (live, unverändert) | Was es tut | Mit dem Register |
|---|---|---|
| `run-bests.js` + `engine/pb-sync.js` | aktuelle Bestzeit je Distanz aus Runden/Anzeige-Messreihe, ins Profil (Zonen, Prognose) | wird durch die Register-Historie ersetzt (Worker-Bestwerte vor der Ausdünnung, Eligibility, Kontext); bis dahin bleibt es die Quelle des Profils |
| `achievements.js` | Medaillen/Leitern aus der kanonischen Liste, ohne Eligibility | liest künftig die Register-Meilensteine; keine zweite Meilenstein-Logik |
| `engine/highlights.js` (vorbereitet) | Highlight-Kandidaten | bekommt Rekord-Ereignisse aus dem Register als belegte Kandidaten |

Bis zur Umstellung (v8-448B) gibt es damit **ein** Register und zwei alte Anzeigen, die unverändert weiterlaufen; nichts davon schreibt ins Register.

## 7 · Einschalten (v8-448B, nicht Teil dieses Schritts)

1. Migration 0051 einspielen (vorher lokal geprüft: `supabase/tests/performance_ledger_db_v448_test.mjs`). Rückweg: `supabase/migrations_rollback/0051_performance_ledger_rollback.sql`.
2. Module in `index.html` und den Offline-Speicher; Ansicht einhängen; Build anheben (`performance_ledger` steht seit v8-448A in `KNOWN` von `engine/feature-flags.js`, = CHECK der Migration).
3. Flag je Konto per service_role setzen. Erst dann rechnet und speichert das Register — beim ersten Lauf vollständig, danach inkrementell.
