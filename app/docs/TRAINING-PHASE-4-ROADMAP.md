# ORVIA · Trainings-Phase-4 Roadmap

Statuslegende: ✅ implementiert & automatisiert getestet · 🟡 implementiert, nur Mock-/Node-getestet · 🧪 Test/Migration vorbereitet, nicht live · 📱 Geräteprüfung offen · ⬜ offen

---

## 4.1 — Trainingsarchitektur & Datenmodell
**Ziel:** Navigation, Repositories, Übungen, Pläne, Muskelgruppen, Domänen-Enums.
**Umfang:** 5-Tab-Nav (Heute/Kalender/Training/Insights), Repos (workout/exercise/trainingPlan/…), `training-domain` (Sportarten, Muskelgruppen, Bewegungsmuster, Status-Vokabular), Supabase 0002–0003.
**Abnahme:** Nav konsistent, Repos auth-scoped, Domänen-Enums deckungsgleich mit DB.
**Status:** ✅/🟡 — Repos & Domäne getestet; Nav 📱 am Gerät offen.
**Abhängigkeiten:** Supabase-Schema 0002/0003 (live).
**Offen:** physische Plan-Inhalts-Verteilung Kalender/Training/Insights (Links statt DOM-Split).

## 4.2 — Live-Workout & Aktivitätserfassung
**Ziel:** Workout-Lifecycle, Sätze/Übungen, sportartspezifische Live-Modi, sauberer Abschluss.
**Umfang:** Gym-Satzmodus; Dauer-/Distanzmodus (Lauf/Rad/Schwimmen/Mobility); Lauf-Intervalle; Schwimm-Bahnen; atomare Terminal-RPC (`orvia_close_active_workout`, 0007); kein Auto-Overlay; Bottom-Sheets statt nativer Prompts; SSOT-Spiegelung in `DB.sessions`.
**Abnahme:** Abschluss/Abbruch/Löschen serverseitig bestätigt; keine festhängende aktive Session; App startet auf Heute.
**Status:** ✅/🟡 — Lifecycle/Repo/Calc Node-getestet; 0007 live; RPC-Smoke 🧪; 📱 offen.
**Tests:** live_workout_* (Suite), workout_lifecycle, workout_repo_norow, intervals, swim_pace.
**Offen:** Rad-Detail (Watt/Kadenz), Team-Felder, distanzbasierte Intervalle/Splits, Gym-Satz-Vorbefüllung aus Plan.

## 4.3 — Körperkarte & Muskelvolumen
**Ziel:** direkte/indirekte Sätze, Körperansicht, Zeiträume, differenzierter Status.
**Umfang:** `Calc.aggregateMuscleVolume/muscleVolumeStatus/muscleWeeklyEquivalent`; RPC `orvia_muscle_volume` (0008, gruppiert, distinct sessions, Warm-up aus, Zeitraum validiert); UI mit Fallback-Fällen, Race-Schutz, Tap-Detail, Tastatur, eindeutige Farben.
**Abnahme:** echte abgeschlossene Workouts, Zeitraum-Normalisierung, keine „Überlastet" aus Absolutwert, keine Doppelzählung.
**Status:** 🟡 implementiert; ✅ Calc/Repo Node-getestet; 🧪 SQL-Integrationstest; ⬜ 0008 noch einzuspielen; 📱 offen.
**Offen:** **anatomische SVG-Körperkarte (Teil B unten)**, echte Deduplication, muskelspezifische Beschwerden, UI-Integrationstests.

## 4.4 — Aktivitätseditor & Datenkorrektur  ← AKTUELLER BATCH (NOCH NICHT ABGENOMMEN)
**Ziel:** Sportart/Werte korrigieren, abgeleitete Statistiken invalidieren & neu berechnen.
**Umfang:** „Aktivität bearbeiten" (Sportart/Untertyp/Datum/Dauer/Distanz/HF/Höhe/RPE/Notiz), Löschen, Plausibilitätswarnung, Sportartwechsel-Bestätigung, Zielkonflikt-Schutz, echte Feld-Lösch-Semantik (Pflichtfeld-validiert via `applyActivityPatchPreview`), lokale konsistente Verschiebung ohne Supabase-Persistenz (`Calc.moveActivity`), Cache-Invalidierung + Re-Render; externe ID/Quelle/Route bleiben. Zentraler Lauf-Filter `Calc.isValidRunForAnalytics`.
**Abnahme:** Lauf↔Rad korrigierbar OHNE bestehende Aktivität zu überschreiben; falsche Laufstatistiken verschwinden; nur zentral validierte Läufe in Prognosen; Feld-Leeren entfernt Altwert; Korrektur reload-fest im DB-Modell.
**Status (ehrlich):**
- ✅ Node-getestet (41 Tests): Plausibilität, `moveActivity` (Zielkonflikt + Lösch-Semantik), `isValidRunForAnalytics`, `applyActivityPatchPreview`==moveActivity-Feldstruktur, Editor-Pflichtfeldlogik (Distanz/Dauer leeren blockiert, optionale Felder löschbar), Integration Wochen-km vor/nach Korrektur.
- ✅ DOM-nah getestet (6 Tests, Stub-Load): `detectPBs` (unplausibler aktueller/Vergleichslauf ausgeschlossen) und `rateActivity` („Daten prüfen" statt Lob).
- ✅ Zentraler Lauf-Filter angewendet in: `runsWindow`, `weekRunKm`, `trainingFeedback` (inkl. aktuellem Lauf), `detectPBs` (intern + Aufrufer-Gate), `rateActivity`. `goalEngine`/`efSeries`/`riegelHM` beziehen ihre Läufe aus `runsWindow`/`detectPBs` und sind damit mitgefiltert.
- 🟡 nur lokal (DB-Blob): Korrektur ändert lokales `DB` + `save()`. **KEINE Supabase-/Sync-Persistenz** (manuelle Aktivitäten liegen ohnehin nur lokal; Live-Workouts in Supabase werden vom Editor NICHT serverseitig aktualisiert).
- 🟡 nur Code/Node: DOM-Editor (`openEditActivity`/`saveEditActivity`) nicht im echten DOM gerendert; Editor-Logik aber durch Stub-Tests der Entscheidungslogik abgedeckt.
- 📱 Geräteprüfung offen.
**Offen:** Datenqualitäts-Banner („Daten prüfen"); Supabase-RPC-Update für Live-Workout-Aktivitäten (Option A); UI-Pfad für Zielkonflikt-Auflösung (Datum/Sportart neu wählen) komfortabler.
**BLOCKER (Datenmodell):** `DB[date].sessions[type]` erlaubt nur EINE Aktivität je Sportart und Tag — siehe nächster Abschnitt. Der Editor macht das sichtbar (Zielkonflikt), behebt es aber nicht.

### Datenmodell-Limitierung (PRODUKTREIFE-BLOCKER)
`DB[date].sessions[type]` kann pro Tag nur eine Aktivität je Sportart abbilden. Nicht darstellbar:
zwei Läufe/Tag, Rad morgens + abends, zwei Gym-Einheiten, Wettkampf + Ein-/Auslaufen, Brick mit mehreren Einheiten gleicher Sportart.
**Keine Migration in diesem Batch.** Zielmodell (später):
```
DB[date].activities = [{ id, sportKey, date, dist, dur, ... }]   // stabile ID
```
bzw. Supabase als SSOT mit stabiler Activity-/Session-ID; Editor arbeitet künftig über ID statt Datum+Sportart. Bis dahin ist 4.4 nicht produktreif abgenommen.

## 4.5 — Bibliothek & Workout-Editor
**Ziel:** Übungen, Vorlagen, Favoriten, Ersatzübungen, eigene Übungen.
**Status:** ⬜ (Bibliothek 0006 live, Editor offen).

## 4.6 — Progression & Leistungsanalyse
**Ziel:** PRs, 1RM, Volumen-Trends, RIR/RPE, Plateaus.
**Status:** ⬜.

## 4.7 — Intelligente Trainingsplanung
**Ziel:** individuelle Pläne aus Zielen/Terminen/Verfügbarkeit/Equipment.
**Status:** ⬜ (Plan-Grundgerüst/Phasen aus 4.1/E2 vorhanden).

## 4.8 — Autoregulation & Belastungssteuerung
**Ziel:** Readiness, Beschwerden, Schlaf, HRV, Tagesanpassung.
**Status:** ✅/🟡 (Phase-3-Readiness/Decision vorhanden & getestet).

## 4.9 — Integrationen & Datenqualität
**Ziel:** Garmin/Strava/Health, Sync, Duplikate, Konflikte.
**Status:** 🟡 (GPX/TCX/JSON-Import + Dedup-Logik vorhanden; Auto-Sync ⬜).

## 4.10 — Produktreife & Premium-UX
**Ziel:** Onboarding (Teil E), Responsive (Teil C), Insights-Redesign (Teil D), Accessibility, QA.
**Status:** ⬜ — in dieser Stabilisierungsphase angefordert, noch nicht umgesetzt.

---

## Abschlusskriterien Teil A (erst dann „fertig")
1. ✅ Lauf→Rad überschreibt keine bestehende Radfahrt (Zielkonflikt-Guard, getestet).
2. ✅ Falsche Felder vollständig entfernbar (Lösch-Semantik, getestet).
3. ✅ Falscher 30-km-„Lauf" verschwindet aus Laufstatistiken (Filter + Move, getestet).
4. ✅ Bestzeiten/Prognosen/Feedback/Bewertung nutzen nur zentral validierte Läufe (`isValidRunForAnalytics` in runsWindow/weekRunKm/trainingFeedback/detectPBs/rateActivity; getestet).
5. 🟡 Reload-fest: im lokalen DB-Modell ja (getestet); Supabase-Persistenz NICHT.
6. ✅ Supabase-Persistenz ausdrücklich als offen dokumentiert (Option B gewählt).
7. ⬜ DOM-Editor am iPhone geprüft — **offen (deinerseits)**.
8. ✅ Bestehende Regression grün (35 Suites, davon 41 + 6 neue Aktivitäts-Tests).
→ Punkt 7 offen: Teil A gilt erst nach iPhone-Prüfung als abgeschlossen.

## Offene Stabilisierungs-Batches (diese Phase)
- **A — Aktivitätseditor:** 🟡 Logik vollständig & getestet; 📱 Gerät + Supabase-Persistenz offen.
- **B — Anatomische SVG-Körperkarte:** ⬜ (eigene originale Vektorgrafik, keine Stock-Vorlage).
- **C — Globales Responsive + Design-System:** ⬜.
- **D — Insights-Redesign (Regeneration/Belastung):** ⬜.
- **E — Onboarding-Neuaufbau (12 Schritte):** ⬜.
- **F — Plausibilität/Editierbarkeit/Datenqualität:** teilweise in A; Rest ⬜.
- **G — Diese Roadmap:** ✅.
