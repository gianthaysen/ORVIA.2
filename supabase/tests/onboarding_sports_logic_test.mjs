/* ORVIA · Sportarten — reine Sport-Logik. */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const S = (await import(new URL('../../js/onboarding/onboarding-sports-logic.js', import.meta.url))).default;

const sel = (arr) => ({ sports: arr });
const run = { sportId: 'running', role: 'primary', enabled: true, visible: true, planningEnabled: true, priority: 1 };

// 1 leere Auswahl ungültig
ok('leere Auswahl ungültig', S.validateSportsSelection(S.emptySportsSelection()).valid === false);
ok('leere Auswahl: _selection-Fehler', !!S.validateSportsSelection(S.emptySportsSelection()).errors._selection);
// 2 eine valide Hauptsportart gültig
ok('eine Hauptsportart gültig', S.validateSportsSelection(sel([run])).valid === true);
ok('sportsComplete true', S.sportsComplete(sel([run])) === true);
// 3 keine Hauptsportart ungültig
ok('keine Hauptsportart → _primary', !!S.validateSportsSelection(sel([{ sportId: 'running', role: 'secondary' }])).errors._primary);
// 4 zwei Hauptsportarten deterministisch normalisiert (zweite → secondary)
let two = S.normalizeSportsSelection(sel([{ sportId: 'running', role: 'primary' }, { sportId: 'gym', role: 'primary' }]));
ok('zwei primary → genau eine bleibt', two.sports.filter(e => e.role === 'primary').length === 1);
ok('zweite wird secondary', two.sports[1].role === 'secondary');
// 5 Duplikate entfernt
ok('Duplikate entfernt', S.normalizeSportsSelection(sel([run, { sportId: 'running', role: 'secondary' }])).sports.length === 1);
// 6 unbekannte IDs entfernt
ok('unbekannte ID entfernt', S.normalizeSportsSelection(sel([{ sportId: 'quidditch', role: 'primary' }, run])).sports.every(e => e.sportId !== 'quidditch'));
// 7 ungültige Rolle → secondary
ok('ungültige Rolle → secondary', S.normalizeSportEntry({ sportId: 'gym', role: 'boss' }).role === 'secondary');
// 8 primary erzwingt enabled/visible/planning
let p = S.normalizeSportEntry({ sportId: 'running', role: 'primary', enabled: false, visible: false, planningEnabled: false });
ok('primary erzwingt enabled/visible/planning', p.enabled === true && p.visible === true && p.planningEnabled === true);
// 9 occasional erzwingt kein Planning
let occ = S.normalizeSportEntry({ sportId: 'cycling', role: 'occasional', planningEnabled: true });
ok('occasional → planningEnabled false', occ.planningEnabled === false);
// 10/11 Prioritäten eindeutig + lückenlos
let pr = S.normalizeSportsSelection(sel([{ sportId: 'running', role: 'primary' }, { sportId: 'gym', role: 'secondary', planningEnabled: true }, { sportId: 'cycling', role: 'secondary', planningEnabled: true }]));
let prios = pr.sports.filter(e => e.planningEnabled).map(e => e.priority).sort();
ok('Prioritäten lückenlos 1..n', JSON.stringify(prios) === JSON.stringify([1, 2, 3]));
ok('Prioritäten eindeutig', new Set(prios).size === prios.length);
ok('primary hat Priorität 1', S.normalizeSportsSelection(pr).sports.find(e => e.role === 'primary').priority === 1);
// 12 Reihenfolge änderbar
let re = S.reorderPlannedSports(pr, ['running', 'cycling', 'gym']);
ok('reorder: cycling vor gym (primary bleibt 1)', re.sports.find(e => e.sportId === 'cycling').priority < re.sports.find(e => e.sportId === 'gym').priority && re.sports.find(e => e.role === 'primary').priority === 1);
// 13 null/falsche Typen werfen nicht
ok('null/falsche Typen werfen nicht', (function () { try { S.normalizeSportsSelection(null); S.validateSportsSelection(undefined); S.toggleSport(null, 'x'); S.setPrimarySport({}, 'running'); S.normalizeSportEntry('kaputt'); return true; } catch (e) { return false; } })());
// 14 Seed mutiert Quelle nicht
let srcProfile = { sports: ['Laufen', 'Gym', 'Schwimmen'] };
let srcCopy = JSON.parse(JSON.stringify(srcProfile));
let seeded = S.seedFromExistingProfile(srcProfile);
ok('Seed mutiert Quelle nicht', JSON.stringify(srcProfile) === JSON.stringify(srcCopy));
ok('Seed: erste → primary (running)', S.getPrimarySport(seeded) === 'running');
ok('Seed: bekannte Labels gemappt', seeded.sports.map(e => e.sportId).join(',') === 'running,gym,swimming');
ok('Seed: unbekannte Labels verworfen', S.seedFromExistingProfile({ sports: ['Quidditch', 'Laufen'] }).sports.length === 1);
// 15 buildUserSportConfiguration
let cfg = S.buildUserSportConfiguration(pr);
ok('config primarySportId', cfg.primarySportId === 'running');
ok('config plannedSportIds enthält running,gym,cycling', cfg.plannedSportIds.length === 3);
ok('config availableSportIds', cfg.availableSportIds.indexOf('running') >= 0);
// 16 verborgene Sportart bleibt verfügbar
let hiddenSel = S.setVisible(sel([run, { sportId: 'cycling', role: 'secondary', planningEnabled: false }]), 'cycling', false);
ok('verborgene cycling: nicht in visible', S.getVisibleSports(hiddenSel).indexOf('cycling') < 0);
ok('verborgene cycling: weiterhin Aktivität verfügbar', S.isActivityAvailable('cycling') === true);
// 17 unbekannte Aktivität nicht verfügbar
ok('unbekannte Aktivität nicht verfügbar', S.isActivityAvailable('quidditch') === false);
// 18 Normalisierung idempotent
let once = S.normalizeSportsSelection(pr); let twice = S.normalizeSportsSelection(once);
ok('Normalisierung idempotent', JSON.stringify(once) === JSON.stringify(twice));
// setPlanningEnabled: primary bleibt geplant; occasional bleibt false
ok('primary planning bleibt true', S.setPlanningEnabled(sel([run]), 'running', false).sports[0].planningEnabled === true);

/* ===== Korrekturdurchlauf: kanonische IDs, nicht-planbar, enabled, Katalogprüfung ===== */
// 1/2 triathlon + athletics bekannt
ok('triathlon ist bekannt', S.isKnownSport('triathlon') === true);
ok('athletics ist bekannt', S.isKnownSport('athletics') === true);
// 3/4 Seed übernimmt Triathlon + Leichtathletik
ok('Seed übernimmt „Triathlon"', S.seedFromExistingProfile({ sports: ['Triathlon'] }).sports.map(e => e.sportId).indexOf('triathlon') >= 0);
ok('Seed übernimmt „Leichtathletik"', S.seedFromExistingProfile({ sports: ['Leichtathletik'] }).sports.map(e => e.sportId).indexOf('athletics') >= 0);
ok('Seed übernimmt „athletics"', S.seedFromExistingProfile({ sports: ['athletics'] }).sports.map(e => e.sportId).indexOf('athletics') >= 0);
// 5 other wird nie geplant
let otherSel = S.toggleSport(S.emptySportsSelection(), 'other');
ok('other wird nie geplant (toggle)', otherSel.sports.find(e => e.sportId === 'other').planningEnabled === false);
ok('other: getPlannedSports leer', S.getPlannedSports(otherSel).indexOf('other') < 0);
// 6 other erhält nie Priorität
ok('other: priority null', otherSel.sports.find(e => e.sportId === 'other').priority === null);
// 7 other kann nicht primary werden
ok('other: nicht automatisch primary', otherSel.sports.every(e => !(e.sportId === 'other' && e.role === 'primary')));
ok('setPrimarySport(other) wirkungslos', S.getPrimarySport(S.setPrimarySport(otherSel, 'other')) !== 'other');
ok('normalize: other role primary → nicht primary', S.normalizeSportsSelection(sel([{ sportId: 'other', role: 'primary' }])).sports[0].role !== 'primary');
// 8 nur other ist keine vollständige Hauptsportauswahl
ok('nur other → ungültig (kein primary)', S.validateSportsSelection(otherSel).valid === false);
ok('nur other → _primary-Fehler', !!S.validateSportsSelection(otherSel).errors._primary);
// 9 setPlanningEnabled(other,true) bleibt false
ok('setPlanningEnabled(other,true) bleibt false', S.setPlanningEnabled(sel([run, { sportId: 'other', role: 'secondary' }]), 'other', true).sports.find(e => e.sportId === 'other').planningEnabled === false);
// 10 enabled=false + visible=true konsistent normalisiert
let c1 = S.normalizeSportEntry({ sportId: 'cycling', role: 'secondary', enabled: false, visible: true });
ok('enabled=false+visible=true → enabled=true', c1.enabled === true && c1.visible === true);
// 11 enabled=false + planningEnabled=true konsistent normalisiert
let c2 = S.normalizeSportEntry({ sportId: 'cycling', role: 'secondary', enabled: false, planningEnabled: true });
ok('enabled=false+planning=true → enabled=true', c2.enabled === true && c2.planningEnabled === true);
ok('jeder selektierte Eintrag enabled=true', S.normalizeSportsSelection(sel([run, { sportId: 'gym', role: 'secondary', enabled: false }, { sportId: 'other', role: 'occasional', enabled: false }])).sports.every(e => e.enabled === true));
// 12/13/14 Katalogprüfung
ok('validateSportCatalog: realer Katalog valid', S.validateSportCatalog().valid === true);
ok('validateSportCatalog erkennt doppelte IDs', (function () { let real = S.SPORT_CATALOG, byId = S.CATALOG_BY_ID; S.SPORT_CATALOG.push(real[0]); let r = S.validateSportCatalog(); S.SPORT_CATALOG.pop(); return r.valid === false && r.errors.some(e => /doppelte/.test(e)); })());
ok('validateSportCatalog erkennt fehlendes Label', (function () { let bad = { id: 'zzz', label: '', category: 'other', planningSupported: false, metricsProfile: 'other' }; S.SPORT_CATALOG.push(bad); S.CATALOG_BY_ID[bad.id] = bad; let r = S.validateSportCatalog(); S.SPORT_CATALOG.pop(); delete S.CATALOG_BY_ID['zzz']; return r.valid === false && r.errors.some(e => /label/.test(e)); })());
// 15 Normalisierung idempotent (mit triathlon + other)
let mix = S.normalizeSportsSelection(sel([{ sportId: 'triathlon', role: 'primary' }, { sportId: 'athletics', role: 'secondary', planningEnabled: true }, { sportId: 'other', role: 'secondary' }]));
ok('Normalisierung idempotent (triathlon/other)', JSON.stringify(mix) === JSON.stringify(S.normalizeSportsSelection(mix)));
ok('triathlon-Auswahl gültig', S.validateSportsSelection(mix).valid === true);

/* ===== UX-Durchlauf: dynamische Hauptsportart + setSportMode ===== */
// Jede ausgewählte planbare Sportart kann Hauptsportart werden
['football', 'triathlon', 'tennis', 'athletics', 'handball', 'padel', 'basketball', 'rowing', 'hiking', 'walking'].forEach(function (id) {
  let s = S.normalizeSportsSelection(sel([run, { sportId: id, role: 'secondary' }]));
  ok(id + ' kann Hauptsportart werden', S.getPrimarySport(S.setPrimarySport(s, id)) === id);
});
// other kann nicht Hauptsportart werden
ok('other kann NICHT Hauptsportart werden', S.getPrimarySport(S.setPrimarySport(sel([run, { sportId: 'other', role: 'secondary' }]), 'other')) !== 'other');
// setSportMode
let m0 = S.normalizeSportsSelection(sel([run, { sportId: 'cycling', role: 'occasional' }]));
let mPlanned = S.setSportMode(m0, 'cycling', 'planned');
let cP = mPlanned.sports.find(e => e.sportId === 'cycling');
ok('setSportMode planned → secondary + planningEnabled', cP.role === 'secondary' && cP.planningEnabled === true);
ok('setSportMode planned → Priorität gesetzt', cP.priority != null && cP.priority >= 2);
let mOcc = S.setSportMode(mPlanned, 'cycling', 'occasional');
let cO = mOcc.sports.find(e => e.sportId === 'cycling');
ok('setSportMode occasional → role/planning/priority', cO.role === 'occasional' && cO.planningEnabled === false && cO.priority === null);
ok('setSportMode auf primary wirkungslos', S.setSportMode(sel([run]), 'running', 'occasional').sports[0].role === 'primary');
ok('setSportMode(other, planned) bleibt nicht planbar', S.setSportMode(sel([run, { sportId: 'other', role: 'secondary' }]), 'other', 'planned').sports.find(e => e.sportId === 'other').planningEnabled === false);
// Rollenwechsel normalisiert Prioritäten lückenlos
let three = S.normalizeSportsSelection(sel([run, { sportId: 'gym', role: 'secondary', planningEnabled: true }, { sportId: 'cycling', role: 'secondary', planningEnabled: true }]));
let afterOcc = S.setSportMode(three, 'gym', 'occasional');
let priosAfter = afterOcc.sports.filter(e => e.planningEnabled).map(e => e.priority).sort();
ok('Rollenwechsel: Prioritäten lückenlos', JSON.stringify(priosAfter) === JSON.stringify([1, 2]));
ok('Hauptsportart bleibt Priorität 1 nach Modewechsel', afterOcc.sports.find(e => e.role === 'primary').priority === 1);
// Sichtbarkeit ändert Aktivitätsverfügbarkeit nicht
ok('setVisible ändert isActivityAvailable nicht', S.isActivityAvailable('cycling') === true && S.setVisible(m0, 'cycling', false) && S.isActivityAvailable('cycling') === true);
// setSportMode mutiert Eingabe nicht
let srcMode = sel([run, { sportId: 'cycling', role: 'occasional' }]); let srcModeCopy = JSON.parse(JSON.stringify(srcMode));
S.setSportMode(srcMode, 'cycling', 'planned');
ok('setSportMode mutiert Eingabe nicht', JSON.stringify(srcMode) === JSON.stringify(srcModeCopy));

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
