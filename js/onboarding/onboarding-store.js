/* ============================================================
   ORVIA · onboarding-store — NUR lokale Draft-Persistenz (v2). Kein Server, kein gerätü.
   Nutzerspezifischer Key; beschädigte/veraltete Drafts werden archiviert statt blind verwendet.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  function logic() { return O.onboardingV2Logic; }
  function ls() { try { return root.localStorage; } catch (e) { return null; } }

  function key(userId) { return 'orvia_onboarding_v2:' + (userId || 'anonymous'); }
  function backupKey(userId) { return key(userId) + ':backup'; }

  function save(userId, draft) {
    var s = ls(); if (!s) return false;
    try { s.setItem(key(userId), JSON.stringify(draft)); return true; } catch (e) { return false; }
  }
  function clear(userId) { var s = ls(); if (!s) return; try { s.removeItem(key(userId)); } catch (e) {} }

  function archiveCorrupt(s, userId, raw) {
    try { s.setItem(backupKey(userId), raw == null ? '' : String(raw)); s.removeItem(key(userId)); } catch (e) {}
  }

  // Rückgabe: null (kein Draft) · {corrupt:true,draft:null} (kaputt/falsche Version, archiviert)
  // · {corrupt:false,draft} (gültig, normalisiert). Wirft NIE.
  function load(userId) {
    var s = ls(); if (!s) return null;
    var raw = null; try { raw = s.getItem(key(userId)); } catch (e) { return null; }
    if (raw == null) return null;
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { archiveCorrupt(s, userId, raw); return { corrupt: true, draft: null }; }
    try {
      var l = logic();
      if (!l || typeof l.normalizeDraft !== 'function') { archiveCorrupt(s, userId, raw); return { corrupt: true, draft: null }; }
      var norm = l.normalizeDraft(parsed);
      if (!norm) { archiveCorrupt(s, userId, raw); return { corrupt: true, draft: null }; }
      return { corrupt: false, draft: norm };
    } catch (e) {
      archiveCorrupt(s, userId, raw);
      return { corrupt: true, draft: null };   // keine Onboarding-Ausnahme darf die App abbrechen
    }
  }

  O.onboardingV2Store = { key: key, backupKey: backupKey, save: save, clear: clear, load: load };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.onboardingV2Store;
})(typeof globalThis !== 'undefined' ? globalThis : this);
