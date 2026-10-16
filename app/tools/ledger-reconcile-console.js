/* ORVIA · v8-448C · Abgleich bisherige Laufbestzeiten ↔ Leistungsregister — NUR LESEN.
   Angemeldet in der Konsole des Desktop-Browsers (ORVIA ab v8-448) einfuegen. Schreibt nichts: kein Server, kein
   Zwischenspeicher, kein Flag. Liest den Aktivitaetsbestand (dieselben Felder wie das Register), rechnet je Laufeinheit
   die bisherige Methode (run-bests) und das Urteil der Eligibility nebeneinander und kopiert das Ergebnis (JSON) in die
   Zwischenablage. Enthaelt keine GPS-Punkte, keine Herzfrequenz, keine Namen; Kennungen gekuerzt (8 Zeichen). */
(async () => {
  const O = window.ORVIA, R = O.performanceLedgerRepository, ME = O.metricEligibility, AC = O.activityConfig, AS = O.activityStore;
  const RB = O.runBests, S = O.performanceLedgerStore, L = O.performanceLedger, T = [1000, 5000, 10000, 21098], K = ['k1', 'k5', 'k10', 'k21'];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const loc = s => { try { return s ? new Date(s).toLocaleString('sv-SE', { timeZone: tz }).slice(0, 16) : null; } catch (e) { return String(s); } };
  const sh = id => id ? String(id).slice(0, 8) : null;
  const nz = v => (v === undefined ? null : v);
  const idx = await R.listActivityIndex();
  if (!idx || !idx.success) return 'Index nicht lesbar: ' + JSON.stringify(idx && idx.error);
  const rows = idx.data.rows, onServer = new Set(rows.map(r => r.id));
  const got = await R.fetchActivities(rows.map(r => r.id));
  if (!got || !got.success) return 'Aktivitaeten nicht lesbar: ' + JSON.stringify(got && got.error);
  const linkOf = {}; got.data.forEach(r => { linkOf[r.id] = r.linked_activity_id || null; });
  const acts = got.data.map(r => AC.normalizeServerActivity(r)).filter(Boolean);
  const dr = await S.sync({ dryRun: true });
  if (!dr || !dr.ok) return 'Probelauf fehlgeschlagen: ' + JSON.stringify(dr);
  const ev = (a, m, o) => { try { const r = ME.evaluate(a, m, o || {}); return r.eligible ? 'ok ' + (r.value != null ? Math.round(r.value * 10) / 10 : '') : r.reasons.join('+'); } catch (e) { return 'err ' + e.message; } };
  /* bisherige Anzeige: run-bests auf der Liste der App (hoechstens 200, inkl. nur lokal vorhandener, mit voller Messreihe) */
  let list = []; try { list = AS.listActivities() || []; } catch (e) {}
  const app = new Map(); list.forEach(a => { if (a && a.id) app.set(a.id, a); });
  const legacyOf = list => { const x = RB.measuredBestsLegacy(list, { sport: 'running' }); const o = {}; K.forEach(k => { o[k] = x[k] ? x[k].sec + 's ' + x[k].method + ' ' + x[k].km + 'km' : null; }); return o; };
  const one = a => {
    const m = a.metrics || {}, g = m.garmin || {}, be = m.best_efforts || {}, bd = be.distance || {}, su = a.summary || {};
    const la = app.get(a.id) || null, lm = (la && la.metrics) || {}, ls = lm.streams || {}, sd = ls.distance || (m.streams || {}).distance || [], tm0 = RB.streamTimeAxis(ls);
    const st = (dr.state.activities[a.id] || {}).entries || [];
    const t = {};
    T.forEach(tm => {
      const it = (bd.targets || {})[String(tm)], en = st.find(e => e.defId === 'running.fastest_' + tm + 'm');
      t[tm] = { worker: it ? (it.s != null ? it.s + 's ' + it.q + ' over' + it.over_m + 'm at' + it.at + 's' : it.q) : null, elig: ev(a, 'distanceBest', { targetM: tm }),
                ledger: en ? (en.eligibility === 'eligible' ? en.value + 's @' + en.contextClass : en.eligibility + ':' + (en.reason || (en.reasons || []).join('+'))) : null };
    });
    return { id: sh(a.id), cid: sh(a.clientRecordId), src: a.source, status: a.status, start: loc(a.startedAt) || (st[0] ? st[0].localDate + ' ' + st[0].localTime : null), startGmt: nz(g.start_gmt), link: sh(linkOf[a.id]),
      type: nz(g.type_key), ctx: ME.contextOf ? nz(ME.contextOf(a).environment) : null, dv: nz(m.detailsVersion),
      durationSeconds: nz(a.durationSeconds), timer: nz(g.timer_duration_s), elapsed: nz(g.elapsed_duration_s), moving: nz(g.moving_duration_s),
      distM: su.distanceM != null ? su.distanceM : (su.distanceKm != null ? su.distanceKm * 1000 : null),
      stream: { inAppList: !!la, n: sd.length, first: nz(sd[0]), last: sd.length ? sd[sd.length - 1] : null, timeN: tm0 ? tm0.length : 0, timeFirst: tm0 ? tm0[0] : null, timeLast: tm0 ? tm0[tm0.length - 1] : null },
      best: { status: nz(bd.status), total_m: nz(bd.total_m), basis: nz(bd.basis), rows: nz(be.rows), total: nz(be.total), timeSource: nz(be.time_source), native: nz(be.native) },
      corrections: Object.keys(m.corrections || {}), durationCorrection: !!m.durationCorrection,
      eligDistance: ev(a, 'distance'), eligDuration: ev(a, 'duration'), targets: t,
      appDurationSeconds: la ? nz(la.durationSeconds) : null, legacy: la ? legacyOf([la]) : 'nicht in der App-Liste' };
  };
  const runs = acts.filter(a => RB.sportFamily(a) === 'running').sort((x, y) => String(x.startedAt).localeCompare(String(y.startedAt)));
  const lb = RB.measuredBestsLegacy(list, { sport: 'running', isTombstoned: AS.isTombstoned });
  const legacy = {};
  K.forEach(k => { const x = lb[k]; if (!x) { legacy[k] = null; return; }
    const a = list.find(y => (y.clientRecordId || y.id || y.sourceRecordId) === x.activityId) || {};
    legacy[k] = { sec: x.sec, method: x.method, km: x.km, date: x.date, legacyId: sh(x.activityId), serverId: sh(a.id), src: nz(a.source), onServer: onServer.has(a.id), samples: nz(x.samples) }; });
  const ledger = {};
  T.forEach(tm => { const e = dr.state.events['running.fastest_' + tm + 'm@standard'], b = e && L.currentBest(e); ledger[tm] = b ? { s: b.value, date: b.localDate, id: sh(b.activityId) } : null; });
  const otherCtx = Object.keys(dr.state.events).filter(k => /^running\.fastest_/.test(k) && !/@standard$/.test(k))
    .map(k => { const b = L.currentBest(dr.state.events[k]); return k + ' ' + (b ? b.value + 's ' + b.localDate + ' ' + sh(b.activityId) : '-'); });
  const localOnly = list.filter(a => RB.sportFamily(a) === 'running' && !onServer.has(a.id))
    .map(a => ({ id: sh(a.id), cid: sh(a.clientRecordId), src: a.source, start: loc(a.startedAt), durationSeconds: nz(a.durationSeconds), distM: nz((a.summary || {}).distanceM), distKm: nz((a.summary || {}).distanceKm) }));
  const count = (f) => { const o = {}; acts.forEach(a => { const k = f(a); o[k] = (o[k] || 0) + 1; }); return o; };
  const out = { v: '448C-diag-1', tz, build: (document.querySelector('meta[name="orvia-build"]') || {}).content || null,
    index: { n: rows.length, complete: idx.data.complete, fetched: acts.length, bySource: count(a => a.source), bySport: count(a => a.sportId),
             linked: rows.filter(r => r.linked_activity_id).map(r => { const a = acts.find(x => x.id === r.id) || {}, p = acts.find(x => x.id === r.linked_activity_id) || {};
               return { rec: sh(r.id), recSrc: a.source, recSport: a.sportId, primary: sh(r.linked_activity_id), primSrc: p.source, primSport: p.sportId, start: loc(a.startedAt) }; }) },
    appList: { n: list.length, running: list.filter(a => RB.sportFamily(a) === 'running').length }, legacy, ledger, otherCtx, localOnly, runs: runs.map(one) };
  const txt = JSON.stringify(out);
  try { if (typeof copy === 'function') copy(txt); } catch (e) {}
  console.log(txt);
  return 'Fertig: ' + runs.length + ' Laeufe, ' + txt.length + ' Zeichen (in der Zwischenablage, sonst aus der Konsole kopieren).';
})();
