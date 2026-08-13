-- ============================================================
-- 0032 · engine_decision_log — Beleg fuer jede Engine-Entscheidung (Bauplan Stufe 0a)
-- ------------------------------------------------------------
-- WARUM: Die Engine trifft Entscheidungen, deren Begruendung heute nach dem
-- Rendern verloren ist. Gespeichert wird nur, WELCHER Plan herauskam, nicht
-- WARUM. Damit ist ein seltsamer Plan Wochen spaeter nicht mehr aufklaerbar,
-- eine Erklaerung gegenueber dem Nutzer nicht moeglich, und eine spaetere
-- Lernschicht haette keine Trainingsdaten. Historie ist im Gegensatz zu Code
-- nicht nachbaubar — deshalb steht diese Tabelle am Anfang und nicht am Ende.
--
-- ENTWURFSPRINZIP — APPEND-ONLY: Es gibt bewusst KEINE update- und KEINE
-- delete-Policy fuer `authenticated`. Ein Beleg, den der Client aendern kann,
-- ist kein Beleg. Korrekturen erfolgen ueber einen NEUEN Eintrag mit
-- supersedes_decision_id; die Kette bleibt damit vollstaendig.
--
-- GESUNDHEITSDATEN: inputs und constraints koennen Schmerzangaben enthalten.
-- Das ist dieselbe Kategorie wie die Check-in-Daten und wird genauso behandelt:
-- eigene Tabelle, RLS auf user_id, keine geraeteuebergreifende Aggregation,
-- keine Auswertung ueber Nutzer hinweg.
--
-- LAUFZEITVERSIONEN: versions/decision_runtime_hash halten fest, mit welchem
-- Codestand die Entscheidung fiel. Ohne das koennte ein alter Eingabesatz in
-- einer spaeteren Version andere Kandidaten erzeugen und faelschlich als
-- reproduziert gelten. Der Client verweigert die Rekonstruktion, wenn der
-- Hash abweicht.
--
-- Additiv: keine bestehende Tabelle wird veraendert. Rollback siehe unten.
-- ============================================================

create table if not exists public.engine_decision_log (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,

  -- Identitaet und Kette. decision_id kommt aus dem Client (injizierte
  -- ID-Fabrik), damit die Kette schon vor dem Schreiben konsistent ist.
  decision_id            text not null,
  parent_decision_id     text,
  supersedes_decision_id text,
  decision_type          text not null,
  week_id                text,
  plan_id                text,

  -- Zeitpunkt der ENTSCHEIDUNG (aus dem Client, injizierte Uhr) — nicht
  -- identisch mit dem Zeitpunkt des Schreibens (created_at). Bei Offline-
  -- Nachlieferung koennen die Tage auseinanderliegen.
  decided_at             timestamptz not null,

  -- Laufzeitstand
  versions               jsonb not null default '{}'::jsonb,
  decision_runtime_hash  text not null,
  decision_hash          text not null,

  -- Inhalt der Entscheidung
  inputs                 jsonb,
  derived_state          jsonb,
  candidates             jsonb,
  candidates_evaluated   integer not null default 0,
  candidates_truncated   integer not null default 0,
  selected               jsonb,
  rejected               jsonb,
  rules_triggered        text[] not null default '{}',
  constraints            jsonb,
  user_overrides         jsonb,
  resolved_from          text[],

  created_at             timestamptz not null default now(),

  -- Derselbe Eintrag darf nicht doppelt ankommen (Offline-Queue, Retry).
  unique (user_id, decision_id)
);

-- Nur bekannte Typen: ein Tippfehler waere sonst nicht von einem neuen,
-- absichtlich eingefuehrten Entscheidungstyp zu unterscheiden.
alter table public.engine_decision_log
  drop constraint if exists engine_decision_log_type_known;
alter table public.engine_decision_log
  add constraint engine_decision_log_type_known
  check (decision_type in ('week_design','policy_move','user_override',
    'opportunity_move','progression','variant_select','constraint_block','final_plan'));

create index if not exists engine_decision_log_user_idx
  on public.engine_decision_log (user_id, decided_at desc);
create index if not exists engine_decision_log_week_idx
  on public.engine_decision_log (user_id, week_id);
create index if not exists engine_decision_log_parent_idx
  on public.engine_decision_log (user_id, parent_decision_id);

-- ---- RLS ----------------------------------------------------
alter table public.engine_decision_log enable row level security;

-- LESEN: nur die eigenen Eintraege.
drop policy if exists engine_decision_log_select_own on public.engine_decision_log;
create policy engine_decision_log_select_own
  on public.engine_decision_log for select
  using (auth.uid() = user_id);

-- SCHREIBEN: nur eigene Eintraege anlegen.
drop policy if exists engine_decision_log_insert_own on public.engine_decision_log;
create policy engine_decision_log_insert_own
  on public.engine_decision_log for insert
  with check (auth.uid() = user_id);

-- AENDERN/LOESCHEN: bewusst KEINE Policy. Ohne update/delete-Policy blockiert
-- RLS jeden entsprechenden Versuch aus dem Client. Damit ist „append-only"
-- technisch garantiert und nicht bloss vereinbart — dieselbe Konstruktion wie
-- der fehlende Schreibpfad in 0031.

comment on table public.engine_decision_log is
  'Append-only Beleg jeder Engine-Entscheidung (Bauplan Stufe 0a). Enthaelt potenziell Gesundheitsdaten (Schmerzangaben in inputs/constraints) — RLS auf user_id, keine nutzeruebergreifende Auswertung. Korrekturen als NEUER Eintrag mit supersedes_decision_id, nie als Update.';

-- ---- Retention ----------------------------------------------
-- Ohne Aufraeumen waechst die Tabelle unbegrenzt. 24 Monate sind bewusst lang
-- gewaehlt: eine Trainingssaison plus Vorjahresvergleich. Manuell oder per
-- Scheduled Job auszufuehren.
create or replace function public.prune_engine_decision_log(keep_days integer default 730)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.engine_decision_log
   where decided_at < now() - make_interval(days => keep_days);
  get diagnostics n = row_count;
  return n;
end $$;

-- ============================================================
-- ROLLBACK (manuell ausfuehren, falls noetig):
--   drop function if exists public.prune_engine_decision_log(integer);
--   drop table if exists public.engine_decision_log;
-- Der Client faellt ohne Tabelle auf den lokalen Ringpuffer zurueck und meldet
-- stored:false — die Planung laeuft unveraendert weiter.
-- ============================================================
