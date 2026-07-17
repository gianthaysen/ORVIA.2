"""Capability-Zustandsmaschine (Design §6): Beobachtung schlägt Modellmatrix.

fetch_outcome:
- 'value': der Abruf hat für diese Metrik einen echten Wert geliefert
- 'empty': Abruf ok (auch 404/leer), aber kein Wert für diese Metrik
- 'error': Abruf fehlgeschlagen (Transport/Auth/5xx)

Regeln:
- Wert geliefert                       -> observed (immer)
- leer und vorher nie beobachtet       -> not_observed
- leer, aber früher beobachtet         -> observed bleibt observed
- Fehler                               -> sync_failed, AUSSER die Fähigkeit war
                                          schon observed (bleibt observed)
- last_valid_value_at wird nur bei 'value' aktualisiert (macht der Sync).
"""

from __future__ import annotations

VALID_OUTCOMES = ("value", "empty", "error")


def derive_capability(prior_status: str | None, fetch_outcome: str) -> str:
    if fetch_outcome not in VALID_OUTCOMES:
        raise ValueError(f"Unbekanntes fetch_outcome: {fetch_outcome!r}")

    if fetch_outcome == "value":
        return "observed"

    if prior_status == "observed":
        # Einmal beobachtete Fähigkeiten bleiben beobachtet — ein leerer Tag
        # oder ein Abruffehler löscht kein Wissen über das Gerät.
        return "observed"

    if fetch_outcome == "empty":
        return "not_observed"

    return "sync_failed"
