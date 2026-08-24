# Phase A · Abschlussprotokoll (A-03-Rest + A-13)

**Stand:** 21.08.2026 · Live **`orvia-v8-361`** · <https://gianthaysen.github.io/ORVIA.2/>
**Zweck:** Die letzten ausführbaren Teile von Phase A schließen — A-03 (fehlender Smoke-Test
Plan + Sync) und A-13 (Regressionslauf + Gate-Nachweis).

> Dieses Blatt wird beim Test ausgefüllt und aufbewahrt. Es ist der Nachweis für Gate A.
> Ein leeres Kästchen ist kein Mangel, sondern ein noch nicht erbrachter Beleg.

---

## 0 · Was dieses Protokoll NICHT schließen kann

Zwei Punkte bleiben offen, unabhängig davon, wie gut der Test läuft. Ehrlich benannt, damit
niemand später einen Haken sucht, der nicht da sein kann:

| Punkt | Warum offen | Frühestens |
|---|---|---|
| **A-10** Gewerbeschein (Gate A #6) | Bewusst zurückgestellt. Behördenlaufzeit, nur von Gian anstoßbar | offen |
| **A-12** Engine-v2-Report (Gate A #5) | Braucht ≥ 14 Vergleichstage im Shadow-Log. Uhr läuft seit 21.08. | **~04.09.2026** |
| **A-03** „kein Force-Push in der Historie" | Am 17.08. verletzt, **nicht mehr heilbar**. Als Abweichung führen, nicht als Haken | — |
| Gate A #4 Ziel-Shadow ≥ 14 Tage | Uhr läuft seit 20.08. | **~03.09.2026** |

**Alles andere ist heute abschließbar.**

---

## 1 · A-03-Rest · Smoke-Test Plan und Sync

Login und Workout sind bereits belegt. Es fehlen die zwei übrigen Kernflows. ~15 Minuten.

**Vorbereitung:** App öffnen, hart neu laden (Cache-Buster), Version prüfen.

| Schritt | erledigt | Notiz |
|---|:--:|---|
| `https://gianthaysen.github.io/ORVIA.2/` geöffnet, eingeloggt | ☐ | |
| DevTools-Konsole: `ORVIA.engineVersion` meldet **v8-361** | ☐ | |

### 1.1 Kernflow **Plan**

| Prüfung | erwartet | erledigt | Notiz |
|---|---|:--:|---|
| Plan-Tab öffnet ohne Fehler in der Konsole | keine roten Fehler | ☐ | |
| Aktuelle Woche wird angezeigt, Tage tragen Einheiten | Wochenansicht vollständig | ☐ | |
| Wochennavigation vor/zurück funktioniert | richtige Woche, kein Sprung | ☐ | |
| Eine Einheit öffnen → Details sichtbar | Übungen/Vorgaben da | ☐ | |
| Wochenansicht mehrfach öffnen/wechseln | keine Fehler, Anzeige stabil | ☐ | |

> **Korrektur (21.08.):** Einen Knopf „Wochenplan neu erzeugen" gibt es **nicht**.
> `generateWeekPlan()` läuft ausschließlich als **Rückfall**, wenn keine Woche gespeichert ist
> (`activeWeekPlan()`, ui.js:879). Bei gespeichertem Plan wird er nie aufgerufen — das erklärt,
> warum `week_design`/`final_plan` in der Datenbank bei 0 stehen. **Kein Defekt, sondern Bauart.**
>
> **Zusatznutzen — die offene DB-Frage beantworten.** Nach dem Öffnen des Plan-Tabs in der Konsole:
> ```js
> ORVIA.decisionLog.sinkHealth()
> ```
> Erwartet: `attempted > 0`, `failed: 0`, `consecutiveFailures: 0`.
> Ergebnis notieren: ____________________________________________
>
> **Wichtig zu wissen:** `shadow_observation` sollte bei **jedem** Plan-Lesen geschrieben werden
> (`activeWeekPlan → gmObserveWeekPlan → logWeekShadow`, gedrosselt auf 1×/Minute) — anders als
> `week_design`. Dass dieser Strom trotzdem bei 0 steht, ist damit **noch nicht erklärt**.
> `sinkHealth()` entscheidet es:
> · `attempted > 0, failed: 0` → geschrieben, die 0 lag nur an fehlenden Aufrufen vor v8-360
> · `attempted > 0, failed > 0` → echter Schreibfehler, `lastReason` nennt ihn
> · `attempted: 0` → der Beobachter wird gar nicht aufgerufen → Wiring-Bug, dann melden.
>
> **Direkter Test des Generatorpfads** (optional, erzeugt week_design/final_plan):
> ```js
> generateWeekPlan()   // ruft logWeekDecision; danach erneut sinkHealth() lesen
> ```
> Verändert nichts Gespeichertes — der Rückgabewert wird verworfen.

### 1.2 Kernflow **Sync**

Sync heißt: Was auf einem Gerät entsteht, ist auf dem anderen da — und übersteht einen Neustart.

| Prüfung | erwartet | erledigt | Notiz |
|---|---|:--:|---|
| Änderung auf Gerät A (z. B. Check-in oder Zielwert) | gespeichert, Toast | ☐ | |
| Harter Reload auf Gerät A | Änderung noch da | ☐ | |
| Gerät B (zweiter Browser/Handy), gleicher Account | Änderung erscheint | ☐ | |
| Gegenrichtung: Änderung auf B → erscheint auf A | beidseitig | ☐ | |
| Offline-Fall: Flugmodus, Änderung, wieder online | Nachtrag ohne Verlust | ☐ | |

**Ergebnis A-03:** ☐ bestanden · ☐ mit Befund: ______________________________________

---

## 2 · A-13 · Regressionslauf

**DoD:** *Voller manueller Regressionslauf auf Live (alle Kernflows, 2 Browser + 1 Mobilgerät),
Regressionsprotokoll ohne offenen Blocker.*

### 2.1 Automatisierter Teil (Terminal, vor dem manuellen Lauf)

```bash
cd ~/Claude/Projects/Strava
node supabase/tests/run-all.mjs                 # erwartet: GRÜN, 0 fehlgeschlagen
node app/tools/mutation-probe.mjs --root app --test-root .   # erwartet: jede Probe schlägt an
bash app/tools/deploy-verify.sh                 # erwartet: ABNAHME BESTANDEN
```

| Lauf | Ergebnis eintragen | erledigt |
|---|---|:--:|
| Testsuite | ______ bestanden / ______ rot / ______ übersprungen | ☐ |
| Mutationsproben | ______ ok / ______ gap / ______ crashed | ☐ |
| deploy-verify | Exit ______ | ☐ |

### 2.2 Manueller Lauf je Umgebung

Drei Umgebungen, dieselben fünf Kernflows. **Ein Kreuz nur, wenn der Flow wirklich durchlief.**

| Kernflow | Safari (Mac) | Chrome (Mac) | Handy | Befund |
|---|:--:|:--:|:--:|---|
| **Login** (inkl. Reload, eingeloggt bleiben) | ☐ | ☐ | ☐ | |
| **Check-in / Heute** (Morgen-Check-in, Ampel erscheint) | ☐ | ☐ | ☐ | |
| **Plan** (Woche anzeigen, navigieren, erzeugen) | ☐ | ☐ | ☐ | |
| **Workout** (starten, Satz erfassen, beenden) | ☐ | ☐ | ☐ | |
| **Sync** (Gegenprobe auf zweitem Gerät) | ☐ | ☐ | ☐ | |

**Zusätzlich je Umgebung:** Konsole auf rote Fehler prüfen. Gefundene Fehler hier eintragen —
auch harmlose. Ein nicht notierter Fehler ist ein Fehler, den beim nächsten Mal niemand kennt.

| Umgebung | rote Konsolenfehler | Bewertung |
|---|---|---|
| Safari | | |
| Chrome | | |
| Handy | | |

### 2.3 Shadow-Uhren mitprüfen (30 Sekunden, liefert Gate-A-Belege)

```js
ORVIA.engineShadow.report()      // comparableDays muss > 0 sein und wachsen
ORVIA.engineShadow.gateReport()  // A-12: erwartet noch insufficient_data bei S1
```

| Wert | eingetragen |
|---|---|
| `comparableDays` | ______ |
| `gateReady` | ______ |
| `nextStep` | ______________________ |

---

## 3 · Gate A · Checkliste zum Abzeichnen

| # | Kriterium | Stand | Beleg |
|---|---|---|---|
| 1 | Live == lokal (Code-, Datei-, Schema-, Historien-Parität) | ☐ | `deploy-verify.sh` Exit 0 · v8-361 |
| 2 | Tests + Proben grün **in CI**, Branch-Schutz aktiv | ☐ | CI-Lauf auf `entwicklung` · `GATE-A-NACHWEIS-BRANCHSCHUTZ.md` |
| 3 | `knowledge_targets` grün, kein roter Test | ☐ | Suite-Lauf §2.1 |
| 4 | Ziel-Shadow ≥ 14 Tage; Zielwert wird erhoben | ⏳ | Uhr seit 20.08. → ~03.09. |
| 5 | Engine-v2-Vergleichsreport | ⏳ | Uhr seit 21.08. → ~04.09., dann `gateReport()` |
| 6 | Gewerbeschein | ⬜ | **A-10 zurückgestellt** |
| 7 | Deploy-Checkliste angewendet | ☐ | mehrfach, zuletzt v8-361 |

### Abweichungen, die als Abweichung geführt werden (kein Haken)

1. **A-03 · Force-Push am 17.08.2026** — Historie von `origin/main` wurde ersetzt
   (`bb199b1…242d9bb forced update`). Inhalt war zufällig korrekt. **Nicht heilbar.** Nach vorn
   abgesichert: Rulesets aktiv, Force-Push serverseitig gesperrt, alter Stand als Tag
   `deploy-historie-vor-2026-08-17` gesichert.
2. **A-05 · Test-PR** — der wörtliche Merge-Gate-Nachweis ist bei ORVIAs Direkt-Push-Weg nicht
   herstellbar. **Ersetzt durch ein Deploy-Gate:** roter Test blockiert seit v8-360 technisch den
   Deploy (`.suite-green`-Marker + `deploy-verify` Block 0). Wirksamer als die Zeremonie.

**Phase A abgezeichnet (soweit heute möglich):** Datum ____________ · Kürzel ________

---

## 4 · Was nach diesem Protokoll noch aussteht

| Wann | Was |
|---|---|
| **~03.09.** | Ziel-Shadow-Report → Gate A #4 |
| **~04.09.** | `ORVIA.engineShadow.gateReport()` → A-12 / Gate A #5 |
| offen | **A-10** → Gate A #6 (nur von Gian anstoßbar) |
| danach | Gate A vollständig abzeichnen, Phase B offiziell starten (**B-01**) |

**Bis dahin gilt:** täglich Check-in machen — nur an Tagen mit Check-in wächst `comparableDays`,
und nur mit ≥ 14 solcher Tage werden die beiden Uhren voll.
