/* ============================================================
   ORVIA · map-config — Quelle der Kartenkacheln (v8-432)
   ------------------------------------------------------------
   key leer ⇒ Karte AUS: es geht keine einzige Anfrage an einen Kartenanbieter, die
   Strecke wird wie bisher ohne Karte gezeichnet.

   MapTiler (Voreinstellung):
     · Schluessel in der MapTiler-Verwaltung anlegen und dort auf die Herkunft
       https://gianthaysen.github.io beschraenken. Der Schluessel ist ein oeffentlicher
       Browser-Schluessel (er steht in jeder Kachel-Adresse) — die Beschraenkung auf die
       Herkunft ist sein Schutz, nicht Geheimhaltung.
     · style: Karten-Id aus MapTiler, z. B. 'dataviz-dark' (sehr reduziert) oder die Id
       eines eigenen Stils aus dem MapTiler-Editor.
     · Kostenloser Tarif: nur nicht-kommerziell / Entwicklung, Logo Pflicht.

   Eigene Kachelquelle statt MapTiler:
     url: 'https://…/{z}/{x}/{y}{r}.png', attribution: '© …', logo: null
   ============================================================ */
window.ORVIA_MAP_CONFIG = {
  provider: 'maptiler',
  key: '',
  style: 'dataviz-dark'
};
