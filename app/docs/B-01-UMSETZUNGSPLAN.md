# B-01 · Ziel→Plan-Kette schließen — Umsetzungsplan

**Stand:** 03.09.2026 · **Band 1:** 24 h, Abhängigkeit **Gate A (Shadow-Log validiert)** · **Sprint B-S1**
**DoD laut Band 1:** *Zwei Nutzer mit gleicher Kategorie, aber unterschiedlichem Zielwert erhalten
nachweislich unterschiedliche Wochenpläne; Tests decken Zielwert-Variation ab.*

> Dieser Plan ist die Vorarbeit, die ohne Gate A erlaubt ist: Ist-Stand lesen, Zielzustand
> festlegen, den reinen Kern bauen. **Der Umbau der Aufrufer bleibt hinter Gate A** — er ist
> die Verhaltensänderung, die das Shadow-Log erst absichern soll.

---

## 1 · Kernergebnis

**B-01 ist kleiner als „Zielobjekt in die Planung bringen" und größer als „goalOf() ersetzen".**

Zielwert und Zieldatum wirken **heute schon** auf den Plan — aber nur für Lauf-Distanzziele,
über eine Legacy-Leseschicht mit drei Rückfallebenen und einem **erfundenen Default** (110 min).
Was fehlt, sind vier Dinge:

| # | Lücke | Wirkung heute | B-01-Antwort |
|---|---|---|---|
| 1 | `goalOf()` filtert auf Laufdistanzen | Kraft-/Körper-/Tri-Hauptziel mit Priorität 1 läuft an der Planung vorbei; Plan folgt dem nachrangigen Laufziel oder dem Profil-Fallback | **eine** Quelle: `mainGoalOf()` → `goalPlanInput.resolve()` |
| 2 | `goalTargetMin()` liefert ohne Zielzeit **110** | Nutzer ohne Zielzeit bekommt Wochen-km, Zonen und Prognose für ein 1:50-Ziel, das er nie gesetzt hat | Datenlücke ≠ Wert: `targetMin: null` + benannte Lücke; Aufrufer zeigen „Zielzeit fehlt" statt zu rechnen |
| 3 | Taper (A-09) wird nur **beobachtet** | In Taper/Rennwoche steht im Template weiter Intervalle + Tempo + Long Run; nur `weekKmTarget` sinkt | Phase steuert das Template: Taper = Volumen −, Intensität behalten; Rennwoche = 1 kurzer Reiz + Ruhe |
| 4 | Feasibility (A-08) wird nur **beobachtet** | Unrealistisches Ziel erzeugt denselben Plan wie ein realistisches | B-01 zeigt das Urteil im Plan-Kopf; **steuern** tut es erst B-02 (Zielseite) — bewusst getrennt |
| 5 | `Calc.goalEngine` ist **Halbmarathon-hartkodiert** (`riegelHM`, `HM_KM`, Long-Run-Schwellen 14/17 km) und hat einen **zweiten** 110-Default (`TARGET_MIN_DEFAULT`) | Prognose ist immer eine HM-Zeit, wird aber gegen den Zielwert **jeder** Laufdistanz gehalten: 10-km-Ziel 50 min ⇒ dauerhaft `risk`, Marathon 4:00 ⇒ dauerhaft `ontrack` (Zahlen §2) | `goalEngine` bekommt `distanceKm` aus der Plan-Eingabe; Riegel auf die **Zieldistanz**; ohne Zielzeit `state:'no_target'` statt 110 |

**Reiner Kern gebaut:** `engine/goal-plan-input.js` — `resolve()`, `planKey()`, `compareLegacy()`.
36/36, 5 Proben. Nicht verdrahtet.
**Schritt 3 gebaut (v8-365, Flag aus):** Quelltausch in `goalOf()` hinter dem serverseitigen Flag
`goal_plan_input` (Migration 0039). Einschalten je Konto per SQL (Kopf von 0039), Rückweg = `enabled=false`.
**Schritte 4 und 5 gebaut (v8-365, Flag aus):** kein 110 mehr erreichbar, Zieldistanz in der Prognose,
Taper/Rennwoche/Wettkampftag im gelesenen Plan. Was bei eingeschaltetem Flag zu sehen sein muss, steht in §11.
**Lücke 5 vorbereitet (v8-365):** `Calc.goalEngine` nimmt `opts.distanceKm` (Riegel, EF-Korridor,
Long-Run-Bedarf relativ zur Zieldistanz); **ohne** die Angabe byteweise wie bisher — kein Aufrufer
übergibt sie heute. `goal_engine_distance` 18/18, 3 Proben. Der 110-Default bleibt bis zum Flag-Schritt.

---

## 2 · Ist-Stand (gelesen, nicht vermutet)

**Zwei Lesarten desselben Ziels:**

- `goalOf()` (ui.js:4561) — 46 Aufrufer (39 ui.js, 7 in race/profile/extras/insights/activity).
  Filtert `status==='active' && RACE_DIST[category]`, sortiert nach Priorität, fällt zurück auf
  `PROFILE.goal` (Legacy-Spiegel), dann auf `PROFILE.primaryGoal||'health'` + `hmTargetMin` +
  `DB._hmTargetMin`. Liefert `{type, distanceKm, raceDate, targetMin, priority:'solide'}`.
- `mainGoalOf()` (ui.js:4656) — kanonisch, alle Kategorien, niedrigste Priorität, kein Rückfall.
  Genutzt von `renderRaceHeader`, A-08-Adapter, A-09-Resolver, Goal-Shadow.

**Ableitungen von goalOf(), die der Plan tatsächlich liest:**

| Leser | Was | Aufrufer |
|---|---|---|
| `RACE.date` (Getter, ui.js:139) | `goalOf().raceDate` → `PROFILE.raceDate` → `''` | 17 |
| `goalTargetMin()` (ui.js:4599) | `goalOf().targetMin` → `DB._hmTargetMin` → **110** | 6 (u. a. `goalEngine`-Aufruf 1326, Pace-Seite 3188, 4538) |
| `goalTargetMinOrNull()` | dasselbe ohne 110 | 4 |
| `isRaceGoal()` (ui.js:262) | Kategorie ∈ Rennliste **und** raceDate | 2 |
| `generateWeekPlan()` (ui.js:275) | **nur** `gcat(goalOf().type)` → Template-Zweig | 1 |

**Wo Zielwert/-datum heute in den Plan fließen:**

1. `generateWeekPlan` → Template-Zweig nur nach **Kategorie** (runGoal/triGoal/strengthGoal).
2. `buildGoal()` → `Calc.goalEngine({daysToRace: daysTo(RACE.date), targetMin: goalTargetMin(), targetWeekKm: Calc.weekKmTarget(...)})` → Wochen-km, Prognose, Vetos. **Datum wirkt** (Runna-Kalender inkl. Entlastungswochen), **Zielzeit wirkt** — aber ggf. die erfundene.
3. `performance-resolver` → `performance-zones` bekommt `goalTarget {distanceKm, targetMin}` als **schwache** Evidenz (`self_report`) → Zonen/Paces der Prescriptions. **Zielzeit wirkt**, sofern keine stärkere Evidenz (Wettkampf, Schwellentest) sie überstimmt.
4. `Calc.racePhases/racePhase` → nur Anzeige (Plan-Kopf, Wochenansicht).

**Ist-Nachweis Teil A (rein, in Node gelaufen, 03.09.):** dieselben 18 Läufe (Tempo 8 km @ 4:45,
Long 16 km, Easy), nur der Zielwert variiert:

```
10 km · 50 min     target 50   tPred(HM) 106.2   state risk      ← Prognose ist eine HM-Zeit
HM · 1:50          target 110  tPred(HM) 106.2   state ontrack
HM · 1:40          target 100  tPred(HM) 106.2   state risk      ← Zielwert wirkt (nur bei HM korrekt)
Marathon · 4:00    target 240  tPred(HM) 106.2   state ontrack   ← immer, egal wie fit
ohne Zielzeit      target 110  tPred(HM) 106.2   state ontrack   ← zweiter 110-Default in calc.js
```

Das belegt Lücke 2 (doppelt: ui.js **und** calc.js) und Lücke 5 ohne Browser. Offen für Teil B
(Chromium-Harness): ob die Prescription-Paces bei 1:50 vs. 1:40 tatsächlich verschieden
ausgeliefert werden.

**Konsequenz für die DoD:** Zwei Läufer mit gleicher Kategorie und anderer Zielzeit bekommen
heute **vermutlich schon** unterschiedliche Prescription-Paces (Weg 3), aber dasselbe Template
(Weg 1) und — ohne stärkere Evidenz — nur dann, wenn beide eine Zielzeit *haben*. Ob „vermutlich"
„nachweislich" ist, entscheidet Schritt 2 unten, nicht diese Lesung.

---

## 3 · Zielzustand

1. `generateWeekPlan` und die drei Ableitungen (`RACE.date`, `goalTargetMin*`, `isRaceGoal`)
   lesen **eine** Plan-Eingabe: `ORVIA.goalPlanInput.resolve({goal: mainGoalOf(), today, canon, taper})`.
2. Ohne Zielzeit gibt es **keine** Zielzeit: `goalEngine` bekommt `targetMin: null` und markiert
   die Prognose als nicht bewertbar (das kann er: `not_assessable`-Pfade existieren seit I2c);
   Pace-Seite und Zielkarte sagen „Zielzeit fehlt" mit Link auf den Editor (den Text gibt es
   schon: `renderPaceZones`).
3. Phase aus A-09 steuert das Template: `taper` → Long Run −30 %, ein Intensitätsreiz bleibt,
   Gym auf Erhalt; `race_week` → ein kurzer Reiz (Mi), Rest Ruhe/Mobility; `past` → wie
   `build` **plus** Hinweis „Ziel abgelaufen" im Plan-Kopf (kein Plan-Totalverlust).
4. Kraft-/Körper-/Tri-Hauptziel mit Priorität 1 bestimmt den Template-Zweig — nicht mehr das
   nachrangige Laufziel.
5. A-06-Shadow läuft weiter, jetzt als **Regressionswächter**: `compareLegacy()` protokolliert,
   wo Kanon und Legacy auseinandergehen; erwartet werden genau die vier Lücken aus §1.

---

## 4 · Die Designentscheidung: Umstellung in einem Zug oder hinter Flag

| Option | Dafür | Dagegen |
|---|---|---|
| **A · Feature-Flag `goal_plan_input` (feature-flags.js), Standard aus** | Umbau der 46+27 Aufrufer landet gefahrlos; Umschalten pro Gerät testbar; Rückweg = Flag aus | Zwei Codepfade für 2–3 Wochen; Flag-Leser an jeder Stelle |
| B · Direkt umstellen, Deploy nach Gate A | Kein Doppelpfad | 73 Aufrufstellen ohne Rückweg außer Redeploy; ein Fehler in `RACE.date` trifft 17 Leser gleichzeitig |
| C · Nur `generateWeekPlan` umstellen, Ableitungen lassen | Klein | Widerspricht der DoD nicht, aber dem Zweck: Plan-Kopf, Prognose und Template hätten weiter zwei Zielwahrheiten — das ist der Zustand, den A-06 beenden soll |

**Empfehlung: A.** Das Flag-System existiert (`feature-flags.js`, guarded), das Muster
`engine_v2_plan` ist erprobt. Die vier Ableitungen bekommen je **eine** Flag-Abfrage an ihrer
Definition (nicht an 73 Aufrufern): `goalOf()` selbst liefert bei gesetztem Flag die
Legacy-**Form** aus der kanonischen **Quelle** — die 46 Aufrufer merken nichts, bekommen aber
das richtige Ziel. Das ist der eigentliche Trick: Form behalten, Quelle tauschen.

---

## 5 · Betroffene Dateien

| Datei | Änderung | Umfang |
|---|---|---|
| `app/js/engine/goal-plan-input.js` | **neu, gebaut** — reiner Kern | 130 Zeilen |
| `supabase/tests/goal_plan_input_test.mjs`, `app/tools/probes/goal-plan-input.json` | **neu, gebaut** — 36 Prüfungen, 5 Proben | — |
| `supabase/migrations/0039_goal_plan_input_flag.sql` | ✅ **gebaut** — CHECK um `goal_plan_input` erweitert (Muster 0034) | — |
| `app/js/engine/feature-flags.js` | ✅ **gebaut** — `goal_plan_input` in KNOWN, `@3` | — |
| `app/js/ui.js` `goalOf()` | ✅ **gebaut** — bei Flag + Hauptziel: `legacyForm(resolve(mainGoalOf()))`; sonst Bestand | — |
| `app/js/ui.js` `goalTargetMin()` | bei Flag: kein 110-Default; Aufrufer 1326/3188/4538 auf `OrNull` + Lückenanzeige | ~15 Zeilen |
| `app/js/ui.js` `generateWeekPlan()` | Phase-Steuerung (taper/race_week/past) aus `resolve().phase` | ~40 Zeilen |
| `app/js/ui.js` Plan-Kopf | Feasibility-Urteil (A-08) anzeigen, Lücken verlinken | ~25 Zeilen |
| `app/js/calc.js` `goalEngine()` | ✅ `opts.distanceKm` **gebaut** (additiv, v8-365); offen: ohne `targetMin` ⇒ `state:'no_target'` (kein `TARGET_MIN_DEFAULT`) — hinter Flag | ~10 Zeilen Rest |
| `app/js/engine/goal-shadow.js` | `compareLegacy`-Diff mitloggen (Regressionswächter) | ~10 Zeilen |
| `supabase/tests/goal_plan_switch_test.mjs` | **neu** — Flag aus = Bestand byteweise gleich; Flag an = die vier Lücken geschlossen | ~150 Zeilen |
| `_module-versions.json` | regeneriert (feature-flags) | automatisch |

**Nicht angefasst:** `performance-zones`, `week-plan-designer`, Migrationen.

---

## 6 · Reihenfolge

1. ✅ **Reiner Kern** (`goal-plan-input.js`) — *gebaut, 36/36, 5 Proben.*
2. **Ist-Nachweis** (2 h, autonom möglich, **vor** Gate A): Harness-Test, der `generateWeekPlan`
   + Prescription-Kette für zwei Profile (gleiche Kategorie, 1:50 vs. 1:40) laufen lässt und
   ausgibt, **was** sich unterscheidet (Template? Paces? km?). Ergebnis entscheidet, ob Schritt 5
   Paces anfassen muss oder nur das Template. *Braucht Chromium (gm6-Harness) → auf deinem Mac
   oder in CI, nicht in der Bridge-VM.*
3. ✅ **Flag + `goalOf()`-Quelltausch** — Migration 0039 (`goal_plan_input`, Standard aus), `feature-flags@3`, `goalPlanInput.legacyForm()`, Quelltausch in `goalOf()` nur bei Flag **und** vorhandenem Hauptziel; `goal_plan_switch` 21/21 (Flag aus = byteweise Bestand für 6 Profile; Kraft Prio 1 gewinnt; Rückfall unverändert; fail-closed), 1 Probe + GP6.
4. ✅ **110 entfernen, beide Schichten** — hinter Flag: `goalTargetMin()` → null; `goalEngine({strictTarget})` → `state:'no_target'` (Prognose bleibt, kein Band); Zielkarte mit eigenem `no_target`-Zweig („Zielzeit fehlt" + Link), Coach-Text, Pace-Seite (Hinweis statt NaN), Wochenplan-Paces (Cues statt erfundener HM-Paces). Sichtprüfung am Gerät offen.
   4a. ✅ **`buildGoal()` übergibt `distanceKm`** hinter dem Flag (Lücke 5 komplett).
5. ✅ **Phase → Plan** — *nicht* im Generator, sondern im **Lesepfad** (`activeWeekPlan()`, alle drei Zweige), weil der Generator nur ohne gespeicherten Plan läuft: `engine/goal-phase-plan.js` (rein, 25/25) + `applyGoalPhaseToPlan()` wie `alignPlanToAvailability` (nicht persistierend). Taper: harte Einheiten „kurz"/„Taper", Kraft „leicht", nichts gelöscht. Rennwoche: Long Run/Tempo weg, eine Intervalleinheit → „Anschwitzen", Kraft → Mobility, **Wettkampftag mit Zielpace**, Vortag und Folgetage frei. Nur Ausdauer-Familien (run/tri/bike).
6. ✅ **Plan-Kopf: Feasibility** — `_feasibilityLineHTML()` liest `ORVIA._lastFeasibility` (A-08), zeigt bei Flag eine Zeile unter „Phase" (Korridor / außerhalb / nicht bewertbar); Wortlaut ohne „machbar". Lücken-Links: die Zielkarte verlinkt „Zielzeit festlegen" (4b); ein vollständiges Lücken-Panel gehört zu B-02.
7. ✅ **Shadow als Regressionswächter** — ohne neuen Code: der A-06-Beobachter vergleicht `mainGoalOf()` mit `goalOf()` auf `identity/category/targetDate/targetMin`. Mit eingeschaltetem Flag liest `goalOf()` dieselbe Quelle ⇒ **jeder** Widerspruch nach dem Umschalten ist ein Befund. Prüfung: Ziel-Skript (§3 Gate-A) einmal mit Flag an wiederholen → R1 `widersprueche = 0` erwartet, insbesondere bei Kraft Prio 1 (vorher `identity`).
8. **Gate A abnehmen** → Flag auf dem Produktionskonto an → 7 Tage beobachten → Standard an.

Rest: Schritt 8 (Migration 0039 ✅ live, Deploy, Flag an, 7 Tage Schattenbetrieb, Standard an) — nur noch Betrieb, kein Code. — die Ersparnis kommt aus §4 (Quelle tauschen statt 73 Stellen).

---

## 7 · Teststrategie

| Prüfung | Warum |
|---|---|
| Flag aus ⇒ `goalOf()`-Ergebnis für 6 Profile **byteweise** wie heute | Bestandsschutz — der Umbau darf vor dem Umschalten nichts ändern |
| Flag an ⇒ Kraftziel Prio 1 bestimmt den Zweig; Laufziel Prio 2 nicht | Lücke 1 |
| Flag an, keine Zielzeit ⇒ `goalEngine` bekommt `null`, Pace-Seite zeigt Lücke | Lücke 2 (Probe: 110 zurückschmuggeln muss rot werden) |
| Phase taper/race_week/past ⇒ Template ändert sich wie in §3.3; `build` ⇒ **identisch** zu heute | Lücke 3, Bestandsschutz |
| **DoD:** gleiche Kategorie, 1:50 vs. 1:40 ⇒ `planKey` verschieden **und** mindestens ein Plan-Artefakt (Pace oder km) verschieden | wörtliche DoD, Zielwert-Variation |
| `goalEngine` mit `distanceKm` 10 / 21,0975 / 42,195 bei gleichen Läufen ⇒ drei verschiedene Prognosen, `state` plausibel je Distanz; ohne Zielzeit ⇒ `no_target` | Lücke 5 (Probe: `riegelHM` zurück muss rot werden) |
| `compareLegacy` auf dem Produktionskonto: Diff leer **oder** genau eine der vier erwarteten Lücken | Shadow als Wächter |
| Mutationsproben auf 110-Default, Sekunden/Minuten, planKey, past-Phase, Lückenbenennung | vorhanden (GP1–GP5) |

---

## 8 · Risiken

| Risiko | Bewertung | Gegenmaßnahme |
|---|---|---|
| `RACE.date` hat 17 Leser, darunter Prognose und Wochenansicht | **mittel** | Quelle tauschen, Form behalten (§4); Flag-Rückweg |
| Nutzer mit Zielzeit **nur** im Legacy-Blob (`DB._hmTargetMin`) verlieren sie | gering (zwei Produktionskonten, beide mit kanonischem Ziel — A-06-Shadow: `contradiction:false`) | Vor Umschalten per SQL prüfen, ob `user_goals.target_value` bei allen aktiven Laufzielen belegt ist |
| Taper-Steuerung kollidiert mit `progression@9` (führt `race_week/race_taper` als eigene Gründe) | **mittel** | A-09 liefert `progressionPhase` bereits passend; Template-Steuerung nutzt dieselbe Phase, kein zweiter Rechenweg |
| Einheitenregel strenger als `goalOf` (ohne unit **und** ohne metricType keine Zielzeit statt „Minuten raten") | gering | profile-model setzt für Zeitkategorien immer `metricType:'time'`; Fall tritt nur bei Altdaten auf — Shadow zeigt ihn als `target_min`-Diff |
| Scope-Kriechen Richtung B-02 (Zielseite) und B-09 (Ausfall) | gering | Feasibility wird **angezeigt**, nicht gesteuert; Ausfall bleibt B-09 |

---

## 9 · Definition of Done

1. Flag aus: Bestand unverändert (Test, byteweise)
2. Flag an: die vier Lücken aus §1 geschlossen (je ein Test)
3. DoD-Test: gleiche Kategorie, andere Zielzeit ⇒ verschiedener `planKey` **und** verschiedenes Plan-Artefakt
4. Kein 110-Default mehr erreichbar (Probe)
5. Shadow-Diff auf dem Produktionskonto leer oder erklärt
6. Flag 7 Tage an auf dem Produktionskonto ohne Shadow-Widerspruch → Standard an
7. Deploy nach Standard, `deploy-verify.sh` bestanden

---

## 10 · Empfehlung

**Schritt 2 (Ist-Nachweis) als Nächstes**, auf deinem Mac mit Chromium — er ist billig und
entscheidet, wie groß Schritt 5 wird. Alles ab Schritt 3 erst nach Gate A (#4 fällig heute,
#5 morgen). Bis dahin bleibt `goal-plan-input.js` unverdrahtet: keine Skript-Tags, kein sw.js.

---

## 11 · Sichtprüfung bei eingeschaltetem Flag (dein Konto, HM-Ziel 11.10.)

| Wo | Erwartung heute (Phase `build`, 38 Tage) |
|---|---|
| Zielkarte, Pace-Seite, Wochenplan | **identisch** zu vorher — dein Hauptziel ist das HM, Zielzeit gesetzt |
| Zielkarte nach Löschen der Zielzeit (Test) | grauer Kasten „Halbmarathon · Zielzeit fehlt", Prognose sichtbar, Link „Zielzeit festlegen"; **kein** ON TRACK/GEFÄHRDET |
| Pace-Seite ohne Zielzeit | Zonen aus der Prognose, Hero-Zeile „keine Zielzeit"; ohne Prognose ein Hinweis, keine NaN |
| Kraftziel testweise auf Priorität 1 | Plan-Kopf Kraft, Template Kraft, Zielkarte „Ziel · Muskelaufbau" (neutral), Pace-Seite ohne Paces |
| Ab 28.09. (13 Tage vor dem Rennen) | Long Run · Taper, Intervalle · kurz, Gym · leicht |
| Ab 05.10. (Rennwoche) | Long Run/Tempo weg, „Anschwitzen", So 11.10. „Wettkampf · 5:13 /km · Zielpace" (bei 1:50), Sa frei |
| Zieldatum testweise auf morgen | sofortige Rennwoche-Ansicht — Test ohne Warten; danach zurücksetzen |

## 12 · Abnahme des Wächters (12.09.2026) — Befund und Korrektur

**Befund.** `_goal-plan-guard.sql` (Ereignisse seit Flag-Aktivierung 04.09.) lieferte zunächst **0 Ereignisse**. Ursache: der A-06-Beobachter schrieb nur bei Zielmutationen (`add/update/remove/status`); acht Tage Nutzung ohne Zielbearbeitung hinterließen keine Zeile. DoD-Punkt 6 („7 Tage an ohne Widerspruch") war damit **nicht prüfbar** — ein Konstruktionsfehler dieses Plans, kein Befund gegen B-01.

**Nachweis stattdessen.** Gezieltes Auslösen aller vier Typen auf dem Produktionskonto (Hauptziel neu speichern, Kraft-Ziel Prio 1 anlegen → Prio 2 → pausieren/fortsetzen → löschen): **9 Ereignisse, 0 Widersprüche, v8-368** — insbesondere der frühere `identity`-Fall (Kraft Prio 1) ist mit Flag widerspruchsfrei, weil `goalOf()` dieselbe Quelle liest. Der Vergleich ist deterministisch; Laufzeit fügt keine Evidenz hinzu, Kategorien-Abdeckung schon.

**Konsequenzen (umgesetzt, HEAD nach 706d370):**
- Migration **0042**: `goal_plan_input` für alle bestehenden Konten eingetragen + Trigger auf `auth.users`, der neuen Konten dieselbe Zeile gibt. Bewusst per Zeile, nicht per Code-Standard — `feature-flags.js` bleibt fail-closed.
- Migration **0043** + `goal-shadow@2`: Ereignistyp `session`, einmal je Gerät und Kalendertag nach `orvia:auth-ready` (`profile.js _goalShadowSession`). Damit belegt das Log künftig Laufzeit, nicht nur Bearbeitung.
- Nebenbefunde aus dem Screenshot der Zielliste (zwei „Hauptziele", „6600 s", Konfliktkarte ohne Zielnamen, abgelaufenes Datum) → Commit 706d370.

**Offen (nur Gian):** 0042 und 0043 ausführen; Nachweis-Query am Ende von 0042 (`an = konten`).
