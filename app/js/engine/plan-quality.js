/* ============================================================
   ORVIA · engine/plan-quality — Planqualitäts-Subscores (Bauplan-Nachtrag v8-316).

   WARUM DIESES MODUL ENTSTEHT: Der Plan-Tab zeigte sechs Kacheln
   (Zielabdeckung · Erholungsverteilung · Belastungsbalance · Zeitmachbarkeit ·
   Sportbalance · Datenqualität) mit dem Literal „—" und Balken auf 0 %. Es
   existierte ausschließlich der VALIDATOR `engine-contracts.isPlanQuality()`,
   der die sechs Feldnamen festschreibt — aber kein Produzent. Der Kommentar
   dort sagt es selbst: das UI darf diese Bereiche erst füllen, wenn ein
   Produzent Objekte liefert, die den Validator bestehen. Das ist dieser
   Produzent.

   ABGRENZUNG ZU `planQualityChecks()` (ui.js): Das bleibt bestehen und liefert
   weiterhin Textwarnungen und die Gesamtnote gut/moderat/riskant. Dieses Modul
   ersetzt es NICHT, sondern beziffert dieselbe Sachlage strukturiert. Wo beide
   dieselbe Regel prüfen (Ruhetag, harte Tage hintereinander), ist die Regel
   bewusst identisch formuliert — zwei abweichende Urteile über denselben Plan
   wären genau die Divergenz, die in v8-307 schon einmal drei Erzeuger für eine
   Prescription hervorgebracht hat.

   REINHEIT (Bauplan §17.1): kein DOM, keine Uhr, kein Zufall, kein Storage.
   `today` und alle Eingaben kommen herein. Gleiche Eingaben ⇒ gleiche Ausgabe.

   ── DIE ENTSCHEIDENDE KONSTRUKTIONSFRAGE ─────────────────────────────────
   Der Validator verlangt für JEDEN der sechs Subscores eine Zahl 0–100. Nicht
   jeder Subscore ist aber immer berechenbar: Sportbalance ist bei einer
   einzigen aktiven Sportart keine schlechte Bewertung, sondern GAR KEINE.
   Zeitmachbarkeit ohne gepflegte Verfügbarkeit ebenso.

   Eine Zahl zu erfinden, wäre die Ersatzheuristik aus §17.2. Deshalb:
     - jeder Subscore trägt zusätzlich `applicable` und `evidence`,
     - nicht anwendbare Subscores bekommen `rating:'insufficient_data'`
       (die Zahl bleibt 0, damit der Vertrag hält — die WAHRHEIT steht im
       rating, und die Oberfläche muss darauf und nicht auf die 0 schauen),
     - `total` wird AUSSCHLIESSLICH über die anwendbaren Subscores gebildet,
       mit neu normierten Gewichten. Ein nicht bewertbarer Bereich zieht die
       Gesamtnote also weder hoch noch runter,
     - sind zu wenige Subscores anwendbar, ist das GANZE Ergebnis
       `status:'insufficient_data'` — und die Oberfläche zeigt keine Note.
   ── ─────────────────────────────────────────────────────────────────────
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'plan-quality@1';
  /* Der Regelstand ist Teil der Ausgabe. Ändert sich eine Schwelle, ändert sich
     dieser Wert — sonst wären zwei Bewertungen aus verschiedenen Ständen nicht
     unterscheidbar (dieselbe Begründung wie beim decisionRuntimeHash). */
  var RULE_VERSION = 'pq-rules@1';

  /* Gewichte. Begründung der Reihenfolge: Erholung und Zeitmachbarkeit sind die
     beiden Größen, deren Verletzung unmittelbar schadet (Überlastung bzw. ein
     Plan, der im Alltag nicht stattfindet). Zielabdeckung folgt, weil ein
     sicherer Plan ohne Zielbezug zwar nicht schadet, aber nicht hinführt. */
  var WEIGHTS = {
    recoveryDistribution: 25,
    timeFeasibility: 22,
    goalCoverage: 20,
    loadBalance: 15,
    sportBalance: 8,
    dataQuality: 10
  };
  var KEYS = ['goalCoverage', 'recoveryDistribution', 'loadBalance',
    'timeFeasibility', 'sportBalance', 'dataQuality'];

  /* Mindestens so viel Gewicht muss bewertbar sein, sonst ist die Gesamtnote
     eine Behauptung über zu wenig. 60 % ist bewusst hoch angesetzt: eine Note
     aus zwei von sechs Bereichen wäre keine Planqualität. */
  var MIN_APPLICABLE_WEIGHT = 60;

  function clamp(n) { return n < 0 ? 0 : n > 100 ? 100 : Math.round(n); }
  function ratingOf(v) { return v >= 80 ? 'gut' : v >= 60 ? 'solide' : v >= 40 ? 'moderat' : 'riskant'; }
  function sc(value, evidence, note) {
    return { value: clamp(value), rating: ratingOf(clamp(value)),
      applicable: true, evidence: evidence || 'moderate', note: note || null };
  }
  function na(reason) {
    return { value: 0, rating: 'insufficient_data', applicable: false,
      evidence: 'unknown', note: reason || null };
  }

  /* ---------- Struktur des Plans: EINE Messung, mehrfach genutzt ---------- */
  /* Bewusst NICHT weekPlanDesigner.qualityOf() aufgerufen: dessen isHard/isRun
     arbeiten auf dem Designer-Sessionmodell, hier liegt der Legacy-Wochenplan
     (Array[7] von {t,l,d}) vor. Die Erkennung wird deshalb hier über die
     ÜBERGEBENEN Prädikate gemacht — der Aufrufer reicht dieselben Funktionen
     durch, die das übrige Produkt benutzt (isHardUnit). Ein zweites eigenes
     Hart-Kriterium hier wäre eine stille zweite Wahrheit. */
  function measure(days, isHard) {
    var m = { sessions: 0, activeDays: 0, restDays: 0, doubleDays: 0,
      hardDays: [], maxPerDay: 0, perDay: [] };
    var hard = typeof isHard === 'function' ? isHard : function () { return false; };
    for (var d = 0; d < 7; d++) {
      var day = (days && days[d]) || [];
      m.perDay.push(day.length);
      m.sessions += day.length;
      if (day.length) m.activeDays++; else m.restDays++;
      if (day.length >= 2) m.doubleDays++;
      if (day.length > m.maxPerDay) m.maxPerDay = day.length;
      var isH = false;
      for (var j = 0; j < day.length; j++) { try { if (hard(day[j])) { isH = true; break; } } catch (e) {} }
      if (isH) m.hardDays.push(d);
    }
    /* Kleinster Abstand zwischen harten Tagen — ZYKLISCH über die Wochengrenze,
       weil Sonntag→Montag physiologisch kein Abstand ist. Genau diesen Fall
       prüft auch planQualityChecks() mit (i+1)%7. */
    m.minGapHard = null;
    if (m.hardDays.length >= 2) {
      var best = 7;
      for (var a = 0; a < m.hardDays.length; a++) {
        for (var b = a + 1; b < m.hardDays.length; b++) {
          var raw = m.hardDays[b] - m.hardDays[a];
          var gap = Math.min(raw, 7 - raw);
          if (gap < best) best = gap;
        }
      }
      m.minGapHard = best;
    }
    return m;
  }

  /* ---------- 1. Erholungsverteilung ---------- */
  /* Zwei Größen, beide aus der bestehenden Regelwelt: mindestens ein Ruhetag,
     und harte Einheiten nicht an aufeinanderfolgenden Tagen. */
  function recoveryScore(m) {
    if (!m.sessions) return na('no_sessions');
    var v = 100;
    var limiting = [];
    if (m.restDays === 0) { v -= 40; limiting.push('no_rest_day'); }
    else if (m.restDays === 1) v -= 5;               /* tragbar, nicht ideal */
    if (m.minGapHard != null) {
      if (m.minGapHard <= 1) { v -= 35; limiting.push('hard_days_adjacent'); }
      else if (m.minGapHard === 2) v -= 5;
    }
    if (m.doubleDays >= 3) { v -= 15; limiting.push('many_double_days'); }
    else if (m.doubleDays === 2) v -= 5;
    return { score: sc(v, 'moderate'), limiting: limiting };
  }

  /* ---------- 2. Zeitmachbarkeit ---------- */
  /* Harte, faktische Prüfung: Passt der Plan in die Tage, die tatsächlich zur
     Verfügung stehen? Ohne gepflegte Verfügbarkeit ist das NICHT bewertbar —
     eine Annahme („wird schon passen") wäre erfunden. */
  function timeScore(m, cfg) {
    var avail = cfg && Array.isArray(cfg.availableDayIdx) ? cfg.availableDayIdx : null;
    var target = cfg && cfg.targetDays > 0 ? cfg.targetDays : null;
    if (!avail || !avail.length) {
      if (target == null) return { score: na('no_availability_config'), limiting: ['availability'] };
      /* Nur Zieltagzahl bekannt: eingeschränkt bewertbar, ehrlich als schwacher Beleg. */
      var d1 = Math.abs(m.activeDays - target);
      return { score: sc(100 - d1 * 18, 'weak', 'nur Zieltagzahl, keine gepflegte Verfügbarkeit'),
        limiting: d1 > 0 ? ['day_count_mismatch'] : [] };
    }
    var lookup = {};
    for (var i = 0; i < avail.length; i++) lookup[avail[i]] = 1;
    var outside = 0;
    for (var d = 0; d < 7; d++) if (m.perDay[d] > 0 && !lookup[d]) outside++;
    var v = 100 - outside * 30;
    var limiting = outside > 0 ? ['sessions_on_unavailable_days'] : [];
    if (target != null) {
      var diff = Math.abs(m.activeDays - target);
      if (diff > 0) { v -= diff * 12; limiting.push('day_count_mismatch'); }
    }
    return { score: sc(v, 'strong'), limiting: limiting };
  }

  /* ---------- 3. Zielabdeckung ---------- */
  /* Ohne Ziel keine Abdeckung — und das ist kein schlechter Plan, sondern eine
     offene Frage. Bewertet wird nur, was das Ziel VERLANGT. */
  function goalScore(days, goal, m, isLong, isHard, level) {
    if (!goal || !goal.type) return { score: na('no_goal'), limiting: ['goal'] };
    var runGoal = goal.distanceKm > 0;
    if (!runGoal) return { score: na('goal_without_distance_model'), limiting: ['goal_model'] };
    if (!m.sessions) return { score: na('no_sessions'), limiting: ['no_sessions'] };
    var hasLong = false, runDays = 0;
    var longFn = typeof isLong === 'function' ? isLong : function () { return false; };
    for (var d = 0; d < 7; d++) {
      var day = (days && days[d]) || [];
      for (var j = 0; j < day.length; j++) {
        var it = day[j];
        var t = String((it && (it.sportId || it.t)) || '').toLowerCase();
        if (t.indexOf('lauf') >= 0 || t.indexOf('run') >= 0) { runDays++; break; }
      }
      for (var k = 0; k < day.length; k++) { try { if (longFn(day[k])) hasLong = true; } catch (e) {} }
    }
    var v = 100, limiting = [];
    if (!hasLong) { v -= 35; limiting.push('no_long_run'); }
    /* Mindestens zwei Lauftage: unter drei Einheiten trägt kein Distanzziel —
       für Anfänger ist zwei die untere, noch vertretbare Grenze. */
    var minRun = level === 'anfaenger' ? 2 : 3;
    if (runDays < minRun) { v -= (minRun - runDays) * 20; limiting.push('too_few_run_days'); }
    /* Qualität nur oberhalb der Anfängerstufe verlangen. */
    if (level !== 'anfaenger' && !m.hardDays.length) { v -= 20; limiting.push('no_quality_session'); }
    return { score: sc(v, 'moderate'), limiting: limiting };
  }

  /* ---------- 4. Belastungsbalance ---------- */
  /* Verteilung über die Woche: sammelt sich alles auf wenigen Tagen? */
  function loadScore(m) {
    if (!m.sessions) return { score: na('no_sessions'), limiting: [] };
    if (m.activeDays < 2) return { score: na('too_few_active_days'), limiting: [] };
    var ideal = m.sessions / m.activeDays;
    var spread = 0;
    for (var d = 0; d < 7; d++) if (m.perDay[d] > 0) spread += Math.abs(m.perDay[d] - ideal);
    var v = 100 - (spread / m.activeDays) * 45;
    var limiting = [];
    if (m.maxPerDay >= 3) { v -= 20; limiting.push('day_overloaded'); }
    return { score: sc(v, 'moderate'), limiting: limiting };
  }

  /* ---------- 5. Sportbalance ---------- */
  /* Bei EINER aktiven Sportart ist das keine schlechte Bewertung, sondern gar
     keine. Genau hier wäre eine erfundene Zahl am schädlichsten: sie würde
     einen reinen Läufer dauerhaft abwerten. */
  /* SPORTARTEN WERDEN NORMALISIERT, NICHT VERGLICHEN. Der erste Entwurf hat
     Teilstrings verglichen ('running' gegen 'Laufen') — das ergab für einen
     Plan MIT Laufeinheit fälschlich „Sportart fehlt im Plan". Es gibt genau
     einen kanonischen Normalisierer im Produkt (trainingDomain.normSportStrict,
     Aliasliste inkl. laufen→running, kraft→gym). Fehlt er, wird NICHT geraten:
     dann ist der Subscore nicht anwendbar. Ein eigenes Mapping hier wäre eine
     zweite Wahrheit — genau das, wovor der Dateikopf warnt. */
  function normSport(v) {
    try {
      if (O.trainingDomain && typeof O.trainingDomain.normSportStrict === 'function')
        return O.trainingDomain.normSportStrict(v);
    } catch (e) {}
    return undefined;   /* undefined = Normalisierer fehlt; null = unbekannte Sportart */
  }
  function sportScore(days, activeSports, m) {
    var sports = Array.isArray(activeSports) ? activeSports.filter(Boolean) : [];
    if (sports.length < 2) return { score: na('single_sport'), limiting: [] };
    if (!m.sessions) return { score: na('no_sessions'), limiting: [] };
    if (normSport('laufen') === undefined)
      return { score: na('no_sport_normalizer'), limiting: [] };
    var seen = {};
    for (var d = 0; d < 7; d++) {
      var day = (days && days[d]) || [];
      for (var j = 0; j < day.length; j++) {
        var key = normSport((day[j] && (day[j].sportId || day[j].t)) || '');
        if (key) seen[key] = (seen[key] || 0) + 1;
      }
    }
    var covered = 0, wanted = 0, unknown = [];
    for (var i = 0; i < sports.length; i++) {
      var k = normSport(sports[i]);
      if (!k) { unknown.push(String(sports[i])); continue; }  /* unbekannt ⇒ nicht mitzählen, nicht abwerten */
      wanted++;
      if (seen[k]) covered++;
    }
    if (wanted < 2) return { score: na('too_few_known_sports'), limiting: unknown.length ? ['unknown_sport'] : [] };
    var v = Math.round((covered / wanted) * 100);
    var limiting = covered < wanted ? ['sport_not_in_plan'] : [];
    return { score: sc(v, 'moderate'), limiting: limiting };
  }

  /* ---------- 6. Datenqualität ---------- */
  /* Der Meta-Subscore: wie viel wusste die Bewertung überhaupt? Er ist IMMER
     anwendbar — die Aussage „wir wissen wenig" ist selbst eine belastbare
     Aussage — und er ist der einzige, der offen macht, wie belastbar der Rest
     ist. */
  function dataScore(input, applicableCount) {
    var have = 0, total = 5, missing = [];
    if (input.goal && input.goal.type) have++; else missing.push('goal');
    if (input.goal && input.goal.targetMin > 0) have++; else missing.push('goal_target');
    if (input.config && Array.isArray(input.config.availableDayIdx) && input.config.availableDayIdx.length) have++;
    else missing.push('availability');
    if (input.performance && input.performance.ok === true) have++; else missing.push('performance_reference');
    if (input.planProvenance && input.planProvenance !== 'generated') have++; else missing.push('persisted_plan');
    var v = Math.round((have / total) * 100);
    return { score: sc(v, have >= 4 ? 'strong' : have >= 2 ? 'moderate' : 'weak'), limiting: missing };
  }

  /* ---------- Zusammenführung ---------- */
  function evaluate(input) {
    var i = input || {};
    var days = Array.isArray(i.days) ? i.days : null;
    var out = {
      version: VERSION, ruleVersion: RULE_VERSION,
      status: 'ok', total: 0, subscores: {}, limitingFactors: [],
      applicableWeight: 0, measured: null
    };
    if (!days || days.length !== 7) {
      out.status = 'insufficient_data';
      out.limitingFactors = ['no_plan'];
      for (var z = 0; z < KEYS.length; z++) out.subscores[KEYS[z]] = na('no_plan');
      return out;
    }
    var m = measure(days, i.isHardUnit);
    out.measured = m;

    var parts = {
      recoveryDistribution: recoveryScore(m),
      timeFeasibility: timeScore(m, i.config),
      goalCoverage: goalScore(days, i.goal, m, i.isLongUnit, i.isHardUnit, i.level),
      loadBalance: loadScore(m),
      sportBalance: sportScore(days, i.activeSports, m)
    };
    var applicableCount = 0;
    for (var k in parts) {
      if (!Object.prototype.hasOwnProperty.call(parts, k)) continue;
      out.subscores[k] = parts[k].score;
      if (parts[k].score.applicable) applicableCount++;
      var lim = parts[k].limiting || [];
      for (var li = 0; li < lim.length; li++) if (out.limitingFactors.indexOf(lim[li]) < 0) out.limitingFactors.push(lim[li]);
    }
    var dq = dataScore(i, applicableCount);
    out.subscores.dataQuality = dq.score;
    for (var di = 0; di < dq.limiting.length; di++)
      if (out.limitingFactors.indexOf('data:' + dq.limiting[di]) < 0) out.limitingFactors.push('data:' + dq.limiting[di]);

    /* Gesamtnote NUR über anwendbare Subscores, Gewichte neu normiert. */
    var wSum = 0, acc = 0;
    for (var ki = 0; ki < KEYS.length; ki++) {
      var key = KEYS[ki], s = out.subscores[key];
      if (!s || !s.applicable) continue;
      wSum += WEIGHTS[key];
      acc += WEIGHTS[key] * s.value;
    }
    out.applicableWeight = wSum;
    if (wSum < MIN_APPLICABLE_WEIGHT) {
      out.status = 'insufficient_data';
      out.total = 0;
      if (out.limitingFactors.indexOf('too_little_evaluable') < 0) out.limitingFactors.push('too_little_evaluable');
      return out;
    }
    out.total = clamp(acc / wSum);
    out.rating = ratingOf(out.total);
    return out;
  }

  var api = { VERSION: VERSION, RULE_VERSION: RULE_VERSION, WEIGHTS: WEIGHTS,
    MIN_APPLICABLE_WEIGHT: MIN_APPLICABLE_WEIGHT, KEYS: KEYS,
    evaluate: evaluate, measure: measure, ratingOf: ratingOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.planQuality = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
