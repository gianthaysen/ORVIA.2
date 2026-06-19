/* ============================================================
   ORVIA · migrate-blob — idempotente Migration localStorage-Blob → Tabellen
   Liest gian_checkins_v2 (DB) + orvia_profile_v1 (PROFILE), schreibt über die
   Repositories in die neuen Tabellen. Wiederholbar (Upserts auf Natur-Keys),
   protokolliert Status in public.orvia_migrations. Löscht den Blob NICHT.
   ============================================================ */
(function () {
  const O = window.ORVIA;

  async function getStatus() {
    if (!O.sb || !O.user) return null;
    try {
      const { data } = await O.sb.from('orvia_migrations').select('*')
        .eq('user_id', O.user.id).maybeSingle();
      return data || null;
    } catch (e) { return null; }
  }

  async function setStatus(status, report, blobLegacy) {
    if (!O.sb || !O.user) return;
    try {
      await O.sb.from('orvia_migrations').upsert({
        user_id: O.user.id, status: status, report: report || {},
        blob_legacy: !!blobLegacy,
        migrated_at: (status === 'completed' || status === 'completed_with_warnings') ? new Date().toISOString() : null
      }, { onConflict: 'user_id' });
    } catch (e) {}
  }

  function readBlobDB() {
    try { const raw = localStorage.getItem('gian_checkins_v2'); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return null; } // null = korrupt
  }
  function readProfile() {
    try { const raw = localStorage.getItem('orvia_profile_v1'); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function isDay(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }

  // Hauptlauf. force=true ignoriert 'completed' und migriert erneut (idempotent).
  async function run(opts) {
    opts = opts || {};
    if (!O.sb || !O.user) return { ok: false, error: 'no_session' };
    const report = { profile: {}, checkins: {}, load: {}, goals: {}, warnings: [] };

    const prev = await getStatus();
    if (prev && prev.status === 'completed' && !opts.force) {
      return { ok: true, skipped: true, status: 'completed' };
    }
    await setStatus('in_progress', report, false);

    const blob = readBlobDB();
    if (blob === null) {
      report.warnings.push('Blob korrupt/ungültig — übersprungen, Original bleibt erhalten.');
      await setStatus('failed', report, false);
      return { ok: false, error: 'corrupt_blob', report: report };
    }
    const profile = readProfile();

    // 1) Profil
    try {
      if (profile) {
        const r = await O.repos.profile.save({
          name: profile.name, age: profile.age, sex: profile.sex,
          heightCm: profile.heightCm, weightKg: profile.weightKg,
          // WICHTIG: nur GEMESSENE Werte übernehmen. Defaults (190/60) sind KEINE Messung.
          hfMaxMeasured: (profile.hfMaxMeasured != null ? profile.hfMaxMeasured : null),
          restingHrMeasured: (profile.restingHrMeasured != null ? profile.restingHrMeasured : null),
          sleepGoalH: profile.sleepGoalH, timezone: profile.timezone
        });
        report.profile = r.ok ? { migrated: 1 } : { error: r.error };
        if (!r.ok) report.warnings.push('Profil: ' + (r.error && r.error.message));
      } else report.profile = { migrated: 0, note: 'kein Profil im Blob' };
    } catch (e) { report.warnings.push('Profil-Exception: ' + e); }

    // 2) Check-ins (morning) + 3) Trainingslast (sessions)
    const days = Object.keys(blob).filter(isDay);
    const checkinRows = [], loadRows = [];
    days.forEach(d => {
      const e = blob[d] || {};
      if (e.morning && Object.keys(e.morning).length) {
        checkinRows.push(O.repos.checkin.toRow(d, 'morning', e.morning));
      }
      if (e.eve && Object.keys(e.eve).length) {
        checkinRows.push(O.repos.checkin.toRow(d, 'evening', e.eve));
      }
      if (e.sessions) {
        Object.keys(e.sessions).forEach(sp => {
          if (sp === '_ts') return;
          const s = e.sessions[sp]; if (!s || typeof s !== 'object') return;
          // Deterministische Client-ID: Blob hat genau eine Einheit je Tag/Sportart →
          // 'blob:<date>:<sport>' macht die Migration idempotent (kein Insert-Duplikat).
          const sid = s.client_session_id || ('blob:' + d + ':' + sp);
          loadRows.push(O.repos.trainingLoad.toRow(d, sp, Object.assign({}, s, { client_session_id: sid })));
        });
      }
    });

    try {
      let cOk = 0;
      for (let i = 0; i < checkinRows.length; i += 200) {
        const r = await O.repos.checkin.saveMany(checkinRows.slice(i, i + 200));
        if (r.ok) cOk += (r.data || []).length; else report.warnings.push('Checkins-Batch: ' + (r.error && r.error.message));
      }
      report.checkins = { found: checkinRows.length, migrated: cOk };
    } catch (e) { report.warnings.push('Checkins-Exception: ' + e); }

    try {
      const r = await O.repos.trainingLoad.saveMany(loadRows);
      report.load = r.ok ? { found: loadRows.length, migrated: (r.data || []).length } : { error: r.error };
      if (!r.ok) report.warnings.push('Load: ' + (r.error && r.error.message));
    } catch (e) { report.warnings.push('Load-Exception: ' + e); }

    // 4) Ziele aus Profil (primär + sekundär), idempotent über title
    try {
      if (profile && (profile.primaryGoal || (profile.secondaryGoals || []).length)) {
        const goals = [];
        if (profile.primaryGoal) goals.push({
          clientGoalId: 'blob:primary:' + profile.primaryGoal,
          type: profile.primaryGoal, title: profile.primaryGoalLabel || profile.primaryGoal,
          targetDate: profile.raceDate || null, priority: 'primary', status: 'active'
        });
        (profile.secondaryGoals || []).forEach(g => {
          const gt = typeof g === 'string' ? g : (g.type || null);
          goals.push({
            clientGoalId: 'blob:secondary:' + (gt || 'x'),
            type: gt, title: typeof g === 'string' ? g : (g.title || g.type),
            priority: 'secondary', status: 'active'
          });
        });
        let gOk = 0;
        for (const g of goals) { const r = await O.repos.goal.save(g); if (r.ok) gOk++; }
        report.goals = { found: goals.length, migrated: gOk };
      } else report.goals = { migrated: 0 };
    } catch (e) { report.warnings.push('Goals-Exception: ' + e); }

    const status = report.warnings.length ? 'completed_with_warnings' : 'completed';
    // Blob als Legacy markieren, aber NICHT löschen (Fallback bleibt).
    await setStatus(status, report, true);
    return { ok: true, status: status, report: report };
  }

  O.blobMigration = { run, getStatus };
})();
