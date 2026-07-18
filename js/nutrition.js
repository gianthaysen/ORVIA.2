/* ============================================================
   ORVIA — Energie & Ernährung  (Phase 5)
   Trainingsabhängige Kalorien + Makros, Empfehlungen, Wochen-Hit.
   Engine: Calc.bmr / Calc.nutritionTargets. Config in PROFILE.nutrition.
   ============================================================ */

function nutProfile() {
  var p = (typeof PROFILE !== 'undefined' && PROFILE) ? PROFILE : {};
  var n = p.nutrition || {};
  return {
    /* P2: KEINE erfundenen Körperwerte mehr (vorher ||30/||175/||75 — erzeugte
       realistisch wirkende Fake-Zahlen). Fehlt etwas, liefert nutToday() null und
       die Karte zeigt den ehrlichen Leerzustand mit Profil-Hinweis. */
    sex: n.sex || p.sex || 'm', age: p.age || null, heightCm: p.heightCm || null, weightKg: p.weightKg || null,
    /* Phase 7 (2026-07-18, Audit-Befund 4 — Double Counting): activity ist die
       ALLTAGSAKTIVITÄT OHNE Training (NEAT); Training wird separat als trainingBurn
       addiert. Default deshalb 'light' statt 'moderate' — vorher steckte das
       Training implizit im Faktor UND wurde nochmal addiert. */
    goal: n.goal || 'maintain', activity: n.activity || 'light',
    deficitKcal: n.deficitKcal || 400, surplusKcal: n.surplusKcal || 250,
    proteinPerKg: n.proteinPerKg || 1.9, targetWeightKg: n.targetWeightKg || null
  };
}
function trainingBurnToday() {
  var w = (typeof PROFILE !== 'undefined' && PROFILE && PROFILE.weightKg) || null;
  if (!w) return 0;   // P2: ohne echtes Gewicht kein erfundener Verbrauch
  var e = DB[todayStr()]; if (!e || !e.sessions) return 0;
  var s = e.sessions, b = 0;
  if (s.Laufen) b += s.Laufen.dist ? s.Laufen.dist * w * 0.95 : (s.Laufen.dur || 0) * w * 0.16;
  if (s.Rad) b += (s.Rad.dur || 0) * 7;
  if (s.Schwimmen) b += (s.Schwimmen.dur || 0) * 9;
  if (s.Gym) b += (s.Gym.dur || 0) * 6;
  if (s['Mobilität']) b += (s['Mobilität'].dur || 0) * 3.5;
  return Math.round(b);
}
function dayTypeToday() {
  var e = DB[todayStr()]; var s = e && e.sessions;
  if (!s) return 'rest';
  var L = s.Laufen;
  if (L && L.dist >= 14) return 'long';
  if (L && (L.rpe || 0) >= 7) return 'quality';
  if (s.Gym) return 'strength';
  if (L || s.Rad || s.Schwimmen) return 'easy';
  return 'rest';
}
/* Phase 7: heutige Energie-Metriken aus dem Resolver-Cache (befüllt von
   _ciAutoLoad in ui.js). NUR heutige, nicht-stale Werte — alles andere null. */
function nutMetricsToday() {
  var out = { steps: null, activeKcal: null, restingKcal: null, totalKcalProvider: null };
  try {
    var s = window._metricsResolved;
    var t = todayStr();
    if (!s || s.date !== t || !s.resolved) return out;
    function pick(id) {
      var r = s.resolved[id];
      if (!r || r.stale || r.metricDate !== t) return null;   // TDEE nur aus Tageswerten
      if (r.source !== 'automatic' && r.source !== 'override') return null;
      return (typeof r.value === 'number' && isFinite(r.value)) ? r.value : null;
    }
    out.steps = pick('steps');
    out.activeKcal = pick('active_kcal');
    out.restingKcal = pick('resting_kcal');
    out.totalKcalProvider = pick('total_kcal_provider');
  } catch (e) {}
  return out;
}
/* Morgengewichte der letzten 28 Tage für die adaptive Korrektur. */
function nutWeightSeries() {
  var out = [];
  try {
    for (var i = 27; i >= 0; i--) {
      var k = dkey(-i); var e = DB[k]; var w = e && e.morning && e.morning.weight;
      if (typeof w === 'number' && isFinite(w) && w > 0) out.push({ date: k, kg: w });
    }
  } catch (e) {}
  return out;
}
function nutBodyFat() {
  try {
    var b = PROFILE && PROFILE.performance && PROFILE.performance.body && PROFILE.performance.body.bodyFat;
    return (b && typeof b.value === 'number' && isFinite(b.value)) ? b.value : null;
  } catch (e) { return null; }
}
function nutToday() {
  var np = nutProfile();
  if (!np.weightKg || !np.heightCm || !np.age) return null;
  np.dayType = dayTypeToday();
  np.trainingBurn = trainingBurnToday();
  /* Phase 7: dynamischer TDEE (Provider- oder ORVIA-Modus) ersetzt den
     statischen Aktivitätsfaktor, wenn der Resolver rechnen kann. Fällt er aus
     (kein Modul/keine Körperdaten), rechnet nutritionTargets wie bisher. */
  try {
    var ER = window.ORVIA && ORVIA.energyResolver;
    if (ER) {
      var mx = nutMetricsToday();
      var E = ER.computeDay({
        weightKg: np.weightKg, heightCm: np.heightCm, age: np.age, sex: np.sex,
        bodyFatPct: nutBodyFat(),
        steps: mx.steps, activeKcal: mx.activeKcal, restingKcal: mx.restingKcal,
        totalKcalProvider: mx.totalKcalProvider,
        trainingKcal: np.trainingBurn, weightSeries: nutWeightSeries()
      });
      if (E) { np.tdee = E.tdee; np.energy = E; _nutPersistEnergy(E); }
    }
  } catch (e) {}
  return Calc.nutritionTargets(np);
}
/* Tagesergebnis idempotent in daily_energy_expenditure sichern (Migration 0022).
   Gedrosselt: nur wenn sich der gewählte Wert für heute geändert hat. */
function _nutPersistEnergy(E) {
  try {
    if (!E || !(window.ORVIA && ORVIA.repos && ORVIA.repos.energy)) return;
    var t = todayStr();
    var key = t + ':' + E.mode + ':' + E.tdee;
    if (window._nutEnergySaved === key) return;
    window._nutEnergySaved = key;
    ORVIA.repos.energy.saveDay(t, {
      mode: E.mode, bmr_kcal: E.bmr, bmr_method: E.bmrMethod,
      step_kcal: E.orvia ? E.orvia.stepKcal : null,
      training_kcal: E.orvia ? E.orvia.trainingKcal : null,
      tef_kcal: E.orvia ? E.orvia.tefKcal : null,
      adaptive_adj_kcal: E.adaptive ? E.adaptive.adjKcal : null,
      trend_kg_28d: E.adaptive ? E.adaptive.trendKgPer28d : null,
      tdee_orvia: E.orvia ? E.orvia.tdee : null,
      tdee_provider: E.provider ? E.provider.tdee : null,
      tdee_chosen: E.tdee
    }).catch(function () {});
  } catch (e) {}
}
function nutRecommendation(dayType) {
  if (dayType === 'long') return 'Long-Run-Tag: Kohlenhydrate hoch — vorher Carb-reiches Frühstück, danach zügig auffüllen.';
  if (dayType === 'quality') return 'Intensive Einheit: Carbs erhöhen, kein großes Defizit — Qualität braucht Energie.';
  if (dayType === 'strength') return 'Krafttag: Protein gleichmäßig über 3–4 Portionen verteilen.';
  if (dayType === 'rest') return 'Ruhetag: Kalorien leicht niedriger, Protein voll halten.';
  return 'Lockerer Tag: ausgewogen essen, Protein konstant halten.';
}
/* ---- Fueling pro Einheit (sport-/intensitätsspezifisch) ---- */
function fuelingToday() {
  var u = (typeof todayPrimaryUnit === 'function') ? todayPrimaryUnit() : null; if (!u) return null;
  var t = u.t, k = (typeof unitKind === 'function') ? unitKind(u) : '', l = (u.l || '').toLowerCase();
  var title = '', lines = [];
  if (t === 'Laufen') {
    if (k === 'long') { title = 'Long Run — Fueling'; lines = ['Vorher: kohlenhydratreiches Frühstück 2–3 h davor.', 'Ab ~90 min: 30–60 g Kohlenhydrate pro Stunde (Gel/Riegel/Iso).', 'Flüssigkeit + etwas Salz, besonders bei Hitze.', 'Defizit heute klein halten — Qualität braucht Energie.']; }
    else if (k === 'interval' || k === 'tempo') { title = 'Intervall/Tempo — Fueling'; lines = ['Vorher: leicht verdauliche Carbs (Banane/Toast) 1–2 h davor.', '<60–75 min: meist kein Fuel nötig, ausreichend trinken.', 'Kein großes Kaloriendefizit an diesem harten Tag.']; }
    else { title = 'Easy Run — Fueling'; lines = ['<60 min: meist kein zusätzliches Fuel nötig.', 'Wasser reicht; danach normale Mahlzeit.']; }
  } else if (t === 'Rad') {
    if (/long/.test(l)) { title = 'Long Ride — Fueling'; lines = ['Ab ~90 min: 40–80 g Kohlenhydrate pro Stunde.', 'Flüssigkeit + Elektrolyte/Salz einplanen.', 'Recovery-Mahlzeit (Carbs + Protein) zügig danach.']; }
    else if (/interval/.test(l) || k === 'interval') { title = 'Rad-Intervalle — Fueling'; lines = ['Vorher Carbs auffüllen; bei kürzeren Einheiten optional ein Gel.', 'Defizit heute begrenzen.']; }
    else { title = 'Easy Ride — Fueling'; lines = ['<90 min: optional Carbs, sonst Wasser.', 'Lockere Fahrt — kein Defizit-Problem.']; }
  } else if (t === 'Gym') { title = 'Krafttag — Fueling'; lines = ['Protein gleichmäßig über 3–4 Portionen.', 'Carbs um die Einheit für Leistung & Erholung.']; }
  else return null;
  return { title: title, lines: lines };
}
function nutWeekly() {
  var t = nutToday(); var pTarget = t ? t.protein : null;
  if (pTarget == null) return null;   // P2: kein erfundenes Proteinziel
  var today = todayStr(), pd = 0, weights = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(today + 'T12:00'); d.setDate(d.getDate() - i); var k = todayStr(d); var e = DB[k]; if (!e) continue;
    if (e.eve && e.eve.prot != null && e.eve.prot >= pTarget * 0.9) pd++;
    if (e.morning && e.morning.weight != null) weights.push([k, e.morning.weight]);
  }
  var wt = '';
  if (weights.length >= 2) { weights.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }); var diff = weights[weights.length - 1][1] - weights[0][1]; wt = (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' kg'; }
  return { proteinDays: pd, weightTrend: wt };
}
function macroCell(label, grams, kcal, cls) {
  return '<div class="nut-m"><span class="nut-mg">' + grams + '<small>g</small></span>' +
    '<span class="nut-mk">' + escH(label) + '</span><span class="nut-mc nut-' + cls + '">' + kcal + ' kcal</span></div>';
}
function renderNutritionToday() {
  var el = document.getElementById('nutritionBox'); if (!el) return;
  if (cur !== todayStr()) { el.innerHTML = ''; return; }
  var t = nutToday();
  if (!t) {
    el.innerHTML = '<div class="card"><h2><svg class="ic"><use href="#i-nutrition"/></svg>Energie &amp; Ernährung</h2>' +
      '<p class="muted" style="margin:0">Hinterlege Körperdaten und Ziel im Profil (Avatar → „Energie &amp; Ernährung"), dann berechnet ORVIA deine Tageskalorien und Makros.</p></div>';
    return;
  }
  var dt = { rest: 'Ruhetag', easy: 'Lockerer Tag', quality: 'Intensiver Tag', long: 'Long-Run-Tag', strength: 'Krafttag' }[t.dayType] || '';
  var eaWarn = (t.ea < 32 && t.burn >= 250 && t.goal === 'fatloss') ? '<div class="nut-warn">Energieverfügbarkeit niedrig (~' + t.ea + ' kcal/kg) für die heutige Trainingsbelastung. Defizit reduzieren — vor allem Kohlenhydrate anheben.</div>' : '';
  var wk = nutWeekly();
  el.innerHTML = '<div class="card nutcard"><h2><svg class="ic"><use href="#i-nutrition"/></svg>Energie &amp; Ernährung<span class="nut-day">' + escH(dt) + '</span></h2>' +
    '<div class="nut-kcal"><span class="nut-knum">' + t.kcal + '</span><span class="nut-klab">kcal Tagesziel' + (t.burn ? ' · inkl. ~' + t.burn + ' kcal Training' : '') + '</span></div>' +
    '<div class="nut-macros">' +
      macroCell('Protein', t.protein, t.protein * 4, 'p') +
      macroCell('Carbs', t.carbs, t.carbs * 4, 'c') +
      macroCell('Fett', t.fat, t.fat * 9, 'f') +
    '</div>' + eaWarn +
    '<div class="nut-rec">' + escH(nutRecommendation(t.dayType)) + '</div>' +
    (function () { var f = (typeof fuelingToday === 'function') ? fuelingToday() : null; if (!f) return ''; return '<div class="nut-fuel"><div class="nf-h">' + escH(f.title) + '</div><ul>' + f.lines.map(function (x) { return '<li>' + escH(x) + '</li>'; }).join('') + '</ul></div>'; })() +
    '<div class="nut-week">Protein-Ziel diese Woche: <b>' + wk.proteinDays + '/7</b> Tage' + (wk.weightTrend ? ' · Gewicht 7T: <b>' + escH(wk.weightTrend) + '</b>' : '') + '</div>' +
    '<div class="nut-note">Schätzwerte — werden über Gewichtstrend, Training und Energielevel angepasst.</div></div>';
}

/* ---- Config im Profil ---- */
function renderNutritionConfig() {
  var el = document.getElementById('nutritionConfig'); if (!el) return;
  var np = nutProfile();
  var goalL = { fatloss: 'Fettverlust', maintain: 'Erhalt', muscle: 'Muskelaufbau', performance: 'Performance' }[np.goal] || np.goal;
  var actL = { sedentary: 'Wenig aktiv', light: 'Leicht aktiv', moderate: 'Moderat', high: 'Hoch aktiv' }[np.activity] || np.activity;
  var t = nutToday();
  el.innerHTML = '<div class="acc-row"><span>Ziel</span><b>' + escH(goalL) + '</b></div>' +
    '<div class="acc-row"><span>Aktivitätslevel</span><b>' + escH(actL) + '</b></div>' +
    '<div class="acc-row"><span>Protein</span><b>' + np.proteinPerKg + ' g/kg</b></div>' +
    (t ? '<div class="acc-row"><span>Grundumsatz</span><b>' + t.bmr + ' kcal</b></div><div class="acc-row"><span>Tagesziel heute</span><b>' + t.kcal + ' kcal</b></div>' : '') +
    '<button class="btn sec" style="margin-top:12px" onclick="openNutritionEditor()">Ernährung einstellen</button>';
}
function openNutritionEditor() {
  closeNutritionEditor();
  var np = nutProfile();
  var goals = [['fatloss', 'Fettverlust'], ['maintain', 'Erhalt'], ['muscle', 'Muskelaufbau'], ['performance', 'Performance']];
  var acts = [['sedentary', 'Wenig'], ['light', 'Leicht'], ['moderate', 'Moderat'], ['high', 'Hoch']];
  var sexes = [['m', 'Mann'], ['f', 'Frau'], ['d', 'Divers / k. A.']];
  var wrap = document.createElement('div'); wrap.className = 'orvia-modal-bg';
  wrap.innerHTML = '<div class="orvia-modal goal-modal" style="max-height:88vh;overflow-y:auto"><h3>Energie &amp; Ernährung</h3>' +
    '<div class="gm-field"><label>Ziel</label><div class="gm-chips" id="nuGoal">' + goals.map(function (g) { return '<button type="button" class="gm-chip' + (np.goal === g[0] ? ' on' : '') + '" data-v="' + g[0] + '" onclick="gmPick(this,\'nuGoal\')">' + g[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="gm-field"><label>Aktivitätslevel (ohne Training)</label><div class="gm-chips" id="nuAct">' + acts.map(function (g) { return '<button type="button" class="gm-chip' + (np.activity === g[0] ? ' on' : '') + '" data-v="' + g[0] + '" onclick="gmPick(this,\'nuAct\')">' + g[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="gm-field"><label>Geschlecht (für Grundumsatz)</label><div class="gm-chips" id="nuSex">' + sexes.map(function (g) { return '<button type="button" class="gm-chip' + (np.sex === g[0] ? ' on' : '') + '" data-v="' + g[0] + '" onclick="gmPick(this,\'nuSex\')">' + g[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="row2"><div class="gm-field"><label>Protein (g/kg)</label><input type="number" inputmode="decimal" id="nuProt" value="' + np.proteinPerKg + '"></div>' +
    '<div class="gm-field"><label>Defizit/Überschuss (kcal)</label><input type="number" inputmode="numeric" id="nuDef" value="' + (np.goal === 'muscle' ? np.surplusKcal : np.deficitKcal) + '"></div></div>' +
    '<div class="gm-field"><label>Zielgewicht (kg, optional)</label><input type="number" inputmode="decimal" id="nuTw" value="' + (np.targetWeightKg || '') + '"></div>' +
    '<button class="btn" onclick="saveNutrition()">Speichern</button>' +
    '<button class="btn sec" style="margin-top:10px" onclick="closeNutritionEditor()">Abbrechen</button></div>';
  document.body.appendChild(wrap); window._nutModal = wrap;
  wrap.addEventListener('click', function (ev) { if (ev.target === wrap) closeNutritionEditor(); });
}
function closeNutritionEditor() { if (window._nutModal) { try { window._nutModal.remove(); } catch (e) {} window._nutModal = null; } }
function saveNutrition() {
  if ((typeof PROFILE === 'undefined' || !PROFILE) && typeof ensureProfile === 'function') ensureProfile();
  var goal = (document.querySelector('#nuGoal .on') || {}).dataset; goal = goal ? goal.v : 'maintain';
  var act = (document.querySelector('#nuAct .on') || {}).dataset; act = act ? act.v : 'moderate';
  var sex = (document.querySelector('#nuSex .on') || {}).dataset; sex = sex ? sex.v : 'm';
  var prot = parseFloat(((document.getElementById('nuProt') || {}).value || '1.9').replace(',', '.'));
  var def = parseInt((((document.getElementById('nuDef') || {}).value) || '').replace(',', '.'), 10);
  var tw = parseFloat(((document.getElementById('nuTw') || {}).value || '').replace(',', '.'));
  if (isNaN(prot) || prot <= 0) prot = 1.9;
  PROFILE.sex = sex;
  PROFILE.nutrition = {
    sex: sex, goal: goal, activity: act, proteinPerKg: prot,
    deficitKcal: (goal === 'muscle') ? 400 : (isNaN(def) ? 400 : Math.abs(def)),
    surplusKcal: (goal === 'muscle') ? (isNaN(def) ? 250 : Math.abs(def)) : 250,
    targetWeightKg: isNaN(tw) ? null : tw
  };
  if (typeof saveProfile === 'function') saveProfile();
  closeNutritionEditor();
  if (typeof renderDay === 'function') renderDay();
  renderNutritionConfig();
  if (typeof toast === 'function') toast('Ernährung gespeichert ✓');
}
