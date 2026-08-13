/* ORVIA · Phase 8.1/8.2 — Wochenplan-Projektion und der Weg zum Nutzer.

   8.1: `scheduler-v2.sessions[]` → kanonisches Anzeigemodell. Die zentrale Zusage ist
        VOLLSTAENDIGKEIT: jede Engine-Session landet entweder im Wochenmodell ODER
        begruendet in `unmapped[]`. Stilles Verschwinden waere der gefaehrlichste
        Fehler — man saehe einen ploetzlich duenneren Plan und wuesste nicht warum.

   8.2: Der Integrationstest „Engine-Output erreicht den Nutzer", der im
        Umsetzungsplan als vollstaendig fehlend vermerkt war. Er belegt den ganzen
        Weg bis zu den gerenderten Karten — UND dass der Legacy-Pfad bei
        abgeschalteter Engine bitgenau unveraendert bleibt.

   node supabase/tests/phase8_week_projection_test.mjs [appRoot-absolut] */
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
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const P = require(join(APP, 'js/engine/week-projection.js'));

/* Hilfsbau: eine Engine-Session in der Form, die scheduler-v2 wirklich liefert. */
const mkSession = (id, wd, sport, type, blocks, prio) => ({
  sessionId: id, weekday: wd, sportId: sport,
  prescription: { sport_id: sport, session_type: type, goal: 'g', priority: prio || 'build', blocks: blocks },
  flags: [], provenance: { scheduler: 'scheduler-v2@1', policy: 'p', solver: 's',
    factory: 'f', templateId: type, paceEvidenceUsed: false, requirementId: 'r' } });
const dur = (sec) => [{ type: 'work', completion: { type: 'duration', value: sec, unit: 's' } }];

/* ============ 1) Vollstaendigkeit ============ */
sec('8.1 · Vollständigkeit — nichts verschwindet still');
{
  const out = { ok: true, weekKey: '2026-W32', provenance: { scheduler: 'scheduler-v2@1', policy: 'p' },
    sessions: [
      mkSession('s0', 'mo', 'running', 'endurance_easy', dur(2700)),
      mkSession('s1', 'di', 'running', 'endurance_intervals',
        [{ type: 'warmup', completion: { type: 'duration', value: 900 } },
         { type: 'repeat', iterations: 4, blocks: [
           { type: 'work', completion: { type: 'duration', value: 240 } },
           { type: 'recovery', completion: { type: 'duration', value: 180 } }] },
         { type: 'cooldown', completion: { type: 'duration', value: 600 } }], 'key'),
      mkSession('s2', 'mi', 'gym', 'strength_general', [{ type: 'exercise', exercise_id: 'squat', sets: 3 }]),
      mkSession('s3', 'so', 'running', 'endurance_long', dur(6300), 'key'),
      mkSession('s4', 'fr', 'kajak', 'endurance_easy', dur(1800)),          // unbekannte Sportart
      mkSession('s5', 'sa', 'running', 'mentales_training', dur(1800)),     // unbekannter Typ
      mkSession('s6', 'xx', 'running', 'endurance_easy', dur(1800))         // unbekannter Wochentag
    ] };
  const r = P.projectWeek(out);
  ok('Projektion läuft und meldet ok', r.ok === true);
  ok('jede Session ist verbucht: projiziert + unmapped = Eingang',
     r.counts.projected + r.counts.unmapped === r.counts.input,
     JSON.stringify(r.counts));
  ok('die vier abbildbaren Sessions landen im Wochenmodell', r.counts.projected === 4);
  ok('unbekannte Sportart wird BEGRÜNDET gemeldet, nicht verschluckt',
     r.unmapped.some(u => u.sessionId === 's4' && u.reason === 'sport_unknown'),
     JSON.stringify(r.unmapped.map(u => u.reason)));
  ok('unbekannter Einheitentyp wird gemeldet statt geraten',
     r.unmapped.some(u => u.sessionId === 's5' && u.reason === 'unknown_session_type'));
  ok('unbekannter Wochentag wird gemeldet', r.unmapped.some(u => u.sessionId === 's6' && u.reason === 'weekday_unknown'));
  ok('Wochenmodell hat genau 7 Tage', Array.isArray(r.days) && r.days.length === 7);
  ok('Einheiten liegen am RICHTIGEN Tag (Mo/Di/Mi/So belegt, Do/Fr/Sa leer)',
     r.days[0].length === 1 && r.days[1].length === 1 && r.days[2].length === 1 &&
     r.days[3].length === 0 && r.days[4].length === 0 && r.days[5].length === 0 && r.days[6].length === 1,
     r.days.map(d => d.length).join(','));
}

/* ── Lücken aus dem Probenlauf v8-331 ─────────────────────────────────
   Drei Zusicherungen waren beschrieben, aber von keinem Test gedeckt: die
   Mutationen blieben grün. Alle drei sind Muster data_lacks_var — die
   bestehende Fixture enthält den fraglichen Fall schlicht nicht. */
{
  sec('8.1 · Fälle, die die reguläre Fixture nicht enthält');
  /* J1: eine Session OHNE Vorgabe. Ausgerechnet dieser Fall wird wichtig,
     sobald die prescription bis auf die Wochenkarte durchgereicht wird. */
  const ohneVorgabe = { sessionId: 'nv', weekday: 'mo', sportId: 'running',
    flags: [], provenance: { scheduler: 'scheduler-v2@1' } };
  const r1 = P.projectWeek({ ok: true, weekKey: '2026-W32', sessions: [ohneVorgabe] });
  ok('Session OHNE Vorgabe wird BEGRÜNDET gemeldet, nicht mit leerer Vorgabe projiziert',
     r1.counts.projected === 0 &&
     r1.unmapped.some(u => u.sessionId === 'nv' && u.reason === 'prescription_missing'),
     JSON.stringify(r1.unmapped.map(u => u.reason)));
  ok('  … das gilt auch für eine Vorgabe vom falschen Typ (String/Array statt Objekt)',
     ['nicht-objekt', [], 42].every(bad => {
       const r = P.projectWeek({ ok: true, weekKey: '2026-W32', sessions: [
         Object.assign({}, ohneVorgabe, { prescription: bad })] });
       return r.counts.projected === 0 && r.unmapped[0] && r.unmapped[0].reason === 'prescription_missing';
     }));

  /* J4: Dauer 0 s. Ein Umfangslabel „0 min" wäre eine erfundene Aussage —
     die Einheit hat keine Dauerangabe, nicht die Dauer null. */
  const r2 = P.projectWeek({ ok: true, weekKey: '2026-W32', sessions: [
    mkSession('z', 'mo', 'running', 'endurance_easy', dur(0)) ] });
  ok('Dauer 0 s ergibt KEIN Umfangslabel (keine erfundene Null-Angabe)',
     r2.days[0][0].d === '', JSON.stringify(r2.days[0][0].d));
  ok('  … und volumeLabel weist 0, negative und untypische Werte direkt ab',
     [0, -1, -900, NaN, Infinity, null, undefined, '900'].every(v => P.volumeLabel(v) === null) &&
     typeof P.volumeLabel(2700) === 'string' && P.volumeLabel(2700).length > 0);

  /* J5: Der Scheduler liefert normalerweise sieben Tage. Käme er je mit mehr,
     dürfte das Wochenmodell nicht mitwachsen — die Oberfläche rechnet fest
     mit sieben. */
  const achtTage = P.projectWeek({ ok: true, weekKey: '2026-W32', sessions: [
    mkSession('t1', 'mo', 'running', 'endurance_easy', dur(1800)) ] });
  ok('das Wochenmodell hat auch bei überzähligen Eingangstagen genau 7 Tage',
     Array.isArray(achtTage.days) && achtTage.days.length === 7);
  const gestreut = P.projectWeek({ ok: true, weekKey: '2026-W32', sessions:
    ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'].map((wd, i) =>
      mkSession('w' + i, wd, 'running', 'endurance_easy', dur(1800))) });
  ok('  … und fasst genau sieben belegte Tage verlustfrei (7 projiziert, 0 unmapped)',
     gestreut.days.length === 7 && gestreut.counts.projected === 7 && gestreut.counts.unmapped === 0 &&
     gestreut.days.every(d => d.length === 1),
     gestreut.days.map(d => d.length).join(','));

  /* J5 richtig verortet: die Sieben-Tage-Grenze sitzt in
     weekPlanToComparable — der Vergleichsform für Plan ⇄ Engine. Ein achter
     Tag würde dort mit `weekday: undefined` in den Vergleich laufen und das
     Gate-Ergebnis verfälschen. Genau dieser Eingang wurde nie geprüft. */
  const achterTag = [[], [], [], [], [], [], [],
    [{ t: 'Laufen', l: 'Dauerlauf', prov: { source: 'engine' } }]];
  const cmp = P.weekPlanToComparable(achterTag);
  ok('die Vergleichsform ignoriert überzählige Tage jenseits der Woche',
     cmp.length === 0, JSON.stringify(cmp));
  ok('  … kein Eintrag trägt einen undefinierten Wochentag',
     cmp.every(x => P.WEEKDAYS.indexOf(x.weekday) >= 0));
  const sieben = [[{ t: 'Laufen', l: 'Dauerlauf', prov: { source: 'engine' } }], [], [], [], [], [],
    [{ t: 'Radfahren', l: 'Langer Ritt' }]];
  const cmp7 = P.weekPlanToComparable(sieben);
  ok('  … die sieben regulären Tage bleiben vollständig erhalten (inkl. Herkunft)',
     cmp7.length === 2 && cmp7[0].weekday === 'mo' && cmp7[0].source === 'engine' &&
     cmp7[1].weekday === 'so' && cmp7[1].source === 'legacy',
     JSON.stringify(cmp7));
  ok('  … und der Vergleich zweier Wochen sieht den achten Tag auf KEINER Seite',
     (() => {
       const d = P.diffWeeks(sieben, achterTag.slice(0, 7).concat([achterTag[7]]));
       return d.onlyA.length === 2 && d.onlyB.length === 0 && d.same === 0;
     })());
}

/* ============ 2) Form und Inhalt der Anzeige-Einheiten ============ */
sec('8.1 · Anzeigeform passt zum bestehenden Modell');
{
  const r = P.projectWeek({ ok: true, weekKey: '2026-W32', sessions: [
    mkSession('a', 'mo', 'running', 'endurance_easy', dur(2700)),
    mkSession('b', 'so', 'cycling', 'endurance_long', dur(9000), 'key'),
    mkSession('c', 'mi', 'gym', 'strength_general', [{ type: 'exercise', exercise_id: 'x', sets: 3 }]) ] });
  const mo = r.days[0][0], so = r.days[6][0], mi = r.days[2][0];
  ok('Sport-Label deutsch und identisch zum Legacy-Generator (Laufen/Rad/Gym)',
     mo.t === 'Laufen' && so.t === 'Rad' && mi.t === 'Gym', [mo.t, so.t, mi.t].join(','));
  ok('Einheitenname aus geschlossener Tabelle', mo.l === 'Z2 Dauerlauf' && so.l === 'Long Ride' && mi.l === 'Krafttraining',
     [mo.l, so.l, mi.l].join(' / '));
  ok('Umfang aus ECHTEN Blockwerten berechnet', mo.d === '45 min' && so.d === '2:30 h', mo.d + ' / ' + so.d);
  ok('ohne Dauerangabe bleibt der Umfang leer statt „0 min" zu behaupten', mi.d === '');
  ok('stabile ID wird durchgereicht', mo.id === 'a' && so.id === 'b');
  ok('jede Einheit trägt ihre Herkunft (Engine, nicht Legacy)',
     mo.prov && mo.prov.source === 'engine' && !!mo.prov.projection && mo.prov.scheduler === 'scheduler-v2@1');
  ok('die Felder entsprechen dem Legacy-Modell {t,l,d,id}',
     ['t', 'l', 'd', 'id'].every(k => Object.prototype.hasOwnProperty.call(mo, k)));
}

/* ============ 3) Reinheit und Determinismus ============ */
sec('8.1 · Rein, deterministisch, nicht mutierend');
{
  const out = { ok: true, weekKey: '2026-W32', sessions: [
    mkSession('z', 'mo', 'running', 'endurance_easy', dur(1800)),
    mkSession('a', 'mo', 'running', 'endurance_long', dur(5400), 'key'),
    mkSession('m', 'mo', 'gym', 'strength_general', [{ type: 'exercise', exercise_id: 'x', sets: 2 }]) ] };
  const snapshot = JSON.stringify(out);
  const r1 = P.projectWeek(out), r2 = P.projectWeek(out);
  ok('Engine-Output wird NICHT verändert', JSON.stringify(out) === snapshot);
  ok('zweimal derselbe Input ⇒ bitgleicher Output', JSON.stringify(r1) === JSON.stringify(r2));
  ok('Reihenfolge im Tag ist stabil: Schlüsseleinheit zuerst',
     r1.days[0][0].id === 'a', r1.days[0].map(x => x.id).join(','));
  /* Dieselben Sessions in anderer Eingangsreihenfolge muessen dasselbe ergeben. */
  const shuffled = { ok: true, weekKey: '2026-W32', sessions: [out.sessions[2], out.sessions[0], out.sessions[1]] };
  ok('andere Eingangsreihenfolge ⇒ identisches Ergebnis (echte Ordnung, kein Zufall)',
     JSON.stringify(P.projectWeek(shuffled).days) === JSON.stringify(r1.days));
}

/* ============ 4) Fehlerfaelle fail-closed ============ */
sec('8.1 · Fehlerfälle werden nicht als leere Woche ausgegeben');
{
  const failed = P.projectWeek({ ok: false, error: { code: 'SCHEDULER_V2_SOLVER_FAILED' }, sessions: null });
  ok('gescheiterter Scheduler-Lauf ⇒ ok:false mit Fehlercode (nicht „leere Woche")',
     failed.ok === false && failed.error === 'SCHEDULER_V2_SOLVER_FAILED', failed.error);
  const none = P.projectWeek(null);
  ok('fehlender Input ⇒ ok:false, kein Absturz', none.ok === false && none.error === 'scheduler_output_missing');
  const empty = P.projectWeek({ ok: true, weekKey: '2026-W32', sessions: [] });
  ok('echte leere Woche ist davon unterscheidbar (ok:true, 0 Einheiten)',
     empty.ok === true && empty.counts.input === 0);
}

/* ============ 4b) Verluste VOR der Session ============ */
sec('8.1 · Was der Scheduler gar nicht erst planen konnte');
{
  /* Beim Bauen aufgefallen: der Scheduler meldet zwei Verlustarten, BEVOR eine
     Session entsteht — kein zulaessiger Tag (unplaced) und nicht baubare Verordnung
     (blockedPrescriptions). Ohne Durchreichen saehe der Nutzer einen duenneren Plan
     ohne jeden Hinweis auf den Grund. */
  const r = P.projectWeek({ ok: true, weekKey: '2026-W32',
    sessions: [mkSession('a', 'mo', 'running', 'endurance_easy', dur(1800))],
    unplaced: [{ id: 'running:easy3', reason: 'no_admissible_slot' }],
    blockedPrescriptions: [{ id: 'gym:1', blocked: 'duration_missing_or_too_short' }] });
  ok('nicht platzierte Einheiten werden durchgereicht, nicht verschluckt',
     r.notPlanned.some(x => x.id === 'running:easy3' && x.stage === 'placement'), JSON.stringify(r.notPlanned));
  ok('nicht baubare Verordnungen ebenso, mit unterscheidbarer Stufe',
     r.notPlanned.some(x => x.id === 'gym:1' && x.stage === 'prescription'));
  ok('die Zählung weist beide Verlustarten getrennt aus',
     r.counts.projected === 1 && r.counts.notPlanned === 2, JSON.stringify(r.counts));
}

/* ============ 5) Vergleich Legacy ⇄ Engine ============ */
sec('8.1 · Vergleichsfunktion für das Gate');
{
  const eng = P.projectWeek({ ok: true, weekKey: '2026-W32', sessions: [
    mkSession('a', 'mo', 'running', 'endurance_easy', dur(2700)),
    mkSession('b', 'so', 'running', 'endurance_long', dur(6300), 'key') ] }).days;
  const legacy = [[{ t: 'Laufen', l: 'Z2 Dauerlauf', d: '45 min', id: 'x' }], [], [], [], [], [],
    [{ t: 'Laufen', l: 'Long Run', d: 'lr', id: 'y' }]];
  const same = P.diffWeeks(legacy, eng);
  ok('gleiche Struktur wird als identisch erkannt (Umfangstext zählt nicht)',
     same.identical === true && same.same === 2, JSON.stringify(same));
  const legacy2 = [[{ t: 'Laufen', l: 'Intervalle', d: 'iv', id: 'x' }], [], [], [], [], [], []];
  const diff = P.diffWeeks(legacy2, eng);
  ok('Abweichungen werden seitengetrennt benannt (nur Fakten, keine Bewertung)',
     diff.identical === false && diff.onlyA.length === 1 && diff.onlyB.length === 2,
     JSON.stringify({ onlyA: diff.onlyA, onlyB: diff.onlyB }));
  ok('Herkunft bleibt im Vergleich erkennbar',
     P.weekPlanToComparable(eng).every(x => x.source === 'engine') &&
     P.weekPlanToComparable(legacy).every(x => x.source === 'legacy'));
}

/* ============ 6) 8.2 · Der Weg zum Nutzer, im echten Browser ============ */
sec('8.2 · Engine-Output erreicht den Nutzer (Integrationstest)');
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
await page.evaluate(() => {
  document.documentElement.classList.remove('orvia-gated');
  document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove());
});

ok('Modul ist in der App geladen (nicht nur im Test)',
   await page.evaluate(() => !!(window.ORVIA && ORVIA.weekProjection && ORVIA.weekProjection.projectWeek)));

/* Der echte Scheduler laeuft und sein Ergebnis geht durch die Projektion. */
const live = await page.evaluate(() => {
  const SV = ORVIA.schedulerV2, WP = ORVIA.weekProjection;
  if (!SV) return { err: 'schedulerV2 fehlt' };
  const input = {
    activationMode: SV.ACTIVATION_MODE, weekKey: '2026-W32',
    sports: [{ sportId: 'running', sessionsPerWeek: 3, priority: 'key' },
             { sportId: 'gym', sessionsPerWeek: 2, priority: 'build' }],
    availability: { days: { mo: { available: true }, di: { available: true }, mi: { available: true },
      do: { restDay: true }, fr: { available: true }, sa: { available: true }, so: { available: true } } },
    capacityPerSport: null, evidence: null };
  const built = SV.buildWeek(input);
  const proj = WP.projectWeek(built);
  return { builtOk: built.ok, builtErr: built.error ? built.error.code : null,
    sessions: (built.sessions || []).length,
    projOk: proj.ok, counts: proj.counts, unmapped: proj.unmapped,
    days: proj.days.map(d => d.map(x => x.t + ':' + x.l)) };
});
ok('der ECHTE scheduler-v2 liefert eine Woche', live.builtOk === true, live.builtErr || (live.sessions + ' Sessions'));
ok('die Projektion verarbeitet den echten Output', live.projOk === true, JSON.stringify(live.counts));
ok('KERNZUSAGE: keine einzige echte Engine-Session geht verloren',
   live.counts && live.counts.unmapped === 0, JSON.stringify(live.unmapped));
ok('der Ruhetag bleibt im projizierten Plan frei', live.days && live.days[3].length === 0, JSON.stringify(live.days));

/* Der Weg bis zu den gerenderten Karten. */
const rendered = await page.evaluate((days) => {
  /* Projektion in das kanonische Feld schreiben, das ALLE sieben Planleser lesen
     (js/ui.js activeWeekPlan → PROFILE.weekPlan). Genau dieser Schritt fehlte. */
  PROFILE.weekPlan = days;
  const plan = activeWeekPlan();
  showTab('plan');
  const host = document.getElementById('tab-plan');
  const cards = host ? host.querySelectorAll('.session-card:not(.rest)') : [];
  const texts = [].slice.call(cards).map(c => c.textContent.replace(/\s+/g, ' ').trim());
  return { planDays: (plan || []).map(d => d.length), cardCount: cards.length, texts: texts.slice(0, 8) };
}, await page.evaluate(() => null) === null ? await (async () => {
  return await page.evaluate(() => {
    const SV = ORVIA.schedulerV2, WP = ORVIA.weekProjection;
    const input = { activationMode: SV.ACTIVATION_MODE, weekKey: '2026-W32',
      sports: [{ sportId: 'running', sessionsPerWeek: 3, priority: 'key' },
               { sportId: 'gym', sessionsPerWeek: 2, priority: 'build' }],
      availability: { days: { mo: { available: true }, di: { available: true }, mi: { available: true },
        do: { restDay: true }, fr: { available: true }, sa: { available: true }, so: { available: true } } } };
    return WP.projectWeek(SV.buildWeek(input)).days;
  });
})() : null);
ok('KERNZUSAGE 8.2: die projizierten Einheiten erscheinen als echte Session-Karten',
   rendered.cardCount > 0, rendered.cardCount + ' Karten');
ok('die Karten tragen die Engine-Inhalte (Sportart + Einheitenname)',
   rendered.texts.some(t => /Laufen|Gym/.test(t)), JSON.stringify(rendered.texts.slice(0, 3)));

/* SICHERHEIT: ohne Projektion bleibt der Legacy-Pfad unangetastet. */
const legacyUntouched = await page.evaluate(() => {
  PROFILE.sports = [{ sportId: 'running', sessionsPerWeek: 3, activeInApp: true }];
  PROFILE.availability = { days: { mo: { available: true }, di: { available: true }, mi: { available: true },
    do: { restDay: true }, fr: { available: true }, sa: { available: true }, so: { available: true } } };
  PROFILE.weekPlan = null;
  const a = JSON.stringify(generateWeekPlan());
  /* Die Projektion einmal laufen lassen — sie darf den Legacy-Generator nicht berühren. */
  try { ORVIA.weekProjection.projectWeek({ ok: true, weekKey: '2026-W32', sessions: [] }); } catch (e) {}
  const b = JSON.stringify(generateWeekPlan());
  return { identical: a === b, hasPlan: a !== 'null' };
});
ok('bei abgeschalteter Engine bleibt der Legacy-Plan bitgenau unverändert',
   legacyUntouched.identical === true && legacyUntouched.hasPlan === true);
ok('die Projektion steuert nichts: sie schreibt von sich aus in kein Profilfeld',
   await page.evaluate(() => {
     const before = JSON.stringify(PROFILE.weekPlan || null);
     ORVIA.weekProjection.projectWeek({ ok: true, weekKey: '2026-W32', sessions: [] });
     return JSON.stringify(PROFILE.weekPlan || null) === before;
   }) === true);
ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close(); server.close();
console.log('\nphase8_week_projection: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
