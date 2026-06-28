-- ============================================================
--  ⚠️ UNGEPRÜFTER ENTWURF — NICHT DEPLOYEN, NICHT AUSFÜHREN, NICHT ALS ABGESCHLOSSEN BEZEICHNEN.
--  Bewusst AUSSERHALB von supabase/migrations/ abgelegt, damit kein Tool ihn anwendet.
--  Freigabe/Umsetzung erst in Inkrement 2B nach Schema-/RLS-/RPC-/Kollisions-Audit und
--  realer Testumgebung. Migrationsnummer 0009 ist derzeit frei, aber NICHT reserviert.
-- ============================================================
--  ORVIA · 0009 (ENTWURF) — Kanonische Aktivitäten
--  EINE universelle Aktivitäts-Wahrheit für Verlauf, Kalender, Statistik, Belastung.
--  Workout-Details bleiben in workout_sessions/_exercises/_sets; die Aktivität verweist
--  über workout_session_id + (source, source_record_id) darauf. Idempotenz via Unique-Index.
--  security invoker → RLS/auth.uid() greift. Nur eigene Daten.
--  HINWEIS: Diese Migration ist NICHT offline getestet — sie muss live (Supabase) verifiziert
--  werden (siehe DEPLOY-Hinweise im Abschlussbericht).
-- ============================================================

create table if not exists public.activities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  sport_id          text,
  source            text not null default 'manual',          -- orvia_workout | manual | import
  source_record_id  text,                                    -- z. B. workout_session id/client_session_id
  workout_session_id uuid references public.workout_sessions(id) on delete set null,
  local_date        date,
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_seconds  integer check (duration_seconds is null or duration_seconds >= 0),
  status            text not null default 'completed',
  summary           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Idempotenz: pro Nutzer genau EINE Aktivität je Quelle+Quell-ID (verhindert Doppel-Activities
-- bei wiederholtem Workout-Abschluss / Offline-Retry).
create unique index if not exists activities_source_uniq
  on public.activities (user_id, source, source_record_id)
  where source_record_id is not null;
create index if not exists activities_user_date_idx on public.activities (user_id, local_date desc);
create index if not exists activities_workout_idx on public.activities (workout_session_id);

alter table public.activities enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='sel_own') then
    create policy sel_own on public.activities for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='ins_own') then
    create policy ins_own on public.activities for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='upd_own') then
    create policy upd_own on public.activities for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='del_own') then
    create policy del_own on public.activities for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- ------------------------------------------------------------
--  Idempotenter Upsert einer Aktivität aus einer abgeschlossenen Workout-Session.
--  Liefert die (neue oder bestehende) Aktivität zurück. Erneuter Aufruf für dieselbe
--  Session erzeugt KEINE zweite Activity (ON CONFLICT auf user_id,source,source_record_id).
-- ------------------------------------------------------------
create or replace function public.orvia_upsert_activity_from_session(
  p_session_id uuid,
  p_summary jsonb default '{}'::jsonb
)
returns public.activities
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sess public.workout_sessions;
  v_act  public.activities;
  v_seconds integer;
begin
  select * into v_sess
  from public.workout_sessions
  where id = p_session_id and user_id = auth.uid();
  if not found then
    raise exception 'workout_session_not_found';
  end if;

  -- Kanonische Sekunden: bevorzugt aus started/finished, sonst duration_min*60.
  v_seconds := case
    when v_sess.finished_at is not null and v_sess.started_at is not null
      then greatest(0, round(extract(epoch from (v_sess.finished_at - v_sess.started_at))
            - coalesce(v_sess.total_paused_seconds, 0)))::integer
    when v_sess.duration_min is not null then (v_sess.duration_min * 60)::integer
    else null
  end;

  insert into public.activities
    (user_id, sport_id, source, source_record_id, workout_session_id, local_date,
     started_at, ended_at, duration_seconds, status, summary)
  values
    (auth.uid(), coalesce(v_sess.sport_key, v_sess.sport), 'orvia_workout',
     v_sess.id::text, v_sess.id, v_sess.local_date,
     v_sess.started_at, v_sess.finished_at, v_seconds,
     case when v_sess.status = 'completed' then 'completed' else v_sess.status end,
     coalesce(p_summary, '{}'::jsonb))
  on conflict (user_id, source, source_record_id) where source_record_id is not null
  do update set
     sport_id = excluded.sport_id,
     workout_session_id = excluded.workout_session_id,
     local_date = excluded.local_date,
     started_at = excluded.started_at,
     ended_at = excluded.ended_at,
     duration_seconds = excluded.duration_seconds,
     status = excluded.status,
     summary = excluded.summary,
     updated_at = now()
  returning * into v_act;

  return v_act;
end $$;
