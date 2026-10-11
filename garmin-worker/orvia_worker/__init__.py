"""ORVIA Garmin-Sync-Worker.

Importiert bewusst KEINE Settings beim Paket-Import (import-safe für Tests).
"""

# v8-447.1 · Stand des Workers. Erscheint im Healthcheck, damit sich von aussen pruefen
# laesst, WELCHER Stand ausgerollt ist (vorher antwortete /healthz nur {"ok": true}).
# Bei jeder Worker-Aenderung, die ausgerollt wird, anheben.
WORKER_BUILD = "v8-447.1"

__all__ = ["WORKER_BUILD"]
