import pytest

from orvia_worker.capabilities import derive_capability


def test_value_always_observed():
    for prior in (None, "unknown", "not_observed", "sync_failed", "observed"):
        assert derive_capability(prior, "value") == "observed"


def test_empty_never_observed_before():
    assert derive_capability(None, "empty") == "not_observed"
    assert derive_capability("unknown", "empty") == "not_observed"
    assert derive_capability("not_observed", "empty") == "not_observed"


def test_empty_keeps_observed():
    # Ein leerer Tag löscht kein Wissen über das Gerät.
    assert derive_capability("observed", "empty") == "observed"


def test_error_sync_failed():
    assert derive_capability(None, "error") == "sync_failed"
    assert derive_capability("not_observed", "error") == "sync_failed"
    assert derive_capability("sync_failed", "error") == "sync_failed"


def test_error_keeps_observed():
    assert derive_capability("observed", "error") == "observed"


def test_unknown_outcome_raises():
    with pytest.raises(ValueError):
        derive_capability(None, "banana")
