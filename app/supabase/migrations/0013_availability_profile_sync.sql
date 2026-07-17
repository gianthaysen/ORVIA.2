-- ============================================================
-- 0013 · Availability-Zyklus + Sicherheits-Check-Feld (P9)
-- Rein ADDITIV, idempotent. Manuell im Supabase-SQL-Editor ausführen —
-- VOR dem Deploy des P9-Bündels (der Client sendet die neuen Spalten,
-- sobald Werte vorliegen; ohne 0013 schlagen die betroffenen Upserts
-- kontrolliert fehl und der Blob bleibt Quelle — kein Datenverlust).
-- weekly_availability: Kern je Wochentag (Slots-Details/fixedCommitments
-- bleiben bewusst Ebene B im Blob). Wochenlimits werden redundant auf
-- jeder Zeile gespeichert (Lesekonvention: Zeile weekday=0).
-- ============================================================
alter table public.weekly_availability add column if not exists rest_day           boolean;
alter table public.weekly_availability add column if not exists max_sessions_week  int;
alter table public.weekly_availability add column if not exists max_intense_week   int;
alter table public.weekly_availability add column if not exists min_rest_days      int;
alter table public.weekly_availability add column if not exists section_updated_at timestamptz;

comment on column public.weekly_availability.rest_day           is 'P9: expliziter Ruhetag (exklusiv zu available)';
comment on column public.weekly_availability.section_updated_at is 'Sektions-LWW (K1) für den availability-Zyklus';

-- Sicherheits-Check-Bestätigung wandert mit dem Profil (MAPPED-Feld).
alter table public.user_profiles add column if not exists constraints_acknowledged_at timestamptz;
comment on column public.user_profiles.constraints_acknowledged_at is 'P9: „keine Beschwerden" bestätigt am (Essential-Sicherheitsfrage)';
