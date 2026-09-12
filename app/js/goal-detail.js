/* ============================================================
   ORVIA · goal-detail — B-02 Ziel-Detailseite

   WOFÜR. Band 1, B-02: „Ziel anzeigen/bearbeiten, Fortschritt gegen Zielwert,
   Feasibility-Hinweis." Bisher gab es das Ziel als Kopfzeile im Plan
   (renderRaceHeader), als Zielkarte mit Goal-Engine-Ampel, als Wizard zum
   Bearbeiten (openGoalEditor) — aber keine Seite, die Ziel, Stand, Phase,
   Machbarkeit und Luecken ZUSAMMEN zeigt und jede Luecke auf ihren Schritt
   fuehrt.

   AUFBAU. buildModel() ist rein (alles injiziert) und liefert nur Fakten mit
   Herkunft; html() rendert; open() sammelt die Quellen aus der App ein
   (listGoals/mainGoalOf, goalPlanInput, buildGoal, _lastFeasibility,
   profileCenter.buildStrength) und oeffnet das bestehende openSheet — kein
   zweites Overlay-System. Bearbeiten laeuft ausschliesslich ueber
   openGoalEditor(id): kein zweiter Schreibpfad.

   FORTSCHRITT IST KEINE ERFINDUNG. Prozent gibt es nur, wenn zwei Zahlen
   derselben Dimension vorliegen: bei Zeitzielen Prognose (Goal Engine) gegen
   Zielzeit, bei Wertzielen aktueller Wert gegen Zielwert. Sonst steht da,
   was fehlt — mit Link.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'goal-detail@2';
  /* B-13: alle nutzersichtbaren Texte ueber t() (locales/de.js). Ohne i18n-Modul bleibt der Key sichtbar. */
  function T(k, p) { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtTime(min) { if (!(min > 0)) return null; var h = Math.floor(min / 60), m = Math.round(min % 60); if (m === 60) { h++; m = 0; } return h + ':' + String(m).padStart(2, '0') + ' h'; }
  function fmtPace(sec) { if (!(sec > 0)) return null; return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0') + ' /km'; }
  /* S1/E5: Zielwert ueber profile-model.formatGoalValue (h:mm:ss statt Sekunden); Rueckfall Wert + Einheit. */
  function fmtGoalValue(g, v) { try { var M = root.ORVIA && root.ORVIA.profileModel; if (M && typeof M.formatGoalValue === 'function') return M.formatGoalValue(g, v); } catch (e) {} return (v == null ? '' : String(v)) + (g && g.unit ? ' ' + g.unit : ''); }
  function deDate(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? (m[3] + '.' + m[2] + '.' + m[1]) : null; }
  var PHASES = ['build', 'taper', 'race_week', 'past'];
  var FEAS_KEY = { within_modeled_corridor: 'goal.feas.within', outside_modeled_corridor: 'goal.feas.outside', insufficient_data: 'goal.feas.insufficient' };

  /* buildModel({ goal, planInput, engine, feasibility, strength, catLabel }) */
  function buildModel(o) {
    o = o || {};
    var g = o.goal || null; if (!g || typeof g !== 'object') return null;
    var pi = o.planInput || null, t = (pi && pi.target) || {};
    var lab = typeof o.catLabel === 'function' ? o.catLabel : function (c) { return c; };
    var m = { version: VERSION, id: g.id || null, title: (g.title || '').trim() || lab(g.category) || T('common.goal'), category: g.category || null,
      categoryLabel: lab(g.category) || null, family: pi ? pi.family : null,
      targetText: null, dateText: deDate(g.targetDate), daysTo: pi ? pi.daysTo : null,
      phase: pi ? pi.phase : null, phaseLabel: pi && pi.phase ? (PHASES.indexOf(pi.phase) >= 0 ? T('goal.phase.' + pi.phase) : pi.phase) : null,
      progress: { kind: null, currentText: null, targetText: null, percent: null, note: null, state: null },
      feasibilityText: null, feasibilityWarn: false, gaps: [], milestones: Array.isArray(g.milestones) ? g.milestones : [] };

    if (t.targetMin != null) m.targetText = fmtTime(t.targetMin) + (t.pacePerKmSec ? ' · ' + fmtPace(t.pacePerKmSec) : '');
    else if (typeof g.targetValue === 'number') m.targetText = fmtGoalValue(g, g.targetValue);

    var e = o.engine || null;
    if (t.targetMin != null && e && e.tPred > 0 && e.state !== 'nodata') {
      m.progress.kind = 'time'; m.progress.currentText = fmtTime(e.tPred); m.progress.targetText = fmtTime(t.targetMin);
      m.progress.percent = Math.max(0, Math.min(100, Math.round((t.targetMin / e.tPred) * 100)));
      m.progress.state = (e.state === 'ontrack' || e.state === 'border' || e.state === 'risk') ? e.state : null;
      m.progress.note = T('goal.progress.timeNote');
    } else if (t.targetMin != null) {
      m.progress.kind = 'time'; m.progress.targetText = fmtTime(t.targetMin);
      m.progress.note = e && e.need ? T('goal.progress.noForecastNeed', { need: e.need }) : T('goal.progress.noForecast');
    } else if (typeof g.targetValue === 'number' && typeof g.currentValue === 'number') {
      m.progress.kind = 'value'; m.progress.currentText = fmtGoalValue(g, g.currentValue); m.progress.targetText = fmtGoalValue(g, g.targetValue);
      var lower = /loss|fat|bodyfat|shredded/.test(String(g.category || ''));
      var pct = lower ? (g.currentValue <= g.targetValue ? 100 : Math.round((g.targetValue / g.currentValue) * 100)) : (g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : null);
      m.progress.percent = pct == null ? null : Math.max(0, Math.min(100, pct));
      m.progress.note = lower ? T('goal.progress.valueNoteLower') : T('goal.progress.valueNote');
    } else {
      m.progress.note = typeof g.targetValue === 'number' ? T('goal.progress.noCurrent') : T('goal.progress.noTarget');
    }

    var f = o.feasibility || null;
    if (f && f.evaluated === true && FEAS_KEY[f.status]) { m.feasibilityText = T(FEAS_KEY[f.status]); m.feasibilityWarn = f.status === 'outside_modeled_corridor'; }

    var s = o.strength || null;
    if (s && Array.isArray(s.gaps)) m.gaps = s.gaps.filter(function (x) { return x && (x.action === 'goal_editor' || x.id === 'performance_reference' || x.id === 'goal_missing'); });
    return m;
  }

  function html(m) {
    if (!m) return '<p class="muted">' + esc(T('goal.detail.none')) + '</p>';
    var p = m.progress;
    var bar = p.percent != null ? '<div class="gd-bar"><div class="gd-bar-fill' + (p.state ? ' gd-' + esc(p.state) : '') + '" style="width:' + p.percent + '%"></div></div><div class="gd-bar-lab">' + p.percent + ' %' + (p.state ? ' · ' + esc(T('goal.state.' + p.state)) : '') + '</div>' : '';
    return '<div class="gd">' +
      '<div class="gd-head"><div class="gd-title">' + esc(m.title) + '</div><div class="gd-cat">' + esc(m.categoryLabel || '') + (m.dateText ? ' · ' + esc(m.dateText) : ' · ' + esc(T('common.noDate'))) + (m.daysTo != null && m.daysTo >= 0 ? ' · ' + esc(T('goal.detail.inDays', { n: m.daysTo })) : '') + '</div></div>' +
      '<div class="gd-grid">' +
        '<div class="gd-cell"><span class="gd-k">' + esc(T('goal.detail.target')) + '</span><span class="gd-v">' + esc(m.targetText || T('common.open')) + '</span></div>' +
        '<div class="gd-cell"><span class="gd-k">' + esc(T('goal.detail.phase')) + '</span><span class="gd-v">' + esc(m.phaseLabel || '–') + '</span></div>' +
        (p.currentText ? '<div class="gd-cell"><span class="gd-k">' + esc(T(p.kind === 'time' ? 'goal.detail.forecast' : 'goal.detail.current')) + '</span><span class="gd-v">' + esc(p.currentText) + '</span></div>' : '') +
      '</div>' +
      '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.detail.progress')) + '</div>' + bar + '<p class="gd-note">' + esc(p.note || '') + '</p></div>' +
      (m.feasibilityText ? '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.detail.feasibility')) + '</div><p class="gd-note' + (m.feasibilityWarn ? ' gd-warn' : '') + '">' + esc(m.feasibilityText) + '</p></div>' : '') +
      (m.gaps.length ? '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.detail.gaps')) + '</div>' + m.gaps.map(function (g) {
        return '<button type="button" class="pc-gap" id="gd-gap-' + esc(g.id) + '"><span class="pc-gap-t">' + esc(g.label) + '</span><span class="pc-gap-h">' + esc(g.hint || '') + '</span></button>';
      }).join('') + '</div>' : '') +
      (m.milestones.length ? '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.detail.milestones')) + '</div>' + m.milestones.map(function (ms) { return '<div class="gd-ms">' + esc(ms.title || ms.label || '') + (ms.targetDate ? ' <span class="muted">' + esc(deDate(ms.targetDate) || '') + '</span>' : '') + '</div>'; }).join('') + '</div>' : '') +
    '</div>';
  }

  function open(id) {
    var goal = null;
    try {
      var gs = (typeof root.listGoals === 'function') ? root.listGoals() : [];
      goal = id ? gs.filter(function (x) { return x && x.id === id; })[0] : ((typeof root.mainGoalOf === 'function') ? root.mainGoalOf() : null);
    } catch (e) { goal = null; }
    if (!goal) { try { if (typeof root.openGoalEditor === 'function') root.openGoalEditor(); } catch (e) {} return false; }
    var isMain = false; try { var mg = root.mainGoalOf ? root.mainGoalOf() : null; isMain = !!(mg && mg.id === goal.id); } catch (e) {}
    var pi = null, eng = null, feas = null, str = null;
    try { if (O.goalPlanInput) pi = O.goalPlanInput.resolve({ goal: goal, today: root.todayStr ? root.todayStr() : null, canon: (O.profileModel && O.profileModel.canonGoalCategory) || null, taper: O.goalTaperResolver || null }); } catch (e) {}
    try { if (isMain && typeof root.buildGoal === 'function') eng = root.buildGoal(); } catch (e) {}
    try { if (isMain) feas = O._lastFeasibility || null; } catch (e) {}
    try { if (isMain && O.profileCenter && O.profileCenter.buildStrength) str = O.profileCenter.buildStrength(root.PROFILE || null, new Date()); } catch (e) {}
    var m = buildModel({ goal: goal, planInput: pi, engine: eng, feasibility: feas, strength: str, catLabel: root.goalCatLabel || null });
    if (typeof root.openSheet !== 'function') return false;
    root.openSheet({ id: '_goalDetail', title: esc(T('goal.detail.title')), size: 'full', body: html(m),
      actions: '<button type="button" class="btn" id="gd-edit">' + esc(T('goal.detail.edit')) + '</button>' });
    try {
      var close = function () { try { if (typeof root._closeM === 'function') root._closeM('_goalDetail'); } catch (e) {} };
      var eb = document.getElementById('gd-edit'); if (eb) eb.onclick = function () { close(); try { root.openGoalEditor(goal.id); } catch (e) {} };
      (m.gaps || []).forEach(function (g) {
        var el = document.getElementById('gd-gap-' + g.id); if (!el) return;
        el.onclick = function () {
          close();
          if (g.action === 'goal_editor') { try { root.openGoalEditor(g.goalId || goal.id); } catch (e) {} return; }
          try { if (g.sectionId && typeof root.openProfileSection === 'function') root.openProfileSection(g.sectionId); } catch (e) {}
        };
      });
    } catch (e) {}
    return true;
  }

  var api = { VERSION: VERSION, buildModel: buildModel, html: html, open: open };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.goalDetail = api;
  root.openGoalDetail = open;
})(typeof globalThis !== 'undefined' ? globalThis : this);
