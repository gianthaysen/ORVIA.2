/* ============================================================
   ORVIA · map-config — Quelle der Kartenkacheln (v8-432 … 435)
   ------------------------------------------------------------
   DIE EINE Stelle fuer alles, was die Karte betrifft. Der Schluessel steht nur hier —
   route-map.js liest ihn ueber ORVIA_MAP_CONFIG, kein anderes Modul kennt ihn.

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
     · style: Karten-Id aus MapTiler, z. B. 'dataviz-dark' (sehr reduziert) oder die Id
       eines eigenen Stils aus dem MapTiler-Editor.
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
  key: 'CwKts3eJvP6HZyk1hUpe',
  style: 'dataviz-dark',
  tileSize: 512,
  story: true,
  detail: true,
  tiles: {
    512: 'https://api.maptiler.com/maps/{style}/{z}/{x}/{y}{r}.png?key={key}',
    256: 'https://api.maptiler.com/maps/{style}/256/{z}/{x}/{y}{r}.png?key={key}'
  },
  logo: 'https://api.maptiler.com/resources/logo.svg',
  attribution: '© MapTiler © OpenStreetMap contributors'
};
