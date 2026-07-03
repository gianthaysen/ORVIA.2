/* ============================================================
   ORVIA · profile-ui-kit (M2) — 5 Basiskomponenten für Setup & Profilzentrale
   ChoiceCard · SegmentedControl · Stepper · InlineHelp · ProgressHeader

   ARCHITEKTURREGELN (verbindlich, s. Redesign-Plan G/J):
   - zustandsarm: Daten hinein, Callback hinaus; KEIN Zugriff auf PROFILE,
     localStorage, Supabase oder profile-store.
   - Factories geben { el, …kleine Update-API } zurück.
   - Alle Listener hängen am eigenen Element → Cleanup = Element entfernen
     (kein globaler Leak). EINZIGE Ausnahme: InlineHelp delegiert das Overlay
     an das BESTEHENDE globale openSheet() (profile.js) — Escape, Overlay-Stack
     und Fokus-Restore kommen von dort (kein paralleles Overlay-System).
     Close-Erkennung: die Sheet-Infrastruktur fokussiert beim Schließen den
     Auslöser (Fokus-Restore-Vertrag) → 'focus' auf dem Help-Button setzt
     aria-expanded zurück. Deshalb fokussiert der Klick-Handler den Button
     VOR dem Öffnen explizit (iOS-Safari fokussiert Buttons nicht automatisch).
   - Texte ausschließlich über textContent / Escaping — kein unsicheres innerHTML.
   - Keine Essential-/Advanced-Geschäftslogik im Kit.
   Über window.ORVIA.profileUiKit UND module.exports (Node-Tests).
   ============================================================ */
(function (root) {
  var _uid = 0;
  function uid(prefix) { _uid += 1; return prefix + '-' + _uid; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mkBtn(className) {
    var b = document.createElement('button');
    b.setAttribute('type', 'button');
    b.className = className;
    return b;
  }

  /* ---------- 1) ChoiceCard ----------
     mode 'multiple': Klick toggelt (Callback (value, selected)).
     mode 'single': Klick selektiert; Deselektion/Gruppenlogik liegt beim Aufrufer. */
  function createChoiceCard(opts) {
    opts = opts || {};
    var mode = opts.mode === 'single' ? 'single' : 'multiple';
    var selected = !!opts.selected;
    var el = mkBtn('pf-choice');
    if (opts.id) el.setAttribute('id', opts.id);
    el.setAttribute('aria-pressed', String(selected));
    if (opts.disabled) { el.disabled = true; el.setAttribute('disabled', 'disabled'); el.classList.add('pf-is-disabled'); }

    if (opts.icon) {
      var ic = document.createElement('span');
      ic.className = 'pf-choice-icon'; ic.setAttribute('aria-hidden', 'true');
      ic.textContent = String(opts.icon);
      el.appendChild(ic);
    }
    var body = document.createElement('span'); body.className = 'pf-choice-body';
    var lab = document.createElement('span'); lab.className = 'pf-choice-label';
    lab.textContent = String(opts.label == null ? '' : opts.label);
    body.appendChild(lab);
    if (opts.description) {
      var desc = document.createElement('span'); desc.className = 'pf-choice-desc';
      desc.textContent = String(opts.description);
      body.appendChild(desc);
    }
    el.appendChild(body);
    /* Selected-Zustand ist NICHT nur Farbe: sichtbares Häkchen-Element. */
    var check = document.createElement('span');
    check.className = 'pf-choice-check'; check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';
    el.appendChild(check);

    function apply() {
      el.setAttribute('aria-pressed', String(selected));
      el.classList.toggle('pf-is-selected', selected);
    }
    apply();
    el.addEventListener('click', function () {
      if (el.disabled) return;
      if (mode === 'single') {
        if (selected) return;               // bleibt selektiert, kein Deselect-Callback
        selected = true;
      } else {
        selected = !selected;
      }
      apply();
      if (typeof opts.onChange === 'function') opts.onChange(opts.value, selected);
    });

    return {
      el: el,
      isSelected: function () { return selected; },
      setSelected: function (v) { selected = !!v; apply(); },
      setDisabled: function (v) { el.disabled = !!v; el.classList.toggle('pf-is-disabled', !!v); if (v) el.setAttribute('disabled', 'disabled'); else el.removeAttribute('disabled'); }
    };
  }

  /* ---------- 2) SegmentedControl ----------
     Custom-Radiogroup: role=radiogroup, Optionen role=radio, Roving Tabindex,
     Pfeiltasten links/rechts/oben/unten. */
  function createSegmentedControl(opts) {
    opts = opts || {};
    var options = Array.isArray(opts.options) ? opts.options : [];
    var value = opts.value != null ? opts.value : (options[0] && options[0].value);
    var disabled = !!opts.disabled;
    var el = document.createElement('div');
    el.className = 'pf-segmented';
    el.setAttribute('role', 'radiogroup');
    el.setAttribute('aria-label', String(opts.label || opts.name || 'Auswahl'));
    var btns = [];

    function apply() {
      btns.forEach(function (b, i) {
        var on = options[i].value === value;
        b.setAttribute('aria-checked', String(on));
        b.setAttribute('tabindex', on ? '0' : '-1');
        b.classList.toggle('pf-is-selected', on);
      });
    }
    function select(i, fire) {
      if (disabled || !options[i]) return;
      var nv = options[i].value;
      if (nv === value) { apply(); return; }
      value = nv; apply();
      if (fire && typeof opts.onChange === 'function') opts.onChange(value);
    }
    options.forEach(function (o, i) {
      var b = mkBtn('pf-seg-opt');
      if (o && o.id) b.setAttribute('id', String(o.id));   // optionale stabile ID (Testbarkeit/a11y-Verweise)
      b.setAttribute('role', 'radio');
      b.textContent = String(o.label == null ? o.value : o.label);
      if (disabled) { b.disabled = true; b.setAttribute('disabled', 'disabled'); }
      b.addEventListener('click', function () { select(i, true); });
      el.appendChild(b); btns.push(b);
    });
    el.addEventListener('keydown', function (ev) {
      if (disabled) return;
      var idx = options.findIndex(function (o) { return o.value === value; });
      var next = null;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = Math.min(options.length - 1, idx + 1);
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = Math.max(0, idx - 1);
      else return;
      if (ev.preventDefault) ev.preventDefault();
      if (next !== idx) { select(next, true); if (btns[next] && btns[next].focus) btns[next].focus(); }
    });
    apply();

    return {
      el: el,
      getValue: function () { return value; },
      setValue: function (v) { value = v; apply(); },
      setDisabled: function (v) { disabled = !!v; btns.forEach(function (b) { b.disabled = disabled; }); }
    };
  }

  /* ---------- 3) Stepper ----------
     nullable: startet leer ('–'), setzt KEINEN plausiblen Default; erste
     Interaktion (Plus ODER Minus) betritt den Bereich bei min (dokumentiert).
     Callback nur bei tatsächlicher Wertänderung. */
  function createStepper(opts) {
    opts = opts || {};
    var min = opts.min != null ? opts.min : 0;
    var max = opts.max != null ? opts.max : 100;
    var step = opts.step != null ? opts.step : 1;
    var value = opts.value != null ? opts.value : (opts.nullable ? null : min);
    var labelId = uid('pf-step-label');

    var el = document.createElement('div');
    el.className = 'pf-stepper';
    var lab = document.createElement('span');
    lab.className = 'pf-step-label'; lab.setAttribute('id', labelId);
    lab.textContent = String(opts.label == null ? '' : opts.label);
    el.appendChild(lab);

    var row = document.createElement('div'); row.className = 'pf-step-row';
    var minus = mkBtn('pf-step-minus'); minus.setAttribute('aria-label', 'Wert verringern'); minus.textContent = '−';
    var valEl = document.createElement('span');
    valEl.className = 'pf-step-value'; valEl.setAttribute('aria-live', 'polite'); valEl.setAttribute('aria-describedby', labelId);
    var plus = mkBtn('pf-step-plus'); plus.setAttribute('aria-label', 'Wert erhöhen'); plus.textContent = '+';
    row.appendChild(minus); row.appendChild(valEl); row.appendChild(plus);
    el.appendChild(row);

    function render() {
      valEl.textContent = value == null ? '–' : (String(value) + (opts.unit ? ' ' + opts.unit : ''));
    }
    function setValue(nv, fire) {
      if (nv != null) nv = Math.min(max, Math.max(min, nv));
      if (nv === value) return;
      value = nv; render();
      if (fire && typeof opts.onChange === 'function') opts.onChange(value);
    }
    minus.addEventListener('click', function () { setValue(value == null ? min : value - step, true); });
    plus.addEventListener('click', function () { setValue(value == null ? min : value + step, true); });
    render();

    return {
      el: el,
      getValue: function () { return value; },
      setValue: function (v) { setValue(v, false); }
    };
  }

  /* ---------- 4) InlineHelp ----------
     Delegiert an das BESTEHENDE openSheet (profile.js): Overlay-Stack, Escape,
     Fokus-Restore kommen von dort. Fehlt openSheet (z. B. Modul nicht geladen),
     ist der Button deaktiviert (fail-safe, dokumentierte Grenze). */
  function createInlineHelp(opts) {
    opts = opts || {};
    var contentId = uid('pf-help-content');
    var sheetId = uid('_pfHelp');
    var el = document.createElement('span');
    el.className = 'pf-help';
    var btn = mkBtn('pf-help-btn');
    btn.textContent = '?';
    btn.setAttribute('aria-label', String(opts.label || 'Hilfe'));
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', contentId);
    el.appendChild(btn);

    function sheetFn() {
      if (typeof openSheet === 'function') return openSheet;
      if (root && typeof root.openSheet === 'function') return root.openSheet;
      return null;
    }
    if (!sheetFn()) { btn.disabled = true; btn.setAttribute('disabled', 'disabled'); }

    btn.addEventListener('click', function () {
      var open = sheetFn();
      if (!open || btn.disabled) return;
      if (btn.focus) btn.focus();          // sichert Fokus-Restore-Vertrag (iOS)
      open({
        id: sheetId,
        title: String(opts.title || 'Hilfe'),
        body: '<div id="' + esc(contentId) + '" class="pf-help-content">' + esc(opts.content) + '</div>',
        actions: '<button type="button" class="btn" data-sheet-close="' + esc(sheetId) + '">Verstanden</button>',
        size: 'large'
      });
      btn.setAttribute('aria-expanded', 'true');
    });
    /* Fokus-Restore der Sheet-Infrastruktur beim Schließen → expanded zurücksetzen. */
    btn.addEventListener('focus', function () {
      if (btn.getAttribute('aria-expanded') === 'true') btn.setAttribute('aria-expanded', 'false');
    });

    return { el: el, button: btn };
  }

  /* ---------- 5) ProgressHeader ----------
     Text „Schritt X von Y" (nicht nur Farbe/Balken) + role=progressbar.
     current wird sicher auf [1..total] geklemmt. */
  function createProgressHeader(opts) {
    opts = opts || {};
    var total = Math.max(1, parseInt(opts.total, 10) || 1);
    var current = clamp(opts.current);
    function clamp(c) { c = parseInt(c, 10); if (isNaN(c)) c = 1; return Math.min(total, Math.max(1, c)); }

    var el = document.createElement('header');
    el.className = 'pf-progress';
    var top = document.createElement('div'); top.className = 'pf-progress-top';
    var backBtn = null;
    if (opts.allowBack) {
      backBtn = mkBtn('pf-progress-back');
      backBtn.setAttribute('aria-label', 'Zurück');
      backBtn.textContent = '‹';
      backBtn.addEventListener('click', function () { if (typeof opts.onBack === 'function') opts.onBack(); });
      top.appendChild(backBtn);
    }
    var stepText = document.createElement('span'); stepText.className = 'pf-progress-step';
    top.appendChild(stepText);
    el.appendChild(top);

    var title = document.createElement('div'); title.className = 'pf-progress-title';
    title.textContent = String(opts.title == null ? '' : opts.title);
    el.appendChild(title);
    if (opts.supportingText) {
      var sup = document.createElement('div'); sup.className = 'pf-progress-support';
      sup.textContent = String(opts.supportingText);
      el.appendChild(sup);
    }
    var bar = document.createElement('div');
    bar.className = 'pf-progress-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '1');
    var fill = document.createElement('div'); fill.className = 'pf-progress-fill';
    bar.appendChild(fill);
    el.appendChild(bar);

    function render() {
      stepText.textContent = 'Schritt ' + current + ' von ' + total;
      bar.setAttribute('aria-valuemax', String(total));
      bar.setAttribute('aria-valuenow', String(current));
      fill.style.width = Math.round((current / total) * 100) + '%';
    }
    render();

    return {
      el: el,
      update: function (patch) {
        patch = patch || {};
        if (patch.total != null) total = Math.max(1, parseInt(patch.total, 10) || total);
        if (patch.current != null) current = clamp(patch.current);
        if (patch.title != null) title.textContent = String(patch.title);
        render();
      }
    };
  }

  var api = {
    createChoiceCard: createChoiceCard,
    createSegmentedControl: createSegmentedControl,
    createStepper: createStepper,
    createInlineHelp: createInlineHelp,
    createProgressHeader: createProgressHeader
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA = root.ORVIA || {}; root.ORVIA.profileUiKit = api;
})(typeof window !== 'undefined' ? window : globalThis);
