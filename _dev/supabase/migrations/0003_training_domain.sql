-- ============================================================
--  ORVIA · 0003 — Trainingsdomäne (Phase 4.1: NUR Datenmodell + RLS + Seeds)
--  KEINE Plan-Engine, KEINE 30 Pläne, KEINE Körpergrafik. Idempotent.
--  Wiederverwendet aus 0002: user_sports, user_goals, weekly_availability, fixed_schedule_items.
--  Im Supabase SQL-Editor ausführen. Catalog-Tabellen = systemdefiniert (nur lesbar).
-- ============================================================

create extension if not exists pgcrypto;
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ============================================================
--  A) KATALOG (systemdefiniert, für alle authentifizierten lesbar, nicht beschreibbar)
-- ============================================================
create table if not exists public.sports (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, name text not null, has_positions boolean not null default false,
  category text, created_at timestamptz not null default now()
);
create table if not exists public.sport_positions (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id) on delete cascade,
  key text not null, name text not null,
  unique (sport_id, key)
);
create table if not exists public.training_qualities (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, name text not null, sport_key text, created_at timestamptz not null default now()
);
create table if not exists public.muscle_groups (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, name text not null,
  body_region text,          -- torso | arms | legs | core
  body_side text,            -- bilateral | left | right
  body_view text,            -- front | back
  visual_key text,           -- Mapping-Key für spätere Körpergrafik
  parent_key text,           -- optionale feinere Untergruppen (z.B. chest_upper → chest)
  created_at timestamptz not null default now()
);
create table if not exists public.movement_patterns (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, name text not null, created_at timestamptz not null default now()
);
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, name text not null, created_at timestamptz not null default now()
);

-- ============================================================
--  B) ÜBUNGEN (systemdefiniert ODER nutzerdefiniert)
-- ============================================================
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique,                         -- für System-Übungen (stabil/idempotent)
  user_id uuid references auth.users(id) on delete cascade,  -- null = systemdefiniert
  is_system boolean not null default true,
  name text not null, aliases text[] default '{}', description text,
  category text,                            -- compound | isolation | plyometric | mobility | rehab ...
  movement_pattern text,                    -- references movement_patterns.key (lose gekoppelt)
  difficulty text,                          -- beginner | intermediate | advanced
  stability text,                           -- low | medium | high (Stabilitätsanforderung)
  complexity text,                          -- low | medium | high (technische Komplexität)
  fatigue_cost numeric,                     -- relative Ermüdungskosten
  joint_stress jsonb default '{}'::jsonb,   -- {knee,shoulder,lowerBack,elbow}
  unilateral boolean not null default false,
  bodyweight boolean not null default false,
  set_type_compat text[] default '{}',      -- kompatible Satztypen
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists exercises_user_idx on public.exercises (user_id);
create index if not exists exercises_system_idx on public.exercises (is_system);

-- Übung ↔ Muskelgruppe (gewichtet, direkt/indirekt). Summen müssen nicht 1.0 ergeben.
create table if not exists public.exercise_muscles (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_key text not null references public.muscle_groups(key),
  weight numeric not null default 1.0,
  involvement text not null default 'direct',   -- direct | indirect
  unique (exercise_id, muscle_key)
);
create table if not exists public.exercise_equipment (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  equipment_key text not null references public.equipment(key),
  unique (exercise_id, equipment_key)
);
create table if not exists public.exercise_training_qualities (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  quality_key text not null references public.training_qualities(key),
  weight numeric not null default 1.0,
  unique (exercise_id, quality_key)
);
create table if not exists public.exercise_alternatives (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  alternative_exercise_id uuid not null references public.exercises(id) on delete cascade,
  relation text not null default 'alternative',  -- alternative | regression | progression
  reason text,
  unique (exercise_id, alternative_exercise_id, relation)
);

-- ============================================================
--  C) PLAN-VORLAGEN (System/User) ≠ persönliche Pläne
-- ============================================================
create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique, user_id uuid references auth.users(id) on delete cascade, is_system boolean not null default true,
  name text not null, description text, goal text, level text,
  split_type text, days_per_week int, typical_duration_min int,
  equipment text[] default '{}', sport_key text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workout_template_days (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  day_index int not null, name text, focus text,
  unique (template_id, day_index)
);
create table if not exists public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_day_id uuid not null references public.workout_template_days(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  order_index int not null default 0, planned_sets int, min_reps int, max_reps int,
  target_rir numeric, rest_seconds int, notes text
);

-- ============================================================
--  D) PERSÖNLICHE PLÄNE (nutzer-eigen, versionierbar)
-- ============================================================
create table if not exists public.user_training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_template_id uuid references public.workout_templates(id) on delete set null,
  name text not null, split_type text, sport_key text,
  active boolean not null default false, start_date date, end_date date,
  version int not null default 1, status text not null default 'draft',  -- draft|active|archived
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists user_training_plans_user_idx on public.user_training_plans (user_id);
create table if not exists public.training_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.user_training_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day_index int not null, weekday int, name text, focus text,
  unique (plan_id, day_index)
);
create table if not exists public.training_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.training_plan_days(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  order_index int not null default 0, planned_sets int, min_reps int, max_reps int,
  target_rir numeric, rest_seconds int, notes text
);

-- ============================================================
--  E) WORKOUT-HIERARCHIE: session → exercise → set
--  Leistungsfelder bewusst NULLABLE (Gym vs. Lauf/Rad/Schwimm).
-- ============================================================
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.user_training_plans(id) on delete set null,
  plan_day_id uuid references public.training_plan_days(id) on delete set null,
  planned_session_id text,                  -- lose Kopplung an Plan-Tagesplatz
  local_date date not null, started_at timestamptz, finished_at timestamptz,
  status text not null default 'planned',   -- planned|active|completed|skipped|legacy
  sport text, session_type text, duration_min numeric, notes text,
  readiness_snapshot jsonb, decision_snapshot jsonb, source text not null default 'manual',
  client_session_id text,                   -- Dedupe/Idempotenz (analog training_load_daily)
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions (user_id, local_date desc);
create unique index if not exists workout_sessions_client_uniq on public.workout_sessions (user_id, client_session_id) where client_session_id is not null;

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  order_index int not null default 0, planned_sets int, min_reps int, max_reps int,
  target_rir numeric, target_rpe numeric, rest_seconds int, notes text,
  completed boolean not null default false, replaced_by_exercise_id uuid references public.exercises(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists workout_exercises_session_idx on public.workout_exercises (workout_session_id);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number int not null, set_type text not null default 'working',
  weight numeric, reps int, rir numeric, rpe numeric,
  duration_s numeric, distance_m numeric, time_s numeric, tempo text, rest_s numeric,
  completed boolean not null default false, pain int, technique int,
  recorded_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists workout_sets_exercise_idx on public.workout_sets (workout_exercise_id);
-- Idempotenz/Dedupe: genau EIN Satz je (Workout-Exercise, Satznummer); EINE Übungszeile je
-- (Session, order_index). Verhindert Dubletten bei Doppelklick/Retry/Offline-Sync.
create unique index if not exists workout_sets_uniq on public.workout_sets (workout_exercise_id, set_number);
create unique index if not exists workout_exercises_uniq on public.workout_exercises (workout_session_id, order_index);
-- Normalisierte Sportart-Kategorie (lowercase Key), getrennt vom Anzeigetext sport.
alter table public.workout_sessions add column if not exists sport_key text;

-- ============================================================
--  F) ERWEITERUNG bestehender 0002-Tabellen (KEINE Neuanlage)
-- ============================================================
alter table public.user_sports add column if not exists sport_key text;            -- Katalog-Referenz (lose)
alter table public.user_sports add column if not exists position_key text;          -- getrennt von der Sportart
alter table public.user_sports add column if not exists custom_position text;       -- freie Rolle (optional)
alter table public.user_sports add column if not exists level text;                 -- beginner..pro
alter table public.user_sports add column if not exists season_phase text;          -- offseason|preseason|inseason
alter table public.user_goals add column if not exists sport_key text;
alter table public.user_goals add column if not exists position_key text;
alter table public.user_goals add column if not exists start_date date;
alter table public.user_goals add column if not exists current_value numeric;
alter table public.user_goals add column if not exists gym_goal_type text;          -- hypertrophy|max_strength|powerbuilding|...

-- ============================================================
--  updated_at-Trigger
-- ============================================================
do $$ declare t text; begin
  foreach t in array array['exercises','workout_templates','user_training_plans','workout_sessions'] loop
    execute format('drop trigger if exists %I_touch on public.%I;', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;

-- ============================================================
--  G) GRANTS
-- ============================================================
do $$ declare t text; begin
  -- REINER Katalog: nur lesbar (keine Nutzer-Schreibrechte).
  foreach t in array array['sports','sport_positions','training_qualities','muscle_groups','movement_patterns','equipment'] loop
    execute format('revoke all on public.%I from anon, public;', t);
    execute format('grant select on public.%I to authenticated;', t);
  end loop;
  -- Volles DML (durch RLS begrenzt): Übungen + Junctions + Templates + Template-Kinder +
  -- Nutzer-Trainingstabellen. WICHTIG: Junctions/Template-Kinder brauchen INSERT/UPDATE/DELETE,
  -- sonst greifen die RLS-Schreib-Policies für eigene Übungen/Vorlagen ins Leere.
  foreach t in array array['exercises','exercise_muscles','exercise_equipment','exercise_training_qualities','exercise_alternatives','workout_templates','workout_template_days','workout_template_exercises','user_training_plans','training_plan_days','training_plan_exercises','workout_sessions','workout_exercises','workout_sets'] loop
    execute format('revoke all on public.%I from anon, public;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $$;

-- ============================================================
--  G2) Helfer für Cross-User-FK-Prüfungen (SECURITY DEFINER, explizite Prädikate).
--  Verhindern, dass referenzierte Übungen/Pläne/Vorlagen einem ANDEREN Nutzer gehören.
--  NULL ist erlaubt (optionale FKs). System-Übungen/-Vorlagen sind für alle zulässig.
-- ============================================================
create or replace function public.orvia_exercise_allowed(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select eid is null or exists (select 1 from public.exercises e where e.id = eid and (e.is_system or e.user_id = auth.uid()))
$$;
create or replace function public.orvia_template_allowed(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select tid is null or exists (select 1 from public.workout_templates t where t.id = tid and (t.is_system or t.user_id = auth.uid()))
$$;
create or replace function public.orvia_own_plan(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select pid is null or exists (select 1 from public.user_training_plans p where p.id = pid and p.user_id = auth.uid())
$$;
create or replace function public.orvia_own_plan_day(did uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select did is null or exists (select 1 from public.training_plan_days d where d.id = did and d.user_id = auth.uid())
$$;
create or replace function public.orvia_own_session(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select sid is null or exists (select 1 from public.workout_sessions s where s.id = sid and s.user_id = auth.uid())
$$;
create or replace function public.orvia_own_workout_exercise(weid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select weid is null or exists (select 1 from public.workout_exercises we where we.id = weid and we.user_id = auth.uid())
$$;
revoke all on function public.orvia_exercise_allowed(uuid), public.orvia_template_allowed(uuid), public.orvia_own_plan(uuid), public.orvia_own_plan_day(uuid), public.orvia_own_session(uuid), public.orvia_own_workout_exercise(uuid) from public;
grant execute on function public.orvia_exercise_allowed(uuid), public.orvia_template_allowed(uuid), public.orvia_own_plan(uuid), public.orvia_own_plan_day(uuid), public.orvia_own_session(uuid), public.orvia_own_workout_exercise(uuid) to authenticated;

-- ============================================================
--  H) ROW LEVEL SECURITY
-- ============================================================
-- H1) Katalog: nur lesbar (keine Schreib-Policies → durch FORCE RLS blockiert; Seeds via Owner/SQL-Editor).
do $$ declare t text; begin
  foreach t in array array['sports','sport_positions','training_qualities','muscle_groups','movement_patterns','equipment'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('drop policy if exists sel_all on public.%I;', t);
    execute format('create policy sel_all on public.%I for select to authenticated using (true);', t);
  end loop;
end $$;

-- H2) exercises: System lesbar für alle; nutzerdefinierte nur für Besitzer (schreibbar nur nicht-system, eigen).
alter table public.exercises enable row level security; alter table public.exercises force row level security;
drop policy if exists sel on public.exercises; drop policy if exists ins on public.exercises; drop policy if exists upd on public.exercises; drop policy if exists del on public.exercises;
create policy sel on public.exercises for select to authenticated using (is_system or user_id = auth.uid());
create policy ins on public.exercises for insert to authenticated with check (user_id = auth.uid() and is_system = false);
create policy upd on public.exercises for update to authenticated using (user_id = auth.uid() and is_system = false) with check (user_id = auth.uid() and is_system = false);
create policy del on public.exercises for delete to authenticated using (user_id = auth.uid() and is_system = false);

-- H3) Übungs-Junctions: lesbar für alle authentifizierten; Schreiben nur, wenn die Parent-Übung dem
--     Nutzer gehört (System-Übungs-Mappings sind Seeds, nicht durch Nutzer änderbar).
do $$ declare t text; begin
  foreach t in array array['exercise_muscles','exercise_equipment','exercise_training_qualities'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('drop policy if exists sel on public.%I;', t);
    execute format('drop policy if exists wr on public.%I;', t);
    execute format('create policy sel on public.%I for select to authenticated using (true);', t);
    execute format('create policy wr on public.%I for all to authenticated using (exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = auth.uid() and e.is_system = false)) with check (exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = auth.uid() and e.is_system = false));', t);
  end loop;
end $$;
-- exercise_alternatives: Parent-Übung muss EIGEN (nicht-system) sein UND die Alternative zulässig
-- (System oder eigen) — keine Verknüpfung auf fremde private Übungen.
alter table public.exercise_alternatives enable row level security; alter table public.exercise_alternatives force row level security;
drop policy if exists sel on public.exercise_alternatives; drop policy if exists wr on public.exercise_alternatives;
create policy sel on public.exercise_alternatives for select to authenticated using (true);
create policy wr on public.exercise_alternatives for all to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = auth.uid() and e.is_system = false))
  with check (exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = auth.uid() and e.is_system = false) and public.orvia_exercise_allowed(alternative_exercise_id));

-- H4) workout_templates: System lesbar; nutzereigene nur für Besitzer (schreibbar nur eigene, nicht-system).
alter table public.workout_templates enable row level security; alter table public.workout_templates force row level security;
drop policy if exists sel on public.workout_templates; drop policy if exists ins on public.workout_templates; drop policy if exists upd on public.workout_templates; drop policy if exists del on public.workout_templates;
create policy sel on public.workout_templates for select to authenticated using (is_system or user_id = auth.uid());
create policy ins on public.workout_templates for insert to authenticated with check (user_id = auth.uid() and is_system = false);
create policy upd on public.workout_templates for update to authenticated using (user_id = auth.uid() and is_system = false) with check (user_id = auth.uid() and is_system = false);
create policy del on public.workout_templates for delete to authenticated using (user_id = auth.uid() and is_system = false);

-- H5) Template-Kinder: lesbar wenn Parent-Template sichtbar; Schreiben nur wenn Parent eigen + nicht-system.
do $$ declare t text; declare parentcol text; begin
  -- workout_template_days hängt an template_id; workout_template_exercises an template_day_id → template.
  execute 'alter table public.workout_template_days enable row level security'; execute 'alter table public.workout_template_days force row level security';
  drop policy if exists sel on public.workout_template_days; drop policy if exists wr on public.workout_template_days;
  create policy sel on public.workout_template_days for select to authenticated using (exists (select 1 from public.workout_templates wt where wt.id = template_id and (wt.is_system or wt.user_id = auth.uid())));
  create policy wr on public.workout_template_days for all to authenticated using (exists (select 1 from public.workout_templates wt where wt.id = template_id and wt.user_id = auth.uid() and wt.is_system = false)) with check (exists (select 1 from public.workout_templates wt where wt.id = template_id and wt.user_id = auth.uid() and wt.is_system = false));
  execute 'alter table public.workout_template_exercises enable row level security'; execute 'alter table public.workout_template_exercises force row level security';
  drop policy if exists sel on public.workout_template_exercises; drop policy if exists wr on public.workout_template_exercises;
  create policy sel on public.workout_template_exercises for select to authenticated using (exists (select 1 from public.workout_template_days d join public.workout_templates wt on wt.id = d.template_id where d.id = template_day_id and (wt.is_system or wt.user_id = auth.uid())));
  create policy wr on public.workout_template_exercises for all to authenticated using (exists (select 1 from public.workout_template_days d join public.workout_templates wt on wt.id = d.template_id where d.id = template_day_id and wt.user_id = auth.uid() and wt.is_system = false)) with check (exists (select 1 from public.workout_template_days d join public.workout_templates wt on wt.id = d.template_id where d.id = template_day_id and wt.user_id = auth.uid() and wt.is_system = false) and public.orvia_exercise_allowed(exercise_id));
end $$;

-- H6) Nutzer-Trainingstabellen mit user_id: generische Eigen-Zeilen-RLS (SELECT/INSERT/UPDATE-Guard/DELETE).
do $$ declare t text; begin
  foreach t in array array['user_training_plans','training_plan_days','training_plan_exercises','workout_sessions','workout_exercises','workout_sets'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('drop policy if exists sel_own on public.%I;', t);
    execute format('drop policy if exists ins_own on public.%I;', t);
    execute format('drop policy if exists upd_own on public.%I;', t);
    execute format('drop policy if exists del_own on public.%I;', t);
    execute format('create policy sel_own on public.%I for select to authenticated using (auth.uid() = user_id);', t);
    execute format('create policy ins_own on public.%I for insert to authenticated with check (auth.uid() = user_id);', t);
    execute format('create policy upd_own on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('create policy del_own on public.%I for delete to authenticated using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- H6b) Parent-Konsistenz UND alle referenzierten FKs müssen für den Nutzer zulässig sein
--      (eigener Plan/Tag/Session ODER System-/eigene Übung/Vorlage) — keine Cross-User-Verknüpfung.
do $$ begin
  -- user_training_plans.source_template_id: nur System oder eigene Vorlage
  drop policy if exists ins_own on public.user_training_plans; drop policy if exists upd_own on public.user_training_plans;
  create policy ins_own on public.user_training_plans for insert to authenticated with check (auth.uid() = user_id and public.orvia_template_allowed(source_template_id));
  create policy upd_own on public.user_training_plans for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.orvia_template_allowed(source_template_id));
  -- training_plan_days.plan_id muss eigenem Plan gehören
  drop policy if exists ins_own on public.training_plan_days; drop policy if exists upd_own on public.training_plan_days;
  create policy ins_own on public.training_plan_days for insert to authenticated with check (auth.uid() = user_id and public.orvia_own_plan(plan_id));
  create policy upd_own on public.training_plan_days for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.orvia_own_plan(plan_id));
  -- training_plan_exercises: eigener Plan-Tag + zulässige Übung
  drop policy if exists ins_own on public.training_plan_exercises; drop policy if exists upd_own on public.training_plan_exercises;
  create policy ins_own on public.training_plan_exercises for insert to authenticated with check (auth.uid() = user_id and public.orvia_own_plan_day(plan_day_id) and public.orvia_exercise_allowed(exercise_id));
  create policy upd_own on public.training_plan_exercises for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.orvia_own_plan_day(plan_day_id) and public.orvia_exercise_allowed(exercise_id));
  -- workout_sessions: plan_id + plan_day_id müssen eigen sein (oder null)
  drop policy if exists ins_own on public.workout_sessions; drop policy if exists upd_own on public.workout_sessions;
  create policy ins_own on public.workout_sessions for insert to authenticated with check (auth.uid() = user_id and public.orvia_own_plan(plan_id) and public.orvia_own_plan_day(plan_day_id));
  create policy upd_own on public.workout_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.orvia_own_plan(plan_id) and public.orvia_own_plan_day(plan_day_id));
  -- workout_exercises: eigene Session + zulässige Übung(en) (exercise_id, replaced_by_exercise_id)
  drop policy if exists ins_own on public.workout_exercises; drop policy if exists upd_own on public.workout_exercises;
  create policy ins_own on public.workout_exercises for insert to authenticated with check (auth.uid() = user_id and public.orvia_own_session(workout_session_id) and public.orvia_exercise_allowed(exercise_id) and public.orvia_exercise_allowed(replaced_by_exercise_id));
  create policy upd_own on public.workout_exercises for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.orvia_own_session(workout_session_id) and public.orvia_exercise_allowed(exercise_id) and public.orvia_exercise_allowed(replaced_by_exercise_id));
  -- workout_sets: eigene Workout-Exercise
  drop policy if exists ins_own on public.workout_sets; drop policy if exists upd_own on public.workout_sets;
  create policy ins_own on public.workout_sets for insert to authenticated with check (auth.uid() = user_id and public.orvia_own_workout_exercise(workout_exercise_id));
  create policy upd_own on public.workout_sets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.orvia_own_workout_exercise(workout_exercise_id));
end $$;

-- ============================================================
--  I) MINIMALE SEEDS (repräsentativ — KEINE vollständige Bibliothek)
-- ============================================================
insert into public.movement_patterns (key, name) values
 ('horizontal_push','Horizontal drücken'),('vertical_push','Vertikal drücken'),
 ('horizontal_pull','Horizontal ziehen'),('vertical_pull','Vertikal ziehen'),
 ('squat','Kniebeuge'),('hinge','Hüftbeuge/Hinge'),('lunge','Ausfallschritt'),
 ('knee_flexion','Kniebeugung'),('hip_extension','Hüftstreckung'),('calf','Wadenbewegung'),
 ('elbow_flexion','Ellbogenbeugung'),('elbow_extension','Ellbogenstreckung'),
 ('shoulder_abduction','Schulterabduktion'),('shoulder_extension','Schulterextension'),
 ('trunk_flexion','Rumpfbeugung'),('trunk_extension','Rumpfstreckung'),
 ('rotation','Rotation'),('anti_rotation','Anti-Rotation'),('carry','Carry'),
 ('jump','Sprung'),('sprint','Sprint'),('change_of_direction','Richtungswechsel'),
 ('throw','Wurf'),('stability','Stabilität'),('mobility','Mobilität')
on conflict (key) do nothing;

insert into public.muscle_groups (key, name, body_region, body_side, body_view, visual_key, parent_key) values
 ('chest','Brust','torso','bilateral','front','chest',null),
 ('front_delts','Vordere Schulter','torso','bilateral','front','front_delts',null),
 ('side_delts','Seitliche Schulter','torso','bilateral','front','side_delts',null),
 ('rear_delts','Hintere Schulter','torso','bilateral','back','rear_delts',null),
 ('biceps','Bizeps','arms','bilateral','front','biceps',null),
 ('triceps','Trizeps','arms','bilateral','back','triceps',null),
 ('forearms','Unterarme','arms','bilateral','front','forearms',null),
 ('abs','Bauch','core','bilateral','front','abs',null),
 ('lats','Latissimus','torso','bilateral','back','lats',null),
 ('upper_back','Oberer Rücken','torso','bilateral','back','upper_back',null),
 ('traps','Trapez','torso','bilateral','back','traps',null),
 ('lower_back','Rückenstrecker','core','bilateral','back','lower_back',null),
 ('quads','Quadrizeps','legs','bilateral','front','quads',null),
 ('hamstrings','Hamstrings','legs','bilateral','back','hamstrings',null),
 ('glutes','Gesäß','legs','bilateral','back','glutes',null),
 ('adductors','Adduktoren','legs','bilateral','front','adductors',null),
 ('abductors','Abduktoren','legs','bilateral','front','abductors',null),
 ('calves','Waden','legs','bilateral','back','calves',null),
 ('hip_flexors','Hüftbeuger','legs','bilateral','front','hip_flexors',null)
on conflict (key) do nothing;

insert into public.equipment (key, name) values
 ('barbell','Langhantel'),('dumbbell','Kurzhanteln'),('cable','Kabelzug'),('machine','Maschinen'),
 ('smith','Smith Machine'),('pullup_bar','Klimmzugstange'),('dip_bars','Dip-Barren'),
 ('band','Widerstandsbänder'),('kettlebell','Kettlebells'),('bodyweight','Körpergewicht'),
 ('rack','Rack'),('bench','Bank'),('leg_press','Beinpresse'),('treadmill','Laufband'),
 ('ergometer','Ergometer'),('open_floor','Freier Trainingsbereich')
on conflict (key) do nothing;

insert into public.sports (key, name, has_positions, category) values
 ('gym','Gym/Krafttraining',false,'strength'),('running','Laufen',false,'endurance'),
 ('cycling','Radsport',false,'endurance'),('swimming','Schwimmen',false,'endurance'),
 ('triathlon','Triathlon',false,'endurance'),('football','Fußball',true,'team'),
 ('handball','Handball',true,'team'),('padel','Padel',false,'racket'),
 ('tennis','Tennis',false,'racket'),('athletics','Allgemeine Athletik',false,'athletic')
on conflict (key) do nothing;

insert into public.sport_positions (sport_id, key, name)
 select s.id, v.key, v.name from public.sports s join (values
   ('football','gk','Torwart'),('football','cb','Innenverteidiger'),('football','fb','Außenverteidiger'),
   ('football','dm','Defensives Mittelfeld'),('football','cm','Zentrales Mittelfeld'),('football','am','Offensives Mittelfeld'),
   ('football','wing','Flügel'),('football','st','Stürmer'),
   ('handball','gk','Torwart'),('handball','wing','Außen'),('handball','back','Rückraum'),('handball','center','Mitte'),('handball','pivot','Kreis')
 ) as v(sport,key,name) on v.sport = s.key
on conflict (sport_id, key) do nothing;

insert into public.training_qualities (key, name, sport_key) values
 ('hypertrophy','Muskelaufbau',null),('max_strength','Maximalkraft',null),('power','Explosivität',null),
 ('speed','Schnelligkeit',null),('acceleration','Beschleunigung',null),('cod','Richtungswechsel',null),
 ('jump','Sprungkraft',null),('robustness','Belastbarkeit',null),('aerobic','Grundlagenausdauer',null),
 ('threshold','Schwelle',null),('vo2max','VO2max',null),('running_economy','Laufökonomie',null),
 ('core_stability','Rumpfstabilität',null),('single_leg','Einbeinige Kraft',null),
 ('injury_prevention','Verletzungsprävention',null)
on conflict (key) do nothing;

-- Repräsentative Übungen (~20) — NUR für Schema/UI/Tests.
insert into public.exercises (slug, is_system, name, category, movement_pattern, difficulty, unilateral, bodyweight) values
 ('bench_press',true,'Bankdrücken','compound','horizontal_push','intermediate',false,false),
 ('incline_bench_press',true,'Schrägbankdrücken','compound','horizontal_push','intermediate',false,false),
 ('overhead_press',true,'Schulterdrücken','compound','vertical_push','intermediate',false,false),
 ('lateral_raise',true,'Seitheben','isolation','shoulder_abduction','beginner',false,false),
 ('pullup',true,'Klimmzüge','compound','vertical_pull','advanced',false,true),
 ('lat_pulldown',true,'Latzug','compound','vertical_pull','beginner',false,false),
 ('row',true,'Rudern','compound','horizontal_pull','intermediate',false,false),
 ('squat',true,'Kniebeuge','compound','squat','advanced',false,false),
 ('leg_press',true,'Beinpresse','compound','squat','beginner',false,false),
 ('romanian_deadlift',true,'Rumänisches Kreuzheben','compound','hinge','intermediate',false,false),
 ('leg_curl',true,'Beinbeuger','isolation','knee_flexion','beginner',false,false),
 ('hip_thrust',true,'Hip Thrust','compound','hip_extension','beginner',false,false),
 ('calf_raise',true,'Wadenheben','isolation','calf','beginner',false,false),
 ('biceps_curl',true,'Bizepscurls','isolation','elbow_flexion','beginner',false,false),
 ('triceps_pushdown',true,'Trizepsdrücken','isolation','elbow_extension','beginner',false,false),
 ('plank',true,'Plank','isolation','anti_rotation','beginner',false,true),
 ('bulgarian_split_squat',true,'Bulgarian Split Squat','compound','lunge','intermediate',true,false),
 ('nordic_curl',true,'Nordics','compound','knee_flexion','advanced',false,true),
 ('copenhagen_plank',true,'Copenhagen Plank','isolation','stability','intermediate',true,true),
 ('box_jump',true,'Box Jumps','plyometric','jump','intermediate',false,true)
on conflict (slug) do nothing;

-- Beispiel-Muskelzuordnungen (gewichtet, direkt/indirekt) für einige Seed-Übungen.
insert into public.exercise_muscles (exercise_id, muscle_key, weight, involvement)
 select e.id, v.mk, v.w, v.inv from public.exercises e join (values
  ('bench_press','chest',1.0,'direct'),('bench_press','triceps',0.5,'indirect'),('bench_press','front_delts',0.4,'indirect'),
  ('pullup','lats',1.0,'direct'),('pullup','biceps',0.5,'indirect'),('pullup','upper_back',0.4,'indirect'),
  ('squat','quads',1.0,'direct'),('squat','glutes',0.6,'indirect'),('squat','lower_back',0.3,'indirect'),
  ('romanian_deadlift','hamstrings',1.0,'direct'),('romanian_deadlift','glutes',0.6,'indirect'),('romanian_deadlift','lower_back',0.4,'indirect'),
  ('hip_thrust','glutes',1.0,'direct'),('hip_thrust','hamstrings',0.4,'indirect')
 ) as v(slug,mk,w,inv) on e.slug = v.slug
on conflict (exercise_id, muscle_key) do nothing;

insert into public.schema_migrations(version) values ('0003_training_domain') on conflict (version) do nothing;
