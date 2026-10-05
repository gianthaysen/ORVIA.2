/* ============================================================
   ORVIA · route_map_gl — Karte, die auf dem Geraet gezeichnet wird (v8-440)
   Gians Auftrag 5.10.: eigene ORVIA-Karte (Navy/Graphit, kein Gruen), scharf, die Strecke
   als Held; saubere Umstellung nur, wo sie noetig ist; Rueckfall muss bleiben.
   Hier: der Kartenstil (map-style.js) als reine Daten, die Einstellung, die Umrechnung
   Ausschnitt → Kamera, die Verdrahtung in route-map.js / route-map-view.js und die
   Rueckfallregeln. Der echte Browserlauf (Zeichnen, Lage, Farben am Bildschirm, Fehler)
   steht in route_map_gl_e2e_test.mjs.
   node supabase/tests/route_map_gl_test.mjs
   ============================================================ */
import fs from 'fs';
import vm from 'node:vm';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const APP = fileURLToPath(new URL(_APPREL, import.meta.url));
const rd = f => fs.readFileSync(join(APP, f), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };
const styleSrc = rd('js/map-style.js'), glSrc = rd('js/route-map-gl.js'), rmSrc = rd('js/route-map.js'), viewSrc = rd('js/route-map-view.js'), cfgSrc = rd('js/map-config.js');
const css = rd('styles.css'), idx = rd('index.html'), sw = rd('sw.js');
const REAL = (() => { const c = { window: {} }; vm.createContext(c); vm.runInContext(cfgSrc, c); return c.window.ORVIA_MAP_CONFIG; })();
const noComments = s => s.replace(/\/\*[^]*?\*\//g, '');

/* Umgebung wie im Browser; webgl: gibt es eine Zeichenflaeche? */
function mk(over, webgl) {
  const c = { ORVIA: {}, ORVIA_MAP_CONFIG: Object.assign({}, REAL, { key: 'abc' }, over || {}), Math, isFinite, encodeURIComponent, String, Array, Infinity, Object, Date, setTimeout, clearTimeout, Promise, Error, JSON };
  if (webgl) c.document = { createElement: () => ({ getContext: () => ({ getExtension: () => null }) }), head: { appendChild() { } } };
  c.window = c; c.globalThis = c; vm.createContext(c);
  vm.runInContext(styleSrc, c); vm.runInContext(glSrc, c); vm.runInContext(rmSrc, c);
  return c;
}
const way = [[51.4800, 7.2160], [51.4800, 7.2200], [51.4820, 7.2200], [51.4820, 7.2240], [51.4850, 7.2240], [51.4850, 7.2180], [51.4830, 7.2180], [51.4830, 7.2140], [51.4780, 7.2140], [51.4780, 7.2160], [51.4797, 7.2160]];
const route = []; for (let i = 0; i < way.length - 1; i++) for (let k = 0; k < 12; k++) route.push([way[i][0] + (way[i + 1][0] - way[i][0]) * k / 12, way[i][1] + (way[i + 1][1] - way[i][1]) * k / 12]); route.push(way[way.length - 1]);

/* ---------- A) Kartenstil ---------- */
{
  const S = mk().ORVIA.mapStyle, P = S.PALETTE;
  const st = S.build({ tiles: 'T/{z}/{x}/{y}', glyphs: 'G/{fontstack}/{range}', maxzoom: 15, fonts: ['Noto Sans Regular'] });
  const WANT = { bg: '#080D14', land: '#0D141C', building: '#121A23', roadMinor: '#202A35', roadMajor: '#2B3744', water: '#091622', nature: '#10191D', labelMinor: '#667381', labelMajor: '#98A4B1' };
  ok('A1 Kartenfarben genau wie vorgegeben (Hintergrund, Land, Gebaeude, Neben-/Hauptstrassen, Wasser, Natur, kleine/grosse Beschriftung)', Object.keys(WANT).every(k => P[k] === WANT[k]), JSON.stringify(P));
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  ok('A2 KEIN Gruen: in keiner Kartenfarbe ueberwiegt der Gruenanteil (Blau ≥ Gruen ueberall) — auch Wald, Wiese, Park nicht', Object.values(P).every(h => { const c = rgb(h); return c[2] >= c[1]; }), JSON.stringify(Object.entries(P).filter(([k, h]) => rgb(h)[2] < rgb(h)[1])));
  const lum = h => { const c = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  ok('A3 Rangfolge der Sichtbarkeit: Land < Gebaeude < Nebenstrassen < Hauptstrassen < kleine Beschriftung < grosse Beschriftung', lum(P.land) < lum(P.building) && lum(P.building) < lum(P.roadMinor) && lum(P.roadMinor) < lum(P.roadMajor) && lum(P.roadMajor) < lum(P.labelMinor) && lum(P.labelMinor) < lum(P.labelMajor));
  ok('A3a Natur und Wasser heben sich kaum vom Land ab (Helligkeit hoechstens 1,5-fach bzw. ± 25 %) — Wasser unterscheidet sich ueber den Blauton', lum(P.nature) / lum(P.land) < 1.5 && lum(P.nature) > lum(P.land) && Math.abs(lum(P.water) / lum(P.land) - 1) < 0.25 && parseInt(P.water.slice(5, 7), 16) > parseInt(P.land.slice(5, 7), 16), [lum(P.land), lum(P.nature), lum(P.water)].map(v => +v.toFixed(4)).join(' '));
  const ids = st.layers.map(l => l.id);
  ok('A4 Ebenen von unten nach oben: Land, Natur, Wasser, Gebaeude, Wege, Nebenstrassen, Bahn, Hauptstrassen, Beschriftung', JSON.stringify(ids) === JSON.stringify(['land', 'nature-cover', 'nature-use', 'nature-park', 'water', 'waterway', 'building', 'road-path', 'road-minor', 'rail', 'road-major', 'label-road', 'label-place-minor', 'label-place-major']), ids.join(' '));
  const srcLayers = [...new Set(st.layers.map(l => l['source-layer']).filter(Boolean))];
  ok('A5 keine Sonderziele, Hausnummern, Grenzen, Flughaefen, Gipfel, Gewaessernamen — nur Flaechen, Strassen, Orts- und Strassennamen', ['poi', 'housenumber', 'boundary', 'aeroway', 'mountain_peak', 'water_name', 'aerodrome_label'].every(x => srcLayers.indexOf(x) < 0), srcLayers.join(' '));
  const byId = Object.fromEntries(st.layers.map(l => [l.id, l]));
  ok('A6 Farben der Ebenen kommen aus der einen Farbliste', byId.land.paint['background-color'] === P.land && byId['nature-cover'].paint['fill-color'] === P.nature && byId['nature-park'].paint['fill-color'] === P.nature && byId.water.paint['fill-color'] === P.water && byId.building.paint['fill-color'] === P.building && byId['road-minor'].paint['line-color'] === P.roadMinor && byId['road-major'].paint['line-color'] === P.roadMajor && byId['label-place-major'].paint['text-color'] === P.labelMajor && byId['label-place-minor'].paint['text-color'] === P.labelMinor && byId['label-road'].paint['text-color'] === P.labelMinor);
  const wAt = (l, z) => { const e = l.paint['line-width']; for (let i = 3; i < e.length; i += 2) if (e[i] === z) return e[i + 1]; return null; };
  ok('A7 Hauptstrassen sind breiter als Nebenstrassen (Stufe 14 und 16), Wege am duennsten; runde Enden', wAt(byId['road-major'], 14) > wAt(byId['road-minor'], 14) && wAt(byId['road-major'], 16) > wAt(byId['road-minor'], 16) && wAt(byId['road-minor'], 16) > wAt(byId['road-path'], 16) && byId['road-major'].layout['line-cap'] === 'round' && byId['road-major'].layout['line-join'] === 'round');
  ok('A8 Gebaeude erst nah (ab Stufe 13,5, eingeblendet), Wege ab 14, Strassennamen ab 14,5 — die Uebersicht bleibt ruhig', byId.building.minzoom === 13.5 && byId['road-path'].minzoom === 14 && byId['label-road'].minzoom === 14.5 && Array.isArray(byId.building.paint['fill-opacity']));
  ok('A9 Beschriftung: deutscher Name zuerst, dann lateinische Schrift, dann Originalname; Schrift aus der Einstellung; dunkler Rand in Landfarbe', JSON.stringify(byId['label-place-major'].layout['text-field']) === JSON.stringify(['coalesce', ['get', 'name:de'], ['get', 'name:latin'], ['get', 'name']]) && JSON.stringify(byId['label-road'].layout['text-font']) === '["Noto Sans Regular"]' && byId['label-road'].paint['text-halo-color'] === P.land && byId['label-road'].layout['symbol-placement'] === 'line');
  ok('A10 Bahn: nur durchgehende Gleise (keine Abstell-/Rangiergleise)', JSON.stringify(byId.rail.filter).indexOf('["!",["has","service"]]') > 0);
  ok('A11 Quelle der Kartendaten und Schriften kommen von aussen; Stufen 0…maxzoom', st.version === 8 && st.sources.orvia.type === 'vector' && st.sources.orvia.tiles[0] === 'T/{z}/{x}/{y}' && st.sources.orvia.maxzoom === 15 && st.glyphs === 'G/{fontstack}/{range}' && st.layers.every(l => l.type === 'background' || l.source === 'orvia'));
  const noGlyph = S.build({ tiles: 'T' });
  ok('A12 ohne Schriften keine Beschriftungsebenen (statt Fehlern); ohne Kartendaten kein Stil', noGlyph.layers.every(l => l.type !== 'symbol') && noGlyph.layers.length === 11 && !noGlyph.glyphs && noGlyph.sources.orvia.maxzoom === 14 && S.build({}) === null && S.build() === null);
  ok('A13 build() liefert jedes Mal eigene Daten (kein gemeinsam veraenderbarer Stil)', S.build({ tiles: 'T' }).layers !== S.build({ tiles: 'T' }).layers);
  const decl = n => (new RegExp('--' + n + ':([^;}]+)').exec(css) || [])[1];
  ok('A14 styles.css fuehrt Hintergrund und Landfarbe der Karte mit denselben Werten', decl('orvia-map-bg') === P.bg && decl('orvia-map-land') === P.land, [decl('orvia-map-bg'), decl('orvia-map-land')].join(' '));
  ok('A15 Stil und Zeichenmodul kennen keinen Anbieter, keine Adresse und keinen Schluessel', !/maptiler/i.test(styleSrc + glSrc) && !/https?:\/\//.test(styleSrc + glSrc) && !(styleSrc + glSrc).includes(REAL.key));
  ok('A16 die Karte ist fuer jede Sportart dieselbe: der Stil kennt keine Sportart und keine Sportfarbe', !/activity|running|cycling|swim|strength/i.test(noComments(styleSrc)));
}

/* ---------- B) Einstellung ---------- */
{
  const G = mk().ORVIA.routeMapGL, c = G.cfg();
  ok('B1 Einstellung: gezeichnete Karte an, Bibliothek lokal, Schluessel in Kartendaten- und Schrift-Adresse eingesetzt, Platzhalter bleiben', c.on === true && c.lib === 'assets/vendor/maplibre-gl.js' && /\/tiles\/v3\/\{z\}\/\{x\}\/\{y\}\.pbf\?key=abc$/.test(c.tiles) && /\/fonts\/\{fontstack\}\/\{range\}\.pbf\?key=abc$/.test(c.glyphs) && c.maxzoom === 15 && JSON.stringify(c.fonts) === '["Noto Sans Regular"]', JSON.stringify(c).replace(/https:\/\/[^/]+/g, '…'));
  ok('B2 aus: engine „raster", Schalter enabled:false, kein Schluessel, keine Bibliothek, keine Kartendaten', mk({ engine: 'raster' }).ORVIA.routeMapGL.cfg().on === false && mk({ enabled: false }).ORVIA.routeMapGL.cfg().on === false && mk({ key: '' }).ORVIA.routeMapGL.cfg().on === false && mk({ vector: Object.assign({}, REAL.vector, { lib: '' }) }).ORVIA.routeMapGL.cfg().on === false && mk({ vector: null }).ORVIA.routeMapGL.cfg().on === false);
  ok('B3 echte Einstellung: engine „vector", Kartendaten bis Stufe 15, eine Schrift', REAL.engine === 'vector' && REAL.vector.maxzoom === 15 && REAL.vector.fonts.length === 1);
  ok('B4 ohne Zeichenflaeche (kein WebGL) nicht nutzbar ⇒ route-map nimmt Bildkacheln', G.supported() === false && G.usable() === false && mk().ORVIA.routeMap.cfg().engine === 'raster');
  const W = mk(null, true);
  ok('B5 mit Zeichenflaeche nutzbar ⇒ route-map meldet engine „vector"', W.ORVIA.routeMapGL.supported() === true && W.ORVIA.routeMapGL.usable() === true && W.ORVIA.routeMap.cfg().engine === 'vector' && W.ORVIA.routeMap.cfg().enabled === true);
  ok('B5a auch OHNE Bildkachel-Vorlagen bleibt die Karte an, wenn sie gezeichnet werden kann', mk({ tiles: {} }, true).ORVIA.routeMap.cfg().enabled === true && mk({ tiles: {} }).ORVIA.routeMap.cfg().enabled === false);
  ok('B6 die Probe-Zeichenflaeche wird nur einmal je Sitzung angelegt', (() => { let n = 0; const c2 = mk(null, true); c2.document.createElement = () => { n++; return { getContext: () => ({ getExtension: () => null }) }; }; c2.ORVIA.routeMapGL._reset(); c2.ORVIA.routeMapGL.usable(); c2.ORVIA.routeMapGL.usable(); c2.ORVIA.routeMapGL.usable(); return n === 1; })());
}

/* ---------- C) Ausschnitt → Kamera, Markup, hydrate ---------- */
{
  const W = mk(null, true), R = W.ORVIA.routeMap, G = W.ORVIA.routeMapGL;
  const w = 390, h = 255, pad = { t: 26, r: 26, b: 30, l: 26 };
  const v = R.fit(route, w, h, pad, 512), cam = G.camera(v);
  /* unabhaengig gerechnet: die Bibliothek legt eine 512er-Welt zugrunde */
  const scr = (lat, lon) => { const ws = 512 * Math.pow(2, cam.zoom); return [(R.lonX(lon) - R.lonX(cam.lon)) * ws + w / 2, (R.latY(lat) - R.latY(cam.lat)) * ws + h / 2]; };
  const d = route.map(p => { const a = R.project(p[0], p[1], v), b = scr(p[0], p[1]); return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])); });
  ok('C1 Kamera der Karte trifft den Ausschnitt der Strecke: jeder Streckenpunkt liegt in beiden Rechnungen an derselben Stelle (± 0,001 px)', Math.max.apply(null, d) < 1e-3 && Math.abs(cam.zoom - (v.Z - 1)) < 1e-12, 'max ' + Math.max.apply(null, d).toExponential(2) + ' px, Stufe ' + cam.zoom.toFixed(3));
  const c2 = G.cameraAt(0.52, 0.33, 15);
  ok('C2 cameraAt (Mittelpunkt + Zoomstufe der Kartenansicht) rechnet gleich; unbrauchbarer Ausschnitt ⇒ null', Math.abs(R.lonX(c2.lon) - 0.52) < 1e-12 && Math.abs(R.latY(c2.lat) - 0.33) < 1e-9 && c2.zoom === 14 && G.camera(null) === null && G.camera({ world: 0 }) === null);
  const html = R.html(route, { w, h, pad });
  const m = /<div class="rmx-tiles rmx-gl" data-rmx-gl="([-\d.]+),([-\d.]+),([-\d.]+)"><\/div>/.exec(html);
  ok('C3 Markup: ein Halter mit der Kamera statt Bildkacheln; Strecke, Start/Ziel und Quellenhinweis unveraendert darueber', !!m && Math.abs(+m[1] - cam.lon) < 1e-6 && Math.abs(+m[2] - cam.lat) < 1e-6 && Math.abs(+m[3] - cam.zoom) < 1e-3 && !/<img class="rmx-t"/.test(html) && /class="rmx-line/.test(html) && /class="rmx-start"/.test(html) && /class="rmx-attr"/.test(html) && html.indexOf('rmx-gl') < html.indexOf('rmx-route'));
  ok('C3a ausdruecklich ohne Karte (tiles:false) ⇒ weder Halter noch Kacheln', !/rmx-tiles/.test(R.html(route, { w, h, pad, tiles: false })));
  const rasterHtml = mk({ engine: 'raster' }, true).ORVIA.routeMap.html(route, { w, h, pad });
  ok('C4 Schalter engine „raster" ⇒ dasselbe Markup wie bis v8-439 (Bildkacheln)', /<img class="rmx-t"/.test(rasterHtml) && !/rmx-gl/.test(rasterHtml));
  /* hydrate: Halter bekommen die gezeichnete Karte */
  const mkHolder = (attr) => { const box = { cls: ['rmx', 'has-tiles'], ev: [], classList: { contains: n => box.cls.includes(n), add: n => box.cls.push(n), remove: n => { box.cls = box.cls.filter(x => x !== n); } }, dispatchEvent: e => box.ev.push(e.type) };
    return { box, getAttribute: () => attr, closest: () => box }; };
  W.CustomEvent = function (t) { this.type = t; };
  const calls = []; let cb = null;
  G.attach = (holder, cam2, o) => { calls.push([holder, cam2]); cb = o.onFail; return true; };
  const H = mkHolder(m ? m[1] + ',' + m[2] + ',' + m[3] : '0,0,0');
  const res = R.hydrate({ querySelectorAll: sel => /data-rmx-gl/.test(sel) ? [H] : [] });
  ok('C5 hydrate setzt die gezeichnete Karte in den Halter (Kamera aus dem Markup)', calls.length === 1 && calls[0][0] === H && Math.abs(calls[0][1].lon - cam.lon) < 1e-6 && Math.abs(calls[0][1].zoom - cam.zoom) < 1e-3 && res.gl === 1 && H.box.cls.indexOf('tiles-failed') < 0);
  cb('engine');
  ok('C6 Geraet kann nicht zeichnen ⇒ Karte dieser Ansicht aus (Strecke bleibt), KEINE Pause — der naechste Aufbau nimmt Bildkacheln', H.box.cls.includes('tiles-failed') && H.box.ev[0] === 'orvia:rmx-failed' && R.paused() === false);
  const H2 = mkHolder('7.2,51.4,13'); R.hydrate({ querySelectorAll: sel => /data-rmx-gl/.test(sel) ? [H2] : [] }); cb('tiles');
  ok('C7 Kartendaten kommen nicht ⇒ Karte aus, Meldung an die Seite, 5 Minuten Pause (wie bei Bildkacheln)', H2.box.cls.includes('tiles-failed') && R.paused() === true && R.stats().pausedMs > 4.9 * 60000 && R.fails() === 1);
  const n0 = calls.length, H3 = mkHolder('7.2,51.4,13'); const r3 = R.hydrate({ querySelectorAll: sel => /data-rmx-gl/.test(sel) ? [H3] : [] });
  ok('C8 in der Pause wird die Karte gar nicht erst angefordert', calls.length === n0 && H3.box.cls.includes('tiles-failed') && r3.skipped === 1);
  R._resume();
  G.attach = () => false; const H4 = mkHolder('7.2,51.4,13'); R.hydrate({ querySelectorAll: sel => /data-rmx-gl/.test(sel) ? [H4] : [] });
  const H5 = mkHolder('x,y,z'); R.hydrate({ querySelectorAll: sel => /data-rmx-gl/.test(sel) ? [H5] : [] });
  ok('C9 Karte laesst sich nicht einsetzen oder Angabe unlesbar ⇒ Strecke ohne Karte, kein Fehler', H4.box.cls.includes('tiles-failed') && H5.box.cls.includes('tiles-failed'));
}

/* ---------- D) Rueckfallregeln und Verdrahtung ---------- */
{
  ok('D1 Bibliothek nicht ladbar = Netzproblem: neu versuchen (Meldung „tiles", Pause), nicht die Sitzung auf Bildkacheln festlegen', /_libP\.catch\(function \(\) \{ _libP = null; \}\);/.test(glSrc) && (glSrc.match(/\}, function \(\) \{ fail\('tiles'\); \}\);/g) || []).length === 2);
  ok('D2 Geraet kann nicht zeichnen (Fehler beim Aufbau, WebGL) ⇒ „engine": fuer die Sitzung zurueck zu Bildkacheln', /if \(kind === 'engine'\) _down = 'engine';/.test(glSrc) && /function usable\(\) \{ return !_down && cfg\(\)\.on && !!O\.mapStyle && supported\(\); \}/.test(glSrc) && /if \(\/webgl\|context\/i\.test\(msg\)\) return 'engine';/.test(glSrc));
  ok('D3 nur Fehler der Kartendaten zaehlen als „Karte kommt nicht" — eine fehlende Schrift schaltet die Karte nicht ab', /if \(e && e\.sourceId === O\.mapStyle\.SOURCE\) return 'tiles';/.test(glSrc) && /return null;\s*\}\s*function options/.test(glSrc));
  ok('D4 Zeichenflaeche in voller Pixeldichte des Geraets (bis zum Dreifachen) — das ist die Schaerfe', /var MAX_RATIO = 3;/.test(glSrc) && /function ratio\(\) \{ var d = \+root\.devicePixelRatio \|\| 1; return Math\.max\(1, Math\.min\(MAX_RATIO, d\)\); \}/.test(glSrc) && /pixelRatio: ratio\(\)/.test(glSrc));
  ok('D5 mitgeschickt wird nur die Herkunft der Seite; kein Drehen, kein Kippen, eigener Quellenhinweis bleibt', /referrerPolicy: 'strict-origin'/.test(glSrc) && /attributionControl: false/.test(glSrc) && /dragRotate: false/.test(glSrc) && /maxPitch: 0/.test(glSrc) && /touchZoomRotate\.disableRotation\(\)/.test(glSrc));
  ok('D6 stehende Karten: hoechstens 3 im Speicher, nicht mehr sichtbare nach 45 s frei; dieselbe Karte wird wieder eingesetzt statt neu gebaut', /var MAX_STATIC = 3;/.test(glSrc) && /var IDLE_MS = 45000;/.test(glSrc) && /if \(e\.box\.parentNode !== holder\) holder\.appendChild\(e\.box\);/.test(glSrc) && /e\.map\.remove\(\)/.test(glSrc));
  ok('D7 Kartenansicht: Strecke als Ebene der Karte — 5 px in der Farbe der Sportart, dunkler Rand 8 px, Start-Ring und Ziel-Punkt', /'line-color': '#000000', 'line-opacity': 0\.62, 'line-width': W\.casing \|\| 8/.test(glSrc) && /'line-color': C\.line \|\| '#D8BB7A', 'line-width': W\.line \|\| 5/.test(glSrc) && /id: 'route-start', type: 'circle'/.test(glSrc) && /id: 'route-end', type: 'circle'/.test(glSrc));
  ok('D8 Kartenansicht liest die Farben aus dem Farbsystem (Thema der Sportart, Start/Ziel als Zustandsfarben)', /colors: \{ line: val\('--activity-primary', null\), start: val\('--orvia-route-start', null\), finish: val\('--orvia-route-finish', null\), base: val\('--orvia-bg-base', null\) \}/.test(viewSrc));
  ok('D9 Kartenansicht: gezeichnete Karte zuerst, sonst Bildkacheln; faellt das Zeichnen aus, laufen Bildkacheln in DERSELBEN Ansicht an', /var glWant = c\.engine === 'vector' && c\.enabled && !R\.paused\(\);/.test(viewSrc) && /if \(!\(glWant && startGL\(S\)\)\) startRaster\(S, opts\.seed\);/.test(viewSrc) && /if \(kind === 'engine'\) \{ startRaster\(st, null\); return; \}/.test(viewSrc) && /if \(st\.gl\) st\.gl\.destroy\(\);/.test(viewSrc));
  ok('D10 Kartenansicht: Kartendaten kommen nicht ⇒ Hinweis, gemeinsame Pause, Strecke bleibt bedienbar', /if \(!st\.failed\) \{ st\.failed = true; try \{ RM\(\)\._err\(null\); \} catch \(e\) \{\} el\.classList\.add\('rmv-notiles'\); \}/.test(viewSrc));
  ok('D10a die Strecke beginnt unter dem Band hinter dem Kopf: Innenrand oben 40 px groesser, Band endet dort (104 px unter dem sicheren Rand)', /var GL_BAND = 40;/.test(viewSrc) && /t: clamp\(padT \+ \(glWant \? GL_BAND : 0\), 60, h \* 0\.35\)/.test(viewSrc) && /\.rmv\.rmv-glmode \.rmv-dim\{--rmx-dim:0;background:linear-gradient\(180deg,rgba\(5,9,16,\.88\) 0,rgba\(5,9,16,\.72\) calc\(var\(--sat,0px\) \+ 52px\),rgba\(5,9,16,0\) calc\(var\(--sat,0px\) \+ 104px\)/.test(css));
  ok('D11 Knoepfe und Tastatur steuern die gezeichnete Karte (hinein, heraus, ganze Strecke, Pfeile)', /if \(S\.gl\) \{ S\.gl\.zoomBy\(dZ\); return; \}/.test(viewSrc) && /if \(S\.gl\) \{ S\.gl\.fit\(\); return; \}/.test(viewSrc) && /if \(st\.gl\) \{ st\.gl\.panBy\(-dx, -dy\); return; \}/.test(viewSrc));
  ok('D12 eigene Gesten nur fuer Bildkacheln (die gezeichnete Karte bringt ihre mit) — einmal gebunden', /function bindGestures\(\) \{\s*var st = S, stage = S\.stage;\s*if \(st\.gestures\) return; st\.gestures = true;/.test(viewSrc));
  ok('D13 geladen in der Reihenfolge Einstellung → Stil → Zeichenmodul → Karte → Ansicht, alle im Offline-Vorrat', ['js/map-config.js', 'js/map-style.js', 'js/route-map-gl.js', 'js/route-map.js', 'js/route-map-view.js'].every((f, i, a) => idx.indexOf('<script src="' + f + '"></script>') > 0 && (i === 0 || idx.indexOf(a[i - 1]) < idx.indexOf(f)) && sw.indexOf("'./" + f + "'") > 0));
  const lib = join(APP, 'assets/vendor/maplibre-gl.js');
  ok('D14 Bibliothek liegt lokal bei (MapLibre GL JS 5.24.0, BSD-Lizenz samt Lizenztext) — kein fremder Server', existsSync(lib) && statSync(lib).size > 900000 && /MapLibre GL JS[^]{0,120}v5\.24\.0\/LICENSE\.txt/.test(fs.readFileSync(lib, 'utf8').slice(0, 400)) && existsSync(join(APP, 'assets/vendor/maplibre-gl.LICENSE.txt')) && /Redistribution and use in source and binary forms/.test(fs.readFileSync(join(APP, 'assets/vendor/maplibre-gl.LICENSE.txt'), 'utf8')));
  ok('D15 die Bibliothek wird NICHT beim Start geladen und nicht vorab in den Offline-Vorrat gelegt (erst beim ersten Kartenbedarf)', !/maplibre/i.test(idx) && !/maplibre/i.test(sw) && /s\.src = c\.lib; s\.async = true;/.test(glSrc));
  ok('D16 Darstellung: Zeichenflaeche blendet sich ein; kein Schleier ueber der eigenen Karte; in der Ansicht liegt sie zuunterst', /\.rmx-tiles \.rmx-glbox\{position:absolute;inset:0;opacity:0;transition:opacity \.45s ease\}/.test(css) && /\.rmx-tiles \.rmx-glbox\.ok\{opacity:1\}/.test(css) && /\.rmx-tiles\.rmx-gl,\.gm-story \.wst-mapbg \.rmx-tiles\.rmx-gl\{--rmx-dim:0\}/.test(css) && /\.rmv\.rmv-glmode \.rmv-layer\{display:none\}/.test(css) && /\.rmv\.rmv-glready \.rmv-route\{display:none\}/.test(css) && /\.maplibregl-canvas\{position:absolute;left:0;top:0\}/.test(css));
}
console.log('\n' + (fail ? '❌' : '✅') + ' route_map_gl: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
