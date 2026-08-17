/* ============================================================
   ORVIA · Engine 3c — Scheduler S1: deterministisches Sieben-Tage-Skelett
   (reine Funktion). Vertrag: app/docs/SCHEDULER-S0-CONTRACT.md §5
   (SchedulerResult) + S1-Auftrag. Wählt NOCH KEINE Trainingseinheiten,
   KEINE Übungen, KEINE Periodisierung — ausschließlich Struktur,
   Determinismus und Shadow-Metadaten.

   Konsumiert AUSSCHLIESSLICH das Ergebnis von
   ORVIA.schedulerInputFactory.build(...).input — kein DOM, kein
   localStorage, kein PROFILE/DB/ActivityStore/Repository, kein
   Date.now()/new Date() ohne injizierten Wert, keine Schreiboperation.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};

  var RESULT_CONTRACT_VERSION = 'sched-v1.0.0';
  var RULESET_VERSION = 's1-skeleton-v1.0.0';
  var ACTIVATION_MODE = 'shadow_only';
  var WEEKDAY_ORDER = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function findKeyNamed(v, name, seen) {
    seen = seen || [];
    if (v && typeof v === 'object' && seen.indexOf(v) >= 0) return false;
    if (Array.isArray(v)) { seen = seen.concat([v]); return v.some(function (x) { return findKeyNamed(x, name, seen); }); }
    if (isPlainObject(v)) {
      seen = seen.concat([v]);
      return Object.keys(v).some(function (k) { return k === name || findKeyNamed(v[k], name, seen); });
    }
    return false;
  }

  function _fnv1a32(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function derivePlannedOccurrenceId(contractVersion, userRef, localDate, slotIndex) {
    var raw = String(contractVersion) + '|' + String(userRef == null ? 'anon' : userRef) + '|slot' + String(slotIndex);
    return 'po:' + localDate + ':empty-' + _fnv1a32(raw).toString(36);
  }

  /* ISO-Datum (YYYY-MM-DD) → JS-Wochentagsindex (0=So..6=Sa) via reine UTC-Kalenderarithmetik
     (kein Date.now(), kein Host-TZ-Bezug — der Tag wird direkt aus dem injizierten String gebaut). */
  function jsWeekdayOfIsoDate(iso) {
    var p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  }
  function weekdayKeyOfIsoDate(iso) {
    return WEEKDAY_ORDER[(jsWeekdayOfIsoDate(iso) + 6) % 7]; // 0=So→'so', 1=Mo→'mo', ...
  }

  function proof(code, weight, status, rationale, sourceRef) {
    return { code: code, weight: weight != null ? weight : null, status: status, rationale: rationale, sourceRef: sourceRef || null };
  }

  /* ---------- Haupt-Skelett ---------- */
  function run(input) {
    if (!input || typeof input !== 'object') {
      return { ok: false, result: null, error: { code: 'SCHEDULER_V1_INVALID_INPUT', detail: 'kein SchedulerInput' } };
    }
    if (input.activationMode !== ACTIVATION_MODE) {
      // S0b §14 Gate 0-3: das Skelett darf NIE etwas anderes als shadow_only ausgeben.
      return { ok: false, result: null, error: { code: 'SCHEDULER_V1_ACTIVATION_MODE_REJECTED', detail: input.activationMode } };
    }
    var horizon = Array.isArray(input.horizon) ? input.horizon : null;
    if (!horizon || horizon.length !== 7) {
      return { ok: false, result: null, error: { code: 'SCHEDULER_V1_INVALID_HORIZON', detail: 'kein 7-Tage-Horizont' } };
    }

    var userRef = (input.athlete && (input.athlete.userRef || input.athlete.id)) || 'anon';
    var availability = input.availability;
    var topMissing = [];
    if (!availability) topMissing.push('availability');

    var restDayCount = 0;
    var days = horizon.map(function (date) {
      var wd = weekdayKeyOfIsoDate(date);
      var dayAvail = availability && availability.days ? availability.days[wd] : null;
      var restDay = !!(dayAvail && dayAvail.restDay);                        // HART (Hard #1)
      var preferredRest = !!(availability && availability.preferredRestDays && availability.preferredRestDays.indexOf(wd) >= 0); // WEICH (Hard #14)
      var doubleEnabled = !!(dayAvail && dayAvail.doubleSession && dayAvail.doubleSession.enabled);
      if (restDay) restDayCount++;

      var slotCount = doubleEnabled ? 2 : 1; // Hard #16: Default AUS ⇒ genau 1 Slot/Tag.
      var slots = [];
      for (var s = 0; s < slotCount; s++) {
        slots.push({
          plannedOccurrenceId: derivePlannedOccurrenceId(RESULT_CONTRACT_VERSION, userRef, date, s),
          proposal: null, // S1 wählt NIE eine Einheit — Struktur ohne Inhalt.
          reasons: [{ code: 's1_no_selection_yet', detail: 'S1-Skelett: Session-Auswahl ist nicht Teil dieses Batches (erst S4/S5).' }]
        });
      }

      var dailyCeiling = (availability && availability.dailyCapacityCeiling) ? availability.dailyCapacityCeiling : { known: false };
      var fixedForDay = (dayAvail && Array.isArray(dayAvail.fixedCommitments)) ? dayAvail.fixedCommitments : [];

      var hardProofs = [
        proof('rest_day_locked', null, restDay ? 'satisfied' : 'neutral',
          restDay ? 'Expliziter Ruhetag bleibt gesperrt (Hard #1).' : 'Kein expliziter Ruhetag an diesem Tag.',
          'availability.days.' + wd + '.restDay'),
        proof('double_session_default_off', null, doubleEnabled ? 'neutral' : 'satisfied',
          doubleEnabled ? 'Doppel-Einheit ist für diesen Tag explizit aktiviert.' : 'Doppel-Einheit bleibt standardmäßig deaktiviert (Hard #16).',
          'availability.days.' + wd + '.doubleSession.enabled'),
        proof('daily_capacity_unknown_no_auto_allocation', null, dailyCeiling.known ? 'neutral' : 'satisfied',
          dailyCeiling.known ? 'Tageskapazität bekannt — S1 belegt dennoch nichts automatisch.' : 'Unbekannte Tageskapazität führt zu keiner automatischen Belegung (Hard #15/#18).',
          'availability.dailyCapacityCeiling'),
        proof('fixed_commitment_preserved', null, fixedForDay.length ? 'satisfied' : 'neutral',
          fixedForDay.length ? 'Feste Verpflichtung(en) bleiben als harte Einschränkung erhalten (Hard #8).' : 'Keine feste Verpflichtung an diesem Tag.',
          'availability.days.' + wd + '.fixedCommitments')
      ];
      var softProofs = [
        proof('preferred_rest_day_soft', 0.10, preferredRest ? 'violated' : 'neutral',
          preferredRest ? 'Bevorzugter Ruhetag — in S1 nicht durchsetzbar/nicht verletzbar, da keine Session existiert; informativ als weich gemeldet.' : 'Kein bevorzugter Ruhetag an diesem Tag.',
          'availability.preferredRestDays')
      ];

      var dayMissing = dayAvail ? [] : ['availability.days.' + wd];

      return {
        date: date,
        restDay: restDay,
        preferredRestDay: preferredRest,
        capacity: { ceiling: dailyCeiling.known ? dailyCeiling : null, known: !!dailyCeiling.known, confidence: dailyCeiling.known ? (dailyCeiling.confidence || null) : 'not_assessable' },
        fixedCommitments: fixedForDay,
        slots: slots,
        constraintProof: { hard: hardProofs, soft: softProofs },
        missingFields: dayMissing,
        confidence: dayAvail ? 'high' : 'not_assessable'
      };
    });

    var minimumFullRestDays = availability ? availability.minimumFullRestDays : null;
    var weeklyRestProof;
    if (minimumFullRestDays == null) {
      weeklyRestProof = proof('minimum_full_rest_days', null, 'neutral',
        'minimumFullRestDays ist unbekannt — keine Bewertung möglich (Hard #13, nie erfundener Default).', 'availability.minimumFullRestDays');
    } else if (restDayCount >= minimumFullRestDays) {
      weeklyRestProof = proof('minimum_full_rest_days', null, 'satisfied',
        'Explizite Ruhetage im Horizont (' + restDayCount + ') erfüllen die harte Wochenanzahl (' + minimumFullRestDays + ').', 'availability.minimumFullRestDays');
    } else {
      weeklyRestProof = proof('minimum_full_rest_days', null, 'violated',
        'Explizite Ruhetage im Horizont (' + restDayCount + ') unterschreiten die harte Wochenanzahl (' + minimumFullRestDays + ').', 'availability.minimumFullRestDays');
    }

    // Knowledge-Regeln: nur transportiert/validiert, NICHT angewendet (S1-Pflichtverhalten).
    var knowledgeWarnings = [];
    (input.knowledgeRules || []).forEach(function (r) {
      if (!r.complete) {
        knowledgeWarnings.push({ code: 'knowledge_rule_incomplete', ruleId: r.ruleId, detail: 'Regel ohne vollständige Metadaten — fail-closed ignoriert (S0b §10a).' });
      } else if (r.approvalStatus !== 'approved') {
        knowledgeWarnings.push({ code: 'knowledge_rule_not_approved', ruleId: r.ruleId, detail: 'Regel nicht freigegeben — keine Auswirkung auf Planung.' });
      }
      if (r.safety && r.safety.blockedReason) {
        knowledgeWarnings.push({ code: 'knowledge_rule_blocked', ruleId: r.ruleId, detail: r.safety.blockedReason });
      }
    });

    var dayMissingFlat = [];
    days.forEach(function (d) { dayMissingFlat = dayMissingFlat.concat(d.missingFields); });
    var allMissing = topMissing.concat(
      dayMissingFlat,
      minimumFullRestDays == null ? ['availability.minimumFullRestDays'] : [],
      (input.capacity && input.capacity.perSport) ? [] : ['capacity.perSport']
    );

    var confidence = allMissing.length === 0 ? 'high' : (allMissing.length <= 2 ? 'medium' : 'low');

    var result = {
      contractVersion: RESULT_CONTRACT_VERSION,
      rulesetVersion: RULESET_VERSION,
      activationMode: ACTIVATION_MODE,           // IMMER shadow_only im S1-Skelett.
      generatedFrom: { planningDayLocal: input.planningDayLocal, timezone: input.timezone }, // NIE aus Systemzeit.
      planningHorizon: { days: horizon.slice(), count: horizon.length },
      inputSnapshotId: input.inputSnapshotId != null ? input.inputSnapshotId : null,
      days: days,
      weekly: { minimumFullRestDaysRequired: minimumFullRestDays, restDayCountInHorizon: restDayCount, proof: weeklyRestProof },
      plannedSessions: [], // S1: bewusst leer — keine automatisch geplante Einheit.
      restDays: days.filter(function (d) { return d.restDay; }).map(function (d) { return { date: d.date, reason: 'user_fixed', assessable: true }; }),
      knowledgeRulesUsed: (input.knowledgeRules || []).map(function (r) {
        return { ruleId: r.ruleId, version: r.version, evidenceClass: r.evidenceClass, evidenceStatus: r.evidenceStatus, approvalStatus: r.approvalStatus, sources: r.sources, safety: r.safety, usedAs: r.usedAs };
      }),
      warnings: knowledgeWarnings,
      missingFields: allMissing,
      confidence: confidence,
      provenance: { contractVersion: RESULT_CONTRACT_VERSION, rulesetVersion: RULESET_VERSION, inputContractVersion: input.contractVersion }
    };

    if (findKeyNamed(result, 'sessionId')) {
      return { ok: false, result: null, error: { code: 'SCHEDULER_V1_AMBIGUOUS_SESSION_ID_PRODUCED', detail: 'internes Ergebnis enthält verbotenen Feldnamen sessionId' } };
    }

    return { ok: true, result: result, error: null };
  }

  O.schedulerV1 = {
    RESULT_CONTRACT_VERSION: RESULT_CONTRACT_VERSION,
    RULESET_VERSION: RULESET_VERSION,
    ACTIVATION_MODE: ACTIVATION_MODE,
    run: run,
    derivePlannedOccurrenceId: derivePlannedOccurrenceId,
    findKeyNamed: findKeyNamed,
    weekdayKeyOfIsoDate: weekdayKeyOfIsoDate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.schedulerV1;
})(typeof globalThis !== 'undefined' ? globalThis : this);
