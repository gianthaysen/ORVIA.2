# ORVIA · Analyse des Feedback-Dumps vom 2026-08-05

Reiner Analyse-Auftrag ("ich will erstmal die anderen Punkte analysieren") — **keine Code-Änderungen** in diesem Schritt. Jeder Punkt ist gegen den tatsächlichen Code geprüft, nicht nur gegen die Beschreibung.

---

## 1. Kernergebnis

Von den ~18 gemeldeten Punkten sind:

- **5 echte Bugs mit eindeutig identifizierter Ursache** (sofort fixbar, geringes Risiko)
- **6 Punkte, die auf denselben strukturellen Grund zurückgehen**: die Live-Oberfläche läuft noch auf dem alten v1-Heuristik-/Platzhalter-Pfad, während die eigentlich fähige Engine (scheduler-v2 / decision-engine-v2) bereits existiert, aber nur im Shadow-Modus läuft (Phase 8) und **den Nutzer noch nicht erreicht**
- **3 Design-/Redesign-Wünsche** (kein Bug, Aufwandsschätzung nötig)
- **4 Punkte ohne eindeutigen Codebefund** — hier fehlen mir entweder die konkrete Aktivität/das Profil-Detail oder ein Reproduktionsschritt, um die Ursache sauber zu belegen, statt zu raten

**Wichtigster Befund:** Ein Großteil der Plan-bezogenen Beschwerden (kein Rad im Plan, falscher Ruhetag, 7 statt 10 Einheiten, keine Zielprognose, keine Zielqualität, keine Tagesziele) ist **kein Bündel von Einzelfehlern**, sondern **ein Symptom**: `generateWeekPlan()` (js/ui.js:253) ist eine Tag-basierte v1-Heuristik aus einer früheren Phase, die strukturell nicht mehr leisten kann, was das Produkt inzwischen verspricht. Die Reparatur dieser Funktion wäre Zeitverschwendung — die eigentliche Lösung ist, die bereits gebaute und in Phase 8 verifizierte Engine an die UI anzuschließen (bereits als offener Punkt "Engine-Output erreicht den Nutzer" im Umsetzungsplan vermerkt).

---

## 2. Ausgangslage und Annahmen

- Analyse erfolgte durch Lesen des tatsächlichen Quellcodes (js/ui.js, js/achievements.js, js/run-bests.js, js/gym-volume.js, js/profile-model.js, js/workout-ui.js, styles.css) — nicht durch Vermutung.
- Für Punkte, die von konkreten Zahlen im Profil abhängen (z. B. wie viele Tage als "verfügbar" markiert sind), habe ich keinen Zugriff auf deine Live-Datenbank — die Mechanik ist belegt, die exakte Zahl in deinem Fall nicht.
- Live-Reproduktion in einem echten Browser (Klick-für-Klick) wurde für diese Analyse nicht durchgeführt — das wäre der nächste Schritt bei den unklaren Punkten (Abschnitt 6).

---

## 3. Ursachenanalyse — gruppiert nach Root Cause

### Gruppe A — Strukturell: v1-Plan-Heuristik statt Engine (6 Punkte, 1 Ursache)

| Gemeldetes Problem | Fundstelle | Befund |
|---|---|---|
| "Er hat kein Fahrradfahren drin" | `generateWeekPlan()`, js/ui.js:282–290 | Bei Sport-Kombination Lauf+Gym+Rad greift der Zweig `runGoal‖(run&&!swim)` (Zeile 282). Der fügt **genau eine** Rad-Einheit hinzu (`w[5]=…concat([gpB('Easy Z2','60 min')])`, Zeile 285) — kein Bug im Sinne von "fehlt", sondern **hartkodiert auf maximal 1×/Woche**, unabhängig davon, wie viele Rad-Einheiten du im Profil eingestellt hast. |
| "Ich will 10 Einheiten, habe nur 7" | js/ui.js:328–339 (Obergrenzen-Logik) | `maxDays` = Anzahl der als verfügbar markierten **Tage** (`effectiveTrainingConfig`, js/profile-model.js:1456–1458), gedeckelt bei max. `maxSessionsPerWeek`. Die Kappung zählt **aktive Tage, nicht aktive Einheiten** — eine Woche hat nur 7 Tage. Um 10 Einheiten/Woche zu erreichen, müsste der Generator mehrfach am selben Tag planen; das tut er nur vereinzelt (z. B. Gym-Tage, die mit Lauf/Rad zusammenfallen). Rechnerisch: bei 7 verfügbaren Tagen und überwiegend 1 Einheit/Tag landet man strukturell bei 7, nicht 10 — passt zu deiner Beobachtung. |
| Falscher Ruhetag | `alignPlanToAvailability()`, js/ui.js:368–382 | Die Funktion existiert und respektiert `PROFILE.availability.days[x].restDay`. Wenn der falsche Tag als Ruhetag erscheint, ist die wahrscheinlichste Ursache eine **Abweichung zwischen dem, was im Profil als Ruhetag hinterlegt ist, und dem, was du erwartest** — nicht zwingend ein Logikfehler. Ohne dein aktuelles Availability-Profil kann ich das nicht abschließend von einem echten Bug unterscheiden (siehe Abschnitt 6). |
| Zielprognose zeigt nur "—" | js/ui.js:5979–5988 | Explizit als Platzhalter gebaut: `GM_NA` + Kommentar *"der Prognosekorridor erscheint mit der externen Trainingsengine"*. **Kein Bug — bewusster Leerzustand**, bis Phase 8 live ist. |
| Zielqualität fehlt | Gleiche Sektion, direkt anschließend an Zielprognose | Gleiches Muster: strukturell an die externe Engine gebunden, aktuell durch Konstruktion nicht befüllbar. |
| Tagesziele "noch nicht verfügbar" | Gleiches Muster (Datenvertrag noch nicht vorhanden) | Konsistent mit dem "keine erfundenen Werte"-Prinzip, das im gesamten Code durchgehalten wird (z. B. auch bei Zielprognose/-qualität). Ehrliches Verhalten, aber der Nutzen bleibt aus, bis die Engine live ist. |

**Einordnung:** Alle sechs Punkte sind **keine Einzelfehler, sondern ein Architektur-Rückstand**. Der Wortlaut "das müsstest Du eigentlich auch schon längst eingearbeitet haben" ist nachvollziehbar, trifft aber den falschen Hebel — Nacharbeiten an `generateWeekPlan()` wäre in Kürze wieder Wegwerfarbeit, sobald Phase 8 live geht.

### Gruppe B — Echte, isolierte Bugs (5 Punkte)

| # | Problem | Fundstelle | Ursache | Schweregrad |
|---|---|---|---|---|
| B1 | "3.8, 4.8…" statt Wochentag im Plan | js/ui.js:5938 & 5962 | `dLbl = dd2.getDate()+'.'+(dd2.getMonth()+1)` — hartkodiertes `Tag.Monat`-Format. Das existierende Wochentags-Array (`DAYNAMES`/`DN`, z. B. Zeile 217) wird an dieser Stelle **gar nicht referenziert**, obwohl es an 5 anderen Stellen im selben File genutzt wird. Klarer, isolierter Fix. | Niedrig (kosmetisch, aber nervig, täglich sichtbar) |
| B2 | "12 Medaillen verdient, nur 6 angezeigt" | `gmProfMedals()`, js/ui.js (Medal-Grid) | Hartkodiertes `if(slots.length>=6)return;` — das Raster ist bewusst auf 6 Slots begrenzt und schneidet den Rest **stillschweigend ab**. `ach.medals.length` (die echte Zahl) wird an der Stelle gar nicht genutzt, um z. B. "6 von 12" anzuzeigen. Eindeutiger UI-Bug, keine Rechenfehler in `achievements.js` selbst — die Berechnung liefert korrekt 12, nur die Darstellung kappt. | Mittel (Datenverlust in der Wahrnehmung, nicht in den Daten) |
| B3 | Phasen-Chips bis zum Ziel abgeschnitten | styles.css:3230–3233 | Der v8-241-Fix hat nur `overflow:hidden` + `text-overflow:ellipsis` ergänzt, um Überlappung zu verhindern — das verhindert Überlappung, aber macht längere Phasennamen weiterhin unlesbar. Kein Logikfehler, sondern eine **unzureichende Lösung des eigentlichen Problems** (Platz, nicht Overflow-Verhalten). | Mittel |
| B4 | "Backup älter als 7 Tage"-Banner breiter als der Rest | js/ui.js:2286 + styles.css `.banner` (Zeile 207ff) | `.banner` hat kein explizites Breiten-/Margin-Verhalten, das an `.gmcard`/`.card` (Zeile 914ff) angeglichen ist. Sehr wahrscheinlich fehlt dem Banner-Container dasselbe horizontale Padding wie den umgebenden Karten. Ursache identifiziert, exakter CSS-Fix noch nicht ausgemessen (bräuchte einen Screenshot-Vergleich der berechneten Breiten). | Niedrig (visuell) |
| B5 | Aktivität → "Dauer bearbeiten" tut nichts | `gmOpenActivityPage()`, js/ui.js:6415ff | **Wichtiger Befund:** Der Code enthält explizit den Hinweistext *"Quelle unverändert übernommen — keine Nachbearbeitung im UI"* bzw. *"in ORVIA aufgezeichnet — keine Nachbearbeitung im UI"* (Zeile ~6443). Die Aktivitätsdetailseite ist **absichtlich schreibgeschützt** — ich finde im gesamten UI-Code keinen gebundenen Handler namens "Dauer bearbeiten" für abgeschlossene Aktivitäten. Zwei Möglichkeiten: (a) du klickst auf ein Element, das wie ein Editier-Button aussieht, aber keiner ist (UX-Fehlleitung), oder (b) das Feature existiert nur in einem anderen Kontext (z. B. während einer laufenden Session in `workout-ui.js`, dort GIBT es `editSet`/`delSet` für Sätze). Für einen präzisen Fix brauche ich einen Screenshot genau der Stelle, auf die du klickst. | Unklar bis Repro vorliegt |

### Gruppe C — Design-/Redesign-Wünsche, kein Bug (3 Punkte)

- **Energie & Ernährung**: Karte existiert (js/nutrition.js), aber du willst eine strukturelle Neugestaltung (Kalorienkurve, Tageswert, Makroaufteilung, Integration statt separates "Modul hinzufügen"). Das ist eine **Funktionserweiterung**, kein Fehler — Aufwand hängt vom gewünschten Umfang ab (v. a. die Kalorienkurve über Zeit ist neu, nicht nur Redesign).
- **Routinen & Supplements**: Gleiche Einordnung — bestehend, aber visuell/strukturell nicht an das neue UI angeglichen.
- **Abend-Check-in**: Gleiche Einordnung.

Für alle drei gilt: Ich kann die Umsetzung planen, sobald du sagst, ob es primär **Optik** (an bestehendes UI-Kit angleichen) oder auch **neue Funktionalität** (z. B. echte Kalorienverlaufskurve) sein soll — das sind unterschiedlich große Arbeitspakete.

### Gruppe D — Ohne eindeutigen Codebefund, brauchen Klärung (4 Punkte)

| # | Problem | Was ich geprüft habe | Warum ich hier nicht rate |
|---|---|---|---|
| D1 | Bestzeit zeigt 29:35, du bist aber ~25:50 gelaufen | `bestTimes()` (js/ui.js:3457) + `measuredRunBests()` (js/run-bests.js). Das Modul ist **bewusst konservativ**: eine Bestzeit zählt nur aus **zusammenhängenden Runden**, deren Summendistanz die Zieldistanz erreicht (max. 5 % Überhang, `SLACK=0.05`). Ohne passende Rundendaten (Laps) fällt es auf die Gesamtaktivität zurück — nur wenn deren Distanz selbst im Zielfenster liegt. **Sehr wahrscheinliche Erklärung:** dein schnellerer 5-km-Abschnitt lag innerhalb einer längeren Einheit (z. B. Tempo-/Intervalltraining) ohne durchgehende 5-km-Rundenmarkierung — das System zeigt dann bewusst *nicht* diese schnellere Zeit, weil es sie nicht sauber isolieren kann (kein "Beschönigen", by design). Das kann aber auch ein echter Datenlücken-Fall sein. | Ich müsste die konkrete Aktivität (Laps/Distanz/Datum) sehen, um zwischen "System funktioniert wie gebaut" und "Datenlücke" zu unterscheiden. |
| D2 | "Sätze verschwinden" beim Bearbeiten | `workout-ui.js` (Live-Workout-Overlay) hat funktionierende `editSet`/`delSet`-Handler mit Store-Anbindung (`O.workoutStore`) | Kein offensichtlicher Fehler im Code sichtbar; Datenverlust-Bugs dieser Art sind oft Race Conditions (schnelles Tippen + Re-Render) oder Sync-Konflikte, die sich nur live reproduzieren lassen. |
| D3 | Kilometer-Splits in Aktivitäten "noch nicht verfügbar" | `gmOpenActivityPage()` liest `vm.canonicalSplits` mit Fallback auf Legacy-Blob-Splits; die Infrastruktur existiert nachweislich (wird von `run-bests.js` genutzt) | Ob "nicht verfügbar" eine echte Datenlücke bei DIESER Aktivität ist oder ein Anzeigefehler, kann ich ohne die konkrete Aktivität nicht unterscheiden. |
| D4 | Körper-/Muskelkarte zeigt trotz eingetragener Sätze nichts, "nur bei 90 Tagen" | `gym-volume.js`: Standardfenster ist **28 Tage**, nicht 90 (`window._mvDays||28`). Sätze werden nur ausgeschlossen, wenn sie als Aufwärm-/unvollständig markiert sind (`isCountable`) oder die Übung nicht muskelklassifiziert ist. Mögliche Ursachen: (a) das Aktivitätsdatum liegt außerhalb des 28-Tage-Fensters, (b) die Übungsnamen sind nicht in der Muskel-Zuordnungstabelle erfasst ("unclassified"), (c) die Sätze wurden als nicht zählbar markiert. | Alle drei sind plausibel und je nach Fall unterschiedliche Fixes — ohne Screenshot/Übungsnamen rate ich hier nicht. |
| — | Proteinziel-Anzeige (grüne Schrift trotz seltenem Treffen) | Keine Fundstelle mit Farb-/Schwellenlogik für Protein in js/nutrition.js oder js/ui.js gefunden — entweder anderer Dateiname oder ich habe die falsche Stelle gesucht. | Niedrigste Priorität der offenen Punkte; brauche entweder mehr Suchzeit oder einen Screenshot mit sichtbarer Klasse (DevTools). |

### Gruppe E — Kein Bug, richtiges Verhalten mit Erklärungsbedarf (1 Punkt)

- **Meilensteine, letzter Eintrag leer**: `gmProfMilestones()` füllt die Liste **bewusst auf 6 Slots auf** (`list=PROFILE.milestones.slice(0,6)`, fehlende Einträge werden mit "—" aufgefüllt) — exakt dasselbe Muster wie bei den Medaillen (B2), nur hier **beabsichtigt als Platzhalter für ein 6. Ziel, das du noch nicht angelegt hast**. Dein Wunsch nach "ein, zwei mehr Meilensteinen" ist damit kein Bug, sondern ein Content-Wunsch: leere Slots im Zielportfolio ergänzen.

---

## 4. Relevante Berechnung — Tage- vs. Einheiten-Deckel (Gruppe A)

Kurze Nachvollziehbarkeit für den 7-statt-10-Befund:

```
targetDays = availableDayIdx.length   (Anzahl NICHT-Ruhetage, max. 7)
             ⨯ ggf. gedeckelt durch maxSessionsPerWeek
Obergrenzen-Logik (js/ui.js:331–339):
  aktive Tage > maxDays  →  Tage mit niedrigster Priorität werden GELEERT
```

Bei 7 Kalendertagen und typischerweise 1–2 Ruhetagen bleiben realistisch 5–6 "verfügbare" Tage. Selbst wenn jeder dieser Tage 1 Einheit bekommt und 1–2 Tage eine zweite (Gym-Kombi), landet man strukturell bei **6–8 Einheiten**, nie verlässlich bei 10 — unabhängig davon, was im Profil als Wunschzahl steht. Das deckt sich exakt mit deiner Beobachtung (7 von 10).

---

## 5. Chancen und Vorteile

- **Gruppe A (6 Punkte) lässt sich mit EINEM Hebel lösen**: Anschluss der Live-UI an scheduler-v2/decision-engine-v2 statt sechs Einzel-Patches an einer Funktion, die ohnehin abgelöst werden soll. Das spart mittelfristig Aufwand und verhindert, dass du an v1 weiter Symptome bekämpfst.
- **B1–B4 sind kleine, risikoarme Fixes** (Anzeige-/CSS-Ebene) — schnell erledigt, kein Architektur-Risiko.
- **B2 (Medaillen-Deckel)** ist der Fix mit dem besten Aufwand/Wirkung-Verhältnis: eine Zeile Anzeige-Logik, sichtbarer Effekt für dich sofort.

## 6. Risiken, Schwächen und Gegenargumente

- Gruppe D bleibt **Spekulation ohne Repro** — würde ich jetzt "fixen", bestünde das Risiko, das falsche Problem zu lösen und Zeit zu verschwenden (genau das Muster, das die Session bei der Cache-Optimierung schon einmal vermieden hat).
- Der "richtige" Fix für Gruppe A (Engine-Anschluss) ist **kein kleiner Patch** — er hängt am offenen Punkt "Engine-Output erreicht den Nutzer" (kanonisches Wochenplan-Modell aus scheduler-v2.sessions[]), der laut Umsetzungsplan noch nicht gebaut ist. Kurzfristige Symptom-Fixes an `generateWeekPlan()` sind möglich, aber Wegwerfarbeit.
- B4 (Banner-Breite) ist ohne Pixel-Messung im echten Browser nur eine begründete Vermutung zur Ursache, kein exakter Fix.

## 7. Realistische Alternativen

Für Gruppe A gibt es zwei Wege:
1. **Kurzfristig flicken**: `generateWeekPlan()` erweitern (z. B. Rad-Häufigkeit aus dem Profil statt hartkodiert 1×, Tages- statt Einheiten-Deckel). Schnell, aber Wegwerfarbeit.
2. **Richtig lösen**: die kanonische Wochenplan-Projektion aus scheduler-v2 bauen und `activeWeekPlan()` darauf umstellen (Phase 8 ohnehin geplant). Mehr Aufwand jetzt, kein doppelter Aufwand später.

Mein Rat (siehe Empfehlung unten): **Alternative 2**, weil du ohnehin mitten in Phase 8 bist und die Engine bereits die richtigen Daten liefert (Shadow-Log beweist das seit heute).

## 8. Priorisierte Handlungsempfehlungen (nur Reihenfolge, noch keine Umsetzung)

1. **B2 — Medaillen-Deckel** (Minuten-Fix, sofortiger sichtbarer Nutzen)
2. **B1 — Wochentag statt Datum im Plan** (Minuten-Fix)
3. **D-Punkte klären** (D1, D3, D4 brauchen von dir: 1–2 Screenshots/konkrete Aktivitäten, dann sind sie in Minuten root-caused, nicht in Stunden geraten)
4. **B4 — Banner-Breite** (kurzer CSS-Fix, nach kurzer Live-Messung)
5. **B3 — Phasen-Chips** (braucht echtes Redesign, kein reiner Bugfix)
6. **B5 — Aktivitäts-Dauer bearbeiten** (braucht deine Bestätigung, WELCHEN Button du meinst, bevor ich etwas baue)
7. **Gruppe A gebündelt** (größtes Paket — sollte NACH den offenen Phase-8-Punkten und nach deiner Entscheidung "flicken vs. richtig anschließen" angegangen werden)
8. **Gruppe C (Redesigns)** — erst Scope-Entscheidung von dir (Optik-only vs. neue Funktionalität), dann Umsetzungsplan

## 9. Fazit

Von 18 gemeldeten Punkten sind 5 echte, isolierte Bugs mit bekannter Ursache, 6 sind ein einziges strukturelles Problem (v1-Heuristik statt Engine) und keine sechs Einzelfehler, 3 sind Design-Erweiterungen und 4 brauchen von dir noch eine konkrete Repro-Angabe, bevor ich seriös eine Ursache benennen kann — raten würde hier gegen deinen eigenen Anspruch an Genauigkeit verstoßen. Der wichtigste strategische Punkt: Nicht an `generateWeekPlan()` weiterflicken, sondern die Engine-Anbindung (bereits in Phase 8 vorgesehen) vorziehen — das löst sechs der 18 Punkte auf einmal, sauber statt notdürftig.
