/* ORVIA · readinessRepository — readiness_baselines / _scores / _components */
(function () {
  const O = window.ORVIA, B = O.repoBase;

  O.repos.readiness = {
    async getBaselines() {
      return B.selectAll('readiness_baselines');
    },
    async saveBaseline(metric, b) {
      return B.upsert('readiness_baselines', {
        metric: metric,
        rolling_median: b.median != null ? b.median : null,
        robust_scale: b.scale != null ? b.scale : null,
        valid_days: b.validDays || 0,
        maturity: b.maturity || 'none',
        window_days: b.windowDays || null,
        computed_at: new Date().toISOString()
      }, 'user_id,metric');
    },
    async saveBaselines(list) {
      return B.upsertMany('readiness_baselines',
        list.map(x => ({
          metric: x.metric, rolling_median: x.median, robust_scale: x.scale,
          valid_days: x.validDays || 0, maturity: x.maturity || 'none',
          window_days: x.windowDays || null, computed_at: new Date().toISOString()
        })), 'user_id,metric');
    },
    // Score + Komponenten transaktionsnah: erst Score upserten, dann Komponenten ersetzen.
    async saveScore(date, score, components) {
      const sres = await B.upsert('readiness_scores', {
        local_date: date,
        score: score.score != null ? score.score : null,
        confidence: score.confidence || null,
        safety_status: score.safety || null,
        load_status: score.load || 'unknown',
        planned_session: score.planned || null,
        recommendation: score.recommendation || null,
        engine_version: score.engine || 'v2'
      }, 'user_id,local_date,engine_version');
      if (!sres.ok) return sres;
      const scoreId = sres.data && sres.data.id;
      if (scoreId && Array.isArray(components) && components.length) {
        // alte Komponenten dieses Scores entfernen, dann neu schreiben (idempotent)
        try { await B.sb().from('readiness_components').delete()
          .eq('user_id', B.currentUserId()).eq('readiness_score_id', scoreId); } catch (e) {}
        const rows = components.map(c => ({
          readiness_score_id: scoreId, component: c.name,
          raw_value: c.raw != null ? c.raw : null, normalized_value: c.norm != null ? c.norm : null,
          weight: c.weight != null ? c.weight : null, contribution: c.contribution != null ? c.contribution : null,
          data_quality: c.quality || 'ok', reason: c.reason || null
        }));
        const cres = await B.upsertMany('readiness_components', rows);
        if (!cres.ok) return cres;
      }
      return B.ok(sres.data);
    },
    async listScores(fromDate) {
      return B.selectAll('readiness_scores', {
        order: { column: 'local_date', ascending: false }, limit: 60
      });
    }
  };
})();
