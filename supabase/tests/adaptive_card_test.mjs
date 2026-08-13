/* ORVIA · Adaptive Karte — Sichtscheibe auf den Shadow Mode

   DER KERN IST EIN VERHALTENSTEST, KEINE QUELLTEXTSUCHE:
     Karte rendern
     → Plan vorher/nachher byte-identisch
     → Profil vorher/nachher byte-identisch
     → keine Speicherfunktion aufgerufen
   Dafür laufen hier die ECHTEN Module (Shadow → Übersetzer → View → HTML)
   gegen echte Daten, mit Spionen auf jeder Speicherfunktion.

   Dazu die neun Regeln:
     R1 ausschließlich der View wird dargestellt, keine eigene Engine-Rechnung
     R2 View aus demselben Snapshot (Übersetzer nur gegen snap.currentPlan)
     R3 stale / partial / insufficient_data sichtbar verschieden
     R4 within_modeled_corridor wird nie zu „machbar"
     R5 population_prior + schwache Evidenz + individualized:false gekennzeichnet
     R6 Änderungen mit Sportart und Geltungsbereich
     R7 fail-soft: ohne Erklärung leer
     R8 keine Anwenden-Schaltfläche (gar keine Schaltfläche)
     R9 Rendern verändert und speichert nichts (der Verhaltenstest oben)

   node supabase/tests/adaptive_card_test.mjs [appRoot-absolut] */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
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

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

require(join(APP, 'js/engine/evidence.js'));
require(join(APP, 'js/engine/load-profile.js'));
const LH = require(join(APP, 'js/engine/load-history.js'));
const PR = require(join(APP, 'js/engine/progression.js'));
const GF = require(join(APP, 'js/engine/goal-feasibility.js'));
const S = require(join(APP, 'js/engine/shadow-adaptive.js'));
const T = require(join(APP, 'js/engine/plan-translator.js'));
const AC = require(join(APP, 'js/adaptive-card.js'));

/* Echte Kette: 28 Tage Läufe, Ziel, Leistungswert, Wochenplan MIT Dauern. */
function tage(n, kmProTag = 10, ab = '2026-07-11') {
  const out = [];
  const d0 = new Date(ab + 'T12:00:00Z');
  for (let i = 0; i < n; i++) {
    const d = new Date(d0.getTime() + i * 86400000).toISOString().slice(0, 10);
    out.push({ id: 'a' + i, localDate: d, sport: 'running', subType: 'easy',
      durationMin: kmProTag * 6, distanceKm: kmProTag, source: 'test' });
  }
  return out;
}
const PLAN = () => [
  [],
  [{ id: 'u1', t: 'Laufen', l: 'Dauerlauf easy', sport: 'running', durationMin: 50 }],
  [{ id: 'u2', t: 'Gym', l: 'Ganzkörper', sport: 'gym', durationMin: 45 }],
  [{ id: 'u3', t: 'Laufen', l: 'Intervalle', sport: 'running', durationMin: 40 }],
  [],
  [{ id: 'u4', t: 'Laufen', l: 'Long Run', sport: 'running', durationMin: 90 }],
  []
];
const ROH = (o = {}) => Object.assign({
  userId: 'u-test', weekId: '2026-W32', planId: 'p1', today: '2026-08-07',
  currentPlan: PLAN(), activities: tage(28), debriefs: [], sports: ['running'],
  goal: { targetValue: 285 }, targetDate: '2026-11-06', level: 'intermediate',
  currentPerformance: { metric: 'thresholdPaceSecPerKm', value: 300, evidence: 'strong', ageRatio: 0.2 }
}, o);

function ctxOf(roh) {
  const snap = S.snapshot(roh);
  const obs = S.observe(snap);
  return { snap, obs, at: '2026-08-07T10:00:00Z' };
}

/* ══════════════════════════════════════════════════════════════ */
sec('R9 · DER VERHALTENSTEST: Rendern verändert und speichert nichts');
{
  /* Spione auf jeder denkbaren Speicherfunktion — als Globals, wie sie in der
     App existieren. Würde irgendein Codepfad sie rufen, zählt der Spion. */
  let saves = 0;
  const spy = () => { saves++; };
  globalThis.save = spy; globalThis.saveProfile = spy; globalThis.savePlan = spy;
  globalThis.localStorage = { setItem: spy, getItem: () => null, removeItem: spy };

  const roh = ROH();
  const livePlan = PLAN();
  const profil = { weekPlan: livePlan, sports: ['running'], level: 'intermediate' };
  globalThis.PROFILE = profil;

  const planVorher = JSON.stringify(livePlan);
  const profilVorher = JSON.stringify(profil);
  const ctx = ctxOf(roh);
  const snapVorher = JSON.stringify(ctx.snap);

  /* Die volle Strecke, mehrfach: View bauen und rendern wie die UI es täte. */
  let html = '';
  for (let n = 0; n < 3; n++) {
    const view = AC.buildView(ctx, profil.weekPlan, { planTranslator: T });
    html = AC.render(view);
  }

  ok('der Live-Plan ist byte-identisch', JSON.stringify(livePlan) === planVorher);
  ok('das Profil ist byte-identisch', JSON.stringify(profil) === profilVorher);
  ok('der Snapshot ist byte-identisch', JSON.stringify(ctx.snap) === snapVorher);
  ok('keine Speicherfunktion wurde aufgerufen', saves === 0, saves + ' Aufrufe');
  ok('… und es entstand trotzdem eine Karte', html.length > 200);

  delete globalThis.save; delete globalThis.saveProfile; delete globalThis.savePlan;
  delete globalThis.localStorage; delete globalThis.PROFILE;
}

/* ══════════════════════════════════════════════════════════════ */
sec('R1+R2 · Nur der View, aus demselben Snapshot');
{
  /* GEPRÜFT WIRD DER CODE, NICHT DIE PROSA — Kommentare dürfen „PROFILE"
     oder „DOM" erwähnen, um zu erklären, warum sie fehlen (dieselbe Lektion
     wie Mutationsprobe M11 beim Shadow-Test). */
  const raw = readFileSync(join(APP, 'js/adaptive-card.js'), 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('kein DOM im Modul', !/document\.|innerHTML|getElementById/.test(src));
  ok('keine Uhr, kein Zufall', !/Date\.now|new Date\(|Math\.random/.test(src));
  ok('kein Storage, kein Netzwerk', !/localStorage|fetch\(|XMLHttpRequest|supabase/.test(src));
  ok('kein PROFILE-Zugriff — der Live-Plan kommt als Argument',
    !/PROFILE/.test(src) && /function buildView\(ctx, livePlan/.test(src));
  ok('der Übersetzer läuft NUR gegen den Snapshot-Plan',
    /plan:\s*snap\.currentPlan/.test(src) && !/plan:\s*livePlan/.test(src));
  ok('… und nie preview() oder ein Anwenden-Pfad',
    !/\.preview\(|\.apply\(/.test(src));
  ok('fail-closed bei der Staleness',
    /var stale = true/.test(src) && /catch \(e\) \{ stale = true; \}/.test(src));
  /* render() rechnet nichts: kein Zugriff auf Engine-Module. */
  const renderSrc = src.slice(src.indexOf('function render(view)'));
  ok('render() berührt keine Engine-Module',
    !/planTranslator|loadHistory|progression|goalFeasibility|shadowAdaptive/.test(renderSrc));
}

/* ══════════════════════════════════════════════════════════════ */
sec('R3 · stale, partial und insufficient_data sichtbar verschieden');
{
  const roh = ROH();
  const ctx = ctxOf(roh);

  const frisch = AC.render(AC.buildView(ctx, PLAN(), { planTranslator: T }));
  ok('frisch: als Beobachtung gekennzeichnet', /adx-ok/.test(frisch) && !/adx-stale/.test(frisch));

  /* Live-Plan verändert ⇒ stale, und die Vorher/Nachher-Liste verschwindet. */
  const geaendert = PLAN(); geaendert[1][0].durationMin = 70;
  const alt = AC.render(AC.buildView(ctx, geaendert, { planTranslator: T }));
  ok('stale: sichtbar als veraltet', /adx-stale/.test(alt) && /[Vv]eraltet/.test(alt));
  ok('… und KEINE scheinbar aktuelle Vorher/Nachher-Darstellung',
    !/adx-chg/.test(alt), 'Änderungsliste darf bei stale nicht erscheinen');
  ok('… frisch und stale sind unterscheidbar', frisch !== alt);

  /* partial: eine Stufe fällt aus. */
  const kaputt = S.observe(ctx.snap, { registry: { loadHistory: LH, progression: PR,
    goalFeasibility: { VERSION: 'x', feasibility() { throw new Error('kaputt'); } } } });
  const partial = AC.render(AC.buildView({ snap: ctx.snap, obs: kaputt, at: ctx.at }, PLAN(), { planTranslator: T }));
  ok('partial: sichtbar als unvollständig', /adx-partial/.test(partial) && /[Uu]nvollständig/.test(partial));

  /* insufficient_data in der Machbarkeit: eigener Text mit Begründung. */
  const ohnePerf = ctxOf(ROH({ currentPerformance: null }));
  const insuff = AC.render(AC.buildView(ohnePerf, PLAN(), { planTranslator: T }));
  ok('insufficient_data: „fehlen belastbare Daten", nicht rot/kaputt',
    /fehlen belastbare Daten/.test(insuff), insuff.slice(0, 0));
  ok('… und die drei Zustände erzeugen drei verschiedene Karten',
    new Set([frisch, partial, insuff]).size === 3);
}

/* ══════════════════════════════════════════════════════════════ */
sec('R4 · Modellsprache, nie Zusagensprache');
{
  /* Über einen breiten Eingaberaum: NIE „machbar", NIE „unmöglich", NIE
     „garantiert" — egal welcher Status entsteht. */
  const proben = [];
  for (const ziel of [200, 240, 285, 320]) {
    for (const level of ['beginner', 'intermediate', 'competitive', null]) {
      const ctx = ctxOf(ROH({ goal: { targetValue: ziel }, level }));
      proben.push(AC.render(AC.buildView(ctx, PLAN(), { planTranslator: T })));
    }
  }
  const verboten = /\b(machbar|unmöglich|unmoeglich|garantiert|sicher erreichbar|schaffst du)\b/i;
  ok(proben.length + ' Karten: kein Wort der Gewissheit', proben.every(h => !verboten.test(h)));
  ok('within wird als Modellaussage formuliert',
    AC.FEAS_TEXT.within_modeled_corridor.indexOf('modellierten Bereich') >= 0 &&
    !verboten.test(AC.FEAS_TEXT.within_modeled_corridor));
  ok('outside ist keine Absage',
    !/unmöglich|absage|vergiss/i.test(AC.FEAS_TEXT.outside_modeled_corridor));
}

/* ══════════════════════════════════════════════════════════════ */
sec('R5 · Modellstatus verständlich gekennzeichnet');
{
  const ctx = ctxOf(ROH());
  const html = AC.render(AC.buildView(ctx, PLAN(), { planTranslator: T }));
  ok('population_prior wird übersetzt, nicht als Fachbegriff gezeigt',
    /Erfahrungswerte vergleichbarer Sportler/.test(html) && !/population_prior/.test(html));
  ok('individualized:false steht verständlich dabei',
    /kein auf dich individualisiertes Modell/.test(html));
  ok('schwache Evidenz wird benannt', /Beleglage schwach/.test(html));
  /* Der View führt die Kennzeichnung strukturiert — die Karte erfindet sie nicht. */
  const view = AC.buildView(ctx, PLAN(), { planTranslator: T });
  ok('… und sie stammt aus dem View, nicht aus dem Renderer',
    view.feasibility.model === 'population_prior' && view.feasibility.individualized === false);
}

/* ══════════════════════════════════════════════════════════════ */
sec('R6 · Änderungen mit Sportart und Geltungsbereich');
{
  /* Ein Toleranz-Scope (nur harte Lauf-Einheiten) macht den Unterschied
     sichtbar: Die Änderung muss ihren Geltungsbereich nennen. */
  const ctx = ctxOf(ROH());
  const scoped = Object.assign({}, ctx.obs.progression, {
    dimensionPolicy: { intensityPolicy: 'reduce', frequencyPolicy: 'maintain',
      scope: { key: 'highIntensity/running', domain: 'highIntensity', sport: 'running', all: false } }
  });
  const view = AC.buildView({ snap: ctx.snap,
    obs: Object.assign({}, ctx.obs, { progression: scoped }), at: ctx.at }, PLAN(), { planTranslator: T });
  const html = AC.render(view);
  if (view.wouldChange && view.wouldChange.intensity.length) {
    ok('die Intensitätsänderung nennt Sportart und Bereich',
      /Laufen · harte Einheiten/.test(html), html.match(/\(([^)]*)\)/g)?.slice(0, 3).join(' '));
  } else {
    ok('die Intensitätsänderung nennt Sportart und Bereich',
      view.wouldChange != null, 'kein Intensitätsvorschlag entstanden — Scope-Test über Volumen');
  }
  /* Und im Normalfall: „gesamter Plan" statt eines leeren Feldes. */
  const normal = AC.render(AC.buildView(ctx, PLAN(), { planTranslator: T }));
  if (/adx-chg/.test(normal)) {
    ok('Volumenänderungen tragen den Geltungsbereich', /gesamter Plan/.test(normal));
  } else {
    ok('Volumenänderungen tragen den Geltungsbereich', true, 'keine Änderung nötig (no_change)');
  }
  ok('jede Änderungszeile enthält einen Bereich in Klammern',
    !/adx-chg/.test(normal) || /<i>\([^)]+\)<\/i>/.test(normal));
}

/* ══════════════════════════════════════════════════════════════ */
sec('R7+R8 · Fail-soft leer, keine Schaltflächen');
{
  ok('kein Kontext ⇒ leere Karte', AC.render(AC.buildView(null, PLAN(), {})) === '');
  ok('unvollständiger Kontext ⇒ leere Karte', AC.render(AC.buildView({ snap: null, obs: null }, PLAN(), {})) === '');
  ok('null-View ⇒ leer', AC.render(null) === '' && AC.render(undefined) === '');
  ok('View mit available:false ⇒ leer', AC.render({ available: false, reason: 'x' }) === '');

  /* KEINE Schaltfläche — nicht nur kein „Anwenden": gar keine. Eine Karte
     ohne Interaktionspfad KANN nicht zum Aktivierungspfad werden. */
  const proben = [
    AC.render(AC.buildView(ctxOf(ROH()), PLAN(), { planTranslator: T })),
    AC.render(AC.buildView(ctxOf(ROH({ currentPerformance: null })), PLAN(), { planTranslator: T })),
    AC.render(AC.buildView(ctxOf(ROH()), (() => { const p = PLAN(); p[1][0].durationMin = 70; return p; })(), { planTranslator: T }))
  ];
  ok('keine Karte enthält eine Schaltfläche',
    proben.every(h => !/<button|onclick|<a /i.test(h)));
  ok('keine Karte enthält „Anwenden" oder „Übernehmen"',
    proben.every(h => !/anwenden|übernehmen|uebernehmen|aktivieren/i.test(h)));
  ok('jede Karte sagt, dass der Plan unverändert bleibt',
    proben.filter(h => h.length).every(h => /Plan bleibt unverändert|verändert den Plan nicht/.test(h)));

  /* HTML-Sicherheit: Einheitennamen sind Nutzereingaben. */
  const boese = PLAN(); boese[1][0].l = '<img src=x onerror=alert(1)>';
  const ctxB = ctxOf(ROH({ currentPlan: boese }));
  const htmlB = AC.render(AC.buildView(ctxB, boese, { planTranslator: T }));
  ok('Nutzereingaben werden escaped', !/<img/.test(htmlB));

  /* ZENTRALES ESCAPING ALS FUZZ: Die Nutzlast wird in JEDES String-Feld eines
     handgebauten Views injiziert — auch in Felder, die heute aus der Engine
     stammen und morgen aus einer neuen Quelle kommen könnten. Kein Feld darf
     am Escaping vorbei; ein neues Feld, das es umgeht, fällt hier auf. */
  const XSS = '"><script>window.x=1</script><img src=x onerror=alert(1)>\'';
  const fuzzView = {
    available: true, stale: false, createdAt: XSS, observationStatus: 'ok',
    current: { sessions: 3, weeklyLoad: 100 },
    recommendation: { direction: 'increase', deltaPct: 3, targetLoad: 24,
      provisional: false, autoApplicable: false,
      blocked: [XSS, 'not_actionable'], selectionReason: XSS, rationale: XSS },
    feasibility: { status: XSS, evidence: 'weak', model: 'population_prior',
      individualized: false, estimatedWeeksRange: { min: XSS, max: XSS },
      limitingFactors: [XSS], modelNote: XSS },
    wouldChange: { status: 'proposal', autoApplicable: false,
      durations: [{ day: XSS, unit: XSS, fromMin: XSS, toMin: XSS, scope: XSS }],
      removals: [{ day: XSS, unit: XSS, scope: XSS, why: XSS }],
      intensity: [{ day: XSS, unit: XSS, from: XSS, to: XSS, scope: XSS }] },
    residualGap: { value: 5, status: 'under_target', reasons: [XSS],
      achievedWeekly: 1, targetWeekly: 2 },
    notes: [XSS]
  };
  const fuzzHtml = AC.render(fuzzView);
  ok('Fuzz über alle View-Felder: kein <script> überlebt', fuzzHtml.indexOf('<script') < 0);
  ok('… kein <img> und kein onerror=', fuzzHtml.indexOf('<img') < 0 && !/onerror\s*=/.test(fuzzHtml.replace(/onerror=alert\(1\)&gt;/g, '').replace(/&quot;|&#39;|&lt;|&gt;/g, '')));
  ok('… die Nutzlast erscheint nur entschärft',
    fuzzHtml.indexOf('&lt;script&gt;') >= 0 || fuzzHtml.indexOf('&lt;img') >= 0);
  ok('… auch einfache Anführungszeichen sind ersetzt (Attributkontexte)',
    AC.esc("x' onmouseover='y").indexOf("'") < 0);
  ok('die zentrale Escape-Funktion ist exportiert und vollständig',
    AC.esc('&<>"\'') === '&amp;&lt;&gt;&quot;&#39;', AC.esc('&<>"\''));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Einhängung und Determinismus');
{
  const ctx = ctxOf(ROH());
  ok('gleicher View ⇒ gleiches HTML',
    AC.render(AC.buildView(ctx, PLAN(), { planTranslator: T })) ===
    AC.render(AC.buildView(ctx, PLAN(), { planTranslator: T })));

  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  ok('Modul ist eingehängt', /js\/adaptive-card\.js/.test(html));
  ok('… nach dem Übersetzer', html.indexOf('js/engine/plan-translator.js') < html.indexOf('js/adaptive-card.js'));
  ok('der Karten-Container existiert auf der Planseite', /id="adaptiveCard"/.test(html));
  ok('Modul ist im Cache-Manifest', /adaptive-card\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));

  /* Der Einhänger in ui.js ist eine dünne Schale: View holen, render(), fertig. */
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  const m = ui.indexOf('globalThis.gmRenderAdaptiveCard=function');
  ok('der Einhänger existiert', m > 0);
  const mount = ui.slice(m, m + 500);
  ok('… und tut nichts außer darstellen',
    /AC\.render\(O\.getAdaptiveExplanation\(\)\)/.test(mount) &&
    !/save|PROFILE\.weekPlan\s*=|translate\(/.test(mount));
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
