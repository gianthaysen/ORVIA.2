/* ORVIA · v8-313 — Zielprognose: die Engine wird gelesen statt vertröstet.

   BEFUND: Der Plan-Slot „Zielprognose" zeigte die String-Literale
   „vorsichtig — realistisch — optimistisch —" und den Satz „erscheint mit der
   externen Trainingsengine". Diese Engine liegt seit Langem im Haus:
   performance-zones.forecast() liefert exakt dieses Tripel und hatte im
   GESAMTEN Projekt null Aufrufer; goal-feasibility rechnete im Schattenbetrieb
   mit und wurde nur in einen per CSS ausgeblendeten Container gerendert.

   Dieser Test benutzt die ECHTEN Engine-Module (kein Mock des Rechners) und
   prueft VERHALTEN:
     Z1 der Korridor kommt aus der Engine und ist geordnet
     Z2 fehlende Leistung ⇒ kein erfundener Wert, aber ein benannter Grund
     Z3 das Unsicherheitsband waechst mit schlechterer Beleglage (sichtbar)
     Z4 die Zielzeit wird gegen die KONSERVATIVE Kante eingeordnet
     Z5 der Renderer zeigt echte Zahlen und nicht mehr den Vertroestungssatz

   node supabase/tests/goal_forecast_wiring_test.mjs [appRoot] */
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

/* ---- ECHTE Engine laden (evidence + performance-zones, keine Attrappe) ---- */
globalThis.ORVIA = globalThis.ORVIA || {};
await import(pathToFileURL(join(APP, 'js/engine/evidence.js')).href);
await import(pathToFileURL(join(APP, 'js/engine/performance-zones.js')).href);
const PZ = globalThis.ORVIA.performanceZones;
ok('echte Engine geladen (evidence + performance-zones)', !!(globalThis.ORVIA.evidence && PZ && typeof PZ.forecast === 'function'));

/* ---- Die zu pruefenden UI-Funktionen aus der Quelle ziehen ---- */
const viewSrc = sliceBalanced(uiRaw, 'function gmGoalForecastMin(') + '\n' +
                sliceBalanced(uiRaw, 'function gmGoalForecastView(');
const mkView = () => new Function('window', 'ORVIA',
  viewSrc + '\nreturn {view:gmGoalForecastView,fmt:gmGoalForecastMin};')(globalThis, globalThis.ORVIA);
const { view, fmt } = mkView();

const HM = 21.0975;
/* Eine echte, datierte 10-km-Referenz — genau die Datenlage eines Nutzers mit
   Garmin-Historie. Datum relativ zu heute, damit der Test nicht mit der Uhr
   kippt (der Fehler, der in v8-308 im Wiring-Fixture gefunden wurde). */
const today = new Date().toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const perfOf = kind => PZ.resolve({ today, races: [{ distanceKm: 10, durationMin: 48, date: daysAgo(20), kind }] });

/* ══════════════════════════════════════════════════════════════ */
sec('Z1 · Der Korridor kommt aus der Engine');
{
  const perf = perfOf('race');
  ok('die echte Engine loest die Referenz auf', perf.ok === true, 'confidence=' + perf.confidence);
  const v = view(perf, { distanceKm: HM, targetMin: 110 }, null);
  ok('Prognose vorhanden statt „—"', v.ok === true && v.realistic > 0, JSON.stringify({ c: v.cautious, r: v.realistic, o: v.optimistic }));
  ok('Korridor ist geordnet: optimistisch < realistisch < vorsichtig',
    v.optimistic < v.realistic && v.realistic < v.cautious);
  ok('die Werte sind NICHT die Engine-losen Platzhalter (0/null)',
    v.cautious > 0 && v.optimistic > 0 && v.bandPct > 0);
  /* Gegenprobe gegen den Rechner selbst: die UI erfindet nichts dazu. */
  const direct = PZ.forecast(perf, HM);
  ok('die UI reicht EXAKT die Engine-Zahlen durch (keine zweite Rechnung)',
    v.realistic === direct.realisticMin && v.cautious === direct.cautiousMin && v.optimistic === direct.optimisticMin);
  ok('HM-Prognose aus 10 km in 48 min ist fachlich plausibel (95–125 min)',
    v.realistic > 95 && v.realistic < 125, String(v.realistic));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z2 · Ohne Beleg keine Zahl — aber ein benannter Grund');
{
  const v = view({ ok: false, detail: 'keine Referenz', path: { prompt: 'Trage eine Bestzeit ein' } }, { distanceKm: HM, targetMin: 110 }, null);
  ok('keine Leistung ⇒ ok:false, KEIN erfundener Korridor',
    v.ok === false && v.realistic == null && v.cautious == null);
  ok('der Grund wird benannt, nicht verallgemeinert', v.reason === 'no_performance' && v.missing.length === 1);
  const v2 = view(perfOf('race'), { distanceKm: null, targetMin: 110 }, null);
  ok('ohne Zieldistanz: eigener Grund (nicht als fehlende Leistung ausgegeben)',
    v2.ok === false && v2.reason === 'no_goal_distance');
  /* LUECKE, DIE DIE MUTATIONSPROBE AUFDECKTE: Der Zweig „Leistung ist ok, aber
     die Prognose ist NICHT berechenbar" wurde von keinem Fall erreicht — die
     bisherigen Leerfaelle fielen schon eine Pruefung frueher durch. Genau dort
     saesse ein erfundener Ersatzwert am unauffaelligsten. */
  const brokenRef = { ok: true, confidence: 'moderate', ageRatio: 0.5, freshness: 'current',
    reference: { distanceKm: 0, durationMin: 0 } };
  const v4 = view(brokenRef, { distanceKm: HM, targetMin: 110 }, null);
  ok('Leistung ok, aber Prognose nicht berechenbar ⇒ KEIN Ersatzwert',
    v4.ok === false && v4.realistic == null && v4.cautious == null && v4.optimistic == null,
    'ok=' + v4.ok + ' r=' + v4.realistic);
  ok('… und der Grund kommt aus der Engine, nicht aus der UI',
    v4.reason === 'not_computable', String(v4.reason));
  /* Die Fail-closed-Regel des Evidenzvertrags bleibt unangetastet: ein
     Leistungswert OHNE Datum darf nicht entscheiden. */
  const undated = PZ.resolve({ today, races: [{ distanceKm: 10, durationMin: 48, date: null, kind: 'race' }] });
  const v3 = view(undated, { distanceKm: HM, targetMin: 110 },
    { status: 'insufficient_data', limitingFactors: ['current_performance_not_decision_eligible'] });
  ok('undatierte Referenz: die Feasibility-Sperre wird durchgereicht, nicht überschrieben',
    v3.missing.indexOf('current_performance_not_decision_eligible') >= 0 || v3.ok === false,
    'ok=' + v3.ok + ' missing=' + JSON.stringify(v3.missing));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z3 · Schlechtere Beleglage ⇒ sichtbar breiteres Band');
{
  const strong = view(perfOf('race'), { distanceKm: HM, targetMin: 110 }, null);
  /* Ein abgeleiteter Trainingslauf ist laut evidence.js 'moderate', ein
     Wettkampf 'strong' — das MUSS zu einem breiteren Band fuehren. */
  const weakPerf = PZ.resolve({ today, workouts: [{ distanceKm: 10, durationMin: 48, date: daysAgo(20), type: 'tempo' }] });
  const weak = view(weakPerf, { distanceKm: HM, targetMin: 110 }, null);
  ok('beide Belegstufen liefern eine Prognose', strong.ok === true && weak.ok === true);
  ok('schwaechere Beleglage ⇒ groesseres Unsicherheitsband',
    weak.bandPct > strong.bandPct, 'stark=' + strong.bandPct + '% schwach=' + weak.bandPct + '%');
  ok('die Belegstufe wird mitgefuehrt (nicht verschwiegen)',
    !!strong.confidence && !!weak.confidence, strong.confidence + ' / ' + weak.confidence);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z4 · Zielzeit gegen die KONSERVATIVE Kante');
{
  const perf = perfOf('race');
  const fc = PZ.forecast(perf, HM);
  const inside = view(perf, { distanceKm: HM, targetMin: Math.ceil(fc.cautiousMin) + 5 }, null);
  const edge = view(perf, { distanceKm: HM, targetMin: (fc.optimisticMin + fc.cautiousMin) / 2 }, null);
  const beyond = view(perf, { distanceKm: HM, targetMin: Math.floor(fc.optimisticMin) - 10 }, null);
  ok('Zielzeit oberhalb der vorsichtigen Kante ⇒ „likely"', inside.reachable === 'likely', String(inside.reachable));
  ok('Zielzeit zwischen optimistisch und vorsichtig ⇒ „edge"', edge.reachable === 'edge', String(edge.reachable));
  ok('Zielzeit unterhalb der optimistischen Kante ⇒ „beyond" (kein Schoenreden)',
    beyond.reachable === 'beyond', String(beyond.reachable));
  ok('ohne Zielzeit wird nichts eingeordnet', view(perf, { distanceKm: HM }, null).reachable === null);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z5 · Der Renderer zeigt Zahlen statt Vertroestung');
{
  const cardSrc = viewSrc + '\n' +
    'var GM_FEAS_TEXT=' + /var GM_FEAS_TEXT=\{[^;]*\};/.exec(uiRaw)[0].replace('var GM_FEAS_TEXT=', '') + '\n' +
    'var GM_MISSING_TEXT=' + /var GM_MISSING_TEXT=\{[^;]*\};/.exec(uiRaw)[0].replace('var GM_MISSING_TEXT=', '') + '\n' +
    sliceBalanced(uiRaw, 'function gmGoalForecastCard(');
  const perf = perfOf('race');
  const mkCard = goalObj => new Function('window', 'ORVIA', 'goalOf', 'gmEsc', 'icon', 'GM_NA',
    cardSrc + '\nreturn gmGoalForecastCard;')(globalThis, globalThis.ORVIA, () => goalObj,
      x => String(x == null ? '' : x), () => '<svg></svg>', 'Noch nicht verfügbar');

  const html = mkCard({ distanceKm: HM, targetMin: 110 })('f', { running: perf });
  const fcd = PZ.forecast(perf, HM);
  ok('die Karte enthaelt den echten realistischen Wert', html.indexOf(fmt(fcd.realisticMin)) >= 0, fmt(fcd.realisticMin));
  ok('alle drei Korridorwerte stehen in der Karte',
    html.indexOf(fmt(fcd.cautiousMin)) >= 0 && html.indexOf(fmt(fcd.optimisticMin)) >= 0);
  ok('DER ALTE ZUSTAND IST WEG: kein „erscheint mit der externen Trainingsengine"',
    html.indexOf('externen Trainingsengine') < 0);
  ok('kein nacktes „vorsichtig —" mehr, wenn Werte vorliegen',
    html.indexOf('vorsichtig —') < 0 && html.indexOf('realistisch —') < 0);
  ok('die Zielzeit wird eingeordnet', /Zielzeit/.test(html), html.slice(html.indexOf('mini-note')).slice(0, 120));

  /* Leerer Zustand: ehrlich, MIT Grund und MIT Weg — nicht mit Vertroestung. */
  const empty = mkCard({ distanceKm: HM, targetMin: 110 })('f', { running: { ok: false, path: { prompt: 'Bestzeit eintragen' } } });
  ok('leerer Zustand nennt den konkreten Mangel', /Es fehlt/.test(empty));
  ok('leerer Zustand bietet den Weg an (Leistung erfassen)', /gmOpenBestTimesEntry/.test(empty));
  ok('leerer Zustand vertroestet NICHT mehr auf eine externe Engine',
    empty.indexOf('externen Trainingsengine') < 0);
  ok('leerer Zustand erfindet keine Zahl', !/\d+:\d\d h/.test(empty));

  /* Quelltext-Vertrag: der produktive Renderer nutzt die Funktion wirklich. */
  ok('renderGMPlan ruft gmGoalForecastCard auf (kein toter Zweig)',
    /h\+=gmGoalForecastCard\(lvl,_perfBySport\);/.test(uiRaw));
  ok('die alten Literale sind aus dem Plan-Renderer entfernt',
    (uiRaw.match(/der Prognosekorridor erscheint mit der externen Trainingsengine/g) || []).length === 0);
}

console.log('\ngoal_forecast_wiring: ' + (fail === 0 ? 'ALL PASSED' : fail + ' FAILED') + ' (' + pass + ' ok)');
process.exit(fail === 0 ? 0 : 1);
