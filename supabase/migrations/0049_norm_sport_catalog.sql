-- ============================================================
-- 0049 · Sportart-Normalisierung auf dem Server = Katalog (24 Sportarten)
-- ------------------------------------------------------------
-- Befund (v8-447): orvia_norm_sport kannte 16 Sportarten. Acht Katalog-Sportarten
-- (volleyball, hockey, rugby, badminton, golf, climbing, yoga, hyrox) wurden beim
-- Abschluss eines ORVIA-Workouts als 'other' gespeichert; der Rohwert steht seitdem
-- in metrics.source_sport_raw.
--
-- Diese Migration ersetzt NUR die Funktion (immutable, rein). Sie ist deckungsgleich
-- mit app/js/training-domain.js SPORT_ALIASES (Test: data_integrity_v447_test, Abschnitt B).
--
-- OPTIONAL: Die App braucht diese Migration nicht — sie liest 'other' + erhaltenen
-- Rohtyp bereits als die richtige Sportart (activityNormalize.upgradeSport). Die
-- Migration sorgt dafuer, dass auch die SPALTE sport_id fuer neue Workouts stimmt.
-- Idempotent (create or replace).
-- ============================================================

create or replace function public.orvia_norm_sport(p_raw text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(trim(coalesce(p_raw, '')))
    when 'gym' then 'gym' when 'krafttraining' then 'gym' when 'kraft' then 'gym' when 'strength' then 'gym' when 'strength training' then 'gym' when 'traditional_strength_training' then 'gym'
    when 'mobilität' then 'mobility' when 'mobilitaet' then 'mobility' when 'mobility' then 'mobility' when 'mobility training' then 'mobility'
    when 'laufen' then 'running' when 'lauf' then 'running' when 'run' then 'running' when 'running' then 'running'
    when 'rad' then 'cycling' when 'radsport' then 'cycling' when 'radfahren' then 'cycling' when 'bike' then 'cycling' when 'cycling' then 'cycling' when 'ride' then 'cycling'
    when 'schwimmen' then 'swimming' when 'swim' then 'swimming' when 'swimming' then 'swimming'
    when 'fußball' then 'football' when 'fussball' then 'football' when 'football' then 'football' when 'soccer' then 'football'
    when 'handball' then 'handball'
    when 'padel' then 'padel' when 'paddel' then 'padel'
    when 'tennis' then 'tennis'
    when 'triathlon' then 'triathlon'
    when 'athletics' then 'athletics' when 'leichtathletik' then 'athletics' when 'athletik' then 'athletics'
    when 'basketball' then 'basketball' when 'korbball' then 'basketball'
    when 'rudern' then 'rowing' when 'rowing' then 'rowing'
    when 'wandern' then 'hiking' when 'hiking' then 'hiking'
    when 'gehen' then 'walking' when 'walking' then 'walking' when 'spazieren' then 'walking'
    when 'volleyball' then 'volleyball' when 'beachvolleyball' then 'volleyball'
    when 'hockey' then 'hockey' when 'feldhockey' then 'hockey'
    when 'rugby' then 'rugby'
    when 'badminton' then 'badminton' when 'federball' then 'badminton'
    when 'golf' then 'golf'
    when 'climbing' then 'climbing' when 'klettern' then 'climbing' when 'bouldern' then 'climbing' when 'bouldering' then 'climbing' when 'rock_climbing' then 'climbing' when 'indoor_climbing' then 'climbing'
    when 'yoga' then 'yoga'
    when 'hyrox' then 'hyrox'
    when 'andere' then 'other' when 'sonstige' then 'other' when 'sonstiges' then 'other' when 'other' then 'other'
    else 'other'
  end;
$$;
revoke all on function public.orvia_norm_sport(text) from public;
revoke all on function public.orvia_norm_sport(text) from anon;
grant execute on function public.orvia_norm_sport(text) to authenticated;

-- ------------------------------------------------------------
-- OPTIONAL, NICHT Teil der Migration — bewusst auskommentiert:
-- Bestehende Zeilen, die NUR wegen der fehlenden Zuordnung 'other' tragen, auf ihre
-- Sportart setzen. Umkehrbar, weil der Rohtyp in metrics erhalten bleibt.
--
--   update public.activities
--      set sport_id = public.orvia_norm_sport(metrics->>'source_sport_raw'), updated_at = now()
--    where sport_id = 'other'
--      and metrics ? 'source_sport_raw'
--      and public.orvia_norm_sport(metrics->>'source_sport_raw') <> 'other';
-- ------------------------------------------------------------
