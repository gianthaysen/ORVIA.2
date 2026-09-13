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
  /* B-13: nutzersichtbare Texte ueber t() (locales/de.js); die Tabellen unten werden beim Laden gefuellt — Katalog laedt davor. */
  function T(k, p) { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); }
  function P() {
    try { if (O.profile && typeof O.profile.get === 'function') { var p = O.profile.get(); if (p) return p; } } catch (e) {}
    return (typeof root.PROFILE !== 'undefined' && root.PROFILE) ? root.PROFILE : null;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function deDate(d) { if (!d) return null; var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (m[3] + '.' + m[2] + '.' + m[1]) : String(d); }

  var LEVEL_DE = { beginner: '' + T('pc.anfaenger') + '', intermediate: '' + T('pc.fortgeschritten') + '', advanced: '' + T('pc.erfahren') + '', competitive: '' + T('pc.wettkampforientiert') + '' };
  var WD_DE = { mo: '' + T('pc.mo') + '', di: '' + T('pc.di') + '', mi: '' + T('pc.mi') + '', do: '' + T('pc.do') + '', fr: '' + T('pc.fr') + '', sa: '' + T('pc.sa') + '', so: '' + T('pc.so') + '' };
  // Gruppierung laut Session-/Redesign-Plan (E.3). 'account' ist eine ehrliche Statik-Karte, keine PROFILE-Section.
  var GROUPS = [
    { id: 'training', label: '' + T('pc.training') + '', sections: ['sports', 'goals', 'availability'] },
    { id: 'health', label: '' + T('pc.gesundheit_regeneration') + '', sections: ['constraints', 'recovery'] },
    { id: 'performance', label: '' + T('pc.leistung_daten') + '', sections: ['body', 'devices'] },
    { id: 'settings', label: 'Einstellungen', sections: ['personal', 'preferences', 'account'] }
  ];
  var SECTION_LABELS = { personal: '' + T('pc.persoenliche_daten') + '', sports: '' + T('pc.sportarten_trainingsstand') + '', goals: '' + T('pc.ziele') + '', availability: '' + T('pc.verfuegbarkeit') + '', body: '' + T('pc.leistungswerte_koerper') + '', recovery: '' + T('pc.regeneration_alltag') + '', constraints: 'Beschwerden', preferences: 'Präferenzen', devices: '' + T('pc.geraete_datenquellen') + '', account: '' + T('pc.datenschutz_konto') + '' };
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
      /* 0016: Server-SoT (signierte Storage-URL) zuerst; Base64 nur Vorschau/Offline. */
      avatar: ((typeof ORVIA !== 'undefined' && ORVIA.avatarStore && ORVIA.avatarStore.currentSrc) ? ORVIA.avatarStore.currentSrc() : null) || p.avatar || null,
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
        else if (p.ageEstimate != null) bits.push(p.ageEstimate + '' + T('pc.jahre') + '');
        return bits.length ? bits.join(' · ') : '' + T('pc.name_und_geburtsdatum_fehlen') + '';
      }
      case 'sports': {
        prim = primarySport(p);
        if (!prim) return '' + T('pc.noch_keine_sportart_gewaehlt') + '';
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
        if (!goals.length) return '' + T('pc.noch_kein_ziel_festgelegt') + '';
        var g = goals[0];
        return g.title + (g.targetDate ? ' · bis ' + deDate(g.targetDate) : '') + (goals.length > 1 ? ' · +' + (goals.length - 1) : '');
      }
      case 'availability': {
        days = availableDays(p);
        if (!days.length) return '' + T('pc.noch_keine_trainingstage_gewaehlt') + '';
        return days.length + '' + T('pc.tage_woche') + '' + days.map(function (k) { return WD_DE[k]; }).join(', ') + ')';
      }
      case 'constraints': {
        act = activeConstraints(p);
        if (act.length) {
          var M = PM();
          var lbl = (M.BODY_REGIONS.filter(function (r) { return r[0] === act[0].bodyRegion; })[0] || [])[1] || act[0].bodyRegion;
          return act.length === 1 ? (lbl + '' + T('pc.intensitaet') + '' + (act[0].intensity != null ? act[0].intensity + '/10' : '—')) : act.length + '' + T('pc.aktive_beschwerden') + '';
        }
        if (p.constraintsAcknowledgedAt) return '' + T('pc.keine_aktiven_beschwerden') + '';
        return '' + T('pc.sicherheits_check_noch_offen') + '';
      }
      case 'recovery': {
        var h = p.recovery && p.recovery.sleep && p.recovery.sleep.averageHours;
        return h != null ? ('Ø ' + String(h).replace('.', ',') + '' + T('pc.h_schlaf') + '') : '' + T('pc.noch_keine_angaben') + '';
      }
      case 'body': {
        var bits2 = [];
        if (p.hfMaxMeasured != null) bits2.push('' + T('pc.hfmax') + '' + p.hfMaxMeasured);
        if (p.restingHrMeasured != null) bits2.push('' + T('pc.ruhepuls') + '' + p.restingHrMeasured);
        if (p.weightKg != null) bits2.push(String(p.weightKg).replace('.', ',') + ' kg');
        if (p.heightCm != null) bits2.push(p.heightCm + ' cm');
        return bits2.length ? bits2.join(' · ') : '' + T('pc.keine_messwerte_hinterlegt') + '';
      }
      case 'preferences': {
        var pr = p.preferences || {};
        var cnt = 0;
        ['intensityPreference', 'preferredEnvironment', 'socialPreference', 'coachingStyle', 'varietyPreference'].forEach(function (k) { if (pr[k]) cnt++; });
        return cnt ? cnt + '' + T('pc.praeferenzen_gesetzt') + '' : '' + T('pc.standard_noch_nichts_angepasst') + '';
      }
      case 'devices':
        return '' + T('pc.manuelle_erfassung_aktiv_import_in') + '';
      case 'account':
        return '' + T('pc.konto_passwort_export_loeschung') + '';   // H4: Export/Löschung existieren real
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
        return { kind: 'missing', label: n === 1 ? '' + T('pc.1_angabe_fehlt') + '' : n + '' + T('pc.angaben_fehlen') + '' };
      }
    } else {
      // Optionale Bereiche: ohne Daten „optional", nie „fehlt".
      var has = false;
      if (id === 'recovery') has = !!(p.recovery && p.recovery.sleep && p.recovery.sleep.averageHours != null);
      else if (id === 'body') has = p.hfMaxMeasured != null || p.restingHrMeasured != null || p.weightKg != null || p.heightCm != null;
      else if (id === 'preferences') has = !!(p.preferences && ['intensityPreference', 'preferredEnvironment', 'socialPreference', 'coachingStyle', 'varietyPreference'].some(function (k) { return p.preferences[k]; }));
      if (!has) return { kind: 'optional', label: '' + T('pc.optional') + '' };
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
        out.push({ id: 'essential_' + m.section, severity: 'high', sectionId: m.section, title: (SECTION_LABELS[m.section] || m.section) + '' + T('pc.vervollstaendigen') + '', hint: '' + T('pc.damit_orvia_dich_richtig_einordnen') + '' });
      });
    }
    // 2) Zeitkritisch: aktive Beschwerden nicht mehr aktuell (high).
    if (out.length < 2 && activeConstraints(p).length) {
      var fr = 'unknown';
      try { fr = M.getSectionFreshness(p, 'constraints', now); } catch (e) {}
      if (fr === 'stale' || fr === 'review_recommended') {
        out.push({ id: 'constraints_stale', severity: 'high', sectionId: 'constraints', title: '' + T('pc.beschwerden_status_pruefen') + '', hint: '' + T('pc.deine_letzte_angabe_ist_eine') + '' });
      }
    }
    // 3) Hauptziel ohne Datum (medium).
    var g0 = activeGoals(p)[0];
    if (out.length < 2 && g0 && !g0.targetDate) {
      out.push({ id: 'goal_date', severity: 'medium', sectionId: 'goals', title: '' + T('pc.deinem_hauptziel_ein_datum_geben') + '', hint: '' + T('pc.mit_datum_kann_orvia_gezielter') + '' });
    }
    // 4) Verfügbarkeit veraltet (medium).
    if (out.length < 2 && availableDays(p).length) {
      var frA = 'unknown';
      try { frA = M.getSectionFreshness(p, 'availability', now); } catch (e) {}
      if (frA === 'stale') out.push({ id: 'availability_stale', severity: 'medium', sectionId: 'availability', title: '' + T('pc.verfuegbarkeit_pruefen') + '', hint: '' + T('pc.passt_deine_trainingswoche_noch_zu') + '' });
    }
    // 5) Ausdauer-Hauptsport ohne GEMESSENE HFmax (low, ehrlicher Mess-Hinweis).
    var prim = primarySport(p);
    if (out.length < 2 && prim && isEnduranceSport(prim.sportId) && p.hfMaxMeasured == null) {
      out.push({ id: 'hfmax_measured', severity: 'low', sectionId: 'body', title: '' + T('pc.gemessene_hfmax_eintragen') + '', hint: '' + T('pc.nur_eintragen_wenn_gemessen_sonst') + '' });
    }
    // 6) Gewicht fehlt (low).
    if (out.length < 2 && p.weightKg == null) {
      out.push({ id: 'weight_missing', severity: 'low', sectionId: 'body', title: '' + T('pc.gewicht_ergaenzen') + '', hint: '' + T('pc.fliesst_in_belastung_und_trainingszonen') + '' });
    }
    return out.slice(0, 2);
  }

  /* ---------- B-03 Profilstärke (pur bis auf die Lesequellen) ---------- */
  function buildStrength(p, now) {
    var S = O.profileStrength; if (!S || typeof S.compute !== 'function') return null;
    var M = PM();
    var comp = null; try { comp = M.computeProfileCompleteness(p); } catch (e) {}
    var pi = null;
    try {
      var mg = (typeof root.mainGoalOf === 'function') ? root.mainGoalOf() : null;
      if (O.goalPlanInput) pi = O.goalPlanInput.resolve({ goal: mg, today: (typeof root.todayStr === 'function') ? root.todayStr() : null,
        canon: (M && M.canonGoalCategory) || null, taper: O.goalTaperResolver || null });
    } catch (e) { pi = null; }
    var perf = null; try { perf = (O._lastPlanPerf !== undefined) ? O._lastPlanPerf : null; } catch (e) {}
    /* S1.5: _lastPlanPerf entsteht erst beim Rendern des Plan-Tabs — davor stand die Profilstaerke faelschlich
       auf „Leistungsreferenz fehlt" (80 % statt 100 %). Ohne Plan-Render selbst aufloesen. */
    if (perf == null) { try { if (O.performanceResolver && O.performanceResolver.resolveAll) perf = O.performanceResolver.resolveAll(p, { today: (typeof root.todayStr === 'function') ? root.todayStr() : null }); } catch (e) { perf = null; } }
    var days = null; try { var cfg = M.effectiveTrainingConfig(p); days = cfg && Array.isArray(cfg.availableDayIdx) ? cfg.availableDayIdx.length : null; } catch (e) {}
    var stale = [];
    try { ESSENTIAL_IDS.forEach(function (id) { if (M.getSectionFreshness(p, id, now) === 'stale') stale.push(id); }); } catch (e) {}
    try { return S.compute({ completeness: comp, planInput: pi, performance: perf, availableDays: days, staleSections: stale }); } catch (e) { return null; }
  }
  var BAND_DE = { stark: T('pc.band_stark'), solide: T('pc.band_solide'), lueckenhaft: T('pc.band_lueckenhaft'), schwach: T('pc.band_schwach') };
  function strengthHTML(st) {
    if (!st) return '';
    var top = (st.gaps || []).slice(0, 3);
    return '<div class="pc-strength pc-strength-' + esc(st.band) + '">' +
      '<div class="pc-strength-head"><span class="pc-strength-score">' + st.score + '</span><span class="pc-strength-lab">' + esc(T('pc.profilstaerke_band', { band: BAND_DE[st.band] || st.band })) + '</span></div>' +
      (top.length ? '<div class="pc-strength-gaps">' + top.map(function (g) {
        return '<button type="button" class="pc-gap" id="pc-gap-' + esc(g.id) + '" data-section="' + esc(g.sectionId || '') + '" data-goal="' + esc(g.goalId || '') + '" data-action="' + esc(g.action || '') + '">' +
          '<span class="pc-gap-t">' + esc(g.label) + '</span><span class="pc-gap-h">' + esc(g.hint || '') + '</span></button>';
      }).join('') + '</div>' : '<div class="pc-strength-ok">' + T('pc.alles_da_was_die_planung') + '</div>') +
    '</div>';
  }

  /* ---------- Rendering ---------- */
  function ringSVG(percent, complete) {
    var r = 26, c = 2 * Math.PI * r;
    var off = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
    return '<svg class="pc-ring" viewBox="0 0 64 64" role="img" aria-label="Profil zu ' + percent + '' + T('pc.prozent_vollstaendig') + '' +
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
    return (sec && sec.planImpact) ? '<span class="pc-plan" title="' + T('pc.diese_angaben_beeinflussen_deinen_trainingsplan') + '">' + T('pc.beeinflusst_plan') + '</span>' : '';
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
      if (mn.length) sub = '' + T('pc.fehlt') + '' + mn.join(' · ');
    }
    return '<button type="button" class="pc-card" id="pc-card-' + esc(id) + '" aria-label="' + esc(SECTION_LABELS[id] || id) + '' + T('pc.oeffnen') + '' +
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
        '<div class="pc-id"><div class="pc-name">' + esc(h.name || '' + T('pc.dein_profil') + '') + '</div>' +
          (h.primarySportLabel ? '<div class="pc-sport"><span class="pc-sportbadge">' + esc(h.primarySportLabel) + '</span>' + (h.primaryLevelLabel ? ' <span class="pc-lvl">' + esc(h.primaryLevelLabel) + '</span>' : '') + '</div>' : '<div class="pc-sport pc-muted">' + T('pc.noch_keine_sportart_gewaehlt') + '</div>') +
          (h.primaryGoalTitle ? '<div class="pc-goal">' + esc(h.primaryGoalTitle) + (h.primaryGoalDate ? ' · ' + esc(h.primaryGoalDate) : '') + '</div>' : '') +
        '</div>' +
        ringSVG(h.ringPercent, h.essentialComplete) +
      '</div>' +
      '<div class="pc-headmeta">' +
        (h.essentialComplete ? '<span class="pc-headstate ok">' + T('pc.profil_vollstaendig') + '</span>' : '<span class="pc-headstate warn">' + h.missingCount + (h.missingCount === 1 ? '' + T('pc.angabe_fehlt') + '' : '' + T('pc.angaben_fehlen') + '') + '</span>') +
        (h.lastUpdated ? '<span class="pc-updated">zuletzt aktualisiert ' + esc(h.lastUpdated) + '</span>' : '') +
      '</div>';
    var strengthHtml = ''; try { strengthHtml = strengthHTML(buildStrength(p, now)); } catch (e) { strengthHtml = ''; }
    var promptHtml = prompts.length ? '<div class="pc-prompts">' + prompts.map(function (x) {
      return '<button type="button" class="pc-prompt pc-prompt-' + esc(x.severity) + '" id="pc-prompt-' + esc(x.id) + '" data-section="' + esc(x.sectionId) + '">' +
        '<span class="pc-prompt-title">' + esc(x.title) + '</span><span class="pc-prompt-hint">' + esc(x.hint) + '</span></button>';
    }).join('') + '</div>' : '';
    var groups = GROUPS.map(function (g) {
      return '<div class="pc-group"><div class="pc-group-label">' + esc(g.label) + '</div>' +
        g.sections.map(function (sid) { return cardHTML(p, sid, now); }).join('') + '</div>';
    }).join('');
    return head + strengthHtml + promptHtml + groups;
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
        if (sid === 'account') {   // H4: Karte führt zum Rechts-/Konto-Sheet (Export, Löschung, Consent)
          try { if (typeof root.openLegal === 'function') { root.openLegal(); return; } } catch (e) {}
          return;
        }
        try { if (typeof root.openProfileSection === 'function') root.openProfileSection(sid); } catch (e) {}
      };
    });
    var p = P();
    /* B-03: jede Luecke verlinkt auf den erhebenden Schritt */
    try {
      var st = buildStrength(p, now);
      ((st && st.gaps) || []).slice(0, 3).forEach(function (g) {
        var el = doc.getElementById('pc-gap-' + g.id); if (!el) return;
        el.onclick = function (ev) {
          try { if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {}
          if (g.action === 'goal_editor' && typeof root.openGoalEditor === 'function') { try { root.openGoalEditor(g.goalId || undefined); } catch (e) {} return; }
          try { if (g.sectionId && typeof root.openProfileSection === 'function') root.openProfileSection(g.sectionId); } catch (e) {}
        };
      });
    } catch (e) {}
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
      id: '_profileCenter', title: '' + T('pc.dein_profil') + '', size: 'full',
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
    buildSmartPrompts: buildSmartPrompts, buildStrength: buildStrength, strengthHTML: strengthHTML,
    GROUPS: GROUPS,
    SECTION_LABELS: SECTION_LABELS,
    _buildBodyHTML: buildBodyHTML,
    _rerenderIfOpen: rerenderIfOpen
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
