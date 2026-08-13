/* ============================================================
   ORVIA · H1 — Sportmodell-/Level-Brüche im Plan-Generator (Master-Anweisung
   Priorität 1). Root Cause: kanonische sports sind Objekt-Arrays, Alt-Leser
   verglichen deutsche Strings (Flags immer false); PROFILE.level ist bei
   v2-Nutzern leer (jeder galt als „fortgeschritten").
   Verträge:
   - generateWeekPlan erkennt kanonische sportIds (running/cycling/gym/swimming,
     triathlon impliziert run+bike+swim), Legacy-Strings bleiben kompatibel.
   - Läufer mit Gesundheitsziel bekommt KEINEN reinen Kraftplan mehr.
   - Nebensport Gym erscheint im Läuferplan; gymDays kommt aus
     effectiveTrainingConfig (gleiche Quelle wie die Setup-Anzeige).
   - userLevel(): beginner→anfaenger, competitive→profi, intermediate/advanced→
     fortgeschritten; Legacy-PROFILE.level nur Fallback. Anfänger ⇒ keine Intervalle.
   - hasGymData erkennt sportId 'gym'.
   node supabase/tests/sport_model_h1_test.mjs
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

function planSandbox(profile, goalType) {
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  const slice = ui.slice(ui.indexOf('function planDaysTarget'), ui.indexOf('function activeWeekPlan'));
  const lvl = ui.slice(ui.indexOf('function userLevel'), ui.indexOf('function applyLevelClass'));
  const sb = { window: null, console, PROFILE: profile };
  sb.window = sb; sb.ORVIA = {};
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb, { filename: 'profile-model.js' });
  vm.runInContext(`
    function gpR(l,d){return {t:'Laufen',l:l,d:d};}
    function gpB(l,d){return {t:'Rad',l:l,d:d};}
    function gpG(l){return {t:'Gym',l:l,d:'45 min'};}
    function gpS(l,d){return {t:'Schwimmen',l:l,d:d||'~1000 m'};}
    function gpM(){return {t:'Mobilität',l:'Mobility',d:'15 min'};}
    function goalOf(){return {type:${JSON.stringify(goalType || 'health')}};}
    function unitPriority(it){if(!it)return 'B';if(/Long|Intervalle|Tempo/.test(it.l||''))return 'A';if((it.t==='Mobilität'))return 'C';return 'B';}
  ` + lvl + slice, sb, { filename: 'plan-slice.js' });
  return sb;
}
const flat = w => { const out = []; for (let i = 0; i < 7; i++) (w[i] || []).forEach(u => out.push(u)); return out; };

/* ---------- 1) Kanonische Sport-Flags ---------- */
{
  const M = (() => { const sb = { window: null, console }; sb.window = sb; sb.ORVIA = {}; vm.createContext(sb); vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb); return sb.ORVIA.profileModel; })();
  // Läufer (kanonisch) mit Gesundheitsziel → Laufplan, KEIN reiner Kraftplan
  const p1 = { sports: M.normalizeSports([{ sportId: 'running', role: 'primary', level: 'intermediate' }]), trainingDays: 3 };
  const w1 = planSandbox(p1, 'health').generateWeekPlan();
  const u1 = flat(w1);
  ok('S1 Läufer+health ⇒ Laufeinheiten vorhanden', u1.some(u => u.t === 'Laufen'), JSON.stringify(u1.map(u => u.t)));
  ok('S2 Läufer+health ⇒ kein reiner Kraftplan', !(u1.length && u1.every(u => u.t === 'Gym')));
  // Läufer + Gym-Nebensport → Gym erscheint im Plan
  const p2 = { sports: M.normalizeSports([{ sportId: 'running', role: 'primary', level: 'intermediate' }, { sportId: 'gym', role: 'secondary', sessionsPerWeek: 2 }]), trainingDays: 5 };
  const w2 = planSandbox(p2, 'halfmarathon').generateWeekPlan();
  ok('S3 Gym-Nebensport erscheint im Läuferplan', flat(w2).some(u => u.t === 'Gym'), JSON.stringify(flat(w2).map(u => u.t)));
  ok('S4 gymDays aus sports.gym.sessionsPerWeek (2 Gym-Tage)', flat(w2).filter(u => u.t === 'Gym').length === 2);
  // Triathlon impliziert run+bike+swim
  const p3 = { sports: M.normalizeSports([{ sportId: 'triathlon', role: 'primary', level: 'intermediate' }]), trainingDays: 6 };
  const t3 = flat(planSandbox(p3, 'triathlon').generateWeekPlan()).map(u => u.t);
  ok('S5 Triathlon ⇒ Lauf+Rad+Schwimmen', t3.indexOf('Laufen') >= 0 && t3.indexOf('Rad') >= 0 && t3.indexOf('Schwimmen') >= 0);
  // Legacy-String-Array bleibt kompatibel
  const w4 = planSandbox({ sports: ['Laufen'], trainingDays: 3 }, 'halfmarathon').generateWeekPlan();
  ok('S6 Legacy-Strings weiter kompatibel', flat(w4).some(u => u.t === 'Laufen'));
  // inaktive Sportart zählt nicht
  const p5 = { sports: M.normalizeSports([{ sportId: 'running', role: 'primary', level: 'intermediate' }, { sportId: 'swimming', role: 'secondary', activeInApp: false }]), trainingDays: 4 };
  ok('S7 deaktivierte Sportart erzeugt keine Einheiten', !flat(planSandbox(p5, 'halfmarathon').generateWeekPlan()).some(u => u.t === 'Schwimmen'));
}

/* ---------- 2) userLevel kanonisch ---------- */
{
  const M = (() => { const sb = { window: null, console }; sb.window = sb; sb.ORVIA = {}; vm.createContext(sb); vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb); return sb.ORVIA.profileModel; })();
  const mk = (level, legacy) => planSandbox({ sports: M.normalizeSports([{ sportId: 'running', role: 'primary', level: level }]), level: legacy }, 'halfmarathon');
  ok('L1 beginner ⇒ anfaenger', mk('beginner').userLevel() === 'anfaenger');
  ok('L2 competitive ⇒ profi', mk('competitive').userLevel() === 'profi');
  ok('L3 advanced ⇒ fortgeschritten', mk('advanced').userLevel() === 'fortgeschritten');
  ok('L4 Legacy-Fallback ohne kanonisches Level', planSandbox({ sports: [], level: 'anfaenger' }, 'health').userLevel() === 'anfaenger');
  // Anfänger-Plan ohne Intervalle (sicherheitsrelevant)
  const wB = mk('beginner').generateWeekPlan();
  ok('L5 Anfänger-Läufer ⇒ keine Intervalle im Plan', !flat(wB).some(u => /Intervalle|Tempo/.test(u.l)), JSON.stringify(flat(wB).map(u => u.l)));
}

/* ---------- 3) hasGymData + Quelltext-Verbote ---------- */
{
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  ok('Q1 hasGymData erkennt sportId gym', /s\.sportId==='gym'/.test(ui.split('function hasGymData')[1].slice(0, 200)));
  const gen = ui.split('function generateWeekPlan')[1].split('function activeWeekPlan')[0];
  ok('Q2 kein nackter String-indexOf mehr im Generator (Verbot F)', !/sp\.indexOf\('Laufen'\)/.test(gen));
  ok('Q3 Generator-gymDays aus effectiveTrainingConfig', /effectiveTrainingConfig\(PROFILE\)\.gymDays/.test(gen));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
