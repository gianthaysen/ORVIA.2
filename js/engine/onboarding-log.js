/* ============================================================
   ORVIA · engine/onboarding-log — B-04, Teil 3: Schritt-Logging (Beobachter)

   WOFÜR. „Abbruchquoten-Logging je Schritt" — wo bleiben neue Nutzer im
   Onboarding haengen? Der Draft liegt nur im localStorage; die App wusste
   es nicht. Dieses Modul sammelt Schrittereignisse und reicht sie an eine
   Senke (onboarding_step_log, Migration 0041). Muster goal-shadow:
   BEOBACHTER — ein Fehler hier aendert nie den Ablauf; ohne Senke oder ohne
   Sitzung wird nicht geschrieben, sondern gezaehlt (stats().noSink /
   .skipped), damit „0 Zeilen" nicht wie „0 Ereignisse" aussieht.

   REIN bis zur Senke: kein DOM, keine Uhr (now injiziert), keine IDs
   erfunden (eventId injiziert).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'onboarding-log@1';
  var TYPES = ['open', 'enter', 'complete', 'skip', 'back', 'finish'];
  var _sink = null;
  var _stats = { attempted: 0, written: 0, failed: 0, noSink: 0, invalid: 0, lastReason: null };

  function validate(ev) {
    var f = [];
    if (!ev || typeof ev !== 'object') return ['event_missing'];
    if (TYPES.indexOf(ev.eventType) < 0) f.push('event_type_unbekannt:' + String(ev.eventType));
    if (!ev.stepId || typeof ev.stepId !== 'string') f.push('step_id_fehlt');
    if (!ev.eventId || typeof ev.eventId !== 'string') f.push('event_id_fehlt');
    if (!ev.now || typeof ev.now !== 'string') f.push('now_fehlt');
    return f;
  }

  /* logStep(ev) → { ok, reason } — ev: { eventType, stepId, fromStep, draftStatus,
     source, resumed, msOnStep, appVersion, now, eventId } */
  function logStep(ev) {
    var fehler = validate(ev);
    if (fehler.length) { _stats.invalid++; _stats.lastReason = fehler[0]; return { ok: false, reason: fehler[0] }; }
    var rec = { eventType: ev.eventType, stepId: ev.stepId, fromStep: ev.fromStep || null, draftStatus: ev.draftStatus || null,
      source: ev.source || null, resumed: ev.resumed === true, msOnStep: (typeof ev.msOnStep === 'number' && isFinite(ev.msOnStep) && ev.msOnStep >= 0) ? Math.round(ev.msOnStep) : null,
      appVersion: ev.appVersion || null, now: ev.now, eventId: ev.eventId, version: VERSION };
    if (!_sink) { _stats.noSink++; _stats.lastReason = 'no_sink'; return { ok: false, reason: 'no_sink' }; }
    _stats.attempted++;
    try {
      var r = _sink(rec);
      if (r && typeof r.then === 'function') {
        r.then(function (res) { if (res === null) { _stats.skipped = (_stats.skipped || 0) + 1; } else if (res && res.error) { _stats.failed++; _stats.lastReason = String(res.error.message || res.error); } else { _stats.written++; } },
          function (e) { _stats.failed++; _stats.lastReason = String((e && e.message) || e); });
      } else if (r === null) { _stats.skipped = (_stats.skipped || 0) + 1; }
      else { _stats.written++; }
    } catch (e) { _stats.failed++; _stats.lastReason = String((e && e.message) || e); }
    return { ok: true, reason: null };
  }

  function toRow(rec, userId) {
    if (!rec || !userId) return null;
    return { user_id: userId, event_id: rec.eventId, event_type: rec.eventType, step_id: rec.stepId, from_step: rec.fromStep,
      draft_status: rec.draftStatus, source: rec.source, resumed: !!rec.resumed, ms_on_step: rec.msOnStep, occurred_at: rec.now, app_version: rec.appVersion };
  }
  function setSink(fn) { _sink = (typeof fn === 'function') ? fn : null; }
  function stats() { return Object.assign({ sink: !!_sink }, _stats); }
  function _resetForTest() { _sink = null; _stats = { attempted: 0, written: 0, failed: 0, noSink: 0, invalid: 0, lastReason: null }; }

  var api = { VERSION: VERSION, TYPES: TYPES, validate: validate, logStep: logStep, toRow: toRow, setSink: setSink, stats: stats, _resetForTest: _resetForTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.onboardingLog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
