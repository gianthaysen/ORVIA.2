-- ============================================================
-- 0031 · user_feature_flags — serverseitiger Schaltkanal (Phase 8.4, Canary-Gate)
-- ------------------------------------------------------------
-- WARUM: Das Canary-Gate verlangt „Feature Flag SERVERSEITIG deaktivierbar".
-- Ohne einen solchen Kanal waere diese Zusage eine Behauptung: ein Flag im
-- localStorage laesst sich aus der Ferne weder pruefen noch abschalten. Genau
-- deshalb war 8.4 im Umsetzungsplan als blockiert vermerkt.
--
-- ENTWURFSPRINZIP — fail-closed: Es gibt KEINE Zeile fuer den Normalfall. Fehlt
-- der Eintrag, ist das Feature AUS. Ein Ausfall der Abfrage, ein Netzwerkfehler
-- oder eine geloeschte Zeile fuehren damit immer in den sicheren Zustand, nie in
-- eine unbeabsichtigte Aktivierung.
--
-- ABSCHALTBARKEIT IST DER ZWECK: Der Nutzer darf seine eigenen Flags LESEN, aber
-- nicht setzen. Schreibrechte hat ausschliesslich die service_role (Admin/Worker).
-- Koennte der Client selbst aktivieren, waere die serverseitige Kontrolle wertlos.
--
-- Additiv: keine bestehende Tabelle wird veraendert. Rollback siehe unten.
-- ============================================================

create table if not exists public.user_feature_flags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  flag        text not null,                         -- z. B. 'engine_v2_plan'
  enabled     boolean not null default false,
  -- Grund und Herkunft der Schaltung: bei einem Canary-Rollout muss nachvollziehbar
  -- bleiben, WER wann warum aktiviert hat. Ohne das ist ein Rollback nicht auditierbar.
  reason      text,
  cohort      text,                                  -- optionale Kohorten-Kennung
  set_by      text,                                  -- 'admin' | 'worker' | 'migration'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, flag)
);

-- Nur bekannte Flagnamen: verhindert Tippfehler, die still zu „Feature aus" fuehren
-- (ein Tippfehler waere sonst ununterscheidbar von „bewusst nicht aktiviert").
alter table public.user_feature_flags
  drop constraint if exists user_feature_flags_flag_known;
alter table public.user_feature_flags
  add constraint user_feature_flags_flag_known
  check (flag in ('engine_v2_plan', 'engine_v2_readiness', 'canary_diagnostics'));

create index if not exists user_feature_flags_user_idx on public.user_feature_flags (user_id);
create index if not exists user_feature_flags_flag_idx on public.user_feature_flags (flag) where enabled;

-- updated_at automatisch mitfuehren (gleiche Konvention wie 0030).
create or replace function public.touch_user_feature_flags()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_user_feature_flags on public.user_feature_flags;
create trigger trg_touch_user_feature_flags
  before update on public.user_feature_flags
  for each row execute function public.touch_user_feature_flags();

-- ---- RLS ----------------------------------------------------
alter table public.user_feature_flags enable row level security;

-- LESEN: nur die eigenen Flags.
drop policy if exists user_feature_flags_select_own on public.user_feature_flags;
create policy user_feature_flags_select_own
  on public.user_feature_flags for select
  using (auth.uid() = user_id);

-- SCHREIBEN: bewusst KEINE Policy fuer authenticated. Ohne insert/update/delete-Policy
-- ist jeder Schreibversuch aus dem Client durch RLS blockiert; die service_role
-- umgeht RLS ohnehin. Damit ist „serverseitig deaktivierbar" technisch garantiert
-- und nicht bloss vereinbart.

comment on table public.user_feature_flags is
  'Serverseitiger Schaltkanal fuer den Canary-Rollout (Phase 8.4). Fehlende Zeile = Feature AUS (fail-closed). Client darf nur lesen; Schreibrechte ausschliesslich service_role.';

-- ============================================================
-- ROLLBACK (manuell ausfuehren, falls noetig):
--   drop trigger if exists trg_touch_user_feature_flags on public.user_feature_flags;
--   drop function if exists public.touch_user_feature_flags();
--   drop table if exists public.user_feature_flags;
-- Der Client faellt ohne Tabelle automatisch auf „Feature AUS" zurueck.
-- ============================================================
