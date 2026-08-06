/* ============================================================
   ORVIA · engine/canary-eval — PHASE 8, Stufe 2: Canary-Gate-Auswertung.

   Gegenstück zu `shadow-eval.js`, gleiche Bauart, gleiche Härte: sieben
   Kriterien aus UMSETZUNGSPLAN §Phase 8 „Canary Gate", je Kriterium DREI
   Zustände — `pass` · `fail` · `insufficient_data`. **`insufficient_data` ist
   nicht `pass`.** `gateReady` wird nur true, wenn alle sieben belegt erfüllt sind.

     C1 begrenzter Nutzerkreis
     C2 Feature Flag SERVERSEITIG deaktivierbar
     C3 alte Heuristik weiterhin verfügbar
     C4 Migration reversibel
     C5 Fehlerquote unter definiertem Grenzwert
     C6 keine erhöhte Workout-Abbruchrate
     C7 kein Verlust manueller Overrides

   WARUM DIESES MODUL ERST JETZT ENTSTEHT: Vier der sieben Kriterien sind ohne
   den serverseitigen Flag-Kanal (Migration 0031 + `feature-flags.js`) und ohne
   den Aktivierungspfad (`plan-activation.js`) überhaupt nicht messbar. Sie vorher
   zu „bewerten" hätte geheißen, eine Behauptung als Beleg auszugeben — genau der
   Fehler, den das Dreizustandsmodell verhindern soll.

   ABGRENZUNG FEHLER ↔ BEGRÜNDETE VERWEIGERUNG (C5): Nicht jede nicht erfolgte
   Aktivierung ist ein Fehler. `flag_off` und `unchanged` sind der Normalbetrieb.
   `would_drop_overrides` ist eine bewusste, korrekte Schutzverweigerung — sie
   zählt bei C7, nicht bei C5, sonst würde derselbe Vorfall doppelt bestraft und
   die Fehlerquote wäre nicht mehr interpretierbar. Als Fehler zählen nur Ausgänge,
   bei denen die Kette technisch versagt hat.

   C6 IST RICHTUNGSABHÄNGIG, wie S2 im Shadow-Gate: Eine niedrigere Abbruchrate
   nach der Aktivierung ist kein Blocker. Blockierend ist ausschließlich ein
   ANSTIEG über die Toleranz.

   Reinheit: pur + deterministisch. Kein Date/Math.random/DOM/Storage — alle
   Protokolle kommen als Argument herein. Gleiche Eingabe ⇒ byte-gleiche Ausgabe.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'canary-eval-v1.0.0';

  /* Ausgänge von plan-activation, bei denen die Kette TECHNISCH versagt hat.
     Bewusst eine Positivliste: ein neuer, hier unbekannter Grund fällt damit
     nicht still in „kein Fehler", sondern wird als `unclassified` gezählt und
     macht C5 zu insufficient_data (fail-closed gegen eigene Blindheit). */
  var ERROR_REASONS = ['projection_threw', 'projection_failed', 'projection_missing',
    'baseline_build_failed', 'rebase_threw', 'plan_domain_missing',
    'override_accounting_mismatch', 'projection_empty'];
  /* Ausgänge des Normalbetriebs — kein Fehler, keine Aktivierung. */
  var BENIGN_REASONS = ['flag_off', 'unchanged', 'no_canonical_plan', 'week_key_mismatch', 'applied'];
  /* Schutzverweigerung: zählt bei C7. */
  var OVERRIDE_GUARD_REASONS = ['would_drop_overrides'];

  function _crit(id, title, status, value, required, evidence) {
    return { id: id, title: title, status: status, value: value == null ? null : value,
      required: required == null ? null : required, evidence: evidence || null };
  }
  function _rate(part, total) { return total > 0 ? Math.round((part / total) * 10000) / 10000 : null; }
  function _tally(arr) {
    var m = {}; (arr || []).forEach(function (k) { if (k == null) return; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).sort().map(function (k) { return { code: k, count: m[k] }; });
  }

  /* ---- Hauptauswertung ----
     opts: {
       activationLog: [],           // ORVIA.planActivation.log()
       flag: {},                    // ORVIA.featureFlags.describe('engine_v2_plan')
       channel: { clientWritable, serverAuthoritative },   // aus der Migration belegt
       cohort: { size, max },       // begrenzter Nutzerkreis
       legacy: { generatorPresent, legacyPathIntact },
       revert: { tested, at, evidence },
       workouts: { before: [], after: [] },   // {status:'completed'|'aborted'|…}
       maxErrorRate: 0.02, minAttempts: 20, minApplied: 5,
       minWorkoutsPerSide: 10, abortRateTolerance: 0.05, maxCohort: 5
     } */
  function evaluate(opts) {
    var o = opts || {};
    var events = Array.isArray(o.activationLog) ? o.activationLog.filter(function (e) { return e && typeof e === 'object'; }) : [];
    var maxErrorRate = typeof o.maxErrorRate === 'number' ? o.maxErrorRate : 0.02;
    var minAttempts = typeof o.minAttempts === 'number' ? o.minAttempts : 20;
    var minApplied = typeof o.minApplied === 'number' ? o.minApplied : 5;
    var minWk = typeof o.minWorkoutsPerSide === 'number' ? o.minWorkoutsPerSide : 10;
    var tol = typeof o.abortRateTolerance === 'number' ? o.abortRateTolerance : 0.05;
    var maxCohort = typeof o.maxCohort === 'number' ? o.maxCohort : (o.cohort && typeof o.cohort.max === 'number' ? o.cohort.max : 5);

    /* ---- C1: begrenzter Nutzerkreis ----
       Belegt ist das nur, wenn die Kohortengröße BEKANNT und begrenzt ist. Ein
       fehlender Wert ist keine kleine Kohorte, sondern eine unbekannte. */
    var cohortSize = (o.cohort && typeof o.cohort.size === 'number') ? o.cohort.size : null;
    var cohortTag = (o.flag && o.flag.cohort) || null;
    var c1 = _crit('C1', 'Begrenzter Nutzerkreis',
      cohortSize == null ? 'insufficient_data' : (cohortSize > 0 && cohortSize <= maxCohort ? 'pass' : 'fail'),
      cohortSize, maxCohort,
      { cohortTag: cohortTag, note: cohortSize == null ? 'Kohortengröße nicht übergeben — unbekannt ist nicht klein' : null });

    /* ---- C2: serverseitig deaktivierbar ----
       Zwei Belege, beide nötig: die Schaltung kam vom SERVER (nicht aus einem
       lokalen Ersatzwert), UND der Client kann nicht schreiben. Fehlt einer,
       ist „serverseitig deaktivierbar" eine Zusage ohne Nachweis. */
    var src = (o.flag && o.flag.source) || null;
    var serverSourced = src === 'server' || src === 'server_no_row';
    var clientWritable = o.channel ? o.channel.clientWritable : null;
    var c2Status;
    if (clientWritable == null || src == null) c2Status = 'insufficient_data';
    else if (clientWritable === true) c2Status = 'fail';
    else if (!serverSourced) c2Status = 'fail';
    else c2Status = 'pass';
    var c2 = _crit('C2', 'Feature Flag serverseitig deaktivierbar', c2Status,
      serverSourced && clientWritable === false ? 1 : 0, 1,
      { flagSource: src, clientWritable: clientWritable,
        serverAuthoritative: o.channel ? !!o.channel.serverAuthoritative : null,
        killSwitchAvailable: o.channel ? !!o.channel.killSwitchAvailable : null,
        note: src === 'kill_switch' ? 'Notabschaltung aktiv — kein Serverbeleg in dieser Sitzung' : null });

    /* ---- C3: alte Heuristik weiterhin verfügbar ---- */
    var gen = o.legacy ? o.legacy.generatorPresent : null;
    var intact = o.legacy ? o.legacy.legacyPathIntact : null;
    var c3 = _crit('C3', 'Alte Heuristik weiterhin verfügbar',
      (gen == null || intact == null) ? 'insufficient_data' : ((gen && intact) ? 'pass' : 'fail'),
      (gen && intact) ? 1 : 0, 1,
      { generatorPresent: gen, legacyPathIntact: intact });

    /* ---- C4: Migration reversibel ----
       „Reversibel" heißt geprüft, nicht vorgesehen. Ohne durchgeführten
       Rückweg bleibt es insufficient_data. */
    var tested = o.revert ? o.revert.tested : null;
    var c4 = _crit('C4', 'Migration reversibel (Rückweg nachweislich ausgeführt)',
      tested == null ? 'insufficient_data' : (tested === true ? 'pass' : 'fail'),
      tested === true ? 1 : 0, 1,
      { at: (o.revert && o.revert.at) || null, evidence: (o.revert && o.revert.evidence) || null });

    /* ---- C5: Fehlerquote ----
       Nenner sind alle ERNSTHAFTEN Versuche: Ereignisse, bei denen das Flag an
       war. `flag_off` gehört nicht dazu — sonst ließe sich die Fehlerquote durch
       viele Leerläufe beliebig kleinrechnen. */
    var attempts = events.filter(function (e) { return e.reason !== 'flag_off'; });
    var errors = attempts.filter(function (e) { return ERROR_REASONS.indexOf(e.reason) >= 0 || (e.error != null && e.applied !== true); });
    var unclassified = attempts.filter(function (e) {
      return ERROR_REASONS.indexOf(e.reason) < 0 && BENIGN_REASONS.indexOf(e.reason) < 0 &&
        OVERRIDE_GUARD_REASONS.indexOf(e.reason) < 0;
    });
    var errRate = _rate(errors.length, attempts.length);
    var c5Status;
    if (attempts.length < minAttempts) c5Status = 'insufficient_data';
    else if (unclassified.length) c5Status = 'insufficient_data';   // eigene Blindheit ist kein Freispruch
    else c5Status = (errRate <= maxErrorRate ? 'pass' : 'fail');
    var c5 = _crit('C5', 'Fehlerquote unter Grenzwert (' + Math.round(maxErrorRate * 100) + ' %)',
      c5Status, errRate, maxErrorRate,
      { attempts: attempts.length, requiredAttempts: minAttempts, errors: errors.length,
        errorReasons: _tally(errors.map(function (e) { return e.reason; })),
        unclassifiedReasons: _tally(unclassified.map(function (e) { return e.reason; })),
        totalEvents: events.length });

    /* ---- C6: Abbruchrate ----
       Vergleich vorher/nachher. Beide Seiten brauchen genug Einheiten; sonst ist
       der Vergleich Rauschen. Richtungsabhängig: nur ein ANSTIEG blockiert. */
    function abortRate(list) {
      var arr = Array.isArray(list) ? list.filter(function (w) { return w && (w.status === 'aborted' || w.status === 'completed'); }) : [];
      var ab = arr.filter(function (w) { return w.status === 'aborted'; }).length;
      return { n: arr.length, aborted: ab, rate: _rate(ab, arr.length) };
    }
    var wb = abortRate(o.workouts && o.workouts.before);
    var wa = abortRate(o.workouts && o.workouts.after);
    var delta = (wb.rate == null || wa.rate == null) ? null : Math.round((wa.rate - wb.rate) * 10000) / 10000;
    var c6Status;
    if (wb.n < minWk || wa.n < minWk) c6Status = 'insufficient_data';
    else c6Status = (delta <= tol ? 'pass' : 'fail');
    var c6 = _crit('C6', 'Keine erhöhte Workout-Abbruchrate', c6Status, delta, tol,
      { before: wb, after: wa, requiredPerSide: minWk, tolerance: tol,
        note: delta != null && delta < 0 ? 'Abbruchrate gesunken — kein Blocker' : null });

    /* ---- C7: kein Verlust manueller Overrides ----
       Drei Belegquellen: die Schutzverweigerung (verhinderter Verlust — der
       Vorfall ist real und gehört gezählt), die Buchhaltungsabweichung (echter
       stiller Verlust) und `dropped > 0` in einer trotzdem angewandten
       Aktivierung (dürfte nach Konstruktion nie vorkommen — wird geprüft,
       weil genau solche „kann nicht passieren"-Annahmen brechen). */
    var applied = events.filter(function (e) { return e.applied === true; });
    var guarded = events.filter(function (e) { return OVERRIDE_GUARD_REASONS.indexOf(e.reason) >= 0; });
    var mismatch = events.filter(function (e) { return e.reason === 'override_accounting_mismatch'; });
    var lostInApplied = applied.filter(function (e) { return e.overrides && (e.overrides.dropped || 0) > 0; });
    var withOverrides = applied.filter(function (e) { return e.overrides && (e.overrides.before || 0) > 0; });
    var c7Status;
    if (mismatch.length || lostInApplied.length) c7Status = 'fail';
    else if (applied.length < minApplied || withOverrides.length === 0) c7Status = 'insufficient_data';
    else c7Status = 'pass';
    var c7 = _crit('C7', 'Kein Verlust manueller Overrides', c7Status,
      mismatch.length + lostInApplied.length, 0,
      { appliedActivations: applied.length, requiredApplied: minApplied,
        activationsWithOverrides: withOverrides.length,
        preventedLosses: guarded.length,
        accountingMismatches: mismatch.length,
        lostDespiteApply: lostInApplied.length,
        keptTotal: withOverrides.reduce(function (n, e) { return n + ((e.overrides && e.overrides.kept) || 0); }, 0),
        retargetedTotal: withOverrides.reduce(function (n, e) { return n + ((e.overrides && e.overrides.retargeted) || 0); }, 0),
        conflictsTotal: withOverrides.reduce(function (n, e) { return n + ((e.overrides && e.overrides.conflicts) || 0); }, 0),
        note: withOverrides.length === 0 && applied.length ? 'Aktivierungen ohne jeden Override belegen nichts über deren Erhalt' : null });

    var criteria = [c1, c2, c3, c4, c5, c6, c7];
    var blockers = criteria.filter(function (c) { return c.status === 'fail'; });
    var pending = criteria.filter(function (c) { return c.status === 'insufficient_data'; });
    var gateReady = blockers.length === 0 && pending.length === 0;

    return {
      version: VERSION,
      gate: 'canary',
      gateReady: gateReady,
      criteria: criteria,
      blockers: blockers.map(function (c) { return c.id; }),
      pending: pending.map(function (c) { return c.id; }),
      events: { total: events.length, applied: applied.length, attempts: attempts.length,
        reasons: _tally(events.map(function (e) { return e.reason; })) },
      nextStep: gateReady ? 'canary_gate_passed_proceed_to_live'
        : (blockers.length ? 'resolve_blockers:' + blockers.map(function (c) { return c.id; }).join(',')
          : 'collect_more_data:' + pending.map(function (c) { return c.id; }).join(','))
    };
  }

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }
  O.canaryEval = _freeze({ VERSION: VERSION, ERROR_REASONS: ERROR_REASONS.slice(),
    BENIGN_REASONS: BENIGN_REASONS.slice(), OVERRIDE_GUARD_REASONS: OVERRIDE_GUARD_REASONS.slice(),
    evaluate: evaluate });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.canaryEval;
})(typeof globalThis !== 'undefined' ? globalThis : this);
