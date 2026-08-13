# Gerätetest G1–G3 · Protokoll zum Ausfüllen

**Stand:** 2026-08-12 · App `orvia-v8-328` · Exporter `garmin-workout-export@1`
· Mapping `garmin-exercise-map@1` · Katalog `fit-sdk@21.213.0` (**eine** Quelle)

Dieses Blatt wird beim Test ausgefüllt und danach aufbewahrt. Es ist die
Grundlage für die Entscheidung, ob der produktive Pfad geöffnet wird.

---

## 0 · Was dieser Test entscheidet

Drei Zahlen sind heute nicht belegt und blockieren die Freigabe:

| Unbekannte | Kandidat im Test | Gate |
|---|---|---|
| numerische Sport-ID für Krafttraining | `10` (aus FIT `sport #10 training`) | G1 |
| numerische ID der Abbruchbedingung `reps` | `10` | G1 |
| Skalierung beim **Schreiben** von Gewichten | kg × 1000 (Gramm) | G3 |

Dazu kommt die Frage, ob der Rückweg überhaupt trägt (G2).

---

## 1 · Vorbereitung

| Schritt | erledigt | Notiz |
|---|:--:|---|
| `STRENGTH_PUSH_DEVICE_TEST=true` in Railway gesetzt | ☐ | |
| Worker deployt, `GET /healthz` → `{"ok":true}` | ☐ | |
| Garmin-Verbindung aktiv (`GET /status` → `connected`) | ☐ | |

### Weg A — in der App (empfohlen, funktioniert auf dem Handy)

ORVIA mit **`?gate=1`** in der Adresse öffnen, z. B.
`https://…/index.html?gate=1`. Dann: **Profil → Geräte & Datenquellen** ganz
nach unten scrollen. Dort steht der Abschnitt „Gerätetest G1–G3".

1. **Payload prüfen** — rechnet, zeigt die Kontrollwerte, geht nicht ins Netz.
2. Werte vergleichen (siehe unten). Bei Abweichung: stopp.
3. **An Garmin senden** — nutzt deine laufende Anmeldung, nichts zu kopieren.
4. Die angezeigte `workoutId` notieren.

Der Abschnitt ist **kein Produktweg**: ohne `?gate=1` existiert er nicht, und
er wird nirgends gespeichert. Beim nächsten normalen Öffnen ist er weg.

### Weg B — am Rechner

```bash
node tools/device-test-push.mjs                      # nur ansehen
node tools/device-test-push.mjs --send \
    --worker https://<dein-worker> --jwt <access-token>
```

Beide Wege bauen mit **denselben echten Modulen** und erzeugen dieselben
Werte — das ist im Test festgeschrieben, damit sie nicht auseinanderlaufen
können.

### Nach dem Push zu notieren

| Feld | Wert |
|---|---|
| `clientRef` | `swe:po:2026-08-12:ps:devicetest:v1` |
| `occurrenceId` | `po:2026-08-12:ps:devicetest` |
| `payloadHash` | `strength-plan@1:2cf88fd5` |
| `payloadVersion` | `garmin-workout-export@1` |
| `mappingVersion` | `garmin-exercise-map@1` |
| **Garmin `workoutId`** | ________________ |
| HTTP-Status der Antwort | ________________ |

*(Die ersten fünf Werte sind vorausberechnet — wenn das Werkzeug andere
ausgibt, hat sich etwas geändert und der Test misst nicht mehr denselben
Stand.)*

---

## 2 · G1 — Wird das Workout korrekt geführt?

Das Testworkout hat genau diese Struktur:

```
Schritt 1   Wiederholungsgruppe   barbell_bench_press      2 Durchgänge
Schritt 2     Satz                8 Wiederholungen         20 kg
Schritt 3     Pause               60 s
Schritt 4   Wiederholungsgruppe   romanian_deadlift        2 Durchgänge
Schritt 5     Satz                6 Wiederholungen         30 kg
Schritt 6     Pause               90 s
```

| Prüfpunkt | ja | nein | Beobachtung |
|---|:--:|:--:|---|
| Workout in Garmin Connect sichtbar | ☐ | ☐ | |
| Nach Sync auf der Uhr auswählbar | ☐ | ☐ | |
| Reihenfolge: erst Bankdrücken, dann RDL | ☐ | ☐ | |
| Je zwei Sätze | ☐ | ☐ | |
| Wiederholungsziele 8 und 6 | ☐ | ☐ | |
| Pausen 60 s und 90 s | ☐ | ☐ | |
| Workout vollständig start- und beendbar | ☐ | ☐ | |

**Gerät und Fassungen** (gehört ins Protokoll, weil das Ergebnis nur für
diese Kombination gilt):

| Feld | Wert |
|---|---|
| Uhrenmodell | ________________ |
| Firmware | ________________ |
| Garmin-Connect-App-Version | ________________ |

**Wenn G1 scheitert:** notieren, ob das Workout gar nicht erscheint (dann ist
vermutlich die Sport-ID falsch) oder erscheint, aber nicht führt (dann eher
die `reps`-Bedingung). Diese Unterscheidung ist die eigentliche Ausbeute des
Tests — bitte nicht nur „hat nicht funktioniert".

---

## 3 · G2 — Trägt der Rückbezug?

Nach dem Training synchronisieren, dann **lokal** (nicht im Worker):

```bash
# Aktivitäts-ID finden:
python3 scripts/capture_workout_sets.py --token-file ~/garmin-token.txt --list

# Bereinigt erfassen:
python3 scripts/capture_workout_sets.py \
    --token-file ~/garmin-token.txt \
    --activity-id <ID> --out geraetetest-g2.json
```

Das Skript arbeitet mit einer **Erlaubnisliste**: es kopiert nur die von dir
benannten Felder heraus, statt Unerwünschtes zu entfernen. Eine Verbotsliste
vergisst irgendwann ein Feld — eine Erlaubnisliste kann das nicht. Tokens,
E-Mail-Adressen, Namen, GPS-Spuren und vollständige Rohantworten verlassen das
Skript nicht.

| Prüfpunkt | Antwort |
|---|---|
| Garmin `activityId` | ________________ |
| Nennt die Aktivität die gepushte `workoutId`? | ☐ ja ☐ nein — Fundort: ______ |
| Ist `wktStepIndex` gesetzt? | ☐ ja ☐ nein |
| Welche Werte hat er? | ________________ |
| Lassen sie sich den `stepBindings` (1–6) zuordnen? | ☐ eindeutig ☐ teilweise ☐ nein |
| `category`/`name` für Bankdrücken | ________________ |
| `category`/`name` für RDL | ________________ |
| `probability`-Werte | ________________ |

**Besonders wichtig:** Kommen die Übungen als
`BENCH_PRESS/BARBELL_BENCH_PRESS` und `DEADLIFT/ROMANIAN_DEADLIFT` zurück —
also genau als das, was wir gesendet haben? Oder meldet die Uhr eigene
Erkennungswerte? Davon hängt ab, ob der Rückweg über das Mapping überhaupt
funktionieren kann.

**Wenn G2 scheitert:** kein automatischer Planabschluss. Der Rückimport bliebe
dann auf `unresolved` mit Handbestätigung — richtig, aber Handarbeit.

---

## 4 · G3 — Was bedeutet die Zahl?

**Zwei** Gewichte, weil eine einzelne Zahl sich auf zu viele Arten erklären
lässt. Erst wenn beide dieselbe Beziehung zeigen, ist die Skalierung belegt.

| | Bankdrücken | Rumänisches Kreuzheben |
|---|---|---|
| geplant in ORVIA | 20 kg | 30 kg |
| **gesendeter Rohwert** | `20000` | `30000` |
| Anzeige in Garmin Connect | ____________ | ____________ |
| Anzeige auf der Uhr | ____________ | ____________ |
| zurückgelieferter Rohwert (`weight`) | ____________ | ____________ |
| tatsächlich trainiertes Gewicht | ____________ | ____________ |

**Auswertung** (bitte ausfüllen, nicht überspringen):

- Beziehung Bankdrücken: gesendet 20000 → angezeigt ______ ⇒ Faktor ______
- Beziehung RDL: gesendet 30000 → angezeigt ______ ⇒ Faktor ______
- **Beide Faktoren gleich?** ☐ ja ☐ nein

Nur bei „ja" gilt G3 als belegt. Bei „nein" bleibt der Gewichtsexport
gesperrt — auch dann, wenn eines der beiden Gewichte richtig aussah.

---

## 5 · Abnahme

| Gate | Kriterium | Ergebnis |
|---|---|---|
| G1 | Workout wird korrekt geführt und abgeschlossen | ☐ erfüllt ☐ nicht erfüllt |
| G2 | Activity und Sätze eindeutig der Occurrence und den Schritten zuordenbar | ☐ erfüllt ☐ nicht erfüllt |
| G3 | Schreib- und Leserichtung mit **zwei** Werten eindeutig belegt | ☐ erfüllt ☐ nicht erfüllt |

## 6 · Nach dem Test

| Schritt | erledigt |
|---|:--:|
| `STRENGTH_PUSH_DEVICE_TEST=false` gesetzt | ☐ |
| Dieses Blatt und `geraetetest-g2.json` gesichert | ☐ |
| Produktiver Pfad weiterhin geschlossen | ☐ |

**Bei negativem G2:** kein automatischer Planabschluss bauen.
**Bei negativem G3:** weiterhin keine Gewichte exportieren.

Erst wenn ein Gate *erfüllt* ist, wird die zugehörige Zahl im Code von
„Kandidat" auf „belegt" umgestellt — an genau einer Stelle je Wert
(`garmin-workout-export.js`: `CONST.sportStrength`, `CONST.condReps`,
`WEIGHT_SCALE_ASSUMPTION`). Vorher nicht.
