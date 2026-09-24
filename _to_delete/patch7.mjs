import fs from 'fs';
function rep(f,a,b){let s=fs.readFileSync(f,'utf8'); if(!s.includes(a)){console.error('MISSING in '+f+': '+a.slice(0,100)); process.exit(1);} s=s.replace(a,b); fs.writeFileSync(f,s);}
const GV='app/js/gym-volume.js';
/* 1) Sync-Pipeline: zuletzt nachgeladene Server-Workouts wiederverwenden (Kraftwerte, Kraftprofil-Teaser, Muskelzeilen) */
rep(GV, `    var all = local.concat(server).concat(opts.workoutSessions || []).concat(legacy);`,
`    /* v8-383: Server-Workouts, die ein refresh-Lauf bereits nachgeladen hat, stehen auch dem
       synchronen Pfad zur Verfuegung — sonst sahen Kraftwerte/Kraftprofil nur lokale Snapshots. */
    var ws = opts.workoutSessions || _lastTreeSessions || [];
    var all = local.concat(server).concat(ws).concat(legacy);`);
rep(GV, `      rawWorkoutSessionCount: (opts.workoutSessions || []).length, rawLegacySessionCount: legacy.length,`,
`      rawWorkoutSessionCount: (opts.workoutSessions || _lastTreeSessions || []).length, rawLegacySessionCount: legacy.length,`);
/* 2) Katalog sicherstellen + verwaiste Sessions (ohne activities-Zeile) + Baum mit ID/Slug/Muster/Muskeln */
rep(GV, `  var _gymPipeCache = null;                       // { key, at, promise }`,
`  var _lastTreeSessions = null;                   // v8-383: Ergebnis des letzten Baum-Nachladens (alle Fenster)
  var _catalogPromise = null;
  function ensureCatalog() {
    if (Object.keys(_catalogById).length) return Promise.resolve(true);
    if (_catalogPromise) return _catalogPromise;
    if (!(O.repos && O.repos.exercise && O.repos.exercise.list)) return Promise.resolve(false);
    _catalogPromise = O.repos.exercise.list().then(function (r) { if (r && r.success) setCatalog(r.data || []); return !!(r && r.success); }).catch(function () { return false; });
    return _catalogPromise;
  }
  var _gymPipeCache = null;                       // { key, at, promise }`);
rep(GV, `    var workoutSessions = [];
    if (opts.refresh && O.repos && O.repos.workout && O.repos.workout.loadWorkoutTree) {
      var need = server.filter(function (a) { return isGymSport(a) && a.workoutSessionId && !exercisesOf(a); });
      var loadedIds = {}; var detailFails = 0;
      var uniqueIds = [];
      need.forEach(function (a) { var sid = a.workoutSessionId; if (!loadedIds[sid]) { loadedIds[sid] = true; uniqueIds.push(sid); } });`,
`    var workoutSessions = [];
    if (opts.refresh && O.repos && O.repos.workout && O.repos.workout.loadWorkoutTree) {
      try { await ensureCatalog(); } catch (e) {}
      var need = server.filter(function (a) { return isGymSport(a) && a.workoutSessionId && !exercisesOf(a); });
      var loadedIds = {}; var detailFails = 0;
      var uniqueIds = [];
      need.forEach(function (a) { var sid = a.workoutSessionId; if (!loadedIds[sid]) { loadedIds[sid] = true; uniqueIds.push(sid); } });
      /* v8-383: abgeschlossene Sessions OHNE activities-Zeile (aeltere Abschluesse vor 0009 /
         fehlgeschlagener Activity-Push) werden direkt aus workout_sessions geholt — sonst
         fehlen sie in Muskelkarte und Kraftprofil, obwohl Saetze auf dem Server liegen. */
      try {
        if (O.repos.workout.listSessions) {
          var fromIso = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
          var ls = await O.repos.workout.listSessions(fromIso);
          var known = {}; server.forEach(function (a) { if (a.workoutSessionId) known[a.workoutSessionId] = 1; }); local.forEach(function (a) { if (a.workoutSessionId) known[a.workoutSessionId] = 1; });
          ((ls && ls.success && ls.data) || []).forEach(function (s) {
            if (!s || !s.id || s.status !== 'completed' || known[s.id] || loadedIds[s.id]) return;
            if (s.sport && !isGymSport({ sportId: s.sport_key || s.sport, source: 'orvia_workout' })) return;
            loadedIds[s.id] = true; uniqueIds.push(s.id);
          });
          call('workoutRepository.listSessions', true, !!(ls && ls.success), ((ls && ls.data) || []).length, (ls && ls.success) ? null : 'SESSIONS_LIST_FAILED');
        }
      } catch (e) { call('workoutRepository.listSessions', true, false, 0, 'SESSIONS_LIST_FAILED'); }`);
rep(GV, `          var exs = (tr.data.exercises || []).map(function (ex) { return { exerciseNameSnapshot: (ex.exercise && ex.exercise.name) || null, sets: (ex.sets || []) }; });`,
`          /* v8-383: ID, Slug, Bewegungsmuster und Katalog-Muskeln mitgeben — vorher nur der Name,
             wodurch jede Uebung ohne exakten Namenstreffer als „unklassifiziert" verschwand. */
          var exs = (tr.data.exercises || []).map(function (ex) {
            var e0 = ex.exercise || {}; var we = ex.workoutExercise || {};
            var cat = catalogEntry({ exerciseId: we.exercise_id || e0.id, slug: e0.slug });
            return { exerciseId: we.exercise_id || e0.id || null, slug: e0.slug || null, baseSlug: e0.base_slug || (cat && cat.baseSlug) || null,
              exerciseNameSnapshot: e0.name || null, movementPattern: e0.movement_pattern || (cat && cat.movementPattern) || null,
              muscles: (cat && cat.muscles && Object.keys(cat.muscles).length) ? cat.muscles : null, sets: (ex.sets || []) };
          });`);
rep(GV, `      call('workoutRepository.loadWorkoutTree', need.length > 0, detailFails === 0, workoutSessions.length, detailFails ? 'WORKOUT_DETAILS_FAILED' : null);
    }`,
`      call('workoutRepository.loadWorkoutTree', uniqueIds.length > 0, detailFails === 0, workoutSessions.length, detailFails ? 'WORKOUT_DETAILS_FAILED' : null);
      /* Ergebnis fuer den synchronen Pfad merken (ueber Fenster hinweg zusammenfuehren). */
      var merged = {}; (_lastTreeSessions || []).forEach(function (w) { if (w && w.workoutSessionId) merged[w.workoutSessionId] = w; });
      workoutSessions.forEach(function (w) { if (w && w.workoutSessionId) merged[w.workoutSessionId] = w; });
      _lastTreeSessions = Object.keys(merged).map(function (k) { return merged[k]; });
    }`);
rep(GV, `    setCatalog: setCatalog, catalogEntry: catalogEntry, fromCatalogMuscles: fromCatalogMuscles, MUSCLE_FOLD: MUSCLE_FOLD`,
`    setCatalog: setCatalog, catalogEntry: catalogEntry, fromCatalogMuscles: fromCatalogMuscles, MUSCLE_FOLD: MUSCLE_FOLD,
    ensureCatalog: ensureCatalog, lastTreeSessions: function () { return _lastTreeSessions || []; }`);
/* 3) Kraftprofil: asynchron mit Server-Nachladen; Teaser ohne Dopplung; Muskelkarte ohne „——" */
const SP='app/js/screens/strength-profile.js';
rep(SP, `  function open(opts) {
    var o = opts || {};
    _ctx = collect(); _model = buildModel(_ctx);`,
`  /* v8-383: Server-Workouts nachladen (gymPipelineAsync refresh) — vorher nur lokale Snapshots,
     wodurch auf einem zweiten Geraet fast alle Einheiten fehlten. Sheet zeigt bis dahin den
     lokalen Stand mit Ladehinweis und rendert danach neu. */
  var _loading = false, _loadedAt = 0;
  function refreshAsync(after) {
    var gv = O.gymVolume; if (!gv || !gv.gymPipelineAsync || _loading) return false;
    _loading = true;
    gv.gymPipelineAsync({ days: 365, refresh: true }).then(function () { _loading = false; _loadedAt = Date.now(); _ctx = collect(); _model = buildModel(_ctx); if (typeof after === 'function') after(); })
      .catch(function () { _loading = false; if (typeof after === 'function') after(); });
    return true;
  }
  function open(opts) {
    var o = opts || {};
    _ctx = collect(); _model = buildModel(_ctx);
    var fresh = (Date.now() - _loadedAt) < 60000;
    if (!fresh) refreshAsync(function () { render(); });`);
rep(SP, `    host.innerHTML = body(_model);
  }`,
`    host.innerHTML = (_loading ? '<div class="kp-loading">' + esc(T('kp.laedt_server')) + '</div>' : '') + body(_model);
  }`);
rep(SP, `  function teaser() {
    try {
      var ctx = collect(); var m = buildModel(ctx); if (!m || !m.exercises.length) return { empty: true, sessions: 0 };`,
`  function teaser() {
    try {
      var fresh = (Date.now() - _loadedAt) < 60000;
      if (!fresh && !_loading) refreshAsync(function () { try { if (typeof root.renderGMAnalysis === 'function' && document.getElementById('gmAna')) root.renderGMAnalysis(); } catch (e) {} });
      var ctx = collect(); var m = buildModel(ctx); if (!m || !m.exercises.length) return { empty: true, sessions: 0, loading: _loading };`);
rep(SP, `      return { empty: false, sessions: m.sessions,`, `      return { empty: false, loading: _loading, sessions: m.sessions,`);
rep(SP, `    var rows = mr.rows.filter(function (r) { return r.group === st.grp; });
    if (!rows.length) return '';`,
`    var rows = mr.rows.filter(function (r) { return r.group === st.grp; });
    if (!rows.length) return '';
    if (mr.corridor && mr.corridor.min == null) return '<div class="card tight" data-gm-slot="strength-muscles"><div class="ctitle"><div class="l">' + ic('gauge') + ' ' + esc(T('kp.saetze_je_muskel', { g: grpLabel(st.grp) })) + '</div><span class="more">' + esc(T('kp.7_tage')) + '</span></div><div class="kp-note">' + ic('info', 'sm') + '<div>' + esc(T('kp.korridor_fehlt')) + '</div></div>' + src(T('kp.src_korridor_leer')) + '</div>';`);
/* Teaser in ui.js: keine Dopplung */
rep('app/js/ui.js', `    if(!parts.length)parts.push(_uiT('kp.teaser_sessions',{n:t.sessions,r:t.ready,t:t.total}));
    sub=parts.join(' · ');`,
`    if(!parts.length)parts.push(t.loading?_uiT('kp.laedt_server'):_uiT('kp.teaser_d'));
    sub=parts.join(' · ');`);
/* Locale + CSS */
rep('app/locales/de.js', "    'kp.titel': 'Kraftprofil',", `    'kp.titel': 'Kraftprofil',
    'kp.laedt_server': 'Einheiten vom Server werden nachgeladen …',
    'kp.src_korridor_leer': 'Korridor erscheint, sobald mindestens zwei Wochen Krafttraining vorliegen — Richtwert aus gym-volume, kein Gesetz',`);
{ let c=fs.readFileSync('app/styles.css','utf8'); c=c.replace(/\s*$/,'\n')+'.kp-loading{font-size:11.5px;color:var(--muted);padding:6px 0 10px;display:flex;align-items:center;gap:8px}.kp-loading::before{content:"";width:12px;height:12px;border-radius:50%;border:2px solid rgba(201,174,124,.35);border-top-color:var(--gold);animation:kpspin .8s linear infinite;flex-shrink:0}@keyframes kpspin{to{transform:rotate(360deg)}}\n'; fs.writeFileSync('app/styles.css',c); }
console.log('patch7 ok');
