/* ============================================================
   ORVIA · long_run_progression — S3 · P2 (SHADOW)
   ------------------------------------------------------------
     A. candidate(): Regeln 1–5 (Schritt, Deckel, Taper, Default, Floor)
     B. Gians Beispiel: Einsteiger, laengster Lauf 3 km, Woche 3 → NICHT 7 km
     C. legacyTable() = ui.lrKm-Tabelle (Paritaet), Rennwoche null
     D. Shadow-Verdrahtung in ui.js: Tabelle bleibt sichtbar, Protokoll je Datum+Woche, Report
   node supabase/tests/long_run_progression_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
global.window = global; global.ORVIA = {};
(0, eval)(rd('js/engine/long-run-progression.js'));
const L = global.ORVIA.longRunProgression;
const HM = 21.0975;

sec('A · Regeln');
{
  ok('A1 Regel 1: +10 % ueber dem laengsten Lauf (Mittel)', L.candidate({ level: 'intermediate', longest28Km: 10, raceKm: HM, weeksToRace: 10 }).km === 11);
  ok('A2 Regel 1: Einsteiger +8 %', L.candidate({ level: 'beginner', longest28Km: 10, raceKm: HM, weeksToRace: 10 }).km === 10.8);
  const p = L.candidate({ level: 'intermediate', longest28Km: 25, raceKm: HM, weeksToRace: 10 });
  ok('A3 Regel 2: Deckel HM/Mittel 20 km', p.km === 20 && p.cap === 'peak' && p.peakKm === 20);
  ok('A4 Deckel je Stand: HM Einsteiger 18, Wettkampf 22; Marathon 28/32/35', L.candidate({ level: 'beginner', longest28Km: 30, raceKm: HM, weeksToRace: 10 }).km === 18 && L.candidate({ level: 'competitive', longest28Km: 30, raceKm: HM, weeksToRace: 10 }).km === 22 && L.candidate({ level: 'beginner', longest28Km: 40, raceKm: 42.195, weeksToRace: 10 }).km === 28 && L.candidate({ level: 'competitive', longest28Km: 40, raceKm: 42.195, weeksToRace: 10 }).km === 35);
  const t3 = L.candidate({ level: 'intermediate', longest28Km: 20, raceKm: HM, weeksToRace: 3 }), t2 = L.candidate({ level: 'intermediate', longest28Km: 20, raceKm: HM, weeksToRace: 2 }), t1 = L.candidate({ level: 'intermediate', longest28Km: 20, raceKm: HM, weeksToRace: 1 });
  ok('A5 Regel 3: Taper 70/55/40 % des Deckels (14 / 11 / 8)', t3.km === 14 && t3.cap === 'taper' && t2.km === 11 && t1.km === 8);
  ok('A6 Taper deckelt nur nach unten (kleiner Kandidat bleibt)', L.candidate({ level: 'intermediate', longest28Km: 6, raceKm: HM, weeksToRace: 2 }).km === 6.6);
  const d = L.candidate({ level: 'beginner', longest28Km: null, raceKm: HM, weeksToRace: 10 });
  ok('A7 Regel 4: ohne Messung Startwert je Stand, basis default', d.km === 5 && d.basis === 'default' && d.reasons.indexOf('no_run_28d_default_start') >= 0 && L.candidate({ level: 'competitive', raceKm: HM, weeksToRace: 10 }).km === 12);
  ok('A8 Regel 5: Untergrenze 5 km', L.candidate({ level: 'beginner', longest28Km: 2, raceKm: HM, weeksToRace: 10 }).km === 5 && L.candidate({ level: 'beginner', longest28Km: 2, raceKm: HM, weeksToRace: 10 }).cap === 'floor');
  ok('A9 Rennwoche / Datum vorbei / unbekannte Distanz ⇒ km null mit Grund', L.candidate({ level: 'intermediate', longest28Km: 10, raceKm: HM, weeksToRace: 0.5 }).km === null && L.candidate({ level: 'intermediate', longest28Km: 10, raceKm: HM, weeksToRace: -1 }).reasons[0] === 'race_in_past' && L.candidate({ level: 'intermediate', longest28Km: 10, raceKm: 3, weeksToRace: 5 }).reasons[0] === 'race_distance_unknown');
  ok('A10 unbekannter Stand ⇒ Mittel mit Vermerk; Legacy-Woerter werden gelesen', L.candidate({ level: 'x', longest28Km: 10, raceKm: HM, weeksToRace: 10 }).reasons[0] === 'level_unknown_default_intermediate' && L.candidate({ level: 'anfaenger', longest28Km: 10, raceKm: HM, weeksToRace: 10 }).level === 'beginner');
  ok('A11 Distanzklasse tolerant (21 km ⇒ HM), 7 km ⇒ keine Klasse', L.candidate({ level: 'intermediate', longest28Km: 10, raceKm: 21, weeksToRace: 10 }).peakKm === 20 && L.candidate({ level: 'intermediate', longest28Km: 10, raceKm: 7, weeksToRace: 10 }).km === null);
}

sec('B · Gians Beispiel');
{
  const c = L.candidate({ level: 'beginner', longest28Km: 3, raceKm: HM, weeksToRace: 20 });
  ok('B1 Einsteiger, laengster Lauf 3 km: Kandidat 5 km (Floor), Tabelle haette 7 km (Woche 3)', c.km === 5 && L.legacyTable(3) === 7);
  const g = L.candidate({ level: 'intermediate', longest28Km: 14, raceKm: HM, weeksToRace: 8 });
  ok('B2 Mittel, laengster 14 km, 8 Wochen: 15,4 km (Tabelle Woche 17: 15)', g.km === 15.4 && L.legacyTable(17) === 15);
}

sec('C · Tabelle');
{
  ok('C1 legacyTable = feste Tabelle: W1 7, W10 8, W22 12, W24 8, W25 null', L.legacyTable(1) === 7 && L.legacyTable(10) === 8 && L.legacyTable(22) === 12 && L.legacyTable(24) === 8 && L.legacyTable(25) === null);
}

sec('D · Shadow in ui.js');
{
  const ui = rd('js/ui.js');
  const fn = ui.slice(ui.indexOf('function lrKm(wk){'), ui.indexOf('/* E1: sichtbarer Rebuild-Pfad'));
  ok('D1 lrKm gibt weiterhin die Tabelle zurueck (return _legacy)', /return _legacy;/.test(fn) && /Math\.max\(7,Math\.min\(20,wk-2\)\)/.test(fn));
  ok('D2 Kandidat wird nur protokolliert, nie zurueckgegeben', /lrShadowRecord\(wk,_legacy\)/.test(fn) && !/return .*candidate/.test(fn));
  ok('D3 Protokoll: ein Eintrag je Datum+Woche, Deckel 60, Report mit Delta', /orvia_shadow_lr_v1/.test(ui) && /slice\(-60\)/.test(ui) && /function lrShadowReport/.test(ui));
  ok('D4 Modul in index.html und sw.js eingetragen', /long-run-progression\.js/.test(rd('index.html')) && /long-run-progression\.js/.test(rd('sw.js')));
}

console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
