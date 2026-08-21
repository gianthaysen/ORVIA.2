# Phase A — Stand

**Letzte Aktualisierung:** 21.08.2026 (A-05 abgeschlossen) · **Quelle:** `plan/Band-1-Phasenplan-Detail.md` §A
**Umfang:** 13 Arbeitspakete, 127 h AP + 23 h Puffer = 150 h; korrigiert um +3 h aus dem
Vorsprint A-S0 (§3) → **130 h AP**

> **Pflege:** Diese Datei wird bei jedem abgeschlossenen Arbeitspaket fortgeschrieben.
> Jede Zeile trägt einen Beleg (Commit, Testname, Migrationsnummer) — nicht eine Erinnerung.

---

## 1 · Kernaussage

**97 von 130 AP-Stunden erledigt — 75 %.** Zehn von dreizehn Paketen abgeschlossen, zwei
Wochen **vor** dem in Band 1 geplanten Phasenstart (September/Oktober).

Der kritische Pfad läuft jetzt über eine **Wartezeit**, nicht über Arbeitszeit: siehe §5.

---

## 2 · Arbeitspakete

| AP | Paket | Std. | Stand | Beleg |
|---|---|---:|---|---|
| **A-01** | Zielvokabular-Fix | 4 | ✅ | `8567f1e`; `knowledge_targets` 24/24 |
| **A-02** | B4-Resolver-Fix | 4 | ✅ | `8567f1e`; `engine_input_b4_profile_keys` 9/9 |
| **A-03** | Deploy + Live-Abnahme | 12 | ⚠️ teilweise | live **v8-357** statt v8-353; DoD-Verstoß und Rest siehe §4 |
| **A-04** | Gym-Bug-Retest | 4 | ✅ | 0035 live, Übung im laufenden Workout online gespeichert, Toast über dem Overlay |
| **A-05** | CI + Branch-Protection | 17 | ✅ | CI grün; Force-Push serverseitig gesperrt und belegt; **Deploy-Marker** schließt die letzte Lücke: `run-all.mjs` schreibt bei grünem Lauf `.suite-green` (HEAD-SHA), `deploy-verify.sh` Block 0 verweigert ohne gültigen Marker die Abnahme. `deploy_marker_test` 20/20; 5 Mutationsproben. **Abweichung vom Wortlaut** (Test-PR-Merge-Gate → Deploy-Gate): §4 |
| **A-06** | Ziel-SSOT Teil 1 | 16 | ✅ | `5241af3`, `af2d922`; Migration 0037; `goal_shadow_test` 50/50; 8 Mutationsproben; **live belegt** (§3) |
| **A-07** | Zielwert im Onboarding erheben | 12 | ✅ | Feld im Ziel-Schritt; `onboarding_goal_value_test` 16/16; 6 Mutationsproben. **Abweichung vom Wortlaut:** Band 1 sah einen eigenen Schritt `goals_detail` vor. Umgesetzt kollidierte er mit vier Verträgen (`getNextStep` ist tier-gefiltert; „Personalization beeinflusst Essential nicht"). Das Feld sitzt deshalb im bestehenden Schritt „Dein Ziel" — gleiches Ergebnis für den Nutzer, kein aufgeweichter Vertrag. `goals_detail` bleibt für spätere Zieldetails frei. |
| **A-08** | `goal-feasibility`-Leser | 8 | ✅ | `goal-feasibility-adapter.js` (Beobachter); `goal_feasibility_adapter_test` 20/20; 5 Mutationsproben; an den Renderpfad gehängt (`ORVIA._lastFeasibility`), kein Blocker. **Kern:** Kommensurabilitätsgate — Zielzeit (race_time) und Schwellenpace werden nicht gegeneinander gerechnet; nur FTP↔FTP, VO2max↔VO2max, Pace↔Pace. Zeit→Schwelle bleibt bewusst außen vor (Modell). |
| **A-09** | Taper-Anbindung | 10 | ✅ | `goal-taper-resolver.js` (Beobachter); `goal_taper_resolver_test` 23/23; 5 Mutationsproben; leitet aus `mainGoalOf().targetDate` die Phase ab (race_week ≤6 d, taper 7–13 d, sonst build), Grenzen deckungsgleich mit `race.js`. Beobachtet über `ORVIA._lastTaperPhase`; **scharf schalten ist B-01.** |
| **A-10** | Gewerbe + Steuerberater | 8 | ⬜ **offen, terminkritisch** | unverändert seit dem Vorsprint (V-05/V-06) |
| **A-11** | Deploy-Prozess härten | 10 | ✅ | `DEPLOY-AUFTRAG-STANDARD.md`, `deploy-verify.sh` (160 Dateien byteweise), `sw_asset_check.py`; viermal angewendet |
| **A-12** | Engine-v2-Shadow-Auswertung | 15 | ⬜ offen | `decision-log.js` vorhanden, Auswertung fehlt |
| **A-13** | Regressionslauf + Abnahme | 10 | ⬜ offen | hängt an allen |

**Erledigt: 97 h · Offen: 33 h**

### Ungeplant, aber notwendig

| Arbeit | Anlass |
|---|---|
| **Migration 0036** — Rechte-Eskalation über `profiles.role` | Jeder angemeldete Nutzer konnte sich zum Owner machen. Geschlossen, belegt mit HTTP 403 |
| **Fünf falsch-grüne Tests** | Meldeten ROT ohne Exit-Code, wurden als bestanden gezählt |
| **Schema-Parität** (110 → 113 Objekte) | Code und Instanz liefen auseinander, niemand prüfte es |
| **Score-v9-Widerspruch** | 87→83 und 87→94: beide korrekt, verschiedene Größen |
| **Login-Diagnose** | Ursache eingegrenzt (rundreisegebunden), Umsetzung bewusst vertagt |

---

## 3 · A-06 im Einzelnen

**Umfang bewusst abgegrenzt.** Band 1 verlangt zweierlei, das einander widerspricht:
`mainGoalOf` als einzige Quelle etablieren **und** kein Verhalten ändern. `goalOf()` hat 18
Aufrufer und drei Rückfallebenen; sie zu ersetzen **ist** eine Verhaltensänderung. A-06
protokolliert deshalb, B-01 stellt um — dort steht es auch so: *„Shadow-Log aus A-06 wird zur
aktiven Quelle."*

**Gebaut:** `goal-shadow.js` (Beobachter nach dem Muster von `decision-log.js`, unveränderlich,
fail-open), Anbindung in `commitGoals()`, Migration 0037 (keine update-/delete-Policy,
`authenticated` nur `select, insert`, `anon` ausdrücklich entzogen), 50 Prüfungen, 8
Mutationsproben, Auswertung `_goal-shadow-report.sql`.

**Live belegt am 20.08.2026:**

```
15:42:27  status  contradiction: false  []  orvia-v8-357
```

Aus `goalSetStatus` → `commitGoals` → `_goalShadowNote` → Datenbank, mit der ausgelieferten
Version. Erster inhaltlicher Befund: bei diesem Profil meinen `mainGoalOf()` und `goalOf()
dasselbe Ziel mit denselben Werten.

**Zwei Lehren, beide im Werkzeug festgehalten:**

1. Zwei Mutationsproben deckten echte **Testlücken** auf, bevor sie jemand bemerkt hätte —
   der Fall „Hauptziel fehlt, Bestand liefert eins" war ungeprüft, und die Verdrahtungsprüfung
   fand den Funktionsnamen statt des Aufrufs.
2. `stats()` zählte rein asynchron; `0/0` bedeutete „nichts passiert" **und** „läuft noch".
   Das führte bei der Live-Prüfung fast zur Fehlersuche am falschen Ende. Jetzt trennt
   `unterwegs` die Fälle, und `senke` macht den stillen Zustand „keine Senke gesetzt" sichtbar.

**Die 14-Tage-Uhr läuft seit 20.08.2026, 15:42 UTC → früheste Auswertung 03.09.2026.**

---

## 4 · Eine offene Lücke (A-03), eine geschlossene (A-05)

### A-03 · „kein Force-Push in der Historie" — verletzt

Am 17.08.2026 hat der Upload `origin/main` force-gepusht und die Historie ersetzt
(`+ bb199b1...242d9bb (forced update)`). Der Inhalt war zufällig korrekt; mit dem lokalen
`app/`-Layout wäre die Live-App sofort ausgefallen. **Nicht mehr erfüllbar** — im
Gate-Protokoll als Abweichung zu führen, nicht als Haken. Nach vorn abgesichert: Rulesets aktiv,
Nachweis in `GATE-A-NACHWEIS-BRANCHSCHUTZ.md`, alter Stand als Tag
`deploy-historie-vor-2026-08-17` gesichert.

Ebenfalls offen: Smoke-Test für **Plan** und **Sync** am Gerät (Login und Workout sind belegt).

### A-05 · „Roter Test blockiert Merge (Test-PR)" — durch ein Deploy-Gate ersetzt (21.08.2026)

Force-Push-Sperre: erfüllt und belegt. Der wörtliche Test-PR setzt einen PR-Merge-Workflow
voraus, den ORVIA nicht hat; eine PR-Pflicht mit erzwungenem Statuscheck würde
`git push origin main:entwicklung` blockieren, ohne einen der drei tatsächlich eingetretenen
Vorfälle zu verhindern. Der Merge ist bei ORVIA nicht die Stelle, an der Schaden entsteht —
**der Deploy ist es.** Deshalb sitzt die Sperre jetzt dort:

- `run-all.mjs` schreibt bei grünem Lauf `supabase/tests/.suite-green` mit dem HEAD-SHA,
  einem `complete`-Kennzeichen (lokal false, weil Browser-Tests ohne Chromium überspringen)
  und einem `dirty`-Kennzeichen. Ein **roter** Lauf **entfernt** einen alten Marker — sonst
  autorisierte ein früherer grüner Lauf weiter einen Deploy.
- `deploy-verify.sh` Block 0 verweigert die Abnahme, wenn der Marker fehlt oder zu einem
  anderen Commit gehört, und warnt bei unvollständigem oder auf geändertem Baum gefahrenem Lauf.

**Damit blockiert ein roter Test technisch den Deploy — nicht mehr nur prozedural.** Kern in
`_suite-marker.mjs`, gedeckt von `deploy_marker_test` (20/20) und 5 Mutationsproben, die die
Kernzusicherung „roter Lauf entfernt den Marker" scharf prüfen.

**Ehrliche Restlücke:** Der Marker bindet an den HEAD-Commit. Ein grüner Lauf, dann eine
**nicht committete** Änderung, dann Deploy — der Marker-SHA bleibt gültig. Diese Lücke fängt
Block 3 (Byte-Vergleich der ausgelieferten Dateien), nicht der Marker; `dirty` macht den Fall
im Abnahmeprotokoll sichtbar. Der PR-Workflow bleibt sinnvoll, sobald ein zweiter Entwickler
mitarbeitet — heute erzeugte er bei einem Entwickler nur Reibung.

---

## 5 · Kritischer Pfad

Band 1 nennt A-03 → A-04 → A-06 → A-07/08/09 → A-13. A-03, A-04 und A-06 sind abgearbeitet.

**Entscheidend ist jetzt keine Arbeitszeit, sondern zweimal Wartezeit:**

| Punkt | Wartezeit | Frühestens |
|---|---|---|
| Gate A, Kriterium 4 — Shadow-Log ≥ 14 Tage | läuft seit 20.08. | **03.09.2026** |
| Gate A, Kriterium 6 — Gewerbeschein (A-10) | Behördenlaufzeit, **nicht begonnen** | offen |

A-10 blockiert zusätzlich den Garmin-Antrag in Phase C. Jeder Tag ohne Anmeldung verschiebt
das Phasenende um einen Tag, unabhängig von allem anderen.

---

## 6 · Gate A — sieben Kriterien

| # | Kriterium | Stand |
|---|---|---|
| 1 | Live == lokal | ✅ und verschärft (Datei-, Schema-, Historien-Parität; Neufassung in `GATE-A-KRITERIUM-1-NEUFASSUNG.md`) |
| 2 | Tests + Proben grün in CI, Branch-Protection aktiv | ✅ CI grün, Force-Push-Sperre belegt; roter Test blockiert jetzt **technisch den Deploy** (Deploy-Marker, §4). PR-Merge-Gate bewusst nicht — würde `main:entwicklung` blockieren |
| 3 | `knowledge_targets` grün, kein roter Test | ✅ 275 Dateien, 0 rot |
| 4 | Shadow-Log ≥ 14 Tage; `goals_detail` erhebt Zielwert | ⏳ Uhr läuft seit 20.08.; `goals_detail` offen (A-07) |
| 5 | Engine-v2-Vergleichsreport | ⬜ (A-12) |
| 6 | Gewerbeschein | ⬜ (A-10) |
| 7 | Deploy-Checkliste angewendet | ✅ viermal |

---

## 7 · Empfohlene Reihenfolge

1. **A-10 anstoßen** — Wartezeit, die niemand verkürzt
2. **A-07** (`goals_detail`) — füllt Gate-A-Kriterium 4 zur Hälfte und liefert dem Shadow-Log
   echte Zielwerte, solange die Uhr ohnehin läuft
3. **A-03 abschließen** — Smoke-Test Plan und Sync, Protokoll ablegen (15 min)
4. ~~A-05 abschließen~~ — **erledigt 21.08.2026** (Deploy-Marker, §4); DoD-Nachtrag in Band 1
5. A-08, A-09, dann A-12
6. **A-13** als Letztes

**Nicht empfohlen:** Login-Performance (Diagnose abgeschlossen, Umsetzung gehört in den Block
„Beta-Reife" zusammen mit der Datenschutzerklärung).
