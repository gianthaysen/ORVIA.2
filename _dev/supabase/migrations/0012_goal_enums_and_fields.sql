-- ============================================================
-- 0012 · user_goals: Enum-Erweiterung + strukturierte Zielmetrik (P5)
-- Rein ADDITIV/erweiternd, idempotent. Wird NICHT automatisch deployt —
-- manuell im Supabase-SQL-Editor ausführen, SPÄTESTENS vor dem
-- Goals-Cloud-Zyklus (P9). Ohne 0012 funktioniert der Bestand weiter
-- (der Client sendet die neuen Spalten nur, wenn belegt).
-- Hintergrund (Audit 2026-07-09): Das kanonische Zielmodell kennt
-- 4 Rollen (main/secondary/maintain/longterm → priority 1..4) und
-- 5 Status (active/paused/achieved/abandoned/archived) — der alte
-- CHECK ug_enums erlaubte nur 3/3 und hätte Upserts abgelehnt.
-- CHECK-ERWEITERUNG ist rückwärtskompatibel (alle Altwerte bleiben gültig).
-- ============================================================
alter table public.user_goals drop constraint if exists ug_enums;
alter table public.user_goals add constraint ug_enums check (
  (priority in ('primary','secondary','optional','maintain','longterm'))
  and (status in ('active','paused','completed','achieved','abandoned','archived')));

alter table public.user_goals add column if not exists metric_type        text;
alter table public.user_goals add column if not exists current_value      numeric;
alter table public.user_goals add column if not exists description        text;
alter table public.user_goals add column if not exists section_updated_at timestamptz;

alter table public.user_goals drop constraint if exists ug_metric_type;
alter table public.user_goals add constraint ug_metric_type check (
  metric_type is null or metric_type in ('time','distance','pace','weight','power','percent','count'));

comment on column public.user_goals.metric_type        is 'P5: Zielmetrik; time ⇒ target_value/current_value in Sekunden';
comment on column public.user_goals.current_value      is 'P5: aktueller Messwert zur Zielmetrik';
comment on column public.user_goals.section_updated_at is 'Sektions-LWW (K1) für den Goals-Cloud-Zyklus (P9)';
