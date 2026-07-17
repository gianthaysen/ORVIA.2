/* ORVIA · Phase 4.2e — Übungsbibliothek (statische Migrations-Prüfung 0003 + 0006).
   ≥60 Systemübungen, eindeutige Slugs, Step-up vorhanden, Muskel- & Equipment-Relationen.
   node supabase/tests/exercise_library_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const read = f => fs.readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8');
const m3 = read('0003_training_domain.sql'), m6 = read('0006_exercise_library_expansion.sql');

// Slugs aus den exercises-INSERTs beider Migrationen ziehen (Zeilen der Form ('slug',true,...)).
function slugsFrom(sql) {
  const seg = sql.slice(sql.indexOf('insert into public.exercises'));
  const out = []; const re = /\(\s*'([a-z0-9_]+)'\s*,\s*true\s*,/g; let mm;
  // nur bis zum nächsten "insert into" (Ende des exercises-Blocks) betrachten
  const block = seg.slice(0, seg.indexOf('on conflict'));
  while ((mm = re.exec(block))) out.push(mm[1]);
  return out;
}
const s3 = slugsFrom(m3), s6 = slugsFrom(m6);
const all = s3.concat(s6);
const uniq = new Set(all);

ok('0003 Seeds vorhanden (~20)', s3.length >= 18, 'gefunden: ' + s3.length);
ok('0006 ergänzt neue Übungen', s6.length >= 55, 'gefunden: ' + s6.length);
ok('Gesamt ≥ 60 Systemübungen', all.length >= 60, 'gesamt: ' + all.length);
ok('Keine doppelten Slugs', uniq.size === all.length, 'unique: ' + uniq.size + ' / ' + all.length);
ok('Step-up vorhanden (slug step_up)', uniq.has('step_up'));
ok('Keine 0006-Slugs kollidieren mit 0003', s6.every(x => s3.indexOf(x) < 0));

// Muskel- & Equipment-Relationen für step_up vorhanden.
ok('exercise_muscles referenziert step_up', /\('step_up','[a-z_]+',[0-9.]+,'(direct|indirect)'\)/.test(m6));
ok('exercise_equipment referenziert step_up', /\('step_up','[a-z_]+'\)/.test(m6));
// Stichprobe weiterer Gruppen
ok('Beinstrecker (leg_extension) mit Muskel quads', /\('leg_extension','quads'/.test(m6));
ok('Migration ist idempotent (on conflict)', (m6.match(/on conflict/g) || []).length >= 3 && /schema_migrations/.test(m6));

// --- Konsistenz Bewegungsmuster: jeder genutzte Schlüssel existiert in movement_patterns + Domain ---
function mpKeys(sql) { const seg = sql.slice(sql.indexOf('insert into public.movement_patterns')); const block = seg.slice(0, seg.indexOf('on conflict')); const out = []; const re = /\('([a-z_]+)'\s*,/g; let mm; while ((mm = re.exec(block))) out.push(mm[1]); return out; }
const mpSet = new Set(mpKeys(m3).concat(mpKeys(m6)));
ok('movement_patterns: drei neue Schlüssel registriert', mpSet.has('knee_extension') && mpSet.has('hip_adduction') && mpSet.has('hip_abduction'));

// Genutzte movement_pattern-Werte aus den exercises-INSERTs (Position 5: slug,is_system,name,category,movement_pattern).
function usedPatterns(sql) {
  const seg = sql.slice(sql.indexOf('insert into public.exercises'));
  const block = seg.slice(0, seg.indexOf('on conflict'));
  const out = []; const re = /\(\s*'[a-z0-9_]+'\s*,\s*true\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'([a-z_]+)'/g; let mm;
  while ((mm = re.exec(block))) out.push(mm[1]); return out;
}
const used = usedPatterns(m3).concat(usedPatterns(m6));
const missingInDb = [...new Set(used)].filter(p => !mpSet.has(p));
ok('Alle genutzten Bewegungsmuster existieren in movement_patterns', missingInDb.length === 0, missingInDb.join(','));

global.window = {};
(0, eval)(fs.readFileSync(new URL('../../js/training-domain.js', import.meta.url), 'utf8'));
const TD = global.window.ORVIA.trainingDomain;
const domainSet = new Set(TD.MOVEMENT_PATTERNS);
ok('training-domain enthält die drei neuen Schlüssel', domainSet.has('knee_extension') && domainSet.has('hip_adduction') && domainSet.has('hip_abduction'));
const missingInDomain = [...new Set(used)].filter(p => !domainSet.has(p));
ok('Keine unbekannten Bewegungsmuster (alle in D.MOVEMENT_PATTERNS)', missingInDomain.length === 0, missingInDomain.join(','));

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
