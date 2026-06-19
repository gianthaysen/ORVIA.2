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

  // Schreiboperation in die Queue legen (z.B. wenn offline). table + onConflict + record.
  async function enqueue(table, record, onConflict) {
    const u = uid(); if (!u) return { ok: false, error: 'no_session' };
    const env = {
      user_id: u, table: table, on_conflict: onConflict || null,
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
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
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

  async function markDone(id, status) {
    try {
      const db = await idb();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const get = store.get(id);
        get.onsuccess = () => {
          const v = get.result; if (!v) return;
          if (status === 'synced') { store.delete(id); }
          else { v.sync_status = status; store.put(v); }
        };
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    } catch (e) {}
  }

  // Flush: NUR Einträge der aktuellen user_id, über die Repositories/Supabase.
  async function flush() {
    const u = uid(); if (!u || !O.sb) return { flushed: 0 };
    if (!navigator.onLine) return { flushed: 0, offline: true };
    const items = await pendingForCurrentUser();
    let done = 0;
    for (const it of items) {
      if (it.user_id !== u) continue; // Sicherheits-Doppelprüfung: nie fremde Daten
      try {
        const q = O.sb.from(it.table).upsert(it.payload, it.on_conflict ? { onConflict: it.on_conflict } : undefined);
        const { error } = await q;
        await markDone(it.id, error ? 'failed' : 'synced');
        if (!error) done++;
      } catch (e) { await markDone(it.id, 'failed'); }
    }
    return { flushed: done, total: items.length };
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
