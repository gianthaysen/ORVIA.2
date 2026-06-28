/* ORVIA · activity-config — zentrale Aktivitäts-UI-Konfiguration (Inkrement 2A-UI). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.ORVIA = { user: { id: 'u1' } };
globalThis.ORVIA.activityNormalize = (await import(new URL('../../js/activity-normalize.js', import.meta.url))).default;
globalThis.ORVIA.onboardingSportsLogic = (await import(new URL('../../js/onboarding/onboarding-sports-logic.js', import.meta.url))).default;
// Stub spiegelt das REALE Verhalten (Teil A): normSportStrict → bekannt|null; normSport → strict||'other'.
const _ALIAS = { laufen: 'running', rad: 'cycling', radfahren: 'cycling', schwimmen: 'swimming', krafttraining: 'gym', kraft: 'gym', strength: 'gym', 'mobilität': 'mobility', mobility: 'mobility', fußball: 'football', paddel: 'padel', rudern: 'rowing', wandern: 'hiking', gehen: 'walking', leichtathletik: 'athletics', basketball: 'basketball', andere: 'other' };
const _ASPORTS = ['gym', 'running', 'cycling', 'swimming', 'triathlon', 'football', 'handball', 'padel', 'tennis', 'athletics', 'basketball', 'rowing', 'hiking', 'walking', 'mobility', 'other'];
const _strict = v => { if (v == null) return null; const s = String(v).trim().toLowerCase(); return _ALIAS[s] || (_ASPORTS.indexOf(s) >= 0 ? s : null); };
globalThis.ORVIA.trainingDomain = { normSportStrict: _strict, normSport: v => _strict(v) || 'other' };
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

/* ===== Korrektur: semantische Dedup Legacy↔Canonical ===== */
const canonGym = { source: 'orvia_workout', sourceRecordId: 'w1', workoutSessionId: 'w1', sportId: 'gym', startedAt: '2026-06-27T10:00:00Z', workoutSnapshot: [{ sets: [{}] }] };
// 1) Canonical gym + Legacy 'Gym' derselben Session (Spiegel mit workoutSessionId) → eine Activity
let legGym = C.legacySessionToActivity('2026-06-27', 'Gym', { dur: 101, rpe: 7, source: 'live', workoutSessionId: 'w1' });
ok('Dedup: gym + Legacy „Gym" gleiche Session → 1', C.mergeActivities([canonGym], [legGym]).length === 1);
// 2) Canonical gym + Legacy 'Krafttraining' derselben Session → eine Activity
let legKraft = C.legacySessionToActivity('2026-06-27', 'Krafttraining', { dur: 101, rpe: 7, source: 'live', workoutSessionId: 'w1' });
ok('Dedup: gym + Legacy „Krafttraining" gleiche Session → 1', C.mergeActivities([canonGym], [legKraft]).length === 1);
ok('Dedup: behaltener Datensatz ist kanonisch (Snapshot)', C.mergeActivities([canonGym], [legKraft])[0].source === 'orvia_workout');
// 3) Zwei getrennte echte Gym-Einheiten am selben Tag → zwei (kein fälschliches Mergen)
let legGymManual = C.legacySessionToActivity('2026-06-27', 'Krafttraining', { dur: 60, rpe: 6 });   // kein workoutSessionId, nicht leer
ok('Dedup: getrennte Gym-Einheiten gleicher Tag → 2', C.mergeActivities([canonGym], [legGymManual]).length === 2);
// 4) Leerer Legacy-Null-Datensatz + kanonischer Snapshot am selben Tag → nur kanonisch
let legEmpty = C.legacySessionToActivity('2026-06-27', 'Gym', {});
ok('leerer Legacy-Eintrag ist isEmpty', legEmpty.isEmpty === true);
ok('Dedup: leerer Legacy + kanonisch gleicher Tag → nur kanonisch', C.mergeActivities([canonGym], [legEmpty]).length === 1);
// 5) Legacy ohne Gegenstück bleibt sichtbar
ok('Legacy ohne Gegenstück bleibt', C.mergeActivities([], [C.legacySessionToActivity('2026-06-10', 'Laufen', { dur: 30, dist: 5 })]).length === 1);
ok('leerer Legacy ohne Gegenstück bleibt (nicht gelöscht)', C.mergeActivities([], [legEmpty]).length === 1);
// 6) Padel/Paddel normalisieren zu derselben ID
ok('Paddel → padel (eine Identität)', C.legacySessionToActivity('2026-06-09', 'Paddel', { dur: 60 }).sportId === 'padel');
ok('Padel → padel', C.legacySessionToActivity('2026-06-09', 'Padel', { dur: 60 }).sportId === 'padel');
// 7) idempotent
let m1 = C.mergeActivities([canonGym], [legKraft]);
ok('Dedup idempotent', JSON.stringify(C.mergeActivities(m1, [])) === JSON.stringify(m1) || C.mergeActivities(m1, []).length === m1.length);
// 8) Eingabe nicht mutiert
ok('mergeActivities mutiert Eingaben nicht', (function () { var c = [Object.assign({}, canonGym)]; var l = [Object.assign({}, legKraft)]; var cc = JSON.stringify(c), lc = JSON.stringify(l); C.mergeActivities(c, l); return JSON.stringify(c) === cc && JSON.stringify(l) === lc; })());

/* ===== Korrektur: Enum-Labels (keine technischen Rohwerte) + „Weitere"-Gruppen ===== */
ok('enumLabel pool → Pool', C.enumLabel('environment', 'pool') === 'Pool');
ok('enumLabel open_water → Freiwasser', C.enumLabel('environment', 'open_water') === 'Freiwasser');
ok('enumLabel discipline run → Lauf', C.enumLabel('discipline', 'run') === 'Lauf');
ok('enumLabel match (Racket) → Match', C.enumLabel('sessionKind', 'match', 'padel') === 'Match');
ok('enumLabel match (Team) → Spiel', C.enumLabel('sessionKind', 'match', 'football') === 'Spiel');
ok('activityTitle sportabhängig', C.activityTitle('swimming') === 'Schwimmen erfassen');
let groups = C.moreActivityGroups(['running', 'gym']);
let allMoreIds = groups.reduce((a, g) => a.concat(g.items.map(i => i.sportId)), []);
ok('„Weitere" schließt bereits sichtbare aus (kein running/gym)', allMoreIds.indexOf('running') < 0 && allMoreIds.indexOf('gym') < 0);
ok('„Weitere" enthält padel/tennis/football', allMoreIds.indexOf('padel') >= 0 && allMoreIds.indexOf('tennis') >= 0 && allMoreIds.indexOf('football') >= 0);
ok('„Weitere" enthält „Andere Aktivität" (other)', allMoreIds.indexOf('other') >= 0);
ok('„Weitere" gruppiert (Ausdauer/Racket/...)', groups.length >= 3 && groups.every(g => g.label && g.items.length));

/* ===== Korrektur: „Weitere Aktivität"-Dialog — kein Leichtathletik-Mehrfach/Mislabel ===== */
// Labels katalog-first (nicht über normSport-Rate-Fallback 'athletics')
ok('sportLabel rowing → Rudern', C.sportLabel('rowing') === 'Rudern');
ok('sportLabel hiking → Wandern', C.sportLabel('hiking') === 'Wandern');
ok('sportLabel walking → Gehen', C.sportLabel('walking') === 'Gehen');
ok('sportLabel athletics → Leichtathletik', C.sportLabel('athletics') === 'Leichtathletik');
ok('sportLabel basketball → Basketball (NICHT Leichtathletik)', C.sportLabel('basketball') === 'Basketball');
ok('fehlende Metadaten → „Aktivität" (kein stilles Leichtathletik)', C.sportLabel('quidditch') === 'Aktivität');
ok('Mobility eigene Aktivität: Label „Mobility", nicht gym/Krafttraining', C.sportLabel('mobility') === 'Mobility' && C.sportLabel('Mobilität') === 'Mobility');
// Dialog-Gruppen
let g0 = C.moreActivityGroups([]);
let items0 = g0.reduce((a, g) => a.concat(g.items), []);
let labels0 = items0.map(i => i.label);
let ids0 = items0.map(i => i.sportId);
ok('jede Sport-ID max. einmal im Dialog', ids0.length === new Set(ids0).size);
ok('Leichtathletik genau einmal', labels0.filter(l => l === 'Leichtathletik').length === 1);
ok('Basketball vorhanden + korrekt', labels0.filter(l => l === 'Basketball').length === 1);
ok('Rudern/Wandern/Gehen je einmal', labels0.filter(l => l === 'Rudern').length === 1 && labels0.filter(l => l === 'Wandern').length === 1 && labels0.filter(l => l === 'Gehen').length === 1);
ok('jede ID erhält korrektes Label (kein „Aktivität"-Fallback im Standardkatalog)', items0.every(i => i.label && i.label !== 'Aktivität'));
// Jede Gruppe nur ihre vorgesehenen Sportarten
let ausdauer = g0.find(g => g.label === 'Ausdauer');
let team = g0.find(g => g.label === 'Mannschaftssport');
ok('Ausdauer enthält athletics, NICHT basketball', ausdauer.items.some(i => i.sportId === 'athletics') && !ausdauer.items.some(i => i.sportId === 'basketball'));
ok('Mannschaft enthält basketball mit Label Basketball', team.items.some(i => i.sportId === 'basketball' && i.label === 'Basketball'));
ok('Mannschaft enthält KEIN Leichtathletik', !team.items.some(i => i.label === 'Leichtathletik'));
// Bereits sichtbare ausschließen
let gEx = C.moreActivityGroups(['athletics', 'basketball']);
let idsEx = gEx.reduce((a, g) => a.concat(g.items.map(i => i.sportId)), []);
ok('ausgeschlossene IDs erscheinen nicht (athletics/basketball)', idsEx.indexOf('athletics') < 0 && idsEx.indexOf('basketball') < 0);
ok('keine doppelte ID über Gruppen (mit Ausschluss)', idsEx.length === new Set(idsEx).size);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
