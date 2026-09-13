/* ============================================================
   ORVIA · screens/profile-v14 — Profil-Screen nach Prototyp v14 (S1-UI, 13.09.2026)

   Reiter Übersicht / Ziele / Leistung (Community folgt in S7). Alle Werte kommen aus
   bestehenden Quellen (Profil, Ziele, Aktivitäten, Engines); was fehlt, wird als
   ehrlicher Leerzustand gezeigt — nichts aus dem Prototyp (Demo-Zahlen) landet hier.

   AUFBAU
     collect()        liest defensiv aus den Globals (jede Quelle in try/catch) → data
     overviewHTML(d)  Reiter Übersicht   (Sportarten, Saison, Zielreise)
     goalsHTML(d)     Reiter Ziele       (Kennzahlen, aktive Ziele, Konflikte, Erreicht/Verfehlt)
     performanceHTML  Reiter Leistung    (VO₂max/Fitness/ACWR, Bestzeiten je Sport, Kraftwerte, Zonen & Schwellen)
     render(host)     Kopf (ui.js gmProfHeaderHTML) + Profilstärke + Reiter + aktiver Tab
     goalSheet        Neues Ziel / Ziel bearbeiten als EIN Sheet (Wizard hinter „Mehr Optionen")
   Reine Renderer nehmen `data` — testbar ohne DOM (supabase/tests/profile_v14_test.mjs).
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA; O.screens = O.screens || {};
  var VERSION = 'profile-v14@2';
  var TAB_KEY = 'orvia_prof_tab';

  function T(k, p) { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function ic(name, size) { try { if (typeof root.icon === 'function') return root.icon(name, size || 'sm'); } catch (e) {} return ''; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function numLoose(v) { if (num(v) != null) return v; if (typeof v === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) { var x = parseFloat(v.replace(',', '.')); return isFinite(x) ? x : null; } return null; }
  /* Titel, der nur aus einem Wert besteht („12%", „100 kg") ist kein Titel — dann Kategorie zeigen */
  function goalTitle(g) { var t = String(g && g.title || '').trim(); if (!t || /^-?\d+([.,]\d+)?\s*(%|kg|km|min|h|s)?$/i.test(t)) return catLabel(g && g.category) || t; return t; }
  function fmtDe(n, d) { if (num(n) == null) return '—'; return (d != null ? n.toFixed(d) : String(Math.round(n * 10) / 10)).replace('.', ','); }
  function fmtSec(sec) { if (num(sec) == null) return '—'; sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60; return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0') : m + ':' + String(x).padStart(2, '0'); }
  function fmtPace(sec) { if (num(sec) == null) return '—'; var m = Math.floor(sec / 60), s = Math.round(sec % 60); if (s === 60) { m++; s = 0; } return m + ':' + String(s).padStart(2, '0'); }
  function deDate(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? (m[3] + '.' + m[2] + '.' + m[1]) : null; }
  function today() { try { if (typeof root.todayStr === 'function') return root.todayStr(); } catch (e) {} return new Date().toISOString().slice(0, 10); }
  function daysBetween(a, b) { try { return Math.round((new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 864e5); } catch (e) { return null; } }
  function goalValue(g, v) { try { var M = O.profileModel; if (M && M.formatGoalValue) return M.formatGoalValue(g, v); } catch (e) {} return v == null ? '' : String(v) + (g && g.unit ? ' ' + g.unit : ''); }

  /* ---------- Tab-Zustand ---------- */
  var TABS = ['ueber', 'ziele', 'leistung'];
  function activeTab() { try { var t = root.localStorage.getItem(TAB_KEY); if (TABS.indexOf(t) >= 0) return t; } catch (e) {} return 'ueber'; }
  function setTab(t) { if (TABS.indexOf(t) < 0) return; try { root.localStorage.setItem(TAB_KEY, t); } catch (e) {} render(); }

  /* ---------- Datensammlung (fail-open je Quelle) ---------- */
  var ROLE_KEY = { main: 'pv.role_main', secondary: 'pv.role_secondary', maintain: 'pv.role_maintain', longterm: 'pv.role_longterm' };
  function collect() {
    var d = { today: today(), profile: null, sports: [], goals: [], mainGoalId: null, planInput: null, engine: null, feasibility: null,
      strength: null, season: null, weekStats: null, load: null, conflicts: [], matches: {}, bests: null, bestsAll: null,
      strengthRecords: [], vo2: null, hfMax: null, restingHr: null, threshold: null, activitiesCount: null };
    var P = null; try { P = root.PROFILE || null; } catch (e) {}
    d.profile = P;
    try { d.sports = (P && Array.isArray(P.sports) ? P.sports : []).map(function (s) {
      var id = s && (s.sportId || s.customName || s); var lbl = null;
      try { lbl = O.activityConfig && O.activityConfig.sportLabel ? O.activityConfig.sportLabel(s.sportId || id) : null; } catch (e) {}
      return { id: String(id), label: lbl || (s && s.customName) || String(id), role: (s && s.role) || 'supplemental' };
    }).filter(function (s) { return s.id && s.id !== 'undefined'; }); } catch (e) {}
    try { d.goals = (typeof root.listGoals === 'function') ? (root.listGoals() || []) : []; } catch (e) {}
    try { var mg = typeof root.mainGoalOf === 'function' ? root.mainGoalOf() : null; d.mainGoalId = mg ? mg.id : null;
      if (mg && O.goalPlanInput) d.planInput = O.goalPlanInput.resolve({ goal: mg, today: d.today, canon: (O.profileModel && O.profileModel.canonGoalCategory) || null, taper: O.goalTaperResolver || null }); } catch (e) {}
    try { if (typeof root.buildGoal === 'function') d.engine = root.buildGoal(); } catch (e) {}
    try { d.feasibility = O._lastFeasibility || null; } catch (e) {}
    try { if (O.profileCenter && O.profileCenter.buildStrength) d.strength = O.profileCenter.buildStrength(P, new Date()); } catch (e) {}
    try { if (d.planInput && d.planInput.targetDate) {
      var SP = O.seasonPhases, sp = null;
      if (SP && SP.seasonPhases) sp = SP.seasonPhases(d.planInput.targetDate, d.today, { startDate: mg && mg.createdAt ? String(mg.createdAt).slice(0, 10) : null });
      if (sp) d.season = { model: 'season', phases: sp.phases, current: sp.current, totalWeeks: sp.totalWeeks, weeksToRace: sp.weeksToRace, daysTo: sp.daysToRace, targetDate: sp.targetDate, phase: d.planInput.phase };
      else { var C = root.Calc; if (C && C.racePhases) d.season = { model: 'race', phases: C.racePhases(d.planInput.targetDate, d.today), daysTo: d.planInput.daysTo, phase: d.planInput.phase }; }
    } } catch (e) {}
    try { var acts = (typeof root.listActivitiesUnified === 'function') ? (root.listActivitiesUnified() || []) : ((O.activityStore && O.activityStore.listActivities) ? O.activityStore.listActivities() : []);
      d.activitiesCount = Array.isArray(acts) ? acts.length : null;
      var wk = { km: null, sessionsAvg: null };
      if (typeof root.weekRunKm === 'function') { var w0 = root.weekRunKm(0); wk.km = num(w0 && typeof w0 === 'object' ? w0.km : w0); }
      wk.sessionsAvg = weeklySessionsAvg(d.today, 4);
      if (wk.sessionsAvg == null) {
        var cut = new Date(d.today + 'T00:00:00'); cut.setDate(cut.getDate() - 28);
        var n = (acts || []).filter(function (a) { var st = a && (a.startedAt || a.started_at || a.date || a.startTime); return a && a.status !== 'planned' && st && new Date(String(st).slice(0, 10) + 'T00:00:00') >= cut; }).length;
        wk.sessionsAvg = (acts && acts.length) ? Math.round(n / 4 * 10) / 10 : null;
      }
      d.weekStats = wk; } catch (e) {}
    try { var ld = typeof root.allLoads === 'function' ? root.allLoads() : null; var C2 = root.Calc;
      if (ld && C2) { var lcc = C2.loadConfidenceContract ? C2.loadConfidenceContract(ld.confidence) : { suppressNumbers: false };
        var out = { ctl: null, acwr: null, suppressed: !!lcc.suppressNumbers };
        if (!lcc.suppressNumbers) { if (C2.loadSeries) { var S = C2.loadSeries(ld.loads || []); if ((S.ctl || []).length >= 14) out.ctl = Math.round(S.ctl[S.ctl.length - 1]); }
          if (C2.acwr) { var a = C2.acwr(ld.loads || []); out.acwr = a && a.enough ? a.ratio : null; } }
        d.load = out; } } catch (e) {}
    try { var M = O.profileModel; if (M && M.detectGoalConflicts) { var dec = (P && P.goalConflictDecisions) || [];
      d.conflicts = M.detectGoalConflicts(d.goals).filter(function (c) { return !dec.some(function (x) { return x.conflictType === c.conflictType && (x.goalIds || []).slice().sort().join(',') === c.goalIds.slice().sort().join(','); }); }); } } catch (e) {}
    try { if (O.raceResult && O.activityStore && O.activityStore.listActivities) { var al = O.activityStore.listActivities() || [];
      d.goals.forEach(function (g) { if (g && !(g.result && g.result.verdict)) { var m = O.raceResult.match(g, al, { isTombstoned: O.activityStore.isTombstoned || null }); if (m) d.matches[g.id] = m; } }); } } catch (e) {}
    try { if (typeof root.bestTimes === 'function') d.bests = root.bestTimes(); } catch (e) {}
    try { if (O.runBests && O.runBests.measuredAllBests && O.activityStore && O.activityStore.listActivities) d.bestsAll = O.runBests.measuredAllBests(O.activityStore.listActivities() || [], { isTombstoned: O.activityStore.isTombstoned || null }); } catch (e) {}
    try { d.strengthRecords = (P && P.performance && Array.isArray(P.performance.strengthRecords)) ? P.performance.strengthRecords : []; } catch (e) {}
    try { var res = (typeof root.gmAnaResolved === 'function') ? root.gmAnaResolved() : null; var v = res && res.vo2max_running; if (v && v.value != null) d.vo2 = { value: v.value, source: v.source || v.provider || null, date: v.metricDate || null }; } catch (e) {}
    try { if (O.sourceContract) { d.hfMax = O.sourceContract.hfMax(P); d.restingHr = O.sourceContract.restingHr(P); } } catch (e) {}
    try { if (!d.restingHr) { var res2 = (typeof root.gmAnaResolved === 'function') ? root.gmAnaResolved() : null; var r = res2 && res2.resting_hr; if (r && r.value != null) d.restingHr = { value: r.value, source: r.source || r.provider || 'garmin', updatedAt: r.metricDate || null }; } } catch (e) {}
    try { if (O.performanceResolver && O.performanceResolver.resolveAll) { var pr = O.performanceResolver.resolveAll(P, { today: d.today }); var run = pr && pr.sports && pr.sports.running;
      if (run && run.ok) d.threshold = { paceSec: run.thresholdPaceSecPerKm, ref: run.reference || null, confidence: run.confidence || null }; } } catch (e) {}
    return d;
  }

  /* Ø Einheiten/Woche der letzten n Kalenderwochen (inkl. laufender Woche) aus
     activityConfig.weeklyActivityTotals — derselbe Vertrag wie weekRunKm(). null, wenn der
     Vertrag fehlt (dann greift die Heuristik in collect()). */
  function weeklySessionsAvg(todayISO, weeks) {
    try {
      var st = O.activityStore, cfg = O.activityConfig;
      if (!st || !st.listActivities || !cfg || !cfg.weeklyActivityTotals) return null;
      var tz = 'UTC'; try { if (O.profileStore && O.profileStore.effectiveTimezone) tz = O.profileStore.effectiveTimezone() || 'UTC'; } catch (e) {}
      var acts = st.listActivities() || [], DB = root.DB || {}, total = 0, got = 0;
      var anc = new Date(todayISO + 'T12:00:00'), day = (anc.getDay() + 6) % 7;
      for (var i = 0; i < weeks; i++) {
        var mon = new Date(anc); mon.setDate(anc.getDate() - day - 7 * i);
        var ref = mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0');
        var wk = cfg.weeklyActivityTotals(acts, DB, { weekRef: ref, timezone: tz, isTombstoned: st.isTombstoned || null });
        if (!wk) continue; got++;
        var bs = wk.bySport || {}; for (var k in bs) if (bs[k] && num(bs[k].sessionCount) != null) total += bs[k].sessionCount;
      }
      return got ? Math.round(total / got * 10) / 10 : null;
    } catch (e) { return null; }
  }

  /* ---------- Bausteine ---------- */
  function sectlabel(title, action, slot) { return '<div class="sectlabel"' + (slot ? ' data-gm-slot="' + slot + '"' : '') + '>' + esc(title) + (action ? ' <span class="edit" role="button" tabindex="0" onclick="' + action.onclick + '">' + action.label + '</span>' : '') + '</div>'; }
  function roleOf(g) { try { var M = O.profileModel; if (M && M.roleOfGoal) return M.roleOfGoal(g); } catch (e) {} return g.priority === 1 ? 'main' : g.priority === 2 ? 'secondary' : 'longterm'; }
  function catLabel(c) { try { if (typeof root.goalCatLabel === 'function') return root.goalCatLabel(c); } catch (e) {} return c || ''; }
  function goalSub(g, d) {
    var parts = [catLabel(g.category)];
    if (g.targetDate) parts.push(deDate(g.targetDate)); else if (g.timeHorizon === 'long') parts.push(T('pv.langfristig')); else parts.push(T('pv.ohne_datum'));
    return parts.join(' · ');
  }
  function goalProgress(g, d) {
    /* Prognose nur fuer das Hauptziel (Engine rechnet nur dieses); Wert-Ziele aus current/target. */
    var isMain = g.id === d.mainGoalId, e = d.engine, t = d.planInput && d.planInput.target;
    if (isMain && t && t.targetMin != null && e && e.tPred > 0 && e.state !== 'nodata') {
      return { pct: Math.max(0, Math.min(100, Math.round((t.targetMin / e.tPred) * 100))), left: esc(T('pv.prognose')) + ' <b>' + esc(fmtSec(Math.round(e.tPred * 60))) + '</b> · ' + esc(T('pv.ziel')) + ' ' + esc(fmtSec(Math.round(t.targetMin * 60))), state: e.state || null };
    }
    var tv = numLoose(g.targetValue), cv = numLoose(g.currentValue);
    if (tv != null && cv != null && g.metricType !== 'time') {
      var lower = /loss|fat|bodyfat|shredded/.test(String(g.category || ''));
      var pct = lower ? (cv <= tv ? 100 : Math.round((tv / cv) * 100)) : (tv > 0 ? Math.round((cv / tv) * 100) : null);
      return { pct: pct != null ? Math.max(0, Math.min(100, pct)) : null, left: esc(goalValue(g, cv)) + ' → ' + esc(goalValue(g, tv)), state: null };
    }
    if (tv != null) return { pct: null, left: esc(T('pv.ziel')) + ' <b>' + esc(goalValue(g, tv)) + '</b>', state: null };
    return { pct: null, left: esc(T('pv.kein_zielwert')), state: null };
  }
  function goalRight(g, d) {
    if (g.targetDate) { var dd = daysBetween(g.targetDate, d.today); if (dd == null) return ''; if (dd > 0) return '<b>' + dd + '</b> ' + esc(T('pv.tage')); if (dd === 0) return esc(T('pv.heute')); return esc(T('pv.vor_n_tagen', { n: -dd })); }
    return '';
  }
  function raceLine(g, d) {
    var r = g.result && g.result.verdict ? g.result : null;
    if (r) return '<div class="pv-race pv-race-' + esc(r.verdict) + '">' + esc(T('goal.race.' + r.verdict)) + ' · ' + esc(fmtSec(r.timeSec)) + (r.deltaSec != null ? ' (' + (r.deltaSec <= 0 ? '−' : '+') + esc(fmtSec(Math.abs(r.deltaSec))) + ')' : '') + '</div>';
    var m = d.matches[g.id];
    if (m) return '<div class="pv-race pv-race-match">' + esc(T('goal.race.detected')) + ' · ' + esc(fmtSec(m.timeSec)) + (m.verdict !== 'finished' ? ' · ' + esc(T('goal.race.' + m.verdict)) : '') + ' <button type="button" class="gmc-b" onclick="event.stopPropagation();goalConfirmResult(\'' + esc(g.id) + '\',\'' + esc(m.activityId) + '\')">' + esc(T('pf.rr_uebernehmen')) + '</button></div>';
    return '';
  }
  function goalCard(g, d, opts) {
    var o = opts || {}, role = roleOf(g), isMain = g.id === d.mainGoalId, p = goalProgress(g, d);
    var badge;
    if (o.pill) {
      var f = isMain ? d.feasibility : null, cls = '', txt = null;
      if (f && f.evaluated === true) { if (f.status === 'within_modeled_corridor') { cls = 'ready'; txt = T('pv.im_korridor'); } else if (f.status === 'outside_modeled_corridor') { cls = 'att'; txt = T('pv.knapp'); } }
      if (!txt && d.conflicts.some(function (c) { return c.goalIds.indexOf(g.id) >= 0; })) { cls = 'crit'; txt = T('pv.konflikt'); }
      badge = txt ? '<span class="pill-badge ' + cls + '">' + esc(txt) + '</span>' : '';
    } else badge = '<span class="goal-badge' + (role !== 'main' ? ' pv-badge-' + esc(role) : '') + '">' + esc(T(ROLE_KEY[role] || 'pv.role_longterm')) + '</span>';
    var sub = o.pill ? (catLabel(g.category) + ' · ' + T('pv.prioritaet_n', { n: g.priority }) + ' · ' + (g.targetDate ? deDate(g.targetDate) : T('pv.offen'))) : goalSub(g, d);
    var bar = p.pct != null ? '<div class="goal-line"><i style="width:' + p.pct + '%' + (role !== 'main' ? ';background:linear-gradient(90deg,var(--activity),var(--ready))' : '') + '"></i></div>' : '<div class="goal-line none"></div>';
    var alloc = '';
    return '<div class="goal-card tap' + (role !== 'main' ? ' sec' : '') + '" onclick="openGoalDetail(\'' + esc(g.id) + '\')">' +
      '<div class="goal-top"><div style="min-width:0"><h4>' + esc(goalTitle(g)) + '</h4><p>' + esc(sub) + '</p></div>' + badge + '</div>' +
      bar + '<div class="goalmeta"><span>' + p.left + '</span><span>' + goalRight(g, d) + '</span></div>' + raceLine(g, d) + alloc + '</div>';
  }

  /* ---------- Reiter Übersicht ---------- */
  function overviewHTML(d) {
    var h = '';
    var ROLE_SPORT = { main: T('pv.sport_haupt'), secondary: T('pv.sport_neben'), planned: T('pv.sport_geplant') };
    h += sectlabel(T('pv.sportarten'), { label: esc(T('common.edit')), onclick: "gmOpenProfPage('goals')" }, 'profile-sports');
    h += '<div class="sport-chips">' + (d.sports.length ? d.sports.map(function (s) { return '<span class="sport-chip' + (s.role === 'planned' ? '' : ' on') + '">' + esc(s.label) + (ROLE_SPORT[s.role] ? ' · ' + esc(ROLE_SPORT[s.role]) : '') + '</span>'; }).join('') : '<span class="sport-chip">' + esc(T('pv.keine_sportarten')) + '</span>') + '</div>';
    /* Saison */
    h += sectlabel(T('pv.saison'));
    if (d.season && d.season.phases && d.season.phases.length) {
      var ph = d.season.phases, cur = ph.filter(function (p) { return p.on; })[0], isSeason = d.season.model === 'season';
      var title;
      if (cur && isSeason) title = esc(T('pv.phase_woche_von', { phase: T({ base: 'pv.phase_base', build: 'pv.phase_build', peak: 'pv.phase_peak', taper: 'pv.phase_taper' }[cur.key] || 'pv.phase_build'), week: cur.week || 1, of: cur.weeks }));
      else title = cur ? (esc(cur.n) + (d.season.daysTo != null && d.season.daysTo > 0 ? ' · ' + esc(T('pv.wettkampf_in_n_tagen', { n: d.season.daysTo })) : (d.season.daysTo === 0 ? ' · ' + esc(T('pv.wettkampf_heute')) : ''))) : esc(T('pv.saison_ohne_phase'));
      h += '<div class="card tight" data-gm-slot="profile-performance"><div class="ctitle"><div class="l">' + ic('target', 'sm') + ' ' + title + '</div><div class="more" onclick="showTab(\'plan\')">' + esc(T('pv.plan')) + ' ' + ic('chev', 'xs') + '</div></div>' +
        '<div class="pv-phases">' + ph.map(function (p) {
          var sub;
          if (isSeason) sub = p.on ? T('pv.woche_x_von_y', { x: p.week || 1, y: p.weeks }) : (p.done ? T('pv.n_wo_fertig', { n: p.weeks }) : T('pv.n_wo', { n: p.weeks }));
          else { var isRace = p.from && p.to && p.from === p.to; sub = p.to ? (isRace ? deDate(p.to) : T('pv.bis_datum', { d: deDate(p.to) })) : ''; }
          return '<div class="pv-phase' + (p.on ? ' on' : '') + (p.done ? ' done' : '') + '"><b>' + esc(p.n) + '</b><span>' + esc(sub) + '</span></div>'; }).join('') + '</div>' +
        '<div class="statgrid3"><div><div class="n">' + esc(d.weekStats && d.weekStats.km != null ? fmtDe(d.weekStats.km) : '—') + '</div><div class="l">' + esc(T('pv.km_diese_woche')) + '</div></div>' +
        '<div><div class="n">' + esc(d.weekStats && d.weekStats.sessionsAvg != null ? fmtDe(d.weekStats.sessionsAvg) : '—') + '</div><div class="l">' + esc(T('pv.einheiten_pro_woche')) + '</div></div>' +
        '<div><div class="n">' + esc(d.load && d.load.acwr != null ? fmtDe(d.load.acwr, 2) : '—') + '</div><div class="l">' + esc(T('pv.belastung_acwr')) + '</div></div></div>' +
        '<div class="source">' + ic('info', 'xs') + ' ' + esc(T('pv.saison_quelle', { n: d.activitiesCount != null ? d.activitiesCount : '—' })) + (isSeason && d.season.targetDate ? ' · ' + esc(T('pv.saison_wettkampf_am', { d: deDate(d.season.targetDate), n: d.season.daysTo })) : '') + '</div></div>';
    } else {
      h += '<div class="card tight" data-gm-slot="profile-performance"><div class="ctitle"><div class="l">' + ic('target', 'sm') + ' ' + esc(T('pv.saison_leer_titel')) + '</div></div><p class="muted" style="margin:0">' + esc(T('pv.saison_leer_text')) + '</p></div>';
    }
    /* Zielreise */
    var active = d.goals.filter(function (g) { return g && g.status === 'active'; }).sort(function (a, b) { return (a.priority || 9) - (b.priority || 9); });
    h += sectlabel(T('pv.zielreise'), { label: esc(T('pv.alle_ziele')), onclick: "ORVIA.screens.profileV14.setTab('ziele')" }, 'profile-goal-journey');
    h += '<div class="goal-stack">' + (active.length ? active.slice(0, 3).map(function (g) { return goalCard(g, d, {}); }).join('') : '<div class="goal-card tap" onclick="ORVIA.screens.profileV14.openGoalSheet()"><div class="goal-top"><div><h4>' + esc(T('pv.kein_ziel')) + '</h4><p>' + esc(T('pv.kein_ziel_text')) + '</p></div></div></div>') + '</div>';
    /* Profil & Kontrolle (v14: vier Zeilen; Sichtbarkeit kommt mit S6) */
    var sync = ''; try { if (typeof root.gmProfSyncLabel === 'function') sync = root.gmProfSyncLabel() || ''; } catch (e) {}
    h += sectlabel(T('pv.profil_kontrolle'), null, 'profile-control');
    var nActive = d.goals.filter(function (g) { return g && g.status === 'active'; }).length;
    var syncParts = sync ? sync.split(' · ') : [], syncProv = syncParts.length > 1 ? syncParts[0] : '', syncRest = syncParts.length > 1 ? syncParts.slice(1).join(' · ') : sync;
    h += '<div class="setting-group">' + [['target', T('pv.ziele_sportarten'), T('pv.ziele_sportarten_sub'), "gmOpenProfPage('goals')", nActive ? T('pv.n_aktiv', { n: nActive }) : ''], ['link', T('pv.geraete_daten'), syncRest || T('pv.geraete_daten_sub'), "gmOpenProfPage('connections')", syncProv], ['gear', T('pv.einstellungen'), T('pv.einstellungen_sub'), "gmOpenProfPage('settings')", '']].map(function (r) {
      return '<div class="prow" onclick="' + r[3] + '"><div class="p-ic">' + ic(r[0], 'sm') + '</div><div class="p-b"><div class="p-t">' + esc(r[1]) + '</div><div class="p-d">' + esc(r[2]) + '</div></div>' + (r[4] ? '<div class="p-v">' + esc(r[4]) + '</div>' : '') + ic('chev', 'sm') + '</div>'; }).join('') + '</div>';
    return h;
  }

  /* ---------- Reiter Ziele ---------- */
  function goalsHTML(d) {
    var gs = d.goals || [];
    var active = gs.filter(function (g) { return g.status === 'active'; }).sort(function (a, b) { return (a.priority || 9) - (b.priority || 9); });
    var done = gs.filter(function (g) { return g.status === 'achieved' || g.status === 'missed'; }).sort(function (a, b) { return String((b.result && b.result.date) || b.updatedAt || '').localeCompare(String((a.result && a.result.date) || a.updatedAt || '')); });
    var paused = gs.filter(function (g) { return g.status === 'paused'; });
    var h = '<div class="eduhint">' + ic('info', 'sm') + '<div>' + T('pv.ziele_hinweis') + '</div></div>';
    h += '<div class="kpi-row"><div class="kpi"><b>' + active.length + '</b><span>' + esc(T('pv.aktiv')) + '</span></div><div class="kpi"><b>' + done.filter(function (g) { return g.status === 'achieved'; }).length + '</b><span>' + esc(T('pv.erreicht')) + '</span></div><div class="kpi"><b>' + d.conflicts.length + '</b><span>' + esc(T('pv.konflikte')) + '</span></div></div>';
    h += sectlabel(T('pv.aktive_ziele'), { label: ic('plus', 'xs') + ' ' + esc(T('pv.neues_ziel')), onclick: 'ORVIA.screens.profileV14.openGoalSheet()' });
    h += '<div class="goal-stack">' + (active.length ? active.map(function (g) { return goalCard(g, d, { pill: true }); }).join('') : '<div class="goal-card tap" onclick="ORVIA.screens.profileV14.openGoalSheet()"><div class="goal-top"><div><h4>' + esc(T('pv.kein_ziel')) + '</h4><p>' + esc(T('pv.kein_ziel_text')) + '</p></div></div></div>') + '</div>' +
      (active.length ? '<div class="pv-alloc-note">' + ic('info', 'xs') + ' ' + esc(T('pv.zielanteil_leer')) + '</div>' : '');
    if (paused.length) h += sectlabel(T('pv.pausiert')) + '<div class="setting-group">' + paused.map(function (g) { return '<div class="prow" onclick="openGoalDetail(\'' + esc(g.id) + '\')"><div class="p-b"><div class="p-t">' + esc(goalTitle(g)) + '</div><div class="p-d">' + esc(goalSub(g, d)) + '</div></div><button type="button" class="gmc-b" onclick="event.stopPropagation();goalSetStatus(\'' + esc(g.id) + '\',\'active\')">' + esc(T('pv.fortsetzen')) + '</button></div>'; }).join('') + '</div>';
    if (d.conflicts.length) {
      h += sectlabel(T('pv.zielkonflikte'));
      var titleOf = function (id) { var g = gs.filter(function (x) { return x.id === id; })[0]; return g ? goalTitle(g) : id; };
      h += d.conflicts.map(function (c) { return '<div class="gd-conf" style="margin:0 18px 10px">' + ic('alert', 'sm') + '<div><div class="c-t">' + esc(c.goalIds.map(titleOf).join(' ↔ ')) + '</div><div class="c-d">' + esc(c.explanation) + '</div><div class="pv-conf-acts">' + [T('pf.ausdauer_priorisieren_kraft_erhalten'), T('pf.muskelaufbau_priorisieren_ausdauer_erhalten'), T('pf.ziele_zeitlich_staffeln'), T('pf.eigene_entscheidung')].map(function (opt, i) { return '<button type="button" class="gmc-b" onclick="decideConflict(\'' + esc(c.conflictType) + '\',\'' + esc(c.goalIds.join(',')) + '\',' + i + ');ORVIA.screens.profileV14.render()">' + esc(opt) + '</button>'; }).join('') + '</div></div></div>'; }).join('');
    }
    if (done.length) {
      h += sectlabel(T('pv.erreicht_verfehlt')) + '<div class="setting-group">' + done.map(function (g) {
        var r = g.result && g.result.verdict ? g.result : null, ok = g.status === 'achieved';
        var sub = r ? (deDate(r.date) + ' · ' + fmtSec(r.timeSec) + (r.deltaSec != null ? ' (' + (r.deltaSec <= 0 ? '−' : '+') + fmtSec(Math.abs(r.deltaSec)) + ')' : '')) : (ok ? T('pv.manuell_erreicht') : T('pv.manuell_verfehlt'));
        return '<div class="prow" onclick="openGoalDetail(\'' + esc(g.id) + '\')"><div class="p-ic" style="background:var(--' + (ok ? 'ready' : 'attention') + '-t);color:var(--' + (ok ? 'ready' : 'attention') + ')">' + ic(ok ? 'shield' : 'target', 'sm') + '</div><div class="p-b"><div class="p-t">' + esc(goalTitle(g)) + '</div><div class="p-d">' + esc(sub) + '</div></div><span class="pill-badge ' + (ok ? 'ready' : 'att') + '">' + esc(ok ? T('pv.erreicht') : T('pv.verfehlt')) + '</span></div>';
      }).join('') + '</div>';
    }
    h += '<div class="pv-more"><button type="button" class="btn sec" onclick="openGoalsManager()">' + esc(T('pv.alle_verwalten')) + '</button></div>';
    return h;
  }

  /* ---------- Reiter Leistung ---------- */
  var LIFTS = [['kniebeuge|squat', 'pv.lift_squat'], ['kreuzheben|deadlift', 'pv.lift_deadlift'], ['bankdr|bench', 'pv.lift_bench'], ['klimmz|pull-?up|chin', 'pv.lift_pullup']];
  /* e1RM nach Epley aus abgeschlossenen Arbeitssaetzen (1–12 Wdh.) der Gym-Snapshots;
     Klimmzuege: hoechste Wiederholungszahl eines Satzes ohne Zusatzgewicht. */
  function liftsFromTraining() {
    var out = [];
    try {
      var gv = O.gymVolume; if (!gv || !gv.gymPipeline) return out;
      var pipe = gv.gymPipeline({ days: 365 }); var snaps = (pipe && pipe.snapshots) || [];
      snaps.forEach(function (w) { var date = w && w.startedAt ? String(w.startedAt).slice(0, 10) : null;
        (w && w.exercises || []).forEach(function (ex) { var name = String(ex && (ex.exerciseNameSnapshot || ex.name || ex.exerciseId) || ''); if (!name) return;
          (ex.sets || []).forEach(function (st) { if (!st || st.completed !== true) return; var t = st.setType || st.set_type || 'working'; if (t !== 'working' && t !== 'top' && t !== 'backoff' && t !== 'amrap') return;
            var reps = num(+st.reps), w0 = st.weight != null ? num(+st.weight) : (st.weightKg != null ? num(+st.weightKg) : null);
            if (reps == null || reps <= 0) return;
            if (w0 != null && w0 > 0 && reps <= 12) out.push({ exerciseName: name, estimatedOneRepMax: Math.round(w0 * (1 + reps / 30)), date: date, derived: true });
            if (w0 == null || w0 === 0) out.push({ exerciseName: name, repetitions: reps, date: date, derived: true }); }); }); });
    } catch (e) {}
    return out;
  }
  function bestLifts(records) {
    var out = LIFTS.map(function (l) { return { label: T(l[1]), key: l[1], re: new RegExp(l[0], 'i'), value: null, reps: null, date: null, derived: false }; });
    records = (records || []).concat(liftsFromTraining());
    (records || []).forEach(function (r) { if (!r) return; var name = String(r.exerciseName || r.exerciseId || '');
      out.forEach(function (o) { if (!o.re.test(name)) return; var v = num(r.estimatedOneRepMax) != null ? r.estimatedOneRepMax : num(r.weightKg);
        if (o.key === 'pv.lift_pullup' && num(r.repetitions) != null) { if (o.reps == null || r.repetitions > o.reps) { o.reps = r.repetitions; o.date = r.date || null; o.derived = !!r.derived; } return; }
        if (o.key === 'pv.lift_pullup') return;
        if (v != null && (o.value == null || v > o.value)) { o.value = v; o.date = r.date || null; o.derived = !!r.derived; } }); });
    return out;
  }
  function srcLabel(s) { var map = { manual: T('pv.src_manual'), garmin: 'Garmin', strava: 'Strava', apple_health: 'Apple Health', import: T('pv.src_import'), calculated: T('pv.src_calculated'), activity: T('pv.src_activity'), derived_estimate: T('pv.src_estimate'), device: T('pv.src_device'), device_sync: T('pv.src_device'), provider_sync: T('pv.src_device'), automatic: T('pv.src_auto'), auto: T('pv.src_auto'), garmin_unofficial: 'Garmin', garmin_connect: 'Garmin' }; return map[s] || (s ? String(s) : ''); }
  function performanceHTML(d) {
    var h = '<div class="kpi-row">' +
      '<div class="kpi"><b>' + esc(d.vo2 ? fmtDe(d.vo2.value) : '—') + '</b><span>VO₂max</span><small>' + esc(d.vo2 ? (srcLabel(d.vo2.source) || T('pv.gemessen')) : T('pv.keine_quelle')) + '</small></div>' +
      '<div class="kpi"><b>' + esc(d.load && d.load.ctl != null ? d.load.ctl : '—') + '</b><span>' + esc(T('pv.fitness')) + '</span><small>' + esc(d.load && d.load.suppressed ? T('pv.last_unsicher') : 'CTL') + '</small></div>' +
      '<div class="kpi"><b>' + esc(d.load && d.load.acwr != null ? fmtDe(d.load.acwr, 2) : '—') + '</b><span>ACWR</span><small>' + esc(d.load && d.load.acwr != null ? (d.load.acwr >= 0.8 && d.load.acwr <= 1.3 ? T('pv.im_korridor') : T('pv.ausserhalb')) : T('pv.zu_wenig_daten')) + '</small></div></div>';
    /* Bestzeiten Laufen */
    var b = d.bests, keys = [['5 km', 't5', 'k5'], ['10 km', 't10', 'k10'], ['HM', 't21', 'k21'], ['M', 't42', 'k42']];
    h += sectlabel(T('pv.bestzeiten_laufen'), { label: esc(T('pv.alle')), onclick: "gmOpenProfPage('bestTimes')" });
    h += '<div class="card tight"><div class="pv-bt">' + keys.map(function (k) {
      var sec = b ? b[k[1]] : null, real = !!(b && b.real && b.real[k[2]]), m = b && b.meas ? b.meas[k[2]] : null;
      var from = b && b.estFrom ? b.estFrom[k[2]] : null, fromLbl = { k1: '1 km', k5: '5 km', k10: '10 km', k21: 'HM', k42: 'M' }[from];
      var sub = sec == null ? T('pv.keine_messung') : (real ? (T('pv.gemessen') + (m && m.date ? ' · ' + deDate(m.date) : '')) : (fromLbl ? T('pv.geschaetzt_aus', { d: fromLbl }) : T('pv.geschaetzt_riegel')));
      return '<div class="pv-btrow"><div class="pv-btd"><b>' + esc(k[0]) + '</b></div><div class="pv-btb"><div class="pv-btt' + (sec == null ? ' muted' : '') + '">' + esc(sec != null ? fmtSec(sec) : '—') + '</div><div class="pv-bts">' + esc(sub) + '</div></div></div>';
    }).join('') + '</div></div>';
    /* Rad / Schwimmen */
    var ba = d.bestsAll || {};
    var other = [['cycling', 'k20', '20 km', T('pv.rad')], ['cycling', 'k40', '40 km', T('pv.rad')], ['swimming', 'm400', '400 m', T('pv.schwimmen')], ['swimming', 'm1500', '1500 m', T('pv.schwimmen')]];
    var rows = other.map(function (o) { var m = ba[o[0]] && ba[o[0]][o[1]]; return { label: o[2], sport: o[3], sec: m ? m.sec : null, date: m ? m.date : null }; });
    if (rows.some(function (r) { return r.sec != null; })) {
      h += sectlabel(T('pv.bestzeiten_rad_schwimmen'));
      h += '<div class="card tight"><div class="pv-bt">' + rows.map(function (r) { return '<div class="pv-btrow"><div class="pv-btd"><b>' + esc(r.label) + '</b><small>' + esc(r.sport) + '</small></div><div class="pv-btb"><div class="pv-btt' + (r.sec == null ? ' muted' : '') + '">' + esc(r.sec != null ? fmtSec(r.sec) : '—') + '</div><div class="pv-bts">' + esc(r.sec != null ? T('pv.gemessen') + (r.date ? ' · ' + deDate(r.date) : '') : T('pv.keine_messung')) + '</div></div></div>'; }).join('') + '</div></div>';
    }
    /* Kraftwerte */
    var lifts = bestLifts(d.strengthRecords), missing = lifts.filter(function (l) { return l.value == null && l.reps == null; }).length;
    h += sectlabel(T('pv.kraftwerte'), { label: esc(T('pv.pflegen')), onclick: "gmOpenProfPage('performance')" });
    h += '<div class="card tight"><div class="datarow" style="margin-top:0">' + lifts.map(function (l) { var v = l.reps != null ? l.reps + ' ' + T('pv.wdh') : (l.value != null ? fmtDe(l.value) + ' kg' : null); var src = v ? (l.derived ? T(l.reps != null ? 'pv.lift_aus_training_wdh' : 'pv.lift_aus_training') : T('pv.lift_eingetragen')) + (l.date ? ' · ' + deDate(l.date) : '') : T('pv.lift_fehlt'); return '<div class="datacell"><div class="dl">' + esc(l.label) + '</div><div class="dn' + (v ? '' : ' muted') + '">' + esc(v || '—') + '</div><div class="ds">' + esc(src) + '</div></div>'; }).join('') + '</div>' +
      (missing ? '<div class="gapnote" style="margin:12px 0 0">' + ic('alert', 'sm') + '<div>' + esc(T('pv.kraft_fehlend', { n: missing })) + '</div></div>' : '') + '</div>';
    /* Zonen & Schwellen */
    var hf = d.hfMax, rh = d.restingHr, th = d.threshold;
    var hfSub = hf ? (hf.source === 'derived_estimate' ? T('pv.hf_geschaetzt_alter') : (T('pv.gemessen') + (hf.updatedAt ? ' · ' + deDate(hf.updatedAt) : ''))) : T('pv.hf_fehlt');
    h += sectlabel(T('pv.zonen_schwellen'), { label: esc(T('pv.leistungsdaten')), onclick: "gmOpenProfPage('performance')" });
    h += '<div class="card tight">' +
      '<div class="prow pv-row"><div class="p-b"><div class="p-t">' + esc(T('pv.hfmax')) + '</div><div class="p-d">' + esc(hfSub) + '</div></div><div class="p-v' + (hf && hf.source === 'derived_estimate' ? ' pv-est' : '') + '">' + esc(hf ? hf.value + (hf.source === 'derived_estimate' ? ' · ' + T('pv.geschaetzt') : '') : '—') + '</div></div>' +
      '<div class="prow pv-row"><div class="p-b"><div class="p-t">' + esc(T('pv.ruhepuls')) + '</div><div class="p-d">' + esc(rh ? (srcLabel(rh.source) || T('pv.gemessen')) + (rh.updatedAt ? ' · ' + deDate(rh.updatedAt) : '') : T('pv.ruhepuls_fehlt')) + '</div></div><div class="p-v">' + esc(rh ? rh.value : '—') + '</div></div>' +
      '<div class="prow pv-row" style="border-bottom:none"><div class="p-b"><div class="p-t">' + esc(T('pv.schwellenpace')) + '</div><div class="p-d">' + esc(th && th.ref ? T('pv.schwelle_aus', { km: fmtDe(th.ref.distanceKm), date: th.ref.date ? deDate(th.ref.date) : '' }) : T('pv.schwelle_fehlt')) + '</div></div><div class="p-v">' + esc(th && th.paceSec ? fmtPace(th.paceSec) + ' /km' : '—') + '</div></div></div>';
    h += '<div class="setting-group pv-links">' + [['bolt', T('pv.medaillen'), "gmOpenProfPage('medals')"], ['target', T('pv.meilensteine'), "gmOpenProfPage('milestones')"], ['gauge', T('pv.pace_rechner'), "gmOpenProfPage('paceCalc')"]].map(function (r) { return '<div class="prow" onclick="' + r[2] + '"><div class="p-ic">' + ic(r[0], 'sm') + '</div><div class="p-b"><div class="p-t">' + esc(r[1]) + '</div></div>' + ic('chev', 'sm') + '</div>'; }).join('') + '</div>';
    return h;
  }

  /* ---------- Profilstärke-Karte (v14 ps-card) ---------- */
  /* Bei 100 % ohne Luecken verschwindet die Karte: Eine Vollzugsmeldung ist kein Produktinhalt (Gian, 13.09.). */
  function strengthNeedsCard(st) { if (!st) return false; var pct = Math.round(st.score || 0); return pct < 100 || (st.gaps || []).length > 0; }
  function strengthCardHTML(st) {
    if (!st) return '';
    var pct = Math.max(0, Math.min(100, Math.round(st.score || 0))), c = 2 * Math.PI * 23, off = c * (1 - pct / 100);
    var gaps = (st.gaps || []).slice(0, 3);
    return '<div class="ps-card tap" onclick="gmProfEdit()">' +
      '<div class="ps-top"><div class="ps-ring"><svg width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r="23" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="6"/><circle cx="27" cy="27" r="23" fill="none" stroke="url(#pvpsg)" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/><defs><linearGradient id="pvpsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#DCC79A"/><stop offset="1" stop-color="#8E7647"/></linearGradient></defs></svg><div class="ps-pct">' + pct + '%</div></div>' +
      '<div class="ps-b"><div class="ps-t">' + esc(T('pv.profilstaerke')) + '</div><div class="ps-d">' + esc(gaps.length ? T('pv.ps_luecken', { n: gaps.length }) : T('pc.alles_da_was_die_planung')) + '</div></div>' + ic('chev', 'sm') + '</div>' +
      (gaps.length ? '<div class="ps-gaps">' + gaps.map(function (g) { var act = g.action === 'goal_editor' ? "openGoalEditor('" + esc(g.goalId || '') + "')" : "openProfileSection('" + esc(g.sectionId || '') + "')"; return '<div class="ps-gap" onclick="event.stopPropagation();' + act + '"><div class="g-ic">' + ic('alert', 'xs') + '</div><div class="g-b"><div class="g-t">' + esc(g.label) + '</div><div class="g-d">' + esc(g.hint || '') + '</div></div><div class="g-w' + ((g.weight || 0) >= 15 ? '' : ' mid') + '">' + esc((g.weight || 0) >= 15 ? T('pv.hoch') : T('pv.mittel')) + '</div></div>'; }).join('') + '</div>' : '') + '</div>';
  }

  function navHTML(tab) {
    return '<div class="seg-nav" data-gm-slot="profile-tabs">' + [['ueber', T('pv.tab_ueber')], ['ziele', T('pv.tab_ziele')], ['leistung', T('pv.tab_leistung')]].map(function (t) { return '<button type="button" class="seg-btn' + (t[0] === tab ? ' on' : '') + '" data-tab="' + t[0] + '" onclick="ORVIA.screens.profileV14.setTab(\'' + t[0] + '\')">' + esc(t[1]) + '</button>'; }).join('') + '</div>';
  }
  function tabHTML(tab, d) { return tab === 'ziele' ? goalsHTML(d) : tab === 'leistung' ? performanceHTML(d) : overviewHTML(d); }

  /* render(): Kopf liefert ui.js (gmProfHeaderHTML), der Rest kommt von hier. */
  function render(host) {
    try {
      host = host || root.document.getElementById('gmProf'); if (!host) return false;
      var d = collect(), tab = activeTab();
      var head = ''; try { if (typeof root.gmProfHeaderHTML === 'function') head = root.gmProfHeaderHTML(d); } catch (e) { head = ''; }
      host.innerHTML = head + (strengthNeedsCard(d.strength) ? strengthCardHTML(d.strength) : '') + navHTML(tab) + '<div class="pv-tab" data-tab="' + tab + '">' + tabHTML(tab, d) + '</div><div class="tabspacer"></div>';
      return true;
    } catch (e) { try { console.warn('[ORVIA profile-v14] render', e && e.message); } catch (_) {} return false; }
  }

  /* ---------- Ziel-Sheet (Neues Ziel / Ziel bearbeiten) ---------- */
  var SHEET_GROUPS = ['endurance', 'strength', 'body_composition', 'health', 'team_sport', 'sport_performance', 'general'];
  var _sheet = null;
  function sheetModel(goal) {
    var M = O.profileModel, g = goal || null;
    var cat = g ? g.category : 'half_marathon', group = 'endurance';
    try { group = M && M.categoryOf ? M.categoryOf(cat) : group; } catch (e) {}
    if (!group || SHEET_GROUPS.indexOf(group) < 0) { for (var k in (M && M.GOAL_CATEGORIES || {})) if (M.GOAL_CATEGORIES[k].indexOf(cat) >= 0) group = k; }
    return { id: g ? g.id : null, group: group, category: cat, title: g ? (g.title || '') : '', targetDate: g ? (g.targetDate || '') : '', priority: g ? (g.priority || 1) : 1,
      targetValue: g ? g.targetValue : null, unit: g ? g.unit : null, metricType: g ? g.metricType : null, status: g ? g.status : 'active' };
  }
  function metricTypeFor(cat) { try { var M = O.profileModel; if (M && M.goalMetricTypeFor) return M.goalMetricTypeFor(cat); } catch (e) {} return null; }
  function sheetHTML(m) {
    var M = O.profileModel, groups = SHEET_GROUPS.filter(function (k) { return M && M.GOAL_CATEGORIES && M.GOAL_CATEGORIES[k]; });
    var groupLabel = function (k) { try { return root.GOAL_GROUP_DE && root.GOAL_GROUP_DE[k] || k; } catch (e) { return k; } };
    var cats = (M && M.GOAL_CATEGORIES && M.GOAL_CATEGORIES[m.group]) || [];
    var mt = metricTypeFor(m.category);
    var valField = mt === 'time'
      ? '<div class="gm-field"><label>' + esc(T('pv.zielzeit')) + '</label><input id="pvg_time" inputmode="numeric" placeholder="1:50:00" value="' + esc(m.targetValue != null && m.metricType === 'time' ? fmtSec(m.targetValue) : '') + '"></div>'
      : (mt ? '<div class="gm-field"><label>' + esc(T('pv.zielwert')) + (m.unit ? ' (' + esc(m.unit) + ')' : '') + '</label><input id="pvg_val" inputmode="decimal" value="' + esc(m.targetValue != null ? m.targetValue : '') + '"></div>' : '<p class="muted pv-sheet-note">' + esc(T('pv.kein_zielwert_noetig')) + '</p>');
    return '<div class="pv-sheet">' +
      '<p class="muted pv-sheet-note">' + esc(T('pv.sheet_intro')) + '</p>' +
      '<div class="gm-field"><label>' + esc(T('pv.kategorie')) + '</label><div class="gm-chips">' + groups.map(function (k) { return '<button type="button" class="gm-chip' + (k === m.group ? ' on' : '') + '" onclick="ORVIA.screens.profileV14.sheetPick(\'group\',\'' + k + '\')">' + esc(groupLabel(k)) + '</button>'; }).join('') + '</div></div>' +
      '<div class="gm-field"><label>' + esc(T('pv.ziel')) + '</label><div class="gm-chips">' + cats.map(function (c) { return '<button type="button" class="gm-chip' + (c === m.category ? ' on' : '') + '" onclick="ORVIA.screens.profileV14.sheetPick(\'category\',\'' + c + '\')">' + esc(catLabel(c)) + '</button>'; }).join('') + '</div></div>' +
      '<div class="gm-field"><label>' + esc(T('pv.titel_optional')) + '</label><input id="pvg_title" value="' + esc(m.title) + '" placeholder="' + esc(catLabel(m.category)) + '"></div>' +
      '<div class="row2">' + valField + '<div class="gm-field"><label>' + esc(T('pv.datum')) + '</label><input id="pvg_date" type="date" value="' + esc(m.targetDate) + '"></div></div>' +
      '<div class="gm-field"><label>' + esc(T('pv.prioritaet')) + '</label><div class="gm-chips">' + [[1, T('pv.role_main'), T('pv.prio1_hint')], [2, T('pv.role_secondary'), T('pv.prio2_hint')], [4, T('pv.role_longterm'), T('pv.prio4_hint')]].map(function (p) { return '<button type="button" class="gm-chip' + (p[0] === m.priority ? ' on' : '') + '" onclick="ORVIA.screens.profileV14.sheetPick(\'priority\',' + p[0] + ')" title="' + esc(p[2]) + '">' + esc(p[1]) + '</button>'; }).join('') + '</div><div class="gmc-meta">' + esc(m.priority === 1 ? T('pv.prio1_hint') : m.priority === 2 ? T('pv.prio2_hint') : T('pv.prio4_hint')) + '</div></div>' +
      (m.id ? '<div class="gmc-meta pv-impact" id="pvg_impact"></div>' : '') +
      '<div class="gmc-meta pv-err" id="pvg_err"></div>' +
      '<button type="button" class="pv-more-btn" onclick="ORVIA.screens.profileV14.sheetMore()">' + esc(T('pv.mehr_optionen')) + '</button>' +
      '</div>';
  }
  function sheetCollect() {
    var m = _sheet; if (!m) return null;
    var doc = root.document, t = doc.getElementById('pvg_title'), dt = doc.getElementById('pvg_date'), tm = doc.getElementById('pvg_time'), va = doc.getElementById('pvg_val');
    if (t) m.title = String(t.value || '').trim();
    if (dt) m.targetDate = String(dt.value || '').trim() || '';
    var mt = metricTypeFor(m.category); m.metricType = mt;
    if (tm) { var raw = String(tm.value || '').trim(); if (!raw) { m.targetValue = null; m.unit = 's'; } else { var sec = null; try { sec = O.profileModel.parseDuration(raw); } catch (e) {} m.targetValue = sec != null && sec > 0 ? sec : NaN; m.unit = 's'; } }
    else if (va) { var v = String(va.value || '').replace(',', '.').trim(); m.targetValue = v === '' ? null : (isNaN(+v) ? NaN : +v); }
    return m;
  }
  function sheetValidate(m) {
    if (!m.category) return T('pv.err_kategorie');
    if (typeof m.targetValue === 'number' && isNaN(m.targetValue)) return metricTypeFor(m.category) === 'time' ? T('pv.err_zeit') : T('pv.err_wert');
    if (m.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(m.targetDate)) return T('pv.err_datum');
    return null;
  }
  function sheetImpact(m) {
    /* Auswirkung dieser Aenderung — planKey-Vergleich (B-01) fuer das Hauptziel. */
    try {
      if (!m.id || !O.goalPlanInput) return '';
      var old = (root.listGoals() || []).filter(function (g) { return g.id === m.id; })[0]; if (!old) return '';
      var isMain = root.mainGoalOf && root.mainGoalOf() && root.mainGoalOf().id === m.id; if (!isMain) return T('pv.impact_nebenziel');
      var mk = function (g) { return O.goalPlanInput.planKey(O.goalPlanInput.resolve({ goal: g, today: today(), canon: (O.profileModel && O.profileModel.canonGoalCategory) || null, taper: O.goalTaperResolver || null })); };
      var neu = Object.assign({}, old, { category: m.category, targetDate: m.targetDate || null, targetValue: (typeof m.targetValue === 'number' && !isNaN(m.targetValue)) ? m.targetValue : old.targetValue, unit: m.unit || old.unit, metricType: m.metricType || old.metricType, priority: m.priority });
      return mk(old) === mk(neu) ? T('pv.impact_keine') : T('pv.impact_neu');
    } catch (e) { return ''; }
  }
  function sheetRefresh() {
    var m = _sheet; if (!m) return;
    var body = root.document.getElementById('pvg_body'); if (body) body.innerHTML = sheetHTML(m);
    var imp = root.document.getElementById('pvg_impact'); if (imp) imp.textContent = sheetImpact(m);
  }
  function openGoalSheet(id) {
    if (typeof root.openSheet !== 'function') { try { root.openGoalEditor(id); } catch (e) {} return; }
    var g = null; try { g = id ? (root.listGoals() || []).filter(function (x) { return x.id === id; })[0] : null; } catch (e) {}
    _sheet = sheetModel(g);
    root.openSheet({ id: '_pvGoal', title: esc(id ? T('pv.ziel_bearbeiten') : T('pv.neues_ziel')), body: '<div id="pvg_body">' + sheetHTML(_sheet) + '</div>',
      actions: '<button type="button" class="btn" onclick="ORVIA.screens.profileV14.sheetSave()">' + esc(id ? T('common.save') : T('pv.ziel_anlegen')) + '</button><button type="button" class="btn sec" onclick="_closeM(\'_pvGoal\')">' + esc(T('common.cancel')) + '</button>' });
    sheetRefresh();
  }
  function sheetPick(field, value) {
    var m = sheetCollect(); if (!m) return;
    if (field === 'group') { m.group = value; var M = O.profileModel; var cats = (M && M.GOAL_CATEGORIES && M.GOAL_CATEGORIES[value]) || []; m.category = cats[0] || null; m.targetValue = null; m.unit = null; }
    else if (field === 'category') { m.category = value; m.targetValue = null; m.unit = null; }
    else if (field === 'priority') m.priority = value;
    sheetRefresh();
  }
  function sheetSave() {
    var m = sheetCollect(); if (!m) return;
    var err = sheetValidate(m); var el = root.document.getElementById('pvg_err');
    if (err) { if (el) el.textContent = err; return; }
    var patch = { category: m.category, title: m.title || catLabel(m.category), targetDate: m.targetDate || null, priority: m.priority, status: m.status || 'active',
      metricType: m.metricType || null, targetValue: (typeof m.targetValue === 'number' && !isNaN(m.targetValue)) ? m.targetValue : null, unit: m.unit || (m.metricType === 'time' ? 's' : null) };
    try { if (m.id) root.goalUpdate(m.id, patch); else root.goalAdd(patch); } catch (e) { if (el) el.textContent = T('pv.err_speichern'); return; }
    try { root._closeM('_pvGoal'); } catch (e) {}
    try { if (typeof root.toast === 'function') root.toast(m.id ? T('pv.ziel_gespeichert') : T('pv.ziel_angelegt')); } catch (e) {}
    try { if (typeof root.renderRaceHeader === 'function') root.renderRaceHeader(); } catch (e) {}
    render();
  }
  function sheetMore() { var m = sheetCollect(); try { root._closeM('_pvGoal'); } catch (e) {} try { root.openGoalEditor(m && m.id ? m.id : undefined); } catch (e) {} }

  var api = { VERSION: VERSION, collect: collect, overviewHTML: overviewHTML, goalsHTML: goalsHTML, performanceHTML: performanceHTML,
    strengthCardHTML: strengthCardHTML, strengthNeedsCard: strengthNeedsCard, navHTML: navHTML, render: render, setTab: setTab, activeTab: activeTab, goalCard: goalCard, bestLifts: bestLifts,
    openGoalSheet: openGoalSheet, sheetPick: sheetPick, sheetSave: sheetSave, sheetMore: sheetMore, sheetModel: sheetModel, sheetHTML: sheetHTML, sheetValidate: sheetValidate, sheetImpact: sheetImpact };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.screens.profileV14 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
