/* ============================================================
   ORVIA · profile-center — M10 Profilzentrale (produktionsfähige Shell).
   Prinzipien (Redesign-Plan E, ADR D3/D6):
   - NUR LESEND: alle Daten über profile-model (Completeness/Freshness/
     _sectionMeta); kein saveProfile-, kein _profileSave-Aufruf hier.
   - Editor-Öffnung ausschließlich über den bestehenden Delegationspunkt
     openProfileSection(id) — kein zweiter Schreibpfad, keine Duplikate.
   - Overlay über das bestehende openSheet (size:full) — kein drittes System.
   - Ehrlicher Status: „vollständig / x fehlen / prüfenswert / veraltet /
     optional" je Bereich; kein nackter Prozentwert pro Karte; Integrationen
     nur als ehrlicher „in Vorbereitung"-Status.
   - Max. 2 Smart Prompts, priorisiert (Essential-Lücken > zeitkritische
     Aktualität > Ziel-Datum > Verfügbarkeits-Frische > Messwerte > Gewicht).
   Reine Builder (buildHeaderModel/sectionSummary/sectionStatus/
   buildSmartPrompts) sind ohne DOM testbar.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  function PM() { return O.profileModel; }
  function P() {
    try { if (O.profile && typeof O.profile.get === 'function') { var p = O.profile.get(); if (p) return p; } } catch (e) {}
    return (typeof root.PROFILE !== 'undefined' && root.PROFILE) ? root.PROFILE : null;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function deDate(d) { if (!d) return null; var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (m[3] + '.' + m[2] + '.' + m[1]) : String(d); }

  var LEVEL_DE = { beginner: 'Anfänger', intermediate: 'Fortgeschritten', advanced: 'Erfahren', competitive: 'Wettkampforientiert' };
  var WD_DE = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };
  // Gruppierung laut Session-/Redesign-Plan (E.3). 'account' ist eine ehrliche Statik-Karte, keine PROFILE-Section.
  var GROUPS = [
    { id: 'training', label: 'Training', sections: ['sports', 'goals', 'availability'] },
    { id: 'health', label: 'Gesundheit & Regeneration', sections: ['constraints', 'recovery'] },
    { id: 'performance', label: 'Leistung & Daten', sections: ['body', 'devices'] },
    { id: 'settings', label: 'Einstellungen', sections: ['personal', 'preferences', 'account'] }
  ];
  var SECTION_LABELS = { personal: 'Persönliche Daten', sports: 'Sportarten & Trainingsstand', goals: 'Ziele', availability: 'Verfügbarkeit', body: 'Leistungswerte & Körper', recovery: 'Regeneration & Alltag', constraints: 'Beschwerden', preferences: 'Präferenzen', devices: 'Geräte & Datenquellen', account: 'Datenschutz & Konto' };
  var ESSENTIAL_IDS = ['personal', 'sports', 'goals', 'availability', 'constraints'];

  function sportLabel(id) {
    try { var sc = PM().sportProfileSchema && PM().sportProfileSchema(id); if (sc && sc.label) return sc.label; } catch (e) {}
    try { var sl = O.onboardingSportsLogic; if (sl && sl.CATALOG_BY_ID && sl.CATALOG_BY_ID[id]) return sl.CATALOG_BY_ID[id].label; } catch (e) {}
    return id;
  }
  function primarySport(p) {
    try { return PM().normalizeSports(p && p.sports).filter(function (s) { return s.role === 'primary'; })[0] || null; } catch (e) { return null; }
  }
  function activeGoals(p) {
    try { return PM().normalizeGoals(p && p.goals).filter(function (g) { return g.status === 'active' && g.title && g.title.trim(); }).sort(function (a, b) { return (a.priority || 9) - (b.priority || 9); }); } catch (e) { return []; }
  }
  function availableDays(p) {
    var d = p && p.availability && p.availability.days; if (!d || typeof d !== 'object') return [];
    return Object.keys(WD_DE).filter(function (k) { var day = d[k]; return day === true || !!(day && (day.available === true || (Array.isArray(day.slots) && day.slots.length > 0))); });
  }
  function activeConstraints(p) {
    try { return (Array.isArray(p && p.constraintsList) ? p.constraintsList : []).filter(function (c) { return c && (c.status === 'active' || c.status === 'observed'); }); } catch (e) { return []; }
  }
  function isEnduranceSport(id) { return ['running', 'cycling', 'swimming', 'triathlon', 'rowing', 'athletics'].indexOf(id) >= 0; }

  /* ---------- Header-Modell (pur) ---------- */
  function buildHeaderModel(p, now) {
    p = p || {};
    var M = PM();
    var comp = null;
    try { comp = M.computeProfileCompleteness(p); } catch (e) { comp = null; }
    var prim = primarySport(p);
    var goal = activeGoals(p)[0] || null;
    var lastUpdated = null;
    try {
      var meta = p._sectionMeta || {};
      Object.keys(meta).forEach(function (k) { var u = meta[k] && meta[k].updatedAt; if (u && (!lastUpdated || u > lastUpdated)) lastUpdated = u; });
    } catch (e) {}
    var score = comp && comp.essential ? comp.essential.score : 0;
    return {
      name: (p.name || '').trim() || null,
      initials: ((p.name || 'O').trim()[0] || 'O').toUpperCase(),
      avatar: p.avatar || null,
      primarySportLabel: prim ? sportLabel(prim.sportId) : null,
      primaryLevelLabel: prim && prim.level ? (LEVEL_DE[prim.level] || prim.level) : null,
      primaryGoalTitle: goal ? goal.title : null,
      primaryGoalDate: goal && goal.targetDate ? deDate(goal.targetDate) : null,
      essentialComplete: !!(comp && comp.essential && comp.essential.complete),
      ringPercent: Math.round((isFinite(score) ? score : 0) * 100),
      missingCount: comp && comp.essential ? comp.essential.missing.length : null,
      lastUpdated: lastUpdated ? deDate(lastUpdated) : null
    };
  }

  /* ---------- Section-Zusammenfassungen (pur, 1 Zeile, ehrlich) ---------- */
  function sectionSummary(p, id) {
    p = p || {};
    var prim, goals, days, act;
    switch (id) {
      case 'personal': {
        var bits = [];
        if (p.name) bits.push(p.name);
        if (p.birthDate) bits.push('geb. ' + deDate(p.birthDate));
        else if (p.ageEstimate != null) bits.push(p.ageEstimate + ' Jahre');
        return bits.length ? bits.join(' · ') : 'Name und Geburtsdatum fehlen';
      }
      case 'sports': {
        prim = primarySport(p);
        if (!prim) return 'Noch keine Sportart gewählt';
        var others = [];
        try { others = PM().normalizeSports(p.sports).filter(function (s) { return s.role !== 'primary'; }); } catch (e) {}
        var line = sportLabel(prim.sportId);
        if (prim.level) line += ' · ' + (LEVEL_DE[prim.level] || prim.level);
        if (prim.sessionsPerWeek != null) line += ' · ' + prim.sessionsPerWeek + '×/Woche';
        if (others.length) line += ' · +' + others.length + ' weitere';
        return line;
      }
      case 'goals': {
        goals = activeGoals(p);
        if (!goals.length) return 'Noch kein Ziel festgelegt';
        var g = goals[0];
        return g.title + (g.targetDate ? ' · bis ' + deDate(g.targetDate) : '') + (goals.length > 1 ? ' · +' + (goals.length - 1) : '');
      }
      case 'availability': {
        days = availableDays(p);
        if (!days.length) return 'Noch keine Trainingstage gewählt';
        return days.length + ' Tage/Woche (' + days.map(function (k) { return WD_DE[k]; }).join(', ') + ')';
      }
      case 'constraints': {
        act = activeConstraints(p);
        if (act.length) {
          var M = PM();
          var lbl = (M.BODY_REGIONS.filter(function (r) { return r[0] === act[0].bodyRegion; })[0] || [])[1] || act[0].bodyRegion;
          return act.length === 1 ? (lbl + ' · Intensität ' + (act[0].intensity != null ? act[0].intensity + '/10' : '—')) : act.length + ' aktive Beschwerden';
        }
        if (p.constraintsAcknowledgedAt) return 'Keine aktiven Beschwerden';
        return 'Sicherheits-Check noch offen';
      }
      case 'recovery': {
        var h = p.recovery && p.recovery.sleep && p.recovery.sleep.averageHours;
        return h != null ? ('Ø ' + String(h).replace('.', ',') + ' h Schlaf') : 'Noch keine Angaben';
      }
      case 'body': {
        var bits2 = [];
        if (p.hfMaxMeasured != null) bits2.push('HFmax ' + p.hfMaxMeasured);
        if (p.restingHrMeasured != null) bits2.push('Ruhepuls ' + p.restingHrMeasured);
        if (p.weightKg != null) bits2.push(String(p.weightKg).replace('.', ',') + ' kg');
        if (p.heightCm != null) bits2.push(p.heightCm + ' cm');
        return bits2.length ? bits2.join(' · ') : 'Keine Messwerte hinterlegt';
      }
      case 'preferences': {
        var pr = p.preferences || {};
        var cnt = 0;
        ['intensityPreference', 'preferredEnvironment', 'socialPreference', 'coachingStyle', 'varietyPreference'].forEach(function (k) { if (pr[k]) cnt++; });
        return cnt ? cnt + ' Präferenzen gesetzt' : 'Standard — noch nichts angepasst';
      }
      case 'devices':
        return 'Manuelle Erfassung aktiv · Import in Vorbereitung';
      case 'account':
        return 'Export & Konto-Löschung in Vorbereitung';
      default:
        return '';
    }
  }

  /* ---------- Section-Status (pur, ehrlich): ok | missing | review | stale | optional ---------- */
  function sectionStatus(p, id, now) {
    p = p || {};
    var M = PM();
    if (id === 'account' || id === 'devices') return { kind: 'optional', label: 'Info' };
    var isEssential = ESSENTIAL_IDS.indexOf(id) >= 0;
    if (isEssential) {
      var comp;
      try { comp = M.computeSectionCompleteness(p, id); } catch (e) { comp = null; }
      if (comp && !comp.complete) {
        var n = comp.missing.length;
        return { kind: 'missing', label: n === 1 ? '1 Angabe fehlt' : n + ' Angaben fehlen' };
      }
    } else {
      // Optionale Bereiche: ohne Daten „optional", nie „fehlt".
      var has = false;
      if (id === 'recovery') has = !!(p.recovery && p.recovery.sleep && p.recovery.sleep.averageHours != null);
      else if (id === 'body') has = p.hfMaxMeasured != null || p.restingHrMeasured != null || p.weightKg != null || p.heightCm != null;
      else if (id === 'preferences') has = !!(p.preferences && ['intensityPreference', 'preferredEnvironment', 'socialPreference', 'coachingStyle', 'varietyPreference'].some(function (k) { return p.preferences[k]; }));
      if (!has) return { kind: 'optional', label: 'Optional' };
    }
    var fresh = 'unknown';
    try { fresh = M.getSectionFreshness(p, id, now); } catch (e) {}
    if (fresh === 'stale') return { kind: 'stale', label: 'Veraltet' };
    if (fresh === 'review_recommended') return { kind: 'review', label: 'Prüfen' };
    return { kind: 'ok', label: 'Vollständig' };
  }

  /* ---------- Smart Prompts (pur, max 2, priorisiert) ---------- */
  function buildSmartPrompts(p, now) {
    p = p || {};
    var M = PM();
    var out = [];
    // 1) Essential-Lücken (high) — konkret je Bereich.
    var comp = null;
    try { comp = M.computeProfileCompleteness(p); } catch (e) {}
    if (comp && comp.essential && !comp.essential.complete) {
      var seen = {};
      comp.essential.missing.forEach(function (m) {
        if (seen[m.section] || out.length >= 2) return;
        seen[m.section] = true;
        out.push({ id: 'essential_' + m.section, severity: 'high', sectionId: m.section, title: (SECTION_LABELS[m.section] || m.section) + ' vervollständigen', hint: 'Damit ORVIA dich richtig einordnen kann.' });
      });
    }
    // 2) Zeitkritisch: aktive Beschwerden nicht mehr aktuell (high).
    if (out.length < 2 && activeConstraints(p).length) {
      var fr = 'unknown';
      try { fr = M.getSectionFreshness(p, 'constraints', now); } catch (e) {}
      if (fr === 'stale' || fr === 'review_recommended') {
        out.push({ id: 'constraints_stale', severity: 'high', sectionId: 'constraints', title: 'Beschwerden-Status prüfen', hint: 'Deine letzte Angabe ist eine Weile her — noch aktuell?' });
      }
    }
    // 3) Hauptziel ohne Datum (medium).
    var g0 = activeGoals(p)[0];
    if (out.length < 2 && g0 && !g0.targetDate) {
      out.push({ id: 'goal_date', severity: 'medium', sectionId: 'goals', title: 'Deinem Hauptziel ein Datum geben', hint: 'Mit Datum kann ORVIA gezielter darauf hinarbeiten.' });
    }
    // 4) Verfügbarkeit veraltet (medium).
    if (out.length < 2 && availableDays(p).length) {
      var frA = 'unknown';
      try { frA = M.getSectionFreshness(p, 'availability', now); } catch (e) {}
      if (frA === 'stale') out.push({ id: 'availability_stale', severity: 'medium', sectionId: 'availability', title: 'Verfügbarkeit prüfen', hint: 'Passt deine Trainingswoche noch zu deinem Alltag?' });
    }
    // 5) Ausdauer-Hauptsport ohne GEMESSENE HFmax (low, ehrlicher Mess-Hinweis).
    var prim = primarySport(p);
    if (out.length < 2 && prim && isEnduranceSport(prim.sportId) && p.hfMaxMeasured == null) {
      out.push({ id: 'hfmax_measured', severity: 'low', sectionId: 'body', title: 'Gemessene HFmax eintragen', hint: 'Nur eintragen, wenn gemessen — sonst rechnet ORVIA mit einer ehrlichen Schätzformel.' });
    }
    // 6) Gewicht fehlt (low).
    if (out.length < 2 && p.weightKg == null) {
      out.push({ id: 'weight_missing', severity: 'low', sectionId: 'body', title: 'Gewicht ergänzen', hint: 'Fließt in Belastung und Trainingszonen ein — nicht in Bewertungen.' });
    }
    return out.slice(0, 2);
  }

  /* ---------- Rendering ---------- */
  function ringSVG(percent, complete) {
    var r = 26, c = 2 * Math.PI * r;
    var off = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
    return '<svg class="pc-ring" viewBox="0 0 64 64" role="img" aria-label="Profil zu ' + percent + ' Prozent vollständig">' +
      '<circle class="pc-ring-bg" cx="32" cy="32" r="' + r + '"/>' +
      '<circle class="pc-ring-fill' + (complete ? ' done' : '') + '" cx="32" cy="32" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      '<text class="pc-ring-text" x="32" y="37" text-anchor="middle">' + (complete ? '✓' : percent + '%') + '</text></svg>';
  }
  function chipHTML(st) {
    return '<span class="pc-chip pc-chip-' + esc(st.kind) + '">' + (st.kind === 'ok' ? '<span aria-hidden="true">✓</span> ' : '') + esc(st.label) + '</span>';
  }
  function planBadge(id) {
    var M = PM();
    var sec = null;
    try { sec = (M.PROFILE_SECTIONS || []).filter(function (s) { return s.id === id; })[0]; } catch (e) {}
    return (sec && sec.planImpact) ? '<span class="pc-plan" title="Diese Angaben beeinflussen deinen Trainingsplan">beeinflusst Plan</span>' : '';
  }
  /* Fehlende Essential-Angaben KONKRET benennen (Completion-Fixpaket 2026-07-09).
     Benennung aus profileModel.ESSENTIAL_FIELD_LABELS — dieselbe Quelle wie die
     Editor-Hinweise, keine zweite Wortliste. */
  function missingNames(p, id) {
    try {
      var M = PM();
      var c = M.computeSectionCompleteness(p, id);
      var L = M.ESSENTIAL_FIELD_LABELS || {};
      return (c && c.missing ? c.missing : []).map(function (k) { return L[k] || k; });
    } catch (e) { return []; }
  }
  function cardHTML(p, id, now) {
    var st = sectionStatus(p, id, now);
    var sub = sectionSummary(p, id);
    if (st.kind === 'missing') {
      var mn = missingNames(p, id);
      if (mn.length) sub = 'Fehlt: ' + mn.join(' · ');
    }
    return '<button type="button" class="pc-card" id="pc-card-' + esc(id) + '" aria-label="' + esc(SECTION_LABELS[id] || id) + ' öffnen">' +
      '<span class="pc-card-main"><span class="pc-card-title">' + esc(SECTION_LABELS[id] || id) + planBadge(id) + '</span>' +
      '<span class="pc-card-sub">' + esc(sub) + '</span></span>' +
      '<span class="pc-card-side">' + chipHTML(st) + '<span class="pc-arrow" aria-hidden="true">›</span></span></button>';
  }
  function buildBodyHTML(p, now) {
    var h = buildHeaderModel(p, now);
    var prompts = buildSmartPrompts(p, now);
    var head =
      '<div class="pc-header">' +
        '<div class="pc-ava">' + (h.avatar ? '<img src="' + esc(h.avatar) + '" alt="">' : esc(h.initials)) + '</div>' +
        '<div class="pc-id"><div class="pc-name">' + esc(h.name || 'Dein Profil') + '</div>' +
          (h.primarySportLabel ? '<div class="pc-sport"><span class="pc-sportbadge">' + esc(h.primarySportLabel) + '</span>' + (h.primaryLevelLabel ? ' <span class="pc-lvl">' + esc(h.primaryLevelLabel) + '</span>' : '') + '</div>' : '<div class="pc-sport pc-muted">Noch keine Sportart gewählt</div>') +
          (h.primaryGoalTitle ? '<div class="pc-goal">' + esc(h.primaryGoalTitle) + (h.primaryGoalDate ? ' · ' + esc(h.primaryGoalDate) : '') + '</div>' : '') +
        '</div>' +
        ringSVG(h.ringPercent, h.essentialComplete) +
      '</div>' +
      '<div class="pc-headmeta">' +
        (h.essentialComplete ? '<span class="pc-headstate ok">Profil vollständig</span>' : '<span class="pc-headstate warn">' + h.missingCount + (h.missingCount === 1 ? ' Angabe fehlt' : ' Angaben fehlen') + '</span>') +
        (h.lastUpdated ? '<span class="pc-updated">zuletzt aktualisiert ' + esc(h.lastUpdated) + '</span>' : '') +
      '</div>';
    var promptHtml = prompts.length ? '<div class="pc-prompts">' + prompts.map(function (x) {
      return '<button type="button" class="pc-prompt pc-prompt-' + esc(x.severity) + '" id="pc-prompt-' + esc(x.id) + '" data-section="' + esc(x.sectionId) + '">' +
        '<span class="pc-prompt-title">' + esc(x.title) + '</span><span class="pc-prompt-hint">' + esc(x.hint) + '</span></button>';
    }).join('') + '</div>' : '';
    var groups = GROUPS.map(function (g) {
      return '<div class="pc-group"><div class="pc-group-label">' + esc(g.label) + '</div>' +
        g.sections.map(function (sid) { return cardHTML(p, sid, now); }).join('') + '</div>';
    }).join('');
    return head + promptHtml + groups;
  }
  function bindHandlers(now) {
    var doc = (typeof document !== 'undefined') ? document : null; if (!doc) return;
    var all = [];
    GROUPS.forEach(function (g) { all = all.concat(g.sections); });
    // GENAU EINE Bindung je Element (Bugfix v8-179: onclick + addEventListener
    // feuerten doppelt — Editoren öffneten zweimal pro Tap).
    all.forEach(function (sid) {
      var el = doc.getElementById('pc-card-' + sid);
      if (!el) return;
      el.onclick = function (ev) {
        try { if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {}
        if (sid === 'account') return;   // ehrliche Info-Karte, noch kein Editor
        try { if (typeof root.openProfileSection === 'function') root.openProfileSection(sid); } catch (e) {}
      };
    });
    var p = P();
    buildSmartPrompts(p, now).forEach(function (x) {
      var el = doc.getElementById('pc-prompt-' + x.id);
      if (!el) return;
      el.onclick = function (ev) {
        try { if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {}
        try { if (typeof root.openProfileSection === 'function') root.openProfileSection(x.sectionId); } catch (e) {}
      };
    });
  }
  var _unsub = null;
  function rerenderIfOpen() {
    var doc = (typeof document !== 'undefined') ? document : null; if (!doc) return;
    var host = doc.getElementById('pc-root');
    if (!host) { if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; } return; }
    var now = new Date();
    host.innerHTML = buildBodyHTML(P() || {}, now);
    bindHandlers(now);
  }
  function open() {
    if (typeof root.openSheet !== 'function') {
      // Fail-soft: ohne Sheet-System (sollte nie passieren) klassischer Manager.
      try { if (typeof root.openProfileManager === 'function') root.openProfileManager(); } catch (e) {}
      return false;
    }
    var now = new Date();
    var p = P() || {};
    root.openSheet({
      id: '_profileCenter', title: 'Dein Profil', size: 'full',
      body: '<div id="pc-root" class="pc-root">' + buildBodyHTML(p, now) + '</div>',
      // WICHTIG: onClose ERSETZT das Default-Close von openSheet — es muss das
      // Sheet selbst schließen. (Bugfix v8-179: vorher nur Unsubscribe → X war
      // wirkungslos und die Live-Updates starben still.)
      onClose: function () {
        if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; }
        try { if (typeof root._closeM === 'function') root._closeM('_profileCenter'); } catch (e) {}
      }
    });
    bindHandlers(now);
    // Live-Aktualisierung: Editor-Saves feuern orvia:profile-updated → selektives Re-Rendern.
    if (!_unsub && O.profile && typeof O.profile.subscribe === 'function') {
      _unsub = O.profile.subscribe(function () { rerenderIfOpen(); });
    }
    return true;
  }

  O.profileCenter = {
    open: open,
    buildHeaderModel: buildHeaderModel,
    sectionSummary: sectionSummary,
    sectionStatus: sectionStatus,
    buildSmartPrompts: buildSmartPrompts,
    GROUPS: GROUPS,
    SECTION_LABELS: SECTION_LABELS,
    _buildBodyHTML: buildBodyHTML,
    _rerenderIfOpen: rerenderIfOpen
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
