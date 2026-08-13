/* ORVIA · v8-315 — Die Woche wird adressierbar.

   BEFUND (Gian: „jede Folgewoche sieht gleich aus"): Der Plan-Renderer las
   activeWeekPlan() OHNE Wochenbezug. Der Versatz _wOff wirkte nur auf Datum und
   Ist-Aufloesung — der INHALT war immer die laufende Woche. Darin steckten zwei
   getrennte Probleme:
     1. WAHRHEIT: user_week_plans ist nach week_key adressiert und
        weekPlanRepository.get(weekKey) existiert. Lag fuer eine andere Woche ein
        EIGENER Plan vor, wurde er nicht gezeigt — stattdessen die laufende
        Woche mit fremdem Datum beschriftet.
     2. STRUKTUR: PROFILE.weekPlan ist per Konstruktion WIEDERKEHREND. Ohne
        eigenen Plan ist sie die ehrliche Antwort — aber als Vorschau kenntlich.

   Vertrag dieser Runde:
     W1 Offset 0 verhaelt sich UNVERAENDERT (kein Regress fuer die 7 Leser)
     W2 eigener Plan der Zielwoche gewinnt und wird als solcher ausgewiesen
     W3 ohne eigenen Plan: wiederkehrende Struktur, ehrlich als Vorschau
     W4 RIEGEL a — fremde Wochen werden NIE beobachtet (Observer-Reinheit)
     W5 RIEGEL b — der Vorschaupfad schreibt nichts (kein saveProfile/keine IDs)
     W6 KEINE erfundene Wochenvariation (Periodisierung bleibt Stufe 10)

   node supabase/tests/week_addressable_plan_test.mjs [appRoot] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const uiRaw = readFileSync(join(APP, 'js/ui.js'), 'utf8');

function sliceBalanced(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('Slice fehlt: ' + marker);
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') { d++; started = true; }
    else if (ch === '}') { d--; if (started && d === 0) {
      let k = j + 1; while (k < src.length && /\s/.test(src[k])) k++;
      return src.slice(i, src[k] === ';' ? k + 1 : j + 1);
    } }
  }
  throw new Error('unbalancierter Slice: ' + marker);
}

/* ---- ECHTES plan-domain (weekKeyFor/effectiveSessions), keine Attrappe ---- */
globalThis.ORVIA = globalThis.ORVIA || {};
globalThis.window = globalThis;
await import(pathToFileURL(join(APP, 'js/plan-domain.js')).href);
const PD = globalThis.ORVIA.planDomain;
ok('echtes plan-domain geladen', !!(PD && PD.weekKeyFor && PD.effectiveSessions));

/* ---- Sandbox mit BEOBACHTBAREN Nebenwirkungen ---- */
const FIXED_NOW = Date.UTC(2026, 7, 11, 10, 0, 0);          /* Di, 2026-08-11 */
const src = sliceBalanced(uiRaw, 'function gmWeekKeyForOffset(') + '\n' +
            sliceBalanced(uiRaw, 'function gmWeekPlanEnsure(') + '\n' +
            sliceBalanced(uiRaw, 'function gmPlanForOffset(') + '\n' +
            sliceBalanced(uiRaw, 'function gmRecurringBaselineDays(') + '\n' +
            'var _gmWeekCache={},_gmWeekLoading={};';

function mk(opts) {
  const o = opts || {};
  const spy = { observed: [], saved: 0, idAssign: 0, repoGets: [] };
  const RECUR = [[{ id: 'ps:a', t: 'Laufen', l: 'Intervalle', d: '40 min' }], [], [], [], [], [], []];
  const env = {
    orviaNowMs: () => FIXED_NOW,
    todayStr: d => { const x = d || new Date(FIXED_NOW); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); },
    PROFILE: { weekPlan: JSON.parse(JSON.stringify(RECUR)) },
    activeWeekPlan: () => { spy.observed.push('current'); return JSON.parse(JSON.stringify(RECUR)); },
    generateWeekPlan: () => { spy.idAssign++; return [[], [], [], [], [], [], []]; },
    alignPlanToAvailability: (p) => p,
    gmObserveWeekPlan: (w, s) => { spy.observed.push(s); return w; },
    saveProfile: () => { spy.saved++; },
    ensurePlannedSessionIds: () => { spy.idAssign++; return false; },
    gmCanonPlanOn: () => o.canonOn !== false,
    gmCanonPlanDomain: () => PD,
    gmCanonPlanRepo: () => ({ get: (wk) => { spy.repoGets.push(wk); return Promise.resolve(o.repo ? o.repo(wk) : { success: true, data: null }); } }),
    gmPlanWeekOff: () => 0,
    renderGMPlan: () => {}
  };
  const keys = Object.keys(env);
  const fn = new Function(...keys, 'window', 'ORVIA',
    src + '\nreturn {forOffset:gmPlanForOffset,weekKey:gmWeekKeyForOffset,ensure:gmWeekPlanEnsure,cache:function(){return _gmWeekCache;},setCache:function(k,v){_gmWeekCache[k]=v;}};')
    (...keys.map(k => env[k]), globalThis, globalThis.ORVIA);
  return { api: fn, spy, RECUR, env };
}

/* ══════════════════════════════════════════════════════════════ */
sec('W0 · Wochenschlüssel folgt der injizierten Uhr');
{
  const { api } = mk({});
  ok('Offset 0 ergibt die ISO-Woche von 2026-08-11', api.weekKey(0) === PD.weekKeyFor('2026-08-11'), api.weekKey(0));
  ok('Offset +1 ist die Folgewoche', api.weekKey(1) === PD.weekKeyFor('2026-08-18'), api.weekKey(1));
  ok('Offset −1 ist die Vorwoche', api.weekKey(-1) === PD.weekKeyFor('2026-08-04'), api.weekKey(-1));
  ok('Offset +1 ist NICHT gleich Offset 0 (der eigentliche Fehler)', api.weekKey(1) !== api.weekKey(0));
  ok('unbrauchbarer Versatz faellt auf 0 zurueck, nie NaN', api.weekKey(undefined) === api.weekKey(0));
}

/* ══════════════════════════════════════════════════════════════ */
sec('W1 · Offset 0 unveraendert — kein Regress fuer die bestehenden Leser');
{
  const { api, spy } = mk({});
  const r = api.forOffset(0);
  ok('Offset 0 geht durch activeWeekPlan()', spy.observed[0] === 'current');
  ok('Herkunft ist „current"', r.provenance === 'current');
  ok('Inhalt kommt unveraendert an', r.days[0][0].id === 'ps:a');
  ok('kein Repo-Zugriff fuer die laufende Woche (gmCanonPlanEnsure bleibt zustaendig)', spy.repoGets.length === 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('W2 · Eigener Plan der Zielwoche gewinnt');
{
  const nextKey = PD.weekKeyFor('2026-08-18');
  const ownPlan = PD.fromLegacyWeekPlan(
    [[], [{ id: 'ps:z', t: 'Rad', l: 'Long Ride', d: '2 h' }], [], [], [], [], []],
    null, { weekKey: nextKey, now: '2026-08-10T00:00:00.000Z' });
  const { api, spy } = mk({});
  api.setCache(nextKey, ownPlan);
  const r = api.forOffset(1);
  ok('Herkunft ist „planned_week"', r.provenance === 'planned_week', r.provenance);
  ok('der EIGENE Plan der Zielwoche wird gezeigt, nicht die laufende Woche',
    r.days[1] && r.days[1][0] && r.days[1][0].l === 'Long Ride',
    JSON.stringify(r.days.map(d => d.length)));
  ok('DER ALTE FEHLER: es ist NICHT mehr die wiederkehrende Struktur',
    !(r.days[0] && r.days[0].length && r.days[0][0].l === 'Intervalle'));
  ok('der Wochenschluessel wird mitgeliefert', r.weekKey === nextKey);
}

/* ══════════════════════════════════════════════════════════════ */
sec('W3 · Ohne eigenen Plan: ehrliche Vorschau');
{
  const nextKey = PD.weekKeyFor('2026-08-18');
  const { api } = mk({});
  api.setCache(nextKey, null);
  const r = api.forOffset(1);
  ok('Herkunft ist „recurring_preview" — nicht als fester Plan ausgegeben',
    r.provenance === 'recurring_preview', r.provenance);
  ok('die wiederkehrende Struktur wird gezeigt (ehrliche Antwort, kein Leerbild)',
    r.days[0] && r.days[0][0] && r.days[0][0].l === 'Intervalle');
  /* Der Text zur Herkunft steht in ui.js und muss die Vorlaeufigkeit benennen. */
  const note = /var GM_PROV_NOTE=\{[\s\S]*?\};/.exec(uiRaw)[0];
  ok('der Vorschautext benennt, dass noch kein eigener Plan festgelegt ist',
    /noch kein eigener Plan/.test(note));
  ok('fuer „planned_week" gibt es KEINEN Vorschautext (sonst wuerde ein echter Plan kleingeredet)',
    /planned_week:\s*null/.test(note));
  ok('der Renderer weist die Herkunft im Markup aus', /data-gm-prov="/.test(uiRaw));
}

/* ══════════════════════════════════════════════════════════════ */
sec('W4 · RIEGEL a — fremde Wochen werden NIE beobachtet');
{
  const nextKey = PD.weekKeyFor('2026-08-18');
  const ownPlan = PD.fromLegacyWeekPlan([[{ id: 'ps:z', t: 'Rad', l: 'Long Ride', d: '2 h' }], [], [], [], [], [], []],
    null, { weekKey: nextKey, now: '2026-08-10T00:00:00.000Z' });
  const a = mk({}); a.api.setCache(nextKey, ownPlan); a.api.forOffset(1);
  ok('geplante Fremdwoche erzeugt KEINEN Observer-Eintrag', a.spy.observed.length === 0,
    JSON.stringify(a.spy.observed));
  const b = mk({}); b.api.setCache(nextKey, null); b.api.forOffset(1);
  ok('Vorschauwoche erzeugt KEINEN Observer-Eintrag', b.spy.observed.length === 0,
    JSON.stringify(b.spy.observed));
  const c = mk({}); c.api.setCache(PD.weekKeyFor('2026-08-04'), null); c.api.forOffset(-1);
  ok('auch die Vergangenheit wird nicht beobachtet', c.spy.observed.length === 0);
  /* Warum das zaehlt: der Snapshot des Observers traegt weekId = HEUTIGE Woche.
     Eine fremde Woche darin waere eine unbemerkt falsche Kalibrierungsgrundlage.
     KOMMENTARE ENTFERNEN: die erste Fassung dieser Probe war rot, weil der
     Quelltext den Namen im erklaerenden Kommentar („KEIN gmObserveWeekPlan")
     enthaelt. Gesucht ist der AUFRUF, nicht die Erwaehnung — sonst verbietet
     die Probe ausgerechnet die Dokumentation des Riegels. */
  const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  ok('Quelltext-Vertrag: im Fremdwochen-Pfad steht kein AUFRUF von gmObserveWeekPlan',
    !/gmObserveWeekPlan\s*\(/.test(stripComments(sliceBalanced(uiRaw, 'function gmPlanForOffset('))));
  ok('… und der Riegel ist im Quelltext ausdruecklich dokumentiert',
    /KEIN gmObserveWeekPlan/.test(sliceBalanced(uiRaw, 'function gmPlanForOffset(')));
}

/* ══════════════════════════════════════════════════════════════ */
sec('W5 · RIEGEL b — Blaettern veraendert nichts');
{
  const nextKey = PD.weekKeyFor('2026-08-18');
  const { api, spy, env } = mk({});
  api.setCache(nextKey, null);
  const r = api.forOffset(1);
  ok('kein saveProfile beim Blaettern', spy.saved === 0);
  ok('keine ID-Vergabe/Selbstheilung im Vorschaupfad', spy.idAssign === 0);
  /* GEGEN DIE ECHTE QUELLE pruefen, nicht gegen eine unbeteiligte Konstante:
     die erste Fassung verglich mit RECUR, das der Code nie anfasst — die
     Mutationsprobe „Referenz statt Kopie" blieb dadurch gruen. Der einzige
     aussagekraeftige Bezug ist PROFILE.weekPlan selbst. */
  const before = JSON.stringify(env.PROFILE.weekPlan);
  ok('Vorbedingung: der Vorschauinhalt entspricht PROFILE.weekPlan',
    JSON.stringify(r.days) === before);
  r.days[0].push({ id: 'ps:injected' });
  r.days[1].push({ id: 'ps:injected2' });
  ok('die zurueckgegebene Woche ist eine KOPIE — PROFILE.weekPlan bleibt unberuehrt',
    JSON.stringify(env.PROFILE.weekPlan) === before,
    JSON.stringify(env.PROFILE.weekPlan));
  /* Zweiter Aufruf muss wieder den ORIGINALZUSTAND liefern — sonst wuerde sich
     jede Blaetterbewegung im angezeigten Plan aufsummieren. */
  ok('erneutes Blaettern liefert den unveraenderten Ausgangszustand',
    JSON.stringify(api.forOffset(1).days) === before);
}

/* ══════════════════════════════════════════════════════════════ */
sec('W6 · Keine erfundene Wochenvariation');
{
  const k1 = PD.weekKeyFor('2026-08-18'), k2 = PD.weekKeyFor('2026-08-25');
  const { api } = mk({});
  api.setCache(k1, null); api.setCache(k2, null);
  const a = api.forOffset(1), b = api.forOffset(2);
  ok('zwei Vorschauwochen ohne eigenen Plan sind IDENTISCH — die UI erfindet keine Progression',
    JSON.stringify(a.days) === JSON.stringify(b.days));
  ok('… und beide sind ehrlich als Vorschau gekennzeichnet',
    a.provenance === 'recurring_preview' && b.provenance === 'recurring_preview');
  ok('kein Progressions-/Periodisierungsbegriff im Lesepfad (das ist Stufe 10)',
    !/progress|periodis|taper|deload/i.test(sliceBalanced(uiRaw, 'function gmPlanForOffset(')));
}

/* ══════════════════════════════════════════════════════════════ */
sec('W7 · Ladezustand und Ausfall');
{
  const nextKey = PD.weekKeyFor('2026-08-18');
  const { api, spy } = mk({});
  const r = api.forOffset(1);                       /* nichts im Cache ⇒ laedt nach */
  ok('unbekannte Woche stoesst genau einen Repo-Abruf an', spy.repoGets.length === 1 && spy.repoGets[0] === nextKey);
  ok('waehrend des Ladens: Herkunft „loading", aber sichtbarer Inhalt statt Leere',
    r.provenance === 'loading' && r.days[0].length === 1);
  const off = mk({ canonOn: false });
  const r2 = off.api.forOffset(1);
  ok('ohne kanonisches Modell: Vorschau statt Fehler', r2.provenance === 'recurring_preview');
  ok('… und kein Repo-Abruf', off.spy.repoGets.length === 0);
}

console.log('\nweek_addressable_plan: ' + (fail === 0 ? 'ALL PASSED' : fail + ' FAILED') + ' (' + pass + ' ok)');
process.exit(fail === 0 ? 0 : 1);
