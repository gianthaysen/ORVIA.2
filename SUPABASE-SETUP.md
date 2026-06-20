# ORVIA · Closed-Beta Auth mit Supabase

Ziel: Nur eingeladene Beta-Tester können sich registrieren. Login und Sessions laufen über Supabase Auth, Registrierung über die Edge Function `register-with-invite`.

## 1. Datenbank-Schema ausführen

Im Supabase Dashboard:

1. SQL Editor öffnen.
2. Den kompletten Inhalt von `app/supabase/schema.sql` ausführen.

Das legt unter anderem an:

- `invite_codes` mit `assigned_email`, `used`, `used_by_user_id`, `used_at`, `role`
- `profiles` mit `role` und `is_active`
- RLS: Nutzer sehen eigene Daten, Owner darf später verwalten
- RPC `orvia_complete_invite_registration`, nur für `service_role`

## 2. Public Signups deaktivieren

Im Supabase Dashboard unter Authentication die öffentliche Registrierung deaktivieren, falls verfügbar:

- Authentication → Settings / Providers → Email
- Public/User Signups deaktivieren

Wichtig: Die App registriert Nutzer über die Edge Function mit Service Role. Dadurch funktionieren Invite-Registrierungen weiterhin, beliebige direkte Supabase-Signups aber nicht.

## 3. Edge Function deployen

Mit Supabase CLI im Projekt ausführen:

```bash
supabase functions deploy register-with-invite --project-ref DEIN_PROJECT_REF
```

Falls die Service-Role-Umgebung nicht automatisch gesetzt ist:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=DEIN_SERVICE_ROLE_KEY --project-ref DEIN_PROJECT_REF
```

Der `SUPABASE_SERVICE_ROLE_KEY` darf niemals ins Frontend.

## 4. Invite-Codes anlegen

Empfohlen: Invite-Code nur als SHA-256-Hash speichern.

```sql
insert into public.invite_codes (
  assigned_email,
  code_hash,
  label,
  role,
  expires_at
) values (
  lower('tester@example.com'),
  encode(digest('ORVIA-TESTER-001', 'sha256'), 'hex'),
  'Beta Tester 001',
  'tester',
  now() + interval '30 days'
);
```

Owner-Invite für Gian:

```sql
insert into public.invite_codes (
  assigned_email,
  code_hash,
  label,
  role
) values (
  lower('gianthaysen76@gmail.com'),
  encode(digest('ORVIA-OWNER-GIAN', 'sha256'), 'hex'),
  'Gian Owner',
  'owner'
);
```

Den Klartext-Code gibst du nur der jeweiligen Person. Ein Invite kann genau einmal verwendet werden.

## 5. Frontend-Environment setzen

`app/env.example.js` nach `app/env.js` kopieren und die öffentlichen Werte eintragen:

```js
window.ORVIA_ENV = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_your_anon_public_key',
  ORVIA_ENABLE_DEMO_DATA: false
};
```

Nur `anon public` verwenden. Kein Service-Role-Key im Frontend.

## 6. Erwartetes Verhalten

- Registrierung benötigt E-Mail, Invite-Code, Passwort und Passwort-Bestätigung.
- Die Edge Function prüft `assigned_email`, Invite-Code, `used = false` und `expires_at`.
- Nach Erfolg werden Auth-User, `profiles`-Eintrag und Invite-Verbrauch gesetzt.
- Login funktioniert danach mit E-Mail und Passwort.
- App-Zugriff wird verweigert, wenn kein Profil existiert oder `is_active = false`.
- Datenzugriff läuft über RLS mit `auth.uid()` / `user_id`.

## 7. Testfälle

- Falsche E-Mail + richtiger Code → Registrierung abgelehnt.
- Richtige E-Mail + falscher Code → Registrierung abgelehnt.
- Richtige E-Mail + richtiger Code → Account + Profil entstehen.
- Derselbe Invite ein zweites Mal → abgelehnt.
- Login mit dem neuen Account → App öffnet.
- Auth-User ohne Profil → App bleibt gesperrt.
