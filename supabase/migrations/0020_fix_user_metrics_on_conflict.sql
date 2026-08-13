-- ============================================================
--  ORVIA · 0020 — Fix: user_metrics-Upsert schlug mit HTTP 400 fehl
--  Ursache (live verifiziert, 2026-07-17): PostgREST erzeugt für
--  on_conflict=user_id,metric_type,source_record_id ein
--  "ON CONFLICT (...) DO UPDATE" OHNE WHERE-Klausel. Der in 0019 angelegte
--  Unique-Index war aber PARTIELL (where source_record_id is not null) —
--  Postgres akzeptiert einen partiellen Index nur als Konfliktziel, wenn
--  die Bedingung im ON CONFLICT selbst mit angegeben wird (PostgREST kann
--  das nicht). Reales Fehlerbild: Postgres-Code 42P10 "there is no unique
--  or exclusion constraint matching the ON CONFLICT specification".
--
--  Fix: Index auf vollständig (nicht-partiell) umstellen. Verhalten bleibt
--  für NULL-source_record_id unverändert (Standard-SQL: NULL <> NULL, also
--  kollidieren mehrere Zeilen mit NULL ohnehin nie) — nur die fälschliche
--  Einschränkung "where source_record_id is not null" entfällt.
--
--  Idempotent, löscht keine Nutzerdaten. user_metrics war zum Zeitpunkt
--  dieser Migration wegen des Bugs noch leer (0 Zeilen je betroffenem
--  Nutzer), daher keine Konfliktprüfung nötig.
-- ============================================================

begin;

drop index if exists public.user_metrics_source_record_uniq;
create unique index if not exists user_metrics_source_record_uniq
  on public.user_metrics (user_id, metric_type, source_record_id);

insert into public.schema_migrations(version) values ('0020_fix_user_metrics_on_conflict')
  on conflict (version) do nothing;

commit;
