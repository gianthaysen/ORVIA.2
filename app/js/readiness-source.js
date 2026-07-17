/* ============================================================
   ORVIA · readiness-source — persönliche Baselines aus daily_checkins (Phase 3, gehärtet)
   Robuste Statistik (rollierender Median + MAD) über echte Nutzerdaten.
   - Median (robust) je Metrik; HRV als Log-Median (Werte ≤0/null/NaN ignoriert).
   - Persönliche Baseline erst ab MIN_POINTS=7 validen Tagen JE METRIK (sonst null).
   - Gesamt-Status aus den VALIDEN Tagen der KERNMETRIKEN (HRV, Ruhepuls, Schlafdauer),
     nicht aus checkins.length und nicht aus Math.max() einzelner Metriken.
   - Fenster relativ zu forDate (historische Re-Berechnung deterministisch).
   Regeln: keine Demo-Werte, keine globalen Fallbacks; fehlende Historie senkt Confidence,
   nie den Score. Manuelle Baselines wachsen langsam bis zur Wearable-Integration (spätere Phase).
   ============================================================ */
(function () {
  const O = window.ORVIA;

  function median(a) { const x = a.filter(v => v != null && !isNaN(v)).sort((p, q) => p - q); if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; }
  function mad(a, med) { if (med == null) return null; const dev = a.filter(v => v != null && !isNaN(v)).map(v => Math.abs(v - med)); const m = median(dev); return m != null ? m * 1.4826 : null; }
  function maturity(n) {
    if (n >= 28) return 'established'; if (n >= 14) return 'good';
    if (n >= 7) return 'medium'; if (n >= 3) return 'provisional'; return 'none';
  }
  const WINDOW = 28;     // rollierendes Fenster (Tage)
  const MIN_POINTS = 7;  // Mindest-Datenpunkte je Metrik für eine persönliche Baseline
  const CORE_METRICS = ['hrv_ln', 'rhr', 'sleep_min'];

  // Robuste Baseline einer numerischen Reihe. Median erst ab MIN_POINTS gültigen Tagen.
  function baselineOf(metric, values) {
    const n = values.length;
    const med = n >= MIN_POINTS ? median(values) : null;
    return { metric: metric, median: med, scale: med != null ? mad(values, med) : null,
      validDays: n, maturity: maturity(n), windowDays: WINDOW };
  }

  // checkins: chronologisch aufsteigend (morning-Zeilen aus daily_checkins, bereits gefenstert).
  // Liefert ctx (für die Live-Engine), persisted[] (Baseline je Metrik) und perMetric-validDays.
  function buildBaselines(checkins, sleepGoalH) {
    const last = (checkins || []).slice(-WINDOW);
    const col = (k) => last.map(c => c[k]).filter(v => v != null && !isNaN(v));
    const rhr = col('resting_hr');
    const lnHrv = last.map(c => c.hrv_ms).filter(v => v != null && !isNaN(v) && v > 0).map(v => Math.log(v));
    const lnHrv7 = lnHrv.slice(-7);
    const sleepMinV = col('sleep_minutes');
    const sleepQV = col('sleep_quality');
    const bbV = col('body_battery');
    const feelV = col('feel');
    const legsV = col('leg_strength');
    const domsV = col('doms');
    const sleep7 = (checkins || []).slice(-7).map(c => c.sleep_minutes).filter(v => v != null && !isNaN(v)).map(v => v / 60);

    // Live-ctx: hrvBase7 = Log-Mittel der letzten 7 (Calc.readiness-SWC erwartet das); rhrBase = Median.
    const rhrMed = rhr.length >= MIN_POINTS ? median(rhr) : null;
    const hrvBase7 = lnHrv7.length >= 4 ? (lnHrv7.reduce((s, v) => s + v, 0) / lnHrv7.length) : null;
    const hrvSd28 = lnHrv.length >= 2 ? mad(lnHrv, median(lnHrv)) : null;
    const goal = sleepGoalH || 8;
    const sleepDebt = sleep7.length >= 4 ? Math.max(0, sleep7.reduce((s, v) => s + (goal - v), 0)) : null;

    // Persistierte Baselines: durchgängig robuster (Log-)Median + MAD, Gate MIN_POINTS.
    const hrvBaseline = baselineOf('hrv_ln', lnHrv); // Log-Median (robust), nicht das Live-Log-Mittel
    const persisted = [
      baselineOf('rhr', rhr),
      hrvBaseline,
      baselineOf('sleep_min', sleepMinV),
      baselineOf('sleep_q', sleepQV),
      baselineOf('body_battery', bbV),
      baselineOf('feel', feelV),
      baselineOf('leg_strength', legsV),
      baselineOf('doms', domsV)
    ];
    const perMetric = {};
    persisted.forEach(b => { perMetric[b.metric] = b.validDays; });

    return {
      ctx: { rhrBase: rhrMed, hrvBase7: hrvBase7, hrvSd28: hrvSd28, hrvN: lnHrv.length, sleepDebtH: sleepDebt, hrvLowStreak: 0 },
      persisted: persisted, perMetric: perMetric, validDays: (checkins || []).length
    };
  }

  // Gesamt-Status aus den validen Tagen der KERNMETRIKEN (nicht checkins.length, nicht max()).
  //  active:  ALLE 3 Kernmetriken (HRV, Ruhepuls, Schlafdauer) mit ≥14 validen Tagen
  //           → verhindert „active" bei fehlender HRV trotz solider RHR/Schlaf (konservativ).
  //  building: ≥2 Kernmetriken mit ≥MIN_POINTS validen Tagen
  //  insufficient: sonst
  function statusFromBaselines(perMetric) {
    perMetric = perMetric || {};
    const core = CORE_METRICS.map(m => perMetric[m] || 0);
    const ge14 = core.filter(v => v >= 14).length;
    const ge7 = core.filter(v => v >= MIN_POINTS).length;
    if (ge14 >= 3) return 'active';
    if (ge7 >= 2) return 'building';
    return 'insufficient';
  }
  // Beibehaltene einfache Variante (nur noch intern/Abwärtskompatibilität).
  function statusFromValidDays(validDays) {
    if (validDays >= 14) return 'active'; if (validDays >= MIN_POINTS) return 'building'; return 'insufficient';
  }

  function isDateStr(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return false;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
  }
  // Fenster relativ zu forDate (lokale Datumsarithmetik, kein Systemdatum, keine TZ-Verschiebung).
  function windowStart(forDate, days) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(forDate); if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]); d.setDate(d.getDate() - (days || 35));
    const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + da;
  }

  // Lädt Morgen-Check-ins im Fenster [forDate-35 … forDate], baut Baselines, persistiert sie.
  // Deterministisch (Fenster aus forDate); idempotent (Upsert user_id,metric).
  async function refreshBaselines(forDate) {
    if (!isDateStr(forDate)) return { success: false, status: 'insufficient', validDays: 0, perMetric: {}, error: { code: 'bad_date', message: 'Ungültiges forDate' } };
    if (!O.repos || !O.repos.checkin) return { success: false, status: 'insufficient', validDays: 0, perMetric: {}, error: { message: 'Checkin-Repository fehlt' } };
    const fromStr = windowStart(forDate, 35);
    const res = await O.repos.checkin.listRange(fromStr, forDate);
    if (!res.success) return { success: false, status: 'insufficient', validDays: 0, perMetric: {}, error: res.error, offline: res.offline };
    const morning = (res.data || []).filter(c => c.checkin_type === 'morning').sort((a, b) => (a.local_date < b.local_date ? -1 : 1));
    const sleepGoal = (O.profileStore && O.profileStore.effectiveSleepGoal && O.profileStore.effectiveSleepGoal()) || 8;
    const b = buildBaselines(morning, sleepGoal);
    let saveRes = { success: true };
    try { if (O.repos.readiness) saveRes = await O.repos.readiness.saveBaselines(b.persisted); } catch (e) { saveRes = { success: false, error: { message: String(e) } }; }
    const status = statusFromBaselines(b.perMetric);
    return { success: !!saveRes.success, status: status, validDays: b.validDays, perMetric: b.perMetric, ctx: b.ctx, persisted: b.persisted, error: saveRes.error || null };
  }

  O.readinessSource = { buildBaselines, refreshBaselines, statusFromBaselines, statusFromValidDays, windowStart, median, mad, maturity, WINDOW, MIN_POINTS, CORE_METRICS };
})();
