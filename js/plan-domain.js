/* ============================================================
   ORVIA · plan-domain — kanonisches Wochenplan-Modell (Phase 5C, 2026-08-05)
   ------------------------------------------------------------
   Baseline + Patch (Umsetzungsplan §5.2, Entscheidungen E-16):

     {
       planId, weekKey: "2026-W32", revision,
       baseline:  { source: 'engine'|'manual_seed'|'legacy_migration',
                    engineVersion, generatedAt, snapshotId, sessions: [
                      { sessionId: 'ps:…', dayIndex: 0..6,
                        predecessorSessionId?, session: {…rohes weekPlan-Item…} } ] },
       overrides: [ { overrideId, sessionId, type: 'move'|'resize'|'replace'|'skip'|'add',
                      from?, to?, dayIndex?, durationMin?, session?, reason, createdAt } ],
       history:   [ { revision, at, reason, detail? } ]
     }

   KERNREGELN
   - Engine-Baseline und Nutzer-Overrides überschreiben einander NIE:
     Engine-Änderung ⇒ neue Baseline-Revision + rebase(); Nutzer-Änderung ⇒ Override.
   - effectiveSessions(plan) ist eine REINE Funktion (deterministisch, kein DOM,
     kein Storage, keine Uhr — Zeitstempel kommen vom Aufrufer herein).
   - Rebase NUR über stabile Identität (E-16): gleiche 'ps:'-ID oder explizite
     predecessorSessionId. 'psg:'-IDs (inhaltsabgeleitet) rebasen NIE automatisch
     ⇒ Konflikt. Titel-/Sport-/Positionsgleichheit ist KEIN Identitätsnachweis.
   - Nicht übertragbare Overrides werden verworfen — MIT Begründung in history
     (Planhistorie ist Voraussetzung für Erklärbarkeit, kein Komfortmerkmal).
   - Ohne Historie keine stillen Änderungen: jede Revision hinterlässt einen Eintrag.

   Persistenz: user_week_plans (Migration 0030, Entscheidung ①b) über
   js/repos/weekPlanRepository.js — dieses Modul kennt KEIN Supabase.
   Tests: supabase/tests/plan_domain_5c_test.mjs
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = '5c.1';
  var OVERRIDE_TYPES = { move: 1, resize: 1, replace: 1, skip: 1, add: 1 };
  var HISTORY_MAX = 50;   // Tabelle (jsonb) — großzügig, aber gedeckelt

  function _isPs(id) { return typeof id === 'string' && id.indexOf('ps:') === 0; }
  function _isPsg(id) { return typeof id === 'string' && id.indexOf('psg:') === 0; }
  function _clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }

  /* ISO-8601-Wochenschlüssel (deutsche Wochenlogik, Mo-basiert): '2026-W32'. */
  function weekKeyFor(dateKey) {
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}/.test(String(dateKey))) return null;
    var d = new Date(String(dateKey).slice(0, 10) + 'T12:00:00Z');
    if (isNaN(d.getTime())) return null;
    // ISO-Woche: Donnerstag der Woche bestimmt das Jahr.
    var t = new Date(d.getTime());
    t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
    var week1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    var wk = 1 + Math.round(((t - week1) / 864e5 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
    return t.getUTCFullYear() + '-W' + (wk < 10 ? '0' : '') + wk;
  }

  /* ---------- Baseline-Normalisierung ---------- */
  /* Legacy PROFILE.weekPlan (Array[7] von Item-Arrays) → baseline.sessions.
     Items ohne stabile 'ps:'-ID erhalten hier EINMALIG eine (E-16-Folgeaufgabe:
     generierte Pläne brauchen beim Übergang in die Persistenz eine ps:-ID, sonst
     bleibt jeder Override unrebasierbar). idFactory ist injizierbar (Tests). */
  function sessionsFromLegacyWeekPlan(weekPlan, idFactory) {
    var mk = idFactory || function (di, j) { return 'ps:mig:' + di + ':' + j + ':' + Math.random().toString(36).slice(2, 8); };
    var out = [];
    if (!Array.isArray(weekPlan)) return out;
    for (var di = 0; di < 7; di++) {
      var day = Array.isArray(weekPlan[di]) ? weekPlan[di] : [];
      for (var j = 0; j < day.length; j++) {
        var it = day[j];
        if (!it || typeof it !== 'object') continue;
        var sid = _isPs(it.id) ? it.id : mk(di, j);   // psg:/fehlend ⇒ neue stabile ps:-ID
        var s = _clone(it); s.id = sid;
        out.push({ sessionId: sid, dayIndex: di, session: s });
      }
    }
    return out;
  }

  /* Plan aus dem Legacy-Bestand (5D). meta = PROFILE.weekPlanMeta (KF-011-Stempel). */
  function fromLegacyWeekPlan(weekPlan, meta, opts) {
    opts = opts || {};
    var src = 'legacy_migration';
    var stamped = meta && meta.source;
    if (stamped === 'manual_edit') src = 'manual_seed';
    else if (stamped === 'engine_adjustment') src = 'engine';
    var now = opts.now || null;
    return {
      planId: opts.planId || ('wp:' + (opts.weekKey || 'unknown')),
      weekKey: opts.weekKey || null,
      revision: 1,
      baseline: {
        source: src,
        engineVersion: (stamped === 'engine_adjustment' && meta && meta.batchId) ? String(meta.batchId) : null,
        generatedAt: (meta && meta.at) || now,
        snapshotId: null,
        sessions: sessionsFromLegacyWeekPlan(weekPlan, opts.idFactory)
      },
      overrides: [],
      history: [{ revision: 1, at: now, reason: 'legacy_migration', detail: { legacySource: stamped || 'unknown' } }]
    };
  }

  /* ---------- Validierung ---------- */
  function validateOverride(ov) {
    var errs = [];
    if (!ov || typeof ov !== 'object') return ['override_missing'];
    if (!ov.overrideId) errs.push('overrideId_missing');
    if (!OVERRIDE_TYPES[ov.type]) errs.push('type_invalid');
    if (ov.type === 'add') {
      if (!ov.session || typeof ov.session !== 'object') errs.push('add_session_missing');
      if (!_isPs(ov.sessionId)) errs.push('add_needs_ps_id');
      if (ov.dayIndex == null || ov.dayIndex < 0 || ov.dayIndex > 6) errs.push('add_dayIndex_invalid');
    } else {
      if (!ov.sessionId) errs.push('sessionId_missing');
      if (ov.type === 'move' && (ov.dayIndex == null || ov.dayIndex < 0 || ov.dayIndex > 6)) errs.push('move_dayIndex_invalid');
      if (ov.type === 'resize' && !(ov.durationMin > 0)) errs.push('resize_duration_invalid');
      if (ov.type === 'replace' && (!ov.session || typeof ov.session !== 'object')) errs.push('replace_session_missing');
    }
    if (!ov.reason) errs.push('reason_missing');
    if (!ov.createdAt) errs.push('createdAt_missing');
    return errs;
  }

  function validatePlan(plan) {
    var errs = [];
    if (!plan || typeof plan !== 'object') return ['plan_missing'];
    if (!plan.weekKey) errs.push('weekKey_missing');
    if (!(plan.revision >= 1)) errs.push('revision_invalid');
    if (!plan.baseline || !Array.isArray(plan.baseline.sessions)) errs.push('baseline_missing');
    else {
      var seen = {};
      plan.baseline.sessions.forEach(function (bs) {
        if (!bs || !bs.sessionId) { errs.push('baseline_session_id_missing'); return; }
        if (seen[bs.sessionId]) errs.push('baseline_session_id_duplicate:' + bs.sessionId);
        seen[bs.sessionId] = 1;
        if (!(bs.dayIndex >= 0 && bs.dayIndex <= 6)) errs.push('baseline_dayIndex_invalid:' + bs.sessionId);
      });
    }
    (plan.overrides || []).forEach(function (ov) {
      validateOverride(ov).forEach(function (e) { errs.push('override:' + (ov && ov.overrideId || '?') + ':' + e); });
    });
    if (!Array.isArray(plan.history) || !plan.history.length) errs.push('history_missing');
    return errs;
  }

  /* ---------- Override anwenden (nur Liste, Wirkung erst in effectiveSessions) ---------- */
  function applyOverride(plan, ov) {
    var errs = validateOverride(ov);
    if (errs.length) return { plan: plan, error: errs.join(',') };
    var p = _clone(plan);
    /* Idempotenz je Ziel+Typ: ein neuer move auf dieselbe Session ERSETZT den alten
       (sonst stapeln sich widersprüchliche moves); add/skip/replace/resize analog.
       Der ersetzte Override wandert in die History (nichts verschwindet still). */
    var replaced = null;
    p.overrides = (p.overrides || []).filter(function (o) {
      if (o.sessionId === ov.sessionId && o.type === ov.type) { replaced = o; return false; }
      return true;
    });
    p.overrides.push(_clone(ov));
    p.history = (p.history || []).concat([{ revision: p.revision, at: ov.createdAt, reason: 'override_' + ov.type, detail: { overrideId: ov.overrideId, sessionId: ov.sessionId, replacedOverrideId: replaced ? replaced.overrideId : null } }]).slice(-HISTORY_MAX);
    return { plan: p, error: null };
  }

  /* Override zurücknehmen (Editor „Rückgängig" — gezielt, nicht global). */
  function removeOverride(plan, overrideId, at) {
    var p = _clone(plan);
    var found = null;
    p.overrides = (p.overrides || []).filter(function (o) { if (o.overrideId === overrideId) { found = o; return false; } return true; });
    if (!found) return { plan: plan, error: 'override_not_found' };
    p.history = (p.history || []).concat([{ revision: p.revision, at: at || null, reason: 'override_removed', detail: { overrideId: overrideId, type: found.type, sessionId: found.sessionId } }]).slice(-HISTORY_MAX);
    return { plan: p, error: null };
  }

  /* ---------- effectiveSessions: REINE Ableitung Baseline ⊕ Overrides ---------- */
  /* Rückgabe: { days: Array[7] von Items (Legacy-kompatible Form, id = sessionId),
                sessions: flache Liste mit Provenienz, skipped: [...] }.
     Overrides wirken in createdAt-Reihenfolge (stabil, da je Ziel+Typ max. einer). */
  function effectiveSessions(plan) {
    var map = {};   // sessionId → { dayIndex, session, provenance[] , skipped }
    ((plan && plan.baseline && plan.baseline.sessions) || []).forEach(function (bs) {
      map[bs.sessionId] = { sessionId: bs.sessionId, dayIndex: bs.dayIndex, session: _clone(bs.session), provenance: ['baseline:' + ((plan.baseline && plan.baseline.source) || '?')], skipped: false };
    });
    var ovs = ((plan && plan.overrides) || []).slice().sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); });
    var orphans = [];
    ovs.forEach(function (ov) {
      if (ov.type === 'add') {
        map[ov.sessionId] = { sessionId: ov.sessionId, dayIndex: ov.dayIndex, session: _clone(ov.session), provenance: ['override:add:' + ov.overrideId], skipped: false };
        if (map[ov.sessionId].session) map[ov.sessionId].session.id = ov.sessionId;
        return;
      }
      var t = map[ov.sessionId];
      if (!t) { orphans.push(ov.overrideId); return; }   // Ziel existiert nicht (mehr) — wirkungslos, sichtbar
      if (ov.type === 'move') { t.dayIndex = ov.dayIndex; }
      else if (ov.type === 'resize') { t.session = t.session || {}; t.session.dur = ov.durationMin; }
      else if (ov.type === 'replace') { var keep = t.sessionId; t.session = _clone(ov.session); t.session.id = keep; }
      else if (ov.type === 'skip') { t.skipped = true; }
      t.provenance.push('override:' + ov.type + ':' + ov.overrideId);
    });
    var days = [[], [], [], [], [], [], []];
    var flat = [], skipped = [];
    Object.keys(map).forEach(function (k) {
      var e = map[k];
      if (e.skipped) { skipped.push(e); return; }
      var item = e.session || {}; item.id = e.sessionId;
      days[e.dayIndex].push(item);
      flat.push(e);
    });
    return { days: days, sessions: flat, skipped: skipped, orphanOverrides: orphans };
  }

  /* ---------- Rebase (E-16): neue Engine-Baseline, Overrides übertragen ---------- */
  /* newBaseline: { source:'engine', engineVersion, generatedAt, snapshotId, sessions[] }.
     Regeln: gleiche ps:-ID ⇒ übernehmen · predecessorSessionId ⇒ retargeten ·
     psg:-Ziel ⇒ NIE automatisch (Konflikt) · sonst ⇒ verwerfen mit History-Grund.
     'add'-Overrides referenzieren keine Baseline ⇒ bleiben immer erhalten. */
  function rebase(plan, newBaseline, opts) {
    opts = opts || {};
    var at = opts.now || (newBaseline && newBaseline.generatedAt) || null;
    var p = _clone(plan);
    var ids = {};   // sessionId der neuen Baseline
    var byPred = {};   // predecessorSessionId → neue sessionId
    ((newBaseline && newBaseline.sessions) || []).forEach(function (bs) {
      ids[bs.sessionId] = 1;
      if (bs.predecessorSessionId) byPred[bs.predecessorSessionId] = bs.sessionId;
    });
    var kept = [], retargeted = [], conflicts = [], dropped = [];
    var nextOverrides = [];
    (p.overrides || []).forEach(function (ov) {
      if (ov.type === 'add') { nextOverrides.push(ov); kept.push(ov.overrideId); return; }
      if (ids[ov.sessionId]) { nextOverrides.push(ov); kept.push(ov.overrideId); return; }
      if (byPred[ov.sessionId]) {
        var moved = _clone(ov); moved.sessionId = byPred[ov.sessionId];
        moved.retargetedFrom = ov.sessionId;
        nextOverrides.push(moved); retargeted.push(ov.overrideId); return;
      }
      if (_isPsg(ov.sessionId)) {   // inhaltsabgeleitete ID: nie automatisch (E-16)
        conflicts.push({ overrideId: ov.overrideId, sessionId: ov.sessionId, type: ov.type, reason: 'psg_id_unstable' });
        return;
      }
      dropped.push({ overrideId: ov.overrideId, sessionId: ov.sessionId, type: ov.type, reason: 'target_not_in_new_baseline' });
    });
    p.baseline = _clone(newBaseline);
    p.revision = (p.revision || 1) + 1;
    p.overrides = nextOverrides;
    p.pendingConflicts = conflicts;   // Entscheidung ②: Badge am Plan, keine Unterbrechung
    p.history = (p.history || []).concat([{
      revision: p.revision, at: at, reason: 'engine_rebase',
      detail: { engineVersion: newBaseline && newBaseline.engineVersion || null,
        kept: kept.length, retargeted: retargeted.length,
        conflicts: conflicts, dropped: dropped }
    }]).slice(-HISTORY_MAX);
    return { plan: p, kept: kept, retargeted: retargeted, conflicts: conflicts, dropped: dropped };
  }

  /* Konflikt auflösen (Nutzerentscheidung aus dem Badge-Sheet):
     accept ⇒ Override auf die gewählte neue Session heften; discard ⇒ endgültig
     verwerfen — beides mit History-Eintrag. */
  function resolveConflict(plan, overrideId, decision, at) {
    var p = _clone(plan);
    var idx = -1;
    (p.pendingConflicts || []).forEach(function (c, i) { if (c.overrideId === overrideId) idx = i; });
    if (idx < 0) return { plan: plan, error: 'conflict_not_found' };
    var c = p.pendingConflicts.splice(idx, 1)[0];
    if (decision && decision.action === 'accept' && decision.newSessionId) {
      // Der Override existiert nicht mehr in overrides (wurde beim Rebase ausgetragen) —
      // der Aufrufer liefert ihn im decision-Objekt mit (UI hält das Konflikt-Detail).
      if (!decision.override) return { plan: plan, error: 'override_payload_missing' };
      var ov = _clone(decision.override); ov.sessionId = decision.newSessionId; ov.retargetedFrom = c.sessionId;
      p.overrides = (p.overrides || []).concat([ov]);
      p.history = (p.history || []).concat([{ revision: p.revision, at: at || null, reason: 'conflict_accepted', detail: { overrideId: overrideId, newSessionId: decision.newSessionId } }]).slice(-HISTORY_MAX);
    } else {
      p.history = (p.history || []).concat([{ revision: p.revision, at: at || null, reason: 'conflict_discarded', detail: { overrideId: overrideId, sessionId: c.sessionId } }]).slice(-HISTORY_MAX);
    }
    return { plan: p, error: null };
  }

  /* ---------- 5E · Editor-Diff: bearbeitete Tagesstruktur → Overrides ----------
     Der Plan-Editor bearbeitet eine 7-Tage-Struktur als Ganzes. Statt sie als
     neue Baseline zu speichern (das war der Datenverlust-Bug), wird sie hier
     gegen den effektiven Plan gedifft — jede Aenderung wird ein einzelner,
     rueckverfolgbarer Override. PUR: ID-/Zeit-Fabriken injizierbar. */
  function _stripId(s) { var c = _clone(s) || {}; delete c.id; return c; }
  function diffEditedDays(effective, editedDays, opts) {
    opts = opts || {};
    var now = opts.now || null;
    var reason = opts.reason || 'user_manual';
    var mkId = opts.idFactory || function () { return 'ps:ed:' + Math.random().toString(36).slice(2, 10); };
    var mkOvId = opts.ovIdFactory || function () { return 'ov:' + Math.random().toString(36).slice(2, 10); };
    var before = {};   // sessionId → {dayIndex, session}
    ((effective && effective.sessions) || []).forEach(function (e) { before[e.sessionId] = { dayIndex: e.dayIndex, session: e.session }; });
    var overrides = [];
    var seen = {};
    for (var di = 0; di < 7; di++) {
      var day = (editedDays && editedDays[di]) || [];
      for (var j = 0; j < day.length; j++) {
        var it = day[j];
        if (!it || typeof it !== 'object') continue;
        var id = _isPs(it.id) ? it.id : null;
        if (id && before[id]) {
          seen[id] = 1;
          var b = before[id];
          var contentChanged = JSON.stringify(_stripId(Object.assign({}, it, { dur: null }))) !== JSON.stringify(_stripId(Object.assign({}, b.session, { dur: null })));
          var durChanged = (it.dur != null ? +it.dur : null) !== (b.session && b.session.dur != null ? +b.session.dur : null);
          if (b.dayIndex !== di) overrides.push({ overrideId: mkOvId(), sessionId: id, type: 'move', dayIndex: di, from: b.dayIndex, reason: reason, createdAt: now });
          if (contentChanged) overrides.push({ overrideId: mkOvId(), sessionId: id, type: 'replace', session: _clone(it), reason: reason, createdAt: now });
          else if (durChanged && it.dur != null) overrides.push({ overrideId: mkOvId(), sessionId: id, type: 'resize', durationMin: +it.dur, reason: reason, createdAt: now });
        } else {
          /* neu oder ohne stabile ID (auch psg:) ⇒ add mit frischer ps:-ID */
          var nid = mkId();
          overrides.push({ overrideId: mkOvId(), sessionId: nid, type: 'add', dayIndex: di, session: _clone(it), reason: reason, createdAt: now });
        }
      }
    }
    Object.keys(before).forEach(function (id) {
      if (!seen[id]) overrides.push({ overrideId: mkOvId(), sessionId: id, type: 'skip', reason: reason, createdAt: now });
    });
    return overrides;
  }

  /* ---------- 5E · Engine-Tagesstruktur → neue Baseline ----------
     Engine-Anpassungen behalten die Item-IDs des bestehenden Plans — ps:-IDs
     bleiben damit stabil (Rebase-Anker). Items ohne stabile ID erhalten eine
     frische ps:-ID; psg:-IDs werden ERSETZT und via predecessorSessionId auf
     die alte ID verlinkt (macht psg-Overrides automatisch retargetbar). */
  function baselineFromDays(days, opts) {
    opts = opts || {};
    var mkId = opts.idFactory || function () { return 'ps:en:' + Math.random().toString(36).slice(2, 10); };
    var sessions = [];
    for (var di = 0; di < 7; di++) {
      var day = (days && days[di]) || [];
      for (var j = 0; j < day.length; j++) {
        var it = day[j];
        if (!it || typeof it !== 'object') continue;
        var sid, pred = null;
        if (_isPs(it.id)) sid = it.id;
        else { sid = mkId(); if (it.id) pred = it.id; }
        var s = _clone(it); s.id = sid;
        var entry = { sessionId: sid, dayIndex: di, session: s };
        if (pred) entry.predecessorSessionId = pred;
        sessions.push(entry);
      }
    }
    return {
      source: opts.source || 'engine',
      engineVersion: opts.engineVersion || null,
      generatedAt: opts.generatedAt || null,
      snapshotId: opts.snapshotId || null,
      sessions: sessions
    };
  }

  var api = {
    VERSION: VERSION, OVERRIDE_TYPES: Object.keys(OVERRIDE_TYPES), HISTORY_MAX: HISTORY_MAX,
    diffEditedDays: diffEditedDays, baselineFromDays: baselineFromDays,
    weekKeyFor: weekKeyFor,
    sessionsFromLegacyWeekPlan: sessionsFromLegacyWeekPlan,
    fromLegacyWeekPlan: fromLegacyWeekPlan,
    validateOverride: validateOverride, validatePlan: validatePlan,
    applyOverride: applyOverride, removeOverride: removeOverride,
    effectiveSessions: effectiveSessions,
    rebase: rebase, resolveConflict: resolveConflict
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.planDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
