/* ORVIA · Phase 8.3-Voraussetzung (2026-08-06) — REGRESSION für zwei P0-Befunde.

   KONTEXT: Vor der 14-Tage-Datensammlung wurde geprüft, ob der Shadow überhaupt
   etwas Aussagekräftiges baut. Ergebnis: NEIN — aus zwei unabhängigen Gründen,
   die beide dazu führten, dass scheduler-v2 keine Kapazität fand und deshalb nur
   eine generische Minimalwoche erzeugte (`conservative_generic_no_capacity`).
   Das Gate hätte 14 Tage lang diese Minimalwoche gegen den echten Plan verglichen.

   BEFUND 1 — capacity-adapter.js las `a.sport`.
     Die kanonischen Aktivitäten aus activityStore heißen `sportId`
     (activity-store.js: `sportId: row.sport_id`). `a.sport` ist dort undefined,
     also fielen ALLE Sportarten unter einen Pseudo-Sport zusammen.

   BEFUND 2 — shadow-runner.js gab das ganze Sport-OBJEKT an canonicalSportOf.
     PROFILE.sports ist kanonisch ein Objekt-Array ({sportId,…}). Aus einem Objekt
     macht String() "[object Object]" ⇒ die Funktion lieferte immer 'other'.
     Exakt derselbe Fehlertyp, der in generateWeekPlan als H1 längst behoben war.

   Dieser Test hält beide Ursachen UND ihre Wirkung fest, damit sie nicht über eine
   Refaktorierung zurückkehren.

   node supabase/tests/phase8_capacity_pipeline_test.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2]) : (existsSync(join(_flat, 'index.html')) ? _flat : join(_flat, '..', 'app'));
const CHROME = process.env.ORVIA_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* ============ 1) Reine Prüfung des Adapters ============ */
sec('Befund 1 · Adapter liest das kanonische Sportfeld');
{
  const CA = require(join(APP, 'js/engine/capacity-adapter.js'));
  const AC = require(join(APP, 'js/activity-config.js'));
  const shift = (day, d) => { const x = new Date(day + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  /* KANONISCHE Form: sportId (so liefert es activityStore.listActivities). */
  const canonical = [];
  for (let i = 0; i < 24; i += 3) canonical.push({ id: 'r' + i, sportId: 'running',
    startedAt: shift('2026-08-05', -i) + 'T07:00:00Z', durationSeconds: 3600, summary: { rpe: 5 }, distanceKm: 10 });
  for (let i = 1; i < 20; i += 5) canonical.push({ id: 'c' + i, sportId: 'cycling',
    startedAt: shift('2026-08-05', -i) + 'T17:00:00Z', durationSeconds: 5400, summary: { rpe: 4 }, distanceKm: 30 });
  const r = CA.buildPerSport(canonical, { today: '2026-08-05', timezone: 'UTC', activityConfig: AC });
  ok('kanonische Aktivitäten (sportId) werden nach Sportart getrennt',
     r.ok === true && !!r.perSport.running && !!r.perSport.cycling, JSON.stringify(Object.keys(r.perSport || {})));
  ok('KEIN Sammeltopf mehr (kein "null"/"unknown"/"undefined" als Sportart)',
     !['null', 'unknown', 'undefined', 'other'].some(k => k in (r.perSport || {})), JSON.stringify(Object.keys(r.perSport || {})));
  ok('die Werte sind echt und sportspezifisch verschieden',
     r.perSport.running.weeklySessions > 0 && r.perSport.cycling.weeklySessions > 0 &&
     r.perSport.running.weeklyLoadAU !== r.perSport.cycling.weeklyLoadAU,
     'run ' + r.perSport.running.weeklySessions + ' / bike ' + r.perSport.cycling.weeklySessions);
  ok('longSessionCeiling wird gemessen (scheduler braucht es für die lange Einheit)',
     r.perSport.running.longSessionCeiling > 0, String(r.perSport.running.longSessionCeiling));
  /* Rückwärtskompatibel: die Legacy-/Testform `sport` muss weiter funktionieren. */
  const legacy = canonical.map(a => ({ id: a.id, sport: a.sportId, startedAt: a.startedAt,
    durationSeconds: a.durationSeconds, summary: a.summary, distanceKm: a.distanceKm }));
  const r2 = CA.buildPerSport(legacy, { today: '2026-08-05', timezone: 'UTC', activityConfig: AC });
  ok('Legacy-Feldname `sport` funktioniert weiterhin (keine Regression)',
     r2.ok === true && !!r2.perSport.running && !!r2.perSport.cycling);
  ok('beide Formen liefern dasselbe Ergebnis',
     JSON.stringify(r.perSport.running) === JSON.stringify(r2.perSport.running));
  const none = CA.buildPerSport([{ id: 'x', startedAt: '2026-08-05T07:00:00Z', durationSeconds: 3600 }],
    { today: '2026-08-05', timezone: 'UTC', activityConfig: AC });
  ok('Aktivität ganz ohne Sportfeld wird nicht einer echten Sportart zugeschlagen',
     none.ok === true && !none.perSport.running && !none.perSport.cycling, JSON.stringify(Object.keys(none.perSport || {})));
}

/* ============ 2) Der ganze Weg im Browser ============ */
sec('Befund 2 · Shadow leitet die Sportarten aus dem Profil richtig ab');
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

const live = await page.evaluate(() => {
  document.documentElement.classList.remove('orvia-gated');
  const pad = n => String(n).padStart(2, '0');
  /* Acht Wochen realistische Historie: Läufe (einer davon lang) + Krafteinheiten. */
  for (let i = 0; i < 56; i++) {
    const t = new Date(Date.now() - i * 864e5);
    const day = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
    if (i % 2 === 0) ORVIA.activityStore.upsertManualActivity({ sportId: 'running', sourceRecordId: 'r' + i,
      startedAt: day + 'T07:00:00Z', durationSeconds: (i % 7 === 0 ? 5400 : 2700), summary: { distanceKm: (i % 7 === 0 ? 18 : 9), rpe: 5 } });
    if (i % 3 === 0) ORVIA.activityStore.upsertManualActivity({ sportId: 'gym', sourceRecordId: 'g' + i,
      startedAt: day + 'T18:00:00Z', durationSeconds: 3600, summary: { rpe: 6 } });
  }
  /* PROFILE.sports in der KANONISCHEN Objektform — genau die Form, an der es scheiterte. */
  PROFILE.sports = [{ sportId: 'running', activeInApp: true }, { sportId: 'gym', activeInApp: true }];
  PROFILE.availability = { days: { mo: { available: true }, di: { available: true }, mi: { available: true },
    do: { restDay: true }, fr: { available: true }, sa: { available: true }, so: { available: true } } };
  ORVIA.engineShadow.clearWeekLog();
  const wk = ORVIA.engineShadow.runWeekShadow();
  return { sessions: wk && wk.sessions, flags: (wk && wk.flags) || [],
    unplaced: (wk && wk.unplaced) || [], gate: wk && wk.gate };
});
ok('der Shadow baut eine ECHTE Woche (mehr als die generische Minimaleinheit)',
   live.sessions >= 4, live.sessions + ' Sessions');
ok('KERNBEFUND behoben: kein `conservative_generic_no_capacity` mehr',
   !live.flags.some(f => /conservative_generic_no_capacity/.test(f)), JSON.stringify(live.flags));
ok('kein Pseudo-Sport „other" mehr in den Flags',
   !live.flags.some(f => /:other$/.test(f)), JSON.stringify(live.flags));
ok('die verbleibenden Flags sind inhaltlich sinnvoll (z. B. Qualität bei geringer Konfidenz zurückgehalten)',
   live.flags.every(f => /no_pace_evidence_shadow|quality_withheld_low_confidence|shadow_primary_heuristic/.test(f)),
   JSON.stringify(live.flags));
ok('die Gate-Belege entstehen weiterhin (S3/S4/S5 messbar)',
   live.gate && live.gate.deterministic === true && live.gate.invalidSessions === 0,
   JSON.stringify(live.gate && { det: live.gate.deterministic, inv: live.gate.invalidSessions }));

/* Negativkontrolle: ohne Historie MUSS es beim konservativen Verhalten bleiben. */
const noHistory = await page.evaluate(() => {
  const key = 'orvia_activities_' + ((ORVIA.user && ORVIA.user.id) || 'local');
  const backup = localStorage.getItem(key);
  localStorage.removeItem(key);
  ORVIA.engineShadow.clearWeekLog();
  const wk = ORVIA.engineShadow.runWeekShadow();
  if (backup) localStorage.setItem(key, backup);
  return { sessions: wk && wk.sessions, flags: (wk && wk.flags) || [] };
});
ok('NEGATIVKONTROLLE: ohne Historie bleibt es konservativ (nichts wird erfunden)',
   noHistory.flags.some(f => /conservative_generic_no_capacity/.test(f)),
   JSON.stringify(noHistory.flags));
ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));

/* Quelltext-Regression: die konkreten Fehlerstellen dürfen nicht zurückkehren. */
{
  const cap = readFileSync(join(APP, 'js/engine/capacity-adapter.js'), 'utf8');
  const sr = readFileSync(join(APP, 'js/engine/shadow-runner.js'), 'utf8');
  ok('Adapter liest nicht mehr blind a.sport', !/mapSport\(a\.sport\)/.test(cap) && /sportFieldOf/.test(cap));
  ok('Shadow gibt nicht mehr das ganze Sportobjekt an mapSport',
     !/forEach\(function \(s\) \{ var c = mapSport\(s\);/.test(sr) && /s\.sportId \|\| s\.id/.test(sr));
}

await browser.close(); server.close();
console.log('\nphase8_capacity_pipeline: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
