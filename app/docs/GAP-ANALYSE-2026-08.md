# ORVIA — Gap-Analyse & Code-Audit

**Stand:** 2026-08-02 · Basis: v8-219
**Methode:** Vollständiges Code-Audit über `js/` (≈1,9 MB), `index.html`, `styles.css`, `supabase/`
**Umfang:** 4 parallele Audits — Trainingsengine, Belastungssteuerung, UI-Platzhalterinventar, gemeldete Einzelbugs

> **Fachbegriff:** Was hier durchgeführt wurde, heißt **Gap-Analyse** (Ist-Soll-Abgleich: was fehlt zwischen aktuellem und angestrebtem Zustand), eingebettet in ein **Code Audit / Architektur-Review**. Im Produktkontext ist der Gesamtdurchlauf eine **Technical Due Diligence** bzw. ein **Capability Assessment**.

---

## 1. Kernergebnis

**Drei Befunde, die alles andere überlagern:**

**A) Der wichtigste Button der App ist tot.**
Der goldene Hero-Button „‹Einheit› starten" auf dem Dashboard und die identische Aktion im FAB (+) lösen **nichts** aus. Die Kette endet in `js/workout-ui.js:50`, wo ein Tabbar-Button `data-tab="training"` gesucht wird, den `index.html` nicht besitzt. `runAction` meldet trotzdem Erfolg — es gibt keinen Fehler, keinen Toast, keine Reaktion. Auch „Training fortsetzen" ist betroffen: wer das Live-Overlay schließt, hat **keinen sichtbaren Weg zurück** in ein laufendes Workout.

**B) Die Trainingsengine steuert nichts. Nicht teilweise — gar nichts.**
9 von 15 Engine-Dateien werden im Browser **nicht einmal geladen** (fehlen in `index.html` und `sw.js`). Die geladenen laufen ausschließlich im Schattenbetrieb und schreiben ihr Ergebnis in `localStorage`. Der sichtbare Wochenplan stammt aus einer hartcodierten Heuristik in `js/ui.js:159 generateWeekPlan()` mit Fixwerten `[['Laufen',3],['Schwimmen',2],['Gym',4],['Rad',2]]` (`ui.js:363`) — nutzerunabhängig. `plannerSupport` ist für **alle 24** Sportarten `false`, `productionStatus` für alle `'none'`.

**C) ~14 fertig gebaute Features sind unerreichbar.**
Beim Umbau auf die GM-Oberfläche wurden die Legacy-DOM-Bäume per CSS ausgeblendet (`styles.css:3048/3064/3069/3071/3073/3152`), ohne für jedes Feature einen Ersatzpfad zu schaffen. Live-/Pre-/Post-Check-in, HR-Zonen, Coach Briefing, Ernährungskonfiguration, Baselines, Regenerationsdefizit, Belastungsrisiko, Musterkennung, Wochen-Review — alles implementiert, alles funktionsfähig, für den Nutzer nicht auffindbar.

**Einordnung:** Das ist überwiegend **Verdrahtungsschuld**, nicht fehlende Substanz. Der überwiegende Teil der teuren Arbeit (Datenmodell, Berechnungen, Repositories, Renderer) ist erledigt. Die Lücke sitzt an den Nahtstellen. Das ist die günstige Sorte technischer Schuld — der Aufwand für P0+P1 liegt bei geschätzt 5–8 Tagen und hebt die wahrgenommene Produktreife überproportional.

**Positiv festzuhalten:** Die Trennung „echter Messwert vs. `—`" ist im gesamten GM-Code diszipliniert umgesetzt. Nirgends wird eine 0 oder ein Schätzwert als Messung ausgegeben. Der Großteil der 86 `GM_NA`-Vorkommen ist bewusste, dokumentierte Ehrlichkeit — kein Bug.

---

## 2. Bewertungsschema

| Kategorie | Bedeutung |
|---|---|
| **TOT** | Feature existiert nicht; Slot ist hardcodiert leer oder Klickpfad endet im Nichts |
| **UNERREICHBAR** | Feature ist vollständig implementiert, aber im UI nicht auffindbar |
| **DATENLEER** | Feature funktioniert; dem Nutzer fehlen nur Daten — **kein Handlungsbedarf** |
| **GATED** | Absichtlich hinter Level/Modus versteckt — **kein Handlungsbedarf** |
| **BUG** | Implementiert, aber fehlerhaft |

---

## 3. P0 — Blocker (sofort, Aufwand niedrig, Schaden hoch)

| # | Befund | Ort | Kategorie | Fix | Aufwand |
|---|---|---|---|---|---|
| P0-1 | **Hero-CTA „Training starten" tot** — sucht nicht existenten Tabbar-Button | `js/workout-ui.js:50`, `index.html:398-402` | TOT | Handler auf `gmOpenStartSheet()` umbiegen | 1 Zeile |
| P0-2 | **FAB → „Training starten" tot** — gleiche Kette | `js/quick-actions.js:26` | TOT | s. o. | 1 Zeile |
| P0-3 | **FAB → „Training fortsetzen" tot** — laufendes Workout nicht wieder öffenbar | `js/quick-actions.js:47` | TOT | `ORVIA.workoutUI.open()` direkt | niedrig |
| P0-4 | **Pace-Rechner-Widerspruch** — Analyse-Hub sagt „Folgt bald mit der Engine", obwohl der Rechner seit v8-219 produktiv ist (`ui.js:7548`) | `js/ui.js:6541`, `:6941-6947` | BUG | `onclick` auf `gmProfPaceCalc()` im Sheet rendern, Platzhaltertext löschen | ~1 h |
| P0-5 | **Muskelvolumen: „Erneut versuchen" wirkungslos** — `gmAnaRetry()` setzt `_gmMvModel` nicht zurück, das Fehler-Modell wird aus dem Cache neu geliefert | `js/ui.js:6346` | BUG | `_gmMvModel=null;` ergänzen | 1 Zeile |
| P0-6 | **Profilfoto wird ignoriert** — einziger Renderer, der `avatarStore.currentSrc()` nicht nutzt; auf Zweitgerät immer Initialen | `js/ui.js:7064` | BUG | Muster aus `ui.js:3532` übernehmen; `renderGMProfile` in `avatar-store.js:94` + `ui-refresh.js:58` registrieren | ~30 min |
| P0-7 | **Modul-Toggle ist Einbahnstraße** — deaktiviertes Dashboard-Modul lässt sich nie einzeln reaktivieren, nur „Standard" (Reset aller) | `js/ui.js:5128` | BUG | Liste rendert alle Module mit An/Aus-Zustand | niedrig |
| P0-8 | **Toter Drag-Griff** — `.mm-drag` Icon ohne `draggable`/`dragstart` im gesamten Projekt | `js/ui.js:5124` | TOT | entfernen (oder Drag bauen) | niedrig |

**Summe P0: ~1 Arbeitstag.** Behebt die zentrale Handlung der App plus fünf sichtbare Widersprüche.

---

## 4. P1 — Belastungssteuerung (die drei gemeldeten Lücken)

Die drei Anzeigen sind im UI **bereits vollständig ausgeprägt und werden gerendert** — sie sind hart auf `null` verdrahtet. Das ist zu ~70 % ein Verdrahtungsproblem, kein Datenproblem.

### P1-1 · Belastung nach Sportart → **nur UI fehlt, Daten und Berechnung existieren**

- **Symptom:** Drei Balken permanent auf 0 %, Werte „—"
- **Ursache:** `js/ui.js:4213` — `sport:[['Laufen',null,'ready'],['Kraft',null,'activity'],['Rad',null,'cyan']]` hardcodiert
- **Vorhanden:** Sport-Tagging kanonisch über `normSport()` (`js/training-domain.js:110`, 20+ Sportarten, Unbekanntes → `'other'`, nie geraten). Aggregation fertig in `weeklyActivityTotals().bySport` (`js/activity-config.js:658-723`) mit `knownLoadUnits`, `loadUnits`, `durationMin`, `distanceKm`, `completeness`. Wird bereits an vier Stellen konsumiert.
- **Fix:** ViewModel an `weeklyActivityTotals().bySport` anschließen, auf Prozentanteile normieren.
- **Wichtig:** `bySport.loadUnits` ist `null`, sobald eine Einheit ohne RPE dabei ist (`activity-config.js:695-696`). Der Balken muss auf `knownLoadUnits` mit Vollständigkeitshinweis zurückfallen — sonst verschwindet die Anzeige bei einer einzigen Garmin-Einheit ohne RPE wieder komplett.
- **Optional sauberer:** `dailyLoadSeries()` (`activity-config.js:737`) um eine `bySport`-Dimension erweitern, damit die Verteilung dieselbe Fensterlogik wie ATL/CTL nutzt statt nur die Kalenderwoche.
- **Aufwand:** niedrig–mittel (0,5–1 Tag)

### P1-2 · Hochintensiv → **Berechnung fehlt, HF-Zonendaten existieren nicht**

- **Symptom:** „Hochintensiv: Noch nicht verfügbar"
- **Ursache:** `js/ui.js:4212` — `hi:null`, kein Produzent
- **Datenlage, ehrlich:** Es gibt **keinerlei Zeit-in-Zone-Daten**. Weder Client-Feld noch DB-Spalte noch Import-Pfad. `normalizeActivitySummary` (`activity-normalize.js:148-186`) kanonisiert nur `distance`, `avgHr`, `maxHr`, `elevation`, `calories`, `avgSpeed`, `name`. Der GPX/TCX-Parser reduziert HF-Samples direkt auf einen Mittelwert (`activity.js:684`) und verwirft die Verteilung.
- **Drei Ausbaustufen, klar unterschiedlich belastbar:**
  1. **RPE-Proxy — heute machbar, keine neuen Daten.** `intensityHard` existiert bereits pro Unit (`activity-config.js:549`, RPE ≥ 7), wird nur nirgends aggregiert. Ehrlich zu beschriften als „Anteil harter Einheiten (RPE ≥ 7)" — **nicht** als „Zone 4/5", das wäre nicht gedeckt.
  2. **HF-Stream-basiert — nur Garmin.** `metrics.streams.heart_rate` existiert (`activity.js:406`). Aber: es gibt **keinen Zeitstempel-Stream**, Zeit-in-Zone wäre nur unter der Annahme gleichmäßiger Abtastung ableitbar. Keine Streams für Nicht-Garmin und Gym.
  3. **Echte Zone-Aggregate vom Provider** — erfordert Erweiterung von `normalizeActivitySummary`, DB-Schema und Garmin-Worker (liegt außerhalb dieses Repos).
- **Empfehlung:** Stufe 1 jetzt, ehrlich beschriftet. Stufe 3 auf die Roadmap.
- **Nebenbefund:** Für die Anzeige muss eine Zonendefinition festgelegt werden. Der Code ist hier bereits inkonsistent — 65–78 % HFmax als Easy-Z2 (`calc.js:650`, `:747`) vs. fixe Werte „HF 131–157" hartkodiert in `index.html:268`.
- **Aufwand:** Stufe 1 niedrig (0,5 Tag), Stufe 3 hoch (mehrere Tage, Worker-Änderung)

### P1-3 · TRIMP → **Berechnung fehlt, Daten überwiegend vorhanden**

- **Symptom:** „TRIMP Ø: Noch nicht verfügbar"
- **Ursache:** `js/ui.js:4212` — `trimp:null`. Repo-weite Suche nach `trimp` liefert exakt zwei Treffer, beide sind der leere UI-Slot. **Keine Formel im Code.**
- **Vorhandene Banister-Inputs:**

  | Input | Verfügbar | Beleg |
  |---|---|---|
  | Dauer | ✅ | `activity-normalize.js:270` |
  | Ø-HF | ✅ | `activity-normalize.js:174` |
  | HFmax | ✅ | `calc.js:8 _hrMax()` — Profilwert oder Tanaka |
  | Geschlecht | ✅ | `PROFILE.sex`, bereits genutzt in `calc.js:1407` |
  | **HFruhe** | ⚠️ | `calc.js:15 _rhrBase()` — **nur wenn gemessen**, sonst `null` |

- **Echte Datenlücken:** Ohne gemessenen Ruhepuls ist Banister-TRIMP nicht berechenbar und muss `null` bleiben — kein Fallback, konsistent mit der bestehenden Linie in `calc.js:13-15`. Aktivitäten ohne `avgHr` (Gym, alle Legacy-Blob-Sessions) fallen komplett heraus. Ein „TRIMP Ø" über nur teilweise abgedeckte Einheiten wäre irreführend, wenn die Abdeckung nicht mitgeliefert wird.
- **Zusätzlich fehlt eine Durchleitung:** `dailyLoadUnits` (`activity-config.js:457-478`) übernimmt aus `a.summary` heute nur `rpe` und `distance` — `avgHr` muss in den Unit-Vertrag aufgenommen werden.
- **Aufwand:** mittel (1 Tag)

### P1-4 · Interferenz → toter Slot

`js/ui.js:4213` `interf:null`. `Calc.evaluateLoadAndInterference()` existiert (`calc.js:1124`), wird vom Dashboard-VM aber nie aufgerufen. Die Legacy-Analyse hatte dafür `#interfBox` (`ui.js:3376`) — unerreichbar. **Fix: Verdrahtung, Aufwand mittel.**

### P1-5 · Eigenständiger Bug: `easyShare` ist für Garmin-Daten systematisch verzerrt

`calc.js:719` filtert auf `r.sub ∈ ['Walk-Run','Easy Z2','Long Run']`. Store-/Garmin-Läufe erhalten in `ui.js:459` aber `sub:''`. **Jeder ausschließlich per Garmin erfasste Lauf zählt damit als „nicht easy" und drückt den 80/20-Anteil künstlich nach unten.** Unabhängig vom Dashboard-Thema, aber inhaltlich falsch. **Aufwand: niedrig.**

### P1-6 · Toter Read-Pfad im Repository

`js/repos/trainingLoadRepository.js` **schreibt** eine `sport`- und eine `intensity`-Spalte (Ø-HF, Zeilen 16/22, DB-Schema `0002_core_data_foundation.sql:191/196`). `getDailyLoad` (Zeile 71-78) aggregiert aber nur nach `local_date` und verwirft die Sportart-Dimension. `listRange`, `getDailyLoad`, `getDailyLoadSeries` haben **null Konsumenten** im gesamten Frontend. Die App schreibt seit jeher Daten in die DB, die niemand liest. **Entscheidung nötig: nutzen oder entfernen.**

---

## 5. P1 — Unerreichbare Features (fertig gebaut, nicht auffindbar)

Jede Zeile ist implementierte, funktionsfähige Arbeit, die aktuell keinen Nutzen stiftet. Aufwand jeweils **niedrig bis mittel** — es fehlt nur ein Einstiegspunkt.

| Feature | Ort | Was fehlt |
|---|---|---|
| **Live-/Pre-/Post-Check-in** | `index.html:158`, `js/checkin-extra.js:24`, versteckt via `styles.css:3064` | Schreibt `DB[date].live/pre/post`, persistiert nach `daily_checkins`, **beeinflusst die Tagesentscheidung** — und hat keinen einzigen Einstiegspunkt |
| **HR-Zonen Z1–Z5** | `index.html:376-377`, `js/profile.js:272-289` | Funktionierender Renderer (gemessene HFmax oder Tanaka). GM zeigt stattdessen eine **deaktivierte Zeile** „Keine neue Zonenregel im UI" (`ui.js:7371`) — Widerspruch |
| **Ernährung / Energieverfügbarkeit (Heute)** | `index.html:157`, `js/nutrition.js:172` | Nur über **einen versteckten Deeplink** im „Aktive Energie"-Sheet (`ui.js:4880`) erreichbar, und nur wenn `active_kcal` aufgelöst ist |
| **Energie- & Ernährungskonfiguration** | `index.html:342`, `js/nutrition.js:197-198` | Zielrechner für Kalorien/Protein/Wasser vollständig — Seite unerreichbar |
| **Baselines · Regenerationsdefizit · Belastungsrisiko** | `js/intelligence.js:56/79/104` | Drei komplette Analysemodule ohne GM-Ersatz |
| **Tip-Engine „Was ORVIA daraus macht"** | `js/intelligence.js:139-148` | Renderer läuft, Host `#insights` ist `display:none`. GM4 hat eine gleichnamige Sektion, die aber `weekInsights()` nutzt statt `tipEngine()` |
| **Musterkennung · Wochen-Review** | `js/orvia-pro.js:113-123` | Unerreichbar; GM4 zeigt für Wochenreview stattdessen einen NA-Toggle |
| **Coach Briefing / Wochenanalyse kopieren** | `index.html:348-352` | `copyAIReview()` / `copySummary()` implementiert |
| **Equipment-Verschleiß** | `index.html:343` | Nur tief in „Profil bearbeiten → Geräte" |
| **Zyklus (optional)** | `index.html:380` | Unerreichbar |
| **Daten & Import (dataHub)** | `js/orvia-pro.js:164` | Unerreichbar |

**Empfehlung:** Als Block abarbeiten. Jeder Eintrag ist ein Einstiegspunkt — Sheet, Quick-Action oder Profil-Unterseite. Geschätzt 2–3 Tage für alle elf.

---

## 6. P2 — Gemeldete Einzelbugs

### P2-1 · Körperkarte / Muskelvolumen — drei übereinanderliegende Defekte

Der Fehlertext ist ehrlich, aber die **auslösende Bedingung ist falsch definiert**.

**a) Fehlklassifikation (Kernursache).** `gym-volume.js:605` setzt `anyFail`, sobald irgendein `sourceCall` als `attempted && !success` markiert ist. Die Registrierungen markieren aber **erwartbare Nicht-Verfügbarkeit als Fehlschlag**:
- `gym-volume.js:430` — `call('legacy_db', true, ...)`: `attempted` ist hart `true`. Ein Nutzer ohne Legacy-Tagesspeicher (Neuinstallation) erzeugt sofort `anyFail`.
- `gym-volume.js:435-436` — jedes `success:false` von `activityRepository.list` gilt als Fehler. Über `repoBase.js:54-55` liefert `selectAll` aber auch bei `no_session` und `offline` ein `success:false` — beides normale Zustände.
- `gym-volume.js:459` — ein einziger fehlgeschlagener Roundtrip unter Dutzenden kippt `anyFail`.

**b) `timedOut`-Logik.** `gym-volume.js:416` setzt `r.timedOut = waited >= maxMs` **auch dann**, wenn `localStoreReady` inzwischen `true` ist. Bei langsamem Auth-Start (>12 s, Kaltstart mobil) wird ein funktionsfähiger Store als „nicht bereit" gemeldet.

**c) Retry wirkungslos.** → siehe P0-5.

**Fix:**
1. `gym-volume.js:430` → `call('legacy_db', !!getDB(), true, ...)` — optionale Quelle nie als „attempted+failed"
2. `gym-volume.js:435` → `no_session`/`offline` als `attempted:false` behandeln
3. `gym-volume.js:607` → `anyFail` auf harte Fehler einschränken (`query_failed`, `exception`, `WORKOUT_DETAILS_FAILED`), alles andere → `no_gym_workouts`
4. `gym-volume.js:416` → `r.timedOut = (waited >= maxMs) && !r.localStoreReady`
5. `ui.js:6346` → `_gmMvModel=null;`

**Aufwand:** ~3 h.

**Separater Performance-Befund:** `ui.js:6660` verdrahtet `refresh:true` hart; die sequenzielle `await`-Schleife in `gym-volume.js:445-458` ist im Code **selbst als Ursache der 5–10 s-Verzögerung kommentiert** und läuft bei jedem Öffnen der Körperkarte. Fix: `Promise.all` + Kurzzeit-Cache.

### P2-2 · Analyse-Layout — drei echte CSS-Bugs

**a) „Planerfüllung" ragt heraus.** `ui.js:6438` nutzt `.kpi-row` mit **vier** Kacheln ohne Spaltenüberschreibung (die Aktivitäten-Ansicht hat bei `ui.js:5485` `repeat(3,1fr)`). Rechnung bei 390 px: (390 − 36 Rand − 24 Gap) / 4 ≈ 82 px, minus Padding ≈ **62 px Inhaltsbreite**. „PLANERFÜLLUNG" (13 Zeichen, 9 px, +letter-spacing) misst ≈ 78 px. Einzelwort ohne Trennmöglichkeit, weder `overflow-wrap` noch `hyphens` gesetzt.
**Fix:** `styles.css:2937` → `.kpi span{overflow-wrap:anywhere;hyphens:auto;line-height:1.2}` plus `ui.js:6438` auf `repeat(2,1fr)` (2×2) bei vier Kacheln. `lang="de"` am `<html>` prüfen, damit `hyphens:auto` greift.

**b) „Fortschritt & nächster Schritt" — Felder breiter.** In `#gmAna` haben alle Container 18 px Seitenabstand (`.card`, `.sectlabel`, `.insight-card`, `.kpi-row`). Nur `.mile` (`styles.css:3030`) hat **keinen horizontalen Margin** und läuft über die volle Breite — 36 px breiter als alles darüber. Für `#gmProfPage` wurde das bereits korrigiert (`styles.css:3113-3118`), für `#gmAna` nicht.
**Fix:** `#gmAna .mile{margin-left:18px;margin-right:18px}` plus Ellipsis-Schutz. Sauberer wäre `.mile` global auf `margin:0 18px 10px` — dann Regressionsrisiko im Pixelvertrag `styles.css:3094-3108` prüfen.

**c) Proteinziel-Karte, grünes Element ragt herein.** `.impact` (`styles.css:2907`) ist ein Flex-Container ohne `gap`, ohne `min-width:0` am `<strong>`, ohne `text-align:right`. Der grüne Empfehlungstext (57 Zeichen aus `insights.js:100`) wächst über seine Basis hinaus und verschmilzt optisch mit „Ernährung".
**Fix:** `.impact{align-items:flex-start;gap:10px}` · `.impact>span{flex:0 0 auto;white-space:nowrap}` · `.impact strong{flex:1 1 auto;min-width:0;text-align:right;line-height:1.35}`

**Aufwand alle drei:** ~1,5 h.

### P2-3 · Schlaf-Hypnogramm — Phasen nicht erklärt

`series-reader.js:107-123` rendert nur farbige `<rect>` in vier Spuren. Keine Spurenbeschriftung, keine Legende, keine Zeitachse, kein `<title>`. Die Farb→Phase-Zuordnung (`STAGE_COLOR`, Zeile 104) ist rein intern.

`GM_METRIC_INFO` (`ui.js:21`) hat Einträge für 14 Metriken, aber **keinen für `sleep_deep_min` / `sleep_light_min` / `sleep_rem_min` / `sleep_awake_min`** — deshalb greift der Generiktext.

**Fix:**
1. SVG um Spurenbeschriftungen erweitern (analog `renderCurve` `opts.axes`, Zeile 143-150)
2. Legende `Tief · Leicht · REM · Wach` unter `ui.js:4812`
3. `GM_METRIC_INFO` um vier Einträge ergänzen → `openMetric('sleep_deep_min')` funktioniert dann automatisch mit echtem Erklärtext

**Nebenbefund (eigener Bug):** Farbdivergenz — Hypnogramm nutzt `#3b4d8f` (`series-reader.js:104`), die Phasenbalken `var(--sleep)` (`ui.js:4763`). Dieselbe Phase in zwei Farben.

**Aufwand:** 2–3 h, rein additiv.

### P2-4 · Relative Datumsanzeige

`format-utils.js` hat `daysBetween`, `mondayKey`, `fmtRelTime` — aber **keinen Tages-Label-Formatierer**. `fmtRelTime` ist für Zeitstempel („vor 5 Min"), nicht für Kalendertage. Der zentrale `fmtDate` (`ui.js:367`) formatiert immer absolut.

Es existieren **drei divergente Ad-hoc-Lösungen**, die sich gegenseitig nicht kennen: `gmStandLbl()` (`ui.js:3879`), `gmLibCheckinSections` (`ui.js:6929`), Wochentagsname (`ui.js:2147`).

**Aufrufstellen:** `fmtDate(` 11× · direkte `toLocaleDateString` 29×. Davon sind **~12 echte Einzeltags-Anzeigen** (Kandidaten): `ui.js` 367, 2147, 2338, 3441, 3747, 3749, 3884, 4086, 4715, 6929 · `activity.js` 328/488 · `story.js` 102. Die restlichen ~17 sind Chart-Achsen, Wochenbereiche und Zieldaten — dort ist absolut korrekt.

**Fix:** Ein `F.dayLabel(dateKey, todayKey)` in `format-utils.js` (passt exakt zum dortigen Vertrag, ist bereits Node-getestet), das `heute` / `gestern` / `morgen` / Wochentagsname für die laufende Woche liefert und sonst `null` zurückgibt — Aufrufer fällt dann auf das absolute Datum zurück. `mondayKey` (Zeile 100) liefert die deutsche Wochenlogik schon. `fmtDate` (`ui.js:367`) ruft es zuerst auf → **11 Aufrufstellen ohne weitere Änderung erledigt**. Anschließend die drei Ad-hoc-Lösungen darauf umstellen.

**Aufwand:** 3–4 h inkl. Test in `supabase/tests/format_utils_test.mjs`.

### P2-5 · Bio-Feld

Repo-weite Suche nach `\bbio\b` liefert **exakt eine Stelle**: den Platzhaltertext `ui.js:7074`. Kein Bio-Feld in `profile-model.js`, `profile-store.js` (`MAPPED`, Zeile 14-18), `profileRepository.js`, den Migrations (`user_profiles` hat zuletzt `location` und `avatar_path` bekommen) oder `profile-center.js`.

**Der Platzhaltertext ist also inhaltlich korrekt.**

**Fix (vertikaler Durchstich, exakt dem 0016-Muster folgend):**
1. Migration `00XX_profile_bio.sql`: `alter table public.user_profiles add column if not exists bio text;`
2. `profile-store.js:14` `MAPPED` um `'bio'` erweitern; Lesen `:97`, Schreiben `:171`
3. `profile-center.js`: Textarea mit Längenlimit (z. B. 160 Zeichen)
4. `ui.js:7074`: `PROFILE.bio` rendern, sonst weiterhin ehrliches `—`

**Nebenbefund:** `.ig-handle` direkt darüber (`ui.js:7073`) ist ebenfalls fest auf `'—'` verdrahtet — gleiches Muster, gleiche Entscheidung nötig.

**Aufwand:** ~4 h inkl. Migration, Sync-Test, RLS-Prüfung.

---

## 7. P2 — Hardcodierte leere Slots (Auswahl der gravierendsten)

Alle folgenden Felder sind im ViewModel fest auf `null` verdrahtet. Die Renderer lesen sie, es gibt keinen Produzenten — der Slot zeigt **immer** „—".

| Bereich | Ort | Was der Nutzer sieht |
|---|---|---|
| **Dashboard → Ziel-Fortschritt** | `ui.js:4221` → `:4420` | Fortschrittsbalken **immer 0 %**, „Fortschritt: —" |
| **Profil → Zielkarten** | `ui.js:7031/7039/7219` | `goal-line` **immer `width:0%`** bei Haupt-, Mittel- und Langfristziel |
| **Plan → Tagesziele** | `ui.js:5164-5167` | 4 Kacheln (Schritte / kcal / Wasser / Schlaf) „— / —", 0 %-Balken |
| **Profil → Tagesziele-Editor** | `ui.js:5231-5235`, `:7235` | 4 Stepper mit **deaktivierten +/−** — reine Attrappe |
| **Plan → Planvariante A/B/C** | `ui.js:5177-5187` | Sektionsaktion heißt wörtlich „Noch nicht verfügbar"; alle vier Kennwerte „—" |
| **Plan → Planqualität** | `ui.js:5225-5226` | 6 Zellen hardcodiert „—" mit 0 %-Track — **obwohl `planQualityChecks()` läuft** und darunter eine echte Textnote liefert (`:5229`). Widersprüchliche Karte. |
| **Pre-Start-Sheet** | `ui.js:5899-5903` | 5 von 6 Zeilen hart „—" (Dauer, Distanz, Intensität, Ausrüstung, Wearable) |
| **Profil → Bestzeiten** | `ui.js:7416` | 3 Zeilen (21,1 km / 400 m Schwimm / 20 km Rad) hardcodiert `null` — zeigen „—" **auch bei perfekter Datenlage** |
| **Profil → Medaillen** | `ui.js:7444-7449` | 6 identische gesperrte Medaillen — komplette Attrappenseite |
| **Profil → Meilensteine** | `ui.js:7462-7473` | Selbst **mit** Daten sind `mile-track` (0 %) und `mile-meta` hardcodiert leer |
| **Profil → Einstellungen** | `ui.js:7102/7143-7157` | **9 Schalter**, die wie Toggles aussehen, aber `aria-disabled` sind |
| **Dashboard-Header → Glocke** | `ui.js:4640`, `index.html:119` | Immer sichtbar, Tap → „Benachrichtigungen · Noch nicht verfügbar" |
| **Kennzahlenbibliothek → Tagesumsatz** | `ui.js:6914` | `where:null,key:null` → immer „Kein Ernährungsvertrag" — **obwohl `nutrition.js` genau das berechnet** |
| **Analyse → Erholung „Zusammenhang"** | `ui.js:6613` | „keine kanonische Analyse", Empfehlung „—" |

**Toter Code zum Löschen:** `gmProfDash()` (`ui.js:7010`) — Funktion ohne Aufrufer. `batteryWord` (`ui.js:4227`) — syntaktisch immer `null`, von keinem Renderer gelesen. `#readyOut`/`#ampelOut`-Renderer (`ui.js:1257/1280`) — Hosts sind `display:none`.

---

## 8. P3 — Release-Blocker und Kosmetik

| Befund | Ort | Bewertung |
|---|---|---|
| **Rechtstexte sind Platzhalter** | `js/orvia-pro.js:257` | Impressum, Datenschutzerklärung, Nutzungsbedingungen, Cookie-Einstellungen sind **alle derselbe Platzhaltertext** — im Code selbst als solcher markiert (`:212`). **Harter Release-Blocker**, redaktionell/juristisch zu lösen |
| **Geräte-Verbindung ohne Connect-Flow** | `js/profile.js:1578` | Karten für Garmin/Strava/Apple Health zeigen Status, haben aber **nur „Trennen"** — es existiert kein OAuth-Flow im gesamten Frontend. Aufwand hoch |
| **Veralteter Garmin-Text** | `js/profile.js:1577` | „vorbereitet, aber aktuell noch nicht verfügbar" widerspricht dem seit GM7.5 produktiven „Jetzt synchronisieren" (`ui.js:7262-7350`) |
| **Hardcodiertes Testnutzer-Alter** | `js/supplements.js:26` | „bei dir (**22, gesund**) kein erkennbarer Vorteil" — sichtbar für **jeden** Anwender |
| **Falsche Sheet-Benennung** | `js/activity.js:736-747` vs. `ui.js:5433` | Button „Verbindungen & Import", Sheet enthält nur Import |
| **Free/Pro-Vergleichstabelle** | `index.html:385-388` | Unerreichbar; nennt Features als „Pro", die entweder frei sind oder gar nicht existieren („Season Planner", „Energy Planner") |
| **Light Mode** | — | Vollständige Überarbeitung ausstehend. **Bewusst zurückgestellt** bis Dark Mode funktional vollständig ist |

---

## 9. Sonderkapitel: Trainingsengine

Dies ist das Kernprodukt und der Bereich mit der größten Diskrepanz zwischen gebauter Substanz und Nutzerwert.

### 9.1 Ladezustand

`index.html:497-502` lädt **6** Engine-Dateien, `sw.js:10` cacht dieselben 6. Es existieren **15**.

**Im Browser nicht vorhanden** (fehlen in `index.html` **und** `sw.js`):
`goal-portfolio.js` (634 Z.) · `running-capacity-factory.js` (832 Z.) · `scheduler-input-factory.js` · `scheduler-goal-allocation.js` · `scheduler-v1.js` · `knowledge/knowledge-contracts.js` (675 Z.) · `knowledge/knowledge-sources.js` · `knowledge/running-knowledge-pack.js` (464 Z.) · `knowledge/sport-coverage-matrix.js`

Exhaustive Suche über alle `*.js`/`*.html` außerhalb `js/engine/` und `supabase/tests/`: **null Treffer** für `planEngineV2`, `goalPortfolio`, `runningCapacityFactory`, `schedulerV1`, `schedulerInputFactory`, `schedulerGoalAllocation`, `knowledgeContracts`, `knowledgeSources`, `runningKnowledgePack`, `sportCoverageMatrix`.

### 9.2 Der einzige Laufzeit-Einstiegspunkt

```js
// js/ui.js:1241
try{if(t&&window.ORVIA&&window.ORVIA.engineShadow)window.ORVIA.engineShadow.run();}catch(e){}
```

Der Kommentar eine Zeile darüber sagt es selbst: „**steuert NIE die Anzeige**".

`shadow-runner.js` liest die v1-Entscheidung, baut den v2-Input, ruft `decisionEngineV2.evaluate` und schreibt einen Diff `{v1, v2, agree, missing}` in `localStorage` (Ringpuffer 90 Einträge). Ausgabe nur über Konsole (`ORVIA.engineShadow.report()`). Gate-Kriterium: `gateReady: withBoth.length >= 14`.

Das Fail-closed-Verhalten ist korrekt: fehlt der Resolver, wird `BLOCKED` protokolliert statt optimistisch GREEN.

**Nebenbefund (im Code selbst dokumentiert, `shadow-runner.js:46-48`):** Der Lauf feuert bei **jedem** Öffnen des Heute-Tabs, rechnet die volle 28-Tage-Last-Schleife neu und liest/schreibt den localStorage-Log jedes Mal — obwohl ein Eintrag je Tag genügen würde. Reiner Performance-Verlust ohne Nutzerwert.

### 9.3 Was den produktiven Pfad steuert

| Sichtbares Ergebnis | Tatsächliche Quelle |
|---|---|
| Wochenplan | `ui.js:159 generateWeekPlan()` — Heuristik über Sport-Flags × Zieltyp × Level, hartcodierte Session-Templates (`ui.js:181-189`) |
| Wochenziele | `ui.js:363 WEEK_TARGETS = [['Laufen',3],['Schwimmen',2],['Gym',4],['Rad',2]]` — **nutzerunabhängige Fixwerte** |
| Tagesentscheidung | `calc.js:1193 buildTrainingDecision()` |

### 9.4 Strukturelle Stubs (kein unfertiger Code, sondern bewusst leer)

- `scheduler-v1.js:91-92` setzt `proposal: null` für **jeden** Slot, Reason-Code wörtlich `'s1_no_selection_yet'`. Zeile 179 gibt `plannedSessions: []` **immer leer** zurück. Zeile 63-66 lehnt jeden Input ab, dessen `activationMode !== 'shadow_only'` — das Modul **kann** produktiv gar nicht laufen.
- `scheduler-input-factory.js:24`, `scheduler-goal-allocation.js` pinnen ebenfalls `'shadow_only'`
- `running-capacity-factory.js:59` pinnt `mode: 'shadow'`; Zeile 813 liefert `quantitativePrescription: null`
- `goal-portfolio.js:607` liefert `capacity: null`

### 9.5 Sportartenabdeckung

24 deklarierte Sportarten (`sport-coverage-matrix.js:39-67`). Realer Reifegrad:

| Dimension | erfüllt |
|---|---|
| `onboardingSelectable` | 24 |
| `activityTrackingSupported` | 16 |
| `profileSchema` | 6 |
| `positionRoleModel` | 2 |
| `exerciseLibrary` | 1 (gym) |
| **`knowledgePack`** | **1 (running)** |
| **`plannerSupport`** | **0** |
| **`safetyReview`** | **0** |
| **`productionStatus`** | **0 — alle `'none'`** |

Packs für Radfahren, Schwimmen, Krafttraining: **existieren nicht.**

**Verschärfend:** Auch das eine Pack ist nicht freigegeben. `running-knowledge-pack.js:51` setzt für jede Regel `scientificReviewStatus: 'unreviewed'`, Zeile 52 `medicalSafetyReviewStatus: 'required_unreviewed'`. Der Selektor `knowledge-contracts.js:595-597` schließt im `mode: 'production'` **jede** Regel ohne `'approved'` aus. Konsequenz: **würde man die Wissensbasis heute produktiv schalten, lieferte sie null Regeln.** Deshalb ist `running-capacity-factory.js:59` fest auf `shadow` gepinnt.

### 9.6 Konkrete Blocker für eine funktionierende Plangenerierung

| # | Blocker | Beleg |
|---|---|---|
| E-1 | **Scheduler-Kette im Browser nicht existent.** `scheduler-goal-allocation.js:82-83` failt hart mit `SCHEDULER_GA_PORTFOLIO_MODULE_MISSING`, wenn `ORVIA.goalPortfolio` fehlt — was garantiert der Fall ist | s. 9.1 |
| E-2 | **Kein Session-Selektor.** Weder `scheduler-v1` noch `plan-engine-v2` wählen eine konkrete Einheit. `plan-engine-v2.js:111` erzeugt nur `{sport, intensity:'easy'\|'hard', minutes, note}` — kein Workout, keine Struktur, keine Übungen | Stufen S4 (Constraint Solver) und S5 (Session Prescription) laut `docs/SCHEDULER-S0-CONTRACT.md:354-355` nicht gebaut |
| E-3 | **Kein Kapazitäts-Adapter (S3).** Zwischen `goal-portfolio` (`capacity: null`) und `running-capacity-factory` (`quantitativePrescription: null`) fehlt der Adapter `dailyLoadSeries → capacity.perSport.running` | `SCHEDULER-S0-CONTRACT.md:353` |
| E-4 | **Aktivierungsgates blockieren by design.** Drei Module lehnen alles außer `shadow_only` aktiv ab | `scheduler-v1.js:63-66` |
| E-5 | **Wissensbasis liefert produktiv 0 Regeln.** Ohne freigegebene Regeln kann S5 keine Dauer/Distanz/Intensität ableiten, ohne Scheingenauigkeit zu erzeugen | s. 9.5 |
| E-6 | **Zwei Sources of Truth ohne Ablösepfad.** `generateWeekPlan` (LIVE) ↔ `plan-engine-v2` (shadow); `buildTrainingDecision` (LIVE) ↔ `decision-engine-v2` (shadow); Kapazität sogar dreifach | `SCHEDULER-S0-CONTRACT.md:70-81` |
| E-7 | **Kanonische Verfügbarkeitsfelder werden vom LIVE-Pfad ignoriert.** `availability.days[d].restDay` und `fixedCommitments[]` sind kanonisch in `profile-model.js`, werden von `generateWeekPlan` aber nicht gelesen. Der Scheduler-Stub liest sie (`scheduler-v1.js:81,97`) — nur läuft er nicht | `SCHEDULER-S0-CONTRACT.md:80` |
| E-8 | **Keine Endurance-Session-Templates in der DB.** `0003_training_domain.sql:108-124` definiert `workout_templates/_days/_exercises` — gym-orientiert. Für Lauf/Rad/Schwimm existiert kein Template-Modell; `ui.js:357 PLAN_PRESETS` ist eine hartcodierte Frontend-Liste | |

### 9.7 Testlage — grün heißt hier nicht „funktioniert"

186 Testdateien; jedes Engine-Modul hat mindestens eine. Aber:

1. **Kein Integrationstest prüft, ob Engine-Output je den Nutzer erreicht.** `engine_v2_test.mjs` ruft `PE.build()` 9× auf — das UI 0×. Ein Test „`plan-engine-v2` ist verdrahtet" existiert nicht und würde heute fehlschlagen.
2. **Kein Test schützt die Ladbarkeit der 9 unverdrahteten Module.** Bricht `goal-portfolio.js` im Browser, merkt es niemand — es lädt ja nicht.
3. **Die Tests zementieren den Stub-Zustand statt ihn zu melden.** `engine_s1_scheduler_skeleton_test.mjs:109` assertet explizit `plannedSessions.length === 0 && slots.every(s => s.proposal === null)`. `batch3b0_knowledge_test.mjs:502` assertet `plannerSupport === false && productionStatus === 'none'` für **alle** Sportarten. Grün bedeutet hier „ist korrekt leer", nicht „funktioniert".
4. **Ungetestet:** Verhalten der Wissensauswahl im `production`-Modus (der Pfad, der 0 Regeln liefert) und der Übergang shadow → live.

### 9.8 Doku-Drift

`docs/SCHEDULER-S0-CONTRACT.md` beschreibt die Lage inhaltlich korrekt, aber **alle Zeilenangaben sind veraltet**: `ui.js:54 generateWeekPlan` → tatsächlich `159` · `ui.js:224 activeWeekPlan` → `329` · `ui.js:1913 renderWeekPlan` → `2375` · `calc.js:962 buildTrainingDecision` → `1193` · `index.html Z. 465-470` → `497-502`.

---

## 10. Empfohlene Reihenfolge

### Phase 1 — Vertrauen herstellen (1 Tag)
Alle P0. Der Hero-CTA muss funktionieren, bevor irgendetwas anderes angefasst wird. Fünf der acht Punkte sind Einzeiler.

### Phase 2 — Belastungssteuerung fertigstellen (2–3 Tage)
P1-1 (Sportart, reine Verdrahtung) → P1-2 Stufe 1 (RPE-Proxy, ehrlich beschriftet) → P1-3 (TRIMP mit `avgHr`-Durchleitung) → P1-5 (`easyShare`-Verzerrung). Entscheidung zu P1-6 (Repository nutzen oder entfernen).

### Phase 3 — Unerreichbares wieder anbinden (2–3 Tage)
Die elf Features aus Kapitel 5 als Block. Höchster Nutzen pro Aufwand im gesamten Backlog — die Arbeit ist bereits bezahlt.

### Phase 4 — Gemeldete Bugs (1–2 Tage)
P2-1 (Muskelvolumen) → P2-2 (Layout) → P2-3 (Hypnogramm) → P2-4 (Datumsformat) → P2-5 (Bio).

### Phase 5 — Trainingsengine aktivieren (mehrwöchig)
In dieser Reihenfolge, jede Stufe einzeln verifizierbar:
1. Die 9 fehlenden Module in `index.html` + `sw.js` aufnehmen; Ladbarkeitstest ergänzen
2. Wissenschaftlichen Review des `running-knowledge-pack` durchführen → `scientificReviewStatus: 'approved'` (**ohne diesen Schritt liefert die Engine produktiv null Regeln**)
3. Kapazitäts-Adapter S3 bauen (`dailyLoadSeries → capacity.perSport`)
4. Constraint Solver S4 (`availability.days[].restDay`, `fixedCommitments[]`)
5. Session Prescription S5 + Endurance-Template-Modell in der DB
6. Shadow-Gate auswerten (`gateReady` bei ≥14 Vergleichstagen), dann `generateWeekPlan` ablösen
7. Packs für Radfahren, Schwimmen, Krafttraining — jeweils mit eigenem Review

### Phase 6 — Release-Vorbereitung
Rechtstexte (harter Blocker) · Geräte-OAuth · Light Mode · Free/Pro-Tabelle bereinigen

---

## 11. Was NICHT angefasst werden sollte

- **Die 86 `GM_NA`-Vorkommen pauschal ersetzen.** Der überwiegende Teil ist bewusste Ehrlichkeit und funktioniert korrekt (Kategorie DATENLEER). Nur die in Kapitel 7 gelisteten hardcodierten Slots sind echte Probleme.
- **Die GATED-Features „öffnen".** Die Level-Staffelung (`a`/`f`/`p`) ist ein durchdachter Vertrag, kein Versehen.
- **Light Mode vor Phase 5.** Doppelte Arbeit an jedem Element, das ohnehin noch geändert wird.
- **Der Trainingsengine mit Teillösungen begegnen.** Die Shadow-Architektur ist sauber gebaut und fail-closed. Ein „schneller Durchstich" würde genau die Scheingenauigkeit erzeugen, die der Code aktuell diszipliniert vermeidet.

---

## 12. Offene Entscheidungen

| # | Frage | Optionen |
|---|---|---|
| 1 | **Kennzahlenbibliothek: leere Kacheln** | (a) alle 46 zeigen · (b) mit „X weitere ohne Wert" zusammenfassen |
| 2 | **Profil-Werte als Metrik-Fallback** | HFmax/Gewicht/Ruhepuls aus dem Profil nutzen, wenn Gerätedaten fehlen — gekennzeichnet als Quelle „Profil"? |
| 3 | **`trainingLoadRepository` Read-Pfad** | nutzen (Sportart-Dimension in `getDailyLoad`) oder entfernen |
| 4 | **`.mile` Margin** | global korrigieren (Regressionsrisiko `styles.css:3094-3108`) oder nur `#gmAna` überschreiben |
| 5 | **Hochintensiv-Definition** | RPE-Proxy jetzt · oder auf echte HF-Zonen warten (Worker-Änderung) |
