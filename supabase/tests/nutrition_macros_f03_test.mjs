/* ============================================================
   ORVIA · F03 (Metaanalyse 05.10.2026) — Makros und Kalorienziel passen zusammen.

   Live: 1.784 kcal Tagesziel, daneben Protein 135 g · Kohlenhydrate 213 g ·
   Fett 67 g = 540 + 852 + 603 = 1.995 kcal. Ursache: Calc.nutritionTargets
   setzte eine Kohlenhydrat-Untergrenze je kg (3 g, an harten Tagen 5 g) per
   Math.max, ohne das Kalorienziel nachzuziehen — die Vorgabe war nicht erfüllbar.

   Festgelegte Rangfolge (eine Quelle, calc.js):
     1. Energieziel (kcal) — aus Umsatz, Ziel und den bestehenden Schutzgrenzen.
     2. Protein je kg.
     3. Fett je kg.
     4. Kohlenhydrate = der Rest. Der kg-Wert bleibt als RICHTWERT sichtbar
        (carbsGuide); liegt der Rest darunter, sagt das Ergebnis es (carbsBelowGuide).

   M1  Live-Fall: Makroenergie = Kalorienziel (± Rundung).
   M2  Raster über Gewicht, Tagesart, Ziel, Umsatz: überall konsistent, nie NaN/negativ.
   M3  Das Kalorienziel selbst ändert sich durch F03 nicht.
   M4  Richtwert und Unterschreitung werden ausgewiesen.
   M5  Protein behält Vorrang; reicht die Energie nicht für Fett, weicht Fett.
   M6  Anzeige: Hinweis an harten Tagen, wenn die Kohlenhydrate unter dem Richtwert liegen.
   node supabase/tests/nutrition_macros_f03_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const app = new URL(_APPREL, import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
vm.runInContext(readFileSync(new URL('js/calc.js', app), 'utf8') + '\n;globalThis.__Calc=Calc;', sb, { filename: 'calc.js' });
const NT = sb.__Calc.nutritionTargets, BMR = sb.__Calc.bmr;
const macroKcal = t => t.protein * 4 + t.carbs * 4 + t.fat * 9;
/* Rundung: Gramm sind ganzzahlig; der Kohlenhydrat-Rest wird auf 1 g gerundet → höchstens 2 kcal Abstand. */
const TOL = 4;

/* ---------- M1 · Live-Fall (Körperdaten synthetisch, wie im Bericht) ---------- */
const LIVE = { sex: 'm', age: 30, heightCm: 180, weightKg: 70.9, goal: 'maintain', dayType: 'rest', tdee: 1784, trainingBurn: 0 };
{
  const t = NT(LIVE);
  ok('M1a Kalorienziel 1.784 kcal', t.kcal === 1784, String(t.kcal));
  ok('M1b Protein 135 g, Fett 67 g wie bisher', t.protein === 135 && t.fat === 67, t.protein + '/' + t.fat);
  ok('M1c Makroenergie = Kalorienziel (± ' + TOL + ' kcal) — vorher 1.995', Math.abs(macroKcal(t) - t.kcal) <= TOL, macroKcal(t) + ' vs ' + t.kcal + ' · Carbs ' + t.carbs);
  ok('M1d Kohlenhydrate = Rest (160 g), nicht mehr die 213 g Untergrenze', t.carbs === 160, String(t.carbs));
}

/* ---------- M2 · Raster ---------- */
{
  let n = 0, bad = [];
  for (const w of [45, 58, 70.9, 82, 95, 120])
    for (const dayType of ['rest', 'easy', 'quality', 'long', 'strength'])
      for (const goal of ['maintain', 'fatloss', 'muscle'])
        for (const tdee of [null, 1500, 1784, 2400, 3200, 4500])
          for (const proteinPerKg of [undefined, 1.6, 2.4, 3.0]) {
            const p = { sex: w < 60 ? 'f' : 'm', age: 28, heightCm: w < 60 ? 165 : 182, weightKg: w, goal, dayType, trainingBurn: dayType === 'rest' ? 0 : 600, activity: 'light', proteinPerKg };
            if (tdee != null) p.tdee = tdee;
            const t = NT(p); n++;
            const vals = [t.kcal, t.protein, t.carbs, t.fat];
            const fine = vals.every(v => typeof v === 'number' && isFinite(v) && v >= 0) && Math.abs(macroKcal(t) - t.kcal) <= TOL;
            if (!fine) bad.push(JSON.stringify({ w, dayType, goal, tdee, proteinPerKg, kcal: t.kcal, P: t.protein, C: t.carbs, F: t.fat, sum: macroKcal(t) }));
          }
  ok('M2 ' + n + ' Kombinationen: Makroenergie = Kalorienziel, keine negativen Werte, kein NaN', bad.length === 0, bad.length + ' Abweichungen · ' + bad.slice(0, 2).join(' '));
}

/* ---------- M3 · Kalorienziel unverändert ---------- */
{
  const b = BMR('m', 30, 180, 70.9);
  const exp = p => { const burn = Math.max(0, Math.round(p.trainingBurn || 0)); const maint = Math.round(p.tdee); const hard = p.dayType === 'long' || p.dayType === 'quality';
    let adj = 0; if (p.goal === 'fatloss') { adj = -(p.deficitKcal || 400); if (hard) adj = Math.max(adj, -200); } else if (p.goal === 'muscle') adj = +(p.surplusKcal || 250);
    return Math.max(Math.round(b * 1.05), maint + adj); };
  const cases = [LIVE, Object.assign({}, LIVE, { goal: 'fatloss' }), Object.assign({}, LIVE, { goal: 'fatloss', dayType: 'long', tdee: 2900, trainingBurn: 900 }), Object.assign({}, LIVE, { goal: 'muscle', tdee: 2600 })];
  ok('M3 kcal folgt weiter Umsatz, Ziel und Schutzgrenzen (BMR × 1,05, hartes Defizit ≤ 200)', cases.every(p => NT(p).kcal === exp(p)), cases.map(p => NT(p).kcal + '=' + exp(p)).join(' '));
}

/* ---------- M4 · Richtwert ausgewiesen ---------- */
{
  const t = NT(LIVE);
  ok('M4a Richtwert 3 g/kg am Ruhetag = 213 g bleibt sichtbar (carbsGuide)', t.carbsGuide === 213, String(t.carbsGuide));
  ok('M4b Unterschreitung wird ausgewiesen (carbsBelowGuide)', t.carbsBelowGuide === true);
  const rich = NT(Object.assign({}, LIVE, { tdee: 3000, dayType: 'easy' }));
  ok('M4c genug Energie: Kohlenhydrate über dem Richtwert, kein Hinweis', rich.carbs >= rich.carbsGuide && rich.carbsBelowGuide === false, rich.carbs + ' ≥ ' + rich.carbsGuide);
  const hard = NT(Object.assign({}, LIVE, { dayType: 'quality', tdee: 2100, trainingBurn: 300 }));
  ok('M4d harter Tag: Richtwert 5 g/kg = 355 g', hard.carbsGuide === 355 && hard.hard === true, String(hard.carbsGuide));
  ok('M4e bisherige Felder bleiben erhalten', ['kcal', 'protein', 'carbs', 'fat', 'base', 'burn', 'maint', 'ea', 'bmr', 'hard', 'goal', 'dayType'].every(k => k in t));
}

/* ---------- M5 · Rangfolge ---------- */
{
  const t = NT(Object.assign({}, LIVE, { proteinPerKg: 2.4 }));
  ok('M5a Protein folgt der Einstellung (2,4 g/kg = 170 g)', t.protein === 170, String(t.protein));
  ok('M5b Makroenergie bleibt am Kalorienziel', Math.abs(macroKcal(t) - t.kcal) <= TOL, macroKcal(t) + ' vs ' + t.kcal);
  /* Konstruierter Engpass: sehr viel Protein, wenig Energie → Fett weicht, Kohlenhydrate 0. */
  const tight = NT({ sex: 'f', age: 60, heightCm: 150, weightKg: 110, goal: 'fatloss', dayType: 'rest', tdee: 1500, proteinPerKg: 3.0 });
  ok('M5c Engpass: kein negativer Wert, Summe am Kalorienziel', tight.carbs >= 0 && tight.fat >= 0 && Math.abs(macroKcal(tight) - tight.kcal) <= 9, JSON.stringify({ kcal: tight.kcal, P: tight.protein, C: tight.carbs, F: tight.fat, sum: macroKcal(tight) }));
}

/* ---------- M6 · Anzeige ---------- */
{
  const ui = readFileSync(new URL('js/ui.js', app), 'utf8'), nut = readFileSync(new URL('js/nutrition.js', app), 'utf8'), de = readFileSync(new URL('locales/de.js', app), 'utf8');
  ok('M6a Detailansicht zeigt den Hinweis nur an harten Tagen unter Richtwert', /t\.hard&&t\.carbsBelowGuide/.test(ui.slice(ui.indexOf('function gmOpenNutritionSheet'), ui.indexOf('function gmModEvening'))));
  ok('M6b Karte im Ernährungs-Host ebenso', /t\.hard && t\.carbsBelowGuide/.test(nut));
  ok('M6c Hinweistexte im Katalog, mit Richtwert als Platzhalter', /'ui\.nut_carbs_below_guide': '[^']*\{guide\}/.test(de) && /'nut\.carbs_below_guide': '[^']*\{guide\}/.test(de));
  const src = readFileSync(new URL('js/calc.js', app), 'utf8');
  const fn = src.slice(src.indexOf('function nutritionTargets'), src.indexOf('const Calc='));
  ok('M6d keine Kohlenhydrat-Untergrenze per Math.max mehr', !/carbs=Math\.max\(/.test(fn));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
