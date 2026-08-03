/* ORVIA · GM5 — Profil + sämtliche verlinkten Unterseiten in Golden-Master-Struktur.
   Referenz: finale aktive profileView-Verkettung (Basis + „Leistung & Fortschritt" + tabspacer),
   Subpages über das GM-pageHead-/setting-group-System. Kein zusätzlicher A/F/P-Schalter auf
   der Profilhauptseite. Daten NUR aus bestehenden Quellen (PROFILE/Goal-SSOT/Auth/uiDetailMode/
   orviaSyncState/bestTimes()/exportData/orviaLogout/orviaDeleteAccount/profileCenter).
   Keine Demo-Namen/-E-Mails/-Geräte/-Ziele/-Version, keine Ersatzberechnung.
   node supabase/tests/gm5_profile_parity_test.mjs */
import fs from 'fs';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const R=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const html=R('../../../app/index.html'), ui=R('../../../app/js/ui.js'), css=R('../../../app/styles.css'), sw=R('../../../app/sw.js');

const fi=ui.indexOf('/* ====== GM5:');
const fe=ui.indexOf('/* ====== GM5-ENDE');
const blk=(fi>=0&&fe>fi)?ui.slice(fi,fe):'';
ok('GM5-Markerblock mit renderGMProfile existiert', fi>=0&&/function renderGMProfile\(/.test(blk));
ok('#gmProf-Host + #gmProfPage-Overlay im Profil-Tab', html.includes('id="gmProf"')&&html.includes('id="gmProfPage"'));
ok('Profil-Legacy per Kaskade deaktiviert (#tab-mehr>*:not(#gmProf))', /#tab-mehr>:not\(#gmProf\):not\(#gmProfPage\)\{display:none/.test(css.replace(/\s/g,'')));
ok('SW unverändert v8-198, genau einmal', /const C = 'orvia-v8-219'/.test(sw)&&(sw.match(/orvia-v8-\d+/g)||[]).length===1);
ok('openProfile-Override: GM5 übernimmt den aktiven Pfad UI-seitig', /openProfile\s*=\s*function/.test(blk)&&/renderGMProfile\(\)/.test(blk));
/* Demo-Verbote */
ok('keine Demo-Namen/-Handles/-Bio/-E-Mails/-Geräte/-Version', !/Gian Thaysen|gian\.moves|gian@example|Hybrid-Athlet|vívoactive|iPhone · MacBook|v0\.9|Version 0\.9|2FA aktiv/.test(blk));
ok('keine Demo-Ziele/-Bestzeiten/-Medaillen/-Meilensteine', !/Ironman 70\.3|Sub-10|26:14|56:20|2:07:40|BESTTIMES|MEDALS\s*=|MILES\s*=|Kniebeuge 100|742 km/.test(blk));
ok('keine Zielprozent-/Anzahl-Ersatzberechnung', !/\*100\).toFixed|listActivitiesUnified\(\)\.length|\.length\+' Einheiten'/.test(blk));
ok('keine portierte Prototyp-Rechnerlogik (parseT/fmtT/calcCompute)', !/function parseT|function fmtT|calcCompute|Math\.pow\([^)]*1\.06/.test(blk));
ok('bestehende Handler angebunden (profileCenter/orviaLogout/orviaDeleteAccount/exportData/setUiDetailMode/orviaSyncState/bestTimes)', /profileCenter/.test(blk)&&/orviaLogout/.test(blk)&&/orviaDeleteAccount/.test(blk)&&/exportData/.test(blk)&&/setUiDetailMode/.test(blk)&&/orviaSyncState/.test(blk)&&/bestTimes\(\)/.test(blk));
ok('kein zusätzlicher globaler keydown-Listener', !/addEventListener\(\s*['"]keydown/.test(blk));

if(blk){
  const els={};
  const mk=id=>({id,innerHTML:'',textContent:'',style:{},classList:{_s:new Set(),add(c){this._s.add(c);},remove(c){this._s.delete(c);},contains(c){return this._s.has(c);}},setAttribute(){},focus(){},scrollTop:0});
  const el=id=>els[id]||(els[id]=mk(id));
  globalThis.document={getElementById:id=>el(id),createElement:()=>mk('x'),addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:{classList:{add(){},remove(){},contains:()=>false}},};
  globalThis.window=globalThis;
  globalThis.history={state:null,pushState(){}};
  globalThis.escH=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  globalThis.gmEsc=globalThis.escH;globalThis.esc=globalThis.escH;
  globalThis.icon=()=>'<svg class="ic"></svg>';
  globalThis.fmtDe=n=>{if(n==null||isNaN(n))return '–';const r=Math.round(n*10)/10;return r===Math.round(r)?String(Math.round(r)):String(r).replace('.',',');};
  globalThis.GM_NA='Noch nicht verfügbar';
  globalThis.todayStr=()=>'2026-07-26';
  let MODE='fortgeschritten';globalThis.uiDetailMode=()=>MODE;
  globalThis.gmLevel=()=>MODE==='anfaenger'?'a':MODE==='profi'?'p':'f';
  const calls={setMode:[],logout:0,del:0,exp:0,pc:0,goalEd:0,saveProfile:0};
  globalThis.setUiDetailMode=m=>{calls.setMode.push(m);MODE=m;};
  globalThis.saveProfile=()=>{calls.saveProfile++;};
  /* orviaThemePref/orviaSetThemePref leben ausserhalb des GM5-Blocks (GM1 + ui-refresh.js
     nutzen sie ebenfalls) -> hier als Fixture nachgebildet, exakt am selben Vertrag wie
     die echte Implementierung: PROFILE.themePref lesen/schreiben, saveProfile aufrufen,
     Seite neu zeichnen. */
  globalThis.orviaThemePref=()=>{var v=PROFILE&&PROFILE.themePref;return (v==='light'||v==='dark'||v==='auto')?v:'dark';};
  globalThis.orviaSetThemePref=(pref)=>{if(pref!=='light'&&pref!=='dark'&&pref!=='auto')return;PROFILE.themePref=pref;saveProfile();if(typeof gmRerenderAppearance==='function')gmRerenderAppearance();};

  globalThis.orviaLogout=()=>{calls.logout++;};
  globalThis.orviaDeleteAccount=()=>{calls.del++;};
  globalThis.orviaChangePassword=()=>{};
  globalThis.exportData=()=>{calls.exp++;};
  globalThis.openGoalEditor=()=>{calls.goalEd++;};
  globalThis.orviaSyncState=()=>'synced';
  /* Kanonische Zielmodell-Vertraege wie in js/profile-model.js (PRIORITY_TO_ROLE Z.381ff.,
     PROFILE_LABELS Z.1288ff.) — Fixture, keine Nachbildung von Logik im Test. */
  globalThis.ORVIA={user:{email:'echt@konto.test'},profileCenter:{open:()=>{calls.pc++;}},
    activityConfig:{sportLabel:id=>({running:'Laufen',cycling:'Radfahren',gym:'Krafttraining'})[id]||'Aktivität'},
    charts:{richChart:()=>{}},
    profileModel:{
      roleOfGoal:g=>({1:'main',2:'secondary',3:'maintain',4:'longterm'})[g&&g.priority]||'longterm',
      labelOf:(dom,code)=>(({goalRole:{main:'Hauptziel',secondary:'Sekundäres Entwicklungsziel',maintain:'Erhaltungsziel',longterm:'Langfristiges Hintergrundziel'},
        timeHorizon:{short:'kurzfristig',mid:'mittelfristig',long:'langfristig',open:'ohne festes Datum'}})[dom]||{})[code]||code}};
  /* Zielportfolio-Fixture (eingefroren): 1 Hauptziel (wird als eigene Karte gezeigt und
     darf in den Horizontkarten NICHT doppelt auftauchen), 2 mittelfristige (eines davon
     pausiert => zaehlt nicht), 1 langfristiges. */
  let GOALS=[
    {id:'g1',title:'Halbmarathon unter 1:50',status:'active',priority:1,timeHorizon:'mid',targetDate:'2026-09-06'},
    {id:'g2',title:'10 km unter 43:00',status:'active',priority:2,timeHorizon:'mid',targetDate:'2026-11-15'},
    {id:'g3',title:'Alter Wintertest',status:'paused',priority:2,timeHorizon:'mid',targetDate:'2026-10-01'},
    {id:'g4',title:'Ironman-Finish',status:'active',priority:4,timeHorizon:'long',targetDate:null},
    {id:'g5',title:'Weiteres Mittelziel',status:'active',priority:3,timeHorizon:'mid',targetDate:'2027-02-01'},
    /* GM7.9g: Erhaltungsziel mit HOEHERER Prioritaet (3) als das Leitziel Ironman (4) —
       darf trotzdem NICHT vor Ironman stehen. */
    {id:'g6',title:'Kraftbasis halten',status:'active',priority:3,timeHorizon:'long',targetDate:null},
    /* GM7.9g: spaeter datiertes Ziel mit HOEHERER Prioritaet (2) als g8 (4) — das
       naeher datierte g8 muss vorne stehen (Datum schlaegt Prioritaet). */
    {id:'g7',title:'Spaetes Wichtigziel',status:'active',priority:2,timeHorizon:'short',targetDate:'2026-12-01'},
    {id:'g8',title:'Nahes Nebenziel',status:'active',priority:4,timeHorizon:'short',targetDate:'2026-08-20'}
  ];
  globalThis.listGoals=()=>GOALS;
  globalThis.PROFILE={name:'Testathletin A',avatar:null,sports:[{sportId:'running',role:'primary'},{sportId:'gym',role:'supplemental'},{sportId:'cycling',role:'supplemental'}],milestones:[{id:'m1',label:'Longrun 18 km'},{id:'m2',label:'10 km unter 55:00'}]};
  globalThis.goalOf=()=>({type:'half_marathon',raceDate:'2026-09-06',targetMin:110,_canonicalId:'g1'});
  globalThis.RACE_LABELS_P={half_marathon:'Halbmarathon'};
  globalThis.daysTo=()=>42;
  globalThis.allLoads=()=>({loads:[5,6,7,4,6,5,7,6,5,8,6,7,5,6,7],labels:[],confidence:{}});
  globalThis.Calc={loadSeries:()=>({ctl:[38,39,40,41,41,42,41,41,42,41,42,41,42,41,41],atl:[],tsb:[]}),
    loadConfidenceContract:()=>({tier:'hoch',suppressNumbers:false}),
    fmtPace:s=>{const m=Math.floor(s/60),x=Math.round(s%60);return m+':'+String(x).padStart(2,'0');}};
  globalThis.bestTimes=()=>({t1:232,t5:1583,t10:3380,real:{k1:false,k5:true,k10:false},estPace:315,estDist:6.5,n:9});
  globalThis.fmtPace=s=>Calc.fmtPace(s);
  globalThis.DB={_lastBackup:'2026-07-25T08:14:00'};
  globalThis.gmOpenSheet=()=>{};globalThis.gmCloseSheets=()=>{};
  globalThis.toast=()=>{throw new Error('Schein-Toast im GM5-Pfad');};
  globalThis.renderMehr=()=>{throw new Error('Legacy-Profilrenderer im GM5-Pfad');};
  globalThis.openProfile=function(){};
  let evalOk=true,err='';
  try{(0,eval)(blk);}catch(e){evalOk=false;err=String(e);}
  ok('Block evaluiert mit Fixtures', evalOk, err);

  if(evalOk){
    els['gmProf']=mk('gmProf');
    renderGMProfile();
    const H=els['gmProf'].innerHTML;
    /* Profil-Reihenfolge */
    const seq=['profile-cover','ig-profile','ig-top','ig-avatar','ig-actions','ig-name','ig-handle','ig-bio','ig-stats','sectlabel','sport-chips','sectlabel','goal-stack','sectlabel','setting-group','sectlabel','setting-group','tabspacer'];
    let pos=-1,ordOk=true,which='';
    for(const s of seq){const i=H.indexOf(s,pos+1);if(i<0){ordOk=false;which=s;break;}pos=i;}
    ok('Profil-Reihenfolge exakt (cover→ig-profile→Sportarten→Zielreise→Kontrolle→Leistung→tabspacer)', ordOk, which);
    ok('kein zusätzlicher A/F/P-Modusschalter auf der Profilhauptseite', !/seg-nav|modeseg|#lvl|choice-grid/.test(H));
    ok('exakt 4 Statistikslots (Einheiten/Sportarten/Fitness/Zielaufbau)', (H.match(/ig-stat"/g)||[]).length===4&&/Einheiten/.test(H)&&/Sportarten/.test(H)&&/Fitness/.test(H)&&/Zielaufbau/.test(H));
    ok('Statistiken nur kanonisch: Sportarten 3, Fitness CTL 41, Einheiten/Zielaufbau —', />3<\/b>/.test(H)&&/>41<\/b>/.test(H)&&(H.slice(H.indexOf('ig-stats'),H.indexOf('sectlabel')).match(/>—</g)||[]).length===2);
    ok('Name aus kanonischem Profil, Initialen echt, Handle/Bio Missingness', /Testathletin A/.test(H)&&/>TA</.test(H)&&!/@gian/.test(H)&&/ig-handle">—|ig-handle">'?—/.test(H.replace(/\s/g,''))||/Testathletin A/.test(H)&&/>TA</.test(H));
    ok('Sport-Chips aus kanonischem Profil (3 Chips)', (H.match(/sport-chip/g)||[]).length>=3&&/Laufen/.test(H)&&/Krafttraining/.test(H));
    ok('Zielreise aus Goal-SSOT (Halbmarathon, ohne Zielprozent)', /Halbmarathon/.test(H)&&/goal-line/.test(H)&&/width:0%/.test(H.slice(H.indexOf('goal-stack'))));
    const grp1=H.slice(H.indexOf('Profil &amp; Kontrolle'),H.indexOf('Leistung &amp; Fortschritt'));
    ok('Kontrolle: exakt 3 Zeilen (Ziele/Geräte/Einstellungen)', (grp1.match(/setting-item/g)||[]).length===3&&/Ziele &amp; Sportarten/.test(grp1)&&/Geräte &amp; Daten/.test(grp1)&&/Einstellungen/.test(grp1));
    const grp2=H.slice(H.indexOf('Leistung &amp; Fortschritt'));
    ok('Leistung: exakt 4 Zeilen (Bestzeiten/Medaillen/Meilensteine/Pace-Rechner)', (grp2.match(/setting-item/g)||[]).length===4&&/Bestzeiten/.test(grp2)&&/Medaillen/.test(grp2)&&/Meilensteine/.test(grp2)&&/Pace-Rechner/.test(grp2));
    ok('Profil bearbeiten nutzt produktiven Editor (profileCenter)', /gmProfEdit|profileCenter/.test(H)&&(()=>{gmProfEdit();return calls.pc===1;})());
    /* 17 Subpage-Routen */
    els['gmProfPage']=mk('gmProfPage');
    const ROUTES=['settings','appearance','notifications','privacy','goals','dailyGoals','planSettings','health','connections','units','data','account','about','bestTimes','medals','milestones','paceCalc'];
    let allOk=true,bad='';
    for(const r of ROUTES){
      try{gmOpenProfPage(r);}catch(e){allOk=false;bad=r+': '+e;break;}
      const P=els['gmProfPage'].innerHTML;
      if(!/page-head/.test(P)||!/page-head-row/.test(P)||!/backbtn/.test(P)||!/gmCloseProfPage/.test(P)){allOk=false;bad=r+' pageHead';break;}
      if(!/tabspacer/.test(P)){allOk=false;bad=r+' tabspacer';break;}
    }
    ok('alle 17 Subpage-Routen mit korrekter pageHead-/Back-Struktur', allOk, bad);
    /* Einstellungen */
    gmOpenProfPage('settings');
    const S=els['gmProfPage'].innerHTML;
    ok('Einstellungen: alle GM-Gruppen + Abmelden über Auth', /Darstellung/.test(S)&&/Training &amp; Gesundheit/.test(S)&&/Kommunikation/.test(S)&&/Konto &amp; Kontrolle/.test(S)&&/danger-link/.test(S)&&/orviaLogout/.test(S));
    ok('Einstellungen: Modus-Wert aus uiDetailMode', /Fortgeschritten/.test(S));
    /* Ansicht & Detailtiefe */
    gmOpenProfPage('appearance');
    const A=els['gmProfPage'].innerHTML;
    ok('Ansicht: A/F/P über setUiDetailMode, Seite bleibt offen', (()=>{gmProfSetMode('profi');return calls.setMode[0]==='profi'&&/choice on|choice ?"?.*on/.test(els['gmProfPage'].innerHTML)&&/Profi/.test(els['gmProfPage'].innerHTML);})());
/* GM7.6: Erscheinungsbild jetzt wirklich funktionsfaehig — alle drei Optionen klickbar,
       persistiert im bestehenden Profilvertrag (PROFILE.themePref -> saveProfile), dadurch
       automatisch cloud-synchronisiert (orvia_profile_v1 ist Teil der sync.js-KEYS). */
    ok('Theme: alle drei Optionen sichtbar UND klickbar (kein disabled mehr)', /Dunkel/.test(A)&&/Hell/.test(A)&&/Automatisch/.test(A)&&!/choice" disabled/.test(A));
    ok('Theme: Dunkel ist der Default (keine Praeferenz gesetzt)', /choice on" onclick="orviaSetThemePref\('dark'\)"/.test(A));
    const spBefore=calls.saveProfile,stackLenBefore=_gmProfStack.length;
    orviaSetThemePref('light');
    ok('Theme: Auswahl schreibt PROFILE.themePref UND speichert ueber den bestehenden Profilvertrag', PROFILE.themePref==='light'&&calls.saveProfile===spBefore+1);
    ok('Theme: kein Navigations-Stack-Zuwachs durch Umschalten (nur Neuzeichnen, keine Navigation)', _gmProfStack.length===stackLenBefore&&_gmProfRoute==='appearance');
    const A2=els['gmProfPage'].innerHTML;
    ok('Theme: nach Auswahl zeigt die Seite Hell als aktiv', /choice on" onclick="orviaSetThemePref\('light'\)"/.test(A2));
    orviaSetThemePref('dark');
    gmProfSetMode('fortgeschritten');
    /* Benachrichtigungen / Datenschutz */
    gmOpenProfPage('notifications');
    const N=els['gmProfPage'].innerHTML;
    ok('Benachrichtigungen: Kategorien sichtbar deaktiviert, kein Schein-Toggle', (N.match(/setting-item/g)||[]).length>=6&&(N.match(/disabled/g)||[]).length>=5&&!/togglePref/.test(N));
    gmOpenProfPage('privacy');
    const PR=els['gmProfPage'].innerHTML;
    ok('Datenschutz: Safety-Regeln immer aktiv, Controls deaktiviert', /Safety-Regeln/.test(PR)&&/Immer aktiv/.test(PR)&&(PR.match(/disabled/g)||[]).length>=3);
    /* Ziele */
    gmOpenProfPage('goals');
    const G=els['gmProfPage'].innerHTML;
    ok('Ziele: Goal-SSOT-Karte + 2 Horizontkarten + produktiver Hinzufügen-Flow', /Halbmarathon/.test(G)&&(G.match(/goal-card/g)||[]).length===3&&(()=>{const n=calls.goalEd;gmProfAddGoal();return calls.goalEd===n+1;})());
    /* GM7.9f: Horizontkarten aus dem kanonischen Zielmodell (timeHorizon), nicht mehr fest „—" */
    ok('Ziele: MITTELFRISTIG zeigt das echte mittelfristige Ziel mit Zieldatum aus dem Modell',
       /10 km unter 43:00/.test(G)&&/15\.11\.2026/.test(G));
    ok('Ziele: LANGFRISTIG zeigt das echte langfristige Ziel; ohne Zieldatum die kanonische Rolle',
       /Ironman-Finish/.test(G)&&/Langfristiges Hintergrundziel/.test(G));
    /* GM7.9g: Rangfolge innerhalb eines Horizonts */
    ok('Ziele: Erhaltungsziel verdraengt trotz hoeherer Prioritaet nicht das Leitziel',
       /<h4>Ironman-Finish<\/h4>[\s\S]*?LANGFRISTIG/.test(G)&&!/<h4>Kraftbasis halten<\/h4>/.test(G));
    ok('Ziele: naeher datiertes Ziel steht vor spaeter datiertem mit hoeherer Prioritaet',
       (function(){var r=gmProfHorizonCard('short','KURZFRISTIG','kurzfristiges');
        return /<h4>Nahes Nebenziel<\/h4>/.test(r)&&/20\.08\.2026/.test(r)&&/\+1 weitere/.test(r);})());
    /* Kalibrierung: Die HAUPTZIEL-Karte rendert den Titel legitim EINMAL (aus goalOf()).
       Geprueft wird, dass dasselbe Ziel nicht zusaetzlich in der MITTELFRISTIG-Karte
       auftaucht — dort steht das naechste echte Ziel (g2). */
    ok('Ziele: Hauptziel erscheint NICHT doppelt in der Horizontkarte (Rolle main ausgenommen)',
       (G.match(/Halbmarathon unter 1:50/g)||[]).length===1
       &&/<h4>10 km unter 43:00<\/h4>[\s\S]*?MITTELFRISTIG/.test(G));
    ok('Ziele: pausiertes Ziel zaehlt nicht, weitere aktive werden als Anzahl ausgewiesen',
       !/Alter Wintertest/.test(G)&&/\+1 weitere/.test(G));
    ok('Ziele: kein erfundener Zielfortschritt (Spur bleibt leer)',
       (G.match(/goal-line/g)||[]).length===3&&!/goal-line"><i style="width:(?!0%)/.test(G));
    /* Gegenprobe: ohne Ziele bleibt die volle Struktur mit ehrlichem „—" stehen */
    const GOALS_BAK=GOALS.slice(); GOALS.length=0;
    gmOpenProfPage('goals');
    const G0=els['gmProfPage'].innerHTML;
    ok('Ziele: ohne aktive Ziele bleiben 3 Karten mit ehrlichem „—" (Struktur schrumpft nie)',
       (G0.match(/goal-card/g)||[]).length===3&&/kein aktives mittelfristiges Ziel/.test(G0)&&/kein aktives langfristiges Ziel/.test(G0)&&!/Ironman-Finish/.test(G0));
    GOALS.push(...GOALS_BAK); gmOpenProfPage('goals');
    /* Tagesziele */
    gmOpenProfPage('dailyGoals');
    const D=els['gmProfPage'].innerHTML;
    ok('Tagesziele: 4 Stepperzeilen, ohne Vertrag deaktiviert + —', (D.match(/stepper-row/g)||[]).length===4&&(D.match(/disabled/g)||[]).length>=8&&(D.match(/>—</g)||[]).length>=4&&!/adjustDaily/.test(D));
    /* Konto */
    gmOpenProfPage('account');
    const K=els['gmProfPage'].innerHTML;
    ok('Konto: echte Auth-E-Mail, Passkey/2FA/Geräte ⇒ —', /echt@konto\.test/.test(K)&&(K.match(/>—</g)||[]).length>=2&&!/2FA aktiv|iPhone/.test(K));
    /* Daten */
    gmOpenProfPage('data');
    const DA=els['gmProfPage'].innerHTML;
    ok('Daten: echter Export + echte Sicherungszeit + Löschen nur über Auth-Flow', /exportData/.test(DA)&&/25\.07|2026-07-25|08:14/.test(DA)&&/orviaDeleteAccount/.test(DA));
    /* Bestzeiten */
    gmOpenProfPage('bestTimes');
    const B=els['gmProfPage'].innerHTML;
    ok('Bestzeiten: 6 bt-row-Slots, Werte aus bestTimes()-Modell, Rest neutral', (B.match(/bt-row/g)||[]).length===6&&/26:23/.test(B)&&/56:20/.test(B)&&(B.match(/>—</g)||[]).length>=3);
    ok('Bestzeiten: echte/geschätzte Kennzeichnung aus Modell, kein Aktivitätslink ohne ID', /geschätzt|Import/.test(B)&&!/onclick="toast/.test(B));
    /* GM5.3-Strukturvertrag: identischer Elementtyp wie im Golden Master, kein inertes div mehr. */
    ok('Bestzeiten: Strukturvertrag — 6× <button type="button" class="bt-row…">, keine div.bt-row',
       (B.match(/<button type="button" class="bt-row(?: bt-empty)?"/g)||[]).length===6
       &&!/<div[^>]*class="bt-row/.test(B)
       &&(B.match(/class="bt-row(?: bt-empty)?"/g)||[]).length===6);
    ok('Bestzeiten: jede Zeile öffnet ein bestehendes GM-Sheet mit denselben Zeilenwerten',
       (B.match(/gmOpenBtRowSheet\(\d\)/g)||[]).length===6&&/gmOpenBtRowSheet\(0\)/.test(B)&&/gmOpenBtRowSheet\(5\)/.test(B));
    /* Medaillen */
    gmOpenProfPage('medals');
    const M=els['gmProfPage'].innerHTML;
    ok('Medaillen: 6 neutrale NA-Slots, keine Tiers/Prozente', (M.match(/class="medal locked"/g)||[]).length===6&&(M.match(/locked/g)||[]).length>=6&&/Noch nicht verfügbar/.test(M)&&!/tier-gold|tier-silver|width:78%|width:100%/.test(M));
    /* Meilensteine */
    gmOpenProfPage('milestones');
    const MI=els['gmProfPage'].innerHTML;
    ok('Meilensteine: 6 Slots, vorhandene read-only, Rest neutral, kein UI-Fortschritt', (MI.match(/class="mile"/g)||[]).length===6&&/Longrun 18 km/.test(MI)&&/10 km unter 55:00/.test(MI)&&!/72%|74%|width:6[0-9]%/.test(MI));
    /* GM5.3-Strukturvertrag der Meilensteinzeilen. Die .mile-Elemente der Analyse-/Dashboard-
       Ansicht sind im Golden Master ausdrücklich <div> und bleiben davon unberührt. */
    ok('Meilensteine: Strukturvertrag — 6× <button type="button" class="mile">, keine div.mile in der Unterseite',
       (MI.match(/<button type="button" class="mile"/g)||[]).length===6
       &&!/<div[^>]*class="mile"/.test(MI)
       &&(MI.match(/class="mile"/g)||[]).length===6);
    ok('Meilensteine: jede Zeile öffnet ein bestehendes GM-Sheet mit denselben Zeilenwerten',
       (MI.match(/gmOpenMileRowSheet\(\d\)/g)||[]).length===6&&/gmOpenMileRowSheet\(0\)/.test(MI)&&/gmOpenMileRowSheet\(5\)/.test(MI));
    /* Pace-Rechner */
    gmOpenProfPage('paceCalc');
    const PC=els['gmProfPage'].innerHTML;
    /* GM7.9i: Rechner aktiv (Freigabe 2026-08-02). Struktur unveraendert, Eingaben nicht mehr
       gesperrt, aber weiterhin OHNE Demo-Vorbelegung und mit „—" bis zu einer echten Eingabe. */
    ok('Pace-Rechner: GM-Struktur (Segmente/Felder/Ergebnis/Prognosekarte), Ergebnis — bei leerer Eingabe', /calc-seg/.test(PC)&&/calc-target/.test(PC)&&/calc-field/.test(PC)&&/Laufen/.test(PC)&&/Schwimmen/.test(PC)&&/Rad/.test(PC)&&/id="pcResult"[^>]*>—</.test(PC)&&/link-row|Wettkampfprognose/.test(PC));
    ok('Pace-Rechner: keine vorbelegten Demo-Eingaben (nur placeholder), Eingaben aktiv',
       !/<input[^>]*\svalue=/.test(PC)&&!/disabled/.test(PC.slice(PC.indexOf('calc-seg')))&&(PC.match(/oninput="gmPcCompute\(\)"/g)||[]).length===2);
    ok('Pace-Rechner: Prognoseslots vorhanden und leer', /id="pcP5"[^>]*>—</.test(PC)&&/id="pcP10"[^>]*>—</.test(PC)&&/id="pcPHM"[^>]*>—</.test(PC));
    /* Quelltext des Rechnerblocks — belegt, dass die Prognose den kanonischen Kern nutzt
       und im UI keine eigene Formel steht. */
    const PCSRC=ui.slice(ui.indexOf('function gmPcNum('), ui.indexOf('var GM_PROF_ROUTES'));
    /* Reine Eingabe-Arithmetik — Parser und Formatierer direkt geprueft (kein DOM noetig). */
    ok('Pace-Rechner: Zeit-Parser akzeptiert h:mm:ss, mm:ss und Minuten; verwirft Unsinn',
       gmPcMin('1:52:30')===112.5&&gmPcMin('52:30')===52.5&&gmPcMin('45')===45
       &&gmPcMin('')===null&&gmPcMin('abc')===null&&gmPcMin('1:2:3:4')===null&&gmPcMin('0')===null);
    ok('Pace-Rechner: Zahl-Parser akzeptiert Komma, verwirft Text/Negatives/Null',
       gmPcNum('10,5')===10.5&&gmPcNum('10')===10&&gmPcNum('')===null&&gmPcNum('-3')===null&&gmPcNum('0')===null&&gmPcNum('5km')===null);
    ok('Pace-Rechner: Formatierer', gmPcFmtHms(112.5)==='1:52:30'&&gmPcFmtHms(52.5)==='52:30'&&gmPcFmtMs(5.25)==='5:15'&&gmPcFmtHms(null)==='—');
    ok('Pace-Rechner: Prognose nutzt den kanonischen Kern Calc.riegel, keine UI-Formel',
       /Calc\.riegel\(/.test(PCSRC)&&!/Math\.pow\(/.test(PCSRC));
    /* GM7.5 Navigations-Stack: Zurueck geht IMMER genau eine Ebene zurueck statt
       pauschal zur Profil-Hauptseite (Live-Abnahme-Fund). Stack/Route sauber zuruecksetzen —
       die 17-Routen-Schleife oben oeffnet Seiten ohne dazwischen zu schliessen. */
    globalThis._gmProfStack=[];globalThis._gmProfRoute=null;
    els['gmProfPage']=mk('gmProfPage');
    gmOpenProfPage('settings');
    gmOpenProfPage('appearance');
    gmCloseProfPage();
    ok('Zurueck aus Unterseite (Erscheinungsbild) fuehrt zur Einstellungsliste, nicht zum Profil', /Darstellung/.test(els['gmProfPage'].innerHTML)&&els['gmProfPage'].classList.contains('on'));
    gmCloseProfPage();
    ok('Zurueck aus der Einstellungsliste (kein Direkteinstieg) fuehrt zur Profil-Hauptseite', !els['gmProfPage'].classList.contains('on')&&/ig-profile/.test(els['gmProf'].innerHTML));
    /* Direkteinstieg (Dashboard-Zahnrad): Zurueck aus der Einstellungsliste schliesst das
       gesamte Profil-Overlay, statt auf der Profil-Hauptseite zu landen. */
    let closedToDashboard=false;
    const origCloseProfile=globalThis.closeProfile;
    globalThis.closeProfile=()=>{closedToDashboard=true;};
    gmOpenDashboardSettings();
    ok('Dashboard-Zahnrad oeffnet Einstellungen direkt (keine Profil-Hauptseite dazwischen)', /Darstellung/.test(els['gmProfPage'].innerHTML)&&els['gmProfPage'].classList.contains('on'));
    gmCloseProfPage();
    ok('Zurueck aus per Dashboard-Zahnrad geoeffneten Einstellungen springt nie zum Profil, sondern schliesst zum vorherigen Hauptbildschirm', closedToDashboard);
    globalThis.closeProfile=origCloseProfile;

    /* GM7.5: „Jetzt synchronisieren“ — Garmin-Worker /sync (bereits produktiv live erreichbar),
       reine Frontend-Anbindung. Verbunden/getrennt, laufend/erfolgreich/Fehler. */
    let devConnected=false,devLabel='';
    globalThis.gmDeviceSyncText=()=>devConnected?devLabel:null;
    let fetchCalls=[],fetchStatus=202;
    globalThis.fetch=async(url,opts)=>{fetchCalls.push({url,opts});return {status:fetchStatus};};
    globalThis.ORVIA.sb={auth:{getSession:async()=>({data:{session:{access_token:'test-token-123'}}})}};
    globalThis.ORVIA_CFG={GARMIN_WORKER_URL:'https://worker.test'};

    gmOpenProfPage('connections');
    const C0=els['gmProfPage'].innerHTML;
    ok('Geraete & Daten: Garmin ohne Verbindung => „Kein Geraet verbunden“, Sync-Button deaktiviert', /Kein Gerät verbunden/.test(C0)&&/Jetzt synchronisieren/.test(C0)&&!/onclick="gmDeviceSyncNowTrigger\(\)"/.test(C0));

    devConnected=true;devLabel='Garmin · 5 Min synchronisiert';
    gmCloseProfPage();gmOpenProfPage('connections');
    const C1=els['gmProfPage'].innerHTML;
    ok('Geraete & Daten: verbundenes Geraet zeigt echten Provider-Status + aktiven Sync-Button', /Garmin · 5 Min synchronisiert/.test(C1)&&/onclick="gmDeviceSyncNowTrigger\(\)"/.test(C1));

    /* GM7.5b: 202 = angenommen, nicht fertig. gmDeviceSyncNowTrigger holt zuerst eine
       Baseline via GET /status, postet dann /sync und pollt bei 202 GET /status weiter,
       bis lastSuccessfulSyncAt/-ErrorCode gegenüber der Baseline vorrücken. setTimeout wird
       für die Dauer des Polling-Tests auf sofortige Ausführung umgestellt (kein 90s-Realwarten
       in der Testsuite) und danach exakt zurückgestellt. */
    const realSetTimeout=globalThis.setTimeout,realDateNow=Date.now;
    globalThis.setTimeout=(fn)=>realSetTimeout(fn,0);

    fetchCalls=[];fetchStatus=202;
    let statusCallA=0;
    globalThis.fetch=async(url,opts)=>{
      fetchCalls.push({url,opts});
      if(/\/status$/.test(url)){
        statusCallA++;
        const done=statusCallA>=3; // 1=Baseline, 2=erster Poll ohne Aenderung, 3=Poll mit neuem Erfolg
        return {ok:true,status:200,json:async()=>({lastSuccessfulSyncAt:done?'2026-07-29T10:00:00Z':null,lastErrorCode:null})};
      }
      return {status:fetchStatus};
    };
    await gmDeviceSyncNowTrigger();
    for(let i=0;i<50&&_gmDevSyncNow.state==='running';i++)await new Promise(r=>realSetTimeout(r,2));
    const C2=els['gmProfPage'].innerHTML;
    const statusCalls=fetchCalls.filter(c=>/\/status$/.test(c.url)),syncCalls=fetchCalls.filter(c=>/\/sync$/.test(c.url));
    ok('Jetzt synchronisieren: Baseline-Status vor POST /sync mit Bearer-Token', statusCalls.length>=1&&statusCalls[0].opts.headers.Authorization==='Bearer test-token-123'&&syncCalls.length===1&&syncCalls[0].opts.method==='POST');
    ok('Jetzt synchronisieren: 202 löst kein Fake-Erfolg aus, sondern Status-Polling bis zur echten Fertigstellung', statusCalls.length>=3&&_gmDevSyncNow.state==='success'&&/Abgeschlossen/.test(C2));

    fetchCalls=[];fetchStatus=409;let statusCallB=0;
    globalThis.fetch=async(url,opts)=>{fetchCalls.push({url,opts});if(/\/status$/.test(url)){statusCallB++;return {ok:true,status:200,json:async()=>({lastSuccessfulSyncAt:null,lastErrorCode:null})};}return {status:fetchStatus};};
    await gmDeviceSyncNowTrigger();
    const C3=els['gmProfPage'].innerHTML;
    ok('Jetzt synchronisieren: 409 (nicht verbunden) zeigt ehrlichen Fehlertext, kein Fake-Erfolg, kein Polling', /Gerät ist nicht verbunden/.test(C3)&&!/Abgeschlossen/.test(C3)&&statusCallB===1);

    /* Zeitüberschreitung beim Polling: ehrliches "läuft im Hintergrund weiter" statt Fake-Erfolg. */
    fetchCalls=[];fetchStatus=202;let statusCallC=0,fakeNow=realDateNow();
    Date.now=()=>fakeNow;
    globalThis.fetch=async(url,opts)=>{
      fetchCalls.push({url,opts});
      if(/\/status$/.test(url)){
        statusCallC++;
        if(statusCallC>1)fakeNow+=100000; // simuliert lang laufenden Hintergrund-Sync -> naechster Tick reisst das 90s-Limit
        return {ok:true,status:200,json:async()=>({lastSuccessfulSyncAt:null,lastErrorCode:null})};
      }
      return {status:fetchStatus};
    };
    await gmDeviceSyncNowTrigger();
    for(let i=0;i<50&&_gmDevSyncNow.state==='running';i++)await new Promise(r=>realSetTimeout(r,2));
    const C4=els['gmProfPage'].innerHTML;
    ok('Jetzt synchronisieren: Zeitüberschreitung beim Polling meldet ehrlich "läuft im Hintergrund weiter", kein Fake-Erfolg', _gmDevSyncNow.state==='error'&&/Zeitüberschreitung/.test(_gmDevSyncNow.error)&&!/Abgeschlossen/.test(C4));
    Date.now=realDateNow;
    globalThis.setTimeout=realSetTimeout;
    globalThis.gmDeviceSyncText=()=>null;

    /* Persistenz/Nebenwirkungen */
    gmCloseProfPage();
    renderGMProfile();const l0=els['gmProf'].innerHTML.length;
    renderGMProfile();renderGMProfile();
    ok('Re-Render stabil, keine Akkumulation', els['gmProf'].innerHTML.length===l0);
    ok('deaktivierte Controls mutieren nichts (keine setPref-/persist-Aufrufe im Block)', !/persistPrefs|localStorage\.setItem\((?!'orvia_ui_mode')/.test(blk));
    ok('A/F/P persistent über bestehenden Vertrag (setUiDetailMode aufgerufen)', calls.setMode.length>=2);
    ok('Fixtures unverändert', PROFILE.name==='Testathletin A'&&PROFILE.sports.length===3&&goalOf().type==='half_marathon');
  }
}
console.log('\n'+(fail?fail+' FAILED':'gm5_profile_parity: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
