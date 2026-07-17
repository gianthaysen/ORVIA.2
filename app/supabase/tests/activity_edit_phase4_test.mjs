/* ORVIA · Phase 4.4 — Aktivitätskorrektur: Plausibilität + atomares Verschieben. */
import fs from 'fs';
let pass=0,fail=0;const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
(0,eval)(fs.readFileSync(new URL('../../js/calc.js',import.meta.url),'utf8'));
const C=globalThis.Calc;
// Plausibilität
ok('Lauf 10km/22min (2:12/km) → Warnung',C.activityPlausibility('Laufen',{dist:10,dur:22}).warn===true);
ok('Lauf 10km/50min → ok',C.activityPlausibility('Laufen',{dist:10,dur:50}).warn===false);
ok('Lauf 30km/60min (30 km/h) → Warnung (eher Rad)',C.activityPlausibility('Laufen',{dist:30,dur:60}).warn===true);
ok('Schwimmen 1.5 (km statt m) → Warnung',C.activityPlausibility('Schwimmen',{dist:1.5,dur:30}).warn===true);
ok('Schwimmen 1500m/30min → ok',C.activityPlausibility('Schwimmen',{dist:1500,dur:30}).warn===false);
ok('Gym → keine Warnung',C.activityPlausibility('Gym',{dur:45}).warn===false);
// Erweiterte Plausibilität
ok('Kurzer Lauf 1km/1.8min (1:48/km) → Warnung (distanzunabhängig)',C.activityPlausibility('Laufen',{dist:1,dur:1.8}).warn===true);
ok('HF max < HF Ø → Warnung',C.activityPlausibility('Laufen',{dist:5,dur:25,hr:160,hrmax:140}).warn===true);
ok('RPE 12 außerhalb 1–10 → Warnung',C.activityPlausibility('Gym',{dur:45,rpe:12}).warn===true);
ok('Negative Distanz → Warnung',C.activityPlausibility('Rad',{dist:-5,dur:30}).warn===true);
ok('Rad 60km/30min (120 km/h) → Warnung',C.activityPlausibility('Rad',{dist:60,dur:30}).warn===true);

// isValidRunForAnalytics (zentraler Filter)
ok('valider Lauf 10km/50min → true',C.isValidRunForAnalytics({dist:10,dur:50})===true);
ok('30km/60min (Pace 2.0) → false (zu schnell, eher Rad)',C.isValidRunForAnalytics({dist:30,dur:60})===false);
ok('invalid-Flag → false',C.isValidRunForAnalytics({dist:10,dur:50,invalid:true})===false);
ok('needsReview-Flag → false',C.isValidRunForAnalytics({dist:10,dur:50,needsReview:true})===false);
ok('type=Rad am Datensatz → false',C.isValidRunForAnalytics({dist:10,dur:50,type:'Rad'})===false);
ok('fehlende Dauer → false',C.isValidRunForAnalytics({dist:10})===false);

// moveActivity
function mk(){return {'2026-06-20':{sessions:{Laufen:{dist:30,dur:60,hr:150,hrMax:175,externalId:'strava:9',source:'live',rpe:5,route:'gpx'}}}};}
let m=mk();let r=C.moveActivity(m,'2026-06-20','Laufen','2026-06-20','Rad',{});
ok('Lauf→Rad: Rad gesetzt, Lauf entfernt',r.ok&&m['2026-06-20'].sessions.Rad&&!m['2026-06-20'].sessions.Laufen);
ok('externalId+source+route bleiben erhalten',m['2026-06-20'].sessions.Rad.externalId==='strava:9'&&m['2026-06-20'].sessions.Rad.source==='live'&&m['2026-06-20'].sessions.Rad.route==='gpx');
m=mk();C.moveActivity(m,'2026-06-20','Laufen','2026-06-19','Rad',{});
ok('Datumswechsel: alt entfernt, neu gesetzt',!m['2026-06-20'].sessions.Laufen&&m['2026-06-19'].sessions.Rad);
m=mk();C.moveActivity(m,'2026-06-20','Laufen','2026-06-20','Laufen',{dist:8});
ok('In-Place-Edit: Distanz gepatcht, ID bleibt',m['2026-06-20'].sessions.Laufen.dist===8&&m['2026-06-20'].sessions.Laufen.externalId==='strava:9');
ok('nicht vorhanden → ok:false code=not_found',C.moveActivity(mk(),'2026-06-20','Rad','2026-06-20','Lauf',{}).code==='not_found');

// Zielkonflikt: am Zieltag existiert bereits eine andere Aktivität gleicher Sportart
m={'2026-06-20':{sessions:{Laufen:{dist:30,dur:60}}},'2026-06-19':{sessions:{Rad:{dist:20,dur:50,note:'bestehend'}}}};
r=C.moveActivity(m,'2026-06-20','Laufen','2026-06-19','Rad',{});
ok('Zielkonflikt → ok:false code=target_conflict',r.ok===false&&r.code==='target_conflict');
ok('Zielkonflikt: bestehende Rad-Aktivität NICHT überschrieben',m['2026-06-19'].sessions.Rad.note==='bestehend');
ok('Zielkonflikt: Quelle NICHT entfernt',!!m['2026-06-20'].sessions.Laufen);

// Echte Lösch-Semantik: patch-Feld null entfernt den Altwert
m=mk();C.moveActivity(m,'2026-06-20','Laufen','2026-06-20','Laufen',{hr:null});
ok('Feld leeren (hr:null) entfernt den Altwert',!('hr' in m['2026-06-20'].sessions.Laufen));
ok('andere Felder bleiben beim Löschen erhalten',m['2026-06-20'].sessions.Laufen.dist===30&&m['2026-06-20'].sessions.Laufen.externalId==='strava:9');

// Integration: realer DB-Block — falscher 30km/60min-„Lauf" und Wochen-km-Effekt
function weekKmOf(map){var s=0;for(var d in map){var L=map[d].sessions&&map[d].sessions.Laufen;if(L&&C.isValidRunForAnalytics(L))s+=L.dist||0;}return s;}
m={'2026-06-20':{sessions:{Laufen:{dist:30,dur:60,externalId:'strava:9'}}},'2026-06-18':{sessions:{Laufen:{dist:8,dur:44}}}};
ok('Vor Korrektur: falscher 30km-Lauf zählt NICHT in Wochen-km (Filter), nur valide 8 km',weekKmOf(m)===8);
C.moveActivity(m,'2026-06-20','Laufen','2026-06-20','Rad',{});
ok('Nach Lauf→Rad: 30 km erscheinen als Rad',m['2026-06-20'].sessions.Rad.dist===30&&!m['2026-06-20'].sessions.Laufen);
ok('Nach Korrektur: Wochen-km unverändert valide 8 km',weekKmOf(m)===8);
ok('Nach Korrektur: externalId in Rad erhalten (Reload-fest, da im DB-Modell)',m['2026-06-20'].sessions.Rad.externalId==='strava:9');

// applyActivityPatchPreview == moveActivity-Feldstruktur (SSOT)
function previewVsMove(cur,patch){
  var prev=C.applyActivityPatchPreview(cur,patch);
  var map={'2026-06-20':{sessions:{Laufen:Object.assign({},cur)}}};
  C.moveActivity(map,'2026-06-20','Laufen','2026-06-20','Laufen',patch);
  var moved=map['2026-06-20'].sessions.Laufen;
  return JSON.stringify(Object.keys(prev).sort())===JSON.stringify(Object.keys(moved).sort());
}
ok('Preview & moveActivity erzeugen dieselbe Feldstruktur (löschen)',previewVsMove({dist:30,dur:60,hr:150,note:'x'},{hr:null,note:null}));
ok('Preview & moveActivity erzeugen dieselbe Feldstruktur (setzen)',previewVsMove({dist:30,dur:60},{dist:8,hr:140}));

// Editor-Pflichtfeldlogik (genau wie saveEditActivity entscheidet)
var DIST_SPORTS=['Laufen','Rad','Schwimmen','Wandern'];
function editorBlocks(cur,patch,newType){
  var eff=C.applyActivityPatchPreview(cur,patch);
  if(DIST_SPORTS.indexOf(newType)>=0&&(!(eff.dist>0)||!(eff.dur>0)))return true;
  if((newType==='Gym'||newType==='Mobilität')&&!(eff.dur>0))return true;
  return false;
}
ok('Lauf-Distanz leeren → Speichern blockiert',editorBlocks({dist:10,dur:50},{dist:null},'Laufen')===true);
ok('Lauf-Dauer leeren → Speichern blockiert',editorBlocks({dist:10,dur:50},{dur:null},'Laufen')===true);
ok('Rad-Distanz leeren → blockiert',editorBlocks({dist:20,dur:50},{dist:null},'Rad')===true);
ok('HF leeren → erlaubt (optionales Feld)',editorBlocks({dist:10,dur:50,hr:150},{hr:null},'Laufen')===false);
ok('Notiz leeren → erlaubt',editorBlocks({dist:10,dur:50,note:'x'},{note:null},'Laufen')===false);
ok('Gym-Dauer leeren → blockiert',editorBlocks({dur:45},{dur:null},'Gym')===true);

// Geteilter Filter als Gate für DOM-Analysen (rateActivity/detectPBs/trainingFeedback nutzen denselben Filter)
// 30km/60min: kein gültiger Lauf → würde Feedback/PB/rate „Daten prüfen" auslösen, nicht in Stats.
ok('30km/60min: Filter false → kein Feedback/PB, „Daten prüfen"',C.isValidRunForAnalytics({dist:30,dur:60})===false);
ok('valider Lauf 8km/44min: Filter true → normales Feedback/PB möglich',C.isValidRunForAnalytics({dist:8,dur:44})===true);

console.log('\nErgebnis: '+pass+' bestanden, '+fail+' fehlgeschlagen.');process.exit(fail?1:0);
