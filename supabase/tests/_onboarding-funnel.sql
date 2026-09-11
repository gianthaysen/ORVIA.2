-- ORVIA · B-04 Auswertung des Onboarding-Schrittlogs   (NUR LESEZUGRIFFE)
-- Blockweise im Supabase-SQL-Editor ausfuehren. Abbrueche werden NICHT geraten:
-- ein Nutzer gilt als „haengen geblieben" an dem Schritt seines LETZTEN
-- Ereignisses, wenn er kein finish hat.

-- F1 · Trichter je Schritt: wie viele Nutzer betreten, schliessen ab, ueberspringen.
select step_id,
       count(distinct user_id) filter (where event_type = 'enter')    as betreten,
       count(distinct user_id) filter (where event_type = 'complete') as abgeschlossen,
       count(distinct user_id) filter (where event_type = 'skip')     as uebersprungen,
       round(avg(ms_on_step) filter (where event_type in ('complete','skip') and ms_on_step is not null) / 1000.0, 1) as sek_im_schritt
  from public.onboarding_step_log
 where app_version like 'orvia-v8-%'
 group by step_id
 order by min(occurred_at);

-- F2 · Haengengeblieben: letzter Schritt je Nutzer ohne finish.
with letzte as (
  select distinct on (user_id) user_id, step_id, event_type, occurred_at
    from public.onboarding_step_log
   where app_version like 'orvia-v8-%'
   order by user_id, occurred_at desc
)
select step_id as haengt_bei, count(*) as nutzer
  from letzte
 where user_id not in (select user_id from public.onboarding_step_log where event_type = 'finish')
 group by step_id
 order by nutzer desc;

-- F3 · Abschlussquote gesamt.
select count(distinct user_id) filter (where event_type = 'open')   as gestartet,
       count(distinct user_id) filter (where event_type = 'finish') as abgeschlossen,
       round(100.0 * count(distinct user_id) filter (where event_type = 'finish')
             / nullif(count(distinct user_id) filter (where event_type = 'open'), 0), 1) as quote_prozent
  from public.onboarding_step_log
 where app_version like 'orvia-v8-%';

-- F4 · Wiederaufnahmen (open mit resumed = true): Onboarding wurde unterbrochen und fortgesetzt.
select count(*) as wiederaufnahmen, count(distinct user_id) as nutzer
  from public.onboarding_step_log
 where event_type = 'open' and resumed and app_version like 'orvia-v8-%';
