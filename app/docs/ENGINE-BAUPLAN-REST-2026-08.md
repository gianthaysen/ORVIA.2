# ORVIA · Bauplan für die restliche Trainings-Engine

**Fassung 2.1** · Stand 2026-08-07
Ersetzt Fassung 1 vom 2026-08-06. Grundlage der Überarbeitung:
`docs/BAUPLAN-REVIEW-2026-08.md`.
Fassung 2.1 zieht sechs Korrekturen aus dem Review von Fassung 2 nach:
Laufzeitversionen im Log · Entscheidungskette · Schreiber-Definition ·
`executionScore` statt `sessionQuality` · `expectedRPE` aus der Prescription ·
Wiedereinstieg als Bereich statt Festwert.

Kennzeichnung der Aussagen: **[F]** gesicherter Fakt · **[A]** plausible Annahme ·
**[S]** Schätzung · **[B]** subjektive Bewertung · **[U]** offene Unsicherheit

---

## Der Leitsatz dieser Fassung

> Getrennt wird zwischen **„was wäre langfristig eine starke Engine?"** und
> **„was ist mit den heute real verfügbaren Daten belastbar implementierbar?"**

Fassung 1 hat diese Trennung nicht gezogen. Deshalb standen dort Bausteine, die
Aussagen erzeugt hätten, für die es keine Datengrundlage gibt. Alles, was auf
nicht vorhandenen Daten aufsetzt, steht ab jetzt in **Abschnitt 8 · Nicht jetzt
bauen** — dokumentiert, damit es nicht verloren geht, aber außerhalb des
kritischen Pfads.

Der bindende Engpass dieses Projekts ist **nicht die Architektur, sondern die
Datenpipeline.** Deshalb beginnt der Plan mit Stufe 0.

---

## 0. Was bereits steht

Damit klar ist, worauf aufgebaut wird und was **nicht** neu gebaut werden darf:

| Bereich | Modul | Zustand |
|---|---|---|
| Wochenkonstruktion | `week-plan-designer.js` | Kernreize zuerst, erschöpfende Tageskombination, 48 h zyklisch, Polarisierung, anteilige Kürzung |
| Sicherheitsnetz | `week-plan-policy.js` | R1–R8, Verschieben vor Löschen mit Verdrängung. **Letzte Instanz vor dem Schreiben.** |
| Lastsprache | `load-profile.js` | 15 Muskelgruppen, identische Schlüssel wie `gym-volume.js`, Erholung skaliert mit Lasthöhe |
| Zonen | `performance-zones.js`, `performance-resolver.js` | Laufen (Riegel), Rad (FTP/Coggan), Schwimmen (CSS), Testprotokolle, Level je Sportart |
| Varianten | `plan-variants.js` | A vollständig · B ohne Doppel · C nur Kernreize |
| Zielkonflikte | `goal-portfolio.js`, `scheduler-goal-allocation.js` | vorhanden, **Review statt Neubau** |
| Aktivierung | `feature-flags.js`, `plan-activation.js`, `canary-eval.js` | fail-closed, dreiwertig, Override-Buchhaltung |
| Sportabdeckung | `knowledge/sport-coverage-matrix.js` | vorhanden, wird Träger des Pack-Schemas |

---

## 1. Der rote Faden dessen, was fehlt

Die Engine plant heute eine **gute Woche**. Sie kann drei Dinge nicht:

1. **Sich erinnern.** Jede Woche wird geplant, als wäre es die erste.
2. **Sich erklären.** Wenn sie den Long Run verschiebt, ist die Begründung nach
   dem Rendern verloren.
3. **Aus dem lernen, was tatsächlich passiert ist.** Es gibt keine Rückmeldung
   von der ausgeführten Einheit in die Planung.

Die drei hängen zusammen und werden in dieser Reihenfolge behoben:
**Protokollieren (Stufe 0) → Erfassen (1) → Rückmelden (2) → Erinnern (3) →
Anpassen (4).**

---

## 2. Stufe 0 · Fundament — Protokoll und Beleg

> Diese Stufe erzeugt **keine einzige sichtbare Verbesserung**. Sie steht
> trotzdem vorn, weil jede Woche ohne sie Entscheidungen produziert, die
> unwiederbringlich verloren gehen.

### 0a · `js/engine/decision-log.js` — Entscheidungs-Log

**Vertrag**
```
logDecision({
  timestamp,             // injiziert, nie new Date()
  decisionType,          // 'week_design' | 'policy_move' | 'user_override' |
                         // 'opportunity_move' | 'progression' | 'variant_select' |
                         // 'constraint_block' | 'final_plan'
  decisionId,            // eindeutig, injizierte ID-Fabrik
  parentDecisionId,      // woraus diese Entscheidung hervorging
  supersedesDecisionId,  // welche Entscheidung sie ersetzt
  weekId, planId,        // Zuordnung zum Plan-Domain
  versions: {            // ALLE entscheidungsrelevanten Modulversionen
    engine, designer, policy, loadProfile, knowledgeSchema, flags
  },
  decisionRuntimeHash,   // abgeleitet aus versions — ein Wert für den Schnellvergleich
  inputs,                // die Eingaben, die zur Entscheidung geführt haben
  derivedState,          // trainingState, toleranceState, zones — verdichtet
  candidates,            // gewertete Alternativen, GEDECKELT (siehe unten)
  selected,
  rejected,              // {candidate, reason} — warum NICHT
  rulesTriggered,        // ['R4_no_three_run_days', 'polarization_cap', …]
  constraints,
  userOverrides
}) → {id, stored:true|false, reason}
```

**Kernentscheidungen**

- **Einträge sind unveränderlich.** Eine Korrektur erzeugt einen **neuen**
  Eintrag mit `supersedesDecisionId`, nie ein Update. Ein Log, das man ändern
  kann, ist kein Beleg.
- **Entscheidung ≠ Ausführung.** Wenn der Designer Samstag wählt, die Policy
  Samstag ablehnt und der Nutzer danach verschiebt, darf eine spätere Auswertung
  die *erste* Auswahl nicht für den ausgeführten Plan halten. Die Kette macht das
  eindeutig:
  ```
  week_design → policy_move → user_override → opportunity_move → final_plan
  ```
  Der Eintrag `final_plan` terminiert die Kette und verweist auf die
  überlebenden Entscheidungen. Er ist die einzige Antwort auf „was wurde
  tatsächlich geplant" — und er ist ein eigener Eintrag, kein Flag auf einem
  alten. So bleibt Append-only gewahrt.
- **Deckelung ist Pflicht, kein Detail.** Der Designer durchsucht über
  `combos()` alle Tageskombinationen. Ein ungedeckeltes `candidates` wären
  Hunderte Einträge pro Woche und im Jahr zweistellige Megabyte. Gespeichert
  werden die **Top 5 nach Score plus `candidatesEvaluated: n`**.
- **Rekonstruktion ist an die Laufzeitversion gebunden — und wird sonst
  verweigert.** Fassung 2 behauptete, der Rest der Kandidaten sei über einen
  Eingabe-Hash rekonstruierbar, „weil der Designer pur ist". Das war zu kurz
  gedacht: Purität garantiert Determinismus **innerhalb einer Codeversion**,
  nicht über Versionen hinweg. Derselbe Eingabesatz kann in v8-400 andere
  Kandidaten erzeugen als in v8-262 — durch geänderte Scores, Tie-Break-Regeln,
  Knowledge-Packs, Feature-Flags oder Datenmigrationen. Deshalb:
  `explain()` rekonstruiert **nur**, wenn der aktuelle `decisionRuntimeHash`
  dem protokollierten entspricht. Sonst meldet es
  `reconstruction: 'unavailable_runtime_changed'` mit beiden Versionsständen.
  Das ist Regel 3 auf das Log angewandt: lieber „weiß ich nicht" als eine
  plausible Erfindung.
- **Der Runtime-Hash ist nur so viel wert wie seine Pflege.** Eine
  `VERSION`-Konstante, die bei einer Verhaltensänderung nicht hochgezählt wird,
  macht den ganzen Mechanismus wertlos. Deshalb gehört zu 0a ein
  **Versionsdrift-Test**: Er hält für jedes entscheidungsrelevante Modul einen
  Inhalts-Hash vor und schlägt fehl, wenn sich der Inhalt geändert hat, ohne
  dass `VERSION` mitgezogen wurde. Ohne diesen Test ist das Feld Dekoration.
- **Ringpuffer lokal, Historie serverseitig — strikt getrennt.** `localStorage`
  bekommt die letzten 200 Einträge als Diagnosepuffer, Supabase die
  vollständige Historie mit Retention. Die lokale Kopie ist nie die Quelle der
  Wahrheit; sie darf verloren gehen, ohne dass etwas fehlt.
- **Gesundheitsdaten im Log.** `constraints` und `inputs` enthalten
  Schmerzangaben. Das ist dieselbe Kategorie wie die Check-in-Daten und bekommt
  dieselbe Behandlung: eigene Tabelle, RLS auf `user_id` ab der ersten
  Migration, keine Aggregation über Nutzer hinweg. **[F]** — nicht optional.
  Zusätzlich: **keine personen- oder gesundheitsbezogenen Felder in
  Konsolenausgaben oder ungeschützten Telemetriepfaden.** Was das Log ausgibt,
  wird vorher redigiert.
- **Das Log ist Beobachter, nie Beteiligter.** Ein Fehler beim Schreiben darf
  die Planung nicht abbrechen: `stored:false` mit Grund, Planung läuft weiter.
  Prüfbar formuliert: **Bei abgeschaltetem oder fehlerhaftem Log ist der finale
  Plan byte-für-byte identisch.**

**Warum P0 und nicht „später":** Das Log löst schon heute drei Probleme —
Debugging, Erklärbarkeit gegenüber dem Nutzer, und Regressionstests
(ein gespeicherter Eingabesatz wird zum Testfall). Der Nutzen für eine spätere
Lernschicht ist das *dritte* Argument, nicht das erste.

**Test** `decision_log_test.mjs` — Deckelung greift · Einträge sind
unveränderlich · gleiche Eingaben **und** gleiche Laufzeitversion ⇒ gleicher
Decision-Hash · gleiche Eingaben, **andere** Engine-Version ⇒ anderer Hash ·
Rekonstruktion bei abweichendem Runtime-Hash wird verweigert, nicht geraten ·
Logging-Ausfall verändert den finalen Plan byte-für-byte nicht · keine
Gesundheitsfelder in der Konsolenausgabe · Kette ist von `final_plan` rückwärts
auflösbar · keine Fremdnutzer-IDs im Datensatz.
Dazu `module_version_drift_test.mjs` — Inhaltsänderung ohne `VERSION`-Bump ist rot.

**Fertig, wenn:** Nach einer Wochenplanung beantwortet
`ORVIA.decisionLog.explain(weekId)` die Frage „Warum liegt der Long Run auf
Samstag?" mit den ausgelösten Regeln und den verworfenen Alternativen.

**Aufwand: 2 Tage** (inkl. Migration + RLS)

---

### 0b · `js/engine/evidence.js` — Evidence Provenance

> Ohne diesen Vertrag erfindet jedes Modul seine eigene Sicherheitsangabe. Dann
> steht auf einem Bildschirm „stark", „gemessen" und „hoch" nebeneinander und
> bedeutet dreimal etwas anderes.

**Vertrag — eine Hülle für jeden relevanten Zustand**
```
{
  value,
  source,        // 'race_result' | 'test' | 'workout_derived' | 'self_report' |
                 // 'user_checkin' | 'device' | 'default'
  sourceId,      // Rückverweis auf Aktivität/Test/Check-in
  measuredAt,    // ISO-Datum
  method,        // '10k_race' | 'ftp_20min' | 'css_400_200' | …
  evidence,      // 'unknown' | 'weak' | 'moderate' | 'strong'
  staleAfter,    // Tage — je Quelle unterschiedlich
  freshness      // abgeleitet: 'fresh' | 'current' | 'stale'
}
```

**Kernentscheidungen**

- **Vier Stufen, ordinal — keine Prozentzahl.** Es gibt keine Rechnung, die aus
  „10-km-Wettkampf vor 18 Tagen" seriös „78 %" macht. Eine Prozentzahl
  behauptet eine Genauigkeit, die die Herleitung nicht hat **[B]**.
- **Evidenz und Alter sind getrennte Achsen.** Ein starker Beleg von vor einem
  Jahr bleibt ein starker Beleg — nur ein alter. Beides in eine Zahl zu
  falten, vernichtet Information.
- **Migration statt Parallelbetrieb.** `performance-zones.js` benutzt heute
  `measured` / `derived` / `estimated` / `none`. Zwei Taxonomien nebeneinander
  sind ein garantierter Widerspruch. Abbildung:
  `measured→strong` · `derived→moderate` · `estimated→weak` · `none→unknown`.
  Das alte Vokabular wird **entfernt**, nicht ergänzt.
- **`staleAfter` je Quelle.** Ein Wettkampfergebnis altert anders als eine
  Selbstauskunft zum Schlaf. Werte als Tabelle im Modul, nicht verstreut.

**Anzeige — verbindliches Muster**
```
Schwellen-Pace 4:52/km
Beleg: stark · Quelle: 10-km-Wettkampf · Alter: 18 Tage · Status: aktuell
```
Nicht: `Threshold confidence: 78 %`.

Der bestehende Marker `''` / `≈` / `~` auf den Plankarten bleibt die
Kurzform derselben Skala (strong → kein Marker, moderate → `≈`, weak → `~`,
unknown → `—`).

**Test** `evidence_test.mjs` — nur die vier Stufen sind zulässig · Migration ist
verlustfrei und in beide Richtungen prüfbar · `freshness` folgt aus
`measuredAt` + `staleAfter`, wird nie gesetzt · unbekannte Quelle → `unknown`,
nie geraten.

**Aufwand: 2 Tage** (inkl. Migration von `performance-zones`)

---

## 3. Stufe 1 · G1 · Performance Evidence Input

> Nicht „Erfassungsmaske". Der Unterschied ist nicht sprachlich: Eine Maske
> speichert Werte, ein Evidence Input speichert Werte **mit ihrer Herkunft**.

**Umfang**

- Wettkampfergebnis: Sportart, Distanz, Zeit, Datum, Bedingungen
- Testergebnis je Sportart mit Anleitung aus `TEST_PROTOCOLS`
- FTP (Rad), CSS (Schwimmen), Schwellen-HF
- jeder Eintrag schreibt die vollständige Evidence-Hülle aus 0b

Schreibt nach `performance.personalBests[]` und `performance.tests[]` — die
Felder, die `performance-resolver.js` bereits liest.

**Bedingung, ohne die G1 seinen Zweck verfehlt:** Der leere Zustand muss in
**einer Sitzung** füllbar sein. Wer noch nie getestet hat, bekommt das
Anfängerprotokoll direkt in der Maske angeboten, nicht als Verweis auf eine
Hilfeseite. Sonst wird die Maske gebaut und nie ausgefüllt — das ist das
Hauptrisiko dieser Stufe **[U]**.

**Warum vor C1:** C1 liefert eine Lastbilanz. Aus einer Lastbilanz allein folgt
**kein Intensitätsziel** — dafür braucht es Zonen, und Zonen kommen aus G1. Ohne
G1 produziert C1 korrekte, aber unsichtbare Interna; Intensität, Zielprognose,
Wochenkilometer und Tagesziele blieben weiter bei „—". Dazu kommt ein zeitliches
Argument: Historie braucht Kalenderzeit, ein Testergebnis nicht. Wer heute
erfasst, hat den Beleg, sobald die Historie trägt. Umgekehrt nicht.

**Test** `performance_input_test.mjs` — jeder gespeicherte Wert trägt eine
vollständige Evidence-Hülle · unplausible Zeiten werden abgelehnt statt
umgerechnet (die `1:50`-Falle: 2–15 min/km Plausibilität) · Testprotokoll und
Sportlevel passen zusammen.

**Aufwand: 3 Tage**

---

## 4. Stufe 2 · C3 · Session Debrief — die Feedbackschnittstelle

> In Fassung 1 stand hier „2 Tage, Plan-Ist-Abweichung". Das war die
> schwerwiegendste Fehleinschätzung des alten Dokuments: **Das Debrief ist die
> einzige Quelle gelabelter Daten.** Ohne es hat jede spätere Stufe keine
> Grundwahrheit.

**Erfasste Größen**
```
{
  completed, completionPct,        // abgeleitet aus Aktivität
  rpe,                             // MANUELL — 1..10
  painDuring, painAfter,           // MANUELL — nur Flag + Region
  reasonModified, reasonStopped,   // nur bei Abweichung erfragt
  executionScore,                  // ABGELEITET aus zoneHit × completionPct
  plannedVsActual,                 // abgeleitet
  dataQuality                      // Evidence-Hülle aus 0b
}
```

**`executionScore`, nicht `sessionQuality`.** Fassung 2 nannte das Produkt
`zoneHit × completionPct` „Quality". Das misst Planerfüllung, nicht
Trainingsqualität — und der Unterschied ist nicht akademisch: Wer 100 % der
Einheit exakt in der Zielzone läuft, dabei aber RPE 10 und Schmerzen meldet,
bekäme den Wert 1,0 und damit das Etikett „hochwertige Einheit". Das wäre
falsch und würde sich später in jede Auswertung fortpflanzen. RPE und Schmerz
bleiben **getrennte** Größen und werden nicht in diesen Wert eingerechnet.

**Die Bedienlast ist das eigentliche Konstruktionsproblem.** Elf Felder pro
Einheit füllt niemand über Monate aus — und lückenhafte Selbstauskunft ist
schlechter als keine, weil sie systematisch verzerrt (schlechte Tage werden
seltener geloggt) **[A]**.

Deshalb verbindlich:

- **Genau zwei manuelle Eingaben im Normalfall:** RPE (ein Tipp auf eine Skala)
  und Schmerz ja/nein. Alles andere wird abgeleitet.
- **`rpe` und `perceivedDifficulty` sind zwei Namen für dieselbe latente Größe.**
  Zwei Felder dafür erzeugen inkonsistente Daten, nicht mehr Information.
  Erfasst wird **nur RPE**; `perceivedDifficulty` entfällt, `executionScore`
  wird gerechnet.
- **`reasonModified` / `reasonStopped` nur bei erkannter Abweichung** —
  Auswahlliste, kein Freitext, sonst ist es nicht auswertbar.
- Ohne Plan-Referenz **kein Urteil.** Eine freie Einheit ist nicht „falsch".
- Ohne Zonen (`evidence: 'unknown'`) nur Beschreibung, keine Bewertung.

**Ausgabe — nicht nur `adherence`**
```
{
  adherence: 'im Ziel'|'zu schnell'|'zu langsam'|'abgebrochen'|'nicht vergleichbar',
  deltaPace, deltaDuration, zoneHit,
  note,                              // Klartext, eine Zeile
  adaptationEvidence: {
    tolerance:          'good'|'borderline'|'poor'|'unknown',
    constraintSignal:   {region, severity, trend} | null,
    progressionSignal:  'headroom'|'at_limit'|'over'|'unknown',
    evidenceQuality:    'weak'|'moderate'|'strong'
  }
}
```

**`tolerance` braucht eine falsifizierbare Definition, sonst ist es ein Gefühl.**
Verbindlich:

> Zwei Einheiten sind **vergleichbar**, wenn Sessiontyp identisch, Dauer ±20 %
> und Zielintensität in derselben Zone.
> `tolerance = 'poor'`, wenn in **≥ 2 von 3** vergleichbaren Einheiten das RPE
> **≥ 2 Punkte** über dem **erwarteten** RPE liegt — bei gleicher oder
> geringerer erreichter Intensität.
> Weniger als 3 vergleichbare Einheiten → `'unknown'`. Nicht `'good'`.

Der letzte Satz ist der wichtige: Ausbleibende Belastungssignale sind kein
Beleg für gute Verträglichkeit.

**Der Erwartungswert darf nicht aus dem Sessionnamen kommen.** „Threshold" sagt
nichts darüber, ob 4×8 min oder 2×20 min gemeint sind; ein Long Run mit
Endbeschleunigung ist etwas anderes als ein Long Run ohne. Deshalb:

```
expectedRPE({sessionType, workDuration, recoveryRatio, zone, progressionStage})
  → {value, evidence}
```

Anfangs eine Tabelle aus Konvention und Literatur → `evidence: 'weak'`. Sobald
genug eigene Historie vorliegt, wird der Erwartungswert aus den eigenen
Einheiten des Athleten gebildet → `'moderate'`. Ein Erwartungswert mit
`'weak'`-Beleg darf `tolerance = 'poor'` **melden**, aber die Progression noch
nicht bremsen.

**Tolerance wird kontextspezifisch gespeichert, nie global.** Sonst würde eine
schlechte VO₂-Verträglichkeit beim **Laufen** fälschlich Rad-Intervalle
einschränken.

```
{ domain: 'highIntensity', sport: 'running', status: 'poor', evidence: 'moderate' }
```

**Bekannte Folge, die nicht „wegoptimiert" werden darf [U]:** Die Aufteilung
nach Domäne × Sportart macht die Zellen dünn. „≥ 2 von 3 vergleichbaren
Einheiten" wird deshalb über Monate häufig **nicht** erreicht, und `unknown` ist
der Normalzustand. Das ist korrektes Verhalten, kein Defekt — die Schwelle darf
nicht gelockert werden, um häufiger eine Aussage zu bekommen. Eine systemische
Gesamtaussage über alle Zellen ist zulässig, aber nur mit **niedrigerem**
Evidenzgrad.

**Test** `session_debrief_test.mjs` — Standardfall kommt mit zwei Eingaben aus ·
`tolerance` bei < 3 vergleichbaren Einheiten `unknown` · freie Einheit ohne Plan
erhält kein Urteil · Vergleichbarkeitsdefinition greift (unterschiedliche Zone →
nicht vergleichbar).

**Aufwand: 4–5 Tage**

---

## 5. Stufe 3 · C1 · `js/engine/load-history.js` + Tolerance State

**Vertrag**
```
buildHistory({activities, workouts, sets, debriefs, days, today}) → {
  byDay:        {date: {systemic, perMuscle{}, sessions[]}},
  rolling:      {7:{…}, 14:{…}, 28:{…}},        // ROH — bleibt erhalten
  acuteChronic: {ratio, acute7, chronic28, band},
  muscleReadiness: {quads: 0..1, …},
  gaps:         [{date, reason}],
  trainingState: {                               // VERDICHTET — für den Designer
    loadTrend:      'rising'|'stable'|'falling',
    consistency:    0..1,
    monotony, strain,
    sessionDensity,
    evidence
  },
  toleranceState: {                              // aus den Debriefs
    systemic, impact, highIntensity, volume,
    muscleGroups: {},
    recoveryTime,
    evidence
  }
}
```

**Kernentscheidungen**

- **`trainingState` ist additiv, nicht ersetzend.** Der Designer konsumiert die
  verdichtete Form, die Diagnoseansicht die Rohwerte. Eine abgeleitete Kennzahl,
  die man nicht zurückverfolgen kann, ist nicht debuggbar.
- **Monotony und Strain werden angezeigt, gehen aber nicht in
  Planungsentscheidungen ein.** Ihre Reproduzierbarkeit ist in Folgestudien
  deutlich schwächer ausgefallen als ihre Verbreitung vermuten lässt **[A]**.
  Sie dürfen nicht die einzige Sicht des Designers sein.
- **Fehlende Tage sind Lücken, keine Nullen.** Wer eine Woche nicht loggt, hat
  nicht null trainiert. Bei zu vielen Lücken meldet die Ratio
  `insufficient_data`, sie schätzt nicht.
- **Krafttraining zählt über Sätze × Gewicht** (`gym-volume.js`), nicht über
  „eine Einheit".
- **Acute:Chronic als Kontext, nicht als Ampel.** Die prospektive Evidenz für
  ACWR-basierte Verletzungsvorhersage ist deutlich schwächer als die Verbreitung
  des Modells **[F]**. Anzeige nur als Band, nie als „du darfst nicht".
- **Ein Lastmodell, nicht zwei:** `load-profile.profileOf()` ist die einzige
  Quelle der Muskelsprache.

**Tolerance State — was er ist und was nicht.**
Er beantwortet: *„Welche Last verträgst du?"* — nicht: *„Welcher Reiz macht dich
schneller?"* Das ist der Unterschied zum Response Model (Abschnitt 8). Das
Verträglichkeitssignal ist groß und zeigt sich in Tagen; das Wirkungssignal ist
kleiner als das Messrauschen und braucht Monate.

**Test** `load_history_test.mjs` — Lücken nicht als 0 · gleiche Muskelschlüssel
wie `load-profile` · Ratio bei dünner Datenlage `insufficient_data` ·
`trainingState` und `rolling` widersprechen sich nie · `toleranceState` ohne
Debriefs → `unknown`.

**Aufwand: 5–6 Tage**

---

## 6. Stufe 4 · C2 · Adaptive Progression

> Fassung 1 schrieb „max. +8 % Wochenkilometer" so, als wäre das die Regel, nach
> der der Umfang wächst. Das war falsch herum.

**Vertrag**
```
progressionDecision({
  history,          // aus C1
  adherence,        // aus C3
  currentPhase,
  recentTolerance,  // toleranceState
  interruption,     // returnContext, siehe unten
  goalDemand        // aus Goal Feasibility
}) → {
  targetLoad,
  delta,            // darf 0 %, −15 % oder +4 % sein
  limitingFactor,   // 'tolerance'|'adherence'|'guardrail'|'goal'|'return'|'none'
  guardrails: []    // welche Decken aktiv waren
}
```

**Die Engine versucht nicht, jede Woche zu steigern.** `delta = 0` ist ein
gültiges, häufiges und oft richtiges Ergebnis.

**Guardrails (Decken, keine Ziele)**

- Laufumfang max. **+8 %** gegenüber dem Mittel der letzten **3 Wochen**
  (nicht +10 % gegen die Vorwoche — eine Ausreißerwoche schriebe sich sonst fort)
- Muskelgruppe mit `readiness < 0.5` → beinlastige Einheiten weichen aus
- Polarisierungsdeckel aus dem Designer bleibt unangetastet

Zur Einordnung von +8 %: Die bekannte „10-%-Regel" ist **nicht** evidenzbasiert.
Die größte randomisierte Studie dazu (Buist et al. 2008, ~530 Laufanfänger) fand
**keinen** Unterschied in der Verletzungsrate zwischen stufenweisem und
Standardaufbau **[F]**. +8 % ist eine konservative Konvention — genau deshalb
gehört sie an die Decke und nicht in den Motor.

**Wiedereinstieg — `returnContext` statt Pauschalfaktor**

Die pauschalen „70 % nach > 10 Tagen" entfallen vollständig.

```
returnRecommendation({
  reason: 'break' | 'illness' | 'injury',
  days, crossTrainingLoad, symptomFreeDays, previousLoad, evidence
}) → { range: {min, max}, recommended, evidence, rationale } | { criteriaPath }
```

**Bereiche, keine Festwerte — und der Planer nimmt den konservativen Rand.**
Die Zahlen unten sind als **[A]** gekennzeichnet, also plausible Annahmen. Genau
deshalb dürfen sie nicht als einzelne, scheinbar wissenschaftlich feste Faktoren
in den Code. Wo die Planung am Ende einen Wert braucht, wird `range.min`
genommen, nicht die Mitte.

| Fall | Korridor | Grundlage |
|---|---|---|
| Pause **mit** Crosstraining | 85–95 % | aerobe Basis bleibt weitgehend erhalten **[A]** |
| Pause ohne Training < 2 Wochen | 75–85 % | Detraining in 2 Wochen gering **[A]** |
| Pause ohne Training > 4 Wochen | 60–70 % | Detraining messbar **[A]** |
| Krankheit **mit Fieber** | **kein Prozentwert als Einstieg** — erst Symptomfreiheit, dann konservativer Wiedereinstieg am unteren Rand des Pausen-Korridors | dokumentiert ist der **Mechanismus** (u. a. Myokarditis-Risiko) **[F]**, nicht eine bestimmte Prozentzahl **[U]** |
| **Verletzung** | **kein Prozentwert** — Kriterienpfad aus D1 | ein Skalierungsfaktor ignoriert die Struktur **[B]** |

Die Fieber-Zeile ist gegenüber Fassung 2 korrigiert. Dort stand „Start 50 %",
gekennzeichnet als **[F, Mechanismus]** — das war eine Überzeichnung: Der
Mechanismus ist belegt, die Zahl 50 % ist es nicht. Der Rückkehrverlauf hängt
stark von Symptomatik und Krankheitsbild ab. „Konservativer Wiedereinstieg nach
Symptomfreiheit" ist belastbar, ein universeller Prozentwert nicht.

Die letzte Zeile bleibt der entscheidende Punkt: Nach einer Verletzung ist ein
Prozentsatz vom letzten Niveau der falsche *Begriff*. Das ist eine
Kriterienprogression („Belastung X schmerzfrei, bevor Y"), kein Faktor. Der
Kriterienpfad kommt aus D1 (Stufe 7) — bis dahin gilt für `reason:'injury'`
konservativ `range.min` des längsten Pausenfalls, **mit sichtbarem Hinweis**,
dass die Kriterienführung noch fehlt.

**Test** `progression_test.mjs` — `delta` kann negativ und 0 werden ·
Guardrail-Verletzung ist unmöglich, nicht nur unwahrscheinlich · jeder Fall des
`returnContext` liefert das dokumentierte Ergebnis · `insufficient_data` fällt
auf den konservativen Wert zurück, nie auf den optimistischen ·
`limitingFactor` ist immer gesetzt.

**Fertig, wenn:** Zwei aufeinanderfolgende Wochen mit identischem Profil, aber
unterschiedlicher Historie, ergeben unterschiedliche Pläne — und das Log sagt
warum.

**Aufwand: 3–4 Tage**

---

## 7. Stufe 5 · `js/engine/goal-feasibility.js`

> **Reiner Bewerter.** Es beschreibt Zielbedarf, erreichbare Trajektorie, Lücke
> und Unsicherheit — und verordnet selbst KEINE Belastung.

**Die Abhängigkeit läuft von C2 nach Stufe 5, nicht umgekehrt.** Fassung 2 hatte
es falsch herum: Feasibility hätte `requiredPctPerWeek` erzeugt und C2 hätte es
umzusetzen versucht. Damit erzeugte ein unrealistisches Ziel dauerhaft Druck bis
an die Guardrail-Decke, Woche für Woche, ohne dass irgendwo „das geht nicht"
gestanden hätte. Richtig: C2 berechnet den zulässigen Korridor, Stufe 5
**vergleicht** ihn mit dem Bedarf.

**Vertrag**
```
goalFeasibility({
  goal,                  // Distanz + Zielzeit oder Zielleistung
  targetDate,            // fix (Wettkampf) oder flexibel
  currentPerformance,    // Zonen aus G1/0b, mit Evidence-Hülle
  allowableProgression,  // VOLLSTÄNDIGES C2-Ergebnis
  availability, weeksLeft
}) → {
  status,                // siehe unten — NIE „machbar"/„unmöglich"
  requiredTrajectory,    // im LEISTUNGSRAUM, nicht in Lastprozent
  achievableTrajectory,  // BAND mit Evidence, keine Punktprognose
  gap: {value, unit, uncertainty},
  limitingFactors: [],
  evidence, actionable,
  rationale: []
}
```

**Neun Invarianten — jede als Test formuliert**

1. **Ohne belastbare aktuelle Leistung: `insufficient_data`.** Ein Ziel ohne
   Ausgangspunkt ist keine Lücke, sondern eine offene Frage.
2. **Zieländerungen verändern C2s `allowableRange` niemals.** Prüfbar als
   Eigenschaft: derselbe Korridor bei jedem Ziel.
3. **`requiredTrajectory` wird im Leistungsraum beschrieben** (Pace, Schwelle,
   Zeit) — nicht als Lastprozent. Die Übersetzung Leistung → Last ist der Ort,
   an dem Scheingenauigkeit entsteht.
4. **`achievableTrajectory` ist ein Band mit Evidence**, keine Punktprognose.
5. **Die Gesamt-Evidence ist nie stärker als der schwächste entscheidende
   Eingang** — `evidence.weakest()` über Zonen, Historie und C2-Ergebnis.
6. **`targetLoad: null` oder `autoApplicable: false` verhindert eine positive
   Machbarkeitsaussage.** Wenn C2 seine eigene Empfehlung nicht freigibt, kann
   Stufe 5 daraus keine Erreichbarkeit ableiten.
7. **Fixes Wettkampfdatum und flexibles Ziel werden unterschiedlich behandelt.**
   Beim fixen Datum ist die Zeit die harte Grenze; beim flexiblen Ziel ist die
   Antwort „wann", nicht „ob".
8. **Der Status lautet `within_modeled_corridor` · `outside_modeled_corridor` ·
   `insufficient_data`** — nicht „machbar" oder „unmöglich". Die Engine bewertet,
   was das heutige Modell trägt, und verwechselt Modellgrenzen nicht mit
   biologischer Gewissheit.
9. **Cache-Invalidierung umfasst** Ziel, Datum, aktuelle Leistung,
   Verfügbarkeit, das C2-Ergebnis und **sämtliche Policy- und Modulversionen.**
   Ein zwischengespeichertes Urteil aus einer alten Politik wäre eine stille
   Falschaussage.

**Zwei Invarianten sind beim Bau dazugekommen** — beide, weil sie sonst still
falsch gewesen wären:

10. **Die Richtung der Metrik wird nie geraten.** Ob „besser" einen kleineren
    oder größeren Zahlenwert bedeutet, entscheidet über das Vorzeichen des
    gesamten Bedarfs. Eine falsche Richtung macht aus „10 % Verbesserung nötig"
    ein „Ziel bereits erreicht" — und sieht dabei nicht wie ein Fehler aus. Eine
    Heuristik über Teilzeichenketten (`indexOf('Pace')`) wäre genau an den zwei
    Metriken gescheitert, die diese App tatsächlich führt: `cssSecPer100` und
    `metricType: 'time'`. Deshalb: Eintrag in `METRIC_DIRECTION` oder
    ausdrückliche Angabe am Ziel — sonst `insufficient_data`. Eine neue Metrik
    muss eingetragen werden; das ist ein sichtbarer, harmloser Fehlschlag statt
    einer stillen Umkehrung.
11. **Auch der Zeitraum beim flexiblen Ziel ist ein Band.** `estimatedWeeksRange`
    liefert `{min, max, open}` aus den beiden Kanten der modellierten Rate.
    Eine einzelne Wochenzahl wäre dieselbe Scheingenauigkeit, die Invariante 4
    für die Rate bereits ausschließt.
12. **Der Cache-Schlüssel enthält nur Entscheidungsabhängigkeiten.** Er besteht
    aus `goalFeasibilityVersion`, `feasibilityPolicyVersion`, `inputHash`,
    `evidenceVersion`, `progressionContractVersion` und
    `performanceModelVersion` — und die Versionen kommen aus dem **Eingang**,
    nicht aus der globalen Registry. Maßgeblich ist die Version, die das
    übergebene Ergebnis tatsächlich erzeugt hat, nicht die, die zufällig gerade
    im Speicher liegt.
13. **Das erreichbare Band trägt seinen Modellstatus.** `model:
    'population_prior'`, `individualized: false` und eine Provenance je
    Bestandteil ([S] für die Änderungsraten, [A] für die Korridor-Skalierung).
    C2 liefert zulässige **Last**; ohne individuelles Response Model folgt daraus
    keine vorhersagbare Leistungsverbesserung.

**Und eine Ausnahme wurde gestrichen:** Ein Leistungswert ohne Datum galt im
ersten Entwurf als brauchbar, weil `usability()` nur bei vorhandenem `ageRatio`
befragt wurde. Der Evidenzvertrag stuft einen undatierten Wert auf
`informational` — anzeigen ja, entscheiden nein. Die Prüfung läuft jetzt
ausnahmslos; sonst wäre das die Hintertür, durch die ein undatierter Altwert
eine Machbarkeitsaussage trägt.

**Cache-Schlüssel und Audit-Hash sind getrennt.** Sie beantworten zwei
verschiedene Fragen und dürfen deshalb nicht dieselbe Zusammensetzung haben:

| | Frage | Umfang | Ort |
|---|---|---|---|
| `cacheKey(input)` | Darf ich dieses Urteil wiederverwenden? | so eng wie zulässig — nur direkte und transitive Entscheidungsabhängigkeiten, alle aus dem Eingang | Ergebnisfeld |
| `auditHash(input, registry)` | Unter welchem Gesamtzustand ist das entstanden? | so breit wie möglich — alle Laufzeitmodule, auch fehlende, ausdrücklich als `absent` | Decision Log |

Die erste Fassung hashte für den Cache die gesamte globale Registry. Damit hing
der Schlüssel davon ab, ob `session-debrief` oder `performance-zones` zum
Zeitpunkt des Aufrufs schon geladen waren — Module, deren Verhalten dieses
Ergebnis nicht beeinflussen kann. Die Folgen wären ladezeitabhängige Schlüssel,
unnötige Cache-Misses und schlecht reproduzierbare Ergebnisse gewesen.
`feasibility()` nimmt deshalb **keine Registry mehr**: Sein Ergebnis hängt
ausschließlich vom Eingang ab.

**Status: gebaut (v8-278).** `goal-feasibility@2` / `gf-policy@2`,
`goal_feasibility_test.mjs`, Mutationsproben bestanden (invertierte Richtung ·
entferntes Freigabe-Gate · Band zur Punktprognose · abgeschaltete
Usability-Prüfung · Modulversion aus dem Cache-Schlüssel · geratene Richtung ·
entfernte Korridor-Skalierung — jeder Defekt wird gefangen).

---

## 7b. Shadow Mode · Abnahmekriterien

C1, C2 und Stufe 5 rechnen bei **jedem Planlauf** mit und schreiben ins Decision
Log, **ohne den Plan zu verändern**. Erst danach übersetzt C2 `targetLoad` und
`dimensionPolicy` tatsächlich in den Wochenplan.

**Zeit allein ist kein Abnahmekriterium.** „14 Tage gelaufen" sagt nichts
darüber, ob die interessanten Fälle überhaupt vorgekommen sind — in zwei ruhigen
Wochen ohne Krankheit, Deload oder Datenlücke bestätigt der Schattenbetrieb nur,
dass nichts passiert ist. Die Abnahme braucht deshalb **Fallabdeckung**:

1. **Keine Veränderung des ausgelieferten Plans.** Nachweisbar als Vergleich der
   Planartefakte vor und nach jedem Schattenlauf — nicht als Zusicherung.
2. **Vollständige Kette C1 → C2 → Feasibility im Decision Log.** Jeder Lauf
   schreibt alle drei Stufen mit ihren Bezugsbasen; eine fehlende Zwischenstufe
   macht die Auswertung wertlos.
3. **Alle drei Feasibility-Zustände sind vorgekommen:** `within_modeled_corridor`,
   `outside_modeled_corridor`, `insufficient_data`.
4. **Mindestens ein `review`-Fall mit `provisionalTargetLoad`** — und der Nachweis,
   dass er nicht angewendet wurde.
5. **Krankheit, Taper und Deload mindestens als Fixture**, wenn sie im Zeitraum
   nicht real auftreten. Ein Pfad, der nie gelaufen ist, ist nicht abgenommen.
6. **Keine positive Bewertung bei `autoApplicable: false`** — über den gesamten
   Zeitraum, nicht nur im Test.
7. **Jede Abweichung zwischen aktuellem und adaptivem Plan ist erklärbar**:
   Bezugsbasis, Korridor, gewählte Veränderung und Auswahlgrund stehen im Log.
8. **Reproduzierbarkeit:** identische Eingaben und identische Vertragsversionen
   ergeben identische Ergebnisse. Genau das prüft die Trennung von Cache-Schlüssel
   und Audit-Hash — ohne sie wäre dieses Kriterium nicht einmal formulierbar.

**Status: verdrahtet (v8-279).** `shadow-adaptive@1` / `shadow-policy@1`,
`shadow_adaptive_test.mjs` mit 124 Prüfungen, acht Mutationsproben bestanden.
Aufruf in `generateWeekPlan` unmittelbar hinter dem Entscheidungs-Log; Diagnose
über `ORVIA.shadowAcceptance()` in der Konsole.

Umsetzung der acht Zusagen:

| Zusage | Umsetzung |
|---|---|
| byte-identische Pläne | das Modul bekommt den fertigen Plan und hat keinen Rückgabepfad; der Rückgabewert wird nirgends zugewiesen (Quelltextprüfung) |
| Fehler/Timeout/fehlende Daten | jede Stufe in `_guard()`; Zeitbudget mit **injizierter** Uhr, ohne Uhr kein Budget und voller Determinismus |
| gemeinsamer Snapshot | `snapshot()` friert tief ein und hasht; spätere Änderungen an der Quelle erreichen ihn nicht mehr |
| Hashes und Versionen | `hashes.snapshot`, `hashes.cacheKey`, `hashes.auditHash` plus neun Vertragsversionen an jedem Eintrag |
| keine Dubletten | `idempotencyKey` aus Snapshot-Hash und Versionen; Wiederholungen werden protokolliert, aber nicht mitgezählt |
| provisorisch bleibt beobachtend | `applicable:false` mit benanntem Sperrgrund; die C2-Asymmetrie bleibt (Senken darf immer) |
| strukturierte Abweichung | `volume` · `intensity` · `frequency` · `scope` · `rationale`, getrennte Felder |
| Fallkriterien statt Zeit | `acceptance()` wertet nur Abdeckung; 200 ereignislose Läufe nehmen nichts ab |

**Zwei Befunde beim Bau, beide im Modul korrigiert:**

Eine ausdrücklich übergebene Registry gilt jetzt **strikt**. Der erste Entwurf
fiel auf die global geladenen Module zurück, wenn die Registry ein Modul nicht
führte — damit meldete ein Lauf `ok`, obwohl das Modul laut Registry gar nicht da
war. Ein Rückfall, der einen Fehlzustand in einen Erfolg verwandelt, ist genau
die Art stiller Fehler, die der Schattenbetrieb aufdecken soll.

Negative Kriterien brauchen mindestens eine Beobachtung. „Kein Verstoß unter null
Fällen" ist kein Beleg — sonst wäre ein nie gelaufener Schattenbetrieb in zwei
von acht Kriterien automatisch grün.

**`decision-log@2`:** `shadow_observation` ist ein eigener Entscheidungstyp und
wird von `explain()` **ausgeschlossen**. Eine Beobachtung hat den Plan nicht
geformt; würde sie in der Begründung einer Woche auftauchen, erklärte die Antwort
auf „warum liegt X auf Tag Y" die Woche mit einer Rechnung, die nie angewendet
wurde. Eine Erklärung, die Ursachen erfindet, ist schlechter als keine.

**Betriebsdetails (v8-280):** Der Snapshot entsteht synchron im Plan-Tick, die
Beobachtung läuft verzögert (requestIdleCallback, sonst setTimeout) und immer
mit Uhr und Zeitbudget — ein Test verhindert eine Produktionsverdrahtung ohne
Budget. Der Idempotenzschlüssel führt die Bewertungsidentität (`userId`,
`weekId`, `planId`) ausdrücklich, nicht nur transitiv über den Snapshot-Hash
(`shadow-adaptive@2`).

**Bauen und Aktivieren sind getrennt.** Der Übersetzer von `targetLoad` und
`dimensionPolicy` in konkrete Wochenplaneinheiten (Stufe 6a, nächster Schritt)
wird vollständig mit Fixtures gebaut und getestet, **bevor** die
Shadow-Kriterien erfüllt sind — seine produktive Anwendung bleibt gesperrt, bis
sie es sind. Krankheit, Taper und Deload nehmen den Codepfad per Fixture ab;
die realen Shadow-Daten validieren zusätzlich Normalfall, Datenlücken und
tatsächliche Abweichungen.

**Abnahme-Schärfungen (v8-284, `shadow-adaptive@3`):**

1. **Versionskohorte.** Eine Beobachtung nimmt nur den Code ab, den sie
   ausgeführt hat. `acceptance()` bewertet ausschließlich Beobachtungen mit
   identischen Vertragsversionen (shadow-adaptive · goal-feasibility ·
   progression · plan-translator, je Modul und Policy); fremde Kohorten werden
   gezählt und ausgewiesen (`excludedOtherCohort`), nie bewertet. Jeder
   Versionssprung eines dieser Verträge startet die Belegsammlung neu — das
   ist kein Ärgernis, sondern der Zweck.
2. **Belegarten getrennt.** Sicherheitspfade (Krankheit, Taper, Deload,
   review) dürfen per Fixture abgenommen werden. Der Alltag nicht:
   `plan_unchanged`, `full_chain`, `deviation_explainable`,
   `no_positive_without_auto` und `reproducible` zählen nur aus **echten**
   Beobachtungen (`REQUIRE_REAL`). Jedes Kriterium weist seine Belegbasis aus
   (`basis: {real, fixture, evaluatedOn}`); ein Satz, der nur aus Fixtures
   besteht, erfüllt kein Alltagskriterium.
3. **Persistenz.** `shadowAcceptance()` liest zuerst die dauerhafte Historie
   (`engine_decision_log`); der lokale Ring ist nur der ausgewiesene Notbehelf
   (`source: 'local_ring_fallback' | 'local_ring_offline'`).

Dazu `adaptive-card@2`: zentrales Escaping inklusive einfacher
Anführungszeichen, als Fuzz über jedes String-Feld des Views getestet.

**Vollständiger Abnahmevertrag und Belegstärke (v8-285, `shadow-adaptive@4`):**

Die Kohorte umfasst jetzt **alle End-to-End-Abhängigkeiten** — 15 explizite
Versionen: shadow(+Policy) · load-history(+Policy) · session-debrief · evidence
· load-profile · progression(+Policy) · goal-feasibility(+Policy) ·
plan-translator(+Policy) · week-plan-designer · week-plan-policy. Keine
Registry, eine benannte Liste. Ändert sich `load-history`, beruhen alte und
neue Beobachtungen auf verschiedenen Belastungszuständen — die Kohorten trennen
sich.

Jedes Kriterium trägt **Belegstärke** (`independentCases`, `realCases`,
`fixtureCases`, `firstObservedAt`, `lastObservedAt`) und **Mindestfallzahlen**
[A] echter unabhängiger Fälle: `plan_unchanged` 5 · `full_chain` 3 ·
`no_positive_without_auto` 5 · `reproducible` 3 · `deviation_explainable` 2.
Reproduzierbar ist nur, was **wiederholt** und dabei identisch geblieben ist —
Stille ist kein Beleg; zehn Render desselben Plans bleiben ein Fall.

Zwei Betriebsfehler dabei geschlossen: Die 500er-Abfrage lud aufsteigend die
**ältesten** Einträge (jetzt neueste zuerst, als Vertrag getestet), und der
lokale Ring überlebte einen Nutzerwechsel im Tab (Beobachtungen tragen jetzt
ihren Nutzer und werden gefiltert). Zusätzlich: Stufendauern je Beobachtung und
`operational.partialRate` in der Abnahme — das 250-ms-Budget kann eine laufende
Stufe nicht unterbrechen; ob es trägt, zeigt die Quote.

**Für den späteren Aktivierungspfad vorgemerkt (aus dem Review, verbindlich):**
kontrollierte Aktivierung nur für Testnutzer · atomare Planrevision · erneuter
Policy-Lauf unmittelbar vor dem Speichern · Decision-Log-Eintrag für Vorschlag
UND tatsächliches Ergebnis · Vergleich `proposed` gegen `applied` · schnelle
Abschaltung · Rollback. Und: Der `baseMin`-Lebenszyklus setzt voraus, dass
Nutzeränderungen zuverlässig die Planrevision erhöhen oder
`baseSource: 'user_edit'` setzen — diese Zusage ist im Anwendungspfad
**verhaltenszuprüfen**, nicht zu übernehmen.

**Letzte Invarianten und Einfrieren (v8-286, `shadow-adaptive@5`):** Vier
Invarianten aus dem Abschluss-Review verifiziert, zwei korrigiert:
`independentCases` zählt jetzt **Fall-Identitäten** (Nutzer + Woche + Plan)
statt Snapshots — fünf Render derselben Woche mit gewachsenen Daten sind ein
Fall, und Unbestimmbares kollabiert fail-closed zu einem. `partial`-
Beobachtungen nehmen keine fachlichen Zustände mehr ab (nur `plan_unchanged`
gilt weiter für alle — die Nicht-Mutation kennt keine Ausnahme). Der lokale
Ring filtert fail-closed auf eindeutige Nutzer, und die Abnahme ist
nachweislich reihenfolgeunabhängig.

**Die Kohorte ist eingefroren.** `supabase/tests/_acceptance-cohort.json` pinnt
die 15 Vertragsversionen (Schlüssel `1fe286bb`, Stand v8-286). Jede Änderung an
einem Kohortenmodul bricht den Test mit Klartext und verlangt eine bewusste
Bestätigung. Ab jetzt gilt der Ablauf:

```
v8-286 stabil halten
→ Sicherheitspfade per markierten Fixtures belegen
→ echte Alltagsfälle sammeln (verschiedene Wochen!)
→ identische Fälle gezielt wiederholen
→ partialRate und Stufendauern beobachten
→ shadowAcceptance() auswerten
```

Erst wenn alle acht erfüllt sind, wird die kontrollierte Plananwendung
freigeschaltet. Die vorhandenen Sperren gelten dabei unverändert:
`autoApplicable: false` verändert nichts · `provisionalTargetLoad` wird nie
automatisch angewendet · `scope: null` wirkt nicht global · Goal Feasibility
verändert keinen C2-Korridor · jede angewandte Änderung landet mit Bezugsbasis
und Begründung im Decision Log.

---

## 7c. Stufe 6a · `js/engine/plan-translator.js` — der Übersetzer

**Status: gebaut (v8-281), produktive Anwendung gesperrt.** `plan-translator@1`
/ `pt-policy@1`, `plan_translator_test.mjs` mit 87 Prüfungen, 11
Mutationsproben. `ui.js` ruft ihn nirgends auf — der Test prüft die Sperre
selbst; wer aktiviert, muss den Test bewusst ändern und damit die Abnahmefrage
beantworten.

**Das Problem ist unterbestimmt** — viele Wochenpläne erreichen dieselbe
Ziellast. Die Auswahlregel ist Teil des Vertrags: **minimale Abweichung vom
bereits akzeptierten Plan.** Einheiten erhalten → Dauer im Rahmen anpassen →
nur bei Frequenz-Policy höchstens eine Einheit entfernen (nie erfinden, v1) →
Intensität nur im ausdrücklich betroffenen Scope entschärfen (`from/to` der
Intensitätsklasse, kein Label-Umschreiben).

**Zehn Invarianten, jede als Test:** Vorschlag statt Mutation · Determinismus
(inkl. `proposalHash`) · C2-Sperren erzeugen nichts automatisch Anwendbares ·
kein Eingriff außerhalb des Scopes (26 Zielwerte als Eigenschaft) · drei
Dimensionen getrennt · `achievedLoad`/`residualGap`/`gapStatus` mit benannten
Gründen statt behaupteter Exaktheit · manuelle Einheiten unantastbar und keine
Kompensation über die Klemme · `requiresPolicyPass` an jedem Vorschlag ·
Verweiskette (targetLoad, Korridor, Auswahlgrund, Snapshot, Versionen) ·
Idempotenz.

**Der wichtigste Befund beim Bau — die Ratsche:** Die Skalierklemme
`[0.75, 1.25]` war zunächst an der *aktuellen* Dauer verankert. Bei geklemmtem
Faktor holte sich jede erneute Übersetzung ein weiteres Viertel
(`50 → 65 → 80 → …`); in der Reduktionsrichtung (Taper, `0.75^n`) die
gefährlichere Variante. Jetzt hält `baseMin` die **akzeptierte** Dauer fest,
`preview()` stempelt sie beim ersten Anpassen, und die Klemme bindet an sie.
Ein Eigenschaftstest über fünf Wiederanwendungsrunden hält das fest.

**Lasteinheit ausgewiesen:** `targetLoad` ist systemische Last je bekanntem Tag;
der Wochenvergleich rechnet ×7, und beides steht im Ergebnis
(`loadUnit: 'systemic_per_known_day'`, `weeklyFactor: 7`) — Tages- und
Wochenlast sind nicht verwechselbar.

**Fixtures decken die Sonderpfade:** Taper (Volumen ↓, Intensität erhalten,
höchstens eine Entfernung), Krankheit (Volumen ↓ UND Intervalle → moderat,
entschärft statt gestrichen), Deload (`reduce_or_maintain` streicht nicht
automatisch), Toleranz-Scope (nur die Lauf-Intervalle, Gym/easy/Long unberührt)
und der Gegenfall: `maintain`-Frequenz entfernt auch bei gerissener Klemme
nichts — die Lücke bleibt ausgewiesen.

**Der Anker hat einen Lebenszyklus (v8-282, `plan-translator@2`).** `baseMin`
hängt nicht für immer an der ersten akzeptierten Dauer — sonst zöge die
Ratschenklemme, die maschinelles Wegdriften verhindert, eine echte
Nutzerentscheidung zurück (derselbe Fehler mit umgekehrtem Vorzeichen). Der
Stempel trägt seine Herkunft:

```
{ baseMin, basePlanId, basePlanRevision, baseSource: 'accepted_plan' }

erneute Übersetzung derselben Planrevision  → baseMin behalten
neue Revision / neuer Plan / user_edit      → Anker = aktuelle Dauer
```

`preview()` stempelt die volle Herkunft und ersetzt fremde Stempel. Der
Anwendungspfad muss bei bewussten Nutzeränderungen die Revision erhöhen oder
`baseSource: 'user_edit'` setzen — beides führt zur Neuverankerung.

---

## 7d. Sichtbare Erklärung · View-Vertrag `ORVIA.getAdaptiveExplanation()`

**Status: Datenschicht gebaut (v8-282), UI-Karte folgt.** Die UI hängt nicht an
der privaten Struktur `_lastShadow`, sondern an einem stabilen View-Vertrag mit
drei Zusagen:

1. **Snapshot-Konsistenz.** Beobachtung, Machbarkeit und Übersetzer-Vorschau
   stammen aus demselben eingefrorenen Snapshot; der Übersetzer läuft gegen
   `snap.currentPlan`, nie gegen den Live-Plan. Weicht der Live-Plan ab →
   `stale: true` (fail-closed auch im Fehlerfall) — die Vorher/Nachher-
   Darstellung gehört dann ausgegraut, nicht aktualisiert.
2. **Datensparsamkeit.** Keine Roh-Debriefs, keine Aktivitätslisten, keine
   internen Hashes — nur die aufbereiteten Aussagen der Karte: aktueller Plan ·
   adaptive Empfehlung · modellierte Zielaussicht · warum · was würde sich
   ändern · welche Restlücke bleibt.
3. **Nur lesend.** Die Aktivierungssperre ist präzisiert, nicht aufgeweicht:
   Der Übersetzer darf in `ui.js` nur innerhalb von `getAdaptiveExplanation`
   vorkommen, nur lesend, nur gegen den Snapshot — kein `preview()`-Aufruf,
   kein Schreiben in den Plan. Der Test prüft jede Fundstelle.

---

## 7e. Sichtbare Erklärung · Adaptive Karte (v8-283)

**Status: gebaut, verdrahtet, verhaltensgetestet.** `js/adaptive-card.js`
(`adaptive-card@1`) + Container `#adaptiveCard` auf der Planseite. Die Karte ist
eine **Sichtscheibe** auf den Schattenbetrieb — kein Aktivierungspfad: Sie hat
keinerlei Schaltflächen, und der Übersetzer läuft in ihr nur lesend gegen den
Snapshot-Plan.

**Die Architektur folgt dem Testanspruch.** View-Aufbau und HTML-Erzeugung
liegen in einem reinen, in Node ausführbaren Modul (kein DOM, kein PROFILE,
kein Storage, keine Uhr). Nur so ist das entscheidende Versprechen als
**Verhalten** testbar statt als Quelltextsuche:

```
Karte dreimal rendern (echte Kette: Shadow → Übersetzer → View → HTML)
→ Plan vorher/nachher byte-identisch
→ Profil vorher/nachher byte-identisch
→ Snapshot byte-identisch
→ keine Speicherfunktion aufgerufen (Spione auf save/saveProfile/savePlan/localStorage)
```

`ui.js` behält nur die Delegation (`getAdaptiveExplanation`) und einen
Einhänger, der ausschließlich `render(view)` in den Container schreibt.

**Die neun Darstellungsregeln, jede als Test** (`adaptive_card_test.mjs`, 45):
nur der View wird dargestellt · keine Engine-Rechnung im Renderer ·
stale/partial/insufficient_data sichtbar verschieden — bei `stale` erscheint
**keine** scheinbar aktuelle Vorher/Nachher-Liste · `within_modeled_corridor`
wird nie zu „machbar" (verbotene Wörter über 16 Karten geprüft) ·
`population_prior` verständlich übersetzt („Erfahrungswerte vergleichbarer
Sportler — kein auf dich individualisiertes Modell", Beleglage benannt) · jede
Änderung nennt Sportart und Geltungsbereich · fail-soft leer statt halber
Karte · gar keine Schaltfläche · Nutzereingaben escaped.

Sieben Mutationsproben, alle gefangen — darunter der eingebaute
Anwenden-Knopf, die „machbar"-Formulierung und der in die Vorschau
geschmuggelte Live-Plan.

**Damit ist die Reihenfolge `Stufe 5 → Shadow → sichtbare Erklärung`
abgeschlossen.** Offen bleibt die kontrollierte Plananwendung — gesperrt hinter
den acht Shadow-Abnahmekriterien (Abschnitt 7b).

---

## 7f. Prediction Observer · `js/engine/prediction-observer.js` (v8-287)

**Status: Modul gebaut und getestet, Verdrahtung folgt.** Ein reiner Beobachter
**außerhalb der eingefrorenen Abnahmekohorte** — der Pin `1fe286bb` bleibt
unberührt, und ein Test prüft, dass der Observer kein Kohortenmodul importiert.
Kein Lernsystem, ein Messinstrument: Was hat ORVIA vorhergesagt, wie lag es
daneben, wo ist das Modell systematisch zu optimistisch oder pessimistisch?

**Erwartung ≠ Vorhersage.** `prescriptionExpectation` ist das Trainingsziel
(normativ), `modelPrediction` die statistische Prognose (RPE-Band,
Completion-Wahrscheinlichkeit, Zone-Hit-Band; `model: 'population_prior'`,
`individualized: false`, `evidence: 'weak'`) mit **eigener Modellversion**
(`prediction-model@1`). Heute speisen sich beide aus derselben Basis; die
Trennung erlaubt einem späteren individuellen Modell, die Prognose zu ändern,
ohne die Prescription umzuschreiben. **Keine Toleranz je Einheit** — nur
beobachtbare Größen; Toleranz bleibt der abgeleitete Zustand aus C1/C3.

**Invarianten (alle getestet, 6 Mutationsproben):** eingefroren vor dem
Ergebnis (`deepFreeze` + `immutableHash`, Manipulation fällt beim Nachrechnen
auf) · Future Leakage fail-closed · deterministische ID je Session +
Planrevision + Modellversion · Auflösung nur bei passendem Nutzer, Session,
Revision, Prescription-Hash (`superseded` / `not_comparable` mit Grund) ·
**kein Debrief heißt `unresolved`, niemals Misserfolg** · append-only ·
Kalibrierung nur je {Modellversion, Sportart, Sessiontyp}, jede Kennzahl mit
Fallzahl, Auflösungsquote und fehlenden Debriefs.

`decision-log@3`: `prediction_record` / `prediction_evaluation` als eigene
Beobachtungstypen, von `explain()` ausgeschlossen. Die Shadow-Abfrage filtert
serverseitig **vor** dem Limit — Vorhersagen können die Shadow-Beobachtungen
nicht aus dem 500er-Fenster verdrängen.

**Härtung vor der Verdrahtung (v8-288, `prediction-observer@2`):** Vier
Vertragspunkte aus dem Review geschlossen. (1) *Vor dem Ereignis, wirklich*:
absolvierte Einheit oder vorhandenes Debrief ⇒ abgelehnt; bekannte Startzeit ⇒
`predictedAt` strikt davor; nur Tagesdatum ⇒ Vorhersage nur vor dem Tag mit
ausgewiesenem `timingBasis: 'day_level_only'`; kein Zeitbezug ⇒ abgelehnt.
(2) *Integrität, nicht Authentizität*: Der Befund heißt `integrity_mismatch` —
der Hash im selben Record erkennt versehentliche Änderungen, keine Manipulation;
das Wort „tampered" kommt im Modul nicht mehr vor. (3) *Deklarationspflicht*:
`inputs: [{name, at}]` — ein zeittragender Eingang ohne Zeitpunkt wird vom
Modul abgelehnt, nicht vom Aufrufer entschieden. (4) *Überholverbot aufgehoben,
Verbindung gesichert*: fehlende Vorhersage beim Debrief ⇒ `pending` (kein
Endzustand); `reconcile()` verbindet später über die exakte Kombination
{userId, sessionId, planId, planRevision, prescriptionHash, modelVersion} —
andere Revision oder Prescription verbinden nie. `PRIOR.basis` steht
maschinenlesbar im Record (0.85 `population_prior` [S], Bänder
`policy_assumption` [A]).

**Integrationsbefunde geschlossen (v8-289, `prediction-observer@3` +
`debrief-record@1` + Migration 0033):** Die Fixture-Tests waren grün, die
Integration war es nicht — acht Befunde aus Gegenproben gegen das echte
System. Die wichtigsten: Der 0032-Constraint lehnte **alle**
Beobachtungstypen still ab (Migration 0033 ersetzt ihn — **muss eingespielt
werden**, sonst sammelt die Abnahme nichts); `planned.durationMin` wurde aus
`actual` kopiert (Outcome Leakage — die Ausführung diktierte die Erwartung,
`completionPct` war konstruktionsbedingt 1); das echte Debrief hatte weder
`id` noch `userId` noch `planRevision` und trug die Template- statt der
Occurrence-ID; die Shadow-Verdrahtung übergab keine Wochen-Identität. Dazu
im Observer: Tagesprüfung entinvertiert (Vorhersage nur **vor** dem Tag),
unlesbare Zeitstempel fail-closed, Identität vollständig geprüft,
Reconciliation mit der Modellversion der Vorhersage, Prioren eingefroren.

Der kanonische Debrief-Vertrag lebt in `js/engine/debrief-record.js` —
`gmDbSave` delegiert, und die Tests bauen ihre Debriefs mit **derselben**
Funktion (die Ideal-Fixture hatte die Lücken verdeckt). Die volle Kette
Prescription → C3-Urteil → kanonischer Record → predict → resolve → scored
läuft als Test.

**Freigabe-Blocker geschlossen (v8-290):** Testpfade layoutrobust (kanonisch
`app/supabase/tests` und umstrukturiert `supabase/tests` neben `app/` — die
starre Auflösung ergab 0/46); Occurrence über die bestehende App-Identität
`po:<datum>:<templateId>` (Kollision zweier gleich benannter Einheiten
getestet), `sessionIdBasis` weist den Label-Fallback aus;
Vorhersage-Identität fail-closed (`planId`/`planRevision` Pflicht, `predictionId`
umfasst Plan + Prescription-Hash); vorhanden-aber-unlesbare Zeiten abgelehnt
statt als fehlend gedeutet (auch `resolve`: Debrief ohne lesbare Zeit/Revision ⇒
`not_comparable`); Shadow-Fallidentität ohne Snapshot-Rückfall
(`shadow-adaptive@6`, **bewusste** Kohortenänderung → neuer Pin `9064d4f8`;
Preis null, da die alte Sammlung am 0032-Constraint scheiterte);
`REQUIRED_INPUTS` je Modellversion. Neu: `prediction_observer_live_test.mjs` —
Insert→Read→Kalibrierung gegen die echte Instanz (env-gesteuert, exit 2).

**Zweite Gegenprüfung geschlossen (v8-291, `prediction-observer@5` +
`debrief-record@3`):** Fünf dateibasierte Befunde, in Gians Reihenfolge.
(1) Die Layoutrobustheit betraf nicht 50, sondern ~180 Testdateien
(URL-Sonden, require-Pfade, `'../../'`-Literale, APPROOT-Sonden,
Live-Helfer) — beide Layouts laufen jetzt 232/0/7, verifiziert gegen ein
Replikat des Geräte-Checkouts; die Migrationskette 0001–0033 gehört
**vollständig** nach `supabase/migrations` (die Geschwisterpfad-Tests
setzen sie voraus). (2) Der Live-Test baut seine Inserts über `DL.build()`
— mit `decision_runtime_hash`/`decision_hash` (NOT NULL seit 0032); der
alte Insert wäre nach 0033 am nächsten Constraint gestorben. (3) Die
Dedup-Regel des Speicherpfads lebt als reine Funktion
`debriefRecord.upsert()`: ID-Treffer strikt, Legacy-Records ohne ID einmalig
per Schlüssel migriert, verschiedene IDs mischen nie — `gmDbSave` nutzt sie,
`gmDbFind` sucht zuerst die Occurrence-ID und fällt bei `template_id`-Basis
nicht aufs Label zurück. (4) Der Live-Test ist ein echter Roundtrip:
speichern → **die gespeicherte Vorhersage finden** → mit dem *gelesenen*
Record auflösen → Auswertung speichern → beides lesen → daraus kalibrieren.
(5) `REQUIRED_INPUTS` ist `deepFreeze`-eingefroren, und die Prognose rechnet
ausschließlich aus dem deklarierten `modelView` — Präsenz-Check und Rechnung
nutzen dieselben Felder.

**Dritte Gegenprüfung geschlossen (v8-292, `debrief-record@4`):**
(1) `0028_user_metric_series_rollback.sql` lag mit doppelter Versionsnummer
im aktiven Migrationsordner und löscht die Tabelle der Vorwärtsmigration —
verschoben nach `supabase/migrations_rollback/`; der neue
`migrations_chain_contract_test` bewacht das dauerhaft (kein Rollback im
Vorwärtspfad, keine Versionsdublette, lückenlose Kette, kein unbedingter
Tabellenverlust). (2) Die Decision-Log-Identität des Debriefs war
`'db:'+key` — kollidierte am `unique(user_id, decision_id)` für Zwillinge
und für jedes erneute Speichern; jetzt Occurrence-ID + Ereigniszeit, jede
Korrektur ein neuer Eintrag. (3) `upsert()` ersetzt ganzheitlich statt
feldweise — die Feldkopie hätte nach einem fehlgeschlagenen C3-Urteil neues
RPE mit altem Snapshot kombiniert (Chimären-Test + Mutationsprobe).

**Verdrahtung gebaut, Sammlung gesperrt (v8-293, `feature-flags@2` +
Migration 0034):** `logWeekPredictions` (nach `logWeekShadow`, Snapshot
synchron, predict verzögert+budgetiert, nur strikt künftige und nie bereits
debriefte Einheiten, Lookup-Fehler fail-closed) und
`resolveDebriefPrediction` (nach upsert+saveProfile, pending bei fehlender
Vorhersage, Reconciliation über die exakte Identität) — beides hinter dem
serverseitigen Flag `prediction_observer` (Standard AUS, Client ohne
Schreibrecht). `prediction_wiring_test` führt die echten ui.js-Slices in
Node aus: Flag-aus ⇒ nichts, werfender Observer ⇒ Plan byte-identisch,
scored/pending/Reconciliation als Verhalten; fünf Mutationsproben gefangen.

**Lebenszyklus geschlossen (v8-294):** (1) Der Vorhersage-Snapshot friert im
Plan-Tick wirklich ein — Einheiten und Debrief-Historie als tiefe Kopie;
Mutation zwischen Tick und Callback ist wirkungslos (Kontrolllauf-Test).
(2) Neustart-Fall: resolve() greift bei leerem Ring auf die persistierten
Vorhersagen der Plan-ID zurück (serverseitiger Typ+Plan-Filter vor dem
Limit); Abfragefehler ⇒ ehrlich pending. (3) Kandidatenwahl nach exakter
Identität: gleiche Revision + Prescription-Hash vor gleicher Revision vor
neuester der Session — nur die alte Revision vorhanden bleibt superseded.

**Offline-/Retry-Lebenszyklus geschlossen (v8-295):**
`reconcilePendingPredictions` als Herzschlag am Planlauf — offene pendings
(Ring und persistiert) werden ohne Nutzerzutun erneut versucht, mit
serverseitig gefilterten Session-Vorhersagen und Ergebnis-Dedup
(idempotent, Budget 10/Lauf). Die resolve-Rückgriff-Abfrage schränkt die
Session jetzt serverseitig vor dem Limit ein — 60 neuere fremde
Vorhersagen verdrängen die gesuchte nicht mehr. Damit ist die
Beobachtungsleitung betriebsfest; offen bleibt allein die Aktivierung.

**Der Produktpfad erreicht den Observer (v8-296):** Schatten, Vorhersagen
und Herzschlag hingen im Generator — `activeWeekPlan()` kehrt bei
kanonischem/gespeichertem Plan aber vorher zurück; der Normalfall erreichte
den Observer nie (das betraf auch die Shadow-Datensammlung).
`gmObserveWeekPlan` wrappt jetzt alle Rückgabepfade der zentralen
Planquelle, mit Render-Sturm-Drossel (unveränderter Plan 1×/min, geänderter
sofort). Zweitens: `superseded` ist kein Endzustand des Debriefs mehr —
nur `scored` ist endgültig; der Herzschlag wertet mit exakter Präferenz
auf und loggt nur Upgrades. Z13 führt das echte `activeWeekPlan` aus;
Z14 den Fall „superseded zuerst, exakte Vorhersage später ⇒ scored".

**Altplan-Kette und Drossel geschlossen (v8-297):** `gmPlanIdentity()` gibt
auch dem gespeicherten Altplan eine ehrliche Identität (weekplan:Woche +
Inhalts-Revision; kanonisch gewinnt das Modell) und speist Vorhersage UND
`gmDbSave` aus derselben Quelle. Dabei dritter Befund: Die Wiring-
Prescription (ohne durationMin, mit Historie) hashte nie gleich dem
C3-Snapshot — jede Auflösung wäre `not_comparable` gewesen; jetzt exakte
C3-Parität (durationMin aus `plannedDurationOf`, keine Historie, Zone aus
`paceForUnit`). Drossel-Schlüssel enthält den Debrief-Datenstand, gmDbSave
bustet direkt. Z15 weist die volle Altplan-Kette bis `scored` nach (mit
dauer-abweichender Einheit), Z16 die Drossel in beide Richtungen.

**P0 und sportübergreifende Kette (v8-298):** Der Schatten bekam nie echte
Debriefs — `DB.sessionDebriefs` wird nirgends geschrieben, die echten
C3-Records liegen im kanonischen Store; jetzt speist `gmDbStore()` den
Schatten (toter Pfad per Vertrag verboten). `gmSportIdOfUnit` ist die eine
Sportquelle beider Seiten (Rad→cycling, Schwimmen→swimming; auch als
`debrief-record@5`-Rückfall) — Z17 führt Rad- und Schwimm-Kette bis
`scored`, mit FTP-/CSS-Zonen im Kontext und der ehrlichen Feststellung,
dass `paceForUnit` heute Laufen-only ist (Zonen-Integration = bewusste
C3-/Kohortenänderung, eigener Schritt). Die Drossel kennt alle
Eingangsdaten (Aktivitäten, Ziel, Level, Sportarten).

**Der eine Eingang (v8-299, `observer-input@1` + `shadow-adaptive@7`):**
Nach zwei toten Quellen in Folge sammelt jetzt ein reines, versioniertes
Modul alle Beobachtungseingänge: Profil + Aktivitäten (echter
`activityStore`) + Debriefs + Ziel + Performance + Planidentität →
eingefrorener Snapshot + Hash. Denselben Snapshot verwenden Schatten
(inkl. Altplan-planId), Prediction und Drossel — die Drossel ist der
Snapshot-Hash, jede Zustandsänderung (auch Performance/Zielzeit) zählt
automatisch; fehlende Quellen sind `basis:'unavailable'`, nicht leer.
Die Adapterversion steht als 16. Feld in der Abnahmekohorte — **neuer Pin
`e8a0c381`**; Altbelege unter `9064d4f8` zählen bewusst nicht mehr (sie
entstanden mit toten Quellen).

**Produktformen (v8-300, `observer-input@2` + `shadow-adaptive@8`):** Der
Adapter leitet jetzt die Stufe-5-Formen ab (`feasibilityGoal` aus
`targetMin`, `feasibilityPerformance` per Riegel auf die Zieldistanz) —
vorher war jede Produktbewertung `insufficient_data`. Eingangs-Herkunft
(Hash/Version/Basis) wird bis in die persistierte Beobachtung getragen;
die Vorhersage liest nur noch den eingefrorenen Snapshot (Performance +
Debriefs im Kontext); Steuerfelder verdrahtet (availability, phase aus
`Calc.racePhases`, Krankheit aus den Morgen-Check-ins, targetDate).
**Pin erneut neu: `de8b1585`.** Z21 beweist die echte Kette bis zu einem
realen Stufe-5-Urteil.

**Sicherheit und ehrliche Evidenz (v8-301, `observer-input@3` +
`shadow-adaptive@9` + `goal-feasibility@3`):** Krankheits-**Episode** mit
`symptomFreeDays` (Lücke = unknown, Ende nur durch ≥7 bestätigte freie
Tage, nie durch Fensterablauf); Sicherheitsschicht übersetzt Beschwerden
und Red Flags fail-closed in C2-Form (severity/blocks) und SA reicht sie
an die Progression durch; Pflichtquellen-Gate in der Abnahme
(`unavailable` zählt nur noch für `plan_unchanged`); Riegel-Extrapolation
deckelt Evidenz, trägt Band, und GF prüft „Ziel erreicht" gegen die
konservative Bandkante. **Pin neu: `19343e54`.**

**Produktquellen und konsistente Kante (v8-302, `observer-input@4` +
`shadow-adaptive@10` + `goal-feasibility@4`):** Beschwerden aus der
kanonischen Quelle (`profileModel.activeConstraints`/`constraintsList` —
`PROFILE.constraints` war ein Phantom); Krankheits-Episode ohne
Fensterablauf (Serie bis zum letzten positiven Tag, Kappe 180d
ausgewiesen) mit **rückwärts** gezählter aktueller false-Serie;
Pflichtquellen-Gate wirklich fail-closed (fehlende Basis/Felder schließen
aus; checkins + profileConstraints Pflicht); GF-Cache-Schlüssel trägt
band/modelBasis/distanceRatio/modelVersion; die konservative Bandkante
gilt für **jede** Bedarfsrechnung. **Pin neu: `dd2b773c`.**
Offen (dokumentiert): Quellenverweis für die Riegel-Exponentenspanne
1,04–1,08 aus der Wissenskette; `availability` steuert kein Urteil.

**Die Quelle wird Vertrag (v8-303, `observer-source@1` +
`observer-input@5` + `shadow-adaptive@11`):** Die Quellenbeschaffung ist
jetzt ein versioniertes, kohortengebundenes Modul (`source` als 17. Feld):
Check-in-Serie **immer** über das volle 180-Tage-Fenster (der
29-Tage-Produktfall läuft als Test durch das echte `activeWeekPlan`);
Beschwerden als deterministische fachliche Projektion ohne Uhr/Zufall
(Hash-Stabilität als Test); `observed` wird übersetzt (Politik-Entscheid,
konsistent mit profile-center/decision-engine-v2, ausgewiesen mit
evidence weak + reviewStatus). ui sammelt keine fachlichen Zustände mehr
selbst. **Pin neu: `b8581b08`.**

**Keine zweite Feldliste (v8-304, `shadow-adaptive@12` +
`observer-source@2`):** `O.logWeekShadow` reicht den Kontext vollständig an
`SA.snapshot` durch (kein handgepflegter Zweitkatalog — der verwarf
constraints und Eingangs-Herkunft), und `toLogEntry` — die beim Beheben
gefundene **dritte** Feldliste — persistiert die Herkunft jetzt in den
Log-Record. Der volle Kettentest (echtes `activeWeekPlan` → echtes
`logWeekShadow` → SA → Decision Log) prüft den fertigen Record: Herkunft
vorhanden, C2 blocked, Gate nimmt an. Sortierschlüssel der
Beschwerdeprojektion = vollständige stabile Serialisierung.
Vertragsklarstellung: keine automatische Episodenbeendigung **innerhalb
der 180-Tage-Historie** (Tag 181 = ausdrückliche Modellgrenze).
**Pin neu: `86d1add8`.**

**Eine Spaltenabbildung (v8-305, `decision-log@4`):** Gians
v8-304c-Review, beide Punkte bestätigt: (1) `DL.build()` prüft nur Typ,
Zeitstempel und ID — Datenbankpflichten (u. a. `user_id`, entsteht erst in
der Senke) kann es nicht kennen; (2) der Live-Test hatte eine **eigene**
Spaltenabbildung neben der produktiven `_sink()`, und sie war bereits
divergiert (`parent_decision_id`/`supersedes_decision_id`/`week_id`
fehlten) — ein grüner Live-Test bewies die App-Senke nicht. Fix:
`decisionLog.toRow(record, userId)` als **die eine** reine, fail-closed
Abbildung (fehlende NOT-NULL-Quelle ⇒ keine Zeile, benannter Grund;
`rejectedTruncated` bewusst ohne Spalte); `_sink()` und Live-Test nutzen
dieselbe Funktion. `decision_sink_test` (17) führt die **echte** `_sink()`
mit Supabase-Spion aus: Zeile byte-gleich zu `toRow()`, Spaltenvertrag
**gegen die Migrationsdatei 0032 gelesen** (Byte-Parität allein wäre
blind, wenn beide Seiten dieselbe fehlerhafte Abbildung teilen),
fail-closed-Pfade, Quelltextwächter gegen Rückkehr einer Eigenabbildung.
Drei Mutationsproben gefangen. **Kein neuer Pin** (`log` ist kein
COHORT_FIELD; Pin bleibt `86d1add8`); `decisionRuntimeHash` ändert sich
planmäßig mit `@4`.

**Ehrliche Fehlersemantik der Senke (v8-306, nur ui.js + Tests):** Gians
v8-305-Review. (1) **Echter Fehler:** supabase-js löst SQL-/Constraint-
Fehler mit `{data,error}` auf statt abzulehnen — die Senke meldete jeden
Constraint-Tod als `true`. Erfolg ist jetzt nur eine Auflösung ohne
`error`; der Test-Spion bildet die echte Semantik nach (der alte konnte
den Pfad nicht sehen). (2) **Registrierung bewiesen:** die echte
`setSink(_sink)`-Zeile läuft im Test, danach muss `DL.logDecision()`
den Spion erreichen — ohne die Zeile wären alle bisherigen Tests grün
geblieben bei toter Persistenz. (3) **Schemawächter über die ganze
append-only-Kette** statt nur 0032 (`create table` + spätere
`add/drop column`; synthetische 0099-Probe wird gefangen).
`decision_sink_test` 24. Kein neuer Pin (`86d1add8`); `decision-log@4`
unverändert. Damit ist „App → registrierte Senke → Supabase" bis an die
Client-Grenze verhaltensbewiesen; den echten Roundtrip beweist weiterhin
nur der Live-Test.
**Parser-Vertrag des Schemawächters (v8-306b, Gians Grenzbefund):** Der
Wächter versteht `add/drop column`; Constraint-Änderungen sind bewusst
frei (0033 ändert keine Spaltenmenge). Alles Unverstandene ist
fail-closed: ein `rename` (Spalte oder Tabelle) auf
`engine_decision_log` macht den Test rot mit Datei + Statement, bis
Parser **und** `toRow()` die Änderung ausdrücklich behandeln — ein
grüner Wächter, der ein Rename nicht sieht, würde lügen.

**Die eine Prescription (v8-307, `session-debrief@3`):** Gians Live-Test
fand einen echten Vertragsfehler — und darunter einen Produktfehler.
(1) `typeOf` nahm den **ersten wahren** Text (`type || d || l`) und
matchte nur ihn: `Intervalle · 40 min` wurde über den Dauertext
`unknown` (4,8/weak statt Intervallwert, falsche Domänen) — betroffen
war jede Einheit mit reinem Dauertext, also der Normalfall des Planners.
Reihenfolge ist jetzt Vertrag: expliziter Typ → Label → Detailtext,
jeder Kandidat einzeln mit Durchfall; Gegenprobe im Test:
`Intervalle + 40 min ⇒ vo2`. (2) `SD.prescriptionOf` erzeugt die
Vertragsfelder des `prescriptionHash` für **alle drei** Erzeuger
(Vorhersage, C3-Snapshot, Live-Test) — keine inline-Konstruktion, keine
handgebaute Live-rx (feste Werte hätten den nächsten
Klassifikationsfehler versteckt); `durationMin` kommt herein, die eine
Parserquelle bleibt `debrief-record.plannedDurationOf`. **Kohorte
bewusst neu gepinnt: `023ee59b`** (Sammlung war nie aktiv, keine Belege
verloren). Live-Test-Wächter: `SD.prescriptionOf` statt Handwerte,
vo2-Abbruchbedingung.

**Sessiontyp und Sport sind Vergleichsvertrag (v8-308,
`prediction-observer@6`):** Gians P0: `sessionType` fehlte im
`prescriptionHash` — Tempo- und Threshold-Verordnung mit gleichem
expectedRpe/Evidenz/Zone hashten identisch (reproduziert: beide
`0c77ef96`), eine Threshold-Einheit hätte als Tempo-Auswertung die
Kalibrierung verunreinigt. Jetzt im Hash; zusätzlich prüft `resolve()`
`prediction.sport` gegen `debrief.sportId` fail-closed
(`sport_unknown`/`sport_mismatch`) — die Occurrence bindet an den Slot,
nicht an die Sportart. Kein neuer Pin (Observer außerhalb der Kohorte,
`023ee59b`). Zweiter Befund: das Wiring-Fixture hing an der echten Uhr
(Sonntag ⇒ Ketten „entfällt", trotzdem bestanden) — jetzt fest der
Mittwoch der nächsten Woche (Z0 wacht; nächste Woche wegen des
predict-Vertrags `predicted_on_or_after_session_day` bei echter
lwp-Uhr). Dabei aufgedeckt: `length===1`-Annahmen galten nur samstags;
vier weitere handkopierte rx-Feldlisten in Tests durch
`SD.prescriptionOf` ersetzt.

**Eine Quelle für den Sessiontyp (v8-309, `prediction-observer@7`):**
Gians P0 nach @6: der Typ stand im Hash, der Record las die
Kalibrierungsgruppe aber aus `input.sessionType` (Repro: prescription
`threshold` + input `tempo` ⇒ scored, Gruppe `tempo`).
`prescription.sessionType` ist jetzt die einzige autoritative Quelle;
fehlend ⇒ `no_prescription_session_type`, widersprüchlicher Zweittyp ⇒
`session_type_mismatch` — kein stilles `unknown`, kein stiller Vorrang.
lwp und Live-Test übergeben keinen separaten Typ mehr; sieben
handkopierte Typ-Angaben in Wiring-Fixtures entfernt, zwei davon waren
bereits falsch (`threshold` auf Tempolauf) — die Fehlerklasse, die der
Vertrag ab jetzt abweist. Kein neuer Pin (`023ee59b`). Flag bleibt aus.

**Das Datum sperrt Aktionen (v8-310a, Ausbauplan v2.1 Runde 1):** Gians
P0 aus dem Geräte-Review. `_wOff`-Hoisting (undefined/NaN-Kopfzeile) →
pure Funktion `gmPlanWeekHeader`; Kalenderidentität: der Klick bildet
`dateIso` einmal aus der gerenderten Karte und reicht es unverändert
durch (`plannedOccurrenceIdForDate`); Starten/Erledigen nur wenn
`dateIso === heute`, zweiter Riegel `not_today` in den Funktionen
selbst; Debrief: Vergangenheit erlaubt, Zukunft gesperrt; drei
Tageszustände (`rest`/`free`/`unavailable`) statt „leer = Ruhetag".
`plan_calendar_identity_test` (25) mit Gians Pflicht-Gegenprobe. Kein
Pin betroffen (`023ee59b`). Status Aktivierung: Live-Test 8/0 ✓, 0033 +
0034 ✓, Flag aktiv — der Observer sammelt im echten Betrieb.

**Keine Legacy-Rekonstruktion mehr (v8-310a-Härtung):** Gians dritte
Review-Runde fand eine Vertragslücke, keinen sichtbaren Fehler:
`planEntryClick`/`openUnit`/`startPlannedUnit`/`markPlannedDone`/
`gmOpenSessionPage`/`gmOpenDebriefAt` rekonstruierten bei fehlendem
`dateIso` weiterhin einen Wert aus `planLocalDateForIndex(di)` bzw.
`gmOpenDebriefAt` sogar aus `_wOff` — kein produktiver Aufrufer traf das
je, aber der Vertrag „Datum kommt einmal vom Klick" galt nicht
lückenlos. Jetzt: fehlendes `dateIso` ⇒ `missing_date_context`,
Detailansicht ohne Datum bleibt nur lesbar, keine Rekonstruktion.
Vier Bestandstests (`batch2c_load_quality`, `batch2d_ratio_occurrence`,
`batch2e_integration`, `batch2f_correctness`) riefen `startPlannedUnit`/
`markPlannedDone` datumslos auf und lebten vom entfernten Fallback —
Fixtures auf explizite Daten umgestellt, `batch2f` bekam eine
zusätzliche `not_today`-Assertion vor der Slot-Prüfung. Kein Pin
betroffen (`023ee59b`).

**Drei getrennte Korrekturen (v8-310b, Ausbauplan v2.1 Runde 2):** Gians
Befund: ein frei gestartetes Krafttraining schien eine geplante
Oberkörper-Einheit zu erfüllen; eine versehentliche Erledigt-Markierung
und die Activity selbst ließen sich nicht getrennt korrigieren. Ursache
im Hub: „Geplant starten" ignorierte die gewählte Sportart und band
immer die erste heutige Planeinheit (Index 0) — jetzt sucht
`gmPlannedStartSelection` eine eindeutig passende Sportart, kein/
mehrere Treffer bleiben fail-closed. Frei bleibt frei: eine Activity
ohne explizite Occurrence erfüllt weiterhin keine Planeinheit (Tag+Sport
allein wird nie geraten). Drei getrennte Korrekturwege statt einem:
Activity löschen (bestehender Tombstone-Pfad), nur die Planzuordnung
lösen (Activity/Sätze/Last bleiben vollständig erhalten,
`unlinkActivityPlanCanonical`/`unlinkActivityFromPlan`), oder nur einen
datenlosen `plan_done`-Marker zurücknehmen — kein Weg tut zwei Dinge.
Link-Korrektur mit Provenance: `metrics.planLinkCorrection.toOccurrenceId`
gewinnt auch gegen spätere Workout-Snapshot-Retries desselben
historischen Workouts (verhindert, dass ein Sync-Retry den gelösten
Link stillschweigend wiederherstellt) — technisch die stärkere Lösung
gegenüber einem ersten, verworfenen Entwurf ohne diesen Schutz.
`activity_correction_310b_test` (27) plus Kalender-, Activity-Detail-,
Resolver- und Store-Bestandstests. Kein Pin betroffen (`023ee59b`).

**Sport-Icon-Identität im Start-Sheet (v8-312):** Gians Befund direkt am
Screen (Screenshot des Training-Start-Sheets, „Fehler in diesem
Screen"). `gmOpenStartSheet`s Sport-Kacheln (Laufen/Kraft/Rad/Schwimmen/
Fußball/Mobility/Eigenes) hatten zwei Icon/Farb-Kollisionen: Fußball
teilte sich `var(--ready)` mit Laufen (nicht unterscheidbar), und nutzte
das `target`-Icon (Zielscheibe) — im übrigen Produkt exklusiv Ziel/
Readiness/Meilenstein. Mobility nutzte `moon` + `var(--sleep)` — Icon
und Farbe sind sonst exklusiv „Schlaf". Fix zieht die im Sport-Katalog
bereits kanonischen, im Sprite-Set längst vorhandenen Icons nach
(`ball`/`stretch`, identisch zu `#i-ball`/`#i-stretch` in index.html,
bereits produktiv für Aktivitätenliste/Hub über
`ORVIA.activityConfig.sportIcon()`) statt neue Bildsprache zu erfinden;
neue eigene Farbtoken `--team`/`--recovery` (styles.css), bewusst nicht
identisch mit einer bereits semantisch belegten Farbe
(`--attention`/`--crit`=Warnung/kritisch, `--sleep`=Schlaf).
`gm-icons.js` (laut eigenem Dateikopf verbatim aus dem Golden Master)
bleibt unangetastet — die zwei fehlenden Glyphen kommen über einen
neuen, lokal begrenzten Helfer (`GM_SPORT_ICON_EXTRA`/
`gmSportTileIcon`). Bei der Verifikation zwei unabhängige
Geschwisterfehler mitgefunden und mitgefixt: `js/activity.js
SPRITE_ICONS` und `js/workout-ui.js HUB_SPRITE` — zwei weitere,
separat gepflegte Icon-Whitelists — enthielten `'ball'` nicht und
ließen Fußball-Aktivitäten in Aktivitätenliste bzw. Hub-Schnellstart
silently auf `pulse` zurückfallen, obwohl der Sprite längst existiert.
Dieselben Whitelists fehlen für weitere Katalog-Sportarten (tennis/
padel/badminton → `racket`, rowing → `row`, hiking → `hike`,
walking → `walk`) — bewusst **nicht** in dieser Runde mitgezogen,
eigener Umsetzungsplan nötig. `gm3_activity_parity_test` (60, sieben
neue Assertionen — Icon-Fragmente werden positiv gegen das eigene
Pfad-Markup geprüft, weil der globale `icon()`-Stub im Testfile eine
reine „ist nicht target/moon"-Prüfung wirkungslos machen würde) plus
neuer `sport_icon_whitelist_test` (6). Drei Mutationsproben je Fund
gefangen und Wiederherstellung verifiziert. Kein Pin betroffen
(`023ee59b`) — reine UI-Darstellung, keine Engine-/Observer-Berührung.

**Die Engine wird sichtbar — 1/n (v8-313, Zielprognose):** Ausgelöst durch
Gians Befund „die Trainings-Engine hat gefühlt noch gar nicht angefangen".
Nachgemessen: von 13.923 Zeilen in `js/engine/` steuern **8.182 nichts**.
Der Plan-Slot „Zielprognose" zeigte Literale und vertröstete auf eine
„externe Trainingsengine" — die seit Langem im Haus ist:
`performance-zones.forecast()` liefert exakt das Tripel vorsichtig/
realistisch/optimistisch und hatte **null Aufrufer**;
`goal-feasibility.feasibility()` rechnet bei jedem Planlauf im Schatten mit
und wurde sogar als HTML gerendert — in `#adaptiveCard`, das
`styles.css:3130` ausblendet, über einen Renderpfad, der am überschriebenen
`renderPlan()` hängt. Der Wert existierte, war doppelt unerreichbar.
Der GM-Slot liest jetzt beide direkt (`gmGoalForecastView`/`-Card`), statt
die CSS-Regel aufzuweichen. Der Evidenzvertrag bleibt unberührt: ohne
datierten, entscheidungsfähigen Leistungswert weiterhin keine Zahl — neu ist
nur, dass der leere Zustand den **Grund** nennt und den Weg zur Erfassung
zeigt. Die Zielzeit wird gegen die **konservative** Korridorkante
eingeordnet, nicht gegen den Punktwert. `goal_forecast_wiring_test` (31)
gegen die echten Engine-Module. Drei Mutationsproben; die dritte war
**zunächst grün** und deckte eine echte Testlücke auf (der Zweig „Leistung
ok, aber Prognose nicht berechenbar" wurde von keinem Fall erreicht — genau
dort säße ein erfundener Wert am unauffälligsten); zwei Fälle ergänzt, danach
fängt sie. Kein Pin betroffen (`023ee59b`).

**Was diese Runde bewusst NICHT tut — und warum:** `engine_v2_plan` bleibt
aus. Das Flag würde den v2-Scheduler den echten Wochenplan überschreiben
lassen, bevor die Abnahme aus §7b gelaufen ist. Offen bleiben außerdem drei
Dinge, die **keine Verdrahtungsfrage** sind: Planqualitäts-Subscores (es
existiert nur der Validator `isPlanQuality`, kein Rechner), Kraft
(`performance-resolver`/`-zones` kennen nur running/cycling/swimming, kein
Kraft-Wissenspaket) und die **Wochenfolge** — `activeWeekPlan()` nimmt keinen
Wochenversatz, es gibt nur eine Woche im Modell. Letzteres ist der
strukturelle Blocker für Stufe 10 (Periodisierung): solange nur eine Woche
existiert, kann kein Progressionsmodell sichtbar werden, egal wie gut es
rechnet.

**Die Engine wird sichtbar — 2/n (v8-314, adaptive Einschätzung):**
`js/adaptive-card.js` rendert seit v8-283 die vollständige Ausgabe des
Schattenbetriebs — Anpassungsrichtung, Delta, Zielload, Sperrgründe,
Auswahlgrund, Begründung. Sie ging ausschließlich nach `#adaptiveCard`, also
hinter dieselbe CSS-Regel und denselben toten Renderpfad wie die Zielprognose:
**zwei unabhängige Sperren vor demselben Inhalt.** Der GM-Plan zeigt sie jetzt
über denselben Renderer und denselben View-Vertrag (`gmAdaptiveSection` ist
reine Weiterleitung). Bewusst **kein** Nachbau in `ui.js` — eine zweite
Formatierung derselben Engine-Felder wäre genau die Divergenz, die in v8-307
schon einmal drei Erzeuger für eine Prescription hervorgebracht hat.
Fail-soft bleibt: ohne Beobachtung entfällt der Abschnitt ersatzlos, kein Titel
über nichts. Sperrgründe und „vorläufig, wird nicht angewendet" werden
ausdrücklich mitgezeigt — eine Empfehlung ohne ihren Sperrgrund wäre eine
Zusage, die die Engine nicht gibt. `adaptive_visibility_test` (20), drei
Mutationsproben. Kein Pin betroffen (`023ee59b`).

**Die Woche wird adressierbar (v8-315) — Voraussetzung für Stufe 10:** Gians
„jede Folgewoche sieht gleich aus" hatte zwei Ursachen, nicht eine. Die
schwerere: `user_week_plans` ist seit Migration 0029 nach `week_key` adressiert
und `weekPlanRepository.get(weekKey)` existiert — lag für eine andere Woche ein
**eigener** Plan vor, wurde er trotzdem nicht gezeigt, sondern die laufende
Woche mit fremdem Datum beschriftet. Die zweite: `PROFILE.weekPlan` ist per
Konstruktion eine **wiederkehrende** Struktur; ohne eigenen Plan ist sie die
ehrliche Antwort, muss aber als Vorschau kenntlich sein.
`gmPlanForOffset(off)` liefert jetzt `{days, provenance, weekKey}` mit
`provenance ∈ {current, planned_week, recurring_preview, loading}` — die
Herkunft ist Vertrag, nicht Kosmetik.

**Diese Runde erzeugt ausdrücklich keine Wochenvariation.** Eine in der
Oberfläche erfundene Progression wäre die Ersatzheuristik aus §17.2. Stufe 10
bleibt der Ort dafür — v8-315 schafft nur den **Adressraum**, in den eine
Folgewoche überhaupt geschrieben werden kann. Damit ist der strukturelle
Blocker für die adaptive Periodisierung weg: vorher hätte auch ein fertiges
Progressionsmodell nichts anzeigen können, weil es nur eine Woche gab.

Zwei Riegel sind Teil des Vertrags: fremde Wochen werden **nie** beobachtet
(`gmObserveWeekPlan` hängt am Snapshot mit `weekId` = heutige Woche — eine
Vorschauwoche darin wäre eine unbemerkt falsche Kalibrierungsgrundlage), und
der Vorschaupfad **schreibt nichts** (kein `saveProfile`, keine ID-Vergabe,
Rückgabe ist eine Kopie). `week_addressable_plan_test` (36) gegen das echte
`plan-domain` mit injizierter Uhr. Vier Mutationsproben; die vierte blieb
zunächst grün, weil sie gegen eine unbeteiligte Konstante verglich statt gegen
`PROFILE.weekPlan` — Bezug korrigiert. Zwei Bestandstests angepasst, davon
einer aus grundsätzlichem Anlass: `plan_week_nav` prüfte per **Zeichenabstand**
statt Struktur — eine Momentaufnahme der Formatierung, kein Vertrag (§17.7).
Kein Pin betroffen (`023ee59b`).

**Planqualität bekommt einen Rechner (v8-316):** Der erste echte Neubau dieser
Reihe. Anders als bei v8-313/314 fehlte hier nicht die Verdrahtung, sondern der
**Produzent** — es existierte ausschließlich der Validator
`engine-contracts.isPlanQuality()`. `js/engine/plan-quality.js` (`plan-quality@1`,
`pq-rules@1`) liefert die sechs Subscores rein und versioniert.

Die Konstruktionsfrage, an der das Modul hing: Der Vertrag verlangt für jeden
Subscore eine Zahl 0–100, aber nicht jeder ist immer berechenbar — Sportbalance
ist bei einer einzigen aktiven Sportart **keine schlechte Bewertung, sondern
gar keine**. Gelöst über `applicable`/`evidence` je Subscore, `rating:
'insufficient_data'` für nicht Bewertbares, und eine Gesamtnote **ausschließlich
über die anwendbaren Subscores mit neu normierten Gewichten**. Ein reiner Läufer
wird durch die fehlende Sportbalance dadurch nicht abgewertet — das ist die
zentrale Testzusage. Unter 60 % bewertbarem Gewicht ist das ganze Ergebnis
`insufficient_data` statt einer Note aus zu wenig.

`planQualityChecks()` bleibt unverändert bestehen; wo beide dieselbe Regel
prüfen, ist sie bewusst identisch formuliert. Beim Bauen ein eigener Fehler
gefunden: Der erste Entwurf verglich Sportarten per Teilstring — `running` traf
`Laufen` nicht, ein Plan **mit** Laufeinheit bekam fälschlich „Sportart fehlt im
Plan". Jetzt über den einen kanonischen Normalisierer
(`trainingDomain.normSportStrict`); fehlt er, ist der Subscore nicht anwendbar
statt geraten. `plan_quality_scores_test` (39) gegen den echten Validator, fünf
Mutationsproben. Kein Pin betroffen (`023ee59b`).

**Der Tagesscore wird stetig (v8-317) — Gians Messreihe als Auslöser:** Er hat
den Hüftschmerz durchgestellt und 79/79/79/79/64/64/44/44 gemessen. Am Code
reproduziert: `applyDecisionCaps` endete auf
`{GREEN:100, YELLOW:79, ORANGE:64, RED:44}[state]` — die angezeigte Zahl war die
**Obergrenze des Tageszustands**, nicht eine Messung. Weil die physiologische
Readiness fast immer darüber lag, stand dort wochenlang „79", und jede
Verbesserung bei Schlaf, Stress oder HRV wurde von derselben Zahl abgeschnitten.

Fünf Funde, alle behoben: (1) **Treppe ⇒ Stetigkeit** — die Bänder bleiben
garantiert getrennt, aber die Obergrenze bewegt sich innerhalb des Bandes stetig
mit der tatsächlichen Schwere (`stateSeverity`, pur, 0..1); neue Reihe
91·89·87·85·74·60·42·40·35. (2) **Garmins echte HRV-Kategorien** — Balanced ·
Unbalanced · Low · Poor, kein `Good` (der 100er-Zweig war toter Code, über den
Statuspfad war bei 88 Schluss); `Unbalanced` lag fälschlich mit `Low` gleichauf,
`Poor` fiel ganz durch. **Die Gegenprobe deckte auf, dass `Poor` dadurch in
besseren Zuständen landete als `Low`**, weil fünf Stellen `hrv==='Low'`
verglichen — jetzt ein Helfer für das ganze Produkt. (3) **Muskelkater ist
regional** — Beinmuskelkater 7/10 setzte auch an einem Oberkörpertag ORANGE und
verbot damit Krafttraining; die Entscheidungsseite wusste die Region längst,
Score und Zustand nicht. (4) **Schmerz zählt, egal wo** — `readiness()` kannte
ausschließlich `m.knee`; Hüftschmerz erreichte den Rohwert nie. (5) **100 ist
erreichbar** — mit eigener HRV-Messreihe erreicht die Readiness 100.

Sicherheit unverändert: harte Deckel (Red Flags, Krankheit, Schmerz ≥8) bleiben,
die Bänder überlappen nicht. `daily_score_continuity_test` (45), sechs
Mutationsproben — **zwei blieben zunächst grün** und deckten echte Testlücken
auf: „Schmerz wieder nur Knie" (die Reihe variierte allein durch den Banddeckel
weiter) und „harter Deckel entfernt" (über `buildTrainingDecision` ist er derzeit
vom RED-Band subsumiert — er sichert die Funktion gegen andere Aufrufer und wird
jetzt direkt dort geprüft). Kein Pin betroffen (`023ee59b`).

**Die Referenzen wachsen mit (v8-318) — der eigentliche Dauerbremser:**
`sleepDebt` rechnete `480 − x`, also **8 Stunden als Sollwert für jeden**. Wer
gewohnheitsmäßig 7 h schläft, sammelte jede Nacht 1 h „Schuld" — 7 h pro Woche,
Beitrag `100 − 7·12 = 16` statt 100. Bei Gewicht 12 zieht das den Tagesscore
**dauerhaft um rund 8 Punkte**, jeden Tag gleich und unbehebbar außer durch 8 h
Schlaf pro Nacht. Zusammen mit dem Zustandsdeckel aus v8-317 ist das die zweite
Ursache der konstanten Zahl.

Jetzt zählen drei weitere Größen gegen die eigene Historie statt gegen ein
Ideal: Schlafschuld, Schlafdauer-Subscore (skaliert mit der **eigenen**
Streuung) und Body Battery (gegen den eigenen Morgen-Median). Wirkung auf Gians
typischen Tag: Readiness **85 → 94**.

**[A] Die bewusste Annahme:** Die Schlafreferenz ist auf **7–8 h begrenzt**.
Ohne Deckel würde chronischer Schlafmangel sich selbst zur Norm erklären und die
Schuld verschwinden — die Zahl wäre angenehm und falsch. Wer gewohnt 7 h
schläft, wird an 7 h gemessen; wer chronisch 5 h schläft, weiterhin an 7 h.

Fail-closed: jede Baseline braucht **mindestens 14 eigene Tage**, sonst gilt exakt
das bisherige Verhalten. `daily_score_continuity_test` (62), vier
Mutationsproben — zwei blieben zunächst grün: die 14-Tage-Schwelle lebt in
`ui.js` und wurde vom Calc-Test gar nicht berührt, und die Body-Battery-Zusage
prüfte nur die Summe statt das Bauteil. Beide Lücken geschlossen. Kein Pin
betroffen (`023ee59b`).

**Gemessene Schlafdaten statt Ersatzwerte (v8-319) — und was das über v8-318
sagt:** `sleep_need_min` — Garmins **eigener, personalisierter Schlafbedarf** —
wird vom Worker seit Langem synchronisiert und hatte im Produkt **null
Verwendungsstellen**. Der 28-Tage-Median aus v8-318 war damit ein Ersatz für
etwas, das gemessen vorlag. Neue Rangfolge: **gemessen > eigener Median > fest
(480)**; ein unplausibler Messwert fällt auf den Median zurück, und der
7–8-h-Deckel gilt auch für den gemessenen Bedarf (auch Garmins Bedarf folgt den
Gewohnheiten).

Ebenfalls angeschlossen: **Garmins Sleep Score**, der bisher nur angezeigt wurde
und in keine Bewertung einfloss — Gians ausdrückliche Forderung. Um
Doppelzählung zu vermeiden (der Score enthält Dauer und Phasen bereits), teilen
sich gemessene (9) und subjektive (5) Angabe das bisherige Gewicht 14; ohne
gemessenen Score behält die subjektive ihre vollen 14. Dazu die **Schlafphasen**
als eigener kleiner Beitrag (Gewicht 6): Tief-/REM-Anteil gegen die **eigene**
Verteilung, nicht gegen eine Lehrbuchzahl — wer von Natur aus eine niedrige
Quote hat, bekommt auf seiner Quote den Vollwert.

`daily_score_continuity_test` (80), fünf Mutationsproben — **zwei blieben
zunächst grün**: die Phasenprobe benutzte eine Testquote (0,42) zu nah an einer
denkbaren Lehrbuchkonstante (0,40), womit ausgerechnet Gians Prinzip
ununterscheidbar war; und die Rangfolge-Zusage war ein Quelltextmuster, das auch
ohne den gemessenen Zweig noch traf. Kein Pin betroffen (`023ee59b`).

**Bewusst nicht gebaut — und warum:** Gewicht als Tagesscore-Eingang. Das
Körpergewicht ist ein langsames Signal (Wochen) und gehört zu Zielmachbarkeit
und Energieverfügbarkeit, nicht zur Tagesform; es täglich in die Readiness zu
rechnen hieße, Rauschen als Erholungssignal auszugeben. `weightHint()` bewertet
es bereits an der richtigen Stelle. ~~Noch offen: Schlafphasen und Krankheitsverlauf~~ — mit v8-319 und v8-320
erledigt.

**Wiedereinstieg nach Krankheit (v8-320):** `illness` war ein Ja/Nein — an dem
Tag, an dem der Haken verschwand, war man sofort wieder voll belastbar, der
Score sprang von 55 auf ungebremst. `illnessReturnWindow()` bildet jetzt ein
Fenster: Obergrenze steigt linear von 68 auf 100, der Tageszustand bleibt
mindestens YELLOW, der Grund steht im Klartext bei den Begründungen. Nach vier
Krankheitstagen: 68 · 76 · 84 · 92 · frei. **[A] Faustregel:** etwa ein
zurückhaltender Tag je Krankheitstag, gedeckelt bei 7 — die in der Sportpraxis
verbreitete Größenordnung, kein gemessener Wert und keine Diagnose. Nur die
letzte zusammenhängende Krankheitsphase zählt.

Eigener Entwurfsfehler beim Durchmessen gefunden: Der erste Entwurf hatte ein
zusätzliches `blocksHard` für das erste Drittel des Fensters — eine
**Scheinunterscheidung**, weil YELLOW ohnehin keine harten Einheiten erlaubt.
Entfernt. `daily_score_continuity_test` (101), fünf Mutationsproben; **eine
blieb zunächst grün** — zum zweiten Mal dieselbe Klasse: der Test baut den
`checkin` selbst und prüft damit nur `calc.js`, während die Verdrahtung in
`ui.js` liegt. Jetzt als Kettenvertrag gedeckt. Kein Pin betroffen
(`023ee59b`).

### Kraft-Zielwerte und Garmin-Identitätskette (v8-321) — Kraftplan v2, Phase A

Erster **gebauter** Schritt des Kraftplans. K0-Spike, K1 (Datenmodell) und der
minimale K2-Datenvertrag. Keine Oberfläche, kein Push — beides folgt getrennt.

**Zwei Korrekturen an meinen eigenen früheren Aussagen.** Erstens: der
Garmin-Worker liegt sehr wohl in diesem Repository (`garmin-worker/` — FastAPI,
Fernet-verschlüsselte Tokens, 15 eigene Testdateien, Supabase-JWT als
Nutzeridentität). Meine Einschätzung, sein Fehlen sei die wichtigste offene
Entscheidung (O1), war falsch. Zweitens, und wichtiger: ich hatte **R1**
(garth-Login seit 27.03.2026 abgekündigt) als P0 eingestuft und empfohlen, es
vor allem anderen zu beheben. `requirements.txt` pinnt aber
`garminconnect==0.3.2`, und **diese Fassung benutzt garth gar nicht mehr** —
sie ist auf den mobilen SSO-Fluss mit nativen DI-OAuth-Bearer-Tokens
umgestiegen (im Rad selbst nachgeprüft: kein einziger garth-Import, nur
`curl_cffi`/`requests`/`ua-generator`). R1 in der Form, in der ich es
aufgeschrieben habe, trifft dieses Projekt nicht. Was bleibt, ist kleiner und
anders: die Bibliothek speichert Tokens in einem neuen Format und verlangt nach
dem Umstieg einmalig einen frischen Login. Ob der Tokenbestand des Workers noch
aus der Zeit davor stammt, lässt sich nur an der laufenden Instanz feststellen —
**das ist der offene K0-Rest**, und er ist kein Bauhindernis mehr.

**Was das Audit am echten Stand ergab** (nicht aus Plan v1 übernommen): Eine
Lastvorgabe existierte nirgends — `training_plan_exercises` und
`workout_exercises` enden bei `planned_sets/min_reps/max_reps/target_rir/
target_rpe/rest_seconds`. Der Treffer `targetWeightKg` in `js/nutrition.js` ist
**Körpergewicht**, `targetLoad` in `js/engine/progression.js` ist **systemische
Tageslast**; beides wird nie in eine Spalte geschrieben. Ein Kraftplan
„4 × 6–8 @ 80 kg" war schlicht nicht speicherbar. Eine Gym-Karte ist
`{t:'Gym', l:<Split>, d:'45 min'}`, und `d` ist eine **Konstante** aus `gpG()`
(`js/ui.js:239`) — die Karte konnte nichts anzeigen, weil es nichts zu lesen
gab. `workout_sets.set_type` hatte **kein CHECK**; die Satztypliste lebte nur im
Client. Und `startPlannedWorkout` (`js/workout-store.js:124`) hat **null
Aufrufer**, `training_plan_exercises` wird produktiv weder gelesen noch
geschrieben — der einzige Pfad, der Planübungen in eine Session gebracht hätte,
war nie angeschlossen.

**Migration 0035** (additiv): `target_weight_kg` auf **beiden** Ebenen — Plan
*und* Session, sonst ginge die Vorgabe beim Sessionstart verloren und der
Soll-Ist-Vergleich hätte auf der Ist-Seite keine Referenz. `set_type`-CHECK als
**NOT VALID**: neue Zeilen werden geprüft, der Altbestand nicht rückwirkend
abgelehnt. `workout_sets` bekommt Herkunft, Prüfstatus, externe Satzidentität
(Duplikatschutz bei wiederholtem Sync), Schrittindex, Rohwerte und
Erkennungswahrscheinlichkeit. Neue Tabelle `strength_workout_exports` trägt die
Kette `occurrence_id → client_ref → garmin_workout_id → garmin_activity_id`
samt `step_bindings` — ohne die wäre ein zurückkommender `wktStepIndex` eine
Zahl ohne Bedeutung.

**`js/engine/strength-plan.js`** ist der Datenvertrag: rein, versioniert
(`strength-plan@1`), fail-closed. Eine fehlende Satzanzahl wird **abgewiesen**
statt auf 3 gesetzt, ein negatives Zielgewicht abgewiesen statt auf 0 gezogen,
ein verdrehter Wiederholungsbereich abgewiesen statt stillschweigend getauscht.
Genau zwei Fälle werden ausgelegt statt abgewiesen, und beide sind Bedeutungs-
statt Ratefälle: eine einzelne Wiederholungsgrenze meint eine feste
Wiederholungszahl, eine fehlende Reihenfolge meint die Listenposition.
`estimateDurationMin()` löst die Konstante `'45 min'` ab (Beispieleinheit
25 min, große Einheit 95 min); **[A]** die Faustwerte 40 s Arbeitszeit je Satz,
60 s Übungswechsel und 120 s Ersatzpause sind gesetzt, nicht gemessen.
`plannedVolumeKg()` folgt dem `plan-quality`-Prinzip aus v8-316: eine Übung ohne
Zielgewicht zählt **nicht als 0 kg**, sondern gilt als nicht bewertbar.
**Modellgrenze [A1]:** ein Zielgewicht je Übung. Unterschiedliche Lasten für
Aufwärm-, Top- und Backoff-Sätze löst das MVP dadurch, dass dieselbe Übung
zweimal geplant wird — das ist eine bewusste Grenze und keine Lücke, die später
stillschweigend zugerechnet werden darf.

**Eigene Funde dieser Runde.** `js/engine/plan-quality.js` stand seit v8-316
**nicht** im Offline-Vorrat des Service Workers, obwohl `index.html` es lädt —
offline wären die sechs Planqualitäts-Kacheln stumm ausgefallen, und kein Test
hätte es bemerkt. Nachgetragen; S15 prüft ab jetzt **jedes** in `index.html`
geladene Skript gegen `ASSETS` (`env.js` ist die einzige, bewusste Ausnahme:
die Umgebungskonfiguration darf nicht einfrieren). Von 13 Mutationsproben
blieben **zwei zunächst grün**, beide aus derselben Familie — eine zweiseitige
Zusage nur einseitig geprüft: M4 („fehlendes Zielgewicht zählt als 0 kg") schied
schon an einer vorgelagerten Bedingung aus, weil mein Testfall gar keine
Wiederholungen hatte; M10 („ein manueller Satz darf keinen Importstatus
tragen") war nur in der Gegenrichtung geprüft. Beide nachgeschärft, beide danach
rot. `strength_plan_contract_test` (94, S1–S15), Gesamtsuite 246/0, Pin
`023ee59b` unberührt.

**Bewusst nicht gebaut:** Oberfläche, Übungsmapping, Exporter, Push,
Rückimport. Der Datenvertrag steht absichtlich **vor** der Oberfläche, damit
Wochenplan, Editor, Sessionstart und Export später dieselbe Form lesen und
nicht drei Varianten entstehen.

### Die Kraftvorgabe kommt wirklich an (v8-322) — K1-Rest und K9

Ein externer Audit hat v8-321 gegen den Mac-Checkout geprüft und in einem
zentralen Punkt **recht behalten**: Migration 0035 legte `target_weight_kg` an,
und **kein einziger Schreibpfad füllte die Spalte** —
`trainingPlanRepository.addPlanExercise`, `workoutRepository.addExercise` und
der Offline-Builder `buildExerciseRow` kannten das Feld nicht. Der Datenvertrag
konnte ein Zielgewicht ausdrücken; es wäre nur nirgends gelandet. Das ist genau
die Klasse „gebaut, aber nicht angeschlossen", die bei den unverdrahteten
Engine-Modulen zu Recht beanstandet wurde. Mein Satz „bewusst nicht gebaut:
Oberfläche" hat es verdeckt — die fehlenden Schreibpfade waren keine
Oberfläche, sondern **unfertiges K1**: der Plan verlangt dort ausdrücklich
„vorhandene Sollwerte vollständig durch Online- *und* Offline-Schreibpfad
führen".

Zwei weitere Befunde desselben Audits, ebenfalls bestätigt: Der Offline-Builder
verlor gegenüber dem Online-Mapper still `target_rpe`, `completed` und
`replaced_by_exercise_id` sowie auf Sessionebene `plan_id`, `plan_day_id` und
`perceived_effort` — **dauerhaft**, weil die Queue die Payload unverändert
durchschreibt und kein späterer Sync das nachholt; `perceived_effort` schrieb
überhaupt kein Pfad. Und der Plan-Snapshot trug nur `t/l/d`, sodass die
geplanten Übungen beim Sessionstart verloren gingen — der einzige Pfad, der
überhaupt Planübungen anlegte (`startPlannedWorkout`), hat weiterhin **null
Aufrufer**, während der echte Weg grundsätzlich eine leere Session anlegte.

**Behoben:** Zielgewicht in allen drei Schreibpfaden plus im DTO. Fehlt die
Vorgabe, wird NULL geschrieben — kein Ersatzwert; 0 kg überlebt als eigener
Wert und wird nicht zu NULL zusammengefaltet. Offline-Parität geschlossen,
wobei die drei Sessionfelder **nur mitfahren, wenn belegt**: als stille NULL
könnten sie beim zweiten Upsert derselben `client_session_id` einen bereits
gesetzten Wert überschreiben. Neu ist `applyPlannedExercises()` — die im
Snapshot mitgereichten Vorgaben werden beim Start zu echten Übungen der
Session, und das Ergebnis `{planned, applied, failed}` wandert ins
Startresultat, damit eine misslungene Übernahme **gemeldet** und nicht
verschluckt wird. Der Anzeigename ist dabei bewusst fail-open (offline gibt es
die Bibliothek nicht), die Übung selbst nicht: die `exercise_id` ist die
Wahrheit. `startPlannedUnit` und `markPlannedDone` hängen die Vorgaben an den
Snapshot, aber nur wenn tatsächlich etwas geplant ist — eine Laufeinheit
bekommt kein leeres Feld in den unveränderlichen Anker.

**Der eigentlich wertvolle Test** ist P1: nicht „schreibt Feld X?", sondern die
*Eigenschaft*, dass Online-Mapper und Offline-Builder für dieselbe Eingabe
dieselbe Spaltenmenge erzeugen. Beide Wege werden wirklich durchlaufen — der
Offline-Weg über die echte `offline-queue.js` mit IndexedDB-Shim inklusive
Flush gegen einen Supabase-Fake. Diese eine Zusage hätte den Fund vorweggenommen
und fängt die Klasse künftig ab. Beim Bau des Shims eigener Fehler gefunden:
`onupgradeneeded` feuerte nicht, die Queue legte ihre Indizes nie an, und
`pendingForCurrentUser()` lieferte 0 Zeilen, obwohl 2 im Store lagen — ein
Test, der still nichts prüft, wäre schlimmer als keiner. `strength_target_
wiring_test` (42, P1–P10), 11 Mutationsproben, **alle 11 sofort rot**; zwei
erzeugten zunächst einen Absturz statt einer lesbaren roten Zeile und wurden
defensiv nachgezogen. Gesamtsuite 247/0, Pin `023ee59b` unberührt.

**Ausdrücklich noch offen:** Die Übungen sind im Wochenplan **nicht sichtbar**,
und es gibt **keine Oberfläche**, um sie anzulegen — `summarizePlanned()` hat
weiterhin keinen Aufrufer. Das ist der nächste Schritt (K2-Oberfläche) und wird
als solcher benannt, nicht als erledigt.

### Kraftplanung sichtbar und bearbeitbar (v8-323) — K2, volle Nutzerkette

Anzeige **und** Editor in derselben Runde, weil eine Anzeige ohne Eingabe wieder
etwas wäre, das nichts tut. Die Kette lautet: Planeditor → `user_week_plans` →
Reload → Wochenplananzeige → Sessionstart → `workout_exercises`.

**Anzeige.** Die Gym-Karte zeigt jede geplante Übung mit Name, Sätzen,
Wiederholungsbereich, Zielgewicht und Pause. Ein Item ohne Vorgaben erzeugt
*kein* leeres Listengerüst — Altbestand sieht unverändert aus. Die Übungsnamen
liegen in `exercises`, der Wochenplan rendert aber **synchron**; deshalb ein
Namens-Cache: einmal über das echte `exerciseRepository` laden, in localStorage
spiegeln (trägt den ersten Anstrich nach einem Neustart und offline), danach
synchron nachschlagen und genau *einmal* neu zeichnen, wenn die Liste eintrifft.
Eine Kennung, die sich nicht auflösen lässt, wird als unbekannt **markiert** und
im Klartext gezeigt — es wird kein Name aus der Bibliothek untergeschoben.

**Editor.** Hinzufügen, bearbeiten, sortieren, entfernen. Die Auswahl kommt
ausschließlich aus der kanonischen Bibliothek; ist sie nicht erreichbar, gibt es
keine Ersatzliste und kein Freitextfeld, sondern einen offenen Hinweis. Der
Zustand liegt ausschließlich in `_planEdit[di][ii].plannedExercises` — **kein
zweites UI-Modell**. Alle vier Listenoperationen sind rein und liegen im
Datenvertrag (`strengthPlan.insert/remove/move/updateExerciseAt`), nicht in der
Oberfläche. Fail-closed heißt hier: schlägt die Prüfung fehl, kommt die
*unveränderte* Liste zurück — eine ungültige Eingabe in Zeile 2 darf die Zeilen
1 und 3 nicht mitreißen. Und jede Ablehnung wird **begründet angezeigt**;
stilles Nichtstun wäre schlimmer als ein Fehler.

Die Satzanzahl beim Hinzufügen kommt aus einem sichtbaren, vorbelegten
Eingabefeld — nicht aus einem stillen Standardwert im Code. Ein vorausgefüllter
Wert, den der Nutzer sieht und ändern kann, ist etwas anderes als eine geratene
Konstante; wird das Feld geleert, entsteht keine Übung, und der Grund steht
daneben.

**Zwei Feinheiten, die leicht falsch geworden wären.** `0 kg` und „keine
Vorgabe" sind nicht dasselbe: 0 bedeutet ausdrücklich *ohne Zusatzlast*
(Klimmzüge, Liegestütz) und wird auch so angezeigt, keine Vorgabe bleibt `null`
und erscheint gar nicht — beides läuft unverändert bis in `workout_exercises`
durch, geprüft. Und ein geleertes Zahlenfeld heißt „keine Vorgabe" (`null`),
nicht 0; eine unlesbare Eingabe wird abgelehnt und benannt, nicht stillschweigend
verworfen. Komma gilt als Dezimaltrenner.

**Eigene Funde.** Von 12 Mutationsproben blieben zwei zunächst grün. **U4:** Ich
hatte nur die beiden frühen Abbruchgründe geprüft (keine Übung gewählt / keine
Satzanzahl), nicht die Ablehnung durch den Datenvertrag selbst — eine Mutation,
die die Meldung für „Obergrenze erreicht" entfernte, blieb unbemerkt.
Nachgetragen: die 21. Übung wird verhindert *und* begründet. **U12:** Die
CSS-Zusage traf auch auf das leere `::before`-Geschwister zu; verschärft auf
„setzt eine eigene Farbe". Beide danach rot. Zusätzlich stürzte
`gm2_plan_parity_test` ab, weil der isoliert ausgewertete `renderGMPlan`-Block
den neuen Helfer nicht kannte — Fixture ergänzt, mit Begründung, warum sie dort
bewusst `''` liefert.

`strength_plan_ui_e2e_test` (80, E1–E13) fährt die volle Kette mit den **echten**
Modulen ab — Editor aus `ui.js`, Datenvertrag, `plan-domain`, `workout-store`
mit echter `offline-queue`; gefälscht sind nur Supabase, IndexedDB und ein
minimaler DOM. Darin auch: der Session-Snapshot friert ein (eine spätere
Planänderung erreicht ihn nicht), und Online- und Offline-Pfad schreiben *am
Ende der Nutzerkette* dieselbe Feldmenge. Gesamtsuite 248/0, Pin `023ee59b`
unberührt.

**Bewusst nicht in dieser Runde:** kein Garmin-Export, kein Übungsmapping (K3/K4
folgen getrennt). Der Wochenplan-Editor ist die einzige Eingabe;
`training_plan_exercises` bleibt unbenutzt und `startPlannedWorkout` weiterhin
ohne Aufrufer — beide sind ein eigener Aufräumschritt (K9) und werden nicht
nebenbei mitgeändert.

### Garmin-Übungszuordnung (v8-324) — K3, MVP-Kernset nachgewiesen

**10 von 10 zugeordnet, keine Lücke, drei ausdrückliche Variantenwahlen.**

**Vorfrage zuerst:** Existieren Gians zehn Slugs überhaupt? Ja — alle stehen so
in den echten Seeds aus 0003/0006. Der Test prüft das gegen den Migrationstext,
nicht gegen eine Liste in meinem Kopf.

**Nachweisgrundlage** ist der offizielle Garmin-FIT-SDK-Profile-Katalog
21.213.0 (PyPI `garmin-fit-sdk`): 51 Kategorien mit Code, 1846 Übungsnamen,
vollständig abgelegt als Testfixture und **nicht** zur Laufzeit geladen. Weil
die Datei alle 1846 Namen enthält und nicht nur die zehn zugeordneten, ist der
Nachweis nicht zirkulär — eine Mutationsprobe, die den Katalog auf die
Zuordnung zurechtschneidet, fällt sofort durch.

**Dritte Korrektur an meiner eigenen Recherche.** Ich hatte als Zweitquelle
`garminconnect/exercises.py` mit 1527 Übungen genannt. Die Datei existiert in
**keiner** geprüften Paketfassung (0.2.20 / 0.2.25 / 0.2.28 / 0.3.2). Der
Connect-Übungspicker ist per robots.txt gesperrt. Es ist also genau **eine**
Quelle nachgewiesen — die offizielle. Das steht als `[OFFEN-1]` im Modul, und
der Test erzwingt, dass `secondSource: null` nicht stillschweigend auf
„vorhanden" gesetzt wird.

**Der wichtigste Fund:** Der exakte Name `overhead_press` *existiert* im
Katalog — aber ausschließlich unter der Kategorie `sandbag` (#10). Ein reiner
Namensabgleich, den der Plan ausdrücklich verbietet, hätte Schulterdrücken auf
eine **Sandsack-Übung** gelegt. Deshalb lautet die Entscheidungsregel „exakter
Name *in der fachlich richtigen Kategorie*"; die Kategorie entscheidet mit. Der
Test prüft beides: dass die Falle wirklich existiert, und dass das Mapping ihr
nicht aufgesessen ist.

**Gians vier Zweifelsfälle, einzeln beantwortet.** `row`: exakter Name in der
Kategorie `row` (#36) → mapped. `pullup`: exakter Name (#38); derselbe Name
unter `suspension` ist der Schlingentrainer und wird durch die Kategorie
getrennt → mapped. `romanian_deadlift`: exakter Name, kategorieübergreifend
genau ein Treffer → kein Zweifelsfall. `hip_thrust`: kein exakter Name, genau
zwei Einträge (Boden #0, Bank #1, beide Langhantel) — festgelegt auf die
Bankfassung, weil der Hip Thrust definitionsgemäß mit aufliegendem Oberkörper
ausgeführt wird und die Bodenfassung fachlich eine Glute Bridge ist. Benannte
Entscheidung, mit einer Zeile umzustellen.

**Was ich nicht verschweige — der Rückweg.** Bei `row` und `squat` exportieren
wir den *neutralen* Katalognamen. Die Uhr wird beim Rücksync sehr wahrscheinlich
eine konkrete Fassung melden (`barbell_row` #45, `barbell_back_squat` #6). Der
Export funktioniert; der Rückweg findet dann keine Zuordnung und meldet
`unresolved` statt zu raten — richtig, aber Handarbeit. Beide sind als
`returnVariantRisk: 'high'` **[A]** markiert und werden im Testbericht
namentlich ausgegeben. Auflösen kann das nur Gerätetest G2. Der saubere Ausweg
wäre, „Rudern" und „Kniebeuge" in der Bibliothek in die tatsächlich trainierte
Fassung aufzuteilen — eine Bibliotheks-, keine Mappingfrage, und deshalb hier
nicht nebenbei entschieden.

**Eigene Testlücke.** Von 12 Mutationsproben blieb eine grün: das Melden von
`ambiguous`/`unmapped`-Lücken ließ sich entfernen, ohne dass ein Test rot
wurde — weil dieser Zweig bei 10/10 zugeordnet **nie läuft**. Gian hat diese
Zustände ausdrücklich gefordert, also müssen sie geprüft sein, *bevor* sie zum
ersten Mal gebraucht werden. Der Test hängt jetzt zwei Prüfeinträge
vorübergehend ein, prüft Zählung, Klartextgrund, Export- und Rückwegverhalten,
und weist danach nach, dass sie restlos entfernt sind. Zwei weitere Proben
erzeugten einen Absturz statt lesbarer roter Zeilen — defensiv nachgezogen.

`garmin_exercise_map_test` (93, G1–G9); der Bericht gibt Abdeckung,
Zuordnungen mit Codes, Lücken, Variantenwahlen und Rückweg-Risiken namentlich
aus. Gesamtsuite 249/0, Pin `023ee59b` unberührt.

**Nicht in dieser Runde:** kein Exporter (K4), kein Push (K5). K9 bleibt
getrennt.

### Kraft-Workout-Exporter (v8-325) — K4, reine Payload

Aus einer geplanten Krafteinheit wird ein Garmin-Workout-Payload. Rein: kein
Netz, keine Uhr, kein Zufall; drei Läufe liefern byte-identische Ausgabe. **K4
endet hier** — Persistenz, Auth und Push sind K5.

**Die Kernentscheidung: was nicht belegt ist, wird nicht erfunden.** Die
Payloadstruktur (`ExecutableStepDTO`, `RepeatGroupDTO`, `workoutSegments`, die
`displayOrder`-Werte, `ConditionType.TIME=2`/`ITERATIONS=7`,
`StepType.INTERVAL=3`/`REST=5`/`REPEAT=6`, `TargetType.NO_TARGET=1`) stammt aus
dem echten `garminconnect/workout.py` 0.3.2 — der Bibliothek, die der Worker
einsetzt. Diese Werte sind belegt und stehen in der Payload.

Zwei Zahlen sind es **nicht**: die Sport-ID für ein Kraft-Workout (`SportType`
kennt nur running…other 1–8 und nennt sich selbst „common values"; das
FIT-Profil kennt `sport #10 training` und `sub_sport #20 strength_training` —
die *Zeichenkette* ist echtes Garmin-Vokabular und steht in der Payload, die
*Zahl* wäre eine Übertragung zwischen zwei Namensräumen) und die numerische ID
der Bedingung `reps` (`ConditionType` kennt sie schlicht nicht). Beide stehen im
Regelbetrieb als `null` bei gesetztem Schlüssel. Eine erfundene Zahl sähe
richtig aus, ginge durch jeden Test und würde beim ersten Push still etwas
Falsches anlegen; ein sichtbares `null` bricht früh und laut.
`options.fillUnverifiedIds` setzt für den Gerätetest Kandidatenwerte ein — und
erzeugt dabei eine Warnung mit Gate-Bezug, damit niemand den Testmodus für den
Regelbetrieb hält.

**Gate G3 bleibt zu.** `weightValue` wird standardmäßig gar nicht erzeugt.
`options.includeWeight` schaltet es frei; die Skalierung kg × 1000 ist dabei ein
beschriftetes Objekt (`WEIGHT_SCALE_ASSUMPTION`, `verified:false`, `gate:'G3'`),
keine Konstante im Code. **Provenienzlücke bleibt sichtbar:** jedes Ergebnis
trägt `catalogSources: ['fit-sdk@21.213.0']` plus die Warnung
`single_catalog_source` — nirgends wird eine doppelte Verifikation behauptet.

**Festgelegte Regeln.** Nur `mapped` wird exportiert; `ambiguous`, `unmapped`,
unbekannte Slugs und Zeilen ohne auflösbaren Slug werden namentlich mit Grund
und Zeilenindex ausgewiesen, und jede Meldung sagt ausdrücklich, dass nichts
ersetzt wurde. Fehlende Wiederholungen ⇒ Übung nicht exportiert. Ein Bereich
6–8 geht als *untere* Grenze in die Payload, das Zusammenfallen wird gemeldet.
Fehlende Pause ⇒ dokumentierter Vertragsdefault [A3] plus Warnung — kein hier
neu erfundener Wert; ein Kraftworkout ohne Pausenschritt wäre auf der Uhr
unbrauchbar, deshalb ist fail-closed hier die schlechtere Wahl. Mehrere Sätze ⇒
`RepeatGroupDTO` mit der belegten Bedingung `iterations`. Die Reihenfolge kommt
ausschließlich aus dem normalisierten Datenvertrag — der Exporter enthält kein
einziges `.sort()`. `row` und `squat` melden ihr Rückweg-Risiko (Gate G2), ohne
dass K4 daraus etwas ableitet: das Modul kennt `fromGarmin` gar nicht.
`hip_thrust` nutzt die Bankvariante, und die Entscheidung steht in der
Zuordnungstabelle — der Exporter kennt den Namen „hip_thrust" nirgends.

**Ein Fehler beim Bauen, gefunden und behoben:** Der Datenvertrag reicht bewusst
keine unbekannten Felder durch (v8-321) — ein an der Rohzeile mitgegebener
`slug` überlebt die Normalisierung also *nicht*. Der erste Entwurf las ihn von
der normalisierten Zeile und fand nie einen. Jetzt wird `exerciseId → slug`
**vor** der Normalisierung aus der Rohliste gesammelt, nicht über den
Listenindex, der sich verschiebt, sobald der Vertrag eine Zeile abweist.

**Eine Lehre zu den Mutationsproben**, die festgehalten gehört: Eine Probe,
deren Suchtext nicht trifft, ändert nichts — und liest sich dann *exakt wie ein
grüner Test*. Genau das ist mir bei „Sport-ID als Wahrheit festgeschrieben"
passiert (falsche Einrückung im Suchtext). Seither prüft die Probe zuerst, ob
sie überhaupt gegriffen hat, und meldet sonst ausdrücklich „kein Aussagewert".
Nach der Korrektur: **15 Proben, 15 rot.** Drei erzeugten zunächst einen
Absturz statt lesbarer roter Zeilen — defensiv nachgezogen.

`garmin_workout_export_test` (102, X1–X14), Gesamtsuite 250/0, Pin `023ee59b`
unberührt. Das Modul enthält weder Supabase- noch Token- noch repos-Bezüge.

### Worker-Push als kontrollierter Spike (v8-326) — K5

**Keine Freigabe.** Die numerische Sport-ID und die numerische ID der
Abbruchbedingung `reps` sind weiterhin unbelegt (Gate G1); der Endpunkt lehnt
im Regelbetrieb jedes Payload ab, das sie als `null` trägt — und ebenso jedes
mit `weightValue`, solange G3 zu ist. In dieser Runde hat sich **keine
App-Laufzeitdatei** geändert; die Arbeit liegt vollständig im `garmin-worker/`.
Die Version zählt trotzdem hoch, damit das Verzeichnis der Runden lückenlos
bleibt.

**Die fünf Belege, vor jeder Zeile Code geprüft.** Auth: `garminconnect==0.3.2`,
Login über `Garmin(...).login()`, Token aus `garmin.client.dumps()`. Tokens:
Fernet-verschlüsselt in `provider_credentials`, geladen über
`crypto.decrypt_str(…) → provider_factory(token_str)`. JWT: `verify_supabase_jwt`
gegen `/auth/v1/user`, eingebunden als Dependency `current_user_id`;
client-gelieferte `user_id`s werden nirgends verwendet. Garmin-Aufruf für
Workouts: **gab es noch nicht** — neu als `upload_strength_workout()` hinter
demselben Adapter und demselben `_map_exception`-Pfad. Schreibrecht: ja, per
service_role.

**Ein Fund bei Beleg 5, der das Design bestimmt hat:** Der globale
`ON_CONFLICT`-Vertrag in `db.py` wird von `test_sync_contract.py` auf
*Gleichheit* mit dem Kommentarblock in Migration 0019 geprüft. Hätte ich
`strength_workout_exports` dort eingetragen, wäre dieser Vertragstest gebrochen.
Der Push arbeitet deshalb mit `select` + `insert` + `update` statt mit einem
Upsert — was ohnehin richtig ist, weil ein merge-upsert ein bestehendes Workout
still überschreiben würde.

**Idempotenz und Rennen.** Ein SELECT allein wäre ein Rennen. Der eigentliche
Schutz ist der Unique-Index `(user_id, client_ref)` aus 0035: der zweite
gleichzeitige Insert scheitert mit 409, und *erst dann* wird der Stand des
ersten gelesen. Gleicher `clientRef` + gleicher Hash ⇒ `409 already_pushed`;
gleicher `clientRef` + **anderer** Hash ⇒ `409 client_ref_conflict` (eine
Erweiterung des Vertrags, weil beide Fälle getrennt gefordert waren). Ein
bestehendes Garmin-Workout wird nie still ersetzt; ein *fehlgeschlagener* Push
darf dagegen wiederholt werden.

**Sicherheit.** Das Body-Modell hat gar kein `user_id`-Feld und steht auf
`extra='forbid'` — ein mitgeschicktes `user_id` führt zu 422 statt still
ignoriert zu werden. `last_error` kennt nur einen festen Vorrat an Codes, damit
kein Ausnahmetext einer fremden Bibliothek in die Datenbank sickert. Kein
Passwort-Fallback: fehlt oder greift das Token nicht, endet der Vorgang mit
`reauthentication_required` und setzt das Flag **nur beim eigenen Nutzer**.

**Eine echte Testlücke, gefunden und geschlossen.** Ich konnte die Entwurfszeile
schon beim Anlegen auf `status='pushed'` setzen, ohne dass ein Test rot wurde —
der Erfolgsfall überschreibt den Wert ohnehin, und kein Test beobachtete den
Zwischenzustand. Genau das war gefordert („Status erst nach bestätigter
Garmin-Antwort"). Die Testdatenbank führt jetzt eine Spur *aller*
Statusschreibvorgänge; geprüft wird, dass `draft` zuerst kommt, `pushed` nur
zusammen mit der Garmin-ID geschrieben wird und ein Fehlschlag ihn nie erreicht
— zusätzlich, dass `swe_pushed_needs_id` in 0035 es unabhängig verbietet. Zwei
weitere Proben waren **äquivalente Mutationen** (ein vorgelagerter Riegel greift
bereits), eine griff wegen eines falschen Suchtexts gar nicht; alle drei
nachgezogen. Endstand: **21 Proben, 21 rot.**

`tests/test_workout_push.py` (48, P1–P14), `test_api_auth.py` um den neuen
Endpunkt erweitert. Worker-Suite im Container 164 bestanden (vorher 113). Die
zwei roten Tests in `test_sync_contract.py` sind **vorbestehend** und berühren
K5 nicht — sie waren vor meiner ersten Zeile bereits rot. App-Gesamtsuite
unverändert 250/0, Pin `023ee59b` unberührt.

**Nicht in dieser Runde:** kein Aufruf aus der App heraus, kein
`schedule_workout`, kein Rückimport. K9 bleibt getrennt.

### Gerätetest-Werkzeug und eine Korrektur (v8-327)

Entwicklungsstopp für K6/K7 angenommen. Diese Runde baut **kein** neues
Produktverhalten.

**Blockierender Punkt im Testablauf.** Schritt 4 lautet „Push ausdrücklich mit
`deviceTest:true` auslösen" — diesen Auslöser gibt es nicht:
`garminWorkoutExport` hat repo-weit keinen Aufrufer, und nichts in der App
kennt `/workout/push`. In v8-326 stand das als „nicht in dieser Runde", aber
mir war nicht aufgefallen, dass es den Test blockiert. Ein Knopf in der App
wäre allerdings genau die Produktfläche, die erst nach den Gates entstehen
soll — deshalb ein **Werkzeug** statt einer Oberfläche:
`tools/device-test-push.mjs` baut die Payload mit den *echten* Modulen (kein
Nachbau; ein Gate, das etwas anderes prüft als das Produkt, wäre wertlos) und
sendet nur mit `--send`. `garmin-worker/scripts/capture_workout_sets.py`
erfasst die Sätze bereinigt für G2/G3 — mit einer **Erlaubnisliste**, nicht
einer Verbotsliste, weil eine Verbotsliste irgendwann ein Feld vergisst;
gegen eine Rohantwort mit neun eingebauten Geheimnissen geprüft, keines
erscheint in der Ausgabe. `docs/GERAETETEST-G1-G3-PROTOKOLL.md` ist das
Ausfüllblatt mit den vorausberechneten Sollwerten.

**Korrektur an v8-326.** Ich hatte von *zwei* vorbestehend roten Worker-Tests
geschrieben. Falsch — der zweite Rotstand kam von meinem eigenen
Container-Behelf: hier liegt in `dist-packages` ein fremdes Paket `tests`, das
das lokale Testverzeichnis verdeckt; mein `tests/__init__.py` dagegen bricht
`from conftest import FakeGarminApi`. Ohne den Behelf ist der Test grün.
Vorbestehend rot ist **genau einer**.

**Und der ist diagnostiziert** — das Ergebnis gehört in den Reparaturschritt:
`test_sync_writes_expected_rows` erwartet `activities.status == 'final'`,
`sync.py` schreibt `'completed'`, und `0009_canonical_activities.sql` erlaubt
per CHECK ausschließlich `('completed','aborted','cancelled','planned')` —
`'final'` würde die Datenbank **ablehnen**. Der Code ist richtig, der Test ist
veraltet. Wer es andersherum repariert, baut einen Produktionsfehler ein. Ich
habe nichts davon angefasst: eine Testerwartung während eines
Entwicklungsstopps stillschweigend umzuschreiben wäre genau der Griff, den man
nicht tun soll.

App-Gesamtsuite 250/0, Worker-Suite 155 bestanden / 1 vorbestehend rot, Pin
`023ee59b` unberührt.

**Nächster Schritt (getrennt):** ~~Live-Test~~ erledigt (8/0) → Flag aktiv →
Sammlung läuft. Historischer Stand der Verdrahtungsplanung —
Planlauf: Snapshot synchron, künftige nicht absolvierte Einheiten auswählen,
`predict()` verzögert; Debrief: erst speichern, dann `resolve()` verzögert,
bei fehlender Vorhersage `pending`, Reconciliation verbindet. Verhaltenstests
und Mutationsproben vor der automatischen Datensammlung; ein Observer- oder
Logfehler darf weder Planlauf noch Debrief beeinflussen.

---

## 8. Stufe 6 · `js/engine/plan-opportunity.js` — Umplanung

> Eng begrenzt. Sonst entsteht eine zweite Decision Engine neben der ersten.

**Was sie darf:** eine geplante Einheit auf einen anderen Tag legen.
**Was sie nicht darf:** Einheiten erfinden, streichen, den Trainingsblock
umbauen, die Progression ändern.

**Inputs:** Verfügbarkeit · Recovery aus C1 · Constraints aus D1 · bereits
absolvierte Belastung · Kollisionen aus `load-profile` · User Overrides ·
Wetter (optional, später)

**Zwei nicht verhandelbare Regeln**

1. **Jede Opportunitätsentscheidung läuft durch `week-plan-policy`.** Die Policy
   bleibt die letzte Sicherheitsinstanz und der **einzige Schreiber**.
   Opportunity schlägt vor, Policy entscheidet. Damit gelten Ruhetag,
   Doppel-Freigabe, Kollisionen und Rhythmusregeln automatisch weiter.
2. **Eine manuell vom Nutzer platzierte Einheit wird nie automatisch
   verschoben.** Das ist dieselbe Regel wie die Override-Buchhaltung in
   `plan-activation.js`: lieber keine Optimierung als ein stiller Verlust einer
   Nutzerentscheidung.

**Test** `plan_opportunity_test.mjs` — kein Vorschlag umgeht die Policy · ein
Override wird nie bewegt · ein Vorschlag, den die Policy ablehnt, wird verworfen
und protokolliert, nicht erzwungen.

**Aufwand: 2–3 Tage**

---

## 9. Stufe 7 · D1 · `js/engine/constraint-model.js`

**Vertrag**
```
activeConstraints(profile, today) → [{
  id, region:'knee'|'achilles'|…,
  muscles: [],                      // dieselben 15 Gruppen
  severity: 0..3, since, trend:'better'|'stable'|'worse',
  blocks: ['impact'|'legHeavy'|'intensity'|'all'],
  constraintConfidence,             // Evidence-Hülle aus 0b
  returnCriteria: []                // für den Kriterienpfad aus C2
}]
```

**`constraintConfidence` ist kein Beiwerk.** Ein selbstberichtetes Knieproblem
hat eine andere Belastbarkeit als eine ärztliche Diagnose. Gleiche Taxonomie wie
bei den Zonen: `self_report → weak`, `wiederholte Check-ins mit Trend →
moderate`, `ärztlich dokumentiert → strong`.

**`returnCriteria` schließt die Lücke aus C2**: Kriterienbasierte Rückführung
nach Verletzung („Belastung X schmerzfrei über N Einheiten, bevor Y").

**Musterwarnungen statt Risk Engine.** Ausgegeben wird `patternWarnings[]`:

```
'high_intensity_density_elevated'
'sleep_context_poor'
'impact_load_rose_rapidly'
'pain_trend_worsening'
```

Jede Warnung beschreibt eine **beobachtete Konstellation** und behauptet **keine
Verletzungswahrscheinlichkeit**. Es gibt kein validiertes Modell, das Schlaf,
Intensitätsdichte und Ausrüstung zu einer Eintrittswahrscheinlichkeit
verrechnet **[F]**. „Drei harte Einheiten in fünf Tagen bei zwei Nächten unter
sechs Stunden" ist ein Fakt; „Achillessehnenrisiko hoch" wäre eine Erfindung.

**Test** `constraint_model_test.mjs` — jede Region bildet auf die 15 Gruppen ab ·
`severity:3` blockiert wirklich · Warnung ohne Datengrundlage wird nicht erzeugt ·
keine Warnung enthält eine Wahrscheinlichkeit.

**Aufwand: 3–4 Tage**

---

## 10. Stufe 8 · F1 · `js/export/workout-export.js` (TCX/FIT)

Vorgezogen gegenüber Fassung 1 — mit einem Argument, das nicht Bequemlichkeit
ist: **Ein Plan, den man nicht mitnehmen kann, wird seltener ausgeführt. Nicht
ausgeführte Einheiten erzeugen kein Debrief. Ohne Debrief hungern C1, C2 und
alles Nachgelagerte** (siehe Stufe 2). Der Export ist Produktpriorität, aber er
speist die Datenpipeline.

Umfang: Ausdauereinheiten mit Zielzonen als strukturiertes Workout.
Kraft-Export steht in Stufe 12.

**Aufwand: 2 Tage**

---

## 11. Stufe 9 · Knowledge Packs + Zielprofile

**E1 · Running Pack reviewen** — Sicherheitsthema, nicht Fleißarbeit.
**E2 · Packs als Daten, nicht als Code.**

26 Sportarten als 26 JS-Dateien wären 26 Orte für dieselbe Logik. Stattdessen:
**JSON je Sportart plus ein Schema plus ein Validator**, der bei jedem Testlauf
jeden Pack prüft. 26 JSON-Dateien ohne Schema wären nur 26 JS-Dateien ohne
Typsicherheit — das Schema ist der eigentliche Gewinn.
Träger: `knowledge/sport-coverage-matrix.js`.

**E3 · Zielprofile innerhalb einer Sportart** — Anforderungen als Daten
(unilaterale Kraft, Plantarflexion, Hüftstabilität, reaktive Kraft), nicht als
Übungslisten. Das ist dieselbe Abstraktion, die schon das Kollisionsproblem
gelöst hat: Anforderungen statt Namen.

**Aufwand: 8–12 Tage**

---

## 12. Stufe 10 · E4 · Adaptive Periodisierung

**Korridor statt Kalenderschiene** — mit **einem** harten Anker.

Ein Korridor ohne festen Punkt driftet. Der einzige Teil, der eine Schiene
verdient, ist der **Taper**: Metaanalytisch ergibt sich ein Fenster von rund
**8–14 Tagen**, Volumenreduktion etwa **40–60 %**, **Intensität und Frequenz
weitgehend erhalten** **[F]**. Das ist zu gut belegt, um es einem adaptiven
Algorithmus zu überlassen.

Regel: **Alles vor T−14 ist Korridor. Taper und Wettkampfdatum sind Schiene.**

**Aufwand: 3–4 Tage**

---

## 13. Stufen 11–12 · Krafttraining

**H1 · `js/engine/gym-session-planner.js`** — Sätze, Wiederholungen, Progression
aus der Historie.

**H1b · Trainingszweck: Muskelaufbau oder Transfer in die Sportart** — definiert
über **Anforderungen**, nicht über statische Übungslisten (siehe E3).

**Volumenkorridor — Korrektur gegenüber Fassung 1.** Die Angabe „10–20 Sätze pro
Muskelgruppe und Woche" ist für Hybridathleten zu pauschal: Die
Dosis-Wirkungs-Daten stammen überwiegend aus krafttrainierten Kohorten mit
geringer paralleler Ausdauerlast **[F]**. Bei 60 km Laufen pro Woche sind die
Bein-Sätze aus dem Laufen nicht null. **Fix:** Die Ausdaueranteile werden in das
Beinvolumenbudget eingerechnet — `load-profile.js` bildet Laufen bereits auf
quads/hamstrings/glutes ab. Es müssen nur zwei vorhandene Module verbunden
werden, es entsteht kein neues Konzept.

**H2 · Vorplanung im Plan-Tab**

---

### H3 · Der Garmin-Kreislauf (Gians Vorgabe, 2026-08-11)

> „Du erstellst in ORVIA ein Workout. Das kannst du exportieren, fügst es bei
> Garmin ein, dann hast du es auf der Uhr. Auf der Uhr startest du Krafttraining
> und wählst das Workout aus. Wenn das synchronisiert, hast du automatisch in
> der App dieses Workout mit den richtigen Gewichten — und das verknüpft sich
> mit dem Plan und erkennt: heute Oberkörper absolviert."

Das ist kein Zusatz, sondern der Baustein, der Kraft überhaupt erst
alltagstauglich macht: Ohne ihn muss jeder Satz zweimal erfasst werden — auf der
Uhr und in der App. **Machbarkeit am 2026-08-11 gegen die Bibliothek und die
Garmin-Dokumentation geprüft, nicht angenommen.**

**Befund Hinweg — geht, aber inoffiziell.** Garmin dokumentiert Kraft-Workouts
im FIT-Format ausdrücklich **nicht**: „How to encode and decode strength or
reps & sets workouts is not something that is currently planned to be
documented" (Garmin-Mitarbeiter im FIT-SDK-Forum). Der offizielle Weg über die
FIT-Datei ist damit **versperrt**. Es gibt aber einen zweiten, der für ORVIA
sogar günstiger liegt: `POST /workout-service/workout` mit
`sportTypeId: 5` (strength_training), Übungen als `category` + `exerciseName`
aus der FIT-SDK-Übungsliste, Sätze als `RepeatGroupDTO.numberOfIterations`,
Wiederholungen als `conditionTypeKey: "reps"`, Gewicht als
`weightValue`/`weightUnit`. **Entscheidend:** Der Worker hält bereits gültige
Tokens für genau diese Schnittstelle — `garminconnect` 0.3.2, die ORVIA schon
für 28 Abrufe nutzt, bringt `upload_workout(workout_json)` (generisches JSON,
also kraftfähig) und `schedule_workout(workout_id, date)` mit. **Kein neuer
Login, kein Developer-Program-Antrag, keine zweite Auth-Strecke.**

**Befund Rückweg — geht, und zwar sauber.** `get_activity_exercise_sets(
activity_id)` → `GET /activity-service/activity/{id}/exerciseSets` liefert die
Satzdaten der absolvierten Einheit. Damit ist der Kreis geschlossen: Was auf der
Uhr passiert ist, kommt satzgenau zurück.

**Warum das ungewöhnlich gut passt:** ORVIA hat das Zieldatenmodell bereits —
`workout_sessions → workout_exercises → workout_sets` (Migration 0004) mit
stabilen Client-IDs. Der Rückweg schreibt in eine Struktur, die existiert und
getestet ist. Es entsteht **kein zweites Kraftmodell**.

**Die vier Teilstücke, in dieser Reihenfolge:**

1. **`js/engine/gym-workout-export.js`** — ORVIA-Kraftplan → Garmin-Workout-JSON.
   Pur, kein Netz. Die Übungszuordnung (ORVIA-`exercise_id` →
   Garmin-`category`/`exerciseName`) ist eine **Datentabelle mit Lücken-
   Ausweis**: eine nicht abbildbare Übung wird benannt und übersprungen, nie
   geraten — sonst stünde auf der Uhr eine andere Übung als im Plan.
2. **Worker-Endpunkt `POST /workout/push`** — nimmt das JSON, ruft
   `upload_workout`, gibt die Garmin-`workoutId` zurück. Diese ID ist die
   **Brücke** und wird an der ORVIA-Planeinheit gespeichert.
3. **Rückweg im Sync** — bei jeder Aktivität mit `sport_key='gym'` zusätzlich
   `get_activity_exercise_sets` abrufen und in `workout_sets` normalisieren.
4. **Plan-Verknüpfung** — hier gilt der Zuordnungsvertrag aus v8-310b
   **unverändert**: Die Einheit gilt nur dann als erfüllt, wenn die Aktivität
   die Occurrence **explizit** trägt. Die Garmin-`workoutId` ist genau dieser
   explizite Träger — Tag + Sportart allein bleiben verboten. Damit erfüllt
   sich Gians „erkennt, ich hab heute meinen Oberkörperplan absolviert" **ohne**
   die Ratelogik, die wir in v8-310b bewusst entfernt haben.

**Zwei Risiken, die benannt gehören:**

- **[U] Die Schnittstelle ist reverse-engineered.** Garmin kann sie jederzeit
  ändern. Konsequenz für den Bau: Der Export muss **auch als Datei** funktionieren
  (Download, manueller Import) — dann bleibt der Kreislauf bei einem API-Bruch
  mit einem Handgriff mehr benutzbar, statt ganz auszufallen. Das ist der Grund,
  warum Gians ursprüngliche Formulierung („als Datei exportieren") als
  **Rückfallebene** erhalten bleibt, obwohl der API-Weg bequemer ist.
- **[U] Ob die Uhr ein per API erzeugtes Kraft-Workout während der
  Krafttraining-Aktivität wirklich Satz für Satz führt, ist nicht dokumentiert.**
  Das lässt sich nicht am Schreibtisch klären. **Deshalb Teilstück 1–2 zuerst und
  ein echter Gerätetest mit EINEM Workout, bevor Teilstück 3–4 gebaut wird.**
  Fällt der Test negativ aus, ist der Rückweg (Teilstück 3) trotzdem wertvoll —
  dann kommen die auf der Uhr frei erfassten Sätze in die App, nur ohne Vorgabe.

**Aufwand H1–H3 gesamt: 11–15 Tage** (H3 davon 4–6, inkl. Gerätetest).

Quellen der Machbarkeitsprüfung: FIT-SDK-Forum (Garmin-Antwort zur fehlenden
Kraft-Dokumentation), `n1t3k/garmin-strength-api` (reverse-engineerte
Workout-JSON-Struktur), `cyberjunky/python-garminconnect` 0.3.2 (Quelltext:
`upload_workout`, `schedule_workout`, `get_activity_exercise_sets`).

---

## 14. F2 · Push-Benachrichtigungen

Unabhängig, jederzeit. **2–3 Tage.**

---

## 15. Abschnitt 8 · Nicht jetzt bauen

> Dokumentiert, damit es nicht verloren geht. Außerhalb des kritischen Pfads,
> weil die Datengrundlage fehlt — nicht, weil es unwichtig wäre.

| Baustein | Warum nicht jetzt |
|---|---|
| **Individuelles Response Model** | Test-Retest-Streuung eines 5-km-Zeitfahrens rund 1–2 % **[A]**, reale Anpassung pro 4-Wochen-Block rund 1–3 % **[S]** → Signal-Rausch-Verhältnis ≈ 1. Für eine belastbare n-of-1-Unterscheidung zweier Protokolle grob 8–10 gepaarte Blöcke **[S]** = **6–12 Monate pro Athlet**. Vorstufe ist der Tolerance State (Stufe 3). |
| **Echtes Fitness-/Adaptationsmodell** (Banister o. ä.) | Braucht kontinuierliche, kalibrierte Leistungsmessung. Ohne die werden die Modellparameter an Rauschen gefittet. |
| **Probabilistische Wettkampfprognosen** | Eine Zahl mit Konfidenzintervall, deren Intervall nicht validiert ist, ist schlechter als keine Zahl. Ersetzt durch Goal Feasibility (ordinal). |
| **Learning Engine** | Braucht das Entscheidungs-Log als Trainingsdaten. Deshalb steht das Log in Stufe 0 — die Schicht bleibt erreichbar, ohne heute gebaut zu werden. |
| **Kausale Trainingseffekt-Schätzung** | Beobachtungsdaten ohne Randomisierung; Confounder (Schlaf, Arbeit, Krankheit) sind nicht kontrollierbar. |
| Adaptive Ernährung, Schlafschuld, Hitze-/Höhen-/Reiseadaptation, Wetter-Engine, „datenbasierte Motivation" | Jeweils Aussagen, deren Genauigkeit die Eingangsdaten nicht hergeben. Schlafschuld ohne validierte Schlafmessung, Hitzeadaptation ohne Kerntemperatur. |
| Ausrüstungs-Intelligenz (Schuh-km) | **Ausnahme: billig und ehrlich** — aber die Evidenz für eine feste Kilometergrenze ist schwach **[U]**. Als Hinweis, nie als Verfallsdatum. Kann jederzeit nachgezogen werden. |

---

## 16. Reihenfolge und Aufwand

```
0a decision-log ─┬─ 0b evidence ─┬─ 1 G1 Evidence Input ─┬─ 2 C3 Debrief ─┬─ 3 C1 Historie+Tolerance
                 │               │                        │                └─ 4 C2 Progression
                 │               └────────────────────────┴─ 7 D1 Constraints ─┘
                 └─ protokolliert ab hier JEDE Entscheidung

3+4 ─┬─ 5 Goal Feasibility ─┬─ 10 Periodisierung ── Live
     ├─ 6 Opportunity ──────┘
     └─ 11 Gym Planner ── 12 Gym Editing/Export

8 Export ── unabhängig, aber speist die Pipeline (siehe Stufe 8)
9 Knowledge Packs ── unabhängig
```

| # | Baustein | Aufwand | Blockiert durch |
|---|---|---|---|
| 0a | Entscheidungs-Log (inkl. Kette, Runtime-Hash, Driftschutz) | 2,5–3 T | — |
| 0b | Evidence Contract + Migration | 2 T | — |
| 1 | G1 Performance Evidence Input | 3 T | 0b |
| 2 | C3 Session Debrief | 4–5 T | 1, 0b |
| 3 | C1 Load History + Tolerance State | 5–6 T | 2 |
| 4 | C2 Adaptive Progression | 3–4 T | 3 |
| 5 | Goal Feasibility | 3–4 T | 1, 3 |
| 6 | Opportunity / Rescheduling | 2–3 T | 3 |
| 7 | D1 Constraints + Musterwarnungen | 3–4 T | 0b |
| 8 | F1 Export Ausdauer | 2 T | — |
| 9 | Knowledge Packs + Zielprofile | 8–12 T | — |
| 10 | Adaptive Periodisierung | 3–4 T | 3, 9 |
| 11 | Gym Planner (H1/H1b) | 5–6 T | 3 |
| 12 | Gym Editing + Kraft-Export (H2/H3) | 6–9 T | 11 |
| — | F2 Push | 2–3 T | — |

**Summe: 53–69 Arbeitstage ≈ 18–23 Wochen** bei 2–3 h/Tag neben der Ausbildung.

Fassung 1 stand bei 40–55 Tagen. Der Zuwachs von rund 13 Tagen ist **kein
Scope-Creep, sondern die Korrektur einer Unterschätzung**: Stufe 0 (4 T) war
gar nicht enthalten, C3 war um den Faktor 2 zu niedrig angesetzt (+3 T), Goal
Feasibility und Opportunity sind neu (+6 T). Gespart wird bei den Knowledge
Packs durch die JSON-Umstellung.

**[U]** Die Schätzung hat eine bekannte Schwäche: Die bisherigen Module haben je
0,5–1 Tag gebraucht, waren aber pur und ohne Oberfläche. Alles mit UI und
Migration kostet erfahrungsgemäß das Zwei- bis Dreifache — das ist eingerechnet,
aber es ist der größte Unsicherheitsfaktor.

---

## 17. Die Regeln, die für jeden Baustein gelten

Sie stehen hier, weil jede Abweichung davon in diesem Projekt bereits einmal
Zeit gekostet hat:

1. **Pur rechnen, getrennt anzeigen.** Jedes Engine-Modul ohne DOM, ohne Uhr,
   ohne Zufall, ohne Storage. Zeit und IDs kommen herein.
   *Neu begründet:* Diese Regel ist ab Stufe 0 nicht mehr nur Hygiene — die
   Deckelung des Entscheidungs-Logs setzt voraus, dass gleiche Eingaben
   reproduzierbar gleiche Ausgaben erzeugen. **Aber nur innerhalb derselben
   Laufzeitversion** — deshalb der `decisionRuntimeHash` in 0a.
2. **Fehlende Daten führen zu weniger Automatik, nie zu mehr Heuristik.** Kein
   Schätzwert, der aussieht wie eine Messung.
3. **Drei Zustände, nicht zwei.** `ok` · `fail` · `insufficient_data` — und der
   dritte ist niemals der erste.
4. **Jeder Zustand kennt seine Herkunft.** Ab Stufe 0b trägt jeder relevante
   Wert eine Evidence-Hülle. Ohne Provenance weiß eine wachsende Engine
   irgendwann nicht mehr, warum sie etwas „weiß".
5. **Verschieben vor Löschen.** Und was gelöscht wird, wird protokolliert.
6. **`week-plan-policy` ist der einzige Schreiber des finalen Plan-Domains.**
   Designer, Progression und Opportunity schlagen vor; die Policy entscheidet
   und mutiert als Einzige den fertigen Wochenplan.
   *Präzisierung, weil die Kurzform „einziger Schreiber" sonst kollidiert:*
   Diese Regel betrifft **ausschließlich den Plan-Domain**. Debrief, Evidence,
   Entscheidungs-Log, Aktivitäten und Check-ins schreiben selbstverständlich in
   ihre eigenen Bereiche — sie fassen den Plan nur nicht an.
7. **Ein Test je Zusage**, formuliert als Eigenschaft, nicht als Momentaufnahme
   der aktuellen Ausgabe.
8. **Der Test darf nicht die Rechnung des Prüflings übernehmen.** Genau das war
   bei `gm2_plan_parity` der Fall — er war grün, ohne irgendetwas zu prüfen.
9. **Nach jedem Baustein:** volle Suite grün, Version hochzählen, in beide
   Ordner (`app/` und Upload-Ordner), Hashes vergleichen.

---

## 18. Was als Nächstes gebaut wird

**Stufe 0a · Entscheidungs-Log.** Klein, unsichtbar, und ab dem Tag der
Fertigstellung wird jede Engine-Entscheidung historisch sauber erfasst. Jeder
Tag, den es später kommt, ist ein Tag verlorener Historie — und die ist im
Gegensatz zu Code nicht nachbaubar.

Danach **0b Evidence Contract**, weil G1 ohne ihn Werte ohne Herkunft schreiben
würde, die später migriert werden müssten.

---

## 19 · Addendum v8-329 — Vorgabefähigkeit von der Evidenzklasse entkoppelt

**Datum:** 2026-08-12 · **Wissensvertrag:** 5 → 6 · **App:** `orvia-v8-329`

### 19.1 Warum das nötig war

Gians Kernvorwurf lautete: „Die App sagt zwar grob, du sollst laufen, aber wie
viel du laufen sollst, wird nirgendwo angezeigt." Und weiter, dass ORVIA
konkret werden muss — *„heute trainierst Du Brust: zwei Sätze Bankdrücken"*,
*„heute läufst Du fünf Kilometer Tempoläufe in Ein-Kilometer-Blöcken"*.

Die naheliegende Erklärung wäre fehlendes Wissen gewesen. Sie ist falsch. Der
Wissensvertrag war so gebaut, dass Vorgaben strukturell unmöglich waren:

| Gemessen (v8-328) | Wert |
|---|---|
| Regeln im Running-Pack | 14 |
| davon in `mode: 'production'` ausgewählt | **0** |
| davon in `mode: 'shadow'` ausgewählt | 12 (2 medizinisch gesperrt) |
| Evidenzklassen-Ceiling aller 14 Regeln | **D** |
| Registerquellen mit `riskOfBias !== 'not_formally_assessed'` | **0 von 17** |
| ⇒ `quantitativeUseAllowed` für jede reale Quelle | **false** |

Ursache: Der Vertrag leitete die Frage *„darf die App etwas Konkretes sagen?"*
aus der Frage *„wie gut ist die Evidenz?"* ab. Weil jede Engine-Wirkung eine
ORVIA-Produktentscheidung enthält und Produktentscheidungen Klasse D sind, war
der Ceiling immer D — und D durfte nichts Quantitatives. Das Pack sagt das
selbst im Kopfkommentar: *„erzeugt weiterhin KEINEN Plan, KEINE
Capacity-Formel, KEINE Wochenumfangs- oder Pace-Vorgabe."*

### 19.2 Die Trennung

Zwei Achsen statt einer:

| Achse | Frage | Antwort |
|---|---|---|
| **Evidenzklasse** | Wie gut ist das belegt? | A–D, Logik unverändert streng |
| **Vorgabefähigkeit** | Darf die App das sagen? | ja — **wenn** sie die Herkunft offenlegt |

Ein Coach ohne RCT sagt trotzdem „drei Sätze Bankdrücken". Der Unterschied
zwischen einer erfundenen Zahl und einer legitimen Vorgabe ist nicht
Schweigen, sondern **nachvollziehbare Herkunft**.

### 19.3 Die fünf Änderungen

1. **Modus `advisory`** zwischen `shadow` und `production`. Hebt genau eine
   Sperre auf: die wissenschaftliche Freigabepflicht. Gemessen: 12 Regeln, wo
   `production` 0 liefert — dieselben 12 wie im Shadow-Modus.
2. **Offenlegungspflicht statt Blockade.** `selectRules` liefert je Regel ein
   `disclosure`: Klasse, Confidence, Basis, deutsches Label, Quellen-IDs,
   `mustDisplaySource: true`. Basis = **schwächste** essenzielle Rolle.
   Nicht-mutierend, deterministisch.
3. **Quant-Struktur ≠ Quant-Autorisierung.** Bis v5 prüfte `validateClaim` die
   Autorisierung — dadurch machte jede noch nicht autorisierte Zahl das ganze
   Pack ungültig, es war also *unmöglich, überhaupt eine Zahl zu hinterlegen*.
   Neu: `quantitativeSchemaValid` (Struktur, Validierung) vs.
   `quantitativeUseAllowed` (production, unverändert) vs.
   `prescriptiveNumberAllowed` (advisory, neu).
4. **`prescriptiveNumberAllowed` ist fail-closed gegenüber der Regel.** Ohne
   Regelkontext keine Zahl. `medicalSafetyRelevant` ohne Freigabe keine Zahl.
   `fallback` keine Zahl. `rejected`/technisch ungeprüft keine Zahl. Die
   Strenge verlagert sich von der Klasse auf den **Geltungsbereich**:
   `validRange`, `exclusions`, `uncertaintyRange`, `safetyBounds` sind Pflicht.
5. **Fünf neue Quellentypen.** `coach_practice_video`, `coach_curriculum`,
   `textbook`, `practice_synthesis` (Ceiling C) und `federation_guideline`
   (Ceiling B). Vorher hätte `validateSource` jedes Coachvideo mit
   `source_unknown_type` abgewiesen — Praxiswissen war gar nicht einspeisbar.
   Klasse A bleibt per Konstruktion unerreichbar, auch bei bestem Appraisal.

### 19.4 Was ausdrücklich nicht gelockert wurde

- Medizinisch relevante Regeln (`RUN-SAFE-001`, `RUN-RTR-001`) bleiben in
  **jedem** Modus gesperrt, bis eine medizinische Freigabe vorliegt.
- Technisch ungeprüft und `rejected` bleiben überall ausgeschlossen.
- Die Pin-Pflicht gilt in `advisory` unverändert (Test PR9).
- `production` und `shadow` verhalten sich exakt wie in v8-328.

### 19.5 Ehrlich benannt

`disclosure_underivable` in `selectRules` ist unter dem aktuellen Vertrag
**nicht erreichbar**, weil `validatePack` vorher blockiert. Der Zweig bleibt
als Verteidigung in der Tiefe, zählt aber **nicht** als nachgewiesener Schutz;
die Zusicherung wird direkt an `disclosureFor` geprüft (PR7b).

### 19.6 Testlücken, die erst die Mutationsproben sichtbar gemacht haben

| Probe | blieb grün, weil | geschlossen durch |
|---|---|---|
| M6 | nur typwidrige `independentValidation`-Werte getestet, boolesches `false` fehlte | QN1c |
| M7 | Fixture-Appraisal deckelte ohnehin, angehobene Typstufe unsichtbar | PX2b + Gegenprobe |
| M10 | reale Regeln tragen je nur **eine** essenzielle Rolle ⇒ Rangtabelle ungeprüft | PR6c (synthetisch gemischt) |
| M11 | `Object.freeze` verschluckt die Zuweisung still ⇒ gemessen wurde das Einfrieren | PR8 gegen aufgetautes Pack |

Nach dem Schließen schlagen **alle 11 Proben** an. Jede Probe verifiziert
zuerst, dass ihre Ersetzung gegriffen hat — eine nicht angewandte Probe liest
sich sonst wie ein grüner Test (Lehre aus Y7).

### 19.7 Nachgezogene Consumer-Pins

`expectedKnowledgeContractVersion: 5 → 6` in `running-capacity-factory.js`
(bleibt bewusst im Modus `shadow`), `batch3b0_knowledge_test.mjs`,
`batch3b1_running_capacity_test.mjs`.

### 19.8 Was damit möglich wird — und was noch fehlt

**Möglich ab jetzt:** Ein Gym- oder Running-Pack darf konkrete Zahlen führen
(Sätze, Wiederholungen, Kilometer, Pace-Anteile) und die Engine darf sie
ausspielen, solange Geltungsbereich und Sicherheitsgrenzen deklariert sind und
die UI die Herkunft anzeigt.

**Noch offen (nicht Teil dieser Fassung):**

1. `week-projection.js` verwirft `prescription` beim Bau des Plan-Items — die
   Vorgabe erreicht die Wochenkarte gar nicht erst.
2. Es gibt kein Ingest-Format, mit dem Gian Quellen einspeisen kann.
3. Das Gym-Pack existiert nicht; 22 von 24 Sportarten haben kein Pack.
4. Kein Consumer nutzt `mode: 'advisory'` — der Modus existiert, wird aber
   noch nirgends verwendet.

---

## 20 · Addendum v8-330 — Erst die Probleme: die vier Lückenmuster

**Datum:** 2026-08-12 · **App:** `orvia-v8-330` · keine Logikänderung

### 20.1 Auftrag

Nicht weiterbauen, sondern die Ursache hinter den vier Testlücken aus v8-329
beheben. M6/M7/M10/M11 selbst waren dort bereits geschlossen. Ungelöst war die
eigentliche Frage: **wie viele gleichartige Lücken liegen an Stellen, an denen
nie eine Probe gefahren wurde?**

### 20.2 Die vier Muster

Aus den v8-329-Befunden verallgemeinert — die vier Arten, auf die ein grüner
Test hereinfällt:

| Muster | Beschreibung | Ursprung |
|---|---|---|
| `value_not_type` | Test prüft nur **typwidrige** Werte, nie den gültigen aber falschen | M6: `independentValidation: false` |
| `fixture_masks` | Fixture so schwach, dass eine **andere** Sperre vorher greift | M7: `moderate/not_formally_assessed` deckelt ohnehin |
| `data_lacks_var` | Test läuft gegen **reale** Daten, die den Zweig nicht ausüben | M10: je nur eine essenzielle Rolle |
| `neighbour_guard` | Ein **Nachbarschutz** verdeckt die Zusicherung | M11: `Object.freeze` schluckt die Zuweisung |

### 20.3 Proben sind kein Wegwerfskript mehr

`tools/mutation-probe.mjs` + versionierter Katalog unter `tools/probes/`.
Bis v8-329 wurden Proben je Runde neu getippt und danach gelöscht — der
Nachweis ging jedes Mal verloren.

Vier Sicherungen, damit eine Probe überhaupt Aussagewert hat:

1. Suchtext **muss vorkommen** (sonst: `not_applied`)
2. Suchtext **muss eindeutig** sein (sonst: `ambiguous`)
3. Datei **muss sich messbar geändert** haben
4. Wiederherstellung wird **bewiesen**, nie angenommen (sonst Abbruch)

Das Werkzeug fährt beide Testwelten (ORVIA-JS `❌`-Zeilen und pytest
`FAILED`-Zeilen) und kann per `--root` außerhalb von `app/` arbeiten, weil der
Python-Worker nur dort läuft, wo seine Umgebung steht.

### 20.4 Erster Durchlauf: 26 Proben, drei echte Lücken

| Probe | Muster | Befund |
|---|---|---|
| **S7** | `value_not_type` | Kürzung überlanger Notizen auf 200 Zeichen war beschrieben, aber ungeprüft — eine Länge ist eine **Wert**grenze, geprüft wurden nur Typen |
| **S8** | `neighbour_guard` | **Der teuerste Fund:** ein fehlgeschlagenes Einfügen im Planeditor durfte die geplanten Übungen löschen. Der Editor hält seinen Zustand selbst, dadurch fiel der Verlust nirgends auf |
| **E6** | `data_lacks_var` | `ambiguous_reverse` im Rückweg ist mit 10 eindeutigen Einträgen durch reale Daten **unerreichbar**; „nimm den ersten Treffer" blieb grün |

S8 wird jetzt an drei Wegen geprüft: ungültige Übung, Anschlag der
Obergrenze, ungültige Änderung — jedes Mal muss die Liste unverändert
stehenbleiben.

### 20.5 Einzige Produktivänderung

`fromGarmin(category, name, entriesForTest)` — dritter, optionaler Parameter
als **Prüföffnung**. Begründung, weil das ein Eingriff in funktionierenden
Code ist: Sobald das Mapping mit dem Gym-Pack wächst, zeigen zwangsläufig
mehrere ORVIA-Slugs auf dieselbe Garmin-Kombination. Genau dann muss die
Mehrdeutigkeit als solche gemeldet werden. Ohne die Öffnung wäre der erste
Nachweis der Tag, an dem es schiefgeht.

Produktive Aufrufer übergeben nichts und arbeiten unverändert. Ein
übergebener, aber untauglicher Wert wird fail-closed abgewiesen
(`invalid_entries`) statt still auf die echte Tabelle zurückzufallen — sonst
hätte ein Tippfehler im Test die echte Tabelle geprüft und wieder nichts
bewiesen.

### 20.6 Katalogstand

| Katalog | Proben | Schwerpunkt |
|---|---:|---|
| `knowledge-contracts.json` | 11 | inkl. der vier v8-329-Befunde mit Vorgeschichte |
| `strength-plan.json` | 9 | `value_not_type` — das Modul sichert fast nur Wertgrenzen zu |
| `garmin-export.json` | 6 | `data_lacks_var` — alle 10 Einträge sind `mapped` |
| `worker-push.json` | 4 | pytest, Aufruf mit `--root garmin-worker` |

### 20.7 Zwei Nebenbefunde an meiner eigenen Buchführung

Das Werkzeug ist strenger als das frühere Wegwerfskript und hat prompt zwei
eigene Fehler gefunden: die Zuordnung von M7 zeigte auf `PX2` statt `PX2b`,
und die erste Fassung von E5 war so grob, dass der Test **abbrach**, statt
eine Zusicherung zu melden. `crashed` ist kein Beleg und wird als solcher
gemeldet, nicht als Erfolg.

### 20.8 Der schwerste Fund: ein echter Defekt im Worker

W3 und W4 blieben grün — und W3 führte auf keinen Testmangel, sondern auf
einen **realen Datenabfluss**.

`_safe_code()` ist die Erlaubnisliste für Fehlercodes. Sie wurde
**ausschließlich mit Konstanten** aufgerufen (`_safe_code("auth_failed")`) und
filterte damit nie etwas. Die einzige Stelle mit Fremddaten umging sie:

```python
await _set_reauth(db, user_id, getattr(e, "code", "AUTH_FAILED"))
```

Der `code` einer von Garmin geworfenen `AuthError` ging ungefiltert in
`data_providers.last_error_code`. Eine Fremd-Exception kann dort beliebigen
Text tragen — Adressen, Token-Reste, Kennungen.

**Behoben** mit einer eigenen Erlaubnisliste `SAFE_REAUTH_CODES`, deren
Bereinigung **in `_set_reauth` sitzt** und nicht bei den Aufrufern: so kann
kein späterer Aufrufer sie versehentlich umgehen. Der neue Test wirft eine
`AuthError` mit `code = "host=1.2.3.4 token=SECRET user=…"` und prüft, dass
kein Bestandteil davon irgendwo in der Datenbank landet.

**W4** war die passende Lücke dazu: `test_missing_tokens_require_reauth` prüft
Antwortcode, Status und `last_error` — aber nicht, ob der Reauth-Status
gesetzt wurde. Das Entfernen von `_set_reauth` blieb deshalb grün, und die App
hätte den Nutzer nie zur Neuanmeldung aufgefordert.

### 20.9 Das Werkzeug hat auch eigene Fehler gefunden

Drei an meiner eigenen Arbeit:

1. Die Zuordnung von M7 zeigte auf `PX2` statt `PX2b`.
2. Die erste Fassung von E5 war so grob, dass der Test **abbrach**, statt eine
   Zusicherung zu melden. `crashed` ist kein Beleg.
3. Das Werkzeug selbst scheiterte beim ersten Gerätelauf zweimal: es setzte
   **Löschrechte** voraus (auf dem Mount gilt `EPERM unlink`) und nahm an,
   Code und Tests lägen unter **derselben Wurzel**. Beides behoben —
   Wiederherstellung aus dem Speicher mit Notfall-Handler, und `--test-root`.
   Ein fehlender Zieltest wird jetzt als **Pfadfehler** gemeldet, nicht als
   Codebefund.

### 20.10 Offen

- `tests/test_detail_sync.py` lässt sich im Container nicht einsammeln
  (`No module named 'tests.conftest'`) — Umgebungsfrage, kein Codefehler; auf
  dem Mac läuft die Suite.
- Die zwei bekannten `test_sync_contract.py`-Fehlschläge stehen weiterhin im
  Backlog (Layout-Robustheit, `CREATE UNIQUE INDEX` vs. Tabellen-Constraint).
  Sie sind ausdrücklich **keine** nachgewiesene Testabdeckung.
- Noch ohne Probenkatalog: `week-projection.js`, `prescription-factory.js`,
  `plan-activation`, die Repositories und `workout-store.js`.

---

## 21 · Addendum v8-331 — Zweiter Probendurchgang: die fünf restlichen Module

**Datum:** 2026-08-12 · **App:** `orvia-v8-331`

### 21.1 Ergebnis

30 neue Proben über `week-projection`, `prescription-factory`,
`plan-activation`, `workout-store` und `workoutRepository`. **Sieben weitere
Testlücken — zwei davon echte Befunde im Produktivcode.**

Gesamtstand: **55 Proben in 8 Katalogen**, alle schlagen an.

### 21.2 Die zwei echten Befunde

**B1 · `week-projection`: Arrays passierten den Wächter.**
`if (!pr || typeof pr !== 'object')` lässt Arrays durch, weil
`typeof [] === 'object'`. Eine Vorgabe in Arrayform lief bis zur Typtabelle
und wurde dort mit dem **falschen Grund** gemeldet (`unknown_session_type`
statt `prescription_missing`) — die Fehlersuche hätte am falschen Ende
begonnen. Das restliche Projekt prüft überall ausdrücklich auf
Nicht-Array-Objekt; hier fehlte es. Behoben.

**B2 · `0 kg` ist eine Aussage, keine Lücke.**
`strength-plan@1` hält ausdrücklich fest: 0 kg bedeutet „ohne Zusatzlast" [A1],
nicht „keine Angabe". Eine truthy-Prüfung statt `!= null` hätte daraus
Schweigen gemacht — Klimmzüge ohne Zusatzgewicht wären nicht mehr von
„Gewicht unbekannt" zu unterscheiden. Der Code war richtig, aber **in beiden
Schreibwegen ungeprüft**. Jetzt als Probenpaar `T2`/`T2b` abgesichert, weil
genau diese Online/Offline-Parität in v8-322 schon einmal auseinanderlief.

### 21.3 Die übrigen fünf Lücken

| Probe | Modul | Warum es unbemerkt blieb |
|---|---|---|
| **A6** | plan-activation | Geprüft war nur die **Gleichheit** von `back.plan` und `r.previous` — die erfüllt eine blosse Referenz genauso. Wer den zurückgenommenen Plan bearbeitet, hätte den Schnappschuss rückwirkend verändert |
| **J4** | week-projection | Die Fixture enthielt keine Einheit mit Dauer 0 |
| **J5** | week-projection | Die Sieben-Tage-Grenze sitzt in `weekPlanToComparable`, nicht in `projectWeek`. Ein achter Tag wäre mit `weekday: undefined` in den Gate-Vergleich gelaufen |
| **F1** | prescription-factory | Geprüft war nur das **Easy**-Pace-Fenster. Tempo (1.02–1.08) und VO2 (0.92–0.98) waren ungeprüft — genau die Zahlen, die entscheiden, ob „5 km Tempolauf" ein Schwellenreiz oder ein Wettkampf wird |
| **F6** | prescription-factory | `iterations >= 1`: eine Gruppe mit 0 oder −1 Durchgängen wäre durchgelaufen und auf der Uhr als leere Gruppe erschienen |
| **T4** | workout-store | Der fail-**open**-Zweig beim Anzeigenamen war ungeprüft |
| **T6** | workout-store | Ohne `no_contract` wäre ein kaputter Aufbau nicht von einem leeren Plan zu unterscheiden |

### 21.4 Zwei Testfassungen, die selbst nichts geprüft haben

Beide fielen erst durch die Proben auf — und beide sind lehrreicher als die
Lücken:

1. **J5, erster Anlauf:** Mein Test prüfte `projectWeek(...).days.length === 7`.
   Die Sieben-Tage-Grenze sitzt aber in `weekPlanToComparable`. Der Test war
   grün und traf den Zweig nie.
2. **T4, erster Anlauf:** Ich testete offline. Der fail-open-Zweig sitzt im
   `catch` der Namensabfrage — und die läuft **nur online**. Der Zweig wurde
   nie erreicht. Jetzt: online, Bibliothek wirft, Übungen entstehen trotzdem,
   plus Gegenprobe, dass die Übung **selbst** weiterhin fail-closed ist.

### 21.5 In eigener Sache

Beim Schließen von T2 habe ich einen Test geschrieben, der nichts prüft:

```js
(() => { … })() instanceof Promise ? true : true   // immer wahr
```

Aufgefallen beim Nachlesen, sofort ersetzt durch eine awaitete Gegenprobe.
Genau die Sorte Test, die **§17.8** verbietet — und ein Beleg dafür, dass die
Proben nötig sind, nicht nur die Tests.

### 21.6 Werkzeug

Neuer Status `skipped` (⏭️) für Kataloge, die eine andere Wurzel brauchen.
Vorher meldete der Gesamtlauf die vier Worker-Proben als `invalid` — ein
sauberer Lauf sah damit nach Fehler aus. Übersprungen ist ausdrücklich **kein
Beleg** und wird einzeln ausgewiesen.

### 21.7 Katalogstand

| Katalog | Proben |
|---|---:|
| `knowledge-contracts.json` | 11 |
| `strength-plan.json` | 9 |
| `garmin-export.json` | 6 |
| `plan-activation.json` | 6 |
| `week-projection.json` | 6 |
| `prescription-factory.json` | 6 |
| `workout-store.json` | 7 |
| `worker-push.json` | 4 (eigene Wurzel) |
| **gesamt** | **55** |

### 21.8 Damit ist der Weg frei

`week-projection` und `prescription-factory` — die beiden Module, die für das
Durchreichen der `prescription` auf die Wochenkarte umgebaut werden — stehen
jetzt unter Proben. Der nächste Schritt kann beginnen.

---

## 22 · Addendum v8-332 — Die Vorgabe wird sichtbar

**Datum:** 2026-08-12 · **App:** `orvia-v8-332` · neues Modul `prescription-format@1`

### 22.1 Der Punkt, um den es die ganze Zeit ging

Auf der Wochenkarte stand `Laufen · Intervalle · 59 min`. Was drinsteht:

```
Aufwärmen 15 min @ RPE 3
5 × (Belastung 4 min @ 4:36–4:54 min/km · Pause 3 min)
Auslaufen 9 min
```

Die Engine rechnet das seit Monaten jeden Tag aus. `week-projection.js` warf
es an genau einer Stelle weg.

### 22.2 Was gebaut wurde

**`rx` am Anzeige-Item.** Die **rohe** Verordnung, nicht fertiger Text —
Formatieren ist Sache eines eigenen Moduls, Sprache und Aussehen Sache der
Oberfläche. Wäre hier schon Text, könnte niemand mehr etwas anderes daraus
machen, und der Garmin-Exporter braucht ohnehin die Struktur. Als tiefe
**Kopie**, nicht als Verweis (dieselbe Fehlerklasse wie A5/A6).

**`prescription-format@1`.** Macht aus einer Verordnung lesbare Zeilen und
sonst nichts. Kein DOM, kein Storage, keine Zeitquelle, kein HTML — der
Rückgabewert sind Daten mit `kind` und `text`.

Die einzige harte Zusage: **es wird nichts erfunden.**

| Fall | Verhalten |
|---|---|
| kein Pace-Fenster | kein Tempo in der Anzeige — auch kein geschätztes |
| keine Dauer | keine Dauer |
| unbekannter Blocktyp | **gemeldet**, nicht mit „Einheit" überdeckt |
| `iterations` 0 / −1 / 2,5 | Warnung statt „0 ×" |
| Übung ohne Namensauflösung | `exercise_id` sichtbar statt „Übung" |

Nebenbei belegt: **RUN-INT-001 hält sich bis in die Anzeige durch.** Ohne
Pace-Evidenz erscheint in der ganzen Karte kein einziges `min/km`.

**Vorschau statt Mutprobe.** Um die Engine-Woche zu sehen, musste man bisher
`engine_v2_plan` einschalten — und das *ersetzt* den Wochenplan. Man musste
seinen Plan aufs Spiel setzen, um zu erfahren, ob der Ersatz taugt. Der neue
Abschnitt im Profil rechnet und zeigt, ohne zu aktivieren.

### 22.3 Eine Zusage, die zurückgenommen werden musste

Erst geschrieben stand da „es wird nichts gespeichert". Der Browsertest hat es
widerlegt: `buildWeekNow()` schreibt den üblichen Schattenprotokoll-Eintrag.

Unschädlich, weil der Eintrag je Woche **ersetzt** statt angehängt wird
(`log.filter(x => x.weekKey !== weekKey)` vor dem `push`). Die Formulierung
war trotzdem falsch und steht nicht mehr da.

Statt der bequemen Zusage prüft der Test jetzt die Größe, die wirklich zählt:

> die Zahl der protokollierten Wochen darf nicht wachsen

Sonst verfälschte ausgerechnet die Vorschau das ≥14-Tage-Gate, auf dessen
Basis später über die Aktivierung entschieden wird.

Was gilt und im Browser **gemessen** ist: der Plan wird nicht angefasst, es
entsteht kein Rückweg-Schnappschuss, es wird nichts aktiviert.

### 22.4 Zwei Prüfebenen

Der Modultest belegt, dass die Verordnung lesbar wird. Er belegt **nicht**,
dass die Oberfläche sie zeigt. Genau diese Lücke zwischen „Modul rechnet
richtig" und „Nutzer sieht es" war der Grund, warum die Engine monatelang
unbemerkt ins Leere rechnete. Deshalb zusätzlich `rx_preview_ui_test.mjs`:
echte Seite, echter Browser, echter Scheduler-Durchlauf.

### 22.5 Stand

- 61 neue Zusicherungen (`prescription_format` 42, `rx_preview_ui` 19)
- 11 neue Proben (R1–R11); **R11** stellt den Zustand *vor* dieser Fassung her
  und belegt, dass der Verlust der Verordnung jetzt auffiele
- **66 Proben in 9 Katalogen**, App-Gesamtsuite **253/0** Dateien
- Kohorten-Pin `023ee59b` unverändert

### 22.6 Noch nicht aktiv

Der produktive Wochenplan kommt weiterhin aus dem Legacy-Pfad. Die Vorschau
zeigt, was käme — das Einschalten bleibt eine ausdrückliche Entscheidung.

---

## 23 · Addendum v8-333 — Die Vorgabe erreicht den produktiven Weg

**Datum:** 2026-08-12 · **App:** `orvia-v8-333`

v8-332 hat die Verordnung sichtbar gemacht — **in der Vorschau**. Diese Fassung
prüft nach, ob sie den produktiven Weg überleben würde. Sie hätte es nicht: an
zwei Stellen wäre sie erneut hängengeblieben.

### 23.1 Befund 1 — der Fingerabdruck war blind für die Verordnung

`baselineFingerprint` entscheidet, ob eine neu gerechnete Woche als Änderung
gilt oder als `unchanged` verworfen wird. Verglichen hat er nur Tag, Sportart,
Einheitenname und Umfangstext. Gemessen:

| Verordnung | Fingerabdruck |
|---|---|
| 4 × 5 min | `1\|Laufen\|Intervalle\|32 min` |
| 5 × 4 min | `1\|Laufen\|Intervalle\|32 min` |
| gleiche Struktur, anderes Tempo | `1\|Laufen\|Intervalle\|32 min` |

**Alle drei identisch.** Passt die Engine die Intervallstruktur an oder
verschiebt sie das Tempofenster, weil eine neue Schwellenpace gemessen wurde,
meldet `activate()` `unchanged` und aktiviert **nicht**. Die neue Vorgabe
erreicht den Nutzer nie — er würde sich irgendwann wundern, warum sich sein
Tempo nie anpasst.

Ausgerechnet das, was v8-332 sichtbar gemacht hat, wäre im Betrieb eingefroren
gewesen.

**Behoben** durch einen Hash der **vollen** Verordnung. Bewusst der ganze
Strukturvergleich statt einer Auswahl einzelner Felder — eine Auswahl wäre
wieder blind für alles, woran heute niemand denkt.

Die **Idempotenz bleibt**, weil die `prescription-factory` nachweislich rein
ist: gleiche Lage ⇒ gleiche Verordnung ⇒ gleicher Abdruck. Also weiterhin
keine Revision beim blossen Öffnen des Plans — der ursprüngliche Grund für den
Fingerabdruck ist gewahrt.

*Warum es niemandem auffiel:* alle Testfixtures trugen dieselbe simple
Ein-Block-Verordnung. Muster `data_lacks_var`.

**Nebenbefund aus der Probe dazu:** der `catch`-Zweig der neuen Hashfunktion
warf **alle** nicht serialisierbaren Verordnungen auf denselben Ersatzwert —
für genau diese Fälle wäre der Vergleich wieder blind gewesen. Jetzt ein
grober, aber stabiler Strukturabdruck als Notfallweg.

### 23.2 Befund 2 — die echte Wochenkarte las `rx` gar nicht

v8-332 hat die Verordnung ans Anzeige-Item gehängt und in der **Vorschau**
gerendert. Der produktive Kartenrenderer kannte sie nicht — nach dem
Einschalten hätte dort weiterhin nur „59 min" gestanden.

Neu: `gmRxLinesHTML` neben dem bestehenden `gmPlannedLinesHTML` (Kraft), beide
auf derselben Karte. Ohne `rx` liefert es `''` — Altbestand und
Legacy-Einheiten sehen Zeichen für Zeichen aus wie vorher.

Zwei bewusste Entscheidungen im Detail:

- **Aufwärmen und Auslaufen treten zurück, verschwinden aber nicht** — sonst
  fehlte dem Nutzer die halbe Einheit.
- **Die Zeile darf umbrechen.** „5 × (Belastung 4 min @ 4:36–4:54 min/km ·
  Pause 3 min)" abzuschneiden wäre schlimmer als eine zweite Zeile, weil dann
  genau die Zahl fehlt, wegen der die Zeile überhaupt dasteht.

### 23.3 Mitgeprüft

Die Verordnung überlebt `baselineFromDays` und landet in der persistierten
Baseline. Gemessen: **945 statt 345 Zeichen** je Einheit — Faktor 2,7, bei
sieben Einheiten rund 6,6 KB statt 2,4 KB.

### 23.4 Ein Testharness nachgezogen

`gm2_plan_parity` schneidet `renderGMPlan` aus `ui.js` heraus und evaluiert es
isoliert; der neue Helfer fehlte dort und der Test brach ab. Stub ergänzt, mit
derselben Begründung wie bei `gmPlannedLinesHTML` in v8-323 — die Ausgabe
liegt innerhalb von `.session-main` und berührt die geprüften Blockklassen
nicht.

### 23.5 Stand

- 2 neue Proben (**A7**, **A8**); A7 stellt die Blindheit wieder her und
  belegt, dass sie jetzt auffiele
- **68 Proben in 9 Katalogen**, App-Gesamtsuite **253/0** Dateien
- Kohorten-Pin `023ee59b` unverändert

---

## 24 · Addendum v8-334 — Jetzt fütterst du die App

**Datum:** 2026-08-13 · **App:** `orvia-v8-334` · neues Modul `knowledge-ingest@1`

### 24.1 Warum es ohne diesen Weg gescheitert wäre

Gians Vorgabe: die App soll kein eigenes Denken haben, sondern Wissen aus
vielen externen Quellen ziehen, die **er** einspeist. Der Wissensvertrag kann
das seit v8-329 tragen. Was fehlte, war der Weg hinein.

Eine einzige Regel verlangt im Vertrag **20 Pflichtfelder**, ein Claim elf,
eine Quelle dreizehn — darunter `positionRole`, `seasonPhase`,
`previousVersion`, `conservativeFallback`. Wer damit täglich Wissen einpflegen
soll, hört nach dem dritten Eintrag auf. Die Idee wäre nicht an der
Architektur gescheitert, sondern an der Eingabe.

### 24.2 Die Trennlinie

**Aufgefüllt** wird ausschließlich, was keine inhaltliche Entscheidung ist:
Formalien, Claim-Hülle, Governance-Grundzustand.

**Erzwungen** wird alles Übrige — mit einer Meldung, die die nächste
*Handlung* nennt statt nur den Feldnamen:

```
quellen[0].grenzen: Was folgt daraus ausdrücklich NICHT?
Z. B. „gilt nur für Trainierte, keine Aussage für Anfänger".
```

| Pflicht | warum |
|---|---|
| wer, wann, wo nachzulesen | eine Quelle ohne Fundstelle ist keine |
| für wen — und für wen **nicht** | „alle" ist selten richtig |
| was folgt daraus **nicht** | Grenzen der Übertragbarkeit |
| welche Unsicherheiten bleiben | eine Regel ohne Unsicherheit gibt es nicht |
| bei Zahlen zusätzlich: Einheiten, Gültigkeitsbereich, Ausschlüsse, Unsicherheit, **Sicherheitsgrenzen** | eine Zahl ohne Sicherheitsgrenze ist keine Vorgabe, sondern ein Risiko |

### 24.3 Was nie aufgefüllt wird

- **eine Freigabe** — alles startet technisch *und* wissenschaftlich
  ungeprüft, mit leerer `reviews`-Liste
- **ein Risk-of-Bias-Urteil** — bleibt ehrlich `not_formally_assessed`
- **eine unabhängige Validierung** — lässt sich nicht per Eingabefeld
  behaupten; das Feld wird ignoriert und bleibt `false`
- **eine unbekannte Quellenart** — sonst entschiede ein Tippfehler über die
  Evidenzklasse

### 24.4 Urheberrecht als harte Grenze

Nur eigene Paraphrasen: Längengrenze (700 Zeichen Kernaussage, 400 je
Regelaussage) plus die ausdrückliche Bestätigung `"eigene_worte": true` bei
**jedem** Eintrag. Fakten und Zahlen sind nicht schutzfähig und dürfen frei
verwendet werden, fremde Formulierungen nicht.

**Ehrliche Grenze:** geprüft wird nur, dass die Bestätigung dasteht. Software
kann kein Plagiat erkennen — und das Modul tut auch nicht so.

### 24.5 Der Weg in Zahlen

Am mitgelieferten Beispiel gemessen: ein Coachvideo über Krafttraining für
Läufer wird zu **Klasse C**, Confidence *medium*, Basis „Fach-/Coachkonsens" —
und darf im Advisory-Modus die Vorgabe **„2–4 harte Sätze"** begründen, aber
erst nach technischer Prüfung, und in `production` weiterhin nicht.

Genau die Abstufung, die v8-329 eingeführt hat, greift hier zum ersten Mal an
echtem Fremdwissen.

### 24.6 Zweiter Griff fürs Schreiben

Standard ist nur prüfen. Erst `--schreiben` legt Module an, und der technische
Prüfstatus kommt nur mit `--technisch-geprueft "Name"`. Ohne ihn wählt der
Vertrag die Regeln in **jedem** Modus ab. Dasselbe Muster wie beim
Garmin-Push (`--send`).

Jede eingespeiste Sportart bekommt ihr **eigenes** Quellenregister — ein
Eintrag im bestehenden `knowledge-sources.js` würde dessen Inhalts-Hash ändern
und die gepinnte Running-Kette blockieren.

### 24.7 Ein eigener Testfehler

Die erste Fassung des Reinheitstests verbot jedes `new Date` und schlug an
einer reinen Kalenderprüfung an, die der Wissensvertrag selbst genauso macht.
Verboten ist eine eigene **Zeitquelle** (`Date.now`, `new Date()` ohne
Argument), nicht das Prüfen eines übergebenen Datums. Test präzisiert statt
Code verbogen.

### 24.8 Stand

- 49 neue Zusicherungen, 12 neue Proben (N1–N12) auf genau der Trennlinie
- **80 Proben in 10 Katalogen**, App-Gesamtsuite **254/0** Dateien
- Kohorten-Pin `023ee59b` unverändert

**Offen:** das Beispiel ist eine Vorlage, kein Wissen. Das Gym-Pack entsteht
erst, wenn echte Quellen eingespeist werden — und die kommen von Gian.

---

## 25 · Addendum v8-335 — Eingespeistes Wissen wirkt

**Datum:** 2026-08-13 · **App:** `orvia-v8-335` · neues Modul `knowledge-application@1`

### 25.1 Der Befund direkt nach v8-334

Gemessen statt vermutet: Wissen ließ sich einspeisen, der Vertrag wählte es im
Advisory-Modus korrekt aus, die Einordnung stimmte — **nur las es niemand.**

Die Suche nach Consumern ergab genau einen (`running-capacity-factory`), fest
auf das Running-Pack im Shadow-Modus gepinnt. Ein eingespeistes Gym-Pack hätte
am Verhalten der App nichts geändert. Das Einspeisen wäre ein Ritual ohne
Wirkung geblieben — und das hätte niemand bemerkt, weil alles grün war.

### 25.2 Was das neue Modul liefert

Jede Vorgabe trägt Wert, Einheit, Sicherheitsgrenze, Ausschlüsse, den
vorsichtigen Weg — und ihre **Herkunft**. Der Anzeigesatz nennt beides
untrennbar:

```
2–4 harte Sätze je Übung (Fach-/Coachkonsens, Klasse C)
```

### 25.3 Die härteste Zusage: kein Widerspruch wird geglättet

Sagen zwei gleich stark belegte Quellen etwas Unterschiedliches zum selben
Ziel, entsteht **keine** Vorgabe. Der Konflikt wird gemeldet, mit beiden
Regeln und der Aufforderung, ihn zu entscheiden.

Heimlich zu mitteln wäre die bequemste und zugleich falscheste Lösung: aus
„Coach A sagt 3 Sätze, Coach B sagt 5" würde „4 Sätze" — eine Zahl, die
niemand gesagt hat, die aber völlig plausibel aussieht und deshalb in keinem
Test aufgefallen wäre.

Die **einzige** zulässige Auflösung ist eine nachweislich bessere
Evidenzklasse. Dann wird das Überstimmen protokolliert, nicht verschwiegen:
`ueberstimmt: ['GYM-COACH-001']`.

### 25.4 Eine Lücke, die erst die Probe zeigte

**V4** — die Zusicherung „eine nicht freigegebene Zahl wird nicht ausgegeben"
war ungeprüft, weil **alle** bis dahin gebauten Fälle schon vom Vertrag
aussortiert wurden und die Zahlenprüfung gar nicht erreichten.

Geschlossen mit einer **Notfallregel**: sie wird ausgewählt, darf aber nie
eine Zahl vorschreiben — sonst würde die vorsichtige Rückfallebene zur
Vorgabe. Dass eine Zahl *da war*, aber gesperrt ist, bleibt sichtbar
(`zahlGesperrt`); sonst sähe es aus, als hätte die Quelle nie eine genannt.

### 25.5 Noch ein eigener Testfehler

Die erste Fassung des „Vertrag fehlt"-Tests lautete:

```js
KA.applyKnowledge({ … }) && true     // immer wahr
```

Ein grüner Test ohne jede Aussage — **zweiter Fall derselben Sorte in drei
Fassungen**. Ersetzt durch eine Prüfung, die den globalen Rückfall
ausdrücklich leert. Dass mir das wiederholt passiert, ist selbst ein Befund:
die Proben fangen es, die Sorgfalt beim Schreiben offenbar nicht.

### 25.6 Stand

- 37 neue Zusicherungen, 11 neue Proben (V1–V11)
- **91 Proben in 11 Katalogen**, App-Gesamtsuite **255/0** Dateien
- Kohorten-Pin `023ee59b` unverändert
- Anleitung und Vorlage unter `docs/wissen/`

**Offen:** die Vorgaben landen noch nicht auf der Wochenkarte — dafür muss der
Scheduler sie anfordern. Und ohne echte Quellen bleibt die Kette leer: das
Beispiel ist eine Vorlage, kein Wissen.

---

## 26 · Addendum v8-336 — Die Factory riet Zahlen, die sie nicht raten darf

**Datum:** 2026-08-13 · **App:** `orvia-v8-336`

### 26.1 Ein Widerspruch innerhalb des Projekts

In `prescription-factory` stand für Kraft:

```js
sets: e.sets >= 1 ? e.sets : 3
rest_seconds: e.restSeconds != null ? e.restSeconds : 120
```

Beides geratene Zahlen. Und `strength-plan@1` verbietet genau das **wörtlich**,
im Kommentar an der eigenen Prüfung:

> „Satzanzahl ist Pflicht. Kein Default — 3 wäre geraten."

Zwei Module desselben Projekts widersprachen sich, und die Factory gewann
still: wer eine Übung ohne Satzangabe einplante, bekam drei Sätze
vorgeschrieben, die keine Quelle je genannt hat — und niemand hätte erkannt,
woher die Zahl stammt.

### 26.2 Die neue Reihenfolge

| Rang | Quelle | Verhalten |
|---|---|---|
| 1 | was die Übung selbst mitbringt | unverändert vorrangig |
| 2 | eingespeistes **Wissen** | mit Herkunft im Flag (`sets_aus_wissen:GYM-S-001`) |
| 3 | nichts | Verordnung wird **blockiert** mit Grund, statt zu raten |

### 26.3 Die Kette schließt sich

Am Beispiel durchgemessen:

```
Wissen liefert: session.sets=3, session.rest_seconds=150
Karte zeigt:    "Kniebeuge — 3 Sätze · RPE 7 · 3 min Pause"
```

Coachvideo → Notiz → Regel → Vorgabe → Verordnung → lesbare Zeile.
**Erstmals stammt eine Zahl auf der Karte aus einer benannten Quelle statt aus
dem Code.**

### 26.4 Eine Probe, die zuerst nichts bewies

**F10** — die Prüfung `art === 'zahl'` war redundant zur Wertprüfung, weil
`knowledge-application` nie eine Empfehlung *mit* Wert liefert. Die Mutation
blieb grün. Geschlossen mit einem fehlerhaften Aufrufer, der beides
widersprüchlich setzt: `art` ist maßgeblich, nicht das bloße Vorhandensein
eines Werts.

### 26.5 Noch nicht behoben

`_rpeTarget(7)` als Ziel-Default und die Aufwärm-/Auslauf-Anteile
(0.25 / 0.15) sind weiterhin Zahlen aus dem Code. Sie stehen als nächste auf
derselben Liste — diese Fassung räumt die Kraftvorgaben auf, nicht alles.

### 26.6 Stand

- 8 neue Zusicherungen, 4 neue Proben (F7–F10)
- **95 Proben in 11 Katalogen**, App-Gesamtsuite **255/0** Dateien
- Kohorten-Pin `023ee59b` unverändert

---

## 27 · Produktwerte sind benannt, nicht mehr verstreut (v8-337)

### 27.1 Was offen war

§26.5 hat es selbst festgehalten: `_rpeTarget(7)` und die Auf-/Auslauf-Anteile
`0.25 / 0.15` blieben nackte Zahlen im Code. v8-336 hat die Kraftvorgaben
aufgeräumt, die Ausdauervorgaben nicht. §27 schließt genau diese Lücke — nicht
mehr.

### 27.2 Der eigentliche Befund

Die Werte waren nicht falsch. Falsch war ihr **Status**. Sie sahen aus wie
Fachwissen, waren aber ORVIA-Entscheidungen ohne Quelle, verteilt über vier
Templates und in Ternäroperatoren versteckt. Auf die Frage „warum 7?" gab es
keine auffindbare Antwort — und das ist der Punkt, an dem der Wissensvertrag
ansetzt.

### 27.3 Umsetzung

```js
var DEFAULTS = {
  warmupAnteil: 0.25, warmupMinMin: 10,
  cooldownAnteil: 0.15, cooldownMinMin: 5,
  intervallMin: 4, trabpauseMin: 3, intervalleMin: 3, intervalleMax: 6,
  rpeEasy: 3, rpeLong: 4, rpeTempo: 7, rpeIntervall: 8,
  rpeWarmup: 3, rpeKraft: 7
};
```

Jeder Eintrag mit `[A]` markiert und begründet. Jeder Zugriff über
`_zahl(schluessel, ziel, req, flags)` mit der Rangfolge aus §26:

1. eingespeistes Wissen → `warmupAnteil_aus_wissen:RUN-WU-001`
2. Produktwert → `produktwert:rpeTempo`

Damit trägt jede Verordnung **an sich selbst**, welche ihrer Zahlen eine Quelle
hat. Vorher war das eine Frage an den Quelltext.

**Bewusst nicht überführt:** die Pace-Faktoren der Templates. Sie sind der
fachliche Kern der Vorlagen, in `phase7_s5` einzeln geprüft und in Probe F1
abgesichert. In der Produktwert-Tabelle würden sie beliebiger aussehen, als sie
sind.

### 27.4 Ein Test musste nachgeben

`eigene.flags.length === 0` sicherte zu: „wer alles selbst mitgibt, löst keine
Ersatzlogik aus". Diese Zusicherung fällt, weil Produktwerte jetzt absichtlich
geflaggt werden. Der Test prüft nun die Aussage, um die es geht — **kein** Flag
auf `_aus_wissen`. Präzisiert wurde der Test, nicht der Code.

### 27.5 Zwei Proben, die zuerst nichts bewiesen — beide mein Fehler

| Probe | Fehler | Korrektur |
|---|---|---|
| F2 | Suchtext zeigte auf die alte Ternärform → `not_applied`, kein Beleg | neu verankert |
| F13 | verschobene Aufwärmzeit schlug im erwarteten Test nicht an (Dauertoleranz ±10%) | auf den Test umgehängt, der tatsächlich anschlägt — Toleranz **nicht** gesenkt |

### 27.6 Engine-Plan: bewusst kein Knopf

`docs/ENGINE-PLAN-AKTIVIEREN.md` beschreibt den Weg über SQL +
`ORVIA.enginePlanActivate()`. Ein App-Knopf wurde **nicht** gebaut:
`engine_v2_plan` liegt in `user_feature_flags` und wird serverseitig geholt —
ein Knopf, der das umgeht, entwertet den Kill-Switch. Die Anleitung benennt
auch, was nicht geschützt ist: der Plan ist inhaltlich nur so gut wie das
hinterlegte Wissen, derzeit **eine** Sportart, wissenschaftlich ungeprüft.

### 27.7 Stand

- 8 neue Zusicherungen (33→41), 3 neue Proben (F11–F13)
- **98 Proben in 11 Katalogen** — 94 gefahren / 4 übersprungen (fremde Wurzel;
  übersprungen ist kein Beleg)
- App-Gesamtsuite **255/0** Dateien (7 übersprungen, brauchen eine echte
  Supabase-Instanz)
- Kohorten-Pin `023ee59b` unverändert

---

## 28 · Der erste echte Einspeiseversuch (v8-338)

Gian lieferte drei Quellen. Die Kette lief zum ersten Mal mit echtem Material
statt mit einer Testvorlage. Sie hielt — und legte dabei drei Dinge frei, die
alle grün waren.

### 28.1 Was mit den drei Quellen möglich war

| Quelle | Identifiziert | Inhalt zugänglich |
|---|---|---|
| `3Ke4QbFDH4A` | Nick Bare, *Build Your Hybrid Athlete Program* | **nein** — YouTube liefert HTTP 429 |
| `NsYbFnZ1NT0` | Dr. Golo Röhrken, *Wie sieht der PERFEKTE TRIATHLON-Plan aus?* | **nein** — dito |
| `BIddEAAAQBAJ` S. 93 | Jan Pauls, *Das große Buch vom Krafttraining*, Stiebner 2015 | **nein** — robots.txt; und Buchtext abzuschreiben wäre ohnehin ausgeschlossen |

Aus Metadaten eine `kernaussage` zu formulieren wäre genau das Erfinden, das
der Vertrag verhindert. Die drei Dateien liegen deshalb **vorbereitet** in
`docs/wissen/` — alles Geprüfte gefüllt, inklusive begründeter
Qualitätseinstufung und Interessenkonflikt (Bare ist Gründer eines
Supplementherstellers) — und werden vom Ingest korrekt mit fünf konkreten
Handlungsanweisungen abgewiesen.

Eingespeist wurde stattdessen, was tatsächlich gelesen wurde: zwei
PubMed-Abstracts (Llanos-Lagos et al. 2024, *Sports Medicine*; Ramos-Campo et
al. 2025, *JSCR*). Dass nur die Abstracts gelesen wurden, steht in `grenzen`.

### 28.2 Befund 1 — der Schreibweg hätte den Wissensstand gelöscht

`--schreiben` **ersetzt** `<sport>-knowledge-pack.js`. Für `running` liegt dort
ein handgepflegtes Paket mit 14 Regeln; eine Notizdatei mit zwei Regeln hätte
es kommentarlos überschrieben. Kein Randfall — wer eine *zweite* Quelle
einspeist, hat fast immer schon ein Paket.

Neu: Exit 3, Nennung der Regelzahl des Bestands, `--ueberschreiben` als
bewusster Ausweg.

### 28.3 Befund 2 — mein eigener Schutztest hat die Datei zerstört

Die erste Testfassung spawnte das Werkzeug gegen das echte Projekt. Solange der
Schutz stand: harmlos. Die Mutationsprobe schaltete ihn ab — und der Testlauf
schrieb wirklich: 34 KB / 14 Regeln → 7 KB / 2 Regeln.

**Die Sonde stellt die Quelldatei wieder her. Die Nebenwirkungen eines Tests
kann sie nicht zurücknehmen.** Das Paket wurde vom Gerät zurückgeholt
(Hash `42ca48f4` wiederhergestellt und verglichen).

Der Test läuft jetzt in einem Wegwerf-Verzeichnis mit eigenen Modulkopien und
künstlichem Bestandspaket, mit drei Gegenproben (Prüflauf blockiert nicht,
`--ueberschreiben` schreibt wirklich, im echten Projekt entsteht nichts).

### 28.4 Befund 3 — eine Übung hieß „undefined"

`exercise_id: String(e.exerciseId || e.id)` → fehlen beide, entsteht die
Zeichenkette `"undefined"`, die jede Schemaprüfung passiert. Auf der Karte
stand wörtlich `undefined — 4 × 5 · RPE 7 · 3 min Pause`. Jetzt fail-closed
(`blocks[0]:exercise_id`), wie bei fehlender Satzzahl seit v8-336.

### 28.5 Die Kette, durchgemessen

```
Ingest    2 Quellen / 2 Regeln
Vertrag   advisory → 2/2 · Klasse B · „aus Studienlage abgeleitet"
          Quellen: SRC-LLANOS-2024 | SRC-RAMOS-2025
Anwendung 1 Vorgabe (plan.strength_focus) + 1 gemeldeter Konflikt
Factory   ok · flags ["produktwert:rpeKraft"]
Karte     back_squat — 4 × 5 · RPE 7 · 3 min Pause
```

### 28.6 Offen — eine Entwurfsfrage, keine Reparatur

`knowledge-application` meldet einen Gleichstand-Konflikt, sobald **zwei gleich
stark belegte Regeln dasselbe Ziel betreffen** — unabhängig davon, ob sie sich
widersprechen. Im Durchlauf betraf das `RUN-KRAFT-001` (schwere Last wirkt) und
`RUN-KRAFT-002` (Plyometrie nur bis 12 km/h): inhaltlich **ergänzend**,
technisch als Konflikt behandelt, Ergebnis **keine Vorgabe**.

Fail-closed ist richtig. Aber es skaliert falsch herum: je mehr Wissen
eingespeist wird, desto häufiger schweigt die App — dieselbe Klasse Fehler wie
der Vertragsbefund aus §22, nur eine Ebene tiefer. Das ist eine
Entwurfsentscheidung und wartet auf Gians Votum.

### 28.7 Stand

- 6 neue Zusicherungen in der Factory (41→47), 7 im Ingest-Test (49→56)
- 2 neue Proben (F14, I_UEB) → **100 Proben in 11 Katalogen**, 96 gefahren /
  4 übersprungen
- App-Gesamtsuite **255/0** Dateien, Kohorten-Pin `023ee59b` unverändert
- Integritätsprüfung neu im Ritual: Hashes von `js/engine/knowledge/*` vor und
  nach dem Probenlauf verglichen — unverändert

---

## 29 · Die erste Zahl aus einer echten Quelle (v8-339)

Gian lieferte eine PDF, die abrufbar war: Birgit Friedmann, *Neuere
Entwicklungen im Krafttraining*, Deutsche Zeitschrift für Sportmedizin
58(1)/2007, S. 12–18. Damit ist zum ersten Mal etwas eingespeist, das
tatsächlich gelesen wurde — und **Gym hat erstmals ein Wissenspaket**.

### 29.1 Die Kette, durchgemessen

```
Ingest    1 Quelle / 4 Regeln  →  gym
Vertrag   advisory → 4/4 · Klasse B · "aus Studienlage abgeleitet"
Anwendung Vorgabe session.rest_seconds {min:120, max:180}
          Herkunft SRC-FRIEDMANN-2007 · mustDisplaySource true
Factory   flags ["rest_aus_wissen:GYM-HYP-001", "produktwert:rpeKraft"]
Karte     back_squat — 4 × 5 · RPE 7 · 2 min Pause
```

Die 2 Minuten stammen **nicht aus dem Code**, sondern aus einer zitierbaren
Arbeit — und die Verordnung sagt das an sich selbst. Darauf haben v8-330 bis
v8-338 hingearbeitet.

### 29.2 Zwei Fehler, die ich fast gemacht hätte

**Einheitenfehler.** Die 5–6 Sätze gelten **pro Muskelgruppe**, nicht pro
Übung. Auf `session.sets` gelegt wären aus 5 Sätzen Quadrizeps 5 Sätze
Beinpresse *und* 5 Sätze Kniebeuge geworden — eine Verdopplung des Umfangs
durch verwechselte Einheiten. Die Regel liegt deshalb auf
`plan.saetze_je_muskelgruppe`, einem Ziel, das die Factory nicht konsumiert.
Lieber wirkungslos und richtig als wirksam und falsch. Das Feld `umrechnung`
sagt es ausdrücklich: *„Diese Zahl darf session.sets nicht speisen."*

**Modellierungsfehler.** Die Streuung −3 bis +59 % hatte ich als `zahlen`
eingetragen. Der Vertrag stufte die Regel prompt als *„darf eine Zahl
vorgeben"* ein — also als Verordnung. Genau falsch herum: diese Zahlen
begründen den **Verzicht** auf eine Prognose. `zahlen` heißt im Format „die
Regel schreibt einen Wert vor"; eine illustrative Zahl gehört dort nicht hin.

### 29.3 Befund — ein eingespeistes Paket wurde nicht geladen

`--schreiben` erzeugt die Moduldateien, **verdrahtet sie aber nicht**. Das
Werkzeug sagt „noch zu tun", danach prüft es niemand. Alle Tests laufen über
`require()`, nicht über die Seite: ein Paket, das in `index.html` fehlt, wäre
im Browser schlicht nicht da — und im Offline-Vorrat von `sw.js` hätte es
ebenfalls gefehlt. Dasselbe Muster wie §23 (eingespeist, aber niemand liest
es), eine Ebene früher.

Neu prüft ein Test das **Verzeichnis**, nicht eine gepflegte Liste:

- jedes `*-knowledge-{pack,sources}.js` ist in `index.html` eingebunden
- jedes liegt im Offline-Vorrat von `sw.js` (nur der Vorratsteil zählt — der
  Kommentarkopf nennt Dateinamen erzählend, das wäre kein Beleg)
- das Quellenregister steht **vor** seinem Paket (Ladereihenfolge)

Jede künftige Sportart ist damit automatisch mitgeprüft.

### 29.4 Befund — mein Testartefakt hieß wie echte Daten

Der Schutztest aus §28.3 legte sein Wegwerf-Paket unter `gym` an. Als Gym in
dieser Fassung ein echtes Paket bekam, klagte die Zusicherung „im echten
Projekt entstand nichts" eine **legitime** Datei an. Jetzt heißt der
Wegwerf-Sport `testsport_wegwerf`. **Ein Testartefakt darf nie den Namen echter
Projektdaten tragen.**

### 29.5 Stand der Abdeckung — ehrlich

| | |
|---|---|
| Sportarten mit Wissenspaket | **2 von 24** (Laufen, Gym) |
| davon wissenschaftlich geprüft | **0** |
| Gym-Paket | 4 Regeln aus **einer** Übersichtsarbeit von 2007 |

Das ist ein Anfang, kein Fundament.

### 29.6 Stand

- 7 neue Zusicherungen (Ingest-Test 53→60), 3 neue Proben (I_WIRE, I_SW plus
  die Korrektur aus §28)
- **102 Proben in 11 Katalogen**, 98 gefahren / 4 übersprungen
- App-Gesamtsuite **255/0** Dateien, Kohorten-Pin `023ee59b` unverändert
- Wissensmodule vor und nach dem Probenlauf gehasht: unverändert

---

## 30 · Ein Paket pro Sportart war das Ende der Kette (v8-340)

### 30.1 Der Befund

Beim Versuch, Sperlich 2015 zu Laufen hinzuzufügen: `applyKnowledge` nahm
genau **ein** Paket. Damit war die Einspeisekette faktisch **einmal pro
Sportart** benutzbar. Für „running" gab es nur zwei Wege:

- das bestehende Paket mit 14 handgepflegten Regeln **ersetzen** — der
  Schreibweg kennt nichts anderes, und der Überschreibschutz aus §28 hätte ihn
  zurecht gestoppt
- die neuen Regeln liegen lassen

Das war auch der eigentliche Grund, warum Gym in §29 ein Paket bekommen
konnte und Laufen nicht: **Gym hatte vorher keins.**

### 30.2 Der Ausweg — nicht zusammenschreiben, sondern nebeneinander prüfen

Pakete zu mergen hätte das kuratierte Register (`registryVersion 2`, 17
Quellen) und die gewachsene Begründungsschicht des Laufpakets vernichtet und
112 Zusicherungen gebrochen. Stattdessen läuft **jedes Paket einzeln** durch
den Vertrag — eigene Pins, eigenes Register — und erst die **ausgewählten
Regeln** treffen sich.

Zwei Eigenschaften fallen dabei ab:

- ein Paket mit falschem Hash blockiert **sich selbst** und reißt die anderen
  nicht mit (gemessen: 20 statt 24 Vorgaben, Paket namentlich gemeldet)
- die Konfliktlösung sieht endlich **alles**, was zum selben Ziel spricht

```
Laufpaket (14 Regeln, Klasse D) + Sperlich (5 Regeln, Klasse B)
→ 17 geprüft · 24 Vorgaben · 1 Konflikt · 0 blockierte Pakete
```

Zugesichert und getestet: der Einzelaufruf liefert **Zeichen für Zeichen**
dasselbe wie die Einerliste; ein einzelnes defektes Paket meldet weiterhin
seinen eigenen Grund statt eines Sammelfehlers; eine leere Paketliste ist ein
Aufruffehler, keine leere Wissensbasis.

### 30.3 Eine bestehende Probe war still ungeprüft geworden

**V9** ankerte auf einer Zeile, die dieser Umbau umgeschrieben hat →
`not_applied`. Das ist **kein grüner Lauf**: die Zusicherung war bis zur
Korrektur ungeprüft. Drei neue Proben (KA_M1–M3) waren zuerst `wrong_test`,
weil ihr `expectTest` führende Leerzeichen trug — der Abgleich ist ein
Präfixvergleich.

### 30.4 Vier neue Quellen

| Quelle | Ergebnis |
|---|---|
| Sperlich/Engel/Zinner 2015, DZSM 66(9) | **5 Regeln, Klasse B.** 46 Studien. Volltext selbst extrahiert und gelesen |
| Hoff/Kähler/Helgerud 2006, DZSM 57(5) | **2 Regeln.** Fußball, nicht Laufen — klärt aber die Einheitenfrage aus §29 |
| Hirschmüller et al. 2005, DZSM 56(2) | **1 Regel, gesperrt.** `medizinisch_heikel` → `medical_safety_review_pending` |
| Halbeck/Schultze 2018 (Bachelorarbeit) | **begründet abgelehnt** |

**Die Einheitenfrage ist geklärt.** Sperlichs „4–5 Serien à 3–4
Wiederholungen/Trainingseinheit" bezieht sich auf das Hoff/Helgerud-Protokoll:
**vier Serien zu vier Wiederholungen einer halbtiefen Kniebeuge**. Also die
Grundübung, nicht die Summe aller Übungen. Zwei Quellen, die sich gegenseitig
lesbar machen — genau wofür ein Quellenregister da ist.

**Die medizinische Sperre lief zum ersten Mal an echtem Inhalt**, nicht an
einer Testvorlage: `0 von 1 Regel(n) ausgewählt`. Der Achillesbefund soll
dokumentiert sein, nicht wirken.

**Die Ablehnung.** Die Prämisse der Bachelorarbeit — Krafttraining steigere das
Muskelvolumen und wirke deshalb negativ auf die Laufleistung — wird von
Sperlich 2015 ausdrücklich widerlegt: keine Veränderung von Körpermasse,
fettfreier Masse, Körperfett oder Extremitätenumfängen, und in **keiner**
ausgewerteten Studie negative Effekte. Die Prämisse ist nicht nebensächlich —
sie begründet, warum die Arbeit schweres Krafttraining gar nicht erst
betrachtet. Dazu: vier eingeschlossene Studien, keine Begutachtung. Die
vollständige Begründung steht in der Datei, nicht nur hier.

### 30.5 Offen — jetzt schärfer belegt

Die Konfliktlösung meldet Gleichstand, sobald zwei gleich stark belegte Regeln
dasselbe Ziel betreffen — auch wenn sie sich **ergänzen**. Konkret:
`RUN-RE-001` („Krafttraining wirkt") und `RUN-RE-002` („Kraftausdauer wirkt
nicht"), beide Klasse B, beide auf `session.exercises` → **keine Vorgabe**.

Fail-closed ist richtig, die Granularität nicht. Wartet auf eine Entscheidung.

### 30.6 Stand

- 8 neue Zusicherungen (Anwendung 37→45), 3 neue Proben (KA_M1–M3)
- **105 Proben in 11 Katalogen**, 101 gefahren / 4 übersprungen
- App-Gesamtsuite **255/0** Dateien, Kohorten-Pin `023ee59b` unverändert
- Wissensmodule vor und nach dem Probenlauf gehasht: unverändert

---

## 31 · Das Wissen wurde von niemandem gelesen (v8-341)

### 31.1 Befund 1 — der Anschluss fehlte vollständig

Nach §29 hatte Gym ein Wissenspaket: eingebunden, im Offline-Vorrat,
testgedeckt, vertragskonform, Klasse B. Und es änderte am Verhalten der App
**nichts**. Eine Suche über das gesamte Projekt ergab den Grund in einer
Zeile:

```
applyKnowledge wird von KEINER Stelle der App aufgerufen.
```

Die Kette lief ausschließlich in Prüfskripten. In der laufenden App endete sie
an `scheduler-v2`, das `buildPrescription` seit §26 mit `knowledge` aufrufen
**könnte** — und ihn nie übergab. Derselbe Befund wie §23, eine Ebene höher.
Er wäre wieder nicht aufgefallen: **kein Test lud den Consumer, also konnte
keiner ihn vermissen.**

### 31.2 `knowledge-consumer@1`

Hält die Pakete je Sportart samt Pins und reicht sie an `applyKnowledge`. Mehr
nicht — es entscheidet nichts und kennt keine Trainingslehre.

Die **Pins stehen als Literal** im Consumer. Läse er sie aus dem Paket,
bestätigte das Paket sich selbst und die Prüfung wäre wertlos. Wird ein Paket
neu erzeugt, **blockiert** es, bis jemand die Zahl bewusst nachzieht — Absicht,
keine Unbequemlichkeit.

Gemessen, über die echten Module und das echte Paket:

```
ohne eigene Pausenangabe  → flags ["rest_aus_wissen:GYM-HYP-001",
                                   "produktwert:rpeKraft"]
                          → rest_seconds 120
ohne Wissen               → rest_seconds null   (die 120 s sind KEIN Default)
mit eigener Angabe 240 s  → bleibt 240          (ergänzt, überschreibt nicht)
```

### 31.3 Was noch nicht geht — als Zusicherung, nicht als Fußnote

Im **Wochenplan** greift die Pausenregel noch nicht: der Scheduler leitet für
Gym keine Übungsliste ab, und ohne Übungen gibt es keine Satzpause. Der
Anschluss steht, die Übungsauswahl fehlt.

Das ist als Test festgeschrieben (`no_exercise_list_generic_session`). Er
schlägt an dem Tag an, an dem der Scheduler Übungen liefert — dann gehört die
Zusicherung von der Factory auf den Wochenplan gehoben.

### 31.4 Befund 2 — „Widerspruch" war zu grob gefasst

Die Konfliktregel setzte *spricht zum selben Ziel* mit *sagt etwas
Unvereinbares* gleich:

```
RUN-RE-001  "Krafttraining verbessert die Laufökonomie"   Klasse B
RUN-RE-002  "Kraftausdauertraining bewirkt nichts"        Klasse B
beide auf session.exercises, beide aus DERSELBEN Quelle   ⇒ KEINE Vorgabe
```

Diese Sätze widersprechen sich nicht. Und je mehr Wissen eingespeist wurde,
desto häufiger schwieg die App — die falsche Richtung. **Unvereinbar können nur
Werte sein.**

Neu, in dieser Reihenfolge:

1. qualitative Vorgaben konkurrieren nie — sie gehen alle durch
2. qualitativ und quantitativ zum selben Ziel konkurrieren nicht
3. zwei Zahlbereiche gleicher Klasse, **deckungsgleich** ⇒ Bestätigung
   (`bestaetigtDurch`)
4. zwei Zahlbereiche gleicher Klasse, **abweichend** ⇒ weiterhin keine
   Vorgabe, jetzt mit den strittigen Werten im Konflikt

Gemittelt wird nirgends. Gemessen am Realfall: **24 → 27 Vorgaben, 1 → 0
Konflikte.**

### 31.5 Drei eigene Fehler

| | Was | Warum es zählt |
|---|---|---|
| V3, V9 | Anker auf Zeilen, die diese Umbauten umgeschrieben haben → `not_applied` | **Kein grüner Lauf.** Zweites Mal in drei Fassungen — Anker sind Wartungsgut |
| Testdatei | ungeschützter Zugriff auf `konflikte[0].hinweis` | Fiel die Liste leer aus, **warf** er und alle folgenden Blöcke liefen nicht mehr. Die Sonde schrieb den Ausfall dann den falschen Tests zu |
| KCO1, KCO2 | Lücken in meinen eigenen frischen Tests | Ladefehlerpfad und Pin-Unabhängigkeit ungeprüft. KCO2 brauchte eine **Quelltextprüfung** — die Verhaltensprobe konnte es nicht, weil die Pin-Tabelle beim Laden einmal ausgewertet wird |

### 31.6 Stand

- neue Testdatei `knowledge_consumer_test.mjs` (**30 Zusicherungen**), neuer
  Katalog `knowledge-consumer` (4 Proben)
- Anwendung 45→53 Zusicherungen, 4 neue Proben (KA_K1–K4)
- **113 Proben in 12 Katalogen**, 109 gefahren / 4 übersprungen
- App-Gesamtsuite **256/0** Dateien, Kohorten-Pin `023ee59b` unverändert
- Wissensmodule vor und nach dem Probenlauf gehasht: unverändert

### 31.7 Offen

Laufen hängt noch nicht am Consumer. Das handgepflegte Paket läuft über seinen
eigenen Weg (`running-capacity-factory`, Shadow), und zwei Wege auf dieselben
Regeln wären schlechter als einer. Erst zusammenführen, dann eintragen.

---

## 32 · Ein Zähler ist keine Prüfung (v8-342)

### 32.1 Anlass

Keine Weiterentwicklung, sondern eine Bestandsaufnahme: jede Zahl aus
`STAND-UND-OFFENE-PUNKTE.md` gegen tatsächlich ausgeführten Code gehalten,
nicht gegen die Erinnerung an den letzten Lauf.

Was hielt: Gesamtsuite 256/0 bei 7 übersprungenen (263 Dateien),
Mutationsproben 109 angeschlagen / 4 übersprungen, Wissenshashes
unverändert, und die drei Messwerte der Pausenregel (120 / null / 240)
reproduzieren sich über die echten Module.

Was nicht hielt: zwei Aussagen über den eigenen Reifegrad.

### 32.2 Befund 1 — die Matrix log, und ein grüner Test hielt sie fest

`sport-coverage-matrix` führte Gym als paketlos. Gym hat seit v8-339 ein
Wissenspaket und ist seit v8-341 die **einzige** Sportart, deren Wissen die
Verordnung erreicht. Die Zusicherung, die das hätte melden müssen, lautete:

```js
matrixSports.filter(s => COVERAGE[s].knowledgePack).length === 1
```

Mit Gym fälschlich auf `false` ergab das weiterhin `1`. Grün. Ein Zähler
kann eine falsche Aussage nicht von einer richtigen unterscheiden — er hält
fest, wie viele es *am Tag des Schreibens* waren, und schützt jeden späteren
Irrtum, der die Anzahl nicht verändert. Dieselbe Fehlerklasse wie die
Paritäts-Gates aus dem GM7-Audit, nur kleiner und unauffälliger.

**C5/C6 vergleichen jetzt gegen die Wirklichkeit.** C5 liest die Pack-Module
aus dem Verzeichnis und nimmt die Sportart **aus dem Modul**, nicht aus dem
Dateinamen — ein Dateiname ist nur eine Vermutung über seinen Inhalt. C6
fragt `knowledgeConsumer.registrierteSportarten()`. Beide Zusicherungen
pflegen sich selbst: ein neues Paket lässt den Test anschlagen, bis die
Matrix es führt.

### 32.3 Befund 2 — besitzen und gelesen werden ist nicht dasselbe

Beim Korrigieren fiel auf, dass `O.runningCapacityFactory` von **keiner
Stelle der App** gerufen wird. Die einzigen Nennungen im gesamten Repo sind
ihre eigene Datei, ihr Unittest und `phase6_module_load_test`. Das
Laufpaket — 14 handgepflegte Regeln, 17 Quellen — wirkt heute auf nichts.
Die bisherige Beschreibung „läuft über seinen eigenen Consumer im
Shadow-Modus" war zu freundlich: ein Shadow-Lauf wäre ein Lauf.

Hätte ich nur `knowledgePack: true` für Gym nachgetragen, behauptete die
Matrix ab sofort zwei wirksame Wissensbasen, wo es eine gibt — der falsche
Eindruck wäre durch die Korrektur überhaupt erst entstanden. Deshalb die
getrennte Dimension `knowledgePackWired` (running `false`, gym `true`),
testerzwungen gegen den Consumer.

Für §31.7 heißt das: „erst zusammenführen, dann eintragen" stand mit einer
falschen Begründung dort. Es gibt keine zwei Wege auf dieselben Regeln, es
gibt einen lebenden und einen toten.

### 32.4 Proben

Neuer Katalog `tools/probes/sport-coverage-matrix.json`, vier Stück, alle
angeschlagen:

| | Was eingebracht wird | Warum |
|---|---|---|
| SCM1 | Gym zurück auf paketlos | **der Originalbefund** — genau dieser Zustand lag zwischen v8-339 und v8-341 im Repo, ohne dass ein Test anschlug |
| SCM2 | verdrahtetes Paket als unverdrahtet | Untertreibung führt dazu, dass jemand Gym ein zweites Mal anschließt |
| SCM3 | unverdrahtetes Paket als wirksam | die gefährlichere Richtung: man hielte die Laufberatung für belegt, obwohl sie aus nichts stammt |
| SCM4 | Prüfstand weglassen | „hat ein Paket" ohne „wie geprüft" ist die Aussage, die zur Überschätzung führt |

SCM4 lief im ersten Anlauf als `wrong_test` — `expectTest` muss ein **Präfix
der getrimmten** Fehlerzeile sein, die führenden Leerzeichen einer
Unterzusicherung gehören nicht hinein. Notiert, weil es beim nächsten
verschachtelten `ok()` wieder passiert.

### 32.5 Stand

- `sport-coverage-matrix` v2 → v3, neue Dimension `knowledgePackWired`
- `batch3b0_knowledge_test.mjs`: C4 entkernt, C5/C6 neu (116 Zusicherungen)
- **117 Proben in 13 Katalogen**, 113 gefahren / 4 übersprungen
- App-Gesamtsuite **256/0** Dateien, 7 übersprungen, Kohorten-Pin `023ee59b`
  unverändert (er ist allerdings nirgends maschinell geprüft — siehe unten)
- Wissensmodule vor und nach dem Probenlauf gehasht: unverändert

### 32.6 Offen aus der Bestandsaufnahme

1. Ohne Chromium überspringen **22 Testdateien still**; die Suite meldet dann
   234/0 bei 29 übersprungenen und sieht dabei unauffällig aus.
2. Der **Kohorten-Pin steht nur in Fließtext**. Kein Code, kein Test
   berechnet ihn — „unverändert" ist eine handgeführte Behauptung.
3. Im Repo-Stamm liegt ein **zweites `sw.js`** (v8-329).
4. Der Arbeitsstand v8-255…v8-341 war **nicht committet**; nachgeholt als
   `21c3c1a` auf `sicherung/v8-341`. Push steht aus.

---

## 33 · Das Prüfwerkzeug war selbst ungeprüft (v8-343)

### 33.1 Zuerst ein eigener Fehler, zurückgenommen

§32.6 und die Standdatei behaupteten, der Kohorten-Pin `023ee59b` sei
nirgends maschinell geprüft. **Das war falsch.** `shadow_adaptive_test.mjs`
vergleicht ihn seit v8-299 gegen `supabase/tests/_acceptance-cohort.json`
und meldet bei Abweichung genau die geänderten Felder.

Der Fehler war handwerklich: die Suche lief über `--include=*.js`,
`*.mjs`, `*.md`. Der Pin steht in einer `.json`. Ein Filter, der die
Antwort ausschließt, liefert zuverlässig „nicht gefunden" — und „nicht
gefunden" fühlt sich an wie ein Befund, obwohl es keiner ist. Notiert als
Muster, nicht als Ausrutscher: **Bevor „existiert nicht" behauptet wird,
muss die Suche ohne Dateityp-Filter wiederholt werden.**

### 33.2 Befund 1 — ein fehlender Pin galt als bestätigter Pin

Beim Nachprüfen zeigte dieselbe Stelle die echte Lücke:

```js
if (!existsSync(PIN)) { writeFileSync(PIN, …); ok('Kohorte neu eingefroren', true); }
```

Der Weg, die Prüfung **abzuschalten**, war identisch mit dem Weg, sie zu
**bestätigen**: Datei weg → still neu eingefroren → grüner Haken. Ein
versehentliches Löschen, ein Lauf im anderen Layout (dort lag das Manifest
nie), ein aufgeräumtes Arbeitsverzeichnis — jedes davon hätte die
Kohortenprüfung lautlos beendet.

Dazu schrieb der Zweig **feste Werte**: `frozenAt: '2026-08-08'`,
`appVersion: 'v8-299'`. Ein am 13.08. unter v8-342 neu gesetzter Pin
behauptete also, seit dem 08.08. unter v8-299 eingefroren zu sein — die
Datei hätte über ihre eigene Herkunft gelogen.

Jetzt fail-closed. Fehlt das Manifest, ist die Kohorte ungeprüft, und das
ist rot. Bewusstes Neusetzen bleibt möglich, aber nur als Ansage:

```
ORVIA_REPIN_COHORT=2026-08-13 node supabase/tests/shadow_adaptive_test.mjs
```

Dann steht das echte Datum darin und die Version, die wirklich in `sw.js`
steht. Alle drei Fälle gemessen: Pin da → grün · Pin weg → rot mit
Anleitung, Datei bleibt weg · Pin weg + Ansage → grün, `frozenAt`
`2026-08-13`, `appVersion` `v8-342`.

### 33.3 Befund 2 — der Runner hat den Grund geraten

`run-all.mjs` beschriftete jeden übersprungenen Test mit „brauchen eine
echte Supabase-Instanz". Auf Gians Rechner übersprangen 22 Dateien wegen
eines fehlenden Chromium — ausgegeben als Datenbanksache. Die Auskunft war
nicht nur falsch, sie war **irreführend in die verkehrte Richtung**: wer
liest, ein Test brauche Zugangsdaten, installiert keinen Browser.

Darunter stand `✅ GRÜN — keine fehlgeschlagenen Tests`. Wahr, und
trotzdem der Satz, wegen dem die Lücke wochenlang niemandem auffiel.

Drei Änderungen: der Grund wird **aus der Ausgabe gelesen** statt geraten;
ein Grund ohne Muster wird ausdrücklich als *nicht erkennbar* ausgewiesen
(ein geratener Grund beendet die Suche, ein eingestandener nicht); und die
Schlusszeile lautet bei Skips `GRÜN, aber UNVOLLSTÄNDIG — N geprüft, M
nicht gelaufen`, mit dem Hinweis auf `npx playwright install chromium`,
wenn der Browser der Grund war.

**Neu: `run_all_reporting_test.mjs`, 12 Zusicherungen.** Der Runner ist das
Werkzeug, dem alle anderen Zahlen dieses Projekts vertrauen, und war selbst
ungeprüft — dieselbe Konstellation, aus der er ursprünglich entstanden ist
(eine Textsuche auf „FAILED", die einen Fehlercode in einer *grünen*
Ausgabe traf). Geprüft wird mit echten Prozessen in einem
Wegwerfverzeichnis unter dem Systemtemp; keine Datei trägt den Namen
echter Projektdaten (v8-338), und das Verzeichnis wird im `finally`
entfernt.

### 33.4 Befund 3 — eine Probe hat eine echte Lücke gefunden

KOH3 sollte belegen, dass ein aus `COHORT_FIELDS` entferntes Feld
auffliegt. Ergebnis: `wrong_test`. Rot wurde nur der Pin — **keine
Feldzusicherung**, denn `source` gehört seit shadow-adaptive@11 zur
Kohorte, stand aber in der Prüfliste des Tests nicht drin. 16 von 17
Feldern waren abgesichert.

Warum das nicht durch den Pin abgedeckt ist: Der Pin lässt sich bewusst neu
setzen. Wer nach einem Umbau „neu einfrieren" wählt, hätte den stillen
Wegfall mit eingefroren. Die Liste ist jetzt vollzählig **und wird
beidseitig geprüft** — kein Feld fehlt, keines steht zu viel drin.

### 33.5 Stand

- `run-all.mjs` und `shadow_adaptive_test.mjs` geändert, kein Produktivcode
  der App berührt
- neu: `run_all_reporting_test.mjs` (12), Kataloge `test-runner` (4 Proben)
  und `acceptance-cohort` (3 Proben)
- `shadow_adaptive_test` 192 → 194 Zusicherungen
- Gesamtsuite **257/0** bei 7 übersprungenen (264 Dateien)
- **124 Proben in 15 Katalogen**, 120 gefahren / 4 übersprungen
- Kohorten-Pin `023ee59b` unverändert, Wissensmodule vor/nach gehasht: unverändert

### 33.6 Offen gesagt: was hier NICHT probengedeckt ist

Der fail-closed-Zweig aus §33.2 liegt im Test selbst. Das Probenwerkzeug
mutiert nur Dateien unterhalb der App-Wurzel, kann ihn also nicht
anfassen. Belegt ist er durch drei gemessene Läufe — das ist schwächer als
eine wiederholbare Probe und wird hier deshalb ausdrücklich genannt statt
als Fußnote geführt.

---

## 34 · Eins von dreißig (v8-344)

### 34.1 Die Zahl

Bevor dieses Register existierte, hat niemand geprüft, ob eingespeistes
Wissen überhaupt einen Leser hat. Gemessen an den beiden vorhandenen
Paketen:

| Paket | Ziele | davon gelesen |
|---|---|---|
| Gym (4 Regeln) | 5 | **1** (`session.rest_seconds`) |
| Laufen (14 Regeln) | 25 | **0** |
| zusammen | 30 | **1** |

Das eine ist die Pausenregel, an der seit v8-341 die ganze Kette vorgeführt
wird. Alle übrigen 29 Ziele erzeugen Vorgaben, die niemand abholt.

### 34.2 Wie es auffiel

QUELLE-11 (Kanjuh) lief sauber durch Einspeisung, Vertrag und Anwendung und
erzeugte eine Vorgabe für `plan.kraftvergleich_normierung` — ein Ziel, das in
der gesamten App nicht vorkommt. Der Vertrag prüft Zielnamen nicht; jede
Zeichenkette wird angenommen. Ein Tippfehler (`session.rest_secons`) hätte
sich identisch verhalten: still, grün, wirkungslos.

Dritte Wiederholung derselben Fehlerklasse: v8-335 (eingespeist, aber niemand
liest es), v8-341 (`applyKnowledge` ohne Aufrufer), jetzt das Ziel ohne Leser.
Die Kette ist jedes Mal ein Stück länger geworden — und jedes Mal endete sie
kurz vor dem Ort, an dem sie etwas bewirkt hätte.

### 34.3 Was gebaut wurde

`prescriptionFactory.GELESENE_ZIELE`: die zwölf Ziele, die diese Verordnung
wirklich liest, als **Literal**. `knowledge_targets_test.mjs` prüft

- **beidseitig** gegen den Quelltext: keines fehlt, keines ist erfunden;
- jedes Paketziel: hat es keinen Leser, muss es in `_ziele-ohne-leser.json`
  **mit Begründung** stehen.

Ein neues wirkungsloses Ziel wird rot. Fehlt die Quittungsdatei, ist der Test
rot — dieselbe fail-closed-Regel wie beim Kohorten-Pin seit v8-343; bewusstes
Neusetzen über `ORVIA_QUITTIERE_ZIELE=JJJJ-MM-TT`.

**Warum quittieren statt verbieten.** Ein Ziel ohne Leser ist kein
Vertragsbruch, sondern Wissen, das noch keine Verwendung hat. Es zu verbieten
hieße, 29 gepflegte Regeln wegzuwerfen; es stillschweigend durchzulassen
hieße, sich reicher zu rechnen, als man ist. Die Quittungsdatei erzwingt die
dritte Möglichkeit: hinschreiben, warum.

### 34.4 Zwei eigene Fehler, beide gefangen

Die erste Fassung der Quittungen enthielt vierzehnmal „dito." — der Test
verlangt je Eintrag eine Begründung von mindestens zwanzig Zeichen und wurde
prompt rot. Gut so: eine Quittung ohne Grund ist eine Unterschrift unter ein
leeres Blatt.

Ernster war der zweite: Der Test sucht die gelesenen Ziele im Quelltext der
Verordnung — und das Register **steht in genau diesem Quelltext**. Ohne
Vorkehrung fände er jeden erfundenen Eintrag dort wieder und bestätigte ihn,
dieselbe Selbstbestätigung wie ein Paket, das seinen eigenen Hash pinnt.
Deshalb schneidet er den Registerblock vorher heraus; Probe ZR4 sichert genau
das ab.

### 34.5 Was NICHT gebaut wurde — und warum

Freigegeben war „Zielregister **und** Laufen verdrahten". Die zweite Hälfte
ist nach der Messung gestoppt: die 14 Laufregeln erzeugen ausschließlich
Analysegrößen (`experienceTier`, `dimensionBudgets.*`, `safetyGateState` …).
An den `knowledge-consumer` gehängt käme davon **nichts** in der Verordnung
an — sie sprechen eine andere Sprache. Das wäre Arbeit ohne Wirkung gewesen,
und sie hätte in der Coverage-Matrix ausgesehen wie ein Fortschritt.

Die Entscheidung liegt bei Gian; drei Wege stehen in
`STAND-UND-OFFENE-PUNKTE.md` unter Punkt 1, empfohlen ist **A** (den Leser im
Wochenplan bauen, wo die Regeln von Anfang an hingehörten).

### 34.6 Stand

- `prescription-factory.js` rein additiv geändert (Registerliteral + Export)
- neu: `knowledge_targets_test.mjs` (9 Zusicherungen),
  `_ziele-ohne-leser.json` (29 begründete Quittungen),
  `tools/probes/knowledge-targets.json` (4 Proben, alle angeschlagen)
- Gesamtsuite **258/0** bei 7 übersprungenen (265 Dateien)
- **128 Proben in 16 Katalogen**, 124 gefahren / 4 übersprungen
- Kohorten-Pin `023ee59b` unverändert, Wissensmodule vor/nach gehasht: unverändert

### 34.7 Offen

Der Sensor prüft Pakete, nicht die Notizdateien in `docs/wissen/`. QUELLE-11
fällt deshalb noch nicht auf — erst wenn daraus ein Paket wird. Die
Erweiterung wäre billig und würde den Fehler zeigen, **bevor** jemand ein
Paket dafür baut.

---

## 35 · Es gibt nichts zu verdrahten (v8-345)

### 35.1 Der Auftrag und sein Ende

Freigegeben war „mache alles": den Sensor auf die Notizdateien erweitern
**und** das Laufpaket verdrahten. Das erste ist gebaut. Das zweite nicht —
und das ist das Ergebnis, nicht das Versäumnis.

| Regeln mit maschinenlesbarem Zahlwert | |
|---|---|
| Gym | **2 von 4** (GYM-HYP-001 Pause, GYM-HYP-002 Sätze je Muskelgruppe) |
| Laufen | **0 von 14** |

Die 14 Laufregeln sind rein qualitativ. Ihr Feld `outputs` nennt Namen wie
`experienceTier` oder `dimensionBudgets.easy` — aber **kein Modul liest diese
Namen**, auch `running-capacity-factory` nicht, für die sie gedacht waren
(null Treffer im Quelltext). Bei den Gym-Regeln ist `outputs` eine echte
Schnittstellenangabe (`session.rest_seconds` wird tatsächlich gelesen); bei
den Laufregeln ist es eine **Absichtserklärung**.

Damit ist „Laufen an den Consumer hängen" in keiner Variante ein Verkabeln.
Es gibt keinen Wert, der fließen könnte. Verdrahtet hätte es genau eine
Wirkung gehabt: `knowledgePackWired: true` in der Coverage-Matrix — und das
hätte wie Fortschritt ausgesehen. Genau die Sorte Fortschritt, die dieses
Projekt sich zweimal selbst vorgemacht hat.

### 35.2 Was der erweiterte Sensor sofort fand

Block C prüft jetzt `docs/wissen/*.json`, also Wissen **bevor** daraus ein
Paket wird. Sechs weitere wirkungslose Ziele — und eines davon ist das
wichtigste Fundstück dieser Sitzung:

```
session.exercises  ← RUN-KRAFT-001, RUN-KRAFT-002 (QUELLE-04)
                     RUN-RE-001, RUN-RE-002, RUN-RE-004 (QUELLE-07)
```

Fünf Regeln aus zwei Quellen zielen auf die Übungsliste. Die Verordnung
**führt** eine Übungsliste — liest sie aber ausschließlich aus
`req.exercises` und nie aus Wissen. Das ist die fachliche Grundlage für den
offenen Punkt 2 und der lohnendste Anschluss im ganzen Projekt.

Was fehlt, ist nicht die Leitung, sondern die Angabe **welche** Übungen. Die
steht in den Notizen im Fließtext („schwere Lasten und kombinierte
Trainingsformen", „zwei bis drei Einheiten je Woche über sechs bis zwölf
Wochen") und **nicht im Feld `zahlen`**. Beim Einspeisen wurden die Zahlen
gelesen, verstanden, zusammengefasst — und nicht maschinenlesbar erfasst.

### 35.3 Notizen dürfen abgewiesen sein, ohne rot zu machen

Fünf der elf Notizdateien weist der Vertrag ab: vier warten auf Inhalt
(QUELLE-01, -02, -03, -06), eine ist bewusst abgelehnt (QUELLE-10). Der Test
nennt sie einzeln und zählt sie, wertet sie aber nicht als Fehler. Eine
wartende Notiz ist kein Defekt — sie rot zu färben hieße, den Unterschied
zwischen „noch nicht da" und „kaputt" einzuebnen, den dieses Projekt an
anderer Stelle mühsam verteidigt.

### 35.4 Zwei eigene Fehler, beide vom Werkzeug gefangen

**Die Karteileichen-Prüfung stand im falschen Block.** Nach der Erweiterung
hielt sie jede Notizquittung für überflüssig — sie verglich die Quittungen
nur gegen die Paketziele. Der Test meldete das selbst, bevor irgendetwas
ausgeliefert war. Sie steht jetzt in Block C, wo beide Mengen bekannt sind.

**Probe ZR6 war zuerst wirkungslos.** Sie zielte auf `plan.erwartungsrahmen`
— das kommt AUCH in einer Notizdatei vor und bleibt deshalb bekannt, wenn man
es aus dem Paket entfernt. Ergebnis: `wrong_test`. Jetzt zielt sie auf
`experienceTier`, das es nur im Paket gibt. Ohne den `wrong_test`-Status des
Werkzeugs hätte diese Probe für immer grün gemeldet, ohne je etwas zu prüfen.

### 35.5 Stand

- `knowledge_targets_test.mjs`: Block C (Notizen) + Umbau der
  Karteileichen-Prüfung, 11 Zusicherungen
- `_ziele-ohne-leser.json`: 35 Quittungen — davon **25 inhaltlich korrigiert**:
  die Begründungen sagten „Analysegröße der running-capacity-factory", und die
  Factory liest sie nicht
- Probenkatalog `knowledge-targets`: 4 → **6 Proben**, alle schlagen an
- **Kein Produktivcode der App geändert**
- Gesamtsuite **258/0** bei 7 übersprungenen (265 Dateien)
- **130 Proben in 16 Katalogen**, 126 gefahren / 4 übersprungen
- Kohorten-Pin `023ee59b` unverändert, Wissensmodule vor/nach gehasht: unverändert

### 35.6 Was als Nächstes wirklich lohnt

1. **Zahlen in den Notizen nachtragen** (`zahlen`-Block). Sie stehen bereits
   im Text; es ist Erfassungsarbeit, kein Neubau, und danach haben mehrere
   Regeln Werte.
2. **`session.exercises` aus Wissen lesen.** Danach greifen fünf Regeln aus
   zwei Quellen, und Punkt 2 ist gelöst.
3. Erst dann stellt sich die Frage nach dem Verdrahten überhaupt wieder.
