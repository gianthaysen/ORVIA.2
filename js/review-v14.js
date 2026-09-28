/* ============================================================
   ORVIA · review-v14 — Rueckblick Woche (Prototyp v14 scrReview, S5b)
   ------------------------------------------------------------
   Planerfuellung (Ring), Kennzahlen, staerkste Einheit, Belastung (nur
   laufende Woche), Stellschraube fuer naechste Woche (Engpass der
   Planqualitaet), Erholung, Vergleich zur Vorwoche. JEDER Wert kommt aus
   einer vorhandenen Quelle: Plan-Ist-Resolver (byOcc), activityConfig.
   weeklyActivityTotals, readinessOf/DB.morning, Calc.loadModel, plan-quality.
   Fehlt eine Quelle, bleibt das Feld null und die Karte sagt es — nichts wird
   hochgerechnet. Kein Zustand ausser dem gewaehlten Wochenversatz.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var T = function (k, p) { try { var I = O.i18n; if (I && typeof I.t === 'function') return I.t(k, p); } catch (e) {} return String(k); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ic(n, s) { try { return (typeof root.icon === 'function') ? root.icon(n, s) : ''; } catch (e) { return ''; } }
  function de(v, d) { try { if (typeof root.fmtDe === 'function') return root.fmtDe(v); } catch (e) {} var p = Math.pow(10, d || 0); return String(Math.round(v * p) / p).replace('.', ','); }
  function today() { return (typeof root.todayStr === 'function') ? root.todayStr() : new Date().toISOString().slice(0, 10); }
  function iso(d) { return (typeof root.todayStr === 'function') ? root.todayStr(d) : d.toISOString().slice(0, 10); }
  function weekDates(off) {
    var now = new Date(today() + 'T12:00'); var wd = (now.getDay() + 6) % 7;
    var mon = new Date(now); mon.setDate(now.getDate() - wd + (off || 0) * 7);
    var out = []; for (var i = 0; i < 7; i++) { var d = new Date(mon); d.setDate(mon.getDate() + i); out.push(iso(d)); }
    return out;
  }
  function fmtH(min) { if (min == null || !isFinite(min)) return null; var h = Math.floor(min / 60), m = Math.round(min % 60); if (m === 60) { h++; m = 0; } return h + ':' + (m < 10 ? '0' : '') + m; }
  function avg(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }

  /* ---- Rohdaten einer Woche ---- */
  function weekRaw(off) {
    var dates = weekDates(off), tod = today();
    var r = { off: off || 0, dates: dates, from: dates[0], to: dates[6], ongoing: dates[6] >= tod,
      planned: 0, due: 0, done: 0, keyPlanned: 0, keyDone: 0, restPlanned: 0, restKept: 0, missed: [],
      totals: null, bySport: null, acts: [], elevationM: null, longest: null, longestByTime: null, implausible: [],
      readiness: [], sleepH: [], hrv: [] };
    /* Plan + Resolver */
    var plan = null;
    try { plan = (typeof root.gmPlanForOffset === 'function') ? root.gmPlanForOffset(r.off) : null; } catch (e) {}
    var days = plan && plan.days && plan.days.length === 7 ? plan.days : null;
    var byOcc = {};
    try { if (typeof root.planActualResolveForDates === 'function') byOcc = (root.planActualResolveForDates(dates) || {}).byOcc || {}; } catch (e) {}
    r.planAvailable = !!days;
    if (days) {
      for (var di = 0; di < 7; di++) {
        var items = days[di] || [], day = dates[di], past = day <= tod;
        if (!items.length) { r.restPlanned++; continue; }
        items.forEach(function (it) {
          if (!it || !it.t) return;
          r.planned++;
          var occ = it.id ? ('po:' + day + ':' + it.id) : null;
          var res = occ ? byOcc[occ] : null;
          var done = !!(res && res.state === 'completed');
          var key = false; try { key = (typeof root.gmPlanIsKeyUnit === 'function') && root.gmPlanIsKeyUnit(it) === true; } catch (e) {}
          if (key) r.keyPlanned++;
          if (past) r.due++;
          if (done) { r.done++; if (key) r.keyDone++; }
          else if (past && day < tod) r.missed.push({ day: di, label: it.l || it.t, key: key });
        });
      }
    }
    /* Aktivitaeten der Woche */
    try {
      var st = O.activityStore, cfg = O.activityConfig;
      var acts = (st && st.listActivities) ? (st.listActivities() || []) : [];
      var tomb = (st && st.isTombstoned) ? st.isTombstoned : null;
      var tz = (O.profileStore && O.profileStore.effectiveTimezone) ? O.profileStore.effectiveTimezone() : 'UTC';
      var DBv = (typeof root.DB !== 'undefined') ? root.DB : {};
      if (cfg && cfg.weeklyActivityTotals) {
        var wk = cfg.weeklyActivityTotals(acts, DBv, { weekRef: dates[0], timezone: tz, isTombstoned: tomb });
        if (wk) { r.totals = wk.totals; r.bySport = wk.bySport; }
      }
      var dset = {}; dates.forEach(function (d) { dset[d] = 1; });
      var elev = 0, elevKnown = false;
      acts.forEach(function (a) {
        if (!a || (tomb && tomb(a))) return;
        var ld = (cfg && cfg.dayOfActLocal) ? cfg.dayOfActLocal(a, tz) : String(a.startedAt || '').slice(0, 10);
        if (!dset[ld]) return;
        r.acts.push(a);
        var s = a.summary || {};
        if (s.elevationM != null && isFinite(s.elevationM)) { elev += s.elevationM; elevKnown = true; }
        var km = (s.distanceKm != null) ? s.distanceKm : null;
        var durMin = a.durationSeconds != null ? a.durationSeconds / 60 : null;
        var ent = { km: km, day: ld, sportId: a.sportId || null, name: s.name || null, durationMin: durMin, id: a.id || a.clientRecordId || null };
        /* Laengste Einheit: nur mit echter Distanz (> 0). Ohne Distanzsport in der Woche
           faellt die Karte auf die laengste Dauer zurueck — dann ohne „0 km". */
        if (km > 0 && (!r.longest || km > r.longest.km)) r.longest = ent;
        if (durMin > 0 && (!r.longestByTime || durMin > r.longestByTime.durationMin)) r.longestByTime = ent;
        /* Unplausible Dauer (> 8 h in einer Einheit): faelscht Stunden und Vergleich —
           benennen statt stillschweigend summieren. */
        if (durMin > 480) r.implausible.push(ent);
      });
      r.elevationM = elevKnown ? Math.round(elev) : null;
      /* Ruhetage eingehalten: geplant frei UND keine Aktivitaet an dem Tag */
      if (days) { var actDays = {}; r.acts.forEach(function (a) { var ld = (cfg && cfg.dayOfActLocal) ? cfg.dayOfActLocal(a, tz) : String(a.startedAt || '').slice(0, 10); actDays[ld] = 1; });
        for (var dj = 0; dj < 7; dj++) { if (!(days[dj] || []).length && dates[dj] <= tod && !actDays[dates[dj]]) r.restKept++; } }
    } catch (e) {}
    /* Erholung */
    try {
      var DB2 = (typeof root.DB !== 'undefined') ? root.DB : {};
      dates.forEach(function (k) {
        if (k > tod) return;
        var e = DB2[k]; if (!e) return;
        var rv = null; try { rv = (typeof root.readinessOf === 'function') ? root.readinessOf(k) : null; } catch (x) {}
        if (rv != null) r.readiness.push(rv);
        if (e.morning) { if (e.morning.sleepMin) r.sleepH.push(e.morning.sleepMin / 60); if (e.morning.hrvMs != null) r.hrv.push(Number(e.morning.hrvMs)); }
      });
    } catch (e) {}
    return r;
  }

  /* ---- Modell (reine Sicht) ---- */
  function model(off) {
    var w = weekRaw(off), p = weekRaw((off || 0) - 1);
    var m = { off: w.off, from: w.from, to: w.to, ongoing: w.ongoing, planAvailable: w.planAvailable };
    m.fulfil = w.planAvailable ? { done: w.done, due: w.ongoing ? w.due : w.planned, planned: w.planned, pct: (w.ongoing ? w.due : w.planned) > 0 ? Math.round(w.done / (w.ongoing ? w.due : w.planned) * 100) : null, keyDone: w.keyDone, keyPlanned: w.keyPlanned, missed: w.missed } : null;
    var run = w.bySport && w.bySport.running;
    m.kpi = {
      km: run ? (run.distanceKm != null ? run.distanceKm : (run.knownDistanceKm > 0 ? run.knownDistanceKm : null)) : null,
      kmComplete: !!(run && run.completeness && run.completeness.distance),
      hours: w.totals ? (w.totals.durationMin != null ? w.totals.durationMin : (w.totals.knownDurationMin > 0 ? w.totals.knownDurationMin : null)) : null,
      hoursComplete: !!(w.totals && w.totals.completeness && w.totals.completeness.duration),
      elevationM: w.elevationM, sessions: w.totals ? w.totals.sessionCount : w.acts.length
    };
    m.longest = w.longest; m.longestByTime = w.longest ? null : w.longestByTime; m.implausible = w.implausible; m.prevImplausible = p.implausible;
    /* Belastung nur fuer die laufende Woche: ACWR ist ein Jetzt-Wert */
    m.load = null;
    if (w.off === 0) {
      try {
        var L = (typeof root.allLoads === 'function') ? root.allLoads() : null;
        var C = root.Calc;
        if (L && C && C.loadModel) {
          var lm = C.loadModel(L.loads); var cc = C.loadConfidenceContract ? C.loadConfidenceContract(L.confidence) : null;
          if (lm && lm.acwr != null && lm.acwrReliable && !(cc && cc.suppressNumbers)) m.load = { acwr: Math.round(lm.acwr * 100) / 100, band: Math.max(4, Math.min(96, Math.round((lm.acwr - 0.4) / (1.8 - 0.4) * 100))), zone: lm.acwr < 0.8 ? 'low' : lm.acwr <= 1.3 ? 'ok' : lm.acwr <= 1.5 ? 'high' : 'over' };
        }
      } catch (e) {}
    }
    /* Stellschraube: Engpass der Planqualitaet (nur fuer die laufende/naechste Planung sinnvoll) */
    m.lever = null;
    try {
      if (typeof root.gmGoalBottleneckText === 'function' && typeof root.gmPlanQualityEval === 'function' && typeof root.activeWeekPlan === 'function') {
        var perf = (O._lastPlanPerf && O._lastPlanPerf.sports) || null;
        var pq = root.gmPlanQualityEval(root.activeWeekPlan(), perf);
        var txt = root.gmGoalBottleneckText(pq);
        if (txt) m.lever = { text: txt, score: pq && pq.score != null ? pq.score : null };
      }
    } catch (e) {}
    m.recovery = { readiness: w.readiness.length ? Math.round(avg(w.readiness)) : null, readinessPrev: p.readiness.length ? Math.round(avg(p.readiness)) : null,
      sleepH: w.sleepH.length ? avg(w.sleepH) : null, hrv: w.hrv.length ? Math.round(avg(w.hrv)) : null, restKept: w.restKept, restPlanned: w.restPlanned, n: w.readiness.length };
    /* Vergleich zur Vorwoche: gleiche Messbasis (beide Wochen vollstaendig) */
    var prun = p.bySport && p.bySport.running;
    var cmp = [];
    function row(key, a, b, unit, dec, fmt) {
      if (a == null || b == null) return;
      var delta = a - b; var pct = b > 0 ? Math.round(delta / b * 100) : null;
      cmp.push({ key: key, from: fmt ? fmt(b) : de(b, dec) + unit, to: fmt ? fmt(a) : de(a, dec) + unit, delta: delta, pct: pct, dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' });
    }
    row('km', run && run.distanceKm != null ? Math.round(run.distanceKm * 10) / 10 : null, prun && prun.distanceKm != null ? Math.round(prun.distanceKm * 10) / 10 : null, ' km', 1);
    row('hours', w.totals && w.totals.durationMin != null ? w.totals.durationMin : null, p.totals && p.totals.durationMin != null ? p.totals.durationMin : null, '', 0, fmtH);
    row('sessions', w.totals ? w.totals.sessionCount : null, p.totals ? p.totals.sessionCount : null, '', 0);
    row('gym', w.bySport && w.bySport.gym ? w.bySport.gym.sessionCount : (w.bySport ? 0 : null), p.bySport && p.bySport.gym ? p.bySport.gym.sessionCount : (p.bySport ? 0 : null), '', 0);
    m.compare = cmp;
    m.empty = !w.planAvailable && !w.acts.length && !w.readiness.length;
    return m;
  }

  /* ---- Markup ---- */
  var SPORT_ICON = { running: 'run', cycling: 'activity', gym: 'dumbbell', swimming: 'activity' };
  function ring(pct, size, sw) {
    var r = (size - sw) / 2, c = 2 * Math.PI * r, off = pct == null ? c : c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="' + sw + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--gold)" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
  }
  function kpi(v, lab) { return '<div class="rev-kpi"><b>' + (v == null ? '—' : esc(v)) + '</b><span>' + esc(lab) + '</span></div>'; }
  function html(m) {
    if (!m) return '';
    if (m.empty) return '<div class="card"><div class="kp-empty"><div class="t">' + esc(T('rev.empty_t')) + '</div><div class="d">' + esc(T('rev.empty_d')) + '</div></div></div>';
    var h = '';
    var f = m.fulfil;
    h += '<div class="card"><div class="ctitle"><div class="l">' + ic('flag') + ' ' + esc(T('rev.planerfuellung')) + '</div>' + (m.ongoing ? '<span class="more">' + esc(T('rev.laufend')) + '</span>' : '') + '</div>';
    if (f) {
      h += '<div class="rev-hero"><div class="rev-ring">' + ring(f.pct, 76, 7) + '<div class="v"><b>' + f.done + '/' + f.due + '</b><span>' + esc(T('rev.einheiten')) + '</span></div></div>' +
        '<div class="rev-kpis">' + kpi(m.kpi.km != null ? (m.kpi.kmComplete ? '' : '≥ ') + de(Math.round(m.kpi.km * 10) / 10, 1) : null, 'km') + kpi(m.kpi.hours != null ? (m.kpi.hoursComplete ? '' : '≥ ') + fmtH(m.kpi.hours) : null, T('rev.stunden')) + kpi(m.kpi.elevationM, 'hm') + '</div></div>';
      if (f.keyPlanned) h += '<div class="rev-line">' + ic('bolt', 'xs') + ' ' + esc(T('rev.kernreize', { done: f.keyDone, planned: f.keyPlanned })) + '</div>';
      if (f.missed.length) h += '<div class="gapnote rev-gap">' + ic('info', 'sm') + '<div>' + esc(T('rev.ausgefallen', { count: f.missed.length })) + ' ' + f.missed.map(function (x) { return '<b>' + esc(x.label) + '</b>'; }).join(', ') + (f.missed.some(function (x) { return x.key; }) ? ' — ' + esc(T('rev.kernreiz_fehlt')) : '') + '</div></div>';
    } else {
      h += '<div class="rev-kpis">' + kpi(m.kpi.km != null ? de(Math.round(m.kpi.km * 10) / 10, 1) : null, 'km') + kpi(m.kpi.hours != null ? fmtH(m.kpi.hours) : null, T('rev.stunden')) + kpi(m.kpi.sessions, T('rev.einheiten')) + '</div><div class="source">' + ic('info', 'xs') + ' ' + esc(T('rev.kein_plan')) + '</div>';
    }
    h += '</div>';
    if (m.implausible && m.implausible.length) {
      h += '<div class="card tight"><div class="gapnote rev-gap" style="margin:0">' + ic('alert', 'sm') + '<div>' + esc(T('rev.unplausibel', { count: m.implausible.length })) + ' ' + m.implausible.map(function (x) { return '<b' + (x.id ? ' role="button" tabindex="0" style="cursor:pointer;text-decoration:underline" onclick="gmOpenActivityPage(\'' + esc(String(x.id)) + '\')"' : '') + '>' + esc(x.name || ((O.activityConfig && O.activityConfig.sportLabel) ? O.activityConfig.sportLabel(x.sportId) : x.sportId)) + ' · ' + fmtH(x.durationMin) + ' h</b>'; }).join(', ') + ' — ' + esc(T('rev.unplausibel_hint')) + '</div></div></div>';
    }
    if (!m.longest && m.longestByTime) {
      var lt = m.longestByTime; var labT = (O.activityConfig && O.activityConfig.sportLabel) ? O.activityConfig.sportLabel(lt.sportId) : (lt.sportId || '');
      h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('bolt') + ' ' + esc(T('rev.laengste_einheit_zeit')) + '</div></div><div class="rev-longest"' + (lt.id ? ' role="button" tabindex="0" onclick="gmOpenActivityPage(\'' + esc(String(lt.id)) + '\')"' : '') + '><div class="sh-hic">' + ic(SPORT_ICON[lt.sportId] || 'activity') + '</div><div class="rl-b"><div class="rl-t">' + esc(lt.name || labT) + ' · ' + fmtH(lt.durationMin) + ' h</div><div class="rl-s">' + esc(labT) + '</div></div>' + (lt.id ? ic('chev', 'sm') : '') + '</div></div>';
    }
    if (m.longest) {
      var lg = m.longest; var lab = (O.activityConfig && O.activityConfig.sportLabel) ? O.activityConfig.sportLabel(lg.sportId) : (lg.sportId || '');
      var pace = (lg.km > 0 && lg.durationMin > 0) ? (function (s) { var mm = Math.floor(s / 60), ss = Math.round(s % 60); return mm + ':' + (ss < 10 ? '0' : '') + ss + ' /km'; })(lg.durationMin * 60 / lg.km) : null;
      h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('bolt') + ' ' + esc(T('rev.laengste_einheit')) + '</div></div><div class="rev-longest"' + (lg.id ? ' role="button" tabindex="0" onclick="gmOpenActivityPage(\'' + esc(String(lg.id)) + '\')"' : '') + '><div class="sh-hic">' + ic(SPORT_ICON[lg.sportId] || 'run') + '</div><div class="rl-b"><div class="rl-t">' + esc(lg.name || lab) + ' · ' + de(Math.round(lg.km * 10) / 10, 1) + ' km</div><div class="rl-s">' + esc(lab) + (pace ? ' · ' + pace : '') + (lg.durationMin ? ' · ' + fmtH(lg.durationMin) + ' h' : '') + '</div></div>' + (lg.id ? ic('chev', 'sm') : '') + '</div></div>';
    }
    if (m.load) {
      var zk = { low: 'rev.acwr_low', ok: 'rev.acwr_ok', high: 'rev.acwr_high', over: 'rev.acwr_over' }[m.load.zone];
      h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('gauge') + ' ' + esc(T('rev.belastung')) + '</div></div><div class="rev-text">ACWR <b>' + de(m.load.acwr, 2) + '</b> — ' + esc(T(zk)) + '</div>' +
        '<div class="rev-band"><span class="mk" style="left:' + m.load.band + '%"></span><span class="lim" style="left:64%"></span></div><div class="rev-bandlbl"><span style="left:29%">0,8</span><span style="left:64%">1,3</span><span style="left:79%">1,5</span></div></div>';
    }
    if (m.lever) h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('trend') + ' ' + esc(T('rev.naechste_woche')) + '</div></div><div class="rev-reco"><div class="r-ic">' + ic('check', 'sm') + '</div><div><div class="rt">' + esc(T('rev.stellschraube')) + '</div><div class="rd">' + esc(m.lever.text) + '</div></div></div><div class="source">' + ic('info', 'xs') + ' ' + esc(T('rev.stellschraube_quelle')) + '</div></div>';
    var rc = m.recovery;
    if (rc.n || rc.sleepH != null) {
      var rdiff = (rc.readiness != null && rc.readinessPrev != null) ? (rc.readiness - rc.readinessPrev) : null;
      h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('heart') + ' ' + esc(T('rev.erholung')) + '</div></div><div class="datarow rev-data">' +
        '<div class="datacell"><div class="dl">Ø Readiness</div><div class="dn">' + (rc.readiness != null ? rc.readiness + (rdiff != null ? ' · ' + (rdiff >= 0 ? '+' : '') + rdiff + ' ' + esc(T('rev.vs_vorwoche')) : '') : '—') + '</div></div>' +
        '<div class="datacell"><div class="dl">Ø ' + esc(T('rev.schlaf')) + '</div><div class="dn">' + (rc.sleepH != null ? fmtH(rc.sleepH * 60) + ' h' : '—') + '</div></div>' +
        '<div class="datacell"><div class="dl">Ø HRV</div><div class="dn">' + (rc.hrv != null ? rc.hrv + ' ms' : '—') + '</div></div>' +
        '<div class="datacell"><div class="dl">' + esc(T('rev.ruhetage')) + '</div><div class="dn">' + (m.planAvailable ? rc.restKept + ' / ' + rc.restPlanned : '—') + '</div></div></div>' +
        '<div class="source">' + ic('info', 'xs') + ' ' + esc(T('rev.erholung_quelle', { n: rc.n })) + '</div></div>';
    }
    if (m.compare.length) {
      var LBL = { km: T('rev.cmp_km'), hours: T('rev.cmp_hours'), sessions: T('rev.cmp_sessions'), gym: T('rev.cmp_gym') };
      h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('trend') + ' ' + esc(T('rev.vergleich')) + '</div></div>' +
        m.compare.map(function (r) { var d = r.pct != null ? ((r.pct > 0 ? '+' : '') + r.pct + ' %') : ((r.delta > 0 ? '+' : '') + de(r.delta, 1)); return '<div class="eff-row"><span class="l">' + esc(LBL[r.key]) + '<small>' + esc(r.from) + ' → ' + esc(r.to) + '</small></span><span class="v' + (r.dir === 'up' ? ' up' : '') + '">' + esc(d) + '</span></div>'; }).join('') +
        ((m.prevImplausible && m.prevImplausible.length) ? '<div class="gapnote rev-gap">' + ic('alert', 'sm') + '<div>' + esc(T('rev.vorwoche_unplausibel')) + ' ' + m.prevImplausible.map(function (x) { return '<b' + (x.id ? ' role="button" tabindex="0" style="cursor:pointer;text-decoration:underline" onclick="gmOpenActivityPage(\'' + esc(String(x.id)) + '\')"' : '') + '>' + esc(x.name || x.sportId) + ' · ' + fmtH(x.durationMin) + ' h</b>'; }).join(', ') + '</div></div>' : '') +
        '<div class="source">' + ic('info', 'xs') + ' ' + esc(T('rev.vergleich_quelle')) + '</div></div>';
    }
    return h;
  }

  /* ---- Monat: 12-Wochen-Serie + Aktivitaetskalender + Serie erfuellter Wochen ---- */
  var MONTH_WEEKS = 12;
  function weekFulfilled(w) { return !!(w.planAvailable && !w.ongoing && w.planned > 0 && w.done >= w.planned); }
  function monthModel(opts) {
    var o = opts || {}; var sport = o.sport || 'running';
    var weeks = [];
    for (var off = -(MONTH_WEEKS - 1); off <= 0; off++) {
      var w = weekRaw(off); var b = w.bySport && w.bySport[sport];
      weeks.push({ off: off, from: w.from, to: w.to, ongoing: w.ongoing,
        km: b ? (b.distanceKm != null ? b.distanceKm : (b.knownDistanceKm > 0 ? b.knownDistanceKm : null)) : null,
        sessions: b ? b.sessionCount : 0, minutes: b ? (b.durationMin != null ? b.durationMin : (b.knownDurationMin > 0 ? b.knownDurationMin : null)) : null,
        fulfilled: weekFulfilled(w), planAvailable: w.planAvailable, done: w.done, planned: w.planned, hasData: !!(w.acts.length) });
    }
    /* Serie: aufeinanderfolgende erfuellte Wochen, rueckwaerts ab der letzten abgeschlossenen Woche */
    var streak = 0;
    for (var i = weeks.length - 1; i >= 0; i--) { var wk = weeks[i]; if (wk.ongoing) continue; if (wk.fulfilled) streak++; else break; }
    var withData = weeks.filter(function (x) { return !x.ongoing && x.hasData; }).length;
    /* Kalender des aktuellen Monats */
    var tod = today(); var y = Number(tod.slice(0, 4)), mo = Number(tod.slice(5, 7)) - 1;
    var first = new Date(Date.UTC(y, mo, 1)), last = new Date(Date.UTC(y, mo + 1, 0));
    var lead = (first.getUTCDay() + 6) % 7;
    var actByDay = {};
    try {
      var st = O.activityStore, cfg = O.activityConfig;
      var acts = (st && st.listActivities) ? (st.listActivities() || []) : [];
      var tomb = (st && st.isTombstoned) ? st.isTombstoned : null;
      var tz = (O.profileStore && O.profileStore.effectiveTimezone) ? O.profileStore.effectiveTimezone() : 'UTC';
      acts.forEach(function (a) { if (!a || (tomb && tomb(a))) return; var ld = (cfg && cfg.dayOfActLocal) ? cfg.dayOfActLocal(a, tz) : String(a.startedAt || '').slice(0, 10); (actByDay[ld] = actByDay[ld] || []).push(a.sportId || 'other'); });
    } catch (e) {}
    var cells = []; for (var k = 0; k < lead; k++) cells.push(null);
    for (var d = 1; d <= last.getUTCDate(); d++) { var key = y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); cells.push({ day: d, key: key, sports: actByDay[key] || [], today: key === tod, future: key > tod }); }
    while (cells.length % 7) cells.push(null);
    var monthSessions = Object.keys(actByDay).filter(function (k2) { return k2.slice(0, 7) === tod.slice(0, 7); }).reduce(function (n, k2) { return n + actByDay[k2].length; }, 0);
    return { sport: sport, weeks: weeks, streak: streak, weeksWithData: withData, enough: withData >= 2, month: { year: y, month: mo + 1, cells: cells, sessions: monthSessions, label: first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }) } };
  }
  function monthHtml(m) {
    if (!m) return '';
    var h = '<div class="card tight"><div class="rev-serie"><div class="s"><b>' + m.streak + '</b><span>' + esc(T('rev.serie', { count: m.streak })) + '</span></div><div class="s"><b>' + m.month.sessions + '</b><span>' + esc(T('rev.einheiten_im', { month: m.month.label })) + '</span></div></div>' +
      '<div class="source">' + ic('info', 'xs') + ' ' + esc(T('rev.serie_quelle')) + '</div></div>';
    var SP = [['running', T('rev.sp_running')], ['cycling', T('rev.sp_cycling')], ['gym', T('rev.sp_gym')]];
    h += '<div class="rev-seg rev-sports">' + SP.map(function (s) { return '<button type="button"' + (m.sport === s[0] ? ' class="on"' : '') + ' onclick="gmReviewSetSport(\'' + s[0] + '\')">' + esc(s[1]) + '</button>'; }).join('') + '</div>';
    if (!m.enough) {
      h += '<div class="card"><div class="kp-empty"><div class="t">' + esc(T('rev.monat_leer_t')) + '</div><div class="d">' + esc(T('rev.monat_leer_d', { n: m.weeksWithData })) + '</div></div></div>';
    } else {
      var useKm = m.sport !== 'gym';
      var vals = m.weeks.map(function (w) { return useKm ? (w.km != null ? w.km : 0) : w.sessions; });
      var mx = Math.max.apply(null, vals.concat([1]));
      h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('trend') + ' ' + esc(T('rev.zwoelf_wochen', { sport: (SP.filter(function (s) { return s[0] === m.sport; })[0] || SP[0])[1] })) + '</div></div>' +
        '<div class="rev-bars">' + m.weeks.map(function (w, i) { var v = vals[i]; var pct = Math.round(v / mx * 100); return '<div class="rev-bar' + (w.ongoing ? ' now' : '') + (w.fulfilled ? ' ok' : '') + '" title="' + esc(w.from) + '"><i style="height:' + pct + '%"></i><span>' + (v ? (useKm ? Math.round(v) : v) : '') + '</span></div>'; }).join('') + '</div>' +
        '<div class="rev-bandlbl" style="height:auto;position:static;display:flex;justify-content:space-between"><span style="position:static;transform:none">' + esc(T('rev.vor_wochen', { n: MONTH_WEEKS - 1 })) + '</span><span style="position:static;transform:none">' + esc(T('rev.diese_woche')) + '</span></div>' +
        '<div class="source">' + ic('info', 'xs') + ' ' + esc(useKm ? T('rev.balken_km') : T('rev.balken_einheiten')) + '</div></div>';
    }
    h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('calendar') + ' ' + esc(m.month.label) + '</div></div><div class="rev-cal">' +
      ['M', 'D', 'M', 'D', 'F', 'S', 'S'].map(function (d) { return '<span class="rev-dow">' + d + '</span>'; }).join('') +
      m.month.cells.map(function (c) { if (!c) return '<span class="rev-day out"></span>'; var sp = c.sports[0]; return '<span class="rev-day' + (sp ? ' act' : '') + (c.today ? ' today' : '') + (c.future ? ' fut' : '') + '">' + (sp ? ic(SPORT_ICON[sp] || 'activity', 'xs') + (c.sports.length > 1 ? '<span class="dbl"></span>' : '') : c.day) + '</span>'; }).join('') + '</div>' +
      '<div class="source">' + ic('info', 'xs') + ' ' + esc(T('rev.kalender_quelle')) + '</div></div>';
    return h;
  }

  O.reviewV14 = { VERSION: 'review-v14@3', weekDates: weekDates, weekRaw: weekRaw, model: model, html: html, monthModel: monthModel, monthHtml: monthHtml, weekFulfilled: weekFulfilled, _ring: ring };
})(typeof window !== 'undefined' ? window : globalThis);
