/* ============================================================
   ORVIA · workout-ui — Live-Workout-Oberfläche (Phase 4.2b)
   Mobil-first. Nutzt AUSSCHLIESSLICH window.ORVIA.workoutStore (keine Supabase-Logik hier).
   Einstieg auf „Heute" (#workoutEntry) + Vollbild-Overlay (#workoutOverlay) für die aktive Einheit.
   Readiness-Zeile ist nur Kontext; der gespeicherte Morgen-Score wird NIE verändert.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  const SET_TYPE_DE = { warmup: 'Aufwärmsatz', working: 'Arbeitssatz', top_set: 'Top-Satz', backoff: 'Back-off', dropset: 'Drop-Satz', rest_pause: 'Rest-Pause', myo_reps: 'Myo-Reps', amrap: 'AMRAP', technique: 'Technik', test: 'Test' };
  let _tick = null, _busy = false;

  function WS() { return O.workoutStore; }
  function st() { return WS() ? WS().state() : { session: null, exercises: [] }; }
  function esc(s) { return (typeof window.esc === 'function') ? window.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function toastIt(m) { if (typeof toast === 'function') toast(m); }
  function isPro() { try { return (typeof PROFILE !== 'undefined' && PROFILE && PROFILE.level && PROFILE.level !== 'anfaenger'); } catch (e) { return true; } }
  function fmtSet(s) { const w = s.weight != null ? s.weight + ' kg' : '–'; const r = s.reps != null ? ' × ' + s.reps : ''; const rir = s.rir != null ? ' @ RIR ' + s.rir : (s.rpe != null ? ' @ RPE ' + s.rpe : ''); return w + r + rir; }

  // ---- Einstieg auf „Heute" ----
  O.workoutUI = {};
  O.workoutUI.renderEntry = async function () {
    const host = document.getElementById('workoutEntry'); if (!host) return;
    const active = st().session && st().session.status === 'active';
    host.innerHTML =
      '<div class="card"><h2><svg class="ic"><use href="#i-dumbbell"/></svg>Live-Workout</h2>' +
      (active
        ? '<p class="muted" style="margin:-4px 0 12px">Eine Einheit läuft. Fortsetzen statt neu starten.</p><button class="btn cta" onclick="ORVIA.workoutUI.open()"><span class="cta-txt"><span class="cta-main">Aktives Workout fortsetzen</span><span class="cta-sub">' + esc(st().session.sport || 'Training') + '</span></span></button>'
        : '<p class="muted" style="margin:-4px 0 12px">Starte eine freie Einheit und tracke jeden Satz.</p><button class="btn" onclick="ORVIA.workoutUI.startFree()">Freies Workout starten</button>') +
      '<div id="workoutHistory" style="margin-top:14px"></div></div>';
    renderHistory();
  };

  async function renderHistory() {
    const h = document.getElementById('workoutHistory'); if (!h || !O.repos || !O.repos.workout) return;
    const r = await O.repos.workout.listSessions();
    if (!r.success) { h.innerHTML = '<p class="muted">Verlauf offline nicht verfügbar.</p>'; return; }
    const rows = (r.data || []).filter(s => s.status !== 'legacy').slice(0, 8);
    if (!rows.length) { h.innerHTML = '<p class="muted">Noch keine Workouts.</p>'; return; }
    h.innerHTML = '<div class="wo-hist-title">Verlauf</div>' + rows.map(s =>
      '<div class="wo-hist"><span>' + esc(s.local_date) + ' · ' + esc(s.sport || 'Training') + '</span>' +
      '<span class="wo-badge wo-' + esc(s.status) + '">' + esc({ completed: 'fertig', active: 'aktiv', aborted: 'abgebrochen', cancelled: 'abgebrochen', skipped: 'übersprungen', planned: 'geplant' }[s.status] || s.status) + '</span>' +
      (s.duration_min != null ? '<span class="muted">' + s.duration_min + ' min</span>' : '') + '</div>').join('');
  }

  O.workoutUI.startFree = async function () {
    if (_busy) return; _busy = true;
    const r = await WS().startFreeWorkout({ sport: 'Gym' }); _busy = false;
    if (!r.success) { if (r.error && r.error.code === 'active_exists') { toastIt('Es läuft bereits ein Workout.'); O.workoutUI.open(); } else toastIt('Workout konnte nicht gestartet werden: ' + (r.error && r.error.message || '')); return; }
    if (r.sync_status === 'pending') toastIt('Offline gestartet – wird synchronisiert ⏳');
    O.workoutUI.open();
  };

  O.workoutUI.open = function () { const ov = document.getElementById('workoutOverlay'); if (!ov) return; ov.classList.remove('hide'); renderOverlay(); startElapsed(); };
  O.workoutUI.close = function () { const ov = document.getElementById('workoutOverlay'); if (ov) ov.classList.add('hide'); stopElapsed(); if (typeof renderDay === 'function') renderDay(); };

  // ---- Restore beim Laden / nach Login ----
  O.workoutUI.tryRestore = async function () {
    if (!WS()) return;
    try {
      const r = await WS().restoreActiveWorkout();
      if (r.success && st().session && st().session.status === 'active') {
        O.workoutUI.open();
        toastIt(r.source === 'indexeddb' ? 'Workout wiederhergestellt (offline) ⏳' : 'Aktives Workout wiederhergestellt');
      }
    } catch (e) {}
    O.workoutUI.renderEntry();
  };

  // ---- Overlay ----
  function startElapsed() { stopElapsed(); _tick = setInterval(function () { const el = document.getElementById('woElapsed'); const t = document.getElementById('woTimer'); if (el) el.textContent = elapsedStr(); tickTimer(t); }, 1000); }
  function stopElapsed() { if (_tick) { clearInterval(_tick); _tick = null; } }
  // Verstrichene Workout-Zeit ABZÜGLICH Pausen (echte aktive Dauer).
  function elapsedStr() {
    const s = st().session; if (!s || !s.started_at) return '0:00';
    let pausedMs = (s.total_paused_seconds || 0) * 1000;
    if (s.paused_at) pausedMs += Math.max(0, Date.now() - new Date(s.paused_at).getTime());
    const sec = Math.max(0, Math.floor((Date.now() - new Date(s.started_at).getTime() - pausedMs) / 1000));
    const m = Math.floor(sec / 60); return m + ':' + String(sec % 60).padStart(2, '0');
  }
  // Timer aus absolutem endAt im Store (reload-fest, +15s bleibt erhalten); Ablauf feuert genau einmal.
  function tickTimer(el) {
    const tm = st().timer; if (!el || !tm || !tm.running) return;
    const rem = WS().restRemaining(); el.textContent = rem + 's';
    if (rem <= 0) { tm.running = false; tm.endAt = null; try { if (navigator.vibrate) navigator.vibrate(200); } catch (e) {} renderOverlay(); }
  }

  function renderOverlay() {
    const ov = document.getElementById('workoutOverlay'); if (!ov || ov.classList.contains('hide')) return;
    const S = st(); const session = S.session;
    if (!session) { ov.classList.add('hide'); return; }
    const exs = S.exercises || []; const idx = Math.min(S.currentIndex || 0, Math.max(0, exs.length - 1));
    const cur = exs[idx] || null;
    const prog = WS().progress();
    const dec = (function () { try { return (typeof getDecision === 'function') ? getDecision() : null; } catch (e) { return null; } })();

    let html = '<div class="wo-wrap">';
    // Header
    html += '<div class="wo-head"><div><div class="wo-name">' + esc(session.sport || 'Workout') + '</div><div class="wo-sub"><span id="woElapsed">' + elapsedStr() + '</span> · ' + (prog.kind === 'sets' ? (prog.completed + '/' + prog.planned + ' Sätze') : ((prog.completed || 0) + '/' + (prog.total || 0) + ' Übungen')) + ' · ' + (prog.pct || 0) + '%</div></div>' +
      '<div class="wo-headbtns"><button class="wo-icbtn" onclick="ORVIA.workoutUI.finish()">Beenden</button><button class="wo-icbtn sec" onclick="ORVIA.workoutUI.menu()">⋯</button></div></div>';
    // Readiness-Kontext (nur Anzeige)
    if (dec) html += '<div class="wo-ready">Tagesform <b>' + (dec.score != null ? dec.score : '–') + '</b> · ' + esc(dec.statusText || '') + ' <span class="muted">(Kontext — ändert den Morgen-Score nicht)</span></div>';
    // Pausenzustand (echte Pause: Dauer steht still)
    if (WS().isPaused()) html += '<div class="wo-paused">⏸ Workout pausiert — die Dauer läuft nicht weiter. <button class="wo-link" onclick="ORVIA.workoutUI.resume()">Fortsetzen</button></div>';
    // Übungsnavigation
    if (exs.length) html += '<div class="wo-exnav">' + exs.map((e, i) => '<button class="wo-exchip ' + (i === idx ? 'on' : '') + '" onclick="ORVIA.workoutUI.goEx(' + i + ')">' + (i + 1) + '</button>').join('') + '</div>';

    if (!cur) {
      html += '<div class="wo-empty"><p>Noch keine Übung.</p><button class="btn" onclick="ORVIA.workoutUI.pickExercise()">Übung hinzufügen</button></div>';
    } else {
      const exName = (cur.exercise && cur.exercise.name) || 'Übung';
      const we = cur.workoutExercise;
      html += '<div class="wo-cur"><div class="wo-cur-top"><div class="wo-exname">' + esc(exName) + '</div>' +
        '<div class="wo-exact"><button class="wo-link" onclick="ORVIA.workoutUI.replaceExercise(' + idx + ')">Ersetzen</button><button class="wo-link danger" onclick="ORVIA.workoutUI.removeExercise(' + idx + ')">Entfernen</button></div></div>' +
        '<div class="wo-last" id="woLast">Letzte Leistung wird geladen…</div>' +
        (we.planned_sets ? '<div class="muted">Ziel: ' + we.planned_sets + ' Sätze' + (we.min_reps ? ' · ' + we.min_reps + '–' + (we.max_reps || we.min_reps) + ' Wdh' : '') + (we.target_rir != null ? ' · RIR ' + we.target_rir : '') + '</div>' : '');
      // Satzliste
      html += '<div class="wo-sets">' + (cur.sets || []).map((s, si) =>
        '<div class="wo-set ' + (s.completed ? 'done' : '') + '"><span class="wo-setn">' + (s.set_number || si + 1) + '</span>' +
        '<span class="wo-settype">' + esc(SET_TYPE_DE[s.set_type] || 'Satz') + '</span>' +
        '<span class="wo-setval">' + esc(fmtSet(s)) + '</span>' +
        '<button class="wo-mini" onclick="ORVIA.workoutUI.editSet(' + idx + ',' + si + ')">✎</button>' +
        '<button class="wo-mini danger" onclick="ORVIA.workoutUI.delSet(' + idx + ',' + si + ')">🗑</button></div>').join('') + '</div>';
      // Eingabe
      html += setInputHTML(cur);
      // Timer (Resttimer zwischen Sätzen)
      const tm = S.timer || {};
      html += '<div class="wo-timer"><span>Satzpause</span> <b id="woTimer">' + (tm.running ? WS().restRemaining() + 's' : '–') + '</b>' +
        '<button class="wo-mini" onclick="ORVIA.workoutUI.timerAdd()">+15s</button><button class="wo-mini" onclick="ORVIA.workoutUI.timerSkip()">Überspringen</button></div>';
    }
    // Footer (sticky)
    html += '<div class="wo-foot"><button class="wo-fbtn" onclick="ORVIA.workoutUI.pickExercise()">+ Übung</button>' +
      '<button class="wo-fbtn" onclick="ORVIA.workoutUI.goEx(' + (idx + 1) + ')">Nächste ›</button>' +
      '<button class="wo-fbtn primary" onclick="ORVIA.workoutUI.finish()">Abschließen</button></div>';
    html += '</div>';
    ov.innerHTML = html;
    if (cur) loadLast(cur);
  }

  function setInputHTML(cur) {
    const pro = isPro();
    return '<div class="wo-input"><div class="wo-inrow">' +
      '<label>kg<input type="number" inputmode="decimal" id="wiW" placeholder="' + (cur.sets && cur.sets.length ? (cur.sets[cur.sets.length - 1].weight ?? '') : '') + '"></label>' +
      '<label>Wdh<input type="number" inputmode="numeric" id="wiR" placeholder="' + (cur.workoutExercise.min_reps || '') + '"></label>' +
      (pro ? '<label>RIR<input type="number" inputmode="numeric" id="wiRir" placeholder="2"></label>' : '') + '</div>' +
      (pro ? '<div class="wo-inrow"><label>Typ<select id="wiType">' + Object.keys(SET_TYPE_DE).map(k => '<option value="' + k + '"' + (k === 'working' ? ' selected' : '') + '>' + SET_TYPE_DE[k] + '</option>').join('') + '</select></label></div>' : '') +
      '<button class="btn cta wo-savebtn" onclick="ORVIA.workoutUI.saveSet()"><span class="cta-txt"><span class="cta-main">Satz speichern</span></span></button></div>';
  }

  async function loadLast(cur) {
    const el = document.getElementById('woLast'); if (!el) return;
    const exId = cur.workoutExercise.exercise_id; if (!exId) { el.textContent = ''; return; }
    const r = await WS().getPreviousPerformance(exId);
    if (!r || !r.success || !r.data) { el.innerHTML = '<span class="muted">Keine frühere Leistung.</span>'; return; }
    el.innerHTML = '<div class="muted">Letztes Training (' + esc(r.data.date) + '):</div>' + (r.data.sets || []).map(s => esc(fmtSet(s))).join('<br>');
  }

  // ---- Aktionen ----
  function num(id) { const e = document.getElementById(id); if (!e || e.value === '') return null; const n = +e.value; return isNaN(n) ? null : n; }
  O.workoutUI.saveSet = async function () {
    if (_busy) return; _busy = true;
    const S = st(); const idx = S.currentIndex || 0;
    const set = { setType: (document.getElementById('wiType') && document.getElementById('wiType').value) || 'working', weight: num('wiW'), reps: num('wiR'), rir: num('wiRir'), completed: true };
    const r = await WS().addSet(idx, set); _busy = false;
    if (!r.success) { toastIt('Satz nicht gespeichert: ' + (r.error && r.error.message || '')); return; }
    if (r.sync_status === 'pending') toastIt('Offline gespeichert ⏳');
    // Pausentimer aus Plan-/letzter Pausenzeit
    const we = (st().exercises[idx] || {}).workoutExercise || {}; const rest = we.rest_seconds || 90;
    WS().startRestTimer(rest);
    renderOverlay();
  };
  O.workoutUI.editSet = async function (ei, si) {
    const s = (st().exercises[ei] || {}).sets[si]; if (!s) return;
    const w = prompt('Gewicht (kg)', s.weight != null ? s.weight : ''); if (w === null) return;
    const reps = prompt('Wiederholungen', s.reps != null ? s.reps : ''); if (reps === null) return;
    const patch = { weight: w === '' ? null : +w, reps: reps === '' ? null : +reps };
    const r = await WS().updateSet(ei, si, patch);
    if (!r.success) toastIt('Änderung fehlgeschlagen: ' + (r.error && r.error.message || '')); else renderOverlay();
  };
  O.workoutUI.delSet = async function (ei, si) {
    const s = (st().exercises[ei] || {}).sets[si]; if (!s) return;
    if (s.completed && !confirm('Abgeschlossenen Satz löschen?')) return;
    const r = await WS().deleteSet(ei, si);
    if (!r.success) { toastIt('Löschen fehlgeschlagen: ' + (r.error && r.error.message || '')); return; }
    if (r.sync_status === 'pending') toastIt('Löschen wartet auf Sync ⏳');
    renderOverlay();
  };
  O.workoutUI.goEx = function (i) { const exs = st().exercises; if (i >= exs.length) { O.workoutUI.pickExercise(); return; } WS().setCurrentExercise(Math.max(0, i)); renderOverlay(); };
  O.workoutUI.timerAdd = function () { WS().addRestTime(15); renderOverlay(); };
  O.workoutUI.timerSkip = function () { WS().skipRest(); renderOverlay(); };

  O.workoutUI.removeExercise = async function (idx) {
    const e = st().exercises[idx]; if (!e) return;
    if ((e.sets || []).length && !confirm('Übung samt Sätzen entfernen?')) return;
    const r = await WS().removeExercise(idx); if (!r.success) toastIt('Entfernen fehlgeschlagen'); else renderOverlay();
  };
  O.workoutUI.replaceExercise = function (idx) { O.workoutUI.pickExercise(function (exId) { WS().replaceExercise(idx, exId, true).then(() => renderOverlay()); }); };

  O.workoutUI.finish = async function () {
    const exs = st().exercises; const totalSets = exs.reduce((s, e) => s + (e.sets || []).filter(x => x.completed).length, 0);
    const rpeStr = prompt('Session-RPE (1–10, leer = ohne):', '');
    const sessionRpe = (rpeStr && !isNaN(+rpeStr)) ? Math.max(1, Math.min(10, +rpeStr)) : null;
    const r = await WS().finishWorkout({ sessionRpe: sessionRpe });
    if (!r.success) { toastIt('Abschluss fehlgeschlagen: ' + (r.error && r.error.message || '')); return; }
    const ls = r.data.loadStatus;
    const lsMsg = ls === 'incomplete_no_rpe' ? ', Last ohne RPE unvollständig'
      : ls === 'load_error' ? ', aber Last konnte NICHT geschrieben werden'
      : ls === 'written_pending' ? ', Last wird synchronisiert ⏳' : '';
    toastIt('Workout abgeschlossen ✓ (' + totalSets + ' Sätze' + lsMsg + ')');
    O.workoutUI.close();
  };
  O.workoutUI.resume = function () { WS().resumeWorkout(); renderOverlay(); };
  O.workoutUI.menu = function () {
    const paused = WS().isPaused();
    const c = prompt((paused ? '1 = fortsetzen' : '1 = pausieren') + ' · 2 = abbrechen · 3 = löschen · (Abbrechen = weiter)', '');
    if (c === '1') {
      if (paused) { WS().resumeWorkout(); toastIt('Fortgesetzt'); renderOverlay(); }
      else { WS().pauseWorkout(); toastIt('Pausiert – Dauer steht still'); renderOverlay(); }
    }
    else if (c === '2') { WS().cancelWorkout('aborted').then(() => { O.workoutUI.close(); toastIt('Workout abgebrochen'); }); }
    else if (c === '3') { if (confirm('Workout vollständig löschen?')) WS().cancelWorkout('delete').then(() => { O.workoutUI.close(); toastIt('Gelöscht'); }); }
  };

  // ---- Übungsauswahl (funktionaler Dialog) ----
  O.workoutUI.pickExercise = async function (cb) {
    const ov = document.getElementById('workoutPicker'); if (!ov) return;
    ov.classList.remove('hide');
    ov.innerHTML = '<div class="wo-pick"><div class="wo-pick-head"><input id="woSearch" placeholder="Übung suchen…" oninput="ORVIA.workoutUI._filter()"><button class="wo-icbtn sec" onclick="ORVIA.workoutUI.closePicker()">✕</button></div><div id="woPickList" class="wo-pick-list"></div></div>';
    O.workoutUI._cb = cb || null;
    const r = O.repos && O.repos.exercise ? await O.repos.exercise.list() : { success: false };
    O.workoutUI._all = (r.success ? r.data : []) || [];
    O.workoutUI._filter();
  };
  O.workoutUI._filter = function () {
    const q = (document.getElementById('woSearch') && document.getElementById('woSearch').value || '').toLowerCase();
    const list = (O.workoutUI._all || []).filter(e => !q || (e.name || '').toLowerCase().indexOf(q) >= 0).slice(0, 40);
    const el = document.getElementById('woPickList'); if (!el) return;
    el.innerHTML = list.length ? list.map(e => '<button class="wo-pickitem" onclick="ORVIA.workoutUI.choose(\'' + e.id + '\')">' + esc(e.name) + '<span class="muted">' + esc(e.movementPattern || e.movement_pattern || '') + (e.isSystem === false ? ' · eigen' : '') + '</span></button>').join('') : '<p class="muted">Keine Übung gefunden.</p>';
  };
  O.workoutUI.choose = async function (exId) {
    const ex = (O.workoutUI._all || []).find(e => e.id === exId) || null;
    O.workoutUI.closePicker();
    if (O.workoutUI._cb) { const cb = O.workoutUI._cb; O.workoutUI._cb = null; cb(exId); return; }
    const r = await WS().addExercise(exId, { plannedSets: 3, exercise: ex, restSeconds: 90 });
    if (!r.success) toastIt('Übung nicht hinzugefügt: ' + (r.error && r.error.message || '')); else renderOverlay();
  };
  O.workoutUI.closePicker = function () { const ov = document.getElementById('workoutPicker'); if (ov) ov.classList.add('hide'); };
})();
