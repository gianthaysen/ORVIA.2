# Garmin-Nachladen — Stand

**Status: NOCH NICHT GESTARTET** · angelegt mit v8-447.1 am 2026-10-07

Das Nachladen beginnt mit dem ersten Lauf des Workers v8-447.1. Dieses Dokument enthält noch **keine**
Produktionszahlen; es wird durch `garmin-worker/scripts/census_report.py` überschrieben (dieselbe Abfrage
wie der Feldzensus liefert die Zeilen `nachladen`, `tempo`, `abtastung`).

## Kennzahlen, die dann hier stehen

| Kennzahl | Quelle in der Abfrage |
|---|---|
| Garmin-Aktivitäten gesamt | `basis / alle` |
| auf Details-Vertrag 3 | `nachladen / aktuell` |
| offen (alter Vertrag · noch nie geladen · mit Fehler) | `offen_alt` · `offen_neu` · `fehler:<Klasse>` |
| zurückgestellt | `zurueckgestellt:<Klasse>` |
| Fehlerklassen | `NOT_FOUND`, `UNSUPPORTED`, `MALFORMED`, `UNKNOWN` (nur diese werden einer Aktivität angelastet) |
| zuletzt nachgeladen · in 24 h nachgeladen | `tempo` |
| früheste Fertigstellung | offen / 10 je Lauf × 30 min — Untergrenze |

Derselbe Stand steht nach jedem Sync-Lauf im Protokoll des Workers (`railway logs`), als eine Zeile ohne
personenbezogene Angaben: `backfill contract=3 total=… current=… pending=… failing=… deferred=… eta_h>=…`;
je Aktivität eine Zeile `details activity=<interne Nummer> sport=… version=2->3 status=ok` bzw.
`status=failed category=… retry_after=…`. Garmin-Kennungen stehen nicht im Protokoll.

## Erwartung (keine Messung)

Rund 160 Aktivitäten bei 10 je Lauf und einem Lauf alle 30 Minuten: frühestens nach etwa 8 Stunden.
Rate-Limits beenden einen Lauf sofort und verlängern die Pause — das Nachladen wird dadurch langsamer,
nicht fehlerhaft. Es wird bewusst nicht beschleunigt.

## Wie das Nachladen arbeitet

- Je Sync-Lauf höchstens `DETAIL_BACKFILL_LIMIT` Aktivitäten (Standard 10), noch nie geladene zuerst, dann die neuesten.
- Fortsetzbar: der Stand steht an jeder Aktivität (`detailsVersion`, `detailsFetchedAt`); ein Neustart verliert nichts
  und lädt nichts doppelt.
- **Rate-Limit (429) oder ungültige Sitzung beenden den Lauf sofort**; der Lauf gilt als nicht erfolgreich, der
  Zeitplaner verlängert die Pause. Nichts davon wird einer Aktivität angelastet.
- Zwei Netzfehler in Folge beenden den Lauf ebenfalls.
- Nur Fehler, die genau eine Aktivität betreffen (`NOT_FOUND`, `UNSUPPORTED`, `MALFORMED`), zählen; nach drei
  solchen Fehlern wird die Aktivität sieben Tage zurückgestellt. Ein Erfolg löscht den Vermerk.
