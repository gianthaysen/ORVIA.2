-- ============================================================
-- ORVIA · Vollstaendige Wiederherstellung Laufen/Rad aus der Sicherung (Worker v8-454) — NUR IM NOTFALL
-- ------------------------------------------------------------
-- Setzt metrics der gesicherten Lauf-/Radeinheiten auf den Stand der Sicherung zurueck
-- (v454_runbike_extras_backup.sql), uebernimmt dabei aber die AKTUELLEN clientgefuehrten Schluessel
-- (corrections, durationCorrection, plannedSessionId, planLinkCorrection). Fuer den normalen Rueckweg
-- reicht v454_runbike_extras_rollback.sql. Schwimmeinheiten werden nicht beruehrt.
-- VORHER in Railway DETAIL_EXTRAS_SPORTS wieder auf "swimming" setzen. Eine Transaktion; ein zweiter Lauf aendert nichts.
-- ============================================================
begin;

update public.activities a
set metrics = (b.metrics - 'corrections' - 'durationCorrection' - 'plannedSessionId' - 'planLinkCorrection')
              || coalesce((select jsonb_object_agg(k, a.metrics -> k)
                           from unnest(array['corrections', 'durationCorrection', 'plannedSessionId', 'planLinkCorrection']) k
                           where a.metrics ? k), '{}'::jsonb)
from orvia_backup.activities_runbike_v454 b
where a.id = b.id and a.user_id = b.user_id and a.source = 'garmin' and a.sport_id in ('running', 'cycling');

select count(*) as wiederhergestellt from orvia_backup.activities_runbike_v454;

commit;
