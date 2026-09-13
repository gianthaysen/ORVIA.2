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

  var api = { VERSION: VERSION, DEFAULTS: DEFAULTS, classifyRun: classifyRun };
  O.runClassifier = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
