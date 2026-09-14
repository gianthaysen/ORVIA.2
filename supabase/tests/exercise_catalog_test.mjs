/* ORVIA · exercise_catalog — S2b-1: Katalog als Basisbewegung × Variante (0047) + Datenfluss in den Client
   node supabase/tests/exercise_catalog_test.mjs */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'gym-volume.js'))) || _flat);
const MIG = [join(HERE, '..', 'migrations'), join(_flat, 'supabase', 'migrations')].find(p => existsSync(join(p, '0047_exercise_catalog_variants.sql')));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sql = readFileSync(join(MIG, '0047_exercise_catalog_variants.sql'), 'utf8');
const rows = sql.match(/^ \('[a-z0-9_]+',true,/gm) || [];
const slugs = rows.map(r => r.match(/'([a-z0-9_]+)'/)[1]);
ok('A1 0047: ≥ 200 Systemübungen, Slugs eindeutig', slugs.length >= 200 && new Set(slugs).size === slugs.length, slugs.length + ' Übungen');
ok('A2 0047: base_slug + variant jsonb, Index, idempotente Upserts (slug / exercise_id,muscle_key / equipment)', /add column if not exists base_slug/.test(sql) && /add column if not exists variant jsonb/.test(sql) && /on conflict \(slug\) do update/.test(sql) && /on conflict \(exercise_id, muscle_key\) do nothing/.test(sql) && /on conflict \(exercise_id, equipment_key\) do nothing/.test(sql));
ok('A3 0047: bestehende Namen bleiben (kein name im Update), Aliasse nur wenn leer', !/do update set[\s\S]*?\bname = excluded/.test(sql) && /cardinality\(public\.exercises\.aliases\), 0\) = 0/.test(sql));
const bases = new Set((sql.match(/,'[a-z_]+','\{"/g) || []).map(s => s.match(/'([a-z_]+)'/)[1]));
ok('A4 0047: ≥ 40 Basisbewegungen', bases.size >= 40, bases.size + ' Basen');
const musSlugs = new Set((sql.match(/^\('([a-z0-9_]+)','[a-z_]+',[0-9.]+,'(direct|indirect)'\)/gm) || []).map(s => s.match(/'([a-z0-9_]+)'/)[1]));
ok('A5 0047: jede Übung hat mindestens eine Muskelzuordnung', slugs.every(s => musSlugs.has(s)), slugs.filter(s => !musSlugs.has(s)).slice(0, 5).join(','));
const known = ['bench_press', 'incline_bench_press', 'overhead_press', 'lateral_raise', 'pullup', 'lat_pulldown', 'row', 'squat', 'leg_press', 'romanian_deadlift', 'leg_curl', 'hip_thrust', 'calf_raise', 'biceps_curl', 'triceps_pushdown', 'plank', 'bulgarian_split_squat', 'nordic_curl', 'copenhagen_plank', 'box_jump', 'db_bench_press', 'pec_deck', 'chinup', 'lat_pulldown_neutral', 'cable_row', 't_bar_row', 'smith_bench_press', 'lat_pulldown_close', 'ez_bar_curl', 'v_bar_pushdown', 'cable_fly_high', 'pullup_wide', 'trap_bar_deadlift'];
ok('A6 0047: alle Alt-Slugs (0003/0006) und die neuen Gerät/Griff-Varianten enthalten', known.every(s => slugs.includes(s)), known.filter(s => !slugs.includes(s)).join(','));

/* B · Client-Datenfluss */
globalThis.window = globalThis; require(join(APP, 'js/training-domain.js'));
const td = globalThis.ORVIA.trainingDomain;
const M = td.map || td;
const row = { id: 'u1', slug: 'lat_pulldown_close', name: 'Latzug eng', base_slug: 'lat_pulldown', variant: { equipment: 'cable', grip: 'overhand_close' }, exercise_muscles: [{ muscle_key: 'lats', weight: 1, involvement: 'direct' }, { muscle_key: 'biceps', weight: 0.5, involvement: 'indirect' }], exercise_equipment: [{ equipment_key: 'cable' }] };
const e = M.exerciseFromRow(row);
ok('B1 exerciseFromRow: baseSlug, variant, muscles {key:{weight,involvement}}, equipment[]', e.baseSlug === 'lat_pulldown' && e.variant.grip === 'overhand_close' && e.muscles.lats.involvement === 'direct' && e.muscles.biceps.weight === 0.5 && e.equipment[0] === 'cable');
ok('B2 labelBase/labelVariant: „Latzug" · „Kabelzug · eng"', td.labelBase('lat_pulldown') === 'Latzug' && td.labelVariant(e.variant) === 'Kabelzug · eng');
ok('B3 jede Basisbewegung aus 0047 hat ein Label', [...bases].every(b => td.BASE_LABELS[b]), [...bases].filter(b => !td.BASE_LABELS[b]).join(','));
const GV = require(join(APP, 'js/gym-volume.js'));
ok('B4 gym-volume: Snapshot-Muskeln aus dem Katalog schlagen die Namenstabelle (unbekannter Name, Katalogmuskeln ⇒ klassifiziert)', JSON.stringify(GV.musclesFor({ exerciseNameSnapshot: 'Xyz Spezial', muscles: e.muscles })) === JSON.stringify({ lats: 'direct', biceps: 0.5 }));
ok('B5 gym-volume: Katalog-Cache per ID (setCatalog) klassifiziert Alt-Snapshots ohne Muskelfeld', (() => { GV.setCatalog([e]); return JSON.stringify(GV.musclesFor({ exerciseId: 'u1', exerciseNameSnapshot: 'Irgendwas' })) === JSON.stringify({ lats: 'direct', biceps: 0.5 }); })());
ok('B6 gym-volume: unbekannte Muskelschlüssel werden gefaltet (traps→upper_back, adductors→quads), Fallback-Name bleibt', GV.fromCatalogMuscles({ traps: { weight: 1, involvement: 'direct' }, adductors: { weight: 0.6, involvement: 'indirect' } }).upper_back === 'direct' && GV.fromCatalogMuscles({ adductors: { weight: 0.6, involvement: 'indirect' } }).quads === 0.6 && !!GV.musclesFor({ exerciseNameSnapshot: 'Bankdrücken' }));
const AS = readFileSync(join(APP, 'js/activity-store.js'), 'utf8'), REPO = readFileSync(join(APP, 'js/repos/exerciseRepository.js'), 'utf8'), WU = readFileSync(join(APP, 'js/workout-ui.js'), 'utf8');
ok('B7 Snapshot friert slug/baseSlug/movementPattern/muscles ein', /slug: \(e && e\.exercise && e\.exercise\.slug\)/.test(AS) && /muscles: \(e && e\.exercise && e\.exercise\.muscles/.test(AS));
ok('B8 Repository liest Muskeln + Gerät per Embed (Fallback ohne Embed) und füllt den gym-volume-Katalog', /exercise_muscles\(muscle_key,weight,involvement\), exercise_equipment\(equipment_key\)/.test(REPO) && /O\.gymVolume\.setCatalog\(rows\)/.test(REPO) && /select\('\*'\)\.eq\('active', true\)/.test(REPO));
ok('B9 Eigene Übung: Muskeln + Gerät werden mitgeschrieben', /from\('exercise_muscles'\)\.upsert/.test(REPO) && /from\('exercise_equipment'\)\.upsert/.test(REPO));
ok('B10 Picker: Basisbewegung → Varianten (aufklappbar), „Zuletzt", flach bei Suche', /_toggleBase/.test(WU) && /wo\.pick\.bases/.test(WU) && /wo\.pick\.recent/.test(WU) && /if \(!q && shown\.length && shown\.some\(e => e\.baseSlug\)\)/.test(WU));
console.log('\nexercise_catalog: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
if (fail) process.exit(1);
