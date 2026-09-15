/* ============================================================
   ORVIA · workout-custom-exercise — Eigene Übungen anlegen / bearbeiten / löschen (S2b-2)

   WOFÜR. Der Katalog (0047) deckt Basisbewegung × Gerät × Griff ab — aber nicht
   jede Maschine in jedem Studio. Hier legt der Nutzer eine eigene Übung an,
   indem er die BASISBEWEGUNG wählt: Muskeln, Bewegungsmuster und Kategorie
   werden vom Katalog geerbt (korrigierbar per Chip), Gerät/Griff/Ausführung
   beschreiben die Variante. Damit ist die eigene Übung sofort in Picker,
   Muskelkarte (gym-volume) und Kraftprofil korrekt einsortiert.

   Schreibpfad ausschließlich über O.repos.exercise (RLS: nur eigene Zeilen).
   Kein DOM ausserhalb des workout-ui-Sheets.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'workout-custom-exercise@1';
  function T(k, p) { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function TD() { return O.trainingDomain || null; }
  function UI() { return O.workoutUI || null; }

  var EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'bodyweight', 'band', 'kettlebell', 'ez_bar', 'trap_bar', 't_bar', 'plate', 'pullup_bar', 'dip_bars', 'leg_press'];
  var GRIPS = ['', 'overhand_wide', 'overhand_close', 'neutral', 'overhand', 'underhand', 'rope', 'v_bar', 'bar'];
  var EXEC = ['', 'single_arm', 'single_leg', 'seated', 'standing', 'lying', 'chest_supported', 'overhead', 'weighted', 'assisted'];
  var MUSCLES = ['chest', 'front_delts', 'side_delts', 'rear_delts', 'triceps', 'biceps', 'forearms', 'lats', 'upper_back', 'traps', 'lower_back', 'abs', 'quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves', 'hip_flexors'];
  var MUSCLE_DE = { chest: 'Brust', front_delts: 'Vordere Schulter', side_delts: 'Seitl. Schulter', rear_delts: 'Hintere Schulter', triceps: 'Trizeps', biceps: 'Bizeps', forearms: 'Unterarme', lats: 'Lat', upper_back: 'Oberer Rücken', traps: 'Trapez', lower_back: 'Unterer Rücken', abs: 'Bauch/Core', quads: 'Quadrizeps', hamstrings: 'Beinbeuger', glutes: 'Gesäß', adductors: 'Adduktoren', abductors: 'Abduktoren', calves: 'Waden', hip_flexors: 'Hüftbeuger' };

  var st = null;  /* Formularzustand */

  function baseList() {
    var td = TD(); var L = (td && td.BASE_LABELS) || {};
    return Object.keys(L).map(function (k) { return { key: k, label: L[k] }; }).sort(function (a, b) { return a.label.localeCompare(b.label, 'de'); });
  }
  /* Vorlage einer Basisbewegung aus dem geladenen Katalog: Übung mit slug === base, sonst erste mit baseSlug === base */
  function templateFor(base) {
    var all = (UI() && UI()._all) || [];
    var t = all.filter(function (e) { return e && e.slug === base; })[0] || all.filter(function (e) { return e && e.baseSlug === base && e.isSystem !== false; })[0] || null;
    return t;
  }
  function musclesFromTemplate(t) {
    var out = {};
    if (t && t.muscles) Object.keys(t.muscles).forEach(function (k) { var v = t.muscles[k]; out[k] = (v && v.involvement === 'direct') ? 'direct' : 'indirect'; });
    return out;
  }
  function cycle(k) {
    var v = st.muscles[k];
    st.muscles[k] = v == null ? 'direct' : (v === 'direct' ? 'indirect' : null);
    if (st.muscles[k] == null) delete st.muscles[k];
    paintMuscles();
  }
  function paintMuscles() {
    var el = document.getElementById('cxMuscles'); if (!el) return;
    el.innerHTML = MUSCLES.map(function (k) { var v = st.muscles[k]; return '<button type="button" class="wo-fchip cx-m' + (v === 'direct' ? ' on' : v === 'indirect' ? ' half' : '') + '" data-m="' + k + '">' + esc(MUSCLE_DE[k] || k) + (v === 'direct' ? ' ●' : v === 'indirect' ? ' ◐' : '') + '</button>'; }).join('');
    var n = Object.keys(st.muscles).length; var hint = document.getElementById('cxMusHint');
    if (hint) hint.textContent = n ? T('cx.muskeln_hint_n', { n: n }) : T('cx.muskeln_hint_0');
  }
  function onBaseChange(base) {
    st.base = base || null;
    var t = templateFor(base);
    if (t) { st.muscles = musclesFromTemplate(t); st.pattern = t.movementPattern || null; st.category = t.category || null; if (!st.name) { var ni = document.getElementById('cxName'); if (ni && !ni.value) ni.placeholder = t.name + ' …'; } }
    else { st.muscles = {}; st.pattern = null; st.category = null; }
    paintMuscles();
  }

  function formHTML(existing) {
    var td = TD(); var bases = baseList();
    var opt = function (list, cur, lab) { return list.map(function (k) { return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(lab(k)) + '</option>'; }).join(''); };
    var eqLab = function (k) { return td && td.labelEquipment ? td.labelEquipment(k) : k; };
    var vLab = function (kind, k) { if (!k) return '—'; return td && td.labelVariant ? td.labelVariant((function () { var o = {}; o[kind] = k; return o; })()) : k; };
    return '<h3 class="wo-sheet-t">' + esc(existing ? T('cx.titel_bearbeiten') : T('cx.titel')) + '</h3>' +
      '<p class="wo-sheet-p">' + esc(T('cx.intro')) + '</p>' +
      '<div class="wo-inrow"><label>' + esc(T('cx.name')) + '<input type="text" id="cxName" maxlength="80" value="' + esc(st.name || '') + '" placeholder="' + esc(T('cx.name_ph')) + '"></label></div>' +
      '<div class="wo-inrow"><label>' + esc(T('cx.basis')) + '<select id="cxBase"><option value="">' + esc(T('cx.basis_keine')) + '</option>' + bases.map(function (b) { return '<option value="' + esc(b.key) + '"' + (b.key === st.base ? ' selected' : '') + '>' + esc(b.label) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="wo-inrow"><label>' + esc(T('cx.geraet')) + '<select id="cxEq">' + opt(EQUIPMENT, st.equipment, eqLab) + '</select></label>' +
      '<label>' + esc(T('cx.griff')) + '<select id="cxGrip">' + opt(GRIPS, st.grip || '', function (k) { return vLab('grip', k); }) + '</select></label></div>' +
      '<div class="wo-inrow"><label>' + esc(T('cx.ausfuehrung')) + '<select id="cxExec">' + opt(EXEC, st.exec || '', function (k) { return vLab('execution', k); }) + '</select></label></div>' +
      '<div class="cx-mus-head"><span>' + esc(T('cx.muskeln')) + '</span><small id="cxMusHint"></small></div>' +
      '<div class="cx-muscles" id="cxMuscles"></div>' +
      '<div class="cx-legend">● ' + esc(T('cx.primaer')) + ' · ◐ ' + esc(T('cx.sekundaer')) + ' · ' + esc(T('cx.tippen')) + '</div>' +
      '<div class="wo-inrow"><label>' + esc(T('cx.notiz')) + '<input type="text" id="cxNote" maxlength="200" value="' + esc(st.note || '') + '" placeholder="' + esc(T('cx.notiz_ph')) + '"></label></div>' +
      '<div class="cx-err" id="cxErr" hidden></div>' +
      '<button class="wo-sheet-btn primary" id="cxSave">' + esc(existing ? T('cx.speichern') : T('cx.anlegen')) + '</button>' +
      (existing ? '<button class="wo-sheet-btn danger" id="cxDel">' + esc(T('cx.loeschen')) + '</button>' : '') +
      '<button class="wo-sheet-btn ghost" id="cxBack">' + esc(T('common.back')) + '</button>';
  }

  function read() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
    st.name = String(g('cxName') || '').trim(); st.base = g('cxBase') || null; st.equipment = g('cxEq') || null; st.grip = g('cxGrip') || null; st.exec = g('cxExec') || null; st.note = String(g('cxNote') || '').trim();
  }
  function toExercise() {
    var variant = {}; if (st.equipment) variant.equipment = st.equipment; if (st.grip) variant.grip = st.grip; if (st.exec) variant.execution = st.exec;
    var muscles = {}; Object.keys(st.muscles).forEach(function (k) { muscles[k] = { weight: st.muscles[k] === 'direct' ? 1 : 0.5, involvement: st.muscles[k] }; });
    var eq = st.equipment ? [st.equipment] : [];
    return { name: st.name, aliases: [], description: st.note || null, category: st.category || 'compound', movementPattern: st.pattern || null, difficulty: 'beginner',
      unilateral: /single_/.test(st.exec || ''), bodyweight: st.equipment === 'bodyweight', baseSlug: st.base || null, variant: variant, muscles: muscles, equipment: eq };
  }
  function validate() {
    if (!st.name || st.name.length < 2) return T('cx.err_name');
    if (!Object.keys(st.muscles).length) return T('cx.err_muskeln');
    return null;
  }
  async function reload() {
    try { var r = await O.repos.exercise.list(); if (r && r.success && UI()) { UI()._all = r.data || []; if (typeof UI()._filter === 'function') UI()._filter(); } } catch (e) {}
  }
  function showErr(msg) { var e = document.getElementById('cxErr'); if (!e) return; if (msg) { e.textContent = msg; e.hidden = false; } else e.hidden = true; }

  function open(existing) {
    var ui = UI(); if (!ui || !ui._openSheet) return false;
    st = existing ? { id: existing.id, name: existing.name || '', base: existing.baseSlug || null, equipment: (existing.variant && existing.variant.equipment) || (existing.equipment && existing.equipment[0]) || 'machine',
      grip: (existing.variant && existing.variant.grip) || '', exec: (existing.variant && existing.variant.execution) || '', note: existing.description || '', pattern: existing.movementPattern || null, category: existing.category || null,
      muscles: musclesFromTemplate(existing) }
      : { id: null, name: '', base: null, equipment: 'machine', grip: '', exec: '', note: '', pattern: null, category: null, muscles: {} };
    ui._openSheet(formHTML(!!existing));
    paintMuscles();
    var bs = document.getElementById('cxBase'); if (bs) bs.onchange = function () { read(); onBaseChange(bs.value); };
    var mu = document.getElementById('cxMuscles'); if (mu) mu.onclick = function (ev) { var b = ev.target && ev.target.closest ? ev.target.closest('[data-m]') : null; if (b) cycle(b.getAttribute('data-m')); };
    var back = document.getElementById('cxBack'); if (back) back.onclick = function () { ui.closeSheet(); };
    var save = document.getElementById('cxSave'); if (save) save.onclick = async function () {
      read(); var err = validate(); if (err) { showErr(err); return; }
      save.disabled = true; showErr(null);
      try {
        var ex = toExercise(), r;
        if (st.id) r = await O.repos.exercise.updateUserExercise(st.id, ex);
        else r = await O.repos.exercise.createUserExercise(ex);
        if (!r || !r.success) { showErr((ui._humanErr ? ui._humanErr(r && r.error) : '') || T('cx.err_speichern')); save.disabled = false; return; }
        var id = st.id || (r.data && (r.data.id || (r.data[0] && r.data[0].id))) || null;
        ui.closeSheet(); await reload();
        try { if (typeof root.toast === 'function') root.toast(T(st.id ? 'cx.toast_gespeichert' : 'cx.toast_angelegt', { name: st.name })); } catch (e) {}
        if (!st.id && id && typeof ui.choose === 'function') ui.choose(id);
      } catch (e) { showErr(T('cx.err_speichern')); save.disabled = false; }
    };
    var del = document.getElementById('cxDel'); if (del) del.onclick = async function () {
      var okc = ui._confirmSheet ? await ui._confirmSheet(T('cx.loeschen_q'), T('cx.loeschen_body'), T('cx.loeschen'), T('common.back'), true) : root.confirm(T('cx.loeschen_q'));
      if (!okc) { open(existing); return; }
      var r = await O.repos.exercise.deleteUserExercise(st.id);
      if (!r || !r.success) { open(existing); showErr(T('cx.err_speichern')); return; }
      ui.closeSheet(); await reload();
    };
    return true;
  }

  var api = { VERSION: VERSION, open: open, MUSCLES: MUSCLES, MUSCLE_DE: MUSCLE_DE, EQUIPMENT: EQUIPMENT, GRIPS: GRIPS, EXEC: EXEC, toExercise: function () { return toExercise(); }, _state: function () { return st; } };
  O.customExercise = api;
  if (O.workoutUI) { O.workoutUI.newCustomExercise = function () { return open(null); }; O.workoutUI.editCustomExercise = function (id) { var e = ((O.workoutUI._all) || []).filter(function (x) { return x && x.id === id; })[0]; return e ? open(e) : false; }; }
  else { O._customExerciseBind = function () { if (O.workoutUI) { O.workoutUI.newCustomExercise = function () { return open(null); }; O.workoutUI.editCustomExercise = function (id) { var e = ((O.workoutUI._all) || []).filter(function (x) { return x && x.id === id; })[0]; return e ? open(e) : false; }; } }; }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
