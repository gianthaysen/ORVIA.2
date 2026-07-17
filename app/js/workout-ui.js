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
  /* R1.5 · Nutzermodus aus dem KANONISCHEN Primärsport-Level (gleiche Quelle wie
     userLevel()). Vorher: nur Legacy PROFILE.level (Default 'fortgeschritten' ⇒ jeder
     Beginner galt als Pro) und im Fehlerfall true. Jetzt: fehlend/Fehler ⇒ false. */
  function isPro() {
    try {
      var pm = O.profileModel;
      var k = (pm && typeof pm.primarySportLevel === 'function') ? pm.primarySportLevel(typeof PROFILE !== 'undefined' ? PROFILE : null) : null;
      return k === 'advanced' || k === 'competitive';
    } catch (e) { return false; }
  }
  function fmtSet(s) { const w = s.weight != null ? s.weight + ' kg' : '–'; const r = s.reps != null ? ' × ' + s.reps : ''; const rir = s.rir != null ? ' @ RIR ' + s.rir : (s.rpe != null ? ' @ RPE ' + s.rpe : ''); return w + r + rir; }
  // Kanonische Dauer-Anzeige aus der Session (started/finished bevorzugt, sonst duration_min).
  // Unbekannt → „Dauer nicht erfasst", unplausibel (z. B. über Nacht aktiv) → markiert. NIE still „0 min".
  function durationLabel(s) {
    const AN = O.activityNormalize;
    if (AN) { const n = AN.normalizeWorkoutSession(s); return AN.fmtDurationSeconds(n.durationSeconds); }
    return s && s.duration_min != null ? s.duration_min + ' min' : 'Dauer nicht erfasst';
  }

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
  // Heutige erfasste Einheiten aus dem lokalen Tagesspeicher (DB[heute].sessions) — EINE Quelle,
  // identisch mit „Training erfassen" (tab-akt) und Insights. Kompakte, schreibgeschützte Liste.
  function todaysLogged() {
    try {
      const k = (typeof todayStr === 'function') ? todayStr() : null;
      const e = (typeof DB !== 'undefined' && DB && k) ? DB[k] : null;
      const ses = e && e.sessions; if (!ses) return [];
      return Object.keys(ses).filter(t => t !== '_ts').map(t => {
        const d = ses[t] || {}; const bits = [];
        if (d.dist != null) bits.push(t === 'Schwimmen' ? d.dist + ' m' : d.dist + ' km');
        if (d.dur != null) bits.push(d.dur + ' min');
        if (d.rpe != null) bits.push('RPE ' + d.rpe);
        return { type: t, sub: bits.join(' · ') };
      });
    } catch (e) { return []; }
  }
  // Planerfüllung für HEUTE: geplante Sportarten (Wochenplan) vs. tatsächlich absolvierte.
  function planFulfillmentToday(logged) {
    try {
      if (typeof Calc === 'undefined' || !Calc.planStatus || typeof activeWeekPlan !== 'function' || typeof todayStr !== 'function') return null;
      const idx = (new Date(todayStr() + 'T12:00').getDay() + 6) % 7;
      const planned = (activeWeekPlan()[idx] || []).map(it => it.t).filter(Boolean);
      const done = (logged || []).map(a => a.type);
      const s = st().session; if (s && s.status === 'active' && s.sport) done.push(s.sport);
      return Calc.planStatus(planned, done, { isPast: false });
    } catch (e) { return null; }
  }
  // Heute-Seite: EINE kompakte Tageszusammenfassung + genau zwei Wege (Starten / Erfassen).
  O.workoutUI.renderEntry = function () {
    const host = document.getElementById('todaySummary'); if (!host) return;
    const s = st().session; const active = s && s.status === 'active';
    const logged = todaysLogged();
    const fk = planFulfillmentToday(logged);
    let inner = '<div class="card"><h2><svg class="ic"><use href="#i-dumbbell"/></svg>Heutige Aktivität' +
      (fk && fk.label ? ' <span class="pf-chip pf-' + fk.key + '">' + esc(fk.label) + '</span>' : '') + '</h2>';
    if (active) inner += statusRow('Training läuft · ' + esc(s.sport || 'Training'), 'Fortsetzen', 'live');
    if (logged.length) inner += '<div class="tsum-list">' + logged.map(a => '<div class="tsum-row"><span class="tsum-name">' + esc(a.type) + '</span><span class="tsum-sub">' + esc(a.sub || '') + '</span></div>').join('') + '</div>';
    if (!active && !logged.length) inner += '<p class="muted" style="margin:2px 0 12px">Noch keine Aktivität erfasst.</p>';
    inner += '<div class="tsum-actions"><button class="btn" onclick="ORVIA.workoutUI.openTrainingTab()">Training starten</button>' +
      '<button class="btn sec" onclick="ORVIA.workoutUI.openCapture()">Training erfassen</button></div></div>';
    host.innerHTML = inner;
  };
  // „Training erfassen" → Aktivität-Tab (manuell eintragen / importieren) — derselbe Datenfluss.
  O.workoutUI.openCapture = function () { try { showTab('akt'); } catch (e) {} };

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
    '<div class="hub-row" onclick="ORVIA.workoutUI.openCapture()"><span class="pic"><svg class="ic"><use href="#i-pulse"/></svg></span><span class="hub-row-txt"><b>Training erfassen</b><small>Manuell eintragen oder importieren</small></span><span class="pchev">›</span></div>';
  function hubTail() { return '<div class="hub-nav">' + HUB_NAV + '</div><div class="card"><h2><svg class="ic"><use href="#i-clock"/></svg>Verlauf</h2><div id="workoutHistory"></div></div>'; }

  function _renderHubActive(host) {
    const s = st().session; const exs = st().exercises || []; const prog = WS().progress();
    const mins = hubMinutes(s);
    const sub = mins + ' Minuten · ' + (prog.kind === 'sets' ? (prog.completed + '/' + prog.planned + ' Sätze') : (exs.length + ' Übungen'));
    // Verwaiste Session (>12h, kein offenes Overlay): klar als „altes Workout" kennzeichnen.
    const startedMs = s.started_at ? new Date(s.started_at).getTime() : Date.now();
    const orphan = (Date.now() - startedMs) > 12 * 3600 * 1000;
    const tag = orphan ? 'Altes aktives Training gefunden' : 'Training läuft';
    let main = '<div class="hub-hero live"><div class="hub-hero-tag">' + tag + '</div><div class="hub-hero-title">' + esc(s.sport || 'Training') + '</div>' +
      '<div class="hub-hero-sub">' + (orphan ? 'Gestartet vor ' + mins + ' Minuten' : sub) + '</div>' +
      '<button class="btn cta" onclick="ORVIA.workoutUI.open()"><span class="cta-txt"><span class="cta-main">Fortsetzen</span></span></button>' +
      '<button class="hub-discard" onclick="ORVIA.workoutUI.discardActive()">' + (orphan ? 'Festhängendes Training beenden' : 'Training verwerfen') + '</button>' +
      (orphan ? '<button class="hub-discard" onclick="ORVIA.workoutUI._optDelete()">Endgültig löschen</button>' : '') +
      '</div>';
    host.innerHTML = main + hubTail(); renderHistory();
  }
  // Schnellstart-Kacheln DYNAMISCH aus der Nutzer-Sportauswahl (keine feste Fünferliste).
  const HUB_SPRITE = { run: 1, bike: 1, swim: 1, dumbbell: 1, stretch: 1, pulse: 1 };
  function hubIcon(sportId) { const ic = (O.activityConfig && O.activityConfig.sportIcon) ? O.activityConfig.sportIcon(sportId) : 'pulse'; return HUB_SPRITE[ic] ? ic : 'pulse'; }
  function _quickTilesHTML() {
    let tiles = [];
    try {
      const sel = (typeof _userSportsSelection === 'function') ? _userSportsSelection() : null;
      if (O.activityConfig && O.activityConfig.userSportTiles) tiles = O.activityConfig.userSportTiles(sel);
    } catch (e) {}
    if (!tiles || tiles.length <= 1) {
      // Fallback ohne Auswahl: Katalog-Standard (immer noch nicht hart in Render gemischt).
      tiles = [{ sportId: 'gym', label: 'Krafttraining' }, { sportId: 'running', label: 'Laufen' }, { sportId: 'other', label: 'Weitere Aktivität', isMore: true }];
    }
    // 4d.1: Bei mehr als vier aktiven Sportarten nur die vier wichtigsten direkt, Rest unter „Alle Sportarten".
    var real = tiles.filter(t => !t.isMore), more = tiles.filter(t => t.isMore);
    if (real.length > 4) { real = real.slice(0, 4); if (!more.length) more = [{ sportId: 'other', label: 'Weitere Aktivität', isMore: true }]; more = [{ sportId: 'all', label: 'Alle Sportarten', isAll: true }].concat(more); }
    return real.concat(more).map(t => '<button class="hub-q q3" onclick="' + (t.isAll ? 'ORVIA.workoutUI.openTrainingTab()' : 'ORVIA.workoutUI.startSport(\'' + esc(t.label).replace(/'/g, '') + '\')') + '"><svg class="ic"><use href="#i-' + hubIcon(t.sportId) + '"/></svg><span>' + esc(t.label) + '</span></button>').join('');
  }
  function _renderHubIdle(host) {
    const main = '<div class="hub-hero"><div class="hub-hero-tag">Training starten</div><div class="hub-hero-sub">Freie Einheit oder Schnellstart wählen</div>' +
      '<div class="hub-quick">' + _quickTilesHTML() + '</div></div>';
    host.innerHTML = main + hubTail(); renderHistory();
  }
  O.workoutUI.renderHub = function () {
    const host = document.getElementById('trainingHub'); if (!host) return;
    // PERF-INSTRUMENTIERUNG (Audit 2026-07-15): ensureActiveWorkoutLoaded() re-hydriert bei
    // JEDEM Öffnen des Training-Tabs neu, wenn kein Workout aktiv ist (kein "bereits geprüft"-Cache).
    var P = O.perf || { now: function () { return Date.now(); }, mark: function () {} };
    var _t0 = P.now();
    // Wenn Store schon aktiv: sofort. Sonst Ladezustand zeigen und hydrieren (kein falsches „Training starten").
    if (st().session && st().session.status === 'active') { _renderHubActive(host); P.mark('workoutUI.renderHub (session already active, sync)', _t0); return; }
    host.innerHTML = '<div class="hub-hero"><div class="hub-hero-tag">Training</div><div class="hub-hero-sub">Workout wird geladen …</div><div class="hub-skel"></div></div>';
    ensureActiveWorkoutLoaded().then(res => {
      P.mark('workoutUI.renderHub: ensureActiveWorkoutLoaded (re-runs every tab open)', _t0);
      const h = document.getElementById('trainingHub'); if (!h) return;
      if (res.active) _renderHubActive(h); else _renderHubIdle(h);
    });
  };
  O.workoutUI._openActivity = function () { try { showTab('akt'); } catch (e) {} };
  // Nach Workout-Abschluss den Trainings-Verlauf ohne App-Reload aktualisieren (neutrales Event).
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('orvia:activity-updated', function () { try { if (document.getElementById('workoutHistory')) renderHistory(); } catch (e) {} });
  }

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
          '</span><span class="wo-badge wo-completed">Fertig · ' + esc(durationLabel(s)) + '</span><span class="wo-hist-go">Details ›</span></div>';
      }
      // Abgebrochen/Übersprungen: nur Status, NICHT fortsetzbar.
      const label = { aborted: 'Abgebrochen', cancelled: 'Abgebrochen', skipped: 'Übersprungen', planned: 'Geplant' }[s.status] || s.status;
      return '<div class="wo-hist"><span>' + date + '</span><span class="wo-badge wo-' + esc(s.status) + '">' + esc(label) + '</span>' +
        '<span class="muted">' + esc(durationLabel(s)) + '</span></div>';
    }).join('');
  }
  // Schreibgeschützte Detailansicht einer abgeschlossenen Session (kein Laden als aktives Workout).
  // Detailansicht. Ladereihenfolge (Inkrement 2A): 1) lokaler Snapshot → 2) Supabase-Tree
  // → 3) allgemeine Activity-Daten → 4) kontrollierter Fehler. Auflösung NUR über stabile ID.
  function detSheet(headHTML, bodyHTML, sessionId) {
    var del = sessionId ? '<button class="wo-sheet-btn danger" onclick="ORVIA.workoutUI.deleteWorkout(\'' + esc(sessionId) + '\')">Workout löschen</button>' : '';
    openSheet('<h3 class="wo-sheet-t">Workout-Details</h3>' + headHTML + '<div class="wo-det-body">' + bodyHTML + '</div>' + del + '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Schließen</button>');
  }
  // Workout löschen (Session + Übungen + Sätze + Activity) — Bestätigung, offline-fest über Tombstone.
  O.workoutUI.deleteWorkout = async function (sessionId) {
    const okc = await O.workoutUI._confirmSheet('Workout wirklich löschen?', 'Das Workout inkl. Übungen und Sätzen wird dauerhaft entfernt.', 'Endgültig löschen', 'Abbrechen', true);
    if (!okc) return;
    try {
      const AS = O.activityStore;
      if (AS) {
        // lokalen Activity-Datensatz (falls vorhanden) + Tombstone (kind=workout) anlegen.
        const local = AS.getActivityBySource ? AS.getActivityBySource('orvia_workout', sessionId) : null;
        AS.deleteActivity((local && (local.clientRecordId || local.id)) || sessionId,
          local || { source: 'orvia_workout', workoutSessionId: sessionId, sourceRecordId: sessionId, id: null });
      }
      // Legacy-DB-Spiegel dieser Session entfernen.
      try { if (typeof _removeLegacyFor === 'function') _removeLegacyFor({ workoutSessionId: sessionId, source: 'orvia_workout', sourceRecordId: sessionId }); } catch (e) {}
    } catch (e) { try { console.error('[ORVIA workout] lokales Workout-Löschen', e); } catch (_) {} }
    closeSheet();
    // Statistiken/Verläufe sofort aktualisieren + Server-Löschung (RPC) anstoßen.
    try { if (window.dispatchEvent) window.dispatchEvent(new CustomEvent('orvia:activity-updated', { detail: { deleted: true } })); } catch (e) {}
    try { if (O.activitySync) O.activitySync.flushPendingActivities(); } catch (e) {}
    try { renderHistory(); } catch (e) {}
    toastIt('Workout gelöscht');
  };
  function detHead(dateLabel, sport, durLabel, rpe) {
    return '<div class="wo-det-head">' + esc(dateLabel || '') + ' · ' + esc(sport || 'Training') +
      '<div class="muted">' + esc(durLabel) + (rpe != null ? ' · RPE ' + rpe : '') + '</div></div>';
  }
  function detSummary(sum) {
    if (!sum) return '';
    const parts = [];
    if (sum.exerciseCount != null) parts.push(sum.exerciseCount + ' Übungen');
    if (sum.workingSetCount != null) parts.push(sum.workingSetCount + ' Arbeitssätze');
    if (sum.totalVolumeKg != null) parts.push('Volumen ' + sum.totalVolumeKg + ' kg');
    if (sum.avgRir != null) parts.push('Ø RIR ' + sum.avgRir);
    return parts.length ? '<div class="wo-det-sum muted">' + esc(parts.join(' · ')) + '</div>' : '';
  }
  // Übungsblöcke aus Snapshot (clientseitig) ODER Tree (Supabase) rendern.
  function detExercises(exercises, nameOf) {
    return (exercises || []).map(ex => {
      const name = nameOf(ex);
      const sets = (ex.sets || []).map((st2, i) => '<div class="wo-det-set"><span>Satz ' + (st2.set_number != null ? st2.set_number : (st2.setNumber != null ? st2.setNumber : i + 1)) + '</span><span>' + esc(fmtSet(st2)) + '</span></div>').join('');
      return '<div class="wo-det-ex"><div class="wo-det-exname">' + esc(name) + '</div>' + (sets || '<div class="muted">Keine Sätze</div>') + '</div>';
    }).join('');
  }
  O.workoutUI.openDetails = async function (sessionId) {
    openSheet('<h3 class="wo-sheet-t">Workout-Details</h3><p class="wo-sheet-p">Wird geladen …</p>');
    // 1) Lokaler Snapshot (offline-fest, überlebt Reload) — über stabile source_record_id.
    try {
      const AS = O.activityStore;
      const act = AS && AS.getActivityBySource('orvia_workout', sessionId);
      if (act) {
        const det = AS.getWorkoutDetailsForActivity(act.clientRecordId);
        if (det.ok && det.hasDetails) {
          const head = detHead(act.startedAt ? act.startedAt.slice(0, 10) : '', act.sportId, durationLabel({ duration_seconds: act.durationSeconds }), null) + detSummary(act.summary);
          const body = detExercises(det.exercises, ex => ex.exerciseNameSnapshot || 'Übung') || '<p class="muted">Keine Übungen.</p>';
          detSheet(head, body, sessionId); return;
        }
      }
    } catch (e) { try { console.error('[ORVIA workout] lokaler Detail-Snapshot fehlgeschlagen', e); } catch (_) {} }
    // 2) Supabase-Tree.
    if (O.repos && O.repos.workout && O.repos.workout.loadWorkoutTree) {
      const r = await O.repos.workout.loadWorkoutTree(sessionId);
      if (r.success && r.data && r.data.session) {
        const s = r.data.session;
        const head = detHead(s.local_date, s.sport, durationLabel(s), s.session_rpe);
        const body = detExercises(r.data.exercises || [], ex => (ex.exercise && ex.exercise.name) || 'Übung') || '<p class="muted">Keine Übungen.</p>';
        detSheet(head, body, sessionId); return;
      }
    }
    // 3) Allgemeine Activity-Daten (ohne Satzdetails) statt pauschalem Fehler.
    try {
      const AS = O.activityStore;
      const act = AS && AS.getActivityBySource('orvia_workout', sessionId);
      if (act) {
        const head = detHead(act.startedAt ? act.startedAt.slice(0, 10) : '', act.sportId, durationLabel({ duration_seconds: act.durationSeconds }), null) + detSummary(act.summary);
        detSheet(head, "<p class=\"muted\">Für diese Einheit sind keine Satzdetails gespeichert.</p>", sessionId); return;
      }
    } catch (e) {}
    // 4) Kontrollierter Fehlerzustand (echter Ladefehler).
    detSheet('', '<p class="wo-sheet-p">Details konnten nicht geladen werden (DETAIL_LOAD_FAILED).</p>');
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
  O.workoutUI.startSport = async function (sport, opts) {
    if (_busy) return; _busy = true; O.workoutUI._liveDist = null; O.workoutUI._intervals = null; O.workoutUI._ivIdx = 0; O.workoutUI._laps = 0;
    // F1+: geplante Sollwerte (Struktur/Label) in die aktive Einheit übernehmen und anzeigen.
    O.workoutUI._planNote = (opts && opts.planNote) || null;
    O.workoutUI._planLabel = (opts && opts.planLabel) || null;
    // Erst hydrieren: existiert (auch serverseitig) eine aktive Session → diese öffnen statt neu anlegen.
    const ex = await ensureActiveWorkoutLoaded();
    if (ex.active) { _busy = false; O.workoutUI._planNote = null; O.workoutUI._planLabel = null; toastIt('Es läuft bereits ein Workout. Es wurde geöffnet.'); O.workoutUI.open(); return; }
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
  O.workoutUI.close = function () { const ov = document.getElementById('workoutOverlay'); if (ov) ov.classList.add('hide'); try { localStorage.removeItem(overlayFlagKey()); } catch (e) {} O.workoutUI._planNote = null; O.workoutUI._planLabel = null; O.workoutUI._intervals = null; O.workoutUI._ivIdx = 0; O.workoutUI._laps = 0; stopElapsed(); if (typeof renderDay === 'function') renderDay(); const th = document.getElementById('tab-training'); if (th && !th.classList.contains('hide') && O.workoutUI.renderHub) O.workoutUI.renderHub(); };

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
  function startElapsed() { stopElapsed(); _tick = setInterval(function () { const el = document.getElementById('woElapsed'); const big = document.getElementById('woElapsedBig'); const t = document.getElementById('woTimer'); const v = elapsedStr(); if (el) el.textContent = v; if (big) big.textContent = v; tickTimer(t); }, 1000); }
  function stopElapsed() { if (_tick) { clearInterval(_tick); _tick = null; } }
  // Verstrichene Workout-Zeit ABZÜGLICH Pausen (echte aktive Dauer).
  function elapsedStr() {
    const s = st().session; if (!s || !s.started_at) return '0:00';
    let pausedMs = (s.total_paused_seconds || 0) * 1000;
    if (s.paused_at) pausedMs += Math.max(0, Date.now() - new Date(s.paused_at).getTime());
    const sec = Math.max(0, Math.floor((Date.now() - new Date(s.started_at).getTime() - pausedMs) / 1000));
    const m = Math.floor(sec / 60); return m + ':' + String(sec % 60).padStart(2, '0');
  }
  function elapsedSec() {
    const s = st().session; if (!s || !s.started_at) return 0;
    let pausedMs = (s.total_paused_seconds || 0) * 1000;
    if (s.paused_at) pausedMs += Math.max(0, Date.now() - new Date(s.paused_at).getTime());
    return Math.max(0, Math.floor((Date.now() - new Date(s.started_at).getTime() - pausedMs) / 1000));
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

    const setBased = isSetBased(session.sport);
    let html = '<div class="wo-wrap">';
    // Header (Untertitel je Modus)
    const sub = setBased
      ? '<span id="woElapsed">' + elapsedStr() + '</span> · ' + (prog.kind === 'sets' ? (prog.completed + '/' + prog.planned + ' Sätze') : ((prog.completed || 0) + '/' + (prog.total || 0) + ' Übungen'))
      : '<span id="woElapsed">' + elapsedStr() + '</span> · Dauer-Modus';
    html += '<div class="wo-head"><div><div class="wo-name">' + esc(session.sport || 'Training') + '</div><div class="wo-sub">' + sub + '</div></div>' +
      '<div class="wo-headbtns"><button class="wo-icbtn" onclick="ORVIA.workoutUI.finish()">Beenden</button><button class="wo-icbtn sec" onclick="ORVIA.workoutUI.menu()">⋯</button></div></div>';
    if (dec) html += '<div class="wo-ready">Tagesform <b>' + (dec.score != null ? dec.score : '–') + '</b> · ' + esc(dec.statusText || '') + ' <span class="muted">(Kontext — ändert den Morgen-Score nicht)</span></div>';
    if (WS().isPaused()) html += '<div class="wo-paused">⏸ Training pausiert — die Dauer läuft nicht weiter. <button class="wo-link" onclick="ORVIA.workoutUI.resume()">Fortsetzen</button></div>';
    // F1+: Plan-Sollwerte für die heutige Einheit (aus dem Plan übernommen).
    if (O.workoutUI._planNote) html += '<div class="wo-plan"><span class="wo-plan-h">Plan für heute' + (O.workoutUI._planLabel ? ' · ' + esc(O.workoutUI._planLabel) : '') + '</span><span class="wo-plan-b">' + esc(O.workoutUI._planNote) + '</span></div>';

    if (!setBased) {
      // ---- Dauer-/Distanz-Live-Modus (Laufen/Rad/Schwimmen/Mobility) — KEINE Übungen/Sätze ----
      const distSport = isDistanceSport(session.sport);
      html += '<div class="wo-cur wo-duration"><div class="wo-dur-big" id="woElapsedBig">' + elapsedStr() + '</div><div class="muted" style="text-align:center">Aktive Dauer</div>';
      if (session.sport === 'Schwimmen') {
        html += swimPanelHTML();
      } else if (distSport) {
        const unit = 'km';
        html += '<div class="wo-inrow" style="margin-top:14px"><label>Distanz (' + unit + ')<input type="number" inputmode="decimal" id="woLiveDist" value="' + (O.workoutUI._liveDist != null ? O.workoutUI._liveDist : '') + '" placeholder="z. B. 8" oninput="ORVIA.workoutUI._setLiveDist(this.value)"></label></div>';
        html += '<p class="note" style="text-align:left">Geführter Modus ohne GPS — Distanz hier oder beim Beenden eintragen. Pace wird daraus berechnet.</p>';
      } else {
        html += '<p class="note" style="text-align:left;margin-top:14px">Geführter Modus — Dauer läuft. Beim Beenden Anstrengung (RPE) erfassen.</p>';
      }
      html += '</div>';
      if (session.sport === 'Laufen') html += intervalPanelHTML();   // Lauf-Intervall-Detailmodus
      html += '<div class="wo-foot"><button class="wo-fbtn" onclick="ORVIA.workoutUI.menu()">Optionen</button>' +
        '<button class="wo-fbtn primary" onclick="ORVIA.workoutUI.finish()">Training beenden</button></div>';
      html += '</div>';
      ov.innerHTML = html;
      return;
    }

    // ---- Gym: Satz-/Übungsmodus ----
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
      html += '<div class="wo-sets">' + (cur.sets || []).map((s, si) =>
        '<div class="wo-set ' + (s.completed ? 'done' : '') + '"><span class="wo-setn">' + (s.set_number || si + 1) + '</span>' +
        '<span class="wo-settype">' + esc(SET_TYPE_DE[s.set_type] || 'Satz') + '</span>' +
        '<span class="wo-setval">' + esc(fmtSet(s)) + '</span>' +
        '<button class="wo-mini" onclick="ORVIA.workoutUI.editSet(' + idx + ',' + si + ')">✎</button>' +
        '<button class="wo-mini danger" onclick="ORVIA.workoutUI.delSet(' + idx + ',' + si + ')">🗑</button></div>').join('') + '</div>';
      html += setInputHTML(cur);
      const tm = S.timer || {};
      html += '<div class="wo-timer"><span>Satzpause</span> <b id="woTimer">' + (tm.running ? WS().restRemaining() + 's' : '–') + '</b>' +
        '<button class="wo-mini" onclick="ORVIA.workoutUI.timerAdd()">+15s</button><button class="wo-mini" onclick="ORVIA.workoutUI.timerSkip()">Überspringen</button></div>';
    }
    html += '<div class="wo-foot"><button class="wo-fbtn" onclick="ORVIA.workoutUI.pickExercise()">+ Übung</button>' +
      '<button class="wo-fbtn" onclick="ORVIA.workoutUI.goEx(' + (idx + 1) + ')">Nächste ›</button>' +
      '<button class="wo-fbtn primary" onclick="ORVIA.workoutUI.finish()">Abschließen</button></div>';
    html += '</div>';
    ov.innerHTML = html;
    if (cur) loadLast(cur);
  }
  function isSetBased(sport) { return (sport === 'Gym' || (sport || '').toLowerCase() === 'gym' || (sport || '').toLowerCase() === 'krafttraining'); }
  function isDistanceSport(sport) { return ['Laufen', 'Rad', 'Schwimmen'].indexOf(sport) >= 0; }
  O.workoutUI._setLiveDist = function (v) { const n = parseFloat(String(v).replace(',', '.')); O.workoutUI._liveDist = isNaN(n) ? null : n; };

  // ---- Schwimm-Detailmodus: Bahnen-Zähler → Distanz (m) + Pace/100m, kein Sensor ----
  function swimPanelHTML() {
    const pool = O.workoutUI._poolLen || 25;
    const laps = O.workoutUI._laps || 0;
    const distM = laps * pool;
    O.workoutUI._liveDist = distM;   // Meter, fließt in Abschluss/SSOT
    const paceSec = (typeof Calc !== 'undefined' && Calc.swimPace100) ? Calc.swimPace100(distM, elapsedSec()) : null;
    const paceTxt = paceSec ? (typeof Calc !== 'undefined' && Calc.fmtPace ? Calc.fmtPace(paceSec) : Math.round(paceSec) + 's') + ' /100m' : '–';
    const poolChip = (v) => '<button class="wo-fchip ' + (pool === v ? 'on' : '') + '" onclick="ORVIA.workoutUI.setPool(' + v + ')">' + v + ' m</button>';
    return '<div class="wo-swim">' +
      '<div class="wo-fchips" style="padding:8px 0">' + poolChip(25) + poolChip(50) + '</div>' +
      '<div class="wo-swim-dist">' + distM + ' m <span class="muted">(' + laps + ' Bahnen)</span></div>' +
      '<div class="muted" style="text-align:center;margin-bottom:10px">Pace ' + paceTxt + '</div>' +
      '<div class="wo-swim-btns"><button class="wo-fbtn" onclick="ORVIA.workoutUI.swimLap(-1)">– Bahn</button>' +
      '<button class="wo-fbtn primary" onclick="ORVIA.workoutUI.swimLap(1)">+ Bahn</button></div>' +
      '<p class="note" style="text-align:left">Beckenlänge wählen, je Bahn antippen. Distanz/Pace berechnen sich automatisch.</p></div>';
  }
  O.workoutUI.setPool = function (v) { O.workoutUI._poolLen = v; renderOverlay(); };
  O.workoutUI.swimLap = function (d) { O.workoutUI._laps = Math.max(0, (O.workoutUI._laps || 0) + d); renderOverlay(); };

  // ---- Lauf-Intervall-Detailmodus (geführter Timer, kein GPS) ----
  function intervalPanelHTML() {
    const iv = O.workoutUI._intervals;
    if (!iv || !iv.length) {
      return '<div class="wo-iv"><button class="btn sec" onclick="ORVIA.workoutUI.openIntervalBuilder()">Intervalle planen</button></div>';
    }
    const cur = O.workoutUI._ivIdx || 0; const step = iv[cur] || iv[iv.length - 1];
    const running = st().timer && st().timer.running;
    const remTxt = running ? WS().restRemaining() + 's' : (step ? Math.round(step.seconds) + 's' : '–');
    const last = cur >= iv.length - 1;
    let h = '<div class="wo-iv"><div class="wo-iv-cur wo-iv-' + step.kind + '"><div class="wo-iv-lab">' + esc(step.label) + '</div>' +
      '<div class="wo-iv-time" id="woTimer">' + remTxt + '</div>' +
      '<button class="btn cta" onclick="ORVIA.workoutUI.nextInterval()"><span class="cta-txt"><span class="cta-main">' + (last ? 'Intervalle abschließen' : 'Schritt abschließen ›') + '</span></span></button></div>';
    h += '<div class="wo-iv-list">' + iv.map((s, i) => '<div class="wo-iv-row ' + (i === cur ? 'on' : (i < cur ? 'done' : '')) + '"><span>' + esc(s.label) + '</span><span class="muted">' + Math.round(s.seconds) + 's</span></div>').join('') + '</div></div>';
    return h;
  }
  O.workoutUI.openIntervalBuilder = function () {
    openSheet('<h3 class="wo-sheet-t">Intervalle planen</h3>' +
      '<div class="wo-inrow"><label>Warm-up (min)<input type="number" inputmode="numeric" id="ivWu" value="10"></label>' +
      '<label>Cool-down (min)<input type="number" inputmode="numeric" id="ivCd" value="10"></label></div>' +
      '<div class="wo-inrow"><label>Wiederh.<input type="number" inputmode="numeric" id="ivReps" value="6"></label>' +
      '<label>Belastung (s)<input type="number" inputmode="numeric" id="ivWork" value="180"></label>' +
      '<label>Erholung (s)<input type="number" inputmode="numeric" id="ivRec" value="120"></label></div>' +
      '<button class="wo-sheet-btn primary" onclick="ORVIA.workoutUI.applyIntervals()">Übernehmen & starten</button>' +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Zurück</button>');
  };
  function _ivNum(id) { const e = document.getElementById(id); return e ? +e.value : 0; }
  O.workoutUI.applyIntervals = function () {
    if (typeof Calc === 'undefined' || !Calc.buildIntervals) { closeSheet(); return; }
    const steps = Calc.buildIntervals({ warmupMin: _ivNum('ivWu'), reps: _ivNum('ivReps'), workSec: _ivNum('ivWork'), recoverSec: _ivNum('ivRec'), cooldownMin: _ivNum('ivCd') });
    O.workoutUI._intervals = steps; O.workoutUI._ivIdx = 0;
    closeSheet();
    if (steps.length) WS().startRestTimer(steps[0].seconds);
    renderOverlay();
  };
  O.workoutUI.nextInterval = function () {
    const iv = O.workoutUI._intervals; if (!iv || !iv.length) return;
    let i = (O.workoutUI._ivIdx || 0) + 1;
    if (i >= iv.length) { O.workoutUI._intervals = null; O.workoutUI._ivIdx = 0; WS().skipRest(); toastIt('Intervalle abgeschlossen'); renderOverlay(); return; }
    O.workoutUI._ivIdx = i; WS().startRestTimer(iv[i].seconds); renderOverlay();
  };

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
    // Sport vor dem Beenden merken (Store leert die Session danach); Distanzfeld für Distanzsportarten.
    const sp = (st().session && st().session.sport) || null;
    O.workoutUI._finishSport = sp;
    const distSport = isDistanceSport(sp);
    const unit = sp === 'Schwimmen' ? 'm' : 'km';
    const live = (function () { const el = document.getElementById('woLiveDist'); if (el && el.value !== '') return el.value; return O.workoutUI._liveDist != null ? O.workoutUI._liveDist : ''; })();
    const grid = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => '<button class="wo-rpe" data-n="' + n + '" onclick="ORVIA.workoutUI._rpePick(' + n + ')">' + n + '</button>').join('');
    openSheet('<h3 class="wo-sheet-t">Training beenden</h3>' +
      (distSport ? '<div class="wo-inrow" style="margin-bottom:8px"><label>Distanz (' + unit + ')<input type="number" inputmode="decimal" id="woFinishDist" value="' + live + '" placeholder="z. B. 8"></label></div>' : '') +
      '<p class="wo-sheet-p">Wie anstrengend war die Einheit? (optional)</p>' +
      '<div class="wo-rpe-grid">' + grid + '</div><div class="wo-rpe-hint">1 = sehr leicht · 10 = maximal</div>' +
      '<button class="wo-sheet-btn primary" id="woFinishBtn" onclick="ORVIA.workoutUI._doFinish(false)">Training beenden</button>' +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI._doFinish(true)">Ohne Bewertung beenden</button>' +
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
    if (!r.success) { all.forEach(b => b.disabled = false); if (btn) btn.textContent = 'Training beenden'; try { console.error('[finish]', r.error); } catch (e) {} toastIt('Training konnte nicht beendet werden. Fehlercode: ' + ((r.error && r.error.code) || 'unbekannt')); return; }
    // Distanz aus dem Abschluss-Sheet (oder Live-Eingabe) übernehmen.
    let distKm = null; { const de = document.getElementById('woFinishDist'); if (de && de.value !== '') { const n = parseFloat(String(de.value).replace(',', '.')); if (!isNaN(n)) distKm = n; } else if (O.workoutUI._liveDist != null) distKm = O.workoutUI._liveDist; }
    recordLiveToActivity(r.data, distKm);   // SSOT: in die lokale Aktivitätsquelle übernehmen (Insights/Plan/Heute)
    O.workoutUI._liveDist = null; O.workoutUI._finishSport = null;
    closeSheet();
    const ls = r.data && r.data.loadStatus;
    toastIt('Training beendet ✓' + (ls === 'load_error' ? ' (Last nicht gespeichert)' : ''));
    O.workoutUI.close();
  };
  // Single Source of Truth: abgeschlossenes Live-Training in DB[heute].sessions spiegeln,
  // damit Insights/Wochenplan/Streaks/Heute es zählen. Marker für spätere Import-Dedup (F3).
  function recordLiveToActivity(d, distKm) {
    if (!d || !d.completed) return;
    try {
      if (typeof entry !== 'function' || typeof todayStr !== 'function') return;
      /* R1.1: kanonisches Mapping statt Whitelist-Kollaps — die Sportidentität
         (sportId) bleibt durch Tagesprojektion/Verlauf/Load erhalten. */
      const AC = O.activityConfig;
      const map = (AC && typeof AC.legacySessionKey === 'function') ? AC.legacySessionKey(d.sport) : null;
      const type = map ? map.key : (String(d.sport || '').trim() || 'Aktivität');
      const e = entry(todayStr()); e.sessions = e.sessions || {};
      const existing = e.sessions[type] || {};
      const merged = Object.assign({}, existing, {
        dur: d.durationMin != null ? d.durationMin : existing.dur,
        rpe: d.sessionRpe != null ? d.sessionRpe : existing.rpe,
        source: 'live', sportId: (map && map.sportId) || existing.sportId || null,
        workoutSessionId: d.sessionId || existing.workoutSessionId || null,
        clientSessionId: d.clientSessionId || existing.clientSessionId || null
      });
      if (distKm != null && distKm > 0) merged.dist = (type === 'Schwimmen') ? Math.round(distKm) : distKm; // Schwimmen in Metern
      e.sessions[type] = merged; e.sessions._ts = Date.now();
      // savePost() löscht Session-Keys, die nicht in activeTypes sind — neuen Key schützen.
      try { if (typeof activeTypes !== 'undefined' && activeTypes && activeTypes.add) activeTypes.add(type); } catch (_) {}
      if (typeof save === 'function') save();
    } catch (e) { try { console.error('[ssot record]', e); } catch (_) {} }
  }
  O.workoutUI.resume = function () { WS().resumeWorkout(); renderOverlay(); };

  // Optionen-Sheet (ersetzt Zahlen-Prompt). Destruktive Aktionen mit zweiter Bestätigung.
  O.workoutUI.menu = function () {
    const paused = WS().isPaused();
    openSheet('<h3 class="wo-sheet-t">Trainings-Optionen</h3>' +
      '<button class="wo-sheet-btn" onclick="ORVIA.workoutUI._optPause()">' + (paused ? 'Training fortsetzen' : 'Training pausieren') + '</button>' +
      '<button class="wo-sheet-btn" onclick="ORVIA.workoutUI._optAbort()">Training abbrechen (im Verlauf behalten)</button>' +
      '<button class="wo-sheet-btn danger" onclick="ORVIA.workoutUI._optDelete()">Training verwerfen (löschen)</button>' +
      '<button class="wo-sheet-btn ghost" onclick="ORVIA.workoutUI.closeSheet()">Schließen</button>');
  };
  O.workoutUI._optPause = function () { const paused = WS().isPaused(); if (paused) { WS().resumeWorkout(); toastIt('Fortgesetzt'); } else { WS().pauseWorkout(); toastIt('Pausiert – Dauer steht still'); } closeSheet(); renderOverlay(); };
  O.workoutUI._optAbort = async function () {
    const okc = await confirmSheet('Training abbrechen?', 'Die Einheit bleibt im Verlauf als „abgebrochen" erhalten.', 'Training abbrechen', 'Weiter trainieren', true);
    if (!okc) return;
    const r = await WS().cancelWorkout('aborted', 'abgebrochen');
    if (!r.success) { try { console.error('[abort]', r.error); } catch (e) {} toastIt('Workout konnte nicht beendet werden. Fehlercode: ' + ((r.error && r.error.code) || 'unbekannt')); return; }
    toastIt('Workout abgebrochen'); O.workoutUI.close();
  };
  O.workoutUI._optDelete = async function () {
    const okc = await confirmSheet('Training wirklich verwerfen?', 'Die bisher erfassten Trainingsdaten dieser Einheit werden dauerhaft gelöscht.', 'Training verwerfen', 'Weiter trainieren', true);
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
