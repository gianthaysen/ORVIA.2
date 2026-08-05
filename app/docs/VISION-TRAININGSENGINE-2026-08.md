# ORVIA · Vision Trainingsengine (North Star)

**Stand:** 2026-08-05 · **Quelle:** Produktvision des Eigentümers (mündlich/schriftlich)
**Status:** NORD-STERN-DOKUMENT — beschreibt das Zielbild, ist NICHT der Arbeitsplan.
Der verbindliche Arbeitsplan bleibt der eingefrorene `UMSETZUNGSPLAN-2026-08.md`;
verbindliche Einzelentscheidungen stehen in `ENTSCHEIDUNGEN-2026-08.md` (E-01…E-27).
Konflikte löst immer der Umsetzungsplan + Entscheidungsdokument, nie dieses Dokument.

---

## 1. Produktdefinition (löst die offene Frage aus E-19 auf → E-27)

ORVIA ist eine **universelle, wissenschaftlich fundierte Trainingsplattform für alle
26 hinterlegten Sportarten** — keine auf einen Nutzer zugeschnittene Hybrid-App.
Das persönliche Profil des Eigentümers ist ein Anwendungsfall, nie die Spezifikation.
Die Engine darf weder auf bestimmte Sportarten noch auf bestimmte Leistungsdaten
fest zugeschnitten sein.

Kernversprechen: *„Welche Einheit bringt diesen Athleten heute mit dem geringsten
unnötigen Risiko seinem wichtigsten Ziel am weitesten näher?"* — als permanentes,
sportübergreifendes Entscheidungssystem, nicht als statischer Plangenerator.

## 2. Sechs Architektur-Ebenen

```
Athletenmodell
      ↓
Universelle Training Engine
      ↓
26 Sport Intelligence Packs
      ↓
Cross-Sport Orchestrator
      ↓
Workout-, Plan- und Content-Generator
      ↓
Garmin, andere Geräte und ORVIA-App
```

Parallel: die **Wissensplattform** (Studien/Vorlesungen/Videos → Transkription →
strukturierte Claims → Evidenzbewertung/Wissensgraph → Retrieval → Engine + Erklärungen).

Verbindliche Trennung: **Wissen** (was sagt die Wissenschaft) ≠ **Entscheidung**
(was ist für diesen Nutzer heute sinnvoll) ≠ **Ausführung** (konkrete Einheit) ≠
**Darstellung** (Erklärung/Visualisierung) ≠ **Geräteintegration** (Übertragbarkeit).

## 3. Athletenmodell — drei Datenstufen, nie Leistungswerte vorausgesetzt

1. **Geschätzt** (Onboarding, Eingangstests)
2. **Gemessen** (Training, Geräte, Sensoren)
3. **Erlernt** (längerfristiger individueller Verlauf)

Jeder Wert trägt: Quelle, Zeitstempel, Konfidenz, Messqualität, Herkunft
(automatisch/manuell). → Bereits implementiert als E-02-Quellenprioritätsvertrag
(`source-contract.js`); die Vision skaliert dieses Prinzip auf alle Metriken.
Ein Anfänger ohne Uhr muss ORVIA vollwertig nutzen können.

## 4. Sport Intelligence Packs (26×, datengetrieben)

Jede Sportart erhält ein **Datenpaket** (nie einen eigenen Codepfad):
Sportdefinition · Leistungsdimensionen · Eingangstests · Trainingsziele ·
Trainingsmethoden · Workout-Bausteine · Belastungsmodell · Progressionsmodell ·
Periodisierungslogik · Technikmodell · Übungsbibliothek · Medienbibliothek ·
Regenerationsanforderungen · Verletzungs-/Risikomuster · Cross-Sport-Interferenzen ·
Wettkampf-/Matchmodell · **Garmin-Mapping** · wissenschaftliches Knowledge Pack.

**SSOT-Regel (verbindlich):** die Sportarten-Registry ist die einzige Quelle —
Sportlisten dürfen nirgends mehrfach hartcodiert sein. (Bekannte Alt-Schuld:
`ui.js` enthält hartcodierte Sportlisten, z. B. in der Ausdauer-Analyse —
Abbau in Phase 7+.)

## 5. Neutrales Workout-Schema (Vertrags-relevant JETZT — Phase 6, Vertrag Nr. 4/5)

ORVIA plant **nie direkt im Garmin-Format**. Internes neutrales Schema:

```
Workout = { sport_id, session_type, goal, blocks[] }
Block   = { type: warmup|work|recovery|repeat|exercise|cooldown|…,
            completion: {type: duration|distance|reps|open, value, unit},
            target: {type: pace|hr_zone|power|rpe|rir|weight|…, min?, max?, value?},
            iterations?, blocks?  (repeat verschachtelbar),
            sets?, repetitions?, rest_seconds?, exercise_id? }
```

Übertragung: `ORVIA-Schema → Device Capability Check → Garmin Training Adapter →
Garmin-Workout`. Weitere Adapter (Apple, COROS, Polar, Suunto, Wahoo, Zwift,
Concept2, Technogym) folgen ohne Schema-Änderung.

## 6. Cross-Sport Orchestrator + 6 Belastungskonten

Zielmodell — Belastung wird auf sechs Konten geführt:
1. kardiovaskulär · 2. systemisch · 3. muskulär nach Körperregion ·
4. orthopädisch-mechanisch · 5. technisch-koordinativ · 6. mental-kognitiv.

Dazu eine sportartenübergreifende **Interferenzmatrix** (z. B. schweres Beintraining →
Laufintervalle: hoch; lockeres Schwimmen → Oberkörperkraft: niedrig), langfristig
individualisierbar. Netto-Nutzen-Prinzip:
`Nutzen = Trainingsreiz − Ermüdungskosten − Interferenzkosten − Verletzungsrisiko`.

**Ehrlicher Ist-Stand:** implementiert ist heute die sRPE-/TRIMP-Teilmenge
(kanonische Lastserie). Kein Konto wird erfunden, solange die Datengrundlage fehlt.

## 7. Planungshierarchie

Makro (Monate–Jahre, Rückwärtsplanung vom Wettkampf) → Meso (3–6-Wochen-Blöcke) →
Woche (Reizverteilung auf reale Verfügbarkeit, Interferenzprüfung) → Tag
(Readiness-/Schmerz-/Zeit-Check → bestätigen / reduzieren / verschieben /
ersetzen / Regeneration / sperren). Readiness ist **einheitsspezifisch
gewichtet** (Beinstatus zählt für Intervalle, kaum für Oberkörper).

## 8. Drei-Schichten-Entscheidung (KI entscheidet nie allein)

1. **Deterministische Sicherheitsregeln** (blockieren, fail-closed)
2. **Statistische/adaptive Modelle** (Last, Progression, Prognose)
3. **KI-Interpretation und Erklärung** (begründen, Alternativen formulieren)

Die KI darf NICHT allein: Belastung festlegen, medizinische Risiken bewerten,
Safety-Grenzen überschreiben, Methoden erfinden, Pläne ohne Quellen ändern.
Jede Entscheidung wird auditierbar gespeichert (decision, reason_codes,
policy_version, knowledge_claim_ids, confidence).

## 9. Knowledge Engine (eigenes Programm, NICHT im Engine-Pfad zur V1)

RAG + strukturierter Wissensgraph + kontrollierte Entscheidungsregeln.
Studien/Vorlesungen werden zu strukturierten Claims zerlegt (Population,
Intervention, Outcome, Effektgröße, Limitationen, Evidenzklasse A–E, Quelle).
Conflict Engine für widersprüchliche Evidenz. Import nur durch Quality Gate
(Qualifikation → Extraktion → Klassifikation → Evidenz → Widersprüche →
Freigabe → versioniert). Urheberrecht: `content_licenses` verpflichtend vor Import.

**Ist-Stand:** `knowledge-contracts.js` v3 implementiert die strenge Miniatur
(Evidenzklassen, Review-Gates, Pflicht-Pinning, Hash-Invalidierung) — die Vision
skaliert dieses Konzept, ersetzt es nicht.

## 10. Garmin Capability Matrix (Level A–D je Sportart × Geräteklasse)

- **A** vollständig strukturiertes Workout (Laufen, Rad, Schwimmen, kompatible Kraft)
- **B** teilstrukturiert (Dauer, Blöcke, begrenzte Ziele; Details in ORVIA)
- **C** Aktivitäts-/Kalenderunterstützung (Planung + Anleitung in ORVIA, Aufzeichnung Garmin)
- **D** ORVIA-Ausführung (Video, Satz-/Wdh.-Führung, Timer; nachträgliche Zuordnung)

**Gym-Stufe-5-Zielpfad (Eigentümer-Entscheidung 2026-08-05):** ORVIA überträgt den
Kraftplan (Übungen, Sätze, Ziel-Wdh., Pausen) als strukturiertes Garmin-Kraft-Workout;
auf der Uhr werden nur kg + tatsächliche Wiederholungen eingegeben; HF/Dauer/Sätze
kommen über den Rückkanal. Voraussetzungen: Mapping auf Garmins festen FIT-Übungs-
katalog (Übungen außerhalb erscheinen generisch) + offizielle Training API.
**Der inoffizielle python-garminconnect-Worker bleibt Prototyp, nie Produktionsfundament.
Antrag Garmin Connect Developer Program früh stellen (externe Wartezeit).**

## 11. Reifegradmodell (verbindliche Ehrlichkeitsstruktur, → E-27)

| Stufe | Bedeutung |
|---|---|
| 1 | Tracking (erfassen, Dauer/Belastung, Wochenplanung, subjektives Feedback) |
| 2 | Trainingsplanung (Ziele, Progression, Vorlagen, Periodisierung) |
| 3 | adaptive Planung (Soll-Ist, individuelle Belastbarkeit, Auto-Anpassung) |
| 4 | volle Content-Unterstützung (Übungen, Videos, Technik, Tests, Begründungen) |
| 5 | Geräteausführung (strukturierte Workouts, Sensorintegration, Rückkanal) |

**Auswählbar ≠ voll unterstützt.** Jede Sportart trägt ihren dokumentierten Reifegrad.
**Zielreifegrad 5: Laufen, Radfahren, Schwimmen, Kraft/Gym** (Kernsportarten des
Eigentümers, E-27). Die übrigen 22 starten auf Stufe 1–2 mit generischem Fallback-Pack.
Ausbau seriell nach E-19: Laufen zuerst komplett, dann Rad → Schwimmen → Kraft.

## 12. Definition of Done der Engine-V1 (der Kreislauf)

ORVIA ist eine adaptive Training Engine — nicht vorher —, wenn dieser Kreislauf
real funktioniert:

1. Nutzer hinterlegt ein Laufziel.
2. ORVIA erstellt einen realistischen mehrwöchigen Plan.
3. Die Woche berücksichtigt Verfügbarkeit und Krafttraining.
4. Eine Einheit wird vollständig strukturiert erzeugt (neutrales Schema).
5. Das Workout wird an Garmin übertragen.
6. Der Nutzer führt es auf der Uhr aus.
7. ORVIA erhält die Aktivität zurück.
8. Intervalle, HF und Belastung werden analysiert (Soll-Ist).
9. Der nächste Trainingsschritt wird sichtbar und nachvollziehbar angepasst.

**Wichtigste Entwicklungspriorität:** einen Sport und einen vollständigen
Datenkreislauf zuerst fehlerfrei — Laufen mit Garmin — dann dieselbe Architektur
auf Rad, Schwimmen, Kraft erweitern.

## 13. Ausdrücklich SPÄTER (nicht im V1-Pfad)

- Knowledge-Import-Pipeline (Transkription, Claim Extraction, Wissensgraph, RAG)
- Übungs-/Videobibliothek in voller Tiefe, Animationen, Drill-Diagramme
- Bewegungsanalyse aus Nutzeraufnahmen (zusätzlich: DSGVO-Last, Kameravorbehalt)
- Female Athlete Logic (nur mit Einwilligung; besondere Datenkategorien)
- Weitere Geräte-Adapter (Apple, COROS, Polar, Suunto, Wahoo, Zwift, …)
- Route Planning / Fueling / Equipment / Environment Engine (Konzepte notiert)
- Individualisierte Interferenzmatrix (erst generisch, dann gelernt)

Diese Liste schützt den Kreislauf-Durchstich. Nichts davon darf V1 verzögern.
