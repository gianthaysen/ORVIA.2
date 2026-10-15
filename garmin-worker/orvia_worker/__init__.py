"""ORVIA Garmin-Sync-Worker.

Importiert bewusst KEINE Settings beim Paket-Import (import-safe für Tests).
"""

# v8-447.1 · Stand des Workers. Erscheint im Healthcheck, damit sich von aussen pruefen
# laesst, WELCHER Stand ausgerollt ist (vorher antwortete /healthz nur {"ok": true}).
# Bei jeder Worker-Aenderung, die ausgerollt wird, anheben.
# v8-447.2 · Gate-Abschluss: Herkunfts-Backfill fuer unvollstaendige Bloecke, Bedeutungspruefung
# aus der vollstaendigen Antwort, gezielter Neuabruf (DETAIL_REFETCH_RESOLUTION, Standard AUS).
# v8-447.3 · Herkunft: Status, Metadaten-Backfill aus der Liste (PROVENANCE_BACKFILL, Standard AUS),
# Neupruefung der Bedeutung (DETAIL_REFETCH_SEMANTICS, Standard AUS).
WORKER_BUILD = "v8-447.3"

__all__ = ["WORKER_BUILD"]
