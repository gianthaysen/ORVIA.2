/* ============================================================
   ORVIA · map-config — Quelle der Karte (v8-432 … 440)
   ------------------------------------------------------------
   DIE EINE Stelle fuer alles, was die Karte betrifft. Der Schluessel steht nur hier —
   route-map.js und route-map-gl.js lesen ihn ueber ORVIA_MAP_CONFIG, kein anderes Modul
   kennt ihn.

   engine (seit v8-440) — WIE die Karte entsteht:
     · 'vector'  Die Karte wird auf dem Geraet gezeichnet (route-map-gl.js, Stil in
                 map-style.js): eigene ORVIA-Farben, scharf in jeder Pixeldichte,
                 Beschriftung in fester Groesse. Braucht die Angaben unter vector.
                 Geht das auf einem Geraet nicht (kein WebGL, Bibliothek nicht ladbar),
                 gilt dort fuer die Sitzung automatisch 'raster'.
     · 'raster'  Fertige Bildkacheln wie bis v8-439 (style / tileSize / tiles weiter unten).
                 EINE Zeile zurueckstellen genuegt, falls die neue Karte auf einem Geraet
                 Probleme macht.
   vector:
     · lib      mitgelieferte Zeichenbibliothek (MapLibre GL JS 5.24.0, BSD-Lizenz, liegt
                unter assets/vendor/ — kein fremder Server). Wird erst geladen, wenn zum
                ersten Mal eine Karte gebraucht wird.
     · tiles    Adressvorlage der Kartendaten ({z}/{x}/{y} fuellt die Bibliothek)
     · glyphs   Adressvorlage der Schriften fuer die Beschriftung
     · maxzoom  feinste Stufe der Kartendaten (darueber wird vergroessert)
     · fonts    Schriftname(n), wie der Anbieter sie fuehrt
     Am 5.10.2026 von der Live-Herkunft aus geprueft: Kartendaten bis Stufe 15, erste
     Antwort 70–100 ms (die Bildkacheln brauchten 300–900 ms, weil der Anbieter sie erst
     auf Abruf rechnete), Zwischenspeichern 4 Stunden. Ein Bildschirm braucht 4 Datenkacheln
     und einmal je Sitzung die Schrift. Die Datenkacheln sind groesser als die Bilder
     (100–300 kB statt 60 kB) — die Karte kostet also mehr Datenvolumen, dafuer sofort scharf.
     Im kostenlosen Tarif zaehlen sie wie Bildkacheln gegen die 100.000 Anfragen im Monat.

   key leer ⇒ Karte AUS: es geht keine einzige Anfrage an einen Kartenanbieter, die
   Strecke wird ohne Karte gezeichnet.

   MapTiler (Voreinstellung):
     · Schluessel in der MapTiler-Verwaltung anlegen und dort auf erlaubte Herkuenfte
       beschraenken:  https://gianthaysen.github.io   (Live-Seite)
                      http://localhost  und  http://127.0.0.1   (nur falls lokal mit
                      echten Kacheln entwickelt wird — die Tests brauchen das nicht,
                      sie fangen den Anbieter ab)
       Der Schluessel ist ein oeffentlicher Browser-Schluessel (er steht in jeder
       Kachel-Adresse) — die Beschraenkung auf die Herkunft ist sein Schutz.
     · style: Karten-Id aus MapTiler oder die Id eines eigenen Stils aus dem MapTiler-Editor.
       Seit v8-437 'basic-v2-dark' (Gian: „noch zu dunkel und viel zu schwarz", Vergleich
       Runna). Am 5.10. an echten Kacheln verglichen (Bochum, Stufen 13–17):
         dataviz-dark   Flaeche 41 · Strassen 50 · Gebaeude 34 als dunkle Bloecke
                        → Strassen kaum zu sehen; mit Kontrastfilter wurden die Gebaeude schwarz
         basic-v2-dark  Flaeche 44 · Strassen 68 · KEINE Gebaeudegrundrisse, Strassennamen
                        → grau statt schwarz, Strassen deutlich, ohne jeden Filter
       Ohne Gebaeude faellt auch nicht mehr auf, wenn die GPS-Aufzeichnung ein paar Meter
       neben der Strasse liegt (vorher „lief" die Strecke sichtbar durch Haeuser).
     · Bildformat .webp: dieselbe Kachel 60 statt 108 kB (gemessen) — laedt mobil schneller.
     · tileSize: 512 (Standard; vier Mal weniger Anfragen als 256) oder 256.
       Sollten die 512er-Kacheln einmal nicht mehr kommen: hier auf 256 stellen —
       das ist die ganze Umstellung (es gilt dann die Vorlage tiles[256]).
     · Kostenloser Tarif: nur nicht-kommerziell / Entwicklung, Logo Pflicht,
       100.000 Anfragen im Monat. Eine Story-Karte braucht beim ersten Oeffnen
       im Mittel 3–4, auf dem Handy hoechstens 6 Kacheln (+ Logo); innerhalb der
       Sitzung werden geladene Kacheln wiederverwendet (gemessen ueber 20.000
       simulierte Strecken; mit 256er-Kacheln waeren es im Mittel 7–9, bis zu 20).
       Kartenansicht zum Umsehen (v8-435): je Bildschirm im Mittel 4, hoechstens 6
       Kacheln; jedes Weiterschieben oder jede neue Zoomstufe laedt nur, was fehlt.
       Ein ausgiebiges Umsehen kostet typisch 20–40 Kacheln. Der Anbieter erlaubt dem
       Browser 8 Stunden Zwischenspeichern (cache-control max-age=28800, geprueft 5.10.).

   Wo die Karte erscheint:
     · story:  true  — Abschluss-Seite der Story
     · detail: true  — Kartenfeld der Aktivitaetsseite; Tippen darauf oeffnet die
                       Kartenansicht zum Umsehen (route-map-view.js) — seit v8-435

   Adressen des Anbieters (tiles / logo / attribution) stehen ebenfalls NUR hier —
   route-map.js setzt lediglich {style} {key} {z} {x} {y} {r} ein ({r} = „@2x").
     · MapTiler kennt KEIN „/512/" im Pfad: ohne Groessenangabe kommen 512er-Kacheln,
       nur 256er tragen „/256/". Am 5.10.2026 von der Live-Herkunft aus geprueft:
         …/maps/dataviz-dark/512/{z}/{x}/{y}@2x.png   → Fehler
         …/maps/dataviz-dark/{z}/{x}/{y}@2x.png       → 1024 × 1024 px (512er, doppelt)
         …/maps/dataviz-dark/256/{z}/{x}/{y}@2x.png   →  512 ×  512 px (256er, doppelt)
     · Anderer Anbieter: tiles (oder eine einzige Vorlage als url), attribution und
       logo austauschen — sonst ist nichts anzufassen.
   ============================================================ */
window.ORVIA_MAP_CONFIG = {
  provider: 'maptiler',
  engine: 'vector',
  vector: {
    lib: 'assets/vendor/maplibre-gl.js',
    tiles: 'https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key={key}',
    glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key={key}',
    maxzoom: 15,
    fonts: ['Noto Sans Regular']
  },
  key: 'CwKts3eJvP6HZyk1hUpe',
  style: 'basic-v2-dark',
  tileSize: 512,
  story: true,
  detail: true,
  tiles: {
    512: 'https://api.maptiler.com/maps/{style}/{z}/{x}/{y}{r}.webp?key={key}',
    256: 'https://api.maptiler.com/maps/{style}/256/{z}/{x}/{y}{r}.webp?key={key}'
  },
  logo: 'https://api.maptiler.com/resources/logo.svg',
  attribution: '© MapTiler © OpenStreetMap contributors'
};
