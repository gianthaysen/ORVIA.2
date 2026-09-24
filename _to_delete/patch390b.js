const fs=require('fs');const F='supabase/tests/engine_canonical_activity_test.mjs';let s=fs.readFileSync(F,'utf8');
const a = `  const sports = a => { const r = CA.buildPerSport([a], { today: TODAY }); return (r && r.ok && r.perSport) ? Object.keys(r.perSport) : []; };
  ok('B1 Legacy-Form ordnet Laufen zu', sports(LEGACY).indexOf('running') >= 0);
  ok('B2 KANONISCHE Form ordnet Laufen zu (Parität)', sports(KANON).indexOf('running') >= 0, JSON.stringify(sports(KANON)));`;
const b = `  const sports = a => { const r = CA.buildPerSport([a], { today: TODAY }); return (r && r.ok && r.perSport) ? Object.keys(r.perSport) : []; };
  ok('B1 KANONISCHE Form ordnet Laufen zu', sports(KANON).indexOf('running') >= 0, JSON.stringify(sports(KANON)));
  /* Der capacity-adapter ist seit dem P0-Fix bewusst kanonisch: eine Einheit ohne
     Zeitstempel und ohne durationSeconds lässt sich keinem Tag zuordnen und wird
     deshalb NICHT gezählt. Das ist die gewollte Antwort — festgehalten, damit sie
     niemand versehentlich durch einen Legacy-Pfad ersetzt, der die alte
     Sport-Mehrdeutigkeit zurückholt. */
  ok('B2 Einheit ohne Zeitstempel wird nicht stillschweigend mitgezählt', sports(LEGACY).length === 0, JSON.stringify(sports(LEGACY)));`;
if(s.indexOf(a)<0) throw new Error('nf'); s=s.replace(a,b);
/* Der Kontrollsatz gehoert dorthin, wo beide Formen wirklich unterstuetzt sind. */
s=s.replace("   VERTRAG: Was ein Engine-Eingang in der Legacy-/Testform sieht, MUSS er in der\n   kanonischen Form aus activityStore.listActivities() auch sehen.",
  "   VERTRAG (einseitig): Die kanonische Form aus activityStore.listActivities() MUSS\n   an jedem Eingang ankommen. Wo ein Modul die Legacy-Form noch unterstützt, dient sie\n   als Kontrolle, dass die Sonde überhaupt misst; wo ein Modul bewusst kanonisch\n   arbeitet, wird genau das festgehalten.");
fs.writeFileSync(F,s); console.log('ok');
