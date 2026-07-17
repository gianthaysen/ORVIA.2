/* ORVIA · M1b (ADR D1–D8) — _sectionMeta, Completeness, Freshness (profile-model.js).
   Test-first. Lädt das ECHTE Modul. Feste Uhrzeit, keine Live-Abhängigkeiten.
   node supabase/tests/profile_meta_completeness_test.mjs */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const P = (await import(new URL('../../js/profile-model.js', import.meta.url))).default;

const NOW = '2026-07-02T12:00:00.000Z';
const daysAgo = (n) => new Date(Date.parse(NOW) - n * 864e5).toISOString();
const SECTIONS = ['personal', 'sports', 'goals', 'availability', 'body', 'recovery', 'constraints', 'preferences', 'devices'];

function essentialProfile() {
  return {
    v: 1, name: 'G', birthDate: '1996-05-01',
    sports: [{ sportId: 'running', role: 'primary', level: 'ambitioniert', sessionsPerWeek: 4, typicalDuration: 60 }],
    goals: [{ id: 'g1', type: 'halfmarathon', title: 'HM', priority: 1, status: 'active' }],
    availability: { days: { mo: { available: true }, di: { available: false } } },
    constraintsList: [], constraintsAcknowledgedAt: '2026-07-01T10:00:00.000Z'
  };
}

/* ---------- 0) Export-Vertrag (RED vor Implementierung) ---------- */
['ensureSectionMeta', 'touchSectionMeta', 'computeSectionCompleteness', 'computeProfileCompleteness', 'getSectionFreshness', 'goalDateNeedsReview'].forEach(fn =>
  ok('Export vorhanden: ' + fn, typeof P[fn] === 'function'));
ok('FRESHNESS_CONFIG exportiert (zentrale Richtwerte, nicht UI)', P.FRESHNESS_CONFIG && P.FRESHNESS_CONFIG.sections && P.FRESHNESS_CONFIG.sections.constraints);
ok('SECTION_META_SOURCES exportiert (D2)', Array.isArray(P.SECTION_META_SOURCES) && ['unknown','onboarding','editor','import','migration','system'].every(s => P.SECTION_META_SOURCES.includes(s)));
if (typeof P.ensureSectionMeta !== 'function') { console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen. (RED: Implementierung fehlt)'); process.exit(1); }

/* ---------- 1) ensureSectionMeta ---------- */
let p = essentialProfile();
const before = JSON.stringify(Object.assign({}, p, { _sectionMeta: undefined }));
P.ensureSectionMeta(p);
ok('E1 Altprofil ohne Meta: alle 9 Sections angelegt', SECTIONS.every(s => p._sectionMeta[s]));
ok('E1 Backfill-Vertrag (D8): updatedAt null + source unknown + schemaVersion 1',
  SECTIONS.every(s => p._sectionMeta[s].updatedAt === null && p._sectionMeta[s].source === 'unknown' && p._sectionMeta[s].schemaVersion === 1));
ok('E1 fachliche Felder unverändert', JSON.stringify(Object.assign({}, p, { _sectionMeta: undefined })) === before);
const snap1 = JSON.stringify(p._sectionMeta);
P.ensureSectionMeta(p);
ok('E2 idempotent (zweiter Aufruf ändert nichts)', JSON.stringify(p._sectionMeta) === snap1);
p._sectionMeta.sports = { updatedAt: daysAgo(3), source: 'import', schemaVersion: 1 };
p._sectionMeta.goals = { updatedAt: 'kaputt', source: 'hacker', schemaVersion: 'x' };
delete p._sectionMeta.body;
P.ensureSectionMeta(p);
ok('E3 teilweise vorhandene Meta bleibt erhalten', p._sectionMeta.sports.updatedAt === daysAgo(3) && p._sectionMeta.sports.source === 'import');
ok('E3 ungültige Meta sicher normalisiert', p._sectionMeta.goals.updatedAt === null && p._sectionMeta.goals.source === 'unknown' && p._sectionMeta.goals.schemaVersion === 1);
ok('E3 gelöschte Section wieder ergänzt', p._sectionMeta.body && p._sectionMeta.body.updatedAt === null);

/* ---------- 2) touchSectionMeta ---------- */
p = essentialProfile();
let touched = P.touchSectionMeta(p, 'goals', 'editor', NOW);
ok('T1 einzelne Section: updatedAt/source/schemaVersion gesetzt',
  JSON.stringify(touched) === '["goals"]' && p._sectionMeta.goals.updatedAt === NOW && p._sectionMeta.goals.source === 'editor' && p._sectionMeta.goals.schemaVersion === 1);
touched = P.touchSectionMeta(p, ['sports', 'availability'], 'migration', NOW);
ok('T2 mehrere Sections', touched.length === 2 && p._sectionMeta.sports.updatedAt === NOW && p._sectionMeta.availability.source === 'migration');
touched = P.touchSectionMeta(p, ['unbekannt', 'goals'], 'editor', NOW);
ok('T3 unbekannte Section wird ignoriert (dokumentierter Vertrag)', JSON.stringify(touched) === '["goals"]' && !p._sectionMeta.unbekannt);
P.touchSectionMeta(p, 'recovery', 'boesewicht', NOW);
ok('T4 ungültige source → unknown', p._sectionMeta.recovery.source === 'unknown' && p._sectionMeta.recovery.updatedAt === NOW);
ok('T5 andere Sections unangetastet (personal weiter Backfill)', p._sectionMeta.personal.updatedAt === null);

/* ---------- 3) computeSectionCompleteness ---------- */
p = essentialProfile();
let r = P.computeSectionCompleteness(p, 'personal');
ok('C1 personal vollständig', r.complete === true && r.score === 1 && r.missing.length === 0 && r.required.length > 0);
r = P.computeSectionCompleteness({ name: '', ageEstimate: null }, 'personal');
ok('C2 personal unvollständig: name + birth_or_age fehlen', r.complete === false && r.missing.includes('name') && r.missing.includes('birth_or_age'));
ok('C2b ageEstimate als Alternative zu birthDate', P.computeSectionCompleteness({ name: 'X', ageEstimate: 30 }, 'personal').complete === true);
r = P.computeSectionCompleteness(p, 'sports');
ok('C3 sports Essential vollständig', r.complete === true && r.present.includes('primary_level') && r.present.includes('primary_typical_duration'));
r = P.computeSectionCompleteness({ sports: [{ sportId: 'gym', role: 'supplemental' }] }, 'sports');
ok('C4 sports unvollständig: kein Hauptsport/Level/Frequenz', r.complete === false && r.missing.includes('primary_sport') && r.missing.includes('primary_level') && r.missing.includes('primary_sessions_per_week'));
ok('C5 Ziel vorhanden', P.computeSectionCompleteness(p, 'goals').complete === true);
ok('C5b Ziel fehlt', P.computeSectionCompleteness({ goals: [] }, 'goals').missing.includes('goal_category'));
ok('C6 Verfügbarkeit vorhanden', P.computeSectionCompleteness(p, 'availability').complete === true);
ok('C6b Verfügbarkeit fehlt', P.computeSectionCompleteness({ availability: { days: { mo: { available: false } } } }, 'availability').complete === false);
ok('C7 Sicherheitsfrage beantwortet (ack)', P.computeSectionCompleteness(p, 'constraints').complete === true);
ok('C7b Sicherheitsfrage beantwortet (aktive Beschwerde vorhanden)', P.computeSectionCompleteness({ constraintsList: [{ bodyRegion: 'knee', intensity: 4 }] }, 'constraints').complete === true);
ok('C7c Sicherheitsfrage unbeantwortet', P.computeSectionCompleteness({ constraintsList: [] }, 'constraints').missing.includes('safety_check_answered'));
r = P.computeSectionCompleteness(p, 'body');
ok('C8 Section ohne Essential-Pflichten (body): complete true, required leer', r.complete === true && r.required.length === 0);
const pNoBody = essentialProfile(); const pBody = Object.assign(essentialProfile(), { heightCm: 182, weightKg: 78, sex: 'm' });
ok('C9 optionale Körperdaten/Geschlecht ändern personal-Score NICHT',
  P.computeSectionCompleteness(pNoBody, 'personal').score === P.computeSectionCompleteness(pBody, 'personal').score);
const metaSnap = JSON.stringify(pNoBody._sectionMeta || null); const profSnap = JSON.stringify(pNoBody);
P.computeSectionCompleteness(pNoBody, 'sports'); P.computeProfileCompleteness(pNoBody); P.getSectionFreshness(pNoBody, 'goals', NOW);
ok('C10 compute-/Freshness-Funktionen mutieren NICHT', JSON.stringify(pNoBody) === profSnap && JSON.stringify(pNoBody._sectionMeta || null) === metaSnap);
ok('C11 completeness liest _sectionMeta nicht (D3)', (() => { const a = essentialProfile(); const b = essentialProfile(); P.touchSectionMeta(b, SECTIONS, 'editor', NOW); return P.computeSectionCompleteness(a, 'sports').score === P.computeSectionCompleteness(b, 'sports').score; })());

/* ---------- 4) computeProfileCompleteness ---------- */
p = essentialProfile();
let agg = P.computeProfileCompleteness(p);
ok('P1 Essential komplett: essential.complete true, score 1', agg.essential.complete === true && agg.essential.score === 1);
const pAdv = essentialProfile(); pAdv.performance = { ftp: { value: null } }; pAdv.devices = { equipment: [] }; pAdv.preferences = {};
ok('P2 Advanced-/B-Felder reduzieren Essential-Score NICHT', P.computeProfileCompleteness(pAdv).essential.score === 1);
const pMiss = essentialProfile(); pMiss.goals = []; delete pMiss.constraintsAcknowledgedAt;
agg = P.computeProfileCompleteness(pMiss);
ok('P3 fehlende Bereiche einzeln ausgewiesen (kein naiver Durchschnitt über 9 Sections)',
  agg.essential.complete === false && agg.essential.score > 0 && agg.essential.score < 1 &&
  agg.essential.missing.some(m => m.section === 'goals') && agg.essential.missing.some(m => m.section === 'constraints') &&
  Array.isArray(agg.essentialSections) && agg.essentialSections.length === 5);
ok('P4 sections-Detail je Section vorhanden', agg.sections && agg.sections.sports && agg.sections.sports.complete === true);

/* ---------- 5) getSectionFreshness ---------- */
p = essentialProfile(); P.ensureSectionMeta(p);
ok('F1 unknown ohne updatedAt (Backfill D8)', P.getSectionFreshness(p, 'constraints', NOW) === 'unknown');
P.touchSectionMeta(p, ['constraints', 'availability', 'personal', 'sports'], 'editor', daysAgo(3));
ok('F2 current (frisch)', P.getSectionFreshness(p, 'constraints', NOW) === 'current');
P.touchSectionMeta(p, 'constraints', 'editor', daysAgo(15));
ok('F3 zeitkritisch: 15 Tage → review_recommended (Richtwert 14)', P.getSectionFreshness(p, 'constraints', NOW) === 'review_recommended');
P.touchSectionMeta(p, 'constraints', 'editor', daysAgo(30));
ok('F4 zeitkritisch: 30 Tage → stale (Richtwert 28)', P.getSectionFreshness(p, 'constraints', NOW) === 'stale');
P.touchSectionMeta(p, 'availability', 'editor', daysAgo(60));
ok('F5 prüfenswert: availability 60 Tage → review_recommended', P.getSectionFreshness(p, 'availability', NOW) === 'review_recommended');
P.touchSectionMeta(p, 'personal', 'editor', daysAgo(400));
ok('F6 stabile Section wird NIE automatisch stale', P.getSectionFreshness(p, 'personal', NOW) === 'current');
P.touchSectionMeta(p, 'sports', 'editor', daysAgo(400));
ok('F6b sports (Auswahl) stabil → current', P.getSectionFreshness(p, 'sports', NOW) === 'current');
ok('F7 unbekannte Section → unknown', P.getSectionFreshness(p, 'gibtsnicht', NOW) === 'unknown');
ok('F8 keine UI-Texte: Rückgabe ist reiner Zustandsstring', ['unknown','current','review_recommended','stale'].includes(P.getSectionFreshness(p, 'goals', NOW)));

/* ---------- 6) Eventbezogene Ziele (gesonderte pure Regel) ---------- */
const pGoal = essentialProfile();
pGoal.goals = [{ id: 'g1', type: 'halfmarathon', status: 'active', targetDate: '2026-06-01' }];
ok('G1 überschrittenes aktives Zieldatum → Review nötig', P.goalDateNeedsReview(pGoal, NOW) === true);
pGoal.goals[0].targetDate = '2026-09-01';
ok('G2 zukünftiges Zieldatum → kein Review', P.goalDateNeedsReview(pGoal, NOW) === false);
pGoal.goals[0].status = 'achieved'; pGoal.goals[0].targetDate = '2026-06-01';
ok('G3 erreichtes Ziel triggert nicht', P.goalDateNeedsReview(pGoal, NOW) === false);

/* ---------- 7) Bestandsdaten & Projektionen unverändert ---------- */
const legacy = { v: 1, onboarded: true, name: 'Gian', sex: 'm', weightKg: 75, heightCm: 180, primaryGoal: 'halfmarathon', sports: ['Laufen', 'Gym'], issues: ['knee'], level: 'fortgeschritten' };
const legacyBefore = JSON.stringify(legacy);
P.ensureSectionMeta(legacy);
P.computeProfileCompleteness(legacy);
const legacyAfter = Object.assign({}, legacy); delete legacyAfter._sectionMeta;
ok('L1 Bestandsprofil: fachlich byte-identisch (nur _sectionMeta ergänzt)', JSON.stringify(legacyAfter) === legacyBefore);
const proj1 = JSON.stringify(P.buildLegacyProjection(P.migrateProfile(JSON.parse(legacyBefore), NOW)));
const proj2 = JSON.stringify(P.buildLegacyProjection(P.migrateProfile(legacy, NOW)));
ok('L2 Legacy-Projektion durch Meta unverändert', proj1 === proj2);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
