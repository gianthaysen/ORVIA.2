# ADR-ENTWURF · ORVIA Profil-Datenvertrag

Status: **DRAFT — nicht beschlossen, nicht implementieren.** Stand: 2026-07-02.
Kontext: P3-Redesign (PROFILE-ONBOARDING-UX-REDESIGN-PLAN.md), Feldmatrix (PROFILE-FIELD-MATRIX.md), P2-Findings (Upsert ohne Konfliktregel; korruptes Profil-JSON still übersprungen).

## Beschlussvorschläge

**D1 — Flacher Laufzeitzustand.** `ORVIA.profile`/`PROFILE` bleibt ein flaches Objekt. Bestehende Felder werden NIEMALS in `{value, meta}`-Objekte umgewandelt (bricht ≥6 Konsumenten: sync-Snapshot, applyRow, Event-Listener, Normalizer, Formatter, computeAge — Audit H §5). Das Metadaten-Muster von `performance.*` ({value, source, measuredAt}) bleibt die Ausnahme für NEUE Messwert-Felder.

**D2 — `_sectionMeta` separat.** Aktualität und Herkunft leben in `PROFILE._sectionMeta = { <sectionId>: { updatedAt: ISO, source: 'onboarding'|'editor'|'import'|'migration' } }` — additiv, optional, von Alt-Konsumenten ignorierbar. Gepflegt ausschließlich durch `_profileSave(changedSections)`.

**D3 — Completeness als pure Ableitung, getrennt von updatedAt/source.** `computeCompleteness(profile, sectionId)` in profile-model.js rechnet NUR aus Feldwerten (Required-Sets aus der Feldmatrix §11); sie liest `_sectionMeta` nicht. Staleness (`isStale(sectionMeta, sectionId, now)`) rechnet NUR aus `_sectionMeta.updatedAt`. Zwei Funktionen, zwei Fragen: „Was fehlt?" ≠ „Was ist alt?".

**D4 — Aktualitäts-Kategorien je Section.**
| Kategorie | Sections | staleAfter (Richtwert) | UI-Folge |
|---|---|---|---|
| zeitkritisch | constraints (aktive Beschwerden) | 14 Tage | Smart Prompt hoch priorisiert; beeinflusst Safety-Kontext |
| regelmäßig prüfenswert | availability, goals (targetDate-Nähe/Überschreitung), performance-Messwerte, body/weight | 56 / event-bezogen / 180 / 28 Tage | Status „prüfenswert", Prompt niedrig |
| stabil | personal (name/birthDate/sex/height), sports-Auswahl, preferences, devices | kein Auto-Stale | nie automatisch anmahnen |

**D5 — Kein neuer Cloud-Schreibpfad ohne vollständigen Zyklus.** Eine Section wird erst dann in eine Tabelle geschrieben, wenn im selben Paket gilt: Write (Repo) + Read/Hydration beim Login + Reload-Äquivalenz getestet (Zwei-Geräte-Simulation) + dokumentierte Konfliktregel. Write-only-Anbindungen (Halbsync) sind verboten. Konsequenz: sports/availability bleiben blob-autoritativ, bis dieser Vertrag beschlossen und der jeweilige Zyklus gebaut ist; `profileStore.persist(sections)` wird erst danach erweitert.

**D6 — Keine parallele Source of Truth.** Jede neue UI schreibt ausschließlich über `ORVIA.profile.updateSection()` → `_profileSave()` (Projektion, Event, Persistenz). Kein direktes `saveProfile()`/Repo-Schreiben aus UI-Code. Alt- und Neu-Editoren dürfen nur koexistieren, solange beide diesen Pfad nutzen.

**D7 — Keine plausiblen Defaults.** Fehlende Angaben bleiben `null`/leer und werden als „fehlt" angezeigt. Die PROFILE_DEFAULTS-Werte 70 kg/175 cm/'fortgeschritten'/primaryGoal:'health' gelten als Alt-Fehler und werden im Zuge von M1b/M5 durch null-Semantik ersetzt (mit Migrationsregel: bestehende exakte Default-Werte werden NICHT rückwirkend genullt — nicht unterscheidbar von echten Eingaben; nur Neuanlage ändert sich).

**D8 — Beschädigte lokale Daten ⇒ Recovery-Status statt stiller Defaults.** `loadProfile()` mit korruptem JSON führt NICHT mehr still zu `PROFILE_DEFAULTS` (heute profile.js:24–28) und nicht mehr still zu „kein Profil" in der Migration (P2-Finding, migrate-blob.js:34–37): stattdessen Zustand `profile_recovery` (Backup des korrupten Blobs analog onboarding-store, Hinweis-UI, Re-Hydration aus Cloud für die 13 Felder, Rest leer mit Kennzeichnung). Details = eigenes Umsetzungspaket.

## Konsequenzen
Positiv: kein Konsumentenbruch, ehrlicher Status in der Zentrale, Multi-Device-Risiken explizit statt schleichend, klare Testbarkeit (alles pure Funktionen).
Negativ/Kosten: Cloud-Vollausbau verschiebt sich hinter je einen vollständigen Zyklus pro Section; `_sectionMeta` ist beim Bestandsnutzer initial leer (Backfill-Regel: erstes `_profileSave` je Section setzt updatedAt; bis dahin Status „unbekannt", nicht „veraltet").

## Offene Punkte vor Beschluss
1. Konfliktregel für den ersten Cloud-Zyklus (sports): LWW per Section-updatedAt vs. Gerät-gewinnt — Produktentscheidung.
2. staleAfter-Werte (D4) bestätigen/justieren.
3. Recovery-UX (D8): Wortlaut + ob Cloud-Rehydration automatisch oder per Bestätigung.
4. Backfill von `_sectionMeta.source` für Bestandsdaten: pauschal 'editor' oder 'unbekannt'?
