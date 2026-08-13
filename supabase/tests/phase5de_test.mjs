/* ORVIA · Phase 5D/5E/5F (2026-08-05) — Bestandsplan-Migration, getrennte Schreibpfade
   und kanonischer Lesepfad.
   Kernvertraege: Engine-Baseline und Nutzer-Overrides ueberschreiben einander NIE mehr;
   Flag 'canonPlan' aus ⇒ exakt der Legacy-Pfad (Rollback). 5F: ALLE 7 Leser laufen
   durch activeWeekPlan() — geladen liefert sie den kanonischen effektiven Plan,
   sonst die (per Konstruktion identische) Projektion. Nie zwei Wahrheiten.
   node supabase/tests/phase5de_test.mjs [appRoot-absolut] */
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
/* Zwei Checkout-Layouts: Cloud (App unter ../../) und Geraet (App unter ../../../app). */
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
const R = f => readFileSync(join(APP, f), 'utf8');

/* ============ Pure Domain: diffEditedDays + baselineFromDays ============ */
const PD = require(join(APP, 'js/plan-domain.js'));
const T = '2026-08-05T10:00:00Z';
{
  const base = {
    planId: 'wp:x', weekKey: '2026-W32', revision: 1,
    baseline: { source: 'manual_seed', sessions: [
      { sessionId: 'ps:a', dayIndex: 0, session: { id: 'ps:a', t: 'Laufen', l: 'Longrun', dur: 90 } },
      { sessionId: 'ps:b', dayIndex: 2, session: { id: 'ps:b', t: 'Gym', l: 'Oberkörper', dur: 60 } },
      { sessionId: 'ps:c', dayIndex: 4, session: { id: 'ps:c', t: 'Laufen', l: 'Easy', dur: 40 } }
    ] },
    overrides: [], history: [{ revision: 1, at: T, reason: 'legacy_migration' }]
  };
  const eff = PD.effectiveSessions(base);
  /* Editor: Longrun Tag 0→3 · Gym-Dauer 60→75 · Easy geloescht · neue Rad-Einheit Tag 5 */
  const edited = [[], [], [], [{ id: 'ps:a', t: 'Laufen', l: 'Longrun', dur: 90 }], [],
    [{ id: 'ps:b', t: 'Gym', l: 'Oberkörper', dur: 75 }, { t: 'Rad', l: 'GA1', dur: 120 }], []];
  let seq = 0;
  const ovs = PD.diffEditedDays(eff, edited, { now: T, idFactory: () => 'ps:new' + (seq++), ovIdFactory: () => 'ov:' + (seq++) });
  const byType = {}; ovs.forEach(o => { byType[o.type] = (byType[o.type] || 0) + 1; });
  ok('diff: genau move+resize+skip+add — Gym-move zaehlt mit (Tag 2→5)',
     byType.move === 2 && byType.resize === 1 && byType.skip === 1 && byType.add === 1 && ovs.length === 5, JSON.stringify(byType));
  ok('diff: move ps:a → Tag 3, resize ps:b → 75, skip ps:c',
     ovs.some(o => o.type === 'move' && o.sessionId === 'ps:a' && o.dayIndex === 3)
     && ovs.some(o => o.type === 'resize' && o.sessionId === 'ps:b' && o.durationMin === 75)
     && ovs.some(o => o.type === 'skip' && o.sessionId === 'ps:c'));
  ok('diff: neue Einheit erhaelt frische ps:-ID (add)', ovs.some(o => o.type === 'add' && o.sessionId.indexOf('ps:new') === 0));
  /* Anwenden ⇒ effektiver Plan entspricht exakt der Editor-Ansicht */
  let p = base; ovs.forEach(o => { p = PD.applyOverride(p, Object.assign({ reason: 'user_manual', createdAt: T }, o)).plan; });
  const eff2 = PD.effectiveSessions(p);
  ok('diff⊕apply: effektiver Plan == Editor-Struktur (Tage 3 und 5 belegt, Rest leer)',
     eff2.days[3].length === 1 && eff2.days[5].length === 2 && eff2.days[0].length === 0 && eff2.days[2].length === 0 && eff2.days[4].length === 0);
  ok('diff⊕apply: Baseline blieb unangetastet (kein Durchschreiben)', base.baseline.sessions[0].dayIndex === 0);
  /* Inhaltliche Aenderung ⇒ replace statt resize */
  const edited2 = [[{ id: 'ps:a', t: 'Laufen', l: 'Intervalle 6×800', dur: 90 }], [], [{ id: 'ps:b', t: 'Gym', l: 'Oberkörper', dur: 60 }], [], [{ id: 'ps:c', t: 'Laufen', l: 'Easy', dur: 40 }], [], []];
  const ovs2 = PD.diffEditedDays(eff, edited2, { now: T });
  ok('diff: geaenderter Inhalt (Label) ⇒ replace, unveraenderte Einheiten erzeugen NICHTS',
     ovs2.length === 1 && ovs2[0].type === 'replace' && ovs2[0].sessionId === 'ps:a', JSON.stringify(ovs2.map(o => o.type)));

  /* baselineFromDays: ps bleibt, psg wird ersetzt + verlinkt (Rebase-Anker) */
  const days = [[{ id: 'ps:a', t: 'Laufen', l: 'Longrun', dur: 100 }], [{ id: 'psg:1:0:x', t: 'Laufen', l: 'Tempo', dur: 40 }], [{ t: 'Gym', l: 'Neu' }], [], [], [], []];
  const nb = PD.baselineFromDays(days, { source: 'engine', engineVersion: 'b1', generatedAt: T, idFactory: () => 'ps:eng' + (seq++) });
  ok('baselineFromDays: ps:-ID stabil uebernommen', nb.sessions[0].sessionId === 'ps:a' && !nb.sessions[0].predecessorSessionId);
  ok('baselineFromDays: psg:-ID ersetzt UND als predecessorSessionId verlinkt',
     nb.sessions[1].sessionId.indexOf('ps:') === 0 && nb.sessions[1].predecessorSessionId === 'psg:1:0:x');
  ok('baselineFromDays: Item ohne ID erhaelt frische ps:-ID', nb.sessions[2].sessionId.indexOf('ps:') === 0);
  /* DER Kernfall: Nutzer-Override an psg-Einheit + Engine-Rebase ⇒ dank
     predecessor-Link automatisch retargetet, KEIN Konflikt, KEIN Verlust. */
  const planPsg = JSON.parse(JSON.stringify(base));
  planPsg.baseline.sessions.push({ sessionId: 'psg:1:0:x', dayIndex: 1, session: { id: 'psg:1:0:x', t: 'Laufen', l: 'Tempo', dur: 45 } });
  planPsg.overrides = [{ overrideId: 'ov:u1', sessionId: 'psg:1:0:x', type: 'resize', durationMin: 50, reason: 'user_manual', createdAt: T }];
  const rb = PD.rebase(planPsg, nb, { now: T });
  ok('KERNFALL: Engine-Rebase erhaelt den Nutzer-Override (retarget via predecessor, kein Datenverlust)',
     rb.retargeted.length === 1 && rb.plan.overrides.some(o => o.type === 'resize' && o.sessionId === nb.sessions[1].sessionId),
     JSON.stringify({ retargeted: rb.retargeted, conflicts: rb.conflicts.length, dropped: rb.dropped.length }));
}

/* ============ Quelltext-Vertraege (ui.js) ============ */
const ui = R('js/ui.js');
ok('5D/5E · Flag canonPlan: Default AUS (NICHT im GM_P3_FLAGS-Default-Satz)',
   /gmFeatureFlag\('canonPlan'\)/.test(ui) && !/canonPlan:1/.test(ui));
ok('5D · Erstmigration verlustfrei via fromLegacyWeekPlan + KF-011-Stempel',
   /fromLegacyWeekPlan\(legacy,\(PROFILE&&PROFILE\.weekPlanMeta\)/.test(ui));
ok('5E · savePlanEdit: kanonischer Zweig schreibt OVERRIDES (Diff), Legacy-Pfad bleibt als Fallback erhalten',
   /gmCanonPlanSaveEdit\(JSON\.parse\(JSON\.stringify\(_planEdit\)\)\)/.test(ui)
   && /PROFILE\.weekPlan=JSON\.parse\(JSON\.stringify\(_planEdit\)\);_planMeta\('manual_edit'\)/.test(ui));
ok('5E · Engine-Anpassung: Baseline-Revision + Rebase statt Vollersatz (Flag-gated)',
   /gmCanonPlanEngineRebase\(PROFILE\.weekPlan,batchId\)/.test(ui) && /baselineFromDays\(adjustedDays/.test(ui));
ok('5E · Projektion: effektiver Plan → Legacy-Feld mit eigener Provenienz (EINE Wahrheit bis 5F)',
   /_planMeta\('canonical_projection'/.test(ui));
ok('5E · Konflikt-Badge am Plan + Sheet mit dokumentierter Aufloesung (Entscheidung ②)',
   /gmPlanConfBadge/.test(ui) && /gmOpenPlanConflictsSheet/.test(ui) && /gmCanonPlanDiscardConflict/.test(ui));
ok('5D · Beta-Toggle im Plan-⚙-Sheet mit 0030-Voraussetzung benannt',
   /Kanonisches Planmodell \(Beta\)/.test(ui) && /Migration 0030/.test(ui));
const swv = (R('sw.js').match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version >= 229, genau einmal', swv != null && Number(swv) >= 229 && (R('sw.js').match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

/* ============ LIVE: Flag aus = Legacy identisch · Flag an = getrennte Pfade ============ */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
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
await page.evaluate(() => { document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove()); document.documentElement.classList.remove('orvia-gated'); });

/* Flag AUS (Default): savePlanEdit laeuft exakt den Legacy-Pfad */
const off = await page.evaluate(() => {
  gmSetFeatureFlag('canonPlan', false);
  window._planEdit = [[{ id: 'ps:t1', t: 'Laufen', l: 'Testlauf', dur: 30 }], [], [], [], [], [], []];
  savePlanEdit();
  return { on: gmCanonPlanOn(), meta: PROFILE.weekPlanMeta && PROFILE.weekPlanMeta.source,
    plan0: PROFILE.weekPlan && PROFILE.weekPlan[0] && PROFILE.weekPlan[0][0] && PROFILE.weekPlan[0][0].l };
});
ok('LIVE Flag AUS · Legacy-Pfad unveraendert (manual_edit-Stempel, Vollersatz)',
   off.on === false && off.meta === 'manual_edit' && off.plan0 === 'Testlauf', JSON.stringify(off));

/* Flag AN + Repo-Stub: Editor ⇒ Overrides · Engine ⇒ Rebase, Override ueberlebt */
const on = await page.evaluate(async () => {
  gmSetFeatureFlag('canonPlan', true);
  const saved = [];
  ORVIA.repos = ORVIA.repos || {};
  ORVIA.repos.weekPlan = {
    get: async () => ({ success: true, data: null }),
    save: async (p) => { saved.push(JSON.parse(JSON.stringify(p))); return { success: true, data: p }; }
  };
  /* 5D: Erstmigration aus dem Legacy-Bestand (Testlauf von oben) */
  await new Promise(res => { gmCanonPlanEnsure(res); });
  const mig = _gmCanonPlan.plan;
  const migOkFlag = !!mig && mig.baseline.sessions.length === 1 && mig.history[0].reason === 'legacy_migration';
  /* 5E-Editor: Einheit verschieben + neue ergaenzen ⇒ Overrides, keine neue Baseline */
  const sid = mig.baseline.sessions[0].sessionId;
  window._planEdit = [[], [], [{ id: sid, t: 'Laufen', l: 'Testlauf', dur: 30 }], [], [{ t: 'Rad', l: 'GA1', dur: 60 }], [], []];
  savePlanEdit();
  const afterEdit = _gmCanonPlan.plan;
  const editOkFlag = afterEdit.overrides.length === 2 && afterEdit.revision === 1
    && afterEdit.overrides.some(o => o.type === 'move' && o.sessionId === sid)
    && afterEdit.overrides.some(o => o.type === 'add');
  const projOkFlag = PROFILE.weekPlanMeta.source === 'canonical_projection'
    && PROFILE.weekPlan[2].some(s => s.id === sid) && PROFILE.weekPlan[4].length === 1;
  /* 5E-Engine: neue Baseline behaelt die ps:-ID ⇒ Nutzer-move UEBERLEBT das Engine-Update */
  const adjusted = [[{ id: sid, t: 'Laufen', l: 'Testlauf', dur: 45 }], [], [], [], [], [], []];
  gmCanonPlanEngineRebase(adjusted, 'batch1');
  const afterEng = _gmCanonPlan.plan;
  const effDays = ORVIA.planDomain.effectiveSessions(afterEng).days;
  const engOkFlag = afterEng.revision === 2
    && afterEng.overrides.some(o => o.type === 'move' && o.sessionId === sid)   // Nutzer-Override erhalten!
    && effDays[2].some(s => s.id === sid && s.dur === 45)                        // Engine-Dauer + Nutzer-Tag
    && effDays[4].length === 1;                                                  // add-Override erhalten
  gmSetFeatureFlag('canonPlan', false);
  return { migOkFlag, editOkFlag, projOkFlag, engOkFlag, saves: saved.length,
    hist: afterEng.history.map(h => h.reason) };
});
ok('LIVE 5D · Erstmigration verlustfrei (Session uebernommen, Historie dokumentiert)', on.migOkFlag);
ok('LIVE 5E · Editor schreibt Overrides (move+add), Baseline-Revision unveraendert', on.editOkFlag);
ok('LIVE 5E · Projektion haelt PROFILE.weekPlan konsistent (canonical_projection)', on.projOkFlag);
ok('LIVE 5E · KERNVERTRAG: Engine-Update ueberschreibt Nutzer-Overrides NICHT mehr — beide Wirkungen im effektiven Plan',
   on.engOkFlag, JSON.stringify(on.hist));
ok('LIVE · jede Aenderung persistiert (Migration + Edit + Rebase = 3 Saves)', on.saves === 3, String(on.saves));

/* ---- 5F: activeWeekPlan() = EIN Umschaltpunkt fuer alle 7 Leser ---- */
const f5 = await page.evaluate(() => {
  const r = {};
  /* Flag AN, kanonischer Plan aus dem vorherigen Szenario ist noch geladen. */
  gmSetFeatureFlag('canonPlan', true);
  const sid = _gmCanonPlan.plan.baseline.sessions[0].sessionId;
  /* Verfuegbarkeits-Ausrichtung neutralisieren (Testprofil ohne Config unveraendert). */
  const canon = activeWeekPlan();
  r.canonRead = canon[2].some(s => s.id === sid) && canon[4].length === 1;   // move- und add-Override sichtbar
  /* Projektion und kanonischer Lesepfad: identische Wahrheit */
  r.sameTruth = JSON.stringify(canon.map(d => d.map(s => s.id))) === JSON.stringify(PROFILE.weekPlan.map(d => d.map(s => s.id)));
  /* Legacy-Feld manipulieren ⇒ Leser folgt trotzdem dem kanonischen Modell (SoT-Beweis) */
  const backup = JSON.parse(JSON.stringify(PROFILE.weekPlan));
  PROFILE.weekPlan = [[], [], [], [], [], [], []];
  const canon2 = activeWeekPlan();
  r.canonWins = canon2[2].some(s => s.id === sid);
  PROFILE.weekPlan = backup;
  /* Leeres kanonisches Modell ohne Overrides ⇒ Fallback (Generator/Legacy), kein leerer Zwangsplan */
  const saved = _gmCanonPlan.plan;
  _gmCanonPlan.plan = { planId: 'x', weekKey: _gmCanonPlan.weekKey, revision: 1, baseline: { source: 'legacy_migration', sessions: [] }, overrides: [], history: [{ revision: 1, reason: 'legacy_migration' }] };
  const empty = activeWeekPlan();
  r.emptyFallsBack = Array.isArray(empty) && empty.length === 7 && JSON.stringify(empty) !== JSON.stringify([[], [], [], [], [], [], []]);
  _gmCanonPlan.plan = saved;
  /* Flag AUS ⇒ Legacy-Pfad, kanonisches Modell ignoriert */
  gmSetFeatureFlag('canonPlan', false);
  PROFILE.weekPlan = [[{ id: 'ps:legacy1', t: 'Gym', l: 'LegacyOnly' }], [], [], [], [], [], []];
  const leg = activeWeekPlan();
  r.flagOffLegacy = leg[0].some(s => s.id === 'ps:legacy1') && !leg[2].some(s => s.id === sid);
  PROFILE.weekPlan = backup;
  return r;
});
ok('LIVE 5F · kanonischer Lesepfad liefert den effektiven Plan (Overrides sichtbar)', f5.canonRead);
ok('LIVE 5F · Projektion und kanonischer Pfad = EINE Wahrheit (bitidentische IDs)', f5.sameTruth);
ok('LIVE 5F · Source of Truth: manipuliertes Legacy-Feld wird vom Leser ignoriert', f5.canonWins);
ok('LIVE 5F · leeres kanonisches Modell ⇒ ehrlicher Fallback auf Generator/Legacy', f5.emptyFallsBack);
ok('LIVE 5F · Flag aus ⇒ reiner Legacy-Pfad (Rollback vollstaendig)', f5.flagOffLegacy);
ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close(); server.close();
console.log('\nphase5de: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
