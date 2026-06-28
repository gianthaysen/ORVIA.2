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
function isIndoorType(typ, s) { if (s && s.indoor) return true; return typ === 'Gym' || typ === 'Mobilität' || typ === 'Schwimmen'; }
function paceStr(distKm, durMin) { if (!distKm || !durMin) return '–'; return Calc.fmtPace(durMin * 60 / distKm) + '/km'; }

/* ---- ORVIA-Bewertung (Pace vs. Easy-Zone des Ziels) ---- */
function rateActivity(typ, s) {
  if (typ !== 'Laufen' || !s.dist || !s.dur) return null;
  // Unplausible Läufe nicht loben — sie fließen auch nicht in Statistik/Prognose.
  if (typeof Calc !== 'undefined' && Calc.isValidRunForAnalytics && !Calc.isValidRunForAnalytics(s)) {
    return { badge: 'Daten prüfen', cls: 'r', txt: 'Die Werte wirken für einen Lauf unplausibel und werden nicht für Statistiken oder Prognosen verwendet.', next: 'Sportart oder Werte bearbeiten.' };
  }
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
  if (s.dur != null) rows.push(['Zeit', Calc.fmtDuration(s.dur, 'min')]);
  if (typ === 'Laufen' && s.dist && s.dur) rows.push(['Pace', paceStr(s.dist, s.dur)]);
  if (typ === 'Rad' && s.dist && s.dur) rows.push(['Schnitt', (s.dist / (s.dur / 60)).toFixed(1) + ' km/h']);
  if (s.hr != null) rows.push(['HF Ø', s.hr + ' bpm']);
  if (s.cad != null) rows.push(['Schrittfreq.', s.cad + ' spm']);
  if (s.gearId && typeof gearName === 'function') { var _gn = gearName(s.gearId); if (_gn) rows.push([typ === 'Rad' ? 'Rad' : 'Schuhe', _gn]); }
  if (s.elev != null) rows.push(['Höhenmeter', Math.round(s.elev) + ' m']);
  if (s.rpe != null) rows.push(['RPE', s.rpe + '/10']);
  var rate = rateActivity(typ, s);
  var dlabel = (typeof relDayTitle === 'function') ? relDayTitle(date) : date;
  return '<div class="wcard">' +
    '<div class="wc-head"><span class="wc-brand"><svg class="omark" viewBox="0 0 512 512" aria-hidden="true"><use href="#orvia-mark"/></svg>ORVIA</span>' +
      '<span class="wc-type"><svg class="ic"><use href="#i-' + meta.ic + '"/></svg>' + escH(typ) + '</span></div>' +
    '<div class="wc-title">' + escH(typ) + (s.dist != null && typ !== 'Schwimmen' ? ' · ' + s.dist.toFixed(2) + ' km' : '') + '</div>' +
    '<div class="wc-day">' + escH(dlabel) + (s.note ? ' · ' + escH(s.note) : '') + '</div>' +
    (route ? '<div class="wc-map">' + routeSVG(route) + '</div>' : '<div class="wc-nomap">' + (isIndoorType(typ, s) ? 'Indoor-Aktivität ohne GPS-Route' : 'Für diese Aktivität sind keine Routendaten vorhanden.') + '</div>') +
    '<div class="wc-stats">' + rows.map(function (r) { return '<div class="wc-stat"><span class="wc-sv">' + escH(r[1]) + '</span><span class="wc-sk">' + escH(r[0]) + '</span></div>'; }).join('') + '</div>' +
    ((s.splits && s.splits.length && typeof splitsMiniHTML === 'function') ? splitsMiniHTML(s.splits) : '') +
    (function () { var lg = (s.exLog && s.exLog.length) ? s.exLog : ((s.exercises && s.exercises.length) ? s.exercises.map(function (n) { return { n: n }; }) : null); if (!lg) return ''; return '<div class="wc-ex"><div class="wc-ex-h">Übungen (' + lg.length + ')</div>' + lg.map(function (x) { var det = []; if (x.sets != null || x.reps != null) det.push((x.sets != null ? x.sets : '?') + '×' + (x.reps != null ? x.reps : '?')); if (x.kg != null) det.push(x.kg + ' kg'); return '<div class="wc-exrow"><span class="wc-exrow-n">' + escH(x.n) + '</span>' + (det.length ? '<span class="wc-exrow-d">' + escH(det.join(' · ')) + '</span>' : '') + '</div>'; }).join('') + '</div>'; })() +
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
  var hasRoute = actRoute(e.sessions[typ]);
  wrap.innerHTML = '<div class="orvia-modal wcard-modal">' + workoutCardHTML(date, typ, e.sessions[typ]) +
    (hasRoute ? '<button class="btn" style="margin-top:14px" onclick="closeActivity();openStory(\'' + date + '\',\'' + typ + '\')">▶ Story ansehen</button>' : '') +
    '<button class="btn sec" style="margin-top:10px" onclick="closeActivity();openEditActivity(\'' + date + '\',\'' + escH(typ) + '\')">Aktivität bearbeiten</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="closeActivity()">Schließen</button></div>';
  document.body.appendChild(wrap); window._actModal = wrap;
  wrap.addEventListener('click', function (ev) { if (ev.target === wrap) closeActivity(); });
}
function closeActivity() { if (window._actModal) { try { window._actModal.remove(); } catch (e) {} window._actModal = null; } }

/* ---- Aktivität bearbeiten (Phase 4.4): Sportart/Datum/Werte korrigieren, atomar neu berechnen ---- */
var EDIT_TYPES = ['Laufen', 'Rad', 'Schwimmen', 'Gym', 'Mobilität', 'Wandern'];
function closeEditActivity() { if (window._editModal) { try { window._editModal.remove(); } catch (e) {} window._editModal = null; } }
function openEditActivity(date, typ) {
  var e = DB[date]; if (!e || !e.sessions || !e.sessions[typ]) return;
  var s = e.sessions[typ];
  var chips = EDIT_TYPES.map(function (t, i) { return '<button type="button" class="gm-chip' + (t === typ ? ' on' : '') + '" data-v="' + t + '" onclick="gmPick(this,\'eaType\')">' + t + '</button>'; }).join('');
  var src = s.externalId ? 'Import' : (s.source === 'live' ? 'Live-Workout' : (s.note || 'Manuell'));
  var wrap = document.createElement('div'); wrap.className = 'orvia-modal-bg';
  wrap.innerHTML = '<div class="orvia-modal goal-modal"><h3>Aktivität bearbeiten</h3>' +
    '<div class="gm-field"><label>Sportart</label><div class="gm-chips" id="eaType">' + chips + '</div></div>' +
    '<div class="gm-field"><label>Untertyp (optional)</label><input id="eaSub" value="' + escH(s.sub || '') + '" placeholder="z.B. Easy Run, Intervall, Long Run, Indoor"></div>' +
    '<div class="gm-field"><label>Datum</label><input type="date" id="eaDate" value="' + escH(date) + '"></div>' +
    '<div class="row2"><div class="gm-field"><label>Distanz (km / Schwimmen m)</label><input type="number" inputmode="decimal" id="eaDist" value="' + (s.dist != null ? s.dist : '') + '"></div>' +
    '<div class="gm-field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="eaDur" value="' + (s.dur != null ? s.dur : '') + '"></div></div>' +
    '<div class="row2"><div class="gm-field"><label>HF Ø</label><input type="number" inputmode="numeric" id="eaHr" value="' + (s.hr != null ? s.hr : '') + '"></div>' +
    '<div class="gm-field"><label>HF max</label><input type="number" inputmode="numeric" id="eaHrMax" value="' + (s.hrMax != null ? s.hrMax : '') + '"></div></div>' +
    '<div class="row2"><div class="gm-field"><label>Höhenmeter</label><input type="number" inputmode="numeric" id="eaElev" value="' + (s.elev != null ? s.elev : '') + '"></div>' +
    '<div class="gm-field"><label>RPE (1–10)</label><input type="number" inputmode="numeric" id="eaRpe" value="' + (s.rpe != null ? s.rpe : '') + '"></div></div>' +
    '<div class="gm-field"><label>Notiz</label><input id="eaNote" value="' + escH(s.note || '') + '"></div>' +
    '<p class="note" style="text-align:left">Quelle: ' + escH(src) + (s.externalId ? ' · ID bleibt erhalten' : '') + '</p>' +
    '<button class="btn" onclick="saveEditActivity(\'' + date + '\',\'' + escH(typ) + '\')">Speichern</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="deleteActivity(\'' + date + '\',\'' + escH(typ) + '\')">Aktivität löschen</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="closeEditActivity()">Änderungen verwerfen</button></div>';
  document.body.appendChild(wrap); window._editModal = wrap;
  wrap.addEventListener('click', function (ev) { if (ev.target === wrap) closeEditActivity(); });
}
function _eaNum(id) { var el = document.getElementById(id); if (!el || el.value === '') return null; var n = parseFloat(el.value.replace(',', '.')); return isNaN(n) ? null : n; }
function _mvInvalidate() {
  try { if (typeof invalidateDecision === 'function') invalidateDecision(); } catch (e) {}
  try { _goalCache = null; } catch (e) {}
  try { window._goalCache = null; } catch (e) {}
  try { window._mvData = null; } catch (e) {}
}
function _mvRerender() {
  _mvInvalidate();
  if (typeof save === 'function') save();
  try { if (typeof renderDay === 'function') renderDay(); } catch (e) {}
  try { if (typeof renderAkt === 'function') renderAkt(); } catch (e) {}
  try { if (typeof renderDash === 'function') { var dash = document.getElementById('tab-dash'); if (dash && !dash.classList.contains('hide')) renderDash(); } } catch (e) {}
}
var EDIT_DISTANCE_SPORTS = ['Laufen', 'Rad', 'Schwimmen', 'Wandern'];
function _eaStr(id) { var el = document.getElementById(id); var v = el ? (el.value || '').trim() : ''; return v === '' ? null : v; }
// Effektiver Datensatz GENAU wie moveActivity (null = Feld löschen) — zentral in Calc (SSOT).
function applyActivityPatchPreview(current, patch) { return Calc.applyActivityPatchPreview(current, patch); }
function saveEditActivity(origDate, origType) {
  var tEl = document.querySelector('#eaType .on'); var newType = tEl ? tEl.dataset.v : origType;
  var dEl = document.getElementById('eaDate'); var newDate = dEl && dEl.value ? dEl.value : origDate;
  if (!isDay(newDate)) { if (typeof toast === 'function') toast('Bitte gültiges Datum'); return; }
  // Echte Lösch-Semantik: leeres Feld → null. moveActivity entfernt null-Felder aus dem Datensatz
  // (Altwert verschwindet). KEIN Strip mehr — sonst bliebe der alte Wert stehen.
  var patch = { sub: _eaStr('eaSub'), dist: _eaNum('eaDist'), dur: _eaNum('eaDur'), hr: _eaNum('eaHr'), hrMax: _eaNum('eaHrMax'), elev: _eaNum('eaElev'), rpe: _eaNum('eaRpe'), note: _eaStr('eaNote') };
  // Effektive Werte EXAKT wie nach moveActivity (null löscht das Feld) — sonst könnte ein gelöschtes
  // Pflichtfeld die Prüfung „bestehen" und danach trotzdem entfernt werden.
  var cur = DB[origDate].sessions[origType] || {};
  var eff = applyActivityPatchPreview(cur, patch);
  // Pflichtfeld-Validierung sportartspezifisch: Distanzsportarten brauchen Distanz UND Dauer.
  if (EDIT_DISTANCE_SPORTS.indexOf(newType) >= 0 && (!(eff.dist > 0) || !(eff.dur > 0))) {
    if (typeof toast === 'function') toast('Distanz und Dauer sind für „' + newType + '" erforderlich'); return;
  }
  // Gym/Mobilität: Dauer ist Pflicht.
  if ((newType === 'Gym' || newType === 'Mobilität') && !(eff.dur > 0)) {
    if (typeof toast === 'function') toast('Dauer ist für „' + newType + '" erforderlich'); return;
  }
  // Plausibilität (inkl. HF-Konsistenz, RPE-Bereich, Einheiten).
  var plaus = Calc.activityPlausibility(newType, eff);
  if (plaus.warn && typeof confirm === 'function' && !confirm(plaus.msg + '\n\nTrotzdem speichern?')) return;
  // Sportartwechsel bestätigen (verändert alle sportartspezifischen Statistiken)
  if (newType !== origType && typeof confirm === 'function' && !confirm('Sportart von „' + origType + '" zu „' + newType + '" ändern? Alle ' + origType + '-Statistiken (Pace, Bestzeiten, Wochenumfang …) werden entfernt und für ' + newType + ' neu berechnet.')) return;
  var r = Calc.moveActivity(DB, origDate, origType, newDate, newType, patch);
  if (!r.ok && r.code === 'target_conflict') {
    if (typeof confirm === 'function') confirm('An diesem Tag existiert bereits eine „' + newType + '"-Aktivität.\n\nDas Datenmodell erlaubt aktuell nur eine Aktivität je Sportart und Tag. Wähle ein anderes Datum oder eine andere Sportart. (Kein automatisches Zusammenführen.)');
    else if (typeof toast === 'function') toast('Zielkonflikt: bereits eine „' + newType + '"-Aktivität an diesem Tag');
    return; // Modal bleibt offen — Nutzer kann Datum/Sportart anpassen, nichts wird überschrieben.
  }
  if (!r.ok) { if (typeof toast === 'function') toast('Aktivität nicht gefunden'); return; }
  closeEditActivity();
  _mvRerender();
  if (typeof toast === 'function') toast(newType !== origType ? 'Auf „' + newType + '" korrigiert ✓' : 'Aktivität aktualisiert ✓');
}
function deleteActivity(date, typ) {
  if (typeof confirm === 'function' && !confirm('Aktivität „' + typ + '" am ' + date + ' löschen? Zugehörige Statistiken werden entfernt.')) return;
  try { var e = DB[date]; if (e && e.sessions) { delete e.sessions[typ]; e.sessions._ts = Date.now(); } } catch (e2) {}
  closeEditActivity();
  _mvRerender();
  if (typeof toast === 'function') toast('Aktivität gelöscht');
}

/* ---- Aktivität-Tab (Inkrement 2A: kanonische Quelle + klar abgegrenzter Legacy-Adapter) ---- */
// Sprite-Icons sind begrenzt → kanonischer Fallback 'pulse' statt falscher Zuordnung.
var SPRITE_ICONS = { run: 1, bike: 1, swim: 1, dumbbell: 1, stretch: 1, pulse: 1, plus: 1, list: 1, chart: 1 };
function _iconForSport(sportId) {
  var ic = (window.ORVIA && ORVIA.activityConfig) ? ORVIA.activityConfig.sportIcon(sportId) : 'pulse';
  return SPRITE_ICONS[ic] ? ic : 'pulse';
}
// Nutzer-Sportauswahl defensiv aus den verfügbaren Quellen ableiten (für dynamische Kacheln/Erfassung).
function _userSportsSelection() {
  try {
    var sl = window.ORVIA && ORVIA.onboardingSportsLogic; if (!sl) return null;
    var p = (typeof PROFILE !== 'undefined' && PROFILE) ? PROFILE : null;
    if (p && p.sportsSelection && p.sportsSelection.sports) return sl.normalizeSportsSelection(p.sportsSelection);
    var ob = window.ORVIA && ORVIA.onboardingV2Store;
    if (ob && typeof ob.load === 'function') { var d = ob.load(); if (d && d.draftData && d.draftData.sports) return sl.normalizeSportsSelection(d.draftData.sports); }
    if (p && Array.isArray(p.sports) && p.sports.length) return sl.seedFromExistingProfile({ sports: p.sports });
  } catch (e) {}
  return null;
}
// Legacy-Aktivitäten aus DB[date].sessions über den reinen Adapter (keine Mutation).
function _legacyActivities() {
  var out = [];
  if (!(window.ORVIA && ORVIA.activityConfig)) return out;
  var days = Object.keys(DB).filter(isDay).sort().reverse();
  for (var i = 0; i < days.length; i++) {
    var e = DB[days[i]]; if (!e || !e.sessions) continue;
    Object.keys(e.sessions).filter(function (k) { return k !== '_ts'; }).forEach(function (typ) {
      out.push(ORVIA.activityConfig.legacySessionToActivity(days[i], typ, e.sessions[typ]));
    });
  }
  return out;
}
// EINE vereinheitlichte, sortierte, deduplizierte Aktivitätsliste (kanonisch gewinnt).
function listActivitiesUnified(limit) {
  var canonical = (window.ORVIA && ORVIA.activityStore) ? ORVIA.activityStore.listActivities() : [];
  var legacy = _legacyActivities();
  var merged = (window.ORVIA && ORVIA.activityConfig) ? ORVIA.activityConfig.mergeActivities(canonical, legacy) : canonical.concat(legacy);
  return limit ? merged.slice(0, limit) : merged;
}
function renderAkt() {
  var el = document.getElementById('aktBox'); if (!el) return;
  var acts = listActivitiesUnified(40);
  var demoEnabled = !!(window.ORVIA_CFG && window.ORVIA_CFG.enableDemoData && window.ORVIA_REAL_RUN);
  var head = '<div class="act-actions">' +
    (demoEnabled ? '<button class="btn" onclick="importRealRun()"><svg class="ic"><use href="#i-pulse"/></svg>Demo-Strava-Lauf importieren</button>' : '') +
    '<button class="btn' + (demoEnabled ? ' sec' : '') + '" style="' + (demoEnabled ? 'margin-top:10px' : '') + '" onclick="openImportSheet()"><svg class="ic"><use href="#i-pulse"/></svg>Strava / GPX / TCX importieren</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="openManualActivity()"><svg class="ic"><use href="#i-plus"/></svg>Aktivität manuell hinzufügen</button>' +
    '<p class="note" style="text-align:left;margin-top:10px">Import per GPX/TCX-Datei oder JSON (Strava/Garmin-Export). Routen erscheinen als Karte. Strava/Garmin-Autosync folgt serverseitig.</p></div>';
  if (!acts.length) {
    el.innerHTML = head + '<div class="empty-card" style="margin-top:14px"><div class="empty-h">Noch keine Aktivitäten</div>' +
      '<p class="empty-p">Trage eine Aktivität manuell ein oder schließe ein Training ab — beides erscheint hier.</p></div>';
    return;
  }
  var cfg = ORVIA.activityConfig;
  var rows = acts.map(function (a) {
    var label = cfg.sportLabel(a.sportId);
    var dateStr = a.startedAt ? a.startedAt.slice(0, 10) : (a._legacy && a._legacy.date) || '';
    var dl = (typeof fmtDate === 'function' && dateStr) ? fmtDate(dateStr) : dateStr;
    var sub = cfg.summaryLine(a);
    var hasRoute = a._legacy && actRoute((DB[a._legacy.date] && DB[a._legacy.date].sessions || {})[a._legacy.type]);
    return '<button class="actrow" data-aid="' + escH(a.clientRecordId) + '" onclick="openActivityDetails(this)">' +
      '<span class="actrow-ic"><svg class="ic"><use href="#i-' + _iconForSport(a.sportId) + '"/></svg></span>' +
      '<span class="actrow-main"><span class="actrow-t">' + escH(label) + (hasRoute ? ' <span class="actrow-route">Strecke</span>' : '') + '</span>' +
      '<span class="actrow-sub">' + escH(dl) + ' · ' + escH(sub) + '</span></span>' +
      '<svg class="ic actrow-go"><use href="#i-chart"/></svg></button>';
  }).join('');
  el.innerHTML = head + '<div class="card" style="margin-top:14px"><h2><svg class="ic"><use href="#i-list"/></svg>Deine Aktivitäten</h2><div class="actlist">' + rows + '</div></div>';
}
// Zentraler Detail-Einstieg (beide Verläufe nutzen ihn). Auflösung NUR über stabile ID.
function openActivityDetails(idOrEl) {
  var aid = (idOrEl && idOrEl.dataset) ? idOrEl.dataset.aid : idOrEl;
  var a = (window.ORVIA && ORVIA.activityStore) ? ORVIA.activityStore.getActivityById(aid) : null;
  if (a && a.source === 'orvia_workout') {              // kanonisches Workout → Snapshot-first-Renderer
    if (ORVIA.workoutUI && ORVIA.workoutUI.openDetails) { ORVIA.workoutUI.openDetails(a.sourceRecordId || a.workoutSessionId); return; }
  }
  // Legacy-Aktivität → bestehende Workout-Karte über date/type.
  if (aid && aid.indexOf('legacy:') === 0) { var parts = aid.split(':'); var date = parts[1]; var legacy = _legacyActivities().find(function (x) { return x.clientRecordId === aid; }); var typ = legacy && legacy._legacy && legacy._legacy.type; if (date && typ) { openActivity(date, typ); return; } }
  if (typeof toast === 'function') toast('Details konnten nicht geladen werden');
}
// Nach Workout-Abschluss/Activity-Änderung den Aktivität-Tab neu rendern (kein App-Reload nötig).
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('orvia:activity-updated', function () { try { if (document.getElementById('aktBox')) renderAkt(); } catch (e) {} });
}

/* ============================================================
   GPX/TCX-Datei-Import → Aktivität mit Route. Modular für Lauf/Rad/
   Schwimmen/Wandern/Triathlon. Keine externen Dienste/Keys.
   ============================================================ */
function _haversineKm(a, b) { var R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLng = (b[1] - a[1]) * Math.PI / 180; var la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180; var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(la1) * Math.cos(la2); return 2 * R * Math.asin(Math.min(1, Math.sqrt(x))); }
function _routeDistKm(pts) { var d = 0; for (var i = 1; i < pts.length; i++) d += _haversineKm(pts[i - 1], pts[i]); return d; }
function _downsample(pts, max) { max = max || 300; if (pts.length <= max) return pts; var step = Math.ceil(pts.length / max), out = []; for (var i = 0; i < pts.length; i += step) out.push(pts[i]); if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]); return out; }
function _localDateFromISO(iso) { if (!iso) return null; var d = new Date(iso); if (isNaN(d.getTime())) return null; return (typeof todayStr === 'function') ? todayStr(d) : d.toISOString().slice(0, 10); }
function parseGpxTcx(text) {
  var doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return null;
  var pts = [], times = [], hrs = [], totalDistM = null, sport = null;
  var trkpts = doc.getElementsByTagName('trkpt');
  if (trkpts.length) { // GPX
    for (var i = 0; i < trkpts.length; i++) {
      var p = trkpts[i], lat = parseFloat(p.getAttribute('lat')), lon = parseFloat(p.getAttribute('lon'));
      if (!isNaN(lat) && !isNaN(lon)) pts.push([lat, lon]);
      var tEl = p.getElementsByTagName('time')[0]; if (tEl) times.push(tEl.textContent);
    }
    var typeEl = doc.getElementsByTagName('type')[0]; if (typeEl) sport = typeEl.textContent;
  } else { // TCX
    var tps = doc.getElementsByTagName('Trackpoint');
    for (var j = 0; j < tps.length; j++) {
      var tp = tps[j];
      var la = tp.getElementsByTagName('LatitudeDegrees')[0], lo = tp.getElementsByTagName('LongitudeDegrees')[0];
      if (la && lo) { var laV = parseFloat(la.textContent), loV = parseFloat(lo.textContent); if (!isNaN(laV) && !isNaN(loV)) pts.push([laV, loV]); }
      var tEl2 = tp.getElementsByTagName('Time')[0]; if (tEl2) times.push(tEl2.textContent);
      var dm = tp.getElementsByTagName('DistanceMeters'); if (dm.length) { var dv = parseFloat(dm[dm.length - 1].textContent); if (!isNaN(dv)) totalDistM = dv; }
      var hrEl = tp.getElementsByTagName('HeartRateBpm')[0]; if (hrEl) { var vv = hrEl.getElementsByTagName('Value')[0]; if (vv) { var h = parseFloat(vv.textContent); if (!isNaN(h)) hrs.push(h); } }
    }
    var actEl = doc.getElementsByTagName('Activity')[0]; if (actEl) sport = actEl.getAttribute('Sport');
  }
  if (!times.length && !pts.length) return null;
  var durMin = null;
  if (times.length >= 2) { var t0 = new Date(times[0]), t1 = new Date(times[times.length - 1]); if (!isNaN(t0.getTime()) && !isNaN(t1.getTime())) durMin = (t1 - t0) / 60000; }
  var distKm = totalDistM != null ? totalDistM / 1000 : (pts.length > 1 ? _routeDistKm(pts) : null);
  var hr = hrs.length ? Math.round(hrs.reduce(function (s, x) { return s + x; }, 0) / hrs.length) : null;
  var raw = (sport || '').toLowerCase();
  var type = raw.indexOf('bik') >= 0 || raw.indexOf('cycl') >= 0 || raw.indexOf('ride') >= 0 ? 'ride'
    : raw.indexOf('swim') >= 0 ? 'swim' : 'run';
  return { date: _localDateFromISO(times[0]) || (typeof todayStr === 'function' ? todayStr() : ''), type: type, dur: durMin, dist: distKm, hr: hr, route: _downsample(pts, 300), note: 'GPX/TCX-Import' };
}
function importGpxTcxFile(input) {
  var f = input && input.files && input.files[0]; if (!f) return;
  if (/\.fit$/i.test(f.name)) { if (typeof toast === 'function') toast('FIT-Dateien bitte als GPX oder TCX exportieren (Garmin Connect / Strava)'); input.value = ''; return; }
  var r = new FileReader();
  r.onload = function () {
    try {
      var act = parseGpxTcx(String(r.result));
      if (!act) { if (typeof toast === 'function') toast('Datei nicht lesbar — GPX oder TCX erwartet'); return; }
      if (!act.route || act.route.length < 2) delete act.route;
      var res = (typeof importActivityArray === 'function') ? importActivityArray([act]) : null;
      if (res && typeof reportImport === 'function') reportImport(res);
    } catch (e) { if (typeof toast === 'function') toast('Import-Fehler: ' + (e && e.message || 'unbekannt')); }
  };
  r.readAsText(f); input.value = '';
}
/* ---- Paste-Import (JSON) als Sheet, self-contained ---- */
function openImportSheet() {
  var wrap = document.createElement('div'); wrap.className = 'orvia-modal-bg';
  wrap.innerHTML = '<div class="orvia-modal goal-modal"><h3>Aktivitäten importieren</h3>' +
    '<p class="note" style="text-align:left">GPX-/TCX-Datei (Garmin/Strava-Export) oder JSON einfügen. Routen werden auf der Karte angezeigt. Duplikate werden übersprungen.</p>' +
    '<label class="btn sec" style="margin-top:10px;display:block;text-align:center">GPX/TCX-Datei wählen' +
    '<input type="file" accept=".gpx,.tcx,application/gpx+xml,application/octet-stream" style="display:none" onchange="importGpxTcxFile(this);closeImportSheet()"></label>' +
    '<textarea class="paste" id="impPaste" style="margin-top:12px;width:100%;min-height:120px" placeholder=\'[{"date":"2026-06-15","type":"run","dist":7.2,"dur":36.1,"hr":150,"polyline":"…"}]\'></textarea>' +
    '<button class="btn" style="margin-top:10px" onclick="runPasteImport()">JSON importieren</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="closeImportSheet()">Schließen</button></div>';
  document.body.appendChild(wrap); window._impModal = wrap;
  wrap.addEventListener('click', function (ev) { if (ev.target === wrap) closeImportSheet(); });
}
function closeImportSheet() { if (window._impModal) { try { window._impModal.remove(); } catch (e) {} window._impModal = null; } }
function runPasteImport() {
  var el = document.getElementById('impPaste'); if (!el) return;
  var arr; try { arr = JSON.parse(el.value); if (!Array.isArray(arr)) throw 0; } catch (e) { if (typeof toast === 'function') toast('Ungültiges JSON'); return; }
  var res = (typeof importActivityArray === 'function') ? importActivityArray(arr) : null;
  closeImportSheet();
  if (res && typeof reportImport === 'function') reportImport(res);
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

/* ---- Manuelle Aktivität (Inkrement 2A: dynamisch aus Nutzer-Sportauswahl + zentraler Form-Registry) ---- */
function _maTiles() {
  var sel = _userSportsSelection();
  var cfg = window.ORVIA && ORVIA.activityConfig;
  if (cfg) { var t = cfg.userSportTiles(sel); if (t && t.length > 1) return t; }
  // Fallback ohne Auswahl: Katalog-Standard (KEINE hart codierte Fünferliste im Renderpfad).
  return [{ sportId: 'running', label: 'Laufen' }, { sportId: 'gym', label: 'Krafttraining' }, { sportId: 'other', label: 'Weitere Aktivität', isMore: true }];
}
// Felder eines Sport-Schemas als HTML (date/time/enum/number/text). Werte aus prevVals übernehmen.
function _maFieldsHTML(sportId, prevVals) {
  var cfg = ORVIA.activityConfig; var schema = cfg.formSchemaForSport(sportId); prevVals = prevVals || {};
  return schema.fields.map(function (fld) {
    var v = prevVals[fld.key] != null ? prevVals[fld.key] : '';
    var id = 'ma_' + fld.key;
    var lab = fld.label + (fld.optional ? ' (optional)' : '');
    if (fld.type === 'date') return '<div class="gm-field"><label>' + escH(lab) + '</label><input type="date" id="' + id + '" value="' + escH(v || (typeof todayStr === 'function' ? todayStr() : '')) + '"></div>';
    if (fld.type === 'time') return '<div class="gm-field"><label>' + escH(lab) + '</label><input type="time" id="' + id + '" value="' + escH(v) + '"></div>';
    if (fld.type === 'enum') return '<div class="gm-field"><label>' + escH(lab) + '</label><select id="' + id + '">' + fld.options.map(function (o) { return '<option value="' + escH(o) + '"' + (v === o ? ' selected' : '') + '>' + escH(o) + '</option>'; }).join('') + '</select></div>';
    if (fld.type === 'text') return '<div class="gm-field"><label>' + escH(lab) + '</label><input type="text" id="' + id + '" value="' + escH(v) + '"></div>';
    return '<div class="gm-field"><label>' + escH(lab) + '</label><input type="number" inputmode="decimal" id="' + id + '" value="' + escH(v) + '"></div>';
  }).join('');
}
function _maReadVals(sportId) {
  var cfg = ORVIA.activityConfig; var schema = cfg.formSchemaForSport(sportId); var out = {};
  schema.fields.forEach(function (fld) { var el = document.getElementById('ma_' + fld.key); if (!el) return; var val = (el.value || '').trim(); if (val === '') return; out[fld.key] = (fld.type === 'number') ? parseFloat(val.replace(',', '.')) : val; });
  return out;
}
function openManualActivity() {
  var tiles = _maTiles();
  window._maType = tiles[0].sportId;
  var chips = tiles.map(function (t, i) { return '<button type="button" class="gm-chip' + (i === 0 ? ' on' : '') + '" data-v="' + escH(t.sportId) + '" onclick="maPickType(this)">' + escH(t.label) + '</button>'; }).join('');
  var wrap = document.createElement('div'); wrap.className = 'orvia-modal-bg';
  wrap.innerHTML = '<div class="orvia-modal goal-modal"><h3>Aktivität hinzufügen</h3>' +
    '<div class="gm-field"><label>Sportart</label><div class="gm-chips" id="maType">' + chips + '</div></div>' +
    '<div id="maFields">' + _maFieldsHTML(window._maType, {}) + '</div>' +
    '<button class="btn" onclick="saveManualActivity()">Aktivität speichern</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="closeManualActivity()">Abbrechen</button></div>';
  document.body.appendChild(wrap); window._maModal = wrap;
  wrap.addEventListener('click', function (ev) { if (ev.target === wrap) closeManualActivity(); });
}
// Sportwechsel: aktuelle Werte lesen, sportfremde Felder entfernen, Formular neu aufbauen.
function maPickType(el) {
  var prev = _maReadVals(window._maType);
  if (typeof gmPick === 'function') gmPick(el, 'maType'); else { try { var p = el.parentNode; Array.prototype.forEach.call(p.children, function (c) { c.classList.remove('on'); }); el.classList.add('on'); } catch (e) {} }
  window._maType = el.dataset.v;
  var kept = ORVIA.activityConfig.stripForeignFields(prev, window._maType);   // sportfremde Werte entfernen
  var box = document.getElementById('maFields'); if (box) box.innerHTML = _maFieldsHTML(window._maType, kept);
}
function closeManualActivity() { if (window._maModal) { try { window._maModal.remove(); } catch (e) {} window._maModal = null; } }
// F3: Auswahl bei wahrscheinlichem Duplikat (gleiche Einheit live + manuell/Import).
function showActivityDuplicate(date, typ, prior, dup) {
  var conf = dup && dup.confidence ? dup.confidence : 'mittel';
  var src = prior && prior.source === 'live' ? 'live erfasst' : (prior && prior.note) ? prior.note : 'bereits vorhanden';
  var wrap = document.createElement('div'); wrap.className = 'orvia-modal-bg'; window._maDup = wrap;
  wrap.innerHTML = '<div class="orvia-modal goal-modal"><h3>Bereits vorhanden?</h3>' +
    '<p class="modtext" style="margin:0 0 12px">Für <b>' + escH(typ) + '</b> am ' + escH(date) + ' gibt es schon eine Einheit (' + escH(src) + ', Übereinstimmung: ' + escH(conf) + '). Was möchtest du tun?</p>' +
    '<button class="btn sec" onclick="dupOpenExisting(\'' + date + '\',\'' + typ + '\')">Vorhandene öffnen</button>' +
    '<button class="btn" style="margin-top:10px" onclick="dupMerge()">Zusammenführen</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="dupReplace(\'' + date + '\',\'' + typ + '\')">Trotzdem als neu speichern</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="dupCancel()">Abbrechen</button></div>';
  document.body.appendChild(wrap);
  wrap.addEventListener('click', function (ev) { if (ev.target === wrap) dupCancel(); });
}
function _closeDup() { if (window._maDup) { try { window._maDup.remove(); } catch (e) {} window._maDup = null; } }
function dupCancel() { _closeDup(); }
function dupOpenExisting(date, typ) { _closeDup(); closeManualActivity(); if (typeof openWorkoutCard === 'function') openWorkoutCard(date, typ); }
function dupMerge() { _closeDup(); window._maForce = true; saveManualActivity(); }        // Felder feldweise mergen
function dupReplace(date, typ) { _closeDup(); try { var e = entry(date); if (e.sessions) delete e.sessions[typ]; } catch (e2) {} window._maForce = true; saveManualActivity(); } // Slot ersetzen
function _numv(id) { var el = document.getElementById(id); if (!el || el.value === '') return null; var n = parseFloat(el.value.replace(',', '.')); return isNaN(n) ? null : n; }
function saveManualActivity() {
  var cfg = ORVIA.activityConfig;
  var sportId = window._maType || 'other';
  var vals = _maReadVals(sportId);
  var date = vals.date || (typeof todayStr === 'function' ? todayStr() : '');
  if (!isDay(date)) { if (typeof toast === 'function') toast('Bitte gültiges Datum'); return; }
  // Pflicht: Dauer ODER Distanz (Gym/Sonstige: Dauer reicht; Sonstige braucht zusätzlich Name).
  var dur = vals.durationMin != null ? vals.durationMin : null;
  var distKm = vals.distanceKm != null ? vals.distanceKm : null;
  var distM = vals.distanceM != null ? vals.distanceM : null;
  if (dur == null && distKm == null && distM == null) { if (typeof toast === 'function') toast('Mindestens Dauer oder Distanz'); return; }
  if (sportId === 'other' && !vals.name) { if (typeof toast === 'function') toast('Bitte Name angeben'); return; }
  var typ = cfg.sportLabel(sportId);                  // DB-Schlüssel = deutsches Label (kompatibel mit Edit/Move/openActivity)
  var e = entry(date); e.sessions = e.sessions || {};
  var prior = e.sessions[typ];
  var hasPrior = prior && ['dist', 'dur', 'hr', 'source', 'workoutSessionId'].some(function (k) { return prior[k] != null; });
  if (hasPrior && !window._maForce && typeof Calc !== 'undefined' && Calc.activityDuplicate) {
    var dup = Calc.activityDuplicate({ type: typ, date: date, dur: dur, dist: distKm != null ? distKm : (distM != null ? distM / 1000 : null) }, prior);
    if (dup && dup.match) { showActivityDuplicate(date, typ, prior, dup); return; }
  }
  window._maForce = false;
  // Schema → DB-Session (nur reale Werte; sportfremde Felder existieren dank Strip gar nicht erst).
  var s = Object.assign({}, e.sessions[typ] || {});
  if (dur != null) s.dur = Math.round(dur);
  if (distM != null) s.dist = distM; else if (distKm != null) s.dist = distKm;   // Schwimmen: Meter
  if (vals.avgHr != null) s.hr = Math.round(vals.avgHr);
  if (vals.elevationM != null) s.elev = Math.round(vals.elevationM); else delete s.elev;   // kein Alt-Höhenmeter bei sportfremd
  s.rpe = vals.rpe != null ? vals.rpe : (s.rpe != null ? s.rpe : 5);
  if (vals.note) s.note = vals.note; else s.note = s.note || 'Manuell';
  // Sportspezifische Extras roh sichern (für spätere Detail-Vertiefung), aber keine erfundenen Werte.
  ['environment', 'poolLengthM', 'stroke', 'sessionKind', 'format', 'role', 'result', 'avgSpeedKmh', 'avgPowerW', 'triType', 'discipline', 'name', 'time'].forEach(function (k) { if (vals[k] != null && vals[k] !== '') s[k] = vals[k]; });
  s.perf = s.perf != null ? s.perf : 6; s.sportId = sportId;
  e.sessions[typ] = s; e.sessions._ts = Date.now();
  if (typeof save === 'function') save();
  closeManualActivity();
  if (typeof renderDay === 'function') renderDay();
  renderAkt();
  try { if (window.dispatchEvent) window.dispatchEvent(new CustomEvent('orvia:activity-updated', { detail: {} })); } catch (e2) {}
  if (typeof toast === 'function') toast('Aktivität gespeichert ✓');
}
