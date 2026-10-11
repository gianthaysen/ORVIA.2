-- ============================================================
-- Rueckweg zu 0049 · Sportart-Normalisierung (Stand vor v8-447, aus 0009 uebernommen)
-- ------------------------------------------------------------
-- Stellt die Funktion public.orvia_norm_sport auf die 16 Sportarten von 0009 zurueck.
-- Aendert KEINE Daten. Vorher 0050 zuruecknehmen, falls eingespielt
-- (migrations_rollback/0050_sport_backfill_catalog_rollback.sql) — sonst tragen Zeilen
-- Sportarten, die die Funktion danach nicht mehr erzeugt (harmlos, aber uneinheitlich).
-- ============================================================
create or replace function public.orvia_norm_sport(p_raw text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(trim(coalesce(p_raw, '')))
    when 'gym' then 'gym' when 'krafttraining' then 'gym' when 'kraft' then 'gym'
      when 'strength' then 'gym' when 'strength training' then 'gym'
    -- Mobility ist EIGENE kanonische Sportart (NICHT gym): nie in Gym-Statistik/Muskelvolumen.
    when 'mobilität' then 'mobility' when 'mobilitaet' then 'mobility'
      when 'mobility' then 'mobility' when 'mobility training' then 'mobility'
    when 'running' then 'running' when 'laufen' then 'running' when 'lauf' then 'running' when 'run' then 'running'
    when 'cycling' then 'cycling' when 'rad' then 'cycling' when 'radfahren' then 'cycling'
      when 'radsport' then 'cycling' when 'bike' then 'cycling'
    when 'swimming' then 'swimming' when 'schwimmen' then 'swimming' when 'swim' then 'swimming'
    when 'padel' then 'padel' when 'paddel' then 'padel'
    when 'football' then 'football' when 'fußball' then 'football' when 'fussball' then 'football' when 'soccer' then 'football'
    when 'basketball' then 'basketball' when 'korbball' then 'basketball'
    when 'handball' then 'handball'
    when 'rowing' then 'rowing' when 'rudern' then 'rowing'
    when 'hiking' then 'hiking' when 'wandern' then 'hiking'
    when 'walking' then 'walking' when 'gehen' then 'walking' when 'spazieren' then 'walking'
    when 'athletics' then 'athletics' when 'leichtathletik' then 'athletics' when 'athletik' then 'athletics'
    when 'triathlon' then 'triathlon'
    when 'tennis' then 'tennis'
    when 'other' then 'other' when 'andere' then 'other' when 'sonstige' then 'other' when 'sonstiges' then 'other'
    else 'other'
  end;
$$;

revoke all on function public.orvia_norm_sport(text) from public;
revoke all on function public.orvia_norm_sport(text) from anon;
grant execute on function public.orvia_norm_sport(text) to authenticated;
