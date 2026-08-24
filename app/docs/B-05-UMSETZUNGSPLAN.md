# B-05 · Supersets & Dropsets — Umsetzungsplan

**Stand:** 21.08.2026 · **Band 1:** 16 h, Abhängigkeiten *keine* · **Gate B, Kriterium 4**
**DoD laut Band 1:** *Superset/Dropset anlegbar, durchführbar, in Historie korrekt; Sync-Roundtrip
via Supabase verlustfrei.*

> **Warum dieser Plan und nicht direkt Code:** B-05 berührt das Datenmodell, eine
> Produktions-Migration und den Live-Workout-Player. Das ist die Klasse Änderung, für die dein
> Profil einen Plan *vor* der Umsetzung verlangt — und die ich nicht unbeaufsichtigt durchziehe,
> während parallel am Prototyp gearbeitet wird.

---

## 1 · Kernergebnis

**B-05 ist zur Hälfte bereits gebaut.** Dropsets existieren vollständig im Datenmodell; es fehlt
im Wesentlichen die **Superset-Gruppierung**. Realistischer Restaufwand: **6–9 h** statt 16 h.

| Teil | Stand | Was fehlt |
|---|---|---|
| **Dropset** | ✅ Datenmodell vorhanden | Nur UI-Bedienung im Player (Satz als `dropset` markieren) + Anzeige |
| **Superset** | ⬜ fehlt ganz | Gruppierungsfeld, Migration, Player-Logik (Wechsel A↔B), Historie, Sync |

---

## 2 · Aktueller Zustand (gelesen, nicht vermutet)

**Dropsets sind bereits ein first-class Satztyp:**

- `training-domain.js:75` — `SET_TYPES` enthält `dropset` (neben `warmup`, `working`, `top_set`,
  `backoff`, `rest_pause`, `myo_reps`, `amrap`, `technique`, `test`)
- `workout-ui.js:10` — Anzeigename „Drop-Satz" existiert
- `gym-volume.js:15` — `COUNTABLE_SET_TYPES` zählt `dropset` korrekt ins Volumen
- Migration `0035` — CHECK-Constraint auf `workout_sets.set_type` erlaubt `dropset`

→ **Dropset braucht keine Migration und kein Datenmodell.** Nur die Bedienung im Player.

**Supersets haben null Repräsentation.** Kein Feld, kein Konstante, keine UI. Die relevanten
Tabellen:

```
workout_exercises(id, workout_session_id, user_id, exercise_id, order_index,
                  planned_sets, min_reps, max_reps, target_rir, target_rpe,
                  rest_seconds, notes, completed, replaced_by_exercise_id,
                  client_exercise_id, created_at)
  unique(workout_session_id, order_index)

workout_sets(id, workout_exercise_id, user_id, set_number, set_type, weight, reps,
             rir, rpe, duration_s, distance_m, time_s, tempo, rest_s, completed,
             pain, technique, recorded_at, created_at)
  unique(workout_exercise_id, set_number)
```

**Nebenbefund (für B-06):** `replaced_by_exercise_id` existiert bereits — der 2-Tap-Übungstausch
hat sein Datenmodell-Fundament schon. B-06 wird dadurch kleiner als die geplanten 10 h.

---

## 3 · Zielzustand

1. Zwei oder mehr Übungen einer Session lassen sich zu einem **Superset** gruppieren; der Player
   führt sie abwechselnd aus (A1 → B1 → A2 → B2 …) statt sequenziell.
2. Ein Satz lässt sich im Player als **Dropset** markieren; Anzeige und Volumenzählung stimmen
   (Letzteres funktioniert bereits).
3. Beides überlebt **Reload und Sync verlustfrei** (Gate-B-Kriterium 4).
4. Die **Historie** zeigt die Gruppierung korrekt, statt die Übungen als unabhängig darzustellen.

---

## 4 · Die eine Designentscheidung: wie Supersets gespeichert werden

| Option | Aufwand | Dafür | Dagegen |
|---|---|---|---|
| **A · `superset_group` (int, nullable) auf `workout_exercises`** | ~1 h Migration | Minimal-invasiv, kein neues Objekt; `null` = kein Superset (Datenlücke ≠ Wert); Reihenfolge bleibt `order_index`; Sync erbt bestehende Pfade automatisch | Gruppe ist nur eine Zahl ohne eigene Eigenschaften (z. B. Gruppen-Pausenzeit) |
| **B · Eigene Tabelle `workout_supersets`** | ~4 h | Gruppe kann eigene Attribute tragen (Pause, Runden, Label) | Neue Tabelle + RLS + Policies + Sync-Pfad + Join in jeder Leseoperation. Für 2–3 Übungen pro Gruppe **massiv überdimensioniert** |
| **C · Nur clientseitig (localStorage)** | ~0 h | Keine Migration | Übersteht keinen Gerätewechsel; **verletzt das DoD** („Sync-Roundtrip verlustfrei") |

**Empfehlung: A.** Ein `smallint`-Feld trägt die Gruppierung vollständig. Braucht eine Gruppe
später Attribute (Pausenzeit), ist das eine additive Migration — kein Umbau. Option B wäre die
Sorte Vorratsarchitektur, die Komplexität ohne heutigen Gegenwert erzeugt.

**Konkret:** `alter table public.workout_exercises add column if not exists superset_group smallint;`
Zwei Übungen mit demselben `superset_group`-Wert in derselben Session bilden einen Superset;
`null` heißt „normale Übung". Reihenfolge innerhalb der Gruppe = vorhandener `order_index`.

---

## 5 · Betroffene Dateien

| Datei | Änderung | Umfang |
|---|---|---|
| `supabase/migrations/0038_superset_group.sql` | **neu** — eine Spalte, kein Constraint-Umbau | ~15 Zeilen |
| `app/js/engine/superset-model.js` | **neu** — reine Logik: gruppieren, Ausführungsreihenfolge (A1→B1→A2→B2), validieren | ~120 Zeilen |
| `app/js/workout-ui.js` | Player: Gruppen-Badge, Wechselanzeige, Dropset-Markierung | ~60 Zeilen |
| `app/js/workout-store.js` (o. ä. Repo) | `superset_group` in Lesen/Schreiben aufnehmen | ~5 Zeilen |
| `app/index.html` + `app/sw.js` | Script-Tag + Cache-Eintrag für das neue Modul | 2 Zeilen |
| `supabase/tests/superset_model_test.mjs` | **neu** — Ausführungsreihenfolge, Randfälle | ~150 Zeilen |
| `app/tools/probes/superset-model.json` | **neu** — 3–4 Proben | ~50 Zeilen |
| `supabase/tests/_live-check.sql` | regenerieren (neue Spalte) | automatisch |

**Nicht angefasst:** `workout_sets`, Volumenlogik, Progression, Plan-Erzeugung.

---

## 6 · Reihenfolge

1. **`superset-model.js` als reine Logik + Tests** (3 h) — ohne DB, ohne UI. Die
   Ausführungsreihenfolge ist der fehleranfällige Teil und vollständig offline testbar.
   *Kann ich autonom bauen.*
2. **Migration 0038** schreiben, `_live-check.sql` regenerieren, Paritätstest grün (0,5 h).
3. **Migration live einspielen**, lesend verifizieren (0,5 h) — *braucht dich.*
4. **Repo/Store**: `superset_group` in Lesen/Schreiben (1 h).
5. **Player-UI**: Gruppieren, Wechselanzeige, Dropset-Markierung (2–3 h) — *visueller Teil, braucht
   dein Auge.*
6. **Sync-Roundtrip am Gerät** prüfen (0,5 h) — *braucht dich, ist das DoD.*
7. **Deploy** nach Standard.

**Schritt 1 ist unabhängig von allem** und der natürliche nächste autonome Baustein.

---

## 7 · Teststrategie

| Prüfung | Warum |
|---|---|
| A1→B1→A2→B2 bei 2 Übungen × 3 Sätzen; korrekte Reihenfolge bei **ungleicher** Satzzahl (3 vs. 2) | Der Kern. Ungleiche Satzzahlen sind der Fall, den Implementierungen typisch falsch machen |
| Gruppe mit **einer** Übung ist kein Superset (degeneriert zu normal) | Sonst entsteht ein „Superset", der keiner ist |
| `superset_group: null` → unverändertes sequenzielles Verhalten | Bestandsschutz: bestehende Workouts dürfen sich nicht ändern |
| Drei Übungen in einer Gruppe (Triset) funktionieren | Die Logik darf nicht auf 2 hartkodiert sein |
| Zwei **getrennte** Gruppen in einer Session laufen unabhängig | Gruppen dürfen sich nicht vermischen |
| Dropset zählt ins Volumen (bereits vorhanden) — Regressionsprüfung | `gym-volume` darf sich nicht ändern |
| **Sync-Roundtrip**: speichern → laden → identische Gruppierung | Das wörtliche DoD |
| Mutationsproben auf Reihenfolge und Gruppen-Trennung | Sonst ist die Zusicherung ungeprüft |

---

## 8 · Risiken

| Risiko | Bewertung | Gegenmaßnahme |
|---|---|---|
| Bestehende Workouts ändern ihr Verhalten | **gering** | `superset_group` ist nullable; `null` = exakt heutiges Verhalten, per Test abgesichert |
| Migration auf der Produktionsinstanz | gering | Nur `add column if not exists`, kein Constraint-Umbau; Muster von 0035/0037 bewährt |
| Player-Zustand bei Reload inkonsistent | **mittel** | Der Player hat bereits Wiederherstellungslogik (`live_workout_restore_phase42`); Gruppierung liegt in der DB, nicht im Player-Zustand |
| Kollision mit der laufenden Prototyp-Arbeit | **mittel** | Schritt 1 (neues Modul) ist kollisionsfrei; Schritte 4–5 berühren `workout-ui.js` — vorher abstimmen |
| Scope-Kriechen Richtung „Runden/EMOM" | gering | Bewusst außen vor; Superset = abwechselnde Ausführung, mehr nicht |

---

## 9 · Definition of Done

1. Ausführungsreihenfolge korrekt für 2er/3er-Gruppen, gleiche **und** ungleiche Satzzahlen (Test)
2. `null`-Gruppe = unverändertes Bestandsverhalten (Test)
3. Migration 0038 live, `_live-check.sql` regeneriert, Paritätstest grün
4. Superset im Player anlegbar und durchführbar; Dropset markierbar
5. Historie zeigt die Gruppierung korrekt
6. **Sync-Roundtrip am Gerät verlustfrei** (Gate-B-Kriterium 4)
7. Mutationsproben vorhanden und wirksam
8. Deploy nach Standardauftrag, `deploy-verify.sh` bestanden

---

## 10 · Empfehlung

**Schritt 1 jetzt bauen** (`superset-model.js` + Tests, kollisionsfrei, ~3 h). Danach entscheidest
du, ob die Migration und der UI-Teil dran sind — das ist der Punkt, an dem es dein Gerät, dein Auge
und einen Deploy braucht.

**Nicht empfohlen:** B-05 komplett am Stück ohne dich. Datenmodell + Live-Player + Sync sind
zusammen genau die Kombination, bei der eine unbeaufsichtigte Änderung teuer wird.
