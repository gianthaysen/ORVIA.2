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
  // Technische Fehler NIE roh anzeigen — auf verständliche deutsche Meldungen mappen (Konsole behält Detail).
  function humanErr(error) {
    if (!error) return 'Aktion konnte nicht abgeschlossen werden. Bitte erneut versuchen.';
    try { console.error('[ORVIA workout]', error); } catch (e) {}
    const s = (String(error.code || '') + ' ' + String(error.message || '')).toLowerCase();
    if (error.code === 'active_exists' || /23505|one_active/.test(s)) return 'Es läuft bereits ein Workout. Es wurde geöffnet.';
    if (/42501|row-level security|permission denied|rls/.test(s)) return 'Zugriff nicht möglich. Bitte melde dich erneut an.';
    if (/network|fetch|timeout|offline|verbindung/.test(s)) return 'Verbindung unterbrochen. Änderungen werden lokal gespeichert.';
    if (/foreign key|23503|fk/.test(s)) return 'Die Einheit konnte nicht vollständig geladen werden.';
    if (/validation/.test(s)) return error.message || 'Eingabe prüfen.';
    return 'Aktion konnte nicht abgeschlossen werden. Bitte erneut versuchen.';
  }
  function isPro() { try { return (typeof PROFILE !== 'undefined' && PROFILE && PROFILE.level && PROFILE.level !== 'anfaenger'); } catch (e) { return true; } }
  function fmtSet(s) { const w = s.weight != null ? s.weight + ' kg' : '–'; const r = s.reps != null ? ' × ' + s.reps : ''; const rir = s.rir != null ? ' @ RIR ' + s.rir : (s.rpe != null ? ' @ RPE ' + s.rpe : ''); return w + r + rir; }

  // ---- Kompakte Vorschau auf „Heute" (KEINE separate Live-Workout-Karte mehr) ----
  O.workoutUI = {};
  function openTrainingTab() { try { const b = document.querySelector('.tabbar button[data-tab="training"]'); if (b) b.click(); } catch (e) {} }
  O.workoutUI.openTrainingTab = openTrainingTab;
  // Entscheidet je nach Zustand: aktiv → Overlay direkt; sonst Training-Tab (Schnellstart/geplant).
  O.workoutUI.openFromToday = async function () {
    const res = await O.workoutUI.ensureActiveWorkoutLoaded();
    if (res.active) { O.workoutUI.open(); return; }
    openTrainingTab();
  };
  function overlayFlagKey() { return 'orvia_wo_overlay_' + ((O.user && O.user.id) || 'x'); }

  // Eine schlanke Statuszeile INNERHALB der bestehenden „Training heute"-Karte (keine eigene Karte).
  function statusRow(main, sub, kind) {
    return '<div class="wo-status' + (kind ? ' ' + kind : '') + '" role="button" tabindex="0" aria-label="Training öffnen" onclick="ORVIA.workoutUI.openFromToday()">' +
      '<span class="pic"><svg class="ic"><use href="#i-dumbbell"/></svg></span>' +
      '<span class="wo-prev-txt"><span class="wo-prev-main">' + main + '</span><span class="wo-prev-sub">' + sub + '</span></span>' +
      '<span class="pchev">›</span></div>';
  }
  O.workoutUI.renderEntry = function () {
    const host = document.getElementById('workoutStatusLine'); if (!host) return;
    const s = st().session; const active = s && s.status === 'active';
    if (active) { host.innerHTML = statusRow('Workout läuft · ' + esc(s.sport || 'Training'), (st().exercises || []).length + ' Übungen — fortsetzen', 'live'); return; }
    host.innerHTML = statusRow('Workout starten', 'Im Training-Tab starten & Sätze tracken', '');
    refreshTodayStatus(host);   // geplant/abgeschlossen asynchron nachladen
  };
  async function refreshTodayStatus(host) {
    if (!O.repos || !O.repos.workout || !O.repos.workout.listSessions) return;
    try {
      const today = (typeof todayStr === 'function') ? todayStr() : null;
      const r = await O.repos.workout.listSessions(today, today);
      if (!r.success || !host || !host.isConnected) return;
      const rows = (r.data || []).filter(x => x.status !== 'legacy');
      const act = rows.find(x => x.status === 'active');
      if (act) { host.innerHTML = statusRow('Workout läuft · ' + esc(act.sport || 'Training'), 'Fortsetzen', 'live'); return; }
      const done = rows.find(x => x.status === 'completed');
      if (done) { host.innerHTML = statusRow('Heute abgeschlossen · ' + esc(done.sport || 'Training'), (done.duration_min != null ? done.duration_min + ' min' : 'fertig'), 'done'); return; }
      const planned = rows.find(x => x.status === 'planned');
      if (planned) host.innerHTML = statusRow('Geplant · ' + esc(planned.sport || 'Training'), 'Im Training-Tab starten', '');
    } catch (e) {}
  }

  // ---- Zentraler Trainings-Hub (Tab „Training") ----
  // Single-Flight-Hydrierung: lokaler Store ⇄ Supabase werden zusammengeführt, KEINE parallelen Restores.
  let _hydratePromise = null;
  async function ensureActiveWorkoutLoaded() {
    const s = st().session;
    if (s && s.status === 'active') return { active: true, session: s };
    if (_hydratePromise) return _hydratePromise;
    _hydratePromise = (async () => {
      try { if (WS()) await WS().restoreActiveWorkout(); } catch (e) {}
      const cur = st().session;
      return { active: !!(cur && cur.status === 'active'), session: cur || null };
    })();
    try { return await _hydratePromise; } finally { _hydratePromise = null; }
  }
  O.workoutUI.ensureActiveWorkoutLoaded = ensureActiveWorkoutLoaded;

  function hubMinutes(s) {
    if (!s || !s.started_at) return 0;
    let pausedMs = (s.total_paused_seconds || 0) * 1000;
    if (s.paused_at) pausedMs += Math.max(0, Date.now() - new Date(s.paused_at).getTime());
    return Math.max(0, Math.floor((Date.now() - new Date(s.started_at).getTime() - pausedMs) / 60000));
  }
  const HUB_NAV =
    '<div class="hub-row" onclick="ORVIA.workoutUI.browseExercises()"><span class="pic"><svg class="ic"><use href="#i-list"/></svg></span><span class="hub-row-txt"><b>Übungen</b><small>Übungsbibliothek & eigene Übungen</small></span><span class="pchev">›</span></div>' +
    '<div class="hub-row" onclick="ORVIA.workoutUI._openActivity()"><span class="pic"><svg class="ic"><use href="#i-pulse"/></svg></span><span class="hub-row-txt"><b>Aktivität erfassen</b><small>Einheit manuell loggen</small></span><span class="pchev">›</span></div>';
  function hubTail() { return '<div class="hub-nav">' + HUB_NAV + '</div><div class="card"><h2><svg class="ic"><use href="#i-clock"/></svg>Verlauf</h2><div id="workoutHistory"></div></div>'; }

  function _renderHubActive(host) {
    const s = st().session; const exs = st().exercises || []; const prog = WS().progress();
    const mins = hubMinutes(s);
    const sub = mins + ' Minuten · ' + (prog.kind === 'sets' ? (prog.completed + '/' + prog.planned + ' Sätze') : (exs.length + ' Übungen'));
    // Verwaiste Session (>12h, kein offenes Overlay): klar als „altes Workout" kennzeichnen.
    const startedMs = s.started_at ? new Date(s.started_at).getTime() : Date.now();
    const orphan = (Date.now() - startedMs) > 12 * 3600 * 1000;
    const tag = orphan ? 'Altes aktives Workout gefunden' : 'Workout läuft';
    let main = '<div class="hub-hero live"><div class="hub-hero-tag">' + tag + '</div><div class="hub-hero-title">' + esc(s.sport || 'Training') + '</div>' +
      '<div class="hub-hero-sub">' + (orphan ? 'Gestartet vor ' + mins + ' Minuten' : sub) + '</div>' +
      '<button class="btn cta" onclick="ORVIA.workoutUI.open()"><span class="cta-txt"><span class="cta-main">Fortsetzen</span></span></button>' +
      '<button class="hub-discard" onclick="ORVIA.workoutUI.discardActive()">' + (orphan ? 'Als abgebrochen markieren' : 'Workout verwerfen') + '</button>' +
      (orphan ? '<button class="hub-discard" onclick="ORVIA.workoutUI._optDelete()">Endgültig löschen</button>' : '') +
      '</div>';
    host.innerHTML = main + hubTail(); renderHistory();
  }
  function _renderHubIdle(host) {
    const main = '<div class="hub-hero"><div class="hub-hero-tag">Training starten</div><div class="hub-hero-sub">Freie Einheit oder Schnellstart wählen</div>' +
      '<div class="hub-quick">' +
      '<button class="hub-q q2" onclick="ORVIA.workoutUI.startSport(\'Gym\')"><svg class="ic"><use href="#i-dumbbell"/></svg><span>Gym</span></button>' +
      '<button class="hub-q q2" onclick="ORVIA.workoutUI.startSport(\'Laufen\')"><svg class="ic"><use href="#i-run"/></svg><span>Laufen</span></button>' +
      '<button class="hub-q q2" onclick="ORVIA.workoutUI.startSport(\'Rad\')"><svg class="ic"><use href="#i-bike"/></svg><span>Rad</span></button>' +
      '<button class="hub-q q3" onclick="ORVIA.workoutUI.startSport(\'Schwimmen\')"><svg class="ic"><use href="#i-swim"/></svg><span>Schwimmen</span></button>' +
      '<button class="hub-q q3" onclick="ORVIA.workoutUI.startSport(\'Mobilität\')"><svg class="ic"><use href="#i-stretch"/></svg><span>Mobility</span></button>' +
      '</div></div>';
    host.innerHTML = main + hubTail(); renderHistory();
  }
  O.workoutUI.renderHub = function () {
    const host = document.getElementById('trainingHub'); if (!host) return;
    // Wenn Store schon aktiv: sofort. Sonst Ladezustand zeigen und hydrieren (kein falsches „Training starten").
    if (st().session && st().session.status === 'active') { _renderHubActive(host); return; }
    host.innerHTML = '<div class="hub-hero"><div class="hub-hero-tag">Training</div><div class="hub-hero-sub">Workout wird geladen …</div><div class="hub-skel"></div></div>';
    ensureActiveWorkoutLoaded().then(res => {
      const h = document.getElementById('trainingHub'); if (!h) return;
      if (res.active) _renderHubActive(h); else _renderHubIdle(h);
    });
  };
  O.workoutUI._openActivity = function () { try { showTab('akt'); } catch (e) {} };

  async function renderHistory() {
    const h = document.getElementById('workoutHistory'); if (!h || !O.repos || !O.repos.workout) return;
    const r = await O.repos.workout.listSessions();
    if (!r.success) { h.innerHTML = '<p class="muted">Verlauf offline nicht verfügbar.</p>'; return; }
    const rows = (r.data || []).filter(s => s.status !== 'legacy').slice(0, 10);
    if (!rows.length) { h.innerHTML = '<p class="muted">Noch keine Workouts.</p>'; return; }
    h.innerHTML = rows.map(s => {
      const date = esc(s.local_date) + ' · ' + esc(s.sport || 'Training');
      // Aktive Session: antippbar → bestehendes Workout fortsetzen (kein neuer Insert).
      if (s.status === 'active') {
        return '<div class="wo-hist wo-hist-active" role="button" tabindex="0" onclick="ORVIA.workoutUI.resumeActive()"><span>' + date +
          '</span><span class="wo-badge wo-active">aktiv</span><span class="wo-hist-go">Fortsetzen ›</span></div>';
      }
      // Abgeschlossen: antippbar → schreibgeschützte Detailansicht (NIE als aktiv in den Store laden).
      if (s.status === 'completed') {
        return '<div class="wo-hist wo-hist-done" role="button" tabindex="0" onclick="ORVIA.workoutUI.openDetails(\'' + s.id + '\')"><span>' + date +
          '</span><span class="wo-badge wo-completed">Fertig' + (s.duration_min != null ? ' · ' + s.duration_min + ' min' : '') + '</span><span class="wo-hist-go">Details ›</span></div>';
      }
      // Abgebrochen/Übersprungen: nur Status, NICHT fortsetzbar.
      const label = { aborted: 'Abgebrochen', cancelled: 'Abgebrochen', skipped: 'Übersprungen', planned: 'Geplant' }[s.status] || s.status;
      return '<div class="wo-hist"><span>' + date + '</span><span class="wo-badge wo-' + esc(s.status) + '">' + esc(label) + '</span>' +
        (s.duration_min != null ? '<span class="muted">' + s.duration_min + ' min</span>' : '') + '</div>';
    }).join('');
  }
  // Schreibgeschützte Detailansicht einer abgeschlossenen Session (kein Laden als aktives Workout).
  O.workoutUI.openDetails = async function (sessionId) {
    openSheet('<h3 class="wo-sheet-t">Workout-Details</h3><p class="wo-sheet-p">Wird geladen …</p>');
    if (!O.repos || !O.repos.workout || !O.repos.workout.loadWorkoutTree) { closeSheet(); return; }
    const r = await O.repos.workout.loadWorkoutTree(sessionId);
    if (!r.success || !r.data || !r.data.session) { openSheet('<h3 class="wo-sheet-t">Workout-Details</h3><p class="wo-sheet-p">Konnte nicht geladen werden.</p><button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Schließen</button>'); return; }
    const s = r.data.session;
    const head = '<div class="wo-det-head">' + esc(s.local_date) + ' · ' + esc(s.sport || 'Training') +
      '<div class="muted">' + (s.duration_min != null ? s.duration_min + ' min' : '–') + (s.session_rpe != null ? ' · RPE ' + s.session_rpe : '') + '</div></div>';
    const body = (r.data.exercises || []).map(ex => {
      const name = (ex.exercise && ex.exercise.name) || 'Übung';
      const sets = (ex.sets || []).map((st2, i) => '<div class="wo-det-set"><span>Satz ' + (st2.set_number || i + 1) + '</span><span>' + esc(fmtSet(st2)) + '</span></div>').join('');
      return '<div class="wo-det-ex"><div class="wo-det-exname">' + esc(name) + '</div>' + (sets || '<div class="muted">Keine Sätze</div>') + '</div>';
    }).join('') || '<p class="muted">Keine Übungen.</p>';
    openSheet('<h3 class="wo-sheet-t">Workout-Details</h3>' + head + '<div class="wo-det-body">' + body + '</div><button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Schließen</button>');
  };
  // Aktive Session (auch wenn nur serverseitig bekannt) hydrieren und Overlay öffnen.
  O.workoutUI.resumeActive = async function () {
    const res = await ensureActiveWorkoutLoaded();
    if (res.active) O.workoutUI.open(); else { toastIt('Kein aktives Workout mehr.'); O.workoutUI.renderHub(); }
  };
  // Ein-Klick-Verwerfen: beendet die (ggf. festhängende) aktive Session, damit neu gestartet werden kann.
  O.workoutUI.discardActive = async function () {
    const okc = await O.workoutUI._confirmSheet('Workout beenden?', 'Es wird als „abgebrochen" beendet, damit du ein neues starten kannst.', 'Beenden', 'Zurück', true);
    if (!okc) return;
    await ensureActiveWorkoutLoaded();              // sicherstellen, dass der Store die Session kennt
    const r = await WS().cancelWorkout('aborted', 'stale_session_recovery');
    if (!r.success) { try { console.error('[discard]', r.error); } catch (e) {} toastIt('Workout konnte nicht beendet werden. Fehlercode: ' + ((r.error && r.error.code) || 'unbekannt')); return; }
    toastIt('Workout beendet — du kannst neu starten.');
    O.workoutUI.renderHub();
  };

  // Übungsbibliothek nur durchstöbern (ohne aktives Workout) — kein Einfügen erzwingen.
  O.workoutUI.browseExercises = function () {
    const active = st().session && st().session.status === 'active';
    if (active) { O.workoutUI.pickExercise(); return; }
    O.workoutUI.pickExercise(function () { O.workoutUI.closePicker(); toastIt('Starte zuerst ein Workout, um Übungen hinzuzufügen.'); });
  };
  O.workoutUI.startSport = async function (sport) {
    if (_busy) return; _busy = true;
    // Erst hydrieren: existiert (auch serverseitig) eine aktive Session → diese öffnen statt neu anlegen.
    const ex = await ensureActiveWorkoutLoaded();
    if (ex.active) { _busy = false; toastIt('Es läuft bereits ein Workout. Es wurde geöffnet.'); O.workoutUI.open(); return; }
    const r = await WS().startFreeWorkout({ sport: sport || 'Gym' }); _busy = false;
    if (!r.success) { if (r.error && r.error.code === 'active_exists') { toastIt('Es läuft bereits ein Workout. Es wurde geöffnet.'); O.workoutUI.open(); } else toastIt(humanErr(r.error)); return; }
    if (r.sync_status === 'pending') toastIt('Offline gestartet – wird synchronisiert ⏳');
    O.workoutUI.open();
  };

  O.workoutUI.startFree = async function () {
    if (_busy) return; _busy = true;
    const r = await WS().startFreeWorkout({ sport: 'Gym' }); _busy = false;
    if (!r.success) { if (r.error && r.error.code === 'active_exists') { toastIt('Es läuft bereits ein Workout. Es wurde geöffnet.'); O.workoutUI.open(); } else toastIt(humanErr(r.error)); return; }
    if (r.sync_status === 'pending') toastIt('Offline gestartet – wird synchronisiert ⏳');
    O.workoutUI.open();
  };

  O.workoutUI.open = function () { const ov = document.getElementById('workoutOverlay'); if (!ov) return; ov.classList.remove('hide'); try { localStorage.setItem(overlayFlagKey(), '1'); } catch (e) {} renderOverlay(); startElapsed(); };
  O.workoutUI.close = function () { const ov = document.getElementById('workoutOverlay'); if (ov) ov.classList.add('hide'); try { localStorage.removeItem(overlayFlagKey()); } catch (e) {} stopElapsed(); if (typeof renderDay === 'function') renderDay(); const th = document.getElementById('tab-training'); if (th && !th.classList.contains('hide') && O.workoutUI.renderHub) O.workoutUI.renderHub(); };

  // ---- Restore beim Laden / nach Login ----
  // NUR Hintergrund-Hydrierung. Das Overlay öffnet NIE automatisch (auch nicht nach Reload) —
  // ausschließlich durch bewusstes Tippen auf „Fortsetzen". App startet immer auf Home.
  O.workoutUI.tryRestore = async function () {
    if (!WS()) return;
    try { await WS().restoreActiveWorkout(); } catch (error) { try { console.error('[workout restore]', error); } catch (e) {} }
    try { localStorage.removeItem(overlayFlagKey()); } catch (e) {}
    O.workoutUI.renderEntry();
    const hub = document.getElementById('trainingHub');
    if (hub && O.workoutUI.renderHub) O.workoutUI.renderHub();
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
    if (!r.success) { toastIt(humanErr(r.error)); return; }
    if (r.sync_status === 'pending') toastIt('Offline gespeichert ⏳');
    // Pausentimer aus Plan-/letzter Pausenzeit
    const we = (st().exercises[idx] || {}).workoutExercise || {}; const rest = we.rest_seconds || 90;
    WS().startRestTimer(rest);
    renderOverlay();
  };
  O.workoutUI.editSet = function (ei, si) {
    const s = (st().exercises[ei] || {}).sets[si]; if (!s) return;
    openSheet('<h3 class="wo-sheet-t">Satz bearbeiten</h3>' +
      '<div class="wo-inrow"><label>kg<input type="number" inputmode="decimal" id="woEditW" value="' + (s.weight != null ? s.weight : '') + '"></label>' +
      '<label>Wdh<input type="number" inputmode="numeric" id="woEditR" value="' + (s.reps != null ? s.reps : '') + '"></label></div>' +
      '<button class="wo-sheet-btn primary" onclick="ORVIA.workoutUI._saveEdit(' + ei + ',' + si + ')">Speichern</button>' +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Zurück</button>');
  };
  O.workoutUI._saveEdit = async function (ei, si) {
    const w = document.getElementById('woEditW'), rr = document.getElementById('woEditR');
    const patch = { weight: (w && w.value !== '') ? +w.value : null, reps: (rr && rr.value !== '') ? +rr.value : null };
    const r = await WS().updateSet(ei, si, patch);
    if (!r.success) { toastIt(humanErr(r.error)); return; }
    O.workoutUI.closeSheet(); renderOverlay();
  };
  O.workoutUI.delSet = async function (ei, si) {
    const s = (st().exercises[ei] || {}).sets[si]; if (!s) return;
    if (s.completed) { const okc = await O.workoutUI._confirmSheet('Satz löschen?', 'Der abgeschlossene Satz wird entfernt.', 'Löschen', 'Zurück', true); if (!okc) return; }
    const r = await WS().deleteSet(ei, si);
    if (!r.success) { toastIt(humanErr(r.error)); return; }
    if (r.sync_status === 'pending') toastIt('Löschen wartet auf Sync ⏳');
    renderOverlay();
  };
  O.workoutUI.goEx = function (i) { const exs = st().exercises; if (i >= exs.length) { O.workoutUI.pickExercise(); return; } WS().setCurrentExercise(Math.max(0, i)); renderOverlay(); };
  O.workoutUI.timerAdd = function () { WS().addRestTime(15); renderOverlay(); };
  O.workoutUI.timerSkip = function () { WS().skipRest(); renderOverlay(); };

  O.workoutUI.removeExercise = async function (idx) {
    const e = st().exercises[idx]; if (!e) return;
    if ((e.sets || []).length) { const okc = await O.workoutUI._confirmSheet('Übung entfernen?', 'Die Übung samt ihrer Sätze wird entfernt.', 'Entfernen', 'Zurück', true); if (!okc) return; }
    const r = await WS().removeExercise(idx); if (!r.success) toastIt(humanErr(r.error)); else renderOverlay();
  };
  O.workoutUI.replaceExercise = function (idx) { O.workoutUI.pickExercise(function (exId) { WS().replaceExercise(idx, exId, true).then(() => renderOverlay()); }); };

  // ---- Bottom-Sheet-System (ersetzt native prompt()/confirm()) ----
  function _sheetEl() { let el = document.getElementById('woSheet'); if (!el) { el = document.createElement('div'); el.id = 'woSheet'; el.className = 'wo-sheet-bg hide'; document.body.appendChild(el); } return el; }
  function openSheet(html) { const el = _sheetEl(); el.innerHTML = '<div class="wo-sheet" role="dialog" aria-modal="true">' + html + '</div>'; el.classList.remove('hide'); el.onclick = function (e) { if (e.target === el) closeSheet(); }; }
  function closeSheet() { const el = document.getElementById('woSheet'); if (el) { el.classList.add('hide'); el.innerHTML = ''; } }
  O.workoutUI.closeSheet = closeSheet;
  function confirmSheet(title, body, confirmLabel, cancelLabel, danger) {
    return new Promise(resolve => {
      openSheet('<h3 class="wo-sheet-t">' + esc(title) + '</h3>' + (body ? '<p class="wo-sheet-p">' + esc(body) + '</p>' : '') +
        '<button class="wo-sheet-btn ' + (danger ? 'danger' : 'primary') + '" id="woSheetOk">' + esc(confirmLabel) + '</button>' +
        '<button class="wo-sheet-btn ghost" id="woSheetCancel">' + esc(cancelLabel || 'Zurück') + '</button>');
      const ok = document.getElementById('woSheetOk'), cx = document.getElementById('woSheetCancel');
      if (ok) ok.onclick = () => { closeSheet(); resolve(true); };
      if (cx) cx.onclick = () => { closeSheet(); resolve(false); };
    });
  }
  O.workoutUI._confirmSheet = confirmSheet;

  // RPE-Abschluss-Sheet (optional, kein nativer Prompt). Server bestätigt vor dem Schließen.
  let _finishing = false;
  O.workoutUI.finish = function () {
    O.workoutUI._rpe = null;
    const grid = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => '<button class="wo-rpe" data-n="' + n + '" onclick="ORVIA.workoutUI._rpePick(' + n + ')">' + n + '</button>').join('');
    openSheet('<h3 class="wo-sheet-t">Workout abschließen</h3><p class="wo-sheet-p">Wie anstrengend war die Einheit? (optional)</p>' +
      '<div class="wo-rpe-grid">' + grid + '</div><div class="wo-rpe-hint">1 = sehr leicht · 10 = maximal</div>' +
      '<button class="wo-sheet-btn primary" id="woFinishBtn" onclick="ORVIA.workoutUI._doFinish(false)">Workout abschließen</button>' +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI._doFinish(true)">Ohne Bewertung abschließen</button>' +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Zurück</button>');
  };
  O.workoutUI._rpePick = function (n) { O.workoutUI._rpe = n; try { document.querySelectorAll('#woSheet .wo-rpe').forEach(b => b.classList.toggle('on', +b.dataset.n === n)); } catch (e) {} };
  O.workoutUI._doFinish = async function (noRpe) {
    if (_finishing) return; _finishing = true;
    const rpe = noRpe ? null : (O.workoutUI._rpe != null ? O.workoutUI._rpe : null);
    const btn = document.getElementById('woFinishBtn'); const all = document.querySelectorAll('#woSheet .wo-sheet-btn');
    all.forEach(b => b.disabled = true); if (btn) btn.textContent = 'Speichern…';
    const r = await WS().finishWorkout({ sessionRpe: rpe });
    _finishing = false;
    if (!r.success) { all.forEach(b => b.disabled = false); if (btn) btn.textContent = 'Workout abschließen'; try { console.error('[finish]', r.error); } catch (e) {} toastIt('Workout konnte nicht beendet werden. Fehlercode: ' + ((r.error && r.error.code) || 'unbekannt')); return; }
    closeSheet();
    const ls = r.data && r.data.loadStatus;
    toastIt('Workout abgeschlossen ✓' + (ls === 'load_error' ? ' (Last nicht gespeichert)' : ''));
    O.workoutUI.close();
  };
  O.workoutUI.resume = function () { WS().resumeWorkout(); renderOverlay(); };

  // Optionen-Sheet (ersetzt Zahlen-Prompt). Destruktive Aktionen mit zweiter Bestätigung.
  O.workoutUI.menu = function () {
    const paused = WS().isPaused();
    openSheet('<h3 class="wo-sheet-t">Workout-Optionen</h3>' +
      '<button class="wo-sheet-btn" onclick="ORVIA.workoutUI._optPause()">' + (paused ? 'Workout fortsetzen' : 'Workout pausieren') + '</button>' +
      '<button class="wo-sheet-btn" onclick="ORVIA.workoutUI._optAbort()">Workout abbrechen</button>' +
      '<button class="wo-sheet-btn danger" onclick="ORVIA.workoutUI._optDelete()">Workout endgültig löschen</button>' +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Schließen</button>');
  };
  O.workoutUI._optPause = function () { const paused = WS().isPaused(); if (paused) { WS().resumeWorkout(); toastIt('Fortgesetzt'); } else { WS().pauseWorkout(); toastIt('Pausiert – Dauer steht still'); } closeSheet(); renderOverlay(); };
  O.workoutUI._optAbort = async function () {
    const okc = await confirmSheet('Workout abbrechen?', 'Die Einheit bleibt im Verlauf als „abgebrochen" erhalten.', 'Workout abbrechen', 'Zurück', true);
    if (!okc) return;
    const r = await WS().cancelWorkout('aborted', 'abgebrochen');
    if (!r.success) { try { console.error('[abort]', r.error); } catch (e) {} toastIt('Workout konnte nicht beendet werden. Fehlercode: ' + ((r.error && r.error.code) || 'unbekannt')); return; }
    toastIt('Workout abgebrochen'); O.workoutUI.close();
  };
  O.workoutUI._optDelete = async function () {
    const okc = await confirmSheet('Workout endgültig löschen?', 'Übungen und Sätze werden ebenfalls gelöscht.', 'Endgültig löschen', 'Zurück', true);
    if (!okc) return;
    const r = await WS().cancelWorkout('delete');
    if (!r.success) { try { console.error('[delete]', r.error); } catch (e) {} toastIt('Workout konnte nicht beendet werden. Fehlercode: ' + ((r.error && r.error.code) || 'unbekannt')); return; }
    toastIt('Workout gelöscht'); O.workoutUI.close();
  };

  // ---- Übungsauswahl (Redesign: Safe-Area, Sticky-Header, Filter, deutsche Labels) ----
  const TD = function () { return O.trainingDomain || null; };
  function movePattern(e) { return e.movementPattern || e.movement_pattern || null; }
  function moveLabel(e) { const td = TD(); const k = movePattern(e); return td && td.labelMovement ? td.labelMovement(k) : (k || ''); }
  function groupOf(e) { const td = TD(); return td && td.groupOfMovement ? td.groupOfMovement(movePattern(e)) : null; }

  O.workoutUI.pickExercise = async function (cb) {
    const ov = document.getElementById('workoutPicker'); if (!ov) return;
    ov.classList.remove('hide');
    const groups = (TD() && TD().MUSCLE_GROUPS_DE) || [];
    const chips = '<button class="wo-fchip on" data-g="" onclick="ORVIA.workoutUI._setFilter(this,\'\')">Alle</button>' +
      groups.map(g => '<button class="wo-fchip" data-g="' + g.key + '" onclick="ORVIA.workoutUI._setFilter(this,\'' + g.key + '\')">' + esc(g.label) + '</button>').join('');
    ov.innerHTML =
      '<div class="wo-pick">' +
      '<div class="wo-pick-head"><button class="wo-pick-back" aria-label="Zurück" onclick="ORVIA.workoutUI.closePicker()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<div class="wo-pick-title">Übung auswählen</div></div>' +
      '<div class="wo-pick-search"><input id="woSearch" inputmode="search" autocomplete="off" placeholder="Übung suchen…" aria-label="Übung suchen" oninput="ORVIA.workoutUI._filter()"></div>' +
      '<div class="wo-fchips">' + chips + '</div>' +
      '<div id="woPickList" class="wo-pick-list" role="list"></div></div>';
    O.workoutUI._cb = cb || null; O.workoutUI._group = '';
    const r = O.repos && O.repos.exercise ? await O.repos.exercise.list() : { success: false };
    O.workoutUI._all = (r.success ? r.data : []) || [];
    O.workoutUI._filter();
    const si = document.getElementById('woSearch'); if (si) { try { si.focus(); } catch (e) {} }
  };
  O.workoutUI._setFilter = function (btn, g) {
    O.workoutUI._group = g || '';
    try { document.querySelectorAll('#workoutPicker .wo-fchip').forEach(b => b.classList.toggle('on', b === btn)); } catch (e) {}
    O.workoutUI._filter();
  };
  function recentExercises() { try { return JSON.parse(localStorage.getItem('orvia_recent_ex_' + ((O.user && O.user.id) || 'x')) || '[]'); } catch (e) { return []; } }
  function pushRecentExercise(id) { try { const k = 'orvia_recent_ex_' + ((O.user && O.user.id) || 'x'); let a = recentExercises().filter(x => x !== id); a.unshift(id); a = a.slice(0, 12); localStorage.setItem(k, JSON.stringify(a)); } catch (e) {} }
  function matchesQuery(e, q) {
    if (!q) return true;
    if ((e.name || '').toLowerCase().indexOf(q) >= 0) return true;
    const al = e.aliases || []; for (let i = 0; i < al.length; i++) { if (String(al[i]).toLowerCase().indexOf(q) >= 0) return true; }
    return false;
  }
  O.workoutUI._filter = function () {
    const q = (document.getElementById('woSearch') && document.getElementById('woSearch').value || '').toLowerCase().trim();
    const g = O.workoutUI._group || '';
    let list = (O.workoutUI._all || []).filter(e => matchesQuery(e, q) && (!g || groupOf(e) === g));
    // Zuletzt verwendete zuerst, dann alphabetisch (kein stilles Abschneiden der Trefferliste).
    const recent = recentExercises();
    list.sort((a, b) => {
      const ra = recent.indexOf(a.id), rb = recent.indexOf(b.id);
      if (ra !== rb) { if (ra < 0) return 1; if (rb < 0) return -1; return ra - rb; }
      return (a.name || '').localeCompare(b.name || '', 'de');
    });
    const el = document.getElementById('woPickList'); if (!el) return;
    const CAP = 200; const shown = list.slice(0, CAP);
    const head = '<div class="wo-pick-count">' + list.length + ' Übung' + (list.length === 1 ? '' : 'en') + '</div>';
    el.innerHTML = shown.length ? head + shown.map(e => {
      const recentTag = recent.indexOf(e.id) >= 0 ? ' · zuletzt' : '';
      const meta = [moveLabel(e)].filter(Boolean).join(' · ') + (e.isSystem === false ? ' · eigen' : '') + recentTag;
      return '<button class="wo-pickitem" role="listitem" onclick="ORVIA.workoutUI.choose(\'' + e.id + '\')"><span class="wo-pi-txt"><span class="wo-pi-main">' + esc(e.name) + '</span><span class="wo-pi-meta">' + esc(meta) + '</span></span><span class="pchev">›</span></button>';
    }).join('') + (list.length > CAP ? '<p class="muted" style="padding:12px 2px">Suche eingrenzen, um weitere zu sehen.</p>' : '') : '<p class="muted" style="padding:16px">Keine Übung gefunden.</p>';
  };
  O.workoutUI.choose = async function (exId) {
    const ex = (O.workoutUI._all || []).find(e => e.id === exId) || null;
    pushRecentExercise(exId);
    O.workoutUI.closePicker();
    if (O.workoutUI._cb) { const cb = O.workoutUI._cb; O.workoutUI._cb = null; cb(exId); return; }
    const r = await WS().addExercise(exId, { plannedSets: 3, exercise: ex, restSeconds: 90 });
    if (!r.success) toastIt(humanErr(r.error)); else renderOverlay();
  };
  O.workoutUI.closePicker = function () { const ov = document.getElementById('workoutPicker'); if (ov) ov.classList.add('hide'); };
  // ESC schließt Picker (Desktop/Tastatur).
  try { document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { const ov = document.getElementById('workoutPicker'); if (ov && !ov.classList.contains('hide')) O.workoutUI.closePicker(); } }); } catch (e) {}
})();
