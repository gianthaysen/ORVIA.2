/* ============================================================
   ORVIA · shadow-adaptive — Schattenbetrieb fuer C1 → C2 → Stufe 5

   ZWECK: Die adaptive Kette bei JEDEM Planlauf mitrechnen und ins Decision Log
   schreiben, OHNE den Plan zu veraendern. Damit laesst sich vor der ersten
   echten Plananwendung vergleichen, was der heutige Plan vorsieht, was die
   adaptive Empfehlung waere und wie die Machbarkeit dazu steht.

   DIE ZENTRALE ZUSAGE: `planMutation: 'none'`. Dieses Modul BEKOMMT den fertigen
   Plan und gibt ihn nicht zurueck. Es hat keinen Rueckgabepfad, ueber den eine
   Planaenderung entstehen koennte — das ist keine Disziplin, sondern Bauart.
   Wer den Plan aendern will, muss die Aufrufstelle aendern, und das faellt auf.

   ACHT ZUSAGEN, JEDE ALS TEST FORMULIERT:

   1. SHADOW AN/AUS ERZEUGT BYTE-IDENTISCHE PLAENE. Der Eingang wird tief
      eingefroren; ein Schreibversuch wirft im strict mode, statt still zu
      wirken. Zusaetzlich prueft ein Test die Aufrufstelle im Quelltext.

   2. FEHLER, TIMEOUT ODER FEHLENDE DATEN VERAENDERN DEN PLAN NICHT. Jede Stufe
      laeuft durch `_guard()`. Eine geworfene Ausnahme wird zu
      `{status:'failed', reason}` — sie verlaesst dieses Modul nie. Ein
      Zeitbudget (mit INJIZIERTER Uhr) bricht die Kette ab, statt sie zu
      erzwingen. Fail-closed heisst hier: lieber keine Beobachtung als eine
      halbe, die wie eine ganze aussieht.

   3. ALTE UND ADAPTIVE BERECHNUNG NUTZEN DENSELBEN EINGEFRORENEN SNAPSHOT.
      `snapshot()` friert einmal ein und hasht. Wuerden beide Zweige den
      Live-Zustand lesen, waere jede Abweichung nicht mehr zuzuordnen: Sie
      koennte aus der Logik ODER aus einer zwischenzeitlichen Datenaenderung
      stammen. Genau diese Verwechslung macht Schattenbetriebe wertlos.

   4. JEDER VERGLEICH TRAEGT CACHE-KEY, AUDIT-HASH UND ALLE VERSIONEN. Ein
      Eintrag ohne Vertragsversionen ist spaeter nicht interpretierbar.

   5. WIEDERHOLTE LAEUFE ERZEUGEN KEINE IRREFUEHRENDEN DUBLETTEN. Derselbe
      Snapshot unter denselben Versionen ergibt denselben `idempotencyKey`.
      Der zweite Lauf wird als `repeat: true` gefuehrt — nicht als zweite
      Beobachtung. Sonst zaehlte ein dreimal gerendeter Wochenplan als drei
      Belege, und die Abnahmekriterien waeren trivial erfuellbar.

   6. `provisionalTargetLoad` UND `autoApplicable:false` BLEIBEN BEOBACHTEND.
      Sie erscheinen im Vergleich, aber immer mit `applicable:false` und einem
      benannten Sperrgrund.

   7. ABWEICHUNGEN WERDEN STRUKTURIERT GELOGGT: Menge, Intensitaet, Frequenz,
      Scope und Begruendung — getrennte Felder, kein Fliesstext. Ein
      Volumenprozent ist keine Aussage ueber Intensitaet (C2-Vertrag).

   8. DIE ACHT FALLKRITERIEN ENTSCHEIDEN, NICHT DIE KALENDERZEIT. `acceptance()`
      wertet ausschliesslich Fallabdeckung aus. Verstrichene Tage werden
      berichtet, sind aber nie ein Kriterium — zwei ruhige Wochen ohne
      Krankheit, Deload oder Datenluecke belegen nichts.

   Kein DOM, keine Uhr, kein Zufall, kein Storage. Zeit kommt herein.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'shadow-adaptive@12';
  var POLICY_VERSION = 'shadow-policy@2';

  /* Der Modus ist eine Konstante, kein Schalter mit zwei Werten: Dieses Modul
     KANN nicht anwenden. Ein spaeterer Anwendungspfad ist ein anderes Modul. */
  var MODE = 'shadow';
  var PLAN_MUTATION = 'none';

  function _req(n) { if (typeof require !== 'function') return null; try { return require(n); } catch (e) { return null; } }
  var LH = O.loadHistory || _req('./load-history.js');
  var PR = O.progression || _req('./progression.js');
  var GF = O.goalFeasibility || _req('./goal-feasibility.js');
  var EV = O.evidence || _req('./evidence.js');

  /* ---- Hash und stabile Serialisierung (dieselbe Familie wie ueberall) ---- */
  function _stable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(_stable).join(',') + ']';
    var ks = Object.keys(v).sort(), out = [], i;
    for (i = 0; i < ks.length; i++) out.push(JSON.stringify(ks[i]) + ':' + _stable(v[ks[i]]));
    return '{' + out.join(',') + '}';
  }
  function _hash(s) {
    var h = 0x811c9dc5, i;
    s = String(s == null ? '' : s);
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  /* Tiefes Einfrieren. NICHT nur Kosmetik: Ohne das waere „der Snapshot ist
     unveraendert" eine Behauptung; mit ihm wirft ein Schreibversuch im strict
     mode und faellt sofort auf. */
  function deepFreeze(x, d) {
    var depth = d || 0;
    if (x === null || typeof x !== 'object' || depth > 12) return x;
    var ks = Object.keys(x), i;
    for (i = 0; i < ks.length; i++) deepFreeze(x[ks[i]], depth + 1);
    try { return Object.freeze(x); } catch (e) { return x; }
  }
  function _clone(x, d) {
    var depth = d || 0;
    if (x === null || typeof x !== 'object' || depth > 12) return x;
    if (Array.isArray(x)) return x.map(function (v) { return _clone(v, depth + 1); });
    var out = {}, ks = Object.keys(x), i;
    for (i = 0; i < ks.length; i++) out[ks[i]] = _clone(x[ks[i]], depth + 1);
    return out;
  }

  /* ============================================================
     SNAPSHOT — EINE WAHRHEIT FUER BEIDE ZWEIGE

     Beide Berechnungen muessen denselben Eingang sehen. Liest der alte Zweig
     den Live-Zustand und der adaptive einen spaeteren, ist jede Abweichung
     mehrdeutig: Logik oder Datenaenderung? Ein Vergleich, der das nicht
     trennen kann, taugt nicht als Abnahmegrundlage.
     ============================================================ */
  function snapshot(raw) {
    var r = raw || {};
    var snap = {
      /* WESSEN Beobachtung das ist, gehoert zur Identitaet. Ohne userId
         koennten in einer Mehr-Nutzer-Auswertung zwei Nutzer mit zufaellig
         identischen Daten zu EINER Beobachtung verschmelzen — und die
         Fallabdeckung saehe breiter aus, als sie ist. */
      userId: r.userId || null,
      weekId: r.weekId || null,
      planId: r.planId || null,
      today: r.today || null,
      /* Der ausgelieferte Plan als VERGLEICHSGROESSE, nicht als Arbeitskopie. */
      currentPlan: _clone(r.currentPlan) || null,
      activities: _clone(r.activities) || [],
      debriefs: _clone(r.debriefs) || [],
      sports: _clone(r.sports) || null,
      phase: r.phase || null,
      lowWeekReason: r.lowWeekReason || null,
      interruption: _clone(r.interruption) || null,
      goal: _clone(r.goal) || null,
      targetDate: r.targetDate || null,
      level: r.level || null,
      currentPerformance: _clone(r.currentPerformance) || null,
      availability: _clone(r.availability) || null,
      weeksLeft: r.weeksLeft != null ? r.weeksLeft : null,
      /* HERKUNFTSVERTRAG DES EINGANGS (@8): observer-input liefert Hash,
         Version und basis-Felder — sie werden hier NICHT mehr verworfen,
         sondern gehoeren zum Snapshot und damit zur persistierten
         Beobachtung. Ohne sie waeren „activityStore fehlt" und
         „bewusst leer" in der Abnahme wieder ununterscheidbar. */
      inputHash: r.inputHash || null,
      inputVersion: r.inputVersion || null,
      inputBasis: _clone(r.inputBasis) || null,
      /* @9: Sicherheitsschicht — uebersetzte Beschwerden/Red Flags in
         C2-Form (severity/blocks). Ohne sie erreichte KEINE Einschraenkung
         jemals den Sicherheitsschritt der Progression. */
      constraints: _clone(r.constraints) || null
    };
    snap.hash = _hash(_stable(snap));
    return deepFreeze(snap);
  }

  /* ============================================================
     SCHUTZHUELLE UM JEDE STUFE

     Eine geworfene Ausnahme aus C1, C2 oder Stufe 5 darf den Planlauf nicht
     beruehren. Sie wird hier zu einem Datenpunkt: `{status:'failed', reason}`.
     Das Zeitbudget arbeitet mit einer INJIZIERTEN Uhr (`opts.now`) — ohne sie
     gibt es kein Budget, dafuer volle Determinismus. Eine eigene Uhr haette
     dieses Modul unpruefbar gemacht.
     ============================================================ */
  function _guard(label, fn, ctx) {
    if (ctx.aborted) return { status: 'skipped', reason: ctx.abortReason, value: null };
    if (ctx.now && ctx.deadline != null) {
      var t = ctx.now();
      if (typeof t === 'number' && t > ctx.deadline) {
        ctx.aborted = true; ctx.abortReason = 'budget_exceeded';
        return { status: 'skipped', reason: 'budget_exceeded', value: null };
      }
    }
    var t0 = ctx.now ? ctx.now() : null;
    function dur() { return (ctx.now && typeof t0 === 'number') ? Math.max(0, ctx.now() - t0) : null; }
    try {
      var v = fn();
      if (v == null) return { status: 'no_data', reason: label + '_returned_null', value: null, durationMs: dur() };
      return { status: 'ok', reason: null, value: v, durationMs: dur() };
    } catch (e) {
      return { status: 'failed', reason: (e && e.message) ? String(e.message).slice(0, 120) : 'unknown_error', value: null, durationMs: dur() };
    }
  }

  /* ============================================================
     ABWEICHUNG — VIER GETRENNTE DIMENSIONEN

     Der C2-Vertrag sagt ausdruecklich: Ein Prozentwert beschreibt VOLUMEN.
     Intensitaet, Frequenz und Geltungsbereich sind eigene Groessen mit eigener
     Politik. Sie hier zu einem Satz zu verschmelzen wuerde genau die
     Vermischung wieder einfuehren, die C2 aufgeloest hat.
     ============================================================ */
  function deviationOf(snap, prog, feas) {
    var dev = {
      volume: null, intensity: null, frequency: null, scope: null,
      applicable: false, blocked: [], rationale: null,
      wouldChangePlan: false, applied: false, mode: MODE
    };
    if (!prog) { dev.blocked.push('no_progression_result'); return dev; }

    var dp = prog.dimensionPolicy || null;
    var range = prog.allowableRange || null;

    /* SPERREN ZUERST BENENNEN. Sie entscheiden ueber `applicable` — und
       `applicable` ist die einzige Stelle, an der spaeter ueberhaupt eine
       Anwendung entstehen koennte. */
    if (prog.actionable === false) dev.blocked.push('not_actionable');
    if (prog.autoApplicable === false) dev.blocked.push('not_auto_applicable');
    if (prog.targetLoad == null && prog.provisionalTargetLoad != null) dev.blocked.push('provisional_only');
    if (prog.status === 'review') dev.blocked.push('status_review');

    var isIncrease = (prog.delta != null && prog.delta > 0);
    /* DIESELBE ASYMMETRIE WIE IN C2: Eine Absenkung ist immer sicher; gesperrt
       wird, was den Umfang ERHOEHT. Im Schattenbetrieb wird ohnehin nichts
       angewendet — aber `applicable` muss schon hier die Wahrheit sagen, sonst
       zeigt die spaetere Auswertung eine Freigabe, die es nie gab. */
    dev.applicable = dev.blocked.length === 0 || (!isIncrease && prog.targetLoad != null);

    dev.volume = {
      referenceLoad: prog.referenceLoad != null ? prog.referenceLoad : null,
      currentWeekLoad: prog.lastWeekLoad != null ? prog.lastWeekLoad : null,
      recommendedLoad: prog.targetLoad != null ? prog.targetLoad : null,
      provisionalLoad: prog.provisionalTargetLoad != null ? prog.provisionalTargetLoad : null,
      isProvisional: prog.targetLoad == null && prog.provisionalTargetLoad != null,
      deltaPct: prog.delta != null ? prog.delta : (prog.selectedDelta != null ? prog.selectedDelta : null),
      allowableRange: range ? { min: range.min, max: range.max } : null,
      selectionReason: prog.selectionReason || null,
      direction: prog.delta == null ? 'unknown' : (prog.delta > 0 ? 'increase' : (prog.delta < 0 ? 'reduce' : 'hold')),
      unit: 'pct_of_reference'
    };
    dev.intensity = dp ? { policy: dp.intensityPolicy || null, scope: dp.scope || null } : null;
    dev.frequency = dp ? { policy: dp.frequencyPolicy || null } : null;
    /* Der Scope wird NIE zerlegt und nie erfunden. Fehlt er, gilt er als
       unbekannt — und ein unbekannter Scope wirkt ausdruecklich NICHT global. */
    dev.scope = (dp && dp.scope) ? dp.scope : null;
    if (!dev.scope) dev.blocked.push('scope_unknown');

    dev.wouldChangePlan = !!(dev.volume.deltaPct != null && dev.volume.deltaPct !== 0);
    dev.rationale = prog.rationale || null;
    dev.limitingFactor = prog.limitingFactor || null;
    dev.feasibilityStatus = feas ? feas.status : null;
    /* GOAL FEASIBILITY VERAENDERT KEINEN KORRIDOR. Sie steht hier als
       Beurteilung daneben — nicht als Faktor in `applicable`. */
    dev.feasibilityInfluencesCorridor = false;
    return dev;
  }

  /* ============================================================
     BEOBACHTEN — DIE HAUPTFUNKTION. WIRFT NIE.
     ============================================================ */
  function observe(snap, opts) {
    var o = opts || {};
    var s = snap || {};
    var ctx = { aborted: false, abortReason: null, now: (typeof o.now === 'function') ? o.now : null,
      deadline: null };
    if (ctx.now && o.budgetMs > 0) {
      var t0 = ctx.now();
      ctx.deadline = (typeof t0 === 'number') ? t0 + o.budgetMs : null;
    }

    var stages = {};
    /* EINE AUSDRUECKLICH UEBERGEBENE REGISTRY GILT STRIKT. Der erste Entwurf
       fiel auf die global geladenen Module zurueck, wenn die Registry ein Modul
       nicht fuehrte — damit meldete ein Lauf „ok", obwohl das Modul laut
       Registry gar nicht da war. Ein Rueckfall, der einen Fehlzustand in einen
       Erfolg verwandelt, ist genau die Art stiller Fehler, die dieses Modul
       aufdecken soll. Ohne Registry gilt weiterhin der Normalfall O. */
    var strict = !!o.registry;
    var reg = o.registry || O;
    var lh = strict ? reg.loadHistory : (reg.loadHistory || LH);
    var pr = strict ? reg.progression : (reg.progression || PR);
    var gf = strict ? reg.goalFeasibility : (reg.goalFeasibility || GF);

    /* ---- C1 ---- */
    var r1 = _guard('c1', function () {
      if (!lh || !lh.buildHistory) throw new Error('load_history_missing');
      return lh.buildHistory({ today: s.today, activities: s.activities,
        debriefs: s.debriefs, sports: s.sports });
    }, ctx);
    stages.c1 = { status: r1.status, reason: r1.reason, durationMs: r1.durationMs };
    var hist = r1.value;

    /* ---- C2 ---- */
    var r2 = _guard('c2', function () {
      if (!pr || !pr.progressionDecision) throw new Error('progression_missing');
      return pr.progressionDecision({
        loadHistory: hist, toleranceState: hist ? hist.toleranceState : null,
        phase: s.phase, lowWeekReason: s.lowWeekReason, interruption: s.interruption,
        constraints: s.constraints || null
      });
    }, ctx);
    stages.c2 = { status: r2.status, reason: r2.reason, durationMs: r2.durationMs };
    var prog = r2.value;

    /* ---- Stufe 5 ---- */
    var r3 = _guard('s5', function () {
      if (!gf || !gf.feasibility) throw new Error('goal_feasibility_missing');
      return gf.feasibility({
        goal: s.goal, targetDate: s.targetDate, today: s.today, level: s.level,
        currentPerformance: s.currentPerformance, availability: s.availability,
        weeksLeft: s.weeksLeft, allowableProgression: prog,
        historyEvidence: hist && hist.trainingState ? hist.trainingState.evidence : null
      });
    }, ctx);
    stages.s5 = { status: r3.status, reason: r3.reason, durationMs: r3.durationMs };
    var feas = r3.value;

    var dev = _guard('deviation', function () { return deviationOf(s, prog, feas); }, ctx).value;

    /* STATUS DER BEOBACHTUNG — dreiwertig, nie zweiwertig. `partial` ist ein
       eigener Zustand: Eine Kette ohne Stufe 5 ist kein Fehler, aber auch kein
       vollstaendiger Beleg fuer die Abnahme. */
    var alle = [stages.c1.status, stages.c2.status, stages.s5.status];
    var status = alle.every(function (x) { return x === 'ok'; }) ? 'ok'
      : (alle.every(function (x) { return x !== 'ok'; }) ? 'failed' : 'partial');

    var versions = {
      shadow: VERSION, shadowPolicy: POLICY_VERSION,
      history: (lh && lh.VERSION) || 'absent', historyPolicy: (lh && lh.POLICY_VERSION) || 'absent',
      progression: (pr && pr.VERSION) || 'absent', progressionPolicy: (pr && pr.POLICY_VERSION) || 'absent',
      feasibility: (gf && gf.VERSION) || 'absent', feasibilityPolicy: (gf && gf.POLICY_VERSION) || 'absent',
      /* Der Uebersetzer rechnet hier nicht mit — aber die Abnahme gatet SEINE
         Aktivierung. Eine Beobachtung, die nicht sagt, unter welchem
         Uebersetzer-Vertrag sie entstand, kann ihn nicht abnehmen. */
      translator: (reg && reg.planTranslator && reg.planTranslator.VERSION) || 'absent',
      translatorPolicy: (reg && reg.planTranslator && reg.planTranslator.POLICY_VERSION) || 'absent',
      debrief: (reg && reg.sessionDebrief && reg.sessionDebrief.VERSION) || 'absent',
      loadProfile: (reg && reg.loadProfile && reg.loadProfile.VERSION) || 'absent',
      designer: (reg && reg.weekPlanDesigner && reg.weekPlanDesigner.VERSION) || 'absent',
      weekPolicy: (reg && reg.weekPlanPolicy && reg.weekPlanPolicy.VERSION) || 'absent',
      evidence: (EV && EV.VERSION) || 'absent',
      /* DER EINGANGSADAPTER GEHOERT ZUM VERTRAG (@7): Ein anderer Adapter
         (andere Datenquellen!) ist eine andere Beobachtungsbedeutung —
         v8-298 bewies es zweimal: tote Debrief- und Aktivitaetsquellen
         aenderten jede Aussage, aber keine Kohortenversion. */
      input: (reg && reg.observerInput && reg.observerInput.VERSION) || 'absent',
      /* @11: auch die QUELLENBESCHAFFUNG ist Vertrag — zweimal entstand ein
         P0 genau dort, unsichtbar fuer die Kohorte. */
      source: (reg && reg.observerSource && reg.observerSource.VERSION) || 'absent'
    };

    /* Cache-Key und Audit-Hash kommen aus Stufe 5 selbst — sie dort noch einmal
       nachzubauen waere eine zweite Wahrheit. */
    var cacheKey = feas && feas.cacheKey ? feas.cacheKey : null;
    var auditHash = null;
    try {
      if (gf && gf.auditHash) {
        auditHash = gf.auditHash({ goal: s.goal, targetDate: s.targetDate, today: s.today,
          level: s.level, currentPerformance: s.currentPerformance, availability: s.availability,
          weeksLeft: s.weeksLeft, allowableProgression: prog }, reg).key;
      }
    } catch (e) { auditHash = null; }

    var obs = {
      mode: MODE, planMutation: PLAN_MUTATION, applied: false, observationOnly: true,
      status: status, stages: stages,
      /* Wessen Beobachtung — noetig, damit lokale Puffer nach einem
         Nutzerwechsel nicht vermischt werden. */
      userId: s.userId || null,
      weekId: s.weekId || null, planId: s.planId || null, today: s.today || null,
      /* @8: Herkunft des Eingangs — persistiert, nicht nur im Snapshot. */
      inputHash: s.inputHash || null, inputVersion: s.inputVersion || null,
      inputBasis: s.inputBasis ? JSON.parse(JSON.stringify(s.inputBasis)) : null,
      history: hist ? {
        completeness: hist.rolling && hist.rolling[28] ? hist.rolling[28].completeness : null,
        acuteChronic: hist.acuteChronic || null,
        trainingState: hist.trainingState || null,
        toleranceState: hist.toleranceState || null,
        policyVersion: hist.policyVersion || null
      } : null,
      progression: prog ? _clone(prog) : null,
      feasibility: feas ? _clone(feas) : null,
      deviation: dev || null,
      hashes: { snapshot: s.hash || null, cacheKey: cacheKey, auditHash: auditHash },
      versions: versions,
      abortReason: ctx.abortReason
    };

    /* IDEMPOTENZ: derselbe Snapshot unter denselben Vertragsversionen ist
       DIESELBE Beobachtung — auch beim dritten Render der Wochenansicht. */
    /* DIE BEWERTUNGSIDENTITAET STEHT AUSDRUECKLICH IM SCHLUESSEL — Nutzer,
       Woche, Plan, Snapshot, Vertragsversionen. weekId und planId stecken zwar
       schon im Snapshot-Hash, aber implizit: Wer den Snapshot-Aufbau aendert,
       koennte sie dort verlieren, ohne dass es auffiele. Als eigene Felder ist
       der Schluessel gegen solche Umbauten robust. */
    obs.idempotencyKey = _hash(_stable({ userId: s.userId || null, snap: s.hash || null,
      weekId: obs.weekId, planId: obs.planId, versions: versions }));
    var seen = o.seenKeys;
    var known = false;
    if (seen) {
      if (typeof seen.indexOf === 'function') known = seen.indexOf(obs.idempotencyKey) >= 0;
      else if (typeof seen.has === 'function') known = seen.has(obs.idempotencyKey);
      else if (typeof seen === 'object') known = !!seen[obs.idempotencyKey];
    }
    obs.repeat = known;
    obs.novel = !known;

    /* Merkmale fuer die Abnahme — hier gesetzt, damit die Auswertung spaeter
       nicht raten muss, was der Lauf enthalten hat. */
    obs.coverage = {
      feasibilityStatus: feas ? feas.status : null,
      progressionStatus: prog ? prog.status : null,
      hasProvisional: !!(prog && prog.targetLoad == null && prog.provisionalTargetLoad != null),
      autoApplicable: prog ? prog.autoApplicable === true : null,
      phase: s.phase || null,
      interruptionReason: (s.interruption && s.interruption.reason) || null,
      lowWeekReason: s.lowWeekReason || null,
      fixture: o.fixture === true
    };
    return obs;
  }

  /* ============================================================
     LOG-EINTRAG — Nutzlast fuer decision-log.logDecision()
     ============================================================ */
  function toLogEntry(obs, opts) {
    var o = opts || {}, b = obs || {};
    return {
      decisionType: 'shadow_observation',
      decisionId: o.decisionId || null,
      parentDecisionId: o.parentDecisionId || null,
      timestamp: o.timestamp || null,
      weekId: b.weekId || null, planId: b.planId || null,
      registry: o.registry || undefined,
      inputs: { snapshotHash: b.hashes ? b.hashes.snapshot : null, mode: MODE,
        today: b.today || null },
      derivedState: {
        mode: MODE, planMutation: PLAN_MUTATION, applied: false, observationOnly: true,
        userId: b.userId || null,
        weekId: b.weekId || null, planId: b.planId || null,
        observedAt: o.timestamp || null,
        status: b.status || null, stages: b.stages || null,
        deviation: b.deviation || null,
        feasibility: b.feasibility ? { status: b.feasibility.status,
          evidence: b.feasibility.evidence, limitingFactors: b.feasibility.limitingFactors,
          actionable: b.feasibility.actionable } : null,
        progression: b.progression ? { status: b.progression.status, delta: b.progression.delta,
          targetLoad: b.progression.targetLoad, provisionalTargetLoad: b.progression.provisionalTargetLoad,
          actionable: b.progression.actionable, autoApplicable: b.progression.autoApplicable,
          allowableRange: b.progression.allowableRange, selectionReason: b.progression.selectionReason,
          referenceLoad: b.progression.referenceLoad } : null,
        hashes: b.hashes || null, versions: b.versions || null,
        /* @12: DIE DRITTE FELDLISTE hatte die Eingangs-Herkunft beim
           PERSISTIEREN verworfen — Snapshot und Beobachtung trugen sie,
           der Log-Record nicht, und das fail-closed-Gate haette jede
           reale Beobachtung ausgeschlossen. Dieselbe Fehlerklasse wie
           der ui-Katalog, eine Schicht tiefer. */
        inputHash: b.inputHash || null, inputVersion: b.inputVersion || null,
        inputBasis: b.inputBasis || null,
        idempotencyKey: b.idempotencyKey || null, repeat: !!b.repeat,
        coverage: b.coverage || null
      },
      selected: null,
      rulesTriggered: (b.deviation && b.deviation.blocked) ? b.deviation.blocked.slice() : []
    };
  }

  /* ============================================================
     ABNAHME — ACHT FALLKRITERIEN, KEINE KALENDERZEIT

     Verstrichene Tage werden BERICHTET, sind aber nie ein Kriterium. Zwei
     ruhige Wochen ohne Krankheit, Deload oder Datenluecke belegen nichts —
     genau daran scheitert die uebliche „14 Tage im Schatten"-Abnahme.
     ============================================================ */
  /* ============================================================
     VERSIONSKOHORTE

     Eine Beobachtung nimmt nur den Code ab, den sie AUSGEFUEHRT hat. Eine
     alte Beobachtung unter goal-feasibility@1 sagt nichts ueber @2 — sie
     mitzuzaehlen hiesse, einen Pfad abzunehmen, den nie jemand gelaufen ist.
     Die Kohorte umfasst genau die Vertraege, deren Aktivierung die Abnahme
     gatet: shadow-adaptive, goal-feasibility, progression, plan-translator,
     jeweils Modul UND Policy.
     ============================================================ */
  /* DER ABNAHMEVERTRAG IST BREITER ALS DIE RECHENKETTE. Die erste Fassung
     umfasste nur die vier Module, die in der Beobachtung selbst rechnen. Zu
     eng: Die Shadow-AUSSAGE haengt auch an load-history (was ist Belastung?),
     session-debrief (was ist Toleranz?), evidence (was darf steuern?),
     load-profile (was wiegt eine Einheit?) und an Designer und Policy (wogegen
     wird verglichen?). Aendert sich load-history, beruhen alte und neue
     Beobachtungen auf verschiedenen Belastungszustaenden — sie in einer
     Kohorte zu mischen, naehme einen Zustand ab, den niemand gesehen hat.
     Kein Registry-Hash: eine EXPLIZITE Liste tatsaechlich relevanter
     End-to-End-Abhaengigkeiten. */
  var COHORT_FIELDS = ['shadow', 'shadowPolicy',
    'history', 'historyPolicy', 'debrief', 'evidence', 'loadProfile',
    'progression', 'progressionPolicy', 'feasibility', 'feasibilityPolicy',
    'translator', 'translatorPolicy', 'designer', 'weekPolicy',
    /* @7: der Eingangsadapter — siehe versions.input. */
    'input',
    /* @11: die Quellenbeschaffung — siehe versions.source. */
    'source'];
  function cohortOf(versions) {
    var v = versions || {}, parts = {}, n;
    for (n = 0; n < COHORT_FIELDS.length; n++) parts[COHORT_FIELDS[n]] = v[COHORT_FIELDS[n]] || 'absent';
    return { key: _hash(_stable(parts)), versions: parts };
  }
  function currentCohort(registry) {
    var R = registry || O;
    function v(m, f) { try { return (R[m] && R[m][f]) || 'absent'; } catch (e) { return 'absent'; } }
    return cohortOf({
      shadow: VERSION, shadowPolicy: POLICY_VERSION,
      history: v('loadHistory', 'VERSION'), historyPolicy: v('loadHistory', 'POLICY_VERSION'),
      debrief: v('sessionDebrief', 'VERSION'),
      evidence: v('evidence', 'VERSION'),
      loadProfile: v('loadProfile', 'VERSION'),
      progression: v('progression', 'VERSION'), progressionPolicy: v('progression', 'POLICY_VERSION'),
      feasibility: v('goalFeasibility', 'VERSION'), feasibilityPolicy: v('goalFeasibility', 'POLICY_VERSION'),
      translator: v('planTranslator', 'VERSION'), translatorPolicy: v('planTranslator', 'POLICY_VERSION'),
      designer: v('weekPlanDesigner', 'VERSION'), weekPolicy: v('weekPlanPolicy', 'VERSION'),
      input: v('observerInput', 'VERSION'),
      source: v('observerSource', 'VERSION')
    });
  }

  /* WELCHE KRITERIEN ECHTE BEOBACHTUNGEN VERLANGEN: Seltene Sicherheitspfade
     (Krankheit, Taper, Deload, review) duerfen per Fixture abgenommen werden —
     ein Pfad, der im Zeitraum nie real auftritt, ist sonst nicht pruefbar.
     Der ALLTAG dagegen laesst sich nicht simulieren: Datenqualitaet, echte
     Abweichungen und der Normalfall muessen aus echten Beobachtungen stammen.
     Ein Fixture, das den Normalfall „belegt", belegt nur sich selbst. */
  var REQUIRE_REAL = ['plan_unchanged', 'full_chain', 'deviation_explainable',
    'no_positive_without_auto', 'reproducible'];

  /* MINDESTFALLZAHLEN [A]: Acht gruene Kaestchen sind keine Abnahme, wenn
     hinter einem Kaestchen ein einziger Fall steht. Ein einzelner echter
     Normalfall nimmt weder „reproduzierbar" noch „Abweichungen erklaerbar"
     endgueltig ab. Die Zahlen sind Policy, keine Physik — deshalb stehen sie
     hier benannt und versioniert, nicht verstreut in Bedingungen.
     UNABHAENGIGKEIT zaehlt: zehn Render desselben Plans sind EIN Fall
     (Idempotenzschluessel). */
  /* FALL-IDENTITAET ≠ IDEMPOTENZSCHLUESSEL. Der Idempotenzschluessel enthaelt
     den Snapshot-Hash — richtig fuer „ist das ein Duplikat?", falsch fuer
     „wie viele unabhaengige Faelle gibt es?": Dieselbe Woche, fuenfmal mit
     leicht gewachsenen Daten gerendert, waere sonst fuenf Faelle. Ein FALL
     ist die zugrunde liegende Woche/Plan-Instanz eines Nutzers. Ohne
     bestimmbare Identitaet wird NICHT aufgeblaeht: alle unbestimmbaren
     Beobachtungen kollabieren fail-closed zu EINEM Fall. */
  function caseKeyOf(b) {
    var o = b || {};
    if (o.weekId != null || o.planId != null) {
      return _hash(_stable({ u: o.userId || null, w: o.weekId || null, p: o.planId || null }));
    }
    /* KEIN SNAPSHOT-RUECKFALL MEHR: Der Snapshot-Hash aendert sich mit jedem
       Datenzuwachs — derselbe Wochenzustand haette wieder mehrere
       „unabhaengige" Faelle ergeben, genau die Aufblaehung, die die
       Fallidentitaet verhindern soll. Ohne Woche/Plan gibt es KEINE
       Fallidentitaet, und ohne Fallidentitaet kollabiert alles zu einem. */
    return 'unidentified';
  }
  function uniqueByCase(arr) {
    var seen = {}, out = [];
    (arr || []).forEach(function (b) {
      var k = caseKeyOf(b);
      if (seen[k]) return;
      seen[k] = 1; out.push(b);
    });
    return out;
  }

  var MIN_REAL_CASES = {
    plan_unchanged: 5,
    full_chain: 3,
    no_positive_without_auto: 5,
    reproducible: 3,
    deviation_explainable: 2
  };

  var CRITERIA = [
    'plan_unchanged', 'full_chain', 'all_feasibility_states', 'review_case',
    'special_phases', 'no_positive_without_auto', 'deviation_explainable', 'reproducible'
  ];

  function acceptance(observations, opts) {
    var o = opts || {};
    var all = Array.isArray(observations) ? observations.filter(Boolean) : [];
    var cohort = o.cohort || currentCohort(o.registry);

    /* 1. KOHORTENFILTER VOR ALLEM ANDEREN. Beobachtungen fremder Versionen
       werden nicht bewertet, sondern gezaehlt und ausgewiesen. */
    var inCohort = [], excluded = 0;
    all.forEach(function (b) {
      if (cohortOf(b.versions).key === cohort.key) inCohort.push(b);
      else excluded++;
    });

    /* 2. DEDUP ueber den Idempotenzschluessel — sonst zaehlt ein dreimal
       gerenderter Wochenplan dreifach. */
    var uniq = {}, list = [];
    inCohort.forEach(function (b) {
      var k = b.idempotencyKey || _hash(_stable(b));
      if (uniq[k]) return;
      uniq[k] = 1; list.push(b);
    });

    /* 3. BELEGARTEN TRENNEN. */
    function isFixture(b) { return !!(b.coverage && b.coverage.fixture === true); }

    /* 3b. PFLICHTQUELLEN (@9): Eine Beobachtung, deren Eingangsbasis eine
       PFLICHTQUELLE als 'unavailable' ausweist, kann fachlich nichts
       belegen — formal gruene Stufen ueber leeren Listen sind kein Beleg.
       Sie zaehlt deshalb fuer KEIN Kriterium ausser plan_unchanged
       (Nichtmutation ist auch ohne Daten belegbar). Beobachtungen OHNE
       inputBasis-Feld sind Fixtures oder Fremdkohorten — der Kohortenfilter
       oben hat Fremde bereits entfernt, Fixtures tragen ihre Kennzeichnung. */
    var REQUIRED_SOURCES = ['activities', 'debriefs', 'goal', 'performance',
      'checkins', 'profileConstraints'];
    function basisComplete(b) {
      /* FAIL-CLOSED (@10): Fuer eine REALE Beobachtung muss jedes
         Pflichtfeld EXAKT 'provided' sein — fehlendes inputBasis oder ein
         fehlendes Einzelfeld ist kein Freifahrtschein, sondern ein
         Ausschluss. Fixtures tragen ihre eigene Kennzeichnung und werden
         nicht ueber die Basis bewertet. */
      if (b && b.coverage && b.coverage.fixture === true) return true;
      var ib = b && b.inputBasis;
      if (!ib) return false;
      for (var q = 0; q < REQUIRED_SOURCES.length; q++) {
        if (ib[REQUIRED_SOURCES[q]] !== 'provided') return false;
      }
      return true;
    }
    var fullList = list, basisExcluded = list.filter(function (b) { return !basisComplete(b); }).length;
    list = list.filter(basisComplete);
    var fullReal = fullList.filter(function (b) { return !isFixture(b); });
    var real = list.filter(function (b) { return !isFixture(b); });
    var fx = list.filter(isFixture);
    /* 3b. NUR VOLLSTAENDIGE BEOBACHTUNGEN TRAGEN FACHLICHE ZUSTAENDE. Eine
       partial-Beobachtung hat Stufen uebersprungen — ein Machbarkeitsstatus
       oder ein review-Fall aus einem solchen Lauf ist nicht vollstaendig
       berechnet und nimmt nichts ab. plan_unchanged bleibt davon unberuehrt:
       Die Nicht-Mutation muss auch fuer partial gelten. */
    var komplett = list.filter(function (b) { return b.status === 'ok'; });
    var realKomplett = real.filter(function (b) { return b.status === 'ok'; });

    function _span(cases) {
      var ts = cases.map(function (b) { return b.observedAt || null; }).filter(Boolean).sort();
      return { firstObservedAt: ts[0] || null, lastObservedAt: ts[ts.length - 1] || null };
    }
    /* Jedes Kriterium traegt seine BELEGSTAERKE: wie viele unabhaengige Faelle,
       davon echte und Fixtures, und ueber welchen Zeitraum. `met` verlangt
       neben der Bedingung auch die Mindestfallzahl echter Faelle. */
    function crit(id, met, detail, cases) {
      var needsReal = REQUIRE_REAL.indexOf(id) >= 0;
      /* UNABHAENGIG heisst: verschiedene zugrunde liegende Faelle — nicht
         verschiedene Render desselben Falls. */
      var cs = uniqueByCase(Array.isArray(cases) ? cases : []);
      var realCs = cs.filter(function (b) { return !isFixture(b); });
      var fxCs = cs.filter(isFixture);
      var min = MIN_REAL_CASES[id] || 0;
      var enough = realCs.length >= min;
      var span = _span(cs);
      return { id: id, met: !!met && (min === 0 || enough), detail: detail || null,
        requiresReal: needsReal,
        independentCases: cs.length, realCases: realCs.length, fixtureCases: fxCs.length,
        minRealCases: min, enoughEvidence: min === 0 || enough,
        firstObservedAt: span.firstObservedAt, lastObservedAt: span.lastObservedAt,
        basis: { real: real.length, fixture: fx.length,
          evaluatedOn: needsReal ? 'real_only' : 'real_and_fixture' } };
    }
    var out = [];

    /* ALLTAGSKRITERIEN: nur echte Beobachtungen zaehlen. */
    out.push(crit('plan_unchanged',
      fullReal.length > 0 && fullList.every(function (b) {
        return b.planMutation === 'none' && b.applied === false && b.mode === MODE;
      }),
      fullReal.length === 0 ? 'keine echte Beobachtung — nicht belegt'
        : 'jede Beobachtung fuehrt planMutation none und applied false',
      fullReal));

    var vollKette = realKomplett.filter(function (b) {
      return b.stages && b.stages.c1.status === 'ok' && b.stages.c2.status === 'ok' && b.stages.s5.status === 'ok';
    });
    out.push(crit('full_chain', vollKette.length > 0,
      vollKette.length + ' echte(r) Lauf/Laeufe mit vollstaendiger Kette C1 → C2 → Stufe 5',
      vollKette));

    /* Zustandsabdeckung: gemischt erlaubt, aber die Belegart steht dabei. */
    var st = {}, stFx = {};
    komplett.forEach(function (b) {
      var f = b.coverage && b.coverage.feasibilityStatus;
      if (!f) return;
      st[f] = 1;
      if (isFixture(b)) stFx[f] = 1; else stFx[f] = stFx[f] === 1 ? 1 : 0;
    });
    out.push(crit('all_feasibility_states',
      !!(st.within_modeled_corridor && st.outside_modeled_corridor && st.insufficient_data),
      'gesehen: ' + Object.keys(st).sort().map(function (k) {
        return k + (stFx[k] === 1 ? ' (nur Fixture)' : '');
      }).join(', '),
      komplett.filter(function (b) { return b.coverage && b.coverage.feasibilityStatus; })));

    var reviewFaelle = komplett.filter(function (b) {
      return b.coverage && (b.coverage.progressionStatus === 'review' || b.coverage.hasProvisional === true)
        && b.applied === false;
    });
    out.push(crit('review_case', reviewFaelle.length > 0,
      'review-/provisorischer Fall, nachweislich nicht angewendet (Fixture zulaessig)',
      reviewFaelle));

    var ph = {};
    komplett.forEach(function (b) {
      if (!b.coverage) return;
      var fxTag = isFixture(b) ? ':fixture' : ':real';
      if (b.coverage.phase) ph[String(b.coverage.phase).toLowerCase() + fxTag] = 1;
      if (b.coverage.interruptionReason) ph[String(b.coverage.interruptionReason).toLowerCase() + fxTag] = 1;
      if (b.coverage.lowWeekReason) ph[String(b.coverage.lowWeekReason).toLowerCase() + fxTag] = 1;
    });
    function phasePresent(name) {
      return !!(ph[name + ':real'] || ph[name + ':fixture']);
    }
    out.push(crit('special_phases',
      (phasePresent('taper') || phasePresent('race_taper')) && phasePresent('deload') && phasePresent('illness'),
      'gesehen: ' + Object.keys(ph).sort().join(', ') + ' (Fixture zulaessig — Sicherheitspfade)',
      komplett.filter(function (b) {
        return b.coverage && (b.coverage.phase || b.coverage.interruptionReason || b.coverage.lowWeekReason);
      })));

    var verstoesse = komplett.filter(function (b) {
      return b.coverage && b.coverage.autoApplicable === false &&
        b.coverage.feasibilityStatus === 'within_modeled_corridor' &&
        !(b.progression && b.progression.actionable === true);
    });
    out.push(crit('no_positive_without_auto', realKomplett.length > 0 && verstoesse.length === 0,
      realKomplett.length === 0 ? 'keine echte vollstaendige Beobachtung — nicht belegt'
        : (verstoesse.length ? verstoesse.length + ' Verstoss/Verstoesse' : 'kein Verstoss'),
      realKomplett));

    var abweichungen = realKomplett.filter(function (b) { return b.deviation && b.deviation.wouldChangePlan; });
    out.push(crit('deviation_explainable',
      abweichungen.length > 0 && abweichungen.every(function (b) {
        var d = b.deviation;
        return !!(d.rationale && d.volume && d.volume.allowableRange &&
          d.volume.referenceLoad != null && d.volume.selectionReason);
      }),
      abweichungen.length + ' echte planwirksame Abweichung(en), jede mit Bezugsbasis, Korridor, Auswahlgrund und Begruendung',
      abweichungen));

    /* Reproduzierbarkeit: ueber die vollstaendigen Aufzeichnungen DERSELBEN
       Kohorte, inklusive Wiederholungen. */
    var byKey = {}, konflikte = 0;
    inCohort.forEach(function (b) {
      var k = b.idempotencyKey;
      if (!k) return;
      var fp = _hash(_stable({ p: b.progression, f: b.feasibility, d: b.deviation }));
      if (byKey[k] && byKey[k] !== fp) konflikte++;
      byKey[k] = fp;
    });
    /* Reproduzierbarkeit belegt nur, wer WIEDERHOLT wurde: Faelle sind die
       Schluessel, die mehr als einmal aufgezeichnet und dabei identisch
       geblieben sind. */
    var wiederholt = {};
    inCohort.forEach(function (b) {
      if (b.idempotencyKey) wiederholt[b.idempotencyKey] = (wiederholt[b.idempotencyKey] || 0) + 1;
    });
    var reproFaelle = realKomplett.filter(function (b) { return wiederholt[b.idempotencyKey] > 1; });
    out.push(crit('reproducible', konflikte === 0 && reproFaelle.length > 0,
      reproFaelle.length === 0 ? 'kein echter Fall wurde je wiederholt — nicht belegt'
        : (konflikte ? konflikte + ' widerspruechliche Wiederholung(en)'
          : reproFaelle.length + ' echte(r) Fall/Faelle identisch wiederholt'),
      reproFaelle));

    var met = out.filter(function (c) { return c.met; }).length;
    return {
      version: VERSION, policyVersion: POLICY_VERSION,
      cohort: cohort,
      criteria: out, met: met, total: out.length,
      accepted: met === out.length,
      open: out.filter(function (c) { return !c.met; }).map(function (c) { return c.id; }),
      observations: list.length, records: all.length,
      repeats: inCohort.length - list.length,
      excludedOtherCohort: excluded,
      excludedMissingSources: basisExcluded,
      realObservations: real.length, fixtureObservations: fx.length,
      /* Betriebsbeobachtung: Das Zeitbudget kann eine laufende Einzelstufe
         nicht unterbrechen — die partial/skipped-Quote zeigt, ob es in der
         Praxis traegt. */
      operational: (function () {
        var st2 = { ok: 0, partial: 0, failed: 0 };
        list.forEach(function (b) { if (st2[b.status] != null) st2[b.status]++; });
        return { statusCounts: st2,
          partialRate: list.length ? Math.round(st2.partial / list.length * 100) / 100 : null };
      })(),
      /* Bewusst als Auskunft, NICHT als Kriterium. */
      note: 'Verstrichene Zeit ist kein Abnahmekriterium — allein die Fallabdeckung derselben Versionskohorte entscheidet. ' +
        'Fixtures decken Sicherheitspfade; der Alltag zaehlt nur aus echten Beobachtungen.'
    };
  }

  var api = {
    VERSION: VERSION, POLICY_VERSION: POLICY_VERSION,
    MODE: MODE, PLAN_MUTATION: PLAN_MUTATION, CRITERIA: CRITERIA,
    snapshot: snapshot, observe: observe, deviationOf: deviationOf,
    cohortOf: cohortOf, currentCohort: currentCohort, COHORT_FIELDS: COHORT_FIELDS,
    REQUIRE_REAL: REQUIRE_REAL, MIN_REAL_CASES: MIN_REAL_CASES,
    caseKeyOf: caseKeyOf, uniqueByCase: uniqueByCase,
    toLogEntry: toLogEntry, acceptance: acceptance, deepFreeze: deepFreeze
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.shadowAdaptive = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
