/* ============================================================
   ORVIA · records-bridge (v8-448B) — kontrollierte Umstellung der bestehenden Rekordanzeigen auf das
   Leistungsregister. EINE Stelle entscheidet, woher Bestzeiten und Distanzen fuer Bestwerte kommen.

   mode()
     'off'      Flag performance_ledger aus (Standard): alles exakt wie bisher — run-bests, pb-sync und
                achievements rechnen unveraendert. Keine sichtbare Aenderung.
     'pending'  Flag an, Register fuer dieses Konto noch nicht geladen: Anzeigen zeigen die bisherigen Werte,
                aber NICHTS wird geschrieben (pb-sync pausiert) — kein Hin-und-her im Profil.
     'on'       Register geladen: fuer jede Groesse, die das Register kennt, gilt NUR das Register.

   Ueberschneidungen und Regel (keine zwei Rechnungen fuer denselben Rekord):
     Laufbestzeiten 1 km / 5 km / 10 km / HM / Marathon (run-bests k1…k42)  → Register (Kontext standard)
     „Laengster Lauf / Radeinheit / Schwimmeinheit" (achievements maxSingle)  → nur freigegebene Distanzen,
                                                                              Kontextklasse standard
     Summen (Wochenumfang, Gesamtkilometer)                                   → nur freigegebene Distanzen,
                                                                              alle Kontextklassen
     Rad 20/40/90/180 km und Schwimmen 400 m … 3,8 km (run-bests)             → kennt das Register nicht;
                                                                              bleiben unveraendert (keine
                                                                              zweite Rechnung desselben Rekords)
   Rein bis auf das Lesen von ORVIA.performanceLedgerStore. Kein DOM, kein Netz.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'records-bridge@1';
  var RUN_KEYS = { k1: 1000, k5: 5000, k10: 10000, k21: 21098, k42: 42195 };
  var DIST_SPORTS = { running: 1, cycling: 1, swimming: 1, walking: 1, hiking: 1, rowing: 1 };

  function store() { return O.performanceLedgerStore || null; }
  function mode() {
    var S = store();
    try {
      if (!S || typeof S.enabled !== 'function' || !S.enabled()) return 'off';
      return S.ready() ? 'on' : 'pending';
    } catch (e) { return 'off'; }
  }

  /* run-bests-Ergebnis (Laufen) → Werte aus dem Register. Form bleibt gleich; method 'ledger'. */
  function overlay(res) {
    if (!res || res.sport !== 'running' || mode() !== 'on') return res;
    var S = store(), out = Object.assign({}, res, { source: 'ledger' });
    Object.keys(RUN_KEYS).forEach(function (k) {
      var t = RUN_KEYS[k], ev = S.bestOf('running.fastest_' + t + 'm@standard');
      out[k] = ev ? { sec: ev.value, km: t / 1000, laps: null, fromLap: null, method: 'ledger', targetKm: t / 1000,
                      activityId: ev.activityId, date: ev.localDate, validation: ev.validation || null, manual: !!ev.manual } : null;
    });
    return out;
  }

  /* Distanz einer Aktivitaet fuer Meilensteine/Medaillen: { single, sum, day } in km, oder null (nicht im Register
     → wie bisher). single = nur freigegeben + Kontextklasse standard; sum = freigegeben, jede Klasse. */
  function distanceOf(a) {
    if (mode() !== 'on' || !a || !a.id) return null;
    var sp = a.sportId;
    if (!DIST_SPORTS[sp]) return { single: null, sum: null, day: null, handled: true };
    var e = store().entryOf(a.id, sp + '.longest_distance');
    if (!e) return { single: null, sum: null, day: null, handled: true };        // nicht (noch nicht) im Register: zaehlt nicht
    var ok = e.eligibility === 'eligible' && typeof e.value === 'number';
    return { single: ok && e.contextClass === 'standard' ? e.value / 1000 : null, sum: ok ? e.value / 1000 : null, day: e.localDate || null, handled: true };
  }

  /* Vergleich fuer den Echtdaten-Probelauf: bisherige Bestzeiten (run-bests, ohne Register) gegen das Register. */
  function compareWithLegacy(state, activities) {
    var L = O.performanceLedger, RB = O.runBests;
    var acts = activities;
    try { if (!acts && O.activityStore && O.activityStore.listActivities) acts = O.activityStore.listActivities() || []; } catch (e) { acts = []; }
    var legacy = (RB && RB.measuredBestsLegacy) ? RB.measuredBestsLegacy(acts || [], { sport: 'running', isTombstoned: (O.activityStore && O.activityStore.isTombstoned) || null }) : null;
    var out = [];
    Object.keys(RUN_KEYS).forEach(function (k) {
      var ev = state && state.events['running.fastest_' + RUN_KEYS[k] + 'm@standard'];
      var lb = ev && L ? L.currentBest(ev) : null, lg = legacy && legacy[k];
      var verdict = !lg && !lb ? 'beide_leer' : !lb ? 'nur_bisher' : !lg ? 'nur_register' : Math.abs(lg.sec - lb.value) < 1 ? 'gleich' : 'abweichend';
      out.push({ key: k, bisher: lg ? { sec: lg.sec, date: lg.date, method: lg.method, activityId: lg.activityId } : null,
                 register: lb ? { sec: lb.value, date: lb.localDate, activityId: lb.activityId } : null, verdict: verdict });
    });
    return { running: out, legacyScanned: legacy ? legacy.scanned : 0, note: 'bisher = run-bests auf der geladenen Liste (hoechstens 200 Aktivitaeten); Register = vollstaendiger Bestand' };
  }

  var api = { VERSION: VERSION, RUN_KEYS: RUN_KEYS, mode: mode, overlay: overlay, distanceOf: distanceOf, compareWithLegacy: compareWithLegacy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.recordsBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
