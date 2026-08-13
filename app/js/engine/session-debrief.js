/* ============================================================
   ORVIA · session-debrief — Stufe 2 (C3) des Bauplans

   WOFÜR: Das Debrief ist die EINZIGE Quelle gelabelter Daten. Ohne es hat jede
   spätere Stufe keine Grundwahrheit: C1 kennt die Last, aber nicht, wie sie
   vertragen wurde; C2 kann progressieren, aber nicht merken, dass es zu viel
   war; eine spätere Lernschicht hätte Eingaben ohne Ergebnis. Fassung 1 des
   Bauplans hat das mit „2 Tage, Plan-Ist-Abweichung" um den Faktor zwei
   unterschätzt — das war die schwerwiegendste Fehleinschätzung des Dokuments.

   DIE BEDIENLAST IST DAS EIGENTLICHE KONSTRUKTIONSPROBLEM. Elf Felder pro
   Einheit füllt niemand über Monate aus. Und lückenhafte Selbstauskunft ist
   SCHLECHTER als keine, weil sie systematisch verzerrt: Schlechte Tage werden
   seltener geloggt, also sähe die Engine einen Athleten, der alles verträgt.
   Deshalb: genau ZWEI manuelle Eingaben im Normalfall — RPE und Schmerz ja/nein.
   Alles andere wird abgeleitet.

   `executionScore`, NICHT `sessionQuality`. Das Produkt aus Zonentreffer und
   Erfüllungsgrad misst Planerfüllung, nicht Trainingsqualität. Wer 100 % der
   Einheit exakt in der Zielzone läuft, dabei aber RPE 10 und Schmerzen meldet,
   bekäme sonst den Wert 1,0 und damit das Etikett „hochwertige Einheit". RPE und
   Schmerz bleiben GETRENNTE Größen und gehen hier nicht ein.

   DER ERWARTUNGSWERT DARF NICHT AUS DEM SESSIONNAMEN KOMMEN. „Threshold" sagt
   nichts darüber, ob 4×8 min oder 2×20 min gemeint sind; ein Long Run mit
   Endbeschleunigung ist etwas anderes als einer ohne. expectedRPE() rechnet
   deshalb aus der Prescription: Typ, Arbeitsdauer, Pausenverhältnis, Zone,
   Blockstellung.

   TOLERANZ IST KONTEXTSPEZIFISCH, NIE GLOBAL. Eine schlechte VO2-Verträglichkeit
   beim LAUFEN darf keine Rad-Intervalle einschränken — die Belastung trifft
   andere Strukturen. Gespeichert wird deshalb je {domain, sport}.

   BEKANNTE FOLGE, DIE NICHT WEGOPTIMIERT WERDEN DARF: Die Aufteilung nach
   Domäne × Sportart macht die Zellen dünn. „≥ 2 von 3 vergleichbaren Einheiten"
   wird über Monate häufig NICHT erreicht, und `unknown` ist der Normalzustand.
   Das ist korrektes Verhalten. Die Schwelle darf nicht gelockert werden, um
   häufiger eine Aussage zu bekommen — ausbleibende Belastungssignale sind kein
   Beleg für gute Verträglichkeit.

   OHNE PLAN-REFERENZ KEIN URTEIL. Eine freie Einheit ist nicht „falsch".
   OHNE ZONEN NUR BESCHREIBUNG, KEINE BEWERTUNG.

   Kein DOM, keine Uhr, kein Zufall, kein Storage. `today` kommt herein.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'session-debrief@3';

  var EV = O.evidence || (typeof require === 'function' ? (function () {
    try { return require('./evidence.js'); } catch (e) { return null; } })() : null);

  /* ---- Sessiontypen ----
     Der Schlüssel, unter dem alles Weitere hängt. Aus Label und Zone abgeleitet,
     damit die bestehenden Einheiten ohne Umbau mitspielen. */
  var TYPES = ['recovery', 'easy', 'long', 'tempo', 'threshold', 'vo2', 'anaerobic', 'race', 'strength', 'unknown'];

  function _typeFromText(s) {
    if (!s) return null;
    if (/wettkampf|race|rennen/.test(s)) return 'race';
    if (/interval|vo2|iv\b/.test(s)) return 'vo2';
    if (/anaerob|sprint/.test(s)) return 'anaerobic';
    if (/schwelle|threshold|thr\b/.test(s)) return 'threshold';
    if (/tempo/.test(s)) return 'tempo';
    if (/long|lr\b|lang/.test(s)) return 'long';
    if (/regen|recovery|rekom/.test(s)) return 'recovery';
    if (/easy|locker|z2|ez\b|grundlage/.test(s)) return 'easy';
    return null;
  }
  /* REIHENFOLGE IST VERTRAG (v8-307, Gians Live-Test-Befund): expliziter
     Typ -> Einheitenlabel -> Detail-/Dauertext. Der alte Code nahm den
     ERSTEN WAHREN Text (type || d || l) und matchte NUR ihn: bei
     {l:'Intervalle', d:'40 min'} wurde '40 min' gelesen, kein Muster traf,
     die Einheit wurde 'unknown' — falsche Erwartung (4.8 statt
     Intervallwert), falsche Domaenen. Betroffen war JEDE Einheit, deren
     d-Feld ein reiner Dauertext ist — also der Normalfall des Planners.
     Jeder Kandidat wird EINZELN geprueft; erst wenn er nichts hergibt,
     faellt die Bestimmung zum naechsten durch. */
  function typeOf(unit) {
    var u = unit || {};
    if (u.type && TYPES.indexOf(u.type) >= 0) return u.type;
    if (String(u.t || '').toLowerCase() === 'gym') return 'strength';
    return _typeFromText(String(u.type || '').toLowerCase())
        || _typeFromText(String(u.l || '').toLowerCase())
        || _typeFromText(String(u.d || '').toLowerCase())
        || 'unknown';
  }

  /* ---- Domänen ----
     Eine Einheit belastet mehrere Systeme gleichzeitig. Genau deshalb wird
     Toleranz je Domäne geführt: Wer harte Intervalle schlecht verträgt, kann
     langes lockeres Laufen problemlos vertragen — und umgekehrt. */
  var DOMAINS = ['systemic', 'impact', 'highIntensity', 'volume'];

  function domainsOf(unit, prescription) {
    var t = typeOf(unit), p = prescription || {};
    var out = ['systemic'];
    if (t === 'vo2' || t === 'threshold' || t === 'tempo' || t === 'anaerobic' || t === 'race') out.push('highIntensity');
    var sport = String((unit && unit.t) || '').toLowerCase();
    if (/lauf|run/.test(sport)) out.push('impact');
    var mins = p.durationMin != null ? p.durationMin : (unit && unit.durationMin) || null;
    if (t === 'long' || (mins != null && mins >= 90)) out.push('volume');
    return out;
  }

  /* ============================================================
     ERWARTETES RPE — aus der Prescription, nicht aus dem Namen
     ============================================================ */

  /* Grundwerte auf der Borg-CR10-Skala. [A] — Konvention und Erfahrungswerte,
     keine Messgrößen. Deshalb liefert expectedRPE ohne eigene Historie
     ausdrücklich evidence:'weak'. */
  var BASE_RPE = {
    recovery: 2, easy: 3, long: 5, tempo: 6, threshold: 7,
    vo2: 8.5, anaerobic: 9, race: 9.5, strength: 6, unknown: 5
  };

  /* Referenz-Arbeitsdauer je Typ in Minuten: die Dauer, bei der der Grundwert
     gilt. Länger heißt härter — 2×20 min an der Schwelle ist nicht dasselbe wie
     4×8 min, auch wenn beides „Threshold" heißt. */
  var REF_WORK_MIN = {
    recovery: 40, easy: 50, long: 90, tempo: 25, threshold: 30,
    vo2: 18, anaerobic: 8, race: 45, strength: 50, unknown: 45
  };

  function expectedRPE(p, history) {
    var i = p || {};
    var t = TYPES.indexOf(i.sessionType) >= 0 ? i.sessionType : typeOf(i);
    var base = BASE_RPE[t] != null ? BASE_RPE[t] : BASE_RPE.unknown;
    var factors = [];

    /* Arbeitsdauer: je Verdopplung gegenüber der Referenz +1 Punkt, je Halbierung
       −1. Logarithmisch, weil die Anstrengung nicht linear mit der Dauer wächst. */
    var ref = REF_WORK_MIN[t] || REF_WORK_MIN.unknown;
    var work = i.workDuration != null ? i.workDuration : i.durationMin;
    if (work > 0 && ref > 0) {
      var d = Math.log(work / ref) / Math.LN2;
      if (Math.abs(d) > 0.05) { base += d; factors.push('workDuration'); }
    }

    /* Pausenverhältnis (Arbeit : Pause). Dichtere Intervalle sind härter.
       Ohne Angabe wird NICHT angenommen, es sei dicht — keine Heuristik dort,
       wo Daten fehlen. */
    if (i.recoveryRatio > 0) {
      if (i.recoveryRatio >= 4) { base += 1; factors.push('recoveryRatio'); }
      else if (i.recoveryRatio >= 2) { base += 0.5; factors.push('recoveryRatio'); }
    }

    /* Blockstellung: gegen Ende eines Blocks liegt Ermüdung an. */
    if (i.progressionStage === 'late') { base += 0.5; factors.push('progressionStage'); }
    else if (i.progressionStage === 'early') { base -= 0.25; factors.push('progressionStage'); }

    var value = Math.max(1, Math.min(10, Math.round(base * 10) / 10));
    var evidence = 'weak';

    /* PERSONALISIERUNG: Sobald genug eigene, vergleichbare Einheiten mit RPE
       vorliegen, ersetzt der eigene Median die Tabelle — und erst dann ist der
       Erwartungswert mehr als eine Konvention. */
    var own = _comparableRPEs(history, i);
    if (own.length >= 5) {
      value = _median(own);
      evidence = 'moderate';
      factors.push('personalised(' + own.length + ')');
    }
    return { value: Math.round(value * 10) / 10, evidence: evidence, sessionType: t, factors: factors, n: own.length };
  }

  /* ---- DIE EINE PRESCRIPTION (v8-307) ----
     Vorhersage (logWeekPredictions), C3-Snapshot und Live-Test erzeugen die
     Vertragsfelder des prescriptionHash (version/expectedRpe/evidence/
     targetZone) ueber DIESE Funktion. Vorher gab es drei Erzeuger: das
     Produkt (inline in ui.js), der C3-Snapshot (hier) und eine handgebaute
     rx im Live-Test — der Live-Test lief not_comparable und verdeckte
     dabei den typeOf-Fehler. BEWUSST KEINE eigene Dauer-Parserei:
     durationMin kommt herein (die eine Quelle bleibt
     debrief-record.plannedDurationOf bzw. planned.durationMin) — ein
     zweiter Parser hier waere die naechste Divergenzstelle. */
  function prescriptionOf(unit, opts) {
    var o = opts || {};
    var u = unit || {};
    var dm = o.durationMin != null ? o.durationMin
      : (u.durationMin != null ? u.durationMin : null);
    var exp = expectedRPE(
      Object.assign({}, u, { sessionType: typeOf(u), durationMin: dm }),
      o.history || []);
    return {
      prescriptionVersion: VERSION,
      sessionType: exp.sessionType,
      plannedDurationMin: dm,
      expectedRpe: exp.value,
      expectedRpeEvidence: exp.evidence,
      expectedRpeFactors: exp.factors,
      targetZone: o.targetZone != null ? o.targetZone
        : (u.zone != null ? u.zone : null)
    };
  }

  function _median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /* ---- Vergleichbarkeit ----
     VERBINDLICHE DEFINITION: gleicher Sessiontyp, Dauer ±20 %, Zielintensität in
     derselben Zone. Ohne diese Festlegung wäre „vergleichbar" ein Gefühl und
     `tolerance` unfalsifizierbar. */
  var DURATION_TOLERANCE = 0.2;

  function comparable(a, b) {
    if (!a || !b) return false;
    var ta = TYPES.indexOf(a.sessionType) >= 0 ? a.sessionType : typeOf(a);
    var tb = TYPES.indexOf(b.sessionType) >= 0 ? b.sessionType : typeOf(b);
    if (ta !== tb) return false;
    if (String(a.sportId || a.t || '') !== String(b.sportId || b.t || '')) return false;
    var za = a.zone || null, zb = b.zone || null;
    if (za && zb && za !== zb) return false;
    var da = a.durationMin != null ? a.durationMin : a.workDuration;
    var db = b.durationMin != null ? b.durationMin : b.workDuration;
    if (da > 0 && db > 0) {
      var lo = db * (1 - DURATION_TOLERANCE), hi = db * (1 + DURATION_TOLERANCE);
      if (da < lo || da > hi) return false;
    }
    return true;
  }

  function _comparableRPEs(history, ref) {
    var out = [];
    (Array.isArray(history) ? history : []).forEach(function (h) {
      if (!h || !(h.rpe > 0)) return;
      if (comparable(h, ref)) out.push(h.rpe);
    });
    return out;
  }

  /* ============================================================
     DEBRIEF EINER EINHEIT
     ============================================================ */

  var ADHERENCE = ['im Ziel', 'zu schnell', 'zu langsam', 'abgebrochen', 'nicht vergleichbar'];

  function debrief(opts) {
    var o = opts || {};
    var planned = o.planned || null;
    var actual = o.actual || null;
    var zones = o.zones || null;

    /* OHNE PLAN-REFERENZ KEIN URTEIL. Eine freie Einheit ist nicht „falsch" —
       sie war nur nicht geplant. */
    if (!planned) {
      return _out({
        adherence: 'nicht vergleichbar', judged: false, reason: 'no_plan_reference',
        note: 'Freie Einheit — ohne geplante Vorgabe gibt es nichts zu vergleichen.',
        evidenceQuality: 'weak'
      }, o);
    }
    if (!actual) {
      return _out({ adherence: 'nicht vergleichbar', judged: false, reason: 'no_activity',
        note: 'Zur geplanten Einheit liegt keine Aktivität vor.', evidenceQuality: 'unknown' }, o);
    }

    var pMin = planned.durationMin != null ? planned.durationMin : null;
    var aMin = actual.durationMin != null ? actual.durationMin : null;
    var pKm = planned.distanceKm != null ? planned.distanceKm : null;
    var aKm = actual.distanceKm != null ? actual.distanceKm : null;

    /* Erfüllungsgrad: bevorzugt über die Distanz (robuster gegen Pausen),
       ersatzweise über die Dauer. */
    var completionPct = null;
    if (pKm > 0 && aKm != null) completionPct = Math.min(1.5, aKm / pKm);
    else if (pMin > 0 && aMin != null) completionPct = Math.min(1.5, aMin / pMin);

    var completed = completionPct != null ? completionPct >= 0.85 : null;
    var aborted = completionPct != null && completionPct < 0.6;

    /* Zonentreffer NUR mit belastbaren Zonen. Ohne sie beschreiben wir, wir
       bewerten nicht. */
    var zoneHit = null, deltaPace = null, target = null;
    var zonesUsable = _zonesUsable(zones);
    if (zonesUsable && planned.targetLoSecPerKm > 0 && planned.targetHiSecPerKm > 0 && actual.paceSecPerKm > 0) {
      target = { lo: planned.targetLoSecPerKm, hi: planned.targetHiSecPerKm };
      var pace = actual.paceSecPerKm;
      if (pace >= target.lo && pace <= target.hi) { zoneHit = 1; deltaPace = 0; }
      else if (pace < target.lo) { deltaPace = pace - target.lo; zoneHit = _falloff(target.lo - pace, target.hi - target.lo); }
      else { deltaPace = pace - target.hi; zoneHit = _falloff(pace - target.hi, target.hi - target.lo); }
    }

    var deltaDuration = (pMin > 0 && aMin != null) ? Math.round((aMin - pMin) * 10) / 10 : null;

    /* executionScore = Planerfüllung. NICHT Qualität — RPE und Schmerz gehen
       ausdrücklich nicht ein (siehe Kopf). */
    var executionScore = null;
    if (zoneHit != null && completionPct != null) executionScore = Math.round(zoneHit * Math.min(1, completionPct) * 100) / 100;
    else if (completionPct != null) executionScore = Math.round(Math.min(1, completionPct) * 100) / 100;

    var adherence;
    if (aborted) adherence = 'abgebrochen';
    else if (zoneHit == null) adherence = 'nicht vergleichbar';
    else if (zoneHit >= 0.95) adherence = 'im Ziel';
    else if (deltaPace < 0) adherence = 'zu schnell';
    else adherence = 'zu langsam';

    /* ---- Adaptationsbelege ---- */
    /* Die Vertragsfelder kommen aus DERSELBEN Funktion wie die Vorhersage —
       sonst koennen prediction.prescriptionHash und Snapshot-Hash nie
       zusammenfinden (v8-307). */
    var rx = prescriptionOf(planned, { durationMin: pMin,
      targetZone: planned.zone || null, history: o.history });
    var exp = { value: rx.expectedRpe, evidence: rx.expectedRpeEvidence,
      sessionType: rx.sessionType, factors: rx.expectedRpeFactors };
    var rpe = o.rpe != null ? Number(o.rpe) : null;
    var deltaRpe = (rpe != null && exp.value != null) ? Math.round((rpe - exp.value) * 10) / 10 : null;

    var constraintSignal = null;
    if (o.painDuring || o.painAfter) {
      constraintSignal = {
        region: o.painRegion || null,
        severity: o.painSeverity != null ? o.painSeverity : 1,
        when: o.painDuring ? 'during' : 'after',
        trend: null
      };
    }

    /* Progressionssignal: Wie viel Luft war da? Nur mit RPE beurteilbar. */
    var progressionSignal = 'unknown';
    if (deltaRpe != null && !aborted) {
      if (deltaRpe <= -1) progressionSignal = 'headroom';
      else if (deltaRpe >= 2) progressionSignal = 'over';
      else progressionSignal = 'at_limit';
    }

    /* Einzelurteil zur Verträglichkeit — NUR als Signal dieser einen Einheit.
       Die Aussage über den Athleten entsteht erst in toleranceFrom() über
       mehrere vergleichbare Einheiten. */
    var toleranceSignal = 'unknown';
    if (deltaRpe != null) {
      var equalOrLower = (zoneHit == null) || (deltaPace == null) || (deltaPace >= 0);
      if (deltaRpe >= 2 && equalOrLower) toleranceSignal = 'poor';
      else if (deltaRpe >= 1) toleranceSignal = 'borderline';
      else toleranceSignal = 'good';
    }

    var evidenceQuality = EV ? EV.weakest([
      zonesUsable ? 'moderate' : 'weak',
      rpe != null ? 'moderate' : 'weak',
      exp.evidence
    ]) : 'weak';

    /* SNAPSHOT DER DAMALS SICHTBAREN VORGABE.
       Dass beim Oeffnen die letzte Renderaufloesung verwendet wird, verhindert
       den Fehler im MOMENT der Eingabe. Er verhindert ihn NICHT bei spaeterer
       Neuberechnung: Ein Resolver-Lauf in sechs Monaten haette sonst historische
       Debriefs gegen dann gueltige Zonen umgedeutet — aus „im Ziel" wuerde
       rueckwirkend „zu langsam", und die Grundwahrheit waere keine mehr.
       Deshalb wird alles Entscheidungsrelevante hier eingefroren und vom
       Aufrufer VERBATIM persistiert. */
    var snapshot = Object.assign({}, rx, {
      targetLoSecPerKm: target ? target.lo : null,
      targetHiSecPerKm: target ? target.hi : null,
      plannedDistanceKm: pKm,
      zoneEvidence: zones ? (zones.confidence || 'unknown') : 'unknown',
      zoneFreshness: zones ? (zones.freshness || null) : null,
      zoneAgeRatio: zones ? (zones.ageRatio == null ? null : zones.ageRatio) : null,
      zoneUsability: _zoneUsability(zones),
      zoneReference: (zones && zones.reference) ? {
        distanceKm: zones.reference.distanceKm, durationMin: zones.reference.durationMin,
        date: zones.reference.date, source: zones.reference.source } : null
    });

    return _out({
      adherence: adherence, judged: true, snapshot: snapshot,
      completed: completed, completionPct: completionPct == null ? null : Math.round(completionPct * 100) / 100,
      zoneHit: zoneHit == null ? null : Math.round(zoneHit * 100) / 100,
      deltaPace: deltaPace == null ? null : Math.round(deltaPace),
      deltaDuration: deltaDuration,
      executionScore: executionScore,
      rpe: rpe, expectedRpe: exp.value, deltaRpe: deltaRpe,
      expectedRpeEvidence: exp.evidence,
      note: _note(adherence, zonesUsable, target, actual, deltaDuration),
      adaptationEvidence: {
        tolerance: toleranceSignal,
        constraintSignal: constraintSignal,
        progressionSignal: progressionSignal,
        evidenceQuality: evidenceQuality
      },
      domains: domainsOf(planned, planned),
      sessionType: typeOf(planned),
      evidenceQuality: evidenceQuality
    }, o);
  }

  function _falloff(offSec, widthSec) {
    var w = widthSec > 0 ? widthSec : 30;
    return Math.max(0, Math.round((1 - offSec / (w * 2)) * 100) / 100);
  }

  /* Zonen sind nur dann Bewertungsgrundlage, wenn sie den Plan auch steuern
     dürfen — „hat Beleg" ist nicht „darf steuern" (evidence.usability). Sonst
     bewertete die App eine Einheit gegen eine Vorgabe, die aus einem zwanzig
     Jahre alten Wettkampf stammt. */
  function _zoneUsability(zones) {
    if (!zones || zones.ok !== true) return 'unavailable';
    if (!EV) return 'unknown';
    return EV.usability({ evidence: zones.confidence, ageRatio: zones.ageRatio }).usability;
  }
  function _zonesUsable(zones) {
    return _zoneUsability(zones) === 'decision_eligible';
  }

  function _note(adherence, zonesUsable, target, actual, deltaDuration) {
    if (!zonesUsable) {
      return 'Ohne belastbare Zonen wird die Einheit beschrieben, nicht bewertet.';
    }
    if (!target) return 'Keine Pace-Vorgabe hinterlegt — kein Zonenurteil möglich.';
    var f = function (s) { var m = Math.floor(s / 60), r = Math.round(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; };
    var txt = 'geplant ' + f(target.lo) + '–' + f(target.hi) + '/km · gelaufen ' + f(actual.paceSecPerKm) + '/km — ' + adherence;
    if (deltaDuration != null && Math.abs(deltaDuration) >= 5) {
      txt += ' (' + (deltaDuration > 0 ? '+' : '') + Math.round(deltaDuration) + ' min)';
    }
    return txt;
  }

  function _out(o, ctx) {
    o.version = VERSION;
    o.at = (ctx && ctx.today) || null;
    return o;
  }

  /* ============================================================
     TOLERANZ ÜBER MEHRERE EINHEITEN — kontextspezifisch
     ============================================================ */

  var MIN_COMPARABLE = 3;
  var NEEDED_POOR = 2;
  var RPE_THRESHOLD = 2;

  /* Liefert die Verträglichkeit für GENAU eine Zelle {domain, sport}.
     Weniger als MIN_COMPARABLE vergleichbare Einheiten ⇒ 'unknown'. NICHT
     'good': Ausbleibende Belastungssignale sind kein Beleg für gute
     Verträglichkeit. */
  function toleranceFor(debriefs, cell) {
    var c = cell || {};
    var domain = c.domain, sport = c.sport;
    var rel = (Array.isArray(debriefs) ? debriefs : []).filter(function (d) {
      if (!d || !d.judged) return false;
      if (sport && String(d.sportId || '') !== String(sport)) return false;
      if (domain && (d.domains || []).indexOf(domain) < 0) return false;
      return d.deltaRpe != null;
    });

    if (rel.length < MIN_COMPARABLE) {
      return { domain: domain || null, sport: sport || null, status: 'unknown',
        evidence: 'unknown', actionable: false, n: rel.length, reason: 'insufficient_comparable' };
    }

    var recent = rel.slice(-MIN_COMPARABLE);
    var bad = recent.filter(function (d) {
      var equalOrLower = (d.deltaPace == null) || (d.deltaPace >= 0);
      return d.deltaRpe >= RPE_THRESHOLD && equalOrLower;
    }).length;

    var status = bad >= NEEDED_POOR ? 'poor'
      : recent.filter(function (d) { return d.deltaRpe >= 1; }).length >= NEEDED_POOR ? 'borderline'
        : 'good';

    /* Der Beleg kann nie besser sein als der schwächste Bestandteil — und wenn
       der Erwartungswert selbst nur aus einer Tabelle stammt, ist die Aussage
       schwach. Genau deshalb darf ein 'weak'-Erwartungswert zwar melden, aber
       (per Bauplan) die Progression noch nicht bremsen. */
    var parts = recent.map(function (d) { return d.expectedRpeEvidence || 'weak'; });
    var evidence = EV ? EV.weakest(parts.concat(rel.length >= 6 ? ['moderate'] : ['weak'])) : 'weak';

    /* `actionable` schliesst die Luecke zwischen Beobachtung und Handlung.
       Ohne dieses Feld koennte ein Konsument auf status==='poor' reagieren und
       dabei den Evidenzvertrag umgehen — ein `poor` aus einem Tabellen-
       Erwartungswert ist eine Beobachtung, keine Handlungsgrundlage. */
    var actionable = status !== 'unknown' && !!EV && EV.rank(evidence) >= EV.rank('moderate');
    return { domain: domain || null, sport: sport || null, status: status,
      evidence: evidence, actionable: actionable,
      n: rel.length, considered: recent.length, flagged: bad };
  }

  /* Alle Zellen auf einmal, plus eine systemische Gesamtaussage.
     Die Gesamtaussage aggregiert über die Zellen, aber ausdrücklich mit
     NIEDRIGEREM Evidenzgrad — sie mischt Belastungen, die verschiedene
     Strukturen treffen. */
  function toleranceState(debriefs, opts) {
    var o = opts || {};
    var sports = o.sports || _sportsIn(debriefs);
    var out = { cells: [], bySport: {}, systemic: null, version: VERSION };

    sports.forEach(function (sp) {
      out.bySport[sp] = {};
      DOMAINS.forEach(function (dm) {
        var t = toleranceFor(debriefs, { domain: dm, sport: sp });
        out.cells.push(t);
        out.bySport[sp][dm] = t;
      });
    });

    var known = out.cells.filter(function (c) { return c.status !== 'unknown'; });
    if (!known.length) {
      out.systemic = { status: 'unknown', evidence: 'unknown', actionable: false, reason: 'no_cell_resolved' };
    } else {
      var poor = known.filter(function (c) { return c.status === 'poor'; }).length;
      var bord = known.filter(function (c) { return c.status === 'borderline'; }).length;
      out.systemic = {
        status: poor > 0 ? 'poor' : bord > 0 ? 'borderline' : 'good',
        /* Eine Stufe unter dem besten Zellenbeleg — die Aggregation über
           verschiedene Belastungsarten ist schwächer als jede Einzelzelle. */
        evidence: EV ? EV.LEVELS[Math.max(0, EV.rank(_bestEvidence(known)) - 1)] : 'weak',
        actionable: false,   /* Aggregate steuern nie — sie mischen Belastungsarten. */
        cellsResolved: known.length, cellsTotal: out.cells.length,
        note: 'Aggregiert über verschiedene Belastungsarten — schwächer als jede Einzelzelle.'
      };
    }
    return out;
  }

  function _bestEvidence(cells) {
    if (!EV) return 'weak';
    var best = 'unknown';
    cells.forEach(function (c) { if (EV.rank(c.evidence) > EV.rank(best)) best = c.evidence; });
    return best;
  }
  function _sportsIn(debriefs) {
    var seen = {}, out = [];
    (Array.isArray(debriefs) ? debriefs : []).forEach(function (d) {
      var s = d && d.sportId; if (s && !seen[s]) { seen[s] = true; out.push(s); }
    });
    return out;
  }

  /* Ein persistierter Debrief mit Snapshot ist ABGESCHLOSSEN. Konsumenten
     duerfen ihn lesen, aber nicht gegen heutige Zonen neu bewerten — sonst
     waere die Grundwahrheit eine bewegliche Groesse. */
  function isFrozen(rec) {
    return !!(rec && rec.snapshot && rec.snapshot.prescriptionVersion);
  }
  /* Liest aus einem gespeicherten Datensatz die Werte, gegen die damals
     geurteilt wurde — nie aus dem aktuellen Zustand. */
  function fromRecord(rec) {
    if (!isFrozen(rec)) return null;
    var s = rec.snapshot;
    return {
      sessionType: s.sessionType, zone: s.targetZone,
      expectedRpe: s.expectedRpe, expectedRpeEvidence: s.expectedRpeEvidence,
      zoneEvidence: s.zoneEvidence, zoneUsability: s.zoneUsability,
      prescriptionVersion: s.prescriptionVersion,
      deltaRpe: rec.deltaRpe, deltaPace: rec.deltaPace,
      adherence: rec.adherence, executionScore: rec.executionScore,
      domains: rec.domains || [], sportId: rec.sportId || null, judged: rec.judged === true
    };
  }

  var api = {
    VERSION: VERSION, TYPES: TYPES, DOMAINS: DOMAINS, ADHERENCE: ADHERENCE,
    isFrozen: isFrozen, fromRecord: fromRecord,
    BASE_RPE: BASE_RPE, REF_WORK_MIN: REF_WORK_MIN,
    MIN_COMPARABLE: MIN_COMPARABLE, RPE_THRESHOLD: RPE_THRESHOLD,
    DURATION_TOLERANCE: DURATION_TOLERANCE,
    typeOf: typeOf, domainsOf: domainsOf, comparable: comparable,
    expectedRPE: expectedRPE, prescriptionOf: prescriptionOf, debrief: debrief,
    toleranceFor: toleranceFor, toleranceState: toleranceState
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.sessionDebrief = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
