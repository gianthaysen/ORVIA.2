/* ORVIA · Batch 2026-08-04 — Stream-Bestzeiten, Meilensteine/Medaillen,
   Planvarianten A/B/C, KF-004/005/010/011/012/019/021-Nachtrag.

   Drei Ebenen:
     1. REIN     — run-bests-Streams, achievements, calc.easyShare (node, ohne Browser)
     2. QUELLE   — Verdrahtungs- und Negativkontrollen im Quelltext
     3. LIVE     — echte App im Browser mit kontrolliert gesetzten Daten

   node supabase/tests/batch_2026_08_04_test.mjs [appRoot-absolut] */
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

/* ============ 1a) Stream-Bestzeiten (sekundengenau) ============ */
const RB = require(join(APP, 'js', 'run-bests.js'));

/* 40 Samples à 10 s: die ersten 30 schnell (3,5 m/s ⇒ 1.050 m), danach langsam.
   Der schnelle Kilometer liegt INNERHALB des Laufs — rundenbasiert (eine
   grobe Gesamtrunde) waere er unsichtbar. */
const dist = [], time = [];
let d = 0, t = 0;
for (let i = 0; i < 40; i++) {
  const v = i < 30 ? 3.5 : 2.0;             /* m/s */
  dist.push(d); time.push(t);
  d += v * 10; t += 10;
}
const sw1 = RB.bestWindowFromStreams(dist, time, 1);
ok('Stream · 1 km wird innerhalb des Laufs gefunden', !!sw1, JSON.stringify(sw1));
ok('Stream · Zeit entspricht dem schnellen Segment (~286 s, nie geschoent)',
   sw1 && sw1.sec >= 280 && sw1.sec <= 300, sw1 && sw1.sec + 's');
ok('Stream · gemessene Distanz >= Ziel (Obergrenze, keine Interpolation)',
   sw1 && sw1.km >= 1, sw1 && sw1.km + ' km');
ok('Stream · Ziel laenger als der Lauf ⇒ null (kein Hochrechnen)',
   RB.bestWindowFromStreams(dist, time, 5) === null);
ok('Stream · nicht-monotone Distanzachse wird fail-closed verworfen',
   RB.bestWindowFromStreams([0, 500, 300, 1200], [0, 60, 120, 180], 1) === null);
ok('Stream · kaputtes Sample (NaN) verwirft die Auswertung',
   RB.bestWindowFromStreams([0, 500, NaN, 1200], [0, 60, 120, 180], 1) === null);
ok('Stream · Slack-Guard: grobe Samples mit >5 % Ueberhang ⇒ null',
   RB.bestWindowFromStreams([0, 1200], [0, 300], 1) === null);
ok('streamTimeAxis · findet nur echte Zeitachsen',
   RB.streamTimeAxis({ time: [0, 1] }) != null && RB.streamTimeAxis({ speed: [3, 3], distance: [0, 30] }) === null);

/* NEGATIVKONTROLLE: distance+speed OHNE Zeitachse darf NIE eine Messung liefern —
   eine aus Δd/v abgeleitete Zeit waere eine Schaetzung mit Mess-Etikett. */
const actStreams = (streams) => [{ id: 'a1', sportId: 'running', status: 'completed',
  startedAt: '2026-08-01T06:00:00Z', durationSeconds: 290, summary: { distance_m: 1900 },
  metrics: { splits: null, streams } }];
ok('NEGATIVKONTROLLE · distance+speed ohne Zeitachse ⇒ KEINE gemessene Bestzeit',
   RB.measuredRunBests(actStreams({ distance: dist, speed: dist.map(() => 3) })).k1 === null);
const mStream = RB.measuredRunBests(actStreams({ distance: dist, time: time }));
ok('measuredRunBests · mit Zeitachse kommt die Stream-Messung', mStream.k1 && mStream.k1.method === 'stream_window');
/* Stream schlaegt groebere Runden derselben Aktivitaet, wenn er schneller misst */
const both = RB.measuredRunBests([{ ...actStreams({ distance: dist, time: time })[0],
  metrics: { streams: { distance: dist, time: time }, splits: [{ distance: 1900, duration: 290 }] } }]);
ok('measuredRunBests · Stream-Fenster gewinnt gegen zu grobe Runden', both.k1 && both.k1.method === 'stream_window');

/* ============ 1b) Achievements (Meilensteine/Medaillen) ============ */
const ACH = require(join(APP, 'js', 'achievements.js'));
const mkAct = (day, sport, km, id) => ({ id: id || (sport + day), sportId: sport, status: 'completed',
  startedAt: day + 'T06:00:00Z', durationSeconds: 3600, summary: { distanceKm: km } });

const A1 = ACH.computeAchievements([
  mkAct('2026-07-06', 'running', 8), mkAct('2026-07-08', 'running', 12), mkAct('2026-07-11', 'running', 16),
  mkAct('2026-07-07', 'cycling', 40), mkAct('2026-07-14', 'running', 6), mkAct('2026-07-15', 'running', 7),
  mkAct('2026-07-16', 'running', 9)
]);
const byId = Object.fromEntries(A1.milestones.map(m => [m.id, m]));
ok('ACH · laengster Lauf gemessen (16 km), naechste Stufe 21,1', byId.run_longest.current === 16 && byId.run_longest.next === 21.1);
ok('ACH · erreichte Stufe traegt das Datum der belegenden Aktivitaet',
   A1.medals.some(m => m.ladderId === 'run_longest' && m.step === 15 && m.date === '2026-07-11'));
ok('ACH · Wochenumfang aus Kalenderwochen (36 km in KW 6.–12.7.)', byId.run_week_km.current === 36, byId.run_week_km.current + ' km');
ok('ACH · Radleiter getrennt (40 km ⇒ Stufe 30 verdient, naechste 50)',
   byId.ride_longest.current === 40 && byId.ride_longest.next === 50);
ok('ACH · Fortschritt ist reiner Ist/Soll-Quotient', byId.ride_longest.progress === 80);
ok('ACH · keine Erfindung: 16 km ergeben KEINE 21,1-Medaille',
   !A1.medals.some(m => m.ladderId === 'run_longest' && m.step === 21.1));
ok('ACH · leere Liste ⇒ leeres, ehrliches Ergebnis',
   ACH.computeAchievements([]).medals.length === 0 && ACH.computeAchievements([]).activityCount === 0);
ok('ACH · nicht abgeschlossene Aktivitaeten zaehlen nicht',
   ACH.computeAchievements([{ ...mkAct('2026-07-06', 'running', 30), status: 'active' }]).medals.length === 0);
/* Konstanz: 2 Wochen in Folge mit >= 3 Einheiten, Luecke bricht die Serie */
const streakActs = [];
['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-22', '2026-06-23', '2026-06-24'].forEach((dd, i) => streakActs.push(mkAct(dd, 'running', 5, 'r' + i)));
const A2 = ACH.computeAchievements(streakActs);
ok('ACH · Wochenserie korrekt (2 in Folge, Luecke bricht)',
   Object.fromEntries(A2.milestones.map(m => [m.id, m])).week_streak.current === 2);

/* ============ 1c) KF-010 easyShare ============ */
const Calc = require(join(APP, 'js', 'calc.js'));
globalThis.PROFILE = { hfMax: 190 };
const run = (hr, sub) => ({ dur: 45, hr: hr, sub: sub || '' });
ok('KF-010 · Garmin-Laeufe werden ueber HF klassifiziert (4 easy / 2 hart = 2/3)',
   Math.abs(Calc.easyShare([run(140), run(142), run(138), run(145), run(165), run(170)]) - 4 / 6) < 1e-9);
ok('KF-010 · Graubereich 78–82 % HFmax faellt aus Zaehler UND Nenner',
   Calc.easyShare([run(140), run(142), run(138), run(145), run(165), run(152)]) === null,
   '152 bpm = 80 % HFmax ⇒ nur 5 klassifizierbar ⇒ null');
ok('KF-010 · ohne HF und ohne Label keine stille Fehlklassifikation',
   Calc.easyShare([run(null), run(null), run(null), run(null), run(null), run(null)]) === null);
ok('KF-010 · Label-Klassifikation unveraendert (Bestandsvertrag)',
   Calc.easyShare([{ dur: 60, sub: 'Easy Z2' }, { dur: 60, sub: 'Easy Z2' }, { dur: 60, sub: 'Easy Z2' },
                   { dur: 60, sub: 'Easy Z2' }, { dur: 60, sub: 'Intervals' }, { dur: 60, sub: 'Easy Z2' }]) === 5 / 6);
/* NEGATIVKONTROLLE: der alte Algorithmus zaehlte sub:'' pauschal als NICHT-easy. */
function oldEasyShare(runs28) {
  const t = runs28.filter(r => r.dur > 0);
  const tot = t.reduce((s, r) => s + r.dur, 0); if (!tot || t.length < 6) return null;
  const easy = t.filter(r => ['Walk-Run', 'Easy Z2', 'Long Run'].includes(r.sub)).reduce((s, r) => s + r.dur, 0);
  return easy / tot;
}
ok('NEGATIVKONTROLLE · alter Algorithmus meldete fuer 6 lockere Garmin-Laeufe 0 % easy',
   oldEasyShare([run(140), run(140), run(140), run(140), run(140), run(140)]) === 0,
   'neue Regel: ' + Calc.easyShare([run(140), run(140), run(140), run(140), run(140), run(140)]));
delete globalThis.PROFILE;

/* ============ 2) Quelltext-Verdrahtung ============ */
const ui = R('js/ui.js'), html = R('index.html'), sw = R('sw.js'), css = R('styles.css');
const gv = R('js/gym-volume.js'), pro = R('js/orvia-pro.js');

ok('Planvarianten · Schein-Zustand entfernt (kein festes „B on + Empfohlen")',
   !/pvar '\+\(p\[0\]==='B'\?'on'/.test(ui) && !/pill-badge">Empfohlen/.test(ui));
ok('Planvarianten · Auswahl mutiert NIE den gespeicherten Plan',
   /gmSetPlanVariant/.test(ui) && !/function gmSetPlanVariant[\s\S]{0,400}(PROFILE\.weekPlan\s*=|saveProfile\()/.test(ui));
ok('Planvarianten · entfallende Einheiten bleiben sichtbar (pvar-skip statt Entfernen)',
   /pvar-skip/.test(ui) && /\.session-card\.pvar-skip\{opacity/.test(css.replace(/\s/g, '')));
ok('Planvarianten · Slot plan-variant bleibt erhalten', /data-gm-slot="plan-variant"/.test(ui));
ok('KF-011 · alle drei weekPlan-Schreiber hinterlassen Provenienz',
   /_planMeta\('manual_edit'\)/.test(ui) && /_planMeta\('reset'\)/.test(ui) && /_planMeta\('engine_adjustment',batchId\)/.test(ui));
ok('KF-004 · Produzent existiert, harte nulls sind weg',
   /function gmLoadExtras\(/.test(ui) && !/trimp:null,hi:null,\n\s*sport:\[\['Laufen',null/.test(ui) && !/trimp:null,hi:null,$/m.test(ui));
/* AKTUALISIERT (Phase 2.2): Der urspruengliche KF-004-Produzent klassifizierte
   hart per RPE >= 8 ODER HF >= 85 % HFmax, lastgewichtet. Der eingefrorene
   Umsetzungsplan legt stattdessen den reinen RPE-Proxy fest: ANTEIL DER
   EINHEITEN mit RPE >= 7, Einheiten ohne RPE fallen aus Zaehler UND Nenner,
   Abdeckung im Envelope. Die Detailpruefung liegt in phase2_envelope_test.mjs. */
ok('KF-004 · Unklassifizierbares faellt aus Zaehler UND Nenner (dokumentiert + implementiert)',
   /fallen aus ZAEHLER UND NENNER/.test(ui) && /session_rpe_hard_share/.test(ui));
ok('KF-005 · erwartbare Nicht-Verfuegbarkeit kein Fehler mehr',
   /EXPECTED_UNAVAILABLE\s*=\s*\{\s*offline:\s*true,\s*no_session:\s*true,\s*NO_DATA_SOURCE:\s*true\s*\}/.test(gv));
ok('NEGATIVKONTROLLE KF-005 · alte Pauschalregel ist ersetzt',
   !/anyFail = \(dg\.sourceCalls \|\| \[\]\)\.some\(function \(c\) \{ return c\.attempted && !c\.success; \}\);/.test(gv));
ok('KF-012 · vier eigenstaendige Rechtstexte statt EINEM Platzhalter',
   /ORVIA_LEGAL\s*=/.test(pro) && !/Platzhalter — '\+escH\(t\)/.test(pro)
   && /DSGVO/.test(pro) && /Ladungsfähige Anschrift wird vor Veröffentlichung ergänzt/.test(pro)
   && /keine Tracking- oder Werbe-Cookies/i.test(pro) && /kein Medizinprodukt/i.test(pro));
ok('KF-012 · Entwurfsstatus bleibt ehrlich gekennzeichnet', (pro.match(/juristisch zu prüfen|juristisch geprüft/g) || []).length >= 3);
ok('KF-019 · Reauth-Felder werden gelesen',
   /reauthentication_required/.test(ui) && /last_error_code/.test(ui) && /gmDevReauthNeeded/.test(ui));
ok('NEGATIVKONTROLLE KF-019 · „verbunden" haengt nicht mehr NUR an der Zeilen-Existenz',
   /reauth\?'Neuanmeldung nötig'/.test(ui) && /!connected\|\|running\|\|reauth/.test(ui));
/* docs/ und supabase/tests liegen im Geraete-Layout unter _dev (= HERE/../..),
   nicht unter APP — deshalb hier der Dev-Wurzelpfad, der in beiden Layouts gilt. */
ok('KF-015 · Registry-Vertrag repo-intern verankert',
   existsSync(join(_flat, 'docs', 'gm-ref', 'metric-registry.snapshot.json'))
   && /metric-registry\.snapshot\.json/.test(readFileSync(join(HERE, 'metric_registry_test.mjs'), 'utf8')));
ok('KF-021-Nachtrag · Story prueft das kanonische Distanzmodell VOR dem Aktivitaetsvergleich',
   /var distPB=null/.test(ui) && /distPB\?null:gmActPersonalBest/.test(ui));
ok('Achievements · eingebunden und im Precache, VOR ui.js',
   /src="js\/achievements\.js"/.test(html) && /'\.\/js\/achievements\.js'/.test(sw)
   && html.indexOf('js/achievements.js') < html.indexOf('js/ui.js'));
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version erhoeht (>= 223), genau einmal', swv != null && Number(swv) >= 223 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

/* ============ 3) LIVE ============ */
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

/* Planvarianten: Auswahl wirkt in der Ansicht, mutiert aber nie den Plan */
const pv = await page.evaluate(() => {
  try { localStorage.removeItem('orvia_plan_variant_v1'); } catch (e) {}
  const prevPlan = PROFILE.weekPlan ? JSON.parse(JSON.stringify(PROFILE.weekPlan)) : null;
  PROFILE.weekPlan = [[{ t: 'Laufen', l: 'Intervalle 6×800', d: 'iv', id: 'pv1' }], [],
    [{ t: 'Gym', l: 'Ganzkörper', d: '45 min', id: 'pv2' }], [{ t: 'Gym', l: 'Core & Mobilität', d: '20 min', id: 'pv3' }],
    [{ t: 'Laufen', l: 'Long Run', d: 'lr', id: 'pv4' }], [], []];
  renderGMPlan();
  const hA = document.getElementById('gmPlan').innerHTML;
  gmSetPlanVariant('C');
  const hC = document.getElementById('gmPlan').innerHTML;
  const planAfter = JSON.stringify(PROFILE.weekPlan);
  const planSeeded = JSON.stringify([[{ t: 'Laufen', l: 'Intervalle 6×800', d: 'iv', id: 'pv1' }], [],
    [{ t: 'Gym', l: 'Ganzkörper', d: '45 min', id: 'pv2' }], [{ t: 'Gym', l: 'Core & Mobilität', d: '20 min', id: 'pv3' }],
    [{ t: 'Laufen', l: 'Long Run', d: 'lr', id: 'pv4' }], [], []]);
  gmSetPlanVariant('A');
  try { localStorage.removeItem('orvia_plan_variant_v1'); } catch (e) {}
  PROFILE.weekPlan = prevPlan; renderGMPlan();
  return { defaultA: /class="pvar on" onclick="gmSetPlanVariant\('A'\)"/.test(hA),
    aNoSkip: !/pvar-skip/.test(hA),
    cSkips: (hC.match(/pvar-skip/g) || []).length,
    cSkipLabel: /Entfällt \(C\)/.test(hC),
    cKeepsCore: /Intervalle 6×800/.test(hC) && /Long Run/.test(hC),
    allVisible: (hC.match(/session-card(?! rest)/g) || []).length >= 4,
    unchanged: planAfter === planSeeded,
    cellsReal: /<b>2<\/b><span>EINHEITEN/.test(hC) && /<b>5<\/b><span>RUHETAGE/.test(hC) };
});
ok('LIVE Variante · Standard ist A, nichts markiert', pv.defaultA && pv.aNoSkip);
ok('LIVE Variante · C markiert genau die Nicht-Kern-Einheiten', pv.cSkips === 2 && pv.cSkipLabel, pv.cSkips + ' markiert');
ok('LIVE Variante · Kernreize bleiben aktiv und ALLE Einheiten sichtbar', pv.cKeepsCore && pv.allVisible);
ok('LIVE Variante · Zellen zeigen echte Zahlen der Variante C', pv.cellsReal);
ok('LIVE Variante · gespeicherter Plan bitgenau unveraendert', pv.unchanged);

/* Meilensteine/Medaillen: mit gemessenen Aktivitaeten echte Inhalte, ohne: NA */
const achLive = await page.evaluate(() => {
  const store = window.ORVIA && ORVIA.activityStore;
  const orig = store.listActivities;
  const mk = (day, sport, km, id) => ({ id: id, clientRecordId: id, sportId: sport, status: 'completed',
    startedAt: day + 'T06:00:00Z', durationSeconds: 3600, summary: { distanceKm: km }, metrics: {} });
  store.listActivities = () => [mk('2026-07-11', 'running', 16, 'm1'), mk('2026-07-08', 'running', 12, 'm2'),
    mk('2026-07-07', 'cycling', 40, 'm3')];
  const medals = gmProfMedals();
  const miles = gmProfMilestones();
  const ana = (typeof gmAnaOverview === 'function') ? '' : '';
  const nm = gmNextMilestone(gmAchievements());
  store.listActivities = orig;
  const emptyStore = { listActivities: () => [] };
  const origStore2 = ORVIA.activityStore; ORVIA.activityStore = emptyStore;
  const medalsEmpty = gmProfMedals();
  ORVIA.activityStore = origStore2;
  return { medals, miles, nmLabel: nm && nm.label, nmNext: nm && nm.next,
    earned: (medals.match(/medal earned/g) || []).length,
    emptyLocked: (medalsEmpty.match(/medal locked/g) || []).length,
    emptyNoEarned: !/medal earned/.test(medalsEmpty) };
});
ok('LIVE Medaillen · verdiente Auszeichnungen (15-km-Lauf, 30-km-Rad, 20-km-Woche …)',
   achLive.earned >= 4 && /medal earned/.test(achLive.medals), achLive.earned + ' verdient');
ok('LIVE Medaillen · gesperrte zeigen naechste Stufe mit gemessenem Ist',
   /Ist \d+(,\d+)? km/.test(achLive.medals) && /medal locked/.test(achLive.medals));
ok('LIVE Medaillen · ohne Aktivitaeten der alte ehrliche Leerzustand', achLive.emptyLocked === 6 && achLive.emptyNoEarned);
ok('LIVE Meilensteine · gemessene Leitern mit Fortschritt', /nächste Stufe/.test(achLive.miles) && /gemessen/.test(achLive.miles) && (achLive.miles.match(/class="mile"/g) || []).length === 6);
ok('LIVE Meilensteine · naechster Meilenstein benannt', !!achLive.nmLabel && achLive.nmNext != null, achLive.nmLabel + ' ' + achLive.nmNext);

/* KF-004: Produzenten liefern aus kontrollierten Daten */
const kf004 = await page.evaluate(() => {
  const store = window.ORVIA && ORVIA.activityStore;
  const orig = store.listActivities;
  const today = todayStr();
  const mk = (dOff, sport, min, hr, id) => { const day = dkey(-dOff); return { id: id, sportId: sport, status: 'completed',
    startedAt: day + 'T06:00:00Z', durationSeconds: min * 60, summary: { avg_hr: hr, distanceKm: 8 }, metrics: {} }; };
  /* Phase 2.2: hart = RPE >= 7 (Einheiten-Anteil). Fixture: 4 Einheiten mit RPE
     (eine davon hart), 1 ohne RPE (faellt aus Zaehler UND Nenner). */
  const withRpe = (a, rpe) => { a.summary.rpe = rpe; return a; };
  store.listActivities = () => [withRpe(mk(1, 'running', 50, 145, 'x1'), 4), withRpe(mk(2, 'gym', 45, 120, 'x2'), 6),
    withRpe(mk(2, 'running', 40, 172, 'x3'), 8), withRpe(mk(4, 'cycling', 60, 130, 'x4'), 5), mk(5, 'running', 50, 140, 'x5')];
  const prevProf = { hfMax: PROFILE.hfMax, age: PROFILE.age, rhrBaseline: PROFILE.rhrBaseline };
  PROFILE.hfMax = 190; PROFILE.rhrBaseline = 48;
  const ex = gmLoadExtras();
  /* Negativkontrolle: ohne HFmax/Alter/Ruhepuls kein TRIMP */
  PROFILE.hfMax = null; PROFILE.age = null; PROFILE.rhrBaseline = null;
  const exNo = gmLoadExtras();
  Object.assign(PROFILE, prevProf);
  store.listActivities = orig;
  return { trimp: ex.trimp, hi: ex.hi, interf: ex.interf, sport: ex.sport, trimpNo: exNo.trimp };
});
ok('LIVE KF-004 · TRIMP Ø aus HF/Dauer/Baseline berechnet', kf004.trimp != null && kf004.trimp > 0, 'TRIMP Ø ' + kf004.trimp);
/* Phase 2.2: 1 von 4 RPE-Einheiten hart ⇒ 25 % (Einheit ohne RPE zaehlt nirgends). */
ok('LIVE KF-004 · Harte Einheiten = Anteil der RPE-Einheiten mit RPE ≥ 7', String(kf004.hi) === '25 %', String(kf004.hi));
ok('LIVE KF-004 · Interferenz kommt aus dem kanonischen Producer (Lastsprung/Bein-Interferenz)',
   /Lastsprung|Bein-Interferenz|Keine Auffälligkeit/.test(String(kf004.interf)), String(kf004.interf));
ok('NEGATIVKONTROLLE KF-004 · ohne HFmax/Ruhepuls bleibt TRIMP null (keine erfundene Zahl)', kf004.trimpNo === null);

/* KF-019: reauth_required wird ehrlich angezeigt und sperrt den Sync */
const kf019 = await page.evaluate(() => {
  const prev = JSON.parse(JSON.stringify(_gmDevSync));
  _gmDevSync = { state: 'ready', provider: 'garmin', lastSyncAt: '2026-08-01T05:00:00Z',
    reauth: true, errCode: 'TOKENS_MISSING', status: 'reauth_required', fetchedAt: Date.now() };
  const txt = gmDeviceSyncText();
  const pageHtml = gmProfConnections();
  _gmDevSync = { state: 'ready', provider: 'garmin', lastSyncAt: '2026-08-01T05:00:00Z',
    reauth: false, errCode: null, status: 'connected', fetchedAt: Date.now() };
  const okTxt = gmDeviceSyncText();
  const okHtml = gmProfConnections();
  _gmDevSync = prev;
  return { txt, reauthShown: /Neuanmeldung erforderlich/.test(pageHtml) && /local_login/.test(pageHtml),
    syncLocked: /Gesperrt/.test(pageHtml), errCode: /TOKENS_MISSING/.test(pageHtml),
    okTxt, okNoLock: !/Gesperrt|Neuanmeldung/.test(okHtml) };
});
ok('LIVE KF-019 · Statuszeile nennt die Neuanmeldung', /Neuanmeldung erforderlich/.test(kf019.txt), kf019.txt);
ok('LIVE KF-019 · Verbindungsseite: Handlung benannt + Sync gesperrt + Fehlercode sichtbar',
   kf019.reauthShown && kf019.syncLocked && kf019.errCode);
ok('LIVE KF-019 · verbundener Zustand bleibt unveraendert normal', /Garmin/.test(kf019.okTxt) && kf019.okNoLock);

/* KF-011: savePlanEdit hinterlaesst Provenienz, Sheet zeigt sie */
const kf011 = await page.evaluate(() => {
  const prevPlan = PROFILE.weekPlan ? JSON.parse(JSON.stringify(PROFILE.weekPlan)) : null;
  const prevMeta = PROFILE.weekPlanMeta ? JSON.parse(JSON.stringify(PROFILE.weekPlanMeta)) : null;
  window._planEdit = [[], [], [], [], [], [], [{ t: 'Laufen', l: 'Testlauf', d: 'ez', id: 'kf11' }]];
  try { savePlanEdit(); } catch (e) { return { err: String(e) }; }
  const meta = PROFILE.weekPlanMeta ? JSON.parse(JSON.stringify(PROFILE.weekPlanMeta)) : null;
  gmOpenPlanSettingsSheet();
  const sheet = document.getElementById('detailSheet').innerHTML;
  try { gmCloseSheets(); } catch (e) {}
  PROFILE.weekPlan = prevPlan; PROFILE.weekPlanMeta = prevMeta;
  return { meta, provShown: /manuell bearbeitet/.test(sheet) };
});
ok('LIVE KF-011 · manueller Edit traegt Provenienz', kf011.meta && kf011.meta.source === 'manual_edit' && !!kf011.meta.at, JSON.stringify(kf011.meta));
ok('LIVE KF-011 · Plan-Sheet zeigt die Provenienz an', kf011.provShown === true);

/* KF-012: Dokumente sind im Live-Modal unterscheidbar */
const kf012 = await page.evaluate(() => {
  /* oModal ist im GM-System auf #detailSheet umgeleitet (ui.js „Modal-Cleanup") —
     genau dort lesen; #suppSheet ist nur der Fallback ohne GM-Block. */
  const texts = {};
  ['Impressum', 'Datenschutzerklärung', 'Nutzungsbedingungen', 'Cookie-/Tracking-Einstellungen'].forEach(t => {
    try { openLegalDoc(t);
      const sh = document.getElementById('detailSheet') || document.getElementById('suppSheet');
      texts[t] = sh ? sh.innerHTML.replace(/<[^>]+>/g, ' ') : '';
      try { gmCloseSheets(); } catch (e) {}
    } catch (e) { texts[t] = 'ERR ' + e; }
  });
  const vals = Object.values(texts);
  return { distinct: new Set(vals.map(v => v.replace(/\s+/g, ' ').slice(0, 300))).size === 4,
    anyErr: vals.some(v => /^ERR/.test(v)),
    impressumOpen: /Anschrift wird vor Veröffentlichung ergänzt/.test(texts['Impressum'] || ''),
    dsGarmin: /Garmin/.test(texts['Datenschutzerklärung'] || '') && /DSGVO/.test(texts['Datenschutzerklärung'] || ''),
    nbMed: /kein Medizinprodukt/i.test(texts['Nutzungsbedingungen'] || ''),
    ckNoTrack: /keine Tracking- oder Werbe-Cookies/i.test(texts['Cookie-/Tracking-Einstellungen'] || '') };
});
ok('LIVE KF-012 · vier Rechtstexte sind inhaltlich unterschiedlich', kf012.distinct && !kf012.anyErr);
ok('LIVE KF-012 · Inhalte treffen die tatsaechliche Verarbeitung (Garmin/DSGVO/kein Medizinprodukt/kein Tracking)',
   kf012.impressumOpen && kf012.dsGarmin && kf012.nbMed && kf012.ckNoTrack);

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close(); server.close();
console.log('\nbatch_2026_08_04: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
