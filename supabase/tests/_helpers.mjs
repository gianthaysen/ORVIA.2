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

/* Mini-DOM für Komponenten-Tests (M2): echte Element-Bäume ohne Layout.
   Unterstützt createElement, append/textContent, Attribute, classList, Events
   (click/keydown/focus via dispatchEvent), focus→document.activeElement,
   querySelector('.cls' | '#id' | 'tag') als Tiefensuche. */
export function createMiniDom() {
  const doc = {
    activeElement: null,
    createElement(tag) { return makeEl(tag); },
    body: null
  };
  function matches(el, sel) {
    if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
    if (sel.startsWith('#')) return el.id === sel.slice(1);
    return el.tagName === sel.toUpperCase();
  }
  function makeEl(tag) {
    const listeners = {};
    const el = {
      tagName: String(tag).toUpperCase(), id: '', children: [], parentNode: null,
      style: {}, disabled: false, _text: '',
      attributes: {},
      classList: {
        _s: new Set(),
        add(...c) { c.forEach(x => this._s.add(x)); }, remove(...c) { c.forEach(x => this._s.delete(x)); },
        toggle(c, v) { (v === undefined ? !this._s.has(c) : v) ? this._s.add(c) : this._s.delete(c); },
        contains(c) { return this._s.has(c); }
      },
      get className() { return Array.from(this.classList._s).join(' '); },
      set className(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
      setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = String(v); },
      getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
      removeAttribute(k) { delete this.attributes[k]; },
      hasAttribute(k) { return k in this.attributes; },
      appendChild(c) { c.parentNode = el; this.children.push(c); return c; },
      set textContent(v) { this._text = String(v); this.children = []; },
      get textContent() { return this._text + this.children.map(c => c.textContent).join(''); },
      addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
      removeEventListener(t, fn) { listeners[t] = (listeners[t] || []).filter(f => f !== fn); },
      dispatchEvent(evt) { evt.target = evt.target || el; (listeners[evt.type] || []).slice().forEach(fn => fn.call(el, evt)); return true; },
      click() { if (el.disabled) return; el.dispatchEvent({ type: 'click', preventDefault() {} }); },
      focus() { doc.activeElement = el; el.dispatchEvent({ type: 'focus' }); },
      querySelector(sel) { return findAll(el, sel)[0] || null; },
      querySelectorAll(sel) { return findAll(el, sel); }
    };
    return el;
  }
  function findAll(root, sel) {
    const out = [];
    (function walk(n) { n.children.forEach(c => { if (matches(c, sel)) out.push(c); walk(c); }); })(root);
    return out;
  }
  doc.body = makeEl('body');
  return { document: doc, makeEl };
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
