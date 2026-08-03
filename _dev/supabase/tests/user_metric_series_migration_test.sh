#!/usr/bin/env bash
# GM7.4 · RED→GREEN DB-Vertragstest für 0028_user_metric_series gegen ein
# EPHEMERES Postgres. Prüft: fehlende Tabelle (RED), dann Tabelle/Index, Dedupe
# (unique), RLS-Isolation zwischen Nutzern, Account-Delete-Cascade, Punkt-Guard,
# und Rollback. Kein Remote-DB-Zugriff. Benötigt initdb/pg_ctl/psql im PATH.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../migrations/0028_user_metric_series.sql"
ROLLBACK="$HERE/../migrations/0028_user_metric_series_rollback.sql"
PGDATA="$(mktemp -d)/pgdata"; PGSOCK="$(mktemp -d)"; PORT=54329
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | head -1)"; export PATH="$PGBIN:$PATH"
fail=0; ok(){ echo "ok:   $1"; }; bad(){ echo "FAIL: $1"; fail=1; }
cleanup(){ pg_ctl -D "$PGDATA" -mimmediate stop >/dev/null 2>&1 || true; rm -rf "$PGDATA" "$PGSOCK"; }
trap cleanup EXIT

initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null 2>&1 || { echo "initdb fehlgeschlagen"; exit 2; }
pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=''" -w start >/dev/null 2>&1 || { echo "pg start fehlgeschlagen"; exit 2; }
PSQL(){ psql -h "$PGSOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=0 -qtA "$@"; }

# --- Supabase-Stubs: auth-Schema, users, uid(), authenticated-Rolle -----------
PSQL >/dev/null 2>&1 <<'SQL'
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
-- Stub der Supabase-Funktion auth.uid() (Rückgabe uuid; Cast aus dem JWT-sub).
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;
create role authenticated nologin;
grant usage on schema public to authenticated;
grant usage on schema auth to authenticated;             -- authenticated darf auth.uid() erreichen
grant execute on function auth.uid() to authenticated;
insert into auth.users(id) values ('11111111-1111-1111-1111-111111111111'),
                                   ('22222222-2222-2222-2222-222222222222');
SQL

# --- RED: Tabelle existiert noch nicht -----------------------------------------
R=$(PSQL -c "select 1 from public.user_metric_series limit 1;" 2>&1)
if echo "$R" | grep -qiE "does not exist|existiert nicht"; then ok "RED: user_metric_series fehlt vor Migration"; else bad "RED erwartet (Tabelle sollte fehlen): $R"; fi

# --- Migration anwenden --------------------------------------------------------
psql -h "$PGSOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$MIG" >/dev/null 2>&1 && ok "Migration 0028 angewandt" || bad "Migration schlug fehl"
PSQL -c "grant select,insert,update,delete on public.user_metric_series to authenticated;" >/dev/null 2>&1

# GREEN: Tabelle + Index vorhanden
[ "$(PSQL -c "select to_regclass('public.user_metric_series') is not null;")" = "t" ] && ok "GREEN: Tabelle existiert" || bad "Tabelle fehlt nach Migration"
[ "$(PSQL -c "select count(*) from pg_indexes where indexname='ums_user_metric_date_idx';")" = "1" ] && ok "GREEN: Lese-Index vorhanden" || bad "Index fehlt"
[ "$(PSQL -c "select relrowsecurity from pg_class where oid='public.user_metric_series'::regclass;")" = "t" ] && ok "GREEN: RLS aktiviert" || bad "RLS nicht aktiv"

# --- Dedupe: zweimal (user,type,date) upserten ⇒ eine Zeile --------------------
PSQL >/dev/null 2>&1 <<'SQL'
insert into public.user_metric_series(user_id,metric_type,metric_date,points,point_count)
 values ('11111111-1111-1111-1111-111111111111','stress_intraday','2026-07-16','[[0,30]]',1)
 on conflict (user_id,metric_type,metric_date) do update set points=excluded.points, point_count=excluded.point_count;
insert into public.user_metric_series(user_id,metric_type,metric_date,points,point_count)
 values ('11111111-1111-1111-1111-111111111111','stress_intraday','2026-07-16','[[0,31],[180,40]]',2)
 on conflict (user_id,metric_type,metric_date) do update set points=excluded.points, point_count=excluded.point_count;
SQL
CNT=$(PSQL -c "select count(*) from public.user_metric_series where metric_type='stress_intraday';")
PC=$(PSQL -c "select point_count from public.user_metric_series where metric_type='stress_intraday';")
{ [ "$CNT" = "1" ] && [ "$PC" = "2" ]; } && ok "GREEN: Dedupe — eine Zeile je (user,type,date), Upsert aktualisiert" || bad "Dedupe falsch (rows=$CNT pc=$PC)"

# --- Punkt-Guard: point_count>2000 verstößt gegen CHECK -----------------------
G=$(PSQL -c "insert into public.user_metric_series(user_id,metric_type,metric_date,point_count) values ('11111111-1111-1111-1111-111111111111','x','2026-07-17',3000);" 2>&1)
echo "$G" | grep -qiE "ums_point_count_bounded|check constraint" && ok "GREEN: Punkt-Guard (>2000) greift" || bad "Punkt-Guard fehlt: $G"

# --- RLS: Nutzer B darf Zeilen von Nutzer A NICHT sehen -----------------------
RLS_A_INSERT=$(psql -h "$PGSOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -qtA <<'SQL' 2>&1
set role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
insert into public.user_metric_series(user_id,metric_type,metric_date,points,point_count)
 values ('22222222-2222-2222-2222-222222222222','sleep_stages','2026-07-16','[[0,1800,"deep"]]',1);
select count(*) from public.user_metric_series;  -- B sieht nur B: stress(A) unsichtbar
reset role;
SQL
)
# B sollte genau seine 1 Zeile sehen (nicht A's stress-Zeile)
BSEE=$(echo "$RLS_A_INSERT" | tail -1)
[ "$BSEE" = "1" ] && ok "GREEN: RLS — Nutzer B sieht nur eigene Zeile (A unsichtbar)" || bad "RLS-Isolation falsch (B sah: $BSEE)"
# Gegenprobe: B darf NICHT für A schreiben (with check)
WRONG=$(psql -h "$PGSOCK" -p "$PORT" -U postgres -qtA <<'SQL' 2>&1
set role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
insert into public.user_metric_series(user_id,metric_type,metric_date) values ('11111111-1111-1111-1111-111111111111','sleep_stages','2026-07-18');
reset role;
SQL
)
echo "$WRONG" | grep -qiE "row-level security|violates" && ok "GREEN: RLS — B kann nicht für A schreiben (with check)" || bad "RLS with_check fehlt: $WRONG"

# --- Cascade: auth.users(A) löschen ⇒ A's Serien weg --------------------------
PSQL -c "delete from auth.users where id='11111111-1111-1111-1111-111111111111';" >/dev/null 2>&1
LEFT=$(PSQL -c "select count(*) from public.user_metric_series where user_id='11111111-1111-1111-1111-111111111111';")
[ "$LEFT" = "0" ] && ok "GREEN: Account-Delete-Cascade entfernt A's Serien" || bad "Cascade falsch (übrig: $LEFT)"

# --- Rollback: Tabelle wieder weg ---------------------------------------------
psql -h "$PGSOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$ROLLBACK" >/dev/null 2>&1
[ "$(PSQL -c "select to_regclass('public.user_metric_series') is null;")" = "t" ] && ok "GREEN: Rollback entfernt die Tabelle sauber" || bad "Rollback ließ Tabelle zurück"

echo ""
[ "$fail" = "0" ] && echo "user_metric_series_migration_test: ALLE BESTANDEN" || echo "user_metric_series_migration_test: FEHLGESCHLAGEN"
exit $fail
