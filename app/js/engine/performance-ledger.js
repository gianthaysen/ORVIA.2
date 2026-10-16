/* ============================================================
   ORVIA · performance-ledger (v8-448A) — Athlete Performance Ledger, rechnender Kern.

   STAND: VORBEREITET. Von der App nicht geladen, hinter dem Flag `performance_ledger` (fail-closed,
   serverseitig, Migration 0051). Kein Rekord erscheint irgendwo, bevor das Flag an ist.

   WAS ES IST: ein chronologisches Leistungsregister. Je Aktivitaet und Rekorddefinition entsteht ein
   EINTRAG (Wert, Einheit, Zeitpunkt, Herkunft, Urteil). Aus den Eintraegen einer Kennzahl wird die
   REKORDHISTORIE abgeleitet (erster Wert, jede Verbesserung, Gleichstand) — immer vollstaendig neu fuer
   genau diese Kennzahl, in der Reihenfolge des tatsaechlichen Aktivitaetszeitpunkts. Dadurch ist die
   Historie nach einem Nachimport, einer Korrektur oder einer Loeschung von selbst richtig.

   KEINE ZWEITE LOGIK:
     * Ob ein Wert zaehlt UND welcher Wert es ist, entscheidet allein metric-eligibility.evaluate()
       (eligible + value/unit). Dieses Modul rechnet keinen Wert selbst aus und schaetzt nichts.
     * Manuelle Korrekturen kommen ueber activity-effective (wirksamer Wert) in die Pruefung.
     * Kontext (Laufband, Rolle, Becken, Freiwasser) kommt aus metric-eligibility.contextOf().
       Werte aus verschiedenen Kontextklassen werden NIE miteinander verglichen (eigene Kennzahl).
     * Doppelte Einheiten (Uhr-Aufzeichnung an ein ORVIA-Workout gekoppelt) entfernt dieselbe Regel wie
       ueberall (activityConfig.attachRecordings): die Aufzeichnung ist keine eigene Einheit.

   SCHLUESSEL
     metricKey   '<sportart>.<rekord>@<kontextklasse>', z. B. 'running.fastest_5000m@standard'
     Kontextklassen  standard (nicht als indoor/virtuell belegt) · indoor · virtual · pool · open_water
     calcVersion 'ledger@1' — jede Aenderung an Definitionen oder Regeln hebt sie an; alte Ergebnisse
                 bleiben unterscheidbar und werden neu berechnet.

   ANSPRUCH: „ORVIA-Bestwert", nicht „Allzeitrekord". Was vor der ersten Aktivitaet in ORVIA lag, ist
   unbekannt; jede Bestleistung traegt ihren Geltungsbereich (scope 'orvia', coverageFrom).

   Rein: kein DOM, kein Speicher, kein Netz, keine Uhr (Zeit wird hereingegeben).
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var CALC_VERSION = 'ledger@1';

  function req(name, path) {
    if (O[name]) return O[name];
    if (typeof require === 'function') { try { return require(path); } catch (e) { return null; } }
    return null;
  }
  function ME() { return req('metricEligibility', './metric-eligibility.js'); }
  function TIME() { return req('activityTime', '../activity-time.js'); }
  function CFG() { return O.activityConfig || null; }

  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  /* ---- Rekorddefinitionen je Sportart ---------------------------------------------------------
     kind: fastest_time | longest_distance | longest_duration | greatest_volume | highest | lowest
     better ergibt sich aus kind. metric/opts = Kennzahl in metric-eligibility.
     Nur fachlich sinnvolle Rekorde: Zeiten nur dort, wo der Worker Streckenfenster rechnet (Lauf),
     Leistung nur fuer Sportarten mit Leistungsmesser, sonst Dauer. 'other' bekommt keinen Rekord —
     „laengste sonstige Einheit" vergleicht Unvergleichbares. */
  var KIND_BETTER = { fastest_time: 'lower', lowest: 'lower', longest_distance: 'higher', longest_duration: 'higher',
                      greatest_volume: 'higher', highest: 'higher' };
  var RUN_TARGETS = [[400, 'Schnellste 400 m'], [1000, 'Schnellster Kilometer'], [5000, 'Schnellste 5 km'], [10000, 'Schnellste 10 km'], [21098, 'Schnellster Halbmarathon'], [42195, 'Schnellster Marathon']];
  var POWER_WINDOWS = [[5, '5 s'], [60, '1 min'], [300, '5 min'], [1200, '20 min'], [3600, '60 min']];
  var DURATION_ONLY = ['triathlon', 'football', 'handball', 'padel', 'tennis', 'athletics', 'basketball', 'mobility',
                       'volleyball', 'hockey', 'rugby', 'badminton', 'golf', 'climbing', 'yoga', 'hyrox'];

  var DEFS = [];
  function def(sport, id, kind, metric, opts, label, extra) {
    DEFS.push(Object.assign({ id: sport + '.' + id, sport: sport, kind: kind, better: KIND_BETTER[kind], metric: metric,
                              opts: opts || {}, label: label, byContext: true }, extra || {}));
  }
  RUN_TARGETS.forEach(function (t) { def('running', 'fastest_' + t[0] + 'm', 'fastest_time', 'distanceBest', { targetM: t[0] }, t[1], { targetM: t[0] }); });
  def('running', 'longest_distance', 'longest_distance', 'distance', null, 'Längster Lauf');
  def('running', 'longest_duration', 'longest_duration', 'duration', null, 'Längste Laufzeit');
  ['walking', 'hiking'].forEach(function (s) {
    def(s, 'longest_distance', 'longest_distance', 'distance', null, s === 'hiking' ? 'Längste Wanderung' : 'Längster Spaziergang');
    def(s, 'longest_duration', 'longest_duration', 'duration', null, 'Längste Dauer');
  });
  def('cycling', 'longest_distance', 'longest_distance', 'distance', null, 'Längste Fahrt');
  def('cycling', 'longest_duration', 'longest_duration', 'duration', null, 'Längste Fahrzeit');
  POWER_WINDOWS.forEach(function (w) { def('cycling', 'best_power_' + w[0] + 's', 'highest', 'powerBest', { windowS: w[0] }, 'Beste Leistung ' + w[1], { windowS: w[0] }); });
  def('swimming', 'longest_distance', 'longest_distance', 'distance', null, 'Längste Schwimmeinheit');
  def('swimming', 'longest_duration', 'longest_duration', 'duration', null, 'Längste Schwimmzeit');
  def('rowing', 'longest_distance', 'longest_distance', 'distance', null, 'Längste Rudereinheit');
  def('rowing', 'longest_duration', 'longest_duration', 'duration', null, 'Längste Ruderzeit');
  def('gym', 'greatest_volume', 'greatest_volume', 'strengthVolume', null, 'Höchstes Trainingsvolumen', { byContext: false });
  def('gym', 'longest_duration', 'longest_duration', 'duration', null, 'Längstes Krafttraining', { byContext: false });
  DURATION_ONLY.forEach(function (s) { def(s, 'longest_duration', 'longest_duration', 'duration', null, 'Längste Einheit', { byContext: false }); });

  var DEF_BY_ID = {};
  DEFS.forEach(function (d) { DEF_BY_ID[d.id] = d; });
  function defsFor(sport) { return DEFS.filter(function (d) { return d.sport === sport; }); }

  /* Vergleichsgenauigkeit je Einheit: gleich ist, was auf dieser Stufe gleich ist. */
  var PRECISION = { s: 0.1, m: 1, kg: 0.1, W: 1, bpm: 1, spm: 0.1, 's/km': 0.1 };
  function quant(v, unit) { var p = PRECISION[unit] || 0.01; return Math.round(v / p) * p; }

  /* ---- Kontextklasse ------------------------------------------------------------------------ */
  var CLASS_OF_ENV = { indoor: 'indoor', virtual: 'virtual', pool: 'pool', open_water: 'open_water' };
  function contextClass(activity, d) {
    if (d && d.byContext === false) return 'all';
    var M = ME(), ctx = M && M.contextOf ? M.contextOf(activity) : null;
    var env = ctx ? ctx.environment : null;
    return CLASS_OF_ENV[env] || 'standard';
  }
  function metricKey(d, cls) { return d.id + '@' + cls; }
  function parseMetricKey(k) {
    var at = String(k || '').lastIndexOf('@');
    var id = at > 0 ? k.slice(0, at) : k, cls = at > 0 ? k.slice(at + 1) : null;
    return { defId: id, contextClass: cls, def: DEF_BY_ID[id] || null };
  }

  /* ---- Eingabe bereinigen -------------------------------------------------------------------
     Dieselben Regeln wie die kanonische Liste: keine Doppelten (gleiche id), keine geloeschten
     (opts.isDeleted / deletedAt / _tombstone), gekoppelte Uhr-Aufzeichnungen sind keine Einheit. */
  function canonical(list, opts) {
    var o = opts || {}, seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (a) {
      if (!obj(a) || !a.id || seen[a.id]) return;
      if (a.deletedAt || a._tombstone || (typeof o.isDeleted === 'function' && o.isDeleted(a))) return;
      seen[a.id] = true;
      out.push(a);
    });
    var C = CFG();
    if (C && typeof C.attachRecordings === 'function') {
      /* auf KOPIEN: attachRecordings haengt die Aufzeichnung an den Primaerdatensatz (a.recording) */
      try { out = C.attachRecordings(out.map(function (a) { var c = Object.assign({}, a); delete c.recording; return c; })); } catch (e) {}
    } else {
      var ids = {};
      out.forEach(function (a) { ids[a.id] = true; });
      out = out.filter(function (a) { return !(a.linkedActivityId && ids[a.linkedActivityId] && a.linkedActivityId !== a.id); });
    }
    return out;
  }

  /* ---- Fingerabdruck der Eingabe (ohne volle Messreihen) ----------------------------------------
     Unveraenderte Aktivitaeten werden nicht neu geprueft. Teil des Abdrucks ist der Belegstand der
     Eligibility (EVIDENCE, Vertrag): steigt dort eine Belegstufe, rechnet das Register alles neu. */
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
      .map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function fnv(str) {
    var h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }
  function streamDigest(st) {
    var s = obj(st) || {}, out = {};
    Object.keys(s).forEach(function (k) {
      var a = s[k];
      if (Array.isArray(a)) out[k] = [a.length, a[0], a[a.length - 1]];
    });
    return out;
  }
  /* nicht zwischengespeichert: steigt eine Belegstufe zur Laufzeit (Tests, spaeteres Nachladen), zaehlt sie sofort */
  function ruleSignature() {
    var M = ME();
    return fnv(stable({ calc: CALC_VERSION, ev: M ? M.EVIDENCE : null, cur: M ? M.DETAILS_VERSION_CURRENT : null,
                            ctx: M ? M.CONTEXT : null, defs: DEFS.map(function (d) { return [d.id, d.metric, d.opts, d.kind, d.byContext]; }) }));
  }
  function fingerprint(a, sig) {
    var m = obj(a.metrics) || {};
    var lite = {};
    Object.keys(m).forEach(function (k) {
      if (k === 'streams') lite.streams = streamDigest(m.streams);
      else if (k === 'route' || k === 'ext') return;
      else lite[k] = m[k];
    });
    var ext = obj(m.ext);
    if (ext) lite.ext = { fields: ext.fields || null, semantics: ext.semantics || null };
    /* JSON.stringify statt stable(): Schluesselreihenfolge stammt aus derselben Quelle; weicht sie einmal ab, wird die
       Aktivitaet nur unnoetig neu geprueft (gleiches Ergebnis) — nie falsch uebersprungen. 5000 Aktivitaeten < 0,2 s. */
    return fnv(JSON.stringify([sig || ruleSignature(), a.id, a.sportId, a.source, a.status, a.startedAt, a.durationSeconds,
                               a.summary || null, a.linkedActivityId || null, lite]));
  }

  /* ---- Zeitpunkt ---------------------------------------------------------------------------
     Reihenfolge = tatsaechlicher Aktivitaetszeitpunkt (Ortszeit der Einheit), NIE der Importzeitpunkt. */
  function timeOf(a, tz) {
    var T = TIME(), p = T ? T.localParts(a, tz) : { date: a.startedAt ? String(a.startedAt).slice(0, 10) : null, time: null, basis: 'utc_fallback' };
    var date = p.date || null, time = p.time || null;
    return { recordedAt: a.startedAt || null, localDate: date, localTime: time, timeBasis: p.basis || null,
             orderKey: (date || '9999-99-99') + 'T' + (time || '00:00') + '|' + String(a.startedAt || '') + '|' + String(a.id) };
  }

  /* ---- Eintraege einer Aktivitaet ------------------------------------------------------------
     Je passender Definition GENAU ein Eintrag: freigegeben (Wert aus der Eligibility) oder gesperrt
     (Wert null, Grund). Gesperrte Eintraege zeigen, was auf einen Beleg wartet — sie zaehlen nie. */
  function validationOf(r) {
    if (!r.eligible) return 'unverified';
    if (r.provenance && r.provenance.manual) return 'manual_override';
    var ev = (r.provenance && r.provenance.evidence) || {};
    var levels = Object.keys(ev).map(function (k) { return ev[k]; });
    if (levels.length && levels.every(function (l) { return l === 'own'; })) return 'own_data';
    return 'validated';
  }
  function entriesFor(a, opts) {
    var o = opts || {}, M = ME();
    if (!M || !obj(a) || !a.id) return [];
    var t = timeOf(a, o.timeZone);
    return defsFor(a.sportId).map(function (d) {
      var r = M.evaluate(a, d.metric, d.opts);
      var cls = contextClass(a, d);
      var p = r.provenance || {};
      return {
        activityId: String(a.id), sport: a.sportId, metricKey: metricKey(d, cls), defId: d.id, contextClass: cls,
        value: r.eligible ? r.value : null, unit: r.unit || null, better: d.better,
        recordedAt: t.recordedAt, localDate: t.localDate, localTime: t.localTime, timeBasis: t.timeBasis, orderKey: t.orderKey,
        source: a.source || null,
        provenance: { basis: p.basis || null, manual: !!p.manual, quality: p.quality || null, evidence: p.evidence || {},
                      context: p.context ? { environment: p.context.environment, typeKey: p.context.typeKey, origin: p.context.origin, basis: p.context.basis } : null },
        eligibility: r.eligible ? 'eligible' : 'blocked', reason: r.eligible ? null : r.reason, reasons: r.reasons || [],
        validation: validationOf(r), calcVersion: CALC_VERSION
      };
    });
  }

  /* ---- Rekordhistorie einer Kennzahl --------------------------------------------------------
     Aus ALLEN freigegebenen Eintraegen, chronologisch (orderKey, dann activityId). Ereignisse:
       first     erster belegter Wert
       improved  echt besser als der bisherige Bestwert (auf der Genauigkeitsstufe der Einheit)
       equalled  gleich gut — der bisherige Halter bleibt Bestwert (der fruehere zaehlt)
     Deterministisch: gleiche Eintraege ⇒ gleiche Ereignisse, unabhaengig von der Eingabereihenfolge. */
  function history(entries, key) {
    var list = (entries || []).filter(function (e) { return e && e.metricKey === key && e.eligibility === 'eligible' && num(e.value) !== null; })
      .slice().sort(function (x, y) { return x.orderKey < y.orderKey ? -1 : x.orderKey > y.orderKey ? 1 : (x.activityId < y.activityId ? -1 : x.activityId > y.activityId ? 1 : 0); });
    var pk = parseMetricKey(key), better = pk.def ? pk.def.better : (list[0] && list[0].better) || 'higher';
    var events = [], best = null, seq = 0;
    list.forEach(function (e) {
      var v = quant(e.value, e.unit), bv = best ? quant(best.value, best.unit) : null;
      var isBetter = best === null || (better === 'lower' ? v < bv : v > bv);
      var isEqual = best !== null && v === bv;
      if (!isBetter && !isEqual) return;
      var ev = { seq: ++seq, metricKey: key, type: best === null ? 'first' : (isBetter ? 'improved' : 'equalled'),
                 value: e.value, unit: e.unit, activityId: e.activityId, recordedAt: e.recordedAt, localDate: e.localDate,
                 manual: !!(e.provenance && e.provenance.manual), validation: e.validation, contextClass: e.contextClass,
                 previousValue: null, previousActivityId: null, previousLocalDate: null, improvement: null, improvementPct: null,
                 daysSincePrevious: null, calcVersion: CALC_VERSION };
      if (best !== null) {
        ev.previousValue = best.value; ev.previousActivityId = best.activityId; ev.previousLocalDate = best.localDate;
        if (isBetter) {
          var diff = better === 'lower' ? best.value - e.value : e.value - best.value;
          ev.improvement = quant(diff, e.unit);
          ev.improvementPct = best.value ? Math.round(10000 * diff / Math.abs(best.value)) / 100 : null;
        } else { ev.improvement = 0; ev.improvementPct = 0; }
        ev.daysSincePrevious = daysBetween(best.localDate, e.localDate);
      }
      events.push(ev);
      if (isBetter) best = e;
    });
    return events;
  }
  function daysBetween(a, b) {
    if (!a || !b) return null;
    var x = Date.parse(a + 'T00:00:00Z'), y = Date.parse(b + 'T00:00:00Z');
    return (isFinite(x) && isFinite(y)) ? Math.round((y - x) / 86400000) : null;
  }
  /* Aktueller Bestwert = letztes Ereignis 'first'/'improved'. */
  function currentBest(events) {
    for (var i = (events || []).length - 1; i >= 0; i--) if (events[i].type !== 'equalled') return events[i];
    return null;
  }

  /* ---- Meilensteine ---------------------------------------------------------------------------
     Nur aus FREIGEGEBENEN Werten tatsaechlicher Aktivitaeten. Kein Meilenstein ohne Aktivitaet und Datum.
       first_distance  erste Einheit der Sportart mit Distanz >= Schwelle (jede Kontextklasse; Klasse vermerkt)
       month_distance  Kalendermonat (Ortszeit) mit Summe freigegebener Distanzen >= Schwelle; die Aktivitaet,
                       mit der die Schwelle ueberschritten wurde. Gesperrte Distanzen zaehlen NICHT mit — die
                       Summe ist dann eine Untergrenze (lowerBound), der Meilenstein bleibt belegt.
       record          jede neue Bestleistung einer Strecken-/Distanz-Kennzahl (aus der Historie) */
  var MILESTONES = [
    { id: 'running.first_5k', kind: 'first_distance', sport: 'running', defId: 'running.longest_distance', threshold: 5000, label: 'Erste 5 km' },
    { id: 'running.first_10k', kind: 'first_distance', sport: 'running', defId: 'running.longest_distance', threshold: 10000, label: 'Erste 10 km' },
    { id: 'running.first_half', kind: 'first_distance', sport: 'running', defId: 'running.longest_distance', threshold: 21097.5, label: 'Erster Halbmarathon' },
    { id: 'running.first_marathon', kind: 'first_distance', sport: 'running', defId: 'running.longest_distance', threshold: 42195, label: 'Erster Marathon' },
    { id: 'running.month_100km', kind: 'month_distance', sport: 'running', defId: 'running.longest_distance', threshold: 100000, label: '100 Laufkilometer in einem Monat' },
    { id: 'cycling.first_100k', kind: 'first_distance', sport: 'cycling', defId: 'cycling.longest_distance', threshold: 100000, label: 'Erste 100 km auf dem Rad' },
    { id: 'swimming.first_1k', kind: 'first_distance', sport: 'swimming', defId: 'swimming.longest_distance', threshold: 1000, label: 'Erster Kilometer im Wasser' },
    { id: 'distance_record', kind: 'record', defIds: ['running.longest_distance', 'cycling.longest_distance', 'swimming.longest_distance', 'walking.longest_distance', 'hiking.longest_distance', 'rowing.longest_distance'], label: 'Persönlicher Distanzrekord' }
  ];
  /* nur die Kennzahlen, aus denen Meilensteine entstehen */
  function milestoneKeys(state) {
    var defs = {};
    MILESTONES.forEach(function (m) { if (m.defId) defs[m.defId] = true; (m.defIds || []).forEach(function (d) { defs[d] = true; }); });
    var keys = {};
    Object.keys(state.activities).forEach(function (id) { state.activities[id].entries.forEach(function (e) { if (defs[e.defId]) keys[e.metricKey] = true; }); });
    return keys;
  }
  function sortChrono(list) {
    return list.slice().sort(function (x, y) { return x.orderKey < y.orderKey ? -1 : x.orderKey > y.orderKey ? 1 : (x.activityId < y.activityId ? -1 : 1); });
  }
  function milestones(entries, eventsByKey) {
    var out = [];
    var all = (entries || []);
    MILESTONES.forEach(function (ms) {
      if (ms.kind === 'first_distance') {
        var hit = sortChrono(all.filter(function (e) { return e.defId === ms.defId && e.eligibility === 'eligible' && e.value >= ms.threshold; }))[0];
        if (hit) out.push({ key: ms.id, milestoneId: ms.id, kind: ms.kind, label: ms.label, activityId: hit.activityId, localDate: hit.localDate,
                            recordedAt: hit.recordedAt, value: hit.value, unit: hit.unit, detail: { threshold: ms.threshold, contextClass: hit.contextClass }, calcVersion: CALC_VERSION });
      } else if (ms.kind === 'month_distance') {
        var byMonth = {};
        sortChrono(all.filter(function (e) { return e.defId === ms.defId && e.localDate; })).forEach(function (e) {
          var mk = e.localDate.slice(0, 7), b = byMonth[mk] || (byMonth[mk] = { sum: 0, hit: null, blocked: 0 });
          if (e.eligibility !== 'eligible') { b.blocked++; return; }
          b.sum += e.value;
          if (!b.hit && b.sum >= ms.threshold) b.hit = { e: e, sum: b.sum };
        });
        Object.keys(byMonth).sort().forEach(function (mk) {
          var b = byMonth[mk]; if (!b.hit) return;
          out.push({ key: ms.id + ':' + mk, milestoneId: ms.id, kind: ms.kind, label: ms.label, activityId: b.hit.e.activityId, localDate: b.hit.e.localDate,
                     recordedAt: b.hit.e.recordedAt, value: Math.round(b.sum), unit: 'm',
                     detail: { month: mk, threshold: ms.threshold, lowerBound: b.blocked > 0, blockedActivities: b.blocked }, calcVersion: CALC_VERSION });
        });
      } else if (ms.kind === 'record') {
        Object.keys(eventsByKey || {}).sort().forEach(function (k) {
          var pk = parseMetricKey(k);
          if (ms.defIds.indexOf(pk.defId) < 0) return;
          (eventsByKey[k] || []).forEach(function (ev) {
            if (ev.type !== 'improved') return;
            out.push({ key: ms.id + ':' + k + ':' + ev.seq, milestoneId: ms.id, kind: ms.kind, label: ms.label, activityId: ev.activityId, localDate: ev.localDate,
                       recordedAt: ev.recordedAt, value: ev.value, unit: ev.unit, detail: { metricKey: k, previousValue: ev.previousValue, improvement: ev.improvement }, calcVersion: CALC_VERSION });
          });
        });
      }
    });
    return out.sort(function (x, y) { return (x.localDate || '') < (y.localDate || '') ? -1 : (x.localDate || '') > (y.localDate || '') ? 1 : (x.key < y.key ? -1 : 1); });
  }

  /* ---- Zustand und inkrementelle Aktualisierung --------------------------------------------
     state = { calcVersion, rules, activities: { id: { fp, sport, firstAt, entries:[…] } }, events: { metricKey: […] },
               milestones: […] }
     update(state, activities, opts) vergleicht Fingerabdruecke, prueft NUR neue/geaenderte Aktivitaeten,
     entfernt verschwundene und rechnet die Historie NUR fuer die betroffenen Kennzahlen neu.
     Ergebnis: { state (neu, Eingabe unveraendert), changes: { added, updated, removed, affectedKeys, log } } */
  function emptyState() { return { calcVersion: CALC_VERSION, rules: ruleSignature(), activities: {}, events: {}, milestones: [] }; }
  function allEntries(state, onlyKeys) {
    var out = [];
    Object.keys(state.activities).sort().forEach(function (id) {
      var es = state.activities[id].entries;
      for (var i = 0; i < es.length; i++) if (!onlyKeys || onlyKeys[es[i].metricKey]) out.push(es[i]);
    });
    return out;
  }
  function groupByKey(entries) {
    var g = {};
    for (var i = 0; i < entries.length; i++) (g[entries[i].metricKey] || (g[entries[i].metricKey] = [])).push(entries[i]);
    return g;
  }
  function update(prev, activities, opts) {
    var o = opts || {};
    var sig = ruleSignature();
    var stale = !prev || prev.calcVersion !== CALC_VERSION || prev.rules !== sig;
    var state = stale ? emptyState() : { calcVersion: prev.calcVersion, rules: prev.rules, activities: Object.assign({}, prev.activities),
                                         events: Object.assign({}, prev.events), milestones: prev.milestones || [] };
    var list = canonical(activities, o);
    var present = {}, added = [], updated = [], removed = [], affected = {};
    list.forEach(function (a) {
      var id = String(a.id); present[id] = true;
      var fp = fingerprint(a, sig) + (o.timeZone ? '|' + o.timeZone : '');
      var cur = state.activities[id];
      if (cur && cur.fp === fp) return;
      var entries = entriesFor(a, o);
      (cur ? cur.entries : []).forEach(function (e) { affected[e.metricKey] = true; });
      entries.forEach(function (e) { affected[e.metricKey] = true; });
      state.activities[id] = { fp: fp, sport: a.sportId, entries: entries };
      (cur ? updated : added).push(id);
    });
    /* opts.partial: die Eingabe ist NICHT der vollstaendige Bestand (z. B. die App hat nur die letzten 200
       Aktivitaeten geladen). Dann gilt Fehlen nicht als Loeschung — entfernt wird nur, was ausdruecklich
       geloescht ist (opts.isDeleted / deletedAt / _tombstone in der Eingabe). Ohne diese Angabe wuerde eine
       gekuerzte Liste aeltere Rekorde stillschweigend loeschen. */
    var explicitDeleted = {};
    if (o.partial) (Array.isArray(activities) ? activities : []).forEach(function (a) {
      if (obj(a) && a.id && (a.deletedAt || a._tombstone || (typeof o.isDeleted === 'function' && o.isDeleted(a)))) explicitDeleted[String(a.id)] = true;
    });
    (o.deletedIds || []).forEach(function (id) { explicitDeleted[String(id)] = true; });
    Object.keys(state.activities).forEach(function (id) {
      if (present[id]) return;
      if (o.partial && !explicitDeleted[id]) return;
      state.activities[id].entries.forEach(function (e) { affected[e.metricKey] = true; });
      delete state.activities[id];
      removed.push(id);
    });
    var keys = Object.keys(affected).sort();
    var grouped = keys.length ? groupByKey(allEntries(state, affected)) : {};
    var log = [];
    keys.forEach(function (k) {
      var before = state.events[k] || [], after = history(grouped[k] || [], k);
      var b = currentBest(before), n = currentBest(after);
      if (after.length) state.events[k] = after; else delete state.events[k];
      if (stable(before) !== stable(after)) {
        log.push({ metricKey: k, reason: !prev ? 'initial_build' : stale ? 'rules_changed' : reasonOf(k, before, after, added, updated, removed),
                   beforeBest: b ? b.value : null, afterBest: n ? n.value : null,
                   beforeActivityId: b ? b.activityId : null, afterActivityId: n ? n.activityId : null,
                   eventsBefore: before.length, eventsAfter: after.length, calcVersion: CALC_VERSION });
      }
    });
    if (keys.length || stale) state.milestones = milestones(allEntries(state, milestoneKeys(state)), state.events);
    return { state: state, changes: { added: added, updated: updated, removed: removed, affectedKeys: keys, log: log, rebuilt: stale } };
  }
  function reasonOf(k, before, after, added, updated, removed) {
    if (removed.length && !added.length && !updated.length) return 'activity_removed';
    if (updated.length && !added.length && !removed.length) return 'activity_changed';
    if (added.length && !updated.length && !removed.length) {
      /* Ein nachimportierter, aelterer Wert schreibt die Historie um, wenn sich FRUEHERE Ereignisse aendern. */
      var rewritten = before.some(function (ev, i) { return !after[i] || after[i].activityId !== ev.activityId; });
      return rewritten ? 'history_rewritten' : 'activity_added';
    }
    return 'activities_changed';
  }

  /* ---- Lesemodell fuer Oberflaeche und Persistenz ------------------------------------------- */
  function coverage(state) {
    var by = {};
    Object.keys(state.activities).forEach(function (id) {
      var a = state.activities[id];
      a.entries.forEach(function (e) {
        var c = by[e.sport] || (by[e.sport] = { sport: e.sport, from: null, activities: {}, eligible: 0, blocked: 0 });
        if (e.localDate && (!c.from || e.localDate < c.from)) c.from = e.localDate;
        c.activities[e.activityId] = true;
        if (e.eligibility === 'eligible') c.eligible++; else c.blocked++;
      });
    });
    Object.keys(by).forEach(function (s) { by[s].activities = Object.keys(by[s].activities).length; });
    return by;
  }
  function waiting(state) {
    var by = {};
    Object.keys(state.activities).forEach(function (id) {
      state.activities[id].entries.forEach(function (e) {
        if (e.eligibility === 'eligible') return;
        var k = e.defId + '|' + e.reason;
        var w = by[k] || (by[k] = { defId: e.defId, sport: e.sport, reason: e.reason, activities: 0 });
        w.activities++;
      });
    });
    return Object.keys(by).sort().map(function (k) { return by[k]; });
  }
  function readModel(state) {
    var cov = coverage(state);
    var sports = {};
    Object.keys(state.events).sort().forEach(function (k) {
      var pk = parseMetricKey(k), d = pk.def; if (!d) return;
      var evs = state.events[k], best = currentBest(evs);
      var improvements = evs.filter(function (e) { return e.type === 'improved'; });
      var last = improvements[improvements.length - 1] || null;
      var s = sports[d.sport] || (sports[d.sport] = { sport: d.sport, records: [], coverageFrom: cov[d.sport] ? cov[d.sport].from : null });
      s.records.push({ metricKey: k, defId: d.id, label: d.label, kind: d.kind, better: d.better, contextClass: pk.contextClass,
                       unit: best ? best.unit : null, best: best, previous: last ? { value: last.previousValue, localDate: last.previousLocalDate, activityId: last.previousActivityId } : null,
                       improvement: last ? last.improvement : null, improvementPct: last ? last.improvementPct : null,
                       equalledSinceBest: evs.length - 1 - evs.lastIndexOf(best),
                       history: evs, scope: 'orvia', coverageFrom: s.coverageFrom });
    });
    var order = DEFS.map(function (d) { return d.id; });
    var sportOrder = [];
    DEFS.forEach(function (d) { if (sportOrder.indexOf(d.sport) < 0) sportOrder.push(d.sport); });
    var list = Object.keys(sports).sort(function (x, y) { return sportOrder.indexOf(x) - sportOrder.indexOf(y); }).map(function (k) {
      sports[k].records.sort(function (x, y) { return order.indexOf(x.defId) - order.indexOf(y.defId) || (x.contextClass < y.contextClass ? -1 : 1); });
      return sports[k];
    });
    return { calcVersion: state.calcVersion, sports: list, milestones: state.milestones.slice(), waiting: waiting(state), coverage: cov,
             empty: list.length === 0 };
  }

  /* Zeilen fuer die Tabellen aus Migration 0051 (user_id setzt der Server aus auth.uid()). */
  function rows(state, activityIds, metricKeys) {
    var ids = activityIds ? activityIds.map(String) : Object.keys(state.activities);
    var entries = [];
    ids.forEach(function (id) {
      var a = state.activities[id]; if (!a) return;
      a.entries.forEach(function (e) {
        entries.push({ activity_id: e.activityId, sport_id: e.sport, metric_key: e.metricKey, def_id: e.defId, context_class: e.contextClass,
                       value: e.value, unit: e.unit || '', better: e.better, recorded_at: e.recordedAt, local_date: e.localDate, order_key: e.orderKey,
                       source: e.source || 'unknown', provenance: e.provenance, eligibility_status: e.eligibility, eligibility_reason: e.reason,
                       validation_status: e.validation, calc_version: e.calcVersion, input_fingerprint: a.fp });
      });
    });
    var keys = metricKeys || Object.keys(state.events);
    var events = [];
    keys.forEach(function (k) {
      (state.events[k] || []).forEach(function (ev) {
        events.push({ metric_key: k, seq: ev.seq, event_type: ev.type, activity_id: ev.activityId, value: ev.value, unit: ev.unit || '',
                      recorded_at: ev.recordedAt, local_date: ev.localDate, previous_value: ev.previousValue, previous_activity_id: ev.previousActivityId,
                      previous_local_date: ev.previousLocalDate, improvement: ev.improvement, improvement_pct: ev.improvementPct,
                      days_since_previous: ev.daysSincePrevious, manual: ev.manual, calc_version: ev.calcVersion });
      });
    });
    var milestonesRows = state.milestones.map(function (m) {
      return { milestone_key: m.key, milestone_id: m.milestoneId, activity_id: m.activityId, local_date: m.localDate, recorded_at: m.recordedAt,
               value: m.value, unit: m.unit, detail: m.detail, calc_version: m.calcVersion };
    });
    return { entries: entries, events: events, milestones: milestonesRows };
  }

  /* Kompakte Form fuer einen lokalen Zwischenspeicher (Tausende Aktivitaeten): Ereignisse und
     Meilensteine werden nicht gespeichert, sondern beim Laden aus den Eintraegen neu abgeleitet. */
  /* Je Aktivitaet: [fp, sport, gemeinsame Felder, Eintraege]; je Eintrag nur [metricKey, wert, einheit, grund, validierung].
     Die ausfuehrliche Herkunft (Grundlage, Belege, Kontext) steht in der Datenbankzeile und ist jederzeit aus der
     Aktivitaet neu pruefbar; im Zwischenspeicher reicht, was die Historie braucht. */
  function serialize(state) {
    var acts = {};
    Object.keys(state.activities).forEach(function (id) {
      var a = state.activities[id], e0 = a.entries[0] || {};
      acts[id] = [a.fp, a.sport, [e0.recordedAt || null, e0.localDate || null, e0.localTime || null, e0.timeBasis || null, e0.orderKey || null, e0.source || null],
        a.entries.map(function (e) { return [e.metricKey, e.value, e.unit, e.reason, e.validation, e.provenance && e.provenance.manual ? 1 : 0]; })];
    });
    return JSON.stringify({ v: CALC_VERSION, r: state.rules, a: acts });
  }
  function deserialize(text) {
    try {
      var d = JSON.parse(text);
      if (!d || d.v !== CALC_VERSION || d.r !== ruleSignature() || !obj(d.a)) return null;
      var st = emptyState();
      Object.keys(d.a).forEach(function (id) {
        var x = d.a[id], t = x[2] || [];
        st.activities[id] = { fp: x[0], sport: x[1], entries: (x[3] || []).map(function (c) {
          var pk = parseMetricKey(c[0]), dd = pk.def || {};
          return { activityId: id, sport: x[1], metricKey: c[0], defId: pk.defId, contextClass: pk.contextClass, value: c[1], unit: c[2], better: dd.better || null,
                   recordedAt: t[0], localDate: t[1], localTime: t[2], timeBasis: t[3], orderKey: t[4], source: t[5],
                   provenance: { cached: true, manual: c[5] === 1 }, eligibility: c[1] === null ? 'blocked' : 'eligible', reason: c[3], reasons: c[3] ? [c[3]] : [],
                   validation: c[4], calcVersion: CALC_VERSION };
        }) };
      });
      var entries = allEntries(st), keys = {};
      entries.forEach(function (e) { keys[e.metricKey] = true; });
      Object.keys(keys).sort().forEach(function (k) { var h = history(entries, k); if (h.length) st.events[k] = h; });
      st.milestones = milestones(entries, st.events);
      return st;
    } catch (e) { return null; }
  }

  var api = {
    CALC_VERSION: CALC_VERSION, DEFS: DEFS, MILESTONES: MILESTONES, KIND_BETTER: KIND_BETTER, PRECISION: PRECISION,
    defsFor: defsFor, defById: function (id) { return DEF_BY_ID[id] || null; }, metricKey: metricKey, parseMetricKey: parseMetricKey,
    contextClass: contextClass, canonical: canonical, fingerprint: fingerprint, ruleSignature: ruleSignature,
    entriesFor: entriesFor, history: history, currentBest: currentBest, milestones: milestones,
    emptyState: emptyState, update: update, readModel: readModel, rows: rows, serialize: serialize, deserialize: deserialize,
    allEntries: allEntries
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.performanceLedger = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
