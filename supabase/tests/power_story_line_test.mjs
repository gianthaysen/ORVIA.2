/* ============================================================
   ORVIA · power_story_line — Leistung (Watt) + Story-Kurve als harte Linie (v8-424)
   Gians Befunde 2.10.: Wattzahl fehlt in Aktivitaet und Story; die Story-Diagramme
   zeigen Hoehen und Tiefen nur ueber Punkte — gewuenscht: durchgezogene Linie, Punkte
   nur als Hintergrund und an der Linie abgeschnitten.
   node supabase/tests/power_story_line_test.mjs
   ============================================================ */
import fs from 'fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };
const ui = rd('js/ui.js'), act = rd('js/activity.js'), css = rd('styles.css');
globalThis.ORVIA = {};
const AN = (await import(new URL(_APPREL + 'js/activity-normalize.js', import.meta.url))).default;

{
  const s = AN.normalizeActivitySummary({ distance_m: 19960, avg_power_w: 141.4, max_power_w: 402, norm_power_w: 156 }, 'cycling');
  ok('A1 Summary: avg/max/NP → avgPowerW/maxPowerW/normPowerW (gerundet), snake_case entfernt', s.avgPowerW === 141 && s.maxPowerW === 402 && s.normPowerW === 156 && !('avg_power_w' in s) && !('norm_power_w' in s));
  const z = AN.normalizeActivitySummary({ distance_m: 5000, avg_power_w: 0, max_power_w: -3 }, 'cycling');
  ok('A2 0 W / negativ ist kein Messwert ⇒ kein Feld', !('avgPowerW' in z) && !('maxPowerW' in z) && !('normPowerW' in z));
  ok('A3 idempotent (zweite Normalisierung unveraendert)', JSON.stringify(AN.normalizeActivitySummary(s, 'cycling')) === JSON.stringify(s));
  const dm = AN.activityDetailModel('cycling', s, 3060, {});
  ok('A4 Detailmodell traegt die Leistung', dm.avgPowerW === 141 && dm.maxPowerW === 402 && dm.normPowerW === 156);
  ok('A5 View-Model: Summary fuehrt, sonst Ø/Max aus der echten Messreihe (powerSource stream)', /powerSource: \(dm && dm\.avgPowerW != null\) \? 'summary' : null/.test(act) && /vm\.avgPowerW = Math\.round\(_ps \/ _pn\); vm\.powerSource = 'stream';/.test(act) && /if \(_pn >= 5 && _pm > 0\)/.test(act));
}
{
  const i = ui.indexOf('var _gmStoryChartSeq=0;'), j = ui.indexOf('/* Baut die Seiten NUR aus vorhandenen');
  const mk = calm => { const c = { gmEsc: s => String(s), window: { matchMedia: () => ({ matches: calm }) } }; vm.createContext(c); vm.runInContext(ui.slice(i, j) + '\nthis.F=gmStoryDotChart;this.M=gmMonoPath;', c); return c; };
  const ctx = mk(false);
  const vals = []; for (let k = 0; k < 300; k++) vals.push(120 + 30 * Math.sin(k / 20));
  const h = ctx.F(vals, ' bpm', 0, { avg: 135, max: 167 });
  const clipId = (/<clipPath id="(wstClip\d+)">/.exec(h) || [])[1];
  ok('B1 durchgezogene Linie ueber dem Punktraster', /<path class="wst-line" d="M0,/.test(h) && h.indexOf('class="wst-line"') > h.lastIndexOf('<circle'));
  ok('B2 Punkte werden an der Kurve abgeschnitten (clipPath = Flaeche unter der Linie)', !!clipId && new RegExp('<g clip-path="url\\(#' + clipId + '\\)">').test(h) && /L360,430 L0,430 Z"\/><\/clipPath>/.test(h));
  /* v8-425: EINE gemeinsame Aufdeck-Bewegung, weiche Kurve, Verlaufsflaeche */
  const revId = (/<clipPath id="(wstRev\d+)">/.exec(h) || [])[1];
  const iRev = h.indexOf('<g clip-path="url(#' + revId + ')">');
  ok('B2a Flaeche, Punkte UND Linie liegen im selben Reveal-Zuschnitt (Linie zeichnet sich mit den Punkten)', !!revId && iRev > 0 && iRev < h.indexOf('class="wst-area"') && iRev < h.indexOf('<circle') && iRev < h.indexOf('class="wst-line"'));
  ok('B2b Reveal laeuft von links nach rechts; statische Breite = volle Breite (ohne SMIL sofort sichtbar)', /<rect x="0" y="-12" width="360" height="454"><animate attributeName="width" from="0" to="360" begin="0s" dur="1\.9s" fill="freeze"/.test(h));
  const hc = mk(true).F(vals, ' bpm', 0);
  ok('B2c „Bewegung reduzieren": keine Animation, Diagramm steht sofort', !/<animate/.test(hc) && /class="wst-dotwrap calm"/.test(hc) && /class="wst-line"/.test(hc));
  ok('B2d Kurve ist kubisch (weich), keine Polylinie', (h.match(/ C[\d.-]+,[\d.-]+ /g) || []).length >= 70 && /linearGradient id="wstGrad\d+"/.test(h));
  {
    /* monoton-kubisch: trifft jeden Stuetzpunkt, kein Ueberschwingen (Kontrollpunkte bleiben zwischen den Nachbarn) */
    const pts = [[0, 100], [10, 40], [20, 40], [30, 90], [40, 10], [50, 60]];
    const d = ctx.M(pts); const segs = d.trim().split(' C').filter(Boolean).map(x => x.trim().split(' ').map(q => q.split(',').map(Number)));
    const hit = segs.every((sg, k) => sg[2][0] === pts[k + 1][0] && sg[2][1] === pts[k + 1][1]);
    const bounded = segs.every((sg, k) => { const lo = Math.min(pts[k][1], pts[k + 1][1]) - 0.05, hi = Math.max(pts[k][1], pts[k + 1][1]) + 0.05; return sg[0][1] >= lo && sg[0][1] <= hi && sg[1][1] >= lo && sg[1][1] <= hi; });
    ok('B2e Kurve trifft jeden Stuetzpunkt exakt und schwingt nie ueber einen Messwert hinaus', segs.length === 5 && hit && bounded, JSON.stringify(segs.map(sg => [sg[0][1], sg[1][1]])));
  }
  const dLine = (/<path class="wst-line" d="([^"]+)"/.exec(h) || [])[1], dClip = (/<clipPath id="[^"]+"><path d="([^"]+)"/.exec(h) || [])[1];
  ok('B3 Linie und Zuschnitt folgen DERSELBEN Kurve', !!dLine && !!dClip && dClip.indexOf(dLine) === 0);
  ok('B4 Punkte ohne Hervorhebung (kein t0/t1/t2 mehr) — reiner Hintergrund', !/class="t[012]"/.test(h) && (h.match(/<circle/g) || []).length > 300);
  ok('B5 Ø/Max aus der Summary als Anzeige (eine Wahrheit mit dem Zahlenraster)', /Ø 135 bpm/.test(h) && /167 bpm/.test(h));
  const h2 = ctx.F(vals, ' bpm', 0);
  ok('B6 ohne Summary: Ø/Max der Samples; Summary-Max unter dem Sample-Max wird ignoriert', /Ø 1\d\d bpm/.test(h2) && /150 bpm/.test(h2) && /150 bpm/.test(ctx.F(vals, ' bpm', 0, { max: 140 })));
  ok('B7 jede Grafik bekommt eine eigene clipPath-id', (/<clipPath id="(wstClip\d+)">/.exec(h2) || [])[1] !== clipId);
  ok('B8 zu wenige Werte ⇒ kein Diagramm', ctx.F([1, 2, 3], ' W', 0) === '' && ctx.F(null) === '');
  ok('B9 CSS: Linie skaliert nicht mit, erscheint NICHT mehr per eigener Einblendung; Story auf breiten Bildschirmen im Handy-Format', /\.gm-story \.wst-line\{[^}]*vector-effect:non-scaling-stroke/.test(css) && !/wstLineIn/.test(css) && /@media\(min-width:700px\)\{\s*\.gm-story\{inset:0 auto 0 50%;width:440px/.test(css));
}
{
  ok('C1 Story: eigene Leistungs-Seite nur mit Messreihe UND Ø-Wert', /var pw=cleanArr\(st&&st\.power,/.test(ui) && /if\(pw&&vm\.avgPowerW!=null\)\{/.test(ui) && /gmStoryDotChart\(pw,' W',0,\{avg:vm\.avgPowerW,max:vm\.maxPowerW\}\)/.test(ui));
  ok('C2 Story-HF/-Tempo nutzen Summary-Ø/Max (kein „164" neben „167")', /gmStoryDotChart\(hr,' bpm',0,\{avg:hrAvg,max:hrMax\}\)/.test(ui) && /var hrMax=Math\.max\(Math\.max\.apply\(null,hr\),\(vm\.maxHr!=null\?vm\.maxHr:0\)\);/.test(ui) && /gmStoryDotChart\(spdC,' km\/h',1,\{avg:spAvg\}\)/.test(ui));
  ok('C3 Aktivitaetsseite: Leistungs-Kacheln (Ø/NP/Max) nur wenn belegt, Messreihe „Leistung (W)"', /if\(_pwC\.length\)kcells\.splice\.apply\(kcells,\[3,0\]\.concat\(_pwC\)\);/.test(ui) && /\{key:'power',label:'' \+ _uiT\('ui\.leistung_w'\)/.test(ui));
  ok('C4 Rad: Trittfrequenz in rpm statt „spm"', /sportId==='cycling'\s*\?\{key:'cadence',label:'' \+ _uiT\('ui\.trittfrequenz_rpm'\)/.test(ui));
  ok('C5 Kraft ohne Uebungslog: nur belegte Kacheln statt vier Striche', /if\(!_gym\|\|\(_gym\.exCount==null&&_gym\.setCount==null&&_gym\.volumeKg==null\)\)\{/.test(ui));
}
console.log('\n' + (fail ? '❌' : '✅') + ' power_story_line: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
