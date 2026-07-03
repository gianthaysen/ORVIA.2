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

  var S = { draft: null, userId: null, el: null, busy: false, lastNav: 0, corruptNote: false, bound: false, previousFocus: null, profileSubmitted: false, birthMode: null, heightDirty: false, weightDirty: false, reviewError: '', sportsSubmitted: false };
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
    if (S.draft.currentStep === 'goals_placeholder') { renderGoalsStep(); return; }
    if (S.draft.currentStep === 'schedule_placeholder') { renderScheduleStep(); return; }
    if (S.draft.currentStep === 'review_placeholder') { renderSummaryStep(); return; }
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
  var OB_TIMES = [['morning', 'Morgens'], ['noon', 'Mittags'], ['afternoon', 'Nachmittags'], ['evening', 'Abends'], ['flexible', 'Flexibel']];
  function curGoals() { S.draft.draftData = S.draft.draftData || {}; if (!Array.isArray(S.draft.draftData.goals)) { var seed = (O.profile && O.profile.goals) || (root.PROFILE && root.PROFILE.goals) || []; S.draft.draftData.goals = PM() ? PM().normalizeGoals(seed) : seed.slice(); } return S.draft.draftData.goals; }
  function _collectGoals() { var goals = curGoals(); goals.forEach(function (g, i) { var t = S.el && S.el.querySelector('#obg-title-' + i); if (t) g.title = t.value; }); S.draft.draftData.goals = PM() ? PM().normalizeGoals(goals) : goals; }
  function renderGoalsStep() {
    mountShell(); var card = S.el.querySelector('.ob2-card'); var M = PM(); var goals = curGoals();
    var roleDE = { main: 'Hauptziel', secondary: 'Weiteres Ziel', maintain: 'Erhaltungsziel' };
    var rows = goals.map(function (g, i) { var role = (M && M.roleOfGoal) ? M.roleOfGoal(g) : 'secondary'; if (['main', 'secondary', 'maintain'].indexOf(role) < 0) role = 'secondary';
      return '<div class="ob2-goalrow"><input class="ob2-input" id="obg-title-' + i + '" value="' + esc(g.title || '') + '" placeholder="Ziel"><button type="button" class="ob2-segbtn" id="obg-role-' + i + '">' + esc(roleDE[role]) + '</button><button type="button" class="ob2-x" id="obg-del-' + i + '">✕</button></div>'; }).join('');
    card.innerHTML = progressHTML() + '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Ziele</h2><p class="ob2-desc">Lege mindestens ein Ziel an. Weitere Details kannst du später im Profil ergänzen.</p>' +
      (rows || '<p class="ob2-note">Noch keine Ziele.</p>') +
      '<button type="button" class="btn sec" id="obg-add" style="margin-top:8px">Ziel hinzufügen</button>' +
      '<div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button><button type="button" class="btn" id="ob2-next">Weiter</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button>';
    goals.forEach(function (g, i) {
      var r = card.querySelector('#obg-role-' + i); if (r) r.onclick = function () { _collectGoals(); var order = ['main', 'secondary', 'maintain']; var cur = (M && M.roleOfGoal) ? M.roleOfGoal(g) : 'secondary'; if (order.indexOf(cur) < 0) cur = 'secondary'; var ni = (order.indexOf(cur) + 1) % 3; g.priority = M.priorityOfRole(order[ni]); renderGoalsStep(); };
      var d = card.querySelector('#obg-del-' + i); if (d) d.onclick = function () { _collectGoals(); curGoals().splice(i, 1); renderGoalsStep(); };
    });
    card.querySelector('#obg-add').onclick = function () { _collectGoals(); S.draft.draftData.goals = M.addGoal(curGoals(), { title: '', priority: curGoals().length ? 2 : 1 }); renderGoalsStep(); };
    card.querySelector('#ob2-back').onclick = function () { _collectGoals(); goBack(); };
    card.querySelector('#ob2-next').onclick = function () { _collectGoals(); goNext(); };
    card.querySelector('#ob2-later').onclick = function () { _collectGoals(); later(); };
    focusHeading(); persist();
  }
  function curSchedule() { S.draft.draftData = S.draft.draftData || {}; if (!S.draft.draftData.availability) { S.draft.draftData.availability = PM() ? PM().normalizeAvailability((O.profile && O.profile.availability) || (root.PROFILE && root.PROFILE.availability)) : { days: {} }; } return S.draft.draftData.availability; }
  function _collectSchedule() {
    var M = PM(); var av = curSchedule(); var doc = D(); if (!doc) return av;
    OB_WD.forEach(function (w) { var c = doc.getElementById('obs-day-' + w[0]); var on = c ? c.classList.contains('on') : (av.days[w[0]] && av.days[w[0]].available); var day = av.days[w[0]] || {}; day.available = !!on; day.restDay = !on; day.singleSession = day.singleSession || {}; day.singleSession.preferredTime = S.draft.draftData._schedTime || day.singleSession.preferredTime || ''; if (S.draft.draftData._schedDur) day.singleSession.maxMinutes = S.draft.draftData._schedDur; av.days[w[0]] = day; });
    var ms = doc.getElementById('obs-maxS'); if (ms) av.maxSessionsPerWeek = ms.value !== '' ? parseInt(ms.value, 10) : null;
    var db = doc.getElementById('obs-double'); av._doubleAllowed = db ? !!db.checked : !!av._doubleAllowed;
    S.draft.draftData.availability = M ? M.normalizeAvailability(av) : av; S.draft.draftData.availability._doubleAllowed = av._doubleAllowed;
    return S.draft.draftData.availability;
  }
  function renderScheduleStep() {
    mountShell(); var card = S.el.querySelector('.ob2-card'); var av = curSchedule(); var dd = S.draft.draftData;
    var dayChips = OB_WD.map(function (w) { var on = av.days[w[0]] && av.days[w[0]].available && !av.days[w[0]].restDay; return '<button type="button" class="ob2-chip' + (on ? ' on' : '') + '" id="obs-day-' + w[0] + '">' + w[1] + '</button>'; }).join('');
    var timeChips = OB_TIMES.map(function (t) { return '<button type="button" class="ob2-chip' + ((dd._schedTime || '') === t[0] ? ' on' : '') + '" data-v="' + t[0] + '" onclick="ORVIA.onboardingV2._setSchedTime(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('');
    card.innerHTML = progressHTML() + '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Trainingsalltag</h2><p class="ob2-desc">Grobe Angaben genügen — Details kannst du später unter Trainingsverfügbarkeit verfeinern.</p>' +
      '<div class="ob2-field"><label>Verfügbare Tage</label><div class="ob2-chips">' + dayChips + '</div></div>' +
      '<div class="ob2-field"><label>Bevorzugte Tageszeit</label><div class="ob2-chips">' + timeChips + '</div></div>' +
      '<div class="ob2-field"><label>Grobe Dauer je Einheit (min)</label><input class="ob2-input" id="obs-dur" type="number" value="' + esc(dd._schedDur != null ? dd._schedDur : '') + '"></div>' +
      '<div class="ob2-field"><label>Maximale Einheiten pro Woche</label><input class="ob2-input" id="obs-maxS" type="number" value="' + esc(av.maxSessionsPerWeek != null ? av.maxSessionsPerWeek : '') + '"></div>' +
      '<label class="ob2-check"><input type="checkbox" id="obs-double"' + (av._doubleAllowed ? ' checked' : '') + '> Doppeleinheiten grundsätzlich möglich</label>' +
      '<div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button><button type="button" class="btn" id="ob2-next">Weiter</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button>';
    OB_WD.forEach(function (w) { var c = card.querySelector('#obs-day-' + w[0]); if (c) c.onclick = function () { c.classList.toggle('on'); }; });
    var dur = card.querySelector('#obs-dur'); if (dur) dur.onchange = function () { dd._schedDur = dur.value !== '' ? parseInt(dur.value, 10) : null; };
    card.querySelector('#ob2-back').onclick = function () { _collectSchedule(); goBack(); };
    card.querySelector('#ob2-next').onclick = function () { _collectSchedule(); goNext(); };
    card.querySelector('#ob2-later').onclick = function () { _collectSchedule(); later(); };
    focusHeading(); persist();
  }
  function renderSummaryStep() {
    mountShell(); var card = S.el.querySelector('.ob2-card'); var M = PM(); var dd = S.draft.draftData || {};
    var pf = dd.profile || {}; var goals = curGoals().filter(function (g) { return g.title && g.title.trim(); });
    var primary = goals.slice().sort(function (a, b) { return (a.priority || 9) - (b.priority || 9); })[0];
    var sportsSel = (dd.sports && Array.isArray(dd.sports.sports)) ? dd.sports.sports : [];
    var sportNames = sportsSel.map(function (e) { var sc = M && M.sportProfileSchema && M.sportProfileSchema(e.sportId); return (sc && sc.label) || e.customName || e.sportId; });
    var av = curSchedule(); var availDays = OB_WD.filter(function (w) { return av.days[w[0]] && av.days[w[0]].available && !av.days[w[0]].restDay; }).length;
    function sec(title, body, step) { return '<div class="ob2-sumrow"><div class="ob2-sumh">' + esc(title) + '<button type="button" class="ob2-segbtn" onclick="ORVIA.onboardingV2._editStep(\'' + step + '\')">Bearbeiten</button></div>' + body + '</div>'; }
    card.innerHTML = progressHTML() + '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Dein ORVIA-Profil</h2>' +
      sec('Persönliche Daten', '<p>' + esc([pf.displayName || pf.firstName || '—', pf.heightCm ? pf.heightCm + ' cm' : '', pf.weightKg ? pf.weightKg + ' kg' : ''].filter(Boolean).join(' · ')) + '</p>', 'profile') +
      sec('Sportarten', '<p>' + esc(sportNames.length ? sportNames.join(', ') : '—') + '</p>', 'sports') +
      sec('Hauptziel', '<p>' + esc(primary ? primary.title : '—') + '</p>', 'goals_placeholder') +
      sec('Weitere Ziele', '<p>' + esc(goals.filter(function (g) { return g !== primary; }).map(function (g) { return g.title; }).join(', ') || '—') + '</p>', 'goals_placeholder') +
      sec('Trainingsalltag', '<p>' + esc(availDays + ' verfügbare Tage' + (av.maxSessionsPerWeek != null ? ' · bis zu ' + av.maxSessionsPerWeek + ' Einheiten' : '')) + '</p>', 'schedule_placeholder') +
      '<div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button><button type="button" class="btn" id="ob2-finish">Profil erstellen</button></div>';
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
  function buildCompletionPatch(dd, M) {
    dd = dd || {}; var pf = dd.profile || {}; var patch = {};
    if (pf.displayName != null) patch.name = pf.displayName; else if (pf.firstName) patch.name = pf.firstName;
    if (pf.heightCm != null) patch.heightCm = pf.heightCm; if (pf.weightKg != null) patch.weightKg = pf.weightKg; if (pf.birthDate) patch.birthDate = pf.birthDate; if (pf.sex) patch.sex = pf.sex;
    var sportsSel = (dd.sports && Array.isArray(dd.sports.sports)) ? dd.sports.sports : [];
    patch.sports = M.normalizeSports(sportsSel.map(function (e) { return { sportId: e.sportId, customName: e.customName || null, role: e.role || 'supplemental', activeInApp: e.visible !== false, includeInPlan: !!e.planningEnabled }; }));
    var lvl = pf.experienceLevel || null;
    if (lvl) patch.sports = patch.sports.map(function (s) { return (s.role === 'primary' && s.level == null) ? Object.assign({}, s, { level: lvl }) : s; });
    patch.goals = M.normalizeGoals((dd.goals || []).filter(function (g) { return g.title && g.title.trim(); }));
    patch.availability = M.normalizeAvailability(dd.availability);
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
  /* Minimaler Erfolgszustand (M4-Grenze; volles M8-Design folgt später). Kein Auto-Close:
     der Nutzer wählt die nächste Aktion. „Ersten Check-in starten" hat noch keinen stabilen
     öffentlichen Entry-Point (dokumentiert) → vorerst nur „Zur App". */
  function renderFinishDone(syncStatus) {
    mountShell();
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML =
      '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Dein Profil steht.</h2>' +
      '<p class="ob2-desc">Nach deinem ersten Check-in bekommst du deine erste Empfehlung.</p>' +
      (syncStatus === 'pending' ? '<p class="ob2-desc">Du bist gerade offline – deine Angaben werden automatisch synchronisiert, sobald du wieder online bist.</p>' : '') +
      '<div class="ob2-nav"><button type="button" class="btn" id="ob2-toapp">Zur App</button></div>';
    card.querySelector('#ob2-toapp').onclick = function () { closeShell(); };
    focusHeading();
  }
  function finishOnboarding() {
    if (S.busy || _completing) return;
    S.busy = true;
    _collectGoals(); _collectSchedule();
    var card = (S.el && S.el.querySelector) ? S.el.querySelector('.ob2-card') : null;
    var btn = (card && card.querySelector) ? card.querySelector('#ob2-finish') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Wird gespeichert …'; }
    var ctx = {
      draft: S.draft,
      patch: buildCompletionPatch(S.draft.draftData || {}, PM()),
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
      S.draft.draftData.profile = PL().profileSeedFromExisting(O.profile || {});
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
  function kitFull() { var k = K(); return !!(k && ['createChoiceCard', 'createInlineHelp', 'createProgressHeader'].every(function (n) { return typeof k[n] === 'function'; })); }

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

  // Verschiebt eine aktiv geplante SEKUNDÄR-Sportart in der Priorität (primary bleibt Position 1).
  function movePlanned(sportId, dir) {
    var sl = SL(); var sel = S.draft.draftData.sports;
    var order = sl.getPlannedSports(sel);                 // [primary, sek1, sek2, ...] nach Priorität
    var i = order.indexOf(sportId); if (i < 0) return;
    var j = i + dir;
    if (j < 1 || j >= order.length) return;               // Index 0 = primary, nicht verschiebbar
    var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    setSports(sl.reorderPlannedSports(sel, order));        // persistiert genau einmal (über renderSportsStep)
  }

  // Aktuellen Eintrag aus dem Draft holen (lesend).
  function sportEntry(id) { var sel = S.draft.draftData.sports, r = null; if (sel && Array.isArray(sel.sports)) sel.sports.forEach(function (e) { if (e.sportId === id) r = e; }); return r; }

  function renderSportsStep() {
    mountShell();
    var sl = SL(); var sel = ensureSportsDraft(); var errors = sportsErrors(); var showErr = S.sportsSubmitted;
    var cat = sl.SPORT_CATALOG, byId = sl.CATALOG_BY_ID;
    var chosen = sel.sports.map(function (e) { return e.sportId; });
    var selErr = showErr && errors._selection, priErr = showErr && errors._primary;
    // Abschnitt A — Auswahl-Chips (ganze Fläche klickbar, Häkchen im ausgewählten Zustand).
    var aChips = cat.map(function (s) {
      var on = chosen.indexOf(s.id) >= 0;
      return '<button type="button" class="ob2-chip' + (on ? ' on' : '') + '" id="sp-' + s.id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + (on ? '<span class="ob2-check" aria-hidden="true">✓</span>' : '') + esc(s.label) + '</button>';
    }).join('');
    var bSection = '', helpBlock = '', cSection = '';
    if (chosen.length) {
      // Abschnitt B — Hauptsportart DYNAMISCH aus allen ausgewählten PLANBAREN Sportarten (keine feste Liste).
      var pChips = sel.sports.filter(function (e) { return sl.plannable(e.sportId); }).map(function (e) {
        var on = e.role === 'primary';
        return '<button type="button" class="ob2-chip' + (on ? ' on' : '') + '" id="pr-' + e.sportId + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + (on ? '<span class="ob2-check" aria-hidden="true">✓</span>' : '') + esc(byId[e.sportId].label) + '</button>';
      }).join('');
      bSection = '<div class="ob2-field"><label id="sports-b-label">Was ist deine Hauptsportart?</label><p class="ob2-hint">Sie erhält bei Zielsetzung und Planung die höchste Priorität.</p>' + (priErr ? '<span class="ob2-err" id="err-primary" role="alert">' + esc(errors._primary) + '</span>' : '') + '<div class="ob2-chips" role="group" aria-labelledby="sports-b-label"' + (priErr ? ' aria-describedby="err-primary" aria-invalid="true"' : '') + '>' + pChips + '</div></div>';
      // Kompakter Hilfeblock (drei kurze Zeilen).
      helpBlock = '<div class="ob2-help"><div><strong>Aktiv geplant</strong> – ORVIA erstellt und verteilt dafür Einheiten.</div><div><strong>Gelegentlich</strong> – wird berücksichtigt, aber nicht fest eingeplant.</div><div><strong>In der App anzeigen</strong> – steuert nur die Standardansicht; die Aktivität bleibt immer verfügbar.</div></div>';
      // Reihenfolge der aktiv geplanten Sekundär-Sportarten (für ↑/↓-Grenzen).
      var plannedSec = sl.getPlannedSports(sel).filter(function (id) { var e = sportEntryOf(sel, id); return e && e.role !== 'primary'; });
      var cards = sel.sports.map(function (e) {
        var lbl = byId[e.sportId].label;
        if (e.role === 'primary') {
          return '<div class="ob2-spcard primary"><div class="ob2-spcard-head"><span class="ob2-spname">' + esc(lbl) + '</span><span class="ob2-badge">Hauptsportart</span></div><div class="ob2-spmeta">Aktiv geplant · sichtbar · Priorität 1</div></div>';
        }
        var visBtn = visToggleHTML(e);
        if (!sl.plannable(e.sportId)) {   // nicht planbar: keine Planung, keine Hauptsportart — nur Sichtbarkeit.
          return '<div class="ob2-spcard"><div class="ob2-spcard-head"><span class="ob2-spname">' + esc(lbl) + '</span><span class="ob2-badge sub">Zusätzliche Aktivität</span></div><div class="ob2-spmeta">Wird nicht aktiv geplant, kann aber jederzeit erfasst werden.</div><div class="ob2-sprow"><span class="ob2-sprow-lbl">In der App anzeigen</span>' + visBtn + '</div></div>';
        }
        // Planbare Sekundär-Sportart: Segment-Control (Aktiv planen / Gelegentlich) + Sichtbarkeit + ggf. Priorität.
        var planned = e.planningEnabled;
        var seg = '<div class="ob2-seg" role="group" aria-label="Modus ' + esc(lbl) + '">' +
          '<button type="button" class="ob2-segbtn' + (planned ? ' on' : '') + '" id="mode-planned-' + e.sportId + '" aria-pressed="' + (planned ? 'true' : 'false') + '">Aktiv planen</button>' +
          '<button type="button" class="ob2-segbtn' + (!planned ? ' on' : '') + '" id="mode-occ-' + e.sportId + '" aria-pressed="' + (!planned ? 'true' : 'false') + '">Gelegentlich</button></div>';
        var visRow = '<div class="ob2-sprow"><span class="ob2-sprow-lbl">In der App anzeigen</span>' + visBtn + '</div>';
        var prioRow = '';
        if (planned) {
          var si = plannedSec.indexOf(e.sportId);
          prioRow = '<div class="ob2-sprow"><span class="ob2-sprow-lbl">Priorität ' + (e.priority || (si + 2)) + '</span><span class="ob2-mv">' +
            '<button type="button" class="ob2-mvbtn" id="up-' + e.sportId + '" aria-label="Priorität erhöhen: ' + esc(lbl) + '"' + (si <= 0 ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="ob2-mvbtn" id="dn-' + e.sportId + '" aria-label="Priorität senken: ' + esc(lbl) + '"' + (si >= plannedSec.length - 1 ? ' disabled' : '') + '>↓</button></span></div>';
        }
        return '<div class="ob2-spcard"><div class="ob2-spcard-head"><span class="ob2-spname">' + esc(lbl) + '</span></div>' + seg + visRow + prioRow + '</div>';
      }).join('');
      cSection = '<div class="ob2-field"><label>Wie nutzt du deine Sportarten?</label><p class="ob2-hint">ORVIA plant regelmäßige Sportarten aktiv ein. Gelegentliche Aktivitäten werden berücksichtigt, aber nicht fest verplant.</p>' + helpBlock + cards + '</div>';
    }
    var card = S.el.querySelector('.ob2-card');
    card.innerHTML = progressHTML() +
      '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Deine Sportarten</h2>' +
      '<p class="ob2-desc">Wähle alles aus, was du regelmäßig oder gelegentlich machst.</p>' +
      '<div class="ob2-field"><label id="sports-a-label">Welche Sportarten machst du?</label><span class="ob2-err" id="err-sports" role="alert">' + (selErr ? esc(errors._selection) : '') + '</span><div class="ob2-chips" role="group" aria-labelledby="sports-a-label"' + (selErr ? ' aria-describedby="err-sports" aria-invalid="true"' : '') + '>' + aChips + '</div></div>' +
      bSection + cSection +
      '<div class="ob2-navwrap"><div class="ob2-nav"><button type="button" class="btn sec" id="ob2-back">Zurück</button><button type="button" class="btn" id="ob2-next">Weiter</button></div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button></div>';
    var doc = D();
    // Per-Element-onclick (robust auf iOS Safari: ganze Button-Fläche feuert click; nach jedem Re-Render neu gesetzt).
    cat.forEach(function (s) { var el = doc.getElementById('sp-' + s.id); if (el) el.onclick = function () { setSports(sl.toggleSport(S.draft.draftData.sports, s.id)); }; });
    sel.sports.forEach(function (e) {
      var pr = doc.getElementById('pr-' + e.sportId); if (pr) pr.onclick = function () { setSports(sl.setPrimarySport(S.draft.draftData.sports, e.sportId)); };
      var mp = doc.getElementById('mode-planned-' + e.sportId); if (mp) mp.onclick = function () { setSports(sl.setSportMode(S.draft.draftData.sports, e.sportId, 'planned')); };
      var mo = doc.getElementById('mode-occ-' + e.sportId); if (mo) mo.onclick = function () { setSports(sl.setSportMode(S.draft.draftData.sports, e.sportId, 'occasional')); };
      var vi = doc.getElementById('vis-' + e.sportId); if (vi) vi.onclick = function () { var cur = sportEntry(e.sportId); setSports(sl.setVisible(S.draft.draftData.sports, e.sportId, !(cur && cur.visible))); };
      var up = doc.getElementById('up-' + e.sportId); if (up) up.onclick = function () { movePlanned(e.sportId, -1); };
      var dn = doc.getElementById('dn-' + e.sportId); if (dn) dn.onclick = function () { movePlanned(e.sportId, 1); };
    });
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-next').onclick = submitSports;
    card.querySelector('#ob2-later').onclick = later;
    focusHeading();
    persist();
  }
  // Toggle-Button („In der App anzeigen") als echtes switch-Element (volle Fläche klickbar).
  function visToggleHTML(e) { var on = e.visible; return '<button type="button" class="ob2-toggle' + (on ? ' on' : '') + '" id="vis-' + e.sportId + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="In der App anzeigen"><span class="ob2-knob" aria-hidden="true"></span></button>'; }
  function sportEntryOf(sel, id) { var r = null; if (sel && Array.isArray(sel.sports)) sel.sports.forEach(function (e) { if (e.sportId === id) r = e; }); return r; }
  function submitSports() {
    if (S.busy || navLocked()) return; S.busy = true;
    var r = L().advanceSports(S.draft, now());
    if (!r.ok) { S.sportsSubmitted = true; renderSportsStep(); focusFirstSportsError(r.errors); S.busy = false; return; }
    S.sportsSubmitted = false; render(); S.busy = false;
  }
  function focusFirstSportsError(errors) {
    var doc = D(); if (!doc) return; var sl = SL();
    if (errors._selection) { var c = sl.SPORT_CATALOG[0]; var el = doc.getElementById('sp-' + c.id); if (el && el.focus) { try { el.focus(); } catch (e) {} } return; }
    if (errors._primary) { var first = S.draft.draftData.sports.sports[0]; if (first) { var p = doc.getElementById('pr-' + first.sportId); if (p && p.focus) { try { p.focus(); } catch (e) {} } } }
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
    _setSchedTime: function (t) { S.draft.draftData = S.draft.draftData || {}; S.draft.draftData._schedTime = t; renderScheduleStep(); },
    _editStep: function (step) { if (L().STEP_IDS.indexOf(step) >= 0) { S.draft.currentStep = step; render(); } },
    renderGoalsStep: renderGoalsStep, renderScheduleStep: renderScheduleStep, renderSummaryStep: renderSummaryStep, finishOnboarding: finishOnboarding,
    // M4: testbare Abschluss-Bausteine (interne API für Tests; kein UI-Vertrag).
    _m4: { buildCompletionPatch: buildCompletionPatch, completeOnboardingFlow: completeOnboardingFlow },
    _reset: function () { S.draft = null; S.el = null; S.busy = false; S.lastNav = 0; S.corruptNote = false; S.previousFocus = null; S.profileSubmitted = false; S.birthMode = null; S.heightDirty = false; S.weightDirty = false; S.reviewError = ''; S.sportsSubmitted = false; }
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
