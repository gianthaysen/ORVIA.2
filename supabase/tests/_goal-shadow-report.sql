-- ORVIA · A-06 Auswertung des Ziel-Shadow-Logs   (NUR LESEZUGRIFFE)
-- Beantwortet Gate A, Kriterium 4: laeuft das Log >= 14 Tage ohne Schreibfehler,
-- und widersprechen sich mainGoalOf() und goalOf()?
-- Blockweise im Supabase-SQL-Editor ausfuehren.

-- R1 · Laufzeit und Umfang. Erst wenn `tage_abgedeckt` >= 14 ist, ist die
-- Frage ueberhaupt beantwortbar. Ein Log mit drei Eintraegen an einem Tag
-- belegt nichts.
select count(*)                                             as ereignisse,
       min(occurred_at)                                     as erstes,
       max(occurred_at)                                     as letztes,
       (max(occurred_at)::date - min(occurred_at)::date)     as tage_abgedeckt,
       count(*) filter (where contradiction)                as widersprueche,
       round(100.0 * count(*) filter (where contradiction) / nullif(count(*),0), 1) as quote_prozent
  from public.goal_shadow_log;

-- R2 · Nach Ereignistyp. Fehlt hier ein Typ vollstaendig, wurde er im
-- Zeitraum nicht ausgeloest — das ist eine Luecke im BELEG, kein Beweis
-- fuer Fehlerfreiheit.
select event_type, count(*) as anzahl,
       count(*) filter (where contradiction) as widersprueche
  from public.goal_shadow_log
 group by event_type
 order by anzahl desc;

-- R3 · WORIN sie sich unterscheiden. Das ist die eigentliche Erkenntnis fuer
-- B-01: 'identity' heisst, die beiden Lesarten meinen verschiedene Ziele;
-- 'targetMin' heisst, sie meinen dasselbe Ziel mit verschiedenen Werten.
select feld, count(*) as anzahl
  from public.goal_shadow_log, unnest(contradiction_fields) as feld
 group by feld
 order by anzahl desc;

-- R4 · Die Widersprueche im Einzelnen, neueste zuerst.
select occurred_at, event_type, contradiction_fields, active_goal_count,
       main_goal->>'id'        as hauptziel_id,
       main_goal->>'category'  as hauptziel_kategorie,
       legacy_goal->>'_canonicalId' as bestand_id,
       legacy_goal->>'type'    as bestand_typ,
       app_version
  from public.goal_shadow_log
 where contradiction
 order by occurred_at desc
 limit 50;

-- R5 · Plausibilitaet des Logs selbst. Jede zurueckgegebene Zeile ist ein
-- Befund AM LOG, nicht an den Zielen — ein Log, das man nicht pruefen kann,
-- ist kein Beleg.
select 'occurred_at in der Zukunft' as befund, count(*) as zeilen
  from public.goal_shadow_log where occurred_at > now() + interval '1 hour'
union all
select 'Eintrag ohne Hauptziel UND ohne Bestand', count(*)
  from public.goal_shadow_log where main_goal is null and legacy_goal is null
union all
select 'Widerspruch gesetzt, aber keine Felder benannt', count(*)
  from public.goal_shadow_log where contradiction and cardinality(contradiction_fields) = 0
union all
select 'Felder benannt, aber Widerspruch nicht gesetzt', count(*)
  from public.goal_shadow_log where not contradiction and cardinality(contradiction_fields) > 0
union all
select 'ohne App-Version (Zuordnung zum Code unmoeglich)', count(*)
  from public.goal_shadow_log where app_version is null;
