# ORVIA · Stand und offene Punkte

**Stand: v8-343, veröffentlicht am 2026-08-13.** Diese Datei ist der Einstiegspunkt für eine neue
Sitzung. Sie ersetzt keinen Verlauf — die Begründungen stehen vollständig in
`sw.js` (Versionsköpfe v8-329 bis v8-343) und in
`docs/ENGINE-BAUPLAN-REST-2026-08.md` (§22–§33).

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
Quelle → knowledge-ingest → Vertrag v6 (advisory) → knowledge-application
      → knowledge-consumer → prescription-factory → prescription-format → Karte
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
| Sportarten mit Wissenspaket | **2 von 24** (Laufen handgepflegt, Gym eingespeist) |
| davon wissenschaftlich geprüft | **0** |
| davon im Produktivweg gelesen | **1** (Gym) |
| Gym-Paket | 4 Regeln aus **einer** Übersichtsarbeit von 2007 |
| Laufpaket | 14 Regeln, die derzeit **auf nichts wirken** — siehe Punkt 1 |

Beide Zeilen stehen seit v8-342 auch maschinenlesbar in
`sport-coverage-matrix` (`knowledgePack` vs. `knowledgePackWired`) und werden
von `batch3b0_knowledge_test.mjs` C5/C6 gegen die Wirklichkeit erzwungen —
gegen die Pack-Module im Verzeichnis und gegen
`knowledgeConsumer.registrierteSportarten()`. Wer ein Paket hinzufügt, ohne
die Matrix nachzuziehen, bekommt einen roten Test.

---

## Offene Punkte, priorisiert

### 1 · Laufen an den Consumer hängen
**Neu begründet am 13.08.** — die alte Begründung stimmte nicht.
`O.runningCapacityFactory` wird von **keiner Stelle der App** gerufen; die
einzigen Nennungen im ganzen Repo sind ihre eigene Datei, ihr Unittest und
`phase6_module_load_test`. Es gibt also nicht zwei Wege auf dieselben Regeln,
sondern einen lebenden (Gym über `knowledge-consumer`) und einen toten. Das
Risiko des Zusammenführens ist damit kleiner als angenommen — der Preis des
Wartens dagegen unverändert: 14 gepflegte Laufregeln wirken auf nichts.

Zu entscheiden ist nur, in welche Richtung: die Factory abräumen und
`running` in `PAKETE` eintragen (mit eigenen Pins als Literal), oder die
Factory verdrahten und dafür Gym umhängen. Ersteres ist der kürzere Weg.

### 2 · Übungsauswahl für Gym
`scheduler-v2` leitet für Gym keine Übungsliste ab → `no_exercise_list_generic_session`
→ die Pausenregel greift in der Verordnung, aber **nicht im Wochenplan**.
Das ist als Zusicherung in `knowledge_consumer_test.mjs` festgeschrieben; der
Test schlägt an, sobald der Scheduler Übungen liefert. Dann gehört die
Zusicherung von der Factory auf den Wochenplan gehoben.

### 3 · Eingespeiste Laufregeln sind noch keine Module
`QUELLE-07` (Sperlich, 5 Regeln), `QUELLE-08` (Hoff, 2 Regeln) und `QUELLE-09`
(Hirschmüller, 1 Regel, medizinisch gesperrt) liegen nur als Notizdateien in
`docs/wissen/`. Sie sind vertragsgeprüft, aber nicht als
`running-knowledge-pack-*.js` geschrieben und nicht verdrahtet. Blockiert
durch Punkt 1.

### 3b · QUELLE-11 (Kanjuh) — vertragsfest, aber ohne Wirkung
Am 13.08. eingespeist, eine Regel (`RUN-KRAFTPROFIL-001`: Kraftwerte auf die
Körpermasse normiert vergleichen, nicht absolut). Gegen die echten Module
gefahren: `ingest` **ok**, `applyKnowledge` **ok**, eine Vorgabe, kein Konflikt.

Und trotzdem wirkungslos — aus einem Grund, der über diese eine Quelle
hinausgeht:

```
wirkt_auf: "plan.kraftvergleich_normierung"
→ kommt in app/js NIRGENDS vor. Niemand liest dieses Ziel.
```

**Der Vertrag prüft Zielnamen nicht.** Es gibt keine Liste erlaubter Ziele;
jeder String wird angenommen. Damit sieht eine Regel „eingespeist und
angewendet" aus und bewirkt nichts — und ein Tippfehler
(`session.rest_secons`) verhält sich exakt genauso. Das ist zum **dritten
Mal** dieselbe Fehlerklasse: v8-335 („eingespeist, aber niemand liest es"),
v8-341 (`applyKnowledge` ohne Aufrufer), jetzt das Ziel ohne Leser.

Fällig wäre ein **Zielregister**: die Verordnung meldet, welche Ziele sie
kennt; die Einspeisung weist alles andere ab oder markiert es sichtbar als
„noch ohne Leser". Gehört zusammen mit Punkt 1 gemacht.

### 4 · Konfliktlösung — noch offene Feinheit
Seit v8-341 konkurrieren nur noch **Werte**. Ungelöst bleibt: zwei
Zahlbereiche gleicher Klasse, die sich **überlappen** (z. B. 120–180 und
150–240), gelten als Widerspruch. Die Schnittmenge wäre von beiden Quellen
gedeckt und keine Erfindung. Bewusst nicht gebaut — Änderungen an der
Zahlenlogik sind riskanter als an der qualitativen.

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

## Zahlen zum Nachprüfen (v8-343)

- Gesamtsuite **257/0** Dateien, 7 übersprungen (brauchen echte Supabase-Instanz).
  **Nur mit Chromium** — ohne Browser-Binary sind es 235/0 bei 29 übersprungenen,
  und der Runner sagt das seit v8-343 ausdrücklich dazu.
- **124 Proben in 15 Katalogen**, 120 gefahren / 4 übersprungen
- Kohorten-Pin `023ee59b`, geprüft von `shadow_adaptive_test.mjs` gegen
  `supabase/tests/_acceptance-cohort.json` (seit 2026-08-08 eingefroren)
- `running-knowledge-pack.js` = `42ca48f4…`, `knowledge-sources.js` = `b786437d…`
  (bis v8-341 stand hier fälschlich `b7864371…` — ein Prüfanker, der beim
  Nachprüfen fehlschlug)
- Git-Stand: `21c3c1a` (alles bis v8-341) und `fdb5337` (v8-342) auf Zweig
  `sicherung/v8-341`; `main` steht noch auf `f633b5f` (v8-254). **Nicht gepusht.**
