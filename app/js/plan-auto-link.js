/* ============================================================
   ORVIA · plan-auto-link — automatische Zuordnung Aktivitaet → Plan-Einheit (v8-420)
   ------------------------------------------------------------
   Gians Entscheidung 28.09.: „Das sollte automatisch passieren und aenderbar
   sein, falls es nicht passt." Der Plan-Ist-Resolver (I3b) bleibt unveraendert
   fail-closed: er verknuepft NIE ueber Tag+Sport. Dieses Modul trifft die
   Zuordnung STATTDESSEN als persistierte, protokollierte Korrektur
   (planLinkCorrection, method 'auto') — sichtbar, synchronisiert, jederzeit
   ueber „aendern" oder „loesen" korrigierbar. Eine vom Nutzer geloeste
   Verknuepfung wird nie automatisch neu gesetzt.

   REGEL (decide, rein): je unverknuepfter Aktivitaet, chronologisch —
   Kandidaten = offene Plan-Einheiten derselben Sportart in derselben Woche
   (Mo–So), die noch keine Aktivitaet tragen. Gewaehlt wird die naechste am
   Tag (Abstand 0 zuerst), bei Gleichstand die FRUEHERE (nachgeholt schlaegt
   vorgezogen). Keine Sportart ('other') ⇒ keine Zuordnung.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'plan-auto-link@2';
  var WEEKS_BACK = 8;

  function _iso(d) { return (typeof root.todayStr === 'function') ? root.todayStr(d) : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function weekOf(dateIso) {
    var d = new Date(dateIso + 'T12:00'); var wd = (d.getDay() + 6) % 7; var mon = new Date(d); mon.setDate(d.getDate() - wd);
    var out = []; for (var i = 0; i < 7; i++) { var x = new Date(mon); x.setDate(mon.getDate() + i); out.push(_iso(x)); }
    return out;
  }
  function dayIdx(iso) { return Math.round(new Date(iso + 'T12:00').getTime() / 864e5); }

  /* decide({ activities:[{id, sportId, localDate}], units:[{occurrenceId, sportId, localDate}] })
     → [{ activityId, occurrenceId, reason }] */
  function decide(input) {
    var acts = ((input && input.activities) || []).filter(function (a) { return a && a.id && a.sportId && a.sportId !== 'other' && a.localDate; })
      .slice().sort(function (x, y) { var kx = x.localDate + '|' + (x.startedAt || ''), ky = y.localDate + '|' + (y.startedAt || ''); return kx < ky ? -1 : kx > ky ? 1 : 0; });
    var units = ((input && input.units) || []).filter(function (u) { return u && u.occurrenceId && u.sportId && u.localDate; });
    var taken = {}; var out = [];
    acts.forEach(function (a) {
      var wk = weekOf(a.localDate); var ad = dayIdx(a.localDate);
      var cands = units.filter(function (u) { return !taken[u.occurrenceId] && u.sportId === a.sportId && wk.indexOf(u.localDate) >= 0; });
      if (!cands.length) return;
      cands.sort(function (x, y) {
        var dx = Math.abs(dayIdx(x.localDate) - ad), dy = Math.abs(dayIdx(y.localDate) - ad);
        if (dx !== dy) return dx - dy;
        return x.localDate < y.localDate ? -1 : x.localDate > y.localDate ? 1 : 0;
      });
      var pick = cands[0]; taken[pick.occurrenceId] = true;
      out.push({ activityId: a.id, occurrenceId: pick.occurrenceId, reason: pick.localDate === a.localDate ? 'auto_same_day' : 'auto_same_week' });
    });
    return out;
  }

  var _running = false;
  /* run(): liest Store + Resolver, wendet decide() als Korrektur an. Idempotent. */
  function run(opts) {
    var o = opts || {};
    if (_running) return { ok: false, code: 'busy' };
    var store = O.activityStore, cfg = O.activityConfig;
    if (!store || !store.listActivities || !store.linkActivityToPlan || typeof root.planActualResolveForDates !== 'function') return { ok: false, code: 'unavailable' };
    _running = true;
    try {
      var tz = (O.profileStore && O.profileStore.effectiveTimezone) ? O.profileStore.effectiveTimezone() : 'UTC';
      var norm = (typeof root._planActualNorm === 'function') ? root._planActualNorm : function (x) { return x; };
      var today = (typeof root.todayStr === 'function') ? root.todayStr() : _iso(new Date());
      var minDate = _iso(new Date(new Date(today + 'T12:00').getTime() - WEEKS_BACK * 7 * 864e5));
      /* v8-421: Serverseitig geladene Einheiten (anderes Geraet), die den lokalen
         Store noch nicht erreicht haben, zuerst lokal sicherstellen — sonst sieht
         die Zuordnung sie nicht (Gians Befund 28.09.). Nur Einfuegen, nie Ueberschreiben. */
      if (store.ensureLocal && typeof O.activityServerCache === 'function') {
        try { (O.activityServerCache() || []).forEach(function (sa) { if (sa && sa.id) store.ensureLocal(sa); }); } catch (e) {}
      }
      /* v8-422 (Gians Befund 1.10.): eine VERWAISTE Zuordnung — plannedSessionId zeigt
         auf eine Occurrence, die der heutige Plan nicht mehr kennt (generierte psg:-IDs
         wandern bei Planaenderung/Verfuegbarkeits-Umbau) — zaehlt nirgends und blockierte
         bisher die automatische Zuordnung („schon verknuepft"). Sie wird wie unverknuepft
         behandelt und protokolliert neu zugeordnet (fromOccurrenceId bleibt erhalten). */
      var acts = [], linked = [];
      (store.listActivities() || []).forEach(function (a) {
        if (!a || (store.isTombstoned && store.isTombstoned(a))) return;
        var c = a.metrics && a.metrics.planLinkCorrection;
        if (c && (c.reason === 'user_unlinked')) return;   /* Nutzerentscheidung respektieren */
        var ld = (cfg && cfg.dayOfActLocal) ? cfg.dayOfActLocal(a, tz) : String(a.startedAt || '').slice(0, 10);
        if (!ld || ld < minDate || ld > today) return;
        var rec = { id: a.id || a.clientRecordId, sportId: norm(a.sportId), localDate: ld, startedAt: a.startedAt || '' };
        var cur = store.planLinkOf(a);
        if (cur) linked.push({ act: rec, occ: cur }); else acts.push(rec);
      });
      if (!acts.length && !linked.length) return { ok: true, applied: 0, decisions: [], dangling: 0 };
      var dates = {}; acts.concat(linked.map(function (l) { return l.act; })).forEach(function (a) { weekOf(a.localDate).forEach(function (d) { dates[d] = 1; }); });
      var res = root.planActualResolveForDates(Object.keys(dates).sort()) || {};
      var known = {}; (res.results || []).forEach(function (r) { if (r && r.plannedSessionId) known[r.plannedSessionId] = 1; });
      var dangling = 0;
      linked.forEach(function (l) { if (!known[l.occ]) { l.act.dangling = true; acts.push(l.act); dangling++; } });
      if (!acts.length) return { ok: true, applied: 0, decisions: [], dangling: 0 };
      var units = (res.results || []).filter(function (r) { return r && r.plannedSessionId && r.state !== 'completed' && r.planned; })
        .map(function (r) { return { occurrenceId: r.plannedSessionId, sportId: r.planned.sportId, localDate: r.planned.localDate }; });
      var decisions = decide({ activities: acts, units: units });
      var byId = {}; acts.forEach(function (a) { byId[a.id] = a; });
      decisions.forEach(function (d) { if (byId[d.activityId] && byId[d.activityId].dangling) d.reason = d.reason + '_relinked'; });
      var applied = 0;
      decisions.forEach(function (d) {
        var r = store.linkActivityToPlan(d.activityId, d.occurrenceId, { reason: d.reason, method: 'auto' });
        if (r && r.ok && r.code === 'linked') applied++;
      });
      if (applied && !o.silent) {
        try { if (O.activitySync && O.activitySync.flushPendingActivities) O.activitySync.flushPendingActivities(); } catch (e) {}
        try { if (root.dispatchEvent && typeof CustomEvent === 'function') root.dispatchEvent(new CustomEvent('orvia:activity-updated', { detail: { autoLinked: applied } })); } catch (e) {}
      }
      return { ok: true, applied: applied, decisions: decisions, dangling: dangling };
    } catch (e) { return { ok: false, code: 'error', error: String(e && e.message || e) }; }
    finally { _running = false; }
  }

  /* Ausloeser: nach Sync-Pull, nach Aktivitaets-Aenderungen (nicht nach eigenem Lauf), einmal beim Start. */
  var _t = null;
  function schedule() { if (_t) clearTimeout(_t); _t = setTimeout(function () { _t = null; run(); }, 400); }
  if (typeof root.addEventListener === 'function') {
    root.addEventListener('orvia:activities-pulled', schedule);
    root.addEventListener('orvia:activity-updated', function (ev) { if (ev && ev.detail && ev.detail.autoLinked) return; schedule(); });
    root.addEventListener('load', function () { setTimeout(function () { run(); }, 2500); });
  }

  O.planAutoLink = { VERSION: VERSION, decide: decide, run: run, weekOf: weekOf };
})(typeof window !== 'undefined' ? window : globalThis);
