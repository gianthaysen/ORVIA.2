/* ORVIA · v8-332 — die Vorschau im ECHTEN Browser.

   Der Modultest belegt, dass die Verordnung lesbar wird. Er belegt NICHT,
   dass die Oberfläche sie auch zeigt — genau diese Lücke zwischen „Modul
   rechnet richtig" und „Nutzer sieht es" war der Grund, warum die Engine
   monatelang unbemerkt ins Leere rechnete.

   Geprüft wird deshalb an der laufenden App: Modul geladen, Abschnitt da,
   Zeilen kommen aus dem echten Formatierer — und, am wichtigsten, die
   Vorschau fasst den Plan NICHT an.

   node supabase/tests/rx_preview_ui_test.mjs */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = (function () {
  const _p = require('node:path');
  const _h = _p.dirname(new (globalThis.URL || require('node:url').URL)(import.meta.url).pathname);
  const _cands = [null, _p.join(_h, '..', '..'), _p.join(_h, '..', '..', 'app'),
    _p.join(_h, '..', '..', '_dev'), _p.join(_h, '..', '..', '..')];
  for (const c of _cands) {
    try { return require(c ? _p.join(c, 'node_modules', 'playwright') : 'playwright'); }
    catch (_e) { }
  }
  console.log('⏭️  ÜBERSPRUNGEN — playwright ist in dieser Umgebung nicht installiert');
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

sec('Modul und Abschnitt sind in der echten App vorhanden');
ok('prescription-format ist geladen (nicht nur im Modultest)',
  await page.evaluate(() => !!(window.ORVIA && ORVIA.prescriptionFormat && ORVIA.prescriptionFormat.formatPrescription)));
ok('die Vorschau ist als Funktion erreichbar',
  await page.evaluate(() => typeof window.gmRxPreviewSection === 'function' && typeof window.gmRxPreviewBuild === 'function'));
ok('sie hängt im Profil unter „Geräte & Datenquellen"',
  await page.evaluate(() => /Trainingsplan-Vorschau/.test(String(gmProfConnections()))));

sec('Der Abschnitt rendert — ohne den Plan anzufassen');
{
  const r = await page.evaluate(() => {
    const html = gmRxPreviewSection();
    return { html: html, hatKnopf: /gmRxPreviewBuild\(\)/.test(html),
      sagtEsAendertNichts: /NICHT verändert|nicht verändert/.test(html),
      sagtNichtZuAbsolut: !/es wird nichts gespeichert/.test(html) };
  });
  ok('der Abschnitt trägt einen Auslöser', r.hatKnopf);
  ok('  … und sagt ausdrücklich, dass der Plan unberührt bleibt', r.sagtEsAendertNichts);
  ok('  … ohne die zu absolute Behauptung „es wird nichts gespeichert" (der Schatten-Eintrag entsteht doch)',
    r.sagtNichtZuAbsolut);
  ok('  … und enthält kein rohes undefined/null im Markup',
    !/undefined|>null</.test(r.html), r.html.slice(0, 160));
}

sec('Echte Verordnung ⇒ echte Zeilen in der Karte');
{
  const r = await page.evaluate(() => {
    const PF = ORVIA.prescriptionFactory || window.prescriptionFactory;
    const WP = ORVIA.weekProjection;
    const rx = (PF && PF.buildPrescription ? PF : ORVIA.prescriptionFactory)
      .buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 60 },
        { thresholdPaceSecPerKm: 300, confidence: 'high' }).workout;
    const proj = WP.projectWeek({ ok: true, weekKey: '2026-W33', sessions: [
      { sessionId: 's1', weekday: 'di', sportId: 'running', prescription: rx,
        provenance: { scheduler: 'scheduler-v2@1' } }] });
    const it = proj.days[1][0];
    return { html: gmRxPreviewUnitHTML(it), hatRx: !!(it && it.rx) };
  });
  ok('die Verordnung liegt am Anzeige-Item an', r.hatRx);
  ok('die Karte zeigt die Wiederholungsgruppe mit Pace-Fenster statt nur einer Dauer',
    /× \(/.test(r.html) && /min\/km/.test(r.html), r.html.replace(/<[^>]+>/g, ' ').trim().slice(0, 140));
  ok('  … Sportart und Einheitenname stehen weiterhin oben',
    /Laufen/.test(r.html) && /Intervalle/.test(r.html));
}

sec('Die ECHTE Wochenkarte zeigt die Vorgabe (nicht nur die Vorschau)');
{
  const r = await page.evaluate(() => {
    const PF = ORVIA.prescriptionFactory, WP = ORVIA.weekProjection;
    const rx = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 60 },
      { thresholdPaceSecPerKm: 300, confidence: 'high' }).workout;
    const it = WP.projectWeek({ ok: true, weekKey: '2026-W33', sessions: [
      { sessionId: 'ps:x1', weekday: 'di', sportId: 'running', prescription: rx,
        provenance: { scheduler: 'scheduler-v2@1' } }] }).days[1][0];
    return {
      mitRx: gmRxLinesHTML(it),
      ohneRx: gmRxLinesHTML({ t: 'Laufen', l: 'Dauerlauf', d: '45 min' }),
      leer: gmRxLinesHTML({ rx: { blocks: [] } }),
      nichts: gmRxLinesHTML(null)
    };
  });
  ok('die Karte rendert die Verordnung als Liste',
    /<ul class="sc-plex sc-rx">/.test(r.mitRx) && /min\/km/.test(r.mitRx),
    r.mitRx.replace(/<[^>]+>/g, ' ').trim().slice(0, 130));
  ok('  … Aufwärmen und Auslaufen sind da, aber zurückgenommen',
    /sc-rx-soft/.test(r.mitRx) && /Aufwärmen/.test(r.mitRx) && /Auslaufen/.test(r.mitRx));
  ok('  … die Belastungszeile ist NICHT zurückgenommen',
    /<li>[^<]*× \(/.test(r.mitRx));
  ok('OHNE Verordnung bleibt die Karte Zeichen für Zeichen wie vorher (kein leerer Kasten)',
    r.ohneRx === '' && r.leer === '' && r.nichts === '');
}

sec('Ehrlicher Leerzustand');
{
  const r = await page.evaluate(() => ({
    ohneRx: gmRxPreviewUnitHTML({ t: 'Laufen', l: 'Dauerlauf', d: '45 min' }),
    kaputt: gmRxPreviewUnitHTML({ t: 'Laufen', l: 'Dauerlauf', d: '', rx: { blocks: [] } })
  }));
  ok('ohne Verordnung steht „keine Vorgabe" da — kein leerer Kasten, keine erfundene Zeile',
    /Keine Vorgabe/.test(r.ohneRx) && !/min\/km/.test(r.ohneRx));
  ok('bei unbrauchbarer Verordnung ebenso, mit Grund',
    /Keine darstellbare Vorgabe/.test(r.kaputt));
}

sec('Die Vorschau fasst den Plan nachweislich nicht an');
{
  const r = await page.evaluate(() => {
    const vorher = {
      ls: JSON.stringify(Object.keys(localStorage).sort()),
      plan: (typeof PROFILE !== 'undefined' && PROFILE) ? JSON.stringify(PROFILE.plan || null) : null,
      undo: (typeof PROFILE !== 'undefined' && PROFILE) ? (PROFILE._planEngineUndo || null) : null
    };
    const wochen = () => { try { return (ORVIA.engineShadow.weekReport().entries || []).length; } catch (e) { return -1; } };
    try { ORVIA.engineShadow.buildWeekNow(); } catch (e) { }   // Ausgangslage: ein Lauf hat schon stattgefunden
    const wochenVorher = wochen();
    let fehler = null;
    try { gmRxPreviewBuild(); } catch (e) { fehler = String(e); }
    const wochenNachher = wochen();
    const nachher = {
      ls: JSON.stringify(Object.keys(localStorage).sort()),
      plan: (typeof PROFILE !== 'undefined' && PROFILE) ? JSON.stringify(PROFILE.plan || null) : null,
      undo: (typeof PROFILE !== 'undefined' && PROFILE) ? (PROFILE._planEngineUndo || null) : null
    };
    return { vorher, nachher, fehler, wochenVorher, wochenNachher,
      neueKeys: Object.keys(localStorage).filter(k => vorher.ls.indexOf('"' + k + '"') < 0) };
  });
  ok('der Aufruf wirft nicht, auch wenn die Engine nichts liefern kann', r.fehler === null, r.fehler || '');
  /* PRAEZISE ZUSICHERUNG statt bequemer: buildWeekNow schreibt den ueblichen
     Schattenprotokoll-Eintrag — das ist bekannt und unschaedlich, weil er je
     Woche ERSETZT wird. Geprueft wird deshalb die Groesse, die wirklich
     zaehlt: die Zahl der protokollierten Wochen darf nicht wachsen, sonst
     verfaelschte die Vorschau das ≥14-Tage-Gate, auf dessen Basis spaeter
     ueber die Aktivierung entschieden wird. */
  ok('der einzige neue Speichereintrag ist das bekannte Schattenprotokoll',
    r.neueKeys.length === 0 || (r.neueKeys.length === 1 && /shadow/.test(r.neueKeys[0])),
    JSON.stringify(r.neueKeys));
  ok('die Zahl der protokollierten Wochen wächst NICHT (das ≥14-Tage-Gate bleibt unverfälscht)',
    r.wochenVorher === r.wochenNachher, r.wochenVorher + ' → ' + r.wochenNachher);
  ok('der Wochenplan ist unverändert', r.vorher.plan === r.nachher.plan);
  ok('es entsteht KEIN Rücknahme-Schnappschuss (nichts wurde aktiviert)',
    r.nachher.undo === r.vorher.undo);
}

sec('Keine Nebenwirkungen im Betrieb');
ok('die Profilseite baut sich mit dem neuen Abschnitt ohne Fehler',
  await page.evaluate(() => { try { gmProfConnections(); return true; } catch (e) { return false; } }));
ok('keine ungefangenen JS-Fehler auf der Seite', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close(); server.close();
console.log('\nrx_preview_ui: ' + (fail ? 'FEHLGESCHLAGEN' : 'ALL PASSED') + ' (' + pass + ' ok' + (fail ? (', ' + fail + ' fehlgeschlagen') : '') + ')');
process.exit(fail ? 1 : 0);
