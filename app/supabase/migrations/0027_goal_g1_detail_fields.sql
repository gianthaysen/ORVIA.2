-- ============================================================
-- 0027 · user_goals: Goal-G1-Detailfelder (Zweitgeräte-Sync)
-- Rein ADDITIV/erweiternd, idempotent. Wird NICHT automatisch deployt —
-- manuell im Supabase-SQL-Editor ausführen.
--
-- MIGRATIONSREIHENFOLGE (verbindlich, seit Goal-G1c):
-- 0027 MUSS live gelaufen sein, BEVOR ein Client mit dem G1c-Stand von
-- goalRepository.js/profile-store.js deployt wird. Anders als bei 0012
-- ist dies ab G1c KEINE optionale "falls belegt"-Erweiterung mehr: der
-- G1c-Client sendet die sechs Detailfelder in JEDEM Goals-Upsert IMMER mit
-- einem klaren Wert (auch leer/NULL), damit bewusstes Löschen/Leeren
-- (Motivation entfernt, Meilenstein gelöscht, categoryData zurückgesetzt)
-- tatsächlich in der Cloud ankommt statt dort stehen zu bleiben. Läuft
-- dieser Client gegen eine Instanz OHNE 0027, schlägt jeder Goals-Upsert
-- mit "unknown column" fehl. Ein G1b-Client (nur-wenn-belegt) verträgt
-- fehlende Spalten weiterhin unschädlich, sendet aber keine Löschungen.
--
-- Hintergrund (Goal-G1): Diese sechs Ziel-Detailfelder blieben zunächst nur
-- lokal in PROFILE.goals und gingen auf einem Zweitgerät beim Cloud-Hydrate
-- verloren, weil user_goals keine Spalten dafür hatte. CHECK-Erweiterung und
-- alle add-column sind rückwärtskompatibel (Bestandszeilen erhalten Default/NULL).
-- ============================================================
alter table public.user_goals add column if not exists time_horizon    text;
alter table public.user_goals add column if not exists custom_category text;
alter table public.user_goals add column if not exists motivation      text;
alter table public.user_goals add column if not exists sports          text[] default '{}'::text[];
alter table public.user_goals add column if not exists category_data   jsonb  default '{}'::jsonb;
alter table public.user_goals add column if not exists milestones      jsonb  default '[]'::jsonb;

-- time_horizon nur die vier kanonischen Werte oder NULL (rückwärtskompatibel: NULL erlaubt).
alter table public.user_goals drop constraint if exists ug_time_horizon;
alter table public.user_goals add constraint ug_time_horizon check (
  time_horizon is null or time_horizon in ('short','mid','long','open'));

comment on column public.user_goals.time_horizon    is 'Goal-G1: Zeithorizont des Ziels (short|mid|long|open).';
comment on column public.user_goals.custom_category is 'Goal-G1: freie Kategorie-Bezeichnung bei category=custom.';
comment on column public.user_goals.motivation      is 'Goal-G1: Motivationstext des Nutzers zum Ziel.';
comment on column public.user_goals.sports          is 'Goal-G1: betroffene Sportart-IDs (kanonische IDs).';
comment on column public.user_goals.category_data   is 'Goal-G1: kategorie-spezifische Detailfelder (variabel je Zielart); bewusst jsonb statt Einzelspalten.';
comment on column public.user_goals.milestones      is 'Goal-G1: Meilensteine als jsonb-Array (in G1 bewusst NICHT in Kindtabelle normalisiert).';
