-- ============================================================
-- 0046 · absence_replanner als Standard — Stufe D (14.09.2026)
-- ------------------------------------------------------------
-- WOFUER. Befund Produktionskonto 13.09.: aktive Knie-Beschwerde 9/10 im Profil,
-- Tageszustand RED — und der Wochenplan zeigte weiter Intervalle und Long Run.
-- Die Logik dafuer existiert seit B-09 (engine/absence-replanner: Verletzung
-- ⇒ Laufen raus, Beinkraft raus; jetzt @4 mit Rueckkehr-Leiter), sie lief nur
-- hinter dem Flag absence_replanner, das nie gesetzt wurde. Muster wie 0042:
-- eine Zeile je Konto + Trigger fuer neue Konten (fail-closed bleibt erhalten).
--
-- SELBSTSTAENDIG: 0040 (CHECK um absence_replanner erweitert) ist auf dieser
-- Instanz moeglicherweise nie gelaufen — der CHECK wird hier idempotent neu
-- gesetzt (vollstaendige Liste aus engine/feature-flags.js KNOWN).
--
-- RUECKNAHME. update public.user_feature_flags set enabled = false
--             where flag = 'absence_replanner';
-- ============================================================

begin;

alter table public.user_feature_flags
  drop constraint if exists user_feature_flags_flag_known;
alter table public.user_feature_flags
  add constraint user_feature_flags_flag_known
  check (flag in ('engine_v2_plan', 'engine_v2_readiness',
                  'canary_diagnostics', 'prediction_observer',
                  'goal_plan_input', 'absence_replanner'));

insert into public.user_feature_flags (user_id, flag, enabled, reason, set_by)
select u.id, 'absence_replanner', true, 'Stufe D Standard an (0046, 14.09.2026)', 'migration'
  from auth.users u
 where not exists (
   select 1 from public.user_feature_flags f
    where f.user_id = u.id and f.flag = 'absence_replanner');

-- Trigger-Funktion aus 0042 ersetzen: neue Konten bekommen BEIDE Standardflags.
create or replace function public.seed_default_feature_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_feature_flags (user_id, flag, enabled, reason, set_by)
  values (new.id, 'goal_plan_input', true, 'B-01 Standard an (0042)', 'migration'),
         (new.id, 'absence_replanner', true, 'Stufe D Standard an (0046)', 'migration')
  on conflict (user_id, flag) do nothing;
  return new;
end $$;

drop trigger if exists trg_seed_default_feature_flags on auth.users;
create trigger trg_seed_default_feature_flags
  after insert on auth.users
  for each row execute function public.seed_default_feature_flags();

commit;

-- Nachweis (danach im SQL-Editor):
-- select count(*) filter (where f.enabled) as an, count(u.id) as konten
--   from auth.users u left join public.user_feature_flags f
--     on f.user_id = u.id and f.flag = 'absence_replanner';
-- Erwartung: an = konten.
