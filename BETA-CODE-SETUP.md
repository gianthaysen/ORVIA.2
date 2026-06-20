# ORVIA · Globaler Beta-Code (Setup & Deploy)

Umstieg von „persönlicher Invite pro E-Mail" auf **einen allgemeinen Beta-Code**
mit Nutzungslimit + E-Mail-Bestätigung. Schritt für Schritt:

---

## 1) Datenbank aktualisieren (SQL Editor)

Die Tabelle `invite_codes` hat `max_uses`/`used_count` bereits. Es muss nur die
**RPC neu eingespielt** werden (sie erlaubt jetzt globale Codes ohne `assigned_email`
und zählt `used_count` gegen `max_uses`).

Am einfachsten den **kompletten Inhalt von `app/supabase/schema.sql`** erneut ausführen
(alles ist idempotent — `create … if not exists`, `add column if not exists`,
`create or replace function`). Es geht **nichts kaputt**, dein Owner-Profil bleibt.

> Wer nur die RPC neu will: den Block `create or replace function
> public.orvia_complete_invite_registration(...)` aus `schema.sql` kopieren und ausführen.

---

## 2) Edge Function neu deployen

```bash
cd /Users/gianthaysen/Claude/Projects/Strava/app
supabase functions deploy register-with-invite --no-verify-jwt
```

Die Function prüft den Code jetzt **global** (per `code_hash`, ohne E-Mail-Bindung),
checkt `status='active'`, `expires_at`, `used_count < max_uses`, erstellt den Auth-User
und ruft die RPC (Profil + `used_count++`).

**E-Mail-Bestätigung:** oben in `index.ts` steht `const REQUIRE_EMAIL_CONFIRM = true;`
→ der User muss seine E-Mail bestätigen, bevor er rein darf.
Für **Sofort-Zugang ohne Bestätigung** auf `false` setzen und neu deployen.

---

## 3) E-Mail-Bestätigung in Supabase aktivieren

- *Authentication → Providers → Email → **Confirm email = AN***
- E-Mail-Versand muss funktionieren: Supabase-Standardversand reicht für kleine Beta
  (geringe Rate-Limits) — für mehr Volumen eigenen SMTP unter
  *Authentication → Emails / SMTP* hinterlegen.
- **Public Signups bleiben AUS** (Registrierung läuft nur über die Edge Function).

---

## 4) Globalen Beta-Code anlegen (SQL Editor)

`assigned_email` **weglassen** (= NULL = global). Code ist case-sensitiv (nur getrimmt),
exakt so weitergeben, wie gehasht (Empfehlung GROSSBUCHSTABEN).

```sql
insert into public.invite_codes (code_hash, label, role, status, max_uses, used_count, expires_at)
values (
  encode(extensions.digest('ORVIA-BETA-2026','sha256'),'hex'),
  'Globaler Beta-Code',
  'tester',
  'active',
  50,                          -- bis zu 50 Registrierungen
  0,
  now() + interval '90 days'   -- oder null = kein Ablauf
);
```

> Wirft `extensions.digest(...)` einen Fehler → `digest('ORVIA-BETA-2026','sha256')` ohne `extensions.`

Allen Testern gibst du **denselben Code** `ORVIA-BETA-2026` — keine E-Mail mehr vorab eintragen.

Limit/Status prüfen:
```sql
select label, role, status, used_count, max_uses, expires_at
from public.invite_codes where assigned_email is null;
```

Limit später erhöhen:
```sql
update public.invite_codes set max_uses = 100
where code_hash = encode(extensions.digest('ORVIA-BETA-2026','sha256'),'hex');
```

---

## 5) Frontend deployen

`env.js`, `index.html`, `js/auth.js`, `sw.js` committen + pushen (GitHub Pages).
Danach App vom Homescreen schließen + neu öffnen (Service Worker zieht v8-48).

Die Registrierungsseite zeigt jetzt **„Beta-Code"** (statt Invite-Code) und den Hinweis
„Geschlossene Beta. Registrierung nur mit gültigem Beta-Code und bestätigter E-Mail möglich."

---

## 6) Test-Checkliste

| Test | Erwartung |
|---|---|
| Registrieren mit gültigem Beta-Code + neuer E-Mail + Passwort ≥8 | „Bitte bestätige deine E-Mail …" + Bestätigungsmail |
| E-Mail-Link bestätigen, dann Login | App offen, Profil `tester`/`is_active=true` |
| Falscher Code | „Beta-Code ungültig." |
| Abgelaufener Code | „Beta-Code abgelaufen." |
| Code öfter als `max_uses` benutzt | „Beta-Code wurde zu oft verwendet." |
| Passwörter ungleich / <8 Zeichen | passende Meldung |
| Ohne Login App öffnen | gesperrt (Login/Register) |
| Owner (Gian) | kommt weiterhin rein (alter persönlicher Invite funktioniert) |

DB-Gegenprobe nach Registrierung:
```sql
select email, role, is_active from public.profiles order by created_at desc limit 5;
select label, used_count, max_uses from public.invite_codes where assigned_email is null;
```

---

## Was sich geändert hat (Dateien)

- `supabase/schema.sql` — RPC `orvia_complete_invite_registration`: `assigned_email` optional,
  Limit über `used_count < max_uses` statt Single-Use.
- `supabase/functions/register-with-invite/index.ts` — globaler Code-Lookup,
  Payload `betaCode`, `REQUIRE_EMAIL_CONFIRM`, Limit-Prüfung.
- `js/auth.js` — „Beta-Code", Payload `betaCode`, E-Mail-Bestätigungs-Flow (`resend`),
  neue Fehlermeldungen, präzisere Blocked-/Login-Texte.
- `sw.js` — Cache `orvia-v8-48`.

**Sicherheit:** Service-Role-Key bleibt nur in der Edge Function. Im Frontend nur URL + anon key.
Der Auth-Guard (fail-closed) bleibt aktiv — ohne gültige Session + aktives Profil kein Zugriff.
