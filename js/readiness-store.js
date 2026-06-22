/* ============================================================
   ORVIA · readiness-store — Persistenz der täglichen Readiness (Phase 3, gehärtet)
   Speichert die PHYSIOLOGISCHE Morgen-Readiness (Calc.readiness, OHNE Load-Cap/Decision/
   Live-Pre-Post) + nachvollziehbare Komponenten + persönliche Baselines.
   Contribution = norm·weight/ΣW  (verifiziert: weight ist ein ROHES Integer-Gewicht in
   Calc.readiness, Score = Σ(norm·weight)/ΣW → Summe der Contributions ≈ Score; NICHT /100).
   Offline: nur der Score wird gequeued; Komponenten (FK auf Score-id) und Baselines
   (brauchen Tabellendaten) werden bewusst auf den nächsten Online-Lauf verschoben.
   Verbindliches Ergebnisformat {success,data,error,source,sync_status}.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  O.readinessHistory = O.readinessHistory || {};
  O.baselineState = O.baselineState || { status: 'insufficient', perMetric: {} };

  function res(success, data, error, source, sync_status) {
    return { success: success, data: data == null ? null : data, error: error || null, source: source, sync_status: sync_status };
  }
  function confFromStatus(s) { return s === 'active' ? 'high' : s === 'building' ? 'medium' : 'low'; }
  function r1(x) { return Math.round(x * 10) / 10; }

  function rawFor(name, m) {
    m = m || {};
    switch (name) {
      case 'Knie': return m.knee;
      case 'HRV': return m.hrvMs;
      case 'Befinden': return m.feel;
      case 'Schlaf-Konto': return m.sleepMin != null ? r1(m.sleepMin / 60) : null;
      case 'Schlafdauer': return m.sleepMin;
      case 'Schlafqualität': return m.sleepQ;
      case 'Ruhepuls': return m.rhr;
      case 'DOMS': return m.doms;
      case 'Body Battery': return m.bb;
      default: return null;
    }
  }
  function reasonFor(name, m, ctx) {
    ctx = ctx || {}; m = m || {};
    if (name === 'Ruhepuls' && m.rhr != null && ctx.rhrBase != null) {
      const dev = m.rhr - ctx.rhrBase;
      return 'Ruhepuls ' + m.rhr + ' vs. Baseline ' + Math.round(ctx.rhrBase) + ' (' + (dev >= 0 ? '+' : '') + dev.toFixed(0) + ')';
    }
    if (name === 'HRV' && m.hrvMs != null && ctx.hrvBase7 != null) return 'HRV ' + m.hrvMs + ' ms vs. Baseline ~' + Math.round(Math.exp(ctx.hrvBase7)) + ' ms';
    if (name === 'HRV' && m.hrv) return 'Garmin-HRV-Status: ' + m.hrv;
    return null;
  }

  // parts = [[name, normScore(0–100), weight], ...]. Contribution = Anteil am Score (Σ ≈ Score).
  function buildComponents(parts, m, ctx) {
    parts = parts || [];
    const W = parts.reduce((s, p) => s + (p[2] || 0), 0) || 1;
    return parts.map(function (p) {
      const name = p[0], norm = p[1], weight = p[2];
      const raw = rawFor(name, m);
      return {
        name: name, raw: raw != null ? raw : null, norm: norm,
        weight: weight, contribution: r1(norm * weight / W),
        quality: (raw == null && name !== 'Stress') ? 'derived' : 'ok',
        reason: reasonFor(name, m, ctx)
      };
    });
  }

  function indexBaselines(list) {
    const out = {};
    (list || []).forEach(function (b) { out[b.metric] = { median: b.median != null ? b.median : (b.rolling_median != null ? b.rolling_median : null), validDays: b.validDays != null ? b.validDays : (b.valid_days || 0), maturity: b.maturity }; });
    return out;
  }
  function perMetricValidDays(idx) { const o = {}; Object.keys(idx || {}).forEach(k => { o[k] = idx[k].validDays || 0; }); return o; }

  async function persistForDay(date, headlineR, morning, ctx) {
    if (!date || !headlineR || headlineR.score == null) return res(true, { skipped: true }, null, 'empty', 'synced');
    if (!O.repos || !O.repos.readiness) return res(false, null, { message: 'Readiness-Repository fehlt' }, 'empty', 'failed');
    if (!O.user || !O.user.id) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');

    const online = !(O.repoBase && O.repoBase.online && O.repoBase.online() === false);

    if (!online) {
      // OFFLINE: nur den Score queuen. Komponenten (FK auf Score-id) + Baselines (Tabellendaten)
      // werden auf den nächsten Online-Lauf verschoben — kein Scheinerfolg dafür.
      if (!O.offlineQueue) return res(false, null, { message: 'Offline-Queue nicht verfügbar' }, 'indexeddb', 'failed');
      const status = (O.baselineState && O.baselineState.status) || 'insufficient';
      const row = { user_id: O.user.id, local_date: date, score: headlineR.score, confidence: confFromStatus(status), engine_version: 'v2' };
      try {
        const q = await O.offlineQueue.enqueue('readiness_scores', row, 'user_id,local_date,engine_version');
        if (q && q.success === false) return res(false, null, q.error || { message: 'Queue-Schreiben fehlgeschlagen' }, 'indexeddb', 'failed');
        O.readinessHistory[date] = { local_date: date, score: headlineR.score, confidence: row.confidence };
        return res(true, { score: headlineR.score, confidence: row.confidence, baselineStatus: status, componentsDeferred: true, baselinesDeferred: true }, null, 'indexeddb', 'pending');
      } catch (e) { return res(false, null, { message: String(e && e.message || e) }, 'indexeddb', 'failed'); }
    }

    // ONLINE: Baselines aktualisieren (Status für Confidence) → Score + Komponenten speichern.
    let status = (O.baselineState && O.baselineState.status) || 'insufficient';
    try {
      if (O.readinessSource && O.readinessSource.refreshBaselines) {
        const rb = await O.readinessSource.refreshBaselines(date);
        if (rb && rb.status) { status = rb.status; O.baselineState = { status: rb.status, perMetric: rb.perMetric || {} }; }
      }
    } catch (e) { /* Baseline-Fehler darf Score-Persistenz nicht blockieren */ }

    const components = buildComponents(headlineR.parts, morning, ctx);
    let r;
    try { r = await O.repos.readiness.saveScore(date, { score: headlineR.score, confidence: confFromStatus(status), engine: 'v2' }, components); }
    catch (e) { return res(false, null, { message: String(e && e.message || e) }, 'supabase', 'failed'); }

    if (r && r.success) {
      O.readinessHistory[date] = { local_date: date, score: headlineR.score, confidence: confFromStatus(status) };
      return res(true, { score: headlineR.score, confidence: confFromStatus(status), baselineStatus: status }, null, r.source || 'supabase', r.sync_status || 'synced');
    }
    return res(false, null, (r && r.error) || { message: 'Speichern fehlgeschlagen' }, (r && r.source) || 'supabase', (r && r.sync_status) || 'failed');
  }

  async function hydrateRecentScores(days) {
    if (!O.repos || !O.repos.readiness) return res(false, null, { message: 'Readiness-Repository fehlt' }, 'empty', 'failed');
    let scored = 0;
    try {
      const r = await O.repos.readiness.listScores();
      if (r && r.success) { O.readinessHistory = {}; (r.data || []).forEach(function (row) { if (row && row.local_date) { O.readinessHistory[row.local_date] = row; scored++; } }); }
      else if (r && !r.success) return res(false, null, r.error, r.offline ? 'indexeddb' : 'supabase', r.offline ? 'pending' : 'failed');
    } catch (e) { return res(false, null, { message: String(e) }, 'supabase', 'failed'); }
    // Baseline-Status aus den per-Metrik-validen Tagen der KERNMETRIKEN (nicht max()).
    try {
      const b = await O.repos.readiness.getBaselines();
      if (b && b.success) {
        const idx = indexBaselines(b.data);
        const perMetric = perMetricValidDays(idx);
        const status = (O.readinessSource && O.readinessSource.statusFromBaselines) ? O.readinessSource.statusFromBaselines(perMetric) : 'insufficient';
        O.baselineState = { status: status, perMetric: perMetric };
      }
    } catch (e) {}
    return res(true, { scored: scored, baselineStatus: O.baselineState.status }, null, 'supabase', 'synced');
  }

  function getBaselineStatus() { return (O.baselineState && O.baselineState.status) || 'insufficient'; }
  function getScoreFor(date) { return O.readinessHistory[date] || null; }

  O.readinessStore = { persistForDay, hydrateRecentScores, getBaselineStatus, getScoreFor, buildComponents };
})();
