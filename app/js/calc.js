/* ============================================================
   CALC LAYER — reine, testbare Berechnungen (kein DOM, kein DB-Zugriff)
   Alle Formeln kommentiert. Über window.Calc UND module.exports (Tests).
   ============================================================ */
(function(root){
const HM_KM=21.0975, RACE_DATE='2026-09-06', TARGET_MIN_DEFAULT=110;
// HFmax-Fallback populationsneutral (Tanaka 208−0,7·Alter), NICHT auf ein bestimmtes Profil hardcodiert.
function _hrMax(){
  if(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.hfMax)return PROFILE.hfMax;
  const age=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.age)||null;
  return age?Math.round(208-0.7*age):null; // KEIN globaler 190-Fallback — null = HFmax unbekannt
}
// Ruhepuls-Baseline NUR aus dem Profil des aktuellen Nutzers. Kein globaler Fremdwert:
// fehlt eine echte persönliche Baseline, wird Ruhepuls im Score NICHT bewertet (s. readiness()).
function _rhrBase(){return (typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.rhrBaseline)||null;}

/* ---- Basis ---- */
function avg(a){const x=(a||[]).filter(v=>v!=null&&!isNaN(v));return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;}
function median(a){const x=(a||[]).filter(v=>v!=null&&!isNaN(v)).sort((p,q)=>p-q);if(!x.length)return null;const m=x.length>>1;return x.length%2?x[m]:(x[m-1]+x[m])/2;}
function sd(a){const x=(a||[]).filter(v=>v!=null&&!isNaN(v));if(x.length<2)return null;const m=avg(x);return Math.sqrt(x.reduce((s,v)=>s+(v-m)*(v-m),0)/(x.length-1));}
function clampC(x,a,b){return Math.max(a,Math.min(b,x));}
function fmtPace(sec){return Math.floor(sec/60)+':'+String(Math.round(sec%60)).padStart(2,'0');}
function fmtTime(min){const h=Math.floor(min/60),m=Math.round(min%60);return h+':'+String(m).padStart(2,'0')+'h';}
/* ---- Zentrale Dauer-Formatierung (eine Quelle der Wahrheit) ----
   value in Minuten (default) ODER Sekunden (unit='sec'). Float-sicher.
   <60 min → "36:07 min" · ≥60 min → "1:12:34 h". Keine Dezimalzahlen. */
function fmtDuration(value,unit){
  if(value==null||value===''||isNaN(value))return '–';
  var totalSec=(unit==='sec')?Math.round(+value):Math.round(+value*60);
  if(totalSec<0)totalSec=0;
  var h=Math.floor(totalSec/3600),m=Math.floor((totalSec%3600)/60),s=totalSec%60;
  return h>0
    ? h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+' h'
    : m+':'+String(s).padStart(2,'0')+' min';
}

/* ---- EWMA, geseedet (Fix: kein Kaltstart bei 0 mehr) ----
   Seed = Ø der ersten min(7,n) Werte, damit CTL nicht systematisch zu niedrig startet. */
function ewma(arr,tau){
  if(!arr.length)return[];
  const seedN=Math.min(7,arr.length);
  let prev=avg(arr.slice(0,seedN))||0;
  const out=[];for(const x of arr){prev=prev+((x||0)-prev)/tau;out.push(prev);}return out;
}

/* ---- sRPE-Last einer Tages-Entry (Dauer × RPE; Mobilität fix RPE 2) ---- */
function sessionLoad(e){
  if(!e||!e.sessions)return 0;let L=0;
  for(const t of Object.keys(e.sessions)){
    if(t==='_ts')continue;const s=e.sessions[t];
    const dur=s.dur||0;const rpe=t==='Mobilität'?2:(s.rpe||5); // Fix: perf ist kein Anstrengungsmaß
    L+=dur*rpe;
  }return L;
}

/* ---- ACWR, EWMA-basiert & entkoppelt interpretierbar (Williams 2017) ----
   loads: chronologisch. Erst ab 21 Tagen Historie aussagekräftig. */
function acwr(loads){
  const nz=loads.filter(x=>x>0).length;
  if(loads.length<21||nz<6)return{ratio:null,acute:null,chronic:null,enough:false};
  const a=ewma(loads,7),c=ewma(loads,28);
  const A=a[a.length-1],C=c[c.length-1];
  return{ratio:C>10?+(A/C).toFixed(2):null,acute:Math.round(A*7),chronic:Math.round(C*7),enough:C>10};
}

/* ---- E3 · Belastungsmodell (pur): ATL/CTL/TSB + Foster-Monotonie/Strain + ACWR ----
   loads: chronologische Tageslasten (sRPE). ATL=EWMA(7), CTL=EWMA(42), TSB=CTL−ATL.
   Monotony = Ø(7T)/SD(7T); Strain = Wochenlast × Monotony. Null bei zu wenig Daten
   (keine erfundenen Kennzahlen). Grundlage für Engine-v2-Belastungsgates + Insights. */
/* R1.4: EINE Kurvenquelle für alle Belastungsanzeigen (Form-Chart, Karten, Reports).
   Liefert die vollständigen ATL/CTL/TSB-Serien; loadModel liefert die (gerundeten)
   Endpunkte + Wochenkennzahlen. UI-Flächen rechnen NIE mehr eigene EWMA-Kurven. */
function loadSeries(loads){
  if(!Array.isArray(loads)||!loads.length)return{atl:[],ctl:[],tsb:[]};
  const atl=ewma(loads,7),ctl=ewma(loads,42);
  const tsb=ctl.map((c,i)=>+(c-atl[i]).toFixed(1));
  return{atl,ctl,tsb};
}
function loadModel(loads){
  if(!Array.isArray(loads)||loads.length<7)return null;
  const S=loadSeries(loads);
  const atl=S.atl[S.atl.length-1],ctl=S.ctl[S.ctl.length-1];
  const last7=loads.slice(-7);
  const mean=avg(last7);
  const sd=Math.sqrt(avg(last7.map(x=>{const d=(x||0)-mean;return d*d;})));
  const monotony=sd>0?+(mean/sd).toFixed(2):null;                 // Foster
  const weekLoad=Math.round(last7.reduce((s,x)=>s+(x||0),0));
  const strain=monotony!=null?Math.round(weekLoad*monotony):null;
  const ac=acwr(loads);
  // Invariante: TSB aus den GERUNDETEN Anzeigewerten (sonst Rundungs-Widerspruch in der UI).
  const atlR=Math.round(atl),ctlR=Math.round(ctl);
  return {atl:atlR,ctl:ctlR,tsb:ctlR-atlR,
    weekLoad:weekLoad,monotony:monotony,strain:strain,
    acwr:ac.ratio,acwrReliable:!!ac.enough,acute:ac.acute,chronic:ac.chronic,
    dataDays:loads.filter(x=>x>0).length};
}
/* I3a.2: Last-Anzeige-/Semantikvertrag (nur Text/Sichtbarkeit, KEINE neue Lastformel, KEIN
   Safety-Gate). CTL/ATL aus measured+estimated ist ein modellierter Schätzwert (eine Schätzung
   kann über oder unter der wahren Last liegen) und darf NIE als "Untergrenze" bezeichnet werden.
   Eine echte Untergrenze ("bekannte Teilsumme") besteht ausschließlich aus measuredLoad (siehe
   ui.js renderACWRCard: Calc.loadSeries(measuredLoads) - dieselbe EWMA-Formel, nur auf der
   gemessenen Teilserie). confidence: 'hoch' | 'reduziert' | 'not_assessable' (dailyLoadSeries). */
function loadConfidenceContract(confidence){
  if(confidence==='not_assessable')return{
    tier:'not_assessable',suppressNumbers:true,
    ctlAtlNote:'CTL/ATL nicht belastbar (Lastserie unvollständig oder nur geschätzt/unbekannt).',
    acwrTsbNote:'ACWR/TSB nicht belastbar (Lastserie unvollständig).'};
  if(confidence&&confidence!=='hoch')return{
    tier:'reduziert',suppressNumbers:false,
    ctlAtlNote:'CTL/ATL sind ein modellierter Schätzwert (geschätzt), keine Untergrenze, da Lastdaten teils geschätzt/unvollständig sind.',
    acwrTsbNote:'ACWR/TSB nicht exakt (Lastdaten teils geschätzt/unvollständig).'};
  return{tier:'hoch',suppressNumbers:false,ctlAtlNote:null,acwrTsbNote:null};
}

/* ---- Wochen-km-Rampe (Fix: Vorzeichen; neu: Entlastungswochen) ----
   weeksAhead: 0=diese Woche, 1=nächste, ... Deload alle 4 Planwochen (-28%). */
function weekKmTarget(daysToRace,weeksAhead){
  const d=daysToRace-(weeksAhead||0)*7;
  if(d<0)return 0;
  const w=Math.ceil(Math.max(d,1)/7); // Wochen bis Race
  let base;
  if(w>=12)base=22;else if(w>=10)base=26;else if(w>=8)base=30;else if(w>=6)base=34;
  else if(w>=4)base=37;else if(w===3)base=40;else if(w===2)base=32;else base=22;
  const planWeek=25-w;                       // Runna-Woche
  if(w>3&&planWeek>0&&planWeek%4===0)base=Math.round(base*0.72); // Entlastungswoche
  return base;
}
/* Ist-Kopplung: Kalenderziel nie >10% über dem Maximum der letzten 3 Ist-Wochen */
function effectiveKmTarget(calTarget,last3WeeksKm){
  const mx=Math.max(...last3WeeksKm,0);
  if(mx<=0)return Math.min(calTarget,12); // Wiedereinstieg
  return Math.min(calTarget,Math.round(1.10*mx));
}
function runnaWeek(daysToRace){ // Fix Off-by-one: Rennwoche = 25
  const w=25-Math.ceil(Math.max(daysToRace,0)/7);
  return clampC(daysToRace<=6?25:w,1,25);
}
/* ---- Planerfüllung (F2): geplante vs. tatsächlich absolvierte Sportarten eines Tages ----
   planned/done: Arrays von Sportart-Typen (z.B. ['Laufen','Gym']). opts.isPast=true → vergangener Tag.
   Status: erfuellt | teilweise | alternativ | ungeplant | ausgefallen | offen | keins. */
function planStatus(planned, done, opts){
  var o=opts||{};
  var P=(planned||[]).filter(Boolean), D=(done||[]).filter(Boolean);
  var dset={}; D.forEach(function(t){dset[t]=true;});
  var matched=P.filter(function(t){return dset[t];});
  if(!P.length){
    if(D.length)return{key:'ungeplant',label:'Ungeplante Einheit'};
    return{key:'keins',label:''};
  }
  if(matched.length===P.length)return{key:'erfuellt',label:'Plan erfüllt'};
  if(matched.length>0)return{key:'teilweise',label:'Teilweise erfüllt'};
  if(D.length)return{key:'alternativ',label:'Alternative Einheit'};
  return o.isPast?{key:'ausgefallen',label:'Einheit ausgefallen'}:{key:'offen',label:'Geplant'};
}
/* ---- Duplikaterkennung (F3): Kandidat vs. bestehende Einheit ----
   a=Kandidat {type,date,dur,dist,externalId}, b=bestehende {dur,dist,source,externalId,...}.
   Liefert {match,reason,confidence} oder null (kein Treffer). */
/* ============================================================
   I3 Part B — Kanonischer Plan-Ist-Resolver (PUR, deterministisch, reihenfolgeunabhängig).
   Beantwortet ZWEI getrennte Fragen:
     (1) LINKAGE  — gehört eine tatsächliche Aktivität zu einer geplanten Einheit?
     (2) ERFÜLLUNG — via bestehendem Calc.planStatus-Vertrag (KEINE neuen Schwellen).
   VERKNÜPFUNG — nur PLANBEZOGENE, EINDEUTIGE IDENTITÄT verbindet automatisch:
     • explizite stabile Referenz: activity.plannedSessionId === planned.occurrenceId
       (Projektion von workout_sessions.planned_session_id ins metrics-jsonb, activity-store.js:64;
        bzw. der vom Nutzer markierte plan_done-Occurrence — beides plan-eigene Identität).
   KEIN Metrik-/Tag-/Sport-Fallback: gleicher Tag, gleiche Sportart oder ähnliche Dauer/Distanz
   sind Aktivitäts-Ähnlichkeit (Herkunft: Dedup, Calc.activityDuplicate) und liefern KEINE
   plan-eigene Identität — sie erzeugen daher NIE eine automatische Erfüllung. Solche schwachen
   Kandidaten führen ausschließlich zu 'ambiguous' (Konkurrenz) oder 'unknown' (einzeln,
   unbelegbar). Im Zweifel kein automatischer Link.
   ERFÜLLUNG (nur NACH Linkage): Calc.planStatus (calc.js:141) ist der EINZIGE dokumentierte
   Erfüllungsvertrag (präsenzbasiert). 'partial' entsteht ausschließlich über planStatus
   'teilweise' auf Tages-/Set-Ebene (byDay) — es gibt KEINE dokumentierte Pro-Einheit-
   Metrikschwelle; eine solche zu erfinden ist per Auftrag §6 verboten. Fehlen Ist-Metriken ⇒
   missingFields; der Zustand bleibt presence-completed bzw. unknown (nie künstlich partial).
   Unverhandelbar: jede Aktivität HÖCHSTENS einer Einheit; fehlende Quelle ⇒ unknown (nie
   missed/0); Ruhetag nie missed; Zukunft/heute nie missed; keine Mutation der Eingaben;
   gleiche Eingaben ⇒ gleiches Ergebnis; Array-Reihenfolge irrelevant.
   ------------------------------------------------------------
   planned[]:   { occurrenceId|null, sportId, localDate, plannedDurationMin?, plannedDistanceKm?, plannedLoad?, isRest? }
   activities[]:{ activityId, sportId, localDate, plannedSessionId?, durationMin?, distanceKm?, load?, loadKnown?, externalId?, source? }
   opts:        { today:'YYYY-MM-DD'|null, activitiesLoaded:true, planLoaded:true }
   ============================================================ */
function resolvePlanActual(planned, activities, opts){
  var o = opts || {};
  var today = o.today || null;
  var activitiesLoaded = (o.activitiesLoaded !== false);
  var planLoaded = (o.planLoaded !== false);

  var rawP = (Array.isArray(planned) ? planned : []).filter(Boolean);
  var rawA = (Array.isArray(activities) ? activities : []).filter(Boolean);

  // ---- Missingness-/Fail-closed-Guards (§8) ----
  if (!activitiesLoaded) {
    // Fehlende Activity-Quelle ⇒ nichts ist beweisbar absolviert ODER verpasst.
    var resU = rawP.filter(function(p){ return !p.isRest; }).map(function(p){
      return _unit(p, null, 'unknown', 'none', null, false,
        ['activities_not_loaded'], _plannedMissing(p), [], 'source_missing');
    });
    return { results: resU, unmatched: [], byDay: _byDayFromResults(resU, today),
      provenance: { activitiesLoaded: false, planLoaded: planLoaded, today: today } };
  }
  if (!planLoaded) {
    // Fehlende Planquelle ⇒ tatsächliche Aktivitäten bleiben unmatched (nie missed).
    var unm0 = rawA.slice().sort(_byAct).map(function(a){ return _unmatched(a, 'plan_not_loaded'); });
    return { results: [], unmatched: unm0, byDay: {},
      provenance: { activitiesLoaded: true, planLoaded: false, today: today } };
  }

  // Ruhetage sind keine erfüllbaren Einheiten (case M): aus der Planmenge nehmen.
  var P = rawP.filter(function(p){ return !p.isRest; }).slice().sort(_byPlan);
  var A = rawA.slice().sort(_byAct);

  var used = {};                    // activityId -> true (One-to-one)
  var candidateActIds = {};         // activityId -> true (irgendwo Kandidat ⇒ nicht 'unmatched')
  var link = {};                    // occKey -> { act, method, confidence }
  var ambig = {};                   // occKey -> [activityIds]
  var weak = {};                    // occKey -> [activityIds]  (gleicher Tag+Sport, KEIN Link)

  var occKey = function(p, i){ return p.occurrenceId != null ? ('occ:' + p.occurrenceId) : ('idx:' + i + ':' + p.localDate + ':' + p.sportId); };

  // ---- PASS 1: explizite stabile Referenz (EINZIGE automatische Verknüpfung), One-to-one erzwungen ----
  var actByPlannedId = {};
  A.forEach(function(a){ if (a.plannedSessionId != null) { var k = String(a.plannedSessionId); (actByPlannedId[k] = actByPlannedId[k] || []).push(a); } });
  var planByOcc = {};
  P.forEach(function(p){ if (p.occurrenceId != null) { var k = String(p.occurrenceId); (planByOcc[k] = planByOcc[k] || []).push(p); } });

  P.forEach(function(p, i){
    if (p.occurrenceId == null) return;
    var k = String(p.occurrenceId);
    var claimants = (actByPlannedId[k] || []).filter(function(a){ return !used[a.activityId]; });
    if (!claimants.length) return;
    claimants.forEach(function(a){ candidateActIds[a.activityId] = true; });
    var occurrencesForThisId = planByOcc[k] || [];
    // Eindeutig NUR wenn genau EINE Aktivität diese occ beansprucht UND diese occ eindeutig ist.
    if (claimants.length === 1 && occurrencesForThisId.length === 1) {
      var a = claimants[0];
      used[a.activityId] = true;
      link[occKey(p, i)] = { act: a, method: 'explicit_occurrence_id', confidence: 'hoch' };
    } else {
      ambig[occKey(p, i)] = claimants.map(function(a){ return a.activityId; }).sort();
    }
  });

  // ---- Schwache Kandidaten SAMMELN (nur zur Klassifikation, NIE zum automatischen Verlinken) ----
  // Gleicher lokaler Tag + gleiche Sportart = Aktivitäts-Ähnlichkeit, KEINE plan-eigene Identität.
  P.forEach(function(p, i){
    var ok = occKey(p, i);
    if (link[ok] || ambig[ok]) return;
    var weakC = A.filter(function(a){ return !used[a.activityId] && a.sportId === p.sportId && a.localDate === p.localDate; });
    if (weakC.length) { weak[ok] = weakC.map(function(a){ return a.activityId; }).sort(); weakC.forEach(function(a){ candidateActIds[a.activityId] = true; }); }
  });
  // Konkurrenz auf schwacher Ebene (dieselbe Aktivität ist schwacher Kandidat mehrerer Einheiten).
  var weakClaims = {};
  Object.keys(weak).forEach(function(ok){ weak[ok].forEach(function(id){ (weakClaims[id] = weakClaims[id] || []).push(ok); }); });

  // ---- Klassifikation je geplanter Einheit ----
  var results = P.map(function(p, i){
    var ok = occKey(p, i);
    if (link[ok]) {
      var a = link[ok].act;
      var ps = (typeof planStatus === 'function') ? planStatus([p.sportId], [a.sportId], {}) : { key: 'erfuellt' };
      var reasons = ['linked_' + link[ok].method];
      if (ps.key === 'alternativ') reasons.push('sport_swap');
      return _unit(p, a, 'completed', link[ok].method, link[ok].confidence, true, reasons, _actualMissing(a), [], 'linked');
    }
    if (ambig[ok]) {
      return _unit(p, null, 'ambiguous', 'none', null, false,
        ['competing_explicit_claims'], _plannedMissing(p), ambig[ok], 'ambiguous_explicit');
    }
    if (weak[ok] && weak[ok].length) {
      // Konkurrenz (≥2 schwache Kandidaten ODER ein schwacher Kandidat wird von mehreren
      // Einheiten geteilt) ⇒ ambiguous (case C). Genau EIN exklusiver schwacher Kandidat ohne
      // plan-eigene Identität (Datum+Sport allein) ⇒ unknown (case D/E) — NIE automatisch completed.
      var shared = weak[ok].some(function(id){ return (weakClaims[id] || []).length > 1; });
      if (weak[ok].length >= 2 || shared) {
        return _unit(p, null, 'ambiguous', 'none', null, false,
          ['competing_candidates_weak'], _plannedMissing(p), weak[ok], 'ambiguous_weak');
      }
      return _unit(p, null, 'unknown', 'none', null, false,
        ['weak_same_day_sport_only_no_plan_identity'], _plannedMissing(p), weak[ok], 'weak_candidate');
    }
    // Keine Kandidaten: Zeitlage entscheidet.
    if (!today) return _unit(p, null, 'unknown', 'none', null, false, ['today_unknown'], _plannedMissing(p), [], 'no_reference_date');
    if (p.localDate > today) return _unit(p, null, 'unknown', 'none', null, false, ['future'], _plannedMissing(p), [], 'future');
    if (p.localDate === today) return _unit(p, null, 'unknown', 'none', null, false, ['today_still_possible'], _plannedMissing(p), [], 'today');
    return _unit(p, null, 'missed', 'none', null, true, ['no_matching_activity_past'], _plannedMissing(p), [], 'past_complete');
  });

  // ---- byDay-Aggregat (I3b.1): SESSION-GENAU je geplanter Occurrence, NICHT via Sportarten-Menge.
  // planStatus (Sportarten-Set) kann mehrere Einheiten derselben Sportart nicht unterscheiden und
  // wird daher NICHT zur finalen Tages-Aggregation verwendet (bleibt fuer Kompatibilitaet unveraendert).
  var byDay = _byDayFromResults(results, today);

  // ---- Ungeplante Aktivitäten: kein Link, nirgends Kandidat (case I/M) ----
  var unmatched = A.filter(function(a){ return !used[a.activityId] && !candidateActIds[a.activityId]; })
    .sort(_byAct).map(function(a){ return _unmatched(a, 'no_planned_unit'); });

  return { results: results, unmatched: unmatched, byDay: byDay,
    provenance: { activitiesLoaded: true, planLoaded: true, today: today } };

  // ---------- Helpers (rein, keine Mutation der Eingaben) ----------
  function _byPlan(a, b){ return String(a.occurrenceId != null ? a.occurrenceId : ('~' + a.localDate + '|' + a.sportId)).localeCompare(String(b.occurrenceId != null ? b.occurrenceId : ('~' + b.localDate + '|' + b.sportId))); }
  function _byAct(a, b){ return String(a.activityId).localeCompare(String(b.activityId)); }
  function _plannedBlock(p){ return { sportId: p.sportId, localDate: p.localDate, durationMin: (p.plannedDurationMin != null ? p.plannedDurationMin : null), distanceKm: (p.plannedDistanceKm != null ? p.plannedDistanceKm : null), load: (p.plannedLoad != null ? p.plannedLoad : null) }; }
  function _actualBlock(a){ if (!a) return null; return { sportId: a.sportId, localDate: a.localDate, durationMin: (a.durationMin != null ? a.durationMin : null), distanceKm: (a.distanceKm != null ? a.distanceKm : null), load: (a.load != null ? a.load : null), loadKnown: (a.loadKnown === true), missingness: _actualMissing(a) }; }
  function _plannedMissing(p){ var m = []; if (p.plannedDurationMin == null) m.push('planned.durationMin'); if (p.plannedDistanceKm == null) m.push('planned.distanceKm'); return m; }
  function _actualMissing(a){ var m = []; if (!a) return m; if (a.durationMin == null) m.push('actual.durationMin'); if (a.distanceKm == null) m.push('actual.distanceKm'); if (a.load == null || a.loadKnown !== true) m.push('actual.load'); return m; }
  // I3b.1: Tagesstatus SESSION-GENAU aus den bereits aufgeloesten Occurrence-Zustaenden.
  // Zaehlt Occurrence-IDs, dedupliziert NICHT nach Sportart; Unsicherheit wird nie zu completed.
  function _byDayFromResults(results, today){
    var out = {}, days = {};
    results.forEach(function(r){ var d = r.planned && r.planned.localDate; if (!d) return; (days[d] = days[d] || []).push(r); });
    Object.keys(days).sort().forEach(function(day){
      var us = days[day];
      var total = us.length;
      var comp = us.filter(function(r){ return r.state === "completed"; }).length;
      var uncertain = us.some(function(r){ return r.state === "ambiguous" || r.state === "unknown"; });
      var status;
      if (total === 0) status = "none";
      else if (comp === total) status = "completed";
      else if (comp >= 1) status = "partial";
      else if (us.every(function(r){ return r.state === "missed"; })) status = "missed";
      else if (us.some(function(r){ return r.state === "ambiguous"; })) status = "ambiguous";
      else status = "unknown";
      out[day] = { plannedCount: total, completedCount: comp, status: status, assessable: !uncertain, uncertain: uncertain };
    });
    return out;
  }
  function _unit(p, a, state, method, confidence, assessable, reasons, missingFields, ambiguousCandidateIds, prov){
    return {
      plannedSessionId: (p.occurrenceId != null ? p.occurrenceId : null),
      activityId: (a ? a.activityId : null),
      state: state, linkMethod: method, confidence: (confidence || null), assessable: !!assessable,
      planned: _plannedBlock(p), actual: _actualBlock(a),
      reasons: reasons.slice(), missingFields: missingFields.slice(),
      ambiguousCandidateIds: (ambiguousCandidateIds || []).slice(), provenance: prov
    };
  }
  function _unmatched(a, reason){
    return { activityId: a.activityId, state: 'unmatched', sportId: a.sportId, localDate: a.localDate,
      load: (a.load != null ? a.load : null), loadKnown: (a.loadKnown === true),
      reason: reason, assessable: true, provenance: 'unmatched_activity' };
  }
}

function activityDuplicate(a, b){
  if(!a||!b)return null;
  if(a.type&&b.type&&a.type!==b.type)return null;
  if(a.date&&b.date&&a.date!==b.date)return null;
  if(a.externalId&&b.externalId&&a.externalId===b.externalId)return{match:true,reason:'external_id',confidence:'hoch'};
  var near=function(x,y,tol){return x!=null&&y!=null&&Math.abs(x-y)<=tol;};
  var durClose=near(a.dur,b.dur,Math.max(2,(b.dur||0)*0.1));
  var distClose=near(a.dist,b.dist,Math.max(0.3,(b.dist||0)*0.1));
  if(b.source==='live')return{match:true,reason:'live_session',confidence:(durClose||distClose)?'hoch':'mittel'};
  if(durClose||distClose)return{match:true,reason:'metrics',confidence:'mittel'};
  return{match:true,reason:'same_slot',confidence:'niedrig'};
}
/* ---- Dynamische Trainingsphasen (E2): aus dem Wettkampfdatum berechnet, sportübergreifend.
   Standard-Periodisierung: Aufbau → Peak (3 Wo) → Taper (2 Wo) → Wettkampf. todayISO optional. */
function racePhases(raceDate, todayISO){
  if(!raceDate||!/^\d{4}-\d{2}-\d{2}$/.test(raceDate))return [];
  var race=new Date(raceDate+'T12:00'); if(isNaN(race.getTime()))return [];
  function iso(dt){return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');}
  function shift(days){var d=new Date(race.getTime());d.setDate(race.getDate()+days);return d;}
  var phases=[
    {n:'Aufbau',from:null,to:iso(shift(-35)),d:'Volumen & Grundlage aufbauen'},
    {n:'Peak',from:iso(shift(-34)),to:iso(shift(-14)),d:'Höchste Last, wettkampfspezifische Reize'},
    {n:'Taper',from:iso(shift(-13)),to:iso(shift(-1)),d:'Volumen senken, Frische aufbauen'},
    {n:'Wettkampf',from:iso(race),to:iso(race),d:'Renntag'}
  ];
  var t=todayISO||iso(new Date());
  phases.forEach(function(p){p.on=(!p.from||t>=p.from)&&(!p.to||t<=p.to);});
  return phases;
}
/* ---- Intervall-Struktur (Teil B Lauf): Spec → geordnete Schritte mit Sekunden ----
   spec {warmupMin, reps, workSec, recoverSec, cooldownMin}. Erholung zwischen Wiederholungen (nicht nach der letzten). */
function buildIntervals(spec){
  spec=spec||{};var steps=[];
  var wu=Math.max(0,+spec.warmupMin||0), reps=Math.max(0,Math.round(+spec.reps||0)),
      work=Math.max(0,Math.round(+spec.workSec||0)), rec=Math.max(0,Math.round(+spec.recoverSec||0)),
      cd=Math.max(0,+spec.cooldownMin||0);
  if(wu>0)steps.push({kind:'warmup',label:'Warm-up',seconds:Math.round(wu*60)});
  for(var i=1;i<=reps;i++){
    if(work>0)steps.push({kind:'work',label:'Intervall '+i+'/'+reps,seconds:work});
    if(rec>0&&i<reps)steps.push({kind:'recover',label:'Erholung '+i+'/'+(reps-1),seconds:rec});
  }
  if(cd>0)steps.push({kind:'cooldown',label:'Cool-down',seconds:Math.round(cd*60)});
  return steps;
}
/* ---- Schwimm-Pace (Teil B): Sekunden pro 100 m. distanceM>0 & durationSec>0 nötig, sonst null. */
function swimPace100(distanceM, durationSec){
  if(!(distanceM>0)||!(durationSec>0))return null;
  return durationSec/(distanceM/100);
}
/* ---- Muskelvolumen (Phase 4.3): effektive Sätze/Woche je Muskelgruppe ----
   rows: [{muscle_key, weight, sets}] aus exercise_muscles × abgeschlossenen Sätzen.
   Gewichtete Summe je Muskel (direkt/indirekt steckt im weight). */
function aggregateMuscleVolume(rows){
  var out={};
  (rows||[]).forEach(function(r){
    if(!r||!r.muscle_key)return;
    var w=(r.weight!=null?+r.weight:1)||0; var s=(+r.sets||0);
    if(s<=0)return;
    out[r.muscle_key]=(out[r.muscle_key]||0)+s*w;
  });
  // auf eine Nachkommastelle runden
  Object.keys(out).forEach(function(k){out[k]=Math.round(out[k]*10)/10;});
  return out;
}
/* Wochen-Normalisierung: effektive Sätze eines Zeitraums auf 7 Tage hochrechnen. */
function muscleWeeklyEquivalent(effectiveSets, days){ days=(days==null||isNaN(days))?7:+days; if(days<=0)return 0; return (+effectiveSets||0)/days*7; }
/* Individueller Zielbereich (Sätze/Woche) je Priorität — bewusst neutral, KEINE Diagnose. */
function muscleTargetRange(opts){
  opts=opts||{};
  if(opts.targetLow!=null&&opts.targetHigh!=null)return{low:+opts.targetLow,high:+opts.targetHigh};
  var p=opts.priority;
  if(p==='not_prioritized'||p==='maintain')return{low:6,high:12};
  if(p==='weak_point')return{low:14,high:22};
  return{low:10,high:20}; // normal
}
/* Differenzierter Status. NIEMALS „überlastet" allein aus einer Satzgrenze.
   opts: {days, priority, historyConfidence:'insufficient'|'comparable_period', baselineWeekly, hasComplaint}.
   weekly = bereits auf 7 Tage normalisierter Wochenwert. */
function muscleVolumeStatus(weekly, opts){
  opts=opts||{};
  var COL={no_data:'muted',not_prioritized:'muted',insufficient:'info',below_target:'low',in_target:'good',above_target:'high',large_increase:'warn'};
  function R(k,l){return{key:k,label:l,color:COL[k]};}
  if(opts.priority==='not_prioritized')return R('not_prioritized','Kein Schwerpunkt');
  if(weekly==null||isNaN(weekly)||weekly<=0)return R('no_data','Keine Daten');
  // historyConfidence: 'insufficient' (kein vergleichbarer Vorzeitraum) | 'comparable_period'.
  if(opts.historyConfidence==='insufficient')return R('insufficient','Zu wenig Historie');
  var t=muscleTargetRange(opts);
  // Klar begründete Warnung nur bei großem individuellem Sprung (+ optional Beschwerden), nicht aus Absolutwert.
  var bl=opts.baselineWeekly;
  if(bl!=null&&bl>0&&weekly>=bl*1.5&&weekly>=12)return R('large_increase','Deutlicher Anstieg');
  if(weekly<t.low)return R('below_target','Unter Zielbereich');
  if(weekly<=t.high)return R('in_target','Im Zielbereich');
  // Über Zielbereich: mit aktuellen Beschwerden klar als Warnung kennzeichnen (kein „normaler" Zustand).
  if(opts.hasComplaint)return{key:'above_target',label:'Über Zielbereich · Beschwerden beachten',color:'warn'};
  return R('above_target','Über Zielbereich');
}
/* ---- Aktivitätskorrektur (Phase 4.4): Plausibilität + atomares Verschieben zwischen Typ/Datum ----
   Plausibilität: warnt bei untypischen Werten (z.B. Lauf-Pace zu schnell → eher Radfahrt). */
function activityPlausibility(type,s){
  s=s||{};var dist=+s.dist||0,dur=+s.dur||0;
  var hasD=s.dist!=null&&s.dist!==''&&!isNaN(+s.dist);
  var hasT=s.dur!=null&&s.dur!==''&&!isNaN(+s.dur);
  // Generisch: negative/0-Werte bei gesetzten Feldern (gilt für jede Sportart).
  if(hasD&&dist<=0)return{warn:true,msg:'Distanz ist 0 oder negativ. Wert prüfen?'};
  if(hasT&&dur<=0)return{warn:true,msg:'Dauer ist 0 oder negativ. Wert prüfen?'};
  // HF-Konsistenz: max < Ø ist physiologisch unmöglich.
  var hr=+s.hr||0,hrMax=+s.hrmax||+s.hrMax||0;
  if(hr>0&&hrMax>0&&hrMax<hr)return{warn:true,msg:'HF max ('+hrMax+') ist kleiner als HF Ø ('+hr+'). Werte prüfen?'};
  // RPE-Bereich.
  if(s.rpe!=null&&s.rpe!==''&&(+s.rpe<1||+s.rpe>10))return{warn:true,msg:'RPE liegt außerhalb 1–10. Wert prüfen?'};
  if(type==='Laufen'&&dist>0&&dur>0){
    var pace=dur/dist; // min/km — UNABHÄNGIG von der Distanz prüfen (auch kurze GPS-Ausreißer).
    if(pace<2.4)return{warn:true,msg:'Diese Lauf-Pace ('+fmtPace(pace*60)+'/km) ist für einen Lauf unrealistisch schnell — eher Radfahrt oder Einheitenfehler? Sportart/Werte prüfen?'};
    if(pace>15)return{warn:true,msg:'Diese Lauf-Pace ('+fmtPace(pace*60)+'/km) ist sehr langsam — Distanz in km und Dauer in Minuten? Werte prüfen?'};
    var kmh=dist/(dur/60);
    if(kmh>26)return{warn:true,msg:'Diese Geschwindigkeit ('+kmh.toFixed(1)+' km/h) ist für einen Lauf ungewöhnlich hoch — eher Radfahrt? Sportart prüfen?'};
    if(dist>100)return{warn:true,msg:'Distanz '+dist+' km ist für einen Lauf sehr groß — Einheit (m statt km)? Werte prüfen?'};
  }
  if(type==='Rad'&&dist>0&&dur>0){
    var kmh2=dist/(dur/60);
    if(kmh2<6)return{warn:true,msg:'Diese Geschwindigkeit ('+kmh2.toFixed(1)+' km/h) ist für Radfahren sehr niedrig. Sportart prüfen?'};
    if(kmh2>80)return{warn:true,msg:'Diese Geschwindigkeit ('+kmh2.toFixed(1)+' km/h) ist für Radfahren unrealistisch hoch. Werte prüfen?'};
  }
  if(type==='Schwimmen'&&dist>0&&dur>0&&dist<50){
    return{warn:true,msg:'Schwimm-Distanz in Metern angeben (z.B. 1500). Werte prüfen?'};
  }
  return{warn:false,msg:''};
}
/* Zentrale Gültigkeitsprüfung für laufbezogene Auswertungen (Bestzeiten, Prognosen, Effizienz,
   Wochen-km, Pace, Meilensteine). EINE Quelle der Wahrheit — keine abweichenden Lokal-Checks.
   `run` = ein sessions.Laufen-Objekt (optional mit date). Gibt true nur für verlässliche Läufe. */
function isValidRunForAnalytics(run){
  if(!run)return false;
  // Explizit als ungültig/auszuschließen markiert oder unbestätigter Import mit Datenwarnung.
  if(run.invalid===true||run.excludeFromAnalytics===true||run.needsReview===true||run.duplicate===true)return false;
  // Falls die Sportart explizit am Datensatz hängt, muss sie Laufen sein.
  if(run.type&&run.type!=='Laufen')return false;
  if(run.sport&&run.sport!=='run'&&run.sport!=='Laufen')return false;
  var dist=+run.dist,dur=+run.dur;
  if(!(dist>0)||!(dur>0)||isNaN(dist)||isNaN(dur))return false;
  var pace=dur/dist; // min/km
  if(pace<2.4||pace>15)return false; // unrealistisch schnell (eher Rad) / unrealistisch langsam (Einheitenfehler)
  return true;
}
/* Effektiver Datensatz nach Patch (null = Feld löschen) — identische Semantik wie moveActivity,
   nutzbar für Vorab-Validierung/Plausibilität im Editor. */
function applyActivityPatchPreview(current,patch){
  var result=Object.assign({},current||{});
  var p=patch||{};
  for(var k in p){if(!Object.prototype.hasOwnProperty.call(p,k))continue;
    if(p[k]===null)delete result[k];else result[k]=p[k];}
  return result;
}
/* Lokale, konsistente Verschiebung einer Aktivität (Sportart/Datum) inkl. Patch — KEINE Supabase-Persistenz.
   - Zielkonflikt: existiert am Ziel bereits eine ANDERE Aktivität gleicher Sportart → KEIN
     stilles Überschreiben, Rückgabe {ok:false,code:'target_conflict'}.
   - Lösch-Semantik: patch-Felder mit Wert null werden im Zieldatensatz ENTFERNT (Altwert verschwindet).
   - Externe ID/Quelle/Route bleiben erhalten (src zuerst gemerged).
   Hinweis: Operiert nur auf dem lokalen DB-Modell (eine Aktivität je Sportart+Tag — siehe Roadmap 4.4). */
function moveActivity(map,fromDate,fromType,toDate,toType,patch){
  map=map||{};
  var src=(map[fromDate]&&map[fromDate].sessions&&map[fromDate].sessions[fromType])||null;
  if(!src)return{ok:false,code:'not_found',map:map};
  var sameSlot=(fromDate===toDate&&fromType===toType);
  var target=(map[toDate]&&map[toDate].sessions&&map[toDate].sessions[toType])||null;
  if(!sameSlot&&target&&target!==src)return{ok:false,code:'target_conflict',map:map};
  var merged=Object.assign({},src);
  patch=patch||{};
  for(var k in patch){if(!Object.prototype.hasOwnProperty.call(patch,k))continue;
    if(patch[k]===null){delete merged[k];}      // explizites Löschen eines Feldes
    else{merged[k]=patch[k];}                    // setzen/überschreiben
  }
  if(map[fromDate]&&map[fromDate].sessions){delete map[fromDate].sessions[fromType];map[fromDate].sessions._ts=Date.now();}
  map[toDate]=map[toDate]||{};map[toDate].sessions=map[toDate].sessions||{};
  map[toDate].sessions[toType]=merged;map[toDate].sessions._ts=Date.now();
  return{ok:true,map:map};
}
function racePhase(d){
  if(d<0)return'Nach dem Rennen';if(d===0)return'RACE DAY!';
  if(d<=13)return'Taper — Frische aufbauen';if(d<=34)return'Peak-Phase — höchste Last';return'Aufbau-Phase';
}

/* ---- Trend ohne Überlappung (Fix) ---- */
function trendDir(a){
  if(a.length<4)return'';
  const half=Math.floor(a.length/2);
  const h=avg(a.slice(0,half)),t=avg(a.slice(-half));
  if(t==null||h==null)return'';
  if(t<h-0.3)return'besser';if(t>h+0.3)return'schlechter';return'stabil';
}

/* ============ RECOVERY ENGINE V2 ============
   readiness(m, ctx) — ctx liefert Baselines:
   { hrvBase7, hrvSd28, hrvN, rhrBase, sleepDebtH, hrvLowStreak }
   Fehlende Komponenten werden NICHT mit Defaults gefüllt, sondern aus der
   Gewichtung entfernt und renormalisiert (ehrlicher Score). */
/* v8-317 · EINE Lesart von Garmins HRV-Status im ganzen Produkt.
   Garmin kennt Balanced · Unbalanced · Low · Poor (kein 'Good'). Vorher wurde
   an fuenf Stellen `hrv==='Low'` verglichen — 'Poor' (schlechter als Low!) fiel
   damit ueberall durch und landete faelschlich in besseren Zustaenden als 'Low'.
   Genau das hat die Gegenprobe zu v8-317 aufgedeckt. 'Unbalanced' zaehlt
   bewusst NICHT als schlecht: es heisst leicht neben der eigenen Baseline. */
function hrvBelowBaseline(h){var x=String(h||'').toLowerCase();return x==='low'||x==='poor';}
function hrvScoreOf(m,ctx){
  if(m.hrvMs&&ctx&&ctx.hrvN>=14&&ctx.hrvBase7!=null&&ctx.hrvSd28!=null&&ctx.hrvSd28>0){
    const ln=Math.log(m.hrvMs),swc=0.5*ctx.hrvSd28; // smallest worthwhile change
    if(ln>=ctx.hrvBase7-swc)return 100;
    if(ln>=ctx.hrvBase7-2*swc)return 60;
    return 25;
  }
  /* v8-317 · GARMINS ECHTE KATEGORIEN. Garmin kennt VIER Zustände:
     Balanced · Unbalanced · Low · Poor. Ein 'Good' gibt es NICHT — der frühere
     100er-Zweig war toter Code, und damit war über diesen Pfad bei 88 Schluss:
     eine der Ursachen dafür, dass der Tagesscore nie 100 erreichen konnte.
     Zweiter Fehler: 'Unbalanced' und 'Low' wurden gemeinsam auf 45 gelegt.
     Das sind aber verschiedene Aussagen — 'Unbalanced' heißt „7-Tage-Schnitt
     LEICHT über ODER unter der eigenen Baseline", 'Low' heißt „deutlich
     darunter". Beides gleich zu bestrafen macht den häufigsten Zwischenzustand
     zum Alarm. 'Poor' (unter der Altersnorm) war überhaupt nicht behandelt und
     fiel auf null — die HRV verschwand dann still aus der Gewichtung.
     Der gemessene Pfad oben bleibt vorrangig: er ist gegen die EIGENE,
     mitwachsende Baseline gerechnet und kann 100 erreichen. */
  if(m.hrv){
    var _h=String(m.hrv).toLowerCase();
    if(_h==='balanced')return 92;
    if(_h==='unbalanced')return 62;
    if(_h==='low')return 38;
    if(_h==='poor')return 22;
    return null;                    /* unbekannte Kennung: nicht raten, aus der Gewichtung nehmen */
  }
  return null;
}
function readiness(m,ctx){
  ctx=ctx||{};
  const comps=[];
  const add=(name,score,w)=>{if(score!=null&&!isNaN(score))comps.push([name,clampC(score,0,100),w]);};
  /* v8-317 · SCHMERZ ZAEHLT, EGAL WO (Gians Huefte).
     Vorher stand hier ausschliesslich m.knee — die Readiness kannte nur den
     Knieschmerz. Gians Hueftbeschwerden liefen ueber e.issues in die
     ENTSCHEIDUNG, erreichten die READINESS aber nie: der Rohwert blieb bei
     jeder Hueftstufe identisch, und nur der Zustandsdeckel bewegte die Zahl.
     Genau deshalb wirkte die Anpassung wie eine Treppe.
     ctx.painToday ist der groesste erfasste Schmerz des Tages ueber ALLE
     Regionen (Knie eingeschlossen); fehlt er, bleibt es beim bisherigen
     Knie-Wert — kein Verhaltenswechsel fuer Aufrufer ohne diese Angabe. */
  var _painToday=(ctx&&ctx.painToday!=null)?ctx.painToday:m.knee;
  if(m.knee!=null&&(_painToday==null||m.knee>_painToday))_painToday=m.knee;
  add('Schmerz',_painToday!=null?(10-_painToday)/10*100:null,25);
  const hrvS=hrvScoreOf(m,ctx);add('HRV',hrvS,20);
  // Allgemeinbefinden — subjektiv stark gewichtet (war zuvor gar nicht enthalten).
  if(m.feel!=null)add('Befinden',m.feel*10,18);
  /* ═══ v8-318 · SCHLAF GEGEN DEN EIGENEN BEDARF ═══════════════════════
     Vorher: feste Rampe von 5 h (=0) bis 8 h (=100). Wer gewohnheitsmaessig
     7 h braucht und 7 h schlaeft, bekam damit dauerhaft 67 — obwohl er
     ausgeschlafen ist. Das ist genau die „feste Idealwert"-Logik, die Gian
     beanstandet hat.
     Jetzt: liegt eine eigene Historie vor (>=14 Tage, ctx.sleepBase), wird
     gegen den EIGENEN Median gerechnet. Auf oder ueber dem eigenen Bedarf
     = 100; darunter faellt es mit der EIGENEN Streuung (sleepSd), nicht mit
     einer fremden Zahl. Die Streuung wird nach unten auf 30 min begrenzt,
     damit ein sehr regelmaessiger Schlaefer nicht fuer 10 Minuten abgestraft
     wird, und nach oben auf 120 min, damit eine chaotische Historie die
     Bewertung nicht bedeutungslos macht.
     OHNE eigene Historie bleibt ALLES wie bisher — kein erfundener Bezug. */
  /* ═══ v9 · EIN SCHLAFBLOCK STATT VIER POSTEN ═══════════════════════════
     BEFUND (Gian, 16.08.): Schlaf war mit VIER Posten und zusammen 32 von 138
     Gewichtspunkten (23 %) die groesste Gruppe im Score — mehr als HRV — und
     zeigte gleichzeitig zwei fast gleich benannte Zeilen („Schlafqualitaet 76"
     und „Schlafqualitaet 80"). Fachlich ist das eine Mehrfachzaehlung
     DERSELBEN Nacht: Garmins Sleep Score enthaelt Dauer und Phasen bereits.
     NEU, wenn ein gemessener Sleep Score vorliegt: der Score fuehrt (14), das
     7-Tage-Konto bleibt als eigenstaendige, kumulative Information (6, vorher
     12) und das Empfinden traegt, was kein Geraet sieht (5). Die Phasen
     entfallen dann — sie stecken im Score. Summe 25 statt 32 (≈ 19 %).
     OHNE gemessenen Score bleibt die alte Struktur unveraendert (12/14/6).
     Das Konto skaliert jetzt mit 8 statt 12 Punkten je Stunde Wochendefizit:
     mit 12 war bei 8,3 h Defizit Schluss (0 Punkte) — das ist bei einem
     7-Nacht-Fenster kein Ausnahmefall, sondern eine normale harte Woche. */
  var _hasSleepScore=(ctx.sleepScore!=null&&ctx.sleepScore>=0&&ctx.sleepScore<=100);
  var _wKonto=_hasSleepScore?6:12;
  if(ctx.sleepDebtH!=null)add('Schlaf-Konto',100-ctx.sleepDebtH*8,_wKonto);
  else if(m.sleepMin!=null&&ctx.sleepBase>0){
    var _sd=(ctx.sleepSd!=null&&ctx.sleepSd>0)?ctx.sleepSd:60;
    _sd=clampC(_sd,30,120);
    var _def=ctx.sleepBase-m.sleepMin;
    add('Schlafdauer',_def<=0?100:clampC(100-(_def/_sd)*30,0,100),_wKonto);
  }
  else if(m.sleepMin!=null)add('Schlafdauer',clampC((m.sleepMin-300)/180,0,1)*100,_wKonto);
  /* ═══ v8-319 · GARMINS SLEEP SCORE UND DIE SCHLAFPHASEN ═══════════════
     Gians Vorgabe: „Der muss den Sleep Score bewerten." Der Wert wurde bisher
     nur ANGEZEIGT und floss in keine Bewertung ein.

     DOPPELZAEHLUNG VERMEIDEN — der Grund fuer die Gewichtsverschiebung:
     Garmins Sleep Score enthaelt Dauer und Phasen bereits. Ihn zusaetzlich zur
     subjektiven Schlafqualitaet mit vollem Gewicht zu fuehren, wuerde denselben
     Sachverhalt zweimal zaehlen. Deshalb: liegt der gemessene Score vor, teilen
     sich beide das bisherige Gewicht 14 (gemessen 9, subjektiv 5) — die
     Messung fuehrt, das Empfinden bleibt als eigenstaendige Information
     erhalten (es traegt, was kein Geraet sieht). Ohne gemessenen Score bleibt
     die subjektive Angabe bei ihren vollen 14.

     SCHLAFPHASEN als EIGENER, KLEINER Beitrag: bewertet wird der Anteil aus
     Tief- und REM-Schlaf gegen die EIGENE Verteilung (Median 28 Naechte), nicht
     gegen eine Lehrbuchzahl. Der absolute Minutenwert haengt an der Dauer und
     waere schon im Sleep Score enthalten; der ANTEIL relativ zur eigenen Norm
     ist die zusaetzliche Information. Gewicht bewusst nur 6: die Phasenerkennung
     am Handgelenk ist die unsicherste der hier verwendeten Groessen. */
  /* v9: eindeutige Namen. Vorher standen „Schlafqualitaet (gemessen) 76" und
     „Schlafqualitaet 80" untereinander — nicht unterscheidbar. */
  if(_hasSleepScore)add('Schlaf-Score (Gerät)',ctx.sleepScore,14);
  if(m.sleepQ!=null)add('Schlafgefühl',m.sleepQ*10,_hasSleepScore?5:14);
  /* v9: Die Phasen zaehlen nur noch OHNE gemessenen Sleep Score — mit Score
     waeren sie dieselbe Nacht ein zweites Mal (Garmin rechnet sie dort ein). */
  if(!_hasSleepScore&&ctx.phaseShareToday>0&&ctx.phaseShareBase>0){
    /* Auf oder ueber der eigenen ueblichen Tief-/REM-Quote = voll. Darunter
       faellt es proportional; 30 % relative Abweichung entspricht 0. */
    var _rel=ctx.phaseShareToday/ctx.phaseShareBase;
    add('Schlafphasen',_rel>=1?100:clampC(100-(1-_rel)*333,0,100),6);
  }
  /* ═══ v9 · STRESS AUS DEM GEMESSENEN TAGESWERT ═════════════════════════
     BEFUND (Gian, 16.08.): „Da muss Low, Medium und so was weg — der Stress
     von der Uhr kann direkt reinberechnet werden." Korrekt: `stress_avg`
     liegt als 0–100-Metrik vor (metric-registry.js:114) und wurde im Score
     nicht benutzt. Die Kategorien erzeugten Spruenge von 40 Punkten an einer
     willkuerlichen Grenze (Low 100 → Med 60), obwohl der Unterschied zwischen
     Stress 50 und 51 physiologisch keiner ist.
     SKALA (Garmins eigene Einteilung: 0–25 Ruhe, 26–50 niedrig, 51–75 mittel,
     76–100 hoch): bis 25 volle Punkte, darueber linear fallend, 100 = 0.
     Die Kategorien bleiben als Fallback fuer Tage ohne gemessenen Wert. */
  if(ctx.stressAvg!=null&&isFinite(ctx.stressAvg))add('Stress',clampC(100-Math.max(0,ctx.stressAvg-25)*1.34,0,100),8);
  else if(m.stress)add('Stress',m.stress==='Low'?100:m.stress==='Med'?60:25,8);
  let rhrDev=null;
  // Ruhepuls NUR gegen die ECHTE persönliche Baseline des Nutzers bewerten (≥7 eigene Tage).
  // Ohne persönliche Baseline: kein Score-Beitrag (Cold-Start senkt Konfidenz, nicht den Score).
  // Nur erhöhter Ruhepuls zählt negativ; unter der Baseline ist neutral/gut.
  const rhrB=(ctx.rhrBase!=null)?ctx.rhrBase:null;
  /* ═══ v9 · RUHEPULS AN DER EIGENEN STREUUNG, NICHT AN 11 PUNKTEN/SCHLAG ══
     BEFUND (Gian, 16.08.): Ruhepuls 89 bei EINEM Schlag ueber der Baseline.
     Der feste Faktor 11 bedeutete: +1 bpm = -11 Punkte, +5 bpm = -45. Die
     normale Nacht-zu-Nacht-Streuung des Ruhepulses liegt aber bei mehreren
     Schlaegen (Raumtemperatur, letzte Mahlzeit, Alkohol, Messposition) — der
     Score bestrafte damit ueberwiegend Rauschen und war beim ersten echten
     Signal laengst am Boden.
     NEU: Abweichung in EIGENEN Streuungseinheiten. 1 Standardabweichung ueber
     der Baseline kostet 20 Punkte; erst ~2 SD (die uebliche Signalgrenze) sind
     es 40. ctx.rhrSd kommt aus derselben 28-Tage-Historie wie die Baseline und
     wird auf 1,5–5 bpm begrenzt: darunter wuerde ein extrem konstanter
     Schlaefer fuer jeden Schlag bestraft, darueber verlaere die Groesse ihre
     Warnfunktion. Ohne eigene Streuung: 3 bpm (konservativer Ersatzwert). */
  if(m.rhr!=null&&rhrB!=null){
    rhrDev=m.rhr-rhrB;
    var _rsd=(ctx.rhrSd!=null&&isFinite(ctx.rhrSd)&&ctx.rhrSd>0)?clampC(ctx.rhrSd,1.5,5):3;
    add('Ruhepuls',100-clampC(Math.max(rhrDev,0)/_rsd,0,5)*20,15);
  }
  /* v8-317 · MUSKELKATER IST REGIONAL, NICHT GLOBAL (Gians Befund).
     „Wenn ich gestern Beine trainiert habe und heute Oberkörper dran ist und
     Muskelkater 7 habe, darf der Score das nicht so ändern, dass ich keinen
     Oberkörper machen kann." Genau richtig: Beinmuskelkater sagt nichts über
     die Belastbarkeit des Oberkörpers. Die Entscheidungsseite wusste das
     bereits (evaluateDomsImpact prüft Region gegen die geplante Einheit) —
     der SCORE nicht, er zog pauschal ab.
     Jetzt: trifft der Muskelkater die heutige Belastung nicht, bleibt er
     drin, aber mit deutlich kleinerem Gewicht (3 statt 10). Er verschwindet
     NICHT ganz — starker Muskelkater bedeutet auch systemische Ermüdung —,
     aber er dominiert den Tag nicht mehr. Ohne bekannte Region bleibt es beim
     alten, konservativen Verhalten (volles Gewicht). */
  if(m.doms!=null){
    var _domsW=10;
    if(ctx&&ctx.domsHitsToday===false&&m.domsRegion)_domsW=3;
    /* v9: „DOMS" heisst jetzt ueberall „Muskelkater". Gian, 16.08.: „DOMS,
       weiss ich grad nicht, was es ist." Die Entscheidungsseite schrieb
       laengst „Muskelkater" (dayStateEngine-Reasons) — nur der Score nicht. */
    add('Muskelkater',(10-m.doms)*10,_domsW);
  }
  /* v8-318 · BODY BATTERY GEGEN DEN EIGENEN MORGENWERT. Der Rohwert ist
     zwischen Personen nicht vergleichbar: wessen Morgenwert typischerweise
     bei 75 liegt, erreichte nie die vollen Punkte. Mit eigener Historie
     (>=14 Tage) zaehlt die Abweichung vom eigenen Median — auf oder ueber
     dem eigenen Normalwert = 100. Ohne Historie bleibt es beim Rohwert.
     Gewicht unveraendert 10 (Garmin-Komposit, sonst Doppelzaehlung). */
  if(m.bb!=null){
    if(ctx.bbBase>0)add('Body Battery',m.bb>=ctx.bbBase?100:clampC(100-(ctx.bbBase-m.bb)*2.2,0,100),10);
    else add('Body Battery',m.bb,10);
  }
  const W=comps.reduce((s,c)=>s+c[2],0)||1;
  let score=Math.round(comps.reduce((s,c)=>s+c[1]*c[2],0)/W);
  // Harter Schmerz-Cap: akuter Knie-Schmerz darf nie im grünen Band landen,
  // egal wie gut der Rest aussieht (verletzungsdominante Logik).
  if((m.knee??0)>=6)score=Math.min(score,40);
  else if((m.knee??0)>=4)score=Math.min(score,65);
  const band=score>=75?'g':score>=45?'y':'r';
  const color=band==='g'?'#34d399':band==='y'?'#fbbf24':'#fb4d6d';
  const lim=comps.slice().sort((a,b)=>a[1]-b[1]).slice(0,2).filter(p=>p[1]<70).map(p=>p[0]);
  return{score,band,color,lim,hrvScore:hrvS,rhrDev,parts:comps};
}

/* ---- Ampel v2: nach limitierendem Faktor differenziert ----
   R1.3 · HISTORICAL-DECISION-API: ampel() ist AUSSCHLIESSLICH die dokumentierte
   Einstufung für VERGANGENE Tage (renderAmpel/renderReadiness) und retrospektive
   Analysen (insights Decision-Memory). Die HEUTIGE Trainingsfreigabe kommt einzig
   aus Calc.buildTrainingDecision über getDecision() — kein neuer Heute-Konsument
   dieser Funktion. */
function ampel(m,r,ctx){
  ctx=ctx||{};
  const autonomBad=(r.hrvScore!=null&&r.hrvScore<=25)||(r.rhrDev!=null&&r.rhrDev>=5);
  const hrvDouble=(r.hrvScore!=null&&r.hrvScore<=25)&&((r.rhrDev!=null&&r.rhrDev>=4)||(ctx.hrvLowStreak||0)>=2);
  if((m.knee??0)>=6||r.score<45||(m.feel!=null&&m.feel<=4)||hrvDouble){
    const w=[];
    if((m.knee??0)>=6)w.push('Knie ≥6/10 — akute Reizung');
    if(m.feel!=null&&m.feel<=4)w.push('Befinden ≤4/10');
    if(r.score<45)w.push('Readiness '+r.score+'% — Erholung fehlt');
    if(hrvDouble)w.push('HRV gedrückt + zweiter Marker (RHR/2. Tag)');
    return{c:'r',t:'ROT — Regenerieren',why:w,
      rec:'Kein strukturiertes Training. Max. 20 min lockere Mobilität. Fokus: Schlaf, Protein, Hydration.'};
  }
  if(r.score>=75&&(m.knee??0)<=2&&!autonomBad){
    return{c:'g',t:'GRÜN — Trainieren',why:['Readiness '+r.score+'%','Knie ≤2/10','Autonomes System im Korridor'],
      rec:'Plan durchziehen — auch Quality. Nach dem Lauf Knie POST checken; bei Reaktion nächste Einheit lockerer.'};
  }
  // GELB: Empfehlung hängt am Limitfaktor
  const why=[];let rec;
  if((m.knee??0)>=3){why.push('Knie '+m.knee+'/10 — Vorsicht');
    rec='Kein Laufen, kein Beintraining mit Last. Oberkörper, Schwimmen Technik oder Rad Z1–Z2 sind frei.';}
  else if(autonomBad||r.hrvScore===60||(r.rhrDev!=null&&r.rhrDev>=3)){why.push('Autonomes System gedrückt (HRV/RHR)');
    rec='Easy-Lauf bis 40 min Z2 erlaubt — KEINE Intensität. Quality auf morgen schieben, nicht streichen.';}
  else{why.push('Readiness '+r.score+'% — Werte gemischt');
    rec='Volumen reduzieren: geplante Einheit eine Stufe leichter (kürzer oder langsamer), keine neuen Reize.';}
  return{c:'y',t:'GELB — Reduzieren',why,rec};
}

/* ============ GOAL ENGINE — HM <Ziel, ehrlich ============
   runs42: chronologisch, letzte 42 Tage [{date,sub,dist,dur,hr}]
   opts: {daysToRace, targetMin, avg4WeekKm, targetWeekKm, lrMax28, ctlNow, ctlPrev28, trackingWeeks} */
/* GM7.9i: Riegel fuer eine BELIEBIGE Zieldistanz — additive Verallgemeinerung der bereits
   vorhandenen Halbmarathon-Variante. Identische Formel, identischer Exponent (1.06);
   riegelHM() besteht ab jetzt aus dieser Funktion und verhaelt sich unveraendert
   (riegelHM(d,t) === riegel(d,t,HM_KM), per Test belegt). Keine neue Fachlogik. */
function riegel(distKm,durMin,targetKm){
  if(!(distKm>0)||!(durMin>0)||!(targetKm>0))return null;   // E2: keine Division durch 0 / kein NaN
  return durMin*Math.pow(targetKm/distKm,1.06);
}
function riegelHM(distKm,durMin){return riegel(distKm,durMin,HM_KM);}
function goalEngine(runs42,opts){
  const o=opts||{};const target=o.targetMin||TARGET_MIN_DEFAULT;
  const valid=runs42.filter(r=>r.dist>0&&r.dur>0);
  const quality=valid.filter(r=>['Tempo','Long Run','Intervalle'].includes(r.sub)&&r.dist>=4);
  const tempo=quality.filter(r=>r.sub==='Tempo');
  const bestTempoPace=tempo.length?Math.min(...tempo.map(r=>r.dur/r.dist)):null;
  const usable=quality.filter(r=>r.sub!=='Intervalle'||(r.dist>=6&&bestTempoPace&&(r.dur/r.dist)<1.05*bestTempoPace));
  // Mindestdaten-Gate
  if(valid.length<6||usable.length<2||(o.trackingWeeks||0)<3){
    return{state:'nodata',need:'≥6 Läufe in 42 Tagen, davon ≥2 Quality (Tempo/Long ≥4 km), ≥3 Wochen Tracking',
      nRuns:valid.length,nQuality:usable.length};
  }
  // Schätzer A: Riegel aus bester Quality-Einheit
  const tRiegel=Math.min(...usable.map(r=>riegelHM(r.dist,r.dur)));
  // Schätzer B: EF-Korridor aus Easy-Z2 (HF 65–78% HFmax), +5% Sicherheitsaufschlag.
  // Nur wenn HFmax bekannt (gemessen oder altersbasiert) — sonst KEINE HF-basierte Schätzung.
  const hm=_hrMax();
  const easy=hm!=null?valid.filter(r=>r.sub==='Easy Z2'&&r.hr>=Math.round(0.65*hm)&&r.hr<=Math.round(0.78*hm)&&r.dist>=4):[];
  let tEF=null;
  if(hm!=null&&easy.length>=3){
    const efs=easy.slice(-7).map(r=>(r.dist*1000/r.dur)/r.hr);
    const efm=median(efs);
    if(efm){const vRace=efm*Math.round(0.88*hm);tEF=(HM_KM*1000/vRace)*1.05;}
  }
  const tPred=tEF?0.7*tRiegel+0.3*Math.max(tRiegel,tEF):tRiegel;
  // Vetos (Volumen-Gates)
  const vetos=[];
  const d=o.daysToRace??99;
  const lrNeed=d>28?14:d>14?17:0;
  if(lrNeed&&(o.lrMax28||0)<lrNeed)vetos.push('Long Run: max. '+(o.lrMax28||0).toFixed(0)+' km in 28T, nötig ≥'+lrNeed+' km');
  // I2c: Volumen-Veto NUR bei bekanntem avg4WeekKm. Unbekannt ⇒ kein erfundener Mangel,
  // stattdessen not_assessable + reduzierte Confidence (Missingness bis zur Prognose).
  var _volKnown=(o.avg4WeekKm!=null&&isFinite(o.avg4WeekKm));
  var notAssessable=[];
  if(!_volKnown)notAssessable.push('Volumen (Ø 4 Wochen)');
  if(o.targetWeekKm&&_volKnown&&o.avg4WeekKm<0.75*o.targetWeekKm)vetos.push('Volumen: Ø '+o.avg4WeekKm.toFixed(0)+' km/Wo unter 75% des Solls');
  // I3a.3: CTL-Trend-Veto nur als HARTES Veto, wenn die zugrunde liegende Lastserie
  // ausreichend belastbar ist (Wiederverwendung der bestehenden Last-Confidence aus
  // allLoads()/dailyLoadSeries via ui.js buildGoal() -> opts.loadConfidence; KEINE
  // zweite parallele Confidence-Logik). 'hoch' (oder fehlend = Rückwärtskompatibilität):
  // bisheriges Verhalten. 'reduziert': kein hartes Veto, nur strukturierter Hinweis
  // ctl_trend_estimated. 'not_assessable': Vergleich wird ausgelassen, Missingness-Grund
  // ctl_trend_not_assessable. Unbekannte/nicht belastbare Last wird NIE zu 0 oder zu
  // einem erfundenen 'Fitness sinkt'.
  // I3a.4: CTL-Trend-Veto FAIL-CLOSED. Nur EXPLIZIT gültige Last-Confidence wird akzeptiert;
  // fehlendes, unbekanntes oder ungültiges loadConfidence wird NICHT als 'hoch' behandelt
  // (kein `||'hoch'`-Null-Koaleszenz-Fallback), sondern konservativ als nicht belastbar mit
  // strukturiertem Reason-Code. Nur 'hoch' erlaubt das harte CTL-Trend-Veto; 'reduziert' nur
  // den geschätzten Hinweis (ctl_trend_estimated); 'not_assessable' kein Veto
  // (ctl_trend_not_assessable). Wiederverwendung der bestehenden Last-Confidence aus
  // allLoads()/dailyLoadSeries via ui.js buildGoal() -> opts.loadConfidence; KEINE zweite
  // parallele Confidence-Logik, keine erfundenen Werte.
  var _lcRaw=o.loadConfidence;
  var _confValid=(_lcRaw==='hoch'||_lcRaw==='reduziert'||_lcRaw==='not_assessable');
  var _ctlHave=(o.ctlNow!=null&&o.ctlPrev28!=null);
  var ctlTrend={status:(_confValid?_lcRaw:'not_assessable'),reason:null};
  if(_ctlHave){
    if(!_confValid){
      ctlTrend.reason=(_lcRaw==null?'load_confidence_missing':'load_confidence_invalid');
      notAssessable.push('Fitness (CTL) — Last-Confidence fehlt/ungültig, nicht belastbar');
    }else if(_lcRaw==='not_assessable'){
      ctlTrend.reason='ctl_trend_not_assessable';
      notAssessable.push('Fitness (CTL) — Lastserie nicht belastbar');
    }else if(_lcRaw!=='hoch'){
      ctlTrend.reason='ctl_trend_estimated';
      if(o.ctlNow<=o.ctlPrev28)notAssessable.push('Fitness (CTL) seit 4 Wochen nicht steigend (geschätzt, kein hartes Veto)');
    }else{
      if(o.ctlNow<=o.ctlPrev28)vetos.push('Fitness (CTL) seit 4 Wochen nicht steigend');
    }
  }
  // Bänder
  const delta=(target-tPred)/target;
  let state='ontrack';
  if(delta<-0.03||vetos.length>=2)state='risk';
  else if(delta<0.02||vetos.length===1)state='border';
  return{state,tPred:+tPred.toFixed(1),tRiegel:+tRiegel.toFixed(1),tEF:tEF?+tEF.toFixed(1):null,
    delta:+(delta*100).toFixed(1),vetos,notAssessable:notAssessable,ctlTrend:ctlTrend,
    assessable:{volume:_volKnown},confidence:notAssessable.length?'reduziert':'hoch',
    nRuns:valid.length,nQuality:usable.length,target};
}

/* ============ RUNNING ANALYTICS ============ */
/* 80/20: Easy-Anteil an der Laufzeit, 28T.
   KF-010-Fix: Reine Garmin-/Store-Laeufe tragen sub:'' — vorher zaehlten sie
   pauschal als NICHT-easy und verzerrten den Anteil systematisch nach unten
   (E-11: easyShare ist Dimension B, physiologische Zonen — nicht RPE).
   Neue Regel:
     • sub-Label vorhanden → wie bisher (Easy-Liste vs. Quality-Label).
     • kein sub, aber Ø-HF und HFmax bekannt → easy bei HF ≤ 78 % HFmax,
       hart bei HF ≥ 82 % HFmax (derselbe Easy-Z2-Korridor wie efSeries).
     • weder Label noch HF (oder HF im Graubereich 78–82 %) → der Lauf ist
       NICHT klassifizierbar und faellt aus Zaehler UND Nenner — er wird nie
       stillschweigend einer Seite zugeschlagen.
   Mindestbasis unveraendert: 6 klassifizierbare Laeufe, sonst null. */
function easyShareDetail(runs28){
  const t=(runs28||[]).filter(r=>r&&r.dur>0);
  const hm=_hrMax();
  const cls=[];
  t.forEach(r=>{
    if(r.sub){cls.push({dur:r.dur,easy:['Walk-Run','Easy Z2','Long Run'].includes(r.sub)});return;}
    if(hm!=null&&r.hr!=null&&r.hr>0){
      if(r.hr<=0.78*hm)cls.push({dur:r.dur,easy:true});
      else if(r.hr>=0.82*hm)cls.push({dur:r.dur,easy:false});
      /* 78–82 %: Graubereich — bewusst unklassifiziert */
    }
  });
  const tot=cls.reduce((s,r)=>s+r.dur,0);
  const easy=cls.filter(r=>r.easy).reduce((s,r)=>s+r.dur,0);
  /* Phase 2.0: Abdeckung fuer den Metrik-Envelope — der Nenner enthaelt NUR
     klassifizierbare Laeufe; wie viele das von allen sind, wird ausgewiesen. */
  return {share:(tot&&cls.length>=6)?easy/tot:null,
    totalRuns:t.length,classifiedRuns:cls.length,
    classifiedMin:Math.round(tot),easyMin:Math.round(easy),
    hrMaxUsed:hm};
}
function easyShare(runs28){return easyShareDetail(runs28).share;}
/* Wochensprung: diese Woche vs. letzte */
function weeklyJump(kmThis,kmLast){
  const ratio=kmThis/Math.max(kmLast,5);
  if(ratio>1.25)return{lvl:'r',ratio,msg:'Umfangssprung +'+Math.round((ratio-1)*100)+'% — bekanntes Patella-Rezidiv-Muster. Sofort deckeln.'};
  if(ratio>1.10)return{lvl:'y',ratio,msg:'Umfang +'+Math.round((ratio-1)*100)+'% vs. Vorwoche — über der 10%-Regel.'};
  return{lvl:'g',ratio,msg:null};
}
/* Long-Run-Soll nach Wochen bis Race */
function lrTarget(weeksToRace){
  if(weeksToRace>=10)return[12,14];if(weeksToRace>=6)return[14,16];
  if(weeksToRace>=3)return[16,19];return[8,12];
}
/* HF-Spread-Proxy (echte Drift bräuchte Splits) */
function hrSpread(run){
  if(!run||!run.hr||!run.hrmax)return null;
  return (run.hrmax-run.hr)/run.hr;
}
/* Easy-zu-hart-Check pro Einheit */
function easyTooHard(run){
  const hm=_hrMax(); if(hm==null)return false; // ohne HFmax keine HF-Bewertung (kein 190-Fallback)
  return run&&run.sub==='Easy Z2'&&run.hr&&run.hr>Math.round(0.78*hm);
}
/* EF nur aus Easy-Z2 (Fix: vorher alle Lauftypen gemischt → Rauschen) */
function efSeries(runsAll){
  const hm=_hrMax(); if(hm==null)return []; // ohne HFmax keine EF-Serie (kein 190-Fallback)
  return runsAll
    .filter(r=>r.sub==='Easy Z2'&&r.dist>=3&&r.dur>0&&r.hr>=Math.round(0.65*hm)&&r.hr<=Math.round(0.78*hm))
    .map(r=>({date:r.date,ef:+(((r.dist*1000/r.dur))/r.hr).toFixed(2)}));
}
/* "Nächster Lauf" — Regelkette, erste zutreffende gewinnt */
function nextRunRec(p){
  // p={ampelC, lastRun:{sub,knee,daysAgo,morningKnee}, planToday:'Intervalle'|'Z2'|'Long'|null, readiness, heavyLegsYesterday, heavyLegs2d, doms, legs}
  if(p.ampelC==='r')return{run:false,txt:'Heute kein Lauf — Ampel rot. Recovery oder Alternativtraining.'};
  // ORANGE: reduzieren/ersetzen — KEIN „kein Lauf", konsistent mit Badge „Anpassen/Ersetzen".
  if(p.ampelC==='o')return{run:true,txt:'Heute Belastung reduzieren — geplante Einheit kürzer oder leichter. Bei Knie-/Gelenkreizung stattdessen gelenkschonendes Alternativtraining.'};
  if(p.lastRun&&p.lastRun.knee!=null&&p.lastRun.morningKnee!=null&&p.lastRun.knee-p.lastRun.morningKnee>=2)
    return{run:true,txt:'Knie hat auf den letzten Lauf reagiert (+'+(p.lastRun.knee-p.lastRun.morningKnee)+'): nur Easy, −20% Distanz, kein Quality.'};
  const quality=p.planToday&&/Intervalle|Tempo|Long/.test(p.planToday);
  if(quality&&p.lastRun&&/Intervalle|Tempo|Long/.test(p.lastRun.sub||'')&&p.lastRun.daysAgo<2)
    return{run:true,txt:'Letzter Quality-Lauf <48h her — heute nur Easy, Quality morgen.'};
  if(quality&&p.heavyLegsYesterday)
    return{run:true,txt:'Gestern schweres Beintraining — Quality auf Easy gleicher Dauer downgraden.'};
  if(quality&&p.heavyLegs2d&&((p.doms??0)>3||(p.legs??10)<6))
    return{run:true,txt:'Beine noch nicht erholt (DOMS/Kraft) — Quality nur, wenn es sich im Warm-up gut anfühlt, sonst Easy.'};
  if(quality&&p.readiness>=75)return{run:true,txt:p.planToday+' nach Plan — Readiness gibt grünes Licht.'};
  if(quality&&p.readiness>=50)return{run:true,txt:'Readiness '+p.readiness+'%: '+p.planToday+' auf Easy gleicher Dauer downgraden. Verschieben, nicht streichen.'};
  if(p.planToday)return{run:true,txt:p.planToday+' nach Plan.'};
  return{run:true,txt:'Kein Lauf geplant — optional Easy Z2, wenn Knie ≤2 und Lust da.'};
}

/* ---- Gym-Bein-Interferenz ---- */
function heavyLegs(gymSession){
  if(!gymSession||!Array.isArray(gymSession.sub))return false;
  if(!gymSession.sub.includes('Beine'))return false; // Glute/VMO-Reha zählt bewusst nicht
  return (gymSession.rpe??5)>=7||(gymSession.sets??0)>=15;
}

/* ---- Schlafschuld 7T (h) ---- */
/* ═══ v8-318 · SCHLAFSCHULD GEGEN DEN EIGENEN BEDARF ═══════════════════
   VORHER: `480-x` — acht Stunden als fest verdrahteter Sollwert fuer jeden.
   Wer gewohnheitsmaessig 7 h schlaeft, sammelte damit JEDE Nacht 1 h
   „Schuld": 7 h pro Woche, Score-Beitrag 100 − 7·12 = 16 statt 100. Dauerhaft
   und unbehebbar, ausser er schlaeft ab sofort jede Nacht 8 h. Bei Gewicht 12
   zieht das den Tagesscore um rund 8 Punkte — und zwar JEDEN Tag gleich.
   Das ist einer der Gruende fuer die konstante Zahl, die Gian beschrieben hat.

   JETZT: `needMin` ist der EIGENE gewohnheitsmaessige Bedarf (Median der
   letzten 28 Tage, aus recoveryCtx).

   [A] ANNAHME, DIE HIER BEWUSST GETROFFEN WIRD: Der eigene Median darf NICHT
   unbegrenzt nach unten wandern. Sonst wuerde chronischer Schlafmangel sich
   selbst zur Norm erklaeren und die Schuld verschwinden — die Zahl waere dann
   angenehm und falsch. Deshalb wird die Referenz auf 7–8 h begrenzt: wer
   gewohnheitsmaessig 7 h schlaeft, wird an 7 h gemessen (Gians Punkt); wer
   chronisch 5 h schlaeft, weiterhin an 7 h (Sicherheitspunkt).
   Die untere Grenze folgt der verbreiteten Erwachsenenempfehlung von 7–9 h;
   fuer Sportler wird eher mehr angesetzt — 7 h ist also die konservative,
   nicht die grosszuegige Wahl.
   OHNE uebergebenen Bedarf bleibt es bei 480 — Altaufrufer unveraendert. */
/* ═══ v9 · DAS SCHLAFKONTO IST EIN KONTO, KEINE STRAFLISTE ══════════════
   BEFUND (Gian, 16.08.): Konto 34 bei Sleep Score 76. Ursache war nicht der
   Bedarf, sondern die Summenbildung: `Math.max(0, need-x)` je Nacht zaehlte
   AUSSCHLIESSLICH Defizite. Eine lange Nacht konnte eine kurze damit NIE
   ausgleichen — das Konto kannte nur eine Richtung und lief zwangslaeufig
   nach unten, sobald eine einzige kurze Nacht im 7-Tage-Fenster lag.
   NEU: Ueberschuss wird angerechnet, aber bewusst NICHT eins zu eins.
   Erholungsschlaf wirkt real, stellt verlorenen Schlaf aber nur unvollstaendig
   wieder her. Deshalb: Defizit zaehlt voll, Ueberschuss zu 60 % und je Nacht
   auf 90 min gedeckelt — eine 11-Stunden-Nacht loescht keine ganze Woche.
   Rueckgabe bleibt „Stunden Defizit, >= 0" — kein Aufrufer muss sich aendern. */
function sleepDebt(sleepMins7,needMin){
  var need=(needMin!=null&&isFinite(needMin))?clampC(needMin,420,480):480;
  var bal=sleepMins7.filter(x=>x!=null).reduce(function(s,x){
    var d=need-x;
    return s+(d>0?d:Math.max(d,-90)*0.6);
  },0)/60;
  return bal>0?bal:0;
}

/* ---- Gewicht vs. Ziel (einfach, ehrlich — keine Kalorienbilanz) ---- */
function weightHint(w7Now,w7Prev){
  if(w7Now==null||w7Prev==null)return null;
  const d=w7Now-w7Prev;
  if(Math.abs(d)<0.4)return{lvl:'g',txt:'Gewicht stabil ('+(d>=0?'+':'')+d.toFixed(1)+' kg/4Wo) — passt zum Leistungsaufbau.'};
  if(d<=-0.4&&d>=-1.5)return{lvl:'g',txt:'Leicht fallend ('+d.toFixed(1)+' kg/4Wo) — ok, Protein-Ziel weiter halten.'};
  if(d<-1.5)return{lvl:'y',txt:d.toFixed(1)+' kg in 4 Wochen — zu schnell. Energieverfügbarkeit prüfen, Leistungsverlust droht.'};
  return{lvl:'y',txt:'+'+d.toFixed(1)+' kg/4Wo — beobachten; bei HM zählt Watt pro Kilo nicht, aber Pace pro Kilo schon.'};
}

/* ============ EMPFOHLENES WOCHEN-LAUFVOLUMEN (regelbasiert, ehrlich) ============
   calculateRecommendedWeeklyRunVolume(userProfile, trainingHistory, readinessData)
   - userProfile: {level, primaryGoal, trainingDays, gymDays, riskTolerance|riskPreference}
   - trainingHistory: [{dist, sub, date}] Läufe der letzten ~4 Wochen (dist in km)
   - readinessData: {knee|painScore, avgReady}
   Prinzipien (Spec §3/§5):
   - Median der typischen Distanz als stabile Basis, NICHT der einmalige Bestwert.
   - Anfänger konservativ: 1–2 Läufe, niedriger Startumfang, Long Run knapp über typisch.
   - Ohne Historie keine aggressiven Werte → konservativer Start, später nachjustieren.
   - Schmerz/Low-Readiness: Umfang reduzieren oder halten, Progression pausieren.
   - Anfänger-Long-Run ≈ 25–35 % des Wochenumfangs. */
function recentRunStats(history){
  var runs=(history||[]).filter(function(r){return r&&r.dist>0;});
  var dists=runs.map(function(r){return r.dist;});
  return {n:runs.length, typical:median(dists)||0, longest:dists.length?Math.max.apply(null,dists):0};
}
function calculateRecommendedWeeklyRunVolume(userProfile, trainingHistory, readinessData){
  var p=userProfile||{}, rd=readinessData||{};
  var level=p.level||'fortgeschritten';
  var beginner=(level==='anfaenger'||level==='wiedereinstieg');
  var elite=(level==='profi'||level==='leistung');
  var risk=p.riskTolerance||p.riskPreference||'balanced';
  var st=recentRunStats(trainingHistory);
  var knee=rd.painScore!=null?rd.painScore:(rd.knee!=null?rd.knee:0);
  var pain=knee>=3;
  var lowReady=(rd.avgReady!=null&&rd.avgReady<55);

  // geplante Laufeinheiten je Level (konservativ; extern weiter begrenzbar durch trainingDays)
  var runSessions=beginner?(st.n>=4?2:1):(elite?4:3);

  var typical=st.typical, hasHistory=(st.n>=3&&typical>0);
  var weeklyKm, longRunKm, conf, note;

  if(!hasHistory){
    if(beginner){weeklyKm=6;longRunKm=3;runSessions=2;}
    else if(elite){weeklyKm=25;longRunKm=8;}
    else {weeklyKm=12;longRunKm=5;}
    conf='niedrig';
    note='Keine belastbare Lauf-Historie — konservativer Start, Nachjustierung nach 2–4 Wochen.';
  }else{
    var base=typical*runSessions;
    if(beginner){weeklyKm=Math.min(base, typical*2+4); longRunKm=Math.min(typical*1.3, typical+3);}
    else if(elite){weeklyKm=base; longRunKm=Math.max(st.longest, typical*1.5);}
    else {weeklyKm=base; longRunKm=Math.min(st.longest*1.1, typical*1.6);}
    conf='mittel';
    note='Basis aus typischer Distanz (Median '+typical.toFixed(1)+' km) × '+runSessions+' Läufen.';
  }

  // Risiko-Präferenz moduliert leicht (nur außerhalb des Schmerz-Falls)
  var riskF=(risk==='konservativ'||risk==='conservative')?0.9:(risk==='ambitioniert'||risk==='ambitious'?1.1:1.0);
  weeklyKm*=riskF;

  var warnings=[];
  if(pain){weeklyKm*=0.7;longRunKm*=0.7;conf='reduziert';warnings.push('Knie '+knee+'/10 — Laufumfang reduziert, Progression pausiert.');}
  else if(lowReady){weeklyKm*=0.85;warnings.push('Readiness niedrig — Umfang gehalten statt gesteigert.');}

  // Long-Run-Anteil-Cap für Anfänger (25–35 % des Wochenumfangs) — nur sinnvoll ab 3 Läufen,
  // sonst wäre der Long Run kürzer als ein normaler Lauf.
  if(beginner&&runSessions>=3&&weeklyKm>0)longRunKm=Math.min(longRunKm, weeklyKm*0.35);

  // Recent-History-Guard: max ~10 % über grober Vorwochen-Basis (Anfänger)
  if(beginner&&typical>0){
    var prevWeek=typical*(st.n>=4?2:1);
    if(prevWeek>0&&weeklyKm>prevWeek*1.1)weeklyKm=prevWeek*1.1;
  }

  weeklyKm=Math.max(0,Math.round(weeklyKm*10)/10);
  longRunKm=Math.max(0,Math.round(longRunKm*10)/10);
  if(longRunKm>weeklyKm)longRunKm=weeklyKm; // Long Run nie größer als Wochenumfang

  return {weeklyKm:weeklyKm, runSessions:runSessions, longRunKm:longRunKm,
          typicalKm:+typical.toFixed(1), longestKm:st.longest, historyRuns:st.n,
          confidence:conf, note:note, warnings:warnings};
}

/* ============================================================
   ADAPTIVE ENGINE (rein, testbar) — Tageszustand + Session-/Wochen-Anpassung
   Trainings- und Belastungssteuerung, KEINE medizinische Diagnose.
   ============================================================ */
/* Tageszustand → GREEN / YELLOW / ORANGE / RED + Gründe + erlaubte Aktionen.
   in: {pain, region, illness, doms, sleepH, sleepQ, feel, motivation, stress,
        hrv, readiness, load3, load7, load14} (alles optional) */
function dayStateEngine(inp){
  var i=inp||{};
  var pain=(i.pain!=null?i.pain:0), doms=(i.doms!=null?i.doms:0);
  var sleepH=(i.sleepH!=null?i.sleepH:7), sleepQ=(i.sleepQ!=null?i.sleepQ:6);
  var feel=(i.feel!=null?i.feel:7), readiness=(i.readiness!=null?i.readiness:null);
  var lowHrv=hrvBelowBaseline(i.hrv), highStress=(i.stress==='High'), illness=!!i.illness;
  var poorSleep=(sleepH<6||sleepQ<=4), lowEnergy=(feel<=4);
  var lowMot=(i.motivation!=null&&i.motivation<=3);
  // Belastungssprung 3T vs. 7T-Schnitt (falls geliefert)
  var loadSpike=(i.load3!=null&&i.load7!=null&&i.load7>0&&(i.load3/i.load7)>1.4);
  /* v8-317 · MUSKELKATER IST REGIONAL (Gians Befund, zweite Haelfte).
     Der Score unterschied nach der ersten Korrektur bereits, der ZUSTAND nicht:
     Beinmuskelkater 7/10 setzte auch an einem Oberkoerpertag ORANGE — und
     ORANGE verbietet Krafttraining komplett. Damit konnte man nach einem
     Beintag keinen Oberkoerper mehr machen, obwohl der Oberkoerper frisch ist.
     `domsHits` kommt aus evaluateDomsImpact (Region gegen die heute geplante
     Einheit). Trifft der Muskelkater die heutige Belastung NICHT, zaehlt er
     eine Stufe niedriger — er verschwindet nicht, denn starker Muskelkater
     bedeutet auch systemische Ermuedung.
     OHNE erfasste Region entscheidet weiterhin evaluateDomsImpact nach seiner
     bestehenden Regel (beinlastige geplante Einheit ⇒ trifft zu) — hier wird
     nichts umgedeutet. Nur ein voellig FEHLENDER Wert (undefined, z. B. aus
     einem Alt-Aufrufer ohne pdm) gilt konservativ als „trifft zu". */
  var domsHits=(i.domsHits===false)?false:true;
  /* ═══ v9 · SCHMERZ IST REGIONAL — GENAU WIE MUSKELKATER ════════════════
     BEFUND (Gian, 16.08.): „Score 85, aber Gelb, Reduzieren empfohlen." Am
     Code reproduziert und per Gegenprobe belegt: mit identischen Werten und
     Schmerz 0 liefert dieselbe Funktion GREEN. Ausloeser war ausschliesslich
     `painMild = pain>=2 && pain<4` — regionsblind. Gians chronische Huefte mit
     2/10 hielt damit JEDEN Tag auf Gelb, unabhaengig von HRV, Schlaf, Body
     Battery und unabhaengig davon, ob ueberhaupt etwas Huefbelastendes geplant
     war. Eine Ampel, die dauerhaft dieselbe Farbe zeigt, traegt keine
     Information mehr — sie kostet nur noch Vertrauen.
     Fuer MUSKELKATER wurde genau diese Unterscheidung in v8-317 bereits
     eingebaut (domsHits); fuer Schmerz wurde sie nie nachgezogen.
     NEU: leichter Schmerz (2–3/10) zieht das Band nur dann auf Gelb, wenn die
     Region die heute geplante Belastung trifft (painHits aus
     evaluatePainImpact — dieselbe Quelle, die die Entscheidungsseite ohnehin
     benutzt). Trifft er nicht, bleibt er im SCORE voll enthalten (Gewicht 25,
     groesster Einzelposten) — die Zahl sagt weiter die Wahrheit, nur das
     Handlungsband wird nicht mehr grundlos gesperrt.
     UNVERAENDERT: ab 4/10 gilt die harte Regel regionsunabhaengig (ORANGE),
     ab 6/10 ROT. Fehlt die Angabe (Altaufrufer ohne pdm), bleibt es beim
     bisherigen konservativen Verhalten. */
  var painHits=(i.painHits===false)?false:true;
  var flags={illness:illness,painSevere:pain>=6,pain:pain>=4&&pain<6,
    painMild:(pain>=2&&pain<4&&painHits),painMildOffTarget:(pain>=2&&pain<4&&!painHits),
    domsHigh:doms>=7&&domsHits,domsMod:(doms>=4&&doms<7)||(doms>=7&&!domsHits),poorSleep:poorSleep,lowEnergy:lowEnergy,
    lowHrv:lowHrv,highStress:highStress,loadSpike:loadSpike,lowMotivation:lowMot};
  var state;
  if(illness||flags.painSevere||(readiness!=null&&readiness<40)||(lowHrv&&poorSleep&&lowEnergy))state='RED';
  else if(flags.pain||flags.domsHigh||(readiness!=null&&readiness<55)||(lowHrv&&poorSleep)||loadSpike)state='ORANGE';
  else if((readiness!=null&&readiness<70)||flags.domsMod||poorSleep||flags.painMild||lowHrv||highStress||lowEnergy)state='YELLOW';
  else state='GREEN';
  /* v8-320: Im Wiedereinstiegsfenster nach Krankheit nie GREEN — die Freigabe
     fuer harte Einheiten haengt am Zustand, und genau die ist hier zu frueh. */
  var _irw=illnessReturnWindow(i.illSinceEnd,i.illDuration);
  if(_irw.inWindow){flags.illnessReturn=true;flags.illnessReturnDay=_irw.day;flags.illnessReturnDays=_irw.days;
    if(state==='GREEN')state='YELLOW';}
  var reasons=[];
  if(illness)reasons.push('Krankheitssymptome');
  if(_irw.inWindow)reasons.push('Wiedereinstieg nach Krankheit (Tag '+_irw.day+' von '+_irw.days+')');
  if(pain>0)reasons.push('Schmerzen '+pain+'/10'+(i.region?' ('+i.region+')':'')
    +(flags.painMildOffTarget?' — trifft die heutige Einheit nicht':''));
  if(doms>=4)reasons.push('Muskelkater '+doms+'/10');
  if(poorSleep)reasons.push('Schlaf '+(sleepH<6?sleepH.toFixed(1)+' h':'Qualität '+sleepQ+'/10'));
  if(lowEnergy)reasons.push('Energie '+feel+'/10');
  if(lowHrv)reasons.push('HRV niedrig');
  if(highStress)reasons.push('Stress hoch');
  if(loadSpike)reasons.push('Belastungssprung letzte 3 Tage');
  if(readiness!=null)reasons.push('Readiness '+readiness+'%');
  var allow={GREEN:{hard:true,strength:true,impact:true},
    YELLOW:{hard:false,strength:true,impact:true},
    ORANGE:{hard:false,strength:false,impact:false},
    RED:{hard:false,strength:false,impact:false}}[state];
  return {state:state,reasons:reasons,flags:flags,allow:allow,illnessReturn:_irw};
}
/* Eine geplante Einheit an den Tageszustand anpassen → Aktionstyp + Ersatz.
   item: {t:'Laufen'|'Rad'|'Gym'|'Schwimmen'|'Mobilität', l, d, kind?}
   ds: dayStateEngine-Ergebnis. region: betroffener Schmerzbereich. */
function adaptSessionPlan(item,ds,opts){
  opts=opts||{};var st=ds.state,f=ds.flags;var t=item.t,kind=item.kind||'';
  var hard=(kind==='interval'||kind==='tempo')||/interval|tempo|sprint/i.test(item.l||'');
  var isLong=(kind==='long'||/long/i.test(item.l||''));
  var isLeg=(t==='Gym'&&/bein|ganzk|squat|leg/i.test(item.l||''));
  var region=(opts.region||'').toLowerCase();
  var impactPain=/knie|knee|schienbein|shin|achill|fuß|fuss|foot|sprung|ankle/.test(region);
  var R=function(action,label,detail,reason){return {action:action,label:label,detail:detail,reason:reason};};
  // RED: alles weich
  if(st==='RED'){
    if(f.illness)return R('REPLACE_WITH_RECOVERY','Ruhe / sehr leichte Bewegung','Kein strukturiertes Training. Bei mildem Zustand kurzer Spaziergang. Keine Intensität, kein Kraft, keine Intervalle.','Krankheitssymptome — Belastung aussetzen.');
    return R('REST','Ruhetag','Regeneration: Schlaf, Protein, Mobilität. Optional 10–20 min sehr locker.','Deutliche Überlastung/Beschwerden.');
  }
  // ORANGE: ersetzen/Modalität wechseln
  if(st==='ORANGE'){
    if((t==='Laufen')&&(impactPain||f.pain))return R('SWAP_MODALITY','Rad Zone 2 statt Lauf','45–60 min Z2 gelenkschonend statt Laufbelastung.','Schmerz im Stützapparat — Aufprall vermeiden.');
    if(isLeg)return R('SWAP_MODALITY','Oberkörper + Core statt Beine','Push/Pull/Core + Mobility, keine schwere knie-/rückendominante Last.','Beine/Rücken schonen.');
    if(hard)return R('REDUCE_INTENSITY','Easy Z2 statt '+(item.l||'hart'),'40 min locker Zone 2, keine Intensität.','Tagesform lässt keine harte Einheit zu.');
    if(isLong)return R('REDUCE_VOLUME','Long Run kürzen','Umfang ~60 %, locker nach Gefühl.','Reduzierte Belastbarkeit.');
    return R('REDUCE_VOLUME','Umfang reduzieren','Eine Stufe leichter, kürzer.','Eingeschränkte Tagesform.');
  }
  // YELLOW: reduzieren
  if(st==='YELLOW'){
    if(hard&&(f.domsHigh||f.domsMod)&&(t==='Laufen'||isLeg))return R('SWAP_MODALITY','Easy statt hart','Muskelkater — heute locker Z2 / kein neuer harter Reiz auf dieselbe Muskelgruppe.','Muskelkater '+(opts.doms||'')+' — keine harte Belastung gleicher Muskeln.');
    if(hard)return R('REDUCE_INTENSITY',(item.l||'Einheit')+' reduzieren','Weniger Wiederholungen oder in Easy umwandeln, wenn es zäh wird.','Werte gemischt — Reize dosieren.');
    if(isLong)return R('REDUCE_VOLUME','Long Run ~80 %','Etwas kürzer, locker.','Leichte Einschränkung.');
    if(impactPain&&t==='Laufen')return R('REDUCE_VOLUME','Lauf ~80 %, kein Tempo','Keine Sprints/Sprünge/Downhills.','Leichter Schmerz — Belastung vorsichtig.');
    return R('KEEP',item.l||'Wie geplant','Normal, aber auf Signale achten.','Nur leichte Einschränkung.');
  }
  return R('KEEP',item.l||'Wie geplant','Plan durchziehen.','Gute Tagesform.');
}
/* Nachhaltige Wochen-Anpassung (rein). plan: 7×[item]. opts:{todayIndex, state,
   fixedEvents:[{day,type}], illness}. Verschiebt verdrängte harte Einheit NICHT
   blind auf morgen, entzerrt harte Tage (≥48 h) und meidet hart direkt vor Event. */
/* P4-Dokumentation (bewusstes Verhalten, KNOWN_ISSUES #13 geklärt): adaptWeekPlan ist
   VOLUMEN-NEUTRAL — es verschiebt/entzerrt nur Einheiten des bestehenden Plans und liest
   die Zieltagzahl absichtlich nicht. Die Tageskapazität ist Sache des Generators
   (generateWeekPlan + effectiveTrainingConfig); die Tagesfreigabe ist Sache von
   buildTrainingDecision (erhält fixedEvents/illness). */
function adaptWeekPlan(plan,opts){
  opts=opts||{};var today=(opts.todayIndex!=null?opts.todayIndex:0);
  var fixed={};(opts.fixedEvents||[]).forEach(function(e){fixed[e.day]=e.type||'Termin';});
  var w=plan.map(function(day){return (day||[]).slice();});
  var changes=[];
  var isHard=function(it){var k=it&&(it.kind||'');return (it.t==='Laufen'&&(k==='interval'||k==='tempo'||/interval|tempo|long/i.test(it.l||'')))||(it.t==='Gym'&&/bein|ganzk/i.test(it.l||''));};
  var dayHasHard=function(d){return (w[d]||[]).some(isHard);};
  var dayEmptyish=function(d){return !(w[d]||[]).some(function(it){return it.t!=='Mobilität';});};
  var eventSoon=function(d){return fixed[d]||fixed[(d+1)%7];}; // Event heute oder morgen
  // 1) Heute harte Einheit + schlechter Zustand → verdrängen und klug umplanen
  if((opts.state==='ORANGE'||opts.state==='RED')&&dayHasHard(today)){
    var moved=(w[today]||[]).filter(isHard);
    w[today]=(w[today]||[]).filter(function(it){return !isHard(it);});
    if(opts.state==='RED'){changes.push({day:today,action:'REPLACE_WITH_RECOVERY',reason:'Zustand RED — harte Einheit heute gestrichen.'});}
    else changes.push({day:today,action:'REDUCE_INTENSITY',reason:'Zustand ORANGE — harte Einheit heute ersetzt.'});
    // Zieltag suchen: ≥2 Tage Abstand, kein Event heute/morgen, Tag aktuell locker, kein Hard-Nachbar
    moved.forEach(function(it){
      var placed=false;
      for(var off=2;off<=5;off++){var d=(today+off)%7;
        if(d<today)break; // nur später in der Woche
        if(eventSoon(d))continue;
        if(dayHasHard(d)||dayHasHard((d+6)%7)||dayHasHard((d+1)%7))continue;
        if(!dayEmptyish(d))continue;
        w[d]=(w[d]||[]).concat([it]);changes.push({day:d,action:'MOVE_SESSION',reason:'Harte Einheit auf regenerierten Tag verschoben (≥48 h Abstand, kein Konflikt mit festem Termin).'});
        placed=true;break;
      }
      if(!placed)changes.push({day:today,action:'KEEP',reason:'Kein passender Tag mit genug Regeneration — Einheit wird nicht nachgeholt (Woche bleibt realistisch).'});
    });
  }
  // 2) Harte Tage entzerren (keine zwei direkt hintereinander)
  for(var d2=0;d2<7;d2++){
    if(dayHasHard(d2)&&dayHasHard((d2+1)%7)&&(d2+1)<7){
      changes.push({day:(d2+1),action:'MOVE_SESSION',reason:'Zwei harte Tage in Folge — zweiten Tag entzerren.'});
    }
  }
  // 3) Krankheit → 2–4 Tage konservativ
  if(opts.illness){changes.push({day:today,action:'REBUILD_WEEK',reason:'Krankheitssymptome — die nächsten 2–4 Tage konservativ (kein hartes Training), danach langsam steigern.'});}
  return {plan:w,changes:changes};
}

/* ============ TRAININGSART-KLASSIFIKATION (Phase 4) ============
   Wandelt eine Plan-Einheit in ein präzises Profil: Sport, Typ, Intensität,
   Beinlast, Aufprall. Basis für differenzierte Anpassung. */
function classifyTrainingType(item){
  if(!item)return {sport:null,type:'rest',intensity:'none',legLoad:false,impact:false,hard:false};
  var t=item.t,l=(item.l||'').toLowerCase(),kind=item.kind||'';
  var sport={Laufen:'run',Rad:'bike',Schwimmen:'swim',Gym:'gym','Mobilität':'mobility'}[t]||'other';
  var type='easy',intensity='low',legLoad=false,impact=false;
  if(t==='Laufen'){impact=true;legLoad=true;
    if(kind==='interval'||/interval/.test(l)){type='interval';intensity='high';}
    else if(kind==='tempo'||/tempo|schwelle/.test(l)){type='tempo';intensity='high';}
    else if(/sprint|stride|strides/.test(l)){type='sprint';intensity='high';}
    else if(kind==='long'||/long/.test(l)){type='long';intensity='moderate';}
    else if(/recovery/.test(l)){type='recovery';intensity='low';}
    else {type='easy';intensity='low';}
  }else if(t==='Rad'){
    if(/vo2|interval/.test(l)){type='vo2';intensity='high';}
    else if(/sweet|schwelle/.test(l)){type='sweetspot';intensity='high';}
    else if(/brick|koppel/.test(l)){type='brick';intensity='moderate';legLoad=true;}
    else if(/long/.test(l)){type='long';intensity='moderate';}
    else if(/recovery/.test(l)){type='recovery';intensity='low';}
    else {type='zone2';intensity='low';}
  }else if(t==='Schwimmen'){
    if(/interval/.test(l)){type='interval';intensity='high';}
    else if(/open/.test(l)){type='openwater';intensity='moderate';}
    else if(/ausdauer|endur/.test(l)){type='endurance';intensity='moderate';}
    else if(/technik/.test(l)){type='technique';intensity='low';}
    else {type='easy';intensity='low';}
  }else if(t==='Gym'){
    legLoad=/bein|leg|squat|unterk|ganzk/.test(l);
    if(/max|power/.test(l)){type='maxstrength';intensity='high';}
    else if(/hypertroph/.test(l)){type='hypertrophy';intensity='moderate';}
    else if(/core/.test(l)){type='core';intensity='low';}
    else if(/mobil|prehab/.test(l)){type='mobility';intensity='low';legLoad=false;}
    else if(/ober/.test(l)){type='upper';intensity='moderate';legLoad=false;}
    else {type='strength';intensity='moderate';}
  }else if(t==='Mobilität'){type='mobility';intensity='low';}
  return {sport:sport,type:type,intensity:intensity,legLoad:legLoad,impact:impact,hard:intensity==='high'};
}

/* ============ SPORT-CLUSTER & BELASTUNGSPROFILE (Phase 5) ============ */
const SPORT_PROFILES={
  endurance_run:{sport:'Laufen',cluster:'endurance_cyclic',primaryLoadAreas:['Waden','Achillessehne','Knie','Hüftbeuger'],injurySensitiveAreas:['Knie','Schienbein','Achillessehne'],intensityPattern:'zyklische Ausdauer',fixedEventImportance:'mittel',recoveryNeeds:'mittel'},
  endurance_bike:{sport:'Rad',cluster:'endurance_cyclic',primaryLoadAreas:['Quadrizeps','Glutes','unterer Rücken'],injurySensitiveAreas:['Knie','unterer Rücken'],intensityPattern:'zyklische Ausdauer',fixedEventImportance:'mittel',recoveryNeeds:'niedrig'},
  triathlon:{sport:'Triathlon',cluster:'multisport_triathlon',primaryLoadAreas:['Beine','Schulter','Gesamtvolumen'],injurySensitiveAreas:['Knie','Achillessehne','Schulter'],intensityPattern:'zyklisch + kumulierte Ermüdung, Brick',fixedEventImportance:'hoch',recoveryNeeds:'hoch'},
  football:{sport:'Fußball',cluster:'team_intermittent',primaryLoadAreas:['Beine','Hamstrings','Adduktoren','Knie','Sprunggelenk'],injurySensitiveAreas:['Knie','Sprunggelenk','Hamstrings','Adduktoren'],intensityPattern:'Sprints, Richtungswechsel, Kontakt, Spieltag',fixedEventImportance:'sehr hoch',recoveryNeeds:'hoch nach Spiel'},
  padel:{sport:'Padel',cluster:'court_racket',primaryLoadAreas:['Schulter','Unterarm','Wade','Achillessehne','Adduktoren'],injurySensitiveAreas:['Schulter','Achillessehne','Wade'],intensityPattern:'kurze Antritte, Richtungswechsel, Rotation',fixedEventImportance:'hoch',recoveryNeeds:'mittel'},
  strength:{sport:'Kraft',cluster:'strength_gym',primaryLoadAreas:['Zielmuskel je Split'],injurySensitiveAreas:['unterer Rücken','Schulter','Knie'],intensityPattern:'Sätze/Wiederholungen, Maximalkraft/Hypertrophie',fixedEventImportance:'niedrig',recoveryNeeds:'mittel'}
};
function sportProfileFor(goal){
  var g=String(goal||'').toLowerCase();
  if(/triathl|ironman/.test(g))return SPORT_PROFILES.triathlon;
  if(/fußball|fussball|football|soccer/.test(g))return SPORT_PROFILES.football;
  if(/padel|tennis|squash/.test(g))return SPORT_PROFILES.padel;
  if(/muscle|strength|kraft|hypertroph/.test(g))return SPORT_PROFILES.strength;
  if(/cycl|rad|bike/.test(g))return SPORT_PROFILES.endurance_bike;
  return SPORT_PROFILES.endurance_run;
}

/* ============ SAFETY (Phase 8) — Belastungssteuerung, KEINE Diagnose ============ */
function safetyCheck(c){
  c=c||{};var flags=[],red=[];
  // Feld-Aliasse: akzeptiert Kurz- UND ausführliche Namen (UI-kompatibel).
  var breath=c.breathlessness||c.shortnessOfBreath;
  var neuro=c.neuro||c.neurologicalSymptoms;
  var trauma=c.traumaPain||c.accidentPain;
  function addRed(f){flags.push(f);red.push(f);}
  // Echte Warnzeichen → level 'red' (harter Eingriff). Krankheit allein NICHT 'red'.
  if(c.fever)addRed('Fieber');
  if(c.chestPain)addRed('Brustschmerz');
  if(breath)addRed('Atemnot');
  if(c.dizziness)addRed('Schwindel/Ohnmacht');
  if(neuro)addRed('neurologische Symptome');
  if(trauma)addRed('Schmerz nach Unfall');
  if(c.swelling)addRed('akute Schwellung');
  if(c.instability)addRed('Instabilitätsgefühl');
  if(c.severePain||(c.pain!=null&&c.pain>7))addRed('starke Schmerzen');
  if(c.illness)flags.push('Krankheitssymptome');
  var critical=!!(c.chestPain||breath||c.dizziness||neuro||trauma);
  var level=red.length?'red':(c.illness?'caution':'none');
  var advice=red.length
    ?'ORVIA kann keine Diagnose stellen. Aufgrund deiner Angaben wird heute keine intensive Einheit empfohlen. Bei starken, plötzlichen oder anhaltenden Beschwerden bitte fachlich abklären lassen.'
    :(c.illness?'ORVIA kann keine Diagnose stellen. Mit Krankheitssymptomen heute keine intensive Einheit — leichte Bewegung nur bei mildem Zustand.':'');
  // triggered bleibt rückwärtskompatibel (true bei irgendeinem Flag), level differenziert.
  return {triggered:flags.length>0,critical:critical,level:level,flags:flags,redFlags:red,advice:advice};
}
/* ---- Schmerz/DOMS GETRENNT bewerten (painRegion vs. domsRegion) ---- */
function evaluatePainImpact(n,tt){
  var region=(n.painRegion||'').toLowerCase();
  var impactRegion=/knie|knee|schienbein|shin|achill|fuß|fuss|sprung|ankle|hüft|hip/.test(region);
  var hits=!tt?((n.pain||0)>=5):(impactRegion&&(tt.impact||tt.legLoad));
  var blocksHard=((n.pain||0)>=5&&impactRegion&&hits);
  return {pain:n.pain||0,region:region,impactRegion:impactRegion,hits:hits,blocksHard:blocksHard};
}
function evaluateDomsImpact(n,tt){
  var region=(n.domsRegion||'').toLowerCase();var hits;
  if(region){
    var leg=/bein|leg|hamstring|adduktor|quad|wade|gesä|glut/.test(region);
    var upper=/ober|arm|brust|schulter|rücken|lat/.test(region);
    hits=(leg&&tt&&tt.legLoad)||(upper&&tt&&tt.sport==='gym'&&!tt.legLoad);
  }else{
    // keine DOMS-Region → konservativ anhand geplanter Einheit (beinlastig), aber nicht dramatisch
    hits=tt?!!tt.legLoad:false;
  }
  var blocksHard=((n.doms||0)>=7&&hits);
  return {doms:n.doms||0,region:region,hasRegion:!!region,hits:hits,blocksHard:blocksHard};
}
function evaluatePainAndDOMS(n,tt){
  var p=evaluatePainImpact(n,tt),d=evaluateDomsImpact(n,tt);
  return {pain:p,doms:d,blocksHardForToday:(p.blocksHard||d.blocksHard),hitsStruct:(p.hits||d.hits)};
}
/* ---- Recovery nach SCHWERE (nicht nur Anzahl) ---- */
function evaluateRecoveryState(n){
  var lim=[],sc=100,hard=!!n.hardPlanned,sleepH=n.sleepH,sleepQ=n.sleepQ;
  if(sleepH!=null){ if(sleepH<5){sc-=28;lim.push('Schlaf <5 h');} else if(sleepH<6){sc-=16;lim.push('Schlaf <6 h');} else if(sleepH<7){sc-=7;} }
  if(sleepQ!=null){ if(sleepQ<=2){sc-=24;lim.push('Schlafqualität sehr niedrig');} else if(sleepQ<=4){sc-=12;lim.push('Schlafqualität niedrig');} else if(sleepQ<=6){sc-=5;} }
  if(hrvBelowBaseline(n.hrv)){sc-=16;lim.push('HRV niedrig');}
  if(n.rhrDev!=null&&n.rhrDev>=5){sc-=12;lim.push('Ruhepuls erhöht');}
  if(n.stress==='High'){sc-=10;lim.push('Stress hoch');} else if(n.stress==='Med'){sc-=4;}
  if(n.sleepDebtH!=null&&n.sleepDebtH>=4){sc-=8;lim.push('Schlafkonto negativ');}
  sc=Math.max(0,Math.min(100,sc));
  var extreme=(sleepH!=null&&sleepH<5)||(sleepQ!=null&&sleepQ<=2);
  var hrvBad=(hrvBelowBaseline(n.hrv)&&((sleepH!=null&&sleepH<6)||(sleepQ!=null&&sleepQ<=4)));
  var sev='ok';
  if(lim.length>=3)sev='high';
  else if(extreme)sev=hard?'high':'moderate';
  else if(hrvBad)sev='moderate';
  else if(lim.length===2)sev='moderate';
  else if(lim.length===1)sev='mild';
  return {score0_100:sc,limiters:lim,severity:sev,extreme:extreme};
}
function evaluateLoadAndInterference(n,tt){
  var L=n.loads||{};
  var has=(L.load3!=null&&L.load7!=null&&L.load7>0);
  var ratio=has?L.load3/L.load7:null;
  var spike=has&&ratio>1.4;
  var interference=!!(tt&&tt.legLoad&&(n.doms||0)>=4);
  var notes=[];if(spike)notes.push('Belastungssprung');if(interference)notes.push('Bein-Interferenz');
  return {loadSpike:spike,interference:interference,notes:notes,
    load3:has?Math.round(L.load3):null,load7:has?Math.round(L.load7):null,
    spikePct:spike?Math.round((ratio-1)*100):null};
}
/* ---- Score-Caps zentral (UI rechnet KEINE Caps) ---- */
/* ═══ v8-320 · WIEDEREINSTIEG NACH KRANKHEIT ══════════════════════════
   Bis hierher war `illness` ein Ja/Nein. An dem Tag, an dem der Haken
   verschwand, war man sofort wieder voll belastbar — der Score sprang von
   gedeckelt auf ungebremst. Nach einem Infekt steigt die Belastbarkeit aber
   graduell, und gerade die ersten Tage danach sind die, an denen zu frueh
   wieder intensiv trainiert wird.

   [A] ANNAHME, ausdruecklich als Faustregel gekennzeichnet: ETWA EIN
   ZURUECKHALTENDER TAG JE KRANKHEITSTAG, gedeckelt bei 7. Das ist die in der
   Sportpraxis verbreitete Groessenordnung fuer den Wiedereinstieg nach einem
   banalen Infekt; es ist KEIN gemessener Wert und keine Diagnose. Bewusst
   konservativ gedeckelt, damit eine lange Krankheit nicht wochenlang bremst.

   Waehrend des Fensters steigt die Obergrenze LINEAR von 68 zurueck auf 100.
   Der erste Tag danach ist damit spuerbar gebremst, der letzte praktisch frei.

   HARTE EINHEITEN: Der erste Entwurf hatte hier ein eigenes `blocksHard` fuer
   das erste Drittel des Fensters. Beim Durchmessen zeigte sich, dass das eine
   SCHEINUNTERSCHEIDUNG ist: Das Fenster setzt den Tageszustand ohnehin auf
   mindestens YELLOW, und YELLOW erlaubt per Definition keine harten Einheiten
   (allow.hard=false). Das Feld haette eine Feinsteuerung suggeriert, die es
   nicht gibt — deshalb entfernt. Die Schutzwirkung kommt aus dem Zustand.

   returns {inWindow, day, days, ceiling} — pur, keine Uhr, keine Daten. */
function illnessReturnWindow(sinceEnd,duration){
  var d=(duration>0)?duration:0;
  if(sinceEnd==null||d<=0)return {inWindow:false,day:0,days:0,ceiling:100};
  if(sinceEnd<=0)return {inWindow:false,day:0,days:0,ceiling:100};   /* heute noch krank: bestehende Deckel greifen */
  var days=Math.min(Math.max(Math.round(d),1),7);
  if(sinceEnd>days)return {inWindow:false,day:0,days:days,ceiling:100};
  var frac=(sinceEnd-1)/days;                 /* Tag 1 ⇒ 0, letzter Tag ⇒ nahe 1 */
  return {inWindow:true,day:sinceEnd,days:days,ceiling:Math.round(68+(100-68)*frac)};
}
function applyDecisionCaps(score,n,ev,state,tt){
  var cap=100,hard=!!(n&&n.hardPlanned),S=ev.safety,P=ev.pdm,Ld=ev.load||{};
  if(S.level==='red')cap=Math.min(cap,35);
  if(n.illness&&S.level!=='red')cap=Math.min(cap,55);
  /* v8-320: nach der Krankheit ein steigender statt gar kein Deckel. */
  var _rw=illnessReturnWindow(n.illSinceEnd,n.illDuration);
  if(_rw.inWindow)cap=Math.min(cap,_rw.ceiling);
  if((n.pain||0)>=8)cap=Math.min(cap,40);
  if(n.sleepQ!=null&&n.sleepQ<=2&&hard)cap=Math.min(cap,65);
  if(n.sleepH!=null&&n.sleepH<5&&hard)cap=Math.min(cap,65);
  if(hrvBelowBaseline(n.hrv)&&((n.sleepH!=null&&n.sleepH<6)||(n.sleepQ!=null&&n.sleepQ<=4)))cap=Math.min(cap,68);
  if((n.doms||0)>=8&&P.doms.hits)cap=Math.min(cap,65);
  if((n.pain||0)>=5&&P.pain.impactRegion&&P.pain.hits)cap=Math.min(cap,60);
  // Belastung ≠ Tagesform: Ein NUR durch Lastsprung ausgelöstes ORANGE darf den physiologischen
  // Readiness-Score NICHT deckeln. Der Lastsprung steuert die Trainingsentscheidung (Umfang
  // reduzieren), nicht die Zahl. Physiologische ORANGE-Ursachen deckeln weiterhin korrekt.
  var physOrangeCause=(n.illness||(n.pain||0)>=4||(n.doms||0)>=7||(n.readiness!=null&&n.readiness<55)||
    (hrvBelowBaseline(n.hrv)&&((n.sleepH!=null&&n.sleepH<6)||(n.sleepQ!=null&&n.sleepQ<=4))));
  var loadOnlyOrange=(state==='ORANGE'&&Ld.loadSpike&&!physOrangeCause);
  /* ═══ v8-317 · DER TAGESSCORE WIRD STETIG ═══════════════════════════════
     GIANS BEFUND, am Code reproduziert: Der angezeigte Wert war KEINE
     Messung, sondern die Obergrenze des Tageszustands. Die frühere Zeile
       {GREEN:100, YELLOW:79, ORANGE:64, RED:44}[state]
     erzeugte exakt die Treppe, die er gemessen hat — Hüftschmerz 2/3/4 ⇒ 79,
     5/6 ⇒ 64, 7–10 ⇒ 44. Weil die physiologische Readiness fast immer ÜBER
     der Grenze lag, sah er wochenlang „79", egal wie gut Schlaf, Stress oder
     HRV waren: jede Verbesserung wurde von derselben Zahl abgeschnitten.

     WAS BLEIBT (und warum): Die BÄNDER bleiben garantiert getrennt. Ein
     ORANGE-Tag darf nie aussehen wie ein GREEN-Tag — sonst wäre die Zahl als
     Sicherheitssignal wertlos. Die harten Sicherheitsdeckel oben (Red Flags,
     Krankheit, Schmerz ≥8) bleiben ebenfalls unangetastet.

     WAS SICH ÄNDERT: Innerhalb seines Bandes bewegt sich die Obergrenze jetzt
     STETIG mit der tatsächlichen Schwere der Ursache. Ein YELLOW aus leichtem
     Schmerz 2/10 deckelt bei 95, ein YELLOW aus Schmerz 3/10 plus schlechtem
     Schlaf bei 80. Damit wirken Verbesserungen sofort sichtbar — und
     Verschlechterungen ebenso, statt erst beim nächsten Bandwechsel.
     ═══════════════════════════════════════════════════════════════════════ */
  var BAND={GREEN:[86,100],YELLOW:[70,95],ORANGE:[50,79],RED:[20,49]};
  var b=loadOnlyOrange?BAND.GREEN:(BAND[state]||BAND.YELLOW);
  var sev=stateSeverity(n,ev,state);
  var stateCap=Math.round(b[1]-(b[1]-b[0])*sev);
  cap=Math.min(cap,stateCap);
  return Math.max(0,Math.min(Math.round(score),cap));
}
/* Schwere des AKTUELLEN Zustands als stetige Zahl 0..1 — 0 = gerade eben in
   diesem Band, 1 = am unteren Rand. Sie ist die Ursache dafür, dass sich die
   Zahl überhaupt bewegt, und benutzt AUSSCHLIESSLICH Größen, die auch die
   Zustandsbestimmung selbst verwendet — kein zweites, abweichendes Kriterium.
   Jeder Beitrag ist gedeckelt, damit ein einzelner Ausreißer nicht das ganze
   Band aufbraucht. */
function stateSeverity(n,ev,state){
  var s=0;
  var pain=n.pain||0,doms=n.doms||0;
  var P=(ev&&ev.pdm)||{pain:{},doms:{}};
  /* Schmerz zählt voll, wenn er die heutige Belastung trifft, sonst halb —
     dieselbe Unterscheidung, die die Entscheidungsseite ohnehin trifft. */
  if(pain>0)s+=Math.min(pain/10,1)*((P.pain&&P.pain.hits)?0.42:0.21);
  /* Muskelkater: trifft er die heutige Einheit NICHT, wiegt er deutlich
     weniger (Beinmuskelkater an einem Oberkörpertag). */
  if(doms>0)s+=Math.min(doms/10,1)*((P.doms&&P.doms.hits)?0.28:0.08);
  if(n.sleepH!=null&&n.sleepH<7)s+=Math.min((7-n.sleepH)/4,1)*0.18;
  if(n.sleepQ!=null&&n.sleepQ<7)s+=Math.min((7-n.sleepQ)/7,1)*0.16;
  if(n.feel!=null&&n.feel<7)s+=Math.min((7-n.feel)/7,1)*0.16;
  var hrv=String(n.hrv||'').toLowerCase();
  if(hrv==='low')s+=0.16; else if(hrv==='poor')s+=0.24; else if(hrv==='unbalanced')s+=0.07;
  var st=String(n.stress||'').toLowerCase();
  if(st==='high')s+=0.12; else if(st==='med')s+=0.04;
  if(n.illness)s+=0.30;
  /* Readiness unterhalb der Bandgrenze schiebt zusätzlich nach unten — sie ist
     die verdichtete Morgenlage und darf im Band sichtbar bleiben. */
  if(n.readiness!=null){
    var refs={GREEN:70,YELLOW:55,ORANGE:40,RED:0};
    var ref=refs[state]!=null?refs[state]:55;
    if(n.readiness<ref+15)s+=Math.min(Math.max((ref+15-n.readiness)/30,0),1)*0.20;
  }
  return s<0?0:s>1?1:s;
}
/* ---- Max. 2 Trigger, PRIORISIERT: Safety > Plan-Konflikt > lokal > Recovery > Last ---- */
function buildTriggerHighlights(ev){
  var out=[],S=ev.safety,P=ev.pdm,R=ev.recovery,C=ev.ctx||{},L=ev.load||{};
  if(S.level==='red')out.push({title:'Starkes Warnsignal',detail:'Heute keine intensive Einheit.'});
  if(C.matchConflict)out.push({title:'Plan-Konflikt',detail:'Harte Einheit wird verschoben.'});
  if(P.blocksHardForToday)out.push({title:'Beinbelastung erhöht',detail:'Kein Intervall oder Leg Day.'});
  if((R.severity==='high'||R.severity==='moderate'))out.push({title:'Schlaf limitiert Intensität',detail:'Heute keine maximale Einheit.'});
  if(L.loadSpike)out.push({title:'Lastsprung',detail:(L.spikePct!=null)
    ?'Deine Belastung der letzten 3 Tage liegt '+L.spikePct+'% über deinem 7-Tage-Durchschnitt (Grenze +40%). Deshalb wird die heutige Einheit reduziert.'
    :'Umfang kontrollieren — akute Last über dem 7-Tage-Schnitt.'});
  return out.slice(0,2);
}
/* v9 · Headline-Aggregation aus GENAU den drei Gruppen, die die App auch
   anzeigt (Erholung / Belastungskontrolle / Umsetzung). Bewusst getrennt von
   combineScore() gehalten: das dort verwendete Fuenf-Groessen-Modell
   (inkl. loadFit/progress) wird NICHT angezeigt — eine Headline aus unsichtbaren
   Bestandteilen war genau der Fehler, der hier behoben wird.
   Liefert die Aufteilung als zweiten Rueckgabeweg (combineHeadline.lastParts),
   damit die Anzeige dieselben Zahlen zeigen kann, mit denen gerechnet wurde. */
function combineHeadline(c){
  c=c||{};var parts=[];
  if(c.recovery!=null)parts.push(['Erholung',c.recovery,0.60]);
  if(c.riskRaw!=null)parts.push(['Belastungskontrolle',100-c.riskRaw,0.25]);
  if(c.execution!=null)parts.push(['Umsetzung',c.execution,0.15]);
  if(!parts.length)return c.recovery!=null?c.recovery:70;
  var W=parts.reduce(function(s,p){return s+p[2];},0)||1;
  combineHeadline.lastParts=parts.map(function(p){return {name:p[0],value:Math.round(p[1]),weight:Math.round(p[2]/W*100)};});
  return Math.round(parts.reduce(function(s,p){return s+p[1]*p[2];},0)/W);
}
function combineScore(c){
  c=c||{};var parts=[];
  if(c.recovery!=null)parts.push([c.recovery,0.42]);
  if(c.riskRaw!=null)parts.push([100-c.riskRaw,0.26]);
  if(c.loadFit!=null)parts.push([c.loadFit,0.14]);
  if(c.execution!=null)parts.push([c.execution,0.10]);
  if(c.progress!=null)parts.push([c.progress,0.08]);
  if(!parts.length)return c.recovery!=null?c.recovery:70;
  var W=parts.reduce(function(s,p){return s+p[1];},0)||1;
  return Math.round(parts.reduce(function(s,p){return s+p[0]*p[1];},0)/W);
}

/* ============ DEFIZIT-/MUSTER-ERKENNUNG (Phase 6) — Performance, keine Diagnose ============ */
function detectDeficits(o){
  o=o||{};var out=[];
  var L=o.loads||{};
  if(L.load3!=null&&L.load7!=null&&L.load7>0&&L.load3/L.load7>1.4)out.push({key:'load_spike_problem',label:'Belastungssprung',note:'Akute Last deutlich über dem Schnitt — Verletzungsrisiko.'});
  if(o.hardDaysInRow>=2)out.push({key:'planning_conflict',label:'Planungskonflikt',note:'Mehrere harte Tage direkt hintereinander.'});
  if(o.lowHrv&&o.poorSleep&&(L.load7||0)>0)out.push({key:'recovery_deficit',label:'Regenerationsdefizit',note:'Hohe Last + niedrige HRV + schlechter Schlaf.'});
  if(o.easyShare!=null&&o.easyShare<0.7)out.push({key:'intensity_distribution_problem',label:'Intensitätsverteilung',note:'Zu wenig wirklich lockeres Volumen (80/20 verfehlt).'});
  if(o.kneeAfterLegRun)out.push({key:'interference_problem',label:'Interferenz',note:'Kniebeschwerden nach Leg Day + Lauf — Belastungen entkoppeln.'});
  return out;
}

/* ============ ZENTRALE TRAININGSENTSCHEIDUNG (Phase 1) — Quelle der Wahrheit ============ */
function buildTrainingDecision(input){
  var i=input||{},c=i.checkin||{},L=i.loads||{};
  var planned=i.plannedToday||null,tt=classifyTrainingType(planned);
  // normalisierter Input (eine Quelle): painRegion ≠ domsRegion, hardPlanned aus tt
  var n={pain:c.pain||0,painRegion:c.painRegion||c.region||'',doms:c.doms||0,domsRegion:c.domsRegion||'',
    illSinceEnd:(c.illSinceEnd!=null?c.illSinceEnd:null),illDuration:(c.illDuration||0),
    illness:!!c.illness,sleepH:c.sleepH,sleepQ:c.sleepQ,feel:c.feel,motivation:c.motivation,
    stress:c.stress,hrv:c.hrv,rhrDev:c.rhrDev,sleepDebtH:c.sleepDebtH,readiness:c.readiness,
    loads:L,hardPlanned:!!(tt.hard||(tt.legLoad&&tt.intensity!=='low'))};
  var safety=safetyCheck(c);
  var ti=(i.todayIndex!=null?i.todayIndex:0);
  // Fester Termin (Spiel/Wettkampf) in 0–2 Tagen?
  var matchConflict=null;
  (i.fixedEvents||[]).forEach(function(ev){if(ev.type==='match'||ev.type==='race'){var dd=ev.day-ti;if(dd>=0&&dd<=2&&(matchConflict==null||dd<matchConflict.days))matchConflict={ev:ev,days:dd};}});
  // Evaluatoren
  var rec=evaluateRecoveryState(n);
  var pdm=evaluatePainAndDOMS(n,tt);
  var load=evaluateLoadAndInterference(n,tt);
  var stateInput={pain:n.pain,region:n.painRegion,illness:n.illness,illSinceEnd:n.illSinceEnd,illDuration:n.illDuration,doms:n.doms,domsHits:(pdm&&pdm.doms)?pdm.doms.hits:undefined,
    /* v9: Schmerz-Regionaltreffer aus derselben Quelle wie der Muskelkater. */
    painHits:(pdm&&pdm.pain)?pdm.pain.hits:undefined,sleepH:n.sleepH,sleepQ:n.sleepQ,feel:n.feel,motivation:n.motivation,stress:n.stress,hrv:n.hrv,readiness:n.readiness,load3:L.load3,load7:L.load7,load14:L.load14};
  var ds=dayStateEngine(stateInput);
  // State-Hierarchie: Safety-RED > Schmerz≥8 RED > Krankheit (mind. ORANGE, nicht zwingend RED) > dayState
  var state;
  if(safety.level==='red')state='RED';
  else if(n.pain>=8)state='RED';
  else{
    state=ds.state;
    if(n.illness&&state==='RED'){var ds2=dayStateEngine(Object.assign({},stateInput,{illness:false}));state=(ds2.state==='RED')?'RED':'ORANGE';}
  }
  // I3a.1: Last-Wirksamkeit (fail-closed). Ist die AKUTE Last nicht belastbar (unbekannt oder
  // nur geschätzt, oder kanonischer Provider fehlt ⇒ acuteAssessable===false), wird die
  // lastabhängige Entscheidung konservativ: KEIN GREEN, kein Peak, keine Intensitätssteigerung.
  // Nur herabstufen, nie herauf; gemessene/vollständige Last (true/undefined) bleibt unberührt.
  var _loadNotAssessable=(L.acuteAssessable===false);
  /* ═══ v9 · „GESCHAETZT" IST NICHT DASSELBE WIE „UNBEKANNT" ══════════════
     BEFUND (Gian, 16.08.): „Akute Lasten nicht belastbar, nur geschaetzt
     (/unbekannt) — warum ist das unbekannt?" Ursache: knownForSafety
     (activity-config.js:767) verlangt, dass JEDER der letzten 7 Tage
     AUSSCHLIESSLICH gemessene sRPE-Last traegt. Eine einzige Garmin-Einheit
     ohne nachgetragenes RPE genuegt, damit das dauerhaft falsch ist. Damit war
     die zweite Dauersperre gegen Gruen aktiv — und eine Sicherheitsregel, die
     jeden Tag feuert, ist keine Warnung mehr, sondern Hintergrundrauschen.
     UNTERSCHEIDUNG, die vorher fehlte: Eine GESCHAETZTE Last ist eine Zahl mit
     Unsicherheit (Dauer × Standardintensitaet) — die Richtung stimmt. Eine
     UNBEKANNTE Last ist eine Luecke: dort kann eine harte Einheit stehen, von
     der das System nichts weiss. Nur der zweite Fall rechtfertigt es, Gruen zu
     sperren; der erste rechtfertigt einen Hinweis und das Peak-Verbot.
     WIDERRUFBAR: Wer maximal konservativ bleiben will, setzt
     `_loadOnlyEstimated` fest auf false — dann gilt exakt das alte Verhalten. */
  var _mi=L.missingness||{};
  var _loadOnlyEstimated=(_loadNotAssessable&&_mi.unknownDays===0&&(_mi.estimatedLoad||0)>0);
  if(_loadNotAssessable&&!_loadOnlyEstimated&&state==='GREEN')state='YELLOW';
  // Session-Anpassung
  var sess=adaptSessionPlan(Object.assign({},planned||{},{kind:tt.type}),{state:state,flags:ds.flags},{region:n.painRegion,doms:n.doms});
  if(matchConflict&&planned&&(tt.hard||tt.legLoad)&&(state==='GREEN'||state==='YELLOW')){
    sess={action:'MOVE_SESSION',label:'Vor '+(matchConflict.ev.title||'Spiel/Wettkampf')+' entlasten',
      detail:'Keine harte Bein-/Intensitätsbelastung '+(matchConflict.days<=1?'24 h':'48 h')+' vor dem Termin — heute locker oder verschieben.',
      reason:'Fester Termin in '+matchConflict.days+' Tag(en) — Frische schützen.'};
  }
  if(safety.level==='red'){sess={action:safety.critical?'REST':'REPLACE_WITH_RECOVERY',
    label:safety.critical?'Trainingspause':'Sehr leichte Bewegung / Pause',detail:safety.advice,reason:safety.redFlags.join(', ')};}
  else if(n.illness&&state==='ORANGE'&&tt.hard){sess={action:'REPLACE_WITH_RECOVERY',label:'Leichte Bewegung statt harter Einheit',detail:safety.advice||'Mit Krankheitssymptomen keine Intensität — nur lockere Bewegung bei mildem Zustand.',reason:'Krankheitssymptome'};}
  var ev={safety:safety,recovery:rec,pdm:pdm,load:load,ctx:{matchConflict:matchConflict}};
  /* ═══ v9 · DIE HEADLINE IST JETZT WIRKLICH DIE SUMME IHRER GRUPPEN ══════
     BEFUND (Gian, 16.08.): „Erholung 85, Belastungskontrolle 74, Umsetzung 80
     — und daraus entsteht 85? Passt irgendwie nicht." Es passte tatsaechlich
     nicht: die Headline war AUSSCHLIESSLICH die Erholung, die beiden anderen
     Gruppen gingen mit 0 % ein, standen aber unter der Ueberschrift „So
     entsteht dein Score". combineScore() existierte, war aber toter Code,
     sobald recovery vorlag.
     ENTSCHEIDUNG GIAN (16.08.): wirklich aggregieren.
     GEWICHTE 60/25/15 — Erholung dominiert bewusst weiter (sie ist die
     einzige physiologisch gemessene Groesse); Belastungskontrolle ist der
     zweitwichtigste Hebel fuer Verletzungsrisiko; Umsetzung bekommt das
     kleinste Gewicht, weil sie Verhalten misst, nicht Zustand.
     BEKANNTER PREIS DIESER ENTSCHEIDUNG (bewusst getragen, nicht uebersehen):
     eine Woche mit wenig Training senkt die Zahl, obwohl die Erholung top ist.
     Wer die Zahl rein diagnostisch lesen will, findet die Erholung unveraendert
     als eigenen Subscore.
     RENORMALISIERUNG: fehlende Gruppen werden aus der Gewichtung ENTFERNT,
     nicht mit einem Ersatzwert gefuellt — sonst wuerde eine fehlende Umsetzung
     wie eine schlechte Umsetzung wirken. */
  var _compIn=i.components||{recovery:(c.readiness!=null?c.readiness:null)};
  combineHeadline.lastParts=null;
  var rawScore=combineHeadline(_compIn);
  var _headlineParts=combineHeadline.lastParts||null;   // sofort sichern, bevor irgendwer neu rechnet
  var score=applyDecisionCaps(rawScore,n,ev,state,tt);
  // Subscores (anzeige-fertig, einheitlich „höher = besser")
  var comp=i.components||{};
  /* v9: `weight` = der TATSAECHLICH verwendete, renormalisierte Anteil in
     Prozent. Die Anzeige darf keine Gewichte behaupten, mit denen nicht
     gerechnet wurde — fehlt eine Gruppe, verschieben sich die anderen. */
  var _wOf=function(nm){if(!_headlineParts)return null;for(var q=0;q<_headlineParts.length;q++)if(_headlineParts[q].name===nm)return _headlineParts[q].weight;return null;};
  var subscores={
    recovery:{value:(comp.recovery!=null?Math.round(comp.recovery):rec.score0_100),label:'Erholung',weight:_wOf('Erholung')},
    control:{value:(comp.riskRaw!=null?Math.round(100-comp.riskRaw):null),label:'Belastungskontrolle',weight:_wOf('Belastungskontrolle')},
    execution:{value:(comp.execution!=null?Math.round(comp.execution):null),label:'Umsetzung',weight:_wOf('Umsetzung')}
  };
  // Status streng an State gekoppelt; Peak nur bei sehr sauberem Zustand
  var goodSleep=(n.sleepH==null||n.sleepH>=6)&&(n.sleepQ==null||n.sleepQ>=6);
  /* v9: Peak setzt vollstaendig bekannte Last voraus — das war vorher ueber das
     GREEN→YELLOW-Downgrade impliziert und muss jetzt explizit dastehen. */
  var peakOK=(state==='GREEN'&&sess.action==='KEEP'&&score>=85&&!n.illness&&n.pain<3&&n.doms<5&&safety.level==='none'&&goodSleep&&n.stress!=='High'&&!_loadNotAssessable);
  var statusText=peakOK?'Peak':{GREEN:'Bereit',YELLOW:'Reduzieren empfohlen',ORANGE:'Anpassen',RED:'Regeneration'}[state];
  var triggers=buildTriggerHighlights(ev);
  // Wochen-Anpassung + sichtbarer Ersatz-Slot
  var weekAdjustments=[],weekPlanAdjusted=null;
  if(i.weekPlan&&i.todayIndex!=null){
    var wk=adaptWeekPlan(i.weekPlan.map(function(day){return (day||[]).map(function(it){return Object.assign({},it,{kind:classifyTrainingType(it).type});});}),
      {todayIndex:ti,state:state,illness:n.illness,fixedEvents:i.fixedEvents});
    weekAdjustments=wk.changes;weekPlanAdjusted=wk.plan;
    if(weekPlanAdjusted&&sess.action!=='KEEP'&&planned){
      var origItem=Object.assign({},planned);delete origItem.kind;
      var repType=(sess.action==='SWAP_MODALITY')?(/rad|bike/i.test(sess.label||'')?'Rad':'Mobilität')
        :((sess.action==='REST'||sess.action==='REPLACE_WITH_RECOVERY')?'Mobilität':planned.t);
      weekPlanAdjusted[ti]=[{t:repType,l:'Ersatz für '+(planned.l||'Einheit')+': '+sess.label,d:sess.detail||'',
        adaptiveReplacement:true,actionType:sess.action,reason:sess.reason,originalSession:origItem,source:'adaptive_engine'}];
    }
  }
  var riskFlags={
    kneeRisk:pdm.pain.impactRegion&&pdm.pain.pain>=4,illnessRisk:n.illness,
    overloadRisk:load.loadSpike,domsRisk:pdm.doms.doms>=7&&pdm.doms.hits,
    matchConflictRisk:!!matchConflict,safetyRisk:safety.level==='red'
  };
  var reasons=ds.reasons.slice();
  /* v9: verständlich formuliert und nach Ursache getrennt — der alte Text
     („nur geschätzt/unbekannt") nannte beide Faelle gleichzeitig und sagte
     nicht, was zu tun ist. */
  if(_loadOnlyEstimated)reasons.unshift('Trainingslast der letzten 7 Tage teils geschätzt (RPE fehlt) — Zahl belastbar, harte Steigerung trotzdem vorsichtig');
  else if(_loadNotAssessable)reasons.unshift('Trainingslast der letzten 7 Tage lückenhaft — konservativ bewertet, bis die Einheiten vollständig sind');
  if(matchConflict)reasons.unshift('Fester Termin in '+matchConflict.days+' Tag(en)');
  if(safety.redFlags.length)reasons=safety.redFlags.concat(reasons);
  var DECISION={GREEN:'Trainieren',YELLOW:'Reduzieren',ORANGE:'Ersetzen',RED:'Pausieren'};
  var avoidedSession=(sess.action!=='KEEP'&&planned)?{label:(planned.l||'geplante Einheit'),type:tt.type,sport:tt.sport}:null;
  var userMessage='Heute: '+state+' — '+DECISION[state]+'. '+(avoidedSession?('Kein '+avoidedSession.label+'. '):'')+(sess.detail?sess.detail+' ':'')+(reasons.length?('Grund: '+reasons.slice(0,3).join(', ')+'.'):'');
  var coachSummary='state='+state+'|action='+sess.action+'|score='+score+'|risks='+(Object.keys(riskFlags).filter(function(k){return riskFlags[k];}).join(',')||'-')+'|reasons='+reasons.slice(0,4).join(',');
  var dq=i.dataQuality||{};
  return {
    dayState:state,score:score,subscores:subscores,statusText:statusText,triggers:triggers,
    /* v9: Rechenweg der Headline, damit die Anzeige nicht raten muss.
       rawScore = vor den Sicherheitsdeckeln, score = danach. Wenn beide
       auseinanderfallen, hat ein Deckel gegriffen — und das gehoert sichtbar. */
    scoreParts:_headlineParts,scoreRaw:rawScore,scoreCapped:(rawScore!==score),
    readinessReasons:reasons,riskFlags:riskFlags,todayAction:sess.action,
    recommendedSession:{action:sess.action,label:sess.label,detail:sess.detail},
    avoidedSession:avoidedSession,
    weekAdjustments:weekAdjustments,weekPlanAdjusted:weekPlanAdjusted,
    recovery:rec,painDoms:pdm,load:load,
    userMessage:userMessage,coachSummary:coachSummary,
    confidence:dq.confidence||'mittel',dataQuality:dq,
    loadAssessable:!_loadNotAssessable,loadMissingness:(L.missingness||null),
    safety:safety,sportProfile:sportProfileFor(i.goal||(i.profile&&i.profile.primaryGoal)),
    deficits:detectDeficits(i.deficitContext||{})
  };
}

/* ============ ZWISCHEN-CHECK-INS (live/pre/post) → TRAININGSENTSCHEIDUNG ============
   Verschärfen die ENTSCHEIDUNG (dayState/action/Gründe), NICHT den Readiness-Score.
   Score bleibt morgenbasiert (keine Re-Vermischung, kein 64-Cap durch Zwischenwerte).
   Eskalation nur nach oben; ein guter Pre/Live senkt die Schwere nie unter den Morgen-Stand. */
var _STATE_ORDER=['GREEN','YELLOW','ORANGE','RED'];
function _sevRank(s){var i=_STATE_ORDER.indexOf(s);return i<0?0:i;}
function _rankState(r){return _STATE_ORDER[Math.max(0,Math.min(3,r))];}
/* Bewertet einen einzelnen Zwischen-Check-in. label = Quelle für die Begründung. */
function evaluateExtraState(c,label){
  if(!c||typeof c!=='object')return {sev:0,reasons:[],hard:false};
  var reasons=[],sev=0,hard=false,pain=null;
  if(c.knee!=null)pain=c.knee;
  if(Array.isArray(c.complaints))c.complaints.forEach(function(x){if(x&&x.score!=null&&(pain==null||x.score>pain))pain=x.score;});
  if(c.illness){sev=Math.max(sev,3);hard=true;reasons.push(label+': Krankheitssymptome');}
  if(pain!=null&&pain>=6){sev=Math.max(sev,3);hard=true;reasons.push(label+': Schmerz '+pain+'/10');}
  else if(pain!=null&&pain>=4){sev=Math.max(sev,2);reasons.push(label+': Schmerz '+pain+'/10');}
  if(c.doms!=null&&c.doms>=8){sev=Math.max(sev,2);reasons.push(label+': DOMS '+c.doms+'/10');}
  else if(c.doms!=null&&c.doms>=6){sev=Math.max(sev,1);reasons.push(label+': DOMS '+c.doms+'/10');}
  if(c.feel!=null&&c.feel<=3){sev=Math.max(sev,2);reasons.push(label+': Befinden '+c.feel+'/10');}
  else if(c.feel!=null&&c.feel<=4){sev=Math.max(sev,1);reasons.push(label+': Befinden '+c.feel+'/10');}
  if(c.legs!=null&&c.legs<=3){sev=Math.max(sev,2);reasons.push(label+': Beinkraft '+c.legs+'/10');}
  else if(c.legs!=null&&c.legs<=5){sev=Math.max(sev,1);reasons.push(label+': Beinkraft '+c.legs+'/10');}
  if(c.bb!=null&&c.bb<20){sev=Math.max(sev,2);reasons.push(label+': Body Battery '+c.bb+'%');}
  else if(c.bb!=null&&c.bb<35){sev=Math.max(sev,1);reasons.push(label+': Body Battery '+c.bb+'%');}
  if(c.stress==='High'){sev=Math.max(sev,1);reasons.push(label+': Stress hoch');}
  return {sev:sev,reasons:reasons,hard:hard};
}
/* Wendet live/pre/post auf eine bestehende Entscheidung an. extras={live,pre,post}.
   Priorität für die Entscheidung: Pre > Live > Morning > Post. Score bleibt unverändert. */
function escalateWithExtras(decision,extras){
  if(!decision)return decision;
  extras=extras||{};
  var base=_sevRank(decision.dayState);
  var pre=evaluateExtraState(extras.pre,'Vor dem Training');
  var live=evaluateExtraState(extras.live,'Live-Check-in');
  var post=evaluateExtraState(extras.post,'Nach dem Training');
  var newSev=Math.max(base,pre.sev,live.sev);
  var out=Object.assign({},decision);
  out.readinessScore=decision.score;        // Readiness explizit getrennt, NIE verändert
  out.escalatedBy=null;
  if(newSev>base){
    out.dayState=_rankState(newSev);
    if(newSev>=3){out.todayAction='REPLACE_WITH_RECOVERY';
      out.recommendedSession={action:'REPLACE_WITH_RECOVERY',label:'Einheit stoppen / ersetzen',
        detail:'Akutes Signal vor/bei dem Training — heute nur sehr leichte Bewegung oder Pause.'};}
    else if(newSev>=2){out.todayAction='REDUCE_VOLUME';
      out.recommendedSession={action:'REDUCE_VOLUME',label:'Umfang reduzieren',
        detail:'Aktueller Zustand schlechter als am Morgen — Einheit kürzer/leichter.'};}
    out.statusText={GREEN:'Bereit',YELLOW:'Reduzieren empfohlen',ORANGE:'Anpassen',RED:'Regeneration'}[out.dayState]||out.statusText;
    out.escalatedBy=(pre.sev>=live.sev&&pre.sev>0)?'pre':(live.sev>0?'live':null);
  }
  var extraReasons=pre.reasons.concat(live.reasons);   // Pre vor Live
  if(extraReasons.length){
    out.readinessReasons=extraReasons.concat(decision.readinessReasons||[]);
    out.triggers=(decision.triggers||[]).slice();
    if(pre.reasons.length)out.triggers.unshift({title:'Vor dem Training',detail:pre.reasons[0].replace(/^Vor dem Training:\s*/,'')});
    else if(live.reasons.length)out.triggers.unshift({title:'Live-Check-in',detail:live.reasons[0].replace(/^Live-Check-in:\s*/,'')});
    out.triggers=out.triggers.slice(0,4);
  }
  // Post: NUR Warnung für WEITERE Einheiten — kein Eingriff in abgeschlossene Einheit oder Score.
  if(post.sev>=2){
    out.furtherUnitsLimited=true;
    out.postWarning=post.reasons[0]+' – keine weitere intensive Einheit heute.';
    out.readinessReasons=(out.readinessReasons||decision.readinessReasons||[]).slice();
    out.readinessReasons.push(out.postWarning);
  }
  return out;
}

/* Table-basierter Lastsprung für Trends/Insights aus training_load_daily-Aggregat.
   series=[{local_date,load}] aufsteigend. Liefert konkrete Zahlen NUR bei genügend Historie
   (≥7 Tage), sonst {enough:false} — kein erfundener Prozentwert. Deckelt die Readiness nicht. */
function loadSpikeInfo(series){
  // Erwartet eine KALENDER-vollständige Reihe (fehlende Tage = 0; via getDailyLoadSeries fillMissing).
  // Akutes Fenster 3 Tage, chronisches 7 Tage, Mindesthistorie 7 Kalendertage.
  // Datenqualität: mind. 3 Aktivitätstage in den letzten 7, sonst keine Sprungerkennung.
  var loads=(series||[]).map(function(s){return +s.load||0;});
  if(loads.length<7)return{enough:false,reason:'zu wenig Historie (<7 Tage)'};
  var last7=loads.slice(-7);var dataDays=last7.filter(function(v){return v>0;}).length;
  if(dataDays<3)return{enough:false,reason:'zu wenig Aktivitätstage (Datenqualität)',dataDays:dataDays};
  var a=avg(loads.slice(-3)),c=avg(last7);
  if(c==null||c<=0)return{enough:false,reason:'keine chronische Last',dataDays:dataDays};
  var ratio=a/c,pct=Math.round((ratio-1)*100);
  return{enough:true,acute:Math.round(a),chronic:Math.round(c),ratio:+ratio.toFixed(2),spikePct:pct,spike:ratio>1.4,dataDays:dataDays};
}

/* ---- Pace-Zonen aus Zielzeit + Distanz (Riegel-Modell, sec/km) ---- */
function paceZones(distanceKm,targetMin){
  if(!distanceKm||!targetMin)return null;
  const rt=function(d){return targetMin*Math.pow(d/distanceKm,1.06);};   // Renn-Zeit (min) für Distanz d
  const pp=function(d){return rt(d)*60/d;};                              // Renn-Pace sec/km
  const p3=pp(3),p5=pp(5),p10=pp(10),pHM=pp(21.0975),pM=pp(42.195),pMile=pp(1.609);
  const tgt=targetMin*60/distanceKm;
  const Z=[
    ['Zielpace',tgt,tgt],
    ['Recovery',pM+70,pM+108],
    ['Easy',pM+46,pM+78],
    ['Long Run',pM+36,pM+68],
    ['Marathon',pM-6,pM+10],
    ['Halbmarathon',pHM-6,pHM+8],
    ['Tempo / Schwelle',p10,pHM],
    ['10 km',p10-5,p10+7],
    ['5 km',p5-5,p5+6],
    ['Intervall (VO2)',p3,p5],
    ['Strides',pMile-14,pMile+4]
  ];
  return Z.map(function(z){return {k:z[0],lo:Math.round(Math.min(z[1],z[2])),hi:Math.round(Math.max(z[1],z[2]))};});
}
/* ---- Energie/Ernährung (Mifflin-St Jeor + trainingsabhängige Makros) ---- */
function bmr(sex,age,heightCm,weightKg){
  if(!weightKg||!heightCm)return null;
  var s=(sex==='f'||sex==='w')?-161:((sex==='m')?5:-78);
  return Math.round(10*weightKg+6.25*heightCm-5*(age||30)+s);
}
function nutritionTargets(p){
  // p: {sex,age,heightCm,weightKg, goal, activity, deficitKcal, surplusKcal, proteinPerKg, dayType, trainingBurn}
  var b=bmr(p.sex,p.age,p.heightCm,p.weightKg);if(!b||!p.weightKg)return null;
  var burn=Math.max(0,Math.round(p.trainingBurn||0));
  var base,maint;
  if(p.tdee!=null&&isFinite(p.tdee)&&p.tdee>0){
    /* Phase 7 (2026-07-18): dynamischer Gesamtumsatz aus dem energy-expenditure-
       resolver — enthält Schritte/Training/TEF bereits. Double-Counting-Matrix:
       hier wird NICHTS mehr addiert; base ist nur die Anzeige "ohne Training". */
    maint=Math.round(p.tdee);base=maint-burn;
  }else{
    /* Fallback ohne Resolver (Audit-Befund 4): Aktivitätsfaktor = ALLTAG OHNE
       Training (NEAT); Training kommt ausschließlich separat als burn dazu. */
    var actF={sedentary:1.25,light:1.35,moderate:1.45,high:1.55}[p.activity||'light']||1.35;
    base=Math.round(b*actF);                            // Grundbedarf ohne Training
    maint=base+burn;                                    // Erhaltung für den Tag
  }
  var goal=p.goal||'maintain';
  var hard=(p.dayType==='long'||p.dayType==='quality');
  var adj=0;
  if(goal==='fatloss'){adj=-(p.deficitKcal||400);if(hard)adj=Math.max(adj,-200);}   // kein extremes Defizit an harten Tagen
  else if(goal==='muscle')adj=+(p.surplusKcal||250);
  var kcal=Math.max(Math.round(b*1.05),maint+adj);      // nie unter ~BMR*1.05
  var protein=Math.round(p.weightKg*(p.proteinPerKg||1.9));
  var fat=Math.round(p.weightKg*(hard?0.8:0.95));
  var carbs=Math.max(Math.round((kcal-protein*4-fat*9)/4),Math.round(p.weightKg*(hard?5:3)));
  var ea=Math.round((kcal-burn)/p.weightKg);            // grobe Energieverfügbarkeit kcal/kg
  return {kcal:kcal,protein:protein,carbs:carbs,fat:fat,base:base,burn:burn,maint:maint,ea:ea,bmr:b,hard:hard,goal:goal,dayType:p.dayType};
}
const Calc={HM_KM,RACE_DATE,avg,median,sd,clampC,fmtPace,fmtTime,fmtDuration,paceZones,bmr,nutritionTargets,ewma,sessionLoad,acwr,
  loadModel,loadSeries,loadConfidenceContract,weekKmTarget,effectiveKmTarget,runnaWeek,planStatus,resolvePlanActual,activityDuplicate,racePhases,buildIntervals,swimPace100,aggregateMuscleVolume,muscleVolumeStatus,muscleWeeklyEquivalent,muscleTargetRange,activityPlausibility,moveActivity,isValidRunForAnalytics,applyActivityPatchPreview,racePhase,trendDir,readiness,ampel,hrvScoreOf,riegel,riegelHM,goalEngine,
  easyShare,easyShareDetail,weeklyJump,lrTarget,hrSpread,easyTooHard,efSeries,nextRunRec,heavyLegs,sleepDebt,weightHint,
  recentRunStats,calculateRecommendedWeeklyRunVolume,
  dayStateEngine,adaptSessionPlan,adaptWeekPlan,
  classifyTrainingType,SPORT_PROFILES,sportProfileFor,safetyCheck,detectDeficits,buildTrainingDecision,
  evaluateExtraState,escalateWithExtras,loadSpikeInfo,
  evaluatePainImpact,evaluateDomsImpact,evaluatePainAndDOMS,evaluateRecoveryState,evaluateLoadAndInterference,
  applyDecisionCaps,stateSeverity,hrvBelowBaseline,illnessReturnWindow,buildTriggerHighlights,combineScore,combineHeadline};
root.Calc=Calc;
if(typeof module!=='undefined'&&module.exports)module.exports=Calc;
})(typeof window!=='undefined'?window:globalThis);
