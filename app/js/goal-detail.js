/* ============================================================
   ORVIA · goal-detail — Ziel-Detailseite (B-02 → S1.5, Prototyp v14)

   WOFÜR. Die Seite, an der der Nutzer die Qualität der App beurteilt: Zielzeit,
   Machbarkeit mit benannten Gründen, Zielvertrag, Prognoseverlauf, was der Plan
   daraus macht, Stellschrauben, Meilensteine, Einzahlungen, Historie,
   Wechselwirkungen, Verwaltung. Vorbild: Prototyp v14 (pgGoal).

   REGELN.
   - buildModel() ist rein: alles wird injiziert, jede Zahl hat eine Quelle im
     Modell (o.engine = Calc.goalEngine, o.bests = bestTimes(), o.runs = runsWindow,
     o.weekPlan = activeWeekPlan, o.goals = listGoals, o.conflicts = detectGoalConflicts).
   - NICHTS wird erfunden: fehlt eine Quelle, sagt der Block, was fehlt. Der
     Zielanteil je Einheit und die Sekunden-Wirkung von Stellschrauben kommen
     erst mit der Plan-Engine (S3) — bis dahin stehen dort ehrliche Platzhalter.
   - forecastSeries() rechnet die Prognose der Goal-Engine für vergangene
     Wochen NEU (gleicher Schätzer, Fenster bis zum jeweiligen Stichtag) — das
     ist ein Verlauf, keine Aufzeichnung.
   - Schreiben nur über bestehende Wege (openGoalEditor, goalSetStatus,
     goalReactivate, goalMakeMain, goalConfirmResult/DismissRace). Kein
     zweiter Schreibpfad.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'goal-detail@2';
  var PHASES = ['build', 'taper', 'race_week', 'past'];
  var FEAS_KEY = { within_modeled_corridor: 'goal.feas.within', outside_modeled_corridor: 'goal.feas.outside', insufficient_data: 'goal.feas.insufficient' };
  var HM_KM = 21.0975, RIEGEL = 1.06, KEY_SUBS = { 'Tempo': 1, 'Long Run': 1, 'Intervalle': 1 };
  var DIST_KM = { k1: 1, k5: 5, k10: 10, k21: HM_KM, k42: 42.195 }, DIST_LBL = { k1: '1 km', k5: '5 km', k10: '10 km', k21: 'HM', k42: 'Marathon' };

  function T(k, p) { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ic(name, size) { try { if (typeof root.icon === 'function') return root.icon(name, size || 'sm'); } catch (e) {} return ''; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function fmtTime(min) { if (!(min > 0)) return null; var s = Math.round(min * 60), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); }
  function fmtSec(sec) { if (num(sec) == null) return '—'; sec = Math.round(Math.abs(sec)); var h = Math.floor(sec / 3600), mi = Math.floor((sec % 3600) / 60), s = sec % 60; return (h ? h + ':' + String(mi).padStart(2, '0') : String(mi)) + ':' + String(s).padStart(2, '0'); }
  function fmtPace(sec) { if (!(sec > 0)) return null; var m = Math.floor(sec / 60), s = Math.round(sec % 60); if (s === 60) { m++; s = 0; } return m + ':' + String(s).padStart(2, '0') + ' /km'; }
  function fmtDe(n, d) { if (num(n) == null) return '—'; return (d != null ? n.toFixed(d) : String(Math.round(n * 10) / 10)).replace('.', ','); }
  function fmtGoalValue(g, v) { try { var M = O.profileModel; if (M && typeof M.formatGoalValue === 'function') return M.formatGoalValue(g, v); } catch (e) {} if (g && (g.metricType === 'time' || g.unit === 's') && num(+v) != null) return fmtSec(+v) + (v >= 3600 ? ' h' : ''); return v == null ? '' : String(v) + (g && g.unit ? ' ' + g.unit : ''); }
  function deDate(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? (m[3] + '.' + m[2] + '.' + m[1]) : null; }
  function deShort(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? (m[3] + '.' + m[2] + '.') : null; }
  function riegel(distKm, min, targetKm) { return min * Math.pow(targetKm / distKm, RIEGEL); }
  function isoAdd(iso, days) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }

  /* ---------- Machbarkeit: Gruende aus Engine + Daten ---------- */
  function feasReasons(o, m) {
    var out = [], e = o.engine || null, t = (o.planInput && o.planInput.target) || {}, distKm = m.distanceKm;
    /* Wochenumfang gegen Soll */
    if (num(o.avg4WeekKm) != null && num(o.targetWeekKm) != null) {
      var okVol = o.avg4WeekKm >= 0.75 * o.targetWeekKm;
      out.push({ id: 'volume', kind: okVol ? 'plus' : 'minus', html: T(okVol ? 'gd.r_volume_ok' : 'gd.r_volume_low', { have: fmtDe(o.avg4WeekKm, 0), need: fmtDe(o.targetWeekKm, 0) }), lever: okVol ? null : T('gd.l_volume', { need: fmtDe(Math.ceil(0.75 * o.targetWeekKm), 0), have: fmtDe(o.avg4WeekKm, 0) }) });
    } else out.push({ kind: 'neutral', html: T('gd.r_volume_unknown') });
    /* Bestzeit-Aequivalent */
    if (m.baseline && t.targetMin != null) {
      var okB = m.baseline.equivMin <= t.targetMin;
      if (m.baseline.same) out.push({ id: 'best', kind: okB ? 'plus' : 'minus', html: T(okB ? 'gd.r_best_same_ok' : 'gd.r_best_same_slow', { dist: m.baseline.label, time: fmtSec(m.baseline.sec), delta: fmtSec(Math.abs(m.baseline.sec - t.targetMin * 60)) }) });
      else out.push({ id: 'best', kind: okB ? 'plus' : 'minus', html: T(okB ? 'gd.r_best_ok' : 'gd.r_best_slow', { dist: m.baseline.label, time: fmtSec(m.baseline.sec), equiv: fmtTime(m.baseline.equivMin) }) });
    }
    /* Laengster Lauf gegen Bedarf (Regel wie Calc.goalEngine: >28 Tage 14 km·Skala, >14 Tage 17 km·Skala) */
    if (distKm && m.daysTo != null && m.daysTo > 14) {
      var need = Math.round((m.daysTo > 28 ? 14 : 17) * (distKm / HM_KM)), have = num(o.longestRun28);
      if (have != null) out.push({ id: 'long', kind: have >= need ? 'plus' : 'minus', html: T(have >= need ? 'gd.r_long_ok' : 'gd.r_long_short', { have: fmtDe(have, 1), need: need }), lever: have >= need ? null : T('gd.l_long', { need: need, have: fmtDe(have, 1) }) });
    }
    /* Schluesseleinheiten je Woche (42 Tage) gegen Plan */
    if (e && num(e.nQuality) != null && e.state !== 'nodata') {
      var perWeek = Math.round(e.nQuality / 6 * 10) / 10, planned = num(o.plannedKeyPerWeek);
      var okK = planned == null ? perWeek >= 1 : perWeek >= planned * 0.8;
      out.push({ id: 'key', kind: okK ? 'plus' : 'minus', html: T(planned != null ? (okK ? 'gd.r_key_ok_plan' : 'gd.r_key_low_plan') : (okK ? 'gd.r_key_ok' : 'gd.r_key_low'), { have: fmtDe(perWeek, 1), plan: planned != null ? fmtDe(planned, 1) : '' }), lever: okK ? null : T('gd.l_key', { plan: planned != null ? fmtDe(planned, 1) : '1', have: fmtDe(perWeek, 1) }) });
    }
    /* CTL-Trend (nur wenn Engine es hart bewertet) */
    if (e && Array.isArray(e.vetos)) e.vetos.forEach(function (v) { if (/Fitness/.test(String(v))) out.push({ id: 'ctl', kind: 'minus', html: T('gd.r_ctl_flat'), lever: T('gd.l_ctl') }); });
    /* Unsicherheit */
    if (e && e.state !== 'nodata' && num(e.tPred) != null) {
      var spread = (num(e.tRiegel) != null && num(e.tEF) != null) ? Math.abs(e.tRiegel - e.tEF) : null;
      var raced = !!(o.bests && o.bests.real && m.distKey && o.bests.real[m.distKey]);
      out.push({ kind: 'neutral', html: raced ? T('gd.r_unc_raced', { pm: spread != null ? '± ' + fmtSec(spread * 60 / 2) : '' }) : T('gd.r_unc_noraced', { pm: spread != null ? ' — ' + T('gd.r_unc_spread', { pm: fmtSec(spread * 60 / 2) }) : '' }) });
    }
    return out;
  }

  /* ---------- Prognoseverlauf: Goal-Engine je Stichtag neu gerechnet ---------- */
  function forecastSeries(o) {
    var C = o.calc || root.Calc, runs = Array.isArray(o.runs) ? o.runs : [];
    if (!C || !C.goalEngine || !runs.length || !o.today) return [];
    var weeks = o.weeks || 12, out = [], first = runs.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })[0];
    for (var w = weeks; w >= 0; w--) {
      var cut = isoAdd(o.today, -7 * w), from42 = isoAdd(cut, -41), from28 = isoAdd(cut, -27);
      var win = runs.filter(function (r) { return r.date >= from42 && r.date <= cut && r.dist > 0 && r.dur > 0; });
      if (!win.length) { out.push({ date: cut, tPred: null }); continue; }
      var lr = 0; runs.forEach(function (r) { if (r.date >= from28 && r.date <= cut) { var d = num(r.longestKm) != null ? r.longestKm : r.dist; if (d > lr) lr = d; } });
      var prevW = [1, 2, 3, 4].map(function (i) { var a = isoAdd(cut, -7 * i - 6), b = isoAdd(cut, -7 * i); return runs.filter(function (r) { return r.date >= a && r.date <= b; }).reduce(function (s, r) { return s + (r.dist || 0); }, 0); });
      var daysToRace = o.raceDate ? daysBetween(cut, o.raceDate) : 99;
      var trackingWeeks = first ? Math.floor(daysBetween(String(first.date), cut) / 7) : 0;
      var res = null;
      try { res = C.goalEngine(win, { daysToRace: daysToRace, targetMin: o.targetMin, distanceKm: o.distanceKm || null, strictTarget: true, avg4WeekKm: prevW.reduce(function (a, b) { return a + b; }, 0) / 4, targetWeekKm: C.weekKmTarget ? C.weekKmTarget(daysToRace, 0) : null, lrMax28: lr, ctlNow: null, ctlPrev28: null, trackingWeeks: trackingWeeks, loadConfidence: 'not_assessable' }); } catch (e) { res = null; }
      out.push({ date: cut, tPred: res && res.state !== 'nodata' && num(res.tPred) != null ? res.tPred : null, state: res ? res.state : null });
    }
    return out;
  }

  /* ---------- Einzahlungen: Schluesseleinheiten je Kalenderwoche ---------- */
  function keyWeeks(o) {
    var runs = Array.isArray(o.runs) ? o.runs : [], today = o.today; if (!today) return [];
    var anc = new Date(today + 'T12:00:00Z'), dow = (anc.getUTCDay() + 6) % 7, out = [];
    for (var i = 3; i >= 0; i--) {
      var mon = isoAdd(today, -dow - 7 * i), sun = isoAdd(mon, 6);
      var done = runs.filter(function (r) { return r.date >= mon && r.date <= sun && KEY_SUBS[r.sub] && r.dist >= 4; }).length;
      out.push({ from: mon, to: sun, label: deShort(mon).replace(/\.$/, '') + '–' + deShort(sun), done: done, planned: num(o.plannedKeyPerWeek), current: i === 0 });
    }
    return out;
  }

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
    m.reasons.forEach(function (r) { if (r.kind !== 'minus' || !r.lever || m.levers.length >= 2) return; m.levers.push({ id: r.id, html: r.lever, effect: T('gd.lever_effect') }); });

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
      case 'created': return T('gd.h_created', { v: h.to && h.to.targetValue != null ? T('gd.h_with', { v: fv(h.to.targetValue) }) : '', prio: h.to && h.to.priority ? h.to.priority : '—' }) + (h.note ? ' · ' + esc(h.note) : '') + fc;
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
  function fmtNum(n) { return (typeof n === 'number') ? String(Math.round(n * 100) / 100).replace('.', ',') : String(n == null ? '' : n); }
  function raceHTML(m) {
    var r = m.race; if (!r) return '';
    var verdict = T('goal.race.' + r.verdict);
    var line = esc(fmtNum(r.distanceKm) + ' km · ' + r.timeText + (r.deltaText ? ' · ' + r.deltaText : '') + (r.date ? ' · ' + (deDate(r.date) || r.date) : ''));
    if (r.kind === 'result') return '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.race.title')) + '</div><div class="gd-race gd-race-' + esc(r.verdict) + '"><b>' + esc(verdict) + '</b> · ' + line + '</div></div>';
    return '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.race.detected')) + '</div><div class="gd-race gd-race-match">' + line + (r.verdict !== 'finished' ? ' · ' + esc(verdict) : '') +
      '<div class="gd-race-acts"><button type="button" class="btn" id="gd-race-ok">' + esc(T('goal.race.confirm')) + '</button><button type="button" class="btn sec" id="gd-race-no">' + esc(T('goal.race.dismiss')) + '</button></div></div></div>';
  }
  function sect(title, action) { return '<div class="sectlabel">' + esc(title) + (action ? ' <span class="edit" role="button" tabindex="0" id="' + action.id + '">' + action.label + '</span>' : '') + '</div>'; }

  function seriesSVG(m) {
    var pts = m.series.filter(function (p) { return p.tPred != null; }); if (pts.length < 2) return '';
    var tMin = null; try { tMin = m.feas && m.feas.predMin != null && m.feas.deltaSec != null ? m.feas.predMin - m.feas.deltaSec / 60 : null; } catch (e) {}
    var vals = pts.map(function (p) { return p.tPred; }).concat(tMin != null ? [tMin] : []);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if (hi - lo < 2) { lo -= 1; hi += 1; } var pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
    var W = 320, H = 110, n = m.series.length, x = function (i) { return 8 + (W - 16) * (i / Math.max(1, n - 1)); }, y = function (v) { return 8 + (H - 16) * ((v - lo) / (hi - lo)); };
    var d = '', first = true; m.series.forEach(function (p, i) { if (p.tPred == null) return; d += (first ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(p.tPred).toFixed(1) + ' '; first = false; });
    var last = null; for (var i = m.series.length - 1; i >= 0; i--) if (m.series[i].tPred != null) { last = i; break; }
    var tl = tMin != null ? '<line x1="0" y1="' + y(tMin).toFixed(1) + '" x2="' + W + '" y2="' + y(tMin).toFixed(1) + '" stroke="rgba(201,174,124,.55)" stroke-width="1.4" stroke-dasharray="4 4"/><text x="' + (W - 4) + '" y="' + (y(tMin) - 4).toFixed(1) + '" text-anchor="end" fill="#E0CB9E" font-size="8.5" font-weight="700">' + esc(T('gd.svg_target', { t: fmtTime(tMin) })) + '</text>' : '';
    return '<div class="gd-corr"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + tl + '<path d="' + d.trim() + '" fill="none" stroke="#43D693" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      (last != null ? '<circle cx="' + x(last).toFixed(1) + '" cy="' + y(m.series[last].tPred).toFixed(1) + '" r="4" fill="#43D693" stroke="#0b131e" stroke-width="2"/>' : '') + '</svg></div>' +
      '<div class="gd-corrlbl"><span>' + esc(deShort(m.series[0].date) || '') + '</span><span>' + esc(T('gd.today')) + '</span></div>';
  }

  function html(m) {
    if (!m) return '<p class="muted">' + esc(T('goal.detail.none')) + '</p>';
    var p = m.progress, h = '<div class="gd gd2">';
    /* Hero */
    h += '<div class="gd-hero"><div class="gd-kick">' + esc(p.kind === 'time' ? T('gd.kick_time') : T('goal.detail.target')) + '</div>' +
      '<div class="gd-target"><div class="tv">' + esc(m.targetText || T('common.open')) + '</div>' + (m.targetSub ? '<div class="tl">' + m.targetSub + '</div>' : '') + '</div>' +
      '<div class="gd-cd"><div><b>' + esc(m.daysTo != null ? (m.daysTo >= 0 ? m.daysTo : '—') : '—') + '</b><span>' + esc(T('gd.days')) + '</span></div><div><b>' + esc(m.weeksTo != null && m.daysTo >= 0 ? m.weeksTo : '—') + '</b><span>' + esc(T('gd.weeks')) + '</span></div><div><b>' + esc(m.dateText ? deShort(m.targetDate) : '—') + '</b><span>' + esc(m.contract && m.contract.kind === 'race' ? T('gd.race') : T('gd.date')) + '</span></div></div></div>';
    h += raceHTML(m);
    /* Machbarkeit */
    if (m.feas) {
      h += '<div class="gd-feas ' + esc(m.feas.cls) + '"><div class="f-top"><div class="f-ic">' + ic('gauge', 'sm') + '</div><div style="flex:1;min-width:0"><div class="f-t">' + esc(m.feas.title) + '</div><div class="f-d">' + m.feas.text + '</div></div></div>' +
        (m.reasons.length ? '<div class="gd-reasons">' + m.reasons.map(function (r) { return '<div class="gd-reason ' + r.kind + '">' + ic(r.kind === 'plus' ? 'check' : r.kind === 'minus' ? 'x' : 'info', 'xs') + '<div>' + r.html + '</div></div>'; }).join('') + '</div>' : '') +
        (m.feasibilityText ? '<div class="gd-reason neutral" style="margin-top:10px">' + ic('info', 'xs') + '<div>' + esc(m.feasibilityText) + '</div></div>' : '') + '</div>';
    }
    /* Zielvertrag */
    if (m.contract) h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('shield', 'sm') + ' ' + esc(T('gd.contract')) + '</div><div class="more" id="gd-edit-2">' + esc(T('common.edit')) + '</div></div><div class="gd-contract">' +
      m.contract.lines.map(function (l) { return '<div class="gd-cond">' + ic(l.ic, 'xs') + '<div>' + l.html + '</div></div>'; }).join('') + '</div><div class="source">' + ic('info', 'xs') + ' ' + esc(T('gd.contract_src')) + '</div></div>';
    /* Prognoseverlauf */
    if (p.kind === 'time') {
      var svg = seriesSVG(m);
      h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('bolt', 'sm') + ' ' + esc(T('gd.forecast')) + '</div></div>' +
        (svg ? svg + '<div class="gd-legend"><span><i style="background:#43D693"></i>' + esc(T('gd.leg_forecast')) + (m.feas && m.feas.predMin ? ' ' + esc(fmtTime(m.feas.predMin)) : '') + '</span><span><i style="background:rgba(201,174,124,.7)"></i>' + esc(T('gd.leg_target')) + '</span></div>' : '<p class="muted" style="margin:8px 0 0">' + esc(T('gd.forecast_none')) + '</p>') +
        (m.forecast ? '<div class="source">' + ic('info', 'xs') + ' ' + esc(T('gd.forecast_src', { runs: m.forecast.nRuns, q: m.forecast.nQuality, ef: m.forecast.ef ? T('gd.forecast_ef') : T('gd.forecast_riegel') })) + '</div>' : '') + '</div>';
    }
    /* Was der Plan daraus macht */
    h += sect(T('gd.plan_title'));
    if (m.plan && m.plan.units.length) {
      h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('target', 'sm') + ' ' + esc(T('gd.plan_week', { n: m.plan.count })) + '</div><div class="more" id="gd-plan">' + esc(T('gd.plan_open')) + ' ' + ic('chev', 'xs') + '</div></div><div class="gd-plan">' +
        m.plan.units.map(function (u) { return '<div class="gd-psess"><div class="s-ic">' + ic(u.icon || 'bolt', 'sm') + '</div><div class="s-b"><div class="s-t">' + esc(u.title) + '</div><div class="s-d">' + esc(u.detail || '') + '</div></div><div class="s-sh muted">' + esc(T('gd.share_tbd')) + '</div></div>'; }).join('') + '</div>' +
        '<div class="pv-alloc-note" style="margin:12px 0 0">' + ic('info', 'xs') + ' ' + esc(T('pv.zielanteil_leer')) + '</div></div>';
    } else h += '<div class="card tight"><p class="muted" style="margin:0">' + esc(T('gd.plan_none')) + '</p></div>';
    /* Stellschrauben */
    if (m.levers.length) {
      h += sect(T(m.levers.length === 1 ? 'gd.levers_one' : 'gd.levers'));
      h += m.levers.map(function (l) { return '<div class="card tight"><div style="display:flex;gap:12px;align-items:flex-start"><div class="sh-hic" style="background:var(--ready-t);color:var(--ready)">' + ic('bolt', 'sm') + '</div><div style="flex:1;min-width:0"><div class="gd-lv-t">' + l.html + '</div><div class="gd-lv-d">' + esc(l.effect) + '</div></div></div></div>'; }).join('');
    }
    /* Meilensteine */
    h += sect(T('goal.detail.milestones'), { id: 'gd-ms-add', label: ic('plus', 'xs') + ' ' + esc(T('gd.ms_add')) });
    if (m.milestones.length) {
      h += '<div class="card tight"><div class="gd-msl">' + m.milestones.map(function (x) {
        var cls = x.status === 'achieved' ? ' done' : (x.status === 'in_progress' ? ' now' : '');
        return '<div class="gd-msrow' + cls + '"><div class="m-rail"><div class="m-dot">' + (x.status === 'achieved' ? ic('check', 'xs') : (x.status === 'in_progress' ? ic('target', 'xs') : '')) + '</div><div class="m-line"></div></div><div class="m-b"><div class="m-t">' + esc(x.title) + '</div><div class="m-d">' + esc(x.date ? (x.status === 'achieved' ? deDate(x.date) : T('gd.ms_planned', { d: deDate(x.date) })) : T('common.noDate')) + '</div>' + (x.value ? '<div class="m-v">' + esc(x.value) + '</div>' : '') + '</div></div>'; }).join('') + '</div></div>';
    } else h += '<div class="card tight"><p class="muted" style="margin:0">' + esc(T('gd.ms_none')) + '</p></div>';
    /* Einzahlungen */
    if (m.keyWeeks.length) {
      h += sect(T('gd.dep_title')) + '<div class="card tight"><div class="gd-dep-intro">' + T('gd.dep_intro') + '</div>' +
        m.keyWeeks.map(function (w) { var pl = w.planned != null ? Math.max(1, Math.round(w.planned)) : null, pct = pl ? Math.min(100, Math.round(w.done / pl * 100)) : (w.done ? 100 : 0), miss = pl != null && w.done < pl && !w.current; return '<div class="gd-dep' + (miss ? ' miss' : '') + '"><span class="w">' + esc(w.label) + '</span><span class="bar"><i style="width:' + pct + '%"></i></span><span class="v">' + w.done + (pl != null ? ' / ' + pl : '') + '</span></div>'; }).join('') +
        '<div class="source">' + ic('info', 'xs') + ' ' + esc(T('gd.dep_src')) + '</div></div>';
    }
    /* Historie */
    h += sect(T('gd.history')) + '<div class="card tight"><div class="gd-log">' + (m.history.length ? m.history.map(function (x) { return '<div class="gd-logrow"><span class="d">' + esc(x.date) + '</span><span class="t">' + x.html + '</span></div>'; }).join('') : '<p class="muted" style="margin:0">' + esc(T('gd.history_none')) + '</p>') + '</div><div class="source">' + ic('info', 'xs') + ' ' + esc(T('gd.history_src')) + '</div></div>';
    /* Wechselwirkungen */
    h += sect(T('gd.interactions'));
    if (m.conflicts.length) h += m.conflicts.map(function (c) { return '<div class="gd-conf" style="margin:0 18px 10px">' + ic('alert', 'sm') + '<div><div class="c-t">' + esc(c.title) + '</div><div class="c-d">' + esc(c.text) + '</div></div></div>'; }).join('');
    else h += '<div class="card tight"><p class="muted" style="margin:0">' + esc(T('gd.interactions_none')) + '</p></div>';
    /* Luecken */
    if (m.gaps.length) h += sect(T('goal.detail.gaps')) + '<div class="setting-group">' + m.gaps.map(function (g) { return '<div class="prow" id="gd-gap-' + esc(g.id) + '"><div class="p-ic">' + ic('alert', 'sm') + '</div><div class="p-b"><div class="p-t">' + esc(g.label) + '</div><div class="p-d">' + esc(g.hint || '') + '</div></div>' + ic('chev', 'sm') + '</div>'; }).join('') + '</div>';
    /* Verwalten */
    var rows = [['gear', T('goal.detail.edit'), T('gd.m_edit_sub'), 'gd-edit']];
    if (m.status === 'active') rows.push(['info', T('gd.m_pause'), T('gd.m_pause_sub'), 'gd-pause']);
    if (m.status === 'paused') rows.push(['bolt', T('gd.m_resume'), T('gd.m_resume_sub'), 'gd-resume']);
    if (m.status === 'active' && !m.isMain) rows.push(['target', T('gd.m_main'), T('gd.m_main_sub'), 'gd-main']);
    if (m.status === 'active' && m.daysTo != null && m.daysTo < 0) { rows.push(['shield', T('gd.m_achieved'), T('gd.m_achieved_sub'), 'gd-achieved']); rows.push(['x', T('gd.m_missed'), T('gd.m_missed_sub'), 'gd-missed']); }
    if (m.status === 'achieved' || m.status === 'missed' || m.status === 'abandoned') rows.push(['bolt', T('gd.m_reactivate'), T('gd.m_reactivate_sub'), 'gd-reactivate']);
    rows.push(['link', T('gd.m_visibility'), T('gd.m_visibility_sub'), 'gd-vis']);
    h += sect(T('gd.manage')) + '<div class="setting-group">' + rows.map(function (r) { return '<div class="prow" id="' + r[3] + '"><div class="p-ic">' + ic(r[0], 'sm') + '</div><div class="p-b"><div class="p-t">' + esc(r[1]) + '</div><div class="p-d">' + esc(r[2]) + '</div></div>' + (r[3] === 'gd-vis' ? '<div class="p-v">' + esc(T('gd.m_visibility_val')) + '</div>' : '') + ic('chev', 'sm') + '</div>'; }).join('') + '</div>';
    return h + '</div>';
  }

  /* ---------- Datensammlung + Oeffnen ---------- */
  function collectPlanUnits() {
    try {
      var wp = typeof root.activeWeekPlan === 'function' ? root.activeWeekPlan() : null; if (!wp) return null;
      var days = Array.isArray(wp) ? wp : (wp.days || []), names = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], out = [];
      days.forEach(function (d, i) { (Array.isArray(d) ? d : (d && d.items) || []).forEach(function (u) { if (!u || !u.t) return; var sport = { Laufen: 'bolt', Rad: 'gauge', Schwimmen: 'link', Gym: 'shield' }[u.t] || 'bolt'; out.push({ day: names[i] || '', title: (names[i] ? names[i] + ' · ' : '') + (u.l || u.t), detail: [u.t, u.d].filter(Boolean).join(' · '), icon: sport, hardRun: u.t === 'Laufen' && /interval|tempo|schwelle|long/i.test(String(u.l || '') + ' ' + String(u.kind || '')) }); }); });
      return out;
    } catch (e) { return null; }
  }
  function open(id) {
    var goal = null;
    try {
      var gs = (typeof root.listGoals === 'function') ? root.listGoals() : [];
      goal = id ? gs.filter(function (x) { return x && x.id === id; })[0] : ((typeof root.mainGoalOf === 'function') ? root.mainGoalOf() : null);
    } catch (e) { goal = null; }
    if (!goal) { try { if (typeof root.openGoalEditor === 'function') root.openGoalEditor(); } catch (e) {} return false; }
    var isMain = false; try { var mg = root.mainGoalOf ? root.mainGoalOf() : null; isMain = !!(mg && mg.id === goal.id); } catch (e) {}
    var today = null; try { today = root.todayStr ? root.todayStr() : new Date().toISOString().slice(0, 10); } catch (e) {}
    var pi = null, eng = null, feas = null, str = null, bests = null, runs = null, plan = null, conflicts = [], allGoals = [];
    try { if (O.goalPlanInput) pi = O.goalPlanInput.resolve({ goal: goal, today: today, canon: (O.profileModel && O.profileModel.canonGoalCategory) || null, taper: O.goalTaperResolver || null }); } catch (e) {}
    try { if (isMain && typeof root.buildGoal === 'function') eng = root.buildGoal(); } catch (e) {}
    try { if (isMain) feas = O._lastFeasibility || null; } catch (e) {}
    try { if (isMain && O.profileCenter && O.profileCenter.buildStrength) str = O.profileCenter.buildStrength(root.PROFILE || null, new Date()); } catch (e) {}
    try { if (typeof root.bestTimes === 'function') bests = root.bestTimes(); } catch (e) {}
    try { if (typeof root.runsWindow === 'function') runs = root.runsWindow(7 * 12 + 42); } catch (e) {}
    try { plan = collectPlanUnits(); } catch (e) {}
    try { allGoals = (typeof root.listGoals === 'function') ? root.listGoals() : []; if (O.profileModel && O.profileModel.detectGoalConflicts) { var dec = (root.PROFILE && root.PROFILE.goalConflictDecisions) || []; conflicts = O.profileModel.detectGoalConflicts(allGoals).filter(function (c) { return !dec.some(function (x) { return x.conflictType === c.conflictType && (x.goalIds || []).slice().sort().join(',') === c.goalIds.slice().sort().join(','); }); }); } } catch (e) {}
    var avg4 = null, targetWeek = null, lr28 = null;
    try { var pw = [1, 2, 3, 4].map(function (i) { return root.weekRunKm(i); }).filter(function (v) { return v != null; }); if (pw.length >= 2) avg4 = pw.reduce(function (a, b) { return a + b; }, 0) / pw.length; } catch (e) {}
    try { if (root.Calc && root.Calc.weekKmTarget && pi && pi.daysTo != null) targetWeek = root.Calc.weekKmTarget(pi.daysTo, 0); } catch (e) {}
    try { if (typeof root._longestRunKm === 'function') lr28 = root._longestRunKm(28); } catch (e) {}
    var plannedKey = plan ? plan.filter(function (u) { return u.hardRun; }).length : null;
    var series = [];
    try { if (isMain && pi && pi.target && pi.target.targetMin != null && runs) series = forecastSeries({ runs: runs, today: today, weeks: 12, raceDate: goal.targetDate || null, targetMin: pi.target.targetMin, distanceKm: pi.distanceKm || null }); } catch (e) { series = []; }
    var rm = null;
    try { if (O.raceResult && O.activityStore && O.activityStore.listActivities && !(goal.result && goal.result.verdict)) rm = O.raceResult.match(goal, O.activityStore.listActivities() || [], { isTombstoned: O.activityStore.isTombstoned || null }); } catch (e) {}
    var m = buildModel({ goal: goal, planInput: pi, engine: eng, feasibility: feas, strength: str, catLabel: root.goalCatLabel || null, raceMatch: rm, isMain: isMain, today: today,
      bests: bests, runs: runs, weekPlan: plan, plannedKeyPerWeek: plannedKey || null, avg4WeekKm: avg4, targetWeekKm: targetWeek, longestRun28: lr28, series: series, conflicts: conflicts, goals: allGoals });
    if (typeof root.openSheet !== 'function') return false;
    root.openSheet({ id: '_goalDetail', title: esc(m.title) + '<div class="gd-psub">' + esc([m.isMain ? T('pv.role_main') : (m.priority ? T('pv.prioritaet_n', { n: m.priority }) : ''), m.categoryLabel].filter(Boolean).join(' · ')) + '</div>', size: 'full', body: html(m), actions: '' });
    try {
      var close = function () { try { if (typeof root._closeM === 'function') root._closeM('_goalDetail'); } catch (e) {} };
      var reopen = function () { setTimeout(function () { try { open(goal.id); } catch (e) {} }, 60); };
      var on = function (elId, fn) { var el = document.getElementById(elId); if (el) el.onclick = function (ev) { try { if (ev) ev.stopPropagation(); } catch (e) {} fn(); }; };
      on('gd-edit', function () { close(); try { root.openGoalEditor(goal.id); } catch (e) {} });
      on('gd-edit-2', function () { close(); try { root.openGoalEditor(goal.id); } catch (e) {} });
      on('gd-ms-add', function () { close(); try { root.openGoalEditor(goal.id); } catch (e) {} });
      on('gd-plan', function () { close(); try { root.showTab('plan'); } catch (e) {} });
      on('gd-pause', function () { try { root.goalSetStatus(goal.id, 'paused'); } catch (e) {} reopen(); });
      on('gd-resume', function () { try { root.goalSetStatus(goal.id, 'active'); } catch (e) {} reopen(); });
      on('gd-main', function () { try { root.goalMakeMain(goal.id); } catch (e) {} reopen(); });
      on('gd-achieved', function () { try { root.goalSetStatus(goal.id, 'achieved'); } catch (e) {} reopen(); });
      on('gd-missed', function () { try { root.goalSetStatus(goal.id, 'missed'); } catch (e) {} reopen(); });
      on('gd-reactivate', function () { try { root.goalReactivate(goal.id); } catch (e) {} reopen(); });
      on('gd-vis', function () { try { if (typeof root.toast === 'function') root.toast(T('gd.m_visibility_toast')); } catch (e) {} });
      var rok = document.getElementById('gd-race-ok'); if (rok && rm) rok.onclick = function () { close(); try { root.goalConfirmResult(goal.id, rm.activityId); } catch (e) {} reopen(); };
      var rno = document.getElementById('gd-race-no'); if (rno && rm) rno.onclick = function () { close(); try { root.goalDismissRace(goal.id, rm.activityId); } catch (e) {} reopen(); };
      (m.gaps || []).forEach(function (g) {
        on('gd-gap-' + g.id, function () { close(); if (g.action === 'goal_editor') { try { root.openGoalEditor(g.goalId || goal.id); } catch (e) {} return; } try { if (g.sectionId && typeof root.openProfileSection === 'function') root.openProfileSection(g.sectionId); } catch (e) {} });
      });
    } catch (e) {}
    return true;
  }

  var api = { VERSION: VERSION, buildModel: buildModel, html: html, open: open, forecastSeries: forecastSeries, keyWeeks: keyWeeks, feasReasons: feasReasons, histText: histText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.goalDetail = api;
  root.openGoalDetail = open;
})(typeof globalThis !== 'undefined' ? globalThis : this);
