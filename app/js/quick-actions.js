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

  /* ---------- B2 · Registry (delegiert NUR, implementiert nichts) ----------
     P8: frequency klassifiziert die Aktionen — daily (Schnellaktion), occasional
     (gelegentlich), setup (seltene Profilaktion — NIE Default-Favorit). */
  var ACTIONS = [
    { id: 'training_start', label: 'Training starten', description: 'Live-Einheit beginnen', icon: '#i-run', category: 'primary', frequency: 'daily',
      entryPoint: 'orvia:workoutUI.openTrainingTab', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:activity-updated' },
    { id: 'checkin_morning', label: 'Morgen-Check-in', description: 'Tagesform erfassen', icon: '#i-sun', category: 'primary', frequency: 'daily',
      entryPoint: 'orvia:quickActions.gotoMorningCheckin', requiresProfile: false, requiresOnline: false, resultEvent: null },
    { id: 'checkin_evening', label: 'Abend-Check-in', description: 'Tag abschließen', icon: '#i-moon', category: 'primary', frequency: 'daily',
      entryPoint: 'orvia:quickActions.gotoEveningCheckin', requiresProfile: false, requiresOnline: false, resultEvent: null },
    { id: 'activity_log', label: 'Aktivität nachtragen', description: 'Einheit manuell erfassen', icon: '#i-plus', category: 'primary', frequency: 'daily',
      entryPoint: 'openManualActivity', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:activity-updated' },
    { id: 'routines_check', label: 'Routinen & Supplements', description: 'Tagesaufgaben abhaken', icon: '#i-repeat', category: 'secondary', frequency: 'daily',
      entryPoint: 'orvia:quickActions.gotoRoutines', requiresProfile: false, requiresOnline: false, resultEvent: null },
    { id: 'weight_update', label: 'Gewicht aktualisieren', description: 'Neue Messung eintragen', icon: '#i-scale', category: 'secondary', frequency: 'occasional',
      entryPoint: 'openPerformanceManager', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:profile-updated' },
    { id: 'complaint_log', label: 'Beschwerde erfassen', description: 'Schmerz oder Einschränkung melden', icon: '#i-pulse', category: 'secondary', frequency: 'occasional',
      entryPoint: 'openModulePicker', requiresProfile: false, requiresOnline: false, resultEvent: null },
    { id: 'goal_add', label: 'Ziel hinzufügen', description: 'Neues Trainingsziel anlegen', icon: '#i-target', category: 'secondary', frequency: 'setup',
      entryPoint: 'openGoalsManager', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:profile-updated' },
    { id: 'measurement_log', label: 'Messwert erfassen', description: 'HFmax, Ruhepuls & Co.', icon: '#i-heart', category: 'secondary', frequency: 'occasional',
      entryPoint: 'openPerformanceManager', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:profile-updated' },
    { id: 'appointment_add', label: 'Termin hinzufügen', description: 'Fester Termin für die Planung', icon: '#i-calendar', category: 'secondary', frequency: 'setup',
      entryPoint: 'openFixedEventEditor', requiresProfile: false, requiresOnline: false, resultEvent: null },
    // Kontextaktionen (erscheinen nur über das Ranking):
    { id: 'training_continue', label: 'Training fortsetzen', description: 'Laufende Einheit öffnen', icon: '#i-run', category: 'context', frequency: 'daily',
      entryPoint: 'orvia:workoutUI.openTrainingTab', requiresProfile: false, requiresOnline: false, resultEvent: null },
    { id: 'profile_complete', label: 'Profil vervollständigen', description: 'Wenige Angaben fehlen noch', icon: '#i-user', category: 'context', frequency: 'setup',
      entryPoint: 'openProfileCenterEntry', requiresProfile: false, requiresOnline: false, resultEvent: 'orvia:profile-updated' },
    { id: 'complaint_update', label: 'Beschwerden aktualisieren', description: 'Wie geht es der betroffenen Stelle?', icon: '#i-pulse', category: 'context', frequency: 'occasional',
      entryPoint: 'openModulePicker', requiresProfile: false, requiresOnline: false, resultEvent: null }
  ];

  /* ---------- P8 · Favoriten (max 6, sortierbar, user-scoped persistiert) ---------- */
  var DEFAULT_FAVORITES = ['training_start', 'checkin_morning', 'checkin_evening', 'activity_log', 'weight_update', 'complaint_log'];
  var MAX_FAVORITES = 6;
  function _favKey() { return 'orvia_qa_favs_' + ((O.user && O.user.id) || 'anon'); }
  function getFavorites() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(_favKey());
      var arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) {
        var byId = {}; ACTIONS.forEach(function (a) { byId[a.id] = a; });
        var clean = arr.filter(function (id) { return byId[id] && byId[id].category !== 'context'; }).slice(0, MAX_FAVORITES);
        if (clean.length) return clean;
      }
    } catch (e) {}
    return DEFAULT_FAVORITES.slice();
  }
  function setFavorites(ids) {
    var byId = {}; ACTIONS.forEach(function (a) { byId[a.id] = a; });
    var clean = (Array.isArray(ids) ? ids : []).filter(function (id) { return byId[id] && byId[id].category !== 'context'; }).slice(0, MAX_FAVORITES);
    try { if (root.localStorage) root.localStorage.setItem(_favKey(), JSON.stringify(clean)); } catch (e) {}
    return clean;
  }
  /* Pur: Menüaufbau — Kontext-Overlay (max 2, drängt sich nur bei echtem Anlass auf),
     dann Favoriten in Nutzer-Reihenfolge, Rest unter „Alle Aktionen". */
  function composeQuickMenu(ctx, favoriteIds, actions) {
    ctx = ctx || {};
    var list = actions || ACTIONS;
    var byId = {}; list.forEach(function (a) { byId[a.id] = a; });
    var context = [];
    if (ctx.activeWorkout && byId.training_continue) context.push(byId.training_continue);
    if (ctx.hour < 12 && !ctx.morningDone && byId.checkin_morning) context.push(byId.checkin_morning);
    else if (ctx.hour >= 18 && !ctx.eveningDone && byId.checkin_evening) context.push(byId.checkin_evening);
    if (context.length < 2 && ctx.activeConstraint && byId.complaint_update) context.push(byId.complaint_update);
    if (context.length < 2 && ctx.profileIncomplete && byId.profile_complete) context.push(byId.profile_complete);
    context = context.slice(0, 2);
    var inCtx = {}; context.forEach(function (a) { inCtx[a.id] = 1; });
    var favorites = (favoriteIds || []).map(function (id) { return byId[id]; })
      .filter(function (a) { return a && !inCtx[a.id]; });
    var shown = {}; context.concat(favorites).forEach(function (a) { shown[a.id] = 1; });
    var all = list.filter(function (a) { return a.category !== 'context' && !shown[a.id]; });
    return { context: context, favorites: favorites, all: all };
  }

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
    // P8: Kontext-Overlay + Nutzer-Favoriten + vollständiger Katalog („Alle Aktionen").
    var available = ACTIONS.filter(function (a) { return !!resolveEntryPoint(a.entryPoint); });
    var menu = composeQuickMenu(buildContext(new Date()), getFavorites(), available);
    if (!menu.context.length && !menu.favorites.length && !menu.all.length) return false;
    var body =
      '<div class="qa-root">' +
        (menu.context.length ? '<div class="qa-group-label">Jetzt sinnvoll</div><div class="qa-sec">' + menu.context.map(function (a) { return actionRow(a, true); }).join('') + '</div>' : '') +
        (menu.favorites.length ? '<div class="qa-group-label">Deine Favoriten</div><div class="qa-sec">' + menu.favorites.map(function (a) { return actionRow(a, !menu.context.length); }).join('') + '</div>' : '') +
        (menu.all.length ? '<details class="qa-more"><summary class="qa-group-label qa-more-sum">Alle Aktionen (' + menu.all.length + ')</summary><div class="qa-sec">' + menu.all.map(function (a) { return actionRow(a, false); }).join('') + '</div></details>' : '') +
        '<button type="button" class="qa-manage" id="qa-manage">Favoriten anpassen</button>' +
      '</div>';
    root.openSheet({ id: '_quickActions', title: 'Was möchtest du tun?', size: 'large', body: body });
    var doc = D();
    menu.context.concat(menu.favorites, menu.all).forEach(function (a) {
      var el = doc && doc.getElementById('qa-' + a.id);
      if (el) el.onclick = function () { runAction(a.id); };
    });
    var mg = doc && doc.getElementById('qa-manage');
    if (mg) mg.onclick = openFavoritesManager;
    return true;
  }

  /* ---------- P8 · Favoriten-Verwaltung (Toggle max 6, ↑/↓-Sortierung) ---------- */
  function openFavoritesManager() {
    if (typeof root.openSheet !== 'function') return false;
    var favs = getFavorites();
    function render() {
      var doc = D(); var box = doc && doc.getElementById('qaFavBody'); if (!box) return;
      var byId = {}; ACTIONS.forEach(function (a) { byId[a.id] = a; });
      var rows = favs.map(function (id, i) {
        var a = byId[id]; if (!a) return '';
        return '<div class="qa-fav-row"><span class="qa-fav-name">' + esc(a.label) + '</span>' +
          '<span class="qa-fav-acts"><button type="button" class="gmc-b" data-mv="-1" data-i="' + i + '">↑</button>' +
          '<button type="button" class="gmc-b" data-mv="1" data-i="' + i + '">↓</button>' +
          '<button type="button" class="gmc-b danger-btn" data-del="' + i + '">✕</button></span></div>';
      }).join('');
      var addable = ACTIONS.filter(function (a) { return a.category !== 'context' && favs.indexOf(a.id) < 0; });
      var addRows = addable.map(function (a) {
        return '<button type="button" class="qa-fav-add gm-chip" data-add="' + esc(a.id) + '"' + (favs.length >= MAX_FAVORITES ? ' disabled' : '') + '>' + esc(a.label) + '</button>';
      }).join('');
      box.innerHTML = '<p class="note" style="text-align:left">Bis zu ' + MAX_FAVORITES + ' Favoriten, Reihenfolge per Pfeile. Änderungen werden sofort gespeichert.</p>' +
        '<div class="qa-fav-list">' + (rows || '<p class="note" style="text-align:left">Keine Favoriten gewählt.</p>') + '</div>' +
        '<div class="qa-group-label">Hinzufügen</div><div class="gm-chips">' + addRows + '</div>';
      box.querySelectorAll('[data-mv]').forEach(function (b) {
        b.onclick = function () { var i = parseInt(b.dataset.i, 10), d = parseInt(b.dataset.mv, 10), j = i + d; if (j < 0 || j >= favs.length) return; var t = favs[i]; favs[i] = favs[j]; favs[j] = t; favs = setFavorites(favs); render(); };
      });
      box.querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function () { favs.splice(parseInt(b.dataset.del, 10), 1); favs = setFavorites(favs); render(); };
      });
      box.querySelectorAll('[data-add]').forEach(function (b) {
        b.onclick = function () { if (favs.length >= MAX_FAVORITES) return; favs.push(b.dataset.add); favs = setFavorites(favs); render(); };
      });
    }
    root.openSheet({ id: '_qaFavs', title: 'Quick-Add-Favoriten', size: 'large', body: '<div id="qaFavBody"></div>' });
    render();
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
    composeQuickMenu: composeQuickMenu,
    getFavorites: getFavorites,
    setFavorites: setFavorites,
    DEFAULT_FAVORITES: DEFAULT_FAVORITES,
    MAX_FAVORITES: MAX_FAVORITES,
    openFavoritesManager: openFavoritesManager,
    open: openQuickActions,
    runAction: runAction,
    bindPlusButton: bindPlusButton,
    gotoMorningCheckin: function () { _gotoCheckin('morningForm'); },
    gotoEveningCheckin: function () { _gotoCheckin('eveForm'); },
    /* P8/P7: Routinen-Zugang — Heute öffnen, Karte einblenden (auch wenn erledigt) + hinscrollen. */
    gotoRoutines: function () {
      try { root._routinesForceShow = true; } catch (e) {}   // H5: renderRoutines respektiert das Flag
      try { if (typeof root.showTab === 'function') root.showTab('heute'); } catch (e) {}
      try {
        var doc = D(); var card = doc && doc.getElementById('routinesCard');
        if (card) { card.style.display = ''; card.open = true; if (card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      } catch (e) {}
    }
  };
  try { setTimeout(bindPlusButton, 0); } catch (e) { bindPlusButton(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
