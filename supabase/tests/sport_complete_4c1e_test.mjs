/* ORVIA · 4c.1e — Abschluss Sportabdeckung inkl. HYROX. */
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
const NEW = ['gym', 'rowing', 'hiking', 'walking', 'climbing', 'yoga', 'mobility', 'hyrox'];

// Profile speicherbar + Werte erhalten (1,3-14,20-22)
let sp = M.normalizeSports([
  { sportId: 'gym', activeInApp: true, sportProfile: { fields: { goal: 'Muskelaufbau', split: 'Oberkörper/Unterkörper', linkedSports: ['football'] } } },
  { sportId: 'rowing', activeInApp: true, sportProfile: { fields: { env: 'beides', best2k: '7:20' } } },
  { sportId: 'hiking', activeInApp: true, sportProfile: { fields: { typicalElevation: 800, packWeight: 9 } } },
  { sportId: 'walking', activeInApp: true, sportProfile: { fields: { goal: 'Fitness' } } },
  { sportId: 'climbing', activeInApp: true, sportProfile: { fields: { discipline: 'Bouldern', maxGrade: '7A' } } },
  { sportId: 'yoga', activeInApp: true, sportProfile: { fields: { style: 'Vinyasa' } } },
  { sportId: 'mobility', activeInApp: true, sportProfile: { fields: { focusAreas: 'Hüfte' } } },
  { sportId: 'hyrox', activeInApp: true, sportProfile: { fields: { category: 'Open', targetTime: '1:15:00', strongestStation: 'Wall Balls', weakestStation: 'Sled Push' } } }
]);
const F = id => sp.find(s => s.sportId === id).sportProfile.fields;
ok('4c.1e-1/3 Kraftprofil + Ziel erhalten', F('gym').goal === 'Muskelaufbau' && F('gym').split === 'Oberkörper/Unterkörper');
ok('4c.1e-2 linkedSports nur aktive Sportarten', M.filterLinkedSports(['football', 'cricket'], ['football', 'gym']).join(',') === 'football');
ok('4c.1e-4/5 Rudernprofil + 2000m erhalten', F('rowing').env === 'beides' && F('rowing').best2k === '7:20');
ok('4c.1e-6/7 Wandern + Höhenmeter/Rucksack erhalten', F('hiking').typicalElevation === 800 && F('hiking').packWeight === 9);
ok('4c.1e-8 Gehenprofil speicherbar', F('walking').goal === 'Fitness');
ok('4c.1e-9/10 Kletterprofil + Maximalgrad', F('climbing').discipline === 'Bouldern' && F('climbing').maxGrade === '7A');
ok('4c.1e-11/12 Yoga + Stil erhalten', F('yoga').style === 'Vinyasa');
ok('4c.1e-13/14 Mobility + Schwerpunkt erhalten', F('mobility').focusAreas === 'Hüfte');
ok('4c.1e-20/21/22 HYROX Kategorie/Zielzeit/Stationen erhalten', F('hyrox').category === 'Open' && F('hyrox').targetTime === '1:15:00' && F('hyrox').strongestStation === 'Wall Balls' && F('hyrox').weakestStation === 'Sled Push');
// 29 Neustart
ok('4c.1e-29 Werte nach Neustart erhalten', M.normalizeSports(JSON.parse(JSON.stringify(sp))).find(s => s.sportId === 'hyrox').sportProfile.fields.category === 'Open');

// HYROX-Spezifika (15-19,26)
ok('4c.1e-15 HYROX im Katalog', !!SL.CATALOG_BY_ID.hyrox && SL.CATALOG_BY_ID.hyrox.label === 'HYROX');
ok('4c.1e-16 HYROX Profil-Schema', !!M.sportProfileSchema('hyrox') && M.sportProfileSchema('hyrox').fields.some(f => f[0] === 'category'));
ok('4c.1e-17 HYROX Aktivitäts-Schema', cfg.formSchemaForSport('hyrox').sportId === 'hyrox' && cfg.formSchemaForSport('hyrox').fields.some(f => f.key === 'sledPushKg'));
ok('4c.1e-18 HYROX deutsche Labels', cfg.enumLabel('hyroxType', 'simulation', 'hyrox') === 'Kompletter HYROX-Simulationstest' && cfg.sportLabel('hyrox') === 'HYROX');
ok('4c.1e-19 HYROX Demand-Baseline', M.resolveDemandProfile({ sportId: 'hyrox' }).muscularEndurance === 1.0 && M.resolveDemandProfile({ sportId: 'hyrox' }).aerobicEndurance > 0);
ok('4c.1e-26 HYROX nicht auf gym/running/athletics normalisiert', cfg.formSchemaForSport('hyrox').sportId === 'hyrox' && cfg.sportLabel('hyrox') === 'HYROX' && M.normalizeSport({ sportId: 'hyrox' }).sportId === 'hyrox');

// 27/28 Demand + Aktivitätsschema je Sportart
NEW.forEach(id => {
  ok('4c.1e-27/28 ' + id + ' Demand + Aktivitätsschema', Object.keys(M.resolveDemandProfile({ sportId: id })).length > 0 && cfg.formSchemaForSport(id).sportId === id);
});

// 32/33 Coverage: alle acht vollständig, other einziger Fallback (keine stillen Exemptions)
const hasAct = id => { try { return cfg.formSchemaForSport(id).sportId === id; } catch (e) { return false; } };
let catalog = SL.SPORT_CATALOG.map(s => ({ id: s.id, label: s.label, icon: s.icon }));
let cov = M.validateSportCoverage(catalog, { hasActivitySchema: hasAct, exempt: ['other'] });
ok('4c.1e-32 alle produktiven Sportarten vollständig (nur other ausgenommen)', cov.length === 0, cov.map(c => c.sportId + ':' + c.missing.join('|')).join(' '));
ok('4c.1e-33 other bleibt generischer Fallback', !M.sportProfileSchema('other') && SL.CATALOG_BY_ID.other.label === 'Andere');

// 30 deutsche Labels (Stichprobe alle hyroxType + gymType)
let hOpts = cfg.formSchemaForSport('hyrox').fields.find(f => f.key === 'hyroxType').options;
ok('4c.1e-30 alle HYROX-/Gym-Typen deutsch', hOpts.every(o => cfg.enumLabel('hyroxType', o, 'hyrox') !== o) && cfg.enumLabel('gymType', 'fullbody', 'gym') === 'Ganzkörper');

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
