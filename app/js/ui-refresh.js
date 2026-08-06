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

   GM6.1 (2026-07-27): zweiter Anlass 'orvia:auth-ready'.
   Befund: Die Login-Hydration meldet sich nur bis Schritt 6 von 10
   ('constraints'). avatarStore, checkinStore, readinessStore und
   workoutUI.tryRestore folgen DANACH und liefern kein Signal —
   readinessStore.hydrateRecentScores() rendert überhaupt nichts. Folge:
   Analyse rechnete gegen eine unhydrierte DB, das Baseline-Badge auf Heute
   blieb stale. auth.js löst deshalb am tatsächlichen Ende der Kette genau
   einmal 'orvia:auth-ready' aus; hier wird es auf denselben Refresh-Pfad
   gelegt — KEIN zweiter Lebenszyklus, keine zusätzlichen Renderer, kein
   erzwungener Tabwechsel, kein Store- oder Netzwerkaufruf.
   Zusatz nur für diesen Pfad: protectInput überspringt eine Fläche, deren
   Host gerade ein fokussiertes Eingabefeld enthält (renderMorning() ersetzt
   #morningForm per innerHTML komplett). Der bewusste Profil-Save bleibt
   unverändert ungeschützt (P1-Vertrag).
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
    if (activeTab === 'akt' && (any || has('sports', 'goals'))) t.push('akt');   /* GM7: Aktivitäten nach auth-ready/Profil-Sync neu zeichnen */
    return t;
  }

  function activeTabName() {
    try {
      var b = root.document && root.document.querySelector && root.document.querySelector('.tabbar button.on[data-tab]');
      return b ? (b.dataset ? b.dataset.tab : b.getAttribute('data-tab')) : null;
    } catch (e) { return null; }
  }

  var RENDERERS = { topAvatar: 'renderTopAvatar', profileCard: 'renderProfileScreen', gmProfile: 'renderGMProfile', zones: 'renderZones', day: 'renderDay', plan: 'renderPlan', dash: 'renderDash', akt: 'renderAkt' };

  /* GM6.1: Host je Renderziel — ausschließlich für den Eingabeschutz.
     topAvatar/goalSync haben keine Eingabefelder und brauchen keinen Host. */
  var HOSTS = { day: '#tab-heute', plan: '#tab-plan', dash: '#tab-dash', akt: '#tab-akt', profileCard: '#tab-mehr', zones: '#tab-mehr' };
  function hasOpenInput(sel) {
    try {
      var d = root.document; if (!d || !sel) return false;
      var a = d.activeElement; if (!a) return false;
      var tag = String(a.tagName || '').toUpperCase();
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && a.isContentEditable !== true) return false;
      if (typeof a.closest !== 'function') return false;
      return !!a.closest(sel);
    } catch (e) { return false; }
  }

  function apply(targets, opts) {
    var protect = !!(opts && opts.protectInput);
    // GM7.6: Erscheinungsbild bei jedem Refresh anwenden (billig, immer sicher) —
    // kein neuer Event-Listener, nur der bereits vorhandene zentrale Anlass wird genutzt.
    try { if (typeof root.orviaApplyTheme === 'function') root.orviaApplyTheme(); } catch (e) {}
    (targets || []).forEach(function (t) {
      if (protect && HOSTS[t] && hasOpenInput(HOSTS[t])) return;   // offene Eingabe nie überschreiben
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

  var _pending = false, _pendingSections = null, _pendingOpts = null, _burstStart = 0, _burstCount = 0;

  /* Ein einziger Planer für alle Anlässe. Ein bereits geplanter Refresh saugt
     weitere Anlässe auf; der jüngere, breitere Anlass gewinnt (leere Sektionsliste
     = „alles"), damit ein älterer Lauf einen neueren nicht verengt. */
  function schedule(sections, opts) {
    var s = Array.isArray(sections) ? sections : [];
    if (_pending) {                             // Coalescing: ein Refresh pro Tick
      if (s.length === 0 || !_pendingSections || _pendingSections.length === 0) _pendingSections = [];
      else _pendingSections = _pendingSections.concat(s);
      if (opts && opts.protectInput) _pendingOpts = opts;
      return;
    }
    var now = Date.now();
    if (now - _burstStart > 1000) { _burstStart = now; _burstCount = 0; }
    if (++_burstCount > 5) {                    // Schleifenschutz (Renderer→Save→Event wäre ein Bug)
      try { console.warn('[ORVIA ui-refresh] Refresh-Burst gedrosselt — möglicher Save-Rerender-Loop.'); } catch (e) {}
      return;
    }
    _pending = true; _pendingSections = s; _pendingOpts = opts || null;
    // INCIDENT-FIX: 150 ms Debounce — die Login-Hydrationen (sports/availability/goals/
    // constraints) feuerten 4 Events in Serie und lösten 4 volle Heute-Renders aus
    // (spürbare Start-Trägheit auf iPhone). Editor-Saves bleiben gefühlt sofort.
    setTimeout(function () {
      _pending = false;
      var sec = _pendingSections || [], o = _pendingOpts;
      _pendingSections = null; _pendingOpts = null;
      try { apply(targetsFor(sec, activeTabName()), o); } catch (e) {}
    }, 150);
  }

  function onProfileUpdated(ev) {
    schedule((ev && ev.detail && ev.detail.changedSections) || [], null);
  }

  /* GM6.1: Auth-/Store-Hydration abgeschlossen. Genau ein Refresh der aktuell
     sichtbaren Oberfläche — kein Tabwechsel, keine erneute Datenbeschaffung.
     Der Einmal-Vertrag liegt in auth.js (onAuthed._initFor je Nutzer-Session);
     hier wird bewusst KEIN zweiter Ready-Zustand geführt. */
  function onAuthReady() {
    schedule([], { protectInput: true });
  }

  // GENAU EINE Registrierung, auch wenn das Script (z. B. via SW-Update) doppelt liefe.
  if (!root.__orviaUiRefreshBound) {
    root.__orviaUiRefreshBound = true;
    try { if (root.addEventListener) root.addEventListener('orvia:profile-updated', onProfileUpdated); } catch (e) {}
    try { if (root.addEventListener) root.addEventListener('orvia:auth-ready', onAuthReady); } catch (e) {}
  }

  /* GM6.2 (2026-07-27): schedule wird öffentlich. Grund: checkin-store.js rief
     renderDay() bisher direkt und ungeschützt auf und konnte damit eine offene
     Check-in-Eingabe überschreiben. Der Aufruf läuft jetzt über denselben Planer
     wie alle anderen Anlässe (Debounce, Coalescing, Burst-Schutz, protectInput) —
     KEINE neue Funktion, nur ein zusätzlicher Exportname für die bereits
     bestehende und getestete interne schedule(). */
  O.uiRefresh = { targetsFor: targetsFor, schedule: schedule, _apply: apply, _onEvent: onProfileUpdated, _onAuthReady: onAuthReady };
})(typeof globalThis !== 'undefined' ? globalThis : this);
