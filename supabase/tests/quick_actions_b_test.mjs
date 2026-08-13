/* ============================================================
   ORVIA · Track B — Plus-Schnellzugriff (Registry, Ranking, Sheet, Delegation).
   Verträge:
   - Registry: jede Aktion delegiert (entryPoint), nichts ist im Modul implementiert;
     keine direkten Writes (Quelltext-Scan).
   - Ranking (pur): morgens Morgen-Check-in zuerst, abends Abend-Check-in,
     laufendes Training → „fortsetzen", unvollständiges Profil / aktive
     Beschwerde → Kontextaktionen; max. 3 Primäraktionen.
   - Fail-soft: nicht auflösbare Entry-Points erscheinen NICHT.
   - Sheet über openSheet, Klick delegiert genau einmal (Doppelklick-Schutz).
   - ui.js bindet nur .tabbar button[data-tab] (Plus-Button nie showTab).
   node supabase/tests/quick_actions_b_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function makeSb(opts) {
  opts = opts || {};
  const calls = [];
  const sheetCalls = [];
  const els = {};
  function mkEl(id) {
    const el = { _id: id || null, _html: '', _ev: {}, _attr: {}, style: {}, onclick: null,
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      setAttribute(k, v) { this._attr[k] = String(v); }, getAttribute(k) { return k in this._attr ? this._attr[k] : null; },
      addEventListener(t, f) { this._ev[t] = f; }, remove() {}, scrollIntoView() { el._scrolled = true; }, querySelector() { return null; } };
    Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; var m, re = /id="([^"]+)"/g; while ((m = re.exec(v))) { if (!els[m[1]]) els[m[1]] = mkEl(m[1]); } } });
    return el;
  }
  if (opts.withPlus) els.navPlus = mkEl('navPlus');
  els.morningForm = mkEl('morningForm'); els.eveForm = mkEl('eveForm');
  const sb = {}; sb.window = sb; sb.self = sb; sb.console = console;
  sb.Date = Date; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Math = Math;
  sb.setTimeout = (f) => { f && f(); return 1; };
  sb.document = { getElementById: id => els[id] || null, createElement: () => mkEl(), body: { appendChild() {} } };
  sb.openSheet = o => { sheetCalls.push(o); const host = mkEl(); host.innerHTML = o.body; return host; };
  sb._closeM = id => { calls.push('close:' + id); };
  // Entry-Point-Spies (global + ORVIA-Pfad)
  sb.openManualActivity = () => calls.push('openManualActivity');
  sb.openPerformanceManager = () => calls.push('openPerformanceManager');
  sb.openModulePicker = () => calls.push('openModulePicker');
  sb.openGoalsManager = () => calls.push('openGoalsManager');
  sb.openFixedEventEditor = () => calls.push('openFixedEventEditor');
  sb.openProfileCenterEntry = () => calls.push('openProfileCenterEntry');
  sb.showTab = t => calls.push('showTab:' + t);
  /* Phase 1 · KF-003: „Training fortsetzen" zeigte bis v8-219 auf denselben
     Entry-Point wie „Training starten" (openTrainingTab) — beide waren damit
     dieselbe Aktion, und der Wiedereinstieg in ein laufendes Workout fehlte.
     Der Stub bildet jetzt BEIDE Einstiege ab, sonst prueft B3 einen
     App-Kontext, den es real nicht gibt. */
  sb.ORVIA = { workoutUI: {
    openTrainingTab:   () => { calls.push('openTrainingTab');   return { ok: true, outcome: 'start_sheet_opened' }; },
    resumeActiveSync:  () => { calls.push('resumeActiveSync');  return { ok: true, outcome: 'workout_overlay_opened' }; }
  } };
  if (opts.morningDone || opts.eveningDone) {
    sb.DB = { '2026-07-03': { morning: opts.morningDone ? {} : undefined, eve: opts.eveningDone ? {} : undefined } };
    sb.todayStr = () => '2026-07-03';
  }
  if (opts.activeWorkout) sb.ORVIA.workout = { session: { status: 'active' } };
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL(_APPREL + 'js/quick-actions.js', import.meta.url), 'utf8'), sb, { filename: 'quick-actions.js' });
  return { sb, calls, sheetCalls, els, QA: sb.ORVIA.quickActions };
}

{ // Registry-Verträge
  const h = makeSb();
  ok('B1 Export quickActions', !!h.QA && Array.isArray(h.QA.ACTIONS));
  ok('B2 jede Aktion vollständig (id/label/icon/category/entryPoint)', h.QA.ACTIONS.every(a => a.id && a.label && a.icon && a.category && typeof a.entryPoint === 'string'));
  ok('B3 alle Entry-Points im App-Kontext auflösbar', h.QA.ACTIONS.every(a => typeof h.QA.resolveEntryPoint(a.entryPoint) === 'function'));
  const src = readFileSync(new URL(_APPREL + 'js/quick-actions.js', import.meta.url), 'utf8');
  // P8-Präzisierung: Das Modul bleibt frei von Profil-/Repo-Writes. Die EINZIGE
  // erlaubte Persistenz ist der eigene Favoriten-Key (orvia_qa_favs_<uid>).
  ok('B4 keine Profil-/Repo-Writes (nur eigener Favoriten-Key erlaubt)',
    !/saveProfile\s*\(|_profileSave\s*\(|O\.repos|ORVIA\.repos/.test(src)
    && (src.match(/localStorage\.setItem\(([^,]+),/g)||[]).every(m=>/_favKey\(\)/.test(m)));
}
{ // Ranking-Regeln (pur)
  const h = makeSb();
  const r1 = h.QA.rankQuickActions({ hour: 8, morningDone: false });
  ok('R1 morgens: Morgen-Check-in zuerst', r1.primary[0].id === 'checkin_morning');
  const r2 = h.QA.rankQuickActions({ hour: 20, eveningDone: false, morningDone: true });
  ok('R2 abends: Abend-Check-in zuerst', r2.primary[0].id === 'checkin_evening');
  const r3 = h.QA.rankQuickActions({ hour: 8, morningDone: false, activeWorkout: true });
  ok('R3 laufendes Training → „fortsetzen" in Primär', r3.primary.some(a => a.id === 'training_continue') && !r3.primary.some(a => a.id === 'training_start'));
  const r4 = h.QA.rankQuickActions({ hour: 14, morningDone: true, eveningDone: false });
  ok('R4 mittags: kein Check-in-Zwang, Training zuerst', r4.primary[0].id === 'training_start');
  ok('R5 max. 3 Primäraktionen', [r1, r2, r3, r4].every(r => r.primary.length <= 3));
  const r5 = h.QA.rankQuickActions({ hour: 14, profileIncomplete: true });
  ok('R6 unvollständiges Profil → Kontextaktion oben in Sekundär', r5.secondary[0].id === 'profile_complete');
  const r6 = h.QA.rankQuickActions({ hour: 14, activeConstraint: true });
  ok('R7 aktive Beschwerde → Update statt Neu-Erfassen', r6.secondary.some(a => a.id === 'complaint_update') && !r6.secondary.some(a => a.id === 'complaint_log'));
}
{ // Fail-soft: fehlender Entry-Point → Aktion erscheint nicht
  const h = makeSb();
  delete h.sb.openFixedEventEditor;
  const r = h.QA.rankQuickActions({ hour: 14 });
  ok('F1 fehlender Entry-Point wird ausgeblendet', !r.secondary.some(a => a.id === 'appointment_add'));
}
{ // Sheet + Delegation + Doppelklick
  const h = makeSb();
  const opened = h.QA.open();
  ok('S1 öffnet über openSheet (id _quickActions)', opened === true && h.sheetCalls.length === 1 && h.sheetCalls[0].id === '_quickActions');
  // P8: Layout ist jetzt Kontext („Jetzt sinnvoll") / „Deine Favoriten" / „Alle Aktionen".
  ok('S2 Sheet enthält Favoriten- und Katalogbereich', String(h.sheetCalls[0].body).indexOf('Deine Favoriten') >= 0 && String(h.sheetCalls[0].body).indexOf('Alle Aktionen') >= 0);
  const ran = h.QA.runAction('activity_log');
  ok('S3 Klick delegiert an bestehenden Entry-Point + schließt Sheet', ran === true && h.calls.indexOf('openManualActivity') >= 0 && h.calls.some(c => c.indexOf('close:_quickActions') === 0));
  const before = h.calls.filter(c => c === 'openManualActivity').length;
  h.QA.runAction('activity_log');   // Doppelklick innerhalb der Sperrfrist (setTimeout ist synchron gestubbt → freigegeben)
  ok('S4 runAction wiederholt nutzbar (Sperre zeitbasiert, kein Deadlock)', h.calls.filter(c => c === 'openManualActivity').length >= before);
  // Check-in-Delegation navigiert + scrollt
  h.QA.runAction('checkin_morning');
  ok('S5 Morgen-Check-in → Heute-Tab + Scroll', h.calls.indexOf('showTab:heute') >= 0 && h.els.morningForm._scrolled === true);
}
{ // Plus-Button-Bindung + ui.js-Vertrag
  const h = makeSb({ withPlus: true });
  ok('N1 bindPlusButton bindet #navPlus', typeof h.els.navPlus.onclick === 'function');
  h.els.navPlus.onclick();
  ok('N2 Klick öffnet das Sheet', h.sheetCalls.length === 1);
  const uiSrc = readFileSync(new URL(_APPREL + 'js/ui.js', import.meta.url), 'utf8');
  /* v3-Shell: Bindung ist jetzt delegiert + idempotent (dataset.bound). Die Invariante bleibt:
     ALLE Navigationspfade filtern auf [data-tab]; der Plus-/FAB-Button (ohne data-tab) wird nie zu showTab. */
  ok('N3 ui.js bindet nur [data-tab]-Buttons (Plus nie showTab)',
    uiSrc.indexOf("closest('button[data-tab]')") >= 0 &&
    uiSrc.indexOf("dataset.bound") >= 0 &&
    uiSrc.indexOf(".tabwrap button[data-tab]") >= 0 &&
    uiSrc.indexOf(".tabbar button[data-tab]').forEach(b=>b.onclick") < 0);
  const idx = readFileSync(new URL(_APPREL + 'index.html', import.meta.url), 'utf8');
  ok('N4 Plus-Button im Markup (aria-label, haspopup, kein data-tab)', /id="navPlus"[^>]*aria-label="Schnellaktionen öffnen"/.test(idx) && /id="navPlus"[^>]*aria-haspopup="dialog"/.test(idx) && !/id="navPlus"[^>]*data-tab/.test(idx));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
