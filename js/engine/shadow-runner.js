/* ============================================================
   ORVIA · engine/shadow-runner — E2: Engine-v2 SHADOW-MODE (Aktivierungsgate C8).
   Produktentscheidung 2026-07-11 (Master-Prompt §26 Prio 3 + Mandat „Engine
   produktreif"): v2 rechnet ab jetzt bei jeder Tagesentscheidung PARALLEL mit.
   Verbindlich:
   - v2 STEUERT NICHTS. Die sichtbare Entscheidung bleibt buildTrainingDecision (v1).
   - Protokoll NUR lokal, user-scoped (orvia_engine_shadow_<uid>), Ringpuffer 90
     Einträge, ein Eintrag je Tag (letzter Lauf gewinnt) — keine Server-Telemetrie.
   - Fehlende Inputs werden ehrlich als missingData geloggt, nie erfunden.
   - Gate-Kriterium (ENGINE-V2-DESIGN §5): ≥14 reale Tage protokolliert, Differenzen
     fachlich bewertet → erst dann Umschalt-Entscheidung.
   PHASE 8 (2026-07-18): der v2-Input wird nicht mehr hier ad-hoc gebaut,
   sondern zentral vom TrainingInputResolver (training-input-resolver.js) —
   inkl. der Vertrags-Fixes (soreness statt doms, rhrBaseline+Days statt
   restingHrBaseline, hrvBaselineLn/hrvSd28/hrvBaselineDays statt
   hrvBaselineLn7, safetyFlags als Objekt statt Array, kein Phantom m.pain)
   und des Garmin-Metric-Store-Fallbacks für objektive Werte.
   Debug: ORVIA.engineShadow.report() in der Konsole.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};

  function _uid() { return (O.user && O.user.id) || 'anon'; }
  function _key() { return 'orvia_engine_shadow_' + _uid(); }
  function _readLog() {
    try { var raw = root.localStorage && root.localStorage.getItem(_key()); var a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function _writeLog(a) { try { if (root.localStorage) root.localStorage.setItem(_key(), JSON.stringify(a.slice(-90))); } catch (e) {} }

  /* v1-Welt → v2-Input: delegiert an den TrainingInputResolver (Phase 8,
     EINE Input-Logik). Batch 0 — FAIL CLOSED: Ohne Resolver (Ladefehler)
     wird KEIN Ersatz-Input gebaut. Der frühere leere Fallback setzte
     illness:false/safetyFlags:{} und verwandelte damit Krankheit/Red Flags
     in ein scheinbar sicheres GREEN (Regression S6–S8). Ein fehlendes
     Sicherheits-Eingangsmodul darf nie eine optimistische Bewertung
     erzeugen ⇒ buildInput() liefert null, run() protokolliert BLOCKED. */
  function buildInput() {
    if (O.trainingInputResolver && typeof O.trainingInputResolver.collect === 'function') {
      return O.trainingInputResolver.collect();
    }
    return null;
  }

  /* Ein Shadow-Lauf: v1 lesen, v2 rechnen, Tages-Eintrag schreiben (ersetzt Vorlauf desselben Tages). */
  function run() {
    // PERF-INSTRUMENTIERUNG (Audit 2026-07-15): dieser Shadow-Lauf rechnet auf JEDEM
    // "Heute"-Tab-Öffnen zusätzlich zur v1-Entscheidung (renderDecision) und liest/schreibt
    // dabei den localStorage-Log neu, obwohl "ein Eintrag je Tag" genügen würde.
    var P = O.perf || { now: function () { return Date.now(); }, mark: function () {} };
    var _t0 = P.now();
    try {
      if (!O.decisionEngineV2 || typeof O.decisionEngineV2.evaluate !== 'function') return null;
      var today = (typeof root.todayStr === 'function') ? root.todayStr() : null;
      if (!today) return null;
      var v1 = null;
      try { if (typeof root.currentDecision === 'function') v1 = root.currentDecision(); } catch (e) {}
      var _ti = P.now();
      var input = buildInput();
      P.mark('engineShadow.run: buildInput (incl. own 28d load loop)', _ti);
      var entry;
      if (input === null) {
        /* Batch 0 — FAIL CLOSED: Resolver fehlt ⇒ keine v2-Bewertung, ehrlicher
           BLOCKED-Eintrag (state null, nicht vergleichbar). Niemals GREEN raten. */
        entry = {
          date: today, ts: Date.now(),
          v1: v1 ? { state: v1.state || v1.dayState || null, action: v1.todayAction || null, score: v1.score != null ? v1.score : null } : null,
          v2: { state: null, action: null, confidence: null, blocked: 'training_input_resolver_missing', reasons: [] },
          agree: null,
          missing: ['training_input_resolver_missing']
        };
      } else {
      var v2 = O.decisionEngineV2.evaluate(input);
      entry = {
        date: today, ts: Date.now(),
        v1: v1 ? { state: v1.state || v1.dayState || null, action: v1.todayAction || null, score: v1.score != null ? v1.score : null } : null,
        v2: { state: v2.dayState || null, action: v2.action || null, confidence: v2.confidence || null, reasons: (v2.reasons || []).slice(0, 4) },
        agree: (v1 && v1.state && v2.dayState) ? (v1.state === v2.dayState) : null,
        missing: (input._shadowMissing || []).concat(v2.missingData || []).slice(0, 6)
      };
      }
      var _tlog = P.now();
      var log = _readLog().filter(function (x) { return x && x.date !== today; });
      log.push(entry);
      _writeLog(log);
      P.mark('engineShadow.run: read+write shadow log (JSON.parse/stringify, every call)', _tlog);
      P.mark('engineShadow.run: TOTAL', _t0);
      return entry;
    } catch (e) {
      try { console.warn('[ORVIA shadow] Lauf fehlgeschlagen (steuert nichts):', e && e.message); } catch (_) {}
      return null;
    }
  }

  /* Gate-Report (ENGINE-V2-DESIGN §5): Tage, Übereinstimmung, Abweichungsliste. */
  function report() {
    var log = _readLog();
    var withBoth = log.filter(function (x) { return x && x.agree !== null; });
    var agrees = withBoth.filter(function (x) { return x.agree; }).length;
    return {
      days: log.length,
      comparableDays: withBoth.length,
      blockedDays: log.filter(function (x) { return x && x.v2 && x.v2.blocked; }).length,
      agreementRate: withBoth.length ? Math.round((agrees / withBoth.length) * 100) : null,
      gateReady: withBoth.length >= 14,
      diffs: withBoth.filter(function (x) { return !x.agree; }).map(function (x) {
        return { date: x.date, v1: x.v1 && x.v1.state, v2: x.v2 && x.v2.state, v2reasons: x.v2 && x.v2.reasons };
      })
    };
  }

  function clearLog() { try { if (root.localStorage) root.localStorage.removeItem(_key()); } catch (e) {} }

  O.engineShadow = { run: run, report: report, buildInput: buildInput, clearLog: clearLog, _key: _key };
})(typeof globalThis !== 'undefined' ? globalThis : this);
