/* ============================================================
   ORVIA · M9 — Orientierungs-Spotlight (Coachmarks). Verträge:
   - user-scoped Flag orvia_coachmarks_v1:<uid> {pending, shown}
   - Spotlight erscheint genau EINMAL (pending → shown), dismissbar,
     nie ohne Flag, nie bei bereits erledigtem Morgen-Check-in,
     wiederholbar über reset(); Event orvia:onboarding-completed triggert.
   node supabase/tests/coachmarks_m9_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function makeSb(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const els = {};
  const appended = [];
  function mkEl(id) {
    const el = { _id: id || null, _html: '', _ev: {}, _attr: {}, style: {}, onclick: null,
      className: '', textContent: '',
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      setAttribute(k, v) { this._attr[k] = String(v); if (k === 'id') { this._id = String(v); els[this._id] = el; } },
      getAttribute(k) { return k in this._attr ? this._attr[k] : null; },
      addEventListener(t, f) { this._ev[t] = f; }, remove() { el._removed = true; if (el._id) delete els[el._id]; },
      appendChild() {}, scrollIntoView() { el._scrolled = true; },
      querySelector() { return null; } };
    Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; var m, re = /id="([^"]+)"/g; while ((m = re.exec(v))) { if (!els[m[1]]) els[m[1]] = mkEl(m[1]); } } });
    return el;
  }
  if (opts.withForm) els.morningForm = mkEl('morningForm');
  const sb = {}; sb.window = sb; sb.self = sb; sb.console = console;
  sb.Date = Date; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.setTimeout = (f) => f && f();
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const wl = {};
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.dispatchEvent = e => { (wl[e.type] || []).forEach(f => f(e)); return true; };
  sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.document = { getElementById: id => els[id] || null, createElement: () => mkEl(), body: { appendChild(c) { appended.push(c); if (c._id) els[c._id] = c; c.innerHTML = c.innerHTML; } } };
  if (opts.morningDone) { sb.DB = { '2026-07-03': { morning: { feel: 7 } } }; sb.todayStr = () => '2026-07-03'; }
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('../../../app/js/coachmarks.js', import.meta.url), 'utf8'), sb, { filename: 'coachmarks.js' });
  return { sb, store, els, appended, CM: sb.ORVIA.coachmarks, wl };
}
function flagged() { return { 'orvia_coachmarks_v1:anonymous': JSON.stringify({ pending: ['checkin_spotlight'], shown: [] }) }; }

{ // F1: ohne Flag → kein Spotlight (auch nicht beim Auto-Trigger im Modul-Load)
  const h = makeSb({ withForm: true });
  ok('F1 ohne Flag kein Spotlight', !h.els['cm-spotlight'] && h.CM.maybeShowCheckinSpotlight() === false);
}
{ // F2: mit Flag + Formular → Spotlight genau einmal (Auto-Trigger beim Load zählt)
  const h = makeSb({ withForm: true, store: flagged() });
  ok('F2a Spotlight sichtbar (Auto-Trigger)', !!h.els['cm-spotlight']);
  ok('F2b Flag auf shown erst nach Dismiss (pending bleibt bis dahin)', h.CM.isPending('checkin_spotlight') === true);
  h.CM.dismissSpotlight();
  ok('F2c Dismiss entfernt + markiert shown', !h.els['cm-spotlight'] && h.CM.isPending('checkin_spotlight') === false);
  ok('F2d kein zweites automatisches Anzeigen', h.CM.maybeShowCheckinSpotlight() === false);
  const st = JSON.parse(h.store['orvia_coachmarks_v1:anonymous']);
  ok('F2e persistiert (shown enthält Marke)', st.shown.indexOf('checkin_spotlight') >= 0 && st.pending.length === 0);
}
{ // F3: Morgen-Check-in heute bereits erledigt → kein Spotlight, Flag verbraucht
  const h = makeSb({ withForm: true, store: flagged(), morningDone: true });
  ok('F3 erledigt → kein Spotlight + verbraucht', !h.els['cm-spotlight'] && h.CM.isPending('checkin_spotlight') === false);
}
{ // F4: Formular (Heute-Tab) nicht sichtbar → später erneut möglich (Flag bleibt pending)
  const h = makeSb({ withForm: false, store: flagged() });
  ok('F4 ohne Formular kein Spotlight, Flag bleibt', !h.els['cm-spotlight'] && h.CM.isPending('checkin_spotlight') === true);
}
{ // F5: reset() macht wiederholbar
  const h = makeSb({ withForm: true, store: flagged() });
  h.CM.dismissSpotlight();
  h.CM.reset();
  const st = JSON.parse(h.store['orvia_coachmarks_v1:anonymous']);
  ok('F5 reset leert shown/pending', st.shown.length === 0 && st.pending.length === 0);
}
{ // F6: Event orvia:onboarding-completed triggert Anzeige
  const h = makeSb({ withForm: true });
  h.sb.localStorage.setItem('orvia_coachmarks_v1:anonymous', JSON.stringify({ pending: ['checkin_spotlight'], shown: [] }));
  h.sb.dispatchEvent(new h.sb.CustomEvent('orvia:onboarding-completed', { detail: {} }));
  ok('F6 Event → Spotlight', !!h.els['cm-spotlight']);
}
{ // F7: A11y + Inhalt
  const h = makeSb({ withForm: true, store: flagged() });
  const el = h.els['cm-spotlight'];
  ok('F7a role=dialog + beschriftet', el.getAttribute('role') === 'dialog' && el.getAttribute('aria-labelledby') === 'cm-spot-title');
  ok('F7b Text erklärt Nutzen (Empfehlung nach Check-in)', (el.innerHTML || '').indexOf('erste Empfehlung') >= 0);
  ok('F7c CTA + Später vorhanden', (el.innerHTML || '').indexOf('cm-spot-go') >= 0 && (el.innerHTML || '').indexOf('cm-spot-skip') >= 0);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
