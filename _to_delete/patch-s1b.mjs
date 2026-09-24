import fs from 'node:fs';
const f = 'app/js/screens/profile-v14.js';
let s = fs.readFileSync(f, 'utf8');
let n = 0;
function rep(a, b) { if (!s.includes(a)) throw new Error('anchor missing: ' + a.slice(0, 80)); s = s.replace(a, b); n++; }

/* 1 Ring-Prozent: eigene Klasse statt globalem .pv (Karten-Stil ueberdeckte den Ring) */
rep(`</defs></svg><div class="pv">' + pct + '%</div>`, `</defs></svg><div class="ps-pct">' + pct + '%</div>`);

/* 2 Saison-Titel + Phasen-Chips */
rep(`var title = cur ? (esc(cur.n) + (d.season.daysTo != null && d.season.daysTo >= 0 ? ' · ' + esc(T('pv.noch_n_tage', { n: d.season.daysTo })) : '')) : esc(T('pv.saison_ohne_phase'));`,
    `var title = cur ? (esc(cur.n) + (d.season.daysTo != null && d.season.daysTo > 0 ? ' · ' + esc(T('pv.wettkampf_in_n_tagen', { n: d.season.daysTo })) : (d.season.daysTo === 0 ? ' · ' + esc(T('pv.wettkampf_heute')) : ''))) : esc(T('pv.saison_ohne_phase'));`);
rep(`'<div class="pv-phases">' + ph.map(function (p) { return '<div class="pv-phase' + (p.on ? ' on' : '') + '"><b>' + esc(p.n) + '</b><span>' + esc(p.to ? deDate(p.to) : '') + '</span></div>'; }).join('') + '</div>' +`,
    `'<div class="pv-phases">' + ph.map(function (p) { var isRace = p.from && p.to && p.from === p.to; return '<div class="pv-phase' + (p.on ? ' on' : '') + '"><b>' + esc(p.n) + '</b><span>' + esc(p.to ? (isRace ? deDate(p.to) : T('pv.bis_datum', { d: deDate(p.to) })) : '') + '</span></div>'; }).join('') + '</div>' +`);

/* 3 Einheiten/Woche ueber den kanonischen Wochenvertrag (gleiche Quelle wie km/Woche) */
rep(`      var cut = new Date(d.today + 'T00:00:00'); cut.setDate(cut.getDate() - 28);
      var n = (acts || []).filter(function (a) { return a && a.status !== 'planned' && a.startedAt && new Date(String(a.startedAt).slice(0, 10) + 'T00:00:00') >= cut; }).length;
      wk.sessionsAvg = (acts && acts.length) ? Math.round(n / 4 * 10) / 10 : null;`,
    `      wk.sessionsAvg = weeklySessionsAvg(d.today, 4);
      if (wk.sessionsAvg == null) {
        var cut = new Date(d.today + 'T00:00:00'); cut.setDate(cut.getDate() - 28);
        var n = (acts || []).filter(function (a) { var st = a && (a.startedAt || a.started_at || a.date || a.startTime); return a && a.status !== 'planned' && st && new Date(String(st).slice(0, 10) + 'T00:00:00') >= cut; }).length;
        wk.sessionsAvg = (acts && acts.length) ? Math.round(n / 4 * 10) / 10 : null;
      }`);
rep(`  /* ---------- Bausteine ---------- */`,
`  /* Ø Einheiten/Woche der letzten n Kalenderwochen (inkl. laufender Woche) aus
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

  /* ---------- Bausteine ---------- */`);

/* 4 Zielfortschritt: Zahlen tolerant lesen; ohne Fortschritt keine leere Leiste */
rep(`    if (typeof g.targetValue === 'number' && typeof g.currentValue === 'number' && g.metricType !== 'time') {
      var lower = /loss|fat|bodyfat|shredded/.test(String(g.category || ''));
      var pct = lower ? (g.currentValue <= g.targetValue ? 100 : Math.round((g.targetValue / g.currentValue) * 100)) : (g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : null);
      return { pct: pct != null ? Math.max(0, Math.min(100, pct)) : null, left: esc(goalValue(g, g.currentValue)) + ' → ' + esc(goalValue(g, g.targetValue)), state: null };
    }
    if (typeof g.targetValue === 'number') return { pct: null, left: esc(T('pv.ziel')) + ' <b>' + esc(goalValue(g, g.targetValue)) + '</b>', state: null };`,
    `    var tv = numLoose(g.targetValue), cv = numLoose(g.currentValue);
    if (tv != null && cv != null && g.metricType !== 'time') {
      var lower = /loss|fat|bodyfat|shredded/.test(String(g.category || ''));
      var pct = lower ? (cv <= tv ? 100 : Math.round((tv / cv) * 100)) : (tv > 0 ? Math.round((cv / tv) * 100) : null);
      return { pct: pct != null ? Math.max(0, Math.min(100, pct)) : null, left: esc(goalValue(g, cv)) + ' → ' + esc(goalValue(g, tv)), state: null };
    }
    if (tv != null) return { pct: null, left: esc(T('pv.ziel')) + ' <b>' + esc(goalValue(g, tv)) + '</b>', state: null };`);
rep(`  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }`,
    `  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function numLoose(v) { if (num(v) != null) return v; if (typeof v === 'string' && /^\\s*-?\\d+([.,]\\d+)?\\s*$/.test(v)) { var x = parseFloat(v.replace(',', '.')); return isFinite(x) ? x : null; } return null; }
  /* Titel, der nur aus einem Wert besteht („12%", „100 kg") ist kein Titel — dann Kategorie zeigen */
  function goalTitle(g) { var t = String(g && g.title || '').trim(); if (!t || /^-?\\d+([.,]\\d+)?\\s*(%|kg|km|min|h|s)?$/i.test(t)) return catLabel(g && g.category) || t; return t; }`);
rep(`    var bar = '<div class="goal-line"><i style="width:' + (p.pct != null ? p.pct : 0) + '%' + (role !== 'main' ? ';background:linear-gradient(90deg,var(--activity),var(--ready))' : '') + '"></i></div>';
    var alloc = o.pill ? '<div class="pv-alloc-note">' + esc(T('pv.zielanteil_leer')) + '</div>' : '';`,
    `    var bar = p.pct != null ? '<div class="goal-line"><i style="width:' + p.pct + '%' + (role !== 'main' ? ';background:linear-gradient(90deg,var(--activity),var(--ready))' : '') + '"></i></div>' : '<div class="goal-line none"></div>';
    var alloc = '';`);
rep(`'<div class="goal-top"><div style="min-width:0"><h4>' + esc(g.title || catLabel(g.category)) + '</h4><p>' + esc(sub) + '</p></div>' + badge + '</div>' +`,
    `'<div class="goal-top"><div style="min-width:0"><h4>' + esc(goalTitle(g)) + '</h4><p>' + esc(sub) + '</p></div>' + badge + '</div>' +`);
/* Zielanteil-Hinweis einmal unter der Liste statt in jeder Karte */
rep(`</div>';
    if (paused.length)`,
    `</div>' +
      (active.length ? '<div class="pv-alloc-note">' + ic('info', 'xs') + ' ' + esc(T('pv.zielanteil_leer')) + '</div>' : '');
    if (paused.length)`);
s = s.split(`esc(g.title || catLabel(g.category))`).join(`esc(goalTitle(g))`);
s = s.replace(`return g ? (g.title || catLabel(g.category)) : id;`, `return g ? goalTitle(g) : id;`);

/* 7 Quellenlabel */
rep(`provider_sync: T('pv.src_device') }; return map[s] || (s ? String(s) : ''); }`,
    `provider_sync: T('pv.src_device'), automatic: T('pv.src_auto'), auto: T('pv.src_auto'), garmin_unofficial: 'Garmin', garmin_connect: 'Garmin' }; return map[s] || (s ? String(s) : ''); }`);

/* 8 Kraftwerte: manuell eingetragene Werte + aus dem Gym-Training abgeleitete e1RM (Epley) */
rep(`  function bestLifts(records) {
    var out = LIFTS.map(function (l) { return { label: T(l[1]), key: l[1], re: new RegExp(l[0], 'i'), value: null, reps: null, date: null }; });`,
    `  /* e1RM nach Epley aus abgeschlossenen Arbeitssaetzen (1–12 Wdh.) der Gym-Snapshots;
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
            if (w0 != null && w0 > 0 && reps <= 12) out.push({ exerciseName: name, estimatedOneRepMax: Math.round(w0 * (1 + reps / 30) * 10) / 10, date: date, derived: true });
            if (w0 == null || w0 === 0) out.push({ exerciseName: name, repetitions: reps, date: date, derived: true }); }); }); });
    } catch (e) {}
    return out;
  }
  function bestLifts(records) {
    var out = LIFTS.map(function (l) { return { label: T(l[1]), key: l[1], re: new RegExp(l[0], 'i'), value: null, reps: null, date: null, derived: false }; });
    records = (records || []).concat(liftsFromTraining());`);
rep(`        if (o.key === 'pv.lift_pullup' && num(r.repetitions) != null) { if (o.reps == null || r.repetitions > o.reps) { o.reps = r.repetitions; o.date = r.date || null; } return; }
        if (v != null && (o.value == null || v > o.value)) { o.value = v; o.date = r.date || null; } }); });`,
    `        if (o.key === 'pv.lift_pullup' && num(r.repetitions) != null) { if (o.reps == null || r.repetitions > o.reps) { o.reps = r.repetitions; o.date = r.date || null; o.derived = !!r.derived; } return; }
        if (o.key === 'pv.lift_pullup') return;
        if (v != null && (o.value == null || v > o.value)) { o.value = v; o.date = r.date || null; o.derived = !!r.derived; } }); });`);
rep(`return '<div class="datacell"><div class="dl">' + esc(l.label) + '</div><div class="dn' + (v ? '' : ' muted') + '">' + e`,
    `return '<div class="datacell"><div class="dl">' + esc(l.label) + '</div><div class="dn' + (v ? '' : ' muted') + '">' + e`);
fs.writeFileSync(f, s);
console.log('replacements', n);
