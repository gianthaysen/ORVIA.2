-- ============================================================
-- 0022 · daily_energy_expenditure — dynamischer Gesamtumsatz (Phase 7)
-- ------------------------------------------------------------
-- Ein Datensatz je Nutzer/Tag mit beiden parallel berechneten Modi
-- (Provider = Garmin-Gesamtkalorien; ORVIA = BMR + Schritte + Training
-- + TEF) plus adaptiver Korrektur aus dem Gewichtstrend. Der Client
-- (nutrition.js → energy-expenditure-resolver.js) upsertet idempotent
-- über (user_id, local_date). RLS-Muster identisch zu 0019.
-- ============================================================
-- LIVE-FIX (2026-07-18): Auf der Produktionsinstanz existierte bereits eine
-- Alttabelle gleichen Namens mit anderem Schema (ohne local_date; nie vom
-- Client beschrieben) — create table if not exists übersprang sie und der
-- Index schlug mit 42703 fehl. Leere Alttabelle ersetzen; mit Daten: Abbruch.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'daily_energy_expenditure')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'daily_energy_expenditure'
               and column_name = 'local_date') then
    if (select count(*) from public.daily_energy_expenditure) = 0 then
      drop table public.daily_energy_expenditure;
    else
      raise exception 'daily_energy_expenditure existiert mit anderem Schema und enthält Daten — manuelle Prüfung nötig';
    end if;
  end if;
end $$;

create table if not exists public.daily_energy_expenditure (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  local_date         date not null,
  mode               text not null,          -- provider | orvia
  bmr_kcal           int,
  bmr_method         text,                   -- katch_mcardle | mifflin
  step_kcal          int,
  training_kcal      int,
  tef_kcal           int,
  adaptive_adj_kcal  int,
  trend_kg_28d       numeric,
  tdee_orvia         int,
  tdee_provider      int,
  tdee_chosen        int not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, local_date)
);
create index if not exists dee_user_date_idx on public.daily_energy_expenditure (user_id, local_date desc);

alter table public.daily_energy_expenditure enable row level security;
drop policy if exists sel_own on public.daily_energy_expenditure;
create policy sel_own on public.daily_energy_expenditure for select to authenticated using (auth.uid() = user_id);
drop policy if exists ins_own on public.daily_energy_expenditure;
create policy ins_own on public.daily_energy_expenditure for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists upd_own on public.daily_energy_expenditure;
create policy upd_own on public.daily_energy_expenditure for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists del_own on public.daily_energy_expenditure;
create policy del_own on public.daily_energy_expenditure for delete to authenticated using (auth.uid() = user_id);
