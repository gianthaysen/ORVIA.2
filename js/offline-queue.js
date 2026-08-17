/* ============================================================
   ORVIA · offline-queue — IndexedDB-basierte Schreib-Queue
   Jeder Eintrag trägt: user_id, datentyp (table), version, created, sync_status.
   Offline-Daten von Nutzer A werden NIE unter Nutzer B synchronisiert
   (Flush filtert strikt auf die aktuelle user_id).
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  const DB_NAME = 'orvia_offline', STORE = 'queue', VERSION = 1;
  // sync_status: local_only | pending | syncing | synced | conflict | failed

  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          s.createIndex('user_id', 'user_id', { unique: false });
          s.createIndex('status', 'sync_status', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function uid() { return (O.user && O.user.id) || null; }

  // Schreiboperation in die Queue legen (z.B. wenn offline). Verbindliches Ergebnisformat.
  // payload.user_id wird IMMER aus der Auth-Session gesetzt (keine fremde user_id).
  // 3. Arg: entweder onConflict-String (rückwärtskompatibel) ODER Options-Objekt:
  //   { onConflict, operation('upsert'|'delete'), clientId, parentClientId, fkField, clientField, recordId }
  async function enqueue(table, record, opts) {
    const u = uid();
    if (!u) return { success: false, data: null, error: { message: 'keine Sitzung' }, source: 'indexeddb', sync_status: 'failed' };
    opts = (typeof opts === 'string') ? { onConflict: opts } : (opts || {});
    const env = {
      user_id: u, table: table, on_conflict: opts.onConflict || null,
      operation: opts.operation || 'upsert',
      client_id: opts.clientId || null,
      parent_client_id: opts.parentClientId || null,
      fk_field: opts.fkField || null,
      client_field: opts.clientField || null,
      record_id: opts.recordId || null,
      retry_count: 0, last_error: null,
      version: 1, created: Date.now(), sync_status: 'pending',
      payload: Object.assign({}, record, { user_id: u })
    };
    try {
      const db = await idb();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).add(env);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
      return { success: true, data: env, error: null, source: 'indexeddb', sync_status: 'pending' };
    } catch (e) {
      return { success: false, data: null, error: { message: String(e && e.message || e) }, source: 'indexeddb', sync_status: 'failed' };
    }
  }

  async function pendingForCurrentUser() {
    const u = uid(); if (!u) return [];
    try {
      const db = await idb();
      return await new Promise((res, rej) => {
        const out = [];
        const tx = db.transaction(STORE, 'readonly');
        const idx = tx.objectStore(STORE).index('user_id');
        const cur = idx.openCursor(IDBKeyRange.only(u));
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { if (c.value.sync_status !== 'synced') out.push(c.value); c.continue(); }
          else res(out);
        };
        cur.onerror = () => rej(cur.error);
      });
    } catch (e) { return []; }
  }

  async function markDone(id, status, errMsg) {
    try {
      const db = await idb();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const get = store.get(id);
        get.onsuccess = () => {
          const v = get.result; if (!v) return;
          if (status === 'synced') { store.delete(id); }
          else { v.sync_status = status; v.retry_count = (v.retry_count || 0) + 1; v.last_error = errMsg != null ? String(errMsg) : v.last_error; store.put(v); }
        };
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    } catch (e) {}
  }

  // ---- Parent-Auflösung über stabile Client-IDs (verhindert FK=null bei Offline-Kindern) ----
  const TABLE_ORDER = { workout_sessions: 1, workout_exercises: 2, workout_sets: 3 };
  function clientFieldFor(table) { return ({ workout_sessions: 'client_session_id', workout_exercises: 'client_exercise_id', workout_sets: 'client_set_id' })[table] || null; }
  function parentTableForFk(fk) { return fk === 'workout_session_id' ? 'workout_sessions' : fk === 'workout_exercise_id' ? 'workout_exercises' : null; }
  function parentClientFieldForFk(fk) { return fk === 'workout_session_id' ? 'client_session_id' : fk === 'workout_exercise_id' ? 'client_exercise_id' : null; }

  async function resolveServerId(table, clientField, clientId, map) {
    if (!table || !clientField || !clientId) return null;
    const k = table + ':' + clientId;
    if (map[k] != null) return map[k];
    try {
      const { data, error } = await O.sb.from(table).select('id').eq('user_id', uid()).eq(clientField, clientId).limit(1);
      if (!error && data && data[0]) { map[k] = data[0].id; return data[0].id; }
    } catch (e) {}
    return null;
  }

  // Flush: NUR Einträge der aktuellen user_id, parent-sicher, idempotent, mit Delete-Support.
  // Reihenfolge: Upserts Session→Exercise→Set, danach Deletes Set→Exercise→Session.
  // Bei Teilfehler bleibt der Eintrag in der Queue (sync_status='failed', retry_count++).
  async function flush() {
    const u = uid(); if (!u || !O.sb) return { flushed: 0 };
    if (!navigator.onLine) return { flushed: 0, offline: true };
    const items = (await pendingForCurrentUser()).filter(it => it.user_id === u); // nie fremde Daten
    const upserts = items.filter(it => (it.operation || 'upsert') !== 'delete')
      .sort((a, b) => (TABLE_ORDER[a.table] || 0) - (TABLE_ORDER[b.table] || 0) || a.created - b.created);
    const deletes = items.filter(it => it.operation === 'delete')
      .sort((a, b) => (TABLE_ORDER[b.table] || 0) - (TABLE_ORDER[a.table] || 0) || a.created - b.created);
    const map = {}; let done = 0, failed = 0;

    for (const it of upserts) {
      try {
        const payload = Object.assign({}, it.payload, { user_id: u });
        // Parent-FK über Client-ID auflösen, falls noch keine Server-ID gesetzt.
        if (it.fk_field && payload[it.fk_field] == null) {
          const pt = parentTableForFk(it.fk_field), pcf = parentClientFieldForFk(it.fk_field);
          const pid = await resolveServerId(pt, pcf, it.parent_client_id, map);
          if (pid == null) { await markDone(it.id, 'failed', 'parent_unresolved'); failed++; continue; } // bleibt in Queue
          payload[it.fk_field] = pid;
        }
        const { data, error } = await O.sb.from(it.table).upsert(payload, it.on_conflict ? { onConflict: it.on_conflict } : undefined).select();
        if (error) { await markDone(it.id, 'failed', error.message); failed++; continue; }
        const cf = clientFieldFor(it.table);
        if (cf && it.client_id && data && data[0]) map[it.table + ':' + it.client_id] = data[0].id; // für Kinder
        await markDone(it.id, 'synced'); done++;
      } catch (e) { await markDone(it.id, 'failed', String(e && e.message || e)); failed++; }
    }

    for (const it of deletes) {
      try {
        let q = O.sb.from(it.table).delete().eq('user_id', u); // user-scoped: nie fremde Zeilen
        if (it.client_field && it.client_id) q = q.eq(it.client_field, it.client_id);
        else if (it.record_id) q = q.eq('id', it.record_id);
        else { await markDone(it.id, 'synced'); done++; continue; } // nichts referenziert → idempotent ok
        const { error } = await q;
        if (error) { await markDone(it.id, 'failed', error.message); failed++; continue; }
        await markDone(it.id, 'synced'); done++; // gelöscht ODER nicht vorhanden → idempotenter Erfolg
      } catch (e) { await markDone(it.id, 'failed', String(e && e.message || e)); failed++; }
    }
    return { flushed: done, failed: failed, total: items.length };
  }

  // Bei Logout/Kontowechsel: Queue NICHT automatisch löschen (Datenverlust vermeiden),
  // aber Flush immer strikt user-gefiltert. Explizites Purge nur auf Wunsch.
  async function purgeUser(userId) {
    try {
      const db = await idb();
      await new Promise((res) => {
        const tx = db.transaction(STORE, 'readwrite');
        const idx = tx.objectStore(STORE).index('user_id');
        const cur = idx.openCursor(IDBKeyRange.only(userId));
        cur.onsuccess = () => { const c = cur.result; if (c) { c.delete(); c.continue(); } };
        tx.oncomplete = res;
      });
    } catch (e) {}
  }

  O.offlineQueue = { enqueue, flush, pendingForCurrentUser, purgeUser };
  window.addEventListener('online', () => { try { flush(); } catch (e) {} });
})();
