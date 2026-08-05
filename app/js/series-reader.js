/* ============================================================
   ORVIA · series-reader — READ-ONLY Client für user_metric_series (Migration 0028)
   ------------------------------------------------------------
   Liest ausschließlich die Tages-Zeitreihen des angemeldeten Nutzers (RLS erzwingt
   die Nutzer-Grenze serverseitig; der Client filtert zusätzlich nur nach Metrik +
   Zeitraum). Kanonisch sortiert + dedupliziert. Unterscheidet Missingness (empty),
   Partial (Lücken im Zeitraum), Stale (kein frischer Tag) und Error/Offline.
   Berechnet KEINE Scores/Trends/Ersatzwerte und schreibt NICHTS zurück (kein
   Profil, kein Store). Fetch ist injizierbar (Testbarkeit); Supabase-Default optional.
   ============================================================ */
(function () {
  var root = (typeof window !== 'undefined') ? window : globalThis;
  root.ORVIA = root.ORVIA || {};

  var STALE_DAYS = 2;  // Tages-Serien gelten nach 2 Tagen als nicht mehr „aktuell"

  function _dayDiff(a, b) {
    try { return Math.round((Date.parse(a + 'T00:00') - Date.parse(b + 'T00:00')) / 864e5); }
    catch (_) { return null; }
  }

  // Punkte kanonisch: nur valide [offset, …]; nach offset sortiert; identischer
  // offset dedupliziert (letzter gewinnt) — deterministisch, keine Neuberechnung.
  function _sortDedupePoints(points) {
    if (!Array.isArray(points)) return [];
    var byOff = {};
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && isFinite(p[0])) byOff[p[0]] = p;
    }
    return Object.keys(byOff).map(Number).sort(function (a, b) { return a - b; })
      .map(function (k) { return byOff[k]; });
  }

  function _rangeDays(fromDate, toDate) {
    var d = _dayDiff(toDate, fromDate);
    return (d == null || d < 0) ? 1 : d + 1;
  }

  var Reader = {
    STALE_DAYS: STALE_DAYS,
    _sortDedupePoints: _sortDedupePoints,

    /* read({metricType, fromDate, toDate?, today?, fetchRows}) →
       {state:'ok'|'empty'|'error', stale:bool, partial:bool, series:[{metric_date,unit,points}], error?} */
    read: function (opts) {
      opts = opts || {};
      var metricType = opts.metricType;
      var fromDate = opts.fromDate;
      var toDate = opts.toDate || opts.fromDate;
      var today = opts.today || null;
      var fetchRows = opts.fetchRows;
      return Promise.resolve().then(function () {
        if (typeof fetchRows !== 'function') throw new Error('no_fetch');
        return fetchRows(metricType, fromDate, toDate);
      }).then(function (rows) {
        rows = Array.isArray(rows) ? rows : [];
        // Zeilen-Dedupe je metric_date (letzter gewinnt) + nur angeforderte Metrik.
        var byDate = {};
        rows.forEach(function (r) {
          if (r && r.metric_type === metricType && r.metric_date) byDate[r.metric_date] = r;
        });
        var dates = Object.keys(byDate).sort();
        if (!dates.length) return { state: 'empty', stale: false, partial: false, series: [] };
        var series = dates.map(function (d) {
          var r = byDate[d];
          return { metric_date: d, unit: r.unit || null, points: _sortDedupePoints(r.points || []) };
        });
        var partial = dates.length < _rangeDays(fromDate, toDate);   // Lücken im Zeitraum
        var stale = false;
        if (today) { var dd = _dayDiff(today, dates[dates.length - 1]); stale = (dd != null && dd > STALE_DAYS); }
        return { state: 'ok', stale: stale, partial: partial, series: series };
      }).catch(function (e) {
        return { state: 'error', stale: false, partial: false, series: [], error: String((e && e.message) || e) };
      });
    },

    /* Supabase-Default-Fetch (optional; nur wenn ein Client vorhanden ist).
       Read-only select; RLS erzwingt die Nutzer-Grenze. Fehlt die Tabelle/der
       Client oder ist offline → wirft, was read() zu state:'error' macht. */
    supabaseFetch: function (metricType, fromDate, toDate) {
      /* GM7.6-Fix (Live-Abnahme-Fund): der produktive Client heisst ORVIA.sb (auth.js:88) —
         die bisherigen Lookups (ORVIA.supabase / supabaseClient) existieren nirgends, daher
         endete JEDER Serien-Abruf live im Fehlerzweig "offline oder nicht ladbar". */
      var sb = (root.ORVIA && (root.ORVIA.sb || root.ORVIA.supabase)) || root.supabaseClient || null;
      if (!sb || !sb.from) return Promise.reject(new Error('no_supabase_client'));
      var q = sb.from('user_metric_series')
        .select('metric_type,metric_date,unit,points,point_count')
        .eq('metric_type', metricType)
        .gte('metric_date', fromDate)
        .lte('metric_date', toDate)
        .order('metric_date', { ascending: true });
      return Promise.resolve(q).then(function (res) {
        if (res && res.error) throw new Error(res.error.message || 'series_query_error');
        return (res && res.data) || [];
      });
    }
  };

  /* ---- Reine Render-Helfer (SVG-Strings) — nur echte Punkte, keine Interpolation
     erfundener Werte; fehlende Serie ⇒ Aufrufer zeigt ehrlichen Leerzustand. ---- */
  var STAGE_LANE = { deep: 0, light: 1, rem: 2, awake: 3 };
  /* Phase 4 (2026-08-05, P2-3): EINE Farbquelle fuer Schlafphasen. Vorher divergierten
     Hypnogramm (#3b4d8f/#c9ae7c) und Phasenbalken (var(--sleep)/var(--muted)) — dieselbe
     Phase in zwei Farben. Jetzt: CSS-Variablen mit Fallback (SVG inline im HTML loest
     var() auf; in var-losen Kontexten greift der Fallback). ui.js liest DIESE Map. */
  var STAGE_COLOR = { deep: 'var(--sleep,#9585ED)', light: '#9db4d8', rem: '#7c9cff', awake: 'var(--gold-soft,#DCC79A)' };
  var STAGE_LABEL = { deep: 'Tief', light: 'Leicht', rem: 'REM', awake: 'Wach' };

  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  Reader.renderHypnogram = function (points, opts) {
    opts = opts || {};
    var W = opts.width || 300, H = opts.height || 88, laneH = H / 4;
    var pts = _sortDedupePoints(points || []);
    if (!pts.length) return '';
    var total = 0;
    pts.forEach(function (p) { total = Math.max(total, p[0] + (p[1] || 0)); });
    if (total <= 0) return '';
    var rects = pts.map(function (p) {
      var off = p[0], dur = p[1] || 0, stage = p[2];
      var lane = STAGE_LANE[stage]; if (lane == null) return '';
      var x = off / total * W, w = Math.max(0.6, dur / total * W);
      return '<rect x="' + x.toFixed(2) + '" y="' + (lane * laneH).toFixed(2) + '" width="' + w.toFixed(2) +
        '" height="' + (laneH - 1).toFixed(2) + '" fill="' + STAGE_COLOR[stage] + '" rx="1"><title>' + _esc(STAGE_LABEL[stage] || stage) + ' · ' + Math.round(dur / 60) + ' min</title></rect>';
    }).join('');
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="none" role="img" aria-label="Hypnogramm: Schlafphasen im Zeitverlauf (Spuren: Tief, Leicht, REM, Wach)">' + rects + '</svg>';
    if (opts.plain) return svg;
    /* Phase 4 (P2-3): Spurenbeschriftung als HTML-Spalte NEBEN dem SVG — Text im
       preserveAspectRatio="none"-SVG wuerde mitverzerrt. Reihenfolge = STAGE_LANE. */
    var laneNames = ['deep', 'light', 'rem', 'awake'];
    var labels = laneNames.map(function (s) {
      return '<span style="flex:1;display:flex;align-items:center;gap:4px"><i style="width:7px;height:7px;border-radius:2px;background:' + STAGE_COLOR[s] + ';flex:0 0 auto"></i>' + _esc(STAGE_LABEL[s]) + '</span>';
    }).join('');
    return '<div style="display:flex;gap:8px;align-items:stretch">' +
      '<div style="display:flex;flex-direction:column;font-size:9px;color:var(--faint,#8a93a1);font-weight:650;line-height:1;flex:0 0 auto">' + labels + '</div>' +
      '<div style="flex:1;min-width:0">' + svg + '</div></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--faint,#8a93a1);font-weight:650;margin-top:3px"><span>Einschlafen</span><span>Zeitverlauf der Nacht →</span><span>Aufwachen</span></div>';
  };

  Reader.renderCurve = function (points, opts) {
    opts = opts || {};
    var W = opts.width || 300, H = opts.height || 48, pad = 2;
    var pts = _sortDedupePoints(points || []);
    if (pts.length < 2) return '';
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var xr = (x1 - x0) || 1, yr = (y1 - y0) || 1;
    var d = pts.map(function (p, i) {
      var x = pad + (p[0] - x0) / xr * (W - 2 * pad);
      var y = H - pad - (p[1] - y0) / yr * (H - 2 * pad);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    var color = opts.color || 'var(--ready)';
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="none" role="img" aria-label="' + _esc(opts.label || 'Verlauf') + '"><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.6"/></svg>';
    /* GM7.6 (additiv): ehrliche Achsenbeschriftung aus den ECHTEN Punkten — Min/Max der
       gespeicherten Werte und die relative Zeitspanne (Serien-Offsets ab Serienbeginn;
       ein absoluter Startzeitpunkt ist nicht persistiert und wird nicht erfunden). */
    if (opts.axes) {
      var fmtV = function (v) { return (Math.round(v * 10) / 10).toString().replace('.', ','); };
      var spanS = x1 - x0, spanTxt = spanS >= 5400 ? (Math.round(spanS / 360) / 10).toString().replace('.', ',') + ' h' : Math.round(spanS / 60) + ' min';
      var u = opts.unit ? ' ' + _esc(opts.unit) : '';
      svg += '<div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--faint);font-weight:650;margin-top:3px">' +
        '<span>0</span><span>Min ' + fmtV(y0) + u + ' · Max ' + fmtV(y1) + u + '</span><span>' + spanTxt + '</span></div>';
    }
    return svg;
  };

  Reader.STAGE_COLOR = STAGE_COLOR;   // Phase 4 (P2-3): eine Farb-/Label-Quelle fuer alle Schlafphasen-Darstellungen
  Reader.STAGE_LABEL = STAGE_LABEL;
  root.ORVIA.seriesReader = Reader;
  if (typeof module !== 'undefined' && module.exports) module.exports = Reader;
})();
