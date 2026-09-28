/* ============================================================
   ORVIA · engine/profile-inputs — „Welche Eingaben liest der Planer?" (S6a, v14 pgStrength)
   ------------------------------------------------------------
   Prototyp: eine Liste JEDER Eingabe, die der Planer tatsaechlich liest, mit
   Wirkung, Zustand (vorhanden / geschaetzt / fehlt) und Weg zum Editor. Dieses
   Register fuehrt NUR Felder mit belegtem Leser (PROFILE-FIELD-MATRIX [V] bzw.
   Engine-Aufrufer in calc/profile-strength/performance-resolver). Was hier
   nicht steht, liest der Planer nicht — und steht deshalb bewusst nicht drin.
   Rein: Profil + aufgeloeste Kontexte kommen herein, kein DOM, kein Storage.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'profile-inputs@1';

  /* Register. state(ctx) → { state:'present'|'estimated'|'missing', value:String|null }.
     ctx = { p, planInput, perf, primary, availableDays, sections:{constraints:{complete}} } */
  var INPUTS = [
    { id: 'goal_date', impact: 'high', sectionId: 'goals', icon: 'target',
      label: 'Hauptziel mit Datum', readers: 'Periodisierung, Phasenlängen, Taper, Rennwoche',
      state: function (c) { var pi = c.planInput; if (!pi || pi.source !== 'main_goal') return { state: 'missing', value: null }; var g = pi.gaps || []; if (g.indexOf('target_date') >= 0) return { state: 'missing', value: pi.category || null, hint: 'Ziel ohne Datum' }; return { state: 'present', value: pi.targetDate || pi.category || 'gesetzt' }; } },
    { id: 'goal_target', impact: 'high', sectionId: 'goals', icon: 'flag',
      label: 'Zielwert / Zielzeit', readers: 'Zielpace, Realismus-Prüfung, Prognose, Ziel-Anteil am Wochenbudget',
      state: function (c) { var pi = c.planInput; if (!pi || pi.source !== 'main_goal') return { state: 'missing', value: null }; var g = pi.gaps || []; if (g.indexOf('target_value') >= 0 || g.indexOf('target_value_invalid') >= 0 || g.indexOf('target_unit_unknown') >= 0) return { state: 'missing', value: null }; return { state: 'present', value: (pi.targetValue != null ? String(pi.targetValue) + (pi.targetUnit ? ' ' + pi.targetUnit : '') : 'gesetzt') }; } },
    { id: 'performance_ref', impact: 'high', sectionId: 'body', icon: 'gauge',
      label: 'Leistungsreferenz Hauptsport', readers: 'Pace-/Leistungszonen, Vorgaben je Einheit, Prognose, Debrief-Urteil',
      state: function (c) { var perf = c.perf, prim = c.primary; if (!perf || !perf.sports) return { state: 'missing', value: null }; var sid = prim && prim.sportId ? prim.sportId : 'running'; var r = perf.sports[sid] || perf.sports.running; if (!r || !r.ok) return { state: 'missing', value: null, hint: (r && (r.detail || (r.path && r.path.prompt))) || null }; var usable = !(r.confidence === 'informational' || r.confidence === 'weak' || r.confidence === 'unknown'); try { if (O.evidence && O.evidence.usability) usable = O.evidence.usability({ evidence: r.confidence, ageRatio: r.ageRatio }).usability === 'decision_eligible'; } catch (e) {} var ref = r.reference || {}; var val = (ref.distanceKm && ref.durationMin) ? (String(ref.distanceKm).replace('.', ',') + ' km in ' + Math.round(ref.durationMin) + ' min') : (ref.source ? String(ref.source) : (r.confidence || 'vorhanden')); return { state: usable ? 'present' : 'estimated', value: val, hint: usable ? null : 'ohne Datum oder schwacher Beleg — informativ, nicht steuernd' }; } },
    { id: 'training_days', impact: 'high', sectionId: 'availability', icon: 'calendar',
      label: 'Verfügbare Trainingstage', readers: 'Wochenstruktur, Platzierung der Kernreize, Ruhetage',
      state: function (c) { var d = c.availableDays; if (d == null || d < 1) return { state: 'missing', value: null }; return { state: d >= 3 ? 'present' : 'estimated', value: d + ' Tage', hint: d < 3 ? 'wenige Tage — der Plan bleibt dünn' : null }; } },
    { id: 'level_volume', impact: 'high', sectionId: 'sports', icon: 'run',
      label: 'Trainingsniveau und Einheiten pro Woche', readers: 'Ausgangsvolumen, Progression, Plan-Varianten',
      state: function (c) { var s = c.primary; if (!s) return { state: 'missing', value: null }; var lvl = s.level || null, spw = s.sessionsPerWeek; if (!lvl && spw == null) return { state: 'missing', value: null }; if (!lvl || spw == null) return { state: 'estimated', value: (lvl || '—') + ' · ' + (spw != null ? spw + '/Woche' : '—'), hint: 'eine der beiden Angaben fehlt' }; return { state: 'present', value: lvl + ' · ' + spw + '/Woche' }; } },
    { id: 'hfmax', impact: 'high', sectionId: 'body', icon: 'heart',
      label: 'Maximale Herzfrequenz', readers: 'HF-Zonen, Belastung (TRIMP), Erholungsbewertung',
      state: function (c) { var p = c.p || {}; if (p.hfMax) return { state: 'present', value: p.hfMax + ' bpm' }; if (p.age) return { state: 'estimated', value: Math.round(208 - 0.7 * p.age) + ' bpm (Tanaka)', hint: 'aus dem Alter geschätzt — nur eintragen, wenn gemessen' }; return { state: 'missing', value: null, hint: 'ohne Alter keine Schätzung' }; } },
    { id: 'rhr', impact: 'medium', sectionId: 'body', icon: 'pulse',
      label: 'Ruhepuls-Baseline', readers: 'Readiness (Abweichung vom Ruhepuls), Erholungswert',
      state: function (c) { var p = c.p || {}; if (p.rhrBaseline) return { state: 'present', value: p.rhrBaseline + ' bpm' }; return c.hasCheckinRhr ? { state: 'estimated', value: 'aus Check-ins', hint: 'Baseline entsteht aus deinen Morgenwerten' } : { state: 'missing', value: null }; } },
    { id: 'birth', impact: 'medium', sectionId: 'personal', icon: 'user',
      label: 'Geburtsdatum oder Alter', readers: 'HFmax-Schätzung, Alterseinordnung',
      state: function (c) { var p = c.p || {}; if (p.birthDate) return { state: 'present', value: p.birthDate }; if (p.age) return { state: 'estimated', value: p.age + ' Jahre (Schätzung)' }; return { state: 'missing', value: null }; } },
    { id: 'weight', impact: 'medium', sectionId: 'body', icon: 'scale',
      label: 'Gewicht', readers: 'Relative Kraftwerte (W/kg), Energiebedarf, Ernährung',
      state: function (c) { var p = c.p || {}; return p.weightKg != null ? { state: 'present', value: p.weightKg + ' kg' } : { state: 'missing', value: null }; } },
    { id: 'sleep_goal', impact: 'medium', sectionId: 'personal', icon: 'moon',
      label: 'Schlafziel', readers: 'Schlafsoll und Schlafkonto im Readiness-Kontext',
      state: function (c) { var p = c.p || {}; return p.sleepGoalH != null ? { state: 'present', value: p.sleepGoalH + ' h' } : { state: 'estimated', value: '8 h (Standard)', hint: 'ohne Angabe gilt 8 h' }; } },
    { id: 'constraints', impact: 'medium', sectionId: 'constraints', icon: 'shield',
      label: 'Beschwerden und Einschränkungen', readers: 'Sicherheits-Check, Schmerz-Regeln der Tagesentscheidung, Übungsauswahl',
      state: function (c) { var s = c.sections && c.sections.constraints; if (!s) return { state: 'missing', value: null }; return s.complete ? { state: 'present', value: s.count != null ? (s.count ? s.count + ' Einträge' : 'keine') : 'beantwortet' } : { state: 'missing', value: null }; } },
    { id: 'risk', impact: 'medium', sectionId: 'sports', icon: 'compass',
      label: 'Risikobereitschaft', readers: 'Empfohlenes Wochenvolumen (konservativ / ausgewogen / ambitioniert)',
      state: function (c) { var p = c.p || {}; var r = (p.preferences && p.preferences.riskTolerance) || p.riskTolerance || null; return r ? { state: 'present', value: r } : { state: 'estimated', value: 'ausgewogen (Standard)', hint: 'ohne Angabe rechnet der Planer ausgewogen' }; } }
  ];

  function evaluate(ctx) {
    var c = ctx || {};
    var rows = INPUTS.map(function (d) {
      var s; try { s = d.state(c) || { state: 'missing', value: null }; } catch (e) { s = { state: 'missing', value: null, error: true }; }
      return { id: d.id, impact: d.impact, sectionId: d.sectionId, icon: d.icon, label: d.label, readers: d.readers, state: s.state, value: s.value, hint: s.hint || null };
    });
    var n = { present: 0, estimated: 0, missing: 0 };
    rows.forEach(function (r) { n[r.state] = (n[r.state] || 0) + 1; });
    var pct = rows.length ? Math.round((n.present + n.estimated * 0.5) / rows.length * 100) : 0;
    return { version: VERSION, rows: rows, counts: n, total: rows.length, pct: pct,
      groups: { high: rows.filter(function (r) { return r.impact === 'high'; }), medium: rows.filter(function (r) { return r.impact === 'medium'; }) } };
  }

  var api = { VERSION: VERSION, INPUTS: INPUTS, evaluate: evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.profileInputs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
