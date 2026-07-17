/* ORVIA · Profil-Paket 2026-07 — Modal-/Sheet-Infrastruktur (profile.js) + CSS-Invarianten.
   Funktional: _modal() liefert role=dialog/aria-modal, Escape schließt oberstes Overlay
   (Modal vor Sheet), Fokus-Restore zum Auslöser. Statisch: genau EIN Scroll-Owner pro
   Modal (.orvia-modal), Sticky-Action-Bar mit explizitem Safe-Area-Bottom-Padding. */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const SRC = fs.readFileSync(new URL('../../js/profile.js', import.meta.url), 'utf8');
const CSS = fs.readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

/* ---------- Infrastruktur-Block extrahieren (fail-loud bei Umbau) ---------- */
const start = SRC.indexOf('var _sheetStack=[]');
const endMarker = "document.addEventListener('keydown',_sheetKeydown)";
const endIdx = SRC.indexOf(endMarker);
ok('Infra-Block gefunden (Marker intakt)', start >= 0 && endIdx > start);
const infra = SRC.slice(start, SRC.indexOf('\n', endIdx));

/* ---------- Mini-DOM-Harness ---------- */
function makeEl() {
  const kids = new Map();
  return {
    style: {}, _html: '', _removed: false, _focused: 0,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    set className(v) { this._cls = v; }, get className() { return this._cls; },
    addEventListener() {}, setAttribute() {}, removeAttribute() {},
    focus() { this._focused++; },
    remove() { this._removed = true; },
    querySelector(sel) { if (!kids.has(sel)) kids.set(sel, makeEl()); return kids.get(sel); }
  };
}
const handlers = {};
const trigger = makeEl();
const doc = {
  activeElement: trigger,
  createElement: makeEl,
  body: { appendChild() {}, classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } } },
  querySelector() { return null; },   // keine FREMDEN .orvia-modal-bg im Test-DOM
  addEventListener(ev, cb) { handlers[ev] = cb; }
};
const win = {};
let api = null, evalErr = null;
try {
  api = new Function('window', 'document', infra + '\n;return {_modal:_modal,openSheet:openSheet,_closeM:_closeM};')(win, doc);
} catch (e) { evalErr = e; }
ok('Infra-Block ausführbar', !!api, evalErr && evalErr.message);

if (api) {
  /* 1) _modal: Dialog-Semantik + initialer Fokus */
  const m1 = api._modal('m1', '<h3>Test</h3>');
  ok('_modal: role="dialog" gesetzt', (m1._html || '').indexOf('role="dialog"') >= 0);
  ok('_modal: aria-modal="true" gesetzt', (m1._html || '').indexOf('aria-modal="true"') >= 0);
  ok('_modal: tabindex="-1" (programmatischer Fokus)', (m1._html || '').indexOf('tabindex="-1"') >= 0);
  ok('_modal: Dialog-Container erhält Fokus', m1.querySelector('.orvia-modal')._focused === 1);

  /* 2) Escape schließt das Modal, Fokus geht zum Auslöser zurück */
  const focBefore = trigger._focused;
  handlers.keydown({ key: 'Escape' });
  ok('Escape: Modal geschlossen (window[id] = null)', win.m1 === null);
  ok('Escape: Fokus-Restore zum Auslöser', trigger._focused === focBefore + 1);

  /* 3) Overlay-Reihenfolge: Modal über Sheet → Escape schließt erst Modal, dann Sheet */
  api.openSheet({ id: 's1', title: 'T', body: 'B', actions: 'A' });
  ok('openSheet: Scroll-Lock aktiv (body.sheet-open)', doc.body.classList.contains('sheet-open'));
  api._modal('m2', '<h3>Über Sheet</h3>');
  handlers.keydown({ key: 'Escape' });
  ok('Escape 1: Modal zu, Sheet bleibt offen', win.m2 === null && !!win.s1);
  handlers.keydown({ key: 'Escape' });
  ok('Escape 2: Sheet geschlossen', win.s1 === null);
  ok('Sheet zu: Scroll-Lock aufgehoben', !doc.body.classList.contains('sheet-open'));
}

/* ---------- CSS-Invarianten ---------- */
function rule(sel) {
  // Nur eigenständige Regeln am Zeilenanfang treffen (nicht z. B. ".goal-modal,.orvia-modal{").
  const m = CSS.match(new RegExp('(^|\\n)' + sel.replace(/\./g, '\\.') + '\\{[^}]*'));
  return m ? m[0] : '';
}
const bg = rule('.orvia-modal-bg');
ok('CSS: .orvia-modal-bg existiert', bg.length > 0);
ok('CSS: .orvia-modal-bg scrollt NICHT (kein overflow-y) — ein Scroll-Owner pro Modal', bg.indexOf('overflow-y') < 0);
ok('CSS: .orvia-modal ist Scroll-Owner (overflow-y)', rule('.orvia-modal').indexOf('overflow-y:auto') >= 0);
const gma = rule('.gm-modal-actions');
ok('CSS: .gm-modal-actions mit explizitem Bottom-Padding + Safe-Area',
  gma.indexOf('calc(10px + env(safe-area-inset-bottom))') >= 0);
ok('CSS: .orvia-sheet-actions behält Safe-Area (Regression)',
  rule('.orvia-sheet-actions').indexOf('env(safe-area-inset-bottom)') >= 0);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
