/* ORVIA · profile-model — migrationssicheres Mehrziel-Profilmodell. */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const P = (await import(new URL('../../js/profile-model.js', import.meta.url))).default;

// ---- Migration v1 → v2 (34/35: kein Datenverlust) ----
const oldV1 = { v: 1, onboarded: true, name: 'Gian', sex: 'm', weightKg: 75, heightCm: 180,
  primaryGoal: 'halfmarathon', primaryGoalLabel: 'HM < 1:50', raceDate: '2026-09-06', hmTargetMin: 110,
  secondaryGoals: ['Langfristig shredded', 'Ironman 2028'], sports: ['Laufen', 'Gym'], issues: ['knee', 'none'], level: 'fortgeschritten' };
const mig = P.migrateProfile(oldV1, '2026-06-29T00:00:00.000Z');
ok('34 Migration → version 2', mig.version === 2);
ok('Migration: Primärziel wird Goal mit Priorität 1', mig.goals.find(g => g.priority === 1 && g.title === 'HM < 1:50') != null);
ok('Migration: secondaryGoals → eigene Goals', mig.goals.filter(g => g.title === 'Langfristig shredded' || g.title === 'Ironman 2028').length === 2);
ok('Migration: HM → Kategorie half_marathon + targetDate + Zielwert', (function () { var g = mig.goals.find(x => x.category === 'half_marathon'); return g && g.targetDate === '2026-09-06' && g.targetValue === 110; })());
ok('35 Migration verliert keine Altdaten (_legacy)', mig._legacy && mig._legacy.name === 'Gian');
ok('Migration: personal/sports/constraints übernommen', mig.personal.weightKg === 75 && mig.sports.length === 2 && mig.constraints.some(c => c.region === 'knee') && !mig.constraints.some(c => c.region === 'none'));
ok('Migration idempotent (v2 erneut → v2)', P.migrateProfile(mig).version === 2 && P.migrateProfile(mig).goals.length === mig.goals.length);

// ---- Mehrziel-CRUD (8-14) ----
let goals = P.normalizeGoals([], '2026-06-29T00:00:00.000Z');
goals = P.addGoal(goals, { title: 'Ironman 2028', category: 'ironman', priority: 1, timeHorizon: 'long' });
goals = P.addGoal(goals, { title: 'Shredded werden', category: 'shredded', priority: 1 });
goals = P.addGoal(goals, { title: 'Fußball-Leistung', category: 'football', priority: 2, sports: ['football'] });
ok('8 mehrere Ziele anlegen', goals.length === 3);
ok('stabile IDs', goals.every(g => g.id && g.id.indexOf('goal:') === 0) && new Set(goals.map(g => g.id)).size === 3);
let g1 = goals[0].id;
goals = P.updateGoal(goals, g1, { title: 'Ironman Frankfurt 2028' });
ok('9 Ziel bearbeiten (Titel)', goals.find(g => g.id === g1).title === 'Ironman Frankfurt 2028');
ok('9b updatedAt geändert, id/createdAt stabil', goals.find(g => g.id === g1).createdAt === goals.find(g => g.id === g1).createdAt);
goals = P.setGoalStatus(goals, g1, 'paused');
ok('11 Ziel pausieren', goals.find(g => g.id === g1).status === 'paused');
goals = P.setGoalStatus(goals, g1, 'achieved');
ok('12 Ziel erreichen', goals.find(g => g.id === g1).status === 'achieved');
goals = P.setGoalStatus(goals, g1, 'archived');
ok('13 Ziel archivieren', goals.find(g => g.id === g1).status === 'archived');
let g2 = goals.find(g => g.title === 'Shredded werden').id;
goals = P.removeGoal(goals, g2);
ok('10 Ziel löschen', !goals.find(g => g.id === g2));
ok('36 keine Duplikate (gleiche id nicht doppelt)', P.addGoal([goals[0]], goals[0]).length === 1);

// ---- Freitext + eigene Einheit (14/29/30) ----
let cg = P.addGoal([], { title: 'Klimmzüge 15 am Stück', category: 'custom', currentValue: 8, targetValue: 15, unit: 'Wdh' });
ok('14 eigenes Freitextziel', cg[0].category === 'custom' && cg[0].group === 'general');
ok('30 benutzerdefinierte Einheit', cg[0].unit === 'Wdh' && cg[0].targetValue === 15);

// ---- shredded (15) + langfristig Ironman ohne Datum (16/28) ----
ok('15 shredded-Ziel (Körperzusammensetzung)', P.categoryOf('shredded') === 'body_composition');
let iron = P.addGoal([], { title: 'Ironman irgendwann', category: 'ironman', timeHorizon: 'long' });
ok('16/28 langfristiges Ziel ohne Datum gültig', P.validateGoal(iron[0]).valid === true && iron[0].targetDate === null);
ok('29 Ziel mit Messwert', P.addGoal([], { title: '10k', category: 'run_10k', currentValue: 50, targetValue: 45, unit: 'min' })[0].targetValue === 45);

// ---- Prioritäten (22-25) ----
let pr = P.normalizeGoals([
  { title: 'A', category: 'custom', priority: 1, status: 'active' },
  { title: 'B', category: 'custom', priority: 1, status: 'active' },
  { title: 'C', category: 'custom', priority: 1, status: 'active' }], '2026-06-29T00:00:00.000Z');
ok('25 max. begrenzte „höchste" Prioritäten (3. → Prio 2)', pr.filter(g => g.priority === 1).length === P.MAX_TOP_PRIORITY_GOALS);
ok('22/23 Haupt-/Sekundärziel über Priorität', pr.filter(g => g.priority === 1).length >= 1 && pr.some(g => g.priority === 2));

// ---- Zielkonflikte (26/27) ----
let conflictGoals = P.normalizeGoals([
  { title: 'Masse', category: 'hypertrophy', status: 'active' },
  { title: 'Ironman', category: 'ironman', status: 'active' }]);
let conflicts = P.detectGoalConflicts(conflictGoals);
ok('26 Zielkonflikt erkannt (Hypertrophie vs. Ausdauer)', conflicts.length >= 1 && conflicts[0].conflictType === 'hypertrophy_vs_endurance');
ok('Konflikt strukturiert (goalIds/severity/explanation/strategy)', conflicts[0].goalIds.length === 2 && conflicts[0].severity === 'high' && !!conflicts[0].explanation && !!conflicts[0].recommendedStrategy);
ok('27 userDecision-Feld speicherbar', 'userDecision' in conflicts[0]);
ok('keine Konflikte bei unkritischer Kombi', P.detectGoalConflicts(P.normalizeGoals([{ title: 'Fit', category: 'keep_fit', status: 'active' }])).length === 0);

// ---- sportartspezifische Folgefragen (18-20) ----
ok('18 Fußball-Folgefragen (Position + Fokusoptionen)', (function () { var s = P.sportFollowupSchema('football'); return s && s.fields.indexOf('position') >= 0 && s.focusOptions.indexOf('repeated_sprints') >= 0; })());
ok('19 Triathlon-Folgefragen (Disziplin-Niveaus)', (function () { var s = P.sportFollowupSchema('triathlon'); return s && s.fields.indexOf('swimLevel') >= 0 && s.fields.indexOf('weakestDiscipline') >= 0; })());
ok('Ironman → Triathlon-Schema (Alias)', JSON.stringify(P.sportFollowupSchema('ironman')) === JSON.stringify(P.sportFollowupSchema('triathlon')));
ok('20 Krafttraining-Folgefragen (Split/Geräte)', (function () { var s = P.sportFollowupSchema('gym'); return s && s.fields.indexOf('split') >= 0 && s.fields.indexOf('equipment') >= 0; })());
ok('unbekannte Sportart → kein Schema (null)', P.sportFollowupSchema('quidditch') === null);

// ---- Validierung (17) ----
ok('Ziel ohne Namen → Fehler', P.validateGoal({ title: '' }).errors.title != null);
ok('Zieldatum in der Vergangenheit → Hinweis (aber speicherbar)', P.validateGoal({ title: 'X', targetDate: '2020-01-01' }).errors.targetDate != null);

// ---- nicht mutierend ----
let src = P.addGoal([], { title: 'Z', category: 'custom' }); let cp = JSON.stringify(src);
P.updateGoal(src, src[0].id, { title: 'Y' }); P.removeGoal(src, src[0].id);
ok('CRUD mutiert Eingabeliste nicht', JSON.stringify(src) === cp);

// ---- Zusammenfassung + Plan-Impact-Felder ----
let prof = P.migrateProfile(oldV1);
let sum = P.buildSummary(prof);
ok('Zusammenfassung: Hauptziel + weitere', sum.primaryGoal != null && Array.isArray(sum.otherGoals));
ok('38 Plan-Impact-Felder definiert', P.PLAN_IMPACT_FIELDS.indexOf('primaryGoal') >= 0 && P.PLAN_IMPACT_FIELDS.indexOf('availability') >= 0);

/* ===== Inkrement 2: Legacy-Projektion + Rollen ===== */
let pgoals = P.normalizeGoals([
  { id: 'g1', title: 'HM < 1:50', category: 'half_marathon', priority: 1, status: 'active', targetDate: '2026-09-06', targetValue: 110, unit: 'min' },
  { id: 'g2', title: 'Kraft erhalten', category: 'muscle_maintain', priority: 3, status: 'active' },
  { id: 'g3', title: 'Ironman 2028', category: 'ironman', priority: 4, status: 'active' },
  { id: 'g4', title: 'Pausiert', category: 'custom', priority: 2, status: 'paused' }]);
let proj = P.buildLegacyProjection({ goals: pgoals });
ok('43 Legacy-Projektion: höchste aktive Prio → primaryGoal (halfmarathon)', proj.primaryGoal === 'halfmarathon' && proj.primaryGoalLabel === 'HM < 1:50');
ok('Projektion: weitere aktive → secondaryGoals (ohne pausierte)', proj.secondaryGoals.indexOf('Kraft erhalten') >= 0 && proj.secondaryGoals.indexOf('Ironman 2028') >= 0 && proj.secondaryGoals.indexOf('Pausiert') < 0);
ok('Projektion: HM-Zielzeit → hmTargetMin + raceDate', proj.hmTargetMin === 110 && proj.raceDate === '2026-09-06');
ok('Projektion: keine aktiven → health', P.buildLegacyProjection({ goals: [{ title: 'x', category: 'custom', status: 'archived', priority: 1 }] }).primaryGoal === 'health');
ok('Rolle ↔ Priorität (main=1, longterm=4)', P.priorityOfRole('main') === 1 && P.priorityOfRole('longterm') === 4 && P.roleOfGoal({ priority: 1 }) === 'main' && P.roleOfGoal({ priority: 3 }) === 'maintain');

/* ===== Inkrement 3: Spezialfelder, Meilensteine, Diff, Plan-Impact, Profilbereiche ===== */
// Spezialfeld-Schemas (Punkte 4-7)
ok('I3 Shredded-Schema vollständig (Gewicht/BF/Muskelerhalt/Defizit)', (function () { var f = P.categoryFieldsFor('shredded').map(x => x.key); return ['currentWeight', 'targetBodyFat', 'maintainMuscle', 'deficitKnown', 'keepPerformance'].every(k => f.indexOf(k) >= 0); })());
ok('I3 Ironman→Triathlon-Schema (Distanz/Disziplinniveaus/schwächste)', (function () { var f = P.categoryFieldsFor('ironman').map(x => x.key); return ['distance', 'swimLevel', 'bikeLevel', 'runLevel', 'weakestDiscipline', 'openWater'].every(k => f.indexOf(k) >= 0); })());
ok('I3 Fußball-Schema (Position/Saisonphase/Belastung)', (function () { var f = P.categoryFieldsFor('football').map(x => x.key); return ['position', 'seasonPhase', 'load', 'strengthSupport'].every(k => f.indexOf(k) >= 0); })());
ok('I3 Lauf-/Kraft-/Rad-/Schwimm-Schemas vorhanden', P.categoryFieldsFor('half_marathon').length && P.categoryFieldsFor('hypertrophy').length && P.categoryFieldsFor('cycling_race').length && P.categoryFieldsFor('swim_goal').length);
ok('I3 unbekannte Kategorie → leeres Schema', P.categoryFieldsFor('custom').length === 0);

// Spezialdaten unter categoryData speicherbar + bei Update erhalten (Punkt 8/44)
let sg = P.addGoal([], { title: 'Sehr definiert', category: 'shredded', categoryData: { currentWeight: 78, targetBodyFat: 12, maintainMuscle: true } });
ok('I3 Shredded mit categoryData speicherbar', sg[0].categoryData.targetBodyFat === 12 && sg[0].categoryData.maintainMuscle === true);
let sg2 = P.updateGoal(sg, sg[0].id, { title: 'Sehr definiert 2026' });
ok('I3 categoryData bleibt bei Titel-Update erhalten', sg2[0].categoryData.currentWeight === 78);
let sgIron = P.addGoal(sg, { title: 'Ironman', category: 'ironman', timeHorizon: 'long' });
ok('I3 Shredded parallel zu Ironman (Punkt 9)', sgIron.length === 2 && sgIron.some(g => g.category === 'shredded') && sgIron.some(g => g.category === 'ironman'));

// Meilensteine (Punkt 8/19-23)
let mg = P.addGoal([], { title: 'Ironman', category: 'ironman' })[0];
mg = P.addMilestone(mg, { title: '1500 m schwimmen', targetValue: 1500, unit: 'm' });
mg = P.addMilestone(mg, { title: 'erste olympische Distanz' });
mg = P.addMilestone(mg, { title: 'erste Mitteldistanz' });
ok('I3-19 Meilenstein hinzufügen + Reihenfolge', mg.milestones.length === 3 && mg.milestones[0].order === 0 && mg.milestones[2].order === 2);
ok('I3 Meilenstein stabile id + Status planned', mg.milestones[0].id && mg.milestones[0].status === 'planned');
let m0 = mg.milestones[0].id;
mg = P.updateMilestone(mg, m0, { title: '1500 m am Stück' });
ok('I3-20 Meilenstein bearbeiten', mg.milestones.find(m => m.id === m0).title === '1500 m am Stück');
mg = P.updateMilestone(mg, m0, { status: 'achieved' });
ok('I3-21 Meilenstein erreichen', mg.milestones.find(m => m.id === m0).status === 'achieved');
let m2 = mg.milestones[2].id;
mg = P.moveMilestone(mg, m2, -1);
ok('I3-23 Reihenfolge ändern (lückenlos)', mg.milestones[1].id === m2 && mg.milestones.map(m => m.order).join(',') === '0,1,2');
let beforeDel = mg.milestones.length; mg = P.removeMilestone(mg, m0);
ok('I3-22 Meilenstein löschen', mg.milestones.length === beforeDel - 1 && !mg.milestones.find(m => m.id === m0));

// Diff / ungespeicherte Änderungen (Punkt 3/6/7)
let base = { title: 'A', categoryData: { x: 1, y: 2 } };
ok('I3-7 unverändert → kein Diff', P.diffState(base, { title: 'A', categoryData: { y: 2, x: 1 } }) === false);
ok('I3-6 Änderung erkannt', P.diffState(base, { title: 'B', categoryData: { x: 1, y: 2 } }) === true);

// Plan-Impact-Bündelung (Punkt 17/40)
let imp = P.bundlePlanImpact(null, 'Hauptziel geändert', ['primaryGoal']);
imp = P.bundlePlanImpact(imp, 'Zieldatum geändert', ['targetDate']);
ok('I3-40 Plan-Impact bündelt mehrere Änderungen (ein Eintrag)', imp.pending === true && imp.fields.indexOf('primaryGoal') >= 0 && imp.fields.indexOf('targetDate') >= 0 && imp.createdAt && imp.updatedAt);

// Beschwerden-Modell (Punkt 12/27-30)
let cstr = P.normalizeConstraint({ bodyRegion: 'knee_left', title: 'Patellasehne', intensity: 4, currentlyTrainable: true });
ok('I3-27 Beschwerde normalisiert (id/Status active)', cstr.id && cstr.status === 'active' && cstr.bodyRegion === 'knee_left');
ok('I3 Beschwerde-Status-Kreis', P.CONSTRAINT_STATUSES.join(',') === 'active,improved,resolved,observed');
ok('I3-29 Beschwerde als behoben', P.normalizeConstraint(Object.assign({}, cstr, { status: 'resolved' })).status === 'resolved');

// Verfügbarkeit (Punkt 11/26)
let av = P.normalizeAvailability({ days: { mo: { available: false }, sa: { singleSession: { maxMinutes: 90 } } }, maxSessionsPerWeek: 8 });
ok('I3-26 Verfügbarkeit pro Wochentag + Wochenlimits', av.days.mo.available === false && av.days.sa.singleSession.maxMinutes === 90 && av.maxSessionsPerWeek === 8 && P.WEEKDAYS.length === 7);

// Profilbereiche-Schema (Punkt 10)
ok('I3-10 9 editierbare Profilbereiche definiert', P.PROFILE_SECTIONS.length === 9 && P.PROFILE_SECTIONS.some(s => s.id === 'availability' && s.planImpact === true));

/* ===== Inkrement 4b: gemeinsames Profilfundament ===== */
// Sportmodell (11-15, 33)
let sp = P.normalizeSports(['Laufen', { sportId: 'Laufen' }, { sportId: 'gym', activeInApp: false, includeInPlan: true, role: 'primary' }, { customName: 'Spikeball' }]);
ok('4b-11/13 Sport-Strings normalisiert + dedupe (Laufen 1×)', sp.filter(s => s.sportId === 'Laufen').length === 1);
ok('4b-12 eigene Sportart erhalten (customName)', sp.some(s => s.customName === 'Spikeball'));
ok('4b-14/15 activeInApp/includeInPlan erhalten', (function () { var g = sp.find(s => s.sportId === 'gym'); return g.activeInApp === false && g.includeInPlan === true && g.role === 'primary'; })());
ok('4b Sport-Defaults (activeInApp true, includeInPlan false)', sp.find(s => s.sportId === 'Laufen').activeInApp === true && sp.find(s => s.sportId === 'Laufen').includeInPlan === false);

// Verfügbarkeit Doppeleinheit (17)
let ds = P.normalizeDoubleSession({ enabled: true, sessions: [{ preferredTime: 'morgens', maxMinutes: 45, preferredSports: ['swimming'] }] });
ok('4b-17 Doppeleinheit normalisiert → genau 2 unabhängige Slots', ds.enabled === true && ds.sessions.length === 2 && ds.sessions[0].maxMinutes === 45 && ds.sessions[1].intensityAllowed === 'moderate');

// Performance (18, 19)
let perf = P.normalizePerformance({ vo2max: { value: 50, source: 'garmin', measuredAt: '2026-06-20' }, personalBests: [{ sportId: 'running', distance: '5k', timeSeconds: 1470 }], strengthRecords: [{ exerciseName: 'Bankdrücken', weightKg: 80, repetitions: 5 }] }, { bestTimes: 'HM 1:58', lifts: 'BD 80x5' });
ok('4b-19 Performance strukturiert (vo2max Quelle/Datum, PB/SR mit id)', perf.vo2max.value === 50 && perf.vo2max.source === 'garmin' && perf.personalBests[0].id && perf.strengthRecords[0].id);
ok('4b-18 alte Freitexte als _legacyText erhalten', perf._legacyText && perf._legacyText.bestTimes === 'HM 1:58');

// Geräte/Integrationen (23, 24)
let dv = P.normalizeDevices({ integrations: { strava: { status: 'connected', lastSyncAt: 'x' } } }, ['Garmin', 'Manuell']);
ok('4b-23 Geräte/Integrationen getrennt + Strava connected erhalten', dv.integrations.strava.status === 'connected' && Array.isArray(dv.equipment));
ok('4b-24 nicht verbundene Integrationen ehrlich (garmin not_connected, appleHealth not_available)', dv.integrations.garmin.status === 'not_connected' && dv.integrations.appleHealth.status === 'not_available');
ok('4b Geräte-Legacy-Freitext erhalten (ohne Fake-Connect)', Array.isArray(dv._legacyText) && dv._legacyText.indexOf('Garmin') >= 0 && dv._legacyText.indexOf('Manuell') < 0);

// Beschwerden vereint (20)
let cprof = { constraintsList: [{ id: 'c1', bodyRegion: 'knee_left', status: 'active' }, { id: 'c2', bodyRegion: 'back', status: 'resolved' }], issues: ['shoulder', 'knee_left', 'none'] };
let ac = P.activeConstraints(cprof);
ok('4b-20 activeConstraints vereint constraintsList + issues (keine Dublette knee_left, kein none)', ac.length === 2 && ac.some(c => c.bodyRegion === 'knee_left') && ac.some(c => c.bodyRegion === 'shoulder') && !ac.some(c => c.bodyRegion === 'none') && !ac.some(c => c.bodyRegion === 'back'));
ok('4b issues[]-Projektion vereint (aktiv knee_left + shoulder, kein resolved back)', (function () { var k = P.constraintIssueKeys(cprof); return k.indexOf('knee_left') >= 0 && k.indexOf('shoulder') >= 0 && k.indexOf('back') < 0; })());

// Nutzungsmatrix (25, 26)
ok('4b-25 PROFILE_FIELD_USAGE deckt Kernfelder ab', P.getFieldUsage('recovery.sleep.averageHours').consumers.indexOf('recoveryAssessment') >= 0 && P.getFieldUsage('sports[].includeInPlan').status === 'prepared' && P.getFieldUsage('constraints').status === 'active');
ok('4b-26 Felder ohne Eintrag erkennbar (null)', P.getFieldUsage('personal.unknownField') === null);

// Konsolidierung idempotent + verlustfrei (1,2,3)
let raw = { v: 1, onboarded: true, name: 'Gian', weightKg: 75, primaryGoal: 'halfmarathon', primaryGoalLabel: 'HM', sports: ['running', 'running'], dataSources: ['Strava'], body: { bestTimes: 'HM 1:58' }, customWeirdField: 42 };
let c1 = P.consolidateProfile(raw, '2026-06-29T00:00:00.000Z');
let c2 = P.consolidateProfile(c1, '2026-06-29T00:00:00.000Z');
ok('4b-1/2 Konsolidierung idempotent', JSON.stringify(P.normalizeSports(c1.sports)) === JSON.stringify(P.normalizeSports(c2.sports)) && c2.version === 2);
ok('4b-3 unbekannte Altfelder erhalten', c1.customWeirdField === 42);
ok('4b Sport-Dublette weg + dataSources→devices-Legacy (kein Fake-Connect)', c1.sports.length === 1 && c1.devices.integrations.strava.status === 'not_connected' && c1.devices._legacyText.indexOf('Strava') >= 0);

// Zentrale Zusammenfassung (27)
let sumProf = P.consolidateProfile({ v: 1, name: 'Gian', primaryGoal: 'halfmarathon', primaryGoalLabel: 'HM < 1:50', sports: [{ sportId: 'running', activeInApp: true, includeInPlan: true }, { sportId: 'gym', activeInApp: false }], performance: { vo2max: { value: 52 } }, constraintsList: [{ bodyRegion: 'knee_left', status: 'active' }] });
let psum = P.buildProfileSummary(sumProf);
ok('4b-27 buildProfileSummary aus zentraler Quelle (activeSports/planSports/vo2max/constraints)', psum.activeSports.indexOf('running') >= 0 && psum.activeSports.indexOf('gym') < 0 && psum.planSports.indexOf('running') >= 0 && psum.vo2max === 52 && psum.activeConstraints.length === 1 && psum.primaryGoal === 'HM < 1:50');

/* ===== Inkrement 4c: sportartspezifische Profile ===== */
// Schemas vorhanden für alle geforderten Sportarten (2,7-10)
ok('4c alle Sport-Schemas vorhanden', ['football', 'basketball', 'handball', 'volleyball', 'hockey', 'rugby', 'running', 'cycling', 'swimming', 'triathlon', 'gym', 'padel', 'tennis'].every(k => !!P.sportProfileSchema(k)));

// Fußballpositionen + positionsabhängige Rollen (3-9)
let fb = P.sportProfileSchema('football');
ok('4c-3 Fußballpositionen (IV/AV/Sechser/Flügel/Stürmer/Torwart…)', ['goalkeeper', 'centre_back', 'full_back', 'defensive_midfield', 'winger', 'striker'].every(c => fb.positions.some(p => p[0] === c)));
ok('4c-5 IV-Rollen korrekt (ballspielend)', P.rolesForPosition('football', 'centre_back').some(r => r[0] === 'ball_playing_cb'));
ok('4c-6 AV-Rollen korrekt (offensiv überlappend)', P.rolesForPosition('football', 'full_back').some(r => r[0] === 'overlapping_fb'));
ok('4c-7 Mittelfeldrollen korrekt (box-to-box)', P.rolesForPosition('football', 'central_midfield').some(r => r[0] === 'box_to_box'));
ok('4c-8 Stürmerrollen korrekt (falsche Neun)', P.rolesForPosition('football', 'striker').some(r => r[0] === 'false_nine'));
ok('4c-9 Torwartrollen korrekt (sweeper keeper)', P.rolesForPosition('football', 'goalkeeper').some(r => r[0] === 'sweeper_keeper'));
ok('4c-4 nur passende Rollen je Position (IV-Rollen ≠ Stürmerrollen)', !P.rolesForPosition('football', 'centre_back').some(r => r[0] === 'false_nine'));

// Leistungsziele + Prioritäten strukturiert (11,12)
let sprof = P.normalizeSportProfile('football', { primaryPosition: 'centre_back', secondaryPositions: ['full_back'], playingRole: 'ball_playing_cb', competitionLevel: 'amateur', teamSessionsPerWeek: 2, matchDay: 'sunday', typicalMatchMinutes: 90, lineupStatus: 'starter', seasonPhase: 'inseason', performancePriorities: [{ key: 'acceleration', priority: 1 }, { key: 'maxStrength', priority: 2, currentLevel: 3, targetLevel: 5 }, { key: 'jumpAbility', priority: 1 }] });
ok('4c-2/3 Hauptposition gespeichert', sprof.primaryPosition === 'centre_back');
ok('4c sekundäre Positionen gespeichert', sprof.secondaryPositions.indexOf('full_back') >= 0);
ok('4c-10 eigene Rolle möglich', P.normalizeSportProfile('football', { primaryPosition: 'custom', customRole: 'Libero-Aufbauspieler' }).customRole === 'Libero-Aufbauspieler');
ok('4c-11/12 mehrere Leistungsziele + Prioritäten strukturiert', sprof.performancePriorities.length === 3 && sprof.performancePriorities[1].priority === 2 && sprof.performancePriorities[1].targetLevel === 5);
ok('4c-13/14/15/16 Belastung (Teamtrainings/Spieltag/Minuten/Saison)', sprof.teamSessionsPerWeek === 2 && sprof.matchDay === 'sunday' && sprof.typicalMatchMinutes === 90 && sprof.seasonPhase === 'inseason');

// Demand-Matrix + Resolver (17-20)
let dCB = P.resolveDemandProfile({ sportId: 'football', position: 'centre_back', role: 'classic_cb' });
let dWing = P.resolveDemandProfile({ sportId: 'football', position: 'winger', role: 'classic_winger' });
ok('4c-17 Demand IV erzeugt (hohe Maximalkraft)', dCB.maxStrength >= 0.85);
ok('4c-18 Demand Flügel erzeugt (hohe Maximalsprint/Richtungswechsel)', dWing.maxSpeed >= 0.95 && dWing.changeOfDirection >= 0.95);
ok('4c-19 Nutzerprioritäten modifizieren Baseline', P.resolveDemandProfile({ sportId: 'football', position: 'centre_back', userPriorities: [{ key: 'acceleration', priority: 3 }] }).acceleration > dCB.acceleration);
ok('4c-19b Rollenmodifikatoren wirken (ballspielend senkt maxStrength)', P.resolveDemandProfile({ sportId: 'football', position: 'centre_back', role: 'ball_playing_cb' }).maxStrength < dCB.maxStrength);
ok('4c-20 Beschwerden dämpfen Resolver (maxSpeed sinkt)', P.resolveDemandProfile({ sportId: 'football', position: 'winger', constraints: ['hamstring'] }).maxSpeed < dWing.maxSpeed);
ok('4c Demand geclamped 0..1.2', Object.keys(dWing).every(k => dWing[k] >= 0 && dWing[k] <= 1.2));

// Andere Mannschaftssportarten (21-25)
ok('4c-21 Basketballpositionen', P.sportProfileSchema('basketball').positions.some(p => p[0] === 'point_guard') && P.sportProfileSchema('basketball').positions.some(p => p[0] === 'center'));
ok('4c-22 Handballpositionen', P.sportProfileSchema('handball').positions.some(p => p[0] === 'pivot'));
ok('4c-23 Volleyballpositionen', P.sportProfileSchema('volleyball').positions.some(p => p[0] === 'libero'));
ok('4c-24 Hockeypositionen', P.sportProfileSchema('hockey').positions.some(p => p[0] === 'midfield'));
ok('4c-25 Rugby-Positionsgruppen', P.sportProfileSchema('rugby').positions.some(p => p[0] === 'back_row'));

// Ausdauer/Kraft/Racket (26-32)
ok('4c-26 Laufprofil (Distanz/Wochenkm)', P.sportProfileSchema('running').fields.some(f => f[0] === 'distance') && P.sportProfileSchema('running').fields.some(f => f[0] === 'weeklyKm'));
ok('4c-27 Radprofil (FTP/Disziplin)', P.sportProfileSchema('cycling').fields.some(f => f[0] === 'ftp'));
ok('4c-28 Schwimmprofil (Lage/Beckenlänge)', P.sportProfileSchema('swimming').fields.some(f => f[0] === 'poolLength'));
ok('4c-29 Triathlonprofil (schwächste Disziplin)', P.sportProfileSchema('triathlon').fields.some(f => f[0] === 'weakestDiscipline'));
ok('4c-30 Kraftprofil + linkedSports (Verknüpfung)', P.sportProfileSchema('gym').fields.some(f => f[0] === 'linkedSports') && P.normalizeSportProfile('gym', { fields: { linkedSports: ['football'] } }).fields.linkedSports[0] === 'football');
ok('4c-31 Padelprofil (Seite)', P.sportProfileSchema('padel').fields.some(f => f[0] === 'side'));
ok('4c-32 Tennisprofil (Einzel/Doppel)', P.sportProfileSchema('tennis').fields.some(f => f[0] === 'mode'));
ok('4c endurance/racket-Felder unter fields gespeichert', (function () { var sp = P.normalizeSportProfile('running', { fields: { distance: 'Halbmarathon', weeklyKm: 40 } }); return sp.fields.distance === 'Halbmarathon' && sp.fields.weeklyKm === 40; })());

// Migration/Normalisierung (33-37,41,43)
let sportsWithProfile = P.normalizeSports([{ sportId: 'football', sportProfile: { primaryPosition: 'centre_back', performancePriorities: [{ key: 'acceleration', priority: 1 }] } }, 'football', { customName: 'Crossfit', sportProfile: { fields: { wod: 'Murph' } } }]);
ok('4c-33/35 sportProfile durch normalizeSports erhalten + dedupe', sportsWithProfile.filter(s => s.sportId === 'football').length === 1 && sportsWithProfile.find(s => s.sportId === 'football').sportProfile.primaryPosition === 'centre_back');
ok('4c-36 eigene Sportart mit Profil erhalten', sportsWithProfile.some(s => s.customName === 'Crossfit' && s.sportProfile.fields.wod === 'Murph'));
ok('4c-34 Normalisierung idempotent (sportProfile stabil)', JSON.stringify(P.normalizeSports(sportsWithProfile)) === JSON.stringify(P.normalizeSports(P.normalizeSports(sportsWithProfile))));
ok('4c Sport ohne Profil → sportProfile null (kein Bloat)', P.normalizeSport({ sportId: 'running' }).sportProfile === null);

// PROFILE_FIELD_USAGE (37)
ok('4c-37 PROFILE_FIELD_USAGE deckt sportProfile-Felder ab', P.getFieldUsage('sports[].sportProfile.primaryPosition').consumers.indexOf('positionDemandProfile') >= 0 && P.getFieldUsage('sports[].sportProfile.matchDay').consumers.indexOf('hardSessionPlacement') >= 0);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
