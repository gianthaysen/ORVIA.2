/* ============================================================
   ORVIA · performance-ledger-view (v8-448B) — Ansicht „Leistungsentwicklung" (nur mit Flag performance_ledger).

   Zeigt NUR, was das Register belegt: aus performanceLedger.readModel(). Keine Beispielwerte, keine
   Platzhalter-Rekorde — ohne Daten ein ehrlicher Leerzustand. Seit v8-448B ausgeliefert; erreichbar
   nur mit Flag `performance_ledger` (Profil → Bestzeiten → Leistungsentwicklung).

   Gestaltung (ORVIA-Regel seit v8-444): Sportfarbe gehoert den DATEN (Verlaufslinie, Punkte),
   Gold gehoert ORVIA (Haarlinien, Rahmen, „ORVIA-Bestwert"). Werte und Texte in Texttoenen, nie in
   der Sportfarbe. Eine Linie je Diagramm, eine Achse; bei „niedriger ist besser" zeigt die Achse
   nach oben zu schnelleren Zeiten, beschriftet mit den echten Werten. Jeder Punkt hat einen Hinweis
   (Hover/Fokus), jedes Diagramm eine Tabellenform („Verlauf").

   Texte: nur ueber ORVIA.i18n.t(), Schluessel ledger.* in locales/de.js.
   render(model, opts) → HTML-Text (rein, in node pruefbar) · mount(el, model, opts) → einsetzen.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  /* Texte nur ueber t() (Regel seit v8-368, locales/de.js, Schluessel ledger.*). Ohne i18n: der Schluessel. */
  function T(k, p) { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); }
  function has(k) { return T(k) !== String(k); }                       // t() faellt auf de zurueck; nur der Schluessel = unbekannt
  function sportLabel(sp) { return has('ledger.sport.' + sp) ? T('ledger.sport.' + sp) : String(sp); }
  function classLabel(c) { return c && has('ledger.class.' + c) ? T('ledger.class.' + c) : null; }
  function reasonLabel(r) { return has('ledger.reason.' + r) ? T('ledger.reason.' + r) : String(r); }
  function sourceLabel(x) { return x && has('ledger.source.' + x) ? T('ledger.source.' + x) : (x || '—'); }
  function validLabel(x) { return x && has('ledger.valid.' + x) ? T('ledger.valid.' + x) : (x || '—'); }
  function qualityLabel(x) { return x && has('ledger.quality.' + x) ? T('ledger.quality.' + x) : null; }
  function acts(n) { return T('ledger.activities', { count: n }); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(s) {
    s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? h + ':' + pad(m) + ':' + pad(x) : m + ':' + pad(x);
  }
  function fmtDuration(s) { s = Math.round(s); var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + ' h ' + pad(m) + ' min' : m + ' min'; }
  function fmtDist(m, sport) {
    if (sport === 'swimming' || m < 1000) return Math.round(m).toLocaleString('de-DE') + ' m';
    return (m / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
  }
  function fmtValue(v, kind, unit, sport) {
    if (v == null) return '—';
    if (kind === 'fastest_time' || kind === 'lowest') return unit === 's' ? fmtTime(v) : String(v);
    if (kind === 'longest_duration') return fmtDuration(v);
    if (kind === 'longest_distance') return fmtDist(v, sport);
    if (kind === 'greatest_volume') return Math.round(v).toLocaleString('de-DE') + ' kg';
    if (unit === 'W') return Math.round(v) + ' W';
    return String(Math.round(v * 10) / 10) + (unit ? ' ' + unit : '');
  }
  function fmtImprovement(rec) {
    if (rec.improvement == null) return '';
    var d = rec.improvement, k = rec.kind;
    var txt = (k === 'fastest_time' || k === 'lowest') ? (rec.unit === 's' ? T('ledger.imp.faster', { d: d >= 60 ? fmtTime(d) : Math.round(d) + ' s' }) : T('ledger.imp.better', { d: d }))
      : k === 'longest_duration' ? T('ledger.imp.longer', { d: fmtDuration(d) }) : k === 'longest_distance' ? T('ledger.imp.further', { d: fmtDist(d, null) })
      : k === 'greatest_volume' ? T('ledger.imp.more', { d: Math.round(d).toLocaleString('de-DE') + ' kg' }) : '+' + Math.round(d) + (rec.unit ? ' ' + rec.unit : '');
    return txt;
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : esc(iso);
  }
  function basisLabel(b) {
    b = String(b || '');
    if (/best_efforts\.distance\.targets/.test(b)) return T('ledger.basis.bestDistance');
    if (/best_efforts\.power\.windows/.test(b)) return T('ledger.basis.bestPower');
    if (/^corrections\./.test(b)) return T('ledger.basis.correction');
    if (/summary\.distanceM, gestuetzt durch streams\.distance/.test(b)) return T('ledger.basis.distanceChecked');
    if (/duration_seconds, gestuetzt durch garmin\.timer_duration_s/.test(b)) return T('ledger.basis.durationChecked');
    if (/^summary\.|^duration_seconds$/.test(b)) return T('ledger.basis.ownInput');
    return b || '—';
  }
  function precisionLabel(p, unit) {
    if (!p) return '';
    var n = String(p).replace('.', ',');
    return T('ledger.precision', { n: n, unit: unit || '' }).trim();
  }
  function utcTime(iso) { return iso ? String(iso).slice(11, 16) + ' UTC' : ''; }
  function themeAttr(sport) {
    try { if (O.activityTheme && O.activityTheme.attr) return O.activityTheme.attr(sport); } catch (e) {}
    return 'data-activity="brand"';
  }

  /* Stufenlinie der Bestleistung ueber die Zeit — eine Serie, eine Achse. */
  function chart(rec, sport) {
    var ev = (rec.history || []).filter(function (e) { return e.type !== 'equalled'; });
    if (ev.length < 2) return '';
    var W = 320, H = 112, L = 44, R = 10, TP = 12, B = 22;
    var xs = ev.map(function (e) { var t = Date.parse(e.utc || ''); return isFinite(t) ? t : Date.parse(e.localDate + 'T12:00:00Z'); });
    var x0 = xs[0], x1 = xs[xs.length - 1], span = Math.max(x1 - x0, 86400000);
    var vs = ev.map(function (e) { return e.value; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), pad0 = (hi - lo) * 0.12 || Math.abs(hi) * 0.05 || 1;
    lo -= pad0; hi += pad0;
    var lowerBetter = rec.better === 'lower';
    var X = function (t) { return L + (W - L - R) * (t - x0) / span; };
    var Y = function (v) { var f = (v - lo) / (hi - lo); return lowerBetter ? TP + (H - TP - B) * f : H - B - (H - TP - B) * f; };
    var d = '';
    ev.forEach(function (e, i) {
      var x = X(xs[i]).toFixed(1), y = Y(e.value).toFixed(1);
      d += i === 0 ? 'M' + x + ' ' + y : ' H' + x + ' V' + y;
    });
    d += ' H' + (W - R);
    var pts = ev.map(function (e, i) {
      var tip = fmtDate(e.localDate) + ' · ' + fmtValue(e.value, rec.kind, rec.unit, sport) + ' · ' + (e.improvement ? fmtImprovement({ improvement: e.improvement, kind: rec.kind, unit: rec.unit }) : T('ledger.firstValue'));
      return '<g class="plv-pt" tabindex="0" role="listitem" aria-label="' + esc(tip) + '"><title>' + esc(tip) + '</title>'
        + '<circle class="plv-hit" cx="' + X(xs[i]).toFixed(1) + '" cy="' + Y(e.value).toFixed(1) + '" r="12"/>'
        + '<circle class="plv-dot" cx="' + X(xs[i]).toFixed(1) + '" cy="' + Y(e.value).toFixed(1) + '" r="4"/></g>';
    }).join('');
    /* Achse beschriftet mit ECHTEN Werten (erster Wert und Bestwert) an ihrer Hoehe — nie mit Rand-Zuschlaegen */
    var vFirst = ev[0].value, vBest = ev[ev.length - 1].value;
    var axis = '<text class="plv-ax" x="' + (L - 6) + '" y="' + (Y(vBest) + 3).toFixed(1) + '" text-anchor="end">' + esc(fmtValue(vBest, rec.kind, rec.unit, sport)) + '</text>'
      + '<text class="plv-ax" x="' + (L - 6) + '" y="' + (Y(vFirst) + 3).toFixed(1) + '" text-anchor="end">' + esc(fmtValue(vFirst, rec.kind, rec.unit, sport)) + '</text>'
      + '<text class="plv-ax" x="' + L + '" y="' + (H - 6) + '">' + esc(fmtDate(ev[0].localDate)) + '</text>'
      + '<text class="plv-ax" x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(fmtDate(ev[ev.length - 1].localDate)) + '</text>';
    var grid = '<line class="plv-gridline" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/>';
    var summary = T('ledger.chart.summary', { label: rec.label, n: ev.length, from: fmtValue(ev[0].value, rec.kind, rec.unit, sport), fromDate: fmtDate(ev[0].localDate),
      to: fmtValue(ev[ev.length - 1].value, rec.kind, rec.unit, sport), toDate: fmtDate(ev[ev.length - 1].localDate) });
    return '<svg class="plv-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(summary) + '">' + grid + axis
      + '<path class="plv-line" pathLength="1" d="' + d + '"/><g role="list">' + pts + '</g></svg>';
  }

  function recordCard(rec, sport, opts3) {
    var best = rec.best;
    var badges = [];
    if (classLabel(rec.contextClass)) badges.push('<span class="plv-badge">' + esc(classLabel(rec.contextClass)) + '</span>');
    if (best && best.manual) badges.push('<span class="plv-badge plv-badge-manual">' + esc(T('ledger.badge.manual')) + '</span>');
    var imp = rec.improvement != null && rec.previous
      ? '<p class="plv-imp"><strong>' + esc(fmtImprovement(rec)) + '</strong> ' + esc(T('ledger.card.over', { prev: fmtValue(rec.previous.value, rec.kind, rec.unit, sport), date: fmtDate(rec.previous.localDate) })) + '</p>'
      : '<p class="plv-imp plv-imp-first">' + esc(rec.equalledSinceBest > 0 ? T('ledger.card.unbeaten', { n: rec.equalledSinceBest }) : T('ledger.card.first')) + '</p>';
    var rows = (rec.history || []).map(function (e) {
      var t = e.type === 'first' ? T('ledger.firstValue') : e.type === 'equalled' ? T('ledger.hist.equalled') : fmtImprovement({ improvement: e.improvement, kind: rec.kind, unit: rec.unit });
      return '<tr><td>' + esc(fmtDate(e.localDate)) + '</td><td class="plv-num">' + esc(fmtValue(e.value, rec.kind, rec.unit, sport)) + '</td><td>' + esc(t + (e.manual ? ' · ' + T('ledger.hist.manual') : '')) + '</td></tr>';
    }).join('');
    var pv = rec.provenance || null, o2 = opts3 || {};
    var prov = '';
    if (pv) {
      var ctx = pv.context || {};
      var act = esc(fmtDate(pv.localDate)) + (pv.localTime ? ', ' + esc(T('ledger.prov.clock', { time: pv.localTime })) : '') + (pv.utc ? ' <span class="plv-muted">(' + esc(utcTime(pv.utc)) + ')</span>' : '')
        + (o2.onOpenActivity ? ' <button type="button" class="plv-link" data-activity-id="' + esc(pv.activityId) + '" onclick="' + esc(o2.onOpenActivity) + '(\'' + esc(pv.activityId) + '\')">' + esc(T('ledger.prov.open')) + '</button>' : '');
      var rowsP = [
        [T('ledger.prov.activity'), act],
        [T('ledger.prov.source'), esc(sourceLabel(pv.source)) + (ctx.typeKey ? ' <span class="plv-muted">· ' + esc(T('ledger.prov.type', { type: ctx.typeKey })) + '</span>' : '')],
        [T('ledger.prov.basis'), esc(basisLabel(pv.basis))],
        [T('ledger.prov.accuracy'), esc([qualityLabel(pv.quality), pv.precision ? T('ledger.prov.compare', { p: precisionLabel(pv.precision, pv.unit) }) : null].filter(Boolean).join(' · ') || '—')],
        [T('ledger.prov.validation'), esc(validLabel(pv.validation))],
        [T('ledger.prov.context'), esc(classLabel(rec.contextClass) || (rec.contextClass === 'all' ? T('ledger.ctx.all') : T('ledger.ctx.standard'))) + (ctx.basis ? ' <span class="plv-muted">· ' + esc(ctx.basis) + '</span>' : '')],
        [T('ledger.prov.scopeLabel'), esc(T('ledger.prov.scope', { date: fmtDate(rec.coverageFrom) }))]
      ];
      prov = '<details class="plv-prov"><summary>' + esc(T('ledger.prov.title')) + '</summary><dl>' + rowsP.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl></details>';
    }
    var decl = rec.declared ? '<p class="plv-decl">' + esc(T(rec.declared.betterThanOrvia ? 'ledger.decl.better' : 'ledger.decl.plain')) + ' '
      + '<strong>' + esc(fmtValue(rec.declared.value, rec.kind, rec.unit, sport)) + '</strong>' + (rec.declared.measuredAt ? ' (' + esc(fmtDate(rec.declared.measuredAt)) + ')' : '')
      + ' <span class="plv-muted">· ' + esc(T('ledger.decl.note')) + '</span></p>' : '';
    return '<article class="plv-card" data-metric="' + esc(rec.metricKey) + '">'
      + '<header class="plv-card-h"><h4>' + esc(rec.label) + '</h4>' + badges.join('') + '</header>'
      + '<div class="plv-hero"><span class="plv-val">' + esc(fmtValue(best && best.value, rec.kind, rec.unit, sport)) + '</span>'
      + '<span class="plv-date">' + esc(fmtDate(best && best.localDate)) + '</span></div>'
      + imp + decl + chart(rec, sport) + prov
      + '<details class="plv-hist"><summary>' + esc(T('ledger.hist.title', { n: (rec.history || []).length })) + '</summary><table><thead><tr><th>' + esc(T('ledger.hist.date')) + '</th><th>' + esc(T('ledger.hist.value')) + '</th><th>' + esc(T('ledger.hist.change')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></details>'
      + '</article>';
  }

  /* Sportuebersicht: Zahlen, keine Wertung. */
  function overview(s) {
    var ov = s.overview; if (!ov || !ov.records) return '';
    var li = ov.lastImprovement;
    return '<div class="plv-ov"><div><b>' + ov.records + '</b><span>' + esc(T('ledger.ov.records')) + '</span></div><div><b>' + ov.improvements + '</b><span>' + esc(T('ledger.ov.improvements')) + '</span></div>'
      + '<div><b>' + (li ? esc(fmtDate(li.localDate)) : '—') + '</b><span>' + esc(T('ledger.ov.last')) + '</span></div></div>';
  }
  /* Langfristige Entwicklung: Distanz je Monat (letzte 12 Monate mit Daten), nur geprüfte Werte. */
  function volume(s) {
    var v = (s.volume || []).slice(-12);
    if (v.length < 2 || !v.some(function (m) { return m.distanceM > 0; })) return '';
    var W = 320, H = 70, B = 16, gap = 2, bw = (W - gap * (v.length - 1)) / v.length;
    var mx = Math.max.apply(null, v.map(function (m) { return m.distanceM; })) || 1;
    var bars = v.map(function (m, i) {
      var h = Math.max(1, (H - B - 4) * m.distanceM / mx), x = i * (bw + gap), y = H - B - h;
      var tip = m.month.slice(5) + '/' + m.month.slice(0, 4) + ' · ' + fmtDist(m.distanceM, s.sport) + ' · ' + acts(m.activities) + (m.lowerBound ? ' · ' + T('ledger.vol.lowerBound') : '');
      return '<g class="plv-bar" tabindex="0" role="listitem" aria-label="' + esc(tip) + '"><title>' + esc(tip) + '</title>'
        + '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3"' + (m.lowerBound ? ' class="plv-bar-lb"' : '') + '/></g>';
    }).join('');
    var lab = '<text class="plv-ax" x="0" y="' + (H - 3) + '">' + esc(v[0].month.slice(5) + '/' + v[0].month.slice(2, 4)) + '</text>'
      + '<text class="plv-ax" x="' + W + '" y="' + (H - 3) + '" text-anchor="end">' + esc(v[v.length - 1].month.slice(5) + '/' + v[v.length - 1].month.slice(2, 4)) + '</text>';
    return '<figure class="plv-vol"><figcaption>' + esc(T('ledger.vol.title')) + ' <span class="plv-muted">· ' + esc(T('ledger.vol.note', { max: fmtDist(mx, s.sport) })) + '</span></figcaption>'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(T('ledger.vol.title')) + '"><g role="list">' + bars + '</g>' + lab + '</svg></figure>';
  }

  function render(model, opts) {
    var o = opts || {}, m = model || { empty: true, sports: [], milestones: [], waiting: [] };
    var out = ['<section class="plv"' + (o.noHead ? ' aria-label="' + esc(T('ledger.title')) + '"' : ' aria-labelledby="plv-title"') + '>',
      (o.noHead ? '' : '<header class="plv-head"><h2 id="plv-title">' + esc(T('ledger.title')) + '</h2>'),
      '<p class="plv-sub">' + esc(T('ledger.sub')) + '</p>' + (o.noHead ? '' : '</header>')];
    if (m.empty) {
      out.push('<div class="plv-empty" role="status"><div class="plv-empty-mark" aria-hidden="true"></div>'
        + '<h3>' + esc(T('ledger.empty.title')) + '</h3>'
        + '<p>' + esc(T('ledger.empty.text')) + '</p></div>');
    }
    (m.sports || []).forEach(function (s) {
      out.push('<section class="plv-sport" ' + themeAttr(s.sport) + ' aria-label="' + esc(sportLabel(s.sport)) + '">'
        + '<h3 class="plv-sport-h">' + esc(sportLabel(s.sport)) + (s.coverageFrom ? '<span class="plv-scope">' + esc(T('ledger.scope', { date: fmtDate(s.coverageFrom) })) + '</span>' : '') + '</h3>'
        + overview(s) + volume(s)
        + (s.records.length ? '<div class="plv-grid">' + s.records.map(function (r) { return recordCard(r, s.sport, o); }).join('') + '</div>' : '') + '</section>');
    });
    if ((m.milestones || []).length) {
      out.push('<section class="plv-ms" aria-label="' + esc(T('ledger.ms.title')) + '"><h3 class="plv-sport-h">' + esc(T('ledger.ms.title')) + '</h3><ol>'
        + m.milestones.slice().reverse().slice(0, o.milestoneLimit || 12).map(function (x) {
          return '<li><span class="plv-ms-date">' + esc(fmtDate(x.localDate)) + '</span><span class="plv-ms-label">' + esc(x.label) + '</span>'
            + '<span class="plv-num">' + esc(x.unit === 'm' ? fmtDist(x.value, null) : String(x.value)) + (x.detail && x.detail.lowerBound ? ' <em>' + esc(T('ledger.ms.lowerBound')) + '</em>' : '') + '</span></li>';
        }).join('') + '</ol></section>');
    }
    /* Nur, was auf einen BELEG wartet (Census, Bedeutungspruefung, Nachladen). „Wert fehlt" oder „Quelle kann das nicht"
       ist kein Warten — das bleibt so, bis andere Daten kommen. Je Sportart und Grund eine Zeile. */
    var WAIT = { unverified_semantics: 1, legacy_schema: 1, insufficient_resolution: 1, unverified_context: 1 };
    var groups = {};
    (m.waiting || []).forEach(function (w) {
      if (!WAIT[w.reason]) return;
      var k = w.sport + '|' + w.reason, g = groups[k] || (groups[k] = { sport: w.sport, reason: w.reason, defs: [], activities: 0 });
      var d = O.performanceLedger && O.performanceLedger.defById ? O.performanceLedger.defById(w.defId) : null;
      g.defs.push({ label: d ? d.label : w.defId, at: O.performanceLedger ? O.performanceLedger.DEFS.indexOf(d) : 0 }); g.activities = Math.max(g.activities, w.activities);
    });
    var gl = Object.keys(groups).sort().map(function (k) { return groups[k]; });
    if (gl.length) {
      out.push('<details class="plv-wait"><summary>' + esc(T('ledger.wait.title', { n: gl.length })) + '</summary><ul>'
        + gl.map(function (g) {
          return '<li><span>' + esc(sportLabel(g.sport) + ': ' + g.defs.sort(function (a, b) { return a.at - b.at; }).map(function (x) { return x.label; }).join(', ')) + '</span><span class="plv-muted">' + esc(reasonLabel(g.reason) + ' · ' + acts(g.activities)) + '</span></li>';
        }).join('') + '</ul></details>');
    }
    out.push('</section>');
    return out.join('');
  }

  var CSS = [
    '.plv{color:var(--orvia-text-primary,#F4F2ED);padding:8px 16px 32px;max-width:960px;margin:0 auto}',
    '.plv-head h2{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:8px 0 4px;text-transform:none;color:var(--orvia-text-primary,#F4F2ED)}',
    '.plv-sub{color:var(--orvia-text-secondary,#ADB5C1);font-size:13px;line-height:1.45;margin:0 0 18px;max-width:56ch}',
    '.plv-sport{margin:22px 0 0}',
    '.plv-sport-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:var(--orvia-text-secondary,#ADB5C1);margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid rgba(216,187,122,.18)}',
    '.plv-scope{letter-spacing:.02em;text-transform:none;font-weight:600;color:var(--orvia-text-tertiary,#737E8C);font-size:12px}',
    '.plv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;align-items:start}',
    '.plv-ms{margin-top:26px}',
    '.plv-card{background:var(--orvia-panel-bg,linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.012)));border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px 14px 10px;position:relative;overflow:hidden}',
    '.plv-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--activity-primary,#D8BB7A);opacity:.85}',
    '.plv-card-h{display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
    '.plv-card-h h4{margin:0;font-size:13px;font-weight:700;color:var(--orvia-text-secondary,#ADB5C1)}',
    '.plv-badge{font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.12);color:var(--orvia-text-secondary,#ADB5C1)}',
    '.plv-badge-manual{border-color:rgba(216,187,122,.4);color:var(--orvia-brand-gold-light,#E8D19A)}',
    '.plv-hero{display:flex;align-items:baseline;gap:10px;margin:8px 0 2px}',
    '.plv-val{font-size:30px;font-weight:850;letter-spacing:-.03em;font-variant-numeric:tabular-nums}',
    '.plv-date{font-size:12px;color:var(--orvia-text-tertiary,#737E8C);font-variant-numeric:tabular-nums}',
    '.plv-imp{margin:0 0 6px;font-size:12.5px;color:var(--orvia-text-secondary,#ADB5C1)}',
    '.plv-imp strong{color:var(--orvia-text-primary,#F4F2ED);font-weight:700}',
    '.plv-chart{display:block;width:100%;height:auto;margin:4px 0 2px;overflow:visible}',
    '.plv-line{fill:none;stroke:var(--activity-primary,#D8BB7A);stroke-width:2;stroke-linejoin:round}',
    '.plv-dot{fill:var(--activity-primary,#D8BB7A);stroke:var(--orvia-surface-1,#0E151F);stroke-width:2}',
    '.plv-hit{fill:transparent;cursor:default}',
    '.plv-pt:focus{outline:none}.plv-pt:focus .plv-dot,.plv-pt:hover .plv-dot{r:6}',
    '.plv-gridline{stroke:rgba(255,255,255,.08);stroke-width:1}',
    '.plv-ax{fill:var(--orvia-text-tertiary,#737E8C);font-size:10px;font-variant-numeric:tabular-nums}',
    '.plv-hist summary,.plv-wait summary{cursor:pointer;font-size:12px;color:var(--orvia-text-secondary,#ADB5C1);padding:6px 0;list-style-position:inside}',
    '.plv-hist table{width:100%;border-collapse:collapse;font-size:12px;margin:2px 0 4px}',
    '.plv-hist th{text-align:left;font-weight:700;color:var(--orvia-text-tertiary,#737E8C);padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)}',
    '.plv-hist td{padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);color:var(--orvia-text-secondary,#ADB5C1)}',
    '.plv-num{font-variant-numeric:tabular-nums;color:var(--orvia-text-primary,#F4F2ED)}',
    '.plv-ms ol{list-style:none;margin:0;padding:0}',
    '.plv-ms li{display:grid;grid-template-columns:86px 1fr auto;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px}',
    '.plv-ms-date{color:var(--orvia-text-tertiary,#737E8C);font-variant-numeric:tabular-nums}',
    '.plv-ms em{font-style:normal;color:var(--orvia-text-tertiary,#737E8C);font-size:11px}',
    '.plv-wait{margin-top:22px}',
    '.plv-wait ul{list-style:none;margin:0;padding:0}',
    '.plv-wait li{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12.5px}',
    '.plv-muted{color:var(--orvia-text-tertiary,#737E8C)}',
    '.plv-empty{text-align:center;padding:40px 18px;border:1px solid rgba(216,187,122,.16);border-radius:18px;background:var(--orvia-panel-bg,rgba(255,255,255,.03))}',
    '.plv-empty h3{font-size:17px;margin:14px 0 6px}',
    '.plv-empty p{color:var(--orvia-text-secondary,#ADB5C1);font-size:13px;line-height:1.5;max-width:44ch;margin:0 auto}',
    '.plv-empty-mark{width:44px;height:44px;margin:0 auto;border-radius:50%;border:1px solid rgba(216,187,122,.45);box-shadow:inset 0 0 0 8px rgba(216,187,122,.06)}',
    '.plv-ov{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 12px}',
    '.plv-ov div{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:9px 10px}',
    '.plv-ov b{display:block;font-size:17px;font-weight:800;font-variant-numeric:tabular-nums}',
    '.plv-ov span{display:block;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--orvia-text-tertiary,#737E8C);margin-top:2px}',
    '.plv-vol{margin:0 0 14px}',
    '.plv-vol figcaption{font-size:12px;color:var(--orvia-text-secondary,#ADB5C1);margin:0 0 6px}',
    '.plv-vol svg{display:block;width:100%;height:auto}',
    '.plv-bar rect{fill:var(--activity-primary,#D8BB7A);opacity:.82}',
    '.plv-bar rect.plv-bar-lb{opacity:.45}',
    '.plv-bar:hover rect,.plv-bar:focus rect{opacity:1}.plv-bar:focus{outline:none}',
    '.plv-prov summary{cursor:pointer;font-size:12px;color:var(--orvia-brand-gold-light,#E8D19A);padding:6px 0}',
    '.plv-prov dl{margin:2px 0 6px;font-size:12px}',
    '.plv-prov dl div{display:grid;grid-template-columns:104px 1fr;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04)}',
    '.plv-prov dt{color:var(--orvia-text-tertiary,#737E8C)}',
    '.plv-prov dd{margin:0;color:var(--orvia-text-secondary,#ADB5C1);overflow-wrap:anywhere}',
    '.plv-link{background:none;border:0;padding:0;margin-left:4px;color:var(--orvia-brand-gold-light,#E8D19A);font:inherit;text-decoration:underline;text-underline-offset:2px;cursor:pointer}',
    '.plv-decl{margin:0 0 6px;font-size:12px;color:var(--orvia-text-secondary,#ADB5C1)}',
    '.plv-decl strong{color:var(--orvia-text-primary,#F4F2ED)}',
    '@keyframes plvIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '@keyframes plvDraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}',
    '.plv-card{animation:plvIn .45s cubic-bezier(.2,.7,.2,1) both}',
    '.plv-line{stroke-dasharray:1;stroke-dashoffset:0;animation:plvDraw 1.1s cubic-bezier(.4,0,.2,1) .15s both}',
    '@media (prefers-reduced-motion:reduce){.plv-card,.plv-line{animation:none}}',
    '@media (max-width:420px){.plv-val{font-size:27px}.plv-grid{grid-template-columns:1fr}.plv-prov dl div{grid-template-columns:92px 1fr}}'
  ].join('\n');

  function mount(el, model, opts) {
    if (!el || typeof document === 'undefined') return false;
    if (!document.getElementById('plv-style')) {
      var st = document.createElement('style'); st.id = 'plv-style'; st.textContent = CSS; document.head.appendChild(st);
    }
    el.innerHTML = render(model, opts);
    return true;
  }

  function ensureStyle() {
    if (typeof document === 'undefined' || document.getElementById('plv-style')) return;
    var st = document.createElement('style'); st.id = 'plv-style'; st.textContent = CSS; document.head.appendChild(st);
  }
  var api = { render: render, mount: mount, ensureStyle: ensureStyle, CSS: CSS, fmtValue: fmtValue, fmtTime: fmtTime, fmtImprovement: fmtImprovement, basisLabel: basisLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.performanceLedgerView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
