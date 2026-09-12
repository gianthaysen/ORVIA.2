# Phase B · Stand Gym-Strang (B-05 · B-06 · B-07 · B-08)

**Stand:** 03.09.2026 · Build **v8-364** (lokal committet, **nicht deployed**) · Branch `main` lokal, Push nach `entwicklung` offen
**Commits:** `4136458 … 66facd7` (Modulkerne, 24.08.) · `7a72281` Player-Anbindung · `417628f` Historie-Label · `035a552` kg/lb

---

## 1 · Kernergebnis

Der komplette Gym-Strang ist **gebaut, getestet und im Player verdrahtet**. Was fehlt, braucht ausschließlich dich:
Migration 0038 live, Deploy, Sichtprüfung am Gerät, Sync-Roundtrip (Gate B, Kriterium 4).

| Paket | Modul | Player | DoD (Band 1) | Offen |
|---|---|---|---|---|
| **B-05** Superset/Dropset | `superset-model@1` 26/26 · 4 Proben | Koppeln/Lösen-Sheet, Badge A/B am Chip, Wechsel A1→B1→A2→B2, Historie-Label | anlegbar ✅ · durchführbar ✅ · Historie ✅ · **Sync-Roundtrip ⬜** | 0038 live, Roundtrip am Gerät |
| **B-06** 2-Tap-Tausch | `exercise-alternatives@1` 24/24 · 4 Proben | „Alternative" → Liste nach Muskelabdeckung → Tap = Tausch (2 Taps ab Karte) | ≤ 2 Taps ✅ · Historie konsistent ✅ (bestehender `replaceExercise`-Pfad) | Sichtprüfung |
| **B-07** Scheibenrechner | `plate-calculator@1` 22/22 · 3 Proben | „⚖ Scheiben" neben kg; je Seite; Stange 20/15/10 kg bzw. 45/35/15 lb; kg/lb; „ladbar" übernehmbar | aus Satzansicht ✅ · Stange konfigurierbar ✅ · kg/lb ✅ · Rundung getestet ✅ | Sichtprüfung |
| **B-08** Satzgenaue Progression | `strength-progression@1` 31/31 · 5 Proben | „Vorschlag"-Block unter der letzten Leistung, je Satz, antippen füllt kg/Wdh | je Satz ✅ · Steigerung/Stagnation/Deload als Tests ✅ | Sichtprüfung |

Querschnitt: `gym-adapters@1` (Übersetzer) 29/29 · 5 Proben; `workout-gym.js` (Anbindung) 34/34 · 3 Proben — **Mini-DOM-Test ohne Playwright**, prüft Fail-open, Haken, Wechsel, Vorschlag, Scheiben, Historie.

---

## 2 · Architektur (was wo liegt — und warum)

```
js/engine/superset-model.js        rein   Gruppen, Ausführungsreihenfolge
js/engine/exercise-alternatives.js rein   Muskelabdeckung, Ranking
js/engine/plate-calculator.js      rein   Scheiben je Seite (gierig, abrunden)
js/engine/strength-progression.js  rein   doppelte Progression je Satz
js/engine/gym-adapters.js          rein   EINZIGE Übersetzung App-Daten ↔ Modul-Eingaben
js/workout-gym.js                  UI     Sheets, Badges, Vorschlagsblock — hängt an 6 Haken
js/workout-ui.js                   UI     6 Haken `gy('…')`, alle fail-open
```

**Fail-open ist getestet, nicht behauptet:** Test A lädt `workout-ui.js` ohne `workout-gym.js` — der Player rendert identisch, keine Gym-Elemente.
**Kein Modul kennt DOM, Store oder DB-Zeilen.** Ändert sich eine Spalte, ändert sich `gym-adapters.js`, sonst nichts.

### Datenmodell (B-05)
`workout_exercises.superset_group smallint null` (Migration **0038**). NULL = normale Übung = exakt heutiges Verhalten. Gleicher Wert in derselben Session = Superset. Eine Gruppe mit nur einer Übung ist **kein** Superset (Modul entscheidet, Badge folgt dem Modul — Probe WG3).

**Sicherung gegen die 0035-Klasse:** Die Spalte wird beim **Anlegen** einer Übung **nie** mitgeschickt (Test F1). Ist 0038 nicht live, scheitert nur das Koppeln mit Klartext („Migration 0038 fehlt auf dem Server") — Übungen anlegen, Sätze loggen laufen unverändert.

### Repo-Erweiterung (B-08)
`getPreviousExercisePerformance` liefert **additiv** `history` (letzte 6 Einheiten roh). `date/sets/bestSet` unverändert. Ältere Aufrufer merken nichts (Test D5).

---

## 3 · Dein Teil — in dieser Reihenfolge

1. **Migration 0038 live** (SQL-Editor, Inhalt von `supabase/migrations/0038_superset_group.sql`). Danach lesend prüfen:
   ```sql
   select column_name, data_type, is_nullable from information_schema.columns
   where table_name='workout_exercises' and column_name='superset_group';
   ```
   Erwartet: 1 Zeile, `smallint`, `YES`.
2. `node supabase/tests/run-all.mjs` → grün, schreibt den `.suite-green`-Marker für HEAD `035a552`.
3. `git push origin main:entwicklung` → CI grün.
4. Deploy nach Standard (`git checkout -B deploy origin/main` → Upload-Satz → `git push origin deploy:main` → `bash app/tools/deploy-verify.sh`, erwartet **v8-364**).
5. **Sichtprüfung im Player** (Gym-Workout starten, 2 Übungen):
   - Chip-Leiste: Zahlen wie bisher. Übungskarte: „Alternative · Superset · Ersetzen · Entfernen".
   - **Superset** → Partner wählen → beide Chips tragen „ᴬ". Satz an A speichern → Player springt zu B, **kein** Pausentimer. Satz an B → zurück zu A, Pausentimer läuft.
   - **⚖ Scheiben** bei 102,5 → „1×25 + 1×15 + 1×1,25 je Seite · exakt". Stange 15 → „1×25 + 1×15 + 1×2,5 + 1×1,25". lb → 135 → „1×45".
   - **Vorschlag** erscheint nur bei Übungen mit früherer abgeschlossener Einheit; Antippen füllt kg/Wdh.
   - **Alternative** → Liste mit „% gleiche Muskulatur"; Tap ersetzt (ohne Sätze) bzw. legt neue Übung an (mit Sätzen, Toast sagt es).
6. **Sync-Roundtrip (Gate B, Kriterium 4):** Superset koppeln → Workout abschließen → App neu laden (oder zweites Gerät) → Historie der Einheit zeigt „Superset A" an beiden Übungen. Zusätzlich SQL:
   ```sql
   select order_index, superset_group from public.workout_exercises
   where workout_session_id = '<session-id>' order by order_index;
   ```

---

## 4 · Bewusste Entscheidungen (damit du sie nicht neu prüfst)

- **Zwischen A und B keine Pause**, Pause erst beim Rundenwechsel zurück zu A. Das ist die Definition eines Supersets; wer Pause will, drückt nicht „Überspringen" — der Timer läuft schlicht nicht an.
- **Dropset** ist seit 0035 ein Satztyp und im Typ-Select für `advanced/competitive` wählbar (`isPro()` ist Leistungsstufe, kein Bezahlmodell). Für Einsteiger bewusst nicht eingeblendet — kein neues UI-Element dafür gebaut.
- **Vorschlag ohne Historie = leer**, keine Platzhalterzahl (Probe WG2). Aufwärm-/Technik-/Testsätze zählen nicht als Progressionsgrundlage (Probe GA1); Satznummern werden über die zählbaren Sätze neu vergeben, damit Satz 1 vergleichbar bleibt, egal ob ein Aufwärmsatz davor lag.
- **B-08 nicht im `module_version_drift`-Wächter.** Der Vorschlag ist eine Anzeige, keine Planentscheidung; er ändert keinen Plan und läuft nicht durch `decision-log`. Sobald ein Vorschlag automatisch übernommen würde, gehört das Modul in `RUNTIME_MODULES` + Wächter.
- **Kurierte Alternativen** (`curated`-Parameter des Moduls) ohne Datenquelle: Es gibt keine Tabelle `exercise_alternatives`. Das Ranking läuft rein über Muskelabdeckung + Bewegungsmuster; eine kuratierte Liste ist eine additive Migration, falls die Trefferqualität nicht reicht.
- **Geräte-Filter** ebenfalls ohne Quelle (kein clientseitiges Übung→Gerät-Mapping). Das Modul filtert erst, wenn `equipmentAvailable` übergeben wird — heute nie.
- **lb ohne Umrechnung:** Das kg-Feld bleibt kg; im lb-Modus wird die Zahl als lb gelesen und „übernehmen" ist ausgeblendet. Umrechnen würde 61,2 kg in ein Feld schreiben, das der Nutzer als 135 lb meinte.

---

## 5 · Was danach im Strang noch möglich ist (nicht begonnen)

| Idee | Aufwand | Wert | Empfehlung |
|---|---|---|---|
| Gruppen-Pausenzeit (eigene Pause nach der Runde) | 2 h, additive Spalte | mittel | erst nach Gerätetest |
| Kuratierte Alternativen (Tabelle + Pflege-UI) | 4 h | abhängig von Trefferqualität | nach 2 Wochen Nutzung entscheiden |
| Vorschlag beim Speichern automatisch vorbefüllen | 1 h | hoch, aber Verhaltensänderung | erst wenn Vorschläge sich bewährt haben; dann Wächter |
| Superset im Wochenplan (Plan → Player) | 4 h | mittel | B-01-nah, nach Gate A |

---

## 6 · Phase-B-Gesamtbild (Stand 12.09.2026, HEAD `bc91e97`, Build v8-368)

| Paket | Stand | Wo |
|---|---|---|
| **B-01** Ziel→Plan-Kette | ✅ Code fertig, hinter Flag `goal_plan_input` (0039); **an seit 04.09.** auf dem Produktionskonto → 7-Tage-Wächter fällig (R1, `widersprueche = 0`) → Standard an | `B-01-UMSETZUNGSPLAN.md` |
| **B-02** Ziel-Detailseite | ✅ gebaut (`goal-detail.js`), Einstieg Zieltitel im Plan-Kopf; Sichtprüfung offen | `93f5637` |
| **B-03** Profilstärke | ✅ gebaut (`profile-strength.js`, Profilzentrale); Sichtprüfung offen | `cd60ac2` |
| **B-04** Onboarding v3 | 🔄 Schritt-Logging (0041, `onboarding-log.js`, Funnel-SQL) + PB-Erfassung gebaut; Entscheidung §2 (Leistungs-Schritt, 6 IDs streichen) offen | `B-04-PLAN.md` |
| **B-05 / 06 / 07 / 08** Gym | ✅ live seit v8-364; **Sync-Roundtrip am Gerät offen** (Gate B, Kriterium 4) | §3 |
| **B-09** Ausfall-/Krankheitslogik | ✅ live (v8-366), schlafend: Migration 0040 + Flag `absence_replanner` nicht gesetzt | `B-09-STAND.md` |
| **B-10** Engine v2 Canary | ⏳ braucht A-12-Report (`ORVIA.engineShadow.gateReport()`) | — |
| B-11 / B-12 | ⬜ nach B-10 | — |
| **B-13** i18n | 🔄 Laufzeit + Katalog DE (988 Keys) + Pseudo-Locale; unter t(): goal-detail, workout-gym, workout-ui, onboarding-ui, profile-center, **profile.js**; Rückprobe `tools/i18n-recon.mjs`. Offen: auth, activity, nutrition, issues, insights, adaptive-card, race, extras, ui.js (1058) | `B-13-I18N-STAND.md` |
| B-14 EN | ⬜ nach B-13 | — |
| B-15 Tests | 🔄 laufend — 269 geprüft, jede neue Logik mit Test, Kernmodule mit Proben | — |

**Nicht deployed:** v8-368 (alles seit `bc0a640` = v8-366: B-03, B-02, B-04-Logging, B-13 inkl. `locales/`). **Nicht durch CI:** alles seit `1c7c97f` (`entwicklung` hängt).

### Was nur du kannst — gesammelt (Reihenfolge = Empfehlung)
1. `git push origin main:entwicklung` (CI für alles seit `1c7c97f`).
2. Deploy v8-368 (drei Blöcke, **neu: `locales/` im Upload-Satz**, `v8-368 (Stand bc91e97)`), danach `bash app/tools/deploy-verify.sh`.
3. Migration 0041 (`onboarding_step_log`) — ohne sie läuft das Onboarding-Logging fail-open ins Leere.
4. B-01-Wächter: R1 seit 04.09. → `widersprueche = 0`? Dann Flag-Standard (alle Konten) = Insert für das zweite Produktionskonto.
5. Gym-Sync-Roundtrip (Superset koppeln → abschließen → Reload → „Superset A" in der Historie).
6. Optional: 0040 + Flag `absence_replanner`.
7. A-12: `ORVIA.engineShadow.gateReport()` in der Konsole → Ergebnis für B-10.
8. Entscheidung B-04 §2 (Leistungs-Schritt mit Chips, 6 IDs streichen).
