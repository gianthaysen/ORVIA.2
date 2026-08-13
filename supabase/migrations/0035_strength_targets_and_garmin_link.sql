-- ============================================================
-- 0035 · Kraft-Zielwerte + Garmin-Identitaetskette  (Kraftplan v2, Baustein K1)
-- ------------------------------------------------------------
-- ZWECK
-- Das Modell konnte bisher KEINE Lastvorgabe tragen: `training_plan_exercises`
-- und `workout_exercises` kennen `planned_sets/min_reps/max_reps/target_rir/
-- target_rpe/rest_seconds` — aber kein Gewicht (Audit 2026-08-12, Punkt 3:
-- repo-weit kein target_weight/planned_weight auf Satz- oder Uebungsebene;
-- `targetWeightKg` in js/nutrition.js ist KOERPERgewicht, `targetLoad` in
-- js/engine/progression.js ist systemische Tageslast — beides etwas anderes).
-- Ohne dieses Feld kann weder ein Kraftplan „4 x 6-8 @ 80 kg" gespeichert noch
-- ein Garmin-Workout mit Zielgewicht erzeugt werden.
--
-- Zweitens fehlte jede persistente Verbindung zwischen einer ORVIA-Plan-
-- Occurrence, einem an Garmin uebertragenen Workout und der spaeter
-- zurueckkommenden Garmin-Aktivitaet. Ohne diese Kette bliebe der Rueckkanal
-- auf Datum-/Titel-/Namensaehnlichkeit angewiesen — genau die Heuristik, die
-- der Plan (§4 A5, §8 R7) ausdruecklich verbietet.
--
-- ADDITIV. Keine bestehende Spalte wird geaendert oder entfernt, kein
-- bestehender Schreibpfad bricht: alle neuen Spalten sind nullable oder haben
-- einen Default, der das bisherige Verhalten exakt abbildet (source='manual').
--
-- ANNAHMEN [A] (bewusst gesetzt, keine Messung):
--   [A1] Zielgewicht 0..500 kg. 0 ist erlaubt und bedeutet ausdruecklich
--        „ohne Zusatzlast" (Koerpergewichtsuebung). Negative Werte sind
--        VERBOTEN — assistierte Uebungen (negative Zusatzlast) sind im MVP
--        nicht modelliert (Plan §12) und sollen nicht still durchrutschen.
--   [A2] Obergrenze 500 kg ist ein Tippfehler-Riegel, keine Leistungsaussage.
--   [A3] `recognition_probability` ist 0..1, weil Garmin die Uebungserkennung
--        als Wahrscheinlichkeit liefert (`probability` im exerciseSets-Feed).
-- ============================================================

-- ============================================================
--  A) Zielgewicht — geplante Uebung (Plan) und Session-Uebung (Ist-Vorgabe)
-- ============================================================
-- Bewusst BEIDE Tabellen: `training_plan_exercises` traegt die Planvorgabe,
-- `workout_exercises` die in die konkrete Einheit uebernommene Vorgabe. Ohne
-- die zweite Spalte ginge die Vorgabe beim Sessionstart verloren und der
-- Soll-Ist-Vergleich (K7) haette auf der Ist-Seite keine Referenz.
alter table public.training_plan_exercises
  add column if not exists target_weight_kg numeric;
alter table public.workout_exercises
  add column if not exists target_weight_kg numeric;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tpe_target_weight_range') then
    alter table public.training_plan_exercises
      add constraint tpe_target_weight_range
      check (target_weight_kg is null or (target_weight_kg >= 0 and target_weight_kg <= 500));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'we_target_weight_range') then
    alter table public.workout_exercises
      add constraint we_target_weight_range
      check (target_weight_kg is null or (target_weight_kg >= 0 and target_weight_kg <= 500));
  end if;
end $$;

comment on column public.training_plan_exercises.target_weight_kg is
  'K1 (2026-08-12): absolutes Zielgewicht in kg fuer diese geplante Uebung. NULL = keine Lastvorgabe. 0 = ausdruecklich ohne Zusatzlast. Prozentuale Zielgewichte sind im MVP bewusst NICHT modelliert (Plan §4 A1).';
comment on column public.workout_exercises.target_weight_kg is
  'K1 (2026-08-12): die beim Sessionstart uebernommene Lastvorgabe. Referenz fuer den Soll-Ist-Vergleich (K7).';

-- ============================================================
--  B) workout_sets — Satztyp kontrollieren
-- ============================================================
-- Bis hier existierte die Satztyp-Liste NUR im Client (js/training-domain.js:75
-- SET_TYPES, gespiegelt in js/workout-ui.js:10 SET_TYPE_DE). Die Datenbank nahm
-- jede Zeichenkette an. Ein importierter Garmin-Satz mit einem unbekannten Typ
-- waere unbemerkt gelandet.
--
-- NOT VALID ist hier ABSICHT und kein Versehen: neue und geaenderte Zeilen
-- werden ab sofort geprueft, historische Zeilen werden NICHT rueckwirkend
-- abgelehnt. Der Plan verlangt genau das („Constraints zunaechst kompatibel
-- ausrollen", K1/Migration). Eine spaetere `validate constraint` kann folgen,
-- sobald der Altbestand inventarisiert ist — dafuer ist ein Blick in die
-- Produktionsdaten noetig, den diese Migration bewusst nicht vortaeuscht.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'workout_sets_set_type_check') then
    alter table public.workout_sets
      add constraint workout_sets_set_type_check
      check (set_type in ('warmup','working','top_set','backoff','dropset',
                          'rest_pause','myo_reps','amrap','technique','test'))
      not valid;
  end if;
end $$;

-- ============================================================
--  C) workout_sets — Herkunft, Pruefstatus, Importidentitaet
-- ============================================================
-- Plan §1.3/§4 A4: `source='garmin_import'` allein genuegt NICHT. Jeder
-- importierte Satz braucht eine stabile externe Identitaet (Duplikatschutz bei
-- wiederholtem Sync), einen ausdruecklichen Pruefstatus (nur bestaetigte Saetze
-- zaehlen zur Trainingslast) und die Rohwerte der Uhr (Nachvollziehbarkeit
-- auch nach einer Korrektur).
alter table public.workout_sets
  add column if not exists source                    text not null default 'manual',
  add column if not exists import_status             text,
  add column if not exists external_set_key          text,
  add column if not exists wkt_step_index            integer,
  add column if not exists garmin_category_raw       text,
  add column if not exists garmin_exercise_name_raw  text,
  add column if not exists recognition_probability   numeric,
  add column if not exists imported_at               timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ws_source_known') then
    alter table public.workout_sets add constraint ws_source_known
      check (source in ('manual','garmin_import'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ws_import_status_known') then
    alter table public.workout_sets add constraint ws_import_status_known
      check (import_status is null or import_status in
             ('pending','confirmed','rejected','conflict','unresolved'));
  end if;
  -- Herkunft und Pruefstatus muessen zusammenpassen. Ein manueller Satz hat
  -- keinen Importstatus; ein importierter Satz MUSS einen haben — sonst waere
  -- unklar, ob er in die Trainingslast zaehlt, und „unklar" wuerde in der
  -- Auswertung erfahrungsgemaess als „ja" behandelt.
  if not exists (select 1 from pg_constraint where conname = 'ws_source_status_consistent') then
    alter table public.workout_sets add constraint ws_source_status_consistent
      check ((source = 'manual'        and import_status is null)
          or (source = 'garmin_import' and import_status is not null));
  end if;
  -- Eine externe Satzidentitaet ergibt nur fuer importierte Saetze einen Sinn.
  if not exists (select 1 from pg_constraint where conname = 'ws_external_key_only_import') then
    alter table public.workout_sets add constraint ws_external_key_only_import
      check (external_set_key is null or source = 'garmin_import');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ws_recognition_range') then
    alter table public.workout_sets add constraint ws_recognition_range
      check (recognition_probability is null
             or (recognition_probability >= 0 and recognition_probability <= 1));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ws_wkt_step_index_range') then
    alter table public.workout_sets add constraint ws_wkt_step_index_range
      check (wkt_step_index is null or wkt_step_index >= 0);
  end if;
end $$;

-- Duplikatschutz beim wiederholten Sync: derselbe Garmin-Satz darf pro Nutzer
-- nur EINMAL existieren. Erneuter Sync aktualisiert dieselbe Zeile, statt eine
-- zweite anzulegen (Plan §1.3, K6-DoD).
create unique index if not exists workout_sets_external_uniq
  on public.workout_sets (user_id, external_set_key)
  where external_set_key is not null;

-- Nachschlagen offener Importvorschlaege ohne Full Scan.
create index if not exists workout_sets_import_status_idx
  on public.workout_sets (user_id, import_status)
  where import_status is not null;

comment on column public.workout_sets.source is
  'K1 (2026-08-12): Herkunft des Satzes. manual = in ORVIA erfasst (bisheriges Verhalten, Default fuer Altbestand). garmin_import = aus einer Garmin-Aktivitaet uebernommen und damit pruefpflichtig.';
comment on column public.workout_sets.import_status is
  'K1 (2026-08-12): Pruefstatus importierter Saetze. NUR confirmed zaehlt zu Trainingslast und Soll-Ist-Vergleich (Plan §1.3).';
comment on column public.workout_sets.external_set_key is
  'K1 (2026-08-12): stabile Identitaet des Garmin-Satzes (Aktivitaet + Satzindex). Traegt den Duplikatschutz bei wiederholtem Sync.';
comment on column public.workout_sets.recognition_probability is
  'K1 (2026-08-12): Erkennungswahrscheinlichkeit der Uhr, 0..1. Niedrige Werte werden NICHT geraten, sondern sichtbar gemacht.';

-- ============================================================
--  D) strength_workout_exports — die persistente Identitaetskette
-- ============================================================
-- occurrence_id -> client_ref -> garmin_workout_id -> garmin_activity_id
-- Ohne diese Tabelle gaebe es fuer den Rueckkanal keinen belastbaren Anker.
-- `step_bindings` haelt fest, welcher erzeugte Garmin-Schritt zu welcher
-- ORVIA-Planuebung gehoert (K4-Vertrag); ohne diese Zuordnung waere ein
-- zurueckkommender `wktStepIndex` eine Zahl ohne Bedeutung.
create table if not exists public.strength_workout_exports (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  occurrence_id       text not null,                       -- 'po:<localDate>:<templateSessionId>'
  client_ref          text not null,                       -- stabil je Occurrence + Exportfassung
  mapping_version     text not null,                       -- Fassung des Garmin-Uebungskatalogs
  payload_version     text not null,                       -- Fassung des Exporterzeugers
  payload_hash        text,                                -- erkennt geaenderte Planvorgaben
  step_bindings       jsonb not null default '[]'::jsonb,  -- [{stepOrder, exerciseId, plannedIndex}]
  garmin_workout_id   text,
  garmin_activity_id  text,
  status              text not null default 'draft',
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, client_ref),
  constraint swe_status_known check (status in
    ('draft','pushed','scheduled','failed','superseded')),
  constraint swe_bindings_arr check (jsonb_typeof(step_bindings) = 'array'),
  constraint swe_bindings_bounded check (jsonb_array_length(step_bindings) <= 200),
  constraint swe_occurrence_form check (occurrence_id ~ '^po:'),
  -- Ein Workout gilt erst als uebertragen, wenn Garmin eine ID zurueckgab.
  -- Das verhindert den Zustand „status=pushed, aber wir wissen nicht wohin".
  constraint swe_pushed_needs_id check
    (status not in ('pushed','scheduled') or garmin_workout_id is not null)
);

-- Rueckrichtung: gegebene Garmin-Aktivitaet -> welche ORVIA-Occurrence?
-- Eindeutig je Nutzer, damit zwei Exporte nicht auf dasselbe Garmin-Workout
-- zeigen und die Zuordnung mehrdeutig wird.
create unique index if not exists swe_garmin_workout_uniq
  on public.strength_workout_exports (user_id, garmin_workout_id)
  where garmin_workout_id is not null;
create index if not exists swe_occurrence_idx
  on public.strength_workout_exports (user_id, occurrence_id);
create index if not exists swe_activity_idx
  on public.strength_workout_exports (user_id, garmin_activity_id)
  where garmin_activity_id is not null;

drop trigger if exists strength_workout_exports_touch on public.strength_workout_exports;
create trigger strength_workout_exports_touch
  before update on public.strength_workout_exports
  for each row execute function public.touch_updated_at();

alter table public.strength_workout_exports enable row level security;
alter table public.strength_workout_exports force row level security;
drop policy if exists sel_own on public.strength_workout_exports;
create policy sel_own on public.strength_workout_exports for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists ins_own on public.strength_workout_exports;
create policy ins_own on public.strength_workout_exports for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists upd_own on public.strength_workout_exports;
create policy upd_own on public.strength_workout_exports for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists del_own on public.strength_workout_exports;
create policy del_own on public.strength_workout_exports for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.strength_workout_exports from anon, public;
grant select, insert, update, delete on public.strength_workout_exports to authenticated;

comment on table public.strength_workout_exports is
  'K1 (2026-08-12): persistente Identitaetskette ORVIA-Occurrence -> Garmin-Workout -> Garmin-Aktivitaet. Grundlage fuer den Rueckkanal (K6) und die automatische Planerfuellung (K8). Ohne einen Eintrag hier wird eine Garmin-Kraftaktivitaet NIEMALS automatisch einer Plan-Occurrence zugeordnet (Plan §4 A5, §8 R7).';
comment on column public.strength_workout_exports.step_bindings is
  'K1: [{stepOrder, exerciseId, plannedIndex}] — uebersetzt einen zurueckkommenden wktStepIndex in die urspruengliche ORVIA-Planuebung.';
comment on column public.strength_workout_exports.payload_hash is
  'K1: Fingerabdruck der exportierten Vorgaben. Aendert sich der Plan nach dem Push, ist der Unterschied erkennbar statt still.';
