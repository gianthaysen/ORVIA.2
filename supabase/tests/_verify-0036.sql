select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema='public' and table_name='profiles'
   and grantee in ('anon','authenticated')
 order by grantee, privilege_type;

select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema='public' and table_name in ('oauth_tokens','schema_migrations')
   and grantee in ('anon','authenticated')
 order by grantee, privilege_type;

select count(*) as tabellen_mit_anon_rechten
  from information_schema.role_table_grants
 where table_schema='public' and grantee='anon';

with t as (select c.oid, c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')
select relname as tabelle, relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=t.relname) as policies,
       has_table_privilege('anon', t.oid, 'select') as anon_select,
       has_table_privilege('authenticated', t.oid, 'update') as auth_update
  from t
 where not relrowsecurity
    or has_table_privilege('anon', t.oid, 'select')
 order by relname;
