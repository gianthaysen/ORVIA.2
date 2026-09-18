# S2 · Kraftprofil an echten Daten geprüft (Befund)

Stand 16.09.2026 · Datenbasis: 13 abgeschlossene Gym-Einheiten, 20.06.–23.08.2026, 139 Sätze, 22 Übungen.
Methode: `strength-profile.js` (v8-388) in node gegen den echten Satz-Export gefahren, Katalog aus Migration 0047; Ergebnisse gegen Epley-Nachrechnung und Trainingswissenschaft geprüft. Kein Screenshot-Ablesen.

## Kernergebnis

Das Kraftprofil rechnet technisch korrekt — Epley, RIR, Satzzählung, Gruppen, Korridore stimmen gegen die Nachrechnung. Die **Aussagen**, die es daraus ableitet, halten in drei Fällen nicht: die e1RM-Kurve unterstellt maximale Ausbelastung, die in 93 % der Sätze nicht belegt ist; die Δ-Angabe misst den Abstand zum ersten Punkt eines rollierenden Fensters statt einen Trend; und die Stagnationserkennung greift bei realer Streuung nie. Zusammen erzeugen sie ein zu positives Bild: die App meldet Fortschritt, wo die Daten ein Plateau zeigen.

Fachlich wichtigster Befund unabhängig von der Software: in 9 Wochen keine einzige Beinübung mit Sätzen.

## B1 · e1RM ohne Ausbelastungsangabe (schwer)

139 Sätze, davon 10 mit RIR (7,2 %). Epley setzt voraus, dass der Satz nahe am Muskelversagen endet. Ohne RIR misst die Kurve die **Anstrengungswahl**, nicht die Kraft.

Beleg Face Pulls: 03.08. 18,75 kg × 12/13 → e1RM 26,3 kg. 12.08. 28,75 kg × 12 → e1RM 40,3 kg. Die App zeigt „+14,0 kg in 3 Wochen" — +53 % in neun Tagen. Physiologisch unmöglich; die Sätze am 03.08. waren schlicht submaximal, das sagt aber kein Feld.

Wirkung: jede Kurve, jedes Δ, jede Prognose und jede Stagnationsaussage erbt diese Unsicherheit, ohne sie zu benennen.

Empfehlung: e1RM-Punkte ohne RIR/RPE als solche kennzeichnen (Punkt hohl, Quellzeile „Ausbelastung nicht erfasst"); Δ und Prognose nur aus Punkten mit Ausbelastungsangabe rechnen oder mit ausgewiesener Spanne; im Workout-UI RIR für den letzten Satz je Übung einfordern (ein Tipp, nicht Pflicht).

## B2 · Δ ist kein Trend, sondern Fensterrand (schwer)

`exerciseModel` bildet Δ als `aktuell − erster Punkt im 12-Wochen-Fenster`.

Beleg Brustpresse Maschine: Punkte 23.06. 106,7 → 20.07. 101,3 → 31.07. 101,3 → 06.08. 104 → 12.08. 104 → 16.08. 109,3 → 23.08. 106,7. Lineare Regression: **+0,75 kg e1RM je 4 Wochen, +1,6 kg über 9 Wochen** — Rauschen. Die App zeigt „+5,4 kg in 5 Wochen", weil der 20.07. (der niedrigste Punkt) zufällig der erste im Fenster ist. Wandert das Fenster, springt die Aussage.

Empfehlung: Δ aus der Regressionssteigung (dieselbe Mechanik wie `goalForecast`) mit Angabe „je 4 Wochen"; die Rohdifferenz höchstens als Nebenwert mit Datum.

## B3 · Stagnation wird nie erkannt (mittel)

`isStagnant` verlangt Gewicht **und** Wiederholungen des ersten Satzes über drei Einheiten unverändert. Reale Sätze streuen. Ergebnis im Test: `stagnant=false` für alle sechs Übungen mit Kurve — obwohl die Brustpresse seit 23.06. auf exakt 80 kg steht und das e1RM über 9 Wochen flach ist.

Empfehlung: Stagnation an der Regressionssteigung festmachen (< 1 % je 4 Wochen über ≥ 4 Einheiten und ≥ 4 Wochen), nicht an Gleichheit.

## B4 · Klimmzüge: unvergleichbare Punkte in einer Reihe (mittel)

Serie 12 → 14 → 13 → 7 → 9 Wdh. Die ersten drei Punkte sind Körpergewicht ohne Zusatzlast, die letzten zwei mit 10 kg. Die App meldet „−5 Wdh. in 3 Wochen" — tatsächlich hat die Belastung um 10 kg zugenommen. Zusätzlich ist der Satz vom 31.07. (`14x-`, Gewicht 14, Wdh. leer) eine Fehleingabe: er zählt in die Einheitenzahl (n=6), liefert aber keinen Punkt (5 Punkte in der Kurve).

Empfehlung: Bei Körpergewichtsübungen auf Systemlast umstellen (Körpergewicht + Zusatz) sobald Zusatzlast auftritt, und Punkte ohne Zusatzlast getrennt kennzeichnen; Sätze ohne Wiederholungen nicht als Arbeitssatz zählen.

## B5 · „1RM-Test 7,5 kg" bei Seitheben (mittel)

Am 27.06. ist ein Satz 7,5 kg × 8 als `set_type = 'test'` erfasst. `exerciseModel` nimmt das schwerste Test-Gewicht als PR „1RM-Test" und markiert den Punkt in der Kurve als Test — obwohl 7,5 kg die **leichteste** je geloggte Last dieser Übung ist (Arbeitssätze 12,5 kg).

Empfehlung: Ein Test-Satz gilt nur als 1RM-Test, wenn sein Gewicht über dem besten Arbeitssatz liegt; sonst ist er ein normaler Satz.

## B6 · Rückenstrecker wird als Beinübung gezählt (mittel)

`groupOf` summiert Koeffizienten je Gruppe. `back_extension` trägt `lower_back` (core) gegen `glutes` + `hamstrings` (legs) — legs gewinnt. Folge: die Übung steht unter „Beine", und die Balance-Zeile „Beine : Oberkörper = 0,02 (2 : 84 Sätze)" stützt sich ausschließlich auf zwei Rückenstrecker-Sätze. Die Richtung der Warnung ist richtig, ihre Zahl ist es nicht: echte Beinsätze = 0.

Empfehlung: Bei Gleichstand die Gruppe des **direkten** Muskels bevorzugen; `back_extension` gehört zu core (Hüftstreckung ist hier Nebenarbeit).

## B7 · Doppelte und leere Übungszeilen (mittel, Datenintegrität) — KORRIGIERT 18.09.

Einheit 20.06. hat fünf `workout_exercises`-Zeilen, davon **drei mit `order_index = 0`** (Brustpresse Kabel, Adduktorenmaschine, Ab Wheel) und vier ganz ohne Sätze.

**Meine erste Erklärung war falsch.** Ich hatte geschrieben, der Unique-Index `workout_exercises_uniq (workout_session_id, order_index)` aus Migration 0003 sei in der Produktionsdatenbank nicht wirksam. Tatsächlich wurde er in **Migration 0004 bewusst entfernt**, mit dokumentierter Begründung: beim Umsortieren erzeugte er falsche Upserts. An seine Stelle trat `workout_exercises_client_uniq (user_id, client_exercise_id)`.

Die echte Ursache liegt darin, dass dieser Ersatz **partiell** ist (`where client_exercise_id is not null`). `workoutRepository.addExercise` schrieb `client_exercise_id: ex.clientExerciseId || null` und setzte das Konfliktziel nur, wenn eine ID vorlag — ohne ID lief der Aufruf als reines INSERT, auf das kein Index greift. Jeder Doppelklick, Retry oder Offline-Nachlauf legte dann eine weitere Zeile an. `addSet` hatte dieselbe Lücke, dort mit direkter Wirkung auf Volumen, Tonnage und Sätze je Muskel.

`workout-store` vergibt die Client-ID heute immer (`cid('we')`, `cid('set')`); die Zeilen vom 20.06. stammen aus einem älteren Build. Behoben in v8-391: beide Repository-Funktionen weisen einen Aufruf ohne Client-ID jetzt ab (`client_exercise_id_required` / `client_set_id_required`), statt eine Zeile anzulegen, die sich nie wieder deduplizieren lässt. Test in `workout_repo_norow_phase42_test`.

Offen bleibt der Altbestand: die vier satzlosen Zeilen vom 20.06. stören keine Auswertung (ohne Sätze zählt nichts), sind aber Datenmüll. Prüf-SQL:

```sql
select s.local_date, we.order_index, we.client_exercise_id, count(st.id) as saetze
from public.workout_exercises we
join public.workout_sessions s on s.id = we.workout_session_id
left join public.workout_sets st on st.workout_exercise_id = we.id
where s.user_id = auth.uid()
group by s.local_date, we.id, we.order_index, we.client_exercise_id
having count(st.id) = 0
order by s.local_date;
```

## B8 · Trainingsbefund (unabhängig von der Software)

- **Beine: null Sätze in 9 Wochen.** Für Halbmarathon unter 1:50 und ein Ironman-Ziel ist das die größte Lücke. Kniebeuge/rumänisches Kreuzheben/Wadenheben haben belastbare Evidenz für Laufökonomie und Verletzungsresistenz; bei bekannter Knievorgeschichte ist Beinkraft zusätzlich Schutz, nicht Kür.
- **Frequenz 1,4×/Woche**, Lücke 27.06.–20.07. (23 Tage), seit **23.08. keine Krafteinheit** (24 Tage). Das Profil beschreibt einen Zustand, der fast einen Monat alt ist.
- **Volumen** 56 Tage: 39 Drucksätze, 45 Zugsätze, 2 „Bein"-Sätze (s. B6) → rund 5 Sätze je Woche für alle Druckmuskeln zusammen. Das ist unterhalb dessen, was für Aufbau nötig wäre, und am unteren Rand für Erhalt.
- **Übungsauswahl** ist isolationslastig (Seitheben, Curls, Trizeps, Face Pulls) bei nur zwei Grundübungen (Bankdrücken einmal, Schrägbank fünfmal). Kein Hip Hinge, keine Kniebeuge, kein Überkopfdrücken.

## Priorisierung

1. B1 und B2 zusammen — sie betreffen jede Aussage der Seite. Ohne sie behauptet das Kraftprofil Fortschritt, den es nicht belegen kann.
2. B4 und B5 — falsche Einzelaussagen, klein zu beheben.
3. B3 — Stagnation nach Steigung; setzt B2 voraus.
4. B6 — Gruppenzuordnung; macht die Balance-Zahl erst ehrlich.
5. B7 — Datenintegrität, unabhängig von S2.

S2 ist aus meiner Sicht **nicht abschlussfähig**, solange B1 und B2 offen sind.
