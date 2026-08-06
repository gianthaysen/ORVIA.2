# ORVIA — Umsetzungsplan nach Gap-Analyse

**Stand:** 2026-08-02 · Basis: v8-219 · Grundlage: `docs/GAP-ANALYSE-2026-08.md`
**Leitsatz:** Nicht möglichst viele Punkte abhaken, sondern **jeden sichtbaren Pfad bis zu einem realen, getesteten Endzustand durchziehen.**

---

## 0. Korrigierte Problemdefinition

ORVIA hat **kein primäres Feature-Defizit, sondern ein Integrations-, Produktwahrheits- und Priorisierungsdefizit.** Viel Funktionalität existiert, aber der sichtbare Produktpfad umgeht sie. Gleichzeitig präsentiert die Oberfläche Attrappen und dauerhaft leere Slots — die App wirkt unreifer, als der Codebestand ist.

**Der kritischste Satz des Audits:**
> Der sichtbare Wochenplan stammt aus einer hartcodierten Heuristik mit nutzerunabhängigen Zielwerten.

Solange das gilt, ist ORVIA funktional ein hochwertiges Trainingsdashboard mit regelbasierten Empfehlungen — **keine adaptive Trainingsplattform.**

### Reifegrad

| Dimension | Bewertung |
|---|---:|
| Datenmodelle und Berechnungsgrundlagen | 70–80 % |
| sichtbare Kernfunktionen | 45–55 % |
| Verdrahtung und Navigation | 40–50 % |
| Trainingsplanung | 15–25 % |
| Trainingsengine produktiv | 0–5 % |
| Produktwahrheit der UI | 45–55 % |
| technische Release-Reife | 30–40 % |
| rechtliche Release-Reife | 0 % |

---

## 1. Vier Präzisierungen (Code-verifiziert)

### 1.1 ⚠️ Regelkonflikt: „Kein Bedienelement ohne Endzustand" vs. „Struktur schrumpft NIE"

Die Regel **„Kein sichtbares Bedienelement ohne funktionierenden, getesteten Endzustand"** kollidiert mit einem bestehenden **verbindlichen** Vertrag:

> `docs/GOLDEN-MASTER-MAPPING.md:47` — „**KORRIGIERT (verbindlich): Struktur schrumpft NIE — Slots bleiben, Inhalte werden ehrlich**"
> Referenziert in `js/ui.js:3863` und `js/ui.js:6830`.

Zusätzlich prüfen **sechs Golden-Master-Paritätstests** (`tools/gm1_parity.mjs` … `gm6_parity.mjs`) genau diese Struktur. Ein pauschales Entfernen leerer Slots lässt diese Tests fehlschlagen und erzeugt Layout-Sprünge, sobald Daten eintreffen.

**Auflösung — die Regel gilt für *interaktive Bedienelemente*, nicht für *Anzeigeslots*:**

| | Behandlung | Begründung |
|---|---|---|
| **Interaktives Element ohne Endzustand**<br>Button, Toggle, Stepper, Drag-Griff, Variantenwähler | **entfernen oder unsichtbar** | Verspricht eine Handlung, die nicht existiert. Kein Ehrlichkeitsgewinn, nur Vertrauensverlust. |
| **Anzeigeslot ohne Wert**<br>Metrikkachel, Fortschrittsspur, Kennzahlfeld | **bleibt, zeigt ehrliches `—` + Grund** | Vertragskonform, testgedeckt, kein Layout-Sprung, kommuniziert korrekt „Wert fehlt" statt „Feature fehlt". |

Damit bleibt deine Absicht vollständig erhalten — sie wird nur an der richtigen Kante geschnitten.

### 1.2 ⚠️ Die Check-in-Reaktivierung ist keine Navigationsänderung, sondern eine Verhaltensänderung

`js/checkin-extra.js` schreibt `DB[date].live|pre|post` und **fließt in `buildTrainingDecision()` ein**. Ein Einstiegspunkt macht das Feature also nicht nur sichtbar — er **verändert die Tagesempfehlung** für alle Bestandsnutzer, die es nie gesehen haben.

**Konsequenz:** Dieser eine Punkt gehört nicht in die Kategorie „Einstiegspunkt ergänzen", sondern braucht einen eigenen Ablauf:
1. Shadow-Vergleich der Entscheidung mit/ohne Extra-Check-in über ≥14 Tage (die Infrastruktur dafür existiert: `js/engine/shadow-runner.js`)
2. Erst bei nachgewiesen sinnvoller Wirkung aktivieren
3. Bestandsnutzer sehen die Änderung erklärt, nicht überraschend

### 1.3 ⚠️ `trainingLoadRepository`: Die geschriebenen Daten wurden nie gelesen — also nie validiert

Zustimmung zur Entscheidung („nutzen, nicht entfernen"), aber mit einer vorgeschalteten Stufe.

Die Schreibpfade sind seit Langem produktiv (`js/workout-store.js:257`, `js/ui.js:1907`, `js/migrate-blob.js:106`). Die Lesepfade haben **null Konsumenten**. Es liegen also Daten in der Tabelle, die **nie jemand geprüft hat**. Sie ohne Audit zum kanonischen Read-Modell zu erklären, verlagert unbekannte Datenqualität direkt in die Belastungssteuerung.

**Zwei konkrete Abweichungen zum vorgeschlagenen Rückgabeobjekt:**

- **`intensity` speichert Ø-Herzfrequenz, keine Kategorie.** `trainingLoadRepository.js:22` schreibt `intensity: s.hr != null ? s.hr : null`, DB-Typ `numeric` (`0002_core_data_foundation.sql:196`). Das vorgeschlagene `byIntensity: {easy, moderate, hard}` existiert nicht und braucht **zuerst einen Ableitungsvertrag**: aus RPE? aus HF-%-HFmax? Beide Wege sind vertretbar, aber die Entscheidung muss dokumentiert und stabil sein — sonst entsteht eine dritte Intensitätsdefinition neben `intensityHard` (RPE ≥ 7, `activity-config.js:549`) und `easyShare` (65–78 % HFmax, `calc.js:650`).
- **Die Tabelle ist reicher als angenommen:** `session_rpe` und `computed_load` existieren bereits als Spalten (`0002_core_data_foundation.sql:197-198`). `bySport` und `completeness` sind damit ohne Schemaänderung ableitbar — `byIntensity` nicht.

**Reihenfolge:** Datenqualitäts-Audit → Ableitungsvertrag für Intensität festschreiben → dann kanonisches Read-Modell.

### 1.4 ✅ Planpersistenz existiert bereits — und genau das ist das Problem

Deine Forderung nach einem kanonischen Persistenzmodell ist richtig, aber die Aufgabe ist eine andere als „Persistenz ergänzen":

`PROFILE.weekPlan` **wird persistiert** und von **zwei Quellen ohne jede Unterscheidung** beschrieben:
- **Engine-Anpassung:** `ui.js:911` — `PROFILE.weekPlan = d.weekPlanAdjusted.map(...)`
- **Manuelle Bearbeitung:** `ui.js:2552 savePlanEdit()` — `PROFILE.weekPlan = JSON.parse(JSON.stringify(_planEdit))`

**Manuelle Overrides werden also bereits heute still von Engine-Anpassungen überschrieben** — ohne Historie, ohne Provenienz, ohne Undo über `_planUndo` hinaus.

**Konsequenz:** Die Aufgabe heißt „ein konflatiertes Feld in ein versioniertes Modell mit Provenienz aufspalten" **plus Migration der Bestandspläne**, nicht „Persistenz bauen". Das ist deutlich mehr Arbeit als es klingt und gehört zwingend **vor** die Engine-Aktivierung.

### 1.5 ⚠️ Korrektur nach Phase-0-Ausführung: Die Golden-Master-Parität ist NICHT testgedeckt

Ursprüngliche Annahme war, die Baseline-Werkzeuge existierten einsatzbereit. Der tatsächliche Lauf zeigt ein differenzierteres Bild:

| Werkzeug | Zustand |
|---|---|
| `tools/real_app_smoke.mjs` | ✅ lauffähig — **74/74** gegen die echte App |
| `tools/collision_scan.mjs` | ✅ lauffähig — 80 Skripte, keine Kollision |
| `supabase/tests/` (186 Dateien) | ✅ **178 grün**, 8 Fehlschläge — **davon 0 Codedefekte** (6× fehlendes npm-Paket/Credentials, 2× fehlende `/tmp`-Fixture) |
| `tools/gm1_parity.mjs` … `gm6_parity.mjs` | ❌ **nicht lauffähig** |

**Die sechs Paritätstools vergleichen gegen Golden-Master-Fixtures in `/tmp`** (`/tmp/orvia_dashboard_5.html`, `/tmp/gm4h.html`, `/tmp/gm6h.html`). Diese Dateien liegen **nicht im Repo** und existieren in der Umgebung nicht.

**Konsequenz für 1.1:** Die Regel „Struktur schrumpft NIE" (`docs/GOLDEN-MASTER-MAPPING.md:47`) ist derzeit **nur dokumentiert, nicht geschützt**. Die in 1.1 angeführte Testabdeckung als Argument gegen pauschales Slot-Entfernen besteht faktisch nicht.

**Das blockiert Phase 1b.** Vor dem Entfernen der Attrappen ist zwingend eines von beidem nötig:
- die Golden-Master-Fixtures wiederherstellen und ins Repo aufnehmen, **oder**
- einen eigenständigen Struktur-Regressionstest schreiben, der die Slot-Struktur unabhängig von den GM-Fixtures sichert

Erfasst als **KF-013** in `baseline/known-failures.json`.

**Fallstrick bei der Smoke-Ausführung, dokumentiert:** `real_app_smoke.mjs` verlangt einen **absoluten** `appRoot`. Bei relativem Pfad (`.`) schlägt der Pfad-Guard (`f.startsWith(APP)`, Zeile 78) fehl, der Server liefert für jede Datei 404, und der Lauf meldet **48 Fehlschläge, die nicht existieren**. Genau so eine Fehlmessung hätte als „Baseline-Verhalten" eingefroren werden können.

---

## 2. Verbindliche Reihenfolge

```
0  Bestand einfrieren
1  Kernaktionen + Attrappen entfernen
2  Belastungssteuerung verdrahten
3  Bestehende Funktionen kontextuell integrieren
4  Sichtbare Qualitätsmängel
5  Kanonisches Load- und Plan-Datenmodell
6  Engine-Verträge und Reviews
7  Scheduler + Session Prescription
8  Shadow → Canary → Live
9  Weitere Sportarten
10 Recht, OAuth, Light Mode
```

**Nicht verhandelbar:** Phase 5 vor Phase 7. Ein Scheduler ohne kanonisches Plan-Datenmodell erzeugt einen vierten parallelen Datenpfad.

---

## Phase 0 · Bestand einfrieren — ✅ ABGESCHLOSSEN

**Ziel:** Verhindern, dass beim Reparieren der Verdrahtung funktionierende Legacy-Pfade verloren gehen.

**Leitsatz:** Die Baseline dokumentiert, **was aktuell passiert** — sie bestätigt **nicht**, dass der Zustand fachlich korrekt ist.

### Artefakte

```
baseline/
├── environment.json          Laufzeit, Manifest-Hash, 345 Dateien mit SHA-256
├── structural-parity.json    collision_scan + Testsuite + Paritäts-Status
├── smoke-results.json        74 Assertions einzeln, mit Aufrufhinweis
├── known-failures.json       14 bekannte Defekte (KF-001 … KF-014)
├── action-reachability.json  Live-Probe der Aktions-Erreichbarkeit
└── screenshots/              11 Screenshots der fünf Hauptbereiche
```

**Kein Git im Arbeitsverzeichnis** — der Live-Repo-Klon liegt separat. Das Einfrieren erfolgt über `manifest.sha256` je Datei (Manifest-Hash `10679734…46d9b3`, 345 Dateien). **Beim nächsten Upload ins Repo ist zusätzlich der Tag `v8-219-audit-baseline` zu setzen.**

### `known-failures.json` — der wichtigste Teil

Verhindert, dass ein späterer Test einen bekannten Defekt als erwünschtes Baseline-Verhalten schützt.

**Vertrag:** *Jeder Test, der eines dieser Verhalten als Soll-Zustand assertiert, ist falsch und muss abgelehnt werden.*

| ID | Schwere | Phase | Titel |
|---|---|---|---|
| KF-001 | critical | 1a | Hero-CTA „Training starten" ohne Endzustand |
| KF-002 | critical | 1a | FAB „Training starten" ohne Endzustand |
| KF-003 | critical | 1a | Workout fortsetzen ohne Endzustand |
| KF-004 | high | 2 | Belastungskennzahlen dauerhaft leer |
| KF-005 | high | 4 | Muskelkarte: Fehlklassifikation als Fehler |
| KF-006 | medium | 1a | Muskelkarten-Retry ohne Wirkung |
| KF-007 | high | 1b | Sichtbare Attrappen ohne Endzustand |
| KF-008 | high | 0 | `runAction()` meldet Erfolg für nicht aufgelöste Ziele |
| KF-009 | medium | 1a | Pace-Rechner-Widerspruch |
| KF-010 | medium | 2 | `easyShare` für Garmin-Läufe verzerrt |
| KF-011 | high | 5 | `PROFILE.weekPlan` konflatiert Engine und Override |
| KF-012 | critical | 10 | Rechtstexte sind Platzhalter |
| KF-013 | medium | 0 | Golden-Master-Parität nicht testgedeckt |
| KF-014 | low | 1c | Hardcodiertes Testnutzer-Alter im Supplement-Lexikon |

KF-003 trägt zusätzlich die **Testanforderung**: Der entscheidende Nachweis ist *nicht* „`open()` wurde aufgerufen", sondern **„Ein gestartetes Workout kann nach Schließen der Oberfläche ohne Datenverlust wieder aufgenommen werden"** — über sechs Zustände (kein aktives Workout / Overlay offen / Overlay geschlossen / nach Tabwechsel / nach PWA-Reload / staler State).

### Live-Befund der Aktions-Erreichbarkeit

`tools/probe_actions_live.mjs` gegen die echte App:

```
Aktionen gesamt      : 13
  auflösbar          : 13
  nicht auflösbar    : 0
  still tot          : 2
Tabbar-Tabs          : heute, plan, akt, dash, mehr
data-tab="training"  : FEHLT
  · training_start    -> orvia:workoutUI.openTrainingTab  [still tot]
  · training_continue -> orvia:workoutUI.openTrainingTab  [still tot]
```

**Beide toten Kernaktionen zeigen auf denselben Entry-Point.** Eine reine Auflösbarkeitsprüfung sieht das nicht — der Handler existiert, er trifft nur intern auf ein fehlendes DOM-Ziel und liefert `undefined`.

### Ergebnisvertrag statt `true`/`false`

`runAction()` meldete bisher nur boolesch und **verlor damit die Ursache**. Genau das hat KF-001…003 dauerhaft unsichtbar gemacht: `!!fn` ist `true`, sobald der Entry-Point *auflösbar* ist.

**Umgesetzt** in `js/quick-actions.js`:

```js
runActionEx(id) -> {
  handled: Boolean,
  action:  String,
  reason:  'handled' | 'target_unavailable' | 'handler_missing'
         | 'handler_failed' | 'blocked' | 'invalid_action',
  error:   Error | null,
  target:  String | null,
  at:      Number
}
```

Zusätzlich: `onActionResult(fn)` (Beobachter mit Abmeldefunktion), `getActionLog()` (Ringpuffer, 50), `probeActions()` (statische Probe, führt nichts aus).

**Drei bewusste Entscheidungen:**

1. **`runAction()` bleibt bitgenau boolesch.** `supabase/tests/quick_actions_b_test.mjs:100` assertiert `ran === true`. Ein Objekt wäre truthy und hätte den Fehlerfall stillschweigend in einen Erfolgsfall verwandelt — genau der Fehlerklasse, die wir gerade beheben.
2. **Kein Toast in dieser Schicht.** Sie löst Aktionen fachlich auf; UI-Nebenwirkungen würden Tests und programmgesteuerte Aufrufe koppeln. Der zentrale Dispatcher abonniert stattdessen `onActionResult`.
3. **`undefined` bleibt `handled`.** Nur ein *explizites* `false` gilt als Misserfolg. Alles andere wäre ein Verhaltensumbau bestehender Handler — in Phase 0 unzulässig.

### ⚠️ Reichweite von `runActionEx()` — was es erkennt und was nicht

Das ursprüngliche Phase-0-Ziel lautete: *„Eine tote Aktion erzeugt ab jetzt ein sichtbares oder maschinell erfassbares Signal."* Das ist **nur teilweise erreicht** und muss präzise benannt werden:

| | |
|---|---|
| **Erkennt** | Dispatch-Fehler: `target_unavailable`, `handler_missing`, `handler_failed` (Ausnahme oder explizites `false`), `blocked`, `invalid_action` |
| **Erkennt NICHT** | **Semantisch erfolglose Handler.** Ein auflösbarer Handler, der intern auf ein fehlendes Ziel trifft und `undefined` liefert, gilt weiterhin als `handled`. |
| **Folge** | **KF-001 und KF-003 bleiben bis Phase 1 erwartete bekannte Fehler.** Beide zeigen auf `orvia:workoutUI.openTrainingTab`; die Tabbar führt `heute/plan/akt/dash/mehr` — `data-tab="training"` existiert nicht. |
| **Für echte End-to-End-Erkennung nötig** | entweder ein **Action-Outcome-Vertrag** (Handler melden ihren fachlichen Endzustand) oder ein **Browser-Interaktionstest**. Die statische Näherung liefert heute `tools/probe_actions_live.mjs` über das Feld `silentlyDead`. |

Der Vertragstest hält diese Grenze ausdrücklich als eigene Assertion fest, damit sie nicht stillschweigend als erwünschtes Verhalten gelesen wird.

### KF-013 aufgelöst — repo-interner Strukturvertrag statt /tmp-Rekonstruktion

Die flüchtigen Golden-Master-Fixtures wurden **bewusst nicht rekonstruiert**. Stattdessen ein semantischer, eingecheckter Vertrag:

| Artefakt | Zweck |
|---|---|
| `docs/gm-ref/structure-contract.json` | eingecheckter Vertrag: 5 Tabs, 8 GM-Hosts, 20 Anzeigeslots |
| `tools/build_structure_contract.mjs` | Generator aus der echten App |
| `supabase/tests/gm_structure_contract_test.mjs` | schützt Bereiche und Anzeigeslots (20/20) |
| `supabase/tests/hidden_legacy_hosts_test.mjs` | inventarisiert 9 versteckte Legacy-Hosts, 6 ohne Ersatzpfad (32/32) |

**Vertragsregeln:**

- erforderliche GM-Bereiche müssen existieren (stabile IDs)
- erforderliche Anzeigeslots müssen erhalten bleiben
- ein Slot **darf** leer sein und `—` oder einen ehrlichen Grund zeigen
- ein Slot darf **nicht** 0 oder einen Schätzwert als Messung ausgeben
- funktionslose interaktive Elemente **dürfen** verschwinden — sie sind nicht Teil des Vertrags
- keine Abhängigkeit von `/tmp`, Downloads oder externen Harness-Dateien

**Negativkontrolle bestanden:** Ein fiktiver Pflicht-Slot im Vertrag lässt den Test mit `VERSCHWUNDEN: Belastung nach Sportart` fehlschlagen. Der Test kann fehlschlagen — er beweist etwas.

Die sechs `gm*_parity.mjs` sind mit einem `VERALTET`-Kopf und Verweis auf den Ersatz markiert; kein Codepfad wurde verändert. Sie bleiben als Referenz für die pixelnahe Prüfung und sind reaktivierbar, sobald die Fixtures eingecheckt sind.

**Restrisiko, offen benannt:** Die Slot-Anker sind Sektionslabel-**Texte**. Eine reine Textänderung bricht den Vertrag, ohne dass Struktur verloren ging. Härtung: `data-slot`-Attribute in den Renderern — bewusst **nicht** in Phase 0, weil das `js/ui.js` berühren würde.

### Git-Versiegelung

| | |
|---|---|
| Repo | `github.com/gianthaysen/ORVIA.2` (lokaler Klon) |
| Baseline-Commit | `48ee0f4` — v8-219 Codestand + Baseline-Artefakte |
| Tag | `v8-219-audit-baseline` |
| Beweis | **326 Dateien bitgenau identisch** mit `baseline/environment.json` (sha256 je Datei, 0 Abweichungen) |
| `js/quick-actions.js` | `5c992e5a…0444f880` — Stand **vor** der Instrumentierung |
| Löschungen | keine |
| Push | **nicht erfolgt** — nur lokal committet und getaggt |

Die instrumentierte Fassung wurde zur Verifikation **zurückgebaut** und ihr sha256 gegen das Manifest geprüft, bevor der Baseline-Commit entstand. Damit ist belegbar, dass die 74/74 gegen den unveränderten v8-219 gemessen wurden.

### Regressionsnachweis

| Prüfung | Baseline | Nach Phase 0 |
|---|---|---|
| `real_app_smoke.mjs` | 74/74 | **74/74** |
| `collision_scan.mjs` | OK, 80 Skripte | **OK, 80 Skripte** |
| Testsuite | 178/186 | **181/189** (+3 neue Tests) |
| Umgebungsbedingte Fehlschläge | 8 | **8, identische Menge** |
| `quick_actions_b_test.mjs` | 21/21 | **21/21** |
| `action_result_contract_test.mjs` | — | **23/23 (neu)** |
| `gm_structure_contract_test.mjs` | — | **20/20 (neu)** |
| `hidden_legacy_hosts_test.mjs` | — | **32/32 (neu)** |

Dokumentiert in `baseline/phase0-verification.json`. Das ist **keine neue Baseline** — die Baseline bleibt an den Tag `v8-219-audit-baseline` gebunden.

### Definition of Done

- [x] Baseline erfasst, versiegelt und getrennt von bekannten Defekten geführt
- [x] Fehlmessung (relativer `appRoot`) erkannt und **nicht** als Baseline übernommen
- [x] Baseline im echten Git-Repo committet und getaggt, Unverändertheit bitgenau belegt
- [x] `hidden_legacy_hosts_test.mjs` — 9 Hosts inventarisiert, 6 ohne Ersatzpfad
- [x] KF-013 aufgelöst durch repo-internen Strukturvertrag, Negativkontrolle bestanden
- [x] Reichweite von `runActionEx()` präzise dokumentiert
- [x] Vollständiger Durchlauf nach allen Änderungen, keine Regression
- [x] Keine P0-Reparatur vorgezogen
- [ ] Push ins Remote — **bewusst offen**, erfolgt erst auf ausdrückliche Freigabe

**Phase 0 ist abgeschlossen. Phase 1 kann beginnen.**

> **Auflage für den ersten Phase-1-Commit:** ausschließlich KF-001 bis KF-003 reparieren, damit die zentrale Workout-Kette isoliert und eindeutig regressionsprüfbar bleibt.

---

## Phase 1 · Kernaktionen und Produktwahrheit — ✅ ABGESCHLOSSEN (2026-08-04)

> Nachweis: workout_chain_phase1 (24/24, Negativkontrolle 15 rot an der Baseline), phase1a_rest (29/29), phase1b_attrappen (20/20), gm_structure_contract (23/23). Rest-KF-007 (Planvarianten-Scheinzustand, Free/Pro-Tabelle) am 2026-08-04 geschlossen.

### 1a — Tote Kernpfade reparieren

| # | Befund | Ort | Fix |
|---|---|---|---|
| P0-1 | Hero-CTA „Training starten" | `workout-ui.js:50`, `index.html:398-402` | Handler auf `gmOpenStartSheet()` |
| P0-2 | FAB → „Training starten" | `quick-actions.js:26` | dito |
| P0-3 | FAB → „Training fortsetzen" | `quick-actions.js:47` | `ORVIA.workoutUI.open()` |
| P0-4 | Pace-Rechner-Widerspruch | `ui.js:6541`, `:6941-6947` | `gmProfPaceCalc()` im Sheet rendern, Platzhalter löschen |
| P0-5 | Muskelvolumen-Retry wirkungslos | `ui.js:6346` | `_gmMvModel=null;` |
| P0-6 | Profilfoto ignoriert `avatarStore` | `ui.js:7064` | Muster aus `ui.js:3532`; Renderer in `avatar-store.js:94` + `ui-refresh.js:58` registrieren |
| P0-7 | Modul-Toggle Einbahnstraße | `ui.js:5128` | alle Module mit An/Aus rendern |

### 1a-Test — „Training fortsetzen" braucht eine Zustandsmatrix, keinen Klicktest

Der entscheidende Nachweis ist **nicht** „`ORVIA.workoutUI.open()` wurde aufgerufen", sondern:

> Ein gestartetes Workout kann nach Schließen der Oberfläche **ohne Datenverlust** wieder aufgenommen werden.

| Zustand | Erwartung |
|---|---|
| kein aktives Workout | „Fortsetzen" nicht sichtbar |
| aktives Workout, Overlay offen | keine zweite Instanz |
| aktives Workout, Overlay geschlossen | Overlay wird wieder geöffnet |
| aktives Workout nach Tabwechsel | Zustand bleibt erhalten |
| aktives Workout nach PWA-Reload | Wiederherstellung **oder klarer Fehler** |
| veralteter/staler Workout-State | kontrollierte Bereinigung |

### 1b — Attrappen entfernen (nur interaktive Elemente, siehe 1.1)

> ⚠️ **Blockiert durch KF-013.** Solange die Golden-Master-Struktur nicht testgedeckt ist (siehe 1.5), darf Phase 1b nicht beginnen.

**Verbindliche Reihenfolge: erst unsichtbar, später löschen.**

Für Phase 1 ist **unsichtbar schalten sicherer als Löschen**. Zulässig nur, wenn:
- keine Fokusziele zurückbleiben,
- das Element nicht im Accessibility Tree liegt,
- kein Event Listener aktiv bleibt,
- keine Golden-Master-Struktur verletzt wird.

**Korrekt:**
```html
hidden aria-hidden="true"
```
beziehungsweise: das interaktive Element gar nicht erst rendern.

**Nicht ausreichend:**
```css
opacity: 0;
pointer-events: none;
```
Damit bleiben Fokus-, Layout- und Screenreader-Probleme bestehen.

**Code darf erst gelöscht werden, wenn alle vier Bedingungen erfüllt sind:**
1. keine Abhängigkeiten existieren,
2. die Golden-Master-Verträge aktualisiert sind,
3. der Ersatzpfad produktiv ist,
4. ein Regressionstest den Ersatz schützt.

Besonders relevant für: **Free/Pro-Vergleich · Profil-Unterseiten · Planvarianten · Einstellungs-Toggles.**

**Zu entfernen bzw. unsichtbar zu schalten:**

| Element | Ort |
|---|---|
| Glocke im Dashboard-Header | `ui.js:4640`, `index.html:119` |
| 9 deaktivierte Einstellungs-Toggles | `ui.js:7102`, `:7143-7157` |
| Drag-Griff `.mm-drag` | `ui.js:5124` |
| Planvariante A/B/C inkl. Sektionsaktion | `ui.js:5177-5187` |
| Deaktivierte Tagesziel-Stepper | `ui.js:5231-5235`, `:7235` |
| 6 Medaillen-Attrappen | `ui.js:7444-7449` |
| Zeitraum-Chevrons im Score-Sheet | `ui.js:4933` |
| „Vorlage"-Subtab + „Nur an Uhr übergeben" | `ui.js:5906`, `:5912` |
| 5 Anpassungs-Chips „Empfehlung anpassen" | `ui.js:4306` |
| Free/Pro-Vergleichstabelle | `index.html:385-388` |
| 6 gesperrte Profil-Unterseiten-Zeilen | `ui.js:7252`, `:7258-7260`, `:7363`, `:7387`, `:7401` |

**Ausnahme, die bleibt:** „Erholung & Warnzeichen" (`ui.js:7147`) ist bewusst nicht abschaltbar (Safety). Muss aber **optisch von den toten Toggles unterscheidbar** werden — aktuell sehen beide identisch aus.

**Zu behalten als ehrliches `—` (Anzeigeslots):** Metrikkacheln, Zielfortschrittsspuren, TRIMP/Hochintensiv/Sportart (werden in Phase 2 gefüllt), Bestzeiten-Zeilen, Meilenstein-Tracks.

### 1c — Toter Code und Textwidersprüche

- [ ] `gmProfDash()` löschen (`ui.js:7010`, kein Aufrufer)
- [ ] `batteryWord` löschen (`ui.js:4227`, syntaktisch immer `null`, kein Leser)
- [ ] `#readyOut`/`#ampelOut`-Renderer löschen (`ui.js:1257/1280`, Hosts sind `display:none`)
- [ ] Hardcodiertes Testnutzer-Alter „bei dir (22, gesund)" entfernen (`supplements.js:26`)
- [ ] Veralteter Garmin-Text (`profile.js:1577`) — widerspricht dem produktiven Sync
- [ ] Sheet „Verbindungen & Import" → „Import" umbenennen (`activity.js:736-747`, `ui.js:5433`)
- [ ] Widerspruch HR-Zonen: „Keine neue Zonenregel im UI" (`ui.js:7371`) entfernen — der Renderer existiert (`profile.js:272-289`) und wird in Phase 3 angebunden

**Definition of Done:** Jedes verbleibende interaktive Element hat einen getesteten Endzustand. Golden-Master-Paritätstests grün.

---

## Phase 2 · Belastungssteuerung — ✅ ABGESCHLOSSEN (2026-08-05)

> Nachweis: phase2_envelope_test (35/35). Envelope technisch erzwungen (js/metrics/metric-envelope.js); Harte Einheiten als RPE-≥-7-Einheitenanteil; TRIMP mit versionierter Provenienz und ohne Ruhepuls-Fallback; Interferenz am kanonischen Producer; easyShareDetail mit Abdeckung; HF-Zonen-Modell vorbereitet und leer. DoD erfuellt: vier gefuellte Kennzahlen, jede mit Zeitraum, Abdeckung und Methode.

**Darstellungsvertrag — jede Kennzahl trägt vier Informationen:**

```
Wert · Zeitraum · Datenabdeckung · Berechnungsgrundlage
```

Beispiel:
```
Harte Einheiten          22 %
2 von 9 Einheiten · RPE ≥ 7 · letzte 7 Tage
```

**Nicht:** `Hochintensiv: 22 %` — das suggeriert eine HF-Zonen-Auswertung, die nicht existiert.

### 2.0 · Gemeinsamer Metrik-Envelope — technisch erzwungen, nicht nur gefordert

Die vier Informationen dürfen **nicht pro Kennzahl frei modelliert** werden. Sonst entstehen erneut divergente ViewModels — dieselbe Fehlerklasse, die aktuell drei unabhängige Intensitätsdefinitionen erzeugt hat.

```js
{
  metricId: "training_load_by_sport",
  value: null,
  unit: null,
  period: {
    type: "rolling",
    days: 7,
    startDate: "2026-07-27",
    endDate: "2026-08-02"
  },
  coverage: {
    eligible: 9,
    available: 7,
    pct: 78,
    status: "partial"          // complete | partial | none
  },
  provenance: {
    method: "session_rpe",
    version: "1.0.0",
    sources: ["garmin", "manual"],
    assumptions: []
  },
  status: "partial",
  reason: null
}
```

**Verbindlich für:** Belastung nach Sportart · harte Einheiten · TRIMP · Easy Share · Interferenz · später ATL/CTL und sportartspezifische Kapazität.

Damit wird **„kein Wert ohne Provenienz" technisch erzwungen**, nicht nur textlich gefordert. Der Envelope ist vor der ersten Kennzahl zu bauen, nicht nachträglich übergestülpt.

### Reihenfolge

**2.1 Belastung nach Sportart** — reine Verdrahtung
`ui.js:4213` an `weeklyActivityTotals().bySport` (`activity-config.js:658`). Fallback auf `knownLoadUnits` mit Vollständigkeitshinweis, wenn `loadUnits` wegen fehlendem RPE `null` ist.

**2.2 Harte Einheiten (RPE-Proxy)**
`intensityHard` (`activity-config.js:549`) aggregieren. Zulässige Bezeichnung: **„Harte Einheiten · Anteil der Einheiten mit RPE ≥ 7"**.
Verboten: „Hochintensive Minuten", „Zone 4/5", „anaerober Anteil", „Schwellenanteil".

Datenmodell für echte Zonen parallel vorbereiten (noch nicht befüllt):
```js
heartRateZones: {
  z1Sec: null, z2Sec: null, z3Sec: null, z4Sec: null, z5Sec: null,
  source: null, zoneModelId: null
}
```

**2.3 TRIMP (Banister)**
`avgHr` in den Unit-Vertrag von `dailyLoadUnits` aufnehmen (`activity-config.js:457-478`). Ohne gemessenen Ruhepuls bleibt der Wert `null` — kein Fallback (konsistent mit `calc.js:13-15`).

Bei `coverage.status: "partial"` **kein Wochenmittelwert ohne Warnhinweis.**

**„Banister" allein ist kein ausreichender Methodenname.** Es existieren geschlechtsspezifische Varianten und abweichende Implementierungsdetails. Im Vertrag festzuhalten:

- verwendete Formel · Geschlechtsparameter · Umgang mit fehlendem Geschlecht
- Einheit der Dauer · zulässiger HRR-Bereich
- Verhalten bei `avgHr <= restingHr` · Verhalten bei `avgHr >= maxHr`
- Rundung · **Formelversion**

```js
provenance: {
  method: "banister_trimp",
  version: "1.0.0",
  inputs: {
    durationMin: 48, avgHr: 154, restingHr: 48, maxHr: 198,
    sexParameter: "male"
  }
}
```

**Ohne diese Versionierung verändern spätere Formelkorrekturen historische Werte, ohne dass Nutzer oder Analyse den Grund erkennen können.**

**2.4 Interferenz** — `Calc.evaluateLoadAndInterference()` (`calc.js:1124`) an das Dashboard-VM anschließen (`ui.js:4213`).

**2.5 `easyShare`-Korrektur** — `ui.js:459` setzt `sub:''` für Store-/Garmin-Läufe; `calc.js:719` filtert auf `sub ∈ ['Walk-Run','Easy Z2','Long Run']`. **Jeder reine Garmin-Lauf zählt heute als „nicht easy".**

⚠️ **Nicht durch ein neues Garmin-Heuristiklabel „reparieren".** Garmin-Läufe pauschal als `Easy Z2` zu klassifizieren, ersetzt einen Messfehler durch eine Erfindung.

Klassifikation ausschließlich aus belastbaren Daten, in dieser Priorität:

1. strukturierte geplante Intensität der zugeordneten Einheit
2. RPE
3. Herzfrequenz relativ zum individuellen Modell
4. Pace relativ zur Schwelle
5. sonst **unbekannt**

**Unbekannt darf nicht als „nicht easy" zählen.**

```
richtig:  Easy Share = klassifizierte leichte Läufe / alle klassifizierten Läufe
falsch:   Easy Share = leichte Läufe / alle Läufe einschließlich unbekannter
```

Der Nenner enthält nur klassifizierbare Läufe — oder die Abdeckung wird im Envelope (2.0) ausgewiesen.

**Definition of Done:** Vier gefüllte Kennzahlen, jede mit Zeitraum, Abdeckung und Methode. Kein Wert ohne Provenienz.

---

## Phase 3 · Bestehende Funktionen kontextuell integrieren

**Grundsatz:** Nicht jedes Feature braucht einen permanenten Menüpunkt. Kontextuelle Einstiege reduzieren Navigationskomplexität und verhindern eine neue Legacy-Sammeloberfläche.

### Informationsarchitektur

| Bereich | Features |
|---|---|
| **Dashboard / Heute** | Live-Check-in · Pre-Check-in · Ernährungsstatus · Tagesentscheidung · Regenerationshinweise |
| **Plan** | Wochenreview · Planqualität · Coach Briefing · Trainingsanpassung · Post-Workout-Check-in |
| **Analyse** | Belastungsrisiko · Musterkennung · Regenerationsdefizit · HR-Zonen · Energieverfügbarkeit |
| **Profil / Einstellungen** | Ernährungskonfiguration · Equipment · Daten & Import · Zyklus · Baselines |

### Kontextuelle Einstiege statt Menüpunkte

| Feature | Einstieg |
|---|---|
| Pre-Check-in | beim Starten einer Einheit |
| Post-Check-in | beim Beenden einer Einheit |
| Equipment-Verschleiß | aus dem betroffenen Schuh/Rad |
| Ernährungskonfiguration | aus der Ernährungskarte |
| Coach Briefing | aus dem Wochenreview |

### Aktivierungsmatrix — je Feature verbindlich zu dokumentieren

„Genau ein Einstieg" ist richtig, reicht aber für **verhaltenswirksame** Features nicht aus.

| Dimension | Beispiel (Post-Check-in) |
|---|---|
| Entry Point | Post-Workout-Abschluss |
| Datenquelle | `daily_checkins` |
| fachlicher Konsument | `buildTrainingDecision()` |
| Sichtbarkeit | nur nach beendetem Workout |
| Offline-Verhalten | lokal speichern, später synchronisieren |
| Bestandsnutzer | erklärender Hinweis |
| Rollback | Flag deaktiviert den Einfluss, **Daten bleiben** |
| Analytics | Öffnung, Abschluss, Abbruch |
| Test | Entscheidung mit/ohne Input |

**Zwingend für:** Pre-/Post-/Live-Check-in · Ernährung · Baselines · Belastungsrisiko · Mustererkennung.

### ⚠️ Sonderbehandlung Live-/Pre-/Post-Check-in

Siehe 1.2 — **Verhaltensänderung, kein Navigationsfix.**

Ein reiner Vergleich „mit vs. ohne Check-in" zeigt nur, **dass** sich eine Entscheidung ändert — nicht, ob sie **besser** wird. Zu messen sind mindestens:

- Änderungsrate der Tagesentscheidung
- **Richtung** der Änderung: erhöhen / reduzieren / pausieren
- Häufigkeit widersprüchlicher Empfehlungen
- Anteil blockierter bzw. fehlender Inputs
- Stabilität über wiederholte Berechnungen
- Nutzer-Override nach Empfehlung
- Training tatsächlich durchgeführt oder abgebrochen
- subjektive Bewertung nach der Einheit, sofern verfügbar

**Das Gate „≥14 Tage" ist eine Mindestmenge, keine Qualitätsgarantie.** Ein einzelner Nutzer mit 14 Tagen liefert keine robuste Produktvalidierung.

**Definition of Done:** Jedes der elf Features hat genau einen definierten Einstieg und eine ausgefüllte Aktivierungsmatrix. Kein Feature ist über zwei Wege mit unterschiedlichem Zustand erreichbar.

---

## Phase 4 · Sichtbare Qualitätsmängel

> **✅ Umgesetzt (2026-08-05, v8-228).** 1 Muskelkarte (timedOut-Semantik + Promise.all +
> 60-s-Refresh-Cache) · 2 Datenquellenkennzeichnung (E-02: `js/metrics/source-contract.js`,
> renderZones) · 3 Analyse-CSS (P2-2a/b/c) · 4 Hypnogramm (Beschriftung, Legende, eine
> Farbquelle, 4 GM_METRIC_INFO-Einträge) · 5 relative Tageslabels (`F.dayLabel`) ·
> 7/8 Handle+Bio (Migration 0029, vertikaler Durchstich). Tests:
> `supabase/tests/phase4_quality_test.mjs` (39), `format_utils_test.mjs` (48).

Priorisiert nach Kernnutzen:

1. **Muskelkarte** — `gym-volume.js:430/435/607/416` (Fehlklassifikation + `timedOut`-Logik)
2. **Datenquellenkennzeichnung** — siehe Entscheidung 2 unten
3. **Analyse-CSS** — `styles.css:2937` (Overflow), `#gmAna .mile` (Margin), `styles.css:2907` (Flex)
4. **Hypnogramm** — Spurenbeschriftung, Legende, 4 `GM_METRIC_INFO`-Einträge, Farbdivergenz `series-reader.js:104` ↔ `ui.js:4763`
5. **Relative Tageslabels** — `F.dayLabel()` in `format-utils.js`; `fmtDate` (`ui.js:367`) ruft es zuerst → 11 Aufrufstellen ohne weitere Änderung erledigt; anschließend die drei Ad-hoc-Lösungen (`ui.js:3879`, `:6929`, `:2147`) darauf umstellen
6. **Profilfoto** — bereits in Phase 1 (P0-6)
7. **Handle** — `ui.js:7073`
8. **Bio** — `ui.js:7074`, niedrigste Priorität dieser Phase

**Performance-Nebenbefund:** `ui.js:6660` verdrahtet `refresh:true` hart; die sequenzielle `await`-Schleife (`gym-volume.js:445-458`) ist im Code selbst als Ursache der 5–10 s-Verzögerung markiert. → `Promise.all` + Kurzzeit-Cache.

---

## Phase 5 · Kanonisches Load- und Plan-Datenmodell

> **🟡 Code vollständig (2026-08-05, v8-231), Aktivierung ausstehend.**
> 5C `js/plan-domain.js` (Baseline+Overrides+Rebase E-16, 40 Tests) · 5B kanonisches
> Read-Modell in `trainingLoadRepository` (E-11 Dim. A aus RPE, `unknown` statt raten,
> 19 Tests) · 5A Audit-Skript `tools/audit_training_load.mjs` (Mac) · 5D Erstmigration +
> 5E getrennte Schreibpfade + 5F kanonischer Lesepfad in `activeWeekPlan()` — alle 7
> Leser über EINEN Umschaltpunkt (`phase5de_test`, 30 Prüfungen inkl. Kernvertrag live).
> Persistenz: Migration `0030_user_week_plans.sql` + `weekPlanRepository`.
> **Offen:** Migrationen 0029/0030 ausführen → Flag `canonPlan` aktivieren (Plan-⚙) →
> 5A-Audit laufen lassen → erst danach Load-KONSUMENTEN (ACWR/Dashboard) auf 5B umstellen.

**Diese Phase entscheidet über die Architekturqualität der Engine. Sie darf nicht übersprungen werden.**

Load-SSoT und Plan-SSoT sind architektonisch verbunden, aber **unterschiedlich riskant** — deshalb getrennt migrieren:

```
5A  training_load auditieren
5B  kanonisches Load-Read-Modell
5C  Plan-Domain-Vertrag
5D  Bestandsplan-Migration
5E  getrennte Engine-Vorschläge und Nutzer-Overrides
5F  UI auf kanonischen Plan umstellen
```

**Der bestehende Live-Pfad darf erst abgelöst werden, wenn alle Leser umgestellt sind:** Dashboard · Planansicht · Start-Sheet · Workout UI · Wochenreview · Analyse · Export/Coach Briefing.

### 5.1 Load-Modell (5A + 5B)

1. **Datenqualitäts-Audit** der `training_load`-Tabelle (nie gelesene Daten, siehe 1.3)
2. **Ableitungsvertrag Intensität** festschreiben — es existieren bereits zwei unabhängige Definitionen (`intensityHard` RPE ≥ 7, `easyShare` 65–78 % HFmax). Eine dritte ist nicht zulässig.
3. `trainingLoadRepository` zum **kanonischen Read-Modell** machen:

```js
{
  date: "2026-08-02",
  totalLoad: 184,
  bySport: { running: 92, cycling: 54, strength: 38 },
  byIntensity: { easy: 84, moderate: 62, hard: 38 },
  completeness: 0.81
}
```

`bySport` und `completeness` sind ohne Schemaänderung ableitbar. `byIntensity` braucht den Ableitungsvertrag aus Schritt 2.

### 5.2 Plan-Modell

**Ausgangslage (siehe 1.4):** `PROFILE.weekPlan` wird von Engine-Anpassung (`ui.js:911`) und manueller Bearbeitung (`ui.js:2552`) **ohne Unterscheidung** beschrieben. Overrides gehen still verloren.

**Zielmodell: Baseline plus Patch** — ein flaches `overrides: []` genügt semantisch nicht.

```js
{
  planId: "...",
  weekKey: "2026-W32",
  revision: 3,
  baseline: {
    source: "scheduler_v2",
    engineVersion: "2.0.0",
    generatedAt: "...",
    snapshotId: "...",
    sessions: []
  },
  overrides: [
    {
      overrideId: "...",
      sessionId: "...",
      type: "move",              // move | resize | replace | skip | add
      from: "2026-08-04",
      to: "2026-08-05",
      reason: "user_manual",
      createdAt: "..."
    }
  ],
  effectiveSessions: [],         // berechnet oder materialisiert
  history: []
}
```

**Entscheidend: Engine-Baseline und Nutzeränderungen dürfen einander nicht überschreiben.**

### Rebase-Vertrag

Bei einer neuen Engine-Revision muss verbindlich festgelegt sein, was mit jedem Override geschieht:

| Fall | Regel |
|---|---|
| Override bleibt an derselben Session | unverändert übernehmen |
| Session hat einen Nachfolger | Override auf Nachfolgesession übertragen |
| Override kollidiert mit der neuen Baseline | Konflikt sichtbar machen, Nutzer entscheidet |
| Override ist nicht mehr anwendbar | verwerfen, **mit Begründung in `history`** |

Erforderlich:
- [ ] Migration der Bestandspläne aus `PROFILE.weekPlan` (5D)
- [ ] Trennung Engine-Anpassung ↔ manueller Override (5E)
- [ ] Planhistorie mit Änderungsgründen
- [ ] Rebase-Vertrag implementiert und getestet

**Ohne Planhistorie kann ORVIA später nicht erklären, warum eine Einheit verschoben, reduziert oder ersetzt wurde.** Das ist kein Komfortmerkmal, sondern Voraussetzung für Vertrauen in eine adaptive Plattform.

---

## Phase 6 · Engine-Verträge und Reviews

### 6.1 Sieben Verträge — verbindlich vor jeder Scheduler-Implementierung

1. Was ist ein **Trainingsziel**?
2. Was ist eine **Sportkapazität**?
3. Was ist ein **zulässiger Trainingsslot**?
4. Was ist eine **Session Prescription**?
5. Was ist eine **konkrete ausführbare Einheit**?
6. Welche Daten gelten als **ausreichend belastbar**?
7. Welche **Sicherheitsregeln** blockieren eine Planung?

**Größte Architekturgefahr:** bestehende Teilmodelle nur zu verbinden, ohne eine eindeutige Source of Truth festzulegen. Aktuell existiert Kapazität dreifach (`calc.js` live / `running-capacity-factory` shadow / `dailyLoadSeries`).

### 6.2 Wissenschaftlicher Review — keine Statusänderung

`scientificReviewStatus: 'approved'` darf **nicht** gesetzt werden, um Produktionsgates zu öffnen. Der Selektor (`knowledge-contracts.js:595-597`) ist ein sinnvoller Sicherheitsmechanismus, kein Hindernis.

Pro Regel zu dokumentieren:
- Regelinhalt · Zielgruppe · Evidenzquelle · Kontraindikationen
- zulässiger Anwendungsbereich · Unsicherheit · konservative Grenzen
- Review-Datum · Reviewer · Versionsstand

Betrifft 19 Regeln über 14 Topics in `running-knowledge-pack.js`.

### 6.3 Module laden

Die 9 fehlenden Engine-Dateien in `index.html` + `sw.js` aufnehmen, Ladbarkeitstest ergänzen. Ohne diesen Schritt failt `scheduler-goal-allocation.js:82-83` garantiert mit `SCHEDULER_GA_PORTFOLIO_MODULE_MISSING`.

> **✅ Umgesetzt (2026-08-05, v8-233):** alle 9 Module in `index.html` + `sw.js`
> (Reihenfolge verbindlich: knowledge-contracts VOR knowledge-sources/-pack —
> Load-Time-Hash). Ladbarkeitstest `phase6_module_load_test.mjs` (37 Prüfungen,
> inkl. Reihenfolge-Beweis über contentHash, Negativkontrolle und Beweis, dass
> `PORTFOLIO_MODULE_MISSING` nicht mehr auftritt). Korrektur: das Knowledge-Pack
> enthält 14 Regeln über 14 Topics (die „19" oben war die ruleId-Zählung inkl.
> goldenCase-Referenzen). Produktdefinition beschlossen: E-27 + Vision-Dokument
> `VISION-TRAININGSENGINE-2026-08.md`.

### 6.4 Safety-Fail-Verhalten — pro Komponente definiert

Für **jede** Planungskomponente muss festgelegt sein, was bei unzureichender Datenlage passiert.

| Situation | Verhalten |
|---|---|
| Kapazität unbekannt | konservative generische Einheit **oder** keine quantitative Prescription |
| Ruhepuls fehlt | kein TRIMP-basierter Load-Entscheid |
| Verfügbarkeit widersprüchlich | kein automatisches Verschieben |
| Schmerzen / Warnzeichen aktiv | Safety Gate **vor** Performance-Ziel |
| Knowledge Rule unreviewed | nicht im produktiven Modus verwenden |

**Grundsatz:**

> **Fehlende Sicherheit führt zu weniger Automatisierung, nicht zu mehr Heuristik.**

### 6.5 Rechtliche Produkt- und Datenklassifikation — VOR der Engine-Aktivierung

Die *finalen Texte* gehören in Phase 10. Die **rechtlichen Produktentscheidungen** dürfen aber nicht erst dann beginnen — sonst verletzt die technische Architektur später rechtliche Anforderungen und muss erneut umgebaut werden.

Vor Engine-Live zu klären:

1. Ist ORVIA **Coaching, Fitness-Software oder gesundheitsbezogene Entscheidungshilfe**?
2. Welche Aussagen werden über Regeneration, Verletzungsrisiko und Trainingseignung gemacht?
3. Welche personenbezogenen und gesundheitsnahen Daten werden verarbeitet?
4. Welche Daten gehen an Garmin, Supabase oder spätere Drittanbieter?
5. Welche Einwilligungen sind erforderlich?
6. Welche Lösch- und Exportpfade bestehen?
7. Wie werden automatisierte Empfehlungen erklärt?

```
Phase 6  : rechtliche Produkt- und Datenklassifikation
Phase 10 : finale Texte, Consent-Flows, Release-Abnahme
```

Punkt 1 ist der folgenreichste: Er entscheidet, ob Empfehlungen als Trainingsvorschlag oder als gesundheitsbezogene Aussage gelten — und damit über Nachweispflichten, die bis in das Datenmodell durchschlagen.

> **✅ Phase 6 umgesetzt (2026-08-05):**
> **6.1+6.4** → `ENGINE-VERTRAEGE-2026-08.md` (7 Verträge sport-neutral, neutrales
> Workout-Schema als Vertrag 4 normativ, Safety-Fail-Matrix mit Code-Ankern;
> Entwurf bis Eigentümer-Review) + `phase6_contracts_test.mjs` (28 Prüfungen:
> Fail-closed-Pfade live bewiesen — nur shadow_only, Pflicht-Pinning, Production-
> Gate zu, medicalSafetyRelevant in jedem Modus gesperrt, Hash-Bindung; Schema
> per Mini-Validator ausführbar inkl. Negativkontrollen).
> **6.2** → `KNOWLEDGE-REVIEW-2026-08.md` (aus dem Pack GENERIERT: 14 Regeln,
> Evidenz/Quellen/Unsicherheiten, leere Review-Felder; KEINE Statusänderung).
> **6.3** → v8-233 (s. o.).
> **6.5** → E-18-Sprachtest `phase6_e18_language_test.mjs` (12 Prüfungen, 96 Dateien,
> Positiv-/Gegenkontrollen) + `DATENKLASSIFIKATION-2026-08.md` (Ist-Erhebung:
> 45 Tabellen, 47 Garmin-Metriktypen, Export-/Löschpfade inkl. Lücken,
> 5 offene Rechts-Entscheidungen vor Engine-Live).

---

## Phase 7 · Scheduler und Session Prescription

### Zielarchitektur

```
Profile + Goals + Availability
            │
            ▼
      Goal Portfolio
            │
            ▼
   Capacity per Sport
            │
            ▼
   Constraint Solver
            │
            ▼
  Session Prescription
            │
            ▼
 Workout Template Resolver
            │
            ▼
   Canonical Week Plan
            │
     ┌──────┴──────┐
     ▼             ▼
 Dashboard      Workout UI
```

**Entscheidend:** Dashboard, Kalender, Start-Sheet und Live-Workout lesen **denselben kanonischen Plan**. Es darf keinen parallelen UI-Plan mehr geben.

### `scheduler-v1` nicht erweitern

Das Modul ist explizit als Skeleton mit `shadow_only` gebaut (`scheduler-v1.js:63-66`, `:91-92`, `:179`). Produktionslogik hineinzupatchen würde einen bewusst begrenzten Vertrag aufweichen.

**Verstärkendes Argument:** Die Tests **assertieren die Leere aktiv** — `engine_s1_scheduler_skeleton_test.mjs:109` prüft `plannedSessions.length === 0 && slots.every(s => s.proposal === null)`. Eine Erweiterung erforderte das Löschen von Assertions, die genau diese Absicht dokumentieren.

Stattdessen:
- `scheduler-v1` als dokumentierte Referenz erhalten
- klar versionierten produktiven Scheduler (`scheduler-v2`) implementieren
  > **✅ Umgesetzt (2026-08-05, v8-239):** `js/engine/scheduler-v2.js` — vollständige
  > Shadow-Pipeline: capacity.perSport (S3) → Anforderungs-Policy (req-policy-v1,
  > versioniert: Long aus longSessionCeiling, Qualität NUR bei Konfidenz
  > high|medium, konservativer Generik-Fallback ohne Kapazität) → Solver (S4) →
  > Prescription (S5) → kanonische Sessions (deterministische ps:v2-IDs,
  > vollständige Provenienz je Session, Konflikte/Unplatzierbares durchgereicht).
  > Nur `shadow_only`; v1 bleibt unangetastet. Test: `phase7_scheduler_v2_test.mjs` (18).
  > **Damit sind alle Phase-7-Bausteine (S3/S4/S5 + v2) gebaut — offen bleibt die
  > Shadow-Verdrahtung (v2 im shadow-runner mitrechnen) und Phase 8 (Gates).**
- Aktivierung über einen **zentralen Engine-Modus** steuern
- alte Heuristik (`ui.js:159 generateWeekPlan`) erst nach Shadow- und Canary-Phase entfernen

### Fehlende Bausteine

- **S3 Kapazitäts-Adapter:** `dailyLoadSeries → capacity.perSport`
  > **✅ Umgesetzt (2026-08-05, v8-236):** `js/engine/capacity-adapter.js` (shadow-only,
  > pure). Fensterinvarianten identisch zum Producer (bewiesen: die echte
  > running-capacity-factory klassifiziert die Adapter-Historie als kanonisch;
  > Negativkontrolle mit verletzter Summeninvariante wird erkannt). Beschreibende
  > Ist-Kapazität je Sportart (`source:'observed_history'`) in exakt der
  > scheduler-input-factory-Vertragsform; keine eigene Lastformel (nur
  > `dailyLoadUnits`-Aufrufe, Vertrag 2). Test: `phase7_s3_capacity_adapter_test.mjs` (21).
- **S4 Constraint Solver:** muss `availability.days[].restDay` und `fixedCommitments[]` lesen — der Live-Pfad ignoriert diese kanonischen Felder heute
  > **✅ Umgesetzt (2026-08-05, v8-237):** `js/engine/constraint-solver.js` (shadow-only,
  > pure, deterministisch). Liest restDay (HART), fixedCommitments, maxSessions/
  > maxIntense/minimumFullRestDays (HART), preferredRestDays (WEICH, nur bei Engpass
  > + explizitem Flag). Fail-closed nach Vertrag 3: Widerspruch restDay+available ⇒
  > Konflikt statt stiller Auflösung; unbekannte Verfügbarkeit ⇒ unzulässig;
  > Unplatzierbares bleibt MIT Grund unplatziert; intense Fixtermine (Match)
  > verbrauchen das Intensitätsbudget. Test: `phase7_s4_constraint_solver_test.mjs` (18).
- **S5 Session Prescription** + Endurance-Template-Modell in der DB (`0003_training_domain.sql` ist gym-orientiert; `ui.js:357 PLAN_PRESETS` ist eine hartcodierte Frontend-Liste)
  > **✅ Umgesetzt (2026-08-05, v8-238):** `js/engine/prescription-factory.js` (shadow-only,
  > pure). Erzeugt Vertrag-4-Workouts (neutrales Schema, verschachtelte repeats) aus
  > versionierten Daten-Templates (easy/long/tempo/intervals + strength_general).
  > RUN-INT-001-konform: ohne Pace-Evidenz (Schwelle + Konfidenz ≠ low) NIE ein
  > Pace-Ziel — RPE-Fallback + Flag; unplausible Evidenz verworfen. Selbstvalidierung
  > gegen den normativen Validator; fail-closed bei unbekanntem Typ/fehlender Dauer.
  > PLAN_PRESETS bleibt bis Scheduler-v2 unangetastet; DB-Template-Migration folgt
  > mit der Live-Schaltung. Test: `phase7_s5_prescription_test.mjs` (18).

---

## Phase 8 · Shadow → Canary → Live

Shadow-Infrastruktur existiert (`shadow-runner.js`, Gate `withBoth.length >= 14`). Die drei Stufen brauchen **messbare Gates**, keine Einschätzung.

> **✅ Messapparat gebaut (2026-08-05, v8-244): `js/engine/shadow-eval.js`.**
> **Befund beim Bau:** das Wochen-Protokoll enthielt nur Zählwerte
> (`sessions/unplaced/conflicts`). **Drei der fünf Kriterien — S3, S4, S5 — waren
> daraus überhaupt nicht messbar.** Der Nutzer hätte 14 Tage gesammelt und das
> Gate trotzdem nicht schließen können. `runWeekShadow()` schreibt die Belege
> jetzt aus dem echten Snapshot mit (`gate:{deterministic, invalidSessions,
> invalidCodes, validator, provenanceComplete, provenanceMissing, sessionsChecked}`).
>
> Der Auswerter ist pure/deterministisch und kennt **drei** Zustände je Kriterium:
> `pass` · `fail` · `insufficient_data`. **`insufficient_data` ist nicht `pass`** —
> `gateReady` wird nur true, wenn alle fünf belegt erfüllt sind (6.4-Grundsatz).
>
> **S2 ist richtungsabhängig definiert:** eine Abweichung v1≠v2 blockiert nur,
> wenn **v2 nachsichtiger** ist (v2 ließe trainieren, wo v1 bremst). Die Ordnung
> stammt aus `decision-engine-v2` selbst; ein Test prüft beide Listen gegen die
> Quelle, damit sie nicht auseinanderdriften. Ist v2 strenger, wird das als
> `conservative` gezählt und blockiert nicht.
>
> Konsole: `ORVIA.engineShadow.gateReport()`.
> Tests: `phase8_shadow_eval_test.mjs` (38, pure) · `phase8_gate_live_test.mjs` (15, Browser).

### Shadow Gate
- [ ] mindestens 14 verwertbare Vergleichstage **pro Testprofil** — *messbar (S1), wartet auf Daten*
- [ ] keine ungeklärten Safety-Divergenzen — *messbar (S2), wartet auf Daten*
- [x] deterministische Ausgabe bei identischem Snapshot — *messbar + live belegt (S3)*
- [x] keine ungültigen oder nicht ausführbaren Sessions — *messbar + live belegt (S4)*
- [x] vollständige Provenienz für **jede** Session — *messbar + live belegt (S5)*

### Canary Gate

> **✅ Messapparat gebaut (2026-08-06, v8-253): `js/engine/canary-eval.js`.** Gleiche
> Bauart wie `shadow-eval`: sieben Kriterien, drei Zustände je Kriterium,
> `insufficient_data` ist **nicht** `pass`. Konsole: `ORVIA.canaryEval.evaluate({…})`.
> Vier der sieben Kriterien waren vor dem Flag-Kanal und dem Aktivierungspfad
> überhaupt nicht messbar — sie vorher zu „bewerten" wäre eine Behauptung gewesen.

- [ ] begrenzter Nutzerkreis — *messbar (C1), Kohortengröße muss übergeben werden*
- [x] Feature Flag **serverseitig** deaktivierbar — *gebaut + messbar (C2): Migration 0031
      (RLS: lesen ja, schreiben **keine** Policy) + `js/engine/feature-flags.js` (fail-closed)*
- [ ] alte Heuristik weiterhin verfügbar — *messbar (C3), live belegt (Legacy-Pfad unverändert)*
- [ ] Migration reversibel — *messbar (C4); `planActivation.revert()` + `ORVIA.enginePlanRevert()`
      gebaut, der Nachweis eines echten Rücklaufs steht aus*
- [ ] Fehlerquote unter definiertem Grenzwert — *messbar (C5), wartet auf Canary-Daten*
- [ ] keine erhöhte Workout-Abbruchrate — *messbar (C6), richtungsabhängig: nur ein Anstieg blockiert*
- [x] **kein Verlust manueller Overrides** — *technisch erzwungen (C7): `plan-activation`
      verweigert die Aktivierung, statt einen Override zu verlieren; die Buchhaltung
      `vorher = kept + retargeted + conflicts + dropped` wird in jedem Lauf geprüft*

### Live Gate
- [ ] kanonisches Planmodell vollständig aktiv
- [ ] **alle** Leser umgestellt (siehe Phase 5F)
- [ ] Rollback getestet
- [ ] historische Pläne bleiben lesbar
- [ ] Safety Review abgeschlossen
- [ ] rechtliche Produktdarstellung entspricht der tatsächlichen Funktion

Zusätzlich zu ergänzen:
- **Integrationstest, der prüft, dass Engine-Output den Nutzer tatsächlich erreicht** — dieser Test fehlt heute vollständig und würde aktuell fehlschlagen

**Vor der Aktivierung zu beheben:** `shadow-runner` feuert bei jedem Öffnen des Heute-Tabs und rechnet die volle 28-Tage-Schleife neu (im Code selbst als unnötig kommentiert, `shadow-runner.js:46-48`). Ein Eintrag pro Tag genügt.

> **⛔️ Geprüft und bewusst NICHT umgesetzt (2026-08-05, v8-244) — gemessen statt vermutet.**
> Ein Cache wurde gebaut und wieder **zurückgenommen**:
> 1. **Messung** (Chromium, 122 Tage Check-ins + Aktivitäten): `buildInput()` = **0,52 ms**,
>    kompletter `run()` = **2,8 ms**. Der Planpunkt beschreibt eine vermutete, keine reale Last.
> 2. **Der Cache war unsicher.** Die Eingangssignatur (v1-State + Aktivitätenzahl) traf
>    nicht alle Quellen, die der Resolver liest. Eine Krankmeldung im Check-in ändert den
>    v1-Zustand nicht → der Cache lieferte weiter GREEN → Invariante „Krankheit ⇒ nie GREEN"
>    verletzt (`engine_program_e` S6 wurde rot).
> 3. **Dieser Log ist die Beweisgrundlage des Shadow-Gates.** Ein veralteter Eintrag
>    verfälscht die Gate-Messung in sicherheitsrelevanter Richtung.
>
> 0,5 ms gegen die Frische der Gate-Belege zu tauschen ist der falsche Handel. Sollte die
> Last je real werden, gehört sie in den Resolver (eine gemeinsame Lastserie für alle Leser),
> nicht in eine Sonder-Invalidierung im Shadow-Runner. Begründung + Messwerte stehen im
> Quelltext; `phase8_gate_live_test.mjs` misst die Kosten und beweist die Frische.

> ### 🔴 P0-BEFUND (2026-08-05, v8-244) — die bisherige Shadow-Beweisgrundlage war unbrauchbar
>
> Beim Bau der Gate-Auswertung entdeckt: **`DB` ist in `js/data.js` als `let DB = load()`
> deklariert, `RACE` in `js/ui.js` als `const RACE = {…}`.** Eine `let`/`const`-Deklaration
> auf oberster Skriptebene erzeugt eine globale *lexikalische* Bindung, aber **keine
> Eigenschaft von `window`**. Der `training-input-resolver` las beides über `root.DB` /
> `root.RACE` — im Browser also dauerhaft `undefined`.
>
> Im Browser gemessen: `typeof globalThis.DB === 'undefined'`, `typeof DB === 'object'`.
>
> **Wirkung:** Der Resolver hat den Morgen-Check-in **nie** gesehen. Jeder Shadow-Lauf
> protokollierte `missing_checkin` und `illness:false`; die Legacy-Lastreihe aus `DB` fiel
> aus; `goalDaysToEvent` war immer `null`. Die Invariante „Krankheit ⇒ nie GREEN" konnte im
> echten Browser gar nicht auslösen — im Sandbox-Test schon, weil dort `morning` direkt
> injiziert wird. **Das erklärt auch, warum der Fehler nie auffiel.**
>
> Konsequenz: hätte der Nutzer 14 Tage gesammelt, wären es **14 wertlose Einträge** gewesen.
> Der Fund kommt damit exakt rechtzeitig — vor der Datensammlung, nicht danach.
>
> Derselbe Fehler war in `js/quick-actions.js` bereits gefunden und dort behoben (GM7.9j),
> im Resolver nie. Behoben mit demselben Muster (`_globalDB()` / `_globalRACE()`,
> typeof-geschützt in beide Richtungen). Regression: `phase8_gate_live_test.mjs` prüft
> Ursache (Bindung) **und** Wirkung (illness wird gelesen, und bei Widerruf wieder false).
>
> **Noch zu prüfen:** ob weitere Module `root.DB` / `root.RACE` lesen. Bekannt und in
> Ordnung sind `coachmarks.js` und `ui-refresh.js` (beide `typeof`-geschützt mit Fallback);
> `shadow-runner.js` las `root.DB` für `sessionsByDay` (Legacy-Sessions fehlten damit in der
> Kapazitätsrechnung) — **mit behoben, gleiches Muster.**

### 📋 ARBEITSPLAN Phase 8 (2026-08-06)

**Ausgangslage, nüchtern:** S3/S4/S5 sind gebaut und live belegt. S1/S2 sind messbar,
warten aber auf Daten. Der Engpass ist NICHT das Gate — es ist die fehlende Brücke
zwischen Engine und Oberfläche. Solange die fehlt, kann das Gate schließen, ohne dass
der Nutzer etwas davon hat.

**Kritischer Startpunkt:** Die 14-Tage-Zählung beginnt faktisch mit dem Deploy von
v8-245+. Ältere Shadow-Einträge sind durch den P0-Binding-Befund wertlos und müssen
einmalig verworfen werden:

    ORVIA.engineShadow.clearLog(); ORVIA.engineShadow.clearWeekLog();

Ohne diesen Schnitt mischt das Gate wertlose mit gültigen Tagen und meldet ein
falsches Ergebnis — in sicherheitsrelevanter Richtung.

---

#### 8.1 · Wochenplan-Projektion (der eigentliche fehlende Baustein)

`scheduler-v2` erzeugt `sessions[]` in Engine-Form. Die Oberfläche liest ein anderes
Modell (`activeWeekPlan()` → 7 Tage-Arrays mit `{t,l,d,id}`). **Diese Abbildung
existiert nicht.** Sie ist die Ursache dafür, dass Zielprognose, Zielqualität und
Tagesziele „—" zeigen: es gibt keinen Weg, auf dem Engine-Werte dort ankommen könnten.

- [x] `js/engine/week-projection.js` — **gebaut (2026-08-06, v8-251)**. Pure Funktion
      `projectWeek(schedulerOutput) → {days:[7], unmapped[], notPlanned[], counts, provenance}`.
- [x] Rückrichtung: `weekPlanToComparable()` + `diffWeeks()` für den Vergleich Plan⇄Engine.
      Bewusst KEINE vollständige Umkehr — aus einer Anzeige-Einheit lässt sich keine
      Verordnung rekonstruieren, und so zu tun als ob wäre eine Erfindung.
- [x] Test: jede Session landet genau einmal im Wochenmodell oder begründet in `unmapped[]`
- [x] Test: deterministisch, nicht mutierend, stabile Ordnung im Tag

> **Beim Bauen aufgefallen und ergänzt:** Der Scheduler meldet ZWEI Verlustarten, bevor
> überhaupt eine Session entsteht — `unplaced` (kein zulässiger Tag) und
> `blockedPrescriptions` (Verordnung nicht baubar). Die erste Fassung der Projektion
> reichte beides nicht weiter; der Nutzer hätte einen dünneren Plan ohne jeden Grund
> gesehen. Jetzt in `notPlanned[]` mit unterscheidbarer Stufe (`placement` /
> `prescription`) durchgereicht.
>
> **Ebenfalls gemessen:** `deriveRequirements` liest `sports[].role` und
> `capacityPerSport[].weeklySessions/.longSessionCeiling/.confidence` — NICHT
> `sessionsPerWeek`. Mit korrekt geformtem Input liefert der Scheduler eine
> vollständige Woche (Long Run · Intervalle · Z2 · 3× Kraft, Ruhetag frei), die
> verlustfrei projiziert wird. Ohne Kapazitätsdaten bleibt es bewusst bei einer
> konservativen generischen Einheit je Sportart (`conservative_generic_no_capacity`).
> **Konsequenz für 8.3:** Das Gate misst nur dann etwas Aussagekräftiges, wenn der
> Kapazitäts-Adapter echte Werte liefert. Das ist vor der Datensammlung zu prüfen.

#### 8.2 · Integrationstest „Engine-Output erreicht den Nutzer"

**Gebaut (2026-08-06):** `supabase/tests/phase8_week_projection_test.mjs` (38 Prüfungen).

- [x] Test: echter `scheduler-v2` → Projektion → `activeWeekPlan()` → gerenderte Session-Karten
- [x] Test: bei abgeschalteter Engine ist der Legacy-Plan bitgenau unverändert
- [x] Test: die Projektion steuert nichts (schreibt von sich aus in kein Profilfeld)
- [x] Test: manuelle Overrides des Nutzers überleben den Weg — **geschlossen (2026-08-06,
      v8-253)**. Der Aktivierungspfad existiert jetzt (`js/engine/plan-activation.js`),
      und die Zusage ist härter als „überleben meistens": ein Override geht **nie still**
      verloren. Entweder er überlebt (kept/retargeted) oder die Aktivierung findet
      **nicht statt**. Belege: `phase8_plan_activation_test.mjs` (98) ·
      `phase8_activation_live_test.mjs` (30, Browser)

#### 8.3 · Gate schließen (wartet auf Daten, nicht auf Code)

- [ ] S1: 14 vergleichbare Tage — frühestens 14 Tage nach dem Deploy
- [ ] S2: Divergenzen sichten. Erwartung ehrlich: v2 wird abweichen. Blockierend sind
      nur Fälle, in denen v2 NACHSICHTIGER ist als v1 (richtungsabhängig definiert).
- [ ] Zwischenstand nach 7 Tagen prüfen (`gateReport()`), damit ein systematischer
      Fehler nicht erst nach zwei Wochen auffällt

#### 8.4 · Canary — entblockt und gebaut (2026-08-06, v8-253)

- [x] Supabase-Migration `0031_feature_flags.sql`: Tabelle `user_feature_flags`
      (user_id, flag, enabled, reason, cohort, set_by) + RLS. **Entscheidend ist,
      was NICHT drinsteht:** es gibt keine insert/update/delete-Policy für
      `authenticated`. Ohne Policy blockt RLS jeden Client-Write; Schreibrechte hat
      nur die `service_role`. Damit ist „serverseitig deaktivierbar" technisch
      garantiert und nicht bloß vereinbart. CHECK-Constraint auf bekannte Flagnamen.
- [x] `js/engine/feature-flags.js` — fail-closed in **jedem** Ausgang: kein Nutzer,
      kein Client, offline, Abfragefehler, unlesbare Antwort, fehlende Zeile,
      abgelaufener Zwischenstand ⇒ AUS. Nur ein ausdrückliches `enabled === true`
      schaltet ein (`"true"`, `1`, `"yes"` schalten **nicht**). `killSwitch()` ohne
      Gegenstück zum Einschalten. Test: `phase8_feature_flags_test.mjs` (46).
- [x] `js/engine/plan-activation.js` — der Aktivierungspfad. Pur (Uhr und ID-Fabrik
      kommen herein), idempotent (identische Woche ⇒ keine neue Revision), reversibel
      (`previous` + `revert()`), und er **verweigert**, statt einen manuellen Override
      zu verlieren. Verdrahtet in `ui.js` (`gmEngineActivateWeek`, dreifach gesperrt:
      Flag · kanonisches Modell · Override-Buchhaltung).
- [x] `js/engine/canary-eval.js` — sieben Kriterien, drei Zustände, richtungsabhängige
      Abbruchrate (nur ein **Anstieg** blockiert). Ein unbekannter Ausgangsgrund macht
      C5 zu `insufficient_data` statt still zu „kein Fehler".

> **Beim Bauen gefunden — zwei Dinge, die sonst durchgegangen wären:**
> 1. **Ein neuer Grund im Aktivierungspfad wäre im Auswerter still als „kein Fehler"
>    gelandet.** Deshalb ist die Fehlerliste eine Positivliste und ein unbekannter Grund
>    setzt C5 auf `insufficient_data`; ein Test vergleicht beide Listen gegeneinander,
>    damit sie nicht auseinanderdriften.
> 2. **`would_drop_overrides` doppelt zu zählen wäre falsch.** Die Schutzverweigerung ist
>    kein technischer Fehler (C5), sondern der verhinderte Verlust (C7). Beides zu zählen
>    hätte dieselbe Situation zweimal bestraft und die Fehlerquote uninterpretierbar gemacht.
>
> **Was das Gate weiterhin NICHT schließt:** C1 (Kohortengröße), C4 (ein echter
> durchgeführter Rücklauf), C5/C6 (Canary-Daten). Das ist keine fehlende Bauarbeit,
> sondern fehlende Betriebszeit — genau die Unterscheidung, die das Dreizustandsmodell
> sichtbar macht.

**Reihenfolge und Begründung:** 8.1 zuerst, weil es das einzige ist, das ohne Wartezeit
Fortschritt bringt und alles Weitere trägt. 8.2 direkt danach. 8.3 läuft nebenher ab.
8.4 erst, wenn 8.3 tatsächlich grün ist — vorher wäre es Arbeit auf Verdacht.

**Realistische Zeitachse:** 8.1+8.2 sind Bauarbeit ohne Wartezeit. 8.3 frühestens
zwei Wochen nach dem Deploy. Canary damit nicht vor Ende August.

---

**Stand Phase 8 (2026-08-06, v8-253): alles gebaut, was ohne Betriebszeit baubar ist.**

Gebaut: Projektion (8.1) · Integrationstest (8.2, inkl. des zuletzt offenen
Override-Punkts) · Shadow-Messapparat · Kapazitäts-Adapter geprüft (zwei P0-Befunde,
siehe unten) · Flag-Kanal · Aktivierungspfad · Canary-Messapparat.

Offen — und zwar **nur** aus Zeitgründen, nicht aus Codegründen:
- **S1/S2** brauchen 14 Tage Shadow-Daten nach dem Deploy.
- **C1/C4/C5/C6** brauchen einen laufenden Canary (Kohorte festlegen, Rücklauf einmal
  wirklich ausführen, Fehler- und Abbruchraten sammeln).

> ### 🔴 P0-BEFUND (2026-08-06, vor der Datensammlung) — die Gate-Belege wären ein zweites Mal wertlos gewesen
>
> Vor dem Start der 14-Tage-Sammlung wurde der Kapazitäts-Adapter geprüft (Vorbedingung
> aus 8.1). Ergebnis: **derselbe Objekt-statt-ID-Fehler an zwei weiteren Stellen.**
> - `js/engine/capacity-adapter.js` las `a.sport`, das kanonische Feld heißt `sportId`
>   ⇒ **jede** Aktivität fiel auf `other`, die Kapazität pro Sportart war leer.
> - `js/engine/shadow-runner.js` gab das ganze Sport-**Objekt** an `canonicalSportOf`
>   ⇒ `String({}) = "[object Object]"` ⇒ `sports = ['other']`.
>
> **Wirkung zusammen:** `scheduler-v2` setzte `conservative_generic_no_capacity` und baute
> eine generische Minimalwoche — 14 Tage Sammlung hätten eine Engine gemessen, die nie
> mit echten Daten gerechnet hat. Nach dem Fix: **2 → 6 Sessions**, nur noch die
> sachlich richtige Flagge `no_pace_evidence_shadow`.
>
> Es ist derselbe Fehlertyp, der in `generateWeekPlan` schon als H1 behoben war. Dritter
> Fundort in diesem Projekt. Regression: `phase8_capacity_pipeline_test.mjs` (16).

---

## Phase 9 · Weitere Sportarten

Aktuell: 1 Knowledge Pack (Running, unreviewed), `plannerSupport` für alle 24 Sportarten `false`.
Reihenfolge nach Nutzerrelevanz: Radfahren → Krafttraining → Schwimmen. Jeweils mit eigenem Review nach 6.2.

---

## Phase 10 · Release

- **Rechtstexte** (`orvia-pro.js:257`) — Impressum, Datenschutz, Nutzungsbedingungen, Cookies sind **alle derselbe Platzhalter**. Harter Blocker.
- **Geräte-OAuth** — es existiert kein Connect-Flow, nur „Trennen" (`profile.js:1578`)
- **Light Mode** — vollständige Überarbeitung, bewusst zuletzt

---

## 3. Entscheidungen

> **Verbindlich festgehalten in `docs/ENTSCHEIDUNGEN-2026-08.md` (E-01 … E-20).**
> Dort stehen auch die acht Statusänderungen gegenüber diesem Plan — insbesondere:
> `easyShare` bleibt Dimension B und wird **nicht** auf RPE umgestellt (E-11) ·
> `byIntensity` ist abgelehnt zugunsten getrennter Dimensionen (E-11) ·
> `data-slot`-Härtung **vor** Phase 1b (E-13) ·
> Rebase nur auf `ps:`-IDs, nie auf `psg:` (E-16) ·
> Engine-Sportartenreihenfolge Rad → Schwimmen → Kraft (E-19) ·
> Gates zweistufig, statistische Schwellen erst ab n > 1 (E-20).

### Die fünf ursprünglich offenen Punkte


| # | Entscheidung |
|---|---|
| **1 · Kennzahlenbibliothek** | **Zusammenfassen.** „18 Kennzahlen verfügbar · 28 weitere benötigen zusätzliche Daten", optional aufklappbar „Fehlende Datenquellen anzeigen". 46 Kacheln mit `—` wirken wie Funktionsdefekte, selbst wenn sie technisch ehrlich sind. |
| **2 · Profilwerte als Fallback** | **Ja, explizit gekennzeichnet.** Für HFmax, Ruhepuls, Gewicht, Größe, Schwellenpace, FTP, Schwellen-HF. Darstellung: „HFmax 198 bpm · Quelle: Profil, manuell". Nie mit Wearable-Daten vermischen.<br>`{ value: 198, source: "profile_manual", measuredAt: null, confidence: "user_provided" }` |
| **3 · `trainingLoadRepository`** | **Nutzen und zum kanonischen Read-Modell machen** — aber erst nach Datenqualitäts-Audit und Ableitungsvertrag für Intensität (siehe 1.3). |
| **4 · `.mile` Margin** | **Nur `#gmAna` überschreiben.** Der Fehler ist lokal, das Pixelvertragsrisiko (`styles.css:3094-3108`) real. Vereinheitlichung erst nach visueller Regressionsabdeckung. |
| **5 · Hochintensiv** | **RPE-Proxy jetzt**, bezeichnet als „Harte Einheiten · Anteil der Einheiten mit RPE ≥ 7". Zonen-Datenmodell parallel vorbereiten, nicht befüllen. |

---

## 4. Aufwandsschätzung

Die ursprüngliche Schätzung von 5–8 Tagen war zu optimistisch. Sie deckte nur die reine Codierung, nicht: Regressionen durch Legacy-Reaktivierung, mobile Browser-Tests, PWA-Cache, Supabase-Sync, Offline-Verhalten, Datenmigrationen, Auth-Kaltstart, unterschiedliche Nutzerprofile, Geräte ohne Garmin, laufende Workouts, visuelle Regressionen.

| Umfang | Aufwand |
|---|---:|
| Phase 0 (Baseline, Werkzeug existiert) | 0,5–1 Tag |
| Phase 1 (P0 + Attrappen) | 1–2 Tage |
| Phase 2 (Belastungssteuerung) | 2–4 Tage |
| Phase 3 (11 Funktionen integrieren) | 4–7 Tage |
| Phase 4 (P2-Bugs) | 2–4 Tage |
| Tests und Regressionen | 2–4 Tage |
| **Summe vor Phase 5** | **≈ 12–22 Arbeitstage** |

**Größtes Risiko:** Phase 3. Das ist Produktdesign, nicht Verdrahtung — und der Check-in-Punkt ist zusätzlich eine Verhaltensänderung mit Datenwirkung (1.2). Die Spanne kann dort nach oben ausbrechen.

Bei KI-gestützter Umsetzung verkürzt sich die reine Codierung deutlich. **Die Verifikation nicht.**

---

## 5. Auftragsformulierung

**Nicht:**
> Implementiere jetzt die vollständige Trainingsengine.

**Sondern:**
> Stelle zunächst einen ehrlichen, vollständig verdrahteten und regressionsgetesteten Produktkern her. Entferne alle funktionslosen Bedienelemente, verbinde die vorhandenen Berechnungen mit der sichtbaren Oberfläche, schaffe einen kanonischen Datenpfad für Belastung und Planung und bereite anschließend die produktive Engine-Aktivierung vor.
