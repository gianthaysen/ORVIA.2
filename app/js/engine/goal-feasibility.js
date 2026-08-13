/* ============================================================
   ORVIA · goal-feasibility — Stufe 5 des Bauplans

   REINER BEWERTER. Dieses Modul beschreibt Zielbedarf, erreichbare Trajektorie,
   Lücke und Unsicherheit — und verordnet KEINE Belastung. Es liest das
   C2-Ergebnis, aber es verändert es nicht und erzeugt keinen eigenen
   Trainingsbedarf.

   DIE ABHÄNGIGKEIT LÄUFT VON C2 HIERHER, NICHT UMGEKEHRT. Die erste Fassung des
   Bauplans hatte es andersherum: Feasibility hätte `requiredPctPerWeek` erzeugt
   und C2 hätte es umzusetzen versucht. Damit erzeugte ein unrealistisches Ziel
   dauerhaft Druck bis an die Guardrail-Decke, Woche für Woche, ohne dass
   irgendwo „das geht nicht" gestanden hätte. Richtig: C2 berechnet den
   zulässigen Korridor, dieses Modul VERGLEICHT ihn mit dem Bedarf.

   DER STATUS HEISST NICHT „MACHBAR". Er lautet `within_modeled_corridor`,
   `outside_modeled_corridor` oder `insufficient_data`. Die Engine bewertet, was
   das heutige Modell trägt — sie verwechselt Modellgrenzen nicht mit
   biologischer Gewissheit. Ein Ziel außerhalb des modellierten Korridors ist
   nicht „unmöglich"; es liegt außerhalb dessen, was diese Rechnung stützt.

   DER BEDARF WIRD IM LEISTUNGSRAUM BESCHRIEBEN, nicht in Lastprozent. Die
   Übersetzung „Leistung → Trainingslast" ist genau der Ort, an dem
   Scheingenauigkeit entsteht: Es gibt keine belastbare Funktion, die aus
   „3 % schnellere Schwelle" eine Wochenkilometerzahl macht. Deshalb bleibt
   `requiredTrajectory` in Pace, Zeit und Prozent der Leistung.

   DIE ERREICHBARE ENTWICKLUNG IST EIN BAND, KEINE PUNKTPROGNOSE. Größenordnungen
   je 12-Wochen-Block [S]: Anfänger im ersten Jahr deutlich mehr als
   Fortgeschrittene, Wettkampforientierte am wenigsten. Diese Spannen sind
   Erfahrungswerte, keine Messgrößen — deshalb Band mit Evidenzangabe.

   OHNE FREIGABE DER PROGRESSION KEINE POSITIVE AUSSAGE. Wenn C2 seine eigene
   Empfehlung nicht freigibt (`targetLoad: null` bzw. `autoApplicable: false`),
   darf hier keine Erreichbarkeit behauptet werden. Sonst käme
   `provisionalTargetLoad` durch die Hintertür doch noch zu einer Aussage.

   CACHE-SCHLUESSEL UND AUDIT-HASH SIND ZWEI VERSCHIEDENE DINGE. Der Cache
   fragt „darf ich dieses Urteil wiederverwenden?" und enthaelt deshalb nur
   direkte und transitive Entscheidungsabhaengigkeiten — aus dem EINGANG, nicht
   aus der globalen Registry. Der Audit-Hash fragt „unter welchem Gesamtzustand
   ist das entstanden?" und darf so breit sein wie moeglich; er gehoert ins
   Decision Log, nicht in die Wiederverwendungsentscheidung.

   DAS ERREICHBARE BAND IST EIN GRUPPENPRIOR, KEIN PERSONENMODELL. C2 liefert
   zulaessige LAST; daraus folgt ohne individuelles Response Model keine
   vorhersagbare Leistungsverbesserung. Deshalb traegt das Band
   `model: 'population_prior'`, `individualized: false` und eine Provenance je
   Bestandteil — sonst koennte `within_modeled_corridor` intern doch auf einer
   scheinpraezisen Last-zu-Leistung-Abbildung beruhen.

   Kein DOM, keine Uhr, kein Zufall, kein Storage. `today` kommt herein.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'goal-feasibility@4';
  var POLICY_VERSION = 'gf-policy@2';

  function _req(n) { if (typeof require !== 'function') return null; try { return require(n); } catch (e) { return null; } }
  var EV = O.evidence || _req('./evidence.js');

  var STATUS = ['within_modeled_corridor', 'outside_modeled_corridor', 'insufficient_data'];

  /* Dokumentierte Änderungsraten der Schwellenleistung je 12-Wochen-Block, in
     Prozent. [S] — Erfahrungswerte aus der Literatur und Praxis, keine
     Messgrößen. Genau deshalb Bänder und keine Punktwerte. */
  var IMPROVEMENT_PER_BLOCK = {
    beginner:     { min: 5, max: 15 },
    intermediate: { min: 2, max: 5 },
    competitive:  { min: 1, max: 3 }
  };
  var BLOCK_WEEKS = 12;

  /* Die Raten setzen NORMALES progressives Training voraus. Verbietet der
     C2-Korridor jeden Aufbau, fällt die erreichbare Entwicklung Richtung
     Erhaltung. Die lineare Skalierung ist eine Modellannahme [A] — sie steht
     hier, damit sie sichtbar ist und nicht als Physiologie gelesen wird. */
  var REFERENCE_BUILD_PCT = 8;

  /* ============================================================
     RICHTUNG DER METRIK — EXPLIZIT, NIEMALS GERATEN

     Ob „besser" einen kleineren oder einen größeren Zahlenwert bedeutet,
     entscheidet über das VORZEICHEN des gesamten Bedarfs. Ein falsch geratenes
     Vorzeichen dreht die Aussage stillschweigend um: Aus „du brauchst 10 %
     Verbesserung" wird „Ziel bereits erreicht". Das ist der teuerste denkbare
     Fehler dieses Moduls, weil er nicht wie ein Fehler aussieht.

     Eine Heuristik über Teilzeichenketten (`indexOf('Pace')`) war genau deshalb
     unbrauchbar: `cssSecPer100` und `metricType: 'time'` hätten sie verfehlt und
     wären als „höher ist besser" gelaufen. Deshalb: bekannte Metrik aus der
     Tabelle oder ausdrückliche Angabe — sonst `insufficient_data`. Eine neue
     Metrik muss hier eingetragen werden; das ist ein sichtbarer, harmloser
     Fehlschlag statt einer stillen Umkehrung. ============================================================ */
  var METRIC_DIRECTION = {
    /* kleinerer Wert = bessere Leistung */
    thresholdpacesecperkm: 'lower', pacesecperkm: 'lower', pacesec: 'lower',
    csssecper100: 'lower', swimpacesecper100: 'lower',
    time: 'lower', racetime: 'lower', finishtime: 'lower', timesec: 'lower',
    durationsec: 'lower', marathontime: 'lower', halfmarathontime: 'lower',
    /* größerer Wert = bessere Leistung */
    ftp: 'higher', ftpwatts: 'higher', watts: 'higher', powerwatts: 'higher',
    vo2max: 'higher', vdot: 'higher', speedkmh: 'higher', vkmh: 'higher',
    distancekm: 'higher', distance: 'higher', reps: 'higher', onerm: 'higher'
  };
  function _mkey(x) { return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function directionOf(goal, perf) {
    var ex = _mkey((goal && goal.direction) || (perf && perf.direction));
    if (ex === 'lowerisbetter' || ex === 'lower') return 'lower';
    if (ex === 'higherisbetter' || ex === 'higher') return 'higher';
    var k = _mkey((perf && perf.metric) || (goal && goal.metricType));
    return METRIC_DIRECTION[k] || null;
  }

  function _r1(x) { return x == null ? null : Math.round(x * 10) / 10; }
  function _r2(x) { return x == null ? null : Math.round(x * 100) / 100; }

  function _weeksBetween(fromIso, toIso) {
    var a = Date.parse(String(fromIso).slice(0, 10) + 'T12:00:00Z');
    var b = Date.parse(String(toIso).slice(0, 10) + 'T12:00:00Z');
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round(((b - a) / 86400000 / 7) * 10) / 10;
  }

  function _levelOf(x) {
    var l = String(x || '').toLowerCase();
    if (/anfäng|anfaeng|einsteig|beginner/.test(l)) return 'beginner';
    if (/wettkampf|competitive|leistung/.test(l)) return 'competitive';
    if (/fortgeschr|intermediate|ambition|erfahren/.test(l)) return 'intermediate';
    return null;
  }

  /* ============================================================
     CACHE-SCHLÜSSEL — NUR ENTSCHEIDUNGSABHÄNGIGKEITEN

     Die erste Fassung hashte die gesamte globale Modul-Registry. Das war zu
     breit und in einer Hinsicht sogar falsch: Der Schlüssel hing davon ab, ob
     `session-debrief` oder `performance-zones` zum Zeitpunkt des Aufrufs schon
     geladen waren — Module, deren Verhalten dieses Ergebnis nicht beeinflussen
     kann. Folge wären vom Ladezeitpunkt abhängige Schlüssel, unnötige
     Cache-Misses und schwer reproduzierbare Ergebnisse gewesen.

     ENTHALTEN IST GENAU DAS, WAS DAS URTEIL TRAGEN KANN:
       · die eigene Modul- und Policy-Version
       · der Eingabe-Hash (Ziel, Datum, Leistung, Verfuegbarkeit, C2-Ergebnis)
       · die Evidenz-Version — sie entscheidet ueber `usability()` und damit
         darueber, ob ein Wert ueberhaupt steuern darf
       · die C2-Vertragsversion — TRANSITIV, denn Historie und Toleranz wirken
         ausschliesslich durch das C2-Ergebnis hierher
       · die Version des Leistungsmodells, aus dem der aktuelle Wert stammt

     DIE VERSIONEN KOMMEN AUS DEM EINGANG, NICHT AUS DER REGISTRY. Das ist der
     entscheidende Unterschied: Massgeblich ist die Version, die das uebergebene
     Ergebnis TATSAECHLICH erzeugt hat — nicht die, die zufaellig gerade im
     Speicher liegt. Damit ist der Schluessel unabhaengig von Ladereihenfolge
     und Aufrufzeitpunkt.

     DER UMFASSENDE RUNTIME-HASH BLEIBT — ABER IM DECISION LOG. Audit und Cache
     beantworten zwei verschiedene Fragen: „unter welchem Gesamtzustand ist das
     entstanden?" (Audit, so breit wie moeglich) gegen „darf ich dieses Urteil
     wiederverwenden?" (Cache, so eng wie zulaessig). Sie muessen deshalb nicht
     identisch sein. `auditHash()` weiter unten liefert die breite Variante.
     ============================================================ */
  function inputHash(input) {
    var i = input || {};
    var parts = {
      goal: i.goal || null,
      targetDate: i.targetDate || null,
      today: i.today || null,
      level: i.level || null,
      historyEvidence: i.historyEvidence || null,
      perf: i.currentPerformance ? {
        value: i.currentPerformance.value, metric: i.currentPerformance.metric,
        evidence: i.currentPerformance.evidence, measuredAt: i.currentPerformance.measuredAt,
        ageRatio: i.currentPerformance.ageRatio, direction: i.currentPerformance.direction,
        /* @4: ALLE entscheidungsrelevanten Felder — Band, Modellherkunft und
           Distanzverhaeltnis aendern das Urteil und MUESSEN den Schluessel
           aendern (zwei verschiedene Baender trugen denselben Cache-Key). */
        band: i.currentPerformance.band || null,
        modelBasis: i.currentPerformance.modelBasis || null,
        distanceRatio: i.currentPerformance.distanceRatio != null ? i.currentPerformance.distanceRatio : null,
        modelVersion: i.currentPerformance.modelVersion || null
      } : null,
      availability: i.availability || null,
      weeksLeft: i.weeksLeft != null ? i.weeksLeft : null,
      /* Vom C2-Ergebnis geht nur ein, was hier gelesen wird — sonst erzwaenge
         eine fuer uns folgenlose Aenderung (etwa ein umformulierter
         `rationale`-Text) eine Neuberechnung. */
      prog: i.allowableProgression ? {
        range: i.allowableProgression.allowableRange,
        selected: i.allowableProgression.selectedDelta,
        actionable: i.allowableProgression.actionable,
        autoApplicable: i.allowableProgression.autoApplicable,
        target: i.allowableProgression.targetLoad,
        evidence: i.allowableProgression.evidence
      } : null
    };
    return _hash(_stable(parts));
  }

  /* Version einer Abhaengigkeit: aus dem Eingang, sonst ausdruecklich `absent`.
     Ein fehlender Vertrag ist ein eigener Zustand — nicht dasselbe wie ein
     vorhandener, und niemals stillschweigend „egal". */
  function _dep(x) { return (typeof x === 'string' && x) ? x : 'absent'; }

  function cacheKey(input) {
    var i = input || {};
    var prog = i.allowableProgression || null;
    var perf = i.currentPerformance || null;
    var parts = {
      goalFeasibilityVersion: VERSION,
      feasibilityPolicyVersion: POLICY_VERSION,
      inputHash: inputHash(i),
      /* Die Evidenz-Version wird ausnahmsweise auch aus dem Modul gelesen, wenn
         sie nicht am Eingang steht: `usability()` laeuft hier unmittelbar, das
         Modul ist also eine echte direkte Abhaengigkeit — kein Registry-Zufall. */
      evidenceVersion: _dep(i.evidenceVersion || (EV && EV.VERSION)),
      progressionContractVersion: _dep(prog && prog.version) + '/' + _dep(prog && prog.policyVersion),
      performanceModelVersion: _dep(perf && (perf.modelVersion || perf.sourceVersion))
    };
    return { key: _hash(_stable(parts)), parts: parts };
  }

  /* ============================================================
     AUDIT-HASH — BEWUSST BREITER ALS DER CACHE-SCHLUESSEL

     Fuers Decision Log, nicht fuer die Wiederverwendung. Hier ist die
     Ladereihenfolge kein Stoerfaktor, sondern Teil der Auskunft: Er soll
     festhalten, unter welchem Gesamtzustand das Urteil entstanden ist — auch
     wenn ein Modul gar nicht geladen war.
     ============================================================ */
  var AUDIT_MODULES = ['progression', 'loadHistory', 'sessionDebrief', 'evidence',
    'performanceZones', 'performanceResolver', 'loadProfile'];
  function auditHash(input, registry) {
    var R = registry || O;
    function v(m, f) { try { return (R[m] && R[m][f]) || 'absent'; } catch (e) { return 'absent'; } }
    var versions = { self: VERSION, selfPolicy: POLICY_VERSION };
    for (var n = 0; n < AUDIT_MODULES.length; n++) {
      versions[AUDIT_MODULES[n]] = v(AUDIT_MODULES[n], 'VERSION');
      versions[AUDIT_MODULES[n] + 'Policy'] = v(AUDIT_MODULES[n], 'POLICY_VERSION');
    }
    var parts = { inputHash: inputHash(input), cacheKey: cacheKey(input).key, versions: versions };
    return { key: _hash(_stable(parts)), parts: parts };
  }

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

  /* ============================================================
     HAUPTFUNKTION
     ============================================================ */
  /* WICHTIG: `feasibility()` nimmt KEINE Registry mehr. Sein Ergebnis haengt
     ausschliesslich vom Eingang ab — damit ist es bei gleichen Eingaben und
     gleichen Vertragsversionen reproduzierbar, unabhaengig davon, was sonst
     geladen ist. Wer den breiten Zustand fuers Decision Log braucht, ruft
     `auditHash(input, registry)` getrennt auf. */
  function feasibility(input) {
    var i = input || {};
    var rationale = [];
    var limiting = [];

    function out(status, extra) {
      var o = {
        status: status, version: VERSION, policyVersion: POLICY_VERSION,
        requiredTrajectory: (extra && extra.required) || null,
        achievableTrajectory: (extra && extra.achievable) || null,
        gap: (extra && extra.gap) || null,
        limitingFactors: limiting,
        evidence: (extra && extra.evidence) || 'unknown',
        actionable: !!(extra && extra.actionable),
        goalMode: (extra && extra.goalMode) || null,
        estimatedWeeksRange: (extra && extra.estimatedWeeksRange) != null ? extra.estimatedWeeksRange : null,
        modelNote: 'Bewertet wird, was das heutige Modell trägt — nicht biologische Gewissheit.',
        rationale: rationale,
        cacheKey: (extra && extra.cacheKey) || null
      };
      return o;
    }

    var ck = cacheKey(i);

    /* ---- 1. OHNE BELASTBARE AKTUELLE LEISTUNG: insufficient_data ----
       Ein Ziel ohne Ausgangspunkt ist keine Lücke, sondern eine offene Frage. */
    var perf = i.currentPerformance || null;
    var perfUsable = !!(perf && perf.value > 0 && EV && EV.isLevel(perf.evidence) && perf.evidence !== 'unknown');
    if (!perfUsable) {
      limiting.push('current_performance');
      rationale.push('Ohne belastbaren aktuellen Leistungswert gibt es keinen Ausgangspunkt — die Frage bleibt offen, statt geschätzt zu werden.');
      return out('insufficient_data', { evidence: 'unknown', cacheKey: ck.key });
    }
    /* „HAT BELEG" IST NICHT „DARF STEUERN" — dieselbe Regel wie überall, und
       ohne Ausnahme für fehlende Datumsangaben. Ein Leistungswert ohne Datum
       ist nach dem Evidenzvertrag `informational`: anzeigen ja, entscheiden
       nein. Hier eine Ausnahme zu machen, wäre die Hintertür, durch die ein
       undatierter Altwert eine Machbarkeitsaussage trägt. */
    var use = EV.usability({ evidence: perf.evidence, ageRatio: perf.ageRatio == null ? null : perf.ageRatio });
    if (use.usability !== 'decision_eligible') {
      limiting.push('current_performance_not_decision_eligible');
      rationale.push('Der Leistungswert ist vorhanden, aber nicht entscheidungsfähig (' + use.usability + '/' + use.reason + ').');
      return out('insufficient_data', { evidence: perf.evidence, cacheKey: ck.key });
    }

    /* ---- 2. ZIEL UND ZEITRAUM ---- */
    var goalValue = i.goal && i.goal.targetValue > 0 ? i.goal.targetValue : null;
    if (!goalValue) {
      limiting.push('goal');
      rationale.push('Kein bezifferter Zielwert hinterlegt.');
      return out('insufficient_data', { evidence: 'unknown', cacheKey: ck.key });
    }

    /* FIXES DATUM UND FLEXIBLES ZIEL WERDEN UNTERSCHIEDLICH BEHANDELT.
       Beim fixen Wettkampfdatum ist die Zeit die harte Grenze — die Frage
       lautet „reicht es?". Beim flexiblen Ziel lautet sie „wann?", und ein
       Ergebnis außerhalb des Korridors ist dort kein Scheitern, sondern eine
       Terminverschiebung. */
    var goalMode = i.targetDate ? 'fixed_date' : 'flexible';
    var weeks = i.weeksLeft != null ? i.weeksLeft
      : (i.targetDate && i.today ? _weeksBetween(i.today, i.targetDate) : null);
    if (goalMode === 'fixed_date' && (weeks == null || weeks <= 0)) {
      limiting.push('time');
      rationale.push('Das Zieldatum liegt nicht in der Zukunft oder ist unlesbar.');
      return out('insufficient_data', { evidence: 'unknown', goalMode: goalMode, cacheKey: ck.key });
    }

    /* ---- 3. BEDARF IM LEISTUNGSRAUM ----
       Kein Lastprozent. Die Übersetzung Leistung → Last ist der Ort, an dem
       Scheingenauigkeit entsteht. */
    var metric = perf.metric || (i.goal && i.goal.metricType) || null;
    var direction = directionOf(i.goal, perf);
    if (!direction) {
      limiting.push('metric_direction_unknown');
      rationale.push('Für die Metrik "' + (metric == null ? '—' : metric) +
        '" ist nicht hinterlegt, ob ein kleinerer oder größerer Wert besser ist. ' +
        'Ein geratenes Vorzeichen würde die Aussage still umkehren — deshalb keine Bewertung.');
      return out('insufficient_data', { evidence: perf.evidence, goalMode: goalMode, cacheKey: ck.key });
    }
    /* @4: DIE KONSERVATIVE BANDKANTE GILT FUER JEDE BEDARFSRECHNUNG —
       nicht nur fuer den „Ziel bereits erreicht"-Kurzpfad. Ein Punktwert,
       der noch Verbesserung braucht, darf den Bedarf nicht schoenrechnen,
       waehrend die Kante ausserhalb des Korridors laege. */
    var consValue = perf.value;
    if (perf.band && perf.band.min > 0 && perf.band.max > 0) {
      consValue = direction === 'lower' ? perf.band.max : perf.band.min;
    }
    var requiredPct = direction === 'lower'
      ? (consValue - goalValue) / consValue * 100
      : (goalValue - consValue) / consValue * 100;
    requiredPct = _r2(requiredPct);

    var blocks = (weeks != null && weeks > 0) ? weeks / BLOCK_WEEKS : null;
    var requiredPerBlock = (blocks != null && blocks > 0) ? _r2(requiredPct / blocks) : null;

    var required = {
      metric: metric, direction: direction, from: consValue, to: goalValue,
      pointValue: perf.value,
      conservativeEdge: consValue !== perf.value ? true : undefined,
      totalPct: requiredPct,
      pctPerBlock: requiredPerBlock,
      blockWeeks: BLOCK_WEEKS,
      weeksAvailable: weeks,
      note: 'Beschrieben im Leistungsraum, nicht in Trainingslast.'
    };

    /* Das Ziel ist bereits erreicht oder verlangt keine Verbesserung —
       requiredPct ist seit @4 IMMER ab der konservativen Kante gerechnet,
       der Kurzpfad braucht keine eigene Bandlogik mehr. */
    if (requiredPct <= 0) {
      rationale.push(consValue === perf.value
        ? 'Der aktuelle Leistungswert erfüllt das Ziel bereits.'
        : 'Auch die konservative Kante des Unsicherheitsbands erfüllt das Ziel bereits.');
      var evShort = perf.modelBasis === 'riegel_extrapolation'
        ? (perf.evidence === 'strong' ? 'moderate' : perf.evidence)
        : perf.evidence;
      return out('within_modeled_corridor', {
        required: required, achievable: null, gap: { value: 0, unit: 'pct_per_block', uncertainty: null },
        evidence: evShort, actionable: true, goalMode: goalMode, cacheKey: ck.key,
        conservativeValue: consValue
      });
    }

    /* ---- 4. ERREICHBARE ENTWICKLUNG — BAND, KEINE PUNKTPROGNOSE ---- */
    var level = _levelOf(i.level || (i.goal && i.goal.level));
    if (!level) {
      limiting.push('level_unknown');
      rationale.push('Ohne Leistungsniveau lässt sich keine Änderungsrate einordnen — es wird keine angenommen.');
      return out('insufficient_data', { required: required, evidence: 'unknown', goalMode: goalMode, cacheKey: ck.key });
    }
    var base = IMPROVEMENT_PER_BLOCK[level];

    var prog = i.allowableProgression || null;
    var corridorMax = (prog && prog.allowableRange && prog.allowableRange.max != null)
      ? prog.allowableRange.max : null;
    /* Die Raten setzen normales progressives Training voraus. Verbietet der
       Korridor den Aufbau, fällt die erreichbare Entwicklung Richtung Erhaltung. */
    var factor = corridorMax == null ? null
      : Math.max(0, Math.min(1, corridorMax / REFERENCE_BUILD_PCT));
    /* ============================================================
       DAS BAND TRAEGT SEINEN MODELLSTATUS MIT

       C2 liefert ZULAESSIGE LAST. Daraus folgt ohne individuelles Response
       Model KEINE vorhersagbare Leistungsverbesserung — die Abbildung Last →
       Leistung ist genau die Scheingenauigkeit, die dieses Modul vermeiden
       soll. Ohne Kennzeichnung koennte die saubere Aussage
       `within_modeled_corridor` intern trotzdem auf einer solchen Abbildung
       beruhen, ohne dass es irgendwo sichtbar waere.

       Deshalb steht der Modellstatus im Ergebnis, nicht nur im Kommentar:
         model: 'population_prior'  — Gruppenerfahrungswerte, kein Personenmodell
         individualized: false      — es existiert KEIN individuelles Response
                                      Model; das Feld ist der Platz, an dem ein
                                      spaeteres eines sichtbar wuerde
         provenance                 — welcher Bestandteil woher stammt und mit
                                      welchem Belegtyp: [S] Erfahrungswert,
                                      [A] Modellannahme
       ============================================================ */
    var achievable = {
      level: level,
      range: {
        min: factor == null ? base.min : _r1(base.min * factor),
        max: factor == null ? base.max : _r1(base.max * factor),
        unit: 'pct_per_block'
      },
      blockWeeks: BLOCK_WEEKS,
      model: 'population_prior',
      individualized: false,
      /* Evidenz DES BANDES SELBST — nicht die der Eingaenge. Erfahrungswerte
         einer Gruppe sind fuer eine Einzelperson hoechstens schwach belegt. */
      evidence: 'weak',
      provenance: {
        rates: { source: 'documented_change_rates', level: level, grade: 'S',
          detail: 'Groessenordnungen je 12-Wochen-Block aus Literatur und Praxis, keine Messgroessen.' },
        corridorScaling: { source: 'model_assumption', grade: 'A',
          factor: factor == null ? null : _r2(factor),
          referenceBuildPct: REFERENCE_BUILD_PCT,
          detail: 'Lineare Skalierung des Bandes mit dem zulaessigen Trainingskorridor. ' +
            'C2 liefert zulaessige LAST; die Abbildung auf Leistung ist eine Annahme, ' +
            'kein individuelles Response Model.' }
      },
      note: 'Modelliertes Band aus Gruppenerfahrungswerten, skaliert mit dem zulaessigen ' +
        'Trainingskorridor — keine Punktprognose und keine individuelle Vorhersage.'
    };
    /* Kurzformen fuer Anzeige und Vergleich. Sie sind ABGELEITET aus `range`,
       damit nicht zwei Wahrheiten nebeneinander stehen koennen. */
    achievable.min = achievable.range.min;
    achievable.max = achievable.range.max;
    if (factor === 0) {
      limiting.push('progression_blocked');
      rationale.push('Der zulässige Trainingskorridor lässt derzeit keinen Aufbau zu — modellierbar ist damit nur Erhaltung.');
    }

    /* ---- 5. EVIDENZ: nie stärker als der schwächste entscheidende Eingang ---- */
    var parts = [perf.evidence];
    if (prog && prog.evidence) parts.push(prog.evidence);
    if (i.historyEvidence) parts.push(i.historyEvidence);
    /* Die Änderungsraten selbst sind Schätzungen — sie deckeln die Aussage. */
    parts.push('weak');
    var evidence = EV ? EV.weakest(parts) : 'weak';

    /* ---- 6. LÜCKE MIT UNSICHERHEIT ---- */
    var gap = null;
    if (requiredPerBlock != null) {
      gap = {
        value: _r2(requiredPerBlock - achievable.max),
        unit: 'pct_per_block',
        /* Die Bandbreite der erreichbaren Rate IST die Unsicherheit — sie wird
           nicht zu einer Zahl verdichtet. */
        uncertainty: { lower: _r2(requiredPerBlock - achievable.max), upper: _r2(requiredPerBlock - achievable.min) },
        note: 'Positiv = der Bedarf übersteigt die modellierte Entwicklung.'
      };
    }

    /* ---- 7. FLEXIBLES ZIEL: „wann", nicht „ob" ----
       NAME UND INHALT MUESSEN ZUSAMMENPASSEN. `earliestWeeks` hiess „frueheste
       Wochen" und enthielt zugleich eine SPAETESTE Grenze — ein Feldname, der
       seinem Inhalt widerspricht, wird frueher oder spaeter falsch gelesen.
       `estimatedWeeksRange` sagt beides: geschaetzt und eine Spanne.

       KEINE DIVISION, DIE EIN ERGEBNIS ERZWINGT. Ist die modellierte Rate 0
       oder negativ, gibt es kein Zeitfenster — dann steht dort `null` bzw. eine
       offene obere Grenze, nicht „unendlich" und kein durch Division
       herbeigerechneter Wert. */
    var weeksRange = null;
    if (goalMode === 'flexible') {
      if (!(achievable.max > 0)) {
        /* Ohne modellierten Fortschritt gibt es keinen Zeitpunkt, den man
           schaetzen koennte. Das ist eine Aussage, keine Luecke. */
        weeksRange = null;
        rationale.push('Ohne modellierten Fortschritt laesst sich kein Zeitfenster angeben.');
      } else {
        var fastest = _r1(requiredPct / achievable.max * BLOCK_WEEKS);
        var slowest = achievable.min > 0 ? _r1(requiredPct / achievable.min * BLOCK_WEEKS) : null;
        weeksRange = {
          min: fastest,               /* wenigste Wochen = obere Kante der Rate */
          max: slowest,               /* meiste Wochen  = untere Kante der Rate */
          open: slowest == null,      /* untere Kante 0 ⇒ nach oben offen */
          unit: 'weeks',
          model: 'population_prior', individualized: false,
          note: 'Geschaetzte Spanne aus der modellierten Aenderungsrate, keine Terminzusage.'
        };
        rationale.push('Flexibles Ziel: Bei der modellierten Entwicklung waeren dafuer etwa ' + fastest +
          (slowest != null ? ' bis ' + slowest + ' Wochen noetig.' : ' Wochen oder deutlich mehr noetig.'));
      }
    }

    /* ---- 8. STATUS ----
       OHNE FREIGABE DER PROGRESSION KEINE POSITIVE AUSSAGE. Wenn C2 seine
       eigene Empfehlung nicht freigibt, kann hier keine Erreichbarkeit
       behauptet werden — sonst käme `provisionalTargetLoad` durch die
       Hintertür doch noch zu einer Aussage. */
    var progReleased = !prog ? false
      : (prog.autoApplicable === true && prog.targetLoad != null) || prog.actionable === true;

    var within = (goalMode === 'flexible')
      ? (achievable.max > 0)
      : (requiredPerBlock != null && requiredPerBlock <= achievable.max);

    if (within && !progReleased) {
      limiting.push('progression_not_actionable');
      rationale.push('Der Bedarf läge im modellierten Bereich, aber die Progression ist nicht freigegeben — daraus lässt sich keine Erreichbarkeit ableiten.');
      return out('insufficient_data', {
        required: required, achievable: achievable, gap: gap,
        evidence: evidence, actionable: false, goalMode: goalMode,
        estimatedWeeksRange: weeksRange, cacheKey: ck.key
      });
    }

    if (within) {
      rationale.push('Der Bedarf von ' + requiredPerBlock + ' % je Block liegt im modellierten Bereich von ' +
        achievable.min + ' bis ' + achievable.max + ' %.');
      return out('within_modeled_corridor', {
        required: required, achievable: achievable, gap: gap,
        evidence: evidence, actionable: true, goalMode: goalMode,
        estimatedWeeksRange: weeksRange, cacheKey: ck.key
      });
    }

    limiting.push('required_above_modeled_rate');
    rationale.push('Der Bedarf von ' + requiredPerBlock + ' % je Block liegt über dem modellierten Bereich von ' +
      achievable.min + ' bis ' + achievable.max + ' %.');
    rationale.push(goalMode === 'fixed_date'
      ? 'Bei festem Datum bleiben zwei Wege: das Ziel anpassen oder den Termin verschieben.'
      : 'Bei flexiblem Ziel ist das keine Absage, sondern ein längerer Zeitraum.');
    return out('outside_modeled_corridor', {
      required: required, achievable: achievable, gap: gap,
      evidence: evidence, actionable: false, goalMode: goalMode,
      estimatedWeeksRange: weeksRange, cacheKey: ck.key
    });
  }

  var api = {
    VERSION: VERSION, POLICY_VERSION: POLICY_VERSION,
    STATUS: STATUS, IMPROVEMENT_PER_BLOCK: IMPROVEMENT_PER_BLOCK,
    BLOCK_WEEKS: BLOCK_WEEKS, REFERENCE_BUILD_PCT: REFERENCE_BUILD_PCT,
    METRIC_DIRECTION: METRIC_DIRECTION, directionOf: directionOf,
    feasibility: feasibility, cacheKey: cacheKey, inputHash: inputHash, auditHash: auditHash,
    AUDIT_MODULES: AUDIT_MODULES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.goalFeasibility = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
