# GM6.1 · Ground Truth und Nachweisführung (Funktionsabschluss)

Stand: Abschluss GM6.1. Referenz: `/tmp/orvia_dashboard_5.html`, md5 `1b93e15e23054318c8848d5cb10e6bcb`
(unverändert, byte-identisch zur Ausgangsdatei). Arbeitskopie: `/mnt/user-data/uploads/Strava/app/`.

Dieses Dokument liefert die von GM6.1 §1, §3 und §6 verlangten Nachweise sowie die Begründung
der beiden Vertragsumbauten in §2 und im Paritätswerkzeug. Es ergänzt `gm6_ground_truth.md`
(Ausgangsinventur) und `gm6_report.md` (GM6-Abschlussbericht); beide bleiben gültig.

Trennung der Aussageklassen in diesem Dokument:

* **Gesichert** — durch Quelltextzeile, md5, Testausgabe oder Pixelmessung belegt.
* **Belegte Schlussfolgerung** — logisch zwingend aus mehreren gesicherten Fakten.
* **Offen** — nicht prüfbar, ausdrücklich als offen ausgewiesen.

---

## 1. §3 — Die echte produktive Loading-Aufrufkette

### 1.1 Der Boot ist vollständig synchron (gesichert)

Der Auftrag verlangt: „Wenn der initiale Boot vollständig synchron ist und tatsächlich keine
asynchrone Grenze besitzt, belege das mit der vollständigen Aufrufkette. Dann darf kein
künstlicher Boot-Spinner entstehen."

Die Kette, Glied für Glied:

1. `index.html` lädt `js/ui.js` an Byte-Offset 33052, `js/auth.js` erst an Offset 36028.
   `ui.js` läuft also vollständig durch, bevor irgendein Auth- oder Netzpfad startet.
2. `js/ui.js:3504` enthält `renderDay();` als **Top-Level-Anweisung** — kein Callback, kein
   `DOMContentLoaded`, kein `setTimeout`, kein Promise-Handler. Der erste vollständige
   Dashboard-Aufbau geschieht damit synchron während der Skriptauswertung.
3. `renderDay()` selbst enthält kein `await`, kein `.then(`, kein `setTimeout(` — statisch
   geprüft über den per Klammerbilanz extrahierten Funktionsrumpf.
4. Die von `renderDay()` gerufenen Renderer (`renderCommand`, `renderCheckinCompact`,
   `renderModules`) lesen ausschließlich bereits im Speicher liegende Zustände
   (`orviaScore()`, `DB`, `window._metricsResolved`). Keiner davon eröffnet eine Netzgrenze.

**Belegte Schlussfolgerung:** Beim Boot existiert keine asynchrone Grenze. Ein Boot-Skeleton
wäre eine künstliche Wartezeit und damit ein Verstoß gegen §3. Es wurde keiner eingebaut.
Der Nachweis ist als **Teil A** von `supabase/tests/gm61_contract_test.mjs` automatisiert und
schlägt fehl, sobald jemand später ein `await`/`then`/`setTimeout` in diese Kette einzieht.

### 1.2 Die zwei tatsächlich vorhandenen asynchronen Grenzen (gesichert)

Beide liegen im Analyse-Tab und existierten bereits vor GM6.1. Es wurde **kein neuer
Netzaufruf und keine neue Datenlogik** hinzugefügt — ausschließlich der Lebenszyklus
sichtbar gemacht.

**Grenze 1 — Erholungswerte-Resolver**

```
gmAnaResolved()  (js/ui.js:4679 ff.)
  → ORVIA.profileMetricResolver.collect({withMeta:false, days:8, today:t})
     Wächter:   _gmAnaCollecting          (ui.js:4632)
     Zustand:   _gmAnaState  null|'loading'|'error'   (ui.js:4646)
     Sequenz:   _gmAnaReq                 (ui.js:4648)
     Auflösung: gmAnaRetry()              (ui.js:4654-4656)
  → Verbraucher: gmAnaRecoveryList()      (ui.js:4822-4830)
       _gmAnaState==='loading' → GM-Skeletons (.sk)
       _gmAnaState==='error'   → GM-Fehlerkomponente
       sonst                   → Daten bzw. GM-Empty
```

**Grenze 2 — Muskelvolumenmodell**

```
gmAnaBodyModel()  (js/ui.js:4869 ff.)
  → ORVIA.gymVolume.getProductiveVolumeModel({days, refresh:true, experience})
     Wächter:   _gmMvLoading              (ui.js:4631)
     Zustand:   _gmMvState                (ui.js:4647)
     Sequenz:   _gmMvReq2                 (ui.js:4649)
     Auflösung: gmAnaRetry()
  → Verbraucher: Körperbereich der Analyse (ui.js:4943-4952)
```

Der Cache-Kurzschluss steht jeweils **vor** dem Ladepfad (`ui.js:4679` bzw. `ui.js:4869`):
liegen die Daten bereits vor, wird `_gmAnaState`/`_gmMvState` auf `null` gesetzt und sofort
zurückgegeben — kein Skeleton, keine Wartezeit.

### 1.3 Erreichbarkeit ohne Testhaken (gesichert)

Teil B des Vertragstests prüft während des gesamten Loading-Lebenszyklus
`window._gmStateOverride == null` **und** `window._metricsResolved == null`. Der
Loading-Zustand entsteht dort ausschließlich daraus, dass die echte produktive Abhängigkeit
`ORVIA.profileMetricResolver.collect(...)` noch nicht aufgelöst ist. Damit ist die vom
Auftrag geforderte Bedingung „Loading ist aus echtem Produktionscode erreichbar, nicht nur
über Fixture-Flags" positiv belegt und nicht bloß behauptet.

Geprüfte Übergänge: `Loading → Daten`, `Loading → Empty`, `Loading → Error`; eine verspätet
eintreffende ältere Antwort überschreibt keinen neueren Zustand (Sequenzvergleich
`req !== _gmAnaReq` → verwerfen, ui.js:4692/4697 und 4880); sechs Wiederholungen erzeugen
weder Skeleton- noch Listener-Duplikate.

### 1.4 Warum `js/activity.js` kein Ziel ist (gesichert)

`js/activity.js` gehört zu den 39 eingefrorenen Dateien (md5 `939b2750da5946bc33ddb1d5c4a135c1`,
`docs/gm-ref/gm5_baseline.md`). Ein Skeleton dort hätte diese Datei verändert und damit die
Leitplanke „Diff exakt null" gebrochen. Der Aktivitäts-Tab scheidet als §3-Ziel deshalb aus —
das ist eine Einschränkung des Auftrags, kein Versäumnis.

### 1.5 Der dabei gefundene echte Produktionsfehler (gesichert)

Vor GM6.1 lautete der Wächter in `gmAnaResolved()` nur `!_gmAnaCollecting`. Folge: sobald
`done('error')` den Zustand auf `'error'` setzte und neu rendern ließ, rief das Re-Render
`gmAnaResolved()` erneut auf, ein neuer `collect()` startete sofort, und der Zustand kippte
zurück auf `'loading'`.

Zwei reale Auswirkungen: der Fehlerzustand war **nie** darstellbar, und ein dauerhaft
fehlschlagender Resolver erzeugte eine **Endlosschleife aus Netzaufrufen**.

Behebung — rein orchestrierend, ohne Engine-, Store- oder Resolver-Änderung:

```js
if(P&&typeof P.collect==='function'&&!_gmAnaCollecting&&_gmAnaState!=='error'){   // ui.js:4686
if(!_gmMvLoading&&_gmMvState!=='error'&&window.ORVIA&&ORVIA.gymVolume&&…){        // ui.js:4872
```

Auflösung ausschließlich über die bereits vorhandene, sichere Aktion `gmAnaRetry()`, die
`_gmAnaState`/`_gmMvState` auf `null` zurücksetzt und die Anfragesequenz erhöht.

---

## 2. §2 — Getrennte DOM-Verträge für Hard-Error und Offline+Cache

### 2.1 Die Auslegung von „zusätzlich"

Der Auftrag sagt zu Offline mit Cache: „behält die vorhandenen Module und Werte sichtbar,
zeigt **zusätzlich** den Golden-Master-konformen Offline-/Sync-Hinweis". „Zusätzlich" ist
additiv gelesen: Offline+Cache = unveränderter normaler Aufbau **plus** genau eine GM-`.errbar`.

Der reduzierte GM-Fehler-Hero (`gmErrorHero()`, gedimmter Ring `opacity:.55`, Einheit
„ZULETZT", `—` statt Wert, `#gmRetryBtn`) gehört **ausschließlich** zum Hard-Error. Offline
mit Cache trägt bewusst **keinen** Retry-Knopf — es gibt offline keine echte, funktionsfähige
Retry-Aktion, und der Auftrag erlaubt Retry nur, „wenn eine echte vorhandene Retry-Aktion
existiert".

### 2.2 Die vier Zustände, sauber getrennt

| Zustand | Renderer | Hero | Module/Werte | errbar | Retry |
|---|---|---|---|---|---|
| Hard-Error ohne Daten | GM `errorView` | reduzierter GM-Fehler-Hero | keine | — | ja, `#gmRetryBtn` |
| Offline **mit** Cache | normaler Renderer | unverändert | unverändert sichtbar | genau 1 | nein |
| Offline **ohne** Cache | ehrlicher Empty/Error | GM-Empty bzw. Fehler | keine erfundenen | je Signal | nur bei echter Aktion |
| Lokal-only / pending | normaler Renderer | unverändert | unverändert | — | nein |

Nirgends wird `0` statt „unbekannt" gezeigt; das prüft der Missingness-Vertrag aus GM6 weiter.

### 2.3 Der geforderte direkte Nachweis (gesichert)

Der Auftrag verlangt: „Offline+Cache und Hard-Error erzeugen unterschiedliche DOM-Signaturen.
Offline+Cache enthält die zuvor vorhandenen Fixture-Werte byte-identisch. Hard-Error enthält
diese Werte nicht. Wechsel online → offline → online verliert keine Cache-Inhalte. Es erfolgt
kein Engine-, Store- oder Resolver-Aufruf zur Neuberechnung."

Alle fünf Teilaussagen sind in `supabase/tests/gm6_state_contract_test.mjs` als eigene
Prüfungen umgesetzt. Der Nachweis „kein Resolver-Aufruf zur Neuberechnung" stützt sich auf
den Zähler `__gm6.calls.score`, der den vorhandenen `orviaScore`-Stub **umschließt** statt ihn
zu ersetzen (`/tmp/gm6_fixtures.js:42-46`) — das Verhalten bleibt identisch, gezählt wird nur.

### 2.4 Warum die sechs §2-Ansichten nicht gegen den GM gegated werden

**Gesicherte Ausgangslage:** Der Golden Master kennt den Zustand „offline mit nutzbarem
Cache" **nicht**. Er hat genau drei Sonderansichten (`loadingView`, `errorView`, `emptyView`,
GM-Zeilen 632/636/640), alle drei nur über `originalDashboardRender()` und nur im
Dashboard-Tab.

Ein Diff der Offline+Cache-Ansicht gegen den GM-`errorView` misst deshalb gegen eine
**falsche Referenz** — er misst nicht „weicht ORVIA vom Golden Master ab", sondern
„Datenzustand ist nicht Fehlerzustand". Die gemessenen 30,5–36,6 % sind exakt der Umfang der
Module, die §2 ausdrücklich sichtbar behalten will. Diesen Wert grün zu bekommen, wäre nur
möglich, indem man §2 bricht.

**Auflösung — nachweislich strenger, nicht schwächer:** Der GM-Wert wird weiterhin gemessen
und im Bericht **ehrlich als informativ ausgewiesen**, aber nicht gegated. An seine Stelle
treten zwei Verträge, die zusammen härter sind als ein Pixelgate:

1. **Strukturvertrag (exakt, nicht tolerant):** Die PROD-Sequenz muss gleich der
   GM-Gutzustandssequenz sein, in die an genau einer Stelle — direkt nach `sync` — genau eine
   `errbar` eingefügt ist. Ein Element zu viel, zu wenig oder an falscher Stelle ist rot.
   Zusätzlich elementweiser Geometrievergleich der um die `errbar` bereinigten Sequenz.
2. **Pixelvertrag PROD gegen PROD:** Aufnahme des Datenzustands gegen Aufnahme des
   Offline-Zustands derselben Anwendung, um exakt die gemessene `errbar`-Höhe versetzt
   (`diffShift()`, `tools/gm6_parity.mjs`). Gemessen: **0,01–0,03 % bei 68 px Versatz**. Das
   belegt byte-nah, dass offline **nichts** verändert wird außer der eingefügten Leiste.

Die `errbar`-Komponente selbst wird unverändert **gegen den Golden Master** gemessen:
**1,79 %, ohne Maske**. Keine Maskenerweiterung, keine Referenznormalisierung, die
GM-Datei ist unverändert (md5 geprüft).

---

## 3. §4 — Aktiver Zustand der Stimmungsauswahl

Migriert aus dem Golden Master: die aktuell gewählte Stimmung erhält `.on`. Kanonische
Quelle ist ausschließlich der bestehende Check-in-Wert; `gmMoodKey()` leitet den
Anzeigezustand daraus ab, `gmSetMood()` schreibt in denselben bestehenden Speicher. Es gibt
**keinen zweiten Zustandsspeicher** — der Vertragstest prüft das, indem er nach einem
Re-Render aus dem unveränderten Check-in-Wert erneut exakt die kanonische Auswahl erwartet.

Geprüft (Teil D, gegen die echten Quellen von `gmMoodKey`/`gmSetMood`/`renderCheckinCompact`):
Auswahl, Wechsel, Re-Render-Stabilität, Tastatur (Enter und Space), Fokusführung, fehlender
Wert (kein `.on`, keine erfundene Vorauswahl), und die Invarianz gegenüber A/F/P — der
Ansichtsmodus verändert den gespeicherten Wert nicht. Check-in- und Decision-Logik sind
unverändert.

---

## 4. §5 — Supplement-Stack-Leerzustand

**Der behobene Defekt (gesichert):** Die Sichtbarkeitskette lautet

```
index.html:155   <details class="card acc" id="routinesCard">
styles.css:3305  #nutritionBox,#extraCheckin,#routinesCard,#eveCard{display:none}
styles.css:3306  … .gm-co-open{display:block}
                 gmShowCarryover(id) setzt .gm-co-open
```

Ein inline gesetztes `card.style.display='none'` überschrieb diese Regel und ließ den Bereich
komplett verschwinden — genau das von §5 untersagte Verhalten. Behoben über das `coOpen`-Gate
in `renderRoutines()`: das bestehende Gate bleibt für den Fall „heute ist nichts offen"
unverändert wirksam, aber es überschreibt nicht mehr die geöffnete Ansicht.

**Der Leerzustand:** exakte GM-Empty-Komponente an fester Position innerhalb der vorgesehenen
Struktur:

```js
gmStateEmpty({icon:'db', title:'Noch kein Stack angelegt',
  desc:'…ORVIA schlägt hier nichts automatisch vor.',
  action: stackEdit ? null : 'openStackEditor()', actionIcon:'plus', label:'Stack bearbeiten'})
```

Kein Demo-Supplement, kein automatisch erzeugter Eintrag, kein Legacy-Markup. Die
Erfassungsaktion erscheint nur, wenn sie tatsächlich vorhanden und bedienbar ist — im bereits
offenen Editor (`stackEdit === true`) wird sie unterdrückt, weil sie dort ins Leere zeigte.
Geprüft: leer, teilweise befüllt, vollständig befüllt, Re-Render ohne Duplikate, und —
in C6 — dass das bestehende Verbergen-Gate ohne `.gm-co-open` unverändert greift
(`display === 'none'` bei `openRoutineTasks() === 0`).

---

## 5. §6 — Nachweis für die zwei gelöschten Legacy-Blöcke

Beide Blöcke standen vor `todayPrimaryUnit()` und sind dokumentiert in `js/ui.js:631-635`.

### 5.1 Block 1 — `renderCommand` (erste Definition) samt Helfer `proTechLine`

* **Früherer Funktionsname:** `renderCommand`, erste Definition, mit `.occ`-Markup.
  Zugehöriger Helfer: `proTechLine`.
* **Warum tot:** Die Datei definiert Funktionen per Neudefinition. Die spätere
  GM-Definition `js/ui.js:4050 function renderCommand()` überschrieb die frühere beim
  Skriptdurchlauf. Jeder Aufruf traf ab dem Ende der Auswertung ausschließlich die spätere.
* **Heutiger Zustand (gesichert):** genau **eine** Definition, `js/ui.js:4050`.
* **Frühere Aufrufer, heute alle auf die GM-Version zeigend:** `ui.js:619`
  (`setUiDetailMode`), `ui.js:1108` (Speichern des Check-ins), `ui.js:1773` (Sessions-Update).
* **`proTechLine`:** im **Code null Treffer**; genau **ein** Treffer im
  GM6.1-Dokumentationskommentar (ui.js:632) — was §6 („frühere Funktionsnamen …
  dokumentieren") ausdrücklich verlangt. Der Vertragstest entfernt Block- und Zeilenkommentare
  vor dem Zählen und prüft: Code 0, Dokumentation genau 1.

### 5.2 Block 2 — `renderCheckinCompact` (erste Definition, `.cic-`-Markup)

* **Früherer Funktionsname:** `renderCheckinCompact`, erste Definition, mit `.cic-`-Markup.
* **Warum tot:** identischer Mechanismus; die spätere GM-Definition `js/ui.js:3836` gewann.
* **Heutiger Zustand (gesichert):** genau **eine** Definition, `js/ui.js:3836`.
* **Frühere Aufrufer, heute alle auf die GM-Version zeigend:** `ui.js:1125`
  (nach Speichern, mit `collapseCheckinCard()`), `ui.js:2037`.

### 5.3 Nachweis, dass keine Funktion verloren ging

* **Eingabe:** Beide Blöcke waren reine Renderer. Sämtliche Eingabepfade des Check-ins
  (`gmSetMood`, Formularfelder, Speichern-Aktion) liegen außerhalb der gelöschten Bereiche und
  sind unverändert; die §4-Prüfungen decken sie ab.
* **Safety:** Keiner der beiden Blöcke enthielt eine Gate-, Schmerz-, Warn- oder
  Abbruchentscheidung. `showGate` und die Warnlogik liegen in der Engine und in
  `renderModules`; der Engine-Diff ist exakt null.
* **Persistenz:** Kein `save()`, kein `saveDB()`, kein `orviaSchedulePush()` in den gelöschten
  Blöcken. Die Zähler `persist` und `schedulePush` des Fixture-Harness belegen zusätzlich,
  dass die Zustandswechsel keine Persistenzaktion auslösen.
* **Produktive Route:** Von den fünf Aufrufstellen (619, 1108, 1125, 1773, 2037) löst keine
  eine gelöschte Definition auf — beide Namen haben heute genau eine Definition.

**Keine weitere Legacy-Bereinigung in GM6.1.** Verwaistes `.cic-*`-CSS bleibt bewusst stehen
und ist für GM7 vorgemerkt.

---

## 6. §1 — Reduced Motion

Die Regel bleibt erhalten, als letzte Deklaration innerhalb der bestehenden
Reduced-Motion-Media-Query (`styles.css:2971-2977`):

```css
@media (prefers-reduced-motion:reduce){ … .sk{animation:none} }
```

**Nachweis der Wirkungsgrenze (gesichert):** Die Deklaration steht ausschließlich innerhalb
der Media-Query — geprüft über Klammerbilanz in Teil E des Vertragstests. Die Basisregel
`styles.css:2723 .sk{…animation:sh 1.4s ease infinite…}` ist byte-identisch zur GM-Zeile 194.
Ohne Reduced-Motion-Präferenz ist die Darstellung damit unverändert; die Referenzaufnahmen
laufen ohne dieses Media-Feature, weshalb die Pixelparität unberührt bleibt
(`a_loading 0,02 %`, `f_loading 0,5 %`, `p_loading 0 %`, Komponenten `sk_card`/`sk_kcard`
jeweils `0 %`). Bei aktiver Präferenz entfällt ausschließlich die Bewegung — Geometrie und
Farben bleiben identisch, da nur `animation` gesetzt wird und keine Layout- oder
Farbeigenschaft.

Der Golden Master nimmt `.sk` selbst nicht aus. Das ist eine **bewusste, ausdrücklich
freigegebene Barrierefreiheitsabweichung** und im Quelltext an Ort und Stelle als solche
dokumentiert.

---

## 7. §7 — Gerätestand

**Offen.** Die Gerätebrücke ist nicht verbunden (`get_device_info` und `device_stage_files`
liefern beide „The device this session is bound to is not connected to the bridge"). Damit
sind nicht ausführbar: die Prüfung aller 39 eingefrorenen Dateien auf md5-Identität, der Lauf
der vollständigen Gerätesuite, der Byte-Vergleich Container gegen Gerät und der angemeldete
Live-Boot.

Gemäß §7 wird GM6.1 deshalb als **technisch fertig, aber nicht final abgenommen** gemeldet.

### Hinweis zur Testbilanz (wichtig für die ehrliche Bewertung)

Die Baseline „174 Tests, 168 grün, 6 ENV-Fehler" (`docs/gm-ref/gm5_baseline.md:65`) bezieht
sich auf die **Gerätesuite mit 174 Testdateien in vier Blöcken**. Die Container-Arbeitskopie
enthält nur **19** Testdateien; keine der sechs ENV-abhängigen Supabase-Dateien
(`batch2f_offline_queue_live`, `live_workout_rls_phase42`, `live_workout_rpc_smoke_phase42`,
`muscle_volume_sql_phase43`, `rls`, `training_rls_phase41`) ist im Container überhaupt
vorhanden — jeweils 0 Treffer.

**Die im Container gemessenen „null ENV-Fehler" sind daher keine Verbesserung, sondern eine
andere, kleinere Testpopulation.** Die sechs ENV-Fehler sind unverändert zu erwarten, sobald
die Suite wieder auf dem Gerät läuft. Jede andere Darstellung wäre irreführend.

---

## 8. Leitplanken — Einhaltung

| Leitplanke | Stand |
|---|---|
| Golden Master unverändert | md5 `1b93e15e23054318c8848d5cb10e6bcb`, geprüft |
| Engine / Scheduler / Store / Resolver / Auth / Goals | keine Änderung; Diff null |
| Demo-Daten | keine; Fixtures existieren ausschließlich im Test-Harness |
| Künstliche Ladezeiten | keine; kein Boot-Spinner, kein neuer Netzaufruf |
| `orvia-v8-197` | unverändert, genau 1× in `sw.js` |
| Commit / Push / Deploy | nicht erfolgt |
| Maskenerweiterung / Referenznormalisierung | keine |
| Geänderte Produktivdateien in GM6.1 | ausschließlich `js/ui.js` |
