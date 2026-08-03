-- ============================================================
-- 0014 · user_constraints — Beschwerden als eigene Tabelle (P9, Entscheid E2:
-- KEIN JSONB). Neue Tabelle = rückwärtskompatibel; idempotent; manuell
-- ausführen VOR dem P9-Bündel-Deploy. RLS exakt nach dem 0002-Muster
-- (Owner-only, force RLS, anon revoked).
-- ============================================================
create table if not exists public.user_constraints (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  client_id           text not null,           -- kanonische Beschwerde-ID aus dem Client (normalizeConstraint)
  body_region         text,
  side                text,
  title               text,
  intensity           int,
  status              text not null default 'active',
  currently_trainable boolean not null default true,
  started_at          text,
  notes               text,
  triggers            text,
  avoid_movements     text,
  affected            text[] not null default '{}',
  section_updated_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists user_constraints_client_uniq on public.user_constraints (user_id, client_id);
create index if not exists user_constraints_user_idx on public.user_constraints (user_id);

alter table public.user_constraints drop constraint if exists uc_status;
alter table public.user_constraints add constraint uc_status check (status in ('active','improved','resolved','observed'));
alter table public.user_constraints drop constraint if exists uc_intensity;
alter table public.user_constraints add constraint uc_intensity check (intensity is null or (intensity >= 0 and intensity <= 10));

-- updated_at-Trigger (Funktion touch_updated_at existiert seit 0002)
drop trigger if exists user_constraints_touch on public.user_constraints;
create trigger user_constraints_touch before update on public.user_constraints
  for each row execute function public.touch_updated_at();

-- Grants + RLS (Owner-only, wie 0002)
revoke all on public.user_constraints from anon;
revoke all on public.user_constraints from public;
grant select, insert, update, delete on public.user_constraints to authenticated;
alter table public.user_constraints enable row level security;
alter table public.user_constraints force row level security;
drop policy if exists sel_own on public.user_constraints;
drop policy if exists ins_own on public.user_constraints;
drop policy if exists upd_own on public.user_constraints;
drop policy if exists del_own on public.user_constraints;
create policy sel_own on public.user_constraints for select to authenticated using (auth.uid() = user_id);
create policy ins_own on public.user_constraints for insert to authenticated with check (auth.uid() = user_id);
create policy upd_own on public.user_constraints for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy del_own on public.user_constraints for delete to authenticated using (auth.uid() = user_id);

comment on table public.user_constraints is 'P9: Beschwerden/Einschränkungen — Sektions-Zyklus (K1-LWW über section_updated_at)';
