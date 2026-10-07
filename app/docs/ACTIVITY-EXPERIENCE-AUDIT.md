# ORVIA · Activity Experience Architecture — Bestand und Fundament

Stand: 07.10.2026 · Code-Stand v8-446 · erstellt aus dem Code, nicht aus Berichten.

Legende: **UMGESETZT** = im Code und getestet · **VORBEREITET** = Modul/Vertrag steht, die App nutzt es noch nicht · **VORSCHLAG** = nur Plan · **UNBEKANNT** = im Repo nicht belegbar.

---

## 1. Sportarten — was der Code wirklich kennt

Es gibt **keine einzelne Registry**, sondern drei ineinander liegende Mengen:

| Menge | Anzahl | Stelle | Rolle |
|---|---|---|---|
| `trainingDomain.SPORTS` | 10 | `js/training-domain.js:12` | „trainierbar", deckungsgleich mit dem DB-Seed |
| `trainingDomain.ACTIVITY_SPORTS` | 16 | `js/training-domain.js:105` | alles, was `normSport` zurückgeben kann |
| `onboardingSportsLogic.SPORT_CATALOG` | **24** | `js/onboarding/onboarding-sports-logic.js:51` | einzige Liste mit Name, Kategorie, Symbol, Planbarkeit, Kennzahlen-Profil |

Die „ungefähr 16" sind `ACTIVITY_SPORTS`. Produkt-Wahrheit ist der Katalog mit 24 — auf ihm bauen Eingabeschemas, Profilschemas und die Abdeckungsmatrix der Engine auf, und seit v8-446 auch die Signaturen.

**Befund:** `normSport` legt acht Katalog-Sportarten auf `other`: volleyball, hockey, rugby, badminton, golf, climbing, yoga, hyrox. Eine manuell erfasste Yoga-Einheit zählt in Wochensummen und Last deshalb als „Sonstiges". Nicht Teil dieses Schritts (ein Test hält `Yoga → other` bewusst fest); wer eine Struktur über `normSport` schlüsselt, verliert diese acht.

| ID | Name | Kategorie | in den 16 | Farbthema | Signatur (Familie / Bewegung) | gezeichnet |
|---|---|---|---|---|---|---|
| running | Laufen | endurance | ja | running | stride / alternating-impact | nein |
| gym | Krafttraining | strength | ja | strength | load / tension-bars | nein |
| cycling | Radfahren | endurance | ja | cycling | rotation / cadence-ring | nein |
| swimming | Schwimmen | endurance | ja | swimming | flow / waves | **ja** |
| football | Fußball | team | ja | brand | space / pitch-lanes | nein |
| handball | Handball | team | ja | brand | space / arc-attack | nein |
| tennis | Tennis | racket | ja | brand | rally / baseline-exchange | nein |
| padel | Padel | racket | ja | brand | reflection / wall-rebound | nein |
| basketball | Basketball | team | ja | brand | space / shot-arc | nein |
| rowing | Rudern | endurance | ja | rowing | stroke / drive-recover | nein |
| triathlon | Triathlon | endurance | ja | brand | sequence / three-phase | nein |
| athletics | Leichtathletik | endurance | ja | brand | track / lane-curve | nein |
| volleyball | Volleyball | team | nein → other | brand | space / net-exchange | nein |
| hockey | Hockey | team | nein → other | brand | space / glide-lanes | nein |
| rugby | Rugby | team | nein → other | brand | space / phase-lines | nein |
| badminton | Badminton | racket | nein → other | brand | rally / high-arc | nein |
| golf | Golf | other | nein → other | brand | arc / single-trajectory | nein |
| hiking | Wandern | outdoor | ja | running (geteilt) | topography / contour-lines | nein |
| walking | Gehen | outdoor | ja | running (geteilt) | stride / even-steps | nein |
| climbing | Klettern | outdoor | nein → other | brand | ascent / hold-points | nein |
| yoga | Yoga | mindbody | nein → other | brand | breath / slow-expand | nein |
| mobility | Mobility | mindbody | ja | brand | range / joint-arcs | nein |
| hyrox | HYROX | hybrid | nein → other | brand | hybrid / run-station-blocks | nein |
| other | Andere | other | ja | brand | pulse / neutral-rhythm (bewusster Rückfall) | — |

Aliase: `SPORT_ALIASES` in `js/training-domain.js:87` (48 Schlüssel, deutsch/englisch). Unbekannt → `other`. Garmin-Typen werden **nicht** im Client, sondern im Worker abgebildet (`garmin-worker/orvia_worker/normalize.py:63`): running/trail/treadmill → running · cycling/road/gravel/mtb/virtual/indoor → cycling · lap/open-water → swimming · strength_training/indoor_cardio → gym · soccer → football · rowing/indoor_rowing → rowing · multi_sport → triathlon · sonst `other` (nur dann bleibt der Garmin-Typ als `metrics.source_sport_raw` erhalten).

**Folge:** Bahn oder Freiwasser, Laufband oder Trail, Rolle oder Straße sind nach dem Import nicht mehr unterscheidbar.

Weitere Abweichungen: vier verschiedene Namen für `gym` („Krafttraining", „Kraft", „Gym", „Gym/Krafttraining"); sechs Katalog-Symbole fallen in Liste und Trainings-Hub auf ein Ersatzsymbol zurück; Sportnamen stehen fest im Code, nicht in der Sprachdatei.

### Signaturen — UMGESETZT (Zuordnung) / VORSCHLAG (Zeichner)

`js/sport-signatures.js` ist die eine Stelle. Jede der 24 Sportarten hat einen Eintrag; `other` ist der einzige bewusste Rückfall und begründet ihn. Gezeichnet ist nur Schwimmen. `supabase/tests/sport_signatures_test.mjs` schlägt an, sobald Katalog und Signaturen auseinanderlaufen. Drei Zustände sind benannt (static / ambient / reactive); „reactive" ist nirgends freigegeben, weil kein passender Messwert verlässlich vorliegt (siehe Abschnitt 3).

---

## 2. P0 — Dauer-Korrektur (UMGESETZT, v8-445)

**Ursache**, auf v8-444 nachgestellt (Seite 75 min · Liste 341 min · nach Abgleich 341 min):

1. Der Server rechnet die Dauer eines Workouts beim Speichern aus den Zeitstempeln neu (`orvia_upsert_activity_from_session`, Migration 0009) — die Spalte `duration_seconds` trägt wieder 341 min.
2. Die Korrektur stand in `metrics.durationCorrection`, aber kein Leser wendete sie an.
3. Serverzeilen haben in der Liste Vorrang vor dem lokalen Stand (`mergeAllActivities`), und der Abgleich überschrieb den lokalen Wert mit der Spalte (`mergeServerActivities`).

**Lösung: Quelle / manuell / wirksam** (`js/activity-effective.js`)

- Speicherform: `activities.metrics.corrections[<kennzahl>] = { manual, source, unit, at, method }`. Keine Migration (jsonb-Feld).
- Das Feld am Client-Objekt (`durationSeconds`) trägt immer den **wirksamen** Wert — deshalb rechnen alle 16 Dateien, die es lesen, ohne eigene Regel richtig.
- Die Serverspalte bleibt der **Quellwert**. Zurücknehmen ist ein eigener Satz (`manual: null`).
- Hergestellt wird der Vertrag an drei Stellen: beide Serverwege (`normalizeActivityRecord`, `normalizeServerActivity`) und der lokale Speicher (Lesen, Mischen, Korrigieren). Zwei Stände derselben Einheit: je Kennzahl gilt der jüngere Satz.
- Altbestand heilt beim Lesen: wer vor v8-445 korrigiert hat, sieht den korrigierten Wert ohne erneute Eingabe.
- Registriert sind `duration` (freigegeben für abgeschlossene ORVIA-Workouts) und `distance` (aufgelöst und getestet, Eingabe **nicht** freigegeben).

Bewusst unverändert: `workout_sessions.duration_min` wird wie seit 05.08. mitkorrigiert (abgeleiteter Wert; die Messung bleibt in `started_at` / `finished_at`). Das versionierte Belastungsmodell (`load-history@4`) bleibt unangetastet — es erkennt die Korrektur an der mitgeführten Altform.

Tests: `effective_metric_test` (66), `effective_metric_e2e_test` (36, echte App im Browser inkl. nachgestellter Bildschirmtastatur und Neuladen).

---

## 3. Garmin — was ankommt, was gespeichert wird, was verloren geht

Der Worker ruft für Aktivitäten **zwei** Endpunkte: die Liste (`get_activities_by_date`) und die Details (`get_activity_details`, höchstens 10 je Lauf). Nicht abgerufen: Runden/Splits, Zeit in HF-Zonen, Zeit in Leistungszonen, Übungssätze, Wetter, FIT-Datei.

Aus der Liste werden **genau zehn Felder** gelesen: `distance`, `calories`, `averageHR`, `maxHR`, `elevationGain`, `averageSpeed`, `activityName`, `avgPower`, `maxPower`, `normPower` — dazu `activityTrainingLoad`, `duration`, Startzeit, Typ. **Alles andere wird verworfen; die Rohantwort wird nirgends gespeichert.** Bestehende Zeilen werden nie aus der Liste aktualisiert — eine spätere Erweiterung füllt alte Einheiten nicht nach.

Spalten: Roh = in der Garmin-Antwort · Imp = vom Worker gelesen · Gesp = gespeichert · Anz = in der App sichtbar. „?" = im Repo nicht belegbar (kein mitgeschnittener echter Listeneintrag vorhanden).

| Kennzahl | Roh | Imp | Gesp | Anz | Anmerkung |
|---|---|---|---|---|---|
| Distanz, Dauer, Ø/Max HF, Kalorien, Höhenmeter, Ø Tempo | ja | ja | ja | ja | Max HF und Kalorien fehlen im Lauf-Raster der Seite |
| Bewegungszeit, verstrichene Zeit | ja (Details) | nein | nein | nein | im echten Details-Mitschnitt vorhanden (5509 s / 6766 s), verworfen |
| Max. Geschwindigkeit | ? | nein | nein | nur aus Messreihe | |
| Ø/Max Leistung, Normalized Power | Annahme | ja | ja | Rad + Highlights | Feldnamen am echten Abruf nicht bestätigt |
| Leistungs-Messreihe | Annahme | ja | ja | ja | dito |
| Schrittfrequenz (Lauf) | ja | ja | ja | ja | **halber Wert**: gelesen wird `directRunCadence` (≈80), richtig wäre `directDoubleCadence` (≈161) |
| Trittfrequenz (Rad) | Annahme | ja | ja | nur Diagramm | Feldname ist eine Annahme |
| HF-, Tempo-, Höhen-, Distanz-Messreihe | ja | ja | ja (max. 300 Punkte) | ja | **ohne Zeitachse** — Zeitstempel stehen in der Antwort und werden verworfen |
| GPS-Strecke | ja | ja | ja (max. 600 Punkte) | ja | ohne Zeit/Höhe je Punkt |
| Runden / Splits | eigener Endpunkt | nein | faktisch nie | nur wenn vorhanden | Client-Kommentare nehmen an, der Worker liefere sie |
| Trainingsbelastung der Einheit | ja | ja | ja | nur Seite | |
| Training Effect aerob/anaerob | ? | nein | nein | nein | |
| Zeit in HF-/Leistungszonen | eigener Endpunkt | nein | nein | nein | ohne Zeitachse auch nicht sauber ableitbar |
| FTP | eigener Endpunkt | ja | `user_metrics` | Metrik-Bibliothek | Antwortform unbestätigt; Datum = Abruftag, nicht Testtag; die Zonen rechnen mit dem **manuellen** FTP |
| Schwimmen: Bahnlänge, Bahnen, Züge, Zugart, SWOLF | ? | nein | nein | nein | kein Schwimm-Mitschnitt im Repo |
| Bahn / Freiwasser | ja (Typ) | gelesen | **nein** | nein | zu `swimming` zusammengelegt |
| Laufdynamik (Schrittlänge, Bodenkontakt, vertikale Bewegung) | ? | nein | nein | nein | |
| Kraft: Garmin-Übungssätze | eigener Endpunkt | nein | nein (Schema vorbereitet, Migration 0035) | nein | |
| Temperatur, Gerät, Ort | ? | nein | nein | nein | |

**Was das heißt:** Für Power-Kurve, Zeit in Zonen, echte Splits, Bewegungszeit und sekundengenaue Bestleistungen fehlt eine einzige Sache — die Zeitachse der Messreihen. Für Schwimm-Technik, Training Effect und Laufdynamik fehlen die Felder ganz. Welche davon Garmin für Gians Geräte liefert, lässt sich aus dem Repo **nicht** sagen: dafür braucht es je Sportart einen mitgeschnittenen, anonymisierten Listeneintrag (Lauf, Rad, Bahnschwimmen, Kraft). Ohne diesen Mitschnitt wäre jede Erweiterung geraten.

---

## 4. Bestand für Rekorde, Meilensteine, Ziele, Story

| Baustein | Stelle | gespeichert? | Lücke |
|---|---|---|---|
| Distanz-Bestzeiten Lauf/Rad/Schwimmen | `js/run-bests.js` | nein, jedes Mal neu berechnet | — |
| aktuelle Bestzeiten im Profil | `js/engine/pb-sync.js` → `PROFILE.performance.personalBests` | ja | **keine Historie**: die abgelöste Bestzeit wird gelöscht — „+14 s gegenüber vorher" ist nicht sagbar |
| Meilensteine / Medaillen (9 Leitern) | `js/achievements.js` | nein | auf die neuesten 400 Einheiten begrenzt (Stufe „500 Einheiten" unerreichbar); kein „neu erreicht" |
| Kraft: e1RM, 6 Arten Bestleistung | `js/engine/strength-profile.js` | nein | keine Erkennung beim Abschluss eines Workouts |
| Ziele mit Historie | `profile-model.js`, Tabelle `user_goals` | ja | „erreicht" wird nur für Lauf-Wettkämpfe erkannt (`engine/race-result.js`), als Vorschlag mit Bestätigung |
| FTP | vier unverbundene Stellen | teils | keine Historie im Client, keine Power-Bestwerte |
| Story | `ui.js` `gmStoryPages` (~260 Zeilen, feste Reihenfolge) | nur „gesehen"-Liste | kein Begriff von Highlight, Bewertung, Vergleich |

Speicherung: Tagesblock + Profil als ein Schnappschuss (`app_state`), Aktivitäten je Nutzer in `localStorage` (≈4 MB bei 160 Einheiten) + Tabelle `activities`, Schreib-Warteschlange in IndexedDB. Kein Seitenweises Laden: Server liefert die neuesten 200.

### Highlights-Engine — VORBEREITET (`js/engine/highlights.js`)

Reines Modul, von der App nicht geladen. Legt fest: 21 Arten mit Stufen, Kandidat (ohne Beleg abgelehnt, Vergleich nur mit Vergleichsgruppe), Bewertung, Zusammenführen über `group`, Auswahl und Reihenfolge je Erzählform (normal ≤ 6, interessant ≤ 8, Bestleistung ≤ 12, Ziel mit eigener Folge), 20 Darstellungsfamilien mit Pflichtfeldern, Ereignis für die Leistungsbasis. Ein Erzeuger ist dabei (Zusammenfassung aus wirksamen Werten). Tests: `highlights_engine_test` (47).

---

## 5. Was eine Migration bräuchte

| Vorhaben | Migration | Worker |
|---|---|---|
| Korrekturmodell (dieser Schritt) | nein | nein |
| Korrektur an **Garmin**-Einheiten freigeben (z. B. Schwimmdistanz) | nein | eine Zeile: `corrections` in `CLIENT_OWNED_METRIC_KEYS` |
| Zeitachse, Bewegungszeit, richtige Schrittfrequenz | nein (jsonb) | ja + einmaliges Nachladen alter Einheiten |
| Garmin-Typ erhalten (Bahn/Freiwasser, Rolle/Straße) | nein (jsonb) oder eine Spalte | ja |
| Runden, Zonen, Training Effect, Schwimm-Technik | nein (jsonb) | ja, neue Endpunkte |
| Leistungsbasis (Rekord-Historie, Ereignisse, „neu erreicht") | **ja**, eigene Tabelle(n) | nein |
| FTP-Verlauf | nein, `user_metrics` reicht | Antwortform prüfen |

---

## 6. Reihenfolge

| Phase | Inhalt | Stand |
|---|---|---|
| A | Bestand | erledigt (dieses Dokument) |
| B | Quelle / manuell / wirksam, Dauer-Fehler, Dialog | **umgesetzt** (v8-445) |
| E-Grundlage | Signatur-Zuordnung für alle 24 + Abdeckungstest | **umgesetzt** (v8-446) |
| F-Grundlage | Highlights-Gerüst, Benennung „Highlights" | **vorbereitet** (v8-446) |
| C | Garmin-Erweiterung | wartet auf vier Mitschnitte und einen Auftrag für den Worker |
| D | Leistungsbasis | wartet auf Entscheidung zur Tabelle |
| E | Zeichner für die Signaturen | offen |
| F–H | Regeln je Sportart, Vorlagen, Würdigung | brauchen C und D |

Empfehlung: **C vor D.** Die Leistungsbasis friert ein, was die Daten hergeben; mit halber Schrittfrequenz und ohne Zeitachse würde sie Rekorde festschreiben, die sich nach der Korrektur ändern.
