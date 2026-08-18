-- ============================================================
-- ORVIA · RLS- und Zugriffs-Audit der PRODUKTIONSINSTANZ
-- ------------------------------------------------------------
-- NUR LESEZUGRIFFE. Kein create, alter, drop, insert, update, delete, grant.
-- Ausfuehren im Supabase-SQL-Editor, Block fuer Block, Ergebnis jeweils kopieren.
--
-- ANLASS. Die Tabelle `profiles` traegt den Access-Gate der App
-- (auth.js loadAccessProfile: role/is_active entscheiden ueber den Zutritt),
-- wird aber von KEINER Migration angelegt. Sie existiert nur in dieser Instanz.
-- Ihre RLS-Policy existiert nirgends im Repo. Ziel dieses Audits: den Ist-Zustand
-- so genau erfassen, dass eine Migration ihn abbilden kann, OHNE ihn zu aendern.
--
-- Zusaetzlich beantwortet Block E4 eine Frage, die in ORVIA nie gestellt wurde:
-- Gibt es Tabellen OHNE RLS, auf die `anon` Rechte hat? Der anon-Key steht in
-- env.js und ist oeffentlich — eine solche Tabelle waere fuer jeden im Netz lesbar.
-- ============================================================


-- ============================================================
-- E1 · profiles — existiert sie, und wie sieht sie aus?
-- Erwartung: user_id, email, role, is_active, name (aus auth.js).
-- Leeres Ergebnis = die Tabelle fehlt. Dann sofort melden, nicht weiterlaufen.
-- ============================================================
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
 order by ordinal_position;


-- ============================================================
-- E2 · profiles — RLS-Status und JEDE Policy im Wortlaut
-- `qual` ist die Lesebedingung, `with_check` die Schreibbedingung.
-- Genau diese beiden Ausdruecke muessen spaeter in die Migration.
-- ============================================================
select c.relrowsecurity  as rls_aktiv,
       c.relforcerowsecurity as rls_erzwungen_auch_fuer_eigentuemer
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'profiles';

select policyname, cmd, permissive, roles, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles'
 order by policyname;


-- ============================================================
-- E3 · profiles — wer hat ueberhaupt Tabellenrechte?
-- RLS wirkt NUR, wenn Rechte vergeben sind. Ohne grant ist die Tabelle
-- unerreichbar, mit grant entscheidet die Policy.
-- ============================================================
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'profiles'
 order by grantee, privilege_type;


-- ============================================================
-- E4 · GESAMTBILD aller Tabellen in public — der eigentliche Sicherheitscheck
-- ------------------------------------------------------------
-- Lies die Spalte `befund` von oben nach unten. Alles, was mit 1 oder 2
-- beginnt, ist ein Fund. 3 ist erklaerungsbeduerftig. 4 und 5 sind in Ordnung.
--
-- Zur Einordnung: `provider_credentials` MUSS als „4" erscheinen — RLS an,
-- keine Policy, Rechte entzogen (Migration 0019, service_role-only). Erscheint
-- sie anders, ist etwas an der Instanz von Hand veraendert worden.
-- ============================================================
with t as (
  select c.oid, c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
), z as (
  select t.oid, t.relname, t.relrowsecurity,
         (select count(*) from pg_policies p
           where p.schemaname = 'public' and p.tablename = t.relname) as policies,
         has_table_privilege('anon',          t.oid, 'select') as anon_select,
         has_table_privilege('anon',          t.oid, 'insert') as anon_insert,
         has_table_privilege('authenticated', t.oid, 'select') as auth_select,
         has_table_privilege('authenticated', t.oid, 'update') as auth_update
    from t
)
select relname as tabelle,
       relrowsecurity as rls,
       policies,
       anon_select, anon_insert, auth_select, auth_update,
       case
         when not relrowsecurity and anon_select
           then '1 KRITISCH — ohne RLS und fuer anon lesbar (anon-Key ist oeffentlich)'
         when not relrowsecurity and (auth_select or auth_update)
           then '2 HOCH — ohne RLS fuer JEDEN angemeldeten Nutzer, auch fremde Zeilen'
         when relrowsecurity and policies = 0 and (anon_select or auth_select)
           then '3 PRUEFEN — RLS an, keine Policy, aber Rechte vergeben: liefert immer 0 Zeilen'
         when relrowsecurity and policies = 0
           then '4 ok — hart gesperrt, nur service_role (wie provider_credentials)'
         when not relrowsecurity
           then '4 ok — ohne RLS, aber auch ohne Client-Rechte'
         else '5 ok — RLS aktiv mit Policy'
       end as befund
  from z
 order by befund, tabelle;


-- ============================================================
-- E5 · Policies aller Tabellen im Wortlaut (fuer die spaetere Migration)
-- Umfangreich. Erst ausfuehren, wenn E4 zeigt, welche Tabellen betroffen sind —
-- dann die Zeile `and tablename in (...)` einkommentieren und einschraenken.
-- ============================================================
select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
 -- and tablename in ('profiles')
 order by tablename, policyname;
