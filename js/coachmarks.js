/* ============================================================
   ORVIA · coachmarks — M9 Orientierung (Redesign-Plan I, Revision 1).
   EIN Orientierungs-Spotlight auf den ersten Check-in nach dem Onboarding —
   keine 5-Schritt-Tour. Regeln:
   - user-scoped Flags in `orvia_coachmarks_v1:<uid>` { pending:[], shown:[] }
   - jede Marke erscheint höchstens EINMAL automatisch (pending → shown)
   - dismissbar (Button/Backdrop), blockiert nichts, erklärt nur Existierendes
   - wiederholbar über reset() (Einstieg „Einführung erneut zeigen" folgt)
   - kein Spotlight, wenn der Morgen-Check-in heute bereits erledigt ist
   Produzenten des Flags: Onboarding-Erfolgsscreen (M8).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  function D() { return (typeof document !== 'undefined') ? document : null; }
  function uid() { try { return (O.user && O.user.id) || null; } catch (e) { return null; } }
  function key() { return 'orvia_coachmarks_v1:' + (uid() || 'anonymous'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function readFlags() {
    try {
      var raw = localStorage.getItem(key());
      var v = raw ? JSON.parse(raw) : {};
      if (!v || typeof v !== 'object') v = {};
      if (!Array.isArray(v.pending)) v.pending = [];
      if (!Array.isArray(v.shown)) v.shown = [];
      return v;
    } catch (e) { return { pending: [], shown: [] }; }
  }
  function writeFlags(v) { try { localStorage.setItem(key(), JSON.stringify(v)); } catch (e) {} }
  function isPending(id) { var f = readFlags(); return f.pending.indexOf(id) >= 0 && f.shown.indexOf(id) < 0; }
  function markShown(id) {
    var f = readFlags();
    f.pending = f.pending.filter(function (x) { return x !== id; });
    if (f.shown.indexOf(id) < 0) f.shown.push(id);
    writeFlags(f);
  }
  function reset() { writeFlags({ pending: [], shown: [] }); }

  // Morgen-Check-in heute schon erledigt? (dann kein „erster Check-in"-Hinweis)
  function morningDoneToday() {
    try {
      if (typeof root.DB === 'undefined' || typeof root.todayStr !== 'function') return false;
      var d = root.DB[root.todayStr()];
      return !!(d && d.morning);
    } catch (e) { return false; }
  }

  var SPOTLIGHT_ID = 'checkin_spotlight';
  function dismissSpotlight() {
    var doc = D(); if (!doc) return;
    var el = doc.getElementById('cm-spotlight');
    if (el && el.remove) { try { el.remove(); } catch (e) {} }
    markShown(SPOTLIGHT_ID);
  }
  /* Zeigt das Spotlight genau einmal, wenn (a) Flag pending, (b) Check-in-Formular
     vorhanden, (c) heute noch kein Morgen-Check-in. Liefert true bei Anzeige. */
  function maybeShowCheckinSpotlight() {
    var doc = D(); if (!doc) return false;
    if (!isPending(SPOTLIGHT_ID)) return false;
    if (doc.getElementById('cm-spotlight')) return false;   // bereits sichtbar
    if (morningDoneToday()) { markShown(SPOTLIGHT_ID); return false; }   // erledigt → nie mehr anmahnen
    var form = doc.getElementById('morningForm');
    if (!form) return false;   // Heute-Tab (noch) nicht sichtbar → später erneut versuchen
    var wrap = doc.createElement('div');
    wrap.className = 'cm-spot-bg';
    wrap.setAttribute('id', 'cm-spotlight');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'false');
    wrap.setAttribute('aria-labelledby', 'cm-spot-title');
    wrap.innerHTML =
      '<div class="cm-spot-card">' +
        '<div class="cm-spot-kicker">Los geht’s</div>' +
        '<h3 id="cm-spot-title" class="cm-spot-title">Starte mit deinem ersten Check-in.</h3>' +
        '<p class="cm-spot-text">Daraus entsteht deine erste Empfehlung — direkt hier auf dem Heute-Tab.</p>' +
        '<button type="button" class="btn" id="cm-spot-go">Zum Check-in</button>' +
        '<button type="button" class="cm-spot-dismiss" id="cm-spot-skip">Später</button>' +
      '</div>';
    doc.body.appendChild(wrap);
    try { form.scrollIntoView && form.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    var go = doc.getElementById('cm-spot-go');
    if (go) go.onclick = function () {
      dismissSpotlight();
      try { form.scrollIntoView && form.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      try { var first = form.querySelector && form.querySelector('input,button,select'); if (first && first.focus) first.focus(); } catch (e) {}
    };
    var skip = doc.getElementById('cm-spot-skip');
    if (skip) skip.onclick = dismissSpotlight;
    try { wrap.addEventListener('click', function (ev) { if (ev.target === wrap) dismissSpotlight(); }); } catch (e) {}
    return true;
  }

  O.coachmarks = {
    maybeShowCheckinSpotlight: maybeShowCheckinSpotlight,
    dismissSpotlight: dismissSpotlight,
    isPending: isPending,
    markShown: markShown,
    reset: reset,
    _key: key
  };

  // Auslöser: (a) direkt nach Modul-Load (App-Neustart nach Abschluss),
  // (b) nach Onboarding-Abschluss (Event aus M4/M8) mit kleinem Defer für den Tabwechsel.
  try { setTimeout(maybeShowCheckinSpotlight, 400); } catch (e) {}
  try {
    root.addEventListener && root.addEventListener('orvia:onboarding-completed', function () {
      setTimeout(maybeShowCheckinSpotlight, 600);
    });
  } catch (e) {}
})(typeof globalThis !== 'undefined' ? globalThis : this);
