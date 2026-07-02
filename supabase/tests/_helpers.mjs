/* ============================================================
   ORVIA · _helpers — gemeinsame Test-Utilities (P0, TEST-GAP-PLAN)
   Laufzeit-agnostisch (Node UND Deno): keine node:-Imports im Kern.
   Inhalt:
     fixedClock(startMs)        — feste, steuerbare Uhr für ORVIA.clock
     installClock(O, clock)     — Uhr in eine geladene ORVIA-Instanz injizieren
     localStorageStub()         — inspizierbarer localStorage-Ersatz
     fakeSupabase(tables)       — minimaler from()-Builder (select/eq/limit/
                                  maybeSingle/upsert/insert/delete) je Tabelle
   Konvention: Helpers verändern NIE Produktionsverhalten; Injektion läuft
   ausschließlich über ORVIA.clock._setImplementation bzw. window-Stubs.
   ============================================================ */

/* Feste Uhr. now() liefert startMs, advance(ms)/set(ms) steuern die Zeit. */
export function fixedClock(startMs) {
  let t = Number(startMs);
  if (!Number.isFinite(t)) throw new Error('fixedClock: startMs (ms) erforderlich');
  return {
    now: () => t,
    advance(ms) { t += ms; return t; },
    set(ms) { t = Number(ms); return t; },
    iso() { return new Date(t).toISOString(); }
  };
}

/* Uhr in eine ORVIA-Instanz injizieren.
   Variante A: Modul js/clock.js ist geladen → _setImplementation nutzen.
   Variante B: reine Stub-Umgebung → O.clock direkt setzen.
   Rückgabe: uninstall() stellt den Ausgangszustand wieder her. */
export function installClock(O, clock) {
  if (O && O.clock && typeof O.clock._setImplementation === 'function') {
    O.clock._setImplementation(clock);
    return { uninstall: () => O.clock._setImplementation(null) };
  }
  const prev = O ? O.clock : undefined;
  if (O) O.clock = { now: clock.now };
  return { uninstall: () => { if (O) O.clock = prev; } };
}

/* Inspizierbarer localStorage-Stub (Map-basiert, mit .dump() für Asserts). */
export function localStorageStub(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    key: i => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
    dump: () => Object.fromEntries(m)
  };
}

/* Minimaler Supabase-from()-Stub.
   tables: { <name>: { rows?: [...], onUpsert?, onInsert?, onDelete?, error? } }
   Unterstützt die in ORVIA üblichen Ketten:
     from(t).select(...).eq(...).limit(n).maybeSingle()
     from(t).upsert(payload, opts).select()
     from(t).insert(payload) / .delete().eq(...)
   calls[] protokolliert alle Operationen für Side-Effect-Asserts. */
export function fakeSupabase(tables) {
  const calls = [];
  function builder(name) {
    const cfg = (tables && tables[name]) || {};
    let filters = [];
    const api = {
      select() { return api; },
      eq(col, val) { filters.push([col, val]); return api; },
      limit() { return api; },
      order() { return api; },
      maybeSingle() {
        calls.push({ table: name, op: 'select', filters: [...filters] });
        if (cfg.error) return Promise.resolve({ data: null, error: cfg.error });
        const rows = (cfg.rows || []).filter(r => filters.every(([c, v]) => r[c] === v));
        return Promise.resolve({ data: rows[0] || null, error: null });
      },
      then(resolve, reject) { // await-bare Kette (z. B. delete().eq())
        calls.push({ table: name, op: 'await', filters: [...filters] });
        return Promise.resolve({ data: null, error: cfg.error || null }).then(resolve, reject);
      },
      upsert(payload, opts) {
        calls.push({ table: name, op: 'upsert', payload, opts });
        const r = cfg.onUpsert ? cfg.onUpsert(payload, opts) : { data: [payload], error: null };
        return { select: () => Promise.resolve(r), then: (res, rej) => Promise.resolve(r).then(res, rej) };
      },
      insert(payload) {
        calls.push({ table: name, op: 'insert', payload });
        return Promise.resolve(cfg.onInsert ? cfg.onInsert(payload) : { data: [payload], error: null });
      },
      delete() {
        calls.push({ table: name, op: 'delete' });
        return api;
      }
    };
    return api;
  }
  return { from: builder, calls };
}
