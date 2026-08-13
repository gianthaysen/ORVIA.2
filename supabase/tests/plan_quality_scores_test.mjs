/* ORVIA · v8-316 — Planqualitäts-Subscores: der fehlende Rechner.

   BEFUND: Die sechs Kacheln (Zielabdeckung · Erholungsverteilung ·
   Belastungsbalance · Zeitmachbarkeit · Sportbalance · Datenqualität) standen
   dauerhaft auf „—" mit Balken 0 %. Anders als bei Zielprognose (v8-313) und
   adaptiver Einschätzung (v8-314) fehlte hier nicht die Verdrahtung, sondern
   der PRODUZENT: es existierte ausschliesslich der Validator
   engine-contracts.isPlanQuality(), der die sechs Feldnamen festschreibt.

   Geprüft wird VERHALTEN gegen den ECHTEN Validator und das ECHTE
   trainingDomain — nicht die Rechnung des Prüflings nachgebaut (Bauplan §17.8):
     Q1 Vertragstreue: isPlanQuality() akzeptiert die Ausgabe
     Q2 Reinheit: gleiche Eingabe ⇒ identische Ausgabe, Eingabe unverändert
     Q3 Unterscheidungskraft: ein schlechter Plan wird schlechter bewertet,
        UND der Grund wird benannt (nicht nur die Zahl)
     Q4 Nicht bewertbar ist NICHT „schlecht" — und zieht die Note nicht runter
     Q5 Zu wenig Bewertbares ⇒ insufficient_data statt einer erfundenen Note
     Q6 Sportarten werden normalisiert, nicht per Teilstring geraten
     Q7 Die Oberfläche schaut auf `applicable`, nicht auf die Zahl

   node supabase/tests/plan_quality_scores_test.mjs [appRoot] */
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
const htmlRaw = readFileSync(join(APP, 'index.html'), 'utf8');

globalThis.window = globalThis;
globalThis.ORVIA = globalThis.ORVIA || {};
await import(pathToFileURL(join(APP, 'js/training-domain.js')).href);
await import(pathToFileURL(join(APP, 'js/engine/engine-contracts.js')).href);
await import(pathToFileURL(join(APP, 'js/engine/plan-quality.js')).href);
const PQ = globalThis.ORVIA.planQuality;
const EC = globalThis.ORVIA.engineContracts;
ok('echtes plan-quality + engine-contracts + trainingDomain geladen',
  !!(PQ && PQ.evaluate && EC && EC.isPlanQuality && globalThis.ORVIA.trainingDomain));

/* Prädikate wie im Produkt (unitKind-Logik nachgestellt, aber NICHT die
   Bewertung — der Pruefling bekommt sie als Eingabe, wie im Renderer auch). */
const isHard = it => { const l = String((it && it.l) || '').toLowerCase(), d = (it && it.d);
  if (it && it.t === 'Gym') return false;
  return d === 'iv' || d === 'lr' || l.includes('interval') || l.includes('long') || l.includes('tempo') || l.includes('schwelle'); };
const isLong = it => { const l = String((it && it.l) || '').toLowerCase(); return (it && it.d) === 'lr' || l.includes('long'); };

const GOOD = [[{ t: 'Gym', l: 'Oberkörper' }], [{ t: 'Laufen', l: 'Intervalle', d: 'iv' }], [],
  [{ t: 'Laufen', l: 'Z2 Dauerlauf', d: 'ez' }], [{ t: 'Gym', l: 'Ganzkörper' }], [],
  [{ t: 'Laufen', l: 'Long Run', d: 'lr' }]];
const BASE = { isHardUnit: isHard, isLongUnit: isLong, level: 'fortgeschritten',
  goal: { type: 'half_marathon', distanceKm: 21.0975, targetMin: 110 },
  config: { targetDays: 5, availableDayIdx: [0, 1, 3, 4, 6] },
  activeSports: ['running', 'gym'], performance: { ok: true }, planProvenance: 'stored' };
const ev = o => PQ.evaluate(Object.assign({}, BASE, o));

/* ══════════════════════════════════════════════════════════════ */
sec('Q1 · Vertragstreue gegen den ECHTEN Validator');
{
  const r = ev({ days: GOOD });
  ok('isPlanQuality() akzeptiert die Ausgabe', EC.isPlanQuality(r) === true, JSON.stringify({ total: r.total }));
  ok('alle sechs Vertragsschlüssel sind belegt',
    ['goalCoverage', 'recoveryDistribution', 'loadBalance', 'timeFeasibility', 'sportBalance', 'dataQuality']
      .every(k => r.subscores[k] && typeof r.subscores[k].value === 'number'));
  ok('ruleVersion ist gesetzt (zwei Regelstände bleiben unterscheidbar)', typeof r.ruleVersion === 'string' && r.ruleVersion.length > 0, r.ruleVersion);
  ok('auch der insufficient_data-Fall bleibt vertragstreu',
    EC.isPlanQuality(PQ.evaluate({ days: null })) === true);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Q2 · Reinheit — gleiche Eingabe, gleiche Ausgabe');
{
  const input = Object.assign({ days: JSON.parse(JSON.stringify(GOOD)) }, BASE);
  const before = JSON.stringify(input.days);
  const a = JSON.stringify(PQ.evaluate(input)), b = JSON.stringify(PQ.evaluate(input));
  ok('zwei Läufe liefern identische Ergebnisse', a === b);
  ok('die Eingabe wird nicht mutiert', JSON.stringify(input.days) === before);
  const src = readFileSync(join(APP, 'js/engine/plan-quality.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  ok('kein DOM, keine Uhr, kein Zufall, kein Storage im Modul',
    !/document\.|window\.|Date\.now|new Date|Math\.random|localStorage/.test(src));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Q3 · Unterscheidungskraft — und der Grund wird benannt');
{
  const good = ev({ days: GOOD });
  /* Kein Ruhetag, harte Tage direkt hintereinander, Einheiten an gesperrten Tagen. */
  const BAD = [[{ t: 'Laufen', l: 'Intervalle', d: 'iv' }], [{ t: 'Laufen', l: 'Tempo' }],
    [{ t: 'Gym', l: 'Beine' }, { t: 'Laufen', l: 'Z2', d: 'ez' }], [{ t: 'Laufen', l: 'Long Run', d: 'lr' }],
    [{ t: 'Gym', l: 'Ganzkörper' }], [{ t: 'Laufen', l: 'Z2', d: 'ez' }], [{ t: 'Gym', l: 'Core' }]];
  const bad = ev({ days: BAD, config: { targetDays: 4, availableDayIdx: [0, 1, 3, 4, 6] } });
  ok('der schlechtere Plan bekommt die schlechtere Note', bad.total < good.total,
    good.total + ' → ' + bad.total);
  ok('fehlender Ruhetag wird benannt', bad.limitingFactors.includes('no_rest_day'));
  ok('harte Tage hintereinander werden benannt', bad.limitingFactors.includes('hard_days_adjacent'));
  ok('Einheiten an gesperrten Tagen werden benannt', bad.limitingFactors.includes('sessions_on_unavailable_days'));
  ok('die Erholungs-Kachel selbst faellt ab, nicht nur die Gesamtnote',
    bad.subscores.recoveryDistribution.value < good.subscores.recoveryDistribution.value);
  /* Gegenrichtung: EIN behobener Mangel muss die Note messbar heben. */
  const fixedRest = ev({ days: [[{ t: 'Laufen', l: 'Intervalle', d: 'iv' }], [], [{ t: 'Gym', l: 'Beine' }],
    [{ t: 'Laufen', l: 'Long Run', d: 'lr' }], [{ t: 'Gym', l: 'Ganzkörper' }], [], [{ t: 'Laufen', l: 'Z2', d: 'ez' }]],
    config: { targetDays: 5, availableDayIdx: [0, 1, 2, 3, 4, 5, 6] } });
  ok('mit Ruhetagen und Abstand steigt die Erholungsnote wieder',
    fixedRest.subscores.recoveryDistribution.value > bad.subscores.recoveryDistribution.value,
    bad.subscores.recoveryDistribution.value + ' → ' + fixedRest.subscores.recoveryDistribution.value);
  ok('fehlender Long Run wird als Zielabdeckungs-Mangel benannt',
    ev({ days: [[{ t: 'Laufen', l: 'Intervalle', d: 'iv' }], [], [{ t: 'Laufen', l: 'Z2', d: 'ez' }], [],
      [{ t: 'Laufen', l: 'Z2', d: 'ez' }], [], []] }).limitingFactors.includes('no_long_run'));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Q4 · Nicht bewertbar ist NICHT „schlecht"');
{
  const solo = ev({ days: GOOD, activeSports: ['running'] });
  ok('eine einzige aktive Sportart ⇒ Sportbalance nicht anwendbar',
    solo.subscores.sportBalance.applicable === false && solo.subscores.sportBalance.rating === 'insufficient_data');
  ok('… und die Zahl bleibt vertragskonform 0 (die Wahrheit steht im rating)',
    solo.subscores.sportBalance.value === 0);
  const both = ev({ days: GOOD });
  /* ENTSCHEIDEND: Der reine Läufer darf durch die fehlende Sportbalance NICHT
     schlechter dastehen als der Multisportler mit voller Sportbalance. */
  ok('der reine Läufer wird durch den fehlenden Subscore NICHT abgewertet',
    solo.total >= both.total - 1, both.total + ' vs ' + solo.total);
  ok('das anwendbare Gewicht sinkt entsprechend', solo.applicableWeight < both.applicableWeight,
    both.applicableWeight + ' → ' + solo.applicableWeight);
  const noAvail = ev({ days: GOOD, config: { targetDays: 5 } });
  ok('ohne gepflegte Verfügbarkeit: Zeitmachbarkeit mit schwachem Beleg statt Annahme',
    noAvail.subscores.timeFeasibility.evidence === 'weak');
  const noCfg = ev({ days: GOOD, config: null });
  ok('ganz ohne Konfiguration: Zeitmachbarkeit nicht anwendbar',
    noCfg.subscores.timeFeasibility.applicable === false);
  const noGoal = ev({ days: GOOD, goal: null });
  ok('ohne Ziel: Zielabdeckung nicht anwendbar (kein schlechter Plan, offene Frage)',
    noGoal.subscores.goalCoverage.applicable === false);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Q5 · Zu wenig Bewertbares ⇒ keine erfundene Note');
{
  const thin = PQ.evaluate({ days: GOOD, isHardUnit: isHard, level: 'fortgeschritten' });
  ok('ohne Ziel, Verfügbarkeit und Sportarten: status insufficient_data',
    thin.status === 'insufficient_data', thin.status + ' w=' + thin.applicableWeight);
  ok('… und total bleibt 0 statt einer Note aus zu wenig', thin.total === 0);
  ok('der Grund steht in limitingFactors', thin.limitingFactors.includes('too_little_evaluable'));
  ok('die Schwelle ist ein benannter Regelwert, keine Zufallszahl',
    typeof PQ.MIN_APPLICABLE_WEIGHT === 'number' && PQ.MIN_APPLICABLE_WEIGHT > 0);
  ok('bei vollem Kontext ist der status ok', ev({ days: GOOD }).status === 'ok');
  ok('leerer/ungültiger Plan ⇒ insufficient_data, kein Absturz',
    PQ.evaluate({ days: [] }).status === 'insufficient_data' &&
    PQ.evaluate(null).status === 'insufficient_data');
}

/* ══════════════════════════════════════════════════════════════ */
sec('Q6 · Sportarten werden normalisiert, nicht geraten');
{
  /* Der erste Entwurf verglich Teilstrings: 'running' gegen 'Laufen' traf nicht
     — ein Plan MIT Laufeinheit bekam faelschlich „Sportart fehlt im Plan". */
  const r = ev({ days: GOOD, activeSports: ['running', 'gym'] });
  ok('deutsche Planbezeichnung „Laufen" zaehlt fuer die Sportart running',
    r.subscores.sportBalance.value === 100 && !r.limitingFactors.includes('sport_not_in_plan'),
    'sportBalance=' + r.subscores.sportBalance.value);
  const missing = ev({ days: GOOD, activeSports: ['running', 'gym', 'swimming'] });
  ok('eine wirklich fehlende Sportart wird erkannt',
    missing.subscores.sportBalance.value < 100 && missing.limitingFactors.includes('sport_not_in_plan'),
    String(missing.subscores.sportBalance.value));
  ok('unbekannte Sportarten werten NICHT ab, sie zaehlen nur nicht mit',
    ev({ days: GOOD, activeSports: ['running', 'gym', 'quidditch'] }).subscores.sportBalance.value === 100);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Q7 · Die Oberfläche schaut auf `applicable`, nicht auf die Zahl');
{
  ok('index.html laedt das Modul', /js\/engine\/plan-quality\.js/.test(htmlRaw));
  ok('der Renderer nutzt die Engine statt Literalen',
    /var _pqEval=gmPlanQualityEval\(week,_perfBySport\);/.test(uiRaw) &&
    /var pqCells=gmPlanQualityCells\(_pqEval\);/.test(uiRaw));
  ok('DAS ALTE LITERAL IST WEG: keine fest verdrahtete „—"-Kachelzeile mehr',
    !/pqv" style="color:var\(--muted\)">—<\/div><div class="pq-track"><i style="width:0%"><\/i><\/div>'\;\}\)/.test(uiRaw));

  const cellsSrc = (() => { const i = uiRaw.indexOf('function gmPlanQualityCells(');
    let d = 0, st = false; for (let j = i; j < uiRaw.length; j++) { const c = uiRaw[j];
      if (c === '{') { d++; st = true; } else if (c === '}') { d--; if (st && d === 0) return uiRaw.slice(i, j + 1); } } return ''; })();
  const labels = /var GM_PQ_LABELS=\[[\s\S]*?\];/.exec(uiRaw)[0];
  const naText = /var GM_PQ_NA_TEXT=\{[\s\S]*?\};/.exec(uiRaw)[0];
  const cells = new Function('gmEsc', labels + '\n' + naText + '\n' + cellsSrc + '\nreturn gmPlanQualityCells;')(x => String(x == null ? '' : x));

  const solo = ev({ days: GOOD, activeSports: ['running'] });
  const html = cells(solo);
  ok('nicht anwendbare Kachel zeigt „—", NICHT die 0',
    /data-pq-key="sportBalance" data-pq-applicable="0"[\s\S]*?<div class="pqv"[^>]*>—<\/div>/.test(html));
  ok('… und nennt den Grund im Klartext', /nur eine Sportart aktiv/.test(html));
  ok('bewertbare Kacheln zeigen ihre Zahl und einen gefuellten Balken',
    /data-pq-key="recoveryDistribution" data-pq-applicable="1"/.test(html) &&
    new RegExp('width:' + solo.subscores.recoveryDistribution.value + '%').test(html));
  ok('alle sechs Kacheln erscheinen', (html.match(/data-pq-key=/g) || []).length === 6);
  ok('ohne Engine bleibt es beim ehrlichen „—" (kein Absturz, keine 0-Wertung)',
    (cells(null).match(/data-pq-applicable="0"/g) || []).length === 6 &&
    !/data-pq-applicable="1"/.test(cells(null)));
}

console.log('\nplan_quality_scores: ' + (fail === 0 ? 'ALL PASSED' : fail + ' FAILED') + ' (' + pass + ' ok)');
process.exit(fail === 0 ? 0 : 1);
