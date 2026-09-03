/* ============================================================
   ORVIA · engine/goal-plan-input — B-01, Schritt 1 (reiner Kern)

   WOFÜR. Band 1, B-01: „generateWeekPlan liest das Zielobjekt (Zielwert,
   Zieldatum) statt nur der Kategorie; Shadow-Log aus A-06 wird zur aktiven
   Quelle." Heute liest die Planung `goalOf()` (ui.js): Legacy-Form, filtert
   auf Lauf-Distanzziele, drei Rueckfallebenen, und `goalTargetMin()` erfindet
   ohne Zielzeit 110 Minuten. Ein Kraftziel mit Prioritaet 1 laeuft an der
   Planung vorbei.

   DIESES MODUL ist die Uebersetzung des KANONISCHEN Hauptziels (mainGoalOf,
   profile-model.normalizeGoal-Form) in genau die Felder, die die Planung
   braucht — nicht mehr. Es ersetzt nichts, solange es niemand aufruft:
   der Umbau der Aufrufer ist B-01 selbst und bleibt hinter Gate A.

   REGELN.
   - „Datenluecke != Wert": keine Zielzeit ⇒ targetMin null + Luecke benannt.
     KEIN 110-Minuten-Default, KEIN Legacy-Blob-Rueckfall. Wer einen Rueckfall
     braucht, macht ihn sichtbar in der Aufruferschicht.
   - Die EINHEIT gewinnt ueber metricType (dieselbe Regel wie goalOf, dort
     seit 2026-07-16 begruendet): unit 'min' → Minuten; unit 's' oder
     metricType 'time' → Sekunden/60; sonst KEINE Zielzeit (goalOf raet hier
     „Minuten" — diese Abweichung ist gewollt und im Plan dokumentiert).
   - Phase kommt aus goal-taper-resolver (A-09), injiziert — keine zweite
     Tageszaehlung.
   - Rein, deterministisch: kein DOM, kein Date.now, kein PROFILE-Zugriff.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'goal-plan-input@2';

  /* Spiegel von ui.js RACE_DIST — bewusst kopiert: das Engine-Modul darf
     nicht von ui.js abhaengen. Der Paritaetstest haelt beide deckungsgleich. */
  var RUN_DIST_KM = { run_5k: 5, run_10k: 10, half_marathon: 21.0975, marathon: 42.195 };
  var FAMILY = {
    run_5k: 'run', run_10k: 'run', half_marathon: 'run', marathon: 'run',
    triathlon: 'tri', ironman: 'tri', sprint_triathlon: 'tri', olympic_triathlon: 'tri', half_ironman: 'tri',
    cycling_event: 'bike', cycling_race: 'bike', ftp: 'bike',
    muscle: 'strength', muscle_gain: 'strength', strength: 'strength',
    weight_loss: 'body', weight_gain: 'body', shredded: 'body', target_bodyfat: 'body', body_fat: 'body'
  };

  function _num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function _r2(x) { return Math.round(x * 100) / 100; }

  /* Zielzeit in Minuten — oder null mit Grund. */
  function targetMinutes(goal) {
    var g = goal || {};
    var v = _num(g.targetValue);
    if (v == null) return { min: null, gap: 'target_value' };
    if (v <= 0) return { min: null, gap: 'target_value_invalid' };
    if (g.unit === 'min') return { min: v, gap: null };
    if (g.unit === 's' || g.metricType === 'time') return { min: _r2(v / 60), gap: null };
    return { min: null, gap: 'target_unit_unknown' };
  }

  /* resolve({ goal, today, canon, taper }) → Plan-Eingabe.
       goal   kanonisches Hauptziel (mainGoalOf()) oder null
       today  'YYYY-MM-DD'
       canon  optional: Kategorie-Kanonisierer (profileModel.canonGoalCategory)
       taper  optional: goal-taper-resolver-API (fromGoal) */
  function resolve(opts) {
    var o = opts || {};
    var g = o.goal && typeof o.goal === 'object' ? o.goal : null;
    var canon = typeof o.canon === 'function' ? o.canon : function (x) { return x; };
    var out = { version: VERSION, source: 'none', goalId: null, category: null, family: null,
      targetDate: null, daysTo: null, phase: null, taperActive: false, target: null, gaps: [] };

    if (!g) { out.gaps.push('no_main_goal'); return out; }
    out.source = 'main_goal';
    out.goalId = g.id != null ? g.id : null;
    var cat = null;
    try { cat = canon(g.category || g.type || null); } catch (_) { cat = g.category || g.type || null; }
    out.category = cat || null;
    out.family = (cat && FAMILY[cat]) || (cat ? 'other' : null);
    if (!cat) out.gaps.push('category');

    /* Datum + Phase (A-09) */
    var date = (typeof g.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.targetDate)) ? g.targetDate : null;
    out.targetDate = date;
    if (!date) out.gaps.push('target_date');
    else if (o.taper && typeof o.taper.fromGoal === 'function') {
      try {
        var t = o.taper.fromGoal({ targetDate: date }, o.today || null);
        if (t) {
          out.phase = t.phase || null; out.daysTo = _num(t.daysToRace);
          if (t.reason === 'race_passed') out.phase = 'past';   /* vergangenes Datum ist eine Aussage, kein Loch */
          out.taperActive = t.active === true;
        }
      } catch (_) { out.gaps.push('taper_resolver_failed'); }
    }

    /* Zielwert */
    var tm = targetMinutes(g);
    var dist = cat && RUN_DIST_KM[cat] != null ? RUN_DIST_KM[cat] : null;
    var value = _num(g.targetValue);
    if (value == null) out.gaps.push('target_value');
    out.target = {
      value: value, unit: g.unit || null, metricType: g.metricType || null,
      targetMin: tm.min, distanceKm: dist,
      pacePerKmSec: (tm.min != null && dist) ? Math.round(tm.min * 60 / dist) : null
    };
    if (tm.gap && tm.gap !== 'target_value') out.gaps.push(tm.gap);
    return out;
  }

  /* Plan-Schluessel: alles, was einen Wochenplan unterscheiden MUSS. Zwei
     Nutzer mit gleicher Kategorie und anderem Zielwert bekommen verschiedene
     Schluessel — das ist der Nachweis fuer die B-01-DoD, bevor die Planung
     umgestellt ist. */
  function planKey(input) {
    var i = input || {}, t = i.target || {};
    return [i.category || '-', i.family || '-', i.phase || '-',
      t.targetMin != null ? String(t.targetMin) : '-',
      t.distanceKm != null ? String(t.distanceKm) : '-',
      (t.targetMin == null && t.value != null) ? (String(t.value) + (t.unit || '')) : '-'].join('|');
  }

  /* Vergleich mit der Legacy-Lesart goalOf() ({type, distanceKm, raceDate,
     targetMin}) — fuer den Schattenbetrieb waehrend der Umstellung. */
  function compareLegacy(input, legacy) {
    var i = input || {}, l = legacy || {}, t = i.target || {};
    var diff = [];
    if ((i.category || null) !== (l.type || null)) diff.push('category');
    if ((i.targetDate || null) !== (l.raceDate || null)) diff.push('target_date');
    var lm = _num(l.targetMin), im = _num(t.targetMin);
    if (lm !== im && !(lm == null && im == null)) diff.push('target_min');
    return { same: diff.length === 0, diff: diff };
  }

  /* Legacy-FORM fuer die 46 goalOf()-Aufrufer: {type, distanceKm, raceDate,
     targetMin, priority, _canonicalId} — dieselben Feldnamen, dieselben
     Leerwerte ('' fuer raceDate, null fuer distanceKm/targetMin). Dazu die
     volle Plan-Eingabe unter _planInput fuer die Stellen, die mehr wissen
     wollen (Phase, Luecken). Gibt null, wenn KEIN Hauptziel vorliegt — dann
     entscheidet der Aufrufer ueber seinen Rueckfall, nicht dieses Modul. */
  function legacyForm(input) {
    var i = input || {};
    if (i.source !== 'main_goal' || !i.category) return null;
    var t = i.target || {};
    return { type: i.category, distanceKm: t.distanceKm != null ? t.distanceKm : null,
      raceDate: i.targetDate || '', targetMin: t.targetMin != null ? t.targetMin : null,
      priority: 'solide', _canonicalId: i.goalId, _planInput: i };
  }

  var api = { VERSION: VERSION, RUN_DIST_KM: RUN_DIST_KM, FAMILY: FAMILY,
    targetMinutes: targetMinutes, resolve: resolve, planKey: planKey, compareLegacy: compareLegacy,
    legacyForm: legacyForm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.goalPlanInput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
