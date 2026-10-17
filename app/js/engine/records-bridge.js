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
     Laufbestzeiten 1 km / 5 km / 10 km / HM / Marathon (run-bests k1…k42)  → Register (Kontext standard),
                                                                              einschliesslich Pausen (…m@standard)
     aktive Trainingsbestzeiten (run-bests active.k1…k42, v8-449.1)          → Register (…m_active@standard);
                                                                              nur Anzeige — pb-sync/Prognose lesen k1…k42
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
  var VERSION = 'records-bridge@4';   // v8-451: tatsaechliche Strecke (distM) aus der Herkunft, auch fuer die Gesamtzeit
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

  /* run-bests-Ergebnis (Laufen) → Werte aus dem Register. Form bleibt gleich; method 'ledger'.
     v8-449.1 · zwei Zeitkategorien, getrennt wie im Register:
       out[k]         Bestzeit EINSCHLIESSLICH Pausen (verstrichen, „am Stueck") — Prognosen, Zonen, pb-sync lesen nur das
       out.active[k]  aktive Trainingsbestzeit (Timer) — Anzeige, nie Grundlage einer Wettkampfprognose */
  function entryOut(ev, t, timing) {
    return ev ? { sec: ev.value, km: t / 1000, laps: null, fromLap: null, method: 'ledger', targetKm: t / 1000, timing: timing,
                  activityId: ev.activityId, date: ev.localDate, validation: ev.validation || null, manual: !!ev.manual } : null;
  }
  function overlay(res) {
    if (!res || res.sport !== 'running' || mode() !== 'on') return res;
    var S = store(), out = Object.assign({}, res, { source: 'ledger', active: {} });
    Object.keys(RUN_KEYS).forEach(function (k) {
      var t = RUN_KEYS[k];
      out[k] = entryOut(S.bestOf('running.fastest_' + t + 'm@standard'), t, 'elapsed');
      if (out[k]) {
        var ee = S.entryOf ? S.entryOf(out[k].activityId, 'running.fastest_' + t + 'm') : null, ep = (ee && ee.provenance) || {};
        out[k].measure = 'elapsed_window';
        out[k].distM = ep.distanceM || null;
        if (ep.distanceM) out[k].km = Math.round(ep.distanceM) / 1000;
      }
      var ae = entryOut(S.bestOf('running.fastest_' + t + 'm_active@standard'), t, 'active');
      if (ae) {
        var en = S.entryOf ? S.entryOf(ae.activityId, 'running.fastest_' + t + 'm_active') : null, pv = (en && en.provenance) || {};
        ae.measure = pv.measure || null;
        ae.distM = pv.distanceM || null;
        ae.km = pv.distanceM ? Math.round(pv.distanceM) / 1000 : ae.km;
        ae.pausedS = (pv.measure === 'activity_timer' || pv.measure === 'timer_window') && pv.pauses && pv.pauses.pausedS > 0 ? pv.pauses.pausedS : null;
      }
      out.active[k] = ae;
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

  /* Vergleich fuer den Echtdaten-Probelauf: bisherige Bestzeiten (run-bests, ohne Register) gegen das Register.
     v8-448C: je Distanz auch die URSACHE einer Abweichung — aus dem Registereintrag genau der Aktivitaet, die bisher den
     Rekord hielt (Kennung auf die Server-Kennung aufgeloest: run-bests nennt clientRecordId vor id).
       gleich              gleicher Wert (< 1 s)
       genauer             dieselbe Aktivitaet; das Register rechnet auf ALLEN Messzeilen (Worker), bisher auf der
                           Anzeige-Reihe (hoechstens 300 Punkte) — das engste Fenster aus mehr Zeilen kann nur kuerzer sein
       gesperrt:<grund>    die bisherige Aktivitaet traegt fuer diese Distanz keinen freigegebenen Wert (Grund der Eligibility)
       anderer_kontext:<k> freigegeben, aber in einer anderen Kontextklasse (z. B. indoor) — wird nie mit standard verglichen
       nicht_im_register   die bisherige Aktivitaet kennt das Register nicht (nur lokal, geloescht, gekoppelt)
       anderer_wert        freigegeben, standard, aber anderer Wert (bisherige Methode rechnet anders, z. B. Timer-Dauer)
       nur_register / nur_bisher / beide_leer */
  function compareWithLegacy(state, activities) {
    var L = O.performanceLedger, RB = O.runBests;
    var acts = activities;
    try { if (!acts && O.activityStore && O.activityStore.listActivities) acts = O.activityStore.listActivities() || []; } catch (e) { acts = []; }
    acts = acts || [];
    var legacy = (RB && RB.measuredBestsLegacy) ? RB.measuredBestsLegacy(acts, { sport: 'running', isTombstoned: (O.activityStore && O.activityStore.isTombstoned) || null }) : null;
    function serverIdOf(legacyId) {
      for (var i = 0; i < acts.length; i++) { var a = acts[i]; if (a && (a.clientRecordId || a.id || a.sourceRecordId) === legacyId) return a.id || null; }
      return legacyId || null;
    }
    var out = [];
    Object.keys(RUN_KEYS).forEach(function (k) {
      var t = RUN_KEYS[k], ev = state && state.events['running.fastest_' + t + 'm@standard'];
      var lb = ev && L ? L.currentBest(ev) : null, lg = legacy && legacy[k];
      var sid = lg ? serverIdOf(lg.activityId) : null;
      var en = (lg && L && L.entryOf && state) ? L.entryOf(state, sid, 'running.fastest_' + t + 'm') : null;
      var verdict, cause = null;
      if (!lg && !lb) verdict = 'beide_leer';
      else if (!lb) verdict = 'nur_bisher';
      else if (!lg) verdict = 'nur_register';
      else verdict = Math.abs(lg.sec - lb.value) < 1 ? 'gleich' : 'abweichend';
      if (lg && verdict !== 'gleich') {
        if (!en) cause = 'nicht_im_register';
        else if (en.eligibility !== 'eligible') cause = 'gesperrt:' + (en.reason || (en.reasons || []).join('+') || '?');
        else if (en.contextClass !== 'standard') cause = 'anderer_kontext:' + en.contextClass;
        else if (lb && String(lb.activityId) === String(sid) && lb.value < lg.sec) cause = 'genauer';
        else cause = 'anderer_wert';
      }
      out.push({ key: k, verdict: verdict, cause: cause,
                 bisher: lg ? { sec: lg.sec, date: lg.date, method: lg.method, km: lg.km, activityId: sid, legacyId: lg.activityId } : null,
                 register: lb ? { sec: lb.value, date: lb.localDate, activityId: lb.activityId } : null,
                 bisherImRegister: en ? { eligibility: en.eligibility, value: en.value, contextClass: en.contextClass, reason: en.reason || null } : null });
    });
    /* v8-449.1 · aktive Trainingsbestzeiten: bisherige Rechnung (run-bests active) gegen das Register (…_active) */
    var act = [];
    Object.keys(RUN_KEYS).forEach(function (k) {
      var t = RUN_KEYS[k], ev = state && state.events['running.fastest_' + t + 'm_active@standard'];
      var lb = ev && L ? L.currentBest(ev) : null, lg = legacy && legacy.active && legacy.active[k];
      var sid = lg ? serverIdOf(lg.activityId) : null;
      var en = (lg && L && L.entryOf && state) ? L.entryOf(state, sid, 'running.fastest_' + t + 'm_active') : null;
      var verdict = !lg && !lb ? 'beide_leer' : !lb ? 'nur_bisher' : !lg ? 'nur_register' : Math.abs(lg.sec - lb.value) < 1 ? 'gleich' : 'abweichend', cause = null;
      if (lg && verdict !== 'gleich') {
        if (!en) cause = 'nicht_im_register';
        else if (en.eligibility !== 'eligible') cause = 'gesperrt:' + (en.reason || '?');
        else if (en.contextClass !== 'standard') cause = 'anderer_kontext:' + en.contextClass;
        else if (lb && String(lb.activityId) === String(sid) && lb.value < lg.sec) cause = 'genauer';
        else cause = 'anderer_wert';
      }
      act.push({ key: k, verdict: verdict, cause: cause,
                 bisher: lg ? { sec: lg.sec, date: lg.date, method: lg.method, km: lg.km, activityId: sid, legacyId: lg.activityId } : null,
                 register: lb ? { sec: lb.value, date: lb.localDate, activityId: lb.activityId, measure: (L.entryOf(state, lb.activityId, 'running.fastest_' + t + 'm_active') || {}).provenance ? L.entryOf(state, lb.activityId, 'running.fastest_' + t + 'm_active').provenance.measure : null } : null });
    });
    return { running: out, runningActive: act, legacyScanned: legacy ? legacy.scanned : 0, note: 'bisher = run-bests auf der geladenen Liste (hoechstens 200 Aktivitaeten); Register = vollstaendiger Bestand' };
  }

  var api = { VERSION: VERSION, RUN_KEYS: RUN_KEYS, mode: mode, overlay: overlay, distanceOf: distanceOf, compareWithLegacy: compareWithLegacy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.recordsBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
