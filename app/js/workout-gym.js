/* ============================================================
   ORVIA · workout-gym — Phase B, Gym-Strang im Live-Player
   (B-05 Superset · B-06 Alternativen · B-07 Scheibenrechner · B-08 Progression)

   WOFÜR. workout-ui.js rendert den Player; diese Datei haengt die vier
   Gym-Funktionen an klar benannten Haken ein. workout-ui.js kennt sie nur
   als `ORVIA.workoutGym` und ruft jeden Haken FAIL-OPEN: fehlt diese Datei
   oder ein Engine-Modul, rendert der Player exakt wie bisher.

   KEIN EIGENER ZUSTAND ausser Katalog-Cache. Die Gruppierung liegt in
   workout_exercises.superset_group (Store/DB), Vorschlaege werden je Ansicht
   neu berechnet. Alles Rechnen passiert in den reinen Engine-Modulen; hier
   steht nur Uebersetzung (engine/gym-adapters) und Darstellung.

   „Datenluecke != Wert": kein Vorschlag ohne Historie, keine Alternative
   ohne Katalog, kein Scheibensatz ohne Zielgewicht — dann bleibt die
   Flaeche leer statt geraten.
   ============================================================ */
(function () {
  const O = window.ORVIA = window.ORVIA || {};
  const G = O.workoutGym = O.workoutGym || {};
  const UI = () => O.workoutUI || {};
  const WS = () => O.workoutStore;
  const st = () => WS() ? WS().state() : { session: null, exercises: [] };
  const esc = s => (typeof window.esc === 'function') ? window.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toastIt = m => { if (typeof toast === 'function') toast(m); };
  const fmtKg = w => (w == null ? '–' : (Math.round(w * 100) / 100).toString().replace('.', ',') + ' kg');
  const rerender = () => { try { UI()._render && UI()._render(); } catch (e) {} };
  const sheet = html => { try { UI()._openSheet && UI()._openSheet(html); } catch (e) {} };
  const closeSheet = () => { try { UI().closeSheet && UI().closeSheet(); } catch (e) {} };
  const AD = () => O.gymAdapters || null;

  /* ---------------- B-05 · Superset ---------------- */
  function groupsNow() {
    const SM = O.supersetModel, A = AD(); if (!SM || !A) return [];
    try { return SM.groupsOf(A.supersetInputFromTree(st().exercises || [])); } catch (e) { return []; }
  }
  function labelOf(index) {
    const A = AD(); if (!A) return null;
    const gs = groupsNow();
    for (let i = 0; i < gs.length; i++) if (gs[i].exercises.some(e => e.id === index)) return A.groupLabel(gs[i].group);
    return null;
  }
  /* Kleiner Buchstabe am Uebungs-Chip: „1ᴬ 2ᴬ 3 4ᴮ 5ᴮ" */
  G.chipBadge = function (exs, i) { const l = labelOf(i); return l ? '<sup class="wo-ssb">' + esc(l) + '</sup>' : ''; };

  /* Aktionen neben „Ersetzen/Entfernen": Superset koppeln/aufloesen + Alternative. */
  G.exerciseActionsHTML = function (idx) {
    const exs = st().exercises || []; if (!exs.length) return '';
    const we = (exs[idx] || {}).workoutExercise || {};
    const grouped = labelOf(idx) != null || we.superset_group != null;
    let h = '';
    if (O.exerciseAlternatives && AD()) h += '<button class="wo-link" onclick="ORVIA.workoutGym.alternatives(' + idx + ')">Alternative</button>';
    if (O.supersetModel && AD() && WS() && WS().setSupersetGroup) h += '<button class="wo-link" onclick="ORVIA.workoutGym.superset(' + idx + ')">' + (grouped ? 'Superset ' + esc(labelOf(idx) || '') : 'Superset') + '</button>';
    return h;
  };

  G.superset = function (idx) {
    const exs = st().exercises || []; const cur = exs[idx]; if (!cur) return;
    const we = cur.workoutExercise || {};
    const others = exs.map((e, i) => ({ e, i })).filter(x => x.i !== idx);
    if (!others.length) { toastIt('Für ein Superset braucht es eine zweite Übung.'); return; }
    const name = e => (e.exercise && e.exercise.name) || ('Übung ' + (exs.indexOf(e) + 1));
    const partnerBtns = others.map(x => {
      const l = labelOf(x.i); const same = we.superset_group != null && (x.e.workoutExercise || {}).superset_group === we.superset_group;
      return '<button class="wo-sheet-btn' + (same ? ' primary' : '') + '" onclick="ORVIA.workoutGym._pair(' + idx + ',' + x.i + ')">' + esc(name(x.e)) + (l ? ' <span class="muted">· Superset ' + esc(l) + '</span>' : '') + (same ? ' ✓' : '') + '</button>';
    }).join('');
    sheet('<h3 class="wo-sheet-t">Superset</h3><p class="wo-sheet-p">' + esc(name(cur)) + ' abwechselnd ausführen mit …</p>' + partnerBtns +
      (we.superset_group != null ? '<button class="wo-sheet-btn danger" onclick="ORVIA.workoutGym._ungroup(' + idx + ')">Aus dem Superset lösen</button>' : '') +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Zurück</button>');
  };
  G._pair = async function (idx, partner) {
    const exs = st().exercises || []; const a = exs[idx], b = exs[partner]; if (!a || !b) return;
    const gb = (b.workoutExercise || {}).superset_group, ga = (a.workoutExercise || {}).superset_group;
    let g = gb != null ? gb : (ga != null ? ga : null);
    if (g == null) { g = 1; exs.forEach(e => { const x = (e.workoutExercise || {}).superset_group; if (x != null && x >= g) g = x + 1; }); }
    closeSheet();
    const r1 = ga === g ? { success: true } : await WS().setSupersetGroup(idx, g);
    if (!r1.success) { toastIt(_errMsg(r1.error)); return; }
    const r2 = gb === g ? { success: true } : await WS().setSupersetGroup(partner, g);
    if (!r2.success) { toastIt(_errMsg(r2.error)); rerender(); return; }
    if (r1.sync_status === 'pending' || r2.sync_status === 'pending') toastIt('Superset offline gespeichert ⏳');
    rerender();
  };
  G._ungroup = async function (idx) {
    closeSheet();
    const r = await WS().setSupersetGroup(idx, null);
    if (!r.success) { toastIt(_errMsg(r.error)); return; }
    rerender();
  };
  function _errMsg(err) {
    const m = String((err && err.message) || '');
    if (/superset_group/.test(m) && /column|schema/i.test(m)) return 'Superset noch nicht freigeschaltet (Migration 0038 fehlt auf dem Server).';
    return (typeof UI()._humanErr === 'function') ? UI()._humanErr(err) : (m || 'Speichern fehlgeschlagen.');
  }
  /* Nach dem Speichern eines Satzes: im Superset zur Partner-Uebung wechseln.
     Zwischen A und B gibt es KEINE Pause (das ist die Definition); die Pause
     laeuft erst, wenn die Runde zurueck bei der ersten Uebung ankommt.
     Rueckgabe true = Wechsel passiert, der Aufrufer rendert neu. */
  G.afterSetSaved = function (idx) {
    const A = AD(); if (!A || !O.supersetModel) return false;
    const exs = st().exercises || [];
    const next = A.nextInSuperset(exs, idx, O.supersetModel);
    if (next == null || next === idx) return false;
    const gs = groupsNow(); const grp = gs.find(g => g.exercises.some(e => e.id === idx));
    const first = grp ? grp.exercises[0].id : null;
    if (next !== first) { try { WS().skipRest(); } catch (e) {} }   /* A → B: keine Pause */
    try { WS().setCurrentExercise(next); } catch (e) { return false; }
    return true;
  };

  /* ---------------- B-06 · Alternativen ---------------- */
  let _catalog = null, _catalogAt = 0;
  async function catalog() {
    if (_catalog && Date.now() - _catalogAt < 10 * 60 * 1000) return _catalog;
    if (UI()._all && UI()._all.length) { _catalog = UI()._all; _catalogAt = Date.now(); return _catalog; }
    if (!O.repos || !O.repos.exercise) return [];
    const r = await O.repos.exercise.list();
    _catalog = (r && r.success && r.data) || []; _catalogAt = Date.now();
    return _catalog;
  }
  G.alternatives = async function (idx) {
    const exs = st().exercises || []; const cur = exs[idx]; if (!cur) return;
    const exId = (cur.workoutExercise || {}).exercise_id; const A = AD(), EA = O.exerciseAlternatives;
    if (!exId || !A || !EA) return;
    sheet('<h3 class="wo-sheet-t">Alternative</h3><p class="wo-sheet-p">Wird gesucht…</p>');
    const cat = await catalog();
    const mf = O.gymVolume && O.gymVolume.musclesFor;
    const res = EA.suggest({ exerciseId: exId, catalog: A.catalogFromExercises(cat, mf), limit: 6 });
    const byId = {}; cat.forEach(e => { byId[e.id] = e; });
    const curName = (cur.exercise && cur.exercise.name) || (byId[exId] && byId[exId].name) || 'Übung';
    let body;
    if (res.reason === 'exercise_unknown') body = '<p class="wo-sheet-p">Für „' + esc(curName) + '" ist keine Muskelzuordnung hinterlegt — ohne sie gibt es keine belastbare Alternative.</p>';
    else if (!res.alternatives.length) body = '<p class="wo-sheet-p">Keine Übung im Katalog deckt dieselbe Muskulatur ab.</p>';
    else body = res.alternatives.map(a => {
      const e = byId[a.id] || {}; const pct = Math.round((a.coverage || 0) * 100);
      const why = a.reason === 'curated' ? 'kuratiert' : (a.reason === 'muscle_overlap' ? pct + ' % gleiche Muskulatur' : 'gleiches Bewegungsmuster');
      return '<button class="wo-sheet-btn" onclick="ORVIA.workoutGym._useAlternative(' + idx + ',\'' + esc(a.id) + '\')">' + esc(e.name || a.id) + ' <span class="muted">· ' + esc(why) + '</span></button>';
    }).join('');
    sheet('<h3 class="wo-sheet-t">Alternative zu ' + esc(curName) + '</h3>' + body +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Zurück</button>');
  };
  G._useAlternative = async function (idx, newId) {
    closeSheet();
    const cat = await catalog(); const ex = cat.find(e => e.id === newId) || null;
    const cur = (st().exercises || [])[idx]; const hasSets = !!(cur && cur.sets && cur.sets.length);
    const r = await WS().replaceExercise(idx, newId, true);
    if (!r || !r.success) { toastIt(_errMsg(r && r.error)); return; }
    /* replaceExercise ohne Saetze tauscht die Zeile (exercise=null) → Name nachziehen;
       mit Saetzen legt es eine neue Uebung an, die den Katalogeintrag noch nicht kennt. */
    try {
      const exs = st().exercises || [];
      const target = hasSets ? exs[exs.length - 1] : exs[idx];
      if (target && ex && !target.exercise) target.exercise = ex;
    } catch (e) {}
    toastIt(hasSets ? 'Alternative als neue Übung angelegt (Sätze bleiben).' : 'Übung ersetzt.');
    rerender();
  };

  /* ---------------- B-07 · Scheibenrechner ---------------- */
  G.platesButtonHTML = function () {
    if (!O.plateCalculator) return '';
    return '<button type="button" class="wo-mini wo-plates" onclick="ORVIA.workoutGym.plates()" title="Scheiben je Seite">⚖ Scheiben</button>';
  };
  /* Stange und Einheit sind je Sheet umschaltbar (DoD B-07: „Hantelstange
     konfigurierbar, kg/lb"). Die Zielzahl wird in der gewaehlten Einheit
     gelesen — es wird NICHT umgerechnet: wer im lb-Studio steht, tippt lb. */
  const BARS = { kg: [20, 15, 10], lb: [45, 35, 15] };
  G._unit = 'kg'; G._bar = { kg: 20, lb: 45 };
  const fmtU = (w, u) => (w == null ? '–' : (Math.round(w * 100) / 100).toString().replace('.', ',') + ' ' + u);
  G.plates = function (target) {
    const PC = O.plateCalculator; if (!PC) return;
    let t = target;
    if (t == null) { const el = document.getElementById('wiW'); const v = el ? (el.value !== '' ? el.value : el.placeholder) : ''; t = v === '' ? null : +v; }
    if (t == null || isNaN(t)) { toastIt('Erst ein Gewicht eintragen.'); return; }
    const u = G._unit, bar = G._bar[u];
    const r = PC.compute({ target: t, bar: bar, unit: u });
    const bars = BARS[u].map(b => '<button class="wo-mini' + (b === bar ? ' on' : '') + '" onclick="ORVIA.workoutGym._setBar(' + b + ',' + t + ')">' + b + ' ' + u + '</button>').join(' ');
    const units = ['kg', 'lb'].map(x => '<button class="wo-mini' + (x === u ? ' on' : '') + '" onclick="ORVIA.workoutGym._setUnit(\'' + x + '\',' + t + ')">' + x + '</button>').join(' ');
    let body;
    if (!r.feasible) {
      body = r.reason === 'below_bar' ? '<p class="wo-sheet-p">' + fmtU(t, u) + ' liegt unter dem Stangengewicht (' + fmtU(r.bar, u) + ').</p>' : '<p class="wo-sheet-p">Keine Berechnung möglich.</p>';
    } else {
      const rows = r.perSide.length ? r.perSide.map(p => '<div class="wo-plate-row"><b>' + p.count + ' ×</b> ' + fmtU(p.plate, u) + '</div>').join('') : '<div class="wo-plate-row">nur Stange</div>';
      const diff = r.exact ? '<span class="muted">exakt</span>' : '<span class="muted">ladbar: ' + fmtU(r.achieved, u) + ' (' + (r.delta < 0 ? '−' : '+') + fmtU(Math.abs(r.delta), u) + ')</span>';
      body = '<div class="wo-plate-big">' + fmtU(t, u) + ' ' + diff + '</div><div class="wo-plate-sub">je Seite · Stange ' + fmtU(r.bar, u) + '</div>' + rows;
    }
    sheet('<h3 class="wo-sheet-t">Scheiben</h3>' + body +
      '<div class="wo-inrow" style="margin-top:12px;justify-content:center">' + bars + '</div>' +
      '<div class="wo-inrow" style="margin-top:6px;justify-content:center">' + units + '</div>' +
      (r.feasible && !r.exact && u === 'kg' ? '<button class="wo-sheet-btn primary" onclick="ORVIA.workoutGym._takeWeight(' + r.achieved + ')">' + fmtU(r.achieved, u) + ' übernehmen</button>' : '') +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Zurück</button>');
  };
  G._setBar = function (b, t) { G._bar[G._unit] = b; G.plates(t); };
  G._setUnit = function (u, t) { G._unit = (u === 'lb') ? 'lb' : 'kg'; G.plates(t); };
  G._takeWeight = function (w) { const el = document.getElementById('wiW'); if (el) el.value = w; closeSheet(); };

  /* ---------------- B-08 · Progressionsvorschlag je Satz ---------------- */
  const ACTION_DE = { increase: 'steigern', hold: 'halten', reduce: 'reduzieren', deload: 'Deload', none: '–' };
  const REASON_DE = { range_topped: 'Obergrenze erreicht', effort_capped: 'RIR 0 — erst Reserve aufbauen', rir_unknown: 'RIR fehlt', within_range: '+1 Wdh', below_range: 'unter dem Zielbereich', stagnation: 'stagniert', no_data: 'keine Daten', range_invalid: '' };
  /* Wird von loadLast nach dem Laden der letzten Leistung gerufen. `prev` ist
     das Repo-Ergebnis (date/sets/history). Rendert in #woSuggest, sonst nichts. */
  G.renderSuggestion = function (cur, prev) {
    const el = document.getElementById('woSuggest'); if (!el) return;
    const SP = O.strengthProgression, A = AD();
    if (!SP || !A || !prev || !Array.isArray(prev.history)) { el.innerHTML = ''; return; }
    const we = (cur && cur.workoutExercise) || {};
    const hist = A.historyFromExerciseRows(prev.history);
    const res = SP.suggest({ history: hist, repRange: A.repRangeFromWorkoutExercise(we) || undefined });
    if (!res.perSet.length) { el.innerHTML = ''; return; }
    const range = A.repRangeFromWorkoutExercise(we) || SP.DEFAULT_RANGE;
    const rows = res.perSet.map(p => {
      if (p.action === 'none' || p.weight == null) return '<div class="wo-sg-row muted">Satz ' + p.setNumber + ': ' + esc(REASON_DE[p.reason] || '') + '</div>';
      const cls = p.action === 'increase' ? 'up' : (p.action === 'deload' || p.action === 'reduce' ? 'down' : '');
      return '<button class="wo-sg-row ' + cls + '" onclick="ORVIA.workoutGym._take(' + p.weight + ',' + p.reps + ')">' +
        '<span class="wo-sg-n">Satz ' + p.setNumber + '</span><span class="wo-sg-v">' + fmtKg(p.weight) + ' × ' + p.reps + '</span>' +
        '<span class="wo-sg-a">' + esc(ACTION_DE[p.action] || p.action) + (REASON_DE[p.reason] ? ' · ' + esc(REASON_DE[p.reason]) : '') + '</span></button>';
    }).join('');
    el.innerHTML = '<div class="wo-sg-h">Vorschlag <span class="muted">· doppelte Progression, Ziel ' + range.min + '–' + range.max + ' Wdh · antippen übernimmt</span></div>' + rows;
  };
  G._take = function (w, r) { const ew = document.getElementById('wiW'), er = document.getElementById('wiR'); if (ew) ew.value = w; if (er) er.value = r; };
})();
