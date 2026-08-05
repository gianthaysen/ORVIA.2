/* ============================================================
   ORVIA · engine/shadow-eval — PHASE 8, Stufe 1: Shadow-Gate-Auswertung.

   Der Umsetzungsplan fordert für Phase 8 ausdrücklich „messbare Gates, keine
   Einschätzung". Dieses Modul ist der Messapparat: es bewertet die fünf
   Shadow-Gate-Kriterien aus UMSETZUNGSPLAN §Phase 8 gegen die beiden lokalen
   Shadow-Protokolle und liefert je Kriterium ein Urteil MIT Beleg.

   Bewertete Kriterien (1:1 aus dem Plan):
     S1 mindestens 14 verwertbare Vergleichstage
     S2 keine ungeklärten Safety-Divergenzen
     S3 deterministische Ausgabe bei identischem Snapshot
     S4 keine ungültigen oder nicht ausführbaren Sessions
     S5 vollständige Provenienz für JEDE Session

   DREI Zustände je Kriterium, nie zwei:
     'pass'              — Beleg vorhanden UND erfüllt
     'fail'              — Beleg vorhanden UND verletzt
     'insufficient_data' — Beleg fehlt (zu wenige Tage ODER Protokollfelder aus
                           einer älteren Runner-Version)
   `insufficient_data` ist NICHT `pass`. gateReady wird nur true, wenn ALLE fünf
   Kriterien 'pass' sind (6.4-Grundsatz: fehlende Sicherheit führt zu weniger
   Automatisierung, nicht zu mehr Heuristik).

   Safety-Divergenz (S2) — die Definition ist die Kernentscheidung dieses Moduls:
   Eine Abweichung v1≠v2 ist NICHT per se ein Sicherheitsproblem. Gefährlich ist
   ausschließlich die Richtung „v2 ist NACHSICHTIGER als v1": v2 würde den
   Nutzer trainieren lassen, wo v1 bremst. Ist v2 strenger, ist das konservativ
   und kein Gate-Blocker (wird als `conservative` gezählt, nicht als Blocker).
   Die Ordnung stammt aus decision-engine-v2.js selbst (dort `order`-Konstanten),
   nicht aus einer zweiten Meinung dieses Moduls.

   Reinheit: pure + deterministisch. Kein Date/Math.random/DOM/Storage/PROFILE —
   beide Protokolle werden als Argument übergeben. Gleiche Eingabe ⇒ byte-gleiche
   Ausgabe (Voraussetzung dafür, dass S3 überhaupt glaubwürdig ist).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'shadow-eval-v1.0.0';

  /* Reihenfolgen SPIEGELN decision-engine-v2.js (dort: escalate/limitAction).
     Index aufsteigend = strenger. Wird dort erweitert, muss es hier mitgezogen
     werden — deshalb prüft phase8_shadow_eval_test.mjs beide Listen gegen die
     Quelle der Engine. */
  var STATE_ORDER = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];
  var ACTION_ORDER = ['KEEP', 'REDUCE_INTENSITY', 'REDUCE_VOLUME', 'SWAP_MODALITY', 'MOVE_SESSION', 'REPLACE_WITH_RECOVERY', 'REST'];

  function _rank(list, v) { var i = list.indexOf(String(v || '').toUpperCase()); return i < 0 ? null : i; }

  /* Eine Tages-Abweichung einordnen. Rückgabe null = keine Abweichung oder nicht
     beurteilbar (fehlende Seite ⇒ NICHT als sicher zählen, sondern als unknown). */
  function classifyDivergence(e) {
    if (!e || !e.v1 || !e.v2) return null;
    var s1 = _rank(STATE_ORDER, e.v1.state), s2 = _rank(STATE_ORDER, e.v2.state);
    var a1 = _rank(ACTION_ORDER, e.v1.action), a2 = _rank(ACTION_ORDER, e.v2.action);
    if (s1 == null || s2 == null) return { date: e.date || null, kind: 'unknown', safetyRelevant: false,
      v1: e.v1.state || null, v2: e.v2.state || null, reason: 'state_not_comparable' };
    if (s1 === s2 && (a1 == null || a2 == null || a1 === a2)) return null;          // einig
    var laxerState = s2 < s1;
    var laxerAction = (a1 != null && a2 != null) ? a2 < a1 : false;
    if (laxerState || laxerAction) {
      return { date: e.date || null, kind: 'v2_more_permissive', safetyRelevant: true,
        v1: e.v1.state || null, v2: e.v2.state || null,
        v1Action: e.v1.action || null, v2Action: e.v2.action || null,
        v2reasons: Array.isArray(e.v2.reasons) ? e.v2.reasons.slice(0, 4) : [],
        reason: laxerState ? 'v2_state_less_severe' : 'v2_action_less_restrictive' };
    }
    return { date: e.date || null, kind: 'v2_more_conservative', safetyRelevant: false,
      v1: e.v1.state || null, v2: e.v2.state || null, reason: 'v2_stricter_not_a_safety_risk' };
  }

  function _crit(id, title, status, value, required, evidence) {
    return { id: id, title: title, status: status, value: value == null ? null : value,
      required: required == null ? null : required, evidence: evidence || null };
  }

  /* ---- Hauptauswertung ----
     opts: { dailyLog:[], weeklyLog:[], minComparableDays:14, minOkWeeks:2 }
     dailyLog  = orvia_engine_shadow_<uid>      (shadow-runner.report-Quelle)
     weeklyLog = orvia_scheduler_shadow_<uid>   (shadow-runner.weekReport-Quelle) */
  function evaluate(opts) {
    var o = opts || {};
    var daily = Array.isArray(o.dailyLog) ? o.dailyLog : [];
    var weekly = Array.isArray(o.weeklyLog) ? o.weeklyLog : [];
    var minDays = typeof o.minComparableDays === 'number' ? o.minComparableDays : 14;
    var minWeeks = typeof o.minOkWeeks === 'number' ? o.minOkWeeks : 2;

    /* ---- S1: verwertbare Vergleichstage ---- */
    var comparable = daily.filter(function (x) { return x && x.agree !== null && x.v1 && x.v2 && x.v2.state; });
    var blockedDays = daily.filter(function (x) { return x && x.v2 && x.v2.blocked; });
    var s1 = _crit('S1', 'Mindestens ' + minDays + ' verwertbare Vergleichstage',
      comparable.length >= minDays ? 'pass' : 'insufficient_data',
      comparable.length, minDays,
      { totalDays: daily.length, blockedDays: blockedDays.length,
        blockedReasons: _tally(blockedDays.map(function (x) { return x.v2.blocked; })) });

    /* ---- S2: Safety-Divergenzen ---- */
    var divs = [], permissive = [], conservative = 0, unknown = 0;
    comparable.forEach(function (e) {
      var d = classifyDivergence(e); if (!d) return;
      divs.push(d);
      if (d.safetyRelevant) permissive.push(d);
      else if (d.kind === 'unknown') unknown++;
      else conservative++;
    });
    /* Ohne Vergleichstage ist die Aussage „0 Safety-Divergenzen" wertlos — dann
       insufficient_data, nicht pass. */
    var s2Status = comparable.length === 0 ? 'insufficient_data' : (permissive.length === 0 ? 'pass' : 'fail');
    var s2 = _crit('S2', 'Keine ungeklärten Safety-Divergenzen (v2 nachsichtiger als v1)',
      s2Status, permissive.length, 0,
      { divergencesTotal: divs.length, conservativeDivergences: conservative,
        notComparable: unknown, agreementRate: comparable.length ? Math.round(((comparable.length - divs.length) / comparable.length) * 100) : null,
        safetyDivergences: permissive.slice(0, 10) });

    /* ---- Wochenprotokoll: nur Einträge, die die Gate-Belege ÜBERHAUPT tragen ----
       Ältere Runner-Versionen schrieben diese Felder nicht. Ein fehlendes Feld
       darf nicht als „erfüllt" durchgehen ⇒ getrennt gezählt. */
    var okWeeks = weekly.filter(function (x) { return x && x.ok; });
    var withGate = okWeeks.filter(function (x) { return x.gate && typeof x.gate === 'object'; });
    var missingGateEvidence = okWeeks.length - withGate.length;

    /* ---- S3: Determinismus ----
       Drei Faelle sauber trennen: false = bewiesen verletzt (fail) ·
       null = nicht gemessen (insufficient_data) · true = belegt (pass).
       `!== true` in einen Topf zu werfen wuerde „nicht gemessen" als Verletzung
       melden — und, schlimmer, in der Gegenrichtung koennte ein null-Wert als
       erfuellt durchgehen. Beides ist falsch. */
    var nonDet = withGate.filter(function (x) { return x.gate.deterministic === false; });
    var detUnknown = withGate.filter(function (x) { return x.gate.deterministic == null; });
    var s3 = _crit('S3', 'Deterministische Ausgabe bei identischem Snapshot',
      nonDet.length ? 'fail' : ((withGate.length === 0 || detUnknown.length) ? 'insufficient_data' : 'pass'),
      withGate.length - nonDet.length - detUnknown.length, withGate.length,
      { weeksWithEvidence: withGate.length, weeksWithoutEvidence: missingGateEvidence,
        weeksNotMeasured: detUnknown.map(function (x) { return x.weekKey; }),
        nonDeterministicWeeks: nonDet.map(function (x) { return x.weekKey; }) });

    /* ---- S4: keine ungültigen / nicht ausführbaren Sessions ----
       Zwei Fehlerarten, beide zählen: die Factory hat verweigert
       (blockedPrescriptions) ODER sie hat geliefert, aber der normative
       Validator lehnt ab (gate.invalidSessions).
       Und: lief der Validator in einer Woche gar nicht (invalidSessions == null),
       ist „0 ungültige Sessions" keine Aussage, sondern eine Luecke ⇒
       insufficient_data. Genau dieser Fall wurde beim Bau zuerst falsch als
       'pass' gewertet — das ist derselbe Fehler, den dieses Modul verhindern soll. */
    var badWeeks = withGate.filter(function (x) { return (x.gate.invalidSessions || 0) > 0 || (x.blockedPrescriptions || 0) > 0; });
    var notValidated = withGate.filter(function (x) { return x.gate.invalidSessions == null; });
    var totalInvalid = withGate.reduce(function (n, x) { return n + (x.gate.invalidSessions || 0); }, 0);
    var totalBlocked = okWeeks.reduce(function (n, x) { return n + (x.blockedPrescriptions || 0); }, 0);
    var s4 = _crit('S4', 'Keine ungültigen oder nicht ausführbaren Sessions',
      (badWeeks.length || totalBlocked) ? 'fail'
        : ((withGate.length === 0 || notValidated.length) ? 'insufficient_data' : 'pass'),
      totalInvalid + totalBlocked, 0,
      { invalidSessions: totalInvalid, blockedPrescriptions: totalBlocked,
        weeksWithoutEvidence: missingGateEvidence,
        weeksNotValidated: notValidated.map(function (x) { return x.weekKey; }),
        offendingWeeks: badWeeks.map(function (x) { return { weekKey: x.weekKey, invalid: x.gate.invalidSessions || 0, blocked: x.blockedPrescriptions || 0, codes: (x.gate.invalidCodes || []).slice(0, 5) }; }) });

    /* ---- S5: vollständige Provenienz für JEDE Session ---- (gleiche Dreiteilung) */
    var noProv = withGate.filter(function (x) { return x.gate.provenanceComplete === false; });
    var provUnknown = withGate.filter(function (x) { return x.gate.provenanceComplete == null; });
    var s5 = _crit('S5', 'Vollständige Provenienz für jede Session',
      noProv.length ? 'fail' : ((withGate.length === 0 || provUnknown.length) ? 'insufficient_data' : 'pass'),
      withGate.length - noProv.length - provUnknown.length, withGate.length,
      { weeksWithEvidence: withGate.length, weeksWithoutEvidence: missingGateEvidence,
        weeksNotMeasured: provUnknown.map(function (x) { return x.weekKey; }),
        incompleteWeeks: noProv.map(function (x) { return { weekKey: x.weekKey, missing: (x.gate.provenanceMissing || []).slice(0, 5) }; }) });

    /* ---- Zusatzbedingung aus dem Plan: genug geplante Wochen überhaupt ---- */
    var weeksOk = okWeeks.length >= minWeeks;

    var criteria = [s1, s2, s3, s4, s5];
    var blockers = criteria.filter(function (c) { return c.status === 'fail'; });
    var pending = criteria.filter(function (c) { return c.status === 'insufficient_data'; });
    var gateReady = blockers.length === 0 && pending.length === 0 && weeksOk;

    return {
      version: VERSION,
      gate: 'shadow',
      gateReady: gateReady,
      criteria: criteria,
      blockers: blockers.map(function (c) { return c.id; }),
      pending: pending.map(function (c) { return c.id; }),
      weeks: { planned: weekly.length, ok: okWeeks.length, required: minWeeks, sufficient: weeksOk,
        blocked: weekly.filter(function (x) { return x && !x.ok; }).map(function (x) { return { weekKey: x.weekKey, error: x.error || null }; }) },
      /* Klartext, was als NÄCHSTES fehlt — keine Bewertung, nur Ableitung. */
      nextStep: gateReady ? 'shadow_gate_passed_proceed_to_canary'
        : (blockers.length ? 'resolve_blockers:' + blockers.map(function (c) { return c.id; }).join(',')
          : 'collect_more_data:' + pending.map(function (c) { return c.id; }).join(','))
    };
  }

  function _tally(arr) {
    var m = {}; (arr || []).forEach(function (k) { if (k == null) return; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).sort().map(function (k) { return { code: k, count: m[k] }; });   // sortiert = deterministisch
  }

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }
  O.shadowEval = _freeze({ VERSION: VERSION, STATE_ORDER: STATE_ORDER.slice(), ACTION_ORDER: ACTION_ORDER.slice(),
    classifyDivergence: classifyDivergence, evaluate: evaluate });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.shadowEval;
})(typeof globalThis !== 'undefined' ? globalThis : this);
