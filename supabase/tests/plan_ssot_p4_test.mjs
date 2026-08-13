/* ============================================================
   ORVIA · P4 — Profil/Availability als einzige Trainingskonfiguration.
   Verträge:
   - effectiveTrainingConfig (pur): availability > legacy trainingDays > none;
     maxSessionsPerWeek deckelt; gym aus sports.gym.sessionsPerWeek;
     adaptationMode/riskTolerance aus preferences mit Legacy-Fallback.
   - generateWeekPlan: 4/5/6 verfügbare Tage ⇒ 4/5/6 Einheiten (Auffüllen nur
     locker, nie zusätzliche Intensität); Einheiten NUR auf verfügbaren Tagen
     (Long Run wird verschoben); 3 verfügbare ⇒ 3 (Deckel, A-Einheiten bleiben);
     Legacy trainingDays wirkt weiter ohne availability.
   - Setup-Card read-only (keine Setter-Buttons mehr), Editor-Links vorhanden.
   - Preferences-Editor schreibt adaptationMode/riskTolerance + Legacy-Spiegel.
   node supabase/tests/plan_ssot_p4_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL(_APPREL + 'js/', import.meta.url);

/* ---------- Harness: profile-model + Plan-Generator-Slice aus ui.js ---------- */
function modelSandbox() {
  const sb = { window: null, console };
  sb.window = sb; sb.ORVIA = {};
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb, { filename: 'profile-model.js' });
  return sb;
}
function planSandbox(profile) {
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  const start = ui.indexOf('function planDaysTarget');
  const end = ui.indexOf('function activeWeekPlan');
  if (start < 0 || end < 0) throw new Error('Generator-Slice nicht gefunden');
  const slice = ui.slice(start, end);
  const sb = { window: null, console, PROFILE: profile };
  sb.window = sb; sb.ORVIA = {};
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb, { filename: 'profile-model.js' });
  // gp-Helfer + Abhängigkeiten wie in ui.js
  vm.runInContext(`
    function gpR(l,d){return {t:'Laufen',l:l,d:d};}
    function gpB(l,d){return {t:'Rad',l:l,d:d};}
    function gpG(l){return {t:'Gym',l:l,d:'45 min'};}
    function gpS(l,d){return {t:'Schwimmen',l:l,d:d||'~1000 m'};}
    function gpM(){return {t:'Mobilität',l:'Mobility',d:'15 min'};}
    function goalOf(){return {type:(PROFILE&&PROFILE._goalType)||'halfmarathon'};}
    function userLevel(){return (PROFILE&&PROFILE.level)||'fortgeschritten';}
    function unitPriority(it){if(!it)return 'B';if(/Long|Intervalle|Tempo/.test(it.l||''))return 'A';if((it.t==='Mobilität'))return 'C';return 'B';}
  ` + slice, sb, { filename: 'plan-slice.js' });
  return sb;
}
function av(days, maxS) {
  const WD = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  const d = {}; WD.forEach((k, i) => { d[k] = days.indexOf(i) >= 0 ? { available: true } : { restDay: true, available: false }; });
  return { days: d, maxSessionsPerWeek: maxS != null ? maxS : null };
}
function planStats(w) {
  let act = [], hard = 0;
  for (let i = 0; i < 7; i++) { if (w[i] && w[i].length) { act.push(i); w[i].forEach(u => { if (/Long|Intervalle|Tempo/.test(u.l || '')) hard++; }); } }
  return { days: act, count: act.length, hard };
}

/* ---------- 1) effectiveTrainingConfig (pur) ---------- */
{
  const sb = modelSandbox();
  const F = sb.ORVIA.profileModel.effectiveTrainingConfig;
  ok('C1 exportiert', typeof F === 'function');
  const a = F({ availability: av([0, 1, 3, 4, 5]) });
  ok('C2 5 verfügbare Tage → targetDays 5 + Indizes', a.targetDays === 5 && a.daysSource === 'availability' && JSON.stringify(a.availableDayIdx) === '[0,1,3,4,5]');
  const b = F({ availability: av([0, 1, 3, 4, 5], 4) });
  ok('C3 maxSessionsPerWeek deckelt', b.targetDays === 4);
  const c = F({ trainingDays: 5 });
  ok('C4 Legacy-Fallback trainingDays', c.targetDays === 5 && c.daysSource === 'legacy');
  ok('C5 nichts gesetzt → null/none', F({}).targetDays === null && F({}).daysSource === 'none');
  const d = F({ sports: [{ sportId: 'gym', sessionsPerWeek: 3 }], gymDays: 5 });
  ok('C6 gym aus sports.sessionsPerWeek (schlägt Legacy)', d.gymDays === 3);
  const e = F({ preferences: { adaptationMode: 'automatic', riskTolerance: 'conservative' }, adaptationMode: 'manual' });
  ok('C7 preferences schlagen Legacy-Top-Level', e.adaptationMode === 'automatic' && e.riskTolerance === 'conservative');
  ok('C8 Legacy-Top-Level als Fallback', F({ adaptationMode: 'manual' }).adaptationMode === 'manual');
}

/* ---------- 2) Plan respektiert verfügbare Tage + Zieltagzahl ---------- */
{
  // 5 verfügbare Tage (So NICHT verfügbar → Long Run muss umziehen)
  const sb = planSandbox({ sports: ['Laufen'], level: 'fortgeschritten', availability: av([0, 1, 2, 3, 4]) });
  const w = sb.generateWeekPlan();
  const st = planStats(w);
  ok('P1 5 verfügbare Tage → 5 Einheiten', st.count === 5, 'count=' + st.count + ' days=' + st.days);
  ok('P2 alle Einheiten auf verfügbaren Tagen', st.days.every(d => d <= 4));
  ok('P3 Long Run verschoben, nicht gelöscht', w.some(day => day.some(u => /Long Run/.test(u.l))));
  // Template „fortgeschritten" hat genau 2 harte Einheiten (Intervalle + Long Run;
  // Tempo nur bei „profi") — Auffüllen darf diese Zahl NIE erhöhen.
  ok('P4 keine zusätzliche Intensität durch Auffüllen', st.hard === 2, 'hard=' + st.hard);
  // 6 Tage
  const sb6 = planSandbox({ sports: ['Laufen'], level: 'fortgeschritten', availability: av([0, 1, 2, 3, 4, 5]) });
  const st6 = planStats(sb6.generateWeekPlan());
  ok('P5 6 verfügbare Tage → 6 Einheiten', st6.count === 6, 'count=' + st6.count);
  // 3 Tage → Deckel, A-Einheiten überleben
  const sb3 = planSandbox({ sports: ['Laufen'], level: 'fortgeschritten', availability: av([1, 3, 6]) });
  const w3 = sb3.generateWeekPlan();
  const st3 = planStats(w3);
  ok('P6 3 verfügbare Tage → 3 Einheiten', st3.count === 3, 'count=' + st3.count);
  ok('P7 A-Einheiten (Intervalle/Long) bleiben beim Deckeln', st3.hard >= 2);
  // Legacy ohne availability
  const sbL = planSandbox({ sports: ['Laufen'], level: 'fortgeschritten', trainingDays: 5 });
  ok('P8 Legacy trainingDays=5 → 5 Einheiten (vorher fix 3)', planStats(sbL.generateWeekPlan()).count === 5);
  // gar nichts → Level-Default 4 (fortgeschritten)
  const sbN = planSandbox({ sports: ['Laufen'], level: 'fortgeschritten' });
  ok('P9 ohne Konfiguration → Level-Default (4)', planStats(sbN.generateWeekPlan()).count === 4, 'count=' + planStats(sbN.generateWeekPlan()).count);
}

/* ---------- 3) Setup-Card read-only + Preferences-Editor ---------- */
{
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  const setup = ui.split('function renderTrainingSetup')[1].split('\n}')[0];
  ok('S1 keine Setter-Buttons mehr in der Setup-Card', !/onclick="set(TrainingDays|GymDays|AdaptMode|RiskTol)/.test(setup));
  ok('S2 Links zu Verfügbarkeit + Präferenzen', /openAvailabilityEditor/.test(setup) && /openPreferencesEditor/.test(setup));
  ok('S3 Setup nutzt effectiveTrainingConfig', /effectiveTrainingConfig/.test(setup));
  ok('S4 Feste-Termine-Editor bleibt (einziger Editor)', /renderFixedEventsBox\(\)/.test(setup));
  ok('S5 Generator nutzt effectiveTrainingConfig', /effectiveTrainingConfig/.test(ui.split('function generateWeekPlan')[1].split('function activeWeekPlan')[0]));
  const prof = readFileSync(new URL('profile.js', base), 'utf8');
  ok('S6 Preferences-Editor hat Modus+Risiko-Felder', /pf_adapt/.test(prof) && /pf_risk/.test(prof));
  ok('S7 Save spiegelt Legacy-Leser', /PROFILE\.adaptationMode=PROFILE\.preferences\.adaptationMode/.test(prof));
}

/* ---------- 4) normalizePreferences kennt die neuen Felder ---------- */
{
  const sb = modelSandbox();
  const N = sb.ORVIA.profileModel.normalizePreferences;
  const p = N({ adaptationMode: 'automatic', riskTolerance: 'ambitious' });
  ok('N1 Whitelist-Werte bleiben', p.adaptationMode === 'automatic' && p.riskTolerance === 'ambitious');
  const q = N({ adaptationMode: 'kaputt', riskTolerance: 'yolo' });
  ok('N2 unbekannte Werte werden verworfen', q.adaptationMode === '' && q.riskTolerance === '');
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
