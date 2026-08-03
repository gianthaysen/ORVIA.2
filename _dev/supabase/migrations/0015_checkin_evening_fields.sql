-- ============================================================
-- 0015 · daily_checkins: Abend-Check-in-Kernfelder (H3, E3 geschlossen)
-- Rein ADDITIV, idempotent. Manuell VOR dem nächsten Bündel-Deploy ausführen.
-- checkin_type 'evening' ist seit 0002 in der CHECK-Whitelist — es fehlten nur
-- die Spalten für Energie und Notiz. Der Client sendet beide NUR, wenn belegt
-- (kompatibel mit Instanzen ohne 0015; ohne 0015 schlägt nur der evening-Persist
-- kontrolliert fehl, der Blob bleibt Quelle). Ernährungsfelder (Protein/Carbs/
-- Flüssigkeit) bleiben BEWUSST Blob — künftiges Nutrition-Modul.
-- ============================================================
alter table public.daily_checkins add column if not exists energy int;
alter table public.daily_checkins add column if not exists note   text;

alter table public.daily_checkins drop constraint if exists dc_energy;
alter table public.daily_checkins add constraint dc_energy check (energy is null or (energy >= 0 and energy <= 10));

comment on column public.daily_checkins.energy is 'H3: Energie 0–10 (primär Abend-Check-in)';
comment on column public.daily_checkins.note   is 'H3: freie Tagesnotiz (primär Abend-Check-in)';
