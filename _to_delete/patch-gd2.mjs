import fs from 'node:fs';
const f = 'app/js/goal-detail.js'; let s = fs.readFileSync(f, 'utf8'); let n = 0;
function rep(a, b) { if (!s.includes(a)) throw new Error('anchor: ' + a.slice(0, 80)); s = s.replace(a, b); n++; }
rep(`      out.push({ kind: okVol ? 'plus' : 'minus', html: T(okVol ? 'gd.r_volume_ok' : 'gd.r_volume_low', { have: fmtDe(o.avg4WeekKm, 0), need: fmtDe(o.targetWeekKm, 0) }) });`,
    `      out.push({ id: 'volume', kind: okVol ? 'plus' : 'minus', html: T(okVol ? 'gd.r_volume_ok' : 'gd.r_volume_low', { have: fmtDe(o.avg4WeekKm, 0), need: fmtDe(o.targetWeekKm, 0) }), lever: okVol ? null : T('gd.l_volume', { need: fmtDe(Math.ceil(0.75 * o.targetWeekKm), 0), have: fmtDe(o.avg4WeekKm, 0) }) });`);
rep(`      var okB = m.baseline.equivMin <= t.targetMin;
      out.push({ kind: okB ? 'plus' : 'minus', html: T(okB ? 'gd.r_best_ok' : 'gd.r_best_slow', { dist: m.baseline.label, time: fmtSec(m.baseline.sec), equiv: fmtTime(m.baseline.equivMin) }) });`,
    `      var okB = m.baseline.equivMin <= t.targetMin;
      if (m.baseline.same) out.push({ id: 'best', kind: okB ? 'plus' : 'minus', html: T(okB ? 'gd.r_best_same_ok' : 'gd.r_best_same_slow', { dist: m.baseline.label, time: fmtSec(m.baseline.sec), delta: fmtSec(Math.abs(m.baseline.sec - t.targetMin * 60)) }) });
      else out.push({ id: 'best', kind: okB ? 'plus' : 'minus', html: T(okB ? 'gd.r_best_ok' : 'gd.r_best_slow', { dist: m.baseline.label, time: fmtSec(m.baseline.sec), equiv: fmtTime(m.baseline.equivMin) }) });`);
rep(`      if (have != null) out.push({ kind: have >= need ? 'plus' : 'minus', html: T(have >= need ? 'gd.r_long_ok' : 'gd.r_long_short', { have: fmtDe(have, 1), need: need }) });`,
    `      if (have != null) out.push({ id: 'long', kind: have >= need ? 'plus' : 'minus', html: T(have >= need ? 'gd.r_long_ok' : 'gd.r_long_short', { have: fmtDe(have, 1), need: need }), lever: have >= need ? null : T('gd.l_long', { need: need, have: fmtDe(have, 1) }) });`);
rep(`      out.push({ kind: okK ? 'plus' : 'minus', html: T(planned != null ? (okK ? 'gd.r_key_ok_plan' : 'gd.r_key_low_plan') : (okK ? 'gd.r_key_ok' : 'gd.r_key_low'), { have: fmtDe(perWeek, 1), plan: planned != null ? fmtDe(planned, 1) : '' }) });`,
    `      out.push({ id: 'key', kind: okK ? 'plus' : 'minus', html: T(planned != null ? (okK ? 'gd.r_key_ok_plan' : 'gd.r_key_low_plan') : (okK ? 'gd.r_key_ok' : 'gd.r_key_low'), { have: fmtDe(perWeek, 1), plan: planned != null ? fmtDe(planned, 1) : '' }), lever: okK ? null : T('gd.l_key', { plan: planned != null ? fmtDe(planned, 1) : '1', have: fmtDe(perWeek, 1) }) });`);
rep(`    if (e && Array.isArray(e.vetos)) e.vetos.forEach(function (v) { if (/Fitness/.test(String(v))) out.push({ kind: 'minus', html: T('gd.r_ctl_flat') }); });`,
    `    if (e && Array.isArray(e.vetos)) e.vetos.forEach(function (v) { if (/Fitness/.test(String(v))) out.push({ id: 'ctl', kind: 'minus', html: T('gd.r_ctl_flat'), lever: T('gd.l_ctl') }); });`);
rep(`    m.reasons.forEach(function (r) { if (r.kind !== 'minus' || m.levers.length >= 2) return; m.levers.push({ html: r.html, effect: T('gd.lever_effect') }); });`,
    `    m.reasons.forEach(function (r) { if (r.kind !== 'minus' || !r.lever || m.levers.length >= 2) return; m.levers.push({ id: r.id, html: r.lever, effect: T('gd.lever_effect') }); });`);
rep(`  function fmtGoalValue(g, v) { try { var M = O.profileModel; if (M && typeof M.formatGoalValue === 'function') return M.formatGoalValue(g, v); } catch (e) {} return v == null ? '' : String(v) + (g && g.unit ? ' ' + g.unit : ''); }`,
    `  function fmtGoalValue(g, v) { try { var M = O.profileModel; if (M && typeof M.formatGoalValue === 'function') return M.formatGoalValue(g, v); } catch (e) {} if (g && (g.metricType === 'time' || g.unit === 's') && num(+v) != null) return fmtSec(+v) + (v >= 3600 ? ' h' : ''); return v == null ? '' : String(v) + (g && g.unit ? ' ' + g.unit : ''); }`);
fs.writeFileSync(f, s);
const l = 'app/locales/de.js'; let t = fs.readFileSync(l, 'utf8');
t = t.replace("    'gd.r_long_ok':", `    'gd.r_best_same_ok': '{dist}-Bestzeit <b>{time}</b> liegt bereits {delta} unter der Zielzeit',
    'gd.r_best_same_slow': '{dist}-Bestzeit <b>{time}</b> liegt {delta} über der Zielzeit',
    'gd.l_volume': 'Wochenumfang auf <b>≥ {need} km</b> anheben (aktuell Ø {have} km)',
    'gd.l_long': 'Langen Lauf auf <b>≥ {need} km</b> ziehen (bisher {have} km)',
    'gd.l_key': 'Schlüsseleinheiten auf <b>{plan}/Woche</b> bringen (aktuell {have})',
    'gd.l_ctl': 'Fitness (CTL) über 4 Wochen wieder <b>steigend</b> halten — Umfang oder Intensität schrittweise anheben',
    'gd.r_long_ok':`);
fs.writeFileSync(l, t); console.log('ok', n);
