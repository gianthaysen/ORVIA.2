-- ============================================================
-- 0011 · user_sports als Single Source of Truth (Phase 2B-①)
-- Rein ADDITIV, idempotent. Wird NICHT automatisch deployt —
-- vor dem Live-Test manuell in Supabase ausführen (wie 0002–0010).
-- Zweck:
--   * Trainingsstand (M5b/M7) cloud-fähig: sessions_per_week,
--     typical_duration_min
--   * custom_name für Katalog-Fremde ("Andere")
--   * client_role: verlustfreies App-Rollenvokabular
--     (primary/secondary/supplemental/occasional); die bestehende
--     role-Spalte (main/supplemental/occasional/club, CHECK us_role)
--     bleibt für Alt-Leser gemappt erhalten.
--   * section_updated_at: Sektions-LWW nach Konfliktregel K1
--     (Persistenz-ADR 2026-07-03). Tie-Break-Quelle bleibt das
--     server-seitige updated_at (touch_updated_at-Trigger, 0002/0003).
-- RLS: unverändert — bestehende Owner-Policies aus 0002 gelten,
-- da keine neue Tabelle entsteht.
-- ============================================================
alter table public.user_sports add column if not exists sessions_per_week   int;
alter table public.user_sports add column if not exists typical_duration_min int;
alter table public.user_sports add column if not exists custom_name          text;
alter table public.user_sports add column if not exists client_role          text;
alter table public.user_sports add column if not exists section_updated_at   timestamptz;

comment on column public.user_sports.sessions_per_week    is 'A3-Trainingsstand: Einheiten/Woche (kanonisch aus PROFILE.sports[].sessionsPerWeek)';
comment on column public.user_sports.typical_duration_min is 'A5: typische Einheitsdauer in Minuten (PROFILE.sports[].typicalDuration)';
comment on column public.user_sports.client_role          is 'App-Rollenvokabular primary|secondary|supplemental|occasional (verlustfrei); role bleibt Alt-Mapping';
comment on column public.user_sports.section_updated_at   is 'Client-Zeitstempel der sports-Sektion (_sectionMeta) für Sektions-LWW (K1); Serverzeit siehe updated_at';
