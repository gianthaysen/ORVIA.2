/* B-13: nutzersichtbare Texte ueber t() (locales/de.js); eigener Wrapper-Name je Datei (profile.js fuehrt das globale T). */
var _insT = function (k, p) { try { var I = window.ORVIA && window.ORVIA.i18n; if (I && typeof I.t === 'function') return I.t(k, p); } catch (e) {} return String(k); };
/* ============================================================
   ORVIA — Insights  (Phase 6)
   "Erkenntnis zuerst": narrative Insights aus den Daten ableiten.
   Decision Memory (Empfehlung vs. Handlung vs. Folgetag) + Interferenz-Check.
   Jede Insight: {area, statement, reason, impact, rec, conf}.
   ============================================================ */

function _insDays(n) { var t = todayStr(), a = []; for (var i = 0; i < n; i++) { var d = new Date(t + 'T12:00'); d.setDate(d.getDate() - i); a.push(todayStr(d)); } return a; }
function _insNext(d) { var x = new Date(d + 'T12:00'); x.setDate(x.getDate() + 1); return todayStr(x); }
function _didHard(e) {
  if (!e || !e.sessions) return false;
  var L = e.sessions.Laufen; if (L && ((L.rpe || 0) >= 7 || (L.dist || 0) >= 12)) return true;
  var R = e.sessions.Rad; if (R && (R.rpe || 0) >= 7) return true;
  return false;
}

/* ---- Decision Memory: hart trainiert trotz gelber/roter Tagesform? ----
   R1.3: RETROSPEKTIVE Analyse über vergangene Tage — nutzt bewusst die
   dokumentierte Historical-Decision-API Calc.ampel() (siehe calc.js). Für die
   HEUTIGE Freigabe ist ausschließlich getDecision() zuständig. ---- */
function insDecisionMemory() {
  if (typeof recoveryCtx !== 'function' || !Calc.readiness) return null;
  var cases = 0, bad = 0;
  _insDays(28).forEach(function (d) {
    var e = DB[d]; if (!e || !e.morning) return; var m = e.morning;
    var ctx, a; try { ctx = recoveryCtx(d); a = Calc.ampel(m, Calc.readiness(m, ctx), ctx); } catch (x) { return; }
    if ((a.c === 'y' || a.c === 'r') && _didHard(e)) {
      cases++;
      var nd = DB[_insNext(d)]; var ndm = nd && nd.morning; if (!ndm) return;
      var kneeUp = (m.knee != null && ndm.knee != null && ndm.knee > m.knee + 0.5);
      var hrvDown = (m.hrvMs && ndm.hrvMs && ndm.hrvMs < m.hrvMs * 0.93);
      if (kneeUp || hrvDown) bad++;
    }
  });
  if (cases < 3 || bad / cases < 0.5) return null;
  return { area: '' + _insT('ins.decision_memory') + '', statement: '' + _insT('ins.hartes_training_trotz_gelber_oder') + '',
    reason: _insT('ins.grund_folgetag_knie_hrv', { bad: bad, cases: cases }),
    impact: '' + _insT('ins.wiederholtes_forcieren_erhoeht_dein_beschwerde') + '',
    rec: '' + _insT('ins.bei_gelber_roter_tagesform_intensitaet') + '', conf: cases >= 6 ? 'hoch' : 'mittel' };
}

/* ---- Interferenz: Krafttraining (Beine) zu nah am Lauf ---- */
function insInterference() {
  var cases = 0, bad = 0;
  _insDays(28).forEach(function (d) {
    var e = DB[d]; if (!e || !e.sessions || !e.sessions.Gym) return;
    var nd = DB[_insNext(d)]; if (!nd || !nd.sessions || !nd.sessions.Laufen) return;
    var m = e.morning, ndm = nd.morning;
    if (!m || !ndm || m.knee == null || ndm.knee == null) return;
    cases++;
    if (ndm.knee > m.knee + 0.5) bad++;
  });
  if (cases < 3 || bad < 2) return null;
  return { area: 'Interferenz', statement: '' + _insT('ins.krafttraining_direkt_vor_einem_lauf') + '',
    reason: _insT('ins.grund_gym_lauf_knie', { bad: bad, cases: cases }),
    impact: '' + _insT('ins.schwere_beine_zu_nah_am') + '',
    rec: '' + _insT('ins.beine_nicht_24_h_vor') + '', conf: 'mittel' };
}

/* ---- Lauf-Effizienz: Easy Runs zu schnell ---- */
function insEasyPace() {
  var g = (typeof goalOf === 'function') ? goalOf() : null;
  var zones = (g && g.targetMin && Calc.paceZones) ? Calc.paceZones(g.distanceKm, g.targetMin) : null;
  if (!zones) return null;
  var easy = zones.find(function (z) { return z.k === 'Easy'; }); if (!easy) return null;
  var over = [];
  _insDays(21).forEach(function (d) {
    var e = DB[d]; if (!e || !e.sessions || !e.sessions.Laufen) return; var L = e.sessions.Laufen;
    if (!L.dist || !L.dur || L.dist < 4 || L.dist > 12 || (L.rpe || 0) >= 7) return;
    var pace = L.dur * 60 / L.dist; if (pace < easy.lo) over.push(easy.lo - pace);
  });
  if (over.length < 2) return null;
  var avg = Math.round(over.reduce(function (a, b) { return a + b; }, 0) / over.length);
  return { area: 'Lauf-Effizienz', statement: '' + _insT('ins.deine_easy_runs_waren_im') + '',
    reason: _insT('ins.grund_easy_zu_schnell', { n: over.length, avg: avg, lo: Calc.fmtPace(easy.lo), hi: Calc.fmtPace(easy.hi) }),
    impact: '' + _insT('ins.mehr_belastung_ohne_echten_mehrwert') + '',
    rec: _insT('ins.rec_easy_konsequent', { lo: Calc.fmtPace(easy.lo) }), conf: over.length >= 4 ? 'hoch' : 'mittel' };
}

/* ---- Recovery: HRV-Trend ---- */
function insHrv() {
  if (typeof intelCtx !== 'function') return null; var c; try { c = intelCtx(); } catch (e) { return null; }
  if (c.hrvDevPct == null) return null;
  if (c.hrvDevPct <= -8) return { area: 'Recovery', statement: '' + _insT('ins.deine_hrv_liegt_unter_deiner') + '', reason: _insT('ins.grund_hrv_unter_schnitt', { pct: c.hrvDevPct.toFixed(0) }), impact: '' + _insT('ins.erhoehte_ermuedung_deine_belastbarkeit_ist') + '', rec: '' + _insT('ins.1_2_tage_intensitaet_rausnehmen') + '', conf: 'mittel' };
  if (c.hrvDevPct >= 6) return { area: 'Recovery', statement: '' + _insT('ins.deine_hrv_liegt_ueber_deiner') + '', reason: _insT('ins.grund_hrv_ueber_schnitt', { pct: c.hrvDevPct.toFixed(0) }), impact: '' + _insT('ins.gute_erholung_deine_belastbarkeit_ist') + '', rec: '' + _insT('ins.guter_moment_fuer_eine_qualitaetseinheit') + '', conf: 'mittel' };
  return null;
}

/* ---- Belastung: Wochenvolumen vs. Plan ---- */
function insVolume() {
  if (typeof intelCtx !== 'function') return null; var c; try { c = intelCtx(); } catch (e) { return null; }
  if (!c.targetKm || !c.weekKm) return null;
  if (c.weekKm > c.targetKm * 1.15) return { area: 'Belastung', statement: '' + _insT('ins.dein_wochenvolumen_liegt_ueber_plan') + '', reason: _insT('ins.grund_volumen_ueber_plan', { km: Math.round(c.weekKm), soll: c.targetKm, pct: Math.round((c.weekKm / c.targetKm - 1) * 100) }), impact: '' + _insT('ins.steigerung_schneller_als_die_erholung') + '', rec: '' + _insT('ins.naechste_woche_hoechstens_5_10') + '', conf: 'mittel' };
  return null;
}

/* ---- Ernährung: Protein-Treffer ---- */
function insProtein() {
  if (typeof nutWeekly !== 'function') return null; var w; try { w = nutWeekly(); } catch (e) { return null; }
  if (w.proteinDays <= 2) return { area: 'Ernährung', statement: '' + _insT('ins.dein_protein_ziel_triffst_du') + '', reason: _insT('ins.grund_protein_tage', { days: w.proteinDays }), impact: '' + _insT('ins.zu_wenig_protein_bremst_regeneration') + '', rec: '' + _insT('ins.pro_mahlzeit_eine_proteinquelle_einplanen') + '', conf: 'mittel' };
  return null;
}

/* ---- Aggregat + Render ---- */
var _weekInsCache = null;
function weekInsights() {
  var sig;
  try { var k = todayStr(); var e = DB[k] || {}; sig = Object.keys(DB).filter(isDay).length + '|' + ((e.sessions && e.sessions._ts) || 0) + '|' + (e.morning ? 1 : 0) + '|' + (e.eve ? 1 : 0); } catch (x) { sig = '' + Math.random(); }
  if (_weekInsCache && _weekInsCache.sig === sig) return _weekInsCache.val;
  var gens = [insDecisionMemory, insInterference, insEasyPace, insHrv, insVolume, insProtein];
  var out = []; gens.forEach(function (g) { try { var r = g(); if (r) out.push(r); } catch (e) {} });
  _weekInsCache = { sig: sig, val: out };
  return out;
}
function renderWeekInsights() {
  var el = document.getElementById('weekInsights'); if (!el) return;
  var n = 0; try { n = Object.keys(DB).filter(isDay).length; } catch (e) {}
  var head = '<h2><svg class="ic"><use href="#i-zap"/></svg>' + _insT('ins.diese_woche_erkannt') + '</h2>';
  if (n < 5) { el.innerHTML = '<div class="card">' + head + '<p class="muted" style="margin:0">' + _insT('ins.leer_nach_7_tagen', { n: n }) + '</p></div>'; return; }
  var ins = weekInsights();
  if (!ins.length) { el.innerHTML = '<div class="card">' + head + '<p class="muted" style="margin:0">' + _insT('ins.keine_auffaelligen_muster_training_erholung') + '</p></div>'; return; }
  var rows = ins.slice(0, 5).map(function (x) {
    var cc = x.conf === 'hoch' ? 'g' : x.conf === 'mittel' ? 'y' : 'r';
    return '<div class="ins"><div class="ins-top"><span class="ins-area">' + escH(x.area) + '</span><span class="conf conf-' + cc + '">' + escH(x.conf) + '</span></div>' +
      '<div class="ins-stmt">' + escH(x.statement) + '</div>' +
      '<div class="ins-reason">' + escH(x.reason) + '</div>' +
      '<div class="ins-impact">' + escH(x.impact) + '</div>' +
      '<div class="ins-rec">' + escH(x.rec) + '</div></div>';
  }).join('');
  el.innerHTML = '<div class="card insights-card">' + head + rows + '</div>';
}
