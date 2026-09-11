-- ============================================================
-- 0041 · onboarding_step_log — B-04, Teil 3: Abbruchquoten-Logging je Schritt
-- ------------------------------------------------------------
-- WOFUER. Band 1, B-04 DoD: „Schritt-Logging liefert Daten." Bisher wusste
-- niemand, an welchem Onboarding-Schritt Nutzer haengen bleiben — der Draft
-- liegt nur im localStorage des Geraets. Diese Tabelle protokolliert
-- Schrittereignisse (oeffnen, betreten, abschliessen, ueberspringen, zurueck,
-- fertig) je Nutzer, append-only. Abbrueche werden nicht geraten, sondern aus
-- „letztes Ereignis ohne finish" abgeleitet (supabase/tests/_onboarding-funnel.sql).
--
-- BEOBACHTER, NIE BETEILIGTER. Ein fehlgeschlagener Insert bricht kein
-- Onboarding ab (Muster 0032/0037). Unveraenderlich: keine update-/delete-Policy,
-- authenticated nur select+insert, anon ausdruecklich entzogen (0036-Regel).
-- ============================================================

begin;

create table if not exists public.onboarding_step_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  event_id      text not null,
  event_type    text not null,
  step_id       text not null,
  from_step     text,
  draft_status  text,
  source        text,                 -- registration | profile | unknown
  resumed       boolean not null default false,
  ms_on_step    integer,              -- Verweildauer auf from_step, wenn messbar
  occurred_at   timestamptz not null,
  app_version   text,
  created_at    timestamptz not null default now(),
  unique (user_id, event_id)
);

alter table public.onboarding_step_log
  drop constraint if exists onboarding_step_log_type_known;
alter table public.onboarding_step_log
  add constraint onboarding_step_log_type_known
  check (event_type in ('open','enter','complete','skip','back','finish'));

create index if not exists onboarding_step_log_user_time_idx
  on public.onboarding_step_log (user_id, occurred_at desc);

alter table public.onboarding_step_log enable row level security;

drop policy if exists onboarding_step_log_sel_own on public.onboarding_step_log;
create policy onboarding_step_log_sel_own on public.onboarding_step_log
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists onboarding_step_log_ins_own on public.onboarding_step_log;
create policy onboarding_step_log_ins_own on public.onboarding_step_log
  for insert to authenticated with check (auth.uid() = user_id);

revoke all on public.onboarding_step_log from anon;
revoke all on public.onboarding_step_log from authenticated;
grant select, insert on public.onboarding_step_log to authenticated;

commit;
