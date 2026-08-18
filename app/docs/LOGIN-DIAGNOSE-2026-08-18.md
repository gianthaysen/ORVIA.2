# Login-Init: Befund, korrigierte Hypothese und der entscheidende Test

**Stand 18.08.2026** · Bezug: `onAuthed`-Kette in `app/js/auth.js:246–281`

---

## 1 · Wo wir stehen

**A ist umgesetzt und live (v8-356), strukturell belegt.** Die Marke
`avatarStore.hydrate (nachgelagert, ausserhalb der Login-Kette): 1313 ms` steht **nach**
`TOTAL login-init chain`, der Build-Marker meldet `orvia-v8-356`. Der Avatar lädt weiterhin,
er hält den Login nur nicht mehr auf.

**Die Gesamtzeit belegt das nicht — und kann es bei dieser Streuung auch nicht.**

| Lauf | TOTAL | Bemerkung |
|---|---:|---|
| 17.08. abends | 7084 ms | alter Code |
| 17.08. später | 4781 ms | alter Code |
| 18.08. vor Deploy | 4146 ms | alter Code |
| 18.08. nach Deploy | 4653 ms | **neuer Code**, Avatar raus |

Derselbe Code schwankt zwischen 4146 und 7084 ms. Eine Ersparnis von 1300 ms ist in diesem
Rauschen mit Einzelläufen **nicht nachweisbar**. Der strukturelle Beleg (Marke steht außerhalb
der Kette) ist belastbar, die Zahl ist es nicht.

Im letzten Lauf wurde der Gewinn zusätzlich aufgefressen:
`checkinStore.hydrateRecentTypes` sprang von **100 ms auf 1171 ms** — derselbe Code, anderer
Tag, andere Daten.

---

## 2 · Korrektur meiner eigenen Hypothese

Ich hatte vermutet, die Sekunden pro Abfrage kämen von **fehlenden Indizes**. Das ist
**falsch** — die Indizes existieren, angelegt in den Migrationen:

```
daily_checkins_user_date_idx    on daily_checkins (user_id, local_date desc)
readiness_scores_user_date_idx  on readiness_scores (user_id, local_date desc)
user_goals_user_idx             on user_goals (user_id)
user_sports_uniq                on user_sports (user_id, sport)
```

Genau die Spalten, nach denen die Abfragen filtern und sortieren. Damit fällt die naheliegende
Erklärung weg, und die Frage wird schärfer: **Wo geht die Zeit hin, wenn nicht in die Suche?**

---

## 3 · Die neue, präzisere Hypothese

**Die Kette ist nicht rechenintensiv, sondern rundreiseintensiv.**

Aus dem Code (`repoBase.selectAll`, `checkinRepository`, `readinessRepository`) ergibt sich:

| Schritt | Anfragen | gemessen | pro Anfrage |
|---|---:|---:|---:|
| `readinessStore.hydrateRecentScores` | **2** (`listScores` + `getBaselines`) | 1328 ms | ~660 ms |
| `checkinStore.hydrateRecentTypes` | 1 | 1171 ms | 1171 ms |
| `profileStore.hydrateGoals` | 1 | 851 ms | 851 ms |
| `profileStore.hydrateSports` | 1 | 352 ms | 352 ms |
| übrige Glieder | je 1 | 79–420 ms | — |

Insgesamt **elf bis dreizehn HTTPS-Rundreisen, streng nacheinander.** Die Gesamtzeit ist per
Konstruktion die **Summe**, nicht das Maximum — und jede Latenzschwankung addiert sich voll.

Zwei Verstärker kommen hinzu:

1. **`select('*')` überall.** `repoBase.selectAll` holt grundsätzlich alle Spalten, auch die
   JSONB-Nutzlasten. Bei 35 Check-in-Tagen ist das potenziell ein Vielfaches dessen, was die
   Anzeige braucht.
2. **Free-Tier-Instanz.** Kalte Verbindungen und gedrosselte Ressourcen wirken sich bei elf
   Einzelanfragen elffach aus.

**Wenn diese Hypothese stimmt, hilft kein Index — sondern nur: weniger Anfragen, parallel
statt seriell, kleinere Nutzlast.**

---

## 4 · Der Test, der es entscheidet

Zwei Messungen, die dieselbe Frage von beiden Seiten stellen. **Kein Eingriff, nur Befund.**

### 4.1 Serverseite — `supabase/tests/_perf-diagnose.sql`

Blockweise im SQL-Editor. Sechs Blöcke: `explain (analyze, buffers)` für exakt die vier
Abfragen der Kette, dazu Zeilenzahl und Nutzlast in Bytes sowie das Index-Inventar.

**Entscheidend ist die Zeile `Execution Time` je Block:**

| Ergebnis | Schluss |
|---|---|
| < 10 ms | Die Datenbank ist unschuldig. Die Zeit steckt in Rundreise und Serialisierung → **Parallelisieren**, nicht optimieren |
| 100–1000 ms | Die Abfrage selbst ist langsam → Plan lesen (Seq Scan? Sort?), dann gezielt nachbessern |

### 4.2 Clientseite — seriell gegen parallel, in der Konsole der eingeloggten App

Dieser Block misst direkt, was Maßnahme **B** brächte — **bevor** eine Zeile Produktivcode
geändert wird:

```js
const q = () => [
  ORVIA.sb.from('readiness_scores').select('*').order('local_date',{ascending:false}).limit(60),
  ORVIA.sb.from('daily_checkins').select('*').gte('local_date','2026-07-14').lte('local_date','2026-08-18'),
  ORVIA.sb.from('user_goals').select('*'),
  ORVIA.sb.from('user_sports').select('*')
];

// seriell — so wie der Login es heute macht
let t0 = performance.now();
for (const p of q()) await p;
const seriell = Math.round(performance.now() - t0);

// parallel — so wie er es machen könnte
t0 = performance.now();
await Promise.all(q());
const parallel = Math.round(performance.now() - t0);

console.log({ seriell, parallel, ersparnis: seriell - parallel });
```

**Bitte drei- bis fünfmal laufen lassen** und alle Ergebnisse schicken — ein Einzelwert ist bei
dieser Streuung wertlos.

| Ergebnis | Schluss |
|---|---|
| `parallel` ≈ langsamste Einzelabfrage | Parallelisierung wirkt → **B lohnt sich**, Umsetzungsplan folgt |
| `parallel` ≈ `seriell` | Der Flaschenhals liegt anderswo (Verbindung, Free-Tier-Drosselung) → B wäre Aufwand ohne Wirkung |

---

## 5 · Was ich NICHT getan habe, und warum

**Kein Code geändert.** Maßnahme B (Parallelisierung der Hydrationen) berührt die
Last-Write-Wins-Logik in `profile-store.js`: Alle Sektions-Zyklen schreiben in dasselbe
`PROFILE`-Objekt. Parallel ausgeführt könnten sie sich gegenseitig überschreiben — mit einem
Fehlerbild, das erst Tage später als „mein Profil hat sich zurückgesetzt" auffällt. Vor dem
ersten Eingriff braucht es eine Abhängigkeitsanalyse der fünf Zyklen und eine Antwort auf die
Frage, welche davon wirklich unabhängig sind.

**Kein Index angelegt.** Die vermutete Ursache hat sich als falsch erwiesen. Ein Index „zur
Sicherheit" wäre Aktionismus: Er kostet Schreiblast und verdeckt die echte Ursache.

**Keine weiteren Messungen als Beleg gewertet.** Bei 4146–7084 ms Streuung braucht jede
Aussage über Wirkung mindestens fünf Läufe.

---

## 6 · Reihenfolge der nächsten Schritte

1. **4.1 und 4.2 fahren** (zusammen ~10 Minuten, kein Eingriff)
2. Je nach Befund: entweder Nutzlast verkleinern (`select` mit Spaltenliste statt `*`) oder
   Parallelisierung mit vorheriger Abhängigkeitsanalyse
3. Erst danach **C** — das fünffache `renderDecision` während der Kette (~900 ms), inklusive
   vier Läufen der Shadow-Engine, die der Code selbst als `duplicate` protokolliert
