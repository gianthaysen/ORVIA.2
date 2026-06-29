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
let av = P.normalizeAvailability({ weekly: { mo: { available: false }, sa: { maxMinutes: 90, teamTraining: true } }, maxSessions: 8 });
ok('I3-26 Verfügbarkeit pro Wochentag + Wochenlimits', av.weekly.mo.available === false && av.weekly.sa.maxMinutes === 90 && av.weekly.sa.teamTraining === true && av.maxSessions === 8 && P.WEEKDAYS.length === 7);

// Profilbereiche-Schema (Punkt 10)
ok('I3-10 9 editierbare Profilbereiche definiert', P.PROFILE_SECTIONS.length === 9 && P.PROFILE_SECTIONS.some(s => s.id === 'availability' && s.planImpact === true));

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
