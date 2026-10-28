-- ============================================================
-- 0053 · Restliche 12 SECURITY-DEFINER-Funktionen + 4 search_path-Warnungen
-- ------------------------------------------------------------
-- STATUS PRODUKTION: ANGEWENDET am 28.10.2026 im SQL-Editor (nach erfolgreichem
-- Registrierungstest gegen 0052). Vorab geprüft: 16 Funktionen, Eigentümer
-- postgres, Signaturen wie hier; keine Policy nutzt eine Hilfsfunktion für eine
-- andere Rolle als authenticated. Verifiziert (_verify-0053.sql): 16/16 ok,
-- keine SECURITY-DEFINER-Funktion in public mehr für anon ausführbar.
-- Offen danach: Login (Owner + Testkonto) und eine Registrierung erneut testen.
--
-- BEFUND (Live-Triage 28.10.2026, nur lesend; im Repo gegengeprüft)
-- Ursache wie 0052: `revoke … from public` entzieht in Supabase nicht die
-- direkten Default-Grants an anon/authenticated. Das Rechtemodell
-- (supabase/tests/_grant-model.mjs) reproduziert aus den Dateien exakt die 14
-- vom Linter gemeldeten Funktionen; nach 0052 bleiben diese 12.
--
-- GRUPPE A — 8 RLS-Hilfsfunktionen (security definer, search_path = public):
--   orvia_user_role(), orvia_is_owner()                       (schema.sql)
--   orvia_exercise_allowed(uuid), orvia_template_allowed(uuid),
--   orvia_own_plan(uuid), orvia_own_plan_day(uuid),
--   orvia_own_session(uuid), orvia_own_workout_exercise(uuid)  (0003)
--   Werden in RLS-Policies `TO authenticated` ausgewertet (owner_all an rund
--   20 Tabellen + Trainings-Policies) — Policies laufen im Kontext des
--   ANGEMELDETEN Nutzers. Daher: authenticated BEHÄLT EXECUTE, sonst sperrt sich
--   jeder Nutzer aus seinen eigenen Daten aus. Entzogen werden nur PUBLIC und anon.
--   anon hat seit 0036 keine Tabellenrechte; kein Client-Code ruft die
--   Funktionen per RPC auf (Test G).
--   orvia_is_owner() hatte bisher KEINEN expliziten Grant an authenticated
--   (nur implizit über den Supabase-Default) — hier ausdrücklich gesetzt.
--
-- GRUPPE B — 4 Trigger-Funktionen (security definer, search_path = public):
--   dc_force_owner() (0019), rc_force_owner() (0002),
--   orvia_ledger_mark_dirty() (0051), seed_default_feature_flags() (0046, auth.users)
--   Als RPC sinnlos (returns trigger). PostgreSQL prüft EXECUTE auf
--   Trigger-Funktionen nur bei CREATE TRIGGER, nicht beim Auslösen — der
--   Entzug für PUBLIC/anon/authenticated ändert am Trigger-Verhalten nichts.
--   Belegt gegen echtes Postgres: rls_helper_trigger_0053_db_test.mjs.
--
-- GRUPPE C — 4 Funktionen ohne festen search_path (Linter 0011), security invoker:
--   touch_updated_at(), touch_user_feature_flags(), orvia_protect_planned_anchor(),
--   orvia_activities_link_normalize()
--   Rümpfe (Repo) nutzen nur NEW/OLD, now(), jsonb-Operatoren, raise —
--   keine Objekte aus public. `public` statt '' trotzdem: gleiche Konvention
--   wie die übrigen Funktionen, und tolerant gegenüber einem Live-Rumpf, der
--   vom Repo abweicht. Rechte bleiben unverändert (Trigger, kein RPC-Risiko).
--
-- IDEMPOTENZ: nur revoke/grant/alter function … set search_path, eine
-- Selbstprüfung (Rollback bei Abweichung) und der schema_migrations-Eintrag
-- mit on conflict do nothing. Mehrfaches Ausführen ergibt denselben Zustand.
-- Wie bei 0052: `supabase db push` NICHT verwenden (CLI-Historie leer).
--
-- ROLLBACK (manuell, öffnet die Lücke wieder):
--   grant execute on function <Gruppe A + B> to anon;
--   grant execute on function <Gruppe B> to authenticated;
--   alter function <Gruppe C> reset search_path;
--
-- Tests: privileged_fn_grants_0053_test.mjs (offline, Rechtemodell + Gegenproben),
--        rls_helper_trigger_0053_db_test.mjs (Wegwerf-Postgres),
--        access_gate_grants_test.mjs D2/D3 (nachgeschärft).
-- ============================================================

begin;

-- ---- A · RLS-Hilfsfunktionen: anon raus, authenticated bleibt ----
revoke execute on function
  public.orvia_user_role(),
  public.orvia_is_owner(),
  public.orvia_exercise_allowed(uuid),
  public.orvia_template_allowed(uuid),
  public.orvia_own_plan(uuid),
  public.orvia_own_plan_day(uuid),
  public.orvia_own_session(uuid),
  public.orvia_own_workout_exercise(uuid)
  from public, anon;

grant execute on function
  public.orvia_user_role(),
  public.orvia_is_owner(),
  public.orvia_exercise_allowed(uuid),
  public.orvia_template_allowed(uuid),
  public.orvia_own_plan(uuid),
  public.orvia_own_plan_day(uuid),
  public.orvia_own_session(uuid),
  public.orvia_own_workout_exercise(uuid)
  to authenticated, service_role;

-- ---- B · Trigger-Funktionen: kein Client-Recht ----
revoke execute on function
  public.dc_force_owner(),
  public.rc_force_owner(),
  public.orvia_ledger_mark_dirty(),
  public.seed_default_feature_flags()
  from public, anon, authenticated;

-- ---- C · fester search_path ----
alter function public.touch_updated_at() set search_path = public;
alter function public.touch_user_feature_flags() set search_path = public;
alter function public.orvia_protect_planned_anchor() set search_path = public;
alter function public.orvia_activities_link_normalize() set search_path = public;

-- ---- Selbstprüfung: Endzustand erzwingen, sonst Rollback ----
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.orvia_user_role()', 'public.orvia_is_owner()',
    'public.orvia_exercise_allowed(uuid)', 'public.orvia_template_allowed(uuid)',
    'public.orvia_own_plan(uuid)', 'public.orvia_own_plan_day(uuid)',
    'public.orvia_own_session(uuid)', 'public.orvia_own_workout_exercise(uuid)'
  ] loop
    if has_function_privilege('anon', fn, 'EXECUTE') then
      raise exception '0053: anon darf % weiterhin ausfuehren', fn;
    end if;
    if not has_function_privilege('authenticated', fn, 'EXECUTE') then
      raise exception '0053: authenticated hat EXECUTE auf % verloren (RLS wuerde brechen)', fn;
    end if;
  end loop;

  foreach fn in array array[
    'public.dc_force_owner()', 'public.rc_force_owner()',
    'public.orvia_ledger_mark_dirty()', 'public.seed_default_feature_flags()'
  ] loop
    if has_function_privilege('anon', fn, 'EXECUTE') or has_function_privilege('authenticated', fn, 'EXECUTE') then
      raise exception '0053: Client-Rolle darf Trigger-Funktion % weiterhin ausfuehren', fn;
    end if;
  end loop;

  foreach fn in array array[
    'touch_updated_at', 'touch_user_feature_flags',
    'orvia_protect_planned_anchor', 'orvia_activities_link_normalize'
  ] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = fn
         and 'search_path=public' = any(coalesce(p.proconfig, '{}'))
    ) then
      raise exception '0053: search_path fuer % nicht gesetzt', fn;
    end if;
  end loop;
end $$;

insert into public.schema_migrations(version) values ('0053_rls_helper_trigger_fn_haerten')
  on conflict (version) do nothing;

commit;
