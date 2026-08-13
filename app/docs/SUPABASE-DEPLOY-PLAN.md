# ORVIA · Supabase-Deploy-Plan (geschlossene Beta)

Schritt für Schritt abarbeiten — von oben nach unten. Alle Werte sind an Codex' Code angepasst
(Tabellen `invite_codes`/`profiles`, RPC `orvia_complete_invite_registration`, Edge Function
`register-with-invite`).

**Vorab gebraucht:**
- Supabase-Projekt (Project Ref, z. B. `qzfaawmsurfzxmtysbbu`)
- **anon public key** (Frontend) und **service_role key** (nur Server) — in Supabase unter
  *Project Settings → API → API Keys*
- Supabase CLI installiert (`npm i -g supabase` oder Homebrew)

---

## 0) Exakte Reihenfolge (Überblick)

1. `schema.sql` im SQL Editor ausführen
2. In Supabase Auth **offene Registrierung deaktivieren**
3. Edge Function `register-with-invite` per CLI deployen
4. Secrets prüfen (werden i. d. R. automatisch bereitgestellt)
5. **Owner-Invite (Gian)** anlegen → in der App registrieren
6. **Tester-Invites** anlegen
7. `env.js` mit URL + anon key erstellen und auf GitHub Pages legen
8. Frontend-Dateien committen/pushen (Live-Deploy)
9. Test-Checkliste durchgehen

---

## 1) SQL im Supabase SQL Editor ausführen

Öffne *SQL Editor → New query*, füge den **kompletten Inhalt von `app/supabase/schema.sql`**
ein und klicke **Run**. Das legt alle Tabellen an, erweitert `invite_codes`/`profiles`,
aktiviert RLS, entfernt die alten RPCs und erstellt die neue RPC
`orvia_complete_invite_registration`.

Danach kurz prüfen (eigene Query):

```sql
-- Tabellen + Spalten vorhanden?
select column_name from information_schema.columns
where table_schema='public' and table_name='invite_codes'
order by column_name;

select column_name from information_schema.columns
where table_schema='public' and table_name='profiles'
order by column_name;

-- Neue RPC vorhanden, alte weg?
select proname from pg_proc
where proname in ('orvia_complete_invite_registration','orvia_check_invite','orvia_redeem_invite');
-- Erwartet: nur orvia_complete_invite_registration
```

---

## 2) Offene Registrierung in Supabase Auth deaktivieren

So kann sich **niemand** mehr per anon key selbst registrieren — nur die Edge Function
(Service Role, Admin-API) darf Nutzer anlegen.

- *Authentication → Sign In / Providers → Email* (bzw. *Authentication → Settings*)
- **„Allow new users to sign up" / „Enable Signups" → AUS**
- E-Mail-Bestätigung ist egal: die Function legt User mit `email_confirm: true` an (sofort aktiv).

> Wichtig: Das Deaktivieren blockiert nur den öffentlichen `signUp` über den anon key.
> Die Edge Function nutzt die Admin-API und funktioniert weiterhin.

---

## 3) Edge Function deployen (Supabase CLI)

Im Projektordner `app/` (dort liegt `supabase/functions/register-with-invite/index.ts`):

```bash
supabase login
supabase link --project-ref DEIN_PROJECT_REF
supabase functions deploy register-with-invite --no-verify-jwt
```

- `--no-verify-jwt` ist **nötig**, weil sich **nicht eingeloggte** Nutzer registrieren
  (es gibt noch keine Session). Die Sicherheit liegt komplett in der Function selbst
  (Invite + E-Mail + Code prüfen).

---

## 4) Secrets

Die Function liest `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY`.
**Beide werden von Supabase automatisch in jede Edge Function injiziert** — du musst sie
in der Regel **nicht** manuell setzen.

- `SUPABASE_*`-Secrets sind **reserviert** und können **nicht** per
  `supabase secrets set` überschrieben werden (Befehl schlägt fehl). Das ist gewollt.
- Prüfen, was gesetzt ist:

```bash
supabase secrets list
```

Wenn `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` dort (oder als Default) vorhanden sind:
nichts weiter tun. Falls die Function später meldet „Missing SUPABASE_URL or
SUPABASE_SERVICE_ROLE_KEY", erst dann anlegen — aber **nur** mit einem **nicht**
`SUPABASE_`-präfixierten Namen wäre nötig; bei korrektem Supabase-Projekt sind sie da.

---

## 5) Owner (Gian) anlegen

**Empfohlener Weg — Owner-Invite + Registrierung über die App** (sauber, gleiche Pipeline):

```sql
insert into public.invite_codes (assigned_email, code_hash, label, role, expires_at)
values (
  lower('gianthaysen76@gmail.com'),
  encode(extensions.digest('ORVIA-OWNER-GIAN-2026','sha256'),'hex'),
  'Owner Gian',
  'owner',
  null            -- kein Ablauf
);
```

Dann in der App mit **E-Mail = gianthaysen76@gmail.com**, **Code = `ORVIA-OWNER-GIAN-2026`**
und einem Passwort registrieren → die Function legt deinen Auth-User an und die RPC erstellt
dein `profiles` mit `role = 'owner'`, `is_active = true`.

**Falls `extensions.digest(...)` einen Fehler wirft**, nimm `digest(...)` ohne `extensions.`:
```sql
encode(digest('ORVIA-OWNER-GIAN-2026','sha256'),'hex')
```

**Fallback — du hast bereits einen Auth-User** (aus dem alten System):
```sql
-- user_id holen:
select id, email from auth.users where email = lower('gianthaysen76@gmail.com');

-- Profil als Owner setzen (USER_ID einsetzen):
insert into public.profiles (user_id, email, role, is_active)
values ('USER_ID_HIER', lower('gianthaysen76@gmail.com'), 'owner', true)
on conflict (user_id) do update
  set role='owner', is_active=true, email=excluded.email;
```

---

## 6) Tester-Invite anlegen

Pro Tester **eine E-Mail + ein Code**. Code ist **case-sensitiv** (wird nur getrimmt),
also exakt so weitergeben, wie gehasht. Empfehlung: GROSSBUCHSTABEN, keine Leerzeichen.

```sql
insert into public.invite_codes (assigned_email, code_hash, label, role, expires_at)
values (
  lower('tester1@example.com'),
  encode(extensions.digest('ORVIA-BETA-7K9X','sha256'),'hex'),
  'Beta Tester 001',
  'tester',
  now() + interval '30 days'   -- oder null = kein Ablauf
);
```

Dem Tester gibst du: **seine E-Mail** + **Code `ORVIA-BETA-7K9X`**.
Mehrere Tester = mehrere INSERTs (jeweils eigene E-Mail + eigener Code).

Status prüfen:
```sql
select assigned_email, label, role, used, used_at, status, expires_at
from public.invite_codes order by created_at desc;
```

---

## 7) `env.js` für GitHub Pages / Website

`app/index.html` lädt **`env.js` vor `js/config.js`**. Diese Datei musst du erstellen
(es gibt nur `env.example.js` als Vorlage) und **mit ins Repo / auf Pages** legen.

Datei: **`app/env.js`** (gleiche Ebene wie `index.html`):

```js
window.ORVIA_ENV = {
  SUPABASE_URL: 'https://DEIN_PROJECT_REF.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_DEIN_ANON_PUBLIC_KEY',
  ORVIA_ENABLE_DEMO_DATA: false
};
```

- Hier kommt **nur** die Supabase-URL und der **anon public key** rein — beide sind
  öffentlich unbedenklich (RLS schützt die Daten).
- `ORVIA_ENABLE_DEMO_DATA: false` → kein Strava-Demo-Import für Beta-Nutzer.
- Diese Datei **darf** committet werden. Der **service_role key gehört NIEMALS hier rein.**

---

## 8) Frontend live deployen

Die geänderten Dateien sind nur lokal. Auf GitHub pushen, damit Pages aktualisiert:

```bash
cd /Users/gianthaysen/Claude/Projects/Strava/app
git add -A
git commit -m "Beta: Invite-only Auth, env.js, Edge Function, Demo-Daten optional"
git push
```

Danach 1–2 Min warten (Pages-Build) und die App im Browser **hart neu laden**
(bzw. vom Homescreen schließen + neu öffnen, damit der Service Worker die neue Version zieht).

---

## 9) Test-Checkliste

Nacheinander durchgehen — erwartetes Ergebnis dahinter:

| Test | Eingabe | Erwartung |
|---|---|---|
| Falsche E-Mail + richtiger Code | `falsch@x.de` + `ORVIA-BETA-7K9X` | Abgelehnt: „E-Mail oder Invite-Code ist ungültig." |
| Richtige E-Mail + falscher Code | `tester1@example.com` + `FALSCH` | Abgelehnt: „E-Mail oder Invite-Code ist ungültig." |
| Richtige E-Mail + richtiger Code | `tester1@example.com` + `ORVIA-BETA-7K9X` + Passwort ≥8 | Registrierung OK, Auto-Login, App offen |
| Code zweites Mal verwenden | gleiche Daten erneut | Abgelehnt: „Dieser Invite-Code wurde bereits verwendet." |
| Login danach | E-Mail + Passwort | Login OK, App offen |
| Passwort zu kurz | gültig + Passwort <8 | „Das Passwort muss mindestens 8 Zeichen lang sein." |
| Abgelaufener Code | Invite mit `expires_at` in Vergangenheit | „Dieser Invite-Code ist abgelaufen." |
| Auth-User ohne Profil | (Sonderfall) | App bleibt gesperrt, da Profil/`is_active` fehlt |

Datenbank-Gegenprobe nach erfolgreicher Registrierung:
```sql
select assigned_email, used, used_at, used_by_user_id, role from public.invite_codes
where assigned_email = lower('tester1@example.com');     -- used = true

select user_id, email, role, is_active from public.profiles
where email = lower('tester1@example.com');              -- is_active = true, role = tester
```

„**Auth-User ohne Profil**" gezielt testen (Edge-Case): User direkt anlegen, ohne RPC →
App muss gesperrt bleiben. Aufräumen danach:
```sql
-- Nur zum Testen/Aufräumen: verwaisten Auth-User finden
select u.id, u.email from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;
```

---

## 10) Sicherheits-Hinweise (wichtig)

- **Der `service_role` key darf NIEMALS ins Frontend** — nicht in `env.js`, nicht in
  `config.js`, nicht in irgendeine Datei, die im Browser landet. Er lebt **ausschließlich**
  serverseitig in der Edge Function (von Supabase automatisch bereitgestellt).
- Im Frontend liegt nur der **anon public key** — der ist für RLS gedacht und öffentlich ok.
- RLS muss aktiv sein (durch `schema.sql` erledigt): jeder Nutzer sieht/bearbeitet nur seine
  eigenen `user_id`-Daten; Owner-Policies sind vorbereitet.
- Codes nur als **Hash** speichern (`code_hash`), den Klartext nur an die zugewiesene Person geben.

---

### Kurz-Referenz (Datenmodell, von Codex)

- `invite_codes`: `id, code_hash, code?, assigned_email, label, status(active|disabled), role(owner|tester), used, used_by_user_id, used_at, expires_at, created_at`
- `profiles`: `user_id(PK→auth.users), email, role(owner|tester), is_active, name, age, height_cm, weight_kg, …`
- RPC (nur `service_role`): `orvia_complete_invite_registration(p_invite_id uuid, p_user_id uuid, p_email text)`
- Edge Function `register-with-invite` Payload: `{ email, inviteCode, password }`
