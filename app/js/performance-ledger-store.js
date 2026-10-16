/* ============================================================
   ORVIA · performance-ledger-store (v8-448A, VORBEREITET) — fuehrt das Leistungsregister nach.

   SCHALTER: Flag `performance_ledger` (engine/feature-flags.js, serverseitig, fail-closed). Ist es
   nicht ausdruecklich an, tut dieses Modul NICHTS: keine Berechnung, kein Speicher, kein Netz.
   Heute ist es zusaetzlich nicht ausgeliefert (nicht in index.html); das Einhaengen kommt mit dem
   Einschalt-Schritt (v8-448B, nach Migration 0051).

   ABLAUF refresh(activities):
     1. Zwischenspeicher lesen (kompakt, je Nutzer, je Rechenversion) — sonst leerer Zustand
     2. performanceLedger.update(): nur neue / geaenderte / verschwundene Aktivitaeten werden geprueft,
        nur deren Kennzahlen neu berechnet (Tausende Aktivitaeten: kein Neuauswerten bei jedem Oeffnen)
     3. vom Server als „neu zu berechnen" vermerkte Kennzahlen (Loeschung auf einem anderen Geraet)
        werden mitgeschickt
     4. Zwischenspeicher schreiben; Aenderungen in EINER Server-Transaktion speichern
   Fehler beim Speichern lassen die Berechnung gelten und versuchen es beim naechsten Mal erneut
   (pending). Abhaengigkeiten werden hereingegeben (Tests) oder aus window.ORVIA genommen.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var FLAG = 'performance_ledger';

  function deps(d) {
    d = d || {};
    return {
      ledger: d.ledger || O.performanceLedger,
      flags: d.flags || O.featureFlags,
      repo: d.repo || O.performanceLedgerRepository,
      storage: d.storage !== undefined ? d.storage : (function () { try { return root.localStorage; } catch (e) { return null; } })(),
      uid: d.uid || function () { return (O.user && O.user.id) || null; }
    };
  }
  function enabled(d) {
    var x = deps(d);
    try { return !!(x.flags && typeof x.flags.isEnabled === 'function' && x.flags.isEnabled(FLAG) === true); } catch (e) { return false; }
  }
  function cacheKey(x) { var u = x.uid(); return u ? 'orvia_perf_ledger_' + x.ledger.CALC_VERSION + '_' + u : null; }

  var _state = null, _pending = null, _uid = null;      // Zustand gehoert genau EINEM Nutzer

  function load(x) {
    var k = cacheKey(x);
    if (!k || !x.storage) return null;
    try { var t = x.storage.getItem(k); return t ? x.ledger.deserialize(t) : null; } catch (e) { return null; }
  }
  function save(x, state) {
    var k = cacheKey(x);
    if (!k || !x.storage) return false;
    try { x.storage.setItem(k, x.ledger.serialize(state)); return true; } catch (e) { return false; }   // voll / gesperrt: Zustand bleibt im Speicher
  }

  async function refresh(activities, opts, d) {
    var x = deps(d);
    if (!enabled(d)) return { ok: false, code: 'disabled' };
    if (!x.ledger) return { ok: false, code: 'no_engine' };
    if (!x.uid()) return { ok: false, code: 'no_user' };
    if (_uid !== x.uid()) { _state = null; _pending = null; _uid = x.uid(); }   // Kontowechsel: nie fremden Zustand weiterfuehren
    var prev = _state || load(x);
    var res = x.ledger.update(prev, activities, opts || {});
    var ch = res.changes;
    var dirty = [];
    if (x.repo && typeof x.repo.dirtyKeys === 'function') {
      try { var dk = await x.repo.dirtyKeys(x.ledger.CALC_VERSION); if (dk && dk.success && Array.isArray(dk.data)) dirty = dk.data; } catch (e) {}
    }
    _state = res.state;
    save(x, _state);
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
    return { ok: true, changes: ch, dirty: dirty, persisted: persisted, pending: !!_pending, model: x.ledger.readModel(_state) };
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
  function model(d) { var x = deps(d); return (enabled(d) && _state && x.ledger && _uid === x.uid()) ? x.ledger.readModel(_state) : null; }
  function _reset() { _state = null; _pending = null; _uid = null; }

  var api = { FLAG: FLAG, CHUNK: CHUNK, enabled: enabled, refresh: refresh, model: model, _reset: _reset };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.performanceLedgerStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
