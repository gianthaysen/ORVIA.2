/* ============================================================
   ORVIA · plan_v14_s3b — Schnitt S3b (Plan-Tab, Delta v14)
   ------------------------------------------------------------
     A. adaptiveCard.statement(): EIN Satz + Pill aus dem View, Ehrlichkeits-Reihenfolge
     B. render(): Statement zuerst, Einzelheiten in <details>, leerer View ⇒ ''
     C. Plan-Tab: Adaptive VOR Planqualitaet (Statement vor Diagnose)
     D. Zustands-Badges: „Geplant" statt „—", genau EIN „Naechster Reiz" (Quelltextvertrag)
   node supabase/tests/plan_v14_s3b_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
import { tStub } from './_i18n-src.mjs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
global.window = global; global.ORVIA = { i18n: tStub() };
(0, eval)(rd('js/adaptive-card.js'));
const AC = global.ORVIA.adaptiveCard;
const V = (over) => Object.assign({ available: true, stale: false, observationStatus: 'complete', current: { sessions: 5, weeklyLoad: 300 }, recommendation: { direction: 'hold', deltaPct: 0, blocked: [], rationale: 'x' }, feasibility: null, wouldChange: { durations: [], removals: [], intensity: [] }, residualGap: null }, over || {});

sec('A · statement()');
{
  ok('A1 halten, nicht gesperrt ⇒ „Plan passt" (ready) + Gleichgewichtssatz', (s => s.kind === 'hold' && s.pill === 'ready' && /Gleichgewicht/.test(s.text) && s.pillText === 'Plan passt')(AC.statement(V())));
  ok('A2 mehr Umfang +8 % ohne Sperre ⇒ Empfehlung (ready) mit Delta', (s => s.kind === 'increase' && s.pill === 'ready' && /mehr Umfang \(\+8 %\)/.test(s.text))(AC.statement(V({ recommendation: { direction: 'increase', deltaPct: 8, blocked: [] } }))));
  ok('A3 weniger Umfang, gesperrt ⇒ Vorschlag (att) + „nicht automatisch angewendet"', (s => s.kind === 'reduce' && s.pill === 'att' && /weniger Umfang \(-12 %\)/.test(s.text) && /nicht automatisch angewendet/i.test(s.text))(AC.statement(V({ recommendation: { direction: 'reduce', deltaPct: -12, blocked: ['low_evidence'] } }))));
  ok('A4 provisional zaehlt als gesperrt', AC.statement(V({ recommendation: { direction: 'increase', deltaPct: 5, blocked: [], provisional: true } })).pill === 'att');
  ok('A5 veraltet schlaegt alles', (s => s.kind === 'stale' && s.pill === 'att' && s.pillText === 'Veraltet')(AC.statement(V({ stale: true, recommendation: { direction: 'increase', deltaPct: 5, blocked: [] } }))));
  ok('A6 fehlgeschlagen ⇒ keine Aussage', AC.statement(V({ observationStatus: 'failed' })).kind === 'failed');
  ok('A7 keine Richtung ⇒ keine Aussage (muted)', (s => s.kind === 'none' && s.pill === 'muted')(AC.statement(V({ recommendation: null }))) && AC.statement(V({ recommendation: { direction: 'unknown' } })).kind === 'none');
  ok('A8 nicht verfuegbar ⇒ null', AC.statement(null) === null && AC.statement({ available: false }) === null);
  ok('A9 kein roher Key im Text', ['hold', 'increase', 'reduce'].every(d => !/adc\./.test(AC.statement(V({ recommendation: { direction: d, deltaPct: 3, blocked: [] } })).text)));
}

sec('B · render()');
{
  const h = AC.render(V({ recommendation: { direction: 'increase', deltaPct: 6, blocked: ['low_evidence'], rationale: 'weil' } }));
  ok('B1 Statement steht ZUERST in der Karte', h.indexOf('adx-statement') < h.indexOf('adx-head') && /<div class="adx-card"[^>]*><div class="adx-statement"/.test(h));
  ok('B2 Einzelheiten in <details> mit Summary, Sperrgrund bleibt sichtbar (nicht verschwiegen)', /<details class="adx-details"><summary>[^<]+<\/summary>/.test(h) && /adx-blocked/.test(h) && h.indexOf('</details>') > h.indexOf('adx-foot'));
  ok('B3 data-kind traegt die Stufe', /data-kind="increase"/.test(h));
  ok('B4 leerer View ⇒ leer (fail-soft unveraendert)', AC.render(null) === '' && AC.render({ available: false }) === '');
  ok('B5 genau ein Statement, genau ein details', (h.match(/adx-statement/g) || []).length === 1 && (h.match(/<details/g) || []).length === 1);
}

sec('C/D · Plan-Tab Quelltextvertrag');
{
  const ui = rd('js/ui.js');
  const src = ui.slice(ui.indexOf('function renderGMPlan(){'), ui.indexOf('function gmPlannedStartSelection('));
  const iAd = src.indexOf("if(lvl!=='a')h+=gmAdaptiveSection();"), iPq = src.indexOf('data-gm-slot="plan-quality"'), iFc = src.indexOf('data-gm-slot="plan-goal-forecast"');
  ok('C1 Adaptive VOR Planqualitaet, Prognose danach', iAd > 0 && iAd < iPq && iPq < iFc);
  ok('C2 kein zweiter Aufruf mehr hinter der Prognose', (src.match(/gmAdaptiveSection\(\)/g) || []).length === 1);
  ok('D1 offene Einheit heisst „Geplant", nicht „—"', /_uiT\('ui\.geplant_badge'\)/.test(src) && !/:'—'\)\)\+'<\/span><\/div>'/.test(src));
  ok('D2 „Naechster Reiz" nur: offen, nicht entfallen, Kernreiz, laufende Woche, ab heute, einmal', /!done&&!pSkip&&isKeyU&&_wOff===0&&!_nextKeyMarked&&dayKeys\[di\]>=todayStr\(\)/.test(src) && /_nextKeyMarked=true/.test(src));
  const css = rd('styles.css');
  ok('D3 Badge-Stil .session-state.today (gold)', /\.session-state\.today\{[^}]*gold/.test(css));
  const de = rd('locales/de.js');
  ok('D4 Katalogtexte vorhanden', /'ui\.naechster_reiz': 'Nächster Reiz'/.test(de) && /'ui\.geplant_badge': 'Geplant'/.test(de) && /'adc\.stmt_pill_plan_passt'/.test(de));
}

sec('E · Prognose gross (v8-407)');
{
  const ui = rd('js/ui.js');
  const card = ui.slice(ui.indexOf('function gmGoalForecastCard('), ui.indexOf('/* S3b: Realismus-Block'));
  ok('E1 Kopf: realistischer Wert gross, Ziel und Abstand in % aus denselben Zahlen (keine neue Rechnung)', /class="fc-head"/.test(card) && /\(v\.realistic-v\.target\)\/v\.target\*1000\)\/10/.test(card) && /ui\.prognose_heute/.test(card));
  ok('E2 ohne Ziel: nur Prognose, ohne Prognose: kein Kopf', /if\(v\.realistic>0\)\{/.test(card) && /v\.target>0\?' · '/.test(card));
  ok('E3 Abstand farbig: ueber dem Ziel att, darunter ready', /\.fc-head i\.over\{color:var\(--attention\)\}\.fc-head i\.under\{color:var\(--ready\)\}/.test(rd('styles.css')));
}
sec('F · Engpass aus der Planqualitaet (v8-408)');
{
  const ui = rd('js/ui.js');
  const src = ui.match(/var GM_BOTTLENECK_KEY=\{[^;]*\};/)[0] + '\n' + (ui.match(/\n(function gmGoalBottleneckText\([^)]*\)\{[\s\S]*?\n\})\n/) || [])[1];
  globalThis._uiT = tStub().t;
  const f = new Function('_uiT', src + '\nreturn gmGoalBottleneckText;')(globalThis._uiT);
  ok('F1 Zielabdeckung-Limits werden benannt (kein Long Run · keine Qualitaetseinheit)', f({ subscores: { goalCoverage: { limiting: ['no_long_run', 'no_quality_session'] } } }) === 'kein Long Run · keine Qualitätseinheit');
  ok('F2 unbekannte Codes werden nicht angezeigt; ohne Limit null', f({ subscores: { goalCoverage: { limiting: ['goal_model'] } } }) === null && f(null) === null && f({ subscores: {} }) === null);
  ok('F3 Karte bekommt _pqEval (Renderer-Aufruf)', /h\+=gmGoalForecastCard\(lvl,_perfBySport,_pqEval\);/.test(ui) && /fc-bottleneck/.test(ui));
}
console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
