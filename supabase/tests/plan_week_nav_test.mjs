/* ORVIA · Wochennavigation im Plan (2026-08-07)

   NUTZERWUNSCH: „Dass man in den Trainingsplanwochen vor und zurueckspringen
   kann — und wenn man eine Aktivitaet gemacht hat, dass man dort angezeigt
   bekommt, wie sie absolviert wurde."

   BEFUND VORHER: `shiftPlanWeek` existierte, bediente aber nur die VERBORGENE
   Legacy-Box (`renderWeekPlan` → `#weekPlanBox`). Die sichtbare GM-Planseite
   berechnete ihre sieben Tage fest aus `new Date()` — an ihr gab es keine
   Blaetterung, auch wenn der Code den Anschein erweckte.

   Geprueft wird hier vor allem die gefaehrliche Seite: Blaettern darf den
   GESPEICHERTEN Plan nicht veraendern. Der Wochenplan ist eine wiederkehrende
   Struktur; wer beim Zurueckblaettern versehentlich schreibt, faelscht Historie.

   node supabase/tests/plan_week_nav_test.mjs [appRoot-absolut] */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
/* renderGMPlan sauber ausschneiden: bis zur naechsten Deklaration auf
   oberster Ebene (Zeilenanfang `function `), nicht bis zu einem geratenen Namen. */
const _start = ui.indexOf('function renderGMPlan()');
const _next = ui.indexOf('\nfunction ', _start + 30);
const blk = ui.slice(_start, _next > 0 ? _next : undefined);
if (blk.length < 2000) { console.error('renderGMPlan-Block nicht gefunden (' + blk.length + ' Zeichen)'); process.exit(1); }

sec('1 · Die sichtbare Planseite blättert wirklich');
ok('renderGMPlan liest den Wochenversatz', /gmPlanWeekOff\(\)/.test(blk));
ok('die sieben Tage werden MIT Versatz berechnet', /_wOff\s*\*\s*7/.test(blk),
   (blk.match(/mon\.setDate\([^)]*\)/) || [''])[0]);
ok('es gibt Vor- und Zurück-Bedienelemente', /gmShiftPlanWeek\(-1\)/.test(blk) && /gmShiftPlanWeek\(1\)/.test(blk));
ok('der angezeigte Zeitraum steht ausgeschrieben da (keine Rätsel beim Blättern)',
   /_wRange/.test(blk));
ok('ein Rücksprung auf die aktuelle Woche ist möglich', /gmPlanWeekToday\(\)/.test(blk));
ok('… und wird nur angeboten, wenn man nicht ohnehin dort ist',
   /_wOff!==0\?'<button[^']*gmPlanWeekToday/.test(blk));

sec('2 · Blättern verändert nichts');
{
  const navFn = ui.slice(ui.indexOf('function gmShiftPlanWeek'), ui.indexOf('function gmPlanVariantSel'));
  ok('die Navigation schreibt NICHT in PROFILE',
     !/PROFILE\s*\.\s*weekPlan\s*=|saveProfile\(/.test(navFn), navFn.slice(0, 120));
  ok('sie ruft nur den Renderer', /renderGMPlan\(\)/.test(navFn));
  ok('der Versatz ist begrenzt (kein endloses Weglaufen)', /Math\.max\(-52[\s\S]{0,40}Math\.min\(52/.test(navFn));
  ok('der Versatz lebt nur im Speicher, nicht im localStorage',
     !/localStorage/.test(navFn),
     'sonst landet man Wochen später unbemerkt in einer alten Woche');
}

sec('3 · Absolvierte Einheiten zeigen ihre Ist-Werte');
ok('die Karte liest das Resolver-Ergebnis, nicht nur den Status',
   /_res\s*=\s*\(occ&&byOcc\[occ\]\)/.test(blk));
ok('Ist-Werte kommen aus `actual` — der einzigen belastbaren Quelle', /_res\.actual/.test(blk));
ok('Distanz, Dauer und die daraus berechnete Pace werden gezeigt',
   /distanceKm!=null/.test(blk) && /durationMin!=null/.test(blk) && /\/km/.test(blk));
ok('fehlende Werte werden weggelassen, nicht geschätzt',
   /_bits\.length/.test(blk) && !/\|\|\s*0\s*\)\s*\+\s*' km'/.test(blk));
ok('eine unsichere Zuordnung wird als solche gekennzeichnet',
   /confidence&&_res\.confidence!=='high'/.test(blk));

sec('4 · Der Nutzer weiß, welche Woche er sieht');
ok('vergangene und kommende Wochen werden unterschiedlich erklärt',
   /Vergangene Woche/.test(blk) && /Kommende Woche/.test(blk));
/* v8-315: Die Probe prüfte per ZEICHENABSTAND („mini-note innerhalb von 200
   Zeichen nach if(_wOff!==0){"). Das ist keine Eigenschaft, sondern eine
   Momentaufnahme der Formatierung — sie wurde rot, als zwischen Bedingung und
   Ausgabe die Herkunftsauswertung trat, obwohl die ZUSAGE unverändert galt.
   Geprüft wird jetzt die Struktur: die Ausgabe liegt IM Blätter-Block. */
{
  const i = blk.indexOf('if(_wOff!==0){');
  let d = 0, started = false, end = -1;
  for (let j = i; j >= 0 && j < blk.length; j++) {
    const ch = blk[j];
    if (ch === '{') { d++; started = true; }
    else if (ch === '}') { d--; if (started && d === 0) { end = j + 1; break; } }
  }
  const branch = i >= 0 && end > i ? blk.slice(i, end) : '';
  ok('der Hinweis erscheint nur beim Blättern, nicht in der aktuellen Woche',
     !!branch && branch.indexOf('mini-note') >= 0);
  /* Gegenprobe zur Zusage: außerhalb des Blätter-Zweigs darf im Renderer keine
     zweite Wochen-Hinweiszeile stehen, die immer erscheint. */
  ok('… und es gibt keinen zweiten, immer sichtbaren Wochenhinweis',
     (blk.split('Vergangene Woche').length - 1) === 1 && branch.indexOf('Vergangene Woche') >= 0);
}
/* v8-310a: Die Beschriftung lebt jetzt in der PUREN Funktion gmPlanWeekHeader
   (Hoisting-Fix — _wOff wurde vorher VOR seiner Deklaration benutzt, die
   Kopfzeile zeigte „undefined Wochen voraus"/NaN). Geprueft wird das
   VERHALTEN der Funktion statt Strings im Renderer-Block. */
{
  const hs = ui.indexOf('function gmPlanWeekHeader(');
  let d = 0, started = false, he = -1;
  for (let j = hs; j < ui.length; j++) { const ch = ui[j];
    if (ch === '{') { d++; started = true; } else if (ch === '}') { d--; if (started && d === 0) { he = j + 1; break; } } }
  const hdr = new Function(ui.slice(hs, he) + '\nreturn gmPlanWeekHeader;')();
  ok('die Beschriftung unterscheidet „Letzte Woche" von „3 Wochen zurück"',
     hdr(-1).label === 'Letzte Woche' && hdr(-3).label === '3 Wochen zurück' &&
     hdr(2).label === '2 Wochen voraus' && !/undefined|NaN/.test(hdr(2).label + hdr(2).range));
  ok('der Renderer nutzt die Kopf-Funktion und deklariert _wOff VOR ihr',
     /gmPlanWeekHeader\(_wOff\)/.test(blk) &&
     blk.indexOf("var _wOff=") >= 0 && blk.indexOf("var _wOff=") < blk.indexOf('gmPlanWeekHeader(_wOff)'));
}

console.log('\nplan_week_nav: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
