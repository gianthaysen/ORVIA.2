# Leistungs-Bestwerte: Entscheidung und Regeln

**Status: IMPLEMENTED (Berechnung) · OPEN (Auflösung in Produktion)** · v8-447.1 · Code: `garmin-worker/orvia_worker/best_efforts.py`

## 1 · Das Problem

Die App speichert je Messreihe höchstens 300 Punkte. Im einzigen echten Mitschnitt: 5527 Zeilen aufgezeichnet,
1855 von Garmin geliefert, 266 gespeichert — zwischen zwei gespeicherten Punkten liegen im Mittel rund 20 Sekunden.
Daraus lässt sich kein 5-Sekunden-Bestwert bilden, und ein 5-Minuten-Bestwert nur grob.

## 2 · Entscheidung

| | Option A: volle Reihe speichern | **Option B: Bestwerte im Worker, vor der Ausdünnung** |
|---|---|---|
| Speicher je Aktivität | rund +25 000 Zeichen je Reihe bei 5500 Zeilen (heute: rund 16 000 für die ganze Aktivität); der lokale Speicher der App läuft voll | rund 700 Zeichen |
| Exaktheit | exakt, wenn Garmin alle Zeilen liefert | exakt, wenn Garmin alle Zeilen liefert |
| Spätere neue Fenster | ohne neuen Abruf möglich | neuer Abruf der betroffenen Aktivitäten nötig |
| Risiko | stiller Schreibfehler im Gerät bei vollem Speicher (Datenverlust) | keines für den Bestand |
| Diagramme | brauchen die volle Reihe nicht | unverändert (ausgedünnte Reihe) |

**Gewählt: Option B.** Der einzige echte Vorteil von A — neue Fenster ohne neuen Abruf — wiegt das Speicherrisiko
nicht auf: die Detailantwort lässt sich jederzeit erneut laden (gezielt nur für Aktivitäten mit Leistungsreihe).
Die zwölf Fenster decken die übliche Leistungskurve ab.

Daraus folgt ein allgemeiner Grundsatz: **Auswertung aus allen gelieferten Zeilen, Anzeige aus der ausgedünnten
Reihe. Kein Rekord aus einer Anzeige-Reihe.** Er gilt genauso für Strecken-Bestzeiten und für Mittel/Maximum
einer Reihe (`best_efforts.distance`, `best_efforts.stats`).

## 3 · Regeln

Fenster: 1 s · 5 s · 10 s · 15 s · 30 s · 60 s · 2 min · 5 min · 10 min · 20 min · 30 min · 60 min.

1. **Zeitachse.** Fenster `[t, t + D]` auf der verstrichenen Zeit (Zeitstempel der Messzeile). Nie „N Messpunkte".
2. **Signal.** Eine Messzeile steht für das Stück Zeit, das an ihrem Zeitpunkt *endet*. Liegt die vorige Zeile
   höchstens zwei übliche Abstände zurück, reicht das Stück bis dorthin; sonst steht sie für einen üblichen Abstand.
3. **Pause.** Zeit ohne Messzeilen gehört in das Fenster und zählt 0 W. Ein 20-Minuten-Fenster mit 2 Minuten Pause
   ist ein 20-Minuten-Fenster; Bewegungsabschnitte werden nicht zusammengeklebt.
4. **0 W** ist ein Messwert (Rollen).
5. **Fehlender Wert** (Zeile ohne Leistung, negative Leistung): zählt 0 W. Nicht interpoliert, nicht übersprungen.
   Das Ergebnis kann dadurch nur zu niedrig werden. Die betroffene Zeit steht am Fenster (`miss_s`); ein Fenster
   mit `miss_s > 0` ist für das Register nicht zulässig.
6. **Güte je Fenster.**
   - `exact` — Garmin lieferte alle aufgezeichneten Zeilen (`rows ≥ total`) **und** die Uhr zeichnete sekündlich auf.
   - `approx` — sonst, wenn mindestens 8 übliche Abstände in das Fenster passen. Für die Anzeige, **kein Rekord**.
   - `insufficient` — Fenster kürzer als die Auflösung trägt. **Es wird keine Zahl gespeichert.**
   - `too_short` — Aufzeichnung kürzer als das Fenster.
7. **Nichts wird festgeschrieben.** Der Worker legt die Werte an die Aktivität (`metrics.best_efforts`). Ob daraus
   ein Rekord wird, entscheidet das Leistungsregister über `metricEligibility.evaluate(a, 'powerBest', { windowS })`.

Geprüft mit synthetischen Reihen bekannter Lösung (regelmäßig, unregelmäßig, Pause, fehlende Werte, 0 W) und gegen
eine unabhängige Brute-Force-Rechnung auf Zufallsreihen (`tests/test_v4471_validation.py`).

## 4 · Was offen ist — und nur in Produktion zu klären

**Liefert Garmin alle Zeilen, wenn man danach fragt?** Die Detailabfrage hat den Parameter `maxChartSize`
(Standard 2000). Mit dem Standard kamen im Mitschnitt 1855 von 5527 Zeilen, üblicher Abstand 3 s: damit sind
Fenster unter 24 s `insufficient` und alle längeren `approx` — **kein einziger Leistungs-Bestwert wäre registerfähig**.

Zwei Wege, das zu klären, beide ohne zusätzliche Abrufe im Dauerbetrieb:

1. `capture_activity_payloads.py --probe-resolution` — ein Abruf mit `maxchart=20000` je mitgeschnittener
   Aktivität; behalten werden nur Zeilenzahl, Gesamtzahl, üblicher Abstand.
2. Worker-Einstellung `DETAIL_MAXCHART=20000` — gleicher Abruf, größere Antwort. Der Zensus zeigt danach je
   Sportart `abtastung: vollstaendig / ausgeduennt` und `bestwert: power:… = exact / approx`.

| Ergebnis | Folge |
|---|---|
| Garmin liefert alle Zeilen | `DETAIL_MAXCHART` dauerhaft setzen; Leistungs-Bestwerte werden `exact`. Bereits nachgeladene Aktivitäten mit Leistungsreihe einmal neu laden. |
| Garmin deckelt weiter | Leistungs-Bestwerte bleiben `approx` und damit außerhalb des Registers. Einziger exakter Weg wäre die Originaldatei der Aktivität (FIT) — ein eigener, größerer Schritt. |

Bis das geklärt ist, gilt: **Leistungs-Bestwerte sind nicht registerfähig.** Das ist kein Fehler der Rechnung,
sondern die ehrliche Auskunft über die Daten.

Zweite offene Frage: der Name der Leistungsreihe (`directPower`) ist eine Annahme — es gibt keinen Rad-Mitschnitt.
