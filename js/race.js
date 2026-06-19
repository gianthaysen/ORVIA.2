/* ============================================================
   ORVIA — Race Mode  (Phase 7)
   Phasenabhängige Hinweise rund um den Wettkampf + Race-Pace-Plan.
   Aktiv nur, wenn ein Ziel mit Datum innerhalb von 21 Tagen liegt.
   ============================================================ */

function racePacePlan(g) {
  var dist = g.distanceKm, tp = (g.targetMin && dist) ? (g.targetMin * 60 / dist) : null;
  var out = [];
  out.push('Warm-up: 10–15 min locker' + (dist <= 10 ? ' + 4–5 Strides' : ' + 2–3 Strides'));
  if (tp) {
    out.push('Start: erste ' + (dist >= 21 ? '3 km' : dist >= 10 ? '2 km' : '1 km') + ' bewusst bei ~' + Calc.fmtPace(tp + 8) + '/km (8 s/km unter Zielpace)');
    out.push('Hauptteil: in Zielpace ' + Calc.fmtPace(tp) + '/km einpendeln, gleichmäßig laufen');
    out.push('Zweite Hälfte: gleich schnell oder leicht schneller — Negative Split');
  } else {
    out.push('Gleichmäßig nach Gefühl, das erste Drittel nicht überziehen');
  }
  if (dist >= 21) out.push('Verpflegung: Kohlenhydrate/Gel alle 30–40 min, früh beginnen');
  else if (dist >= 10) out.push('Verpflegung: bei Hitze früh ein paar Schluck Wasser');
  return out;
}
function raceModeData() {
  if (typeof goalOf !== 'function' || typeof daysTo !== 'function') return null;
  var g = goalOf(); if (!g || !g.raceDate) return null;
  var d = daysTo(g.raceDate); if (d == null || d < 0 || d > 21) return null;
  var label = (typeof RACE_LABELS_P !== 'undefined' && RACE_LABELS_P[g.type]) || g.type || 'Wettkampf';
  var win, head, tips;
  if (d === 0) { win = 'Wettkampftag'; head = 'Heute ist dein ' + label + '. Vertrau dem Plan.'; tips = racePacePlan(g); }
  else if (d <= 2) { win = 'Letzte Tage'; head = 'Noch ' + d + ' Tag' + (d === 1 ? '' : 'e') + '.'; tips = ['Schlaf priorisieren — die letzten 2–3 Nächte zählen am meisten.', 'Beine locker halten: kurzer Shake-out mit 2–3 Strides ist ok.', 'Kohlenhydrate hoch, gewohnte Lebensmittel — nichts Neues testen.', 'Ausrüstung, Anreise und Pace-Plan heute vorbereiten.']; }
  else if (d <= 6) { win = 'Race Week'; head = 'Race Week — noch ' + d + ' Tage.'; tips = ['Umfang deutlich runter (~40–50 %), nur kurze, knackige Reize.', 'Kohlenhydrat-Fokus aufbauen, Flüssigkeit & Elektrolyte beachten.', 'Erholung steht über Training — Schlaf und Stress im Blick.']; }
  else if (d <= 13) { win = 'Taper'; head = 'Taper-Phase — noch ' + d + ' Tage.'; tips = ['Volumen schrittweise senken, etwas Intensität halten (Schärfe behalten).', 'Keine neuen Belastungsspitzen mehr — Form sichern statt Fitness jagen.', 'Beschwerden jetzt ernst nehmen, nichts riskieren.']; }
  else { win = 'Vor dem Taper'; head = 'Noch ' + d + ' Tage bis ' + label + '.'; tips = ['Letzte Schlüssel-Einheiten in sauberer Qualität, danach Taper.', 'Zielpace verinnerlichen — sie soll sich kontrolliert anfühlen.']; }
  return { d: d, label: label, win: win, head: head, tips: tips, raceDay: d === 0 };
}
function renderRaceMode() {
  var el = document.getElementById('raceModeBox'); if (!el) return;
  var r = raceModeData();
  if (!r) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="card racemode' + (r.raceDay ? ' raceday' : '') + '"><h2><svg class="ic"><use href="#i-flag"/></svg>Race Mode · ' + escH(r.win) + '</h2>' +
    '<div class="rm-head">' + escH(r.head) + '</div>' +
    '<ul class="rm-list">' + r.tips.map(function (t) { return '<li>' + escH(t) + '</li>'; }).join('') + '</ul></div>';
}
function renderRaceModeToday() {
  var el = document.getElementById('raceModeToday'); if (!el) return;
  if (typeof cur !== 'undefined' && cur !== todayStr()) { el.innerHTML = ''; return; }
  var r = raceModeData();
  if (!r || r.d > 14) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="card rm-today"><div class="rm-t-top"><span class="rm-t-win">Race Mode · ' + escH(r.win) + '</span><span class="rm-t-d">D−' + r.d + '</span></div>' +
    '<div class="rm-t-tip">' + escH(r.tips[0] || '') + '</div>' +
    '<button class="lexlink" onclick="var b=document.querySelector(&quot;.tabbar button[data-tab=plan]&quot;);if(b)b.click();">Race-Plan ansehen</button></div>';
}
