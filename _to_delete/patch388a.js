const fs=require('fs');
function rep(file, from, to, all){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found in '+file+': '+from.slice(0,70)); if(!all && s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,70)); fs.writeFileSync(file, all? s.split(from).join(to) : s.replace(from,to)); }
// normalize
rep('app/js/activity-normalize.js',
`      workoutSessionId: raw.workoutSessionId || raw.workout_session_id || null,
      startedAt: iso(raw.startedAt || raw.started_at),`,
`      workoutSessionId: raw.workoutSessionId || raw.workout_session_id || null,
      /* S2c (v8-388): Kopplung Geraeteaufzeichnung ↔ Workout. Fehlende Spalten
         (Migration 0048 noch nicht angewendet) ⇒ null ⇒ Verhalten wie zuvor. */
      linkedActivityId: raw.linkedActivityId || raw.linked_activity_id || null,
      linkKind: raw.linkKind || raw.link_kind || null,
      startedAt: iso(raw.startedAt || raw.started_at),`);
// config normalizeServerActivity
rep('app/js/activity-config.js',
`      summary: summary, metrics: r.metrics || {}, workoutSnapshot: null, syncStatus: 'synced', _server: true`,
`      summary: summary, metrics: r.metrics || {}, workoutSnapshot: null, syncStatus: 'synced', _server: true,
      linkedActivityId: r.linked_activity_id || null, linkKind: r.link_kind || null`);
// config mergeAllActivities: attach recordings
rep('app/js/activity-config.js',
`    out = out.filter(function (a) { if (!isEmptyActivity(a)) return true; return !nonEmptyDay[normSport(a.sportId) + '|' + dayOfAct(a)]; });
    out.sort(function (a, b) { return String(b.startedAt || b.createdAt || '').localeCompare(String(a.startedAt || a.createdAt || '')); });
    return out;
  }`,
`    out = out.filter(function (a) { if (!isEmptyActivity(a)) return true; return !nonEmptyDay[normSport(a.sportId) + '|' + dayOfAct(a)]; });
    out = attachRecordings(out);
    out.sort(function (a, b) { return String(b.startedAt || b.createdAt || '').localeCompare(String(a.startedAt || a.createdAt || '')); });
    return out;
  }
  /* S2c (v8-388): Gekoppelte Geraeteaufzeichnungen (linkedActivityId) sind keine
     eigenstaendigen Einheiten mehr. Sie werden aus der Liste genommen und dem
     Primaerdatensatz als a.recording angehaengt (HF, Kalorien, Uhr-Dauer). Ist der
     Primaerdatensatz nicht in der Liste (nicht geladen, getombstoned), bleibt die
     Aufzeichnung sichtbar — nichts verschwindet stillschweigend. Pure Funktion. */
  function attachRecordings(list) {
    list = Array.isArray(list) ? list : [];
    var byId = {};
    list.forEach(function (a) { if (a && a.id) byId[a.id] = a; });
    var out = [];
    list.forEach(function (a) {
      if (!a) return;
      var lid = a.linkedActivityId || null;
      if (lid && byId[lid] && byId[lid] !== a) {
        var p = byId[lid];
        if (!p.recording) p.recording = a;
        return;
      }
      out.push(a);
    });
    return out;
  }`);
rep('app/js/activity-config.js',
`    normalizeServerActivity: normalizeServerActivity, mergeAllActivities: mergeAllActivities, activityKeys: activityKeys,`,
`    normalizeServerActivity: normalizeServerActivity, mergeAllActivities: mergeAllActivities, attachRecordings: attachRecordings, activityKeys: activityKeys,`);
// store merge: carry link fields
rep('app/js/activity-store.js',
`        ex.endedAt = n.endedAt || ex.endedAt;`,
`        ex.endedAt = n.endedAt || ex.endedAt;
        ex.linkedActivityId = n.linkedActivityId || null; ex.linkKind = n.linkKind || null;   // S2c: Server ist Quelle der Kopplung`);
rep('app/js/activity-store.js',
`          workoutSessionId: n.workoutSessionId || null,
          startedAt: n.startedAt, endedAt: n.endedAt, durationSeconds: n.durationSeconds,`,
`          workoutSessionId: n.workoutSessionId || null,
          linkedActivityId: n.linkedActivityId || null, linkKind: n.linkKind || null,
          startedAt: n.startedAt, endedAt: n.endedAt, durationSeconds: n.durationSeconds,`);
// repo link/unlink
rep('app/js/repos/activityRepository.js',
`  O.repos = O.repos || {};
  O.repos.activity = { upsertFromSession, upsertManual, list, getById, deleteActivity, deleteWorkout };`,
`  /* S2c (v8-388): Kopplung Geraeteaufzeichnung ↔ Workout ueber RPC (security invoker, RLS). */
  async function linkRecording(primaryId, recordingId) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!primaryId || !recordingId) return b.fail('invalid_id', 'IDs fehlen.', { source: 'empty' });
    if (!b.online()) return b.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await b.sb().rpc('orvia_link_activities', { p_primary: primaryId, p_recording: recordingId });
      if (error) return b.fail('rpc_failed', error.message);
      return b.ok(Array.isArray(data) ? data[0] : data);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }
  async function unlinkRecording(recordingId) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!recordingId) return b.fail('invalid_id', 'ID fehlt.', { source: 'empty' });
    if (!b.online()) return b.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await b.sb().rpc('orvia_unlink_activity', { p_recording: recordingId });
      if (error) return b.fail('rpc_failed', error.message);
      return b.ok(Array.isArray(data) ? data[0] : data);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }
  async function linkCandidate(recordingId) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!b.online()) return b.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await b.sb().rpc('orvia_link_candidate', { p_recording: recordingId, p_tolerance_min: 20 });
      if (error) return b.fail('rpc_failed', error.message);
      return b.ok(data || null);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }

  O.repos = O.repos || {};
  O.repos.activity = { upsertFromSession, upsertManual, list, getById, deleteActivity, deleteWorkout, linkRecording, unlinkRecording, linkCandidate };`);
console.log('ok');
