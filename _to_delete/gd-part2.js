
  /* ---------- Modell ---------- */
  function buildModel(o) {
    o = o || {};
    var g = o.goal || null; if (!g || typeof g !== 'object') return null;
    var pi = o.planInput || null, t = (pi && pi.target) || {};
    var lab = typeof o.catLabel === 'function' ? o.catLabel : function (c) { return c; };
    var title = (g.title || '').trim(); if (!title || /^-?\d+([.,]\d+)?\s*(%|kg|km|min|h|s)?$/i.test(title)) title = lab(g.category) || title || T('common.goal');
    var m = { version: VERSION, id: g.id || null, title: title, category: g.category || null, categoryLabel: lab(g.category) || null, family: pi ? pi.family : null,
      isMain: !!o.isMain, priority: g.priority || null, status: g.status || 'active',
      targetText: null, targetSub: null, dateText: deDate(g.targetDate), targetDate: g.targetDate || null, daysTo: pi ? pi.daysTo : (g.targetDate && o.today ? daysBetween(o.today, g.targetDate) : null),
      weeksTo: null, phase: pi ? pi.phase : null, phaseLabel: pi && pi.phase ? (PHASES.indexOf(pi.phase) >= 0 ? T('goal.phase.' + pi.phase) : pi.phase) : null,
      distanceKm: (pi && pi.distanceKm > 0) ? pi.distanceKm : null, distKey: null,
      progress: { kind: null, currentText: null, targetText: null, percent: null, note: null, state: null },
      feas: null, reasons: [], contract: null, baseline: null, forecast: null, series: [], plan: null, levers: [], milestones: [], keyWeeks: [], history: [], conflicts: [],
      feasibilityText: null, feasibilityWarn: false, gaps: [], race: raceModel(g, o.raceMatch || null) };
    if (m.daysTo != null) m.weeksTo = Math.max(0, Math.ceil(m.daysTo / 7));
    if (!m.distanceKm && m.category) { var CK = { half_marathon: HM_KM, marathon: 42.195, run_10k: 10, run_5k: 5 }; if (CK[m.category]) m.distanceKm = CK[m.category]; }
    if (m.distanceKm) { var bk = null, bd = Infinity; Object.keys(DIST_KM).forEach(function (k) { var d = Math.abs(Math.log(DIST_KM[k] / m.distanceKm)); if (d < bd) { bd = d; bk = k; } }); if (bd < 0.05) m.distKey = bk; }

    /* Zielwert */
    if (t.targetMin != null) { m.targetText = fmtTime(t.targetMin); m.targetSub = (m.distanceKm ? T('gd.on_km', { km: fmtDe(m.distanceKm, 1) }) : '') + (t.pacePerKmSec ? (m.distanceKm ? '<br>' : '') + '= ' + fmtPace(t.pacePerKmSec) : ''); }
    else if (num(g.targetValue) != null || (typeof g.targetValue === 'string' && g.targetValue !== '')) { m.targetText = fmtGoalValue(g, +g.targetValue); }

    /* Fortschritt (Bestand, fuer Balken + Wertziele) */
    var e = o.engine || null;
    if (t.targetMin != null && e && e.tPred > 0 && e.state !== 'nodata') {
      m.progress.kind = 'time'; m.progress.currentText = fmtTime(e.tPred); m.progress.targetText = fmtTime(t.targetMin);
      m.progress.percent = Math.max(0, Math.min(100, Math.round((t.targetMin / e.tPred) * 100)));
      m.progress.state = (e.state === 'ontrack' || e.state === 'border' || e.state === 'risk') ? e.state : null;
      m.progress.note = T('goal.progress.timeNote');
    } else if (t.targetMin != null) {
      m.progress.kind = 'time'; m.progress.targetText = fmtTime(t.targetMin);
      m.progress.note = e && e.need ? T('goal.progress.noForecastNeed', { need: e.need }) : T('goal.progress.noForecast');
    } else if (num(g.targetValue) != null && num(g.currentValue) != null) {
      m.progress.kind = 'value'; m.progress.currentText = fmtGoalValue(g, g.currentValue); m.progress.targetText = fmtGoalValue(g, g.targetValue);
      var lower = /loss|fat|bodyfat|shredded/.test(String(g.category || ''));
      var pct = lower ? (g.currentValue <= g.targetValue ? 100 : Math.round((g.targetValue / g.currentValue) * 100)) : (g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : null);
      m.progress.percent = pct == null ? null : Math.max(0, Math.min(100, pct));
      m.progress.note = lower ? T('goal.progress.valueNoteLower') : T('goal.progress.valueNote');
    } else m.progress.note = num(g.targetValue) != null ? T('goal.progress.noCurrent') : T('goal.progress.noTarget');

    /* Ausgangswert: naechste gemessene Bestzeit → Riegel auf Zieldistanz */
    if (m.distanceKm && o.bests && o.bests.real) {
      var best = null, bdist = Infinity;
      Object.keys(DIST_KM).forEach(function (k) { var tk = 't' + k.slice(1); if (!o.bests.real[k] || num(o.bests[tk]) == null) return; var d = Math.abs(Math.log(DIST_KM[k] / m.distanceKm)); if (d < bdist) { bdist = d; best = k; } });
      if (best) { var tk2 = 't' + best.slice(1), sec = o.bests[tk2], meas = o.bests.meas && o.bests.meas[best]; m.baseline = { key: best, label: DIST_LBL[best], sec: sec, date: meas && meas.date ? meas.date : null, equivMin: riegel(DIST_KM[best], sec / 60, m.distanceKm), same: best === m.distKey }; }
    }

    /* Machbarkeit */
    var f = o.feasibility || null;
    if (f && f.evaluated === true && FEAS_KEY[f.status]) { m.feasibilityText = T(FEAS_KEY[f.status]); m.feasibilityWarn = f.status === 'outside_modeled_corridor'; }
    if (t.targetMin != null) {
      if (e && e.state !== 'nodata' && num(e.tPred) != null) {
        var cls = e.state === 'ontrack' ? 'ok' : (e.state === 'border' ? 'tight' : (e.state === 'risk' ? 'risk' : 'ok'));
        var dSec = Math.round((e.tPred - t.targetMin) * 60);
        m.feas = { cls: cls, title: T('gd.feas_' + cls), text: T(dSec > 0 ? 'gd.feas_over' : 'gd.feas_under', { pred: fmtTime(e.tPred), delta: fmtSec(dSec) }), predMin: e.tPred, deltaSec: dSec };
      } else m.feas = { cls: 'none', title: T('gd.feas_none'), text: e && e.need ? T('goal.progress.noForecastNeed', { need: e.need }) : T('goal.progress.noForecast'), predMin: null, deltaSec: null };
      m.reasons = feasReasons(o, m);
    } else if (m.progress.kind === 'value') {
      m.feas = { cls: m.progress.percent >= 100 ? 'ok' : 'none', title: m.progress.percent >= 100 ? T('gd.feas_value_done') : T('gd.feas_value'), text: m.progress.currentText + ' → ' + m.progress.targetText, predMin: null, deltaSec: null };
    }

    /* Zielvertrag (beschreibt die tatsaechlichen Regeln von engine/race-result) */
    if (t.targetMin != null && m.distanceKm) {
      m.contract = { kind: 'race', lines: [
        { ic: 'shield', html: T('gd.c_achieved_race', { km: fmtDe(m.distanceKm, 1), date: m.dateText || T('common.noDate'), time: fmtTime(t.targetMin) }) },
        m.baseline ? { ic: 'gauge', html: T('gd.c_baseline', { dist: m.baseline.label, time: fmtSec(m.baseline.sec), date: m.baseline.date ? ' (' + deDate(m.baseline.date) + ')' : '', equiv: fmtTime(m.baseline.equivMin), km: fmtDe(m.distanceKm, 1) }) } : { ic: 'gauge', html: T('gd.c_baseline_none') },
        { ic: 'info', html: T('gd.c_fail') },
        { ic: 'alert', html: T('gd.c_counts', { km: fmtDe(m.distanceKm, 1) }) }] };
    } else if (num(g.targetValue) != null) {
      m.contract = { kind: 'value', lines: [{ ic: 'shield', html: T('gd.c_achieved_value', { v: fmtGoalValue(g, +g.targetValue) }) }, { ic: 'info', html: T('gd.c_value_source') }] };
    }

    /* Prognoseverlauf */
    if (Array.isArray(o.series) && o.series.some(function (p) { return p.tPred != null; })) m.series = o.series;
    if (e && e.state !== 'nodata') m.forecast = { nRuns: e.nRuns, nQuality: e.nQuality, ef: num(e.tEF) != null };

    /* Plan dieser Woche */
    if (Array.isArray(o.weekPlan)) m.plan = { units: o.weekPlan.slice(0, 8), count: o.weekPlan.length };

    /* Stellschrauben — nur, was die Goal-Engine tatsaechlich als Bedingung fuehrt */
    m.reasons.forEach(function (r) { if (r.kind !== 'minus' || m.levers.length >= 2) return; m.levers.push({ html: r.html, effect: T('gd.lever_effect') }); });

    /* Meilensteine (+ Renntag als letzter Punkt) */
    var ms = Array.isArray(g.milestones) ? g.milestones.slice() : [];
    m.milestones = ms.map(function (x) { return { title: x.title || x.label || '', date: x.targetDate || null, status: x.status || 'planned', value: x.targetValue != null ? fmtGoalValue(x, x.targetValue) : null }; });
    if (g.targetDate && m.contract && m.contract.kind === 'race') m.milestones.push({ title: T('gd.ms_race', { cat: m.categoryLabel || '' }), date: g.targetDate, status: m.race && m.race.verdict ? 'achieved' : (m.daysTo != null && m.daysTo < 0 ? 'skipped' : 'planned'), value: null, race: true });

    /* Einzahlungen */
    if (o.runs && o.today) m.keyWeeks = keyWeeks(o);

    /* Historie (Modell-Eintraege) + angelegt */
    var hist = Array.isArray(g.history) ? g.history.slice() : [];
    if (!hist.some(function (h) { return h.type === 'created'; }) && g.createdAt) hist.unshift({ at: g.createdAt, type: 'created', to: {} });
    m.history = hist.slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).map(function (h) { return { date: deShort(String(h.at).slice(0, 10)) || '', html: histText(h, g), type: h.type }; });

    /* Wechselwirkungen */
    m.conflicts = (Array.isArray(o.conflicts) ? o.conflicts : []).filter(function (c) { return c && (c.goalIds || []).indexOf(g.id) >= 0; }).map(function (c) {
      var other = (c.goalIds || []).filter(function (id) { return id !== g.id; }).map(function (id) { var x = (o.goals || []).filter(function (y) { return y && y.id === id; })[0]; return x ? (x.title || lab(x.category)) : id; });
      return { title: T('gd.conflict_with', { name: other.join(', ') }), text: c.explanation || '' }; });

    var s = o.strength || null;
    if (s && Array.isArray(s.gaps)) m.gaps = s.gaps.filter(function (x) { return x && (x.action === 'goal_editor' || x.id === 'performance_reference' || x.id === 'goal_missing'); });
    return m;
  }

  function histText(h, g) {
    var fv = function (v) { return v == null ? '—' : fmtGoalValue(g, v); };
    var fc = h.forecastMin != null ? ' ' + T('gd.h_forecast', { t: fmtTime(h.forecastMin) }) : '';
    switch (h.type) {
      case 'created': return T('gd.h_created', { v: h.to && h.to.targetValue != null ? fv(h.to.targetValue) : '', prio: h.to && h.to.priority ? h.to.priority : '' }) + (h.note ? ' · ' + esc(h.note) : '') + fc;
      case 'target': return T(h.to != null && h.from != null && +h.to < +h.from ? 'gd.h_target_tighter' : 'gd.h_target', { from: fv(h.from), to: fv(h.to) }) + fc;
      case 'date': return T('gd.h_date', { from: deDate(h.from) || '—', to: deDate(h.to) || '—' }) + fc;
      case 'priority': return T('gd.h_priority', { from: h.from || '—', to: h.to || '—' });
      case 'status': return T('gd.h_status', { to: T('goal.status.' + h.to) }) + fc;
      case 'result': return T('gd.h_result', { verdict: T('goal.race.' + (h.to && h.to.verdict || 'finished')), time: h.to && h.to.timeSec != null ? fmtSec(h.to.timeSec) : '—' });
      case 'milestone': return T('gd.h_milestone', { n: h.to });
      case 'title': return T('gd.h_title', { to: esc(h.to) });
      default: return esc(h.type);
    }
  }

  /* S1/E2 (13.09.2026): Wettkampf am Ziel — bestaetigtes Ergebnis oder erkannte Aktivitaet. */
  function raceModel(g, match) {
    var r = g && g.result && g.result.verdict ? g.result : null;
    if (r) return { kind: 'result', verdict: r.verdict, timeText: fmtSec(r.timeSec), deltaText: r.deltaSec != null ? ((r.deltaSec <= 0 ? '−' : '+') + fmtSec(r.deltaSec)) : null, distanceKm: r.distanceKm, date: r.date, activityId: r.activityId };
    if (match) return { kind: 'match', verdict: match.verdict, timeText: fmtSec(match.timeSec), deltaText: match.deltaSec != null ? ((match.deltaSec <= 0 ? '−' : '+') + fmtSec(match.deltaSec)) : null, distanceKm: match.distanceKm, date: match.date, activityId: match.activityId };
    return null;
  }
