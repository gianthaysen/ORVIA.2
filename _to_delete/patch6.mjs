import fs from 'fs';
function rep(f,a,b){let s=fs.readFileSync(f,'utf8'); if(!s.includes(a)){console.error('MISSING in '+f+': '+a.slice(0,100)); process.exit(1);} s=s.replace(a,b); fs.writeFileSync(f,s);}
/* ---- goal-detail: Niveau-Vertrag ---- */
rep('app/js/goal-detail.js',
`  function html(m) {
    if (!m) return '<p class="muted">' + esc(T('goal.detail.none')) + '</p>';
    var p = m.progress, h = '<div class="gd gd2">';`,
`  /* Niveau-Vertrag (v8-382): a = Anfaenger (Zielzeit, Machbarkeit als Satz, Vertrag, Plan, EINE
     Stellschraube, Meilensteine, Verwalten), f = Fortgeschritten (+ Gruende max. 3, Prognoseverlauf,
     Einzahlungen, Historie), p = Profi (alles, Gruende vollstaendig). */
  var DEPTH = { a: { reasons: 0, forecast: false, deposits: false, history: false, levers: 1, interactions: false },
                f: { reasons: 3, forecast: true, deposits: true, history: true, levers: 2, interactions: true },
                p: { reasons: 99, forecast: true, deposits: true, history: true, levers: 2, interactions: true } };
  function depth() { var l = 'f'; try { l = typeof root.gmLevel === 'function' ? root.gmLevel() : 'f'; } catch (e) {} return DEPTH[l] || DEPTH.f; }
  function html(m) {
    if (!m) return '<p class="muted">' + esc(T('goal.detail.none')) + '</p>';
    var D = depth();
    var p = m.progress, h = '<div class="gd gd2">';`);
rep('app/js/goal-detail.js',
`        (m.reasons.length ? '<div class="gd-reasons">' + m.reasons.map(function (r) {`,
`        (m.reasons.length && D.reasons > 0 ? '<div class="gd-reasons">' + m.reasons.slice(0, D.reasons).map(function (r) {`);
rep('app/js/goal-detail.js',
`    if (p.kind === 'time') {
      var svg = seriesSVG(m);`,
`    if (p.kind === 'time' && D.forecast) {
      var svg = seriesSVG(m);`);
rep('app/js/goal-detail.js',
`    if (m.levers.length) {
      h += sect(T(m.levers.length === 1 ? 'gd.levers_one' : 'gd.levers'));
      h += m.levers.map(function (l) {`,
`    if (m.levers.length) {
      var levers = m.levers.slice(0, D.levers);
      h += sect(T(levers.length === 1 ? 'gd.levers_one' : 'gd.levers'));
      h += levers.map(function (l) {`);
rep('app/js/goal-detail.js',
`    if (m.keyWeeks.length) {
      h += sect(T('gd.dep_title'))`,
`    if (m.keyWeeks.length && D.deposits) {
      h += sect(T('gd.dep_title'))`);
rep('app/js/goal-detail.js',
`    h += sect(T('gd.history')) + '<div class="card tight"><div class="gd-log">' +`,
`    if (D.history) h += sect(T('gd.history')) + '<div class="card tight"><div class="gd-log">' +`);
rep('app/js/goal-detail.js',
`    h += sect(T('gd.interactions'));
    if (m.conflicts.length) h += m.conflicts.map(`,
`    if (D.interactions || m.conflicts.length) h += sect(T('gd.interactions'));
    if (m.conflicts.length) h += m.conflicts.map(`);
rep('app/js/goal-detail.js',
`    else h += '<div class="card tight"><p class="muted" style="margin:0">' + esc(T('gd.interactions_none')) + '</p></div>';`,
`    else if (D.interactions) h += '<div class="card tight"><p class="muted" style="margin:0">' + esc(T('gd.interactions_none')) + '</p></div>';`);
/* ---- profile-v14: Leistung nach Niveau ---- */
rep('app/js/screens/profile-v14.js',
`  function performanceHTML(d) {
    var h = '<div class="kpi-row">' +
      '<div class="kpi"><b>' + esc(d.vo2 ? fmtDe(d.vo2.value) : '—') + '</b><span>VO₂max</span><small>' + esc(d.vo2 ? (srcLabel(d.vo2.source) || T('pv.gemessen')) : T('pv.keine_quelle')) + '</small></div>' +
      '<div class="kpi"><b>' + esc(d.load && d.load.ctl != null ? d.load.ctl : '—') + '</b><span>' + esc(T('pv.fitness')) + '</span><small>' + esc(d.load && d.load.suppressed ? T('pv.last_unsicher') : 'CTL') + '</small></div>' +
      '<div class="kpi"><b>' + esc(d.load && d.load.acwr != null ? fmtDe(d.load.acwr, 2) : '—') + '</b><span>ACWR</span><small>' + esc(d.load && d.load.acwr != null ? (d.load.acwr >= 0.8 && d.load.acwr <= 1.3 ? T('pv.im_korridor') : T('pv.ausserhalb')) : T('pv.zu_wenig_daten')) + '</small></div></div>';`,
`  /* Niveau (v8-382): Anfaenger sehen Ausdauerwert/Fitness/Belastung in Worten (kein CTL/ACWR),
     keine Zonen & Schwellen; Fortgeschritten/Profi wie bisher. */
  function lvl() { try { return typeof root.gmLevel === 'function' ? root.gmLevel() : 'f'; } catch (e) { return 'f'; } }
  function performanceHTML(d) {
    var L = lvl(), h;
    if (L === 'a') {
      var acwr = d.load && d.load.acwr != null ? d.load.acwr : null;
      var lastTxt = acwr == null ? T('pv.zu_wenig_daten') : (acwr < 0.8 ? T('pv.last_niedrig') : (acwr <= 1.3 ? T('pv.last_passt') : T('pv.last_hoch')));
      h = '<div class="kpi-row">' +
        '<div class="kpi"><b>' + esc(d.vo2 ? fmtDe(d.vo2.value) : '—') + '</b><span>' + esc(T('pv.ausdauerwert')) + '</span><small>' + esc(d.vo2 ? T('pv.vo2_einfach') : T('pv.keine_quelle')) + '</small></div>' +
        '<div class="kpi"><b>' + esc(d.load && d.load.ctl != null ? d.load.ctl : '—') + '</b><span>' + esc(T('pv.fitness')) + '</span><small>' + esc(d.load && d.load.ctl != null ? T('pv.fitness_einfach') : T('pv.zu_wenig_daten')) + '</small></div>' +
        '<div class="kpi"><b>' + esc(acwr == null ? '—' : (acwr < 0.8 ? '↓' : (acwr <= 1.3 ? '✓' : '↑'))) + '</b><span>' + esc(T('pv.belastung')) + '</span><small>' + esc(lastTxt) + '</small></div></div>';
    } else {
    h = '<div class="kpi-row">' +
      '<div class="kpi"><b>' + esc(d.vo2 ? fmtDe(d.vo2.value) : '—') + '</b><span>VO₂max</span><small>' + esc(d.vo2 ? (srcLabel(d.vo2.source) || T('pv.gemessen')) : T('pv.keine_quelle')) + '</small></div>' +
      '<div class="kpi"><b>' + esc(d.load && d.load.ctl != null ? d.load.ctl : '—') + '</b><span>' + esc(T('pv.fitness')) + '</span><small>' + esc(d.load && d.load.suppressed ? T('pv.last_unsicher') : 'CTL') + '</small></div>' +
      '<div class="kpi"><b>' + esc(d.load && d.load.acwr != null ? fmtDe(d.load.acwr, 2) : '—') + '</b><span>ACWR</span><small>' + esc(d.load && d.load.acwr != null ? (d.load.acwr >= 0.8 && d.load.acwr <= 1.3 ? T('pv.im_korridor') : T('pv.ausserhalb')) : T('pv.zu_wenig_daten')) + '</small></div></div>';
    }`);
rep('app/js/screens/profile-v14.js',
`    h += sectlabel(T('pv.zonen_schwellen'), { label: esc(T('pv.leistungsdaten')), onclick: "gmOpenProfPage('performance')" });
    h += '<div class="card tight">' +`,
`    if (L !== 'a') {
    h += sectlabel(T('pv.zonen_schwellen'), { label: esc(T('pv.leistungsdaten')), onclick: "gmOpenProfPage('performance')" });
    h += '<div class="card tight">' +`);
rep('app/js/screens/profile-v14.js',
`    h += '<div class="setting-group pv-links">' + [['bolt', T('pv.medaillen')`,
`    }
    h += '<div class="setting-group pv-links">' + [['bolt', T('pv.medaillen')`);
/* Locale */
rep('app/locales/de.js', "    'pv.phase_base': 'Basisphase',",
`    'pv.ausdauerwert': 'Ausdauerwert', 'pv.vo2_einfach': 'je höher, desto besser', 'pv.fitness_einfach': 'Trainingsstand der letzten Wochen',
    'pv.belastung': 'Belastung', 'pv.last_niedrig': 'zuletzt eher wenig', 'pv.last_passt': 'passt zu den Vorwochen', 'pv.last_hoch': 'deutlich mehr als sonst',
    'pv.phase_base': 'Basisphase',`);
console.log('patch6 ok');
