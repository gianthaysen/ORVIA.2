-- ============================================================
-- 0052 · EXECUTE-Rechte zweier SECURITY-DEFINER-Funktionen entziehen
-- ------------------------------------------------------------
-- STATUS PRODUKTION: BEREITS ANGEWENDET am 28.10.2026, manuell im
-- Supabase-SQL-Editor (Gian). Diese Datei DOKUMENTIERT die Änderung und hält
-- eine frisch aus den Migrationen aufgebaute Instanz deckungsgleich.
-- In Produktion NICHT erneut ausführen nötig — wer es trotzdem tut, ändert
-- nichts (siehe IDEMPOTENZ), außer dass die Version in schema_migrations
-- eingetragen wird.
--
-- BEFUND (Supabase-Linter 0028 + Code-Triage, 28.10.2026)
-- 1) prune_engine_decision_log(integer) — 0032, security definer, KEINE
--    Auth-/Owner-Prüfung, DELETE über ALLE Nutzer nach Alter. Für `anon`
--    ausführbar: wer den öffentlichen anon-Key hat (env.js), konnte mit
--    keep_days = 0 das gesamte engine_decision_log löschen.
--    Aufrufer im Repo: KEINER (weder app/js noch Edge Functions noch pg_cron).
-- 2) orvia_complete_invite_registration(uuid, uuid, text) — schema.sql,
--    security definer, prüft den Invite, aber NICHT, ob p_user_id der
--    aufrufende Nutzer ist; schreibt profiles inkl. role. Für `anon` und
--    `authenticated` ausführbar.
--    Einziger legitimer Aufrufer: Edge Function register-with-invite
--    (handler.mjs, admin.rpc) mit SUPABASE_SERVICE_ROLE_KEY (index.ts).
--
-- URSACHE (systematisch). Die Migrationen entziehen Rechte bisher mit
--   revoke all on function … from public;
-- Supabase vergibt EXECUTE auf neue Funktionen in `public` aber per
-- Default Privileges DIREKT an anon, authenticated und service_role — nicht
-- über PUBLIC. `from public` lässt diese direkten Grants stehen. Deshalb hier
-- ausdrücklich `from public, anon, authenticated`.
-- Dieselbe Lücke betrifft weitere Funktionen (0003, 0007, 0008, 0010, 0049,
-- schema.sql:393/394). Die sind BEWUSST NICHT Teil dieser Migration: dort ruft
-- der Client bzw. RLS die Funktionen legitim als `authenticated` auf — Triage
-- pro Funktion folgt separat.
--
-- IDEMPOTENZ / DOPPELTE ANWENDUNG
-- - REVOKE eines nicht (mehr) vorhandenen Rechts und GRANT eines bereits
--   vorhandenen Rechts sind in PostgreSQL No-Ops. Mehrfaches Ausführen ergibt
--   denselben Endzustand.
-- - Keine create/drop/DML auf Fachdaten. Einziger Schreibvorgang:
--   schema_migrations-Eintrag mit on conflict do nothing.
-- - Schlägt die Selbstprüfung am Ende fehl, rollt die gesamte Transaktion
--   zurück (fail closed).
-- - HINWEIS: schema_migrations ist laut gen-live-check.mjs keine verlässliche
--   Wahrheitsquelle (viele Migrationen tragen sich nicht ein), und die
--   Supabase-CLI-Historie (supabase_migrations) ist leer. Ein `supabase db push`
--   würde deshalb die GESAMTE Kette 0002–0052 erneut anwenden wollen — das ist
--   ein Risiko der ganzen Kette, nicht dieser Datei. Migrationen werden in
--   diesem Projekt manuell im SQL-Editor angewendet.
--
-- ROLLBACK (manuell, NICHT empfohlen — öffnet die Lücke wieder):
--   grant execute on function public.prune_engine_decision_log(integer) to anon, authenticated;
--   grant execute on function public.orvia_complete_invite_registration(uuid, uuid, text) to anon, authenticated;
--
-- Tests: supabase/tests/privileged_fn_grants_0052_test.mjs (offline),
--        supabase/tests/privileged_fn_grants_0052_live_test.mjs (live, ENV),
--        supabase/tests/register_invite_service_role_test.mjs (Registrierung).
-- ============================================================

begin;

revoke execute on function public.prune_engine_decision_log(integer)
  from public, anon, authenticated;

revoke execute on function public.orvia_complete_invite_registration(uuid, uuid, text)
  from public, anon, authenticated;

-- service_role behält die Rechte (in Produktion bereits vorhanden; hier
-- ausdrücklich, damit eine frische Instanz denselben Endzustand hat).
grant execute on function public.prune_engine_decision_log(integer) to service_role;
grant execute on function public.orvia_complete_invite_registration(uuid, uuid, text) to service_role;

-- ---- Selbstprüfung: Endzustand erzwingen, sonst Rollback ----
do $$
declare
  fn text;
  r  text;
begin
  foreach fn in array array[
    'public.prune_engine_decision_log(integer)',
    'public.orvia_complete_invite_registration(uuid, uuid, text)'
  ] loop
    foreach r in array array['anon', 'authenticated'] loop
      if has_function_privilege(r, fn, 'EXECUTE') then
        raise exception '0052: Rolle % darf % weiterhin ausfuehren', r, fn;
      end if;
    end loop;
    if not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception '0052: service_role hat EXECUTE auf % verloren', fn;
    end if;
  end loop;
end $$;

insert into public.schema_migrations(version) values ('0052_privileged_fn_execute_haerten')
  on conflict (version) do nothing;

commit;
