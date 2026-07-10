/* ============================================================
   ORVIA · quick-actions — Track B: zentraler Plus-Schnellzugriff.
   Verträge (B2/B3/B4):
   - QuickAction { id, label, description, icon, category('primary'|'secondary'),
     entryPoint (Name einer GLOBALEN Funktion oder 'orvia:'-Pfad), requiresProfile,
     requiresOnline, resultEvent } — KEINE Aktion ist hier implementiert;
     der Plus-Button DELEGIERT ausschließlich an bestehende Entry-Points.
   - Kontext-Ranking (pur, testbar): morgens Morgen-Check-in zuerst, abends
     Abend-Check-in, laufendes Training → „Training fortsetzen", unvollständiges
     Profil → Profil-Hinweis, aktive Beschwerde → Beschwerden-Update priorisiert.
   - UI über das bestehende openSheet (kein drittes Overlay-System), Touch ≥44 px,
     Fokus/Escape/Backdrop übernimmt die Sheet-Infrastruktur.
   - Fail-soft: Aktionen ohne auflösbaren Entry-Point werden NICHT angezeigt
     (kein toter Button), fehlende Online-Verbindung deaktiviert ehrlich.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  function D() { return (typeof document !== 'undefined') ? document : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- B2 · Registry (delegiert NUR, implementiert nichts) ---------- */
  var ACTIONS = [
    { id: 'training_start', label: 'Training starten', description: 'Live-Einheit beginnen', icon: '#i-run', category: 'primary',
      entryPoint: 'orvia:workoutUI.openTrainingTab', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:activity-updated' },
    { id: 'checkin_morning', label: 'Morgen-Check-in', description: 'Tagesform erfassen', icon: '#i-sun', category: 'primary',
      entryPoint: 'orvia:quickActions.gotoMorningCheckin', requiresProfile: false, requiresOnline: false, resultEvent: null },
    { id: 'checkin_evening', label: 'Abend-Check-in', description: 'Tag abschließen', icon: '#i-moon', category: 'primary',
      entryPoint: 'orvia:quickActions.gotoEveningCheckin', requiresProfile: false, requiresOnline: false, resultEvent: null },
    { id: 'activity_log', label: 'Aktivität nachtragen', description: 'Einheit manuell erfassen', icon: '#i-plus', category: 'primary',
      entryPoint: 'openManualActivity', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:activity-updated' },
    { id: 'weight_update', label: 'Gewicht aktualisieren', description: 'Neue Messung eintragen', icon: '#i-scale', category: 'secondary',
      entryPoint: 'openPerformanceManager', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:profile-updated' },
    { id: 'complaint_log', label: 'Beschwerde erfassen', description: 'Schmerz oder Einschränkung melden', icon: '#i-pulse', category: 'secondary',
      entryPoint: 'openModulePicker', requiresProfile: false, requiresOnline: false, resultEvent: null },
    { id: 'goal_add', label: 'Ziel hinzufügen', description: 'Neues Trainingsziel anlegen', icon: '#i-target', category: 'secondary',
      entryPoint: 'openGoalsManager', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:profile-updated' },
    { id: 'measurement_log', label: 'Messwert erfassen', description: 'HFmax, Ruhepuls & Co.', icon: '#i-heart', category: 'secondary',
      entryPoint: 'openPerformanceManager', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:profile-updated' },
    { id: 'appointment_add', label: 'Termin hinzufügen', description: 'Fester Termin für die Planung', icon: '#i-calendar', category: 'secondary',
      entryPoint: 'openFixedEventEditor', requiresProfile: false, requiresOnline: false, resultEvent: null },
    // Kontextaktionen (erscheinen nur über das Ranking):
    { id: 'training_continue', label: 'Training fortsetzen', description: 'Laufende Einheit öffnen', icon: '#i-run', category: 'context',
      entryPoint: 'orvia:workoutUI.openTrainingTab', requiresProfile: false, requiresOnline: false, resultEvent: null },
    { id: 'profile_complete', label: 'Profil vervollständigen', description: 'Wenige Angaben fehlen noch', icon: '#i-user', category: 'context',
      entryPoint: 'openProfileCenterEntry', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:profile-updated' },
    { id: 'complaint_update', label: 'Beschwerden aktualisieren', description: 'Wie geht es der betroffenen Stelle?', icon: '#i-pulse', category: 'context',
      entryPoint: 'openModulePicker', requiresProfile: false, requiresOnline: false, resultEvent: null }
  ];

  /* Entry-Point-Auflösung: 'orvia:pfad.fn' auf dem ORVIA-Objekt, sonst globale Funktion. */
  function resolveEntryPoint(spec) {
    try {
      if (typeof spec !== 'string' || !spec) return null;
      if (spec.indexOf('orvia:') === 0) {
        var path = spec.slice(6).split('.');
        var cur = O;
        for (var i = 0; i < path.length; i++) { if (cur == null) return null; cur = cur[path[i]]; }
        return typeof cur === 'function' ? cur : null;
      }
      return typeof root[spec] === 'function' ? root[spec] : null;
    } catch (e) { return null; }
  }

  /* Interne Navigations-Entry-Points (Check-ins sind Seitenabschnitte, keine Flows). */
  function _gotoCheckin(formId) {
    try { if (typeof root.showTab === 'function') root.showTab('heute'); } catch (e) {}
    try {
      var doc = D(); var f = doc && doc.getElementById(formId);
      if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}
  }

  /* ---------- B3 · Kontext (pur) + Ranking (pur) ---------- */
  function buildContext(nowDate) {
    var d = nowDate instanceof Date ? nowDate : new Date();
    var ctx = { hour: d.getHours(), morningDone: false, eveningDone: false, activeWorkout: false, profileIncomplete: false, activeConstraint: false, online: true };
    try {
      if (typeof root.DB !== 'undefined' && typeof root.todayStr === 'function') {
        var e = root.DB[root.todayStr()];
        ctx.morningDone = !!(e && e.morning);
        ctx.eveningDone = !!(e && e.eve);
      }
    } catch (e) {}
    try { ctx.activeWorkout = !!(O.workout && O.workout.session && O.workout.session.status === 'active'); } catch (e) {}
    try {
      var p = (O.profile && O.profile.get && O.profile.get()) || root.PROFILE || null;
      if (p && O.profileModel && typeof O.profileModel.computeProfileCompleteness === 'function') {
        var c = O.profileModel.computeProfileCompleteness(p);
        ctx.profileIncomplete = !(c && c.essential && c.essential.complete);
      }
      if (p && O.profileModel && typeof O.profileModel.activeConstraints === 'function') {
        ctx.activeConstraint = O.profileModel.activeConstraints(p).length > 0;
      }
    } catch (e) {}
    try { if (typeof root.navigator !== 'undefined' && root.navigator && root.navigator.onLine === false) ctx.online = false; } catch (e) {}
    return ctx;
  }
  /* Ranking-Regeln (B3): deterministisch, testbar. Liefert geordnete Action-Liste
     {primary:[max 3], secondary:[...]} — Kontextaktionen ersetzen/ergänzen gezielt. */
  function rankQuickActions(ctx) {
    ctx = ctx || {};
    var byId = {}; ACTIONS.forEach(function (a) { byId[a.id] = a; });
    var primary = [];
    // Laufendes Training dominiert.
    if (ctx.activeWorkout) primary.push(byId.training_continue);
    else primary.push(byId.training_start);
    // Tageszeit-Priorisierung der Check-ins (nur offene).
    if (ctx.hour < 12 && !ctx.morningDone) primary.unshift(byId.checkin_morning);
    else if (ctx.hour >= 18 && !ctx.eveningDone) primary.unshift(byId.checkin_evening);
    else if (!ctx.morningDone) primary.push(byId.checkin_morning);
    else if (!ctx.eveningDone && ctx.hour >= 15) primary.push(byId.checkin_evening);
    primary.push(byId.activity_log);
    primary = primary.filter(Boolean).slice(0, 3);
    var secondary = [];
    if (ctx.profileIncomplete) secondary.push(byId.profile_complete);
    if (ctx.activeConstraint) secondary.push(byId.complaint_update);
    ['weight_update', ctx.activeConstraint ? null : 'complaint_log', 'goal_add', 'measurement_log', 'appointment_add'].forEach(function (id) {
      if (id && byId[id]) secondary.push(byId[id]);
    });
    // Fail-soft: nur auflösbare Entry-Points anzeigen (kein toter Button).
    function available(a) { return !!resolveEntryPoint(a.entryPoint); }
    return { primary: primary.filter(available), secondary: secondary.filter(available) };
  }

  /* ---------- B4 · UI (Sheet über openSheet, Plus-Button bindet sich selbst) ---------- */
  var _busy = false;
  function runAction(id) {
    if (_busy) return false;   // Doppelklick-Schutz
    _busy = true;
    try {
      var a = null; ACTIONS.forEach(function (x) { if (x.id === id) a = x; });
      var fn = a && resolveEntryPoint(a.entryPoint);
      try { if (typeof root._closeM === 'function') root._closeM('_quickActions'); } catch (e) {}
      if (fn) fn();
      return !!fn;
    } catch (e) {
      try { console.error('[ORVIA quick-actions] Aktion fehlgeschlagen:', id, e && e.message); } catch (_) {}
      return false;
    } finally {
      setTimeout(function () { _busy = false; }, 350);
    }
  }
  function actionRow(a, big) {
    return '<button type="button" class="qa-item' + (big ? ' qa-primary' : '') + '" id="qa-' + esc(a.id) + '" aria-label="' + esc(a.label) + '">' +
      '<svg class="qa-ic" aria-hidden="true"><use href="' + esc(a.icon) + '"/></svg>' +
      '<span class="qa-txt"><span class="qa-label">' + esc(a.label) + '</span>' +
      '<span class="qa-desc">' + esc(a.description) + '</span></span>' +
      '<span class="qa-arrow" aria-hidden="true">›</span></button>';
  }
  function openQuickActions() {
    if (typeof root.openSheet !== 'function') return false;
    var ranked = rankQuickActions(buildContext(new Date()));
    if (!ranked.primary.length && !ranked.secondary.length) return false;
    var body =
      '<div class="qa-root">' +
        '<div class="qa-sec">' + ranked.primary.map(function (a) { return actionRow(a, true); }).join('') + '</div>' +
        (ranked.secondary.length ? '<div class="qa-group-label">Mehr</div><div class="qa-sec">' + ranked.secondary.map(function (a) { return actionRow(a, false); }).join('') + '</div>' : '') +
      '</div>';
    root.openSheet({ id: '_quickActions', title: 'Was möchtest du tun?', size: 'large', body: body });
    var doc = D();
    ranked.primary.concat(ranked.secondary).forEach(function (a) {
      var el = doc && doc.getElementById('qa-' + a.id);
      if (el) el.onclick = function () { runAction(a.id); };
    });
    return true;
  }

  /* Plus-Button in der Bottom-Navigation aktivieren (Markup kommt aus index.html;
     fail-soft: ohne Button keine Wirkung, App unverändert). */
  function bindPlusButton() {
    var doc = D(); if (!doc) return false;
    var btn = doc.getElementById('navPlus');
    if (!btn) return false;
    btn.onclick = function () {
      try { btn.classList.add('pressed'); setTimeout(function () { try { btn.classList.remove('pressed'); } catch (e) {} }, 220); } catch (e) {}
      openQuickActions();
    };
    return true;
  }

  O.quickActions = {
    ACTIONS: ACTIONS,
    resolveEntryPoint: resolveEntryPoint,
    buildContext: buildContext,
    rankQuickActions: rankQuickActions,
    open: openQuickActions,
    runAction: runAction,
    bindPlusButton: bindPlusButton,
    gotoMorningCheckin: function () { _gotoCheckin('morningForm'); },
    gotoEveningCheckin: function () { _gotoCheckin('eveForm'); }
  };
  try { setTimeout(bindPlusButton, 0); } catch (e) { bindPlusButton(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
