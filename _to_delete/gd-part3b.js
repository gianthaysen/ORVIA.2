    /* Was der Plan daraus macht */
    h += sect(T('gd.plan_title'));
    if (m.plan && m.plan.units.length) {
      h += '<div class="card tight"><div class="ctitle"><div class="l">' + ic('target', 'sm') + ' ' + esc(T('gd.plan_week', { n: m.plan.count })) + '</div><div class="more" id="gd-plan">' + esc(T('gd.plan_open')) + ' ' + ic('chev', 'xs') + '</div></div><div class="gd-plan">' +
        m.plan.units.map(function (u) { return '<div class="gd-psess"><div class="s-ic">' + ic(u.icon || 'bolt', 'sm') + '</div><div class="s-b"><div class="s-t">' + esc(u.title) + '</div><div class="s-d">' + esc(u.detail || '') + '</div></div><div class="s-sh muted">' + esc(T('gd.share_tbd')) + '</div></div>'; }).join('') + '</div>' +
        '<div class="pv-alloc-note" style="margin:12px 0 0">' + ic('info', 'xs') + ' ' + esc(T('pv.zielanteil_leer')) + '</div></div>';
    } else h += '<div class="card tight"><p class="muted" style="margin:0">' + esc(T('gd.plan_none')) + '</p></div>';
    /* Stellschrauben */
    if (m.levers.length) {
      h += sect(T(m.levers.length === 1 ? 'gd.levers_one' : 'gd.levers'));
      h += m.levers.map(function (l) { return '<div class="card tight"><div style="display:flex;gap:12px;align-items:flex-start"><div class="sh-hic" style="background:var(--ready-t);color:var(--ready)">' + ic('bolt', 'sm') + '</div><div style="flex:1;min-width:0"><div class="gd-lv-t">' + l.html + '</div><div class="gd-lv-d">' + esc(l.effect) + '</div></div></div></div>'; }).join('');
    }
    /* Meilensteine */
    h += sect(T('goal.detail.milestones'), { id: 'gd-ms-add', label: ic('plus', 'xs') + ' ' + esc(T('gd.ms_add')) });
    if (m.milestones.length) {
      h += '<div class="card tight"><div class="gd-msl">' + m.milestones.map(function (x) {
        var cls = x.status === 'achieved' ? ' done' : (x.status === 'in_progress' ? ' now' : '');
        return '<div class="gd-msrow' + cls + '"><div class="m-rail"><div class="m-dot">' + (x.status === 'achieved' ? ic('check', 'xs') : (x.status === 'in_progress' ? ic('target', 'xs') : '')) + '</div><div class="m-line"></div></div><div class="m-b"><div class="m-t">' + esc(x.title) + '</div><div class="m-d">' + esc(x.date ? (x.status === 'achieved' ? deDate(x.date) : T('gd.ms_planned', { d: deDate(x.date) })) : T('common.noDate')) + '</div>' + (x.value ? '<div class="m-v">' + esc(x.value) + '</div>' : '') + '</div></div>'; }).join('') + '</div></div>';
    } else h += '<div class="card tight"><p class="muted" style="margin:0">' + esc(T('gd.ms_none')) + '</p></div>';
    /* Einzahlungen */
    if (m.keyWeeks.length) {
      h += sect(T('gd.dep_title')) + '<div class="card tight"><div class="gd-dep-intro">' + T('gd.dep_intro') + '</div>' +
        m.keyWeeks.map(function (w) { var pl = w.planned != null ? Math.max(1, Math.round(w.planned)) : null, pct = pl ? Math.min(100, Math.round(w.done / pl * 100)) : (w.done ? 100 : 0), miss = pl != null && w.done < pl && !w.current; return '<div class="gd-dep' + (miss ? ' miss' : '') + '"><span class="w">' + esc(w.label) + '</span><span class="bar"><i style="width:' + pct + '%"></i></span><span class="v">' + w.done + (pl != null ? ' / ' + pl : '') + '</span></div>'; }).join('') +
        '<div class="source">' + ic('info', 'xs') + ' ' + esc(T('gd.dep_src')) + '</div></div>';
    }
    /* Historie */
    h += sect(T('gd.history')) + '<div class="card tight"><div class="gd-log">' + (m.history.length ? m.history.map(function (x) { return '<div class="gd-logrow"><span class="d">' + esc(x.date) + '</span><span class="t">' + x.html + '</span></div>'; }).join('') : '<p class="muted" style="margin:0">' + esc(T('gd.history_none')) + '</p>') + '</div><div class="source">' + ic('info', 'xs') + ' ' + esc(T('gd.history_src')) + '</div></div>';
    /* Wechselwirkungen */
    h += sect(T('gd.interactions'));
    if (m.conflicts.length) h += m.conflicts.map(function (c) { return '<div class="gd-conf" style="margin:0 18px 10px">' + ic('alert', 'sm') + '<div><div class="c-t">' + esc(c.title) + '</div><div class="c-d">' + esc(c.text) + '</div></div></div>'; }).join('');
    else h += '<div class="card tight"><p class="muted" style="margin:0">' + esc(T('gd.interactions_none')) + '</p></div>';
    /* Luecken */
    if (m.gaps.length) h += sect(T('goal.detail.gaps')) + '<div class="setting-group">' + m.gaps.map(function (g) { return '<div class="prow" id="gd-gap-' + esc(g.id) + '"><div class="p-ic">' + ic('alert', 'sm') + '</div><div class="p-b"><div class="p-t">' + esc(g.label) + '</div><div class="p-d">' + esc(g.hint || '') + '</div></div>' + ic('chev', 'sm') + '</div>'; }).join('') + '</div>';
    /* Verwalten */
    var rows = [['gear', T('goal.detail.edit'), T('gd.m_edit_sub'), 'gd-edit']];
    if (m.status === 'active') rows.push(['info', T('gd.m_pause'), T('gd.m_pause_sub'), 'gd-pause']);
    if (m.status === 'paused') rows.push(['bolt', T('gd.m_resume'), T('gd.m_resume_sub'), 'gd-resume']);
    if (m.status === 'active' && !m.isMain) rows.push(['target', T('gd.m_main'), T('gd.m_main_sub'), 'gd-main']);
    if (m.status === 'active' && m.daysTo != null && m.daysTo < 0) { rows.push(['shield', T('gd.m_achieved'), T('gd.m_achieved_sub'), 'gd-achieved']); rows.push(['x', T('gd.m_missed'), T('gd.m_missed_sub'), 'gd-missed']); }
    if (m.status === 'achieved' || m.status === 'missed' || m.status === 'abandoned') rows.push(['bolt', T('gd.m_reactivate'), T('gd.m_reactivate_sub'), 'gd-reactivate']);
    rows.push(['link', T('gd.m_visibility'), T('gd.m_visibility_sub'), 'gd-vis']);
    h += sect(T('gd.manage')) + '<div class="setting-group">' + rows.map(function (r) { return '<div class="prow" id="' + r[3] + '"><div class="p-ic">' + ic(r[0], 'sm') + '</div><div class="p-b"><div class="p-t">' + esc(r[1]) + '</div><div class="p-d">' + esc(r[2]) + '</div></div>' + (r[3] === 'gd-vis' ? '<div class="p-v">' + esc(T('gd.m_visibility_val')) + '</div>' : '') + ic('chev', 'sm') + '</div>'; }).join('') + '</div>';
    return h + '</div>';
  }
