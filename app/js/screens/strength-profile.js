/* ============================================================
   ORVIA · screens/strength-profile — Kraftprofil-Seite (S2, Prototyp v14 „scrStr")

   Aufbau (Prototyp): Filter Gruppe → Übung · Übungskarte (e1RM groß, Δ, letzter
   Satz/Test, Kurve mit antippbaren Punkten) · Bestwerte · Letzte Einheiten ·
   Sätze je Muskel (7 Tage, Korridor aus gym-volume) · Kraftziel-Prognose ·
   Tonnage (Woche vs. 4-W-Schnitt) · Balance (Druck:Zug, Beine:Oberkörper).

   Regeln: Alle Zahlen aus engine/strength-profile (rein). Diese Datei rendert
   nur. Kein Schreibpfad. Tiefe nach gmLevel() (a/f/p). Beschwerden-Kopplung:
   Balance-Vorschlag für Beine entfällt bei Injury-Lead mit legStrength=false.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'strength-profile-screen@1';
  var SHEET = '_strengthProfile';
  var st = { grp: null, ex: null, pt: null };
  var _model = null, _ctx = null;

  function T(k, p) { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ic(n, s) { try { if (typeof root.icon === 'function') return root.icon(n, s || 'sm'); } catch (e) {} return ''; }
  function lvl() { try { return typeof root.gmLevel === 'function' ? root.gmLevel() : 'f'; } catch (e) { return 'f'; } }
  /* Niveau-Vertrag (S2b-1): dieselben Daten, drei Tiefen. Anfaenger sehen Maximum, Bestwerte,
     Ziel und EINE Balance-Aussage in Worten — keine Muskelzeilen, keine Tonnage, keine Historie,
     kein Fachjargon (e1RM/RIR/Korridor). Profi bekommt zusaetzlich Methode, relative Kraft,
     Korridorzahlen. */
  var DEPTH = { a: { jargon: false, history: false, muscles: false, tonnage: false, balanceBars: false, relative: false, meta: false },
                f: { jargon: true, history: true, muscles: true, tonnage: true, balanceBars: true, relative: false, meta: true },
                p: { jargon: true, history: true, muscles: true, tonnage: true, balanceBars: true, relative: true, meta: true } };
  function depth() { return DEPTH[lvl()] || DEPTH.f; }
  function kg(n, d) { if (n == null || !isFinite(n)) return '—'; var s = (d != null ? (+n).toFixed(d) : String(Math.round(n * 10) / 10)); return s.replace('.', ','); }
  function kgInt(n) { if (n == null) return '—'; return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function deDate(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? (m[3] + '.' + m[2] + '.') : '—'; }
  function deDateY(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? (m[3] + '.' + m[2] + '.' + m[1]) : '—'; }
  function mmss(s) { if (s == null) return '—'; s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' min'; }
  function grpLabel(k) { return T('kp.grp_' + k); }
  function src(txt) { return '<div class="source">' + ic('info', 'xs') + ' ' + esc(txt) + '</div>'; }

  /* ---------- Datensammlung (nur hier wird die App berührt) ---------- */
  function collect() {
    var ctx = { today: null, snapshots: [], bodyweight: null, bodyweightSeries: null, experience: 'beginner', goals: [], injury: null, ready: false, error: null };
    try { ctx.today = typeof root.todayStr === 'function' ? root.todayStr() : new Date().toISOString().slice(0, 10); } catch (e) { ctx.today = new Date().toISOString().slice(0, 10); }
    try { var gv = O.gymVolume; if (gv && gv.gymPipeline) { var pipe = gv.gymPipeline({ days: 365 }); ctx.snapshots = (pipe && pipe.snapshots) || []; ctx.ready = true; } } catch (e) { ctx.error = e; }
    /* v8-389 (S2-B1b): Koerpergewicht kommt aus dem MORGENBERICHT (nuechtern, taeglich
       gepflegt) und wird als Reihe uebergeben — jede Einheit rechnet mit dem Gewicht
       IHRES Tages. Vorher stand hier nur der Profilwert: eine Klimmzugreihe ueber drei
       Monate nahm das heutige Gewicht auch fuer Einheiten im Juni, und relative Kraft
       rechnete gegen einen Wert, der Wochen alt sein konnte. Der Profilverlauf bleibt
       Rueckfall, wenn kein Morgenwert vorliegt. */
    try {
      var P = root.PROFILE || null, PM = O.profileModel;
      var morning = null;
      try { morning = (O.checkinStore && O.checkinStore.morningWeightSeries) ? O.checkinStore.morningWeightSeries(365) : null; } catch (e) {}
      if (PM && PM.weightSeries) ctx.bodyweightSeries = PM.weightSeries(P ? P.performance : null, morning);
      var w = null;
      try { w = (PM && PM.currentWeightKg) ? PM.currentWeightKg(P ? P.performance : null, ctx.bodyweightSeries) : null; } catch (e) {}
      if (w == null && P && P.personal) w = P.personal.weightKg;
      ctx.bodyweight = (typeof w === 'number' && w > 0) ? w : null;
    } catch (e) {}
    try { if (typeof root.mvExperience === 'function') ctx.experience = root.mvExperience() || 'beginner'; } catch (e) {}
    try { ctx.goals = typeof root.listGoals === 'function' ? (root.listGoals() || []) : []; } catch (e) {}
    try { var AR = O.absenceReplanner; if (AR && AR.injuryFromConstraints && root.PROFILE) { var inj = AR.injuryFromConstraints(root.PROFILE.constraintsList, { ladder: O.returnLadder || null }); if (inj && inj.active) ctx.injury = inj; } } catch (e) {}
    return ctx;
  }
  function buildModel(ctx) {
    var SP = O.strengthProfile; if (!SP) return null;
    return SP.build(ctx.snapshots, { today: ctx.today, gymVolume: O.gymVolume, strengthProgression: O.strengthProgression, bodyweightKg: ctx.bodyweight, bodyweightSeries: ctx.bodyweightSeries, experience: ctx.experience, goals: ctx.goals, injury: ctx.injury });
  }

  /* ---------- Kurve ---------- */
  function chart(em, m) {
    var pts = em.series; if (!pts || pts.length < 2) return '';
    var W = 320, H = 128, P = { l: 8, r: 10, t: 12, b: 8 };
    var t0 = Date.parse(pts[0].date + 'T12:00:00Z'), t1 = Date.parse(pts[pts.length - 1].date + 'T12:00:00Z'), span = Math.max(1, t1 - t0);
    var vals = pts.map(function (p) { return p.value; }), min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), vs = (max - min) || 1;
    var x = function (p) { return P.l + (Date.parse(p.date + 'T12:00:00Z') - t0) / span * (W - P.l - P.r); };
    var y = function (v) { return H - P.b - ((v - min) / vs) * (H - P.t - P.b) * 0.86 - ((H - P.t - P.b) * 0.07); };
    /* v8-392 (S2-B4b): Die Linie wird an jedem LASTWECHSEL unterbrochen. Zahlen und
       Rekorde waren seit v8-389 nach Zusatzlast getrennt, die Kurve aber nicht: sie
       verband 13 Wiederholungen ohne Zusatz mit 7 Wiederholungen unter +10 kg zu einem
       steilen Absturz und behauptete damit genau die Vergleichbarkeit, die die Zahlen
       darunter bestreiten. Eine Lücke in der Linie sagt: hier ist kein Vergleich. */
    var segs = [], cur = [];
    pts.forEach(function (p, i) {
      if (i > 0 && p.addedKg != null && pts[i - 1].addedKg != null && p.addedKg !== pts[i - 1].addedKg) { if (cur.length) segs.push(cur); cur = []; }
      cur.push(p);
    });
    if (cur.length) segs.push(cur);
    var line = segs.map(function (seg) {
      return seg.map(function (p, i) { return (i ? 'L' : 'M') + x(p).toFixed(1) + ' ' + y(p.value).toFixed(1); }).join(' ');
    }).join(' ');
    /* Die Füllfläche folgt nur einer durchgehenden Reihe — bei Lastwechseln entfällt sie,
       weil eine Fläche über eine Lücke hinweg wieder Vergleichbarkeit suggerieren würde. */
    var area = segs.length === 1
      ? line + ' L' + x(pts[pts.length - 1]).toFixed(1) + ' ' + (H - P.b) + ' L' + P.l + ' ' + (H - P.b) + ' Z'
      : '';
    var sel = st.pt != null && st.pt < pts.length ? st.pt : pts.length - 1;
    var h = '<div class="kp-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="kpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9AE7C" stop-opacity=".22"/><stop offset="1" stop-color="#C9AE7C" stop-opacity="0"/></linearGradient></defs>' +
      (area ? '<path d="' + area + '" fill="url(#kpg)"/>' : '') + '<path class="kp-line" d="' + line + '"/>' +
      pts.map(function (p, i) { return '<circle class="kp-pt' + (i === sel ? ' on' : '') + (p.test ? ' test' : '') + (p.addedKg > 0 ? ' loaded' : '') + '" data-a="kppt" data-v="' + i + '" cx="' + x(p).toFixed(1) + '" cy="' + y(p.value).toFixed(1) + '" r="' + (i === sel ? 5.5 : 4) + '"/>'; }).join('') +
      '</svg></div>';
    var MO = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    /* v8-385: Monatsmarken an ihrer echten x-Position (Monatsanfang), nicht gleichverteilt */
    var lbl = []; var d0 = new Date(t0), dm = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1));
    lbl.push({ x: 0, t: MO[d0.getUTCMonth()] });
    for (var k = 0; k < 14; k++) { dm = new Date(Date.UTC(dm.getUTCFullYear(), dm.getUTCMonth() + 1, 1)); var tm = dm.getTime(); if (tm > t1) break; var px = (tm - t0) / span * 100; if (px > 6) lbl.push({ x: px, t: MO[dm.getUTCMonth()] }); }
    h += '<div class="kp-xlbl kp-xlbl-abs">' + lbl.map(function (l) { return '<span style="left:' + l.x.toFixed(1) + '%">' + l.t + '</span>'; }).join('') + '</div>';
    var sp = pts[sel];
    var spLoad = (em.mode === 'reps' && sp && sp.addedKg != null)
      ? (sp.addedKg > 0 ? ' · +' + kg(sp.addedKg) + ' kg' : ' · ' + T('kp.ohne_zusatz')) : '';
    var unit = em.mode === 'load' ? T(depth().jargon ? 'kp.unit_e1rm' : 'kp.unit_max') : em.mode === 'reps' ? T('kp.unit_wdh') : '';
    h += '<div class="kp-read"><div class="rv">' + esc(em.mode === 'time' ? mmss(sp.value) : kg(sp.value)) + (unit ? '<small>' + esc(unit) + '</small>' : '') + '</div><div class="rm">' + esc(deDateY(sp.date) + spLoad) + (sp.test ? ' · ' + esc(T('kp.test_markiert', { w: kg(sp.testWeight) })) : '') + '</div></div>';
    return h;
  }

  /* ---------- Übungskarte ---------- */
  function exerciseCard(em, m) {
    var L = lvl();
    if (!em) return '<div class="card tight"><div class="kp-empty"><div class="e-ic">' + ic('dumbbell') + '</div><div class="t">' + esc(T('kp.keine_uebung')) + '</div></div></div>';
    var D = depth();
    var title = esc(em.name) + (em.mode === 'load' ? ' · ' + esc(T(D.jargon ? 'kp.geschaetztes_1rm' : 'kp.geschaetztes_max')) : '');
    var h = '<div class="card tight" data-gm-slot="strength-exercise"><div class="ctitle"><div class="l">' + ic('dumbbell') + ' ' + title + '</div>' + (em.stagnant ? '<span class="pill-badge att">' + esc(T('kp.stagnation')) + '</span>' : '') + '</div>';
    if (!em.ready) {
      var n = em.count || 0;
      h += '<div class="kp-empty"><div class="e-ic">' + ic('dumbbell') + '</div><div class="t">' + esc(T('kp.noch_keine_kurve')) + '</div>' +
        '<div class="d">' + esc(n === 0 ? T('kp.noch_nicht_geloggt') : T('kp.erst_n_einheiten', { n: n })) + ' ' + esc(T('kp.kurve_braucht', { n: em.minSessions })) + '</div>' +
        '<div class="bar"><i style="width:' + Math.min(100, Math.round(n / em.minSessions * 100)) + '%"></i></div><div class="cnt">' + n + ' / ' + em.minSessions + ' ' + esc(T('kp.einheiten')) + '</div></div>';
      if (em.current != null && em.mode === 'load') h += '<div class="kp-sub">' + esc(T('kp.bisher_bester_satz', { v: kg(em.current) })) + '</div>';
      return h + src(T('kp.src_schwelle')) + '</div>';
    }
    if (em.mode === 'load') {
      /* v8-389 (S2-B2): Die Kopfzahl ist die STEIGUNG je 4 Wochen, nicht der Abstand zum
         ersten Punkt eines wandernden Fensters. Fehlt die Steigung, steht dort nichts —
         eine Rohdifferenz waere eine Aussage, die die Daten nicht tragen. */
      var tr = em.trend && em.trend.ok ? em.trend : null;
      var dtx = tr ? ((tr.per4Weeks === 0 ? '±' : tr.per4Weeks > 0 ? '+' : '−') + kg(Math.abs(tr.per4Weeks)) + ' ' + T('kp.kg_je_4w')) : '';
      h += '<div class="kp-hero"><b>' + esc(kg(em.current)) + '</b><span>' + esc(T(D.jargon ? 'kp.unit_e1rm' : 'kp.unit_max')) + '</span>' + (dtx ? '<span class="kp-delta' + (tr.per4Weeks < 0 ? ' dn' : '') + (tr.confidence === 'low' || tr.implausible ? ' unsure' : '') + '">' + esc(dtx) + '</span>' : '') + '</div>';
      var meta = [];
      if (em.lastScheme) meta.push(T('kp.letzter_satz') + ': ' + (D.jargon ? em.lastScheme : em.lastScheme.replace(/ · RIR \d+/, '')));
      if (D.meta) meta.push(em.lastTest ? T('kp.letzter_test') + ': ' + kg(em.lastTest.weight) + ' kg (' + deDateY(em.lastTest.date) + ')' : T('kp.kein_test'));
      if (em.relative != null && D.relative) meta.push(T('kp.relativ', { v: kg(em.relative, 2) }));
      h += '<div class="kp-meta">' + esc(meta.join(' · ')) + '</div>';
      h += chart(em, m);
      if (!D.jargon) h += '<div class="kp-note">' + ic('info', 'sm') + '<div><b>' + esc(T('kp.kurz_erklaert')) + '</b> ' + esc(T('kp.e1rm_erklaerung')) + '</div></div>';
      /* v8-389 (S2-B1/B2): Worauf die Zahl beruht — Punkte, Spanne, Ausbelastung. Ohne das
         liest sich eine Steigung wie eine Messung, obwohl sie eine Schaetzung aus wenigen
         Punkten ist. */
      if (tr && D.meta) h += '<div class="kp-meta">' + esc(T('kp.trend_basis', { n: tr.points, d: tr.spanDays })) + '</div>';
      if (em.trend && !em.trend.ok && em.series.length >= 2) h += '<div class="kp-note">' + ic('info', 'sm') + '<div>' + esc(T(em.trend.reason === 'short_span' ? 'kp.trend_kurz' : 'kp.trend_wenig')) + '</div></div>';
      if (tr && tr.implausible) h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.trend_unplausibel_t')) + '</b> ' + esc(T('kp.trend_unplausibel_d')) + '</div></div>';
      else if (tr && tr.confidence === 'low') h += '<div class="kp-note">' + ic('info', 'sm') + '<div><b>' + esc(T('kp.effort_t')) + '</b> ' + esc(T('kp.effort_d', { k: em.effortKnown, n: em.effortKnown + em.effortUnknown })) + '</div></div>';
      if (em.staleDays != null && em.staleDays >= 14) h += '<div class="kp-note">' + ic('calendar', 'sm') + '<div>' + esc(T('kp.stale_d', { d: em.staleDays })) + '</div></div>';
      if (em.stagnant) h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T(em.stagnantBy === 'trend' ? 'kp.stagnation_trend_t' : 'kp.stagnation_t')) + '</b> ' + esc(T(em.stagnantBy === 'trend' ? 'kp.stagnation_trend_d' : (D.jargon ? 'kp.stagnation_d' : 'kp.stagnation_d_einfach'))) + '</div></div>';
      h += src(T(!D.jargon ? 'kp.src_einfach' : (em.method === 'epley_rir' ? 'kp.src_epley_rir' : 'kp.src_epley')));
    } else if (em.mode === 'reps') {
      h += '<div class="kp-hero"><b>' + esc(String(em.current)) + '</b><span>' + esc(T('kp.unit_wdh_max')) + '</span>' + (em.delta && em.delta.reps ? '<span class="kp-delta' + (em.delta.reps < 0 ? ' dn' : '') + '">' + (em.delta.reps > 0 ? '+' : '') + em.delta.reps + ' ' + esc(T('kp.in_n_wochen', { count: em.delta.weeks })) + '</span>' : '') + '</div>';
      if (em.lastScheme) h += '<div class="kp-meta">' + esc(T('kp.letzter_satz') + ': ' + em.lastScheme) + '</div>';
      h += chart(em, m);
      /* v8-389 (S2-B4): Eine Wdh.-Zahl ohne ihre Zusatzlast ist nicht lesbar. */
      if (em.currentLoadKg != null) h += '<div class="kp-meta">' + esc(em.currentLoadKg > 0 ? T('kp.reps_mit_last', { v: kg(em.currentLoadKg) }) : T('kp.reps_ohne_last')) + '</div>';
      if (em.deltaBlocked === 'load_changed') h += '<div class="kp-note">' + ic('info', 'sm') + '<div>' + esc(T('kp.reps_last_gewechselt', { a: kg(em.deltaLoadFrom), b: kg(em.deltaLoadTo) })) + '</div></div>';
      h += src(T('kp.src_reps'));
    } else if (em.mode === 'time') {
      h += '<div class="kp-empty"><div class="e-ic">' + ic('calendar') + '</div><div class="t">' + esc(T('kp.zeit_statt_gewicht')) + '</div><div class="d">' + esc(T('kp.halte_d', { v: mmss(em.current) })) + '</div></div>';
      h += src(T('kp.src_zeit'));
    }
    return h + '</div>';
  }

  function prCard(em) {
    if (!em || !em.ready || !em.prs.length) return '';
    var rows = em.prs.map(function (p) {
      var t = T('kp.pr_' + p.kind);
      /* v8-389 (S2-B4): Zwei Wdh.-Rekorde unterscheiden sich nur durch ihre Last. */
      if (p.kind === 'max_reps' && p.addedKg != null) t += p.addedKg > 0 ? ' (+' + kg(p.addedKg) + ' kg)' : ' (' + T('kp.ohne_zusatz') + ')';
      var sub = p.kind === 'volume_week' ? T('kp.kw', { w: String(p.week).replace(/^\d{4}-W/, '') }) : (p.date ? deDateY(p.date) + (p.detail ? ' · ' + p.detail : '') : (p.detail || ''));
      var v = p.kind === 'max_hold' ? mmss(p.value) : (p.kind === 'max_reps' ? p.value + ' ' + T('kp.unit_wdh') : (p.kind === 'volume_week' ? kgInt(p.value) + ' kg' : (p.kind === 'best_set' ? (depth().jargon ? T('kp.unit_e1rm_short') + ' ' : '') + kg(p.value) + (depth().jargon ? '' : ' kg') : kg(p.value) + ' kg')));
      return '<div class="kp-pr"><div class="p-ic2">' + ic('sparkle') + '</div><div class="t">' + esc(t) + '<small>' + esc(sub) + '</small></div><div class="v">' + esc(v) + '</div></div>';
    }).join('');
    return '<div class="card tight"><div class="ctitle"><div class="l">' + ic('target') + ' ' + esc(T('kp.bestwerte')) + ' · ' + esc(em.name) + '</div></div>' + rows + '</div>';
  }

  function historyCard(em) {
    if (!em || !em.ready || em.mode !== 'load' || !em.history.length || !depth().history) return '';
    var h = '<div class="card tight"><div class="ctitle"><div class="l">' + ic('calendar') + ' ' + esc(T('kp.letzte_einheiten')) + '</div></div><div class="kp-hist">' +
      '<div class="kp-hrow head"><span>' + esc(T('kp.datum')) + '</span><span>' + esc(T('kp.saetze')) + '</span><span class="e">e1RM</span><span class="dl">Δ</span></div>' +
      em.history.map(function (r) { var d = r.delta; var cls = d == null ? 'eq' : d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'; var dt = d == null ? '—' : d === 0 ? '±0' : ((d > 0 ? '+' : '−') + kg(Math.abs(d)));
        return '<div class="kp-hrow"><span class="d">' + esc(deDate(r.date)) + '</span><span class="s">' + esc(r.scheme || '—') + '</span><span class="e">' + esc(kg(r.e1rm)) + '</span><span class="dl ' + cls + '">' + esc(dt) + '</span></div>'; }).join('') +
      '</div>' + src(T('kp.src_delta')) + '</div>';
    return h;
  }

  function muscleCard(m) {
    var mr = m.muscles; if (!mr || !depth().muscles) return '';
    var rows = mr.rows.filter(function (r) { return r.group === st.grp; });
    if (!rows.length) return '';
    if (mr.corridor && mr.corridor.min == null) return '<div class="card tight" data-gm-slot="strength-muscles"><div class="ctitle"><div class="l">' + ic('gauge') + ' ' + esc(T('kp.saetze_je_muskel', { g: grpLabel(st.grp) })) + '</div><span class="more">' + esc(T('kp.7_tage')) + '</span></div><div class="kp-note">' + ic('info', 'sm') + '<div>' + esc(T('kp.korridor_fehlt')) + '</div></div>' + src(T('kp.src_korridor_leer')) + '</div>';
    if (m.groups && m.groups._meta && !m.groups._meta.weekHasSets) return '<div class="card tight" data-gm-slot="strength-muscles"><div class="ctitle"><div class="l">' + ic('gauge') + ' ' + esc(T('kp.saetze_je_muskel', { g: grpLabel(st.grp) })) + '</div><span class="more">' + esc(T('kp.7_tage')) + '</span></div><div class="kp-note">' + ic('info', 'sm') + '<div>' + esc(T('kp.woche_ohne_einheit')) + '</div></div>' + src(T('kp.src_korridor', { lo: mr.corridor.min != null ? mr.corridor.min : '—', hi: mr.corridor.max != null ? mr.corridor.max : '—' })) + '</div>';
    var SC = 24, under = rows.filter(function (r) { return r.status === 'under'; }), over = rows.filter(function (r) { return r.status === 'over'; });
    var h = '<div class="card tight" data-gm-slot="strength-muscles"><div class="ctitle"><div class="l">' + ic('gauge') + ' ' + esc(T('kp.saetze_je_muskel', { g: grpLabel(st.grp) })) + '</div><span class="more">' + esc(T('kp.7_tage')) + '</span></div><div class="kp-corr">' +
      rows.map(function (r) { var lo = r.min, hi = r.max, n = r.effective; var cls = r.status === 'under' || r.status === 'over' ? ' att' : '';
        return '<div class="kp-crow"><span class="n">' + esc(r.label) + '</span><span class="track">' + (lo != null ? '<span class="corr" style="left:' + Math.round(lo / SC * 100) + '%;width:' + Math.round((hi - lo) / SC * 100) + '%"></span>' : '') + '<span class="val' + cls + '" style="left:' + Math.min(100, Math.round(n / SC * 100)) + '%"></span></span><span class="v' + cls + '">' + esc(kg(n)) + (lo != null ? ' / ' + lo + '–' + hi : '') + '</span></div>'; }).join('') + '</div>';
    if (mr.corridor && mr.corridor.min == null) h += '<div class="kp-note">' + ic('info', 'sm') + '<div>' + esc(mr.corridor.label || T('kp.korridor_fehlt')) + '</div></div>';
    else if (under.length) h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.unter_korridor', { m: under.map(function (r) { return r.label + ' (' + kg(r.effective) + ')'; }).join(', ') })) + '</b> ' + esc(T('kp.unter_korridor_d')) + '</div></div>';
    else if (over.length) h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.ueber_korridor', { m: over.map(function (r) { return r.label; }).join(', ') })) + '</b></div></div>';
    h += src(T('kp.src_korridor', { lo: mr.corridor.min != null ? mr.corridor.min : '—', hi: mr.corridor.max != null ? mr.corridor.max : '—' }));
    return h + '</div>';
  }

  function goalCard(m, em) {
    var gs = (m.strengthGoals || []).filter(function (g) { return g.exercise && em && g.exercise === em.key; });
    if (!gs.length) return '';
    return gs.map(function (g) {
      var f = g.forecast; var h = '<div class="card tight" data-gm-slot="strength-goal"><div class="ctitle"><div class="l">' + ic('target') + ' ' + esc(T('kp.ziel')) + ': ' + esc(g.title) + '</div>';
      var badge = !f ? '' : f.reached ? '<span class="pill-badge ready">' + esc(T('kp.erreicht')) + '</span>' : f.onTrack === true ? '<span class="pill-badge ready">' + esc(T('kp.auf_kurs')) + '</span>' : f.onTrack === false ? '<span class="pill-badge att">' + esc(T('kp.pruefen')) + '</span>' : '';
      h += badge + '</div><div class="kp-text">';
      if (!f) h += esc(T('kp.ziel_ohne_wert'));
      else if (f.reached) h += esc(T('kp.ziel_erreicht_d', { v: kg(f.current), t: kg(f.target) }));
      else if (f.reason === 'insufficient') h += esc(T('kp.ziel_insufficient', { n: f.points, min: m.minSessions, gap: kg(f.gap) }));
      else if (f.reason === 'flat') h += esc(T('kp.ziel_flat', { gap: kg(f.gap), s: kg(f.slopePer4w) }));
      else { h += esc(T('kp.ziel_eta', { s: kg(f.slopePer4w), gap: kg(f.gap), eta: deDateY(f.eta), w: f.weeksTo })); if (f.targetDate) h += ' ' + esc(T(f.onTrack ? 'kp.ziel_vor_datum' : 'kp.ziel_nach_datum', { d: deDateY(f.targetDate) })); }
      h += '</div>';
      if (f && !f.reached && f.reason == null) h += src(T('kp.src_prognose'));
      return h + '</div>';
    }).join('');
  }

  function tonnageCard(m) {
    if (!depth().tonnage) return '';
    var G = m.groups, keys = ['legs', 'push', 'pull', 'core'], meta = G._meta || {};
    /* v8-385: laufende Woche ohne Einheit ⇒ letzte Trainingswoche zeigen, klar beschriftet */
    var useLast = !meta.weekHasSets && meta.lastWeekStart, fld = useLast ? 'tonnageLast' : 'tonnageWeek';
    var tmax = Math.max.apply(null, keys.map(function (k) { return Math.max(G[k][fld], G[k].tonnageAvg4); }).concat([1]));
    var any = keys.some(function (k) { return G[k][fld] > 0 || G[k].tonnageAvg4 > 0; });
    if (!any) return '';
    var title = useLast ? T('kp.tonnage_letzte_woche', { d: deDate(meta.lastWeekStart) + '–' + deDate(new Date(Date.parse(meta.lastWeekStart + 'T12:00:00Z') + 6 * 864e5).toISOString().slice(0, 10)) }) : T('kp.tonnage_woche');
    return '<div class="card tight" data-gm-slot="strength-tonnage"><div class="ctitle"><div class="l">' + ic('chart') + ' ' + esc(title) + '</div></div><div class="kp-ton">' +
      keys.map(function (k) { var g = G[k]; return '<div class="kp-trow"><span class="n">' + esc(grpLabel(k)) + '</span><span class="bar"><i style="width:' + Math.round(g[fld] / tmax * 100) + '%"></i>' + (g.tonnageAvg4 > 0 ? '<span class="avg" style="left:' + Math.round(g.tonnageAvg4 / tmax * 100) + '%"></span>' : '') + '</span><span class="v">' + esc(kgInt(g[fld])) + ' kg</span></div>'; }).join('') +
      '</div><div class="kp-legend"><span><i class="a"></i>' + esc(useLast ? T('kp.letzte_trainingswoche') : T('kp.diese_woche')) + '</span><span><i class="b"></i>' + esc(T('kp.schnitt_4w')) + '</span></div>' + src(T('kp.src_tonnage')) + '</div>';
  }

  function balanceCard(m) {
    var b = m.balance; if (!b || (b.pushPull.ratio == null && b.legsUpper.ratio == null)) return '';
    function row(label, r, la, lb) {
      if (r.ratio == null) return '<div class="kp-brow"><div class="head"><span>' + esc(label) + '</span><b>—</b></div><div class="kp-duolbl"><span>' + esc(T('kp.zu_wenig_daten_d', { d: b.windowDays || 28 })) + '</span></div></div>';
      var cls = r.status === 'ok' ? 'ok' : r.status === 'att' ? 'att' : '';
      return '<div class="kp-brow"><div class="head"><span>' + esc(label) + '</span><b class="' + cls + '">' + esc(kg(r.ratio, 2)) + ' : 1</b></div><div class="kp-duo"><i class="a" style="flex:' + Math.round(r.ratio * 100) + '"></i><i class="b" style="flex:100"></i></div><div class="kp-duolbl"><span>' + esc(la + ' ' + r.a + ' ' + T('kp.saetze_kurz')) + '</span><span>' + esc(lb + ' ' + r.b + ' ' + T('kp.saetze_kurz')) + '</span></div></div>';
    }
    var D = depth();
    var h = '<div class="card tight" data-gm-slot="strength-balance"><div class="ctitle"><div class="l">' + ic('shield') + ' ' + esc(T('kp.balance')) + '</div><span class="more">' + esc(T('kp.n_tage_n_einheiten', { d: b.windowDays || 28, n: b.sessions != null ? b.sessions : '—' })) + '</span></div>' +
      (D.balanceBars ? '<div class="kp-bal">' + row(T('kp.druck_zug'), b.pushPull, grpLabel('push'), grpLabel('pull')) + row(T('kp.beine_oberkoerper'), b.legsUpper, grpLabel('legs'), T('kp.oberkoerper')) + '</div>' : '');
    var lu = b.legsUpper;
    if (b.pushPull.status === 'att' && (D.balanceBars || !(lu.blocked || lu.status === 'att'))) h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T(b.pushPull.ratio > 1.2 ? 'kp.druck_dominant' : 'kp.zug_dominant')) + '</b> ' + esc(T(D.jargon ? 'kp.druck_zug_d' : 'kp.druck_zug_d_einfach')) + '</div></div>';
    if (lu.blocked) h += '<div class="kp-note">' + ic('knee', 'sm') + '<div><b>' + esc(T('kp.beine_ausgesetzt', { label: lu.injuryLabel || '', stage: (lu.injuryStage || 0) + 1 })) + '</b> ' + esc(T('kp.beine_ausgesetzt_d')) + '</div></div>';
    else if (lu.status === 'att') h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.beine_unter')) + '</b> ' + esc(T('kp.beine_unter_d')) + '</div></div>';
    if (lu.status === 'ok' && b.pushPull.status === 'ok') h += '<div class="kp-note">' + ic('check', 'sm') + '<div>' + esc(T('kp.balance_ok')) + '</div></div>';
    return h + (D.balanceBars ? src(T('kp.src_balance_d', { d: b.windowDays || 28 })) : '') + '</div>';
  }

  /* ---------- Seite ---------- */
  function body(m) {
    if (!m) return '<div class="card"><p>' + esc(T('kp.engine_fehlt')) + '</p></div>';
    var exs = m.exercises;
    if (!exs.length) {
      return '<div class="card tight"><div class="kp-empty"><div class="e-ic">' + ic('dumbbell') + '</div><div class="t">' + esc(T('kp.noch_keine_krafteinheit')) + '</div><div class="d">' + esc(T('kp.noch_keine_krafteinheit_d')) + '</div></div>' +
        '<div class="rl-acts"><button type="button" class="btn" data-a="kpstart">' + esc(T('kp.training_starten')) + '</button></div></div>';
    }
    var groups = O.strengthProfile.GROUPS.map(function (g) { return g[0]; }).filter(function (k) { return exs.some(function (e) { return e.group === k; }); });
    if (exs.some(function (e) { return e.group === 'other'; })) groups.push('other');
    if (!st.grp || groups.indexOf(st.grp) < 0) st.grp = groups[0];
    var inGrp = exs.filter(function (e) { return e.group === st.grp; });
    if (!st.ex || !inGrp.some(function (e) { return e.key === st.ex; })) { st.ex = inGrp[0].key; st.pt = null; }
    var em = m.exerciseModel(st.ex);
    var h = '<div class="filter-row kp-filter">' + groups.map(function (k) { return '<button type="button" class="filter-pill' + (st.grp === k ? ' on' : '') + '" data-a="kpgrp" data-v="' + k + '">' + esc(grpLabel(k)) + '</button>'; }).join('') + '</div>';
    h += '<div class="filter-row kp-filter">' + inGrp.map(function (e) { return '<button type="button" class="filter-pill' + (st.ex === e.key ? ' on' : '') + (e.ready ? '' : ' dim') + '" data-a="kpex" data-v="' + esc(e.key) + '">' + esc(e.name) + (e.ready ? '' : ' ·') + '</button>'; }).join('') + '</div>';
    h += '<div class="kp-srcline">' + ic('info', 'xs') + ' ' + esc(T('kp.uebungen_zeile', { n: exs.length })) + '</div>';
    h += exerciseCard(em, m) + prCard(em) + historyCard(em) + muscleCard(m) + goalCard(m, em) + tonnageCard(m) + balanceCard(m);
    return h;
  }
  function render() {
    var w = root[SHEET]; if (!w || !w.querySelector) return;
    var host = w.querySelector('#kpBody'); if (!host) return;
    host.innerHTML = (_loading ? '<div class="kp-loading">' + esc(T('kp.laedt_server')) + '</div>' : '') + body(_model);
  }
  function onClick(ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-a]') : null; if (!t) return;
    var a = t.getAttribute('data-a'), v = t.getAttribute('data-v');
    if (a === 'kpgrp') { st.grp = v; st.ex = null; st.pt = null; render(); }
    else if (a === 'kpex') { st.ex = v; st.pt = null; render(); }
    else if (a === 'kppt') { st.pt = +v; render(); }
    else if (a === 'kpstart') { try { root._closeM(SHEET); } catch (e) {} try { if (typeof root.gmOpenStartSheet === 'function') root.gmOpenStartSheet(); } catch (e) {} }
  }
  /* v8-383: Server-Workouts nachladen (gymPipelineAsync refresh) — vorher nur lokale Snapshots,
     wodurch auf einem zweiten Geraet fast alle Einheiten fehlten. Sheet zeigt bis dahin den
     lokalen Stand mit Ladehinweis und rendert danach neu. */
  var _loading = false, _loadedAt = 0;
  function refreshAsync(after) {
    var gv = O.gymVolume; if (!gv || !gv.gymPipelineAsync || _loading) return false;
    _loading = true;
    gv.gymPipelineAsync({ days: 365, refresh: true }).then(function () { _loading = false; _loadedAt = Date.now(); _ctx = collect(); _model = buildModel(_ctx); if (typeof after === 'function') after(); })
      .catch(function () { _loading = false; if (typeof after === 'function') after(); });
    return true;
  }
  function open(opts) {
    var o = opts || {};
    _ctx = collect(); _model = buildModel(_ctx);
    var fresh = (Date.now() - _loadedAt) < 60000;
    if (!fresh) refreshAsync(function () { render(); });
    if (o.goalTitle && _model && O.strengthProfile.matchGoalExercise) { var EG = O.strengthProfile.matchGoalExercise({ title: o.goalTitle }, _model.exercises); if (EG) { st.grp = EG.group; st.ex = EG.key; st.pt = null; } }
    if (o.exercise && _model) { var E = _model.exercises.filter(function (e) { return e.key === o.exercise || e.name === o.exercise; })[0]; if (E) { st.grp = E.group; st.ex = E.key; st.pt = null; } }
    if (typeof root.openSheet !== 'function') return false;
    var n = _model ? _model.sessions : 0;
    var sub = _model && n ? T('kp.sub', { n: n, w: Math.min(_model.windowWeeks, Math.max(1, _model.dataWeeks || 1)) }) : T('kp.sub_leer');
    var w = root.openSheet({ id: SHEET, title: esc(T('kp.titel')) + '<div class="gd-psub">' + esc(sub) + '</div>', size: 'full', body: '<div id="kpBody" class="kp-body" data-gm-slot="strength-profile"></div>' });
    try { w.querySelector('.orvia-sheet-scroll').addEventListener('click', onClick); } catch (e) {}
    render();
    return true;
  }
  /* Teaser für Analyse · Körper / Profil · Leistung: bestes Ergebnis in einer Zeile */
  function teaser() {
    try {
      var fresh = (Date.now() - _loadedAt) < 60000;
      if (!fresh && !_loading) refreshAsync(function () { try { if (typeof root.renderGMAnalysis === 'function' && document.getElementById('gmAna')) root.renderGMAnalysis(); } catch (e) {} });
      var ctx = collect(); var m = buildModel(ctx); if (!m || !m.exercises.length) return { empty: true, sessions: 0, loading: _loading };
      var best = null; m.exercises.forEach(function (E) { if (!E.ready || E.mode !== 'load') return; var em = m.exerciseModel(E.key); if (em && em.current != null && (!best || (em.delta && best.delta && em.delta.kg > best.delta.kg) || !best.delta)) best = em; });
      var under = (m.groups && m.groups._meta && !m.groups._meta.weekHasSets) ? 0 : (m.muscles && m.muscles.rows || []).filter(function (r) { return r.status === 'under'; }).length;
      return { empty: false, loading: _loading, sessions: m.sessions, exercise: best ? best.name : null, current: best ? best.current : null, delta: best && best.delta ? best.delta : null, under: under, weekIdle: !!(m.groups && m.groups._meta && !m.groups._meta.weekHasSets), ready: m.exercises.filter(function (E) { return E.ready; }).length, total: m.exercises.length };
    } catch (e) { return { empty: true, sessions: 0 }; }
  }

  var api = { VERSION: VERSION, open: open, render: render, teaser: teaser, body: body, _state: st };
  O.strengthProfileScreen = api;
  root.openStrengthProfile = function (opts) { return open(opts); };
})(typeof globalThis !== 'undefined' ? globalThis : this);
