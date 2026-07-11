/* ============================================================
   ORVIA · ui-refresh — P1: zentraler Consumer für 'orvia:profile-updated'.
   Problem (Audit 2026-07-09): Das Event hatte keinen globalen UI-Konsumenten —
   nur sports-Listener und das offene Profil-Center reagierten. Kopfzeile,
   Heute-Karten, Plan, Dash und Zonen blieben bis zum App-Neustart stale.
   Design:
   - targetsFor(sections, activeTab) ist PUR und getestet (keine DOM-Zugriffe).
   - apply() ruft bestehende Renderer fail-soft über window auf — KEINE neue
     Renderlogik, keine zweite Wahrheit.
   - Coalescing über setTimeout(0): mehrere Saves im selben Tick = ein Refresh.
   - Schleifenschutz: max. 5 automatische Refreshes je Sekunde (Renderer dürfen
     ohnehin nie selbst _profileSave auslösen; das ist die zweite Verteidigung).
   - goalSync: leitet die Legacy-Kopie DB._hmTargetMin bei goals-Änderungen neu
     aus PROFILE.hmTargetMin ab (vorher stale, Audit Abschnitt 1) und
     invalidiert den Ziel-Cache über den ui.js-Hook orviaGoalCacheInvalidate.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};

  /* Pur: welche Flächen müssen nach einem Save neu gezeichnet werden?
     Leere/unbekannte sections → defensiv Kernflächen + sichtbarer Tab. */
  function targetsFor(sections, activeTab) {
    var s = Array.isArray(sections) ? sections : [];
    var any = s.length === 0;
    function has() { for (var i = 0; i < arguments.length; i++) { if (s.indexOf(arguments[i]) >= 0) return true; } return false; }
    var t = ['topAvatar', 'profileCard'];
    if (any || has('body', 'performance', 'personal')) t.push('zones');
    if (any || has('goals')) t.push('goalSync');
    if (activeTab === 'heute') t.push('day');
    if (activeTab === 'plan' && (any || has('goals', 'availability', 'sports', 'preferences', 'personal'))) t.push('plan');
    if (activeTab === 'dash' && (any || has('constraints', 'goals', 'body', 'performance'))) t.push('dash');
    return t;
  }

  function activeTabName() {
    try {
      var b = root.document && root.document.querySelector && root.document.querySelector('.tabbar button.on[data-tab]');
      return b ? (b.dataset ? b.dataset.tab : b.getAttribute('data-tab')) : null;
    } catch (e) { return null; }
  }

  var RENDERERS = { topAvatar: 'renderTopAvatar', profileCard: 'renderProfileScreen', zones: 'renderZones', day: 'renderDay', plan: 'renderPlan', dash: 'renderDash' };
  function apply(targets) {
    (targets || []).forEach(function (t) {
      if (t === 'goalSync') {
        try {
          if (root.PROFILE && root.PROFILE.hmTargetMin != null && typeof root.DB !== 'undefined' && root.DB) root.DB._hmTargetMin = root.PROFILE.hmTargetMin;
          if (typeof root.orviaGoalCacheInvalidate === 'function') root.orviaGoalCacheInvalidate();
        } catch (e) {}
        return;
      }
      var fn = RENDERERS[t];
      try { if (fn && typeof root[fn] === 'function') root[fn](); } catch (e) {
        try { console.warn('[ORVIA ui-refresh] Renderer fehlgeschlagen:', t, e && e.message); } catch (_) {}
      }
    });
  }

  var _pending = false, _burstStart = 0, _burstCount = 0;
  function onProfileUpdated(ev) {
    if (_pending) return;                       // Coalescing: ein Refresh pro Tick
    var now = Date.now();
    if (now - _burstStart > 1000) { _burstStart = now; _burstCount = 0; }
    if (++_burstCount > 5) {                    // Schleifenschutz (Renderer→Save→Event wäre ein Bug)
      try { console.warn('[ORVIA ui-refresh] Refresh-Burst gedrosselt — möglicher Save-Rerender-Loop.'); } catch (e) {}
      return;
    }
    var sections = (ev && ev.detail && ev.detail.changedSections) || [];
    _pending = true;
    setTimeout(function () {
      _pending = false;
      try { apply(targetsFor(sections, activeTabName())); } catch (e) {}
    }, 0);
  }

  // GENAU EINE Registrierung, auch wenn das Script (z. B. via SW-Update) doppelt liefe.
  if (!root.__orviaUiRefreshBound) {
    root.__orviaUiRefreshBound = true;
    try { if (root.addEventListener) root.addEventListener('orvia:profile-updated', onProfileUpdated); } catch (e) {}
  }

  O.uiRefresh = { targetsFor: targetsFor, _apply: apply, _onEvent: onProfileUpdated };
})(typeof globalThis !== 'undefined' ? globalThis : this);
