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
   V2.1 (Gians Auftrag 6.10. nachmittags, nach v8-441 auf dem iPhone): „weiterhin zu dunkel,
   Gebaeude und Nebenstrassen verschwinden teilweise, Gold faktisch nicht sichtbar, wirkt wie
   Dark Map + Strecke". Zielwerte von Gian; gemessen und nur dort angepasst, wo sie das Ziel
   verfehlen:
     · Alles eine Stufe heller, die Strassen staerker als der Grund (Kontrast zum Land:
       Haupt 1,87 → 2,31, Verbindung 1,61 → 1,83, Neben 1,41 → 1,53).
     · Natur: Vorgabe #111A22 laege im Farbton wieder 6° Richtung Gruen ⇒ #111A24 (exakt der
       Farbton des Landes — dieselbe Regel wie in V2).
     · Gebaeude: mit der Vorgabe #182430 haetten sie sich vom bebauten Grund kaum staerker
       abgehoben als in V2 (1,09 statt 1,07) ⇒ #1A2734 (1,14); dazu frueher voll deckend.
       Nebenstrassen: Farbe nach Vorgabe, zusaetzlich etwas breiter (duenne Linien verlieren
       am Bildschirm mehr Kontrast als ihre Farbe verspricht).
     · Gold ist jetzt im normalen Kartenbild zu sehen: Namen wichtiger Orte in Champagner-
       Gold (#C8B77E, siehe GOLD_PLACE) und eine warme Unterlage unter Hauptstrassen (roadWarm).
     · Wasser und Natur sind gleich hell (Kontrast 1,01) — eine Insel im Meer waere ohne
       Rand nicht zu sehen. Deshalb ein eigenes Ufer (Ebenen shore-soft + shore; der weiche Saum kam mit v8-443 dazu).
   V3 (Gians Auftrag 6.10. abends, „visual refinement V3" — nur Schliff): mehr raeumliche Trennung ohne
   mehr Helligkeit — Gebaeude bekommen in der Nahansicht eine feine Kante; der Ufersaum liegt jetzt
   im WASSER (Flachwasser-Saum, line-offset) statt mittig auf der Kuestenlinie, das Land bleibt
   ruhig und hebt sich klarer ab.
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
    bg: '#09111A',          /* Flaeche hinter der Karte, bevor Daten da sind */
    land: '#0E1721',
    urban: '#111C27',       /* bebaute Flaeche: Stadt hebt sich leicht vom Umland ab */
    nature: '#111A24',      /* Wald, Wiese, Park: Farbton des Landes, nur heller — siehe oben */
    water: '#0A1B29',
    shore: '#2E4E68',       /* Uferlinie: Wasserton, deutlich heller — Kuesten, Inseln und Seen bekommen eine Form */
    shoreSoft: '#22405A',   /* weicher Saum unter der Uferlinie (35 %, unscharf): hebt Land und Wasser voneinander ab */
    boundary: '#25313D',
    building: '#1A2734',
    buildingEdge: '#243344', /* feine Kante der Gebaeude in der Nahansicht (V3): Bloecke bekommen Form, ohne heller zu werden */
    path: '#1F2B37',        /* Fuss- und Feldwege: zwischen Land und Nebenstrasse */
    rail: '#1F2B37',
    roadMinor: '#2B3947',
    roadSecondary: '#344555',
    roadMajor: '#415466',
    /* Warme Unterlage unter Hauptstrassen — die leise Gold-Spur im Strassennetz. Ein fester, deckender
       Bronze-Ton statt halbtransparentem Gold, aus zwei gemessenen Gruenden (Vorschau auf echten Daten):
         · Gold mit 10–14 % ueber Navy ergibt ein NEUTRALES Grau (41,47,49) — Gelb und Blau heben sich
           auf; warm wirkt daran nichts. Ab ~16 % kippt der Farbton ins Gruenliche (Oliv).
         · Halbtransparente Linien ueberlagern sich an jeder Kreuzung doppelt: der Anteil gruenstichiger
           Bildpunkte stieg dabei auf das 7,5-Fache.
       Deshalb: Helligkeit zwischen Gebaeude und Nebenstrasse, ein Fuenftel der Saettigung des Golds,
       Farbton von 86° (Gold) auf 63° Richtung Orange gedreht — weg vom Oliv. Rot > Gruen > Blau. */
    roadWarm: '#3A322B',
    labelMinor: '#768392',
    labelMajor: '#B8C1CB',
    labelCity: '#C8B77E',   /* Champagner-Gold fuer Staedtenamen — die Signatur der Karte (= --map-gold-label in styles.css) */
    halo: '#0E1721'
  };
  var SRC = 'orvia';
  var MAJOR = ['motorway', 'trunk', 'primary'];
  var SECONDARY = ['secondary', 'tertiary'];
  var MINOR = ['minor', 'service'];
  var PATHS = ['path', 'track'];
  /* Welche Ortsnamen tragen Gold? Grossstaedte (class city) UND bedeutende Staedte, die in den Kartendaten als
     „town" gefuehrt sind (rank < 11 — z. B. Flensburg: town, rank 7). Kleinstaedte ringsum (rank ≥ 11) bleiben neutral. */
  var GOLD_PLACE = ['any', ['==', ['get', 'class'], 'city'], ['<', ['coalesce', ['get', 'rank'], 99], 11]];
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
      fill('water', 'water', ['!=', ['get', 'brunnel'], 'tunnel'], P.water),
      /* Ufer als eigene Ebenen (der Flaechenrand allein ist nur ein Haarstrich): ein weicher Saum, darauf die Linie.
         Auf echten Daten an den Watopia-Koordinaten (Zwift) geprueft: mit der Linie allein blieb die Insel im
         Kartenfeld blass; mit Saum ist die Kueste sofort lesbar. Keine erfundene Geografie — nur der echte Rand. */
      /* V3: der Saum liegt im WASSER (line-offset nach innen — die Wasserflaeche ist die Innenseite des Rings, auch um
         Inseln herum): Flachwasser-Saum. Auf echten Daten gegen „mittig" und „landseitig" verglichen. */
      line('shore-soft', 'water', ['!=', ['get', 'brunnel'], 'tunnel'], P.shoreSoft, width([[4, 3], [10, 7], [14, 10], [18, 12]]),
        { 'line-opacity': 0.4, 'line-blur': 5, 'line-offset': width([[4, 1.5], [10, 3.5], [14, 5], [18, 6]]) }),
      line('shore', 'water', ['!=', ['get', 'brunnel'], 'tunnel'], P.shore, width([[4, 0.6], [10, 1.1], [14, 1.4], [18, 1.8]])),
      line('waterway', 'waterway', ['!=', ['get', 'brunnel'], 'tunnel'], P.water, width([[10, 0.6], [14, 1.6], [18, 6]]), { minzoom: 10 }),
      /* Staats- und Landesgrenzen, sehr leise (keine Gemeindegrenzen — die waeren in der Stadt nur Unruhe) */
      line('boundary', 'boundary', ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], P.boundary, width([[3, 0.6], [10, 1.2]]), { minzoom: 3, 'line-dasharray': [3, 2] }),
      /* Kante erst ab Stufe 14,5 sichtbar (darunter = Gebaeudefarbe, also unsichtbar): in der Uebersicht waeren tausende Kanten nur Unruhe */
      fill('building', 'building', null, P.building, { minzoom: 13, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.7, 13.6, 1],
        'fill-outline-color': ['interpolate', ['linear'], ['zoom'], 14.5, P.building, 15.5, P.buildingEdge] }),
      /* warme Unterlage der Hauptstrassen (Gold-Signatur): je Seite bis 0,75 px breiter als die Strasse, liegt
         unter ALLEN Strassen — Nebenstrassen muenden sauber ein */
      line('road-major-warm', 'transportation', inClass(MAJOR), P.roadWarm, width([[9, 1.8], [10, 2.1], [12, 3.3], [14, 5.1], [16, 10], [18, 23.5]]), { minzoom: 9 }),
      /* Wege und Strassen — ohne Rand, eine Farbe je Rang, drei Raenge */
      line('road-path', 'transportation', inClass(PATHS), P.path, width([[14, 0.7], [16, 1.4], [18, 3]]), { minzoom: 14 }),
      line('road-minor', 'transportation', inClass(MINOR), P.roadMinor, width([[12, 0.6], [13, 1], [14, 1.9], [16, 5.4], [18, 14]]), { minzoom: 12 }),
      /* Bahn: nur durchgehende Gleise — Abstell- und Rangiergleise (service) machten Bahnhoefe zu einem Linienknaeuel */
      line('rail', 'transportation', ['all', inClass(['rail', 'transit']), ['!', ['has', 'service']]], P.rail, width([[11, 0.5], [14, 1], [18, 2.4]]), { minzoom: 11 }),
      line('road-secondary', 'transportation', inClass(SECONDARY), P.roadSecondary, width([[9, 0.5], [12, 1.4], [14, 2.6], [16, 6.5], [18, 17]]), { minzoom: 9 }),
      line('road-major', 'transportation', inClass(MAJOR), P.roadMajor, width([[5, 0.6], [10, 1.3], [12, 2.1], [14, 3.6], [16, 8.5], [18, 22]]), { minzoom: 5 }),
      /* Beschriftung: sparsam. Strassennamen erst nah, kleine Orte dezent, Staedte deutlich. Keine Gewaessernamen. */
      label('label-road', 'transportation_name', inClass(MAJOR.concat(SECONDARY, MINOR)), P.labelMinor, ['interpolate', ['linear'], ['zoom'], 14, 9.5, 18, 12], f,
        { minzoom: 14.5, 'symbol-placement': 'line', 'symbol-spacing': 380, 'text-max-angle': 30, 'text-padding': 12 }),
      label('label-place-minor', 'place', inClass(['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet']), P.labelMinor, ['interpolate', ['linear'], ['zoom'], 11, 10, 15, 12], f,
        { minzoom: 11, 'text-letter-spacing': 0.05, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 20] }),
      /* wichtige Orte in Champagner-Gold, kleine Staedte im neutralen hellen Ton */
      label('label-place-major', 'place', inClass(['city', 'town']), ['case', GOLD_PLACE, P.labelCity, P.labelMajor], ['interpolate', ['linear'], ['zoom'], 6, 11, 11, 13, 15, 15.5], f,
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

  var api = { VERSION: 'map-style@4', PALETTE: PALETTE, SOURCE: SRC, layers: layers, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA.mapStyle = api;
})(typeof window !== 'undefined' ? window : globalThis);
