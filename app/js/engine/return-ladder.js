/* ============================================================
   ORVIA · engine/return-ladder — Rückkehr-Leiter nach Beschwerde (Stufe D, 14.09.2026)

   WOFÜR. B-09 (absence-replanner) ersetzt bei aktiver Verletzung Laufeinheiten
   durch Mobility — pauschal, ohne Weg zurück. Die Rückkehr nach einer
   Belastungsreaktion ist aber ein Stufenprozess: erst schmerzfrei gehen, dann
   Geh-Lauf, dann kurz locker, dann normal locker, dann Qualität. Jede Stufe
   erst nach Mindesttagen ohne Rückschlag; ein Rückschlag = eine Stufe zurück.

   ZUSTAND liegt an der Beschwerde im Profil (constraintsList):
     returnStage      0..5 (fehlt ⇒ 0 bei aktiver Verletzung)
     returnStageSince ISO-Datum des Stufenbeginns
     returnLog        [{at, from, to, why}] append-only (max. 40)
   Das Modul ist REIN: heute, Schmerztage und die Beschwerde werden injiziert;
   es schreibt nichts und kennt kein DOM.

   STUFEN (Coaching-Konsens fuer Rueckkehr nach Ueberlastung der unteren Extremitaet;
   die Mindesttage sind konservative Annahmen, keine Messwerte):
     0 Schonung        Gehen nur bis zur Schmerzschwelle · kein Laufen, keine Beinkraft
     1 Gehen frei      schmerzfrei ueber die Ausloeseschwelle gehen (3 Tage)
     2 Geh-Lauf        Geh-Lauf-Intervalle 20 min (4 Tage)
     3 Locker kurz     lockere Laeufe 20–30 min (4 Tage)
     4 Locker normal   normale lockere Einheiten, langer Lauf kurz (5 Tage)
     5 Frei            Qualitaet wieder frei — Leiter abgeschlossen
   Rueckschlag: Schmerz >= 5 (Check-in) oder Nutzerangabe ⇒ Stufe −1, Zaehler neu.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'return-ladder@1';
  var DAY = 864e5, LOG_MAX = 40, SETBACK_PAIN = 5;

  var STAGES = [
    { id: 0, key: 'rest',      minDays: 0, policy: { run: 'none',       legStrength: false, impact: false } },
    { id: 1, key: 'walk',      minDays: 3, policy: { run: 'none',       legStrength: false, impact: false } },
    { id: 2, key: 'walkrun',   minDays: 4, policy: { run: 'walkrun',    legStrength: false, impact: true } },
    { id: 3, key: 'easyshort', minDays: 4, policy: { run: 'easy_short', legStrength: true,  impact: true } },
    { id: 4, key: 'easy',      minDays: 5, policy: { run: 'easy',       legStrength: true,  impact: true } },
    { id: 5, key: 'free',      minDays: 0, policy: { run: 'all',        legStrength: true,  impact: true } }
  ];

  function _int(v) { var n = parseInt(v, 10); return isNaN(n) ? null : n; }
  function _d(iso) { var t = Date.parse(String(iso || '').slice(0, 10) + 'T12:00:00Z'); return isNaN(t) ? null : t; }
  function stageOf(c) { var s = c ? _int(c.returnStage) : null; if (s == null || s < 0) return 0; return Math.min(5, s); }
  function stageDef(n) { return STAGES[Math.max(0, Math.min(5, _int(n) || 0))]; }
  function policyFor(c) { return stageDef(stageOf(c)).policy; }

  /* evaluate(c, {today, painDays:[{date, pain}]}) → Lage der Leiter fuer die Anzeige/Entscheidung */
  function evaluate(c, opts) {
    var o = opts || {}, stage = stageOf(c), def = stageDef(stage), today = _d(o.today), since = _d(c && c.returnStageSince);
    var daysIn = (today != null && since != null) ? Math.max(0, Math.floor((today - since) / DAY)) : 0;
    var pains = (Array.isArray(o.painDays) ? o.painDays : []).filter(function (p) { return p && p.pain != null && _d(p.date) != null && (since == null || _d(p.date) >= since); });
    var maxPain = pains.reduce(function (m, p) { return Math.max(m, +p.pain); }, 0);
    var setback = pains.some(function (p) { return +p.pain >= SETBACK_PAIN; });
    var next = stage < 5 ? stageDef(stage + 1) : null;
    var blockers = [];
    if (stage >= 5) blockers.push('done');
    else {
      if (daysIn < def.minDays) blockers.push('min_days');
      if (setback) blockers.push('pain_in_stage');
    }
    return { version: VERSION, stage: stage, key: def.key, since: since != null ? new Date(since).toISOString().slice(0, 10) : null, daysInStage: daysIn,
      minDays: def.minDays, next: next ? { stage: next.id, key: next.key, minDays: next.minDays } : null,
      canAdvance: blockers.length === 0, blockers: blockers, setbackSuggested: setback, maxPainInStage: maxPain,
      policy: def.policy, estimatedDaysToFree: estimateDaysToFree(stage, daysIn) };
  }
  /* Restdauer bis Stufe 5 bei fehlerfreiem Verlauf (Mindesttage) */
  function estimateDaysToFree(stage, daysIn) {
    var s = Math.max(0, Math.min(5, _int(stage) || 0)), sum = 0;
    for (var i = s; i < 5; i++) sum += STAGES[i].minDays;
    return Math.max(0, sum - (daysIn || 0));
  }
  function _log(c, entry) { var log = Array.isArray(c.returnLog) ? c.returnLog.slice() : []; log.push(entry); return log.slice(-LOG_MAX); }
  /* advance/setback liefern eine KOPIE der Beschwerde; der Aufrufer persistiert. */
  function advance(c, today, why) {
    var s = stageOf(c); if (s >= 5) return Object.assign({}, c);
    var n = Object.assign({}, c, { returnStage: s + 1, returnStageSince: String(today || '').slice(0, 10) });
    n.returnLog = _log(c, { at: String(today || '').slice(0, 10), from: s, to: s + 1, why: why || 'advance' });
    if (s + 1 >= 5) { n.status = c.status === 'active' ? 'improved' : c.status; }
    return n;
  }
  function setback(c, today, why) {
    var s = stageOf(c), t = Math.max(0, s - 1);
    var n = Object.assign({}, c, { returnStage: t, returnStageSince: String(today || '').slice(0, 10), status: 'active' });
    n.returnLog = _log(c, { at: String(today || '').slice(0, 10), from: s, to: t, why: why || 'setback' });
    return n;
  }
  function start(c, today) { return Object.assign({}, c, { returnStage: stageOf(c), returnStageSince: c && c.returnStageSince ? c.returnStageSince : String(today || '').slice(0, 10) }); }

  var api = { VERSION: VERSION, STAGES: STAGES, SETBACK_PAIN: SETBACK_PAIN, stageOf: stageOf, stageDef: stageDef, policyFor: policyFor, evaluate: evaluate, advance: advance, setback: setback, start: start, estimateDaysToFree: estimateDaysToFree };
  O.returnLadder = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
