/* ORVIA · 4d — Profilsportarten steuern Trainingsoptionen. Lädt profile-model.js + activity-config.js
   in eine vm-Sandbox mit gestubbtem ORVIA.profile und prüft die dynamische Kachelquelle. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const sb = {}; sb.window = sb; sb.self = sb; sb.console = console;
sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.Array = Array; sb.Object = Object; sb.String = String;
vm.createContext(sb);
const base = new URL('../../js/', import.meta.url);
vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb, { filename: 'profile-model.js' });
// Stubs, die activity-config erwartet (Katalog-Labels/Icons + strict-Normalisierung)
sb.ORVIA.onboardingSportsLogic = { CATALOG_BY_ID: { running: { label: 'Laufen', icon: 'run' }, padel: { label: 'Padel', icon: 'ball' }, football: { label: 'Fußball', icon: 'ball' }, basketball: { label: 'Basketball', icon: 'ball' }, gym: { label: 'Krafttraining', icon: 'dumbbell' } } };
sb.ORVIA.trainingDomain = { normSport: v => String(v || '').toLowerCase(), normSportStrict: () => null };
sb.ORVIA.activityNormalize = {};
vm.runInContext(readFileSync(new URL('activity-config.js', base), 'utf8'), sb, { filename: 'activity-config.js' });

const cfg = sb.ORVIA.activityConfig;
const M = sb.ORVIA.profileModel;

// Stub-Adapter ORVIA.profile.activeSports
function setActive(sports) { sb.ORVIA.profile = { activeSports: () => M.normalizeSports(sports).filter(s => s.activeInApp) }; }

// 4: Padel aktiv → erscheint; 3/5: deaktivierte fehlt
setActive([{ sportId: 'running', activeInApp: true, role: 'primary' }, { sportId: 'padel', activeInApp: true }, { sportId: 'basketball', activeInApp: false }]);
let tiles = cfg.activeSportTilesFromProfile();
ok('4d-4 Padel aktiv → Kachel vorhanden', tiles.some(t => t.sportId === 'padel'));
ok('4d-3/7 deaktiviertes Basketball fehlt', !tiles.some(t => t.sportId === 'basketball'));
ok('4d-9 Hauptsportart zuerst (running primary)', tiles[0].sportId === 'running');
ok('4d „Weitere Aktivität" angehängt', tiles[tiles.length - 1].isMore === true && tiles[tiles.length - 1].sportId === 'other');
ok('4d deutsche Labels aus Katalog', tiles.find(t => t.sportId === 'padel').label === 'Padel');

// 6: Basketball aktiviert → erscheint
setActive([{ sportId: 'running', activeInApp: true, role: 'primary' }, { sportId: 'basketball', activeInApp: true }]);
ok('4d-6 Basketball aktiviert → erscheint', cfg.activeSportTilesFromProfile().some(t => t.sportId === 'basketball'));

// 27/29: eigene Sportart erscheint + nicht falsch normalisiert
setActive([{ customName: 'Beachvolleyball', activeInApp: true, role: 'primary' }]);
let ct = cfg.activeSportTilesFromProfile();
ok('4d-27 eigene Sportart erscheint (custom, Name erhalten)', ct.some(t => t.custom && t.sportId === 'custom' && t.label === 'Beachvolleyball' && t.customSportName === 'Beachvolleyball'));
ok('4d-29 eigene Sportart NICHT auf athletics/gym/other gemappt', !ct.some(t => ['athletics', 'gym'].indexOf(t.sportId) >= 0));

// userSportTiles bevorzugt Profil vor Onboarding-Auswahl (32: kein Bruch der Quelle)
setActive([{ sportId: 'gym', activeInApp: true, role: 'primary' }, { sportId: 'running', activeInApp: true }]);
let ut = cfg.userSportTiles(null);
ok('4d userSportTiles nutzt Profilquelle (gym+running)', ut.some(t => t.sportId === 'gym') && ut.some(t => t.sportId === 'running'));

// Kein modernes Profil → Fallback (null aus activeSportTilesFromProfile, userSportTiles nutzt Selection/other)
sb.ORVIA.profile = { activeSports: () => [] };
ok('4d-10b kein aktives Profil → activeSportTilesFromProfile null', cfg.activeSportTilesFromProfile() === null);
ok('4d Fallback userSportTiles liefert mindestens „Weitere Aktivität"', cfg.userSportTiles(null).some(t => t.isMore));

// Formschemata bleiben katalogbasiert (8/9/10): Padel/Basketball/Fußball
ok('4d-8 Padel-Formschema (Aktivitätstyp + Seite)', cfg.formSchemaForSport('padel').fields.some(f => f.key === 'padelType') && cfg.formSchemaForSport('padel').fields.some(f => f.key === 'side'));
ok('4d-9 Basketball-Formschema (Aktivitätstyp)', cfg.formSchemaForSport('basketball').fields.some(f => f.key === 'basketballType'));
// 4d.1: Fußball 4 Aktivitätstypen + Position (onlyWhen match) + deutsche Labels
let fbf = cfg.formSchemaForSport('football').fields;
let ftype = fbf.find(f => f.key === 'footballType');
ok('4d.1 Fußball 4 Typen (Mannschaftstraining/Spiel/Individuell/Athletik)', ftype && ftype.options.join(',') === 'team_training,match,individual,athletics');
ok('4d.1 footballType Labels deutsch', cfg.enumLabel('footballType', 'team_training', 'football') === 'Mannschaftstraining' && cfg.enumLabel('footballType', 'individual', 'football') === 'Individuelles Fußballtraining');
let fpos = fbf.find(f => f.key === 'position');
ok('4d.1 Position-Feld nur bei Spiel (onlyWhen match) + deutsche Labels', fpos && fpos.onlyWhen && fpos.onlyWhen.footballType === 'match' && cfg.enumLabel('position', 'centre_back', 'football') === 'Innenverteidiger');

// 38/39: Usage-Status
ok('4d-38 activeInApp Usage = active', M.getFieldUsage('sports[].activeInApp').status === 'active' && M.getFieldUsage('sports[].activeInApp').consumers.indexOf('trainingStartOptions') >= 0);
ok('4d-39 includeInPlan bleibt prepared', M.getFieldUsage('sports[].includeInPlan').status === 'prepared');

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
