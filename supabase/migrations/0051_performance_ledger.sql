-- ============================================================
-- 0051 · Athlete Performance Ledger (v8-448A) — VORBEREITET, nicht eingespielt
-- ------------------------------------------------------------
-- WOFUER. Chronologisches Leistungsregister: je Aktivitaet und Rekorddefinition ein Eintrag
-- (Wert, Einheit, Zeitpunkt, Herkunft, Urteil der metric-eligibility), daraus je Kennzahl die
-- Rekordhistorie (erster Wert, jede Verbesserung, Gleichstand) und Meilensteine.
-- Gerechnet wird ausschliesslich im Client-Modul app/js/engine/performance-ledger.js (eine Logik);
-- die Datenbank speichert das Ergebnis, schuetzt es (RLS) und haelt es konsistent:
--   * performance_ledger_entries   Eintraege; Fremdschluessel auf activities (on delete cascade)
--   * performance_record_events    Rekordhistorie je Kennzahl (abgeleitet, ersetzbar)
--   * performance_milestones       Meilensteine (abgeleitet, ersetzbar)
--   * performance_ledger_log       Protokoll jeder Neuberechnung (nur anhaengen, nachvollziehbar)
--   * performance_ledger_dirty     „neu zu berechnen": entsteht automatisch, wenn Eintraege
--                                  verschwinden (z. B. Aktivitaet geloescht) — der naechste Lauf
--                                  rechnet die Kennzahl neu und loescht den Vermerk
-- RPC orvia_ledger_apply: EINE Transaktion je Speichervorgang (security invoker, auth.uid()).
-- Flag performance_ledger: in den CHECK der Flag-Tabelle aufgenommen; Standard bleibt AUS
-- (keine Zeile = aus). Einschalten je Konto (service_role):
--   insert into public.user_feature_flags (user_id, flag, enabled, reason)
--   select id, 'performance_ledger', true, 'v8-448' from auth.users where email = '<mail>'
--   on conflict (user_id, flag) do update set enabled = true, reason = excluded.reason;
-- Idempotent. Rueckweg: migrations_rollback/0051_performance_ledger_rollback.sql
-- ============================================================

begin;

create table if not exists public.performance_ledger_entries (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  activity_id         uuid not null references public.activities(id) on delete cascade,
  sport_id            text not null,
  metric_key          text not null,                       -- '<sportart>.<rekord>@<kontextklasse>'
  def_id              text not null,
  context_class       text not null,
  value               double precision,                    -- null = gesperrt
  unit                text not null default '',
  better              text not null,
  recorded_at         text,                                -- Startzeit wie in activities (Zeitpunkt oder Wandzeit)
  local_date          date,
  order_key           text not null,                       -- chronologische Ordnung (Ortszeit der Einheit)
  source              text not null,
  provenance          jsonb not null default '{}'::jsonb,
  eligibility_status  text not null,
  eligibility_reason  text,
  validation_status   text not null,
  calc_version        text not null,
  input_fingerprint   text not null,
  computed_at         timestamptz not null default now(),
  constraint ple_better_chk check (better in ('lower', 'higher')),
  constraint ple_elig_chk check (eligibility_status in ('eligible', 'blocked')),
  constraint ple_valid_chk check (validation_status in ('validated', 'own_data', 'manual_override', 'unverified')),
  constraint ple_value_chk check ((eligibility_status = 'eligible') = (value is not null)),
  constraint ple_reason_chk check ((eligibility_status = 'blocked') = (eligibility_reason is not null)),
  constraint ple_uniq unique (user_id, activity_id, metric_key, calc_version)
);
create index if not exists ple_metric_idx on public.performance_ledger_entries (user_id, calc_version, metric_key, order_key)
  where eligibility_status = 'eligible';
create index if not exists ple_activity_idx on public.performance_ledger_entries (user_id, activity_id);

create table if not exists public.performance_record_events (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  metric_key            text not null,
  calc_version          text not null,
  seq                   integer not null,
  event_type            text not null,
  activity_id           uuid not null references public.activities(id) on delete cascade,
  value                 double precision not null,
  unit                  text not null default '',
  recorded_at           text,
  local_date            date,
  previous_value        double precision,
  previous_activity_id  uuid references public.activities(id) on delete set null,
  previous_local_date   date,
  improvement           double precision,
  improvement_pct       double precision,
  days_since_previous   integer,
  manual                boolean not null default false,
  computed_at           timestamptz not null default now(),
  constraint pre_type_chk check (event_type in ('first', 'improved', 'equalled')),
  constraint pre_seq_chk check (seq >= 1),
  constraint pre_first_chk check ((event_type = 'first') = (previous_value is null)),
  constraint pre_uniq unique (user_id, metric_key, calc_version, seq)
);
create index if not exists pre_metric_idx on public.performance_record_events (user_id, calc_version, metric_key, seq);

create table if not exists public.performance_milestones (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  milestone_key  text not null,
  milestone_id   text not null,
  calc_version   text not null,
  activity_id    uuid not null references public.activities(id) on delete cascade,
  local_date     date,
  recorded_at    text,
  value          double precision,
  unit           text not null default '',
  detail         jsonb not null default '{}'::jsonb,
  computed_at    timestamptz not null default now(),
  constraint pms_uniq unique (user_id, milestone_key, calc_version)
);

-- Protokoll: nur anhaengen. activity_id bewusst OHNE Fremdschluessel (bleibt nach einer Loeschung lesbar).
create table if not exists public.performance_ledger_log (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  at            timestamptz not null default now(),
  calc_version  text not null,
  metric_key    text not null,
  reason        text not null,
  before_value  double precision,
  after_value   double precision,
  before_activity_id uuid,
  after_activity_id  uuid,
  detail        jsonb not null default '{}'::jsonb
);
create index if not exists pll_user_idx on public.performance_ledger_log (user_id, at desc);

create table if not exists public.performance_ledger_dirty (
  user_id       uuid not null references auth.users(id) on delete cascade,
  metric_key    text not null,
  calc_version  text not null,
  since         timestamptz not null default now(),
  reason        text not null default 'entries_removed',
  primary key (user_id, metric_key, calc_version)
);

-- Verschwinden Eintraege (Aktivitaet geloescht → cascade), wird die Kennzahl als „neu zu berechnen" vermerkt.
-- Die Rekordereignisse der geloeschten Aktivitaet fallen per cascade mit weg; die Kette ist bis zur
-- Neuberechnung unvollstaendig — genau das zeigt der Vermerk an.
create or replace function public.orvia_ledger_mark_dirty()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.performance_ledger_dirty (user_id, metric_key, calc_version, reason)
  values (old.user_id, old.metric_key, old.calc_version, 'entries_removed')
  on conflict (user_id, metric_key, calc_version) do nothing;
  return old;
end $$;
drop trigger if exists ple_mark_dirty on public.performance_ledger_entries;
create trigger ple_mark_dirty after delete on public.performance_ledger_entries
  for each row when (old.eligibility_status = 'eligible')
  execute function public.orvia_ledger_mark_dirty();

-- ---- RLS ----------------------------------------------------
alter table public.performance_ledger_entries enable row level security;
alter table public.performance_record_events enable row level security;
alter table public.performance_milestones enable row level security;
alter table public.performance_ledger_log enable row level security;
alter table public.performance_ledger_dirty enable row level security;

do $$
declare t text;
begin
  foreach t in array array['performance_ledger_entries', 'performance_record_events', 'performance_milestones', 'performance_ledger_dirty'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_own', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
drop policy if exists performance_ledger_log_select_own on public.performance_ledger_log;
create policy performance_ledger_log_select_own on public.performance_ledger_log for select using (auth.uid() = user_id);
drop policy if exists performance_ledger_log_insert_own on public.performance_ledger_log;
create policy performance_ledger_log_insert_own on public.performance_ledger_log for insert with check (auth.uid() = user_id);
grant select, insert on public.performance_ledger_log to authenticated;
grant usage on sequence public.performance_ledger_log_id_seq to authenticated;

-- ---- RPC: ein Speichervorgang = eine Transaktion ----------------------------
-- p_activity_ids  Aktivitaeten, deren Eintraege ersetzt werden (geaendert, neu oder entfernt)
-- p_entries       neue Eintraege dieser Aktivitaeten
-- p_metric_keys   Kennzahlen, deren Rekordhistorie ersetzt wird; p_events = neue Historie
-- p_milestones    null = Meilensteine unveraendert; sonst vollstaendiger Ersatz fuer p_calc_version
-- p_log           Protokollzeilen
-- Fremde Aktivitaeten (andere user_id) scheitern am Fremdschluessel-Check der RLS-sichtbaren Zeilen.
create or replace function public.orvia_ledger_apply(
  p_calc_version text, p_activity_ids uuid[], p_entries jsonb, p_metric_keys text[], p_events jsonb,
  p_milestones jsonb, p_log jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n_entries int := 0; n_events int := 0; n_ms int := 0; n_log int := 0; n_foreign int;
begin
  if uid is null then raise exception 'ledger_not_authenticated'; end if;
  if p_calc_version is null or p_calc_version = '' then raise exception 'ledger_calc_version_missing'; end if;

  -- nur eigene Aktivitaeten (RLS auf activities: fremde sind unsichtbar → hier gezaehlt und abgelehnt)
  -- (Fremdschluessel-Pruefungen umgehen RLS — deshalb hier ausdruecklich fuer Eintraege, Ereignisse und Meilensteine)
  select count(*) into n_foreign
  from (select distinct x.aid from (
          select (e ->> 'activity_id')::uuid as aid from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) e
          union all select (v ->> 'activity_id')::uuid from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) v
          union all select (v ->> 'previous_activity_id')::uuid from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) v
          union all select (m ->> 'activity_id')::uuid from jsonb_array_elements(coalesce(p_milestones, '[]'::jsonb)) m) x
        where x.aid is not null) y
  where not exists (select 1 from public.activities a where a.id = y.aid and a.user_id = uid);
  if n_foreign > 0 then raise exception 'ledger_foreign_activity'; end if;

  delete from public.performance_ledger_entries
   where user_id = uid and calc_version = p_calc_version and activity_id = any(coalesce(p_activity_ids, '{}'));

  insert into public.performance_ledger_entries (user_id, activity_id, sport_id, metric_key, def_id, context_class, value, unit, better,
      recorded_at, local_date, order_key, source, provenance, eligibility_status, eligibility_reason, validation_status, calc_version, input_fingerprint)
  select uid, (e ->> 'activity_id')::uuid, e ->> 'sport_id', e ->> 'metric_key', e ->> 'def_id', e ->> 'context_class',
         (e ->> 'value')::double precision, coalesce(e ->> 'unit', ''), e ->> 'better', e ->> 'recorded_at', (e ->> 'local_date')::date,
         e ->> 'order_key', coalesce(e ->> 'source', 'unknown'), coalesce(e -> 'provenance', '{}'::jsonb), e ->> 'eligibility_status',
         e ->> 'eligibility_reason', e ->> 'validation_status', p_calc_version, e ->> 'input_fingerprint'
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) e;
  get diagnostics n_entries = row_count;

  if coalesce(array_length(p_metric_keys, 1), 0) > 0 then
    delete from public.performance_record_events
     where user_id = uid and calc_version = p_calc_version and metric_key = any(p_metric_keys);
    insert into public.performance_record_events (user_id, metric_key, calc_version, seq, event_type, activity_id, value, unit, recorded_at,
        local_date, previous_value, previous_activity_id, previous_local_date, improvement, improvement_pct, days_since_previous, manual)
    select uid, v ->> 'metric_key', p_calc_version, (v ->> 'seq')::int, v ->> 'event_type', (v ->> 'activity_id')::uuid,
           (v ->> 'value')::double precision, coalesce(v ->> 'unit', ''), v ->> 'recorded_at', (v ->> 'local_date')::date,
           (v ->> 'previous_value')::double precision, (v ->> 'previous_activity_id')::uuid, (v ->> 'previous_local_date')::date,
           (v ->> 'improvement')::double precision, (v ->> 'improvement_pct')::double precision, (v ->> 'days_since_previous')::int,
           coalesce((v ->> 'manual')::boolean, false)
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) v
    where v ->> 'metric_key' = any(p_metric_keys);
    get diagnostics n_events = row_count;
    delete from public.performance_ledger_dirty
     where user_id = uid and calc_version = p_calc_version and metric_key = any(p_metric_keys);
  end if;

  if p_milestones is not null then
    delete from public.performance_milestones where user_id = uid and calc_version = p_calc_version;
    insert into public.performance_milestones (user_id, milestone_key, milestone_id, calc_version, activity_id, local_date, recorded_at, value, unit, detail)
    select uid, m ->> 'milestone_key', m ->> 'milestone_id', p_calc_version, (m ->> 'activity_id')::uuid, (m ->> 'local_date')::date,
           m ->> 'recorded_at', (m ->> 'value')::double precision, coalesce(m ->> 'unit', ''), coalesce(m -> 'detail', '{}'::jsonb)
    from jsonb_array_elements(p_milestones) m;
    get diagnostics n_ms = row_count;
  end if;

  insert into public.performance_ledger_log (user_id, calc_version, metric_key, reason, before_value, after_value, before_activity_id, after_activity_id, detail)
  select uid, p_calc_version, l ->> 'metricKey', coalesce(l ->> 'reason', 'unknown'), (l ->> 'beforeBest')::double precision, (l ->> 'afterBest')::double precision,
         case when (l ->> 'beforeActivityId') ~ '^[0-9a-fA-F-]{36}$' then (l ->> 'beforeActivityId')::uuid end,
         case when (l ->> 'afterActivityId') ~ '^[0-9a-fA-F-]{36}$' then (l ->> 'afterActivityId')::uuid end,
         jsonb_build_object('eventsBefore', l -> 'eventsBefore', 'eventsAfter', l -> 'eventsAfter')
  from jsonb_array_elements(coalesce(p_log, '[]'::jsonb)) l;
  get diagnostics n_log = row_count;

  return jsonb_build_object('entries', n_entries, 'events', n_events, 'milestones', n_ms, 'log', n_log);
end $$;
grant execute on function public.orvia_ledger_apply(text, uuid[], jsonb, text[], jsonb, jsonb, jsonb) to authenticated;

-- ---- Flag (Standard AUS) ---------------------------------------------------
alter table public.user_feature_flags
  drop constraint if exists user_feature_flags_flag_known;
alter table public.user_feature_flags
  add constraint user_feature_flags_flag_known
  check (flag in ('engine_v2_plan', 'engine_v2_readiness',
                  'canary_diagnostics', 'prediction_observer',
                  'goal_plan_input', 'absence_replanner', 'performance_ledger'));

commit;
