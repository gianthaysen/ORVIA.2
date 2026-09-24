import fs from 'fs';
function rep(f,a,b){let s=fs.readFileSync(f,'utf8'); if(!s.includes(a)){console.error('MISSING in '+f+': '+a.slice(0,100)); process.exit(1);} s=s.replace(a,b); fs.writeFileSync(f,s);}
/* Repository: update mit Domain-Objekt + Muskeln/Geraet ersetzen */
rep('app/js/repos/exerciseRepository.js',
`      try {
        const { data, error } = await B.sb().from('exercises').update(patch).eq('id', id).eq('user_id', B.currentUserId()).eq('is_system', false).select();
        if (error) return B.fail('update_failed', error.message);
        return B.ok((data && data[0]) || null);`,
`      try {
        /* S2b-2: Domain-Objekt (camelCase) wird gemappt; Muskeln/Geraet werden ersetzt (nur eigene Uebungen, RLS). */
        const isDomain = patch && (patch.movementPattern !== undefined || patch.baseSlug !== undefined || patch.muscles !== undefined);
        const row = isDomain && M ? M.exerciseToRow(patch) : Object.assign({}, patch);
        delete row.is_system; delete row.user_id;
        const { data, error } = await B.sb().from('exercises').update(row).eq('id', id).eq('user_id', B.currentUserId()).eq('is_system', false).select();
        if (error) return B.fail('update_failed', error.message);
        try {
          if (patch && patch.muscles) {
            await B.sb().from('exercise_muscles').delete().eq('exercise_id', id);
            const mus = Object.keys(patch.muscles).map(k => ({ exercise_id: id, muscle_key: k, weight: +(patch.muscles[k].weight != null ? patch.muscles[k].weight : (patch.muscles[k].involvement === 'direct' ? 1 : 0.5)), involvement: patch.muscles[k].involvement || 'direct' }));
            if (mus.length) await B.sb().from('exercise_muscles').upsert(mus, { onConflict: 'exercise_id,muscle_key' });
          }
          if (patch && Array.isArray(patch.equipment)) {
            await B.sb().from('exercise_equipment').delete().eq('exercise_id', id);
            const eq = patch.equipment.map(k => ({ exercise_id: id, equipment_key: k }));
            if (eq.length) await B.sb().from('exercise_equipment').upsert(eq, { onConflict: 'exercise_id,equipment_key' });
          }
        } catch (e) {}
        return B.ok((data && data[0]) || null);`);
/* Picker: Zeile „Eigene Uebung anlegen" + Stift an eigenen Uebungen */
rep('app/js/workout-ui.js',
`    const td = TD();
    if (!q && shown.length && shown.some(e => e.baseSlug)) {`,
`    const td = TD();
    /* S2b-2: Eigene Uebung anlegen (immer erreichbar) + Stift an eigenen Uebungen */
    const newRow = '<button class="wo-pickitem wo-newex" role="listitem" onclick="ORVIA.workoutUI.newCustomExercise()"><span class="wo-pi-txt"><span class="wo-pi-main">+ ' + T('cx.titel') + '</span><span class="wo-pi-meta">' + T('cx.picker_sub') + '</span></span></button>';
    const own = e => (e.isSystem === false ? '<button type="button" class="wo-pi-edit" aria-label="' + T('cx.titel_bearbeiten') + '" onclick="ORVIA.workoutUI.editCustomExercise(\\'' + e.id + '\\')">✎</button>' : '');
    const wrap = (e, inner) => (e.isSystem === false ? '<div class="wo-pickrow">' + inner + own(e) + '</div>' : inner);
    if (!q && shown.length && shown.some(e => e.baseSlug)) {`);
rep('app/js/workout-ui.js',
`        return '<button class="wo-pickitem wo-variant" role="listitem" onclick="ORVIA.workoutUI.choose(\\'' + e.id + '\\')"><span class="wo-pi-txt"><span class="wo-pi-main">' + esc(e.name) + '</span><span class="wo-pi-meta">' + esc(meta) + '</span></span></button>'; };`,
`        return wrap(e, '<button class="wo-pickitem wo-variant" role="listitem" onclick="ORVIA.workoutUI.choose(\\'' + e.id + '\\')"><span class="wo-pi-txt"><span class="wo-pi-main">' + esc(e.name) + '</span><span class="wo-pi-meta">' + esc(meta) + '</span></span></button>'); };`);
rep('app/js/workout-ui.js',
`      let html = head;
      if (recentRows.length)`,
`      let html = head + newRow;
      if (recentRows.length)`);
rep('app/js/workout-ui.js',
`    el.innerHTML = shown.length ? head + shown.map(e => {`,
`    el.innerHTML = shown.length ? head + newRow + shown.map(e => {`);
/* flache Liste: Stift */
{ let s=fs.readFileSync('app/js/workout-ui.js','utf8');
  const re=/(const meta = \[moveLabel\(e\), vl\]\.filter\(Boolean\)\.join\(' · '\) \+ \(e\.isSystem === false \? ' · eigen' : ''\) \+ recentTag;\n\s*return )('<button class="wo-pickitem" role="listitem" onclick="ORVIA\.workoutUI\.choose\(\\'' \+ e\.id \+ '\\'\)">[^\n]*?<\/button>';)/;
  const m=s.match(re); if(!m){console.error('MISSING flat item'); process.exit(1);}
  s=s.replace(re, (all,a,b)=> a + 'wrap(e, ' + b.slice(0,-1) + ');');
  fs.writeFileSync('app/js/workout-ui.js',s); }
/* Leerer Treffer: Anlegen anbieten */
rep('app/js/workout-ui.js',
`: '<p class="muted" style="padding:16px">' + T('wo.pick.none') + '</p>';`,
`: newRow + '<p class="muted" style="padding:16px">' + T('wo.pick.none') + '</p>';`);
/* index.html + sw.js */
rep('app/index.html', '<script src="js/workout-ui.js"></script>', '<script src="js/workout-ui.js"></script>\n<script src="js/workout-custom-exercise.js"></script>');
rep('app/sw.js', "'./js/workout-ui.js',", "'./js/workout-ui.js','./js/workout-custom-exercise.js',");
/* Locale */
rep('app/locales/de.js', "    'wo.pick.recent': 'Zuletzt verwendet',",
`    'wo.pick.recent': 'Zuletzt verwendet',
    /* ---- Eigene Uebungen (S2b-2) ---- */
    'cx.titel': 'Eigene Übung anlegen',
    'cx.titel_bearbeiten': 'Eigene Übung bearbeiten',
    'cx.picker_sub': 'Maschine oder Variante, die im Katalog fehlt — mit Muskeln aus der Basisbewegung',
    'cx.intro': 'Wähle die Basisbewegung — Muskeln und Bewegungsmuster werden übernommen, du kannst sie anpassen.',
    'cx.name': 'Name', 'cx.name_ph': 'z. B. Brustpresse Hammer Strength schräg',
    'cx.basis': 'Basisbewegung', 'cx.basis_keine': 'Keine / Sonstige',
    'cx.geraet': 'Gerät', 'cx.griff': 'Griff', 'cx.ausfuehrung': 'Ausführung',
    'cx.muskeln': 'Muskeln', 'cx.muskeln_hint_0': 'noch keine — Basisbewegung wählen oder antippen', 'cx.muskeln_hint_n': '{n} zugeordnet',
    'cx.primaer': 'primär', 'cx.sekundaer': 'sekundär', 'cx.tippen': 'antippen wechselt',
    'cx.notiz': 'Notiz (optional)', 'cx.notiz_ph': 'Einstellung, Sitzhöhe, Griffweite …',
    'cx.anlegen': 'Übung anlegen', 'cx.speichern': 'Speichern', 'cx.loeschen': 'Übung löschen',
    'cx.loeschen_q': 'Eigene Übung löschen?', 'cx.loeschen_body': 'Geloggte Sätze bleiben erhalten (Name im Snapshot), die Übung verschwindet aus dem Katalog.',
    'cx.err_name': 'Bitte einen Namen mit mindestens 2 Zeichen eingeben.',
    'cx.err_muskeln': 'Mindestens einen Muskel zuordnen — sonst kann ORVIA die Übung nicht einsortieren.',
    'cx.err_speichern': 'Speichern nicht möglich (offline oder keine Berechtigung).',
    'cx.toast_angelegt': '„{name}" angelegt', 'cx.toast_gespeichert': '„{name}" gespeichert',`);
/* CSS */
{ let c=fs.readFileSync('app/styles.css','utf8'); c=c.replace(/\s*$/,'\n')+`/* S2b-2 · Eigene Uebungen */
.wo-pickitem.wo-newex{min-height:58px;border:1px dashed rgba(201,174,124,.45);border-radius:12px;margin:6px 0 4px;padding:10px 12px;background:rgba(201,174,124,.05)}.wo-pickitem.wo-newex .wo-pi-main{color:var(--gold)}
.wo-pickrow{display:flex;align-items:stretch;gap:6px}.wo-pickrow .wo-pickitem{flex:1;min-width:0}
.wo-pi-edit{flex:0 0 40px;border:1px solid rgba(148,163,184,.25);background:#0f172a;color:#94a3b8;border-radius:10px;font-size:15px;cursor:pointer;margin:6px 0}
.cx-mus-head{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;color:var(--mut,#94a3b8);margin:8px 0 6px}.cx-mus-head small{font-size:10.5px}
.cx-muscles{display:flex;flex-wrap:wrap;gap:6px}.cx-muscles .wo-fchip{padding:7px 11px;font-size:12px}.cx-muscles .wo-fchip.half{border-color:rgba(201,174,124,.5);color:var(--gold-soft)}
.cx-legend{font-size:10.5px;color:var(--mut,#94a3b8);margin:8px 0 10px}
.cx-err{font-size:12px;color:var(--attention);margin:6px 0}
.wo-sheet .wo-inrow select{background:#0f172a;border:1px solid rgba(148,163,184,.25);border-radius:10px;padding:12px;color:#e2e8f0;font-size:15px}
`; fs.writeFileSync('app/styles.css',c); }
console.log('patch5 ok');
