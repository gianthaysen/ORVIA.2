/* ============================================================
   DATA LAYER — Speicher, Schema-Version, Migration, Import/Export
   Schema v4 (flach, abwärtskompatibel zu v2/v3):
     DB = { _v:4, "YYYY-MM-DD":{morning,eve,sessions,routines,subs,hsr?},
            _stack:[], _hmTargetMin:110, _lastBackup:ts }
   Regeln: kein stiller Datenverlust — korrupte Daten werden gerettet,
   Speicherfehler sichtbar gemacht, Imports gemergt statt überschrieben.
   ============================================================ */
const KEY='gian_checkins_v2';
const SCHEMA_V=4;
const META_KEYS=['_v','_stack','_hmTargetMin','_lastBackup'];
let saveBlocked=false;   // true solange korrupter Altbestand ungeklärt ist
let saveFailed=false;    // true wenn letzter setItem fehlschlug (Quota/Private Mode)

function isDay(k){return /^\d{4}-\d{2}-\d{2}$/.test(k);}
function todayStr(d){d=d||new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
function dkey(off){const d=new Date();d.setDate(d.getDate()+off);return todayStr(d);}

/* ---- Laden mit Korrupt-Rettung ---- */
function load(){
  let raw=null;
  try{raw=localStorage.getItem(KEY);}catch(e){return {_v:SCHEMA_V};}
  if(raw==null)return {_v:SCHEMA_V};
  try{
    const d=JSON.parse(raw);
    if(typeof d!=='object'||d===null||Array.isArray(d))throw new Error('bad shape');
    return migrate(d);
  }catch(e){
    // Rohdaten retten, Speichern blockieren bis der Nutzer entscheidet
    try{localStorage.setItem(KEY+'_corrupt_'+Date.now(),raw);}catch(_){/* voll */}
    saveBlocked=true;
    return {_v:SCHEMA_V,_corrupt:true};
  }
}

/* ---- Migration v2/v3 (kein _v) -> v4 ---- */
function migrate(d){
  if(!d._v){
    delete d._rehaStage; delete d._theme; // entfernte Features
    Object.keys(d).forEach(k=>{ if(!isDay(k)&&!META_KEYS.includes(k))delete d[k]; });
    d._v=SCHEMA_V;
  }
  if(d._v>SCHEMA_V){ // Daten aus neuerer App-Version: nicht anfassen, nur lesen
    saveBlocked=true; d._tooNew=true;
  }
  return d;
}

/* ---- Speichern mit Fehler-Sichtbarkeit ---- */
function save(){
  if(saveBlocked)return false;
  // Leere Tages-Hüllen (nur durch Anschauen entstanden) nicht persistieren
  Object.keys(DB).forEach(k=>{if(isDay(k)){const e=DB[k];
    if(e&&typeof e==='object'&&Object.keys(e).every(x=>x==='date'))delete DB[k];}});
  try{
    localStorage.setItem(KEY,JSON.stringify(DB));
    if(saveFailed){saveFailed=false;if(typeof renderBanners==='function')renderBanners();}
    try{if(window.ORVIA_onSave)window.ORVIA_onSave();}catch(_){/* Cloud-Sync optional */}
    return true;
  }catch(e){
    if(!saveFailed){saveFailed=true;if(typeof renderBanners==='function')renderBanners();}
    return false;
  }
}
function resolveCorrupt(){ // "Leer weiterstarten" — Rettungskopie bleibt in localStorage
  delete DB._corrupt; saveBlocked=false; save();
}

let DB=load();
function entry(date){if(!DB[date])DB[date]={date};return DB[date];}

/* ---- Validierungs-Helfer ---- */
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function numBound(v,min,max){const n=+v;if(v===''||v==null||isNaN(n))return null;return clamp(n,min,max);}
function numIn(id,min,max){const e=document.getElementById(id);if(!e||e.value==='')return null;return numBound(e.value,min,max);}
// Feld-Grenzen (eine Stelle, nachvollziehbar)
const LIM={rhr:[25,120],bb:[0,100],weight:[30,200],hrvMs:[10,250],prot:[0,400],hydL:[0,12],
  runKm:[0.1,200],runMin:[1,900],hr:[40,230],elev:[0,5000],radKm:[0.1,500],radMin:[1,1200],
  swimM:[10,10000],swimMin:[1,300],gymMin:[1,300],sets:[1,100],mobMin:[1,180],reps:[1,500]};

/* ---- HTML-/JS-Escaping ----
   esc(): für HTML-Text/Attribute. jsArg(): zusätzlich für String-Argumente
   in inline-onclick (Backslash-Escapes überleben das HTML-Decoding). */
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function jsArg(s){return esc(String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"));}

/* ---- Backup-Export ---- */
function markBackup(){DB._lastBackup=Date.now();save();if(typeof renderMehr==='function'&&!document.getElementById('tab-mehr').classList.contains('hide'))renderMehr();}
function exportData(){
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='orvia-export-'+todayStr()+'.json';a.click();URL.revokeObjectURL(url);
  toast('Backup gespeichert ✓');markBackup();
}
function copyData(){
  const txt=JSON.stringify(DB,null,2);
  navigator.clipboard.writeText(txt).then(()=>toast('Daten kopiert ✓')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);
    ta.select();document.execCommand('copy');ta.remove();toast('Daten kopiert ✓');});
  markBackup();
}

/* ---- Import: Tag-weiser Deep-Merge, neuere ts gewinnt ---- */
function mergeDay(local,inc){
  if(!local)return inc;
  const out=Object.assign({},local);
  ['morning','eve'].forEach(sec=>{
    if(inc[sec]&&typeof inc[sec]==='object')
      out[sec]=(!local[sec]||((inc[sec].ts||0)>=(local[sec].ts||0)))?inc[sec]:local[sec];
  });
  if(inc.sessions&&typeof inc.sessions==='object'){
    out.sessions=Object.assign({},local.sessions||{});
    Object.keys(inc.sessions).forEach(t=>{if(t!=='_ts')out.sessions[t]=inc.sessions[t];});
    out.sessions._ts=Math.max(local.sessions?._ts||0,inc.sessions._ts||0)||Date.now();
  }
  if(inc.routines)out.routines=Object.assign({},local.routines||{},inc.routines);
  if(Array.isArray(inc.subs))out.subs=[...new Set([...(local.subs||[]),...inc.subs])];
  if(inc.hsr&&!out.hsr)out.hsr=inc.hsr; // Altdaten erhalten
  return out;
}
function importData(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    let d;
    try{d=JSON.parse(r.result);}catch(e){toast('Import fehlgeschlagen: ungültiges JSON');return;}
    if(typeof d!=='object'||d===null||Array.isArray(d)){toast('Import abgelehnt: falsches Format');return;}
    if(d._v&&d._v>SCHEMA_V){toast('Backup stammt aus neuerer App-Version');return;}
    d=migrate(d);
    // Sicherungskopie der aktuellen DB VOR dem Merge
    try{localStorage.setItem(KEY+'_preimport',JSON.stringify(DB));}catch(_){/* best effort */}
    let merged=0,added=0;
    Object.keys(d).forEach(k=>{
      if(isDay(k)){ if(DB[k]){DB[k]=mergeDay(DB[k],d[k]);merged++;} else {DB[k]=d[k];added++;} }
    });
    if(Array.isArray(d._stack)){
      const st=DB._stack||[];
      d._stack.forEach(x=>{if(x&&x.name&&!st.find(y=>y.name===x.name&&y.timing===x.timing))st.push(x);});
      DB._stack=st;
    }
    if(d._hmTargetMin&&!DB._hmTargetMin)DB._hmTargetMin=d._hmTargetMin;
    if(DB._corrupt){delete DB._corrupt;saveBlocked=false;} // Import löst den Korrupt-Zustand
    save();renderDay();
    toast(added+' Tage neu, '+merged+' zusammengeführt ✓');
  };
  r.readAsText(f);ev.target.value='';
}

/* ---- Strava-/Claude-Aktivitäten-Import (validiert) ---- */
function importSessions(){
  let arr;
  try{arr=JSON.parse(v('pasteBox'));if(!Array.isArray(arr))throw 0;}catch(e){toast('Ungültiges JSON');return;}
  const map={run:'Laufen',laufen:'Laufen',ride:'Rad',rad:'Rad',virtualride:'Rad',swim:'Schwimmen',
    schwimmen:'Schwimmen',gym:'Gym',weighttraining:'Gym',workout:'Gym',yoga:'Mobilität',
    mobilitaet:'Mobilität','mobilität':'Mobilität'};
  let n=0,skip=0;const today=todayStr();
  arr.forEach(a=>{
    if(!a||!a.date||!isDay(a.date)||a.date>today){skip++;return;}
    const t=map[String(a.type||'').toLowerCase().replace(/\s/g,'')];
    if(!t){skip++;return;}
    const e=entry(a.date);e.sessions=e.sessions||{};
    const s=Object.assign({},e.sessions[t]||{});
    const dLim={Laufen:LIM.runKm,Rad:LIM.radKm,Schwimmen:LIM.swimM}[t]||[0.1,500];
    const tLim={Laufen:LIM.runMin,Rad:LIM.radMin,Schwimmen:LIM.swimMin,Gym:LIM.gymMin,'Mobilität':LIM.mobMin}[t]||[1,600];
    const dist=numBound(a.dist,dLim[0],dLim[1]);
    const dur=numBound(a.dur,tLim[0],tLim[1]);
    const hr=numBound(a.hr,LIM.hr[0],LIM.hr[1]);
    if(dist!=null)s.dist=dist; if(dur!=null)s.dur=Math.round(dur); if(hr!=null)s.hr=Math.round(hr);
    if(a.elev!=null){const el=numBound(a.elev,0,LIM.elev[1]);if(el!=null)s.elev=el;}
    if(a.long!=null){const lg=numBound(a.long,1,LIM.swimM[1]);if(lg!=null)s.long=lg;}
    if(a.sub)s.sub=String(a.sub);
    s.rpe=s.rpe??(numBound(a.rpe,1,10)??5);s.perf=s.perf??6;s.note=s.note||String(a.note||'Strava-Import');
    e.sessions[t]=s;e.sessions._ts=Date.now();n++;
  });
  if(n){save();const pb=document.getElementById('pasteBox');if(pb)pb.value='';renderDay();
    toast(n+' importiert'+(skip?', '+skip+' übersprungen':'')+' ✓');}
  else toast(skip?'Alle '+skip+' Einträge ungültig (Datum/Typ prüfen)':'Keine gültigen Aktivitäten gefunden');
}

/* ---- CSV-Export ---- */
function exportCSV(){
  const days=Object.keys(DB).filter(isDay).sort();
  const rows=[['Datum','Schlaf_h','SchlafQualitaet','Ruhepuls','BodyBattery','HRV','HRV_ms','Stress','Gewicht_kg',
    'Knie_morgen','Befinden','KraftBeine','SprunggelenkLinks','DOMS','Readiness',
    'Lauf_km','Lauf_min','Lauf_HR','Lauf_Hm','Lauf_HFmin','Lauf_HFmax','Rad_km','Rad_min',
    'Schwimmen_m','Schwimmen_min','Schwimmen_LaengsteM','Gym_min','Mobilitaet_min',
    'Protein_g','Hydration_L','Tagesenergie','Stimmung','Knie_abend','SpanishSquats_Reps','Notiz']];
  days.forEach(k=>{
    const e=DB[k];const m=e.morning||{};const ev2=e.eve||{};const s=e.sessions||{};const r=e.routines||{};
    const L=s.Laufen||{},R=s.Rad||{},SW=s.Schwimmen||{},G=s.Gym||{},MO=s['Mobilität']||{};
    rows.push([k,m.sleepMin!=null?(m.sleepMin/60).toFixed(2):'',m.sleepQ??'',m.rhr??'',m.bb??'',m.hrv??'',m.hrvMs??'',m.stress??'',m.weight??'',
      m.knee??'',m.feel??'',m.legs??'',m.ankle??'',m.doms??'',e.morning?readinessFor(k).score:'',
      L.dist??'',L.dur??'',L.hr??'',L.elev??'',L.hrmin??'',L.hrmax??'',R.dist??'',R.dur??'',
      SW.dist??'',SW.dur??'',SW.long??'',G.dur??'',MO.dur??'',
      ev2.prot??'',ev2.hydL??'',ev2.energy??'',ev2.mood??'',ev2.knee??'',r.ssReps??'',String(ev2.note||'').replace(/[;\n]/g,',')]);
  });
  const csv=rows.map(r2=>r2.join(';')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='orvia-export-'+todayStr()+'.csv';a.click();URL.revokeObjectURL(url);
  toast('CSV exportiert ✓');
}
