/* ============================================================
   ORVIA · readiness-source — Readiness aus den NEUEN Tabellen
   Baut den ctx für Calc.readiness aus daily_checkins (serverseitig, user-isoliert)
   mit robusten persönlichen Baselines (rollierender Median + MAD).
   Regeln: keine globalen/fremden Fallbacks, keine HFmax-190-Annahme, Cold-Start
   senkt Konfidenz (nicht Score), Safety-Cap aus Calc bleibt unverändert.
   ============================================================ */
(function () {
  const O = window.ORVIA;

  function median(a) { const x = a.filter(v => v != null && !isNaN(v)).sort((p, q) => p - q); if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; }
  function mad(a, med) { if (med == null) return null; const dev = a.filter(v => v != null && !isNaN(v)).map(v => Math.abs(v - med)); const m = median(dev); return m != null ? m * 1.4826 : null; } // robuste SD

  function maturity(n) {
    if (n >= 28) return 'established'; if (n >= 14) return 'good';
    if (n >= 7) return 'medium'; if (n >= 3) return 'provisional'; return 'none';
  }

  // checkins: chronologisch aufsteigend [{local_date,resting_hr,hrv_ms,hrv_status,sleep_minutes,...}]
  function buildBaselines(checkins, sleepGoalH) {
    const last28 = checkins.slice(-28);
    const rhr = last28.map(c => c.resting_hr).filter(v => v != null);
    const lnHrv = last28.map(c => c.hrv_ms).filter(v => v != null && v > 0).map(v => Math.log(v));
    const lnHrv7 = lnHrv.slice(-7);
    const sleep7 = checkins.slice(-7).map(c => c.sleep_minutes).filter(v => v != null).map(v => v / 60);

    const rhrMed = rhr.length >= 7 ? median(rhr) : null;       // erst ab 7 eigenen Tagen
    const hrvBase7 = lnHrv7.length >= 4 ? (lnHrv7.reduce((s, v) => s + v, 0) / lnHrv7.length) : null;
    const hrvSd28 = lnHrv.length >= 2 ? mad(lnHrv, median(lnHrv)) : null;
    const goal = sleepGoalH || 8;
    const sleepDebt = sleep7.length >= 4 ? Math.max(0, sleep7.reduce((s, v) => s + (goal - v), 0)) : null;

    return {
      ctx: {
        rhrBase: rhrMed,
        hrvBase7: hrvBase7, hrvSd28: hrvSd28, hrvN: lnHrv.length,
        sleepDebtH: sleepDebt, hrvLowStreak: 0
      },
      persisted: [
        { metric: 'rhr', median: rhrMed, scale: mad(rhr, rhrMed), validDays: rhr.length, maturity: maturity(rhr.length), windowDays: 28 },
        { metric: 'hrv_ln', median: hrvBase7, scale: hrvSd28, validDays: lnHrv.length, maturity: maturity(lnHrv.length), windowDays: 28 }
      ],
      validDays: checkins.length
    };
  }

  // Lädt Check-ins der letzten 35 Tage, baut ctx, persistiert Baselines.
  async function loadCtx(forDate) {
    if (!O.repos || !O.repos.checkin) return { ctx: {}, confidence: 'low', validDays: 0 };
    const from = new Date(); from.setDate(from.getDate() - 35);
    const fromStr = new Date(from.getTime() - from.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const res = await O.repos.checkin.listRange(fromStr, forDate);
    if (!res.ok) return { ctx: {}, confidence: 'low', validDays: 0, error: res.error };
    const morning = (res.data || []).filter(c => c.checkin_type === 'morning');
    const sleepGoal = (O.profileCache && O.profileCache.sleep_goal_h) || 8;
    const b = buildBaselines(morning, sleepGoal);
    try { if (O.repos.readiness) await O.repos.readiness.saveBaselines(b.persisted); } catch (e) {}
    // Konfidenz hängt an Baseline-Reife, NICHT am Score.
    const conf = b.validDays >= 14 ? 'high' : b.validDays >= 7 ? 'medium' : 'low';
    return { ctx: b.ctx, confidence: conf, validDays: b.validDays };
  }

  // Score für einen Tag berechnen (Calc bleibt die reine Engine) + persistieren.
  async function computeAndStore(forDate, morning, plannedSession) {
    const src = await loadCtx(forDate);
    const r = window.Calc.readiness(morning, src.ctx);         // Safety-Cap intern erhalten
    const amp = window.Calc.ampel ? window.Calc.ampel(morning, r, src.ctx) : null;
    const score = {
      score: r.score, confidence: src.confidence,
      safety: amp ? (amp.c === 'r' ? 'red' : amp.c === 'y' ? 'orange' : 'green') : null,
      load: 'unknown', planned: plannedSession || null,
      recommendation: amp ? (amp.c === 'r' ? 'rest' : amp.c === 'y' ? 'reduce' : 'perform') : null,
      engine: 'v2'
    };
    const components = (r.parts || []).map(p => ({
      name: p[0], norm: p[1], weight: p[2],
      contribution: Math.round(p[1] * p[2]), quality: 'ok'
    }));
    try { if (O.repos.readiness) await O.repos.readiness.saveScore(forDate, score, components); } catch (e) {}
    return { readiness: r, confidence: src.confidence, validDays: src.validDays };
  }

  O.readinessSource = { loadCtx, computeAndStore, buildBaselines };
})();
