/* ============================================================
   ORVIA · decision-log — Stufe 0a des Bauplans (Fassung 2.1)

   WOFÜR: Die Engine trifft Entscheidungen, deren Begründung heute nach dem
   Rendern verloren ist. Wenn ORVIA am Dienstag den Long Run verschiebt, muss
   Monate später noch beantwortbar sein WARUM — nicht nur WELCHER Plan
   gespeichert wurde. Dieses Modul erzeugt genau diesen Beleg.

   Es löst drei Probleme sofort und ein viertes später:
     1. Debugging      — ein seltsamer Plan wird auf die ausgelöste Regel zurückführbar
     2. Erklärbarkeit  — der Nutzer bekommt eine Begründung statt eines Ergebnisses
     3. Regressionstest— ein gespeicherter Eingabesatz wird zum Testfall
     4. (später) Eine Lernschicht hat überhaupt Trainingsdaten.

   HÄRTESTE REGEL — BEOBACHTER, NIE BETEILIGTER: Kein Ausgang dieses Moduls darf
   den Plan verändern. Ein Schreibfehler, ein abgeschaltetes Log, ein voller
   Speicher — all das liefert {stored:false, reason} und lässt die Planung
   unberührt. Deshalb gibt build() eine KOPIE zurück und fasst die Eingaben nie an.

   ZWEITE REGEL — UNVERÄNDERLICH: Es gibt kein update(). Eine Korrektur ist ein
   NEUER Eintrag mit supersedesDecisionId. Ein Log, das man ändern kann, ist kein
   Beleg, sondern eine Meinung.

   DRITTE REGEL — REKONSTRUKTION NUR BEI GLEICHER LAUFZEIT: Gespeichert werden nur
   die Top-5-Kandidaten. Der Rest ist rekonstruierbar, WEIL die Engine-Module pur
   sind — aber Purität garantiert Determinismus nur INNERHALB einer Codeversion.
   Geänderte Scores, Tie-Breaks, Knowledge-Packs oder Flags können denselben
   Eingabesatz anders auflösen. Deshalb trägt jeder Eintrag die Versionen aller
   entscheidungsrelevanten Module, und explain() verweigert die Rekonstruktion,
   wenn der heutige Runtime-Hash nicht dem protokollierten entspricht. Lieber
   „weiß ich nicht" als eine plausible Erfindung (Regel 3 des Bauplans).

   VIERTE REGEL — ENTSCHEIDUNG IST NICHT AUSFÜHRUNG: Wählt der Designer Samstag,
   lehnt die Policy Samstag ab und verschiebt der Nutzer danach, dann darf eine
   spätere Auswertung die erste Auswahl nicht für den ausgeführten Plan halten.
   Die Kette week_design → policy_move → user_override → opportunity_move →
   final_plan macht das eindeutig. Nur ein final_plan-Eintrag beantwortet
   „was wurde tatsächlich geplant".

   DATENSCHUTZ: inputs/constraints enthalten Schmerzangaben — Gesundheitsdaten.
   redact() entfernt sie aus allem, was in Konsole oder Diagnoseausgaben geht.
   Persistiert wird ausschließlich in eine Tabelle mit RLS auf user_id
   (Migration 0032).

   Kein DOM, keine Uhr, kein Zufall. Zeit, IDs und die Senke kommen herein.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'decision-log@4';

  /* Obergrenzen. Der Designer durchsucht über combos() alle Tageskombinationen —
     ungedeckelt wären das Hunderte Einträge pro Woche und im Jahr zweistellige
     Megabyte. Der Rest bleibt über den Eingabe-Hash rekonstruierbar. */
  var CANDIDATE_CAP = 5;
  var LOCAL_RING = 200;      // lokaler Diagnosepuffer, NIE die Quelle der Wahrheit
  var REJECTED_CAP = 20;

  /* `shadow_observation` ist bewusst ein EIGENER Typ und nicht `progression`:
     Eine Schattenbeobachtung hat den Plan nicht geformt. Wuerde sie unter einem
     Entscheidungstyp laufen, mischte `explain()` sie in die Begruendung einer
     Woche, die sie nie beeinflusst hat — eine Erklaerung, die Ursachen erfindet,
     ist schlimmer als keine. */
  var TYPES = ['week_design', 'policy_move', 'user_override', 'opportunity_move',
    'progression', 'variant_select', 'constraint_block', 'final_plan',
    'shadow_observation', 'prediction_record', 'prediction_evaluation'];
  /* Vorhersagen und ihre Auswertungen sind wie Schattenbeobachtungen:
     im Log, aber nie Teil der Erklaerung einer Woche — sie haben den Plan
     nicht geformt. */
  var OBSERVATION_TYPES = ['shadow_observation', 'prediction_record', 'prediction_evaluation'];

  /* Module, deren Verhalten eine Wochenentscheidung verändern kann. Wer hier
     fehlt, kann den Plan still ändern, ohne dass der Runtime-Hash es merkt —
     die Liste ist deshalb Teil des Vertrags, nicht Bequemlichkeit. */
  var RUNTIME_MODULES = [
    ['engine', 'engineVersion'],
    ['designer', 'weekPlanDesigner'],
    ['policy', 'weekPlanPolicy'],
    ['loadProfile', 'loadProfile'],
    ['variants', 'planVariants'],
    ['zones', 'performanceZones'],
    ['flags', 'featureFlags']
  ];

  /* Felder, die Gesundheits- oder Personenbezug haben können. Alles hier wird
     aus jeder Diagnose-/Konsolenausgabe entfernt. Bewusst großzügig: ein Feld zu
     viel zu schwärzen kostet Bequemlichkeit, eines zu wenig kostet Vertrauen. */
  var SENSITIVE = ['pain', 'painDuring', 'painAfter', 'painRegion', 'symptom',
    'symptoms', 'symptomFreeDays', 'injury', 'injuries', 'diagnosis', 'medication',
    'constraints', 'constraintDetail', 'note', 'notes', 'weight', 'bodyFat',
    'birthDate', 'email', 'handle', 'name', 'rpe'];

  function _clone(x) { try { return x == null ? x : JSON.parse(JSON.stringify(x)); } catch (e) { return null; } }

  /* --- Hash ---------------------------------------------------------------
     FNV-1a, 32 Bit, als Hex. Bewusst KEIN Krypto-Hash: Der Zweck ist der
     Vergleich „derselbe Eingabesatz?", nicht Manipulationsschutz. Ein
     Krypto-Hash bräuchte SubtleCrypto und wäre asynchron — das Log muss aber
     synchron und ohne Netz funktionieren, sonst wird es zum Beteiligten. */
  function hashString(s) {
    var h = 0x811c9dc5, i;
    s = String(s == null ? '' : s);
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  /* Stabile Serialisierung: Schlüssel sortiert, damit {a:1,b:2} und {b:2,a:1}
     denselben Hash ergeben. Ohne das hinge der Hash an der Einfügereihenfolge
     und wäre als Vergleichsgröße wertlos. */
  function stable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    var ks = Object.keys(v).sort(), out = [], i;
    for (i = 0; i < ks.length; i++) out.push(JSON.stringify(ks[i]) + ':' + stable(v[ks[i]]));
    return '{' + out.join(',') + '}';
  }

  /* --- Laufzeitversionen --------------------------------------------------
     Sammelt die VERSION-Konstanten aller entscheidungsrelevanten Module. Ein
     fehlendes Modul wird als 'absent' geführt und NICHT übersprungen: Ob ein
     Modul geladen war, ist selbst entscheidungsrelevant. */
  function collectVersions(reg) {
    var src = reg || O, out = {}, i, key, name, m;
    for (i = 0; i < RUNTIME_MODULES.length; i++) {
      key = RUNTIME_MODULES[i][0]; name = RUNTIME_MODULES[i][1];
      if (key === 'engine') { out.engine = (src && src.engineVersion) || 'absent'; continue; }
      m = src && src[name];
      out[key] = (m && m.VERSION) ? String(m.VERSION) : 'absent';
    }
    out.log = VERSION;
    return out;
  }

  function runtimeHash(versions) { return hashString(stable(versions || {})); }

  /* --- Kandidaten deckeln -------------------------------------------------
     Höchster Score zuerst. Einträge ohne Score landen hinten, statt zufällig
     vorne zu stehen — sonst hinge die Auswahl an der Array-Reihenfolge. */
  function capCandidates(list, cap) {
    var arr = Array.isArray(list) ? list.slice() : [];
    var n = arr.length;
    var lim = cap == null ? CANDIDATE_CAP : cap;
    arr.sort(function (a, b) {
      var sa = (a && typeof a.score === 'number') ? a.score : -Infinity;
      var sb = (b && typeof b.score === 'number') ? b.score : -Infinity;
      return sb - sa;
    });
    return { kept: _clone(arr.slice(0, lim)) || [], evaluated: n, truncated: Math.max(0, n - lim) };
  }

  /* --- Datensatz bauen ----------------------------------------------------
     PUR. Nimmt nichts aus der Umgebung, schreibt nirgends hin, verändert die
     Eingabe nicht. Liefert immer ein Ergebnis — auch bei ungültiger Eingabe,
     dann mit valid:false. Ein ungültiger Datensatz darf nichts werfen: eine
     Exception hier würde den Aufrufer (die Planung) mitreißen. */
  function build(opts) {
    var o = opts || {};
    var errors = [];

    if (TYPES.indexOf(o.decisionType) < 0) errors.push('unknown_decision_type');
    if (!o.timestamp) errors.push('missing_timestamp');
    if (!o.decisionId) errors.push('missing_decision_id');

    var versions = o.versions || collectVersions(o.registry);
    var caps = capCandidates(o.candidates, o.candidateCap);
    var rejAll = Array.isArray(o.rejected) ? o.rejected : [];

    var rec = {
      v: 1,
      decisionId: o.decisionId || null,
      parentDecisionId: o.parentDecisionId || null,
      supersedesDecisionId: o.supersedesDecisionId || null,
      decisionType: o.decisionType || null,
      timestamp: o.timestamp || null,
      weekId: o.weekId || null,
      planId: o.planId || null,
      versions: versions,
      decisionRuntimeHash: runtimeHash(versions),
      inputs: _clone(o.inputs) || null,
      derivedState: _clone(o.derivedState) || null,
      candidates: caps.kept,
      candidatesEvaluated: caps.evaluated,
      candidatesTruncated: caps.truncated,
      selected: _clone(o.selected) || null,
      rejected: _clone(rejAll.slice(0, REJECTED_CAP)) || [],
      rejectedTruncated: Math.max(0, rejAll.length - REJECTED_CAP),
      rulesTriggered: Array.isArray(o.rulesTriggered) ? o.rulesTriggered.slice() : [],
      constraints: _clone(o.constraints) || null,
      userOverrides: _clone(o.userOverrides) || null,
      /* Verweise der überlebenden Entscheidungen — nur bei final_plan gesetzt.
         Damit terminiert die Kette in einem eigenen Eintrag, statt einen alten
         Eintrag nachträglich zu markieren (das wäre eine Mutation). */
      resolvedFrom: o.decisionType === 'final_plan'
        ? (Array.isArray(o.resolvedFrom) ? o.resolvedFrom.slice() : []) : null
    };

    /* Der Entscheidungs-Hash bindet Eingaben UND Laufzeit zusammen. Gleiche
       Eingaben bei anderer Engine-Version MÜSSEN einen anderen Hash ergeben —
       sonst würde ein alter Eintrag fälschlich als reproduzierbar gelten. */
    rec.decisionHash = hashString(stable({
      t: rec.decisionType, i: rec.inputs, d: rec.derivedState,
      c: rec.constraints, o: rec.userOverrides, r: rec.decisionRuntimeHash
    }));

    return { valid: errors.length === 0, errors: errors, record: Object.freeze(rec) };
  }

  /* --- Spaltenabbildung ---------------------------------------------------
     DIE EINE Abbildung Record → engine_decision_log-Zeile (Migration 0032).
     WARUM SIE HIER LEBT (v8-305): Es gab ZWEI handgepflegte Abbildungen —
     die produktive Senke in ui.js und ein eigenes toRow() im Live-Test. Die
     waren bereits auseinandergelaufen (dem Live-Test fehlten
     parent_decision_id, supersedes_decision_id und week_id). Ein gruener
     Live-Test bewies damit NICHT, dass die App-Senke funktioniert. Ab jetzt
     nutzen beide DIESELBE reine Funktion; wer eine Spalte aendert, aendert
     sie fuer Produkt und Beweis zugleich.

     FAIL-CLOSED: build() prueft nur Typ, Zeitstempel und ID — die
     Datenbankpflichten (user_id entsteht erst hier; runtime_hash/hash
     NOT NULL) kann build() nicht kennen. Fehlt eine NOT-NULL-Quelle, gibt es
     KEINE Zeile und einen benannten Grund — kein Insert, der erst am
     Constraint stirbt und dabei den Fehlerort verschleiert.

     BEWUSST NICHT ABGEBILDET: rejectedTruncated (Diagnosefeld ohne Spalte;
     die Zahl bleibt im Record rekonstruierbar ueber rejected + Cap). */
  function toRow(rec, userId) {
    var r = rec || {};
    var missing = [];
    if (!userId) missing.push('user_id');
    if (!r.decisionId) missing.push('decision_id');
    if (!r.decisionType) missing.push('decision_type');
    if (!r.timestamp) missing.push('decided_at');
    if (!r.decisionRuntimeHash) missing.push('decision_runtime_hash');
    if (!r.decisionHash) missing.push('decision_hash');
    if (missing.length) return { ok: false, reason: 'not_null_missing:' + missing.join(',') };
    return { ok: true, row: {
      user_id: userId,
      decision_id: r.decisionId,
      parent_decision_id: r.parentDecisionId != null ? r.parentDecisionId : null,
      supersedes_decision_id: r.supersedesDecisionId != null ? r.supersedesDecisionId : null,
      decision_type: r.decisionType,
      week_id: r.weekId != null ? r.weekId : null,
      plan_id: r.planId != null ? r.planId : null,
      decided_at: r.timestamp,
      versions: r.versions || {},
      decision_runtime_hash: r.decisionRuntimeHash,
      decision_hash: r.decisionHash,
      inputs: r.inputs != null ? r.inputs : null,
      derived_state: r.derivedState != null ? r.derivedState : null,
      candidates: r.candidates != null ? r.candidates : null,
      candidates_evaluated: (typeof r.candidatesEvaluated === 'number') ? r.candidatesEvaluated : 0,
      candidates_truncated: (typeof r.candidatesTruncated === 'number') ? r.candidatesTruncated : 0,
      selected: r.selected != null ? r.selected : null,
      rejected: r.rejected != null ? r.rejected : null,
      rules_triggered: Array.isArray(r.rulesTriggered) ? r.rulesTriggered : [],
      constraints: r.constraints != null ? r.constraints : null,
      user_overrides: r.userOverrides != null ? r.userOverrides : null,
      resolved_from: Array.isArray(r.resolvedFrom) ? r.resolvedFrom : null
    } };
  }

  /* --- Schwärzen ----------------------------------------------------------
     Für Konsole, Diagnoseansichten und alles, was den geschützten Pfad verlässt.
     Rekursiv, weil Schmerzangaben verschachtelt auftreten. */
  function redact(x, depth) {
    var d = depth || 0;
    if (d > 8 || x === null || typeof x !== 'object') return x;
    if (Array.isArray(x)) return x.map(function (v) { return redact(v, d + 1); });
    var out = {}, ks = Object.keys(x), i, k;
    for (i = 0; i < ks.length; i++) {
      k = ks[i];
      if (SENSITIVE.indexOf(k) >= 0) { out[k] = '[redigiert]'; continue; }
      out[k] = redact(x[k], d + 1);
    }
    return out;
  }

  /* --- Senke --------------------------------------------------------------
     Injiziert. Ohne Senke wird nur lokal gepuffert; das ist ein gültiger
     Zustand, kein Fehler — die App muss auch offline planen können. */
  var _sink = null;
  var _ring = [];
  var _enabled = true;

  function setSink(fn) { _sink = (typeof fn === 'function') ? fn : null; }
  function setEnabled(on) { _enabled = (on !== false); }

  /* Der einzige Weg, einen Eintrag abzulegen. Wirft NIE. Jeder Fehlerpfad endet
     in {stored:false, reason} — die Planung läuft in allen Fällen weiter. */
  function logDecision(opts) {
    var built;
    try { built = build(opts); } catch (e) {
      return { id: null, stored: false, reason: 'build_failed' };
    }
    if (!built.valid) {
      return { id: built.record.decisionId, stored: false, reason: 'invalid:' + built.errors.join(','), record: built.record };
    }
    if (!_enabled) return { id: built.record.decisionId, stored: false, reason: 'disabled', record: built.record };

    /* Lokaler Ringpuffer zuerst — er ist der Diagnosepuffer und darf verloren
       gehen. Danach die Senke; deren Fehler ändert am Rückgabewert nur den
       Grund, nie den Plan. */
    try {
      _ring.push(built.record);
      if (_ring.length > LOCAL_RING) _ring.splice(0, _ring.length - LOCAL_RING);
    } catch (e) {}

    if (!_sink) return { id: built.record.decisionId, stored: false, reason: 'no_sink', record: built.record };
    try {
      var r = _sink(built.record);
      if (r && typeof r.then === 'function') { r.then(function () {}, function () {}); }
      return { id: built.record.decisionId, stored: true, reason: 'queued', record: built.record };
    } catch (e) {
      return { id: built.record.decisionId, stored: false, reason: 'sink_failed', record: built.record };
    }
  }

  /* --- Kette auflösen -----------------------------------------------------
     Von einem final_plan-Eintrag rückwärts über parentDecisionId. Liefert die
     Kette in chronologischer Reihenfolge. Zyklen werden abgebrochen statt
     endlos verfolgt — ein defektes Log darf keine Endlosschleife erzeugen. */
  function chainOf(records, decisionId) {
    var byId = {}, i, cur, out = [], seen = {};
    var list = Array.isArray(records) ? records : _ring;
    for (i = 0; i < list.length; i++) if (list[i] && list[i].decisionId) byId[list[i].decisionId] = list[i];
    cur = byId[decisionId] || null;
    while (cur) {
      if (seen[cur.decisionId]) { out.unshift({ broken: 'cycle', at: cur.decisionId }); break; }
      seen[cur.decisionId] = true;
      out.unshift(cur);
      cur = cur.parentDecisionId ? (byId[cur.parentDecisionId] || null) : null;
    }
    return out;
  }

  /* --- Erklären -----------------------------------------------------------
     Beantwortet „warum liegt X auf Tag Y". Rekonstruktion der nicht
     gespeicherten Kandidaten NUR, wenn der heutige Runtime-Hash dem
     protokollierten entspricht. Sonst: ausdrücklich unavailable — keine
     Kandidaten aus heutigem Code, die als damalige ausgegeben würden. */
  function explain(weekId, records, registry) {
    var list = Array.isArray(records) ? records : _ring;
    /* BEOBACHTUNGEN GEHOEREN NICHT IN DIE ERKLAERUNG. Sie liegen im selben Log,
       haben den Plan aber nicht geformt. Wuerden sie hier mitlaufen, erklaerte
       die Antwort auf „warum liegt X auf Tag Y" die Woche mit einer Rechnung,
       die nie angewendet wurde. */
    var mine = list.filter(function (r) {
      return r && r.weekId === weekId && OBSERVATION_TYPES.indexOf(r.decisionType) < 0;
    });
    if (!mine.length) return { weekId: weekId, found: false, reason: 'no_entries' };

    var nowVersions = collectVersions(registry);
    var nowHash = runtimeHash(nowVersions);
    var last = mine[mine.length - 1];
    var same = last.decisionRuntimeHash === nowHash;

    var rules = {}, i, j;
    for (i = 0; i < mine.length; i++) {
      for (j = 0; j < (mine[i].rulesTriggered || []).length; j++) rules[mine[i].rulesTriggered[j]] = true;
    }
    var finals = mine.filter(function (r) { return r.decisionType === 'final_plan'; });

    return {
      weekId: weekId, found: true,
      entries: mine.length,
      chain: mine.map(function (r) {
        return { id: r.decisionId, type: r.decisionType, at: r.timestamp, rules: r.rulesTriggered };
      }),
      finalPlan: finals.length ? finals[finals.length - 1].decisionId : null,
      rulesTriggered: Object.keys(rules),
      candidatesKept: last.candidates ? last.candidates.length : 0,
      candidatesEvaluated: last.candidatesEvaluated || 0,
      reconstruction: same ? 'available' : 'unavailable_runtime_changed',
      runtime: { logged: last.decisionRuntimeHash, current: nowHash,
        loggedVersions: last.versions, currentVersions: nowVersions }
    };
  }

  /* Diagnoseausgabe — IMMER redigiert. Es gibt bewusst keinen Weg, den rohen
     Datensatz in die Konsole zu bekommen. */
  function dump(n) {
    var k = n || 20;
    return _ring.slice(-k).map(function (r) { return redact(r); });
  }

  function recent(n) { return _ring.slice(-(n || LOCAL_RING)); }
  function clear() { _ring = []; }

  var api = {
    VERSION: VERSION,
    CANDIDATE_CAP: CANDIDATE_CAP, LOCAL_RING: LOCAL_RING, TYPES: TYPES,
    OBSERVATION_TYPES: OBSERVATION_TYPES,
    RUNTIME_MODULES: RUNTIME_MODULES, SENSITIVE: SENSITIVE,
    build: build, toRow: toRow, logDecision: logDecision,
    collectVersions: collectVersions, runtimeHash: runtimeHash,
    hashString: hashString, stable: stable, capCandidates: capCandidates,
    redact: redact, chainOf: chainOf, explain: explain,
    setSink: setSink, setEnabled: setEnabled,
    dump: dump, recent: recent, clear: clear
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.decisionLog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
