/* ORVIA · activity-config — zentrale Aktivitäts-UI-Konfiguration (Inkrement 2A-UI). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.ORVIA = { user: { id: 'u1' } };
globalThis.ORVIA.activityNormalize = (await import(new URL('../../js/activity-normalize.js', import.meta.url))).default;
globalThis.ORVIA.onboardingSportsLogic = (await import(new URL('../../js/onboarding/onboarding-sports-logic.js', import.meta.url))).default;
globalThis.ORVIA.trainingDomain = { normSport: v => { const s = String(v || '').toLowerCase(); const m = { laufen: 'running', rad: 'cycling', schwimmen: 'swimming', krafttraining: 'gym', 'mobilität': 'gym', fußball: 'football' }; return m[s] || s; } };
const C = (await import(new URL('../../js/activity-config.js', import.meta.url))).default;
const SL = globalThis.ORVIA.onboardingSportsLogic;
const sel = arr => SL.normalizeSportsSelection({ sports: arr });

// --- Form-Schemas ---
ok('Schwimmen hat keine Höhenmeter', C.allowedFieldKeys('swimming').indexOf('elevationM') < 0);
ok('Schwimmen nutzt Meter (distanceM)', C.allowedFieldKeys('swimming').indexOf('distanceM') >= 0);
ok('Gym hat keine Distanz', C.allowedFieldKeys('gym').indexOf('distanceKm') < 0 && C.allowedFieldKeys('gym').indexOf('distanceM') < 0);
ok('Gym hat keine Höhenmeter', C.allowedFieldKeys('gym').indexOf('elevationM') < 0);
ok('Padel: Match/Training + Einzel/Doppel', C.allowedFieldKeys('padel').indexOf('sessionKind') >= 0 && C.allowedFieldKeys('padel').indexOf('format') >= 0);
ok('Fußball: Training/Spiel + Position', C.allowedFieldKeys('football').indexOf('sessionKind') >= 0 && C.allowedFieldKeys('football').indexOf('role') >= 0);
ok('Rad: Höhenmeter onlyWhen outdoor', (function () { var fld = C.formSchemaForSport('cycling').fields.find(x => x.key === 'elevationM'); return fld && fld.onlyWhen && fld.onlyWhen.environment === 'outdoor'; })());
ok('Triathlon: eigenes triType (keine Lauf-/Distanzmaske)', C.allowedFieldKeys('triathlon').indexOf('triType') >= 0 && C.allowedFieldKeys('triathlon').indexOf('distanceKm') < 0);
ok('Leichtathletik: Disziplin statt pauschalem Lauf', C.allowedFieldKeys('athletics').indexOf('discipline') >= 0 && C.allowedFieldKeys('athletics').indexOf('distanceKm') < 0);
ok('unbekannte Sportart → Freiformular (other)', C.formSchemaForSport('quidditch').sportId === 'other' && C.allowedFieldKeys('quidditch').indexOf('name') >= 0);
ok('Laufen: km + RPE + Notiz', ['distanceKm', 'rpe', 'note', 'date', 'durationMin'].every(k => C.allowedFieldKeys('running').indexOf(k) >= 0));

// --- Feld-Strip beim Sportwechsel ---
let runVals = { date: '2026-06-27', durationMin: 43, distanceKm: 7.2, elevationM: 54, rpe: 5, note: 'x' };
let toSwim = C.stripForeignFields(runVals, 'swimming');
ok('Sportwechsel Lauf→Schwimmen entfernt Höhenmeter', toSwim.elevationM === undefined);
ok('Sportwechsel entfernt sportfremde Distanz (km)', toSwim.distanceKm === undefined);
ok('Sportwechsel behält gemeinsame Felder', toSwim.date === '2026-06-27' && toSwim.durationMin === 43 && toSwim.rpe === 5 && toSwim.note === 'x');
ok('Lauf→Gym entfernt Distanz + Höhenmeter', (function () { var g = C.stripForeignFields(runVals, 'gym'); return g.distanceKm === undefined && g.elevationM === undefined && g.durationMin === 43; })());

// --- Dynamische Sport-Kacheln ---
let tiles = C.userSportTiles(sel([{ sportId: 'running', role: 'primary' }, { sportId: 'gym', role: 'secondary', planningEnabled: true }, { sportId: 'cycling', role: 'secondary', planningEnabled: true }, { sportId: 'swimming', role: 'secondary', planningEnabled: true }, { sportId: 'padel', role: 'occasional' }]));
let ids = tiles.map(t => t.sportId);
ok('Padel erscheint (gewählt+sichtbar)', ids.indexOf('padel') >= 0);
ok('Hauptsportart zuerst (running)', ids[0] === 'running');
ok('„Weitere Aktivität" als letzte Kachel', tiles[tiles.length - 1].isMore === true && tiles[tiles.length - 1].sportId === 'other');
ok('keine doppelte primary in Liste', ids.filter(x => x === 'running').length === 1);
let teamTiles = C.userSportTiles(sel([{ sportId: 'football', role: 'primary' }, { sportId: 'gym', role: 'secondary', planningEnabled: true }, { sportId: 'basketball', role: 'secondary', planningEnabled: true }])).map(t => t.sportId);
ok('Fußball + Basketball erscheinen', teamTiles.indexOf('football') >= 0 && teamTiles.indexOf('basketball') >= 0);
ok('Fußball zuerst (primary)', teamTiles[0] === 'football');
ok('nicht gewähltes tennis NICHT als Kachel (nur „Weitere")', teamTiles.indexOf('tennis') < 0);
ok('ausgeblendete gelegentliche erscheint nicht', (function () { var s = sel([{ sportId: 'running', role: 'primary' }, { sportId: 'padel', role: 'occasional' }]); s = SL.setVisible(s, 'padel', false); return C.userSportTiles(s).map(t => t.sportId).indexOf('padel') < 0; })());
ok('Labels aus Katalog (running → Laufen)', tiles[0].label === 'Laufen');

// --- Legacy-Adapter ---
let leg = C.legacySessionToActivity('2026-06-20', 'Laufen', { dur: 43, dist: 7.2, hr: 149, elev: 54, rpe: 5 });
ok('Legacy: deterministische ID', leg.clientRecordId === 'legacy:2026-06-20:running');
ok('Legacy: source legacy_local', leg.source === 'legacy_local');
ok('Legacy: sportId kanonisch', leg.sportId === 'running');
ok('Legacy: durationSeconds aus min', leg.durationSeconds === 2580);
ok('Legacy: distanceKm in summary', leg.summary.distanceKm === 7.2);
let legSwim = C.legacySessionToActivity('2026-06-21', 'Schwimmen', { dur: 30, dist: 1500, elev: 99 });
ok('Legacy Schwimmen: distanceM, keine Höhenmeter', legSwim.summary.distanceM === 1500 && legSwim.summary.elevationM === undefined);
ok('Legacy: nicht mutierend', (function () { var src = { dur: 43, dist: 7.2 }; var cp = JSON.stringify(src); C.legacySessionToActivity('2026-06-20', 'Laufen', src); return JSON.stringify(src) === cp; })());

// --- Merge/Dedup ---
let canon = [{ source: 'orvia_workout', sourceRecordId: 'w1', sportId: 'gym', startedAt: '2026-06-27T10:00:00Z' }];
let legacyArr = [C.legacySessionToActivity('2026-06-20', 'Laufen', { dur: 43, dist: 7 }), { source: 'orvia_workout', sourceRecordId: 'w1', sportId: 'gym', startedAt: '2026-06-27T10:00:00Z', _dupe: true }];
let merged = C.mergeActivities(canon, legacyArr);
ok('Merge: Dublette (gleicher source+sourceRecordId) entfernt', merged.filter(a => a.source === 'orvia_workout' && a.sourceRecordId === 'w1').length === 1);
ok('Merge: kanonisch gewinnt (kein _dupe)', !merged.find(a => a._dupe));
ok('Merge: Legacy-Lauf erhalten', merged.find(a => a.source === 'legacy_local'));
ok('Merge: nach Datum sortiert (w1 vor Legacy 06-20)', merged[0].sourceRecordId === 'w1');

// --- Summary-Zeilen sportartspezifisch ---
ok('Gym-Summary: Dauer · Übungen · Sätze', C.summaryLine({ sportId: 'gym', durationSeconds: 6060, summary: { exerciseCount: 7, workingSetCount: 18 } }) === '1 h 41 min · 7 Übungen · 18 Sätze');
ok('Lauf-Summary: km · Dauer · Pace', C.summaryLine({ sportId: 'running', durationSeconds: 2580, summary: { distanceKm: 7.2 } }).indexOf('/km') >= 0);
ok('Schwimm-Summary: m · /100 m (keine km)', (function () { var l = C.summaryLine({ sportId: 'swimming', durationSeconds: 2580, summary: { distanceM: 1500 } }); return l.indexOf('1500 m') >= 0 && l.indexOf('/100 m') >= 0; })());
ok('Padel-Summary: Dauer · Match · RPE', (function () { var l = C.summaryLine({ sportId: 'padel', durationSeconds: 4800, summary: { sessionKind: 'match', rpe: 7 } }); return l.indexOf('Match') >= 0 && l.indexOf('RPE 7') >= 0; })());
ok('unbekannte Dauer → „Dauer nicht erfasst" (kein 0 min)', C.summaryLine({ sportId: 'gym', durationSeconds: null, summary: {} }).indexOf('Dauer nicht erfasst') >= 0);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
