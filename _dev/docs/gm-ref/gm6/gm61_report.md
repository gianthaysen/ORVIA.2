# GM6.1 — Abschlussbericht (Funktionsabschluss, 7 Phasen)

Stand: 2026-07-27 · Arbeitskopie Container `/mnt/user-data/uploads/Strava/app`
Gerät: `macbook-pro-von-gian-local` · Mount `/sessions/rcw-01bfrpw5cvns46ylgtr4fve1/mnt/Strava/app`

---

## 1. Vollständige Boot-Aufrufkette

`auth.js → onAuthed()` (Definition Zeile 196, Einmal-Latch `onAuthed._initFor` Zeilen 214–215)

| # | Schritt | eigener Re-Render / Signal | erreichte Fläche |
|---|---|---|---|
| 1 | `blobMigration.run()` | – | – |
| 2 | `profileStore.hydrate()` | `rerender()` (renderProfileScreen + renderZones), **kein Event** | Profil |
| 3 | `profileStore.hydrateSports()` | dispatch `orvia:profile-updated ['sports']` + `rerender()` | ui-refresh |
| 4 | `hydrateAvailability()` | dispatch `['availability']` | ui-refresh |
| 5 | `hydrateGoals()` | dispatch `['goals']` | ui-refresh |
| 6 | `hydrateConstraints()` | dispatch `['constraints']` — **letztes Event der Altkette** | ui-refresh |
| 7 | `avatarStore.hydrate()` | `renderTopAvatar()` + `renderProfileScreen()` | Avatar/Profil |
| 8 | `checkinStore.hydrateRecentTypes(35,…)` | `renderDay()` direkt/ungeschützt (checkin-store.js:116) | Heute |
| 9 | `readinessStore.hydrateRecentScores(60)` | **nichts — kein Render, kein Event** | – |
| 10 | `workoutUI.tryRestore()` | `renderEntry()` + `renderHub()` falls `#trainingHub` | Training |

**Belegter Defekt vor GM6.1:** Der 150-ms-Debounce in `ui-refresh.js` feuert nach Schritt 6 —
also **vor** den Schritten 7–10. Auf *Analyse* lief `renderDash()` gegen eine unhydrierte `DB`
und wurde nie wiederholt; auf *Heute* blieb das Baseline-Badge (`#confBox`) stale, weil der
letzte `renderDay()` in Schritt 8 vor der Readiness-Hydration (Schritt 9) lag.
Nach Abschluss der Kette gab es **keinen** Re-Render.

---

## 2. Ready-Vertrag: gefunden vs. ergänzt

**Gefunden (Phase 3 greift für den Mechanismus):** Ein zentraler Refresh-Helfer existiert —
`ORVIA.uiRefresh` in `js/ui-refresh.js` mit `targetsFor()`, Coalescing, 150-ms-Debounce und
Burst-Schutz. Er wird unverändert weiterverwendet; es wurden **keine** fünf Einzel-Listener gebaut.

**Nicht gefunden:** ein Signal für *abgeschlossene* Hydration. `orvia:auth-ready` wurde von
**niemandem** ausgelöst; die einzige Referenz war ein schlafender Listener in
`js/activity-sync.js:102` → `_autoFlush`.

**Ergänzt (Phase-4-Ausnahme, minimal):** genau eine Dispatch-Zeile am tatsächlichen Ende der
Kette in `auth.js`.

* **Einfügestelle:** direkt nach `_P.mark('onAuthed: TOTAL login-init chain', _loginT0);` (Zeile 280) — der Punkt, an dem die Hydrationskette per Definition der bestehenden Instrumentierung abgeschlossen ist. Nachfolgend steht nur noch der Onboarding-Dispatcher.
* **Einmaligkeit:** garantiert der bestehende Latch `onAuthed._initFor === session.user.id` (Zeile 214–215). `TOKEN_REFRESHED` und `USER_UPDATED` kehren dort früh zurück; nur `SIGNED_OUT` setzt den Latch zurück. **Kein neues Feld, kein paralleler Ready-State.**
* **Vorhandene Listener auf `orvia:auth-ready`:** `activity-sync.js:102` (`_autoFlush`) — jetzt aktiv. Seiteneffekt begrenzt: `flushPendingActivities` hat den Single-Flight-Mutex `_flushing` und iteriert sonst eine leere Pending-Liste (null Netz); `pullServerActivities` hat `_pulling` + 5-Minuten-Throttle `_pulledAt` → `{throttled:true}` ohne Netz. `setTimeout(_autoFlush, 1500)` feuert ohnehin bedingungslos beim Start. **Netto kein zusätzlicher Request im Normalfall.** Eine echte Verhaltensänderung bleibt und wird offen ausgewiesen: war `O.user` bei 1500 ms noch nicht gesetzt, lief der Auto-Flush bisher ins Leere — `auth-ready` repariert diesen Fall.
* **Race-Schutz:** vollständig vom bestehenden Latch getragen. Zusätzlich saugt `schedule()` konkurrierende Anlässe zusammen; der jüngere, breitere Anlass gewinnt (leere Sektionsliste = „alles"), ein älterer Lauf kann einen neueren nicht verengen.

---

## 3. Refresh-Verhalten je aktivem Tab

`onAuthReady()` ruft `schedule([], { protectInput: true })` — leere Sektionsliste, also der
defensive „alles"-Pfad von `targetsFor()`, **ohne** dessen Logik zu ändern (P1-Vertrag intakt).

| aktiver Tab | gerenderte Ziele | Nachweis |
|---|---|---|
| Heute | topAvatar, profileCard, zones, **day** | D1 / L2 |
| Plan | topAvatar, profileCard, zones, **plan** | D4 |
| Analyse | topAvatar, profileCard, zones, **dash** | D3 / L3 |
| Profil (`mehr`) | topAvatar, **profileCard**, **zones** | D5 |
| Fremdtabs (`akt`, `hist`, `training`) | nur Kernflächen | D5 / L3 |

Kein erzwungener Wechsel auf „Heute" (Test C3: kein `showTab(` in `ui-refresh.js`; live L3:
Analyse bleibt aktiv). Kein zusätzlicher Netz- oder Store-Aufruf (C4: kein `fetch(`,
`hydrate\w*\(`, `supabase`, `repos.` im ausführbaren Code). Keine neue Renderlogik (C5: kein
`innerHTML` im ausführbaren Code). Kein Doppel-Loop (D2, L5: sechs Anlässe → exakt sechs Renders).

**Eingabeschutz (neu, nur auf diesem Pfad):** `HOSTS` bildet Renderziel → Host ab
(`day:#tab-heute`, `plan:#tab-plan`, `dash:#tab-dash`, `profileCard/zones:#tab-mehr`).
Enthält der Host ein fokussiertes `INPUT/TEXTAREA/SELECT`/contenteditable, wird **diese**
Fläche übersprungen, die übrigen laufen normal. Grund: `renderMorning()` ersetzt
`#morningForm` per `innerHTML` komplett und würde Tipp-Eingaben, Fokus und `data-dirty`
verwerfen. Der bewusste Profil-Save (`orvia:profile-updated`) bleibt **ungeschützt** — P1-Vertrag
unverändert (F4).

Sheets/Modale (`#suppModal/#suppSheet`, `#detailSheet`, `#qaSheet`, `#mmSheet`) liegen außerhalb
aller `#tab-*`-Hosts und werden nicht angefasst (L8: nach allen Refreshes 0 fehlend).

---

## 4. Nachweis der vier echten Loading-Hosts

Vier asynchrone Grenzen mit Race-Guard, unverändert aus GM6:

| Guard | Renderer | Deklaration / Vergleich | `js/ui.js` |
|---|---|---|---|
| `_mvReq` | `renderMuscleVolume` | 1655 / 1658 | ✓ |
| `_rcvReq` | `renderRecoveryTilesV5` | 3601 / 3626 | ✓ |
| `_gmAnaReq` | Analyse-Segment | 4643 / 4648 / 4655 / 4690 | ✓ |
| `_gmMvReq2` | Muskelvolumen (Analyse) | 4643 / 4649 / 4655 / 4878 | ✓ |

`gmStateLoading(` wird an **genau 5** Stellen aufgerufen: 1662, 3627, 4828, 4952, 4954
(Zeile 3975 ist die Funktionsdefinition, kein Aufruf). Kein appweiter Spinner (B2), kein
`gmStateLoading` auf Modulebene (B3), kein Timer-getäuschtes Laden (G6). Hard-Error und
Offline/Cache bleiben getrennt (H1/H2).

---

## 5. Mood- und Supplement-Verifikation (nur geprüft, nichts geändert)

**Stimmung:** `.on` folgt ausschließlich der Projektion aus `morning.feel`
(`checkin-fields.js:80–82`, `key:'feel'`, `el:'m_feel'`; das Abend-Feld `mood`/`e_mood`
Zeile 109 ist ein anderes Feld und bleibt unberührt). `gmMoodKey` ist eine reine Projektion
(`top,top,ok,ok,tired,tired`), fehlender Wert ⇒ `null`. Kein zweiter Zustandsspeicher.
Tap, Enter und Space funktionieren; der Tap mutiert `feel` nicht selbst, sondern führt in das
echte Check-in-Formular; ein Re-Render zeigt den gespeicherten kanonischen Wert.

**Supplements/Routinen:** Carry-over bleibt außerhalb der GM-Hauptstruktur — im Golden Master
existiert keine Supplement-Sektion, es ist **keine** neue sichtbare Hauptsektion entstanden.
Zugriff weiterhin ausschließlich über die vorgesehene Quick Action. Leerer Stack nutzt die
generische GM-Empty-Komponente (`.card > .empty`, `0 stackitem`, `_stack=0`).
`openStackEditor()` und `addStack()` bleiben die echten Aktionen. Keine Demo-Supplements,
`0 save()`, keine automatische Anlage; sechs Wiederholungen erzeugen keine Duplikate.

---

## 6. Pixel-Diffs

| Werkzeug | Ergebnis | schlechtester Zustand |
|---|---|---|
| `gm1_parity` | ALL PASSED (78 ok) | `f_attention` **1,97 %** |
| `gm2_parity` | ALL PASSED (71 ok) | `session_planned_390` 1,39 % |
| `gm3_parity` | ALL PASSED (99 ok) | `f_month_top` 1,62 % |
| `gm4_parity` | ALL PASSED (122 ok) | `end_f_bot` 1,70 % |
| `gm5_parity` | ALL PASSED (197 ok) | `page_bestTimes390` 1,55 % |
| `gm6_parity` | ALL PASSED (284 ok) | – |

Alle Zustände unter dem ≤2-%-Gate. Keine Maskierung ergänzt, keine Referenz verändert.

---

## 7. Testbilanz

| Suite | Ergebnis |
|---|---|
| **`gm61_hydration_contract_test.mjs`** (neu, test-first) | **43 ✅ / 0 ❌** |
| `ui_refresh_p1_test.mjs` (Regressionswächter P1) | 20 ✅ / 0 ❌ |
| `gm61_contract_test.mjs` | ALL PASSED (99 ok) |
| `gm6_state_contract_test.mjs` | ALL PASSED (424 ok) |
| Container-Gesamtsuite (21 Dateien) | 21 ✅ / 0 ❌ |
| Live-Browser (`/tmp/gm61h/live_check.mjs`, echtes DOM) | **12 ✅ / 0 ❌** |

Der neue Vertrag deckt: A (auth.js: Dispatch genau einmal, nach Kettenende `mark=14263 <
dispatch=14913`, hinter dem Latch `latch=9950`, ohne `detail:`-Payload, `SIGNED_OUT` gibt frei,
`TOKEN_REFRESHED`/`USER_UPDATED` teilen den Latch-Pfad, kein zweites Ready-Flag) ·
B (synchroner Boot, kein appweiter Spinner) · C (genau eine Registrierung, kein Tabwechsel,
kein Netz, keine Renderlogik, Ladereihenfolge, SW-ASSETS) · D (genau ein Refresh je Tab,
hydrierte Daten sichtbar, keine Hydration ⇒ kein falsches Ready) · E (konkurrierende Läufe,
kein Listener-Zuwachs bei dreifachem Laden, sechs Wiederholungen konstant) ·
F (Eingabeschutz) · G (vier Race-Guards) · H (Hard-Error ≠ Offline).

**Live-Nachweis gegen das echte `index.html`-DOM:** aktiver Tab wird erkannt (L1); genau ein
Refresh der sichtbaren Fläche (L2); Analyse bleibt aktiv (L3); sechs Wiederholungen →
konstante DOM-Anzahl `{nodes:714, sheets:4, tabs:5}` (L4) und exakt sechs Renders (L5);
offene Eingabe im echten `#tab-heute`/`#morningForm` → `renderDay=0`, Wert bleibt `7`
(L6a–d); nach Fokusverlust wieder normal (L7); Sheets unversehrt (L8); keine Seitenfehler (L9).

---

## 8. Geräte- und MD5-Nachweis

| Prüfung | Ergebnis |
|---|---|
| Eingefrorene Dateien **Gerät** | **39/39 OK** — Baseline unangetastet |
| Eingefrorene Dateien **Container** | **38/39 OK**, einzig `js/auth.js: FAILED` (die dokumentierte Ausnahme) |
| `sw.js` Zeile 1 | `const C = 'orvia-v8-197';` — Gerät **und** Container identisch (`e0cc137204c65e3efca239dfe9d3e94c`), kein SW-Bump |
| Gerätesuite | **175 Tests: 169 ✅ / 6 ❌** |

Die 6 Gerätefehler sind **vorbestehend und umgebungsbedingt**, nicht GM6.1-verursacht:
`batch2f_offline_queue_live_test.mjs`, `live_workout_rls_phase42_test.mjs`,
`live_workout_rpc_smoke_phase42_test.mjs`, `muscle_volume_sql_phase43_test.mjs`,
`rls_test.mjs`, `training_rls_phase41_test.mjs` — alle mit Exit 2 und der Meldung
`ENV fehlt: SUPABASE_URL, SUPABASE_ANON_KEY, A_EMAIL, A_PW, B_EMAIL, B_PW`.
Sie laufen gegen den **unveränderten** Gerätestand, der GM6.1 gar nicht enthält.

**Wichtige Divergenz, offen ausgewiesen:** Das Gerät hat **weder GM6 noch GM6.1**.
`js/ui.js` Gerät `d546feb533e16a673e43a6e2d7b20fdc` (5208 Zeilen) vs. Container
`fee5c739eb02349d8f0876d4b38c8630` (5421 Zeilen); `styles.css` Gerät
`0419ae379c414796e2a58660cded2ba7` vs. Container `709e847808749352a40626d47c29b8d3`;
`js/ui-refresh.js` Gerät `f68720a5f62215834d638796d03ee722` vs. Container
`d69b2dad07819de421854dc6f9005f67`; `js/auth.js` Gerät `87f08ae7a93eb3e4dfc10d67d9445ca8`
(= Baseline) vs. Container `de1ecff28d0ea43eb128ad43c5674cf3`. `index.html` und `sw.js` sind
identisch. **Der 39/39-Gerätenachweis belegt daher ausschließlich die Unversehrtheit der
Baseline, nicht den GM6.1-Stand.** Kein Commit, kein Push, kein Deploy erfolgt.

---

## 9. Exakter Auth-Diff

`js/auth.js`: 834 → **842 Zeilen**, 43 763 → **44 399 Bytes** (**+8 Zeilen, +636 Bytes,
null Löschungen, keine weitere Änderung**). Eingefügt als Zeilen 281–288:

```js
281
282    // GM6.1 (2026-07-27): Hydration abgeschlossen. Die letzten vier Schritte
283    // (avatar/checkin/readiness/workout) melden sich nicht selbst — readinessStore
284    // rendert gar nichts. Genau ein bereits erwartetes Signal am tatsächlichen
285    // Ende der Kette; Konsumenten sind ORVIA.uiRefresh (sichtbarer Tab) und der
286    // vorhandene Listener in activity-sync.js. Einmaligkeit garantiert der Latch
287    // onAuthed._initFor oben — kein neues Feld, kein paralleler Ready-State.
288    try { if (typeof CustomEvent === 'function' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('orvia:auth-ready')); } catch (e) {}
```

Kontext (Zeile 280 davor, Zeile 289 danach unverändert):

```js
280    _P.mark('onAuthed: TOTAL login-init chain', _loginT0);
...
289    try {
290      // Onboarding nur bei pending öffnen. Dispatcher (onboarding-ui) …
```

**Umkehrprobe:** `cp js/auth.js /tmp/auth_rev.js && sed -i '281,288d' /tmp/auth_rev.js`
→ 834 Zeilen, md5 `87f08ae7a93eb3e4dfc10d67d9445ca8` = eingefrorene Baseline **byteidentisch**.
Damit ist bewiesen: an dieser Datei wurde nichts anderes verändert — keine Auth-Entscheidung,
keine Session-Verarbeitung, kein Login/Logout, keine Hydrationsreihenfolge, keine
Store-Fehlerbehandlung, keine Persistenz.

Zweite geänderte Datei: `js/ui-refresh.js` (**nicht** eingefroren) — Kopfkommentar, `HOSTS` +
`hasOpenInput()`, `apply(targets, opts)`, `schedule(sections, opts)`, `onAuthReady()`,
zweite Registrierung im bestehenden `__orviaUiRefreshBound`-Block, Export `_onAuthReady`.
`targetsFor()` und `activeTabName()` sind **unverändert**.

---

## 10. Offene Live-Prüfpunkte

1. **Angemeldeter Live-Boot am echten Supabase-Backend** ist weiterhin nicht durchgeführt (keine Credentials in dieser Umgebung). Der Refresh-Vertrag ist gegen das echte `index.html`-DOM live bewiesen, der Auslöser in `auth.js` bisher nur statisch (A1–A7) — dass `onAuthed()` in einer echten Session genau einmal bis Zeile 288 läuft, ist begründet, aber nicht am laufenden Backend gemessen.
2. **`activity-sync._autoFlush` am echten Backend:** Der Netz-Nullbefund ist aus `_flushing`, `_pulling` und dem 5-Minuten-`_pulledAt` abgeleitet, nicht per Netzwerk-Trace bestätigt. Die eine reale Verhaltensänderung (Reparatur des Falls „`O.user` bei 1500 ms noch nicht gesetzt") sollte beim ersten echten Login beobachtet werden.
3. **Vorbestehend, bewusst nicht angefasst:** `checkin-store.js:116` ruft `renderDay()` direkt und ungeschützt auf — dieser Pfad kann eine offene Eingabe weiterhin überschreiben. Eine Korrektur wäre eine Store-Änderung und ist in GM6.1 verboten.
4. **`akt`-Tab** hat in `targetsFor()` keinen profilabhängigen Renderer; `activity.js` hört selbst auf `orvia:profile-updated`. Auf `auth-ready` wird dort nichts neu gezeichnet — bewusst, da hierfür kein zweiter Lebenszyklus erfunden werden darf.
5. **Container↔Gerät-Divergenz** (Punkt 8): GM6 und GM6.1 liegen ausschließlich im Container. Vor einer Geräteabnahme muss der Stand übertragen und die Gerätesuite auf dem *neuen* Stand wiederholt werden.
6. **Die 6 ENV-bedingten Gerätefehler** sind mangels Credentials nicht sachlich verifiziert, sondern nur als umgebungsbedingt eingeordnet.

---

**Leitplanken eingehalten:** keine Trainingsengine-, Scheduler-, Store- oder Resolver-Änderung ·
keine Demo-Daten · keine künstliche Ladezeit · keine neue sichtbare Golden-Master-Struktur ·
Golden Master unverändert · `orvia-v8-197` unverändert · kein Commit, Push oder Deploy.

**GM7 bleibt gesperrt.**
