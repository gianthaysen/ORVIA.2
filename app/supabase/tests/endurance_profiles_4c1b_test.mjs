/* ORVIA · 4c.1b — vollständige Ausdauerprofile (Laufen/Rad/Schwimmen/Triathlon). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sb = {}; sb.window = sb; sb.self = sb; sb.console = console;
sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.Array = Array; sb.Object = Object; sb.String = String;
vm.createContext(sb);
const base = new URL('../../js/', import.meta.url);
vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb);
vm.runInContext(readFileSync(new URL('onboarding/onboarding-sports-logic.js', base), 'utf8'), sb);
sb.ORVIA.trainingDomain = { normSport: v => String(v || '').toLowerCase(), normSportStrict: () => null };
sb.ORVIA.activityNormalize = {};
vm.runInContext(readFileSync(new URL('activity-config.js', base), 'utf8'), sb);
const M = sb.ORVIA.profileModel, cfg = sb.ORVIA.activityConfig, SL = sb.ORVIA.onboardingSportsLogic;

// Profile speicherbar + Werte erhalten (1-3,6,7,9,10,12,13)
let sp = M.normalizeSports([
  { sportId: 'running', activeInApp: true, sportProfile: { fields: { distance: 'Halbmarathon', weeklyKm: 35, longestRun: 16 } } },
  { sportId: 'cycling', activeInApp: true, sportProfile: { fields: { type: 'Straße', ftp: 245 } } },
  { sportId: 'swimming', activeInApp: true, sportProfile: { fields: { stroke: 'Freistil', poolLength: '25 m', pace100: '1:55' } } },
  { sportId: 'triathlon', activeInApp: true, sportProfile: { fields: { distance: 'Mitteldistanz', weakestDiscipline: 'Schwimmen', strongestDiscipline: 'Laufen', weeklyHours: 8 } } }
]);
const F = id => sp.find(s => s.sportId === id).sportProfile.fields;
ok('4c.1b-1/2/3 Laufprofil (Distanz/Wochenkm erhalten)', F('running').distance === 'Halbmarathon' && F('running').weeklyKm === 35 && F('running').longestRun === 16);
ok('4c.1b-6/7 Radprofil + FTP erhalten', F('cycling').type === 'Straße' && F('cycling').ftp === 245);
ok('4c.1b-9/10 Schwimmprofil (Lage/Beckenlänge erhalten)', F('swimming').stroke === 'Freistil' && F('swimming').poolLength === '25 m');
ok('4c.1b-12/13 Triathlon (stärkste/schwächste Disziplin erhalten)', F('triathlon').weakestDiscipline === 'Schwimmen' && F('triathlon').strongestDiscipline === 'Laufen');

// Aktivitätstypen vorhanden + deutsch (4,8,11,14)
ok('4c.1b-4 Laufaktivitätstypen (lockerer/langer/Tempo/Intervalle…)', cfg.formSchemaForSport('running').fields.find(f => f.key === 'runType').options.length === 8 && cfg.enumLabel('runType', 'tempo', 'running') === 'Tempolauf');
ok('4c.1b-8 Radaktivitätstypen', cfg.enumLabel('rideType', 'climbing', 'cycling') === 'Bergtraining' && cfg.enumLabel('rideType', 'tt', 'cycling') === 'Zeitfahren');
ok('4c.1b-11 Schwimmaktivitätstypen', cfg.enumLabel('swimType', 'open_water', 'swimming') === 'Freiwasser');
ok('4c.1b-14 Triathlonaktivitätstypen (Koppel/Wechsel)', cfg.enumLabel('triType', 'bike_run', 'triathlon') === 'Rad-Lauf-Koppel' && cfg.enumLabel('triType', 'transition', 'triathlon') === 'Wechseltraining');

// Demand-Baseline + Distanzmodifikation (5)
let dHM = M.resolveDemandProfile({ sportId: 'running', discipline: 'Halbmarathon' });
let d5k = M.resolveDemandProfile({ sportId: 'running', discipline: '5 km' });
let dMar = M.resolveDemandProfile({ sportId: 'running', discipline: 'Marathon' });
ok('4c.1b Demand-Baseline Laufen vorhanden', dHM.aerobicCapacity > 0 && dHM.threshold > 0);
ok('4c.1b-5 Lauf-Demand variiert nach Distanz (5k mehr Schwelle, Marathon mehr Ausdauer)', d5k.threshold > dHM.threshold && dMar.aerobicCapacity >= dHM.aerobicCapacity && dMar.loadTolerance > dHM.loadTolerance);
ok('4c.1b Demand Rad/Schwimm/Triathlon vorhanden', M.resolveDemandProfile({ sportId: 'cycling' }).vo2max > 0 && M.resolveDemandProfile({ sportId: 'swimming' }).technique > 0 && M.resolveDemandProfile({ sportId: 'triathlon' }).runDiscipline > 0);

// Strukturierte Bestzeiten (15)
let perf = M.normalizePerformance({ personalBests: [{ sportId: 'running', distance: '10 km', timeSeconds: 2400, context: 'race', measuredAt: '2026-05-01' }] });
ok('4c.1b-15 strukturierte Bestzeit erhalten (kein Freitext)', perf.personalBests[0].timeSeconds === 2400 && perf.personalBests[0].id && perf.personalBests[0].sportId === 'running');

// Coverage vollständig (17) + getrennt von Leichtathletik (20)
const hasAct = id => { try { return cfg.formSchemaForSport(id).sportId === id; } catch (e) { return false; } };
let catalog = SL.SPORT_CATALOG.map(s => ({ id: s.id, label: s.label, icon: s.icon }));
['running', 'cycling', 'swimming', 'triathlon'].forEach(id => {
  let cov = M.validateSportCoverage(catalog.filter(s => s.id === id), { hasActivitySchema: hasAct });
  ok('4c.1b-17 Coverage vollständig: ' + id, cov.length === 0, cov[0] && cov[0].missing.join(','));
});
ok('4c.1b-20 Leichtathletik bleibt getrennt von Laufen', M.sportProfileSchema('athletics').label === 'Leichtathletik' && cfg.formSchemaForSport('athletics').fields.some(f => f.key === 'athleticsType') && cfg.formSchemaForSport('running').fields.some(f => f.key === 'runType'));

// 18: keine englischen Enum-Werte (Stichprobe aller runType-Optionen übersetzt)
let rOpts = cfg.formSchemaForSport('running').fields.find(f => f.key === 'runType').options;
ok('4c.1b-18 alle Lauf-Typen deutsch übersetzt', rOpts.every(o => cfg.enumLabel('runType', o, 'running') !== o));

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
