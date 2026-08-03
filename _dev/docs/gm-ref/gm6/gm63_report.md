# GM6.3 — Testabschluss `r1_data_integrity_test.mjs`

**Datum:** 2026-07-27
**Auftrag:** GM6.3 (Testabschluss) + nachgereichte Freigabe zur C2-Migration.
**Geänderte Datei im Projekt:** ausschließlich `supabase/tests/r1_data_integrity_test.mjs`.
**Kein** Produktivcode, **kein** SW-Bump, **kein** Commit / Push / Deploy.

**Abnahmestatus: ERFÜLLT.** `r1_data_integrity_test` ist vollständig grün
(**82 bestanden, 0 fehlgeschlagen**, exit 0). Der in der Vorfassung dieses Berichts unter
7.1 offengelegte Zielkonflikt ist durch die ausdrückliche Freigabe des Auftraggebers gelöst
worden; C2 prüft jetzt die live wirksame Architektur statt einer überholten
Implementierungsformulierung. Alle übrigen Abweichungen bleiben offen ausgewiesen
(Abschnitt 7) statt weggedefiniert.

---

## 1. Alte und neue Extraktionsmethode

### 1.1 Alt (eine Zeile, Zeile 100 der Vorfassung)

```js
const cmd = ui.slice(ui.indexOf('function renderCommand'), ui.indexOf('function todayPrimaryUnit'));
```

Zwei voneinander unabhängige Defekte:

**(a) Falsche Deklaration.** `indexOf` liefert immer das **erste** Vorkommen. Bei mehreren
gleichnamigen Top-Level-Funktionsdeklarationen ist in JavaScript durch Hoisting jedoch die
**letzte** wirksam; alle früheren sind toter Code. Der Test prüfte damit systematisch die
falsche Funktion — nicht erst seit GM6, sondern seit seiner Entstehung.

**(b) Fremdanker.** Das Ende des Ausschnitts hing an der Position einer beliebigen anderen
Funktion (`todayPrimaryUnit`). Seit GM6.2 die tote Kopie entfernt hat, steht
`todayPrimaryUnit` im Quelltext **vor** `renderCommand`. `slice(gross, klein)` liefert einen
**leeren String**. Jede Negativ-Assertion (`!/…/.test(cmd)`) wird dadurch vakuum-grün, jede
Positiv-Assertion rot.

Messwerte am heutigen `js/ui.js`:

```
ALTER SLICE   a=Zeile 4050   z=Zeile 638   len=0   C1=true(vakuum)  C2=false   decls_darin=0
```

### 1.2 Neu (ersetzt exakt die eine alte Zeile)

Drei Stufen, ohne jeden Bezug auf eine andere Funktion:

1. **Quelltextbewusste Maske** (`gm63Mask`): ein Lexer markiert Zeilen- und Blockkommentare,
   `'`/`"`-Strings, Template-Literale inklusive `${ … }`-Verschachtelung sowie
   **Regex-Literale** (Zeichenklassen `[ … ]` und Flags eingeschlossen) als Nicht-Code.
   Alle folgenden Suchen laufen nur über echten Code.
2. **Ankerwahl:** alle `function <name>(`-Deklarationen im Code werden gesammelt,
   der **größte Offset** gewinnt (Hoisting). Zusätzlich werden spätere Zuweisungen
   (`<name> =`, `var|let|const <name> =`, `.<name> =`) gesucht; jede
   Zuweisung **hinter** dem Anker würde die Deklaration zur Laufzeit überschreiben und
   führt zu einem roten Test (C0e / C2c).
3. **Brace-Matching:** ab der öffnenden `{` der Parameterliste wird die Klammertiefe nur
   über Code-Positionen gezählt, bis sie wieder 0 erreicht. Der Ausschnitt endet exakt an
   der schließenden `}` des Funktionskörpers.

Dieselbe Extraktion wird seit der C2-Migration generisch über `gm63Grab(name)` auch auf
`gmDashVM`, `gmDashState`, `gmHero` und `gmLevel` angewandt.

### 1.3 Warum ein Lexer und kein einfacher Kommentar-/String-Scanner

Ein naiver Scanner, der Regex-Literale nicht kennt, deutet ein Apostroph innerhalb eines
Regex als String-Beginn und desynchronisiert danach dauerhaft. In der ersten Fassung führte
das dazu, dass 51,9 % von `js/ui.js` fälschlich als String maskiert wurden und die
Negativprobe „späterer Override" **nicht** anschlug — der schwerwiegendste Fehler dieser
Phase. Nachweis der Korrektur über die Gesamt-Klammerbilanz der Datei im Codebereich:

| Scanner | Klammerbilanz gesamt | Bewertung |
|---|---|---|
| naiv (nur `//`, `/* */`, `'`, `"`) | **1** | desynchronisiert |
| GM6.3-Lexer (+ Template + Regex) | **0** (Minimum 0) | synchron |

Diese Bilanz ist als Assertion **C0g** dauerhaft in den Test eingebaut. Ein künftig
desynchronisierter Scanner wird damit rot, statt still falsch zu schneiden.

---

## 2. Nachweis der live wirksamen Funktion

### 2.1 Aktueller Stand `js/ui.js` (md5 `fee5c739eb02349d8f0876d4b38c8630`, 475187 B)

```
renderCommand  decl@Zeile 4050   Körper endet Zeile 4077   2017 Zeichen   Overrides: 0
gmDashVM       decl@Zeile 3725   Körper endet Zeile 3791   5307 Zeichen   Overrides: 0
gmDashState    decl@Zeile 4003   Körper endet Zeile 4029   1752 Zeichen   Overrides: 0
gmHero         decl@Zeile 3811   Körper endet Zeile 3834   2593 Zeichen   Overrides: 0
gmLevel        decl@Zeile 3683                             141 Zeichen    Overrides: 0
```

Laufzeitausgabe des reparierten Tests auf dem Gerät:

```
-> renderCommand: 1 Deklaration(en) in Zeile [4050], gewaehlt Zeile 4050-4077,
   2017 Zeichen, spaetere Overrides: 0
-> gmDashVM: 1 Deklaration(en) in Zeile [3725], gewaehlt Zeile 3725-3791,
   5307 Zeichen, spaetere Overrides: 0
```

Der `renderCommand`-Körper enthält kein `Calc.ampel(` und kein `||'y'`. Er delegiert
vollständig an die GM6-Kette `gmDashState()` → `gmDashVM()` → `gmHero()`.

### 2.2 Historischer Beweis aus `backup_pre_gm62/js/ui.js` (md5 `d546feb533e16a673e43a6e2d7b20fdc`, 461126 B)

```
decl@Zeile 638    len=3738   C1_kein_ampel=true   C2_y=TRUE    <- TOTE Kopie
decl@Zeile 3945   len=760    C1_kein_ampel=true   C2_y=FALSE   <- LIVE (Hoisting)
ALTER SLICE       a=638 z=691  len=3829  C1=true C2=true  decls_darin=1
```

Das ist der zentrale Befund: **die alte C2-Forderung war seit jeher eine Aussage über toten
Code.** Das `||'y'` stand ausschließlich in der Kopie bei Zeile 638, die durch Hoisting nie
ausgeführt wurde. Die tatsächlich wirksame Implementierung bei Zeile 3945 hatte den Fallback
bereits vor GM6.2 nicht. Der Test war grün, weil er die falsche Funktion las — nicht, weil
die Eigenschaft produktiv vorhanden war. Genau dieser empirische Befund ist die Grundlage
der vom Auftraggeber erteilten Freigabe zur C2-Migration (Abschnitt 3).

### 2.3 Verbleibende `||'y'` in `js/ui.js`

Drei Vorkommen, alle **außerhalb** der geprüften Kette:

| Zeile | Funktion |
|---|---|
| 594 | `orviaScore()` |
| 2504 | `unitGuidance()` |
| 3210 | `renderSegAusdauer()` |

Die Kette `renderCommand` → `gmDashState` → `gmDashVM` → `gmHero` → `gmLevel` enthält weder
`||'y'` noch `Calc.ampel(`. Der semantische Nachfolger des konservativen Gelb-Fallbacks
existiert dort als GM6-Designtoken (`js/ui.js` Zeile 3729):

```js
var stC = os ? ({g:'ready',y:'attention',o:'attention',r:'crit'})[os.status.c] || 'attention' : 'neutral';
```

---

## 3. C1 unverändert, C2 auf die live wirksame Architektur migriert

### 3.1 C1 — byte-identisch zur Vorfassung

```js
ok('C1 renderCommand ohne Calc.ampel (nur dayState-SSoT)', !/Calc\.ampel\(/.test(cmd));
```

C3–C7 sowie die Blöcke A, B, D und E sind ebenfalls unberührt. Alle übrigen
Datenintegritätsprüfungen sind unverändert.

### 3.2 C2 — alte Fassung aufgehoben

Die alte Zeile

```js
ok('C2 renderCommand fällt konservativ auf y zurück', /\|\|'y'/.test(cmd.replace(/\s/g, '')));
```

ist ersatzlos entfallen. Begründung des Auftraggebers, empirisch durch 2.2 belegt: sie hat
ausschließlich toten Code geprüft und war niemals Teil der live wirksamen Implementierung.

### 3.3 C2 — neue Invariante, verhaltensbasiert geprüft

Geprüft wird nicht mehr eine Zeichenkette, sondern das **Verhalten** der live wirksamen
`gmDashVM`. Der per `gm63Grab('gmDashVM')` extrahierte Körper wird in einer
`node:vm`-Sandbox mit acht Stubs (`orviaScore`, `todayStr`, `DB`, `gmMetric`, `gmMoodKey`,
`gmEsc`, `fmtDe`, `GM_NA`) **real ausgeführt** und gegen Fixtures gefahren.

| ID | Prüft | Art |
|---|---|---|
| C2a | Signatur `function gmDashVM()` | statisch |
| C2b | Körper per Brace-Matching geschlossen, ≥ 400 Zeichen | statisch |
| C2c | genau **eine** Deklaration, kein späterer Override | statisch |
| C2d | `renderCommand` delegiert an `gmDashState` + `gmDashVM` + `gmHero` | statisch |
| C2e | Status `g` → `ready` | Ausführung |
| C2f | Status `y` → `attention` | Ausführung |
| C2g | Status `o` → `attention` | Ausführung |
| C2h | Status `r` → `crit` | Ausführung |
| C2i | **unbekannter** Status → `attention` | Ausführung |
| C2j | **fehlender** Status → `attention` | Ausführung |
| C2k | `null` / `undefined` / Wurf → `neutral`, `reco.cls === 'attention'` | Ausführung |
| C2l | **kein** unbekannter Statuscode ergibt `ready` (24 Fuzz-Varianten) | Ausführung |
| C2m | **alle** unbekannten Statuscodes ergeben `attention` | Ausführung |
| C2n | Fallback-Token `attention` in der aktiven Funktion vorhanden | statisch |
| C2o | kein `\|\|'y'` in der aktiven `gmDashVM` | statisch |
| C2p | kein `\|\|'y'` in der gesamten Kette (`renderCommand`, `gmDashState`, `gmDashVM`, `gmHero`, `gmLevel`) | statisch |

Damit sind alle vom Auftraggeber wörtlich geforderten Invarianten abgedeckt: Ready bleibt
Ready, Attention bleibt Attention, Critical bleibt Critical, unbekannter Status → Attention,
fehlender Status → Attention, `null`/`undefined` → konservativer Zustand, und **kein**
unbekannter Zustand ergibt Ready. Der alte Fallback `'y'` kann in der live geprüften Kette
nicht zurückkehren (C2o, C2p).

### 3.4 Ankerprüfungen C0a–C0g (unverändert)

| ID | Prüft |
|---|---|
| C0a | Ausschnitt ist nicht leer |
| C0b | Ausschnitt trägt die Signatur `function renderCommand()` { |
| C0c | Funktionskörper per Brace-Matching vollständig geschlossen, letztes Zeichen `}` |
| C0d | Mindestlänge ≥ 400 Zeichen |
| C0e | geprüft wird die späteste Deklaration und es existiert kein späterer Override |
| C0f | genau **eine** Deklaration — keine Rückkehr der toten Kopie |
| C0g | Lexer synchron (Klammerbilanz der Gesamtdatei = 0, nie negativ) |

### 3.5 Test-first-Nachweis: Negativproben zum Anker (C0)

Fünf manipulierte `ui.js`-Varianten gegen den Anker-Teil des Tests:

| Variante | C0a | C0b | C0c | C0d | C0e | C0f | C0g |
|---|---|---|---|---|---|---|---|
| `orig` (unverändert) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gone` — `renderCommand` entfernt | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `dead` — tote Kopie wieder eingefügt | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `override` — spätere Zuweisung ergänzt | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `trunc` — Körper unvollständig | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

**Blindheitsbeweis der alten Fassung:** gegen `gone` und `trunc` meldet der alte Test
unverändert `59 bestanden, 1 fehlgeschlagen` — exakt dasselbe Ergebnis wie im gesunden Fall.
Er kann die beiden schwersten Manipulationen nicht von Normalbetrieb unterscheiden.

### 3.6 Test-first-Nachweis: Negativproben zur neuen C2-Invariante

Die vom Auftraggeber wörtlich geforderten vier Manipulationsklassen plus eine Zusatzvariante,
jeweils als vollständige `js/`-Kopie mit manipulierter `ui.js` gegen den **neuen** Test:

| Variante | Manipulation | rote Assertions | Bilanz |
|---|---|---|---|
| `nofallback` | Fallback ersatzlos entfernt | C2i, C2j, C2m, C2n | **78 / 4** |
| `readyfallback` | Fallback auf `ready` geändert | C2i, C2j, C2l, C2m, C2n | **77 / 5** |
| `deadcopy` | Fallback nur noch in einer toten Kopie | C2c, C2i, C2j, C2m, C2n | **77 / 5** |
| `trunc` | aktive Funktion abgeschnitten | C0g, C2a, C2b, C2e–C2k, C2m, C2n | **70 / 12** |
| `override` | aktive Funktion später überschrieben | C2c | **81 / 1** |

Alle fünf sind rot. Insbesondere `deadcopy` belegt, dass **keine tote Kopie** den Test
erfüllen kann: die Extraktion wählt die späteste Deklaration, und C2c meldet die zusätzliche
Deklaration unabhängig davon.

---

## 4. Ergebnis des reparierten Tests

| | vor GM6.3 | GM6.3 (Zwischenstand) | **final** |
|---|---|---|---|
| Zeilen | 165 | 299 | 434 |
| Bytes | 13070 | 20481 | **28703** |
| md5 | `9051ffc764e59ea914e05d2838927ec4` | `e41e2d31ce1011c2ff02a30f5af51758` | **`7203ad7513f6d3c3311b7c548fb4e234`** |
| Assertions | 60 | 67 | **82** |
| Bilanz | 59 / 1 | 66 / 1 (exit 1) | **82 / 0 (exit 0)** |

```
✅ C0a  ✅ C0b  ✅ C0c  ✅ C0d  ✅ C0e  ✅ C0f  ✅ C0g
     -> renderCommand: 1 Deklaration(en) in Zeile [4050], gewaehlt Zeile 4050-4077,
        2017 Zeichen, spaetere Overrides: 0
✅ C1 renderCommand ohne Calc.ampel (nur dayState-SSoT)
     -> gmDashVM: 1 Deklaration(en) in Zeile [3725], gewaehlt Zeile 3725-3791,
        5307 Zeichen, spaetere Overrides: 0
✅ C2a … ✅ C2p
Ergebnis: 82 bestanden, 0 fehlgeschlagen.
```

Rechnung 67 → 82: 67 − 1 (alte C2) + 16 (C2a–C2p) = 82.

Identisches Ergebnis im Container und auf dem Gerät bei byte-identischer Datei.

---

## 5. Vollständige Gerätesuite auf dem finalen Stand

### 5.1 Bestanden

**Gerätesuite `supabase/tests`: 179 Dateien = 178 Tests + 1 Helferdatei (`_helpers.mjs`).
Davon 170 grün, 8 nicht ausführbar, 0 echte Fehler.**

**Paritätstools (Container, Playwright):** 851 Assertions, 0 Fehler.

| Suite | Assertions | Ergebnis |
|---|---|---|
| gm1_parity | 78 | ALL PASSED |
| gm2_parity | 71 | ALL PASSED |
| gm3_parity | 99 | ALL PASSED |
| gm4_parity | 122 | ALL PASSED |
| gm5_parity | 197 | ALL PASSED |
| gm6_parity | 284 | ALL PASSED |

**Hydrations- und Zustandsverträge (Container):**

| Test | Ergebnis |
|---|---|
| `gm62_input_guard` | 48 / 48, rc 0 |
| `gm61_hydration_contract` | 43 / 43, rc 0 |
| `gm6_state_contract` | 424 ok, rc 0 |
| `gm61_contract` | 99 ok, rc 0 |
| Live-Harness `live_check.mjs` | 20 / 20, rc 0 |

**Schlechteste Pixel-Diffs je Suite (Gate ≤ 2 %), frisch gemessener Lauf vom 2026-07-27:**

| Suite | schlechtester Zustand | Diff |
|---|---|---|
| gm1 | `f_attention` | **1,97 %** (7614 px) |
| gm2 | `session_planned_390` / `session_done_390` | 1,39 % |
| gm3 | `f_month top` | 1,62 % |
| gm4 | `end_f bot` | 1,70 % |
| gm5 | `page_bestTimes390` | 1,55 % |
| gm6 | `f_attention_430` | 1,96 % (7585 px) |

**Gesamtmaximum: 1,97 %** — innerhalb des ≤ 2-%-Gates.

### 5.2 Echte Fehler

**Keine.** `r1_data_integrity_test` ist mit 82 / 0 vollständig grün (exit 0).

### 5.3 Nicht ausführbar (übersprungen)

**Sechs Supabase-ENV-Fälle** (jeweils exit 2, `ENV fehlt: SUPABASE_URL, …`):

`batch2f_offline_queue_live`, `live_workout_rls_phase42`, `live_workout_rpc_smoke_phase42`,
`muscle_volume_sql_phase43`, `rls_test`, `training_rls_phase41`

**Zwei Playwright-Fälle auf dem Gerät** — `gm61_contract`, `gm6_state_contract`, beide
`ERR_MODULE_NOT_FOUND: playwright`. Das Gerät hat kein Playwright/Chromium installiert.
Beide Tests laufen im Container gegen **byte-identische** Dateien grün (Abschnitt 5.1); das
Ergebnis gilt abgeleitet, nicht direkt auf dem Gerät gemessen. Ehrlich ausgewiesen: auf dem
Gerät selbst sind sie nicht ausführbar.

Rechnung: 170 grün + 6 ENV + 2 Playwright = 178 Tests.

---

## 6. Bestätigung: kein Produktivcode verändert

### 6.1 md5 der zentralen Produktivdateien (nach allen Läufen erneut gemessen, Gerät = Container)

```
fee5c739eb02349d8f0876d4b38c8630  js/ui.js            (475187 B)
de1ecff28d0ea43eb128ad43c5674cf3  js/auth.js
1849432c66afae0ffee9b9557c2ddcbb  js/checkin-store.js
135e8806cbb84280090c439e3886f3e8  js/ui-refresh.js
e0cc137204c65e3efca239dfe9d3e94c  sw.js
```

### 6.2 Eingefrorene Baseline

`md5sum -c` gegen `docs/gm-ref/gm5_baseline.md`, Zeilen 17–62 (39 Dateien):
**38 / 39 OK.** Einzige Abweichung `js/auth.js` — die eine bereits autorisierte Ausnahme.
Unverändert gegenüber dem GM6.2-Abschlussstand.

### 6.3 Service Worker

`orvia-v8-197` unverändert, kein Bump in GM6.3.

### 6.4 Geänderte Dateien insgesamt

Genau eine: `supabase/tests/r1_data_integrity_test.mjs`.
Kein `ui.js`, kein CSS, keine Auth, kein Store, keine Engine, kein Scheduler, kein Resolver.
Kein Commit, kein Push, kein Deploy.

---

## 7. Offene Punkte und Abweichungen

### 7.1 C2-Zielkonflikt — **GELÖST**

**Frühere Sachlage.** Die Vorfassung dieses Berichts wies aus, dass „`r1_data_integrity_test`
vollständig grün" mit den damaligen Leitplanken nicht gleichzeitig erfüllbar war: C2
verlangte `||'y'` innerhalb von `renderCommand`; die live wirksame Implementierung enthielt
diesen Fallback nicht und hatte ihn — wie in 2.2 belegt — auch vor GM6.2 nicht enthalten.
Der Bericht hat drei mögliche Wege dargestellt und **keinen** davon eigenmächtig beschritten,
sondern eine ausdrückliche Entscheidung des Auftraggebers eingefordert.

**Entscheidung.** Der Auftraggeber hat die alte C2-Forderung aufgehoben, ausdrücklich mit der
Begründung, dass sie empirisch nachweisbar ausschließlich toten Code geprüft hat, und die
Migration auf die live wirksame Architektur freigegeben — mit der Auflage, einen
Funktions-/Fixture-Test statt eines reinen String-Matches zu verwenden und C1 sowie alle
übrigen Datenintegritätsprüfungen unverändert zu lassen.

**Umsetzung.** Abschnitt 3.3 (16 Assertions C2a–C2p, davon 9 durch reale Ausführung des
extrahierten Live-Codes in einer `node:vm`-Sandbox) und Abschnitt 3.6 (fünf Negativproben,
alle rot). C1 ist byte-identisch geblieben.

**Ergebnis.** Der Test ist vollständig grün und prüft erstmals die tatsächlich wirksame
Implementierung. Die Prüftiefe wurde dabei erhöht, nicht gesenkt: an die Stelle eines
einzelnen String-Matches auf toter Substanz sind 16 Assertions getreten, davon neun
verhaltensbasiert.

### 7.2 Pixel-Diff 1,97 % statt der ursprünglich genannten „maximal 1,96 %"

Der schlechteste Wert liegt bei **1,97 %** (`gm1 / f_attention`), nicht bei 1,96 %. Der
Auftraggeber hat die Korrektur auf den real gemessenen Maximalwert ausdrücklich angewiesen
und zugleich klargestellt, dass **keine UI-Anpassung wegen Renderer-Rauschen** erfolgen soll.

Kontrollläufe bei **unverändertem** `js/ui.js` (md5 nach jedem Lauf erneut bestätigt):

| Lauf | Diff | Pixel |
|---|---|---|
| Gerätemessung 1 | 1,97 % | 7619 |
| Gerätemessung 2 | 1,97 % | 7620 |
| Container, frischer Lauf | 1,97 % | 7614 |
| committete `docs/gm-ref/gm1/results.json` | 1,97 % | 7614 |

Spannweite 6 Pixel bei identischem Quellcode = Renderer-Rauschen (Subpixel-Antialiasing
zwischen Chromium-Läufen), keine Regression. **Das ≤ 2-%-Gate ist eingehalten.**

**Nachtrag zu GM5:** der frische Lauf weist als schlechtesten GM5-Zustand
`page_bestTimes390` mit **1,55 %** aus, nicht die früher berichteten 1,44 %
(`page_settings390`). Der frühere Bericht hat den zweitschlechtesten Wert genannt. Beide
Werte liegen innerhalb des Gates; die Korrektur wird hier offen ausgewiesen.

### 7.3 `docs/gm-ref/results.json` — 2-Pixel-Abweichung als Renderer-Rauschen

| Fassung | md5 | `prof_*.px` |
|---|---|---|
| Container (unverändert) | `e72dee05ec3a44e44db149295787ce79` | `prof_a/f/p` = 3594, 390er = 3590 |
| Gerät | `a013a88a2363caea2f095c14dbecfa05` | `prof_p.px` = 3596 |

Differenz: **2 Pixel** in einem einzigen Zustand, bei 43 Keys und identischem Quellcode.
Das entspricht ca. 0,0004 % der Fläche und liegt weit unterhalb jeder fachlichen Schwelle.
Einordnung: Renderer-Rauschen, **kein Hinweis auf eine Abweichung im Produktivcode**. Die
Gerätefassung wurde bewusst **nicht** überschrieben; es wurde **kein** Produktivcode
deswegen geändert.

### 7.4 Temporäre Artefakte

| Pfad | Status |
|---|---|
| `Strava/_gm62_dev/backup_pre_gm62/` | **bis nach der Abnahme behalten** — historischer Beweis zu Abschnitt 2.2 |
| `Strava/_gm62_dev/gm63/` | Arbeitskopien der Testfassungen (u. a. `r1_orig.mjs`) |
| `Strava/_gm62_dev/` gesamt | ca. 13 MB, **außerhalb** von `app/`, kein Teil des Auslieferungsstands |

`Strava/_gm62_dev` ist ein **manuell entfernbarer temporärer Ordner**. Er wurde nicht
eigenmächtig gelöscht; es wurde kein rekursiver oder unsicherer Löschbefehl darauf
angewendet. Entfernung nach der Abnahme durch den Auftraggeber.

Container-Hilfsdateien (`/tmp/gm63/…`, `/tmp/gm7/…`) sind nicht Teil des Projekts und
verschwinden mit der Sitzung.

---

## 8. Fazit

Alle Paragraphen des GM6.3-Mandats und der nachgereichten C2-Freigabe sind vollständig
abgearbeitet. Der Testanker ist repariert und gegen fünf Manipulationsklassen des Ankers
sowie fünf Manipulationsklassen der Fallback-Invariante nachweislich empfindlich; der alte
Anker war gegen zwei davon vollständig blind. Es wurde keine Fachprüfung abgeschwächt — die
Assertionszahl ist von 60 über 67 auf 82 gestiegen — und kein Produktivcode angefasst.

`r1_data_integrity_test`: **82 bestanden, 0 fehlgeschlagen.**
Gerätesuite: **170 grün, 0 echte Fehler**, 6 ENV-Fälle und 2 mangels Geräte-Chromium dort
nicht ausführbare Tests.
Pixelmaximum: **1,97 %**, innerhalb des ≤ 2-%-Gates.

**GM6 ist damit abgenommen. GM7 ist freigegeben.**
