/* ORVIA · Phase 4j.1 — Mobile Sheet- & Action-Bar-Grundlage (DOM-Integrationstest, vm-Sandbox).
   Lädt profile-model.js + profile.js in eine gemeinsame Sandbox mit DOM-/localStorage-Stubs
   und prüft NUR die Infrastruktur (Container/Header/Scroll/Footer/Stack/Lock/Fokus/Escape).
   Keine Fachlogik, keine Trainingsplan-Engine. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

// ---- Reichhaltigere DOM-Stubs (style, classList, querySelector, setAttribute, Fokus) ----
const store = {};
const els = {};
function mkEl(extra) {
  const el = {
    value: '', checked: false, textContent: '', _html: '', tag: '',
    style: {}, dataset: {},
    _attrs: {}, _focusCount: 0,
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} },
    setAttribute(k,v){this._attrs[k]=v;}, removeAttribute(k){delete this._attrs[k];}, getAttribute(k){return this._attrs[k]!=null?this._attrs[k]:null;},
    querySelector(){return null;}, querySelectorAll(){return [];},
    addEventListener(){}, removeEventListener(){}, remove(){}, appendChild(){}, closest(){return null;},
    focus(){this._focusCount++;}
  };
  Object.defineProperty(el, 'innerHTML', { get(){return this._html;}, set(v){this._html=v;} });
  return Object.assign(el, extra || {});
}
const sandbox = {};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.console = console;
sandbox.Date = Date; sandbox.Math = Math; sandbox.JSON = JSON; sandbox.parseInt = parseInt; sandbox.parseFloat = parseFloat;
sandbox.isNaN = isNaN; sandbox.Array = Array; sandbox.Object = Object; sandbox.String = String; sandbox.Set = Set;
sandbox.escH = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
sandbox.toast = () => {};
sandbox.renderProfileScreen = () => {};
sandbox.renderZones = () => {};
sandbox.localStorage = { _d: store, getItem(k){ return store[k] || null; }, setItem(k, v){ store[k] = v; } };
const bodyEl = mkEl();
let _docListeners = {};
sandbox.document = {
  getElementById: (id) => els[id] || null,
  createElement: () => mkEl(),
  body: bodyEl,
  activeElement: null,
  addEventListener: (t, fn) => { (_docListeners[t] = _docListeners[t] || []).push(fn); },
  removeEventListener: () => {},
  querySelector: (sel) => {
    // nur das in den Tests benötigte Verhalten: gibt es ein offenes .orvia-modal-bg?
    if (sel === '.orvia-modal-bg') {
      for (const k in sandbox) { const v = sandbox[k]; if (v && v.className === 'orvia-modal-bg') return v; }
      return null;
    }
    return null;
  },
  querySelectorAll: () => []
};
sandbox.module = undefined;
const winListeners = {};
sandbox.CustomEvent = function (type, init) { this.type = type; this.detail = (init && init.detail) || null; };
sandbox.addEventListener = (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); };
sandbox.removeEventListener = (t, fn) => { winListeners[t] = (winListeners[t] || []).filter(f => f !== fn); };
sandbox.dispatchEvent = (ev) => { (winListeners[ev.type] || []).forEach(fn => fn(ev)); return true; };
vm.createContext(sandbox);
const base = new URL('../../js/', import.meta.url);
vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sandbox, { filename: 'profile-model.js' });
vm.runInContext(readFileSync(new URL('profile.js', base), 'utf8'), sandbox, { filename: 'profile.js' });

ok('Setup: profile-model + profile.js geladen', !!sandbox.ORVIA && typeof sandbox.openSheet === 'function' && typeof sandbox._closeM === 'function');

// Frisches v2-Profil mit Sportarten (für sportabhängige Editoren)
sandbox.PROFILE = sandbox.ORVIA.profileModel.migrateProfile({ version: 1, onboarded: true, name: 'Gian', weightKg: 75, sports: ['running', 'cycling'] });
sandbox.PROFILE.goals = [];

function fresh(){ for (const k in els) delete els[k]; bodyEl.classList._s.clear(); }
function scrollOf(html){ return html.indexOf('class="orvia-sheet-scroll"'); }
function footerOf(html){ return html.indexOf('class="orvia-sheet-actions"'); }
function headerOf(html){ return html.indexOf('class="orvia-sheet-header"'); }
function countScroll(html){ return (html.match(/orvia-sheet-scroll/g) || []).length; }

// ---- 1. openSheet-Grundstruktur ----
fresh();
sandbox.openSheet({ id: '_t1', title: 'Test', body: '<div id="t1b">INHALT</div>', actions: '<button class="btn" id="t1s">Speichern</button>' });
const w1 = sandbox._t1; const h1 = w1 ? w1.innerHTML : '';
ok('1 Backdrop erzeugt mit Klasse orvia-sheet-backdrop', !!w1 && w1.className === 'orvia-sheet-backdrop');
ok('2 genau EIN .orvia-sheet-scroll', countScroll(h1) === 1);
ok('3 Reihenfolge Header < Scroll < Footer (Footer außerhalb Scroll)', headerOf(h1) >= 0 && headerOf(h1) < scrollOf(h1) && scrollOf(h1) < footerOf(h1));
ok('4 Body landet im Scrollbereich, nicht im Footer', h1.indexOf('INHALT') > scrollOf(h1) && h1.indexOf('INHALT') < footerOf(h1));
ok('4b Footer enthält Save-Action', h1.slice(footerOf(h1)).indexOf('Speichern') >= 0);
ok('A11y role=dialog + aria-modal + aria-labelledby', /role="dialog"/.test(h1) && /aria-modal="true"/.test(h1) && /aria-labelledby="_t1__t"/.test(h1));
ok('Schließen-Button mit aria-label + data-sheet-close', /class="orvia-sheet-x"/.test(h1) && /aria-label="Schließen"/.test(h1) && /data-sheet-close="_t1"/.test(h1));

// ---- 5. Scroll-Lock ----
ok('5 Hintergrund-Scroll gesperrt (body.sheet-open)', bodyEl.classList.contains('sheet-open'));
sandbox._closeM('_t1');
ok('5b Scroll-Lock beim Schließen entfernt', !bodyEl.classList.contains('sheet-open') && sandbox._t1 === null);

// ---- 6–11. Editoren nutzen Sheet; Footer-Aktionen außerhalb des Scrolls ----
function expectSheet(name, openFn, id, scrollBodyId, needWords){
  fresh();
  if (scrollBodyId) els[scrollBodyId] = mkEl(); // dynamischer Scroll-Container vor Render registrieren
  openFn();
  const w = sandbox[id]; const html = w ? w.innerHTML : '';
  const isSheet = !!w && w.className === 'orvia-sheet-backdrop' && countScroll(html) === 1 && footerOf(html) > scrollOf(html);
  // Footer-Aktionen
  const footHtml = footerOf(html) >= 0 ? html.slice(footerOf(html)) : '';
  const hasActions = needWords.every(wd => footHtml.indexOf(wd) >= 0);
  // dynamischer Scrollinhalt darf KEINE alte sticky gm-modal-actions enthalten
  const noLegacyActions = scrollBodyId ? (els[scrollBodyId].innerHTML.indexOf('gm-modal-actions') < 0) : true;
  ok(name + ' nutzt Sheet (1 Scroll, Footer außerhalb)', isSheet);
  ok(name + ' Footer enthält ' + needWords.join('/'), hasActions);
  if (scrollBodyId) ok(name + ' Scrollinhalt ohne Legacy-Actionbar', noLegacyActions);
  sandbox._closeM(id);
  return w;
}
// Performance-Manager (Container) muss offen sein für Sub-Editoren
sandbox.openPerformanceManager();
ok('9 Performance-Manager nutzt Sheet', sandbox._perfMgr && sandbox._perfMgr.className === 'orvia-sheet-backdrop');
sandbox._closeM('_perfMgr');

expectSheet('6 Trainingsverfügbarkeit', () => sandbox.openAvailabilityEditor(), '_secEdM', 'avBody', ['Speichern', 'Abbrechen']);
expectSheet('7 Recovery', () => sandbox.openRecoveryEditor(), '_recEdM', null, ['Speichern', 'Abbrechen']);
expectSheet('8 Preferences', () => sandbox.openPreferencesEditor(), '_prefEdM', null, ['Speichern', 'Abbrechen']);
expectSheet('10 Ziel-Editor', () => sandbox.openGoalEditor(), '_goalEd', 'gwBody', ['gwNav']);
expectSheet('11 Sportprofil', () => sandbox.openSportProfileEditor('running'), '_sppEdM', 'sppBody', ['Speichern', 'Abbrechen']);
// Statische Performance-Sub-Editoren brauchen offenen _perfEd-Kontext
sandbox.openPerformanceManager();
expectSheet('Körperdaten', () => sandbox.openBodyEditor(), '_perfSub', null, ['Speichern', 'Abbrechen']);
expectSheet('Ausdauerwerte', () => sandbox.openEnduranceEditor(), '_perfSub', null, ['Speichern', 'Abbrechen']);
expectSheet('Bestzeiten', () => sandbox.openPbEditor(), '_perfSub', null, ['Speichern', 'Abbrechen']);
expectSheet('Kraftwerte', () => sandbox.openSrEditor(), '_perfSub', null, ['Speichern', 'Abbrechen']);
sandbox._closeM('_perfMgr');

// ---- 12. Verschachtelter Untereditor: nur EIN sichtbares Sheet ----
fresh();
sandbox.openPerformanceManager();
els.perfBody = mkEl();
sandbox.openBodyEditor(); // Sub-Editor über dem Manager
const mgrHidden = sandbox._perfMgr && (sandbox._perfMgr.style.display === 'none' || sandbox._perfMgr.getAttribute('aria-hidden') === 'true');
const subVisible = sandbox._perfSub && sandbox._perfSub.style.display !== 'none';
ok('12 Sub-Editor offen → Manager verdeckt (nur ein sichtbares Sheet)', mgrHidden && subVisible);
sandbox._closeM('_perfSub');
const mgrVisibleAgain = sandbox._perfMgr && sandbox._perfMgr.style.display !== 'none' && sandbox._perfMgr.getAttribute('aria-hidden') !== 'true';
ok('12b Sub-Editor geschlossen → Manager wieder sichtbar', mgrVisibleAgain);
sandbox._closeM('_perfMgr');
ok('13 Scroll-Lock nach Schließen aller Sheets entfernt', !bodyEl.classList.contains('sheet-open'));

// ---- 14. Escape schließt oberstes Sheet (Desktop) ----
fresh();
sandbox.openAvailabilityEditor();
const before = !!sandbox._secEdM;
_docListeners['keydown'].forEach(fn => fn({ key: 'Escape' }));
// Escape ruft onClose=cancelAvailabilityEditor; ohne Änderungen schließt es direkt
ok('14 Escape schließt oberstes Sheet auf Desktop', before && sandbox._secEdM === null);

// ---- 15. Fokus-Rückgabe an Auslöser ----
fresh();
const trigger = mkEl(); sandbox.document.activeElement = trigger;
sandbox.openRecoveryEditor();
sandbox.document.activeElement = null;
sandbox._closeM('_recEdM');
ok('15 Fokus kehrt zum Auslöser zurück', trigger._focusCount > 0);

// ---- 16. Discard-Schutz bleibt erhalten (geänderter Entwurf → Modal statt direktem Schließen) ----
fresh();
sandbox.openRecoveryEditor();
sandbox._recEd.r.sleep.averageHours = (sandbox._recEd.r.sleep.averageHours || 0) + 1; // Änderung simulieren
els.rc_sleepH = mkEl({ value: '' }); // _recCollect liest Felder; leer lassen ⇒ Diff bleibt
sandbox.cancelRecoveryEditor();
ok('16 Discard-Schutz: bei Änderung erscheint Bestätigungs-Modal', !!sandbox._secDiscard);
sandbox._closeM('_secDiscard'); sandbox._closeM('_recEdM');

// ---- 17. Kurze Bestätigungsdialoge bleiben normale Modals (kein Sheet) ----
fresh();
sandbox._modal('_demo', '<h3>Hi</h3>');
ok('17 _modal erzeugt weiterhin .orvia-modal-bg (kein Sheet)', sandbox._demo && sandbox._demo.className === 'orvia-modal-bg');
sandbox._closeM('_demo');

console.log('\n' + (fail === 0 ? '🟢' : '🔴') + ' Phase 4j.1 Sheet-Tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
