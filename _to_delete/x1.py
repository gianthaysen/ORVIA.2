import re
p='app/js/goal-detail.js'; s=open(p,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt, (old[:60], s.count(old)); s=s.replace(old,new)
rep("""  var VERSION = 'goal-detail@1';""","""  var VERSION = 'goal-detail@2';
  /* B-13: alle nutzersichtbaren Texte ueber t() (locales/de.js). Ohne i18n-Modul bleibt der Key sichtbar. */
  function T(k, p) { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); }""")
rep("""  var PHASE_DE = { build: 'Aufbau', taper: 'Taper — Frische aufbauen', race_week: 'Rennwoche', past: 'Datum liegt zurück' };
  var FEAS_DE = { within_modeled_corridor: 'Zielwert liegt im modellierten Korridor deiner aktuellen Leistung.', outside_modeled_corridor: 'Zielwert liegt außerhalb des modellierten Korridors — ambitioniert für den Zeitraum.', insufficient_data: 'Machbarkeit noch nicht bewertbar (zu wenig Leistungsdaten).' };""",
"""  var PHASES = ['build', 'taper', 'race_week', 'past'];
  var FEAS_KEY = { within_modeled_corridor: 'goal.feas.within', outside_modeled_corridor: 'goal.feas.outside', insufficient_data: 'goal.feas.insufficient' };""")
rep("""lab(g.category) || 'Ziel', category: g.category || null,""",
    """lab(g.category) || T('common.goal'), category: g.category || null,""")
rep("""      phase: pi ? pi.phase : null, phaseLabel: pi && pi.phase ? (PHASE_DE[pi.phase] || pi.phase) : null,""",
    """      phase: pi ? pi.phase : null, phaseLabel: pi && pi.phase ? (PHASES.indexOf(pi.phase) >= 0 ? T('goal.phase.' + pi.phase) : pi.phase) : null,""")
rep("""      m.progress.note = 'Prognose aus deinen Läufen der letzten 42 Tage (Riegel), gegen die Zielzeit.';""",
    """      m.progress.note = T('goal.progress.timeNote');""")
rep("""      m.progress.note = e && e.need ? ('Noch keine belastbare Prognose — nötig: ' + e.need) : 'Noch keine belastbare Prognose.';""",
    """      m.progress.note = e && e.need ? T('goal.progress.noForecastNeed', { need: e.need }) : T('goal.progress.noForecast');""")
rep("""      m.progress.note = 'Aktueller Wert gegen Zielwert' + (lower ? ' (niedriger ist besser).' : '.');""",
    """      m.progress.note = lower ? T('goal.progress.valueNoteLower') : T('goal.progress.valueNote');""")
rep("""      m.progress.note = typeof g.targetValue === 'number' ? 'Kein aktueller Wert hinterlegt — ohne ihn kein Fortschritt.' : 'Kein Zielwert hinterlegt.';""",
    """      m.progress.note = typeof g.targetValue === 'number' ? T('goal.progress.noCurrent') : T('goal.progress.noTarget');""")
rep("""    if (f && f.evaluated === true && FEAS_DE[f.status]) { m.feasibilityText = FEAS_DE[f.status]; m.feasibilityWarn = f.status === 'outside_modeled_corridor'; }""",
    """    if (f && f.evaluated === true && FEAS_KEY[f.status]) { m.feasibilityText = T(FEAS_KEY[f.status]); m.feasibilityWarn = f.status === 'outside_modeled_corridor'; }""")
rep("""    if (!m) return '<p class="muted">Kein Ziel ausgewählt.</p>';""","""    if (!m) return '<p class="muted">' + esc(T('goal.detail.none')) + '</p>';""")
rep("""' + p.percent + ' %' + (p.state === 'ontrack' ? ' · on track' : p.state === 'border' ? ' · grenzwertig' : p.state === 'risk' ? ' · gefährdet' : '') + '</div>' : '';""",
    """' + p.percent + ' %' + (p.state ? ' · ' + esc(T('goal.state.' + p.state)) : '') + '</div>' : '';""")
rep("""(m.dateText ? ' · ' + esc(m.dateText) : ' · kein Datum') + (m.daysTo != null && m.daysTo >= 0 ? ' · in ' + m.daysTo + ' Tagen' : '') + '</div></div>' +""",
    """(m.dateText ? ' · ' + esc(m.dateText) : ' · ' + esc(T('common.noDate'))) + (m.daysTo != null && m.daysTo >= 0 ? ' · ' + esc(T('goal.detail.inDays', { n: m.daysTo })) : '') + '</div></div>' +""")
rep("""        '<div class="gd-cell"><span class="gd-k">Zielwert</span><span class="gd-v">' + esc(m.targetText || 'offen') + '</span></div>' +
        '<div class="gd-cell"><span class="gd-k">Phase</span><span class="gd-v">' + esc(m.phaseLabel || '–') + '</span></div>' +
        (p.currentText ? '<div class="gd-cell"><span class="gd-k">' + (p.kind === 'time' ? 'Prognose' : 'Aktuell') + '</span><span class="gd-v">' + esc(p.currentText) + '</span></div>' : '') +""",
"""        '<div class="gd-cell"><span class="gd-k">' + esc(T('goal.detail.target')) + '</span><span class="gd-v">' + esc(m.targetText || T('common.open')) + '</span></div>' +
        '<div class="gd-cell"><span class="gd-k">' + esc(T('goal.detail.phase')) + '</span><span class="gd-v">' + esc(m.phaseLabel || '–') + '</span></div>' +
        (p.currentText ? '<div class="gd-cell"><span class="gd-k">' + esc(T(p.kind === 'time' ? 'goal.detail.forecast' : 'goal.detail.current')) + '</span><span class="gd-v">' + esc(p.currentText) + '</span></div>' : '') +""")
rep("""      '<div class="gd-sec"><div class="gd-h">Fortschritt</div>' + bar + '<p class="gd-note">' + esc(p.note || '') + '</p></div>' +
      (m.feasibilityText ? '<div class="gd-sec"><div class="gd-h">Machbarkeit</div><p class="gd-note' + (m.feasibilityWarn ? ' gd-warn' : '') + '">' + esc(m.feasibilityText) + '</p></div>' : '') +
      (m.gaps.length ? '<div class="gd-sec"><div class="gd-h">Was fehlt</div>' + m.gaps.map(function (g) {""",
"""      '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.detail.progress')) + '</div>' + bar + '<p class="gd-note">' + esc(p.note || '') + '</p></div>' +
      (m.feasibilityText ? '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.detail.feasibility')) + '</div><p class="gd-note' + (m.feasibilityWarn ? ' gd-warn' : '') + '">' + esc(m.feasibilityText) + '</p></div>' : '') +
      (m.gaps.length ? '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.detail.gaps')) + '</div>' + m.gaps.map(function (g) {""")
rep("""      (m.milestones.length ? '<div class="gd-sec"><div class="gd-h">Meilensteine</div>' + m.milestones.map(""",
    """      (m.milestones.length ? '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.detail.milestones')) + '</div>' + m.milestones.map(""")
rep("""    root.openSheet({ id: '_goalDetail', title: 'Ziel', size: 'full', body: html(m),
      actions: '<button type="button" class="btn" id="gd-edit">Ziel bearbeiten</button>' });""",
    """    root.openSheet({ id: '_goalDetail', title: esc(T('goal.detail.title')), size: 'full', body: html(m),
      actions: '<button type="button" class="btn" id="gd-edit">' + esc(T('goal.detail.edit')) + '</button>' });""")
open(p,'w',encoding='utf-8').write(s); print('goal-detail ok')
