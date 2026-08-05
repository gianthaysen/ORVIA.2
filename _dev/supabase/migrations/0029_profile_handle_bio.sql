-- 0029 · Profil: Handle + Bio (Phase 4 / P2-5, 2026-08-05)
-- Gap-Analyse: .ig-handle und .ig-bio waren fest auf '—' bzw. Platzhalter verdrahtet;
-- es existierte KEIN Feld im Datenmodell. Vertikaler Durchstich exakt nach dem
-- 0016-Muster (location/avatar_path): Spalte -> Repository -> Store -> Editor -> Anzeige.
--
-- Bewusste Entscheidung: `handle` ist ein ANZEIGE-Pseudonym ohne Eindeutigkeits-
-- Constraint. Ein globales @handle-System (unique, Konflikt-UX, Reservierungen)
-- ist ein eigenes Feature und wird hier nicht simuliert. Client normalisiert
-- (lowercase, [a-z0-9._], max. 30); der Server erzwingt nur die Länge.
-- `bio` ist Freitext, client- und serverseitig auf 160 Zeichen begrenzt.

alter table public.user_profiles add column if not exists handle text;
alter table public.user_profiles add column if not exists bio text;

-- Längen-Guards (idempotent): kein stiller Datenverlust, Fehler statt Kürzung.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_handle_len') then
    alter table public.user_profiles add constraint user_profiles_handle_len
      check (handle is null or char_length(handle) <= 30);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_bio_len') then
    alter table public.user_profiles add constraint user_profiles_bio_len
      check (bio is null or char_length(bio) <= 160);
  end if;
end $$;

-- RLS: user_profiles hat bereits Owner-Policies (Bestand); neue Spalten erben sie.
