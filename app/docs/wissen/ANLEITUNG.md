# Wissen in ORVIA einspeisen

Kurzanleitung. Du brauchst kein Verständnis des Wissensvertrags — das Werkzeug
sagt dir bei jedem fehlenden Punkt, was zu tun ist.

---

## Der schnellste Weg: du schickst mir die Notiz

Wenn du gerade keine Lust auf Terminal hast:

1. Kopiere `BEISPIEL-gym.json`, trage deine Quelle ein
2. Lade die Datei hier in den Chat hoch — oder leg sie in
   `Claude/Projects/Strava/docs/wissen/`
3. Ich prüfe sie, melde was fehlt, und erzeuge das Wissenspaket

Das funktioniert auch vom Handy aus.

**Noch schneller:** schreib mir einfach den Link zum Video plus deine
Zusammenfassung in eigenen Worten. Ich gieße es ins Format, du prüfst, ob ich
deine Aussage richtig getroffen habe. Die Zusammenfassung muss aber von **dir**
kommen — das ist der ganze Punkt der Sache.

---

## Der eigenständige Weg: am Mac im Terminal

```bash
cd ~/Claude/Projects/Strava/app

# 1. Vorlage kopieren
cp docs/wissen/BEISPIEL-gym.json docs/wissen/mein-video.json

# 2. ausfüllen (in einem Editor deiner Wahl)

# 3. prüfen — schreibt nichts
node tools/knowledge-ingest.mjs docs/wissen/mein-video.json

# 4. wenn alles grün ist: Module erzeugen
node tools/knowledge-ingest.mjs docs/wissen/mein-video.json \
     --schreiben --technisch-geprueft "Gian Thaysen"
```

---

## Was du je Quelle brauchst

| Feld | Was rein muss |
|---|---|
| `id` | eigene Kennung, beginnt mit `SRC-`, z. B. `SRC-COACH-MEIER-2025` |
| `art` | `video`, `coachvideo`, `coach`, `coachprogramm`, `lehrbuch`, `verband`, `leitlinie`, `konsens`, `uebersichtsarbeit`, `metaanalyse`, `studie`, `rct`, `kohorte`, `review`, `praxissynthese` |
| `titel`, `wer`, `jahr` | Titel, Urheber, Jahr |
| `url` (oder `doi` / `pmid`) | wo man es wiederfindet |
| `sportarten` | `["gym"]`, `["running"]` … |
| `gilt_fuer` | für wen — „alle" ist selten richtig |
| `worum_gehts` | Thema, z. B. `["uebungsauswahl"]` |
| `qualitaet` | `hoch`, `mittel`, `niedrig`, `unklar` |
| `kernaussage` | **deine eigenen Worte**, max. 700 Zeichen |
| `grenzen` | was daraus ausdrücklich **nicht** folgt |
| `eigene_worte` | `true` — die Bestätigung, dass du es selbst formuliert hast |
| `geprueft_am` | `2026-08-13` |

## Was du je Regel brauchst

| Feld | Was rein muss |
|---|---|
| `id` | z. B. `GYM-SEL-001` |
| `thema` | `uebungsauswahl`, `satzzahl`, `pausenlaenge` … |
| `aussage` | ein Satz, max. 400 Zeichen — eine Regel, eine Aussage |
| `art` | `studie`, `evidenz`, `fachkonsens`, `coachkonsens`, `erfahrung`, `produktentscheidung`, `notfallregel` |
| `quellen` | `["SRC-COACH-MEIER-2025"]` |
| `gilt_fuer` / `nicht_fuer` | für wen ja, für wen nein (`[]` ist erlaubt, aber bewusst) |
| `unsicherheiten` | mindestens ein Punkt |
| `wenn_unsicher` | die vorsichtige Variante |
| `wirkt_auf` | `["session.exercises"]`, `["session.sets"]` … |

### Wenn die Regel eine konkrete Zahl vorgibt

Dann kommt `zahlen` dazu — mit Einheiten, Gültigkeitsbereich, Ausschlüssen,
Unsicherheit und **Sicherheitsgrenzen**. Ohne die wird sie abgelehnt: eine Zahl
ohne Sicherheitsgrenze ist keine Vorgabe, sondern ein Risiko.

---

## Die drei Regeln, die nicht verhandelbar sind

**1 · Eigene Worte.** Kein Transkript, keine abgeschriebenen Sätze. Fakten und
Zahlen darfst du frei verwenden — die sind nicht urheberrechtlich geschützt.
Fremde Formulierungen nicht. Deshalb die Längengrenze und `eigene_worte`.

**2 · Nichts wird freigegeben, nur weil es eingespeist ist.** Alles startet
ungeprüft. `--technisch-geprueft` bestätigt, dass du es angesehen hast — mehr
nicht. Eine wissenschaftliche Freigabe vergibt das Werkzeug nie.

**3 · Die Quellenart entscheidet über das Gewicht.** Ein Coachvideo erreicht
höchstens Klasse C, auch wenn du „Qualität: hoch" einträgst. Tausend
übereinstimmende Videos ergeben keine Klasse A — Verbreitung ist kein
Evidenzmaß. Das ist Absicht und lässt sich nicht umgehen.

---

## Was danach passiert

Das Werkzeug zeigt dir für jede Regel:

```
GYM-RUN-001  Klasse C · Confidence medium · Basis: Fach-/Coachkonsens
             · darf eine Zahl vorgeben
```

Und ob sie im Advisory-Modus ausgewählt würde. Damit siehst du sofort, ob deine
Quelle stark genug ist für das, was du damit vorhast.

---

## Wenn etwas nicht klappt

**„Die Datei ist kein gültiges JSON"** — meist ein Komma zu viel vor einer
schließenden Klammer. JSON ist da pingelig. Schick sie mir, ich sag dir wo.

**Viele Fehlermeldungen auf einmal** — das ist normal beim ersten Eintrag.
Jede Zeile sagt, was zu tun ist. Arbeite sie von oben nach unten ab.

**„technischer Prüfstatus: draft"** — ohne `--technisch-geprueft "Dein Name"`
wählt der Vertrag deine Regeln in jedem Modus ab. Das ist kein Fehler, sondern
der zweite bewusste Griff.
