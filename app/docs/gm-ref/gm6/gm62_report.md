# GM6.2 — Geräte- und Eingabeschutzabschluss · Abschlussbericht

Datum: 2026-07-27 · Status: **abgeschlossen, zur Abnahme vorgelegt** · GM7 bleibt gesperrt.

Geltungsbereich: kontrollierte Zusammenführung von Container- und Gerätestand (§1),
Auth-Ready-Vertrag (§2), Absicherung des direkten Check-in-Re-Renders (§3),
Eingabeschutztest (§4), Netzwerkvertrag (§5), Geräteverifikation (§6),
MD5-Vertrag (§7), Container-Geräte-Parität (§8).

---

## 1 · Hunk- und Konfliktaudit (§1)

Vor jeder Änderung wurde jede betroffene Datei vollständig zwischen Container und
Gerät verglichen. Der Vergleich lief physisch **auf dem Gerät** (Containerdatei in
den geräteseitigen Scratchordner gelegt, `diff` dort gerechnet), damit kein
Übertragungsartefakt das Ergebnis verfälschen kann.

| Datei | Gerät vorher (md5) | Container (md5) | Hunks | +/− | Zuordnung | Konflikte |
|---|---|---|---|---|---|---|
| `js/ui.js` | `d546feb533e16a673e43a6e2d7b20fdc` | `fee5c739eb02349d8f0876d4b38c8630` | 26 | +352 / −139 | 100 % GM6/GM6.1 | 0 |
| `styles.css` | `0419ae379c414796e2a58660cded2ba7` | `709e847808749352a40626d47c29b8d3` | 1 | +7 / −1 | 100 % GM6 (R1) | 0 |
| `js/ui-refresh.js` | `f68720a5f62215834d638796d03ee722` | `135e8806cbb84280090c439e3886f3e8` | 3 | +70 / −8 | 100 % GM6.1/GM6.2 | 0 |
| `js/auth.js` | `87f08ae7a93eb3e4dfc10d67d9445ca8` | `de1ecff28d0ea43eb128ad43c5674cf3` | 1 | +8 / −0 | 100 % GM6.1 | 0 |
| `js/checkin-store.js` | `009d00ba3f50acc95fa60292bde3fa6c` | `1849432c66afae0ffee9b9557c2ddcbb` | 2 | +32 / −1 | 100 % GM6.2 | 0 |

**Kategorienbilanz: 33 Hunks gesamt — 33 eindeutig GM6/GM6.1/GM6.2, 0 geräteseitige
fremde Änderungen, 0 Konfliktstellen.** Beleg für „keine fremde Änderung": das Gerät
hielt vor dem Merge in allen fünf Dateien exakt den dokumentierten Ausgangsstand
(md5-Spalte „Gerät vorher"), `js/auth.js` sogar byte-identisch mit der eingefrorenen
GM5-Baseline. Es gab damit keine parallele Bearbeitung, die hätte erhalten werden
müssen.

Die drei `ui-refresh.js`-Hunks im Detail:

* **Hunk 1** (`@@ -13,6 +13,21 @@`, +15): GM6.1-Kopfkommentar zu `orvia:auth-ready`
  und `protectInput`. Reiner Kommentar, keine Ausführungssemantik.
* **Hunk 2** (`@@ -40,8 +55,25 @@`): neue `HOSTS`-Map und `hasOpenInput(sel)`;
  `apply(targets)` wird zu `apply(targets, opts)` mit
  `var protect = !!(opts && opts.protectInput);` und der einen Schutzzeile
  `if (protect && HOSTS[t] && hasOpenInput(HOSTS[t])) return;`.
  Ohne `opts` ist das Verhalten bitgleich zum P1-Stand.
* **Hunk 3** (`@@ -56,31 +88,61 @@`): `onProfileUpdated` wird zum dünnen Wrapper,
  die Planerlogik wandert unverändert in `schedule(sections, opts)` (Debounce 150 ms,
  Coalescing, Burst-Limit >5/s bleiben identisch); neu `onAuthReady()` →
  `schedule([], {protectInput:true})`, eine zusätzliche `addEventListener`-Zeile
  und der zusätzliche Exportname `schedule`.

**Offenlegung (siehe auch §8):** die Übertragung erfolgte technisch als
*vollständige Dateiersetzung*, nicht als Patch-Anwendung. Das ist hier zulässig und
äquivalent, weil (a) der Vor-Merge-md5 jeder Datei belegt, dass das Gerät exakt den
Stand hielt, gegen den die Hunk-Liste erstellt wurde, und (b) das Hunk-Audit keine
einzige fremde Stelle gefunden hat. Bei einer fremden Änderung wäre dieser Weg
unzulässig gewesen und ich hätte gestoppt.

Gerätebackup vor dem Merge: `Strava/_gm62_dev/backup_pre_gm62/` (mit belegten
Vor-Merge-md5s). Container-Vollbackup: `/tmp/ctr_backup/app`.

**Technische Randnotiz zum Transfer:** `tar x` kann auf dem Gerätemount keine
*existierenden* Dateien ersetzen (`Cannot open: File exists`), weil tar vor dem
Schreiben unlinkt und der Mount kein Löschen erlaubt. Gelöst durch Entpacken nach
`_gm62_dev/stage/` und anschließendes `cat quelle > ziel` (truncate+write). Nach dem
Schreiben wurde jede Datei per md5 gegen den Container geprüft.

---

## 2 · Endgültiger Auth-Diff (§2)

`js/auth.js`, genau ein Hunk, Zeilen 281–288, **+8 Zeilen, 0 Löschungen, +636 B**:

```js
    _P.mark('onAuthed: TOTAL login-init chain', _loginT0);
+
+    // GM6.1 (2026-07-27): Hydration abgeschlossen. Die letzten vier Schritte
+    // (avatar/checkin/readiness/workout) melden sich nicht selbst — readinessStore
+    // rendert gar nichts. Genau ein bereits erwartetes Signal am tatsächlichen
+    // Ende der Kette; Konsumenten sind ORVIA.uiRefresh (sichtbarer Tab) und der
+    // vorhandene Listener in activity-sync.js. Einmaligkeit garantiert der Latch
+    // onAuthed._initFor oben — kein neues Feld, kein paralleler Ready-State.
+    try { if (typeof CustomEvent === 'function' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('orvia:auth-ready')); } catch (e) {}
```

Vertragsprüfung Punkt für Punkt:

* **Position**: unmittelbar nach `_P.mark('onAuthed: TOTAL login-init chain')`, also
  nach dem letzten Kettenglied `workoutUI.tryRestore()` (Zeile 278) und nach
  `checkinStore.hydrateRecentTypes(...)` (Zeile 276). Die Kette selbst ist unberührt.
* **Einmaligkeit**: keine neue Latch-Logik. Der vorhandene `onAuthed._initFor` bleibt
  alleiniger Einmal-/Session-Schutz; `SIGNED_OUT` setzt ihn wie bisher zurück.
* **Hydrationsreihenfolge**: unverändert (0 gelöschte Zeilen).
* **Login, Logout, Token Refresh, Persistenz**: unverändert.
* **Keine neuen Auth-Felder**, keine zweite Ready-Logik.
* Der Dispatch ist vollständig in `try/catch` und prüft `CustomEvent` sowie
  `window.dispatchEvent` — auf einer Umgebung ohne beides passiert nichts.

---

## 3 · Endgültiger Check-in-Store-Diff (§3)

`js/checkin-store.js`, zwei Blöcke, **+32 / −1**, 174 → 206 Zeilen,
10241 → 12188 B.

**Block 2 — der eigentliche Auftrag** (ersetzt die alte Zeile 116):

```js
-    try { if (typeof renderDay === 'function') renderDay(); } catch (e) {}
+    try {
+      const _uiR = window.ORVIA && window.ORVIA.uiRefresh;
+      if (_uiR && typeof _uiR.schedule === 'function') _uiR.schedule(['day'], { protectInput: true });
+      else if (typeof renderDay === 'function' && !_gm62InputOpen()) renderDay();
+    } catch (e) {}
```

**Block 1 — der Fallback-Wächter** `_gm62InputOpen()` direkt nach `isValidType`
(Zeilen 33–48). Er greift ausschließlich, wenn `ui-refresh.js` nicht geladen ist
(Teil-Load, defektes SW-Cache-Update). Rein lesende DOM-Prüfung, kein Store-, Fach-
oder Netzwerkbezug; `#morningForm`, `#checkinCard` und `#tab-heute` sind explizit
abgedeckt. Damit ist die Mandatsauflage „kein Fallback darf ein geöffnetes
`#morningForm` überschreiben" erfüllt.

Was **nicht** geändert wurde: die Check-in-Hydration (`hydrateRecentTypes` liest,
mappt und schreibt in `DB` exakt wie vorher), die gespeicherten Daten, die Store-API
(`res(...)`-Rückgabe unverändert), die Persistenzlogik, die Zahl der Netzwerkaufrufe.
Die Änderung liegt vollständig hinter `O.checkinMorningMigrated = true;` und vor
`return res(...)` — also im reinen Darstellungsteil.

**Zwei dokumentierte Nebenwirkungen des mandatierten Aufrufs** (bewusst berichtet,
nicht wegerklärt):

1. `schedule(['day'], …)` löst über `targetsFor` zusätzlich `topAvatar` und
   `profileCard` aus. Der erste Parameter von `targetsFor` bezeichnet
   **Sektionen, nicht Ziele** — `['day']` ist keine bekannte Sektion, `topAvatar`
   und `profileCard` sind die unbedingten Kernflächen. In der realen Login-Kette
   entsteht dadurch **kein Zusatzaufwand**: Hydration (auth.js:276) und Ready
   (auth.js:288) liegen 12 Zeilen auseinander und verschmelzen im 150-ms-Debounce
   zu genau einem Refresh (Test D9, Netzwerkzähler G8: `{avatar:1, card:1, zones:1,
   day:1, plan:0, dash:0}`).
2. Ist ein **anderer Tab** aktiv, entfällt der Heute-Render, den der Altpfad blind
   ausführte. Unschädlich und sogar sparsamer, weil `showTab('heute')`
   (`js/ui.js:3419`, `if(name==='heute')_safe(renderDay);`) bei jedem Öffnen des
   Tabs ohnehin `renderDay` aufruft.

---

## 4 · Fokus- und Hydrationstest (§4)

Zwei unabhängige Nachweise, weil ein Sandbox-Test den echten DOM-Pfad nicht
abdecken kann.

**a) Vertragstest** `supabase/tests/gm62_input_guard_test.mjs` (neu, test-first
geschrieben, 17004 B, md5 `ca6702085b167ef0d169606c5b08ad37`), **48 Zusicherungen**:

| Block | Inhalt |
|---|---|
| A1–A11 | Quelltextvertrag `checkin-store.js`: alter ungeschützter Aufruf existiert nicht mehr, neuer Aufruf exakt `schedule(['day'],{protectInput:true})`, Fallback nur mit Wächter, keine Store-/Persistenz-/Netzänderung |
| B1–B4 | `ui-refresh.js`: `schedule` öffentlich, identisch mit der internen Funktion, kein zweiter Planer |
| C1–C8 | Fokusfall: Feld mit Wert `7` bleibt bestehen, `renderDay` = 0 während des Fokus, Ready-Refresh danach überschreibt ebenfalls nicht |
| D1–D9 | Ohne Fokus: normale Aktualisierung; Tab-Semantik von `targetsFor` festgeschrieben; D9 = Debounce-Verschmelzung |
| E1–E3 | Datenidentität: der UI-Schutz mutiert keine Store-Daten |
| F1–F4 | sechs Hydrations-/Ready-Zyklen ohne Listener- oder DOM-Duplikate |
| G1–G8 | Netzwerk-/`activity-sync`-Vertrag (siehe §5) |

Ergebnis: **Container 48/48, Gerät 48/48.**

**b) Live-Harness** `/tmp/gm62h/live_check.mjs` — echter Chromium, echte
`index.html`-Struktur, echtes `ui-refresh.js`, echtes `checkin-store.js`,
Viewport 390×844. **20/20 bestanden.** Kernbelege:

| Prüfpunkt | Ergebnis |
|---|---|
| L1 sichtbare, fokussierte Eingabe im geöffneten `#morningForm` | ok |
| L3 kein `renderDay()` während des Fokus | `renderDay = 0` |
| L4 Feld existiert weiter und enthält exakt `7` | `value = 7` |
| L5 Fokus bleibt im Feld | ok |
| L6 hydrierte Daten liegen trotzdem im Store | `sleepMin = 431` |
| L7 Auth-Ready-Refresh überschreibt die Eingabe nicht | `renderDay = 0` |
| L8 übrige Flächen werden aktualisiert | `topAvatar ≥ 1`, `profileCard ≥ 1` |
| L10 nach Fokusverlust wird Heute wieder normal aktualisiert | `renderDay = 1` |
| L11 Hydration ohne Fokus | `renderDay = 1` |
| L12/L14 sechs Hydrations- bzw. Ready-Zyklen: DOM konstant | `{nodes:717, sheets:4, tabs:5}` unverändert |
| L13/L15 genau sechs Renders, keine Vervielfachung | `renderDay = 6` |
| L16 genau ein Datenabruf je Hydration | `listRange = 1` |
| L17 kein Netzwerk-Request aus dem Refresh-Pfad | 0 |
| L18 Sheets/Modale unversehrt | 0 fehlend |
| L19 keine Seitenfehler | 0 |

Damit ist jede einzelne Auflage aus §4 belegt, einschließlich „nach Speichern/Schließen
erscheint der hydrierte Zustand" (L10) und „keine Store-Datenmutation durch den
UI-Schutz" (E1–E3, L6).

---

## 5 · Netzwerkzähler (§5)

| Zusicherung | Ergebnis |
|---|---|
| G1 `activity-sync.js` hört genau einmal auf `orvia:auth-ready` | ✅ (`js/activity-sync.js:102`) |
| G2 der 1500-ms-Fallback existiert unverändert | ✅ (`js/activity-sync.js:103`) |
| G3 `_autoFlush` ist an eine bestehende Session gebunden | ✅ (`O.user && O.user.id`) |
| G4 der UI-Refresh selbst erzeugt keinen Request | ✅ |
| G5 der Store-Schutzpfad erzeugt keinen zusätzlichen Request | ✅ |
| G6 **genau ein `_autoFlush` je erfolgreicher Login-Init-Kette** | ✅ `flush = 1` |
| G7 die Hydration selbst löst kein Ready aus (kein zweiter Pull) | ✅ |
| G8 Heute wurde in dieser Kette nicht doppelt gerendert | ✅ `{avatar:1, card:1, zones:1, day:1, plan:0, dash:0}` |
| L17 (Live) kein Netzwerk-Request aus dem Refresh-Pfad | ✅ 0 Requests |
| L16 (Live) genau ein Datenabruf je Hydration | ✅ `listRange = 1` |

**Ehrliche Einordnung der vier vom Mandat verlangten Kategorien:**

* **Repariert:** nichts. Es gab keinen defekten Netzwerkpfad.
* **Bereits vorgesehener Auto-Flush:** `_autoFlush` über `orvia:auth-ready` war in
  `js/activity-sync.js:102` schon vorhanden und lief bisher **nie**, weil niemand das
  Event auslöste. GM6.1 aktiviert diesen bereits angelegten, aber toten Pfad. Das ist
  eine Verhaltensänderung — sie ist gewollt und war der Zweck des Ready-Events.
* **Zusätzliche Requests:** genau **einer** je Login-Init-Kette, nämlich der jetzt
  wirksam werdende `_autoFlush` (`flushPendingActivities()` + `pullServerActivities()`).
  Er ersetzt nicht den 1500-ms-Fallback, sondern kommt ihm zuvor. `TOKEN_REFRESHED`
  und `USER_UPDATED` erzeugen wegen `onAuthed._initFor` keinen zweiten Lauf.
  Der UI-Refresh selbst erzeugt **null** Requests.
* **Vollständig unterdrückte Duplikate:** die drei bis vier Heute-Renders, die die
  Hydrationskette zuvor in Serie auslöste (Debounce-Verschmelzung, D9/G8), sowie der
  bisher ungeschützte `renderDay()` aus dem Store bei offener Eingabe.

Nicht belegt, weil ohne angemeldete Live-Sitzung nicht belegbar: dass der
1500-ms-Fallback im **echten** Betrieb keinen zweiten Pull erzeugt. Der Testbeweis
(G2/G6) ist ein Sandbox-Beweis mit gezählten Aufrufen; siehe §10.

---

## 6 · Pixel-Diffs (§6)

Alle sechs Paritätstools wurden mit dem **finalen GM6.2-Bytestand** erneut im
Container ausgeführt:

| Tool | Ergebnis | schlechtester Zustand |
|---|---|---|
| `gm1_parity` | ALL PASSED (78 ok) | `f_attention` **1,96 %** |
| `gm2_parity` | ALL PASSED (71 ok) | `session_planned_390` 1,39 % |
| `gm3_parity` | ALL PASSED (99 ok) | `f_month_top` 1,62 % |
| `gm4_parity` | ALL PASSED (122 ok) | `end_f_bot` 1,70 % |
| `gm5_parity` | ALL PASSED (197 ok) | `page_bestTimes390` 1,55 % |
| `gm6_parity` | ALL PASSED (284 ok) | `f_attention_430` **1,96 %** |

**Summe 851 Zusicherungen, 0 Fehler. Schlechtester Pixel-Diff über alle Zustände:
1,96 % — unter dem ≤2-%-Gate, kein einziger Zustand darüber, keine Maske, keine
Referenzänderung.** Der Golden Master ist unangetastet geblieben.

**Warum nur im Container:** das Gerät hat weder Playwright noch Chromium, und
`device_bash` hat keinen Netzzugang, über den sich beides installieren ließe. Die
sechs Paritätstools und die zwei browserbasierten GM-Contract-Tests sind auf dem
Gerät prinzipiell nicht lauffähig. Da Container und Gerät für `js/ui.js`,
`styles.css`, `index.html` und alle Paritätstools byte-identisch sind (§8), gilt das
Container-Ergebnis für den Gerätestand — aber es ist ein **abgeleiteter**, kein direkt
auf dem Gerät gemessener Nachweis. Das wird hier ausdrücklich so gekennzeichnet.

---

## 7 · Vollständige Gerätesuite (§6)

**Syntaxprüfung** (`node --check`) auf dem Gerät: `js/ui.js`, `js/ui-refresh.js`,
`js/auth.js`, `js/checkin-store.js` — **alle OK**.

**Service-Worker:** `sw.js` enthält `const C = 'orvia-v8-197';` **genau einmal**,
unverändert, kein Bump.

**Suite: 179 Testdateien, 170 grün, 9 rot.** Die neun roten Dateien in drei sauber
getrennten Kategorien:

**(a) Sechs ENV-abhängige Tests** — genau die bekannten sechs, unverändert:
`batch2f_offline_queue_live`, `live_workout_rls_phase42`,
`live_workout_rpc_smoke_phase42`, `muscle_volume_sql_phase43`, `rls_test`,
`training_rls_phase41`. Sie brauchen eine erreichbare Supabase-Instanz.

**(b) Zwei playwrightbedingt nicht lauffähige GM-Contract-Tests:**
`gm61_contract_test.mjs` und `gm6_state_contract_test.mjs`. Im **Container** laufen
beide vollständig grün: `gm6_state_contract` ALL PASSED (424 ok),
`gm61_contract` ALL PASSED (99 ok). Auf dem Gerät scheitern sie an
`ERR_MODULE_NOT_FOUND` statt sauber zu überspringen — siehe §10, offener Punkt 2.

**(c) Ein offener fachlicher Befund:** `r1_data_integrity_test.mjs`, 59 bestanden,
1 fehlgeschlagen — siehe §10, offener Punkt 1.

**Grüne Kernverträge auf dem Gerät:**

| Test | Gerät | Container |
|---|---|---|
| `gm62_input_guard_test` | ✅ 48/48 | ✅ 48/48 |
| `gm61_hydration_contract_test` | ✅ 43/43 | ✅ 43/43 |
| `analysis_endurance_v5_test` | ✅ ALL PASSED (23 ok) | ✅ 23 ok |
| `analysis_recovery_v5_test` | ✅ ALL PASSED (23 ok) | ✅ 23 ok |
| GM1–GM5-Verträge (Sandbox-Anteil) | ✅ | ✅ |

**Zwei Tests waren zwischenzeitlich rot und wurden ursächlich geklärt, nicht
wegerklärt:** `analysis_endurance_v5` und `analysis_recovery_v5` schlugen nach dem
Merge fehl, weil das Gerät **ältere Testfassungen** hielt. Mit einer Rollback-Probe
(Vor-Merge-`ui.js` + `styles.css` zurückgespielt) wurde empirisch bewiesen, dass die
Ursache im GM6-`ui.js` liegt und nicht in GM6.2. GM6 hatte im Container das
**Testgerüst** angepasst — die echten GM6-Zustandskomponenten werden jetzt aus
`ui.js` in die Sandbox geladen, statt Ersatzmarkup zu erfinden. Ein
Zeile-für-Zeile-Vergleich der `ok('…')`-Listen belegt: **23 von 23 Zusicherungen in
Text und Reihenfolge identisch, keine einzige abgeschwächt.** Nur das Gerüst wurde
angepasst. Nach Übertragung der Container-Fassungen sind beide wieder grün.

---

## 8 · Aktualisierter MD5-Nachweis (§7)

**Korrektur einer Mandatsprämisse.** Das Mandat verlangt den Nachweis
„37/39 + 2 Ausnahmen". Der korrekte Nachweis lautet **38/39 + 1 Ausnahme**. Grund:
die eingefrorene Liste in `docs/gm-ref/gm5_baseline.md`, Zeilen 17–62, enthält
**weder `js/checkin-store.js` noch `js/ui-refresh.js`**. Beide Dateien kommen im
gesamten Dokument nicht ein einziges Mal vor (`grep` über die vollständige Datei:
0 Treffer). `js/checkin-store.js` ist also nie eingefroren gewesen — die in §3
gewährte „eng begrenzte Store-Datei-Ausnahme" war für den MD5-Vertrag gar nicht
nötig; sie bleibt inhaltlich trotzdem eingehalten (§3).

**Ergebnis `md5sum -c` gegen die eingefrorene Liste, ausgeführt auf dem Gerät:**

```
38 von 39 Dateien: OK
js/auth.js: FAILED   ← die eine autorisierte Ausnahme
```

**Umkehrproben, beide auf dem Gerät gerechnet:**

| Datei | Gerät jetzt | nach Rücknahme des dokumentierten Diffs | Baseline / Ausgangsstand | Ergebnis |
|---|---|---|---|---|
| `js/auth.js` | `de1ecff28d0ea43eb128ad43c5674cf3` (44399 B, 842 Z.) | `87f08ae7a93eb3e4dfc10d67d9445ca8` (43763 B, 834 Z.) | `87f08ae7a93eb3e4dfc10d67d9445ca8` | **identisch** |
| `js/checkin-store.js` | `1849432c66afae0ffee9b9557c2ddcbb` (12188 B, 206 Z.) | `009d00ba3f50acc95fa60292bde3fa6c` (10241 B, 174 Z.) | `009d00ba3f50acc95fa60292bde3fa6c` | **identisch** |

Die Umkehrprobe entfernt bei `js/auth.js` ausschließlich die Zeilen 281–288 und bei
`js/checkin-store.js` ausschließlich die beiden GM6.2-Blöcke (Zeilen 33–48 und
132–148, letztere ersetzt durch den Original-Einzeiler). Dass beide Dateien danach
**byte-genau** wieder den Ausgangsstand ergeben, beweist: außerhalb der
dokumentierten Diffs wurde nichts verändert — kein Whitespace, keine Zeilenenden,
keine versehentliche Formatierung.

**Keine weitere eingefrorene Datei weicht ab.** Das Abnahmekriterium aus §7 ist
erfüllt.

---

## 9 · Container-Geräte-Parität (§8)

**Vollständiger Abgleich, nicht nur der GM-Blöcke.** Es wurde ein md5-Manifest über
**alle 382 Dateien** der Container-Arbeitskopie erzeugt
(`/tmp/gm62_ctr_manifest.txt`, md5 `f5609c4a142b99634b66bce720b2015b`), auf das Gerät
übertragen und dort mit `md5sum -c` geprüft.

**Ergebnis: 381 von 382 Dateien byte-identisch. Genau eine Abweichung.**

Die eine Abweichung ist `docs/gm-ref/results.json` — die **generierte Ausgabedatei**
der Paritätstools (`fs.writeFileSync(OUT + 'results.json', …)`, jeweils letzte Zeile
jedes Tools), kein Produktiv- und kein Vertragsartefakt. Inhaltlicher Unterschied:
ein einziger Wert, `prof_p.px` = 3596 (Gerät) gegen 3594 (Container) — 2 Pixel von
rund 546 000, `pct` in beiden Fällen identisch 0,66. Dass es sich um Lauf-zu-Lauf-
Rauschen des Renderers und nicht um eine echte Abweichung handelt, zeigt der neue
`gm5_parity`-Lauf im Container: er produzierte im selben Feld jetzt `prof_a.px` 3596
statt zuvor 3594, bei unverändertem `pct`. **Beide Fassungen halten das ≤2-%-Gate:
schlechtester Wert auf dem Gerät 1,55 %, keine einzige Kennzahl über 2 %.**
Die Gerätefassung wurde bewusst **nicht** überschrieben, weil sie das Ergebnis eines
geräteseitigen Laufs des Nutzers ist und damit unter „fremde Geräteänderung
bewahren" (§1) fällt.

**Byte-Gleichstand der relevanten Artefakte:**

| Artefakt | md5 (Container = Gerät) |
|---|---|
| `js/ui.js` | `fee5c739eb02349d8f0876d4b38c8630` |
| `js/ui-refresh.js` | `135e8806cbb84280090c439e3886f3e8` |
| `js/auth.js` | `de1ecff28d0ea43eb128ad43c5674cf3` |
| `js/checkin-store.js` | `1849432c66afae0ffee9b9557c2ddcbb` |
| `styles.css` | `709e847808749352a40626d47c29b8d3` |
| `index.html` | `9d9db850bdaf6346c380896bb72cf172` |
| `sw.js` | `e0cc137204c65e3efca239dfe9d3e94c` |
| `tools/gm1..gm6_parity.mjs` | alle sechs identisch |
| `supabase/tests/gm62_input_guard_test.mjs` | `ca6702085b167ef0d169606c5b08ad37` |
| `supabase/tests/gm61_hydration_contract_test.mjs` | `d55ea783e6a282d72b248873b54f0a75` |
| `supabase/tests/gm6_state_contract_test.mjs` | `61b637bb4629262d8860a51dd6681884` |
| `supabase/tests/gm61_contract_test.mjs` | `865b651d1cde3529e8865c34d6448b68` |
| `supabase/tests/analysis_endurance_v5_test.mjs` | `b3e4a701bdd74617774ad58135ce0fa4` |
| `supabase/tests/analysis_recovery_v5_test.mjs` | `41b3834badedc8030b83968b9ccb4d92` |
| `docs/gm-ref/gm6/` (162 Dateien) | Sammel-md5 `807c7e0bdf00a0db39bf05b789287056` |

**Fremde Geräteänderungen ausdrücklich außerhalb dieses Vergleichs erhalten:** das
Gerät führt 651 Dateien, der Container 382. Die 269 nur geräteseitig vorhandenen
Dateien wurden nicht angefasst, darunter `supabase/tests/r1_data_integrity_test.mjs`
(existiert ausschließlich auf dem Gerät) und `docs/gm-ref/results.json` in der
Gerätefassung.

**Ausdrückliche Offenlegung, wie vom Mandat verlangt:** die fünf App-Dateien,
`tools/gm6_parity.mjs`, vier Testdateien und 162 Dateien unter `docs/gm-ref/gm6`
wurden als **vollständige Dateien** ersetzt, nicht als Patch angewendet. Die
Zulässigkeit ist in §1 begründet und md5-belegt. Nichts davon wird hier verschwiegen.

---

## 10 · Offene Punkte und angemeldete Live-Prüfpunkte

**Offener Punkt 1 — entscheidungsbedürftig: `r1_data_integrity_test.mjs` (59/1).**

Dieser Test existiert nur auf dem Gerät und ist ein Fachtest des Auftraggebers. Er
schneidet sich seinen Prüfbereich so aus `ui.js`:

```js
const cmd = ui.slice(ui.indexOf('function renderCommand'), ui.indexOf('function todayPrimaryUnit'));
ok('C1 renderCommand ohne Calc.ampel (nur dayState-SSoT)', !/Calc\.ampel\(/.test(cmd));
ok('C2 renderCommand fällt konservativ auf y zurück', /\|\|'y'/.test(cmd.replace(/\s/g, '')));
```

Der Schnitt funktionierte nur, weil zufällig ein **toter Duplikat-`renderCommand`**
unmittelbar vor `todayPrimaryUnit` stand. GM6 hat dieses tote Duplikat entfernt
(JS-Hoisting: bei zwei gleichnamigen Top-Level-Funktionsdeklarationen gewinnt die
spätere; der frühe Block war nie aktiv). Seither ist der Startindex größer als der
Endindex, der Slice ist **leer** → **C2 rot, C1 nur noch vakuum-grün**
(falsch-positiv, weil ein leerer String kein `Calc.ampel(` enthält).

Belegt: die **fachliche** Zusicherung ist intakt.

| Beleg | vor GM6 | nach GM6 |
|---|---|---|
| `function renderCommand` bei Offset | 46333 (Z. 638) **und** 344351 (Z. 3945) | nur noch 351272 (Z. 4050) |
| `function todayPrimaryUnit` bei Offset | 50162 (Z. 691) | 46366 (Z. 638) |
| live genutzte `renderCommand` | Z. 3945, 760 B, md5 `d20093cb34796756b86f987d53d38bdf` | Z. 4050, 2017 B, md5 `2f307ea6bb589572e021969b39f35283` |
| enthält `Calc.ampel(`? | nein | nein |
| enthält `\|\|'y'`? | nein | nein |
| konservativer `\|\|'y'`-Fallback im Livecode | Z. 594, 2504, 3210 | Z. 594, 2504, 3210 |
| Zähler `\|\|'y'` in `ui.js` gesamt | 4× | 3× — exakt die tote Kopie entfernt |

**Der Test wurde bewusst nicht angefasst** (Leitplanke: keine Fachtests verändern
oder abschwächen). Entscheidung des Auftraggebers erforderlich: entweder der
Slice-Ausdruck wird in einer eigenen Phase auf die live genutzte `renderCommand`
umgestellt (dann prüft C1/C2 wieder echt), oder der Test bleibt als bekannt-roter
Marker stehen. **Empfehlung:** Umstellung des Slice, weil C1 derzeit falsch-grün ist
— eine vakuum-grüne Zusicherung ist gefährlicher als eine rote.

**Offener Punkt 2 — Portabilitätsdefekt in zwei GM-Testdateien.**
`supabase/tests/gm61_contract_test.mjs:561-562` und
`supabase/tests/gm6_state_contract_test.mjs:18-19` enthalten:

```js
try { return await import('playwright'); }
catch (_) { return await import('/tmp/node_modules/playwright/index.js'); }
```

Der Fallback ist ein containerspezifischer Hardcode-Pfad. Auf dem Gerät führt er zu
`ERR_MODULE_NOT_FOUND` statt zu einem sauberen Skip mit klarer Meldung. Vorschlag für
eine spätere Phase (nicht für GM6.2): Fallback in einen expliziten Skip mit Hinweis
umbauen. Bis dahin gilt: beide Tests sind im Container grün (424 ok / 99 ok).

**Offener Punkt 3 — angemeldeter Live-Boot bleibt ehrlich offen.** Nicht belegbar
ohne echte Anmeldung gegen die Produktivdatenbank:

* dass `orvia:auth-ready` in der **echten** Login-Kette genau einmal feuert
  (Sandbox-Beweis liegt vor, Realbeweis nicht),
* dass der 1500-ms-Fallback in `activity-sync.js` im Realbetrieb keinen zweiten Pull
  auslöst,
* dass `_autoFlush` im Realbetrieb genau einen Pull erzeugt,
* die realen Ladezeiten der Hydrationskette auf dem iPhone,
* das Verhalten bei einem echten SW-Update mit teilweise altem Cache (der
  `_gm62InputOpen`-Fallback ist genau dafür gebaut, aber real ungetestet).

**Aufräumen:** der Geräte-Scratchordner
`Strava/_gm62_dev` (13 MB, außerhalb von `app/`) enthält Backups, Transferarchive und
Umkehrproben. `device_bash` kann auf dem Mount nicht löschen — bitte manuell
entfernen, sobald GM6.2 abgenommen ist. Der Ordner
`_gm62_dev/backup_pre_gm62/` sollte bis zur Abnahme erhalten bleiben.

---

## Leitplanken-Bilanz

| Auflage | Status |
|---|---|
| keine Trainingsengine-, Scheduler- oder Resolver-Änderung | eingehalten (alle betroffenen Dateien md5-identisch mit der Baseline) |
| keine fachliche Store-Änderung | eingehalten (nur der Darstellungsaufruf ersetzt, §3) |
| keine Demo-Daten | eingehalten |
| keine künstliche Ladezeit | eingehalten (der 150-ms-Debounce ist Bestandsstand, nicht neu) |
| keine neue sichtbare Struktur | eingehalten (0 Pixel-Diff-Regression, alle Gates ≤2 %) |
| kein weiterer Legacy-Abbau | eingehalten (GM6.2 hat nichts entfernt) |
| kein Commit, Push oder Deploy | eingehalten |
| Golden Master unangetastet | eingehalten |
| `orvia-v8-197` unverändert, kein SW-Bump | eingehalten (genau ein Vorkommen) |
| keine Fachtests verändert oder abgeschwächt | eingehalten (23/23 Zusicherungen belegt identisch; `r1_data_integrity` nicht angefasst) |

**GM6.2 ist aus meiner Sicht abnahmefähig**, mit der Einschränkung des offenen
Punkts 1 (`r1_data_integrity`), der eine Entscheidung erfordert.

**GM7 bleibt gesperrt.**
