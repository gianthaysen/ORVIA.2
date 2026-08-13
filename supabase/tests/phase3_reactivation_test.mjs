/* ORVIA · Phase 3 Block 1 (2026-08-05) — kontextuelle Reaktivierung der
   versteckten Funktionen, nach Aktivierungsmatrix (docs/PHASE3-AKTIVIERUNGSMATRIX.md)
   und den Produktentscheidungen E-21…E-25.

   Kernvertraege:
     • Rollback: Flag aus ⇒ Feature unsichtbar, DATEN BLEIBEN.
     • E-21: der MANUELLE Pre-/Post-Check-in bleibt AUS (Negativkontrolle) —
       stattdessen Garmin-Vor-Start-Werte im Start-Sheet, fehlend ⇒ „—".
     • E-22: Routinen nutzerkonfigurierbar; leere Auswahl ist gueltig; das
       Ein-Nutzer-Feld (Spanish Squats) nur bei aktiver Routine.
     • E-24: Abend-Check-in kontextuell ab 17 Uhr.
     • E-25: Tip-Engine fuellt nur FREIE Analyse-Slots und traegt Konfidenz.

   node supabase/tests/phase3_reactivation_test.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = (function () {
  /* Playwright ist eine ENTWICKLUNGSVORAUSSETZUNG, kein App-Bestandteil.
     Aufgeloest wird wie bei supabase-js in den Live-Tests: erst normal, dann
     ueber die bekannten node_modules-Nachbarn (Repo-Stamm, app, _dev). Fehlt
     es wirklich (z. B. in einer Umgebung ohne Browser), ist das ein
     UEBERSPRUNGEN (exit 2) — nie ein Crash, der wie ein Produktfehler
     aussieht, und nie ein stilles Gruen. Bewusst OHNE HERE/join: dieser Block
     laeuft vor deren Definition. */
  const _p = require('node:path');
  const _h = _p.dirname(new (globalThis.URL || require('node:url').URL)(import.meta.url).pathname);
  const _cands = [null, _p.join(_h, '..', '..'), _p.join(_h, '..', '..', 'app'),
    _p.join(_h, '..', '..', '_dev'), _p.join(_h, '..', '..', '..')];
  for (const c of _cands) {
    try { return require(c ? _p.join(c, 'node_modules', 'playwright') : 'playwright'); }
    catch (_e) { }
  }
  console.log('⏭️  ÜBERSPRUNGEN — playwright ist in dieser Umgebung nicht installiert (npm install im Repo-Stamm holt es nach)');
  process.exit(2);
})();
const HERE = dirname(fileURLToPath(import.meta.url));
/* Zwei Checkout-Layouts: Cloud (App unter ../../) und Geraet (App unter ../../../app). */
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const CHROME = (await import('./_pw-chrome.mjs')).chromeOrSkip(chromium); /* v8-307b: Binary-Existenz ist Teil der Skip-Bedingung */

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const R = f => readFileSync(join(APP, f), 'utf8');

/* ============ Quelltext ============ */
const ui = R('js/ui.js'), css = R('styles.css'), html = R('index.html'), sw = R('sw.js'), nut = R('js/nutrition.js');
ok('Flags + Rollback vorhanden', /function gmFeatureFlag\(/.test(ui) && /orvia_flag_/.test(ui));
ok('Reaktivierung ueber .p3-live (Grundzustand bleibt versteckt = Rollback-Pfad)',
   /#nutritionBox\.p3-live,#eveCard\.p3-live\{display:block\}/.test(css.replace(/\s+/g, '')) || /p3-live\{display:block/.test(css));
ok('E-21 · #extraCheckin bleibt ausgeblendet (kein manueller Pre-/Post-Check-in)',
   /#nutritionBox,#extraCheckin,#routinesCard,#eveCard\{display:none\}/.test(css) && !/#extraCheckin\.p3-live/.test(css));
ok('E-21 · Garmin-Vor-Start-Werte im Start-Sheet', /Vor-Start-Werte \(gemessen\)/.test(ui) && /preWorkoutGarmin/.test(ui));
ok('E-22 · Routinen aus PROFILE.routinesCustom, Editor vorhanden',
   /PROFILE\.routinesCustom/.test(ui) && /function gmOpenRoutinesEditor\(/.test(ui) && /GM_ROUTINE_PRESETS/.test(ui));
ok('E-22 · Spanish-Squats-Feld nur bei aktiver Routine (Ein-Nutzer-Hardcode entschaerft)',
   /ssRepsField/.test(ui) && /id="ssRepsField"/.test(html));
ok('E-24 · Abend-Check-in kontextuell ab 17 Uhr', /function gmEveVisible\(/.test(ui) && /hour>=17/.test(ui));
ok('E-23 · Ernaehrung: Konfiguration direkt aus der Karte', /openNutritionEditor\(\)/.test(nut) && /Jetzt einrichten/.test(nut));
ok('E-25 · Tip-Engine speist die Analyse-Slots mit Konfidenz, nur freie Slots',
   /gmFeatureFlag\('anaTips'\)\)&&slots\.length<3/.test(ui) && /Konfidenz: /.test(ui));
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version erhoeht (>= 227, Block 2), genau einmal', swv != null && Number(swv) >= 227 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

/* ============ Quelltext · Block 2 (E-26 / Aktivierungsmatrix) ============ */
const pro = R('js/orvia-pro.js'), prof = R('js/profile.js');
ok('B2 · alle Block-2-Flags im Default-Satz (sonst per Default AUS)',
   /weekReview:1/.test(ui) && /recoveryIntel:1/.test(ui) && /equipment:1/.test(ui) && /cycle:1/.test(ui) && /baselines:1/.test(ui));
ok('B2 · Wochenreview: EINE Quelle — weeklyReviewHTML() extrahiert, renderWeekly nur Wrapper',
   /function weeklyReviewHTML\(\)/.test(pro) && /el\.innerHTML=weeklyReviewHTML\(\)/.test(pro));
ok('B2 · Wochenreview-Sheet am Plan (gmOpenWeekReviewSheet) + Coach-Briefing = bestehendes copyAIReview',
   /function gmOpenWeekReviewSheet\(/.test(ui) && /gmOpenWeekReviewSheet\(\)">Wochenreview/.test(ui) && /copyAIReview/.test(ui));
ok('B2 · Wochenreview-Einstieg haengt am Flag weekReview',
   /gmFeatureFlag\('weekReview'\)/.test(ui));
ok('B2 · Risiko/Regeneration: Slot recovery-risk in der Analyse, Produzenten riskCard/recoveryDebt',
   /data-gm-slot="recovery-risk"/.test(ui) && /riskCard===/.test(ui) && /recoveryDebt===/.test(ui) && /gmFeatureFlag\('recoveryIntel'\)/.test(ui));
ok('B2 · Risiko/Regeneration: < 4 Datentage ⇒ ehrlicher Leerzustand + sichtbare Datenbasis',
   /_dd3<4/.test(ui) && /Datenbasis '\+_dd3\+' Tage/.test(ui));
ok('B2 · Equipment: EINE Quelle — equipmentHTML() extrahiert, renderEquipment zieht das Sheet mit',
   /function equipmentHTML\(\)/.test(prof) && /el\.innerHTML=equipmentHTML\(\)/.test(prof) && /gmRefreshEquipmentSheet/.test(prof));
ok('B2 · Equipment-Sheet-Einstieg im Profil (Geraete & Daten), Flag equipment',
   /function gmOpenEquipmentSheet\(/.test(ui) && /gmEquipSheetBody/.test(ui) && /gmFeatureFlag\('equipment'\)/.test(ui));
ok('B2 · Zyklus-Zeile nur weibliches/konfiguriertes Profil, bestehender Editor, Flag cycle',
   /gmFeatureFlag\('cycle'\)/.test(ui) && /openCycleEditor&&openCycleEditor\(\)/.test(ui) && /PROFILE\.sex==='f'/.test(ui));
ok('B2 · Baselines read-only aus baselineRows(), Flag baselines, < 4 Tage ehrlich NA',
   /gmFeatureFlag\('baselines'\)/.test(ui) && /baselineRows==='function'/.test(ui) && /Baselines \(7\/28 Tage, read-only\)/.test(ui));

/* ============ LIVE ============ */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
               '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* gestubbt */' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1300);
await page.evaluate(() => {
  document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove());
  document.documentElement.classList.remove('orvia-gated');
});

/* --- E-22: Routinen generalisiert --- */
const rout = await page.evaluate(() => {
  const prev = PROFILE.routinesCustom;
  PROFILE.routinesCustom = [{ k: 'mob', label: 'Mobility' }, { k: 'cu_lesen', label: '10 min Lesen' }];
  renderRoutines(); gmApplyPhase3Visibility();
  const card = document.getElementById('routinesCard');
  const chips = document.getElementById('routineChips').innerHTML;
  /* 2026-08-05 (Nutzerentscheidung): Routinen laufen jetzt als Dashboard-MODUL. Die
     Formularkarte ist deshalb nicht mehr dauerhaft offen, sondern wird ueber das Modul
     geoeffnet (gmGotoRoutines). Der Test prueft die unveraenderte Zusage — konfigurierte
     Routinen sind erreichbar und vollstaendig — jetzt ueber diesen Weg. */
  const modHtml = (typeof gmModSupplements === 'function') ? gmModSupplements({}) : '';
  gmGotoRoutines();
  const custom = { visible: card.style.display !== 'none',
    modShowsStatus: /Routinen &amp;amp; Supplements|Routinen &amp; Supplements/.test(modHtml) && /gmGotoRoutines/.test(modHtml),
    hasCustom: /10 min Lesen/.test(chips), hasEditor: /gmOpenRoutinesEditor/.test(chips),
    ssHidden: document.getElementById('ssRepsField').style.display === 'none' };
  card.classList.remove('gm-co-open');
  PROFILE.routinesCustom = [];
  renderRoutines(); gmApplyPhase3Visibility();
  /* Leere Auswahl: KEINE Routine-Chips mehr (nur der Editor-Einstieg bleibt) —
     die Karte selbst darf fuer offene Supplement-Empfehlungen sichtbar bleiben,
     das ist ihr zweiter Inhalt („Routinen & Supplements"). */
  const emptyChips = document.getElementById('routineChips').innerHTML;
  const empty = { noRoutineChips: !/toggleRoutine\(/.test(emptyChips), editorKept: /gmOpenRoutinesEditor/.test(emptyChips) };
  PROFILE.routinesCustom = [{ k: 'ss', label: 'Spanish Squats (Knie)' }];
  renderRoutines();
  const ss = { shown: document.getElementById('ssRepsField').style.display !== 'none' };
  PROFILE.routinesCustom = prev;
  renderRoutines(); gmApplyPhase3Visibility();
  return { custom, empty, ss };
});
ok('LIVE E-22 · konfigurierte Routinen sind ueber das Modul erreichbar, inkl. eigener Routine + Editor',
   rout.custom.visible && rout.custom.hasCustom && rout.custom.hasEditor, JSON.stringify(rout.custom));
ok('LIVE E-22 · das Modul traegt den Tagesstatus und fuehrt in dasselbe Formular (kein zweiter Speicher)',
   rout.custom.modShowsStatus, JSON.stringify(rout.custom.modShowsStatus));
ok('LIVE E-22 · Ein-Nutzer-Feld verborgen, wenn Routine nicht gewaehlt', rout.custom.ssHidden);
ok('LIVE E-22 · leere Auswahl ist gueltig ⇒ keine Routine-Chips, Editor bleibt erreichbar',
   rout.empty.noRoutineChips && rout.empty.editorKept, JSON.stringify(rout.empty));
ok('LIVE E-22 · Spanish-Squats-Feld NUR bei aktiver Routine', rout.ss.shown);

/* --- Rollback-Vertrag: Flag aus ⇒ unsichtbar, Daten bleiben --- */
const rb = await page.evaluate(() => {
  const prev = PROFILE.routinesCustom;
  PROFILE.routinesCustom = [{ k: 'mob', label: 'Mobility' }];
  const e = entry(todayStr()); e.routines = e.routines || {}; e.routines.mob = 1; save();
  gmSetFeatureFlag('routines', false);
  renderRoutines(); gmApplyPhase3Visibility();
  const off = { live: document.getElementById('routinesCard').classList.contains('p3-live'),
    dataKept: entry(todayStr()).routines.mob === 1 };
  gmSetFeatureFlag('routines', true);
  renderRoutines(); gmApplyPhase3Visibility();
  const on = { live: document.getElementById('routinesCard').classList.contains('p3-live') };
  PROFILE.routinesCustom = prev; renderRoutines(); gmApplyPhase3Visibility();
  return { off, on };
});
ok('LIVE Rollback · Flag aus ⇒ Karte unsichtbar, erfasste Haken BLEIBEN', !rb.off.live && rb.off.dataKept);
ok('LIVE Rollback · Flag an ⇒ Karte wieder da', rb.on.live);

/* --- E-24: Abend-Check-in Zeitfenster --- */
const eve = await page.evaluate(() => ({
  morning: gmEveVisible(9, entry(todayStr())),
  evening: gmEveVisible(18, entry(todayStr())),
  withData: (() => { const e = { eve: { feel: 6, ts: 1 } }; return gmEveVisible(9, e); })()
}));
ok('LIVE E-24 · vormittags aus, ab 17 Uhr an, mit Tagesdaten immer an',
   eve.morning === false && eve.evening === true && eve.withData === true, JSON.stringify(eve));
const eveHead = await page.evaluate(() => { renderEve(); return document.getElementById('eveForm').innerHTML; });
ok('LIVE E-24 · Statuskopf (Tagesabschluss / erledigt) vorhanden', /Tagesabschluss|erledigt/.test(eveHead));

/* --- E-23: Ernaehrungskarte --- */
const nutr = await page.evaluate(() => {
  gmApplyPhase3Visibility();
  const box = document.getElementById('nutritionBox');
  renderNutritionToday();
  /* 2026-08-05 (Nutzerentscheidung): Ernaehrung laeuft jetzt als Dashboard-MODUL im
     GM-Stil. Der Legacy-Host bleibt als Rueckfall bestehen (falls der Nutzer das Modul
     ausblendet), rendert aber nichts mehr, solange das Modul aktiv ist — sonst stuende
     die Karte doppelt. Geprueft wird deshalb: genau EINE der beiden Darstellungen
     traegt den Inhalt, und der ehrliche Einstieg ohne Konfiguration bleibt erhalten. */
  const modOn = (typeof gmModOn === 'function') && gmModOn('nutrition');
  const mod = (typeof gmModNutrition === 'function') ? gmModNutrition({}) : '';
  return { live: box.classList.contains('p3-live'), html: box.innerHTML, modOn: modOn, mod: mod,
    hostEmptyWhileModOn: modOn ? box.innerHTML === '' : true };
});
ok('LIVE E-23 · Ernährung aktiv; ohne Konfiguration ehrlicher Einstieg statt Sackgasse',
   /Jetzt einrichten|nut-kcal|nu-hero|Körperdaten fehlen/.test(nutr.modOn ? nutr.mod : nutr.html),
   'modul=' + nutr.modOn);
ok('LIVE E-23 · kein Doppelinhalt: bei aktivem Modul rendert der Legacy-Host nichts',
   nutr.hostEmptyWhileModOn, 'hostLeer=' + nutr.hostEmptyWhileModOn);

/* --- E-25: Tip-Engine in den Analyse-Slots --- */
const tips = await page.evaluate(() => {
  const e = entry(todayStr());
  const prevM = e.morning;
  e.morning = { feel: 3, sleepQ: 3, sleepH: 5.2, energy: 3, knee: 4 };   /* echte Eingaben ⇒ Regeln feuern */
  save();
  const h = gmAnaOverview((typeof gmAnaCtx === 'function') ? gmAnaCtx() : {});
  e.morning = prevM; save();
  return { hasTip: /Tip-Engine/.test(h), hasConf: /Konfidenz: /.test(h) };
});
ok('LIVE E-25 · Tip-Engine-Hinweise erscheinen in freien Analyse-Slots mit Konfidenz',
   tips.hasTip && tips.hasConf, JSON.stringify(tips));

/* --- E-21: Vor-Start-Werte, gemessen oder ehrlich „—" --- */
const pre = await page.evaluate(() => {
  window._metricsResolved = { date: todayStr(), resolved: {
    body_battery: { value: 71, metricDate: todayStr() }, stress_avg: { value: 28, metricDate: todayStr() } }, entries: [] };
  gmOpenStartSheet('free'); gmStartSport('Laufen');
  const withVals = document.getElementById('detailSheet').innerHTML;
  window._metricsResolved = { date: todayStr(), resolved: {}, entries: [] };
  gmStartSport('Laufen');
  const withoutVals = document.getElementById('detailSheet').innerHTML;
  try { gmCloseSheets(); } catch (e) {}
  return { withVals, withoutVals };
});
ok('LIVE E-21 · Start-Sheet zeigt gemessene Body Battery + Stress',
   /Vor-Start-Werte \(gemessen\)/.test(pre.withVals) && /Body Battery/.test(pre.withVals) && />71</.test(pre.withVals) && />28</.test(pre.withVals));
ok('LIVE E-21 · fehlende Messwerte ⇒ ehrlich „—", nichts erfunden',
   /Body Battery/.test(pre.withoutVals) && /<b>—<\/b>/.test(pre.withoutVals));
ok('NEGATIVKONTROLLE E-21 · manueller Pre-/Post-Check-in bleibt unsichtbar',
   await page.evaluate(() => { const x = document.getElementById('extraCheckin');
     return !x || getComputedStyle(x).display === 'none'; }));

/* --- Block 2 · Wochenreview-Sheet (EINE Berechnung, GM-Sheet + Legacy) --- */
const wr = await page.evaluate(() => {
  const r = {};
  gmOpenPlanSettingsSheet();
  r.entryOn = /Wochenreview/.test(document.getElementById('detailSheet').innerHTML);
  gmSetFeatureFlag('weekReview', false);
  gmOpenPlanSettingsSheet();
  r.entryOff = /Wochenreview/.test(document.getElementById('detailSheet').innerHTML);
  gmSetFeatureFlag('weekReview', true);
  gmOpenWeekReviewSheet();
  const h = document.getElementById('detailSheet').innerHTML;
  r.sheet = /Wochenreview/.test(h) && /Coach Briefing kopieren/.test(h);
  /* Inhalt kommt aus weeklyReviewHTML: entweder Datenzeilen ODER der ehrliche Leerzustand. */
  r.canonical = /blrow/.test(h) || /Wochen-Review erscheint nach einigen Check-ins/.test(h);
  r.sameSource = (typeof weeklyReviewHTML === 'function');
  try { gmCloseSheets(); } catch (e) {}
  return r;
});
ok('LIVE B2 · Plan-⚙ zeigt Wochenreview-Einstieg; Flag aus ⇒ Einstieg weg (Rollback)',
   wr.entryOn && !wr.entryOff, JSON.stringify({ on: wr.entryOn, off: wr.entryOff }));
ok('LIVE B2 · Wochenreview-Sheet: kanonischer Inhalt + Coach-Briefing-Export',
   wr.sheet && wr.canonical && wr.sameSource, JSON.stringify(wr));

/* --- Block 2 · Belastungsrisiko + Regenerationsdefizit in der Analyse --- */
const rr = await page.evaluate(() => {
  const r = {};
  let h = '';
  try { h = gmAnaRecovery(); } catch (e) { r.err = String(e); h = ''; }
  r.slot = /data-gm-slot="recovery-risk"/.test(h);
  /* Frisches Testprofil ⇒ < 4 Datentage ⇒ ehrlicher Leerzustand (keine erfundenen Scores). */
  const dd = (typeof dataDays === 'function') ? dataDays() : 0;
  r.honest = dd >= 4 || (/belastbar ab ~7 Tagen/.test(h) && !/Empfehlung:/.test(h.split('recovery-risk')[1] || ''));
  gmSetFeatureFlag('recoveryIntel', false);
  let h2 = ''; try { h2 = gmAnaRecovery(); } catch (e) { h2 = ''; }
  r.rollback = !/data-gm-slot="recovery-risk"/.test(h2);
  gmSetFeatureFlag('recoveryIntel', true);
  return r;
});
ok('LIVE B2 · Analyse→Erholung traegt den recovery-risk-Slot', rr.slot, rr.err || '');
ok('LIVE B2 · < 4 Datentage ⇒ Leerzustand statt erfundener Risiko-Scores', rr.honest);
ok('LIVE B2 · Rollback: Flag recoveryIntel aus ⇒ Slot verschwindet', rr.rollback);

/* --- Block 2 · Equipment-Sheet (gleiche Quelle wie Legacy) --- */
const eq = await page.evaluate(() => {
  const r = {};
  gmOpenEquipmentSheet();
  const h = document.getElementById('detailSheet').innerHTML;
  r.sheet = /Equipment/.test(h) && /gmEquipSheetBody/.test(h);
  r.content = /Noch kein Equipment/.test(h) || /eq-km/.test(h);
  r.sameSource = (typeof equipmentHTML === 'function');
  /* renderEquipment zieht das offene Sheet mit (eine Quelle, zwei Darstellungen). */
  try { renderEquipment(); } catch (e) {}
  r.refreshed = /Noch kein Equipment|eq-km/.test(document.getElementById('gmEquipSheetBody').innerHTML);
  try { gmCloseSheets(); } catch (e) {}
  return r;
});
ok('LIVE B2 · Equipment-Sheet zeigt die identische Verschleiss-Quelle', eq.sheet && eq.content && eq.sameSource, JSON.stringify(eq));
ok('LIVE B2 · renderEquipment aktualisiert das offene Sheet mit (kein Doppelzustand)', eq.refreshed);

/* --- Block 2 · Zyklus + Baselines im Profil (Gesundheit) --- */
const hp = await page.evaluate(() => {
  const r = {};
  const prevSex = PROFILE.sex, prevCyc = PROFILE.cycle;
  PROFILE.sex = 'm'; PROFILE.cycle = null;
  r.cycleHiddenMale = !/>Zyklus</.test(gmProfHealth());
  PROFILE.sex = 'f';
  r.cycleShownFemale = />Zyklus</.test(gmProfHealth());
  const h = gmProfHealth();
  r.baselines = /Baselines \(7\/28 Tage, read-only\)/.test(h);
  const dd = (typeof dataDays === 'function') ? dataDays() : 0;
  r.baselinesHonest = dd >= 4 || /belastbar ab ~7 Tagen|—/.test(h);
  gmSetFeatureFlag('cycle', false); gmSetFeatureFlag('baselines', false);
  const h2 = gmProfHealth();
  r.rollback = !/>Zyklus</.test(h2) && !/Baselines \(7\/28 Tage/.test(h2);
  gmSetFeatureFlag('cycle', true); gmSetFeatureFlag('baselines', true);
  PROFILE.sex = prevSex; PROFILE.cycle = prevCyc;
  return r;
});
ok('LIVE B2 · Zyklus-Zeile nur bei weiblichem/konfiguriertem Profil',
   hp.cycleHiddenMale && hp.cycleShownFemale, JSON.stringify({ m: !hp.cycleHiddenMale, f: hp.cycleShownFemale }));
ok('LIVE B2 · Baselines-Abschnitt read-only, ohne Datenbasis ehrlich leer', hp.baselines && hp.baselinesHonest);
ok('LIVE B2 · Rollback: Flags cycle/baselines aus ⇒ beide Bereiche weg', hp.rollback);

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close(); server.close();
console.log('\nphase3_reactivation: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
