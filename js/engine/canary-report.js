/* ============================================================
   ORVIA · engine/canary-report — der EINE Befehl für die Canary-Belege.

   WOFÜR: `canary-eval.js` ist bewusst pur — es rechnet nur, es sammelt nichts.
   Ohne einen Sammler müsste der Nutzer sieben Belegquellen von Hand zu einem
   JSON zusammensetzen, um eine Auswertung zu bekommen. Das wäre fehleranfällig
   genau dort, wo Genauigkeit zählt. Dieses Modul sammelt, was die App selbst
   wissen kann, und sagt ausdrücklich, was sie NICHT wissen kann.

   Konsole:  await ORVIA.canaryReport({ cohortSize: 1 })

   WAS DIE APP NICHT WISSEN KANN — und deshalb nicht errät:
     • Kohortengröße (C1): wie viele Nutzer das Flag serverseitig anhaben, steht in
       der Datenbank, nicht im Client. Ohne Angabe bleibt C1 `insufficient_data`.
     • Ein echter Rücklauf (C4) gilt nur als erbracht, wenn er im Protokoll steht.
       Eine vorhandene revert-Funktion ist kein durchgeführter Rücklauf.

   DER RLS-TEST IST ECHT, KEINE BEHAUPTUNG (C2): Statt zu versichern, dass der
   Client nicht schreiben darf, VERSUCHT dieses Modul einen Schreibvorgang und
   meldet, ob die Datenbank ihn abgewiesen hat. Der Versuch ist bewusst harmlos:
   `enabled: false` — selbst im (fehlerhaften) Erfolgsfall entsteht dadurch keine
   Aktivierung, sondern nur der Beleg, dass die Absicherung fehlt.

   Kein Urteil: dieses Modul bewertet nichts, es reicht die Belege an
   `canaryEval.evaluate()` weiter. Die Bewertung bleibt an einer Stelle.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'canary-report@1';
  var FLAG = 'engine_v2_plan';

  function _dateShift(dateStr, days) {
    try { var d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); } catch (e) { return null; }
  }
  function _today() {
    try { if (typeof root.todayStr === 'function') return root.todayStr(); } catch (e) {}
    return new Date().toISOString().slice(0, 10);
  }

  /* Belegt C2 durch Versuch, nicht durch Zusicherung. */
  function probeWriteBlocked() {
    var sb = O.sb || null;
    var uid = (O.user && O.user.id) || null;
    if (!sb || typeof sb.from !== 'function' || !uid) {
      return Promise.resolve({ tested: false, blocked: null, reason: 'no_client_or_user' });
    }
    var online = true; try { online = navigator.onLine !== false; } catch (e) {}
    if (!online) return Promise.resolve({ tested: false, blocked: null, reason: 'offline' });
    return Promise.resolve()
      .then(function () {
        return sb.from('user_feature_flags').insert({
          user_id: uid, flag: 'canary_diagnostics', enabled: false,
          reason: 'rls_probe', set_by: 'client_probe'
        });
      })
      .then(function (res) {
        if (res && res.error) return { tested: true, blocked: true, reason: 'rejected', code: res.error.code || null };
        /* Nicht abgewiesen ⇒ die Absicherung fehlt. Das ist ein Befund, kein Fehler
           dieses Moduls — und er gehört unverfälscht gemeldet. */
        return { tested: true, blocked: false, reason: 'insert_accepted_SECURITY_GAP' };
      })
      .catch(function (e) { return { tested: true, blocked: true, reason: 'threw', detail: String((e && e.message) || e) }; });
  }

  /* Workout-Abbrüche vor/nach der ersten Aktivierung (C6). */
  function collectWorkouts(splitDate, windowDays) {
    var repo = (O.repos && O.repos.workout) || null;
    if (!repo || typeof repo.listSessions !== 'function' || !splitDate) {
      return Promise.resolve({ before: null, after: null, note: 'kein Workout-Repository oder kein Aktivierungsdatum' });
    }
    var w = windowDays || 28;
    var from = _dateShift(splitDate, -w), to = _dateShift(splitDate, -1);
    return Promise.all([repo.listSessions(from, to), repo.listSessions(splitDate, _today())])
      .then(function (rs) {
        function rows(r) { return (r && r.success && Array.isArray(r.data)) ? r.data.map(function (x) { return { status: x.status, date: x.local_date }; }) : null; }
        return { before: rows(rs[0]), after: rows(rs[1]), windowDays: w, splitDate: splitDate,
          note: (rows(rs[0]) && rows(rs[1])) ? null : 'Sitzungen nicht abrufbar (offline oder nicht angemeldet)' };
      })
      .catch(function (e) { return { before: null, after: null, note: 'Abruf fehlgeschlagen: ' + String((e && e.message) || e) }; });
  }

  /* opts: { cohortSize, windowDays, skipWriteProbe } */
  function report(opts) {
    var o = opts || {};
    var PA = O.planActivation || null;
    var CE = O.canaryEval || null;
    if (!PA || !CE) return Promise.resolve({ error: 'module_missing', planActivation: !!PA, canaryEval: !!CE });

    var log = PA.log();
    var appliedFirst = log.filter(function (e) { return e && e.applied === true && e.at; })[0] || null;
    var splitDate = appliedFirst ? String(appliedFirst.at).slice(0, 10) : null;
    var reverted = log.filter(function (e) { return e && e.reason === 'reverted'; });

    var legacy = { generatorPresent: null, legacyPathIntact: null };
    try {
      legacy.generatorPresent = typeof root.generateWeekPlan === 'function';
      var w = (typeof root.activeWeekPlan === 'function') ? root.activeWeekPlan() : null;
      legacy.legacyPathIntact = Array.isArray(w) && w.length === 7;
    } catch (e) {}

    var probeP = o.skipWriteProbe ? Promise.resolve({ tested: false, blocked: null, reason: 'skipped_by_caller' }) : probeWriteBlocked();

    return Promise.all([probeP, collectWorkouts(splitDate, o.windowDays)]).then(function (r) {
      var probe = r[0], wk = r[1];
      var input = {
        activationLog: log,
        flag: (O.featureFlags && O.featureFlags.describe) ? O.featureFlags.describe(FLAG) : null,
        channel: {
          /* null = ungeprüft, NICHT „sicher". */
          clientWritable: probe.blocked == null ? null : !probe.blocked,
          serverAuthoritative: !!(O.featureFlags && O.featureFlags.describe && O.featureFlags.describe(FLAG).source === 'server'),
          killSwitchAvailable: !!(O.featureFlags && typeof O.featureFlags.killSwitch === 'function')
        },
        cohort: (typeof o.cohortSize === 'number') ? { size: o.cohortSize } : {},
        legacy: legacy,
        revert: reverted.length ? { tested: true, at: reverted[reverted.length - 1].at, evidence: 'activation_log' } : {},
        workouts: { before: wk.before || [], after: wk.after || [] }
      };
      var result = CE.evaluate(input);
      return {
        version: VERSION,
        result: result,
        /* Klartext, was der Mensch beisteuern muss — der Client kann es nicht wissen. */
        needsHuman: [].concat(
          typeof o.cohortSize === 'number' ? [] : ['cohortSize: wie viele Nutzer haben engine_v2_plan serverseitig an? (canaryReport({cohortSize: N}))'],
          reverted.length ? [] : ['C4: einmal ORVIA.enginePlanRevert() ausführen, nachdem eine Aktivierung stattgefunden hat'],
          probe.tested ? [] : ['C2: RLS-Schreibtest nicht gelaufen (' + probe.reason + ') — angemeldet und online wiederholen']
        ),
        evidence: { writeProbe: probe, workouts: { note: wk.note, splitDate: splitDate, windowDays: wk.windowDays || null,
          before: wk.before ? wk.before.length : null, after: wk.after ? wk.after.length : null },
          activationEvents: log.length, firstApplied: splitDate },
        input: input
      };
    });
  }

  var api = { VERSION: VERSION, FLAG: FLAG, report: report, probeWriteBlocked: probeWriteBlocked, collectWorkouts: collectWorkouts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.canaryReportModule = api;
  O.canaryReport = report;
})(typeof globalThis !== 'undefined' ? globalThis : this);
