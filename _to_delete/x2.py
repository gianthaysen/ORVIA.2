p='app/js/workout-gym.js'; s=open(p,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt, (old[:70], s.count(old)); s=s.replace(old,new)
rep("""  const AD = () => O.gymAdapters || null;""",
"""  const AD = () => O.gymAdapters || null;
  /* B-13: nutzersichtbare Texte ueber t() (locales/de.js); ohne i18n bleibt der Key sichtbar. */
  const T = (k, p) => { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); };""")
rep("""    if (O.exerciseAlternatives && AD()) h += '<button class="wo-link" onclick="ORVIA.workoutGym.alternatives(' + idx + ')">Alternative</button>';
    if (O.supersetModel && AD() && WS() && WS().setSupersetGroup) h += '<button class="wo-link" onclick="ORVIA.workoutGym.superset(' + idx + ')">' + (grouped ? 'Superset ' + esc(labelOf(idx) || '') : 'Superset') + '</button>';""",
"""    if (O.exerciseAlternatives && AD()) h += '<button class="wo-link" onclick="ORVIA.workoutGym.alternatives(' + idx + ')">' + esc(T('gym.alt.button')) + '</button>';
    if (O.supersetModel && AD() && WS() && WS().setSupersetGroup) h += '<button class="wo-link" onclick="ORVIA.workoutGym.superset(' + idx + ')">' + esc(grouped ? T('gym.ss.buttonLabel', { label: labelOf(idx) || '' }) : T('gym.ss.button')) + '</button>';""")
rep("""    if (!others.length) { toastIt('Für ein Superset braucht es eine zweite Übung.'); return; }
    const name = e => (e.exercise && e.exercise.name) || ('Übung ' + (exs.indexOf(e) + 1));""",
"""    if (!others.length) { toastIt(T('gym.ss.needTwo')); return; }
    const name = e => (e.exercise && e.exercise.name) || T('common.exerciseN', { n: exs.indexOf(e) + 1 });""")
rep("""+ esc(name(x.e)) + (l ? ' <span class="muted">· Superset ' + esc(l) + '</span>' : '') + (same ? ' ✓' : '') + '</button>';""",
    """+ esc(name(x.e)) + (l ? ' <span class="muted">' + esc(T('gym.ss.inGroup', { label: l })) + '</span>' : '') + (same ? ' ✓' : '') + '</button>';""")
rep("""    sheet('<h3 class="wo-sheet-t">Superset</h3><p class="wo-sheet-p">' + esc(name(cur)) + ' abwechselnd ausführen mit …</p>' + partnerBtns +
      (we.superset_group != null ? '<button class="wo-sheet-btn danger" onclick="ORVIA.workoutGym._ungroup(' + idx + ')">Aus dem Superset lösen</button>' : '') +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Zurück</button>');""",
"""    sheet('<h3 class="wo-sheet-t">' + esc(T('gym.ss.title')) + '</h3><p class="wo-sheet-p">' + esc(T('gym.ss.with', { name: name(cur) })) + '</p>' + partnerBtns +
      (we.superset_group != null ? '<button class="wo-sheet-btn danger" onclick="ORVIA.workoutGym._ungroup(' + idx + ')">' + esc(T('gym.ss.ungroup')) + '</button>' : '') +
      backBtn());""")
rep("""    if (r1.sync_status === 'pending' || r2.sync_status === 'pending') toastIt('Superset offline gespeichert ⏳');""",
    """    if (r1.sync_status === 'pending' || r2.sync_status === 'pending') toastIt(T('gym.ss.offline'));""")
rep("""    if (/superset_group/.test(m) && /column|schema/i.test(m)) return 'Superset noch nicht freigeschaltet (Migration 0038 fehlt auf dem Server).';
    return (typeof UI()._humanErr === 'function') ? UI()._humanErr(err) : (m || 'Speichern fehlgeschlagen.');
  }""",
"""    if (/superset_group/.test(m) && /column|schema/i.test(m)) return T('gym.ss.notMigrated');
    return (typeof UI()._humanErr === 'function') ? UI()._humanErr(err) : (m || T('gym.err.save'));
  }
  const backBtn = () => '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">' + esc(T('common.back')) + '</button>';""")
rep("""    sheet('<h3 class="wo-sheet-t">Alternative</h3><p class="wo-sheet-p">Wird gesucht…</p>');""",
    """    sheet('<h3 class="wo-sheet-t">' + esc(T('gym.alt.title')) + '</h3><p class="wo-sheet-p">' + esc(T('gym.alt.searching')) + '</p>');""")
rep("""    const curName = (cur.exercise && cur.exercise.name) || (byId[exId] && byId[exId].name) || 'Übung';
    let body;
    if (res.reason === 'exercise_unknown') body = '<p class="wo-sheet-p">Für „' + esc(curName) + '" ist keine Muskelzuordnung hinterlegt — ohne sie gibt es keine belastbare Alternative.</p>';
    else if (!res.alternatives.length) body = '<p class="wo-sheet-p">Keine Übung im Katalog deckt dieselbe Muskulatur ab.</p>';
    else body = res.alternatives.map(a => {
      const e = byId[a.id] || {}; const pct = Math.round((a.coverage || 0) * 100);
      const why = a.reason === 'curated' ? 'kuratiert' : (a.reason === 'muscle_overlap' ? pct + ' % gleiche Muskulatur' : 'gleiches Bewegungsmuster');""",
"""    const curName = (cur.exercise && cur.exercise.name) || (byId[exId] && byId[exId].name) || T('common.exercise');
    let body;
    if (res.reason === 'exercise_unknown') body = '<p class="wo-sheet-p">' + esc(T('gym.alt.noMapping', { name: curName })) + '</p>';
    else if (!res.alternatives.length) body = '<p class="wo-sheet-p">' + esc(T('gym.alt.none')) + '</p>';
    else body = res.alternatives.map(a => {
      const e = byId[a.id] || {}; const pct = Math.round((a.coverage || 0) * 100);
      const why = a.reason === 'curated' ? T('gym.alt.curated') : (a.reason === 'muscle_overlap' ? T('gym.alt.overlap', { pct: pct }) : T('gym.alt.samePattern'));""")
rep("""    sheet('<h3 class="wo-sheet-t">Alternative zu ' + esc(curName) + '</h3>' + body +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Zurück</button>');""",
"""    sheet('<h3 class="wo-sheet-t">' + esc(T('gym.alt.titleTo', { name: curName })) + '</h3>' + body + backBtn());""")
rep("""    toastIt(hasSets ? 'Alternative als neue Übung angelegt (Sätze bleiben).' : 'Übung ersetzt.');""",
    """    toastIt(hasSets ? T('gym.alt.replacedNew') : T('gym.alt.replaced'));""")
rep("""    return '<button type="button" class="wo-mini wo-plates" onclick="ORVIA.workoutGym.plates()" title="Scheiben je Seite">⚖ Scheiben</button>';""",
    """    return '<button type="button" class="wo-mini wo-plates" onclick="ORVIA.workoutGym.plates()" title="' + esc(T('gym.plates.buttonTitle')) + '">' + esc(T('gym.plates.button')) + '</button>';""")
rep("""    if (t == null || isNaN(t)) { toastIt('Erst ein Gewicht eintragen.'); return; }""",
    """    if (t == null || isNaN(t)) { toastIt(T('gym.plates.needWeight')); return; }""")
rep("""      body = r.reason === 'below_bar' ? '<p class="wo-sheet-p">' + fmtU(t, u) + ' liegt unter dem Stangengewicht (' + fmtU(r.bar, u) + ').</p>' : '<p class="wo-sheet-p">Keine Berechnung möglich.</p>';""",
    """      body = '<p class="wo-sheet-p">' + esc(r.reason === 'below_bar' ? T('gym.plates.belowBar', { target: fmtU(t, u), bar: fmtU(r.bar, u) }) : T('gym.plates.impossible')) + '</p>';""")
rep("""      const rows = r.perSide.length ? r.perSide.map(p => '<div class="wo-plate-row"><b>' + p.count + ' ×</b> ' + fmtU(p.plate, u) + '</div>').join('') : '<div class="wo-plate-row">nur Stange</div>';
      const diff = r.exact ? '<span class="muted">exakt</span>' : '<span class="muted">ladbar: ' + fmtU(r.achieved, u) + ' (' + (r.delta < 0 ? '−' : '+') + fmtU(Math.abs(r.delta), u) + ')</span>';
      body = '<div class="wo-plate-big">' + fmtU(t, u) + ' ' + diff + '</div><div class="wo-plate-sub">je Seite · Stange ' + fmtU(r.bar, u) + '</div>' + rows;""",
"""      const rows = r.perSide.length ? r.perSide.map(p => '<div class="wo-plate-row"><b>' + p.count + ' ×</b> ' + fmtU(p.plate, u) + '</div>').join('') : '<div class="wo-plate-row">' + esc(T('gym.plates.barOnly')) + '</div>';
      const diff = '<span class="muted">' + esc(r.exact ? T('gym.plates.exact') : T('gym.plates.loadable', { achieved: fmtU(r.achieved, u), delta: (r.delta < 0 ? '−' : '+') + fmtU(Math.abs(r.delta), u) })) + '</span>';
      body = '<div class="wo-plate-big">' + fmtU(t, u) + ' ' + diff + '</div><div class="wo-plate-sub">' + esc(T('gym.plates.perSide', { bar: fmtU(r.bar, u) })) + '</div>' + rows;""")
rep("""    sheet('<h3 class="wo-sheet-t">Scheiben</h3>' + body +""","""    sheet('<h3 class="wo-sheet-t">' + esc(T('gym.plates.title')) + '</h3>' + body +""")
rep("""      (r.feasible && !r.exact && u === 'kg' ? '<button class="wo-sheet-btn primary" onclick="ORVIA.workoutGym._takeWeight(' + r.achieved + ')">' + fmtU(r.achieved, u) + ' übernehmen</button>' : '') +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Zurück</button>');""",
"""      (r.feasible && !r.exact && u === 'kg' ? '<button class="wo-sheet-btn primary" onclick="ORVIA.workoutGym._takeWeight(' + r.achieved + ')">' + esc(T('common.take', { value: fmtU(r.achieved, u) })) + '</button>' : '') +
      backBtn());""")
rep("""  const ACTION_DE = { increase: 'steigern', hold: 'halten', reduce: 'reduzieren', deload: 'Deload', none: '–' };
  const REASON_DE = { range_topped: 'Obergrenze erreicht', effort_capped: 'RIR 0 — erst Reserve aufbauen', rir_unknown: 'RIR fehlt', within_range: '+1 Wdh', below_range: 'unter dem Zielbereich', stagnation: 'stagniert', no_data: 'keine Daten', range_invalid: '' };""",
"""  const ACTIONS = ['increase', 'hold', 'reduce', 'deload'];
  const REASONS = ['range_topped', 'effort_capped', 'rir_unknown', 'within_range', 'below_range', 'stagnation', 'no_data'];
  const actionDe = a => ACTIONS.indexOf(a) >= 0 ? T('gym.prog.' + a) : '–';
  const reasonDe = r => REASONS.indexOf(r) >= 0 ? T('gym.prog.' + r) : '';""")
rep("""      if (p.action === 'none' || p.weight == null) return '<div class="wo-sg-row muted">Satz ' + p.setNumber + ': ' + esc(REASON_DE[p.reason] || '') + '</div>';""",
    """      if (p.action === 'none' || p.weight == null) return '<div class="wo-sg-row muted">' + esc(T('common.setN', { n: p.setNumber })) + ': ' + esc(reasonDe(p.reason)) + '</div>';""")
rep("""        '<span class="wo-sg-n">Satz ' + p.setNumber + '</span><span class="wo-sg-v">' + fmtKg(p.weight) + ' × ' + p.reps + '</span>' +
        '<span class="wo-sg-a">' + esc(ACTION_DE[p.action] || p.action) + (REASON_DE[p.reason] ? ' · ' + esc(REASON_DE[p.reason]) : '') + '</span></button>';""",
"""        '<span class="wo-sg-n">' + esc(T('common.setN', { n: p.setNumber })) + '</span><span class="wo-sg-v">' + fmtKg(p.weight) + ' × ' + p.reps + '</span>' +
        '<span class="wo-sg-a">' + esc(actionDe(p.action)) + (reasonDe(p.reason) ? ' · ' + esc(reasonDe(p.reason)) : '') + '</span></button>';""")
rep("""    el.innerHTML = '<div class="wo-sg-h">Vorschlag <span class="muted">· doppelte Progression, Ziel ' + range.min + '–' + range.max + ' Wdh · antippen übernimmt</span></div>' + rows;""",
    """    el.innerHTML = '<div class="wo-sg-h">' + esc(T('gym.prog.header')) + ' <span class="muted">' + esc(T('gym.prog.headerSub', { min: range.min, max: range.max })) + '</span></div>' + rows;""")
open(p,'w',encoding='utf-8').write(s); print('workout-gym ok')
