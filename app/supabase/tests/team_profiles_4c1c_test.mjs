/* ORVIA · 4c.1c — vollständige Mannschaftssport-Profile (Basketball/Handball/Volleyball/Hockey/Rugby). */
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
const SPORTS = ['basketball', 'handball', 'volleyball', 'hockey', 'rugby'];

// 1/2/3 Positionen + positionsabhängige Rollen + Filterung
SPORTS.forEach(id => {
  let sc = M.sportProfileSchema(id);
  ok('4c.1c-1 ' + id + ' hat Positionen', sc.positions.length >= 4);
  let pos0 = sc.positions[0][0];
  ok('4c.1c-2 ' + id + ' Rollen je Position', M.rolesForPosition(id, pos0).length >= 1);
});
ok('4c.1c-3 Rollenfilter (Handball-Torwart ≠ Feldspielerrollen)', M.rolesForPosition('handball', 'goalkeeper').some(r => r[0] === 'classic_gk') && !M.rolesForPosition('handball', 'goalkeeper').some(r => r[0] === 'playmaker'));

// 4-8 Profile speicherbar; 9-14 Werte erhalten
let sp = M.normalizeSports(SPORTS.map(id => ({ sportId: id, activeInApp: true, sportProfile: { primaryPosition: M.sportProfileSchema(id).positions[1][0], playingRole: M.rolesForPosition(id, M.sportProfileSchema(id).positions[1][0])[0][0], teamSessionsPerWeek: 2, matchDay: 'saturday', typicalMatchMinutes: 40, seasonPhase: 'inseason' } })));
SPORTS.forEach(id => {
  let s = sp.find(x => x.sportId === id).sportProfile;
  ok('4c.1c ' + id + ' Profil speicherbar + Werte erhalten', !!s.primaryPosition && !!s.playingRole && s.teamSessionsPerWeek === 2 && s.matchDay === 'saturday' && s.typicalMatchMinutes === 40 && s.seasonPhase === 'inseason');
});
// 9/10 Neustart-Persistenz (Round-trip über JSON + erneutes normalize)
let round = M.normalizeSports(JSON.parse(JSON.stringify(sp)));
ok('4c.1c-9/10 Position+Rolle nach Neustart erhalten', round.find(s => s.sportId === 'rugby').sportProfile.primaryPosition === sp.find(s => s.sportId === 'rugby').sportProfile.primaryPosition);

// 15/16/17 Demand je Position + Nutzerprioritäten + Beschwerden
let dPG = M.resolveDemandProfile({ sportId: 'basketball', position: 'point_guard' });
let dC = M.resolveDemandProfile({ sportId: 'basketball', position: 'center' });
ok('4c.1c-15 Demand je Position (PG Richtungswechsel > Center; Center Kraft > PG)', dPG.changeOfDirection > dC.changeOfDirection && dC.maxStrength > dPG.maxStrength);
ok('4c.1c-16 Nutzerprioritäten modifizieren Demand', M.resolveDemandProfile({ sportId: 'rugby', position: 'back_three', userPriorities: [{ key: 'maxSpeed', priority: 3 }] }).maxSpeed > M.resolveDemandProfile({ sportId: 'rugby', position: 'back_three' }).maxSpeed);
ok('4c.1c-17 Beschwerden reduzieren Dimensionen', M.resolveDemandProfile({ sportId: 'handball', position: 'left_wing', constraints: ['shoulder'] }).acceleration < M.resolveDemandProfile({ sportId: 'handball', position: 'left_wing' }).acceleration);

// 20/21 Aktivitätstypen vollständig + deutsche Labels; 18 Position im Formular
SPORTS.forEach(id => {
  let fields = cfg.formSchemaForSport(id).fields;
  let tk = fields.find(f => f.key === id + 'Type');
  ok('4c.1c-20 ' + id + ' Aktivitätstypen + Position(onlyWhen match)', tk && tk.options.indexOf('match') >= 0 && tk.options.indexOf('team_training') >= 0 && fields.some(f => f.key === 'position' && f.onlyWhen && f.onlyWhen[id + 'Type'] === 'match'));
  ok('4c.1c-21 ' + id + ' Typ-Labels deutsch', cfg.enumLabel(id + 'Type', 'team_training', id) === 'Mannschaftstraining' && cfg.enumLabel(id + 'Type', 'match', id) === 'Spiel');
});
ok('4c.1c-18 Positionslabel deutsch (Außenangriff/Front Row)', cfg.enumLabel('position', 'outside_hitter', 'volleyball') === 'Außenangriff' && cfg.enumLabel('position', 'front_row', 'rugby') === 'Front Row');

// 23 Coverage vollständig; 24 Fußball unverändert
const hasAct = id => { try { return cfg.formSchemaForSport(id).sportId === id; } catch (e) { return false; } };
let catalog = SL.SPORT_CATALOG.map(s => ({ id: s.id, label: s.label, icon: s.icon }));
SPORTS.forEach(id => {
  let cov = M.validateSportCoverage(catalog.filter(s => s.id === id), { hasActivitySchema: hasAct });
  ok('4c.1c-23 Coverage vollständig: ' + id, cov.length === 0, cov[0] && cov[0].missing.join(','));
});
ok('4c.1c-24 Fußball unverändert (footballType + ballspielender IV)', cfg.formSchemaForSport('football').fields.some(f => f.key === 'footballType') && M.rolesForPosition('football', 'centre_back').some(r => r[0] === 'ball_playing_cb'));
ok('4c.1c Volleyball/Hockey-Varianten vorhanden', M.sportProfileSchema('volleyball').variants.indexOf('Beachvolleyball') >= 0 && M.sportProfileSchema('hockey').variants.indexOf('Hallenhockey') >= 0);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
