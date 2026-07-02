# ORVIA · TEST-GAP-PLAN

Status: P0 + P1 UMGESETZT (offline, 2026-07-02; Live-E2E ausstehend — PROJECT_STATE §9). P2–P7: PROPOSAL, Freigabe ausstehend.
Umgesetzt P0: js/clock.js + Adoption (workout-store Timer/Pause/Terminal, data.js todayStr/dkey, profile-store computeAge), supabase/tests/_helpers.mjs; live_workout_pause + profile_phase1 deterministisch (exakte Asserts). Korrektur: checkin_phase2* stubben todayStr bereits fest → nicht flaky.
Umgesetzt P1: DI-Refactor (handler.mjs + dünner index.ts-Wrapper), register_with_invite_test.mjs (29 Fälle; Rot/Grün-Nachweis: 5 Zieltests rot vor Produktregeln), Idempotenz-Produktregeln (Resume unbestätigter Nutzer inkl. Passwort-Update, Orphan-Heilung, Parallel-Duplikate, erschöpfter Code mit eigener Redemption).
Baseline: 71 Testdateien — 65 offline grün, 5 Live-ENV, 1 deterministisch rot (Altersgrenzen-Off-by-One, KNOWN_ISSUES #6).
Grundlage: verifizierte Modul-Lektüre (migrate-blob.js, profile-store.js, offline-queue.js, sync.js vollständig gelesen; Edge Function + profile.js-Save-Pfade aus Audit 2026-07-02).
Regel: Tests kodieren den ZIEL-Vertrag. Wo das Zielverhalten vom Ist abweicht (z. B. Idempotenz der Registrierung), schlägt der Test vor dem Fix fehl — das ist beabsichtigt (test-first, §16.2 CLAUDE.md).

---

## Priorisierung nach Risiko

| Prio | Paket | Risiko, das abgesichert wird |
|---|---|---|
| P0 | F: Clock-/Test-Infrastruktur | Enabler; entfernt Flakiness-Quellen für alle folgenden Pakete |
| P1 | 1: Edge Function register-with-invite | KRITISCH — Registrierungsausfall (Incident-Klasse), Invite-Verbrauch, Idempotenz |
| P2 | 2: migrate-blob.js | HOCH — Datenverlust/Duplikate bei Alt-Daten-Migration, komplett ungetestet |
| P3 | 3: profile-store + profile.js-Save-Pfade | HOCH — stiller Verlust von Profileingaben, Default-Overwrite (KNOWN_ISSUES #2) |
| P4 | 6: Multi-Account/Multi-Device (inkl. sync.js-Guards) | HOCH — Datenleck zwischen Nutzern, Fremd-Push in falsches Konto |
| P5 | 4+5: sync.js LWW + offline-queue generisch | MITTEL-HOCH — Snapshot-Überschreiben, Queue-Reihenfolge/Retry |
| P6 | 7: Service Worker / Cache | MITTEL — Stale-Client, gemischte Versionen (Training-Tab leer) |
| P7 | 8: UI-Rendering Navigation + Profil-Editoren | MITTEL — Regressionsschutz vor UX-Phase 5 |

Umsetzungsreihenfolge: P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7.
Begründung: P0 ist Voraussetzung für stabile Zeit-Tests; P1 blockiert Beta; P2/P3 sichern Bestandsdaten, BEVOR Phase 3/4 (Datenvertrag/vertikale Persistenz) den Code ändert; P4 vor P5, weil die Kontowechsel-Guards das größte Schadenspotenzial haben; P6/P7 vor der UX-Phase 5 als Regressionsnetz.

---

## P0 · Paket F: Clock-Provider + gemeinsame Test-Utilities

Kategorie: UNIT-Infrastruktur. Benötigt EINEN kleinen Produktionscode-Baustein (freigabepflichtig, Phase-1-Paket):

- Neu `js/clock.js`: `ORVIA.clock = { now: () => Date.now(), todayStr: () => <lokales YYYY-MM-DD> }`. Module nutzen `O.clock` statt `Date.now()`/`new Date()` direkt. Migration INKREMENTELL: zuerst nur workout-store (Timer/Pause), checkin-Tagesschlüssel, computeAge — genau die als flaky identifizierten Stellen (live_workout_pause 7× Date.now; checkin_phase2 Tagesgrenze; profile_phase1 Geburtstagsgrenze). Kein Big-Bang.
- Test-Utility `supabase/tests/_helpers.mjs` (nur Testcode): `withFixedClock(iso, fn)`, Fake-Supabase-Builder (Erfolg/Fehler/Offline je Tabelle konfigurierbar), In-Memory-IndexedDB (aus live_workout_flush_phase42_test extrahieren statt duplizieren), Element-Registry-DOM (aus auth_dom_test extrahieren), localStorage-Stub mit Inspektion.

DoD: bestehende 71 Suiten bleiben grün; die 4 als zeitabhängig markierten Suiten laufen mit fester Uhr deterministisch; Helpers von mind. 2 neuen Paketen genutzt.

---

## P1 · Paket 1: supabase/functions/register-with-invite

**Funktionen:** `Deno.serve`-Handler, `findBetaCode()`, `errorFromRpc()`, `normalizeEmail/Code/Redirect()`; RPC-Vertrag `orvia_complete_invite_registration`.
**Datenpfad:** Client `registerWithInvite()` (auth.js:426) → Edge Function → `invite_codes`-Lookup → `admin.createUser(email_confirm:false)` → RPC (Profil + Invite-Verbrauch) → `auth.resend(type:'signup')` → Vertrag §8 `{ok, flowVersion:2, status:'confirmation_required', email, emailSent}` → Client `acceptRegistration()` → `showConfirmPending()`.
**Voraussetzung (freigabepflichtiger Mini-Refactor):** Handler als testbare Funktion `handleRegister(req, deps)` mit injizierbarem Admin-Client exportieren; `Deno.serve` bleibt dünner Wrapper. Ohne DI sind Offline-Zweigtests nicht möglich.
**Kategorien:** UNIT (Deno, `deno test`, Mock-Admin-Client) + LIVE-E2E (deployte Funktion, Test-Invites).
**Stubs:** Mock-Admin-Client (createUser/rpc/resend/from je Szenario ok/fehler), Mock-Request.

Testfälle → Erwartung:

| Fall | Erwartung |
|---|---|
| gültiger Invite, neue E-Mail | 200, Vertrag §8 komplett, `emailSent:true`, used_count+1, redemption-Zeile |
| ungültiger/fehlender Invite | 400 `invalid_invite`, KEIN createUser-Aufruf |
| abgelaufen / verbraucht | 400 `invite_expired` / `invite_used`, kein createUser |
| Passwort <8 | 400 `weak_password`, kein Invite-Zugriff nötig |
| bereits BESTÄTIGTER Nutzer | 400 `invalid_invite` („E-Mail kann nicht verwendet werden"), Invite NICHT verbraucht |
| bereits UNBESTÄTIGTER Nutzer (Ziel-Vertrag Phase 1!) | 200 `status:'confirmation_required'`, Resend statt Neuanlage, Invite NICHT erneut verbraucht — **schlägt vor Phase-1-Fix fehl (gewollt)** |
| createUser ok, RPC-Fehler | 400 strukturiert, deleteUser-Cleanup aufgerufen; Cleanup-Fehler geloggt |
| createUser ok, resend-Fehler | 200, `emailSent:false`, KEIN deleteUser, Invite verbraucht (dokumentierte Produktregel) |
| Duplicate Request (2× schnell, gleiche E-Mail) | genau EIN Auth-User; zweite Antwort deterministisch (unbestätigt-Zweig), kein Doppel-Invite-Verbrauch |
| ungültiges redirectTo (kein http/https, Müll) | `normalizeRedirect`→null, resend ohne emailRedirectTo (GoTrue-Site-URL), kein 500 |
| Rate Limit (GoTrue 429 bei resend) | 200 + `emailSent:false`, Fehler geloggt ohne PII |
| idempotentes Wiederholen nach `emailSent:false` | Client-Resend-Pfad führt zum Ziel; kein verwaister Zustand |

**Live-Smoke-Matrix** (nach Deploy, mit Wegwerf-Invite `max_uses` klein, echter Mailbox): Erfolgsfall inkl. Mailzustellung + PKCE-Link + Login; Login vor Bestätigung; Resend; abgelaufener/benutzter Link; anschließend Testnutzer-Cleanup dokumentiert.
**Risiken abgesichert:** Incident-Klasse „User angelegt, Client zeigt Fehler"; Invite-Doppelverbrauch; dauerhafte Blockade unbestätigter Nutzer; falsche Erfolgsmeldung beim Mailversand.
**DoD:** alle Zweige offline getestet (deno test grün); Duplicate-/Idempotenz-Fälle kodiert (rot bis Phase-1-Fix, danach grün); Live-Smoke-Checkliste ausgeführt und protokolliert; keine Secrets in Logs/Tests.

---

## P2 · Paket 2: js/migrate-blob.js

**Funktionen:** `run(opts)`, `getStatus()`, `readBlobDB()`, `readProfile()`, Batch-Logik (200er-Chunks), Natural-Key-Bildung (`blob:<date>:<sport>`, `blob:primary:<goal>`).
**Datenpfad:** `onAuthed()` (auth.js:236 ff.) → `blobMigration.run()` → localStorage (`gian_checkins_v2`, `orvia_profile_v1`) → `O.repos.profile/checkin/trainingLoad/goal` → `orvia_migrations`-Statuszeile.
**Kategorie:** INTEGRATION (offline; echte Modul-Datei, Fake-Supabase + localStorage-Stub).
**Stubs:** Fake-Repos mit Aufzeichnung aller save/saveMany-Payloads; Fake-`orvia_migrations` (from().upsert/select); konfigurierbare Fehlerinjektion pro Repo-Call.

Testfälle → Erwartung:

| Fall | Erwartung |
|---|---|
| leerer Blob (kein Key) | success, report `{migrated:0}`-artig, Status completed, keine Repo-Writes außer ggf. Profil |
| vollständiger Legacy-Blob (Tage+morning+eve+sessions+Profil+Ziele) | korrekte Row-Zahlen im Report; toRow je Typ aufgerufen; Batches à 200 |
| beschädigter Blob (kaputtes JSON) | `success:false`, `corrupt_blob`, Status `failed`, Original-localStorage UNVERÄNDERT |
| teilweise migriert / erneuter Lauf | Status completed → zweiter run() ohne force: `skipped:true`, NULL Repo-Writes |
| force-Wiederholung | identische Natural-Keys → gleiche Upsert-Payloads (Duplikatfreiheit über Keys nachweisbar) |
| Fehler mitten in Migration (checkin-Batch 2 schlägt fehl) | Warnings gefüllt, Status `completed_with_warnings`, übrige Bereiche trotzdem migriert, Blob bleibt |
| Heuristik hfMax 190 / rhr 60 | wird als NICHT gemessen migriert (null) — kein erfundener Messwert |
| Nutzerwechsel (O.user wechselt zwischen Läufen) | Status/Writes strikt je user_id; kein Übertrag |
| Cloud bereits vorhanden / lokale neuer | run() überschreibt nur per Upsert auf Natural-Keys — Verhalten dokumentieren; KEIN Löschen von Cloud-Zeilen |
| keine Session | `no_session`, keine Writes |

**Risiken abgesichert:** Datenverlust/Duplikate bei Alt-Nutzern, kaputte Migration blockiert Login-Pfad (run läuft in onAuthed), erfundene Messwerte.
**DoD:** alle 10 Fälle grün; Report-Format asserted; nachweislich kein localStorage-Write durch run(); Suite läuft <2 s offline.

---

## P3 · Paket 3: profile-store.js + Save-Pfade in profile.js

**Funktionen:** `hydrate()`, `persist()`, `applyRow()`, `neutralizeMapped()`, `clear()`, `computeAge()`; profile.js: `_profileSave(changedSections)`, `saveProfile()`, `loadProfile()`, `ensureProfile()`, je Editor die Save-Funktion (`saveRecoveryEditor`, `savePreferencesEditor`, `saveSportProfileEditor`, `saveAvailabilityEditor`, `saveGoal`, `_perfSave`, `saveProfileSection`, `saveSportsEditor`, `saveConstraint`, `_devPersist`, `saveEquipmentEditor`, `saveLocationEditor`).
**Datenpfad C (je Editor):** Öffnen (Laden aus PROFILE) → Ändern → Validieren → Save-Funktion → `_profileSave()` → PROFILE-Mutation + `saveProfile()` → localStorage `orvia_profile_v1` → Event `orvia:profile-updated` → (mapped Felder) `profileStore.persist()` → Repo/Queue → Reload (`loadProfile()`/`hydrate()`) → identischer Zustand.
**Kategorie:** UNIT (profile-store pur) + DOM/INTEGRATION (Editor-Pipeline in vm-Sandbox, Muster von recovery_prefs_4g_test wiederverwenden).
**Stubs:** localStorage-Stub, Fake-profileRepository (ok/fehler/offline), Fake-offlineQueue, Element-Registry für Editor-DOM.

Testfälle → Erwartung (Kern):

| Fall | Erwartung |
|---|---|
| hydrate: Tabelle liefert Row | applyRow überschreibt NUR MAPPED; `null` bleibt `null` (kein `|| ''`), hfMax=Messwert oder null |
| hydrate: keine Row | neutralizeMapped; Legacy-Felder unangetastet |
| hydrate: Fehler/offline | Felder NICHT zerstört, `sync_status pending/failed` korrekt |
| persist online ok / Fehler | Standard-Ergebnisformat durchgereicht; Fehler NICHT verschluckt |
| persist offline | enqueue('user_profiles', row,'user_id') mit user_id aus Session; `pending` |
| persist ohne Session/Repo | `failed` mit klarer Message, kein Throw |
| computeAge Grenzfälle | Geburtstag heute/morgen, 29.02., >120 → null (koordiniert mit Fix KNOWN_ISSUES #6) |
| ensureProfile mit korruptem Blob | dokumentiert IST-Verhalten (Defaults) als CHARAKTERISIERUNGSTEST + markiert Ziel: Recovery-Flow (Phase 3) |
| je Editor: Save→Reload-Roundtrip | geänderte Felder nach loadProfile() identisch; `updatedAt` gesetzt; Event mit changedSections gefeuert |
| Persistenzfehler beim Editor-Save | Nutzer-sichtbarer Fehlerpfad (kein stilles „gespeichert") — kodiert Zielverhalten, ggf. vor Fix rot |
| Accountwechsel | clear() leert NUR mapped; profileMigrated false |

**Risiken abgesichert:** stiller Verlust von Editor-Eingaben, Default-Overwrite als „echte" Daten, hydrate zerstört lokale Felder.
**DoD:** Roundtrip-Test für mind. die 7 Sheet-Editoren + Personal; alle profile-store-Zweige grün; Charakterisierungstest ensureProfile dokumentiert Abweichung explizit.

---

## P4 · Paket 6: Multi-Account- und Multi-Device-Verhalten

**Funktionen:** sync.js `applyUserScope()`, `clearLocalUserData()`, `orvia_data_owner`-Guard in `start()`/`push()`; profile-store `clear()`; offline-queue User-Filter (`pendingForCurrentUser`, flush-Filter Z. 123), `purgeUser()`; auth.js `orviaLogout()`.
**Datenpfad:** Login User A → Daten → Logout → Login User B (gleiches Gerät) bzw. „frisches Gerät" (leerer localStorage/IndexedDB) → Hydration.
**Kategorie:** INTEGRATION (offline, simuliertes Zweitgerät = zweiter Stub-Satz) + LIVE-RLS-Ergänzung (app_state in rls_test aufnehmen!).
**Stubs:** localStorage-/IndexedDB-Stubs mit Vollinspektion, Fake-Supabase app_state.

Testfälle → Erwartung:

| Fall | Erwartung |
|---|---|
| Kontowechsel A→B | clearLocalUserData löscht alle `orvia_*`/`gian_checkins_v2` außer device/active_user/onboard_pending; PROFILE neutralisiert; Decision-Cache invalidiert; workoutStore geleert |
| Fremd-Owner nach iOS-Eviction (owner≠user, active_user fehlt) | Löschen VOR Render/Sync; kein Fremd-Push |
| push() setzt Owner | `orvia_data_owner` = aktueller User nach erfolgreichem Push |
| B loggt ein, A-Daten lokal | NIEMALS Push von A-Daten in B-Konto (start()-Zweig Z. 146-148) |
| Queue: A offline-Einträge, B flusht | 0 geflusht; A-Einträge bleiben; purgeUser(A) entfernt nur A |
| Zweitgerät leer + Cloud vorhanden | Pull lädt Snapshot; markRev gesetzt; Rerender |
| Zweitgerät mit lokalen Tagen + Cloud vorhanden | lokale gewinnen (push), KEIN stilles Überschreiben lokal — dokumentiert LWW-Grenze für Phase-3-ADR |
| Logout | orviaClearLocal + Keys entfernt; kein PROFILE-Rest sichtbar |

**Risiken abgesichert:** Datenleck zwischen Nutzern (Datenschutz!), Fremddaten-Push, Score/Entscheidung des Vornutzers sichtbar.
**DoD:** alle Fälle offline grün; rls_test um `app_state`-Zwei-Konten-Fall erweitert (Live); Erkenntnisse fließen als IST-Analyse in das Phase-3-ADR.

---

## P5 · Paket 4+5: sync.js (LWW-Snapshot) und offline-queue.js (generisch)

**sync.js-Funktionen:** `snapshot()`, `applySnapshot()`, `push()`, `schedulePush()` (1500 ms Debounce), `start()`, `countLocalDays()`, `migratePrompt()`-Zweige, online/offline-Listener.
**offline-queue-Funktionen:** `enqueue()`, `flush()` (Sortierung TABLE_ORDER, Parent-Resolution, Delete-Reihenfolge), `markDone()` (synced→delete, failed→retry_count++), `resolveServerId()`.
**Kategorie:** INTEGRATION offline (Fake-Supabase, In-Memory-IndexedDB, feste Uhr aus P0).

Testfälle → Erwartung (Auswahl, D-Anforderungen komplett):

| Fall | Erwartung |
|---|---|
| offline schreiben → online werden | enqueue `pending`; online-Event triggert flush; Eintrag `synced` und aus Store gelöscht |
| Queue-Reihenfolge | Session→Exercise→Set bei Upserts; Deletes invers; innerhalb: created-Reihenfolge |
| Parent unaufgelöst | `parent_unresolved`, bleibt in Queue, retry_count++ |
| Retry nach transientem Fehler | zweiter flush synct; retry_count korrekt |
| permanenter Fehler | bleibt `failed` mit last_error; kein Endlos-Crash |
| doppelter Flush (parallel/nacheinander) | keine Doppel-Upserts (Upsert-Idempotenz + markDone) — Parallel-Fall dokumentiert Grenzen (kein Lock!) |
| Logout während Sync / kein O.sb | flush bricht sauber ab `{flushed:0}` |
| Netzwerkabbruch mitten im flush | verbleibende Items `pending/failed`, nichts verloren |
| sync push-Fehler | setState('error'), lokale Daten unverändert |
| sync Debounce | mehrere schedulePush → genau EIN push |
| applySnapshot | setzt nur KEYS-Schlüssel; DB/PROFILE neu geladen |
| Konfliktfall (Cloud neuer als lokal, lokal nicht leer) | IST: lokal gewinnt via push — Charakterisierungstest, markiert als Phase-3-Entscheidungsinput |

**Risiken abgesichert:** verlorene Offline-Schreibvorgänge, FK-Kinder ohne Eltern, Snapshot überschreibt neuere Cloud-Daten unbemerkt.
**DoD:** alle D-Fälle kodiert; Grenzen (paralleler Flush ohne Lock, LWW) explizit als Findings dokumentiert statt schöngetestet.

---

## P6 · Paket 7: Service Worker und Cache-Updates

**Kategorien:** STATIC + Mock-UNIT + Browser-E2E (manuell/Chrome).

- STATIC (`sw_static_test.mjs`): Versionsformat `orvia-v8-N` genau 1×; ASSETS-Liste ⊆ real vorhandene Dateien (kein 404-Precaching); alle in index.html geladenen js/-Dateien in ASSETS; keine Duplikate; env.js NICHT in ASSETS (network-first-only).
- Mock-UNIT (`sw_behavior_test.mjs`): sw.js in Sandbox mit `self`/`caches`/`fetch`-Stubs laden. Fälle: install cached ASSETS fehlertolerant (ein 404 blockiert Update NICHT); activate löscht alle Caches ≠ C und claimt Clients; fetch: navigate → network-first mit Cache-Fallback; env.js → network-first; Asset → cache-first, Miss → fetch + put; non-GET ignoriert.
- Browser-E2E (manuelle Checkliste, iPhone + Chrome): Update v(alt)→v(neu): alte Seite offen, Deploy, Reload → neue Version aktiv, `[ORVIA SW]`-Log zeigt neue C, alter Cache weg; Offline-Modus: App lädt aus Cache, Sync-Badge „Offline"; gemischte Versionen ausgeschlossen (fail-closed Modul-Contract-Fehler sichtbar statt stiller Legacy-Pfad).

**Risiken abgesichert:** leerer Training-Tab durch Stale-Cache, blockiertes SW-Update durch umbenannte Datei, env.js-Staleness nach Deploy.
**DoD:** STATIC+Mock grün in CI-Lauf; E2E-Checkliste in DEPLOY_CHECKLISTE.md integriert.

---

## P7 · Paket 8: UI-Rendering Hauptnavigation + Profil-Editoren

**Kategorie:** DOM (Element-Registry/vm-Sandbox) + Browser-E2E-Checkliste (iPhone).
**Funktionen/Pfade:** Tab-Wechsel (tabbar → Render-Funktion je Tab), leerer Zustand je Tab, `openSheet()`/`_modal()`-Editoren: Öffnen → Feld ändern → Save → Overlay zu → Re-Open zeigt gespeicherten Wert; Escape/Backdrop-Verhalten; Sheet-Stack (Editor über Manager).

Testfälle: Tab-Wechsel rendert Ziel-Container und wirft keine Exception (alle Haupttabs); Editor-Roundtrip für Recovery, Preferences, Goals, Availability (Sheets) + Personal, Sports (Modals); doppelter Save-Klick → genau ein Save; Overlay-Reste nach Schließen = 0 (window[id] null, Stack leer); ARIA-Invarianten (role=dialog, aria-modal) für beide Overlay-Typen.
**Risiken abgesichert:** Regressionsnetz VOR der UX-Phase-5-Umbauten (Navigation, Overlay-Vereinheitlichung).
**DoD:** mind. 6 Editor-Roundtrips + Tab-Matrix grün; iPhone-Checkliste (Safe-Area, Sticky-Bar, Tastatur-Überlagerung) dokumentiert.

---

## Freigabepflichtige Abhängigkeiten (kein Testcode, sondern Produktionscode)

1. Edge Function: DI-Refactor `handleRegister(req, deps)` (P1) — klein, verhaltensneutral.
2. `js/clock.js` + inkrementelle Adoption in 3 Modulen (P0) — verhaltensneutral.
3. Idempotenz-Verhalten „bereits unbestätigter Nutzer" (P1) — Produktregel, Umsetzung in Phase 1.

Ohne 1+2 sind die betroffenen Pakete nur eingeschränkt (live-only bzw. flaky) testbar.
