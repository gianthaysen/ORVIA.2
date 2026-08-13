# Umsetzungsplan · Wissensvertrag v6 → v7

**Stand 2026-08-13, vor der Umsetzung geschrieben.** Anlass ist §36 des
Bauplans: von 30 Zielen kommt eines an, und die Ursache sind zwei Grenzen der
Vertragsstruktur, nicht fehlende Verkabelung.

---

## 1 · Ist-Zustand

```
regel {
  outputs: [ziel, ziel, …]        ← mehrere Ziele erlaubt
  zahlen:  { bereich:{min,max}, ausgabe_einheit, … }   ← GENAU EINE Groesse
  claims:  [ {use:'quantitative', quantitative:{…}}, … ]
}
```

`knowledge-application._ausRegel` erzeugt **je Ziel** eine Vorgabe und nimmt
dafür den ersten essenziellen Claim mit freigegebener Zahl.

### Drei Befunde, zwei bekannt, einer neu

| | Befund | Folge |
|---|---|---|
| A | **Eine Zahl je Regel.** Reale Dosis ist mehrdimensional (4–5 Serien à 3–4 Wdh über 6–10 Wochen). | 8 Regeln nennen Zahlen im Text, 2 führen sie strukturiert |
| B | **Keine Listen.** Übungen sind kein Zahlbereich. | `session.exercises` (6 Regeln, 3 Quellen) ist nicht formulierbar |
| C | **NEU, beim Planen gefunden:** Hat eine Regel zwei Ziele und einen Zahl-Claim, bekommen **beide Ziele denselben Wert**. `RUN-KRAFTPROFIL-003` (`session.exercises` + `plan.stabilitaetsfokus`) und `GYM-HYP-003` (`session.last_prozent_1rm` + `session.repetitions`) sind bereits so gebaut. | eine Zahl landet an einem Ziel, für das sie nie gedacht war |

Befund C ist der eigentliche Konstruktionsfehler: **die Zahl hängt an der
Regel, nicht am Ziel.** A und B sind Folgen davon.

---

## 2 · Zielzustand

**Kernidee: Der Wert gehört zum Ziel.**

```
regel {
  outputs: ['session.sets', 'session.repetitions']
  zahlen: [
    { ziel: 'session.sets',        bereich:{min:4,max:5}, ausgabe_einheit:'Serien',       … },
    { ziel: 'session.repetitions', bereich:{min:3,max:4}, ausgabe_einheit:'Wiederholungen', … }
  ]
  auswahl: [
    { ziel: 'session.exercises', werte:['kniebeuge','ausfallschritt'], … }
  ]
}
```

- `zahlen` darf **Objekt** (alt, gilt für alle Ziele) **oder Liste** (neu, je Ziel) sein.
- `auswahl` ist die neue Wertart für Aufzählungen.
- Jede Größe wird beim Einspeisen zu einem **eigenen Claim** mit `appliesTo: [ziel]`.
- `_ausRegel` wählt je Ziel den Claim, dessen `appliesTo` dieses Ziel nennt;
  fehlt `appliesTo`, gilt er für alle Ziele — **exakt das heutige Verhalten**.

Damit ist Rückwärtskompatibilität keine Zusatzarbeit, sondern der Normalfall
des neuen Codes.

---

## 3 · Betroffene Dateien

| Datei | Änderung | Risiko |
|---|---|---|
| `knowledge-contracts.js` | `KNOWLEDGE_CONTRACT_VERSION` 6→7, `appliesTo` zugelassen, `listeSchemaValid` + `prescriptiveListAllowed` | **hoch** — Version geht in jeden Pin |
| `knowledge-ingest.js` | `zahlen` als Liste, neues `auswahl`, je Größe ein Claim | mittel |
| `knowledge-application.js` | Claim-Auswahl je Ziel über `appliesTo`; Listen als `art:'liste'` | mittel |
| `knowledge-consumer.js` | Pin `expectedKnowledgeContractVersion: 7`, neuer Paket-Hash | niedrig, aber Pflicht |
| `running-capacity-factory.js` | dieselben Pins (PINS-Block) | niedrig |
| `prescription-factory.js` | Leser für `session.exercises` (Liste), Register erweitern | mittel |
| `gym-knowledge-pack.js` | `packVersion`/`contentHash` nur falls Inhalt geändert wird | niedrig |
| Tests + Kataloge | neue Zusicherungen und Proben | — |

**Nicht angefasst:** `running-knowledge-pack.js` (rein qualitativ, keine Zahlen
zu migrieren), Scheduler, UI, Datenbank.

---

## 4 · Risiken und wie sie abgefangen werden

| Risiko | Abfang |
|---|---|
| **Bestehende Pakete blockieren**, weil die Vertragsversion im Pin steht | Pins in Consumer und Factory im selben Schritt nachziehen; `knowledge_consumer_test` prüft genau das |
| **Paket-Hashes ändern sich** und niemand merkt es | `packContentHash` neu berechnen und als Literal pinnen; der bestehende Test „der erwartete Paket-Hash steht als LITERAL im Consumer" schlägt sonst an |
| **Kohortenprüfung** wird rot | Bewusst über `ORVIA_REPIN_COHORT` neu setzen — nur, falls ein Kohortenmodul betroffen ist (erwartet: nein) |
| **Stilles Verhalten ändert sich** für Regeln mit mehreren Zielen (Befund C) | Genau das ist beabsichtigt. Eine Zusicherung hält fest, dass eine Zahl **nur** noch an ihrem Ziel landet |
| **Regression in 258 Testdateien** | Nach jeder Stufe volle Suite; kein Ausliefern bei einem einzigen Rot |
| **Neue Wertart wird zu großzügig freigegeben** | Listen durchlaufen dieselbe Autorisierung wie Zahlen (`prescriptiveNumberAllowed`-Logik), keine Sonderbehandlung |

---

## 5 · Reihenfolge

1. **Stufe 1 — Werte ans Ziel binden.** `appliesTo`, `zahlen` als Liste,
   Auswahl je Ziel in der Anwendung. Vertragsversion 7. Pins nachziehen.
   *Definition of Done:* eine Regel mit zwei Zielen und zwei Größen liefert
   zwei verschiedene Werte; die alte Form verhält sich unverändert.
2. **Stufe 2 — Listen-Wertart.** `auswahl`, `art:'liste'` in der Anwendung,
   Leser in `prescription-factory` für `session.exercises`, Register erweitern.
   *Definition of Done:* eine Verordnung übernimmt Übungen aus Wissen; ohne
   Wissen bleibt die Liste wie bisher (kein stiller Ersatzwert).
3. **Stufe 3 — Nachweis am echten Material.** QUELLE-07 (RUN-RE-003) mit den
   drei Größen erfassen, die im Text stehen, und messen, dass alle drei
   ankommen.

Jede Stufe: `node --check` → Zieltests → Mutationsproben → volle Suite →
Hashvergleich der Wissensmodule → erst dann ausliefern.

---

## 6 · Teststrategie

| Stufe | Neue Zusicherungen | Proben |
|---|---|---|
| 1 | Zahl landet nur am eigenen Ziel · alte Form unverändert · zwei Größen ergeben zwei Vorgaben · Vertragsversion im Pin wirkt | `appliesTo` entfernen → Wert landet an allen Zielen · Version zurückdrehen → Pin blockiert |
| 2 | Liste kommt in der Verordnung an · ohne Wissen unverändert · gesperrte Liste erzeugt keine Übungen | Autorisierung aushebeln → Test rot · Liste still ersetzen → rot |
| 3 | drei Größen aus einer echten Quelle erreichen drei Ziele | Größe entfernen → rot |

**Kein Ausliefern ohne:** volle Suite grün, jede neue Probe angeschlagen,
Wissensmodule vor/nach dem Probenlauf hashgleich.

---

## 7 · Definition of Done (gesamt)

- `KNOWLEDGE_CONTRACT_VERSION === 7`, alle Pins nachgezogen, Suite grün
- Eine Regel kann mehrere benannte Größen tragen, jede an ihrem Ziel
- `session.exercises` ist bedienbar und wird von der Verordnung gelesen
- Der Zielregister-Test zeigt eine **höhere** Quote als 1 von 30
- Bestehende Pakete und Tests verhalten sich unverändert, wo nichts geändert wurde
- Bauplan §37 hält Befund C und die Migration fest
