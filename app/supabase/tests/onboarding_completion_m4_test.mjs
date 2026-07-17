/* ORVIA · M4 — Onboarding-Completion transaktional (Race-Fix, KNOWN_ISSUES #5).
   Test-first. Lädt die echten Module (onboarding-ui/_m4, profile-model) mit Mini-DOM;
   Persistenz/Profil-API als Fakes injiziert. node supabase/tests/onboarding_completion_m4_test.mjs */
import fs from 'fs';
import { createMiniDom } from './_helpers.mjs';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const dom = createMiniDom();
global.window = globalThis; global.document = dom.document;
const SRC = fs.readFileSync(new URL('../../js/onboarding/onboarding-ui.js', import.meta.url), 'utf8');
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/profile-model.js');
load('js/onboarding/onboarding-logic.js');
(0, eval)(SRC);
const PM = globalThis.ORVIA.profileModel;
const M4 = globalThis.ORVIA.onboardingV2 && globalThis.ORVIA.onboardingV2._m4;

/* ---------- 0) Vertrag + Race-Beweis am Quelltext (RED vor Fix) ---------- */
ok('Export: _m4.buildCompletionPatch + _m4.completeOnboardingFlow', !!M4 && typeof M4.buildCompletionPatch === 'function' && typeof M4.completeOnboardingFlow === 'function');
ok('RACE-Beweis: alter unguarded Abschluss (completed→persist→closeShell synchron) ist ENTFERNT',
  !/status = 'completed'; S\.draft\.completedAt = now\(\); persist\(\);\s*\n\s*closeShell\(\);/.test(SRC));
ok('Erfolgs-Screen vorhanden, kein Auto-Close („Dein Profil steht.")', SRC.includes('Dein Profil steht.'));
ok('Fehlerpfad mit Retry vorhanden („Erneut versuchen")', SRC.includes('Erneut versuchen'));
if (!M4) { console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen. (RED)'); process.exit(1); }

/* ---------- Fixtures ---------- */
const NOW = 1751500000000;
function draftFixture() {
  return {
    version: 3, status: 'in_progress', currentStep: 'review_placeholder',
    completedSteps: ['welcome', 'profile', 'sports', 'goals_placeholder', 'schedule_placeholder'], skippedSteps: [],
    draftData: {
      profile: { displayName: 'Gian', experienceLevel: 'advanced', heightCm: 180, weightKg: 75, birthDate: '1996-05-01', sex: 'male' },
      sports: { sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'gym', role: 'supplemental' }] },
      goals: [{ title: 'HM unter 1:50', priority: 1 }],
      availability: { days: { mo: { available: true } } }
    },
    startedAt: NOW - 1000, updatedAt: NOW - 500, completedAt: null
  };
}
function makeCtx(persistImpl, opts) {
  opts = opts || {};
  const calls = { updateSection: [], load: 0, mark: 0, persistStore: 0, persistDraft: 0, events: [] };
  return {
    calls,
    draft: opts.draft || draftFixture(),
    patch: null, // wird im Test gesetzt
    profileApi: {
      load() { calls.load++; },
      updateSection(id, patch, secs) { calls.updateSection.push({ id, secs: secs.slice() }); },
      markOnboardingComplete() { calls.mark++; }
    },
    profileStore: persistImpl === undefined ? undefined : { persist: async function () { calls.persistStore++; return persistImpl(); } },
    persistDraft() { calls.persistDraft++; },
    now: () => NOW,
    onEvent(detail) { calls.events.push(detail); }
  };
}
function runFlow(ctx) {
  ctx.patch = M4.buildCompletionPatch(ctx.draft.draftData, PM);
  return M4.completeOnboardingFlow(ctx);
}
const deferred = () => { let res; const p = new Promise(r => res = r); return { p, resolve: res }; };

const run = async () => {
  /* ---------- 1) Mapping Draft → PROFILE ---------- */
  const patch = M4.buildCompletionPatch(draftFixture().draftData, PM);
  ok('MAP1 displayName → name', patch.name === 'Gian');
  ok('MAP2 experienceLevel → sports[primary].level (kanonisches Ziel, Feldmatrix)', patch.sports.find(s => s.role === 'primary').level === 'advanced');
  ok('MAP3 kein Level-Duplikat: top-level patch.level bleibt unberührt, Sekundärsport ohne Level', patch.level === undefined && patch.sports.find(s => s.role === 'supplemental').level === null);
  ok('MAP4 Körper-/Basisfelder gemappt', patch.heightCm === 180 && patch.weightKg === 75 && patch.birthDate === '1996-05-01' && patch.sex === 'male');
  ok('MAP5 goals + availability normalisiert', Array.isArray(patch.goals) && patch.goals[0].title === 'HM unter 1:50' && patch.availability.days.mo.available === true);

  /* ---------- 2) Erfolg: persist wird AWAITED, completed erst danach ---------- */
  {
    const d = deferred();
    const ctx = makeCtx(() => d.p.then(() => ({ success: true, sync_status: 'synced' })));
    const flowP = runFlow(ctx);
    await new Promise(r => setTimeout(r, 5));
    ok('E1 vor persist-Resolve: Draft NICHT completed, kein Event', ctx.draft.status === 'in_progress' && ctx.draft.completedAt === null && ctx.calls.events.length === 0);
    d.resolve();
    const r = await flowP;
    ok('E2 nach persist: ok + completed + completedAt (injizierte Zeit)', r.ok === true && ctx.draft.status === 'completed' && ctx.draft.completedAt === NOW);
    ok('E3 Draft nach Abschluss persistiert', ctx.calls.persistDraft >= 1);
    ok('E4 Event genau einmal, minimales Detail', ctx.calls.events.length === 1 && ctx.calls.events[0].version === 3 && ctx.calls.events[0].syncStatus === 'synced' && ctx.calls.events[0].completedAt === NOW && !ctx.calls.events[0].profile);
    ok('E5 Profil exakt einmal angewendet (updateSection 1×, mark 1×)', ctx.calls.updateSection.length === 1 && ctx.calls.mark === 1);
  }

  /* ---------- 3) Offline/Pending = kontrollierter Erfolg ---------- */
  {
    const ctx = makeCtx(() => ({ success: true, sync_status: 'pending', offline: true }));
    const r = await runFlow(ctx);
    ok('O1 Queue/Pending: completed + syncStatus pending (keine falsche synced-Markierung)', r.ok === true && r.syncStatus === 'pending' && ctx.draft.status === 'completed' && ctx.calls.events[0].syncStatus === 'pending');
  }

  /* ---------- 4) Kein Cloud-Kontext (lokaler Modus / keine Sitzung) ---------- */
  {
    const ctx = makeCtx(() => ({ success: false, error: { message: 'Keine aktive Sitzung.' }, source: 'empty', sync_status: 'failed' }));
    const r = await runFlow(ctx);
    ok('L1 „keine Sitzung" wird als lokaler Abschluss eingeordnet (nicht als Fehler erfunden)', r.ok === true && r.syncStatus === 'local' && ctx.draft.status === 'completed');
    const ctx2 = makeCtx(undefined); // profileStore fehlt komplett
    const r2 = await runFlow(ctx2);
    ok('L2 profileStore fehlt → lokaler Abschluss, kein Crash', r2.ok === true && r2.syncStatus === 'local');
  }

  /* ---------- 5) Fehler: Draft bleibt resumierbar ---------- */
  {
    const ctx = makeCtx(() => ({ success: false, error: { message: 'upsert_failed: kaputt' }, source: 'supabase', sync_status: 'failed' }));
    const r = await runFlow(ctx);
    ok('F1 persist-Fehler: ok false, Draft in_progress, completedAt null, KEIN Event', r.ok === false && ctx.draft.status === 'in_progress' && ctx.draft.completedAt === null && ctx.calls.events.length === 0);
    ok('F2 Eingaben gesichert: Draft im Fehlerpfad persistiert, Profil lokal angewendet', ctx.calls.persistDraft >= 1 && ctx.calls.updateSection.length === 1);
    ok('F3 Fehler ohne sensible Details im Resultat', r.error && typeof r.error === 'string' && !r.error.includes('kaputt'));
    // Retry auf demselben Draft:
    ctx.profileStore.persist = async () => { ctx.calls.persistStore++; return { success: true, sync_status: 'synced' }; };
    const r2 = await M4.completeOnboardingFlow(ctx);
    ok('F4 Retry möglich: zweiter Aufruf schließt ab, Event insgesamt genau 1×', r2.ok === true && ctx.draft.status === 'completed' && ctx.calls.events.length === 1);
  }

  /* ---------- 6) Unerwarteter Throw ---------- */
  {
    const ctx = makeCtx(() => { throw new Error('boom'); });
    const r = await runFlow(ctx);
    ok('T1 Throw → failed, kein completed, kein Event, Guard freigegeben', r.ok === false && ctx.draft.status === 'in_progress' && ctx.calls.events.length === 0);
    ctx.profileStore.persist = async () => ({ success: true, sync_status: 'synced' });
    ok('T2 danach erneut möglich', (await M4.completeOnboardingFlow(ctx)).ok === true);
  }

  /* ---------- 7) Race / Doppel-Submit ---------- */
  {
    const d = deferred();
    const ctx = makeCtx(() => d.p.then(() => ({ success: true, sync_status: 'synced' })));
    ctx.patch = M4.buildCompletionPatch(ctx.draft.draftData, PM);
    const p1 = M4.completeOnboardingFlow(ctx);
    const p2 = M4.completeOnboardingFlow(ctx);
    d.resolve();
    const [r1, r2] = await Promise.all([p1, p2]);
    const oneOk = [r1, r2].filter(r => r.ok).length;
    const oneBlocked = [r1, r2].filter(r => r.ok === false && r.code === 'in_flight').length;
    ok('R1 paralleler Doppelaufruf: genau einer gewinnt, einer als in_flight blockiert', oneOk === 1 && oneBlocked === 1);
    ok('R2 genau 1× Save/Persist/Event/completedAt', ctx.calls.updateSection.length === 1 && ctx.calls.persistStore === 1 && ctx.calls.events.length === 1 && ctx.draft.completedAt === NOW);
    const r3 = await M4.completeOnboardingFlow(ctx);
    ok('R3 erneuter Aufruf nach Abschluss: already_completed, kein zweites Event', r3.ok === false && r3.code === 'already_completed' && ctx.calls.events.length === 1);
  }

  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
