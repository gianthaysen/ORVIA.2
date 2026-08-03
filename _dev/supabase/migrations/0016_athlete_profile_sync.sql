-- ============================================================
--  ORVIA · 0016 — Athletenprofil-Sync (Ort, Avatar) + Avatar-Storage
--  Kontext (Incident 2026-07-15): Ort und Profilbild hatten KEINEN Sync-Kanal —
--  sie lebten nur im lokalen Geräte-Blob (orvia_profile_v1) → dauerhafte
--  Geräte-Divergenz trotz „Synchronisiert". user_profiles ist die serverseitige
--  Source of Truth der Athleten-Identitätsfelder (Phase-1-Entscheidung, s.
--  profile-store.js); diese Migration ergänzt die fehlenden Spalten und den
--  privaten Storage-Bucket für Profilbilder.
--  Idempotent. VOR dem zugehörigen JS-Deploy (v8-185) ausführen.
-- ============================================================
begin;

-- 1) Fehlende Athletenfelder in der bestehenden SoT-Tabelle (Option a — keine neue Tabelle;
--    user_profiles trägt bereits name/birth_date/height_cm/weight_kg/… mit RLS + updated_at).
alter table public.user_profiles add column if not exists location text;
alter table public.user_profiles add column if not exists avatar_path text;   -- Storage-Pfad, KEINE URL

-- 2) updated_at-Pflege serverseitig erzwingen (Conflict-Grundlage: nachvollziehbares LWW).
--    touch_updated_at() existiert seit 0002; Trigger hier idempotent sicherstellen.
drop trigger if exists user_profiles_touch on public.user_profiles;
create trigger user_profiles_touch before update on public.user_profiles
  for each row execute function public.touch_updated_at();

-- 3) RLS-Absicherung (bereits in 0002 gesetzt — hier nur idempotent bestätigen,
--    damit diese Migration auch auf einer Instanz ohne 0002-H-Block sicher ist).
alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;
drop policy if exists sel_own on public.user_profiles;
drop policy if exists ins_own on public.user_profiles;
drop policy if exists upd_own on public.user_profiles;
drop policy if exists del_own on public.user_profiles;
create policy sel_own on public.user_profiles for select to authenticated using (auth.uid() = user_id);
create policy ins_own on public.user_profiles for insert to authenticated with check (auth.uid() = user_id);
create policy upd_own on public.user_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy del_own on public.user_profiles for delete to authenticated using (auth.uid() = user_id);

-- 4) Storage-Bucket 'avatars' (PRIVAT — Zugriff nur über signierte URLs des Eigentümers).
--    Pfadschema strikt: {userId}/profile.jpg  → Ordnersegment 1 = auth.uid().
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists avatars_sel_own on storage.objects;
drop policy if exists avatars_ins_own on storage.objects;
drop policy if exists avatars_upd_own on storage.objects;
drop policy if exists avatars_del_own on storage.objects;
create policy avatars_sel_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_ins_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_upd_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_del_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.schema_migrations(version) values ('0016_athlete_profile_sync') on conflict (version) do nothing;

commit;
