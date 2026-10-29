/* ORVIA · profileRepository — user_profiles (primäre Quelle für Identitäts-/Körperdaten) */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  O.repos = O.repos || {};
  if (!O.repoBase) { console.error('profileRepository: repoBase fehlt (Script-Reihenfolge prüfen)'); return; }
  const B = O.repoBase;

  /* ============================================================
     K1 (2026-10-28) · Profil → user_profiles-Zeile, EINE Umwandlung für Online UND Offline.
     BEFUND: Der Editor „Persönliche Grunddaten" speichert ein leeres Geburtsdatum als ''
     (profile.js SECTION_DEFS.personal.write). `'' ?? null` bleibt '' → Postgres lehnt ''
     für die date-Spalte birth_date ab → der GESAMTE Upsert scheitert (Name, Ort, Körper,
     Regeneration, Präferenzen). Lokal stand trotzdem „Gespeichert"; beim nächsten Start
     überschrieb die Tabelle („Tabelle gewinnt") alles mit dem alten Stand.
     Live belegt am Konto der Testerin: user_profiles 19 min älter als der Blob, Name leer.
     REGEL: leer/whitespace/ungültig → null. Gültige Werte bleiben exakt erhalten.
     Rein, nicht mutierend; der lokale PROFILE-Blob bleibt unverändert. */
  function _txt(v) { if (v == null) return null; var t = String(v).trim(); return t === '' ? null : t; }
  function _num(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
    return (typeof n === 'number' && isFinite(n)) ? n : null;
  }
  function _int(v) { var n = _num(v); return n == null ? null : Math.round(n); }
  function _date(v) {
    var t = _txt(v); if (t == null) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
    return (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) ? m[0] : null;
  }
  function _obj(v) { return (v && typeof v === 'object') ? v : null; }
  /* K1b (2026-10-29): DREI Schreibweisen fuer das Geschlecht im Code — Onboarding 'female'/
     'male'/'diverse', Profil-Editor 'w'/'m'/'d', DB-Constraint up_ranges nur 'm'/'f'/'d'/''.
     'w' oder 'female' liessen den GESAMTEN Upsert scheitern (Name, Datum, Regeneration …).
     Hier, an der DB-Grenze, auf die DB-Codes abbilden; Unbekanntes → null statt Totalausfall. */
  var SEX_DB = { m: 'm', male: 'm', 'männlich': 'm', maennlich: 'm', mann: 'm',
                 f: 'f', w: 'f', female: 'f', weiblich: 'f', frau: 'f',
                 d: 'd', diverse: 'd', divers: 'd' };
  function _sex(v) { var t = _txt(v); if (t == null) return null; var k = SEX_DB[t.toLowerCase()]; return k || null; }
  function toRow(profile) {
    profile = profile || {};
    var birth = _date(profile.birthDate);
    var row = {
      name: _txt(profile.name),
      birth_date: birth,
      age_estimate: birth ? null : _int(profile.ageEstimate),
      sex: _sex(profile.sex),
      height_cm: _num(profile.heightCm),
      weight_kg: _num(profile.weightKg),
      hf_max: _int(profile.hfMaxMeasured),
      resting_hr: _int(profile.restingHrMeasured),
      sleep_goal_h: _num(profile.sleepGoalH),
      timezone: _txt(profile.timezone),
      location: _txt(profile.location),
      avatar_path: _txt(profile.avatarPath),
      recovery: _obj(profile.recovery),
      preferences: _obj(profile.preferences),
      handle: _txt(profile.handle),
      bio: _txt(profile.bio)
    };
    /* P9: 0013-Spalte nur senden, wenn belegt — kompatibel mit Instanzen ohne 0013. */
    var ack = _txt(profile.constraintsAcknowledgedAt);
    if (ack != null) row.constraints_acknowledged_at = ack;
    return row;
  }

  O.repos.profile = {
    toRow: toRow,
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
      return B.upsert('user_profiles', toRow(profile), 'user_id');
    }
  };
})();
