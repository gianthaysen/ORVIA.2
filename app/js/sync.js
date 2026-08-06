/* ============================================================
   ORVIA · Cloud-Sync  (Phase 1)
   Verlustfreier JSONB-Snapshot des App-Status ↔ Supabase (Tabelle app_state).
   Strategie: Last-Write-Wins auf Snapshot-Ebene + Migrations-Dialog beim
   ersten Login. Multi-Device-Feinmerge ist als spätere Runde markiert (TODO).
   Funktioniert nur, wenn auth.js einen Client + Session gesetzt hat (window.ORVIA.sb/user).
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  O.syncState = O.syncState || 'local';

  const KEYS = ['gian_checkins_v2', 'orvia_profile_v1', 'orvia_consent'];
  const DB_KEY = 'gian_checkins_v2';
  let pushTimer = null;

  function deviceId() {
    try {
      let d = localStorage.getItem('orvia_device');
      if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : 'd' + Date.now() + Math.random()); localStorage.setItem('orvia_device', d); }
      return d;
    } catch (e) { return 'unknown'; }
  }

  function snapshot() {
    const out = { schema: 1, keys: {}, savedAt: Date.now() };
    KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v != null) out.keys[k] = v; } catch (e) {} });
    return out;
  }

  function applySnapshot(data) {
    if (!data || !data.keys) return;
    Object.keys(data.keys).forEach(k => { try { localStorage.setItem(k, data.keys[k]); } catch (e) {} });
    try { if (typeof load === 'function') DB = load(); } catch (e) {}
    try { if (typeof loadProfile === 'function') { const p = loadProfile(); if (p) PROFILE = p; } } catch (e) {}
    markClean();
    rerender();
  }

  function rerender() {
    try { if (typeof renderDay === 'function') renderDay(); } catch (e) {}
    try { if (typeof renderProfileScreen === 'function') renderProfileScreen(); } catch (e) {}
    try { if (typeof renderAccountCard === 'function') renderAccountCard(); } catch (e) {}
  }

  function countLocalDays() {
    try {
      const raw = localStorage.getItem(DB_KEY); if (!raw) return 0;
      const d = JSON.parse(raw);
      return Object.keys(d).filter(k => (typeof isDay === 'function' ? isDay(k) : /^\d{4}-\d{2}-\d{2}$/.test(k))).length;
    } catch (e) { return 0; }
  }

  /* ---- Sync-Status-Anzeige ---- */
  const LABELS = {
    local:   ['Lokaler Modus',        'muted'],
    synced:  ['Synchronisiert',       'ok'],
    pending: ['Sync läuft …',         'warn'],
    error:   ['Sync-Fehler',          'err'],
    offline: ['Offline – lokal',      'warn']
  };
  function setState(s, msg) {
    O.syncState = s;
    const el = document.getElementById('syncBadge');
    if (el) { const m = LABELS[s] || LABELS.local; el.textContent = msg || m[0]; el.className = 'syncbadge ' + m[1]; }
    try { if (typeof renderAccountCard === 'function') renderAccountCard(); } catch (e) {}
  }
  window.orviaSetSyncState = setState;
  window.orviaSyncState = () => O.syncState;

  /* ---- Push (debounced, an save() gehängt) ---- */
  function markRev(r) { try { if (r != null) localStorage.setItem('orvia_sync_rev', String(r)); } catch (e) {} }
  /* GM7.6 Cloud-Autoload: 'orvia_local_dirty' markiert lokale Aenderungen seit dem letzten
     bestaetigten Sync-Punkt. Nur damit kann start() beim naechsten Login unterscheiden
     zwischen 'nichts Offenes -> Cloud automatisch laden' und 'lokal hat Vorrang -> zuerst
     sichern'. Wird bei jedem Save gesetzt (schedulePush) und erst nach einem BESTAETIGTEN
     push()/pull() wieder geloescht. */
  function markDirty() { try { localStorage.setItem('orvia_local_dirty', '1'); } catch (e) {} }
  function markClean() { try { localStorage.removeItem('orvia_local_dirty'); } catch (e) {} }
  function isLocalDirty() { try { return localStorage.getItem('orvia_local_dirty') === '1'; } catch (e) { return false; } }
  window.orviaIsLocalDirty = isLocalDirty;

  async function push() {
    const sb = O.sb, u = O.user;
    if (!sb || !u) { setState('local'); return; }
    if (!navigator.onLine) { setState('offline'); return; }
    setState('pending');
    try {
      const snap = snapshot();
      const { error } = await sb.from('app_state').upsert(
        { user_id: u.id, data: snap, device_id: deviceId() }, { onConflict: 'user_id' });
      if (error) throw error;
      markRev(snap.savedAt);
      markClean();
      // Eigentümer der lokalen Daten festschreiben → verhindert, dass beim nächsten
      // Login eines ANDEREN Nutzers diese Daten in dessen Konto gepusht werden.
      try { localStorage.setItem('orvia_data_owner', u.id); } catch (e) {}
      setState('synced');
    } catch (e) { console.error('[ORVIA sync] push', e); setState('error'); }
  }
  function schedulePush() {
    markDirty();
    if (!O.sb || !O.user) return;
    clearTimeout(pushTimer); setState('pending');
    pushTimer = setTimeout(push, 1500);
  }
  window.orviaSchedulePush = schedulePush;
  window.ORVIA_onSave = schedulePush;       // wird von data.js save() aufgerufen

  /* ---- Start: Pull + ggf. Migrationsdialog ---- */
  // Beim Kontowechsel ALLE nutzerbezogenen Keys löschen (außer geräte-/flow-weite),
  // damit keine fremden Daten in ein anderes Konto gelangen.
  /* DATENVERLUST-FIX (2026-08-06, gemeldet als „die Sätze verschwinden, wenn ich die App
     neulade / die Dateien austausche").

     BEFUND: Diese Funktion löschte JEDEN localStorage-Key mit dem Präfix `orvia_` —
     also auch `orvia_activities_<NUTZER-ID>`, in dem die Übungs- und Satzdetails
     abgeschlossener Workouts liegen (workoutSnapshot). Die Sätze existieren dort
     zunächst NUR lokal; serverseitig liegen sie in eigenen Tabellen, die dieser
     Datensatz nicht mitführt. Wurde der Pfad ausgelöst, waren sie unwiederbringlich
     weg, während die Aktivität selbst später vom Server zurückkam — genau das Bild
     „Aktivität da, Sätze fehlen".

     Ausgelöst wird der Pfad von applyUserScope bei JEDEM Start, sobald
     `orvia_active_user` oder `orvia_data_owner` nicht zur aktuellen Nutzer-ID passt.
     Das kann auch ohne echten Kontowechsel passieren: `orvia_data_owner` wird nur in
     bestimmten Zweigen gesetzt, und `clearLocalUserData` löscht ihn selbst mit —
     ein einmal entstandener Mismatch überlebt damit Reloads.

     FIX: Der Zweck bleibt unverändert — FREMDE Daten dürfen nie in ein anderes Konto
     gelangen. Aber Keys, die die ID des GERADE ANGEMELDETEN Nutzers tragen, gehören
     per Konstruktion diesem Nutzer und werden verschont. Alles ohne erkennbare
     Zuordnung wird weiterhin gelöscht (fail-safe in Richtung Datenschutz).
     Belegt in supabase/tests/sets_survive_reload_test.mjs. */
  function clearLocalUserData(currentUserId) {
    var keep = { orvia_device: 1, orvia_active_user: 1, orvia_onboard_pending: 1 };
    var mine = currentUserId ? String(currentUserId) : null;
    try {
      var del = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || keep[k]) continue;
        /* Nutzergebundener Key des AKTUELLEN Kontos (…_<uid>) ⇒ behalten. */
        if (mine && k.length > mine.length + 1 && k.slice(-(mine.length + 1)) === '_' + mine) continue;
        if (k.indexOf('orvia_') === 0 || k === 'gian_checkins_v2') del.push(k);
      }
      del.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) {}
    try { if (typeof load === 'function') DB = load(); } catch (e) {}
    try { PROFILE = null; if (typeof ensureProfile === 'function') ensureProfile(); } catch (e) {}
    // Profil-Mapped-Felder (user_profiles) zusätzlich neutralisieren — kein Fremd-Default sichtbar.
    try { if (window.ORVIA && window.ORVIA.profileStore) window.ORVIA.profileStore.clear(); } catch (e) {}
    // Tagesentscheidungs-Cache leeren — der Key ist nur das Datum, sonst könnte beim Kontowechsel
    // (gleicher Tag) der Score/die Entscheidung des vorherigen Nutzers sichtbar bleiben.
    try { if (typeof invalidateDecision === 'function') invalidateDecision(); } catch (e) {}
    // Phase-3-Caches (Readiness-Verlauf + Baseline-Status) des vorherigen Nutzers leeren.
    try { if (window.ORVIA) { window.ORVIA.readinessHistory = {}; window.ORVIA.baselineState = { status: 'insufficient', validDays: 0, perMetric: {} }; } } catch (e) {}
    // Phase-4.2: aktive Live-Workout-Kopie + State des vorherigen Nutzers leeren (kein Fremddaten-Übertrag).
    try { if (window.ORVIA && window.ORVIA.workoutStore) window.ORVIA.workoutStore.clearForUserSwitch(); } catch (e) {}
  }
  function applyUserScope(userId) {
    try {
      var prev = localStorage.getItem('orvia_active_user');
      var owner = localStorage.getItem('orvia_data_owner');
      // Bei aktivem Nutzerwechsel ODER fremdem Daten-Eigentümer (z.B. fehlender
      // active_user nach iOS-Eviction): lokale Daten löschen, bevor irgendetwas rendert/synct.
      if ((prev && prev !== userId) || (owner && owner !== userId)) clearLocalUserData(userId);
      localStorage.setItem('orvia_active_user', userId);
      /* Den Eigentuemer direkt mitschreiben. Vorher konnte er fehlen (er wurde nur
         gesetzt, wenn bereits Tagesdaten existierten) — ein fehlender Eintrag fuehrte
         beim naechsten Start erneut in den Loeschpfad. */
      if (userId) localStorage.setItem('orvia_data_owner', userId);
    } catch (e) {}
  }
  window.orviaClearLocal = clearLocalUserData;
  window.orviaApplyUserScope = applyUserScope;

  async function start() {
    const sb = O.sb, u = O.user;
    if (!sb || !u) return;
    if (start._busy) return;   // INCIDENT-FIX: Doppelaufruf (getSession + SIGNED_IN) erzeugte gestapelte Dialoge
    start._busy = true;
    try { return await _startInner(sb, u); } finally { start._busy = false; }
  }
  async function _startInner(sb, u) {
    setState('pending');
    // Lokale Daten sind fuer das aktive Geraet MASSGEBLICH, solange nicht klar ist, ob die
    // Cloud einen ECHTEN neueren Stand von einem anderen Geraet hat. Cloud wird ohne
    // Rueckfrage geladen, wenn lokal LEER ist ODER lokal keine unuebertragenen Aenderungen
    // hat (Punkt 1 der Cloud-Autoload-Regel). Gibt es lokale Aenderungen, werden sie ZUERST
    // ueber den bestehenden kanonischen Push gesichert, dann wird frisch geladen (Punkt 2+3).
    // Ein Dialog erscheint nur noch bei einem technischen Fehler waehrend dieses Ablaufs
    // (Punkt 4) — nie mehr routinemaessig bei jedem Start.
    if (countLocalDays() > 0) {
      var owner = null; try { owner = localStorage.getItem('orvia_data_owner'); } catch (e) {}
      if (owner && owner !== u.id) {
        // Fremde lokale Daten — NIEMALS in dieses Konto pushen. Löschen, dann Cloud laden.
        // Die auf u.id lautenden Keys gehoeren diesem Konto und bleiben (2026-08-06).
        clearLocalUserData(u.id);
      } else {
        try { localStorage.setItem('orvia_data_owner', u.id); } catch (e) {}
        /* INCIDENT-FIX (2026-07-11): Die reine Rev-Ungleichheit erzeugte auf iOS einen
           DAUER-DIALOG — beim App-Schliessen stirbt der JS-Kontext oft, bevor markRev
           nach dem letzten Push gespeichert ist; die App hielt dann ihre EIGENEN
           Cloud-Daten fuer fremd. Robuste Regel bleibt:
           - remote.device_id === dieses Geraet  → kein fremder Stand, push.
           - remote NUMERISCH neuer als knownRev UND fremdes Geraet → echter Abgleich noetig.
           - sonst (Cloud aelter/gleich = eigener alter/haengender Push) → push. */
        let remote0 = null;
        try {
          const { data, error } = await sb.from('app_state').select('data,updated_at,device_id').eq('user_id', u.id).maybeSingle();
          if (error) throw error;
          remote0 = data;
        } catch (e) {
          // offline/Fehler → lokal weiterarbeiten, kein Datenverlust; naechster Online-Trigger versucht erneut.
          setState(navigator.onLine ? 'error' : 'offline');
          return;
        }
        const remoteHas0 = remote0 && remote0.data && remote0.data.keys && remote0.data.keys[DB_KEY];
        let knownRev = 0; try { knownRev = Number(localStorage.getItem('orvia_sync_rev') || 0) || 0; } catch (e) {}
        const remoteRev = remoteHas0 ? (Number(remote0.data.savedAt || 0) || 0) : 0;
        const remoteDevice = remote0 && remote0.device_id ? String(remote0.device_id) : null;
        const isOwnDevice = remoteDevice && remoteDevice === deviceId();
        const cloudIsNewer = remoteHas0 && !isOwnDevice && remoteRev > knownRev;

        if (!cloudIsNewer) { await push(); return; }

        if (!isLocalDirty()) {
          // Punkt 1: keine unuebertragenen lokalen Aenderungen -> neueren Cloud-Stand
          // automatisch laden, ohne Rueckfrage.
          applySnapshot(remote0.data); markRev(String(remote0.data.savedAt || '')); setState('synced');
          return;
        }

        // Punkt 2+3: lokale Aenderungen vorhanden UND Cloud ist von einem anderen Geraet
        // neuer. Zuerst verlustfrei ueber den bestehenden kanonischen Push sichern, danach
        // den aktuellen Cloud-Stand erneut laden und die UI vollstaendig aktualisieren.
        try {
          await push();
          const { data: data2, error: err2 } = await sb.from('app_state').select('data,updated_at').eq('user_id', u.id).maybeSingle();
          if (err2) throw err2;
          if (data2 && data2.data && data2.data.keys && data2.data.keys[DB_KEY]) {
            applySnapshot(data2.data); markRev(String(data2.data.savedAt || ''));
          }
          setState('synced');
        } catch (e) {
          // Punkt 4: tatsaechlich nicht automatisch loesbar (technischer Fehler beim
          // Zusammenfuehren) -> ehrlicher Hinweis statt stillem Datenverlust in eine Richtung.
          console.error('[ORVIA sync] auto-merge', e);
          syncErrorPrompt();
        }
        return;
      }
    }
    let remote = null;
    try {
      const { data, error } = await sb.from('app_state').select('data,updated_at').eq('user_id', u.id).maybeSingle();
      if (error) throw error;
      remote = data;
    } catch (e) { console.error('[ORVIA sync] pull', e); setState('error'); return; }
    const remoteHas = remote && remote.data && remote.data.keys && remote.data.keys[DB_KEY];
    if (remoteHas) { applySnapshot(remote.data); markRev(String(remote.data.savedAt || '')); setState('synced'); return; }
    setState('synced');
  }
  window.orviaSyncStart = start;
  // Sofortiger Push (ohne Debounce) — beim App-Schließen/Backgrounden aufrufen.
  window.orviaFlushSync = function () { try { clearTimeout(pushTimer); } catch (e) {} if (O.sb && O.user && navigator.onLine) push(); };

  /* ---- Fehleranzeige: automatisches Zusammenfuehren technisch fehlgeschlagen ----
     GM7.6 Cloud-Autoload: kein Routine-Dialog mehr bei jedem Start (Punkt 1–3 laufen
     automatisch). Dieser Dialog erscheint NUR noch, wenn der automatische Push-dann-
     Neuladen-Ablauf technisch scheitert (Punkt 4) — lokale Daten bleiben in jedem Fall
     unangetastet, es wird nichts blind ueberschrieben. */
  function syncErrorPrompt() {
    // SINGLETON — ein zweiter Aufruf ersetzt den Dialog, statt ihn zu stapeln.
    if (window._orviaSyncErrModal) { try { window._orviaSyncErrModal.remove(); } catch (e) {} window._orviaSyncErrModal = null; }
    setState('error', 'Sync-Fehler');
    const wrap = document.createElement('div');
    wrap.className = 'orvia-modal-bg';
    wrap.innerHTML =
      '<div class="orvia-modal">' +
        '<div class="om-ic">⚠</div>' +
        '<h3>Automatisches Zusammenführen nicht möglich</h3>' +
        '<p>Deine lokalen Daten bleiben unverändert und sicher. Der automatische Abgleich mit der Cloud ist gerade technisch fehlgeschlagen (z. B. Netzwerk).</p>' +
        '<button class="btn" id="oeRetry">Erneut versuchen</button>' +
        '<button class="btn sec" id="oeDismiss" style="margin-top:10px">Später — lokal weiterarbeiten</button>' +
      '</div>';
    document.body.appendChild(wrap);
    window._orviaSyncErrModal = wrap;
    const close = () => { try { wrap.remove(); } catch (e) {} window._orviaSyncErrModal = null; };
    wrap.querySelector('#oeRetry').onclick = () => { close(); start(); };
    wrap.querySelector('#oeDismiss').onclick = () => { close(); setState('error'); };
  }

  /* ---- Netzstatus ---- */
  // Voller Abgleich statt Blind-Push: nach einer Offline-Phase koennte die Cloud von einem
  // anderen Geraet aus neuer sein — start() prueft das (Punkt 1–4), statt blind zu pushen.
  window.addEventListener('online',  () => { if (O.sb && O.user) start(); });
  window.addEventListener('offline', () => { if (O.sb && O.user) setState('offline'); });
})();
