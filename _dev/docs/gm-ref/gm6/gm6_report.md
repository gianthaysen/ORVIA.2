# GM6-Abschlussbericht — globale Zustände und systemweites Verhalten

Stand: 2026-07-26 · Golden Master `/tmp/orvia_dashboard_5.html` md5 **`1b93e15e23054318c8848d5cb10e6bcb`**
(unverändert, vor und nach der Umsetzung geprüft) · `sw.js` unverändert `const C = 'orvia-v8-197'`
(genau ein Treffer, kein Bump) · kein Commit, kein Push, kein Deploy.

Ergebnis: **GM6 vollständig grün.**
`gm6_state_contract: ALL PASSED (353 ok)` · `gm6_parity: ALL PASSED (283 ok)` (exit 0) ·
17 weitere Suiten unverändert grün · Struktur-Diff 0 in allen geprüften Zuständen ·
höchster Pixel-Diff 1,96 % (Gate ≤ 2 %) · Engine-/Scheduler-/Store-/Resolver-/Auth-/Goal-Diff exakt null.

Geänderte Dateien (vollständig): `js/ui.js`, `styles.css`,
`supabase/tests/gm6_state_contract_test.mjs`, `tools/gm6_parity.mjs`, `docs/gm-ref/gm6/**`.
`index.html` blieb md5-identisch (`9d9db850bdaf6346c380896bb72cf172`) — die in §7 erlaubte
Ausnahme „falls zwingend erforderlich" wurde **nicht** in Anspruch genommen.

---

## 1. Vollständige Zustandssignal-Zuordnung

Es wurden ausschließlich bereits vorhandene Signale verwendet. Kein neues Signal, keine neue
fachliche Bewertung im UI, keine erfundene Zustandsdimension.

| Signal | Ort (unverändert) | Werte | GM6-Verwendung |
|---|---|---|---|
| S1 `window.orviaSyncState()` | `js/sync.js:68` (eingefroren) | `local`\|`synced`\|`pending`\|`error`\|`offline` | `error`/`offline` ⇒ GM-`errorView`; `local`/`pending` ausdrücklich **kein** Fehlerzustand (Negativkontrolle B6b) |
| S2 `navigator.onLine` + `online`/`offline`-Events | `js/orvia-pro.js:275`, `js/sync.js` | bool | `false` ⇒ GM-`errorView` (Offline mit Cache) |
| S3 `gmDashVM().noData` | `js/ui.js` (`gmDashState()`) | bool | `true` **und** nicht offline ⇒ GM-`emptyView`; `true` **und** offline ⇒ `errorView` mit `—` statt Zahl |
| S4 kanonische Resolver-Missingness | `GM_NA`, `M.*==null`, `MSTAT.no_data`, `MV_STATUS_META.no_data` | `null`/`'no_data'` | Einzelwert fehlt ⇒ `—`/`GM_NA`, **nie `0`** |
| S5 `Calc.loadConfidenceContract().suppressNumbers` | `js/calc.js` (eingefroren) | bool | Belastungswerte nicht belastbar ⇒ GM-Empty statt Chart, **nie `0`-Kurve** |
| S6 `sb.auth.onAuthStateChange('SIGNED_OUT')` + `html.orvia-gated` | `js/auth.js:169 ff.` (eingefroren) | Gate sichtbar/verborgen | unverändert übernommen; **kein GM-Pendant** (siehe §9, Lücke A) |
| S7 `hideSplash()` | `js/orvia-pro.js:274` | fester 850-ms-Timer | **nicht verwendet** — zeitbasiert, kein Datensignal (Lücke L1) |
| S8 Offline-Queue `sync_status` | `js/offline-queue.js` | Enum | **nicht verwendet** — kein Konsument im erlaubten Dateiraum |
| S9 `window._gmStateOverride` | `js/ui.js` | `loading`\|`empty`\|`error` | ausschließlich Testhaken; produktiv nirgends gesetzt |

**Ableitungsreihenfolge** (`gmDashState()`, entspricht der Gewichtung des Golden Masters):
`loading` → `error`/offline → `empty` → `normal`.
Quellvertrag A2 prüft explizit, dass der Fehlerzweig **vor** der `noData`-Prüfung entschieden wird
und **nicht mehr** an `noData` gekoppelt ist — das ist die Voraussetzung für „offline mit Cache".

### Zustandsmatrix nach Auftrag §2 (alle zwölf Zeilen)

| Nr. | Zustand | Status | Nachweis |
|---|---|---|---|
| 1 | initialer App-Boot / Laden | **Lücke L1** | einziger Boot-Indikator ist `#splash` mit festem 850-ms-Timer in `js/orvia-pro.js` — nicht im erlaubten Dateiraum, kein datengetriebenes Signal. Nicht simuliert. |
| 2 | tabbezogenes Laden | **Lücke L2** | Golden Master hat keine Tab-Loading-Komponente (`loadingView` ist dashboard-exklusiv), produktiv existiert kein Tab-Ladesignal. Nicht simuliert. |
| 3 | vollständig vorhandene Daten | umgesetzt | `f/a/p_good`, `ciopen`, `attention`, `crit` — Diff 0,53–1,96 % |
| 4 | vollständig leerer Zustand | umgesetzt | `emptyView` 1:1, `a/f/p_empty` — Diff 0–0,59 % |
| 5 | teilweise vorhandene Daten | umgesetzt ohne neues Bauteil | vorhandene Module bleiben sichtbar, nur fehlende Slots zeigen GM-Missingness (B5) — `f_partial` 1,85 % / 0,57 % |
| 6 | fehlende Einzelwerte | umgesetzt | S4, B4 („nie 0") |
| 7 | veraltete Daten (stale) | **Teil-Lücke L3** | siehe §9 |
| 8 | offline mit vorhandenem Cache | umgesetzt | `errorView` = die GM-Semantik für genau diesen Fall; drei Auslöser einzeln geprüft (`syncState`, `navigator`, kombiniert) — je 1,25 % |
| 9 | offline ohne nutzbare Daten | umgesetzt | derselbe `errorView`, Ring zeigt `—` — 1,74 % |
| 10 | behebbarer Ladefehler | umgesetzt | `errorView` + genau ein Retry — 1,25 % / 1,10 % |
| 11 | nicht behebbarer Darstellungsfehler | **Lücke L4** | Golden Master hat keine zweite Fehlerkomponente, produktiv kein globales „fatal"-Signal. Nicht erfunden. |
| 12 | Auth erforderlich / Sitzung abgelaufen | Signal vorhanden, GM-Pendant fehlt | S6 ist produktiv zuverlässig; der Golden Master kennt keinen Auth-Zustand. Bestehende Gate-UI unverändert, `js/auth.js` eingefroren. |

Fixture-Zustände existieren ausschließlich im Test-Harness (`/tmp/gm6h.html`, `/tmp/gm6_fixtures.js`),
niemals im Produktivcode.

---

## 2. Ersetzte Legacy-Zustandsrenderer

### 2.1 Neue systemweite Bausteine

`js/ui.js` erhielt genau drei Komponenten (`gmStateLoading`, `gmStateEmpty`, `gmStateError`),
die wörtlich die Golden-Master-Bauteile `.sk`, `.card > .empty` und `.errbar` erzeugen.
`gmStateLoading` gibt **ausschließlich** die beiden echten GM-Skelettbausteine aus (Karten- und
Kachelblock aus `loadingView`, Referenzzeile 632); eine frei parametrierbare Zeilenhöhe wäre eine
Erfindung gewesen und hätte die Pixelparität zwangsläufig gebrochen.
`gmStateError` erzeugt **keinen** Button, wenn keine echte Retry-Aktion übergeben wird (§4).

### 2.2 Gelöschte tote Legacy-Blöcke (2)

| vorher | Markup | Befund |
|---|---|---|
| `renderCommand` #1 | `<div class="occ pend">` / `<div class="occ ${dc}">` | durch Hoisting bereits tot (GM-Fassung überschreibt) — entfernt, damit kein latenter Rückfallpfad in der Datei bleibt |
| `renderCheckinCompact` #1 | `.cic-ic` / `.cic-b` / `.cic-pill` | dieselbe Hoisting-Situation — entfernt |

Quellprüfung: `class="occ` = 0 Treffer, `cic-` = 0 Treffer, `class="mv-note` = 0,
`class="placeholder` = 0, `<p class="note">Check-in-Modul nicht geladen` = 0,
`class="btn sec">Erneut versuchen` = 0.

### 2.3 Auf GM-Komponenten umgestellte Stellen (19)

| `js/ui.js` | vorher | jetzt |
|---|---|---|
| 1029 | `<p class="note">Check-in-Modul nicht geladen.</p>` | `gmStateError` (ohne Button — es existiert keine sichere Retry-Aktion) |
| 1946 | dieselbe Legacy-Note im Ereignis-Check-in | `gmStateError` (ohne Button) |
| 1269 | Legacy-Absatz „keine Übung gewählt" | `gmStateEmpty` |
| 1662 | kein Ladezustand | `gmStateLoading({bare:true})` für `#mvBody` |
| 1664 | `.muted`-Absatz | `gmStateError` |
| 1671 | `.mv-note` + `btn sec` | `gmStateError` + Retry `renderMuscleVolume()` |
| 1674 | `.muted`-Absatz | `gmStateEmpty` |
| 1678 | `.mv-note` (partial_data) | `gmStateError({icon:'info'})` ohne Button |
| 1705 | `.mv-note` + `btn sec` (catch) | `gmStateError` + Retry `renderMuscleVolume()` |
| 3026 | `.muted` „Noch keine Läufe" | `gmStateEmpty` |
| 3229 | `.muted` Schwimmen | `gmStateEmpty` |
| 3536 | `<p class="muted">Diagramm-Modul nicht geladen.</p>` | `gmStateError` |
| 3541 | Legacy-Note `suppressNumbers` | `gmStateEmpty` (Kontrakt-Note als `desc`) |
| 3544 | Legacy-Partial `<14 Tage` | `gmStateEmpty` |
| 3568 | Legacy-Fehler + `btn sec` | `gmStateError` + Retry `renderFormFitnessV5()` |
| 3600 | `<p class="muted">Metrik-Modul nicht geladen.</p>` | `gmStateError` |
| 3602 | kein Ladezustand | `gmStateLoading({bare:true})` |
| 3610 | `_rcvError` + `btn sec` | `gmStateError` + Retry `renderRecoveryTilesV5()` |
| 3621 | `.muted` „Noch keine synchronisierten Erholungswerte" | `gmStateEmpty` + `expandCheckinCard()` |

Zusätzliche Strukturkorrekturen am Dashboard-Zweig:

* `gmLoadingMods()` erzeugt jetzt stufenabhängig **2** (Stufe a) bzw. **4** Skelettkacheln —
  exakt `repeat(level==='a'?2:4)` des Golden Masters. Skelettzahl 14 / 20 / 20 statt fix 20.
* `renderModules()` gibt im Empty-Zweig **keinen** `eduhint` mehr aus; der Golden Master zeigt
  ihn ausschließlich im Normalzweig.
* `renderCheckinCompact()` rendert auf Stufe a die GM-Struktur `div.card > .ci-simple` mit drei
  `.mood`-Elementen statt immer `div.card.tight > .checkin` (Referenzbefund G-A1).

### 2.4 Bewusst nicht angefasst

`.muted`-Absätze außerhalb der inventarisierten Zustandsrenderer (18 verbleibende Treffer in
`js/ui.js`) sind **Erklär- und Hinweistexte in Sheets/Modals**, keine Lade-, Leer- oder
Fehlerzustände der fünf Hauptscreens. Eine Umstellung wäre über den Auftrag hinausgegangen.
Ein Grenzfall bleibt offen und ist in §9 geführt: der Supplement-Stack-Leerzustand (`js/ui.js:1889`).

Legacy-Zustandsmarkup in **eingefrorenen bzw. nicht freigegebenen** Dateien (`js/activity.js`,
`js/profile.js`, `js/profile-center.js`, `js/calc.js`, `js/intelligence.js`, `js/workout-ui.js`,
`js/orvia-pro.js` inkl. `#offline`-Banner und `#splash`) wurde nach §7 **nicht** verändert und ist
in §9 als offener Punkt geführt.

---

## 3. DOM-Parität je Zustand

Referenz: `docs/gm-ref/gm6/gm6_gm_domspec.json` (3 Erklärtiefen × 6 Szenarien × 2 Viewports,
maschinell aus dem unveränderten Golden Master erzeugt).

```
a/loading  [statusbar, hdr, span.lvlbadge, sync, hero, card, kgrid]                       sk=14
f/loading  [statusbar, hdr,                sync, hero, card, kgrid]                       sk=20
p/loading  [statusbar, hdr, span.lvlbadge, sync, hero, card, kgrid]                       sk=20

a/empty    [statusbar, hdr, span.lvlbadge, sync, hero.gap, gapnote, card,       sectlabel, card, addmod]
f/empty    [statusbar, hdr,                sync, hero.gap, gapnote, card.tight, sectlabel, card, addmod]
p/empty    [statusbar, hdr, span.lvlbadge, sync, hero.gap, gapnote, card.tight, sectlabel, card, addmod]

a/f/p error [statusbar, hdr, (span.lvlbadge), sync, errbar, hero]                          sk=0
```

Produktiv erreicht (Testabschnitte B1 / B1b / B2 / B2b, 430 px **und** 390 px): identische
Reihenfolge, identische Klassen, identische Slotanzahlen, inklusive der Unterscheidung
`div.card` (a/empty) gegenüber `div.card.tight` (f, p) und der levelabhängigen Skelettzahl.

Zusätzlich verifiziert:

* **Komponentenverträge gegen den Golden Master geklont** (keine handgeschriebenen Regexe):
  * Skeleton-Karte `div.sk>div.sk`
  * Empty `div.card>div.empty>div.e-ic>svg.ic>div.et>div.ed>div.eb>svg.ic.sm`
  * Error `div.errbar>svg.ic.sm>div>b>button.cta.wide-ghost>svg.ic.sm`
  Jeweils **Struktur-Diff 0** gegen die live aus der Referenz gelesene Signatur.
* **B15 Shell-Invarianz**: in **jedem** Zustand 5 Tabbar-Einträge, Tabbar sichtbar, FAB sichtbar,
  genau 1 `.hdr`. Die Seitenstruktur schrumpft in keinem Zustand.
* **B14 keine Legacy-Komponente sichtbar**: über alle Zustände × alle drei Erklärtiefen kein
  sichtbares `.occ`, `.cic-b`, `.cic-pill`, `.rcv-grid`, `.headrow`, `.placeholder`.
* **B13 Layoutintegrität**: keine horizontalen Überläufe.
* **B3 Zustandswahrheit über A/F/P identisch**: Erklärtiefe ändert Texttiefe, nie Zustand oder Wert.
* **Golden Master außerhalb des Dashboards** (Teil D des Paritätswerkzeugs): Plan, Aktivität,
  Analyse und Profil sowie die Profilunterseite `settings` sind über **alle sechs** GM-Szenarien
  strukturell invariant (Signaturlänge `6922,6922,6922,6922,6922,6922`) und in `loading`/`error`
  **pixelidentisch (0 %)**. Damit ist empirisch belegt: der Golden Master besitzt auf diesen vier
  Screens **keine** Zustandsvarianten — es gibt dort nichts zu migrieren, und jede erfundene
  Tab-Zustandsansicht wäre eine Abweichung von der Referenz gewesen.

---

## 4. Sämtliche Pixel-Diff-Werte

Gate ≤ 2 %, keine geometrische Referenznormalisierung, Golden Master unverändert.
Maskiert sind ausschließlich dynamische Texte/Werte (eng); Karten, Skeletons, Fehlersymbole,
Rahmen, Abstände und Buttons bleiben **unmaskiert**.

### 4.1 Hauptansichten 430 × 900

| Ansicht | Diff | Pixel |
|---|---|---|
| `f_good_430` | 1,86 % | 7181 |
| `a_good_430` | 1,19 % | 4609 |
| `p_good_430` | 1,25 % | 4825 |
| `f_ciopen_430` | 1,09 % | 4210 |
| `f_attention_430` | 1,96 % | 7585 |
| `p_crit_430` | 0,53 % | 2034 |
| `a_loading_430` | 0,02 % | 70 |
| `f_loading_430` | 0,50 % | 1942 |
| `p_loading_430` | 0,00 % | 13 |
| `a_empty_430` | 0,01 % | 30 |
| `f_empty_430` | 0,56 % | 2161 |
| `p_empty_430` | 0,00 % | 13 |
| `a_offline_cache_430` | 0,00 % | 0 |
| `f_offline_cache_430` | 1,25 % | 3880 |
| `p_offline_cache_430` | 0,00 % | 0 |
| `f_offline_nav_430` (Auslöser `navigator.onLine`) | 1,25 % | 3880 |
| `f_offline_sync_430` (Auslöser `orviaSyncState`) | 1,25 % | 3880 |
| `f_offline_nodata_430` | 1,74 % | 5383 |
| `f_error_430` | 1,25 % | 3880 |
| `f_error_nodata_430` | 1,74 % | 5383 |
| `f_partial_430` | 1,85 % | 7174 |
| `f_local_only_430` (Negativkontrolle) | 1,86 % | 7181 |
| `f_pending_430` (Negativkontrolle) | 1,86 % | 7181 |

### 4.2 Hauptansichten 390 px

| Ansicht | Diff | Pixel |
|---|---|---|
| `f_good_390` | 0,58 % | 2021 |
| `f_loading_390` | 0,63 % | 2205 |
| `f_empty_390` | 0,59 % | 2086 |
| `f_offline_cache_390` | 1,10 % | 3632 |
| `f_error_390` | 1,10 % | 3632 |
| `f_partial_390` | 0,57 % | 2016 |

### 4.3 Komponenten, vollständig unmaskiert

| Komponente | Diff | Pixel | Größe GM / produktiv |
|---|---|---|---|
| `sk_card` | 0,00 % | 0 | 394×111 / 394×111 |
| `sk_kcard` | 0,00 % | 0 | 191×120 / 191×120 |
| `empty_card` | 0,91 % | 809 | 394×226 / 394×226 |
| `errbar` | 1,79 % | 388 | 394×55 / 394×55 |
| `retry_btn` | 0,00 % | 0 | 151×66 / 151×66 |

### 4.4 Golden-Master-Zustandsinvarianz außerhalb des Dashboards

| Screen | `loading` vs `good` | `error` vs `good` |
|---|---|---|
| Plan (`tage`) | 0 % | 0 % |
| Aktivität (`act`) | 0 % | 0 % |
| Analyse (`ana`) | 0 % | 0 % |
| Profil (`prof`) | 0 % | 0 % |
| Profilunterseite `settings` | — | 0 % (`gmsub_settings` 0 %, 0 px) |

**Höchstwert insgesamt: 1,96 %.** Kein Wert überschreitet das Gate; es wurde nichts „dokumentiert
überschritten" und nichts durch eine Maske grün gemacht.

### 4.5 Messverfahren der Komponentenparität (offengelegt)

`.errbar`, `.card` und `.hero` sind **transluzent**; beide Container (`#screen` im Golden Master,
`#prodScreen` im Harness) tragen denselben `radial-gradient`, dessen Farbe von Containerhöhe und
Elementversatz abhängt. Zusätzlich rundet `elementHandle.screenshot()` auf
`ceil(y+h) − floor(y)`, sodass identisch hohe Elemente mit unterschiedlichem Nachkommaanteil von
`y` um 1 px abweichende Bilder liefern.

Behoben wurde das **ausschließlich am Messaufbau**, symmetrisch und ohne Maske: die Probe-Seite
wird auf die Containerhöhe des Golden Masters gezwungen, und ein Spacer richtet den Elementversatz
bis < 0,005 px auf den Referenzversatz aus. Für die Dauer der Komponentenmessung werden `.tabbar`
und `.fab` auf **beiden** Seiten identisch ausgeblendet (sie überlagerten im GM-Bild tief liegende
Karten) und danach wieder eingeblendet, damit die archivierten Tab-Referenzen die volle Shell
behalten. Die Korrektheit des Aufbaus wird in-band geprüft: je Probe sichern die Assertions
„identische Messbedingungen (Containerhöhe + Abstand)", „DOM-Signatur identisch zur Referenz",
„Geometrie identisch" und „Aufnahmen exakt gleich groß (kein Zuschnitt)" ab, dass der Aufbau nicht
still driftet. **Die Referenz wurde nicht verändert und nicht normalisiert.**

Restabweichungen `empty_card` 0,91 % und `errbar` 1,79 % sind visuell inspiziert
(`diffc_empty_card.png`, `diffc_errbar.png`): reines Glyph-Antialiasing plus eine Kantenzeile.
Icons, Rahmen, Kartengeometrie und der Retry-Button liegen bei exakt 0 px.

---

## 5. Retry- und Fokusprüfung

**Retry-Vertrag.** Im Fehlerzustand existiert genau **ein** Retry-Button mit den
Golden-Master-Klassen `cta wide-ghost` und der Kennung `id="gmRetryBtn"`.
Er ruft ausschließlich die bereits vorhandene, sichere Re-Render-Funktion `renderDay()` auf —
das produktive Äquivalent zum `onclick="go('dash')"` der Referenz.

Instrumentierte Messung eines Klicks:

```
{"renderDay":1,"syncStart":0,"flushSync":0,"schedulePush":0,"engine":0,"persist":0,"showGate":0}
```

Also: **genau ein** bestehender Aufruf, kein zweiter Request, keine Engine, keine Planberechnung,
keine Persistenz, keine Löschung, kein Auth-Gate. Quellvertrag A4 sichert dies zusätzlich
statisch ab (`runEngine|recalc|rebuildPlan|saveDB|deleteD|orviaSchedulePush|persist` = 0 Treffer
im Fehler-Hero).

Wo keine echte Retry-Aktion existiert (Check-in-Modul nicht geladen, Metrik-/Diagramm-Modul nicht
geladen, `partial_data`), wird **kein** Button gerendert — statt eines funktionslosen Bedienelements
nur die Fehlerkomponente.

**Fokus.** Der Retry-Button ist fokussierbar und zeigt einen sichtbaren Fokus. Nach erfolgreicher
Aktion kehrt der Fokus in den Zustand zurück. Das GM-Sheet öffnet mit Scrim, `Escape` schließt es
und gibt den Fokus an den Auslöser zurück.

**Idempotenz.** Sechs aufeinanderfolgende Re-Renders erzeugen weder DOM- noch Listener-Duplikate
(`{"l":0,"same":true,"n":1}`).

**Übergänge**, alle mit protokollierter DOM-Signatur vorher/nachher:

| Übergang | Ergebnis |
|---|---|
| Loading → Daten | `hdr\|sync\|hero\|card\|kgrid` (sk 20) → volle Modulkette (sk 0) |
| Loading → Empty | (sk 20) → `hdr\|sync\|hero\|gapnote\|card\|sectlabel\|card\|addmod` (sk 0) |
| Daten → offline mit Cache | volle Kette → `hdr\|sync\|errbar\|hero` |
| offline → wieder online | `errbar\|hero` → volle Kette |
| Error → erfolgreicher Retry | `errbar\|hero` → volle Kette |

---

## 6. Missingness- und Offline-Nachweis

**Missingness nie als `0`.** Testabschnitt B4 prüft über alle Zustände und Erklärtiefen, dass
`null`, „unbekannt" und „nicht geladen" nie als `0` erscheinen. Produktiv getragen wird das von den
bereits kanonischen Quellen S4 (`GM_NA`, `M.*==null`, `MSTAT.no_data`) und S5
(`suppressNumbers` ⇒ ATL/CTL/TSB/ACWR unterdrückt, nicht auf 0 gesetzt). Es wurde keine
UI-Ersatzberechnung und kein Ersatzwert eingeführt.

**Partial.** B5 belegt: vorhandene Module bleiben sichtbar, Header und Sektionsfolge bleiben
erhalten, nur die fehlenden Slots zeigen GM-Missingness. `f_partial_430` = 1,85 %,
`f_partial_390` = 0,57 % — die Seite schrumpft nicht.

**Offline mit Cache.** Drei unabhängige Auslöser wurden getrennt geprüft und führen zu byte-gleicher
Darstellung: `orviaSyncState()==='offline'`, `orviaSyncState()==='error'` und
`navigator.onLine===false` — je 1,25 %. Der zwischengespeicherte Wert bleibt sichtbar (Hero mit
Wert, gedimmter Ring, Label „ZULETZT"), begleitet vom Offline-Status in der `.errbar`.

**Offline ohne Cache.** Der Ring zeigt `—`. Assertion: „kein erfundener Wert (kein numerischer
Score)" — bestätigt mit gemessenem Inhalt `—`. Diff 1,74 %.

**Negativkontrolle.** `orviaSyncState()==='local'` und `'pending'` erzeugen **keinen**
Fehlerzustand: beide liefern exakt die Normalansicht (1,86 %, identisch zu `f_good_430` mit
7181 px). Quellvertrag A2 sichert zusätzlich statisch ab, dass `gmDashState()` diese beiden Werte
nicht als Fehler wertet.

---

## 7. Vollständige Testbilanz

**RED-Baseline zuerst**, wie in §5 gefordert: `docs/gm-ref/gm6/gm6_test_red_baseline.txt`
dokumentiert den nachweislich scheiternden Erstlauf mit **66 FAILED (284 ok)**.

Endstand:

| Suite | Ergebnis |
|---|---|
| `gm6_state_contract` | ALL PASSED (353 ok) |
| `gm6_parity` (Werkzeug) | ALL PASSED (283 ok), exit 0 |
| `analysis_endurance_v5` | ALL PASSED (23 ok) |
| `analysis_recovery_v5` | ALL PASSED (23 ok) |
| `checkin_compact` | ALL PASSED (16 ok) |
| `dashboard_v5_phaseb` | ALL PASSED (8 ok) |
| `gm1_shell` | ALL PASSED (20 ok) |
| `gm2_plan_parity` | ALL PASSED (28 ok) |
| `gm3_activity_parity` | ALL PASSED (53 ok) |
| `gm4_analysis_parity` | ALL PASSED (52 ok) |
| `gm5_profile_parity` | ALL PASSED (47 ok) |
| `muscle_map_pilot` | ALL PASSED (16 ok) |
| `orvia_charts` | ALL PASSED (14 ok) |
| `plan_phases_v5` | ALL PASSED (19 ok) |
| `plan_quality_v5` | ALL PASSED (23 ok) |
| `plan_weeklist_v5` | ALL PASSED (27 ok) |
| `plan_weekvolume_v5` | ALL PASSED (22 ok) |
| `shell_v3_migration` | ALL PASSED (26 ok) |
| `ui_detail_mode` | ALL PASSED |

Abgedeckte Abschnitte des GM6-Vertragstests: A (Quellverträge) · B1/B1b (GM-DOM-Reihenfolge
430 px / 390 px) · B2 (Klassen- und Slotanzahlen) · B2b (Level-a-Check-in) · B3 (A/F/P-Identität)
· B4 (Missingness ≠ 0) · B5 (Partial) · B6/B6b (Offline-Signale + Negativkontrolle) · B7 (Retry)
· B8 (Fokus) · B9 (sechs Re-Renders) · B10 (Übergänge) · B11 (Escape/Sheet) · B12 (Reduced Motion)
· B13 (Layoutintegrität) · B14 (keine Legacy-Komponenten) · B15 (Shell-Invarianz) · B16 (Konsole).

Keine Konsolen- oder Seitenfehler — weder im produktiven Harness noch in der Komponenten-Probe.

**Keine Testabschwächung.** Zwei Fachtests (`analysis_endurance_v5_test.mjs`,
`analysis_recovery_v5_test.mjs`) erhielten ein **Testgerüst**, weil die neuen Zustandskomponenten
außerhalb des jeweils evaluierten Codeausschnitts liegen: ein neutraler `icon()`-Stub (reine Grafik,
keine Fachaussage, wie am Kopf von `js/ui.js`) und ein indirektes `eval` des **echten,
unveränderten** Produktivquelltexts von `gmEsc` und des GM6-Komponentenblocks. Es wurde
**keine einzige `ok(...)`-Zusicherung geändert, entfernt oder aufgeweicht** — beide Dateien wurden
zur Kontrolle vollständig gegengelesen. Statt Ersatzmarkup zu erfinden, wird der Produktivcode
selbst geladen; das ist eine Verschärfung, keine Abschwächung.
Analog wurde in A6 die Check-in-Aktion aus dem HTML-Attribut in eine benannte Funktion gehoben und
diese Funktion **zusätzlich** auf Sicherheit geprüft (`gotoCheckinForm()`: nur
`expandCheckinCard()` + `scrollIntoView`, keine Persistenz, keine Engine).

---

## 8. Engine-, Store- und Auth-Diff

**Exakt null.** Die 39 eingefrorenen Dateien aus `docs/gm-ref/gm5_baseline.md` wurden gegen ihre
md5-Summen geprüft:

```
OK = 14      ABWEICHEND = 0      FEHLEND = 25
```

„FEHLEND" bedeutet **nicht abweichend**, sondern: diese 25 Dateien sind in der Container-Arbeitskopie
nicht vorhanden (u. a. `js/sync.js`, `js/auth.js`, `js/calc.js`, sämtliche `js/engine/*` und
`js/metrics/*`). Sie wurden folglich auch nicht geöffnet, gelesen-und-geändert oder geschrieben.
Die geräteseitige Gegenprüfung dieser 25 Dateien ist **ehrlich offen** — die Geräte-Bridge war in
dieser Sitzung nicht verbunden (`/sessions/.../mnt/Strava/app` nicht erreichbar).

Geänderte Dateien insgesamt, vollständig innerhalb der §7-Leitplanken:

| Datei | md5 vorher | md5 jetzt |
|---|---|---|
| `js/ui.js` | `d546feb533e16a673e43a6e2d7b20fdc` | `aa8376846f8aee53facedfc0a86b82fc` |
| `styles.css` | `0419ae379c414796e2a58660cded2ba7` | `709e847808749352a40626d47c29b8d3` |
| `index.html` | `9d9db850bdaf6346c380896bb72cf172` | **unverändert** |
| `sw.js` | — | **unverändert**, `const C = 'orvia-v8-197'` (genau 1 Treffer) |

Dazu `supabase/tests/gm6_state_contract_test.mjs`, `tools/gm6_parity.mjs`, `docs/gm-ref/gm6/**`.

Nicht geschehen: Engine-, Scheduler-, Store-, Resolver-, Auth- oder Goal-Änderung; neue Demo-Daten;
neue Geschäftslogik; versteckte Legacy-Fallbacks; Cache-Bump; Commit, Push, Deploy.

---

## 9. Offene Live-Prüfpunkte und deklarierte Abweichungen

### 9.1 Ehrlich offen (nicht ausführbar)

* **Angemeldeter Live-Boot.** Weiterhin nicht prüfbar — die Chrome-Extension war in keiner Sitzung
  dieses Projekts verbunden. Damit sind ungeprüft: der reale Boot-Pfad inklusive `#splash`, das
  Verhalten bei tatsächlich abgelaufener Sitzung (S6) und die echte Sync-Zeile mit Live-Daten.
* **macOS-/Arial-Lesbarkeit.** Weiterhin offen; der Container rendert nicht mit der
  macOS-Schriftauswahl.
* **Geräteseitige Verifikation der 25 eingefrorenen Dateien** (§8) — Bridge nicht verbunden.

### 9.2 Dokumentierte Lücken (nicht simuliert)

* **L1 — initialer App-Boot.** Kein datengetriebenes Bootsignal im erlaubten Dateiraum.
* **L2 — tabbezogenes Laden.** Weder Referenzkomponente noch produktives Signal.
* **L3 — Stale (veraltete Daten).** Der Golden Master kennt **nur** die Veraltet-Darstellung des
  `errorView` („ZULETZT", „Zwischengespeicherter Stand"); ein eigenes Stale-Bauteil existiert nicht,
  und außerhalb des Offline-Pfads ist kein zuverlässiges produktives Alters-/Zeitstempelsignal
  verfügbar. Umgesetzt ist deshalb nur die vorhandene GM-Semantik; es gibt bewusst **keine**
  eigenständige Stale-Referenzaufnahme, weil dafür ein Bauteil hätte erfunden werden müssen.
  (Modul-lokal bleibt die bestehende, GM5-abgenommene Kennzeichnung „veraltet" in den
  Erholungskacheln unverändert erhalten — sie stammt aus dem kanonischen Resolver, nicht aus GM6.)
* **L4 — nicht behebbarer Darstellungsfehler.** Keine zweite GM-Fehlerkomponente, kein globales
  Fatal-Signal.
* **L5 — `placeholderView`** ist im finalen Golden Master toter Code und wurde bewusst nicht migriert.
* **Auth-Zustand.** Signal S6 ist vorhanden und zuverlässig, ein GM-Pendant existiert nicht.
  Die bestehende Gate-Darstellung bleibt unverändert (`js/auth.js` eingefroren).
* **Legacy-Zustandsmarkup außerhalb des erlaubten Dateiraums** (`js/activity.js`, `js/profile.js`,
  `js/profile-center.js`, `js/calc.js`, `js/intelligence.js`, `js/workout-ui.js`, `js/orvia-pro.js`
  inkl. `#offline`-Banner in `index.html:93` und `#splash`) — nicht angefasst, Kandidat für eine
  spätere freigegebene Phase.
* **Grenzfall im erlaubten Dateiraum:** `js/ui.js:1889` (Supplement-Stack-Leerzustand als
  `.muted`-Absatz) steht nicht in der §6.1-Inventur und wurde deshalb nicht umgestellt.
  Umstellung auf `gmStateEmpty` ist trivial, bedarf aber Ihrer Freigabe.

### 9.3 Deklarierte Abweichungen vom Golden Master

* **R1 — Reduced Motion (auftragsbedingt).** Der Golden Master nimmt `.sk` **nicht** von der
  Shimmer-Animation aus (`@media (prefers-reduced-motion:reduce)` deckt dort nur `.segwrap`,
  `.oc2 .g-*` und `.sheet` ab). Auftrag §5 verlangt jedoch ausdrücklich
  „Reduced-Motion-Unterstützung der Skeletons". Umgesetzt wurde daher
  `@media (prefers-reduced-motion:reduce){.sk{animation:none}}` (`styles.css:2972 ff.`, mit
  Kommentar als bewusste Abweichung markiert). Der Test prüft beides getrennt: ohne Präferenz bleibt
  der Golden-Master-Shimmer (`sh`), mit Präferenz ist er abgeschaltet (`none`).
  **Das ist die einzige bewusst gegen die Referenz gesetzte Regel dieser Phase** — auf ausdrückliche
  Anweisung, nicht in Eigeninitiative. Ein Widerruf ist eine Ein-Zeilen-Änderung.
* **G-A1 — Stimmungsauswahl auf Stufe a.** Die GM-Struktur `div.card > .ci-simple` mit drei
  `.mood`-Elementen wurde übernommen (Struktur- und Pixelparität). Die drei Elemente lösen die
  **bestehende sichere Aktion** aus (`expandCheckinCard()` + Sprung zu `#morningForm`) — dieselbe,
  die ORVIAs `.checkin`-Zeile heute schon auslöst. Der `.on`-Zustand der Referenz wurde **nicht**
  nachgebildet: `window.setMood` des Golden Masters persistiert nichts, ORVIA hat im Morgen-Check-in
  kein Stimmungsfeld — ein persistierender Picker wäre neue Geschäftslogik (§4/§7 unzulässig), ein
  rein visueller Picker ein funktionsloses Bedienelement.
* **Spannung §3 gegen die Referenz — „Offline mit Cache".** Auftrag §3 fordert „Offline mit Cache
  zeigt vorhandene Daten plus Offline-Status". Der Golden-Master-`errorView` rendert **nach dem
  Hero nichts mehr** — keine Module, kein Check-in, kein `addmod`. Umgesetzt ist die Referenz:
  der zwischengespeicherte Wert bleibt im Hero sichtbar (gedimmter Ring, „ZULETZT"), der
  Offline-Status steht in der `.errbar`. Die Module bleiben im Offline-Zustand also **ausgeblendet**,
  weil der Golden Master das so vorgibt. Wenn Sie stattdessen sichtbare Module im Offline-Zustand
  wünschen, wäre das eine Abweichung von der Referenz und braucht Ihre ausdrückliche Entscheidung.
* **Sync-Zeilentext.** `header(false)` / `header(true)` des Golden Masters enthalten Demo-Texte
  („Garmin · vor 6 Min synchronisiert" bzw. „Kein Gerät verbunden"). ORVIA schreibt dort weiterhin
  den echten Sync-Zustand. Der Text ist im Paritätslauf als dynamischer Inhalt eng maskiert; die
  **Struktur** (`span.pulse` + Textknoten) ist identisch. Es wurden keine Demo-Texte übernommen.

---

## Fazit

GM6 ist vollständig grün: 353 Vertragszusicherungen, 283 Paritätszusicherungen, 17 unveränderte
Suiten, Struktur-Diff 0 in jedem geprüften Zustand, höchster Pixel-Diff 1,96 % bei einem Gate von
2 %, Komponentenparität vollständig unmaskiert mit drei Werten bei exakt 0 px. Der Golden Master ist
unverändert, `orvia-v8-197` ist unverändert, Engine/Scheduler/Stores/Resolver/Auth/Goals sind
unangetastet, und es wurde nichts committet, gepusht oder deployt.

Vier Zustände der Auftragsmatrix (L1, L2, L3 teilweise, L4) und der Auth-Zustand sind als Lücken
dokumentiert statt simuliert — der Golden Master besitzt für sie keine Komponente bzw. ORVIA kein
zuverlässiges Signal. Vier Punkte brauchen eine Entscheidung von Ihnen: die Reduced-Motion-Regel
(bewusst gegen die Referenz, weil §5 es verlangt), die Modul-Sichtbarkeit im Offline-Zustand,
der `.on`-Zustand der Stimmungsauswahl und der Supplement-Stack-Leerzustand.

**GM7 bleibt gesperrt bis zu Ihrer ausdrücklichen Freigabe.**

---
---

# GM6.1-Nachtrag — Funktionsabschluss

Stand: Abschluss GM6.1 · Golden Master md5 **`1b93e15e23054318c8848d5cb10e6bcb`** erneut geprüft,
unverändert · `sw.js` unverändert `const C = 'orvia-v8-197'` (genau 1 Treffer) · kein Commit,
kein Push, kein Deploy.

Vollständige Nachweisführung: **`docs/gm-ref/gm6/gm61_ground_truth.md`**.

**Ergebnis: GM6.1 technisch fertig — aber nach §7 nicht final abgenommen**, weil die
Gerätebrücke weiterhin nicht verbunden ist.

Geänderte Dateien in GM6.1 (vollständig): `js/ui.js` (2 Bearbeitungen, reine UI-Orchestrierung),
`supabase/tests/gm61_contract_test.mjs` (neu), `tools/gm6_parity.mjs`, `docs/gm-ref/gm6/**`.
`styles.css` md5 `709e847808749352a40626d47c29b8d3` und `index.html` md5
`9d9db850bdaf6346c380896bb72cf172` blieben **unverändert**.

## N1. Die vier zuvor offenen Entscheidungen — jetzt umgesetzt

| Punkt | Entscheidung des Auftraggebers | Umsetzung |
|---|---|---|
| §1 Reduced Motion | Regel bleibt, ausdrücklich freigegeben | `styles.css:2977` innerhalb der Media-Query; Basisregel byte-identisch zu GM:194; ohne Präferenz keine Darstellungsänderung |
| §2 Offline vs. Hard-Error | zwei getrennte Zustände, kein Zielkonflikt | additive `.errbar` bei Offline+Cache, reduzierter GM-Fehler-Hero nur im Hard-Error, kein Retry offline |
| §4 Stimmungsauswahl | `.on` exakt aus dem GM migrieren | kanonisch aus dem Check-in-Wert, kein zweiter Speicher, Tap/Enter/Space |
| §5 Supplement-Leerzustand | exakte GM-Empty-Komponente | `coOpen`-Gate behoben, `gmStateEmpty(...)`, keine Demo-Einträge |

## N2. §3 — produktive Loading-Verdrahtung

Boot ist **vollständig synchron** (`renderDay();` als Top-Level-Anweisung `js/ui.js:3504`;
`ui.js` @33052 vor `auth.js` @36028; kein `await`/`.then(`/`setTimeout(` in `renderDay()`).
Deshalb **kein künstlicher Boot-Spinner**.

Die zwei echten asynchronen Grenzen liegen im Analyse-Tab und erreichen die GM-Skeletons
produktiv: `gmAnaResolved() → ORVIA.profileMetricResolver.collect(...)` und
`gmAnaBodyModel() → ORVIA.gymVolume.getProductiveVolumeModel(...)`.
`js/activity.js` ist eingefroren und scheidet als Ziel aus.

**Dabei behobener echter Produktionsfehler:** der Wächter lautete nur `!_gmAnaCollecting`.
Nach `done('error')` startete jedes Re-Render sofort einen neuen `collect()`, der Fehlerzustand
war nie sichtbar und ein dauerhaft fehlschlagender Resolver erzeugte eine Endlosschleife aus
Aufrufen. Behoben durch `&& _gmAnaState!=='error'` (ui.js:4686) bzw. `&& _gmMvState!=='error'`
(ui.js:4872); Auflösung nur über das bestehende `gmAnaRetry()`.

## N3. §2 — Umbau des Paritätswerkzeugs, offengelegt

Der Golden Master besitzt **keinen** Zustand „offline mit nutzbarem Cache". Ein Diff gegen den
GM-`errorView` misst deshalb gegen die falsche Referenz; die 30,5–36,6 % sind exakt der Umfang
der Module, die §2 ausdrücklich sichtbar behalten will.

Der GM-Wert wird weiterhin gemessen und **ehrlich als informativ ausgewiesen**, aber nicht
gegated. An seine Stelle treten zwei strengere Verträge:

1. **Struktur, exakt:** GM-Gutzustandssequenz mit genau einer nach `sync` eingefügten `errbar`;
   plus elementweiser Geometrievergleich der bereinigten Sequenz.
2. **Pixel, PROD gegen PROD:** Datenzustand gegen Offline-Zustand derselben Anwendung, um
   exakt die gemessene `errbar`-Höhe versetzt (`diffShift()`). Ergebnis **0,01–0,03 % bei
   68 px Versatz**.

Die `errbar`-Komponente selbst bleibt **gegen den Golden Master** gemessen: **1,79 %, ohne
Maske**. Keine Maskenerweiterung, keine Referenznormalisierung, GM-Datei unverändert.

Die Retry-Prüfung wurde **verschoben, nicht entfernt**: sie läuft jetzt gegen `error_nodata`
und wird ergänzt um die positive Zusicherung, dass `offline_cache` null Retry-Knöpfe, aber
sehr wohl die `.errbar` trägt.

## N4. §6 — gelöschte Legacy-Blöcke

`renderCommand` #1 (`.occ`-Markup, Helfer `proTechLine`) und `renderCheckinCompact` #1
(`.cic-`-Markup). Beide waren durch spätere Neudefinition tot. Heute je genau **eine**
Definition (`ui.js:4050` bzw. `ui.js:3836`); alle fünf Aufrufstellen (619, 1108, 1125, 1773,
2037) lösen auf die GM-Versionen auf. `proTechLine`: **Code 0 Treffer**, Dokumentation genau 1.
Keine Eingabe-, Safety- oder Persistenzfunktion verloren (kein `save()`/`saveDB()`/
`orviaSchedulePush()` in den gelöschten Blöcken). Verwaistes `.cic-*`-CSS bleibt bewusst
stehen → GM7.

## N5. Pixelbilanz GM6.1

Alle gegateten Ansichten **≤ 2 %**, Struktur-Diff **0**, kein horizontaler Überlauf, keine
sichtbaren Legacy-Komponenten.

Höchstwerte 430 px: `f_good` 1,86 · `f_pending` 1,86 · `f_local_only` 1,86 · `f_attention` 1,96 ·
`f_partial` 1,85 · `f_offline_nodata` 1,74 · `f_error_nodata` 1,74 · `p_good` 1,25 ·
`a_good` 1,19 · `f_ciopen` 1,09 · `p_crit` 0,53.
390 px: `f_good` 0,58 · `f_loading` 0,63 · `f_empty` 0,59 · `f_partial` 0,57.
Loading/Empty: `a_loading` 0,02 · `f_loading` 0,5 · `p_loading` 0 · `a_empty` 0,01 ·
`f_empty` 0,56 · `p_empty` 0.
Komponenten (unmaskiert): `sk_card` 0 · `sk_kcard` 0 · `retry_btn` 0 · `empty_card` 0,91 ·
`errbar` 1,79. `gmsub_settings` 0.

§2-Ansichten, PROD gegen PROD, Versatz 68 px (GM-Wert informativ):
`a_offline_cache` 0,01 % (GM 36,6) · `f_offline_cache` 0,01 % (34,11) ·
`p_offline_cache` 0,03 % (30,5) · `f_offline_nav` 0,01 % (34,11) ·
`f_offline_sync` 0,01 % (34,11) · `f_error` 0,01 % (34,11) ·
`f_offline_cache_390` 0,01 % (32,06) · `f_error_390` 0,01 % (32,06).

## N6. Testbilanz GM6.1 (Container)

19 Testdateien, **alle exit 0, alle ALL PASSED**:
`gm61_contract` 99 · `gm6_state_contract` 424 · `gm5_profile_parity` 47 · `gm4_analysis_parity` 52 ·
`gm3_activity_parity` 53 · `gm2_plan_parity` 28 · `gm1_shell` 20 · `plan_weeklist_v5` 27 ·
`shell_v3_migration` 26 · `analysis_endurance_v5` 23 · `analysis_recovery_v5` 23 ·
`plan_quality_v5` 23 · `plan_weekvolume_v5` 22 · `plan_phases_v5` 19 · `checkin_compact` 16 ·
`muscle_map_pilot` 16 · `orvia_charts` 14 · `dashboard_v5_phaseb` 8 · `ui_detail_mode` ALL PASSED.
Werkzeug `tools/gm6_parity.mjs`: **ALL PASSED (284 ok)**.

**Ehrliche Einordnung — keine stille Verbesserung:** Die Baseline „174 Tests, 168 grün,
6 ENV-Fehler" (`gm5_baseline.md:65`) ist die **Gerätesuite mit 174 Dateien in vier Blöcken**.
Der Container enthält nur 19 Testdateien; **keine** der sechs ENV-abhängigen Supabase-Dateien
(`batch2f_offline_queue_live`, `live_workout_rls_phase42`, `live_workout_rpc_smoke_phase42`,
`muscle_volume_sql_phase43`, `rls`, `training_rls_phase41`) ist im Container vorhanden
(je 0 Treffer). Die „null ENV-Fehler" sind daher eine **andere, kleinere Testpopulation**,
keine Verbesserung. Die sechs ENV-Fehler sind unverändert zu erwarten, sobald die Suite wieder
auf dem Gerät läuft.

## N7. Offen (§7)

Gerätebrücke nicht verbunden. Nicht ausführbar: 39/39-md5-Prüfung der eingefrorenen Dateien,
vollständige Gerätesuite auf Baseline, Byte-Vergleich Container ↔ Gerät, angemeldeter Live-Boot.
Gemäß §7: **GM6.1 technisch fertig, nicht final abgenommen.**

**GM7 bleibt gesperrt bis zur ausdrücklichen Freigabe.**
