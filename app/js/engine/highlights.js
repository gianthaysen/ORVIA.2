/* ============================================================
   ORVIA · engine/highlights (v8-446) — Grundgeruest der Highlights-Engine.

   STATUS: VORBEREITET. Reine Funktionen mit Tests; die App laedt dieses Modul noch nicht
   und die Story (ui.js gmStoryPages) ist unveraendert. Dieses Geruest legt fest, WIE aus
   einer Einheit eine Folge von Highlights wird — die Regeln je Sportart, die historische
   Leistungsbasis und die Darstellung sind eigene Schritte.

   Ablauf:
     Einheit (wirksame Werte) + Verlauf + Ziele
       → Erzeuger liefern KANDIDATEN            (candidate)
       → Bewertung                              (score)
       → Zusammenfuehren fast gleicher Aussagen (dedupe)
       → Auswahl und Reihenfolge                (sequence)
       → je Highlight eine Darstellungsfamilie  (templateFor)

   Vier getrennte Begriffe:
     Kandidat   eine moegliche Aussage ueber DIESE Einheit, mit Beleg (evidence)
     Ereignis   die dauerhafte Tatsache dahinter („5-km-Bestzeit am …") fuer die
                Leistungsbasis (eventOf) — unabhaengig davon, ob sie gezeigt wird
     Vorlage    wie ein Highlight aussieht (TEMPLATES) — hier nur Name und Pflichtfelder
     Folge      die geordnete Auswahl fuer diese Einheit

   Grundsaetze, die das Geruest erzwingt:
     - Kein Kandidat ohne Beleg: evidence.basis sagt, woher die Aussage kommt
       ('source' = Messwert der Quelle, 'orvia' = von ORVIA berechnet, 'manual' = Angabe
       des Nutzers). Ohne Beleg wird der Kandidat verworfen, nicht geschaetzt.
     - Vergleiche brauchen ihre Vergleichsgruppe (evidence.comparedTo) — „besser" ohne
       „als was" gibt es nicht.
     - Die Engine fuellt nie auf: gibt es nur drei belegte Aussagen, sind es drei.

   Kein DOM, keine Uhr, kein Speicher, kein Netz.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var VERSION = 'highlights@1';

  /* ---- Arten und ihre Grundbedeutung (0–100) --------------------------------
     Die Stufen folgen der Vorgabe: 100 grosses Ziel erreicht · 95 grosse Bestleistung ·
     90 erste grosse Distanz · 85 FTP / Durchbruch · 80 sportartspezifische Bestleistung ·
     70 grosser Meilenstein · 60 deutliche Verbesserung · 50 starkes Merkmal der Einheit ·
     40 Bestaendigkeit · 30 normale Zusammenfassung.
     role: Platz in der Erzaehlung (siehe ROLE_ORDER). */
  var TYPES = {
    GOAL_ACHIEVEMENT:        { base: 100, role: 'reveal',   template: 'goal_achievement' },
    RACE_RESULT:             { base: 95,  role: 'reveal',   template: 'record_reveal' },
    PERSONAL_RECORD:         { base: 95,  role: 'reveal',   template: 'record_reveal' },
    FIRST_EVER:              { base: 90,  role: 'reveal',   template: 'first_ever' },
    FTP_IMPROVEMENT:         { base: 85,  role: 'reveal',   template: 'before_after' },
    POWER_RECORD:            { base: 85,  role: 'reveal',   template: 'power_curve' },
    COURSE_RECORD:           { base: 80,  role: 'reveal',   template: 'record_reveal' },
    DISTANCE_RECORD:         { base: 80,  role: 'reveal',   template: 'record_reveal' },
    PACE_RECORD:             { base: 80,  role: 'reveal',   template: 'record_reveal' },
    VOLUME_RECORD:           { base: 80,  role: 'reveal',   template: 'volume' },
    SPORT_SPECIFIC:          { base: 80,  role: 'feature',  template: 'hero_metric' },
    MILESTONE:               { base: 70,  role: 'progress', template: 'milestone' },
    PERFORMANCE_IMPROVEMENT: { base: 60,  role: 'compare',  template: 'comparison' },
    TECHNIQUE_IMPROVEMENT:   { base: 60,  role: 'compare',  template: 'technique' },
    PLAN_ACHIEVEMENT:        { base: 50,  role: 'progress', template: 'achievement' },
    ZONE_HIGHLIGHT:          { base: 50,  role: 'feature',  template: 'zone_distribution' },
    TRAINING_EFFECT:         { base: 50,  role: 'feature',  template: 'training_effect' },
    ROUTE_HIGHLIGHT:         { base: 50,  role: 'route',    template: 'route' },
    CONSISTENCY:             { base: 40,  role: 'progress', template: 'timeline' },
    COMEBACK:                { base: 40,  role: 'progress', template: 'timeline' },
    SESSION_SUMMARY:         { base: 30,  role: 'cover',    template: 'hero_metric' }
  };

  /* Darstellungsfamilien: Name + Felder, die ein Highlight dafuer mitbringen MUSS. */
  var TEMPLATES = {
    hero_metric:       ['value'],
    record_reveal:     ['value', 'comparison'],
    goal_achievement:  ['value', 'goal'],
    before_after:      ['value', 'comparison'],
    progress_ring:     ['value', 'target'],
    timeline:          ['points'],
    map:               ['route'],
    chart:             ['series'],
    zone_distribution: ['zones'],
    power_curve:       ['value', 'comparison'],
    milestone:         ['value', 'threshold'],
    first_ever:        ['value'],
    comparison:        ['value', 'comparison'],
    split_breakdown:   ['splits'],
    technique:         ['value', 'comparison'],
    training_effect:   ['value'],
    volume:            ['value'],
    achievement:       ['value'],
    route:             ['route'],
    celebration:       ['value']
  };

  var BASES = ['source', 'orvia', 'manual'];

  /* Reihenfolge der Rollen je Erzaehlform (Vorgabe „Narrative Sequencing"). */
  var ROLE_ORDER = {
    normal: ['cover', 'reveal', 'feature', 'compare', 'route', 'progress'],
    record: ['cover', 'reveal', 'compare', 'feature', 'route', 'progress'],
    goal:   ['reveal', 'cover', 'compare', 'feature', 'progress', 'route']
  };
  /* Umfang je Erzaehlform: Obergrenzen, KEINE Mindestzahl. */
  var LIMITS = { normal: 6, interesting: 8, record: 12, goal: 12 };
  var MIN_SCORE = 30;

  function num(v) { if (v == null || v === '') return null; var n = (typeof v === 'number') ? v : parseFloat(v); return isFinite(n) ? n : null; }
  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* ---- Kandidat ------------------------------------------------------------
     Eingabe (frei vom Erzeuger):
       type (Pflicht), activityId (Pflicht), sportId, group (was dieselbe Aussage ist),
       value {v, unit, label}, comparison {v, unit, delta, deltaPct, label},
       goal, target, threshold, route, series, zones, splits, points,
       evidence { basis (Pflicht), metric, comparedTo, n, note },
       weight (-20…+10, Feinabstimmung des Erzeugers), major (true = eigene Wuerdigung),
       confidence (0…1), template (ueberschreibt die Vorgabe der Art)
     Rueckgabe: { ok:true, candidate } oder { ok:false, code, message } — nie eine Ausnahme. */
  function candidate(input) {
    var c = obj(input);
    if (!c) return { ok: false, code: 'NO_INPUT', message: 'kein Kandidat' };
    var t = TYPES[c.type];
    if (!t) return { ok: false, code: 'UNKNOWN_TYPE', message: 'unbekannte Art: ' + String(c.type) };
    if (!c.activityId) return { ok: false, code: 'NO_ACTIVITY', message: 'activityId fehlt' };
    var ev = obj(c.evidence);
    if (!ev || BASES.indexOf(ev.basis) < 0) return { ok: false, code: 'NO_EVIDENCE', message: 'Beleg fehlt (evidence.basis: source | orvia | manual)' };
    var tpl = c.template || t.template;
    if (!TEMPLATES[tpl]) return { ok: false, code: 'UNKNOWN_TEMPLATE', message: 'unbekannte Vorlage: ' + String(tpl) };
    /* Ein Vergleich ohne Vergleichsgruppe ist keine belegte Aussage. */
    if (obj(c.comparison) && !ev.comparedTo) return { ok: false, code: 'NO_COMPARISON_BASIS', message: 'Vergleich ohne evidence.comparedTo' };
    var missing = TEMPLATES[tpl].filter(function (f) { return c[f] == null; });
    if (missing.length) return { ok: false, code: 'TEMPLATE_FIELDS', message: 'Vorlage ' + tpl + ' braucht: ' + missing.join(', ') };
    var conf = num(c.confidence); conf = conf == null ? 1 : clamp(conf, 0, 1);
    var out = {
      id: c.id || (String(c.type) + ':' + String(c.activityId) + ':' + String(c.group || c.type)),
      type: c.type, role: t.role, template: tpl,
      activityId: c.activityId, sportId: c.sportId || null,
      group: c.group || null, major: c.major === true,
      value: c.value != null ? c.value : null, comparison: obj(c.comparison),
      goal: c.goal != null ? c.goal : null, target: c.target != null ? c.target : null, threshold: c.threshold != null ? c.threshold : null,
      route: c.route || null, series: c.series || null, zones: c.zones || null, splits: c.splits || null, points: c.points || null,
      evidence: { basis: ev.basis, metric: ev.metric || null, comparedTo: ev.comparedTo || null, n: num(ev.n), note: ev.note || null },
      weight: clamp(num(c.weight) || 0, -20, 10), confidence: conf,
      supports: []
    };
    out.score = score(out);
    return { ok: true, candidate: out };
  }

  /* Bedeutung 0–100: Grundwert der Art + Feinabstimmung, gedaempft durch geringe Sicherheit.
     Eine unsichere Aussage rutscht nach unten, sie wird nicht „fast sicher" dargestellt. */
  function score(c) {
    var t = TYPES[c && c.type]; if (!t) return 0;
    var s = t.base + (num(c.weight) || 0);
    var conf = num(c.confidence); if (conf == null) conf = 1;
    s = s * (0.5 + 0.5 * clamp(conf, 0, 1));
    return Math.round(clamp(s, 0, 100));
  }

  /* Fast gleiche Aussagen zusammenfuehren: Kandidaten mit derselben `group` (z. B. „run:5k":
     5-km-Bestzeit, schnellster Lauf, bestes Tempo) werden EIN Highlight — das staerkste
     bleibt, die anderen haengen als `supports` daran (ihre Fakten gehen nicht verloren).
     Ohne group bleibt jeder Kandidat fuer sich. Eingabe wird nicht veraendert. */
  function dedupe(cands) {
    var list = (Array.isArray(cands) ? cands : []).filter(function (c) { return c && TYPES[c.type]; });
    var byGroup = {}, out = [];
    list.forEach(function (c) {
      if (!c.group) { out.push(Object.assign({}, c, { supports: (c.supports || []).slice() })); return; }
      var k = String(c.activityId) + '|' + c.group;
      (byGroup[k] || (byGroup[k] = [])).push(c);
    });
    Object.keys(byGroup).forEach(function (k) {
      var g = byGroup[k].slice().sort(order);
      var head = Object.assign({}, g[0]);
      head.supports = (g[0].supports || []).concat(g.slice(1).map(function (x) { return { type: x.type, value: x.value, comparison: x.comparison, evidence: x.evidence }; }));
      head.major = g.some(function (x) { return x.major; });
      out.push(head);
    });
    return out.sort(order);
  }
  /* staerkster zuerst; bei Gleichstand stabil ueber Art und id (kein Zufall) */
  function order(a, b) { return (b.score - a.score) || String(a.type).localeCompare(String(b.type)) || String(a.id).localeCompare(String(b.id)); }

  /* Erzaehlform aus dem staerksten Highlight. */
  function modeOf(cands) {
    var top = 0, goal = false;
    (cands || []).forEach(function (c) { if (c.score > top) top = c.score; if (c.type === 'GOAL_ACHIEVEMENT') goal = true; });
    if (goal) return 'goal';
    if (top >= 80) return 'record';
    if (top >= 60) return 'interesting';
    return 'normal';
  }

  /* Auswahl + Reihenfolge. Rueckgabe { mode, items, dropped, celebration }.
     - nur Kandidaten ab MIN_SCORE
     - hoechstens LIMITS[mode] (opts.max ueberschreibt nach unten wie oben)
     - genau EINE Zusammenfassung (die staerkste), sie bleibt immer erhalten
     - Reihenfolge nach Rolle der Erzaehlform, innerhalb der Rolle der staerkste zuerst */
  function sequence(cands, opts) {
    opts = opts || {};
    var all = dedupe(cands).filter(function (c) { return c.score >= MIN_SCORE; });
    var mode = modeOf(all);
    var max = num(opts.max) != null ? Math.max(1, Math.round(num(opts.max))) : LIMITS[mode];
    var summaries = all.filter(function (c) { return c.type === 'SESSION_SUMMARY'; });
    var cover = summaries.length ? summaries[0] : null;
    var rest = all.filter(function (c) { return c.type !== 'SESSION_SUMMARY'; });
    var take = rest.slice(0, Math.max(0, max - (cover ? 1 : 0)));
    var dropped = rest.slice(take.length).concat(summaries.slice(1));
    var roles = ROLE_ORDER[mode === 'interesting' ? 'normal' : mode];
    var items = (cover ? [cover] : []).concat(take).sort(function (a, b) {
      return (roles.indexOf(a.role) - roles.indexOf(b.role)) || order(a, b);
    });
    return { mode: mode, items: items, dropped: dropped, celebration: items.some(function (c) { return c.major || c.type === 'GOAL_ACHIEVEMENT'; }) };
  }

  /* Vorlage eines Highlights; grosse Ereignisse bekommen die Wuerdigung. */
  function templateFor(c) { if (!c || !TYPES[c.type]) return null; return (c.major && c.role === 'reveal') ? 'celebration' : c.template; }

  /* Dauerhafte Tatsache hinter einem Kandidaten — fuer die Leistungsbasis (eigener Schritt).
     `at` kommt herein (keine Uhr hier). Nur belegte, nicht-zusammenfassende Arten. */
  function eventOf(c, at) {
    if (!c || !TYPES[c.type] || c.type === 'SESSION_SUMMARY') return null;
    return { id: 'hl:' + c.id, type: c.type, activityId: c.activityId, sportId: c.sportId || null, group: c.group || null,
      at: at || null, value: c.value, comparison: c.comparison, evidence: c.evidence, engine: VERSION };
  }

  /* ---- Erzeuger ------------------------------------------------------------
     Ein Erzeuger ist eine reine Funktion (ctx) → Kandidaten-Eingaben[]. ctx:
       { activity, history, goals, ledger, effective } — `effective` ist ORVIA.activityEffective.
     build() ruft sie auf, verwirft Unbelegtes und liefert die Folge. Fehler eines Erzeugers
     brechen die uebrigen nicht ab; sie stehen in `rejected`. */
  var GENERATORS = [];
  function registerGenerator(name, fn) { if (typeof fn === 'function' && name) GENERATORS.push({ name: String(name), fn: fn }); }

  /* Der eine mitgelieferte Erzeuger: die Zusammenfassung aus den WIRKSAMEN Werten
     (eine manuell korrigierte Dauer gilt — nie der Quellwert). */
  registerGenerator('session_summary', function (ctx) {
    var a = ctx && ctx.activity; if (!a || !(a.id || a.clientRecordId)) return [];
    var E = ctx.effective || (root.ORVIA && root.ORVIA.activityEffective) || null;
    var dur = E ? E.resolveMetric(a, 'duration') : { effectiveValue: num(a.durationSeconds), corrected: false };
    if (dur.effectiveValue == null) return [];
    return [{ type: 'SESSION_SUMMARY', activityId: a.id || a.clientRecordId, sportId: a.sportId || null,
      value: { v: dur.effectiveValue, unit: 's', label: 'duration' },
      evidence: { basis: dur.corrected ? 'manual' : 'source', metric: 'duration' } }];
  });

  function build(ctx, opts) {
    ctx = ctx || {};
    var accepted = [], rejected = [];
    GENERATORS.forEach(function (g) {
      var res;
      try { res = g.fn(ctx) || []; } catch (e) { rejected.push({ generator: g.name, code: 'GENERATOR_ERROR', message: String(e && e.message || e) }); return; }
      (Array.isArray(res) ? res : []).forEach(function (inp) {
        var r = candidate(inp);
        if (r.ok) accepted.push(r.candidate); else rejected.push({ generator: g.name, code: r.code, message: r.message });
      });
    });
    var seq = sequence(accepted, opts);
    return { mode: seq.mode, items: seq.items, dropped: seq.dropped, celebration: seq.celebration, rejected: rejected, engine: VERSION };
  }

  var api = {
    VERSION: VERSION, MIN_SCORE: MIN_SCORE,
    types: function () { return Object.keys(TYPES); },
    typeDef: function (t) { var d = TYPES[t]; return d ? { base: d.base, role: d.role, template: d.template } : null; },
    templates: function () { return Object.keys(TEMPLATES); },
    templateFields: function (t) { return TEMPLATES[t] ? TEMPLATES[t].slice() : null; },
    limits: function () { return Object.assign({}, LIMITS); },
    candidate: candidate, score: score, dedupe: dedupe, modeOf: modeOf, sequence: sequence,
    templateFor: templateFor, eventOf: eventOf,
    registerGenerator: registerGenerator, generators: function () { return GENERATORS.map(function (g) { return g.name; }); },
    build: build
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA.highlights = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
