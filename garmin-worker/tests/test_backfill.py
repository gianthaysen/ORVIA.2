"""GM7.4 · Vertragstest für den begrenzten, idempotenten Activity-Details-Backfill:
nur neue/undetaillierte, gedeckelt, bereits detaillierte nie erneut, Retry mit
Begrenzung + Rate-Limit-Hook, Teilfehler überspringen (kein Abbruch). Injizierter
Fetch (Fixture) — kein Live-Garmin. RED zuerst (Modul fehlt)."""

import json
from pathlib import Path

from orvia_worker.backfill import backfill_activity_details
from orvia_worker.providers.base import RateLimited

FIX = Path(__file__).parent / "fixtures" / "garmin"
DETAILS = json.load(open(FIX / "activity_details.json", encoding="utf-8"))


def test_backfill_only_new_bounded_idempotent():
    calls = []

    def fetch(aid):
        calls.append(aid)
        return DETAILS

    res = backfill_activity_details(["a", "b", "c", "d"], ["b"], fetch, limit=2)
    assert res["selected"] == ["a", "c"]                 # nur neue, gedeckelt auf 2
    assert set(res["details"].keys()) == {"a", "c"}
    assert res["details"]["a"]["hasRoute"] is True       # echte Parser-Ausgabe
    assert calls == ["a", "c"]                            # bereits detailliert (b) nicht geladen
    # Idempotenz: nächster Lauf mit a,c als erledigt nimmt d
    res2 = backfill_activity_details(["a", "b", "c", "d"], ["b", "a", "c"], fetch, limit=2)
    assert res2["selected"] == ["d"]


def test_backfill_retry_then_success_and_ratelimit_hook():
    attempts = {"n": 0}
    rl = {"n": 0}

    def flaky(aid):
        attempts["n"] += 1
        if attempts["n"] < 3:                             # 2× Rate-Limit, dann Erfolg
            raise RateLimited("429")
        return DETAILS

    res = backfill_activity_details(["x"], [], flaky, limit=5, max_retries=3,
                                    on_rate_limit=lambda a: rl.__setitem__("n", rl["n"] + 1))
    assert "x" in res["details"]                          # nach Retries erfolgreich
    assert rl["n"] == 2                                   # Hook 2× ausgelöst


def test_backfill_partial_failure_skips_not_aborts():
    def fetch(aid):
        if aid == "b":
            raise RateLimited("429")                      # bleibt fehlerhaft
        return DETAILS

    res = backfill_activity_details(["a", "b", "c"], [], fetch, limit=5, max_retries=1)
    assert "a" in res["details"] and "c" in res["details"]
    assert "b" not in res["details"]                      # Teilfehler übersprungen
    assert "b" in res["failed"]
