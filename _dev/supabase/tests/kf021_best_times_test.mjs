/* ORVIA · KF-021 — Bestzeiten aus GEMESSENEN Runden statt aus einer Schaetzung.

   BEFUND (Baseline):
     bestTimes() las ausschliesslich den Legacy-Tagesblob DB[datum].sessions.Laufen.
     Reine Garmin-Synchronisationen waren dort nie enthalten. Fehlte ein manuell
     gepflegter .best-Wert, fiel die Anzeige auf eine Riegel-Schaetzung aus der
     DURCHSCHNITTSPACE zurueck — ein real gelaufener 1-km-Split von 4:20 wurde
     als „4:37" ausgewiesen. Die Runden lagen kanonisch vor (metrics.splits),
     wurden aber nur in der Aktivitaetsdetailansicht gelesen.

   Dieser Test prueft drei Ebenen:
     1. REIN  — das Fenstermodell in js/run-bests.js (ohne Browser)
     2. NEGATIVKONTROLLE — dieselben Daten durch den ALTEN Algorithmus: er MUSS
        das falsche Ergebnis liefern. Ein Test, der auch vorher gruen waere,
        beweist nichts.
     3. LIVE  — bestTimes() in der echten App gegen einen kontrollierten Store

   node supabase/tests/kf021_best_times_test.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
/* Zwei Checkout-Layouts: Cloud (App unter ../../) und Geraet (App unter ../../../app). */
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2]) : (existsSync(join(_flat, 'index.html')) ? _flat : join(_flat, '..', 'app'));
const CHROME = process.env.ORVIA_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const R = f => readFileSync(join(APP, f), 'utf8');

const RB = require(join(APP, 'js', 'run-bests.js'));

/* ============ 1) Fenstermodell ============ */

/* Intervalleinheit wie beim Nutzer: 1-km-Belastungen mit kurzen Trabpausen. */
const INTERVALS = [
  { km: 1.00, sec: 260 },   /* 4:20 — die reale Bestleistung */
  { km: 0.40, sec: 168 },
  { km: 1.00, sec: 268 },
  { km: 0.40, sec: 172 },
  { km: 1.00, sec: 271 }
];
ok('1 km wird als GEMESSENE Runde erkannt (4:20)',
   RB.bestWindow(INTERVALS, 1).sec === 260, JSON.stringify(RB.bestWindow(INTERVALS, 1)));
ok('5 km wird NICHT erfunden, wenn die Runden zusammen nur 3,8 km ergeben',
   RB.bestWindow(INTERVALS, 5) === null);

/* Auto-Laps eines Dauerlaufs. */
const AUTO = [{ km: 1, sec: 300 }, { km: 1, sec: 295 }, { km: 1, sec: 305 }, { km: 1, sec: 290 }, { km: 1, sec: 292 }];
ok('5 km aus fuenf zusammenhaengenden Auto-Laps', RB.bestWindow(AUTO, 5).sec === 1482);
ok('1 km nimmt die schnellste Einzelrunde', RB.bestWindow(AUTO, 1).sec === 290);
ok('Fenster meldet die tatsaechlich gemessene Strecke', RB.bestWindow(AUTO, 5).km === 5);

/* Halbe Runden muessen zusammengesetzt werden — kein Hochrechnen. */
ok('1 km entsteht aus zwei 500-m-Runden',
   RB.bestWindow([{ km: 0.5, sec: 130 }, { km: 0.5, sec: 135 }], 1).sec === 265);

/* Ueberhang: eine 1,2-km-Runde ist KEINE 1-km-Bestzeit. */
ok('zu langes Fenster wird verworfen statt heruntergerechnet',
   RB.bestWindow([{ km: 1.2, sec: 300 }], 1) === null);
ok('knapper Ueberhang innerhalb 5 % gilt (Zeit ist Obergrenze)',
   RB.bestWindow([{ km: 1.04, sec: 300 }], 1).sec === 300);

/* Pausenrunde mit 0 km: ihre Zeit MUSS mitzaehlen, sonst wuerden zwei nicht
   zusammenhaengende Abschnitte verkettet und die Zeit zu gut ausgewiesen. */
const WITHPAUSE = [{ km: 1, sec: 260 }, { km: 0, sec: 30 }, { km: 1, sec: 250 }];
ok('0-km-Runde verkuerzt keine Bestzeit', RB.bestWindow(WITHPAUSE, 1).sec === 250);
ok('0-km-Runde zaehlt im laengeren Fenster als echte Zeit mit',
   RB.bestWindow(WITHPAUSE, 2).sec === 540, JSON.stringify(RB.bestWindow(WITHPAUSE, 2)));

/* Normalisierung: nur echte Felder, keine erfundene Runde. */
ok('normalizeSplits akzeptiert Garmin-Rohfelder',
   JSON.stringify(RB.normalizeSplits([{ distance: 1000, duration: 260, averageHR: 168 }])) ===
   JSON.stringify([{ km: 1, sec: 260, hr: 168 }]));
ok('normalizeSplits verwirft Runden ohne Distanz oder Dauer',
   RB.normalizeSplits([{ duration: 260 }, { distance: 1000 }]) === null);
ok('normalizeSplits liefert null statt eines leeren Arrays', RB.normalizeSplits([]) === null);

/* ============ measuredRunBests: Auswahl und Ausschluesse ============ */
const act = (o) => Object.assign({
  id: 'a1', sportId: 'running', status: 'completed', startedAt: '2026-07-20T06:00:00Z',
  durationSeconds: 2400, summary: { distance_m: 8000 }, metrics: { splits: null }
}, o);
const raw = s => s.map(x => ({ distance: x.km * 1000, duration: x.sec }));

let m = RB.measuredRunBests([act({ metrics: { splits: raw(INTERVALS) } })]);
ok('KF-021 · gemessene 1-km-Bestzeit aus der Intervalleinheit', m.k1 && m.k1.sec === 260,
   m.k1 ? m.k1.sec + 's · ' + m.k1.method : 'null');
ok('KF-021 · Quelle ist etikettiert', m.k1 && m.k1.method === 'lap_window');
ok('KF-021 · Datum und Aktivitaet sind rueckverfolgbar',
   m.k1 && m.k1.date === '2026-07-20' && m.k1.activityId === 'a1');
ok('KF-021 · keine 5-km-Bestzeit ohne 5 gemessene Kilometer', m.k5 === null);
ok('KF-021 · keine 10-km-Bestzeit ohne 10 gemessene Kilometer', m.k10 === null);

m = RB.measuredRunBests([act({ metrics: { splits: null }, summary: { distance_m: 5020 }, durationSeconds: 1400 })]);
ok('Aktivitaet ohne Runden zaehlt, wenn ihre eigene Distanz im Zielfenster liegt',
   m.k5 && m.k5.sec === 1400 && m.k5.method === 'activity_total');
ok('… aber sie wird NICHT auf andere Distanzen hochgerechnet', m.k1 === null && m.k10 === null);

ok('8-km-Lauf liefert KEINE 5-km-Bestzeit (Ueberhang zu gross, keine Runden)',
   RB.measuredRunBests([act({})]).k5 === null);

ok('Nicht-Laufaktivitaeten werden ignoriert',
   RB.measuredRunBests([act({ sportId: 'cycling', metrics: { splits: raw(AUTO) } })]).k1 === null);
ok('nicht abgeschlossene Aktivitaeten werden ignoriert',
   RB.measuredRunBests([act({ status: 'active', metrics: { splits: raw(AUTO) } })]).k1 === null);
ok('geloeschte (tombstoned) Aktivitaeten werden ignoriert',
   RB.measuredRunBests([act({ metrics: { splits: raw(AUTO) } })], { isTombstoned: () => true }).k1 === null);
ok('ueber mehrere Laeufe gewinnt die schnellste Messung',
   RB.measuredRunBests([act({ id: 'a1', metrics: { splits: raw(AUTO) } }),
                        act({ id: 'a2', metrics: { splits: raw(INTERVALS) } })]).k1.activityId === 'a2');

/* ============ 2) NEGATIVKONTROLLE ============
   Exakt der Algorithmus VOR dem Fix, auf denselben Daten. Er darf die Messung
   nicht finden — sonst prueft dieser Test nichts. */
function oldBestTimes(runs) {
  if (!runs.length) return null;
  const rb = { k1: null, k5: null, k10: null };
  runs.forEach(r => { if (r.best) { if (r.best.k1 && (rb.k1 == null || r.best.k1 < rb.k1)) rb.k1 = r.best.k1; } });
  const elig = runs.filter(r => r.dist >= 2 && r.dur);
  let est = null;
  if (elig.length) {
    const best = elig.reduce((a, b) => (b.dur / b.dist) < (a.dur / a.dist) ? b : a);
    est = { t1: Math.round(best.dur * Math.pow(1 / best.dist, 1.06) * 60) };
  }
  return { t1: rb.k1 != null ? rb.k1 : (est ? est.t1 : null), real: rb.k1 != null };
}
/* Der Lauf, aus dem die Intervalle stammen: 8 km in 40 min als Tagesblob. */
const oldRes = oldBestTimes([{ dist: 8, dur: 40, best: null }]);
ok('NEGATIVKONTROLLE · der alte Algorithmus liefert eine SCHAETZUNG statt der Messung',
   oldRes.real === false && oldRes.t1 !== 260, oldRes.t1 + 's statt 260s');
ok('NEGATIVKONTROLLE · die Schaetzung war messbar langsamer als die reale Runde',
   oldRes.t1 > 260, 'Schaetzung ' + Math.floor(oldRes.t1 / 60) + ':' + String(oldRes.t1 % 60).padStart(2, '0'));
ok('NEGATIVKONTROLLE · ohne Legacy-Blob lieferte der alte Algorithmus gar nichts',
   oldBestTimes([]) === null, 'reine Garmin-Nutzer sahen „Noch keine Läufe"');

/* ============ Quelltext-/Verdrahtungsvertrag ============ */
const ui = R('js/ui.js');
ok('bestTimes() liest die gemessenen Bestzeiten', /measuredRunBests\(/.test(ui));
ok('bestTimes() nimmt kanonische Store-Laeufe in den Schaetzpool auf',
   /_storeRunSessions\(\)\.forEach/.test(ui));
ok('bestTimes() gibt die Quelle je Distanz zurueck', /src:src/.test(ui) && /meas:meas/.test(ui));
ok('die Oberflaeche behauptet nicht mehr pauschal „Strava"', !/>Strava<|\?'Strava'/.test(ui));
ok('es gibt EINE Etikettfunktion fuer alle Bestzeiten-Renderer', /function gmBtSrcLabel\(/.test(ui));
ok('Rundennormalisierung existiert nur noch EINMAL',
   !/distanceInMeters/.test(R('js/activity.js')) && /distanceInMeters/.test(R('js/run-bests.js')));
ok('activity.js bezieht die Runden aus dem kanonischen Modul',
   /ORVIA\.runBests[\s\S]{0,80}normalizeSplits/.test(R('js/activity.js')));
const html = R('index.html'), sw = R('sw.js');
ok('run-bests.js ist eingebunden', /src="js\/run-bests\.js"/.test(html));
ok('run-bests.js laedt VOR ui.js und activity.js',
   html.indexOf('js/run-bests.js') < html.indexOf('js/ui.js')
   && html.indexOf('js/run-bests.js') < html.indexOf('js/activity.js'));
ok('run-bests.js ist im Service-Worker-Precache', /'\.\/js\/run-bests\.js'/.test(sw));
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('Service-Worker-Version wurde erhoeht (sonst liefert der alte Cache die alte App)',
   swv != null && Number(swv) >= 222, 'orvia-v8-' + swv);

/* ============ 3) LIVE in der echten App ============ */
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
await page.waitForTimeout(1100);
await page.evaluate(() => {
  document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove());
  document.documentElement.classList.remove('orvia-gated');
});

const live = await page.evaluate(({ splits }) => {
  const day = (typeof dkey === 'function') ? dkey(-3) : null;
  const act = {
    id: 'kf021', clientRecordId: 'kf021', sportId: 'running', status: 'completed',
    startedAt: day + 'T06:00:00Z', durationSeconds: 2400,
    summary: { distance_m: 8000 }, metrics: { splits: splits }
  };
  const store = window.ORVIA && ORVIA.activityStore;
  const origList = store.listActivities, origTomb = store.isTombstoned;
  store.listActivities = function () { return [act]; };
  store.isTombstoned = null;
  /* Tagesblob mit demselben Lauf — genau die Konstellation, in der vorher die
     Schaetzung (Durchschnittspace 5:00/km) die reale 4:20-Runde verdeckte. */
  const hadDay = Object.prototype.hasOwnProperty.call(DB, day);
  const prevDay = DB[day];
  DB[day] = { sessions: { Laufen: { dist: 8, dur: 40 } } };
  let b = null, err = null;
  try { b = bestTimes(); } catch (e) { err = String(e); }
  let profileHtml = '';
  try { profileHtml = gmProfBestTimes(); } catch (e) { err = err || String(e); }
  store.listActivities = origList; store.isTombstoned = origTomb;
  if (hadDay) DB[day] = prevDay; else delete DB[day];
  /* Das Datum der Messung lebt im Zeilenregister (_gmBtSlots) und im Zeilen-Sheet —
     nicht im Seiten-HTML selbst. Genau dort pruefen. */
  const slotDate = (typeof _gmBtSlots !== 'undefined' && _gmBtSlots[0]) ? _gmBtSlots[0].date : null;
  return { b, err, profileHtml, day, slotDate };
}, { splits: raw(INTERVALS) });

ok('LIVE · bestTimes() laeuft ohne Fehler', !live.err, live.err || '');
ok('LIVE · 1 km ist die GEMESSENE 4:20, nicht die 5:00-Schaetzung',
   live.b && live.b.t1 === 260, live.b ? live.b.t1 + 's' : 'null');
ok('LIVE · der Wert gilt als echte Leistung', live.b && live.b.real.k1 === true);
ok('LIVE · die Quelle ist die Runde aus der Uhr', live.b && live.b.src.k1 === 'lap_window',
   live.b ? String(live.b.src.k1) : '—');
ok('LIVE · die gemessene Strecke wird mitgefuehrt', live.b && live.b.meas && live.b.meas.k1.km === 1);
ok('LIVE · 5 km bleibt eine ausgewiesene Schaetzung (keine 5 gemessenen km vorhanden)',
   live.b && live.b.real.k5 === false && live.b.src.k5 === 'estimate');
ok('LIVE · die Schaetzung ist damit nachweislich langsamer als die Messung',
   live.b && live.b.estPace != null && live.b.estPace > 260,
   live.b ? Math.round(live.b.estPace) + 's/km Durchschnittspace' : '—');
ok('LIVE · die Bestzeitenseite nennt die Messung als Messung',
   /gemessen/.test(live.profileHtml) && /Runden aus der Uhr/.test(live.profileHtml));
ok('LIVE · die Bestzeitenseite kennzeichnet die Schaetzung weiterhin als Schaetzung',
   /geschätzt/.test(live.profileHtml));
/* PRAEZISIERT (2026-08-05): Die alte Pruefung suchte den Kalendertag im
   Seiten-HTML und war datumsabhaengig-bruechig. Das Messdatum steht im
   Zeilenregister (_gmBtSlots → Zeilen-Sheet) — genau dort wird geprueft. */
ok('LIVE · die gemessene Bestzeit traegt ihr Messdatum (Zeilenregister/Sheet)',
   live.slotDate != null && String(live.slotDate).length > 0, String(live.slotDate));

/* Der Fix darf den leeren Zustand nicht in erfundene Werte drehen. */
const empty = await page.evaluate(() => {
  const store = window.ORVIA && ORVIA.activityStore;
  const origList = store.listActivities;
  store.listActivities = function () { return []; };
  const keys = Object.keys(DB).filter(k => typeof isDay === 'function' && isDay(k));
  const backup = {}; keys.forEach(k => { backup[k] = DB[k]; delete DB[k]; });
  let b = null; try { b = bestTimes(); } catch (e) {}
  store.listActivities = origList; keys.forEach(k => { DB[k] = backup[k]; });
  return b;
});
ok('ohne jede Datenlage bleibt bestTimes() bei null (keine erfundene Bestzeit)', empty === null);

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close(); server.close();
console.log('\nkf021_best_times: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
