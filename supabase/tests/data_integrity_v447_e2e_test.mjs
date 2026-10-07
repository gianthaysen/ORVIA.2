/* ORVIA · data_integrity_v447_e2e — Kadenz, Uhrzeit, Sportarten in der ECHTEN App.

   Browser in der Zeitzone Europe/Berlin, Handybreite 390 × 844. Geprueft wird, was der Nutzer sieht:
     A  Uhrzeit und Datum: Sommer, Winter, nach Mitternacht, Ortszeit von Garmin, eingegebene Einheit, ORVIA-Workout
     B  Kadenz: 161 spm steht als 161 spm in Kennzahl, Kurve und Highlights; ein Altimport zeigt keinen Wert
     C  Rad: Trittfrequenz unveraendert
     D  Lauf-Seite zeigt Max. HF und Kalorien, wenn die Quelle sie liefert — und keine leere Kachel, wenn nicht
     E  Yoga ist Yoga (nicht „Sonstiges")
   NICHT geprueft: Safari auf dem iPhone; der Worker (eigene Tests in garmin-worker/tests).

   node supabase/tests/data_integrity_v447_e2e_test.mjs [appRoot-absolut] */
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block', timezoneId: 'Europe/Berlin', locale: 'de-DE' });
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


const ser = `(n, f) => { const a = []; for (let k = 0; k < n; k++) a.push(f(k)); return a; }`;
await page.evaluate(([SER]) => {
  const ser = (0, eval)(SER);
  const hr = ser(90, k => Math.round(150 + 8 * Math.sin(k / 7))), spd = ser(90, k => 2.9 + 0.2 * Math.sin(k / 5));
  const G = (id, sport, iso, extra) => Object.assign({ id: id, sport_id: sport, source: 'garmin', source_record_id: id, started_at: iso, duration_seconds: 2700, status: 'completed', summary: { distance_m: 8000, avgHr: 150 }, metrics: {} }, extra || {});
  window.__zone = (ORVIA.profileStore && ORVIA.profileStore.effectiveTimezone) ? ORVIA.profileStore.effectiveTimezone() : null;
  ORVIA.activityStore.mergeServerActivities([
    /* Zeit */
    G('7a000000-0000-4000-8000-000000000001', 'running', '2026-07-16T10:00:00.000Z'),
    G('7a000000-0000-4000-8000-000000000002', 'running', '2026-01-16T10:00:00.000Z'),
    G('7a000000-0000-4000-8000-000000000003', 'running', '2026-07-16T22:30:00.000Z'),
    G('7a000000-0000-4000-8000-000000000004', 'running', '2026-07-18T07:03:00.000Z', { metrics: { garmin: { type_key: 'running', start_local: '2026-07-18 08:03:00', utc_offset_s: 3600 } } }),
    { id: '7a000000-0000-4000-8000-000000000005', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sess-t5', workout_session_id: 'sess-t5', started_at: '2026-08-05T16:00:00.000Z', ended_at: '2026-08-05T17:00:00.000Z', duration_seconds: 3600, status: 'completed', summary: { exerciseCount: 1, workingSetCount: 3, totalVolumeKg: 1800 }, metrics: {} },
    /* Kadenz: neu (Details-Version 3) und Altimport */
    G('7a000000-0000-4000-8000-000000000011', 'running', '2026-09-10T16:00:00.000Z', { summary: { distance_m: 8000, avg_hr: 152, max_hr: 176, calories_kcal: 512 },
      metrics: { detailsVersion: 3, streams: { heart_rate: hr, speed: spd, cadence: ser(90, k => 161 + (k % 3) - 1) }, stream_units: { heart_rate: 'bpm', speed: 'mps', cadence: 'spm' },
        stream_meta: { cadence: { kind: 'running_cadence_spm', unit: 'spm', source: 'directDoubleCadence', garmin_unit: 'stepsPerMinute' } } } }),
    G('7a000000-0000-4000-8000-000000000012', 'running', '2026-09-08T16:00:00.000Z', { summary: { distance_m: 8000, avgHr: 152 },
      metrics: { detailsVersion: 2, streams: { heart_rate: hr, speed: spd, cadence: ser(90, k => 80 + (k % 3) - 1) }, stream_units: { heart_rate: 'bpm', speed: 'mps', cadence: 'spm' } } }),
    /* Rad: Altbestand mit rpm */
    G('7a000000-0000-4000-8000-000000000021', 'cycling', '2026-09-07T08:00:00.000Z', { summary: { distance_m: 30000, avgHr: 136, avgPower: 190 },
      metrics: { detailsVersion: 2, streams: { heart_rate: hr, speed: ser(90, k => 7.5), power: ser(90, k => 190 + k % 9), cadence: ser(90, k => 92 + (k % 3) - 1) }, stream_units: { cadence: 'rpm', power: 'W' } } }),
    /* Yoga: als „other" gespeichert, Rohtyp erhalten */
    { id: '7a000000-0000-4000-8000-000000000031', sport_id: 'other', source: 'orvia_workout', source_record_id: 'sess-y', workout_session_id: 'sess-y', started_at: '2026-09-06T17:00:00.000Z', duration_seconds: 2700, status: 'completed', summary: {}, metrics: { source_sport_raw: 'yoga' } }
  ]);
  /* eingegebene Einheit, 18:00 */
  ORVIA.activityStore.upsertManualActivity({ sportId: 'yoga', source: 'manual', sourceRecordId: 'manual:2026-10-05:yoga', startedAt: '2026-10-05T18:00:00', endedAt: null, durationSeconds: 3600, summary: {}, metrics: { time: '18:00' } });
}, [ser]);

const ID = n => '7a000000-0000-4000-8000-0000000000' + n;
const openPage = async id => page.evaluate(async id => { try { gmCloseSheets(); } catch (_) { } try { gmStoryClose(); } catch (_) { } showTab('akt'); await new Promise(r => setTimeout(r, 120)); gmOpenActivityPage(id); await new Promise(r => setTimeout(r, 450));
  const pg = document.getElementById('gmActPage'), T = e => e ? e.innerText.replace(/\s+/g, ' ').trim() : null;
  const kp = [].slice.call(pg.querySelectorAll('.detail-kpis > div')).map(d => T(d));
  const a = _resolveActivityAny(id), vm = activityDetailViewModel(a);
  return { on: pg.classList.contains('on'), head: T(pg.querySelector('.page-head')), kicker: T(pg.querySelector('.plan-kicker')), kpis: kp, charts: [].slice.call(pg.querySelectorAll('.oc2')).map(e => T(e.previousElementSibling)),
    cadNote: T(pg.querySelector('.gm-cad-note')), vmDate: vm.date, vmTime: vm.time, cad: vm.cadence ? { status: vm.cadence.status, kind: vm.cadence.kind, avg: vm.cadence.avg } : null,
    story: gmStoryPages(a).join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), sport: vm.sportId, label: vm.sportLabel }; }, id);
const manualId = await page.evaluate(() => { const a = ORVIA.activityStore.getActivityBySource('manual', 'manual:2026-10-05:yoga'); return a.clientRecordId; });

sec('A · Uhrzeit und Datum (Browser in Europe/Berlin)');
const zone = await page.evaluate(() => window.__zone);
ok('A0 Zeitzone des Nutzers kommt aus dem Profil bzw. vom Geraet — hier: ' + zone, typeof zone === 'string' && zone.length > 3);
let p = await openPage(ID('01'));
ok('A1 Sommer: Garmin 10:00 UTC wird als 12:00 gezeigt (bis v8-446: 10:00)', p.vmTime === '12:00' && p.vmDate === '2026-07-16' && /12:00/.test(p.head) && !/10:00/.test(p.head), p.head);
p = await openPage(ID('02'));
ok('A2 Winter: 10:00 UTC wird als 11:00 gezeigt', p.vmTime === '11:00' && /11:00/.test(p.head), p.head);
p = await openPage(ID('03'));
ok('A3 22:30 UTC im Sommer: 17. Juli, 00:30 — nicht mehr der Vortag', p.vmDate === '2026-07-17' && p.vmTime === '00:30' && /17\. Juli/.test(p.head) && /00:30/.test(p.head), p.head);
p = await openPage(ID('04'));
ok('A4 Ortszeit von Garmin gilt (08:03 am Ort der Aktivitaet), nicht die Zone des Betrachters (09:03)', p.vmTime === '08:03' && /08:03/.test(p.head), p.head);
p = await openPage(ID('05'));
ok('A5 ORVIA-Workout 16:00 UTC im Sommer: 18:00', p.vmTime === '18:00' && /18:00/.test(p.head), p.head);
p = await openPage(manualId);
ok('A6 eingegebene Einheit 18:00 bleibt 18:00 (wird nicht verschoben)', p.vmTime === '18:00' && p.vmDate === '2026-10-05' && /18:00/.test(p.head), p.head);
const list = await page.evaluate(async () => { try { gmCloseActivityPage(); } catch (_) { } showTab('akt'); await new Promise(r => setTimeout(r, 300)); return document.getElementById('tab-akt').innerText.replace(/\s+/g, ' '); });
ok('A7 die Liste nennt dieselben Tage (17. Juli fuer die Einheit nach Mitternacht)', /17\.\s?(Juli|07)/.test(list) || /17\. Jul/.test(list), list.slice(0, 260));

sec('B · Laufkadenz');
p = await openPage(ID('11'));
ok('B1 neuer Import: Kennzahl „161 spm" (bis v8-446: 80)', p.kpis.some(k => /^161 spm SCHRITTFREQUENZ$/i.test(k)) && p.cad.status === 'ok' && p.cad.avg === 161, JSON.stringify(p.kpis));
ok('B2 Kurve „Kadenz (spm)" ist da und nutzt dieselbe Messreihe', p.charts.some(c => /Kadenz \(spm\)/.test(c)) && p.cadNote === null, JSON.stringify(p.charts));
ok('B3 Highlights nennen dieselbe Zahl: 161 spm', /161 spm/.test(p.story) && !/\b80 spm/.test(p.story), p.story.slice(0, 200));
p = await openPage(ID('12'));
ok('B4 Altimport: KEINE Zahl in der Kennzahl (weder 80 noch 160), keine Kadenz-Kurve', p.kpis.some(k => /^— SCHRITTFREQUENZ$/i.test(k)) && !p.kpis.some(k => /\b(80|160) spm/.test(k)) && !p.charts.some(c => /Kadenz/.test(c)) && p.cad.status === 'unverified', JSON.stringify([p.kpis, p.charts]));
ok('B5 Altimport: Hinweis, dass die Messreihe neu geladen wird; die uebrigen Kurven bleiben', /älteren Import/.test(p.cadNote || '') && p.charts.some(c => /Herzfrequenz/.test(c)) && p.charts.some(c => /Tempo/.test(c)), String(p.cadNote));
ok('B6 Altimport: Highlights nennen keine Schrittfrequenz', !/\d+ spm/.test(p.story), p.story.slice(0, 200));

sec('C · Rad');
p = await openPage(ID('21'));
ok('C1 Trittfrequenz unveraendert: Kurve „Trittfrequenz (rpm)", Bedeutung Umdrehungen, Mittel 92', p.charts.some(c => /Trittfrequenz \(rpm\)/.test(c)) && p.cad.status === 'ok' && p.cad.kind === 'cycling_cadence_rpm' && p.cad.avg === 92, JSON.stringify([p.charts, p.cad]));
ok('C2 Rad-Seite traegt keine Schrittfrequenz; Leistung bleibt', !p.kpis.some(k => /SCHRITTFREQUENZ/i.test(k)) && p.kpis.some(k => /19\d W Ø LEISTUNG/i.test(k)) && p.charts.some(c => /Leistung/.test(c)), JSON.stringify(p.kpis));

sec('D · Lauf-Seite: Max. HF und Kalorien');
p = await openPage(ID('11'));
ok('D1 liefert die Quelle sie, stehen Max. Herzfrequenz (176 bpm) und Kalorien (512 kcal) auf der Seite', p.kpis.some(k => /^176 bpm MAX\. HERZFREQUENZ$/i.test(k)) && p.kpis.some(k => /^512 kcal KALORIEN$/i.test(k)) && p.kpis.length === 8, JSON.stringify(p.kpis));
p = await openPage(ID('12'));
ok('D2 liefert sie sie nicht, gibt es keine leere Kachel dafuer (sechs Kennzahlen wie bisher)', p.kpis.length === 6 && !p.kpis.some(k => /MAX\. HERZFREQUENZ|KALORIEN/i.test(k)), JSON.stringify(p.kpis));

sec('E · Yoga ist Yoga');
p = await openPage(ID('31'));
ok('E1 als „other" gespeicherte Einheit mit Rohtyp „yoga": Sportart Yoga, Kennzeichen „Yoga" (nicht „Andere")', p.sport === 'yoga' && p.label === 'Yoga' && /YOGA/i.test(p.kicker) && !/ANDERE|SONSTIG/i.test(p.kicker), p.kicker);
p = await openPage(manualId);
ok('E2 manuell erfasstes Yoga: Sportart Yoga', p.sport === 'yoga' && /YOGA/i.test(p.kicker), p.kicker);
const agg = await page.evaluate(() => { const acts = listActivitiesUnified().filter(a => /sess-y|manual:2026-10-05:yoga/.test(String(a.sourceRecordId)));
  const tz = 'Europe/Berlin', C = ORVIA.activityConfig;
  const w1 = C.weeklyActivityTotals(acts, {}, { weekRef: '2026-09-06', timezone: tz }), w2 = C.weeklyActivityTotals(acts, {}, { weekRef: '2026-10-05', timezone: tz });
  return { n: acts.length, ids: acts.map(a => a.sportId), w1: Object.keys((w1 && w1.bySport) || {}), w2: Object.keys((w2 && w2.bySport) || {}), norm: ['yoga', 'hyrox', 'volleyball', 'Klettern'].map(v => ORVIA.trainingDomain.normSport(v)) }; });
ok('E3 Wochensummen fuehren beide Einheiten unter „yoga" — nichts mehr unter „other"', agg.n === 2 && agg.ids.every(x => x === 'yoga') && JSON.stringify(agg.w1) === '["yoga"]' && JSON.stringify(agg.w2) === '["yoga"]', JSON.stringify(agg));
ok('E4 Hyrox, Volleyball, Klettern ebenso', JSON.stringify(agg.norm) === '["yoga","hyrox","volleyball","climbing"]', JSON.stringify(agg.norm));

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' data_integrity_v447_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
