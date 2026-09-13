/* ============================================================
   ORVIA · engine/run-classifier — Trainingsart eines Laufs OHNE Label

   WOFÜR. Läufe aus dem Activity Store (Garmin/Sync) tragen kein `sub`
   (Tempo / Long Run / Intervalle / Easy Z2). Calc.goalEngine zählt als
   „Quality" aber NUR Läufe mit diesem Label — für einen Garmin-Nutzer war
   damit jede Prognose `nodata`, obwohl 150 Läufe vorliegen. Dieses Modul
   leitet die Art aus Distanz, Pace und Herzfrequenz ab und markiert das
   Ergebnis als ABGELEITET (subDerived:true), damit die Anzeige es sagen kann.

   REGELN (bewusst grob und erklärbar; ein Label der App schlägt immer):
     Long Run   Einzelsession ≥ longKm (Standard 14 km)
     Tempo      Distanz ≥ 4 km und Pace ≤ Schwellenpace × 1,05
                (Schwellenpace aus performance-resolver; Rückfall: 10-km-Bestpace × 1,06)
     Intervalle nur über den Namen der Aktivität (interval|intervall|wiederhol)
     Easy Z2    Distanz ≥ 4 km und Ø-HF zwischen 65 % und 78 % HFmax (wenn HFmax bekannt)
     ''         sonst (unbekannt — zählt wie bisher nicht als Quality)
   REIN: keine Globals, kein DOM. Eingaben werden injiziert.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'run-classifier@1';
  var DEFAULTS = { longKm: 14, tempoFactor: 1.05, tempoFallbackFactor: 1.06, minKm: 4, easyLo: 0.65, easyHi: 0.78 };

  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  /* run: { distKm, durMin, hr, longestKm?, name? } · ctx: { thresholdPaceSec?, best10kPaceSec?, hrMax? } */
  function classifyRun(run, ctx) {
    var c = Object.assign({}, DEFAULTS, ctx || {});
    if (!run) return { sub: '', reason: 'empty' };
    var dist = num(run.distKm), dur = num(run.durMin), longest = num(run.longestKm) != null ? run.longestKm : dist;
    if (dist == null || dur == null || !(dist > 0) || !(dur > 0)) return { sub: '', reason: 'no_distance_or_duration' };
    var name = String(run.name || run.label || '').toLowerCase();
    if (/interval|intervall|wiederhol/.test(name)) return { sub: 'Intervalle', reason: 'name' };
    if (longest >= c.longKm) return { sub: 'Long Run', reason: 'distance>=' + c.longKm };
    var paceSec = dur * 60 / dist;
    var ref = num(c.thresholdPaceSec) != null ? c.thresholdPaceSec * c.tempoFactor : (num(c.best10kPaceSec) != null ? c.best10kPaceSec * c.tempoFallbackFactor : null);
    if (dist >= c.minKm && ref != null && paceSec <= ref) return { sub: 'Tempo', reason: num(c.thresholdPaceSec) != null ? 'pace<=threshold*1.05' : 'pace<=best10k*1.06' };
    var hr = num(run.hr), hm = num(c.hrMax);
    if (dist >= c.minKm && hr != null && hm != null && hr >= Math.round(c.easyLo * hm) && hr <= Math.round(c.easyHi * hm)) return { sub: 'Easy Z2', reason: 'hr 65-78%' };
    return { sub: '', reason: 'unclassified' };
  }

  /* App-Adapter: Kontext (Schwellenpace, 10-km-Bestpace, HFmax) aus injizierten Abhaengigkeiten,
     5 s gecacht — _storeRunsByDay ist ein heisser Pfad, resolveAll ist es nicht. Reine Eingabe,
     kein Zugriff auf Globals: deps = { profile, today, performanceResolver, runBests, activityStore, hrMax, now }. */
  var _ctxCache = { at: 0, key: null, ctx: null };
  function appContext(deps) {
    deps = deps || {};
    var now = num(deps.now) != null ? deps.now : Date.now(), key = String(deps.today || '') + '|' + String(deps.hrMax == null ? '' : deps.hrMax);
    if (_ctxCache.ctx && _ctxCache.key === key && now - _ctxCache.at < 5000) return _ctxCache.ctx;
    var ctx = { hrMax: num(deps.hrMax) };
    try { var pr = deps.performanceResolver && deps.performanceResolver.resolveAll ? deps.performanceResolver.resolveAll(deps.profile || null, { today: deps.today || null }) : null;
      var run = pr && pr.sports && pr.sports.running; if (run && run.ok && run.thresholdPaceSecPerKm > 0) ctx.thresholdPaceSec = run.thresholdPaceSecPerKm; } catch (e) {}
    if (ctx.thresholdPaceSec == null) { try { var rb = deps.runBests, st = deps.activityStore;
      var mb = (rb && rb.measuredRunBests && st && st.listActivities) ? rb.measuredRunBests(st.listActivities(), { isTombstoned: st.isTombstoned || null }) : null;
      if (mb && mb.k10 && mb.k10.sec > 0) ctx.best10kPaceSec = mb.k10.sec / 10; } catch (e) {} }
    _ctxCache = { at: now, key: key, ctx: ctx };
    return ctx;
  }

  var api = { VERSION: VERSION, DEFAULTS: DEFAULTS, classifyRun: classifyRun, appContext: appContext };
  O.runClassifier = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
