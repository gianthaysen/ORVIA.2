# ORVIA · Batch 2 — Auth-Audit + Implementierungsstand
**Teil 1 (§1–7): HISTORISCHER AUDIT — Vorher-Zustand, NICHT der aktuelle Stand.**
> ⚠️ §1–7 beschreiben den Code **vor** der Implementierung. Aussagen wie „Redirect URLs im Code nicht gesetzt" (§2) sind inzwischen überholt: Reset und Resend setzen jetzt **zweckgebundene** Redirect-URLs (`?auth_action=…`, s. §9/§10). Für den aktuellen Stand gilt ausschließlich §9 + §10.

**Teil 2:** §8 Hybrid-Serververtrag · §9 Implementierungsstand · **§10 Flow-Strategie (PKCE)**.

---

## 1. Auth-Dateien & Datenfluss
- `js/config.js` — liest `SUPABASE_URL`/`SUPABASE_ANON_KEY` aus `window.ORVIA_ENV` (Runtime, Datei `env.js`). Validiert URL-Muster + Key-Länge → `ORVIA_CFG.configured`. **Fail-closed**: ohne Konfig kein App-Zugriff.
- `js/auth.js` — gesamte Auth-Logik (IIFE):
  - Client: `createClient(URL, ANON, {auth:{persistSession:true, autoRefreshToken:true}})`.
  - Session-Restore: `sb.auth.getSession()` beim Start → `onAuthed()`.
  - `onAuthStateChange`: behandelt `SIGNED_IN | TOKEN_REFRESHED | USER_UPDATED | SIGNED_OUT`.
  - Zugangsprüfung: Tabelle `profiles` (user_id, role ∈ owner/tester, is_active=true) → sonst `safeSignOut`.
  - Gate-UI (`buildGate`): Tabs Anmelden/Registrieren, Felder Beta-Code/E-Mail/Passwort/Passwort-bestätigen, „Passwort vergessen?".
- `js/sync.js`, `js/profile-store.js` u. a. hängen an `O.user`/`O.sb` (Folgeauthentifizierung).

## 2. Supabase-Konfiguration (aus Projektdateien)
- **Site URL: nicht aus Projektdateien ermittelbar.** Kommt zur Laufzeit aus `env.js` (nicht eingesehen, enthält Keys). → **manuelle Dashboard-Prüfung nötig.**
- **Redirect URLs: im Code NICHT gesetzt.** Weder `signInWithPassword`, `resetPasswordForEmail` noch Registrierung übergeben `redirectTo`/`emailRedirectTo`. ⇒ Alle Weiterleitungen hängen allein an der **Supabase-Dashboard-Konfiguration (Site URL + Additional Redirect URLs)**. → **manuelle Dashboard-Prüfung nötig.**

## 3. Tatsächliche Callback-/Reset-Route der App
- **Es gibt KEINE.** Kein Handler für den Recovery-Deep-Link (`type=recovery` / `access_token` im URL-Hash), kein `PASSWORD_RECOVERY`-Event in `onAuthStateChange`, keine Route zum Setzen eines neuen Passworts.
- `index.html` ist Single-Page ohne Auth-Callback-Pfad. Rückkehr aus einer E-Mail würde nur die App neu laden, ohne den Recovery-/Confirm-Token zu verarbeiten.

## 4. Flow-für-Flow (Ist-Stand)
| Flow | Ist-Zustand |
|---|---|
| **Registrierung** | **Invite-only (Closed Beta).** Edge Function `register-with-invite` legt den User **serverseitig bereits bestätigt** an (Kommentar auth.js:285). Danach direkter Login möglich. |
| **E-Mail-Bestätigung** | **Nicht vorhanden** im Produkt-Flow — User wird server-confirmed angelegt; keine Magiclink-/Confirm-UI, kein Status-Polling. |
| **Erneut senden** | **Nicht vorhanden** (kein Bestätigungsschritt → kein Resend). |
| **Passwort-Reset** | `resetPasswordForEmail(email)` **ohne `redirectTo`**; **kein In-App-Schritt** zum neuen Passwort. Faktisch unvollständig: Link führt zur Dashboard-Default-URL, App verarbeitet ihn nicht. |
| **Session-Wiederherstellung** | Funktioniert via `getSession()` + `persistSession` + `autoRefreshToken`. |
| **Logout** | `orviaLogout`: `signOut` + lokaler Cleanup + `location.reload()`. OK. |
| **Account löschen** | **Nur Alert/Stub** (auth.js:374) — „über separate Edge Function", nicht implementiert. |
| **E-Mail-Wechsel** | **Nicht vorhanden.** |

## 5. Bekannte Lücken (gegenüber Spec §2)
1. **Produktfork:** Spec §2.1 beschreibt öffentliche Registrierung mit **E-Mail-Bestätigung** (ohne Beta-Code). Ist-Stand ist **Closed-Beta-Invite, server-confirmed**. → Entscheidung nötig (s. u.).
2. Kein Recovery-/Confirm-Deep-Link-Handling in der App (Passwort-Reset endet nirgends).
3. `resetPasswordForEmail` ohne `redirectTo` → keine kontrollierte Rückkehr in die (installierte) PWA.
4. Keine Live-Passwortanforderungs-Anzeige (Spec §2.2: 8+ Zeichen, Groß/Klein, Zahl, anzeigen/verbergen) — aktuell nur Mindestlänge 8 nach Absenden.
5. Account-Löschen nicht umgesetzt.
6. E-Mail-Wechsel nicht umgesetzt.
7. Onboarding-Trigger hängt an `localStorage 'orvia_onboard_pending'` — kein serverseitiger Onboarding-Status (kommt erst mit Migration 0009).

## 6. Notwendige manuelle Supabase-Dashboard-Prüfungen (nicht aus Code ermittelbar)
- Authentication → URL Configuration: **Site URL** und **Additional Redirect URLs** (müssen Browser-URL, GitHub-Pages-URL und den PWA-Rückkehrpfad abdecken).
- Authentication → Providers → Email: **Confirm email** an/aus? (entscheidet, ob Bestätigung überhaupt greift).
- Auth → Email Templates: Confirm/Reset-Template + enthaltene Redirect-Variablen.
- Edge Function `register-with-invite`: bestätigt der Code wirklich serverseitig (email_confirm)?
- Link-TTL (Ablauf) und Single-Use-Verhalten für Confirm/Reset.
- Verhalten **abgelaufener** und **mehrfach genutzter** Links (nur live testbar).

## 7. Status (Kategorien)
- **implementiert:** Login (Passwort), Session-Restore, Logout, Invite-Registrierung (Edge Function), Zugangs-Gate.
- **automatisiert getestet:** —
- **lokal manuell geprüft:** — (dieser Audit ist statische Code-Analyse, kein Laufzeittest).
- **Live-DB geprüft:** —
- **iPhone geprüft:** —
- **offen:** E-Mail-Bestätigungs-Flow, Resend, Passwort-Reset-Abschluss (Deep-Link-Route), Account-Löschen, E-Mail-Wechsel, Redirect-URL-Konfiguration, Live-Tests aller Links, PWA-Rückkehr iOS/Desktop.

> Gesamtbewertung: **Vorhandener Auth-Code, vollständiger Account-Flow nicht verifiziert.**

---

## 8. Hybrid-Serververtrag (Edge Function `register-with-invite`)
**Entscheidung: Hybrid** (Invite-Gate + echte E-Mail-Bestätigung). Der Client (§9) verlangt fail-closed einen **versionierten** Vertrag. Die Edge Function MUSS serverseitig:
1. Invite-Code validieren (gültig, nicht abgelaufen, Limit nicht erreicht).
2. Registrierungsmodus serverseitig prüfen (kein Vertrauen auf Client-Flags).
3. **Unbestätigten** Auth-User erzeugen (KEIN `email_confirm:true`).
4. Bestätigungs-E-Mail mit **erlaubter Redirect-URL** auslösen.
5. Profil-/Tester-Zugang (`profiles`) konsistent anlegen.
6. Bei Teilfehlern **keine verwaisten halb angelegten Nutzer** hinterlassen (transaktional/Cleanup).
7. Explizit zurückgeben:
```json
{ "ok": true, "flowVersion": 2, "status": "confirmation_required", "email": "..." }
```
8. **Keine** Service-Role-Daten an den Client geben.

**Definierte Fehlerfälle (serverseitig, neutrale Client-Meldung):**
| Fall | Verhalten |
|---|---|
| E-Mail bereits registriert | neutral „falls möglich, Bestätigung gesendet" — keine Existenz-Offenlegung |
| Invite abgelaufen | `invite_expired` |
| Invite-Limit erreicht | `invite_used` |
| E-Mail-Versand fehlgeschlagen | Fehler + KEIN bestätigter User; Retry möglich |
| Auth-User erstellt, Profilanlage fehlgeschlagen | Rollback/Cleanup, kein verwaister User |
| identische Anfrage wiederholt | idempotent (kein Doppel-User, erneute Mail erlaubt) |

**Dashboard-Voraussetzungen (manuell, durch Betreiber):** Confirm email = ON · Site URL + Additional Redirect URLs (Browser-URL + GitHub-Pages-URL + PWA-Rückkehrpfad) · Email-Templates mit Redirect-Variablen · Link-TTL/Single-Use.

## 9. Implementierungsstand (Client) — Statusaussagen
**Geänderte Dateien:** `js/auth-logic.js` (neu, rein/testbar), `js/auth.js`, `js/auth-logic.js` in `index.html` + `sw.js` registriert.

- **implementiert (Client):** fail-closed Registrierungsvertrag (`acceptRegistration`, nur `flowVersion:2 + confirmation_required`); Bestätigungs-Screen (E-Mail per `textContent`, „erneut senden" mit zentraler Redirect-URL, „Ich habe bestätigt" → Session-Prüfung/neutral, „Adresse korrigieren"); Recovery-Screen (`PASSWORD_RECOVERY` + URL-Flow-Erkennung VOR App-Freigabe, `onAuthed`-Guard); zentrale `authRedirectUrl()` für Reset/Resend; `cleanAuthUrl()` nach Recovery; Live-Passwortregeln + Anzeigen/Verbergen.
- **`auth-logic.js` unit-getestet:** `auth_logic_test` 27/27 (Passwortregeln; Flow-Erkennung pkce_recovery/pkce_signup/pkce_email_change/pkce_unknown/implicit_recovery/implicit_signup/error/normal; Vertrag fail-closed; `stripAuthParams` entfernt Auth-Parameter inkl. `auth_action`, erhält `?tab=…`).
- **`auth.js` Controller mit stabilem DOM-/Supabase-Stub getestet:** `auth_dom_test` 21/21 (stabile Element-Registry). Geprüft u. a.: fail-closed Gate sichtbar/Submit deaktiviert; **PKCE recovery → Austausch 1×, KEINE App, kein Profil-Load, Recovery-Formular freigeschaltet, auth_action bereinigt**; PKCE signup → App-Zugang; `?code` ohne/falsche `auth_action` → kein App-Zugang + kein Austausch; PKCE-Fehler → neutrale Login-Meldung + URL bereinigt; Implicit-Recovery weiter funktionsfähig (vor Event deaktiviert, frühes Absenden ohne `updateUser`, Event aktiviert); XSS-E-Mail escaped; normaler Login öffnet App. Stub-DOM, **kein** jsdom/Browser.

## 10. Flow-Strategie (verbindlich): PKCE
**Produktiv = PKCE.** Supabase-Client mit `flowType:'pkce'`, `detectSessionInUrl:true`. Alle E-Mail-Aktionen liefern `?code` plus eine **zweckgebundene** `?auth_action`:
- Passwort-Reset: `resetPasswordForEmail(email, { redirectTo: authRedirectUrl('recovery') })`
- Signup-Resend: `resend({ type:'signup', …, options:{ emailRedirectTo: authRedirectUrl('signup') } })`
- später E-Mail-Wechsel: `authRedirectUrl('email_change')`

**Zweckerkennung & Routing nach Code-Austausch:**
- `pkce_recovery` → `authFlow='recovery'` **vor** Austausch gesetzt; nach Erfolg → „Neues Passwort"-Screen, **nie** `onAuthed()`.
- `pkce_signup` / `pkce_email_change` → nach Erfolg → `onAuthed()` (App).
- `pkce_unknown` (`?code` ohne gültige `auth_action`) → **kein** automatischer App-Zugang, **kein** Austausch, neutrale Login-Meldung.
- `error` → neutrale Login-Meldung, keine App.
- `auth_action` wird via `cleanAuthUrl` erst **nach** vollständiger Verarbeitung entfernt; fachliche Parameter (`tab/date/view`) bleiben.

**Implicit Flow = Kompatibilitäts-Fallback** (`type=recovery`/`type=signup` im Hash): bleibt behandelt (Recovery-Formular erst bei gültiger Recovery-Session aktiv; Signup separat), ist aber **nicht** der produktive Pfad.

**Verhalten bei PKCE-Link in einem anderen Browser/Gerät:** Der PKCE-Code-Verifier liegt im Browser-Speicher des **anfordernden** Browsers. Wird der Link in einem anderen Browser/Gerät geöffnet, kann `exchangeCodeForSession` fehlschlagen → der Client zeigt neutral „Link ungültig oder abgelaufen". **Muss im Live-Test geprüft werden.**

**Aktueller Stand (Redirect-URLs im Code):** Reset und Resend setzen jetzt zweckgebundene Redirect-URLs (überschreibt §2-Vorher-Aussage). Vollständiger Live-Flow (Dashboard + Edge Function + iPhone) weiterhin offen.
- **Supabase-Live-Flow ungeprüft · Dashboard ungeprüft · Edge Function ungeprüft · iPhone ungeprüft.**
- **offen (Server/Live):** Edge-Function-Umstellung (§8), Dashboard-Konfiguration, alle Live-Linktests (Confirm/Reset, abgelaufen/mehrfach), PWA-Rückkehr iOS/Desktop.
- **offen (Code):** Account-Löschen (Stub, braucht Edge Function), E-Mail-Wechsel.
- **Confirm-Button-UI** (`#cfDone`) ist nur per Code-Review/Signup-Pfad abgedeckt, nicht als eigener UI-Test.

### §7-Korrekturen (eingebaut)
- `detectAuthFlow` erkennt **und** der Startablauf behandelt jetzt explizit: `recovery`, `signup_confirmation`, `error`, `normal` (eigene Branches).
- `cleanAuthUrl` nutzt `auth-logic.stripAuthParams`: entfernt nur bekannte Auth-Parameter aus Query+Hash; **fachliche App-Parameter (`tab/date/view…`) bleiben erhalten** (vorher fälschlich alles gelöscht).
- „Ich habe bestätigt" prüft **nur die lokale Session**; ohne Session → kontrollierter Wechsel zum Login mit vorausgefüllter E-Mail + neutraler Meldung. Kein Anspruch auf Remote-Statusprüfung.
- Fehlende/unvollständige `auth-logic.js` → **fail-closed** (App gesperrt, Login deaktiviert, kein Session/Sync/Onboarding), kein stilles `'normal'`.
- `renderAccountCard` gibt die E-Mail escaped aus (kein unescaped `innerHTML`).
- Vollständige Bestätigung und Recovery bleiben bis zum **Live-Linktest** offen.

**Persistenz-Abgrenzung Batch 2:** Onboarding-Draft nur **lokal** (Fortsetzung nach Reload auf demselben Gerät). Server-/geräteübergreifendes Autosave bleibt bis Migration 0009 offen — **keine** Behauptung, dass Fortsetzung auf einem anderen Gerät funktioniert.
