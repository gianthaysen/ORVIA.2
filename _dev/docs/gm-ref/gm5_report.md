# GM5-Bericht — Profil + sämtliche verlinkte Unterseiten

Stand: 2026-07-26 (GM5.3, § 9a) · Geräte-HEAD unverändert `014ac6f` · SW `orvia-v8-197` genau 1× (kein Bump).
Referenz: finale aktive profileView-Verkettung des Golden Masters (`orvia_dashboard_5_1.html`):
`profileView` (Basis + „Leistung & Fortschritt" + Tabspacer) sowie alle 17 verlinkten Unterseiten.

## 1. Profil-DOM-Parität

Exakte GM-Reihenfolge produktiv umgesetzt: `.profile-cover` → `.ig-profile` (`.ig-top` mit
Avatar/„Profil bearbeiten"/Einstellungsbutton, Name, Handle, Bio, `.ig-stats` mit exakt 4 Zellen)
→ „Deine Sportarten" + `.sport-chips` → „Zielreise" + `.goal-stack` → „Profil & Kontrolle"
(3 Zeilen) → „Leistung & Fortschritt" (4 Zeilen) → `.tabspacer`. Kein sichtbarer A/F/P-Schalter
auf der Profilseite (Detailtiefe nur über „Ansicht & Detailtiefe"), keine alte Profilkarte, kein
Legacy-Overlay. Struktur-Assertions im Werkzeug: 4 Stats, 1 Zielkarte, 3+4 Settingzeilen, kein
`.seg-nav`/`.choice-grid` auf der Hauptseite — grün.

## 2. Unterseiten-Parität

Alle 17 Unterseiten (Einstellungen, Ansicht & Detailtiefe, Benachrichtigungen, Datenschutz & KI,
Ziele & Sportarten, Tagesziele, Plan & Wochenstruktur, Gesundheit & Check-in, Geräte & Datenquellen,
Einheiten & Berechnungen, Daten verwalten, Konto & Sicherheit, Hilfe & über ORVIA, Bestzeiten,
Medaillen, Meilensteine, Pace-Rechner) mit GM-Aufbau: `.page-head`/`.page-head-row`/`.backbtn`/
Titel/Untertitel/optional `.page-action`, GM-Seitenränder, `.setting-title`/`.setting-group`/
`.setting-item`, bestehende GM-Komponenten. Unterseiten liegen als Overlay (`#gmProfPage`,
z-index 150) über der Tabbar — kein sichtbarer Tabbar/FAB (per Assertion geprüft).
Back bewahrt Seite, Modus und Scrollposition; Fokus kehrt zum Auslöser zurück (grün).

## 3. Diff-Werte (Pixel, Schwelle ≤ 2 %, beide Viewports)

Stand **GM5.2**. Alle früheren Tabellen dieses Abschnitts (GM5.0 mit Referenznormalisierung,
GM5.1 mit inhaltsabhängiger `fit-content`-Breite) sind **ungültig**. Die folgenden Werte
stammen aus dem Lauf gegen die **unveränderte** Referenz mit entkoppelter Slotgeometrie.

| Zustand | 430×900 | 390×844 |
|---|---|---|
| Profil A / F / P | 0,66 % / 0,66 % / 0,66 % | 0,73 % / 0,73 % / 0,73 % |
| settings | 1,18 % | 1,44 % |
| appearance | 0,28 % | 0,33 % |
| notifications | 0,13 % | 0,15 % |
| privacy | 0,03 % | 0,05 % |
| goals | 0,03 % | 0,03 % |
| dailyGoals | 0,00 % | 0,01 % |
| planSettings | 0,59 % | 1,00 % |
| health | 0,37 % | 0,41 % |
| connections | 0,65 % | 0,72 % |
| units | 0,19 % | 0,20 % |
| data | 0,53 % | 0,58 % |
| account | 0,21 % | 0,23 % |
| about | 0,19 % | 0,21 % |
| **bestTimes, vollständig** | **1,41 %** ✔ (vorher 1,63) | **1,55 %** ✔ (vorher 1,80) |
| **bestTimes, fehlend** | **1,41 %** ✔ (neu) | — |
| medals | 0,00 % | 0,00 % |
| **milestones, Produktzustand** | **1,11 %** ✔ (vorher 3,06 ❌) | **1,22 %** ✔ (vorher 3,37 ❌) |
| **milestones, volles 6er-Zielportfolio** | **1,19 %** ✔ (vorher 2,13 ❌) | — |
| **milestones, fehlend** | **1,09 %** ✔ (neu) | — |
| paceCalc | 0,45 % | 0,32 % |

**Jede einzelne Seite ≤ 2 %. Höchstwert 1,55 % (bestTimes390), Median ≈ 0,4 %.**
Kein horizontaler Überlauf in irgendeinem Zustand. Struktur-Diff 0 (Slotanzahl, Reihenfolge,
Containeraufbau identisch). Missingness-Zustände: alle Slots vorhanden, keine 0-statt-Missing-Werte.

### 3.1 Tatsächliche Computed Styles beider Seiten (vor der Änderung gemessen)

Der Golden Master rendert `.bt-row` und `.mile` in den Unterseiten als `<button>`. Formularelemente
sizen bei `width:auto` nach `fit-content` und erben UA-Defaults — auch mit `display:flex`. Der
GM-Autor hat das bei `.medal` bewusst entschärft (`font-family:var(--font)`, GM-Zeile 1668), bei
`.bt-row`/`.mile` nicht. Gemessen (`/tmp/e3h/cstyle.json`, GM in den Varianten *pure*, *frame*,
*frame+inter*, beide Viewports — in allen sechs Kombinationen identisch):

| Eigenschaft | Golden Master | ORVIA vor GM5.2 | ORVIA nach GM5.2 |
|---|---|---|---|
| `font-family` | `Arial` | `Inter, Geist, Manrope, …` | `Arial` |
| `font-size` | `13.3333px` | `16px` | `13.3333px` |
| `text-align` | `center` | `start` | `center` |
| `appearance` | `auto` | `none` | `none` (rein visuell folgenlos, s. u.) |
| `padding` | `13px 14px` | identisch | identisch |
| `gap` | `12px` | identisch | identisch |
| `border` | `1px solid` | identisch | identisch |
| `border-radius` | `15px` | identisch | identisch |
| `margin-bottom` | `9px` / `10px` | identisch | identisch |
| `align-items` | `center` / `flex-start` | identisch | identisch |
| `box-sizing` | `border-box` | identisch | identisch |
| Höhe | 62 px / 91 px | identisch | identisch |
| X-Position | 18 px | identisch | identisch |
| Container-Padding | `0px 18px` | identisch | identisch |

Die frühere GM5.1-Entscheidung, Inter beizubehalten, war eine Produktentscheidung und ist
zurückgenommen: der tatsächliche Computed Style der unveränderten Referenz ist verbindlich und
wird jetzt lokal in `#gmProfPage` übernommen.

**Umgebungsvorbehalt — ehrlich ausgewiesen.** Im Container ist weder Inter noch Arial installiert
(`fc-list | grep -ci inter` = 0; `fc-match Arial` → `LiberationSans-Regular.ttf`), und
`document.fonts` ist auf beiden Seiten leer, weil die Google-Fonts-Einbindung offline nicht auflöst.
CDP `CSS.getPlatformFontsForNode` belegt: **beide Seiten rendern physisch Liberation Sans**. Die
Schriftübernahme ist hier also metrisch neutral und wird vom Pixel-Gate **nicht** validiert. Auf
dem macOS-Gerät ist sie eine reale, sichtbare Änderung — und sie ist die Voraussetzung dafür, dass
die fixierten GM-Breiten in sich stimmig sind, weil diese unter Arial-Metrik entstanden sind.

### 3.2 Entkoppelte Slotgeometrie (Lösung des Zielkonflikts)

Unter der GM-eigenen `fit-content`-Regel gilt Kartenbreite ≡ f(Inhalt). Da ORVIA ausschließlich
echte Daten bzw. ehrliche Missingness zeigt, wäre Breitengleichheit nur über Demo-Texte erreichbar.
GM5.2 entkoppelt deshalb Geometrie von Inhalt: die sechs Slotbreiten sind feste, slotbezogene
CSS-Tokens, gemessen an der unveränderten Referenz.

**Ground Truth, geprüft statt vorausgesetzt** (`docs/gm-ref/rowgeom_*.json`):

| Slot | Meilensteine 430 | Meilensteine 390 | Bestzeiten 430 | Bestzeiten 390 |
|---|---|---|---|---|
| 1 | 241,140625 | 241,140625 | 213,953125 | 213,953125 |
| 2 | 200,296875 | 200,296875 | 213,953125 | 213,953125 |
| 3 | 200,296875 | 200,296875 | 213,953125 | 213,953125 |
| 4 | 186,96875 | 186,96875 | 211,796875 | 211,796875 |
| 5 | 204,046875 | 204,046875 | 226,796875 | 226,796875 |
| 6 | 242,71875 | 242,71875 | 245,125 | 245,125 |

Die vorgegebenen Referenzwerte `241,1 · 200,3 · 200,3 · 187,0 · 204,0 · 242,7` sind damit
bestätigt. Die 390-px-Werte wurden **erneut direkt am unveränderten Golden Master gemessen**, nicht
aus dem 430er-Lauf übernommen. Dass sie identisch sind, ist erklärt, nicht nur beobachtet: die
verfügbare Inhaltsbreite beträgt 394 px (430) bzw. 354 px (390) und liegt damit über dem breitesten
Referenzslot (245,125 px) — `fit-content` wird nicht beschnitten.

**Präzisionshinweis (echter Fehler, gefunden und behoben).** Chromium rechnet Layout in
LayoutUnits zu 1/64 px. Mit gerundeten Werten (`213.9531px`) floort die Engine auf den nächstkleineren
1/64-Schritt → 213,9375 px, Abweichung 0,0156 px, exakte Gleichheit verfehlt. Alle acht verschiedenen
Tokens sind deshalb als exakte 64stel notiert (`213.953125px`, `211.796875px`, `226.796875px`,
`245.125px`, `241.140625px`, `200.296875px`, `186.96875px`, `204.046875px`, `242.71875px`).

**Ergebnis des Slotvertrags, beide Viewports, beide Zeilenarten:**
`Δw = [0, 0, 0, 0, 0, 0]` · X = 18 beidseitig · Y = 0/71/142/213/284/355 (`.bt-row`) bzw.
0/101/202/303/404/505 (`.mile`) beidseitig · Höhe 62 bzw. 91 beidseitig · Padding, Gap, Radius,
Rahmen, Schriftfamilie/-größe, Textausrichtung, Box-Sizing, Container-Padding identisch ·
`ovf = [0, 0, 0, 0, 0, 0]`.

### 3.3 Kontrollierter Überlauf — kein Wert geht verloren

Die Kürzung ist rein visuell (`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`).
Es gibt **keine Textmutation, keine Füllzeichen, keine Demo-Texte**: der vollständige echte String
bleibt unverändert im DOM. Elementweise Nachmessung (`/tmp/e3h/trunc.mjs`, jedes Blattelement jeder
Zeile) über 5 Fixture-Zustände (`good`, `missing`, `nobt`, `nomile`, `mile6`) × 2 Viewports:

- Zeilen- und Kartenhöhe konstant 62 / 91 px in **allen** Kombinationen.
- **Zeilen-Überlauf `scrollWidth − clientWidth` = 0** in allen 6 Slots, aller Zustände, beider
  Viewports. Dokument-Überlauf 0, kein horizontaler Überlauf.
- **Kein Messwert wird je gekürzt**: `.bt-time`, `.mile-t`, `.bt-dist b`, `.bt-dist span`,
  `.bt-imp` und `.mile-meta span` — 0 Treffer in allen 20 Kombinationen.
- Beschnitten werden ausschließlich zwei beschreibende Nebenzeilen, **50 Elementtreffer** gesamt:
  `.bt-sub` 40× und `.mile-d` 10×. Beträge: 6× 31 px, 2× 14 px, 10× 7 px, 12× 5 px, 12× 4 px,
  8× 1 px. Schlechtester Fall `.bt-sub` = „geschätzt (Engine-Modell)“, scrollWidth 128 >
  clientWidth 97 (31 px); ferner „Bestleistung (Import)“ 4 px, „Noch nicht verfügbar“ 5–7 px,
  `.mile-d` „Aus deinem Zielportfolio“ 1–14 px.

**Ehrlicher Vorbehalt zur Mandatsklausel „vollständige Informationen müssen über die bestehende
Detailinteraktion erreichbar bleiben“ — derzeit NICHT erfüllt.** Die betroffenen Zeilen besitzen in
ORVIA keine Detailinteraktion: `js/ui.js` Zeile 5065 (`.bt-row`) und 5085 (`.mile`) rendern inerte
`<div>`-Elemente ohne `role`, ohne `tabindex`, ohne `onclick`. Der vollständige Wert steht im DOM,
ist aber für den Nutzer nicht abrufbar. Zwei Lösungswege stehen zur Entscheidung — beide liegen
außerhalb des GM5.2-Auftrags („keine neuen Funktionen“) und wurden deshalb **nicht** ausgeführt:

1. Pixel-neutrales `title`-Attribut mit dem vollständigen Text auf `.bt-sub`/`.mile-d`. Minimal,
   greift aber nur bei Zeigergeräten, nicht bei Touch.
2. Echte GM-Parität: die sechs Zeilen in `ui.js` von `<div>` auf `<button type="button">` umstellen
   (§ 3.9). Stellt zugleich Tastaturfokus und Rollensemantik her und macht die erzwungene Arial-/
   Center-Regel überflüssig, weil sie dann nativ erbt.

### 3.4 Nachweis: Referenz unverändert, keine Geometriemasken

**Referenzintegrität.** `/tmp/orvia_dashboard_5.html` (Arbeitskopie): Rechte `-r--r--r--`,
282 621 Bytes, mtime 22.07. 15:55, **md5 `1b93e15e23054318c8848d5cb10e6bcb`** — identisch mit der
Originaldatei auf dem Gerät (`Downloads/orvia_dashboard_5_1.html`, 282 621 Bytes, gleiche md5).
Zusätzlich prüft der Slotvertrag die Referenz bei **jedem** Lauf gegen die dokumentierte Ground
Truth — eine veränderte Referenz würde den Lauf sofort rot machen.

**Am GM injiziert wird ausschließlich der Aufnahmerahmen:** Telefonrahmen/Statusleiste/Demoleiste
ausgeblendet, `.screen` aus `fixed` in den Dokumentfluss überführt (damit der gesamte Scrollbereich
in einem Bild liegt), Viewportbreite 430/390. Keine Regel berührt Karten, Zeilen, Abstände,
Schriftgrößen oder Bounding-Boxes. Es existiert **keine** Regel mehr, die `.bt-row`/`.mile`/`.medal`
auf der Referenzseite normalisiert.

**Masken sind Inhaltsmasken, keine Geometriemasken.** Jede Maske liegt exakt auf dem Rechteck ihres
eigenen Elements; weicht eine Geometrie ab, entsteht ein sichtbarer Magenta-Rand — die Maske kann
die Abweichung nicht verdecken, sondern verstärkt sie. Für die zwei Stellen, an denen eine Maske
ein Element **vollflächig** überdeckt (echte Wertunterschiede: GM-Demofortschritt gegen leere
ORVIA-Spur), liegt jetzt ein numerischer Geometrievertrag vor:

- `.mile-track` und `.mi-ic`: 6/6 Slots identisch in x, y, Breite, Höhe, Radius, `overflow`,
  Hintergrund — bei 430 und 390 (`rowgeom_*.json`).
- `.goal-line` (Zielreise): identisch — `x 16 · y 60 · w 322 · h 6 · radius 5px · overflow hidden ·
  bg rgba(255,255,255,.08)` auf beiden Seiten (`goalline_430.json`, `goalline_390.json`).
- Medaillen: Grid- und 6-Slot-Bounding-Box-/Style-Vertrag identisch (§ 3.5).

**Inhaltsabhängige Innenelemente werden bewusst NICHT gleichgesetzt** und nicht wegmaskiert, sondern
informativ ausgewiesen: `.bt-imp` (Verbesserungsspalte) ist im GM demo-befüllt („−0:12“), in ORVIA
ehrlich „—“ → Δw = [−17,45 · −17,45 · −17,45 · −15,30 · −17,45 · −39,45], mit spiegelbildlichem
`.bt-b` (flex:1). Diese Differenz bleibt im Pixel-Diff sichtbar und ist der Hauptanteil der
verbleibenden 1,41 % bei den Bestzeiten. Bei den Meilensteinen sind `.mile-b` und `.mile-meta`
bereits Δw = 0.

### 3.5 Medaillenvertrag (unverändert aus GM5.1, weiterhin grün)

Maskiert werden ausschließlich variable Zustandsinhalte, exakt auf dem eigenen Elementrechteck:
Titeltext (`b`), Beschreibung (`span`), dynamische Statusfarbe/Tier-Fill/Icon-Filter (`.m-badge`)
und der Fortschritts**wert** (Füllbreite der unveränderten Referenz, identisch auf beiden Seiten).
Nicht maskiert: Kartengröße, Grid, Slotposition, Badge-Geometrie, Iconposition, Innenabstände,
Radien, Rahmen, Grundhintergrund, Fortschrittsspur, Kartenabstände.

- Grid-Vertrag identisch: `w 394 · h 451,5 · cols 173,5px 173,5px · gap 11px · padding 0 18px · margin 0 18px`.
- Bounding-Box- und Style-Vertrag **6/6 Slots identisch** (Slotrechteck gitterrelativ 0,1 px, padding,
  borderRadius/-Width/-Style/-Color, textAlign, boxSizing, backgroundImage, display, gap; Badge-Rechteck
  + Radius + Größe; Icon-Rechteck; Titel-Rechteck + fontSize/-Weight/lineHeight; Beschreibung-Rechteck
  + fontSize/lineHeight; Spur-Rechteck + Radius + backgroundColor + height + overflow).
- Abweichung ausschließlich Zustand: `prod fill=[0,0,0,0,0,0]` gegen
  `gm fill=[145,5 · 145,5 · 113,5 · 145,5 · 93,1 · 61,1]`, Badge-Hintergrund `none`, Graustufenfilter.
- Pixel-Diff **0,00 % bei 430 und 390** (2 px bzw. 0 px). Gegenprobe `GM5_MEDAL_TRACK=full`
  (komplette Spur maskiert): ebenfalls **0,00 %** — das Ergebnis hängt nicht von der Lesart ab.

Keine Demo-Medaillen, Tiers oder Fortschrittswerte im Produktivcode (Vertragstest belegt).

### 3.6 Scroll-Restore (erneut geprüft, 8/8)

Profil öffnen → scrollen → Unterseite öffnen → zurück, je 4 Routen × 2 Viewports, Scrollcontainer
korrekt als `#tab-mehr` erkannt: Δ = 0 in allen 8 Fällen (430: 240/358/358/120 · 390: 240/414/414/120),
Detailmodus erhalten, Fokus zurück auf den auslösenden `mini-btn primary`, kein Scrollsprung.

### 3.7 Früher behobener Werkzeugfehler im 390-px-Durchlauf (Historie)

Die Detailstufen-Schleife bei 390 px endete mit ORVIA im Modus `profi`, während der GM auf `f`
zurückgesetzt wurde; der Unterseiten-Durchlauf verglich damit zwei Detailstufen. Vor der Korrektur:
`bestTimes390` 4,21 %, `settings390` 1,76 %. Nach Angleich beider Seiten auf `fortgeschritten`:
1,55 % bzw. 1,44 %. Kein Geometriefehler.

### 3.8 Verbleibende Zustandsangleichung (unverändert zulässig)

GM-Prefs werden vor dem Vergleich über den GM-eigenen Mechanismus auf den ehrlichen Produktzustand
gestellt (Toggles aus, Detailstufe angeglichen) — Zustandsangleich, keine Maske, keine Geometrieänderung.

### 3.9 Strukturabweichung `<button>` gegen `<div>` (neu ausgewiesen, vom Pixel-Gate nicht erfassbar)

Bestätigt über `_tag` an beiden Viewports:

| | Golden Master | ORVIA |
|---|---|---|
| Bestzeiten-Zeile | `<button class="bt-row" onclick="toast('Zugehörige Aktivität öffnen')">` | `<div class="bt-row">` (`ui.js` 5065) |
| Meilenstein-Zeile | `<button class="mile" onclick="toast('${m[0]}')">` | `<div class="mile">` (`ui.js` 5085) |
| `appearance` | `auto` | `none` |
| Fokussierbar | ja | nein (kein `tabindex`) |
| Rollensemantik | `button` | generisch |

Drei Konsequenzen, offen benannt:

1. Es ist eine **strukturelle Abweichung**, die der Pixel-Vergleich nicht sichtbar macht — sie ist
   deshalb hier dokumentiert und nicht durch ein grünes Gate abgedeckt.
2. Sie ist die **Ursache** dafür, dass Arial 13,3333 px und `text-align:center` in § 3.1 explizit
   erzwungen werden mussten: der GM erbt sie als UA-Default eines Formularelements.
3. ORVIA-Zeilen sind **nicht tastaturfokussierbar** und werden von Screenreadern nicht als Control
   angekündigt. Der GM zeigt an dieser Stelle einen Demo-Toast; einen produktiven Ziel-Handler gibt
   es in ORVIA nicht (Bestzeiten-Modell liefert keine Activity-ID, § 6), eine Umstellung auf
   `<button>` wäre also zunächst ohne Aktion oder mit einer neuen Detailansicht zu verbinden.

Der GM-Autor hat dieselbe Falle bei `.medal` erkannt und dort mit `font-family:var(--font)`
(GM-Zeile 1668) entschärft, bei `.bt-row`/`.mile` nicht. Die Umstellung ist **nicht** Teil von
GM5.2 (kein `ui.js`-Eingriff beauftragt) und wird zur ausdrücklichen Entscheidung vorgelegt.

### 3.10 Maskenüberdeckung, quantitativ (Nachweis zu Regel 3)

Regel 3 verbietet Maskierung von Kartenflächen, Rahmen, Abständen und Slot-Geometrien. Bisher war
das qualitativ begründet; jetzt liegt eine Messung vor (`/tmp/e3h/maskaudit.mjs`: der verbatim aus
`tools/gm5_parity.mjs` extrahierte Maskenkörper wird angewandt, danach wird die Flächenüberdeckung
jeder Maske gegen jede Kartenfläche `.bt-row/.mile/.medal/.card/.setting-item` berechnet):

| Seite | Masken | geprüfte Kartenflächen | ≥ 90 % überdeckt | max. Überdeckung einer Kartenart |
|---|---|---|---|---|
| Bestzeiten | 33 | 6 | **0** | `.bt-row` 21 % |
| Meilensteine | 39 | 6 | **0** | `.mile` 16 % |
| Medaillen | 27 | 6 | **0** | `.medal` 13 % |
| Profil | 47 | 7 | **0** | `.setting-item` 23 % |
| **Summe** | **146** | **25** | **0** | — |

Keine einzige der 146 Masken überdeckt eine Kartenfläche substanziell; die höchste Einzelüberdeckung
liegt bei 23 % und betrifft ausschließlich Textblöcke innerhalb der Karte. Kartenkanten, Rahmen,
Radien, Innenabstände und Slotpositionen bleiben in jedem Vergleichsbild sichtbar und damit
diffwirksam. Regel 3 ist damit numerisch belegt, nicht nur behauptet.

## 4. Echte Datenbindungen (ausschließlich bestehende Verträge)

Name/Initialen/Avatar/Sportarten/Meilensteine: kanonisches `PROFILE`-Modell (+`ORVIA.activityConfig.sportLabel`).
Zielreise: Goal-SSOT `goalOf()` + `RACE_LABELS_P` + `daysTo()`. Fitness-Stat: `Calc.loadSeries`-CTL
nur bei erfülltem Konfidenzvertrag. Bestzeiten: `bestTimes()`-Modell + `fmtPace` (echte Läufe als
„Bestleistung (Import)", sonst als Engine-Schätzung gekennzeichnet). Sync-Status: `orviaSyncState()`.
Konto-E-Mail: `ORVIA.user.email` (Auth). Letzte Sicherung: `DB._lastBackup`. A/F/P: bestehender
`uiDetailMode`/`setUiDetailMode`-Vertrag (persistent, `orvia_ui_mode`); Fachwerte in allen Stufen
invariant (per Test belegt). Aktive Handler: `ORVIA.profileCenter.open` (Profil bearbeiten),
`openGoalEditor` (Ziel hinzufügen), `exportData`, `orviaChangePassword`, `orviaDeleteAccount`,
`orviaLogout` — alle per Interaktionstest nachgewiesen.

## 5. Deaktivierte Controls und ehrliche Platzhalter

Ohne produktiven, persistenten Vertrag bleibt der Slot sichtbar und das Control deaktiviert
(`—`/„Noch nicht verfügbar", kein Fake-Erfolgs-Toast, keine Mutation — per Test: Klicks auf
deaktivierte Stepper/Toggles/Choices verändern nichts): Einheiten-/Zielaufbau-Stat, Handle, Bio,
Zielprozent (Fortschrittsspur leer), Bewegung reduzieren, alle Benachrichtigungs-Toggles,
Privates Profil, Gesundheitsfreigabe, KI-Analyse, Tagesziele-Stepper, Plan-&-Wochenstruktur-Regeln,
Schlafziel/HRV-Baseline/Verletzungshistorie, Apple Health, Herzfrequenzzonen, Passkey/2FA/Geräteliste,
Hilfe-Dokumentation, Farbmodus Hell/Automatisch (nur Dunkel produktiv), Pace-Rechner-Eingaben.
„Erholung & Warnzeichen" erscheint als aktiver, nicht abschaltbarer Toggle (Safety-Vertrag), Safety-
Regeln als „Immer aktiv".

## 6. Status Bestzeiten / Medaillen / Meilensteine / Pace-Rechner

Bestzeiten: 6 `bt-row`-Slots aus dem kanonischen Modell (1/5/10 km belegt, 21,1 km · 400 m Schwimm ·
20 km Rad neutral), kein BESTTIMES-Demo, kein Aktivitätslink (Modell liefert keine Activity-ID),
kein UI-Rekordvergleich (Verbesserungsspalte `—`). Medaillen: keine produktive Engine → 6 neutrale
`medal locked`-Slots, keine Tiers/Prozente. Meilensteine: 6 Slots, 2 aus dem Zielportfolio
(read-only), kein UI-Fortschritt (Spur leer, Meta `—`). Pace-Rechner: vollständige GM-Struktur
(Sport-Segmente, Zielgrößen, Felder, Ergebnis, Prognosekarte), Eingaben deaktiviert mit `—`,
keine Prototyp-Formel portiert, keine vorbelegten Demo-Eingaben.

## 7. Legacy-Deaktivierung

`openProfile` rendert nur noch den GM-Aufbau (`renderGMProfile`); Legacy-Renderer (renderMehr,
Account-/Nutrition-Formulare) werden übersprungen — keine versteckten Formulare, keine doppelten
Abfragen. CSS-Kaskade `#tab-mehr > :not(#gmProf):not(#gmProfPage){display:none}` hält Legacy
unsichtbar, Funktionen bleiben erhalten (Abbau ist GM7). Bestehender History-/Overlay-Vertrag
(`body.profile-open`, Browser-Back) unverändert. Zusätzlich behobener Bestandsfehler: Scroll-
Restore beim Schließen einer Unterseite nutzte `window.scrollY`, obwohl `#tab-mehr` der
Scrollcontainer ist — jetzt containerbewusst, Fokus-Rücksprung ohne Scroll-Sprung (`preventScroll`).

## 8. Testbilanz

**Visuelle Parität `tools/gm5_parity.mjs` (GM5.2): 95 grün / 0 rot.**
Vorher GM5.1: 72 grün / 3 rot (75). Die Matrix ist gewachsen (75 → 95), kein Test wurde
abgeschwächt, entfernt oder umformuliert, um grün zu werden — der Zeilenvertrag wurde im Gegenteil
verschärft: statt „beide Seiten sizen nach `fit-content`" gilt jetzt exakte Gleichheit in Breite,
Höhe, X- und Y-Position, Padding, Gap, Radius, Rahmen, Schriftfamilie, Schriftgröße,
Textausrichtung, Box-Sizing und Container-Padding, zusätzlich eine Ground-Truth-Prüfung der
Referenz selbst und eine Überlaufprüfung je Zeile.

Neu gegenüber GM5.1 (20 zusätzliche Prüfungen): Ground-Truth-Prüfung der Referenzbreiten je
Zeilenart und Viewport (4), Slotvertrag bei 390 px (2), Überlaufvertrag je Zeilenart und Viewport (4),
Geometrievertrag der vollflächig maskierten Innenelemente (4), Ausweis der inhaltsabhängigen
Innenelemente (4), `.goal-line`-Geometrievertrag bei beiden Viewports (2), Pixel-Diff
`milestones_none` und `bestTimes_none` (2) — abzüglich zweier ersetzter `fit-content`-Prüfungen.

Umfang gesamt: Profil A/F/P + 3 Missingness-Zustände + 17 Unterseiten × 430 und 390;
Zustandsmatrix Bestzeiten/Meilensteine je vollständig und fehlend (6 Slots, keine 0-statt-Missing,
keine Demo-Werte, kein Überlauf); Medaillen-Grid-/Bounding-Box-/Style-Vertrag 6/6;
Zeilen-Slotvertrag `.bt-row` und `.mile` an beiden Viewports; Interaktionen (Back/Modus/Scroll/Fokus,
A/F/P-Persistenz und Fachwert-Invarianz, No-Mutation, aktive Handler, Logout und Löschflow nur über
Auth); 5× Re-Render ohne DOM-/Listener-Akkumulation; keine Seitenfehler.

**Ergänzende Einzelaudits außerhalb des Runners** (Werkzeuge in `/tmp/e3h/`, nicht Teil des
Produktivstands, Ergebnisse in § 3.3, 3.6 und 3.10): Überlaufaudit `trunc.mjs` (20 Kombinationen,
alle Blattelemente), Maskenüberdeckungsaudit `maskaudit.mjs` (146 Masken, 25 Kartenflächen),
Scroll-Restore-Audit `scroll8.mjs` (8/8 mit Δ = 0 statt der Runner-Toleranz < 6 px). Der
Scroll-Teilcheck „Unterseiten-Scroll läuft nicht über“ war trivial erfüllt, weil `#gmProfPage` in
keinem geprüften Zustand überlief (`innerMax = 0`) — ehrlich ausgewiesen, kein belastbarer Nachweis.

**GM5-Vertragstest** `supabase/tests/gm5_profile_parity_test.mjs`: 43/43 grün, unverändert.

**Geräte-Gesamtsuite: 174 Tests → 168 grün + 6 bekannte ENV-Baseline-Fehler**
(`batch2f_offline_queue_live`, `live_workout_rls_phase42`, `live_workout_rpc_smoke_phase42`,
`muscle_volume_sql_phase43`, `rls`, `training_rls_phase41` — alle mit „ENV fehlt: SUPABASE_URL,
SUPABASE_ANON_KEY, …", identisch zur Baseline). **Keine neuen Testfehler, keine Regression,
kein Fachtest verändert oder abgeschwächt.**

## 9. Engine-/Store-/Auth-Diff

Alle **39 eingefrorenen Dateien** (Profil/Auth/Goal/Activity/Calc/Engine/Metrics/Stores/Charts/
Data/Sync, Liste in `gm5_baseline.md`) auf dem Gerät `md5sum -c` **39/39 OK** — Diff exakt null.
Engine, Scheduler, Stores, Resolver, Muskelengine, Auth und Goals unberührt.

GM5.2 schreibt ausschließlich in:

- `styles.css` — Ersatz der GM5.1-Zeile `#gmProfPage .bt-row,#gmProfPage .mile{width:fit-content;text-align:center}`
  durch den Slotgeometrieblock (Schriftübernahme, feste Slotbreiten als exakte 64stel, feste
  Zeilenhöhen, CSS-Ellipsis). Ausschließlich innerhalb `#gmProfPage`; kein globaler Schrift- oder
  Layouteffekt.
- `tools/gm5_parity.mjs` — verschärfter Slotvertrag, Ground-Truth-Prüfung, Innengeometrieverträge,
  zusätzliche Pixel-Zustände.
- `docs/gm-ref/` — `gm5_report.md`, `results.json`, `medal_contract.json`, `rowgeom_bestTimes.json`,
  `rowgeom_bestTimes_390.json`, `rowgeom_milestones.json`, `rowgeom_milestones_390.json`,
  `goalline_430.json`, `goalline_390.json`.

**Kein Produktivcode außerhalb von `styles.css` verändert.** `js/ui.js` in GM5.2 unverändert
(nur gelesen). `index.html` unverändert. `sw.js`: `orvia-v8-197` genau 1×, kein Bump.
Geräte-HEAD unverändert `014ac6f`, kein Commit, kein Push, kein Deploy.
Gerät = Container byte-identisch (md5-verifiziert).

## 9a. GM5.3 — Semantik und Bedienbarkeit der zwölf Zeilen

**Auftrag.** Semantik und Bedienbarkeit der Bestzeiten- und Meilensteinzeilen an den Golden Master
angleichen, ohne sichtbare Geometrie oder produktive Daten zu verändern.

**9a.1 Elementstruktur.** Die sechs `.bt-row`- und die sechs `.mile`-Elemente der Profil-Unterseiten
sind jetzt `<button type="button" class="…">` — identisch zum unveränderten Golden Master
(GM-Zeilen 1955 und 1967). Der Golden Master wurde nicht angefasst (md5 `1b93e15e23054318c8848d5cb10e6bcb`,
Datei weiterhin `-r--r--r--`); es gab keine Referenznormalisierung. Ausdrücklich **nicht** betroffen:
die `.mile`-Elemente der Analyse-/Dashboard-Ansicht (GM-Zeilen 1720/1721) — sie sind auch im Golden
Master `<div>` und bleiben es; die Prüfung „keine verbleibenden `div.bt-row`/`div.mile`" ist deshalb
auf `#gmProfPage` begrenzt. `.medal` liegt außerhalb des GM5.3-Mandats und ist unverändert.

„Struktur-Diff 0" bedeutet ab GM5.3 ausdrücklich nicht mehr nur gleiche sichtbare Geometrie: der
Strukturvertrag prüft jetzt Elementtyp `BUTTON`, `type="button"`, identische Klassen ohne Zusatz,
identische Anzahl und lückenlose Reihenfolge 0–5 sowie das Fehlen von `div.bt-row`/`div.mile` —
je Route und je Viewport, gegen den unveränderten Golden Master. Zusätzlich prüft der statische
GM5-Vertragstest denselben Vertrag quellseitig (4 neue Prüfungen, jetzt 47 statt 43).

**9a.2 Vollständige Informationen erreichbar (löst 10.4).** Tap, Klick, Enter oder Space öffnen
je Zeile ein **bestehendes** GM-Sheet (`detailSheet` über `gmOpenSheet`), das ausschließlich die
bereits gerenderten bzw. im kanonischen Datensatz bereits vorhandenen Werte derselben Zeile
konsumiert. Zwei Zeilenregister (`_gmBtSlots`, `_gmMileSlots`) halten genau diese Werte; es wird
nichts berechnet, abgeleitet, ergänzt, gespeichert oder erfunden.

Bestzeiten-Sheet: Disziplin/Distanz, Leistung, vorhandenes Datum, Herkunft/Einordnung
(„Bestleistung (Import)" bzw. „geschätzt (Engine-Modell)"). Das kanonische Modell `bestTimes()`
liefert `{t1,t5,t10,real:{k1,k5,k10},estPace,estDist,n}` — **kein Datum, keine Activity-ID, kein
Vergleichswert**. Datum wird deshalb ehrlich als „Noch nicht verfügbar" ausgewiesen, „Verbesserung"
entfällt vollständig (Mandat: nur wenn kanonisch vorhanden), und es wird keine Aktivitäts-ID erfunden.

Meilenstein-Sheet: Titel, vollständige ungekürzte Beschreibung, Startwert, Zielwert, aktueller
Stand, Status, optional Zieldatum. `normalizeMilestone` liefert
`{id,title,targetDate,metric,currentValue,targetValue,unit,status,order}` — **kein Startfeld**;
Startwert ist deshalb immer ehrliche Missingness. `status` wird lediglich in ein deutsches Label
übersetzt (`planned/in_progress/achieved/skipped`), was eine Beschriftung eines bereits vorhandenen
kanonischen Werts ist, keine Ableitung. Fehlende Felder erscheinen als „Noch nicht verfügbar".

**9a.3 Bedienvertrag.** Verbindlich getestet und grün: Tap/Klick öffnet genau ein Sheet; Enter und
Space funktionieren (nativ über das `<button>`-Element, kein eigener Keydown-Handler); der Fokus
wechselt ins Sheet; Escape schließt Sheet und Scrim; der Fokus kehrt zur auslösenden Zeile zurück;
vollständige `.bt-sub`- und `.mile-d`-Texte sind im Sheet ungekürzt und unbeschnitten lesbar
(`scrollWidth − clientWidth ≤ 1` auf jedem Blattknoten); Missing-State-Zeilen sind fokussierbar und
öffnen ein verständliches Sheet; nach sechs Re-Renders je Zustand entstehen keine Sheet-, Zeilen-
oder Listener-Duplikate; es gibt keine Navigation und keine Datenmutation (`PROFILE`- und
`localStorage`-Snapshot vor und nach jeder Interaktionsserie identisch). Ein `title`-Attribut wurde
nicht verwendet. Listener-Duplikate sind konstruktiv ausgeschlossen: die Zeilen tragen wie im Golden
Master ein Inline-`onclick`, es wird kein Listener registriert; der Escape-Handler ist global und
über `window._gmEscBound` idempotent.

**9a.4 Visuelle Invarianz.** Der Elementwechsel verändert die sichtbare geschlossene Seite nicht.
Alle zwölf Slotbreiten sind unverändert exakt: Bestzeiten `[213.953125, 213.953125, 213.953125,
211.796875, 226.796875, 245.125]`, Meilensteine `[241.140625, 200.296875, 200.296875, 186.96875,
204.046875, 242.71875]`, jeweils `Δw=[0,0,0,0,0,0]` und `ovf=[0,0,0,0,0,0]` bei 430 und 390 px.
Position, Höhe, Padding, Gap, Radius, Rahmen und Containerpadding identisch; kein horizontaler
Überlauf; keine zusätzliche sichtbare Beschriftung. Die Pixel-Diffs sind unverändert gegenüber
GM5.2: `bestTimes` 1,41 % / 1,55 %, `milestones` 1,11 % / 1,22 %, `medals` 0 %; Maximum aller
Seiten 1,55 %. Keine Maskenerweiterung, keine Lockerung des ≤2-%-Gates.

Zwei Computed-Style-Punkte wurden dabei bewusst behandelt:

`flex` bleibt auf dem Initialwert (`flex-shrink: 1`) — das entspricht dem Golden Master; die frühere
Angabe `flex: 0 0 auto` wurde entfernt. Die Elternebene ist Block-Layout, der Wert hat also keinen
Layouteffekt (numerisch verifiziert). `appearance` ergibt sich nach dem Typwechsel ohne Zutun als
`auto` wie in der Referenz.

`color` wurde in GM5.3 **abweichend** auf `var(--text)` gehalten statt auf dem Referenzwert
`buttontext` (Schwarz). **Diese Entscheidung ist in GM5.4 aufgehoben und die Begründung war
falsch** — sie ist nur als Historie erhalten. Erstens war es keine Entscheidung, die mir zustand:
die Bewertung eines Referenzwerts als „Defekt" und dessen eigenmächtige Korrektur widerspricht der
verbindlichen Vorgabe, dass die produktive Oberfläche dem vorhandenen Golden Master entspricht.
Zweitens war das angeführte `.medal`-Argument kein Beleg dafür, dass der Referenzautor denselben
Wert auch für `.bt-row`/`.mile` gewollt hätte. Drittens war die Abweichung vollständig hinter
Inhaltsmasken verborgen und damit durch die damaligen 139 Prüfungen **nicht visuell validiert** —
grün war hier kein Nachweis. Der geltende Farbvertrag steht in **§ 9b**.

`:nth-of-type(n)` wurde nach dem Typwechsel erneut verifiziert: die sechs Buttons bleiben 1–6, das
Geschwister-`div.mini-note` teilt den Typ nicht mehr, alle zwölf Slotbreiten lösen unverändert auf.

**9a.5 Prüfmatrix.** `tools/gm5_parity.mjs` erweitert um `semInteractContract` für 430 und 390 px:
Tag-/Semantik-Parität, Tap/Klick, Fokus ins Sheet, Escape, Rückfokus, Sheet-Inhaltsgleichheit,
vollständige Texte, Tastaturbedienung, Missing-State, Re-Render-Stabilität, Navigations-/
Mutationsfreiheit — 11 aggregierte Prüfungen je Route und Viewport, also 44 neue Prüfungen.
Ergebnis: **`gm5_parity: ALL PASSED (139 ok)`** (95 bisherige unverändert grün + 44 neue), 0 rote
Prüfungen, alle Diffs ≤2 %. Ergänzend `gm5_profile_parity_test.mjs` **47/47** (4 neue
Strukturvertragsprüfungen). Gerätesuite: **168 bestanden, 0 fehlgeschlagen, 6 ENV-übersprungen**
(`batch2f_offline_queue_live`, `live_workout_rls_phase42`, `live_workout_rpc_smoke_phase42`,
`muscle_volume_sql_phase43`, `rls`, `training_rls_phase41` — jeweils fehlende Supabase-Zugangsdaten,
Zustand wie in allen vorangegangenen Phasen).

**9a.6 Geschriebene Dateien in GM5.3.** `js/ui.js` (nur die beiden Renderfunktionen der
Unterseiten plus zwei neue Sheet-Öffner und zwei Register), `styles.css` (nur der Kopf des
GM5.2-Blocks innerhalb `#gmProfPage`), `tools/gm5_parity.mjs`, `supabase/tests/gm5_profile_parity_test.mjs`,
`docs/gm-ref/gm5_report.md`. `index.html` unverändert. `sw.js` unverändert, `orvia-v8-197` genau 1×,
kein Bump. Alle 39 eingefrorenen Dateien `md5sum -c` **39/39 OK** — Engine-, Scheduler-, Store-,
Resolver-, Auth- und Goal-Diff exakt null. Geräte-HEAD unverändert `014ac6f`; kein Commit, kein Push,
kein Deploy. Gerät = Container byte-identisch: `js/ui.js` `d546feb533e16a673e43a6e2d7b20fdc`,
`styles.css` `c5a6e5a9d9aaa5ab7feb8af6245737c6`, `tools/gm5_parity.mjs` `52954801917387222c76f57f48e1cebc`.

## 9b. GM5.4 — Farbvertrag der zwölf Zeilen

**9b.1 Befund am unveränderten Golden Master.** Gemessen für `.bt-row` und `.mile`, beide Routen,
430 und 390 px, Referenzdatei unverändert (`md5 1b93e15e23054318c8848d5cb10e6bcb`, `r--r--r--`):

| Größe | Wert |
|---|---|
| deklarierter Farbwert | **keine Autorenregel mit `color`, kein Inline-Wert** |
| berechneter Farbwert | **`rgb(0, 0, 0)`** |
| gerenderter Farbwert im Prüfbrowser | **`rgb(0, 0, 0)`** (isolierter Klon, Testtext `ORVIA 08154711`, 980 bzw. 749 Vordergrundpixel) |
| Herkunft | **UA-Regel für `button` (`color: buttontext`)** — *nicht* Vererbung |

Der Herkunftsnachweis ist ein Sondenpaar im **selben** GM-Dokument: ein frisch erzeugtes `<button>`
rechnet `rgb(0, 0, 0)`, ein frisch erzeugtes `<div>` rechnet `rgb(245, 243, 237)`; die Elternebene
der Zeile rechnet `rgb(245, 243, 237)`. Läge Vererbung vor, müsste die Zeile den Elternwert zeigen.

**Werkzeugfehler, der den GM5.3-Befund entwertet hätte (ehrlich ausgewiesen).** Die erste
Regel-Sonde meldete „keine Autorenregel mit `color`" aus dem falschen Grund: seit CSS-Nesting
besitzt **jede** `CSSStyleRule` eine (leere) `cssRules`-Liste. Ein Walker, der `if(r.cssRules){…;
continue}` prüft, überspringt daher **alle** Stilregeln — instrumentiert gemessen `seen: 2954,
styleRules: 0, matched: 0`. Der Walker wertet jetzt zuerst `selectorText` aus und steigt nur bei
`cssRules.length > 0` ab; der Befund oben wurde mit dem korrigierten Walker **neu erhoben**, nicht
übernommen.

**9b.2 Übernahme, lokal begrenzt.** In `styles.css` steht ausschließlich im bestehenden
GM5.2/GM5.3-Block:

```css
#gmProfPage .bt-row,#gmProfPage .mile{
  font-family:Arial;font-size:13.3333px;text-align:center;color:buttontext;
  box-sizing:border-box;overflow:hidden}
```

`color: buttontext` ist ein gültiger Autorenwert (`CSS.supports('color','buttontext') === true`) und
rechnet beidseitig zu `rgb(0, 0, 0)`, weil **weder** der Golden Master **noch** ORVIA CSS
`color-scheme` deklarieren (der GM prüft `prefers-color-scheme` nur in JS, GM-Zeile 1443). Die
Übernahme des Wertes ist der Löschung der Deklaration vorzuziehen: ORVIA hat keine globale
`button{}`-Regel, eine künftige globale Regel könnte diese ID-gebundene Regel aber nicht
überschreiben — der Referenzwert bleibt so aktiv erzwungen. **Keine globale Button-Regel, keine
Änderung anderer Komponenten**; `.medal` und alle übrigen Selektoren unberührt.

**9b.3 Erweiterter Computed-Style-Vertrag (direkt GM ↔ ORVIA, ohne jede Maske).** Neu in
`tools/gm5_parity.mjs` (`colorContract`, je Route und Viewport). Zuerst wird ausdrücklich geprüft,
dass zum Messzeitpunkt **keine** `.gm-mask` aktiv ist (`GM-Masken=0 PROD-Masken=0`) — eine
Abweichung kann hier also nicht durch eine Textmaske grün werden. Verglichen werden über alle sechs
Zeilen je Route: `color`, `font-family`, `font-size`, `text-align`, `appearance`, Hintergrund
(`background-color` + `background-image` + `background-clip`), Rahmen (Breite/Stil/Farbe aller vier
Seiten), `opacity`, die Textfarben der Kindelemente (`.bt-dist b`, `.bt-dist span`, `.bt-time`,
`.bt-sub`, `.bt-imp` bzw. `.mile-t`, `.mile-d`, `.mile-meta span`) sowie die vererbte Iconfarbe
(SVG `stroke`/`fill`/`color`). Ergebnis beidseitig identisch, u. a. `color = rgb(0, 0, 0)`,
`.bt-dist b`/`.bt-time`/`.mile-t = rgb(0, 0, 0)`, `.bt-sub = rgb(180, 189, 201)`,
`.bt-imp = rgb(67, 214, 147)`, Icon `{stroke: rgb(0,0,0), fill: none, color: rgb(0,0,0)}`.

**9b.4 Maskenunabhängiger Farbnachweis am Pixel.** Aus dem echten `.bt-row` bzw. `.mile` **beider**
Seiten wird ein isolierter Klon erzeugt und dieselbe Testzeichenfolge `ORVIA 08154711` eingesetzt.
Die Golden-Master-Geometrie wird dabei **nicht** normalisiert und die Originaldatei **nicht**
verändert — geklont wird ein Laufzeit-Knoten, das Original bleibt unberührt. Damit der Ausschnitt
symmetrisch ist, wird in **beiden** Klonen jeder andere Textknoten geleert (Element-Screenshots
enthalten überlappende Geschwister); SVG-Teilbäume bleiben unangetastet.

Als Kriterium dient **nicht** Bitgleichheit, sondern eine reine Farbaussage: jeder Vordergrundpixel
muss auf der Mischgeraden zwischen dem gerenderten Elementhintergrund und der Referenzfarbe liegen
(`p = bg + t·(ref − bg)`, `t ∈ [0,1]`, `t_max ≈ 1`, kleiner Restabstand). Kantenglättung erzeugt
genau solche Zwischenwerte, eine andere Textfarbe nicht. Bezugspunkt ist der **gerenderte
Elementhintergrund** (häufigster Pixelwert), nicht die Isolierfläche — der Klon zeichnet seinen
eigenen Kartenverlauf `linear-gradient(rgb(17,26,38), rgb(12,19,29))`, ein Extremwert relativ zur
Isolierfläche hätte den dunkelsten Verlaufspixel geliefert.

Messwerte (Schranke `maxResid ≤ 16.0`, `t_max ∈ [0.9, 1.02]`, `t_min ≥ −0.02`):

| Bild | Vordergrundpixel | t | Restabstand | Urteil |
|---|---|---|---|---|
| GM `.bt-dist b` | 980 | [0.04, 1] | 7,88 | grün |
| ORVIA `.bt-dist b` | 889 | [0.09, 1] | 1,47 | grün |
| GM `.mile-t` | 749 | [0.01, 1] | 7,88 | grün |
| ORVIA `.mile-t` | 667 | [0.09, 1] | 1,20 | grün |
| GM Icon | 133 | [0.08, 1] | 0,72 | grün |
| ORVIA Icon | 134 | [0.06, 1] | 0,91 | grün |
| **Negativkontrolle** ORVIA mit `color:var(--text)!important` **plus voller 33er-Textmaske** | 1601 | **[−7.09, 0.20]** | **107,47** | **rot** |

Die Schranke 16,0 liegt über dem Doppelten des schlechtesten Gutwerts und unter einem Viertel des
Negativwerts. Die Negativkontrolle belegt zugleich die Kernforderung: **die Maske macht den Test
nicht grün** — bei 33 aktiven Masken bleibt die falsche Farbe rot. Der Trennschärfenachweis
(`/tmp/e3h/blendneg.mjs`) extrahiert die Prüffunktion wörtlich aus der ausgelieferten Suite, damit
dort keine mildere Fassung gemessen werden kann: **10/10 Gutfälle grün, Negativkontrolle rot.**

**Zwei Klonartefakte, ehrlich ausgewiesen** (Grund für das Farb- statt Bitkriterium): Bei
**geleertem** Klontext schrumpft der Golden Master auf den Inhalt (`.mile-t` 109 px), während ORVIA
die Slotbreite über den GM5.2-Ellipsisschutz `white-space:nowrap` hält (164 px). Unter **echtem**
Inhalt sind die `.mile-t`-Breiten auf allen sechs Zeilen identisch
(163,1406 / 122,2969 / 122,2969 / 108,9688 / 126,0469 / 164,7188). Im `.bt-dist b`-Kasten
(beidseitig 66×34) verbleibt reine Sub-Pixel-Rasterung: die Schriftmetriken sind beidseitig gleich
(`Arial | 15 px | Gewicht 840 | letter-spacing normal`, Vorschubbreite der Testzeichenfolge
beidseitig **116,7656**; `.mile-t`: `Arial | 14 px | Gewicht 770`, **108,9844**). Einziger
Unterschied ist `white-space` (`normal` vs. `nowrap`). Ein Bitvergleich wäre also aus Layout- und
Rasterungsgründen rot geworden, obwohl die Farbe identisch ist — er wurde nicht gestrichen, sondern
durch das **schärfer trennende** Farbkriterium ersetzt.

Der Iconnachweis prüft die **Strichfarbe**, nicht die Strichform: welches Statussymbol eine Zeile
zeigt, ist echter Inhalt und darf sich unterscheiden. Bezugswert ist der berechnete
`currentColor`-Wert des Golden Master.

**9b.5 Referenzeigenschaft — dokumentiert, ausdrücklich NICHT korrigiert.** Mit dem übernommenen
Referenzwert rendern `.bt-dist b`, `.bt-time`, `.mile-t` sowie die per `currentColor` geerbten
`.mi-ic`-Icons **schwarz auf dunklem Grund** (Kartenverlauf `rgb(17,26,38) → rgb(12,19,29)`,
Kontrastverhältnis ≈ 1,1:1). Das ist eine Eigenschaft des vorhandenen Golden Master und wird hier
ausschließlich dokumentiert. Eine Abweichung davon wäre eine bewusste Designentscheidung und
bedürfte einer separaten Freigabe des Auftraggebers. Die Sekundärtexte sind unberührt
(`.bt-sub = rgb(180, 189, 201)`, `.mile-d = rgb(180, 189, 201)`, `.mile-meta span`/`.bt-dist span =
rgb(138, 147, 161)`, `.bt-imp = rgb(67, 214, 147)`), die Vollwerte bleiben über die GM5.3-Sheets
lesbar erreichbar.

**9b.6 Wirkung auf das Pixel-Gate.** Die Icons liegen **außerhalb** der Inhaltsmasken (der
Maskenläufer überspringt SVG-Teilbäume), die Farbübernahme ist dort also pixelwirksam — und
**senkt** den Diff: `milestones` **1,11 % → 0,98 %** (430 px) und **1,22 % → 1,08 %** (390 px).
Alle übrigen Zustände unverändert; Maximum aller Seiten weiterhin **1,55 %** (`bestTimes390`),
`bestTimes` 1,41 %, `medals` 0 %. Alle Diffs ≤ 2 %, keine Maskenerweiterung, keine
Referenznormalisierung, keine Lockerung des Gates.

**9b.7 Prüfmatrix und Regressionsstand.** `gm5_parity: ALL PASSED (197 ok)` — die 139 Prüfungen aus
GM5.3 unverändert grün, 58 neue Prüfungen des Farbvertrags (je Route und Viewport: Maskenfreiheit,
GM-Herkunft, `color`, sieben weitere Computed-Style-Felder, Kindfarben, Iconfarbe, Klonfarbnachweis,
Mischgeraden-Pixelnachweis, dazu der Iconnachweis der Meilensteine). Kein Test wurde abgeschwächt,
entfernt oder umformuliert. Slotbreiten und Überlauf unverändert (`Δw=[0,0,0,0,0,0]`,
`ovf=[0,0,0,0,0,0]` in allen vier Kombinationen); Semantik-, Tastatur- und Sheet-Verträge aus GM5.3
unverändert grün (Tap/Klick, Enter, Space, Fokus ins Sheet, Escape, Rückfokus, ungekürzte Texte,
Missing-State, Re-Render-Stabilität, keine Navigation/Mutation); keine Seitenfehler.
`gm5_profile_parity_test.mjs` **47/47** unverändert. Gerätesuite erneut vollständig gelaufen
(174 Dateien in vier Blöcken): **168 bestanden, 0 fehlgeschlagen, 6 ENV-übersprungen**
(`batch2f_offline_queue_live`, `live_workout_rls_phase42`, `live_workout_rpc_smoke_phase42`,
`muscle_volume_sql_phase43`, `rls`, `training_rls_phase41` — jeweils „ENV fehlt: SUPABASE_URL,
SUPABASE_ANON_KEY, …", identisch zur Baseline). Keine neue Regression.

Der Maskenkörper ist unverändert: das Audit `/tmp/e3h/maskaudit.mjs` liefert erneut **146 Masken**,
25 geprüfte Kartenflächen, **0** substanziell überdeckte Kartenflächen, höchste Einzelüberdeckung
23 % (§ 3.10) — keine Maskenerweiterung in GM5.4. Die Referenzdatei wurde weder verändert noch
geometrisch normalisiert: `/tmp/orvia_dashboard_5.html` weiterhin 282 621 Bytes, `r--r--r--`,
`md5 1b93e15e23054318c8848d5cb10e6bcb`.

**9b.8 Geschriebene Dateien in GM5.4.** Ausschließlich `styles.css` (nur die eine Zeile
`color: var(--text)` → `color: buttontext` innerhalb `#gmProfPage`, plus Kommentar),
`tools/gm5_parity.mjs` (neuer Farbvertrag) und `docs/gm-ref/` (dieser Bericht + Artefakte
`color_bestTimes*.json`, `color_milestones*.json`). **`js/ui.js` unverändert**
(`d546feb533e16a673e43a6e2d7b20fdc`), `index.html` unverändert, `supabase/tests/
gm5_profile_parity_test.mjs` unverändert (`057e63f7519fdc453720a7d98e304f03`). `sw.js` unverändert,
`orvia-v8-197` genau 1×, kein Bump. Alle 39 eingefrorenen Dateien `md5sum -c` **39/39 OK** —
Engine-, Scheduler-, Store-, Resolver-, Auth- und Goal-Diff exakt null. Geräte-HEAD unverändert
`014ac6f`; kein Commit, kein Push, kein Deploy.

## 10. Offene Punkte

**10.1 Angemeldeter Live-Boot (unverändert offen).** Angemeldeter Live-Boot im echten Browser (eingeloggter Supabase-Zustand, Chrome-Extension) wurde
wie in GM1–GM4 nicht durchgeführt — die Extension war in dieser Session nie verbunden. Die
Paritäts- und Interaktionsnachweise stammen aus dem dokumentierten Harness (`/tmp/gm5h.html`,
GM4+GM5-Blöcke + Fixtures) mit Playwright/Chromium. Empfehlung: einmaliger manueller Boot mit
angemeldetem Konto vor GM6-Freigabe.

**10.2 Schriftübernahme ist im Prüfumfeld metrisch neutral (§ 3.1).** Container und Gate rendern
beidseitig Liberation Sans; die Arial-Übernahme ist erst auf macOS real sichtbar und wird vom
Pixel-Gate nicht validiert. Sie folgt dem verbindlichen Computed Style der unveränderten Referenz,
ihre visuelle Wirkung auf dem Zielgerät ist aber unbelegt und sollte beim Live-Boot (10.1)
mitgeprüft werden.

**10.3 `<button>` gegen `<div>` in den sechs Unterseiten-Zeilen (§ 3.9) — GESCHLOSSEN in GM5.3
(§ 9a.1).** Alle zwölf Zeilen sind jetzt `<button type="button">` wie in der Referenz; der
Strukturvertrag prüft Typ, `type`, Klassen, Anzahl, Reihenfolge und das Fehlen von `div`-Resten
in beiden Viewports und quellseitig im GM5-Vertragstest. Tastaturfokussierbarkeit sowie Enter und
Space sind nativ gegeben und getestet.

**10.4 50 visuell gekürzte Echtwerte ohne Detailzugriff (§ 3.3) — GESCHLOSSEN in GM5.3 (§ 9a.2).**
Jede Zeile öffnet per Tap, Klick, Enter oder Space ein bestehendes GM-Sheet, in dem `.bt-sub` und
`.mile-d` ungekürzt und unbeschnitten stehen (12/12 je Zustand und Viewport verifiziert). Die
Kürzung in der geschlossenen Zeile bleibt rein visuell und ist zur Wahrung der Slotgeometrie
erforderlich; die Information ist auf Touch **und** Tastatur vollständig erreichbar.

**10.5 macOS-Plattformschrift weiterhin ungeprüft (neu, betrifft 10.2).** Der in GM5.3 versuchte
lokale Prüflauf war technisch nicht möglich: die verbundene Arbeitsumgebung ist eine isolierte
Linux-VM (`Linux … aarch64`, Ubuntu-Kernel), nicht macOS. `sw_vers`, `/Applications` und
`/System/Library/Fonts` existieren dort nicht, ein lokaler Browser ist nicht installiert, und
`fc-match Arial` liefert auch dort `LiberationSans-Regular.ttf`. Die tatsächliche
macOS-Plattformschrift und die zwölf Slotgeometrien unter echtem Arial sind damit **unbelegt**;
es wird dazu nichts behauptet. Der Punkt bleibt offen und ist gemeinsam mit 10.1 beim manuellen
Boot auf dem Mac zu prüfen. Die verbindliche Golden-Master-Schrift wurde nicht eigenmächtig
geändert.

**10.6 Schwarze Zeilenschrift auf dunklem Grund (neu, § 9b.5) — bewusst offen gelassen, keine
eigenmächtige Korrektur.** Der übernommene Golden-Master-Farbwert lässt `.bt-dist b`, `.bt-time`,
`.mile-t` und die `.mi-ic`-Icons schwarz auf dem dunklen Kartenverlauf rendern (Kontrast ≈ 1,1:1;
WCAG AA für Fließtext verlangt 4,5:1, für große Schrift 3:1). Das ist eine **Eigenschaft der
Referenz**, nicht ein Fehler in ORVIA, und wird gemäß Vorgabe nur dokumentiert. Eine Änderung wäre
eine bewusste Designabweichung vom Golden Master und benötigt eine ausdrückliche Entscheidung des
Auftraggebers. Solange sie nicht vorliegt, bleibt der Referenzwert produktiv wirksam.

**10.7 Wirkung erst beim Live-Boot vollständig beurteilbar (Verknüpfung 10.1/10.2/10.6).** Da die
Zeilenschrift im Prüfumfeld Liberation Sans statt Arial ist, kann die reale Lesbarkeit des
schwarzen Textes auf dem Zielgerät hier nicht abschließend beurteilt werden. Der Punkt ist beim
manuellen Boot auf dem Mac gemeinsam mit 10.1 und 10.2 zu bewerten.

— GM6 erst nach ausdrücklicher Freigabe.
