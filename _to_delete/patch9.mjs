import fs from 'fs';
function rep(f,a,b){let s=fs.readFileSync(f,'utf8'); if(!s.includes(a)){console.error('MISSING in '+f+': '+a.slice(0,100)); process.exit(1);} s=s.replace(a,b); fs.writeFileSync(f,s);}
const E='app/js/engine/strength-profile.js';
/* 1) Koerpergewichtsuebungen: Wiederholungsrekord ist die Kurve, e1RM nur wenn ueberwiegend Zusatzlast */
rep(E, `  function sessionBest(s, bw) {
    var work = s.sets.filter(function (x) { return x.work; });`,
`  function sessionBest(s, bw) {
    var work = s.sets.filter(function (x) { return x.work; });
    /* v8-385: Koerpergewichtsuebung (bw uebergeben) — e1RM nur, wenn die Mehrheit der Saetze
       Zusatzlast traegt; sonst ist der Wiederholungsrekord die ehrliche Kurve. */
    if (bw != null && bw > 0) { var loaded = work.filter(function (x) { return x.weight != null && x.weight > 0; }).length; if (loaded * 2 < work.length) bw = null; else bw = { bw: bw, weighted: true }; }`);
rep(E, `      var w = x.weight; if ((w == null || w === 0) && bw != null && bw > 0) w = bw + (x.weight || 0);
      var e = e1rm(w, x.reps, x.rir);`,
`      var w = x.weight;
      if (bw && bw.weighted) w = bw.bw + (x.weight || 0);            /* Systemgewicht = Koerper + Zusatzlast */
      else if (bw == null && E_BW_FLAG.on) w = null;                 /* Koerpergewicht ohne Zusatzlast: kein e1RM, Wdh.-Rekord */
      var e = e1rm(w, x.reps, x.rir);`);
rep(E, `  function finishExercise(E, deps) {
    var bw = deps && num(deps.bodyweightKg);
    E.sessions.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    E.sessions.forEach(function (s) { var b = sessionBest(s, E.bodyweight ? bw : null);`,
`  var E_BW_FLAG = { on: false };
  function finishExercise(E, deps) {
    var bw = deps && num(deps.bodyweightKg);
    E.sessions.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    E_BW_FLAG.on = !!E.bodyweight;
    E.sessions.forEach(function (s) { var b = sessionBest(s, E.bodyweight ? (bw != null && bw > 0 ? bw : 0) : null);`);
rep(E, `    E.mode = withE.length ? 'load' : (withDur.length && !withReps.length ? 'time' : (withReps.length ? 'reps' : 'none'));
    E.count = E.sessions.filter(function (s) { return s.workSets > 0; }).length;
    E.ready = E.count >= MIN_SESSIONS && (E.mode === 'load' ? withE.length >= MIN_SESSIONS : true);`,
`    /* Modus: load nur, wenn e1RM-Punkte fuer die Kurve reichen (>= 2) und (bei Koerpergewicht)
       die Mehrheit der Einheiten Zusatzlast hat; sonst reps/time. Schwelle zaehlt Einheiten, nicht Punkte. */
    E.mode = (withE.length >= 2 && withE.length * 2 >= E.sessions.length) ? 'load' : (withDur.length && !withReps.length ? 'time' : (withReps.length ? 'reps' : (withE.length ? 'load' : 'none')));
    E.count = E.sessions.filter(function (s) { return s.workSets > 0; }).length;
    E.ready = E.count >= MIN_SESSIONS;
    E_BW_FLAG.on = false;`);
/* 2) relative Kraft nur an Langhantel-Grundbewegungen */
rep(E, `      if (num(o.bodyweightKg) != null && o.bodyweightKg > 0 && m.current != null && !E.bodyweight) m.relative = Math.round(m.current / o.bodyweightKg * 100) / 100;`,
`      if (num(o.bodyweightKg) != null && o.bodyweightKg > 0 && m.current != null && !E.bodyweight && /kniebeuge|squat|kreuzheben|deadlift|bankdr|bench|schulterdr|overhead|ohp|military/i.test(E.name) && !/maschine|machine|kabel|cable|smith|kurzhantel|dumbbell/i.test(E.name)) m.relative = Math.round(m.current / o.bodyweightKg * 100) / 100;`);
/* 3) Gruppen: Einheiten je Fenster + 56-Tage-Saetze + letzte Trainingswoche */
rep(E, `    var out = {}; GROUPS.forEach(function (g) { out[g[0]] = { key: g[0], label: g[1], setsWeek: 0, tonnageWeek: 0, tonnageAvg4: 0, sets28: 0 }; });
    out.other = { key: 'other', label: 'Weitere', setsWeek: 0, tonnageWeek: 0, tonnageAvg4: 0, sets28: 0 };
    exercises.forEach(function (E) {
      var G = out[E.group] || out.other;
      E.sessions.forEach(function (s) {
        var t = _d(s.date); if (t == null || t > today) return;
        if (t >= ws) { G.setsWeek += s.workSets; G.tonnageWeek += s.tonnage || 0; }
        else if (t >= prevFrom) { G.tonnageAvg4 += (s.tonnage || 0) / 4; }
        if (t >= today - 27 * DAY) G.sets28 += s.workSets;
      });
    });
    Object.keys(out).forEach(function (k) { out[k].tonnageWeek = Math.round(out[k].tonnageWeek); out[k].tonnageAvg4 = Math.round(out[k].tonnageAvg4); });
    return out;`,
`    var out = {}; GROUPS.forEach(function (g) { out[g[0]] = { key: g[0], label: g[1], setsWeek: 0, tonnageWeek: 0, tonnageAvg4: 0, sets28: 0, sets56: 0, tonnageLast: 0 }; });
    out.other = { key: 'other', label: 'Weitere', setsWeek: 0, tonnageWeek: 0, tonnageAvg4: 0, sets28: 0, sets56: 0, tonnageLast: 0 };
    /* v8-385: Einheiten je Fenster (Balance-Fenster) und letzte Trainingswoche (Tonnage-Fallback) */
    var sess28 = {}, sess56 = {}, lastWeekStart = null;
    exercises.forEach(function (E) { E.sessions.forEach(function (s) { var t = _d(s.date); if (t == null || t > today || !s.workSets) return; var k = s.workoutId || s.date; if (t >= today - 27 * DAY) sess28[k] = 1; if (t >= today - 55 * DAY) sess56[k] = 1; var wk = weekStart(t); if (wk < ws && (lastWeekStart == null || wk > lastWeekStart)) lastWeekStart = wk; }); });
    exercises.forEach(function (E) {
      var G = out[E.group] || out.other;
      E.sessions.forEach(function (s) {
        var t = _d(s.date); if (t == null || t > today) return;
        if (t >= ws) { G.setsWeek += s.workSets; G.tonnageWeek += s.tonnage || 0; }
        else if (t >= prevFrom) { G.tonnageAvg4 += (s.tonnage || 0) / 4; }
        if (t >= today - 27 * DAY) G.sets28 += s.workSets;
        if (t >= today - 55 * DAY) G.sets56 += s.workSets;
        if (lastWeekStart != null && t >= lastWeekStart && t < lastWeekStart + 7 * DAY) G.tonnageLast += s.tonnage || 0;
      });
    });
    Object.keys(out).forEach(function (k) { out[k].tonnageWeek = Math.round(out[k].tonnageWeek); out[k].tonnageAvg4 = Math.round(out[k].tonnageAvg4); out[k].tonnageLast = Math.round(out[k].tonnageLast); });
    out._meta = { sessions28: Object.keys(sess28).length, sessions56: Object.keys(sess56).length, lastWeekStart: lastWeekStart != null ? _iso(lastWeekStart) : null, weekHasSets: GROUPS.some(function (g) { return out[g[0]].setsWeek > 0; }) || out.other.setsWeek > 0 };
    return out;`);
/* 4) Balance: Fenster 28 Tage nur bei >= 3 Einheiten, sonst 56 Tage */
rep(E, `  function balance(groups, opts) {
    var push = groups.push.sets28, pull = groups.pull.sets28, legs = groups.legs.sets28, upper = push + pull;`,
`  function balance(groups, opts) {
    var meta = groups._meta || { sessions28: 0, sessions56: 0 };
    var win = meta.sessions28 >= 3 ? 28 : 56, key = win === 28 ? 'sets28' : 'sets56';
    var push = groups.push[key], pull = groups.pull[key], legs = groups.legs[key], upper = push + pull;`);
rep(E, `    return {
      pushPull: { ratio: pp, a: push, b: pull, lo: 0.8, hi: 1.2, status: pp == null ? 'none' : (pp >= 0.8 && pp <= 1.2 ? 'ok' : 'att') },`,
`    return {
      windowDays: win, sessions: win === 28 ? meta.sessions28 : meta.sessions56,
      pushPull: { ratio: pp, a: push, b: pull, lo: 0.8, hi: 1.2, status: pp == null ? 'none' : (pp >= 0.8 && pp <= 1.2 ? 'ok' : 'att') },`);
fs.writeFileSync(E, fs.readFileSync(E,'utf8'));
/* ---- Screen ---- */
const S='app/js/screens/strength-profile.js';
/* Delta ±0 */
rep(S, `      var dtx = em.delta ? ((em.delta.kg >= 0 ? '+' : '−') + kg(Math.abs(em.delta.kg)) + ' kg ' + T('kp.in_n_wochen', { n: em.delta.weeks })) : '';`,
`      var dtx = em.delta ? ((em.delta.kg === 0 ? '±' : em.delta.kg > 0 ? '+' : '−') + kg(Math.abs(em.delta.kg)) + ' kg ' + T('kp.in_n_wochen', { n: em.delta.weeks })) : '';`);
/* Monatslabels an echter Position */
rep(S, `    var months = []; pts.forEach(function (p) { var mo = p.date.slice(0, 7); if (months.indexOf(mo) < 0) months.push(mo); });
    var MO = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    h += '<div class="kp-xlbl">' + months.slice(-4).map(function (mo) { return '<span>' + MO[+mo.slice(5, 7) - 1] + '</span>'; }).join('') + '</div>';`,
`    var MO = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    /* v8-385: Monatsmarken an ihrer echten x-Position (Monatsanfang), nicht gleichverteilt */
    var lbl = []; var d0 = new Date(t0), dm = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1));
    lbl.push({ x: 0, t: MO[d0.getUTCMonth()] });
    for (var k = 0; k < 14; k++) { dm = new Date(Date.UTC(dm.getUTCFullYear(), dm.getUTCMonth() + 1, 1)); var tm = dm.getTime(); if (tm > t1) break; var px = (tm - t0) / span * 100; if (px > 6) lbl.push({ x: px, t: MO[dm.getUTCMonth()] }); }
    h += '<div class="kp-xlbl kp-xlbl-abs">' + lbl.map(function (l) { return '<span style="left:' + l.x.toFixed(1) + '%">' + l.t + '</span>'; }).join('') + '</div>';`);
/* Muskelkarte: Woche ohne Einheit */
rep(S, `    var SC = 24, under = rows.filter(function (r) { return r.status === 'under'; }), over = rows.filter(function (r) { return r.status === 'over'; });`,
`    if (m.groups && m.groups._meta && !m.groups._meta.weekHasSets) return '<div class="card tight" data-gm-slot="strength-muscles"><div class="ctitle"><div class="l">' + ic('gauge') + ' ' + esc(T('kp.saetze_je_muskel', { g: grpLabel(st.grp) })) + '</div><span class="more">' + esc(T('kp.7_tage')) + '</span></div><div class="kp-note">' + ic('info', 'sm') + '<div>' + esc(T('kp.woche_ohne_einheit')) + '</div></div>' + src(T('kp.src_korridor', { lo: mr.corridor.min != null ? mr.corridor.min : '—', hi: mr.corridor.max != null ? mr.corridor.max : '—' })) + '</div>';
    var SC = 24, under = rows.filter(function (r) { return r.status === 'under'; }), over = rows.filter(function (r) { return r.status === 'over'; });`);
/* Tonnage: letzte Trainingswoche als Fallback */
rep(S, `    var G = m.groups, keys = ['legs', 'push', 'pull', 'core'];
    var tmax = Math.max.apply(null, keys.map(function (k) { return Math.max(G[k].tonnageWeek, G[k].tonnageAvg4); }).concat([1]));
    var any = keys.some(function (k) { return G[k].tonnageWeek > 0 || G[k].tonnageAvg4 > 0; });
    if (!any) return '';
    return '<div class="card tight" data-gm-slot="strength-tonnage"><div class="ctitle"><div class="l">' + ic('chart') + ' ' + esc(T('kp.tonnage_woche')) + '</div></div><div class="kp-ton">' +
      keys.map(function (k) { var g = G[k]; return '<div class="kp-trow"><span class="n">' + esc(grpLabel(k)) + '</span><span class="bar"><i style="width:' + Math.round(g.tonnageWeek / tmax * 100) + '%"></i>' + (g.tonnageAvg4 > 0 ? '<span class="avg" style="left:' + Math.round(g.tonnageAvg4 / tmax * 100) + '%"></span>' : '') + '</span><span class="v">' + esc(kgInt(g.tonnageWeek)) + ' kg</span></div>'; }).join('') +
      '</div><div class="kp-legend"><span><i class="a"></i>' + esc(T('kp.diese_woche')) + '</span><span><i class="b"></i>' + esc(T('kp.schnitt_4w')) + '</span></div>' + src(T('kp.src_tonnage')) + '</div>';`,
`    var G = m.groups, keys = ['legs', 'push', 'pull', 'core'], meta = G._meta || {};
    /* v8-385: laufende Woche ohne Einheit ⇒ letzte Trainingswoche zeigen, klar beschriftet */
    var useLast = !meta.weekHasSets && meta.lastWeekStart, fld = useLast ? 'tonnageLast' : 'tonnageWeek';
    var tmax = Math.max.apply(null, keys.map(function (k) { return Math.max(G[k][fld], G[k].tonnageAvg4); }).concat([1]));
    var any = keys.some(function (k) { return G[k][fld] > 0 || G[k].tonnageAvg4 > 0; });
    if (!any) return '';
    var title = useLast ? T('kp.tonnage_letzte_woche', { d: deDate(meta.lastWeekStart) + '–' + deDate(new Date(Date.parse(meta.lastWeekStart + 'T12:00:00Z') + 6 * 864e5).toISOString().slice(0, 10)) }) : T('kp.tonnage_woche');
    return '<div class="card tight" data-gm-slot="strength-tonnage"><div class="ctitle"><div class="l">' + ic('chart') + ' ' + esc(title) + '</div></div><div class="kp-ton">' +
      keys.map(function (k) { var g = G[k]; return '<div class="kp-trow"><span class="n">' + esc(grpLabel(k)) + '</span><span class="bar"><i style="width:' + Math.round(g[fld] / tmax * 100) + '%"></i>' + (g.tonnageAvg4 > 0 ? '<span class="avg" style="left:' + Math.round(g.tonnageAvg4 / tmax * 100) + '%"></span>' : '') + '</span><span class="v">' + esc(kgInt(g[fld])) + ' kg</span></div>'; }).join('') +
      '</div><div class="kp-legend"><span><i class="a"></i>' + esc(useLast ? T('kp.letzte_trainingswoche') : T('kp.diese_woche')) + '</span><span><i class="b"></i>' + esc(T('kp.schnitt_4w')) + '</span></div>' + src(T('kp.src_tonnage')) + '</div>';`);
/* Balance: Fenster anzeigen, beide Hinweise */
rep(S, `    var h = '<div class="card tight" data-gm-slot="strength-balance"><div class="ctitle"><div class="l">' + ic('shield') + ' ' + esc(T('kp.balance')) + '</div><span class="more">' + esc(T('kp.28_tage')) + '</span></div>' +`,
`    var h = '<div class="card tight" data-gm-slot="strength-balance"><div class="ctitle"><div class="l">' + ic('shield') + ' ' + esc(T('kp.balance')) + '</div><span class="more">' + esc(T('kp.n_tage_n_einheiten', { d: b.windowDays || 28, n: b.sessions != null ? b.sessions : '—' })) + '</span></div>' +`);
rep(S, `    var lu = b.legsUpper;
    if (lu.blocked) h += '<div class="kp-note">' + ic('knee', 'sm') + '<div><b>' + esc(T('kp.beine_ausgesetzt', { label: lu.injuryLabel || '', stage: (lu.injuryStage || 0) + 1 })) + '</b> ' + esc(T('kp.beine_ausgesetzt_d')) + '</div></div>';
    else if (lu.status === 'att') h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.beine_unter')) + '</b> ' + esc(T('kp.beine_unter_d')) + '</div></div>';
    else if (b.pushPull.status === 'att') h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T(b.pushPull.ratio > 1.2 ? 'kp.druck_dominant' : 'kp.zug_dominant')) + '</b> ' + esc(T('kp.druck_zug_d')) + '</div></div>';
    else if (lu.status === 'ok' && b.pushPull.status === 'ok') h += '<div class="kp-note">' + ic('check', 'sm') + '<div>' + esc(T('kp.balance_ok')) + '</div></div>';`,
`    var lu = b.legsUpper;
    if (b.pushPull.status === 'att') h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T(b.pushPull.ratio > 1.2 ? 'kp.druck_dominant' : 'kp.zug_dominant')) + '</b> ' + esc(T('kp.druck_zug_d')) + '</div></div>';
    if (lu.blocked) h += '<div class="kp-note">' + ic('knee', 'sm') + '<div><b>' + esc(T('kp.beine_ausgesetzt', { label: lu.injuryLabel || '', stage: (lu.injuryStage || 0) + 1 })) + '</b> ' + esc(T('kp.beine_ausgesetzt_d')) + '</div></div>';
    else if (lu.status === 'att') h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.beine_unter')) + '</b> ' + esc(T('kp.beine_unter_d')) + '</div></div>';
    if (lu.status === 'ok' && b.pushPull.status === 'ok') h += '<div class="kp-note">' + ic('check', 'sm') + '<div>' + esc(T('kp.balance_ok')) + '</div></div>';`);
/* Teaser: "unter Korridor" nur bei Einheiten in der Woche */
rep(S, `      var under = (m.muscles && m.muscles.rows || []).filter(function (r) { return r.status === 'under'; }).length;`,
`      var under = (m.groups && m.groups._meta && !m.groups._meta.weekHasSets) ? 0 : (m.muscles && m.muscles.rows || []).filter(function (r) { return r.status === 'under'; }).length;`);
rep(S, `      return { empty: false, loading: _loading, sessions: m.sessions, exercise: best ? best.name : null, current: best ? best.current : null, delta: best && best.delta ? best.delta : null, under: under,`,
`      return { empty: false, loading: _loading, sessions: m.sessions, exercise: best ? best.name : null, current: best ? best.current : null, delta: best && best.delta ? best.delta : null, under: under, weekIdle: !!(m.groups && m.groups._meta && !m.groups._meta.weekHasSets),`);
rep('app/js/ui.js', `    if(t.under>0)parts.push(_uiT('kp.teaser_under',{n:t.under}));`, `    if(t.under>0)parts.push(_uiT('kp.teaser_under',{n:t.under}));else if(t.weekIdle)parts.push(_uiT('kp.woche_ohne_einheit_kurz'));`);
/* Locale + CSS */
rep('app/locales/de.js', "    'kp.titel': 'Kraftprofil',", `    'kp.titel': 'Kraftprofil',
    'kp.woche_ohne_einheit': 'Diese Woche noch keine Krafteinheit — der Korridor gilt für Trainingswochen, eine Pause ist keine Lücke.',
    'kp.woche_ohne_einheit_kurz': 'diese Woche noch keine Krafteinheit',
    'kp.tonnage_letzte_woche': 'Tonnage · Woche {d}',
    'kp.letzte_trainingswoche': 'letzte Trainingswoche',
    'kp.n_tage_n_einheiten': '{d} Tage · {n} Einheiten',`);
{ let c=fs.readFileSync('app/styles.css','utf8'); c=c.replace(/\s*$/,'\n')+'.kp-xlbl-abs{position:relative;height:14px;justify-content:flex-start}.kp-xlbl-abs span{position:absolute;top:4px;transform:translateX(-50%)}.kp-xlbl-abs span:first-child{transform:none}\n'; fs.writeFileSync('app/styles.css',c); }
console.log('patch9 ok');
