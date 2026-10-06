/* ============================================================
   ORVIA · map-style — der ORVIA-Kartenstil „Performance" (v8-440, V2 seit v8-441)
   ------------------------------------------------------------
   Gians Auftrag 5.10.: eine EIGENE Karte statt einer fremden Standardkarte — Navy,
   Graphit, Stahlblaugrau; kein Gruen fuer Parks und Waelder; die Strecke ist der Held,
   die Karte nur Orientierung.

   V2 (Gians Auftrag 6.10., nach v8-440 auf dem iPhone): „Rest-Gruen/Olive sichtbar, stellen-
   weise zu flach und zu dunkel, Strassen/Gebaeude zu wenig unterschieden, wirkt wie eine
   beliebige dunkle Karte, ORVIA-Gold fehlt".
     · Rest-Gruen — gemessen, nicht geschaetzt: Der Natur-Ton der ersten Fassung (#10191D) hatte
       denselben Blauanteil wie das Land, aber mehr Gruen; sein Farbton lag 25° naeher an
       Gruen als das Land (227° gegen 252°, OKLCH). Neben Navy liest das Auge das als Oliv.
       Jetzt hat Natur EXAKT den Farbton des Landes und ist nur heller (#10171F — die Vorgabe
       #10171D haette noch 8° Abweichung; Unterschied: zwei Stufen Blau).
     · Tiefe: Land dunkler, alles darauf heller ⇒ mehr Abstand. Drei Strassenraenge statt
       zwei, bebaute Flaeche leicht angehoben, Gebaeude schon ab Stufe 13, Ufer als Linie.
     · Gold: nur die groessten Ortsnamen (Staedte) tragen einen Hauch Champagner. KEIN
       warmer Ton auf Strassen — Blaugrau Richtung Gold verschoben wird Oliv, und genau das
       soll weg. Die uebrige Gold-Ebene (Bedienelemente, Kartenrand) liegt in styles.css.
   Reihenfolge der Sichtbarkeit:
     Strecke › grosse Ortsnamen › Hauptstrassen › Verbindungsstrassen › Nebenstrassen ›
     Gebaeude › Natur.
   Keine Sonderziele (Laeden, Haltestellen …), keine Hausnummern.

   Die Karte ist fuer JEDE Sportart und in JEDER Ansicht (Aktivitaetsseite, Story,
   Vollbild) dieselbe; die Farbe der Sportart traegt nur die Strecke.

   Dieses Modul beschreibt nur, WIE gezeichnet wird (Ebenen, Farben, Breiten) im
   ueblichen Stilformat fuer Vektorkarten (Datenschema OpenMapTiles). Es kennt keinen
   Anbieter: Adressen der Kartendaten und Schriften kommen fertig aus map-config.js.
   Rein und testbar — kein DOM, kein Netz.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};

  /* EINE Stelle fuer die Kartenfarben (Vorgabe vom 6.10.; Abweichungen sind begruendet). */
  var PALETTE = {
    bg: '#080D14',          /* Flaeche hinter der Karte, bevor Daten da sind */
    land: '#0B1118',
    urban: '#0E151D',       /* bebaute Flaeche: Stadt hebt sich leicht vom Umland ab */
    nature: '#10171F',      /* Wald, Wiese, Park: Farbton des Landes, nur heller — siehe oben */
    water: '#081724',
    shore: '#152634',       /* Uferlinie: Wasserton, etwas heller — Kuesten und Seen bleiben lesbar */
    boundary: '#202B36',
    building: '#141C25',
    path: '#19232D',        /* Fuss- und Feldwege: zwischen Land und Nebenstrasse */
    rail: '#19232D',
    roadMinor: '#24303C',
    roadSecondary: '#2B3947',
    roadMajor: '#344352',
    labelMinor: '#687583',
    labelMajor: '#AEB7C1',
    labelCity: '#B9B6AD',   /* Hauch Champagner: Helligkeit wie labelMajor, Farbton des ORVIA-Golds, kaum Saettigung */
    halo: '#0B1118'
  };
  var SRC = 'orvia';
  var MAJOR = ['motorway', 'trunk', 'primary'];
  var SECONDARY = ['secondary', 'tertiary'];
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
      /* bebaute Flaeche — gibt der Stadt schon in der Uebersicht Form (Gebaeude kommen erst nah) */
      fill('urban', 'landuse', inClass(['residential', 'commercial', 'industrial', 'retail']), P.urban, { minzoom: 6 }),
      /* Natur: Wald, Wiese, Feuchtgebiet, Parks, Friedhoefe, Sportflaechen — EIN Ton, Farbton des Landes */
      fill('nature-cover', 'landcover', inClass(['wood', 'grass', 'wetland']), P.nature),
      fill('nature-use', 'landuse', inClass(['cemetery', 'pitch', 'playground', 'stadium', 'track', 'park']), P.nature, { minzoom: 9 }),
      fill('nature-park', 'park', null, P.nature, { minzoom: 8 }),
      fill('water', 'water', ['!=', ['get', 'brunnel'], 'tunnel'], P.water, { 'fill-outline-color': P.shore }),
      line('waterway', 'waterway', ['!=', ['get', 'brunnel'], 'tunnel'], P.water, width([[10, 0.6], [14, 1.6], [18, 6]]), { minzoom: 10 }),
      /* Staats- und Landesgrenzen, sehr leise (keine Gemeindegrenzen — die waeren in der Stadt nur Unruhe) */
      line('boundary', 'boundary', ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], P.boundary, width([[3, 0.6], [10, 1.2]]), { minzoom: 3, 'line-dasharray': [3, 2] }),
      fill('building', 'building', null, P.building, { minzoom: 13, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.55, 14, 1] }),
      /* Wege und Strassen — ohne Rand, eine Farbe je Rang, drei Raenge */
      line('road-path', 'transportation', inClass(PATHS), P.path, width([[14, 0.7], [16, 1.4], [18, 3]]), { minzoom: 14 }),
      line('road-minor', 'transportation', inClass(MINOR), P.roadMinor, width([[12, 0.5], [14, 1.6], [16, 5], [18, 14]]), { minzoom: 12 }),
      /* Bahn: nur durchgehende Gleise — Abstell- und Rangiergleise (service) machten Bahnhoefe zu einem Linienknaeuel */
      line('rail', 'transportation', ['all', inClass(['rail', 'transit']), ['!', ['has', 'service']]], P.rail, width([[11, 0.5], [14, 1], [18, 2.4]]), { minzoom: 11 }),
      line('road-secondary', 'transportation', inClass(SECONDARY), P.roadSecondary, width([[9, 0.5], [12, 1.4], [14, 2.6], [16, 6.5], [18, 17]]), { minzoom: 9 }),
      line('road-major', 'transportation', inClass(MAJOR), P.roadMajor, width([[5, 0.6], [10, 1.3], [12, 2.1], [14, 3.6], [16, 8.5], [18, 22]]), { minzoom: 5 }),
      /* Beschriftung: sparsam. Strassennamen erst nah, kleine Orte dezent, Staedte deutlich. Keine Gewaessernamen. */
      label('label-road', 'transportation_name', inClass(MAJOR.concat(SECONDARY, MINOR)), P.labelMinor, ['interpolate', ['linear'], ['zoom'], 14, 9.5, 18, 12], f,
        { minzoom: 14.5, 'symbol-placement': 'line', 'symbol-spacing': 380, 'text-max-angle': 30, 'text-padding': 12 }),
      label('label-place-minor', 'place', inClass(['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet']), P.labelMinor, ['interpolate', ['linear'], ['zoom'], 11, 10, 15, 12], f,
        { minzoom: 11, 'text-letter-spacing': 0.05, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 20] }),
      /* Staedte mit einem Hauch Champagner, Kleinstaedte im neutralen hellen Ton */
      label('label-place-major', 'place', inClass(['city', 'town']), ['match', ['get', 'class'], 'city', P.labelCity, P.labelMajor], ['interpolate', ['linear'], ['zoom'], 6, 11, 11, 13, 15, 15.5], f,
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

  var api = { VERSION: 'map-style@2', PALETTE: PALETTE, SOURCE: SRC, layers: layers, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA.mapStyle = api;
})(typeof window !== 'undefined' ? window : globalThis);
