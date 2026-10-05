/* ============================================================
   ORVIA · F09 + F10 (Metaanalyse 05.10.2026) — Muskel-Kachel und Muskel-Detail.

   F09  Die Engine bewertet das WOCHENÄQUIVALENT (weeklyEquivalent) gegen den
        Richtwert pro Woche. Kachel-Balken und Detailtext verglichen dagegen die
        Summe des ganzen Zeitraums (z. B. 10 Sätze in 28 Tagen) mit dem
        Wochenkorridor 8–16 → Status „Unter Ziel", Text „im wirksamen Bereich".
   F10  Die Konfidenz des Modells ist eine Kategorie (low/medium/high). Das Detail
        rechnete `confidence*100` → „NaN%".

   Die Muskel-Objekte entstehen hier über die ECHTEN Engine-Funktionen
   (weeklyEquivalent, statusFor, confidenceOf) — kein Stub mit erfundener Form.

   A  Konfidenz: nie NaN/undefined; Kategorie wird übersetzt, keine Scheinprozente.
   B  Detail: Aussage folgt dem Engine-Status; Zeitraumsumme und Wochenwert stehen
      getrennt und benannt da.
   C  Kachel: Balken und Text auf Wochenbasis.
   D  Gleiche Wochenlast über 7/14/28/90 Tage → gleiche Einordnung, gleicher Balken.
   E  Datenlücke bleibt Datenlücke.
   node supabase/tests/muscle_detail_f09_f10_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const app = new URL(_APPREL, import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const ui = readFileSync(new URL('js/ui.js', app), 'utf8');
const sliceFn = name => { const i = ui.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, st = false; for (let j = i; j < ui.length; j++) { const ch = ui[j]; if (ch === '{') { d++; st = true; } else if (ch === '}') { d--; if (st && d === 0) return ui.slice(i, j + 1); } } return ''; };
const sliceVar = name => { const i = ui.indexOf('var ' + name + '='); if (i < 0) return ''; return ui.slice(i, ui.indexOf('};', i) + 2); };

/* ---------- Sandbox: echter Katalog, echte Engine, echte ui.js-Funktionen ---------- */
const sb = { console, Math, JSON, Object, Array, String, Number, isNaN, isFinite, Date };
sb.window = sb; sb.globalThis = sb; sb.self = sb;
vm.createContext(sb);
vm.runInContext(readFileSync(new URL('locales/de.js', app), 'utf8'), sb, { filename: 'de.js' });
vm.runInContext(readFileSync(new URL('js/gym-volume.js', app), 'utf8'), sb, { filename: 'gym-volume.js' });
/* Echte i18n-Laufzeit (Platzhalter {name}); ein fehlender Key käme als roher Key
   „ui.…" zurück — das fängt BAD unten ab. */
sb.localStorage = { getItem: () => null, setItem() {} }; sb.navigator = { language: 'de-DE' };
sb.addEventListener = () => {}; sb.dispatchEvent = () => true; sb.CustomEvent = function () {};
vm.runInContext(readFileSync(new URL('js/i18n.js', app), 'utf8'), sb, { filename: 'i18n.js' });
const G = sb.ORVIA.gymVolume;
sb._uiT = (k, p) => sb.ORVIA.i18n.t(k, p);
sb.icon = () => ''; sb.gmEsc = s => String(s == null ? '' : s); sb.GM_NA = 'Nicht verfügbar';
sb.gmLevel = () => 'p';
sb.mvLabelDe = id => ({ chest: 'Brust', biceps: 'Bizeps', quads: 'Quadrizeps' }[id] || id);
sb.mvExperience = () => 'intermediate';
sb.__sheet = { innerHTML: '' };
sb.document = { getElementById: id => (id === 'detailSheet' ? sb.__sheet : null) };
sb.gmOpenSheet = () => {};
/* Übungsliste des Details: bewusst leer — hier geht es um Zahlen und Aussage. */
G.snapshotsFromStore = () => []; G.explainMuscleVolume = () => ({ contributions: [] });
vm.runInContext([
  sliceVar('CONF_LABEL_DE'), sliceFn('fmtDe'), sliceVar('MV_STATUS_META'), sliceFn('mvStatusModel'),
  sliceFn('mvNextStep'), sliceVar('GM_MV_META'), sliceFn('gmMvSt'), sliceFn('gmConfLabel'),
  sliceFn('gmMvWeekly'), sliceFn('gmMuscleTile'), sliceFn('gmOpenMuscleSheet'),
  'var gmBodyRange=28,_gmMvModel=null;'
].join('\n'), sb, { filename: 'ui.js#muscle' });

/* Muskel so, wie getProductiveVolumeModel ihn baut. */
function muscle(id, effSum, days, o) {
  o = o || {};
  const target = o.target === null ? null : { min: 8, max: 16 };
  const wk = G.weeklyEquivalent(effSum, days);
  const st = (target && target.displayStatus === 'insufficient_data') ? { key: 'insufficient_data' } : G.statusFor(wk, target);
  return { muscleId: id, realWorkingSets: o.real != null ? o.real : Math.round(effSum), directSets: effSum, indirectSetEquivalents: 0,
    effectiveSetEquivalents: effSum, weeklyEquivalent: wk, targetRange: target, status: st,
    confidence: 'confidence' in o ? o.confidence : G.confidenceOf({ weeks: days / 7, totalSets: effSum, unclassifiedRatio: 0 }) };
}
function render(m, days) {
  const model = { muscles: [m] };
  vm.runInContext('gmBodyRange=' + days + ';', sb);
  sb._gmMvModel = { days, model };
  vm.runInContext('_gmMvModel=globalThis._gmMvModel;', sb);
  const tile = sb.gmMuscleTile(model, m.muscleId);
  sb.__sheet.innerHTML = ''; sb.gmOpenMuscleSheet(m.muscleId);
  return { tile, sheet: sb.__sheet.innerHTML };
}
const BAD = /NaN|undefined|Infinity|\bui\.[a-z0-9_]+|\{[a-z]+\}/;
const fillOf = h => { const m = /class="fillm" style="width:([\d.]+)%/.exec(h); return m ? +m[1] : null; };
const tgtOf = h => { const m = /class="tgt" style="left:([\d.]+)%;width:([\d.]+)%/.exec(h); return m ? [+m[1], +m[2]] : null; };

/* ---------- Der Live-Fall: Brust, 10 effektive Sätze in 28 Tagen, Richtwert 8–16/Woche ---------- */
const chest = muscle('chest', 10, 28);
ok('0 Vorbedingung: Engine sagt 2,5/Woche und „below"', chest.weeklyEquivalent === 2.5 && chest.status.key === 'below', chest.weeklyEquivalent + ' ' + chest.status.key);
const R = render(chest, 28);

/* ---------- A · Konfidenz ---------- */
ok('A1 Detail: kein NaN/undefined', !BAD.test(R.sheet), (BAD.exec(R.sheet) || [''])[0]);
ok('A2 Kachel: kein NaN/undefined', !BAD.test(R.tile), (BAD.exec(R.tile) || [''])[0]);
ok('A3 Detail übersetzt die Kategorie (' + chest.confidence + ')', new RegExp('Konfidenz[^<]*<b>(niedrig|mittel|hoch)</b>').test(R.sheet), (/Konfidenz[^<]*<b>[^<]*<\/b>/.exec(R.sheet) || [''])[0]);
ok('A4 Kachel und Detail nennen dieselbe Konfidenz', (() => { const a = /Konfidenz (niedrig|mittel|hoch)/.exec(R.tile), b = /Konfidenz[^<]*<b>(niedrig|mittel|hoch)<\/b>/.exec(R.sheet); return a && b && a[1] === b[1]; })());
['low', 'medium', 'high'].forEach(c => {
  const r = render(muscle('chest', 10, 28, { confidence: c }), 28);
  ok('A5 Kategorie ' + c + ': keine Prozentangabe', !/Konfidenz[^<]*<b>[^<]*%/.test(r.sheet) && !BAD.test(r.sheet));
});
{
  const r = render(muscle('chest', 10, 28, { confidence: 0.84 }), 28);
  ok('A6 echte Zahl 0,84 → 84 %', /<b>84%<\/b>/.test(r.sheet) && /Konfidenz 84%/.test(r.tile));
  const r2 = render(muscle('chest', 10, 28, { confidence: null }), 28);
  ok('A7 fehlende Konfidenz → Strich', /Konfidenz[^<]*<b>—<\/b>/.test(r2.sheet));
  const r3 = render(muscle('chest', 10, 28, { confidence: 'sonstwas' }), 28);
  ok('A8 unbekannte Kategorie → Strich, kein Rohwert', /Konfidenz[^<]*<b>—<\/b>/.test(r3.sheet) && !/sonstwas/.test(r3.sheet + r3.tile));
}

/* ---------- B · Detail folgt dem Engine-Status ---------- */
ok('B1 Status „Unter Ziel" im Kopf', /Unter Ziel/.test(R.sheet));
ok('B2 Text sagt NICHT „im wirksamen Bereich" (der Befund)', !/im <b>wirksamen<\/b> Bereich/.test(R.sheet));
ok('B3 Text sagt „unter"', /<b>unter<\/b>/.test(R.sheet));
ok('B4 Wochenwert 2,5 steht im Detail', /2,5/.test(R.sheet));
ok('B5 Zeitraumsumme 10 und die 28 Tage stehen im Detail', /10 effektive Sätze in 28 Tagen/.test(R.sheet), (/[^>]*effektive Sätze in[^<]*/.exec(R.sheet) || [''])[0]);
ok('B6 Kennzahl ist als Wochenwert beschriftet', />effektiv\/Woche</.test(R.sheet));
{
  const rin = render(muscle('chest', 48, 28), 28);      // 12/Woche
  ok('B7 12/Woche → „im wirksamen Bereich", Status „Im Ziel"', /im <b>wirksamen<\/b> Bereich/.test(rin.sheet) && /Im Ziel/.test(rin.sheet));
  const rab = render(muscle('chest', 80, 28), 28);      // 20/Woche
  ok('B8 20/Woche → „über", Status „Über Ziel"', /<b>über<\/b>/.test(rab.sheet) && /Über Ziel/.test(rab.sheet));
}
{
  /* Bizeps aus dem Bericht: Rohwert innerhalb 8–16, Wochenwert darunter. */
  const r = render(muscle('biceps', 12, 28), 28);       // 3/Woche
  ok('B9 Bizeps 12 in 28 T: Status und Text einig („unter")', /Unter Ziel/.test(r.sheet) && /<b>unter<\/b>/.test(r.sheet) && !/im <b>wirksamen<\/b>/.test(r.sheet));
}

/* ---------- C · Kachel auf Wochenbasis ---------- */
{
  const f = fillOf(R.tile), t = tgtOf(R.tile);
  ok('C1 Balken endet VOR dem Richtwert-Band (2,5 < 8)', f != null && t != null && f < t[0], 'Füllung ' + f + ' · Band ab ' + (t && t[0]));
  ok('C2 Kachel nennt den Wochenwert', /Ø 2,5\/Woche/.test(R.tile), R.tile.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120));
  ok('C3 Kachel nennt den Zeitraum der Summe', /10 in 28 Tagen/.test(R.tile));
  const rin = render(muscle('chest', 48, 28), 28), fi = fillOf(rin.tile), ti = tgtOf(rin.tile);
  ok('C4 12/Woche: Balken endet IM Band', fi >= ti[0] && fi <= ti[0] + ti[1], fi + ' in [' + ti[0] + ',' + (ti[0] + ti[1]) + ']');
}

/* ---------- D · gleiche Wochenlast, anderes Fenster ---------- */
{
  const res = [7, 14, 28, 90].map(d => { const m = muscle('chest', 12 * d / 7, d); const r = render(m, d); return { d, key: m.status.key, fill: fillOf(r.tile), txt: /im <b>wirksamen<\/b>/.test(r.sheet), wk: /Ø 12\/Woche/.test(r.tile) }; });
  ok('D1 12/Woche über 7/14/28/90 Tage: Engine-Status identisch', res.every(x => x.key === 'in'), res.map(x => x.d + ':' + x.key).join(' '));
  ok('D2 Detailtext identisch („im wirksamen Bereich")', res.every(x => x.txt));
  ok('D3 Balken identisch', res.every(x => Math.abs(x.fill - res[0].fill) < 0.01), res.map(x => x.d + ':' + x.fill).join(' '));
  ok('D4 Kachel nennt überall Ø 12/Woche', res.every(x => x.wk));
}

/* ---------- E · Datenlücke ---------- */
{
  const none = muscle('quads', 0, 28, { real: 0 });
  const r = render(none, 28);
  ok('E1 keine Sätze: „Keine Daten", nicht „Unter Ziel"', /Keine Daten/.test(r.sheet) && !/Unter Ziel/.test(r.sheet) && !/<b>unter<\/b>/.test(r.sheet));
  ok('E2 keine Sätze: kein NaN', !BAD.test(r.sheet + r.tile));
  const noT = muscle('quads', 10, 28, { target: null });
  const r2 = render(noT, 28);
  ok('E3 ohne Richtwert: keine Einordnung, kein Balken-Band', /ohne Zielkorridor keine Einordnung/.test(r2.sheet) && !/<b>unter<\/b>|<b>über<\/b>|<b>wirksamen<\/b>/.test(r2.sheet) && !BAD.test(r2.sheet + r2.tile));
  const old = muscle('chest', 10, 28); delete old.weeklyEquivalent;
  const r3 = render(old, 28);
  ok('E4 Modell ohne weeklyEquivalent: Wochenwert kommt aus der Engine-Funktion (2,5), kein Rohvergleich', /Ø 2,5\/Woche/.test(r3.tile) && !BAD.test(r3.sheet + r3.tile));
}

/* ---------- Quelltext: kein zweiter Status in der Oberfläche ---------- */
{
  const sheetSrc = sliceFn('gmOpenMuscleSheet'), tileSrc = sliceFn('gmMuscleTile');
  ok('S1 Detail vergleicht nicht mehr selbst gegen den Korridor (eq<lo / eq>hi)', !/eq<lo|eq>hi/.test(sheetSrc));
  ok('S2 keine Rechnung confidence*100 außerhalb des gemeinsamen Renderers', !/confidence\*100/.test(sheetSrc) && !/confidence\*100/.test(tileSrc));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
