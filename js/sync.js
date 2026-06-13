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
  async function push() {
    const sb = O.sb, u = O.user;
    if (!sb || !u) { setState('local'); return; }
    if (!navigator.onLine) { setState('offline'); return; }
    setState('pending');
    try {
      const { error } = await sb.from('app_state').upsert(
        { user_id: u.id, data: snapshot(), device_id: deviceId() }, { onConflict: 'user_id' });
      if (error) throw error;
      setState('synced');
    } catch (e) { console.error('[ORVIA sync] push', e); setState('error'); }
  }
  function schedulePush() {
    if (!O.sb || !O.user) return;
    clearTimeout(pushTimer); setState('pending');
    pushTimer = setTimeout(push, 1500);
  }
  window.orviaSchedulePush = schedulePush;
  window.ORVIA_onSave = schedulePush;       // wird von data.js save() aufgerufen

  /* ---- Start: Pull + ggf. Migrationsdialog ---- */
  function clearLocalUserData() {
    ['gian_checkins_v2', 'orvia_profile_v1', 'orvia_consent', 'orvia_pending_invite'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    try { if (typeof load === 'function') DB = load(); } catch (e) {}
    try { PROFILE = null; if (typeof ensureProfile === 'function') ensureProfile(); } catch (e) {}
  }
  window.orviaClearLocal = clearLocalUserData;

  async function start() {
    const sb = O.sb, u = O.user;
    if (!sb || !u) return;
    // Kontowechsel auf diesem Gerät? Lokale Daten gehören dann einem anderen Account
    // (liegen in dessen Cloud) → verwerfen, damit sie nicht ins neue Konto gemischt werden.
    try {
      const prev = localStorage.getItem('orvia_active_user');
      if (prev && prev !== u.id) clearLocalUserData();
      localStorage.setItem('orvia_active_user', u.id);
    } catch (e) {}
    setState('pending');
    let remote = null;
    try {
      const { data, error } = await sb.from('app_state').select('data,updated_at').eq('user_id', u.id).maybeSingle();
      if (error) throw error;
      remote = data;
    } catch (e) { console.error('[ORVIA sync] pull', e); setState('error'); return; }

    const localDays = countLocalDays();
    const remoteHas = remote && remote.data && remote.data.keys && remote.data.keys[DB_KEY];

    if (remoteHas && localDays === 0) { applySnapshot(remote.data); setState('synced'); return; }
    if (remoteHas && localDays > 0)   { migratePrompt(remote.data); return; }
    await push();   // Cloud leer → lokale Daten hochladen
  }
  window.orviaSyncStart = start;

  /* ---- Migrationsdialog (lokale Daten vs. Cloud) ---- */
  function migratePrompt(remoteData) {
    setState('pending', 'Entscheidung nötig');
    const n = countLocalDays();
    const wrap = document.createElement('div');
    wrap.className = 'orvia-modal-bg';
    wrap.innerHTML =
      '<div class="orvia-modal">' +
        '<div class="om-ic">↯</div>' +
        '<h3>Lokale Daten gefunden</h3>' +
        '<p>Auf diesem Gerät liegen <b>' + n + ' Tage</b> mit Daten, und dein Account hat bereits Cloud-Daten. Was möchtest du tun?</p>' +
        '<button class="btn" id="omLocal">Lokale Daten übernehmen</button>' +
        '<button class="btn sec" id="omCloud" style="margin-top:10px">Cloud-Daten laden</button>' +
        '<p class="om-note">„Lokale übernehmen" überschreibt die Cloud mit diesem Gerät. „Cloud laden" ersetzt die lokalen Daten. Vorher liegt automatisch ein lokales Backup im Profil-Export.</p>' +
      '</div>';
    document.body.appendChild(wrap);
    const close = () => { try { wrap.remove(); } catch (e) {} };
    wrap.querySelector('#omLocal').onclick = async () => { close(); await push(); };
    wrap.querySelector('#omCloud').onclick = () => { close(); applySnapshot(remoteData); setState('synced'); };
  }

  /* ---- Netzstatus ---- */
  window.addEventListener('online',  () => { if (O.sb && O.user) push(); });
  window.addEventListener('offline', () => { if (O.sb && O.user) setState('offline'); });
})();
