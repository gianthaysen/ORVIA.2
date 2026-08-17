/* ============================================================
   ORVIA · plan-translator — Stufe 6a: C2-Vertrag → Änderungsvorschlag

   DER UEBERSETZER LOEST EIN UNTERBESTIMMTES PROBLEM. Viele Wochenplaene
   erreichen dieselbe Ziellast. Die Auswahlregel ist deshalb Teil des Vertrags:
   MINIMALE ABWEICHUNG VOM BEREITS AKZEPTIERTEN PLAN. Konkret:

     bestehende Einheiten erhalten
     → zulaessige Dauer anpassen
     → nur bei Frequenz-Policy Einheiten entfernen (nie erfinden, v1)
     → Intensitaetsstruktur nur im ausdruecklich betroffenen Scope aendern

   ER ERZEUGT EINEN VORSCHLAG, KEINEN PLAN. Der Eingangsplan wird nie mutiert,
   und es gibt keinen Rueckgabepfad, der einen fertigen Plan liefert — nur eine
   Liste struktureller Aenderungen plus Projektion. Materialisieren tut spaeter
   ein eigener Anwendungspfad, und JEDE Aenderung laeuft dort durch
   `week-plan-policy` (der einzige Schreiber). `requiresPolicyPass: true` steht
   deshalb an jedem Vorschlag — der Uebersetzer ist Vorstufe, nie Instanz.

   ER BEHAUPTET NICHT, DEN ZIELWERT EXAKT ZU TREFFEN. Dauern sind auf
   5-Minuten-Schritte gerundet, Skalierung ist je Einheit begrenzt, manuelle
   Einheiten sind unantastbar. Das Ergebnis traegt deshalb `achievedLoad`,
   `residualGap` und einen Status — eine Restluecke ist eine Auskunft, kein
   Fehler, und wird NICHT durch extreme Aenderungen anderer Einheiten
   kompensiert. Genau das waere der Weg, auf dem eine einzelne manuelle
   Einheit den Rest der Woche verzerrt.

   IDEMPOTENZ DURCH ABSOLUTE ZIELE. `targetLoad` ist an das stabile 28-Tage-
   Mittel gebunden (C2-Vertrag), nicht an den aktuellen Plan. Wer einen bereits
   angepassten Plan erneut uebersetzt, bekommt `no_change` — nicht noch einmal
   dieselbe Progression obendrauf.

   DIE SPERREN AUS C2 GELTEN UNVERAENDERT: `autoApplicable: false`,
   `targetLoad: null` oder `scope: null` erzeugen keinen automatisch
   anwendbaren Vorschlag. Ein fehlender Scope wirkt ausdruecklich NICHT global.

   LASTEINHEIT: `targetLoad` ist systemische Last JE BEKANNTEM TAG (C1/C2).
   Der Wochenvergleich rechnet mit targetLoad × 7 — die Umrechnung steht hier
   genau einmal und ist im Ergebnis ausgewiesen, damit niemand Tages- und
   Wochenlast verwechselt.

   Kein DOM, keine Uhr, kein Zufall, kein Storage.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'plan-translator@2';
  var POLICY_VERSION = 'pt-policy@1';

  function _req(n) { if (typeof require !== 'function') return null; try { return require(n); } catch (e) { return null; } }
  var LH = O.loadHistory || _req('./load-history.js');
  var LP = O.loadProfile || _req('./load-profile.js');

  /* Skalierungsgrenzen JE EINHEIT [A]: Eine Einheit, die um mehr als ein
     Viertel gekuerzt oder ein Viertel verlaengert werden muesste, ist nicht
     mehr „dieselbe Einheit, angepasst" — dann ist die Restluecke die ehrliche
     Antwort. Rundung auf 5 Minuten: Ein Plan mit „47 Minuten" behauptet eine
     Praezision, die das Lastmodell nicht hergibt. */
  var LIMITS = {
    minFactor: 0.75, maxFactor: 1.25,
    roundMin: 5, minUnitMin: 20,
    tolerancePct: 3,          /* Restluecke unterhalb: Ziel gilt als getroffen [A] */
    daysPerWeek: 7
  };
  /* Domaenen-Zuordnung fuer den Scope: `highIntensity` umfasst die Reize, die
     C1 auch als solche zaehlt. Muss zur intensityOf-Taxonomie passen. */
  var DOMAIN_INTENSITY = {
    highIntensity: ['interval', 'race', 'tempo'],
    endurance: ['long', 'easy', 'moderate', 'recovery'],
    strength: ['strength']
  };

  function _r1(x) { return x == null ? null : Math.round(x * 10) / 10; }
  function _r2(x) { return x == null ? null : Math.round(x * 100) / 100; }

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

  /* ---- Scope-Zuordnung: strukturiert, nie per String-Splitting ---- */
  function scopeMatch(unitInfo, scope) {
    if (!scope) return false;                 /* kein Scope ⇒ NICHTS ist betroffen */
    if (scope.all === true) return true;
    if (scope.sport && unitInfo.sportId !== scope.sport) return false;
    if (scope.domain) {
      var list = DOMAIN_INTENSITY[scope.domain] || null;
      if (!list) return false;                /* unbekannte Domaene: fail-closed */
      return list.indexOf(unitInfo.intensity) >= 0;
    }
    return true;
  }

  /* ============================================================
     DER ANKER HAT EINEN LEBENSZYKLUS

     `baseMin` darf nicht fuer immer an der ersten akzeptierten Dauer haengen.
     Aendert der Nutzer eine Einheit bewusst von 50 auf 70 Minuten oder wird
     ein neuer Plan akzeptiert, ist 70 die neue Basis — sonst zoege die
     Ratschenklemme, die maschinelles Wegdriften verhindert, eine ECHTE
     Nutzerentscheidung zurueck. Das waere derselbe Fehler mit umgekehrtem
     Vorzeichen.

     Der Stempel traegt deshalb seine Herkunft (basePlanId, basePlanRevision,
     baseSource) und gilt NUR, wenn sie zur aktuellen Uebersetzung passt:

       erneute Uebersetzung derselben Planrevision  -> baseMin behalten
       neue Revision / neuer Plan / Nutzeraenderung -> Anker = aktuelle Dauer

     Ein Stempel fremder Herkunft wird nicht „korrigiert", sondern ignoriert —
     die aktuelle Dauer IST dann die akzeptierte. Neu verankert wird beim
     naechsten preview()-Stempel mit der neuen Herkunft.
     ============================================================ */
  function _stampValid(raw, planId, planRevision) {
    if (!(raw.baseMin > 0)) return false;
    /* Nur ein Stempel aus einem akzeptierten Plan zaehlt. `user_edit` oder
       fehlende Herkunft heisst: Der Nutzer hat entschieden — Anker ist die
       aktuelle Dauer. */
    if (raw.baseSource !== 'accepted_plan') return false;
    if (raw.basePlanId != null || planId != null) {
      if (raw.basePlanId !== (planId != null ? planId : null)) return false;
    }
    if (raw.basePlanRevision != null || planRevision != null) {
      if (raw.basePlanRevision !== (planRevision != null ? planRevision : null)) return false;
    }
    return true;
  }

  /* ---- Eine Planeinheit lesen: Last, Intensitaet, Uebersetzbarkeit ---- */
  function _unitInfo(u, dayIdx, unitIdx, manualIds, planId, planRevision) {
    var raw = u || {};
    var manual = raw.manual === true ||
      (manualIds && raw.id != null && manualIds.indexOf(raw.id) >= 0);
    var load = LH && LH.loadOf ? LH.loadOf(raw) : { ok: false, reason: 'no_load_module', systemic: 0 };
    return {
      id: raw.id != null ? raw.id : ('idx:' + dayIdx + ':' + unitIdx),
      dayIdx: dayIdx, unitIdx: unitIdx,
      t: raw.t || null, l: raw.l || null,
      durationMin: load.ok ? load.durationMin : (raw.durationMin > 0 ? raw.durationMin : null),
      /* DIE AKZEPTIERTE DAUER. Der Klemm-Bereich ist an SIE gebunden, nicht an
         die aktuelle Dauer — sonst holt sich jede erneute Uebersetzung ein
         weiteres Viertel (50 -> 65 -> 80 -> ...): eine Ratsche, keine
         Uebersetzung. `preview()` stempelt sie beim ersten Anpassen. */
      baseMin: _stampValid(raw, planId, planRevision) ? raw.baseMin
        : (load.ok ? load.durationMin : (raw.durationMin > 0 ? raw.durationMin : null)),
      sportId: load.sportId || (LP && LP.sportIdOf ? LP.sportIdOf(raw) : null),
      intensity: load.intensity || (LP && LP.intensityOf ? LP.intensityOf(raw) : null),
      systemic: load.ok ? load.systemic : null,
      translatable: !!load.ok,
      untranslatableReason: load.ok ? null : load.reason,
      manual: manual
    };
  }

  /* ============================================================
     HAUPTFUNKTION
     ============================================================ */
  function translate(input) {
    var i = input || {};
    var plan = Array.isArray(i.plan) ? i.plan : null;
    var prog = i.progression || null;
    var blocked = [];
    var notes = [];

    function out(status, extra) {
      var e = extra || {};
      var o = {
        status: status, version: VERSION, policyVersion: POLICY_VERSION,
        autoApplicable: !!e.autoApplicable,
        blocked: blocked,
        changes: e.changes || [],
        removals: e.removals || [],
        intensityChanges: e.intensityChanges || [],
        untranslatable: e.untranslatable || [],
        projection: e.projection || null,
        loadUnit: 'systemic_per_known_day',
        weeklyFactor: LIMITS.daysPerWeek,
        limits: { minFactor: LIMITS.minFactor, maxFactor: LIMITS.maxFactor,
          roundMin: LIMITS.roundMin, tolerancePct: LIMITS.tolerancePct },
        refs: {
          progressionVersion: prog ? (prog.version || null) : null,
          progressionPolicyVersion: prog ? (prog.policyVersion || null) : null,
          selectionReason: prog ? (prog.selectionReason || null) : null,
          /* Die Ziellast gehoert in die Verweiskette: Zwei verschiedene
             Entscheidungen koennen nach Klemmung und Rundung dieselben
             Aenderungen ergeben — der Vorschlag muss trotzdem sagen, WESSEN
             Uebersetzung er ist. */
          targetLoad: prog && prog.targetLoad != null ? prog.targetLoad : null,
          allowableRange: prog ? (prog.allowableRange || null) : null,
          referenceLoad: prog && prog.referenceLoad != null ? prog.referenceLoad : null,
          snapshotHash: i.snapshotHash || null,
          weekId: i.weekId || null, planId: i.planId || null,
          planRevision: i.planRevision != null ? i.planRevision : null
        },
        requiresPolicyPass: true,
        notes: notes
      };
      o.proposalHash = _hash(_stable({ s: o.status, c: o.changes, r: o.removals,
        ic: o.intensityChanges, refs: o.refs, v: VERSION, pv: POLICY_VERSION }));
      return o;
    }

    /* ---- 1. SPERREN — vor jeder Rechnung ---- */
    if (!plan || plan.length !== 7) { blocked.push('no_plan'); return out('blocked'); }
    if (!prog) { blocked.push('no_progression'); return out('blocked'); }
    if (prog.targetLoad == null) {
      blocked.push(prog.provisionalTargetLoad != null ? 'provisional_only' : 'no_target_load');
      notes.push('Ein provisorischer Wert ist eine Sicherheitsgroesse, keine Vorgabe — er wird nie uebersetzt.');
      return out('blocked');
    }
    var dp = prog.dimensionPolicy || null;
    var scope = dp ? dp.scope : null;
    if (!scope) {
      blocked.push('scope_unknown');
      notes.push('Ohne Scope wirkt nichts — ein unbekannter Geltungsbereich ist nie „global".');
      return out('blocked');
    }
    /* `autoApplicable: false` sperrt die AUTOMATISCHE Anwendung, nicht die
       Rechnung: Der Vorschlag entsteht (er ist die Grundlage der sichtbaren
       Erklaerung), traegt aber autoApplicable:false. */
    var auto = prog.autoApplicable === true;
    if (!auto) blocked.push('not_auto_applicable');

    /* ---- 2. DEN PLAN LESEN ---- */
    var infos = [], untranslatable = [];
    plan.forEach(function (day, d) {
      (Array.isArray(day) ? day : []).forEach(function (u, k) {
        var info = _unitInfo(u, d, k, i.manualIds || null,
          i.planId != null ? i.planId : null, i.planRevision != null ? i.planRevision : null);
        infos.push(info);
        if (!info.translatable) untranslatable.push({ id: info.id, dayIdx: d,
          reason: info.untranslatableReason, l: info.l });
      });
    });

    /* Drei Klassen mit drei Rollen:
         scalable   — in Scope, nicht manuell, uebersetzbar ⇒ DARF sich aendern
         fixed      — manuell oder ausserhalb des Scopes    ⇒ bleibt, zaehlt mit
         unknown    — Last nicht bestimmbar                 ⇒ bleibt, zaehlt NICHT
       `unknown` mitzuzaehlen hiesse eine erfundene Zahl addieren; sie
       wegzulassen macht die Projektion UNVOLLSTAENDIG — deshalb wird genau
       das ausgewiesen statt versteckt. */
    var scalable = infos.filter(function (x) { return x.translatable && !x.manual && scopeMatch(x, scope); });
    var fixed = infos.filter(function (x) { return x.translatable && (x.manual || !scopeMatch(x, scope)); });

    var scalableLoad = scalable.reduce(function (s, x) { return s + x.systemic; }, 0);
    var fixedLoad = fixed.reduce(function (s, x) { return s + x.systemic; }, 0);
    var currentWeekly = _r2(scalableLoad + fixedLoad);
    var projectionComplete = untranslatable.length === 0;

    var targetWeekly = _r2(prog.targetLoad * LIMITS.daysPerWeek);

    /* ---- 3. VOLUMEN: ein Faktor, je Einheit an der AKZEPTIERTEN Dauer
       begrenzt. Der rohe Faktor sagt, was das Ziel verlangt; die Klemme je
       Einheit sagt, was „dieselbe Einheit, angepasst" noch bedeutet. Beides
       wird getrennt gefuehrt, damit die Projektion begruenden kann, WARUM
       eine Luecke bleibt. ---- */
    var need = targetWeekly - fixedLoad;      /* was die skalierbaren tragen muessen */
    var rawFactor = null, anyClamped = false, changes = [];
    /* Ein Plan, der bereits angepasste Einheiten traegt (baseMin != Dauer),
       ist keine Erstuebersetzung mehr — strukturelle Eingriffe (Entfernen)
       finden dann nicht noch einmal statt. */
    var alreadyAdjusted = infos.some(function (x) {
      return x.baseMin != null && x.durationMin != null &&
        Math.round(x.baseMin) !== Math.round(x.durationMin);
    });
    if (scalable.length && scalableLoad > 0) {
      rawFactor = need / scalableLoad;
      scalable.forEach(function (x) {
        var lo = Math.max(LIMITS.minUnitMin, x.baseMin * LIMITS.minFactor);
        var hi = x.baseMin * LIMITS.maxFactor;
        var desired = Math.max(lo, Math.min(hi, x.durationMin * rawFactor));
        var toMin = Math.round(desired / LIMITS.roundMin) * LIMITS.roundMin;
        /* Die Rundung darf die Klemme nicht aushebeln — sonst waere 62.5 zu 65
           gerundet der Fuss in der Tuer fuer die naechste Runde. */
        if (toMin > hi) toMin -= LIMITS.roundMin;
        if (toMin < lo) toMin += LIMITS.roundMin;
        toMin = Math.max(LIMITS.roundMin, toMin);
        if (desired !== x.durationMin * rawFactor) anyClamped = true;
        if (toMin !== Math.round(x.durationMin)) {
          changes.push({ type: 'scale_duration', unitId: x.id, dayIdx: x.dayIdx,
            l: x.l, dimension: 'volume',
            fromMin: _r1(x.durationMin), toMin: toMin, baseMin: _r1(x.baseMin),
            scope: { key: scope.key, domain: scope.domain, sport: scope.sport, all: scope.all === true } });
        }
      });
      if (rawFactor < LIMITS.minFactor - 1e-9 || rawFactor > LIMITS.maxFactor + 1e-9) {
        notes.push('Der noetige Faktor ' + _r2(rawFactor) + ' liegt ausserhalb von [' + LIMITS.minFactor +
          ', ' + LIMITS.maxFactor + '] je Einheit (bezogen auf die akzeptierte Dauer) — gedeckelt. ' +
          'Die Restluecke steht in der Projektion, sie wird nicht durch extreme Aenderungen erzwungen.');
      }
    } else if (need > 0 && !scalable.length) {
      notes.push('Keine skalierbare Einheit im Geltungsbereich — das Volumen laesst sich nicht anpassen.');
    }

    /* Projektion NACH Skalierung: Last skaliert linear mit der Dauer
       (loadOf = Dauer × systemisches Gewicht), die Rundung macht den Rest. */
    var achievedScalable = scalable.reduce(function (s, x) {
      var ch = null;
      for (var n = 0; n < changes.length; n++) if (changes[n].unitId === x.id) { ch = changes[n]; break; }
      var min = ch ? ch.toMin : x.durationMin;
      return s + x.systemic * (min / x.durationMin);
    }, 0);
    var achievedWeekly = _r2(achievedScalable + fixedLoad);

    /* ---- 4. FREQUENZ: nur wenn die Policy es DECKT und das Volumen nicht
       reicht. v1 entfernt hoechstens EINE Einheit und erfindet nie eine. ---- */
    var removals = [];
    var freq = dp.frequencyPolicy || 'maintain';
    var mayReduceFreq = /reduce/.test(freq);
    if (mayReduceFreq && !alreadyAdjusted
        && achievedWeekly > targetWeekly * (1 + LIMITS.tolerancePct / 100)
        && rawFactor != null && rawFactor < LIMITS.minFactor - 1e-9) {
      /* Kandidat: die am wenigsten intensive skalierbare Einheit — der
         kleinste Eingriff in die Struktur der Woche. Deterministisch:
         niedrigste Last, bei Gleichheit die spaetere im Plan. */
      var cand = scalable.slice().sort(function (a, b) {
        return a.systemic - b.systemic || b.dayIdx - a.dayIdx || b.unitIdx - a.unitIdx;
      })[0];
      if (cand) {
        removals.push({ type: 'remove_unit', unitId: cand.id, dayIdx: cand.dayIdx,
          l: cand.l, dimension: 'frequency', policy: freq,
          scope: { key: scope.key, domain: scope.domain, sport: scope.sport, all: scope.all === true },
          rationale: 'Volumenskalierung am Limit und weiterhin ueber dem Ziel — die Frequenz-Policy (' + freq + ') deckt eine Reduktion.' });
        var candCh = changes.filter(function (c) { return c.unitId === cand.id; })[0];
        achievedWeekly = _r2(achievedWeekly - (candCh
          ? cand.systemic * (candCh.toMin / cand.durationMin) : cand.systemic));
        changes = changes.filter(function (c) { return c.unitId !== cand.id; });
      }
    }

    /* ---- 5. INTENSITAET: eigene Dimension, eigener Scope, KEIN Prozent ---- */
    var intensityChanges = [];
    var ip = dp.intensityPolicy || 'maintain';
    if (/^reduce/.test(ip)) {
      infos.forEach(function (x) {
        if (!x.translatable || x.manual) return;
        if (!scopeMatch(x, scope)) return;
        if ((DOMAIN_INTENSITY.highIntensity).indexOf(x.intensity) < 0) return;
        intensityChanges.push({ type: 'reduce_intensity', unitId: x.id, dayIdx: x.dayIdx,
          l: x.l, dimension: 'intensity', policy: ip,
          from: x.intensity, to: 'moderate',
          scope: { key: scope.key, domain: scope.domain, sport: scope.sport, all: scope.all === true },
          rationale: 'Intensitaets-Policy „' + ip + '" im Geltungsbereich — der harte Reiz wird entschaerft, nicht gestrichen.' });
      });
    }

    /* ---- 6. PROJEKTION UND STATUS ---- */
    var residual = _r2(targetWeekly - achievedWeekly);
    var withinTol = Math.abs(residual) <= targetWeekly * LIMITS.tolerancePct / 100;
    var gapStatus = withinTol ? 'met_within_tolerance'
      : (residual > 0 ? 'under_target' : 'over_target');
    var gapReasons = [];
    if (!withinTol) {
      if (anyClamped || (rawFactor != null &&
        (rawFactor < LIMITS.minFactor - 1e-9 || rawFactor > LIMITS.maxFactor + 1e-9))) gapReasons.push('scale_clamped');
      var manualLoad = fixed.filter(function (x) { return x.manual; })
        .reduce(function (s, x) { return s + x.systemic; }, 0);
      if (manualLoad > 0) gapReasons.push('manual_units_fixed');
      if (fixedLoad - manualLoad > 0 && !(scope.all === true)) gapReasons.push('out_of_scope_units_fixed');
      if (!scalable.length) gapReasons.push('nothing_scalable_in_scope');
    }

    var projection = {
      currentWeeklyLoad: currentWeekly,
      targetWeeklyLoad: targetWeekly,
      targetPerDay: prog.targetLoad,
      achievedWeeklyLoad: achievedWeekly,
      achievedPerDay: _r2(achievedWeekly / LIMITS.daysPerWeek),
      residualGap: residual,
      gapStatus: gapStatus,
      gapReasons: gapReasons,
      scaleFactor: (scalableLoad > 0) ? _r2(achievedScalable / scalableLoad) : null,
      requestedFactor: rawFactor == null ? null : _r2(rawFactor),
      alreadyAdjusted: alreadyAdjusted,
      fixedLoad: _r2(fixedLoad),
      manualUnits: fixed.filter(function (x) { return x.manual; }).length,
      complete: projectionComplete,
      note: projectionComplete ? null
        : untranslatable.length + ' Einheit(en) ohne bestimmbare Last — die Projektion ist unvollstaendig und sagt das.'
    };

    var any = changes.length + removals.length + intensityChanges.length > 0;
    var status = any ? 'proposal' : 'no_change';
    if (!any && gapStatus !== 'met_within_tolerance') {
      notes.push('Keine zulaessige Aenderung schliesst die Luecke — der Vorschlag ist leer, die Luecke bleibt ausgewiesen.');
    }
    return out(status, {
      autoApplicable: auto && any,
      changes: changes, removals: removals, intensityChanges: intensityChanges,
      untranslatable: untranslatable, projection: projection
    });
  }

  /* Vorschau: den Vorschlag auf eine KOPIE anwenden — fuer Tests und die
     sichtbare Erklaerung. Ausdruecklich NICHT der Anwendungspfad: kein
     Policy-Lauf, keine Persistenz, und der Eingang bleibt unberuehrt. */
  function preview(plan, proposal) {
    var p = (Array.isArray(plan) ? plan : []).map(function (day) {
      return (Array.isArray(day) ? day : []).map(function (u) {
        var c = {}; Object.keys(u || {}).forEach(function (k) { c[k] = u[k]; }); return c;
      });
    });
    var pr = proposal || {};
    (pr.changes || []).forEach(function (ch) {
      var day = p[ch.dayIdx] || [];
      for (var k = 0; k < day.length; k++) {
        var id = day[k].id != null ? day[k].id : ('idx:' + ch.dayIdx + ':' + k);
        if (id === ch.unitId) {
          /* Die akzeptierte Dauer wird beim ERSTEN Anpassen unter dieser
             Herkunft gestempelt. Ein Stempel FREMDER Herkunft wird ersetzt —
             die aktuelle Dauer ist dann die neue akzeptierte Basis. */
          var refs = pr.refs || {};
          if (!_stampValid(day[k], refs.planId != null ? refs.planId : null,
              refs.planRevision != null ? refs.planRevision : null)) {
            day[k].baseMin = day[k].durationMin;
            day[k].basePlanId = refs.planId != null ? refs.planId : null;
            day[k].basePlanRevision = refs.planRevision != null ? refs.planRevision : null;
            day[k].baseSource = 'accepted_plan';
          }
          day[k].durationMin = ch.toMin;
          break;
        }
      }
    });
    (pr.removals || []).forEach(function (rm) {
      var day = p[rm.dayIdx] || [];
      for (var k = 0; k < day.length; k++) {
        var id = day[k].id != null ? day[k].id : ('idx:' + rm.dayIdx + ':' + k);
        if (id === rm.unitId) { day.splice(k, 1); break; }
      }
    });
    return p;
  }

  var api = {
    VERSION: VERSION, POLICY_VERSION: POLICY_VERSION,
    LIMITS: LIMITS, DOMAIN_INTENSITY: DOMAIN_INTENSITY,
    translate: translate, preview: preview, scopeMatch: scopeMatch, stampValid: _stampValid
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.planTranslator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
