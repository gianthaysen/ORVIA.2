/* ORVIA · i18n-extract (B-13, Band 6 e.2 Schritt 3) — datengetriebene Extraktion EINER Datei.
   Nutzersichtbare Literale (Heuristik: Whitespace+Grossbuchstabe/Umlaut, kuratierte Einzelwoerter,
   Text/Attribute in Markup-Literalen) werden NUR innerhalb von '…'-Literalen und mit Wortgrenzen
   durch ' + T('ns.slug') + ' ersetzt; der Katalog-Nachtrag landet in <out>.json (Key → Text).
   Danach: T() in der Datei definieren, Katalogblock in locales/de.js einfuegen, Tests mit Katalog laden.
     node app/tools/i18n-extract.mjs <datei.js> <namespace> <out.json>   (Datei wird IN PLACE geaendert) */
import { readFileSync, writeFileSync } from 'node:fs';
const [,, p, NS = 'ui', OUT = '_to_delete/extract.json'] = process.argv;
if (!p) { console.error('Aufruf: node app/tools/i18n-extract.mjs <datei.js> <namespace> <out.json>'); process.exit(2); }
let src = readFileSync(p, 'utf8');
const lines = src.split('\n');
const re = /'((?:[^'\\\n]|\\.)*)'/g;
const cand = new Map();
const SINGLE_OK = new Set(['Mo','Di','Mi','Do','Fr','Sa','So','Ausdauer','5-km-Lauf','10-km-Lauf','Halbmarathon','Marathon','Triathlon','Wiedereinstieg','Zielzeit','Nein','Ja','Links','Rechts','Beidseitig','Wettkampf','Training','Datum','Sportarten','Trainingsstand','Verfügbarkeit','Sicherheits-Check','Körperdaten','Zusammenfassung','Männlich','Weiblich','Divers','Anfänger','Fortgeschritten','Erfahren','Wettkampforientiert','Geburtsdatum','Weiter','Zurück','Speichern','Abbrechen','Überspringen','Fertig','Optional','Willkommen','Jahre','Alter','Name','Gewicht','Größe','Hauptsport','Gelegentlich','Regelmäßig']);
lines.forEach((line, i) => {
  if (/^\s*(\/\/|\*|\/\*)/.test(line) || /console\./.test(line)) return;
  let m; re.lastIndex = 0;
  while ((m = re.exec(line))) {
    const s = m[1]; if (!s || s.length < 2) continue;
    if (/\\'/.test(s)) continue;                       // escaped quotes: manuell
    const hasWs = /\s/.test(s);
    if (!hasWs) { if (!SINGLE_OK.has(s)) continue; }
    else {
      if (/^[a-z0-9_ -]*$/.test(s) && !/[äöüß]/.test(s)) continue;     // technische Werte
      if (/^(\[|#|\.|orvia:|https?:|data-|aria-)/.test(s)) continue;
      if (/^<[^>]*>$/.test(s)) continue;                              // reines Markup
      if (/^[\s·•–—|:()/.,+×~&]+$/.test(s)) continue;
      if (!/[A-ZÄÖÜ]/.test(s) && !/[äöüß]/.test(s)) continue;         // keine Grossbuchstaben/Umlaute → eher technisch
      if (/^\s*(px|em|%)/.test(s)) continue;
    }
    if (!cand.has(s)) cand.set(s, i + 1);
  }
});
// Markup-haltige Literale: nur den Textanteil zwischen Tags extrahieren, wenn er eindeutig ist
const texts = [];
for (const [s] of cand) {
  if (/</.test(s)) {
    const parts = [...s.matchAll(/>([^<>]*[A-Za-zÄÖÜäöüß][^<>]*)</g)].map(x => x[1]).filter(x => /[A-ZÄÖÜ]|[äöüß]/.test(x) && x.trim().length > 1);
    parts.forEach(t => texts.push(t));
    // Attribute: placeholder/aria-label/title
    [...s.matchAll(/(?:placeholder|aria-label|title)="([^"]+)"/g)].forEach(x => texts.push(x[1]));
  } else texts.push(s);
}
const uniq = [...new Set(texts.map(t => t))].filter(t => t.trim().length > 1 && !/^[\s·•–—|:()/.,+×~&]+$/.test(t) && t !== 'ORVIA' && !/^\[ORVIA/.test(t));   // Markenname nie uebersetzen
uniq.sort((a, b) => b.length - a.length);
const slug = t => t.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').split('_').slice(0,5).join('_');
const used = new Set(); const catalog = {};
let n = 0;
for (const t of uniq) {
  let k = NS + '.' + slug(t); if (!k.replace(NS + '.','')) continue; while (used.has(k)) k += '_'; used.add(k);
  const before = src.length;
  // nur innerhalb von Literalen: Vorkommen des Textes, das in einer '…'-Zeichenkette liegt — wir ersetzen alle Vorkommen mit Bindestrich-Splice
  // Sicherheit: ersetze nur, wenn das Vorkommen NICHT Teil eines laengeren bereits ersetzten Keys ist
  // nur innerhalb einfach-quotierter Literale, mit Wortgrenzen
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp("(^|[^A-Za-zÄÖÜäöüß0-9])" + esc + "(?=$|[^A-Za-zÄÖÜäöüß0-9])");
  let out = '', i = 0, hit = false;
  const lit = /'((?:[^'\\\n]|\\.)*)'/g; let mm;
  while ((mm = lit.exec(src))) {
    out += src.slice(i, mm.index);
    let body = mm[1];
    if (body.indexOf(t) >= 0 && !/T\('ob\./.test(body.slice(0, 0))) {
      let nb = '', j = 0, r;
      const g = new RegExp(rx.source, 'g');
      while ((r = g.exec(body))) { nb += body.slice(j, r.index) + r[1] + "' + T('" + k + "') + '"; j = r.index + r[0].length; hit = true; }
      body = nb + body.slice(j);
    }
    out += "'" + body + "'"; i = mm.index + mm[0].length;
  }
  out += src.slice(i);
  if (hit) { src = out; catalog[k] = t; n++; }
}
writeFileSync(p, src);
writeFileSync(OUT, JSON.stringify(catalog, null, 1));
console.log('candidates', cand.size, 'texts', uniq.length, 'replaced', n);
