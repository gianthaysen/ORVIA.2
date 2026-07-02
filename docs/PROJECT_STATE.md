# ORVIA · PROJECT_STATE

Status-Dokument: verifizierter Repository-Stand. Kein Roadmap-Ersatz, keine Spezifikation.
Stand: 2026-07-02 (vollständiger Repo-Audit + Auth-Fix + Profil-Modal-Paket).
Quelle der Wahrheit bleibt der Code; dieses Dokument beschreibt, was geprüft wurde.
Kennzeichnung: [V] = direkt im Code verifiziert · [A] = Audit-Befund 2026-07-02 (stichprobengeprüft).

---

## 1. Architektur (IMPLEMENTED)

- Vanilla-JS-PWA unter `app/`, kein Build-Schritt, Deployment über GitHub Pages. [V]
- Service Worker `sw.js`, Cache-Version aktuell `orvia-v8-173` (diese Session, vorher -172). Navigation + `env.js` network-first, Assets cache-first, fehlertolerantes Pre-Caching. [V]
- Supabase: Auth, Edge Function `supabase/functions/register-with-invite`, `schema.sql`, 9 Migrationen (`0002`–`0010`), RLS auf Kern-Tabellen. [V]
- Tests: 70 Node-Suiten unter `supabase/tests/*.mjs`, direkt via `node <datei>` (keine npm-Scripts; `package.json` enthält nur `@supabase/supabase-js`). [V]
- Kein `.git` im eingebundenen Arbeitsordner — Git-Historie in dieser Umgebung nicht verfügbar. [V]

## 2. Profilmodell & Persistenz (PARTIALLY IMPLEMENTED)

- `ORVIA.profile` ist NICHT die alleinige kanonische Quelle. Real: Hybrid.
  - localStorage-Blob `orvia_profile_v1` = lokaler Cache für ALLE Profilfelder (~50). [A]
  - Supabase `user_profiles` = autoritativ nur für die ~13 gemappten Identitäts-/Körperfelder (`profile-store.js` hydrate/persist über `profileRepository`). [A]
  - Ziele, Sportarten, Constraints, Equipment, Preferences: nur im Blob, KEINE Tabellen-Synchronisation → Zweitgerät/Reinstallation sieht sie nicht. [A]
- Aktiv verdrahtete Repos: `profileRepository` (hydrate/persist), `checkinRepository`, `trainingLoadRepository`, `goalRepository` (nur `migrate-blob.js`). Die übrigen 7 Repos (`availability`, `sport`, `readiness`, `exercise`, `workout`, `trainingPlan`, `activity`) sind vorbereitet, aber produktiv nicht angebunden. [A]
- `ensureProfile()` (profile.js:24–28) fällt bei fehlendem/korruptem Blob STILL auf `PROFILE_DEFAULTS` zurück (70 kg / 175 cm / „fortgeschritten"); anschließende Hydration stellt nur die 13 gemappten Felder wieder her. Default-Overwrite-Risiko. [V]
- `migrate-blob.js`: idempotente Blob→Tabellen-Migration, läuft in `onAuthed()` vor Hydration. [V]
- Zentrale Speicherung der Editoren: `_profileSave(changedSections)` (profile.js) → `saveProfile()` → localStorage + optionaler Cloud-Hook `window.ORVIA_onSave()`. [A]

## 3. Auth (IMPLEMENTED — Live-Verifikation AUSSTEHEND)

- Live-Incident (Registrierung legt User an, Client zeigt Fehler) — Root Cause verifiziert und in dieser Session behoben:
  Edge Function lieferte `{ok,userId,role,needsConfirmation}` (Direkt-Bestätigung, `email_confirm:true`),
  Client verlangt fail-closed `{flowVersion:2, status:'confirmation_required'}` (auth-logic.js) → jede erfolgreiche Registrierung wurde client-seitig abgelehnt. [V]
- Fix (Produktentscheidung Gian, 2026-07-02: ECHTE E-Mail-Bestätigung):
  - Edge Function legt User UNBESTÄTIGT an (`email_confirm:false`), versendet Bestätigung über GoTrue `/resend` (type `signup`), liefert Vertrag §8: `{ok:true, flowVersion:2, status:'confirmation_required', email, emailSent}`.
  - `emailSent` ist nur true bei bestätigtem Versand; Client zeigt bei `emailSent:false` einen ehrlichen Hinweis + Resend-Pfad.
  - Client sendet zweckgebundene `redirectTo`-URL (`?auth_action=signup`); Allowlist erzwingt GoTrue.
- Session-Handling, PKCE-Flows (recovery/signup/email_change), Fail-closed-Gate, XSS-Escaping: implementiert und DOM-getestet. [V]
- Offen: Account-Löschung ist Stub (`orviaDeleteAccount`), E-Mail-Änderung fehlt. [V]
- RLS: `user_profiles`, `daily_checkins`, `readiness_*`, `training_load_daily`, `user_goals`, `user_sports`, `weekly_availability`, `fixed_schedule_items`, `orvia_migrations` mit Owner-Policies (Migration 0002). `invite_codes`/`invite_redemptions` server-only. ACHTUNG: ältere Tabelle `profiles` (schema.sql, von `loadAccessProfile()` gelesen) ohne dokumentierte RLS-Policy → live prüfen. [A]

## 4. Entscheidungs-Engine (IMPLEMENTED)

- `buildTrainingDecision()` (calc.js:896 ff.) ist die einzige aktive Entscheidungsquelle; genau EINE produktive Aufrufstelle: `getDecision()` (ui.js:519, gecacht, Invalidierung je Check-in). [A, Aufrufstellen V]
- Safety-Gates zentral (`safetyCheck`): fever/chestPain/shortnessOfBreath/dizziness/neurologicalSymptoms/accidentPain/swelling/instability/Schmerz≥8 → RED + Score-Cap ≤35; Krankheit allein → Cap ≤55. Übersteuert optimistische Wearable-Werte. Testabgedeckt. [A]
- Wochenplan-Anpassungen: `adaptWeekPlan` (pure, calc.js) → `applyWeekAdjustments`/`revertWeekAdjustments` (ui.js) mit Undo-Snapshot `PROFILE._planUndo` + Protokoll `PROFILE.planAdjustments[]`; Persistenz lokal, Cloud best-effort. [A]
- `adaptToday` = deprecated Wrapper ohne eigene Logik, keine produktiven Aufrufer (toter Code). `ampel()` nur noch Fallback/Historie. [A]
- Decision-Engine-v2-Proposal (Repo-Root über `app/`): zu ~90 % umgesetzt; Cap-Lookup-Tabelle und explizites `resolveDecision()` fehlen (funktional äquivalent inline). [A]
- Lücken: `PROFILE.trainingDays` wird von der Plan-Anpassung nicht konsumiert; Ziele fließen nur als Progress-Subscore ein, treiben den Plan nicht. [A]

## 5. Onboarding v2 (PARTIALLY IMPLEMENTED)

- Schrittfolge: welcome → profile → sports → goals_placeholder → schedule_placeholder → review_placeholder; zentrale Steuerung, Draft-Persistenz, fail-closed Modulverträge. [V]
- Profil-Editoren öffnen über `ORVIA.openProfileEditor()` das Onboarding v2 (edit:true). [A]
- Befund: Abschluss-Flow hat eine Async-Race (Blob-Save vor `profileStore.persist()`-Abschluss). [A — vor Fix verifizieren]

## 6. Profil-UI (PARTIALLY IMPLEMENTED — Paket 2026-07 begonnen)

- Zwei Overlay-Systeme in profile.js: `openSheet()` (produktreifer Standard: ein Scroll-Owner, Header/Footer außerhalb, Safe-Area, Sheet-Stack, role=dialog) und `_modal()` (zentrierte Kurzdialoge). [V]
- Editor-Verteilung: 7 Editoren auf Sheets (Goals, SportProfile, Availability, Recovery, Preferences, Performance, Body), 7 auf zentrierten Modals (Personal, Sports-Auswahl, Constraints, Devices, Equipment, Locations, Gear). [A]
- Diese Session umgesetzt (Details: KNOWN_ISSUES → behoben):
  - `_modal()`: role=dialog, aria-modal, initialer Fokus, Fokus-Restore, Escape schließt oberstes Overlay (Modal vor Sheet). [V]
  - CSS: verschachtelte Scrollbereiche entfernt (`.orvia-modal-bg` scrollt nicht mehr; Scroll-Owner ist `.orvia-modal`), `.gm-modal-actions` mit explizitem Bottom-Padding + Safe-Area. [V]
- Offen: ui.js/activity.js bauen eigene ad-hoc `.orvia-modal-bg`-Dialoge (Duplikat-Pattern); `gm-chip`-Toggles ohne ARIA; Editor-Migration Modal→Sheet aussteht. [V/A]

## 7. Reifegrad-Einordnung

**Frühe Alpha.** Begründung: umfangreiche, getestete Domänenlogik (65 Offline-Suiten grün), aber (a) Auth-E2E bis zu dieser Session live defekt und weiterhin live unverifiziert, (b) Mehrheit der Profilbereiche ohne Cloud-Persistenz (Single-Device), (c) keine Account-Löschung/kein Export, (d) Rechtstexte/Datenschutz-Grundlagen für Beta fehlen, (e) RLS-Zwei-Konten-Test nur mit Live-Credentials möglich (nicht ausgeführt).

## 8. Aktuelle Prioritäten (abgestimmt mit CLAUDE.md §25)

1. Auth-Fix deployen + LIVE verifizieren (Checkliste unten). Erst danach Roadmap fortsetzen.
2. Profil-Persistenz-Asymmetrie schließen (Ziele/Sport/Constraints → Tabellen oder bewusst dokumentiert lokal) + `ensureProfile`-Default-Fallback absichern (Recovery-Hinweis statt stiller Defaults).
3. Profil-UI vereinheitlichen: verbleibende Modal-Editoren auf `openSheet()` migrieren (Reihenfolge: Equipment/Locations → Constraints → Sports → Personal), ARIA für Chips.
4. Onboarding-Abschluss-Race + Altersgrenzen-Off-by-One (KNOWN_ISSUES #5/#6) beheben.
5. Live-Datenfundament: RLS-/Zwei-Konten-Tests, `profiles`-Tabelle klären.

## 9. Live-Checkliste Auth-Fix (manuell, vor „behoben"-Status)

1. Edge Function `register-with-invite` deployen (`supabase functions deploy register-with-invite`) — umfasst `index.ts` UND `handler.mjs` (P1-DI-Refactor 2026-07-02; Logik offline getestet: `register_with_invite_test.mjs` 29/29 inkl. Idempotenz/Resume).
2. Supabase Auth-Konfiguration prüfen: E-Mail-Versand (Standard-Mailer-Limits oder eigenes SMTP), Template „Confirm signup" mit `{{ .ConfirmationURL }}`, Site URL + Additional Redirect URLs enthalten `https://gianthaysen.github.io/ORVIA.2/?auth_action=signup`.
3. Verifizieren, dass GoTrue `/resend` (type signup) bei deaktivierten Public Signups E-Mails versendet (im Repo nicht prüfbar). Falls nicht: Alternativen dokumentiert in Session-Bericht (Signups aktivieren + Access-Gate, oder generateLink + eigener Mailer).
4. Alt-Testnutzer aus dem Incident im Dashboard prüfen/entfernen, dann echte E2E-Registrierung: Beta-Code → „E-Mail bestätigen"-Screen → Link in Mail → App öffnet (PKCE signup) → Login.
5. Fehlversuch prüfen: unbestätigter Login → verständliche Meldung; „Bestätigung erneut senden" funktioniert.
6. App-Deploy: `js/auth.js`, `js/profile.js`, `js/clock.js` (NEU, P0), `js/data.js`, `js/workout-store.js`, `js/profile-store.js`, `index.html`, `styles.css`, `sw.js` (v8-174) ATOMAR zusammen ausliefern; deployte Antworten (HTTP 200, Inhalte, SW-Version im Console-Log) verifizieren.
