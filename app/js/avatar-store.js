/* ============================================================
   ORVIA · avatar-store — Profilbild mit serverseitiger Source of Truth (0016).
   Vorher: Avatar war Base64 im lokalen Geräte-Blob (PROFILE.avatar) OHNE Sync-Kanal
   → jedes Gerät zeigte ein anderes Bild (Incident 2026-07-15).
   Jetzt:
   - Supabase Storage, PRIVATER Bucket 'avatars', Pfad strikt {userId}/profile.jpg.
   - user_profiles.avatar_path referenziert das Bild (synct über profile-store MAPPED).
   - Anzeige lädt auf allen Geräten dieselbe Serverquelle (signierte URL, 50-min-Cache).
   - Lokales Base64 (PROFILE.avatar) bleibt NUR als sofortige lokale Vorschau/Offline-
     Fallback; Migration lädt es kontrolliert einmalig hoch (idempotent, fester Pfad,
     nur für den bestätigten aktuellen Nutzer).
   Ergebnisformat wie überall: { success, data, error, source, sync_status }.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;

  const BUCKET = 'avatars';
  const SIGN_TTL_S = 3600;             // Storage-Signatur 60 min …
  const CACHE_TTL_MS = 50 * 60e3;      // … Client erneuert nach 50 min
  let _signed = { path: null, url: null, at: 0 };

  function res(success, data, error, source, sync_status) {
    return { success: success, data: data == null ? null : data, error: error || null, source: source, sync_status: sync_status };
  }
  function uid() { return (O.user && O.user.id) || null; }
  function avatarPath() { return uid() ? uid() + '/profile.jpg' : null; }
  function online() { return !(O.repoBase && O.repoBase.online && O.repoBase.online() === false); }

  function dataUrlToBlob(dataUrl) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(String(dataUrl || ''));
    if (!m) return null;
    try {
      const bin = atob(m[2]); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: m[1] });
    } catch (e) { return null; }
  }

  /* Upload des (bereits client-seitig auf ≤240px beschnittenen) Bildes.
     Erst nach BESTÄTIGTEM Upload wird avatar_path persistiert — kein Schein-Sync. */
  async function upload(dataUrl) {
    if (!uid()) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');
    if (!O.sb || !O.sb.storage) return res(false, null, { message: 'Storage nicht verfügbar' }, 'empty', 'failed');
    if (!online()) return res(false, null, { code: 'offline', message: 'Offline — Bild wird lokal angezeigt und beim nächsten Login hochgeladen.' }, 'indexeddb', 'pending');
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return res(false, null, { message: 'Bilddaten ungültig' }, 'empty', 'failed');
    const path = avatarPath();
    try {
      const { error } = await O.sb.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg', cacheControl: '3600' });
      if (error) return res(false, null, { code: 'upload_failed', message: error.message }, 'supabase', 'failed');
      _signed = { path: null, url: null, at: 0 };   // Signatur-Cache invalidieren (neues Bild)
      // Pfad in der Profilzeile persistieren (Server-SoT); erst Erfolg = synchronisiert.
      if (typeof PROFILE !== 'undefined' && PROFILE) PROFILE.avatarPath = path;
      let p = { success: true };
      try { if (O.profileStore && O.profileStore.persist) p = await O.profileStore.persist(); } catch (e) { p = { success: false }; }
      if (typeof saveProfile === 'function') { try { saveProfile(); } catch (e) {} }
      if (!p.success) return res(false, { path: path }, { code: 'path_persist_failed', message: 'Bild hochgeladen, Profilzeile nicht bestätigt.' }, 'supabase', 'failed');
      return res(true, { path: path }, null, 'supabase', 'synced');
    } catch (e) { return res(false, null, { code: 'exception', message: String(e && e.message || e) }, 'supabase', 'failed'); }
  }

  /* Signierte Anzeige-URL (gecacht). Erfolg → Cache; Fehler → null (Aufrufer fällt auf Base64 zurück). */
  async function refreshDisplayUrl() {
    const p = (typeof PROFILE !== 'undefined' && PROFILE && PROFILE.avatarPath) || null;
    if (!p || !uid() || !O.sb || !O.sb.storage || !online()) return null;
    if (_signed.url && _signed.path === p && (Date.now() - _signed.at) < CACHE_TTL_MS) return _signed.url;
    try {
      const { data, error } = await O.sb.storage.from(BUCKET).createSignedUrl(p, SIGN_TTL_S);
      if (error || !data || !data.signedUrl) return null;
      _signed = { path: p, url: data.signedUrl, at: Date.now() };
      return _signed.url;
    } catch (e) { return null; }
  }

  /* Synchrone Quelle für Renderer: 1) gecachte signierte URL (Server-SoT),
     2) lokales Base64 (Vorschau/Offline). */
  function currentSrc() {
    const p = (typeof PROFILE !== 'undefined' && PROFILE) ? PROFILE : {};
    if (_signed.url && _signed.path === p.avatarPath && (Date.now() - _signed.at) < CACHE_TTL_MS) return _signed.url;
    return p.avatar || null;
  }

  /* Nach Login: 1) signierte URL vorladen (Cross-Device-Anzeige), 2) kontrollierte
     Einmal-Migration eines lokalen Base64-Bilds, wenn serverseitig noch keins existiert.
     Konflikte (Server hat bereits ein Bild) werden NICHT still überschrieben — Server gewinnt. */
  async function hydrate() {
    if (!uid()) return res(true, null, null, 'empty', 'synced');
    const p = (typeof PROFILE !== 'undefined' && PROFILE) ? PROFILE : {};
    if (p.avatarPath) {
      const url = await refreshDisplayUrl();
      if (url) {
        try { if (typeof renderTopAvatar === 'function') renderTopAvatar(); } catch (e) {}
        try { if (typeof renderProfileScreen === 'function') renderProfileScreen(); } catch (e) {}
      }
      return res(true, { url: url }, null, url ? 'supabase' : 'empty', 'synced');
    }
    if (p.avatar && String(p.avatar).indexOf('data:') === 0 && online()) {
      const r = await upload(p.avatar);
      if (!r.success) try { console.warn('[ORVIA avatar] Migration des lokalen Profilbilds fehlgeschlagen (bleibt lokal).', r.error && r.error.message); } catch (e) {}
      else { await refreshDisplayUrl(); try { console.log('[ORVIA avatar] Lokales Profilbild in Storage migriert:', r.data.path); } catch (e) {} }
      return r;
    }
    return res(true, null, null, 'empty', 'synced');
  }

  O.avatarStore = { upload, hydrate, refreshDisplayUrl, currentSrc, avatarPath, _dataUrlToBlob: dataUrlToBlob };
})();
