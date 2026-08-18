-- ============================================================
-- 0036 · Access-Gate härten + drei Altlasten der pauschalen Supabase-Grants
-- ------------------------------------------------------------
-- BEFUND (Audit 17.08.2026, gegen die Produktionsinstanz gefahren).
--
-- 1) RECHTE-ESKALATION ÜBER `profiles`. Die Policy `own_rows` ist
--    `ALL` für {authenticated} mit qual/with_check `auth.uid() = user_id`.
--    Sie prüft, WESSEN Zeile geändert wird — nicht WELCHE SPALTE. Gleichzeitig
--    hat `authenticated` laut information_schema.column_privileges UPDATE auf
--    JEDER Spalte, auch auf `role` und `is_active`.
--    `orvia_user_role()` (schema.sql:370) liest `profiles.role`, `orvia_is_owner()`
--    ist `role = 'owner'`, und `owner_all` hängt mit `qual = orvia_is_owner()`
--    OHNE user_id-Bedingung an rund zwanzig Tabellen.
--    Daraus folgt: ein einziger Request eines beliebigen angemeldeten Nutzers
--      update profiles set role = 'owner' where user_id = auth.uid();
--    öffnet Lesen UND Schreiben auf den Daten ALLER Nutzer. Ebenso lässt sich
--    `is_active` selbst zurücksetzen — die Sperre eines Zugangs war wirkungslos.
--
-- 2) `schema_migrations` — die einzige Tabelle ohne RLS, mit Rechten für `anon`.
--    Der anon-Key steht öffentlich in env.js: ein unauthentifizierter Schreibpfad
--    in die Produktionsdatenbank. Inhaltlich harmlos, als Pfad nicht.
--
-- 3) `oauth_tokens` — RLS aktiv, 0 Policies, aber Rechte für anon/authenticated
--    noch vorhanden. Heute blockt RLS mangels Policy; die Tabelle ist damit EINE
--    Policy von einem Token-Leak entfernt. `provider_credentials` zeigt in 0019,
--    wie es richtig aussieht: Rechte entzogen, nicht nur Policy weggelassen.
--
-- WARUM RECHTE UND NICHT POLICY. Eine RLS-`with_check` kann den ALTEN Wert einer
-- Zeile nicht sehen. „role darf sich nicht ändern" ist als Policy nicht
-- ausdrückbar. Das richtige Werkzeug sind Tabellen-/Spaltenrechte.
--
-- WARUM DER ENTZUG NICHTS BRICHT. Profilzeilen legt ausschließlich
-- `orvia_complete_invite_registration()` an — security definer, `grant execute`
-- nur an `service_role`. Im gesamten Frontend gibt es genau EINE Fundstelle für
-- `from('profiles')`: den select in auth.js:330. Der Client schreibt diese
-- Tabelle nirgends.
--
-- BEWUSST NICHT GEÄNDERT: `owner_all`. Ein Konto mit role='owner' sieht weiterhin
-- die Daten aller Nutzer. Das ist für Support beabsichtigt — ab dem ersten
-- fremden Beta-Tester ist es aber eine personenbezogene Datenverarbeitung, die
-- in die Datenschutzerklärung gehört. Offener Punkt, kein technischer Fehler.
--
-- IDEMPOTENT. Mehrfaches Ausführen ist folgenlos.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) `profiles` in die Versionierung holen.
--    Die Tabelle trägt den Access-Gate, wurde aber von KEINER Migration angelegt
--    (nur in schema.sql). Sie fehlte deshalb in der Erwartungsliste des
--    Schema-Abgleichs — ihr Verlust wäre unbemerkt geblieben, und eine zweite
--    Instanz aus den Migrationen hätte jeden ausgesperrt.
--    Gegen die laufende Instanz ist dieser Block ein No-Op.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  email              text,
  role               text not null default 'tester',
  is_active          boolean not null default true,
  name               text,
  age                int,
  height_cm          int,
  weight_kg          numeric,
  location           text,
  training_style     text,
  coaching_intensity text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.oauth_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  scope         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.profiles      enable row level security;
alter table public.oauth_tokens  enable row level security;

-- ------------------------------------------------------------
-- 2) DER FIX · `profiles` ist für den Client nur noch lesbar.
--    Lesen bleibt auf die eigene Zeile begrenzt — dafür sorgt weiterhin die
--    Policy `own_rows`. Schreiben geht ausschließlich über service_role.
-- ------------------------------------------------------------
revoke all on public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.profiles from authenticated;
grant select on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3) `oauth_tokens` hart sperren — wie provider_credentials in 0019.
-- ------------------------------------------------------------
revoke all on public.oauth_tokens from anon, authenticated;

-- ------------------------------------------------------------
-- 4) `schema_migrations` unter RLS und ohne Client-Rechte.
--    Ohne Policy heißt das: für anon und authenticated unerreichbar,
--    für service_role und postgres unverändert nutzbar.
-- ------------------------------------------------------------
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;

-- ------------------------------------------------------------
-- 5) `anon` verliert Tabellenrechte in `public`.
--    VERHALTENSNEUTRAL PER KONSTRUKTION: Auf jeder Tabelle außer
--    `schema_migrations` ist RLS aktiv, und keine Policy nennt `anon` — anon
--    erhält dort heute schon null Zeilen. Der Entzug nimmt also nichts weg,
--    was funktioniert, sondern die Rechte, auf die sich eine künftige
--    unvorsichtige Policy stützen könnte.
--    Funktionsrechte sind NICHT betroffen: Login und Code-Einlösung laufen
--    über Auth bzw. security-definer-Funktionen, nicht über Tabellenzugriff.
-- ------------------------------------------------------------
revoke all on all tables in schema public from anon;

commit;
