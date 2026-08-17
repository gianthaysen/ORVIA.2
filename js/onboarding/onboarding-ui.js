/* ============================================================
   ORVIA · onboarding-ui — Shell v2 (DOM). Navigation, Fortschritt, lokales Autosave, A11y, responsive.
   Isoliert: keine Fachfelder, kein Server, keine Plan-Engine. Legacy-Onboarding bleibt unangetastet.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  function L() { return O.onboardingV2Logic; }
  function STORE() { return O.onboardingV2Store; }
  function STEPS() { return O.onboardingV2Steps || []; }
  function D() { return (typeof document !== 'undefined') ? document : null; }   // dynamisch (Tests/Robustheit)

  var S = { draft: null, userId: null, el: null, busy: false, lastNav: 0, corruptNote: false, bound: false, previousFocus: null, profileSubmitted: false, birthMode: null, heightDirty: false, weightDirty: false, reviewError: '', sportsSubmitted: false, trainingSubmitted: false, goalsSubmitted: false, availabilitySubmitted: false, safetySubmitted: false, bodySubmitted: false };
  var NAV_LOCK_MS = 300;

  function debugEnabled() { try { return !!(root.ORVIA_DEBUG === true || (root.ORVIA_CFG && root.ORVIA_CFG.debug === true)); } catch (e) { return false; } }
  // Reiner Fokus-Trap-Helfer (testbar): liefert das Ziel-Element oder null (= Default zulassen).
  function trapTarget(focusables, active, shift) {
    if (!focusables || !focusables.length) return null;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (shift && active === first) return last;
    if (!shift && active === last) return first;
    return null;
  }
  // Übliche fokussierbare Elemente (für kommende Formulare vorbereitet). Überschrift (tabindex="-1")
  // bleibt nur programmgesteuertes Ziel, NICHT in der Tab-Reihenfolge.
  var FOCUS_SEL = ['button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
    'textarea:not([disabled])', 'a[href]', '[tabindex]:not([tabindex="-1"])'].join(',');
  function focusables() {
    if (!S.el) return [];
    var list = [];
    try { list = Array.prototype.slice.call(S.el.querySelectorAll(FOCUS_SEL)); } catch (e) { list = []; }
    return list.filter(function (b) { return b && !b.disabled && (b.tabIndex == null || b.tabIndex !== -1); });
  }

  function now() { try { if (O.clock && typeof O.clock.now === 'function') return O.clock.now(); } catch (e) {} return Date.now(); }   // M4: injizierbare Zeitquelle
  function uid() { try { return (O.user && O.user.id) || null; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function stepMeta(id) { var a = STEPS(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return a[0] || { id: id, title: id, desc: '' }; }
  function persist() { if (S.draft) { S.draft.updatedAt = now(); STORE().save(S.userId, S.draft); } }

  function open(opts) {
    if (!D() || !L() || !STORE()) return false;
    opts = opts || {};
    S.userId = uid();
    try { S.previousFocus = D().activeElement || null; } catch (e) { S.previousFocus = null; } // für Fokus-Restore
    var loaded = STORE().load(S.userId);
    S.corruptNote = !!(loaded && loaded.corrupt);
    var existing = (loaded && loaded.draft) ? loaded.draft : null;
    if (opts.fresh && existing) {
      S.draft = null;                       // alten In-Memory-Draft nicht versehentlich speichern
      renderFreshChoice(existing);          // fresh überschreibt NIE still
      return true;
    }
    S.draft = existing || L().startDraft(L().newDraft(), now());
    // BEARBEITEN hat IMMER Vorrang vor dem Done-Screen — UNABHÄNGIG davon, ob bereits ein
    // Onboarding-Draft existiert. Auf dem Gerät kann das Profil aus der Cloud/PROFILE stammen,
    // ohne dass je ein v2-Draft gespeichert wurde. edit:true darf NIE renderReviewDone() zeigen.
    if (opts.edit) {
      if (!S.draft) S.draft = L().startDraft(L().newDraft(), now());
      S.draft.currentStep = 'profile';   // erster sichtbarer Screen = bearbeitbarer Profilbereich
      try { console.debug('[profile-edit]', { entryPoint: opts.source || 'unknown', fresh: opts.fresh === true, edit: true, readyForReview: !!L().readyForReview(S.draft), selectedRenderer: 'editable_profile' }); } catch (e) {}
      render();   // seedt fehlende Werte aus PROFILE (profileSeedFromExisting), persistiert am Ende
      return true;
    }
    var rr = !!L().readyForReview(S.draft);
    try { console.debug('[profile-edit]', { entryPoint: opts.source || 'unknown', fresh: opts.fresh === true, edit: false, readyForReview: rr, selectedRenderer: rr ? 'review_done' : 'onboarding' }); } catch (e) {}
    if (rr) { renderReviewDone(); return true; } // Statusansicht nur im NICHT-Edit-Fall (Ersteinrichtung)
    render();   // persistiert am Ende
    return true;
  }
  function debugOpen() {
    if (!debugEnabled()) { try { console.warn('[ORVIA onboarding] Debug-Einstieg ist deaktiviert.'); } catch (e) {} return false; }
    return open({ fresh: false, source: 'debug' });
  }

  // Auswahl bei fresh:true + vorhandenem Draft: Fortsetzen / Neu beginnen / Abbrechen.
  function renderFreshChoice(existing) {
    mountShell();
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML =
      '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Fortschritt gefunden</h2>' +
      '<p class="ob2-desc">Auf diesem Gerät liegt bereits ein gespeicherter Onboarding-Fortschritt. Was möchtest du tun?</p>' +
      '<div class="ob2-nav">' +
        '<button type="button" class="btn" id="ob2-resume">Fortsetzen</button>' +
        '<button type="button" class="btn sec" id="ob2-new">Neu beginnen</button>' +
      '</div>' +
      '<button type="button" class="ob2-later" id="ob2-cancel">Abbrechen</button>';
    card.querySelector('#ob2-resume').onclick = function () {
      S.draft = existing;
      if (L().readyForReview(existing)) { renderReviewDone(); return; } // Statusansicht erhalten
      render();   // persistiert
    };
    card.querySelector('#ob2-new').onclick = function () { STORE().clear(S.userId); S.draft = L().startDraft(L().newDraft(), now()); render(); };
    // Abbrechen: Shell schließen, gespeicherten Draft UNVERÄNDERT lassen (kein persist, keine Zeitstempel).
    card.querySelector('#ob2-cancel').onclick = function () { closeShell({ persist: false }); };
    focusHeading();
  }

  function mountShell() {
    if (S.el) return;
    var doc = D(); if (!doc) return;
    var el = doc.createElement('div');
    el.className = 'ob2-bg';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ob2-title');
    el.innerHTML = '<div class="ob2-card"></div>';
    doc.body.appendChild(el);
    doc.documentElement.classList.add('ob2-open');
    S.el = el;
    // Globale Autosave-Listener nur EINMAL. captureAndPersist sichert auch ungespeicherte Feldeingaben.
    if (!S.bound) {
      S.bound = true;
      try { doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') captureAndPersist(); }); } catch (e) {}
      try { root.addEventListener && root.addEventListener('beforeunload', captureAndPersist); } catch (e) {}
    }
    // El-Level-Listener bei JEDEM Mount (neues el): Escape speichert nur; Tab bleibt im Dialog.
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); captureAndPersist(); return; }   // erfasst aktuelle Eingaben, schließt NICHT
      if (ev.key === 'Tab') {
        var tgt = trapTarget(focusables(), doc.activeElement, !!ev.shiftKey);
        if (tgt) { ev.preventDefault(); try { tgt.focus(); } catch (e) {} }
      }
    });
  }

  function PL() { return O.onboardingProfileLogic; }
  // Vollständiger Modulvertrag: ALLE von onboarding-ui aufgerufenen Profil-Funktionen müssen vorhanden sein.
  var PL_REQUIRED = ['normalizeProfile', 'validateProfile', 'profileComplete', 'profileSeedFromExisting', 'cmToFeetInches', 'kgToLb', 'lbToKg', 'parseFeetInches', '_num'];
  function plFull() { var pl = PL(); return !!(pl && PL_REQUIRED.every(function (n) { return typeof pl[n] === 'function'; })); }
  function SL() { return O.onboardingSportsLogic; }
  var SPORTS_REQUIRED = ['normalizeSportsSelection', 'validateSportsSelection', 'sportsComplete', 'getPrimarySport', 'getPlannedSports', 'getVisibleSports', 'getOccasionalSports', 'setPrimarySport', 'toggleSport', 'setSportRole', 'setPlanningEnabled', 'setVisible', 'setSportMode', 'reorderPlannedSports', 'seedFromExistingProfile', 'buildUserSportConfiguration', 'validateSportCatalog', 'plannable'];
  function slFull() {
    var sl = SL();
    if (!(sl && Array.isArray(sl.SPORT_CATALOG) && sl.CATALOG_BY_ID && typeof sl.CATALOG_BY_ID === 'object')) return false;
    if (!SPORTS_REQUIRED.every(function (n) { return typeof sl[n] === 'function'; })) return false;
    try { if (!sl.validateSportCatalog().valid) return false; } catch (e) { return false; }
    try { return sl.SPORT_CATALOG.every(function (s) { return s && s.id && sl.CATALOG_BY_ID[s.id] === s; }); } catch (e) { return false; }
  }
  function progressHTML() { var p = L().progress(S.draft); return '<div class="ob2-prog"><div class="ob2-prog-bar"><i style="width:' + p.percent + '%"></i></div><div class="ob2-prog-txt" aria-live="polite">' + esc(p.label) + '</div></div>'; }

  function render(showCorrupt) {
    mountShell();
    // currentStep absichern: unbekannt → erster gültiger Schritt.
    if (L().STEP_IDS.indexOf(S.draft.currentStep) < 0) S.draft.currentStep = L().STEP_IDS[0];
    // M5a: neuer Welcome-Screen (A0) — zählt nicht zum Fortschritt, keine Eingaben.
    if (S.draft.currentStep === 'welcome') { renderWelcome(showCorrupt); return; }
    // Profil-Schritt: bei fehlender/unvollständiger Profil-Logik FAIL-CLOSED (keine generische Übersprung-Möglichkeit).
    if (S.draft.currentStep === 'profile') { if (plFull()) renderProfileStep(); else renderProfileUnavailable(); return; }
    if (S.draft.currentStep === 'sports') { if (slFull()) renderSportsStep(); else renderSportsUnavailable(); return; }
    // M5b (A3): Trainingsstand — hängt fachlich an der Sport-Logik; fehlt sie (oder das Kit), fail-closed wie der Sport-Schritt.
    if (S.draft.currentStep === 'training_level') { if (slFull() && kitFull()) renderTrainingLevelStep(); else renderSportsUnavailable(); return; }
    // M6 (A4): Essential-Ziel — profile-model ist der Ziel-Owner; ohne Modell/Kit fail-closed.
    if (S.draft.currentStep === 'goals') { if (PM() && typeof PM().validateEssentialGoals === 'function' && kitFull()) renderGoalsStep(); else renderGoalsUnavailable(); return; }
    // M7 (A5/A6/A7): Verfügbarkeit, Sicherheitscheck, Körper — Kit+Modell fail-closed.
    if (S.draft.currentStep === 'availability') { if (PM() && kitFull() && slFull()) renderAvailabilityStep(); else renderGoalsUnavailable(); return; }
    if (S.draft.currentStep === 'safety') { if (PM() && kitFull()) renderSafetyStep(); else renderGoalsUnavailable(); return; }
    if (S.draft.currentStep === 'body') { if (plFull() && kitFull()) renderBodyStep(); else renderProfileUnavailable(); return; }
    if (S.draft.currentStep === 'review') { renderSummaryStep(); return; }
    var id = S.draft.currentStep, meta = stepMeta(id), p = L().progress(S.draft);
    var isFirst = L().isFirst(id), isLast = L().isLast(id);
    var corrupt = (S.corruptNote || showCorrupt)
      ? '<p class="ob2-note" role="status">Der gespeicherte Fortschritt konnte nicht vollständig geladen werden. Wir starten an einer sicheren Stelle.</p>' : '';
    S.corruptNote = false;
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML =
      '<div class="ob2-prog"><div class="ob2-prog-bar"><i style="width:' + p.percent + '%"></i></div>' +
        '<div class="ob2-prog-txt" aria-live="polite">' + esc(p.label) + '</div></div>' +
      corrupt +
      '<h2 id="ob2-title" class="ob2-title" tabindex="-1">' + esc(meta.title) + '</h2>' +
      '<p class="ob2-desc">' + esc(meta.desc) + '</p>' +
      (isLast ? '<p class="ob2-note">Dein Basisprofil und deine Sportauswahl sind gespeichert. Ziele und Trainingsalltag folgen in den nächsten Schritten.</p>' + sportsSummaryHTML() : '') +
      ((isLast && S.reviewError) ? '<p class="ob2-err" role="alert" id="ob2-review-err">' + esc(S.reviewError) + '</p>' : '') +
      '<div class="ob2-nav">' +
        (isFirst ? '' : '<button type="button" class="btn sec" id="ob2-back">Zurück</button>') +
        (isLast ? '<button type="button" class="btn" id="ob2-review-ready">Einrichtung vormerken</button>'
                : '<button type="button" class="btn" id="ob2-next">Weiter</button>') +
      '</div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button>';
    var back = card.querySelector('#ob2-back'); if (back) back.onclick = goBack;
    var next = card.querySelector('#ob2-next'); if (next) next.onclick = goNext;
    var rr = card.querySelector('#ob2-review-ready'); if (rr) rr.onclick = goReviewReady;
    card.querySelector('#ob2-later').onclick = later;
    focusHeading();
    persist();
  }

  /* ===== Inkrement 4i.1: echte Schritte Ziele / Trainingsalltag / Zusammenfassung (zentrale Modelle) ===== */
  function PM() { return O.profileModel; }
  var OB_WD = [['mo', 'Mo'], ['di', 'Di'], ['mi', 'Mi'], ['do', 'Do'], ['fr', 'Fr'], ['sa', 'Sa'], ['so', 'So']];
  function curGoals() { S.draft.draftData = S.draft.draftData || {}; if (!Array.isArray(S.draft.draftData.goals)) { var seed = (O.profile && O.profile.goals) || (root.PROFILE && root.PROFILE.goals) || []; S.draft.draftData.goals = PM() ? PM().normalizeGoals(seed) : seed.slice(); } return S.draft.draftData.goals; }

  /* ============================================================
     M6 (A4) · Essential-Zielschritt: EIN Ziel über gruppierte ChoiceCards.
     - Karten-IDs sind ausschließlich kanonische GOAL_CATEGORIES-IDs (kein
       zweiter Namespace); defensiv gegen den Katalog validiert.
     - Auswahl erzeugt/ersetzt GENAU EIN Essential-Ziel (dd._essentialGoalId),
       Titel automatisch aus dem Label (editierbar); 'custom' verlangt Titel.
     - Bestehende weitere Ziele (Seed aus Profil) bleiben unangetastet.
     - Kein primaryGoal-Write: Legacy-Projektion läuft erst im Completion-Pfad.
     ============================================================ */
  var ESSENTIAL_GOAL_GROUPS = [
    { label: 'Ausdauer', items: [
      ['run_5k', '5-km-Lauf', 'Die ersten 5 km schaffen oder schneller werden.'],
      ['run_10k', '10-km-Lauf', '10 km durchlaufen oder eine neue Bestzeit.'],
      ['half_marathon', 'Halbmarathon', 'Die 21,1 km finishen oder gezielt schneller werden.'],
      ['marathon', 'Marathon', 'Die 42,2 km strukturiert vorbereiten.'],
      ['triathlon', 'Triathlon', 'Schwimmen, Rad und Laufen kombinieren.'],
      ['base_endurance', 'Grundausdauer aufbauen', 'Fitter werden und länger durchhalten.']
    ] },
    { label: 'Kraft & Körper', items: [
      ['muscle_gain', 'Muskeln aufbauen', 'Nachhaltig Muskulatur und Kraft entwickeln.'],
      ['get_stronger', 'Stärker werden', 'Mehr Kraft in den Grundübungen.'],
      ['fat_loss', 'Körperfett reduzieren', 'Definierter werden und Leistung halten.']
    ] },
    { label: 'Gesundheit & Alltag', items: [
      ['train_regularly', 'Regelmäßig trainieren', 'Eine stabile Trainingsroutine aufbauen.'],
      ['pain_free', 'Schmerzfrei trainieren', 'Beschwerden reduzieren, belastbar werden.'],
      ['return_after_break', 'Wiedereinstieg', 'Nach einer Pause sicher zurückkommen.'],
      ['improve_recovery', 'Bessere Regeneration', 'Schlaf und Erholung gezielt verbessern.']
    ] },
    { label: 'Sport & Wettkampf', items: [
      ['game_endurance', 'Spielfitness verbessern', 'Über das ganze Spiel leistungsfähig bleiben.'],
      ['injury_prevention', 'Verletzungen vorbeugen', 'Robust bleiben für Training und Spiel.'],
      ['custom', 'Eigenes Ziel', 'Beschreibe dein Ziel mit eigenem Titel.']
    ] }
  ];
  function _goalCatalogFlat() { var M = PM(); var out = []; if (M && M.GOAL_CATEGORIES) Object.keys(M.GOAL_CATEGORIES).forEach(function (k) { out = out.concat(M.GOAL_CATEGORIES[k]); }); return out; }
  function essentialGoal() {
    var dd = S.draft.draftData || {}; var id = dd._essentialGoalId;
    if (!id) return null;
    var g = null; curGoals().forEach(function (x) { if (x.id === id) g = x; });
    return g;
  }
  function _essentialLabelFor(catId) {
    for (var i = 0; i < ESSENTIAL_GOAL_GROUPS.length; i++) {
      var items = ESSENTIAL_GOAL_GROUPS[i].items;
      for (var j = 0; j < items.length; j++) if (items[j][0] === catId) return items[j][1];
    }
    return catId;
  }
  function selectEssentialGoal(catId) {
    var M = PM(); var dd = S.draft.draftData;
    var isCustom = catId === 'custom';
    var autoTitle = isCustom ? '' : _essentialLabelFor(catId);
    var ex = essentialGoal();
    if (ex) {
      var patch = { category: catId, group: null };
      // Titel folgt dem Label, solange der Nutzer ihn nicht selbst angepasst hat.
      if (!dd._essentialTitleCustom) patch.title = autoTitle;
      dd.goals = M.updateGoal(curGoals(), ex.id, patch);
    } else {
      dd.goals = M.addGoal(curGoals(), { title: autoTitle, category: catId, priority: 1 });
      var added = null; dd.goals.forEach(function (g) { if (g.category === catId && (g.title === autoTitle)) added = g; });
      dd._essentialGoalId = added ? added.id : (dd.goals[dd.goals.length - 1] || {}).id;
      dd._essentialTitleCustom = false;
    }
    renderGoalsStep();   // persistiert am Ende (ein Save)
  }
  // Autosave-Erfassung der Detailfelder (auch für Escape/visibilitychange über captureCurrentStep).
  function _collectGoals() {
    var doc = D(); if (!doc || !S.draft || !S.draft.draftData) return;
    var M = PM(); var ex = essentialGoal(); if (!M || !ex) return;
    var patch = {}, dirty = false;
    var t = doc.getElementById('obg-title');
    if (t && t.value != null && t.value !== ex.title) { patch.title = t.value; S.draft.draftData._essentialTitleCustom = !!String(t.value).trim(); dirty = true; }
    var dte = doc.getElementById('obg-date');
    if (dte && dte.value != null && (dte.value || null) !== (ex.targetDate || null)) { patch.targetDate = dte.value || null; dirty = true; }
    if (dirty) S.draft.draftData.goals = M.updateGoal(curGoals(), ex.id, patch);
  }
  function renderGoalsStep() {
    mountShell();
    var M = PM(); var kit = K(); var card = S.el.querySelector('.ob2-card');
    curGoals();   // Seed sicherstellen
    var ex = essentialGoal();
    var flat = _goalCatalogFlat();
    var otherCount = curGoals().filter(function (g) { return !ex || g.id !== ex.id; }).length;
    var errs = M.validateEssentialGoals(curGoals()).errors;
    var goalErr = (S.goalsSubmitted && errs._goal) ? errs._goal : '';
    card.innerHTML =
      '<div id="ob3-progress"></div>' +
      '<p class="ob2-desc">Ein Ziel reicht für den Start. Weitere kannst du jederzeit im Profil ergänzen.</p>' +
      '<span class="ob2-err" id="err-goal" role="alert">' + esc(goalErr) + '</span>' +
      '<div id="ob3-goalgroups"></div>' +
      '<div id="ob3-goaldetails">' + (ex ?
        '<div class="ob2-field ob3-goaldetails"><span class="ob3-grouplabel" id="lbl-goaldetails">Details (optional)</span>' +
          '<label for="obg-title" class="ob3-sublabel">Titel</label>' +
          '<input class="ob2-input" id="obg-title" type="text" maxlength="80" value="' + esc(ex.title || '') + '"' + (ex.category === 'custom' ? ' placeholder="Wie heißt dein Ziel?"' : '') + '>' +
          '<label for="obg-date" class="ob3-sublabel">Zieldatum</label>' +
          '<input class="ob2-input" id="obg-date" type="date" value="' + esc(ex.targetDate || '') + '">' +
          '<p class="ob2-hint">Ohne Datum plant ORVIA offen; mit Datum wird gezielt darauf hingearbeitet.</p>' +
        '</div>' : '') + '</div>' +
      (otherCount > 0 ? '<p class="ob2-note">' + otherCount + ' weiteres Ziel' + (otherCount > 1 ? 'e' : '') + ' aus deinem Profil bleib' + (otherCount > 1 ? 'en' : 't') + ' erhalten.</p>' : '') +
      '<div class="ob2-navwrap"><div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button><button type="button" class="btn" id="ob2-next">Weiter</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button></div>';
    mountProgressHeader(card, 'Dein Ziel', 'Was willst du erreichen?');
    // Gruppierte ChoiceCards; nur kanonische Katalog-IDs (defensiv gefiltert + geloggt).
    var wrap = card.querySelector('#ob3-goalgroups');
    ESSENTIAL_GOAL_GROUPS.forEach(function (grp) {
      var head = D().createElement('div');
      head.className = 'ob3-goalgroup-label';
      head.textContent = grp.label;
      wrap.appendChild(head);
      var grid = D().createElement('div');
      grid.className = 'ob3-choicegrid';
      grp.items.forEach(function (item) {
        if (flat.indexOf(item[0]) < 0) { try { console.error('[ORVIA onboarding] Unbekannte Zielkategorie im Essential-Katalog:', item[0]); } catch (e) {} return; }
        var c = kit.createChoiceCard({
          id: 'goal-' + item[0], label: item[1], description: item[2], mode: 'single', value: item[0],
          selected: !!(ex && ex.category === item[0]),
          onChange: function (val) { _collectGoals(); selectEssentialGoal(val); }
        });
        grid.appendChild(c.el);
      });
      wrap.appendChild(grid);
    });
    var t = card.querySelector('#obg-title'); if (t && t.addEventListener) { t.addEventListener('change', function () { _collectGoals(); persist(); }); t.addEventListener('blur', function () { _collectGoals(); persist(); }); }
    var dte = card.querySelector('#obg-date'); if (dte && dte.addEventListener) { dte.addEventListener('change', function () { _collectGoals(); persist(); }); }
    card.querySelector('#ob2-back').onclick = function () { _collectGoals(); goBack(); };
    card.querySelector('#ob2-next').onclick = submitGoals;
    card.querySelector('#ob2-later').onclick = function () { _collectGoals(); later(); };
    focusHeading(); persist();
  }
  function submitGoals() {
    if (S.busy || navLocked()) return; S.busy = true;
    _collectGoals();
    var r = L().advanceGoals(S.draft, now());
    if (!r.ok) {
      S.goalsSubmitted = true; renderGoalsStep();
      var doc = D(); var first = doc && doc.getElementById('goal-' + ESSENTIAL_GOAL_GROUPS[0].items[0][0]);
      if (first && first.focus) { try { first.focus(); } catch (e) {} }
      S.busy = false; return;
    }
    S.goalsSubmitted = false; render(); S.busy = false;
  }
  function renderGoalsUnavailable() {
    mountShell();
    try { console.error('[ORVIA onboarding] profileModel/Kit fehlt oder ist unvollständig — Ziel-Schritt gesperrt.'); } catch (e) {}
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML = progressHTML() +
      '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Zielauswahl nicht verfügbar</h2>' +
      '<p class="ob2-desc">Die Zielauswahl kann gerade nicht geladen werden. Bitte starte die App neu.</p>' +
      '<div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button>';
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-later').onclick = later;
    focusHeading();
    persist();
  }
  function curSchedule() {
    S.draft.draftData = S.draft.draftData || {};
    if (!S.draft.draftData.availability) {
      var M = PM();
      var src = (O.profile && O.profile.availability) || (root.PROFILE && root.PROFILE.availability) || null;
      // Fresh onboarding ohne bestehende Verfügbarkeit: leere Woche (alle Ruhetage),
      // damit der Nutzer im Essential-Schritt Tage aktiv AUSWÄHLT statt abzuwählen.
      // normalizeAvailability(undefined) würde sonst alle 7 Tage available=true liefern.
      if (!src) { src = { days: {} }; OB_WD.forEach(function (w) { src.days[w[0]] = { restDay: true }; }); }
      S.draft.draftData.availability = M ? M.normalizeAvailability(src) : src;
    }
    return S.draft.draftData.availability;
  }
  /* ============================================================
     M7 (A5) · Verfügbarkeit kompakt: 7 Tages-Buttons + typische Dauer.
     Mapping (Feldmatrix §11): Tage → availability.days[].available,
     Dauer → sports[primary].typicalDuration UND singleSession.maxMinutes
     der verfügbaren Tage. KEINE Slots/Doppeleinheiten/maxSessions im
     Essential (Ebene B); vorhandene B-Details bleiben unangetastet.
     Alte Scratch-Keys (_schedTime/_schedDur/_doubleAllowed) werden nicht
     mehr geschrieben (Alt-Drafts behalten sie folgenlos).
     ============================================================ */
  function _applyTypicalDuration(minutes) {
    var M = PM(); var sl = SL(); var dd = S.draft.draftData;
    var prim = primaryEntry(dd.sports);
    if (prim) dd.sports = sl.setTypicalDuration(dd.sports, prim.sportId, minutes);
    var av = curSchedule();
    Object.keys(av.days || {}).forEach(function (k) {
      var day = av.days[k];
      if (day && day.available) { day.singleSession = day.singleSession || {}; day.singleSession.maxMinutes = minutes; }
    });
    dd.availability = M ? M.normalizeAvailability(av) : av;
  }
  function _toggleAvDay(dayKey) {
    var M = PM(); var av = curSchedule();
    var day = av.days[dayKey] || {};
    var on = !(day.available === true);
    day.available = on; day.restDay = !on;
    if (on) {
      var prim = primaryEntry(S.draft.draftData.sports);
      var dur = prim ? prim.typicalDuration : null;
      if (dur != null) { day.singleSession = day.singleSession || {}; day.singleSession.maxMinutes = dur; }
    }
    av.days[dayKey] = day;
    S.draft.draftData.availability = M ? M.normalizeAvailability(av) : av;
    renderAvailabilityStep();   // persistiert am Ende (ein Save)
  }
  function renderAvailabilityStep() {
    mountShell();
    if (!kitFull() || !PM()) { renderGoalsUnavailable(); return; }
    var sl = SL(); var kit = K(); var av = curSchedule();
    var prim = primaryEntry(S.draft.draftData.sports);
    var errors = {};
    if (S.availabilitySubmitted) {
      errors = PM().validateEssentialAvailability(av).errors;
      if (!prim || prim.typicalDuration == null) errors._duration = 'Wähle deine typische Trainingsdauer aus.';
    }
    var card = S.el.querySelector('.ob2-card');
    var dayBtns = OB_WD.map(function (w) {
      var on = !!(av.days[w[0]] && av.days[w[0]].available && !av.days[w[0]].restDay);
      return '<button type="button" class="ob3-daydot' + (on ? ' on' : '') + '" id="av-day-' + w[0] + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(w[1]) + (on ? ' ausgewählt' : '') + '">' + esc(w[1]) + '</button>';
    }).join('');
    card.innerHTML =
      '<div id="ob3-progress"></div>' +
      '<p class="ob2-desc">ORVIA plant nur, was in dein Leben passt. Feinheiten stellst du später im Profil ein.</p>' +
      '<div class="ob2-field"><span class="ob3-grouplabel" id="lbl-days">An welchen Tagen kannst du meistens trainieren?</span>' +
        '<span class="ob2-err" id="err-days" role="alert">' + esc(errors._days || '') + '</span>' +
        '<div class="ob3-daydots" role="group" aria-labelledby="lbl-days"' + (errors._days ? ' aria-describedby="err-days" aria-invalid="true"' : '') + '>' + dayBtns + '</div></div>' +
      '<div class="ob2-field"><span class="ob3-grouplabel" id="lbl-duration">Wie lange dauert eine Einheit typischerweise?</span>' +
        '<span class="ob2-err" id="err-duration" role="alert">' + esc(errors._duration || '') + '</span>' +
        '<div id="ob3-durband"></div></div>' +
      '<div class="ob2-navwrap"><div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button><button type="button" class="btn" id="ob2-next">Weiter</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button></div>';
    mountProgressHeader(card, 'Deine Verfügbarkeit', 'Grobe Angaben genügen.');
    var doc = D();
    OB_WD.forEach(function (w) { var b = doc.getElementById('av-day-' + w[0]); if (b) b.onclick = function () { _toggleAvDay(w[0]); }; });
    var band = kit.createSegmentedControl({
      name: 'duration-band', label: 'Typische Dauer', allowEmpty: true,
      options: sl.DURATION_BANDS.map(function (b) { return { value: b.id, label: b.label, id: 'avdur-' + b.id }; }),
      value: prim ? sl.bandForDuration(prim.typicalDuration) : null,
      onChange: function (bandId) {
        _applyTypicalDuration(sl.durationForBand(bandId));
        persist();
        if (S.availabilitySubmitted) { var e = doc.getElementById('err-duration'); if (e) e.textContent = ''; }
      }
    });
    card.querySelector('#ob3-durband').appendChild(band.el);
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-next').onclick = submitAvailability;
    card.querySelector('#ob2-later').onclick = later;
    focusHeading(); persist();
  }
  function submitAvailability() {
    if (S.busy || navLocked()) return; S.busy = true;
    var r = L().advanceAvailability(S.draft, now());
    if (!r.ok) {
      S.availabilitySubmitted = true; renderAvailabilityStep();
      var doc = D(); var t = r.errors._days ? doc.getElementById('av-day-mo') : doc.getElementById('avdur-30');
      if (t && t.focus) { try { t.focus(); } catch (e) {} }
      S.busy = false; return;
    }
    S.availabilitySubmitted = false; render(); S.busy = false;
  }

  /* ============================================================
     M7 (A6) · Sicherheitscheck: Ja/Nein; bei Ja Region + Intensität (+ Seite optional).
     Medizinische Abgrenzung Pflichttext. Draft: draftData.safety =
     { hasComplaints: bool, constraint: { bodyRegion, side, intensity } | null }.
     constraintsAcknowledgedAt entsteht ERST im Completion-Pfad (keine Vorwegnahme).
     ============================================================ */
  function curSafety() { S.draft.draftData = S.draft.draftData || {}; return S.draft.draftData.safety || null; }
  function _setSafetyAnswer(has) {
    var s = curSafety() || {};
    s.hasComplaints = has;
    if (has) { s.constraint = s.constraint || { bodyRegion: null, side: null, intensity: null }; }
    else { s.constraint = null; }
    S.draft.draftData.safety = s;
    renderSafetyStep();
  }
  function renderSafetyStep() {
    mountShell();
    if (!kitFull() || !PM()) { renderGoalsUnavailable(); return; }
    var M = PM(); var kit = K(); var s = curSafety();
    var errors = S.safetySubmitted ? M.validateSafetyCheck(s).errors : {};
    var showYes = !!(s && s.hasComplaints === true);
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML =
      '<div id="ob3-progress"></div>' +
      '<p class="ob2-desc">Damit ORVIA dein Training sicher anpasst.</p>' +
      '<div class="ob2-field"><span class="ob3-grouplabel" id="lbl-safety">Hast du aktuell Schmerzen oder Beschwerden?</span>' +
        '<span class="ob2-err" id="err-safety" role="alert">' + esc(errors._answer || '') + '</span>' +
        '<div id="ob3-safety-answer" class="ob3-choicegrid" role="group" aria-labelledby="lbl-safety"></div></div>' +
      '<div id="ob3-safety-detail">' + (showYes ?
        '<div class="ob2-field"><span class="ob3-grouplabel" id="lbl-region">Welche Körperregion ist betroffen?</span>' +
          '<span class="ob2-err" id="err-region" role="alert">' + esc(errors._region || '') + '</span>' +
          '<div id="ob3-regions" class="ob3-choicegrid" role="group" aria-labelledby="lbl-region"></div></div>' +
        '<div class="ob2-field"><span class="ob3-grouplabel" id="lbl-intensity">Wie stark sind die Beschwerden aktuell?</span>' +
          '<span class="ob2-err" id="err-intensity" role="alert">' + esc(errors._intensity || '') + '</span>' +
          '<div id="ob3-intensity"></div></div>' +
        '<div class="ob2-field"><span class="ob3-grouplabel" id="lbl-side">Seite <span class="ob3-optional">(optional)</span></span>' +
          '<div id="ob3-side"></div></div>' : '') + '</div>' +
      '<p class="ob3-trust">ORVIA passt dein Training an Beschwerden an — ersetzt aber keine ärztliche Abklärung. Bei starken oder unklaren Beschwerden lass dich medizinisch untersuchen.</p>' +
      '<div class="ob2-navwrap"><div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button><button type="button" class="btn" id="ob2-next">Weiter</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button></div>';
    mountProgressHeader(card, 'Kurzer Sicherheits-Check', 'Eine Frage — für sichere Empfehlungen.');
    var ansWrap = card.querySelector('#ob3-safety-answer');
    var noCard = kit.createChoiceCard({ id: 'safety-no', label: 'Nein', description: 'Keine aktuellen Beschwerden.', mode: 'single', value: 'no', selected: !!(s && s.hasComplaints === false), onChange: function () { _setSafetyAnswer(false); } });
    var yesCard = kit.createChoiceCard({ id: 'safety-yes', label: 'Ja', description: 'Ich habe aktuell Schmerzen oder Einschränkungen.', mode: 'single', value: 'yes', selected: showYes, onChange: function () { _setSafetyAnswer(true); } });
    ansWrap.appendChild(noCard.el); ansWrap.appendChild(yesCard.el);
    if (showYes) {
      var regWrap = card.querySelector('#ob3-regions');
      var regionCards = M.BODY_REGIONS.map(function (r) {
        var c = kit.createChoiceCard({
          id: 'region-' + r[0], label: r[1], mode: 'single', value: r[0],
          selected: !!(s.constraint && s.constraint.bodyRegion === r[0]),
          onChange: function (val) {
            s.constraint = s.constraint || {};
            s.constraint.bodyRegion = val;
            regionCards.forEach(function (rc, i) { rc.setSelected(M.BODY_REGIONS[i][0] === val); });
            persist();
            if (S.safetySubmitted) { var e = D().getElementById('err-region'); if (e) e.textContent = ''; }
          }
        });
        regWrap.appendChild(c.el);
        return c;
      });
      var stepper = kit.createStepper({
        label: 'Intensität (1–10)', min: 1, max: 10, step: 1, nullable: true,
        value: (s.constraint && s.constraint.intensity != null) ? s.constraint.intensity : null,
        onChange: function (v) {
          s.constraint = s.constraint || {};
          s.constraint.intensity = v;
          persist();
          if (S.safetySubmitted) { var e = D().getElementById('err-intensity'); if (e) e.textContent = ''; }
        }
      });
      card.querySelector('#ob3-intensity').appendChild(stepper.el);
      var side = kit.createSegmentedControl({
        name: 'safety-side', label: 'Betroffene Seite', allowEmpty: true,
        options: [{ value: 'left', label: 'Links', id: 'side-left' }, { value: 'right', label: 'Rechts', id: 'side-right' }, { value: 'both', label: 'Beidseitig', id: 'side-both' }],
        value: (s.constraint && s.constraint.side) || null,
        onChange: function (v) { s.constraint = s.constraint || {}; s.constraint.side = v; persist(); }
      });
      card.querySelector('#ob3-side').appendChild(side.el);
    }
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-next').onclick = submitSafety;
    card.querySelector('#ob2-later').onclick = later;
    focusHeading(); persist();
  }
  function submitSafety() {
    if (S.busy || navLocked()) return; S.busy = true;
    var r = L().advanceSafety(S.draft, now());
    if (!r.ok) {
      S.safetySubmitted = true; renderSafetyStep();
      var doc = D(); var t = r.errors._answer ? doc.getElementById('safety-no') : (r.errors._region ? doc.getElementById('region-' + PM().BODY_REGIONS[0][0]) : doc.getElementById('ob3-intensity'));
      if (t && t.focus) { try { t.focus(); } catch (e) {} }
      S.busy = false; return;
    }
    S.safetySubmitted = false; render(); S.busy = false;
  }

  /* ============================================================
     M7/M5c (A7) · Körperdaten (optional, skippbar): Größe + Gewicht.
     „Später ergänzen" ist gleichwertig prominent (Skip ohne Schuldgefühl);
     Smart Prompts fassen später nach (M10). Validierung nur bei Angabe.
     ============================================================ */
  function readBodyForm() {
    var doc = D(); if (!doc) return;
    var p = S.draft.draftData.profile = S.draft.draftData.profile || {};
    var pl = PL();
    var hEl = doc.getElementById('pf-heightCm'); if (hEl && hEl.value != null) { var hv = pl._num(hEl.value); p.heightCm = (hEl.value === '' ? null : (hv != null ? Math.round(hv) : hEl.value)); }
    var wEl = doc.getElementById('pf-weightKg'); if (wEl && wEl.value != null) { var wv = pl._num(wEl.value); p.weightKg = (wEl.value === '' ? null : (wv != null ? wv : wEl.value)); }
  }
  function renderBodyStep() {
    mountShell();
    if (!plFull() || !kitFull()) { renderProfileUnavailable(); return; }
    var p = ensureProfileDraft();
    var errors = S.bodySubmitted ? PL().validateProfile(p).errors : {};
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML =
      '<div id="ob3-progress"></div>' +
      '<p class="ob2-desc">Optional: Gewicht und Größe fließen in Belastung und Trainingszonen ein — nicht in Bewertungen.</p>' +
      '<span id="ob3-body-help"></span>' +
      '<form class="ob2-form ob3-form" autocomplete="on" novalidate>' +
        field('Größe (cm)', 'pf-heightCm', '<input id="pf-heightCm" type="number" inputmode="numeric" min="100" max="250" value="' + esc(p.heightCm != null ? p.heightCm : '') + '" aria-describedby="err-heightCm"' + ai(errors, 'heightCm') + '>', 'heightCm', errors) +
        field('Gewicht (kg)', 'pf-weightKg', '<input id="pf-weightKg" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="' + esc(p.weightKg != null ? p.weightKg : '') + '" aria-describedby="err-weightKg"' + ai(errors, 'weightKg') + '>', 'weightKg', errors) +
      '</form>' +
      '<div class="ob2-navwrap"><div class="ob2-nav">' +
        '<button type="button" class="btn sec" id="ob2-back">Zurück</button>' +
        '<button type="button" class="btn" id="ob2-next">Weiter</button></div>' +
      '<button type="button" class="btn sec ob3-skipbtn" id="ob3-body-skip">Später ergänzen</button>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button></div>';
    mountProgressHeader(card, 'Körperdaten (optional)', 'Kannst du jederzeit nachtragen.');
    var help = K().createInlineHelp({
      label: 'Warum fragen wir das?', title: 'Körperdaten (optional)',
      content: 'Gewicht und Größe verbessern die Einordnung von Belastung und Trainingszonen. Ohne Angabe rechnet ORVIA mit neutralen Verfahren — es werden keine Werte erfunden.'
    });
    card.querySelector('#ob3-body-help').appendChild(help.el);
    ['pf-heightCm', 'pf-weightKg'].forEach(function (id) {
      var el = D().getElementById(id); if (!el || !el.addEventListener) return;
      el.addEventListener('change', function () { readBodyForm(); persist(); });
      el.addEventListener('blur', function () { readBodyForm(); persist(); });
    });
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-next').onclick = submitBody;
    card.querySelector('#ob3-body-skip').onclick = function () {
      // Skip erzwingt keine Daten; bereits Eingetipptes wird NICHT verworfen (bewusst erfasst).
      readBodyForm();
      var r = L().skipStep(S.draft, 'body', now());
      if (r.ok) { S.bodySubmitted = false; render(); }
    };
    card.querySelector('#ob2-later').onclick = function () { readBodyForm(); later(); };
    focusHeading(); persist();
  }
  function submitBody() {
    if (S.busy || navLocked()) return; S.busy = true;
    readBodyForm();
    var v = PL().validateProfile(S.draft.draftData.profile);
    if (!v.valid && (v.errors.heightCm || v.errors.weightKg)) {
      S.bodySubmitted = true; renderBodyStep();
      var doc = D(); var t = v.errors.heightCm ? doc.getElementById('pf-heightCm') : doc.getElementById('pf-weightKg');
      if (t && t.focus) { try { t.focus(); } catch (e) {} }
      S.busy = false; return;
    }
    S.bodySubmitted = false;
    L().completeStep(S.draft, 'body', now());
    L().advance(S.draft, now());
    render(); S.busy = false;
  }
  /* ============================================================
     M8 (A8) · Zusammenfassung: ReviewCards je Essential-Bereich mit echten
     Werten, Rücksprung in jeden Schritt, EHRLICHE Vollständigkeit über
     buildCompletionPatch + profile-model (Completeness des Profils, das
     tatsächlich entstehen WIRD — keine falsche Vollständigkeit).
     Abschluss weiter über den transaktionalen M4-Pfad (finishOnboarding).
     ============================================================ */
  function _rvLevelLabel(lv) { for (var i = 0; i < LEVEL_LABELS.length; i++) if (LEVEL_LABELS[i][0] === lv) return LEVEL_LABELS[i][1]; return lv || '—'; }
  function _rvDate(d) { if (!d) return ''; var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (m[3] + '.' + m[2] + '.' + m[1]) : String(d); }
  function _rvCard(id, step, title, lines) {
    return '<div class="ob3-reviewcard" id="' + id + '">' +
      '<div class="ob3-reviewcard-head"><span class="ob3-reviewcard-title">' + esc(title) + '</span>' +
      '<button type="button" class="ob3-reviewedit" id="rv-edit-' + step + '" aria-label="' + esc(title) + ' bearbeiten">Bearbeiten</button></div>' +
      lines.filter(Boolean).map(function (l) { return '<div class="ob3-reviewline">' + l + '</div>'; }).join('') +
      '</div>';
  }
  function renderSummaryStep() {
    mountShell(); var card = S.el.querySelector('.ob2-card'); var M = PM(); var sl = SL(); var dd = S.draft.draftData || {};
    var pf = dd.profile || {};
    var goals = curGoals().filter(function (g) { return g.title && g.title.trim(); });
    var primary = goals.slice().sort(function (a, b) { return (a.priority || 9) - (b.priority || 9); })[0];
    var sportsSel = (dd.sports && Array.isArray(dd.sports.sports)) ? dd.sports.sports : [];
    var byId = sl ? sl.CATALOG_BY_ID : {};
    var prim = primaryEntry(dd.sports);
    var primLabel = prim && byId[prim.sportId] ? byId[prim.sportId].label : (prim ? prim.sportId : '—');
    var otherSports = sportsSel.filter(function (e) { return !prim || e.sportId !== prim.sportId; }).map(function (e) { return byId[e.sportId] ? byId[e.sportId].label : e.sportId; });
    var av = curSchedule();
    var days = OB_WD.filter(function (w) { return av.days[w[0]] && av.days[w[0]].available && !av.days[w[0]].restDay; });
    var sf = dd.safety;
    var bodySkipped = (S.draft.skippedSteps || []).indexOf('body') >= 0 && pf.heightCm == null && pf.weightKg == null;

    // EHRLICHE Vollständigkeit: das Profil bewerten, das beim Abschluss tatsächlich entsteht.
    var completeness = null;
    try {
      var patch = buildCompletionPatch(dd, M, new Date(now()).toISOString());
      completeness = M.computeProfileCompleteness(patch);
    } catch (e) { completeness = null; }
    var compHtml = '';
    if (completeness && completeness.essential) {
      compHtml = completeness.essential.complete
        ? '<div class="ob3-compbanner ok" role="status"><span class="ob3-compcheck" aria-hidden="true">✓</span> Profil vollständig — ORVIA kann loslegen.</div>'
        : '<div class="ob3-compbanner warn" role="status">Noch unvollständig: ' + esc(completeness.essential.missing.map(function (m) { return m.section; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ')) + '</div>';
    }
    var safetyLine;
    if (sf && sf.hasComplaints === false) safetyLine = esc('Keine Beschwerden angegeben.');
    else if (sf && sf.hasComplaints === true && sf.constraint) {
      var reg = (M.BODY_REGIONS.filter(function (r) { return r[0] === sf.constraint.bodyRegion; })[0] || [])[1] || sf.constraint.bodyRegion;
      safetyLine = esc(reg + ' · Intensität ' + sf.constraint.intensity + '/10' + (sf.constraint.side === 'left' ? ' · links' : sf.constraint.side === 'right' ? ' · rechts' : sf.constraint.side === 'both' ? ' · beidseitig' : ''));
    } else safetyLine = esc('—');

    card.innerHTML =
      '<div id="ob3-progress"></div>' +
      '<p class="ob2-desc">Sieht gut aus. Prüfe kurz — dann legt ORVIA los.</p>' +
      compHtml +
      _rvCard('rv-personal', 'profile', 'Über dich', [
        esc(pf.displayName || '—'),
        esc(pf.birthDate ? 'Geboren am ' + _rvDate(pf.birthDate) : (pf.ageEstimate != null && pf.ageEstimate !== '' ? pf.ageEstimate + ' Jahre' : ''))
      ]) +
      _rvCard('rv-sports', 'sports', 'Sportarten', [
        '<strong>' + esc(primLabel) + '</strong> <span class="ob3-badge">Hauptsport</span>',
        otherSports.length ? esc(otherSports.join(', ')) : ''
      ]) +
      _rvCard('rv-training', 'training_level', 'Trainingsstand', [
        esc(prim && prim.level ? _rvLevelLabel(prim.level) : '—'),
        esc(prim && prim.sessionsPerWeek != null ? 'ca. ' + prim.sessionsPerWeek + '× pro Woche' : '')
      ]) +
      _rvCard('rv-goal', 'goals', 'Dein Ziel', [
        esc(primary ? primary.title : '—'),
        esc(primary && primary.targetDate ? 'Zieldatum ' + _rvDate(primary.targetDate) : ''),
        goals.length > 1 ? esc('+ ' + (goals.length - 1) + ' weiteres Ziel' + (goals.length > 2 ? 'e' : '')) : ''
      ]) +
      _rvCard('rv-availability', 'availability', 'Verfügbarkeit', [
        esc(days.length + ' Tage pro Woche (' + days.map(function (w) { return w[1]; }).join(', ') + ')'),
        esc(prim && prim.typicalDuration != null ? 'Typische Einheit ~' + prim.typicalDuration + ' min' : '')
      ]) +
      _rvCard('rv-safety', 'safety', 'Sicherheits-Check', [safetyLine]) +
      _rvCard('rv-body', 'body', 'Körperdaten', [
        bodySkipped ? esc('Übersprungen — jederzeit nachtragbar.') :
          esc([pf.heightCm != null ? pf.heightCm + ' cm' : '', pf.weightKg != null ? pf.weightKg + ' kg' : ''].filter(Boolean).join(' · ') || 'Übersprungen — jederzeit nachtragbar.')
      ]) +
      '<div class="ob2-navwrap"><div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button><button type="button" class="btn" id="ob2-finish">Profil erstellen</button></div></div>';
    mountProgressHeader(card, 'Zusammenfassung', 'Alles lässt sich später ändern.');
    // Rücksprünge: gezielt in den jeweiligen Schritt (auch body via Skip-Rücknahme durch Besuch).
    ['profile', 'sports', 'training_level', 'goals', 'availability', 'safety', 'body'].forEach(function (step) {
      var b = card.querySelector('#rv-edit-' + step);
      if (b) b.onclick = function () { S.draft.currentStep = step; render(); };
    });
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-finish').onclick = finishOnboarding;
    focusHeading(); persist();
  }
  /* ============================================================
     M4 · Transaktionaler Onboarding-Abschluss (behebt KNOWN_ISSUES #5).
     buildCompletionPatch: Draft→PROFILE-Mapping. FIX: experienceLevel wird
     jetzt auf sports[primary].level gemappt (kanonisches Ziel laut Feldmatrix);
     vorher ging der erfasste Wert verloren und der Alt-Default blieb stehen.
     completeOnboardingFlow(ctx): dependency-injiziert, testbar. Reihenfolge:
     In-flight-Guard → Profil EXAKT EINMAL über den gemeinsamen Schreibpfad
     anwenden (updateSection; lokaler Blob-Save meldet vertragsgemäß keinen
     Erfolg zurück — dokumentierte Grenze) → profileStore.persist() AWAITEN →
     klassifizieren → ERST DANN Draft completed + completedAt + Draft-Persist
     + genau EIN Completion-Event. Klassifikation der persist-Resultate:
       success+synced → 'synced' · success+pending → 'pending' (Offline-Queue
       = kontrollierter Erfolg) · failure „keine Sitzung"/„Repository fehlt"/
       „Client fehlt" → 'local' (kein Cloud-Kontext, z. B. lokaler First-Run)
       · alles andere / Throw → failed (Draft bleibt in_progress, resümierbar).
     ============================================================ */
  function buildCompletionPatch(dd, M, nowIso) {
    dd = dd || {}; var pf = dd.profile || {}; var patch = {};
    if (pf.displayName != null) patch.name = pf.displayName; else if (pf.firstName) patch.name = pf.firstName;
    if (pf.heightCm != null) patch.heightCm = pf.heightCm; if (pf.weightKg != null) patch.weightKg = pf.weightKg; if (pf.birthDate) patch.birthDate = pf.birthDate; if (pf.sex) patch.sex = pf.sex;
    // M8-Fix: „Nur Alter angeben"-Nutzer (A1) verloren ihr Alter beim Abschluss — ageEstimate mitmappen.
    if (!pf.birthDate && pf.ageEstimate != null && pf.ageEstimate !== '') { var _ae = parseInt(pf.ageEstimate, 10); if (isFinite(_ae)) patch.ageEstimate = _ae; }
    var sportsSel = (dd.sports && Array.isArray(dd.sports.sports)) ? dd.sports.sports : [];
    patch.sports = M.normalizeSports(sportsSel.map(function (e) { return { sportId: e.sportId, customName: e.customName || null, role: e.role || 'supplemental', activeInApp: e.visible !== false, includeInPlan: !!e.planningEnabled, level: e.level || null, sessionsPerWeek: (e.sessionsPerWeek != null ? e.sessionsPerWeek : null), typicalDuration: (e.typicalDuration != null ? e.typicalDuration : null) }; }));   // M5b/M7: A3+A5 pro Sport (kanonisch, KEIN PROFILE.level)
    var lvl = pf.experienceLevel || null;
    if (lvl) patch.sports = patch.sports.map(function (s) { return (s.role === 'primary' && s.level == null) ? Object.assign({}, s, { level: lvl }) : s; });
    patch.goals = M.normalizeGoals((dd.goals || []).filter(function (g) { return g.title && g.title.trim(); }));
    patch.availability = M.normalizeAvailability(dd.availability);
    /* M7 (A6): Sicherheitscheck → kanonische Constraints. Acknowledge NUR bei beantworteter
       Frage (nichts erfinden); bei Ja zusätzlich EIN normalisierter Constraint (status active).
       issues[]-Projektion läuft zentral über _profileSave (kein direkter issues-Write hier). */
    var sf = dd.safety;
    if (sf && typeof sf.hasComplaints === 'boolean') {
      patch.constraintsAcknowledgedAt = nowIso || null;
      if (sf.hasComplaints === true && sf.constraint && sf.constraint.bodyRegion) {
        var existing = Array.isArray(dd.constraintsList) ? dd.constraintsList : [];
        patch.constraintsList = existing.concat([M.normalizeConstraint({
          bodyRegion: sf.constraint.bodyRegion,
          side: sf.constraint.side || '',
          intensity: sf.constraint.intensity,
          status: 'active',
          notes: 'Aus dem Einrichtungs-Sicherheitscheck.'
        }, nowIso)]);
      }
    }
    return patch;
  }
  function _classifyPersist(r) {
    if (r && r.success === true) return (r.sync_status === 'pending') ? 'pending' : 'synced';
    var msg = String((r && r.error && r.error.message) || '');
    if (/Sitzung|Repository fehlt|Client fehlt/i.test(msg)) return 'local';
    return 'failed';
  }
  var FINISH_ERR_MSG = 'Das hat nicht geklappt. Deine Eingaben sind gesichert – versuch es gleich noch einmal.';
  var _completing = false;   // lokaler In-flight-Guard (kein globales, unkontrolliertes Flag)
  function completeOnboardingFlow(ctx) {
    if (_completing) return Promise.resolve({ ok: false, code: 'in_flight' });
    if (!ctx || !ctx.draft) return Promise.resolve({ ok: false, code: 'no_draft', error: 'Kein Entwurf vorhanden.' });
    if (ctx.draft.status === 'completed') return Promise.resolve({ ok: false, code: 'already_completed' });
    _completing = true;
    return Promise.resolve().then(function () {
      var P = ctx.profileApi;
      if (P) { if (P.load) P.load(); if (P.updateSection) P.updateSection('onboarding', ctx.patch, ['personal', 'sports', 'goals', 'availability']); if (P.markOnboardingComplete) P.markOnboardingComplete(); }
      if (!ctx.profileStore || typeof ctx.profileStore.persist !== 'function') return { success: false, error: { message: 'Keine aktive Sitzung.' } };
      return ctx.profileStore.persist();
    }).then(function (r) {
      var cls = _classifyPersist(r);
      if (cls === 'failed') {
        try { console.error('[ORVIA onboarding] Abschluss-Persistenz fehlgeschlagen.', r && r.error && r.error.message); } catch (e) {}
        if (typeof ctx.persistDraft === 'function') ctx.persistDraft();   // Eingaben/Draft sichern → resümierbar
        return { ok: false, code: 'persist_failed', error: FINISH_ERR_MSG };
      }
      ctx.draft.status = 'completed';
      ctx.draft.completedAt = ctx.now();
      if (typeof ctx.persistDraft === 'function') ctx.persistDraft();
      try { if (typeof ctx.onEvent === 'function') ctx.onEvent({ version: 3, syncStatus: cls, completedAt: ctx.draft.completedAt }); } catch (e) {}
      return { ok: true, syncStatus: cls };
    }).catch(function (e) {
      try { console.error('[ORVIA onboarding] Abschluss unerwartet fehlgeschlagen.', e && e.message); } catch (_) {}
      try { if (typeof ctx.persistDraft === 'function') ctx.persistDraft(); } catch (_) {}
      return { ok: false, code: 'unexpected', error: FINISH_ERR_MSG };
    }).then(function (res) { _completing = false; return res; });
  }
  function showFinishError(card, msg) {
    if (!card || !card.querySelector) return;
    var e = card.querySelector('#ob2-finish-err');
    if (!e) {
      var doc = D(); if (!doc) return;
      e = doc.createElement('div'); e.setAttribute('id', 'ob2-finish-err'); e.className = 'ob2-err'; e.setAttribute('role', 'alert');
      card.appendChild(e);
    }
    e.textContent = msg;
  }
  /* ============================================================
     M8/M9 · Erfolgsscreen (kein Auto-Close, ehrliche Erwartung) + Spotlight-Flag.
     Der erste Check-in ist die primäre nächste Aktion (Time-to-Value); das
     user-scoped Flag `orvia_coachmarks_v1:<uid>` merkt das Orientierungs-
     Spotlight für M9 vor (einmalig, dismissbar — Konsument: Heute-Tab).
     ============================================================ */
  function _flagCheckinSpotlight() {
    try {
      var key = 'orvia_coachmarks_v1:' + (uid() || 'anonymous');
      var cur = {};
      try { cur = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { cur = {}; }
      if (!Array.isArray(cur.pending)) cur.pending = [];
      if (cur.pending.indexOf('checkin_spotlight') < 0 && !(cur.shown && cur.shown.indexOf && cur.shown.indexOf('checkin_spotlight') >= 0)) cur.pending.push('checkin_spotlight');
      localStorage.setItem(key, JSON.stringify(cur));
    } catch (e) { /* Flag ist Komfort, nie blockierend */ }
  }
  function _gotoFirstCheckin() {
    closeShell();
    try { if (typeof root.showTab === 'function') root.showTab('heute'); } catch (e) {}
    try { var doc = D(); var f = doc && doc.getElementById('morningForm'); if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }
  function renderFinishDone(syncStatus) {
    mountShell();
    _flagCheckinSpotlight();   // M9: Orientierung auf dem Heute-Tab vormerken (unabhängig vom gewählten CTA)
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML =
      '<div class="ob3-hero"><div class="ob3-successmark" aria-hidden="true">✓</div>' +
      '<h2 id="ob2-title" class="ob3-claim" tabindex="-1">Dein Profil steht.</h2></div>' +
      '<p class="ob3-lead">Nach deinem ersten Check-in bekommst du deine erste Empfehlung.</p>' +
      (syncStatus === 'pending' ? '<p class="ob2-note" role="status">Du bist gerade offline – deine Angaben werden automatisch synchronisiert, sobald du wieder online bist.</p>' : '') +
      '<div class="ob2-nav"><button type="button" class="btn" id="ob2-first-checkin">Ersten Check-in machen</button></div>' +
      '<div class="ob2-nav"><button type="button" class="btn sec" id="ob2-toapp">Zur App</button></div>' +
      '<p class="ob3-trust">Dein Profil kannst du jederzeit über dein Profilbild verfeinern.</p>';
    card.querySelector('#ob2-first-checkin').onclick = _gotoFirstCheckin;
    card.querySelector('#ob2-toapp').onclick = function () { closeShell(); };
    focusHeading();
  }
  function finishOnboarding() {
    if (S.busy || _completing) return;
    S.busy = true;
    _collectGoals();   // M7: Verfügbarkeit/Sicherheitscheck schreiben direkt in den Draft (kein Collect nötig)
    var card = (S.el && S.el.querySelector) ? S.el.querySelector('.ob2-card') : null;
    var btn = (card && card.querySelector) ? card.querySelector('#ob2-finish') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Wird gespeichert …'; }
    var ctx = {
      draft: S.draft,
      patch: buildCompletionPatch(S.draft.draftData || {}, PM(), new Date(now()).toISOString()),
      profileApi: root.ORVIA && root.ORVIA.profile,
      profileStore: root.ORVIA && root.ORVIA.profileStore,
      persistDraft: persist,
      now: now,
      onEvent: function (detail) { try { if (root.dispatchEvent && typeof CustomEvent === 'function') root.dispatchEvent(new CustomEvent('orvia:onboarding-completed', { detail: detail })); } catch (e) {} }
    };
    completeOnboardingFlow(ctx).then(function (res) {
      S.busy = false;
      if (res.ok) { renderFinishDone(res.syncStatus); return; }
      if (res.code === 'in_flight' || res.code === 'already_completed') return;
      if (btn) { btn.disabled = false; btn.textContent = 'Erneut versuchen'; }
      showFinishError(card, res.error || FINISH_ERR_MSG);
    });
  }
  root.ORVIA = root.ORVIA || {};
  // Hilfsfunktionen für Inline-Handler (Tageszeit-Chip, Bearbeiten-Sprung).
  root.ORVIA.onboardingV2 = root.ORVIA.onboardingV2 || {};

  // Review-Schritt: bewusst „zur Prüfung vormerken" → status ready_for_review + Statusansicht.
  function goReviewReady() {
    if (S.busy || navLocked()) return; S.busy = true;
    var r = L().markReadyForReview(S.draft, now());
    if (!r || !r.ok) {
      try { console.warn('[ORVIA onboarding] Review nicht vormerkbar:', r && r.error); } catch (e) {}
      S.reviewError = 'Die Einrichtung konnte noch nicht vorgemerkt werden. Bitte prüfe die vorherigen Schritte.';
      render();   // zeigt den Hinweis sichtbar im Review-Schritt
      S.busy = false; return;
    }
    S.reviewError = '';
    renderReviewDone();   // persistiert am Ende
    S.busy = false;
  }
  function renderReviewDone() {
    mountShell();
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML =
      '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Einrichtung gespeichert</h2>' +
      '<p class="ob2-desc">Dein Basisprofil und deine Sportauswahl sind gespeichert. Du kannst dein Profil, deine Ziele und deinen Trainingsalltag jederzeit bearbeiten.</p>' +
      sportsSummaryHTML() +
      '<div class="ob2-nav"><button type="button" class="btn" id="ob2-edit">Profil bearbeiten</button><button type="button" class="btn sec" id="ob2-close">Schließen</button></div>';
    // Done-Screen ist KEINE Sackgasse: „Profil bearbeiten" steigt direkt in den editierbaren Profil-Schritt ein.
    card.querySelector('#ob2-edit').onclick = function () { S.draft.currentStep = 'profile'; render(); };
    card.querySelector('#ob2-close').onclick = function () { closeShell(); };
    focusHeading();
    persist();
  }

  // Zeitbasierter Schutz: zwei schnelle Klicks dürfen NICHT zwei Schritte weiterspringen.
  function navLocked() { var t = now(); if (t - S.lastNav < NAV_LOCK_MS) return true; S.lastNav = t; return false; }
  // Vor Navigation/Schließen/Background unvollständige Eingaben des aktuellen Schritts sichern.
  function captureCurrentStep() {
    // Nur bei VOLLSTÄNDIGEM Modul aus dem Formular lesen (Teilmodul rendert kein Formular → kein Überschreiben).
    if (S.draft && S.draft.currentStep === 'profile' && plFull() && S.draft.draftData && S.draft.draftData.profile) {
      try { readProfileForm(); } catch (e) { try { console.error('[ORVIA onboarding] Aktueller Schritt konnte nicht vollständig erfasst werden.', e); } catch (_) {} }
    }
    // M6: ungespeicherte Ziel-Details (Titel/Datum) bei Escape/Background sichern.
    if (S.draft && S.draft.currentStep === 'goals' && PM()) {
      try { _collectGoals(); } catch (e) { try { console.error('[ORVIA onboarding] Ziel-Details konnten nicht erfasst werden.', e); } catch (_) {} }
    }
    // M7 (A7): ungespeicherte Körperdaten bei Escape/Background sichern.
    if (S.draft && S.draft.currentStep === 'body' && plFull()) {
      try { readBodyForm(); } catch (e) { try { console.error('[ORVIA onboarding] Körperdaten konnten nicht erfasst werden.', e); } catch (_) {} }
    }
  }
  function captureAndPersist() { try { captureCurrentStep(); } catch (e) {} persist(); }   // für visibility/beforeunload
  function goNext() { if (S.busy || navLocked()) return; S.busy = true; S.reviewError = ''; L().advance(S.draft, now()); render(); S.busy = false; }
  function goBack() { if (S.busy || navLocked()) return; S.busy = true; S.reviewError = ''; captureCurrentStep(); L().back(S.draft, now()); render(); S.busy = false; }
  function later() { captureCurrentStep(); closeShell(); }   // unvollständige Eingaben sichern, dann speichern+schließen
  function closeShell(opts) {
    var doPersist = !(opts && opts.persist === false);  // „Später"/regulär: speichern · Abbrechen: nicht
    if (doPersist) persist();
    if (S.el) { try { S.el.remove(); } catch (e) {} S.el = null; }
    var doc = D(); if (doc) doc.documentElement.classList.remove('ob2-open');
    S.busy = false; S.lastNav = 0; S.corruptNote = false;   // flüchtige UI-Zustände zurücksetzen
    try { if (S.previousFocus && S.previousFocus.focus) S.previousFocus.focus(); } catch (e) {} // Fokus-Restore
    S.previousFocus = null;
  }

  function focusHeading() {
    var doc = D(); if (!doc) return;
    try { var h = doc.getElementById('ob2-title'); if (h && h.focus) setTimeout(function () { try { h.focus(); } catch (e) {} }, 0); } catch (e) {}
  }

  /* ---------- Basisprofil-Schritt (erstes fachliches Modul) ---------- */
  var SEX_LABELS = [['male', 'Männlich'], ['female', 'Weiblich'], ['diverse', 'Divers'], ['prefer_not_to_say', 'Keine Angabe']];
  var LEVEL_LABELS = [['beginner', 'Anfänger'], ['intermediate', 'Fortgeschritten'], ['advanced', 'Erfahren'], ['competitive', 'Wettkampforientiert']];
  // M5a (A1): Über dich = Name + Geburtsdatum|Alter + Geschlecht(optional).
  // Größe/Gewicht → Schritt A7 (M5c), Trainingsstand → A3 (M5b).
  var FIELD_ORDER = ['displayName', 'birthDate', 'ageEstimate', 'sex'];
  var FIELD_INPUT = { displayName: 'pf-displayName', birthDate: 'pf-birthDate', ageEstimate: 'pf-age', sex: 'pf-sex-cards' };

  // Dirty-Flags je Maßeingabe: nur tatsächlich vom Nutzer geänderte Maße werden zurückgelesen
  // (verhindert Drift durch Rück-Konvertierung gerundeter Anzeigewerte beim Einheitenwechsel).
  function ensureProfileDraft() {
    S.draft.draftData = S.draft.draftData || {};
    if (!S.draft.draftData.profile) {
      // Vorschlag NUR bei leerem Profil-Draft; kontrollierte Seed-Funktion (verwirft Unbekanntes).
      /* ROLLEN-FIX (2026-07-15): O.profile ist produktiv der Profil-API-Adapter (profile.js).
         Seed über get() aus dem Trainingsprofil; ein Plain-Datenobjekt (Alt-Vertrag/Tests)
         bleibt als direkte Quelle gültig. Die Auth-Access-Zeile liegt jetzt kollisionsfrei
         in O.accessProfile und landet hier nie mehr. */
      var _seedSrc = {};
      if (O.profile && typeof O.profile.get === 'function') _seedSrc = O.profile.get() || {};
      else if (O.profile && typeof O.profile === 'object') _seedSrc = O.profile;
      S.draft.draftData.profile = PL().profileSeedFromExisting(_seedSrc);
    }
    return S.draft.draftData.profile;
  }
  function curProfileErrors() { return PL().validateProfile(S.draft.draftData.profile).errors; }
  function errText(errors, f) { return (S.profileSubmitted && errors[f]) ? errors[f] : ''; }
  function ai(errors, f) { return (S.profileSubmitted && errors[f]) ? ' aria-invalid="true"' : ''; }
  function field(label, inputId, inner, f, errors, hint) {
    return '<div class="ob2-field">' +
      '<label for="' + inputId + '">' + esc(label) + '</label>' +
      (hint ? '<p class="ob2-hint" id="hint-' + f + '">' + esc(hint) + '</p>' : '') + inner +
      '<span class="ob2-err" id="err-' + f + '" role="alert">' + esc(errText(errors, f)) + '</span></div>';
  }

  /* ============================================================
     M5a · A0 Welcome + A1 „Über dich" (Redesign-Plan D, Rev. 1).
     A0: kein Fortschritt, keine Eingaben, keine erfundenen Features.
     A1: Name (Pflicht) + Geburtsdatum ODER Alter (Pflicht-Alternative) +
     Geschlecht optional als ChoiceCards. Größe/Gewicht → A7 (M5c),
     Trainingsstand → A3 (M5b). ProgressHeader/ChoiceCard/InlineHelp aus dem
     UI-Kit (M2); fehlt das Kit → fail-closed (wie Profil-Logik).
     Übergangs-Progressvertrag: getProgress() zählt NUR aktive Arbeitsschritte
     (z. B. „1 von 5", solange M5b/M5c-Steps active:false sind) — keine
     harte Zahl im UI, keine „von 8"-Behauptung vor deren Aktivierung.
     ============================================================ */
  function K() { return O.profileUiKit; }
  // M5b: Vertrag erweitert — A2/A3 nutzen zusätzlich createSegmentedControl (fail-closed, wie gehabt).
  function kitFull() { var k = K(); return !!(k && ['createChoiceCard', 'createInlineHelp', 'createProgressHeader', 'createSegmentedControl'].every(function (n) { return typeof k[n] === 'function'; })); }
  // Kanonische Sport-Icon-Referenzen (App-SVG-Symbole in index.html; Fallback #i-pulse).
  var SPORT_ICON_REFS = { run: '#i-run', dumbbell: '#i-dumbbell', bike: '#i-bike', swim: '#i-swim', ball: '#i-ball', racket: '#i-racket', row: '#i-row', triathlon: '#i-medal', athletics: '#i-timer', hike: '#i-hike', walk: '#i-walk', pulse: '#i-pulse', stretch: '#i-stretch' };
  function sportIconRef(catEntry) { return (catEntry && SPORT_ICON_REFS[catEntry.icon]) || '#i-pulse'; }
  // Kit-ProgressHeader einheitlich mounten: Zahlen NUR aus getProgress(), Titel wird ob2-title (Fokusziel).
  function mountProgressHeader(card, title, supportingText) {
    var gp = L().getProgress(S.draft);
    var ph = K().createProgressHeader({ title: title, current: gp.current, total: gp.total, allowBack: true, onBack: goBack, supportingText: supportingText || '' });
    var t = ph.el.querySelector('.pf-progress-title');
    if (t) { t.setAttribute('id', 'ob2-title'); t.setAttribute('tabindex', '-1'); }
    var slot = card.querySelector('#ob3-progress');
    if (slot) slot.appendChild(ph.el);
    return ph;
  }

  function renderWelcome(showCorrupt) {
    mountShell();
    var corrupt = (S.corruptNote || showCorrupt)
      ? '<p class="ob2-note" role="status">Der gespeicherte Fortschritt konnte nicht vollständig geladen werden. Wir starten an einer sicheren Stelle.</p>' : '';
    S.corruptNote = false;
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML = corrupt +
      '<div class="ob3-hero">' +
        '<svg class="ob3-mark" viewBox="0 0 512 512" aria-hidden="true"><use href="#orvia-mark"/></svg>' +
        '<div class="ob3-brand">ORVIA</div>' +
        '<h2 id="ob2-title" class="ob3-claim" tabindex="-1">Know your state.</h2>' +
      '</div>' +
      '<p class="ob3-lead">ORVIA erstellt dein persönliches Leistungsprofil. Training, Tagesform und Ziele – präzise auf dich abgestimmt.</p>' +
      '<ul class="ob3-benefits">' +
        '<li>Training passend zu deinem Alltag</li>' +
        '<li>Tagesform verständlich einordnen</li>' +
        '<li>Ziele strukturiert verfolgen</li>' +
      '</ul>' +
      '<p class="ob3-trust">Deine Angaben bleiben in deinem Konto und lassen sich jederzeit ändern. Details findest du in der App unter „Datenschutz &amp; Sicherheit".</p>' +
      '<p class="ob3-duration">Die Grundeinrichtung dauert etwa 4 Minuten.</p>' +
      '<div class="ob2-nav"><button type="button" class="btn" id="ob3-start">Profil einrichten</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button>';
    card.querySelector('#ob3-start').onclick = goNext;
    card.querySelector('#ob2-later').onclick = later;
    focusHeading();
    persist();
  }

  /* Modus ist UI-Zustand: aus den Daten allein wäre „Alter gewählt, aber noch leer"
     nicht darstellbar (fiele auf Datum zurück). S.birthMode hält die Nutzerwahl,
     Ableitung aus den Daten ist nur der Startwert. */
  function birthMode(p) { return S.birthMode || ((!p.birthDate && p.ageEstimate != null) ? 'age' : 'date'); }
  function renderProfileStep() {
    mountShell();
    if (!kitFull()) { renderProfileUnavailable(); return; }
    var p = ensureProfileDraft(); var errors = curProfileErrors();
    var mode = birthMode(p);
    var birthInput = (mode === 'age')
      ? field('Dein Alter', 'pf-age', '<input id="pf-age" type="number" inputmode="numeric" min="13" max="100" step="1" value="' + esc(p.ageEstimate != null ? p.ageEstimate : '') + '" autocomplete="off" aria-describedby="err-ageEstimate"' + ai(errors, 'ageEstimate') + '>', 'ageEstimate', errors)
      : field('Geburtsdatum', 'pf-birthDate', '<input id="pf-birthDate" type="date" autocomplete="bday" value="' + esc(p.birthDate || '') + '" aria-describedby="err-birthDate"' + ai(errors, 'birthDate') + '>', 'birthDate', errors);

    var card = S.el.querySelector('.ob2-card');
    card.innerHTML =
      '<div id="ob3-progress"></div>' +
      '<form class="ob2-form ob3-form" autocomplete="on" novalidate>' +
        field('Wie dürfen wir dich nennen?', 'pf-displayName', '<input id="pf-displayName" type="text" maxlength="50" autocomplete="name" value="' + esc(p.displayName || '') + '" aria-describedby="err-displayName"' + ai(errors, 'displayName') + '>', 'displayName', errors) +
        '<div id="ob3-birthmode" class="ob3-birthmode"></div>' +
        birthInput +
        '<div class="ob2-field"><span class="ob3-grouplabel" id="lbl-sex">Geschlecht <span class="ob3-optional">(optional)</span></span>' +
          '<span id="ob3-sex-help"></span>' +
          '<div id="pf-sex-cards" class="ob3-sexcards" role="group" aria-labelledby="lbl-sex"></div>' +
          '<span class="ob2-err" id="err-sex" role="alert">' + esc(errText(errors, 'sex')) + '</span>' +
        '</div>' +
      '</form>' +
      '<div class="ob2-nav">' +
        '<button type="button" class="btn sec" id="ob2-back">Zurück</button>' +
        '<button type="button" class="btn" id="ob2-next">Weiter</button>' +
      '</div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button>';

    var doc = D(); var kit = K();
    // ProgressHeader (Kit): Zahlen ausschließlich aus getProgress() — keine harte Zahl im UI.
    var gp = L().getProgress(S.draft);
    var ph = kit.createProgressHeader({ title: 'Über dich', current: gp.current, total: gp.total, allowBack: true, onBack: goBack, supportingText: 'Alles lässt sich später ändern.' });
    var phT = ph.el.querySelector('.pf-progress-title');
    if (phT) { phT.setAttribute('id', 'ob2-title'); phT.setAttribute('tabindex', '-1'); }
    card.querySelector('#ob3-progress').appendChild(ph.el);

    // Geburtsdatum ⇄ Alter (SegmentedControl): Wechsel leert bewusst die jeweils andere Angabe.
    var seg = kit.createSegmentedControl({
      name: 'birthmode', label: 'Geburtsdatum oder Alter angeben',
      options: [{ value: 'date', label: 'Geburtsdatum', id: 'pf-birthmode-date' }, { value: 'age', label: 'Nur Alter angeben', id: 'pf-birthmode-age' }],
      value: mode,
      onChange: function (v) {
        readProfileForm();
        S.birthMode = v;
        if (v === 'age') { p.birthDate = ''; } else { p.ageEstimate = null; }
        renderProfileStep();   // persistiert am Ende
      }
    });
    card.querySelector('#ob3-birthmode').appendChild(seg.el);

    // Geschlecht als ChoiceCards (optional; „Keine Angabe" neutral vorbelegt, ohne Draft-Write).
    var sexWrap = card.querySelector('#pf-sex-cards');
    var sexCards = SEX_LABELS.map(function (o) {
      var isSel = p.sex ? (p.sex === o[0]) : (o[0] === 'prefer_not_to_say');
      var c = kit.createChoiceCard({
        id: 'pf-sex-' + o[0], label: o[1], mode: 'single', value: o[0], selected: isSel,
        onChange: function (val) {
          p.sex = val;
          sexCards.forEach(function (sc, i) { sc.setSelected(SEX_LABELS[i][0] === val); });
          persist();
        }
      });
      sexWrap.appendChild(c.el);
      return c;
    });
    var help = kit.createInlineHelp({
      label: 'Warum fragen wir das?', title: 'Geschlecht (optional)',
      content: 'Optional. Kann später bei einzelnen körperbezogenen Referenzwerten berücksichtigt werden.'
    });
    card.querySelector('#ob3-sex-help').appendChild(help.el);

    ['pf-displayName', 'pf-birthDate', 'pf-age'].forEach(function (id) {
      var el = doc.getElementById(id); if (!el) return;
      el.addEventListener('change', onProfileInput); el.addEventListener('blur', onProfileInput);
      el.addEventListener('input', onProfileInputLive);
    });
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-next').onclick = submitProfile;
    card.querySelector('#ob2-later').onclick = later;
    if (S.profileSubmitted) updateProfileErrors();
    focusHeading();
    persist();
  }
  // Fail-closed-Ansicht: Profil-Logik fehlt/unvollständig. Kein Weiter, App gesperrt; „Später" speichert sicher.
  function renderProfileUnavailable() {
    mountShell();
    try { console.error('[ORVIA onboarding] onboardingProfileLogic fehlt oder ist unvollständig — Profil-Schritt gesperrt.'); } catch (e) {}
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML = progressHTML() +
      '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Basisprofil nicht verfügbar</h2>' +
      '<p class="ob2-desc">Das Basisprofil kann gerade nicht geladen werden. Bitte starte die App neu.</p>' +
      '<div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button>';
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-later').onclick = later;
    focusHeading();
    persist();
  }
  // Einheitenwechsel: aktuelle (ggf. ungespeicherte) Eingaben kanonisch sichern, dann umschalten + neu rendern (rendert speichert).
  /* M5a: A1 liest nur Name + aktive Geburts-/Alters-Eingabe; Geschlecht wird
     direkt von den ChoiceCards in den Draft geschrieben. Größe/Gewicht/Niveau
     bleiben im Draft unangetastet (Erfassung folgt in A7/A3). */
  function readProfileForm() {
    var doc = D(); if (!doc) return; var p = S.draft.draftData.profile;
    function v(id) { var e = doc.getElementById(id); return e ? e.value : null; }
    var dn = v('pf-displayName'); if (dn != null) p.displayName = (dn || '').trim();
    var bd = v('pf-birthDate'); if (bd != null) p.birthDate = bd || '';
    var ag = v('pf-age'); if (ag != null) p.ageEstimate = (ag === '' ? null : ag);
  }
  function onProfileInput() { readProfileForm(); persist(); if (S.profileSubmitted) updateProfileErrors(); }
  function onProfileInputLive() { if (!S.profileSubmitted) return; readProfileForm(); updateProfileErrors(); } // erst nach Submit live
  function updateProfileErrors() {
    var doc = D(); if (!doc) return; var errors = PL().validateProfile(S.draft.draftData.profile).errors;
    FIELD_ORDER.forEach(function (f) {
      var span = doc.getElementById('err-' + f); if (span) span.textContent = errors[f] || '';
      setInvalid(doc.getElementById(FIELD_INPUT[f]), errors[f]);
    });
  }
  function setInvalid(inp, hasErr) { if (!inp) return; if (hasErr) inp.setAttribute('aria-invalid', 'true'); else if (inp.removeAttribute) inp.removeAttribute('aria-invalid'); }
  function focusFirstError(errors) {
    var doc = D(); if (!doc) return;
    for (var i = 0; i < FIELD_ORDER.length; i++) {
      var f = FIELD_ORDER[i];
      if (errors[f]) { var inp = doc.getElementById(FIELD_INPUT[f]); if (inp && inp.focus) { try { inp.focus(); } catch (e) {} } return; }
    }
  }
  // Weiter im Profil: ausschließlich über die fachliche Logik (advanceProfile) — validiert + schließt nur bei Gültigkeit ab.
  function submitProfile() {
    if (S.busy || navLocked()) return; S.busy = true;
    readProfileForm();
    var r = L().advanceProfile(S.draft, now());
    if (!r.ok) { S.profileSubmitted = true; renderProfileStep(); focusFirstError(r.errors); S.busy = false; return; } // renderProfileStep persistiert
    S.profileSubmitted = false; S.birthMode = null;
    render(); S.busy = false;
  }

  /* ---------- Sportarten-Schritt ---------- */
  function ensureSportsDraft() {
    S.draft.draftData = S.draft.draftData || {};
    if (!S.draft.draftData.sports) {
      var src = { sports: (O.profile && O.profile.sports) || (root.PROFILE && root.PROFILE.sports) || [] };
      S.draft.draftData.sports = SL().seedFromExistingProfile(src);   // Vorschlag nur bei leerem Sport-Draft
    }
    return S.draft.draftData.sports;
  }
  function sportsErrors() { return SL().validateSportsSelection(S.draft.draftData.sports).errors; }
  function setSports(next) { S.draft.draftData.sports = next; renderSportsStep(); }   // renderSportsStep persistiert (ein Save)
  function primaryEntry(sel) { var p = null; if (sel && Array.isArray(sel.sports)) sel.sports.forEach(function (e) { if (e.role === 'primary') p = e; }); return p; }

  /* M5b (A2, Essential-Redesign): Sport-Katalog als ChoiceCard-Grid + Hauptsport-Wahl.
     Modus (geplant/gelegentlich), Sichtbarkeit und Priorität sind EBENE B (sport_profile,
     Profil-Editoren) — die sports-logic-Funktionen dafür bleiben unverändert bestehen.
     Fail-closed: ohne vollständiges Kit rendert der Schritt nicht (kein Chip-Fallback). */
  function renderSportsStep() {
    mountShell();
    if (!kitFull()) { renderSportsUnavailable(); return; }
    var sl = SL(); var kit = K(); var sel = ensureSportsDraft(); var errors = sportsErrors(); var showErr = S.sportsSubmitted;
    var chosen = sel.sports.map(function (e) { return e.sportId; });
    var selErr = (showErr && errors._selection) ? errors._selection : '';
    var priErr = (showErr && errors._primary) ? errors._primary : '';
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML =
      '<div id="ob3-progress"></div>' +
      '<p class="ob2-desc">Wähle alles aus, was du regelmäßig oder gelegentlich machst. Details stellst du später im Profil ein.</p>' +
      '<div class="ob2-field"><span class="ob3-grouplabel" id="sports-a-label">Welche Sportarten machst du?</span>' +
        '<span class="ob2-err" id="err-sports" role="alert">' + esc(selErr) + '</span>' +
        '<div id="ob3-sportgrid" class="ob3-choicegrid" role="group" aria-labelledby="sports-a-label"' + (selErr ? ' aria-describedby="err-sports" aria-invalid="true"' : '') + '></div></div>' +
      '<div id="ob3-primarysec">' + (chosen.length ?
        '<div class="ob2-field"><span class="ob3-grouplabel" id="sports-b-label">Was ist dein Hauptsport?</span>' +
        '<p class="ob2-hint">Dein Hauptsport erhält bei Zielen und Planung die höchste Priorität.</p>' +
        '<span class="ob2-err" id="err-primary" role="alert">' + esc(priErr) + '</span>' +
        '<div id="ob3-primarylist" class="ob3-choicegrid" role="group" aria-labelledby="sports-b-label"' + (priErr ? ' aria-describedby="err-primary" aria-invalid="true"' : '') + '></div></div>' : '') + '</div>' +
      '<div class="ob2-navwrap"><div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button><button type="button" class="btn" id="ob2-next">Weiter</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button></div>';
    mountProgressHeader(card, 'Deine Sportarten', 'Mehrfachauswahl möglich.');
    // Abschnitt A: kompletter Katalog als ChoiceCards (aria-pressed + Häkchen kommen aus dem Kit).
    var grid = card.querySelector('#ob3-sportgrid');
    sl.SPORT_CATALOG.forEach(function (sp) {
      var c = kit.createChoiceCard({
        id: 'spc-' + sp.id, label: sp.label, mode: 'multiple', value: sp.id,
        selected: chosen.indexOf(sp.id) >= 0, iconRef: sportIconRef(sp),
        onChange: function () { setSports(sl.toggleSport(S.draft.draftData.sports, sp.id)); }
      });
      grid.appendChild(c.el);
    });
    // Abschnitt B: Hauptsport als Single-ChoiceCards über alle gewählten PLANBAREN Sportarten.
    if (chosen.length) {
      var plist = card.querySelector('#ob3-primarylist');
      sel.sports.filter(function (e) { return sl.plannable(e.sportId); }).forEach(function (e) {
        var catEntry = sl.CATALOG_BY_ID[e.sportId];
        var c = kit.createChoiceCard({
          id: 'prc-' + e.sportId, label: catEntry.label, mode: 'single', value: e.sportId,
          selected: e.role === 'primary', iconRef: sportIconRef(catEntry),
          onChange: function () { setSports(sl.setPrimarySport(S.draft.draftData.sports, e.sportId)); }
        });
        plist.appendChild(c.el);
      });
    }
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-next').onclick = submitSports;
    card.querySelector('#ob2-later').onclick = later;
    focusHeading();
    persist();
  }
  function submitSports() {
    if (S.busy || navLocked()) return; S.busy = true;
    var r = L().advanceSports(S.draft, now());
    if (!r.ok) { S.sportsSubmitted = true; renderSportsStep(); focusFirstSportsError(r.errors); S.busy = false; return; }
    S.sportsSubmitted = false; render(); S.busy = false;
  }
  function focusFirstSportsError(errors) {
    var doc = D(); if (!doc) return; var sl = SL();
    if (errors._selection) { var c = sl.SPORT_CATALOG[0]; var el = doc.getElementById('spc-' + c.id); if (el && el.focus) { try { el.focus(); } catch (e) {} } return; }
    if (errors._primary) { var first = (S.draft.draftData.sports.sports || []).filter(function (e) { return sl.plannable(e.sportId); })[0]; if (first) { var p = doc.getElementById('prc-' + first.sportId); if (p && p.focus) { try { p.focus(); } catch (e) {} } } }
  }

  /* ---------- M5b (A3): Trainingsstand der Hauptsportart ---------- */
  var LEVEL_CARDS = [
    ['beginner', 'Anfänger', 'Ich starte gerade oder steige nach längerer Pause wieder ein.'],
    ['intermediate', 'Fortgeschritten', 'Ich trainiere seit einigen Monaten regelmäßig.'],
    ['advanced', 'Erfahren', 'Ich trainiere seit Jahren strukturiert.'],
    ['competitive', 'Wettkampforientiert', 'Ich trainiere gezielt auf Wettkämpfe und Leistung.']
  ];
  function updateTrainingErrors() {
    var doc = D(); if (!doc) return;
    var errors = SL().validateTrainingLevel(S.draft.draftData.sports).errors;
    var l = doc.getElementById('err-level'); if (l) l.textContent = errors._level || '';
    var s = doc.getElementById('err-sessions'); if (s) s.textContent = errors._sessions || '';
  }
  function renderTrainingLevelStep() {
    mountShell();
    var sl = SL(); var kit = K(); var sel = ensureSportsDraft();
    var prim = primaryEntry(sel);
    var primCat = prim ? sl.CATALOG_BY_ID[prim.sportId] : null;
    var errors = sl.validateTrainingLevel(sel).errors;
    var show = S.trainingSubmitted;
    var lvlErr = (show && errors._level) ? errors._level : '';
    var sesErr = (show && errors._sessions) ? errors._sessions : '';
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML =
      '<div id="ob3-progress"></div>' +
      (errors._primary ? '<p class="ob2-note" role="status">' + esc(errors._primary) + ' Geh dazu einen Schritt zurück.</p>' : '') +
      '<div class="ob2-field"><span class="ob3-grouplabel" id="lbl-level">Wie trainierst du aktuell' + (primCat ? ' – ' + esc(primCat.label) : '') + '?</span>' +
        '<span id="ob3-level-help"></span>' +
        '<span class="ob2-err" id="err-level" role="alert">' + esc(lvlErr) + '</span>' +
        '<div id="ob3-levelcards" class="ob3-stack" role="group" aria-labelledby="lbl-level"></div></div>' +
      '<div class="ob2-field"><span class="ob3-grouplabel" id="lbl-sessions">Wie oft trainierst du pro Woche?</span>' +
        '<span class="ob2-err" id="err-sessions" role="alert">' + esc(sesErr) + '</span>' +
        '<div id="ob3-sessionband"></div></div>' +
      '<div class="ob2-navwrap"><div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button><button type="button" class="btn" id="ob2-next">Weiter</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button></div>';
    mountProgressHeader(card, 'Dein Trainingsstand', 'Bezieht sich auf deinen Hauptsport.');
    var help = kit.createInlineHelp({
      label: 'Warum fragen wir das?', title: 'Trainingsstand',
      content: 'Damit ordnet ORVIA Umfang, Intensität und Progression realistisch ein. Deine Angabe bezieht sich auf deinen Hauptsport und lässt sich jederzeit ändern.'
    });
    card.querySelector('#ob3-level-help').appendChild(help.el);
    // Frage 1: Niveau als ChoiceCards mit Subtext (Einzelauswahl über die Gruppe).
    var wrap = card.querySelector('#ob3-levelcards');
    var lvlCards = LEVEL_CARDS.map(function (row) {
      var c = kit.createChoiceCard({
        id: 'lvl-' + row[0], label: row[1], description: row[2], mode: 'single', value: row[0],
        selected: !!(prim && prim.level === row[0]),
        onChange: function (val) {
          if (!prim) return;
          S.draft.draftData.sports = sl.setTrainingLevel(S.draft.draftData.sports, prim.sportId, val);
          lvlCards.forEach(function (lc, i) { lc.setSelected(LEVEL_CARDS[i][0] === val); });
          persist();
          if (S.trainingSubmitted) updateTrainingErrors();
        }
      });
      wrap.appendChild(c.el);
      return c;
    });
    // Frage 2: Frequenzband als SegmentedControl — bewusst OHNE Vorauswahl (allowEmpty, kein Default).
    var band = kit.createSegmentedControl({
      name: 'sessions-band', label: 'Einheiten pro Woche', allowEmpty: true,
      options: sl.SESSION_BANDS.map(function (b) { return { value: b.id, label: b.label, id: 'band-' + b.id }; }),
      value: prim ? sl.bandForSessions(prim.sessionsPerWeek) : null,
      onChange: function (bandId) {
        if (!prim) return;
        S.draft.draftData.sports = sl.setSessionsPerWeek(S.draft.draftData.sports, prim.sportId, sl.sessionsForBand(bandId));
        persist();
        if (S.trainingSubmitted) updateTrainingErrors();
      }
    });
    card.querySelector('#ob3-sessionband').appendChild(band.el);
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-next').onclick = submitTrainingLevel;
    card.querySelector('#ob2-later').onclick = later;
    focusHeading();
    persist();
  }
  function submitTrainingLevel() {
    if (S.busy || navLocked()) return; S.busy = true;
    var r = L().advanceTrainingLevel(S.draft, now());
    if (!r.ok) {
      S.trainingSubmitted = true; renderTrainingLevelStep();
      var doc = D();
      if (doc) { var t = r.errors._level ? doc.getElementById('lvl-beginner') : doc.getElementById('band-1-2'); if (t && t.focus) { try { t.focus(); } catch (e) {} } }
      S.busy = false; return;
    }
    S.trainingSubmitted = false; render(); S.busy = false;
  }
  // Fail-closed-Ansicht: Sport-Logik fehlt/unvollständig.
  function renderSportsUnavailable() {
    mountShell();
    try { console.error('[ORVIA onboarding] onboardingSportsLogic fehlt oder ist unvollständig — Sport-Schritt gesperrt.'); } catch (e) {}
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML = progressHTML() +
      '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Sportauswahl nicht verfügbar</h2>' +
      '<p class="ob2-desc">Die Sportauswahl kann gerade nicht geladen werden. Bitte starte die App neu.</p>' +
      '<div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button>';
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-later').onclick = later;
    focusHeading();
    persist();
  }
  // Kompakte Sport-Zusammenfassung für den Review-Schritt.
  function sportsSummaryHTML() {
    if (!slFull() || !S.draft || !S.draft.draftData || !S.draft.draftData.sports) return '';
    var sl = SL(), sel = S.draft.draftData.sports, byId = sl.CATALOG_BY_ID;
    function lbls(ids) { return ids.map(function (id) { return byId[id] ? byId[id].label : id; }).join(', '); }
    var primary = sl.getPrimarySport(sel), planned = sl.getPlannedSports(sel), occ = sl.getOccasionalSports(sel);
    var hidden = sel.sports.filter(function (e) { return !e.visible; }).map(function (e) { return e.sportId; });
    var rows = [];
    if (primary) rows.push('Hauptsportart: ' + lbls([primary]));
    if (planned.length) rows.push('Aktiv geplant: ' + lbls(planned));
    if (occ.length) rows.push('Gelegentlich: ' + lbls(occ));
    if (hidden.length) rows.push('Ausgeblendet: ' + lbls(hidden));
    if (!rows.length) return '';
    return '<div class="ob2-summary">' + rows.map(function (r) { return '<div>' + esc(r) + '</div>'; }).join('') + '</div>';
  }

  O.onboardingV2 = {
    open: open, debugOpen: debugOpen, _state: S, _trapTarget: trapTarget, _focusSelector: FOCUS_SEL,
    _editStep: function (step) { if (L().STEP_IDS.indexOf(step) >= 0) { S.draft.currentStep = step; render(); } },
    renderGoalsStep: renderGoalsStep, renderAvailabilityStep: renderAvailabilityStep, renderSafetyStep: renderSafetyStep, renderBodyStep: renderBodyStep, renderSummaryStep: renderSummaryStep, finishOnboarding: finishOnboarding,
    // M4: testbare Abschluss-Bausteine (interne API für Tests; kein UI-Vertrag).
    _m4: { buildCompletionPatch: buildCompletionPatch, completeOnboardingFlow: completeOnboardingFlow },
    _reset: function () { S.draft = null; S.el = null; S.busy = false; S.lastNav = 0; S.corruptNote = false; S.previousFocus = null; S.profileSubmitted = false; S.birthMode = null; S.heightDirty = false; S.weightDirty = false; S.reviewError = ''; S.sportsSubmitted = false; S.trainingSubmitted = false; S.goalsSubmitted = false; S.availabilitySubmitted = false; S.safetySubmitted = false; S.bodySubmitted = false; }
  };

  // EINZIGER produktiver Onboarding-Einstieg. Öffnet ausschließlich v2. KEIN Legacy-Fallback.
  root.openOrviaOnboarding = function (options) {
    options = options || {};
    var ob = root.ORVIA && root.ORVIA.onboardingV2;
    if (ob && typeof ob.open === 'function') {
      return ob.open({ fresh: options.fresh === true, edit: options.edit === true, source: options.source || 'unknown' }) === true;
    }
    try { console.error('[ORVIA onboarding] Onboarding v2 ist nicht verfügbar.'); } catch (e) {}
    return false;
  };

  // EINZIGER produktiver Einstieg zum PROFIL-BEARBEITEN. Setzt immer fresh:false + edit:true.
  // Alle sichtbaren „Profil bearbeiten"-Buttons müssen ausschließlich diese Funktion verwenden.
  root.ORVIA = root.ORVIA || {};
  root.ORVIA.openProfileEditor = function () {
    return root.openOrviaOnboarding({ fresh: false, edit: true, source: 'profile' });
  };

  // Pending-Onboarding (nach Registrierung). FAIL-CLOSED: kein Legacy, kein stiller Fallback.
  root.openPendingOnboarding = function () {
    if (typeof root.openOrviaOnboarding === 'function') {
      return root.openOrviaOnboarding({ fresh: true, source: 'registration' });
    }
    try { console.error('[ORVIA onboarding] Pending-Onboarding konnte nicht geöffnet werden.'); } catch (e) {}
    return false;
  };

  // Legacy-18-Schritte-Onboarding NUR im ausdrücklichen Debug-Modus erreichbar (nicht in produktiver UI).
  root.ORVIA = root.ORVIA || {};
  root.ORVIA.legacyOnboardingDebugOpen = function () {
    var dbg = (root.ORVIA_DEBUG === true) || (root.ORVIA_CFG && root.ORVIA_CFG.debug === true);
    if (!dbg) { try { console.warn('[ORVIA onboarding] Legacy-Onboarding ist nur im Debug-Modus erreichbar.'); } catch (e) {} return false; }
    if (typeof root.openOnboarding !== 'function') return false;
    root.openOnboarding(true);
    return true;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
