"""GM7.4 · Integrationstests der Detail-/Serien-Sync-Verdrahtung gegen FakeDb +
echte Fixtures. Prüft: bounded/idempotenter Details-Backfill mit verlustfreiem
metrics-Merge, idempotente Serien-Upserts (keine Dubletten), fail-closed bei
fehlender user_metric_series-Tabelle (kein Loop/kein stiller Verlust), und
Teilfehler-Isolation. (asyncio.run-Muster wie test_sync_contract.)"""

import asyncio
import json
from pathlib import Path

from orvia_worker import detail_sync
from orvia_worker.providers.base import RateLimited
from tests.conftest import FakeDb

FIX = Path(__file__).parent / "fixtures" / "garmin"
DETAILS = json.load(open(FIX / "activity_details.json", encoding="utf-8"))
SLEEP = json.load(open(FIX / "sleep_series.json", encoding="utf-8"))
STRESS = json.load(open(FIX / "stress_series.json", encoding="utf-8"))


async def _seed_activities(db, user_id):
    await db.insert("activities", [
        {"user_id": user_id, "source": "garmin", "source_record_id": "A1", "metrics": {"training_load": 148}},
        {"user_id": user_id, "source": "garmin", "source_record_id": "A2",
         "metrics": {"route": [[0, 0], [1, 1]], "hasRoute": True,
                     "detailsFetchedAt": "2026-01-01T00:00:00+00:00", "detailsVersion": 1}},  # bereits detailliert (GM7.4.1-Marker)
    ])


def test_details_backfill_updates_only_undetailed_and_idempotent():
    async def run():
        db = FakeDb(); uid = "u1"
        await _seed_activities(db, uid)
        res = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
        assert res["updated"] == 1 and res["selected"] == ["A1"]     # A2 schon detailliert
        rows = await db.select("activities", {"user_id": uid, "source_record_id": "A1"})
        m = rows[0]["metrics"]
        assert m["hasRoute"] is True and 1 < len(m["route"]) <= 600
        assert m["training_load"] == 148                             # Bestehendes verlustfrei erhalten
        assert "heart_rate" in m["streams"]
        res2 = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
        assert res2["updated"] == 0 and res2["selected"] == []       # Idempotenz
    asyncio.run(run())


def test_details_partial_failure_does_not_abort():
    async def run():
        db = FakeDb(); uid = "u2"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": "B1", "metrics": {}},
            {"user_id": uid, "source": "garmin", "source_record_id": "B2", "metrics": {}},
        ])
        def get(aid):
            if aid == "B1":
                raise RateLimited("429")
            return DETAILS
        res = await detail_sync.sync_activity_details(db, uid, get, limit=10, max_retries=1)
        assert res["updated"] == 1 and "B1" in res["failed"]
        b2 = await db.select("activities", {"user_id": uid, "source_record_id": "B2"})
        assert b2[0]["metrics"]["hasRoute"] is True
    asyncio.run(run())


def test_series_upsert_idempotent():
    async def run():
        db = FakeDb(); uid = "u3"
        r1 = await detail_sync.sync_day_series(db, uid, "prov1", "2026-07-16", "Europe/Berlin",
                                               sleep_raw=SLEEP, stress_raw=STRESS)
        n = len(db.tables.get("user_metric_series", []))
        assert r1["upserted"] == n and n > 0
        await detail_sync.sync_day_series(db, uid, "prov1", "2026-07-16", "Europe/Berlin",
                                          sleep_raw=SLEEP, stress_raw=STRESS)
        assert len(db.tables["user_metric_series"]) == n            # keine Dubletten
        hyp = [r for r in db.tables["user_metric_series"] if r["metric_type"] == "sleep_stages"][0]
        assert hyp["point_count"] == len(hyp["points"]) and hyp["metric_date"] == "2026-07-16"
    asyncio.run(run())


def test_series_missing_table_fail_closed():
    class MissingTableDb(FakeDb):
        async def upsert(self, table, rows, on_conflict=None, returning=False):
            if table == "user_metric_series":
                raise RuntimeError('relation "user_metric_series" does not exist')
            return await super().upsert(table, rows, on_conflict, returning)

    async def run():
        db = MissingTableDb()
        res = await detail_sync.sync_day_series(db, "u4", "prov1", "2026-07-16", "Europe/Berlin",
                                                sleep_raw=SLEEP, stress_raw=STRESS)
        assert res.get("skipped") == "user_metric_series_missing"   # kontrolliert, kein Raise/Loop
        assert res["upserted"] == 0
    asyncio.run(run())


# ---------------------------------------------------------------------------
# GM7.4.1 · Detailvollständigkeitsvertrag — 6 Pflicht-Testfälle.
#
# Befund (Round GM7.4.1): `_has_route(metrics) = bool(metrics.get("route"))` war
# als "bereits detailliert"-Signal fehlerhaft — unabhängig von einer Cross-Source-
# Verwechslung (die strukturell ausgeschlossen ist, siehe Bericht: der Worker
# selektiert Aktivitäten ausschließlich über {source:"garmin"}; GPX-/manuelle
# Importe laufen in der App unter source:"manual"/"import" und werden von
# activityStore.mergeServerActivities NUR über den Schlüssel (source,
# source_record_id) gemerged — ein Garmin- und ein Import-Datensatz teilen sich
# nie diesen Schlüssel, es entsteht nie eine gemeinsame Zeile). Der reale,
# reproduzierbare Fehler: eine Indoor-/GPS-lose Garmin-Aktivität hat NIE eine
# Route, obwohl get_activity_details für sie bereits erfolgreich Streams
# geliefert hat — sie wäre mit `_has_route` bei JEDEM Sync erneut abgerufen
# worden (Idempotenz-Bruch + unnötige Provider-Last). Umgekehrt würde jede
# Aktivität, die aus irgendeinem Grund (heute: keinem; als Schutz für künftige
# Pfade) bereits eine `route` trägt, OHNE je detailliert worden zu sein, fälsch-
# lich als vollständig übersprungen — ihre HF-/Kadenz-/Höhen-Streams blieben für
# immer ungeladen. Fix: expliziter Abschluss-Marker (`detailsFetchedAt` +
# `detailsVersion`), gesetzt NUR nach einem tatsächlich erfolgreichen
# get_activity_details-Merge — unabhängig vom Inhalt der Antwort.
# ---------------------------------------------------------------------------

def test_gm741_case1_no_route_no_details_is_selected_and_backfilled():
    """Fall 1: keine Route, keine Details -> muss ausgewählt und angereichert werden."""
    async def run():
        db = FakeDb(); uid = "c1"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": "X1", "metrics": {}},
        ])
        res = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
        assert res["selected"] == ["X1"] and res["updated"] == 1
        rows = await db.select("activities", {"user_id": uid, "source_record_id": "X1"})
        m = rows[0]["metrics"]
        assert m["hasRoute"] is True and m.get("detailsFetchedAt") and m.get("detailsVersion") == detail_sync.DETAILS_CONTRACT_VERSION
    asyncio.run(run())


def test_gm741_case2_route_without_marker_is_still_selected():
    """Fall 2: eine Aktivität traegt bereits `route`, aber KEINEN Abschluss-Marker
    (z.B. altbestand aus der Zeit vor GM7.4.1, oder ein künftiger Pfad, der Route
    ausserhalb von get_activity_details setzt). Die alte, routenbasierte Prüfung
    hätte sie fälschlich als "fertig" übersprungen -> Streams wären nie geladen
    worden. Der neue Marker-Vertrag muss sie weiterhin auswählen."""
    async def run():
        db = FakeDb(); uid = "c2"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": "X2",
             "metrics": {"route": [[0, 0], [1, 1]], "hasRoute": True}},   # KEIN Marker
        ])
        res = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
        assert res["selected"] == ["X2"] and res["updated"] == 1     # Kernbefund GM7.4.1
        rows = await db.select("activities", {"user_id": uid, "source_record_id": "X2"})
        m = rows[0]["metrics"]
        assert "heart_rate" in m["streams"] and m.get("detailsFetchedAt")
    asyncio.run(run())


def test_gm741_case3_route_and_partial_streams_with_marker_not_reselected():
    """Fall 3: Route + EINIGE (nicht alle möglichen) Streams bereits vorhanden,
    Marker gesetzt (ein realer Garmin-Detailabruf liefert nie zwingend jeden
    denkbaren Stream) -> gilt als abgeschlossen, kein erneuter Abruf."""
    async def run():
        db = FakeDb(); uid = "c3"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": "X3",
             "metrics": {"route": [[0, 0], [1, 1]], "hasRoute": True,
                         "streams": {"heart_rate": [120, 130]}, "stream_units": {"heart_rate": "bpm"},
                         "detailsFetchedAt": "2026-01-01T00:00:00+00:00",
                         "detailsVersion": detail_sync.DETAILS_CONTRACT_VERSION}},
        ])
        res = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
        assert res["selected"] == [] and res["updated"] == 0
    asyncio.run(run())


def test_gm741_case4_fully_enriched_never_refetched():
    """Fall 4: vollständig angereichert (Route+Streams+Splits-Feld+Marker) -> darf
    über beliebig viele Syncs NIE erneut abgerufen werden."""
    async def run():
        db = FakeDb(); uid = "c4"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": "X4",
             "metrics": {"route": [[0, 0], [1, 1]], "hasRoute": True,
                         "streams": {"heart_rate": [1], "cadence": [1], "elevation": [1], "speed": [1], "distance": [1]},
                         "stream_units": {}, "detailsFetchedAt": "2026-01-01T00:00:00+00:00",
                         "detailsVersion": detail_sync.DETAILS_CONTRACT_VERSION}},
        ])
        for _ in range(3):
            res = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
            assert res["selected"] == [] and res["updated"] == 0
    asyncio.run(run())


def test_gm741_case5_failed_partial_fetch_not_marked_complete():
    """Fall 5: der Abruf schlägt fehl (nicht-transienter Fehler) -> Aktivität bleibt
    OHNE Marker (nicht faelschlich als fertig markiert) und landet in `failed`,
    damit ein spaeterer Sync sie erneut versucht."""
    async def run():
        db = FakeDb(); uid = "c5"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": "X5", "metrics": {}},
        ])
        def boom(aid):
            raise ValueError("permanent")
        res = await detail_sync.sync_activity_details(db, uid, boom, limit=10, max_retries=1)
        assert res["updated"] == 0 and "X5" in res["failed"]
        rows = await db.select("activities", {"user_id": uid, "source_record_id": "X5"})
        assert not rows[0]["metrics"].get("detailsFetchedAt")
        # naechster Sync (Provider jetzt erreichbar) muss X5 erneut auswaehlen:
        res2 = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
        assert res2["selected"] == ["X5"] and res2["updated"] == 1
    asyncio.run(run())


def test_gm741_case6_repeated_sync_idempotent_no_duplicate_merge():
    """Fall 6: wiederholter Sync ueber mehrere Läufe -> kein Duplikat, keine
    veraenderten Werte nach dem ersten erfolgreichen Merge, kein erneuter Abruf."""
    async def run():
        db = FakeDb(); uid = "c6"
        await db.insert("activities", [
            {"user_id": uid, "source": "garmin", "source_record_id": "X6", "metrics": {"training_load": 55}},
        ])
        res1 = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
        assert res1["updated"] == 1
        rows1 = await db.select("activities", {"user_id": uid, "source_record_id": "X6"})
        m1 = dict(rows1[0]["metrics"])
        for _ in range(2):
            res_n = await detail_sync.sync_activity_details(db, uid, lambda aid: DETAILS, limit=10)
            assert res_n["updated"] == 0 and res_n["selected"] == []
        rows2 = await db.select("activities", {"user_id": uid, "source_record_id": "X6"})
        assert rows2[0]["metrics"] == m1                                   # unveraendert
        assert len(await db.select("activities", {"user_id": uid, "source_record_id": "X6"})) == 1  # keine Dublette
    asyncio.run(run())
