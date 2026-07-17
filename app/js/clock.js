/* ============================================================
   ORVIA · clock — zentrale, injizierbare Zeitquelle (P0, TEST-GAP-PLAN)
   Produktion: exakt Date.now() — kein Offset, keine Logik, kein Format.
   Tests: _setImplementation({ now }) injiziert eine feste/steuerbare Uhr.
   Konsumenten (inkrementell, freigegebener Scope):
     - js/data.js todayStr()            (Check-in-Tagesschlüssel)
     - js/workout-store.js              (Timer-/Pause-/Terminal-Zeitpfade)
     - js/profile-store.js computeAge() (Altersberechnung)
   Über window.ORVIA.clock UND module.exports (Node-Tests).
   ============================================================ */
(function (root) {
  var impl = null; // NUR Tests: injizierte Uhr ({ now: () => ms })
  function now() { return (impl && typeof impl.now === 'function') ? impl.now() : Date.now(); }
  function _setImplementation(x) { impl = x || null; }
  var api = { now: now, _setImplementation: _setImplementation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA = root.ORVIA || {}; root.ORVIA.clock = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
