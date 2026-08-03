/* ============================================================
   ORVIA · Engine 3c · I3 Part B — Kanonischer Plan-Ist-Resolver (Vertragstest A–O)
   Prüft Calc.resolvePlanActual gegen den vollständigen Zustandsautomaten:
   completed | partial | missed | unmatched | ambiguous | unknown.
   Linkage-Prioritäten: (1) explizite occurrenceId (activity.plannedSessionId),
   (2) belegter Fallback via Calc.activityDuplicate ≥ 'mittel', sonst ambiguous/unknown.
   Erfüllung ausschließlich über den bestehenden Calc.planStatus-Vertrag; 'partial'
   nur als Tages-Set-Aggregat (planStatus 'teilweise'), keine erfundene Metrikschwelle.
   node supabase/tests/engine_i3b_plan_actual_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
const base = new URL('../../js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
(0, eval)(readFileSync(new URL('calc.js', base), 'utf8'));
const Calc = globalThis.Calc;
const calcSrc = readFileSync(new URL('calc.js', base), 'utf8');

/* 0) Statischer Schutz: reiner, exportierter Resolver; planStatus/activityDuplicate unverändert nutzbar. */
ok('[0-1] Calc.resolvePlanActual ist exportiert', typeof Calc.resolvePlanActual === 'function');
ok('[0-2] Calc.planStatus weiterhin vorhanden (bestehender Erfüllungsvertrag)', typeof Calc.planStatus === 'function');
ok('[0-3] Calc.activityDuplicate weiterhin vorhanden (bestehender Confidence-Vertrag)', typeof Calc.activityDuplicate === 'function');
ok('[0-4] Resolver mutiert Eingaben nicht (eingefrorene Arrays erlaubt)', (() => {
  const p = Object.freeze([Object.freeze({ occurrenceId: 'po:x', sportId: 'running', localDate: '2026-07-14' })]);
  const a = Object.freeze([Object.freeze({ activityId: 'a1', sportId: 'running', localDate: '2026-07-14', plannedSessionId: 'po:x', load: 300, loadKnown: true })]);
  try { Calc.resolvePlanActual(p, a, { today: '2026-07-15' }); return true; } catch (e) { return false; }
})());

const R = (p, a, o) => Calc.resolvePlanActual(p, a, o);
const byId = (res, pid) => res.results.find(r => r.plannedSessionId === pid);

/* A) Explizite Plan-ID */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:run1', sportId: 'running', localDate: '2026-07-14' }];
  const a = [{ activityId: 'act:1', sportId: 'running', localDate: '2026-07-14', plannedSessionId: 'po:2026-07-14:ps:run1', durationMin: 40, distanceKm: 8, load: 320, loadKnown: true }];
  const r = R(p, a, { today: '2026-07-15' }); const u = byId(r, 'po:2026-07-14:ps:run1');
  ok('[A1] eindeutig, hohe Confidence, dokumentierte Linkmethode', u.state === 'completed' && u.confidence === 'hoch' && u.linkMethod === 'explicit_occurrence_id' && u.activityId === 'act:1', JSON.stringify({ s: u.state, c: u.confidence, m: u.linkMethod }));
  ok('[A2] Aktivität genau einmal verwendet (nicht unmatched)', r.unmatched.length === 0);
}
/* B) Verschobene Einheit */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:runX', sportId: 'running', localDate: '2026-07-14' }];
  const a = [{ activityId: 'act:2', sportId: 'running', localDate: '2026-07-15', plannedSessionId: 'po:2026-07-14:ps:runX', durationMin: 40, load: 300, loadKnown: true }];
  const r = R(p, a, { today: '2026-07-16' }); const u = byId(r, 'po:2026-07-14:ps:runX');
  ok('[B1] Dienstagseinheit erfüllt trotz anderem Tag', u.state === 'completed' && u.linkMethod === 'explicit_occurrence_id');
  ok('[B2] tatsächlicher Aktivitätstag bleibt Mittwoch (15.)', u.actual && u.actual.localDate === '2026-07-15');
  ok('[B3] genau eine Ergebnis-Einheit, kein zusätzlicher Dienstagseintrag', r.results.length === 1);
}
/* C) Zwei geplante Einheiten derselben Sportart, eine Aktivität, kein Link */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:a', sportId: 'running', localDate: '2026-07-14' }, { occurrenceId: 'po:2026-07-14:ps:b', sportId: 'running', localDate: '2026-07-14' }];
  const a = [{ activityId: 'act:3', sportId: 'running', localDate: '2026-07-14', durationMin: 40, distanceKm: 8, load: 320, loadKnown: true }];
  const r = R(p, a, { today: '2026-07-15' }); const ua = byId(r, 'po:2026-07-14:ps:a'), ub = byId(r, 'po:2026-07-14:ps:b');
  ok('[C1] beide ambiguous (keine zufällige Auswahl)', ua.state === 'ambiguous' && ub.state === 'ambiguous', JSON.stringify({ a: ua.state, b: ub.state }));
  ok('[C2] Aktivität keiner Einheit fest zugewiesen', ua.activityId === null && ub.activityId === null);
  ok('[C3] Aktivität als Kandidat gelistet, nicht unmatched', ua.ambiguousCandidateIds.includes('act:3') && r.unmatched.length === 0);
  ok('[C4] ambiguous ⇒ assessable false', ua.assessable === false && ub.assessable === false);
}
/* D) Datum+Sport allein */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:d', sportId: 'running', localDate: '2026-07-14' }];
  const a = [{ activityId: 'act:4', sportId: 'running', localDate: '2026-07-14' }];
  const r = R(p, a, { today: '2026-07-15' }); const u = byId(r, 'po:2026-07-14:ps:d');
  ok('[D1] nicht automatisch completed', u.state !== 'completed');
  ok('[D2] unknown (Datum+Sport allein unzureichend)', u.state === 'unknown', u.state);
  ok('[D3] assessable false', u.assessable === false);
}
/* E) KEIN Metrik-Fallback: nahe Dauer/Distanz = Aktivitäts-Ähnlichkeit (Dedup), KEINE plan-eigene Identität */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:e', sportId: 'running', localDate: '2026-07-14', plannedDurationMin: 40, plannedDistanceKm: 8 }];
  const a = [{ activityId: 'act:5', sportId: 'running', localDate: '2026-07-14', durationMin: 41, distanceKm: 8, load: 328, loadKnown: true }];
  const r = R(p, a, { today: '2026-07-15' }); const u = byId(r, 'po:2026-07-14:ps:e');
  ok('[E1] nahe Metriken ohne plan-eigene Identität ⇒ KEIN automatischer Link (unknown)', u.state === 'unknown' && u.activityId === null, JSON.stringify({ s: u.state, a: u.activityId }));
  ok('[E2] assessable false (im Zweifel kein Link)', u.assessable === false);
}
/* F) Vollständig erfüllt */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:f', sportId: 'running', localDate: '2026-07-14' }];
  const a = [{ activityId: 'act:6', sportId: 'running', localDate: '2026-07-14', plannedSessionId: 'po:2026-07-14:ps:f', durationMin: 45, distanceKm: 9, load: 360, loadKnown: true }];
  ok('[F1] completed', byId(R(p, a, { today: '2026-07-15' }), 'po:2026-07-14:ps:f').state === 'completed');
}
/* G) Teilweise (Tages-Set via planStatus 'teilweise') */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:run', sportId: 'running', localDate: '2026-07-14' }, { occurrenceId: 'po:2026-07-14:ps:gym', sportId: 'gym', localDate: '2026-07-14' }];
  const a = [{ activityId: 'act:7', sportId: 'running', localDate: '2026-07-14', plannedSessionId: 'po:2026-07-14:ps:run', durationMin: 40, load: 320, loadKnown: true }];
  const r = R(p, a, { today: '2026-07-16' });
  ok('[G1] Tages-Aggregat partial (dokumentierter planStatus-Vertrag)', r.byDay['2026-07-14'].status === 'partial', r.byDay['2026-07-14'].planStatusKey);
  ok('[G2] verknüpfte Einheit completed', byId(r, 'po:2026-07-14:ps:run').state === 'completed');
  ok('[G3] nicht verknüpfte vergangene Einheit missed (nicht künstlich partial)', byId(r, 'po:2026-07-14:ps:gym').state === 'missed');
}
/* H) Verpasst + Gegenproben */
{
  const past = [{ occurrenceId: 'po:2026-07-13:ps:h', sportId: 'running', localDate: '2026-07-13' }];
  ok('[H1] sicher vergangen, Quellen vollständig, keine Aktivität ⇒ missed', byId(R(past, [], { today: '2026-07-15' }), 'po:2026-07-13:ps:h').state === 'missed');
  ok('[H2] heutige Einheit NICHT missed', byId(R([{ occurrenceId: 'po:2026-07-15:ps:h', sportId: 'running', localDate: '2026-07-15' }], [], { today: '2026-07-15' }), 'po:2026-07-15:ps:h').state === 'unknown');
  ok('[H3] zukünftige Einheit NICHT missed', byId(R([{ occurrenceId: 'po:2026-07-20:ps:h', sportId: 'running', localDate: '2026-07-20' }], [], { today: '2026-07-15' }), 'po:2026-07-20:ps:h').state === 'unknown');
  ok('[H4] Ruhetag NICHT missed', R([{ occurrenceId: 'po:2026-07-13:ps:rest', sportId: 'running', localDate: '2026-07-13', isRest: true }], [], { today: '2026-07-15' }).results.length === 0);
  ok('[H5] fehlende Activity-Quelle ⇒ unknown, nicht missed', byId(R(past, [], { today: '2026-07-15', activitiesLoaded: false }), 'po:2026-07-13:ps:h').state === 'unknown');
}
/* I) Ungeplante Aktivität */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:i', sportId: 'running', localDate: '2026-07-14' }];
  const a = [{ activityId: 'act:9', sportId: 'cycling', localDate: '2026-07-14', durationMin: 60, load: 300, loadKnown: true }];
  const r = R(p, a, { today: '2026-07-15' });
  ok('[I1] Aktivität ohne passende Einheit ⇒ unmatched', r.unmatched.length === 1 && r.unmatched[0].activityId === 'act:9' && r.unmatched[0].state === 'unmatched');
  ok('[I2] unmatched behält Last', r.unmatched[0].load === 300 && r.unmatched[0].loadKnown === true);
}
/* J) Fehlende Datenquelle */
{
  const p = [{ occurrenceId: 'po:2026-07-13:ps:j', sportId: 'running', localDate: '2026-07-13' }];
  const rNoAct = R(p, [], { today: '2026-07-15', activitiesLoaded: false });
  ok('[J1] Activity-Store fehlt ⇒ unknown, kein missed', byId(rNoAct, 'po:2026-07-13:ps:j').state === 'unknown' && rNoAct.unmatched.length === 0);
  ok('[J2] leeres Array ist KEIN Beweis (kein missed)', rNoAct.results.every(x => x.state !== 'missed'));
  const rNoPlan = R([], [{ activityId: 'act:10', sportId: 'running', localDate: '2026-07-13', load: 200, loadKnown: true }], { today: '2026-07-15', planLoaded: false });
  ok('[J3] Planquelle fehlt ⇒ Aktivitäten unmatched', rNoPlan.unmatched.length === 1 && rNoPlan.results.length === 0);
}
/* K) Dedupe (kanonisch upstream; Resolver zählt je Aktivität einmal) */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:k', sportId: 'running', localDate: '2026-07-14' }];
  const a = [{ activityId: 'act:canon', sportId: 'running', localDate: '2026-07-14', plannedSessionId: 'po:2026-07-14:ps:k', durationMin: 40, load: 320, loadKnown: true }];
  const r = R(p, a, { today: '2026-07-15' });
  const ids = r.results.filter(x => x.activityId).map(x => x.activityId);
  ok('[K1] eine kanonische Aktivität ⇒ eine Erfüllung, eine Last', ids.length === 1 && ids[0] === 'act:canon' && r.unmatched.length === 0);
}
/* L) Nutzerzeitzone (injizierter lokaler Tag) */
{
  const p = [{ occurrenceId: 'po:2026-07-15:ps:l', sportId: 'running', localDate: '2026-07-15' }];
  const a = [{ activityId: 'act:tz', sportId: 'running', localDate: '2026-07-15', plannedSessionId: 'po:2026-07-15:ps:l', durationMin: 40, load: 320, loadKnown: true }];
  ok('[L1] Zuordnung anhand injizierten lokalen Tages (systemunabhängig)', byId(R(p, a, { today: '2026-07-16' }), 'po:2026-07-15:ps:l').state === 'completed');
}
/* M) Ruhetag mit ungeplanter Aktivität */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:rest', sportId: 'running', localDate: '2026-07-14', isRest: true }];
  const a = [{ activityId: 'act:m', sportId: 'cycling', localDate: '2026-07-14', load: 250, loadKnown: true }];
  const r = R(p, a, { today: '2026-07-16' });
  ok('[M1] Ruhetag bleibt Ruhetag (nicht missed, nicht in results)', r.results.length === 0);
  ok('[M2] ungeplante Aktivität am Ruhetag bleibt unmatched', r.unmatched.length === 1 && r.unmatched[0].state === 'unmatched');
}
/* N) Reihenfolgeunabhängigkeit (Property) */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:n1', sportId: 'running', localDate: '2026-07-14' }, { occurrenceId: 'po:2026-07-14:ps:n2', sportId: 'gym', localDate: '2026-07-14' }];
  const a = [{ activityId: 'act:n1', sportId: 'running', localDate: '2026-07-14', plannedSessionId: 'po:2026-07-14:ps:n1', load: 320, loadKnown: true, durationMin: 40 }, { activityId: 'act:n2', sportId: 'gym', localDate: '2026-07-14', plannedSessionId: 'po:2026-07-14:ps:n2', load: 200, loadKnown: true, durationMin: 50 }];
  const norm = r => JSON.stringify({ results: r.results.slice().sort((x, y) => String(x.plannedSessionId).localeCompare(String(y.plannedSessionId))), unmatched: r.unmatched, byDay: r.byDay });
  ok('[N1] identisches Ergebnis bei umgekehrter Reihenfolge', norm(R(p, a, { today: '2026-07-15' })) === norm(R(p.slice().reverse(), a.slice().reverse(), { today: '2026-07-15' })));
}
/* O) One-to-one-Garantie (Property) */
{
  const p = [{ occurrenceId: 'po:2026-07-14:ps:o1', sportId: 'running', localDate: '2026-07-14', plannedDurationMin: 40 }, { occurrenceId: 'po:2026-07-14:ps:o2', sportId: 'running', localDate: '2026-07-14', plannedDurationMin: 40 }];
  const a = [{ activityId: 'act:o', sportId: 'running', localDate: '2026-07-14', durationMin: 40, distanceKm: 8, load: 320, loadKnown: true }];
  const r = R(p, a, { today: '2026-07-15' });
  const assigned = r.results.filter(x => x.activityId).map(x => x.activityId);
  const seen = {}; const dup = assigned.some(id => { if (seen[id]) return true; seen[id] = 1; return false; });
  ok('[O1] keine Activity-ID mehrfach zugeordnet', !dup && assigned.length === 0);
  ok('[O2] beide Einheiten ambiguous (Konkurrenz)', r.results.every(x => x.state === 'ambiguous'));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I3 Part B: ' + (fail === 0 ? 'GRÜN — kanonischer Plan-Ist-Resolver: explizite ID zuerst, belegter Fallback, sonst ambiguous/unknown; fehlende Quelle nie missed; Ruhetag/Zukunft nie missed; One-to-one + reihenfolgeunabhängig.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));
