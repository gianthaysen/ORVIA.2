/* ============================================================
   ORVIA · i18n — B-13 Laufzeit fuer key-basierte Strings (Band 6 e.1)

   t(key, params) → String. Kataloge liegen als Skripte unter locales/<lang>.js
   (ORVIA.locales[lang] = { 'namespace.key': 'Text' }) — kein fetch, kein
   Build-Schritt, offline ueber die SW-Asset-Liste, kein Ladezeit-Rennen.
   Flache Keys mit Namespace-Praefix, grep-bar.

   FALLBACK-KETTE: aktive Sprache → 'de' (Referenzsprache) → der Key selbst.
   Ein sichtbarer Key ist ein absichtlicher Fehlerindikator, kein leerer String.

   PLATZHALTER: {name}. PLURAL: Intl.PluralRules; Katalog fuehrt 'key.one' /
   'key.other' (weitere Kategorien optional), t(key, {count}) waehlt.

   PSEUDO-LOCALE 'xx': liefert den DE-Text in ⟦…⟧ — jeder Klartext, der NICHT
   durch t() laeuft, faellt optisch auf (Schutznetz e.2 Schritt 4).

   SPRACHWAHL: localStorage 'orvia_locale' > navigator.language > 'de'.
   Einheiten (kg/lb) sind KEINE Sprachfrage und laufen nicht ueber dieses
   Modul.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'i18n@1';
  var REF = 'de';
  O.locales = O.locales || {};
  var _locale = null, _pr = {};

  function _norm(l) { var s = String(l || '').toLowerCase().split(/[-_]/)[0]; return s || null; }
  function detect() {
    var l = null;
    try { l = root.localStorage && root.localStorage.getItem('orvia_locale'); } catch (e) {}
    if (!l) { try { l = root.navigator && (root.navigator.language || (root.navigator.languages || [])[0]); } catch (e) {} }
    return _norm(l) || REF;
  }
  function locale() { if (!_locale) _locale = detect(); return _locale; }
  function setLocale(l) {
    _locale = _norm(l) || REF;
    try { if (root.localStorage) { if (l) root.localStorage.setItem('orvia_locale', _locale); else root.localStorage.removeItem('orvia_locale'); } } catch (e) {}
    try { if (root.dispatchEvent && typeof root.CustomEvent === 'function') root.dispatchEvent(new root.CustomEvent('orvia:locale-changed', { detail: { locale: _locale } })); } catch (e) {}
    return _locale;
  }
  function _cat(l) { var c = O.locales[l]; return (c && typeof c === 'object') ? c : null; }
  function _plural(l, n) {
    try { if (!_pr[l]) _pr[l] = new Intl.PluralRules(l === 'xx' ? REF : l); return _pr[l].select(n); } catch (e) { return n === 1 ? 'one' : 'other'; }
  }
  function _lookup(l, key, params) {
    var c = _cat(l); if (!c) return null;
    if (params && typeof params.count === 'number') {
      var cat = _plural(l, params.count);
      if (typeof c[key + '.' + cat] === 'string') return c[key + '.' + cat];
      if (typeof c[key + '.other'] === 'string') return c[key + '.other'];
    }
    return typeof c[key] === 'string' ? c[key] : null;
  }
  function _fill(s, params) {
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return (k in params && params[k] != null) ? String(params[k]) : m; });
  }
  /* t(key, params) — nie undefined, nie leer: Kette aktiv → de → key */
  function t(key, params) {
    var k = String(key == null ? '' : key);
    var l = locale();
    if (l === 'xx') { var ref = _lookup(REF, k, params); return ref != null ? '⟦' + _fill(ref, params) + '⟧' : '⟦' + k + '⟧'; }
    var s = _lookup(l, k, params);
    if (s == null && l !== REF) s = _lookup(REF, k, params);
    return s != null ? _fill(s, params) : k;
  }
  function has(key, l) { return _lookup(l || locale(), String(key), null) != null; }
  /* Paritaetspruefung fuer die CI (e.3): fehlende/verwaiste Keys und Platzhalter-Differenzen. */
  function parity(a, b) {
    var A = _cat(a) || {}, B = _cat(b) || {}, missing = [], orphan = [], placeholders = [];
    var ph = function (s) { return (String(s).match(/\{\w+\}/g) || []).sort().join(','); };
    Object.keys(A).forEach(function (k) { if (!(k in B)) missing.push(k); else if (ph(A[k]) !== ph(B[k])) placeholders.push(k); });
    Object.keys(B).forEach(function (k) { if (!(k in A)) orphan.push(k); });
    return { missing: missing, orphan: orphan, placeholders: placeholders, ok: !missing.length && !orphan.length && !placeholders.length };
  }
  var api = { VERSION: VERSION, REF: REF, t: t, has: has, locale: locale, setLocale: setLocale, detect: detect, parity: parity, _resetForTest: function () { _locale = null; _pr = {}; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.i18n = api;
  if (typeof root.t !== 'function') root.t = t;
})(typeof globalThis !== 'undefined' ? globalThis : this);
