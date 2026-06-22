/* ORVIA · Batch 2 — onboarding-logic (rein). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
globalThis.ORVIA = globalThis.ORVIA || {};
await import(new URL('../../js/onboarding/onboarding-profile-logic.js', import.meta.url)); // für profileValid-Guard
const L = (await import(new URL('../../js/onboarding/onboarding-logic.js', import.meta.url))).default;
const VALIDP = { displayName: 'Alex', birthDate: '2000-05-10', sex: 'male', heightCm: 180, weightKg: 75, unitSystem: 'metric', experienceLevel: 'intermediate' };
function withProfile() { var d = L.newDraft(); d.draftData = { profile: JSON.parse(JSON.stringify(VALIDP)) }; return d; }

// neuer Draft
const d0 = L.newDraft();
ok('newDraft: version 2', d0.version === 2);
ok('newDraft: status not_started', d0.status === 'not_started');
ok('newDraft: currentStep welcome', d0.currentStep === 'welcome');

// Statusübergang
const d1 = L.startDraft(L.newDraft(), 1000);
ok('startDraft: not_started → in_progress', d1.status === 'in_progress' && d1.startedAt === 1000);

// nächster/vorheriger Schritt
ok('nextStepId(welcome) = profile', L.nextStepId('welcome') === 'profile');
ok('prevStepId(welcome) = null (kein Vorgänger)', L.prevStepId('welcome') === null);
ok('nextStepId(review_placeholder) = null', L.nextStepId('review_placeholder') === null);

// Fortschritt
ok('progress welcome = Schritt 1 von 6', L.progress(L.newDraft()).label === 'Schritt 1 von 6');
ok('progress percent welcome = 0', L.progress(L.newDraft()).percent === 0);

// advance bis zum letzten → ready_for_review (NICHT completed). Mit validem Profil, damit 'profile' markiert wird.
let d = withProfile();
for (let i = 0; i < 5; i++) d = L.advance(d, 1);
ok('letzter Schritt erreicht: currentStep review_placeholder', d.currentStep === 'review_placeholder');
d = L.advance(d, 2);
ok('advance am letzten → ready_for_review', d.status === 'ready_for_review');
ok('advance am letzten → NICHT completed', d.status !== 'completed');
ok('completedSteps enthält alle 6 Schritte nach letztem advance', d.completedSteps.length === 6 && d.completedSteps.indexOf('welcome') >= 0 && d.completedSteps.indexOf('review_placeholder') >= 0);
// Guard: ohne valides Profil wird 'profile' NICHT als abgeschlossen markiert
let dNoP = L.advance(L.newDraft(), 1);   // welcome → profile (welcome markiert)
dNoP = L.advance(dNoP, 1);               // versucht profile zu markieren — Guard verhindert
ok('Guard: profile ohne valides Profil NICHT in completedSteps', dNoP.completedSteps.indexOf('profile') < 0);

// Normalisierung
ok('unbekannter currentStep → welcome', L.normalizeDraft({ version: 2, currentStep: 'xxx' }).currentStep === 'welcome');
ok('beschädigte completedSteps bereinigt (gapless, unique)',
  JSON.stringify(L.normalizeDraft({ version: 2, currentStep: 'sports_placeholder', completedSteps: ['welcome', 'welcome', 'bogus', 'profile'], draftData: { profile: VALIDP } }).completedSteps) === JSON.stringify(['welcome', 'profile']));
ok('Version 1 → null (nicht als v2 verwenden)', L.normalizeDraft({ version: 1, currentStep: 'welcome' }) === null);
// completed/ready_for_review OHNE valides Profil → zurück auf Profil-Schritt (Pflichtprofil nicht überspringen)
ok('completed ohne Profil → in_progress', L.normalizeDraft({ version: 2, status: 'completed' }).status === 'in_progress');
ok('completed ohne Profil → currentStep profile', L.normalizeDraft({ version: 2, status: 'completed' }).currentStep === 'profile');
ok('ready_for_review ohne Profil → in_progress', L.normalizeDraft({ version: 2, status: 'ready_for_review', currentStep: 'review_placeholder' }).status === 'in_progress');
// MIT validem Profil bleibt ready_for_review erhalten
let rrv = L.normalizeDraft({ version: 2, status: 'ready_for_review', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile'], draftData: { profile: VALIDP } });
ok('ready_for_review MIT validem Profil bleibt', rrv.status === 'ready_for_review');
ok('completedAt entfernt wenn nicht completed', L.normalizeDraft({ version: 2, status: 'in_progress', completedAt: '2020-01-01' }).completedAt === null);
ok('draftData nur Objekt übernommen', JSON.stringify(L.normalizeDraft({ version: 2, draftData: { a: 1 } }).draftData) === '{"a":1}');
ok('draftData Array verworfen', JSON.stringify(L.normalizeDraft({ version: 2, draftData: [1, 2] }).draftData) === '{}');

// markReadyForReview — strukturiertes Resultat, nur bei vollständigem Draft
const validProfile = VALIDP;
function fullReviewDraft() { return L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile', 'sports_placeholder', 'goals_placeholder', 'schedule_placeholder'], draftData: { profile: validProfile } }); }
let rdy = fullReviewDraft();
let mr = L.markReadyForReview(rdy, 9);
ok('markReadyForReview ok bei vollständigem Draft', mr.ok === true && rdy.status === 'ready_for_review');
ok('markReadyForReview NIEMALS completed', rdy.status !== 'completed');
ok('markReadyForReview merkt review_placeholder', rdy.completedSteps.indexOf('review_placeholder') >= 0);
ok('markReadyForReview falscher Schritt → ok:false', L.markReadyForReview(L.newDraft(), 9).ok === false);
ok('markReadyForReview ohne valides Profil → ok:false', L.markReadyForReview(L.normalizeDraft({ version: 2, currentStep: 'review_placeholder', completedSteps: ['welcome'] }), 9).ok === false);
ok('markReadyForReview lückenhaft → ok:false', L.markReadyForReview(L.normalizeDraft({ version: 2, currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile'], draftData: { profile: validProfile } }), 9).ok === false);
ok('markReadyForReview(null) wirft nicht', (function () { try { return L.markReadyForReview(null).ok === false; } catch (e) { return false; } })());

// ---- advance fail-closed / advanceProfile-Begrenzung ----
let inv = L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'profile', draftData: { profile: { displayName: '' } } }); // ungültiges Profil
L.advance(inv, 1);
ok('ungültiges Profil + advance bleibt auf profile', inv.currentStep === 'profile');
ok('ungültiges Profil + advance: profile NICHT completed', inv.completedSteps.indexOf('profile') < 0);
ok('ungültiges Profil + advance: status in_progress', inv.status === 'in_progress');
let valD = L.normalizeDraft({ version: 2, currentStep: 'profile', completedSteps: ['welcome'], draftData: { profile: validProfile } });
let ap = L.advanceProfile(valD, 1);
ok('advanceProfile gültig + profile-Schritt → ok + Wechsel', ap.ok === true && valD.currentStep === 'sports_placeholder');
ok('advanceProfile auf welcome → ok:false, kein Wechsel', (function () { var d = L.normalizeDraft({ version: 2, currentStep: 'welcome', draftData: { profile: validProfile } }); var r = L.advanceProfile(d, 1); return r.ok === false && d.currentStep === 'welcome'; })());
ok('advanceProfile auf sports → ok:false', (function () { var d = L.normalizeDraft({ version: 2, currentStep: 'sports_placeholder', completedSteps: ['welcome', 'profile'], draftData: { profile: validProfile } }); return L.advanceProfile(d, 1).ok === false; })());
ok('advanceProfile(null) wirft nicht', (function () { try { return L.advanceProfile(null).ok === false; } catch (e) { return false; } })());
ok('advance(null) wirft nicht', (function () { try { L.advance(null); return true; } catch (e) { return false; } })());

// ---- Migration profile_placeholder → profile (gapless) ----
ok('currentStep profile_placeholder → profile', L.normalizeDraft({ version: 2, currentStep: 'profile_placeholder' }).currentStep === 'profile');
let mNoProf = L.normalizeDraft({ version: 2, currentStep: 'profile', completedSteps: ['welcome', 'profile_placeholder'] });
ok('completed profile_placeholder ohne valides Profil → entfernt', mNoProf.completedSteps.indexOf('profile') < 0);
ok('andere completed bleiben (welcome)', mNoProf.completedSteps.indexOf('welcome') >= 0);
let mProf = L.normalizeDraft({ version: 2, currentStep: 'sports_placeholder', completedSteps: ['welcome', 'profile_placeholder'], draftData: { profile: validProfile } });
ok('completed profile_placeholder MIT validem Profil → profile', mProf.completedSteps.indexOf('profile') >= 0);
ok('andere draftData bleiben erhalten', JSON.stringify(L.normalizeDraft({ version: 2, draftData: { profile: validProfile, foo: 1 } }).draftData.foo) === '1');
ok('beschädigte Profilwerte stürzen nicht ab', (function () { try { var d = L.normalizeDraft({ version: 2, draftData: { profile: { heightCm: NaN, weightKg: 'x', sex: 'bogus' } } }); return d && d.draftData.profile.heightCm === null && d.draftData.profile.sex === ''; } catch (e) { return false; } })());

// ---- completedSteps lückenlos/dedupe/order/unknown (mit gesetztem currentStep) ----
let cs1 = L.normalizeDraft({ version: 2, currentStep: 'profile', completedSteps: ['welcome', 'welcome'], draftData: { profile: validProfile } }).completedSteps;
ok('Duplikate entfernt', cs1.length === 1 && cs1[0] === 'welcome');
let cs2 = L.normalizeDraft({ version: 2, currentStep: 'goals_placeholder', completedSteps: ['sports_placeholder', 'profile', 'welcome'], draftData: { profile: validProfile } }).completedSteps;
ok('Reihenfolge normalisiert', JSON.stringify(cs2) === JSON.stringify(['welcome', 'profile', 'sports_placeholder']));
let cs3 = L.normalizeDraft({ version: 2, currentStep: 'profile', completedSteps: ['welcome', 'zzz_unknown'] }).completedSteps;
ok('unbekannte Schritte entfernt', cs3.indexOf('zzz_unknown') < 0 && cs3.indexOf('welcome') >= 0);
let cs4 = L.normalizeDraft({ version: 2, currentStep: 'sports_placeholder', completedSteps: ['welcome', 'profile_placeholder', 'profile'], draftData: { profile: validProfile } }).completedSteps;
ok('profile_placeholder + profile → einmal profile', cs4.filter(function (s) { return s === 'profile'; }).length === 1);
// Lücke: späterer Schritt ohne Vorschritt wird entfernt
ok('Lücke entfernt (goals ohne profile)', JSON.stringify(L.normalizeDraft({ version: 2, currentStep: 'schedule_placeholder', completedSteps: ['welcome', 'goals_placeholder'] }).completedSteps) === JSON.stringify(['welcome']));
// currentStep selbst gilt nicht als abgeschlossen
ok('currentStep nicht in completedSteps', L.normalizeDraft({ version: 2, currentStep: 'profile', completedSteps: ['welcome', 'profile'], draftData: { profile: validProfile } }).completedSteps.indexOf('profile') < 0);

// ---- Mutation/Prototype-Pollution ----
let rawObj = { version: 2, draftData: { profile: { displayName: 'X' }, nested: { a: 1 } } };
let rawCopy = JSON.parse(JSON.stringify(rawObj));
L.normalizeDraft(rawObj);
ok('normalizeDraft mutiert raw NICHT', JSON.stringify(rawObj) === JSON.stringify(rawCopy));
ok('verschachtelte Draft-Daten bleiben', L.normalizeDraft(rawObj).draftData.nested.a === 1);
let poll = L.normalizeDraft(JSON.parse('{"version":2,"draftData":{"__proto__":{"polluted":1},"x":1}}'));
ok('Prototype-Pollution-Schlüssel nicht übernommen', !('polluted' in {}) && poll.draftData.x === 1);
ok('reconcileDraftStatus toleriert falsches completedSteps', (function () { try { var d = L.reconcileDraftStatus({ status: 'in_progress', currentStep: 'welcome', completedSteps: 'kaputt' }); return Array.isArray(d.completedSteps); } catch (e) { return false; } })());

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
