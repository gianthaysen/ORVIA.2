# ORVIA-Masterplan — Band 1: Phasenplan im Detail

**Stand:** 15.08.2026 · **Kapazität:** 20 h/Woche (Spanne 15–25 h) · **Sprintlänge:** 2 Wochen ≈ 40 h nominal
**Konvention:** Alle Stundenangaben sind Planwerte; jede Phase enthält 15 % Puffer, der explizit ausgewiesen und nicht vorab verplant wird. Angaben ohne Faktenbasis sind als „Schätzung" markiert.

---

## 0. Lesehilfe und Planungslogik

| Begriff | Bedeutung |
|---|---|
| **AP** | Arbeitspaket, kleinste planbare Einheit (ID-Schema: `<Phase>-<Nr>`) |
| **DoD** | Definition of Done — messbar, nicht interpretierbar |
| **Gate** | Messbare Kriterien, die erfüllt sein müssen, bevor die Folgephase startet |
| **Cut-Linie** | Reihenfolge, in der bei Zeitmangel gestrichen wird (zuerst genannt = zuerst gestrichen) |
| **Kritischer Pfad** | AP-Kette, deren Verzögerung die Phase direkt verlängert |

**Warum 15 % Puffer je Phase:** Die Kapazität schwankt real zwischen 15 und 25 h/Woche; ohne ausgewiesenen Puffer würde jede Unterschreitung sofort den kritischen Pfad treffen. 15 % entspricht etwa der Differenz zwischen Nominal- (20 h) und Minimalkapazität (15 h) über eine von vier Wochen.

**Stundenbilanz gesamt (Plan):**

| Phase | Zeitraum | Kapazität | AP-Summe | Puffer (15 %) | Bilanz |
|---|---|---|---|---|---|
| A Fundament | Sep–Okt 2026 | ~150 h | 127 h | 23 h | 150 h ✔ |
| B Produktkern | Nov 2026–Feb 2027 | ~300 h | 255 h | 45 h | 300 h ✔ |
| C Store-Ready | Feb–Apr 2027 | ~200 h | 170 h | 30 h | 200 h ✔ |
| D Launch | Mai 2027 | ~80 h (Schätzung: 4 Wo × 20 h) | 68 h | 12 h | 80 h ✔ |
| E Wachstum | Jun–Dez 2027 | ~600 h (Schätzung: 30 Wo × 20 h) | 510 h | 90 h | 600 h ✔ |
| F Community/B2B | 2028 | offen | Rahmenplanung | — | — |

---

## Phase A — Fundament (Sep–Okt 2026, ~150 h)

### A.0 Zielbild

Am Ende von Phase A ist die technische Schuld abgebaut, die jede weitere Arbeit verteuert: Der Deploy-Rückstand (lokal v8-353, live v8-343, 10 Versionen) ist auf null, jede Änderung läuft durch CI mit Branch-Protection, der rote Test `knowledge_targets` ist grün, die Ziel-Datenbasis (SSOT) existiert als Shadow-Log, und die formale Unternehmensgrundlage (Gewerbe, Steuerberater) steht — Letztere ist harte Voraussetzung für den Garmin-Developer-Antrag in Phase C. **Begründung der Reihenfolge:** Ohne CI und ohne synchronen Live-Stand ist jede Aussage über Produktqualität in Phase B unbelegbar; ohne Ziel-SSOT bleibt die Ziel→Plan-Kette (B1/B4/B5) in Phase B nicht schließbar.

### A.1 Arbeitspakete

| ID | Paket | Inhalt konkret | Std. | Abhängigkeiten | Definition of Done |
|---|---|---|---|---|---|
| A-01 | Zielvokabular-Fix | Die 4 fehlenden QUELLE-14-Ziele ins Vokabular aufnehmen; Test `knowledge_targets` reparieren | 4 | keine | `knowledge_targets` grün; alle 268 Tests grün; 166 Mutationsproben unverändert bestanden |
| A-02 | B4-Resolver-Fix | 2-Zeilen-Fix im Resolver einspielen; Regressionstest ergänzen, der den Fehlerfall abdeckt | 4 | A-01 (gemeinsamer Testlauf) | Fix gemerged; neuer Test schlägt ohne Fix fehl, mit Fix grün |
| A-03 | Deploy v8-344…353 + Live-Abnahme | 10 Versionen kontrolliert auf GitHub Pages (`/ORVIA.2/`) ausrollen; Dual-Repo-Layout beachten (lokal `app/`, GitHub Wurzel — **nie force-pushen**); SW-Versions-Cache prüfen; Abnahmeprotokoll je Version | 12 | A-01, A-02 (sollen mitfahren) | Live-SW meldet v8-353; Abnahmeprotokoll mit Smoke-Test je Kernflow (Login, Plan, Workout, Sync) abgelegt; kein Force-Push in der Historie |
| A-04 | Gym-Bug-Retest | Gym-Bug nach Deploy auf Live-Stand erneut testen; Übung-Button existiert in v8-353 (`workout-ui.js:544`) — verifizieren, dass er live sichtbar und funktional ist | 4 | A-03 | Bug auf Live reproduziert-oder-geschlossen; Button in Live-DOM vorhanden und klickbar; Ergebnis dokumentiert |
| A-05 | CI + Branch-Protection | GitHub Actions: 268 Tests + 166 Mutationsproben bei jedem Push/PR; Branch-Protection auf Main (PR-Pflicht, grüner Check Pflicht); Schutz gegen Force-Push serverseitig erzwingen | 14 | keine (parallel zu A-03 möglich) | Roter Test blockiert Merge nachweislich (Test-PR mit absichtlichem Fehler); Force-Push auf Main technisch unmöglich · **Nachtrag 21.08.2026:** PR-Merge-Gate durch ein Deploy-Gate ersetzt — `run-all.mjs` schreibt bei grünem Lauf `.suite-green` (HEAD-SHA), `deploy-verify.sh` Block 0 verweigert ohne gültigen Marker die Abnahme. Ein roter Test blockiert damit den **Deploy** statt eines Merges; eine PR-Pflicht würde den `main:entwicklung`-Push blockieren. |
| A-06 | Ziel-SSOT Teil 1: `mainGoalOf` + Shadow-Log | `mainGoalOf` als einzige Quelle des Hauptziels etablieren; Zielobjekt zunächst **nur als Shadow-Log** mitschreiben (kein Verhalten ändern) — Begründung: risikofreie Datensammlung vor Umstellung der Planlogik | 16 | A-05 (jede Änderung via CI) | Shadow-Log schreibt bei jedem Zielereignis; Diff Shadow vs. Bestand über 2 Wochen ohne Widerspruch; kein Verhaltensunterschied in Tests |
| A-07 | `goals_detail` aktivieren | Inaktiven Onboarding-Schritt `goals_detail` aktivieren, damit erstmals ein Zielwert erhoben wird (adressiert B5) | 12 | A-06 (schreibt ins Zielobjekt/Shadow-Log) | Neuer Nutzer durchläuft `goals_detail`; Zielwert landet im Shadow-Log; Bestandsnutzer ohne Bruch |
| A-08 | `goal-feasibility`-Leser | Leser implementieren, der das Zielobjekt auf Machbarkeit prüft (liest Shadow-Log, gibt noch keine harten Blocker aus) | 8 | A-06 | Feasibility-Ergebnis wird geloggt; Testfälle für machbar/unmachbar/Grenzfall grün |
| A-09 | Taper-Anbindung | Taper-Logik an das Zielobjekt (Zieldatum) anbinden | 10 | A-06 | Taper reagiert im Shadow-Vergleich korrekt auf Zieldatum; Tests grün |
| A-10 | Gewerbeanmeldung + Steuerberater | Gewerbe anmelden; Steuerberater mandatieren (Kleinunternehmer vs. Regelbesteuerung klären — relevant wegen App-Store-Erlösen) | 8 | keine | Gewerbeschein liegt vor; Mandat unterschrieben; USt-Frage schriftlich beantwortet |
| A-11 | Deploy-Prozess härten | Deploy-Checkliste (SW-Asset-Liste! 141 Script-Tags), Smoke-Test-Skript, Versionsdisziplin dokumentieren — Begründung: die handgepflegte SW-Asset-Liste ist die häufigste Quelle für „weiße Seite nach Update" | 10 | A-03 (Erfahrungen einarbeiten) | Checkliste existiert; ein Deploy wurde vollständig danach durchgeführt; Skript prüft Asset-Liste gegen `index.html` automatisch |
| A-12 | Engine-v2-Shadow-Auswertung | Shadow-Modus-Daten v1 vs. v2 systematisch vergleichen (Vorarbeit für Canary in Phase B); Abweichungskategorien definieren | 15 | A-03 (Live-Daten aktuell) | Report: Abweichungsquote je Plantyp; Liste der Blocker für Canary-Start; Go/No-Go-Empfehlung dokumentiert |
| A-13 | Live-Regressionslauf + Phasenabnahme | Voller manueller Regressionslauf auf Live (alle Kernflows, 2 Browser + 1 Mobilgerät), Gate-Nachweis erstellen | 10 | alle | Regressionsprotokoll ohne offenen Blocker; Gate-Checkliste A unterschrieben |
| — | **Summe AP** | 4+4+12+4+14+16+12+8+10+8+10+15+10 | **127** | | |
| — | **Puffer 15 %** | ungeplant, für Deploy-Überraschungen und Dual-Repo-Reibung | **23** | | |
| — | **Phase gesamt** | | **150** | | |

### A.2 Sprintplan (Sprint = 2 Wochen ≈ 40 h nominal; real ~37 h wegen Pufferanteil)

| Sprint | Zeitraum (ca.) | Inhalt | AP-Std. | Puffer |
|---|---|---|---|---|
| A-S1 | 01.–13.09.2026 | A-01, A-02, A-03, A-04, A-05 (Start, ~10 h) | 34 | 4 |
| A-S2 | 14.–27.09.2026 | A-05 (Abschluss, 4 h), A-06, A-11 | 30 | 6 (Deploy-Nachwehen erfahrungsgemäß hier) |
| A-S3 | 28.09.–11.10.2026 | A-07, A-08, A-09 | 30 | 6 |
| A-S4 | 12.–25.10.2026 | A-12, A-10, A-13 | 33 | 7 |
| **Σ** | | | **127** | **23** |

**Begründung der Sprint-Reihenfolge:** A-S1 stellt Testbarkeit (grüne Suite) und Live-Parität her — beides Voraussetzung für alles Folgende. A-S2 zieht CI-Abschluss und SSOT-Fundament vor, weil A-07 bis A-09 darauf schreiben. A-S4 sammelt Auswertung und Abnahme, weil der Shadow-Log (A-06) bis dahin ~4 Wochen Daten hat.

### A.3 Kritischer Pfad

**A-03 (Deploy) → A-04 (Retest) → A-06 (SSOT) → A-07/A-08/A-09 → A-13 (Abnahme).**
A-03 ist der Engpass: Solange live v8-343 läuft, sind Bug-Reports und Shadow-Daten nicht aussagekräftig. A-05 (CI) liegt parallel, wird aber ab A-06 zur Pflichtvoraussetzung (jede SSOT-Änderung nur via geschütztem Merge).

### A.4 Gate-Kriterien A→B (alle messbar)

1. Live-Version == lokale Version (SW meldet identische Versionsnummer).
2. 268 Tests + 166 Mutationsproben grün **in CI**, nicht nur lokal; Branch-Protection nachweislich aktiv (dokumentierter blockierter Test-PR).
3. `knowledge_targets` grün; kein roter Test im Repo.
4. Shadow-Log des Zielobjekts läuft ≥ 14 Tage ohne Schreibfehler; `goals_detail` erhebt bei 100 % neuer Onboardings einen Zielwert.
5. Engine-v2-Vergleichsreport liegt vor mit quantifizierter Abweichungsquote und Canary-Empfehlung.
6. Gewerbeschein vorhanden (Blocker für Garmin-Antrag in C).
7. Deploy-Checkliste existiert und wurde mindestens einmal vollständig angewendet.

### A.5 Typische Fehlerquellen / Anti-Patterns in Phase A

| Anti-Pattern | Warum gefährlich | Gegenmaßnahme |
|---|---|---|
| Alle 10 Versionen in einem Rutsch deployen | Bei Fehler ist unklar, welche Version ihn einführte; SW-Cache-Probleme kumulieren | Gestaffelt deployen (z. B. 344–348, Abnahme, dann 349–353) |
| Force-Push „zur Bereinigung" des Dual-Repos | Zerstört die GitHub-Wurzel-Historie unwiederbringlich — explizites Verbot | Branch-Protection serverseitig (A-05) vor jeder Historienarbeit |
| Shadow-Log „nur schnell" schon lesend nutzen | Verhaltensänderung ohne Datenvalidierung = genau das Risiko, das Shadow vermeiden soll | Lesen erst in Phase B nach 14-Tage-Diff |
| CI aufschieben („Tests laufen ja lokal") | Ohne CI ist Gate 2 unbelegbar; lokale Grün-Stände sind in Dual-Repo-Setups notorisch abweichend | A-05 fest in S1/S2, nicht verschiebbar |
| SW-Asset-Liste vergessen | 141 Script-Tags + Handpflege: ein fehlender Eintrag bricht Offline-Betrieb still | Automatisches Prüfskript (A-11) |
| Gewerbe/Steuerberater „später" | Vorlauf Behörden/Termine liegt außerhalb eigener Kontrolle; blockiert Garmin-Antrag | In S4 fix terminiert, notfalls vor AP-Arbeit |

### A.6 Cut-Linie bei Zeitmangel (zuerst gestrichen → zuletzt)

1. **A-12** Engine-v2-Auswertung (verschiebbar an den Anfang von B; kostet dort nur Sequenz, keinen Inhalt).
2. **A-09** Taper-Anbindung (reine SSOT-Nutznießerin, kann in B mit B-01 zusammenfallen).
3. **A-08** Feasibility-Leser (dito).
4. **Nie streichen:** A-01…A-07, A-10, A-11 — sie sind Gate-relevant oder extern terminiert.

---

## Phase B — Produktkern (Nov 2026–Feb 2027, ~300 h, Meilenstein M1)

### B.0 Zielbild

M1: Die Ziel→Plan-Kette ist geschlossen (der Plan wird aus dem konkreten Ziel erzeugt, nicht mehr nur aus der Kategorie — B1-Fix), Engine v2 ist über den Serverflag `engine_v2_plan` vollständig aktiv und v1 stillgelegt, das Gym-Erlebnis erreicht Hevy-Niveau (Supersets/Dropsets, 2-Tap-Übungstausch, Plate-Rechner), Progression ist satzgenau, Ausfall-/Krankheitslogik existiert, und die App ist strukturell zweisprachig (DE+EN). **Begründung:** Phase C darf keine Produktarbeit mehr enthalten — Stores prüfen das, was da ist; jedes in C nachgeschobene Feature verlängert Review-Zyklen.

### B.1 Arbeitspakete

| ID | Paket | Inhalt konkret | Std. | Abhängigkeiten | Definition of Done |
|---|---|---|---|---|---|
| B-01 | Ziel→Plan-Kette schließen (B1-Fix) | `generateWeekPlan` liest das Zielobjekt (Zielwert, Zieldatum) statt nur der Kategorie; Shadow-Log aus A-06 wird zur aktiven Quelle; Feasibility-Leser (A-08) und Taper (A-09) scharf schalten | 24 | Gate A (Shadow-Log validiert) | Zwei Nutzer mit gleicher Kategorie, aber unterschiedlichem Zielwert erhalten nachweislich unterschiedliche Wochenpläne; Tests decken Zielwert-Variation ab |
| B-02 | Ziel-Detailseite | UI: Ziel anzeigen/bearbeiten, Fortschritt gegen Zielwert, Feasibility-Hinweis | 20 | B-01 | Seite live; Änderung am Ziel ändert den nächsten Wochenplan; E2E-Testfall grün |
| B-03 | Profilstärke | Profilvollständigkeits-Score + gezielte Nachfragen | 12 | B-02 | Score sichtbar; jede fehlende Angabe verlinkt auf den erhebenden Schritt |
| B-04 | Onboarding v3 | Alle inaktiven Schritte füllen/aktivieren; Zielerhebung (aus A-07) in den Gesamtfluss integrieren; Abbruchquoten-Logging je Schritt | 24 | B-01 | Kein inaktiver Schritt mehr; neuer Nutzer erreicht ohne Support einen zielbasierten Plan; Schritt-Logging liefert Daten |
| B-05 | Gym-UX: Supersets/Dropsets | Datenmodell + UI für Supersets und Dropsets im Workout-Player | 16 | keine | Superset/Dropset anlegbar, durchführbar, in Historie korrekt; Sync-Roundtrip via Supabase verlustfrei |
| B-06 | Gym-UX: 2-Tap-Übungstausch | Übung im laufenden Workout in max. 2 Taps tauschen (Alternativenliste nach Muskelgruppe/Gerät) | 10 | B-05 (gemeinsames Datenmodell) | Usability-Nachweis: Tausch in ≤ 2 Taps ab Übungskarte; Historie bleibt konsistent |
| B-07 | Gym-UX: Plate-Rechner | Scheibenrechner (Hantelstange konfigurierbar, kg/lb) | 6 | keine | Rechner aus Satzansicht erreichbar; Rundungslogik getestet |
| B-08 | Satzgenaue Progression | Progression pro Satz (Gewicht/Wdh.) statt pro Übung; Regeln testgetrieben | 24 | B-05 | Progressionsvorschlag je Satz; definierte Regelfälle (Steigerung, Stagnation, Deload) als Tests grün |
| B-09 | Ausfall-/Krankheitslogik | Krank/verpasst-Meldung; Plan-Neuberechnung (Woche strecken vs. kürzen), Interaktion mit Taper | 16 | B-01 | Alle definierten Ausfallszenarien erzeugen einen gültigen Folgeplan; kein Plan-Totalverlust möglich (Test) |
| B-10 | Engine v2: Canary | `engine_v2_plan` für kleine Nutzerkohorte aktivieren; Abweichungs-Monitoring aus A-12-Kategorien | 12 | A-12 (oder nachgeholt), B-01 | Canary ≥ 14 Tage; Abweichungen klassifiziert; Abbruchkriterium definiert und nicht ausgelöst |
| B-11 | Engine v2: Vollaktivierung | Flag für 100 % setzen; v1 als Fallback zunächst behalten | 8 | B-10 | 100 % der Planerzeugung über v2; Fehlerrate nicht schlechter als Canary-Baseline |
| B-12 | Engine v1 stilllegen | v1-Codepfade entfernen; Tests umziehen; SW-Asset-Liste bereinigen | 12 | B-11 + 4 Wo stabiler Betrieb | v1-Code gelöscht; Testsuite grün; Bundle-/Asset-Liste verkleinert |
| B-13 | i18n-Struktur | Key-basiertes String-System für Vanilla JS (Details in Band 6 e); Extraktion aus `ui.js` (12.300 Zeilen) und weiteren Modulen; DE als Referenzsprache | 30 | keine, aber vor B-14 | Kein hartkodierter nutzersichtbarer String mehr in den Kernflows; Sprachumschaltung DE↔DE-Test (Pseudo-Locale) fehlerfrei |
| B-14 | EN-Übersetzung | Vollübersetzung EN inkl. Trainingsfachbegriffe; Review durch zweite Person | 25 | B-13 | EN vollständig; Pseudo-Locale-Test ohne fehlende Keys; Stichproben-Review dokumentiert |
| B-15 | Test-/Regressionsausbau | Testabdeckung für B-01…B-09 (Ziel: jede neue Logik mit Mutationsprobe); Erweiterung der 268er-Suite | 16 | laufend | Neue Features ohne Test gelten als nicht fertig; Mutationsproben für Progression + Ausfalllogik vorhanden |
| — | **Summe AP** | | **255** | | |
| — | **Puffer 15 %** | | **45** | | |
| — | **Phase gesamt** | | **300** | | |

### B.2 Sprintplan (8 Sprints, Nov 2026–Feb 2027; ~32 AP-h + ~5,5 h Puffer je Sprint)

| Sprint | Zeitraum (ca.) | Inhalt | AP-Std. |
|---|---|---|---|
| B-S1 | Anf. Nov | B-01 (24) + B-15-Anteil (8) — Kette schließen, sofort absichern | 32 |
| B-S2 | Mitte Nov | B-02 (20), B-10 Canary-Start (12) — Canary früh starten, damit 14-Tage-Fenster nicht den Jahreswechsel blockiert | 32 |
| B-S3 | Anf. Dez | B-04 (24), B-03 (8 von 12) | 32 |
| B-S4 | Mitte Dez | B-03 Rest (4), B-05 (16), B-11 (8), B-15-Anteil (4) — Vollaktivierung vor den Feiertagen nur, wenn Canary sauber; sonst Tausch mit S5-Inhalt | 32 |
| B-S5 | Anf. Jan | B-06 (10), B-07 (6), B-08 Start (16) | 32 |
| B-S6 | Mitte Jan | B-08 Rest (8), B-09 (16), B-15-Anteil (4), B-12 Start (4) | 32 |
| B-S7 | Anf. Feb | B-12 Rest (8), B-13 Start (24) | 32 |
| B-S8 | Mitte Feb | B-13 Rest (6), B-14 (25) | 31 |
| **Σ** | | | **255** |

**Begründung:** i18n (B-13/B-14) liegt bewusst am Ende — jeder vorher extrahierte String müsste bei UI-Änderungen (B-02…B-09) doppelt gepflegt werden. Engine-v2-Kette (B-10→B-11→B-12) ist zeitgetrieben (14-Tage-Canary, 4 Wochen Stabilität vor Stilllegung) und wird deshalb früh gestartet, obwohl die Arbeitsstunden klein sind.

### B.3 Kritischer Pfad

**B-01 → B-10 (14 Tage Canary) → B-11 (4 Wochen Stabilität) → B-12** sowie **B-01 → B-04** und **UI-Abschluss → B-13 → B-14.**
Der Engine-Pfad ist kalenderkritisch (Wartezeiten), der i18n-Pfad stundenkritisch (55 h am Phasenende ohne Ausweichfenster). Verzögert sich B-01, verschiebt sich M1 eins zu eins.

### B.4 Gate-Kriterien B→C (M1, messbar)

1. Zwei Testkonten, gleiche Kategorie, unterschiedlicher Zielwert → unterschiedliche Pläne (dokumentierter Nachweis).
2. `engine_v2_plan` = 100 %; v1-Code entfernt; Testsuite grün in CI.
3. Onboarding: 0 inaktive Schritte; Zielwert-Erhebungsquote 100 % bei Neuregistrierungen.
4. Gym: Superset, Dropset, 2-Tap-Tausch, Plate-Rechner je mit grünem E2E-Fall; Sync-Roundtrip verlustfrei.
5. Ausfalllogik: alle definierten Szenarien mit Test abgedeckt, keiner erzeugt einen ungültigen Plan.
6. EN: 0 fehlende Keys im Pseudo-Locale-Lauf; Kernflows in EN manuell abgenommen.
7. Testsuite gewachsen (> 268), neue Kernlogik mit Mutationsproben.

### B.5 Typische Fehlerquellen / Anti-Patterns in Phase B

| Anti-Pattern | Warum gefährlich | Gegenmaßnahme |
|---|---|---|
| v1 stilllegen direkt nach Vollaktivierung | Kein Fallback bei spät auftretenden v2-Fehlern | Feste 4-Wochen-Stabilitätsfrist vor B-12 |
| Gym-Features ohne Sync-Test | Supabase-Konflikte zeigen sich erst bei zwei Geräten | Sync-Roundtrip ist Teil jeder Gym-DoD |
| i18n „nebenbei" ab Sprint 1 | Doppelpflege bei jedem UI-Umbau in `ui.js` (12.300 Zeilen) | i18n strikt nach UI-Abschluss (S7/S8) |
| Strings per Suchen/Ersetzen extrahieren | In 12.300 Zeilen mit Template-Strings hohe Fehlquote | Modulweise Extraktion mit Review, s. Band 6 e |
| Feature-Scope „Hevy-Niveau" ausufern lassen | Hevy ist Referenz, nicht Lastenheft | Scope fix: die 3 genannten Features, sonst Backlog E |
| Canary über Feiertage starten | Auffälligkeiten bleiben 2 Wochen unbeobachtet | Canary-Start Mitte Nov (B-S2), Vollaktivierung nur bei sauberem Fenster |
| Neue Logik ohne Mutationsprobe | Grüne Tests ohne Aussagekraft (bekanntes Projektrisiko, daher existieren die 166 Proben) | B-15 als Querschnitts-AP mit eigener Stundenreserve |

### B.6 Cut-Linie bei Zeitmangel

1. **B-07** Plate-Rechner (isoliert, 6 h, in E nachholbar).
2. **B-03** Profilstärke (nice-to-have für M1).
3. **B-12** v1-Stilllegung (nur Hygiene; Flag bleibt auf 100 %, Code-Entfernung nach C).
4. **B-06** 2-Tap-Tausch (schmerzhaft, aber nicht M1-kritisch).
5. **Nie streichen:** B-01, B-04, B-10/B-11, B-13/B-14 — M1-Definition bzw. harte Launch-Voraussetzung (DE+EN ab Launch ist beschlossen).

---

## Phase C — Store-Ready (Feb–Apr 2027, ~200 h)

### C.0 Zielbild

Die PWA läuft als Capacitor-App mit **gebündelten Assets** (kein Remote-Loading — Apple-Pflicht), Health-Anbindung (HealthKit + Health Connect via `@capgo/capacitor-health`), Push, RevenueCat-Monetarisierung (Free/Pro 9,99 €/Mo, 79,99 €/Jahr, 14 d Trial; Founder-Lifetime 149 €), In-App-Kontolöschung (Supabase Edge Function, Apple 5.1.1(v)), vollständige Rechtstexte DE+EN, bestandener MDR-Formulierungsaudit, laufender Play Closed Test (12 Tester/14 Tage — Pflicht für neue Konten) und eingereichte/vorbereitete Apple-Review inkl. 4.2-Argumentation. Beta mit 50–100 Testern läuft.

### C.1 Arbeitspakete

| ID | Paket | Inhalt konkret | Std. | Abhängigkeiten | Definition of Done |
|---|---|---|---|---|---|
| C-01 | Capacitor-Setup + Asset-Bundling | Projekt aufsetzen; alle 141 Script-Tags und Assets lokal bündeln (kein Laden von GitHub Pages); SW-Rolle im Wrapper klären; Details Band 6 a | 24 | Gate B | App startet auf iOS + Android im Flugmodus vollständig; kein Netzwerkzugriff auf `/ORVIA.2/` beim Start |
| C-02 | Health-Integration | `@capgo/capacitor-health`: HealthKit (iOS) + Health Connect (Android); Lese-Scopes minimal | 16 | C-01 | Herzfrequenz/Workouts lesbar auf beiden Plattformen; Berechtigungsdialoge lokalisiert DE+EN |
| C-03 | Push-Notifications | Capacitor Push (APNs + FCM); Opt-in-Flow; nur Trainings-Reminder zum Start | 10 | C-01 | Push erreicht Testgerät iOS + Android; Opt-out funktioniert |
| C-04 | RevenueCat | `purchases-capacitor`; Produkte Pro-Monat 9,99 €, Pro-Jahr 79,99 € (14 d Trial), Founder-Lifetime 149 €; Entitlement-Gates in der App; Details Band 6 d | 20 | C-01 | Sandbox-Kauf aller 3 Produkte erfolgreich; Entitlement schaltet Pro-Features; Restore funktioniert |
| C-05 | In-App-Kontolöschung | Supabase Edge Function: vollständige Löschung (Auth + Daten); UI-Eintrag in Einstellungen | 8 | keine | Konto + alle Zeilen nachweislich gelöscht (DB-Prüfung); Apple 5.1.1(v) erfüllt |
| C-06 | Consent + Rechtstexte | Art.-9-Consent (Gesundheitsdaten) vor erster Erhebung; DSE, Impressum, AGB in DE+EN | 16 | i18n aus B | Consent blockiert Datenerhebung bis Zustimmung; alle Texte in beiden Sprachen erreichbar |
| C-07 | MDR-Formulierungsaudit | Alle App-/Store-Texte auf medizinische Zweckbestimmung prüfen (keine Diagnose-/Therapieversprechen), damit ORVIA nicht als Medizinprodukt einzustufen ist | 8 | C-06 | Auditprotokoll: 0 offene Fundstellen; geänderte Formulierungen eingespielt |
| C-08 | Play Closed Test | Play-Konto (25 $), Health Apps Declaration, Data Safety; Closed Test mit 12 Testern über 14 Tage starten (Pflicht für neue Konten) — **früh starten, da kalenderkritisch** | 12 | C-01, C-06 | 12 Tester aktiv; 14-Tage-Zähler läuft; Declarations eingereicht und akzeptiert |
| C-09 | Apple-Review-Vorbereitung | 4.2-Risiko (Web-Wrapper) aktiv adressieren: HealthKit, Push, Offline als native Mehrwerte in Review-Notes; Demo-Account mit Daten; iPad-Layout prüfen; 99 €/Jahr-Konto, Small Business Program (15 %) beantragen | 20 | C-01…C-05 | Review-Notes final; Demo-Account funktioniert ohne Anleitung; iPad ohne Layoutbruch; Einreichung möglich |
| C-10 | Garmin-Developer-Antrag | Offiziellen Garmin-API-Zugang beantragen (braucht Gewerbe aus A-10) — Ziel: den fragilen, Cloudflare-blockierten Python-Worker auf Railway ablösen | 6 | A-10 | Antrag eingereicht; Status dokumentiert (Bewilligung liegt außerhalb eigener Kontrolle) |
| C-11 | Beta 50–100 Tester | TestFlight + Play Closed/Open Test; Rekrutierung, Feedbackkanal, wöchentliche Auswertung | 20 | C-08, C-09 | ≥ 50 aktive Tester; Feedbackprozess läuft; Crash-freie Rate gemessen |
| C-12 | Store-Assets | Screenshots (iPhone, iPad, Android), Listing-Texte DE+EN, Privacy-Nutrition-Labels/Data-Safety-Einträge konsistent | 10 | C-07 (Formulierungen) | Beide Listings vollständig ausgefüllt; Labels stimmen mit DSE überein |
| — | **Summe AP** | | **170** | | |
| — | **Puffer 15 %** | primär für Review-Ablehnungen und Plugin-Überraschungen | **30** | | |
| — | **Phase gesamt** | | **200** | | |

### C.2 Sprintrahmen (5 Sprints)

C-S1: C-01 + C-08-Start (Konto/Declarations) · C-S2: C-02, C-03, C-05 · C-S3: C-04, C-10 · C-S4: C-06, C-07, C-12 · C-S5: C-09, C-11-Start; Beta läuft in D hinein. Begründung: C-01 blockiert fast alles; C-08 hat externe 14-Tage-Frist und muss deshalb trotz später DoD sofort angestoßen werden.

### C.3 Kritischer Pfad

**C-01 → C-02/C-03/C-04 → C-09 → Apple-Einreichung** parallel zu **C-08 (14-Tage-Testpflicht) → Play-Produktionsfreigabe.**
Beide Store-Pfade enthalten Wartezeiten Dritter (Review, Testfrist, Garmin-Bewilligung); deshalb liegt der Phasenpuffer bewusst auf Ablehnungs-Iterationen.

### C.4 Gate-Kriterien C→D (messbar)

1. App startet auf iOS + Android offline vollständig (Flugmodus-Test protokolliert).
2. Sandbox: alle 3 Produkte kaufbar, Trial korrekt, Restore korrekt.
3. Kontolöschung: In-App auslösbar, DB nachweislich leer.
4. Play: 12-Tester-/14-Tage-Kriterium erfüllt, Health Declaration + Data Safety akzeptiert.
5. Apple: Build eingereicht oder bereits approved; 4.2-Notes final; Demo-Account aktiv.
6. MDR-Audit: 0 offene Fundstellen.
7. Beta: ≥ 50 Tester, crash-freie Rate ≥ 99 % (Schätzung als Zielwert; final in C festlegen).
8. Rechtstexte DE+EN live und aus der App verlinkt.

### C.5 Typische Fehlerquellen / Anti-Patterns in Phase C

| Anti-Pattern | Warum gefährlich | Gegenmaßnahme |
|---|---|---|
| Wrapper lädt weiter von GitHub Pages | Apple-Ablehnung (kein Remote-Loading), 2.5.2-Risiko | C-01-DoD: Flugmodus-Start; Netzwerk-Audit im Review |
| 4.2 ignorieren („wird schon durchgehen") | Web-Wrapper ist der klassische 4.2-Ablehnungsgrund | Native Mehrwerte (HealthKit, Push, Offline) einbauen **und** in Review-Notes benennen |
| Play-Testpflicht spät starten | 14 Tage sind nicht komprimierbar | C-08 in Sprint 1 anstoßen |
| Lifetime-IAP falsch als Abo anlegen | Founder-Lifetime 149 € ist Non-Consumable/One-time, kein Abo | Produkttyp-Review im RevenueCat-Setup (Band 6 d) |
| Health-Scopes maximal anfordern | Health Declaration + App-Review-Risiko steigen | Nur benötigte Lese-Scopes; Begründung je Scope dokumentieren |
| Data Safety ≠ DSE | Inkonsistenz ist ein Play-Ablehnungsgrund | C-12-DoD verlangt Abgleich |
| MDR-Audit nach Store-Texten | Doppelarbeit bei Fundstellen | C-07 vor C-12 |

### C.6 Cut-Linie bei Zeitmangel

1. **C-10** Garmin-Antrag inhaltlich (nur Antrag abschicken, Integration ohnehin später).
2. **C-03** Push (Launch ohne Push möglich, schwächt aber 4.2-Argumentation — nur streichen, wenn HealthKit + Offline stark belegt sind).
3. **C-11** auf 50 Tester am unteren Rand.
4. **Nie streichen:** C-01, C-04, C-05, C-06, C-07, C-08, C-09 — jeweils harte Store-/Rechtspflicht.

---

## Phase D — Launch (Mai 2027, Meilenstein M2, ~80 h; Kapazität Schätzung)

### D.0 Zielbild

Beide Apps sind live, Founder-Lifetime-Angebot (149 €) aktiv, Monitoring und Rollback-Pfade stehen (Runbook: Band 6 g/h). M2 = öffentlicher, kaufbarer Launch DE+EN.

### D.1 Arbeitspakete

| ID | Paket | Inhalt konkret | Std. (Schätzung) | Abhängigkeiten | DoD |
|---|---|---|---|---|---|
| D-01 | Review-Iterationen | Ablehnungen beheben (realistisch 1–2 Zyklen bei Apple) | 16 | Gate C | Beide Apps approved |
| D-02 | Launch-Freigabe + Runbook-Ausführung | Gestaffelter Rollout (Android stufenweise), Launch-Tag nach Band 6 g | 10 | D-01 | Runbook vollständig abgearbeitet, Protokoll liegt vor |
| D-03 | Founder-Kampagne | Lifetime-Angebot, Landingpage, Kommunikation an Beta-Tester | 14 | D-01 | Angebot kaufbar; erste Founder-Käufe verifiziert |
| D-04 | Monitoring + Hotfix-Bereitschaft | Crash-/Fehler-Monitoring, Supabase-Last, Störungsplan aktiv | 16 | D-02 | Alarmierung getestet; ein geübter Hotfix-Durchlauf (Dry-Run) |
| D-05 | Support + Feedback-Triage | Supportkanal, FAQ DE+EN, tägliche Triage in Woche 1–2 | 12 | D-02 | Antwortzeit < 24 h in Launch-Wochen; Bug-Triage-Board gepflegt |
| — | **Summe AP** | | **68** | | |
| — | **Puffer 15 %** | | **12** | | |

### D.2 Kritischer Pfad, Gate, Anti-Patterns, Cut-Linie

- **Kritischer Pfad:** D-01 → D-02 → D-03. Apple-Reviewdauer ist der einzige nicht steuerbare Block.
- **Gate D→E (messbar):** beide Stores live; ≥ 1 verifizierter Kauf je Produkttyp (Monat/Jahr/Lifetime) in Produktion; crash-freie Rate ≥ 99 % in Woche 1 (Schätzung als Zielwert); kein offener P1-Incident.
- **Anti-Patterns:** Launch ohne gestaffelten Android-Rollout; Preisänderungen in Launch-Woche; Hotfixes am Store-Review vorbei „per Live-Update" (verboten, s. Band 6 a — Grenzen von Live-Updates); Marketing-Push vor bestätigter Kauf-Funktion.
- **Cut-Linie:** D-03 verschieben (Launch ohne Kampagne ist möglich, umgekehrt nicht); D-05 auf Minimalbetrieb. Nie streichen: D-01, D-02, D-04.

---

## Phase E — Wachstum (Jun–Dez 2027, Meilenstein M3 = 1.000+ Zahler, ~600 h Schätzung)

### E.0 Zielbild

M3: 1.000+ zahlende Nutzer. Der Weg dorthin: Conversion-Optimierung (Trial→Pro), Retention über Produktqualität (Gym-UX-Ausbau, Progressionstiefe), offizielle Garmin-Integration (Ablösung des Railway-Workers, Freischaltung `/workout/push`), technischer Schuldenabbau (GM7 Legacy-DOM, `ui.js`-Modularisierung), damit die Velocity nicht einbricht.

### E.1 Arbeitspakete (Rahmen; Stunden = Schätzung)

| ID | Paket | Inhalt konkret | Std. | Abhängigkeiten | DoD |
|---|---|---|---|---|---|
| E-01 | Funnel-Messung + Conversion | Trial-Funnel instrumentieren; Paywall-Varianten; Onboarding-Drop-off aus B-04-Logging abbauen | 60 | D live | Funnel-Dashboards; ≥ 2 datenbasierte Iterationen durchgeführt |
| E-02 | Garmin offiziell | Bei Bewilligung (C-10): offizielle API integrieren, Railway-Worker abschalten, `/workout/push` freischalten | 80 | C-10 bewilligt | Kein Traffic mehr über inoffiziellen Worker; Workout-Push an Garmin-Geräte live |
| E-03 | ASO + Content DE/EN | Store-Optimierung, Bewertungsanfragen-Flow, Inhalte | 70 | D live | Messbare Verbesserung Store-Conversion (Baseline aus D) |
| E-04 | Retention-Features | Auswertungen/Trends, Progressionseinblicke, Gym-Backlog aus B-Cut-Linie | 90 | — | Je Feature: Nutzungsquote gemessen |
| E-05 | GM7 Legacy-DOM-Abbau | Legacy-DOM in `index.html` entfernen | 50 | — | 0 Legacy-DOM-Reste; Lighthouse-/Startzeit-Verbesserung dokumentiert |
| E-06 | `ui.js`-Modularisierung | 12.300 Zeilen schrittweise in Module schneiden; 141 Script-Tags Richtung Bündelung konsolidieren; SW-Asset-Liste automatisieren | 90 | E-05 sinnvoll vorher | `ui.js` < 3.000 Zeilen (Zielwert = Schätzung); Asset-Liste generiert statt handgepflegt |
| E-07 | Preis-/Angebotstests | Jahresabo-Positionierung, Founder-Auslauf entscheiden | 30 | E-01 | Entscheidung dokumentiert mit Zahlenbasis |
| E-08 | Skalierung/Betrieb | Supabase-Limits, Kosten, Backups, Alarmierung ausbauen | 40 | — | Lasttest-Nachweis für Zielgröße 1.000+ Zahler |
| — | **Summe AP** | | **510** | | |
| — | **Puffer 15 %** | | **90** | | |

### E.2 Kritischer Pfad, Gate, Anti-Patterns, Cut-Linie

- **Kritischer Pfad:** E-01 → E-07 (Monetarisierung ist der M3-Hebel); E-02 hängt extern an Garmin.
- **Gate E→F (M3, messbar):** ≥ 1.000 aktive Zahler; Trial→Paid-Conversion und Monats-Churn werden gemessen und sind über 2 Quartale stabil oder steigend; Railway-Worker abgeschaltet (sofern Garmin bewilligt).
- **Anti-Patterns:** Wachstumsausgaben vor gemessener Retention; Refactoring (E-06) komplett aufschieben, bis Featurearbeit unmöglich wird — oder umgekehrt monatelanges Refactoring ohne Nutzerwert; Feature-Zusagen an einzelne laute Beta-Tester.
- **Cut-Linie:** E-03-Umfang, E-07, Teile von E-04. Nie streichen: E-01 (ohne Messung kein M3-Steuern), E-08 (Betriebsrisiko).

---

## Phase F — Community/B2B (2028, Rahmenplanung)

### F.0 Zielbild und Rahmen

Auf stabiler M3-Basis: Community-Funktionen (Pläne teilen, Challenges) und B2B-Pilot (Trainer/Studios verwalten Klienten). Detailplanung erfolgt Ende 2027 auf Basis der E-Daten; hier nur Struktur, um Vorentscheidungen (Datenmodell, Mandantenfähigkeit) nicht zu verbauen.

| ID | Paket | Inhalt (Rahmen) | Abhängigkeiten | Frühindikator für Go |
|---|---|---|---|---|
| F-01 | Community-MVP | Plan-Sharing, Profile, Moderationskonzept | E-06 (Modulbasis) | Organische Nachfrage in Support/Feedback |
| F-02 | B2B-Pilot | Trainer-Rolle, Klientenverwaltung, Abrechnung getrennt von RevenueCat-B2C prüfen | Mandantenfähiges Datenmodell | ≥ 5 Trainer-Interessenten aus E |
| F-03 | Preismodell B2B | Sitzplatz- vs. Klientenpreis | F-02-Pilot | Zahlungsbereitschaft im Pilot belegt |

- **Gate-Idee (messbar, vorläufig):** B2B-Go nur bei ≥ 5 zahlenden Pilotkunden; Community-Go nur bei nachgewiesener organischer Nachfrage — beides sonst verschieben.
- **Anti-Pattern:** B2B parallel zum B2C-Wachstum „nebenbei" starten; Community ohne Moderations- und Rechtskonzept (UGC, DSGVO).
- **Cut-Linie:** F ist als Ganzes die Cut-Masse des Gesamtplans — M3-Verfehlung in E verschiebt F vollständig.

---

## Anhang: Querschnittsrisiken über alle Phasen

| Risiko | Betroffene Phasen | Frühwarnsignal | Vorkehrung im Plan |
|---|---|---|---|
| Kapazität fällt auf 15 h/Wo | alle | 2 Sprints in Folge < 80 % AP-Erledigung | 15-%-Puffer + Cut-Linien je Phase |
| Dual-Repo-Unfall (Force-Push) | A–C | — (muss verhindert, nicht erkannt werden) | Serverseitige Branch-Protection (A-05) |
| Apple 4.2-Ablehnung | C/D | Reviewer-Rückfragen zu „web-like experience" | Native Mehrwerte + Review-Notes (C-09), Puffer C auf Iterationen gelegt |
| Garmin-Antrag abgelehnt/verzögert | C/E | Keine Antwort > 8 Wochen | Railway-Worker bleibt Fallback; E-02 ist einziges davon abhängiges AP |
| Engine-v2-Regression nach Aktivierung | B | Canary-Abweichungen außerhalb A-12-Kategorien | v1-Fallback bis 4 Wochen nach Vollaktivierung |
| SW-Cache liefert alte Assets nach Deploy | A–E | Nutzer melden „alte Version trotz Update" | Versions-Cache-Disziplin + Prüfskript (A-11) |
