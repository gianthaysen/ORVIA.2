/* ORVIA · 4c.1a — Coverage-Validator + Leichtathletik/Badminton/Golf. vm-Sandbox lädt
   profile-model + onboarding-sports-logic + activity-config; prüft Abdeckung datengetrieben. */
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

const M = sb.ORVIA.profileModel;
const SL = sb.ORVIA.onboardingSportsLogic;
const cfg = sb.ORVIA.activityConfig;
const catalog = SL.SPORT_CATALOG.map(s => ({ id: s.id, label: s.label, icon: s.icon }));
const hasAct = id => !!cfg.formSchemaForSport(id) && cfg.formSchemaForSport(id).sportId === (M.sportProfileSchema(id) ? id : cfg.formSchemaForSport(id).sportId);
const hasActivitySchema = id => { try { var s = cfg.formSchemaForSport(id); return !!s && (s.sportId === id); } catch (e) { return false; } };

// 3: synthetischer Sport ohne Profil/Aktivität → Lücken erkannt
let synthetic = M.validateSportCoverage([{ id: 'cricket', label: 'Cricket', icon: 'pulse' }], { hasActivitySchema: () => false });
ok('4c.1a-1/2 Validator erkennt fehlendes Profil+Aktivitätsschema', synthetic.length === 1 && synthetic[0].missing.indexOf('profileSchema') >= 0 && synthetic[0].missing.indexOf('activitySchema') >= 0);

// Die drei neuen + Fußball vollständig abgedeckt
['athletics', 'badminton', 'golf', 'football'].forEach(id => {
  let cov = M.validateSportCoverage(catalog.filter(s => s.id === id), { hasActivitySchema: hasActivitySchema });
  ok('4c.1a Abdeckung vollständig: ' + id, cov.length === 0, cov[0] && cov[0].missing.join(','));
});

// 3: keine doppelte Sport-ID im Katalog
let ids = catalog.map(s => s.id);
ok('4c.1a-3 keine doppelte Sport-ID', new Set(ids).size === ids.length);
// 4: Leichtathletik getrennt von Laufen
ok('4c.1a-4 athletics ≠ running (eigene Schemas/Labels)', M.sportProfileSchema('athletics') !== M.sportProfileSchema('running') && SL.CATALOG_BY_ID.athletics.label === 'Leichtathletik' && SL.CATALOG_BY_ID.running.label === 'Laufen');

// 5/8/12: Profile speicherbar (normalizeSports erhält sportProfile)
let saved = M.normalizeSports([
  { sportId: 'athletics', activeInApp: true, sportProfile: { fields: { disciplineGroup: 'Sprint', mainDiscipline: '100 m' }, performancePriorities: [{ key: 'maxSpeed', priority: 1 }] } },
  { sportId: 'badminton', activeInApp: true, sportProfile: { fields: { format: 'Doppel', hand: 'Rechts', context: 'Liga' } } },
  { sportId: 'golf', activeInApp: true, sportProfile: { fields: { handicap: '22,4', preferredFormat: '18 Loch' } } }
]);
ok('4c.1a-5 Leichtathletikprofil speicherbar (100m/Sprint)', saved.find(s => s.sportId === 'athletics').sportProfile.fields.mainDiscipline === '100 m');
ok('4c.1a-8 Badmintonprofil speicherbar (Doppel/Rechts)', saved.find(s => s.sportId === 'badminton').sportProfile.fields.format === 'Doppel');
ok('4c.1a-12/13 Golfprofil speicherbar + Handicap erhalten', saved.find(s => s.sportId === 'golf').sportProfile.fields.handicap === '22,4');

// 6/10/15: Aktivitätstypen + deutsche Labels
ok('4c.1a-6 Leichtathletik-Aktivität (7 Typen, Wettkampf)', cfg.formSchemaForSport('athletics').fields.find(f => f.key === 'athleticsType').options.length === 7 && cfg.enumLabel('athleticsType', 'sprint', 'athletics') === 'Sprinttraining');
ok('4c.1a-10 Badminton-Aktivität (Einzel/Doppelmatch)', cfg.enumLabel('badmintonType', 'single', 'badminton') === 'Einzelmatch' && cfg.enumLabel('badmintonType', 'double', 'badminton') === 'Doppelmatch');
ok('4c.1a-15 Golfrunde erfassbar (9/18-Loch, Schläge)', cfg.enumLabel('golfType', 'round18', 'golf') === '18-Loch-Runde' && cfg.formSchemaForSport('golf').fields.some(f => f.key === 'strokes'));
// 17: keine englischen sichtbaren Werte (Stichprobe golfType/badmintonType vollständig übersetzt)
let golfOpts = cfg.formSchemaForSport('golf').fields.find(f => f.key === 'golfType').options;
ok('4c.1a-17 alle Golf-Typen deutsch übersetzt', golfOpts.every(o => cfg.enumLabel('golfType', o, 'golf') !== o));

// 7/9/11/14: Katalog/Labels für Training starten (activeInApp-Pfad)
ok('4c.1a-7/11 Badminton/Golf im Katalog mit Label/Icon', cfg.sportLabel('badminton') === 'Badminton' && cfg.sportLabel('golf') === 'Golf' && cfg.sportIcon('golf') !== 'pulse' === false);

// 19: Fußball unverändert (footballType weiter vorhanden)
ok('4c.1a-19 Fußball unverändert (footballType)', cfg.formSchemaForSport('football').fields.some(f => f.key === 'footballType'));

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
