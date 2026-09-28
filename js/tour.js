/* ============================================================
   ORVIA · tour — Rundgang AN der App (Prototyp v14 Spotlight-Tour, S4)
   ------------------------------------------------------------
   Scrim mit Aussparung ueber dem ECHTEN Element, Tooltip daneben. Startet NIE
   von selbst (M9-Entscheidung: kein automatischer Mehrschritt-Rundgang) —
   nur ueber Profil → Hilfe & über ORVIA → „Rundgang starten". Ein Schritt,
   dessen Element gerade nicht existiert (kein Plan, keine Aktivitaet, Karte
   vor dem Check-in), wird uebersprungen: erklaert wird nur, was da ist.
   Kein Zustand ausser dem laufenden Index; nichts wird gespeichert.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var T = function (k, p) { try { var I = O.i18n; if (I && typeof I.t === 'function') return I.t(k, p); } catch (e) {} return String(k); };
  function D() { return (typeof document !== 'undefined') ? document : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* Schritte: tab = showTab()-Ziel, sel = echtes Element (fehlt es → Schritt entfaellt).
     Texte kommen aus dem Katalog (tour.<id>_t / tour.<id>_d); d darf <b> enthalten. */
  var STEPS = [
    { id: 'intro', tab: 'heute', k: 'tour.k_rundgang' },
    { id: 'score', tab: 'heute', sel: '#command .hero', k: 'tour.k_dashboard' },
    { id: 'decision', tab: 'heute', sel: '#gmAdp', k: 'tour.k_dashboard' },
    { id: 'modules', tab: 'heute', sel: '#modules', k: 'tour.k_dashboard' },
    { id: 'fab', sel: '#navPlus', k: 'tour.k_ueberall' },
    { id: 'variants', tab: 'plan', sel: '#tab-plan .pvar-row', k: 'tour.k_plan' },
    { id: 'week', tab: 'plan', sel: '#tab-plan .session-card', k: 'tour.k_plan' },
    { id: 'hub', tab: 'akt', sel: '#tab-akt .hub-actions', k: 'tour.k_aktivitaet' },
    { id: 'activity', tab: 'akt', sel: '#tab-akt .activity-card', k: 'tour.k_aktivitaet' },
    { id: 'profile', tab: 'mehr', sel: '#gmProf', k: 'tour.k_profil' },
    { id: 'done', tab: 'heute', k: 'tour.k_fertig' }
  ];
  var idx = -1, timer = null;

  function elOf(s) { var d = D(); if (!d || !s.sel) return null; try { var el = d.querySelector(s.sel); return (el && el.getBoundingClientRect().height > 0) ? el : null; } catch (e) { return null; } }
  function goTab(name) { try { if (name && typeof root.showTab === 'function') root.showTab(name); } catch (e) {} }
  function html(s) {
    var n = STEPS.length;
    var pct = Math.round((idx + 1) / n * 100);
    return '<div class="k">' + esc(T(s.k)) + ' · ' + (idx + 1) + ' ' + esc(T('tour.von')) + ' ' + n + '</div>' +
      '<h4>' + esc(T('tour.' + s.id + '_t')) + '</h4><p>' + T('tour.' + s.id + '_d') + '</p>' +
      '<div class="spot-foot"><div class="spot-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="spot-btns">' + (idx > 0 ? '<button type="button" onclick="ORVIA.tour.prev()">' + esc(T('tour.zurueck')) + '</button>' : '<button type="button" onclick="ORVIA.tour.end()">' + esc(T('tour.beenden')) + '</button>') +
      '<button type="button" class="pri" onclick="ORVIA.tour.next()">' + esc(idx < n - 1 ? T('tour.weiter') : T('tour.fertig')) + '</button></div></div>';
  }
  function place(hole, tip, el) {
    var vh = root.innerHeight || 800;
    if (el) {
      var r = el.getBoundingClientRect();
      hole.style.display = 'block';
      hole.style.top = (r.top - 7) + 'px'; hole.style.left = (r.left - 7) + 'px';
      hole.style.width = (r.width + 14) + 'px'; hole.style.height = (r.height + 14) + 'px';
      var below = (r.top + r.height / 2) < vh / 2;
      tip.style.transform = 'translateX(-50%)';
      tip.style.top = below ? (Math.min(r.bottom + 16, vh - 240)) + 'px' : '';
      tip.style.bottom = below ? '' : (vh - r.top + 16) + 'px';
    } else {
      hole.style.display = 'none';
      tip.style.bottom = ''; tip.style.top = '50%'; tip.style.transform = 'translate(-50%,-50%)';
    }
  }
  function show(dir) {
    var d = D(); if (!d) return;
    var s = STEPS[idx]; if (!s) { end(); return; }
    var hole = d.getElementById('spotHole'), tip = d.getElementById('spotTip');
    if (!hole || !tip) return;
    goTab(s.tab);
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      var el = elOf(s);
      if (s.sel && !el) { idx += (dir < 0 ? -1 : 1); if (idx < 0) idx = 0; if (idx >= STEPS.length) { end(); return; } show(dir); return; }
      if (el) { try { el.scrollIntoView({ block: 'center' }); } catch (e) {} }
      timer = setTimeout(function () { place(hole, tip, el); tip.innerHTML = html(s); }, el ? 260 : 0);
    }, s.tab ? 320 : 0);
  }
  function start() {
    var d = D(); if (!d) return false;
    if (d.getElementById('spotHole')) return false;
    var hole = d.createElement('div'); hole.id = 'spotHole'; hole.className = 'spot-hole';
    var tip = d.createElement('div'); tip.id = 'spotTip'; tip.className = 'spot-tip'; tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-live', 'polite');
    d.body.appendChild(hole); d.body.appendChild(tip);
    idx = 0; show(1); return true;
  }
  function next() { idx++; if (idx >= STEPS.length) { end(); return; } show(1); }
  function prev() { if (idx > 0) { idx--; show(-1); } }
  function end() {
    var d = D(); if (timer) clearTimeout(timer); timer = null;
    if (d) { var h = d.getElementById('spotHole'), t = d.getElementById('spotTip'); if (h) h.remove(); if (t) t.remove(); }
    var was = idx; idx = -1;
    if (was >= 0) { goTab('heute'); try { if (typeof root.toast === 'function') root.toast(T('tour.beendet')); } catch (e) {} }
  }
  function active() { return idx >= 0; }

  O.tour = { start: start, next: next, prev: prev, end: end, active: active, steps: STEPS, _html: html, _elOf: elOf, VERSION: 'tour@1' };
})(typeof window !== 'undefined' ? window : globalThis);
