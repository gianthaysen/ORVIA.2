-- ============================================================
-- 0023 · readiness_scores — engine_version-Korrektur (Phase-8-Vorbedingung)
-- ------------------------------------------------------------
-- Audit-Befund: readiness-store.js persistierte den Calc.readiness-Score
-- (Engine v1) fälschlich mit engine_version='v2'. Die Engine v2 läuft bis
-- zum Aktivierungsgate (C8) nur im Shadow-Mode (lokal, localStorage) und
-- hat NIE in readiness_scores geschrieben — alle 'v2'-Zeilen sind daher
-- in Wahrheit v1-Scores und werden ehrlich umetikettiert.
-- Defensiv: falls (wider Erwarten) für denselben Tag bereits eine echte
-- 'v1'-Zeile existiert, bleibt die 'v2'-Zeile unangetastet (kein
-- Unique-Konflikt auf (user_id, local_date, engine_version), kein
-- Datenverlust; solche Fälle wären manuell zu prüfen).
-- ============================================================
begin;

update public.readiness_scores rs
   set engine_version = 'v1'
 where rs.engine_version = 'v2'
   and not exists (
     select 1 from public.readiness_scores r2
      where r2.user_id = rs.user_id
        and r2.local_date = rs.local_date
        and r2.engine_version = 'v1'
   );

insert into public.schema_migrations (version)
values ('0023_readiness_engine_version_fix')
on conflict (version) do nothing;

commit;
