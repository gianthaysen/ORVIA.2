/* ORVIA · Nutzer-Feedback-Runde 2026-08-05 (Teil B) — die vier zuletzt umgesetzten Punkte.

   Geprueft wird jeweils die ZUSAGE, nicht die Implementierung:
     1. Nebensportarten erscheinen so oft, wie im Profil hinterlegt (gemeldet: „kein
        Fahrradfahren im Plan", obwohl Rad im Profil steht).
     2. Die gewuenschte EINHEITENZAHL wird erreicht, nicht nur die Tageszahl
        (gemeldet: „ich will zehn Einheiten, habe sieben").
     3. Ruhetage bleiben dabei unangetastet.
     4. Bestzeiten entstehen aus ABSCHNITTEN laengerer Einheiten (gemeldet: 25:50 fuer
        5 km lag in einem 7-km-Lauf und wurde nicht gefunden) — und zwar konservativ.
     5. Die ergaenzten Meilenstein-Leitern rechnen aus echten Aktivitaeten.

   node supabase/tests/feedback_2026_08_05b_test.mjs [appRoot-absolut] */
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
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 60 - t.length)));

/* ============ 1) Meilenstein-Leitern (rein, ohne Browser) ============ */
sec('Meilensteine · ergaenzte Leitern rechnen aus echten Aktivitaeten');
{
  const A = require(join(APP, 'js/achievements.js'));
  const ids = A.LADDERS.map(l => l.id);
  ['run_total_km', 'ride_week_km', 'swim_longest', 'gym_sessions'].forEach(id =>
    ok('Leiter vorhanden: ' + id, ids.indexOf(id) >= 0));
  ok('bestehende Leitern unveraendert erhalten',
     ['run_longest', 'run_week_km', 'ride_longest', 'sessions_total', 'week_streak'].every(id => ids.indexOf(id) >= 0));

  const mk = (sp, day, km) => ({ sportId: sp, startedAt: day + 'T10:00:00Z', status: 'completed', summary: km != null ? { distanceKm: km } : {} });
  const acts = [];
  for (let i = 0; i < 30; i++) acts.push(mk('running', new Date(Date.UTC(2026, 4, 1 + i * 2)).toISOString().slice(0, 10), 10));
  for (let i = 0; i < 12; i++) acts.push(mk('cycling', new Date(Date.UTC(2026, 4, 2 + i * 3)).toISOString().slice(0, 10), 45));
  for (let i = 0; i < 5; i++) acts.push(mk('swimming', new Date(Date.UTC(2026, 5, 1 + i * 4)).toISOString().slice(0, 10), 1.2));
  for (let i = 0; i < 30; i++) acts.push(mk('gym', new Date(Date.UTC(2026, 4, 1 + i)).toISOString().slice(0, 10), null));
  const r = A.computeAchievements(acts);
  const by = {}; r.milestones.forEach(m => { by[m.id] = m; });

  ok('run_total_km summiert kumuliert (30 × 10 km = 300)', by.run_total_km && by.run_total_km.current === 300, String(by.run_total_km && by.run_total_km.current));
  ok('gym_sessions zaehlt NUR Gym (30), nicht sportuebergreifend', by.gym_sessions && by.gym_sessions.current === 30, String(by.gym_sessions && by.gym_sessions.current));
  ok('swim_longest nimmt die laengste Einheit (1,2 km)', by.swim_longest && Math.abs(by.swim_longest.current - 1.2) < 0.05, String(by.swim_longest && by.swim_longest.current));
  ok('ride_week_km bildet einen Wochenumfang (> 0)', by.ride_week_km && by.ride_week_km.current > 0, String(by.ride_week_km && by.ride_week_km.current));
  ok('jede erreichte Stufe traegt ein Datum (Beleg, keine Behauptung)',
     r.medals.length > 0 && r.medals.every(m => !!m.date), r.medals.length + ' Medaillen');
  /* Negativkontrolle: ohne Aktivitaeten darf keine Leiter einen Wert erfinden. */
  const empty = A.computeAchievements([]);
  ok('ohne Aktivitaeten: keine Medaille, alle Istwerte 0 (nichts erfunden)',
     empty.medals.length === 0 && empty.milestones.every(m => m.current === 0));
}

/* ============ 2) Bestzeiten aus Abschnitten (rein) ============ */
sec('Bestzeiten · Abschnitt aus laengerer Einheit');
{
  const R = require(join(APP, 'js/run-bests.js'));
  /* 7-km-Lauf, zeitbasierte Abtastung (1 Sample/s) wie bei Garmin ueblich:
     erste 5 km in 25:50, letzte 2 km locker. KEINE Runden, KEINE Zeitachse. */
  const dist = []; let d = 0;
  for (let t = 0; t <= 1550; t++) { dist.push(d); d += 5000 / 1550; }
  for (let t = 1; t <= 720; t++) { d += 2000 / 720; dist.push(d); }
  const act = { sportId: 'running', status: 'completed', startedAt: '2026-08-01T09:00:00Z',
    durationSeconds: 2270, summary: { distanceKm: 7.0 }, metrics: { streams: { distance: dist } } };
  const r = R.measuredRunBests([act]);
  ok('5 km wird aus dem 7-km-Lauf gefunden (vorher: gar nicht)', r.k5 != null, r.k5 ? Math.round(r.k5.sec) + ' s' : 'null');
  ok('die gefundene Zeit entspricht dem tatsaechlichen Abschnitt (~25:50)',
     r.k5 && Math.abs(r.k5.sec - 1550) <= 20, r.k5 ? Math.floor(r.k5.sec / 60) + ':' + String(Math.round(r.k5.sec % 60)).padStart(2, '0') : '—');
  ok('die Herkunft ist als abgeleitet gekennzeichnet, NICHT als Rundenmessung',
     r.k5 && r.k5.method === 'stream_uniform', r.k5 && r.k5.method);
  ok('10 km wird korrekt NICHT erfunden (nur 7 km gelaufen)', r.k10 == null);
  ok('Diagnosezaehler belegen die Datenlage', r.scanned === 1 && r.withStreams === 1 && r.withDerivedTime === 1,
     JSON.stringify({ scanned: r.scanned, splits: r.withSplits, streams: r.withStreams, derived: r.withDerivedTime }));

  /* KONSERVATIVITAET: Die Gesamtdauer inkl. Pausen wird verteilt. Traegt die Aktivitaet
     eine laengere Dauer (Stehzeit), MUSS der Abschnitt langsamer ausfallen — nie schneller. */
  const withPause = Object.assign({}, act, { durationSeconds: 2270 + 600 });
  const r2 = R.measuredRunBests([withPause]);
  ok('mehr Gesamtdauer (Pausen) ⇒ Abschnittszeit wird LANGSAMER, nie schneller',
     r2.k5 && r.k5 && r2.k5.sec > r.k5.sec, (r.k5 && Math.round(r.k5.sec)) + ' s → ' + (r2.k5 && Math.round(r2.k5.sec)) + ' s');

  /* VORRANG: Eine echte Rundenmessung schlaegt die Annahme — auch wenn sie langsamer ist. */
  const withLaps = Object.assign({}, act, { metrics: { streams: { distance: dist },
    splits: [{ distance: 1000, duration: 330 }, { distance: 1000, duration: 330 }, { distance: 1000, duration: 330 },
             { distance: 1000, duration: 330 }, { distance: 1000, duration: 330 }, { distance: 2000, duration: 720 }] } });
  const r3 = R.measuredRunBests([withLaps]);
  ok('echte Runden gewinnen gegen die abgeleitete Zeitachse (Messung vor Annahme)',
     r3.k5 && r3.k5.method === 'lap_window', r3.k5 && r3.k5.method + ' ' + Math.round(r3.k5.sec) + ' s');

  /* Ohne Distanzreihe UND ohne Runden darf nichts entstehen. */
  const bare = { sportId: 'running', status: 'completed', startedAt: '2026-08-02T09:00:00Z',
    durationSeconds: 2270, summary: { distanceKm: 7.0 }, metrics: {} };
  const r4 = R.measuredRunBests([bare]);
  ok('ohne Runden UND ohne Messreihe entsteht KEINE 5-km-Messung (keine Hochrechnung)', r4.k5 == null);
}

/* ============ 3) Wochenplan im echten Browser ============ */
sec('Wochenplan · Sportarten-Haeufigkeit und Einheitenzahl aus dem Profil');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1300);

const plan = await page.evaluate(() => {
  PROFILE.sports = [
    { sportId: 'running', sessionsPerWeek: 4, activeInApp: true },
    { sportId: 'gym', sessionsPerWeek: 3, activeInApp: true },
    { sportId: 'cycling', sessionsPerWeek: 3, activeInApp: true }];
  PROFILE.availability = { days: { mo: { available: true }, di: { available: true }, mi: { available: true },
    do: { restDay: true }, fr: { available: true }, sa: { available: true }, so: { available: true } } };
  const p = generateWeekPlan();
  const cnt = {}; let total = 0; const maxPerDay = [];
  (p || []).forEach(day => { maxPerDay.push((day || []).length);
    (day || []).forEach(it => { cnt[it.t] = (cnt[it.t] || 0) + 1; total++; }); });
  /* Kein Tag darf zwei Einheiten DERSELBEN Sportart tragen. */
  const dupSameSport = (p || []).some(day => {
    const seen = {}; return (day || []).some(it => { if (seen[it.t]) return true; seen[it.t] = 1; return false; }); });
  return { total, cnt, restDayEmpty: ((p && p[3]) || []).length === 0,
    maxPerDay: Math.max.apply(null, maxPerDay), dupSameSport };
});
ok('Rad erscheint so oft wie im Profil hinterlegt (3×), nicht mehr fix 1×',
   plan.cnt['Rad'] === 3, JSON.stringify(plan.cnt));
ok('die gewuenschte EINHEITENZAHL wird erreicht (10), nicht nur die Tageszahl',
   plan.total === 10, plan.total + ' Einheiten');
ok('jede Sportart trifft ihre Wunschzahl exakt (4 Lauf / 3 Gym / 3 Rad)',
   plan.cnt['Laufen'] === 4 && plan.cnt['Gym'] === 3 && plan.cnt['Rad'] === 3, JSON.stringify(plan.cnt));
ok('Ruhetag bleibt frei — die Nutzerentscheidung wird nicht ueberschrieben', plan.restDayEmpty);
ok('hoechstens 2 Einheiten pro Tag (kein ueberladener Tag)', plan.maxPerDay <= 2, 'max ' + plan.maxPerDay);
ok('kein Tag traegt zweimal dieselbe Sportart', plan.dupSameSport === false);

/* Negativkontrolle: ohne sessionsPerWeek im Profil darf NICHTS dazuerfunden werden. */
const plan2 = await page.evaluate(() => {
  PROFILE.sports = [{ sportId: 'running', activeInApp: true }, { sportId: 'gym', activeInApp: true }];
  const p = generateWeekPlan(); let total = 0;
  (p || []).forEach(day => { total += (day || []).length; });
  return { total };
});
ok('ohne Wunschzahl im Profil wird nichts hinzuerfunden (Verhalten wie bisher)',
   plan2.total > 0 && plan2.total <= 8, plan2.total + ' Einheiten');

/* Der Plan darf weiterhin nichts persistieren (reiner Generator). */
const pure = await page.evaluate(() => {
  const before = JSON.stringify(PROFILE.weekPlan || null);
  generateWeekPlan(); generateWeekPlan();
  return JSON.stringify(PROFILE.weekPlan || null) === before;
});
ok('STEUERT NICHTS: generateWeekPlan persistiert weiterhin nichts', pure === true);
ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close(); server.close();
console.log('\nfeedback_2026_08_05b: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
