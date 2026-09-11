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
  var VERSION = 'goal-detail@1';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtTime(min) { if (!(min > 0)) return null; var h = Math.floor(min / 60), m = Math.round(min % 60); if (m === 60) { h++; m = 0; } return h + ':' + String(m).padStart(2, '0') + ' h'; }
  function fmtPace(sec) { if (!(sec > 0)) return null; return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0') + ' /km'; }
  function deDate(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? (m[3] + '.' + m[2] + '.' + m[1]) : null; }
  var PHASE_DE = { build: 'Aufbau', taper: 'Taper — Frische aufbauen', race_week: 'Rennwoche', past: 'Datum liegt zurück' };
  var FEAS_DE = { within_modeled_corridor: 'Zielwert liegt im modellierten Korridor deiner aktuellen Leistung.', outside_modeled_corridor: 'Zielwert liegt außerhalb des modellierten Korridors — ambitioniert für den Zeitraum.', insufficient_data: 'Machbarkeit noch nicht bewertbar (zu wenig Leistungsdaten).' };

  /* buildModel({ goal, planInput, engine, feasibility, strength, catLabel }) */
  function buildModel(o) {
    o = o || {};
    var g = o.goal || null; if (!g || typeof g !== 'object') return null;
    var pi = o.planInput || null, t = (pi && pi.target) || {};
    var lab = typeof o.catLabel === 'function' ? o.catLabel : function (c) { return c; };
    var m = { version: VERSION, id: g.id || null, title: (g.title || '').trim() || lab(g.category) || 'Ziel', category: g.category || null,
      categoryLabel: lab(g.category) || null, family: pi ? pi.family : null,
      targetText: null, dateText: deDate(g.targetDate), daysTo: pi ? pi.daysTo : null,
      phase: pi ? pi.phase : null, phaseLabel: pi && pi.phase ? (PHASE_DE[pi.phase] || pi.phase) : null,
      progress: { kind: null, currentText: null, targetText: null, percent: null, note: null, state: null },
      feasibilityText: null, feasibilityWarn: false, gaps: [], milestones: Array.isArray(g.milestones) ? g.milestones : [] };

    if (t.targetMin != null) m.targetText = fmtTime(t.targetMin) + (t.pacePerKmSec ? ' · ' + fmtPace(t.pacePerKmSec) : '');
    else if (typeof g.targetValue === 'number') m.targetText = g.targetValue + (g.unit ? ' ' + g.unit : '');

    var e = o.engine || null;
    if (t.targetMin != null && e && e.tPred > 0 && e.state !== 'nodata') {
      m.progress.kind = 'time'; m.progress.currentText = fmtTime(e.tPred); m.progress.targetText = fmtTime(t.targetMin);
      m.progress.percent = Math.max(0, Math.min(100, Math.round((t.targetMin / e.tPred) * 100)));
      m.progress.state = (e.state === 'ontrack' || e.state === 'border' || e.state === 'risk') ? e.state : null;
      m.progress.note = 'Prognose aus deinen Läufen der letzten 42 Tage (Riegel), gegen die Zielzeit.';
    } else if (t.targetMin != null) {
      m.progress.kind = 'time'; m.progress.targetText = fmtTime(t.targetMin);
      m.progress.note = e && e.need ? ('Noch keine belastbare Prognose — nötig: ' + e.need) : 'Noch keine belastbare Prognose.';
    } else if (typeof g.targetValue === 'number' && typeof g.currentValue === 'number') {
      m.progress.kind = 'value'; m.progress.currentText = g.currentValue + (g.unit ? ' ' + g.unit : ''); m.progress.targetText = g.targetValue + (g.unit ? ' ' + g.unit : '');
      var lower = /loss|fat|bodyfat|shredded/.test(String(g.category || ''));
      var pct = lower ? (g.currentValue <= g.targetValue ? 100 : Math.round((g.targetValue / g.currentValue) * 100)) : (g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : null);
      m.progress.percent = pct == null ? null : Math.max(0, Math.min(100, pct));
      m.progress.note = 'Aktueller Wert gegen Zielwert' + (lower ? ' (niedriger ist besser).' : '.');
    } else {
      m.progress.note = typeof g.targetValue === 'number' ? 'Kein aktueller Wert hinterlegt — ohne ihn kein Fortschritt.' : 'Kein Zielwert hinterlegt.';
    }

    var f = o.feasibility || null;
    if (f && f.evaluated === true && FEAS_DE[f.status]) { m.feasibilityText = FEAS_DE[f.status]; m.feasibilityWarn = f.status === 'outside_modeled_corridor'; }

    var s = o.strength || null;
    if (s && Array.isArray(s.gaps)) m.gaps = s.gaps.filter(function (x) { return x && (x.action === 'goal_editor' || x.id === 'performance_reference' || x.id === 'goal_missing'); });
    return m;
  }

  function html(m) {
    if (!m) return '<p class="muted">Kein Ziel ausgewählt.</p>';
    var p = m.progress;
    var bar = p.percent != null ? '<div class="gd-bar"><div class="gd-bar-fill' + (p.state ? ' gd-' + esc(p.state) : '') + '" style="width:' + p.percent + '%"></div></div><div class="gd-bar-lab">' + p.percent + ' %' + (p.state === 'ontrack' ? ' · on track' : p.state === 'border' ? ' · grenzwertig' : p.state === 'risk' ? ' · gefährdet' : '') + '</div>' : '';
    return '<div class="gd">' +
      '<div class="gd-head"><div class="gd-title">' + esc(m.title) + '</div><div class="gd-cat">' + esc(m.categoryLabel || '') + (m.dateText ? ' · ' + esc(m.dateText) : ' · kein Datum') + (m.daysTo != null && m.daysTo >= 0 ? ' · in ' + m.daysTo + ' Tagen' : '') + '</div></div>' +
      '<div class="gd-grid">' +
        '<div class="gd-cell"><span class="gd-k">Zielwert</span><span class="gd-v">' + esc(m.targetText || 'offen') + '</span></div>' +
        '<div class="gd-cell"><span class="gd-k">Phase</span><span class="gd-v">' + esc(m.phaseLabel || '–') + '</span></div>' +
        (p.currentText ? '<div class="gd-cell"><span class="gd-k">' + (p.kind === 'time' ? 'Prognose' : 'Aktuell') + '</span><span class="gd-v">' + esc(p.currentText) + '</span></div>' : '') +
      '</div>' +
      '<div class="gd-sec"><div class="gd-h">Fortschritt</div>' + bar + '<p class="gd-note">' + esc(p.note || '') + '</p></div>' +
      (m.feasibilityText ? '<div class="gd-sec"><div class="gd-h">Machbarkeit</div><p class="gd-note' + (m.feasibilityWarn ? ' gd-warn' : '') + '">' + esc(m.feasibilityText) + '</p></div>' : '') +
      (m.gaps.length ? '<div class="gd-sec"><div class="gd-h">Was fehlt</div>' + m.gaps.map(function (g) {
        return '<button type="button" class="pc-gap" id="gd-gap-' + esc(g.id) + '"><span class="pc-gap-t">' + esc(g.label) + '</span><span class="pc-gap-h">' + esc(g.hint || '') + '</span></button>';
      }).join('') + '</div>' : '') +
      (m.milestones.length ? '<div class="gd-sec"><div class="gd-h">Meilensteine</div>' + m.milestones.map(function (ms) { return '<div class="gd-ms">' + esc(ms.title || ms.label || '') + (ms.targetDate ? ' <span class="muted">' + esc(deDate(ms.targetDate) || '') + '</span>' : '') + '</div>'; }).join('') + '</div>' : '') +
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
    root.openSheet({ id: '_goalDetail', title: 'Ziel', size: 'full', body: html(m),
      actions: '<button type="button" class="btn" id="gd-edit">Ziel bearbeiten</button>' });
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
