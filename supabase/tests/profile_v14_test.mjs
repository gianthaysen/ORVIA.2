/* ORVIA · S1-UI (13.09.2026) — Profil-Screen nach Prototyp v14 (js/screens/profile-v14.js).
   Reine Renderer gegen ein data-Objekt: Zustaende (leer/Daten), Reiter, Zielkarten, Leistung, Sheet-Modell. */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { tStub } from './_i18n-src.mjs';
const APP = ['../../app/', '../../'].map(p => new URL(p, import.meta.url)).find(u => existsSync(new URL('js/screens/profile-v14.js', u)));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function makeSb(extra) {
  const sb = { window: null, console, Date, Math, String, Number, Array, Object, JSON, RegExp, isNaN, localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); } },
    icon: (n, s) => '<i class="ic-' + n + '"></i>', goalCatLabel: c => ({ half_marathon: 'Halbmarathon', hypertrophy: 'Muskelaufbau', target_bodyfat: 'Körperfett' }[c] || c), todayStr: () => '2026-09-13',
    document: { getElementById: () => null } };
  sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.ORVIA = { i18n: tStub() };
  Object.assign(sb, extra || {});
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('js/profile-model.js', APP), 'utf8'), sb, { filename: 'profile-model.js' });
  vm.runInContext(readFileSync(new URL('js/screens/profile-v14.js', APP), 'utf8'), sb, { filename: 'profile-v14.js' });
  return sb;
}
const HM = { id: 'g1', category: 'half_marathon', title: 'Halbmarathon unter 1:50', targetDate: '2026-10-18', targetValue: 6600, unit: 's', metricType: 'time', status: 'active', priority: 1 };
const KRAFT = { id: 'g2', category: 'hypertrophy', title: 'Stärker', status: 'active', priority: 2 };
const KFA = { id: 'g3', category: 'target_bodyfat', title: 'Körperfett 10–12 %', status: 'active', priority: 4, metricType: 'percent', unit: '%', currentValue: 15.4, targetValue: 12, timeHorizon: 'long' };
const DONE = { id: 'g4', category: 'run_10k', title: '10 km unter 50', status: 'achieved', priority: 2, result: { verdict: 'achieved', timeSec: 2917, deltaSec: -83, date: '2026-06-21', distanceKm: 10.02 } };
function baseData(over) {
  return Object.assign({ today: '2026-09-13', sports: [{ id: 'running', label: 'Laufen', role: 'main' }, { id: 'gym', label: 'Kraft', role: 'secondary' }], goals: [HM, KRAFT, KFA, DONE], mainGoalId: 'g1',
    planInput: { targetDate: '2026-10-18', daysTo: 35, phase: 'build', target: { targetMin: 110 } }, engine: { tPred: 111.3, state: 'border' }, feasibility: { evaluated: true, status: 'outside_modeled_corridor' },
    strength: { score: 80, band: 'solide', gaps: [{ id: 'x', label: 'HFmax fehlt', hint: 'Zonen geschätzt', weight: 20, sectionId: 'body' }] },
    season: { phases: [{ n: 'Aufbau', to: '2026-09-13', on: true }, { n: 'Peak', to: '2026-10-04', on: false }, { n: 'Taper', to: '2026-10-17', on: false }, { n: 'Wettkampf', to: '2026-10-18', on: false }], daysTo: 35, phase: 'build' },
    weekStats: { km: 47.2, sessionsAvg: 4.8 }, load: { ctl: 68, acwr: 1.08, suppressed: false }, conflicts: [], matches: {}, bests: { t5: 1380, t10: 2917, t21: 6730, t42: null, real: { k5: true, k10: true, k21: true, k42: false }, meas: { k21: { date: '2026-09-06' } } },
    bestsAll: { cycling: { k20: { sec: 2400, date: '2026-08-30' } }, swimming: { m400: { sec: 540, date: '2026-09-01' } } }, strengthRecords: [{ exerciseName: 'Kniebeuge', weightKg: 100, repetitions: 5, estimatedOneRepMax: 116 }, { exerciseName: 'Klimmzug', repetitions: 12 }],
    vo2: { value: 52.4, source: 'garmin' }, hfMax: { value: 193, source: 'derived_estimate' }, restingHr: { value: 46, source: 'garmin', updatedAt: '2026-09-12' }, threshold: { paceSec: 277, ref: { distanceKm: 10, date: '2026-06-21' } }, activitiesCount: 412 }, over || {});
}

/* A · Übersicht */
{
  const sb = makeSb(); const PV = sb.ORVIA.screens.profileV14; const d = baseData();
  const h = PV.overviewHTML(d);
  ok('A1 Sportarten-Chips mit Rolle („Laufen · Haupt")', /Laufen · Haupt/.test(h) && /Kraft · Neben/.test(h));
  ok('A2 Saison: aktive Phase markiert, „Wettkampf in 35 Tagen", vier Phasen, Phasenende als „bis …"', /pv-phase on"><b>Aufbau/.test(h) && /Wettkampf in 35 Tagen/.test(h) && (h.match(/class="pv-phase( on)?"/g) || []).length === 4 && /bis 13\.09\.2026/.test(h));
  ok('A3 Kennzahlen 47,2 km · 4,8 Einheiten · ACWR 1,08', /47,2/.test(h) && /4,8/.test(h) && /1,08/.test(h));
  ok('A4 Zielreise: drei aktive Ziele, Hauptziel zuerst, Prognose 1:51:18 · Ziel 1:50:00', (h.match(/goal-card/g) || []).length === 3 && h.indexOf('Halbmarathon unter 1:50') < h.indexOf('Stärker') && /Prognose <b>1:51:18<\/b> · Ziel 1:50:00/.test(h));
  ok('A5 Nebenziel-Badge + Wert-Fortschritt (15,4 % → 12 %)', /pv-badge-secondary/.test(h) && /15,4 % → 12 %/.test(h));
  ok('A7 Profil & Kontrolle: Ziele & Sportarten, Geräte & Daten, Einstellungen', /gmOpenProfPage\('goals'\)/.test(h) && /gmOpenProfPage\('connections'\)/.test(h) && /gmOpenProfPage\('settings'\)/.test(h));
  const e = PV.overviewHTML(baseData({ sports: [], goals: [], mainGoalId: null, season: null, weekStats: null, load: null, activitiesCount: 0 }));
  ok('A6 Leerzustaende: keine Sportarten, keine Saison, kein Ziel — ohne erfundene Zahlen', /Noch keine Sportarten/.test(e) && /Keine Saisonstruktur/.test(e) && /Noch kein Ziel/.test(e) && !/47,2/.test(e));
}
/* B · Ziele */
{
  const sb = makeSb(); const PV = sb.ORVIA.screens.profileV14;
  const d = baseData({ conflicts: [{ goalIds: ['g1', 'g2'], conflictType: 'endurance_pr_vs_mass', explanation: 'Bestzeit vs. Masse' }], matches: { g2: null } });
  const h = PV.goalsHTML(d);
  ok('B1 Kennzahlen 3 aktiv · 1 erreicht · 1 Konflikt', /<b>3<\/b><span>Aktiv/.test(h) && /<b>1<\/b><span>Erreicht/.test(h) && /<b>1<\/b><span>Konflikte/.test(h));
  ok('B2 Hauptziel-Pill „Knapp" (ausserhalb Korridor), Zielanteil als Leerzustand', /pill-badge att">Knapp/.test(h) && /Zielanteil am Wochenvolumen: wird ausgewiesen/.test(h));
  ok('B3 Konfliktkarte nennt beide Ziele + vier Entscheidungen', /Halbmarathon unter 1:50 ↔ Stärker/.test(h) && (h.match(/decideConflict\(/g) || []).length === 4);
  ok('B4 Erreicht-Liste: Datum, Zeit, Δ, Badge', /21\.06\.2026 · 48:37 \(−1:23\)/.test(h) && /pill-badge ready">Erreicht/.test(h));
  ok('B5 „Neues Ziel" oeffnet das Sheet, „Alle verwalten" das Modal', /openGoalSheet\(\)/.test(h) && /openGoalsManager\(\)/.test(h));
  const d2 = baseData({ matches: { g1: { activityId: 'hm', timeSec: 6730, verdict: 'missed', deltaSec: 130 } } });
  ok('B6 erkannter Wettkampf auf der Zielkarte mit Uebernehmen', /Wettkampf erkannt · 1:52:10 · Verfehlt/.test(PV.goalsHTML(d2)) && /goalConfirmResult\('g1','hm'\)/.test(PV.goalsHTML(d2)));
}
/* C · Leistung */
{
  const sb = makeSb(); const PV = sb.ORVIA.screens.profileV14; const d = baseData();
  const h = PV.performanceHTML(d);
  ok('C1 KPIs: VO₂max 52,4 (Garmin), Fitness 68 (CTL), ACWR 1,08 im Korridor', /52,4/.test(h) && /Garmin/.test(h) && /<b>68<\/b>/.test(h) && /Im Korridor/.test(h));
  ok('C2 Bestzeiten Laufen: 5/10/HM gemessen mit Datum, Marathon „keine Messung"', /HM<\/b>/.test(h) && /1:52:10/.test(h) && /gemessen · 06\.09\.2026/.test(h) && /keine Messung/.test(h));
  ok('C3 Rad 20 km 40:00 und Schwimmen 400 m 9:00', /40:00/.test(h) && /9:00/.test(h) && /Bestzeiten Rad &amp; Schwimmen/.test(h));
  ok('C4 Kraftwerte: Kniebeuge 116 kg (1RM), Klimmzuege 12 Wdh., zwei fehlend benannt', /116 kg/.test(h) && /12 Wdh\./.test(h) && /2 fehlende Werte/.test(h));
  ok('C5 HFmax geschaetzt (Tanaka) orange, Ruhepuls 46 Garmin, Schwellenpace 4:37 /km aus 10 km', /Aus dem Alter geschätzt/.test(h) && /pv-est/.test(h) && /<b|46/.test(h) && /4:37 \/km/.test(h) && /Aus 10 km-Referenz/.test(h));
  const e = PV.performanceHTML(baseData({ vo2: null, load: null, bests: null, bestsAll: null, strengthRecords: [], hfMax: null, restingHr: null, threshold: null }));
  ok('C6 ohne Daten: „—" und ehrliche Hinweise, keine Zahlen', /keine Quelle/.test(e) && /Kein Leistungsbeleg/.test(e) && !/52,4|4:37/.test(e));
}
/* D · Profilstaerke-Karte, Reiter, Rendern */
{
  const sb = makeSb(); const PV = sb.ORVIA.screens.profileV14;
  const c = PV.strengthCardHTML(baseData().strength);
  ok('D1 ps-card: 80 %, eine Luecke „Hoch", Ring-Offset gesetzt', /80%/.test(c) && /HFmax fehlt/.test(c) && /g-w">Hoch/.test(c) && /stroke-dashoffset="28\.9"/.test(c));
  ok('D2 ohne Luecken: Bestaetigungstext', /alles da/i.test(PV.strengthCardHTML({ score: 100, band: 'stark', gaps: [] })) || /Alles/.test(PV.strengthCardHTML({ score: 100, band: 'stark', gaps: [] })));
  ok('D3 Reiter: Uebersicht aktiv, drei Buttons, Community (noch) nicht', (PV.navHTML('ueber').match(/seg-btn/g) || []).length === 3 && /seg-btn on" data-tab="ueber"/.test(PV.navHTML('ueber')) && !/komm/.test(PV.navHTML('ueber')));
  ok('D4 activeTab Standard ueber; setTab merkt sich den Reiter', PV.activeTab() === 'ueber' && (PV.setTab('ziele'), PV.activeTab() === 'ziele'));
}
/* E · Ziel-Sheet-Modell */
{
  const sb = makeSb(); const PV = sb.ORVIA.screens.profileV14; sb.GOAL_GROUP_DE = { endurance: 'Ausdauer', strength: 'Kraft' };
  const m = PV.sheetModel(null);
  ok('E1 neues Ziel: Gruppe Ausdauer, Kategorie Halbmarathon, Prio 1', m.group === 'endurance' && m.category === 'half_marathon' && m.priority === 1 && m.id === null);
  const h = PV.sheetHTML(m);
  ok('E2 Sheet: Kategorie-Chips, Ziel-Chips, Zielzeit-Feld, Datum, Prioritaet, „Mehr Optionen"', /sheetPick\('group','strength'\)/.test(h) && /sheetPick\('category','marathon'\)/.test(h) && /id="pvg_time"/.test(h) && /id="pvg_date"/.test(h) && /sheetPick\('priority',2\)/.test(h) && /sheetMore\(\)/.test(h));
  const m2 = PV.sheetModel(KRAFT);
  ok('E3 Kraftziel: Gruppe strength, kein Zeitfeld', m2.group === 'strength' && !/pvg_time/.test(PV.sheetHTML(m2)));
  ok('E4 Validierung: NaN-Zeit ⇒ Fehlermeldung, sonst null', PV.sheetValidate(Object.assign({}, m, { targetValue: NaN })) !== null && PV.sheetValidate(m) === null);
}
/* G · S1b Sichtpruefung v8-371 (13.09.): Titel-nur-Wert, tolerante Zahlen, Zielanteil-Hinweis 1x, Kraftwerte aus Training, Quellenlabel, Ring-Klasse */
{
  const sb = makeSb(); const PV = sb.ORVIA.screens.profileV14;
  const KFA2 = { id: 'g9', category: 'target_bodyfat', title: '12%', status: 'active', priority: 2, unit: '%', targetValue: '12', currentValue: null };
  const d = baseData({ goals: [HM, KFA2], mainGoalId: 'g1' });
  const h = PV.goalsHTML(d);
  ok('G1 Titel „12%" ist kein Titel: Kategorie als Ueberschrift, Zielwert „12" (String) wird als Ziel gelesen', /<h4>Körperfett<\/h4>/.test(h) && !/<h4>12%<\/h4>/.test(h) && !/Kein Zielwert/.test(h));
  ok('G2 Zielanteil-Hinweis genau einmal unter der Liste (nicht je Karte)', (h.match(/pv-alloc-note/g) || []).length === 1);
  ok('G3 ohne Fortschritt keine leere Leiste (goal-line none), Hauptziel ohne Engine ebenfalls', /goal-line none/.test(h) && !/goal-line"><i style="width:0%/.test(h));
  const sb2 = makeSb({ ORVIA: { i18n: tStub(), gymVolume: { gymPipeline: () => ({ snapshots: [{ startedAt: '2026-09-02T18:00:00Z', exercises: [{ exerciseNameSnapshot: 'Kniebeuge (Langhantel)', sets: [{ completed: true, set_type: 'working', weight: 100, reps: 5 }, { completed: true, set_type: 'warmup', weight: 60, reps: 8 }] }, { exerciseNameSnapshot: 'Klimmzug', sets: [{ completed: true, set_type: 'working', weight: null, reps: 11 }] }, { exerciseNameSnapshot: 'Bankdrücken', sets: [{ completed: false, set_type: 'working', weight: 80, reps: 5 }] }] }] }) } } });
  const PV2 = sb2.ORVIA.screens.profileV14;
  const p = PV2.performanceHTML(baseData({ strengthRecords: [] }));
  ok('G4 Kraftwerte aus Training: Kniebeuge e1RM 117 kg (Epley 100×5, ganze kg), Klimmzuege 11 Wdh., Bankdruecken (Satz nicht abgeschlossen) und Kreuzheben fehlen', /117 kg/.test(p) && /11 Wdh\./.test(p) && /aus Training/.test(p) && /2 fehlende Werte/.test(p));
  ok('G5 manueller Eintrag schlaegt abgeleiteten Wert nur, wenn hoeher (116 < 117 ⇒ Training), Klimmzuege ohne e1RM-Zusatz', /117 kg/.test(PV2.performanceHTML(baseData())) && /aus Training \(e1RM\) · 02\.09\.2026/.test(p) && /<div class="ds">aus Training · 02\.09\.2026/.test(p));
  ok('G6 Rad/Schwimmen: Distanz fett, Sportart als Zusatzzeile', /<b>400 m<\/b><small>Schwimmen<\/small>/.test(p));
  ok('G7 Quellenlabel: automatic ⇒ automatisch, garmin_unofficial ⇒ Garmin', /automatisch/.test(PV.performanceHTML(baseData({ vo2: { value: 53, source: 'automatic' } }))) && /Garmin/.test(PV.performanceHTML(baseData({ vo2: { value: 53, source: 'garmin_unofficial' } }))));
  ok('G8 Profilstaerke-Ring: Prozent in eigener Klasse ps-pct (kein globales .pv)', /class="ps-pct"/.test(PV.strengthCardHTML(baseData().strength)) && !/class="pv"/.test(PV.strengthCardHTML(baseData().strength)));
}
/* H · S1c (13.09., zweite Sichtpruefung): Saisonmodell mit Wochen, Profilstaerke-Karte bei 100 % weg, Schaetzquelle, rechte Werte */
{
  const sb = makeSb(); const PV = sb.ORVIA.screens.profileV14;
  const season = { model: 'season', totalWeeks: 13, weeksToRace: 5, daysTo: 35, targetDate: '2026-10-18', phases: [
    { key: 'base', n: 'Basis', weeks: 4, on: false, done: true, week: null }, { key: 'build', n: 'Aufbau', weeks: 4, on: true, done: false, week: 4 },
    { key: 'peak', n: 'Spitze', weeks: 3, on: false, done: false, week: null }, { key: 'taper', n: 'Tapering', weeks: 2, on: false, done: false, week: null }] };
  const h = PV.overviewHTML(baseData({ season }));
  ok('H1 Saison (Wochenmodell): „Aufbauphase · Woche 4 von 4", Basis „4 Wo · fertig", Spitze „3 Wo", Wettkampfdatum in der Quelle', /Aufbauphase · Woche 4 von 4/.test(h) && /pv-phase done"><b>Basis<\/b><span>4 Wo · fertig/.test(h) && /<b>Spitze<\/b><span>3 Wo</.test(h) && /Wettkampf 18\.10\.2026 \(in 35 Tagen\)/.test(h));
  ok('H2 Profil & Kontrolle: „3 aktiv" rechts, Provider rechts, Sync-Rest in der Zeile', /p-v">3 aktiv</.test(h));
  const h2 = makeSb({ gmProfSyncLabel: () => 'Garmin · vor 4 Min synchronisiert' }).ORVIA.screens.profileV14.overviewHTML(baseData({ season }));
  ok('H3 Geraete & Daten: Provider als rechter Wert, Rest als Untertitel', /p-d">vor 4 Min synchronisiert</.test(h2) && /p-v">Garmin</.test(h2));
  ok('H4 Profilstaerke-Karte nur bei Luecken: 100 % ohne Luecken ⇒ keine Karte; 80 % ⇒ Karte', PV.strengthNeedsCard({ score: 100, gaps: [] }) === false && PV.strengthNeedsCard({ score: 80, gaps: [{}] }) === true && PV.strengthNeedsCard({ score: 100, gaps: [{}] }) === true);
  const p = PV.performanceHTML(baseData({ bests: { t5: 1414, t10: 3270, t21: 8413, t42: 17537, real: { k5: 1, k10: 1, k21: 1 }, estFrom: { k42: 'k21' }, meas: { k21: { date: '2026-09-06' } } } }));
  ok('H5 Marathon-Schaetzung benennt ihre Quelle („geschätzt aus HM")', /4:52:17/.test(p) && /geschätzt aus HM \(Riegel\)/.test(p));
}
/* F · Verdrahtung */
{
  const ui = readFileSync(new URL('js/ui.js', APP), 'utf8'), idx = readFileSync(new URL('index.html', APP), 'utf8'), sw = readFileSync(new URL('sw.js', APP), 'utf8');
  ok('F1 renderGMProfile delegiert an ORVIA.screens.profileV14.render, Kopf ueber gmProfHeaderHTML', /ORVIA\.screens\.profileV14;if\(PV&&typeof PV\.render==='function'&&PV\.render\(host\)\)return;/.test(ui) && /^function gmProfHeaderHTML\(\)/m.test(ui));
  ok('F2 Modul in index.html (nach goal-detail.js) und im SW-Vorrat; season-phases ebenso', idx.indexOf('js/screens/profile-v14.js') > idx.indexOf('js/goal-detail.js') && sw.indexOf("'./js/screens/profile-v14.js'") > 0 && idx.indexOf('js/engine/season-phases.js') > 0 && sw.indexOf("'./js/engine/season-phases.js'") > 0);
  const src = readFileSync(new URL('js/screens/profile-v14.js', APP), 'utf8');
  ok('F3 keine Demo-Zahlen aus dem Prototyp im Modul (184, 412, 1:51:20, 58 %)', !/\b184\b|\b412\b|1:51:20|58 %/.test(src));
  /* Strukturvertrag (gm-ref/structure-contract.json · requiredSlots.mehr): die vier Profil-Slots muessen im Standard-Reiter sichtbar bleiben */
  const contract = JSON.parse(readFileSync(new URL('docs/gm-ref/structure-contract.json', APP), 'utf8'));
  const _pv = makeSb().ORVIA.screens.profileV14;
  /* Leeres Profil (so sieht es der Browser-Kollektor): Slots muessen auch ohne Saison/Ziele/Aktivitaeten sichtbar sein */
  const ovs = [_pv.overviewHTML(baseData()), _pv.overviewHTML(baseData({ season: null, goals: [], sports: [], weekStats: null, load: null }))];
  const missingSlots = (contract.requiredSlots.mehr || []).filter(sl => ovs.some(ov => ov.indexOf('data-gm-slot="' + sl + '"') < 0));
  ok('F4 Strukturvertrag: alle Profil-Slots im Reiter Uebersicht (' + (contract.requiredSlots.mehr || []).join(', ') + ')', missingSlots.length === 0, missingSlots.length ? 'fehlt: ' + missingSlots.join(' · ') : '');
}
console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
