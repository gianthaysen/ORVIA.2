/* ============================================================
   ORVIA · onboarding-logic — REINE, testbare Onboarding-Shell-Logik (v2).
   KEIN DOM, KEIN Supabase, KEIN localStorage. Über window.ORVIA.onboardingV2Logic + module.exports.
   ============================================================ */
(function (root) {
  var VERSION = 3;                    // M3: Draft-v3 (skippedSteps); v2 wird weiter migriert.
  var SUPPORTED_VERSIONS = [2, 3];

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
    { id: 'goals_placeholder',    tier: 'essential',       required: true,  skippable: false, countsTowardProgress: true,  active: true },
    { id: 'schedule_placeholder', tier: 'essential',       required: true,  skippable: false, countsTowardProgress: true,  active: true },
    { id: 'body',                 tier: 'essential',       required: false, skippable: true,  countsTowardProgress: true,  active: false }, // Setup A7 (M5)
    { id: 'review_placeholder',   tier: 'essential',       required: true,  skippable: false, countsTowardProgress: true,  active: true },
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
  // Legacy-Schritt-IDs → aktuelle ID (kontrollierte Draft-Migration, keine Datenverwerfung).
  var STEP_ALIASES = { profile_placeholder: 'profile', sports_placeholder: 'sports' };
  /* Dokumentierte ZUKUNFTS-Migration (Draft v3→v4, Aktivierung in M7 — NICHT in M3 aktiv):
     Beim Ersatz der Placeholder-Screens werden currentStep UND completedSteps/skippedSteps
     über diese Map umbenannt; STEP_ALIASES erhält dann die Umkehr-Einträge für Alt-Drafts. */
  var PLACEHOLDER_ALIASES_V4 = { goals_placeholder: 'goals', schedule_placeholder: 'availability', review_placeholder: 'review' };
  function profileLogic() { return root.ORVIA && root.ORVIA.onboardingProfileLogic; }
  function sportsLogic() { return root.ORVIA && root.ORVIA.onboardingSportsLogic; }
  function sportsValid(d) {
    try { var sl = sportsLogic(); var s = d && d.draftData && d.draftData.sports; return !!(sl && sl.sportsComplete && sl.sportsComplete(s)); }
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

  /* ============================================================
     M3 · Skip / Complete / Navigation / Progress / Tier-Completion.
     Konventionen wie Bestand: mutierender Draft + strukturiertes Resultat
     { ok, draft, errors } (kein Throw). Zeit ausschließlich über den
     injizierten now-Parameter (keine direkte Date.now-Nutzung).
     ============================================================ */
  var VALIDATED_STEPS = { profile: 1, sports: 1 };   // nur über advanceProfile/advanceSports (fail-closed)

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
    progress: progress, startDraft: startDraft, advance: advance, advanceProfile: advanceProfile, advanceSports: advanceSports, back: back,
    normalizeDraft: normalizeDraft, reconcileDraftStatus: reconcileDraftStatus, normalizeCompletedSteps: normalizeCompletedSteps,
    reviewPrerequisitesComplete: reviewPrerequisitesComplete, firstIncompleteStep: firstIncompleteStep,
    markReadyForReview: markReadyForReview, readyForReview: readyForReview
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA = root.ORVIA || {}; root.ORVIA.onboardingV2Logic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
