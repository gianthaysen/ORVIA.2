/* ORVIA · _mvt — Kunst-Kartendaten fuer Browser-Tests (v8-440)

   Die auf dem Geraet gezeichnete Karte (route-map-gl.js) liest Vektorkacheln im ueblichen
   Format (Mapbox Vector Tile, protobuf). Der echte Anbieter ist aus der Testumgebung nicht
   erreichbar und soll es auch nicht sein — die Tests fangen ihn ab und liefern diese
   Kunstkacheln im Datenschema des Stils (OpenMapTiles):
     · „Hauptstrassen" (transportation, class=primary) exakt auf dem Gradnetz (Schritt waehlbar)
     · optional eine „Wald"-Flaeche (landcover, class=wood) und ein „Gebaeude" (building)
   Damit laesst sich pruefen, dass die Strecke pixelgenau auf der Karte liegt und dass die
   Ebenen die Farben des ORVIA-Stils tragen. Keine Namen ⇒ keine Schrift-Anfragen.

   Bewusst ohne Fremdpaket: der Kodierer umfasst nur, was hier gebraucht wird. */

const lonX = lon => (lon + 180) / 360;
const latY = lat => { const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const xLon = x => x * 360 - 180;
const yLat = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;

/* ---- protobuf (nur varint + Laengen-Felder) ---- */
const varint = n => { const o = []; n = Math.floor(n); while (n > 127) { o.push((n % 128) | 128); n = Math.floor(n / 128); } o.push(n); return o; };
const tag = (f, w) => varint((f << 3) | w);
const bytes = (f, b) => [...tag(f, 2), ...varint(b.length), ...b];
const str = (f, s) => bytes(f, [...Buffer.from(String(s), 'utf8')]);
const uint = (f, n) => [...tag(f, 0), ...varint(n)];
const zz = n => (n << 1) ^ (n >> 31);

/* Geometrie: Linienzug bzw. geschlossener Ring in Kachelkoordinaten (0…4096) */
function geom(pts, close) {
  const out = []; let cx = 0, cy = 0;
  const p0 = pts[0];
  out.push((1 & 7) | (1 << 3), zz(p0[0] - cx), zz(p0[1] - cy)); cx = p0[0]; cy = p0[1];
  out.push((2 & 7) | ((pts.length - 1) << 3));
  for (let i = 1; i < pts.length; i++) { out.push(zz(pts[i][0] - cx), zz(pts[i][1] - cy)); cx = pts[i][0]; cy = pts[i][1]; }
  if (close) out.push((7 & 7) | (1 << 3));
  return out;
}
const packed = (f, arr) => bytes(f, arr.flatMap(n => varint(n >>> 0)));
/* feature: type 2 = Linie, 3 = Flaeche; tags = [keyIdx, valIdx, …] */
const feature = (type, tags, g) => bytes(2, [...packed(2, tags), ...uint(3, type), ...packed(4, g)]);
function layer(name, keys, values, features) {
  let b = [...uint(15, 2), ...str(1, name)];
  features.forEach(f => { b = b.concat(f); });
  keys.forEach(k => { b = b.concat(str(3, k)); });
  values.forEach(v => { b = b.concat(bytes(4, str(1, v))); });
  b = b.concat(uint(5, 4096));
  return bytes(3, b);
}

/* gridTile(z,x,y,{ step, wood, building }) → Buffer
   step: Abstand der Gitterlinien in Grad (Vorgabe 0,001°)
   wood / building: [[lat,lon]…] Ring einer Flaeche (optional) */
export function gridTile(z, x, y, o = {}) {
  const n = 2 ** z, E = 4096, B = 256, step = o.step || 0.001;
  const lon0 = xLon(x / n), lon1 = xLon((x + 1) / n), lat0 = yLat(y / n), lat1 = yLat((y + 1) / n);
  const tx = lon => Math.round((lonX(lon) * n - x) * E), ty = lat => Math.round((latY(lat) * n - y) * E);
  const k = v => Math.round(v / step);
  const feats = [];
  /* zu weit herausgezoomt ⇒ das Gitter waere dichter als die Aufloesung der Kachel: dann jede m-te Linie */
  const m = Math.max(1, Math.ceil((lon1 - lon0) / step / 400));
  for (let i = k(lon0) - 1; i <= k(lon1) + 1; i++) { if (i % m) continue; const X = tx(i * step); if (X < -B || X > E + B) continue; feats.push(feature(2, [0, 0], geom([[X, -B], [X, E + B]]))); }
  for (let j = k(lat1) - 1; j <= k(lat0) + 1; j++) { if (j % m) continue; const Y = ty(j * step); if (Y < -B || Y > E + B) continue; feats.push(feature(2, [0, 0], geom([[-B, Y], [E + B, Y]]))); }
  let out = layer('transportation', ['class'], ['primary'], feats);
  const poly = (ring) => { const p = ring.map(q => [tx(q[1]), ty(q[0])]); return p.every(q => q[0] < -B || q[0] > E + B || q[1] < -B || q[1] > E + B) ? null : geom(p, true); };
  if (o.wood) { const g = poly(o.wood); if (g) out = out.concat(layer('landcover', ['class'], ['wood'], [feature(3, [0, 0], g)])); }
  if (o.building) { const g = poly(o.building); if (g) out = out.concat(layer('building', [], [], [feature(3, [], g)])); }
  return Buffer.from(out);
}
export const mercator = { lonX, latY, xLon, yLat };
