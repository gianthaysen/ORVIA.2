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

  var S = { draft: null, userId: null, el: null, busy: false, lastNav: 0, corruptNote: false, bound: false, previousFocus: null, profileSubmitted: false, heightDirty: false, weightDirty: false, reviewError: '', sportsSubmitted: false };
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

  function now() { return Date.now(); }
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
    // BEARBEITEN: abgeschlossenes Profil bleibt jederzeit editierbar — NICHT auf dem Done-Screen sperren.
    // Wir steigen mit vorhandenen (vorausgefüllten) Daten wieder am Profil-Schritt ein.
    if (opts.edit && existing) { S.draft.currentStep = 'profile'; render(); return true; }
    if (L().readyForReview(S.draft)) { renderReviewDone(); return true; } // Statusansicht erhalten, kein erneutes Markieren
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
    // Profil-Schritt: bei fehlender/unvollständiger Profil-Logik FAIL-CLOSED (keine generische Übersprung-Möglichkeit).
    if (S.draft.currentStep === 'profile') { if (plFull()) renderProfileStep(); else renderProfileUnavailable(); return; }
    if (S.draft.currentStep === 'sports') { if (slFull()) renderSportsStep(); else renderSportsUnavailable(); return; }
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
      '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Einrichtung vorgemerkt</h2>' +
      '<p class="ob2-desc">Dein Basisprofil und deine Sportauswahl sind gespeichert (lokal auf diesem Gerät). Ziele und Trainingsalltag folgen in den nächsten Entwicklungsschritten.</p>' +
      sportsSummaryHTML() +
      '<div class="ob2-nav"><button type="button" class="btn" id="ob2-close">Schließen</button></div>';
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
  var FIELD_ORDER = ['displayName', 'birthDate', 'sex', 'heightCm', 'weightKg', 'experienceLevel'];
  var FIELD_INPUT = { displayName: 'pf-displayName', birthDate: 'pf-birthDate', sex: 'pf-sex', heightCm: 'pf-height', weightKg: 'pf-weight', experienceLevel: 'pf-level' };

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

  function renderProfileStep() {
    mountShell();
    var p = ensureProfileDraft(); var errors = curProfileErrors();
    var imperial = p.unitSystem === 'imperial';
    var hInvalid = (S.profileSubmitted && errors.heightCm) ? ' aria-invalid="true"' : '';
    var heightBlock, weightInner;
    if (imperial) {
      var fi = (p.heightCm != null) ? PL().cmToFeetInches(p.heightCm) : { feet: '', inches: '' };
      // Zusammengesetztes Feld als fieldset/legend; JEDES Eingabefeld hat ein echtes Label.
      heightBlock = '<fieldset class="ob2-field ob2-fieldset"><legend>Körpergröße</legend>' +
        '<div class="ob2-row2">' +
          '<label class="ob2-sublabel" for="pf-ft">Fuß<input id="pf-ft" type="number" inputmode="numeric" min="3" max="8" step="1" value="' + esc(fi.feet) + '" aria-describedby="err-heightCm"' + hInvalid + '></label>' +
          '<label class="ob2-sublabel" for="pf-in">Zoll<input id="pf-in" type="number" inputmode="numeric" min="0" max="11" step="1" value="' + esc(fi.inches) + '" aria-describedby="err-heightCm"' + hInvalid + '></label>' +
        '</div><span class="ob2-err" id="err-heightCm" role="alert">' + esc(errText(errors, 'heightCm')) + '</span></fieldset>';
      var lb = (p.weightKg != null) ? Math.round(PL().kgToLb(p.weightKg) * 10) / 10 : '';
      weightInner = '<input id="pf-weight" type="number" inputmode="decimal" min="66" max="660" step="0.1" placeholder="lb" value="' + esc(lb) + '" autocomplete="off" aria-describedby="err-weightKg"' + ai(errors, 'weightKg') + '>';
    } else {
      heightBlock = field('Körpergröße (cm)', 'pf-height',
        '<input id="pf-height" type="number" inputmode="numeric" min="100" max="250" step="1" placeholder="cm" value="' + esc(p.heightCm != null ? p.heightCm : '') + '" autocomplete="off" aria-describedby="err-heightCm"' + ai(errors, 'heightCm') + '>', 'heightCm', errors);
      weightInner = '<input id="pf-weight" type="number" inputmode="decimal" min="30" max="300" step="0.1" placeholder="kg" value="' + esc(p.weightKg != null ? p.weightKg : '') + '" autocomplete="off" aria-describedby="err-weightKg"' + ai(errors, 'weightKg') + '>';
    }
    var sexOpts = '<option value="">Bitte wählen</option>' + SEX_LABELS.map(function (o) { return '<option value="' + o[0] + '"' + (p.sex === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    var lvlOpts = '<option value="">Bitte wählen</option>' + LEVEL_LABELS.map(function (o) { return '<option value="' + o[0] + '"' + (p.experienceLevel === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    var unitRow = '<fieldset class="ob2-field ob2-fieldset"><legend>Einheiten</legend><div class="ob2-units" role="radiogroup" aria-label="Einheiten">' +
      '<label for="pf-unit-metric"><input type="radio" name="pf-unit" id="pf-unit-metric" value="metric"' + (!imperial ? ' checked' : '') + '> metrisch (cm/kg)</label>' +
      '<label for="pf-unit-imperial"><input type="radio" name="pf-unit" id="pf-unit-imperial" value="imperial"' + (imperial ? ' checked' : '') + '> imperial (ft/in, lb)</label></div></fieldset>';

    var card = S.el.querySelector('.ob2-card');
    card.innerHTML = progressHTML() +
      '<h2 id="ob2-title" class="ob2-title" tabindex="-1">Dein Athletenprofil</h2>' +
      '<p class="ob2-desc">Diese Angaben bilden die Grundlage für spätere Trainings- und Belastungsmodelle. Sie bleiben vorerst nur lokal auf diesem Gerät.</p>' +
      '<form class="ob2-form" autocomplete="on" novalidate>' +
        field('Anzeigename', 'pf-displayName', '<input id="pf-displayName" type="text" maxlength="50" autocomplete="name" value="' + esc(p.displayName || '') + '" aria-describedby="err-displayName"' + ai(errors, 'displayName') + '>', 'displayName', errors) +
        field('Geburtsdatum', 'pf-birthDate', '<input id="pf-birthDate" type="date" autocomplete="bday" value="' + esc(p.birthDate || '') + '" aria-describedby="err-birthDate"' + ai(errors, 'birthDate') + '>', 'birthDate', errors) +
        field('Geschlecht', 'pf-sex', '<select id="pf-sex" aria-describedby="hint-sex err-sex"' + ai(errors, 'sex') + '>' + sexOpts + '</select>', 'sex', errors, 'Kann später für passende Leistungs- und Belastungsmodelle verwendet werden.') +
        unitRow + heightBlock +
        field(imperial ? 'Körpergewicht (lb)' : 'Körpergewicht (kg)', 'pf-weight', weightInner, 'weightKg', errors) +
        field('Trainingserfahrung', 'pf-level', '<select id="pf-level" aria-describedby="err-experienceLevel"' + ai(errors, 'experienceLevel') + '>' + lvlOpts + '</select>', 'experienceLevel', errors) +
      '</form>' +
      '<div class="ob2-nav">' +
        '<button type="button" class="btn sec" id="ob2-back">Zurück</button>' +
        '<button type="button" class="btn" id="ob2-next">Weiter</button>' +
      '</div>' +
      '<button type="button" class="ob2-later" id="ob2-later">Später fortsetzen</button>';

    var doc = D();
    // Text/Select/Datum: change/blur speichern; nach erstem Submit zusätzlich input für Live-Fehler.
    ['pf-displayName', 'pf-birthDate', 'pf-sex', 'pf-level'].forEach(function (id) {
      var el = doc.getElementById(id); if (!el) return;
      el.addEventListener('change', onProfileInput); el.addEventListener('blur', onProfileInput);
      el.addEventListener('input', onProfileInputLive);
    });
    // Maße: input/change markieren das Maß als „dirty" (nur dann wird der kanonische Wert ersetzt).
    [['pf-height', 'h'], ['pf-ft', 'h'], ['pf-in', 'h'], ['pf-weight', 'w']].forEach(function (pair) {
      var el = doc.getElementById(pair[0]); if (!el) return;
      var mark = function () { if (pair[1] === 'h') S.heightDirty = true; else S.weightDirty = true; onProfileInput(); };
      el.addEventListener('input', function () { mark(); if (S.profileSubmitted) updateProfileErrors(); });
      el.addEventListener('change', mark); el.addEventListener('blur', mark);
    });
    ['pf-unit-metric', 'pf-unit-imperial'].forEach(function (id) {
      var el = doc.getElementById(id); if (!el) return;
      el.addEventListener('change', function () { switchUnitSystem(id === 'pf-unit-imperial' ? 'imperial' : 'metric'); });
    });
    card.querySelector('#ob2-back').onclick = goBack;
    card.querySelector('#ob2-next').onclick = submitProfile;
    card.querySelector('#ob2-later').onclick = later;
    S.heightDirty = false; S.weightDirty = false;   // frisch gerendert = Anzeige spiegelt Kanon
    if (S.profileSubmitted) updateProfileErrors();   // ARIA-Fehler konsistent via setAttribute (auch nach Re-Render)
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
  function switchUnitSystem(nextSystem) {
    if (S.busy) return;
    captureCurrentStep();
    S.draft.draftData.profile.unitSystem = nextSystem;
    renderProfileStep();   // persistiert am Ende — kein zusätzlicher Save
  }
  function readProfileForm() {
    var doc = D(); if (!doc) return; var p = S.draft.draftData.profile, pl = PL();
    function v(id) { var e = doc.getElementById(id); return e ? e.value : ''; }
    p.displayName = (v('pf-displayName') || '').trim();
    p.birthDate = v('pf-birthDate') || '';
    p.sex = v('pf-sex') || '';
    p.experienceLevel = v('pf-level') || '';
    // Einheit aus dem KANONISCHEN Zustand (nicht aus den Radios) — verhindert, dass beim Wechsel
    // die Felder bereits in der neuen Einheit interpretiert werden (Datenverlust).
    // Maße NUR übernehmen, wenn der Nutzer sie tatsächlich bearbeitet hat (dirty) → keine Drift.
    if (S.heightDirty) {
      if (p.unitSystem === 'imperial') { var r = pl.parseFeetInches(v('pf-ft'), v('pf-in')); p.heightCm = r.valid ? r.cm : null; }
      else { p.heightCm = pl._num(v('pf-height')); }
    }
    if (S.weightDirty) {
      if (p.unitSystem === 'imperial') { var lb = pl._num(v('pf-weight')); p.weightKg = (lb != null) ? pl.lbToKg(lb) : null; }
      else { p.weightKg = pl._num(v('pf-weight')); }
    }
  }
  function onProfileInput() { readProfileForm(); persist(); if (S.profileSubmitted) updateProfileErrors(); }
  function onProfileInputLive() { if (!S.profileSubmitted) return; readProfileForm(); updateProfileErrors(); } // erst nach Submit live
  function updateProfileErrors() {
    var doc = D(); if (!doc) return; var errors = PL().validateProfile(S.draft.draftData.profile).errors;
    var imperial = S.draft.draftData.profile.unitSystem === 'imperial';
    ['displayName', 'birthDate', 'sex', 'weightKg', 'experienceLevel'].forEach(function (f) {
      var span = doc.getElementById('err-' + f); if (span) span.textContent = errors[f] || '';
      setInvalid(doc.getElementById(FIELD_INPUT[f]), errors[f]);
    });
    // Größe: gemeinsamer Fehler; bei imperial beide Teilfelder markieren.
    var hspan = doc.getElementById('err-heightCm'); if (hspan) hspan.textContent = errors.heightCm || '';
    if (imperial) { setInvalid(doc.getElementById('pf-ft'), errors.heightCm); setInvalid(doc.getElementById('pf-in'), errors.heightCm); }
    else setInvalid(doc.getElementById('pf-height'), errors.heightCm);
  }
  function setInvalid(inp, hasErr) { if (!inp) return; if (hasErr) inp.setAttribute('aria-invalid', 'true'); else if (inp.removeAttribute) inp.removeAttribute('aria-invalid'); }
  function focusFirstError(errors) {
    var doc = D(); if (!doc) return; var imperial = S.draft.draftData.profile.unitSystem === 'imperial';
    for (var i = 0; i < FIELD_ORDER.length; i++) {
      var f = FIELD_ORDER[i];
      if (errors[f]) { var id = (f === 'heightCm' && imperial) ? 'pf-ft' : FIELD_INPUT[f]; var inp = doc.getElementById(id); if (inp && inp.focus) { try { inp.focus(); } catch (e) {} } return; }
    }
  }
  // Weiter im Profil: ausschließlich über die fachliche Logik (advanceProfile) — validiert + schließt nur bei Gültigkeit ab.
  function submitProfile() {
    if (S.busy || navLocked()) return; S.busy = true;
    readProfileForm();
    var r = L().advanceProfile(S.draft, now());
    if (!r.ok) { S.profileSubmitted = true; renderProfileStep(); focusFirstError(r.errors); S.busy = false; return; } // renderProfileStep persistiert
    S.profileSubmitted = false;
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
    _reset: function () { S.draft = null; S.el = null; S.busy = false; S.lastNav = 0; S.corruptNote = false; S.previousFocus = null; S.profileSubmitted = false; S.heightDirty = false; S.weightDirty = false; S.reviewError = ''; S.sportsSubmitted = false; }
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
