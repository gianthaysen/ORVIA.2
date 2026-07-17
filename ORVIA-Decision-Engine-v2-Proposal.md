# ORVIA Decision-Engine v2 — Konzept & Patch-Vorschlag (NICHT eingebaut)

Status: **Vorschlag zur Review.** Es wurde KEIN Engine-Code geändert. Dieses Dokument ist zum Kopieren/Gegenprüfen (ChatGPT) gedacht.

---

## 1) Analyse — wo liegt aktuell was?

| Frage | Ort | Anmerkung |
|---|---|---|
| Großer Tagesform-Score | `ui.js` `orviaScore()` | Gewichtetes Mittel Erholung/Risiko/Last/Umsetzung/Fortschritt + Caps |
| Erholung | `calc.js` `readiness()` | Knie25, HRV20, Befinden18, Schlafdauer/-konto12, SchlafQ14, Stress8, RHR15, DOMS10, BB10 |
| Risiko | `ui.js` via `riskCard().score`, invertiert `100−risk` | Label „höher=gut" → missverständlich |
| Umsetzung | `ui.js` `executionScore()` | Nur Check-in-/Trainings-Frequenz 7 T |
| Status „Peak/Bereit/…" | `orviaScore()` (status) + `renderCommand()` (decision) | Seit letztem Patch an `dayState` gekoppelt |
| `buildTrainingDecision` | `calc.js`; UI-Adapter `currentDecision()` (`ui.js`), gerendert in `renderAdaptCard()` | Zentrale Quelle |
| Knie/DOMS/Schlaf/Krankheit-Gewichtung | `calc.js` `readiness()` + `dayStateEngine()` + `orviaScore()`-Caps | Verteilt auf 3 Stellen |
| Achtung-/Trigger-Block | `renderCommand()` „Warum?"-Liste (aus `Calc.ampel().why`) + `warningsFor()` + Adapt-Card-`reasons` | Mehrere Quellen → zu viel Text |
| Insight „Beschwerde über Grenzwert" | `issues.js` `moduleStatus()` Z.96 (`latest>=5 → 'warn'`) | **Bug-Ursache** (s. u.) |
| Caches | `buildGoal()` `_goalCache` (5 s); `orviaScore` kein Cache | `_goalCache` unkritisch |
| Aktive Module vs. Check-in | `issues.js` `activeModuleKeys()`/`moduleStatus()` lesen aus `issueSeries()`; Check-in schreibt `e.issues` | **Quelle differiert vom heutigen Wert** |
| Getrennte Logiken Score/Decision | Größtenteils gekoppelt (beide via `dayStateEngine` + gleiche Roh-Readiness); `ampel` läuft noch separat für `nextRunInfo` | Rest-Dualität |

### Bug 1 — „Beschwerde über Grenzwert" trotz 0/10 heute
`moduleStatus(key)` nimmt **`latest = letzter Wert der 21-Tage-Serie`** (`issues.js:92`) und stuft `latest>=5 → 'warn'`. Die Serie enthält den letzten **geloggten** Wert — der kann von **gestern** stammen, während der heutige Check-in-Slider 0/10 zeigt. Ergebnis: „Warnsignal" obwohl heute 0/10. → Fix: Status muss zwischen **heutigem** Wert und **historischem** Signal unterscheiden und Letzteres explizit als „vorheriges Signal" kennzeichnen.

### Bug 2 — gute Garmin-Werte überdecken schlechte subjektive/Safety-Daten
`readiness()` ist additiv-renormalisiert; ein fehlender/guter Wert (BB 96, HRV Good) zieht den Mittelwert hoch. Caps in `orviaScore` greifen erst nachgelagert und sind unvollständig (z. B. Safety-RED nicht hart genug auf 30–35).

### Restwiderspruch
`nextRunInfo()` nutzt noch `Calc.ampel()` statt der zentralen Decision → potenziell abweichender „nächster Lauf"-Text.

---

## 2) Zielarchitektur — eine Pipeline, klare Hierarchie

`buildTrainingDecision(input)` bleibt die **einzige Quelle der Wahrheit** und wird zur reinen Pipeline. Alle Schritte sind pure Funktionen in `calc.js` (testbar, ohne DOM):

```
buildTrainingDecision(input):
  n   = normalizeDecisionInput(input)          // vereinheitlicht Felder, Defaults, Aliasse
  sft = safetyCheck(n)                          // HARD GATE 1
  tt  = classifyTrainingType(n.todaySession)    // Trainingsart + Beinlast/Aufprall
  sp  = sportProfileFor(n.profile, n.todaySession)
  ctx = evaluateContextualConstraints(n)        // GATE 2: feste Termine / Spielnähe
  rec = evaluateRecoveryState(n)                // GATE 3: Schlaf, HRV, RHR, Stress, Konto
  pdm = evaluatePainAndDOMS(n, tt)              // GATE 4: lokal, nur wenn Struktur belastet
  ld  = evaluateLoadAndInterference(n, tt)      // Lastsprung, Lauf+LegDay-Interferenz
  state, action = resolveDecision(sft,ctx,rec,pdm,ld,tt)   // Hierarchie unten
  score = calculateReadinessScore(n, {rec,pdm,ld})         // additiv, aber gedeckelt
  score = applyDecisionCaps(score, {sft,rec,pdm,ld}, state, action, tt)
  subs  = calculateSubscores(n,{rec,ld,...})    // Erholung/Risiko/Umsetzung sauber
  return buildDecisionOutput(state,action,score,subs,
           buildTriggerHighlights(...),         // max 1–2 Trigger
           buildUserMessage(...), buildCoachSummary(...),
           dataQuality, weekAdjustments)
```

### Entscheidungshierarchie (zuerst greift, was höher steht)
1. **Safety-Gate** (Fieber, Brustschmerz, Atemnot, Schwindel, neuro, Trauma, akute Schwellung/Instabilität, Schmerz > 7): → `RED`, `REST`/`REPLACE_WITH_RECOVERY`, Score **0–35**, ruhiger Hinweis, keine Diagnose.
2. **Kontext-Gate** (Spiel/Wettkampf 24–48 h, Vereinstraining heute, hart vor Match): **nicht** automatisch RED → Zusatztraining anpassen, Woche umsortieren.
3. **Recovery-Gate** (schlechter Schlaf, HRV Low, Stress, Schlafkonto −): nicht automatisch RED → harte Einheiten reduzieren/verschieben; Score-Cap nur wenn **mehrere** Faktoren zusammen.
4. **Lokales Belastungs-Gate** (Knie/Schienbein/Achilles/DOMS): nur stark eingreifen, **wenn die heutige Einheit die Struktur belastet**; sonst Hinweis. Ersatz vor Komplettsperre.
5. **Performance-Optimierung** (alles gut): `GREEN`/`KEEP`, hoher Score, „Peak" nur bei sauberem Zustand.

---

## 3) Geplante neue/angepasste Funktionen (calc.js)

```
normalizeDecisionInput(input) -> n
  { todaySession, profile, level, sport, goal,
    pain, region, doms, domsRegion, illness, sleepH, sleepQ,
    feel, motivation, stress, hrv, rhrDev, bodyBattery,
    loads:{l3,l7,l14}, fixedEvents, safety:{...alle flags...}, readinessRaw }

safetyCheck(n) -> {triggered, critical, level:'none|caution|red', flags[], advice}
  // level 'red' nur bei echten Warnzeichen; Schmerz>7 ⇒ red

evaluateRecoveryState(n) -> {score0_100, limiters[], severity:'ok|mild|moderate|high'}
  // kombiniert Schlafdauer+Qualität+HRV+RHR+Stress+Konto; mehrere schlechte ⇒ höhere severity

evaluatePainAndDOMS(n, tt) -> {painImpact:0..1, domsImpact:0..1, structuresAtRisk[], blocksHardForToday:bool}
  // blocksHardForToday nur, wenn tt die betroffene Struktur/Muskelgruppe belastet

evaluateLoadAndInterference(n, tt) -> {loadSpike:bool, interference:bool, notes[]}

resolveDecision(...) -> {state, action, primaryReason}
  // implementiert die Hierarchie 1–5

calculateReadinessScore(n, ev) -> 0..100   // additiv + sanfte Dämpfung subjektiv-dominanter Faktoren
applyDecisionCaps(score, ev, state, action, tt) -> 0..100  // siehe Cap-Tabelle
calculateSubscores(n, ev) -> {recovery, risk, execution}   // risk klar als „Belastungsrisiko" (niedrig=gut)
buildTriggerHighlights(ev, state) -> [{title, detail}]  // MAX 2, prioritätssortiert
```

### Cap-Tabelle (in `applyDecisionCaps`)
| Bedingung | Score-Cap |
|---|---|
| Safety-RED | 35 |
| RED (allg.) | 44 |
| ORANGE | 64 |
| YELLOW | 79 |
| Krankheit ohne Safety | 55 |
| Schmerz 8–10 | 40 |
| SchlafQ ≤2 **+ harte Einheit** | 65 |
| Schlafdauer <5 h **+ harte Einheit** | 65 |
| HRV Low + schlechter Schlaf | 68 |
| DOMS 8–10 **bei betroffener Muskelgruppe** | 65 |

Wichtig: **Knie 4 + Intervall → ORANGE/SWAP**, **Knie 4 + Oberkörper → max YELLOW/Hinweis** (kein RED). Caps wirken nur, wenn die heutige Einheit relevant ist (`tt`/`structuresAtRisk`).

---

## 4) Code-Patch (Vorschlag — zum Review, noch nicht eingebaut)

> Diese Blöcke ersetzen/ergänzen Funktionen in `calc.js`. `dayStateEngine`/`adaptSessionPlan`/`adaptWeekPlan`/`classifyTrainingType`/`safetyCheck` bleiben als Sub-Bausteine bestehen; `buildTrainingDecision` wird zur Pipeline umgebaut.

### 4a) calc.js — Recovery/Pain/DOMS/Load-Evaluatoren

```js
function evaluateRecoveryState(n){
  var lim=[],sc=100;
  if(n.sleepH!=null){ if(n.sleepH<5){sc-=28;lim.push('Schlaf <5 h');}
    else if(n.sleepH<6){sc-=16;lim.push('Schlaf <6 h');}
    else if(n.sleepH<7){sc-=7;} }
  if(n.sleepQ!=null){ if(n.sleepQ<=2){sc-=22;lim.push('Schlafqualität sehr niedrig');}
    else if(n.sleepQ<=4){sc-=12;lim.push('Schlafqualität niedrig');}
    else if(n.sleepQ<=6){sc-=5;} }
  if(n.hrv==='Low'){sc-=16;lim.push('HRV niedrig');}
  if(n.rhrDev!=null&&n.rhrDev>=5){sc-=12;lim.push('Ruhepuls erhöht');}
  if(n.stress==='High'){sc-=10;lim.push('Stress hoch');} else if(n.stress==='Med'){sc-=4;}
  sc=Math.max(0,Math.min(100,sc));
  var sev = lim.length>=3 ? 'high' : lim.length===2 ? 'moderate' : lim.length===1 ? 'mild' : 'ok';
  return {score0_100:sc, limiters:lim, severity:sev};
}

function evaluatePainAndDOMS(n, tt){
  var region=(n.region||'').toLowerCase();
  var impact=/knie|knee|schienbein|shin|achill|fuß|fuss|sprung|ankle/.test(region);
  var hitsStruct = !tt ? true
    : (tt.impact && impact) || (tt.legLoad && /bein|hamstring|adduktor|quad|wade/.test((n.domsRegion||region)));
  var painImpact = (n.pain||0)/10;
  var domsImpact = (n.doms||0)/10;
  var blocks = ((n.pain||0)>=5 && impact && hitsStruct) || ((n.doms||0)>=7 && hitsStruct);
  var structures=[]; if((n.pain||0)>=3&&impact)structures.push(region);
  return {painImpact:painImpact, domsImpact:domsImpact, structuresAtRisk:structures, blocksHardForToday:blocks, hitsStruct:hitsStruct};
}

function evaluateLoadAndInterference(n, tt){
  var L=n.loads||{}, spike=(L.l3!=null&&L.l7!=null&&L.l7>0&&L.l3/L.l7>1.4);
  var interference=!!(tt && tt.legLoad && (n.doms||0)>=4);
  var notes=[]; if(spike)notes.push('Belastungssprung'); if(interference)notes.push('Bein-Interferenz');
  return {loadSpike:spike, interference:interference, notes:notes};
}
```

### 4b) calc.js — Caps + Trigger-Highlights

```js
function applyDecisionCaps(score, ev, state, action, tt){
  var cap=100, S=ev.safety||{}, R=ev.recovery||{}, P=ev.pdm||{}, n=ev.n||{};
  var hard = tt && tt.hard;
  if(S.level==='red') cap=Math.min(cap,35);
  if(n.illness && S.level!=='red') cap=Math.min(cap,55);
  if((n.pain||0)>=8) cap=Math.min(cap,40);
  if(n.sleepQ!=null&&n.sleepQ<=2&&hard) cap=Math.min(cap,65);
  if(n.sleepH!=null&&n.sleepH<5&&hard) cap=Math.min(cap,65);
  if(n.hrv==='Low'&&((n.sleepH!=null&&n.sleepH<6)||(n.sleepQ!=null&&n.sleepQ<=4))) cap=Math.min(cap,68);
  if((n.doms||0)>=8&&P.hitsStruct) cap=Math.min(cap,65);
  cap=Math.min(cap,{GREEN:100,YELLOW:79,ORANGE:64,RED:44}[state]);
  return Math.max(0,Math.min(score,cap));
}

// Max. 2 Trigger, prioritätssortiert — keine langen Klammerlisten, keine Medizin-Sprache
function buildTriggerHighlights(ev, state){
  var out=[], S=ev.safety||{}, R=ev.recovery||{}, P=ev.pdm||{}, C=ev.ctx||{}, L=ev.load||{};
  if(S.triggered) out.push({title:'Starkes Warnsignal', detail:'Heute keine intensive Einheit.'});
  if(C.matchConflict) out.push({title:'Plan-Konflikt', detail:'Harte Einheit wird verschoben.'});
  if(P.blocksHardForToday) out.push({title:'Beinbelastung erhöht', detail:'Kein Intervall oder Leg Day.'});
  if(R.severity==='high'||R.severity==='moderate') out.push({title:'Schlaf limitiert Intensität', detail:'Heute keine maximale Einheit.'});
  if(L.loadSpike) out.push({title:'Lastsprung', detail:'Umfang kontrollieren.'});
  return out.slice(0,2);
}
```

### 4c) issues.js — Insight-Bug fix (heutiger Wert vs. vorheriges Signal)

```js
// moduleStatus erweitern: heutigen Wert von historischem trennen
function moduleStatus(key){
  var s=issueSeries(key,21);
  if(!s.length)return{key:key,label:(ORVIA_MODULES[key]||{}).label||key,status:'kein',score:null,streak:0,today:0,fromPast:false};
  var todayK=(typeof todayStr==='function')?todayStr():null;
  var todayEntry=s[s.length-1];
  var todayVal=(todayEntry && todayEntry.d===todayK)?todayEntry.v:0;   // nur echter Heute-Wert zählt als „heute"
  var latest=todayEntry.v, fromPast=!(todayEntry.d===todayK && todayEntry.v>0);
  var zero=0;for(var i=s.length-1;i>=0;i--){if(s[i].v===0)zero++;else break;}
  var base = fromPast ? todayVal : latest;   // Status-Stufe NUR aus heutigem Wert
  var st;
  if(base>=5)st='warn'; else if(base>=3)st='aktiv'; else if(base>=1)st='beobachten';
  else st=(zero>=14)?'praevention':(zero>=7)?'stabil':'ruhig';
  return{key:key,label:(ORVIA_MODULES[key]||{}).label||key,status:st,score:base,today:todayVal,
         lastSignal:latest,fromPast:fromPast,streak:zero,series:s};
}
// Insight-Renderer: „über Grenzwert" nur wenn today>=Schwelle; sonst „vorheriges Signal (Datum)" oder gar nicht.
```

### 4d) ui.js — Verdrahtung (Vorschlag)
- `orviaScore()` ruft **nur noch** `Calc.buildTrainingDecision(...)` und liest `decision.dayState`, `decision.score`, `decision.subscores`, `decision.triggers`. Keine eigenen Caps/Status mehr.
- `renderCommand()` „Warum?" → `decision.triggers` (max 2), „Details anzeigen" optional aufklappbar.
- `nextRunInfo()` Eingabe `ampelC` ersetzen durch `decision.dayState`/`decision.todayAction` (entfernt die letzte Ampel-Dualität).
- `currentDecision()` und `orviaScore()` rufen **dieselbe** `buildTrainingDecision`-Instanz pro Render auf (einmal berechnen, weiterreichen) → garantiert identisch.

---

## 5) Tests, die ich danach ausführen würde (Node, calc.js)

Mapping auf deine 26 Fälle:
- **1–2** (keine Beschwerde / Module 0/10): `moduleStatus` mit Heute=0, Vortag=6 → `status` aus Heute=0 ('ruhig'), `fromPast=true`, kein aktiver Grenzwert-Insight.
- **3–6** Schlaf: SchlafQ3+Easy → reduzieren, nicht RED; SchlafQ3+Intervall → REDUCE_INTENSITY/MOVE; <5 h+LegDay → reduzieren/verschieben; Low+schlecht → Cap ≤68.
- **7–10** Knie/DOMS kontextabhängig: Knie4+Intervall→SWAP/REDUCE; Knie4+Oberkörper→kein Stopp (max YELLOW); DOMS8 Beine+LegDay→Ersatz; DOMS8 Beine+Oberkörper→nicht RED.
- **11–12** Safety: Schmerz8→Score<45, RED; Fieber→Score≤35, keine Intensität.
- **13–16** Caps: YELLOW≤79, ORANGE≤64, RED≤44, Safety-RED≤35.
- **17** `buildTriggerHighlights` liefert ≤2 Einträge.
- **18** Tagesform-Status == Decision-Status (gleiche Quelle).
- **19–20** Insight/Module nach Speichern synchron; keine alten Werte sichtbar.
- **21** HRV Good + BB hoch + Safety-Flag → trotzdem Score≤35.
- **22** SchlafQ3: harte Einheit stärker gedeckelt als Easy.
- **23–24** Spiel morgen+LegDay→MOVE (nicht RED); Vereinstraining fix+schlechter Schlaf→Zusatz reduziert.
- **25–26** GREEN+KEEP+sauber→Peak; GREEN+kleine Beschwerde→Bereit, kein Peak.

---

## 6) Risiken & offene Punkte
- **Refactor-Umfang:** `buildTrainingDecision` zur Pipeline umbauen berührt `orviaScore`, `renderCommand`, `currentDecision`, `nextRunInfo`. Risiko fürs Live-UI → schrittweise mit Tests nach jedem Block.
- **`normalizeDecisionInput`** braucht eine klare Feldquelle (Check-in `m`, `e.issues`, Profil, Lasten). Doppelte Pfade (issues vs. knee) müssen vereinheitlicht werden.
- **DOMS-Region** wird heute nicht erfasst — bis dahin Annahme „Bein-DOMS" konservativ; sauber wäre ein DOMS-Regionsfeld im Check-in (separater kleiner UI-Schritt).
- **Trigger-„Details aufklappen"** ist neue UI — minimal halten.
- **Subscore „Risiko"**: Label auf „Belastungsrisiko (niedrig = gut)" ändern, sonst weiter missverständlich.
- **Tests** decken die reine Engine; DOM-Render (Tagesformkarte) bleibt manuell zu prüfen.
- **Reihenfolge-Empfehlung:** (A) Pipeline + Caps + Trigger in calc.js + Tests → (B) issues.js Insight-Fix + Tests → (C) ui.js auf eine Berechnung pro Render umstellen → (D) Subscore-Label + Trigger-UI.

---

**Freigabe abwarten.** Auf dein/ChatGPTs OK setze ich das in der Reihenfolge A→D mit Tests nach jedem Block um und erhöhe danach die Service-Worker-Version.
