/* ============================================================
   ORVIA · onboarding-logic — REINE, testbare Onboarding-Shell-Logik (v2).
   KEIN DOM, KEIN Supabase, KEIN localStorage. Über window.ORVIA.onboardingV2Logic + module.exports.
   ============================================================ */
(function (root) {
  var VERSION = 2;
  // 'profile' ist der erste fachliche Schritt; übrige bleiben Platzhalter. (Version bleibt 2:
  // die Migration profile_placeholder→profile ist eindeutig & testbar, kein Versions-Bump nötig.)
  var STEP_IDS = ['welcome', 'profile', 'sports', 'goals_placeholder', 'schedule_placeholder', 'review_placeholder'];
  var STATUSES = ['not_started', 'in_progress', 'ready_for_review', 'completed'];
  // Legacy-Schritt-IDs → aktuelle ID (kontrollierte Draft-Migration, keine Datenverwerfung).
  var STEP_ALIASES = { profile_placeholder: 'profile', sports_placeholder: 'sports' };
  function profileLogic() { return root.ORVIA && root.ORVIA.onboardingProfileLogic; }
  function sportsLogic() { return root.ORVIA && root.ORVIA.onboardingSportsLogic; }
  function sportsValid(d) {
    try { var sl = sportsLogic(); var s = d && d.draftData && d.draftData.sports; return !!(sl && sl.sportsComplete && sl.sportsComplete(s)); }
    catch (e) { return false; }
  }

  function newDraft() {
    return { version: VERSION, status: 'not_started', currentStep: 'welcome', completedSteps: [], draftData: {}, startedAt: null, updatedAt: null, completedAt: null };
  }
  function isVersion2(raw) { return !!(raw && raw.version === VERSION); }
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
    if (!d || d.currentStep !== 'review_placeholder') return false;
    if (!profileValid(d)) return false;
    if (!sportsValid(d)) return false;
    if (!Array.isArray(d.completedSteps)) return false;
    var need = stepsBeforeReview();
    for (var i = 0; i < need.length; i++) { if (d.completedSteps.indexOf(need[i]) < 0) return false; }
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
      if (cs.indexOf(s) < 0) return s;
    }
    return 'review_placeholder';
  }

  // Weiter: FAIL-CLOSED. Ungültiges Profil auf 'profile' → kein Abschluss/keine Navigation.
  // 'review_placeholder' wird NIE über advance() abgeschlossen (nur über markReadyForReview()).
  function advance(d, now) {
    if (!d || stepIndex(d.currentStep) < 0) return d;
    if (d.currentStep === 'profile' && !profileValid(d)) { if (now != null) d.updatedAt = now; return d; }
    if (d.currentStep === 'sports' && !sportsValid(d)) { if (now != null) d.updatedAt = now; return d; }
    if (d.currentStep === 'review_placeholder') { if (now != null) d.updatedAt = now; return d; }
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
  function back(d, now) {
    if (!d) return d;
    var p = prevStepId(d.currentStep);
    if (p) d.currentStep = p;
    if (now != null) d.updatedAt = now;
    return d;
  }

  // completedSteps als lückenlose, geordnete Präfix-Sequenz. currentStep gilt NICHT als abgeschlossen
  // (Ausnahme: finale Review-Vormerkung). 'profile' nur bei validem Profil. Keine Lücken/Duplikate/Unbekannte.
  function normalizeCompletedSteps(rawSteps, currentStep, draft) {
    var curIdx = stepIndex(currentStep); if (curIdx < 0) curIdx = 0;
    var profileOk = profileValid(draft);
    var sportsOk = sportsValid(draft);
    var present = {};
    (Array.isArray(rawSteps) ? rawSteps : []).forEach(function (s) {
      var a = aliasStep(s);
      if (STEP_IDS.indexOf(a) < 0) return;
      if (a === 'profile' && !profileOk) return;     // 'profile' nur bei validem Profil
      if (a === 'sports' && !sportsOk) return;       // 'sports' nur bei valider Sportauswahl
      present[a] = true;
    });
    var reviewFinal = (currentStep === 'review_placeholder' && draft && draft.status === 'ready_for_review' && profileOk && sportsOk);
    var limit = reviewFinal ? STEP_IDS.length : curIdx;   // currentStep exklusiv (außer Review-Final)
    var out = [];
    for (var i = 0; i < limit; i++) {
      var step = STEP_IDS[i];
      if (!present[step]) break;                          // lückenlos: erste Lücke beendet die Sequenz
      out.push(step);
    }
    return out;
  }
  // Status/Schritt/completedSteps/completedAt gemeinsam konsistent machen.
  function reconcileDraftStatus(d) {
    if (!d) return d;
    if (!Array.isArray(d.completedSteps)) d.completedSteps = [];
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

  function normalizeDraft(raw) {
    if (!isVersion2(raw)) return null;
    var d = newDraft();
    if (STATUSES.indexOf(raw.status) >= 0) d.status = raw.status;
    var cs = aliasStep(raw.currentStep);
    if (STEP_IDS.indexOf(cs) >= 0) d.currentStep = cs;
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
      if (d.currentStep !== 'review_placeholder') return { ok: false, draft: d, error: 'Nicht am Review-Schritt.' };
      d.completedSteps = normalizeCompletedSteps(d.completedSteps, d.currentStep, d);
      if (!reviewPrerequisitesComplete(d)) return { ok: false, draft: d, error: 'Vorherige Schritte unvollständig.' };
      if (d.completedSteps.indexOf('review_placeholder') < 0) d.completedSteps.push('review_placeholder');
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
    return !!(d && d.status === 'ready_for_review' && reviewPrerequisitesComplete(d) && Array.isArray(d.completedSteps) && d.completedSteps.indexOf('review_placeholder') >= 0);
  }

  var api = {
    VERSION: VERSION, STEP_IDS: STEP_IDS, STATUSES: STATUSES, newDraft: newDraft, isVersion2: isVersion2,
    stepIndex: stepIndex, isFirst: isFirst, isLast: isLast, nextStepId: nextStepId, prevStepId: prevStepId,
    progress: progress, startDraft: startDraft, advance: advance, advanceProfile: advanceProfile, advanceSports: advanceSports, back: back,
    normalizeDraft: normalizeDraft, reconcileDraftStatus: reconcileDraftStatus, normalizeCompletedSteps: normalizeCompletedSteps,
    reviewPrerequisitesComplete: reviewPrerequisitesComplete, firstIncompleteStep: firstIncompleteStep,
    markReadyForReview: markReadyForReview, readyForReview: readyForReview
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA = root.ORVIA || {}; root.ORVIA.onboardingV2Logic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
