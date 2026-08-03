/* ============================================================
   ORVIA · knowledge-sources — Quellenregister v2 (Batch 3b.0b).

   Öffentlicher Vertrag ist der VERSIONIERTE Registervertrag
   { registryVersion, sources, contentHash } — kein loses Array mehr.
   registryVersion 2, weil gegenüber v1 Collins 2018 ergänzt und
   Inhalte (Nielsen/Damsted/Crossley/Seiler/Haugen-Zusammenfassungen)
   korrigiert wurden. Der contentHash (registryContentHash, FNV-1a über
   registryVersion + sources) deckt sämtliche entscheidungsrelevanten
   Felder ab: jede Änderung von Summary, Source-Type, Appraisal,
   Population, Limits oder Identifikator unter derselben Source-ID
   ändert den Hash und blockiert die Auswahl, bis der Consumer
   ausdrücklich auf die neue Registerversion + den neuen Hash pinnt.

   3b.0b: quellenbezogene Appraisal-Autorität liegt ZENTRAL hier
   (studyDesign, methodQuality, riskOfBias — ehrlich
   'not_formally_assessed', da kein formales RoB-Verfahren — sowie
   populations und outcomes). Claims dürfen diese Felder nicht führen.
   Zusammenfassungen sind eigene Paraphrasen; keine erfundenen Quellen.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var REGISTRY_VERSION = 2;
  var CHECKED = '2026-07-19';

  var SOURCE_REGISTRY = [
    {
      sourceId: 'SRC-IOC-LOAD-2016', title: 'How much is too much? (Part 1) IOC consensus statement on load in sport and risk of injury',
      authorsOrOrg: 'Soligard T, Schwellnus M, Alonso JM, Bahr R, Clarsen B, Dijkstra HP, et al. (IOC)', year: 2016,
      sourceType: 'consensus_statement', identifier: { doi: '10.1136/bjsports-2016-096581', pmid: '27535989', url: 'https://pubmed.ncbi.nlm.nih.gov/27535989/' },
      sports: ['any'], populations: ['athletes_all_levels'],
      outcomes: ['injury_risk', 'illness_risk'],
      appraisal: { studyDesign: 'consensus_statement', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Schnelle Lastspitzen und große Abweichungen von der gewohnten Belastung erhöhen das Verletzungs-/Krankheitsrisiko; Belastung sollte graduell, individuell und unter Berücksichtigung interner wie externer Last gesteuert werden; Monitoring und ausreichende Erholung sind zentrale Schutzfaktoren.',
      limitsAndTransferability: 'Konsens über viele Sportarten; keine sportartspezifischen Grenzwerte für Freizeit-Läufer ableitbar — Richtungsaussage, kein Zahlengesetz.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-NIELSEN-2014', title: 'Excessive Progression in Weekly Running Distance and Risk of Running-Related Injuries',
      authorsOrOrg: 'Nielsen RØ, Parner ET, Nohr EA, Sørensen H, Lind M, Rasmussen S', year: 2014,
      sourceType: 'cohort_study', identifier: { doi: '10.2519/jospt.2014.5164', pmid: '25155475', url: 'https://www.jospt.org/doi/10.2519/jospt.2014.5164' },
      sports: ['running'], populations: ['novice_runners'],
      outcomes: ['running_related_injury_by_type'],
      appraisal: { studyDesign: 'prospective_cohort', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Bei Laufanfängern fand der HAUPTVERGLEICH der Progressionsgruppen KEINE statistisch signifikanten Unterschiede in der Gesamtverletzungsrate; nur eine Subgruppenanalyse deutete auf ein erhöhtes Risiko distanzassoziierter Verletzungen bei Steigerung über ~30 % hin — dieser Befund war statistisch unsicher (p = .07). Die Studie trägt also ein RICHTUNGSSIGNAL, keinen belegten Schwellenwert.',
      limitsAndTransferability: 'Beobachtungsstudie an Anfängern; Hauptvergleich nicht signifikant, Subgruppenbefund unsicher — jede Engine-Wirkung muss diese Unsicherheit sichtbar tragen; nicht auf erfahrene Läufer übertragbar.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-BUIST-2008', title: 'No Effect of a Graded Training Program on the Number of Running-Related Injuries in Novice Runners (GRONORUN RCT)',
      authorsOrOrg: 'Buist I, Bredeweg SW, van Mechelen W, Lemmink KAPM, Pepping GJ, Diercks RL', year: 2008,
      sourceType: 'rct', identifier: { doi: '10.1177/0363546507307505', pmid: '17940147', url: 'https://pubmed.ncbi.nlm.nih.gov/17940147/' },
      sports: ['running'], populations: ['novice_runners'],
      outcomes: ['running_related_injuries'],
      appraisal: { studyDesign: 'rct', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Ein an der 10-Prozent-Regel orientiertes, graduiertes Aufbauprogramm senkte die Verletzungsrate bei Laufanfängern NICHT gegenüber einem schnelleren Standardaufbau — direkte experimentelle Evidenz gegen die 10-Prozent-Regel als universelles Schutzgesetz.',
      limitsAndTransferability: 'Anfängerpopulation, ein Programmvergleich; widerlegt nicht den Nutzen gradueller Progression generell, sondern die Universalität der festen Prozentgrenze.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-DAMSTED-2019', title: 'The Association Between Changes in Weekly Running Distance and Running-Related Injury: Preparing for a Half Marathon',
      authorsOrOrg: 'Damsted C, Parner ET, Sørensen H, Malisoux L, Hulme A, Nielsen RØ', year: 2019,
      sourceType: 'cohort_study', identifier: { doi: '10.2519/jospt.2019.8541', pmid: '30526231', url: 'https://pubmed.ncbi.nlm.nih.gov/30526231/' },
      sports: ['running'], populations: ['recreational_half_marathon_preparation'],
      outcomes: ['running_related_injury'],
      appraisal: { studyDesign: 'prospective_cohort', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'In der Halbmarathonvorbereitung zeigte sich ein signifikanter Zusammenhang zwischen sprunghafter Wochendistanz-Änderung und Verletzungsrisiko nur ZEITLICH BEGRENZT (frühe Beobachtungsphase); in der späteren Phase war der Befund NICHT mehr signifikant. Die Kohorte trägt damit ein zeitlich instabiles Risikosignal, keinen stabilen Prädiktor.',
      limitsAndTransferability: 'Beobachtungsdaten, Selbstauskunft, zeitlich instabiler Effekt — als unsicheres Kontextsignal nutzbar, nie als Verordnungsgrenze.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-FOSTER-2001', title: 'A New Approach to Monitoring Exercise Training (Session-RPE)',
      authorsOrOrg: 'Foster C, Florhaug JA, Franklin J, Gottschall L, Hrovatin LA, Parker S, et al.', year: 2001,
      sourceType: 'primary_study', identifier: { pmid: '11708692', url: 'https://pubmed.ncbi.nlm.nih.gov/11708692/' },
      sports: ['any'], populations: ['trained_adults'],
      outcomes: ['internal_training_load_validity'],
      appraisal: { studyDesign: 'validation_study', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Session-RPE (RPE × Dauer) ist ein valides, praxistaugliches Maß der internen Trainingslast und korreliert mit HF-basierten Lastmaßen — Grundlage des ORVIA-sRPE-Lastmodells (srpe_au).',
      limitsAndTransferability: 'Subjektives Maß; Tagesform/Kontext beeinflussen RPE; für Vergleichbarkeit konsistente Erhebung nötig.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-SEILER-2010', title: 'What is Best Practice for Training Intensity and Duration Distribution in Endurance Athletes?',
      authorsOrOrg: 'Seiler S', year: 2010,
      sourceType: 'narrative_review', identifier: { pmid: '20861519', url: 'https://journals.humankinetics.com/view/journals/ijspp/5/3/article-p276.xml' },
      sports: ['running', 'cycling', 'swimming', 'triathlon', 'rowing'], populations: ['well_trained_and_elite_endurance_athletes'],
      outcomes: ['observed_training_intensity_distribution'],
      appraisal: { studyDesign: 'narrative_review', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'DESKRIPTIVE Synthese überwiegend gut trainierter bis Elite-Ausdauerathleten: beobachtete Trainingspraxis verteilt Intensität stark asymmetrisch (Großteil niedrig-intensiv, kleiner harter Anteil); Easy-, Long-, Schwellen- und hochintensive Reize erscheinen als getrennte Belastungsdimensionen.',
      limitsAndTransferability: 'Beschreibt Leistungs-/Elitepraxis — validiert KEINE individuellen Intensitätsbudgets für Freizeitläufer; jede ORVIA-Anwendung auf Freizeitläufer ist eine getrennte Produktheuristik.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-IMPELLIZZERI-2020', title: 'Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls',
      authorsOrOrg: 'Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ', year: 2020,
      sourceType: 'narrative_review', identifier: { pmid: '32502973', url: 'https://journals.humankinetics.com/view/journals/ijspp/15/6/article-p907.xml' },
      sports: ['any'], populations: ['athletes_all_levels'],
      outcomes: ['acwr_model_validity'],
      appraisal: { studyDesign: 'methodological_review', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Der Acute:Chronic-Workload-Quotient hat konzeptionelle und methodische Schwächen (u. a. mathematische Kopplung, fehlende Kausalbasis) und taugt nicht als präziser universeller Verletzungsprädiktor — Quotienten sind Kontextsignal, kein Grenzwertgesetz.',
      limitsAndTransferability: 'Methodenkritik; entwertet nicht das Grundprinzip „plötzlich viel mehr als gewohnt ist riskant", sondern dessen naive Quantifizierung.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-VIDEBAEK-2015', title: 'Incidence of Running-Related Injuries Per 1000 h of Running in Different Types of Runners: Systematic Review and Meta-Analysis',
      authorsOrOrg: 'Videbæk S, Bueno AM, Nielsen RØ, Rasmussen S', year: 2015,
      sourceType: 'systematic_review', identifier: { doi: '10.1007/s40279-015-0333-8', url: 'https://link.springer.com/article/10.1007/s40279-015-0333-8' },
      sports: ['running'], populations: ['novice_runners', 'recreational_runners'],
      outcomes: ['injury_incidence_per_1000h'],
      appraisal: { studyDesign: 'systematic_review_meta_analysis', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Anfänger haben pro Laufstunde eine deutlich höhere Verletzungsinzidenz als erfahrene Freizeitläufer — Trainingshistorie/-erfahrung ist ein zentraler Moderator der Belastungsverträglichkeit.',
      limitsAndTransferability: 'Heterogene Verletzungsdefinitionen zwischen Studien; Größenordnungen, keine Individualprognose.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-BERTELSEN-2017', title: 'A framework for the etiology of running-related injuries',
      authorsOrOrg: 'Bertelsen ML, Hulme A, Petersen J, Brund RK, Sørensen H, Finch CF, Parner ET, Nielsen RØ', year: 2017,
      sourceType: 'narrative_review', identifier: { doi: '10.1111/sms.12883', pmid: '28329441', url: 'https://onlinelibrary.wiley.com/doi/10.1111/sms.12883' },
      sports: ['running'], populations: ['runners_all_levels'],
      outcomes: ['injury_etiology_model'],
      appraisal: { studyDesign: 'conceptual_framework', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Laufverletzungen entstehen, wenn die sessionbezogene Gewebebelastung die aktuelle, individuell variable Belastbarkeit übersteigt; Belastbarkeit ändert sich mit Historie, Erholung und Nicht-Lauf-Stressoren — theoretische Basis für kapazitätsbasierte statt regelbasierte Progression.',
      limitsAndTransferability: 'Konzeptmodell, keine quantitativen Grenzwerte.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-RACINAIS-2015', title: 'Consensus recommendations on training and competing in the heat',
      authorsOrOrg: 'Racinais S, Alonso JM, Coutts AJ, Flouris AD, Girard O, González-Alonso J, et al.', year: 2015,
      sourceType: 'consensus_statement', identifier: { pmid: '26069301', url: 'https://pubmed.ncbi.nlm.nih.gov/26069301/' },
      sports: ['any'], populations: ['athletes_all_levels'],
      outcomes: ['heat_performance_and_strain'],
      appraisal: { studyDesign: 'consensus_statement', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Hitze erhöht die physiologische Beanspruchung bei gleicher äußerer Leistung deutlich; Pace-/HF-Daten aus Hitzebedingungen sind mit Normalbedingungen nur eingeschränkt vergleichbar; Akklimatisierung und angepasste Intensität sind empfohlen.',
      limitsAndTransferability: 'Fokus Wettkampf/Hitze; Kälte/Wind nur teilweise abgedeckt.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-CROSSLEY-PFP-2016', title: '2016 Patellofemoral pain consensus statement (4th International PFP Research Retreat, Manchester), Part 1',
      authorsOrOrg: 'Crossley KM, Stefanik JJ, Selfe J, Collins NJ, Davis IS, Powers CM, et al.', year: 2016,
      sourceType: 'consensus_statement', identifier: { url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4975817/' },
      sports: ['running', 'any'], populations: ['patellofemoral_pain'],
      outcomes: ['pfp_terminology_and_natural_history'],
      appraisal: { studyDesign: 'consensus_statement', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Teil 1 des PFP-Konsensus behandelt Terminologie, Definitionen, klinische Untersuchung, natürlichen Verlauf, patellofemorale Arthrose und Outcome-Maße — u. a. dass patellofemoraler Schmerz typischerweise durch belastende Aktivitäten wie tiefe Beugung, Treppen und Laufen provoziert wird und häufig persistiert. Er enthält KEINE Interventions- oder Eskalationsempfehlungen (diese stehen in getrennten Konsensus-Dokumenten, siehe SRC-COLLINS-PFP-2018).',
      limitsAndTransferability: 'Nur für Charakterisierung/Belastungssensitivität des Beschwerdebilds zitierfähig — NICHT für Behandlungs- oder Red-Flag-Verträge; ORVIA stellt keine Diagnosen.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-COLLINS-PFP-2018', title: '2018 Consensus statement on exercise therapy and physical interventions for patellofemoral pain (5th International PFP Research Retreat)',
      authorsOrOrg: 'Collins NJ, Barton CJ, van Middelkoop M, Callaghan MJ, Rathleff MS, Vicenzino BT, et al.', year: 2018,
      sourceType: 'consensus_statement', identifier: { pmid: '29925502', url: 'https://pubmed.ncbi.nlm.nih.gov/29925502/' },
      sports: ['running', 'any'], populations: ['patellofemoral_pain'],
      outcomes: ['pain', 'function'],
      appraisal: { studyDesign: 'consensus_statement', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Konsensusempfehlungen zu Übungstherapie und physischen Interventionen bei patellofemoralem Schmerz: übungsbasierte Therapie (Hüft- + Knie-fokussiert) wird empfohlen — Interventionsrahmen, der belastungsmodifizierende statt pauschal stoppende Ansätze stützt.',
      limitsAndTransferability: 'Konsens zu Interventionen bei diagnostiziertem PFP; definiert KEINE ORVIA-Red-Flag-/Eskalationsliste — diese bleibt ungeprüfte Produkt-/Expertenregel bis zur fachlichen Prüfung.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-TANAKA-2001', title: 'Age-predicted maximal heart rate revisited',
      authorsOrOrg: 'Tanaka H, Monahan KD, Seals DR', year: 2001,
      sourceType: 'primary_study', identifier: { doi: '10.1016/S0735-1097(00)01054-8', pmid: '11153730', url: 'https://pubmed.ncbi.nlm.nih.gov/11153730/' },
      sports: ['any'], populations: ['healthy_adults'],
      outcomes: ['hrmax_prediction_error'],
      appraisal: { studyDesign: 'cross_sectional_meta_regression', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Altersformeln für die maximale Herzfrequenz (z. B. 208 − 0,7 × Alter) haben große individuelle Streuung — HF-Zonen aus Formel-HFmax sind Näherungen; gemessene Werte sind vorzuziehen.',
      limitsAndTransferability: 'Querschnittsdaten; individuelle HFmax kann deutlich abweichen ⇒ Confidence-relevante Unsicherheit jeder HF-Zonen-Ableitung.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-ACSM-2011', title: 'ACSM Position Stand: Quantity and Quality of Exercise for Developing and Maintaining Fitness in Apparently Healthy Adults',
      authorsOrOrg: 'Garber CE, Blissmer B, Deschenes MR, Franklin BA, Lamonte MJ, Lee IM, et al. (ACSM)', year: 2011,
      sourceType: 'position_stand', identifier: { doi: '10.1249/MSS.0b013e318213fefb', pmid: '21694556', url: 'https://pubmed.ncbi.nlm.nih.gov/21694556/' },
      sports: ['any'], populations: ['healthy_adults'],
      outcomes: ['fitness_dose_response_guidance'],
      appraisal: { studyDesign: 'position_stand', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'Leitlinienrahmen für Dosis-Wirkung von Ausdauer-/Kraft-/neuromotorischem Training bei gesunden Erwachsenen inkl. gradueller Progression als Standardempfehlung.',
      limitsAndTransferability: 'Gesundheits-/Fitnesspopulation, nicht wettkampfspezifisch.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-HAUGEN-2022', title: 'The Training Characteristics of World-Class Distance Runners: An Integration of Scientific Literature and Results-Proven Practice',
      authorsOrOrg: 'Haugen T, Sandbakk Ø, Seiler S, Tønnessen E', year: 2022,
      sourceType: 'narrative_review', identifier: { doi: '10.1186/s40798-022-00438-7', pmid: '35362850', url: 'https://link.springer.com/article/10.1186/s40798-022-00438-7' },
      sports: ['running'], populations: ['world_class_distance_runners'],
      outcomes: ['observed_training_characteristics'],
      appraisal: { studyDesign: 'narrative_review', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
      summary: 'DESKRIPTIVE Integration von Literatur und Trainingspraxis von WELTKLASSE-Distanzläufern: hoher Anteil niedriger Intensität, systematische Long Runs, periodisierte Schwellen-/Intervallarbeit, langfristige graduelle Volumenentwicklung.',
      limitsAndTransferability: 'Weltklasse-Kontext — beschreibt Praxis, validiert keine Freizeitläufer-Budgets; weder absolute Umfänge noch Verteilungsquoten sind auf Freizeitläufer übertragbar.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-ORVIA-BATCH2-CONTRACT', title: 'ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)',
      authorsOrOrg: 'ORVIA (intern, technisch geprüft via Testsuiten batch2a–2h)', year: 2026,
      sourceType: 'orvia_internal_contract', identifier: { internalPath: 'docs/ACTIVITY-DEDUPE-GROUPING-CONTRACT.md' },
      sports: ['any'], populations: ['orvia_users'],
      outcomes: ['canonical_load_contract'],
      appraisal: { studyDesign: 'internal_product_contract', methodQuality: 'unclear', riskOfBias: 'not_formally_assessed' },
      summary: 'Kanonische Tageslast (orvia_load_au aus sRPE bzw. Dauer×Default), Dedupe-Prioritäten P1–P6, Session-Gruppierung (Split-Aufzeichnungen = EINE Einheit), Härte-Signale und ratioConfidence-Fenster — die einzige zulässige Datengrundlage für Lauf-Lastauswertung.',
      limitsAndTransferability: 'Produktvertrag (Evidenzklasse D-Basis); ersetzt keine externe Evidenz.',
      lastCheckedAt: CHECKED
    },
    {
      sourceId: 'SRC-ORVIA-PORTFOLIO-CONTRACT', title: 'ORVIA Goal/Capacity/Periodization-Vertrag (Batch 3a, Portfolio v2)',
      authorsOrOrg: 'ORVIA (intern, technisch geprüft via batch3a_goal_portfolio_test)', year: 2026,
      sourceType: 'orvia_internal_contract', identifier: { internalPath: 'docs/GOAL-CAPACITY-PERIODIZATION-CONTRACT.md' },
      sports: ['any'], populations: ['orvia_users'],
      outcomes: ['goal_capacity_separation_contract'],
      appraisal: { studyDesign: 'internal_product_contract', methodQuality: 'unclear', riskOfBias: 'not_formally_assessed' },
      summary: 'Zielwerte sind Aspiration (interpretation aspiration), capacity bleibt getrennt; safetyPolicy tighten_only; Evidenzreferenz longest_grouped_session genau einmal.',
      limitsAndTransferability: 'Produktvertrag (Evidenzklasse D-Basis).',
      lastCheckedAt: CHECKED
    }
  ];

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }
  var byId = {};
  SOURCE_REGISTRY.forEach(function (s) { byId[s.sourceId] = s; });

  /* Versionierter Registervertrag. contentHash wird aus dem Vertrag
     berechnet (fail-closed: ohne geladenen Vertrag bleibt er null und
     validateRegistry/selectRules blockieren). */
  var registry = {
    registryVersion: REGISTRY_VERSION,
    sources: SOURCE_REGISTRY,
    contentHash: null,
    byId: byId
  };
  if (O.knowledgeContracts && typeof O.knowledgeContracts.registryContentHash === 'function') {
    registry.contentHash = O.knowledgeContracts.registryContentHash(registry);
  }

  O.knowledgeSources = _freeze(registry);
  if (typeof module !== 'undefined' && module.exports) module.exports = O.knowledgeSources;
})(typeof globalThis !== 'undefined' ? globalThis : this);
