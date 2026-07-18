/* ============================================================
   ORVIA · onboarding-logic — REINE, testbare Onboarding-Shell-Logik (v2).
   KEIN DOM, KEIN Supabase, KEIN localStorage. Über window.ORVIA.onboardingV2Logic + module.exports.
   ============================================================ */
(function (root) {
  var VERSION = 4;                    // M6: Draft-v4 (Placeholder-Ablösung goals/availability/review); v2/v3 werden migriert.
  var SUPPORTED_VERSIONS = [2, 3, 4];

  /* ============================================================
     M3 · STEP_CONFIG — kanonische Schrittdefinition (Redesign-Plan D/K).
     KEINE UI-Texte hier (Titel/Descs: onboarding-steps.js bzw. künftige Screens).
     Felder: id · tier (essential|personalization|advanced) · required ·
     skippable · countsTowardProgress · active.
     `active:false` = künftige kanonische ID, noch OHNE UI: taucht in Navigation/
     Progress/Completion standardmäßig NICHT auf (kein Bruch des v2-Flows) und
     wird beim jeweiligen M-Paket aktiviert. STEP_IDS (Legacy-API) wird aus den
     aktiven Steps ABGELEITET — eine einzige Wahrheitsquelle.
     ============================================================ */
  var STEP_CONFIG = [
    { id: 'welcome',              tier: 'essential',       required: true,  skippable: false, countsTowardProgress: false, active: true },
    { id: 'profile',              tier: 'essential',       required: true,  skippable: false, countsTowardProgress: true,  active: true },
    { id: 'sports',               tier: 'essential',       required: true,  skippable: false, countsTowardProgress: true,  active: true },
    { id: 'training_level',       tier: 'essential',       required: true,  skippable: false, countsTowardProgress: true,  active: true }, // M5b (A3): Trainingsstand der Hauptsportart
    { id: 'goals',                tier: 'essential',       required: true,  skippable: false, countsTowardProgress: true,  active: true }, // M6 (A4): Essential-Ziel
    { id: 'availability',         tier: 'essential',       required: true,  skippable: false, countsTowardProgress: true,  active: true }, // M7 (A5): Verfügbarkeit kompakt
    { id: 'safety',               tier: 'essential',       required: true,  skippable: false, countsTowardProgress: true,  active: true }, // M7 (A6): Sicherheitscheck
    { id: 'body',                 tier: 'essential',       required: false, skippable: true,  countsTowardProgress: true,  active: true }, // M7/M5c (A7): Körperdaten optional
    { id: 'review',               tier: 'essential',       required: true,  skippable: false, countsTowardProgress: true,  active: true }, // M6/M8 (A8): Zusammenfassung
    // Ebene B — künftige kanonische IDs (M8/M11):
    { id: 'sport_profile',        tier: 'personalization', required: false, skippable: true,  countsTowardProgress: true,  active: false },
    { id: 'goals_detail',         tier: 'personalization', required: false, skippable: true,  countsTowardProgress: true,  active: false },
    { id: 'availability_detail',  tier: 'personalization', required: false, skippable: true,  countsTowardProgress: true,  active: false },
    { id: 'performance',          tier: 'personalization', required: false, skippable: true,  countsTowardProgress: true,  active: false },
    { id: 'recovery',             tier: 'personalization', required: false, skippable: true,  countsTowardProgress: true,  active: false },
    { id: 'preferences',          tier: 'personalization', required: false, skippable: true,  countsTowardProgress: true,  active: false },
    // Ebene C:
    { id: 'devices',              tier: 'advanced',        required: false, skippable: true,  countsTowardProgress: true,  active: false },
    { id: 'equipment_locations',  tier: 'advanced',        required: false, skippable: true,  countsTowardProgress: true,  active: false }
  ];
  var STEP_IDS = STEP_CONFIG.filter(function (s) { return s.active; }).map(function (s) { return s.id; });
  var STATUSES = ['not_started', 'in_progress', 'ready_for_review', 'completed'];
  /* M6: Placeholder-Migration AKTIV (Draft v3→v4). Alt-IDs bleiben dauerhaft als Aliasse
     lesbar — Alt-Drafts (currentStep, completedSteps, skippedSteps) werden verlustfrei
     über aliasStep() umbenannt; keine Datenverwerfung. */
  var PLACEHOLDER_ALIASES_V4 = { goals_placeholder: 'goals', schedule_placeholder: 'availability', review_placeholder: 'review' };
  var STEP_ALIASES = {
    profile_placeholder: 'profile', sports_placeholder: 'sports',
    goals_placeholder: 'goals', schedule_placeholder: 'availability', review_placeholder: 'review'
  };
  function profileLogic() { return root.ORVIA && root.ORVIA.onboardingProfileLogic; }
  function sportsLogic() { return root.ORVIA && root.ORVIA.onboardingSportsLogic; }
  function sportsValid(d) {
    try { var sl = sportsLogic(); var s = d && d.draftData && d.draftData.sports; return !!(sl && sl.sportsComplete && sl.sportsComplete(s)); }
    catch (e) { return false; }
  }
  // M5b: Trainingsstand-Validität (level+sessionsPerWeek der Hauptsportart, Daten in draftData.sports).
  function trainingLevelValid(d) {
    try { var sl = sportsLogic(); var s = d && d.draftData && d.draftData.sports; return !!(sl && sl.trainingLevelComplete && sl.trainingLevelComplete(s)); }
    catch (e) { return false; }
  }
  // M6: Essential-Ziel-Validität (profile-model ist der kanonische Ziel-Owner).
  function goalsModel() { return root.ORVIA && root.ORVIA.profileModel; }
  function goalsValid(d) {
    try { var pm = goalsModel(); var g = d && d.draftData && d.draftData.goals; return !!(pm && pm.validateEssentialGoals && pm.validateEssentialGoals(g).valid); }
    catch (e) { return false; }
  }
  // M7 (A5): Verfügbarkeits-Validität = ≥1 Tag (profile-model) UND typische Dauer der Hauptsportart.
  function availabilityValid(d) {
    try {
      var pm = goalsModel(); var sl = sportsLogic();
      if (!pm || typeof pm.validateEssentialAvailability !== 'function') return false;
      if (!pm.validateEssentialAvailability(d && d.draftData && d.draftData.availability).valid) return false;
      var sel = d && d.draftData && d.draftData.sports;
      var n = sl && sl.normalizeSportsSelection ? sl.normalizeSportsSelection(sel) : null;
      var prim = null; if (n) n.sports.forEach(function (e) { if (e.role === 'primary') prim = e; });
      return !!(prim && prim.typicalDuration != null);
    } catch (e) { return false; }
  }
  // M7 (A6): Sicherheitscheck-Validität (Frage beantwortet; bei Ja Region+Intensität).
  function safetyValid(d) {
    try { var pm = goalsModel(); var s = d && d.draftData && d.draftData.safety; return !!(pm && pm.validateSafetyCheck && pm.validateSafetyCheck(s).valid); }
    catch (e) { return false; }
  }

  function newDraft() {
    return { version: VERSION, status: 'not_started', currentStep: 'welcome', completedSteps: [], skippedSteps: [], draftData: {}, startedAt: null, updatedAt: null, completedAt: null };
  }
  function isVersion2(raw) { return !!(raw && raw.version === 2); }
  function isSupportedVersion(raw) { return !!(raw && SUPPORTED_VERSIONS.indexOf(raw.version) >= 0); }

  /* ---------- M3: STEP_CONFIG-Zugriffe (pur) ---------- */
  function getStepConfig(stepId) {
    var id = aliasStep(stepId);
    for (var i = 0; i < STEP_CONFIG.length; i++) if (STEP_CONFIG[i].id === id) return STEP_CONFIG[i];
    return null;
  }
  function getStepsForTier(tier) { return STEP_CONFIG.filter(function (s) { return s.tier === tier; }); }
  function isStepRequired(stepId) { var c = getStepConfig(stepId); return !!(c && c.required); }
  function isStepSkippable(stepId) { var c = getStepConfig(stepId); return !!(c && c.skippable); }
  function configIndex(stepId) {
    var id = aliasStep(stepId);
    for (var i = 0; i < STEP_CONFIG.length; i++) if (STEP_CONFIG[i].id === id) return i;
    return -1;
  }
  function stepIndex(id) { return STEP_IDS.indexOf(id); }
  function isFirst(id) { return stepIndex(id) === 0; }
  function isLast(id) { return stepIndex(id) === STEP_IDS.length - 1; }
  function nextStepId(id) { var i = stepIndex(id); return (i >= 0 && i < STEP_IDS.length - 1) ? STEP_IDS[i + 1] : null; }
  function prevStepId(id) { var i = stepIndex(id); return (i > 0) ? STEP_IDS[i - 1] : null; }
  function progress(d) {
    var id = (d && d.currentStep) || 'welcome'; var i = stepIndex(id); if (i < 0) i = 0;
    var total = STEP_IDS.length;
    return { index: i, total: total, step: i + 1, percent: Math.round((i / (total - 1)) * 100), label: 'Schritt ' + (i + 1) + ' von ' + total };
  }
  function startDraft(d, now) {
    d = d || newDraft();
    if (d.status === 'not_started') { d.status = 'in_progress'; d.startedAt = d.startedAt || now || null; }
    if (now != null) d.updatedAt = now;
    return d;
  }
  // Profil-Vollständigkeit (über Profil-Logik, falls vorhanden). DEFENSIV: ohne Logik oder bei
  // werfendem profileComplete → false (verhindert Abschluss ohne Validierung).
  function profileValid(d) {
    try { var pl = profileLogic(); var p = d && d.draftData && d.draftData.profile; return !!(pl && pl.profileComplete && pl.profileComplete(p)); }
    catch (e) { return false; }
  }
  function aliasStep(id) { return STEP_ALIASES[id] || id; }
  // Schritte vor dem Review (alle außer review_placeholder).
  function stepsBeforeReview() { return STEP_IDS.slice(0, STEP_IDS.length - 1); }

  // Erfüllte Review-Voraussetzungen: valides Profil + currentStep=review + lückenlose Vorschritte.
  function reviewPrerequisitesComplete(d) {
    if (!d || d.currentStep !== 'review') return false;
    if (!profileValid(d)) return false;
    if (!sportsValid(d)) return false;
    if (!trainingLevelValid(d)) return false;   // M5b
    if (!goalsValid(d)) return false;           // M6
    if (!availabilityValid(d)) return false;    // M7 (A5)
    if (!safetyValid(d)) return false;          // M7 (A6)
    if (!Array.isArray(d.completedSteps)) return false;
    var need = stepsBeforeReview();
    var skpR = Array.isArray(d.skippedSteps) ? d.skippedSteps : [];
    for (var i = 0; i < need.length; i++) {
      if (d.completedSteps.indexOf(need[i]) >= 0) continue;
      // M7: bewusst übersprungene optionale Steps (body) erfüllen die Review-Voraussetzung.
      var nc = getStepConfig(need[i]);
      if (nc && nc.skippable && skpR.indexOf(need[i]) >= 0) continue;
      return false;
    }
    return true;
  }
  // Erster (in Reihenfolge) noch nicht ordnungsgemäß abgeschlossener Schritt.
  function firstIncompleteStep(d) {
    var steps = stepsBeforeReview();
    var cs = Array.isArray(d && d.completedSteps) ? d.completedSteps : [];
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      if (s === 'profile' && !profileValid(d)) return 'profile';
      if (s === 'sports' && !sportsValid(d)) return 'sports';
      if (s === 'training_level' && !trainingLevelValid(d)) return 'training_level';   // M5b
      if (s === 'goals' && !goalsValid(d)) return 'goals';                             // M6
      if (s === 'availability' && !availabilityValid(d)) return 'availability';        // M7
      if (s === 'safety' && !safetyValid(d)) return 'safety';                          // M7
      if (cs.indexOf(s) < 0) {
        // M7: übersprungene optionale Steps gelten als erledigt (Skip ≠ Lücke).
        var fc = getStepConfig(s);
        if (fc && fc.skippable && Array.isArray(d && d.skippedSteps) && d.skippedSteps.indexOf(s) >= 0) continue;
        return s;
      }
    }
    return 'review';
  }

  // Weiter: FAIL-CLOSED. Ungültiges Profil auf 'profile' → kein Abschluss/keine Navigation.
  // 'review' wird NIE über advance() abgeschlossen (nur über markReadyForReview()).
  function advance(d, now) {
    if (!d || stepIndex(d.currentStep) < 0) return d;
    if (d.currentStep === 'profile' && !profileValid(d)) { if (now != null) d.updatedAt = now; return d; }
    if (d.currentStep === 'sports' && !sportsValid(d)) { if (now != null) d.updatedAt = now; return d; }
    if (d.currentStep === 'training_level' && !trainingLevelValid(d)) { if (now != null) d.updatedAt = now; return d; }   // M5b fail-closed
    if (d.currentStep === 'goals' && !goalsValid(d)) { if (now != null) d.updatedAt = now; return d; }                    // M6 fail-closed
    if (d.currentStep === 'availability' && !availabilityValid(d)) { if (now != null) d.updatedAt = now; return d; }      // M7 fail-closed
    if (d.currentStep === 'safety' && !safetyValid(d)) { if (now != null) d.updatedAt = now; return d; }                  // M7 fail-closed
    if (d.currentStep === 'review') { if (now != null) d.updatedAt = now; return d; }
    var cur = d.currentStep;
    if (!Array.isArray(d.completedSteps)) d.completedSteps = [];
    if (d.completedSteps.indexOf(cur) < 0) d.completedSteps.push(cur);
    if (d.status === 'not_started') d.status = 'in_progress';
    var nxt = nextStepId(cur);
    if (nxt) { d.currentStep = nxt; }   // review hat keinen Folgeschritt → oben fail-closed behandelt; KEIN Status-Set hier
    if (now != null) d.updatedAt = now;
    return d;
  }
  // Fachfunktion Profil-Schritt: nur am 'profile'-Schritt; validiert defensiv; schließt nur bei Gültigkeit ab.
  function advanceProfile(d, now) {
    if (!d) return { ok: false, draft: d, errors: { _step: 'Kein Draft vorhanden.' } };
    if (d.currentStep !== 'profile') return { ok: false, draft: d, errors: { _step: 'Der aktuelle Schritt ist nicht das Basisprofil.' } };
    var pl = profileLogic();
    if (!pl || typeof pl.validateProfile !== 'function') return { ok: false, draft: d, errors: { _module: 'Die Profilvalidierung ist nicht verfügbar.' } };
    var v;
    try { v = pl.validateProfile(d.draftData && d.draftData.profile); }
    catch (e) { return { ok: false, draft: d, errors: { _module: 'Die Profilvalidierung konnte nicht ausgeführt werden.' } }; }
    if (!v || typeof v.valid !== 'boolean' || !v.errors || typeof v.errors !== 'object') return { ok: false, draft: d, errors: { _module: 'Ungültige Validierungsantwort.' } };
    if (!v.valid) return { ok: false, draft: d, errors: v.errors };
    advance(d, now);
    return { ok: true, draft: d, errors: {} };
  }
  // Fachfunktion Sport-Schritt: nur am 'sports'-Schritt; validiert defensiv; schließt nur bei Gültigkeit ab.
  function advanceSports(d, now) {
    if (!d) return { ok: false, draft: d, errors: { _step: 'Kein Draft vorhanden.' } };
    if (d.currentStep !== 'sports') return { ok: false, draft: d, errors: { _step: 'Der aktuelle Schritt ist nicht die Sportauswahl.' } };
    var sl = sportsLogic();
    if (!sl || typeof sl.validateSportsSelection !== 'function') return { ok: false, draft: d, errors: { _module: 'Die Sportauswahl-Validierung ist nicht verfügbar.' } };
    var v;
    try { v = sl.validateSportsSelection(d.draftData && d.draftData.sports); }
    catch (e) { return { ok: false, draft: d, errors: { _module: 'Die Sportauswahl-Validierung konnte nicht ausgeführt werden.' } }; }
    if (!v || typeof v.valid !== 'boolean' || !v.errors || typeof v.errors !== 'object') return { ok: false, draft: d, errors: { _module: 'Ungültige Validierungsantwort.' } };
    if (!v.valid) return { ok: false, draft: d, errors: v.errors };
    advance(d, now);
    return { ok: true, draft: d, errors: {} };
  }
  // M5b · Fachfunktion Trainingsstand-Schritt (A3): nur am 'training_level'-Schritt; validiert
  // defensiv über sports-logic.validateTrainingLevel (Daten liegen in draftData.sports).
  function advanceTrainingLevel(d, now) {
    if (!d) return { ok: false, draft: d, errors: { _step: 'Kein Draft vorhanden.' } };
    if (d.currentStep !== 'training_level') return { ok: false, draft: d, errors: { _step: 'Der aktuelle Schritt ist nicht der Trainingsstand.' } };
    var sl = sportsLogic();
    if (!sl || typeof sl.validateTrainingLevel !== 'function') return { ok: false, draft: d, errors: { _module: 'Die Trainingsstand-Validierung ist nicht verfügbar.' } };
    var v;
    try { v = sl.validateTrainingLevel(d.draftData && d.draftData.sports); }
    catch (e) { return { ok: false, draft: d, errors: { _module: 'Die Trainingsstand-Validierung konnte nicht ausgeführt werden.' } }; }
    if (!v || typeof v.valid !== 'boolean' || !v.errors || typeof v.errors !== 'object') return { ok: false, draft: d, errors: { _module: 'Ungültige Validierungsantwort.' } };
    if (!v.valid) return { ok: false, draft: d, errors: v.errors };
    advance(d, now);
    return { ok: true, draft: d, errors: {} };
  }
  // M6 · Fachfunktion Ziel-Schritt (A4): nur am 'goals'-Schritt; validiert defensiv über
  // profile-model.validateEssentialGoals (Daten in draftData.goals, kanonisches goals[]-Modell).
  function advanceGoals(d, now) {
    if (!d) return { ok: false, draft: d, errors: { _step: 'Kein Draft vorhanden.' } };
    if (d.currentStep !== 'goals') return { ok: false, draft: d, errors: { _step: 'Der aktuelle Schritt ist nicht die Zielauswahl.' } };
    var pm = goalsModel();
    if (!pm || typeof pm.validateEssentialGoals !== 'function') return { ok: false, draft: d, errors: { _module: 'Die Ziel-Validierung ist nicht verfügbar.' } };
    var v;
    try { v = pm.validateEssentialGoals(d.draftData && d.draftData.goals); }
    catch (e) { return { ok: false, draft: d, errors: { _module: 'Die Ziel-Validierung konnte nicht ausgeführt werden.' } }; }
    if (!v || typeof v.valid !== 'boolean' || !v.errors || typeof v.errors !== 'object') return { ok: false, draft: d, errors: { _module: 'Ungültige Validierungsantwort.' } };
    if (!v.valid) return { ok: false, draft: d, errors: v.errors };
    advance(d, now);
    return { ok: true, draft: d, errors: {} };
  }
  // M7 · Fachfunktion Verfügbarkeit (A5): ≥1 Tag (profile-model) + typische Dauer der Hauptsportart.
  function advanceAvailability(d, now) {
    if (!d) return { ok: false, draft: d, errors: { _step: 'Kein Draft vorhanden.' } };
    if (d.currentStep !== 'availability') return { ok: false, draft: d, errors: { _step: 'Der aktuelle Schritt ist nicht die Verfügbarkeit.' } };
    var pm = goalsModel(); var sl = sportsLogic();
    if (!pm || typeof pm.validateEssentialAvailability !== 'function' || !sl || typeof sl.normalizeSportsSelection !== 'function') {
      return { ok: false, draft: d, errors: { _module: 'Die Verfügbarkeits-Validierung ist nicht verfügbar.' } };
    }
    var v;
    try { v = pm.validateEssentialAvailability(d.draftData && d.draftData.availability); }
    catch (e) { return { ok: false, draft: d, errors: { _module: 'Die Verfügbarkeits-Validierung konnte nicht ausgeführt werden.' } }; }
    if (!v || typeof v.valid !== 'boolean' || !v.errors || typeof v.errors !== 'object') return { ok: false, draft: d, errors: { _module: 'Ungültige Validierungsantwort.' } };
    var errors = {};
    Object.keys(v.errors).forEach(function (k) { errors[k] = v.errors[k]; });
    try {
      var n = sl.normalizeSportsSelection(d.draftData && d.draftData.sports);
      var prim = null; n.sports.forEach(function (e) { if (e.role === 'primary') prim = e; });
      if (!prim || prim.typicalDuration == null) errors._duration = 'Wähle deine typische Trainingsdauer aus.';
    } catch (e) { return { ok: false, draft: d, errors: { _module: 'Die Verfügbarkeits-Validierung konnte nicht ausgeführt werden.' } }; }
    if (Object.keys(errors).length) return { ok: false, draft: d, errors: errors };
    advance(d, now);
    return { ok: true, draft: d, errors: {} };
  }
  // M7 · Fachfunktion Sicherheitscheck (A6): Frage beantwortet; bei Ja Region+Intensität.
  function advanceSafety(d, now) {
    if (!d) return { ok: false, draft: d, errors: { _step: 'Kein Draft vorhanden.' } };
    if (d.currentStep !== 'safety') return { ok: false, draft: d, errors: { _step: 'Der aktuelle Schritt ist nicht der Sicherheitscheck.' } };
    var pm = goalsModel();
    if (!pm || typeof pm.validateSafetyCheck !== 'function') return { ok: false, draft: d, errors: { _module: 'Die Sicherheitscheck-Validierung ist nicht verfügbar.' } };
    var v;
    try { v = pm.validateSafetyCheck(d.draftData && d.draftData.safety); }
    catch (e) { return { ok: false, draft: d, errors: { _module: 'Die Sicherheitscheck-Validierung konnte nicht ausgeführt werden.' } }; }
    if (!v || typeof v.valid !== 'boolean' || !v.errors || typeof v.errors !== 'object') return { ok: false, draft: d, errors: { _module: 'Ungültige Validierungsantwort.' } };
    if (!v.valid) return { ok: false, draft: d, errors: v.errors };
    advance(d, now);
    return { ok: true, draft: d, errors: {} };
  }
  function back(d, now) {
    if (!d) return d;
    var p = prevStepId(d.currentStep);
    if (p) d.currentStep = p;
    if (now != null) d.updatedAt = now;
    return d;
  }

  /* ---------- M3: skippedSteps-Normalisierung ----------
     Nur bekannte, skippable Steps; eindeutige IDs; „completed gewinnt": ein auch
     abgeschlossener Step wird aus skippedSteps entfernt. Skip ≠ completed. */
  function normalizeSkippedSteps(rawSkipped, completedSteps) {
    var completed = Array.isArray(completedSteps) ? completedSteps : [];
    var seen = {}, out = [];
    (Array.isArray(rawSkipped) ? rawSkipped : []).forEach(function (s) {
      var a = aliasStep(s);
      var cfg = getStepConfig(a);
      if (!cfg || !cfg.skippable) return;
      if (completed.indexOf(a) >= 0) return;
      if (seen[a]) return;
      seen[a] = true; out.push(a);
    });
    return out;
  }

  // completedSteps als lückenlose, geordnete Präfix-Sequenz. currentStep gilt NICHT als abgeschlossen
  // (Ausnahme: finale Review-Vormerkung). 'profile' nur bei validem Profil. Keine Lücken/Duplikate/Unbekannte.
  // M3: ein ÜBERSPRUNGENER skippable Step erfüllt die Kette (ohne als completed zu zählen).
  function normalizeCompletedSteps(rawSteps, currentStep, draft) {
    var curIdx = stepIndex(currentStep); if (curIdx < 0) curIdx = 0;
    var profileOk = profileValid(draft);
    var sportsOk = sportsValid(draft);
    var tlOk = trainingLevelValid(draft);
    var goalsOk = goalsValid(draft);
    var avOk = availabilityValid(draft);
    var sfOk = safetyValid(draft);
    var present = {};
    (Array.isArray(rawSteps) ? rawSteps : []).forEach(function (s) {
      var a = aliasStep(s);
      if (STEP_IDS.indexOf(a) < 0) return;
      if (a === 'profile' && !profileOk) return;     // 'profile' nur bei validem Profil
      if (a === 'sports' && !sportsOk) return;       // 'sports' nur bei valider Sportauswahl
      if (a === 'training_level' && !tlOk) return;   // M5b: nur bei validem Trainingsstand
      if (a === 'goals' && !goalsOk) return;         // M6: nur bei validem Essential-Ziel
      if (a === 'availability' && !avOk) return;     // M7: nur bei valider Verfügbarkeit
      if (a === 'safety' && !sfOk) return;           // M7: nur bei beantwortetem Sicherheitscheck
      present[a] = true;
    });
    var reviewFinal = (currentStep === 'review' && draft && draft.status === 'ready_for_review' && profileOk && sportsOk);
    var limit = reviewFinal ? STEP_IDS.length : curIdx;   // currentStep exklusiv (außer Review-Final)
    var skipped = (draft && Array.isArray(draft.skippedSteps)) ? draft.skippedSteps : [];
    var out = [];
    for (var i = 0; i < limit; i++) {
      var step = STEP_IDS[i];
      if (!present[step]) {
        if (skipped.indexOf(step) >= 0) continue;         // M3: Skip erfüllt die Kette, zählt aber nicht als completed
        break;                                            // lückenlos: erste echte Lücke beendet die Sequenz
      }
      out.push(step);
    }
    return out;
  }
  // Status/Schritt/completedSteps/completedAt gemeinsam konsistent machen.
  function reconcileDraftStatus(d) {
    if (!d) return d;
    if (!Array.isArray(d.completedSteps)) d.completedSteps = [];
    d.skippedSteps = normalizeSkippedSteps(d.skippedSteps, d.completedSteps);   // M3: vor der Ketten-Normalisierung
    // Legacy/korruptes 'completed' → in_progress (NICHT direkt ready_for_review setzen; nur
    // markReadyForReview darf den finalen Status setzen). Re-Bestätigung über die Review-Vormerkung.
    if (d.status === 'completed') d.status = 'in_progress';
    d.completedSteps = normalizeCompletedSteps(d.completedSteps, d.currentStep, d);
    // ready_for_review ohne erfüllte Voraussetzungen → zurückstufen auf ersten fehlenden Schritt.
    if (d.status === 'ready_for_review' && !reviewPrerequisitesComplete(d)) {
      d.status = 'in_progress';
      d.completedAt = null;
      d.currentStep = firstIncompleteStep(d);
      d.completedSteps = normalizeCompletedSteps(d.completedSteps, d.currentStep, d); // nach Schrittwechsel erneut
    }
    /* M5b: Fail-closed-Rückführung auch für in_progress-Drafts. Liegt VOR currentStep ein
       unvollständiger ARBEITSSCHRITT (z. B. neu aktivierter Pflichtschritt wie training_level
       nach einer App-Aktualisierung, oder ein Validator entfernte einen behaupteten Abschluss),
       wandert currentStep dorthin zurück. Regeln: nur rückwärts, nie vorwärts; Info-Schritte
       ohne Fortschrittszählung (welcome) sind NIE Rücksprungziel; übersprungene skippable
       Steps gelten als erfüllt. Daten bleiben vollständig erhalten — nur die Position ändert
       sich. Kein Bypass durch alte Drafts. */
    if ((d.status === 'in_progress' || d.status === 'not_started') && stepIndex(d.currentStep) >= 0) {
      var walk = stepsBeforeReview();
      var csW = d.completedSteps, skW = Array.isArray(d.skippedSteps) ? d.skippedSteps : [];
      for (var wi = 0; wi < walk.length; wi++) {
        var ws = walk[wi];
        if (stepIndex(ws) >= stepIndex(d.currentStep)) break;
        var wc = getStepConfig(ws);
        if (wc && wc.countsTowardProgress === false) continue;
        var wBad =
          (ws === 'profile' && !profileValid(d)) ||
          (ws === 'sports' && !sportsValid(d)) ||
          (ws === 'training_level' && !trainingLevelValid(d)) ||
          (ws === 'goals' && !goalsValid(d)) ||
          (ws === 'availability' && !availabilityValid(d)) ||
          (ws === 'safety' && !safetyValid(d)) ||
          (csW.indexOf(ws) < 0 && !(wc && wc.skippable && skW.indexOf(ws) >= 0));
        if (wBad) {
          d.currentStep = ws;
          d.completedSteps = normalizeCompletedSteps(d.completedSteps, d.currentStep, d);
          break;
        }
      }
    }
    if (d.status !== 'completed') d.completedAt = null;
    return d;
  }

  // Sichere Kopie zulässiger Draft-Daten — KEINE Mutation des Rohobjekts, keine Prototype-Pollution.
  var BAD_KEYS = { __proto__: 1, constructor: 1, prototype: 1 };
  function stripBad(o) {
    if (!o || typeof o !== 'object') return o;
    Object.keys(o).forEach(function (k) { if (BAD_KEYS[k]) { delete o[k]; } else if (o[k] && typeof o[k] === 'object') stripBad(o[k]); });
    return o;
  }
  function clonePlainObject(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    try { return stripBad(JSON.parse(JSON.stringify(v))); } catch (e) { return {}; }
  }

  /* M3 · Migration v2 → v3 (idempotent):
     - v2-Draft bleibt VOLLSTÄNDIG erhalten (kein Corrupt-Backup — Version 2 wird akzeptiert),
       skippedSteps wird als leeres Array ergänzt, version → 3.
     - unbekannte Top-Level-Felder bleiben erhalten (sicher geklont, keine Prototype-Pollution).
     - corrupt Handling (JSON/unsupported Version) bleibt Sache des Stores (null-Rückgabe). */
  var KNOWN_DRAFT_KEYS = { version: 1, status: 1, currentStep: 1, completedSteps: 1, skippedSteps: 1, draftData: 1, startedAt: 1, updatedAt: 1, completedAt: 1 };
  function cloneUnknown(v) {
    if (v == null || typeof v !== 'object') return v;
    try { return stripBad(JSON.parse(JSON.stringify(v))); } catch (e) { return null; }
  }
  function normalizeDraft(raw) {
    if (!isSupportedVersion(raw)) return null;
    var d = newDraft();
    if (STATUSES.indexOf(raw.status) >= 0) d.status = raw.status;
    var cs = aliasStep(raw.currentStep);
    if (STEP_IDS.indexOf(cs) >= 0) d.currentStep = cs;
    d.skippedSteps = Array.isArray(raw.skippedSteps) ? raw.skippedSteps.slice() : [];
    Object.keys(raw).forEach(function (k) { if (!KNOWN_DRAFT_KEYS[k] && !BAD_KEYS[k]) d[k] = cloneUnknown(raw[k]); });
    // draftData als SICHERE KOPIE (kein Mutieren von raw); profile-Teilobjekt tolerant normalisieren.
    d.draftData = clonePlainObject(raw.draftData);
    var pl = profileLogic();
    if (pl && d.draftData.profile && typeof d.draftData.profile === 'object') {
      try { d.draftData.profile = pl.normalizeProfile(d.draftData.profile); } catch (e) {}
    }
    var sl = sportsLogic();
    if (sl && d.draftData.sports && typeof d.draftData.sports === 'object') {
      try { d.draftData.sports = sl.normalizeSportsSelection(d.draftData.sports); } catch (e) {}
    }
    d.completedSteps = Array.isArray(raw.completedSteps) ? raw.completedSteps.slice() : [];
    d.startedAt = raw.startedAt || null; d.updatedAt = raw.updatedAt || null; d.completedAt = raw.completedAt || null;
    return reconcileDraftStatus(d);   // migriert/normalisiert completedSteps + Status konsistent
  }

  // Review-Vormerkung: strukturiertes Resultat, vollständig defensiv (wirft NIE). Prüfung über
  // dieselbe zentrale Funktion reviewPrerequisitesComplete().
  function markReadyForReview(d, now) {
    try {
      if (!d) return { ok: false, draft: d, error: 'Kein Draft vorhanden.' };
      if (!Array.isArray(d.completedSteps)) d.completedSteps = [];
      if (d.currentStep !== 'review') return { ok: false, draft: d, error: 'Nicht am Review-Schritt.' };
      d.completedSteps = normalizeCompletedSteps(d.completedSteps, d.currentStep, d);
      if (!reviewPrerequisitesComplete(d)) return { ok: false, draft: d, error: 'Vorherige Schritte unvollständig.' };
      if (d.completedSteps.indexOf('review') < 0) d.completedSteps.push('review');
      d.status = 'ready_for_review';
      if (now != null) d.updatedAt = now;
      return { ok: true, draft: d, error: null };
    } catch (e) {
      try { console.error('[ORVIA onboarding] markReadyForReview', e); } catch (_) {}
      return { ok: false, draft: d, error: 'Interner Fehler.' };
    }
  }
  // NICHT nur Statusstring prüfen — Voraussetzungen + review in completedSteps.
  function readyForReview(d) {
    return !!(d && d.status === 'ready_for_review' && reviewPrerequisitesComplete(d) && Array.isArray(d.completedSteps) && d.completedSteps.indexOf('review') >= 0);
  }

  /* ============================================================
     M3 · Skip / Complete / Navigation / Progress / Tier-Completion.
     Konventionen wie Bestand: mutierender Draft + strukturiertes Resultat
     { ok, draft, errors } (kein Throw). Zeit ausschließlich über den
     injizierten now-Parameter (keine direkte Date.now-Nutzung).
     ============================================================ */
  var VALIDATED_STEPS = { profile: 1, sports: 1, training_level: 1, goals: 1, availability: 1, safety: 1 };   // nur über die jeweilige advance*-Fachfunktion (fail-closed)

  /* skipStep: nur bekannte skippable Steps; entfernt widersprüchliches completed;
     ist der übersprungene Step der aktuelle, wandert currentStep deterministisch
     zum nächsten AKTIVEN Step gleicher Tier. Doppelter Skip ist ok (idempotent). */
  function skipStep(d, stepId, now) {
    if (!d) return { ok: false, draft: d, errors: { _step: 'Kein Draft vorhanden.' } };
    var id = aliasStep(stepId);
    var cfg = getStepConfig(id);
    if (!cfg) return { ok: false, draft: d, errors: { _step: 'Unbekannter Schritt.' } };
    if (!cfg.skippable) return { ok: false, draft: d, errors: { _step: 'Dieser Schritt ist verpflichtend und kann nicht übersprungen werden.' } };
    if (!Array.isArray(d.skippedSteps)) d.skippedSteps = [];
    if (!Array.isArray(d.completedSteps)) d.completedSteps = [];
    d.completedSteps = d.completedSteps.filter(function (s) { return aliasStep(s) !== id; });
    if (d.skippedSteps.indexOf(id) < 0) d.skippedSteps.push(id);
    if (d.status === 'not_started') d.status = 'in_progress';
    if (aliasStep(d.currentStep) === id) {
      var nxt = _nextActive(id, cfg.tier);
      if (nxt) d.currentStep = nxt;
    }
    if (now != null) d.updatedAt = now;
    return { ok: true, draft: d, errors: {} };
  }

  /* completeStep: NUR für Steps ohne Fachvalidierung (profile/sports laufen weiter
     ausschließlich über advanceProfile/advanceSports — kein Validierungs-Bypass).
     Entfernt den Step aus skippedSteps („später abgeschlossen schlägt Skip"). */
  function completeStep(d, stepId, now) {
    if (!d) return { ok: false, draft: d, errors: { _step: 'Kein Draft vorhanden.' } };
    var id = aliasStep(stepId);
    var cfg = getStepConfig(id);
    if (!cfg) return { ok: false, draft: d, errors: { _step: 'Unbekannter Schritt.' } };
    if (VALIDATED_STEPS[id]) return { ok: false, draft: d, errors: { _step: 'Dieser Schritt erfordert Fachvalidierung (advanceProfile/advanceSports).' } };
    if (!Array.isArray(d.completedSteps)) d.completedSteps = [];
    if (!Array.isArray(d.skippedSteps)) d.skippedSteps = [];
    d.skippedSteps = d.skippedSteps.filter(function (s) { return s !== id; });
    if (d.completedSteps.indexOf(id) < 0) d.completedSteps.push(id);
    if (d.status === 'not_started') d.status = 'in_progress';
    if (now != null) d.updatedAt = now;
    return { ok: true, draft: d, errors: {} };
  }

  /* Navigation über AKTIVE Steps. Default-Tier = Tier des aktuellen Steps.
     Tier-Wechsel NUR über explizites opts.tier (Personalization/Advanced nie automatisch).
     Unbekannter currentStep → null (fail-safe). */
  function _activeOfTier(tier) { return STEP_CONFIG.filter(function (s) { return s.active && s.tier === tier; }); }
  function _nextActive(fromId, tier) {
    var idx = configIndex(fromId);
    if (idx < 0) return null;
    for (var i = idx + 1; i < STEP_CONFIG.length; i++) {
      var s = STEP_CONFIG[i];
      if (s.active && s.tier === tier) return s.id;
    }
    return null;
  }
  function getNextStep(d, opts) {
    opts = opts || {};
    var cur = aliasStep(d && d.currentStep);
    var curCfg = getStepConfig(cur);
    if (opts.tier && (!curCfg || curCfg.tier !== opts.tier)) {
      // expliziter Tier-Wechsel: erster aktiver, noch nicht erledigter Step des Tiers
      var pool = _activeOfTier(opts.tier);
      var done = (d && d.completedSteps) || [], skp = (d && d.skippedSteps) || [];
      for (var i = 0; i < pool.length; i++) if (done.indexOf(pool[i].id) < 0 && skp.indexOf(pool[i].id) < 0) return pool[i].id;
      return null;
    }
    if (!curCfg) return null;
    return _nextActive(cur, opts.tier || curCfg.tier);
  }
  function getPreviousStep(d, opts) {
    opts = opts || {};
    var cur = aliasStep(d && d.currentStep);
    var curCfg = getStepConfig(cur);
    if (!curCfg) return null;
    var tier = opts.tier || curCfg.tier;
    var idx = configIndex(cur);
    for (var i = idx - 1; i >= 0; i--) {
      var s = STEP_CONFIG[i];
      if (s.active && s.tier === tier) return s.id;
    }
    return null;
  }

  /* Progress-Vertrag: zählt NUR Steps mit countsTowardProgress (welcome nie).
     Übersprungene optionale Steps gelten für den FLOW-Fortschritt als erledigt.
     Standard-Sicht: nur aktive Steps; opts.includeInactive für künftige/Preview-Sichten. */
  function getProgress(d, opts) {
    opts = opts || {};
    var tier = opts.tier || 'essential';
    var counted = STEP_CONFIG.filter(function (s) { return s.tier === tier && s.countsTowardProgress && (opts.includeInactive || s.active); });
    var total = counted.length;
    var done = (d && Array.isArray(d.completedSteps)) ? d.completedSteps : [];
    var skp = (d && Array.isArray(d.skippedSteps)) ? d.skippedSteps : [];
    var completed = 0, skipped = 0;
    counted.forEach(function (s) {
      if (done.indexOf(s.id) >= 0) completed += 1;
      else if (skp.indexOf(s.id) >= 0) skipped += 1;
    });
    var finished = completed + skipped;
    var current = total === 0 ? 0 : Math.min(total, Math.max(1, finished + 1));
    var percentage = total === 0 ? 0 : Math.min(100, Math.max(0, Math.round((finished / total) * 100)));
    return { current: current, total: total, completed: completed, skipped: skipped, percentage: percentage };
  }

  /* Tier-/Flow-Completion (STRIKT getrennt von der Profil-Completeness in profile-model:
     hier zählt „Flow abgeschlossen oder bewusst übersprungen", NICHT Feldinhalte):
     alle required Steps abgeschlossen UND alle optionalen abgeschlossen ODER übersprungen.
     Leerer Scope (z. B. Tier ohne aktive Steps) → false: nichts wurde durchlaufen. */
  function isTierComplete(d, tier, opts) {
    opts = opts || {};
    var steps = STEP_CONFIG.filter(function (s) { return s.tier === tier && (opts.includeInactive || s.active); });
    if (!steps.length) return false;
    var done = (d && Array.isArray(d.completedSteps)) ? d.completedSteps : [];
    var skp = (d && Array.isArray(d.skippedSteps)) ? d.skippedSteps : [];
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      if (s.required) { if (done.indexOf(s.id) < 0) return false; }
      else { if (done.indexOf(s.id) < 0 && skp.indexOf(s.id) < 0) return false; }
    }
    return true;
  }

  var api = {
    VERSION: VERSION, SUPPORTED_VERSIONS: SUPPORTED_VERSIONS, STEP_IDS: STEP_IDS, STATUSES: STATUSES, newDraft: newDraft, isVersion2: isVersion2, isSupportedVersion: isSupportedVersion,
    STEP_CONFIG: STEP_CONFIG, PLACEHOLDER_ALIASES_V4: PLACEHOLDER_ALIASES_V4,
    getStepConfig: getStepConfig, getStepsForTier: getStepsForTier, isStepRequired: isStepRequired, isStepSkippable: isStepSkippable,
    skipStep: skipStep, completeStep: completeStep, getNextStep: getNextStep, getPreviousStep: getPreviousStep,
    getProgress: getProgress, isTierComplete: isTierComplete, normalizeSkippedSteps: normalizeSkippedSteps,
    stepIndex: stepIndex, isFirst: isFirst, isLast: isLast, nextStepId: nextStepId, prevStepId: prevStepId,
    progress: progress, startDraft: startDraft, advance: advance, advanceProfile: advanceProfile, advanceSports: advanceSports, advanceTrainingLevel: advanceTrainingLevel, advanceGoals: advanceGoals, advanceAvailability: advanceAvailability, advanceSafety: advanceSafety, back: back,
    normalizeDraft: normalizeDraft, reconcileDraftStatus: reconcileDraftStatus, normalizeCompletedSteps: normalizeCompletedSteps,
    reviewPrerequisitesComplete: reviewPrerequisitesComplete, firstIncompleteStep: firstIncompleteStep,
    markReadyForReview: markReadyForReview, readyForReview: readyForReview
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA = root.ORVIA || {}; root.ORVIA.onboardingV2Logic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
