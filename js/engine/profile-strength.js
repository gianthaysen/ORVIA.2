/* ============================================================
   ORVIA · engine/profile-strength — B-03 Profilstärke

   WOFÜR. Band 1, B-03: „Profilvollständigkeits-Score + gezielte Nachfragen;
   Score sichtbar; jede fehlende Angabe verlinkt auf den erhebenden Schritt."
   Die Profilzentrale kennt schon die VOLLSTAENDIGKEIT der Pflichtbereiche
   (profileModel.computeProfileCompleteness, Ring in Prozent, Smart Prompts).
   Ein Profil kann dort „100 % vollständig" sein — und die Planung rechnet
   trotzdem ohne Zielzeit, ohne Leistungsreferenz und mit einer Verfuegbarkeit
   von null Tagen. STAERKE ist die Frage „wie gut kann ORVIA fuer dich
   planen?" — Vollstaendigkeit ist eine ihrer vier Komponenten.

   KOMPONENTEN (Gewichte sind Annahmen, keine Messgroessen; sie stehen hier
   und nirgends sonst):
     essential  40  Pflichtbereiche vollstaendig (profile-model)
     goal       25  Kategorie, Zielwert, Zieldatum (goal-plan-input-Luecken)
     performance 20 Leistungsreferenz fuer den Hauptsport (Zonen aufloesbar)
     availability 15 Trainingstage gepflegt (>= 3 voll, 1–2 halb, 0 nichts)
   Frische: jeder veraltete Pflichtbereich −5 (max −15). Ein nicht bewert-
   barer Teil (z. B. Kraftziel braucht keine Leistungsreferenz) wird aus der
   Gewichtung genommen, nicht als 0 gezaehlt — dieselbe Regel wie plan-quality.

   JEDE LUECKE TRAEGT IHR ZIEL: sectionId (openProfileSection) oder action
   'goal_editor' (openGoalEditor(goalId)). Sortiert nach Gewicht — die
   Nachfrage mit dem groessten Nutzen zuerst. REIN: kein DOM, kein PROFILE-
   Zugriff, alles injiziert.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'profile-strength@1';
  var W = { essential: 40, goal: 25, performance: 20, availability: 15 };
  var BANDS = [[85, 'stark'], [65, 'solide'], [40, 'lueckenhaft'], [0, 'schwach']];
  var SECTION_DE = { personal: 'Persönliche Daten', sports: 'Sportarten & Trainingsstand', goals: 'Ziele', availability: 'Verfügbarkeit', constraints: 'Beschwerden & Einschränkungen', body: 'Leistungswerte & Körper' };

  function _clamp01(x) { return Math.max(0, Math.min(1, (typeof x === 'number' && isFinite(x)) ? x : 0)); }

  /* compute({ completeness, planInput, performance, availableDays, staleSections })
       completeness  profileModel.computeProfileCompleteness(p)
       planInput     goalPlanInput.resolve({goal: mainGoalOf(), …})  (oder null)
       performance   performance-resolver.resolveAll(...)          (oder null)
       availableDays Anzahl verfuegbarer Trainingstage (0..7)     (oder null)
       staleSections ['constraints', …] veraltete Pflichtbereiche */
  function compute(opts) {
    var o = opts || {};
    var gaps = [], parts = {};

    /* 1 · Pflichtbereiche */
    var comp = o.completeness || null;
    var ess = comp && comp.essential ? comp.essential : null;
    parts.essential = { applicable: !!ess, value: ess ? _clamp01(ess.score) : 0 };
    if (ess && Array.isArray(ess.missing)) {
      var seen = {};
      ess.missing.forEach(function (m) {
        if (!m || !m.section || seen[m.section]) return; seen[m.section] = true;
        gaps.push({ id: 'section_' + m.section, weight: W.essential,
          label: (SECTION_DE[m.section] || m.section) + ' vervollständigen', sectionId: m.section, hint: 'Pflichtbereich — ohne ihn kann ORVIA dich nicht einordnen.' });
      });
    }

    /* 2 · Ziel */
    var pi = o.planInput || null;
    var g = { applicable: true, value: 0 };
    if (!pi || pi.source !== 'main_goal') {
      gaps.push({ id: 'goal_missing', weight: W.goal, label: 'Ein Hauptziel festlegen', sectionId: 'goals', hint: 'Ohne Ziel plant ORVIA nur allgemein.' });
    } else {
      var gl = Array.isArray(pi.gaps) ? pi.gaps : [];
      var hasCat = !!pi.category, hasVal = gl.indexOf('target_value') < 0 && gl.indexOf('target_value_invalid') < 0 && gl.indexOf('target_unit_unknown') < 0, hasDate = gl.indexOf('target_date') < 0;
      g.value = (hasCat ? 0.4 : 0) + (hasVal ? 0.3 : 0) + (hasDate ? 0.3 : 0);
      if (!hasVal) gaps.push({ id: 'goal_target', weight: W.goal * 0.3, label: 'Zielwert eintragen', action: 'goal_editor', goalId: pi.goalId, hint: 'Ohne Zielwert gibt es keine Zielpace und kein „on track".' });
      if (!hasDate) gaps.push({ id: 'goal_date', weight: W.goal * 0.3, label: 'Zieldatum eintragen', action: 'goal_editor', goalId: pi.goalId, hint: 'Ohne Datum keine Taper- und Rennwoche.' });
    }
    parts.goal = g;

    /* 3 · Leistungsreferenz — nur fuer Ausdauerziele anwendbar */
    var endurance = !!(pi && (pi.family === 'run' || pi.family === 'tri' || pi.family === 'bike'));
    var perf = o.performance || null;
    var perfOk = !!(perf && (perf.anyOk === true || perf.ok === true && perf.sports && Object.keys(perf.sports).some(function (k) { return perf.sports[k] && perf.sports[k].ok; })));
    parts.performance = { applicable: endurance, value: perfOk ? 1 : 0 };
    if (endurance && !perfOk) gaps.push({ id: 'performance_reference', weight: W.performance, label: 'Leistungsreferenz hinterlegen', sectionId: 'body', hint: 'Ein Wettkampf, ein Schwellentest oder eine Zielzeit — daraus entstehen deine Zonen.' });

    /* 4 · Verfuegbarkeit */
    var days = (typeof o.availableDays === 'number' && isFinite(o.availableDays)) ? o.availableDays : null;
    parts.availability = { applicable: true, value: days == null ? 0 : (days >= 3 ? 1 : (days >= 1 ? 0.6 : 0)) };
    if (days == null || days < 1) gaps.push({ id: 'availability_days', weight: W.availability, label: 'Trainingstage festlegen', sectionId: 'availability', hint: 'Ohne Tage kann der Plan nicht verteilt werden.' });
    else if (days < 3) gaps.push({ id: 'availability_few', weight: W.availability * 0.4, label: 'Nur ' + days + ' Trainingstag' + (days === 1 ? '' : 'e') + ' hinterlegt', sectionId: 'availability', hint: 'Passt das? Mehr Tage geben dem Plan Spielraum.' });

    /* Gewichtung ueber die anwendbaren Teile */
    var wsum = 0, acc = 0;
    Object.keys(W).forEach(function (k) { if (parts[k].applicable) { wsum += W[k]; acc += W[k] * parts[k].value; } });
    var raw = wsum ? (acc / wsum) * 100 : 0;

    /* Frische */
    var stale = Array.isArray(o.staleSections) ? o.staleSections.filter(Boolean) : [];
    var penalty = Math.min(15, 5 * stale.length);
    stale.slice(0, 3).forEach(function (s) { gaps.push({ id: 'stale_' + s, weight: 5, label: (SECTION_DE[s] || s) + ' prüfen', sectionId: s, hint: 'Länger nicht bestätigt — noch aktuell?' }); });

    var score = Math.max(0, Math.min(100, Math.round(raw - penalty)));
    var band = BANDS.filter(function (b) { return score >= b[0]; })[0][1];
    gaps.sort(function (a, b) { return b.weight - a.weight; });
    return { version: VERSION, score: score, band: band, parts: parts, penalty: penalty, gaps: gaps, weights: W };
  }

  var api = { VERSION: VERSION, WEIGHTS: W, compute: compute, SECTION_DE: SECTION_DE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.profileStrength = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
