# Umsetzungsplan · Punkt 2 — die Satzsumme je Muskelgruppe

**Stand: 2026-08-13, nach v8-350.** Grundlage ist der gemessene Zustand des
Repos, nicht die bisherige Beschreibung in `STAND-UND-OFFENE-PUNKTE.md` — die
war an einer entscheidenden Stelle falsch (§0).

---

## 0 · Korrektur, die alles Weitere verschiebt

`_ziele-ohne-leser.json` führt seit v8-344 zu `plan.saetze_je_muskelgruppe`
den Text *„wöchentlicher Umfang je Muskelgruppe — braucht einen Leser im
Wochenplan (scheduler-v2)"*. In v8-349 habe ich das übernommen und in drei
weitere Dateien geschrieben (`sw.js`-Kopf, Bauplan §39.5, Zielvokabular).

**Die Quelle sagt etwas anderes.** Wörtlich aus dem Paket, Regel GYM-HYP-002:

| Feld | Inhalt |
|---|---|
| `statement` | „fünf bis sechs Sätze pro Muskelgruppe **und Einheit**, verteilt über alle Übungen, die diese Muskelgruppe belasten" |
| `inputUnits` / `outputUnits` | „Sätze pro Muskelgruppe und **Trainingseinheit**" |
| `allowedTransformation` | „keine — und ausdrücklich KEINE Umrechnung auf Sätze je Übung. **Diese Zahl darf `session.sets` nicht speisen.**" |
| `uncertainties` | „Keine Angabe zur Wochenfrequenz, ohne die eine Satzzahl je Einheit wenig aussagt" |

**Folge für die Planung:** Der Anwender ist **nicht** die Wochenplanung. Er ist
die **Einheit** — genauer: die Stelle, an der die Übungen einer Einheit
feststehen. Punkt 2 ist damit kein Scheduler-Problem, sondern ein
Zusammensetzungs-Problem. Das macht ihn kleiner und den Weg dorthin anders.

Die Einspeisung selbst war korrekt; der Fehler steckt nur in meinem
Begleittext. **Vollständig korrigiert in v8-350** (Bauplan §40): alle vier
Stellen, kein Modul unter `js/` angefasst.

---

## 1 · Aktueller Zustand, gemessen

| | |
|---|---|
| Übungsliste für Gym | existiert **nicht** im Scheduler. `deriveRequirements` erzeugt `strength_general` ohne `exercises` → Flag `no_exercise_list_generic_session` |
| Übungsliste aus Wissen | möglich seit Vertrag v7 (`_ausWissenListe('session.exercises')`), aber **das Gym-Paket hat keine solche Regel**. Die sechs Regeln mit `session.exercises` stammen aus den Lauf-Notizen |
| Übungsliste vom Nutzer | **existiert**: `plannedExercises` je Einheit im Wochenplan-Editor, mit `sets`, `minReps`/`maxReps`, `restSeconds`, `exerciseId` — Vertrag `strength-plan@1` |
| Muskelzuordnung | **existiert**: `gym-volume.musclesFor(ex)` — 85 Namens-, 20 ID-, 16 Muster-Einträge, 15 Muskelgruppen. Unbekannt ⇒ `null`, **keine erfundene Zuordnung** |
| Satzzählung | `gym-volume.computeMuscleVolume` rechnet auf **Snapshots absolvierter** Workouts (`set.completed === true`). Für geplante Sätze gibt es **keinen** Zähler |
| Zielkorridor | `gym-volume.CORRIDORS` — **wöchentlich**, z. B. hypertrophy/intermediate 6–12, Quelle `conservative_start:…`, also **Produktwert ohne Beleg** |

### Der Konflikt, der dabei sichtbar wird

ORVIA führt zu demselben Gegenstand bereits **zwei Zahlen** mit
verschiedenen Bezugsgrößen und verschiedener Belegbarkeit:

```
Produktwert (gym-volume.CORRIDORS)   6–12 Sätze je Muskelgruppe und WOCHE
                                     Quelle: keine, "conservative_start"

Quelle (GYM-HYP-002, Friedmann 2007) 5–6 Sätze je Muskelgruppe und EINHEIT
                                     Klasse B, Governance: technisch geprüft,
                                     wissenschaftlich ungeprüft
```

Sie widersprechen sich nicht automatisch — sie sind über die Wochenfrequenz
verbunden, und genau die nennt die Quelle **nicht** (steht so in
`uncertainties`). Gerechnet:

| Einheiten/Woche | 5–6 je Einheit ergibt/Woche | liegt im Produktkorridor 6–12? |
|---|---|---|
| 1 | 5–6 | knapp darunter/darin |
| 2 | 10–12 | am oberen Rand |
| 3 | 15–18 | **darüber** |
| 4 | 20–24 | **deutlich darüber** |

Wer die Quellenzahl anzeigt, ohne den Korridor daneben zu erklären, baut zwei
Wahrheiten in dieselbe App. **Das ist die eigentliche Entscheidung in Punkt 2**
— nicht die Technik.

---

## 2 · Zielzustand

Eine geplante Krafteinheit, deren Übungen feststehen, wird gegen die
Quellenzahl **geprüft** und das Ergebnis mit Herkunft angezeigt:

```
Krafttraining · Mo
  Kniebeuge      4 × 8
  Beinpresse     3 × 10
  Beinbeuger     3 × 12
  ℹ Quadrizeps 7 Sätze — die Quelle nennt 5–6 je Muskelgruppe und Einheit
    [Klasse B · GYM-HYP-002]
    ↳ gilt nicht für: krafttraining_anfaenger, kinder_jugendliche, akute_verletzung
    ↳ im Zweifel: am unteren Rand bleiben
  ⏺ 2 Übungen nicht zuordenbar — nicht mitgezählt
```

**Was der Zielzustand ausdrücklich NICHT ist:**

- keine erfundene Übungsauswahl (die Factory sagt heute schon: „Übungsliste
  folgt aus dem Kraft-Pack — keine erfundene Übungsauswahl")
- keine Speisung von `session.sets` aus dieser Zahl — die Quelle verbietet es
  wörtlich
- keine automatische Korrektur des Nutzerplans. Die Zahl ist Klasse B und
  wissenschaftlich ungeprüft; sie **informiert**, sie greift nicht ein
- kein stilles Weglassen unklassifizierter Übungen — was nicht zugeordnet
  werden kann, wird **genannt**, nicht ignoriert

---

## 3 · Die Wegentscheidung: woher kommt die Übungsliste?

| | Weg | Ertrag | Risiko | Bewertung |
|---|---|---|---|---|
| **A** | **Nutzerplan** — prüfen, was in `plannedExercises` steht | sofort wirksam für jeden, der Übungen plant; keine Erfindung; nutzt vorhandene, getestete Bausteine | Nutzer ohne geplante Übungen sehen nichts | **empfohlen** |
| B | Produkt-Standardliste je Einheitentyp | Scheduler liefert immer Übungen | eine erfundene Auswahl im Gewand einer Empfehlung. Müsste als `product_policy`/Klasse D deklariert und sichtbar gemacht werden. Genau das Muster, das v8-336 aus der Factory entfernt hat | **abgelehnt** |
| C | Gym-Kraft-Pack mit `auswahl`-Regel (Vertrag v7 kann es) | die saubere Lösung; Scheduler bekäme belegte Übungen | **recherchiert 13.08.: es gibt keine solche Quelle** — siehe §10 | **nicht erreichbar** |
| D | gar nichts tun | — | die eine freigegebene Zahl bleibt ohne Anwender | — |

**Empfehlung: A jetzt, C wenn eine Quelle vorliegt.** A und C schließen sich
nicht aus — der Prüfer aus A funktioniert unverändert weiter, wenn die Liste
später aus einem Pack statt vom Nutzer kommt. B würde die Sperre, die ORVIA
sich selbst gegeben hat, von innen aufmachen.

---

## 4 · Umsetzung in Schritten

### Schritt 1 · Vorprüfung — **ERLEDIGT, gemessen 2026-08-13**

Gemessen wurde gegen die **ausgelieferte Übungsbibliothek** (78 Systemübungen
aus `supabase/migrations/0003` + `0006`, mit Slug, Name und Bewegungsmuster),
jede Übung einzeln durch `gym-volume.musclesFor` geschickt:

| Weg | Treffer |
|---|---|
| über den **Namen** (85 Einträge in `NAME_MUSCLES`) | 23 |
| über den **Slug** (20 Einträge in `EXERCISE_MUSCLES`) | 3 |
| über das **Bewegungsmuster** (16 Einträge in `PATTERN_MUSCLES`) | **45** |
| gar nicht | 7 |
| **Potenzial** | **71 von 78 = 91 %** |

**Aber so kommt es nicht am Bildschirm an.** `plannedExercises` führt laut
`strength-plan@1` ausschließlich `exerciseId` (UUID). Aufgelöst wird sie über
die Übungsbibliothek im Browser — und `gmExLibEnsure` speichert je Übung nur:

```js
map[e.id] = { name: e.name || null, slug: e.slug || null };
```

Das **Bewegungsmuster fehlt in diesem Zwischenspeicher**. Damit bleiben genau
die 45 Übungen liegen, die daran hängen:

| Datenlage | zuordenbar |
|---|---|
| Name + Slug (heutiger Stand) | **26 von 78 = 33 %** |
| Name + Slug + Bewegungsmuster | **71 von 78 = 91 %** |

**Befund:** Das Abbruchkriterium (60 %) wird heute **verfehlt** — aber nicht,
weil die Zuordnung schlecht wäre, sondern weil **ein Feld im Zwischenspeicher
fehlt**. `exerciseRepository.list()` holt ohnehin `select('*')`, das Feld
`movement_pattern` ist in der Antwort also **schon enthalten** und wird beim
Zwischenspeichern weggeworfen.

**Folge für den Plan: ein Schritt 1b davor.**

### Schritt 1b · Das Bewegungsmuster mitführen

`gmExLibEnsure` speichert zusätzlich `movementPattern`. Dazu:

- der Zwischenspeicher in `localStorage` bekommt eine **Formatversion** —
  ein alter Eintrag ohne Muster darf nicht als „kein Muster" gelesen werden,
  sonst bleibt die Quote nach dem Update genauso niedrig und niemand sieht warum
- `musclesFor` wird mit dem aufgelösten Objekt gefüttert
  (`{exerciseId, name, slug, movementPattern}`), nicht mit der nackten UUID

Aufwand: klein. Wirkung: 33 % → 91 %. **Ohne diesen Schritt ist der Prüfer aus
Schritt 3 nicht sinnvoll baubar.**

**Nebenbefund, gesondert zu bewerten:** Die Datenbank führt in
`exercise_muscles` bereits eine **eigene, übungsgenaue Muskelzuordnung** —
gepflegt in derselben Migration. `gym-volume` hat davon unabhängig drei
hartcodierte Tabellen. Das sind zwei Wahrheiten zum selben Gegenstand, und die
Datenbank ist die genauere (je Übung statt je Bewegungsmuster). Sie zu
benutzen wäre die sauberere Lösung, ist aber ein eigener Umbau mit
Offline-Frage (die Tabellen liegen im Browser, die Datenbank nicht immer).

### Schritt 2 · Der Zähler auf GEPLANTEN Sätzen

Neues, reines Modul `js/engine/planned-volume.js` (`planned-volume@1`):

```
plannedMuscleSets(exercises, opts) →
  { byMuscle: { quads: { directSets, indirectSetEquivalents, effectiveSets,
                         contributions:[{exerciseId, sets, relationship, coefficient}] } },
    unclassified: [{ exerciseId, name, sets }],
    version: 'planned-volume@1' }
```

- nutzt `gym-volume.musclesFor`, `coeffOf`, `roleOf` — **keine zweite
  Zuordnungstabelle**, sonst gibt es zwei Wahrheiten wie schon zweimal zuvor
- rein: keine Uhrzeit, kein Zufall, kein Speicher. Gleicher Input ⇒ gleicher Output
- fail-closed: `sets` fehlt ⇒ Übung zählt **nicht** und erscheint in
  `unclassified` mit Grund. Kein Default 3 — `strength-plan@1` verbietet es

**Warum ein eigenes Modul und nicht in `gym-volume`:** dort geht es um
*absolvierte* Sätze mit `completed`-Prüfung und Ausschlussgründen. Ein
geplanter Satz hat keinen dieser Zustände. Die Funktionen zu vermischen hieße,
in `computeMuscleVolume` eine zweite Bedeutung von „Satz" einzuführen.

### Schritt 3 · Der Anwender in der Verordnung

In `prescription-factory`, nach dem Bau der Blöcke:

- `plan.saetze_je_muskelgruppe` aus `req.knowledge` lesen (`art: 'zahl'`)
- geplante Sätze je Muskelgruppe zählen (Schritt 2)
- je Muskelgruppe **außerhalb** des Bereichs: einen Eintrag in `hinweise`
  erzeugen — mit Regel-ID, Herkunft, Grenzen, Ausschlüssen
- `session.exercises` bleibt unberührt, `session.sets` erst recht

Damit wird `plan.saetze_je_muskelgruppe` zum **ersten Ziel, das als Zahl
angewendet wird, ohne eine Zahl vorzuschreiben** — es prüft eine. Das ist eine
neue Art von Anwender und gehört als solche im Zielregister benannt.

**Offene Vertragsfrage:** `GELESENE_ZIELE` heißt heute „wird als Wert
angewendet". Ein Prüfer ist etwas anderes als ein Setzer. Entweder das
Register bekommt zwei Klassen, oder der Sensor unterscheidet sie. Das ist vor
Schritt 3 zu entscheiden, sonst wird die Quittungsliste unscharf.

### Schritt 4 · Anzeige

`prescription-format.hinweisZeilen` kann es bereits — der Prüfbefund ist ein
Hinweis wie jeder andere. Zusätzlich in `ui.js`: die nicht zuordenbaren
Übungen sichtbar machen, damit „3 Sätze Quadrizeps" nicht heißt „ich habe
zwei Übungen übersehen".

### Schritt 5 · Der Korridor-Widerspruch

Erst hier, weil er ohne die Schritte davor nicht sichtbar wird:

- `CORRIDORS` bleibt, was er ist — ein **Produktwert**, und wird auch so
  beschriftet (heute steht `source: 'conservative_start:…'` nur im Objekt,
  nicht auf dem Bildschirm)
- die Quellenzahl bekommt ihre Bezugsgröße sichtbar mit: „je Einheit"
- die Verbindung zwischen beiden ist die Wochenfrequenz — und die nennt die
  Quelle nicht. Also wird sie **nicht gerechnet**, sondern benannt

---

## 5 · Betroffene Dateien

| Datei | Art der Änderung |
|---|---|
| `js/engine/planned-volume.js` | **neu** |
| `js/engine/prescription-factory.js` | Prüfer + Hinweiserzeugung; `GELESENE_ZIELE` |
| `js/ui.js` | unklassifizierte Übungen sichtbar machen |
| `js/gym-volume.js` | **unverändert** — nur Nutzung von `musclesFor` |
| `sw.js` | Version, Kopf, `ASSETS` um das neue Modul |
| `index.html` | Skript-Einbindung (wird von `batch2f`-Test erzwungen) |
| `supabase/tests/planned_volume_test.mjs` | **neu** |
| `supabase/tests/knowledge_targets_test.mjs` | Prüfer-Ziele gegen Setzer-Ziele |
| `supabase/tests/_ziele-ohne-leser.json` | Eintrag entfällt, wenn Schritt 3 steht |
| `app/tools/probes/planned-volume.json` | **neu** |

---

## 6 · Risiken

| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| **Zuordnungsquote zu niedrig** | Prüfbefund ist Rauschen, Nutzer verliert Vertrauen | **gemessen:** 33 % heute, 91 % nach Schritt 1b. Ohne 1b nicht bauen |
| **Alter Zwischenspeicher ohne Muster** | Quote bleibt nach dem Update bei 33 %, ohne dass jemand den Grund sieht | Formatversion im `localStorage`-Eintrag; alter Stand wird verworfen, nicht fehlgedeutet |
| **Zwei Zahlen auf zwei Bildschirmen** | Produktkorridor (Woche) und Quelle (Einheit) widersprechen sich scheinbar | Schritt 5; Bezugsgröße immer mitschreiben, nie umrechnen |
| **Register wird unscharf** | „gelesen" bedeutet plötzlich zweierlei | Vertragsfrage vor Schritt 3 entscheiden |
| **Klasse-B-Zahl wirkt wie Vorschrift** | Nutzer ändert seinen Plan wegen einer wissenschaftlich ungeprüften Zahl von 2007 | Hinweis, keine Sperre; Governance-Status sichtbar; Ausschlüsse an der Zeile |
| **Doppelte Zuordnungstabelle** | zwei Wahrheiten, die auseinanderlaufen | `musclesFor` wird benutzt, nicht kopiert — Probe darauf |
| **`_planEdit` liefert keine Sätze** | Zählung still zu niedrig | fail-closed: ohne `sets` keine Zählung, Übung erscheint in `unclassified` |

---

## 7 · Teststrategie

**Zusicherungen** (`planned_volume_test.mjs`):

- eine Übung mit 4 Sätzen auf `quads` direkt ⇒ `directSets = 4`
- zwei Übungen auf dieselbe Muskelgruppe ⇒ **Summe**, nicht Maximum
- indirekter Beitrag zählt mit Koeffizient, nicht voll
- unbekannte Übung ⇒ `unclassified`, **nicht** stillschweigend 0
- Übung ohne `sets` ⇒ `unclassified` mit Grund, kein Default
- gleicher Input zweimal ⇒ zeichengleiches Ergebnis

**Naht** (Erweiterung von `knowledge_hinweise_test.mjs`):

- geplante Einheit mit 7 Sätzen Quadrizeps + echtes Gym-Paket ⇒ genau ein
  Hinweis mit `GYM-HYP-002`, Klasse B, Ausschlüssen
- dieselbe Einheit mit 5 Sätzen ⇒ **kein** Hinweis
- ohne Wissen ⇒ kein Hinweis, auch bei 12 Sätzen
- `session.sets` bleibt in allen Fällen unverändert ← die Regel der Quelle

**Proben** (mindestens):

- der Prüfer speist doch `session.sets` ⇒ muss rot werden
- Summe wird zum Maximum ⇒ rot
- unklassifizierte Übungen verschwinden still ⇒ rot
- `musclesFor` wird durch eine eigene Tabelle ersetzt ⇒ rot

---

## 8 · Definition of Done

- [ ] Zuordnungsquote gemessen und dokumentiert (Schritt 1)
- [ ] `planned-volume@1` rein, fail-closed, eigener Test grün
- [ ] Prüfbefund erscheint als Hinweis mit Herkunft, Grenzen, Ausschlüssen
- [ ] `session.sets` und `session.exercises` nachweislich unverändert
- [ ] unklassifizierte Übungen sind auf dem Bildschirm sichtbar
- [ ] Registerfrage entschieden und im Sensor abgebildet
- [ ] `_ziele-ohne-leser.json` ist **leer** — oder der verbleibende Eintrag
      nennt einen anderen Grund als „kein Anwender"
- [ ] Korridor und Quellenzahl tragen ihre Bezugsgröße sichtbar
- [ ] Gesamtsuite grün, alle Proben schlagen an
- [ ] `sw.js`-Kopf nennt Befund, Entscheidung und die eigenen Fehler

---

## 9 · Was dieser Plan bewusst offen lässt

- **Die Übungsauswahl selbst** (Weg C). Sie braucht eine Quelle, keine
  Programmierung. Solange keine vorliegt, bleibt `no_exercise_list_generic_session`
  stehen — richtig so.
- **Die Wochenfrequenz.** Ohne sie ist die Satzzahl je Einheit begrenzt
  aussagekräftig; das sagt die Quelle selbst. Eine Frequenzregel wäre eine
  eigene Einspeisung.
- **Ob der Produktkorridor bleiben soll.** Eine unbelegte Zahl im Produkt ist
  ein eigener Befund. Er gehört bewertet, aber nicht nebenbei in diesem Schritt.


---

## 10 · Nachtrag 13.08.: Weg C ist nicht erreichbar

Gesucht wurde eine Quelle, die eine **Übungsauswahl** belegt. Das Ergebnis ist
ein Nein, und es ist wichtiger als die Quelle, die dabei gefunden wurde.

**Es gibt keine wissenschaftliche Arbeit, die eine konkrete Übungsliste
vorgibt.** Die Literatur zur Übungsauswahl ist prinzipienbasiert: sie sagt
*„mehrgelenkig betonen"*, nicht *„Kniebeuge, Bankdrücken, Rudern"*. Was in
Suchergebnissen wie eine Liste aussieht („7 beste Übungen für Läufer"), stammt
durchweg aus Blogs und Verkaufsseiten und hält die Qualitätsschwelle dieses
Projekts nicht.

### 10.1 Was stattdessen eingespeist wurde

**ACSM Position Stand 2009** (Med Sci Sports Exerc 41(3):687–708,
DOI 10.1249/MSS.0b013e3181915670, PMID 19204579) — `QUELLE-14`, drei Regeln:

| Regel | Aussage | Evidenzkategorie **der Quelle selbst** |
|---|---|---|
| GYM-AUSWAHL-001 | Schwerpunkt auf mehrgelenkigen Übungen | **A** (ihre höchste) |
| GYM-AUSWAHL-002 | große Muskelgruppen vor kleinen, mehrgelenkig vor eingelenkig | **C** (ihre schwächste) |
| GYM-AUSWAHL-003 | freie Gewichte **und** Maschinen; erst weit Fortgeschrittene betont freie Gewichte | A bzw. C |

Die Quelle stuft ihre eigenen Empfehlungen unterschiedlich ein — ausgerechnet
die Reihenfolgeregel trägt ihre schwächste Kategorie. Das steht bei jeder
Regel in `unsicherheiten`. Eine Quelle, die ihre schwachen Stellen selbst
benennt, darf man nicht dadurch entwerten, dass man sie glättet.

Einstufung durch den Vertrag: **Klasse C, Fachkonsens, qualitativ.**

### 10.2 Warum das die Übungsliste trotzdem nicht löst

`session.exercises` erwartet Übungskennungen. Die Quelle nennt Kategorien.
Der Schritt vom Prinzip zur konkreten Übung ist **nicht belegbar, nur
begründbar** — er bleibt eine Produktentscheidung, und damit bleibt Weg B
abgelehnt und Weg C unerreichbar.

### 10.3 Was daraus gebaut werden kann

Derselbe Weg wie §41: ein **Prüfer**. Die Übungsbibliothek führt je Übung
`category` (compound/isolation) und `movement_pattern` — das ist eine
Datenaussage, keine Erfindung. Eine selbst geplante Einheit lässt sich also
gegen das Prinzip prüfen:

- liegt der Schwerpunkt auf mehrgelenkigen Übungen?
- stehen sie vorn?

Prüfer, kein Erzeuger. Genau wie bei `plan.saetze_je_muskelgruppe`.

**Noch nicht getan:** die Notiz ist eingespeist und vertragsfest, aber **nicht
als Paket gebaut**. Dafür müsste das Gym-Paket aus QUELLE-05 + QUELLE-12 +
QUELLE-14 neu erzeugt und im Consumer neu gepinnt werden — ein bewusster
Schritt, der die laufende Gym-Kette anfasst.
