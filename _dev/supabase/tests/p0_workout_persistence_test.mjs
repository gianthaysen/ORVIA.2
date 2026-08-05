/* ORVIA · P0 2026-08-05 — Workout-Datenverlust nach App-Neustart.

   GEMELDETER VORFALL (Nutzer, 2026-08-03/04):
     • App beendete sich waehrend eines Gym-Workouts; danach „6-Stunden-Workout"
       und die geloggten Saetze waren weg.
     • Am Folgetag: Saetze in der Story sichtbar, aber OHNE Uebungsnamen.
     • Nach Neustart wirkte das Workout „beendet"; das laufende fand man nur
       ueber Training → Krafttraining wieder.

   WURZELN + FIXES:
     1. Restore ueberschrieb den lokalen Stand mit einer (leereren) Server-Sicht
        und persistierte sofort → MERGE ueber client-IDs, Server gewinnt bei
        Treffern, lokale Saetze bleiben.
     2. „Server meldet keine aktive Session" loeschte den lokalen Stand blind
        → nur noch nach BESTAETIGTEM Terminalzustand.
     3. Fallback-Restore lieferte exercise:null → Snapshot ohne Uebungsnamen
        → Namensaufloesung ueber den Katalog + Merge behaelt lokale Namen.
     4. Abwesenheit zaehlte als Trainingszeit → Retro-Pause ab letzter Aktion
        (lastActionAt), Satz-Loggen beendet die Pause automatisch. KEINE harte
        Obergrenze (Nutzerentscheidung) — stattdessen nachtraegliche
        Dauer-Korrektur mit Protokoll.
     5. Kein sichtbarer Wiedereinstieg → #resumeBanner auf dem Heute-Tab.

   node supabase/tests/p0_workout_persistence_test.mjs [appRoot-absolut] */
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

/* ============ Quelltext-Verdrahtung ============ */
const ws = R('js/workout-store.js'), wui = R('js/workout-ui.js'), html = R('index.html'), sw = R('sw.js');
ok('Merge statt Clobber implementiert', /function mergeTrees\(/.test(ws) && /mergeTrees\(\{ session: act\.data/.test(ws));
ok('NEGATIVKONTROLLE · der alte Clobber-Aufruf ist ersetzt',
   !/applyTree\(\{ session: act\.data, exercises: exercises, currentIndex: 0 \}\);/.test(ws));
ok('kein blindes clearLocal bei „keine aktive Session"', /confirmedGone/.test(ws) && /nie synchronisiert ODER unbestaetigt/.test(ws));
ok('Namensaufloesung ueber den Katalog', /function resolveExerciseNames\(/.test(ws) && /await resolveExerciseNames\(\)/.test(ws));
ok('Retro-Pause ab letzter Aktion', /RETRO_PAUSE_MIN/.test(ws) && /lastActionAt/.test(ws) && /applyRetroPause/.test(ws));
ok('Satz-Loggen beendet die Pause', /if \(isPaused\(\)\) resumeWorkout\(\)/.test(ws));
ok('Pausen-Sync VOR der Abschluss-RPC', /serverseitig stehen — die RPC rechnet/.test(ws));
ok('Dauer-Korrektur vorhanden, ohne harte Obergrenze',
   /correctFinishedDuration/.test(ws) && /KEINE automatische Obergrenze/.test(ws) && !/Math\.min\([^)]*durationMin[^)]*,\s*\d+\)/.test(ws));
ok('Korrektur protokolliert vorher/nachher (manuelle Angabe, keine Messung)',
   /durationCorrection/.test(R('js/activity-store.js')) && /manual_correction/.test(R('js/activity-store.js')));
ok('Korrektur passt die Trainingslast an (Dauer × RPE, gleicher Upsert-Schluessel)',
   /trainingLoad\.save\(g\.data\.local_date/.test(ws) && /'workout_session:' \+ \(a\.workoutSessionId/.test(ws));
ok('Resume-Banner: Host + Renderer + Boot-Hydrierung',
   /id="resumeBanner"/.test(html) && /renderResumeBanner/.test(wui) && /window\.addEventListener\('load'/.test(wui));
ok('Dauer-Korrektur-Sheet im Aktivitaetsdetail verdrahtet',
   /gmOpenDurationCorrectSheet/.test(R('js/ui.js')) && /Dauer korrigieren/.test(R('js/ui.js')));
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version erhoeht (>= 225), genau einmal', swv != null && Number(swv) >= 225 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

/* ============ LIVE — echte App, Store/Repos kontrolliert ============ */
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
await page.waitForTimeout(1400);
await page.evaluate(() => {
  document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove());
  document.documentElement.classList.remove('orvia-gated');
});

/* Fixture-Werkzeug: lokaler Cache wie nach einem App-Kill mitten im Training. */
const seed = (opts) => `(() => {
  const O = window.ORVIA;
  window.__uidBackup = O.user; O.user = O.user || {}; if (!O.user.id) O.user.id = 'p0test';
  const key = 'orvia_active_workout_' + (O.user.id || 'x');
  const lc = {
    session: { client_session_id: 'cs1', id: ${opts.serverId ? "'srv1'" : 'null'}, status: 'active',
      local_date: todayStr(), started_at: new Date(Date.now() - 100 * 60000).toISOString(),
      total_paused_seconds: 0, paused_at: null, sport: 'Gym' },
    exercises: [
      { workoutExercise: { id: ${opts.serverId ? "'we1'" : 'null'}, client_exercise_id: 'ce1', exercise_id: 'ex-bench' },
        exercise: { id: 'ex-bench', name: 'Schrägbankdrücken' },
        sets: [ { client_set_id: 's1', set_number: 1, weight: 60, reps: 10, completed: true },
                { client_set_id: 's2', set_number: 2, weight: 62.5, reps: 8, completed: true } ] }
    ],
    currentIndex: 0, timer: { running: false },
    lastActionAt: Date.now() - ${opts.gapMin} * 60000
  };
  localStorage.setItem(key, JSON.stringify(lc));
  /* Repos-Fixture: Server kennt die Session, liefert aber einen LEEREREN Baum
     (genau der Vorfall: Teilausfall/Embed-Fehler nach App-Neustart). */
  O.repos = O.repos || {};
  window.__repoBackup = O.repos.workout;
  O.repos.workout = {
    getActiveSession: async () => (${opts.serverActive}
      ? { success: true, data: { id: 'srv1', client_session_id: 'cs1', status: 'active',
          local_date: todayStr(), started_at: lc.session.started_at, total_paused_seconds: 0, paused_at: null, sport: 'Gym' } }
      : { success: true, data: null }),
    loadWorkoutTree: async () => ({ success: ${opts.treeOk}, data: ${opts.treeOk}
      ? { session: { id: 'srv1', client_session_id: 'cs1', status: 'active', local_date: todayStr(),
          started_at: lc.session.started_at, total_paused_seconds: 0, paused_at: null, sport: 'Gym' },
          exercises: [ { workoutExercise: { id: 'we1', client_exercise_id: 'ce1', exercise_id: 'ex-bench' },
            exercise: null, sets: [ { id: 'ss1', client_set_id: 's1', set_number: 1, weight: 60, reps: 10, completed: true } ] } ] }
      : null }),
    listExercises: async () => ({ success: false }),
    listSets: async () => ({ success: false }),
    /* 'unknown' = Serverzustand NICHT ermittelbar (Query scheitert) → fail-safe;
       'terminal' = Server bestaetigt abgeschlossen → Aufraeumen erlaubt. */
    getSession: async () => (${opts.goneConfirm === 'terminal'}
      ? { success: true, data: { id: 'srv1', status: 'completed' } }
      : { success: false }),
    updateSession: async (id, patch) => { (window.__patches = window.__patches || []).push(patch); return { success: true }; },
    addSet: async (weId, setObj) => ({ success: true, data: Object.assign({ id: 'ss-' + setObj.clientSetId, client_set_id: setObj.clientSetId, set_number: setObj.setNumber }, setObj) })
  };
  window.__exBackup = O.repos.exercise;
  O.repos.exercise = { list: async () => ({ success: true, data: [ { id: 'ex-bench', name: 'Schrägbankdrücken' } ] }) };
  window.__patches = [];
  return true;
})()`;
const restore = `(async () => {
  const r = await ORVIA.workoutStore.restoreActiveWorkout();
  const w = ORVIA.workout;
  return { ok: r.success, session: w.session && { id: w.session.id, status: w.session.status, paused_at: w.session.paused_at },
    exercises: (w.exercises || []).map(e => ({ name: e.exercise && e.exercise.name, sets: (e.sets || []).length,
      setIds: (e.sets || []).map(s => s.client_set_id) })),
    retro: !!w.retroPaused, patches: window.__patches };
})()`;
const cleanup = `(() => { const O = window.ORVIA;
  try { localStorage.removeItem('orvia_active_workout_' + (O.user.id || 'x')); } catch (e) {}
  O.repos.workout = window.__repoBackup; O.repos.exercise = window.__exBackup;
  O.workout.session = null; O.workout.exercises = []; O.workout.retroPaused = false; return true; })()`;

/* Szenario 1 · Server liefert leereren Baum → Merge behaelt beide Saetze + Namen. */
await page.evaluate(seed({ serverId: true, serverActive: true, treeOk: true, gapMin: 5 }));
let r1 = await page.evaluate(restore);
ok('S1 · MERGE: beide lokal geloggten Saetze ueberleben den Restore',
   r1.exercises.length === 1 && r1.exercises[0].sets === 2 && r1.exercises[0].setIds.includes('s2'),
   JSON.stringify(r1.exercises));
ok('S1 · Uebungsname ueberlebt (lokal bzw. Katalog), kein „Übung"-Platzhalter mehr',
   r1.exercises[0].name === 'Schrägbankdrücken');
ok('S1 · kurze Abwesenheit (5 min) erzeugt KEINE Retro-Pause', !r1.retro && !(r1.session && r1.session.paused_at));
await page.evaluate(cleanup);

/* Szenario 2 · 100 min Abwesenheit → Retro-Pause ab letzter Aktion, zum Server synchronisiert. */
await page.evaluate(seed({ serverId: true, serverActive: true, treeOk: true, gapMin: 100 }));
let r2 = await page.evaluate(restore);
ok('S2 · RETRO-PAUSE: Abwesenheit zaehlt nicht als Trainingszeit',
   r2.retro && r2.session && r2.session.paused_at != null, JSON.stringify(r2.session));
ok('S2 · Pausenbeginn = letzte Aktion (nicht jetzt)',
   r2.session && (Date.now() - new Date(r2.session.paused_at).getTime()) > 90 * 60000);
ok('S2 · Pause wurde zum Server synchronisiert', r2.patches.some(p => p.paused_at != null), JSON.stringify(r2.patches));
const r2b = await page.evaluate(`(async () => {
  await ORVIA.workoutStore.addSet(0, { weight: 65, reps: 6, completed: true });
  const s = ORVIA.workout.session;
  return { paused: !!s.paused_at, totalPaused: Math.round(s.total_paused_seconds || 0), retro: !!ORVIA.workout.retroPaused };
})()`);
ok('S2 · ein geloggter Satz beendet die Pause automatisch und bucht die Pausenzeit',
   !r2b.paused && !r2b.retro && r2b.totalPaused > 90 * 60, JSON.stringify(r2b));
/* Sichtbarer Wiedereinstieg */
const banner = await page.evaluate(`(() => { ORVIA.workoutUI.renderResumeBanner(); const h = document.getElementById('resumeBanner');
  return { html: h ? h.innerHTML : null }; })()`);
ok('S2 · Resume-Banner auf dem Heute-Tab sichtbar (Gym läuft noch · Fortsetzen)',
   /läuft noch/.test(banner.html) && /Fortsetzen/.test(banner.html) && /resumeActiveSync/.test(banner.html));
await page.evaluate(cleanup);
const bannerGone = await page.evaluate(`(() => { ORVIA.workoutUI.renderResumeBanner(); return document.getElementById('resumeBanner').innerHTML; })()`);
ok('ohne aktive Session bleibt der Banner-Host leer (keine Strukturaenderung)', bannerGone === '');

/* Szenario 3 · Server meldet „keine aktive Session", Terminalzustand UNBESTAETIGT → lokal bleibt. */
await page.evaluate(seed({ serverId: true, serverActive: false, treeOk: false, gapMin: 5, goneConfirm: 'unknown' }));
let r3 = await page.evaluate(restore);
ok('S3 · FAIL-SAFE: unbestaetigter Serverzustand loescht keine geloggten Saetze',
   r3.session && r3.session.status === 'active' && r3.exercises[0] && r3.exercises[0].sets === 2, JSON.stringify(r3.exercises));
await page.evaluate(cleanup);

/* Szenario 4 · Server bestaetigt terminal → lokal wird aufgeraeumt (kein Zombie). */
await page.evaluate(seed({ serverId: true, serverActive: false, treeOk: false, gapMin: 5, goneConfirm: 'terminal' }));
let r4 = await page.evaluate(restore);
ok('S4 · bestaetigt terminal ⇒ lokaler Zustand wird geleert (keine Geister-Session)', r4.session == null);
await page.evaluate(cleanup);

/* Szenario 5 · Dauer-Korrektur (Nutzerentscheidung: editierbar statt Obergrenze). */
const r5 = await page.evaluate(`(async () => {
  const st = ORVIA.activityStore;
  const day = todayStr();
  st.upsertActivityFromWorkout(
    { id: 'srvX', client_session_id: 'csX', sport: 'Gym', status: 'completed', local_date: day,
      started_at: day + 'T17:00:00Z', finished_at: day + 'T23:00:00Z', duration_min: 360, total_paused_seconds: 0, session_rpe: 8 },
    [ { workoutExercise: { client_exercise_id: 'ceX', exercise_id: 'ex-bench' }, exercise: { name: 'Schrägbankdrücken' },
        sets: [ { client_set_id: 'sX', set_number: 1, weight: 60, reps: 10, completed: true, set_type: 'working' } ] } ],
    { syncStatus: 'pending' });
  const a = st.getActivityBySource('orvia_workout', 'srvX');
  window.__patches = [];
  ORVIA.repos.workout = {
    updateSession: async (id, patch) => { window.__patches.push(patch); return { success: true }; },
    getSession: async () => ({ success: true, data: { id: 'srvX', session_rpe: 8, local_date: day, sport: 'Gym' } })
  };
  window.__loadSaves = [];
  ORVIA.repos.trainingLoad = { save: async (d, s, o) => { window.__loadSaves.push(o); return { success: true }; } };
  const r = await ORVIA.workoutStore.correctFinishedDuration(a.clientRecordId, 90);
  const a2 = st.getActivityBySource('orvia_workout', 'srvX');
  return { ok: r.success, fromMin: r.data && r.data.fromMin, toMin: r.data && r.data.toMin,
    durSec: a2.durationSeconds, corr: a2.metrics && a2.metrics.durationCorrection,
    patches: window.__patches, loads: window.__loadSaves };
})()`);
ok('S5 · 360-min-Fehldauer nachtraeglich auf 90 min korrigiert', r5.ok && r5.fromMin === 360 && r5.toMin === 90 && r5.durSec === 5400);
ok('S5 · Korrektur protokolliert (vorher → nachher, manuell — keine Messung)',
   r5.corr && r5.corr.fromMin === 360 && r5.corr.toMin === 90 && r5.corr.method === 'manual_correction');
ok('S5 · Server-Session wird mitkorrigiert', r5.patches.some(p => p.duration_min === 90), JSON.stringify(r5.patches));
ok('S5 · Trainingslast wird mitkorrigiert (Dauer × RPE, gleicher Schluessel)',
   r5.loads.length === 1 && r5.loads[0].dur === 90 && r5.loads[0].rpe === 8 && /workout_session:srvX/.test(r5.loads[0].client_session_id),
   JSON.stringify(r5.loads));

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close(); server.close();
console.log('\np0_workout_persistence: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
