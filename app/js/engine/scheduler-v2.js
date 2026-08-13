/* ============================================================
   ORVIA · scheduler-v2 — Phase 7 (2026-08-05, SHADOW-ONLY, klar versioniert).

   Verkettet die Phase-7-Bausteine zur vollstaendigen Pipeline
   (Zielarchitektur Umsetzungsplan Phase 7):
     capacity.perSport (S3) → Anforderungsableitung (Policy, versioniert)
     → Constraint Solver (S4) → Prescription Factory (S5, Vertrag-4-Schema)
     → kanonische Wochen-Sessions (Vertrag-5-Form: ps:-IDs, weekday, Provenienz).

   scheduler-v1 bleibt unangetastet als dokumentiertes Skeleton (Plan-Vorgabe:
   NICHT erweitern). v2 kennt ausschliesslich activationMode 'shadow_only' —
   jeder andere Modus wird abgelehnt (SCHEDULER_V2_ACTIVATION_MODE_REJECTED).

   Fail-closed (Vertraege 2/3/6/7):
   - ohne availability ⇒ blocked (kein erfundener Kalender).
   - Kapazitaet unbekannt/not_assessable ⇒ KONSERVATIVE generische Einheiten
     (kurz, easy, RPE-gefuehrt) mit Flag — nie quantitative Steigerung (6.4).
   - Qualitaets-/Intervalleinheit NUR bei Kapazitaets-Konfidenz high|medium.
   - Solver-Konflikte und Unplatzierbares werden UNVERAENDERT durchgereicht.

   Determinismus: ps:-IDs aus weekKey+Index (kein Date.now/Math.random);
   identischer Input ⇒ byte-identischer Output.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'scheduler-v2.0.0';
  var POLICY = 'req-policy-v1';
  var ACTIVATION_MODE = 'shadow_only';
  var ENDURANCE = { running: 1, cycling: 1, swimming: 1, rowing: 1 };

  /* ---- Anforderungsableitung (versionierte Policy, pure) ----
     sports: [{sportId, role:'primary'|'secondary'}] · cap: capacity.perSport-Form. */
  function deriveRequirements(sports, cap, flags) {
    var reqs = [];
    (Array.isArray(sports) ? sports : []).forEach(function (sp) {
      if (!sp || !sp.sportId) return;
      var c = cap ? cap[sp.sportId] : null;
      var known = c && c !== 'not_assessable' && typeof c === 'object';
      var conf = known ? c.confidence : null;
      var isEnd = !!ENDURANCE[sp.sportId];
      if (!known || conf === 'not_assessable') {
        /* 6.4: konservative generische Einheit — kurz, easy, nie mehr als 2. */
        flags.push('conservative_generic_no_capacity:' + sp.sportId);
        var n0 = sp.role === 'primary' ? 2 : 1;
        for (var k = 0; k < n0; k++) reqs.push({ id: sp.sportId + ':gen' + k, sportId: sp.sportId,
          sessionType: isEnd ? 'endurance_easy' : 'strength_general', durationMin: isEnd ? 30 : null,
          intensity: 'easy', priority: sp.role === 'primary' ? 'build' : 'optional' });
        return;
      }
      var weekly = Math.max(1, Math.min(6, Math.round(c.weeklySessions || 1)));
      if (isEnd) {
        var longMin = (c.longSessionCeiling != null) ? Math.min(c.longSessionCeiling, 150) : null;
        if (longMin != null && longMin >= 45 && sp.role === 'primary') {
          reqs.push({ id: sp.sportId + ':long', sportId: sp.sportId, sessionType: 'endurance_long',
            durationMin: longMin, intensity: 'moderate', priority: 'key' });
        }
        /* Qualitaet nur bei belastbarer Historie (Konfidenz high|medium). */
        if ((conf === 'high' || conf === 'medium') && sp.role === 'primary' && weekly >= 3) {
          reqs.push({ id: sp.sportId + ':quality', sportId: sp.sportId, sessionType: 'endurance_intervals',
            durationMin: 50, intensity: 'intense', priority: 'key' });
        } else if (sp.role === 'primary') flags.push('quality_withheld_low_confidence:' + sp.sportId);
        var have = reqs.filter(function (r) { return r.sportId === sp.sportId; }).length;
        var easyMin = (c.weeklyMinutes != null && weekly > 0) ? Math.max(25, Math.min(75, Math.round(c.weeklyMinutes / weekly))) : 40;
        for (var i = have; i < weekly; i++) reqs.push({ id: sp.sportId + ':easy' + i, sportId: sp.sportId,
          sessionType: 'endurance_easy', durationMin: easyMin, intensity: 'easy',
          priority: sp.role === 'primary' ? 'build' : 'optional' });
      } else {
        for (var j = 0; j < weekly; j++) reqs.push({ id: sp.sportId + ':str' + j, sportId: sp.sportId,
          sessionType: 'strength_general', durationMin: null, intensity: 'moderate',
          priority: sp.role === 'primary' ? 'key' : 'build' });
      }
    });
    return reqs;
  }

  /* ---- Hauptfunktion ----
     input: { activationMode, weekKey, sports[], availability, capacityPerSport, evidence } */
  function buildWeek(input) {
    input = input || {};
    function fail(code, detail) { return { ok: false, error: { code: code, detail: detail == null ? null : detail }, sessions: null }; }
    if (input.activationMode !== ACTIVATION_MODE) return fail('SCHEDULER_V2_ACTIVATION_MODE_REJECTED', input.activationMode);
    if (typeof input.weekKey !== 'string' || !/^\d{4}-W\d{2}$/.test(input.weekKey)) return fail('SCHEDULER_V2_WEEKKEY_INVALID', input.weekKey);
    var CS = O.constraintSolver, PF = O.prescriptionFactory;
    if (!CS || !PF) return fail('SCHEDULER_V2_MODULES_MISSING', !CS ? 'constraintSolver' : 'prescriptionFactory');
    if (!input.availability || !input.availability.days) return fail('SCHEDULER_V2_AVAILABILITY_MISSING');
    if (!Array.isArray(input.sports) || !input.sports.length) return fail('SCHEDULER_V2_SPORTS_MISSING');

    var flags = [];
    var reqs = deriveRequirements(input.sports, input.capacityPerSport || null, flags);
    var placed = CS.place(reqs, input.availability);
    if (!placed.ok) return fail('SCHEDULER_V2_SOLVER_FAILED', placed.error);

    var sessions = [], blockedPrescriptions = [];
    placed.placements.forEach(function (p, idx) {
      var req = reqs.filter(function (r) { return r.id === p.id; })[0] || {};
      var ev = (input.evidence && input.evidence[p.sportId]) || null;
      /* v8-341 — HIER ENDETE DIE EINSPEISEKETTE BISHER.
         `buildPrescription` kennt seit v8-336 einen Parameter `knowledge`,
         und die Factory zieht daraus Zahlen mit Herkunft. Nur uebergeben hat
         ihn niemand: die gesamte Kette lief ausschliesslich in Pruefskripten.
         Ein eingespeistes Paket aenderte am Verhalten der App nichts.

         Der Consumer ist fail-closed: gibt es kein Paket fuer die Sportart,
         fehlt ein Modul oder stimmt ein Hash nicht, kommt `ok:false` mit
         Grund zurueck und die Factory arbeitet exakt wie zuvor mit
         Produktwerten. Der Grund wird geflaggt, damit "kein Wissen" nicht
         wie "Wissen sagt nichts" aussieht. */
      var wissen = null;
      var KCons = O.knowledgeConsumer;
      if (KCons && typeof KCons.wissenFuer === 'function') {
        var w = KCons.wissenFuer(req.sportId);
        if (w && w.ok === true) wissen = w;
        else if (w && w.grund && w.grund !== 'kein_paket_fuer_sportart') flags.push('wissen_nicht_verfuegbar:' + w.grund);
      }
      var pr = PF.buildPrescription({ sportId: req.sportId, sessionType: req.sessionType,
        durationMin: req.durationMin, priority: req.priority, exercises: req.exercises,
        knowledge: wissen }, ev);
      if (!pr.ok) { blockedPrescriptions.push({ id: p.id, blocked: pr.blocked }); return; }
      /* v8-349 — UND HIER ENDETE SIE IMMER NOCH.
         Seit v8-349 gibt die Factory `hinweise` zurueck: Wissen, das sich
         nicht als Zahl einbauen laesst, mit Aussage, Herkunft, Grenzen und
         Ausschluessen. Diese Stelle hat es weggeworfen — dieselbe
         Fehlerklasse wie v8-341, nur eine Ebene weiter aussen, und aus
         demselben Grund unsichtbar: die Verordnung war ja da.

         Das Feld entsteht NUR, wenn es Hinweise gibt. Eine Woche ohne
         Wissen sieht damit Zeichen fuer Zeichen aus wie vorher — kein
         leeres Feld, das spaeter irgendwo als leerer Kasten auftaucht. */
      var sess = {
        sessionId: 'ps:v2:' + input.weekKey + ':' + idx,                 // deterministisch, kein Zufall
        weekday: p.weekday, sportId: req.sportId,
        prescription: pr.workout,
        flags: (p.flags || []).concat(pr.flags || []),
        provenance: { scheduler: VERSION, policy: POLICY, solver: placed.solverVersion,
          factory: pr.provenance.factory, templateId: pr.provenance.templateId,
          paceEvidenceUsed: pr.provenance.paceEvidenceUsed, requirementId: p.id }
      };
      if (pr.hinweise && pr.hinweise.length) sess.hinweise = pr.hinweise;
      sessions.push(sess);
    });
    return { ok: true, weekKey: input.weekKey, sessions: sessions,
      unplaced: placed.unplaced, conflicts: placed.conflicts,
      blockedPrescriptions: blockedPrescriptions, flags: flags,
      provenance: { scheduler: VERSION, policy: POLICY, activationMode: ACTIVATION_MODE } };
  }

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }
  O.schedulerV2 = _freeze({ VERSION: VERSION, POLICY: POLICY, ACTIVATION_MODE: ACTIVATION_MODE,
    deriveRequirements: deriveRequirements, buildWeek: buildWeek });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.schedulerV2;
})(typeof globalThis !== 'undefined' ? globalThis : this);
