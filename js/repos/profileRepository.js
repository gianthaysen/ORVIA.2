/* ORVIA · profileRepository — user_profiles */
(function () {
  const O = window.ORVIA, B = O.repoBase;
  O.repos.profile = {
    async get() {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true });
      try {
        const { data, error } = await B.sb().from('user_profiles')
          .select('*').eq('user_id', B.currentUserId()).maybeSingle();
        if (error) return B.fail('query_failed', error.message);
        return B.ok(data || null);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    // Upsert auf PK user_id. HFmax/Ruhepuls NUR setzen, wenn gemessen (sonst NULL lassen).
    async save(profile) {
      return B.upsert('user_profiles', {
        name: profile.name || null,
        birth_date: profile.birthDate || null,
        age: profile.age != null ? profile.age : null,
        sex: profile.sex || null,
        height_cm: profile.heightCm != null ? profile.heightCm : null,
        weight_kg: profile.weightKg != null ? profile.weightKg : null,
        hf_max: profile.hfMaxMeasured != null ? profile.hfMaxMeasured : null,
        resting_hr: profile.restingHrMeasured != null ? profile.restingHrMeasured : null,
        sleep_goal_h: profile.sleepGoalH != null ? profile.sleepGoalH : 8,
        timezone: profile.timezone || 'Europe/Berlin'
      }, 'user_id');
    }
  };
})();
