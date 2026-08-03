# GM7 — Legacy-Deaktivierung + Gesamtabgleich · Abschlussbericht

Stand: 2026-07-27 · Release `orvia-v8-198` · **kein Commit, kein Push, kein Deploy ausgeführt.**
Grundlage: Mandat „Freigabe erteilt: Migriere C2 auf die aktuell live wirksame Architektur.
Danach ohne weiteren Zwischenstopp direkt GM7 …" (§1–§4).

---

## 1. Kernergebnis

GM7 ist abgeschlossen und release-fertig. Der tote Legacy-Bestand ist entfernt, alle
Carry-over-, Safety-, Eingabe- und Persistenzfunktionen sind erhalten, die vollständige
GM1–GM6-Parität hält das ≤2-%-Gate mit einem Maximum von **1,97 %**, und die vollständige
Gerätesuite läuft mit **170 von 178 Tests grün**; die acht übrigen sind auf dem Gerät
technisch nicht ausführbar (sechs fehlende Live-ENV, zwei fehlendes Chromium) und laufen
im Container vollständig grün. Der Cache-Bump auf `orvia-v8-198` ist einmalig und ganz am
Ende erfolgt.

Zwei Punkte sind bewusst **nicht** ausgeführt worden (`.ci-compact`, `h2`→`.sectlabel`);
beide sind unter Punkt 6 mit Begründung offengelegt. Eine Erweiterung gegenüber dem
Wortlaut des Auftrags ist unter Punkt 7 offengelegt (Build-Label in `js/ui.js`).

---

## 2. Ausgangslage und Annahmen

* Ausgangsstand `styles.css`: 3433 Zeilen / 298 415 Bytes / 2955 Regelblöcke
  (Sicherung `/tmp/gm7/bak/styles.css.pre_gm7`, md5 `709e847808749352a40626d47c29b8d3`).
* Ausgangs-Cache-Version: `orvia-v8-197`.
* Der Golden Master wurde zu keinem Zeitpunkt verändert. Parität ist ausschließlich durch
  Änderungen an ORVIA erreicht worden.
* **Annahme, die sich als falsch erwiesen hat und korrigiert wurde:** die frühere
  Kreuzprüfung gegen die Testsuite war vollständig. Sie lief gegen die Container-Kopie mit
  25 Testdateien, während das Gerät 178 führt. Diese Lücke hat einen echten Bruch
  durchgelassen (Punkt 5.2). Alle Kreuzprüfungen dieses Berichts laufen gegen die
  vollständige Menge von 185 Dateien (`supabase/tests` + `tools`) auf dem Gerät.

---

## 3. Was entfernt wurde

| Kennzahl | vorher | nachher | Differenz |
|---|---|---|---|
| Zeilen `styles.css` | 3433 | 3100 | −333 |
| Bytes | 298 415 | 267 476 | −30 939 (−10,4 %) |
| Regelblöcke (ohne Kommentare) | 2955 | 2604 | −351 |
| Vorkommen `.occ` | 49 | 0 | −49 |
| Vorkommen `nav-plus` (Regeln) | 7 | 0 | −7 |
| Vorkommen `cic-*` | 13 | 0 | −13 |

Entfernt wurden 350 vollständige Regelblöcke plus eine Regel, die nur um einen toten
Selektor reduziert wurde. Grundlage ist eine Liste von **175 nachweislich toten Klassen**,
ermittelt mit dem vollständigen CSS-Lexer (`/tmp/gm7/lits.mjs`), nicht mit Regex-Heuristik.

**Regel der Toterkennung:** ein Regelblock gilt nur dann als tot, wenn **jeder** seiner
Komma-Selektoren mindestens eine tote Klasse enthält. Deshalb ist
`.tabbar button.nav-plus,.qa-item{transition:none}` nicht als Block entfernt, sondern nur
um den toten Selektor reduziert worden — `.qa-item` lebt.

Ersetzte Legacy-Renderer: `renderCommand` delegiert vollständig an `gmHero(gmDashVM())`;
die Legacy-`.card`-Definition ist per Property-Kaskadenbeweis auf die zwei nicht
überstimmten `backdrop-filter`-Deklarationen reduziert; die unreferenzierten v5-Slices der
Heute-Seite sind entfernt.

---

## 4. Kreuzprüfung gegen die vollständige Testmenge

Geprüft: 175 tote Klassen gegen **185 Dateien** (`supabase/tests` + `tools`, auf dem Gerät,
Skript `/tmp/cc_gm7.mjs`).

Ergebnis: 19 Klassen mit Token-Treffern. Davon

* **1 echter Treffer** — `nav-plus` in `profile_completion_fix_test.mjs` und
  `today_nav_p7_test.mjs`. Das war der einzige reale Bruch; er ist behoben (Punkt 5.2).
* **5 Treffer in Tests/Werkzeugen, die grün laufen** — `cic-b`, `cic-pill`, `mv`,
  `headrow`, `v3date` in `gm61_contract_test.mjs`, `gm6_state_contract_test.mjs`,
  `tools/gm1_parity.mjs`, `tools/gm6_parity.mjs`. Diese beiden Verträge sind im Container
  mit 99 bzw. 424 Assertions vollständig grün, die Paritätswerkzeuge mit 78 bzw. 284.
* **13 Substring-Fehltreffer** kurzer Tokens (`fi`, `sc`, `sd`, `dt`, `dh`, `pend`, `cmd`,
  `t3`, `dp`, `ih`, `map-pin`, `daynav`, `save-toast`) in Tests, die sämtlich grün laufen.

Der empirische Gegenbeweis ist stärker als die statische Prüfung: die vollständige
Gerätesuite ist nach der Entfernung zweimal gelaufen und weist keinen inhaltlichen Fehler
mehr aus.

---

## 5. Gedrehte Assertions — vollständige Offenlegung

Fünf Assertions prüften nach der Entfernung nachweislich toten Code. Sie sind auf den
heute wirksamen Zielzustand gedreht worden. **Keine davon ist abgeschwächt** — jede prüft
jetzt zwei bis drei Bedingungen statt einer, und jede ist mit einer Negativprobe gegen den
Vor-GM7-Stand als nicht-vakuum belegt.

### 5.1 `shell_v3_migration_test.mjs:45` und `gm61_contract_test.mjs:553`
Bereits in der vorangegangenen Phase gedreht, Negativproben bestätigt.

### 5.2 `profile_completion_fix_test.mjs` B1–B4 (+ neue Sperre B6) und `today_nav_p7_test.mjs` N4

**Sachverhalt:** Der Vertrag entstand, als der Plus-Button ein Kind der Tabbar war und
`.tabbar button` (Spezifität 0,1,1) die schwächere Regel `.nav-plus` (0,1,0) überschrieb.
Die Absicherung war deshalb `.tabbar button.nav-plus` (0,2,1). Mit der Shell-v3-Migration
ist der Button aus der Bar herausgelöst worden: `index.html` führt ihn als
`<button id="navPlus" class="fab">` **außerhalb** der `.tabbar`, und
`shell_v3_migration_test.mjs` erzwingt genau das als Invariante.

**Beweis (`/tmp/gm7/navplus_proof.mjs`):** von 85 Laufzeitdateien (js/mjs/html, ohne
`docs`, `supabase`, `tools`) enthält **keine einzige** das Token `nav-plus`. Die Regeln
konnten seit der Migration kein Element mehr treffen.

**Zielzustand, jetzt geprüft:** `#navPlus.fab` (Spezifität 1,1,0 — von keiner Klassen- oder
Elementregel überstimmbar), 52 px, kreisrund, Gold-Verlauf über `--gold-grad`
(als `linear-gradient` verifiziert), eigene Icon-Regel `.fab .ic`, `position:fixed` mit
festem Randabstand plus 430-px-Bindung von Bar **und** FAB.

**Neue Regressionssperre B6:** `.tabbar button.nav-plus` darf weder im CSS noch die Klasse
`nav-plus` im Markup zurückkehren.

**Negativproben** gegen die Vor-GM7-`styles.css` (`/tmp/gm7/neg/`): B6 wird rot
(`css-frei=false`), N4 wird rot (`solo=false`). Beide Assertions sind damit wirksam.

Ergebnis: `profile_completion_fix` 41/0 (vorher 36/4), `today_nav_p7` 13/0 (vorher 12/1).

### 5.3 Zehn Versionspins auf `orvia-v8-198` nachgezogen
`gm1_shell`, `gm2_plan_parity`, `gm3_activity_parity`, `gm4_analysis_parity`,
`gm5_profile_parity`, `plan_phases_v5`, `plan_quality_v5`, `plan_weeklist_v5`,
`plan_weekvolume_v5`, `analysis_recovery_v5` pinnen die SW-Version hart. Das ist der
Mechanismus, der einen vergessenen Release-Bump aufdeckt; er muss mit jedem Bump
mitgeführt werden. Geändert wurde je Datei **genau eine Zeile**, die Prüfform
(`genau ein Vorkommen von orvia-v8-\d+`) bleibt identisch.
**Negativprobe:** gegen ein `sw.js` mit `v8-197` werden `gm1_shell` und
`analysis_recovery_v5` rot. Die Pins sind nicht vakuum.

---

## 6. Bewusst nicht ausgeführte Masterplan-Punkte

**`.ci-compact` bleibt bestehen.** Die Klasse ist nicht tot: sie steht im Initial-DOM
(`index.html:129`) und `checkin_compact_test.mjs:32` prüft sie als Vertrag. Entfernt wurden
nur die tatsächlich verwaisten `.cic-*`-Regeln (13 Vorkommen → 0).

**`h2` → `.sectlabel` nicht ausgeführt.** Die `h2`-Struktur trägt in rund 56 Karten
lebendes Eingabe-Markup; auf der Heute-Seite betrifft sie ausschließlich die geschützten
Check-in-Eingabekarten. Eine Umstellung wäre eine Layoutänderung an Produktivcode mit
direktem Risiko für das ≤2-%-Gate und ohne funktionalen Nutzen. Der Punkt bleibt offen
und sollte als eigener, pixelgeprüfter Slice geführt werden.

**D2-Kachel-Einbettung auf der Heute-Seite existiert nicht.** `#recoveryTilesV5` steht in
`#tab-dash` (`index.html:269`), nicht auf Heute. Der Masterplan-Punkt ist gegenstandslos.

---

## 7. Offenlegung: eine Änderung über den Wortlaut hinaus

`js/ui.js:5260` zeigt in der Profilzeile das Build-Label. Es stand auf `Build v8-197` und
hat historisch die SW-Version mitgeführt. Mit dem Bump auf `orvia-v8-198` wäre die App
intern inkonsistent gewesen: Cache `v8-198`, angezeigtes Build `v8-197`. Das Label ist
deshalb auf `Build v8-198` gezogen worden — **eine** Zeile, gleiche Zeichenzahl,
`js/ui.js` gehört ausdrücklich zur beschreibbaren Menge der GM-Phasen
(`gm5_baseline.md`, Abnahmekriterium) und ist **nicht** eingefroren.

Kontrolle: die vollständige Paritätssuite wurde nach dieser Änderung erneut gefahren und
liefert **identische** Maxima (Punkt 8). Rückgängig zu machen wäre die Änderung mit einer
Ein-Zeilen-Ersetzung; sie steht hier zur ausdrücklichen Kenntnisnahme.

---

## 8. Paritätsnachweis GM1–GM6

Vollständiger Lauf mit dem finalen Release-Stand (`styles.css` `c553fddd…`,
`js/ui.js` `bcc7768d…`, `sw.js` `e8df129c…`):

| Suite | Assertions | Gate-Prüfungen | Maximum | Ergebnis |
|---|---:|---:|---:|---|
| gm1 | 78 | 9 | **1,97 %** | ALL PASSED |
| gm2 | 71 | 19 | 1,39 % | ALL PASSED |
| gm3 | 99 | 32 | 1,62 % | ALL PASSED |
| gm4 | 122 | 43 | 1,70 % | ALL PASSED |
| gm5 | 197 | 43 | 1,55 % | ALL PASSED |
| gm6 | 284 | 26 | 1,96 % | ALL PASSED |
| **Summe** | **851** | **172** | **1,97 %** | **0 rot** |

**Gesamtmaximum 1,97 % — innerhalb des ≤-2-%-Gates.** Die frühere Berichtsangabe 1,96 % ist
hiermit auf den real gemessenen Maximalwert 1,97 % korrigiert (`gm1/f_attention`,
7621 px). **Es ist keine UI-Anpassung wegen Renderer-Rauschen vorgenommen worden.**

Hinweis zu gm6: die Zustände `*_offline_cache_*` und `f_error_*` weisen zusätzlich einen
informativen Wert (30–37 %) aus. Das ist **nicht** die Gate-Kennzahl, sondern die
dokumentierte Fläche der GM-Fehlerleiste; die Gate-Werte dieser Zustände liegen bei
0,01–0,03 %.

### Renderneutralität der Entfernung (prod-vor gegen prod-nach)

197 ORVIA-Renderings vor und nach der Legacy-Entfernung verglichen
(`/tmp/gm7/prodcmp.mjs`, pixelmatch threshold 0,1): **185 bytegleich, 12 abweichend,
Maximum 0,137 %**, keine Größenabweichung.

Zur Kalibrierung wurden zwei Kontrollläufe desselben Werkzeugs mit **byte-identischem**
`styles.css` gefahren (`/tmp/gm7/cmp2.mjs`): dort weichen 24 von 49 (gm4) bzw. 5 von 9
(gm1) Bildern ab, mit Maxima von **22,4 %** und **26,5 %**. Der Renderer ist
nachweislich nichtdeterministisch, und der GM7-Vergleich ist deutlich **ruhiger** als die
Eigenstreuung des Werkzeugs. Schlussfolgerung: die Legacy-Entfernung hat **keine
nachweisbare Renderwirkung**.

### Kommentar-Nachführung in `styles.css`
Zwei veraltete Kommentarblöcke zum Plus-Button wurden auf den Ist-Zustand gezogen, dazu
die eine Selektorreduktion aus Punkt 3. Kommentarnormalisierter Vergleich beider Stände:
genau **eine** wirksame Abweichung (Δ 24 Zeichen = Länge von `.tabbar button.nav-plus,`),
Regelzahl unverändert 2604 = 2604. Der anschließende vollständige Paritätslauf bestätigt
identische Maxima.

---

## 9. Testabschluss

### Container (25 Tests) — 25/25 grün
Darunter `gm61_contract` 99 ok, `gm6_state_contract` 424 ok, `r1_data_integrity`
82 bestanden / 0 fehlgeschlagen, `checkin_compact` 16 ok, `shell_v3_migration` 26 ok.

### Gerät (178 Tests) — 170 grün, 8 nicht ausführbar, **0 echte Fehler**

| Test | Grund | Beleg |
|---|---|---|
| `batch2f_offline_queue_live` | ENV fehlt: SUPABASE_URL, SUPABASE_ANON_KEY, A_EMAIL, A_PW | — |
| `live_workout_rls_phase42` | ENV fehlt (A+B) | — |
| `live_workout_rpc_smoke_phase42` | ENV fehlt | — |
| `muscle_volume_sql_phase43` | ENV fehlt (A+B) | — |
| `rls_test` | ENV fehlt (A+B) | — |
| `training_rls_phase41` | ENV fehlt (A+B) | — |
| `gm61_contract` | `ERR_MODULE_NOT_FOUND` — kein Playwright/Chromium auf dem Gerät | im Container 99 ok |
| `gm6_state_contract` | `ERR_MODULE_NOT_FOUND` — dito | im Container 424 ok |

**GM6.3 ist damit abgenommen:** `r1_data_integrity_test` vollständig grün (82/0), kein
Produktivcode für diesen Testabschluss verändert, vollständige Gerätesuite ohne echten
Fehler, Pixelmaximum 1,97 % innerhalb des Gates.

**C2 in der migrierten Form:** `renderCommand()` delegiert an die aktive GM-Dashboard-Kette;
`gmDashVM()` hält für unbekannten oder fehlenden Status den konservativen Fallback auf das
Designtoken `attention`; kein unbekannter Zustand ergibt `ready`; der alte Fallback `'y'`
ist in der live geprüften Kette nicht wieder eingeführt. C1 und alle übrigen
Datenintegritätsprüfungen sind unverändert.

---

## 10. Dateizustand — Container und Gerät md5-identisch (18/18)

```
bcc7768d1a055fa21a8dbfe3850d52c5  js/ui.js                       (Build-Label 197→198)
e8df129c374b474538afce8ebea9d9d5  sw.js                          (const C = 'orvia-v8-198')
c553fddd81b5364e0cac2bd5388685d7  styles.css                     (3100 Zeilen)
9d9db850bdaf6346c380896bb72cf172  index.html                     UNVERÄNDERT
e79fed2d96d80e50d6481d8abc9b4f53  supabase/tests/gm1_shell_test.mjs
931c653dad8d125f89533e5acd7b4809  supabase/tests/gm2_plan_parity_test.mjs
b6b800c631ce565d9e2fb81b5b919326  supabase/tests/gm3_activity_parity_test.mjs
ed244ef9bcd1b0dfdf82637a3f511889  supabase/tests/gm4_analysis_parity_test.mjs
c95e0f23ddc70a07d92cc90901246981  supabase/tests/gm5_profile_parity_test.mjs
bbb0e4bd21be0aec7f220f315adaeb59  supabase/tests/plan_phases_v5_test.mjs
6ce7707d40b906987b928b233ace1589  supabase/tests/plan_quality_v5_test.mjs
1777d22b3d8982dfd4a0c32e44f77438  supabase/tests/plan_weeklist_v5_test.mjs
35883d2188ee8c61651a34017ed1eead  supabase/tests/plan_weekvolume_v5_test.mjs
439573fee68ebbcbcf7dc52d17cd21c4  supabase/tests/analysis_recovery_v5_test.mjs
31c7d8b46098ad512d84077148897c10  supabase/tests/profile_completion_fix_test.mjs
ed3ce1e3225a158f1f699bb2fd656eef  supabase/tests/today_nav_p7_test.mjs
bf7ece2671c7b0ac2a5640953e4c9468  supabase/tests/shell_v3_migration_test.mjs
be1cf83350deefdde3fa4a6695525713  supabase/tests/gm61_contract_test.mjs
```

**Eingefrorene Dateien:** `md5sum -c` gegen die 39 Einträge aus `gm5_baseline.md`
(Zeilen 17–62) → **38/39 identisch**, einzige Abweichung `js/auth.js` — die ausdrücklich
autorisierte Ausnahme. Keine weitere eingefrorene Datei wurde berührt.

**Cache-Bump:** einmalig, ganz am Ende, `orvia-v8-197` → `orvia-v8-198`, **genau ein
Vorkommen** in `sw.js`. Differenzkontrolle mit neutralisierter Konstante: die
Cache-Konstante ist die einzige Änderung an `sw.js`.

---

## 11. Risiken und offene Punkte

1. **Nicht ausgeführter Masterplan-Punkt `h2`→`.sectlabel`.** Bleibt offen; Umsetzung nur
   als eigener, pixelgeprüfter Slice sinnvoll (Punkt 6).
2. **Zwei Verträge sind auf dem Gerät nicht lauffähig** (`gm61_contract`,
   `gm6_state_contract`), weil dort kein Chromium/Playwright installiert ist. Sie laufen
   nur im Container. Das ist eine reale Lücke in der Geräteabsicherung — Empfehlung:
   Playwright auf dem Gerät nachinstallieren, damit die Gerätesuite selbsttragend wird.
3. **Sechs Live-Supabase-Tests laufen mangels ENV nirgends.** Sie prüfen RLS und
   RPC-Verhalten — die sicherheitsrelevanteste Schicht. Empfehlung: einen
   ENV-Satz für einen kontrollierten Testlauf bereitstellen.
4. **Blinder Fleck, jetzt geschlossen:** der Container führt 25, das Gerät 178 Tests. Jede
   statische Kreuzprüfung, die nur im Container läuft, ist strukturell blind. Genau daran
   ist der `nav-plus`-Bruch fast vorbeigelaufen. Regel für alle Folgephasen: Kreuzprüfung
   und Abnahme laufen gegen die **Gerätesuite**, nicht gegen die Container-Kopie.
5. **Angemeldeter Live-Boot wurde nicht geprüft.** Die Paritätswerkzeuge fahren das
   produktive Harness, nicht eine echte angemeldete Sitzung gegen Supabase. Diese Lücke
   besteht unverändert und wird hier ehrlich ausgewiesen.

---

## 12. Aufräumen (manuell durch den Owner)

* `Strava/_gm62_dev` — temporärer Entwicklungsordner, ca. **13 MB**. Kann manuell entfernt
  werden. Er wurde **nicht** eigenmächtig gelöscht.
* `backup_pre_gm62/` ist auf dem Gerät nicht mehr vorhanden.
* Container-Arbeitsartefakte liegen unter `/tmp/gm7/` und verfallen mit der Sitzung.

---

## 13. Fazit

GM7 ist vollständig und release-fertig. Der Legacy-Bestand ist nachweisbasiert entfernt,
nicht heuristisch; jede Entfernung ist gegen die vollständige Testmenge und gegen die
Eigenstreuung des Renderers geprüft. Kein Fachtest wurde abgeschwächt — die fünf gedrehten
Assertions prüfen heute mehr Bedingungen als vorher, und jede ist mit einer Negativprobe
belegt. Der Release trägt die Version `orvia-v8-198` konsistent in Service Worker,
Build-Label und zehn Versionspins.

**Kein Commit, kein Push, kein Deploy ausgeführt.** Der Arbeitsbaum ist bereit; die
Freigabe zum Commit liegt beim Owner.
