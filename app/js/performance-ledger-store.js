/* ============================================================
   ORVIA · performance-ledger-store (v8-448B) — fuehrt das Leistungsregister nach.

   SCHALTER: Flag `performance_ledger` (engine/feature-flags.js, serverseitig, fail-closed). Ist es nicht
   ausdruecklich an, tut dieses Modul NICHTS: keine Berechnung, kein Speicher, kein Netz, keine Anzeige.
   Die Entscheidung haelt fuer die Sitzung (das Flag-Modul laesst seinen Wert nach 5 min verfallen; ein
   Umspringen mitten in der Nutzung waere ein halb umgeschalteter Zustand). Abgeschaltet wird sofort, wenn
   der Server ausdruecklich „aus" liefert oder der Notschalter greift.

   ZWEI EINGAENGE
     sync()     v8-448B, der regulaere Weg: liest den VOLLSTAENDIGEN Bestand vom Server — zuerst einen
                schlanken Index (id, updated_at, Kopplung) ueber alle Seiten, dann nur geaenderte Aktivitaeten
                mit genau den Feldern der Pruefung. Fehlen gilt nur dann als Loeschung, wenn der Index
                vollstaendig gelesen UND die Gegenprobe (existingIds) die Abwesenheit bestaetigt hat.
                Lokal geloeschte Einheiten (Tombstones) zaehlen als ausdrueckliche Loeschung.
     refresh(activities)  Rechnen aus einer uebergebenen Liste (Tests, Werkzeuge). opts.partial wie im Kern.
   dryRun()   Echtdaten-Probelauf: liest, rechnet, vergleicht mit den bisherigen Bestzeiten — schreibt NICHTS
              (kein Zwischenspeicher, kein Server, kein Zustand), auch bei ausgeschaltetem Flag.

   ZWISCHENSPEICHER: IndexedDB (je Nutzer, je Rechenversion). localStorage nur als Rueckfall und nur bis
   ~1,5 MB — iPhone-Safari begrenzt localStorage auf etwa 5 MB fuer die GANZE App. Ein alter Eintrag aus
   v8-448A (localStorage) wird einmal uebernommen und dort geloescht. App-Start = Zwischenspeicher lesen +
   Index vergleichen; neu geprueft wird nur, was sich geaendert hat.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var FLAG = 'performance_ledger';
  var LS_LIMIT = 1500000;
  var MIN_INTERVAL_MS = 60000;

  /* ---- Zwischenspeicher ------------------------------------------------------------------- */
  function idbCache(idb) {
    var DB = 'orvia-ledger', ST = 'kv';
    function open() {
      return new Promise(function (res, rej) {
        try {
          var r = idb.open(DB, 1);
          r.onupgradeneeded = function () { try { r.result.createObjectStore(ST); } catch (e) {} };
          r.onsuccess = function () { res(r.result); };
          r.onerror = function () { rej(r.error || new Error('idb_open')); };
          r.onblocked = function () { rej(new Error('idb_blocked')); };
        } catch (e) { rej(e); }
      });
    }
    function tx(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction(ST, mode), st = t.objectStore(ST), out = fn(st);
          t.oncomplete = function () { db.close(); res(out && out.result !== undefined ? out.result : undefined); };
          t.onerror = t.onabort = function () { db.close(); rej(t.error || new Error('idb_tx')); };
        });
      });
    }
    return {
      kind: 'indexeddb',
      get: function (k) { return tx('readonly', function (st) { return st.get(k); }).then(function (v) { return v == null ? null : v; }); },
      set: function (k, v) { return tx('readwrite', function (st) { st.put(v, k); }).then(function () { return true; }); },
      del: function (k) { return tx('readwrite', function (st) { st.delete(k); }).then(function () { return true; }); }
    };
  }
  function lsCache(ls) {
    return {
      kind: 'localStorage',
      get: function (k) { try { return Promise.resolve(ls.getItem(k)); } catch (e) { return Promise.resolve(null); } },
      set: function (k, v) { try { if (String(v).length > LS_LIMIT) return Promise.resolve(false); ls.setItem(k, v); return Promise.resolve(true); } catch (e) { return Promise.resolve(false); } },
      del: function (k) { try { ls.removeItem(k); } catch (e) {} return Promise.resolve(true); }
    };
  }
  function defaultCache() {
    try { if (root.indexedDB) return idbCache(root.indexedDB); } catch (e) {}
    try { if (root.localStorage) return lsCache(root.localStorage); } catch (e) {}
    return null;
  }

  function deps(d) {
    d = d || {};
    return {
      ledger: d.ledger || O.performanceLedger,
      flags: d.flags || O.featureFlags,
      repo: d.repo || O.performanceLedgerRepository,
      cache: d.cache !== undefined ? d.cache : (d.storage ? lsCache(d.storage) : defaultCache()),
      legacyStorage: d.storage !== undefined ? d.storage : (function () { try { return root.localStorage; } catch (e) { return null; } })(),
      normalize: d.normalize || function (r) { return (O.activityConfig && O.activityConfig.normalizeServerActivity) ? O.activityConfig.normalizeServerActivity(r) : r; },
      tombstones: d.tombstones || function () { try { return (O.activityStore && O.activityStore.tombstones) ? (O.activityStore.tombstones() || []) : []; } catch (e) { return []; } },
      declared: d.declared || declaredFromProfile,
      raceIds: d.raceIds || confirmedRaceIds,
      now: d.now || function () { return Date.now(); },
      uid: d.uid || function () { return (O.user && O.user.id) || null; },
      emit: d.emit || function (name, detail) { try { root.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {} },
      timeZone: d.timeZone
    };
  }

  /* ---- Schalter (Sitzungsentscheidung) ---------------------------------------------------- */
  var _decision = false;
  function enabled(d) {
    var x = deps(d), f = x.flags;
    try {
      if (!f) return false;
      if (typeof f.describe === 'function') {
        var s = f.describe(FLAG);
        if (!s || !s.known) return false;
        if (s.source === 'kill_switch') { _decision = false; return false; }
        if (!s.stale) { _decision = s.enabled === true; return _decision; }
        return _decision;                                    // abgelaufen: letzte ausdrueckliche Entscheidung haelt
      }
      return typeof f.isEnabled === 'function' && f.isEnabled(FLAG) === true;
    } catch (e) { return false; }
  }

  /* v8-449.1 · Wettkampfbestzeiten: NUR Aktivitaeten, die der Nutzer im Ziel als Wettkampfergebnis BESTAETIGT hat
     (goal.result.activityId). Die automatische Zuordnung eines Laufs zum Wettkampftag (race-result.match) zaehlt nicht. */
  function confirmedRaceIds() {
    try {
      var gl = typeof root.listGoals === 'function' ? (root.listGoals() || []) : [];
      return gl.filter(function (g) { return g && g.result && g.result.activityId; }).map(function (g) { return String(g.result.activityId); });
    } catch (e) { return []; }
  }

  /* Angegebene Bestzeiten aus dem Profil (manuell, auch vor ORVIA) → declared je Kennzahl */
  var DECL_MAP = { '1 km': 1000, '5 km': 5000, '10 km': 10000, '21.0975 km': 21098, 'Halbmarathon': 21098, '42.195 km': 42195, 'Marathon': 42195 };
  function declaredFromProfile() {
    var out = {};
    try {
      var P = root.PROFILE, list = P && P.performance && Array.isArray(P.performance.personalBests) ? P.performance.personalBests : [];
      list.forEach(function (pb) {
        if (!pb || pb.source === 'activity' || pb.sportId !== 'running' || !(pb.timeSeconds > 0)) return;
        var t = DECL_MAP[String(pb.distance || '').trim()]; if (!t) return;
        var k = 'running.fastest_' + t + 'm@standard';
        if (!out[k] || pb.timeSeconds < out[k].value) out[k] = { value: pb.timeSeconds, label: pb.distance, measuredAt: pb.measuredAt || null, source: pb.source || 'manual' };
      });
    } catch (e) {}
    return out;
  }

  function cacheKey(x, uid) { return 'orvia_perf_ledger_' + x.ledger.CALC_VERSION + '_' + uid; }

  var _state = null, _pending = null, _uid = null, _last = null, _running = null, _meta = null;

  async function load(x, uid) {
    if (!x.cache) return null;
    var k = cacheKey(x, uid), t = null;
    try { t = await x.cache.get(k); } catch (e) { t = null; }
    if (!t && x.cache.kind === 'indexeddb' && x.legacyStorage) {          // Uebernahme aus v8-448A (localStorage)
      try { t = x.legacyStorage.getItem(k); if (t) { x.legacyStorage.removeItem(k); } } catch (e) { t = null; }
    }
    return t ? x.ledger.deserialize(t) : null;
  }
  async function save(x, uid, state) {
    if (!x.cache) return false;
    try { return await x.cache.set(cacheKey(x, uid), x.ledger.serialize(state)); } catch (e) { return false; }   // voll/gesperrt: Zustand bleibt im Speicher
  }
  function adoptUser(x) {
    var u = x.uid();
    if (_uid !== u) { _state = null; _pending = null; _last = null; _meta = null; _uid = u; }   // Kontowechsel: nie fremden Zustand weiterfuehren
    return u;
  }

  /* ---- Eingang 1: uebergebene Liste --------------------------------------------------------- */
  async function refresh(activities, opts, d) {
    var x = deps(d);
    if (!enabled(d)) return { ok: false, code: 'disabled' };
    if (!x.ledger) return { ok: false, code: 'no_engine' };
    var uid = adoptUser(x);
    if (!uid) return { ok: false, code: 'no_user' };
    var prev = _state || await load(x, uid);
    var res = x.ledger.update(prev, activities, Object.assign({ timeZone: x.timeZone, raceIds: x.raceIds() }, opts || {}));
    return finish(x, uid, res, [], { source: 'list' });
  }

  /* ---- Eingang 2: vollstaendiger Bestand vom Server -------------------------------------------- */
  async function collect(x, prev) {
    var idx = await x.repo.listActivityIndex();
    if (!idx || !idx.success) return { ok: false, code: (idx && idx.error && idx.error.code) || 'index_failed' };
    var rows = idx.data.rows || [], complete = idx.data.complete === true;
    var known = {}; rows.forEach(function (r) { known[r.id] = true; });
    var have = prev ? x.ledger.updatedAtMap(prev) : {};
    var stale = !prev || prev.rules !== x.ledger.ruleSignature();
    var linked = rows.filter(function (r) { return r.linked_activity_id && known[r.linked_activity_id]; }).map(function (r) { return r.id; });
    var linkedSet = {}; linked.forEach(function (id) { linkedSet[id] = true; });
    var tomb = {};
    (x.tombstones() || []).forEach(function (t) { var id = t && (t.serverId || t.id); if (id) tomb[String(id)] = true; });   // activityStore: { serverId, clientRecordId, … }
    /* v8-449.1: ein neu bestaetigtes (oder zurueckgenommenes) Wettkampfergebnis aendert die Zeile nicht — die Aktivitaet
       wird trotzdem neu geprueft, sonst erschiene die Wettkampfbestzeit erst nach der naechsten Aenderung. */
    var raceSet = {}; (x.raceIds() || []).forEach(function (id) { raceSet[String(id)] = true; });
    var raceChanged = function (r) {
      if (!prev || !prev.activities[r.id]) return false;
      var was = /\|race$/.test(prev.activities[r.id].fp || ''), now = !!(raceSet[r.id] || (r.client_record_id && raceSet[r.client_record_id]));
      return was !== now;
    };
    var wanted = rows.filter(function (r) { return !linkedSet[r.id] && !tomb[r.id] && (stale || !(r.id in have) || have[r.id] !== r.updated_at || raceChanged(r)); }).map(function (r) { return r.id; });
    var got = wanted.length ? await x.repo.fetchActivities(wanted) : { success: true, data: [] };
    if (!got || !got.success) return { ok: false, code: 'fetch_failed' };
    var acts = got.data.map(function (r) { var a = x.normalize(r); if (a && !a.updatedAt) a.updatedAt = r.updated_at || null; return a; });
    /* Loeschungen: nur ausdrueckliche (Tombstone) — und Abwesenheit im VOLLSTAENDIGEN Index, gegengeprueft. */
    var deleted = Object.keys(tomb);
    if (complete && prev) {
      var cand = Object.keys(have).filter(function (id) { return !known[id]; });
      if (cand.length) {
        var ex = await x.repo.existingIds(cand);
        if (ex && ex.success) { var still = {}; (ex.data || []).forEach(function (id) { still[id] = true; }); cand.forEach(function (id) { if (!still[id]) deleted.push(id); }); }
      }
    }
    return { ok: true, acts: acts, deleted: deleted.concat(linked.filter(function (id) { return id in have; })), knownIds: known, complete: complete,
             indexed: rows.length, fetched: acts.length, linked: linked.length, stale: stale };
  }

  async function sync(opts, d) {
    var o = opts || {}, x = deps(d);
    if (!o.dryRun && !enabled(d)) return { ok: false, code: 'disabled' };
    if (!x.ledger || !x.repo || typeof x.repo.listActivityIndex !== 'function') return { ok: false, code: 'no_engine' };
    var uid = o.dryRun ? x.uid() : adoptUser(x);
    if (!uid) return { ok: false, code: 'no_user' };
    if (!o.dryRun && !o.force && _last && x.now() - _last < MIN_INTERVAL_MS) return { ok: true, code: 'throttled', model: model(d) };
    if (!o.dryRun && _running) return _running;
    var run = (async function () {
      var prev = o.dryRun ? null : (_state || await load(x, uid));
      var c = await collect(x, prev);
      if (!c.ok) return c;
      var res = x.ledger.update(prev, c.acts, { timeZone: x.timeZone, partial: true, deletedIds: c.deleted, knownIds: c.knownIds, raceIds: x.raceIds() });
      var meta = { source: 'server', complete: c.complete, indexed: c.indexed, fetched: c.fetched, linked: c.linked, deleted: c.deleted.length, rebuilt: res.changes.rebuilt };
      if (o.dryRun) return { ok: true, dryRun: true, meta: meta, model: x.ledger.readModel(res.state, { declared: x.declared() }), state: res.state, changes: res.changes };
      return finish(x, uid, res, [], meta);
    })();
    if (!o.dryRun) { _running = run; try { return await run; } finally { _running = null; } }
    return run;
  }

  async function finish(x, uid, res, extraDirty, meta) {
    var ch = res.changes;
    var dirty = (extraDirty || []).slice();
    if (x.repo && typeof x.repo.dirtyKeys === 'function') {
      try { var dk = await x.repo.dirtyKeys(x.ledger.CALC_VERSION); if (dk && dk.success && Array.isArray(dk.data)) dirty = dirty.concat(dk.data); } catch (e) {}
    }
    _state = res.state; _last = x.now(); _meta = meta || null;
    var saved = await save(x, uid, _state);
    var keys = {};
    ch.affectedKeys.concat(dirty).forEach(function (k) { keys[k] = true; });
    var touched = ch.added.concat(ch.updated);
    var persisted = null;
    var work = { activityIds: touched.concat(ch.removed), touched: touched, metricKeys: Object.keys(keys).sort(), log: ch.log, milestones: !!(ch.affectedKeys.length || ch.rebuilt || dirty.length) };
    if (_pending) work = mergeWork(_pending, work);
    if ((work.activityIds.length || work.metricKeys.length) && x.repo && typeof x.repo.apply === 'function') {
      persisted = await persist(x, work);
      _pending = (persisted && persisted.success) ? null : work;
    }
    var m = x.ledger.readModel(_state, { declared: x.declared() });
    x.emit('orvia:ledger-updated', { affected: ch.affectedKeys.length, removed: ch.removed.length, empty: m.empty });
    return { ok: true, changes: ch, dirty: dirty, persisted: persisted, pending: !!_pending, cached: saved, meta: meta, model: m };
  }

  /* In Teilen: erst die Eintraege (je CHUNK Aktivitaeten), zuletzt Ereignisse, Meilensteine und Protokoll.
     Bricht ein Teil ab, bleibt die ganze Arbeit offen (pending) und wird beim naechsten Mal wiederholt — jeder
     Teil ist fuer sich idempotent (ersetzt genau die Eintraege seiner Aktivitaeten). */
  var CHUNK = 250;
  async function persist(x, work) {
    var cv = x.ledger.CALC_VERSION;
    var live = work.touched.filter(function (id) { return !!_state.activities[id]; });
    var gone = work.activityIds.filter(function (id) { return !_state.activities[id]; });
    try {
      for (var i = 0; i < Math.max(live.length, 1); i += CHUNK) {
        var ids = live.slice(i, i + CHUNK), part = x.ledger.rows(_state, ids, []);
        if (!ids.length && !gone.length) break;
        var r1 = await x.repo.apply({ calcVersion: cv, activityIds: ids.concat(i === 0 ? gone : []), entries: part.entries, metricKeys: [], events: [], milestones: null, log: [] });
        if (!r1 || !r1.success) return r1 || { success: false };
      }
      var fin = x.ledger.rows(_state, [], work.metricKeys);
      return await x.repo.apply({ calcVersion: cv, activityIds: [], entries: [], metricKeys: work.metricKeys, events: fin.events,
                                  milestones: work.milestones ? fin.milestones : null, log: work.log });
    } catch (e) { return { success: false, error: { code: 'exception', message: String(e && e.message || e) } }; }
  }
  function mergeWork(a, b) {
    var u = function (p, q) { var m = {}; p.concat(q).forEach(function (v) { m[v] = true; }); return Object.keys(m).sort(); };
    return { activityIds: u(a.activityIds, b.activityIds), touched: u(a.touched, b.touched), metricKeys: u(a.metricKeys, b.metricKeys),
             log: a.log.concat(b.log), milestones: a.milestones || b.milestones };
  }

  /* ---- Lesen ---------------------------------------------------------------------------- */
  function ready(d) { var x = deps(d); return !!(enabled(d) && _state && x.ledger && _uid && _uid === x.uid()); }
  function model(d) { var x = deps(d); return ready(d) ? x.ledger.readModel(_state, { declared: x.declared() }) : null; }
  function entryOf(activityId, defId, d) { var x = deps(d); return ready(d) ? x.ledger.entryOf(_state, activityId, defId) : null; }
  function bestOf(metricKey, d) { var x = deps(d); if (!ready(d)) return null; var ev = _state.events[metricKey]; return ev ? x.ledger.currentBest(ev) : null; }
  function meta() { return _meta; }

  /* ---- Echtdaten-Probelauf (schreibt nichts) ------------------------------------------------- */
  async function dryRun(opts, d) {
    var r = await sync(Object.assign({}, opts || {}, { dryRun: true }), d);
    if (!r.ok) return r;
    var B = O.recordsBridge;
    var cmp = B && B.compareWithLegacy ? B.compareWithLegacy(r.state, opts && opts.activities) : null;
    var rep = { meta: r.meta, calcVersion: r.model.calcVersion, empty: r.model.empty,
      records: [], waiting: r.model.waiting, milestones: r.model.milestones.map(function (m) { return { id: m.milestoneId, date: m.localDate, value: m.value, unit: m.unit }; }),
      legacyComparison: cmp };
    r.model.sports.forEach(function (s) { s.records.forEach(function (rec) {
      rep.records.push({ metricKey: rec.metricKey, best: rec.best && rec.best.value, unit: rec.unit, date: rec.best && rec.best.localDate, improvements: rec.improvements,
                         activityId: rec.best && rec.best.activityId, validation: rec.provenance && rec.provenance.validation, source: rec.provenance && rec.provenance.source }); }); });
    return { ok: true, dryRun: true, report: rep };
  }

  function _reset() { _state = null; _pending = null; _uid = null; _last = null; _running = null; _meta = null; _decision = false; }

  /* Selbststart: nach Anmeldung, nach dem Abruf neuer Aktivitaeten und nach einer Aenderung — gebuendelt.
     Bei ausgeschaltetem Flag kehrt sync() sofort zurueck (kein Netz, kein Speicher). */
  var _timer = null;
  function schedule(ms) {
    try { if (_timer) clearTimeout(_timer); _timer = setTimeout(function () { _timer = null;
      try { var f = O.featureFlags; if (f && typeof f.describe === 'function' && f.describe(FLAG).stale && typeof f.refresh === 'function') { f.refresh().then(function () { sync(); }, function () { sync(); }); return; } } catch (e) {}
      sync(); }, ms); } catch (e) {}
  }
  if (typeof root.addEventListener === 'function' && typeof root.document !== 'undefined') {
    root.addEventListener('orvia:auth-ready', function () { schedule(4000); });
    root.addEventListener('orvia:activities-pulled', function () { schedule(1500); });
    root.addEventListener('orvia:activity-updated', function () { schedule(3000); });
  }

  var api = { FLAG: FLAG, CHUNK: CHUNK, LS_LIMIT: LS_LIMIT, MIN_INTERVAL_MS: MIN_INTERVAL_MS, enabled: enabled, ready: ready, refresh: refresh, sync: sync, dryRun: dryRun,
              model: model, entryOf: entryOf, bestOf: bestOf, meta: meta, idbCache: idbCache, lsCache: lsCache, declaredFromProfile: declaredFromProfile, _reset: _reset };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.performanceLedgerStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
