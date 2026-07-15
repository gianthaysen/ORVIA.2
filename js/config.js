/* ============================================================
   ORVIA · Cloud-Konfiguration
   Erwartet Supabase-Werte aus einer Runtime-Umgebung, z. B.:
   window.ORVIA_ENV = {
     SUPABASE_URL: 'https://abcd.supabase.co',
     SUPABASE_ANON_KEY: 'sb_publishable_...'
   };

   Der anon public key darf im Frontend liegen und wird durch RLS abgesichert.
   Den service_role key NIEMALS hier oder in anderem Frontend-Code eintragen.
   ============================================================ */
(function () {
  var env = window.ORVIA_ENV || window.__ORVIA_ENV__ || {};
  var previous = window.ORVIA_CFG || {};

  function pick() {
    for (var i = 0; i < arguments.length; i++) {
      var v = env[arguments[i]];
      if (v) return String(v).trim();
    }
    return '';
  }

  window.ORVIA_CFG = {
    SUPABASE_URL: pick('SUPABASE_URL', 'VITE_SUPABASE_URL', 'ORVIA_SUPABASE_URL') || previous.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: pick('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'ORVIA_SUPABASE_ANON_KEY') || previous.SUPABASE_ANON_KEY || '',
    enableDemoData: env.ORVIA_ENABLE_DEMO_DATA === true || env.ORVIA_ENABLE_DEMO_DATA === 'true'
  };

  window.ORVIA_CFG.configured =
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(window.ORVIA_CFG.SUPABASE_URL || '') &&
    (window.ORVIA_CFG.SUPABASE_ANON_KEY || '').length > 30;

  if (window.ORVIA_CFG.configured) document.documentElement.classList.add('orvia-gated');
})();

/* ============================================================
   ORVIA · perf — Diagnose-Instrumentierung (Performance-Audit 2026-07-15).
   NUR Messung via performance.now(), niemals Produktionslogik, niemals blockierend,
   niemals werfend. Abschaltbar: window.ORVIA_PERF = false VOR dem Laden dieser Datei.
   Entfernen/deaktivieren, sobald der Navigations-Performance-Vorfall geklärt ist.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  var enabled = window.ORVIA_PERF !== false;
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function mark(label, startedAt) {
    if (!enabled) return;
    try { console.log('[perf] ' + label + ': ' + (now() - startedAt).toFixed(1) + 'ms'); } catch (e) {}
  }
  window.ORVIA.perf = { now: now, mark: mark, enabled: enabled };
})();
