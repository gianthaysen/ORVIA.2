/* ============================================================
   ORVIA · checkin-extra — UI für Live-/Pre-/Post-Check-in (Phase-2 Teilblock 2b)
   Spontaner Tageszustand bzw. vor/nach dem Training. Schreibt in DB[date].live|pre|post
   und persistiert über window.ORVIA.checkinStore.persistCheckin (Tabelle daily_checkins).
   KEINE Ernährungsfelder. Beeinflusst die Tagesentscheidung, NICHT die Morgen-Tagesform.
   Nutzt die bestehenden UI-Helfer aus ui.js (slider/chips/v/numIn/chipGet/initRanges).
   ============================================================ */
(function () {
  var TYPES = {
    live: { key: 'live', label: 'Live', title: 'Jetzt-Zustand', bb: true, rhr: false,
      desc: 'Aktualisiert deinen aktuellen Zustand und kann die heutige Trainingsentscheidung anpassen.' },
    pre:  { key: 'pre',  label: 'Vor Training', title: 'Vor dem Training', bb: true, rhr: true,
      desc: 'Prüft deinen Zustand unmittelbar vor dem Training und kann die geplante Einheit anpassen.' },
    post: { key: 'post', label: 'Nach Training', title: 'Nach dem Training', bb: false, rhr: false,
      desc: 'Dokumentiert deine Reaktion auf das Training und berücksichtigt sie bei weiteren Einheiten und späteren Entscheidungen.' }
  };
  var _type = 'live';

  function H() { return typeof slider === 'function' && typeof chips === 'function'; }

  window.setExtraType = function (t) { if (TYPES[t]) { _type = t; renderExtraCheckin(); } };

  window.renderExtraCheckin = function () {
    var host = document.getElementById('extraCheckin');
    if (!host || !H()) return;
    var cfg = TYPES[_type] || TYPES.live;
    var e = (typeof entry === 'function') ? entry(cur) : null;
    var d = (e && e[_type]) || {};
    var comp = Array.isArray(d.complaints) ? d.complaints : [];
    var cv = function (k) { var c = comp.find(function (x) { return x && x.type === k; }); return c && c.score != null ? c.score : 0; };

    var tabs = '<div class="ci-mode">' + Object.keys(TYPES).map(function (k) {
      return '<button type="button" class="' + (k === _type ? 'on' : '') + '" onclick="setExtraType(\'' + k + '\')">' + TYPES[k].label + '</button>';
    }).join('') + '</div>';

    var fields =
      slider('x_feel', 'Allg. Befinden', 1, 10, d.feel != null ? d.feel : 7) +
      chips('Stress-Level', 'x_stress', ['Low', 'Med', 'High'], d.stress ? [d.stress] : []) +
      slider('x_legs', 'Kraft Beine', 1, 10, d.legs != null ? d.legs : 7) +
      slider('x_doms', 'Muskelschmerz / DOMS', 0, 10, d.doms != null ? d.doms : 0, 'keine', 'stark') +
      (cfg.bb ? '<div class="row2"><div class="field"><label>Body Battery (%)</label><input type="number" inputmode="numeric" id="x_bb" value="' + (d.bb != null ? d.bb : '') + '" placeholder="70"></div>' +
        (cfg.rhr ? '<div class="field"><label>Ruhepuls (bpm)</label><input type="number" inputmode="numeric" id="x_rhr" value="' + (d.rhr != null ? d.rhr : '') + '" placeholder="58"></div>' : '<div class="field"></div>') + '</div>' : '') +
      chips('Krankheitssymptome?', 'x_ill', ['Nein', 'Ja'], [d.illness ? 'Ja' : 'Nein']) +
      slider('x_knee', 'Knie JETZT', 0, 10, cv('knee'), 'kein', 'max') +
      slider('x_back', 'Rücken JETZT', 0, 10, cv('back'), 'kein', 'max') +
      slider('x_hip', 'Hüfte JETZT', 0, 10, cv('hip'), 'kein', 'max');

    host.innerHTML =
      '<div class="card"><h2><svg class="ic"><use href="#i-pulse"/></svg>Zwischen-Check-in</h2>' +
      tabs +
      '<p class="muted" style="margin:-4px 0 14px">' + escX(cfg.desc) + ' Die Morgen-Tagesform bleibt unverändert.</p>' +
      '<div id="extraFields">' + fields + '</div>' +
      '<button class="btn sec" style="margin-top:14px" onclick="saveExtraCheckin(\'' + _type + '\')">' + escX(cfg.label) + ' speichern</button></div>';

    if (typeof initRanges === 'function') initRanges();
  };

  function escX(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s); }

  function gatherExtra(type) {
    var cfg = TYPES[type] || TYPES.live;
    var comp = [];
    ['knee', 'back', 'hip'].forEach(function (k) {
      var el = document.getElementById('x_' + k); if (!el) return;
      var s = +el.value; if (s > 0) comp.push({ type: k, score: s });
    });
    var obj = {
      feel: document.getElementById('x_feel') ? +v('x_feel') : null,
      stress: document.getElementById('x_stress') ? (chipGet('x_stress')[0] || '') : '',
      legs: document.getElementById('x_legs') ? +v('x_legs') : null,
      doms: document.getElementById('x_doms') ? +v('x_doms') : null,
      illness: document.getElementById('x_ill') ? (chipGet('x_ill')[0] === 'Ja') : false,
      complaints: comp,
      source: 'manual',
      ts: Date.now()
    };
    var knee = comp.find(function (c) { return c.type === 'knee'; });
    if (knee) obj.knee = knee.score;
    if (cfg.bb && document.getElementById('x_bb')) obj.bb = numIn('x_bb', LIM.bb[0], LIM.bb[1]);
    if (cfg.rhr && document.getElementById('x_rhr')) obj.rhr = numIn('x_rhr', LIM.rhr[0], LIM.rhr[1]);
    return obj;
  }

  function tt(msg) { if (typeof toast === 'function') toast(msg); }

  window.saveExtraCheckin = function (type) {
    if (!TYPES[type]) return;
    if (typeof canEditCur === 'function' && !canEditCur()) return;
    var label = TYPES[type].label;

    // 1) Formulardaten lesen
    var obj;
    try { obj = gatherExtra(type); }
    catch (e) { console.error('[ORVIA checkin-extra] gather fehlgeschlagen', e); tt('Check-in konnte nicht gespeichert werden'); return; }

    // 2) Lokal speichern (in try/catch; save() kann false liefern)
    var localOk = true;
    try {
      if (typeof entry === 'function') entry(cur)[type] = obj;
      if (typeof save === 'function') { var s = save(); if (s === false) localOk = false; }
    } catch (e) { console.error('[ORVIA checkin-extra] lokales Speichern fehlgeschlagen', e); localOk = false; }
    if (!localOk) { tt('Check-in konnte nicht gespeichert werden'); return; }

    // 3) Cache invalidieren + Entscheidung neu berechnen + rendern (lokaler Zustand sofort sichtbar)
    try { if (typeof renderDecision === 'function') renderDecision(); } catch (e) {}

    // 4) Persistenz (Cloud bzw. Offline-Queue) — kein falsches ✓ ohne Cloud-Bestätigung
    if (!(window.ORVIA && window.ORVIA.checkinStore && typeof window.ORVIA.checkinStore.persistCheckin === 'function')) {
      tt(label + ' lokal gespeichert – Cloud-Sync nicht verfügbar'); return;
    }
    var p;
    try { p = window.ORVIA.checkinStore.persistCheckin(cur, type, obj); }
    catch (e) { console.error('[ORVIA checkin-extra] persist (sync) fehlgeschlagen', e); tt(label + ' lokal gespeichert – Cloud-Sync fehlgeschlagen'); return; }
    if (!p || typeof p.then !== 'function') { tt(label + ' lokal gespeichert – Cloud-Sync nicht verfügbar'); return; }

    p.then(function (r) {
      // 5) Status-Toast strikt nach standardisiertem Resultat
      if (r && r.success && r.sync_status === 'pending') tt('Offline gespeichert – wird synchronisiert ⏳');
      else if (r && r.success && r.sync_status === 'synced') tt(label + '-Check-in gespeichert ✓');
      else { console.error('[ORVIA checkin-extra] persist-Resultat ohne Cloud-Erfolg', r && r.error); tt(label + ' lokal gespeichert – Cloud-Sync fehlgeschlagen'); }
    }).catch(function (e) {
      console.error('[ORVIA checkin-extra] persist rejected', e); tt(label + ' lokal gespeichert – Cloud-Sync fehlgeschlagen');
    });
  };
})();
