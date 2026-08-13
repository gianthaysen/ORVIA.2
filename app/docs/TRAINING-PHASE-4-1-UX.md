# ORVIA · Phase 4.1 — UX-Architektur Trainingsdomäne (nur Struktur, keine Umsetzung)

Diese Datei definiert die **spätere** Navigation und Seitenstruktur. In Phase 4.1 wird **keine**
neue UI gebaut; vorhandene Bereiche dürfen höchstens als *vorbereitet/demnächst* gekennzeichnet
werden. Keine nicht funktionierenden Buttons ohne Kennzeichnung.

## Navigation (Training)
```
Training
├── Heute        (heutige Einheit, Readiness, Entscheidung, „Einheit starten")
├── Plan         (aktiver Plan, Wochenübersicht, Vorlagen, eigenen Plan erstellen)
├── Bibliothek   (Übungen, Filter: Muskel/Equipment/Sportart, Favoriten)
├── Verlauf      (Workouts, Übungsstatistiken, PRs, Volumen, Trends)
└── Körper       (Muskelvolumen, Erholung, direkte/indirekte Sätze, Vorder-/Rückansicht)
```
Mobile: Bottom-Tab-Leiste (bestehender Stil), Sekundärnavigation als Segmente innerhalb der Seite.

## Seiten & Hauptaktionen
- **Heute:** heutige Einheit (aus Plan), Readiness-Score + Entscheidung (bestehend), letzte Leistung der Übungen, Primäraktion „Einheit starten" → Live-Workout (Phase 4.2). Status: Datenmodell bereit (`workout_sessions/_exercises/_sets`), Live-Tracking **noch nicht** aktiv.
- **Plan:** aktiver `user_training_plan` + Wochenstruktur (`training_plan_days/_exercises`), Vorlagenliste (`workout_templates`, System lesbar), „aus Vorlage übernehmen" (`copyFromTemplate`), „eigenen Plan erstellen". Engine/Autoplan: **demnächst**.
- **Bibliothek:** `exercises` (System + eigene), Filter über `movement_pattern`/`equipment`/`muscle`, Favoriten (später). Minimal-Seeds vorhanden (~20 Übungen) — **keine** vollständige Bibliothek.
- **Verlauf:** `workout_sessions` + abgeleitete Statistiken (1RM, Volumen, PRs, RIR/RPE-Trend) — Berechnungen Phase 4.2+. Daten historisch unveränderlich (abgeschlossene Workouts nicht still überschreiben).
- **Körper:** Körperkarte (`muscle_groups.visual_key` → Region/Seite/Ansicht). Zustände (`BODY_MAP_STATES`: no_data/insufficient/under_target/optimal/over_target/overloaded/not_prioritized) als Vokabular vorbereitet — **keine** Grenzwerte/Ampel berechnet.

## Zustände (jede Seite)
- **Leer:** „Noch keine Daten — lege einen Plan an / starte eine Einheit."
- **Laden:** Skeleton/Spinner; kein alter Score/Plan vor Abschluss der Hydrierung.
- **Fehler:** strukturierte Repo-Fehler sichtbar machen (kein stilles Verschlucken).
- **Komplexität:** Anfänger = reduzierte Felder/Vorschläge; Profi = volle Satz-/RIR-Details.

## Körperkarten-Vorbereitung (kein SVG/3D in 4.1)
`muscle_group.key → visual_key → body_region → body_side → body_view(front/back)` ist im Schema +
`trainingDomain.MUSCLE_GROUPS` hinterlegt, sodass später jede Muskelgruppe farblich adressierbar ist.

## Muskelvolumen-Fachmodell (vorbereitet, NICHT berechnet)
Spätere Basis: `effektives Volumen = direkte Sätze + gewichtete indirekte Sätze × Satzqualität ×
Intensitätsfaktor × RIR-Faktor`. Das Schema ermöglicht es bereits: `exercise_muscles` (weight,
involvement direct/indirect), `workout_sets` (set_type, rir/rpe), spätere Muskel-Prioritäten
(`MUSCLE_PRIORITIES`: weak_point/normal/maintain/not_prioritized/sport_specific). **Keine** endgültige
Formel oder Ampel in 4.1.

## „Noch nicht fertig" — klare Kennzeichnung
Live-Satztracking, Autoplan, 30 Pläne, Körperkarte, Volumen-Ampel, Progression, Autoregulation sind
**vorbereitet** (Datenbasis eingerichtet), aber **nicht** funktionsfähig. UI muss das so kennzeichnen.
