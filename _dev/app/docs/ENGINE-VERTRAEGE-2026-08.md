# ORVIA · Engine-Verträge (Phase 6.1 + 6.4)

**Stand:** 2026-08-05 · **Status:** ENTWURF — verbindlich nach Review durch den Eigentümer.
**Geltung:** verbindlich vor jeder Scheduler-Implementierung (Phase 7). Sport-neutral
formuliert (E-27): jede Regel gilt für alle Sportarten der Registry; sportartspezifische
Ausprägungen liefern die Sport-Packs als DATEN, nie als eigene Codepfade.
**Testanker:** `supabase/tests/phase6_contracts_test.mjs` prüft die kritischen
Fail-closed-Pfade dieses Dokuments gegen den Quelltext und live gegen die Module.

**Grundsatz (6.4, unverhandelbar):**

> **Fehlende Sicherheit führt zu weniger Automatisierung, nicht zu mehr Heuristik.**

---

## Vertrag 1 · Trainingsziel

**Definition:** Ein Trainingsziel ist ein nutzerdefinierter Wunschzustand mit Rolle,
optionalem Zieltermin und optionalem Zielwert. Zielwerte sind **Aspiration, nie
Capacity** — eine Halbmarathon-Zielzeit ist Wunschwert und darf niemals als
Leistungsnachweis in Kapazitäts- oder Prognoserechnungen einfließen
(Knowledge-Regel `RUN-GOAL-001`).

**Kanonische Quelle:** `goals[]` im Profilmodell; Persistenz `goalRepository`
(`ROLE_TO_DB = {1:'primary', 2:'secondary', 3:'maintain', 4:'longterm'}`).
Die Prioritätsordnung 1..4 ist die EINZIGE Zielhierarchie — Dringlichkeit
(näherer Wettkampf) ersetzt ein Hauptziel nie still (`goal-portfolio.js`,
Leitplanke „Nutzerpriorität ist maßgeblich").

**Fail-closed:** doppelte `goalId` ⇒ `SCHEDULER_GA_CONTRADICTORY_GOAL_REF`;
nicht-endliche Zahlen an Zielfeldern ⇒ Ablehnung, keine stille Korrektur.
Fehlende Priorität erzeugt KEINE erfundene Ordnung (focus null + low confidence).

## Vertrag 2 · Sportkapazität — EINE Source of Truth

**Das war die im Umsetzungsplan benannte größte Architekturgefahr** (Kapazität
existierte dreifach). Entschieden (E-27-Nachtrag ①):

| Rolle | Modul | Zulässige Verwendung |
|---|---|---|
| **Ist-Wahrheit** | kanonische Lastserie `dailyLoadSeries` (`activity-config.js`) | einzige Quelle absolvierter Belastung; Confidence je Tag (`hoch`/`reduziert`/`not_assessable`) |
| **Einzige Ableitung** | `running-capacity-factory` (analog je Sport-Pack) | einzige zulässige Berechnung von Planungskapazität; konsumiert AUSSCHLIESSLICH die Lastserie über den S3-Adapter |
| **Nur Anzeige** | `calc.js`-Livewerte (loadSeries/loadModel/easyShare) | UI-Darstellung; fließen NIE in eine Prescription |

**Definition:** Sportkapazität ist die je Sportart belegte, aus realer Trainings-
historie abgeleitete Belastungsverträglichkeit (z. B. belastbarer Wochenumfang,
verträgliche Zahl harter Einheiten) — mit Konfidenz und Evidenzfenster. Ohne
ausreichende Historie existiert KEINE Kapazität (null + Grund), niemals ein
Schätzwert, der wie eine Messung aussieht.

**Zielmodell Belastungskonten (Vision §6):** kardiovaskulär · systemisch ·
muskulär nach Region · orthopädisch-mechanisch · technisch-koordinativ · mental.
**Implementierte Teilmenge heute:** sRPE-Tageslast + TRIMP (bei gemessener
Ruhe-/Maximal-HF). Kein Konto wird geführt, dessen Datengrundlage fehlt.

## Vertrag 3 · Zulässiger Trainingsslot

**Definition:** Ein zulässiger Slot ist ein Wochentag×Zeitfenster, das der Nutzer
als verfügbar erklärt hat, mit Kapazitätsgrenzen (max. Dauer, Equipment am Ort).

**Kanonische Quelle:** `effectiveTrainingConfig(PROFILE)` (`profile-model.js`) —
Zieltagzahl + verfügbare Tage; Persistenz `availabilityRepository`. Die
Ausrichtung eines Plans auf Verfügbarkeit geschieht ausschließlich über
`alignPlanToAvailability(plan, cfg)` (`ui.js`) — kein zweiter Rechenweg.

**Fail-closed (6.4):** widersprüchliche Verfügbarkeit ⇒ **kein automatisches
Verschieben**; der Konflikt wird sichtbar gemacht (Konflikt-Badge-Muster aus 5E),
nie still aufgelöst. Wiederholt nicht genutzte Slots sind ein Lernsignal
(Vision §18 Manuelle Kontrolle), keine Planungsgrundlage mehr.

## Vertrag 4 · Session Prescription (neutrales Workout-Schema)

**Definition:** Eine Prescription ist die maschinenlesbare, geräteneutrale
Beschreibung einer geplanten Einheit — VOR jeder Geräteübersetzung. ORVIA plant
**nie direkt im Garmin-Format**; Adapter übersetzen (Capability-Level A–D, E-27).

**Normatives Schema (verbindlich ab Phase 7):**

```json
{
  "sport_id": "<Registry-ID>",
  "session_type": "<string>",
  "goal": "<string|null>",
  "priority": "key|build|optional",
  "blocks": [
    {
      "type": "warmup|work|recovery|repeat|exercise|cooldown|skill|open",
      "completion": { "type": "duration|distance|reps|open", "value": 0, "unit": "s|m|reps" },
      "target":     { "type": "pace|speed|power|hr|hr_zone|rpe|rir|weight|cadence|open",
                      "min": null, "max": null, "value": null, "unit": null },
      "iterations": null,
      "blocks": [],
      "exercise_id": null, "sets": null, "repetitions": null, "rest_seconds": null,
      "notes": null
    }
  ],
  "abort_rules": [], "alternatives": []
}
```

Regeln: `repeat` ist verschachtelbar (`iterations` + innere `blocks`); Kraft nutzt
`exercise`-Blöcke mit `exercise_id`/`sets`/`repetitions`/`rest_seconds` und
`target` rir/weight; JEDES Ziel hat entweder value oder min/max, nie beides;
`open` ist ein ehrlicher Zieltyp (keine Vorgabe), kein fehlendes Feld.
Einheiten sind SI-normalisiert (Sekunden, Meter, Watt, bpm, kg).

## Vertrag 5 · Konkrete ausführbare Einheit

**Definition:** Eine ausführbare Einheit ist eine Prescription (Vertrag 4) PLUS
Termin-Bindung und Herkunft: `{ sessionId (ps:-Namensraum), dayIndex/weekKey,
baseline-Herkunft oder Override (5C-Modell), engineVersion, revision }`.
Identität folgt E-16: nur `ps:`-ID oder `predecessorSessionId` beweist Identität —
Titel-/Sport-/Positionsgleichheit NIE. Nutzer-Overrides und Engine-Baselines
überschreiben einander nie (Phase-5-Kernvertrag, live bewiesen in
`phase5de_test.mjs`).

**Abgrenzung:** heutige Sessions (`{t,l,dur}`-Strings) sind Legacy-Darstellung;
der Scheduler (Phase 7) erzeugt ab dem ersten Workout Vertrag-4-Strukturen.
Es wird KEIN zweites Zwischenformat eingeführt.

## Vertrag 6 · Ausreichend belastbare Daten

**Definition:** Ein Wert ist belastbar, wenn Quelle, Zeitstempel und Konfidenz
bekannt sind und die Quelle für den Verwendungszweck ausreicht.

**Kanonische Quellenordnung (E-02, `source-contract.js`):**
`measured_validated > device_sync > profile_manual > derived_estimate > kein Wert`.
Profilwert und Schätzwert erscheinen NIE unter derselben Kennzeichnung.

**Verwendungsregeln (6.4-Matrix, Auszug):**

| Situation | Verhalten | Code-Anker |
|---|---|---|
| Kapazität unbekannt | konservative generische Einheit ODER keine quantitative Prescription | Vertrag 2; `RUN-INT-001` (ohne Pace-Evidenz keine hochintensive Pace-Vorgabe) |
| Ruhepuls/HFmax fehlt | kein TRIMP-Entscheid („ohne gemessenen Ruhepuls bzw. HFmax kein TRIMP (kein Fallback)", `ui.js`) | TRIMP-Reader |
| RPE fehlt | Intensität `unknown` — nie raten, nie löschen (E-11) | `trainingLoadRepository.intensityBandOf` |
| Serie unvollständig | `partial`/`stale`/`empty` ehrlich ausweisen, keine Interpolation | `series-reader.js` |
| Schätzwert im Spiel | Kennzeichnung „berechnet/Schätzwert" verpflichtend | `source-contract.js`, HR-Zonen |

Missingness ist ein Ergebnis, kein Fehler: fehlende Daten reduzieren Automatisierung
(weniger quantitative Vorgaben), sie erzeugen nie Ersatzwerte.

## Vertrag 7 · Sicherheitsregeln, die Planung blockieren

**Blockierende Gates (Reihenfolge verbindlich — Safety VOR Performance-Ziel):**

1. **Akute Beschwerden/Schmerz-Gate:** Safety-Flags/Schmerz ⇒ RED, Ruhe/aktive
   Erholung, IMMER (`decision-engine-v2.js` §1; kontextsensitiv: Knie ≠ Oberkörper —
   lokale Beschwerde blockiert nicht kontextfrei alles).
2. **Krankheit:** Intensität blockiert, keine Kompensation verlorener Kilometer,
   gestufter Wiedereinstieg (`RUN-RTR-001`, medicalSafetyRelevant).
3. **Knowledge-Governance:** unreviewte Regeln laufen NIE im Produktionsmodus —
   `selectRules` schließt aus: `technical_review_pending`,
   `medical_safety_review_pending`, `scientific_review_pending`, `review_rejected`
   (`knowledge-contracts.js`). `medicalSafetyRelevant`-Regeln sind in JEDEM Modus
   gesperrt, bis ein medizinischer Review vorliegt.
4. **Pflicht-Pinning:** ohne gepinnte `expectedKnowledgeVersion` /
   `expectedPackContentHash` / `expectedSourceRegistryVersion` /
   `expectedSourceRegistryHash` / `mode` ⇒ `blocked:true`, null Regeln. Jede
   inhaltliche Pack-Änderung invalidiert Freigaben automatisch (Hash-Bindung).
5. **Aktivierungsmodus:** Scheduler kennt ausschließlich `shadow_only`
   (`ACTIVATION_MODE`, `scheduler-goal-allocation.js` / `scheduler-v1.js`);
   jeder andere Modus ⇒ `SCHEDULER_GA_ACTIVATION_MODE_REJECTED`. Die Aktivierung
   ist eine dokumentierte Produktentscheidung, nie ein Codepfad-Nebeneffekt.
6. **E-18-Sprachgrenze:** keine Verletzungs-/Diagnose-/Heilungsaussagen, keine
   Trainingsfreigabe trotz Schmerz — testbar via `phase6_e18_language_test.mjs`.

**Gesundheitsziele können Safety ausschließlich VERSCHÄRFEN** (tighten_only,
`goal-portfolio.js`) — nie lockern.

---

## Anhang · Beispiel-Prescriptions (normativ, testvalidiert)

**Ausdauer (Intervalle):** warmup(distance 2000 m, hr_zone 1–2) → repeat×4[
work(distance 800 m, pace 295–305 s/km) → recovery(distance 400 m, open)] →
cooldown(distance 1200 m, open).

**Kraft:** exercise(back_squat, 4×5, target rir=2, rest 180 s) — Ausführungspfad
Gym-Stufe-5 gemäß E-27 (Garmin-Kraft-Workout, Uhr erfasst kg + Ist-Wdh.).

Beide Beispiele werden in `phase6_contracts_test.mjs` gegen das Schema validiert —
das Schema ist damit ausführbar, nicht nur dokumentiert.
