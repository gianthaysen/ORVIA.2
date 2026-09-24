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
  function fmtGoalValue(g, v) { try { var M = O.profileModel; if (M && typeof M.formatGoalValue === 'function') return M.formatGoalValue(g, v); } catch (e) {} return v == null ? '' : String(v) + (g && g.unit ? ' ' + g.unit : ''); }
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
      out.push({ kind: okVol ? 'plus' : 'minus', html: T(okVol ? 'gd.r_volume_ok' : 'gd.r_volume_low', { have: fmtDe(o.avg4WeekKm, 0), need: fmtDe(o.targetWeekKm, 0) }) });
    } else out.push({ kind: 'neutral', html: T('gd.r_volume_unknown') });
    /* Bestzeit-Aequivalent */
    if (m.baseline && t.targetMin != null) {
      var okB = m.baseline.equivMin <= t.targetMin;
      out.push({ kind: okB ? 'plus' : 'minus', html: T(okB ? 'gd.r_best_ok' : 'gd.r_best_slow', { dist: m.baseline.label, time: fmtSec(m.baseline.sec), equiv: fmtTime(m.baseline.equivMin) }) });
    }
    /* Laengster Lauf gegen Bedarf (Regel wie Calc.goalEngine: >28 Tage 14 km·Skala, >14 Tage 17 km·Skala) */
    if (distKm && m.daysTo != null && m.daysTo > 14) {
      var need = Math.round((m.daysTo > 28 ? 14 : 17) * (distKm / HM_KM)), have = num(o.longestRun28);
      if (have != null) out.push({ kind: have >= need ? 'plus' : 'minus', html: T(have >= need ? 'gd.r_long_ok' : 'gd.r_long_short', { have: fmtDe(have, 1), need: need }) });
    }
    /* Schluesseleinheiten je Woche (42 Tage) gegen Plan */
    if (e && num(e.nQuality) != null && e.state !== 'nodata') {
      var perWeek = Math.round(e.nQuality / 6 * 10) / 10, planned = num(o.plannedKeyPerWeek);
      var okK = planned == null ? perWeek >= 1 : perWeek >= planned * 0.8;
      out.push({ kind: okK ? 'plus' : 'minus', html: T(planned != null ? (okK ? 'gd.r_key_ok_plan' : 'gd.r_key_low_plan') : (okK ? 'gd.r_key_ok' : 'gd.r_key_low'), { have: fmtDe(perWeek, 1), plan: planned != null ? fmtDe(planned, 1) : '' }) });
    }
    /* CTL-Trend (nur wenn Engine es hart bewertet) */
    if (e && Array.isArray(e.vetos)) e.vetos.forEach(function (v) { if (/Fitness/.test(String(v))) out.push({ kind: 'minus', html: T('gd.r_ctl_flat') }); });
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
