# Phase A — Stand

**Letzte Aktualisierung:** 20.08.2026 · **Quelle:** `plan/Band-1-Phasenplan-Detail.md` §A
**Umfang:** 13 Arbeitspakete, 127 h AP + 23 h Puffer = 150 h; korrigiert um +3 h aus dem
Vorsprint A-S0 (§3) → **130 h AP**

> **Pflege:** Diese Datei wird bei jedem abgeschlossenen Arbeitspaket fortgeschrieben.
> Jede Zeile trägt einen Beleg (Commit, Testname, Migrationsnummer) — nicht eine Erinnerung.

---

## 1 · Kernaussage

**67 von 130 AP-Stunden erledigt — 52 %.** Sieben von dreizehn Paketen abgeschlossen, zwei
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
| **A-05** | CI + Branch-Protection | 17 | ⚠️ teilweise | CI grün (275 Dateien, 174 Proben); Force-Push serverseitig unmöglich und belegt; Test-PR siehe §4 |
| **A-06** | Ziel-SSOT Teil 1 | 16 | ✅ | `5241af3`, `af2d922`; Migration 0037; `goal_shadow_test` 50/50; 8 Mutationsproben; **live belegt** (§3) |
| **A-07** | `goals_detail` aktivieren | 12 | ⬜ offen | Schritt existiert (`onboarding-logic.js:31`), `required:false, skippable:true` |
| **A-08** | `goal-feasibility`-Leser | 8 | ⬜ offen | Modul existiert (30 KB, 152 Tests), nicht an das Zielobjekt angebunden |
| **A-09** | Taper-Anbindung | 10 | ⬜ offen | — |
| **A-10** | Gewerbe + Steuerberater | 8 | ⬜ **offen, terminkritisch** | unverändert seit dem Vorsprint (V-05/V-06) |
| **A-11** | Deploy-Prozess härten | 10 | ✅ | `DEPLOY-AUFTRAG-STANDARD.md`, `deploy-verify.sh` (160 Dateien byteweise), `sw_asset_check.py`; viermal angewendet |
| **A-12** | Engine-v2-Shadow-Auswertung | 15 | ⬜ offen | `decision-log.js` vorhanden, Auswertung fehlt |
| **A-13** | Regressionslauf + Abnahme | 10 | ⬜ offen | hängt an allen |

**Erledigt: 67 h · Offen: 63 h**

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

## 4 · Zwei Lücken, unbeschönigt

### A-03 · „kein Force-Push in der Historie" — verletzt

Am 17.08.2026 hat der Upload `origin/main` force-gepusht und die Historie ersetzt
(`+ bb199b1...242d9bb (forced update)`). Der Inhalt war zufällig korrekt; mit dem lokalen
`app/`-Layout wäre die Live-App sofort ausgefallen. **Nicht mehr erfüllbar** — im
Gate-Protokoll als Abweichung zu führen, nicht als Haken. Nach vorn abgesichert: Rulesets aktiv,
Nachweis in `GATE-A-NACHWEIS-BRANCHSCHUTZ.md`, alter Stand als Tag
`deploy-historie-vor-2026-08-17` gesichert.

Ebenfalls offen: Smoke-Test für **Plan** und **Sync** am Gerät (Login und Workout sind belegt).

### A-05 · „Roter Test blockiert Merge (Test-PR)" — nicht erfüllbar wie formuliert

Force-Push-Sperre: erfüllt und belegt. Der Test-PR setzt einen PR-Workflow voraus, den ORVIA
nicht hat; erzwungene Statuschecks würden `git push origin main:entwicklung` blockieren.
**Konsequenz: technisch hindert derzeit nichts daran, bei roter CI zu deployen.**

Vorschlag (~2 h): `run-all.mjs` schreibt bei grünem Lauf einen Marker mit dem HEAD-SHA,
`deploy-verify.sh` verweigert die Abnahme bei fehlendem oder fremdem Marker. Dann blockiert ein
roter Test den **Deploy** — an der Stelle, an der Schaden entsteht.

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
| 2 | Tests + Proben grün in CI, Branch-Protection aktiv | ⚠️ CI ✅, Force-Push-Sperre ✅ belegt, Test-PR siehe §4 |
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
4. **A-05 abschließen** — Marker-Mechanismus, DoD in Band 1 nachziehen (~2 h)
5. A-08, A-09, dann A-12
6. **A-13** als Letztes

**Nicht empfohlen:** Login-Performance (Diagnose abgeschlossen, Umsetzung gehört in den Block
„Beta-Reife" zusammen mit der Datenschutzerklärung).
