/* ============================================================
   ORVIA · plan_v14_s3c — Schnellstart (Prototyp v14 shQuick) im Schnellzugriff
   ------------------------------------------------------------
     A. gmQuickStartTiles: aktive Sportarten, Hauptsport zuerst, max 3, nur bekannte
     B. quickStartGridHTML: Kacheln + „Mehr", ohne Sportarten/Helfer leer (kein toter Knopf)
     C. Start-Sheet und Schnellzugriff teilen EINE Sportliste (GM_START_SPORTS)
   node supabase/tests/plan_v14_s3c_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const ui = rd('js/ui.js');
const fn = name => { const m = ui.match(new RegExp('\\n(function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\})\\n')); if (!m) throw new Error('fn ' + name); return m[1]; };
const g = globalThis; g.window = g; g.ORVIA = {};
(0, eval)(ui.match(/var GM_START_SPORTS=\[[^\n]*\];/)[0] + '\n' + ui.match(/var GM_SPORT_ID_TO_START=\{[^\n]*\};/)[0] + '\n' + fn('gmQuickStartTiles') + '\n' + fn('gmQuickStart') + '\nglobalThis.gmQuickStartTiles=gmQuickStartTiles;globalThis.gmQuickStart=gmQuickStart;');

sec('A · Kacheln aus dem Profil');
{
  const P = { sports: [{ sportId: 'gym', role: 'supplemental' }, { sportId: 'running', role: 'primary' }, { sportId: 'cycling', role: 'secondary' }, { sportId: 'swimming', role: 'planned', activeInApp: false }, { sportId: 'padel' }] };
  const t = g.gmQuickStartTiles(P, 3);
  ok('A1 Hauptsport zuerst, dann Reihenfolge des Profils', t.map(x => x.sport).join() === 'Laufen,Krafttraining,Radfahren', JSON.stringify(t.map(x => x.sport)));
  ok('A2 inaktive Sportart (activeInApp:false) fehlt', !t.some(x => x.sport === 'Schwimmen'));
  ok('A3 unbekannte Sportart (padel) wird nicht erfunden', !t.some(x => x.sportId === 'padel'));
  ok('A4 max greift', g.gmQuickStartTiles(P, 2).length === 2);
  ok('A5 Icon und Farbe aus GM_START_SPORTS', t[0].icon === 'run' && /--ready/.test(t[0].color) && t[1].icon === 'dumbbell');
  ok('A6 leer/kaputt ⇒ [] ohne Throw', g.gmQuickStartTiles(null).length === 0 && g.gmQuickStartTiles({ sports: 'x' }).length === 0 && g.gmQuickStartTiles({ sports: [null, 3] }).length === 0);
  ok('A7 String-Eintraege (Legacy) werden gelesen, Dubletten einmal', g.gmQuickStartTiles({ sports: ['running', 'running', 'gym'] }).map(x => x.sport).join() === 'Laufen,Krafttraining');
}

sec('B · Grid im Schnellzugriff');
{
  g.document = { getElementById: () => null, querySelectorAll: () => [] };
  g.icon = (n) => '<svg data-i="' + n + '"></svg>';
  (0, eval)(rd('js/quick-actions.js'));
  const QA = g.ORVIA.quickActions;
  g.PROFILE = { sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'gym' }] };
  const h = QA.quickStartGridHTML();
  ok('B1 Block „Einheit starten" mit 2 Sport-Kacheln + „Mehr"', /Einheit starten/.test(h) && (h.match(/class="qk"/g) || []).length === 3 && /data-qk="Laufen"/.test(h) && /data-qk="Krafttraining"/.test(h) && /data-qk=""/.test(h));
  ok('B2 Kurzlabel „Kraft" auf der Kachel, Sportname im data-qk', />Kraft</.test(h) && !/>Krafttraining</.test(h));
  ok('B3 Icons aus icon()', /data-i="run"/.test(h) && /data-i="dumbbell"/.test(h) && /data-i="plus"/.test(h));
  g.PROFILE = { sports: [] };
  ok('B4 ohne aktive Sportart ⇒ kein Block (kein toter Knopf)', QA.quickStartGridHTML() === '');
  const savedTiles = g.gmQuickStartTiles; delete g.gmQuickStartTiles;
  ok('B5 ohne Helfer ⇒ kein Block', QA.quickStartGridHTML() === '');
  g.gmQuickStartTiles = savedTiles;
  ok('B6 Grid steht ZUERST im Sheet-Body (Quelltext)', /'<div class="qa-root">' \+\n\s*quickStartGridHTML\(\) \+/.test(rd('js/quick-actions.js')));
}

sec('C · eine Sportliste');
{
  ok('C1 Start-Sheet nutzt GM_START_SPORTS', /var SPORTS=GM_START_SPORTS;/.test(ui) && !/var SPORTS=\[\['Laufen'/.test(ui));
  let opened = [], started = [];
  g.gmOpenStartSheet = m => opened.push(m || null); g.gmStartSport = s => started.push(s);
  g.gmQuickStart('Laufen'); g.gmQuickStart(null);
  ok('C2 gmQuickStart: Sheet oeffnen + Sportart vorwaehlen; „Mehr" ⇒ nur Sheet', opened.length === 2 && started.join() === 'Laufen');
}

console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
