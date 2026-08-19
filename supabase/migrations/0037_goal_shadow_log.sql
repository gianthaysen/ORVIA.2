-- ============================================================
-- 0037 · goal_shadow_log — A-06, Teil 1 des Ziel-SSOT
-- ------------------------------------------------------------
-- WOFUER. Band 1, A-06: Bevor die Planlogik auf das Zielobjekt umgestellt wird
-- (B-01), soll ueber mindestens zwei Wochen belegt werden, dass die kanonische
-- Lesart `mainGoalOf()` und der Bestand `goalOf()` dasselbe Hauptziel meinen.
-- Gate A, Kriterium 4 verlangt genau das: Shadow-Log laeuft >= 14 Tage ohne
-- Schreibfehler.
--
-- BEOBACHTER, NIE BETEILIGTER. Diese Tabelle darf kein Verhalten aendern. Ein
-- fehlgeschlagener Insert bricht kein Zielereignis ab; der Client zaehlt ihn und
-- speichert das Ziel trotzdem. Dieselbe Regel wie in 0032 (engine_decision_log).
--
-- WARUM EINE EIGENE TABELLE UND NICHT engine_decision_log. Dessen
-- CHECK-Bedingung laesst genau acht ENGINE-Entscheidungstypen zu, mit der
-- ausdruecklichen Begruendung, dass ein Tippfehler sonst nicht von einem neuen
-- Typ zu unterscheiden waere. Zielereignisse sind keine Engine-Entscheidungen:
-- sie haben keine Kandidaten, keine Regeln, keinen Laufzeit-Hash. Sie dort
-- einzumischen wuerde ausserdem A-12 (Engine-v2-Auswertung) zwingen, sie wieder
-- herauszufiltern.
--
-- UNVERAENDERLICH. Es gibt bewusst KEINE update- und KEINE delete-Policy, und
-- `authenticated` bekommt auch auf Rechteebene nur select und insert. Ein Log,
-- das man aendern kann, ist kein Beleg, sondern eine Meinung.
--
-- ANON. Supabase vergibt fuer neu angelegte Tabellen per default privileges
-- Rechte an `anon`. 0036 hat diese Rechte projektweit entzogen — fuer DIESE neue
-- Tabelle muss das ausdruecklich wiederholt werden, sonst entsteht die Luecke neu.
-- ============================================================

begin;

create table if not exists public.goal_shadow_log (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,

  -- Idempotenz: derselbe Eintrag darf ueber Offline-Queue/Retry nicht doppelt
  -- ankommen. Die ID kommt aus dem Client, damit sie schon vor dem Schreiben feststeht.
  event_id             text not null,
  event_type           text not null,

  -- Zeitpunkt des EREIGNISSES (Client-Uhr) — nicht identisch mit created_at.
  occurred_at          timestamptz not null,

  -- Das Hauptziel nach mainGoalOf() unmittelbar nach dem Ereignis.
  -- NULL ist ein gueltiger Wert: "kein aktives Ziel" ist eine Aussage,
  -- kein fehlender Wert. Datenluecke != Wert.
  main_goal            jsonb,
  -- Was der Bestand (goalOf()) zum selben Zeitpunkt geliefert haette.
  legacy_goal          jsonb,

  -- Der eigentliche Messwert: laufen beide auseinander?
  contradiction        boolean not null default false,
  contradiction_fields text[] not null default '{}',

  active_goal_count    integer not null default 0,
  app_version          text,

  created_at           timestamptz not null default now(),

  unique (user_id, event_id)
);

-- Nur bekannte Ereignistypen — dieselbe Disziplin wie in 0032.
alter table public.goal_shadow_log
  drop constraint if exists goal_shadow_log_type_known;
alter table public.goal_shadow_log
  add constraint goal_shadow_log_type_known
  check (event_type in ('add','update','remove','status'));

create index if not exists goal_shadow_log_user_time_idx
  on public.goal_shadow_log (user_id, occurred_at desc);

alter table public.goal_shadow_log enable row level security;

drop policy if exists goal_shadow_log_sel_own on public.goal_shadow_log;
create policy goal_shadow_log_sel_own on public.goal_shadow_log
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists goal_shadow_log_ins_own on public.goal_shadow_log;
create policy goal_shadow_log_ins_own on public.goal_shadow_log
  for insert to authenticated with check (auth.uid() = user_id);

-- KEINE update-/delete-Policy: Unveraenderlichkeit ist Absicht.
-- Zusaetzlich auf Rechteebene, damit es nicht an einer Policy allein haengt:
revoke all on public.goal_shadow_log from anon;
revoke all on public.goal_shadow_log from authenticated;
grant select, insert on public.goal_shadow_log to authenticated;

commit;
