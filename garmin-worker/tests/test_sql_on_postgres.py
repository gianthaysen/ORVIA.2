"""v8-447.1 · SQL gegen ein ECHTES Postgres — Feldzensus, Sportart-Migrationen, Auswertung.

Diese Tests starten ein Wegwerf-Postgres (eigenes Datenverzeichnis, eigener Port, wird danach
gestoppt und geloescht) und fuehren die Dateien aus, die Gian im Supabase-SQL-Editor ausfuehrt:

    supabase/scripts/garmin_field_census.sql          (nur lesend)
    supabase/migrations/0049_norm_sport_catalog.sql
    supabase/scripts/0050_sport_backfill_dryrun.sql   (nur lesend)
    supabase/migrations/0050_sport_backfill_catalog.sql
    supabase/migrations_rollback/0050_sport_backfill_catalog_rollback.sql

Die Zeilen fuer den Zensus baut der WORKER-CODE selbst (normalize, series_normalize,
detail_sync) — der Test bleibt damit deckungsgleich mit dem, was in Produktion in der Zeile steht.

Ohne Postgres-Programme auf dem Rechner (initdb, pg_ctl, psql) wird das Modul UEBERSPRUNGEN.
Uebersprungen heisst: nicht geprueft.
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import shutil
import socket
import subprocess
import tempfile
from pathlib import Path

import pytest

from orvia_worker import detail_sync, normalize, series_normalize as S
from orvia_worker.providers.base import NotFound
from tests.conftest import FakeDb

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
SQL = REPO / "supabase"
FIX = ROOT / "tests" / "fixtures" / "garmin"
DETAILS = json.load(open(FIX / "activity_details.json", encoding="utf-8"))
T0 = 1_767_225_600_000


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


CR = _load("census_report")


def _bin(name: str) -> str | None:
    hit = shutil.which(name)
    if hit:
        return hit
    for base in sorted(Path("/usr/lib/postgresql").glob("*/bin"), reverse=True) if Path("/usr/lib/postgresql").exists() else []:
        if (base / name).exists():
            return str(base / name)
    return None


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def pg():
    initdb, pg_ctl, psql = _bin("initdb"), _bin("pg_ctl"), _bin("psql")
    if not (initdb and pg_ctl and psql and SQL.exists()):
        pytest.skip("kein Postgres (initdb / pg_ctl / psql) oder kein supabase/-Ordner — SQL NICHT geprueft")
    as_root = hasattr(os, "geteuid") and os.geteuid() == 0
    base = Path(tempfile.mkdtemp(prefix="orvia-pg-", dir="/tmp"))
    port = _free_port()

    def sh(cmd: str):
        if as_root:
            return subprocess.run(["su", "postgres", "-c", cmd], capture_output=True, text=True)
        return subprocess.run(cmd, shell=True, capture_output=True, text=True)

    try:
        if as_root:
            if subprocess.run(["id", "postgres"], capture_output=True).returncode != 0:
                pytest.skip("Postgres laesst sich als root nicht starten und es gibt keinen Benutzer 'postgres'")
            os.chmod(base, 0o755)
            shutil.chown(base, "postgres")
        r = sh(f"{initdb} -D {base}/data -A trust -U postgres >/dev/null 2>&1 && "
               f"{pg_ctl} -D {base}/data -o '-p {port} -c listen_addresses=127.0.0.1 -k {base}' -l {base}/log -w start")
        if r.returncode != 0:
            pytest.skip("Wegwerf-Postgres liess sich nicht starten — SQL NICHT geprueft")

        def run(sql: str | None = None, file: Path | None = None, csv: bool = False) -> str:
            cmd = [psql, "-h", "127.0.0.1", "-p", str(port), "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-X", "postgres"]
            if csv:
                cmd.insert(-1, "--csv")
            if file is not None:
                cmd[-1:-1] = ["-f", str(file)]
            out = subprocess.run(cmd, input=sql, capture_output=True, text=True)
            assert out.returncode == 0, out.stderr[-1500:]
            return out.stdout
        yield run
    finally:
        sh(f"{pg_ctl} -D {base}/data -m immediate stop >/dev/null 2>&1")
        shutil.rmtree(base, ignore_errors=True)


def _q(obj) -> str:
    return "'" + json.dumps(obj).replace("'", "''") + "'::jsonb"


# ═══════════════════════════════════════════════════════════════════════════
# Zensus
# ═══════════════════════════════════════════════════════════════════════════

def _entry(**over):
    e = {"activityId": 1, "activityType": {"typeKey": "running", "parentTypeId": 17},
         "startTimeLocal": "2026-07-12 08:30:00", "startTimeGMT": "2026-07-12 06:30:00",
         "duration": 3475.1, "distance": 10012.3, "averageHR": 150.0, "hasPolyline": True}
    e.update(over)
    return e


def _ride_details(n=90, total=None):
    desc = [{"metricsIndex": 0, "key": "directTimestamp"}, {"metricsIndex": 1, "key": "directPower"},
            {"metricsIndex": 2, "key": "directBikeCadence"}, {"metricsIndex": 3, "key": "directHeartRate"},
            {"metricsIndex": 4, "key": "directLeftBalance"}, {"metricsIndex": 5, "key": "directMystery"}]
    raw = {"metricDescriptors": desc,
           "activityDetailMetrics": [{"metrics": [T0 + i * 1000, 200.0 + i, 90.0, 140.0, 49.5, 1.0]} for i in range(n)]}
    if total is not None:
        raw["totalMetricsCount"] = total
    return raw


def _worker_rows() -> list[dict]:
    """Aktivitaeten so, wie der Worker sie schreibt: Listeneintrag → Details → Vermerke."""
    entries = (
        [_entry(activityId=100 + i, averageRunningCadenceInStepsPerMinute=161.0) for i in range(6)]
        + [_entry(activityId=200 + i, activityType={"typeKey": "road_biking"}, avgPower=212.0,
                  averageBikingCadenceInRevPerMinute=92.0, avgStrideLength={"value": 1}) for i in range(5)]
        + [_entry(activityId=300, activityType={"typeKey": "lap_swimming"}, poolLength=25.0, averageSwolf=38.0)]
        + [_entry(activityId=400, activityType={"typeKey": "curling"})]
        + [_entry(activityId=500 + i, activityType={"typeKey": "strength_training"}, totalSets=18) for i in range(2)]
    )

    async def build():
        db = FakeDb(); uid = "u"
        for e in entries:
            a = normalize.normalize_activity(e)
            await db.insert("activities", [{"user_id": uid, "source": "garmin", "source_record_id": a.source_record_id,
                                            "sport_id": a.sport_id, "started_at": f"2026-09-{(e['activityId'] % 28) + 1:02d}T06:00:00+00:00",
                                            "metrics": a.metrics}])

        def fetch(aid):
            n = int(aid)
            if n == 105:
                raise NotFound("404")                       # ein geloeschter Lauf
            if 200 <= n < 300:
                return _ride_details(total=90 if n != 204 else 270)   # eine Fahrt ausgeduennt
            if n >= 500:
                return {"metricDescriptors": [{"metricsIndex": 0, "key": "directTimestamp"}, {"metricsIndex": 1, "key": "directHeartRate"}],
                        "activityDetailMetrics": [{"metrics": [T0 + i * 1000, 110.0]} for i in range(30)]}
            return DETAILS
        for _ in range(3):
            await detail_sync.sync_activity_details(db, uid, fetch, limit=20)
        rows = list(db.tables["activities"])
        # zwei Altzeilen aus der Zeit davor: nie nachgeladen / alter Vertrag
        rows.append({"source": "garmin", "sport_id": "running", "metrics": {"detailsFetchedAt": "2026-01-01T00:00:00+00:00", "detailsVersion": 2,
                                                                          "streams": {"cadence": [80, 81]}}})
        rows.append({"source": "garmin", "sport_id": "running", "metrics": {}})
        return rows
    return asyncio.run(build())


@pytest.fixture(scope="module")
def census(pg):
    pg("create table public.activities (id serial primary key, user_id text, source text, sport_id text, metrics jsonb);")
    stmts = []
    for r in _worker_rows():
        stmts.append(f"insert into public.activities (user_id, source, sport_id, metrics) values ('u', 'garmin', '{r['sport_id']}', {_q(r['metrics'])});")
    # Stoerfaelle: kaputte metrics duerfen die Abfrage nicht zu Fall bringen; fremde Quellen zaehlen nicht
    stmts.append("""insert into public.activities (user_id, source, sport_id, metrics) values
        ('u','garmin','gym','[1,2]'::jsonb), ('u','garmin','gym',null),
        ('u','garmin','other','{"ext":"kaputt","garmin":[1],"best_efforts":7,"detailsVersion":"drei","detailsFailCount":"x","detailsFailedAt":"gestern","stream_meta":[1]}'::jsonb),
        ('u','manual','running','{"ext":{"fields":{"geheim":1}},"garmin":{"type_key":"x"}}'::jsonb);""")
    pg("\n".join(stmts))
    text = pg(file=SQL / "scripts" / "garmin_field_census.sql", csv=True)
    rows = CR.parse_rows(text)
    return {"text": text, "rows": rows, "observed": CR.build_observed(rows, census_date="2026-10-09", worker="v8-447.1")}


def test_census_runs_on_postgres_and_returns_only_names_and_counts(census):
    text = census["text"]
    assert text.splitlines()[0] == "art,sport_id,name,aktivitaeten"
    arts = {r[0] for r in census["rows"]}
    assert {"basis", "typ", "herkunft", "nachladen", "tempo", "abtastung", "messreihe", "feld", "feld_nicht_erhalten",
            "feld_verworfen", "reihe", "reihe_nicht_erhalten", "bestwert", "kennwert"} <= arts
    for secret in ("10012.3", "3475.1", "2026-07-12", "08:30", "geheim", '"u"', "161.0", "212.0"):
        assert secret not in text, secret                          # keine Messwerte, keine Trainingszeiten, keine fremde Quelle
    assert len(census["rows"]) == len(text.splitlines()) - 1       # jede Zeile der Ausgabe ist lesbar


def test_census_basis_and_backfill_status(census):
    o = census["observed"]
    assert o["basis"]["running"] == {"alle": 8, "mit_herkunft": 6, "mit_rohfeldern": 6, "details_aktuell": 5}
    assert o["basis"]["cycling"] == {"alle": 5, "mit_herkunft": 5, "mit_rohfeldern": 5, "details_aktuell": 5}
    assert o["basis"]["other"]["alle"] == 2 and o["basis"]["other"]["details_aktuell"] == 1     # curling + die kaputte Zeile
    assert o["nachladen"]["running"] == {"aktuell": 5, "zurueckgestellt:NOT_FOUND": 1, "offen_alt": 1, "offen_neu": 1}
    b = CR.backfill_summary(o, limit=10, interval_min=30)
    assert (b["total"], b["current"], b["pending"], b["deferred"], b["failing"]) == (18, 14, 3, 1, 0)
    assert b["total"] == b["current"] + b["pending"] + b["deferred"]
    assert b["by_category"] == {"NOT_FOUND": 1} and (b["legacy"], b["never"]) == (1, 2)
    assert b["eta_runs"] == 1 and b["eta_hours_min"] == 0.5 and b["processed_24h"] == 14 and b["last_processed"]
    assert b["by_sport"]["cycling"] == {"total": 5, "current": 5}
    md = CR.render_backfill_md(o)
    assert "| Garmin-Aktivitäten gesamt | 18 |" in md and "| NOT_FOUND | 1 |" in md and "Stand: 2026-10-09" in md


def test_census_proves_field_names_per_sport(census):
    o = census["observed"]
    assert o["typ"]["cycling"] == {"road_biking": 5} and o["typ"]["swimming"] == {"lap_swimming": 1}
    assert o["typ"]["other"]["curling"] == 1                                    # nicht zugeordneter Garmin-Typ wird sichtbar
    assert o["feld"]["cycling"]["avgPower"] == 5 and o["feld"]["cycling"]["averageBikingCadenceInRevPerMinute"] == 5
    assert o["feld"]["running"]["averageRunningCadenceInStepsPerMinute"] == 6 and "avgPower" not in o["feld"]["running"]
    assert o["feld"]["swimming"] == {"averageHR": 1, "averageSwolf": 1, "distance": 1, "duration": 1, "poolLength": 1}
    assert o["feld_nicht_erhalten"]["running"] == {"hasPolyline": 6}
    assert o["feld_verworfen"]["cycling"] == {"avgStrideLength": 5}             # erlaubtes Feld in unerwarteter Form
    assert o["herkunft"]["running"]["start_local"] == 6 and o["herkunft"]["running"]["moving_duration_s"] == 5
    assert o["messreihe"]["running"]["cadence <- directDoubleCadence [running_cadence_spm]"] == 5
    assert o["messreihe"]["cycling"]["cadence <- directBikeCadence [cycling_cadence_rpm]"] == 5
    assert o["quelle"]["cycling"]["directPower"] == 5 and o["quelle"]["running"]["directTimestamp"] == 5
    assert o["reihe"]["cycling"] == {"directLeftBalance": 5} and o["reihe_nicht_erhalten"]["cycling"] == {"directMystery": 5}
    assert o["abtastung"]["running"] == {"ausgeduennt": 5} and o["abtastung"]["cycling"] == {"vollstaendig": 4, "ausgeduennt": 1}
    assert o["abtastung"]["gym"] == {"gesamtzahl_unbekannt": 2}
    assert o["bestwert"]["cycling"]["power:5s = exact"] == 4 and o["bestwert"]["cycling"]["power:5s = insufficient"] == 1
    assert o["bestwert"]["cycling"]["power:60s = exact"] == 4 and o["bestwert"]["cycling"]["power:60s = approx"] == 1
    assert o["bestwert"]["cycling"]["power:aufzeichnung = vollstaendig_sekuendlich"] == 4
    assert o["bestwert"]["cycling"]["power:aufzeichnung = ausgeduennt"] == 1
    assert o["bestwert"]["running"]["distance:1000m = measured"] == 5 and o["bestwert"]["running"]["distance:21098m = too_short"] == 5
    assert "distance:1000m = measured" not in o["bestwert"].get("cycling", {})   # Strecken-Bestwerte nur Lauf/Gehen/Wandern
    assert o["kennwert"]["cycling"]["cadence [cycling_cadence_rpm]"] == 5 and o["kennwert"]["gym"] == {"heart_rate": 2}


def test_evidence_levels_follow_the_census_and_nothing_else(census):
    o = census["observed"]
    ev = CR.evidence_label
    seen = ev("avgPower", ("cycling", "running"), "library", o, "feld")
    assert seen["label"] == "OBSERVED_PRODUCTION" and seen["seen"] == {"cycling": 5} and seen["basis"] == {"cycling": 5, "running": 6}
    absent = ev("avgGroundContactTime", ("running",), "assumed", o, "feld")
    assert absent["label"] == "ABSENT" and absent["basis"] == {"running": 6}                # 6 Laeufe, nie geliefert
    few = ev("activeLengths", ("swimming",), "assumed", o, "feld")
    assert few["label"] == "ASSUMED" and "zu wenige" in few["note"]                          # 1 Schwimmeinheit: kein Urteil
    none = ev("strokes", ("rowing",), "assumed", o, "feld")
    assert none["label"] == "ASSUMED" and "keine Aktivitaet" in none["note"]
    lib = ev("totalReps", ("gym",), "library", o, "feld")
    assert lib["label"] == "LIBRARY_DOCUMENTED"                                              # 2 Krafteinheiten: bleibt, wird nicht hochgestuft
    assert ev("directLeftBalance", ("cycling",), "assumed", o, "reihe")["label"] == "OBSERVED_PRODUCTION"
    assert ev("directGroundContactTime", ("running",), "assumed", o, "reihe")["label"] == "ABSENT"
    assert ev("directBikeCadence", ("cycling",), "assumed", o, "quelle")["label"] == "OBSERVED_PRODUCTION"
    assert ev("avgPower", ("cycling",), "library", None, "feld") == {"label": "LIBRARY_DOCUMENTED", "seen": {}, "basis": {}, "note": None}
    v = CR.verdicts(o)
    assert {"avgPower", "averageBikingCadenceInRevPerMinute", "averageRunningCadenceInStepsPerMinute", "distance"} <= {r["key"] for r in v["confirmed"]}
    assert "avgGroundContactTime" in {r["key"] for r in v["absent"]} and "activeLengths" in {r["key"] for r in v["undecided"]}
    assert "poolLength" in {r["key"] for r in v["confirmed"]}                                 # einmal gezaehlt = geliefert
    assert [r["key"] for r in v["rejected"]] == ["avgStrideLength"] and [r["key"] for r in v["series_not_retained"]] == ["directMystery"]
    assert [r["key"] for r in v["not_retained"]] == ["hasPolyline"]


def test_census_document_and_matrix_are_built_from_the_counts(census, monkeypatch):
    o = census["observed"]
    md = CR.render_census_md(o)
    assert "| cycling | `avgPower` | 5 | 100 % |" in md and "| running | `hasPolyline` | 6 | 100 % |" in md
    assert "**Noch `other`:** 2 Aktivitäten" in md and "`curling` (1)" in md
    assert "| `avgGroundContactTime` | ASSUMED | running 6 |" in md                         # widerlegt, mit Grundlage
    assert "| cycling | `avgStrideLength` | 5 | 100 % |" in md                              # Abschnitt „unerwartete Form"
    for secret in ("10012", "3475", "08:30"):
        assert secret not in md
    gen = _load("gen_capability_matrix")
    base = gen.label_counts()
    monkeypatch.setattr(gen, "OBS", o)
    lc = gen.label_counts()
    assert base["OBSERVED_PRODUCTION"] == 0 and lc["OBSERVED_PRODUCTION"] > 15 and lc["ABSENT"] > 5
    assert sum(lc.values()) == sum(base.values())                                           # keine Zeile verschwindet
    text = gen.render()
    assert "**Zensus vom 2026-10-09**" in text and "OBSERVED_PRODUCTION (cycling 5/5)" in text
    row = next(ln for ln in text.splitlines() if "`directBikeCadence`" in ln and ln.startswith("| Trittfrequenz"))
    assert "OBSERVED_PRODUCTION (cycling 5/5)" in row
    row = next(ln for ln in text.splitlines() if "`avgGroundContactTime`" in ln)
    assert "ABSENT (running 0/6)" in row and "| nein |" in row


def test_census_parser_rejects_garbage_and_reads_psql_tables():
    with pytest.raises(CR.CensusError):
        CR.parse_rows("")
    with pytest.raises(CR.CensusError):
        CR.parse_rows("irgendwas\nohne struktur")
    rows = CR.parse_rows("art,sport_id,name,aktivitaeten\nfeld,running,distance,12\nfeld,running,`boese|name`,3\n"
                         "unbekannt,running,x,1\nfeld,RUNNING,x,1\nfeld,running,avgPower,-2\nfeld,running,maxHR,abc\n")
    assert rows == [("feld", "running", "distance", 12)]
    table = """         art          | sport_id |   name   | aktivitaeten
----------------------+----------+----------+--------------
 feld                 | cycling  | avgPower |            5
 basis                | cycling  | alle     |            5
(2 rows)
"""
    assert CR.parse_rows(table) == [("feld", "cycling", "avgPower", 5), ("basis", "cycling", "alle", 5)]


# ═══════════════════════════════════════════════════════════════════════════
# Sportart-Migrationen 0049 / 0050
# ═══════════════════════════════════════════════════════════════════════════

OLD_FN = """create or replace function public.orvia_norm_sport(p_raw text) returns text language sql immutable as
$$ select case lower(trim(coalesce(p_raw,''))) when 'laufen' then 'running' when 'running' then 'running'
          when 'gym' then 'gym' when 'kraft' then 'gym' else 'other' end $$;"""


def _dry(pg) -> dict:
    rows = [r.split(",") for r in pg(file=SQL / "scripts" / "0050_sport_backfill_dryrun.sql", csv=True).splitlines()[1:]]
    out: dict = {}
    for art, source, name, n in rows:
        out.setdefault(art, {})[(source, name)] = int(n)
    return out


def test_sport_migrations_before_after_and_rollback(pg):
    pg("""
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    end $$;
    drop table if exists public.activities;
    create table public.activities (id serial primary key, user_id text, source text, sport_id text,
                                    duration_seconds int, metrics jsonb not null default '{}'::jsonb);
    """ + OLD_FN + """
    insert into public.activities (user_id, source, sport_id, duration_seconds, metrics) values
     ('u1','orvia_workout','other',20460,'{"source_sport_raw":"Yoga","corrections":{"duration":{"manual":4500,"source":20460}}}'),
     ('u1','orvia_workout','other',1800,'{"source_sport_raw":"hyrox"}'),
     ('u1','manual','other',1200,'{"source_sport_raw":" Bouldern "}'),
     ('u1','garmin','other',900,'{"source_sport_raw":"volleyball","streams":{"heart_rate":[1,2]}}'),
     ('u1','garmin','other',900,'{"source_sport_raw":"ice_hockey"}'),
     ('u1','garmin','other',900,'{"source_sport_raw":"track_running"}'),
     ('u1','manual','other',600,'{}'),
     ('u1','manual','other',600,'{"source_sport_raw":"quidditch"}'),
     ('u1','manual','other',600,'{"source_sport_raw":"   "}'),
     ('u2','orvia_workout','gym',4000,'{"source_sport_raw":"yoga"}'),
     ('u2','garmin','running',3000,'{}'),
     ('u2','manual','other',100,'[1,2]');
    """)
    snap = lambda: pg("select id, sport_id, duration_seconds, metrics - 'sport_backfill' from public.activities order by id;", csv=True)  # noqa: E731
    start = snap()

    before_fn = _dry(pg)
    assert before_fn["funktion"] == {("(0049)", "ALTER_STAND_0049_FEHLT"): 1}        # der Probelauf erkennt die fehlende 0049
    assert "wuerde_geaendert" not in before_fn

    pg(file=SQL / "migrations" / "0049_norm_sport_catalog.sql")
    pg(file=SQL / "migrations" / "0049_norm_sport_catalog.sql")                       # idempotent
    assert snap() == start                                                            # 0049 aendert keine Zeile
    got = pg("select string_agg(public.orvia_norm_sport(x), ',' order by ord) from unnest(array['Yoga','BOULDERN',' hyrox ','Feldhockey',"
             "'federball','golf','Rugby','Beachvolleyball','curling','Laufen','Kraft','ice_hockey']) with ordinality as t(x, ord);", csv=True)
    assert got.splitlines()[1] == '"yoga,climbing,hyrox,hockey,badminton,golf,rugby,volleyball,other,running,gym,other"'
    assert pg("select coalesce(public.orvia_norm_sport(null), 'NULL');", csv=True).splitlines()[1] == "other"

    dry = _dry(pg)
    assert dry["funktion"] == {("(0049)", "katalog_24_aktiv"): 1}
    assert dry["wuerde_geaendert"] == {("garmin", "volleyball -> volleyball"): 1, ("manual", "bouldern -> climbing"): 1,
                                       ("orvia_workout", "hyrox -> hyrox"): 1, ("orvia_workout", "yoga -> yoga"): 1}
    assert dry["bleibt_other"] == {("garmin", "ice_hockey"): 1, ("garmin", "track_running"): 1,
                                   ("manual", "(kein Rohtyp)"): 3, ("manual", "quidditch"): 1}
    assert "nachgetragen" not in dry and "ungueltig" not in dry
    assert sum(n for (src, sport), n in dry["bestand"].items() if sport == "other") == 10

    pg(file=SQL / "migrations" / "0050_sport_backfill_catalog.sql")
    after = _dry(pg)
    assert "wuerde_geaendert" not in after                                             # nichts mehr offen
    assert after["nachgetragen"] == {("garmin", "other -> volleyball"): 1, ("manual", "other -> climbing"): 1,
                                     ("orvia_workout", "other -> hyrox"): 1, ("orvia_workout", "other -> yoga"): 1}
    assert after["bleibt_other"] == dry["bleibt_other"]                                # echte Unbekannte bleiben other
    assert sum(n for (src, sport), n in after["bestand"].items() if sport == "other") == 6
    rows = {int(r.split(",")[0]): r for r in pg("select id, sport_id, duration_seconds, metrics::text from public.activities order by id;", csv=True).splitlines()[1:]}
    assert rows[1].startswith("1,yoga,20460,") and '""manual"": 4500' in rows[1] and '""source_sport_raw"": ""Yoga""' in rows[1]
    assert rows[4].startswith("4,volleyball,900,") and '""heart_rate"": [1, 2]' in rows[4]   # Messreihen unberuehrt
    assert rows[10].startswith("10,gym,4000,") and "sport_backfill" not in rows[10]          # war nie other: nicht angefasst
    assert rows[12].startswith("12,other,100,")                                              # kaputte metrics: nicht angefasst
    once = snap()
    pg(file=SQL / "migrations" / "0050_sport_backfill_catalog.sql")                    # zweiter Lauf
    assert snap() == once and _dry(pg) == after                                        # idempotent

    pg(file=SQL / "migrations_rollback" / "0050_sport_backfill_catalog_rollback.sql")
    assert snap() == start                                                             # Rueckweg stellt den Ausgang her
    assert pg("select count(*) from public.activities where metrics ? 'sport_backfill';", csv=True).splitlines()[1] == "0"
