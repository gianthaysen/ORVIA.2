/* ORVIA · Phase 7 S5 (2026-08-05) — Session Prescription im neutralen Vertrag-4-Schema.
   Kernbeweise: Schema-Selbstvalidierung, RUN-INT-001-Konformitaet (ohne Pace-Evidenz
   NIE ein Pace-Ziel — RPE-Fallback + Flag), Dauer-Bilanz der Bloecke, Determinismus,
   fail-closed bei unbekanntem Typ/fehlender Dauer.
   node supabase/tests/phase7_s5_prescription_test.mjs [appRoot-absolut] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2]) : (existsSync(join(_flat, 'index.html')) ? _flat : join(_flat, '..', 'app'));
const PF = require(join(APP, 'js/engine/prescription-factory.js'));
const R = f => readFileSync(join(APP, f), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function collectTargets(blocks, out) { out = out || []; blocks.forEach(b => { if (b.target) out.push(b.target); if (b.blocks) collectTargets(b.blocks, out); }); return out; }
function totalSeconds(blocks) { return blocks.reduce((s, b) => b.type === 'repeat' ? s + b.iterations * totalSeconds(b.blocks) : s + ((b.completion && b.completion.type === 'duration') ? b.completion.value : 0), 0); }

const EV = { thresholdPaceSecPerKm: 300, confidence: 'medium' };   // 5:00/km Schwelle, echte Evidenz

/* ============ Intervalle MIT Evidenz ============ */
{
  const r = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 50, priority: 'key' }, EV);
  ok('Intervalle · ok + Schema selbstvalidiert + Provenienz', r.ok === true && r.provenance.paceEvidenceUsed === true
     && PF.validateWorkout(r.workout).length === 0);
  const rep = r.workout.blocks.find(b => b.type === 'repeat');
  ok('Intervalle · verschachteltes repeat mit work(pace-Bereich um Schwelle)+recovery(open)',
     !!rep && rep.blocks[0].target.type === 'pace' && rep.blocks[0].target.min === Math.round(300 * 0.92)
     && rep.blocks[0].target.max === Math.round(300 * 0.98) && rep.blocks[1].target.type === 'open',
     JSON.stringify(rep && rep.blocks[0].target));
  ok('Intervalle · Dauer-Bilanz: Blocksumme ≈ geplante Dauer (±10 %)',
     Math.abs(totalSeconds(r.workout.blocks) - 50 * 60) <= 50 * 60 * 0.10, totalSeconds(r.workout.blocks) + 's');
  ok('DETERMINISMUS · identischer Input ⇒ byte-identisch',
     JSON.stringify(r) === JSON.stringify(PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 50, priority: 'key' }, EV)));
}

/* ============ RUN-INT-001: OHNE Pace-Evidenz NIE ein Pace-Ziel ============ */
{
  const noEv = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 50 }, null);
  const targets = collectTargets(noEv.workout.blocks);
  ok('RUN-INT-001 · ohne Evidenz: KEIN pace-Ziel irgendwo, RPE-Fallback + Flag',
     targets.every(t => t.type !== 'pace') && targets.some(t => t.type === 'rpe' && t.value === 8)
     && noEv.flags.indexOf('no_pace_evidence_rpe_fallback') >= 0 && noEv.provenance.paceEvidenceUsed === false);
  const lowEv = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_tempo', durationMin: 45 }, { thresholdPaceSecPerKm: 300, confidence: 'low' });
  ok('RUN-INT-001 · low-confidence-Evidenz zählt NICHT als Evidenz (kein Pace-Ziel)',
     collectTargets(lowEv.workout.blocks).every(t => t.type !== 'pace'));
  const absurd = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_easy', durationMin: 40 }, { thresholdPaceSecPerKm: 30, confidence: 'high' });
  ok('RUN-INT-001 · unplausible Pace (30 s/km) wird als Evidenz verworfen',
     collectTargets(absurd.workout.blocks).every(t => t.type !== 'pace'));
}

/* ============ Easy/Long/Tempo + Kraft ============ */
{
  const easy = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_easy', durationMin: 40 }, EV);
  ok('Easy · ein work-Block, Pace-Bereich DEUTLICH über Schwelle (1.25–1.40×)',
     easy.workout.blocks.length === 1 && easy.workout.blocks[0].target.min === Math.round(300 * 1.25)
     && easy.workout.blocks[0].target.max === Math.round(300 * 1.40));
  const gym = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
    exercises: [{ exerciseId: 'back_squat', sets: 4, reps: 5, rir: 2, restSeconds: 180 }, { exerciseId: 'bench_press', sets: 3, reps: 8, rir: 2 }] }, null);
  ok('Kraft · exercise-Blöcke mit sets/reps/rir/rest im Vertrag-4-Schema',
     gym.ok === true && gym.workout.blocks.length === 2 && gym.workout.blocks[0].exercise_id === 'back_squat'
     && gym.workout.blocks[0].target.type === 'rir' && PF.validateWorkout(gym.workout).length === 0);
  const gymNoList = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general' }, null);
  ok('Kraft · ohne Übungsliste: generische Session + ehrliches Flag (keine erfundene Übungsauswahl)',
     gymNoList.ok === true && gymNoList.flags.indexOf('no_exercise_list_generic_session') >= 0);
}

/* ============ Fail-closed ============ */
{
  ok('unbekannter sessionType ⇒ blocked', PF.buildPrescription({ sportId: 'running', sessionType: 'xyz', durationMin: 40 }, null).blocked === 'unknown_session_type');
  ok('fehlende/zu kurze Dauer ⇒ blocked', PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_easy', durationMin: 5 }, null).blocked === 'duration_missing_or_too_short');
  ok('fehlende sport_id ⇒ blocked', PF.buildPrescription({ sessionType: 'endurance_easy', durationMin: 40 }, null).blocked === 'sport_id_missing');
  ok('Validator-Negativkontrolle: value UND min/max ⇒ Fehler',
     PF.validateWorkout({ sport_id: 'running', blocks: [{ type: 'work', completion: { type: 'duration', value: 600 }, target: { type: 'pace', value: 300, min: 290, max: 310 } }] }).length > 0);
}

/* ============ Reinheit + Einbindung ============ */
const src = R('js/engine/prescription-factory.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('Factory pure (Code): kein Date.now/Math.random/DOM/Storage/PROFILE/Garmin-Format',
   !/Date\.now|Math\.random|document\.|localStorage|\bPROFILE\b|garmin/i.test(src));
const idx = R('index.html'), sw = R('sw.js');
ok('index.html lädt prescription-factory', idx.indexOf('js/engine/prescription-factory.js') >= 0);
ok('sw.js precacht prescription-factory', sw.indexOf("'./js/engine/prescription-factory.js'") >= 0);
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version >= 238, genau einmal', swv != null && Number(swv) >= 238 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

console.log('\nphase7_s5_prescription: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
