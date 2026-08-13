# Bewertung der Bauplan-Kritik (ChatGPT) — Entscheidungsvorlage

Stand: 2026-08-07 · bezieht sich auf `docs/ENGINE-BAUPLAN-REST-2026-08.md`

Kennzeichnung der Aussagen: **[F]** gesicherter Fakt · **[A]** plausible Annahme ·
**[S]** Schätzung · **[B]** subjektive Bewertung · **[U]** offene Unsicherheit

---

## Kernergebnis

Die Kritik zerfällt in zwei Teile, die unterschiedlich behandelt werden müssen.

**Teil 1 — die fünf konkreten Korrekturen: vier davon sind richtig, eine ist
halb richtig.** Zwei davon sind echte Fehler in meinem Bauplan, keine
Geschmacksfragen. Ich übernehme sie.

**Teil 2 — die Zielarchitektur (Athlete Model, Response Model, Prediction
Layer, Learning Engine): als Endzustand richtig, als Bauliste jetzt falsch.**
Nicht weil sie zu ehrgeizig wäre, sondern weil sie Daten voraussetzt, die die
App heute nicht erhebt — teils nicht erheben *kann*. Ein Response Model, das
nach acht Wochen behauptet zu wissen, auf welche Reize du besonders ansprichst,
erfindet diese Aussage. Das verstößt gegen Regel 2 des Bauplans („Kein
Schätzwert, der aussieht wie eine Messung") — und diese Regel steht dort, weil
genau dieser Fehler in diesem Projekt schon einmal Zeit gekostet hat.

**Der größte blinde Fleck der Kritik:** Sie fragt an keiner Stelle, woher die
Daten kommen. Sie nennt „Engine Confidence" als wichtigstes fehlendes Stück und
übersieht, dass Confidence keine Rechenschicht ist, sondern eine Eigenschaft der
Eingangsdaten. Der bindende Engpass ist die Datenpipeline, nicht die Architektur.

**Die eine Sache, die sofort passieren muss und in der Kritik fehlt:** ein
**Entscheidungs-Log**. Jede Planentscheidung mit ihren Eingaben protokollieren.
Kosten: ~1 Tag. Ohne das ist eine spätere Learning Engine nicht nachrüstbar,
weil ihr die Trainingsdaten fehlen. Mit dem Log bleibt sie jederzeit erreichbar.
Das ist die einzige Anforderung, die die Zielarchitektur *heute* an uns stellt.

---

## 1. Die fünf Korrekturen — Einzelbewertung

### (a) C1 soll `trainingState` liefern statt roher Rolling-Fenster
**Urteil: halb richtig — übernehmen, aber additiv, nicht ersetzend.**

Richtig: Der Designer soll keine rohen 7/14/28-Tage-Fenster interpretieren
müssen. Ein verdichteter Zustand ist die bessere Schnittstelle.

Falsch: Die rohen Fenster zu *ersetzen*. Zwei Gründe.

1. Eine abgeleitete Kennzahl, die man nicht zurückverfolgen kann, ist nicht
   debuggbar. Wenn der Plan nächste Woche seltsam aussieht, muss ich sehen
   können, welche Rohwerte zu `loadTrend: 'rising'` geführt haben.
2. Monotony und Strain (Foster) haben in Folgestudien deutlich schwächere
   Reproduzierbarkeit gezeigt als ihre Verbreitung vermuten lässt **[A]**.
   Sie dürfen nicht die *einzige* Sicht des Designers sein.

**Umsetzung:** `buildHistory()` liefert weiterhin `rolling` und `acuteChronic`
**und zusätzlich** `trainingState {loadTrend, consistency, monotony, strain,
sessionDensity, confidence}`. Der Designer konsumiert `trainingState`, die
Diagnose-Ansicht die Rohwerte. Monotony/Strain werden angezeigt, gehen aber
nicht in Planungsentscheidungen ein, solange ihre Evidenz so dünn ist.
Mehraufwand: +0,5 Tag.

### (b) +8 % ist ein Guardrail, keine Progressionsformel
**Urteil: vollständig richtig. Das ist ein echter Fehler in meinem Bauplan.**

Im Bauplan steht +8 % so, als wäre es die Regel, nach der der Umfang wächst.
Das ist falsch herum: Es ist die Obergrenze, die nie überschritten werden darf.
Die tatsächliche Steigerung soll so klein sein, wie es das Ziel zulässt.

Die Kritik untertreibt sogar noch. Die bekannte „10-%-Regel" ist nicht
evidenzbasiert: Die einzige größere randomisierte Studie dazu (Buist et al.,
2008, ~530 Laufanfänger) fand **keinen** Unterschied in der Verletzungsrate
zwischen einem stufenweise aufgebauten und einem Standardprogramm **[F]**.
+8 % ist also eine konservative Konvention, keine Messgröße. Umso deutlicher
gehört sie an die Decke und nicht in den Motor.

**Umsetzung:** `calculateProgressionCeiling({history, level, phase, goal,
adherence, recovery, injuryRisk})` — mit einer Korrektur an der von der Kritik
vorgeschlagenen Signatur: Rückgabe muss dreiwertig sein.
`{ceilingPct, driver, confidence:'ok'|'low'|'insufficient_data'}`. Bei
`insufficient_data` gilt der flache konservative Wert. Aufwand: +1 Tag.

### (c) Wiedereinstieg muss kontextabhängig sein
**Urteil: vollständig richtig. Zweiter echter Fehler.**

Flache 70 % sind in beide Richtungen falsch. Konkret:

| Kontext | Sinnvoller Wiedereinstieg | Grundlage |
|---|---|---|
| Pause mit Crosstraining (Rad/Schwimmen weitergelaufen) | 85–95 % | Aerobe Basis bleibt weitgehend erhalten **[A]** |
| Pause ohne Training < 2 Wochen | 75–85 % | VO2max-Verlust in 2 Wochen gering **[A]** |
| Pause ohne Training > 4 Wochen | 60–70 % | Detraining messbar **[A]** |
| Nach Infekt mit Fieber | Start 50 %, Freigabe erst nach symptomfreien Tagen | Vorsichtsprinzip, Myokarditis-Risiko **[F, Mechanismus]** |
| Nach Verletzung | **Kein Prozentwert.** Kriterienbasiert: Belastung X schmerzfrei, bevor Y | Prozentwerte ignorieren die Struktur **[B]** |

Die letzte Zeile ist der wichtige Punkt: Nach einer Verletzung ist ein
Prozentsatz vom letzten Niveau der falsche Begriff. Das ist eine
Kriterienprogression, kein Skalierungsfaktor.

**Umsetzung:** `returnContext {reason:'break'|'crossTraining'|'illness'|'injury',
days, crossTrainingLoad, symptomFreeDays}` → Faktor **oder** Kriterienpfad.
Aufwand: +1 Tag.

### (d) Periodisierung als adaptiver Korridor statt Kalenderschiene
**Urteil: richtig — mit einem Anker, den die Kritik vergisst.**

Der Ansatz passt zu etwas, das im Projekt schon steht: Die Planvarianten A/B/C
sind bereits ein Korridor und keine Schiene.

Was die Kritik nicht nennt: Ein Korridor ohne festen Punkt driftet. Es braucht
mindestens einen harten Anker, und es gibt genau einen, der das verdient — den
**Taper vor dem Wettkampf**. Das ist einer der besser belegten Bereiche der
Trainingswissenschaft: Metaanalytisch ergibt sich ein Fenster von rund 8–14
Tagen, Volumenreduktion etwa 40–60 %, **Intensität und Frequenz weitgehend
erhalten**, mit einem Leistungseffekt in der Größenordnung weniger Prozent
**[F]**. Das ist zu wertvoll, um es einem adaptiven Algorithmus zu überlassen.

**Umsetzung:** Alles vor T-14 ist Korridor. Taper und Wettkampfdatum sind Schiene.

### (e) Knowledge Packs als datengetriebenes JSON statt 26 JS-Dateien
**Urteil: richtig. Übernehmen — mit einer Ergänzung.**

26 JSON-Dateien ohne Schema sind 26 JS-Dateien ohne Typsicherheit. Es braucht
ein Schema plus Validator, der beim Testlauf jeden Pack prüft. Die
`sport-coverage-matrix.js` existiert bereits und ist der natürliche Ort dafür.

---

## 2. Die weiteren Einzelpunkte der Kritik

| Punkt | Urteil | Begründung |
|---|---|---|
| **C3 Debrief ist wichtiger als 2 Tage** | **Richtig — bester Punkt der ganzen Kritik** | Das Debrief ist die einzige Quelle für *gelabelte* Daten. Ohne es hat jede spätere Schicht keine Grundwahrheit. Neu veranschlagt: 4–5 Tage, und weit nach vorne. |
| `constraintConfidence` im Constraint-Modell | **Richtig** | Ein selbstberichtetes Knieproblem hat eine andere Belastbarkeit als eine ärztliche Diagnose. Gleiche Taxonomie wie bei den Zonen. |
| Gym-Transfer über *Anforderungen* statt Übungslisten | **Richtig, und konsistent** | Genau die Abstraktion, die schon das Kollisionsproblem gelöst hat: Muskelgruppen statt Sportartnamen. Jetzt: Anforderungen (unilaterale Kraft, Plantarflexion, Hüftstabilität, reaktive Kraft) statt Übungsnamen. |
| 10–20 Sätze/Woche zu pauschal für Hybridsportler | **Richtig** | Die Dosis-Wirkungs-Daten stammen überwiegend aus krafttrainierten Kohorten mit geringer paralleler Ausdauerlast **[F]**. Bei 60 km/Woche sind die Bein-Sätze aus dem Laufen nicht null. Fix ist billig: `load-profile` bildet Laufen bereits auf quads/hamstrings/glutes ab — die beiden vorhandenen Module müssen nur verbunden werden. |
| Garmin-Export ist Produkt-, keine Engine-Priorität | **Richtig — aber mit Gegenargument** | Stimmt: Der Export macht keinen Plan besser. Aber ein Plan, den du nicht mitnehmen kannst, wird seltener ausgeführt — und nicht ausgeführte Pläne erzeugen kein Debrief, was alles Nachgelagerte aushungert. Deshalb *nicht* ganz nach hinten, sondern hinter C3. |
| **G1 soll nach C1 kommen** | **Falsch. Begründung unten.** | |

### Warum G1 vor C1 bleibt

Das Argument der Kritik lautet: C1 arbeitet auf vorhandenen Aktivitätsdaten,
braucht G1 also nicht. Das stimmt — und ist trotzdem irrelevant.

C1 liefert eine Lastbilanz. Aus einer Lastbilanz allein lässt sich **kein
Intensitätsziel** ableiten; dafür braucht es Zonen, und Zonen kommen aus G1.
Ohne G1 produziert C1 eine korrekte 28-Tage-Bilanz, die **nichts Sichtbares
verändert**: Intensität, Zielprognose, Wochenkilometer und Tagesziele bleiben
bei „—". Das ist exakt die Beschwerde, die diesen ganzen Umbau ausgelöst hat.

Nach Hebel pro Aufwandstag:

- G1: 2–3 Tage → schaltet vier sichtbare Felder frei
- C1: 3–4 Tage → schaltet korrekte, aber unsichtbare Interna frei

Dazu ein zeitliches Argument: Historie braucht Kalenderzeit. Wenn die Tests und
Bestzeiten heute erfasst werden, sind sie vorhanden, sobald C1s Historie lang
genug ist, um überhaupt zu tragen. Umgekehrt nicht.

**Zugestandenes Gegenrisiko [U]:** Wenn die Maske gebaut und nie ausgefüllt
wird, war sie umsonst. Deshalb ist Bedingung für G1, dass die
Anfänger-Testprotokolle aus `TEST_PROTOCOLS` direkt in der Maske stehen — der
leere Zustand muss in einer einzigen Sitzung füllbar sein.

---

## 3. Die Zielarchitektur — was davon trägt

### Confidence Engine
**Existiert bereits im Kern — der Vorschlag wäre eine Verschlechterung.**

`performance-zones` unterscheidet heute `measured` > `derived` > `estimated` >
`none` plus Staleness (fresh/aging/stale/very_stale). Die Kritik schlägt
Confidence **in Prozent** vor. Eine Prozentzahl suggeriert eine Genauigkeit, die
die zugrunde liegende Herleitung nicht hat: Es gibt keine Rechnung, die aus
„Wettkampfzeit vor 5 Wochen" seriös „78 %" macht. Vier ordinale Stufen plus
Alter sind die ehrliche Form.

**Was zu übernehmen ist, ist die Verallgemeinerung, nicht die Skala:** dieselbe
Taxonomie auf *alle* Engine-Eingaben ausdehnen — Constraints, Verfügbarkeit,
Historie. `constraintConfidence` aus der Kritik ist genau das.

### „Engine Confidence" als wichtigstes fehlendes Stück
**Teilweise einverstanden — aber nicht als neue Schicht.**

Die richtige Form ist nicht eine globale Prozentzahl, sondern eine Aussage **pro
Aussage**: Die Plankarte darf nicht „82 % Konfidenz" schreiben, sie muss
zeigen, welcher Teil dieser Empfehlung auf einer Messung beruht und welcher auf
einer Annahme. Der Marker `''` / `≈` / `~` macht das bereits — er ist nur nicht
überall angeschlossen.

Das Fehlende ist also **Abdeckung, keine Maschinerie**: den vorhandenen Marker
an jede angezeigte Zahl hängen (Prognose, Wochenkilometer, Tagesziele,
Intensität) plus eine „Was fehlt mir?"-Ansicht. Aufwand: 2–3 Tage statt einer
neuen Schicht.

### Response Model („welche Reize wirken bei dir")
**Als Bauliste jetzt abgelehnt. Rechnung dazu:**

Um zu belegen, dass ein Individuum auf Schwellentraining besser anspricht als
auf VO2max-Intervalle, muss der Effekt das Rauschen übersteigen.

- Test-Retest-Streuung eines 5-km-Zeitfahrens bei Trainierten: rund 1–2 % CV **[A]**
- Reale Anpassung über einen 4-Wochen-Block: rund 1–3 % **[S]**
- Signal-Rausch-Verhältnis also ungefähr 1

Bei einem SNR um 1 braucht die Unterscheidung zweier Protokolle in einer
n-of-1-Situation grob 8–10 gepaarte Beobachtungen für eine belastbare
Aussage **[S]**. Bei 4–6 Wochen je Block sind das **6–12 Monate pro Athlet** —
unter der Annahme, dass Schlaf, Krankheit, Arbeit und Ernährung nicht
dazwischenfunken, was sie tun werden.

**Was stattdessen jetzt geht: ein Toleranzmodell statt eines Responsemodells.**
Nicht „welcher Reiz macht dich schneller" (langsames, verrauschtes Signal),
sondern „welche Last verträgst du" — abgebrochene Einheiten, Schmerzmeldungen,
RPE bei gleicher Pace, HF-Drift. Dieses Signal ist größer und zeigt sich in
Tagen, nicht Monaten. Es ist ein Teilstück von C3 plus Constraint-Modell und
braucht keine neue Schicht.

### Fatigue Model mit vier getrennten Achsen
**Ein Viertel existiert, ein Viertel ist fast geschenkt, die Hälfte ist nicht messbar.**

| Achse | Status |
|---|---|
| muskulär | **Existiert** — `load-profile` mit 15 Gruppen und `RECOVERY_H` |
| metabolisch/systemisch | **Fast geschenkt** — fällt aus C1 mit ab |
| neuronal | **Nicht messbar mit vorhandenen Daten.** Proxys wären CMJ-Sprunghöhe, Griffkraft, HRV. HRV wäre über Garmin verfügbar, hat aber hohe Tagesstreuung und starke Störgrößen (Schlaf, Alkohol, Infekt) **[U]**. Zulässig als *Flag*, nicht als *Modell*. |
| mental | **Nur Selbstauskunft.** Ein Check-in-Feld, keine Modellierung. |

Das als „Fatigue Model" zu bezeichnen, überzeichnet zwei der vier Achsen.
Richtig ist: muskuläres Modell um eine systemische Achse aus C1 erweitern,
neuronal/mental als Check-in-Eingaben mit ausgewiesen niedriger Confidence.

### Decision Intelligence
| Teil | Urteil |
|---|---|
| **Priority Engine** (Zielkonflikte) | Existiert teilweise: `goal-portfolio.js`, `scheduler-goal-allocation.js`. **Review, kein Neubau.** |
| **Opportunity Engine** (situatives Umplanen) | **Fehlt wirklich, ist wertvoll und ist billig** — braucht *keine* neuen Daten. „Einheit gestern ausgefallen, morgen ist frei, verschiebe" ist ein Regelproblem auf vorhandenen Daten. **Hochstufen.** |
| **Risk Engine** mit Wahrscheinlichkeiten | **Ablehnen in dieser Form.** Das Beispiel („Achillessehne hoch — 4 schnelle Einheiten + wenig Schlaf + neue Schuhe") kombiniert drei Faktoren zu einer Aussage, für die es kein validiertes Modell gibt. Die prospektive Evidenz für ACWR-basierte Verletzungsvorhersage ist deutlich schwächer als die Verbreitung des Modells **[F]**; Schlafmangel und Vorverletzung sind die konsistentesten Einzelfaktoren, aber mit Effektstärken, aus denen sich keine Punktprognose bauen lässt **[A]**. **Vertretbar ist eine Musterwarnung ohne Wahrscheinlichkeit:** „Drei harte Einheiten in fünf Tagen bei zwei Nächten unter sechs Stunden" — das ist ein Fakt, keine Vorhersage. |

### Prediction Layer
**Hier verteidige ich die Kritik teilweise gegen meine eigene Skepsis.**

Das Beispiel „unrealistisch: benötigt +7 % Schwelle in 12 Wochen, verfügbar 5"
ist **gut und belegbar** — weil es kein Ergebnis vorhersagt, sondern eine
*benötigte Änderungsrate* gegen *dokumentierte Änderungsraten* hält.
Größenordnungen: Trainierte verbessern die Schwellenleistung pro 12-Wochen-Block
etwa 1–3 %, Anfänger im ersten Jahr deutlich mehr **[S]**. Daraus lässt sich ein
Machbarkeitskorridor bauen, der keine Prognose behauptet.

**Goal Feasibility ist der wertvollste einzelne Punkt der ganzen Kritik** und
kostet 2–3 Tage: Ziel (existiert) + aktuelle Schwelle (existiert nach G1) +
Literaturtabelle.

What-if ist ebenfalls billig **in der ehrlichen Form**: „Wenn du von 4 auf 5
Läufe gehst, sieht der Plan so aus" — das ist zweimal den Designer laufen
lassen. Nicht ehrlich wäre: „…dann bist du 3 Minuten schneller."

### Learning Engine
**Als Endpunkt richtig. Als Bauentscheidung heute: nur eine Anforderung.**

Sie muss jetzt nicht gebaut werden, sie darf nur nicht *verbaut* werden. Die
einzige Anforderung, die sie heute stellt, ist das **Entscheidungs-Log**: jede
Planentscheidung mit ihren Eingaben protokolliert, damit eine spätere Lernschicht
Trainingsdaten hat. ~1 Tag. Ohne das ist sie in zwei Jahren nicht nachrüstbar,
weil die Vergangenheit dann unwiederbringlich weg ist.

### Nicht in den Plan aufgenommen
Adaptive Ernährung, Schlafschuld über 14 Tage, Hitze-/Höhen-/Reiseadaptation,
Wetter-Engine, „datenbasierte Motivation".

Begründung: Jedes dieser Themen erzeugt Aussagen, deren Genauigkeit die
Eingangsdaten nicht hergeben. Schlafschuld ohne validierte Schlafmessung, Hitze-
adaptation ohne Kerntemperatur, Ernährungssteuerung ohne Wiegeprotokoll —
das produziert Zahlen, die aussehen wie Messungen. Ausrüstungs-Intelligenz
(Schuh-Kilometer) ist die Ausnahme: billig, ehrlich, mechanistisch plausibel —
allerdings ist die Evidenz für eine feste Kilometergrenze schwach **[U]**, also
als Hinweis, nicht als Verfallsdatum.

---

## 4. Revidierte Reihenfolge

| # | Baustein | Aufwand | Änderung ggü. Bauplan |
|---|---|---|---|
| 1 | **G1 Erfassungsmaske** | 2–3 T | unverändert vorn (Kritik widersprochen) |
| 2 | **C3 Debrief** | 4–5 T | **vorgezogen, Aufwand verdoppelt** |
| 3 | **Entscheidungs-Log** | 1 T | **neu** — Voraussetzung für alles Lernende |
| 4 | **C1 load-history + `trainingState`** | 3,5–4,5 T | Korrektur (a) |
| 5 | **C2 Progression: `progressionCeiling` + `returnContext`** | 2,5–3 T | Korrekturen (b) + (c) |
| 6 | **Goal Feasibility** | 2–3 T | **neu, aus der Kritik** |
| 7 | **Opportunity / Umplanung** | 2–3 T | **neu, aus der Kritik** |
| 8 | **D1 constraint-model + `constraintConfidence`** | 3–4 T | ergänzt |
| 9 | **F1 Export Ausdauer** | 2 T | vorgezogen (Ausführungsargument) |
| 10 | **E1/E2/E3 Packs als JSON + Schema** | 8–12 T | Korrektur (e), Aufwand gesenkt |
| 11 | **E4 Periodisierung als Korridor mit Taper-Anker** | 3–4 T | Korrektur (d) |
| 12 | **H1/H1b/H2/H3 Gym + Kraft-Export** | 11–15 T | H1b nach Anforderungen statt Übungslisten |
| 13 | F2 Push | 2–3 T | unverändert |

**Neue Summe: 47–63 Arbeitstage ≈ 16–21 Wochen** bei 2–3 h/Tag.
Vorher 40–55 Tage. Der Zuwachs kommt aus C3 (+3), drei neuen Punkten (+5 bis +7)
und den Korrekturen (+2,5) — abzüglich der Ersparnis bei den JSON-Packs.

---

## 5. Zur Bewertung „8,7/10"

Eine Note ohne genannte Skala ist keine Information. Die relevante Frage ist
nicht, wie gut der Plan ist, sondern welche Teile davon in sechs Monaten noch
richtig sind.

Fachlich ist die Kritik überdurchschnittlich: Sie findet zwei echte Fehler
(+8 %, flache 70 %) und einen echten Priorisierungsfehler (C3 unterbewertet).
Das ist mehr, als die meisten Reviews leisten.

Ihre Schwäche ist systematisch: Sie argumentiert von der Architektur her, nicht
von den Daten her. Deshalb landet sie bei Schichten, die ohne Datenpipeline
leerlaufen, und übersieht das Entscheidungs-Log, das genau diese Schichten
später überhaupt erst ermöglicht.
