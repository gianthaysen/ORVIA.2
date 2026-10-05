/* ============================================================
   ORVIA · map-style — der ORVIA-Kartenstil „Performance" (v8-440)
   ------------------------------------------------------------
   Gians Auftrag 5.10.: eine EIGENE Karte statt einer fremden Standardkarte — Navy,
   Graphit, Stahlblaugrau; kein Gruen fuer Parks und Waelder; die Strecke ist der Held,
   die Karte nur Orientierung. Reihenfolge der Sichtbarkeit:
     Strecke  ›  grosse Ortsnamen  ›  Hauptstrassen  ›  Nebenstrassen  ›  Gebaeude  ›  Natur.
   Keine Sonderziele (Laeden, Haltestellen …), keine Hausnummern, keine Grenzlinien.

   Die Karte ist fuer JEDE Sportart dieselbe; die Farbe der Sportart traegt nur die
   Strecke (styles.css „ORVIA FARBSYSTEM v6").

   Dieses Modul beschreibt nur, WIE gezeichnet wird (Ebenen, Farben, Breiten) im
   ueblichen Stilformat fuer Vektorkarten (Datenschema OpenMapTiles). Es kennt keinen
   Anbieter: Adressen der Kartendaten und Schriften kommen fertig aus map-config.js.
   Rein und testbar — kein DOM, kein Netz.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};

  /* EINE Stelle fuer die Kartenfarben (Vorgabe vom 5.10.). */
  var PALETTE = {
    bg: '#080D14',          /* Flaeche hinter der Karte, bevor Daten da sind */
    land: '#0D141C',
    nature: '#10191D',      /* Wald, Wiese, Park — kaum vom Land zu unterscheiden, bewusst nicht gruen */
    water: '#091622',
    building: '#121A23',
    path: '#18212B',        /* Fuss- und Feldwege: zwischen Land und Nebenstrasse */
    rail: '#18212B',
    roadMinor: '#202A35',
    roadMajor: '#2B3744',
    labelMinor: '#667381',
    labelMajor: '#98A4B1',
    halo: '#0D141C'
  };
  var SRC = 'orvia';
  var MAJOR = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
  var MINOR = ['minor', 'service'];
  var PATHS = ['path', 'track'];
  var NAME = ['coalesce', ['get', 'name:de'], ['get', 'name:latin'], ['get', 'name']];

  function inClass(list) { return ['match', ['get', 'class'], list, true, false]; }
  function width(stops) { var e = ['interpolate', ['exponential', 1.5], ['zoom']]; stops.forEach(function (s) { e.push(s[0], s[1]); }); return e; }
  function line(id, layer, filter, color, w, extra) {
    var l = { id: id, type: 'line', source: SRC, 'source-layer': layer, filter: filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': w } };
    if (extra) { for (var k in extra) { if (k === 'minzoom' || k === 'maxzoom') l[k] = extra[k]; else l.paint[k] = extra[k]; } }
    return l;
  }
  function fill(id, layer, filter, color, extra) {
    var l = { id: id, type: 'fill', source: SRC, 'source-layer': layer, paint: { 'fill-color': color, 'fill-antialias': true } };
    if (filter) l.filter = filter;
    if (extra) { for (var k in extra) { if (k === 'minzoom' || k === 'maxzoom') l[k] = extra[k]; else l.paint[k] = extra[k]; } }
    return l;
  }
  function label(id, layer, filter, color, size, font, extra) {
    var l = { id: id, type: 'symbol', source: SRC, 'source-layer': layer, filter: filter,
      layout: { 'text-field': NAME, 'text-font': font, 'text-size': size, 'text-max-width': 8, 'text-padding': 8, 'text-letter-spacing': 0.02 },
      paint: { 'text-color': color, 'text-halo-color': PALETTE.halo, 'text-halo-width': 1.3, 'text-halo-blur': 0.4 } };
    if (extra) { for (var k in extra) { if (k === 'minzoom' || k === 'maxzoom') l[k] = extra[k]; else if (k.indexOf('text-halo') === 0 || k === 'text-opacity' || k === 'text-color') l.paint[k] = extra[k]; else l.layout[k] = extra[k]; } }
    return l;
  }

  /* layers(fonts) → die Ebenen von unten nach oben */
  function layers(fonts) {
    var f = (fonts && fonts.length) ? fonts : ['Noto Sans Regular'];
    var P = PALETTE;
    return [
      { id: 'land', type: 'background', paint: { 'background-color': P.land } },
      /* Natur: Wald, Wiese, Feuchtgebiet, Parks, Friedhoefe, Sportflaechen — EIN Ton */
      fill('nature-cover', 'landcover', inClass(['wood', 'grass', 'wetland']), P.nature),
      fill('nature-use', 'landuse', inClass(['cemetery', 'pitch', 'playground', 'stadium', 'track', 'park']), P.nature, { minzoom: 9 }),
      fill('nature-park', 'park', null, P.nature, { minzoom: 8, 'fill-opacity': 0.7 }),
      fill('water', 'water', ['!=', ['get', 'brunnel'], 'tunnel'], P.water),
      line('waterway', 'waterway', ['!=', ['get', 'brunnel'], 'tunnel'], P.water, width([[10, 0.6], [14, 1.6], [18, 6]]), { minzoom: 10 }),
      fill('building', 'building', null, P.building, { minzoom: 13.5, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14.5, 1] }),
      /* Wege und Strassen — ohne Rand, eine Farbe je Rang */
      line('road-path', 'transportation', inClass(PATHS), P.path, width([[14, 0.7], [16, 1.4], [18, 3]]), { minzoom: 14 }),
      line('road-minor', 'transportation', inClass(MINOR), P.roadMinor, width([[12, 0.5], [14, 1.5], [16, 4.5], [18, 13]]), { minzoom: 12 }),
      /* Bahn: nur durchgehende Gleise — Abstell- und Rangiergleise (service) machten Bahnhoefe zu einem Linienknaeuel */
      line('rail', 'transportation', ['all', inClass(['rail', 'transit']), ['!', ['has', 'service']]], P.rail, width([[11, 0.5], [14, 1], [18, 2.4]]), { minzoom: 11 }),
      line('road-major', 'transportation', inClass(MAJOR), P.roadMajor, width([[6, 0.5], [10, 1.1], [12, 1.8], [14, 3.2], [16, 8], [18, 20]]), { minzoom: 6 }),
      /* Beschriftung: sparsam. Strassennamen erst nah, kleine Orte dezent, Staedte deutlich. */
      label('label-road', 'transportation_name', inClass(MAJOR.concat(MINOR)), P.labelMinor, ['interpolate', ['linear'], ['zoom'], 14, 9.5, 18, 12], f,
        { minzoom: 14.5, 'symbol-placement': 'line', 'symbol-spacing': 380, 'text-max-angle': 30, 'text-padding': 12 }),
      label('label-place-minor', 'place', inClass(['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet']), P.labelMinor, ['interpolate', ['linear'], ['zoom'], 11, 10, 15, 12], f,
        { minzoom: 11, 'text-letter-spacing': 0.05, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 20] }),
      label('label-place-major', 'place', inClass(['city', 'town']), P.labelMajor, ['interpolate', ['linear'], ['zoom'], 6, 11, 11, 13, 15, 15.5], f,
        { minzoom: 4, 'text-padding': 10, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 20] })
    ];
  }

  /* build({ tiles, glyphs, maxzoom, fonts }) → vollstaendiger Stil. tiles/glyphs sind fertige
     Adressvorlagen (mit {z}/{x}/{y} bzw. {fontstack}/{range}); fehlt tiles, gibt es null. */
  function build(o) {
    o = o || {};
    if (!o.tiles) return null;
    var st = { version: 8, name: 'ORVIA Performance', sources: {}, layers: layers(o.fonts) };
    st.sources[SRC] = { type: 'vector', tiles: [String(o.tiles)], minzoom: 0, maxzoom: (+o.maxzoom > 0) ? +o.maxzoom : 14 };
    if (o.glyphs) st.glyphs = String(o.glyphs);
    else st.layers = st.layers.filter(function (l) { return l.type !== 'symbol'; });   /* ohne Schriften keine Beschriftung (statt Fehlern) */
    return st;
  }

  var api = { VERSION: 'map-style@1', PALETTE: PALETTE, SOURCE: SRC, layers: layers, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA.mapStyle = api;
})(typeof window !== 'undefined' ? window : globalThis);
