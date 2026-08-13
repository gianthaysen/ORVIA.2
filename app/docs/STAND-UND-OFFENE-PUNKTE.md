# ORVIA · Stand und offene Punkte

**Stand: v8-353, 2026-08-13** (v8-343 ist veröffentlicht, v8-344 bis v8-353 liegen bereit). Diese Datei ist der Einstiegspunkt für eine neue
Sitzung. Sie ersetzt keinen Verlauf — die Begründungen stehen vollständig in
`sw.js` (Versionsköpfe v8-329 bis v8-353) und in
`docs/ENGINE-BAUPLAN-REST-2026-08.md` (§22–§43).
Der Umsetzungsplan für v7 steht in `docs/PLAN-VERTRAG-V7.md`.

> **Am 13.08. wurde jede Zahl dieser Datei gegen ausgeführten Code geprüft.**
> Suite und Proben stimmten. Zwei Aussagen nicht: die Coverage-Matrix führte
> Gym als paketlos (in v8-342 korrigiert), und das Laufpaket läuft nicht „im
> Shadow-Modus", sondern erreicht überhaupt keinen Aufrufer.
>
> **Zurückgenommen:** v8-342 behauptete hier, der Kohorten-Pin sei nirgends
> maschinell geprüft. Das war falsch — `shadow_adaptive_test.mjs` prüft ihn
> seit v8-299 gegen `_acceptance-cohort.json`; die Suche hatte `.json` nicht
> erfasst. An derselben Stelle lag dafür eine echte Lücke, die v8-343
> schließt.

---

## Wo die Wissenskette steht

```
Quelle → knowledge-ingest → Vertrag v7 (advisory) → knowledge-application
      → knowledge-consumer → prescription-factory → prescription-format
      → scheduler-v2 → week-projection → Karte
```

Die Kette ist **vollständig und gemessen**. Beleg (v8-341, echte Module, echtes Paket):

```
ohne eigene Pausenangabe → rest_seconds 120
                           flags ["rest_aus_wissen:GYM-HYP-001", "produktwert:rpeKraft"]
ohne Wissen              → rest_seconds null   ← 120 s ist KEIN Default
mit eigener Angabe 240 s → bleibt 240          ← Wissen ergänzt, überschreibt nicht
```

### Abdeckung, ehrlich

| | |
|---|---|
| Sportarten mit Wissenspaket | **2 von 24** (Laufen: handgepflegt UND aus Notizen, Gym eingespeist) |
| davon wissenschaftlich geprüft | **0** |
| davon im Produktivweg gelesen | **2** (Gym; Laufen seit v8-353 über das Notizpaket) |
| Gym-Paket | 4 Regeln aus **einer** Übersichtsarbeit von 2007 |
| Laufpaket | 14 Regeln, rein qualitativ — sie kommen seit v8-349 als **Hinweis** auf der Karte an, nicht als Zahl (§39) |
| Ziele, die nirgends ankommen | **0 von 30** — gemessen, nicht abgeleitet (`knowledge_targets_test.mjs`) |
| davon bewusst gesperrt | **5**, alle mit Code `medical_safety_review_pending` |

Beide Zeilen stehen seit v8-342 auch maschinenlesbar in
`sport-coverage-matrix` (`knowledgePack` vs. `knowledgePackWired`) und werden
von `batch3b0_knowledge_test.mjs` C5/C6 gegen die Wirklichkeit erzwungen —
gegen die Pack-Module im Verzeichnis und gegen
`knowledgeConsumer.registrierteSportarten()`. Wer ein Paket hinzufügt, ohne
die Matrix nachzuziehen, bekommt einen roten Test.

---

## Offene Punkte, priorisiert

### 1 · Laufen verdrahten — **erledigt in v8-353**

> Seit v8-353 ist Laufen verdrahtet: `running-notizen-knowledge-pack` (17
> Regeln aus sechs Quellennotizen) hängt im `knowledgeConsumer`, 14 Aussagen
> kommen mit Herkunft auf der Laufkarte an, 3 bleiben medizinisch gesperrt.
> Das handgepflegte `running-knowledge-pack` bleibt bewusst draußen — es hat
> mit `running-capacity-factory` einen eigenen Konsumenten. Vollständig in §43.
>
> **Die alte Entscheidung war nicht falsch — ihre Voraussetzung hat sich
> geändert.** Bis v8-348 hätte Verdrahten nichts transportiert; seit v8-349
> transportiert derselbe Anschluss 14 belegte Aussagen. Was weiterhin fehlt,
> ist der **Zahlwert** — dazu die Analyse unten.

<details>
<summary>Die Analyse, die zur Zurückstellung geführt hatte</summary>

**teils erledigt (v8-349), der Rest ist Erfassungsarbeit**

**Was v8-349 geändert hat:** Die Formulierung „wirkt auf nichts" war nie
gemessen worden. Sie stammte aus einem Abgleich mit dem Zielregister — was
die Verordnung nicht als *Zahl* einbaut, galt als wirkungslos. Seit v8-349
misst `knowledge_targets_test.mjs` durch die echte Kette, und das Ergebnis
sieht anders aus:

```
30 Paketziele · 1 als Wert · 24 als Hinweis · 5 bewusst gesperrt
             ·  0 unerklärt verschwunden
```

Die 14 Laufregeln kommen als **Hinweis mit Herkunft, Grenzen und
Ausschlüssen** auf der Karte an. Was weiterhin fehlt, ist der Zahlwert — und
darauf bezieht sich alles Folgende. Die alte Analyse bleibt gültig, nur ihre
Schlussfolgerung war zu weit gefasst:

```
Regeln mit maschinenlesbarem Zahlwert
  Gym      2 von 4    (Pause, Sätze je Muskelgruppe)
  Laufen   0 von 14
```

Die 14 Laufregeln sind **rein qualitativ**. Ihr Feld `outputs` nennt
`experienceTier`, `dimensionBudgets.easy`, `safetyGateState` — aber **kein
Modul liest diese Namen**, auch `running-capacity-factory` nicht, für die sie
gedacht waren (null Treffer im Quelltext, geprüft am 13.08.). `outputs` ist
bei diesen Regeln eine Absichtserklärung, keine Schnittstelle.

Verdrahten würde also **keine Zahl** transportieren — es würde nur
`knowledgePackWired: true` in die Matrix schreiben. Deshalb bewusst **nicht
gebaut**. Die Aussagen selbst brauchen die Verdrahtung inzwischen nicht mehr:
sie erreichen die Karte über den Hinweisweg.

Was stattdessen möglich wäre, in aufsteigendem Ertrag:

| | Was zu tun ist | Ertrag |
|---|---|---|
| **Zahlen nachtragen** | Die Notizen enthalten Zahlen im Fließtext („zwei bis drei Einheiten je Woche über sechs bis zwölf Wochen"), aber nicht im Feld `zahlen`. Nachpflegen macht sie maschinenlesbar. | hoch, geringes Risiko |
| **Qualitative Leser** | Regeln wie „harte Tage nicht aufeinanderfolgend" als **Sperre** umsetzen statt als Zahl. Braucht pro Regel Code mit Belegbindung. | hoch, aber Neubau |
| **Verdrahten** | `PAKETE.running` eintragen. | **null**, solange keine Werte da sind |

</details>

### 2 · Die Satzsumme je Muskelgruppe — **Prüfer steht (v8-351), Auswahl offen**

> **Erledigt in v8-351:** Der Prüfer ist gebaut. Eine geplante Krafteinheit
> wird gegen GYM-HYP-002 geprüft; liegt eine Muskelgruppe außerhalb von 5–6
> Sätzen, steht der Befund mit Herkunft, Grenzen und Ausschlüssen auf der
> Karte. Neu: `planned-volume@1`, ein zweites Register `GEPRUEFTE_ZIELE`,
> Zuordnungsquote 33 % → 91 %. Vollständig in §41.
>
> **Offen bleibt** allein die Übungsauswahl für den Scheduler — sie braucht
> eine Quelle, keine Programmierung (Weg C unten).

<details>
<summary>Die Analyse, die dorthin geführt hat</summary>

**Richtung in v8-350 korrigiert**

> **Was hier falsch stand.** Bis v8-349 hieß es, `plan.saetze_je_muskelgruppe`
> sei ein **wöchentlicher** Umfang und brauche einen Leser im Wochenplan. Die
> Quelle sagt ausdrücklich *Sätze je Muskelgruppe und **Trainingseinheit***
> und verbietet die Umrechnung auf `session.sets` wörtlich. Damit ist Punkt 2
> **kein Scheduler-Problem**, sondern eines der Einheitenzusammensetzung.
> Vollständig in §40 und in `docs/PLAN-PUNKT-2-MUSKELGRUPPEN.md`.

Zwei Dinge fehlen, und nur eines davon ist Programmierarbeit:

| | Was fehlt | Woher es kommen müsste |
|---|---|---|
| **Übungsliste** | `scheduler-v2` leitet für Gym keine ab → `no_exercise_list_generic_session` | eine **Quelle** für Übungsauswahl (Vertrag v7 kann Aufzählungen). Eine erfundene Standardliste ist ausgeschlossen — die Factory sagt das wörtlich |
| **Zähler** | `gym-volume` rechnet auf Snapshots **absolvierter** Workouts (`completed === true`). Für **geplante** Sätze gibt es keinen Zähler | neues Modul `planned-volume@1`, das `gym-volume.musclesFor` benutzt statt eine zweite Zuordnungstabelle zu bauen |

**Der gangbare Weg** ist der Nutzerplan: `plannedExercises` existiert samt
Sätzen, `musclesFor` klassifiziert 85 Namen / 20 IDs / 16 Bewegungsmuster auf
15 Muskelgruppen. Daraus wird ein **Prüfer**, kein Setzer — er meldet, wenn
eine Muskelgruppe außerhalb von 5–6 landet, und ändert nichts.

**Vorgeschaltet und noch offen:** die Zuordnungsquote. `plannedExercises`
führt `exerciseId` als Datenbank-UUID, nicht als Slug — ob die Auflösung über
die Übungsbibliothek trägt, ist unbelegt. Unter ~60 % zuordenbar wäre der
Prüfer mehr Rauschen als Nutzen.

**Nebenbefund — erledigt in v8-352 (§42):** `gym-volume.CORRIDORS` stand als
„Ziel: 6–12/Woche" ohne Herkunft auf der Muskelkarte, während daneben jede
Zahl aus Wissen ihre Evidenzklasse trägt. Er heißt jetzt „Richtwert", nennt
seine Basis (`produktwert`) und seine Bezugsgröße; die Quellenzahl steht mit
ihrer eigenen Bezugsgröße daneben. Umgerechnet wird nicht — die Quelle nennt
keine Wochenfrequenz.

Die alte Zusicherung in `knowledge_consumer_test.mjs` bleibt gültig: sie
schlägt an, sobald der Scheduler Übungen liefert.

</details>

### 3 · Eingespeiste Laufregeln sind noch keine Module
`QUELLE-07` (Sperlich, 5 Regeln), `QUELLE-08` (Hoff, 2 Regeln) und `QUELLE-09`
(Hirschmüller, 1 Regel, medizinisch gesperrt) liegen nur als Notizdateien in
`docs/wissen/`. Sie sind vertragsgeprüft, aber nicht als
`running-knowledge-pack-*.js` geschrieben und nicht verdrahtet. Blockiert
durch Punkt 1.

### 3b · Die zwei Grenzen — **mit v7 aufgehoben**
Bis v8-346 galt: von 30 Zielen kommt eines an, und schuld waren zwei Grenzen
des Vertrags. Beide sind seit **v8-347 (Vertrag v7)** weg.

**Die eigentliche Wurzel** fand sich erst beim Planen: Der Wert hing an der
**Regel**, nicht am **Ziel**. Eine Regel mit zwei Zielen und einer Zahl gab
diese Zahl beiden Zielen — bei `session.last_prozent_1rm` + `session.repetitions`
hätte derselbe Bereich für Last und Wiederholungen gegolten.

```
ALT: eine Zahl, zwei Ziele  → beide {min:4,max:5} „Sätze"
NEU: zwei Größen            → 4–5 Sätze UND 3–4 Wiederholungen
```

Was v7 kann:

| | |
|---|---|
| **Mehrere benannte Größen je Regel** | `zahlen: [{ziel:'session.sets', …}, {ziel:'session.repetitions', …}]`. Mehrdimensionale Dosis ist erfassbar. |
| **Aufzählungen** | `auswahl: [{ziel:'session.exercises', werte:[…]}]` — mit denselben Pflichtangaben und derselben Autorisierung wie eine Zahl. |
| **Tippfehlerschutz** | Eine Größe für ein Ziel, das die Regel nicht nennt, wird beim Einspeisen abgewiesen. |
| **Rückwärtskompatibel** | Ein Zahlblock ohne `ziel` verhält sich exakt wie bis v6. Kein bestehendes Paket musste geändert werden. |

**`session.exercises` kommt an** — zum ersten Mal reicht die Kette von der
Quelle bis auf die Trainingskarte:

```
mit Wissen  → ["kniebeuge","ausfallschritt"]  flags exercises_aus_wissen:…
ohne Wissen → generische Einheit, unverändert
Übungen ohne Satzzahl → Verordnung GESPERRT statt geraten
```

**Offen bleibt die Erfassungsarbeit.** Acht Regeln nennen Zahlen im Text, zwei
führen sie strukturiert. Das ließe sich jetzt nachtragen — es verlangt aber
Zuordnungen (welche Größe auf welches Ziel?) und Sicherheitsgrenzen am echten
Quellenmaterial. Das ist deine Entscheidung, nicht meine; der Test weist die
Quote bei jedem Lauf aus.

### 4 · Konfliktlösung — **erledigt in v8-348**
Zwei gleichrangige Zahlbereiche, die sich überlappen, werden auf die
**Schnittmenge** eingeengt statt sich gegenseitig stumm zu schalten:

```
120–180 / 150–240  →  150–180   (eingeengtAus nennt beide Originale)
120–180 / 120–180  →  120–180   (bestätigtDurch, nichts eingeengt)
120–140 / 200–240  →  KEINE Vorgabe — Konflikt bleibt
```

Die Schnittmenge steht in **jeder** beteiligten Quelle. Gemittelt wird
weiterhin nirgends: aus 3 und 5 Sätzen wird nicht 4, weil diese Bereiche sich
nicht berühren und 4 niemand gesagt hat. Auswahllisten sind ausgenommen — eine
leere Schnittmenge wäre ein stiller Ausfall statt einer Aussage.

### 5 · Wissen, das keine Zahl ist — **erledigt in v8-349**
Bis v8-348 endete die Kette an der Zahl: was sich nicht in Sätze, Pausen oder
Tempo gießen ließ, kam nicht an und stand als „wirkungslos" in einer Liste.
Diese Behauptung war **nie gemessen**, sondern aus dem Zielregister abgeleitet.

Seit v8-349 gibt die Verordnung `hinweise` zurück; `prescription-format` macht
Zeilen daraus, `scheduler-v2` und `week-projection` tragen sie bis ins
Anzeigemodell, die Wochenkarte zeigt sie mit **Herkunft, Grenzen und
Ausschlüssen**.

```
mit Wissen  → 3 Hinweise, jeder mit Regel-ID und Evidenzklasse
ohne Wissen → KEINE Hinweise — kein Ersatzratschlag, keine Füllzeile
als Zahl eingebaut → NICHT zusätzlich als Hinweis wiederholt
```

Vier eigene Fehler dabei, alle in §39 dokumentiert. Der wichtigste: die Kette
endete zunächst **drei Zeilen vor dem Bildschirm** — `scheduler-v2` warf
`hinweise` weg, und alle Tests waren trotzdem grün. Zum vierten Mal dieselbe
Fehlerklasse (v8-335, v8-341, v8-344). Geprüft werden muss die **Naht**, nicht
das Einzelstück; dafür gibt es jetzt `knowledge_hinweise_test.mjs` und die
Proben H8–H10.

**Grenze, die bleibt:** ein Hinweis ändert keine Zahl, sperrt nichts und wird
nicht erfunden. Ein Befund wie „kein Zusammenhang zwischen Krafttest und
Laufleistung" bleibt ein Befund — er steht jetzt nur nicht mehr wirkungslos
herum, sondern dort, wo der Nutzer ihn braucht.

---

## Nachlese der Bestandsaufnahme (Stand v8-343)

**Erledigt in v8-343:**

- Der Runner **rät den Grund nicht mehr**. Bis v8-342 bekam jeder
  übersprungene Test das Etikett „braucht eine echte Supabase-Instanz" — auch
  die 22, die wegen fehlendem Chromium übersprangen. Jetzt wird der Grund aus
  der Ausgabe gelesen, nach Gruppen getrennt, ein unbekannter Grund als
  unbekannt ausgewiesen, und die Schlusszeile lautet bei Skips
  *„GRÜN, aber UNVOLLSTÄNDIG — N geprüft, M nicht gelaufen"*. Neuer Test
  `run_all_reporting_test.mjs`, neuer Katalog `test-runner` (4 Proben).
- **Ein fehlender Kohorten-Pin galt als bestätigter Pin.** Fehlte
  `_acceptance-cohort.json`, schrieb der Test sie still neu und meldete einen
  Haken — der Weg zum Abschalten war derselbe wie der zum Bestätigen. Jetzt
  fail-closed; bewusstes Neusetzen über `ORVIA_REPIN_COHORT=JJJJ-MM-TT`, mit
  echtem Datum statt fest eingetragenem.
- **`source` fehlte in der Kohorten-Feldliste** des Tests, obwohl es seit @11
  dazugehört — gefunden von einer Mutationsprobe. Die Liste wird jetzt
  beidseitig geprüft. Neuer Katalog `acceptance-cohort` (3 Proben).

**Erledigt danach (13.08., nach der Veröffentlichung):**

- Stamm-`sw.js` (v8-329) entfernt, `.git` von 1038 verwaisten `tmp_obj_*`
  befreit, `main` lokal auf v8-343 gezogen.
- v8-343 ist **veröffentlicht** (GitHub Pages, Publish-Commit `f5d1b2e`), der
  Entwicklungsstand liegt auf dem Zweig **`entwicklung`** (`89acee8`).

**Noch offen (braucht dich oder den Mac):**

1. `npx playwright install chromium` auf dem Mac. Ohne Browser laufen 22
   Dateien nicht — der Runner sagt es jetzt deutlich, installieren muss ihn
   trotzdem jemand.
2. **Zwei Layouts im selben Repo — niemals `main` force-pushen.** Lokal liegt
   die App unter `app/`, auf GitHub in der **Wurzel**: `index.html`, `sw.js`,
   `styles.css`, `env.js`, `js/`, `assets/` — kein `app/`, und weder
   `supabase/tests/` noch `docs/`. Ein Force-Push des lokalen `main` würde
   `index.html` und `sw.js` nach `app/` schieben — Pages fände beide nicht
   mehr. Der Diff zeigt das nur als 117 harmlos aussehende
   `R100`-Umbenennungen. Entwicklungsstand gehört auf `entwicklung`:
   `git push origin main:entwicklung`.
3. **`.git` sammelt Müll**, weil der Cowork-Mount kein `unlink` erlaubt:
   nach jedem git-Aufruf über die Bridge bleiben `tmp_obj_*` und eine
   `index.lock` liegen — letztere blockiert den nächsten Aufruf, bis sie
   weggeschoben wird. Lokal auf dem Mac einmal `git gc` laufen lassen;
   git-Arbeit besser dort erledigen als über die Bridge.

---

## Was von Gian gebraucht wird

| Datei | Was fehlt |
|---|---|
| `QUELLE-01-bare-hybrid.json` | Video Nick Bare — 3–5 Sätze sinngemäß |
| `QUELLE-02-roehrken-triathlon.json` | Video Dr. Golo Röhrken — dito |
| `QUELLE-03-pauls-krafttraining.json` | Buch Pauls S. 93 — dito |
| `QUELLE-06-beck-marathon.json` | Buch Beck S. 42 — dito (inhaltlich die relevanteste) |
| `QUELLE-10-…-ABGELEHNT.json` | die 4 Primärstudien aus dem Literaturverzeichnis |
| `QUELLE-11-kanjuh-kraftprofile-2026.json` | der **Volltext** (179 S.) — angekommen ist nur ein Bildschirmabzug der Betrachterseite. Interessant wären die Referenzbereiche für Kraftkennwerte; die gibt es in keiner anderen Quelle |

### Was ich selbst lesen kann — und was nicht

| Quelle | Abrufbar | Beleg |
|---|---|---|
| PDF direkt hochgeladen (Chat-Anhang) | **ja, am besten** | Volltext selbst extrahierbar, 6 S. / 39 k Zeichen gelesen (Sperlich) |
| PDF von Fachzeitschriften (offener Server) | meist ja | Friedmann, Hoff, Hirschmüller |
| PubMed-Abstract, DOI | ja | Llanos-Lagos, Ramos-Campo |
| Hochschulserver (OPUS o. ä.) | **nein** | `opus.hs-offenburg.de`: robots.txt nicht abrufbar → Abruf fällt geschlossen aus |
| YouTube | **nein** | HTTP 429 |
| Google Books | **nein** | robots.txt |
| GitHub-API / `github.io`-Dateien | **nein** | 403 bzw. Inhalt kommt als Binärdaten an |
| `raw.githubusercontent.com` | **meistens** | `styles.css` (380 kB), `package.json`, alle `js/…` kommen durch — **`sw.js` und `index.html` aber nicht: 404, obwohl beide auf `main` liegen** (im Browser nachgewiesen). Grund unbekannt, an der Dateigröße liegt es nicht. **Ein 404 dieses Werkzeugs ist kein Beleg für Nichtvorhandensein.** |
| Werkzeuge nach Art „Seite als PDF speichern" (Microlink u. a.) | **nutzlos** | liefert einen Bildschirmabzug des BETRACHTERS statt des Dokuments: aus 179 Seiten wurde 1 (Kanjuh) |

**Regel daraus: im Zweifel die PDF herunterladen und in den Chat hängen.** Das
ist der zuverlässigste Weg und liefert mir den Volltext statt einer
Zusammenfassung durch ein Zwischenwerkzeug.

Bei Zahlen immer mitliefern: **pro Übung oder pro Muskelgruppe?** Diese
Verwechslung hätte in v8-339 den Umfang verdoppelt.

---

## Ältere offene Punkte

- **Engine-Plan aktivieren** — `docs/ENGINE-PLAN-AKTIVIEREN.md`, SQL +
  `ORVIA.enginePlanActivate()`. Gian: „mache ich später".
- Gerätetest **G1–G3** — Ergebnisse nie zurückgemeldet.
- `ORVIA.engineShadow.report()` — Ausgabe nie gesehen.
- `test_sync_contract.py` — Layout-Robustheit, Backlog, **zählt nicht als
  Testabdeckung**.
- `local_login.py` — Angebot `--save-token` steht noch offen.

---

## Arbeitsweise (bindend, aus früheren Sitzungen)

- **Probleme vor Erneuerung.** Immer.
- Jede Behauptung gegen **tatsächlich ausgeführten Code** prüfen, nie gegen
  Vermutung.
- **„Nicht gefunden" ist kein Befund, solange das Werkzeug blind sein kann.**
  Am 13.08. zweimal derselbe Fehler: eine Suche mit `--include=*.js,*.mjs,*.md`
  übersah den Kohorten-Pin in einer `.json` („kein Test prüft ihn" — falsch),
  und `raw.githubusercontent` meldete 404 für `sw.js` und `index.html`, die
  beide da waren („GitHub hat kein index.html" — falsch). Beide Male fühlte
  sich das Nichts wie ein Ergebnis an. **Ein Negativbefund braucht eine
  zweite, andersartige Quelle**, bevor er behauptet wird.
- Verhaltenstests gegen **echte Module**, keine Nachbauten des Vertrags.
- Nach jeder Änderung **Mutationsproben** — und Proben, die grün bleiben,
  offen als Testlücke melden. `not_applied` und `skipped` sind **kein Beleg**.
- Fail-closed: „kein Wissen" und „Wissen sagt nichts" dürfen nie dasselbe
  Ergebnis liefern.
- Ein Testartefakt darf **nie** den Namen echter Projektdaten tragen (v8-338).
- Ein Test, der einen Prozess startet, ist so gefährlich wie der Prozess (v8-338).

### Auslieferungsritual
`node --check` → gezielte Tests → Mutationsproben → Gesamtsuite
`node supabase/tests/run-all.mjs --quiet` → Kohorten-Pin `023ee59b` →
`sw.js` hochzählen mit Erzählkopf → Bauplan-Nachtrag → Tarball **mit
`app/`-Präfix** → SendUserFile → `device_commit_files` →
`tar xzf --overwrite` → `shasum -a 256` vergleichen → geänderte Tests
zusätzlich nach `supabase/tests/` im Wurzelverzeichnis kopieren.

Zusätzlich seit v8-338: **Hashes von `js/engine/knowledge/*` vor und nach dem
Probenlauf vergleichen.**

Seit v8-343: Ändert sich eine der 17 Kohortenversionen, wird
`shadow_adaptive_test.mjs` rot und nennt das geänderte Feld. Das ist **kein
Fehler, sondern eine Ansage**: die Belegsammlung beginnt bei null. Bewusst
bestätigen — Manifest löschen, dann
`ORVIA_REPIN_COHORT=JJJJ-MM-TT node supabase/tests/shadow_adaptive_test.mjs`.
Ohne diese Ansage bleibt der Test rot; ein fehlender Pin ist kein bestätigter.

`rm` ist auf dem Gerätemount verboten — stattdessen nach `_to_delete_*` verschieben.

---

## Zahlen zum Nachprüfen (v8-349)

- Gesamtsuite **261/0** Dateien, 7 übersprungen (brauchen echte Supabase-Instanz).
  **Nur mit Chromium** — ohne Browser-Binary sind es 239/0 bei 29 übersprungenen,
  und der Runner sagt das seit v8-343 ausdrücklich dazu.
- **166 Proben in 20 Katalogen**, 161 gefahren / 5 übersprungen, jede
  gefahrene schlägt an
- **Ziele, die ankommen: 30 von 30** aus Paketen (1 als Wert, 24 als Hinweis,
  5 bewusst gesperrt mit Code) und 25 von 25 aus Notizen (21 nach technischer
  Freigabe, 4 medizinisch gesperrt). **Gemessen** durch die echte Kette, nicht
  aus dem Register abgeleitet — die alte Zahl „1 von 30" war eine Ableitung.
- **0 Quittungen** in `_ziele-ohne-leser.json` (v8-348: 41). Die letzte,
  `plan.saetze_je_muskelgruppe`, ist in v8-351 aufgelöst — sie wird jetzt
  angewendet, aber als **Prüfung** statt als Vorgabe (§41)
- **Zuordnungsquote Übung → Muskelgruppe: 91 %** (71 von 78 Systemübungen),
  nach v8-351. Vorher 33 %, weil das Bewegungsmuster im Zwischenspeicher
  fehlte — gemessen mit `tools/messung-zuordnungsquote.mjs`
- **55 Zielnamen** in `_zielvokabular.json` — die Tippfehlerbremse, seit v8-349
  am Namen statt an der Wirkung
- **Wissensvertrag: Version 7**
- **Zahlen: 2 Regeln führen sie strukturiert, 8 nennen sie nur im Text** — der
  Grund steht in Punkt 3b (das Feld fasst nur eine Größe)
- **Regeln mit maschinenlesbarem Zahlwert: Gym 2 von 4, Laufen 0 von 14** —
  der Grund, warum Punkt 1 kein Verdrahtungsproblem ist
- Kohorten-Pin `023ee59b`, geprüft von `shadow_adaptive_test.mjs` gegen
  `supabase/tests/_acceptance-cohort.json` (seit 2026-08-08 eingefroren)
- `running-knowledge-pack.js` = `42ca48f4…`, `knowledge-sources.js` = `b786437d…`
  (bis v8-341 stand hier fälschlich `b7864371…` — ein Prüfanker, der beim
  Nachprüfen fehlschlug)
- Git-Stand: `21c3c1a` (alles bis v8-341) und `fdb5337` (v8-342) auf Zweig
  `sicherung/v8-341`; `main` steht noch auf `f633b5f` (v8-254). **Nicht gepusht.**
