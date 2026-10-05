/* ============================================================
   ORVIA · map-config — Quelle der Kartenkacheln (v8-432/433)
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
     · Kostenloser Tarif: nur nicht-kommerziell / Entwicklung, Logo Pflicht,
       100.000 Anfragen im Monat. Eine Story-Karte braucht beim ersten Oeffnen
       im Mittel 3–4, auf dem Handy hoechstens 6 Kacheln (+ Logo); innerhalb der
       Sitzung werden geladene Kacheln wiederverwendet (gemessen ueber 20.000
       simulierte Strecken; mit 256er-Kacheln waeren es im Mittel 7–9, bis zu 20).

   Wo die Karte erscheint:
     · story:  true  — Abschluss-Seite der Story
     · detail: false — Aktivitaetsseite bleibt vorerst bei der bisherigen Zeichnung
                       (erst einschalten, wenn die Optik in der Story abgestimmt ist)

   Eigene Kachelquelle statt MapTiler:
     url: 'https://…/{z}/{x}/{y}{r}.png', attribution: '© …', logo: null
   ============================================================ */
window.ORVIA_MAP_CONFIG = {
  provider: 'maptiler',
  key: '',
  style: 'dataviz-dark',
  tileSize: 512,
  story: true,
  detail: false
};
