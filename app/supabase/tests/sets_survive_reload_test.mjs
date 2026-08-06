/* ORVIA · „Saetze verschwinden beim Neuladen" (2026-08-06) — REPRODUKTION.

   NUTZERBEOBACHTUNG (die entscheidende Information): Die Saetze verschwinden nicht
   nach Tagen von selbst, sondern „wenn ich die App neulade / die Dateien austausche".
   Damit ist es kein Storage-Ablauf, sondern etwas im Start- oder Update-Pfad.

   VERDACHT, den dieser Test prueft: Der lokale Activity-Speicher benutzt einen
   Schluessel, der von der Anmeldung abhaengt —
       key() = 'orvia_activities_' + (O.user && O.user.id || 'local')
   O.user wird aber erst gesetzt, wenn die Session geladen ist (js/auth.js). Zwischen
   Seitenstart und Auth liest/schreibt der Store also unter 'local', danach unter der
   echten Nutzer-ID. Jeder Schreibvorgang in diesem Fenster landet im falschen Topf —
   und jeder Lesevorgang findet dort nichts.

   Der Test stellt genau das nach: Workout mit Saetzen sichern, Seite neu laden,
   nachsehen. Zusaetzlich der Update-Fall (neuer Service Worker / getauschte Dateien).

   node supabase/tests/sets_survive_reload_test.mjs [appRoot-absolut] */
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

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const browser = await chromium.launch({ executablePath: CHROME });
/* EIN Context ueber den ganzen Lauf: localStorage muss den Reload ueberleben,
   genau wie auf dem Geraet des Nutzers. */
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));

const USER = { id: 'u-test-0001' };
async function load() {
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    document.documentElement.classList.remove('orvia-gated');
    document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove());
  });
}

/* ============ 1) URSACHE: haengt der Speicherort an der Anmeldung? ============ */
sec('Ursache · Speicherschluessel und Anmeldezeitpunkt');
await load();
const keys = await page.evaluate((u) => {
  const st = ORVIA.activityStore;
  const before = { user: ORVIA.user ? ORVIA.user.id : null };
  /* Zustand wie unmittelbar nach dem Seitenstart: noch nicht angemeldet. */
  ORVIA.user = null;
  st.upsertManualActivity({ sportId: 'gym', sourceRecordId: 'vor-auth', startedAt: '2026-08-06T08:00:00Z',
    durationSeconds: 3600, summary: {} });
  const anonKeys = Object.keys(localStorage).filter(k => k.indexOf('orvia_activities_') === 0);
  /* Jetzt kommt die Anmeldung — wie im echten Ablauf einige hundert Millisekunden spaeter. */
  ORVIA.user = u;
  const afterAuthCount = st.listActivities().length;
  const allKeys = Object.keys(localStorage).filter(k => k.indexOf('orvia_activities_') === 0);
  return { before, anonKeys, allKeys, afterAuthCount };
}, USER);
ok('vor der Anmeldung schreibt der Store unter einem ANDEREN Schluessel',
   keys.anonKeys.indexOf('orvia_activities_local') >= 0, JSON.stringify(keys.anonKeys));
ok('BEFUND: was vor der Anmeldung gespeichert wurde, ist danach unsichtbar',
   keys.afterAuthCount === 0, keys.afterAuthCount + ' Aktivitaeten nach Auth sichtbar');

/* ============ 2) REPRODUKTION: Workout sichern → neu laden ============ */
sec('Reproduktion · Workout mit Saetzen, dann Seite neu laden');
const saved = await page.evaluate((u) => {
  ORVIA.user = u;
  const st = ORVIA.activityStore;
  /* Ein abgeschlossenes Gym-Workout mit zwei Uebungen und vier Saetzen —
     dieselbe Form, die finishWorkout an upsertActivityFromWorkout uebergibt. */
  const session = { id: 'srv-1', client_session_id: 'cs-1', sport: 'Gym', sport_key: 'gym',
    status: 'completed', local_date: '2026-08-06', started_at: '2026-08-06T17:00:00Z',
    finished_at: '2026-08-06T18:00:00Z', duration_min: 60, session_rpe: 7 };
  const exercises = [
    { workoutExercise: { order_index: 0, exercise_id: 'ex1', client_exercise_id: 'ce1' },
      exercise: { name: 'Bankdrücken' },
      sets: [{ set_number: 1, set_type: 'working', weight: 80, reps: 8, completed: true },
             { set_number: 2, set_type: 'working', weight: 82.5, reps: 7, completed: true }] },
    { workoutExercise: { order_index: 1, exercise_id: 'ex2', client_exercise_id: 'ce2' },
      exercise: { name: 'Rudern' },
      sets: [{ set_number: 1, set_type: 'working', weight: 70, reps: 10, completed: true },
             { set_number: 2, set_type: 'working', weight: 70, reps: 10, completed: true }] }];
  const r = st.upsertActivityFromWorkout(session, exercises, { syncStatus: 'pending' });
  const det = st.getWorkoutDetailsForActivity(r.activity.clientRecordId);
  let n = 0; (det.exercises || []).forEach(e => { n += (e.sets || []).length; });
  return { id: r.activity.clientRecordId, exCount: (det.exercises || []).length, setCount: n,
    storageKey: Object.keys(localStorage).filter(k => k.indexOf('orvia_activities_') === 0) };
}, USER);
ok('direkt nach dem Sichern sind Übungen und Sätze da', saved.exCount === 2 && saved.setCount === 4,
   saved.exCount + ' Übungen / ' + saved.setCount + ' Sätze');

/* --- Jetzt der Schritt, den der Nutzer beschreibt: neu laden --- */
await load();
const afterReload = await page.evaluate((arg) => {
  const st = ORVIA.activityStore;
  /* Der reale Ablauf: die Seite startet OHNE angemeldeten Nutzer. Genau hier greift
     jeder Leser, der frueh laeuft (Dashboard, Analyse, Muskelvolumen …). */
  const anonView = st.listActivities().length;
  const anonDetail = st.getWorkoutDetailsForActivity(arg.id);
  /* Danach kommt die Anmeldung. */
  ORVIA.user = arg.u;
  const authedView = st.listActivities().length;
  const det = st.getWorkoutDetailsForActivity(arg.id);
  let n = 0; (det.exercises || []).forEach(e => { n += (e.sets || []).length; });
  return { anonView, anonHasDetails: !!anonDetail.hasDetails,
    authedView, exCount: (det.exercises || []).length, setCount: n, hasDetails: !!det.hasDetails };
}, { id: saved.id, u: USER });
/* Nebenbefund, der bleibt: solange die Anmeldung laeuft, liest der Store unter
   'local' und findet das Workout NICHT. Das erklaert, warum direkt nach dem Start
   kurz alles leer wirkt — es ist ein Anzeige-, kein Datenproblem. */
ok('VOR der Anmeldung sind die Satzdetails dieser Einheit nicht auffindbar (Nebenbefund)',
   afterReload.anonHasDetails === false, 'Details vor Auth=' + afterReload.anonHasDetails);
ok('NACH der Anmeldung ist die Aktivität wieder da', afterReload.authedView >= 1, afterReload.authedView + ' sichtbar');
ok('KERNFRAGE: überleben die Sätze den Reload?', afterReload.setCount === 4,
   afterReload.exCount + ' Übungen / ' + afterReload.setCount + ' Sätze');

/* ============ 3) UPDATE-FALL: Server liefert dieselbe Aktivität ohne Sätze ============ */
sec('Update-Fall · Server-Abgleich darf lokale Sätze nicht löschen');
const afterMerge = await page.evaluate((arg) => {
  ORVIA.user = arg.u;
  const st = ORVIA.activityStore;
  const before = st.getActivityById(arg.id);
  /* So kommt die Aktivität vom Server zurueck: MIT Identitaet, aber OHNE
     workoutSnapshot (die Saetze liegen dort in eigenen Tabellen). Wenn der Abgleich
     hier den lokalen Snapshot ueberschreibt, sind die Saetze weg. */
  const serverRow = { id: 'srv-activity-1', client_record_id: before.clientRecordId,
    sport_id: 'gym', source: before.source, source_record_id: before.sourceRecordId,
    workout_session_id: before.workoutSessionId,
    started_at: before.startedAt, ended_at: before.endedAt,
    duration_seconds: before.durationSeconds, status: 'completed', summary: {}, metrics: {} };
  /* Erster Abgleich, solange der Datensatz noch 'pending' ist (Outbox-Vorrang). */
  const r1 = st.mergeServerActivities([serverRow]);
  const d1 = st.getWorkoutDetailsForActivity(arg.id);
  let n1 = 0; (d1.exercises || []).forEach(e => { n1 += (e.sets || []).length; });
  /* Zweiter Abgleich, nachdem der Push durch ist — jetzt gilt der Outbox-Vorrang nicht mehr. */
  st.markSynced(before.clientRecordId, 'srv-activity-1');
  const r2 = st.mergeServerActivities([serverRow]);
  const d2 = st.getWorkoutDetailsForActivity(arg.id);
  let n2 = 0; (d2.exercises || []).forEach(e => { n2 += (e.sets || []).length; });
  return { pendingMerge: r1, setsWhilePending: n1, syncedMerge: r2, setsAfterSynced: n2,
    total: st.listActivities().length };
}, { id: saved.id, u: USER });
ok('Abgleich bei ausstehendem Push lässt die Sätze unangetastet', afterMerge.setsWhilePending === 4,
   afterMerge.setsWhilePending + ' Sätze');
ok('KERNFRAGE: Abgleich nach erfolgtem Push lässt die Sätze unangetastet',
   afterMerge.setsAfterSynced === 4, afterMerge.setsAfterSynced + ' Sätze');
ok('der Server-Abgleich erzeugt KEINEN zweiten Datensatz derselben Einheit',
   afterMerge.total === 1, afterMerge.total + ' Aktivitäten');

/* ============ 4) Zweiter Reload nach dem Abgleich ============ */
sec('Zweiter Reload · Zustand nach Server-Abgleich');
await load();
const finalState = await page.evaluate((arg) => {
  ORVIA.user = arg.u;
  const st = ORVIA.activityStore;
  const det = st.getWorkoutDetailsForActivity(arg.id);
  let n = 0; (det.exercises || []).forEach(e => { n += (e.sets || []).length; });
  return { setCount: n, total: st.listActivities().length };
}, { id: saved.id, u: USER });
ok('KERNFRAGE: Sätze überleben auch Reload NACH dem Server-Abgleich',
   finalState.setCount === 4, finalState.setCount + ' Sätze, ' + finalState.total + ' Aktivität(en)');

/* ============ 5) DIE ECHTE URSACHE: pauschales Loeschen beim Kontowechsel ============ */
sec('Ursache · clearLocalUserData loescht auch die EIGENEN Saetze');
{
  const r = await page.evaluate((arg) => {
    ORVIA.user = arg.u;
    const st = ORVIA.activityStore;
    const before = st.getWorkoutDetailsForActivity(arg.id);
    let n0 = 0; (before.exercises || []).forEach(e => { n0 += (e.sets || []).length; });
    const myKey = 'orvia_activities_' + arg.u.id;
    const hadKey = localStorage.getItem(myKey) != null;
    /* Genau der Pfad, den js/sync.js beim vermeintlichen Kontowechsel nimmt.
       Ausgeloest wird er von applyUserScope, sobald orvia_active_user oder
       orvia_data_owner nicht zur aktuellen Nutzer-ID passt. */
    /* Ein FREMDER Datensatz liegt ebenfalls im Speicher — der muss verschwinden. */
    localStorage.setItem('orvia_activities_ein-fremder-nutzer', '[{"id":"fremd"}]');
    localStorage.setItem('orvia_data_owner', 'ein-anderer-nutzer');
    if (window.orviaApplyUserScope) window.orviaApplyUserScope(arg.u.id);
    const after = st.getWorkoutDetailsForActivity(arg.id);
    let n1 = 0; (after.exercises || []).forEach(e => { n1 += (e.sets || []).length; });
    return { before: n0, after: n1, hadKey,
      myKeyKept: localStorage.getItem(myKey) != null,
      foreignGone: localStorage.getItem('orvia_activities_ein-fremder-nutzer') == null,
      ownerRepaired: localStorage.getItem('orvia_data_owner') === arg.u.id,
      remaining: st.listActivities().length };
  }, { id: saved.id, u: USER });
  ok('Ausgangslage: die Sätze liegen unter dem Schlüssel DIESES Nutzers',
     r.before === 4 && r.hadKey, r.before + ' Sätze');
  /* Der Pfad muss beides koennen: fremde Daten entfernen UND eigene verschonen.
     Vor dem Fix loeschte er pauschal alles — inklusive der eigenen Saetze. */
  ok('FREMDE Daten werden weiterhin gelöscht (Datenschutz-Zweck bleibt erfüllt)',
     r.foreignGone === true, 'fremd weg=' + r.foreignGone);
  ok('EIGENER Aktivitätsspeicher überlebt den Pfad', r.myKeyKept === true, 'eigener Schlüssel bleibt=' + r.myKeyKept);
  ok('der Eigentümer-Eintrag wird dabei repariert (kein Wiederauslösen beim nächsten Start)',
     r.ownerRepaired === true, 'owner=' + r.ownerRepaired);
  ok('FIX-ZIEL: die eigenen Sätze müssen diesen Pfad überleben',
     r.after === 4, r.after + ' Sätze nach dem Vorgang (erwartet 4)');
  ok('FIX-ZIEL: die eigene Aktivität bleibt erhalten', r.remaining >= 1, r.remaining + ' Aktivität(en)');
}

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log('\nsets_survive_reload: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
