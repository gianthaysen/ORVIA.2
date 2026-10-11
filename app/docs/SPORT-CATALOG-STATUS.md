# Sport-Katalog — Stand je Sportart

**Status: IMPLEMENTED** · Stand v8-447.1 · erzeugt durch `node app/tools/gen-sport-catalog-doc.mjs` aus dem Code. Nicht von Hand ändern.

Der Katalog hat **24** Sportarten. Jede ist in der App eine eigene kanonische ID; `other` ist der Rückfall.

| canonical ID | displayName | normalisiert (App) | Aliasse (App) | Serverfunktion (0049) | Garmin-Typen | manuell erfassbar | Formular-Profil | Signatur |
|---|---|---|---|---|---|---|---|---|
| `gym` | Krafttraining | ja | 6 | ja | 2: `strength_training`, `indoor_cardio` | ja | gym | defined |
| `running` | Laufen | ja | 4 | ja | 9: `running`, `trail_running`, `treadmill_running`, `track_running`, `street_running`, `indoor_running`, `virtual_run`, `ultra_run`, `obstacle_run` | ja | distance_pace | defined |
| `cycling` | Radfahren | ja | 6 | ja | 13: `cycling`, `road_biking`, `gravel_cycling`, `mountain_biking`, `virtual_ride`, `indoor_cycling`, `cyclocross`, `track_cycling`, `recumbent_cycling`, `downhill_biking`, `bmx`, `e_bike_fitness`, `e_bike_mountain` | ja | distance_speed | defined |
| `swimming` | Schwimmen | ja | 3 | ja | 2: `lap_swimming`, `open_water_swimming` | ja | distance_pace_swim | implemented (waves) |
| `triathlon` | Triathlon | ja | 1 | ja | 2: `multi_sport`, `triathlon` | ja | duration | defined |
| `football` | Fußball | ja | 4 | ja | 1: `soccer` | ja | session_kind | defined |
| `handball` | Handball | ja | 1 | ja | 1: `handball` | ja | session_kind | defined |
| `padel` | Padel | ja | 2 | ja | 1: `padel` | ja | session_kind | defined |
| `tennis` | Tennis | ja | 1 | ja | 2: `tennis`, `tennis_v2` | ja | session_kind | defined |
| `athletics` | Leichtathletik | ja | 3 | ja | 0 | ja | duration | defined |
| `basketball` | Basketball | ja | 2 | ja | 1: `basketball` | ja | session_kind | defined |
| `rowing` | Rudern | ja | 2 | ja | 3: `rowing`, `indoor_rowing`, `rowing_v2` | ja | distance | defined |
| `hiking` | Wandern | ja | 2 | ja | 1: `hiking` | ja | distance | defined |
| `walking` | Gehen | ja | 3 | ja | 3: `walking`, `casual_walking`, `speed_walking` | ja | distance | defined |
| `mobility` | Mobility | ja | 4 | ja | 1: `mobility` | ja | duration | defined |
| `other` | Andere | ja | 4 | ja | 0 | ja | duration | fallback |
| `volleyball` | Volleyball | ja | 2 | ja | 1: `volleyball` | ja | session_kind | defined |
| `hockey` | Hockey | ja | 2 | ja | 1: `field_hockey` | ja | session_kind | defined |
| `rugby` | Rugby | ja | 1 | ja | 1: `rugby` | ja | session_kind | defined |
| `badminton` | Badminton | ja | 2 | ja | 1: `badminton` | ja | session_kind | defined |
| `golf` | Golf | ja | 1 | ja | 1: `golf` | ja | duration | defined |
| `climbing` | Klettern | ja | 6 | ja | 3: `rock_climbing`, `bouldering`, `indoor_climbing` | ja | duration | defined |
| `yoga` | Yoga | ja | 1 | ja | 1: `yoga` | ja | duration | defined |
| `hyrox` | HYROX | ja | 1 | ja | 1: `hyrox` | ja | duration | defined |

## Zusammenfassung

- **Normalisierung App:** 24 von 24 IDs sind kanonisch gültig.
- **Serverfunktion nach Migration 0049:** 24 von 24. Ohne 0049 kennt der Server 16 — acht Katalog-Sportarten würden beim Abschluss eines ORVIA-Workouts als `other` gespeichert.
- **Garmin:** 52 Typen führen auf 22 Sportarten. Ohne eigenen Garmin-Typ: `athletics`, `other` (Leichtathletik zeichnet Garmin als Lauf auf; `other` ist der Rückfall selbst).
- **Manuell erfassbar** (Auswahl „Weitere Aktivität"): 24 von 24.
- **Signaturen:** 24 im Katalog · 23 ausdrücklich definiert, davon 1 gezeichnet · 1 dokumentierter Rückfall · 0 fehlend.

## Was noch auf `other` führt

1. **Garmin-Typen ohne Zuordnung.** Jeder Typ, der nicht in der Tabelle steht — aus Tests bekannt: `ice_hockey`, `american_football`, `hiit`, `pilates`. Bewusst nicht zugeordnet, weil ORVIA dafür keine Sportart hat (Katalog-Hockey ist Feldhockey).
   Welche Typen **tatsächlich** in den Daten vorkommen, zeigt nur der Feldzensus (Zeilen `typ | other | <typ>`). Der Typ bleibt in jedem Fall erhalten (`metrics.garmin.type_key`).
2. **Altbestand.** Zeilen, die vor v8-447 als `other` gespeichert wurden: Migration 0050 stellt um, was die Serverfunktion kennt und dessen Rohtyp erhalten ist; Garmin-Untertypen (`track_running` …) stellt der Worker um.
3. **Echter Rückfall.** Vom Nutzer gewählte „Andere Aktivität", eigene Sportarten ohne Katalog-Entsprechung, Zeilen ohne erhaltenen Rohtyp.

Vorher/Nachher-Zählung: `supabase/scripts/0050_sport_backfill_dryrun.sql` (nur lesend).
