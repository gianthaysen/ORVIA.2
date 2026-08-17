/* ============================================================
   ORVIA · energy-expenditure-resolver — dynamischer Gesamtumsatz (PURE)
   ------------------------------------------------------------
   Phase 7 (GARMIN-INTEGRATION-DESIGN.md §9): ersetzt die statische
   Aktivitätsfaktor-Logik. Kein DOM, kein Supabase, deterministisch —
   alle Eingaben kommen vom Aufrufer (nutrition.js sammelt sie).

   Modelle:
   - BMR: Katch-McArdle (370 + 21,6 × LBM) bei plausiblem Körperfett
     (3–60 %), sonst Mifflin-St. Jeor (identisch zu Calc.bmr).
   - PROVIDER-Modus (Garmin): total_kcal ODER resting+active. Double-
     Counting-Matrix: active_kcal ENTHÄLT Schritte und aufgezeichnete
     Workouts — es wird NIE etwas addiert. Nur active (ohne resting)
     ⇒ 'provider_partial': BMR + active.
   - ORVIA-Modus: BMR + Schrittenergie (steps × kg × 0,0004 kcal —
     ≈300 kcal/10k Schritte bei 75 kg) + Trainingsenergie (Sessions)
     + 10 % TEF auf die Summe (Näherung der thermischen Wirkung bei
     Erhaltungszufuhr). Ohne Schrittdaten: NEAT-Pauschale 15 % des BMR
     statt Schrittenergie (estimated:true — ehrlich gekennzeichnet).
   - ADAPTIVE Korrektur: linearer 14–28-Tage-Gewichtstrend (Morgen-
     gewichte). adj = −(Trend kg/28 d × 7700 kcal/kg)/28 × 0,5
     (Dämpfung 50 %, da die Zufuhr nicht getrackt wird), Kappung ±250.
     Erst ab ≥8 Messungen über ≥14 Tage Spannweite.
   Beide Modi werden parallel berechnet; gewählt wird provider > orvia.
   Vertragstest: supabase/tests/energy_resolver_p7_test.mjs
   ============================================================ */
(function () {
  var root = (typeof window !== 'undefined') ? window : globalThis;
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var KCAL_PER_KG_FAT = 7700;
  var STEP_KCAL_PER_STEP_PER_KG = 0.0004;
  var TEF_FACTOR = 0.10;
  var NEAT_FALLBACK_OF_BMR = 0.15;
  var ADAPTIVE_DAMPING = 0.5;
  var ADAPTIVE_CAP = 250;

  function _num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  /* BMR mit Methoden-Angabe. Körperfett plausibel ⇒ Katch-McArdle, sonst Mifflin. */
  function bmrOf(p) {
    p = p || {};
    var w = _num(p.weightKg);
    if (!w) return { value: null, method: null };
    var bf = _num(p.bodyFatPct);
    if (bf != null && bf >= 3 && bf <= 60) {
      var lbm = w * (1 - bf / 100);
      return { value: Math.round(370 + 21.6 * lbm), method: 'katch_mcardle' };
    }
    var h = _num(p.heightCm);
    if (!h) return { value: null, method: null };
    var s = (p.sex === 'f' || p.sex === 'w') ? -161 : ((p.sex === 'm') ? 5 : -78);
    return { value: Math.round(10 * w + 6.25 * h - 5 * (p.age || 30) + s), method: 'mifflin' };
  }

  function stepKcal(steps, weightKg) {
    var st = _num(steps), w = _num(weightKg);
    if (st == null || st < 0 || !w) return null;
    return Math.round(st * w * STEP_KCAL_PER_STEP_PER_KG);
  }

  /* Linearer Gewichtstrend aus [{date:'YYYY-MM-DD', kg}] → kg pro 28 Tage.
     null bei <8 Punkten oder <14 Tagen Spannweite (keine Scheinpräzision). */
  function weightTrendKgPer28d(series) {
    var pts = (Array.isArray(series) ? series : [])
      .filter(function (e) { return e && _num(e.kg) != null && /^\d{4}-\d{2}-\d{2}$/.test(String(e.date || '')); })
      .map(function (e) { return { t: Date.parse(e.date + 'T00:00:00Z') / 86400000, kg: e.kg }; })
      .sort(function (a, b) { return a.t - b.t; });
    if (pts.length < 8) return null;
    var span = pts[pts.length - 1].t - pts[0].t;
    if (span < 14) return null;
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < n; i++) { sx += pts[i].t; sy += pts[i].kg; sxx += pts[i].t * pts[i].t; sxy += pts[i].t * pts[i].kg; }
    var denom = n * sxx - sx * sx;
    if (!denom) return null;
    var slopePerDay = (n * sxy - sx * sy) / denom;
    return Math.round(slopePerDay * 28 * 100) / 100;
  }

  /* Hauptrechnung. inputs:
       weightKg, heightCm, age, sex, bodyFatPct
       steps, activeKcal, restingKcal, totalKcalProvider   (heutige user_metrics; null = fehlt)
       trainingKcal                                        (ORVIA-Sessions heute; 0 = keins)
       weightSeries                                        ([{date,kg}] für die adaptive Korrektur) */
  function computeDay(inputs) {
    inputs = inputs || {};
    var b = bmrOf(inputs);
    if (b.value == null) return null;   // ohne Körperdaten keine Fantasiewerte (P2-Vertrag)

    // PROVIDER-Modus — nie addieren (active ⊃ Schritte + Workouts).
    var provider = null;
    var total = _num(inputs.totalKcalProvider);
    var active = _num(inputs.activeKcal);
    var resting = _num(inputs.restingKcal);
    if (total != null) provider = { tdee: Math.round(total), source: 'total' };
    else if (active != null && resting != null) provider = { tdee: Math.round(active + resting), source: 'active_plus_resting' };
    else if (active != null) provider = { tdee: Math.round(b.value + active), source: 'active_plus_bmr' };

    // ORVIA-Modus.
    var sk = stepKcal(inputs.steps, inputs.weightKg);
    var stepsEstimated = sk == null;
    var neat = stepsEstimated ? Math.round(b.value * NEAT_FALLBACK_OF_BMR) : sk;
    var training = Math.max(0, Math.round(_num(inputs.trainingKcal) || 0));
    var subtotal = b.value + neat + training;
    var tef = Math.round(subtotal * TEF_FACTOR);
    var orvia = { tdee: subtotal + tef, stepKcal: neat, stepsEstimated: stepsEstimated, trainingKcal: training, tefKcal: tef };

    // Adaptive Korrektur aus dem Gewichtstrend.
    var trend = weightTrendKgPer28d(inputs.weightSeries);
    var adj = 0;
    if (trend != null) {
      adj = -(trend * KCAL_PER_KG_FAT) / 28 * ADAPTIVE_DAMPING;
      adj = Math.max(-ADAPTIVE_CAP, Math.min(ADAPTIVE_CAP, Math.round(adj)));
    }

    var mode = provider ? 'provider' : 'orvia';
    var raw = provider ? provider.tdee : orvia.tdee;
    var tdee = Math.max(b.value, raw + adj);   // nie unter BMR

    return {
      mode: mode,
      bmr: b.value, bmrMethod: b.method,
      provider: provider, orvia: orvia,
      adaptive: { trendKgPer28d: trend, adjKcal: adj },
      tdee: tdee
    };
  }

  var API = {
    bmrOf: bmrOf,
    stepKcal: stepKcal,
    weightTrendKgPer28d: weightTrendKgPer28d,
    computeDay: computeDay
  };

  O.energyResolver = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
