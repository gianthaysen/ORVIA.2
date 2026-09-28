/* ============================================================
   ORVIA · engine/goal-realism — Einstufung eines Ziels fuer die Oberflaeche

   WOFUER (Gian, 25.09.2026): „5 km in 40 min, Marathon unter 2:30 in zwei
   Monaten — das ist unerreichbar in der Zeit, und die App sollte das sagen
   und ein leichteres Ziel nahelegen. Ein realistisches Ziel braucht dagegen
   keinen Stempel."

   DIESES MODUL RECHNET NICHTS NEU. Es liest das Urteil von goal-feasibility
   (ueber goal-feasibility-adapter.observe) und uebersetzt es in genau drei
   Stufen fuer die Oberflaeche:
     ok           — im modellierten Korridor ⇒ die Oberflaeche schweigt
     tight        — ausserhalb, aber Bedarf ≤ TIGHT_MAX_RATIO × Hoechstrate
                    („knapp": moeglich, wenn alles laeuft)
     unrealistic  — Bedarf > TIGHT_MAX_RATIO × Hoechstrate im Zeitraum
     unknown      — nicht bewertet / Datenlage reicht nicht ⇒ schweigt

   Der Schwellwert ist eine PRODUKTREGEL [A], keine Messgroesse: bis zum
   1,5-Fachen der modellierten Hoechstrate ist ein Ziel „knapp" (ein guter
   Block, gute Umstaende); darueber traegt keine Blockplanung mehr.

   Die VORSCHLAEGE stammen aus Groessen, die der Bewerter schon ausgibt:
     safeTarget   — die vorsichtige Kante der heutigen Leistung (band.max bei
                    „kleiner ist besser"): ab dort ist requiredPct ≤ 0, also
                    sicher im Korridor. Kein neues Modell.
     weeksNeeded  — totalPct / Hoechstrate × 12 (dieselbe Formel, die der
                    Bewerter fuer flexible Ziele benutzt), population_prior.

   Rein: kein DOM, keine Uhr (today kommt herein), kein Storage.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'goal-realism@1';
  var TIGHT_MAX_RATIO = 1.5;
  var BLOCK_WEEKS = 12;

  function _r1(x) { return Math.round(x * 10) / 10; }
  function _addWeeks(iso, weeks) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m || !(weeks >= 0)) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    d.setUTCDate(d.getUTCDate() + Math.ceil(weeks * 7));
    return d.toISOString().slice(0, 10);
  }

  /* obs: Rueckgabe von goalFeasibilityAdapter.observe() — oder direkt ein
     Bewerter-Ergebnis (res.status vorhanden). today: 'YYYY-MM-DD' optional. */
  function grade(obs, today) {
    var out = { version: VERSION, grade: 'unknown', status: null, ratio: null, requiredPct: null,
      pctPerBlock: null, achievableMax: null, achievableMin: null, weeksAvailable: null,
      weeksNeeded: null, safeTarget: null, earliestDate: null, metric: null, mode: null, reason: null };
    if (!obs) { out.reason = 'no_observation'; return out; }
    var res = (obs.result && obs.result.status) ? obs.result : (obs.status ? obs : null);
    if (obs.evaluated === false || !res) { out.reason = obs.reason || 'not_evaluated'; return out; }
    out.status = res.status; out.mode = res.goalMode || null;
    var req = res.requiredTrajectory || null, ach = res.achievableTrajectory || null;
    if (req) {
      out.metric = req.metric || null; out.requiredPct = req.totalPct != null ? req.totalPct : null;
      out.pctPerBlock = req.pctPerBlock != null ? req.pctPerBlock : null; out.weeksAvailable = req.weeksAvailable != null ? req.weeksAvailable : null;
      /* vorsichtige Kante = sicher im Korridor (requiredPct ≤ 0 ab dort) */
      if (req.direction === 'lower' && req.from > 0) out.safeTarget = req.from;
      if (req.direction === 'higher' && req.from > 0) out.safeTarget = req.from;
    }
    if (ach) { out.achievableMax = ach.max != null ? ach.max : null; out.achievableMin = ach.min != null ? ach.min : null; }
    if (res.status === 'insufficient_data') { out.reason = (res.limitingFactors && res.limitingFactors[0]) || 'insufficient_data'; return out; }
    if (res.status === 'within_modeled_corridor') { out.grade = 'ok'; return out; }
    /* outside_modeled_corridor */
    if (out.pctPerBlock != null && out.achievableMax > 0) out.ratio = _r1(out.pctPerBlock / out.achievableMax);
    if (out.requiredPct > 0 && out.achievableMax > 0) {
      var wMin = _r1(out.requiredPct / out.achievableMax * BLOCK_WEEKS);
      var wMax = out.achievableMin > 0 ? _r1(out.requiredPct / out.achievableMin * BLOCK_WEEKS) : null;
      out.weeksNeeded = { min: wMin, max: wMax, open: wMax == null, model: 'population_prior' };
      if (today) out.earliestDate = _addWeeks(today, wMin);
    }
    /* OHNE VERHAELTNIS KEIN „UNREALISTISCH". Liegt der Bewerter nur mit dem
       Status vor (keine Trajektorien), ist „knapp" die ehrlichste Stufe — ein
       hartes Urteil braucht die Zahl. */
    if (out.mode === 'fixed_date') {
      out.grade = (out.ratio == null || out.ratio <= TIGHT_MAX_RATIO) ? 'tight' : 'unrealistic';
    } else {
      /* flexibles Ziel ausserhalb ⇒ der Bewerter sagt: kein modellierter Fortschritt (Rate 0) */
      out.grade = (out.achievableMax === 0) ? 'unrealistic' : 'tight';
    }
    return out;
  }

  var api = { VERSION: VERSION, TIGHT_MAX_RATIO: TIGHT_MAX_RATIO, BLOCK_WEEKS: BLOCK_WEEKS, grade: grade, _addWeeks: _addWeeks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.goalRealism = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
