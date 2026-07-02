# ORVIA · KNOWN_ISSUES

Verifizierte, offene Probleme mit Priorität. Stand: 2026-07-02.
Behobene Punkte wandern in den Abschnitt „Behoben" (mit Session-Datum), nicht löschen — Regressionskontext.
Kennzeichnung: [V] = direkt verifiziert · [A] = Audit-Befund 2026-07-02 (vor Fix im Code verifizieren).

## Offen

| # | Prio | Bereich | Problem | Ort |
|---|------|---------|---------|-----|
| 1 | HOCH | Persistenz | Ziele, Sportarten, Constraints, Equipment, Preferences werden NUR im localStorage-Blob gespeichert, nie in Supabase-Tabellen. Gerätewechsel/Browser-Reset = Datenverlust. Tabellen + Repos existieren, sind aber nicht verdrahtet. [A] | js/profile.js (`_profileSave`), js/repos/* (unverdrahtet) |
| 2 | HOCH | Persistenz | `ensureProfile()` ersetzt fehlenden/korrupten Blob STILL durch `PROFILE_DEFAULTS` (70 kg/175 cm/„fortgeschritten"); Hydration stellt nur ~13 Felder wieder her. Defaults können als echte Nutzerdaten erscheinen. [V] | js/profile.js:24–28 |
| 3 | HOCH | Backend | Tabelle `profiles` (Access-Gate: `loadAccessProfile()` liest role/is_active) hat in schema.sql keine dokumentierte RLS-Policy — live prüfen, ggf. Policy ergänzen oder Tabelle konsolidieren. [A] | supabase/schema.sql; js/auth.js:191 ff. |
| 4 | HOCH | Auth (live) | Auth-Fix + P1-Idempotenz (Resume unbestätigter Nutzer, Orphan-Heilung, Parallel-Requests; offline 29/29 getestet) sind LIVE UNVERIFIZIERT (Deploy + SMTP/Redirect-Konfiguration + E2E ausstehend). Checkliste: PROJECT_STATE §9. Unbestätigt bleibt: GoTrue `/resend` versendet bei deaktivierten Public Signups. [V] | supabase/functions/register-with-invite (index.ts + handler.mjs) |
| 5 | MITTEL | Onboarding | Abschluss-Flow: Async-Race — Blob wird gespeichert, bevor `profileStore.persist()` abgeschlossen ist. [A] | js/onboarding/onboarding-ui.js |
| 6 | MITTEL | Domänenlogik | Altersgrenzen-Off-by-One: `onboarding_profile_logic_test` schlägt in 2 Randfällen fehl („12 Jahre 364 Tage → Fehler", „Geburtstag morgen → ein Jahr weniger"). Vorbestehend, betrifft die 13-Jahre-Validierung. Test schlägt VOR einem Fix fehl → als Regressionstest nutzen. [V] | js/onboarding/onboarding-profile-logic.js (`calculateAge`/`validateProfile`); Test Zeilen 62–69 |
| 7 | MITTEL | UI | ui.js und activity.js bauen eigene ad-hoc `.orvia-modal-bg`-Dialoge am gemeinsamen `_modal()`/`openSheet()` vorbei (ohne role=dialog/Fokus/Escape). Duplikat-Pattern. [V] | js/ui.js:391,848,1568,1608,1903; js/activity.js:112,131,357,373 |
| 8 | MITTEL | UI | 7 Profil-Editoren noch auf zentrierten Modals statt Sheets (Personal, Sports-Auswahl, Constraints, Devices, Equipment, Locations, Gear). Migrationsreihenfolge: Equipment/Locations → Constraints → Sports → Personal. [A] | js/profile.js |
| 9 | MITTEL | Engine | Wochenplan-Anpassungen synchronisieren nur best-effort in die Cloud (optionaler `ORVIA_onSave`-Hook, keine Offline-Queue für weekPlan). [A] | js/ui.js:444–495 |
| 10 | MITTEL | Auth | Account-Löschung ist Stub (Alert), E-Mail-Änderung fehlt. Vor Beta-Launch nötig (Datenschutz). [V] | js/auth.js (`orviaDeleteAccount`) |
| 11 | NIEDRIG | A11y | `gm-chip`-/Toggle-Controls ohne ARIA (`aria-pressed`/`role`), uneinheitliche Form-Controls. [A] | js/profile.js (`gmToggle`), styles.css |
| 12 | NIEDRIG | Toter Code | `adaptToday()` (deprecated Wrapper, keine Aufrufer), `ampel()` nur noch Legacy-Fallback; Modal-Referenzen als window-Globals. [A] | js/ui.js:338–348; js/calc.js:350–376 |
| 13 | NIEDRIG | Engine | `PROFILE.trainingDays` wird von `adaptWeekPlan` nicht konsumiert (nur Anzeige); Ziele treiben den Plan nicht (nur Progress-Subscore). Bewusst dokumentieren oder anbinden. [A] | js/calc.js:656–720 |

## Behoben

| Datum | Bereich | Problem | Fix |
|-------|---------|---------|-----|
| 2026-07-02 | Auth (KRITISCH) | Registrierungs-Vertrags-Mismatch: Edge Function lieferte `{ok,userId,role,needsConfirmation}`, Client verlangt fail-closed `{flowVersion:2,status:'confirmation_required'}` → jede erfolgreiche Registrierung endete im Fehler „serverseitig nicht korrekt bestätigt" (Live-Incident: User angelegt, keine Bestätigung, kein Login). | Edge Function auf echten Bestätigungsfluss umgestellt (`email_confirm:false` + GoTrue-Resend + Vertrag §8 inkl. ehrlichem `emailSent`-Flag); Client sendet `redirectTo` und zeigt Versandfehler ehrlich. Regressionstests: auth_logic 30/30, auth_dom 31/31 (u. a. exakter Alt-Payload → abgelehnt). LIVE-VERIFIKATION AUSSTEHEND (Issue #4). |
| 2026-07-02 | Profil-UI | Verschachtelte Scrollbereiche (`.orvia-modal-bg` UND `.orvia-modal` mit overflow-y); `.gm-modal-actions` ohne explizites Bottom-Padding (env()=0 ohne Notch); `_modal()` ohne role=dialog/Fokus/Escape. | Ein Scroll-Owner pro Modal (Backdrop scrollt nicht mehr); Action-Bar `calc(10px + env(safe-area-inset-bottom))` + solider Gradient-Sockel; `_modal()` mit Dialog-Semantik, Fokus-Management, Escape (Modal vor Sheet, fremde Dialoge unberührt). Test: profile_modal_infra 17/17. |
