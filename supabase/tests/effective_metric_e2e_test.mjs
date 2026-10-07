/* ORVIA · effective_metric_e2e (v8-445) — Dauer korrigieren im ECHTEN Browser.

   Gians Befund 6.10.: Krafttraining 341 min, korrigiert auf 1 h 15 min — die Seite zeigt den neuen
   Wert, andere Bereiche den alten, nach dem Neuoeffnen steht ueberall wieder der alte. Dazu: das
   Eingabefeld lag unter der Bildschirmtastatur.

   Geprueft wird die echte App (index.html, alle Skripte), Handybreite 390 × 844:
     A  Ausgang und Dialog: Stunden / Minuten, urspruenglicher Wert, Knopf nennt den Wert, kein Autofokus
     B  Tastatur: Blatt, beide Felder und beide Knoepfe liegen im sichtbaren Ausschnitt
     C  Speichern: Seite, Liste, Highlights (Story), Wochensumme, Tagesblock — ueberall 1 h 15 min
     D  veralteter Serverstand, Abgleich und NEULADEN der Seite aendern daran nichts
     E  Aendern und Zuruecksetzen
   NICHT geprueft: Safari auf dem iPhone. Die Tastatur wird hier ueber visualViewport nachgestellt
   (ein Test-Chromium hat keine Bildschirmtastatur) — das prueft die Rechnung, nicht Safari selbst.

   node supabase/tests/effective_metric_e2e_test.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = (function () {
  /* Playwright ist eine ENTWICKLUNGSVORAUSSETZUNG, kein App-Bestandteil — fehlt es,
     ist das ein UEBERSPRUNGEN (exit 2), nie ein Crash und nie ein stilles Gruen. */
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
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const CHROME = (await import('./_pw-chrome.mjs')).chromeOrSkip(chromium);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const browser = await (await import('./_pw-chrome.mjs')).launchOrSkip(chromium, { executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
await ctx.route('**fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
await ctx.route('**api.maptiler.com/**', r => r.fulfill({ status: 403, body: 'no' }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
const boot = async () => {
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    document.documentElement.classList.remove('orvia-gated');
    var g = document.getElementById('ogErr'); while (g && g.parentElement && g.parentElement !== document.body) g = g.parentElement; if (g) g.style.display = 'none';
    var st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(st);
  });
};
await boot();

const SRC = 341 * 60, MAN = 75 * 60, ID = '7d2f1c3a-0b5e-4c6d-9a8f-1e2d3c4b5a69';
const ROW = `(d, sec, metrics) => ({ id: '${ID}', client_record_id: 'act:test:w1', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sess-w1', workout_session_id: 'sess-w1',
  started_at: d + 'T08:00:00.000Z', ended_at: d + 'T13:41:00.000Z', duration_seconds: sec, status: 'completed',
  summary: { exerciseCount: 2, workingSetCount: 6, totalVolumeKg: 3360, rpe: 6 }, metrics: metrics || {} })`;
await page.evaluate(([ROW, SRC]) => {
  const row = (0, eval)(ROW), d = todayStr();
  ORVIA.activityStore.mergeServerActivities([row(d, SRC, { exercises: [{ name: 'Bankdrücken', sets: [{ reps: 11, weight: 60 }, { reps: 10, weight: 60 }, { reps: 9, weight: 60 }] }, { name: 'Rudern', sets: [{ reps: 10, weight: 50 }, { reps: 10, weight: 50 }, { reps: 10, weight: 50 }] }] })]);
  /* Tagesblock: so spiegelt der Abschluss eines Live-Workouts die Einheit */
  const e = entry(d); e.sessions = e.sessions || {}; e.sessions.Gym = { dur: 341, rpe: 6, source: 'live', sportId: 'gym', workoutSessionId: 'sess-w1' }; e.sessions._ts = Date.now();
}, [ROW, SRC]);

const openPage = async () => { await page.evaluate(async id => { try { gmCloseSheets(); } catch (_) { } try { gmStoryClose(); } catch (_) { } showTab('akt'); await new Promise(r => setTimeout(r, 150)); gmOpenActivityPage(id); await new Promise(r => setTimeout(r, 500)); }, ID); };
const pageState = () => page.evaluate(() => { const pg = document.getElementById('gmActPage'); const kp = [].slice.call(pg.querySelectorAll('.detail-kpis > div')).map(d => d.innerText.replace(/\s+/g, ' ').trim());
  const note = pg.querySelector('.gm-dur-note'); return { on: pg.classList.contains('on'), kpis: kp, text: pg.innerText.replace(/\s+/g, ' '), note: note ? note.innerText.replace(/\s+/g, ' ').trim() : null, corr: !!(note && note.classList.contains('is-corr')), link: note && note.querySelector('a') ? note.querySelector('a').innerText.trim() : null }; });
const sheetState = () => page.evaluate(() => { const sh = document.getElementById('detailSheet'), q = id => document.getElementById(id); const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
  const h = q('gmDurH'), m = q('gmDurM'), save = q('gmDurSave'), err = q('gmDurErr'), cs = e => getComputedStyle(e);
  return { on: sh.classList.contains('on'), kb: sh.classList.contains('kb-up'), h: h && h.value, m: m && m.value, save: save && save.innerText.trim(), disabled: save && save.disabled, src: (sh.querySelector('.dur-src') || {}).innerText || null,
    reset: !!sh.querySelector('.dur-src a'), err: err && !err.hidden ? err.innerText.trim() : null, invalid: [h, m].map(e => e && e.getAttribute('aria-invalid')), describedby: h && h.getAttribute('aria-describedby'),
    active: document.activeElement && document.activeElement.id, font: h && parseFloat(cs(h).fontSize), mode: [h, m].map(e => e && e.getAttribute('inputmode')), labels: [].slice.call(sh.querySelectorAll('.dur-f span')).map(s => s.innerText.trim().toUpperCase()),
    title: (sh.querySelector('h3') || {}).innerText, rect: { sheet: r(sh), h: r(h), m: r(m), save: r(save), cancel: r(sh.querySelector('.sheet-cta .sec')) }, bottom: cs(sh).bottom, maxH: cs(sh).maxHeight, vh: innerHeight }; });
const OLD = /5 h 41|341 min|5:41 h/;
const TABS = ['akt', 'dash', 'plan', 'heute', 'hist'];

/* ══════════ A · Ausgang und Dialog ══════════ */
sec('A · Ausgang und Dialog');
await openPage();
let pg = await pageState();
ok('A1 Ausgang: die Seite zeigt 5 h 41 min und bietet „Dauer korrigieren" an', pg.on && pg.kpis.some(k => /5 h 41 min/.test(k)) && pg.link === 'Dauer korrigieren' && pg.corr === false, JSON.stringify([pg.kpis, pg.note]));
await page.click('#gmActPage .gm-dur-note a'); await page.waitForTimeout(250);
let sh = await sheetState();
ok('A2 Blatt offen: Stunden 5, Minuten 41 (zwei Felder mit Beschriftung)', sh.on && sh.h === '5' && sh.m === '41' && sh.labels.join('|') === 'STUNDEN|MINUTEN' && /Dauer korrigieren/.test(sh.title), JSON.stringify([sh.h, sh.m, sh.labels]));
ok('A3 urspruenglicher Wert steht da; ohne bisherige Korrektur kein „Zuruecksetzen"', /Ursprünglich: 5 h 41 min/.test(sh.src || '') && sh.reset === false, String(sh.src));
ok('A4 der Knopf nennt, was gespeichert wird', sh.save === '5 h 41 min speichern' && sh.disabled === false, String(sh.save));
ok('A5 kein Autofokus (erst lesen, dann tippen — die Tastatur springt nicht von selbst auf)', sh.active !== 'gmDurH' && sh.active !== 'gmDurM', String(sh.active));
ok('A6 Zifferntastatur und Schrift >= 16 px (sonst zoomt Mobile Safari beim Antippen hinein)', sh.mode.join('|') === 'numeric|numeric' && sh.font >= 16, JSON.stringify([sh.mode, sh.font]));

await page.fill('#gmDurH', '1'); await page.fill('#gmDurM', '15'); sh = await sheetState();
ok('A7 Eingabe 1 / 15: Knopf lautet „1 h 15 min speichern"', sh.save === '1 h 15 min speichern' && sh.disabled === false && sh.err === null, String(sh.save));
await page.fill('#gmDurH', '0'); await page.fill('#gmDurM', '0'); sh = await sheetState();
ok('A8 0 / 0: Knopf gesperrt, Fehlertext sichtbar und mit den Feldern verknuepft (aria-invalid, aria-describedby)', sh.disabled === true && /zwischen 1 min und 24 h/.test(sh.err || '') && sh.invalid.join('|') === 'true|true' && sh.describedby === 'gmDurErr', JSON.stringify([sh.disabled, sh.err, sh.invalid]));
await page.fill('#gmDurH', '0'); await page.fill('#gmDurM', '45'); sh = await sheetState();
ok('A9 0 / 45: „45 min speichern", Fehler wieder weg', sh.save === '45 min speichern' && sh.err === null && sh.invalid.every(v => v == null), JSON.stringify([sh.save, sh.invalid]));
await page.fill('#gmDurH', '1x'); await page.fill('#gmDurM', '15,5'); sh = await sheetState();
ok('A10 nur Ziffern: „1x" → 1, „15,5" → 15 (Feld nimmt hoechstens drei Zeichen, Nicht-Ziffern fallen weg); der Knopf nennt, was daraus wird', sh.h === '1' && sh.m === '15' && sh.save === '1 h 15 min speichern', JSON.stringify([sh.h, sh.m, sh.save]));
await page.fill('#gmDurH', '0'); await page.fill('#gmDurM', '155'); sh = await sheetState();
ok('A11 155 Minuten ohne Stunden: wird als 2 h 35 min benannt — keine stille Umdeutung', sh.save === '2 h 35 min speichern' && sh.disabled === false, String(sh.save));
await page.fill('#gmDurH', '1'); await page.fill('#gmDurM', '15');

/* ══════════ B · Tastatur ══════════ */
sec('B · Bildschirmtastatur');
const KB = 336, VVH = 844 - KB;
await page.evaluate(([vvh]) => { const vv = window.visualViewport; window.__vv = { h: vvh, top: 0 };
  Object.defineProperty(vv, 'height', { configurable: true, get: () => window.__vv.h }); Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => window.__vv.top }); }, [VVH]);
await page.focus('#gmDurM'); await page.evaluate(() => window.visualViewport.dispatchEvent(new Event('resize'))); await page.waitForTimeout(120);
sh = await sheetState();
const inView = (r, lo, hi) => !!r && r[1] >= lo - 1 && r[3] <= hi + 1;
ok('B1 Tastatur offen (sichtbar bleiben ' + VVH + ' px): das Blatt wird um die verdeckte Hoehe angehoben', sh.kb === true && sh.bottom === KB + 'px', JSON.stringify([sh.kb, sh.bottom]));
ok('B2 Blatt liegt vollstaendig im sichtbaren Ausschnitt', inView(sh.rect.sheet, 0, VVH), JSON.stringify(sh.rect.sheet));
ok('B3 beide Eingabefelder sind sichtbar', inView(sh.rect.h, 0, VVH) && inView(sh.rect.m, 0, VVH), JSON.stringify([sh.rect.h, sh.rect.m]));
ok('B4 „Abbrechen" und „… speichern" sind sichtbar — speichern geht, ohne die Tastatur zu schliessen', inView(sh.rect.save, 0, VVH) && inView(sh.rect.cancel, 0, VVH), JSON.stringify([sh.rect.save, sh.rect.cancel]));
/* Mobile Safari schiebt beim Fokus zusaetzlich den sichtbaren Ausschnitt nach unten (offsetTop > 0) */
await page.evaluate(() => { window.__vv.top = 120; window.visualViewport.dispatchEvent(new Event('scroll')); }); await page.waitForTimeout(80);
sh = await sheetState();
ok('B5 verschobener Ausschnitt (offsetTop 120): Blattunterkante = Unterkante des sichtbaren Ausschnitts', sh.bottom === (KB - 120) + 'px' && sh.rect.sheet[3] <= VVH + 120 + 1 && sh.rect.save[3] <= VVH + 120 + 1, JSON.stringify([sh.bottom, sh.rect.sheet, sh.rect.save]));
/* sehr niedriger Ausschnitt (Querformat / grosse Tastatur): Blatt wird begrenzt und rollt in sich */
await page.evaluate(() => { window.__vv.top = 0; window.__vv.h = 260; window.visualViewport.dispatchEvent(new Event('resize')); }); await page.waitForTimeout(80);
sh = await sheetState();
ok('B6 nur 260 px sichtbar: Blatt bleibt im Ausschnitt (begrenzte Hoehe), das Feld mit dem Fokus ist zu sehen', sh.rect.sheet[1] >= -1 && sh.rect.sheet[3] <= 261 && inView(sh.rect.m, 0, 260), JSON.stringify([sh.rect.sheet, sh.rect.m, sh.maxH]));
/* Tastatur zu */
await page.evaluate(() => { window.__vv.h = 844; window.__vv.top = 0; window.visualViewport.dispatchEvent(new Event('resize')); }); await page.waitForTimeout(80);
sh = await sheetState();
ok('B7 Tastatur zu: Blatt wieder unten verankert, nichts bleibt haengen', sh.kb === false && sh.bottom === '0px' && sh.rect.sheet[3] >= 843, JSON.stringify([sh.kb, sh.bottom, sh.rect.sheet]));
const other = await page.evaluate(() => { window.__vv.h = 508; const b = document.querySelector('#gmDurSave'); b.focus(); window.visualViewport.dispatchEvent(new Event('resize')); const sh = document.getElementById('detailSheet'); const r = sh.classList.contains('kb-up'); window.__vv.h = 844; window.visualViewport.dispatchEvent(new Event('resize')); return r; });
ok('B8 wirkt nur beim Tippen: Fokus auf einem Knopf hebt das Blatt nicht an', other === false);

/* ══════════ C · Speichern ══════════ */
sec('C · Speichern: ueberall 1 h 15 min');
await page.click('#gmDurSave'); await page.waitForTimeout(700);
pg = await pageState();
const store1 = await page.evaluate(id => { const a = ORVIA.activityStore.getActivityById(id), E = ORVIA.activityEffective; return { sec: a.durationSeconds, sync: a.syncStatus, res: E.resolveMetric(a, 'duration'), sheet: document.getElementById('detailSheet').classList.contains('on') }; }, ID);
ok('C1 Speicher: 75 min, Quelle 341 min, wartet auf den Abgleich; Blatt zu', store1.sec === MAN && store1.res.sourceValue === SRC && store1.res.corrected && store1.sync === 'pending' && store1.sheet === false, JSON.stringify(store1));
ok('C2 Seite: Kennzahl 1 h 15 min, kein 5 h 41 mehr in den Kennzahlen', pg.kpis.some(k => /1 h 15 min/.test(k)) && !pg.kpis.some(k => OLD.test(k)), JSON.stringify(pg.kpis));
ok('C3 Seite: „Dauer auf 1 h 15 min korrigiert · urspruenglich 5 h 41 min · Aendern"', pg.corr === true && /Dauer auf 1 h 15 min korrigiert/.test(pg.note) && /ursprünglich 5 h 41 min/.test(pg.note) && pg.link === 'Ändern', String(pg.note));
const mirror = await page.evaluate(() => DB[todayStr()].sessions.Gym.dur);
ok('C4 Tagesblock gespiegelt: 75 min', mirror === 75, String(mirror));

const surfaces = async () => page.evaluate(async ([id, tabs]) => { const out = {}; try { gmCloseSheets(); } catch (_) { } try { gmCloseActivityPage(); } catch (_) { }
  for (const t of tabs) { try { showTab(t); } catch (e) { out[t] = 'ERR ' + e.message; continue; } await new Promise(r => setTimeout(r, 350)); const el = document.getElementById('tab-' + t); out[t] = el ? el.innerText.replace(/\s+/g, ' ') : null; }
  const a = _resolveActivityAny(id); out.story = gmStoryPages(a).join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const tz = (ORVIA.profileStore && ORVIA.profileStore.effectiveTimezone) ? ORVIA.profileStore.effectiveTimezone() : 'UTC';
  const wk = ORVIA.activityConfig.weeklyActivityTotals(listActivitiesUnified(), DB, { weekRef: todayStr(), timezone: tz, isTombstoned: ORVIA.activityStore.isTombstoned });
  out.week = wk && wk.totals ? wk.totals.durationMin : null; out.unified = listActivitiesUnified().filter(x => x.id === id || x.clientRecordId === 'act:test:w1').map(x => x.durationSeconds);
  return out; }, [ID, TABS]);
const oldIn = sf => JSON.stringify(TABS.map(t => [t, sf[t] == null ? null : (/^ERR/.test(sf[t]) ? sf[t] : ((OLD.exec(sf[t]) || ['ok'])[0]))]));
let sf = await surfaces();
ok('C5 Liste der Aktivitaeten zeigt 1 h 15 min', /1 h 15 min/.test(sf.akt || '') && !OLD.test(sf.akt || ''), (sf.akt || '').slice(0, 220));
ok('C6 kein Bereich zeigt noch die alte Dauer (Aktivitaeten, Analyse, Plan, Heute, Verlauf)', TABS.every(t => typeof sf[t] === 'string' && !/^ERR/.test(sf[t]) && !OLD.test(sf[t])), oldIn(sf));
ok('C7 Highlights (Story) rechnen mit der wirksamen Dauer', /1 h 15 min|75 min/.test(sf.story) && !OLD.test(sf.story), sf.story.slice(0, 260));
ok('C8 Wochensumme: 75 min; vereinte Liste: genau eine Einheit mit 4500 s', sf.week === 75 && JSON.stringify(sf.unified) === '[4500]', JSON.stringify([sf.week, sf.unified]));

/* ══════════ D · Serverstand, Abgleich, Neuladen ══════════ */
sec('D · veralteter Serverstand, Abgleich, Neuladen');
await page.evaluate(([ROW, SRC]) => { const row = (0, eval)(ROW); _serverActivities = [ORVIA.activityConfig.normalizeServerActivity(row(todayStr(), SRC, {}))]; }, [ROW, SRC]);
sf = await surfaces();
ok('D1 Zwischenspeicher der Serverliste kennt die Korrektur noch nicht (341 min): Liste und Wochensumme bleiben bei 75 min', /1 h 15 min/.test(sf.akt || '') && !OLD.test(sf.akt || '') && sf.week === 75 && JSON.stringify(sf.unified) === '[4500]', JSON.stringify([sf.week, sf.unified]));
/* So antwortet der Server nach dem Senden: Dauer aus den Zeitstempeln (341 min), metrics mit der Korrektur */
const afterPull = await page.evaluate(([ROW, SRC, id]) => { const row = (0, eval)(ROW), S = ORVIA.activityStore; const a = S.getActivityById(id);
  S.markSynced(a.clientRecordId, id); const srv = row(todayStr(), SRC, JSON.parse(JSON.stringify(a.metrics)));
  _serverActivities = [ORVIA.activityConfig.normalizeServerActivity(srv)]; const r = S.mergeServerActivities([srv]); const b = S.getActivityById(id);
  return { r: r, sec: b.durationSeconds, sync: b.syncStatus, cache: _serverActivities[0].durationSeconds, raw: JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /^orvia_activities_/.test(k))))[0].durationSeconds }; }, [ROW, SRC, ID]);
ok('D2 Abgleich mit der Serverzeile (Spalte 341 min + Korrektur): Speicher bleibt bei 75 min — bis v8-444 stand hier wieder 341', afterPull.sec === MAN && afterPull.sync === 'synced' && afterPull.cache === MAN && afterPull.raw === MAN, JSON.stringify(afterPull));
await boot();
await page.evaluate(([ROW, SRC]) => { const row = (0, eval)(ROW), a = ORVIA.activityStore.listActivities()[0]; _serverActivities = [ORVIA.activityConfig.normalizeServerActivity(row(todayStr(), SRC, JSON.parse(JSON.stringify(a.metrics))))]; }, [ROW, SRC]);
sf = await surfaces();
ok('D3 nach dem NEULADEN der Seite: Liste 1 h 15 min, Wochensumme 75 min, nirgends die alte Dauer', /1 h 15 min/.test(sf.akt || '') && sf.week === 75 && TABS.every(t => !OLD.test(sf[t] || '')), JSON.stringify([sf.week, sf.unified]) + ' ' + oldIn(sf));
await openPage(); pg = await pageState();
ok('D4 nach dem Neuladen: Seite 1 h 15 min mit Hinweis auf den urspruenglichen Wert', pg.kpis.some(k => /1 h 15 min/.test(k)) && pg.corr === true && /ursprünglich 5 h 41 min/.test(pg.note), String(pg.note));

/* ══════════ E · Aendern und Zuruecksetzen ══════════ */
sec('E · Aendern und Zuruecksetzen');
await page.click('#gmActPage .gm-dur-note a'); await page.waitForTimeout(250); sh = await sheetState();
ok('E1 „Aendern" oeffnet das Blatt mit 1 / 15; urspruenglich weiter 5 h 41 min; „Zuruecksetzen" ist da', sh.h === '1' && sh.m === '15' && /Ursprünglich: 5 h 41 min/.test(sh.src || '') && sh.reset === true, JSON.stringify([sh.h, sh.m, sh.src]));
await page.fill('#gmDurM', '30'); await page.click('#gmDurSave'); await page.waitForTimeout(600);
const st2 = await page.evaluate(id => ORVIA.activityEffective.resolveMetric(ORVIA.activityStore.getActivityById(id), 'duration'), ID);
ok('E2 zweite Korrektur auf 1 h 30: Quelle bleibt 341 min (nicht 75)', st2.effectiveValue === 5400 && st2.sourceValue === SRC, JSON.stringify(st2));
await page.click('#gmActPage .gm-dur-note a'); await page.waitForTimeout(250);
await page.click('#detailSheet .dur-src a'); await page.waitForTimeout(700);
pg = await pageState();
const st3 = await page.evaluate(id => { const a = ORVIA.activityStore.getActivityById(id); return { sec: a.durationSeconds, res: ORVIA.activityEffective.resolveMetric(a, 'duration'), mirror: DB[todayStr()].sessions.Gym.dur, legacy: a.metrics.durationCorrection === undefined, sync: a.syncStatus }; }, ID);
ok('E3 Zuruecksetzen: wieder 341 min, nicht mehr korrigiert, wartet auf den Abgleich; Tagesblock 341', st3.sec === SRC && st3.res.corrected === false && st3.mirror === 341 && st3.legacy && st3.sync === 'pending', JSON.stringify(st3));
ok('E4 Seite zeigt wieder 5 h 41 min und bietet „Dauer korrigieren" an', pg.kpis.some(k => /5 h 41 min/.test(k)) && pg.corr === false && pg.link === 'Dauer korrigieren', JSON.stringify([pg.kpis, pg.note]));

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' effective_metric_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
