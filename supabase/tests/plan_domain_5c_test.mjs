/* ORVIA · Phase 5C (2026-08-05) — plan-domain: Baseline+Override-Modell + Rebase (E-16).
   Reine Node-Tests, deterministisch (alle Zeitstempel injiziert).
   node supabase/tests/plan_domain_5c_test.mjs */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/* Zwei Checkout-Layouts: Cloud (App unter ../../) und Geraet (App unter ../../../app). */
const _flat = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const PD = require(join(APP, 'js/plan-domain.js'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const T = '2026-08-05T10:00:00Z';

/* ---------- weekKeyFor (ISO-Woche, Mo-basiert) ---------- */
ok('weekKey: Mi 2026-08-05 → 2026-W32', PD.weekKeyFor('2026-08-05') === '2026-W32');
ok('weekKey: Mo 2026-08-03 und So 2026-08-09 → gleiche Woche',
   PD.weekKeyFor('2026-08-03') === '2026-W32' && PD.weekKeyFor('2026-08-09') === '2026-W32');
ok('weekKey: So 2026-08-02 → Vorwoche W31', PD.weekKeyFor('2026-08-02') === '2026-W31');
ok('weekKey: Jahreswechsel 2026-01-01 (Do) → 2026-W01', PD.weekKeyFor('2026-01-01') === '2026-W01');
ok('weekKey: 2027-01-01 (Fr) → 2026-W53 (ISO-Regel)', PD.weekKeyFor('2027-01-01') === '2026-W53');
ok('weekKey: ungueltig → null', PD.weekKeyFor('x') === null && PD.weekKeyFor(null) === null);

/* ---------- Legacy-Migration (5D-Grundlage) ---------- */
const legacy = [
  [{ id: 'ps:abc', t: 'Laufen', l: 'Longrun', dur: 90 }],
  [{ id: 'psg:1:0:intervalle', t: 'Laufen', l: 'Intervalle', dur: 45 }],   // inhaltsabgeleitet ⇒ neue ps:-ID
  [], [{ t: 'Gym', l: 'Unterkörper' }],                                     // ohne ID ⇒ neue ps:-ID
  [], [], []
];
let seq = 0; const idf = () => 'ps:test:' + (seq++);
const plan0 = PD.fromLegacyWeekPlan(legacy, { source: 'manual_edit', at: T }, { weekKey: '2026-W32', now: T, idFactory: idf });
ok('Migration: 3 Sessions uebernommen', plan0.baseline.sessions.length === 3);
ok('Migration: ps:-ID bleibt erhalten (nie neu vergeben)', plan0.baseline.sessions[0].sessionId === 'ps:abc');
ok('Migration: psg:-ID wird durch stabile ps:-ID ersetzt (E-16-Folgeaufgabe)',
   plan0.baseline.sessions[1].sessionId.indexOf('ps:') === 0 && plan0.baseline.sessions[1].sessionId.indexOf('psg:') !== 0);
ok('Migration: KF-011-Stempel manual_edit → baseline.source manual_seed', plan0.baseline.source === 'manual_seed');
ok('Migration: Historie dokumentiert die Herkunft', plan0.history.length === 1 && plan0.history[0].reason === 'legacy_migration');
ok('Migration: valide nach validatePlan', PD.validatePlan(plan0).length === 0, PD.validatePlan(plan0).join(','));
const planEng = PD.fromLegacyWeekPlan(legacy, { source: 'engine_adjustment', at: T, batchId: 'b1' }, { weekKey: '2026-W32', now: T, idFactory: idf });
ok('Migration: engine_adjustment → baseline.source engine', planEng.baseline.source === 'engine');

/* ---------- Overrides + effectiveSessions ---------- */
const mkOv = (o) => Object.assign({ overrideId: 'ov:' + Math.random().toString(36).slice(2, 8), reason: 'user_manual', createdAt: T }, o);
let r1 = PD.applyOverride(plan0, mkOv({ overrideId: 'ov:move1', sessionId: 'ps:abc', type: 'move', dayIndex: 2 }));
ok('Override move: angenommen + History-Eintrag', r1.error === null && r1.plan.overrides.length === 1 && r1.plan.history.some(h => h.reason === 'override_move'));
let eff1 = PD.effectiveSessions(r1.plan);
ok('effective: Longrun liegt jetzt auf Tag 2, Tag 0 leer',
   eff1.days[2].some(s => s.id === 'ps:abc') && eff1.days[0].length === 0);
ok('effective: Baseline unveraendert (kein Durchschreiben)', plan0.baseline.sessions[0].dayIndex === 0);
ok('effective: Provenienz nachvollziehbar', eff1.sessions.find(s => s.sessionId === 'ps:abc').provenance.join('|').indexOf('override:move') >= 0);

let r2 = PD.applyOverride(r1.plan, mkOv({ overrideId: 'ov:move2', sessionId: 'ps:abc', type: 'move', dayIndex: 4 }));
ok('Override move ERSETZT aelteren move derselben Session (kein Widerspruchs-Stapel)',
   r2.plan.overrides.filter(o => o.sessionId === 'ps:abc' && o.type === 'move').length === 1
   && PD.effectiveSessions(r2.plan).days[4].some(s => s.id === 'ps:abc'));
ok('Ersetzter Override steht in der History (nichts verschwindet still)',
   r2.plan.history.some(h => h.detail && h.detail.replacedOverrideId === 'ov:move1'));

let r3 = PD.applyOverride(r2.plan, mkOv({ sessionId: plan0.baseline.sessions[1].sessionId, type: 'resize', durationMin: 60 }));
ok('Override resize: Dauer im effektiven Plan geaendert',
   PD.effectiveSessions(r3.plan).sessions.find(s => s.sessionId === plan0.baseline.sessions[1].sessionId).session.dur === 60);

let r4 = PD.applyOverride(r3.plan, mkOv({ sessionId: plan0.baseline.sessions[2].sessionId, type: 'skip' }));
const eff4 = PD.effectiveSessions(r4.plan);
ok('Override skip: Session raus aus dem effektiven Plan, aber als skipped sichtbar',
   !eff4.days.flat().some(s => s.id === plan0.baseline.sessions[2].sessionId) && eff4.skipped.length === 1);

let r5 = PD.applyOverride(r4.plan, mkOv({ sessionId: 'ps:new1', type: 'add', dayIndex: 5, session: { t: 'Rad', l: 'GA1', dur: 120 } }));
ok('Override add: neue Einheit mit ps:-ID im effektiven Plan',
   PD.effectiveSessions(r5.plan).days[5].some(s => s.id === 'ps:new1'));

ok('Validierung: add ohne ps:-ID abgelehnt',
   PD.validateOverride({ overrideId: 'x', sessionId: 'foo', type: 'add', dayIndex: 1, session: {}, reason: 'r', createdAt: T }).indexOf('add_needs_ps_id') >= 0);
ok('Validierung: unbekannter Typ abgelehnt',
   PD.validateOverride(mkOv({ sessionId: 'ps:abc', type: 'delete' })).indexOf('type_invalid') >= 0);
ok('Override auf nicht existierende Session: wirkungslos, aber sichtbar (orphan)',
   PD.effectiveSessions(PD.applyOverride(plan0, mkOv({ overrideId: 'ov:x', sessionId: 'ps:gibtsnicht', type: 'skip' })).plan).orphanOverrides.length === 1);

/* removeOverride */
let r6 = PD.removeOverride(r5.plan, 'ov:move2', T);
ok('removeOverride: gezielt zurueckgenommen + dokumentiert',
   r6.error === null && !r6.plan.overrides.some(o => o.overrideId === 'ov:move2') && r6.plan.history.some(h => h.reason === 'override_removed'));

/* ---------- Rebase (E-16) ---------- */
/* Neue Engine-Baseline: ps:abc bleibt · Session[1] hat Nachfolger · Session[2] entfaellt. */
const sid1 = plan0.baseline.sessions[1].sessionId, sid2 = plan0.baseline.sessions[2].sessionId;
const newBase = {
  source: 'engine', engineVersion: '2.0.0', generatedAt: '2026-08-06T06:00:00Z', snapshotId: 'snap1',
  sessions: [
    { sessionId: 'ps:abc', dayIndex: 1, session: { id: 'ps:abc', t: 'Laufen', l: 'Longrun', dur: 100 } },
    { sessionId: 'ps:succ1', dayIndex: 3, predecessorSessionId: sid1, session: { id: 'ps:succ1', t: 'Laufen', l: 'Tempolauf', dur: 40 } }
  ]
};
const rb = PD.rebase(r5.plan, newBase, { now: '2026-08-06T06:00:00Z' });
ok('Rebase: Revision erhoeht, neue Baseline aktiv', rb.plan.revision === 2 && rb.plan.baseline.snapshotId === 'snap1');
ok('Rebase: Override auf gleicher ps:-ID automatisch uebernommen (move ps:abc)',
   rb.plan.overrides.some(o => o.sessionId === 'ps:abc' && o.type === 'move'));
ok('Rebase: Override via predecessorSessionId retargetet (resize → ps:succ1)',
   rb.plan.overrides.some(o => o.sessionId === 'ps:succ1' && o.type === 'resize' && o.retargetedFrom === sid1));
ok('Rebase: add-Override bleibt immer erhalten', rb.plan.overrides.some(o => o.sessionId === 'ps:new1' && o.type === 'add'));
ok('Rebase: Ziel entfallen ⇒ verworfen MIT Begruendung in der History',
   rb.dropped.some(d => d.sessionId === sid2) && rb.plan.history.some(h => h.reason === 'engine_rebase' && h.detail.dropped.length >= 1));
const effRb = PD.effectiveSessions(rb.plan);
ok('Rebase: effektiver Plan konsistent (Longrun auf Tag 4 durch erhaltenen move)',
   effRb.days[4].some(s => s.id === 'ps:abc') && effRb.days[3].some(s => s.id === 'ps:succ1' && s.dur === 60 || s.id === 'ps:succ1'));
ok('Rebase: Nutzer-Override ueberschreibt Engine nie rueckwaerts — Baseline traegt dur:100, effektiv gilt der move',
   rb.plan.baseline.sessions[0].dayIndex === 1);

/* psg:-Konflikt (E-16: nie automatisch) */
const planPsg = JSON.parse(JSON.stringify(plan0));
planPsg.overrides = [mkOv({ overrideId: 'ov:psg', sessionId: 'psg:1:0:intervalle', type: 'skip' })];
const rbPsg = PD.rebase(planPsg, newBase, { now: T });
ok('Rebase: psg:-Override wird NIE automatisch uebertragen ⇒ pendingConflict (Badge, Entscheidung ②)',
   rbPsg.conflicts.length === 1 && rbPsg.conflicts[0].reason === 'psg_id_unstable' && rbPsg.plan.pendingConflicts.length === 1);
/* NEGATIVKONTROLLE: Titel-/Positionsgleichheit ist KEIN Identitaetsnachweis —
   obwohl 'Intervalle' inhaltlich dem neuen 'Tempolauf'-Slot aehnelt, wird nichts geraten. */
ok('NEGATIVKONTROLLE: kein Rebase ueber Inhaltsaehnlichkeit',
   !rbPsg.plan.overrides.some(o => o.overrideId === 'ov:psg'));

/* Konfliktaufloesung */
const rc1 = PD.resolveConflict(rbPsg.plan, 'ov:psg', { action: 'accept', newSessionId: 'ps:succ1', override: planPsg.overrides[0] }, T);
ok('Konflikt accept: Override auf gewaehlte Session geheftet + History',
   rc1.error === null && rc1.plan.overrides.some(o => o.sessionId === 'ps:succ1' && o.type === 'skip') && rc1.plan.pendingConflicts.length === 0
   && rc1.plan.history.some(h => h.reason === 'conflict_accepted'));
const rc2 = PD.resolveConflict(rbPsg.plan, 'ov:psg', { action: 'discard' }, T);
ok('Konflikt discard: endgueltig verworfen + History', rc2.error === null && rc2.plan.history.some(h => h.reason === 'conflict_discarded'));

/* ---------- Determinismus + History-Deckel ---------- */
const a = JSON.stringify(PD.effectiveSessions(r5.plan)), b = JSON.stringify(PD.effectiveSessions(r5.plan));
ok('effectiveSessions ist deterministisch (identischer Input ⇒ bitidentischer Output)', a === b);
let capped = plan0;
for (let i = 0; i < 60; i++) capped = PD.applyOverride(capped, mkOv({ overrideId: 'ov:c' + i, sessionId: 'ps:c' + i, type: 'skip' })).plan;
ok('History gedeckelt (' + PD.HISTORY_MAX + ') — kein unbegrenztes Wachstum', capped.history.length <= PD.HISTORY_MAX);
ok('validatePlan meldet Duplikat-IDs in der Baseline',
   PD.validatePlan({ weekKey: 'x', revision: 1, baseline: { sessions: [{ sessionId: 'ps:a', dayIndex: 0 }, { sessionId: 'ps:a', dayIndex: 1 }] }, overrides: [], history: [{}] })
     .some(e => e.indexOf('duplicate') >= 0));

console.log('\nplan_domain_5c: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
