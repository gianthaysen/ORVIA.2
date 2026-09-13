-- ============================================================
-- 0045 · user_goals.history — Aenderungsgeschichte je Ziel (S1.5, 13.09.2026)
-- ------------------------------------------------------------
-- WOFUER. Die Ziel-Detailseite (Prototyp v14) zeigt eine Historie: „Zielzeit
-- verschaerft 1:55 → 1:50, Prognose zu dem Zeitpunkt 1:50:40", „Ziel angelegt".
-- Der A-06-Shadow-Log (0037) ist dafuer ungeeignet: er protokolliert nur das
-- Hauptziel als Schnappschuss und ist ein Beobachter, kein Produktdatum.
--
--   history jsonb  [{at, type: created|title|target|date|priority|status|result|milestone,
--                    from, to, forecastMin?, note?}]   append-only, max. 60, vom
--                   Client-Modell (profile-model.updateGoal) geschrieben.
--
-- REIHENFOLGE. Vor dem Client-Deploy v8-374 ausfuehren: der Client sendet
-- history nur, wenn belegt — ohne 0045 schluege der Upsert fuer jedes geaenderte
-- Ziel fehl (unbekannte Spalte). Bestehende Ziele ohne Historie bleiben leer;
-- die Detailseite zeigt dann nur „angelegt am <created_at>".
-- ============================================================

begin;

alter table public.user_goals add column if not exists history jsonb;

comment on column public.user_goals.history is
  'S1.5: Aenderungsgeschichte des Ziels (append-only, vom Client-Modell geschrieben). Null/leer = keine Eintraege.';

commit;
