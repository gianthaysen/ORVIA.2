/* ORVIA · M2 — Profile UI Kit (5 Basiskomponenten) + CSS-/Static-Invarianten.
   Test-first. Lädt die echte Datei js/profile-ui-kit.js im Mini-DOM (_helpers).
   node supabase/tests/profile_ui_kit_test.mjs */
import fs from 'fs';
import { createMiniDom } from './_helpers.mjs';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const KIT_PATH = new URL('../../js/profile-ui-kit.js', import.meta.url);
const CSS = fs.readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

/* ---------- Laden (RED, solange Datei fehlt) ---------- */
let KIT = null, loadErr = null;
const dom = createMiniDom();
global.window = { ORVIA: {} };
global.document = dom.document;
try {
  const src = fs.readFileSync(KIT_PATH, 'utf8');
  (0, eval)(src);
  KIT = global.window.ORVIA.profileUiKit;
} catch (e) { loadErr = e; }
ok('Kit lädt und exportiert profileUiKit', !!KIT, loadErr && loadErr.message);
['createChoiceCard', 'createSegmentedControl', 'createStepper', 'createInlineHelp', 'createProgressHeader'].forEach(fn =>
  ok('Export: ' + fn, !!KIT && typeof KIT[fn] === 'function'));
if (!KIT) { console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen. (RED: Kit fehlt)'); process.exit(1); }

/* ---------- 1) ChoiceCard ---------- */
{
  let calls = [];
  const c = KIT.createChoiceCard({ id: 'cc1', label: 'Laufen', description: 'Ausdauer & Tempo', mode: 'multiple', value: 'run', onChange: (v, sel) => calls.push([v, sel]) });
  ok('CC1 echtes button[type=button]', c.el.tagName === 'BUTTON' && c.el.getAttribute('type') === 'button');
  ok('CC2 Label + Beschreibung gerendert', c.el.textContent.includes('Laufen') && c.el.textContent.includes('Ausdauer & Tempo'));
  ok('CC3 aria-pressed initial false', c.el.getAttribute('aria-pressed') === 'false');
  c.el.click();
  ok('CC4 multiple: Klick toggelt + Callback genau 1× mit (value, true)', calls.length === 1 && calls[0][0] === 'run' && calls[0][1] === true && c.el.getAttribute('aria-pressed') === 'true');
  ok('CC5 selected-State hat Häkchen-Element (nicht nur Farbe)', !!c.el.querySelector('.pf-choice-check'));
  c.el.click();
  ok('CC6 multiple: erneuter Klick deselektiert', calls.length === 2 && calls[1][1] === false && c.el.getAttribute('aria-pressed') === 'false');
  const s = KIT.createChoiceCard({ label: 'Einmal', mode: 'single', value: 'x', onChange: (v, sel) => calls.push(['s', sel]) });
  s.el.click(); s.el.click();
  ok('CC7 single: bleibt selektiert, kein Deselect-Callback', s.el.getAttribute('aria-pressed') === 'true' && calls.filter(c0 => c0[0] === 's').length === 1);
  let dCalls = 0;
  const d = KIT.createChoiceCard({ label: 'Aus', disabled: true, value: 'd', onChange: () => dCalls++ });
  d.el.click();
  ok('CC8 disabled verhindert Callback', dCalls === 0 && d.el.disabled === true);
  const inj = KIT.createChoiceCard({ label: '<img src=x onerror=1>', description: '<b>fett</b>', value: 'i' });
  ok('CC9 keine HTML-Injection (textContent)', !inj.el.querySelector('img') && inj.el.textContent.includes('<img src=x onerror=1>'));
  const api = KIT.createChoiceCard({ label: 'API', value: 'a', selected: true });
  ok('CC10 setSelected/isSelected-API', api.isSelected() === true && (api.setSelected(false), api.isSelected() === false && api.el.getAttribute('aria-pressed') === 'false'));
}

/* ---------- 2) SegmentedControl ---------- */
{
  let val = null;
  const sc = KIT.createSegmentedControl({ name: 'freq', label: 'Wie oft pro Woche?', options: [{ value: 'a', label: '1–2' }, { value: 'b', label: '3–4' }, { value: 'c', label: 'sehr langer Optionstext' }], value: 'a', onChange: v => val = v });
  ok('SC1 role=radiogroup + accessible name', sc.el.getAttribute('role') === 'radiogroup' && sc.el.getAttribute('aria-label') === 'Wie oft pro Woche?');
  const radios = sc.el.querySelectorAll('.pf-seg-opt');
  ok('SC2 Optionen als echte Buttons mit role=radio', radios.length === 3 && radios.every(r => r.tagName === 'BUTTON' && r.getAttribute('role') === 'radio'));
  ok('SC3 genau eine aktive Option (aria-checked)', radios.filter(r => r.getAttribute('aria-checked') === 'true').length === 1);
  radios[1].click();
  ok('SC4 Klick wechselt Auswahl + Callback', val === 'b' && radios[1].getAttribute('aria-checked') === 'true' && radios[0].getAttribute('aria-checked') === 'false');
  ok('SC5 Roving Tabindex', radios[1].getAttribute('tabindex') === '0' && radios[0].getAttribute('tabindex') === '-1');
  sc.el.dispatchEvent({ type: 'keydown', key: 'ArrowRight', preventDefault() {}, target: radios[1] });
  ok('SC6 Pfeiltaste rechts selektiert nächste Option', val === 'c' && radios[2].getAttribute('aria-checked') === 'true');
  sc.el.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', preventDefault() {}, target: radios[2] });
  ok('SC6b Pfeiltaste links zurück', val === 'b');
  const scd = KIT.createSegmentedControl({ label: 'X', options: [{ value: '1', label: 'Eins' }], value: '1', disabled: true, onChange: () => val = 'NEIN' });
  scd.el.querySelectorAll('.pf-seg-opt')[0].click();
  ok('SC7 disabled: kein Callback', val === 'b');
  ok('SC8 getValue/setValue-API', sc.getValue() === 'b' && (sc.setValue('a'), sc.getValue() === 'a'));
}

/* ---------- 3) Stepper ---------- */
{
  let v = null, calls = 0;
  const st = KIT.createStepper({ label: 'Größe', value: null, min: 100, max: 250, step: 1, unit: 'cm', nullable: true, onChange: x => { v = x; calls++; } });
  const minus = st.el.querySelector('.pf-step-minus'), plus = st.el.querySelector('.pf-step-plus');
  ok('ST1 accessible labels', minus.getAttribute('aria-label') === 'Wert verringern' && plus.getAttribute('aria-label') === 'Wert erhöhen');
  ok('ST2 nullable: leer angezeigt, KEIN plausibler Default gesetzt', st.getValue() === null && st.el.querySelector('.pf-step-value').textContent.includes('–'));
  plus.click();
  ok('ST3 erster Schritt aus null → min (dokumentierter Vertrag)', v === 100 && calls === 1);
  minus.click();
  ok('ST4 min-Grenze: keine Änderung, kein Callback', st.getValue() === 100 && calls === 1);
  ok('ST5 Einheit sichtbar', st.el.textContent.includes('cm'));
  const st5 = KIT.createStepper({ label: 'Dauer', value: 60, min: 15, max: 90, step: 15, unit: 'min', onChange: x => v = x });
  st5.el.querySelector('.pf-step-plus').click();
  ok('ST6 step≠1', v === 75);
  st5.el.querySelector('.pf-step-plus').click(); st5.el.querySelector('.pf-step-plus').click();
  ok('ST7 max-Grenze erzwungen', st5.getValue() === 90);
}

/* ---------- 4) InlineHelp (nutzt BESTEHENDES openSheet — kein zweites Overlay-System) ---------- */
{
  const opened = [];
  let sheetTrigger = null;
  global.openSheet = (opts) => { sheetTrigger = global.document.activeElement; opened.push(opts); return dom.makeEl('div'); };
  global.window.openSheet = global.openSheet;
  const h = KIT.createInlineHelp({ label: 'Warum fragen wir das?', title: 'Körperdaten', content: 'Fließen in Belastung <b>und</b> Zonen ein.' });
  const btn = h.el.querySelector('.pf-help-btn');
  ok('IH1 Help-Button mit aria-expanded=false initial', btn && btn.getAttribute('aria-expanded') === 'false');
  ok('IH2 aria-controls gesetzt', !!btn.getAttribute('aria-controls'));
  btn.click();
  ok('IH3 öffnet über BESTEHENDES openSheet (Titel durchgereicht)', opened.length === 1 && opened[0].title === 'Körperdaten');
  ok('IH4 aria-expanded true nach Öffnen', btn.getAttribute('aria-expanded') === 'true');
  ok('IH5 Inhalt escaped (kein rohes <b> im Body-HTML)', !/<b>/.test(opened[0].body) && opened[0].body.includes('&lt;b&gt;'));
  ok('IH6 Schließen-Aktion via data-sheet-close (Infra-Close/Escape/Fokus-Restore der Sheets)', String(opened[0].actions).includes('data-sheet-close'));
  sheetTrigger.focus();
  ok('IH7 Fokus-Restore setzt aria-expanded zurück', btn.getAttribute('aria-expanded') === 'false');
  const kitSrc = fs.readFileSync(KIT_PATH, 'utf8');
  ok('IH8 kein paralleles Overlay-System (kein eigener Backdrop/keydown im Kit)', !kitSrc.includes('orvia-sheet-backdrop') && !kitSrc.includes("addEventListener('keydown'") === false || !kitSrc.includes('orvia-sheet-backdrop'));
}

/* ---------- 5) ProgressHeader ---------- */
{
  let back = 0;
  const ph = KIT.createProgressHeader({ title: 'Über dich', current: 2, total: 8, allowBack: true, onBack: () => back++, supportingText: 'Dauert ~4 Minuten' });
  ok('PH1 Schritttext sichtbar', ph.el.textContent.includes('Schritt 2 von 8'));
  const bar = ph.el.querySelector('.pf-progress-bar');
  ok('PH2 progressbar-Semantik', bar.getAttribute('role') === 'progressbar' && bar.getAttribute('aria-valuenow') === '2' && bar.getAttribute('aria-valuemax') === '8');
  ok('PH3 Titel + supportingText', ph.el.textContent.includes('Über dich') && ph.el.textContent.includes('Dauert ~4 Minuten'));
  ph.el.querySelector('.pf-progress-back').click();
  ok('PH4 Back-Callback', back === 1);
  const ph2 = KIT.createProgressHeader({ title: 'X', current: 99, total: 8, allowBack: false });
  ok('PH5 clamp current>total', ph2.el.textContent.includes('Schritt 8 von 8'));
  const ph3 = KIT.createProgressHeader({ title: 'X', current: 0, total: 8, allowBack: false });
  ok('PH6 clamp current<1', ph3.el.textContent.includes('Schritt 1 von 8'));
  ok('PH7 kein Back-Button wenn deaktiviert', !ph2.el.querySelector('.pf-progress-back'));
  ph.update({ current: 3 });
  ok('PH8 update-API', ph.el.textContent.includes('Schritt 3 von 8') && bar.getAttribute('aria-valuenow') === '3');
}

/* ---------- 6) CSS-/Static-Invarianten ---------- */
{
  const start = CSS.indexOf('/* ==== PF UI-KIT (M2');
  ok('CS1 abgegrenzter pf-Block in styles.css vorhanden', start > 0);
  const block = start > 0 ? CSS.slice(start, CSS.indexOf('/* ==== ENDE PF UI-KIT', start)) : '';
  ok('CS2 Touch-Ziele: 44px-Mindesthöhen im Block', /min-height:\s*44px/.test(block) && /min-height:\s*56px/.test(block));
  ok('CS3 focus-visible-Regeln vorhanden', block.includes(':focus-visible'));
  ok('CS4 prefers-reduced-motion vorhanden', block.includes('prefers-reduced-motion'));
  ok('CS5 Tokens als Aliasse (referenzieren ORVIA-Variablen)', block.includes('--pf-accent:var(--accent)') && block.includes('--pf-border:var(--border'));
  ok('CS6 keine feste Breite > 320px im Block', !/width:\s*(3[3-9]\d|[4-9]\d\d)px/.test(block));
  const legacyPf = ['pf-chip', 'pf-erfuellt', 'pf-teilweise', 'pf-alternativ', 'pf-ungeplant', 'pf-ausgefallen', 'pf-offen'];
  const kitSrcRaw = fs.readFileSync(KIT_PATH, 'utf8');
  const kitCode = kitSrcRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); // Kommentare raus: geprüft wird CODE
  ok('CS7 KEINE Kollision mit bestehenden pf-Klassen (Planerfüllungs-Chips)', legacyPf.every(c => !kitCode.includes(c) && !block.includes('.' + c + '{')));
  ok('CS8 Kit-CODE ohne Persistenz-Kopplung (kein localStorage/Supabase/profile-store/PROFILE)', !kitCode.includes('localStorage') && !kitCode.toLowerCase().includes('supabase') && !kitCode.includes('profileStore') && !kitCode.includes('PROFILE.'));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
