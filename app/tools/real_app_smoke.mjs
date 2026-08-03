#!/usr/bin/env node
/* ============================================================================
   GM7 · real_app_smoke.mjs — Rauch-/Regressionstest gegen die ECHTE App.

   Grundsätze (Konsequenz aus dem GM7-Audit):
   • Prüfling ist die echte Repository-index.html über einen lokalen HTTP-Server
     — NIE eine /tmp-Fixture, NIE ein künstlicher #prodScreen.
   • Echte Script-Ladereihenfolge, echte Initialisierung, echte Navigation
     (showTab / Tabbar-Klick), echte Styles, echte Renderer.
   • Semantische Assertions VOR jedem Screenshot; „—" kann keinen echten Wert
     vortäuschen (explizite Gegenproben).
   • Genau EINE dokumentierte Test-Intervention: das Auth-Gate wird geöffnet
     (die App ist by design fail-closed ohne Supabase-Konfiguration). Es wird
     kein DOM injiziert, kein CSS überschrieben, nichts maskiert.
   • CDN-Stubs (supabase-js/Chart.js) sind reine NETZWERK-Isolation für
     deterministische Läufe — keine App-Fixture; auth.js läuft seinen echten
     fail-closed-Pfad.
   • Daten: kontrollierte synthetische localStorage-Fixture (KEINE echten
     Gesundheitsdaten im Repo; das Pages-Repo ist öffentlich). Optional
     ORVIA_FIXTURE=/pfad/zu/export.json für einen lokalen Lauf mit Realdaten.

   Aufruf:  node tools/real_app_smoke.mjs [appRoot] [screenshotTag]
   ============================================================================ */
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = ['playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright',
    process.env.PLAYWRIGHT_PKG || ''].filter(Boolean);
  for (const c of candidates) { try { return require(c); } catch { } }
  throw new Error('playwright nicht auffindbar — npm i -g playwright oder PLAYWRIGHT_PKG setzen');
}
const { chromium } = loadPlaywright();

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = process.argv[2] ? normalize(process.argv[2]) : join(HERE, '..');
const TAG = process.argv[3] || 'nachher';
const SHOTS = join(HERE, 'screenshots', 'gm7');
mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

/* ---- Fixture: deterministische, klar synthetische Trainingsdaten ---- */
function todayKey(off = 0) { const d = new Date(); d.setDate(d.getDate() - off); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function buildFixture() {
  if (process.env.ORVIA_FIXTURE && existsSync(process.env.ORVIA_FIXTURE)) {
    const raw = JSON.parse(readFileSync(process.env.ORVIA_FIXTURE, 'utf8'));
    return { db: raw.DB || raw.db || raw, profile: raw.PROFILE || null, source: 'real-export (lokal, nicht im Repo)' };
  }
  const db = { _v: 2 };
  for (let i = 0; i < 30; i++) {
    const k = todayKey(i);
    db[k] = { morning: { sleepMin: 420 + (i % 3) * 20, sleepQ: 7, feel: 7, knee: 0, hrvMs: 60 + (i % 5), rhr: 50 + (i % 3), bb: 70 + (i % 20), stress: 'Low', doms: 2 } };
    if (i % 3 === 0) db[k].sessions = { Laufen: { dist: 6 + (i % 4), dur: 38 + (i % 4) * 6, rpe: 5, note: 'TESTDATEN — synthetisch' } };
    if (i % 7 === 2) db[k].sessions = { Gym: { exLog: [{ n: 'Kniebeuge', sets: 4, reps: 6, kg: 80 }, { n: 'Bankdrücken', sets: 4, reps: 8, kg: 60 }], note: 'TESTDATEN — synthetisch' } };
  }
  db[todayKey(0)].sessions = { Laufen: { dist: 12.5, dur: 82, rpe: 6, note: 'TESTDATEN — synthetisch', route: [[54.77, 9.33], [54.771, 9.335], [54.772, 9.34], [54.773, 9.336]] } };
  const profile = { v: 3, name: 'Test Athlet', goals: [{ id: 'g1', type: 'half_marathon', raceDate: todayKey(-41), targetMin: 110, priority: 'primary' }], sports: [{ sportId: 'running', level: 'advanced', role: 'primary' }, { sportId: 'strength' }], hmTargetMin: 110 };
  return { db, profile, source: 'synthetisch (deterministisch)' };
}

const fx = buildFixture();

/* ---- lokaler Server: echte Repo-Dateien; env.js bewusst unkonfiguriert ---- */
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* GM7-Smoke: bewusst unkonfiguriert — echter fail-closed-Auth-Pfad läuft */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});

const results = []; let failCount = 0;
function ok(name, cond, extra) { results.push([cond, name, extra]); if (!cond) failCount++; console.log((cond ? 'ok:  ' : 'FAIL:') + ' ' + name + (extra ? ' — ' + extra : '')); }

const consoleErrors = [];

async function run() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/index.html`;
  console.log(`Geladene URL (echte App): ${base}\nApp-Root: ${APP}\nFixture: ${fx.source}\n`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });

  /* Netzwerk-Isolation: CDNs deterministisch stubben (keine App-Fixture). */
  await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
  await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* GM7-Smoke: supabase-js gestubbt — auth.js soll seinen echten fail-closed-Pfad laufen */' }));

  await ctx.addInitScript(({ db, profile }) => {
    try { localStorage.setItem('gian_checkins_v2', JSON.stringify(db)); } catch (e) { }
    try { if (profile) localStorage.setItem('orvia_profile_v1', JSON.stringify(profile)); } catch (e) { }
    try { localStorage.setItem('orvia_ui_mode', 'profi'); } catch (e) { }
  }, { db: fx.db, profile: fx.profile });

  const page = await ctx.newPage();
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) consoleErrors.push('console.error: ' + m.text()); });

  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  // GM7.4.1: Timing-Härtung (reines Test-Harness, keine App-Logik) — auth.js gated
  // asynchron; unter Last kann das später als der feste 900ms-Wait geschehen. Statt
  // eines Race (Gate wird Momente NACH der Prüfung noch gesetzt und blendet den Rest
  // des Laufs aus) hier bis zu 4s auf die Klasse pollen, bevor sie entfernt wird.
  await page.waitForFunction(() => document.documentElement.classList.contains('orvia-gated') || document.readyState === 'complete', { timeout: 4000 }).catch(() => {});
  await page.waitForFunction(() => document.documentElement.classList.contains('orvia-gated'), { timeout: 3000 }).catch(() => {});

  /* Dokumentierte einzige Intervention: Auth-Gate öffnen (fail-closed ohne Supabase). */
  const gateLifted = await page.evaluate(() => {
    const had = document.documentElement.classList.contains('orvia-gated');
    document.documentElement.classList.remove('orvia-gated');
    document.querySelectorAll('.orvia-gate').forEach(el => el.remove());
    return had;
  });
  console.log(`Auth-Gate im Test geöffnet (einzige Intervention): ${gateLifted}\n`);
  await page.evaluate(() => { try { showTab('heute'); } catch (e) { } try { renderDay(); } catch (e) { } });
  await page.waitForTimeout(600);

  /* ---------- Tab: Dashboard (heute) ---------- */
  const heute = await page.evaluate(() => (document.querySelector('#tab-heute')?.innerText || ''));
  ok('Dashboard rendert sichtbaren Inhalt (>400 Zeichen)', heute.length > 400, `len=${heute.length}`);
  ok('Dashboard: ORVIA-Score-Hero vorhanden', /ORVIA-SCORE|DEIN SCORE/.test(heute));
  ok('Dashboard: KEINE separate Tagesentscheidung-Altkarte', await page.evaluate(() => { const el = document.getElementById('adaptBox'); return !el || !el.innerText.trim(); }));
  ok('Dashboard: Deltas vs. gestern/14-T-Ø sind echte Werte (nicht beide „—")', !/—\s*vs\. gestern/.test(heute) || /[+\-−]\d+\s*vs\./.test(heute), '');
  ok('Dashboard: Ziel-Label ist lesbar, rohe ID half_marathon erscheint NIRGENDS', !/half_marathon/.test(heute));
  ok('Dashboard: Belastungs-Beitrag als Tageslast (sRPE) ausgewiesen — nie als „ATL pro Einheit"', /Tageslast \(sRPE\)/.test(heute));

  await page.screenshot({ path: join(SHOTS, `${TAG}_dashboard_390.png`), fullPage: true });

  /* Score-Sheet öffnen (echte Interaktion) */
  await page.evaluate(() => { try { openScore(); } catch (e) { } });
  await page.waitForTimeout(350);
  const sheet = await page.evaluate(() => (document.getElementById('detailSheet')?.innerText || ''));
  ok('Score-Sheet: Aufschlüsselung mit echten Beiträgen (+n)', /\+\d+/.test(sheet), sheet.slice(0, 60));
  await page.screenshot({ path: join(SHOTS, `${TAG}_score_sheet_390.png`) });
  await page.evaluate(() => { try { gmCloseSheets(); } catch (e) { } });

  /* ---------- Tab: Aktivität (der frühere Totalausfall) ---------- */
  await page.evaluate(() => { try { showTab('akt'); } catch (e) { } });
  await page.waitForTimeout(600);
  const akt = await page.evaluate(() => ({
    gm: document.getElementById('gmAkt')?.innerHTML.length || 0,
    txt: document.querySelector('#tab-akt')?.innerText || '',
    visible: (() => { const el = document.getElementById('gmAkt'); if (!el) return false; const r = el.getBoundingClientRect(); return r.height > 100; })()
  }));
  ok('AKTIVITÄT: #gmAkt ist gefüllt (Totalausfall behoben)', akt.gm > 500, `html=${akt.gm}`);
  ok('AKTIVITÄT: Host ist sichtbar (height>100px)', akt.visible);
  ok('AKTIVITÄT: Hero „Training starten" vorhanden', /Training starten/.test(akt.txt));
  ok('AKTIVITÄT: Wochendistanz zeigt echten Wert (12,5-km-Fixture-Lauf zählt)', /\d+[\.,]?\d*\s*km/.test(akt.txt));
  ok('REGRESSION „—"≠Wert: Distanz-KPI ist nicht „—"', !/DISTANZ[\s\S]{0,12}^—$/m.test(akt.txt));
  ok('AKTIVITÄT: kanonischer Renderer aktiv (ORVIA.activity.render === renderAkt-Pfad)',
    await page.evaluate(() => typeof ORVIA !== 'undefined' && ORVIA.activity && typeof ORVIA.activity.render === 'function'));
  await page.screenshot({ path: join(SHOTS, `${TAG}_aktivitaet_390.png`), fullPage: true });

  /* GM7.2: Monat-Umschalter — darf bei vorhandenen Aktivitäten nicht komplett „—" sein */
  await page.evaluate(() => { try { gmSetActScope('month'); } catch (e) { } });
  await page.waitForTimeout(400);
  const monat = await page.evaluate(() => (document.querySelector('#tab-akt')?.innerText || ''));
  const monatDash = (monat.match(/—/g) || []).length;
  ok('AKTIVITÄT Monat: nicht komplett „—" (Einheiten/Distanz gefüllt)', /EINHEITEN[\s\S]{0,60}\d/.test(monat) || /\d+[\.,]?\d*\s*km[\s\S]{0,20}DISTANZ/i.test(monat), `dashCount=${monatDash}`);
  /* Woche ≠ Monat: nachweislich unterschiedliche Aggregationsfenster (Verhalten, kein String) */
  const windows = await page.evaluate(() => {
    const w = (typeof gmActPeriodTotals === 'function') ? gmActPeriodTotals('week') : null;
    const m = (typeof gmActPeriodTotals === 'function') ? gmActPeriodTotals('month') : null;
    return { wWeeks: w && w.weeks, mWeeks: m && m.weeks, wCnt: w && w.totals && w.totals.sessionCount, mCnt: m && m.totals && m.totals.sessionCount };
  });
  ok('AKTIVITÄT: Woche(1 Wo)≠Monat(4 Wo) — unterschiedliche Fenster', windows.wWeeks === 1 && windows.mWeeks === 4, JSON.stringify(windows));
  ok('AKTIVITÄT: Monatsfenster ≥ Wochenfenster (mehr/ gleich Einheiten)', windows.mCnt >= windows.wCnt, JSON.stringify(windows));
  await page.screenshot({ path: join(SHOTS, `${TAG}_aktivitaet_monat_390.png`), fullPage: true });
  await page.evaluate(() => { try { gmSetActScope('week'); } catch (e) { } });

  /* ---------- Dediziertes Last-Sheet (Anschlussfehler-Regression) ---------- */
  await page.evaluate(() => { try { showTab('heute'); openMetric('load'); } catch (e) { } });
  await page.waitForTimeout(400);
  const loadSheet = await page.evaluate(() => (document.getElementById('detailSheet')?.innerText || ''));
  ok('LAST-SHEET: nutzt dieselbe Serie wie die Übersicht (kein „keine Serie gespeichert")', !/keine Serie gespeichert/.test(loadSheet), loadSheet.slice(0, 50));
  ok('LAST-SHEET: zeigt CTL/ATL + 1M/3M/6M-Umschalter', /CTL/.test(loadSheet) && /1M/.test(loadSheet));
  await page.screenshot({ path: join(SHOTS, `${TAG}_last_sheet_390.png`) });
  await page.evaluate(() => { try { gmCloseSheets(); } catch (e) { } });

  /* ---------- Erholung-Sheet (Composite) ---------- */
  await page.evaluate(() => { try { openRecoverySheet(); } catch (e) { } });
  await page.waitForTimeout(300);
  const recSheet = await page.evaluate(() => (document.getElementById('detailSheet')?.innerText || ''));
  ok('ERHOLUNG-SHEET: Composite-Erklärung + HRV/Ruhepuls/Schlaf', /Composite|kombiniert HRV/.test(recSheet));
  await page.evaluate(() => { try { gmCloseSheets(); } catch (e) { } });

  /* ---------- GM7.4 · Serien-Anzeige (Hypnogramm/Intraday) aus user_metric_series ---------- */
  {
    const e2e = JSON.parse(readFileSync(join(APP, 'supabase', 'tests', 'fixtures', 'series_e2e.json'), 'utf8'));
    const seriesRows = e2e.series_rows.map(r => ({ metric_type: r.metric_type, metric_date: todayKey(0), unit: r.unit, points: r.points }));
    // Test-Fetch injizieren (read-only Reader-Pfad; kein Supabase nötig)
    await page.evaluate((rows) => { window.__ORVIA_TEST_SERIES_FETCH = (mt) => Promise.resolve(rows.filter(r => r.metric_type === mt)); }, seriesRows);
    // Schlaf-Sheet öffnen → echtes Hypnogramm
    await page.evaluate(() => { try { openMetric('sleep_duration_min'); } catch (e) { } });
    await page.waitForTimeout(300);
    const hyp1 = await page.evaluate(() => { const el = document.getElementById('gmHypnoSlot'); return { rects: el ? el.querySelectorAll('svg rect').length : -1, svgs: el ? el.querySelectorAll('svg').length : -1 }; });
    ok('SERIES: Hypnogramm rendert echte Segmente (SVG rects > 10)', hyp1.rects > 10, JSON.stringify(hyp1));
    // Erneut öffnen → keine DOM-Akkumulation (genau EIN svg im Slot)
    await page.evaluate(() => { try { gmCloseSheets(); openMetric('sleep_duration_min'); } catch (e) { } });
    await page.waitForTimeout(300);
    const hyp2 = await page.evaluate(() => { const el = document.getElementById('gmHypnoSlot'); return el ? el.querySelectorAll('svg').length : -1; });
    ok('SERIES: mehrfaches Öffnen ⇒ keine DOM-Akkumulation (genau 1 SVG)', hyp2 === 1, `svgs=${hyp2}`);
    // Stress-Sheet → Intraday-Kurve
    await page.evaluate(() => { try { gmCloseSheets(); openMetric('stress_avg'); } catch (e) { } });
    await page.waitForTimeout(300);
    const intr = await page.evaluate(() => { const el = document.getElementById('gmStressIntraSlot'); return el ? /<path d="M/.test(el.innerHTML) : false; });
    ok('SERIES: Intraday-Stresskurve rendert echten Pfad', intr === true);
    // Missingness: leere Serie ⇒ ehrlicher Leerzustand, KEINE 0, kein SVG
    await page.evaluate(() => { window.__ORVIA_TEST_SERIES_FETCH = () => Promise.resolve([]); });
    await page.evaluate(() => { try { gmCloseSheets(); openMetric('sleep_duration_min'); } catch (e) { } });
    await page.waitForTimeout(300);
    const miss = await page.evaluate(() => { const el = document.getElementById('gmHypnoSlot'); return { svgs: el ? el.querySelectorAll('svg').length : -1, txt: el ? el.textContent : '' }; });
    ok('SERIES: fehlende Serie ⇒ Leerzustand (kein SVG, kein „0")', miss.svgs === 0 && /nicht verfügbar|kein zeitlicher Verlauf/i.test(miss.txt), JSON.stringify(miss).slice(0, 120));
    // kein horizontaler Overflow bei geöffnetem Sheet (320/390/430)
    await page.evaluate(() => { window.__ORVIA_TEST_SERIES_FETCH = undefined; try { gmCloseSheets(); } catch (e) { } });
  }

  /* ---------- GM7.4.1 · zusätzliche real angebundene Serien (Nachtverlauf/HRV/BB/Streams) ---------- */
  {
    const e2e = JSON.parse(readFileSync(join(APP, 'supabase', 'tests', 'fixtures', 'series_e2e.json'), 'utf8'));
    const rowsToday = e2e.series_rows.map(r => ({ metric_type: r.metric_type, metric_date: todayKey(0), unit: r.unit, points: r.points }));
    await page.evaluate((rows) => { window.__ORVIA_TEST_SERIES_FETCH = (mt) => Promise.resolve(rows.filter(r => r.metric_type === mt)); }, rowsToday);

    // Schlaf-Sheet: Nachtverlauf HF/Stress/Body-Battery/Atmung — alle 4 echt gerendert.
    await page.evaluate(() => { try { openMetric('sleep_duration_min'); } catch (e) { } });
    await page.waitForTimeout(350);
    const night = await page.evaluate(() => ({
      hr: /<path d="M/.test(document.getElementById('gmSleepHrSlot')?.innerHTML || ''),
      stress: /<path d="M/.test(document.getElementById('gmSleepStressSlot')?.innerHTML || ''),
      bb: /<path d="M/.test(document.getElementById('gmSleepBbSlot')?.innerHTML || ''),
      resp: /<path d="M/.test(document.getElementById('gmSleepRespSlot')?.innerHTML || ''),
    }));
    ok('SERIES: Schlaf-Nachtverlauf HF rendert echten Pfad', night.hr, JSON.stringify(night));
    ok('SERIES: Schlaf-Nachtverlauf Stress rendert echten Pfad', night.stress, JSON.stringify(night));
    ok('SERIES: Schlaf-Nachtverlauf Body Battery rendert echten Pfad', night.bb, JSON.stringify(night));
    ok('SERIES: Schlaf-Nachtverlauf Atmung rendert echten Pfad', night.resp, JSON.stringify(night));
    await page.screenshot({ path: join(SHOTS, `${TAG}_schlaf_nachtverlauf_390.png`), fullPage: true });

    // HRV-Sheet: echte nächtliche HRV-Kurve zusätzlich zur 14-Tage-Skalarserie.
    await page.evaluate(() => { try { gmCloseSheets(); openMetric('hrv_ms'); } catch (e) { } });
    await page.waitForTimeout(300);
    const hrvNight = await page.evaluate(() => /<path d="M/.test(document.getElementById('gmHrvNightSlot')?.innerHTML || ''));
    ok('SERIES: HRV-Sheet nächtlicher Verlauf rendert echten Pfad', hrvNight);

    // Body-Battery-Sheet: echte Intraday-Kurve.
    await page.evaluate(() => { try { gmCloseSheets(); openMetric('body_battery'); } catch (e) { } });
    await page.waitForTimeout(300);
    const bbIntra = await page.evaluate(() => /<path d="M/.test(document.getElementById('gmBbIntraSlot')?.innerHTML || ''));
    ok('SERIES: Body-Battery-Sheet Intraday-Kurve rendert echten Pfad', bbIntra);

    // Overflow-Check bei deutlich mehr Sheet-Inhalt (4 neue Kurven) auf allen 3 Breiten.
    await page.evaluate(() => { try { gmCloseSheets(); openMetric('sleep_duration_min'); } catch (e) { } });
    await page.waitForTimeout(300);
    for (const w of [320, 390, 430]) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.waitForTimeout(120);
      const of = await page.evaluate(() => { const el = document.getElementById('detailSheet'); return el ? el.scrollWidth - el.clientWidth : 0; });
      ok(`SERIES: Schlaf-Sheet (Nachtverlauf) kein horizontaler Overflow @${w}px`, of <= 1, `overflow=${of}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { try { gmCloseSheets(); } catch (e) { } });

    // Aktivitätsdetail: echte Garmin-Streams (HF/Geschwindigkeit/Höhe/Kadenz) rendern
    // im echten Production-Renderer (gmOpenActivityPage), nicht im Test-Stub.
    const streams = e2e.activity_metrics.streams, units = e2e.activity_metrics.stream_units;
    const started = new Date(); started.setHours(started.getHours() - 1);
    const injected = await page.evaluate(({ streams, units, startedIso }) => {
      try {
        if (!(window.ORVIA && ORVIA.activityStore && ORVIA.activityStore.mergeServerActivities)) return { ok: false, reason: 'no_store' };
        ORVIA.activityStore.mergeServerActivities([{
          id: 'gm741-test-activity', source: 'garmin', source_record_id: 'GM741TEST',
          sport_id: 'running', started_at: startedIso, duration_seconds: 2400,
          status: 'completed', summary: { avg_hr: 140 },
          metrics: { training_load: 120, route: [[54.7, 9.3], [54.71, 9.31]], hasRoute: true, streams, stream_units: units },
        }]);
        const acts = (typeof listActivitiesUnified === 'function') ? listActivitiesUnified(40) : [];
        const found = acts.find(a => a && a.sourceRecordId === 'GM741TEST');
        return { ok: !!found, id: found ? (found.clientRecordId || found.id) : null };
      } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    }, { streams, units, startedIso: started.toISOString() });
    ok('SERIES: synthetische Garmin-Aktivität mit metrics.streams injiziert', injected.ok, JSON.stringify(injected));
    if (injected.ok && injected.id) {
      await page.evaluate((id) => { try { gmOpenActivityPage(id); } catch (e) { } }, injected.id);
      await page.waitForTimeout(300);
      const actCurves = await page.evaluate(() => {
        const t = document.getElementById('gmActPage')?.innerText || '';
        const html = document.getElementById('gmActPage')?.innerHTML || '';
        return { hasTitle: /Aktivitäts-Messreihen/.test(t), paths: (html.match(/<path d="M/g) || []).length, mentionsPace: /Tempo \(m\/s\)|km\/h.*Tempo/.test(t) };
      });
      ok('AKTIVITÄTSDETAIL: Messreihen-Karte vorhanden', actCurves.hasTitle, JSON.stringify(actCurves));
      ok('AKTIVITÄTSDETAIL: mind. 2 echte Stream-Kurven gerendert (HF+Geschwindigkeit/Höhe/Kadenz)', actCurves.paths >= 2, JSON.stringify(actCurves));
      ok('AKTIVITÄTSDETAIL: Geschwindigkeit (mps) nicht als „Tempo" fehlbeschriftet', !actCurves.mentionsPace, JSON.stringify(actCurves));
      await page.screenshot({ path: join(SHOTS, `${TAG}_aktivitaet_streams_390.png`), fullPage: true });
      await page.evaluate(() => { try { gmCloseActivityPage(); } catch (e) { } });
    }
    await page.evaluate(() => { window.__ORVIA_TEST_SERIES_FETCH = undefined; });
  }

  /* ---------- Icons: Dashboard-Tab kein Haus mehr ---------- */
  const iconOk = await page.evaluate(() => {
    const b = document.querySelector('.tabwrap button[data-tab="heute"] use');
    return b ? (b.getAttribute('href') || b.getAttribute('xlink:href') || '') : '';
  });
  ok('ICON: Dashboard-Tab nutzt GM-Grid (nicht #i-home)', iconOk === '#i-nav-dash', `href=${iconOk}`);

  /* ---------- Aura im Hero ---------- */
  const aura = await page.evaluate(() => { const a = document.querySelector('.hero-aura'); return a ? a.getAttribute('data-aura') : null; });
  ok('HERO: Ambient-Aura vorhanden (status-getönt)', aura !== null, `aura=${aura}`);

  /* ---------- GM7.4 · P0 explizite Vorher/Nachher-Geometrie ---------- */
  const p0 = await page.evaluate(() => {
    const rect = (el) => el ? el.getBoundingClientRect() : null;
    const ring = document.querySelector('.ring-wrap'); const pill = document.querySelector('.statuspill');
    const hero = document.querySelector('.hero'); const rr = rect(ring), pr = rect(pill), hr = rect(hero);
    const mods = Array.from(document.querySelectorAll('#tab-heute .card, #tab-heute .mod-wide, #tab-heute .kcard'));
    const mod = hr ? mods.find(c => rect(c).top > hr.bottom - 4 && rect(c).width > 120) : null; const mr = rect(mod);
    const auraEl = document.querySelector('.hero-aura'); const auraV = auraEl && auraEl.getAttribute('data-aura');
    const pillCls = pill ? (Array.from(pill.classList).find(c => c.indexOf('sp-') === 0) || '') : '';
    // Doppelte Tagesentscheidung: exakt eine sichtbare Empfehlungs-/CTA-Zeile im Hero.
    const recos = document.querySelectorAll('#tab-heute .hero .reco');
    return {
      pillInRing: (rr && pr) ? (pr.left >= rr.left - 1 && pr.right <= rr.right + 1) : null,
      heroLeft: hr ? Math.round(hr.left) : null, heroW: hr ? Math.round(hr.width) : null,
      modLeft: mr ? Math.round(mr.left) : null, modW: mr ? Math.round(mr.width) : null,
      auraV, pillStatus: pillCls.replace('sp-', ''), recoCount: recos.length
    };
  });
  ok('P0 Pill („Reduzieren empfohlen") liegt vollständig im Score-Ring (kein Overflow)', p0.pillInRing === true, JSON.stringify(p0));
  ok('P0 Hero und erstes Modul teilen dieselbe horizontale Achse (Left±2, Breite±2)',
    p0.heroLeft != null && p0.modLeft != null && Math.abs(p0.heroLeft - p0.modLeft) <= 2 && Math.abs(p0.heroW - p0.modW) <= 2,
    `hero[${p0.heroLeft},${p0.heroW}] mod[${p0.modLeft},${p0.modW}]`);
  ok('P0 Aura-Ton entspricht dem Status-Pill (data-aura ↔ sp-<status>)',
    p0.auraV != null && (p0.auraV === p0.pillStatus || (p0.auraV === 'neutral' && !p0.pillStatus)), `aura=${p0.auraV} pill=${p0.pillStatus}`);
  ok('P0 Genau EINE Tagesentscheidung im Hero (keine doppelte/alte Karte)', p0.recoCount === 1, `recoCount=${p0.recoCount}`);

  /* ---------- GM7.4-A · Heute-Guard (Verhalten, kein String-Match) ---------- */
  const guard = await page.evaluate(() => {
    const t = (typeof todayStr === 'function') ? todayStr() : null;
    const g = (o) => (typeof gmStandLbl === 'function') ? gmStandLbl(o) : 'NOFN';
    return {
      today: g({ value: 5, metricDate: t }),
      old: g({ value: 5, metricDate: '2020-01-01' }),
      nullVal: g({ value: null, valueText: null, metricDate: t }),
      hasToday: (typeof gmMetricToday === 'function')
    };
  });
  ok('GM7.4-A Heute-Guard: heutiges metricDate ⇒ „heute"', guard.today === 'heute', JSON.stringify(guard));
  ok('GM7.4-A Heute-Guard: älteres metricDate ⇒ NICHT „heute" (Stand-Datum)', typeof guard.old === 'string' && guard.old.indexOf('Stand') === 0, `old=${guard.old}`);
  ok('GM7.4-A Heute-Guard: fehlender Wert ⇒ null (kein Label)', guard.nullVal === null, `nullVal=${guard.nullVal}`);
  ok('GM7.4-A gmMetricToday-Helfer vorhanden', guard.hasToday === true);

  /* ---------- GM7.4-2 · Group-1-Verdrahtung (Verhalten, kein String-Match) ---------- */
  const g1 = await page.evaluate(() => {
    const ids = ['training_readiness', 'acute_load', 'load_ratio', 'endurance_score', 'running_tolerance', 'fitness_age', 'vo2max_cycling', 'recovery_time_h', 'respiration_avg', 'vo2max_running'];
    const defs = ids.filter((id) => typeof GM_METRIC_DEFS !== 'undefined' && GM_METRIC_DEFS[id] && GM_METRIC_DEFS[id].label).length;
    const inRcv = (typeof GM_RCV_TILES !== 'undefined') ? GM_RCV_TILES.filter((t) => ['training_readiness', 'acute_load', 'load_ratio'].indexOf(t.id) >= 0).length : -1;
    return { defs, inRcv, total: ids.length };
  });
  ok('GM7.4-2 Group-1: alle Metriken haben ein Detail-Sheet-Def (openMetric)', g1.defs === g1.total, JSON.stringify(g1));
  ok('GM7.4-2 Group-1: load_recovery-Kacheln im Erholungsraster vorhanden', g1.inRcv === 3, `inRcv=${g1.inRcv}`);

  /* ---------- Tab: Plan ---------- */
  await page.evaluate(() => { try { showTab('plan'); } catch (e) { } });
  await page.waitForTimeout(500);
  const plan = await page.evaluate(() => (document.querySelector('#tab-plan')?.innerText || ''));
  ok('PLAN rendert Inhalt', plan.length > 300, `len=${plan.length}`);
  ok('REGRESSION 2953: keine 4-stellige Wochenzahl in Phasen', !/\d{4}\s*Wo/.test(plan));
  ok('PLAN: Session-Karten tragen Umfang (min/km/m) im Untertitel', /(min|km|m)\b/.test(plan));
  await page.screenshot({ path: join(SHOTS, `${TAG}_plan_390.png`), fullPage: true });

  /* ---------- Tab: Analyse (dash) ---------- */
  await page.evaluate(() => { try { showTab('dash'); } catch (e) { } });
  await page.waitForTimeout(700);
  const ana = await page.evaluate(() => (document.querySelector('#tab-dash')?.innerText || ''));
  ok('ANALYSE rendert Inhalt', ana.length > 300, `len=${ana.length}`);
  ok('ANALYSE: CTL als sRPE-Skala ausgewiesen', /sRPE/.test(ana));
  ok('ANALYSE: Wettkampfprognose vorhanden und als Prognose gekennzeichnet', /Prognose/.test(ana));
  /* Körper-Segment: anatomische Karte */
  await page.evaluate(() => { try { gmSetAnaSeg('body'); } catch (e) { } });
  /* Volumen-Pipeline hat echte async Quellen (Offline-Timeouts) — bis 10 s auf das Modell warten */
  let bodySvg = { anat: false, polys: 0, blocks: 0 };
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(900);
    bodySvg = await page.evaluate(() => ({ anat: !!document.querySelector('.bodysvg.anat'), polys: document.querySelectorAll('.bodysvg.anat polygon').length, blocks: document.querySelectorAll('.bodysvg rect').length, state: window._gmMvState === undefined ? 'undef' : window._gmMvState }));
    if (bodySvg.anat || bodySvg.state === 'error') break;
  }
  ok('KÖRPER: anatomische Karte aktiv (Polygone, keine Blockfigur)', bodySvg.anat && bodySvg.polys > 20 && bodySvg.blocks === 0, JSON.stringify(bodySvg));
  await page.screenshot({ path: join(SHOTS, `${TAG}_analyse_koerper_390.png`), fullPage: true });
  await page.evaluate(() => { try { gmSetAnaSeg('overview'); } catch (e) { } });

  /* ---------- Tab: Profil ---------- */
  await page.evaluate(() => { try { openProfile(); } catch (e) { } });
  await page.waitForTimeout(500);
  const prof = await page.evaluate(() => (document.getElementById('gmProf')?.innerText || ''));
  ok('PROFIL rendert Inhalt', prof.length > 200, `len=${prof.length}`);
  ok('PROFIL: Einheiten-KPI zeigt echte Gesamtzahl (nicht „—")', /\d+\s*\n?\s*Einheiten/.test(prof), '');
  ok('PROFIL: Fitness-KPI mit sRPE-Skala beschriftet', /Fitness \(sRPE\)/.test(prof));
  await page.screenshot({ path: join(SHOTS, `${TAG}_profil_390.png`), fullPage: true });

  /* ---------- Desktop 1440: Profilbreite + FAB ---------- */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  const desk = await page.evaluate(() => {
    const tm = document.getElementById('tab-mehr'); const r = tm ? tm.getBoundingClientRect() : null;
    const fab = document.getElementById('navPlus'); const fr = fab ? fab.getBoundingClientRect() : null;
    const wrap = document.querySelector('.tabwrap'); const wr = wrap ? wrap.getBoundingClientRect() : null;
    return { tabMehrWidth: r ? Math.round(r.width) : null, tabMehrLeft: r ? Math.round(r.left) : null,
      fabRight: fr ? Math.round(window.innerWidth - fr.right) : null, barRight: wr ? Math.round(window.innerWidth - wr.right) : null, vw: window.innerWidth };
  });
  ok('DESKTOP: Profil ist zentrierte 430-px-Spalte (kein Vollbild)', desk.tabMehrWidth !== null && desk.tabMehrWidth <= 434, JSON.stringify(desk));
  ok('DESKTOP: Profil zentriert (left>300px bei 1440)', desk.tabMehrLeft !== null && desk.tabMehrLeft > 300, `left=${desk.tabMehrLeft}`);
  ok('DESKTOP: FAB sitzt an der App-Spalte, nicht am Viewport-Rand (Abstand≈Bar)', desk.fabRight !== null && desk.fabRight > 400, `fabRight=${desk.fabRight}, barRight=${desk.barRight}`);
  await page.screenshot({ path: join(SHOTS, `${TAG}_profil_1440.png`) });

  /* ---------- Responsive: kein horizontaler Overflow bei 320/390/430 über alle Tabs ---------- */
  for (const w of [320, 390, 430]) {
    await page.setViewportSize({ width: w, height: 850 });
    for (const tb of ['heute', 'plan', 'akt', 'dash']) {
      await page.evaluate((t) => { try { showTab(t); } catch (e) { } }, tb);
      await page.waitForTimeout(200);
      const ov = await page.evaluate(() => {
        const de = document.scrollingElement || document.documentElement;
        return { over: de.scrollWidth - de.clientWidth, sw: de.scrollWidth, cw: de.clientWidth };
      });
      ok(`RESPONSIVE ${w}px/${tb}: kein horizontaler Overflow`, ov.over <= 1, `scrollW=${ov.sw} clientW=${ov.cw}`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { try { showTab('heute'); } catch (e) { } });

  /* ---------- Konsole ---------- */
  ok('Keine ungefangenen JS-Fehler / console.error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await browser.close(); server.close();
  const passed = results.filter(r => r[0]).length;
  console.log(`\nreal_app_smoke [${TAG}]: Bestanden: ${passed}/${results.length}` + (failCount ? ` — ${failCount} FEHLGESCHLAGEN` : ''));
  console.log(`Screenshots: ${SHOTS}/${TAG}_*.png (echte App, URL oben dokumentiert)`);
  process.exit(failCount ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
