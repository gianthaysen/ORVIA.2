import fs from 'fs';
function rep(f,a,b,all){let s=fs.readFileSync(f,'utf8'); if(!s.includes(a)){console.error('MISSING in '+f+': '+a.slice(0,90)); process.exit(1);} s=all?s.split(a).join(b):s.replace(a,b); fs.writeFileSync(f,s);}
/* 1) exerciseRepository: Muskeln + Geraet im Katalog mitlesen (PostgREST-Embed), Fallback ohne Embed */
rep('app/js/repos/exerciseRepository.js',
`        let q = B.sb().from('exercises').select('*').eq('active', true);
        if (filters) Object.keys(filters).forEach(k => { q = q.eq(k, filters[k]); });
        const { data, error } = await q;
        if (error) return B.fail('query_failed', error.message);
        const rows = (data || []).map(r => M ? M.exerciseFromRow(r) : r);`,
`        /* S2b-1 (v8-380): Muskel- und Geraetezuordnung kommen aus dem Katalog mit (Embed ueber die
           FK exercise_muscles/exercise_equipment). Faellt der Embed aus (aeltere DB ohne 0047 ist
           kein Grund — die Tabellen gibt es seit 0003; aber ein Schema-Cache-Fehler waere einer),
           wird ohne Embed gelesen — dann greifen die Client-Fallbacks in gym-volume. */
        const SEL = '*, exercise_muscles(muscle_key,weight,involvement), exercise_equipment(equipment_key)';
        let q = B.sb().from('exercises').select(SEL).eq('active', true);
        if (filters) Object.keys(filters).forEach(k => { q = q.eq(k, filters[k]); });
        let { data, error } = await q;
        if (error) {
          let q2 = B.sb().from('exercises').select('*').eq('active', true);
          if (filters) Object.keys(filters).forEach(k => { q2 = q2.eq(k, filters[k]); });
          const r2 = await q2; data = r2.data; error = r2.error;
        }
        if (error) return B.fail('query_failed', error.message);
        const rows = (data || []).map(r => M ? M.exerciseFromRow(r) : r);
        try { if (O.gymVolume && O.gymVolume.setCatalog) O.gymVolume.setCatalog(rows); } catch (e) {}`);
/* Eigene Uebung: Muskeln + Geraet mitschreiben (Zeilen in exercise_muscles / exercise_equipment) */
rep('app/js/repos/exerciseRepository.js',
`    async createUserExercise(ex) {
      const row = M ? M.exerciseToRow(ex) : ex; row.is_system = false;
      return B.upsert('exercises', row);
    },`,
`    async createUserExercise(ex) {
      const row = M ? M.exerciseToRow(ex) : ex; row.is_system = false;
      const r = await B.upsert('exercises', row);
      /* S2b: Muskeln/Geraet der eigenen Uebung persistieren (RLS: nur fuer eigene Uebungen erlaubt). */
      try {
        const id = r && r.success && r.data && (r.data.id || (r.data[0] && r.data[0].id));
        if (id && B.online()) {
          const mus = ex && ex.muscles ? Object.keys(ex.muscles).map(k => ({ exercise_id: id, muscle_key: k, weight: +(ex.muscles[k].weight != null ? ex.muscles[k].weight : (ex.muscles[k].involvement === 'direct' ? 1 : 0.5)), involvement: ex.muscles[k].involvement || 'direct' })) : [];
          if (mus.length) await B.sb().from('exercise_muscles').upsert(mus, { onConflict: 'exercise_id,muscle_key' });
          const eq = (ex && ex.equipment || []).map(k => ({ exercise_id: id, equipment_key: k }));
          if (eq.length) await B.sb().from('exercise_equipment').upsert(eq, { onConflict: 'exercise_id,equipment_key' });
        }
      } catch (e) {}
      return r;
    },`);
/* 2) training-domain: baseSlug, variant, muscles, equipment */
rep('app/js/training-domain.js',
`        jointStress: r.joint_stress || {}, unilateral: !!r.unilateral, bodyweight: !!r.bodyweight,
        isSystem: r.is_system !== false, userId: r.user_id || null, active: r.active !== false
      };
    },`,
`        jointStress: r.joint_stress || {}, unilateral: !!r.unilateral, bodyweight: !!r.bodyweight,
        isSystem: r.is_system !== false, userId: r.user_id || null, active: r.active !== false,
        /* S2b-1: Basisbewegung x Variante + Zuordnungen aus dem Katalog (0047) */
        baseSlug: r.base_slug || null, variant: (r.variant && typeof r.variant === 'object') ? r.variant : {},
        muscles: (function () { var out = {}; (Array.isArray(r.exercise_muscles) ? r.exercise_muscles : []).forEach(function (m) { if (m && m.muscle_key) out[m.muscle_key] = { weight: m.weight != null ? +m.weight : null, involvement: m.involvement || 'direct' }; }); return out; })(),
        equipment: (Array.isArray(r.exercise_equipment) ? r.exercise_equipment : []).map(function (x) { return x && x.equipment_key; }).filter(Boolean)
      };
    },`);
rep('app/js/training-domain.js',
`        joint_stress: e.jointStress || {}, unilateral: !!e.unilateral, bodyweight: !!e.bodyweight,
        is_system: false   // nutzerdefinierte Übungen sind NIE system
      };`,
`        joint_stress: e.jointStress || {}, unilateral: !!e.unilateral, bodyweight: !!e.bodyweight,
        base_slug: e.baseSlug || null, variant: (e.variant && typeof e.variant === 'object') ? e.variant : {},
        is_system: false   // nutzerdefinierte Übungen sind NIE system
      };`);
/* 3) Snapshot traegt Slug, Basis, Muster, Muskeln (Katalogwahrheit friert im Snapshot ein) */
rep('app/js/activity-store.js',
`        exerciseNameSnapshot: (e && e.exercise && e.exercise.name) || we.exercise_name || null,`,
`        exerciseNameSnapshot: (e && e.exercise && e.exercise.name) || we.exercise_name || null,
        /* S2b-1: Katalogzuordnung im Snapshot einfrieren — gym-volume/Kraftprofil lesen sie zuerst. */
        slug: (e && e.exercise && e.exercise.slug) || null,
        baseSlug: (e && e.exercise && e.exercise.baseSlug) || null,
        movementPattern: (e && e.exercise && e.exercise.movementPattern) || null,
        muscles: (e && e.exercise && e.exercise.muscles && Object.keys(e.exercise.muscles).length) ? e.exercise.muscles : null,`);
/* 4) gym-volume: Katalogzuordnung zuerst (Snapshot-Muskeln, dann Katalog-Cache per ID/Slug), dann die alten Fallbacks */
rep('app/js/gym-volume.js',
`  function musclesFor(ex, mapOverride) {
    var nameMap = (mapOverride && mapOverride.names) || nameLookup();`,
`  /* S2b-1 (v8-380): Katalog als Wahrheit. Muskelschluessel, die die Muskelkarte nicht kennt
     (traps/adductors/abductors/hip_flexors), werden auf die naechste Karte-Gruppe gefaltet —
     eine Naeherung, kein Messwert. */
  var MUSCLE_FOLD = { traps: 'upper_back', adductors: 'quads', abductors: 'glutes', hip_flexors: 'abs' };
  function fromCatalogMuscles(m) {
    if (!m || typeof m !== 'object') return null;
    var out = {}, any = false;
    Object.keys(m).forEach(function (k) {
      var v = m[k]; var key = MUSCLES.indexOf(k) >= 0 ? k : MUSCLE_FOLD[k]; if (!key) return;
      var inv = (v && typeof v === 'object') ? v.involvement : (v === 'direct' ? 'direct' : 'indirect');
      var w = (v && typeof v === 'object' && v.weight != null) ? +v.weight : (typeof v === 'number' ? v : null);
      var coeff = inv === 'direct' ? (w != null && w > 0 ? Math.min(1, w) : 1) : (w != null && w > 0 ? Math.min(1, w) : INDIRECT);
      if (out[key] == null || coeff > out[key]) out[key] = inv === 'direct' && coeff >= 1 ? 'direct' : coeff;
      any = true;
    });
    return any ? out : null;
  }
  var _catalogById = {}, _catalogBySlug = {};
  function setCatalog(list) {
    (Array.isArray(list) ? list : []).forEach(function (e) { if (!e) return; if (e.id) _catalogById[e.id] = e; if (e.slug) _catalogBySlug[e.slug] = e; });
  }
  function catalogEntry(ex) {
    if (!ex) return null;
    var id = ex.exerciseId || ex.exercise_id; if (id && _catalogById[id]) return _catalogById[id];
    var slug = ex.slug; if (slug && _catalogBySlug[slug]) return _catalogBySlug[slug];
    return null;
  }
  function musclesFor(ex, mapOverride) {
    /* 1. Snapshot traegt die Katalogzuordnung (ab v8-380) · 2. Katalog-Cache per ID/Slug */
    if (!mapOverride) {
      var snap = fromCatalogMuscles(ex && ex.muscles); if (snap) return snap;
      var ce = catalogEntry(ex); if (ce) { var cm = fromCatalogMuscles(ce.muscles); if (cm) return cm; }
    }
    var nameMap = (mapOverride && mapOverride.names) || nameLookup();`);
rep('app/js/gym-volume.js',
`    gymPipeline: gymPipeline, volumeAdvice: volumeAdvice, CORRIDORS: CORRIDORS,
    invalidateGymPipelineCache: invalidateGymPipelineCache`,
`    gymPipeline: gymPipeline, volumeAdvice: volumeAdvice, CORRIDORS: CORRIDORS,
    invalidateGymPipelineCache: invalidateGymPipelineCache,
    setCatalog: setCatalog, catalogEntry: catalogEntry, fromCatalogMuscles: fromCatalogMuscles, MUSCLE_FOLD: MUSCLE_FOLD`);
console.log('patch3 ok');
/* 5) training-domain: Basisbewegungs-Labels + Varianten-Label */
const BASE = JSON.parse(fs.readFileSync(process.argv[2] || '_to_delete/base-labels.json','utf8'));
rep('app/js/training-domain.js',
`  function groupOfMovement(k) { return MOVEMENT_GROUP[k] || null; }
`,
`  function groupOfMovement(k) { return MOVEMENT_GROUP[k] || null; }
  /* S2b-1: Basisbewegungen (0047) + Kurzlabel einer Variante fuer den Picker */
  const BASE_LABELS = ${JSON.stringify(BASE)};
  const VARIANT_LABELS = { grip: { overhand_wide: 'breit', overhand_close: 'eng', overhand_medium: 'mittel', overhand: 'Obergriff', underhand: 'Untergriff', neutral: 'neutral', neutral_close: 'V-Griff', rope: 'Seil', bar: 'Stange', v_bar: 'V-Griff', wide: 'breit', close: 'eng' },
    angle: { flat: 'flach', incline: 'schräg', decline: 'negativ', high: 'hoch', mid: 'mittig', high_to_low: 'von oben', low_to_high: 'von unten', '45': '45°', horizontal: 'horizontal' },
    execution: { single_arm: 'einarmig', single_leg: 'einbeinig', seated: 'sitzend', standing: 'stehend', lying: 'liegend', chest_supported: 'brustgestützt', overhead: 'über Kopf', weighted: 'mit Zusatzlast', assisted: 'assistiert', walking: 'gehend', reverse: 'rückwärts', forward: 'vorwärts', lateral: 'seitlich', bilateral: 'beidseitig', alternating: 'wechselnd', kickback: 'Kickback', preacher: 'Preacher', landmine: 'Landmine', rear_foot_elevated: 'hinterer Fuß erhöht' } };
  function labelBase(k) { return BASE_LABELS[k] || (k ? String(k).replace(/_/g, ' ') : ''); }
  function labelVariant(v) {
    v = v || {}; const parts = [];
    if (v.equipment) parts.push(labelEquipment(v.equipment));
    ['grip', 'angle', 'execution'].forEach(k => { if (v[k]) parts.push((VARIANT_LABELS[k] && VARIANT_LABELS[k][v[k]]) || String(v[k]).replace(/_/g, ' ')); });
    return parts.join(' · ');
  }
`);
rep('app/js/training-domain.js',
`    labelEquipment: labelEquipment, groupOfMovement: groupOfMovement`,
`    labelEquipment: labelEquipment, groupOfMovement: groupOfMovement, BASE_LABELS: BASE_LABELS, labelBase: labelBase, labelVariant: labelVariant`);
/* 6) Picker: Basisbewegung -> Varianten (ohne Suche), flach bei Suche; „Zuletzt" oben */
rep('app/js/workout-ui.js',
`    const el = document.getElementById('woPickList'); if (!el) return;
    const CAP = 200; const shown = list.slice(0, CAP);
    const head = '<div class="wo-pick-count">' + T('wo.pick.count', { count: list.length }) + '</div>';
    el.innerHTML = shown.length ? head + shown.map(e => {
      const recentTag = recent.indexOf(e.id) >= 0 ? ' · zuletzt' : '';
      const meta = [moveLabel(e)].filter(Boolean).join(' · ') + (e.isSystem === false ? ' · eigen' : '') + recentTag;
      return '<button class="wo-pickitem" role="listitem" onclick="ORVIA.workoutUI.choose(\\'' + e.id + '\\')"><span class="wo-pi-txt"><span class="wo-pi-main">' + esc(e.name) + '</span><span class="wo-pi-meta">' + esc(meta) + '</span></span>`,
`    const el = document.getElementById('woPickList'); if (!el) return;
    const CAP = 200; const shown = list.slice(0, CAP);
    const head = '<div class="wo-pick-count">' + T('wo.pick.count', { count: list.length }) + '</div>';
    /* S2b-1: ohne Suchbegriff nach Basisbewegung gruppieren (0047: baseSlug). Eine Zeile je
       Basisbewegung, Varianten ausklappbar; genau eine Variante ⇒ direkt waehlbar. „Zuletzt" oben. */
    const td = TD();
    if (!q && shown.length && shown.some(e => e.baseSlug)) {
      const byBase = {}, order = [];
      shown.forEach(e => { const k = e.baseSlug || ('_' + e.id); if (!byBase[k]) { byBase[k] = []; order.push(k); } byBase[k].push(e); });
      order.sort((a, b) => { const la = a[0] === '_' ? byBase[a][0].name : (td && td.labelBase ? td.labelBase(a) : a), lb = b[0] === '_' ? byBase[b][0].name : (td && td.labelBase ? td.labelBase(b) : b); return String(la).localeCompare(String(lb), 'de'); });
      const openBase = O.workoutUI._openBase || '';
      const item = e => { const vl = td && td.labelVariant ? td.labelVariant(e.variant) : ''; const meta = [vl || moveLabel(e)].filter(Boolean).join(' · ') + (e.isSystem === false ? ' · eigen' : '');
        return '<button class="wo-pickitem wo-variant" role="listitem" onclick="ORVIA.workoutUI.choose(\\'' + e.id + '\\')"><span class="wo-pi-txt"><span class="wo-pi-main">' + esc(e.name) + '</span><span class="wo-pi-meta">' + esc(meta) + '</span></span></button>'; };
      const recentRows = recent.map(id => shown.find(e => e.id === id)).filter(Boolean).slice(0, 6);
      let html = head;
      if (recentRows.length) html += '<div class="wo-pick-sect">' + T('wo.pick.recent') + '</div>' + recentRows.map(item).join('');
      html += '<div class="wo-pick-sect">' + T('wo.pick.bases', { n: order.length }) + '</div>';
      html += order.map(k => {
        const vs = byBase[k].slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
        if (vs.length === 1) return item(vs[0]);
        const label = k[0] === '_' ? vs[0].name : (td && td.labelBase ? td.labelBase(k) : k);
        const open = openBase === k;
        return '<button class="wo-pickitem wo-base' + (open ? ' on' : '') + '" role="listitem" aria-expanded="' + open + '" onclick="ORVIA.workoutUI._toggleBase(\\'' + esc(k) + '\\')"><span class="wo-pi-txt"><span class="wo-pi-main">' + esc(label) + '</span><span class="wo-pi-meta">' + esc(T('wo.pick.variants', { n: vs.length })) + '</span></span><span class="wo-pi-chev">' + (open ? '▾' : '▸') + '</span></button>' + (open ? '<div class="wo-variants">' + vs.map(item).join('') + '</div>' : '');
      }).join('');
      el.innerHTML = html; return;
    }
    el.innerHTML = shown.length ? head + shown.map(e => {
      const recentTag = recent.indexOf(e.id) >= 0 ? ' · zuletzt' : '';
      const vl = td && td.labelVariant ? td.labelVariant(e.variant) : '';
      const meta = [moveLabel(e), vl].filter(Boolean).join(' · ') + (e.isSystem === false ? ' · eigen' : '') + recentTag;
      return '<button class="wo-pickitem" role="listitem" onclick="ORVIA.workoutUI.choose(\\'' + e.id + '\\')"><span class="wo-pi-txt"><span class="wo-pi-main">' + esc(e.name) + '</span><span class="wo-pi-meta">' + esc(meta) + '</span></span>`);
rep('app/js/workout-ui.js',
`  O.workoutUI.choose = async function (exId) {`,
`  O.workoutUI._toggleBase = function (k) { O.workoutUI._openBase = (O.workoutUI._openBase === k) ? '' : k; O.workoutUI._filter(); };
  O.workoutUI.choose = async function (exId) {`);
console.log('patch3b ok');
