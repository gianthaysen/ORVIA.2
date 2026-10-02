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
  /* v8-429 — Gians Vorgabe 2.10. (Entwurf als HTML/CSS geliefert): Diagramm-Tafel, gestricheltes
     Raster, Verlaufsflaeche, kraeftige Kurve mit weichem Schein, Ø-Linie gestrichelt mit Punkt
     und Schild, Ring am Hoechstwert. Punktraster entfaellt. Abweichung vom Entwurf: die
     Etiketten stehen in einer eigenen Spalte neben der Zeichenflaeche. */
  const i = ui.indexOf('var _gmStoryChartSeq=0;'), j = ui.indexOf('/* Baut die Seiten NUR aus vorhandenen');
  const mk = calm => { const c = { gmEsc: s => String(s), window: { matchMedia: () => ({ matches: calm }) } }; vm.createContext(c); vm.runInContext(ui.slice(i, j) + '\nthis.F=gmStoryDotChart;this.M=gmMonoPath;', c); return c; };
  const ctx = mk(false);
  const vals = []; for (let k = 0; k < 300; k++) vals.push(120 + 30 * Math.sin(k / 20));
  const h = ctx.F(vals, ' bpm', 0, { avg: 135, max: 167 });
  const dLine = (/<path class="wst-line" d="([^"]+)"/.exec(h) || [])[1], dArea = (/<path class="wst-area" d="([^"]+)"/.exec(h) || [])[1];
  ok('B1 durchgezogene Kurve', /<path class="wst-line" d="M0,/.test(h));
  ok('B2 Flaeche liegt genau unter DERSELBEN Kurve (Kurve + Grundlinie)', !!dLine && dArea === dLine + ' L360,430 L0,430 Z');
  const iRev = h.indexOf('<div class="wst-rev">'), iRevEnd = h.indexOf('</svg></div>', iRev);
  const inRev = cls => { const p = h.indexOf('class="' + cls); return p > iRev && p < iRevEnd; };
  ok('B2a Flaeche, Schein UND Kurve liegen in EINER Aufdeck-Huelle (erscheinen gemeinsam)', iRev > 0 && inRev('wst-area') && inRev('wst-glow g1') && inRev('wst-line') && h.indexOf('class="wst-grid"') < iRev && h.indexOf('class="wst-avg"') < iRev);
  ok('B2b Aufdecken per CSS (clip-path, 1,6 s, links → rechts) — KEIN SMIL mehr im Markup', !/<animate/.test(h) && !/<clipPath/.test(h) && /\.gm-story \.wst-rev\{[^}]*clip-path:inset\(-16px\);animation:wstReveal 1\.6s cubic-bezier\(\.35,0,\.25,1\) both\}/.test(css) && /@keyframes wstReveal\{from\{[^}]*clip-path:inset\(-16px 100% -16px -16px\)\}to\{[^}]*clip-path:inset\(-16px\)\}\}/.test(css));
  ok('B2b2 Safari: -webkit-clip-path steht neben clip-path (Huelle und Keyframes)', (css.match(/-webkit-clip-path:inset\(-16px/g) || []).length >= 3);
  const hc = mk(true).F(vals, ' bpm', 0);
  ok('B2c „Bewegung reduzieren": Diagramm steht sofort (Klasse calm + Medienabfrage)', /class="wst-dotwrap calm"/.test(hc) && /class="wst-line"/.test(hc) && /\.gm-story \.wst-dotwrap\.calm \.wst-rev\{animation:none\}/.test(css) && /prefers-reduced-motion:reduce\)\{[\s\S]{0,700}\.gm-story \.wst-rev\{animation:none\}/.test(css));
  ok('B2d Kurve ist kubisch (weich), Verlauf mit drei Stufen', (h.match(/ C[\d.-]+,[\d.-]+ /g) || []).length >= 110 && /<linearGradient id="wstGrad\d+"[^>]*><stop offset="0" class="wst-g0"\/><stop offset="\.55" class="wst-g1"\/><stop offset="1" class="wst-g2"\/>/.test(h));
  {
    /* monoton-kubisch: trifft jeden Stuetzpunkt, kein Ueberschwingen (Kontrollpunkte bleiben zwischen den Nachbarn) */
    const pts = [[0, 100], [10, 40], [20, 40], [30, 90], [40, 10], [50, 60]];
    const d = ctx.M(pts); const segs = d.trim().split(' C').filter(Boolean).map(x => x.trim().split(' ').map(q => q.split(',').map(Number)));
    const hit = segs.every((sg, k) => sg[2][0] === pts[k + 1][0] && sg[2][1] === pts[k + 1][1]);
    const bounded = segs.every((sg, k) => { const lo = Math.min(pts[k][1], pts[k + 1][1]) - 0.05, hi = Math.max(pts[k][1], pts[k + 1][1]) + 0.05; return sg[0][1] >= lo && sg[0][1] <= hi && sg[1][1] >= lo && sg[1][1] <= hi; });
    ok('B2e Kurve trifft jeden Stuetzpunkt exakt und schwingt nie ueber einen Messwert hinaus', segs.length === 5 && hit && bounded, JSON.stringify(segs.map(sg => [sg[0][1], sg[1][1]])));
  }
  ok('B3 Schein = drei breite, blasse Striche derselben Kurve (kein Filter, kein Gruppen-opacity)', ['g1', 'g2', 'g3'].every(g => new RegExp('<path class="wst-glow ' + g + '" d="').test(h) && new RegExp('\\.gm-story \\.wst-glow\\.' + g + '\\{stroke-width:\\d+;stroke-opacity:\\.\\d+\\}').test(css)) && !/\.wst-glow[^{]*\{[^}]*(filter|[^-]opacity:)/.test(css) && (h.match(/class="wst-glow g\d" d="([^"]+)"/g) || []).every(m => m.indexOf(dLine) > 0));
  ok('B4 kein Punktraster mehr', !/<circle/.test(h));
  ok('B5 Ø/Max aus der Summary als Anzeige (eine Wahrheit mit dem Zahlenraster)', /class="wst-ax wst-axavg"[^>]*><i>Ø<\/i><b>135<\/b><\/span>/.test(h) && /class="wst-ax wst-axmax"><b>167<\/b><i>bpm<\/i><\/span>/.test(h));
  const h2 = ctx.F(vals, ' bpm', 0);
  ok('B6 ohne Summary: Ø/Max der Samples; Summary-Max unter dem Sample-Max wird ignoriert', /<i>Ø<\/i><b>1\d\d<\/b>/.test(h2) && /wst-axmax"><b>150<\/b><i>bpm<\/i>/.test(h2) && /wst-axmax"><b>150<\/b>/.test(ctx.F(vals, ' bpm', 0, { max: 140 })));
  ok('B7 jede Grafik bekommt eine eigene Verlaufs-id', (/linearGradient id="(wstGrad\d+)"/.exec(h2) || [])[1] !== (/linearGradient id="(wstGrad\d+)"/.exec(h) || [])[1]);
  ok('B8 zu wenige Werte ⇒ kein Diagramm', ctx.F([1, 2, 3], ' W', 0) === '' && ctx.F(null) === '');
  ok('B9 CSS: Striche skalieren nicht mit; Story auf breiten Bildschirmen im Handy-Format', /\.gm-story \.wst-line\{[^}]*stroke-width:2\.5;[^}]*vector-effect:non-scaling-stroke/.test(css) && !/wstLineIn/.test(css) && /@media\(min-width:700px\)\{\s*\.gm-story\{inset:0 auto 0 50%;width:440px/.test(css));
  {
    const iPlot = h.indexOf('<div class="wst-plot">'), iAxis = h.indexOf('<div class="wst-axis"'), iPk = h.indexOf('class="wst-pk"'), iDot = h.indexOf('class="wst-avgdot"');
    ok('B10 Zeichenflaeche und Wertespalte sind getrennt: Diagramm + Marker in .wst-plot, Etiketten danach in .wst-axis', iPlot > 0 && iPk > iRevEnd && iDot > iPk && iAxis > iDot && h.indexOf('class="wst-ax ') > iAxis && !/wst-avgbadge/.test(h) && !/wst-avgbadge/.test(css));
    const pr = +(/\.gm-story \.wst-plot\{position:absolute;inset:20px (\d+)px 20px 16px\}/.exec(css) || [])[1];
    const ax = /\.gm-story \.wst-axis\{position:absolute;top:20px;bottom:20px;right:(\d+)px;width:(\d+)px\}/.exec(css) || [];
    ok('B11 Abstand Zeichenflaeche → Wertespalte ≥ 13 px (Ring am Hoechstwert beruehrt kein Etikett)', pr > 0 && ax.length === 3 && pr - (+ax[1] + +ax[2]) >= 13, pr + ' − (' + ax[1] + ' + ' + ax[2] + ')');
    ok('B12 Raster: 4 waagerechte + 5 senkrechte Linien, gestrichelt, sehr zurueckhaltend', ((/<g class="wst-grid">(.*?)<\/g>/.exec(h) || [])[1] || '').split('<line').length - 1 === 9 && /\.gm-story \.wst-grid line\{stroke:rgba\(129,171,207,\.10\);stroke-width:1;stroke-dasharray:3 7;vector-effect:non-scaling-stroke\}/.test(css));
    ok('B13 Ø: gestrichelte Bezugslinie, Punkt am rechten Rand der Zeichenflaeche, Schild auf derselben Hoehe', /\.gm-story \.wst-avg\{[^}]*stroke-dasharray:5 5/.test(css) && /\.gm-story \.wst-avgdot\{position:absolute;left:100%/.test(css) && (() => { const d = /class="wst-avgdot" style="top:([\d.]+)%"/.exec(h), p = /class="wst-ax wst-axavg" style="top:clamp\(60px,([\d.]+)%,calc\(100% - 40px\)\)"/.exec(h), y = /class="wst-avg" x1="0" x2="360" y1="([\d.]+)"/.exec(h); return !!d && !!p && !!y && d[1] === p[1] && Math.abs(+y[1] / 430 * 100 - +d[1]) < 0.06; })());
    ok('B14 Schild weicht Max/Min aus (clamp in Pixeln), Linie und Punkt bleiben auf dem echten Wert', (() => { const flat = []; for (let k = 0; k < 400; k++) flat.push(k > 200 && k < 210 ? 60 : 150); const hf = ctx.F(flat, ' W', 0); const d = +(/class="wst-avgdot" style="top:([\d.]+)%"/.exec(hf) || [])[1]; return d < 12 && /wst-axavg" style="top:clamp\(60px,/.test(hf); })());
    ok('B15 Etiketten in Textfarbe; nur das Ø-Zeichen traegt den Akzent', (() => { const a = /\.gm-story \.wst-ax\{([^}]*)\}/.exec(css), b = /\.gm-story \.wst-axmax b\{([^}]*)\}/.exec(css); return !!a && !!b && !/var\(--acc/.test(a[1]) && !/var\(--acc/.test(b[1]) && /\.gm-story \.wst-axavg i\{color:var\(--acc/.test(css); })());
    ok('B16 Tafel: Verlauf, feine Kante, Innenkante, festes Seitenverhaeltnis', /\.gm-story \.wst-dotwrap\{[^}]*aspect-ratio:1\.18\/1;[^}]*border-radius:26px;border:1px solid rgba\(175,208,237,\.18\);[^}]*linear-gradient\(180deg,rgba\(19,36,53,\.88\),rgba\(7,17,27,\.94\)\)/.test(css) && /\.gm-story \.wst-dotwrap::after\{[^}]*inset:4px;[^}]*border-radius:22px/.test(css));
    const up = []; for (let k = 0; k < 300; k++) up.push(100 + k / 3);
    const pkL = parseFloat((/class="wst-pk" style="left:([\d.]+)%/.exec(ctx.F(up, ' bpm', 0)) || [])[1]);
    const pkL2 = parseFloat((/class="wst-pk" style="left:([\d.]+)%/.exec(ctx.F(up.slice().reverse(), ' bpm', 0)) || [])[1]);
    ok('B17 Ring am Hoechstwert wird am Rand nicht abgeschnitten (1,4 % … 98,6 %)', pkL <= 98.6 && pkL > 95 && pkL2 >= 1.4 && pkL2 < 5, pkL2 + ' / ' + pkL);
    ok('B18 Ring: heller Punkt mit Akzentrand und blassem Hof', /\.gm-story \.wst-pk\{[^}]*background:#f7fbff;border:2\.5px solid var\(--acc/.test(css) && /\.gm-story \.wst-pk\{[^}]*box-shadow:0 0 0 6px rgba/.test(css));
    ok('B19 Diagramm-Seiten: Ueberschrift, Tafel und Schlagzeile als EINE Gruppe', (ui.match(/,'wst-chartpg'\)\);/g) || []).length === 3 && /var page=function\(mid,footHtml,cls\)/.test(ui) && /\.gm-story \.wst-in\.wst-chartpg \.wst-mid\{flex:0 1 auto;margin-top:auto;/.test(css) && /\.gm-story \.wst-in\.wst-chartpg \.wst-foot\{margin-top:24px;margin-bottom:auto\}/.test(css));
  }
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
