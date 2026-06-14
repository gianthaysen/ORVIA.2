/* ============================================================
   ORVIA — Aktivität  (Phase 4)
   Aktivitäten-Liste, ORVIA Workout Card mit eigener SVG-Streckenkarte,
   Mock-Import mit Import-Animation, manuelle Aktivität.
   Liest/schreibt Trainings in DB[date].sessions[typ]; route optional.
   ============================================================ */

/* ---- Encoded-Polyline-Decoder (Google/Strava) → [[lat,lng],...] ---- */
function decodePolyline(str, precision) {
  if (!str) return [];
  var index = 0, lat = 0, lng = 0, out = [], shift, result, byte, factor = Math.pow(10, precision || 5);
  while (index < str.length) {
    shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    out.push([lat / factor, lng / factor]);
  }
  return out;
}

/* ---- ORVIA-eigene Streckenkarte als SVG (Gold-Linie, dunkel, ohne Tiles) ---- */
function routeSVG(pts) {
  if (!pts || pts.length < 2) return '';
  var lats = pts.map(function (p) { return p[0]; }), lngs = pts.map(function (p) { return p[1]; });
  var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
  var midLat = (minLat + maxLat) / 2, cos = Math.cos(midLat * Math.PI / 180);
  var xs = pts.map(function (p) { return (p[1]) * cos; });
  var ys = pts.map(function (p) { return -(p[0]); });
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  var W = 320, H = 180, pad = 20;
  var spanX = (maxX - minX) || 1e-6, spanY = (maxY - minY) || 1e-6;
  var scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  var offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
  var px = function (i) { return (offX + (xs[i] - minX) * scale).toFixed(1); };
  var py = function (i) { return (offY + (ys[i] - minY) * scale).toFixed(1); };
  var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + px(i) + ' ' + py(i); }).join(' ');
  var last = pts.length - 1;
  return '<svg class="rmap" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="16" fill="#0b121d"/>' +
    '<path d="' + d + '" fill="none" stroke="url(#orviaMarkGrad)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" filter="drop-shadow(0 0 5px rgba(201,174,124,.45))"/>' +
    '<circle cx="' + px(0) + '" cy="' + py(0) + '" r="4.5" fill="#34c77b"/>' +
    '<circle cx="' + px(last) + '" cy="' + py(last) + '" r="4.5" fill="#e5556a"/></svg>';
}

/* ---- Aktivität-Helfer ---- */
var ACT_TYPES = { Laufen: { ic: 'run', unit: 'km' }, Rad: { ic: 'bike', unit: 'km' }, Schwimmen: { ic: 'swim', unit: 'm' }, Gym: { ic: 'dumbbell', unit: '' }, 'Mobilität': { ic: 'stretch', unit: '' } };
function actRoute(s) { if (!s) return null; if (Array.isArray(s.route) && s.route.length > 1) return s.route; if (s.polyline) { try { var p = decodePolyline(s.polyline); return p.length > 1 ? p : null; } catch (e) {} } return null; }
function paceStr(distKm, durMin) { if (!distKm || !durMin) return '–'; return Calc.fmtPace(durMin * 60 / distKm) + '/km'; }

/* ---- ORVIA-Bewertung (Pace vs. Easy-Zone des Ziels) ---- */
function rateActivity(typ, s) {
  if (typ !== 'Laufen' || !s.dist || !s.dur) return null;
  var pace = s.dur * 60 / s.dist; // sec/km
  var g = (typeof goalOf === 'function') ? goalOf() : null;
  var zones = (g && g.targetMin && typeof Calc.paceZones === 'function') ? Calc.paceZones(g.distanceKm, g.targetMin) : null;
  if (!zones) {
    return { badge: 'erfasst', cls: 'y', txt: 'Pace ' + Calc.fmtPace(pace) + '/km. Lege eine Zielzeit fest, dann bewertet ORVIA die Einheit gegen deine Pace-Zonen.', next: '' };
  }
  var easy = zones.find(function (z) { return z.k === 'Easy'; });
  var tgt = zones.find(function (z) { return z.k === 'Zielpace'; });
  // Heuristik: lange/langsame Läufe = Easy-Vergleich
  if (pace < easy.lo - 25) return { badge: 'stark / schnell', cls: 'g', txt: 'Deutlich schneller als Easy (' + Calc.fmtPace(easy.lo) + '–' + Calc.fmtPace(easy.hi) + '). Das war eine Qualitäts- oder Tempoeinheit.', next: 'Auf einen leichten Tag danach achten.' };
  if (pace < easy.lo) return { badge: 'leicht zu schnell', cls: 'y', txt: 'Schneller als der Easy-Bereich (' + Calc.fmtPace(easy.lo) + '–' + Calc.fmtPace(easy.hi) + '). Easy-Läufe bringen mehr, wenn sie wirklich locker bleiben.', next: 'Nächster Easy Run 10–15 s/km langsamer.' };
  if (pace <= easy.hi + 10) return { badge: 'kontrolliert', cls: 'g', txt: 'Sauber im Easy-Bereich (' + Calc.fmtPace(easy.lo) + '–' + Calc.fmtPace(easy.hi) + '). Genau richtig für Grundlage.', next: 'So weitermachen.' };
  return { badge: 'sehr locker', cls: 'g', txt: 'Langsamer als Easy — als Recovery ideal.', next: 'Für Tempoeffekt gezielt eine schnellere Einheit einbauen.' };
}

/* ---- ORVIA Workout Card ---- */
function workoutCardHTML(date, typ, s) {
  var meta = ACT_TYPES[typ] || { ic: 'pulse', unit: '' };
  var route = actRoute(s);
  var rows = [];
  if (s.dist != null) rows.push(['Distanz', (typ === 'Schwimmen' ? s.dist + ' m' : s.dist.toFixed(2) + ' km')]);
  if (s.dur != null) rows.push(['Zeit', s.dur + ' min']);
  if (typ === 'Laufen' && s.dist && s.dur) rows.push(['Pace', paceStr(s.dist, s.dur)]);
  if (typ === 'Rad' && s.dist && s.dur) rows.push(['Schnitt', (s.dist / (s.dur / 60)).toFixed(1) + ' km/h']);
  if (s.hr != null) rows.push(['HF Ø', s.hr + ' bpm']);
  if (s.elev != null) rows.push(['Höhenmeter', Math.round(s.elev) + ' m']);
  if (s.rpe != null) rows.push(['RPE', s.rpe + '/10']);
  var rate = rateActivity(typ, s);
  var dlabel = (typeof relDayTitle === 'function') ? relDayTitle(date) : date;
  return '<div class="wcard">' +
    '<div class="wc-head"><span class="wc-brand"><svg class="omark" viewBox="0 0 512 512" aria-hidden="true"><use href="#orvia-mark"/></svg>ORVIA</span>' +
      '<span class="wc-type"><svg class="ic"><use href="#i-' + meta.ic + '"/></svg>' + escH(typ) + '</span></div>' +
    '<div class="wc-title">' + escH(typ) + (s.dist != null && typ !== 'Schwimmen' ? ' · ' + s.dist.toFixed(2) + ' km' : '') + '</div>' +
    '<div class="wc-day">' + escH(dlabel) + (s.note ? ' · ' + escH(s.note) : '') + '</div>' +
    (route ? '<div class="wc-map">' + routeSVG(route) + '</div>' : '<div class="wc-nomap">Keine Strecke für diese Aktivität.</div>') +
    '<div class="wc-stats">' + rows.map(function (r) { return '<div class="wc-stat"><span class="wc-sv">' + escH(r[1]) + '</span><span class="wc-sk">' + escH(r[0]) + '</span></div>'; }).join('') + '</div>' +
    (rate ? '<div class="wc-rate"><span class="wc-badge wc-' + rate.cls + '">' + escH(rate.badge) + '</span>' +
      '<p class="wc-analysis">' + escH(rate.txt) + '</p>' +
      (rate.next ? '<p class="wc-next"><b>Nächste Einheit:</b> ' + escH(rate.next) + '</p>' : '') + '</div>' : '') +
    '</div>';
}

/* ---- Aktivität-Detail als Sheet ---- */
function openActivity(date, typ) {
  if (date && typeof date === 'object' && date.dataset) { typ = date.dataset.t; date = date.dataset.d; }
  var e = DB[date]; if (!e || !e.sessions || !e.sessions[typ]) return;
  var wrap = document.createElement('div'); wrap.className = 'orvia-modal-bg';
  wrap.innerHTML = '<div class="orvia-modal wcard-modal">' + workoutCardHTML(date, typ, e.sessions[typ]) +
    '<button class="btn sec" style="margin-top:14px" onclick="closeActivity()">Schließen</button></div>';
  document.body.appendChild(wrap); window._actModal = wrap;
  wrap.addEventListener('click', function (ev) { if (ev.target === wrap) closeActivity(); });
}
function closeActivity() { if (window._actModal) { try { window._actModal.remove(); } catch (e) {} window._actModal = null; } }

/* ---- Aktivität-Tab ---- */
function listActivities(limit) {
  var out = [];
  var days = Object.keys(DB).filter(isDay).sort().reverse();
  for (var i = 0; i < days.length && out.length < (limit || 30); i++) {
    var e = DB[days[i]]; if (!e || !e.sessions) continue;
    Object.keys(e.sessions).filter(function (k) { return k !== '_ts'; }).forEach(function (typ) {
      out.push({ date: days[i], type: typ, s: e.sessions[typ] });
    });
  }
  return out;
}
function renderAkt() {
  var el = document.getElementById('aktBox'); if (!el) return;
  var acts = listActivities(40);
  var head = '<div class="act-actions">' +
    '<button class="btn" onclick="importDemoActivity()"><svg class="ic"><use href="#i-pulse"/></svg>Demo-Aktivität importieren</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="openManualActivity()"><svg class="ic"><use href="#i-plus"/></svg>Aktivität manuell hinzufügen</button>' +
    '<p class="note" style="text-align:left;margin-top:10px">Echter Garmin-/Strava-Import folgt — die Struktur (Strecke, Splits, Trainingslast) ist vorbereitet.</p></div>';
  if (!acts.length) {
    el.innerHTML = head + '<div class="empty-card" style="margin-top:14px"><div class="empty-h">Noch keine Aktivitäten</div>' +
      '<p class="empty-p">Importiere eine Demo-Aktivität oder trage eine manuell ein — ORVIA erzeugt daraus eine Workout-Karte mit Strecke und Bewertung.</p></div>';
    return;
  }
  var rows = acts.map(function (a) {
    var meta = ACT_TYPES[a.type] || { ic: 'pulse' };
    var sub = [];
    if (a.s.dist != null) sub.push(a.type === 'Schwimmen' ? a.s.dist + ' m' : a.s.dist.toFixed(1) + ' km');
    if (a.s.dur != null) sub.push(a.s.dur + ' min');
    if (a.type === 'Laufen' && a.s.dist && a.s.dur) sub.push(paceStr(a.s.dist, a.s.dur));
    var dl = (typeof fmtDate === 'function') ? fmtDate(a.date) : a.date;
    return '<button class="actrow" data-d="' + a.date + '" data-t="' + escH(a.type) + '" onclick="openActivity(this)">' +
      '<span class="actrow-ic"><svg class="ic"><use href="#i-' + meta.ic + '"/></svg></span>' +
      '<span class="actrow-main"><span class="actrow-t">' + escH(a.type) + (actRoute(a.s) ? ' <span class="actrow-route">Strecke</span>' : '') + '</span>' +
      '<span class="actrow-sub">' + escH(dl) + ' · ' + escH(sub.join(' · ')) + '</span></span>' +
      '<svg class="ic actrow-go"><use href="#i-chart"/></svg></button>';
  }).join('');
  el.innerHTML = head + '<div class="card" style="margin-top:14px"><h2><svg class="ic"><use href="#i-list"/></svg>Deine Aktivitäten</h2><div class="actlist">' + rows + '</div></div>';
}

/* ---- Import-Animation + Mock-Import ---- */
function importAnimation(steps, onDone) {
  var wrap = document.createElement('div'); wrap.className = 'orvia-modal-bg import-bg';
  wrap.innerHTML = '<div class="import-card"><svg class="import-mark" viewBox="0 0 512 512" aria-hidden="true"><use href="#orvia-mark"/></svg>' +
    '<div class="import-title">Synchronisiere …</div><div class="import-steps">' +
    steps.map(function (s, i) { return '<div class="import-step" data-i="' + i + '"><span class="is-dot"></span><span class="is-txt">' + escH(s) + '</span></div>'; }).join('') +
    '</div></div>';
  document.body.appendChild(wrap);
  var i = 0;
  var tick = function () {
    if (i > 0) { var prev = wrap.querySelector('.import-step[data-i="' + (i - 1) + '"]'); if (prev) prev.classList.add('done'); }
    if (i >= steps.length) {
      setTimeout(function () { try { wrap.remove(); } catch (e) {} if (onDone) onDone(); }, 350);
      return;
    }
    var cur = wrap.querySelector('.import-step[data-i="' + i + '"]'); if (cur) cur.classList.add('active');
    i++; setTimeout(tick, 520);
  };
  setTimeout(tick, 300);
}
function demoRoute() {
  // synthetische, plausible Lauf-Schleife um Flensburg (~54.78, 9.43)
  var pts = [], cx = 54.782, cy = 9.432, n = 90;
  for (var i = 0; i <= n; i++) {
    var t = i / n * Math.PI * 2;
    var r = 0.010 + 0.004 * Math.sin(t * 3) + 0.002 * Math.cos(t * 5);
    pts.push([cx + r * Math.sin(t) * 0.7, cy + r * Math.cos(t)]);
  }
  return pts;
}
function importDemoActivity() {
  if (window._importing) return;
  var k = (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0, 10);
  var e = entry(k); e.sessions = e.sessions || {};
  if (e.sessions.Laufen && !e.sessions.Laufen.demo) {
    if (!window.confirm('Heute ist bereits ein Lauf erfasst. Mit einer Demo-Aktivität überschreiben?')) return;
  }
  window._importing = true;
  importAnimation(
    ['Aktivität geladen', 'GPS-Route geladen', 'Pace-Zonen geprüft', 'Herzfrequenz analysiert', 'Trainingslast berechnet', 'Tagesentscheidung aktualisiert'],
    function () {
      window._importing = false;
      e.sessions.Laufen = { dist: 7.2, dur: 43, hr: 149, elev: 54, rpe: 4, perf: 7, note: 'Demo-Import', route: demoRoute(), demo: true };
      e.sessions._ts = Date.now();
      if (typeof save === 'function') save();
      if (typeof renderDay === 'function') renderDay();
      renderAkt();
      openActivity(k, 'Laufen');
      if (typeof toast === 'function') toast('Demo-Aktivität importiert ✓');
    }
  );
}

/* ---- Manuelle Aktivität ---- */
function openManualActivity() {
  var types = ['Laufen', 'Rad', 'Schwimmen', 'Gym', 'Mobilität'];
  var wrap = document.createElement('div'); wrap.className = 'orvia-modal-bg';
  wrap.innerHTML = '<div class="orvia-modal goal-modal"><h3>Aktivität hinzufügen</h3>' +
    '<div class="gm-field"><label>Typ</label><div class="gm-chips" id="maType">' + types.map(function (t, i) { return '<button type="button" class="gm-chip' + (i === 0 ? ' on' : '') + '" data-v="' + t + '" onclick="gmPick(this,\'maType\')">' + t + '</button>'; }).join('') + '</div></div>' +
    '<div class="gm-field"><label>Datum</label><input type="date" id="maDate" value="' + (typeof todayStr === 'function' ? todayStr() : '') + '"></div>' +
    '<div class="row2"><div class="gm-field"><label>Distanz (km)</label><input type="number" inputmode="decimal" id="maDist" placeholder="7.2"></div>' +
    '<div class="gm-field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="maDur" placeholder="43"></div></div>' +
    '<div class="row2"><div class="gm-field"><label>HF Ø</label><input type="number" inputmode="numeric" id="maHr" placeholder="149"></div>' +
    '<div class="gm-field"><label>Höhenmeter</label><input type="number" inputmode="numeric" id="maElev" placeholder="54"></div></div>' +
    '<button class="btn" onclick="saveManualActivity()">Aktivität speichern</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="closeManualActivity()">Abbrechen</button></div>';
  document.body.appendChild(wrap); window._maModal = wrap;
  wrap.addEventListener('click', function (ev) { if (ev.target === wrap) closeManualActivity(); });
}
function closeManualActivity() { if (window._maModal) { try { window._maModal.remove(); } catch (e) {} window._maModal = null; } }
function _numv(id) { var el = document.getElementById(id); if (!el || el.value === '') return null; var n = parseFloat(el.value.replace(',', '.')); return isNaN(n) ? null : n; }
function saveManualActivity() {
  var tEl = document.querySelector('#maType .on'); var typ = tEl ? tEl.dataset.v : 'Laufen';
  var dEl = document.getElementById('maDate'); var date = dEl && dEl.value ? dEl.value : (typeof todayStr === 'function' ? todayStr() : '');
  if (!isDay(date)) { if (typeof toast === 'function') toast('Bitte gültiges Datum'); return; }
  var dist = _numv('maDist'), dur = _numv('maDur'), hr = _numv('maHr'), elev = _numv('maElev');
  if (dur == null && dist == null) { if (typeof toast === 'function') toast('Mindestens Distanz oder Dauer'); return; }
  var e = entry(date); e.sessions = e.sessions || {};
  var s = Object.assign({}, e.sessions[typ] || {});
  if (dist != null) s.dist = dist; if (dur != null) s.dur = Math.round(dur);
  if (hr != null) s.hr = Math.round(hr); if (elev != null) s.elev = Math.round(elev);
  s.rpe = s.rpe != null ? s.rpe : 5; s.perf = s.perf != null ? s.perf : 6; s.note = s.note || 'Manuell';
  e.sessions[typ] = s; e.sessions._ts = Date.now();
  if (typeof save === 'function') save();
  closeManualActivity();
  if (typeof renderDay === 'function') renderDay();
  renderAkt();
  if (typeof toast === 'function') toast('Aktivität gespeichert ✓');
}
