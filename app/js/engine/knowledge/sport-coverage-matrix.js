/* ============================================================
   ORVIA · sport-coverage-matrix v2 (Batch 3b.0a) — Reifegrad der
   Wissensbasis je Sportart auf Basis des REALEN Produktkatalogs.

   Korrektur v1 → v2: Kanonischer Produktkatalog ist der Onboarding-
   Katalog (onboarding-sports-logic SPORT_CATALOG, 24 Einträge) — NICHT
   trainingDomain.ACTIVITY_SPORTS (16, Activity-Tracking-Sicht). Beide
   Sichten werden GETRENNT geführt (onboardingSelectable vs.
   activityTrackingSupported); Tests erzwingen Deckungsgleichheit mit
   dem echten Code. profileSchema ist aus den tatsächlichen
   sportartspezifischen Folgefrage-Schemata abgeleitet
   (profileModel.sportFollowupSchema); positionRoleModel aus
   trainingDomain.POSITIONS; catalogPlanningFlag aus dem Katalog.
   plannerSupport ist überall false (es existiert noch kein Scheduler).
   KEINE Sportart ist produktionsreif oder fachlich geprüft.

   Korrektur v2 → v3 (Bestandsaufnahme 2026-08-13): Gym hat seit v8-339 ein
   Wissenspaket, die Matrix führte es weiter als paketlos. Der Irrtum blieb
   unbemerkt, weil die Zusicherung im Test nur ZÄHLTE („genau eine Sportart
   mit Paket") statt gegen die vorhandenen Module zu vergleichen — ein
   Zähler prüft nichts, er schreibt den Stand des Tages fest.

   Mit der Korrektur kam die zweite Hälfte der Wahrheit dazu: ein Paket zu
   BESITZEN und im Produktivweg GELESEN zu werden ist nicht dasselbe. Das
   Laufpaket wird von keinem Aufrufer erreicht (running-capacity-factory hat
   keinen produktiven Aufrufer), das Gym-Paket schon. Ohne die getrennte
   Dimension würde diese Matrix ab jetzt genau den falschen Eindruck
   erzeugen, den sie eigentlich verhindern soll.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var COVERAGE_VERSION = 3;

  var DIMENSIONS = ['onboardingSelectable', 'activityTrackingSupported', 'profileSchema', 'positionRoleModel',
    'knowledgePack', 'knowledgePackWired', 'plannerSupport', 'exerciseLibrary', 'safetyReview', 'productionStatus'];

  function entry(over) {
    return Object.assign({
      onboardingSelectable: true,
      activityTrackingSupported: false,   // nur wenn in trainingDomain.ACTIVITY_SPORTS (testerzwungen)
      profileSchema: false,               // = sportFollowupSchema(id) existiert (testerzwungen)
      positionRoleModel: false,           // = trainingDomain.POSITIONS[id] existiert (testerzwungen)
      knowledgePack: false,               // = ein *-knowledge-pack.js existiert (testerzwungen)
      knowledgePackWired: false,          // = knowledgeConsumer holt es wirklich (testerzwungen)
      plannerSupport: false,              // es existiert noch KEIN Scheduler (Batch 4)
      exerciseLibrary: false,
      safetyReview: false,
      productionStatus: 'none',
      catalogPlanningFlag: true           // planningSupported im Onboarding-Katalog (testerzwungen)
    }, over);
  }

  var COVERAGE = {
    /* running: 14 handgepflegte Regeln, technisch geprüft, wissenschaftlich
       ungeprüft — und im Produktivweg von niemandem gelesen. */
    running: entry({ activityTrackingSupported: true, profileSchema: true, knowledgePack: true,
      knowledgePackWired: false, knowledgePackStatus: 'technically_reviewed_scientifically_unreviewed' }),
    /* gym: 4 Regeln aus einer Übersichtsarbeit (2007), eingespeist in v8-339,
       seit v8-341 die einzige Sportart, deren Wissen die Verordnung erreicht. */
    gym: entry({ activityTrackingSupported: true, profileSchema: true, exerciseLibrary: true, knowledgePack: true,
      knowledgePackWired: true, knowledgePackStatus: 'technically_reviewed_scientifically_unreviewed' }),
    cycling: entry({ activityTrackingSupported: true }),
    swimming: entry({ activityTrackingSupported: true }),
    football: entry({ activityTrackingSupported: true, profileSchema: true, positionRoleModel: true }),
    handball: entry({ activityTrackingSupported: true, profileSchema: true, positionRoleModel: true }),
    tennis: entry({ activityTrackingSupported: true }),
    padel: entry({ activityTrackingSupported: true }),
    basketball: entry({ activityTrackingSupported: true, profileSchema: true }),
    rowing: entry({ activityTrackingSupported: true }),
    triathlon: entry({ activityTrackingSupported: true, profileSchema: true }),
    athletics: entry({ activityTrackingSupported: true }),
    volleyball: entry({}),
    hockey: entry({}),
    rugby: entry({}),
    badminton: entry({}),
    golf: entry({}),
    hiking: entry({ activityTrackingSupported: true }),
    walking: entry({ activityTrackingSupported: true }),
    climbing: entry({}),
    yoga: entry({}),
    /* mobility ist auswählbarer Produkteintrag UND fachlich als MODALITÄT
       klassifiziert (ergänzende Bewegungsform, kein eigenständiger
       Wettkampfsport im Zielmodell). */
    mobility: entry({ activityTrackingSupported: true, modalityClassification: true }),
    hyrox: entry({}),
    other: entry({ activityTrackingSupported: true, catalogPlanningFlag: false })
  };

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }

  O.sportCoverageMatrix = _freeze({
    COVERAGE_VERSION: COVERAGE_VERSION,
    DIMENSIONS: DIMENSIONS,
    COVERAGE: COVERAGE
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.sportCoverageMatrix;
})(typeof globalThis !== 'undefined' ? globalThis : this);
