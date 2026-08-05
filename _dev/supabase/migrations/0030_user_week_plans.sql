-- ============================================================
-- 0030 · user_week_plans — kanonisches Wochenplan-Modell (Phase 5, Entscheidung ①b)
-- ------------------------------------------------------------
-- Baseline + Overrides + Historie je Nutzer und ISO-Woche (js/plan-domain.js).
-- Ersetzt LANGFRISTIG das konflatierte PROFILE.weekPlan-Feld (zwei Schreibquellen
-- ohne Unterscheidung — Engine-Anpassung ueberschrieb manuelle Overrides still).
-- Der Legacy-Blob bleibt bis Abschluss 5F als Fallback bestehen (kein Datenverlust,
-- Rollback jederzeit). Additiv: keine bestehende Tabelle/Spalte wird veraendert.
--
-- Eine Zeile = ein Nutzer + eine ISO-Woche ('2026-W32'). revision zaehlt
-- Baseline-Revisionen (Engine-Rebase); Overrides aendern die revision NICHT.
-- History ist im Domain-Modul auf 50 Eintraege gedeckelt; die DB-Guards sichern
-- nur Grundform und Groesse (kein stilles Wachstum ohne Limit).
-- ============================================================

create table if not exists public.user_week_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  week_key     text not null,                            -- ISO-Woche, z. B. '2026-W32'
  plan_id      text not null,                            -- Domain-ID (wp:<weekKey> o. ae.)
  revision     int  not null default 1,
  baseline     jsonb not null,                           -- { source, engineVersion, generatedAt, snapshotId, sessions[] }
  overrides    jsonb not null default '[]'::jsonb,       -- [ { overrideId, sessionId, type, ..., reason, createdAt } ]
  pending_conflicts jsonb not null default '[]'::jsonb,  -- Rebase-Konflikte (Badge-UX, Entscheidung ②)
  history      jsonb not null default '[]'::jsonb,       -- [ { revision, at, reason, detail } ]
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, week_key),
  constraint uwp_week_key_form check (week_key ~ '^\d{4}-W\d{2}$'),
  constraint uwp_revision_min check (revision >= 1),
  constraint uwp_baseline_obj check (jsonb_typeof(baseline) = 'object'),
  constraint uwp_overrides_arr check (jsonb_typeof(overrides) = 'array'),
  constraint uwp_conflicts_arr check (jsonb_typeof(pending_conflicts) = 'array'),
  constraint uwp_history_arr check (jsonb_typeof(history) = 'array'),
  -- Groessen-Guards: Fehler statt stilles Kuerzen (gleiches Prinzip wie 0029).
  constraint uwp_overrides_bounded check (jsonb_array_length(overrides) <= 200),
  constraint uwp_history_bounded check (jsonb_array_length(history) <= 60)
);

create index if not exists uwp_user_week_idx
  on public.user_week_plans (user_id, week_key desc);

alter table public.user_week_plans enable row level security;
drop policy if exists sel_own on public.user_week_plans;
create policy sel_own on public.user_week_plans for select to authenticated using (auth.uid() = user_id);
drop policy if exists ins_own on public.user_week_plans;
create policy ins_own on public.user_week_plans for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists upd_own on public.user_week_plans;
create policy upd_own on public.user_week_plans for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists del_own on public.user_week_plans;
create policy del_own on public.user_week_plans for delete to authenticated using (auth.uid() = user_id);

comment on table public.user_week_plans is
  'Phase 5 (2026-08-05): kanonischer Wochenplan — Baseline (Engine/manuell) + Nutzer-Overrides + Historie je ISO-Woche. Domain-Logik: js/plan-domain.js. Engine-Baseline und Nutzer-Overrides ueberschreiben einander nie.';
