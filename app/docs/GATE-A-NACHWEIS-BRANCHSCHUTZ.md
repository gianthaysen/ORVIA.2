# Gate A · Kriterium 2 — Nachweis Branch-Schutz

**Datum:** 17.08.2026 · **Repo:** `gianthaysen/ORVIA.2` · **Geprüft von:** Gian Thaysen

---

## 1 · Anlass

Am 17.08.2026 wurde `origin/main` beim Deploy von v8-355 **force-gepusht** und dabei die
komplette Historie ersetzt. Belegt durch den Fetch auf dem Arbeitsrechner:

```
 + bb199b1...242d9bb  main -> origin/main  (forced update)
```

Der Inhalt war zufällig korrekt (Wurzel-Layout, 159 Dateien, v8-355). Hätte derselbe
Force-Push das lokale `app/`-Layout getroffen, hätte GitHub Pages weder `index.html` noch
`sw.js` gefunden — die Live-App wäre auf allen Geräten sofort ausgefallen. Im Reflog von
`origin/main` steht ein zweiter `forced-update` (Eintrag `@{9}`), der Vorgang war also kein
Einzelfall.

Bis zu diesem Datum hing der Schutz ausschließlich an Disziplin. Das ist keine Sicherung.

Der alte Stand ist lokal gesichert und prune-fest:
`git tag deploy-historie-vor-2026-08-17` → `bb199b1`, 7 Commits, überlebt `git gc --prune=now`.

---

## 2 · Eingerichtete Regeln

| Ruleset | Enforcement | Targets | Regeln | Bypass |
|---|---|---|---|---|
| `Schutz Auslieferung` | Active | `main` (temporär zusätzlich `schutztest`) | Restrict deletions · Block force pushes | leer |
| `Schutz Entwicklung` | Active | `entwicklung` | Restrict deletions · Block force pushes | leer |

**Bewusst NICHT gesetzt** — beides würde bestehende Arbeitswege blockieren, ohne einen
Ausfall zu verhindern:

- *Require a pull request before merging* — Deploys landen als direkte Commits in der Wurzel von `main`; mit PR-Pflicht scheitert jeder Upload.
- *Require status checks to pass* — erzwungene Checks blockieren **direkte** Pushes vollständig (der Check kann zum Push-Zeitpunkt nicht grün sein). `git push origin main:entwicklung`, der einzige Weg vom Arbeitsrechner in den Entwicklungszweig, wäre dauerhaft dicht. Die CI läuft ohnehin bei jedem Push auf `entwicklung` und meldet Rot sichtbar.

Die **Bypass-Liste ist leer**. Mit einem Eintrag „Repository admin" wäre die Regel für den
Eigentümer wirkungslos gewesen — also für genau die Person, deren Fehler sie abfangen soll.

---

## 3 · Nachweis, dass die Regel greift

Nicht gegen `main` getestet: Der einzige aussagekräftige Test ist ein echtes Zurückspulen;
greift der Schutz wider Erwarten nicht, ist die Live-App weg. Geprüft wurde deshalb gegen
den Wegwerf-Zweig `schutztest`, der **im selben Ruleset** liegt und damit dieselbe Regel trägt.

### 3.1 Zweig anlegen — muss durchgehen

```
$ git push origin origin/main:refs/heads/schutztest
To https://github.com/gianthaysen/ORVIA.2.git
 * [new branch]      origin/main -> schutztest
```

### 3.2 Force-Push — muss abgelehnt werden ✅

```
$ git push --force origin origin/main~1:schutztest
remote: error: GH013: Repository rule violations found for refs/heads/schutztest.
remote: Review all repository rules at https://github.com/gianthaysen/ORVIA.2/rules?ref=refs%2Fheads%2Fschutztest
remote:
remote: - Cannot force-push to this branch
remote:
To https://github.com/gianthaysen/ORVIA.2.git
 ! [remote rejected] origin/main~1 -> schutztest (push declined due to repository rule violations)
error: failed to push some refs to 'https://github.com/gianthaysen/ORVIA.2.git'
```

### 3.3 Löschen — muss abgelehnt werden ✅

```
$ git push origin --delete schutztest
remote: error: GH013: Repository rule violations found for refs/heads/schutztest.
remote:
remote: - Cannot delete this branch
remote:
To https://github.com/gianthaysen/ORVIA.2.git
 ! [remote rejected] schutztest (push declined due to repository rule violations)
error: failed to push some refs to 'https://github.com/gianthaysen/ORVIA.2.git'
```

### 3.4 Übertragbarkeit auf `main` — der eigentliche Beleg

Ein Nachweis auf `schutztest` sagt über `main` nichts, solange nicht belegt ist, dass dieselbe
Regel dort gilt. GitHub rechnet das pro Zweig aus unter
`https://github.com/gianthaysen/ORVIA.2/rules?ref=refs%2Fheads%2Fmain`:

> **Schutz Auslieferung** — aktiv · *2 branch rules · targeting 2 branches*

Damit ist belegt: dieselben zwei Regeln, dasselbe aktive Ruleset, gültig für `main`.
(Screenshot vom 17.08.2026 zu diesem Protokoll.)

### 3.5 Rückbau

Target `schutztest` aus dem Ruleset entfernt, danach:

```
$ git push origin --delete schutztest
 - [deleted]         schutztest
```

Dass **dieselbe** Löschung vorher abgelehnt und nachher ausgeführt wurde, ist die
Gegenprobe: Die Ablehnung in 3.3 kam nachweislich von der Regel und nicht von einem
Netzwerk-, Rechte- oder Tippfehler.

---

## 4 · Bewertung

**Kriterium 2 erfüllt.** Der serverseitige Schutz gegen Historien-Ersatz und Löschung auf
`main` ist aktiv und durch einen abgelehnten Push dokumentiert, nicht nur konfiguriert.

**Was dieser Nachweis NICHT abdeckt:**

1. Er schützt vor dem Ersetzen der Historie, nicht vor **inhaltlich falschen** Commits. Ein
   normaler Push mit dem falschen Layout wäre weiterhin möglich. Dagegen wirkt
   `app/tools/deploy-verify.sh` — und zwar erst **nach** dem Upload, also erkennend, nicht verhindernd.
2. Der Upload-Weg selbst ist unverändert manuell. Der neu gefasste Deploy-Auftrag
   (`app/docs/DEPLOY-AUFTRAG-STANDARD.md`) verbietet Force-Push in jeder Form ausdrücklich —
   ab jetzt scheitert ein Verstoß serverseitig statt still durchzugehen.
3. `entwicklung` trägt dieselben zwei Regeln, ist aber nicht separat gegengeprüft worden.
   Der Nachweis oben gilt für das Ruleset `Schutz Auslieferung`.
