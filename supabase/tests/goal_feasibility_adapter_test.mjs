/* ============================================================
   ORVIA · goal_feasibility_adapter — A-08
   ------------------------------------------------------------
   Der Adapter baut aus Zielobjekt + Leistungsbild die Eingabe fuer den
   Bewerter und protokolliert dessen Urteil — als BEOBACHTER, ohne zu blockieren.

   Vier Zusagen:
     1. GLEICHES MIT GLEICHEM: Zielzeit vs. Schwellenpace wird NICHT verglichen
        (metric_not_commensurable). FTP↔FTP, VO2max↔VO2max schon.
     2. Der Beobachter wirft nie und blockiert nichts.
     3. machbar / unmachbar / Grenzfall reichen bis zum Bewerter durch.
     4. Verdrahtung: Modul geladen, gecacht, driftbewacht.

   node supabase/tests/goal_feasibility_adapter_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const APP  = ['app', ''].map(p => join(REPO, p, 'js')).find(p => existsSync(p)) && join(REPO, 'app');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* Bewerter zuerst laden, damit der Adapter O.goalFeasibility findet. */
require(join(REPO, 'app/js/engine/evidence.js'));
const F = require(join(REPO, 'app/js/engine/goal-feasibility.js'));
const A = require(join(REPO, 'app/js/engine/goal-feasibility-adapter.js'));

/* Ein aufgeloestes Leistungsbild wie resolveAll es liefert. */
const RESOLVED = (over = {}) => ({
  ok: true, sports: Object.assign({
    running:  { ok: true, thresholdPaceSecPerKm: 300, confidence: 'strong', ageRatio: 0.2 },
    cycling:  { ok: true, ftpWatts: 250, confidence: 'strong', ageRatio: 0.2 },
    swimming: { ok: false }
  }, over)
});

/* ---------- A · Gleiches mit Gleichem ---------- */
console.log('\nA · Kommensurabilität');
{
  /* Halbmarathon-ZIELZEIT (6600 s) gegen SCHWELLENPACE (300 s/km) — beide
     „lower", aber verschiedene Groessen. Muss abgelehnt werden. */
  const r = A.buildInput({ goal: { category: 'half_marathon', metricType: 'time', targetValue: 6600, targetDate: '2026-11-06' },
                           resolvedPerformance: RESOLVED(), today: '2026-08-20' });
  ok('A1 Zielzeit vs. Schwellenpace wird NICHT gebaut', r.skip === true, JSON.stringify(r).slice(0, 80));
  ok('A2 … und nennt den Grund beim Namen', /metric_not_commensurable/.test(r.reason || ''), r.reason);

  /* FTP-Ziel gegen gemessene FTP — dieselbe Groesse, muss gebaut werden. */
  const ftp = A.buildInput({ goal: { category: 'ftp', metricType: 'power', targetValue: 280, targetDate: '2026-11-06' },
                             resolvedPerformance: RESOLVED(), today: '2026-08-20', level: 'intermediate' });
  ok('A3 FTP-Ziel ↔ gemessene FTP wird gebaut', !!ftp.input && !ftp.skip);
  ok('A4 … mit dem richtigen Leistungswert (250 W)', ftp.input && ftp.input.currentPerformance.value === 250);

  ok('A5 dimensionOf trennt Leistung von Zeit (Zeit ist BEKANNT, nur nicht dieselbe Größe)',
    A.dimensionOf('ftpWatts') === 'power' && A.dimensionOf('thresholdPaceSecPerKm') === 'threshold_pace'
    && A.dimensionOf('halfmarathontime') === 'race_time' && A.dimensionOf('time') === 'race_time'
    && A.dimensionOf('threshold_pace') !== A.dimensionOf('race_time'));
  ok('A6 sportOfGoal ordnet FTP dem Rad zu, Laufziele dem Laufen',
    A.sportOfGoal({ category: 'ftp' }) === 'cycling' && A.sportOfGoal({ category: 'half_marathon' }) === 'running');
}

/* ---------- B · Beobachter bricht nichts ---------- */
console.log('\nB · Beobachter, nie Beteiligter');
{
  ok('B1 kein Ziel → skip, kein Wurf', A.buildInput({}).skip === true);
  ok('B2 Ziel ohne Zielwert → skip', A.buildInput({ goal: { category: 'ftp', metricType: 'power' } }).reason === 'no_target_value');
  ok('B3 keine belastbare Leistung → skip mit Sportbezug',
    /no_usable_performance/.test(A.buildInput({ goal: { category: 'ftp', metricType: 'power', targetValue: 280 },
      resolvedPerformance: RESOLVED({ cycling: { ok: false } }) }).reason));
  /* ok:true, aber KEIN Messwert — der Adapter darf hier keinen Scheinwert
     ausgeben, sonst urteilt der Bewerter ueber Rauschen. */
  ok('B3b Sport „ok", aber ohne Messwert (ftpWatts fehlt) → skip',
    /no_usable_performance/.test(A.buildInput({ goal: { category: 'ftp', metricType: 'power', targetValue: 280 },
      resolvedPerformance: RESOLVED({ cycling: { ok: true, confidence: 'strong' } }) }).reason));
  const obs = A.observe({ goal: { category: 'ftp', metricType: 'power', targetValue: 280, targetDate: '2026-11-06' },
    resolvedPerformance: RESOLVED(), today: '2026-08-20', level: 'intermediate' });
  ok('B4 observe liefert ein Urteil, ohne zu werfen', obs && typeof obs.evaluated === 'boolean');
  ok('B5 ein übersprungener Fall meldet evaluated:false + Grund',
    A.observe({}).evaluated === false && !!A.observe({}).reason);
  /* Ein Ziel, dessen Zugriff wirft — beweist, dass observe buildInput WIRKLICH
     faengt und nicht nur auf gutmuetige Eingaben vertraut. */
  var giftGoal = {}; Object.defineProperty(giftGoal, 'targetValue', { get: function () { throw new Error('boom'); } });
  /* Der Aufruf wird hier bewusst umschlossen: faengt observe den Wurf NICHT,
     soll das ein sauberes Rot sein, kein Absturz des Testlaufs. */
  var b6caught = false, b6res = null;
  try { b6res = A.observe({ goal: giftGoal, resolvedPerformance: RESOLVED() }); }
  catch (e) { b6caught = true; }
  ok('B6 ein werfendes Zielobjekt wird gefangen (evaluated:false, build_threw)',
    !b6caught && b6res && b6res.reason === 'build_threw',
    b6caught ? 'observe hat GEWORFEN statt zu fangen' : (b6res && b6res.reason));
}

/* ---------- C · machbar / unmachbar / Grenzfall reichen durch ---------- */
console.log('\nC · Das Urteil des Bewerters kommt an');
{
  const PROG = { allowableRange: { min: 0, max: 8 }, selectedDelta: 3, targetLoad: 41.2,
    provisionalTargetLoad: 41.2, actionable: true, autoApplicable: true, evidence: 'moderate' };
  /* machbar: kleines Plus in reichlich Zeit. */
  const gut = A.observe({ goal: { category: 'ftp', metricType: 'power', targetValue: 258, targetDate: '2026-11-06' },
    resolvedPerformance: RESOLVED(), allowableProgression: PROG, today: '2026-08-20', level: 'intermediate' });
  ok('C1 realistisches Ziel → evaluated, Status gesetzt', gut.evaluated && !!gut.status, gut.status);
  /* unmachbar: grosser Sprung in kurzer Zeit. */
  const hart = A.observe({ goal: { category: 'ftp', metricType: 'power', targetValue: 400, targetDate: '2026-09-10' },
    resolvedPerformance: RESOLVED(), allowableProgression: PROG, today: '2026-08-20', level: 'intermediate' });
  ok('C2 überzogenes Ziel → outside_modeled_corridor', hart.status === 'outside_modeled_corridor', hart.status);
  /* Grenzfall: kein Zieldatum, aber Bewertung moeglich (flexible). */
  const flex = A.observe({ goal: { category: 'ftp', metricType: 'power', targetValue: 258 },
    resolvedPerformance: RESOLVED(), allowableProgression: PROG, today: '2026-08-20', level: 'intermediate' });
  ok('C3 flexibles Ziel (kein Datum) wird trotzdem bewertet', flex.evaluated && flex.result.goalMode === 'flexible', flex.status);
  ok('C4 der Adapter erzeugt KEINE eigene Zahl — er reicht das Urteil nur durch',
    gut.result && gut.result.version === F.VERSION);
}

/* ---------- D · Verdrahtung ---------- */
console.log('\nD · Verdrahtung');
{
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  ok('D1 Modul eingehängt', /js\/engine\/goal-feasibility-adapter\.js/.test(html));
  ok('D2 … NACH dem Bewerter (es liest dessen API)',
    html.indexOf('js/engine/goal-feasibility.js') < html.indexOf('js/engine/goal-feasibility-adapter.js'));
  ok('D3 im Offline-Vorrat', /engine\/goal-feasibility-adapter\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));
}

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
