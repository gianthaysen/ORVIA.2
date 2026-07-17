/* ORVIA · Phase 4.4 — DOM-nahe Funktionen real getestet: detectPBs + rateActivity.
   Lädt calc.js, story.js, activity.js mit minimalen Stubs (keine echte DOM). */
import fs from 'fs';
let pass=0,fail=0;const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const G=globalThis;
(0,eval)(fs.readFileSync(new URL('../../js/calc.js',import.meta.url),'utf8'));
const C=G.Calc;
// Stubs, die story.js/activity.js zur Laufzeit erwarten
G.Calc=C;
G.isDay=(k)=>/^\d{4}-\d{2}-\d{2}$/.test(k);
G.fmtPace=C.fmtPace;
G.goalOf=()=>null;            // → rateActivity nimmt den „erfasst"-Pfad für valide Läufe
G.DB={};
// story.js + activity.js laden (nur Funktionsdeklarationen, kein Top-Level-DOM)
(0,eval)(fs.readFileSync(new URL('../../js/story.js',import.meta.url),'utf8'));
(0,eval)(fs.readFileSync(new URL('../../js/activity.js',import.meta.url),'utf8'));

// ---- detectPBs: ungültiger aktueller Lauf → keine PBs ----
G.DB={
  '2026-06-10':{sessions:{Laufen:{dist:5,dur:25,best:{k1:240,k5:1300}}}},   // valide Historie
  '2026-06-20':{sessions:{Laufen:{dist:30,dur:60,best:{k1:120,k5:600}}}}     // unplausibel (Pace 2.0)
};
ok('detectPBs: unplausibler aktueller Lauf → keine PBs',G.detectPBs('2026-06-20').length===0);
// valider aktueller Lauf mit besserer Bestzeit → PB erkannt
G.DB={
  '2026-06-10':{sessions:{Laufen:{dist:5,dur:25,best:{k1:240}}}},
  '2026-06-20':{sessions:{Laufen:{dist:5,dur:24,best:{k1:230}}}}            // valide, schneller
};
ok('detectPBs: valider schnellerer Lauf → PB erkannt',G.detectPBs('2026-06-20').length>=1);
// unplausibler Vergleichslauf wird ignoriert (kein falscher „prev")
G.DB={
  '2026-06-10':{sessions:{Laufen:{dist:30,dur:60,best:{k1:120}}}},          // unplausibel → ignoriert
  '2026-06-20':{sessions:{Laufen:{dist:5,dur:25,best:{k1:240}}}}
};
var pbs=G.detectPBs('2026-06-20');
ok('detectPBs: unplausibler Vergleichslauf wird nicht als prev genutzt',pbs.length>=1&&pbs[0].prev===null);

// ---- rateActivity: unplausibler Lauf → „Daten prüfen", kein Lob ----
var r1=G.rateActivity('Laufen',{dist:30,dur:60});
ok('rateActivity: 30km/60min → „Daten prüfen"',r1&&r1.badge==='Daten prüfen'&&r1.cls==='r');
var r2=G.rateActivity('Laufen',{dist:8,dur:44});
ok('rateActivity: valider Lauf → kein „Daten prüfen"',r2&&r2.badge!=='Daten prüfen');
ok('rateActivity: Nicht-Lauf → null',G.rateActivity('Rad',{dist:20,dur:50})===null);

console.log('\nErgebnis: '+pass+' bestanden, '+fail+' fehlgeschlagen.');process.exit(fail?1:0);
