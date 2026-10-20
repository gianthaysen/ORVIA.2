/* ============================================================
   ORVIA · running_quality_v457 — Running Experience Premium Quality Pass (ohne Browser)
   F  Formatierung: Distanz (Lauf 2 Stellen, gerundet), kurzer Anzeigetitel (Original bleibt), Seitenverhaeltnis der Karte
   R  Strecke fein (Linie/Rand/Start/Ziel) — eine Stelle in route-map.js
   Z  Zonengrenzen: nie erfunden
   W  Werkzeug activity-dips (v2): nur lesen, Kadenz-Gegenprobe
   ============================================================ */
import { existsSync as _ex, readFileSync } from 'node:fs';
import vm from 'node:vm';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const rd = f => readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
const ui = rd('js/ui.js'), rm = rd('js/route-map.js'), de = rd('locales/de.js'), dips = rd('tools/activity-dips-console.js');
const slice = (a, b) => ui.slice(ui.indexOf(a), ui.indexOf(b));
const c = { Math, String, isFinite, Number };
vm.createContext(c);
vm.runInContext("function fmtDe(n){ if(n==null||isNaN(n))return '–'; var r=Math.round(n*10)/10; return (r===Math.round(r))?String(Math.round(r)):String(r).replace('.',','); }" +
  slice('function gmDistTxt(m,fam){', '/* Wert einer Kennzahl mit Einheit') + slice('function gmRouteAspect(route){', 'function gmAxLeadHtml(') + ';this.D=gmDistTxt;this.T=gmShortTitle;this.A=gmRouteAspect;', c);

sec('F · Formatierung');
ok('F1 Lauf: zwei Nachkommastellen, mathematisch gerundet (21175 m → 21,18; 21184 → 21,18; 10000 → 10,00)', c.D(21175, 'running') === '21,18 km' && c.D(21184, 'running') === '21,18 km' && c.D(10000, 'running') === '10,00 km' && c.D(21174, 'running') === '21,17 km');
ok('F2 Rad wie bisher (eine Stelle), Schwimmen in Metern, ohne Wert „—"', c.D(45320, 'cycling') === '45,3 km' && c.D(1350, 'swimming') === '1.350 m' && c.D(null, 'running') === '—');
const t = c.T('Flensburg - W 25 So. Rennen - Jacob Cement Halbmarathon (21,1 km)');
ok('F3 Kurzer Titel: Veranstaltungsname, Distanz in Klammern faellt weg, Original bleibt im Ergebnis', t.text === 'Jacob Cement Halbmarathon' && t.shortened && t.full === 'Flensburg - W 25 So. Rennen - Jacob Cement Halbmarathon (21,1 km)');
ok('F4 Kurze und normale Titel bleiben unveraendert (kein Abschneiden, keine erfundenen Woerter)', ['Intervalllauf', 'Flensburg Laufen', 'Lauf am Morgen - locker'].every(x => c.T(x).text === x && !c.T(x).shortened));
ok('F5 Kartenformat aus der Strecke, begrenzt 0,75–1,6 (Nord-Sued-Strecke hoch, Ost-West breit)', c.A([[54.78, 9.43], [54.84, 9.44]]) === 0.75 && c.A([[51.48, 7.0], [51.49, 7.2]]) === 1.6 && c.A([]) === 1.2);
ok('F6 Seite, Analyse, Highlights und Karten nutzen dieselbe Distanzfunktion', /case 'distance':return gmDistTxt\(v,fam\);/.test(ui) && /var distTxt=M\('distance'\)\|\|vm\.distanceLabel\|\|null;/.test(ui));

sec('R · Strecke');
ok('R1 eine Stelle: Linie 3 px, Rand +1,5 px bei 40 %, Start r 5, Ziel r 3,5', /var ROUTE_W = 3, CASE_W = 1\.5, CASE_OPACITY = 0\.4;/.test(rm) && /class="rmx-start" cx="' \+ cx\(a\) \+ '" cy="' \+ cy\(a\) \+ '" r="5"/.test(rm) && /class="rmx-end" cx="' \+ cx\(b\) \+ '" cy="' \+ cy\(b\) \+ '" r="3\.5"/.test(rm));
ok('R2 GPS-Geometrie unveraendert: Glaettung/Vereinfachung wie bisher (keine neue Glaettung in v8-457)', /var SMOOTH_W = \[1, 2, 3, 2, 1\], SMOOTH_MAX_M = 25, SIMPLIFY_M = 0\.7, ROUND_M = 6;/.test(rm));

sec('Z · Pulszonen');
const z = slice('function gmAaZoneInfoHtml(z){', 'function gmAaZonesHtml(md){');
ok('Z1 Grenzen nur, wenn geliefert (z.bounds) — sonst ausdruecklicher Hinweis; keine Berechnung', /var b=z&&Array\.isArray\(z\.bounds\)&&z\.bounds\.length===z\.seconds\.length\?z\.bounds:null;/.test(z) && /_uiT\('ax\.z\.no_bounds'\)/.test(z) && !/maxHr|0\.9|220/.test(z) && /'ax\.z\.history': 'Geänderte Grenzen gelten für neue Aktivitäten/.test(de));

sec('W · Werkzeug');
ok('W1 activity-dips@2: nur lesen (kein insert/update/upsert/delete/rpc), Kadenz-Gegenprobe an langsamen Punkten', /tool: 'activity-dips@2'/.test(dips) && !/\.(insert|update|upsert|delete|rpc)\(/.test(dips) && /kadenz_median_langsame_punkte/.test(dips));

console.log('\n' + (fail ? '❌' : '✅') + ' running_quality_v457: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
