import fs from 'node:fs';
const f = 'app/js/screens/profile-v14.js'; let s = fs.readFileSync(f, 'utf8'); let n = 0;
function rep(a, b) { if (!s.includes(a)) throw new Error('anchor: ' + a.slice(0, 90)); s = s.replace(a, b); n++; }

/* 1 Saison: engine/season-phases (Basis/Aufbau/Spitze/Tapering mit Wochen) — Calc.racePhases nur Rueckfall */
rep(`    try { var C = root.Calc; if (d.planInput && d.planInput.targetDate && C && C.racePhases) d.season = { phases: C.racePhases(d.planInput.targetDate, d.today), daysTo: d.planInput.daysTo, phase: d.planInput.phase }; } catch (e) {}`,
`    try { if (d.planInput && d.planInput.targetDate) {
      var SP = O.seasonPhases, sp = null;
      if (SP && SP.seasonPhases) sp = SP.seasonPhases(d.planInput.targetDate, d.today, { startDate: mg && mg.createdAt ? String(mg.createdAt).slice(0, 10) : null });
      if (sp) d.season = { model: 'season', phases: sp.phases, current: sp.current, totalWeeks: sp.totalWeeks, weeksToRace: sp.weeksToRace, daysTo: sp.daysToRace, targetDate: sp.targetDate, phase: d.planInput.phase };
      else { var C = root.Calc; if (C && C.racePhases) d.season = { model: 'race', phases: C.racePhases(d.planInput.targetDate, d.today), daysTo: d.planInput.daysTo, phase: d.planInput.phase }; }
    } } catch (e) {}`);
rep(`      var ph = d.season.phases, cur = ph.filter(function (p) { return p.on; })[0];
      var title = cur ? (esc(cur.n) + (d.season.daysTo != null && d.season.daysTo > 0 ? ' · ' + esc(T('pv.wettkampf_in_n_tagen', { n: d.season.daysTo })) : (d.season.daysTo === 0 ? ' · ' + esc(T('pv.wettkampf_heute')) : ''))) : esc(T('pv.saison_ohne_phase'));`,
`      var ph = d.season.phases, cur = ph.filter(function (p) { return p.on; })[0], isSeason = d.season.model === 'season';
      var title;
      if (cur && isSeason) title = esc(T('pv.phase_woche_von', { phase: cur.n, week: cur.week || 1, of: cur.weeks }));
      else title = cur ? (esc(cur.n) + (d.season.daysTo != null && d.season.daysTo > 0 ? ' · ' + esc(T('pv.wettkampf_in_n_tagen', { n: d.season.daysTo })) : (d.season.daysTo === 0 ? ' · ' + esc(T('pv.wettkampf_heute')) : ''))) : esc(T('pv.saison_ohne_phase'));`);
rep(`'<div class="pv-phases">' + ph.map(function (p) { var isRace = p.from && p.to && p.from === p.to; return '<div class="pv-phase' + (p.on ? ' on' : '') + '"><b>' + esc(p.n) + '</b><span>' + esc(p.to ? (isRace ? deDate(p.to) : T('pv.bis_datum', { d: deDate(p.to) })) : '') + '</span></div>'; }).join('') + '</div>' +`,
`'<div class="pv-phases">' + ph.map(function (p) {
          var sub;
          if (isSeason) sub = p.on ? T('pv.woche_x_von_y', { x: p.week || 1, y: p.weeks }) : (p.done ? T('pv.n_wo_fertig', { n: p.weeks }) : T('pv.n_wo', { n: p.weeks }));
          else { var isRace = p.from && p.to && p.from === p.to; sub = p.to ? (isRace ? deDate(p.to) : T('pv.bis_datum', { d: deDate(p.to) })) : ''; }
          return '<div class="pv-phase' + (p.on ? ' on' : '') + (p.done ? ' done' : '') + '"><b>' + esc(p.n) + '</b><span>' + esc(sub) + '</span></div>'; }).join('') + '</div>' +`);
rep(`'<div class="source">' + ic('info', 'xs') + ' ' + esc(T('pv.saison_quelle', { n: d.activitiesCount != null ? d.activitiesCount : '—' })) + '</div></div>';`,
`'<div class="source">' + ic('info', 'xs') + ' ' + esc(T('pv.saison_quelle', { n: d.activitiesCount != null ? d.activitiesCount : '—' })) + (isSeason && d.season.targetDate ? ' · ' + esc(T('pv.saison_wettkampf_am', { d: deDate(d.season.targetDate), n: d.season.daysTo })) : '') + '</div></div>';`);

/* 2 Profilstaerke-Karte nur, wenn etwas fehlt */
rep(`host.innerHTML = head + strengthCardHTML(d.strength) + navHTML(tab)`,
    `host.innerHTML = head + (strengthNeedsCard(d.strength) ? strengthCardHTML(d.strength) : '') + navHTML(tab)`);
rep(`  /* ---------- Profilstärke-Karte (v14 ps-card) ---------- */`,
`  /* ---------- Profilstärke-Karte (v14 ps-card) ---------- */
  /* Bei 100 % ohne Luecken verschwindet die Karte: Eine Vollzugsmeldung ist kein Produktinhalt (Gian, 13.09.). */
  function strengthNeedsCard(st) { if (!st) return false; var pct = Math.round(st.score || 0); return pct < 100 || (st.gaps || []).length > 0; }`);

/* 3 Bestzeiten: Schaetzquelle benennen */
rep(`var sub = sec == null ? T('pv.keine_messung') : (real ? (T('pv.gemessen') + (m && m.date ? ' · ' + deDate(m.date) : '')) : T('pv.geschaetzt_riegel'));`,
    `var from = b && b.estFrom ? b.estFrom[k[2]] : null, fromLbl = { k1: '1 km', k5: '5 km', k10: '10 km', k21: 'HM', k42: 'M' }[from];
      var sub = sec == null ? T('pv.keine_messung') : (real ? (T('pv.gemessen') + (m && m.date ? ' · ' + deDate(m.date) : '')) : (fromLbl ? T('pv.geschaetzt_aus', { d: fromLbl }) : T('pv.geschaetzt_riegel')));`);

/* 4 Profil & Kontrolle: rechte Werte wie im Prototyp (n aktiv · Provider) */
rep(`    h += '<div class="setting-group">' + [['target', T('pv.ziele_sportarten'), T('pv.ziele_sportarten_sub'), "gmOpenProfPage('goals')"], ['link', T('pv.geraete_daten'), sync || T('pv.geraete_daten_sub'), "gmOpenProfPage('connections')"], ['gear', T('pv.einstellungen'), T('pv.einstellungen_sub'), "gmOpenProfPage('settings')"]].map(function (r) {
      return '<div class="prow" onclick="' + r[3] + '"><div class="p-ic">' + ic(r[0], 'sm') + '</div><div class="p-b"><div class="p-t">' + esc(r[1]) + '</div><div class="p-d">' + esc(r[2]) + '</div></div>' + ic('chev', 'sm') + '</div>'; }).join('') + '</div>';`,
`    var nActive = d.goals.filter(function (g) { return g && g.status === 'active'; }).length;
    var syncParts = sync ? sync.split(' · ') : [], syncProv = syncParts.length > 1 ? syncParts[0] : '', syncRest = syncParts.length > 1 ? syncParts.slice(1).join(' · ') : sync;
    h += '<div class="setting-group">' + [['target', T('pv.ziele_sportarten'), T('pv.ziele_sportarten_sub'), "gmOpenProfPage('goals')", nActive ? T('pv.n_aktiv', { n: nActive }) : ''], ['link', T('pv.geraete_daten'), syncRest || T('pv.geraete_daten_sub'), "gmOpenProfPage('connections')", syncProv], ['gear', T('pv.einstellungen'), T('pv.einstellungen_sub'), "gmOpenProfPage('settings')", '']].map(function (r) {
      return '<div class="prow" onclick="' + r[3] + '"><div class="p-ic">' + ic(r[0], 'sm') + '</div><div class="p-b"><div class="p-t">' + esc(r[1]) + '</div><div class="p-d">' + esc(r[2]) + '</div></div>' + (r[4] ? '<div class="p-v">' + esc(r[4]) + '</div>' : '') + ic('chev', 'sm') + '</div>'; }).join('') + '</div>';`);
s = s.replace("VERSION = 'profile-v14@1'", "VERSION = 'profile-v14@2'");
fs.writeFileSync(f, s); console.log('replacements', n);

const l = 'app/locales/de.js'; let t = fs.readFileSync(l, 'utf8');
const la = "    'pv.src_auto': 'automatisch',\n"; if (!t.includes(la)) throw new Error('locale');
t = t.replace(la, la + `    'pv.phase_woche_von': '{phase}phase · Woche {week} von {of}',
    'pv.woche_x_von_y': 'Woche {x}/{y}',
    'pv.n_wo': '{n} Wo',
    'pv.n_wo_fertig': '{n} Wo · fertig',
    'pv.saison_wettkampf_am': 'Wettkampf {d} (in {n} Tagen)',
    'pv.geschaetzt_aus': 'geschätzt aus {d} (Riegel)',
    'pv.n_aktiv': '{n} aktiv',
`);
fs.writeFileSync(l, t);
