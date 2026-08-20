# ORVIA · Vorsprint A-S0 — 17. bis 31.08.2026

**Zweck:** Phase A startet am 01.09. Die zwei Wochen davor sind keine Wartezeit, sondern gehören genau drei Dingen: dem Live-Defekt, der dich täglich betrifft; der Lücke, die Gate A sonst falsch-grün macht; und den Vorgängen, deren Vorlaufzeit außerhalb deiner Kontrolle liegt.

**Budget:** ~14 h AP + 4 h Puffer über 2 Wochen. Das ist bewusst weniger als ein voller Sprint — der Vorsprint darf Phase A nicht anfressen.

**Nicht enthalten:** A-01/A-02/A-03 (Vokabular-Fix, Resolver-Fix, Deploy). Die bleiben in A-S1 und fahren gemeinsam. Grund: sie brauchen CI und einen sauberen DB-Stand als Unterlage, und beides entsteht erst hier.

---

## 1 · Die Arbeitsliste

| ID | Paket | Std. | Reihenfolge | Fertig, wenn |
|---|---|---:|---|---|
| **V-01** | **Migration 0035 live einspielen** | 0,5 | zuerst, heute | Block D des Live-Checks liefert 11× „OK"; Übung im laufenden Workout lässt sich hinzufügen |
| **V-02** | Live-Check v2 vollständig laufen lassen (Blöcke A–C) | 1,0 | nach V-01 | Ergebnis der drei Blöcke als Datei abgelegt (Drift-Protokoll 17.08.) |
| **V-03** | Gefundene Drift schließen | 4,0 \[Schätzung] | nach V-02 | Block B liefert **leeres** Ergebnis |
| **V-04** | Live-Check als Repo-Test + Band-1-Korrektur | 2,0 | nach V-03 | Skript liegt unter `supabase/tests/`, A-05 und Gate A sind nachgeschärft (§3) |
| **V-05** | Nebentätigkeit beim Ausbildungsbetrieb anzeigen | 1,0 | parallel, diese Woche | Schriftliche Anzeige raus, Zusage schriftlich zurück |
| **V-06** | Steuerberater-Ersttermin anfragen | 0,5 | parallel, diese Woche | Termin für Sep/Okt steht, 8 Fragen aus Band 7 mitgeschickt |
| **V-07** | Deploy-Vorbereitung v8-344…354 | 2,5 | ab Woche 2 | Versionsliste + Abnahmeprotokoll-Vorlage + SW-Asset-Prüfung stehen (§4) |
| **V-08** | Die 9 offenen Entscheidungen fixieren | 1,5 | ab Woche 2 | Band 0 §3 abgehakt, jede Entscheidung mit Datum im Entscheidungslog |
| **V-09** | Prüfungstermine 2026/27 in die Timeline eintragen | 1,0 | Woche 2 | Prüfungsmonate in Band 1 als halbe Kapazität markiert |
| — | **Summe** | **14,0** | | |
| — | Puffer | 4,0 | | |

---

## 2 · V-01 und V-02 im Detail: die Live-Reparatur

**Ausgangslage (bestätigt am 16.08.):** `select … where column_name='target_weight_kg'` liefert „No rows returned". Migration 0035 vom 12.08. ist nie in der Produktionsinstanz gelandet. `workoutRepository.addExercise` sendet die Spalte seit v8-322 immer mit → PostgREST antwortet PGRST204 → jedes Hinzufügen scheitert. Der zweite Defekt (Toast unter 21 Overlays) hat den Fehler unsichtbar gemacht; sein Fix liegt in v8-354 und erreicht dein Handy erst mit dem Deploy. **Die 0035-Reparatur wirkt dagegen sofort**, weil sie in der Datenbank passiert.

**Ablauf im Supabase SQL-Editor (Projekt `ORVIA / main`):**

1. **Block A** aus `orvia-live-check-v2.sql` ausführen. Erwartung: fünf Zeilen „OK", letzte Zeile „FEHLT — genau das ist der Defekt".
   **Abbruchkriterium:** Steht bei `public.touch_updated_at()` ein „FEHLT", dann **nicht** weitermachen. 0035 legt am Ende einen Trigger auf diese Funktion; ohne sie bricht die Migration mittendrin ab und hinterlässt einen halb migrierten Stand. In dem Fall zuerst die Migration nachziehen, die `touch_updated_at` anlegt.
2. `0035_strength_targets_and_garmin_link.sql` vollständig ausführen. Die Datei ist durchgängig idempotent (`add column if not exists`, `do $$ … if not exists`, `create … if not exists`, `drop policy if exists`) — ein zweiter Lauf ist harmlos, ein Teillauf nachholbar.
3. **Block D** ausführen. Erwartung: 11 Zeilen, alle „OK". Ergebnis kopieren — das ist dein Beleg fürs Abnahmeprotokoll.
4. **Gegenprobe in der App** (Live, v8-343): Gym-Workout starten → Übung hinzufügen. Erscheint sie, ist der Defekt geschlossen. Erscheint sie weiterhin nicht, liegt ein zweiter Schreibpfad daneben — dann warten, bis der Toast-Fix aus v8-354 live ist, denn erst dann siehst du den Fehlercode.
5. **Block B und C** ausführen (V-02) und das Ergebnis als `Drift-Protokoll-2026-08-17.txt` ablegen. Block B zeigt, welche weiteren Migrationen nie ankamen; Block C zeigt Nutzerdaten-Tabellen ohne aktives RLS.

**Warum überhaupt v2:** Die Fassung vom 16.08. prüft nur Tabellen und Spalten. Genau daran wäre 0035 trotzdem gescheitert — die fehlende **Funktion** stand nicht auf der Liste. v2 schließt die vier blinden Flecken von v1: Funktionen, Trigger-Voraussetzungen, RLS-Status, und den Nachweis nach dem Einspielen.

---

## 3 · Die Korrektur an Band 1 (V-04) — der wichtigste Punkt dieses Dokuments

**Befund:** Gate A verlangt in Kriterium 1 „Live-Version == lokale Version (SW meldet identische Versionsnummer)". Das prüft **den Code**. Es prüft nirgends **das Schema**. Genau diese Lücke hat den Gym-Bug erzeugt: Code v8-322+ erwartete eine Spalte, die es live nicht gab — und alle 268 Tests waren dabei grün, weil sie gegen die Migrationsdateien prüfen, nicht gegen die Instanz.

**Warum das strukturell ist, nicht zufällig:** 21 von 34 Migrationen tragen sich nicht in `public.schema_migrations` ein. Die Tabelle ist als Wahrheitsquelle wertlos, Migrationen werden von Hand eingespielt, und niemand gleicht `supabase/migrations/` gegen die Live-Instanz ab. `upsert_conflict_contract_test.mjs` prüft Code ↔ Migrationen; Migrationen ↔ Live-DB prüft niemand. Das ist dieselbe Fehlerklasse wie beim Check-in-Vorfall am 16.07. und dieselbe wie bei den im Juli widerrufenen Paritäts-Gates: **ein Gate, das grün wird, ohne das zu beweisen, was es behauptet.**

**Vorgeschlagene Änderung an Band 1:**

| Stelle | Bisher | Neu |
|---|---|---|
| A-05 (CI + Branch-Protection, 14 h) | 268 Tests + 166 Mutationsproben in CI | **+ 3 h:** Live-Check v2 als `supabase/tests/live_schema_parity.mjs`; Generator (20-Zeilen-Parser über `create table`/`add column` in `supabase/migrations/`) erzeugt die Erwartungsliste automatisch, damit sie nicht händisch veraltet |
| Gate A, Kriterium 1 | „Live-Version == lokale Version" | „Live-**Code**-Version == lokale Version **und** Live-**Schema** == Migrationsdateien (Live-Check liefert leeres Ergebnis, Protokoll abgelegt)" |
| Gate A, neu | — | Kriterium 8: RLS auf allen Nutzerdaten-Tabellen aktiv **oder** dokumentierte Ausnahme mit Datum (Art.-9-Vorbereitung, Blocker vor Multi-User) |
| Phase A, Stunden | 127 h AP | 130 h AP · Puffer 23 h → 20 h. Die 3 h kommen aus dem Puffer, die Phase bleibt bei 150 h |

**Nicht empfohlen:** ein eigenes Arbeitspaket dafür aufzumachen. Der Abgleich gehört in A-05, weil er dieselbe Infrastruktur (CI-Lauf) benutzt und sonst als „nice to have" verschoben wird — Anti-Pattern-Liste Phase A, Zeile „CI aufschieben".

---

## 4 · V-07: Deploy-Vorbereitung, ehrlich abgegrenzt

Was in diesem Vorsprint vorbereitet wird, ist die **Mechanik**, nicht der Deploy selbst (der ist A-03, 12 h, in A-S1):

1. **Versionsliste erstellen:** Für jede Version v8-344 bis v8-354 eine Zeile — was sie ändert, welche Dateien, ob eine Migration dazugehört. Quelle sind die Commit-Nachrichten. *Diesen Punkt kann ich nicht für dich vorbereiten: der Ordner `Documents/GitHub` ist in dieser Session leer, ich habe nur einen Quell-Schnappschuss ohne Git-Historie.*
2. **Staffelung festlegen** (Anti-Pattern „alle 10 auf einmal"): Staffel 1 = v8-344…348, Abnahme, dann Staffel 2 = v8-349…354. Bei einem Fehler ist so die Menge der Verdächtigen halbiert.
3. **Abnahmeprotokoll-Vorlage:** je Staffel vier Smoke-Tests (Login, Plan erzeugen, Workout starten + Satz speichern, Sync-Roundtrip), je mit Datum, Gerät, Ergebnis. Diese Vorlage ist zugleich der Gate-A-Nachweis.
4. **SW-Asset-Liste prüfen** *vor* dem ersten Push: 141 Script-Tags gegen die handgepflegte Liste im Service Worker. Ein fehlender Eintrag bricht den Offline-Betrieb still — die häufigste Ursache für „weiße Seite nach Update". Das Prüfskript ist A-11, aber die einmalige manuelle Gegenprobe kostet 20 Minuten und gehört vor Staffel 1.
5. **Nach Staffel 2:** Toast-Fix aus v8-354 auf dem Handy verifizieren (Fehlermeldung während eines offenen Workouts sichtbar?) — erst danach ist der Gym-Bug-Retest (A-04) aussagekräftig.

---

## 5 · V-05/V-06: was jetzt terminiert werden muss — und was ausdrücklich nicht

**Jetzt:**

- **Ausbildungsbetrieb informieren.** Band 7 setzt das auf Monat −10, das ist jetzt. Es ist der einzige Vorgang in der Gründungskette, dessen Dauer komplett bei jemand anderem liegt, und er blockiert alles Weitere. Inhalt: Nebentätigkeit außerhalb der Arbeitszeit, kein Wettbewerb zum Ausbildungsbetrieb, Ausbildung hat Vorrang. Zusage schriftlich geben lassen.
- **Steuerberater-Ersttermin anfragen.** Nicht wegen Dringlichkeit, sondern wegen Terminvergabe (2–6 Wochen sind normal, im Jahresabschluss-Zeitraum mehr). Die 8 Fragen aus Band 7 gleich mitschicken — das macht den Termin kürzer und billiger.

**Ausdrücklich nicht vorziehen — Gewerbeanmeldung.** Band 1 setzt sie auf A-10 (Sprint A-S4, Mitte Oktober), und das ist bereits früh genug. Sie früher anzumelden bringt keinen einzigen Tag Vorsprung, erzeugt aber ab dem Anmeldetag laufende Pflichten (steuerliche Erfassung, ggf. USt-Voranmeldungen, Buchhaltungsroutine) für acht Monate ohne jeden Umsatz. Die beiden Termine, die sie wirklich binden, liegen später: der Garmin-Developer-Antrag (Phase C, Feb–Apr 2027) und die erste Einnahme (Founder-Verkauf, Mai 2027). Sie ist deshalb im Oktober fällig, nicht im August — **aber die Zusage des Ausbildungsbetriebs muss vorher da sein**, und genau deshalb startet diese Kette heute.

---

## 6 · Reihenfolge-Begründung in drei Sätzen

V-01 zuerst, weil es 30 Minuten kostet und einen Defekt behebt, der dich seit Tagen bei jedem Gym-Training trifft. V-02/V-03/V-04 danach, weil jede Aussage über Produktqualität in Phase B unbelegbar bleibt, solange niemand weiß, ob die Datenbank zum Code passt — und weil ein Gate, das das nicht prüft, schlimmer ist als kein Gate. V-05/V-06 parallel, weil ihre Dauer nicht dir gehört.

## 7 · Was offen bleibt

| Punkt | Warum offen | Wer löst es |
|---|---|---|
| Inhalt der Versionen v8-344…354 | Repo in dieser Session nicht erreichbar (`Documents/GitHub` ist leer) | Ordner verbinden, dann liefere ich die Versionsliste |
| Umfang der Drift (V-03: 4 h) | Schätzung. Der echte Aufwand steht erst nach Block B fest | V-02 |
| Ob 0035 inzwischen doch eingespielt wurde | Nicht prüfbar von hier | Block A, Zeile 6 |
| Die 9 Entscheidungen aus Band 0 §3 | Deine Entscheidung, nicht meine | V-08 |
