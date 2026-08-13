/* ============================================================
   ORVIA · observer-input — der EINE Eingang der Beobachtungsschicht

   WARUM ES DIESES MODUL GIBT (v8-299): Die Beobachtung (Schatten,
   Vorhersagen, Drossel) sammelte ihre Eingaenge verstreut in ui.js —
   und zweimal hintereinander stellte sich heraus, dass ein Eingang tot
   war (DB.sessionDebriefs: nie geschrieben; activitiesAll(): existiert
   nicht). Schlimmer: Die eingefrorene Abnahmekohorte kannte den
   Eingangsadapter nicht — „Debriefs endlich aus dem richtigen Speicher
   lesen" veraenderte die BEDEUTUNG jeder Beobachtung, erhoehte aber
   keine Kohortenversion. Alte fehlerhafte und neue korrigierte Belege
   trugen denselben Schluessel.

   DESHALB: EIN reines, versioniertes Modul.

     Profil + Aktivitaeten + Debriefs + Ziel + Performance
       + Planidentitaet  →  eingefrorener Observer-Snapshot + Hash

   Der Aufrufer (ui) liefert die ROHEN Quellen — dieses Modul kopiert
   tief, friert ein und hasht. Denselben Snapshot verwenden Schatten,
   Prediction UND Drossel: Was nicht im Snapshot ist, existiert fuer die
   Beobachtung nicht, und was sich im Snapshot aendert, aendert den Hash
   (die Drossel kann nichts mehr verschlucken, was hier drinsteht).

   Die VERSION dieses Moduls gehoert zur ABNAHMEKOHORTE: Ein anderer
   Eingangsadapter ist eine andere Beobachtungsbedeutung — Beobachtungen
   verschiedener Adapterversionen mischen sich nie in einer Abnahme.

   Kein DOM, keine Uhr, kein Storage, kein Netz. Fehlende Quellen werden
   AUSGEWIESEN (basis-Felder), nicht stillschweigend als leer gedeutet —
   „leer geliefert" und „nicht lieferbar" sind verschiedene Aussagen.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'observer-input@5';

  /* Riegel-Aequivalenz t2 = t1 * (d2/d1)^1.06 — dieselbe Beziehung wie im
     Performance-Resolver. Hier NACHGEBAUT statt importiert: Der Adapter darf
     kein Kohortenmodul laden (Unabhaengigkeitsvertrag), und die Formel ist
     Mathematik, kein Zustand. */
  function _riegel(fromKm, fromMin, toKm) {
    if (!(fromKm > 0) || !(fromMin > 0) || !(toKm > 0)) return null;
    return fromMin * Math.pow(toKm / fromKm, 1.06);
  }

  /* Stabile Serialisierung: Schluessel sortiert, damit derselbe Zustand
     immer denselben Hash traegt — unabhaengig von Einfuegereihenfolge. */
  function _stable(x) {
    if (x === null || typeof x !== 'object') return JSON.stringify(x);
    if (Array.isArray(x)) return '[' + x.map(_stable).join(',') + ']';
    return '{' + Object.keys(x).sort().map(function (k) {
      return JSON.stringify(k) + ':' + _stable(x[k]);
    }).join(',') + '}';
  }
  function _hash(s) {
    var h = 0x811c9dc5, i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function _copy(x) {
    if (x === undefined) return null;
    try { return JSON.parse(JSON.stringify(x)); } catch (e) { return null; }
  }
  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }

  /* raw = { userId, today, weekId, currentPlan, planIdentity,
             activities, debriefs, sports, goal, level,
             currentPerformance, availability }
     Jede Quelle darf fehlen (undefined) — dann steht das im basis-Feld.
     null/[] gelten als GELIEFERT (bewusst leer). */
  function build(raw) {
    var r = raw || {};
    function basisOf(v) { return v === undefined ? 'unavailable' : 'provided'; }
    var snap = {
      v: 1, version: VERSION,
      userId: r.userId != null ? r.userId : null,
      today: r.today != null ? r.today : null,
      weekId: r.weekId != null ? r.weekId : null,
      currentPlan: _copy(r.currentPlan),
      planIdentity: {
        planId: (r.planIdentity && r.planIdentity.planId != null) ? r.planIdentity.planId : null,
        planRevision: (r.planIdentity && r.planIdentity.planRevision != null) ? r.planIdentity.planRevision : null,
        basis: (r.planIdentity && r.planIdentity.basis) || 'none'
      },
      activities: _copy(r.activities) || [],
      debriefs: _copy(r.debriefs) || [],
      sports: _copy(r.sports),
      goal: _copy(r.goal),
      level: r.level != null ? r.level : null,
      currentPerformance: _copy(r.currentPerformance),
      availability: _copy(r.availability),
      /* STEUERFELDER (@2): C2 sieht Krankheit/Entlastung nur, wenn sie hier
         stehen; Stufe 5 sieht das Zieldatum nur, wenn es hier steht. */
      targetDate: r.targetDate != null ? r.targetDate
        : ((r.goal && r.goal.raceDate) ? r.goal.raceDate : null),
      phase: r.phase != null ? r.phase : null,
      lowWeekReason: r.lowWeekReason != null ? r.lowWeekReason : null,
      interruption: _copy(r.interruption),
      weeksLeft: r.weeksLeft != null ? r.weeksLeft : null,
      /* @3: ROHE Check-in-Serie (date, ill true/false/null, redFlags) und
         Profilbeschwerden — die Ableitungen unten sind der Vertrag. */
      checkins: _copy(r.checkins) || [],
      profileConstraints: _copy(r.profileConstraints) || [],
      /* HERKUNFTSAUSWEIS: unterscheidet „bewusst leer" von „Quelle fehlt".
         Eine Beobachtung mit activitiesBasis:'unavailable' belegt weniger —
         und die Abnahme kann das sehen, statt leere Listen zu glauben. */
      basis: {
        activities: basisOf(r.activities),
        debriefs: basisOf(r.debriefs),
        goal: basisOf(r.goal),
        performance: basisOf(r.currentPerformance),
        sports: basisOf(r.sports),
        availability: basisOf(r.availability),
        interruption: basisOf(r.interruption),
        checkins: basisOf(r.checkins),
        profileConstraints: basisOf(r.profileConstraints)
      }
    };
    /* ============================================================
       ABGELEITETE STUFE-5-FORMEN (@2) — DER P0 DIESER VERSION:
       goalOf() liefert targetMin/raceDate, der Resolver ein
       sportuebergreifendes {sports:{...}} — Goal Feasibility erwartet
       goal.targetValue/metricType und EINEN Leistungswert
       {value, metric, evidence, ageRatio}. Ohne diese Uebersetzung war
       JEDE Produktbewertung insufficient_data/current_performance.
       Die Uebersetzung ist BEHAVIOR und lebt deshalb HIER, im
       versionierten, kohortengebundenen Adapter — nicht verstreut in ui.

       Beide Seiten derselben Vergleichung tragen dieselbe Metrik:
       Rennzeit ueber goal.distanceKm in Minuten ('time', kleiner=besser).
       Der Ist-Wert entsteht per Riegel aus der Referenzleistung des
       Running-Resolvers; Evidenz/Alter kommen unveraendert mit — die
       Entscheidungsfaehigkeit beurteilt weiterhin evidence.js in Stufe 5,
       nicht dieser Adapter. */
    var g = snap.goal;
    snap.derived = { v: 1 };
    snap.derived.feasibilityGoal = (g && g.targetMin > 0) ? {
      targetValue: g.targetMin, metricType: 'time', direction: 'lower',
      distanceKm: g.distanceKm != null ? g.distanceKm : null,
      basis: 'goal_targetMin'
    } : null;
    snap.derived.feasibilityPerformance = (function () {
      try {
        var run = snap.currentPerformance && snap.currentPerformance.sports &&
          snap.currentPerformance.sports.running;
        if (!run || run.ok !== true) return null;
        var ref = run.reference || null;
        var distKm = g && g.distanceKm > 0 ? g.distanceKm : null;
        var val = null, valBasis = null;
        if (ref && ref.distanceKm > 0 && ref.durationMin > 0 && distKm) {
          val = _riegel(ref.distanceKm, ref.durationMin, distKm);
          valBasis = 'riegel_from_reference';
        } else if (distKm === 21.0975 && run.halfMarathonEquivalentMin > 0) {
          val = run.halfMarathonEquivalentMin; valBasis = 'hm_equivalent';
        }
        if (!(val > 0)) return null;
        /* EVIDENZ ERBT NICHT UEBER DISTANZEN (@3): Eine starke 5-km-Messung
           macht die daraus extrapolierte Marathonleistung nicht stark. Bei
           gleicher Distanz bleibt die Quellenevidenz; sonst Deckel auf
           moderate, bei grosser Distanzdifferenz auf weak — plus
           UNSICHERHEITSBAND aus der Exponentenspanne des Riegel-Modells
           (1.04–1.08), damit „Ziel bereits erreicht" gegen die konservative
           Bandkante geprueft werden kann statt gegen den Punktwert. */
        var order = { unknown: 0, weak: 1, moderate: 2, strong: 3 };
        var names = ['unknown', 'weak', 'moderate', 'strong'];
        var ev = run.confidence || 'unknown';
        var ratio = null, band = null, modelBasis = 'same_distance';
        if (ref && ref.distanceKm > 0 && distKm) {
          ratio = Math.max(distKm / ref.distanceKm, ref.distanceKm / distKm);
          ratio = Math.round(ratio * 100) / 100;
        }
        if (ratio != null && ratio > 1.05) {
          modelBasis = 'riegel_extrapolation';
          var cap = ratio > 2.5 ? 1 : 2;            /* weak bzw. moderate */
          ev = names[Math.min(order[ev] != null ? order[ev] : 0, cap)];
          var lo = ref.durationMin * Math.pow(distKm / ref.distanceKm, 1.04);
          var hi = ref.durationMin * Math.pow(distKm / ref.distanceKm, 1.08);
          band = { min: Math.round(Math.min(lo, hi) * 10) / 10,
                   max: Math.round(Math.max(lo, hi) * 10) / 10,
                   basis: 'riegel_exponent_1.04_1.08' };
        }
        return { value: Math.round(val * 10) / 10, metric: 'time',
          direction: 'lower',
          evidence: ev,
          sourceEvidence: run.confidence || 'unknown',
          modelBasis: modelBasis, distanceRatio: ratio,
          modelVersion: VERSION,
          band: band,
          ageRatio: run.ageRatio != null ? run.ageRatio : null,
          measuredAt: ref && ref.date ? ref.date : null,
          basis: valBasis };
      } catch (e) { return null; }
    })();

    /* ============================================================
       KRANKHEITS-EPISODE (@3) — LEBENSZYKLUS STATT FENSTERZAEHLUNG:
       Die alte ui-Zaehlung („positive ill-Tage der letzten 7") hatte drei
       Fehler: ill:false hob nichts auf, am 8. Tag verschwand die Episode
       durch Fensterablauf, und C2s symptomFreeDays existierte nie.
       Der Vertrag: letzter positiver Tag; danach zaehlen NUR ausdruecklich
       symptomfreie Tage (ill === false) in ununterbrochener Folge —
       fehlender Check-in ist unknown und zaehlt NICHT; die Episode endet
       durch BESTAETIGTE Freiheit (>= 7 explizit freie Tage in Folge),
       nie durch blossen Zeitablauf innerhalb des 28-Tage-Fensters. */
    snap.derived.interruption = (function () {
      try {
        var byDate = {};
        var minDate = null;
        (snap.checkins || []).forEach(function (c) {
          if (!c || !c.date) return;
          var dd = String(c.date).slice(0, 10);
          byDate[dd] = c;
          if (minDate == null || dd < minDate) minDate = dd;
        });
        if (!snap.today) return snap.interruption || null;
        var t0 = Date.parse(String(snap.today).slice(0, 10) + 'T12:00:00Z');
        if (isNaN(t0)) return snap.interruption || null;
        /* Letzter positiver Tag: ueber die GESAMTE gelieferte Serie — kein
           28-Tage-Fenster mehr. Die Serie reicht vertragsgemaess bis zum
           letzten positiven Tag (ui scannt bis dahin, Kappe 180d). */
        var lastPos = null, daysAffected = 0;
        Object.keys(byDate).forEach(function (dd) {
          var c3 = byDate[dd];
          if (c3 && c3.ill === true) { daysAffected++; if (lastPos == null || dd > lastPos) lastPos = dd; }
        });
        if (!lastPos) return snap.interruption || null;
        /* SYMPTOMFREIE TAGE = die AKTUELLE zusammenhaengende false-Serie
           RUECKWAERTS ab heute (v8-302): Die alte Vorwaertszaehlung blieb an
           der ersten Luecke nach dem positiven Tag stehen — 7 bestaetigt
           freie JUENGSTE Tage zaehlten 0. Massgeblich ist der aktuelle
           Zustand, nicht der Verlauf direkt nach der Erkrankung. */
        var freeDays = 0;
        for (var f = 0; ; f++) {
          var df = new Date(t0 - f * 86400000).toISOString().slice(0, 10);
          if (df <= lastPos) break;                       /* nur Tage NACH dem positiven */
          var cf = byDate[df];
          if (cf && cf.ill === false) freeDays++;
          else break;                                     /* unknown/true: Serie endet */
        }
        if (freeDays >= 7) return snap.interruption || null;   /* BESTAETIGT beendet */
        /* Reicht die Serie nicht bis zum positiven Tag zurueck, ist das eine
           KAPPUNG — ausgewiesen, nicht verschwiegen. */
        var truncated = minDate != null && lastPos <= minDate;
        return { reason: 'illness', lastPositiveDay: lastPos,
          daysAffected: daysAffected, symptomFreeDays: freeDays,
          coverage: truncated ? 'window_truncated'
            : (freeDays > 0 ? 'confirmed_free_streak' : 'unconfirmed'),
          source: 'morning_checkin' };
      } catch (e) { return snap.interruption || null; }
    })();

    /* ============================================================
       SICHERHEITSSCHICHT -> C2-FORM (@3): Profilbeschwerden tragen
       intensity/currentlyTrainable/status, C2 erwartet severity/blocks.
       Red Flags (Fieber, Brustschmerz, Atemnot, Schwindel, Neurologie)
       sind FAIL-CLOSED systemische Vollsperren — ein Warnzeichen, das die
       Uebersetzung nicht kennt, waere sonst einfach unsichtbar. */
    snap.derived.constraints = (function () {
      var out = [];
      try {
        (snap.profileConstraints || []).forEach(function (pc) {
          if (!pc || pc.status === 'resolved' || pc.status === 'improved') return;
          var sev;
          if (pc.currentlyTrainable === false) sev = 3;
          else if (pc.intensity != null && pc.intensity >= 7) sev = 2;
          else if (pc.intensity != null && pc.intensity >= 4) sev = 1;
          else sev = pc.intensity != null ? 0 : 1;   /* ohne Angabe: nicht 0 */
          /* POLITIK-ENTSCHEID (@5): observed wird UEBERSETZT — profile-center
             und decision-engine-v2 behandeln active+observed als relevant;
             eine beobachtete, unaufgeloeste Beschwerde darf nicht genau im
             Sicherheitspfad unsichtbar sein. Ausgewiesen mit evidence weak
             und reviewStatus; ein ausdrueckliches currentlyTrainable:false
             blockiert auch als observed (der Nutzer HAT es gesagt). */
          out.push({ region: pc.bodyRegion || pc.region || 'unknown',
            severity: sev,
            blocks: sev >= 3 ? ['all'] : (sev >= 2 ? ['intensity'] : []),
            evidence: pc.status === 'observed' ? 'weak' : (pc.medicallyChecked ? 'moderate' : 'weak'),
            reviewStatus: pc.status === 'observed' ? 'observed' : null,
            source: 'profile_constraint', title: pc.title || null });
        });
        var today = snap.today ? String(snap.today).slice(0, 10) : null;
        var rf = null;
        (snap.checkins || []).forEach(function (c) {
          if (c && c.date && String(c.date).slice(0, 10) === today) rf = c.redFlags || null;
        });
        if (rf) {
          ['fever', 'chestPain', 'shortnessOfBreath', 'dizziness',
           'neurologicalSymptoms', 'accidentPain'].forEach(function (k) {
            if (rf[k]) out.push({ region: 'systemic', severity: 3, blocks: ['all'],
              evidence: 'weak', source: 'red_flag:' + k });
          });
          ['swelling', 'instability'].forEach(function (k) {
            if (rf[k]) out.push({ region: 'musculoskeletal', severity: 2, blocks: ['intensity'],
              evidence: 'weak', source: 'red_flag:' + k });
          });
        }
      } catch (e) { }
      return out;
    })();

    /* Der Hash umfasst ALLES inklusive Modul-VERSION und Ableitungen:
       Ein anderer Adapter ist ein anderer Zustand, auch bei identischen
       Daten. */
    snap.hash = _hash(_stable(snap));
    return deepFreeze(snap);
  }

  var api = { VERSION: VERSION, build: build };
  Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.observerInput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
