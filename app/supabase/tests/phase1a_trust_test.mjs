/* ============================================================
   ORVIA · Phase 1A — Sichtbare Vertrauensbrüche (Regression, test-first).
   Verträge:
   1) Keine Fremdmarke „Runna" in nutzersichtbaren UI-Strings.
   2) applyDayLock sperrt auch Buttons/Chips der Check-in-Formulare.
   3) markPlannedDone erfindet keine RPE-/Performance-Werte mehr.
   4) Keine nativen confirm()-Aufrufe in den Aktivitäts-Kernflows;
      orviaConfirm (profile.js) existiert und verdrahtet Callbacks korrekt.
   5) de-DE-Zahlenformat: keine toFixed-Distanz-/Tempo-Ausgaben mehr in
      den betroffenen Bereichen (fmtDe wird genutzt).
   6) Motivations-Slogans entfernt (Quelle + Container).
   7) Verlauf-Copy verspricht kein Bearbeiten gesperrter Tage.
   8) Heute leicht beruhigt: Quick-Actions-Legacy-Karte entfernt,
      Zwischen-Check-in einklappbar.
   node supabase/tests/phase1a_trust_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const ui = readFileSync(new URL('../../js/ui.js', import.meta.url), 'utf8');
const act = readFileSync(new URL('../../js/activity.js', import.meta.url), 'utf8');
const prof = readFileSync(new URL('../../js/profile.js', import.meta.url), 'utf8');
const xtra = readFileSync(new URL('../../js/checkin-extra.js', import.meta.url), 'utf8');
const idx = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

/* ---------- 1) Fremdmarke ---------- */
{
  // Nur nutzersichtbare Strings zählen (Bezeichner wie runnaWeek/isRunna sind intern erlaubt).
  const uiClean = ui.replace(/isRunna|runnaWeek|runnaSub/g, '_id_');   // interne Bezeichner sind erlaubt
  const visibleRunna = /['"`][^'"`\n]*Runna[^'"`\n]*['"`]/.exec(uiClean);
  ok('P1A-1 kein „Runna" in UI-Strings (ui.js)', !visibleRunna, visibleRunna && visibleRunna[0]);
  ok('P1A-1b ORVIA-Laufplan-Wording vorhanden', ui.indexOf('ORVIA-Laufplan') >= 0);
  ok('P1A-1c index.html ohne Runna', !/runna/i.test(idx.replace(/runnaSub/g, '')));
}
/* ---------- 2) applyDayLock ---------- */
{
  const fn = String(ui.match(/function applyDayLock\(\)\{[\s\S]*?\n\}/));
  ok('P1A-2 applyDayLock sperrt auch Buttons der Formulare', /button/.test(fn) && /(morningForm|locked-form)/.test(fn));
  ok('P1A-2b visuelle Sperr-Klasse wird gesetzt', /locked-form/.test(fn));
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  ok('P1A-2c CSS für locked-form vorhanden', /\.locked-form/.test(css));
}
/* ---------- 3) markPlannedDone ---------- */
{
  const fn = String(ui.match(/function markPlannedDone\([\s\S]*?\n\}/));
  ok('P1A-3 keine erfundene RPE beim Erledigen', !/rpe\s*:\s*5/.test(fn));
  ok('P1A-3b keine erfundene Performance beim Erledigen', !/perf\s*:\s*6/.test(fn));
  ok('P1A-3c Quelle plan_done bleibt erhalten', /plan_done/.test(fn));
}
/* ---------- 4) confirm() raus + orviaConfirm funktioniert ---------- */
{
  ok('P1A-4 kein natives confirm() mehr in activity.js', !/\bconfirm\s*\(/.test(act.replace(/orviaConfirm/g, '')), 'Treffer: ' + (act.replace(/orviaConfirm/g, '').match(/\bconfirm\s*\(/g) || []).length);
  ok('P1A-4b orviaConfirm wird in den Kernflows genutzt', (act.match(/orviaConfirm\(/g) || []).length >= 4);
  ok('P1A-4c orviaConfirm existiert in profile.js (neben _modal, kein neues Overlay-System)', /function orviaConfirm\(/.test(prof));
  // Funktional: Helper in Sandbox — Bestätigen ruft Callback, Abbrechen nicht.
  const store = {};
  const els = {};
  function mkEl(id) {
    const el = { _id: id || null, _html: '', _ev: {}, _attr: {}, style: {}, onclick: null, focus() {}, remove() { if (el._id) delete els[el._id]; },
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      setAttribute(k, v) { this._attr[k] = String(v); if (k === 'id') { this._id = String(v); els[this._id] = el; } }, getAttribute(k) { return k in this._attr ? this._attr[k] : null; },
      addEventListener(t, f) { this._ev[t] = f; }, appendChild(c) { if (c && c._id) els[c._id] = c; if (c) c.innerHTML = c._html; },
      querySelector(s) { const m = /#([\w-]+)/.exec(s); return m && els[m[1]] ? els[m[1]] : null; }, querySelectorAll() { return []; } };
    Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; let m, re = /id="([^"]+)"/g; while ((m = re.exec(v))) { if (!els[m[1]]) els[m[1]] = mkEl(m[1]); } } });
    Object.defineProperty(el, 'id', { get() { return this._id; }, set(v) { this._id = v; if (v) els[v] = el; } });
    return el;
  }
  const sb = { window: null, console, Date, JSON, Math, Array, Object, String, Set, parseInt, parseFloat, isNaN, setTimeout: f => f && f() };
  sb.window = sb; sb.self = sb;
  sb.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { getElementById: id => els[id] || null, createElement: () => mkEl(), body: { appendChild(c) { if (c && c._id) els[c._id] = c; c.innerHTML = c._html; }, classList: { add() {}, remove() {} } }, querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } }, activeElement: null };
  sb.escH = s => String(s == null ? '' : s); sb.addEventListener = () => {}; sb.CustomEvent = function () {}; sb.dispatchEvent = () => true;
  vm.createContext(sb);
  vm.runInContext(prof, sb, { filename: 'profile.js' });
  if (typeof sb.orviaConfirm === 'function') {
    let yes = 0, no = 0;
    sb.orviaConfirm({ title: 'Test', text: 'Sicher?', okLabel: 'Ja', onOk: () => { yes++; } });
    const okBtn = els['ovc-ok'];
    ok('P1A-4d Modal erzeugt Bestätigen-Button', !!okBtn && typeof okBtn.onclick === 'function');
    if (okBtn && okBtn.onclick) okBtn.onclick();
    ok('P1A-4e Bestätigen ruft Callback genau einmal', yes === 1);
    sb.orviaConfirm({ title: 'Test2', text: 'Sicher?', okLabel: 'Ja', onOk: () => { no++; } });
    const cancel = els['ovc-cancel'];
    if (cancel && cancel.onclick) cancel.onclick();
    ok('P1A-4f Abbrechen ruft Callback NICHT', no === 0);
  } else {
    ok('P1A-4d Modal erzeugt Bestätigen-Button', false, 'orviaConfirm fehlt (RED)');
    ok('P1A-4e Bestätigen ruft Callback genau einmal', false, 'orviaConfirm fehlt (RED)');
    ok('P1A-4f Abbrechen ruft Callback NICHT', false, 'orviaConfirm fehlt (RED)');
  }
}
/* ---------- 5) de-DE-Zahlenformat ---------- */
{
  ok('P1A-5 activity.js: keine dist.toFixed-Ausgaben mehr', !/dist\.toFixed\(/.test(act) && !/\(s\.dist \/ \(s\.dur \/ 60\)\)\.toFixed/.test(act));
  ok('P1A-5b ui.js Story/Wochen/PB nutzen fmtDe', !/L\.dist\.toFixed\(2\)/.test(ui) && !/act\.toFixed\(1\)/.test(ui) && !/estDist\.toFixed\(1\)/.test(ui));
  ok('P1A-5c fmtDe wird in activity.js verwendet', /fmtDe\(/.test(act));
}
/* ---------- 6) Slogans ---------- */
{
  ok('P1A-6 MOTIV-Array entfernt', !/const MOTIV\s*=/.test(ui) && ui.indexOf('Know your state. Move with precision.') < 0);
  ok('P1A-6b renderMotivation entfernt (Definition + Aufruf)', !/renderMotivation/.test(ui));
  ok('P1A-6c Container #motivation entfernt', idx.indexOf('id="motivation"') < 0);
}
/* ---------- 7) Verlauf-Copy ---------- */
{
  ok('P1A-7 keine „Tippen zum Bearbeiten"-Zusage mehr', idx.indexOf('Tippen zum Bearbeiten') < 0);
  ok('P1A-7b ehrliche Copy vorhanden', idx.indexOf('Tippen für Details') >= 0);
}
/* ---------- 8) Heute leicht beruhigt ---------- */
{
  ok('P1A-8 Quick-Actions-Legacy-Karte entfernt (Container + Renderer-Aufruf)', idx.indexOf('id="quickActions"') < 0 && !/renderQuickActions\(\)/.test(ui));
  ok('P1A-8b Zwischen-Check-in einklappbar (details/acc-Muster)', /<details/.test(xtra) && /acc/.test(xtra));
  ok('P1A-8c Aufklapp-Zustand bleibt über Re-Render erhalten', /_extraOpen|xcOpen/.test(xtra));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
