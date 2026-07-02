/* ORVIA · 4c.1d — vollständige Profile Tennis/Padel/Badminton/Golf. */
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

// Profile speicherbar + Werte erhalten (1-11)
let sp = M.normalizeSports([
  { sportId: 'tennis', activeInApp: true, sportProfile: { fields: { mode: 'beides', surface: 'Sand', playStyle: 'Offensiv' } } },
  { sportId: 'padel', activeInApp: true, sportProfile: { fields: { side: 'Links', context: 'Verein' } } },
  { sportId: 'badminton', activeInApp: true, sportProfile: { fields: { format: 'Doppel', playStyle: 'Offensiv' } } },
  { sportId: 'golf', activeInApp: true, sportProfile: { fields: { handicap: '22,4', preferredFormat: '18 Loch' } } }
]);
const F = id => sp.find(s => s.sportId === id).sportProfile.fields;
ok('4c.1d-1/2/3 Tennis (Format/Belag erhalten)', F('tennis').mode === 'beides' && F('tennis').surface === 'Sand');
ok('4c.1d-4/5 Padel (Seite erhalten)', F('padel').side === 'Links' && F('padel').context === 'Verein');
ok('4c.1d-6/7/8 Badminton (Format/Spielstil erhalten)', F('badminton').format === 'Doppel' && F('badminton').playStyle === 'Offensiv');
ok('4c.1d-9/10/11 Golf (Handicap/Format erhalten)', F('golf').handicap === '22,4' && F('golf').preferredFormat === '18 Loch');
// 20 Neustart
let round = M.normalizeSports(JSON.parse(JSON.stringify(sp)));
ok('4c.1d-20 Werte nach Neustart erhalten', round.find(s => s.sportId === 'golf').sportProfile.fields.handicap === '22,4');

// Demand-Baselines (12-15) + Stilmodifikator (16)
['tennis', 'padel', 'badminton', 'golf'].forEach(id => ok('4c.1d Demand vorhanden: ' + id, Object.keys(M.resolveDemandProfile({ sportId: id })).length > 0));
ok('4c.1d-16 Spielstil modifiziert Demand (Tennis offensiv → mehr power)', M.resolveDemandProfile({ sportId: 'tennis', style: 'Offensiv' }).power > (M.resolveDemandProfile({ sportId: 'tennis' }).power || 0));

// Aktivitätstypen (17/18) + deutsche Labels (21)
ok('4c.1d-17 Tennis-Matchtypen (Einzel-/Doppelmatch)', cfg.enumLabel('tennisType', 'single', 'tennis') === 'Einzelmatch' && cfg.enumLabel('tennisType', 'double', 'tennis') === 'Doppelmatch');
ok('4c.1d-17 Padel-Typen + Badminton-Typen deutsch', cfg.enumLabel('padelType', 'match', 'padel') === 'Match' && cfg.enumLabel('badmintonType', 'mixed', 'badminton') === 'Mixed');
ok('4c.1d-18 Golfaktivitäten (9/18-Loch, Schläge, handicaprelevant)', cfg.enumLabel('golfType', 'round18', 'golf') === '18-Loch-Runde' && cfg.formSchemaForSport('golf').fields.some(f => f.key === 'strokes') && cfg.formSchemaForSport('golf').fields.some(f => f.key === 'handicapRelevant'));
let tOpts = cfg.formSchemaForSport('tennis').fields.find(f => f.key === 'tennisType').options;
ok('4c.1d-21 alle Tennis-Typen deutsch übersetzt', tOpts.every(o => cfg.enumLabel('tennisType', o, 'tennis') !== o));

// 23 kein „Paddel"
let dump = JSON.stringify([SL.SPORT_CATALOG, M.SPORT_PROFILE_SCHEMAS.padel, cfg.formSchemaForSport('padel'), cfg.enumLabel('padelType', 'match', 'padel'), cfg.sportLabel('padel')]);
ok('4c.1d-23 kein „Paddel" im Katalog/Label', dump.indexOf('Paddel') < 0 && cfg.sportLabel('padel') === 'Padel');

// 24 Coverage vollständig
const hasAct = id => { try { return cfg.formSchemaForSport(id).sportId === id; } catch (e) { return false; } };
let catalog = SL.SPORT_CATALOG.map(s => ({ id: s.id, label: s.label, icon: s.icon }));
['tennis', 'padel', 'badminton', 'golf'].forEach(id => {
  let cov = M.validateSportCoverage(catalog.filter(s => s.id === id), { hasActivitySchema: hasAct });
  ok('4c.1d-24 Coverage vollständig: ' + id, cov.length === 0, cov[0] && cov[0].missing.join(','));
});

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
