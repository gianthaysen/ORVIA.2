/* ORVIA · profileRepository — user_profiles (primäre Quelle für Identitäts-/Körperdaten) */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  O.repos = O.repos || {};
  if (!O.repoBase) { console.error('profileRepository: repoBase fehlt (Script-Reihenfolge prüfen)'); return; }
  const B = O.repoBase;

  O.repos.profile = {
    async get() {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        const { data, error } = await B.sb().from('user_profiles')
          .select('*').eq('user_id', B.currentUserId()).maybeSingle();
        if (error) return B.fail('query_failed', error.message);
        // Kein Datensatz → ERFOLG mit data:null, source 'empty'.
        return B.ok(data || null, { source: data ? 'supabase' : 'empty' });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    // Upsert auf PK user_id (stampUser erzwingt eigene user_id). null wird korrekt gespeichert.
    // birth_date primär; age_estimate nur ohne Geburtsdatum. hf_max/resting_hr/sleep_goal_h/timezone
    // bleiben NULL, wenn nicht gesetzt — keine globalen Defaults als Nutzerdaten.
    async save(profile) {
      profile = profile || {};
      const extra = {};
      // P9: 0013-Spalte nur senden, wenn belegt — kompatibel mit Instanzen ohne 0013.
      if (profile.constraintsAcknowledgedAt != null) extra.constraints_acknowledged_at = profile.constraintsAcknowledgedAt;
      return B.upsert('user_profiles', Object.assign(extra, {
        name: profile.name ?? null,
        birth_date: profile.birthDate ?? null,
        age_estimate: profile.birthDate ? null : (profile.ageEstimate ?? null),
        sex: profile.sex ?? null,
        height_cm: profile.heightCm ?? null,
        weight_kg: profile.weightKg ?? null,
        hf_max: profile.hfMaxMeasured ?? null,
        resting_hr: profile.restingHrMeasured ?? null,
        sleep_goal_h: profile.sleepGoalH ?? null,
        timezone: profile.timezone ?? null
      }), 'user_id');
    }
  };
})();
