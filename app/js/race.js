/* B-13: nutzersichtbare Texte ueber t() (locales/de.js); eigener Wrapper-Name je Datei (profile.js fuehrt das globale T). */
var _raceT = function (k, p) { try { var I = window.ORVIA && window.ORVIA.i18n; if (I && typeof I.t === 'function') return I.t(k, p); } catch (e) {} return String(k); };
/* ============================================================
   ORVIA — Race Mode  (Phase 7)
   Phasenabhängige Hinweise rund um den Wettkampf + Race-Pace-Plan.
   Aktiv nur, wenn ein Ziel mit Datum innerhalb von 21 Tagen liegt.
   ============================================================ */

function racePacePlan(g) {
  var dist = g.distanceKm, tp = (g.targetMin && dist) ? (g.targetMin * 60 / dist) : null;
  var out = [];
  out.push(_raceT(dist <= 10 ? 'race.warmup_strides_4_5' : 'race.warmup_strides_2_3'));
  if (tp) {
    out.push(_raceT('race.start_bewusst', { km: dist >= 21 ? 3 : dist >= 10 ? 2 : 1, pace: Calc.fmtPace(tp + 8) }));
    out.push(_raceT('race.hauptteil_zielpace', { pace: Calc.fmtPace(tp) }));
    out.push('' + _raceT('race.zweite_haelfte_gleich_schnell_oder') + '');
  } else {
    out.push('' + _raceT('race.gleichmaessig_nach_gefuehl_das_erste') + '');
  }
  if (dist >= 21) out.push('' + _raceT('race.verpflegung_kohlenhydrate_gel_alle_30') + '');
  else if (dist >= 10) out.push('' + _raceT('race.verpflegung_bei_hitze_frueh_ein') + '');
  return out;
}
function raceModeData() {
  if (typeof goalOf !== 'function' || typeof daysTo !== 'function') return null;
  var g = goalOf(); if (!g || !g.raceDate) return null;
  var d = daysTo(g.raceDate); if (d == null || d < 0 || d > 21) return null;
  var label = (typeof RACE_LABELS_P !== 'undefined' && RACE_LABELS_P[g.type]) || g.type || '' + _raceT('race.wettkampf') + '';
  var win, head, tips;
  if (d === 0) { win = 'Wettkampftag'; head = _raceT('race.heute_ist_dein_label', { label: label }); tips = racePacePlan(g); }
  else if (d <= 2) { win = '' + _raceT('race.letzte_tage') + ''; head = _raceT('race.noch_n_tage', { count: d }); tips = ['' + _raceT('race.schlaf_priorisieren_die_letzten_2') + '', '' + _raceT('race.beine_locker_halten_kurzer_shake') + '', '' + _raceT('race.kohlenhydrate_hoch_gewohnte_lebensmittel_nichts') + '', '' + _raceT('race.ausruestung_anreise_und_pace_plan') + '']; }
  else if (d <= 6) { win = '' + _raceT('race.race_week') + ''; head = _raceT('race.race_week_noch_n', { n: d }); tips = ['' + _raceT('race.umfang_deutlich_runter_40_50') + '', '' + _raceT('race.kohlenhydrat_fokus_aufbauen_fluessigkeit_elektrolyte') + '', '' + _raceT('race.erholung_steht_ueber_training_schlaf') + '']; }
  else if (d <= 13) { win = 'Taper'; head = _raceT('race.taper_noch_n', { n: d }); tips = ['' + _raceT('race.volumen_schrittweise_senken_etwas_intensitaet') + '', '' + _raceT('race.keine_neuen_belastungsspitzen_mehr_form') + '', '' + _raceT('race.beschwerden_jetzt_ernst_nehmen_nichts') + '']; }
  else { win = '' + _raceT('race.vor_dem_taper') + ''; head = _raceT('race.noch_n_tage_bis', { n: d, label: label }); tips = ['' + _raceT('race.letzte_schluessel_einheiten_in_sauberer') + '', '' + _raceT('race.zielpace_verinnerlichen_sie_soll_sich') + '']; }
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
    '<button class="lexlink" onclick="var b=document.querySelector(&quot;.tabbar button[data-tab=plan]&quot;);if(b)b.click();">' + _raceT('race.race_plan_ansehen') + '</button></div>';
}
