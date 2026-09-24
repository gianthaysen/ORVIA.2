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
