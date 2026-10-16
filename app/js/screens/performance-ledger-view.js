/* ============================================================
   ORVIA · performance-ledger-view (v8-448A, VORBEREITET) — Ansicht „Leistungsentwicklung".

   Zeigt NUR, was das Register belegt: aus performanceLedger.readModel(). Keine Beispielwerte, keine
   Platzhalter-Rekorde — ohne Daten ein ehrlicher Leerzustand. Nicht ausgeliefert; erscheint erst,
   wenn das Flag `performance_ledger` an ist und v8-448B die Ansicht einhaengt.

   Gestaltung (ORVIA-Regel seit v8-444): Sportfarbe gehoert den DATEN (Verlaufslinie, Punkte),
   Gold gehoert ORVIA (Haarlinien, Rahmen, „ORVIA-Bestwert"). Werte und Texte in Texttoenen, nie in
   der Sportfarbe. Eine Linie je Diagramm, eine Achse; bei „niedriger ist besser" zeigt die Achse
   nach oben zu schnelleren Zeiten, beschriftet mit den echten Werten. Jeder Punkt hat einen Hinweis
   (Hover/Fokus), jedes Diagramm eine Tabellenform („Verlauf").

   render(model, opts) → HTML-Text (rein, in node pruefbar) · mount(el, model, opts) → einsetzen.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var SPORT_LABEL = { running: 'Laufen', cycling: 'Radfahren', swimming: 'Schwimmen', gym: 'Krafttraining', walking: 'Gehen', hiking: 'Wandern',
    rowing: 'Rudern', triathlon: 'Triathlon', football: 'Fußball', handball: 'Handball', padel: 'Padel', tennis: 'Tennis', athletics: 'Leichtathletik',
    basketball: 'Basketball', mobility: 'Mobility', volleyball: 'Volleyball', hockey: 'Hockey', rugby: 'Rugby', badminton: 'Badminton', golf: 'Golf',
    climbing: 'Klettern', yoga: 'Yoga', hyrox: 'HYROX' };
  var CLASS_LABEL = { indoor: 'Indoor / Laufband', virtual: 'Virtuell', pool: 'Becken', open_water: 'Freiwasser' };
  var REASON_LABEL = { unverified_semantics: 'Bedeutung der Garmin-Quelle noch nicht belegt', missing_data: 'Wert fehlt', legacy_schema: 'noch nicht nachgeladen',
    insufficient_resolution: 'Auflösung reicht nicht', unsupported_source: 'Quelle kann das nicht tragen', not_completed: 'nicht abgeschlossen',
    invalid_time_axis: 'Zeitachse ungültig', manual_override_conflict: 'Korrektur widerspricht der Aufzeichnung', unverified_context: 'Kontext nicht belegt' };

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
    var txt = (k === 'fastest_time' || k === 'lowest') ? (rec.unit === 's' ? (d >= 60 ? fmtTime(d) : Math.round(d) + ' s') + ' schneller' : d + ' besser')
      : k === 'longest_duration' ? fmtDuration(d) + ' länger' : k === 'longest_distance' ? fmtDist(d, null) + ' weiter'
      : k === 'greatest_volume' ? Math.round(d).toLocaleString('de-DE') + ' kg mehr' : '+' + Math.round(d) + (rec.unit ? ' ' + rec.unit : '');
    return txt;
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : esc(iso);
  }
  function themeAttr(sport) {
    try { if (O.activityTheme && O.activityTheme.attr) return O.activityTheme.attr(sport); } catch (e) {}
    return 'data-activity="brand"';
  }

  /* Stufenlinie der Bestleistung ueber die Zeit — eine Serie, eine Achse. */
  function chart(rec, sport) {
    var ev = (rec.history || []).filter(function (e) { return e.type !== 'equalled'; });
    if (ev.length < 2) return '';
    var W = 320, H = 112, L = 44, R = 10, T = 12, B = 22;
    var xs = ev.map(function (e) { return Date.parse(e.localDate + 'T12:00:00Z'); });
    var x0 = xs[0], x1 = xs[xs.length - 1], span = Math.max(x1 - x0, 86400000);
    var vs = ev.map(function (e) { return e.value; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), pad0 = (hi - lo) * 0.12 || Math.abs(hi) * 0.05 || 1;
    lo -= pad0; hi += pad0;
    var lowerBetter = rec.better === 'lower';
    var X = function (t) { return L + (W - L - R) * (t - x0) / span; };
    var Y = function (v) { var f = (v - lo) / (hi - lo); return lowerBetter ? T + (H - T - B) * f : H - B - (H - T - B) * f; };
    var d = '';
    ev.forEach(function (e, i) {
      var x = X(xs[i]).toFixed(1), y = Y(e.value).toFixed(1);
      d += i === 0 ? 'M' + x + ' ' + y : ' H' + x + ' V' + y;
    });
    d += ' H' + (W - R);
    var pts = ev.map(function (e, i) {
      var tip = fmtDate(e.localDate) + ' · ' + fmtValue(e.value, rec.kind, rec.unit, sport) + (e.improvement ? ' · ' + fmtImprovement({ improvement: e.improvement, kind: rec.kind, unit: rec.unit }) : ' · erster Wert');
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
    var summary = rec.label + ': ' + ev.length + ' Bestleistungen von ' + fmtValue(ev[0].value, rec.kind, rec.unit, sport) + ' (' + fmtDate(ev[0].localDate) + ') bis '
      + fmtValue(ev[ev.length - 1].value, rec.kind, rec.unit, sport) + ' (' + fmtDate(ev[ev.length - 1].localDate) + ')';
    return '<svg class="plv-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(summary) + '">' + grid + axis
      + '<path class="plv-line" d="' + d + '"/><g role="list">' + pts + '</g></svg>';
  }

  function recordCard(rec, sport) {
    var best = rec.best;
    var badges = [];
    if (CLASS_LABEL[rec.contextClass]) badges.push('<span class="plv-badge">' + esc(CLASS_LABEL[rec.contextClass]) + '</span>');
    if (best && best.manual) badges.push('<span class="plv-badge plv-badge-manual">manuell korrigiert</span>');
    var imp = rec.improvement != null && rec.previous
      ? '<p class="plv-imp"><strong>' + esc(fmtImprovement(rec)) + '</strong> als ' + esc(fmtValue(rec.previous.value, rec.kind, rec.unit, sport)) + ' vom ' + esc(fmtDate(rec.previous.localDate)) + '</p>'
      : '<p class="plv-imp plv-imp-first">' + (rec.equalledSinceBest > 0 ? 'Seit dem ersten Wert nicht übertroffen · ' + rec.equalledSinceBest + '× eingestellt' : 'Erster belegter Wert') + '</p>';
    var rows = (rec.history || []).map(function (e) {
      var t = e.type === 'first' ? 'erster Wert' : e.type === 'equalled' ? 'eingestellt' : fmtImprovement({ improvement: e.improvement, kind: rec.kind, unit: rec.unit });
      return '<tr><td>' + esc(fmtDate(e.localDate)) + '</td><td class="plv-num">' + esc(fmtValue(e.value, rec.kind, rec.unit, sport)) + '</td><td>' + esc(t) + (e.manual ? ' · manuell' : '') + '</td></tr>';
    }).join('');
    return '<article class="plv-card" data-metric="' + esc(rec.metricKey) + '">'
      + '<header class="plv-card-h"><h4>' + esc(rec.label) + '</h4>' + badges.join('') + '</header>'
      + '<div class="plv-hero"><span class="plv-val">' + esc(fmtValue(best && best.value, rec.kind, rec.unit, sport)) + '</span>'
      + '<span class="plv-date">' + esc(fmtDate(best && best.localDate)) + '</span></div>'
      + imp + chart(rec, sport)
      + '<details class="plv-hist"><summary>Verlauf (' + (rec.history || []).length + ')</summary><table><thead><tr><th>Datum</th><th>Wert</th><th>Änderung</th></tr></thead><tbody>' + rows + '</tbody></table></details>'
      + '</article>';
  }

  function render(model, opts) {
    var o = opts || {}, m = model || { empty: true, sports: [], milestones: [], waiting: [] };
    var out = ['<section class="plv" aria-labelledby="plv-title">',
      '<header class="plv-head"><h2 id="plv-title">Leistungsentwicklung</h2>',
      '<p class="plv-sub">Belegte ORVIA-Bestwerte — aus deinen Aktivitäten, nach ihrem tatsächlichen Datum. Was vor ORVIA lag, ist nicht enthalten.</p></header>'];
    if (m.empty) {
      out.push('<div class="plv-empty" role="status"><div class="plv-empty-mark" aria-hidden="true"></div>'
        + '<h3>Noch keine belegten Bestwerte</h3>'
        + '<p>Sobald eine abgeschlossene Aktivität einen geprüften Wert liefert, beginnt hier deine Entwicklung — mit Datum, Vorgänger und Verbesserung. Geschätzte oder ungeprüfte Werte erscheinen nicht.</p></div>');
    }
    (m.sports || []).forEach(function (s) {
      out.push('<section class="plv-sport" ' + themeAttr(s.sport) + ' aria-label="' + esc(SPORT_LABEL[s.sport] || s.sport) + '">'
        + '<h3 class="plv-sport-h">' + esc(SPORT_LABEL[s.sport] || s.sport) + (s.coverageFrom ? '<span class="plv-scope">ORVIA-Bestwerte seit ' + esc(fmtDate(s.coverageFrom)) + '</span>' : '') + '</h3>'
        + '<div class="plv-grid">' + s.records.map(function (r) { return recordCard(r, s.sport); }).join('') + '</div></section>');
    });
    if ((m.milestones || []).length) {
      out.push('<section class="plv-ms" aria-label="Meilensteine"><h3 class="plv-sport-h">Meilensteine</h3><ol>'
        + m.milestones.slice().reverse().slice(0, o.milestoneLimit || 12).map(function (x) {
          return '<li><span class="plv-ms-date">' + esc(fmtDate(x.localDate)) + '</span><span class="plv-ms-label">' + esc(x.label) + '</span>'
            + '<span class="plv-num">' + esc(x.unit === 'm' ? fmtDist(x.value, null) : String(x.value)) + (x.detail && x.detail.lowerBound ? ' <em>mindestens</em>' : '') + '</span></li>';
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
      out.push('<details class="plv-wait"><summary>Noch nicht freigegeben (' + gl.length + ')</summary><ul>'
        + gl.map(function (g) {
          return '<li><span>' + esc((SPORT_LABEL[g.sport] || g.sport) + ': ' + g.defs.sort(function (a, b) { return a.at - b.at; }).map(function (x) { return x.label; }).join(', ')) + '</span><span class="plv-muted">' + esc(REASON_LABEL[g.reason] || g.reason) + ' · ' + g.activities + ' Aktivität' + (g.activities === 1 ? '' : 'en') + '</span></li>';
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
    '@media (max-width:420px){.plv-val{font-size:27px}.plv-grid{grid-template-columns:1fr}}'
  ].join('\n');

  function mount(el, model, opts) {
    if (!el || typeof document === 'undefined') return false;
    if (!document.getElementById('plv-style')) {
      var st = document.createElement('style'); st.id = 'plv-style'; st.textContent = CSS; document.head.appendChild(st);
    }
    el.innerHTML = render(model, opts);
    return true;
  }

  var api = { render: render, mount: mount, CSS: CSS, fmtValue: fmtValue, fmtTime: fmtTime, fmtImprovement: fmtImprovement };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.performanceLedgerView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
