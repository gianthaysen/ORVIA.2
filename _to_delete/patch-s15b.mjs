import fs from 'node:fs';
function patch(f, pairs) { let s = fs.readFileSync(f, 'utf8'); pairs.forEach(([a, b]) => { if (!s.includes(a)) throw new Error(f + ' anchor: ' + a.slice(0, 70)); s = s.replace(a, b); }); fs.writeFileSync(f, s); }
/* A · buildGoal: Tracking-Wochen auch aus Store-Laeufen (Garmin-Nutzer hatten 0 ⇒ nodata) */
patch('app/js/ui.js', [[
`  const trackingWeeks=keys.length?Math.floor((new Date(todayStr())-new Date(keys[0]))/(7*864e5)):0;`,
`  /* S1.5 (13.09.2026): Tracking-Wochen = Datenverfuegbarkeit, nicht nur Legacy-Tagebuch. Ein Garmin-Nutzer
     ohne Tagebucheintraege hatte trackingWeeks 0 ⇒ Goal-Engine dauerhaft nodata trotz 150 Laeufen. */
  var _firstDay=keys.length?keys[0]:null;
  try{var _sr=_storeRunSessions();_sr.forEach(function(x){if(x&&x.day&&(!_firstDay||x.day<_firstDay))_firstDay=x.day;});}catch(_){ }
  const trackingWeeks=_firstDay?Math.floor((new Date(todayStr())-new Date(_firstDay))/(7*864e5)):0;`]]);
/* B · Profilstaerke: Leistungsreferenz nicht davon abhaengig, ob der Plan-Tab schon gerendert wurde */
patch('app/js/profile-center.js', [[
`    var perf = null; try { perf = (O._lastPlanPerf !== undefined) ? O._lastPlanPerf : null; } catch (e) {}`,
`    var perf = null; try { perf = (O._lastPlanPerf !== undefined) ? O._lastPlanPerf : null; } catch (e) {}
    /* S1.5: _lastPlanPerf entsteht erst beim Rendern des Plan-Tabs — davor stand die Profilstaerke faelschlich
       auf „Leistungsreferenz fehlt" (80 % statt 100 %). Ohne Plan-Render selbst aufloesen. */
    if (perf == null) { try { if (O.performanceResolver && O.performanceResolver.resolveAll) perf = O.performanceResolver.resolveAll(p, { today: (typeof root.todayStr === 'function') ? root.todayStr() : null }); } catch (e) { perf = null; } }`]]);
/* C · goal-detail */
patch('app/js/goal-detail.js', [
[`    if (distKm && m.daysTo != null && m.daysTo > 14) {
      var need = Math.round((m.daysTo > 28 ? 14 : 17) * (distKm / HM_KM)), have = num(o.longestRun28);
      if (have != null) out.push({ id: 'long', kind: have >= need ? 'plus' : 'minus', html: T(have >= need ? 'gd.r_long_ok' : 'gd.r_long_short', { have: fmtDe(have, 1), need: need }), lever: have >= need ? null : T('gd.l_long', { need: need, have: fmtDe(have, 1) }) });
    }`,
`    if (distKm && m.daysTo != null && m.daysTo > 14) {
      var need = Math.round((m.daysTo > 28 ? 14 : 17) * (distKm / HM_KM)), have = num(o.longestRun28);
      /* Ausserhalb der Saison (> 16 Wochen) ist der Long-Run-Bedarf der Wettkampfvorbereitung noch keine Bedingung —
         die Goal-Engine-Regel stammt aus der HM-Saison. Anzeige neutral, kein Veto, keine Stellschraube. */
      if (have != null && m.daysTo > 112) out.push({ id: 'long', kind: 'neutral', html: T('gd.r_long_later', { have: fmtDe(have, 1), need: need }) });
      else if (have != null) out.push({ id: 'long', kind: have >= need ? 'plus' : 'minus', html: T(have >= need ? 'gd.r_long_ok' : 'gd.r_long_short', { have: fmtDe(have, 1), need: need }), lever: have >= need ? null : T('gd.l_long', { need: need, have: fmtDe(have, 1) }) });
    }`],
[`    var tMin = null; try { tMin = m.feas && m.feas.predMin != null && m.feas.deltaSec != null ? m.feas.predMin - m.feas.deltaSec / 60 : null; } catch (e) {}`,
 `    var tMin = num(m.targetMin);`],
[`      targetText: null, targetSub: null, dateText: deDate(g.targetDate),`,
 `      targetText: null, targetSub: null, targetMin: t.targetMin != null ? t.targetMin : null, dateText: deDate(g.targetDate),`],
[`    if (!hist.some(function (h) { return h.type === 'created'; }) && g.createdAt) hist.unshift({ at: g.createdAt, type: 'created', to: {} });`,
 `    if (!hist.some(function (h) { return h.type === 'created'; }) && g.createdAt) hist.unshift({ at: g.createdAt, type: 'created', to: null, synthetic: true });`],
[`      case 'created': return T('gd.h_created', { v: h.to && h.to.targetValue != null ? T('gd.h_with', { v: fv(h.to.targetValue) }) : '', prio: h.to && h.to.priority ? h.to.priority : '—' }) + (h.note ? ' · ' + esc(h.note) : '') + fc;`,
 `      case 'created': if (!h.to) return T('gd.h_created_plain'); return T('gd.h_created', { v: h.to.targetValue != null ? T('gd.h_with', { v: fv(h.to.targetValue) }) : '', prio: h.to.priority ? h.to.priority : '—' }) + (h.note ? ' · ' + esc(h.note) : '') + fc;`],
[`      var days = Array.isArray(wp) ? wp : (wp.days || []), names = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], out = [];
      days.forEach(function (d, i) { (Array.isArray(d) ? d : (d && d.items) || []).forEach(function (u) { if (!u || !u.t) return; var sport = { Laufen: 'bolt', Rad: 'gauge', Schwimmen: 'link', Gym: 'shield' }[u.t] || 'bolt'; out.push({ day: names[i] || '', title: (names[i] ? names[i] + ' · ' : '') + (u.l || u.t), detail: [u.t, u.d].filter(Boolean).join(' · '), icon: sport, hardRun: u.t === 'Laufen' && /interval|tempo|schwelle|long/i.test(String(u.l || '') + ' ' + String(u.kind || '')) }); }); });
      return out;`,
 `      var days = Array.isArray(wp) ? wp : (wp.days || []), names = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], out = [];
      /* Pace-/Leistungsvorgabe wie auf der Plan-Karte (performanceZones.targetForUnit), Kuerzel iv/ez/lr/tempo nie als Text */
      var perfBy = null; try { perfBy = O._lastPlanPerf && O._lastPlanPerf.sports ? O._lastPlanPerf.sports : null; if (!perfBy && O.performanceResolver && O.performanceResolver.resolveAll) { var pr = O.performanceResolver.resolveAll(root.PROFILE || null, { today: root.todayStr ? root.todayStr() : null }); perfBy = pr && pr.sports ? pr.sports : null; } } catch (e) { perfBy = null; }
      days.forEach(function (d, i) { (Array.isArray(d) ? d : (d && d.items) || []).forEach(function (u) { if (!u || !u.t) return; var sport = { Laufen: 'bolt', Rad: 'gauge', Schwimmen: 'link', Gym: 'shield' }[u.t] || 'bolt';
        var dOk = u.d && !/^(lr|iv|ez|tempo|recovery|long|easy)$/i.test(String(u.d).trim()), parts = [u.t]; if (dOk) parts.push(u.d);
        try { if (perfBy && O.performanceZones && O.performanceZones.targetForUnit) { var tg = O.performanceZones.targetForUnit(u, perfBy); if (tg && tg.ok && tg.text) parts.push(tg.text); } } catch (e) {}
        var key = String(u.d || '').toLowerCase() + ' ' + String(u.l || '').toLowerCase() + ' ' + String(u.kind || '').toLowerCase();
        out.push({ day: names[i] || '', title: (names[i] ? names[i] + ' · ' : '') + (u.l || u.t), detail: parts.join(' · '), icon: sport, hardRun: u.t === 'Laufen' && /\\biv\\b|\\blr\\b|\\btempo\\b|interval|schwelle|long/i.test(key) }); }); });
      return out;`]]);
patch('app/locales/de.js', [[`    'gd.r_long_ok':`, `    'gd.r_long_later': 'Längster Lauf in 28 Tagen <b>{have} km</b> — der Wettkampfbedarf (≥ {need} km) wird erst in der Spitzenphase zur Bedingung',
    'gd.h_created_plain': '<b>Ziel angelegt</b>',
    'gd.r_long_ok':`]]);
console.log('ok');
