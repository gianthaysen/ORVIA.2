# ORVIA — Verbindliche Entscheidungen

**Stand:** 2026-08-02 · Basis: `v8-219-audit-baseline`
**Grundlage:** `docs/GAP-ANALYSE-2026-08.md`, `docs/UMSETZUNGSPLAN-2026-08.md`

Dieses Dokument hält Entscheidungen fest, die **später schwer reversibel** sind: Datenverträge, Planmodell, Intensitätsdefinition, Check-in-Wirkung, Engine-Gates, Produktklassifikation.

**Statusregel:** Eine Entscheidung mit Status *verbindlich* darf nur durch eine neue Entscheidung mit Begründung geändert werden, nicht durch Implementierungspraxis.

---

## Bestätigt und unverändert

| # | Entscheidung | Status |
|---|---|---|
| E-01 | Kennzahlen ohne Daten **zusammenfassen**, gruppiert nach fehlender **Datenquelle** — nicht nach Einzelkennzahl. Der zusammengefasste Bereich bleibt ein **stabiler Slot** (Vertrag „Struktur schrumpft nie"). | verbindlich |
| E-02 | Profilwerte als **gekennzeichneter Fallback** nutzen, nie als Messung ausgeben. | verbindlich |
| E-03 | `trainingLoadRepository` **nicht entfernen** — erst auditieren, dann kanonisieren. | verbindlich |
| E-04 | `.mile`-Margin **nur in `#gmAna`** korrigieren. Globale Vereinheitlichung erst nach visueller Regressionsabdeckung. | verbindlich |
| E-05 | **RPE-Proxy jetzt**, bezeichnet als „Harte Einheiten · Anteil der **bewerteten** Einheiten mit RPE ≥ 7". Verboten: „Hochintensiv", „Intensive Minuten", „Zone 4–5". | verbindlich |
| E-06 | Check-ins erst nach **Shadow-Auswertung** aktivieren. | verbindlich |
| E-07 | `scheduler-v1` **nicht** produktiv erweitern; `scheduler-v2` separat bauen. | verbindlich |
| E-08 | Engine-Baseline und Nutzer-Overrides **getrennt** speichern. | verbindlich |
| E-09 | **Phase 5 vor Scheduler-Implementierung.** | verbindlich |
| E-10 | Rechtliche Klassifikation **vor** Engine-Live. | verbindlich |

### E-02 · Quellenprioritätsvertrag

Zentral, nicht pro Kennzahl:

| Rang | Quelle | `source` | `confidence` |
|---|---|---|---|
| 1 | aktuelle validierte Messung | `measured_validated` | `measured` |
| 2 | synchronisierte Gerätedaten | `device_sync` | `measured` |
| 3 | manuell eingetragener Profilwert | `profile_manual` | `user_provided` |
| 4 | berechneter Schätzwert | `derived_estimate` | `estimated` |
| 5 | kein Wert | — | — |

```js
{ value: 198, source: "profile_manual", measuredAt: null,
  updatedAt: "2026-07-20T10:00:00Z", confidence: "user_provided" }
```

**Rang 3 und 4 sind nicht gleichwertig.** Ein bewusst eingetragener HFmax ist qualitativ etwas anderes als `208 − 0,7 × Alter` (`calc.js:8`). Beide dürfen nie unter derselben Kennzeichnung erscheinen.

### E-03 · Auditumfang vor Kanonisierung

Duplikate · fehlende Sportarten · falsche Datumszuordnung · Zeitzonen · unplausible Belastungswerte · abweichende Berechnungslogik je Schreibpfad · Divergenz lokaler Store ↔ Supabase · migrierte Altdatensätze · Sessions ohne RPE · Sessions mit `computed_load = 0`.

---

## E-11 · Zwei getrennte Intensitätsdimensionen

**Status:** verbindlich · **Phase:** 2 (Dimension A), 5 (Vertrag), später (Dimension B)

Es existieren heute fünf unvereinbare Intensitätsbegriffe: `RPE ≥ 7` (`activity-config.js:549`), HFmax-Prozente (`calc.js:650`), `intensity` = Ø-HF in der DB (`trainingLoadRepository.js:22`), geplante Intensität einer Einheit, perspektivisch Schwellenpace/FTP.

**Sie werden nicht in eine Kategorie gepresst.**

| | Dimension A — subjektive Session-Intensität | Dimension B — physiologische Verteilung |
|---|---|---|
| Werte | `easy` / `moderate` / `hard` / `unknown` | `z1` … `z5` |
| Quelle | RPE (1–4 / 5–6 / 7–10) | HF, Pace, Power, Provider-Zonen |
| verfügbar | heute | **nicht** — keine Zeit-in-Zone-Daten im System |

Eine lockere lange Einheit kann subjektiv RPE 6 sein und physiologisch fast vollständig in Z2 liegen. Die Werte sind **nicht austauschbar**.

**Kanonisches Load-Modell (Phase 5):**
```js
{
  bySport: {},
  bySessionIntensity: {},     // Dimension A
  byPhysiologicalZone: null   // Dimension B — null bis echte Zonendaten existieren
}
```

Ein gemeinsames `byIntensity` ist damit **abgelehnt**.

### ⚠️ Folgekorrektur: `easyShare` ist eine Dimension-B-Kennzahl

Die 80/20-Regel ist **physiologisch** definiert, nicht subjektiv. `easyShare` (`calc.js:717`) gehört also zu Dimension B — wird heute aber aus `sub`-Labels berechnet, die weder A noch B sauber sind. Das ist die eigentliche Wurzel von **KF-010**.

**Konsequenz:** `easyShare` darf **nicht** auf RPE umgestellt werden — das wäre ein Kategoriefehler. Bis Dimension-B-Daten existieren, bleibt die Kennzahl auf die Läufe beschränkt, die physiologisch klassifizierbar sind, und weist ihre Abdeckung aus:

```
Easy Share = klassifizierte leichte Läufe / alle klassifizierten Läufe
```

Unbekannt zählt **nicht** als „nicht easy". Klassifikationspriorität: geplante Intensität → RPE → HF relativ zum individuellen Modell → Pace relativ zur Schwelle → `unknown`.

---

## E-12 · Aktive Workouts werden wiederhergestellt

**Status:** verbindlich · **Phase:** 1 (Einstieg + Versionierung), Produktziel dauerhaft

**Codebefund — der Aufwand ist deutlich kleiner als angenommen.** Die Persistenz existiert bereits:

| Anforderung | Zustand |
|---|---|
| Workout-ID | ✅ `session.id` / `client_session_id` |
| Startzeit | ✅ `session.started_at` (`workout-store.js:112`) |
| verstrichene aktive Zeit | ✅ aus `started_at` − `total_paused_seconds` |
| Pausenstatus | ✅ `paused_at`, `total_paused_seconds` (`:183–193`) |
| aktuelle Übung / Block | ✅ `currentIndex` |
| erledigte Sätze, eingegebene Werte | ✅ `exercises` |
| Timer | ✅ `timer` |
| Persistenz | ✅ `saveLocal()` → `orvia_active_workout_<uid>` (`workout-store.js:31,52`) |
| Rehydrierung | ✅ `ensureActiveWorkoutLoaded()` (`workout-ui.js:113`) |
| Overlay-Zustand | ✅ `orvia_wo_overlay_<uid>` (`workout-ui.js:58`) |
| **Schemaversion** | ❌ fehlt |
| **letzter Persistenzzeitpunkt** | ❌ fehlt |

**Was tatsächlich fehlt, ist nicht die Persistenz, sondern der Einstiegspunkt (KF-003)** — plus zwei Felder für den kontrollierten Fehlerfall.

Zu ergänzen: `stateVersion` und `persistedAt` im lokalen Cache. Bei inkompatiblem oder veraltetem Zustand:

> Workout konnte nicht vollständig wiederhergestellt werden. Bisherige Daten wurden gesichert.

„Wiederherstellung **oder** klarer Fehler" bleibt das Phase-1-Minimum. **Produktziel ist Wiederherstellung.**

---

## E-13 · Stabile `data-slot`-Attribute für den Strukturvertrag

**Status:** verbindlich · **Phase:** **vor 1b**, nicht erst Phase 4

Der Strukturvertrag verankert Slots heute über **Sektionslabel-Texte**. Eine redaktionelle Änderung von „Belastung nach Sportart" zu „Sportartspezifische Belastung" bricht den Test, obwohl die Struktur unverändert ist.

```html
<section data-gm-slot="training-load-by-sport">
```

**Abweichung von der Vorgabe „Phase 1 oder spätestens Phase 4":** Die Härtung gehört **vor Phase 1b**. Genau 1b entfernt Bedienelemente aus `ui.js` — das ist der Moment, in dem der Strukturschutz am meisten leisten muss und am ehesten durch Textänderungen mitgerissen wird. Da 1b `ui.js` ohnehin anfasst, ist es zugleich der billigste Zeitpunkt.

Danach `gm_structure_contract_test.mjs` von Labeltexten auf `data-gm-slot` umstellen.

---

## E-14 · Action-Outcome-Vertrag, schrittweise

**Status:** verbindlich · **Phase:** ab 1, verpflichtend für **neu reparierte** Kernaktionen

`runActionEx()` erkennt heute nur Dispatch-Fehler. Ein auflösbarer Handler, der intern nichts bewirkt, gilt als `handled` — genau der Fall bei `openTrainingTab`.

```js
{ ok: true,  outcome: "workout_sheet_opened" }
{ ok: false, reason:  "training_tab_missing" }
```

Der zentrale Dispatcher leitet daraus `handled` / `failed` / `blocked` ab.

**Kein Big-Bang-Umbau aller Altaktionen.** Verbindlich nur für Handler, die in Phase 1+ ohnehin angefasst werden. Migration des Rests schrittweise. Sobald ein Handler einen Outcome liefert, greift `handler_failed` automatisch — der Ergebnisvertrag ist dafür bereits vorbereitet.

---

## E-15 · `effectiveSessions` wird berechnet, nicht persistiert

**Status:** verbindlich · **Phase:** 5

Gründe: keine dritte Datenrepräsentation · kein Auseinanderlaufen von Baseline, Overrides und Effective Plan · nachvollziehbare Rebase-Logik.

Materialisierung erst später und ausschließlich aus Performancegründen — dann mit Invalidierungsvertrag.

**Voraussetzung:** deterministische Fold-Funktion `(baseline, overrides) → effectiveSessions` mit stabiler Sortierung. Gleiche Eingabe muss byteweise gleiche Ausgabe liefern, sonst ist der Shadow-Vergleich in Phase 8 wertlos.

---

## E-16 · Overrides nur bei stabiler Session-Identität automatisch rebasen

**Status:** verbindlich · **Phase:** 5

**Codebefund — der Anker existiert bereits, aber nur zur Hälfte.**

| ID-Form | Herkunft | Stabil über Engine-Revisionen? |
|---|---|---|
| `ps:…` | einmalig vergeben, nie neu (`ui.js:289–292`) | ✅ **ja** |
| `psg:<tag>:<pos>:<slug>` | deterministisch **aus dem Inhalt** generiert (`ui.js:294–295`) | ❌ **nein** |

`psg`-IDs leiten sich aus Tag, Position und Titel-Slug ab. **Ändert die Engine den Plan, ändert sich die ID.** Ein Rebase auf `psg` würde Overrides an inhaltlich andere Einheiten heften — exakt der Long-Run-→-Recovery-Run-Fall.

Zusätzlich existiert `workout_sessions.planned_session_id` bereits durchgängig (`workoutRepository.js:16`, `workout-store.js:95/229/278/481`) — im Code als „bisher ungenutzt" markiert. Das ist der vorhandene Plan-Actual-Link.

**Rebase-Regel:**

| Fall | Verhalten |
|---|---|
| gleiche `ps:`-ID | automatisch übernehmen |
| explizite `predecessorSessionId` | automatisch übernehmen |
| `psg:`-ID | **nie** automatisch — als Konflikt markieren |
| Titel-, Sportart- oder Positionsgleichheit | **nie** als Identitätsnachweis verwenden |
| sonst | „Override konnte nicht eindeutig übertragen werden." |

**Folgeaufgabe für Phase 5:** generierte Pläne brauchen beim Übergang in die Persistenz eine einmalig vergebene `ps:`-ID, sonst bleibt jeder Override an einem generierten Plan unrebasierbar.

---

## E-17 · Fehlende Daten reduzieren die Prescription

**Status:** verbindlich · **Phase:** 6

**Grundsatz: Parameter weglassen, nicht erfinden.**

| Fehlende Information | Verhalten |
|---|---|
| keine aktuelle Belastung, aber gesundes Profil und Basisdaten | konservative, **nicht quantitative** Einheit |
| unbekannte Verfügbarkeit | keine automatische Planung |
| aktive Schmerzen oder Warnzeichen | keine leistungsorientierte Einheit |
| unbekannte Schwelle | Dauer und RPE statt Pace |
| unbekannte HFmax | keine HF-Zonen-Vorgabe |
| unbekannte Schwimmleistung | Technik-/Zeitvorgabe statt Distanztempo |
| stark unvollständige Datenlage | Nutzerentscheidung statt Automatik |

Das entspricht der bereits vorhandenen Disziplin im Code (`calc.js:13–15`: kein Fallback für fehlenden Ruhepuls).

---

## E-18 · Produktklassifikation: Fitness- und Trainingsunterstützung

**Status:** verbindlich · **Phase:** 6 (Klassifikation), 10 (Texte)

ORVIA ist **Fitness- und Trainingsplanungssoftware** — kein Medizinprodukt, kein Diagnosewerkzeug, keine individuelle medizinische Behandlung.

| Unzulässig | Zulässig |
|---|---|
| „Du bist heute nicht verletzungsgefährdet." | „Die verfügbaren Trainingsdaten sprechen für eine erhöhte Belastung." |
| „Deine Regeneration ist medizinisch unzureichend." | „Reduziere die Einheit oder prüfe dein aktuelles Befinden." |
| „Dieses Training verhindert Verletzungen." | „Bei anhaltenden Beschwerden sollte medizinischer Rat eingeholt werden." |
| „Du kannst trotz Schmerzen trainieren." | — |

**Ergänzung: die Klassifikation muss testbar sein, nicht nur dokumentiert.**

Ein Dokument verhindert keine Formulierung, die zwei Jahre später in einem Empfehlungstext landet. Vorgesehen ist ein Test über die nutzersichtbaren Strings (`GM_METRIC_INFO`, Entscheidungstexte, Knowledge-Regeln), der verbotene Muster ablehnt — Verletzungs-/Diagnose-/Heilungsversprechen, Absolutaussagen über Gesundheitszustände, Trainingsfreigabe trotz Schmerz.

Das löst keine regulatorische Frage abschließend, verhindert aber das schleichende Abdriften der Produktsprache.

---

## E-19 · Reihenfolge der Sportarten — abhängig von der Produktdefinition

**Status:** entschieden **unter Vorbehalt einer Produktdefinition** · **Phase:** 9

**Hier weiche ich von der Empfehlung ab.** Die Aussage „Krafttraining zuerst, weil vorhandene Substanz" trifft zu für **Tracking und UI** — aber nicht für die **Planungsengine**, um die es in Phase 9 geht.

| | Krafttraining | Radfahren | Schwimmen |
|---|---|---|---|
| Übungs-/Template-Infrastruktur | ✅ am weitesten (`gym-volume.js`, 56 KB; `exerciseLibrary` = 1 von 24) | ❌ | ❌ |
| Übertrag der Running-Kapazitätsarchitektur | ❌ **keiner** | ✅ nahezu direkt | ⚠️ teilweise |
| Kapazitätsmodell | Volumen/Sätze/RM — eigenes Modell nötig | CTL/ATL/TSS wie Laufen | Technik + Intervall |
| Datenlage | RPE vorhanden, HF wenig aussagekräftig | Power/FTP fehlen | am komplexesten |

Die `running-capacity-factory` und der Knowledge-Pack-Aufbau übertragen sich fast unverändert auf Radfahren. Auf Krafttraining übertragen sie sich **gar nicht** — dort ist ein eigenes Kapazitätsmodell nötig.

**Entscheidung:**

- **Phase 9 = Knowledge Packs für die Planungsengine** → **Radfahren → Schwimmen → Krafttraining**
- **Krafttraining-Ausbau außerhalb der Engine** (Tracking, Templates, Volumensteuerung) kann **parallel und früher** laufen — er blockiert die Engine nicht und nutzt vorhandene Substanz sofort.

**Offene Produktdefinition, die das endgültig entscheidet:** Ist ORVIA primär Triathlon-/Ausdauerprodukt oder Hybrid-Athlete-App? Die aktuellen Ziele (Halbmarathon unter 1:50, Ironman-Finish) sprechen für Ausdauer. Solange das nicht festgelegt ist, gilt die Aufteilung oben.

---

## E-20 · Messbare Gates

**Status:** verbindlich · **Phase:** 3 (Check-in), 8 (Engine)

### Check-in-Gate (Phase 3)

- keine Erhöhung riskanter Empfehlungen bei schlechten Check-in-Werten
- nachvollziehbare Richtung der Anpassung
- geringe Instabilität bei identischen Inputs
- keine häufigen Wechsel zwischen „trainieren" und „pausieren"
- keine hohe Override-Rate
- Verbesserung der subjektiven Passung
- keine erhöhte Abbruchrate

### ⚠️ Ehrlichkeitsvorbehalt zu allen Schwellenwerten

**Bei einem einzelnen Nutzer sind statistische Gates nicht aussagekräftig.** 14 Tage sind eine Beobachtungsdauer, keine Stichprobe. Override-Raten, Abbruchraten und „Verbesserung der subjektiven Passung" brauchen eine Nutzerbasis, die es nicht gibt.

Konkrete Zahlen jetzt festzuschreiben würde Scheingenauigkeit erzeugen — dieselbe Fehlerklasse, die der Code sonst diszipliniert vermeidet.

**Daher zweistufig:**

| Stufe | Gate |
|---|---|
| **Einzelnutzer (heute)** | **deterministisch** und **safety-divergenzfrei** — harte, prüfbare Kriterien: identischer Snapshot ⇒ identische Ausgabe · keine ungeklärte Safety-Divergenz · keine ungültigen Sessions · vollständige Provenienz je Session · **plus dokumentierte manuelle Durchsicht** der Divergenzen |
| **Nutzerbasis (später)** | quantitative Schwellen für Override-Rate, Abbruchrate, Passung — **festzulegen, sobald n > 1**; vorher nicht als Zahl im Vertrag |

Die deterministischen Kriterien sind heute vollständig prüfbar und werden nicht abgeschwächt. Die statistischen bleiben bewusst offen, statt geraten zu werden.

---

## Zusammenfassung Statusänderungen

| Bereich | Änderung gegenüber `UMSETZUNGSPLAN-2026-08.md` |
|---|---|
| Phase 2 | `easyShare` bleibt Dimension B — **nicht** auf RPE umstellen (E-11) |
| Phase 1 | `data-slot`-Härtung **vor** 1b statt Phase 4 (E-13) |
| Phase 1 | Workout-Restore: Persistenz existiert, es fehlen Einstieg + `stateVersion`/`persistedAt` (E-12) |
| Phase 5 | `byIntensity` abgelehnt → `bySessionIntensity` + `byPhysiologicalZone: null` (E-11) |
| Phase 5 | Rebase nur auf `ps:`-IDs; `psg:` nie automatisch (E-16) |
| Phase 6 | Produktklassifikation wird **testbar**, nicht nur dokumentiert (E-18) |
| Phase 8 | Gates zweistufig: deterministisch jetzt, statistisch ab n > 1 (E-20) |
| Phase 9 | Engine-Reihenfolge Rad → Schwimmen → Kraft; Kraft-Ausbau parallel außerhalb der Engine (E-19) |

**Offene Produktdefinition:** Triathlon-/Ausdauerprodukt oder Hybrid-Athlete-App (blockiert nur E-19 endgültig).

---

## Nachtrag 2026-08-05 · Produktentscheidungen Phase 3 (Nutzer, mündlich)

**E-21 · Pre-/Live-/Post-Check-in: Garmin zuerst.** Die App hat Zugriff auf
Live-Werte (Body Battery, Stress vor der Einheit). Bevor ein manueller
Pre-/Post-Check-in reaktiviert wird, soll ZUERST eine Garmin-basierte Variante
gebaut werden — keine Fragen stellen, deren Antwort bereits gemessen vorliegt.
Der manuelle Check-in bleibt zurückgestellt (Aktivierungsmatrix + Flag,
sobald er kommt).

**E-22 · Routinen & Supplements generalisieren.** Der Bestand war auf einen
Nutzer zugeschnitten (Spanish Squats, feste Supplementliste). Vor der
Reaktivierung: konfigurierbare Routinen/Supplements je Nutzer (Multi-User-
fähig), keine hartkodierten persönlichen Inhalte.

**E-23 · Ernährung: reaktivieren, aber umfangreich** (nicht 1:1 der alte Stand).

**E-24 · Abend-Check-in: verbessern, nicht nur wieder anzeigen.**

**E-25 · Tip-Engine: umfangreicher machen.**

**E-26 · Workout-Dauer: KEINE automatische Obergrenze.** Eine Kappung wäre
falsch („das ist kacke"). Stattdessen: Retro-Pause ab letzter Aktion beim
Restore (ehrliche Pausen-Buchung, keine Grenze) + nachträgliche manuelle
Dauer-Korrektur am abgeschlossenen Workout, protokolliert als manuelle Angabe
(inkl. Korrektur der Trainingslast). Umgesetzt in v8-225.

---

## Nachtrag 2026-08-05 (abends) · Produktdefinition und Phase-6-Entscheidungen (Nutzer, mündlich)

**E-27 · Produktdefinition: universelle Trainingsplattform (26 Sportarten).**
Die in E-19 offene Frage (Triathlon-/Ausdauerprodukt vs. Hybrid-Athlete-App) ist
entschieden: ORVIA ist eine universelle, wissenschaftlich fundierte Plattform für
alle 26 hinterlegten Sportarten. Das persönliche Profil des Eigentümers ist ein
Anwendungsfall, nie die Spezifikation. Damit gilt E-19 (Engine-Reihenfolge
Rad → Schwimmen → Kraft nach Laufen) endgültig. Verbindliche Strukturen daraus:

1. **Reifegradmodell 1–5 je Sportart** („auswählbar ≠ voll unterstützt") — jede
   Sportart trägt ihren dokumentierten Reifegrad; keine Vollunterstützungs-
   Behauptung ohne Stufe.
2. **Zielreifegrad 5 für die vier Kernsportarten**: Laufen, Radfahren, Schwimmen,
   Kraft/Gym. Die übrigen 22 starten auf Stufe 1–2 (generisches Fallback-Pack).
   Ausbau seriell: erst der komplette Laufen-Kreislauf, dann E-19-Reihenfolge.
3. **Gym-Stufe-5-Zielpfad**: ORVIA überträgt den Kraftplan als strukturiertes
   Garmin-Kraft-Workout (Übungen/Sätze/Ziel-Wdh./Pausen); auf der Uhr nur
   kg + Ist-Wiederholungen eingeben; Rückkanal liefert HF/Dauer/Sätze.
   Voraussetzungen: FIT-Übungskatalog-Mapping + offizielle Training API
   (Developer-Program-Antrag früh stellen; inoffizieller Worker bleibt Prototyp).
4. **Sport-Packs sind Datenpakete, keine Codepfade**; Sportarten-Registry ist SSOT
   (hartcodierte Sportlisten sind Alt-Schuld, Abbau Phase 7+).
5. Nord-Stern-Dokument: `docs/VISION-TRAININGSENGINE-2026-08.md` (nicht bindend;
   bindend bleiben Umsetzungsplan + dieses Dokument).

**Phase-6-Entscheidungen (Prinzip: „was langfristig sinnvoll ist, jetzt richtig
bauen — nichts zweimal anfassen"):**

- **① Kapazitäts-SoT:** die kanonische Lastserie (`dailyLoadSeries`) ist die einzige
  Ist-Wahrheit; `running-capacity-factory` ist die einzige zulässige Ableitung für
  Planungskapazität (S3-Adapter); `calc.js`-Livewerte bleiben reine Anzeige und
  fließen nie in eine Prescription.
- **② Wissenschaftlicher Review (6.2):** Dokumentations-Skelett ohne Statusänderung.
  Alle Regeln bleiben `unreviewed`; das Production-Gate bleibt zu, bis ein
  qualifizierter Review real existiert. Kein Selbst-Review als Gate-Öffner.
- **③ Rechtliche Ist-Erhebung (6.5):** JETZT in Phase 6 (Datenflüsse, Einwilligungen,
  Lösch-/Exportpfade aus dem Code erhoben als Entscheidungsvorlage); finale Texte
  bleiben Phase 10.
- **Verträge (6.1):** sport-neutral formuliert; neutrales Workout-Schema
  (blocks/completion/target) wird als Vertrag Nr. 4/5 normativ festgelegt, BEVOR
  der Scheduler das erste Workout erzeugt; die 6 Belastungskonten sind Zielmodell
  mit sRPE/TRIMP als ehrlich ausgewiesener implementierter Teilmenge.

**Korrektur Planangabe:** `running-knowledge-pack.js` enthält **14 Regeln über
14 Topics** (nicht 19 — die 19 stammten aus der ruleId-Vorkommenszählung inklusive
der 5 goldenCase-Referenzen).
