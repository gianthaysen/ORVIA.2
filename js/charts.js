/* ============================================================
   CHART LAYER — Chart.js-Wrapper, Dark-Theme, Guards, kein Leak
   ============================================================ */
let charts={};
function thm(){return {tick:'#656c79',grid:'#1a2330',leg:'#b8b4aa'};}
function chartOK(){return typeof Chart!=='undefined';}
function killChart(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function chartGuard(wrapId){ // freundlicher Hinweis statt totem Tab, wenn CDN offline
  const w=document.getElementById(wrapId);
  if(w)w.innerHTML='<p class="muted" style="padding-top:50px;text-align:center">Charts brauchen einmalig Internet (Bibliothek wird danach gecacht).</p>';
}

function drawLine(id,labels,sets,opt){
  if(!chartOK())return;
  opt=opt||{};const T=thm();killChart(id);
  const el=document.getElementById(id);if(!el)return;
  const ds=sets.map(s=>({label:s.label,data:s.data,borderColor:s.color,backgroundColor:s.color+'1f',
    fill:!s.y2,tension:.35,spanGaps:true,pointRadius:3,pointBackgroundColor:s.color,borderWidth:2.5,yAxisID:s.y2?'y2':'y'}));
  if(opt.goal!=null)ds.push({label:'Ziel',data:labels.map(()=>opt.goal),borderColor:'#2a3342',borderDash:[5,4],pointRadius:0,borderWidth:1.5,fill:false});
  charts[id]=new Chart(el,{type:'line',data:{labels,datasets:ds},
    options:{maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},
      plugins:{legend:{labels:{color:T.leg,boxWidth:10,usePointStyle:true,font:{size:11,weight:'600'}}}},
      scales:{x:{ticks:{color:T.tick,font:{size:9},maxRotation:0,autoSkip:true,maxTicksLimit:7},grid:{color:T.grid}},
        y:{suggestedMin:opt.minAuto?undefined:0,suggestedMax:opt.max,ticks:{color:T.tick,font:{size:9}},grid:{color:T.grid}},
        y2:{display:false,suggestedMin:0,grid:{display:false}}}}});
}

function drawBarLine(id,labels,bar,line,opt){
  if(!chartOK())return;
  opt=opt||{};const T=thm();killChart(id);
  const el=document.getElementById(id);if(!el)return;
  const ds=[{type:'bar',label:bar.label,data:bar.data,backgroundColor:(bar.color||'#c9ae7c')+'80',yAxisID:'y'}];
  if(opt.goalY!=null)ds.push({type:'line',label:opt.goalLabel||'Ziel',data:labels.map(()=>opt.goalY),borderColor:'#2a3342',borderDash:[5,4],pointRadius:0,borderWidth:1.5,yAxisID:'y'});
  if(line)ds.push({type:'line',label:line.label,data:line.data,borderColor:line.color,pointBackgroundColor:line.color,tension:.35,spanGaps:true,pointRadius:2,borderWidth:2.5,yAxisID:'y2'});
  charts[id]=new Chart(el,{data:{labels,datasets:ds},
    options:{maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},
      plugins:{legend:{labels:{color:T.leg,boxWidth:10,usePointStyle:true,font:{size:10,weight:'600'}}}},
      scales:{x:{ticks:{color:T.tick,font:{size:9},maxTicksLimit:8},grid:{display:false}},
        y:{suggestedMin:0,suggestedMax:opt.maxY,ticks:{color:T.tick,font:{size:9}},grid:{color:T.grid}},
        y2:{position:'right',display:!!line,suggestedMin:opt.minY2??0,suggestedMax:opt.maxY2,ticks:{color:line?line.color:T.tick,font:{size:9}},grid:{display:false}}}}});
}

/* Form-Kurve CTL/ATL/TSB — rechnet über die GESAMTE Historie (Fix Kaltstart) */
function drawForm(id,loadsAll,labelsAll){
  if(!chartOK())return;
  const T=thm();killChart(id);
  const el=document.getElementById(id);if(!el)return;
  const ctl=Calc.ewma(loadsAll,42),atl=Calc.ewma(loadsAll,7);
  const tsb=ctl.map((c,i)=>+(c-atl[i]).toFixed(1));
  const sl=a=>a.slice(-28);const L=sl(labelsAll);
  charts[id]=new Chart(el,{data:{labels:L,datasets:[
    {type:'line',label:'Fitness (CTL)',data:sl(ctl).map(x=>+x.toFixed(0)),borderColor:'#c9ae7c',backgroundColor:'#c9ae7c1f',fill:true,tension:.35,pointRadius:0,borderWidth:2.5,yAxisID:'y'},
    {type:'line',label:'Fatigue (ATL)',data:sl(atl).map(x=>+x.toFixed(0)),borderColor:'#fb7185',fill:false,tension:.35,pointRadius:0,borderWidth:2,yAxisID:'y'},
    {type:'line',label:'Form (TSB)',data:sl(tsb),borderColor:'#16a34a',borderDash:[4,3],fill:false,tension:.35,pointRadius:0,borderWidth:2,yAxisID:'y2'}]},
    options:{maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},
      plugins:{legend:{labels:{color:T.leg,boxWidth:10,usePointStyle:true,font:{size:10,weight:'600'}}}},
      scales:{x:{ticks:{color:T.tick,font:{size:9},maxRotation:0,autoSkip:true,maxTicksLimit:7},grid:{color:T.grid}},
        y:{ticks:{color:T.tick,font:{size:9}},grid:{color:T.grid}},
        y2:{position:'right',ticks:{color:'#16a34a',font:{size:9}},grid:{display:false}}}}});
  return{ctl,atl,tsb};
}
