/* ORVIA · profile_strength — B-03 Profilstaerke (rein) + Verdrahtung
   node supabase/tests/profile_strength_test.mjs */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'engine', 'profile-strength.js'))) || _flat);
const S = require(join(APP, 'js/engine/profile-strength.js'));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const full = { completeness: { essential: { score: 1, complete: true, missing: [] } }, planInput: { source: 'main_goal', category: 'half_marathon', family: 'run', goalId: 'g1', gaps: [] }, performance: { anyOk: true }, availableDays: 4, staleSections: [] };
const C = o => S.compute(Object.assign({}, full, o));

sec('A · Score und Band');
{
  ok('A1 alles da → 100, stark, keine Luecken', C({}).score === 100 && C({}).band === 'stark' && C({}).gaps.length === 0);
  ok('A2 nichts → 0, schwach, Luecken Ziel + Tage', S.compute({}).score === 0 && S.compute({}).band === 'schwach' && S.compute({}).gaps.map(g => g.id).join() === 'goal_missing,availability_days');
  ok('A3 ohne Zielwert: −7,5 (25×0,3) → 92 solide? nein: 93 stark', C({ planInput: Object.assign({}, full.planInput, { gaps: ['target_value'] }) }).score === 93);
  ok('A4 ohne Leistungsreferenz (Ausdauerziel) → 80 solide', C({ performance: null }).score === 80 && C({ performance: null }).band === 'solide');
  ok('A5 Kraftziel: Leistungsreferenz nicht anwendbar → 100 trotz performance null', C({ planInput: { source: 'main_goal', category: 'muscle_gain', family: 'strength', goalId: 'g', gaps: [] }, performance: null }).score === 100);
  ok('A6 Frische: 2 veraltete Bereiche → −10; gedeckelt bei 3+', C({ staleSections: ['constraints', 'availability'] }).score === 90 && C({ staleSections: ['a', 'b', 'c', 'd'] }).penalty === 15);
  ok('A7 Pflichtbereich 60 % → 84 solide', C({ completeness: { essential: { score: 0.6, missing: [{ section: 'constraints', key: 'x' }] } } }).score === 84);
  ok('A8 1–2 Tage = 0,6; 0 Tage = 0', C({ availableDays: 2 }).score === 94 && C({ availableDays: 0 }).score === 85);
}

sec('B · Luecken verlinken auf den erhebenden Schritt');
{
  const r = C({ completeness: { essential: { score: 0.6, missing: [{ section: 'constraints', key: 'x' }, { section: 'constraints', key: 'y' }] } }, planInput: Object.assign({}, full.planInput, { gaps: ['target_value', 'target_date'] }), performance: null, availableDays: 1, staleSections: ['sports'] });
  const ids = r.gaps.map(g => g.id);
  ok('B1 Reihenfolge nach Gewicht: Pflichtbereich, Leistung, Zielwert/Datum, Tage, Frische', ids.join() === 'section_constraints,performance_reference,goal_target,goal_date,availability_few,stale_sports', ids.join());
  ok('B2 Pflichtbereich einmal je Bereich (nicht je Feld)', ids.filter(x => x === 'section_constraints').length === 1);
  ok('B3 Ziel-Luecken → goal_editor mit goalId', r.gaps.filter(g => g.action === 'goal_editor').every(g => g.goalId === 'g1') && r.gaps.filter(g => g.action === 'goal_editor').length === 2);
  ok('B4 alle anderen → sectionId', r.gaps.filter(g => !g.action).every(g => typeof g.sectionId === 'string' && g.sectionId));
  ok('B5 kein Hauptziel → goals-Bereich', S.compute({ planInput: { source: 'none' } }).gaps[0].sectionId === 'goals');
}

sec('C · Verdrahtung');
{
  const pc = readFileSync(join(APP, 'js/profile-center.js'), 'utf8'), idx = readFileSync(join(APP, 'index.html'), 'utf8'), sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('C1 profile-center baut und rendert die Staerke, exportiert die Builder', /function buildStrength\(/.test(pc) && /strengthHTML\(buildStrength\(p, now\)\)/.test(pc) && /buildStrength: buildStrength/.test(pc));
  ok('C2 Klick: goal_editor → openGoalEditor(goalId), sonst openProfileSection(sectionId)', /openGoalEditor\(g\.goalId/.test(pc) && /openProfileSection\(g\.sectionId\)/.test(pc));
  ok('C3 Skript + sw.js', idx.includes('js/engine/profile-strength.js') && sw.includes("'./js/engine/profile-strength.js'"));
  /* strengthHTML rein: ohne DOM aufrufbar */
  globalThis.ORVIA = { profileModel: {}, profileStrength: S }; global.window = globalThis;
  (0, eval)(pc); const PC = globalThis.ORVIA.profileCenter;
  const html = PC.strengthHTML(C({ performance: null }));
  ok('C4 HTML: Score, Band, Luecke als Button mit data-section', /pc-strength-score">80</.test(html) && /solide/.test(html) && /id="pc-gap-performance_reference"[^>]*data-section="body"/.test(html));
  ok('C5 HTML ohne Luecken: „Alles da"', /Alles da/.test(PC.strengthHTML(C({}))) && PC.strengthHTML(null) === '');
}
console.log('\n' + (fail ? '❌' : '✅') + ' profile_strength: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
