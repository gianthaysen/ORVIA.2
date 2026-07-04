/* ============================================================
   ORVIA · auth-logic — REINE, testbare Auth-Entscheidungen (kein DOM, kein Supabase).
   Single Source of Truth für Passwortregeln, Auth-Flow-Erkennung und Registrierungsvertrag.
   Über window.ORVIA.authLogic UND module.exports (Node-Tests).
   ============================================================ */
(function (root) {
  // Passwortregeln (Spec §2.2): ≥8 Zeichen, Groß- UND Kleinbuchstabe, Zahl.
  function pwChecks(pw) { pw = pw || ''; return { len: pw.length >= 8, upper: /[A-Z]/.test(pw), lower: /[a-z]/.test(pw), digit: /\d/.test(pw) }; }
  function pwValid(pw) { var c = pwChecks(pw); return c.len && c.upper && c.lower && c.digit; }

  // Auth-Flow aus der vollständigen URL erkennen — Query UND Hash getrennt auswerten.
  // PRODUKTIV: PKCE (?code + ?auth_action). Implicit (type= im Hash) nur als Kompatibilitäts-Fallback.
  // Zustände: error · pkce_recovery · pkce_signup · pkce_email_change · pkce_unknown
  //           · implicit_recovery · implicit_signup · normal.
  // Ein bloßes ?code ohne gültige auth_action → 'pkce_unknown' (Controller öffnet NIE automatisch die App).
  function detectAuthFlow(href) {
    var q = '', h = '';
    try { var u = new URL(href, 'https://x/'); q = u.search || ''; h = u.hash || ''; }
    catch (e) { var s = String(href || ''); q = s; h = s; }
    if (/(^|[#&?])error(=|&|$)/.test(q) || /(^|[#&])error(=|&|$)/.test(h)) return 'error';
    var sp; try { sp = new URLSearchParams(q.charAt(0) === '?' ? q.slice(1) : q); } catch (e2) { sp = null; }
    var action = sp ? sp.get('auth_action') : null;
    var hasCode = (sp && sp.get('code')) || /[?&]code=/.test(q);
    if (hasCode) {
      if (action === 'recovery') return 'pkce_recovery';
      if (action === 'signup') return 'pkce_signup';
      if (action === 'email_change') return 'pkce_email_change';
      return 'pkce_unknown';
    }
    var both = q + '\n' + h;
    if (/type=recovery/.test(both)) return 'implicit_recovery';
    if (/type=signup/.test(both)) return 'implicit_signup';
    return 'normal';
  }

  // Registrierungsvertrag FAIL-CLOSED: nur eine ausdrücklich versionierte Bestätigungs-Antwort
  // gilt als gültige Registrierung. Kein stiller Fallback auf einen vorbestätigten Account.
  function acceptRegistration(data) {
    return !!(data && data.flowVersion === 2 && data.status === 'confirmation_required');
  }

  // Entfernt NUR bekannte Auth-Parameter aus Query UND Hash; fachliche App-Parameter (tab/date/view…)
  // bleiben erhalten. Gibt den relativen Ziel-Pfad für history.replaceState zurück.
  var AUTH_PARAMS = ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type',
    'type', 'error', 'error_code', 'error_description', 'code', 'token_hash', 'auth_action'];
  function stripAuthParams(href) {
    var url; try { url = new URL(href); } catch (e) { return href; }
    AUTH_PARAMS.forEach(function (k) { url.searchParams.delete(k); });
    var hp = new URLSearchParams(url.hash.charAt(0) === '#' ? url.hash.slice(1) : url.hash);
    AUTH_PARAMS.forEach(function (k) { hp.delete(k); });
    url.hash = hp.toString() ? '#' + hp.toString() : '';
    return url.pathname + (url.search || '') + (url.hash || '');
  }

  var api = { pwChecks: pwChecks, pwValid: pwValid, detectAuthFlow: detectAuthFlow, acceptRegistration: acceptRegistration, stripAuthParams: stripAuthParams };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA = root.ORVIA || {}; root.ORVIA.authLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
