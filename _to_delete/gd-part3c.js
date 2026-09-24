
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
