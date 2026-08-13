-- ============================================================
-- ORVIA · 0026 — Anker-Schutz für Plan-Actual-Link (Batch 2e/2f)
-- ------------------------------------------------------------
-- APPEND-ONLY-KORREKTUR (Batch 2f): Die Trigger-Logik stand kurzzeitig in
-- einer nachträglich erweiterten 0025; 0025 wurde jedoch bereits in ihrer
-- Erstfassung live ausgeführt und ist deshalb eingefroren. Diese Datei ist
-- die additive Fortsetzung. LIVE-STAND-ANNAHME: 0025 gilt laut SQL-Editor-
-- Screenshot vom 2026-07-18 als ausgeführt — das ist NICHT technisch
-- verifiziert (kein Live-Query-Nachweis); Prüfsequenz siehe unten.
--
-- KORREKTUR zur 0025-Doku: „Client sendet die Spalte nur wenn belegt ⇒
-- kompatibel ohne Migration" trifft auf GEPLANTE Workout-Starts nicht zu —
-- dort sendet der Client planned_session_snapshot real. VERBINDLICHE
-- RELEASE-REIHENFOLGE: 0025 und 0026 MÜSSEN vor dem Client-Bundle
-- (Batch 2b+) aktiv sein. Erst SQL, dann Frontend-Deploy.
--
-- Schutzregeln (BEFORE INSERT OR UPDATE; Batch 2g nach PostgreSQL-Doku
-- härtet: OLD ist in Trigger-Funktionen NUR bei UPDATE/DELETE verfügbar,
-- und die Auswertungsreihenfolge boolescher Teilausdrücke ist nicht
-- garantiert — deshalb strikt getrennte IF/ELSIF-Zweige, der INSERT-Zweig
-- enthält syntaktisch KEIN OLD):
-- 1. INSERT: Konsistenzprüfung — sind planned_session_id UND
--    planned_session_snapshot->>'occurrenceId' beide gesetzt und
--    widersprüchlich, wird die Zeile abgelehnt (Client-Fehler).
-- 2. UPDATE, Schritt 1 — ERHALT: Einmal gesetzte planned_session_id /
--    planned_session_snapshot werden ERHALTEN (Altwert wird wiederhergestellt,
--    statt das Update abzulehnen — generische Upserts/Offline-Abschlüsse
--    scheitern nie am Anker). Erstbefüllung (old ist null) bleibt erlaubt.
-- 3. UPDATE, Schritt 2 — KONSISTENZ BEI ERSTERGÄNZUNG (nach dem Erhalt):
--    Wird ID ODER Snapshot ERSTMALS ergänzt (Altwert null → neuer Wert)
--    und widersprechen sich danach ID und Snapshot-occurrenceId, wird
--    abgelehnt. Das deckt auch den Fall „Snapshot existiert bereits, ID wird
--    später widersprüchlich ergänzt". Sind BEIDE Felder alt (nichts erstmals
--    ergänzt), findet KEINE Prüfung statt — bestehende vollständig befüllte
--    Altzeilen werden durch unabhängige Updates nie blockiert.
-- 4. BESTEHENDE ZEILEN: Der Trigger prüft ausschließlich NEUE
--    Schreiboperationen. Es gibt bewusst KEINEN CHECK-Constraint und KEIN
--    Backfill — vorhandene Zeilen (auch theoretisch inkonsistente) blockieren
--    die Migration nicht und bleiben unangetastet (migrationssicher).
--
-- Additiv + idempotent (create or replace, drop trigger if exists).
-- RLS: workout_sessions ist bereits owner-only.
-- Rollback:
--   drop trigger if exists trg_orvia_protect_planned_anchor on public.workout_sessions;
--   drop function if exists public.orvia_protect_planned_anchor();
-- ============================================================

create or replace function public.orvia_protect_planned_anchor()
returns trigger
language plpgsql
as $$
declare
  snap_occ text;
  id_added boolean;
  snap_added boolean;
begin
  if tg_op = 'INSERT' then
    -- INSERT-Zweig: syntaktisch KEIN OLD (bei INSERT nicht verfügbar).
    if new.planned_session_id is not null
       and new.planned_session_snapshot is not null then
      snap_occ := new.planned_session_snapshot->>'occurrenceId';
      if snap_occ is not null
         and new.planned_session_id is distinct from snap_occ then
        raise exception 'ORVIA Plananker inkonsistent (INSERT): planned_session_id (%) != snapshot.occurrenceId (%)',
          new.planned_session_id, snap_occ;
      end if;
    end if;

  elsif tg_op = 'UPDATE' then
    -- Schritt 1 · Erhalt einmal gesetzter Anker (zuerst, vor jeder Prüfung).
    if old.planned_session_id is not null
       and new.planned_session_id is distinct from old.planned_session_id then
      new.planned_session_id := old.planned_session_id;
    end if;
    if old.planned_session_snapshot is not null
       and new.planned_session_snapshot is distinct from old.planned_session_snapshot then
      new.planned_session_snapshot := old.planned_session_snapshot;
    end if;

    -- Schritt 2 · Konsistenz NUR bei Erstergänzung (ID oder Snapshot neu).
    id_added   := old.planned_session_id is null       and new.planned_session_id is not null;
    snap_added := old.planned_session_snapshot is null and new.planned_session_snapshot is not null;
    if id_added or snap_added then
      if new.planned_session_id is not null
         and new.planned_session_snapshot is not null then
        snap_occ := new.planned_session_snapshot->>'occurrenceId';
        if snap_occ is not null
           and new.planned_session_id is distinct from snap_occ then
          raise exception 'ORVIA Plananker inkonsistent (UPDATE-Erstergänzung): planned_session_id (%) != snapshot.occurrenceId (%)',
            new.planned_session_id, snap_occ;
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orvia_protect_planned_anchor on public.workout_sessions;
create trigger trg_orvia_protect_planned_anchor
  before insert or update on public.workout_sessions
  for each row
  execute function public.orvia_protect_planned_anchor();

comment on column public.workout_sessions.planned_session_snapshot is
  'Unveränderlicher Snapshot der geplanten Einheit (Occurrence) zum Startzeitpunkt. Quelle: ui.js startPlannedUnit (Batch 2d). Anker für Plan-Ist-Vergleich. Durch Trigger 0026 gegen Überschreiben und widersprüchliche Erstbefüllung geschützt.';
