/* ============================================================
   ORVIA · workout-store — Live-Workout-State-Machine (Phase 4.2a)
   Verwaltet aktive Session, Übungen, Sätze, currentExerciseIndex, Timer, Restore und Offline.
   Hierarchie: workout_sessions → workout_exercises → workout_sets. Stabile Client-IDs.
   Keine direkte Supabase-Logik in der UI — die UI ruft nur diesen Store.
   Readiness/Decision werden als Snapshot gespeichert; die Morgen-Readiness wird NIE verändert.
   Offline: Session/Übung/Satz werden user-scoped gequeued (Reihenfolge Session→Exercise→Set),
   lokale aktive Kopie in localStorage für Reload-Restore. Verbindliches Ergebnisformat.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  const M = (O.trainingDomain && O.trainingDomain.map) || null;

  const ST = {
    session: null, exercises: [], currentIndex: 0,
    timer: { running: false, endAt: null, originalRestSeconds: 0, exerciseClientId: null },
    startedAt: null, dirty: false, syncStatus: 'synced'
  };
  O.workout = O.workout || ST;

  function res(success, data, error, source, sync_status) {
    return { success: success, data: data == null ? null : data, error: error || null, source: source, sync_status: sync_status };
  }
  function uid() { return (O.user && O.user.id) || null; }
  function online() { return !(O.repoBase && O.repoBase.online && O.repoBase.online() === false); }
  function today() { return (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0, 10); }
  function cid(prefix) { return prefix + ':' + (uid() || 'x') + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  // Zeitquelle für Timer-/Pause-/Terminal-Pfade: ORVIA.clock (P0, testbar); ohne Clock exakt Date.now().
  function _nowMs() { try { if (O.clock && typeof O.clock.now === 'function') return O.clock.now(); } catch (e) {} return Date.now(); }
  function cacheKey() { return 'orvia_active_workout_' + (uid() || 'x'); }
  // Erkennt die Unique-Violation der „max. eine aktive Session"-Regel (Postgres 23505).
  function isOneActiveViolation(err) {
    if (!err) return false;
    const m = String(err.message || '') + ' ' + String(err.code || '');
    return /23505/.test(m) || /workout_sessions_one_active/.test(m) || /one_active/.test(m);
  }

  function snapshotDecision() {
    try {
      const d = (typeof getDecision === 'function') ? getDecision() : null;
      if (!d) return { readiness: null, decision: null };
      return {
        readiness: { score: (d._r && d._r.score) != null ? d._r.score : d.score, confidence: d.confidence || null, at: new Date().toISOString() },
        decision: { dayState: d.dayState, statusText: d.statusText, action: d.todayAction, reasons: (d.readinessReasons || []).slice(0, 4), at: new Date().toISOString() }
      };
    } catch (e) { return { readiness: null, decision: null }; }
  }

  // Lokale aktive Kopie (für Reload/Offline-Restore). User-scoped.
  // P0-Fix 2026-08-05: lastActionAt = Zeitpunkt der letzten echten Nutzeraktion.
  // Grundlage der Retro-Pause beim Restore: wird die App mitten im Training
  // beendet, zaehlt die Abwesenheit sonst als Trainingszeit (6-h-Workout-Bug).
  function saveLocal() {
    try { localStorage.setItem(cacheKey(), JSON.stringify({ session: O.workout.session, exercises: O.workout.exercises, currentIndex: O.workout.currentIndex, timer: O.workout.timer, lastActionAt: _nowMs() })); } catch (e) {}
  }
  function loadLocal() {
    try { const raw = localStorage.getItem(cacheKey()); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function clearLocal() { try { localStorage.removeItem(cacheKey()); } catch (e) {} }

  // Offline-Write-Helfer: bei Offline in die user-scoped Queue (richtiger Konflikt-Key).
  // meta trägt Parent-Auflösung (clientId/parentClientId/fkField) für FK-sichere Flushes.
  async function offlineUpsert(table, row, conflict, meta) {
    if (!O.offlineQueue) return res(false, null, { message: 'Offline-Queue nicht verfügbar' }, 'indexeddb', 'failed');
    try { const q = await O.offlineQueue.enqueue(table, row, Object.assign({ onConflict: conflict, operation: 'upsert' }, meta || {}));
      if (q && q.success === false) return res(false, null, q.error || { message: 'Queue-Fehler' }, 'indexeddb', 'failed');
      return res(true, row, null, 'indexeddb', 'pending');
    } catch (e) { return res(false, null, { message: String(e && e.message || e) }, 'indexeddb', 'failed'); }
  }
  // Offline-Delete-Helfer: echte Delete-Operation in die Queue (user-scoped, über Client-ID/Server-ID).
  const CLIENT_FIELD = { workout_sessions: 'client_session_id', workout_exercises: 'client_exercise_id', workout_sets: 'client_set_id' };
  async function offlineDelete(table, meta) {
    if (!O.offlineQueue) return res(false, null, { message: 'Offline-Queue nicht verfügbar' }, 'indexeddb', 'failed');
    meta = meta || {};
    try { const q = await O.offlineQueue.enqueue(table, {}, { operation: 'delete', clientId: meta.clientId || null, recordId: meta.recordId || null, clientField: CLIENT_FIELD[table] || null });
      if (q && q.success === false) return res(false, null, q.error || { message: 'Queue-Fehler' }, 'indexeddb', 'failed');
      return res(true, { deleted: true }, null, 'indexeddb', 'pending');
    } catch (e) { return res(false, null, { message: String(e && e.message || e) }, 'indexeddb', 'failed'); }
  }

  // ---- Lifecycle ----
  async function startFreeWorkout(opts) {
    opts = opts || {};
    if (!uid()) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');
    // Keine zweite aktive Session: vorhandene aktive zuerst wiederherstellen statt neu anlegen.
    if (online() && O.repos && O.repos.workout) {
      const act = await O.repos.workout.getActiveSession();
      if (act.success && act.data) { await restoreActiveWorkout(); return res(false, { existingActive: O.workout.session }, { code: 'active_exists', message: 'Es läuft bereits ein aktives Workout.' }, 'supabase', 'conflict'); }
    }
    const snap = snapshotDecision();
    const localId = cid('workout');
    const startedAtISO = new Date(_nowMs()).toISOString(); // Start-Zeitpunkt speist die Dauerberechnung → gleiche Zeitquelle
    // DTO-Grenze: App/Store nutzt camelCase (startedAt), Repository mappt auf started_at.
    const sessionRow = {
      localDate: today(), status: 'active', startedAt: startedAtISO, sport: opts.sport || null,
      sessionType: opts.sessionType || null, notes: opts.notes || null, totalPausedSeconds: 0,
      /* Batch 2b/2d: Plan-Actual-Link — planned_session_id trägt die OCCURRENCE-ID
         (konkrete datierte Instanz); der unveränderliche Plan-Snapshot (tiefe Kopie,
         Migration 0025) sichert die Vorgabe für den späteren Plan-Ist-Vergleich. */
      plannedSessionId: opts.plannedSessionId || null,
      plannedSessionSnapshot: opts.planSnapshot ? JSON.parse(JSON.stringify(opts.planSnapshot)) : null,
      readinessSnapshot: snap.readiness, decisionSnapshot: snap.decision, source: 'manual', clientSessionId: localId
    };
    let r;
    if (online() && O.repos && O.repos.workout) r = await O.repos.workout.createSession(sessionRow);
    else r = await offlineUpsert('workout_sessions', buildSessionRow(sessionRow), 'user_id,client_session_id', { clientId: localId });
    // Race-Absicherung: Falls trotz Vorabprüfung der eindeutige Index 'one_active' zuschlägt
    // (23505), KEINEN technischen Fehler ausgeben — bestehende aktive Session laden & öffnen.
    if (!r.success && isOneActiveViolation(r.error)) {
      await restoreActiveWorkout();
      return res(false, { existingActive: O.workout.session }, { code: 'active_exists', message: 'Es läuft bereits ein Workout. Es wurde geöffnet.' }, 'supabase', 'conflict');
    }
    if (!r.success) return r;
    O.workout.session = r.data && r.data.id ? r.data : Object.assign({ client_session_id: localId, status: 'active', local_date: sessionRow.localDate, started_at: startedAtISO, total_paused_seconds: 0 }, r.data);
    O.workout.session.client_session_id = O.workout.session.client_session_id || localId;
    if (O.workout.session.started_at == null) O.workout.session.started_at = startedAtISO; // Sicherung gegen Repo-Null
    if (O.workout.session.total_paused_seconds == null) O.workout.session.total_paused_seconds = 0;
    O.workout.exercises = []; O.workout.currentIndex = 0; O.workout.startedAt = O.workout.session.started_at; O.workout.dirty = false;
    O.workout.syncStatus = r.sync_status; saveLocal();
    return res(true, { session: O.workout.session }, null, r.source, r.sync_status);
  }

  async function startPlannedWorkout(planDayId) {
    if (!uid()) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');
    const free = await startFreeWorkout({ sessionType: 'planned' });
    if (!free.success) return free;
    O.workout.session.plan_day_id = planDayId || null;
    if (online() && O.repos && O.repos.workout && O.workout.session.id && planDayId) {
      try { await O.repos.workout.updateSession(O.workout.session.id, { plan_day_id: planDayId }); } catch (e) {}
      // Geplante Übungen NUR über das Repository laden (keine direkte Supabase-Abfrage im Store).
      try {
        const pres = O.repos.trainingPlan ? await O.repos.trainingPlan.getPlanDayExercises(planDayId) : { success: false };
        if (pres.success) for (const pe of (pres.data || [])) await addExercise(pe.exercise_id, { plannedSets: pe.planned_sets, minReps: pe.min_reps, maxReps: pe.max_reps, targetRir: pe.target_rir, restSeconds: pe.rest_seconds, notes: pe.notes });
      } catch (e) {}
    }
    saveLocal();
    return res(true, { session: O.workout.session, exercises: O.workout.exercises }, null, free.source, free.sync_status);
  }

  /* P0-Fix 2026-08-05 (Datenverlust nach App-Neustart) — drei Regeln:

     1. MERGE STATT CLOBBER. Vorher ueberschrieb der Restore den lokalen Stand
        bitweise mit der Server-Sicht und persistierte das sofort (saveLocal).
        Lieferte der Baum-Lader weniger (Teilausfall, Embed-Fehler, Latenz),
        waren lokal geloggte Saetze unwiederbringlich weg — genau der gemeldete
        Vorfall „Workout leer nach App-Neustart". Jetzt wird je Uebung/Satz
        ueber die stabilen client-IDs zusammengefuehrt: Server gewinnt bei
        Treffern (hat Server-IDs), lokale Zusatzdaten BLEIBEN.

     2. KEIN BLINDES clearLocal. Meldet der Server „keine aktive Session",
        waehrend lokal eine aktive Session mit Saetzen liegt, wird der lokale
        Stand nur geloescht, wenn der Server die Session NACHWEISLICH terminal
        kennt. Unbekannt/nie synchronisiert ⇒ lokal behalten (pending).

     3. RETRO-PAUSE. Liegt die letzte echte Aktion (lastActionAt) mehr als
        RETRO_PAUSE_MIN zurueck und die Session ist aktiv ohne Pause, wird die
        Abwesenheit rueckwirkend als Pause markiert (paused_at = lastActionAt,
        sofort zum Server synchronisiert). Die Abschluss-RPC zieht Pausenzeit
        ab — das 6-Stunden-Workout aus 45 Minuten Training entsteht nicht mehr.
        Loggt der Nutzer wieder einen Satz, endet die Pause automatisch. */
  const RETRO_PAUSE_MIN = 15;

  function mergeTrees(server, lc) {
    if (!lc || !lc.session || !server || !server.session) return server;
    const sids = [server.session.client_session_id, server.session.id].filter(Boolean);
    const lids = [lc.session.client_session_id, lc.session.id].filter(Boolean);
    if (!sids.some(x => lids.indexOf(x) >= 0)) return server;   // andere Session → Server-Sicht
    const out = { session: server.session, exercises: [], currentIndex: lc.currentIndex || 0, timer: lc.timer || null };
    const localByCid = {};
    (lc.exercises || []).forEach(le => { const k = le.workoutExercise && le.workoutExercise.client_exercise_id; if (k) localByCid[k] = le; });
    const seen = {};
    (server.exercises || []).forEach(se => {
      const k = se.workoutExercise && se.workoutExercise.client_exercise_id;
      const le = k ? localByCid[k] : null;
      if (k) seen[k] = true;
      const merged = { workoutExercise: se.workoutExercise,
        exercise: se.exercise || (le && le.exercise) || null, sets: (se.sets || []).slice() };
      if (le && le.sets && le.sets.length) {
        const have = {}; merged.sets.forEach(x => { if (x.client_set_id) have[x.client_set_id] = true; });
        le.sets.forEach(x => { if (!x.client_set_id || !have[x.client_set_id]) merged.sets.push(x); });
      }
      out.exercises.push(merged);
    });
    (lc.exercises || []).forEach(le => {
      const k = le.workoutExercise && le.workoutExercise.client_exercise_id;
      if (k && !seen[k]) out.exercises.push(le);                 // lokal geloggt, Server (noch) ohne
    });
    return out;
  }

  /* Uebungsnamen nachschlagen, wo der Katalog-Join fehlte (Fallback-Restore lieferte
     exercise:null → die Story zeigte Saetze OHNE Uebungsnamen). EIN Katalog-Query. */
  async function resolveExerciseNames() {
    try {
      const missing = (O.workout.exercises || []).filter(e => !e.exercise && e.workoutExercise && e.workoutExercise.exercise_id);
      if (!missing.length || !online() || !O.repos || !O.repos.exercise || !O.repos.exercise.list) return;
      const r = await O.repos.exercise.list();
      if (!r || !r.success) return;
      const byId = {}; (r.data || []).forEach(x => { if (x && x.id) byId[x.id] = x; });
      missing.forEach(e => { const hit = byId[e.workoutExercise.exercise_id]; if (hit) e.exercise = hit; });
    } catch (e) {}
  }

  function applyRetroPause(lc) {
    try {
      const s = O.workout.session;
      if (!s || s.status !== 'active' || s.paused_at) return;
      if (!lc || !lc.lastActionAt) return;
      const gapMin = (_nowMs() - lc.lastActionAt) / 60000;
      if (gapMin < RETRO_PAUSE_MIN) return;
      s.paused_at = new Date(lc.lastActionAt).toISOString();
      O.workout.retroPaused = true;   // fuer die UI: „Pause seit letzter Aktion erkannt"
      if (online() && s.id && O.repos && O.repos.workout) { try { O.repos.workout.updateSession(s.id, { paused_at: s.paused_at }); } catch (e) {} }
    } catch (e) {}
  }

  async function restoreActiveWorkout() {
    if (!uid()) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');
    const lc = loadLocal();
    if (online() && O.repos && O.repos.workout) {
      const act = await O.repos.workout.getActiveSession();
      if (!act.success) { if (lc && lc.session) { applyTree(lc); applyRetroPause(lc); saveLocal(); return res(true, lc, null, 'indexeddb', 'pending'); } return act; }
      if (!act.data) {
        // Server kennt KEINE aktive Session. Lokalen Stand nur zerstoeren, wenn
        // die Session serverseitig nachweislich terminal/geloescht ist.
        const ls = lc && lc.session;
        const lActive = !!(ls && (ls.status === 'active' || ls.status === 'paused'));
        if (lActive && (lc.exercises || []).some(e => (e.sets || []).length)) {
          let confirmedGone = false;
          if (ls.id) { try { confirmedGone = await confirmSessionGone(ls, false); } catch (e) {} }
          if (!ls.id || !confirmedGone) {                       // nie synchronisiert ODER unbestaetigt
            applyTree(lc); applyRetroPause(lc); saveLocal();
            return res(true, lc, null, 'indexeddb', 'pending');
          }
        }
        clearLocal(); O.workout.session = null; O.workout.exercises = [];
        return res(true, { session: null }, null, 'empty', 'synced');
      }
      // WICHTIG: Selbst wenn der Baum-Lader (mit exercises(*)-Embed) fehlschlägt, MUSS die
      // aktive Session hydriert werden — sonst zeigt der Verlauf „aktiv", der Hub aber „kein
      // aktives Workout" und der Nutzer steckt fest (kann weder fortsetzen noch neu starten).
      const tree = await O.repos.workout.loadWorkoutTree(act.data.id);
      if (tree.success && tree.data && tree.data.session) {
        applyTree(mergeTrees({ session: tree.data.session, exercises: tree.data.exercises || [], currentIndex: 0 }, lc));
      } else {
        // Fallback 1: Übungen separat laden (einfache Queries, kein Embed).
        let exercises = [];
        try {
          const exRes = await O.repos.workout.listExercises(act.data.id);
          if (exRes && exRes.success) {
            for (const we of (exRes.data || [])) {
              let sets = [];
              try { const sRes = await O.repos.workout.listSets(we.id); if (sRes && sRes.success) sets = sRes.data || []; } catch (e) {}
              exercises.push({ workoutExercise: we, exercise: null, sets: sets });
            }
          }
        } catch (e) {}
        // Fallback 2: zumindest die nackte Session — ZUSAMMENGEFUEHRT mit dem
        // lokalen Stand (vorher ueberschrieb dieser Zweig lokal geloggte Saetze).
        applyTree(mergeTrees({ session: act.data, exercises: exercises, currentIndex: 0 }, lc));
      }
      await resolveExerciseNames();
      applyRetroPause(lc);
      saveLocal();
      return res(true, { session: O.workout.session, exercises: O.workout.exercises }, null, 'supabase', 'synced');
    }
    if (lc && lc.session) { applyTree(lc); applyRetroPause(lc); saveLocal(); return res(true, lc, null, 'indexeddb', 'pending'); }
    return res(true, { session: null }, null, 'empty', 'synced');
  }

  function applyTree(t) {
    O.workout.session = t.session || null;
    O.workout.exercises = t.exercises || [];
    O.workout.currentIndex = t.currentIndex || 0;
    if (t.timer) O.workout.timer = t.timer;
    O.workout.startedAt = O.workout.session && O.workout.session.started_at;
  }

  // Echte Workout-Pause (Variante A): paused_at setzen, Pausensekunden summieren, Dauer zieht Pause ab.
  function isPaused() { const s = O.workout.session; return !!(s && s.paused_at); }
  function pauseWorkout() {
    const s = O.workout.session; if (!s) return res(true, { skipped: true }, null, 'empty', 'synced');
    if (!s.paused_at) s.paused_at = new Date(_nowMs()).toISOString();
    O.workout.timer.running = false; saveLocal();
    if (online() && s.id && O.repos && O.repos.workout) { try { O.repos.workout.updateSession(s.id, { paused_at: s.paused_at }); } catch (e) {} }
    return res(true, { paused: true, pausedAt: s.paused_at }, null, 'indexeddb', 'synced');
  }
  function resumeWorkout() {
    const s = O.workout.session; if (!s) return res(true, { skipped: true }, null, 'empty', 'synced');
    O.workout.retroPaused = false;
    if (s.paused_at) {
      const add = Math.max(0, (_nowMs() - new Date(s.paused_at).getTime()) / 1000);
      s.total_paused_seconds = (s.total_paused_seconds || 0) + add;
      s.paused_at = null;
      if (online() && s.id && O.repos && O.repos.workout) { try { O.repos.workout.updateSession(s.id, { paused_at: null, total_paused_seconds: Math.round(s.total_paused_seconds) }); } catch (e) {} }
    }
    saveLocal();
    return res(true, { resumed: true, totalPausedSeconds: s.total_paused_seconds || 0 }, null, 'indexeddb', 'synced');
  }
  // Gesamte Pausensekunden inkl. laufender Pause (für Dauerberechnung beim Abschluss).
  function effectivePausedSeconds(s) {
    let p = (s.total_paused_seconds || 0);
    if (s.paused_at) p += Math.max(0, (_nowMs() - new Date(s.paused_at).getTime()) / 1000);
    return p;
  }

  // Lokalen Workout-Zustand vollständig zurücksetzen (NUR nach bestätigtem Terminalzustand aufrufen).
  function clearSessionState() {
    clearLocal();
    O.workout.session = null; O.workout.exercises = []; O.workout.currentIndex = 0;
    O.workout.timer = { running: false, endAt: null, originalRestSeconds: 0, exerciseClientId: null };
    O.workout.startedAt = null; O.workout.dirty = false; O.workout.syncStatus = 'synced';
  }

  /* Offline-Terminalzustand (kein Server zum atomaren Abschluss): dedup-sicher queuen.
     Batch 2e: Der Folge-Upsert übernimmt die BESTEHENDEN Session-Felder — vorher
     baute er eine fast leere Zeile und hätte u. a. planned_session_id/
     planned_session_snapshot, sport und started_at serverseitig auf null gesetzt
     (Upsert schreibt jede MITGESCHICKTE Spalte, auch explizite nulls). */
  async function offlineTerminal(s, targetStatus, extraPatch) {
    const row = Object.assign(buildSessionRow({
      localDate: s.local_date, clientSessionId: s.client_session_id, status: targetStatus,
      startedAt: s.started_at || null, sport: s.sport || null, sessionType: s.session_type || null,
      notes: s.notes || null, source: s.source || null,
      totalPausedSeconds: s.total_paused_seconds != null ? s.total_paused_seconds : 0,
      readinessSnapshot: s.readiness_snapshot || null, decisionSnapshot: s.decision_snapshot || null,
      plannedSessionId: s.planned_session_id || null,
      plannedSessionSnapshot: s.planned_session_snapshot || null
    }), extraPatch || {});
    return offlineUpsert('workout_sessions', row, 'user_id,client_session_id', { clientId: s.client_session_id });
  }

  async function finishWorkout(summary) {
    summary = summary || {};
    const s = O.workout.session; if (!s) return res(false, null, { message: 'keine aktive Session' }, 'empty', 'failed');
    const rpe = summary.sessionRpe != null ? summary.sessionRpe : null;
    const localDate = s.local_date, sport = s.sport || 'Gym';
    const loadKey = 'workout_session:' + (s.id || s.client_session_id);
    let durationMin;
    // 1) ATOMARER Abschluss in Supabase (eine RPC) — BEVOR lokal etwas gelöscht wird.
    if (online() && s.id) {
      // P0-Fix 2026-08-05: Eine lokal bekannte (Retro-)Pause MUSS vor dem Abschluss
      // serverseitig stehen — die RPC rechnet duration = now − started_at − Pausen.
      // Ohne diesen Sync zaehlte die Abwesenheit (App beendet) als Trainingszeit.
      if (s.paused_at || (s.total_paused_seconds || 0) > 0) {
        try { await O.repos.workout.updateSession(s.id, { paused_at: s.paused_at || null, total_paused_seconds: Math.round(s.total_paused_seconds || 0) }); } catch (e2) {}
      }
      const r = await O.repos.workout.closeActiveSession(s.id, 'completed', { sessionRpe: rpe });
      if (!r.success) return r;                 // Store bleibt aktiv, Overlay offen (UI)
      durationMin = r.data.duration_min;
    } else {
      const startedAt = s.started_at ? new Date(s.started_at) : null;
      const pausedSec = effectivePausedSeconds(s);
      durationMin = startedAt ? Math.max(0, Math.round((_nowMs() - startedAt.getTime() - pausedSec * 1000) / 60000)) : (summary.durationMin != null ? summary.durationMin : null);
      const q = await offlineTerminal(s, 'completed', { finished_at: new Date(_nowMs()).toISOString(), duration_min: durationMin, total_paused_seconds: Math.round(pausedSec), paused_at: null, session_rpe: rpe });
      if (!q.success) return q;
    }
    // 2) Trainingslast NUR nach bestätigtem Abschluss; kein erfundener RPE; Load-Fehler ≠ Scheinerfolg.
    let loadStatus = 'incomplete_no_rpe';
    if (rpe != null) {
      if (online() && O.repos && O.repos.trainingLoad && s.id) {
        try { const lr = await O.repos.trainingLoad.save(localDate, sport, { dur: durationMin, rpe: rpe, source: 'workout', client_session_id: loadKey }); loadStatus = (lr && lr.success) ? 'written' : 'load_error'; } catch (e) { loadStatus = 'load_error'; }
      } else if (O.repos && O.repos.trainingLoad && O.repos.trainingLoad.toRow && O.offlineQueue) {
        const lrow = O.repos.trainingLoad.toRow(localDate, sport, { dur: durationMin, rpe: rpe, source: 'workout', client_session_id: loadKey });
        const q = await offlineUpsert('training_load_daily', lrow, 'user_id,client_session_id', { clientId: loadKey });
        loadStatus = q.success ? 'written_pending' : 'load_error';
      } else loadStatus = 'load_deferred';
    }
    // 2b) INKREMENT 2A: lokale kanonische Activity (idempotent über source+sourceRecordId),
    //     unabhängig von der (noch nicht deployten) Supabase-Activity-Tabelle. Snapshot der
    //     Übungen/Sätze wird mitgesichert → Detailansicht offline lesbar. syncStatus IMMER
    //     'pending' (Outbox), da der Activity-Datensatz in 2A nirgends serverseitig liegt.
    let activityLocal = null;
    try {
      if (O.activityStore) {
        const sportKey = (O.trainingDomain && O.trainingDomain.normSport) ? O.trainingDomain.normSport(sport) : null;
        const sessionForActivity = {
          id: s.id || null, client_session_id: s.client_session_id, sport: sport, sport_key: sportKey,
          status: 'completed', local_date: localDate, started_at: s.started_at,
          finished_at: s.finished_at || new Date(_nowMs()).toISOString(),
          duration_min: durationMin, total_paused_seconds: s.total_paused_seconds || 0, session_rpe: rpe,
          planned_session_id: s.plannedSessionId || s.planned_session_id || null   // AD1c: Plan-Actual-Link an die Activity weiterreichen
        };
        const ar = O.activityStore.upsertActivityFromWorkout(sessionForActivity, O.workout.exercises, { syncStatus: 'pending' });
        if (ar && ar.ok) activityLocal = ar.activity;
      }
    } catch (e) { try { console.error('[ORVIA workout] lokale Activity-Verknüpfung fehlgeschlagen', e); } catch (_) {} }
    // 3) Erst JETZT lokalen Zustand vollständig leeren.
    clearSessionState();
    // 4) Neutrales Update-Event (kein direkter UI-Aufruf aus dem Store) → beide Verläufe rendern neu.
    try { if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('orvia:activity-updated', { detail: { activityId: activityLocal && activityLocal.clientRecordId } })); } catch (e) {}
    // 5) Outbox NICHT-blockierend anstoßen (RPC-Sync). UI/Abschluss hängen NICHT am Netzwerk;
    //    Fehler/Offline → bleibt pending und wird später automatisch erneut synchronisiert.
    try { if (O.activitySync && O.activitySync.flushPendingActivities) O.activitySync.flushPendingActivities(); } catch (e) {}
    return res(true, { completed: true, loadStatus: loadStatus, durationMin: durationMin, sessionId: s.id, sport: sport, sessionRpe: rpe, clientSessionId: s.client_session_id, activity: activityLocal }, null, (online() && s.id) ? 'supabase' : 'indexeddb', (online() && s.id) ? 'synced' : 'pending');
  }

  // INCIDENT-FIX (2026-07-15, no_row_deleted-Deadlock): Verifiziert nach einem fehlgeschlagenen
  // Abbruch/Löschen, ob die Session serverseitig bereits WEG oder TERMINAL ist. Vorher zeigte der
  // Hub eine lokale/stale „aktive" Session, die der Server nicht mehr hatte; deleteSession lieferte
  // no_row_deleted, der Store durfte sich nie leeren → Nutzer saß dauerhaft fest („Altes aktives
  // Training gefunden" ohne Ausweg). Idempotenz-Regel: Ziel „Session beendet/gelöscht" bereits
  // erreicht → Erfolg. Serverzustand unbekannt oder Session noch aktiv → fail closed (Fehler bleibt).
  async function confirmSessionGone(s, forDelete) {
    try {
      if (!O.repos || !O.repos.workout || !O.repos.workout.getSession) return false;
      const chk = await O.repos.workout.getSession(s.id);
      if (!chk.success) return false;                    // Serverzustand unbekannt → kein Scheinerfolg
      if (!chk.data) return true;                        // Zeile existiert nicht mehr → Ziel erreicht
      if (forDelete) return false;                       // Löschen: Zeile existiert noch → echter Fehler
      const st2 = chk.data.status;
      return !(st2 === 'active' || st2 === 'paused');    // Abbrechen: bereits terminal → Ziel erreicht
    } catch (e) { return false; }
  }

  // mode: 'later' (aktiv lassen) | 'aborted' (als abgebrochen, atomare RPC) | 'delete' (löschen).
  async function cancelWorkout(mode, reason) {
    const s = O.workout.session; if (!s) return res(true, { skipped: true }, null, 'empty', 'synced');
    if (mode === 'later') { saveLocal(); return res(true, { kept: true }, null, 'indexeddb', 'synced'); }
    if (mode === 'delete') {
      let r;
      if (online() && s.id) {
        r = await O.repos.workout.deleteSession(s.id);   // Repo verifiziert: no_row_deleted
        // Session war serverseitig bereits gelöscht → idempotent als Erfolg werten.
        if (!r.success && r.error && r.error.code === 'no_row_deleted' && await confirmSessionGone(s, true)) {
          r = res(true, { deleted: 0, alreadyDeleted: true }, null, 'supabase', 'synced');
        }
      }
      else r = await offlineDelete('workout_sessions', { clientId: s.client_session_id, recordId: s.id });
      if (!r.success) return r;                 // Serverfehler → Store NICHT leeren
      clearSessionState();
      return res(true, { deleted: true }, null, r.source, r.sync_status);
    }
    // aborted: atomar via RPC
    if (online() && s.id) {
      const r = await O.repos.workout.closeActiveSession(s.id, 'aborted', { cancelReason: reason || 'aborted' });
      // Session bereits terminal oder gelöscht → Ziel des Abbruchs erreicht (kein Deadlock).
      if (!r.success && !(await confirmSessionGone(s, false))) return r;   // sonst: Serverfehler → Store NICHT leeren
    } else {
      const q = await offlineTerminal(s, 'aborted', { finished_at: new Date(_nowMs()).toISOString(), cancel_reason: reason || null });
      if (!q.success) return q;
    }
    clearSessionState();
    return res(true, { aborted: true }, null, (online() && s.id) ? 'supabase' : 'indexeddb', (online() && s.id) ? 'synced' : 'pending');
  }

  // ---- Exercises ----
  async function addExercise(exerciseId, opts) {
    opts = opts || {}; const s = O.workout.session; if (!s) return res(false, null, { message: 'keine aktive Session' }, 'empty', 'failed');
    const clientExerciseId = cid('we'); const order = O.workout.exercises.length;
    const exRow = { clientExerciseId: clientExerciseId, exerciseId: exerciseId, order: order, plannedSets: opts.plannedSets, minReps: opts.minReps, maxReps: opts.maxReps, targetRir: opts.targetRir, targetRpe: opts.targetRpe, restSeconds: opts.restSeconds, notes: opts.notes };
    let r;
    if (online() && s.id) r = await O.repos.workout.addExercise(s.id, exRow);
    else r = await offlineUpsert('workout_exercises', buildExerciseRow(s, exRow), 'user_id,client_exercise_id', { clientId: clientExerciseId, parentClientId: s.client_session_id, fkField: 'workout_session_id' });
    if (!r.success) return r;
    const we = (r.data && r.data.id) ? r.data : buildExerciseRow(s, exRow);
    we.client_exercise_id = we.client_exercise_id || clientExerciseId;
    O.workout.exercises.push({ workoutExercise: we, exercise: opts.exercise || null, sets: [] });
    O.workout.currentIndex = O.workout.exercises.length - 1; saveLocal();
    return res(true, { workoutExercise: we, index: O.workout.currentIndex }, null, r.source, r.sync_status);
  }

  async function removeExercise(index) {
    const e = O.workout.exercises[index]; if (!e) return res(false, null, { message: 'Übung nicht gefunden' }, 'empty', 'failed');
    const we = e.workoutExercise;
    let r = (online() && we.id) ? await O.repos.workout.removeExercise(we.id) : await offlineDelete('workout_exercises', { clientId: we.client_exercise_id, recordId: we.id });
    if (!r.success) return r;
    O.workout.exercises.splice(index, 1);
    if (O.workout.currentIndex >= O.workout.exercises.length) O.workout.currentIndex = Math.max(0, O.workout.exercises.length - 1);
    saveLocal(); return res(true, { removed: true }, null, r.source, r.sync_status);
  }

  async function replaceExercise(index, newExerciseId, keepSets) {
    const e = O.workout.exercises[index]; if (!e) return res(false, null, { message: 'Übung nicht gefunden' }, 'empty', 'failed');
    if ((e.sets || []).length && keepSets) {
      // Bestehende Sätze behalten → neue Übung separat hinzufügen (keine stillen Datenverluste).
      return addExercise(newExerciseId, {});
    }
    let r = (online() && e.workoutExercise.id) ? await O.repos.workout.updateExercise(e.workoutExercise.id, { exercise_id: newExerciseId, replaced_by_exercise_id: e.workoutExercise.exercise_id || null }) : res(true, { exercise_id: newExerciseId }, null, 'indexeddb', 'pending');
    if (!r.success) return r;
    e.workoutExercise.exercise_id = newExerciseId; e.exercise = null; saveLocal();
    return res(true, { replaced: true }, null, r.source, r.sync_status);
  }

  async function reorderExercises(orderedIndices) {
    const reordered = orderedIndices.map(i => O.workout.exercises[i]).filter(Boolean);
    O.workout.exercises = reordered;
    reordered.forEach((e, i) => { e.workoutExercise.order_index = i; });
    const clientIds = reordered.map(e => e.workoutExercise.client_exercise_id).filter(Boolean);
    let r = online() ? await O.repos.workout.reorderExercises(clientIds) : res(true, { reordered: clientIds.length }, null, 'indexeddb', 'pending');
    saveLocal(); return res(r.success, { order: clientIds }, r.error, r.source, r.sync_status);
  }

  // ---- Sets ----
  function validateSet(set) {
    const errs = [];
    if (set.weight != null && (isNaN(set.weight) || set.weight < 0)) errs.push('Gewicht ≥ 0');
    if (set.reps != null && (isNaN(set.reps) || set.reps < 0)) errs.push('Wiederholungen ≥ 0');
    if (set.rir != null && (set.rir < 0 || set.rir > 10)) errs.push('RIR 0–10');
    if (set.rpe != null && (set.rpe < 1 || set.rpe > 10)) errs.push('RPE 1–10');
    if (set.restS != null && set.restS < 0) errs.push('Pause ≥ 0');
    const working = (set.setType || 'working') === 'working';
    if (working && set.completed && set.weight == null && set.reps == null) errs.push('Arbeitssatz braucht Gewicht oder Wiederholungen');
    return errs;
  }

  async function addSet(exerciseIndex, set) {
    const e = O.workout.exercises[exerciseIndex]; if (!e) return res(false, null, { message: 'Übung nicht gefunden' }, 'empty', 'failed');
    const errs = validateSet(set || {}); if (errs.length) return res(false, null, { code: 'validation', message: errs.join(', ') }, 'empty', 'failed');
    // Ein geloggter Satz IST Training: eine laufende (auch Retro-)Pause endet damit.
    try { if (isPaused()) resumeWorkout(); } catch (e2) {}
    // Satznummern stabil halten: nächste Nummer = max(vorhandene)+1 (kollidiert nicht mit gelöschten).
    const clientSetId = cid('set');
    const setNumber = (e.sets || []).reduce((mx, x) => Math.max(mx, x.set_number || 0), 0) + 1;
    const setObj = Object.assign({ setNumber: setNumber, clientSetId: clientSetId }, set);
    let r;
    if (online() && e.workoutExercise.id) r = await O.repos.workout.addSet(e.workoutExercise.id, setObj);
    else r = await offlineUpsert('workout_sets', buildSetRow(e, setObj), 'user_id,client_set_id', { clientId: clientSetId, parentClientId: e.workoutExercise.client_exercise_id, fkField: 'workout_exercise_id' });
    if (!r.success) return r;
    const row = (r.data && r.data.id) ? r.data : buildSetRow(e, setObj);
    row.client_set_id = row.client_set_id || clientSetId;
    if (row.set_number == null) row.set_number = setNumber; // immer stabile Nummer im State
    e.sets.push(row); saveLocal();
    return res(true, { set: row }, null, r.source, r.sync_status);
  }

  async function updateSet(exerciseIndex, setIndex, patch) {
    const e = O.workout.exercises[exerciseIndex]; if (!e || !e.sets[setIndex]) return res(false, null, { message: 'Satz nicht gefunden' }, 'empty', 'failed');
    const merged = Object.assign({}, e.sets[setIndex], patch);
    const errs = validateSet({ weight: merged.weight, reps: merged.reps, rir: merged.rir, rpe: merged.rpe, restS: merged.rest_s, setType: merged.set_type, completed: merged.completed });
    if (errs.length) return res(false, null, { code: 'validation', message: errs.join(', ') }, 'empty', 'failed');
    const setRow = e.sets[setIndex]; const id = setRow.id;
    let r = (online() && id) ? await O.repos.workout.updateSet(id, patch)
      : await offlineUpsert('workout_sets', Object.assign({}, setRow, patch), 'user_id,client_set_id', { clientId: setRow.client_set_id, parentClientId: e.workoutExercise.client_exercise_id, fkField: 'workout_exercise_id' });
    if (!r.success) return r;
    e.sets[setIndex] = Object.assign({}, e.sets[setIndex], patch); saveLocal();
    return res(true, { set: e.sets[setIndex] }, null, r.source, r.sync_status);
  }

  async function deleteSet(exerciseIndex, setIndex) {
    const e = O.workout.exercises[exerciseIndex]; if (!e || !e.sets[setIndex]) return res(false, null, { message: 'Satz nicht gefunden' }, 'empty', 'failed');
    const setRow = e.sets[setIndex]; const id = setRow.id;
    // Offline: echte Delete-Operation in die Queue (statt nur lokal entfernen).
    let r = (online() && id) ? await O.repos.workout.deleteSet(id) : await offlineDelete('workout_sets', { clientId: setRow.client_set_id, recordId: id });
    if (!r.success) return r;
    e.sets.splice(setIndex, 1);
    // KEINE Neunummerierung: set_number bleibt stabil (Satz 3 bleibt Satz 3). Kein stilles Umschreiben.
    saveLocal(); return res(true, { deleted: true }, null, r.source, r.sync_status);
  }

  async function completeSet(exerciseIndex, setIndex) { return updateSet(exerciseIndex, setIndex, { completed: true, recorded_at: new Date().toISOString() }); }

  // ---- Navigation / Kontext ----
  function setCurrentExercise(i) { if (i >= 0 && i < O.workout.exercises.length) { O.workout.currentIndex = i; saveLocal(); } return O.workout.currentIndex; }
  function getCurrentExercise() { return O.workout.exercises[O.workout.currentIndex] || null; }
  async function getPreviousPerformance(exerciseId) {
    if (!online() || !O.repos || !O.repos.workout) return res(true, null, null, 'indexeddb', 'pending');
    return O.repos.workout.getPreviousExercisePerformance(exerciseId, today());
  }

  // ---- Timer (lokal; absolutes endAt → reload-fest, kein Drift, +15s bleibt erhalten) ----
  function startRestTimer(seconds) {
    const cur = getCurrentExercise();
    O.workout.timer = { running: true, endAt: _nowMs() + (seconds || 0) * 1000, originalRestSeconds: seconds || 0, exerciseClientId: cur && cur.workoutExercise.client_exercise_id || null };
    saveLocal(); return O.workout.timer;
  }
  function addRestTime(sec) { const t = O.workout.timer; if (t && t.running) { t.endAt = (t.endAt || _nowMs()) + sec * 1000; saveLocal(); } return O.workout.timer; }
  function skipRest() { const t = O.workout.timer; if (t) { t.running = false; t.endAt = null; } saveLocal(); return O.workout.timer; }
  function restRemaining() { const t = O.workout.timer; if (!t || !t.running || !t.endAt) return 0; return Math.max(0, Math.ceil((t.endAt - _nowMs()) / 1000)); }
  function progress() {
    const exs = O.workout.exercises; if (!exs.length) return { exercises: 0, total: 0, pct: 0 };
    let plannedSets = 0, completedSets = 0;
    exs.forEach(e => { plannedSets += (e.workoutExercise.planned_sets || 0); completedSets += (e.sets || []).filter(s => s.completed).length; });
    if (plannedSets > 0) return { kind: 'sets', completed: completedSets, planned: plannedSets, pct: Math.round(completedSets / plannedSets * 100) };
    const doneEx = exs.filter(e => (e.sets || []).some(s => s.completed)).length;
    return { kind: 'exercises', completed: doneEx, total: exs.length, pct: Math.round(doneEx / exs.length * 100) };
  }

  // Logout/Kontowechsel: lokale aktive Kopie + State leeren (kein Fremddaten-Übertrag).
  function clearForUserSwitch() { clearLocal(); O.workout.session = null; O.workout.exercises = []; O.workout.currentIndex = 0; O.workout.timer = { running: false, endAt: null, originalRestSeconds: 0, exerciseClientId: null }; }

  // ---- Row-Builder (für Offline-Queue; user_id via Queue/stampUser erzwungen) ----
  function buildSessionRow(s) {
    const sportKey = (O.trainingDomain && O.trainingDomain.normSport) ? O.trainingDomain.normSport(s.sport) : (s.sport || null);
    return { user_id: uid(), local_date: s.localDate, status: s.status || 'active', started_at: s.startedAt || s.started_at || null, finished_at: s.finishedAt || s.finished_at || null,
      sport: s.sport || null, sport_key: sportKey || null, session_type: s.sessionType || null, notes: s.notes || null,
      planned_session_id: s.plannedSessionId || s.planned_session_id || null,   // Batch 2b: Offline-Queue-Parität zum Repository-Mapping
      /* Batch 2d (H3-Muster): planned_session_snapshot NUR senden wenn belegt —
         kompatibel mit Instanzen, auf denen Migration 0025 noch nicht läuft. */
      ...(s.plannedSessionSnapshot ? { planned_session_snapshot: s.plannedSessionSnapshot } : {}),
      paused_at: s.pausedAt || s.paused_at || null, total_paused_seconds: s.totalPausedSeconds != null ? s.totalPausedSeconds : (s.total_paused_seconds != null ? s.total_paused_seconds : 0),
      readiness_snapshot: s.readinessSnapshot || null, decision_snapshot: s.decisionSnapshot || null, source: s.source || 'manual', client_session_id: s.clientSessionId || null };
  }
  function buildExerciseRow(session, ex) {
    return { user_id: uid(), workout_session_id: session.id || null, client_exercise_id: ex.clientExerciseId, exercise_id: ex.exerciseId || null,
      order_index: ex.order != null ? ex.order : 0, planned_sets: ex.plannedSets != null ? ex.plannedSets : null,
      min_reps: ex.minReps != null ? ex.minReps : null, max_reps: ex.maxReps != null ? ex.maxReps : null,
      target_rir: ex.targetRir != null ? ex.targetRir : null, rest_seconds: ex.restSeconds != null ? ex.restSeconds : null, notes: ex.notes || null };
  }
  function buildSetRow(e, set) {
    const row = M ? M.setToRow(set) : Object.assign({}, set);
    row.user_id = uid(); row.workout_exercise_id = e.workoutExercise.id || null; row.client_set_id = set.clientSetId;
    return row;
  }

  /* P0-Nachtrag 2026-08-05: nachtraegliche Dauer-Korrektur (Nutzerentscheidung —
     KEINE automatische Obergrenze; korrigierbar statt gedeckelt).
     Korrigiert konsistent in allen drei Wahrheiten:
       1. kanonische Activity (activityStore, mit Korrektur-Protokoll)
       2. Server-Session (workout_sessions.duration_min)
       3. Trainingslast (training_load_daily; Last = Dauer × RPE — nur wenn die
          Session ein RPE hat; Upsert ueber denselben client_session_id-Schluessel
          wie beim Abschluss, es entsteht keine zweite Zeile). */
  async function correctFinishedDuration(activityId, newMin) {
    const a = O.activityStore && O.activityStore.getActivityById ? O.activityStore.getActivityById(activityId) : null;
    if (!a) return res(false, null, { message: 'Aktivitaet nicht gefunden' }, 'empty', 'failed');
    if (!(a.source === 'orvia_workout' || a.source === 'live')) return res(false, null, { message: 'nur ORVIA-Workouts korrigierbar' }, 'empty', 'failed');
    const lr = O.activityStore.correctActivityDuration(a.clientRecordId || a.id, newMin);
    if (!lr.ok) return res(false, null, { message: lr.error }, 'indexeddb', 'failed');
    let serverPatched = false, loadPatched = false;
    if (online() && O.repos && O.repos.workout && a.workoutSessionId) {
      try {
        const u = await O.repos.workout.updateSession(a.workoutSessionId, { duration_min: Math.round(newMin) });
        serverPatched = !!(u && u.success);
        const g = await O.repos.workout.getSession(a.workoutSessionId);
        if (g && g.success && g.data && g.data.session_rpe != null && O.repos.trainingLoad) {
          const loadKey = 'workout_session:' + (a.workoutSessionId || a.sourceRecordId);
          const ld = await O.repos.trainingLoad.save(g.data.local_date, g.data.sport || 'Gym',
            { dur: Math.round(newMin), rpe: g.data.session_rpe, source: 'workout', client_session_id: loadKey });
          loadPatched = !!(ld && ld.success);
        }
      } catch (e) {}
    }
    try { if (O.activitySync && O.activitySync.flushPendingActivities) O.activitySync.flushPendingActivities(); } catch (e) {}
    try { if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('orvia:activity-updated', { detail: { activityId: a.clientRecordId } })); } catch (e) {}
    return res(true, { corrected: true, fromMin: lr.fromMin, toMin: lr.toMin, serverPatched: serverPatched, loadPatched: loadPatched }, null,
      serverPatched ? 'supabase' : 'indexeddb', serverPatched ? 'synced' : 'pending');
  }

  O.workoutStore = {
    startFreeWorkout, startPlannedWorkout, restoreActiveWorkout, pauseWorkout, resumeWorkout, finishWorkout, cancelWorkout,
    correctFinishedDuration,
    addExercise, replaceExercise, removeExercise, reorderExercises,
    addSet, updateSet, deleteSet, completeSet, validateSet,
    setCurrentExercise, getCurrentExercise, getPreviousPerformance,
    startRestTimer, addRestTime, skipRest, restRemaining, progress, clearForUserSwitch,
    isPaused, snapshotDecision, state: function () { return O.workout; }
  };
})();
