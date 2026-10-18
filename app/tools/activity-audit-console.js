/* ORVIA · v8-452 · Garmin-Datenaudit der Aktivitaeten (Schwerpunkt Schwimmen) — NUR LESEN.
   Angemeldet in der Konsole des Desktop-Browsers (ORVIA ab v8-451) einfuegen. Schreibt nichts: kein Server, kein
   Zwischenspeicher, kein Flag. Liest je eigene Aktivitaet die gespeicherte Zeile (summary + metrics) und beschreibt
   je Schwimmeinheit, was Garmin geliefert hat, was gespeichert ist, was die Freigabe (metric-eligibility) sagt und
   was die App davon in ihrem lokalen Bestand hat. Fuer alle anderen Sportarten nur Zaehlungen.
   Enthaelt KEINE GPS-Punkte (nur deren Anzahl), keine Namen/Titel, keine vollen Kennungen (8 Zeichen), keine
   Zugangsdaten und keine vollstaendigen Messreihen (nur Anzahl, Minimum, Maximum, Mittel). Ergebnis als JSON in
   der Zwischenablage. */
(async () => {
  const O = window.ORVIA, sb = O && O.sb, uid = O && O.user && O.user.id;
  if (!sb || !uid) return 'Nicht angemeldet oder Supabase nicht geladen.';
  const ME = O.metricEligibility, CAP = O.activityCapabilities, AC = O.activityConfig, AS = O.activityStore;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const loc = s => { try { return s ? new Date(s).toLocaleString('sv-SE', { timeZone: tz }).slice(0, 16) : null; } catch (e) { return String(s); } };
  const sh = id => id ? String(id).slice(0, 8) : null;
  const isN = v => typeof v === 'number' && isFinite(v);
  const r2 = v => isN(v) ? Math.round(v * 100) / 100 : v;
  const keys = o => (o && typeof o === 'object' && !Array.isArray(o)) ? Object.keys(o).sort() : [];
  const stat = arr => { if (!Array.isArray(arr)) return null; const v = arr.filter(isN); if (!v.length) return { n: arr.length, nums: 0 };
    let mn = Infinity, mx = -Infinity, s = 0, z = 0; v.forEach(x => { if (x < mn) mn = x; if (x > mx) mx = x; s += x; if (x === 0) z++; });
    return { n: arr.length, nums: v.length, zeros: z, min: r2(mn), max: r2(mx), mean: r2(s / v.length) }; };
  /* Form einer verschachtelten Antwort: Schluessel und Listenlaengen, KEINE Werte */
  const shape = (x, d) => { d = d || 0; if (d > 4) return '…';
    if (Array.isArray(x)) return { list: x.length, first: x.length ? shape(x[0], d + 1) : null };
    if (x && typeof x === 'object') { const o = {}; keys(x).slice(0, 40).forEach(k => { const v = x[k]; o[k] = (v && typeof v === 'object') ? shape(v, d + 1) : typeof v; }); return o; }
    return typeof x; };
  const ev = (a, m, o) => { try { const r = ME.evaluate(a, m, o || {}); return r.eligible ? 'ok ' + (r.value != null ? r2(r.value) : '') : r.reasons.join('+'); } catch (e) { return 'err ' + e.message; } };

  const rows = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await sb.from('activities').select('id,client_record_id,sport_id,source,source_record_id,started_at,duration_seconds,status,summary,metrics,linked_activity_id')
      .eq('user_id', uid).order('started_at', { ascending: true }).range(from, from + 199);
    if (error) return 'Lesefehler: ' + (error.message || error.code);
    rows.push(...(data || []));
    if (!data || data.length < 200) break;
  }
  let local = []; try { local = AS.listActivities({ includeLinked: true }) || []; } catch (e) {}
  const localOf = r => local.find(a => a && (a.id === r.id || (r.client_record_id && a.clientRecordId === r.client_record_id))) || null;

  const swimOne = (r, i) => {
    const a = AC.normalizeServerActivity(r) || {}, m = r.metrics || {}, g = m.garmin || {}, ext = m.ext || {}, su = r.summary || {};
    const st = m.streams || {}, sm = m.stream_meta || {}, be = m.best_efforts || {}, f = ext.fields || {};
    const la = localOf(r), lm = (la && la.metrics) || {};
    const series = {}; keys(ext.series).forEach(k => { const s = ext.series[k] || {}; series[k] = Object.assign({ unit: s.garmin_unit || null }, stat(s.values)); });
    const streams = {}; keys(st).forEach(k => { streams[k] = Object.assign({ kind: (sm[k] || {}).kind || null, src: (sm[k] || {}).source || null, unit: (sm[k] || {}).garmin_unit || (sm[k] || {}).unit || null }, stat(st[k])); });
    const summ = {}; keys(su).forEach(k => { if (k !== 'name' && k !== 'title' && (isN(su[k]) || typeof su[k] === 'boolean')) summ[k] = r2(su[k]); });
    const fields = {}; keys(f).forEach(k => { fields[k] = isN(f[k]) ? r2(f[k]) : f[k]; });
    let capa = null; try { const c = CAP.of(a); capa = { available: keys(c.groups).filter(k => c.groups[k].available), missing: c.missing, swim: c.groups.swim }; } catch (e) { capa = 'err ' + e.message; }
    return {
      n: i + 1, id: sh(r.id), start: loc(r.started_at), status: r.status, type: g.type_key || null, ctx: ME.contextOf ? ME.contextOf(a).environment : null,
      dv: m.detailsVersion != null ? m.detailsVersion : null, maxchart: m.detailsMaxchart != null ? m.detailsMaxchart : null, semV: m.detailsSemantics != null ? m.detailsSemantics : null,
      durationSeconds: r.duration_seconds, timer: g.timer_duration_s != null ? g.timer_duration_s : null, elapsed: g.elapsed_duration_s != null ? g.elapsed_duration_s : null,
      moving: g.moving_duration_s != null ? g.moving_duration_s : null, sampling: { rows: g.stream_rows, kept: g.stream_kept, total: g.stream_total },
      summary: summ, garminKeys: keys(g), semanticsOk: g.semantics_ok || null,
      extKeys: keys(ext), fields, list: ext.list ? shape(ext.list) : null, series,
      unrecognized: ext.unrecognized || [], seriesUnparsed: ext.series_unparsed || [], rejected: ext.rejected || [], extras: ext.extras || null,
      semantics: ext.semantics || null,
      splits: Array.isArray(m.splits) ? { n: m.splits.length, src: m.splits_source || null, first: shape(m.splits[0]), dist: m.splits.map(x => isN(x.distance) ? Math.round(x.distance) : null).slice(0, 60) } : null,
      extSplits: ext.splits ? shape(ext.splits) : null, extTypedSplits: ext.typed_splits ? shape(ext.typed_splits) : null,
      routePoints: Array.isArray(m.route) ? m.route.length : 0, streams,
      bestEfforts: { keys: keys(be), stats: keys(be.stats), distance: be.distance ? { status: be.distance.status, basis: be.distance.basis, total_m: be.distance.total_m } : null },
      corrections: keys(m.corrections), durationCorrection: !!m.durationCorrection,
      elig: { duration: ev(a, 'duration'), distance: ev(a, 'distance'), heartRate: ev(a, 'heartRate'), maxHeartRate: ev(a, 'maxHeartRate'), calories: ev(a, 'calories'),
              swolf: ev(a, 'swolf'), strokeRate: ev(a, 'strokeRate'), trainingEffect: ev(a, 'trainingEffect') },
      capabilities: capa,
      app: la ? { inStore: true, hasExt: !!lm.ext, streams: keys(lm.streams), splits: Array.isArray(lm.splits) ? lm.splits.length : 0, summary: keys(la.summary) } : { inStore: false }
    };
  };

  const garmin = rows.filter(r => r.source === 'garmin');
  const swims = rows.filter(r => r.sport_id === 'swimming');
  /* alle Sportarten: nur Zaehlungen */
  const bySport = {};
  rows.forEach(r => {
    const sp = r.sport_id || '?', m = r.metrics || {}, ext = m.ext || {}, o = bySport[sp] || (bySport[sp] = { n: 0, garmin: 0, withExt: 0, dv3: 0, withSplits: 0, fields: {}, series: {}, streams: {}, extras: {}, types: {} });
    o.n++; if (r.source === 'garmin') o.garmin++; if (m.ext) o.withExt++; if (m.detailsVersion >= 3) o.dv3++; if (Array.isArray(m.splits) && m.splits.length) o.withSplits++;
    keys(ext.fields).forEach(k => { o.fields[k] = (o.fields[k] || 0) + 1; });
    keys(ext.series).forEach(k => { o.series[k] = (o.series[k] || 0) + 1; });
    keys(m.streams).forEach(k => { o.streams[k] = (o.streams[k] || 0) + 1; });
    keys(ext.extras).forEach(k => { const v = k + ':' + ext.extras[k]; o.extras[v] = (o.extras[v] || 0) + 1; });
    const t = (m.garmin || {}).type_key || '-'; o.types[t] = (o.types[t] || 0) + 1;
  });
  const out = { v: '452-swim-audit-1', tz, build: (document.querySelector('meta[name="orvia-build"]') || {}).content || null,
    rows: rows.length, garmin: garmin.length, localStore: local.length, bySport, swims: swims.map(swimOne) };
  const txt = JSON.stringify(out);
  try { if (typeof copy === 'function') copy(txt); } catch (e) {}
  console.log(txt);
  return 'Fertig: ' + swims.length + ' Schwimmeinheiten, ' + rows.length + ' Aktivitaeten, ' + txt.length + ' Zeichen (in der Zwischenablage, sonst aus der Konsole kopieren).';
})();
