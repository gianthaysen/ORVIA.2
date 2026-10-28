-- ============================================================
-- ORVIA · Verifikation Migration 0052 — NUR LESEND, im SQL-Editor ausführen.
-- Ändert nichts. Erwartung: anon = false, authenticated = false, service_role = true
-- für beide Funktionen; Spalte ok = true in allen 6 Zeilen.
-- ============================================================
select f.fn, r.rolle,
       has_function_privilege(r.rolle, f.fn, 'EXECUTE') as darf_ausfuehren,
       has_function_privilege(r.rolle, f.fn, 'EXECUTE') = (r.rolle = 'service_role') as ok
  from (values ('public.prune_engine_decision_log(integer)'),
               ('public.orvia_complete_invite_registration(uuid, uuid, text)')) f(fn)
 cross join (values ('anon'), ('authenticated'), ('service_role')) r(rolle)
 order by f.fn, r.rolle;

-- Ist 0052 in schema_migrations eingetragen? (Nach der manuellen Ausführung vom
-- 28.10.2026 vermutlich NEIN — das ist erwartbar und kein Fehler der Rechte.)
select exists (select 1 from public.schema_migrations
                where version = '0052_privileged_fn_execute_haerten') as eingetragen;
