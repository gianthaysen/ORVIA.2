/* ============================================================
   ORVIA · prediction-observer — Vorhersage und Kalibrierung, reiner Beobachter

   AUSSERHALB DER ABNAHMEKOHORTE. Dieses Modul veraendert keines der 15
   eingefrorenen Kohortenmodule und keinen Plan. Es friert Erwartungen VOR
   einer Einheit ein und vergleicht sie SPAETER mit dem Debrief — mehr nicht.
   Es ist ein Messinstrument, keine Learning Engine: „Was hat ORVIA
   vorhergesagt, wie lag es daneben, und wo ist das Modell systematisch zu
   optimistisch oder pessimistisch?"

   ERWARTUNG IST NICHT VORHERSAGE. `expectedRPE` aus der Prescription ist ein
   Trainingsziel: „So anstrengend SOLL das ungefaehr sein." Eine Vorhersage
   sagt: „So anstrengend WIRD das fuer diesen Nutzer wahrscheinlich sein."
   Der Record fuehrt beide getrennt (prescriptionExpectation /
   modelPrediction). Heute speisen sich beide aus derselben Basis — aber nur
   die semantische Trennung erlaubt einem spaeteren individuellen Modell, die
   PROGNOSE zu aendern, ohne die Prescription umzuschreiben.

   KEINE TOLERANZ JE EINHEIT. Toleranz ist ein abgeleiteter Zustand aus
   mehreren vergleichbaren Einheiten (C1/C3-Vertrag). Vorhergesagt werden nur
   BEOBACHTBARE Groessen der einen Einheit: RPE-Bereich, Completion-
   Wahrscheinlichkeit, Zone-Hit-Bereich. Eine Toleranzaussage aus einzelnen
   Records abzuleiten hiesse, die eigene nachgelagerte Klassifikation zu
   prophezeien.

   INVARIANTEN (jede als Test):
     · Die Vorhersage wird VOR dem Ergebnis eingefroren und nie veraendert
       (deepFreeze + immutableHash). Append-only: Die Auswertung ist ein
       EIGENER Record, nie ein Update.
     · Kein Eingang darf zeitlich nach `predictedAt` liegen — Future Leakage
       wird fail-closed abgewiesen, nicht still toleriert.
     · Dieselbe Session + Planrevision + Modellversion ⇒ dieselbe
       predictionId (deterministisch, keine Dubletten).
     · Aufgeloest wird nur bei uebereinstimmendem Nutzer, Session,
       Planrevision und Prescription-Hash — sonst `superseded` bzw.
       `not_comparable`, mit benanntem Grund.
     · Kein Debrief heisst `unresolved` — NIEMALS „nicht geschafft". Ein
       fehlender Eintrag ist fehlendes Wissen, kein Misserfolg.
     · Kalibriert wird NIE ueber Modellversionen hinweg und NIE unkontrolliert
       ueber Sportarten/Sessiontypen — Gruppen sind {Modellversion, Sportart,
       Sessiontyp}.
     · Jede Kennzahl weist Fallzahl, aufgeloeste Faelle und fehlende Debriefs
       aus.

   Kein DOM, keine Uhr, kein Zufall, kein Storage. Zeit wird injiziert.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'prediction-observer@7';
  var POLICY_VERSION = 'po-policy@1';
  /* Die MODELLVERSION ist eigenstaendig: Sie versioniert die PROGNOSE-Rechnung.
     Ein spaeteres individuelles Modell erhoeht sie — und trennt damit
     automatisch die Kalibrierungsgruppen. */
  var MODEL_VERSION = 'prediction-model@1';

  /* PFLICHTEINGAENGE JE MODELLVERSION. Das Modell deklariert selbst, welche
     zeittragenden Eingaenge es benutzt — nicht der Aufrufer. prediction-model@1
     ist ein reiner Prescription-Prior und braucht keine weiteren Eingaenge;
     ein spaeteres Modell mit HRV oder Schlaf MUSS sie hier listen, und
     predict() weist eine Vorhersage ohne deklarierten Pflichteingang ab.
     Damit kann eine Auslassung des Aufrufers nicht mehr unbemerkt bleiben. */
  var REQUIRED_INPUTS = {
    'prediction-model@1': []
  };

  /* Populations-Ausgangswerte [S] — Erfahrungswerte, keine Messgroessen.
     Genau deshalb: Band statt Punkt, Wahrscheinlichkeit statt Zusage, und
     evidence 'weak' an jeder Prognose. */
  var PRIOR = {
    rpeBand: { strong: 1.0, moderate: 1.5, weak: 2.0, unknown: 2.5 },
    completionProbability: 0.85,
    zoneHitRange: { min: 0.6, max: 1.0 },
    rpeMin: 1, rpeMax: 10,
    /* HERKUNFT DER ZAHLEN — maschinenlesbar, damit sie im Record steht und
       nicht nur im Kommentar: 0.85 ist ein Populationsprior [S], die
       Bandbreiten sind vorsichtige Policy-Annahmen [A]. Schwaechere Evidenz
       RECHTFERTIGT ein breiteres Band; sie BEWEIST die konkrete Breite nicht. */
    basis: {
      rpeBand: 'policy_assumption',
      completionProbability: 'population_prior',
      zoneHitRange: 'population_prior'
    }
  };

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
  function deepFreeze(x, d) {
    var depth = d || 0;
    if (x === null || typeof x !== 'object' || depth > 10) return x;
    Object.keys(x).forEach(function (k) { deepFreeze(x[k], depth + 1); });
    try { return Object.freeze(x); } catch (e) { return x; }
  }
  function _t(x) { var t = Date.parse(x); return isNaN(t) ? null : t; }

  /* Der Prescription-Hash bindet die Vorhersage an die DAMALIGE Verordnung.
     Dieselben Felder, die das Debrief in seinem Snapshot einfriert (C3). */
  function prescriptionHashOf(p) {
    var x = p || {};
    /* Begrenzt auf das, was der C3-Snapshot einfriert — mehr laesst sich beim
       Aufloesen nicht gegenpruefen. expectedRpeEvidence gehoert hinein, weil
       sie die RPE-Bandbreite der Prognose veraendert. sessionType gehoert
       hinein (v8-308, Gians P0): OHNE ihn hashten eine Tempo- und eine
       Threshold-Verordnung mit zufaellig gleichem expectedRpe/Evidenz/Zone
       IDENTISCH (Gegenprobe: beide 0c77ef96) — eine Threshold-Einheit
       konnte als Tempo-Auswertung scoren und haette die Kalibrierung
       verunreinigt, denn die Gruppen trennen genau nach sessionType. */
    return _hash(_stable({
      version: x.prescriptionVersion != null ? x.prescriptionVersion : null,
      sessionType: x.sessionType != null ? x.sessionType : null,
      expectedRpe: x.expectedRpe != null ? x.expectedRpe : null,
      expectedRpeEvidence: x.expectedRpeEvidence != null ? x.expectedRpeEvidence : null,
      targetZone: x.targetZone != null ? x.targetZone : null
    }));
  }

  /* ============================================================
     VORHERSAGE — eingefroren VOR der Einheit
     ============================================================ */
  function predict(input) {
    var i = input || {};
    function fail(reason) { return deepFreeze({ ok: false, reason: reason, version: VERSION }); }

    if (!i.predictedAt || _t(i.predictedAt) == null) return fail('no_predicted_at');
    if (!i.userId) return fail('no_user');
    if (!i.sessionId) return fail('no_session');
    /* PLAN-IDENTITAET IST PFLICHT (fail-closed): Ohne planId/planRevision
       liesse sich eine Vorhersage gegen das Debrief eines ANDEREN Plans
       bewerten — und zwei Plaene koennten dieselbe predictionId erhalten. */
    if (i.planId == null) return fail('no_plan_id');
    if (i.planRevision == null) return fail('no_plan_revision');
    var rx = i.prescription || null;
    if (!rx || rx.expectedRpe == null) return fail('no_prescription_expectation');
    /* SESSIONTYP: EINE QUELLE (v8-309, Gians P0 nach @6). Der Typ steht seit
       @6 im Prescription-Hash — der Record las seine Kalibrierungsgruppe
       aber weiter aus input.sessionType. Repro: prescription 'threshold' +
       input 'tempo' => scored, Gruppe 'tempo' — die Kalibrierung waere je
       Gruppe verunreinigt worden, ohne dass der Hash-Vertrag es sieht.
       AUTORITATIV ist ausschliesslich prescription.sessionType (aus
       SD.prescriptionOf, derselben Quelle wie der C3-Snapshot). Fehlt er:
       fail-closed. Wird ZUSAETZLICH input.sessionType uebergeben und weicht
       ab, ist das ein Programmierfehler des Aufrufers — ebenfalls
       fail-closed, KEIN stiller Vorrang und KEIN Rueckfall auf 'unknown'. */
    var rxType = rx.sessionType != null ? rx.sessionType : null;
    if (rxType == null) return fail('no_prescription_session_type');
    if (i.sessionType != null && i.sessionType !== rxType) return fail('session_type_mismatch');

    /* ============================================================
       EINE VORHERSAGE ENTSTEHT VOR DEM EREIGNIS — WIRKLICH.

       Ein Planlauf kann stattfinden, nachdem die Einheit begonnen oder
       laengst absolviert ist (alter Plan geoeffnet, Sync nachgeholt).
       `predictedAt` allein beweist nichts. Drei Schranken, fail-closed:

         · absolvierte Einheit (completedAt / vorhandenes Debrief) ⇒ ablehnen
         · bekannte Startzeit: predictedAt MUSS davor liegen
         · nur Tagesdatum bekannt: predictedAt muss VOR dem Tag liegen —
           und der Record weist die groebere Basis aus (`day_level_only`)
         · gar keine Zeitreferenz zur Einheit ⇒ ablehnen. Eine „Vorhersage"
           ohne pruefbaren Zeitbezug ist eine Nacherzaehlung mit Stempel.
       ============================================================ */
    var pAt0 = _t(i.predictedAt);
    if (i.debriefExists === true) return fail('session_already_debriefed');
    /* VORHANDEN-ABER-UNLESBAR IST NICHT FEHLEND: 'not-a-date' in completedAt
       hiesse sonst „nicht absolviert" — die freundlichste aller Deutungen. */
    if (i.completedAt != null) {
      if (_t(i.completedAt) == null) return fail('unreadable_timestamp:completedAt');
      return fail('session_already_completed');
    }
    var timingBasis = null;
    var startT = null;
    if (i.sessionStartAt != null) {
      startT = _t(i.sessionStartAt);
      if (startT == null) return fail('unreadable_timestamp:sessionStartAt');
    }
    if (startT != null) {
      if (pAt0 >= startT) return fail('session_already_started');
      timingBasis = 'verified_start_time';
    } else if (i.sessionDate != null) {
      /* NUR TAGESDATUM: Die Vorhersage muss VOR dem Tag liegen — eine
         Vorhersage um 18 Uhr fuer denselben Tag ist nicht pruefbar vor dem
         Ereignis. Tagesbeginn in UTC [A]: fuer Zeitzonen oestlich von UTC ist
         das STRENGER als lokal (frueherer Schnitt) — die konservative
         Richtung. Wer es genauer braucht, uebergibt sessionStartAt. */
      var dayT = _t(String(i.sessionDate).slice(0, 10) + 'T00:00:00Z');
      if (dayT == null) return fail('unreadable_session_date');
      if (pAt0 >= dayT) return fail('predicted_on_or_after_session_day');
      timingBasis = 'day_level_only';
    } else {
      return fail('no_session_time_reference');
    }

    /* ZEITTRAGENDE EINGAENGE SIND DEKLARATIONSPFLICHTIG. `inputs` ist die
       zentrale Liste {name, at}; ein Eintrag OHNE Zeitpunkt wird abgelehnt —
       das entscheidet das Modul, nicht der Aufrufer. Ein neuer Eingang kann
       nicht still ohne Zeitstempel hinzukommen. */
    var declared = Array.isArray(i.inputs) ? i.inputs : [];
    var required = REQUIRED_INPUTS[MODEL_VERSION];
    if (!required) return fail('model_without_required_input_list');
    for (var rq = 0; rq < required.length; rq++) {
      var found = declared.some(function (di) { return di && di.name === required[rq]; });
      if (!found) return fail('undeclared_required_input:' + required[rq]);
    }
    for (var q = 0; q < declared.length; q++) {
      var di = declared[q] || {};
      if (di.at == null || _t(di.at) == null) {
        return fail('input_without_timestamp:' + (di.name || ('#' + q)));
      }
    }

    /* FUTURE LEAKAGE: Kein Eingang darf juenger sein als der
       Vorhersagezeitpunkt. Fail-closed — eine Vorhersage aus der Zukunft ist
       keine Vorhersage, sondern eine Nacherzaehlung. */
    var pAt = pAt0;
    var stamps = [];
    if (rx.resolvedAt) stamps.push(['prescription.resolvedAt', rx.resolvedAt]);
    if (i.zonesMeasuredAt) stamps.push(['zonesMeasuredAt', i.zonesMeasuredAt]);
    declared.forEach(function (di) { stamps.push(['inputs.' + (di.name || '?'), di.at]); });
    (Array.isArray(i.inputTimestamps) ? i.inputTimestamps : []).forEach(function (ts, n) {
      stamps.push(['inputTimestamps[' + n + ']', ts]);
    });
    for (var n = 0; n < stamps.length; n++) {
      var tv = _t(stamps[n][1]);
      /* UNLESBAR IST NICHT UNSCHULDIG: Ein Zeitstempel, der sich nicht parsen
         laesst, kann aus der Zukunft stammen — fail-closed ablehnen statt
         still ueberspringen. */
      if (tv == null) return fail('unreadable_timestamp:' + stamps[n][0]);
      if (tv > pAt) return fail('future_leakage:' + stamps[n][0]);
    }

    /* MODELLSICHT: Die Prognoserechnung liest AUSSCHLIESSLICH aus diesem
       explizit gebauten Objekt — nie direkt aus `input`. Ein Entwickler, der
       einen neuen Eingang benutzt, MUSS ihn hier eintragen; die Stelle liegt
       direkt neben REQUIRED_INPUTS, damit Liste und Nutzung nicht
       auseinanderlaufen koennen, ohne dass es im Diff auffaellt. */
    var modelView = {
      expectedRpe: rx.expectedRpe,
      expectedRpeEvidence: rx.expectedRpeEvidence || 'unknown'
    };
    var evid = modelView.expectedRpeEvidence;
    var band = PRIOR.rpeBand[evid] != null ? PRIOR.rpeBand[evid] : PRIOR.rpeBand.unknown;

    var rec = {
      v: 1,
      /* DETERMINISTISCHE ID: dieselbe Session unter derselben Planrevision und
         Modellversion ergibt dieselbe Vorhersage — keine Dubletten durch
         mehrfaches Rendern. */
      /* Die ID umfasst ALLE Identitaetsfelder — auch Plan und Prescription.
         Zwei Plaene oder zwei Verordnungen ergeben nie dieselbe ID. */
      predictionId: 'pred:' + _hash(_stable({ u: i.userId, s: i.sessionId,
        p: i.planId, r: i.planRevision, h: prescriptionHashOf(rx), m: MODEL_VERSION })),
      userId: i.userId, sessionId: i.sessionId,
      planId: i.planId != null ? i.planId : null,
      planRevision: i.planRevision != null ? i.planRevision : null,
      sport: i.sport || 'unknown',
      /* AUS DER PRESCRIPTION, nie aus dem Input (v8-309) — die
         Kalibrierungsgruppe muss dieselbe Quelle haben wie der Hash. */
      sessionType: rxType,
      predictedAt: i.predictedAt,
      /* Wie belastbar der Zeitbezug zur Einheit ist — Teil des Records,
         damit die Kalibrierung spaeter danach trennen KANN. */
      timingBasis: timingBasis,
      prescriptionHash: prescriptionHashOf(rx),

      /* ERWARTUNG: das Trainingsziel aus der Prescription — normativ. */
      prescriptionExpectation: {
        expectedRpe: rx.expectedRpe,
        evidence: evid
      },
      /* VORHERSAGE: die statistische Prognose — heute aus derselben Basis,
         aber ein EIGENES Konzept mit eigener Modellkennung. */
      modelPrediction: {
        rpeRange: {
          min: _r2(Math.max(PRIOR.rpeMin, modelView.expectedRpe - band)),
          max: _r2(Math.min(PRIOR.rpeMax, modelView.expectedRpe + band))
        },
        completionProbability: PRIOR.completionProbability,
        zoneHitRange: { min: PRIOR.zoneHitRange.min, max: PRIOR.zoneHitRange.max },
        model: 'population_prior',
        individualized: false,
        evidence: 'weak',
        /* Herkunft je Zahl: Prior [S] oder Policy-Annahme [A] — im Record,
           nicht nur im Kommentar. */
        assumptions: PRIOR.basis
      },
      modelVersion: MODEL_VERSION,
      version: VERSION, policyVersion: POLICY_VERSION,
      ok: true
    };
    /* Der Unveraenderlichkeits-Hash umfasst ALLES ausser sich selbst — eine
       nachtraegliche Aenderung irgendeines Felds faellt beim Nachrechnen auf. */
    rec.immutableHash = _hash(_stable(rec));
    return deepFreeze(rec);
  }

  /* INTEGRITAET, NICHT AUTHENTIZITAET. Der Hash liegt im selben Record — wer
     Record UND Hash aendern kann, berechnet beide neu. Erkannt werden
     versehentliche Aenderungen und Uebertragungsfehler; echte
     Manipulationssicherheit braeuchte eine serverseitige Signatur (HMAC).
     Deshalb heisst der Befund `integrity_mismatch`, nicht „tampered". */
  function verifyIntegrity(rec) {
    if (!rec || rec.ok !== true) return false;
    var copy = {};
    Object.keys(rec).forEach(function (k) { if (k !== 'immutableHash') copy[k] = rec[k]; });
    return _hash(_stable(copy)) === rec.immutableHash;
  }

  /* ============================================================
     AUFLOESUNG — ein EIGENER Record, nie ein Update

     Reihenfolge der Pruefungen ist Vertrag: Erst Integritaet und Identitaet,
     dann Vergleichbarkeit, dann Bewertung. `unresolved` ist ein Zustand des
     WISSENS, kein Urteil ueber die Einheit.
     ============================================================ */
  function resolve(prediction, debrief, opts) {
    var o = opts || {};
    var p = prediction || null;

    function out(resolution, extra) {
      var e = extra || {};
      return deepFreeze({
        v: 1,
        predictionId: p && p.predictionId ? p.predictionId : null,
        debriefId: e.debriefId != null ? e.debriefId : null,
        resolution: resolution,
        reason: e.reason || null,
        residuals: e.residuals || null,
        predictionModelVersion: p && p.modelVersion ? p.modelVersion : null,
        sport: p && p.sport ? p.sport : null,
        sessionType: p && p.sessionType ? p.sessionType : null,
        evaluatedAt: o.evaluatedAt || null,
        version: VERSION, policyVersion: POLICY_VERSION
      });
    }

    /* FEHLENDE VORHERSAGE IST KEIN ENDZUSTAND. predict() laeuft verzoegert —
       ein Debrief kann persistiert sein, BEVOR der Prediction-Record es ist.
       `pending` heisst: spaeter erneut versuchen (Reconciliation). Nur eine
       VORHANDENE, aber ungueltige Vorhersage ist endgueltig unvergleichbar. */
    if (p == null) return out('pending', { reason: 'prediction_not_yet_available',
      debriefId: debrief && (debrief.id != null ? debrief.id : debrief.debriefId) || null });
    if (p.ok !== true) return out('not_comparable', { reason: 'prediction_rejected' });
    if (!verifyIntegrity(p)) return out('not_comparable', { reason: 'integrity_mismatch' });

    /* KEIN DEBRIEF ⇒ UNRESOLVED. Niemals „nicht geschafft": Ein fehlender
       Eintrag ist fehlendes Wissen ueber die Einheit, kein Misserfolg. */
    var d = debrief || null;
    if (!d) return out('unresolved', { reason: 'no_debrief' });

    var dId = d.id != null ? d.id : (d.debriefId != null ? d.debriefId : null);

    /* IDENTITAET: Nutzer, Session, Planrevision, Prescription. */
    /* BEHAUPTETE IDENTITAET WIRD VOLLSTAENDIG GEPRUEFT. Ein Debrief ohne
       Nutzer koennte jedem gehoeren; ein fehlendes planId-Feld laesst offen,
       zu welchem Plan die Einheit gehoerte. Beides fail-closed — der
       kanonische Debrief-Vertrag (debrief-record@1) liefert beide Felder. */
    if (d.userId == null) return out('not_comparable', { debriefId: dId, reason: 'debrief_user_unknown' });
    if (p.userId !== d.userId) return out('not_comparable', { debriefId: dId, reason: 'user_mismatch' });
    if (p.planId != null) {
      if (d.planId == null) return out('not_comparable', { debriefId: dId, reason: 'debrief_plan_unknown' });
      if (d.planId !== p.planId) return out('not_comparable', { debriefId: dId, reason: 'plan_mismatch' });
    }
    var dSession = d.sessionId != null ? d.sessionId : (d.plannedSessionId != null ? d.plannedSessionId : null);
    if (dSession == null || dSession !== p.sessionId) {
      return out('not_comparable', { debriefId: dId, reason: 'session_mismatch' });
    }
    /* Eine nachtraeglich geaenderte Einheit (neue Planrevision) macht die alte
       Vorhersage SUPERSEDED — sie war fuer eine andere Einheit. */
    if (d.planRevision == null) {
      return out('not_comparable', { debriefId: dId, reason: 'debrief_revision_unknown' });
    }
    if (d.planRevision !== p.planRevision) {
      return out('superseded', { debriefId: dId, reason: 'plan_revision_changed' });
    }
    /* SPORT IST VERGLEICHSVERTRAG (v8-308, Gians P0): Die Occurrence-ID
       bindet an den Slot, nicht an die Sportart — eine nachtraeglich
       umgewidmete Einheit (Rad statt Lauf im selben Slot) haette sonst
       gegen die Lauf-Vorhersage scoren koennen. FAIL-CLOSED: ein
       unbestimmter Sport auf einer der beiden Seiten ist keine
       nachgewiesene Gleichheit. */
    var pSport = (p.sport != null && p.sport !== 'unknown') ? p.sport : null;
    var dSport = d.sportId != null ? d.sportId : null;
    if (pSport == null || dSport == null) {
      return out('not_comparable', { debriefId: dId, reason: 'sport_unknown' });
    }
    if (pSport !== dSport) {
      return out('not_comparable', { debriefId: dId, reason: 'sport_mismatch' });
    }
    /* Verglichen wird gegen den DAMALIGEN Prescription-Snapshot des Debriefs
       (C3-Vertrag) — nie gegen heutige Zonen. Weicht er ab, war die
       verordnete Einheit eine andere. */
    var snapHash = prescriptionHashOf(d.snapshot || null);
    if (snapHash !== p.prescriptionHash) {
      return out('not_comparable', { debriefId: dId, reason: 'prescription_mismatch' });
    }
    /* ZEITRICHTUNG IST PFLICHT: Ohne lesbare Debrief-Zeit laesst sich „nach
       der Vorhersage" nicht nachweisen — fail-closed statt freundlich. */
    var dRaw = d.createdAt != null ? d.createdAt : (d.judgedAt != null ? d.judgedAt : null);
    if (dRaw == null) return out('not_comparable', { debriefId: dId, reason: 'debrief_time_unknown' });
    var dAt = _t(dRaw);
    if (dAt == null) return out('not_comparable', { debriefId: dId, reason: 'unreadable_timestamp:debrief.createdAt' });
    if (dAt < _t(p.predictedAt)) {
      return out('not_comparable', { debriefId: dId, reason: 'debrief_before_prediction' });
    }


    /* BEWERTUNG — nur beobachtbare Groessen, Residuen je Dimension. */
    var mp = p.modelPrediction;
    var residuals = { rpe: null, completion: null, zoneHit: null };

    if (d.rpe != null) {
      var mid = (mp.rpeRange.min + mp.rpeRange.max) / 2;
      residuals.rpe = {
        actual: d.rpe, predictedRange: mp.rpeRange,
        error: _r2(d.rpe - mid),
        inRange: d.rpe >= mp.rpeRange.min && d.rpe <= mp.rpeRange.max
      };
    }
    if (d.completed != null) {
      var outcome = d.completed ? 1 : 0;
      residuals.completion = {
        actual: outcome, probability: mp.completionProbability,
        /* Brier je Fall — nur weil hier eine ECHTE Wahrscheinlichkeit steht. */
        brier: _r2(Math.pow(mp.completionProbability - outcome, 2))
      };
    }
    if (d.zoneHit != null) {
      var zMid = (mp.zoneHitRange.min + mp.zoneHitRange.max) / 2;
      residuals.zoneHit = {
        actual: d.zoneHit, predictedRange: mp.zoneHitRange,
        error: _r2(d.zoneHit - zMid),
        inRange: d.zoneHit >= mp.zoneHitRange.min && d.zoneHit <= mp.zoneHitRange.max
      };
    }
    var any = residuals.rpe || residuals.completion || residuals.zoneHit;
    if (!any) return out('unresolved', { debriefId: dId, reason: 'no_observable_outcomes' });

    return out('scored', { debriefId: dId, residuals: residuals });
  }

  /* ============================================================
     KALIBRIERUNG — reine Statistik, kein Rueckkanal

     Gruppen sind {Modellversion, Sportart, Sessiontyp}. NIE ueber
     Modellversionen hinweg (verschiedene Prognosen sind verschiedene
     Instrumente) und NIE unkontrolliert ueber Sportarten (ein Laufmodell
     sagt nichts ueber Schwimmen). Jede Kennzahl traegt ihre Fallzahlen.
     ============================================================ */
  function calibrate(evaluations) {
    var all = Array.isArray(evaluations) ? evaluations.filter(Boolean) : [];
    var groups = {};
    all.forEach(function (e) {
      var k = _stable({ m: e.predictionModelVersion || 'unknown',
        s: e.sport || 'unknown', t: e.sessionType || 'unknown' });
      (groups[k] = groups[k] || []).push(e);
    });

    var out = Object.keys(groups).sort().map(function (k) {
      var list = groups[k];
      var scored = list.filter(function (e) { return e.resolution === 'scored'; });
      var counts = {
        n: list.length,
        scored: scored.length,
        unresolved: list.filter(function (e) { return e.resolution === 'unresolved'; }).length,
        pending: list.filter(function (e) { return e.resolution === 'pending'; }).length,
        superseded: list.filter(function (e) { return e.resolution === 'superseded'; }).length,
        notComparable: list.filter(function (e) { return e.resolution === 'not_comparable'; }).length
      };
      var first = list[0];

      function stats(pick) {
        var vals = scored.map(pick).filter(function (x) { return x != null; });
        if (!vals.length) return null;
        var errs = vals.map(function (x) { return x.error; }).filter(function (x) { return x != null; });
        var cov = vals.map(function (x) { return x.inRange; }).filter(function (x) { return x != null; });
        return {
          n: vals.length,
          meanError: errs.length ? _r2(errs.reduce(function (a, b) { return a + b; }, 0) / errs.length) : null,
          meanAbsError: errs.length ? _r2(errs.reduce(function (a, b) { return a + Math.abs(b); }, 0) / errs.length) : null,
          intervalCoverage: cov.length ? _r2(cov.filter(Boolean).length / cov.length) : null
        };
      }
      var briers = scored.map(function (e) { return e.residuals && e.residuals.completion ? e.residuals.completion.brier : null; })
        .filter(function (x) { return x != null; });
      var outcomes = scored.map(function (e) { return e.residuals && e.residuals.completion ? e.residuals.completion.actual : null; })
        .filter(function (x) { return x != null; });

      return {
        modelVersion: first.predictionModelVersion || 'unknown',
        sport: first.sport || 'unknown',
        sessionType: first.sessionType || 'unknown',
        counts: counts,
        resolutionRate: counts.n ? _r2(counts.scored / counts.n) : null,
        rpe: stats(function (e) { return e.residuals ? e.residuals.rpe : null; }),
        completion: briers.length ? {
          n: briers.length,
          brier: _r2(briers.reduce(function (a, b) { return a + b; }, 0) / briers.length),
          baseRate: _r2(outcomes.reduce(function (a, b) { return a + b; }, 0) / outcomes.length)
        } : null,
        zoneHit: stats(function (e) { return e.residuals ? e.residuals.zoneHit : null; })
      };
    });

    return {
      version: VERSION, policyVersion: POLICY_VERSION,
      groups: out,
      totals: { records: all.length, groups: out.length },
      note: 'Reine Messung — kein Rueckkanal. Gruppen sind {Modellversion, Sportart, Sessiontyp}; nichts wird versionsuebergreifend gemittelt.'
    };
  }

  /* ============================================================
     RECONCILIATION — verbindet, was sich ueberholt hat

     Der Schluessel ist IMMER die exakte Kombination — nichts Schwaecheres:
       { userId, sessionId, planId, planRevision, prescriptionHash,
         predictionModelVersion }
     Eine lose Zuordnung (nur Session) wuerde ein Debrief mit der Vorhersage
     einer ANDEREN Planrevision verheiraten — genau der Fehler, den
     `superseded` verhindert.
     ============================================================ */
  function matchKey(x) {
    var o = x || {};
    return _stable({ u: o.userId != null ? o.userId : null,
      s: o.sessionId != null ? o.sessionId : null,
      p: o.planId != null ? o.planId : null,
      r: o.planRevision != null ? o.planRevision : null,
      h: o.prescriptionHash != null ? o.prescriptionHash : null,
      m: o.modelVersion != null ? o.modelVersion : (o.predictionModelVersion != null ? o.predictionModelVersion : null) });
  }
  function reconcile(pendingEvals, predictions, debriefs, opts) {
    var o = opts || {};
    var preds = Array.isArray(predictions) ? predictions.filter(function (x) { return x && x.ok === true; }) : [];
    var dbs = {};
    (Array.isArray(debriefs) ? debriefs : []).forEach(function (d) {
      if (!d) return;
      var id = d.id != null ? d.id : d.debriefId;
      if (id != null) dbs[id] = d;
    });
    /* DIE MODELLVERSION KOMMT AUS DER VORHERSAGE, NIE AUS DEM HEUTE GELADENEN
       MODUL. Sonst bliebe ein Pending-Fall fuer eine aeltere Vorhersage nach
       einem Modellwechsel fuer immer pending. Der Fuenfer-Schluessel findet
       Kandidaten; die Vorhersage selbst liefert das sechste Feld — jede
       passende Modellversion ergibt ihre EIGENE Auswertung (Kalibrierung
       trennt ohnehin je Modellversion). */
    function key5(u, sid, pid, rev, rxh) {
      return _stable({ u: u != null ? u : null, s: sid != null ? sid : null,
        p: pid != null ? pid : null, r: rev != null ? rev : null, h: rxh != null ? rxh : null });
    }
    var byKey5 = {};
    preds.forEach(function (pr) {
      var k = key5(pr.userId, pr.sessionId, pr.planId, pr.planRevision, pr.prescriptionHash);
      (byKey5[k] = byKey5[k] || []).push(pr);
    });

    var resolved = [], stillPending = [];
    (Array.isArray(pendingEvals) ? pendingEvals : []).forEach(function (ev) {
      if (!ev || ev.resolution !== 'pending') return;
      var d = ev.debriefId != null ? dbs[ev.debriefId] : null;
      if (!d) { stillPending.push(ev); return; }
      var k = key5(d.userId, d.sessionId != null ? d.sessionId : d.plannedSessionId,
        d.planId != null ? d.planId : null, d.planRevision != null ? d.planRevision : null,
        prescriptionHashOf(d.snapshot || null));
      var cands = byKey5[k] || null;
      if (!cands || !cands.length) { stillPending.push(ev); return; }
      cands.forEach(function (pr) {
        resolved.push(resolve(pr, d, { evaluatedAt: o.evaluatedAt || null }));
      });
    });
    return { resolved: resolved, stillPending: stillPending,
      counts: { input: (pendingEvals || []).length, resolved: resolved.length, stillPending: stillPending.length } };
  }

  /* DIE PRIOREN SIND VERTRAG, KEIN LAUFZEITPARAMETER. Ohne Einfrieren liess
     sich completionProbability zur Laufzeit von 0.85 auf 0.1 setzen — ohne
     Versionswechsel, und jede weitere Vorhersage haette still ein anderes
     Modell benutzt. Eine andere Zahl IST eine andere Modellversion. */
  deepFreeze(PRIOR);
  deepFreeze(REQUIRED_INPUTS);
  var api = {
    VERSION: VERSION, POLICY_VERSION: POLICY_VERSION, MODEL_VERSION: MODEL_VERSION,
    PRIOR: PRIOR, REQUIRED_INPUTS: REQUIRED_INPUTS,
    predict: predict, resolve: resolve, calibrate: calibrate,
    reconcile: reconcile, matchKey: matchKey,
    prescriptionHashOf: prescriptionHashOf, verifyIntegrity: verifyIntegrity
  };
  Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.predictionObserver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
