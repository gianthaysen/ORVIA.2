/* ORVIA · Phase 2.0–2.5 — Metrik-Envelope: Wert · Zeitraum · Abdeckung ·
   Berechnungsgrundlage, TECHNISCH erzwungen.

   Vertrag (docs/UMSETZUNGSPLAN-2026-08.md, Phase 2):
     • Kein Wert ohne Provenienz — create() wirft ohne Methode/Version/Zeitraum.
     • Harte Einheiten = Anteil der EINHEITEN mit RPE >= 7 (RPE-Proxy); verbotene
       Bezeichnungen: „Hochintensive Minuten", „Zone 4/5", „anaerober Anteil",
       „Schwellenanteil". HF-Zonen-Datenmodell vorbereitet, aber leer.
     • TRIMP nur mit gemessenem Ruhepuls (kein Fallback); Formel, Parameter,
       Geschlechtsbehandlung und VERSION stehen in der Provenienz.
     • Bei Teilabdeckung kein Wochenmittelwert ohne Warnhinweis.
     • Easy Share: Nenner enthaelt NUR klassifizierbare Laeufe; Abdeckung im Envelope.

   node supabase/tests/phase2_envelope_test.mjs [appRoot-absolut] */
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

/* ============ 1) REIN — der Envelope-Vertrag selbst ============ */
const E = require(join(APP, 'js', 'metrics', 'metric-envelope.js'));
const P7 = { type: 'rolling', days: 7, startDate: '2026-07-29', endDate: '2026-08-04' };
const PROV = { method: 'session_rpe_hard_share', version: '1.0.0' };

const throws = fn => { try { fn(); return false; } catch (e) { return true; } };
ok('E · kein Wert ohne Zeitraum (create wirft)', throws(() => E.create({ metricId: 'x', value: 1, coverage: { eligible: 1, available: 1 }, provenance: PROV })));
ok('E · kein Wert ohne Methode (create wirft)', throws(() => E.create({ metricId: 'x', value: 1, period: P7, coverage: { eligible: 1, available: 1 }, provenance: { version: '1.0.0' } })));
ok('E · kein Wert ohne Formelversion (create wirft)', throws(() => E.create({ metricId: 'x', value: 1, period: P7, coverage: { eligible: 1, available: 1 }, provenance: { method: 'm' } })));
ok('E · kein Wert ohne Abdeckung (create wirft)', throws(() => E.create({ metricId: 'x', value: 1, period: P7, provenance: PROV })));
ok('E · available > eligible ist ein Fehler, keine 110-%-Abdeckung', throws(() => E.create({ metricId: 'x', value: 1, period: P7, coverage: { eligible: 2, available: 3 }, provenance: PROV })));

const full = E.create({ metricId: 'hard_sessions_share', value: 22, unit: '%', period: P7, coverage: { eligible: 9, available: 9 }, provenance: PROV });
ok('E · vollstaendige Abdeckung ⇒ status complete', full.status === 'complete' && full.coverage.pct === 100);
const part = E.create({ metricId: 'hard_sessions_share', value: 29, unit: '%', period: P7, coverage: { eligible: 9, available: 2 }, provenance: PROV });
ok('E · Teilabdeckung ⇒ status partial, pct korrekt', part.status === 'partial' && part.coverage.pct === 22);
const none = E.create({ metricId: 'hard_sessions_share', value: null, period: P7, coverage: { eligible: 9, available: 0 }, provenance: PROV, reason: 'kein RPE' });
ok('E · ohne auswertbare Eingaben ⇒ none + Grund, value bleibt null', none.status === 'none' && none.value === null && none.reason === 'kein RPE');
ok('E · available=0 erzwingt none auch bei uebergebenem Wert (kein Wert aus dem Nichts)',
   E.create({ metricId: 'x', value: 55, period: P7, coverage: { eligible: 3, available: 0 }, provenance: PROV }).value === null);
ok('E · Anzeigezeile entspricht dem Darstellungsvertrag',
   E.line(part, 'Einheiten') === '2 von 9 Einheiten · RPE ≥ 7 · letzte 7 Tage', E.line(part, 'Einheiten'));
const hz = E.heartRateZonesTemplate();
ok('E · HF-Zonen-Modell vorbereitet und LEER (z1–z5, source, zoneModelId = null)',
   ['z1Sec', 'z2Sec', 'z3Sec', 'z4Sec', 'z5Sec'].every(k => hz[k] === null) && hz.source === null && hz.zoneModelId === null);

/* ============ 2) QUELLE — Verdrahtung und verbotene Begriffe ============ */
const ui = R('js/ui.js'), html = R('index.html'), sw = R('sw.js');
ok('Produzenten laufen ueber den Envelope (create je Kennzahl)',
   /function gmLoadEnvelopes\(/.test(ui) && (ui.match(/E\.create\(\{metricId:/g) || []).length >= 5);
ok('gmLoadExtras ist nur noch eine Sicht auf die Envelopes',
   /Schmale Sicht fuer die bestehenden Kartenzellen/.test(ui) && /env=gmLoadEnvelopes\(\)/.test(ui));
ok('Zell-Label „Harte Einheiten" statt Zonen-Suggestion „Hochintensiv"',
   /dc\(L\.hi,'Harte Einheiten'\)/.test(ui) && !/dc\(L\.hi,'Hochintensiv'\)/.test(ui));
ok('verbotene Bezeichnungen kommen nicht vor (2.2)',
   !/Hochintensive Minuten|Zone 4\/5|anaerober Anteil|Schwellenanteil/.test(ui));
ok('TRIMP-Provenienz vollstaendig (Formel, k, HFmax-Quelle, Geschlecht, Rundung, Version)',
   /banister_trimp/.test(ui) && /maxHrSource/.test(ui) && /sexParameter/.test(ui) && /hrrClamp/.test(ui) && /version:'1\.0\.0'/.test(ui));
ok('TRIMP ohne gemessenen Ruhepuls: kein Fallback (Grund dokumentiert)',
   /ohne gemessenen Ruhepuls bzw\. HFmax kein TRIMP \(kein Fallback\)/.test(ui));
ok('Interferenz haengt am kanonischen Producer (2.4)',
   /Calc\.evaluateLoadAndInterference/.test(ui) && /load_spike_and_leg_interference/.test(ui));
ok('Teilabdeckungs-Warnzeile an der Karte (2.3: kein Wochenmittel ohne Warnhinweis)',
   /Teilabdeckung:/.test(ui) && /status==='partial'/.test(ui));
ok('Last-Sheet traegt den Berechnungsgrundlage-Block', /Berechnungsgrundlage/.test(ui) && /Metrik-Envelope v/.test(ui));
ok('easyShareDetail liefert die Abdeckung, easyShare bleibt bitgenau die Quote',
   /easyShareDetail/.test(R('js/calc.js')) && /function easyShare\(runs28\)\{return easyShareDetail\(runs28\)\.share;\}/.test(R('js/calc.js')));
ok('Envelope-Modul eingebunden und im Precache, VOR ui.js',
   /src="js\/metrics\/metric-envelope\.js"/.test(html) && /'\.\/js\/metrics\/metric-envelope\.js'/.test(sw)
   && html.indexOf('js/metrics/metric-envelope.js') < html.indexOf('js/ui.js'));
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version erhoeht (>= 224), genau einmal', swv != null && Number(swv) >= 224 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);
/* NEGATIVKONTROLLE: die alte, frei modellierte Berechnung existiert nicht mehr. */
ok('NEGATIVKONTROLLE · alte Lastgewichtung (RPE≥8/HF≥85 %) ist ersetzt',
   !/s\.rpe>=8/.test(ui) && !/0\.85\*hrMax/.test(ui));

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

const live = await page.evaluate(() => {
  const store = window.ORVIA && ORVIA.activityStore;
  const orig = store.listActivities;
  const mk = (dOff, sport, min, hr, rpe, id) => { const day = dkey(-dOff); return { id: id, sportId: sport, status: 'completed',
    startedAt: day + 'T06:00:00Z', durationSeconds: min * 60,
    summary: { avg_hr: hr, distanceKm: 8, rpe: rpe }, metrics: {} }; };
  /* 5 Einheiten: 4 mit RPE (1 hart), 1 ohne. */
  store.listActivities = () => [mk(1, 'running', 50, 145, 4, 'p1'), mk(2, 'gym', 45, 120, 6, 'p2'),
    mk(2, 'running', 40, 172, 8, 'p3'), mk(4, 'cycling', 60, 130, 5, 'p4'), mk(5, 'running', 50, 140, null, 'p5')];
  const prev = { hfMax: PROFILE.hfMax, rhrBaseline: PROFILE.rhrBaseline, age: PROFILE.age };
  PROFILE.hfMax = 190; PROFILE.rhrBaseline = 48;
  const env = gmLoadEnvelopes();
  /* Sheet-Inhalt mit denselben Daten */
  let sheetHtml = '';
  try { openLoadSheet(); sheetHtml = document.getElementById('detailSheet').innerHTML; gmCloseSheets(); } catch (e) {}
  /* Kartenzelle */
  let cardHtml = '';
  try { cardHtml = gmModLoadPro(gmDashVM()); } catch (e) {}
  /* TRIMP-Negativkontrolle: ohne gemessenen Ruhepuls */
  PROFILE.rhrBaseline = null; window._metricsResolved = { date: todayStr(), resolved: {}, entries: [] };
  const envNoRhr = gmLoadEnvelopes();
  Object.assign(PROFILE, prev);
  store.listActivities = orig;
  return {
    hard: env.hard, trimp: { status: env.trimp.status, value: env.trimp.value,
      inputs: env.trimp.provenance.inputs, assumptions: env.trimp.provenance.assumptions },
    interf: { value: env.interf && env.interf.value, method: env.interf && env.interf.provenance.method },
    sport: env.sport && { status: env.sport.status, value: env.sport.value, period: env.sport.period.type },
    schema: env.hard.schema,
    sheetHasBlock: /Berechnungsgrundlage/.test(sheetHtml),
    sheetLine: /von 5 Einheiten · RPE ≥ 7 · letzte 7 Tage/.test(sheetHtml),
    sheetWarn: /Teilabdeckung/.test(sheetHtml),
    cardLabel: /Harte Einheiten/.test(cardHtml) && !/Hochintensiv</.test(cardHtml),
    cardWarn: /Teilabdeckung:/.test(cardHtml) && /aus 4 von 5 Einheiten/.test(cardHtml),
    trimpNoRhr: { status: envNoRhr.trimp.status, value: envNoRhr.trimp.value, reason: envNoRhr.trimp.reason }
  };
});
ok('LIVE · Harte Einheiten: 1 von 4 RPE-Einheiten ⇒ 25 %, Abdeckung 4/5 = partial',
   live.hard.value === 25 && live.hard.coverage.available === 4 && live.hard.coverage.eligible === 5 && live.hard.status === 'partial',
   JSON.stringify(live.hard.coverage) + ' → ' + live.hard.value);
ok('LIVE · Envelope-Schema versioniert', /^metric-envelope@/.test(live.schema), live.schema);
ok('LIVE · TRIMP mit vollstaendiger Provenienz (Formel, Ruhepuls, HFmax-Quelle, Geschlechtsparameter)',
   live.trimp.value > 0 && live.trimp.inputs.restingHr === 48 && live.trimp.inputs.maxHr === 190
   && live.trimp.inputs.maxHrSource === 'gemessen' && /male|female/.test(live.trimp.inputs.sexParameter),
   JSON.stringify(live.trimp.inputs));
ok('LIVE · fehlendes Geschlecht ist als Annahme ausgewiesen, nicht verschwiegen',
   live.trimp.assumptions.includes('geschlecht_unbekannt_parameter_maennlich'), JSON.stringify(live.trimp.assumptions));
ok('LIVE · Interferenz aus dem kanonischen Producer', live.interf.method === 'load_spike_and_leg_interference' && live.interf.value != null, String(live.interf.value));
ok('LIVE · Sportverteilung als Envelope (Kalenderwoche)', live.sport && live.sport.period === 'calendar_week');
ok('LIVE · Karte: Label „Harte Einheiten" + Teilabdeckungs-Warnzeile', live.cardLabel && live.cardWarn);
ok('LIVE · Last-Sheet: Berechnungsgrundlage mit Darstellungsvertragszeile + Warnhinweis',
   live.sheetHasBlock && live.sheetLine && live.sheetWarn);
ok('NEGATIVKONTROLLE LIVE · ohne gemessenen Ruhepuls: TRIMP none, Wert null, Grund benannt',
   live.trimpNoRhr.status === 'none' && live.trimpNoRhr.value === null && /kein Fallback/.test(live.trimpNoRhr.reason),
   JSON.stringify(live.trimpNoRhr));

/* Easy Share: Abdeckungspfad (reine calc-Ebene, gleicher Vertrag) */
const Calc = require(join(APP, 'js', 'calc.js'));
globalThis.PROFILE = { hfMax: 190 };
const det = Calc.easyShareDetail([{ dur: 45, hr: 140, sub: '' }, { dur: 45, hr: 141, sub: '' }, { dur: 45, hr: 139, sub: '' },
  { dur: 45, hr: 142, sub: '' }, { dur: 45, hr: 165, sub: '' }, { dur: 45, hr: 168, sub: '' }, { dur: 45, hr: null, sub: '' }]);
ok('easyShareDetail · Nenner nur klassifizierbare Laeufe, Abdeckung ausgewiesen',
   Math.abs(det.share - 4 / 6) < 1e-9 && det.totalRuns === 7 && det.classifiedRuns === 6, JSON.stringify(det));
delete globalThis.PROFILE;

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close(); server.close();
console.log('\nphase2_envelope: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
