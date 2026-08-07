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
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var COVERAGE_VERSION = 2;

  var DIMENSIONS = ['onboardingSelectable', 'activityTrackingSupported', 'profileSchema', 'positionRoleModel',
    'knowledgePack', 'plannerSupport', 'exerciseLibrary', 'safetyReview', 'productionStatus'];

  function entry(over) {
    return Object.assign({
      onboardingSelectable: true,
      activityTrackingSupported: false,   // nur wenn in trainingDomain.ACTIVITY_SPORTS (testerzwungen)
      profileSchema: false,               // = sportFollowupSchema(id) existiert (testerzwungen)
      positionRoleModel: false,           // = trainingDomain.POSITIONS[id] existiert (testerzwungen)
      knowledgePack: false,
      plannerSupport: false,              // es existiert noch KEIN Scheduler (Batch 4)
      exerciseLibrary: false,
      safetyReview: false,
      productionStatus: 'none',
      catalogPlanningFlag: true           // planningSupported im Onboarding-Katalog (testerzwungen)
    }, over);
  }

  var COVERAGE = {
    running: entry({ activityTrackingSupported: true, profileSchema: true, knowledgePack: true, knowledgePackStatus: 'technically_reviewed_scientifically_unreviewed' }),
    gym: entry({ activityTrackingSupported: true, profileSchema: true, exerciseLibrary: true }),
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
