/* ============================================================
   ORVIA · feature-flags — serverseitiger Schaltkanal (Phase 8.4)

   WOFÜR: Das Canary-Gate verlangt, dass die Engine SERVERSEITIG abschaltbar ist.
   Ein Flag im localStorage erfüllt das nicht — es ließe sich aus der Ferne weder
   prüfen noch zurücknehmen. Dieses Modul liest die Schaltung aus Supabase
   (Migration 0031, Tabelle user_feature_flags).

   HÄRTESTE REGEL — FAIL-CLOSED: Der Standard ist AUS. Aktiviert wird NUR bei einer
   ausdrücklich gelesenen Zeile mit enabled === true. Jeder andere Ausgang — kein
   Nutzer, kein Netz, Tabelle fehlt, Abfrage schlägt fehl, Antwort unlesbar — führt
   zu AUS. Ein Fehler darf niemals ein Feature einschalten.

   WARUM DER CLIENT NICHT SCHREIBEN DARF: Die Tabelle hat bewusst keine
   Schreib-Policy für `authenticated`. Könnte der Client selbst aktivieren, wäre die
   serverseitige Kontrolle wertlos. Dieses Modul bietet deshalb KEINE set-Funktion.

   CACHE: Der gelesene Zustand gilt für die Sitzung (TTL 5 min). Das ist bewusst:
   ein Flag, das mitten in einer Nutzung umspringt, würde die Oberfläche in einen
   halb umgeschalteten Zustand bringen. Ein Abschalten greift damit spätestens beim
   nächsten Start oder nach der TTL — nie später.

   Kein DOM. Ohne Supabase-Client ist alles AUS.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'feature-flags@1';
  var TABLE = 'user_feature_flags';
  var TTL_MS = 5 * 60 * 1000;

  /* Bekannte Flags — identisch zum CHECK-Constraint in Migration 0031. Ein hier
     unbekannter Name wird NICHT abgefragt, sondern gilt sofort als aus; sonst
     wäre ein Tippfehler nicht von „bewusst nicht aktiviert" zu unterscheiden. */
  var KNOWN = ['engine_v2_plan', 'engine_v2_readiness', 'canary_diagnostics'];

  /* state: flag -> { enabled, at, source, reason, cohort } */
  var _state = {};
  var _inflight = null;

  function _now() {
    try { if (O.clock && typeof O.clock.now === 'function') return O.clock.now(); } catch (e) {}
    return Date.now();
  }
  function _uid() { try { return (O.user && O.user.id) || null; } catch (e) { return null; } }

  /* Synchroner Lesezugriff — das ist der Weg, den die Oberfläche nimmt.
     Liefert IMMER einen Wert; ohne belastbare Information ist er false. */
  function isEnabled(flag) {
    if (KNOWN.indexOf(flag) < 0) return false;
    var s = _state[flag];
    if (!s) return false;
    if (s.enabled !== true) return false;
    /* Abgelaufener Eintrag zählt nicht mehr als Beleg. */
    if (_now() - s.at > TTL_MS) return false;
    return true;
  }

  /* Ausführliche Auskunft für Diagnose und Gate-Auswertung. */
  function describe(flag) {
    var s = _state[flag] || null;
    return {
      flag: flag,
      known: KNOWN.indexOf(flag) >= 0,
      enabled: isEnabled(flag),
      source: s ? s.source : 'never_loaded',
      reason: s ? (s.reason || null) : null,
      cohort: s ? (s.cohort || null) : null,
      ageMs: s ? (_now() - s.at) : null,
      stale: s ? (_now() - s.at > TTL_MS) : true,
      version: VERSION
    };
  }
  function snapshot() {
    var out = {};
    KNOWN.forEach(function (f) { out[f] = describe(f); });
    return out;
  }

  /* Alle bekannten Flags EINMAL laden. Mehrfachaufrufe teilen sich die laufende
     Abfrage (kein Anfragensturm beim Start). */
  function refresh(opts) {
    opts = opts || {};
    if (_inflight && !opts.force) return _inflight;
    var uid = _uid();
    var sb = O.sb || null;
    /* Ohne Nutzer oder ohne Client: sicherer Zustand, ohne Netzaufruf. */
    if (!uid || !sb || typeof sb.from !== 'function') {
      KNOWN.forEach(function (f) { _state[f] = { enabled: false, at: _now(), source: 'no_client_or_user' }; });
      return Promise.resolve({ ok: false, reason: 'no_client_or_user', flags: snapshot() });
    }
    var online = true; try { online = navigator.onLine !== false; } catch (e) {}
    if (!online) {
      /* Offline NICHT den letzten bekannten Zustand verlängern: sonst bliebe ein
         serverseitig abgeschaltetes Feature lokal weiter an. */
      KNOWN.forEach(function (f) { _state[f] = { enabled: false, at: _now(), source: 'offline' }; });
      return Promise.resolve({ ok: false, reason: 'offline', flags: snapshot() });
    }
    _inflight = Promise.resolve()
      .then(function () { return sb.from(TABLE).select('flag,enabled,reason,cohort').eq('user_id', uid); })
      .then(function (res) {
        var rows = (res && res.data) || null;
        if (res && res.error) throw res.error;
        var byFlag = {};
        (Array.isArray(rows) ? rows : []).forEach(function (r) {
          if (!r || KNOWN.indexOf(r.flag) < 0) return;
          byFlag[r.flag] = r;
        });
        KNOWN.forEach(function (f) {
          var r = byFlag[f];
          _state[f] = {
            /* Nur ein ausdrückliches true zählt. Fehlende Zeile ⇒ aus. */
            enabled: !!(r && r.enabled === true),
            at: _now(),
            source: r ? 'server' : 'server_no_row',
            reason: r ? r.reason : null,
            cohort: r ? r.cohort : null
          };
        });
        return { ok: true, reason: null, flags: snapshot() };
      })
      .catch(function (e) {
        /* Fehler ⇒ AUS. Auch wenn vorher etwas an war: ein nicht bestätigter
           Zustand ist kein Beleg. */
        KNOWN.forEach(function (f) { _state[f] = { enabled: false, at: _now(), source: 'error' }; });
        return { ok: false, reason: 'query_failed', detail: String((e && e.message) || e), flags: snapshot() };
      })
      .then(function (r) { _inflight = null; return r; });
    return _inflight;
  }

  /* Sofortiges Abschalten ohne Serverabfrage — für Notfall/Rollback aus der Konsole.
     Es gibt bewusst KEIN Gegenstück zum Einschalten. */
  function killSwitch() {
    KNOWN.forEach(function (f) { _state[f] = { enabled: false, at: _now(), source: 'kill_switch' }; });
    return snapshot();
  }

  /* Beim Start und nach der Anmeldung einmal laden. Fehler bleiben folgenlos,
     weil der sichere Zustand ohnehin AUS ist. */
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('orvia:auth-ready', function () { try { refresh({ force: true }); } catch (e) {} });
    try { setTimeout(function () { try { refresh(); } catch (e) {} }, 1800); } catch (e) {}
  }

  var api = { VERSION: VERSION, TABLE: TABLE, KNOWN: KNOWN, TTL_MS: TTL_MS,
    isEnabled: isEnabled, describe: describe, snapshot: snapshot,
    refresh: refresh, killSwitch: killSwitch,
    /* nur für Tests: Zustand direkt setzen. Trägt den Namen, der klarmacht,
       dass das kein produktiver Weg ist. */
    _setForTest: function (flag, enabled, source) {
      _state[flag] = { enabled: enabled === true, at: _now(), source: source || 'test' };
      return snapshot();
    } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.featureFlags = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
