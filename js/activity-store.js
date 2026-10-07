/* ============================================================
   ORVIA · activity-store — LOKALES kanonisches Activity-Repository (Inkrement 2A).
   Offline-Cache/Outbox. Nutzt DIESELBEN IDs/Felder wie das spätere Supabase-Modell
   (source, source_record_id, workout_session_id, summary, duration_seconds), damit 2B
   ohne Datenbruch synchronisieren kann. KEINE Supabase-Abhängigkeit hier.
   Eindeutiger lokaler Schlüssel: source + sourceRecordId → idempotenter Upsert.
   Persistenz: localStorage (user-scoped). Workout-Detailsnapshot wird mitgespeichert,
   damit die Detailansicht offline funktioniert.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  function AN() { return O.activityNormalize; }
  /* v8-445: Quelle / manuell / wirksam (activity-effective). */
  var _eff;
  function EFF() {
    if (O.activityEffective) return O.activityEffective;
    if (_eff === undefined) { _eff = null; if (typeof require === 'function') { try { _eff = require('./activity-effective.js'); } catch (err) { _eff = null; } } }
    return _eff;
  }
  function eff(a) { var E = EFF(); return (E && E.applyEffective) ? E.applyEffective(a) : a; }
  function uid() { return (O.user && O.user.id) || 'local'; }
  function key() { return 'orvia_activities_' + uid(); }
  function now() { return new Date().toISOString(); }
  function cid() { return 'act:' + uid() + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* v8-428 (Gians Befund 2.10.: „das Dashboard laedt deutlich laenger"; gemessen): Der
     Speicher traegt je Aktivitaet Messreihen und Route (Server-metrics) — bei 160
     Einheiten rund 4 MB. JEDER Leser hat diesen Block neu geparst; ein Dashboard-Render
     liest den Speicher Dutzende Male ⇒ mehrere Sekunden reine JSON-Arbeit.
     Jetzt wird das geparste Ergebnis gemerkt, solange der ROHTEXT identisch ist
     (Vergleich des Strings — damit bleibt jede Aenderung von aussen sichtbar: anderes
     Tab, Kontowechsel, Tests). Zurueckgegeben werden FLACHE KOPIEN der Eintraege:
     ein Aufrufer kann Felder seines Eintrags setzen (recording, syncStatus …), ohne
     den Merkstand zu veraendern. Verschachtelte Objekte (summary, metrics, Snapshot)
     sind geteilt und werden im Speicher nie an Ort und Stelle veraendert, sondern
     ersetzt (siehe correctActivityDuration). */
  var _memo = { key: null, raw: null, arr: null };
  function readAll() {
    try {
      var k = key(), raw = localStorage.getItem(k);
      if (!raw) { _memo = { key: k, raw: null, arr: null }; return []; }
      if (_memo.key !== k || _memo.raw !== raw || !_memo.arr) {
        var parsed = JSON.parse(raw);
        /* v8-445: Der Speicher traegt den WIRKSAMEN Wert. Eintraege, deren Dauer ein
           frueherer Abgleich auf den Serverwert zurueckgesetzt hat (Korrektur noch in
           metrics), werden hier beim Lesen richtiggestellt — einmal je Rohtext, ohne
           Schreibzugriff; der naechste regulaere Schreibvorgang legt es so ab. */
        var arr0 = Array.isArray(parsed) ? parsed : [];
        for (var p0 = 0; p0 < arr0.length; p0++) { if (arr0[p0] && typeof arr0[p0] === 'object') arr0[p0] = eff(arr0[p0]); }
        _memo = { key: k, raw: raw, arr: arr0 };
      }
      var src = _memo.arr, out = new Array(src.length);
      for (var i = 0; i < src.length; i++) { var e = src[i]; out[i] = (e && typeof e === 'object') ? Object.assign({}, e) : e; }
      return out;
    } catch (e) { return []; }
  }
  function writeAll(arr) { try { localStorage.setItem(key(), JSON.stringify(arr)); return true; } catch (e) { return false; } }

  // Snapshot der Übungen/Sätze (DB-nahe Form) — defensiv, nicht mutierend.
  function snapshotExercises(exercises) {
    exercises = Array.isArray(exercises) ? exercises : [];
    return exercises.map(function (e, i) {
      var we = (e && e.workoutExercise) || {};
      var sets = (e && Array.isArray(e.sets)) ? e.sets : [];
      return {
        order: we.order_index != null ? we.order_index : i,
        exerciseId: we.exercise_id || null,
        exerciseNameSnapshot: (e && e.exercise && e.exercise.name) || we.exercise_name || null,
        /* S2b-1: Katalogzuordnung im Snapshot einfrieren — gym-volume/Kraftprofil lesen sie zuerst. */
        slug: (e && e.exercise && e.exercise.slug) || null,
        baseSlug: (e && e.exercise && e.exercise.baseSlug) || null,
        movementPattern: (e && e.exercise && e.exercise.movementPattern) || null,
        muscles: (e && e.exercise && e.exercise.muscles && Object.keys(e.exercise.muscles).length) ? e.exercise.muscles : null,
        /* B-05: Superset-Gruppe mitfuehren, damit die Historie die Gruppierung zeigt (null = keine). */
        supersetGroup: we.superset_group != null ? we.superset_group : null,
        sets: sets.map(function (s, j) {
          return {
            setNumber: s.set_number != null ? s.set_number : j + 1,
            setType: s.set_type || 'working',
            weight: s.weight != null ? s.weight : null,
            reps: s.reps != null ? s.reps : null,
            rir: s.rir != null ? s.rir : null,
            rpe: s.rpe != null ? s.rpe : null,
            completed: s.completed === true,
            note: s.note || null
          };
        })
      };
    });
  }

  // Idempotenter Upsert aus einem abgeschlossenen Workout. session = DB-/Store-Sessionzeile.
  // snapshot = O.workout.exercises (optional) für offline-lesbare Details. opts.syncStatus.
  function upsertActivityFromWorkout(session, snapshot, opts) {
    opts = opts || {};
    var an = AN(); if (!an) return { ok: false, error: 'activityNormalize fehlt' };
    var row = an.activityRowFromSession(session, an.summarizeWorkout(snapshotToSets(snapshot)));
    var source = row.source, srcId = row.source_record_id;
    if (!srcId) return { ok: false, error: 'source_record_id fehlt' };
    var all = readAll();
    var existing = null, idx = -1;
    for (var i = 0; i < all.length; i++) { if (all[i].source === source && all[i].sourceRecordId === srcId) { existing = all[i]; idx = i; break; } }
    var snap = snapshot != null ? snapshotExercises(snapshot) : (existing && existing.workoutSnapshot) || null;
    // AD1c: Plan-Actual-Link (SSOT = workout_sessions.planned_session_id) als Projektion ins
    // metrics-jsonb — überlebt localStorage-Reload UND Cloud-Roundtrip (Batch-2b-metrics-Vertrag).
    var _pj = session.planned_session_id || session.plannedSessionId || (opts && opts.plannedSessionId) || null;
    var _baseMetrics = (existing && existing.metrics) || {};
    var _corr = _baseMetrics.planLinkCorrection;
    var _metrics = Object.assign({}, _baseMetrics);
    /* v8-310b: Eine bewusste Plan-Link-Korrektur gewinnt gegen spaetere
       Retries desselben historischen Workout-Snapshots. Sonst wuerde ein
       erneuter Upsert den geloesten Link wieder als Wahrheit einsetzen. */
    if (_corr && Object.prototype.hasOwnProperty.call(_corr, 'toOccurrenceId')) {
      delete _metrics.plannedSessionId;
      if (_corr.toOccurrenceId) _metrics.plannedSessionId = _corr.toOccurrenceId;
    } else if (_pj) _metrics.plannedSessionId = _pj;
    var rec = {
      id: (existing && existing.id) || null,
      clientRecordId: (existing && existing.clientRecordId) || cid(),
      userId: uid(),
      sportId: row.sport_id,
      source: source,
      sourceRecordId: srcId,
      workoutSessionId: row.workout_session_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationSeconds: row.duration_seconds,
      status: row.status,
      summary: row.summary || {},
      metrics: _metrics,
      workoutSnapshot: snap,
      syncStatus: opts.syncStatus || 'pending',
      createdAt: (existing && existing.createdAt) || now(),
      updatedAt: now()
    };
    rec = eff(rec);   /* v8-445: erneuter Upsert desselben Workouts behaelt eine manuelle Korrektur (wirksamer Wert) */
    if (idx >= 0) all[idx] = rec; else all.push(rec);   // genau EINE Activity je source+sourceRecordId
    writeAll(all);
    return { ok: true, activity: rec, created: idx < 0 };
  }

  // Manuelle/kanonische Activity (kein Workout): idempotent über source+sourceRecordId.
  // rec: { sportId, sourceRecordId, startedAt, endedAt, durationSeconds, summary, metrics, source? }
  function upsertManualActivity(rec) {
    rec = rec || {}; var source = rec.source || 'manual'; var srcId = rec.sourceRecordId;
    if (!srcId) return { ok: false, error: 'sourceRecordId fehlt' };
    var all = readAll(); var existing = null, idx = -1;
    for (var i = 0; i < all.length; i++) { if (all[i].source === source && all[i].sourceRecordId === srcId) { existing = all[i]; idx = i; break; } }
    var out = {
      id: (existing && existing.id) || null,
      clientRecordId: (existing && existing.clientRecordId) || cid(),
      userId: uid(), sportId: rec.sportId || 'other', source: source, sourceRecordId: srcId,
      workoutSessionId: null, startedAt: rec.startedAt || null, endedAt: rec.endedAt || null,
      durationSeconds: rec.durationSeconds != null ? rec.durationSeconds : null,
      status: rec.status || 'completed', summary: rec.summary || {}, metrics: rec.metrics || {},
      workoutSnapshot: (existing && existing.workoutSnapshot) || null,
      syncStatus: 'pending', createdAt: (existing && existing.createdAt) || now(), updatedAt: now()
    };
    if (idx >= 0) all[idx] = out; else all.push(out);
    writeAll(all);
    return { ok: true, activity: out, created: idx < 0 };
  }

  function snapshotToSets(snapshot) {
    // summarizeWorkout erwartet [{sets:[...]}] — aus Store-Form (workoutExercise/sets) ableiten.
    if (!Array.isArray(snapshot)) return [];
    return snapshot.map(function (e) { return { sets: (e && Array.isArray(e.sets)) ? e.sets : [] }; });
  }

  function getActivityById(id) { var all = readAll(); for (var i = 0; i < all.length; i++) if (all[i].id === id || all[i].clientRecordId === id) return all[i]; return null; }

  /* v8-310b · Die Plan-Zuordnung ist eine korrigierbare AUSWERTUNG der
     Activity, nicht ihre Identitaet. Der unveraenderliche Workout-Snapshot
     bleibt als historische Eingangsbeobachtung erhalten. */
  function planLinkOf(a) {
    if (!a) return null;
    var m = (a.metrics && typeof a.metrics === 'object') ? a.metrics : {};
    var c = m.planLinkCorrection;
    if (c && Object.prototype.hasOwnProperty.call(c, 'toOccurrenceId')) return c.toOccurrenceId || null;
    return a.plannedSessionId || m.plannedSessionId || null;
  }

  /* Nur die Verknuepfung loesen. KEIN Tombstone: Aktivitaet, Saetze,
     Belastung und Snapshot bleiben bestehen. expectedOccurrenceId schuetzt
     davor, aus einer veralteten Ansicht eine inzwischen andere Zuordnung zu
     entfernen. */
  function unlinkActivityFromPlan(id, expectedOccurrenceId) {
    if (!id) return { ok: false, code: 'missing_activity_id' };
    var all = readAll(), idx = findIndexByRef(all, id);
    if (idx < 0) return { ok: false, code: 'activity_not_found' };
    var a = all[idx], current = planLinkOf(a);
    if (!current) return { ok: true, code: 'already_unlinked', activity: a };
    if (expectedOccurrenceId && current !== expectedOccurrenceId) {
      return { ok: false, code: 'plan_link_changed', current: current };
    }
    var m = Object.assign({}, a.metrics || {});
    delete m.plannedSessionId;
    m.planLinkCorrection = {
      schemaVersion: 1,
      fromOccurrenceId: current,
      toOccurrenceId: null,
      reason: 'user_unlinked',
      method: 'manual_correction',
      correctedAt: now()
    };
    var corrected = Object.assign({}, a, {
      plannedSessionId: null,
      metrics: m,
      syncStatus: 'pending',
      updatedAt: now()
    });
    all[idx] = corrected;
    if (!writeAll(all)) return { ok: false, code: 'persist_failed' };
    return { ok: true, code: 'unlinked', activity: corrected, fromOccurrenceId: current };
  }

  /* Gegenstueck zum Loesen (v8-418, Gians Befund 28.09.): eine Aktivitaet OHNE
     Plan-Identitaet (Garmin-Import, freies ORVIA-Workout) kann nachtraeglich einer
     geplanten Occurrence zugeordnet werden. Der Resolver verknuepft NIE automatisch
     ueber Tag+Sport (I3b) — diese Funktion ist die manuelle, protokollierte
     Bestaetigung genau dieses schwachen Kandidaten. One-to-one bleibt gewahrt:
     traegt bereits eine andere Aktivitaet diese Occurrence, wird abgelehnt. */
  /* v8-421 (Gians Befund 28.09., „activity_not_found"): Referenz-Aufloesung ueber ALLE
     stabilen Identitaeten — Server-id, clientRecordId, source+sourceRecordId,
     workoutSessionId. Eine auf einem anderen Geraet aufgezeichnete Einheit kommt aus
     der Serverliste mit der FREMDEN client_record_id; ueber die reine id/crid-Suche
     war sie lokal unauffindbar. ref: String (id/crid) oder Activity-Objekt. */
  function findIndexByRef(all, ref) {
    if (!ref) return -1;
    var o = (typeof ref === 'object') ? ref : { id: ref, clientRecordId: ref };
    for (var i = 0; i < all.length; i++) {
      var a = all[i]; if (!a) continue;
      if (o.id && (a.id === o.id || a.clientRecordId === o.id)) return i;
      if (o.clientRecordId && (a.clientRecordId === o.clientRecordId || a.id === o.clientRecordId)) return i;
    }
    if (typeof ref !== 'object') return -1;
    for (var j = 0; j < all.length; j++) {
      var b = all[j]; if (!b) continue;
      if (o.source && o.sourceRecordId && b.source === o.source && b.sourceRecordId === o.sourceRecordId) return j;
      if (o.workoutSessionId && b.workoutSessionId === o.workoutSessionId) return j;
    }
    return -1;
  }
  /* v8-421: Serverseitig bekannte Aktivitaet (normalisiert, camelCase — z. B. aus dem
     Listen-Cache in activity.js) lokal sicherstellen. NUR Einfuegen, nie Ueberschreiben:
     lokale Eintraege (pending oder synced) bleiben unberuehrt. Tombstones gewinnen. */
  function ensureLocal(a) {
    if (!a || typeof a !== 'object' || !a.id) return { ok: false, code: 'invalid' };
    if (isTombstoned(a)) return { ok: false, code: 'tombstoned' };
    var all = readAll();
    var idx = findIndexByRef(all, a);
    if (idx >= 0) return { ok: true, code: 'exists', activity: all[idx] };
    var rec = {
      id: a.id, clientRecordId: a.clientRecordId || cid(), userId: a.userId || uid(),
      sportId: a.sportId || 'other', source: a.source || 'server', sourceRecordId: a.sourceRecordId || null,
      workoutSessionId: a.workoutSessionId || null,
      linkedActivityId: a.linkedActivityId || null, linkKind: a.linkKind || null,
      startedAt: a.startedAt || null, endedAt: a.endedAt || null,
      durationSeconds: a.durationSeconds != null ? a.durationSeconds : null,
      status: a.status || 'completed', summary: a.summary || {}, metrics: a.metrics || {},
      workoutSnapshot: null, syncStatus: 'synced', createdAt: now(), updatedAt: now()
    };
    all.push(rec);
    if (!writeAll(all)) return { ok: false, code: 'persist_failed' };
    return { ok: true, code: 'inserted', activity: rec };
  }
  /* v8-428 (Gians Befund 2.10.: „das Dashboard laedt deutlich laenger"): ensureLocal las
     und parste je Aufruf den GESAMTEN Aktivitaetsspeicher (Messreihen und Routen
     inklusive, mehrere MB). plan-auto-link rief es fuer jede Einheit der Serverliste —
     bis zu 200-mal hintereinander, bei jedem Lauf, mitten im Start. Die Sammelvariante
     liest EINMAL, prueft alle, schreibt hoechstens einmal. */
  function ensureLocalMany(list) {
    list = Array.isArray(list) ? list : [];
    var res = { inserted: 0, existing: 0, skipped: 0 };
    if (!list.length) return res;
    var all = readAll(), dirty = false;
    var byId = {}, byCrid = {}, bySrc = {}, byWs = {};
    for (var i = 0; i < all.length; i++) {
      var x = all[i]; if (!x) continue;
      if (x.id) byId[x.id] = 1; if (x.clientRecordId) byCrid[x.clientRecordId] = 1;
      if (x.source && x.sourceRecordId) bySrc[x.source + '|' + x.sourceRecordId] = 1;
      if (x.workoutSessionId) byWs[x.workoutSessionId] = 1;
    }
    for (var k = 0; k < list.length; k++) {
      var a = list[k];
      if (!a || typeof a !== 'object' || !a.id) { res.skipped++; continue; }
      if (byId[a.id] || byCrid[a.id] || (a.clientRecordId && (byCrid[a.clientRecordId] || byId[a.clientRecordId])) ||
          (a.source && a.sourceRecordId && bySrc[a.source + '|' + a.sourceRecordId]) || (a.workoutSessionId && byWs[a.workoutSessionId])) { res.existing++; continue; }
      if (isTombstoned(a)) { res.skipped++; continue; }
      var rec = {
        id: a.id, clientRecordId: a.clientRecordId || cid(), userId: a.userId || uid(),
        sportId: a.sportId || 'other', source: a.source || 'server', sourceRecordId: a.sourceRecordId || null,
        workoutSessionId: a.workoutSessionId || null,
        linkedActivityId: a.linkedActivityId || null, linkKind: a.linkKind || null,
        startedAt: a.startedAt || null, endedAt: a.endedAt || null,
        durationSeconds: a.durationSeconds != null ? a.durationSeconds : null,
        status: a.status || 'completed', summary: a.summary || {}, metrics: a.metrics || {},
        workoutSnapshot: null, syncStatus: 'synced', createdAt: now(), updatedAt: now()
      };
      all.push(rec); dirty = true; res.inserted++;
      byId[rec.id] = 1; byCrid[rec.clientRecordId] = 1;
      if (rec.source && rec.sourceRecordId) bySrc[rec.source + '|' + rec.sourceRecordId] = 1;
      if (rec.workoutSessionId) byWs[rec.workoutSessionId] = 1;
    }
    if (dirty && !writeAll(all)) return { inserted: 0, existing: res.existing, skipped: res.skipped, error: 'persist_failed' };
    return res;
  }
  function linkActivityToPlan(id, occurrenceId, opts) {
    var lo = opts || {};
    if (!id) return { ok: false, code: 'missing_activity_id' };
    if (!occurrenceId || typeof occurrenceId !== 'string') return { ok: false, code: 'missing_occurrence_id' };
    var all = readAll(), idx = findIndexByRef(all, id);
    if (idx < 0) return { ok: false, code: 'activity_not_found' };
    var a = all[idx], current = planLinkOf(a);
    if (current === occurrenceId) return { ok: true, code: 'already_linked', activity: a };
    for (var j = 0; j < all.length; j++) {
      if (j === idx) continue;
      var o = all[j]; if (!o || isTombstoned(o)) continue;
      if (planLinkOf(o) === occurrenceId) return { ok: false, code: 'occurrence_taken', byActivityId: o.id || o.clientRecordId };
    }
    var m = Object.assign({}, a.metrics || {});
    m.planLinkCorrection = {
      schemaVersion: 1,
      fromOccurrenceId: current || null,
      toOccurrenceId: occurrenceId,
      reason: lo.reason || (current ? 'user_relinked' : 'user_linked'),
      method: lo.method || 'manual_correction',
      correctedAt: now()
    };
    m.plannedSessionId = occurrenceId;
    var corrected = Object.assign({}, a, {
      plannedSessionId: occurrenceId,
      metrics: m,
      syncStatus: 'pending',
      updatedAt: now()
    });
    all[idx] = corrected;
    if (!writeAll(all)) return { ok: false, code: 'persist_failed' };
    return { ok: true, code: 'linked', activity: corrected, fromOccurrenceId: current || null };
  }

  /* v8-428: mehrere Zuordnungen in EINEM Lese-/Schreibvorgang (automatische Zuordnung:
     beim ersten Lauf Dutzende — einzeln waere das je Zuordnung ein kompletter
     Schreibzyklus des Speichers). Gleiche Regeln wie linkActivityToPlan: one-to-one,
     protokolliert, sync 'pending'. items: [{activityId, occurrenceId, reason}]. */
  function linkManyToPlan(items, opts) {
    var lo = opts || {}; items = Array.isArray(items) ? items : [];
    var out = { applied: 0, results: [] };
    if (!items.length) return out;
    var all = readAll(), taken = {};
    for (var j = 0; j < all.length; j++) { var o = all[j]; if (!o || isTombstoned(o)) continue; var pl = planLinkOf(o); if (pl) taken[pl] = j; }
    items.forEach(function (it) {
      var idx = it && it.activityId ? findIndexByRef(all, it.activityId) : -1;
      if (idx < 0 || !it.occurrenceId) { out.results.push({ activityId: it && it.activityId, ok: false, code: idx < 0 ? 'activity_not_found' : 'missing_occurrence_id' }); return; }
      var a = all[idx], current = planLinkOf(a);
      if (current === it.occurrenceId) { out.results.push({ activityId: it.activityId, ok: true, code: 'already_linked' }); return; }
      if (taken[it.occurrenceId] != null && taken[it.occurrenceId] !== idx) { out.results.push({ activityId: it.activityId, ok: false, code: 'occurrence_taken' }); return; }
      var m = Object.assign({}, a.metrics || {});
      m.planLinkCorrection = { schemaVersion: 1, fromOccurrenceId: current || null, toOccurrenceId: it.occurrenceId,
        reason: it.reason || lo.reason || (current ? 'user_relinked' : 'user_linked'), method: lo.method || 'manual_correction', correctedAt: now() };
      m.plannedSessionId = it.occurrenceId;
      all[idx] = Object.assign({}, a, { plannedSessionId: it.occurrenceId, metrics: m, syncStatus: 'pending', updatedAt: now() });
      if (current && taken[current] === idx) delete taken[current];
      taken[it.occurrenceId] = idx;
      out.applied++; out.results.push({ activityId: it.activityId, ok: true, code: 'linked' });
    });
    if (out.applied && !writeAll(all)) return { applied: 0, results: [], error: 'persist_failed' };
    return out;
  }

  /* P0-Nachtrag 2026-08-05 (Nutzerentscheidung): Dauer eines ABGESCHLOSSENEN
     Workouts nachtraeglich korrigierbar — bewusst KEINE automatische Obergrenze.
     Die Korrektur ist eine manuelle Angabe und wird als solche protokolliert
     (metrics.durationCorrection mit vorher/nachher/Zeitpunkt) — Messung und
     manuelle Korrektur bleiben unterscheidbar. */
  function correctActivityDuration(id, newMin) {
    if (!(newMin > 0)) return { ok: false, error: 'ungueltige Dauer' };
    var r = setActivityCorrection(id, 'duration', Math.round(newMin) * 60, { requireCompleted: true });
    if (!r.ok) return r;
    return { ok: true, activity: r.activity, fromMin: r.previous && r.previous.effectiveValue != null ? Math.round(r.previous.effectiveValue / 60) : null,
      sourceMin: r.resolved && r.resolved.sourceValue != null ? Math.round(r.resolved.sourceValue / 60) : null, toMin: Math.round(newMin) };
  }
  /* v8-445: EIN Schreibweg fuer manuelle Korrekturen (Quelle / manuell / wirksam,
     js/activity-effective.js). value == null nimmt die Korrektur zurueck. Der
     Quellwert bleibt in metrics.corrections stehen; das kanonische Feld traegt
     danach den wirksamen Wert. metrics wird ERSETZT, nie an Ort und Stelle
     geaendert (geteilter Merkstand, s. readAll). */
  function setActivityCorrection(id, metricKey, value, opts) {
    var E = EFF();
    if (!E) return { ok: false, error: 'Korrektur nicht verfuegbar' };
    var all = readAll();
    for (var i = 0; i < all.length; i++) {
      var a = all[i];
      if (a.id === id || a.clientRecordId === id) {
        if (opts && opts.requireCompleted && a.status !== 'completed') return { ok: false, error: 'nur abgeschlossene Aktivitaeten' };
        var r = (value == null) ? E.clearManual(a, metricKey) : E.setManual(a, metricKey, value);
        if (!r.ok) return { ok: false, error: r.error === 'out_of_range' ? 'Wert ausserhalb des zulaessigen Bereichs' : (r.error || 'ungueltiger Wert') };
        if (r.unchanged) return { ok: true, activity: a, resolved: r.resolved, previous: r.previous, unchanged: true };
        var n = r.activity;
        n.syncStatus = 'pending'; n.updatedAt = now();
        all[i] = n;
        writeAll(all);
        return { ok: true, activity: n, resolved: r.resolved, previous: r.previous };
      }
    }
    return { ok: false, error: 'Aktivitaet nicht gefunden' };
  }
  function getActivityBySource(source, sourceRecordId) { var all = readAll(); for (var i = 0; i < all.length; i++) if (all[i].source === source && all[i].sourceRecordId === sourceRecordId) return all[i]; return null; }

  /* Bugfix (2026-08-05, Nutzer-Feedback "Saetze verschwinden nach 1-2 Tagen"): die
     Aktivitaetsseite (js/ui.js gmOpenActivityPage) las Uebungen/Saetze bisher AUSSCHLIESSLICH
     aus diesem lokalen workoutSnapshot (einmalig befuellt bei finishWorkout, siehe
     upsertActivityFromWorkout oben) — ohne Fallback auf die serverseitige, dauerhafte Quelle
     (workout_exercises/workout_sets). Geht der lokale Snapshot verloren (Geraetewechsel,
     Browser-Speicher geleert, PWA-Storage-Eviction), zeigte die Seite "keine Saetze
     gespeichert", obwohl der Server sie eventuell noch hat. gmActLoadGymFallback (js/ui.js)
     laedt in diesem Fall live nach (ueber workoutRepository.loadWorkoutTree, dieselbe Quelle
     wie gym-volume.js's gymPipelineAsync) und repariert hier den lokalen Snapshot — davon
     profitieren automatisch auch alle anderen lokalen Leser (z. B. gym-volume.js), ohne
     eigene Nachlade-Logik. */
  /* v8-386: ref (optional) = das geoeffnete Activity-Objekt. Server-Aktivitaeten, die nur
     in der Server-Liste (nicht im lokalen Store) liegen, tragen eine andere id als der
     lokale Datensatz — deshalb wird zusaetzlich ueber workoutSessionId und
     source+sourceRecordId gematcht. Findet sich kein lokaler Datensatz, ist das KEIN
     Ladefehler: der Snapshot wird trotzdem zurueckgegeben, damit die Detailseite die
     geladenen Saetze anzeigen kann. */
  function repairWorkoutSnapshot(activityId, exercises, ref) {
    var snap = snapshotExercises(exercises);
    if (!snap.length) return { ok: false, error: 'leer', snapshot: [] };
    var all = readAll();
    var hit = -1;
    for (var i = 0; i < all.length && hit < 0; i++) {
      var a = all[i];
      if (a.id === activityId || a.clientRecordId === activityId) hit = i;
    }
    if (hit < 0 && ref) {
      for (var j = 0; j < all.length && hit < 0; j++) {
        var b = all[j];
        if (ref.workoutSessionId && b.workoutSessionId === ref.workoutSessionId) hit = j;
        else if (ref.source && ref.sourceRecordId && b.source === ref.source && b.sourceRecordId === ref.sourceRecordId) hit = j;
        else if (ref.id && b.id === ref.id) hit = j;
      }
    }
    if (hit >= 0) {
      all[hit].workoutSnapshot = snap; all[hit].updatedAt = now();
      writeAll(all);
      return { ok: true, activity: all[hit], snapshot: snap };
    }
    return { ok: false, error: 'Aktivitaet nicht gefunden', snapshot: snap };
  }

  // Detailauflösung NUR über stabile IDs (nie Datum/Index). Liefert Snapshot + Activity.
  function getWorkoutDetailsForActivity(activityId) {
    var a = getActivityById(activityId);
    if (!a) return { ok: false, code: 'ACTIVITY_NOT_FOUND' };
    if (a.workoutSnapshot && a.workoutSnapshot.length) return { ok: true, activity: a, exercises: a.workoutSnapshot, hasDetails: true };
    return { ok: true, activity: a, exercises: [], hasDetails: false };  // allgemeine Aktivität ohne Satzdetails
  }

  // Liste, neueste zuerst. filters: { sportId, source, status, limit }.
  /* S2c (v8-388): Gekoppelte Geraeteaufzeichnungen sind KEINE eigenstaendigen
     Einheiten — sie haengen als a.recording am Primaerdatensatz (activityConfig.
     attachRecordings). Alle Konsumenten (Last, Prognose, Zaehler) lesen ueber diese
     Funktion und sehen damit genau EINE Einheit. filters.includeLinked = true liefert
     die Rohliste (Diagnose). Faellt activityConfig aus, bleibt die Rohliste. */
  function attachRec(list) {
    try { var AC = O.activityConfig; if (AC && typeof AC.attachRecordings === 'function') return AC.attachRecordings(list); } catch (e) {}
    return list;
  }
  /* S2c: Aufzeichnung zu einem Primaerdatensatz (fuer Einzelaufloesung, z. B. Detailseite). */
  function recordingFor(a) {
    if (!a || !a.id) return null;
    var all = readAll();
    for (var i = 0; i < all.length; i++) if (all[i].linkedActivityId === a.id && all[i].id !== a.id) return all[i];
    return null;
  }
  /* S2c: Lokale Kopplung nach erfolgreicher Server-RPC nachziehen (Server bleibt Quelle). */
  function setActivityLink(recordingId, primaryIdOrNull) {
    var all = readAll();
    for (var i = 0; i < all.length; i++) {
      var a = all[i];
      if (a.id === recordingId || a.clientRecordId === recordingId) {
        a.linkedActivityId = primaryIdOrNull || null; a.linkKind = primaryIdOrNull ? 'device_recording' : null; a.updatedAt = now();
        writeAll(all); return { ok: true, activity: a };
      }
    }
    return { ok: false, error: 'Aktivitaet nicht gefunden' };
  }
  function listActivities(filters) {
    filters = filters || {};
    var all = readAll().slice();
    all.sort(function (a, b) { return String(b.startedAt || b.createdAt || '').localeCompare(String(a.startedAt || a.createdAt || '')); });
    if (!filters.includeLinked) all = attachRec(all);
    var out = all.filter(function (a) {
      if (filters.sportId && a.sportId !== filters.sportId) return false;
      if (filters.source && a.source !== filters.source) return false;
      if (filters.status && a.status !== filters.status) return false;
      return true;
    });
    return filters.limit ? out.slice(0, filters.limit) : out;
  }

  // ID/Server-Sync nachtragen (2B): markiert pending → synced und ergänzt Server-id.
  function markSynced(clientRecordId, serverId) {
    var all = readAll();
    for (var i = 0; i < all.length; i++) { if (all[i].clientRecordId === clientRecordId) { if (serverId) all[i].id = serverId; all[i].syncStatus = 'synced'; all[i].updatedAt = now(); writeAll(all); return true; } }
    return false;
  }
  function pendingActivities() { return readAll().filter(function (a) { return a.syncStatus !== 'synced'; }); }

  // ---- Löschen + Tombstones (Offline-festes Löschen; verhindert Wiederauftauchen nach Server-Merge) ----
  function tkey() { return 'orvia_activity_tombstones_' + uid(); }
  function readTombstones() { try { var raw = localStorage.getItem(tkey()); var a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function writeTombstones(a) { try { localStorage.setItem(tkey(), JSON.stringify(a)); return true; } catch (e) { return false; } }
  function tombstones() { return readTombstones(); }
  function pendingDeletes() { return readTombstones().filter(function (t) { return t.syncStatus !== 'synced'; }); }
  function removeTombstone(clientRecordId) { var all = readTombstones().filter(function (t) { return t.clientRecordId !== clientRecordId; }); writeTombstones(all); }
  function markDeleteSynced(clientRecordId) { var all = readTombstones(); for (var i = 0; i < all.length; i++) if (all[i].clientRecordId === clientRecordId) { all[i].syncStatus = 'synced'; } writeTombstones(all); }
  // Aktivität lokal löschen + Tombstone anlegen (für Server-Delete-Outbox). actObj optional (Server-only).
  function deleteActivity(idOrClientId, actObj) {
    var all = readAll(); var rec = null, keep = [];
    all.forEach(function (a) { if (!rec && (a.id === idOrClientId || a.clientRecordId === idOrClientId)) { rec = a; } else { keep.push(a); } });
    var src = rec || actObj || null;
    if (!src) return { ok: false, error: 'not_found' };
    writeAll(keep);
    var tomb = {
      clientRecordId: src.clientRecordId || ('tomb:' + (src.id || idOrClientId)),
      serverId: src.id || null, source: src.source || null, sourceRecordId: src.sourceRecordId || null,
      workoutSessionId: src.workoutSessionId || null,
      kind: (src.source === 'orvia_workout') ? 'workout' : 'activity',
      syncStatus: (src.id || src.source === 'orvia_workout') ? 'pending' : 'synced',  // nie synchronisiert (nur lokal) → nichts am Server zu tun
      createdAt: now()
    };
    var ts = readTombstones().filter(function (t) { return t.clientRecordId !== tomb.clientRecordId; });
    ts.push(tomb); writeTombstones(ts);
    return { ok: true, tombstone: tomb };
  }
  // Ist eine (auch Server-/Legacy-)Activity per Tombstone als gelöscht markiert?
  function isTombstoned(a) {
    if (!a) return false; var ts = readTombstones();
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i];
      if (t.serverId && a.id && t.serverId === a.id) return true;
      if (t.clientRecordId && a.clientRecordId && t.clientRecordId === a.clientRecordId) return true;
      if (t.workoutSessionId && a.workoutSessionId && t.workoutSessionId === a.workoutSessionId) return true;
      if (t.source && t.sourceRecordId && a.source === t.source && a.sourceRecordId === t.sourceRecordId) return true;
    }
    return false;
  }

  /* Ziel-SSOT/Analytics (2026-07-18): Server-Aktivitäten (Garmin-Worker, andere
     Geräte) in den lokalen Store mergen — bisher war der Store reine Outbox und
     synchronisierte Läufe erreichten den Client NIE (unsichtbar für Prognose/
     Insights). Idempotent über (source, source_record_id); Tombstones gewinnen
     (gelöschte tauchen nicht wieder auf); LOKALE pending-Datensätze werden nie
     überschrieben (Outbox-Vorrang). Rückgabe: {merged, updated, skipped}. */
  function mergeServerActivities(rows) {
    rows = Array.isArray(rows) ? rows : [];
    var all = readAll();
    var byKey = {};
    for (var i = 0; i < all.length; i++) {
      var a = all[i];
      if (a.source && a.sourceRecordId) byKey[a.source + ' ' + a.sourceRecordId] = i;
      if (a.id) byKey['id ' + a.id] = i;
      if (a.clientRecordId) byKey['crid ' + a.clientRecordId] = i;   /* v8-421 */
    }
    var merged = 0, updated = 0, skipped = 0;
    for (var r = 0; r < rows.length; r++) {
      var n = AN() && AN().normalizeActivityRecord ? AN().normalizeActivityRecord(rows[r]) : null;
      if (!n || !n.id) { skipped++; continue; }
      if (isTombstoned(n)) { skipped++; continue; }
      var idx = (n.source && n.sourceRecordId && byKey[n.source + ' ' + n.sourceRecordId] != null)
        ? byKey[n.source + ' ' + n.sourceRecordId]
        : (byKey['id ' + n.id] != null ? byKey['id ' + n.id]
          : (n.clientRecordId && byKey['crid ' + n.clientRecordId] != null ? byKey['crid ' + n.clientRecordId] : -1));
      if (idx >= 0) {
        var ex = all[idx];
        if (ex.syncStatus === 'pending') {
          /* v8-423: Outbox-Vorrang fuer DATEN — die Identitaet (Server-crid) darf trotzdem
             nachgezogen werden, sonst scheitert der Push dauerhaft am Identitaetskonflikt. */
          if (n.clientRecordId && ex.clientRecordId !== n.clientRecordId && byKey['crid ' + n.clientRecordId] == null) { byKey['crid ' + n.clientRecordId] = idx; ex.clientRecordId = n.clientRecordId; updated++; }
          skipped++; continue;
        }
        ex.id = n.id; ex.sportId = n.sportId || ex.sportId; ex.startedAt = n.startedAt || ex.startedAt;
        ex.endedAt = n.endedAt || ex.endedAt;
        ex.linkedActivityId = n.linkedActivityId || null; ex.linkKind = n.linkKind || null;   // S2c: Server ist Quelle der Kopplung
        if (n.durationSeconds != null) ex.durationSeconds = n.durationSeconds;
        if (n.summary && Object.keys(n.summary).length) ex.summary = n.summary;
        /* Batch 2b/2c: Server-metrics erhalten. AUTORITÄTSREGEL (Batch 2c):
           Merge JE SCHLÜSSEL — der Server gewinnt pro geliefertem Key,
           lokale Zusatz-Keys bleiben erhalten (ein partielles Serverobjekt
           löscht nie unbeteiligte lokale Metrics); leeres Serverobjekt
           ändert nichts. */
        var _localMetrics = ex.metrics;
        if (n.metrics && Object.keys(n.metrics).length) ex.metrics = Object.assign({}, ex.metrics || {}, n.metrics);
        ex.status = n.status || ex.status; ex.syncStatus = 'synced'; ex.updatedAt = now();
        /* v8-445: Manuelle Korrekturen (Quelle / manuell / wirksam). Je Kennzahl gilt der
           juengere Satz — traegt dieses Geraet den juengeren (oder der Server gar keinen),
           bleibt er stehen und wird erneut gesendet. Danach wird der gemischte Eintrag auf
           den wirksamen Wert gebracht: die Serverspalte darueber ist der Quellwert. */
        var _E = EFF();
        if (_E && _E.adoptNewer) {
          var exNew = _E.adoptNewer(ex, { metrics: _localMetrics });
          var localNewer = exNew !== ex;
          var exEff = _E.applyEffective(exNew);
          if (exEff !== ex) { ex.durationSeconds = exEff.durationSeconds; ex.summary = exEff.summary; ex.metrics = exEff.metrics; }
          if (localNewer) ex.syncStatus = 'pending';
        }
        /* v8-421: Server-client_record_id uebernehmen, wenn der lokale Eintrag nur eine
           beim Merge erzeugte Ersatz-ID traegt (fremdes Geraet). Die UI adressiert die
           Einheit ueber die Server-crid — ohne Uebernahme fand der Store sie nicht. */
        if (n.clientRecordId && ex.clientRecordId !== n.clientRecordId && byKey['crid ' + n.clientRecordId] == null) {
          byKey['crid ' + n.clientRecordId] = idx; ex.clientRecordId = n.clientRecordId;
        }
        updated++;
      } else {
        all.push({
          id: n.id, clientRecordId: (n.clientRecordId && byKey['crid ' + n.clientRecordId] == null) ? n.clientRecordId : cid(), userId: uid(),   /* v8-421: Server-crid uebernehmen */
          sportId: n.sportId || 'other', source: n.source || 'server', sourceRecordId: n.sourceRecordId || null,
          workoutSessionId: n.workoutSessionId || null,
          linkedActivityId: n.linkedActivityId || null, linkKind: n.linkKind || null,
          startedAt: n.startedAt, endedAt: n.endedAt, durationSeconds: n.durationSeconds,
          status: n.status || 'completed', summary: n.summary || {},
          metrics: n.metrics || {},   // Batch 2b: Server-metrics erhalten (vorher hart {})
          workoutSnapshot: null, syncStatus: 'synced', createdAt: now(), updatedAt: now()
        });
        byKey['id ' + n.id] = all.length - 1; byKey['crid ' + all[all.length - 1].clientRecordId] = all.length - 1;
        merged++;
      }
    }
    if (merged || updated) writeAll(all);
    return { merged: merged, updated: updated, skipped: skipped };
  }

  // Logout/Kontowechsel: nur den eigenen Key leeren (kein Fremddaten-Übertrag).
  function clearForUserSwitch() { try { localStorage.removeItem(key()); localStorage.removeItem(tkey()); } catch (e) {} }

  var api = {
    upsertActivityFromWorkout: upsertActivityFromWorkout, upsertManualActivity: upsertManualActivity,
    getActivityById: getActivityById, getActivityBySource: getActivityBySource,
    planLinkOf: planLinkOf, unlinkActivityFromPlan: unlinkActivityFromPlan, linkActivityToPlan: linkActivityToPlan,
    ensureLocal: ensureLocal, ensureLocalMany: ensureLocalMany, linkManyToPlan: linkManyToPlan, findIndexByRef: findIndexByRef,
    correctActivityDuration: correctActivityDuration, setActivityCorrection: setActivityCorrection, repairWorkoutSnapshot: repairWorkoutSnapshot,
    recordingFor: recordingFor, setActivityLink: setActivityLink,
    getWorkoutDetailsForActivity: getWorkoutDetailsForActivity,
    listActivities: listActivities, markSynced: markSynced, pendingActivities: pendingActivities,
    mergeServerActivities: mergeServerActivities,
    deleteActivity: deleteActivity, isTombstoned: isTombstoned, tombstones: tombstones,
    pendingDeletes: pendingDeletes, removeTombstone: removeTombstone, markDeleteSynced: markDeleteSynced,
    snapshotExercises: snapshotExercises, clearForUserSwitch: clearForUserSwitch
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.activityStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
