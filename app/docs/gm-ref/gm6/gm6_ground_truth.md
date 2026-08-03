# GM6 · Ground Truth vor Implementierung

Erfasst: 2026-07-26 · Golden Master `/tmp/orvia_dashboard_5.html`, md5 **`1b93e15e23054318c8848d5cb10e6bcb`**
(unverändert verifiziert) · Produktivstand `js/ui.js` md5 `d546feb533e16a673e43a6e2d7b20fdc`,
`index.html` `9d9db850bdaf6346c380896bb72cf172`, `styles.css` `0419ae379c414796e2a58660cded2ba7`
(alle drei zum Zeitpunkt dieser Erhebung unverändert). Keine Engine-/Store-Datei gelesen-und-geändert.

Diese Datei erfüllt GM6 §1 („Dokumentiere vor der Implementierung kompakt: …"). Die maschinell
erzeugte DOM-Referenz liegt daneben in `gm6_gm_domspec.json` (3 Level × 6 Szenarien × 2 Viewports).

---

## 1. Vorhandene Golden-Master-Zustände und exakte DOM-Reihenfolge

### 1.1 Vollständige Zustandsinventur des Golden Masters

Der Golden Master besitzt **genau drei** Zustandsansichten. Alle drei sind ausschließlich über
`originalDashboardRender()` erreichbar, also **nur auf dem Dashboard-Tab**:

| Funktion | Zeile | überschrieben? | erreichbar über |
|---|---|---|---|
| `loadingView()` | 632 | nein (final) | `originalDashboardRender()`, `scen==='loading'` |
| `errorView()` | 636 | nein (final) | `originalDashboardRender()`, `scen==='error'` |
| `emptyView()` | 640 | nein (final) | `originalDashboardRender()`, `scen==='empty'` |
| `placeholderView()` | 663 | nein | **toter Code** — das finale `render` (@1532) fängt `tab==='act'` vorher ab |

Steuergröße ist `let scen="good"` (@453). Das Dev-Panel `#scen` (@327) kennt exakt sechs Werte:
`good`, `attention`, `crit`, `empty`, `loading`, `error`; der Handler (@711) erzwingt dabei
`tab='dash'`. Es gibt im Golden Master **keine weitere Zustandsdimension** — kein Partial, kein
Stale, kein Offline-ohne-Cache, kein Auth-Zustand, kein Tab-Loading.

Klassenzählung über die gesamte Referenzdatei (belegt, dass in `planView`, `analysisHubView`,
`fullPageView` und `profileView` kein weiteres Zustands-Markup existiert):

```
class="sk"        11×  (alle in loadingView)
class="empty"      4×  (emptyView @641/@645; activityView @1514/@1880)
.e-ic 4×  .et 4×  .ed 2×  .eb 2×
.gapnote           1×  (emptyView)
.errbar            1×  (errorView)
.placeholder       1×  (toter placeholderView)
```

**Wichtig für §2:** Der GM-`errorView` ist inhaltlich die **Offline-mit-Cache-Darstellung**
(`errbar` „Offline — letzte Daten von 07:14." + gedimmter Cache-Ring `opacity:.55` + Label
„ZULETZT" + „Zwischengespeicherter Stand" + Retry-Button). Der Golden Master trennt „Fehler" und
„Offline" nicht — es gibt genau eine Komponente für beides.

### 1.2 Exakte DOM-Reihenfolge je Zustand (Quelle: `gm6_gm_domspec.json`, 430 px)

```
a/loading  [statusbar, hdr, span.lvlbadge, sync, hero, card, kgrid]                 sk=14  empty=0
f/loading  [statusbar, hdr,                sync, hero, card, kgrid]                 sk=20  empty=0
p/loading  [statusbar, hdr, span.lvlbadge, sync, hero, card, kgrid]                 sk=20  empty=0

a/empty    [statusbar, hdr, span.lvlbadge, sync, hero.gap, gapnote, card, sectlabel, card, addmod]        empty=2
f/empty    [statusbar, hdr,                sync, hero.gap, gapnote, card.tight, sectlabel, card, addmod]  empty=2
p/empty    [statusbar, hdr, span.lvlbadge, sync, hero.gap, gapnote, card.tight, sectlabel, card, addmod]  empty=2

a/error    [statusbar, hdr, span.lvlbadge, sync, errbar, hero]                      sk=0   empty=0
f/error    [statusbar, hdr,                sync, errbar, hero]                      sk=0   empty=0
p/error    [statusbar, hdr, span.lvlbadge, sync, errbar, hero]                      sk=0   empty=0
```

Für **alle** Zustände gilt: `fab=flex`, `tabOn=dash`, Tabbar vollständig vorhanden.
**Shell und Tabbar schrumpfen im Golden Master in keinem Zustand.** 390 px ist strukturidentisch.

Skeleton-Anzahl: Hero 6 + Card 2 + KCard 3×N, mit N = 2 (Level a) bzw. 4 (Level f/p) ⇒ 14 / 20.

**Loading und Error verwenden `header(false)`, Empty verwendet `header(true)`.** Der einzige
Unterschied in `header(isGap)` (@1495) ist der Inhalt der Sync-Zeile:

```
isGap=false → <div class="sync"><span class="pulse"></span> Garmin · vor 6 Min synchronisiert</div>
isGap=true  → <div class="sync"><span class="pulse"></span> <span style="color:var(--attention)">Kein Gerät verbunden</span></div>
```

Beides sind **Demo-Texte der Referenz**. Produktiv schreibt `renderDay()` (`js/ui.js:2054`) den
echten Sync-Zustand aus S1 in `#syncTxt` und setzt `#syncLine.dataset.state`. ORVIA hat damit
immer die Kindstruktur `[span.pulse, span#syncTxt]` — strukturell eine Obermenge der
`isGap=false`-Fassung und identisch zur `isGap=true`-Fassung. Der Sync-Text ist folglich
**dynamischer Inhalt** (Maskierung im Paritätslauf zulässig, §6), nicht Struktur. GM6 übernimmt
hier **keine** Demo-Texte.

### 1.3 Teilbaum `empty` (Level f, autoritativ)

```
div.sync      [span.pulse, span{color:var(--attention)} «Kein Gerät verbunden»]
div.hero.gap
  div.empty {padding:24px 14px}
    div.e-ic {width:64px;height:64px;border-radius:20px}      → icon('db')
    div.et   {font-size:15px}   «Noch keine Bereitschaft berechnet»
    div.ed   [b{color:var(--activity)} «Das ist kein schlechter Wert»]
    div.eb   {margin-top:16px}  «Garmin verbinden»
div.gapnote   [icon, div [b «Datenlücke ≠ Score 34.»]]
div.card.tight → checkinCard(DATA.good)
div.sectlabel  [span.edit @openMM() «Anpassen»]
div.card      [div.empty [e-ic(moon), et «Schlaf & Erholung», ed, eb «Manuell erfassen»]]
div.addmod    @openMM() «Modul hinzufügen»
```

**Befund:** `emptyView` enthält **kein `.eduhint`** — auch nicht auf Level a. ORVIAs
`renderModules()` stellt im Empty-Zweig aber den `head` mit `eduhint` (für `lvl==='a'`) voran.
Das ist eine konkrete Strukturabweichung, die GM6 beseitigen muss.

### 1.4 Teilbaum `error` (autoritativ)

```
div.errbar  [icon('wifi','sm'), div [b «Offline — letzte Daten von 07:14.» …]]
div.hero
  div.hero-top
    div.ring-wrap {width:150px;height:150px;opacity:.55}
      → ring(82,'var(--neutral)')
      div.ring-c [div.big{color:var(--muted)} «82», div.u «ZULETZT»]
    div.hero-right
      div.lead {color:var(--muted)} «Zwischengespeicherter Stand»
      div.why  «Werte könnten veraltet sein. Ziehe zum Aktualisieren …»
  button.cta.wide-ghost {margin-top:14px} @go('dash')  [icon('wifi','sm'), «Erneut versuchen»]
```

**Nach dem Hero folgt nichts mehr** — keine Module, kein Check-in, kein `addmod`.

### 1.5 Zustands-CSS (Golden Master, wörtlich)

`.empty`/`.e-ic`/`.et`/`.ed`/`.eb` @184–189, `.gapnote` @190–192, `.errbar` @193–195,
`.sk` + `@keyframes sh` @302–303, `.placeholder` @304.

**Reduced-Motion-Lücke:** `@media (prefers-reduced-motion:reduce)` @839 deckt `.segwrap`,
`.oc2 .g-*` und `.sheet` ab — **nicht `.sk`**. Die Golden-Master-Skeletons animieren also auch
bei `prefers-reduced-motion:reduce` weiter. Siehe §4, Punkt R1.

---

## 2. Produktive Zustandssignale (vorhanden, unverändert nutzbar)

| # | Signal | Ort | Werte | Zuverlässigkeit |
|---|---|---|---|---|
| S1 | `window.orviaSyncState()` | `js/sync.js:68` (eingefroren) | `local` \| `synced` \| `pending` \| `error` \| `offline` | hoch, einzige Quelle |
| S2 | `navigator.onLine` + `online`/`offline`-Events | `js/orvia-pro.js:275` (`initOffline`), `js/sync.js` | bool | hoch |
| S3 | `gmDashVM()`-`noData` | `js/ui.js:3729 ff.` / `gmDashState()` @3936 | bool (kein Score, kein Check-in, HRV/Schlaf/Batterie alle `null`) | hoch |
| S4 | Kanonische Missingness der Resolver | `GM_NA` (`js/ui.js:5`), `M.*==null`, `MSTAT.no_data`/`MV_STATUS_META.no_data` | `null` / `'no_data'` | hoch |
| S5 | `Calc.loadConfidenceContract().suppressNumbers` | `js/calc.js` (eingefroren), konsumiert `js/ui.js:3153/3372/3599` | bool ⇒ ATL/CTL/TSB/ACWR = `null` | hoch |
| S6 | Auth: `sb.auth.onAuthStateChange('SIGNED_OUT')` + `html.orvia-gated` | `js/auth.js:169 ff.` (eingefroren) | Gate sichtbar / verborgen | hoch; deckt laut Kommentar ausdrücklich **abgelaufene Sitzungen** ab |
| S7 | Boot/Splash | `js/orvia-pro.js:274` `hideSplash()` | fester 850-ms-Timer | **niedrig** — zeitbasiert, nicht datengetrieben |
| S8 | Offline-Queue `sync_status` | `js/offline-queue.js` | Enum der Warteschlange | mittel; kein UI-Konsument im erlaubten Dateiraum |
| S9 | `window._gmStateOverride` | `js/ui.js:3950/3961` | `'loading'`\|`'empty'`\|`'error'` | **Testhaken**, produktiv nirgends gesetzt |

Bestehende Konsumenten von S1: `js/ui.js:2054` (`renderDay` schreibt `#syncTxt` und
`#syncLine.dataset.state`), `js/ui.js:4888` (`gmProfSyncLabel()`), `js/ui.js:3548/3549`
(`pagehide`/`visibilitychange` → `orviaFlushSync`), `js/auth.js:240–242` (`orviaSyncStart` nach Login).

---

## 3. Direkte Zuordnung Signal → Golden-Master-Zustand

| GM-Zustand | Bedingung aus produktiven Signalen | Golden-Master-Komponente |
|---|---|---|
| `loading` | ausschließlich S9 (Testhaken). **Produktiv nicht ausgelöst** — siehe §4 L1 | `loadingView`: `hero`+`card`+`kgrid` mit 14/20 `.sk` |
| `empty` | S3 `noData === true` **und** S1 ∉ {`error`,`offline`} | `emptyView`: `hero.gap`+`gapnote`+`card.tight`+`sectlabel`+`card`+`addmod` |
| `error` (= Offline mit Cache) | (S1 ∈ {`error`,`offline`} **oder** S2 `navigator.onLine===false`) **und** verwertbare Cache-Daten vorhanden | `errorView`: `errbar`+`hero` mit gedimmtem Ring, sonst nichts |
| `error` (Offline ohne Cache) | S1/S2 offline **und** S3 `noData === true` | derselbe `errorView`; Ring zeigt `—` statt einer erfundenen Zahl |
| `normal` | sonst | reguläre GM1-Dashboardkette |
| Einzelwert fehlt | S4 pro Kennzahl | `—` bzw. `GM_NA`, **niemals `0`** |
| Belastungswerte nicht belastbar | S5 `suppressNumbers` | Wert unterdrückt + Kontrakt-Note, **niemals `0`** |
| Auth erforderlich / Sitzung abgelaufen | S6 | `html.orvia-gated` blendet `.wrap`, `.tabbar`, `.splash`, `.topbar` aus; Gate übernimmt. **Kein GM-Pendant** — der Golden Master kennt keinen Auth-Zustand; die bestehende Gate-Darstellung bleibt unverändert |

Der Golden Master gewichtet die Zustände in dieser Reihenfolge: `loading` → `error`/offline →
`empty` → `normal`. ORVIAs `gmDashState()` folgt dieser Reihenfolge bereits (`error` vor `empty`).

---

## 4. Nicht vorhandene bzw. nicht zuverlässig erkennbare Zustände (Lücken, nicht simuliert)

Die Zustandsmatrix aus §2 des Auftrags umfasst zwölf Zeilen. Nachfolgend die vollständige
Bewertung; „Lücke" bedeutet: wird dokumentiert, **nicht** erfunden.

| Nr. | Zustand aus §2 | Status | Begründung |
|---|---|---|---|
| 1 | initialer App-Boot / Laden | **Lücke (L1)** | Der einzige Boot-Indikator ist `#splash`, versteckt über einen festen 850-ms-Timer in `js/orvia-pro.js` (nicht im erlaubten Dateiraum, §7). Es existiert kein datengetriebenes Boot-Signal. |
| 2 | tabbezogenes Laden | **Lücke (L2)** | Der Golden Master besitzt keine Tab-Loading-Komponente; `loadingView` ist dashboard-exklusiv. Produktiv gibt es kein Tab-Ladesignal. |
| 3 | vollständig vorhandene Daten | vorhanden | `normal` |
| 4 | vollständig leerer Zustand | vorhanden | `empty` via S3 |
| 5 | teilweise vorhandene Daten | vorhanden, ohne eigene GM-Komponente | Der Golden Master hat **keinen** Partial-Zustand. Umsetzung nach §3: vorhandene Module bleiben sichtbar, nur die fehlenden Slots zeigen GM-Missingness (`—`/`GM_NA`/`.empty`-Kachelinhalt). Kein neues Bauteil. |
| 6 | fehlende Einzelwerte | vorhanden | S4, bereits kanonisch umgesetzt (`GM_NA`, `—`) |
| 7 | veraltete Daten (stale) | **Teil-Lücke (L3)** | Der Golden Master kennt nur eine Veraltet-Darstellung: die des `errorView` („ZULETZT", „Zwischengespeicherter Stand"). Ein separates Stale-Bauteil existiert nicht. Ein produktives Alters-/Zeitstempelsignal außerhalb des Offline-Pfads ist nicht zuverlässig verfügbar. |
| 8 | offline mit vorhandenem Cache | vorhanden | `errorView` — genau dieser Fall ist die GM-Semantik |
| 9 | offline ohne nutzbare Daten | vorhanden, ohne eigene GM-Komponente | derselbe `errorView`, Ring `—`, keine erfundene Zahl |
| 10 | behebbarer Ladefehler | vorhanden | `errorView` + Retry |
| 11 | nicht behebbarer Darstellungsfehler | **Lücke (L4)** | Der Golden Master besitzt keine zweite Fehlerkomponente. Produktiv existieren nur modul-lokale Fehlerpfade (siehe §6), kein globales „fatal"-Signal. |
| 12 | Authentifizierung erforderlich / Sitzung abgelaufen | Signal vorhanden (S6), GM-Pendant **fehlt** | `onAuthStateChange('SIGNED_OUT')` + `orvia-gated` sind produktiv vorhanden und zuverlässig. Der Golden Master hat dafür keine Ansicht; die bestehende Gate-UI bleibt unverändert (`js/auth.js` ist eingefroren). |

**R1 — Reduced Motion.** Der Golden Master nimmt `.sk` **nicht** von der Shimmer-Animation aus.
Eine `@media (prefers-reduced-motion:reduce){.sk{animation:none}}`-Regel wäre eine nicht
beauftragte Abweichung von der Referenz. Präzedenzfall GM5.4 §10.6: dokumentieren, nicht
eigenmächtig verbessern. **Entscheidung des Auftraggebers erforderlich**, falls §5 („Reduced-Motion-
Unterstützung der Skeletons") als Pflicht zur Abweichung gemeint ist. Bis dahin prüft der Test
das Golden-Master-Verhalten (Animation bleibt), nicht ein davon abweichendes Wunschverhalten.

**L5 — `placeholderView` ist toter Code** im finalen Golden Master und darf nicht migriert werden.

**G-A1 — Level-a-Check-in im Empty-Zustand (neue Strukturabweichung).**
`checkinCard(d)` (@505) rendert bei `!ciDone || scen==='empty'` **und** `level==='a'`:

```
div.card > div.ci-simple > div.q «Wie fühlst du dich heute?»
                         + div.moods > 3× div.mood [div.em «😃/🙂/😴», div.ml «Top/Geht so/Müde»]
```

erst bei Level f/p die `div.card.tight > div.checkin`-Zeile. ORVIAs `renderCheckinCompact` (@3837)
setzt dagegen **immer** `class="card tight"` und rendert **immer** `div.checkin`. Das erklärt den
Unterschied `div.card` (a/empty) gegenüber `div.card.tight` (f/p/empty) in `gm6_gm_domspec.json`.
Das zugehörige CSS (`.ci-simple .q`, `.moods`, `.mood`, `.mood .em`, `.mood .ml`, `.mood.on`)
ist in `styles.css:2659–2663` seit GM1 vorhanden, hat aber **keinen Renderer**.

Der Golden-Master-Handler `window.setMood` (@699) schaltet ausschließlich die Klasse `.on` um und
persistiert nichts — die Referenz-Auswahl ist folgenlos. ORVIA besitzt im Morgen-Check-in kein
Stimmungsfeld (`morning`: `sleepMin`, `sleepQ`, `bb`, `knee`, `ill`, `qfeel` …); ein persistierender
Mood-Picker wäre neue Geschäftslogik und nach §4/§7 unzulässig, ein rein visueller Picker wäre ein
funktionsloses Bedienelement.

**Umsetzung in GM6:** Die GM-Struktur wird übernommen, die drei `.mood`-Elemente lösen die
**bestehende sichere Aktion** aus (`expandCheckinCard()` + Sprung zu `#morningForm`) — dieselbe
Aktion, die ORVIAs heutige `.checkin`-Zeile bereits auslöst. Damit: Struktur- und Pixelparität ohne
neue Persistenz und ohne funktionsloses Bedienelement. Der `.on`-Zustand wird **nicht** nachgebildet,
weil er ohne Persistenz eine Auswahl vortäuschen würde. Diese bewusste Abweichung wird im
Abschlussbericht geführt; eine abweichende Entscheidung des Auftraggebers ersetzt sie jederzeit.

---

## 5. Bestehende Retry-Aktionen (vollständige Inventur)

| Aktion | Ort | sicher? | Nebenwirkung |
|---|---|---|---|
| `renderDay()` | `js/ui.js` (Aufruf im `gmErrorHero` @3942) | ja | reine Neudarstellung des Tages |
| `renderMuscleVolume()` | `js/ui.js:1719/1751` | ja | Neuberechnung des Muskelvolumen-Moduls über bestehende Engine-Lesepfade |
| `renderFormFitnessV5()` | `js/ui.js:3628` | ja | Neudarstellung Form & Fitness |
| `renderRecoveryTilesV5()` | `js/ui.js:3670` (`_rcvError`) | ja | Neudarstellung Erholungskacheln |
| `window.orviaSyncStart()` | `js/sync.js:192` | ja, aber startet Sync | kein UI-Retry-Button vorhanden |
| `window.orviaFlushSync()` | `js/sync.js:194` | ja | Push der Warteschlange |
| `window.orviaSchedulePush()` | `js/sync.js:95` | ja, 1500 ms debounced | Push |
| `showGate('login')` | `js/auth.js` | ja | Auth-Gate, kein GM6-Retry |

Golden-Master-Retry ist `onclick="go('dash')"` — also ein reiner Re-Render desselben Tabs.
Das produktive Äquivalent ist `renderDay()`. **Kein Retry-Button darf** die Engine ausführen,
den Trainingsplan neu berechnen, Daten löschen, mehrfache Requests erzeugen oder neue
Persistenzlogik einführen. Wo keine echte Aktion existiert, wird kein Button gerendert.

---

## 6. Zu ersetzende Legacy-Zustandsrenderer

### 6.1 Im erlaubten Dateiraum (`js/ui.js`) — GM6-Scope

| Zeilen | Markup | Bewertung |
|---|---|---|
| 637–686 | `<div class="occ pend">` / `<div class="occ ${dc}">` (`renderCommand` #1) | **bereits toter Code** — Funktionsdeklarationen hoisten, die GM-Fassung @3949 überschreibt sie. Entfernung = Hygiene, nicht Korrektheit. |
| 3559–3581 | `.cic-ic`/`.cic-b`/`.cic-pill` (`renderCheckinCompact` #1) | **bereits toter Code** — dieselbe Hoisting-Situation: die GM-Fassung `renderCheckinCompact` @3837 überschreibt sie. Entfernung = Hygiene. |
| 1079, 1992 | `<p class="note">Check-in-Modul nicht geladen.</p>` | Legacy-Fehlerdarstellung |
| 1719, 1751 | `.mv-note` + `.muted` + `<button class="btn sec">Erneut versuchen</button>` | Legacy-Fehler + Legacy-Button-Klasse |
| 3597 | `<p class="muted">Diagramm-Modul nicht geladen.</p>` | Legacy |
| 3628 | `Form & Fitness konnte gerade nicht dargestellt werden.` + `btn sec` | Legacy |
| 3660 | `<p class="muted">Metrik-Modul nicht geladen.</p>` | Legacy |
| 3670 | `_rcvError` + `btn sec` | Legacy |
| 3681 | `Noch keine synchronisierten Erholungswerte für heute.` | Legacy-Empty |
| 2829, 3072, 3135, 3275 | „Noch keine …"-`.muted`-Absätze (Prognose, Bestzeiten, Schwimmen) | Legacy-Empty |
| 1509, 1520, 1575, 1582, 1623, 1637–1647 | `{label:'Keine Daten', key:'no_data'}` (Muskel-Statusmodell) | **Datenvertrag, kein Renderer** — bleibt unverändert; nur die Darstellung ist GM-gebunden (`GM_MV_META` @4682 ff. ist bereits GM-konform) |
| 4362 | Aktivitätsliste leer | **bereits GM-`.empty`** — nichts zu tun |

### 6.2 Außerhalb des erlaubten Dateiraums — dokumentierte Lücken, kein GM6-Scope

Legacy-Zustands-Markup existiert zusätzlich in eingefrorenen bzw. nicht freigegebenen Dateien:
`js/activity.js`, `js/profile.js`, `js/profile-center.js`, `js/calc.js`, `js/intelligence.js`,
`js/workout-ui.js`, `js/orvia-pro.js` (`#offline`-Banner + `#splash`). Diese werden in GM6
**nicht** angefasst und im Abschlussbericht als offene Punkte geführt.

Der `#offline`-Banner in `index.html:93` (`<div class="offline" id="offline">Offline-Modus — Daten
werden lokal gespeichert.</div>`) ist die einzige globale Offline-Anzeige und hat **kein**
Golden-Master-Pendant; er wird über `initOffline()` in `js/orvia-pro.js` gesteuert.

---

## 7. Erlaubte Dateien (GM6 §7)

**Schreibend erlaubt:**

```
index.html                          (nur falls zwingend erforderlich)
styles.css
js/ui.js                            (bestehende GM-UI-Datei)
supabase/tests/gm6_state_contract_test.mjs
tools/gm6_parity.mjs
docs/gm-ref/gm6/**
```

**Nicht erlaubt:** Engine-, Scheduler-, Store-, Resolver-, Auth-, Goal-Änderungen; neue Demo-Daten;
neue Geschäftslogik; versteckte Legacy-Fallbacks; Testabschwächungen; Commit, Push, Deploy.
`orvia-v8-197` bleibt unverändert, kein weiterer Cache-Bump.
Die 39 eingefrorenen Dateien aus `docs/gm-ref/gm5_baseline.md` bleiben byte-identisch.
Fixture-Zustände existieren ausschließlich im Test-Harness (`/tmp/gm6h.html`), niemals im Produktivcode.

---

## 8. Architekturbewertung: kein echter Blocker

Die Lücken L1–L5 und R1 sind **Referenz- bzw. Signallücken, keine Architekturblocker**. Die
GM6-Umsetzung kann testgetrieben starten, weil:

* alle drei Golden-Master-Zustandskomponenten produktiv bereits existieren (`gmLoadingHero`,
  `gmLoadingMods`, `gmErrorBar`, `gmErrorHero`, `gmEmptyHero`, `gmEmptyMods` @3927–3944) und nur
  in Details von der Referenz abweichen,
* die Zustandsableitung (`gmDashState()` @3936) auf ausschließlich vorhandenen Signalen beruht,
* die verbleibende Arbeit strukturell ist: Skeleton-Anzahl levelabhängig (14/20 statt fix 20),
  `header(true)`/`header(false)`-Unterscheidung, `eduhint` im Empty-Zweig entfernen, Legacy-
  Renderer im erlaubten Dateiraum durch GM-Komponenten ersetzen, Missingness nie als `0`.

Nicht implementierbar bleiben L1, L2, L4 (kein Signal bzw. keine Referenzkomponente) und die
Auth-Ansicht (kein GM-Pendant, `js/auth.js` eingefroren). Diese werden im Abschlussbericht als
Lücken geführt und nicht simuliert.
