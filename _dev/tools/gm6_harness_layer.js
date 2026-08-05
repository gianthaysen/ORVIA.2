/* ============================================================================
   gm6_harness_layer.js — Fixture- und Zustandsschicht des GM6-Harness.
   Wird von tools/build_gm6_harness.mjs ans Ende der Seite montiert.

   Regeln:
     • Gerendert wird NUR mit Produktivcode (renderCommand/renderModules/
       renderCheckinCompact/renderDay). Diese Schicht liefert Eingaben.
     • gmDashVM wird je paint() genau EINMAL berechnet und gecacht. Signalwechsel
       (setSignals) rendern mit dem Cache — keine Neuberechnung (GM6.1 §2).
     • Die __gm6-Zaehler sind Stolperdraehte an den ECHTEN Eintrittspunkten
       (Persistenz, Push, Sync, Gate). Fixture-Reads zaehlen nicht.
   ============================================================================ */
(function () {
  'use strict';

  /* ---------- 0) Chrome: Gate/Splash weg, #prodScreen um #tab-heute ---------- */
  try { document.querySelectorAll('.orvia-gate,#splash').forEach(function (e) { e.remove(); }); } catch (e) {}
  try { document.documentElement.classList.remove('orvia-gated'); } catch (e) {}
  var tab = document.getElementById('tab-heute');
  var screen = document.createElement('div');
  screen.id = 'prodScreen';
  tab.parentNode.insertBefore(screen, tab);
  screen.appendChild(tab);
  try { showTab('heute'); } catch (e) {}

  /* Golden-Master-Geometrie: der GM kennt im Heute-Screen NUR hdr, lvlbadge,
     sync, Hero (#command), Check-in-Karte und Module. Alle Legacy-Hosts
     (Banners, Formulare, Routinen, …) wandern in einen Offstage-Container
     AUSSERHALB von #tab-heute: ihre IDs bleiben existent (Produktionsrenderer
     mit getElementById-Guards laufen ungestoert weiter), aber sie zaehlen —
     wie im Golden Master — nicht zur Heute-Struktur. */
  var off = document.createElement('div');
  off.id = 'gm6-offstage'; off.style.display = 'none';
  document.body.appendChild(off);
  var KEEPID = { command: 1, checkinCompact: 1, modules: 1, modeBadge: 1, syncLine: 1 };
  Array.prototype.slice.call(tab.children).forEach(function (ch) {
    if (ch.classList && ch.classList.contains('hdr')) return;
    if (ch.id && KEEPID[ch.id]) return;
    off.appendChild(ch);
  });
  var ciBox = document.getElementById('checkinCompact');
  var modsEl = document.getElementById('modules');
  /* GM-Zaehlvertrag: in loading/error existiert die Check-in-Karte im GM nicht
     (classCounts card=0) — sie wird dort physisch offstage geparkt, nicht nur
     versteckt. In allen anderen Zustaenden steht sie an ihrem GM-Platz. */
  function placeCheckin() {
    var st = (window._gmStateOverride) || (typeof gmDashState === 'function' ? gmDashState() : 'normal');
    if (st === 'loading' || st === 'error') { if (ciBox.parentNode !== off) off.appendChild(ciBox); }
    else if (ciBox.parentNode !== tab) tab.insertBefore(ciBox, modsEl);
  }

  /* ---------- 1) Signale (Sync-Status + Online) ---------- */
  var SIG = { sync: 'synced', online: true };
  window.orviaSyncState = function () { return SIG.sync; };
  try {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: function () { return SIG.online; } });
  } catch (e) {}

  /* ---------- 2) Modus (Erklaertiefe) ---------- */
  var MODE = 'fortgeschritten';
  window.uiDetailMode = function () { return MODE; };

  /* ---------- 3) Fixtures ---------- */
  function baseMetrics() {
    return {
      hrv_ms: 64, resting_hr: 47, sleep_duration_min: 452, sleep_score: 84,
      stress_avg: 31, body_battery: 78, steps: 8412, active_kcal: 534,
      sleep_deep_min: 96
    };
  }
  window.FIXBASE = { score: 82, band: 'g', dayState: 'GREEN', word: 'Bereit',
    ci: true, mood: null, metrics: baseMetrics(), sync: 'synced', online: true };
  window.FIXEMPTY = { score: null, band: null, dayState: null, word: null,
    ci: false, mood: null, metrics: {}, sync: 'synced', online: true };
  window.CURFIX = Object.assign({}, window.FIXBASE);

  function mkFix(over, empty) {
    var f = Object.assign({}, empty ? window.FIXEMPTY : window.FIXBASE);
    f.metrics = Object.assign({}, empty ? {} : baseMetrics());
    Object.assign(f, over || {});
    return f;
  }

  /* ---------- 4) Projektion: CURFIX → produktive Datenquellen ---------- */
  function project() {
    var t = todayStr();
    /* Tagesblob / Morgen-Check-in */
    try {
      window.DB = window.DB || {};
      DB[t] = DB[t] || {};
      if (window.CURFIX.ci) DB[t].morning = { feel: 6, sleepQ: 4, energy: 4, knee: 0 };
      else delete DB[t].morning;
    } catch (e) {}
    /* Kanonische Metriken (gmMetric liest window._metricsResolved) */
    var res = {};
    var mm = window.CURFIX.metrics || {};
    Object.keys(mm).forEach(function (k) {
      if (mm[k] == null) return;
      res[k] = { value: mm[k], metricDate: t, source: 'harness_fixture', stale: false };
    });
    window._metricsResolved = { date: t, resolved: res, entries: [] };
    /* Score: Fixture-Objekt am orviaScore-Vertrag (kein Engine-Aufruf) */
    window.orviaScore = function () {
      var f = window.CURFIX;
      if (f.score == null) return null;
      /* attention/crit fuehren im Golden Master einen Warnhinweis (card.warn,
         nur Stufe p sichtbar) — Quelle sind die Entscheidungstrigger. */
      var trig = (f.dayState === 'YELLOW' || f.dayState === 'RED')
        ? [{ title: 'Erhöhte Belastungszeichen', detail: 'HRV unter Baseline und gestiegener Ruhepuls — Fixture.' }] : [];
      return { score: f.score, r: { score: f.score },
        status: { c: f.band, l: f.word }, statusText: f.word, dayState: f.dayState,
        decision: { triggers: trig, readinessReasons: ['Stabile Werte – nichts Auffälliges.'],
          recommendedSession: { label: 'Lockerer Dauerlauf', detail: '45 min ruhig — Fixture' } } };
    };
    /* Entscheidungsfixture: kein Engine-Lauf im Harness */
    window.currentDecision = function () { return null; };
    window.invalidateDecision = function () {};
  }

  /* ---------- 5) VM-Cache: genau EINE Berechnung je paint() ---------- */
  var origVM = window.gmDashVM, vmCache = null;
  window.gmDashVM = function () {
    if (vmCache) return vmCache;
    vmCache = origVM();
    /* gm61 §4: mood ist eine Projektion des kanonischen Werts. Die Fixture kann
       einen Wert bei OFFENEM Check-in fuehren (CURFIX.mood) — genau der Fall
       „gespeicherter Wert, Formular noch offen". */
    if (window.CURFIX.mood && !vmCache.ciDone) vmCache.mood = window.CURFIX.mood;
    return vmCache;
  };

  /* ---------- 6) Stolperdraehte an echten Eintrittspunkten ---------- */
  function trip(name, orig) {
    return function () { window.__gm6.calls[name]++; return (typeof orig === 'function') ? orig.apply(this, arguments) : undefined; };
  }
  window.save = trip('persist', null);
  window.saveProfile = trip('persist', null);
  window.schedulePush = trip('schedulePush', null);
  window.flushSyncQueue = trip('flushSync', null);
  window.orviaSyncStart = trip('syncStart', null);
  window.showGate = trip('showGate', null);
  try { if (window.ORVIA) { ['decisionEngine', 'planEngine', 'readinessEngine'].forEach(function (k) {
    if (ORVIA[k]) { var o = ORVIA[k]; Object.keys(o).forEach(function (fn) {
      if (typeof o[fn] === 'function') { var f0 = o[fn]; o[fn] = function () { window.__gm6.calls.engine++; return f0.apply(this, arguments); }; }
    }); } }); } } catch (e) {}
  var origRenderDay = window.renderDay;
  window.renderDay = function () { window.__gm6.calls.renderDay++; return origRenderDay.apply(this, arguments); };

  /* ---------- 7) paint / setVM / setSignals / setState ---------- */
  function lightRender() {
    try { renderCommand(); } catch (e) {}
    try { renderModules(); } catch (e) {}
    try { renderCheckinCompact(); } catch (e) {}
    try { placeCheckin(); } catch (e) {}
  }
  function paint() {
    project();
    vmCache = null;
    window.gmDashVM();          /* genau EINE Berechnung */
    lightRender();
  }
  window.__gm6.paint = paint;

  window.setVM = function (name) {
    window.CURFIX = mkFix({}, name === 'empty');
    paint();
  };
  window.setSignals = function (sync, online) {
    if (sync != null) SIG.sync = sync;
    if (online != null) SIG.online = online;
    if (sync === null && online === true) SIG.sync = 'synced';   /* Rueckkehr online ohne expliziten Sync */
    /* NUR Signale — der VM-Cache bleibt, nichts wird neu berechnet. */
    lightRender();
  };

  var STATES = {
    good:              function () { return mkFix({}); },
    attention:         function () { return mkFix({ score: 58, band: 'y', dayState: 'YELLOW', word: 'Moderat' }); },
    crit:              function () { return mkFix({ score: 31, band: 'r', dayState: 'RED', word: 'Erholung' }); },
    partial:           function () { var f = mkFix({}); f.metrics.stress_avg = null; f.metrics.body_battery = null;
                                     f.metrics.steps = null; f.metrics.active_kcal = null; f.metrics.sleep_score = null; return f; },
    ciopen:            function () { return mkFix({ ci: false }); },
    empty:             function () { return mkFix({}, true); },
    loading:           function () { return mkFix({}); },
    local_only:        function () { return mkFix({ sync: 'local' }); },
    pending:           function () { return mkFix({ sync: 'pending' }); },
    offline_cache:     function () { return mkFix({ online: false }); },
    offline_cache_nav: function () { return mkFix({ online: false }); },
    offline_cache_sync:function () { return mkFix({ sync: 'offline' }); },
    error:             function () { return mkFix({ sync: 'error' }); },
    offline_nodata:    function () { return mkFix({ online: false }, true); },
    error_nodata:      function () { return mkFix({ sync: 'error' }, true); }
  };
  window.setState = function (st, mode) {
    if (mode) MODE = mode;
    var mk = STATES[st];
    if (!mk) throw new Error('unbekannter Harness-Zustand: ' + st);
    window.CURFIX = mk();
    SIG.sync = window.CURFIX.sync; SIG.online = window.CURFIX.online;
    window._gmStateOverride = (st === 'loading') ? 'loading' : null;
    paint();
  };

  /* ---------- 8) Erststand ---------- */
  window.setState('good', 'fortgeschritten');
})();
