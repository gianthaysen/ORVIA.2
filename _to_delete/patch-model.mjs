import fs from 'node:fs';
const f = 'app/js/profile-model.js'; let s = fs.readFileSync(f, 'utf8'); let n = 0;
function rep(a, b) { if (!s.includes(a)) throw new Error('anchor: ' + a.slice(0, 80)); s = s.replace(a, b); n++; }
rep(`      result: (raw.result && typeof raw.result === 'object' && !Array.isArray(raw.result)) ? raw.result : null,
      createdAt: raw.createdAt || now,`,
`      result: (raw.result && typeof raw.result === 'object' && !Array.isArray(raw.result)) ? raw.result : null,
      /* S1.5 (Migration 0045): Aenderungsgeschichte des Ziels — append-only, vom Modell selbst geschrieben
         (addGoal/updateGoal), nie vom Editor. Eintrag: {at, type, from, to, forecastMin?} */
      history: normalizeHistory(raw.history),
      createdAt: raw.createdAt || now,`);
rep(`  function addGoal(goals, goalInput, now) { var g = normalizeGoal(goalInput, now); return normalizeGoals((goals || []).concat([g]), now); }
  function updateGoal(goals, id, patch, now) { return normalizeGoals((goals || []).map(function (g) { return g.id === id ? normalizeGoal(Object.assign({}, g, patch, { id: g.id, createdAt: g.createdAt, updatedAt: now || nowISO() }), now) : g; }), now); }`,
`  /* ---- Ziel-Historie (S1.5, 13.09.2026) ---- */
  var HISTORY_TYPES = ['created', 'title', 'target', 'date', 'priority', 'status', 'result', 'milestone'];
  var HISTORY_MAX = 60;
  function normalizeHistory(list) {
    var arr = Array.isArray(list) ? list : [];
    return arr.filter(function (h) { return h && typeof h === 'object' && HISTORY_TYPES.indexOf(h.type) >= 0 && h.at; })
      .map(function (h) { var o = { at: String(h.at), type: h.type }; if (h.from !== undefined) o.from = h.from; if (h.to !== undefined) o.to = h.to; if (h.forecastMin != null) o.forecastMin = h.forecastMin; if (h.note) o.note = String(h.note); return o; })
      .slice(-HISTORY_MAX);
  }
  function _histAt(now) { var d = now ? new Date(now) : new Date(); return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); }
  /* Diff zweier normalisierter Ziele → Historieneintraege (nur Vertragsfelder, nie Kosmetik). */
  function goalHistoryDiff(prev, next, now, meta) {
    var out = [], at = _histAt(now), fc = meta && meta.forecastMin != null ? meta.forecastMin : null;
    function push(type, from, to) { var e = { at: at, type: type, from: from, to: to }; if (fc != null) e.forecastMin = fc; out.push(e); }
    if (!prev) { var c = { at: at, type: 'created', to: { targetValue: next.targetValue, targetDate: next.targetDate, priority: next.priority } }; if (fc != null) c.forecastMin = fc; if (meta && meta.source) c.note = String(meta.source); return [c]; }
    if (String(prev.title || '') !== String(next.title || '')) push('title', prev.title || '', next.title || '');
    if ((prev.targetValue == null ? null : +prev.targetValue) !== (next.targetValue == null ? null : +next.targetValue)) push('target', prev.targetValue == null ? null : +prev.targetValue, next.targetValue == null ? null : +next.targetValue);
    if ((prev.targetDate || null) !== (next.targetDate || null)) push('date', prev.targetDate || null, next.targetDate || null);
    if ((prev.priority || null) !== (next.priority || null)) push('priority', prev.priority || null, next.priority || null);
    if ((prev.status || null) !== (next.status || null)) push('status', prev.status || null, next.status || null);
    var pv = prev.result && prev.result.verdict || null, nv = next.result && next.result.verdict || null;
    if (pv !== nv && nv) push('result', pv, { verdict: nv, timeSec: next.result.timeSec != null ? next.result.timeSec : null, date: next.result.date || null });
    var pm = (prev.milestones || []).length, nm = (next.milestones || []).length;
    if (nm !== pm) push('milestone', pm, nm);
    return out;
  }
  function addGoal(goals, goalInput, now, meta) {
    var g = normalizeGoal(goalInput, now);
    if (!g.history.length) g.history = normalizeHistory(goalHistoryDiff(null, g, now, meta));
    return normalizeGoals((goals || []).concat([g]), now);
  }
  function updateGoal(goals, id, patch, now, meta) {
    return normalizeGoals((goals || []).map(function (g) {
      if (g.id !== id) return g;
      var next = normalizeGoal(Object.assign({}, g, patch, { id: g.id, createdAt: g.createdAt, updatedAt: now || nowISO(), history: g.history }), now);
      var diff = goalHistoryDiff(g, next, now, meta);
      if (diff.length) next.history = normalizeHistory((g.history || []).concat(diff));
      return next;
    }), now);
  }`);
rep(`    addGoal: addGoal, updateGoal: updateGoal, removeGoal: removeGoal,`,
    `    addGoal: addGoal, updateGoal: updateGoal, removeGoal: removeGoal, goalHistoryDiff: goalHistoryDiff, normalizeHistory: normalizeHistory, HISTORY_TYPES: HISTORY_TYPES,`);
fs.writeFileSync(f, s); console.log('model', n);
