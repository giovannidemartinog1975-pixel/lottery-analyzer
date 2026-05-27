import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import {
  ComposedChart, LineChart, BarChart, Line, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
  AreaChart, Area, Legend
} from "recharts";
// ═══════════════════════════════════════════════════════════════
// DATI PERSISTENTI — NON MODIFICARE QUESTE CHIAVI localStorage
// Biglietti giocati:  tickets_euromillions_v1
// Estrazioni extra:   draws_euromillions_v1
// Tutte le modifiche future devono preservare questi dati.
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// DATABASE EUROMILLIONS — AGGIORNATO AL 19/05/2026
// ═══════════════════════════════════════════════════════════════
const DRAWS = [
  { n:1,  date:"02/01", nums:[29,33,47,56,69,89], jolly:16, superstar:7 },
  { n:2,  date:"03/01", nums:[16,30,32,43,68,76], jolly:36, superstar:58 },
  { n:3,  date:"05/01", nums:[11,13,17,56,80,84], jolly:41, superstar:13 },
  { n:4,  date:"08/01", nums:[35,42,45,53,55,88], jolly:66, superstar:52 },
  { n:5,  date:"09/01", nums:[31,33,61,68,71,72], jolly:87, superstar:18 },
  { n:6,  date:"10/01", nums:[11,19,24,66,82,88], jolly:58, superstar:48 },
  { n:7,  date:"12/01", nums:[1,7,11,14,37,58],   jolly:70, superstar:22 },
  { n:8,  date:"13/01", nums:[20,29,56,68,72,74], jolly:35, superstar:50 },
  { n:9,  date:"15/01", nums:[44,49,60,69,73,85], jolly:36, superstar:1 },
  { n:10, date:"16/01", nums:[14,21,24,52,80,86], jolly:57, superstar:14 },
  { n:11, date:"17/01", nums:[37,41,56,65,83,86], jolly:79, superstar:82 },
  { n:12, date:"20/01", nums:[8,13,25,60,72,74],  jolly:78, superstar:34 },
  { n:13, date:"22/01", nums:[2,30,52,56,57,78],  jolly:59, superstar:25 },
  { n:14, date:"23/01", nums:[26,11,19,88,90,52], jolly:69, superstar:52 },
  { n:15, date:"24/01", nums:[22,37,55,61,68,71], jolly:21, superstar:18 },
  { n:16, date:"27/01", nums:[11,19,27,31,54,84], jolly:38, superstar:37 },
  { n:17, date:"29/01", nums:[29,30,34,56,66,80], jolly:88, superstar:11 },
  { n:18, date:"30/01", nums:[32,33,39,40,52,86], jolly:63, superstar:16 },
  { n:19, date:"31/01", nums:[2,6,7,33,73,78],    jolly:11, superstar:80 },
  { n:20, date:"03/02", nums:[11,16,17,41,42,46], jolly:70, superstar:57 },
  { n:21, date:"05/02", nums:[6,26,27,57,68,90],  jolly:41, superstar:30 },
  { n:22, date:"06/02", nums:[6,8,17,31,36,75],   jolly:90, superstar:82 },
  { n:23, date:"07/02", nums:[4,7,12,30,69,81],   jolly:41, superstar:67 },
  { n:24, date:"10/02", nums:[1,9,15,29,39,63],   jolly:73, superstar:21 },
  { n:25, date:"12/02", nums:[5,11,35,52,80,85],  jolly:66, superstar:29 },
  { n:26, date:"13/02", nums:[1,5,25,71,76,83],   jolly:37, superstar:3 },
  { n:27, date:"14/02", nums:[5,23,40,47,80,85],  jolly:6,  superstar:47 },
  { n:28, date:"17/02", nums:[16,21,42,45,52,88], jolly:58, superstar:21 },
  { n:29, date:"19/02", nums:[20,39,40,43,76,90], jolly:53, superstar:53 },
  { n:30, date:"20/02", nums:[30,34,41,42,49,83], jolly:64, superstar:77 },
  { n:31, date:"21/02", nums:[49,58,60,66,68,81], jolly:75, superstar:58 },
  { n:32, date:"24/02", nums:[4,18,23,26,45,87],  jolly:82, superstar:29 },
  { n:33, date:"26/02", nums:[18,30,36,52,67,72], jolly:69, superstar:47 },
  { n:34, date:"27/02", nums:[10,14,49,55,71,79], jolly:80, superstar:36 },
  { n:35, date:"28/02", nums:[14,17,33,63,64,80], jolly:15, superstar:27 },
  { n:36, date:"03/03", nums:[4,16,42,48,56,68],  jolly:26, superstar:83 },
  { n:37, date:"05/03", nums:[7,23,39,62,63,78],  jolly:22, superstar:35 },
  { n:38, date:"06/03", nums:[4,17,22,37,50,88],  jolly:20, superstar:2 },
  { n:39, date:"07/03", nums:[3,12,18,40,45,69],  jolly:5,  superstar:49 },
  { n:40, date:"10/03", nums:[8,34,42,47,55,83],  jolly:4,  superstar:42 },
  { n:41, date:"12/03", nums:[8,24,25,62,63,64],  jolly:43, superstar:54 },
  { n:42, date:"13/03", nums:[3,11,13,20,53,61],  jolly:88, superstar:43 },
  { n:43, date:"14/03", nums:[3,6,33,63,88,89],   jolly:18, superstar:87 },
  { n:44, date:"17/03", nums:[2,13,16,41,53,56],  jolly:60, superstar:6 },
  { n:45, date:"19/03", nums:[19,39,45,54,62,89], jolly:42, superstar:45 },
  { n:46, date:"20/03", nums:[14,32,45,51,54,87], jolly:61, superstar:50 },
  { n:47, date:"21/03", nums:[9,26,33,49,51,55],  jolly:50, superstar:4 },
  { n:48, date:"24/03", nums:[6,54,60,64,74,87],  jolly:10, superstar:65 },
  { n:49, date:"26/03", nums:[24,26,39,69,77,80], jolly:82, superstar:3 },
  { n:50, date:"27/03", nums:[6,22,27,43,58,64],  jolly:10, superstar:74 },
  { n:51, date:"28/03", nums:[9,45,62,67,68,81],  jolly:36, superstar:54 },
  { n:52, date:"31/03", nums:[1,3,39,46,47,61],   jolly:25, superstar:67 },
  { n:53, date:"02/04", nums:[18,24,25,32,36,63], jolly:40, superstar:80 },
  { n:54, date:"03/04", nums:[28,52,53,64,66,72], jolly:44, superstar:6 },
  { n:55, date:"04/04", nums:[8,21,29,46,60,81],  jolly:42, superstar:80 },
  { n:56, date:"07/04", nums:[10,16,18,47,50,59], jolly:7,  superstar:60 },
  { n:57, date:"09/04", nums:[2,30,38,63,74,84],  jolly:19, superstar:82 },
  { n:58, date:"10/04", nums:[3,10,13,17,58,90],  jolly:32, superstar:7 },
  { n:59, date:"11/04", nums:[19,28,38,48,77,85], jolly:59, superstar:57 },
  { n:60, date:"14/04", nums:[3,5,20,27,35,66],   jolly:17, superstar:6 },
  { n:61, date:"16/04", nums:[9,11,12,38,44,54],  jolly:60, superstar:39 },
  { n:62, date:"17/04", nums:[13,27,45,53,57,84], jolly:34, superstar:63 },
  { n:63, date:"18/04", nums:[11,22,28,33,68,77], jolly:9,  superstar:70 },
  { n:64, date:"21/04", nums:[18,19,40,43,56,77], jolly:6,  superstar:65 },
  { n:65, date:"23/04", nums:[18,24,28,35,56,58], jolly:72, superstar:57 },
  { n:66, date:"24/04", nums:[6,13,33,37,68,82],  jolly:56, superstar:20 },
  { n:67, date:"27/04", nums:[40,57,62,64,85,87], jolly:23, superstar:56 },
  { n:68, date:"28/04", nums:[29,42,43,47,57,60], jolly:27, superstar:30 },
  { n:69, date:"30/04", nums:[6,7,15,44,52,58],   jolly:40, superstar:16 },
  { n:70, date:"02/05", nums:[7,58,60,79,84,86],  jolly:2,  superstar:19 },
  { n:71, date:"04/05", nums:[3,14,31,46,61,63],  jolly:75, superstar:24 },
  { n:72, date:"05/05", nums:[24,34,45,55,81,87], jolly:23, superstar:52 },
  { n:73, date:"07/05", nums:[1,34,48,66,69,73],  jolly:75, superstar:58 },
  { n:74, date:"08/05", nums:[8,16,41,47,51,90],  jolly:82, superstar:69 },
  { n:75, date:"09/05", nums:[9,27,30,42,43,62],  jolly:11, superstar:11 },
  { n:76, date:"12/05", nums:[2,28,31,57,58,59],  jolly:5,  superstar:2 },
  { n:77, date:"14/05", nums:[31,56,72,74,84,85], jolly:18, superstar:34 },
  { n:78, date:"15/05", nums:[5,13,17,28,47,68],  jolly:42, superstar:19 },
  { n:79, date:"16/05", nums:[7,12,60,69,89,90],  jolly:59, superstar:36 },
  { n:80, date:"19/05", nums:[49,57,61,73,79,86], jolly:8,  superstar:36 },
  { n:81, date:"21/05", nums:[1,38,57,58,64,81],  jolly:28, superstar:50 },
  { n:82, date:"22/05", nums:[5,17,65,71,83,87],  jolly:50, superstar:86 },
  { n:83, date:"24/05", nums:[14,29,34,57,59,69], jolly:16, superstar:16 },
  { n:84, date:"16/05", nums:[7,10,35,41,45,61],  jolly:2,  superstar:45 },
];

const MU_TEO    = 277.5;
const SIGMA_TEO = 62;
const JACKPOT = "163.200.000 €";
const ACCENT    = "#D4AF37";
const POOL      = 90;
const PICK      = 6;
const SUPERSTAR_POOL = 90;
const POPULAR   = new Set([1,2,3,4,5,10,20,30,40,50]);
const LS_KEY_S = "draws_superenalotto_v1";
const LS_TICKETS_S = "tickets_superenalotto_v1";

// ═══════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════
const DrawsContext = createContext([]);
const useDraws = () => useContext(DrawsContext);

// Premi
const PRIZE_LABELS = {0:"–",1:"–",2:"Punto 2",3:"Punto 3",4:"Punto 4",5:"🏆 PUNTI 5!"};
const PRIZE_COLORS = {0:"#4A4A6A",1:"#4A4A6A",2:"#4A8FD4",3:"#2BA89A",4:"#E8B84B",5:"#C94040"};

function calcPunti(ticketNums, extractedNums){
  return ticketNums.filter(n => extractedNums.includes(n)).length;
}

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
const sm   = a => a.reduce((s,v)=>s+v,0);
const avg  = a => sm(a)/a.length;
const std  = a => { const m=avg(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length); };
const clamp= (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const zOf  = (v,mu,sigma) => (v-mu)/sigma;

function mkRng(seed){
  let s=seed>>>0;
  return ()=>{s=Math.imul(s^s>>>15,s|1);s^=s+Math.imul(s^s>>>7,s|61);return((s^s>>>14)>>>0)/4294967296;};
}

function buildSeries(draws, muRef=MU_TEO, sigRef=SIGMA_TEO){
  return draws.map((d,i)=>{
    const s=sm(d.nums);
    const sl=draws.slice(0,i+1).map(x=>sm(x.nums));
    const rm=avg(sl);
    const ma5=i>=4?avg(draws.slice(i-4,i+1).map(x=>sm(x.nums))):null;
    return {...d,sum:s,mu:parseFloat(rm.toFixed(2)),
      delta:parseFloat((s-muRef).toFixed(1)),
      zScore:parseFloat(zOf(s,muRef,sigRef).toFixed(3)),ma5};
  });
}

function scoreNumbers(draws, winSize){
  const w=draws.slice(-winSize);
  const expFreq=w.length*PICK/POOL;
  const sigma=Math.sqrt(expFreq*(1-PICK/POOL));
  const freq=Array(POOL+1).fill(0);
  w.forEach(d=>d.nums.forEach(n=>freq[n]++));
  return Array.from({length:POOL},(_,i)=>{
    const num=i+1,f=freq[num];
    const z=(f-expFreq)/sigma;
    const unpop=POPULAR.has(num)?0.35:(num>Math.floor(POOL*0.35)?1.3:1.0);
    return {num,f,z,score:Math.abs(z)*unpop,isCold:z<-0.4,isHot:z>0.4};
  });
}

function generateSuperStar(seed){
  const rng=mkRng(seed+12345);
  return Math.floor(rng()*90)+1;
}

function generateTicket(scored, strategy, loB, hiB, muRef, seed){
  const rng=mkRng(seed);
  let pool;
  if(strategy==="cold") pool=[...scored].sort((a,b)=>a.z-b.z);
  else if(strategy==="unpop") pool=[...scored].sort((a,b)=>b.score-a.score);
  else pool=[...scored].sort((a,b)=>b.score-a.score);
  pool=pool.map(c=>({...c,_s:c.score+rng()*0.25})).sort((a,b)=>b._s-a._s).slice(0,35);
  let best=null,bestDist=Infinity;
  for(let t=0;t<30000;t++){
    const sh=[...pool].sort(()=>rng()-0.5).slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);
    const s=sm(sh),d=Math.abs(s-muRef);
    if(s>=loB&&s<=hiB&&d<bestDist){best=sh;bestDist=d;if(d<5)break;}
  }
  if(!best){
    const fullPool=[...scored].sort((a,b)=>b.score-a.score);
    const rng2=mkRng(seed+99999);
    for(let t=0;t<50000&&!best;t++){
      const sh=[...fullPool].sort(()=>rng2()-0.5).slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);
      if(sm(sh)>=loB&&sm(sh)<=hiB) best=sh;
    }
    if(!best) best=fullPool.slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);
  }
  return {nums:best,sum:sm(best),inBand:sm(best)>=loB&&sm(best)<=hiB};
}

function parseNums(str){
  return str.split(/[\s,;]+/).map(s=>parseInt(s.trim())).filter(n=>!isNaN(n)&&n>=1&&n<=POOL);
}

function calcStats(draws){
  const sums=draws.map(d=>sm(d.nums));
  const parities=draws.map(d=>d.nums.filter(n=>n%2===0).length);
  const freq={};
  draws.forEach(d=>d.nums.forEach(n=>{freq[n]=(freq[n]||0)+1;}));
  return {
    sumMean:avg(sums),sumStd:std(sums),
    sumMin:Math.min(...sums),sumMax:Math.max(...sums),
    parityDist:Array.from({length:PICK+1},(_,k)=>({
      k,count:parities.filter(p=>p===k).length,
      pct:(parities.filter(p=>p===k).length/draws.length*100).toFixed(1),
    })),
    freq,
  };
}

// ═══════════════════════════════════════════════════════════════
// COLORI & COMPONENTI BASE
// ═══════════════════════════════════════════════════════════════
const C={
  gold:"#E8B84B",orange:"#F07030",teal:"#2BA89A",blue:"#4A8FD4",
  red:"#C94040",purple:"#8A5CC4",green:"#4A9E5C",
  bg:"#07070F",card:"#0D0D1A",border:"#1A1A2E",text:"#C8C8D8",dim:"#4A4A6A",
};

const TT=({active,payload,label})=>{
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:"#0e0e20",border:"1px solid #252540",borderRadius:8,padding:"8px 12px",fontSize:12}}>
      <div style={{color:ACCENT,fontWeight:700,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||"#aaa",marginBottom:2}}>
          {p.name}: <strong style={{fontFamily:"monospace"}}>{typeof p.value==="number"?p.value.toFixed(2):p.value}</strong>
        </div>
      ))}
    </div>
  );
};

function calcSSAffinita(num, allDraws, ticketSum, sigmaRef){
  const freq=allDraws.filter(d=>d.superstar===num).length;
  const freqPct=freq/allDraws.length;
  const simDraws=allDraws.filter(d=>Math.abs(sm(d.nums)-ticketSum)<=sigmaRef);
  const coFreq=simDraws.length>0?simDraws.filter(d=>d.superstar===num).length/simDraws.length:freqPct;
  let lastIdx=-1;
  for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].superstar===num){lastIdx=i;break;}}
  const ritardoPct=Math.min((lastIdx===-1?allDraws.length:allDraws.length-1-lastIdx)/allDraws.length,1);
  return freqPct*0.40+coFreq*0.35+ritardoPct*0.25;
}
function getSSSuggestions(allDraws, ticketSum, sigmaRef){
  const scores=Array.from({length:90},(_,i)=>i+1).map(n=>({
    num:n, freq:allDraws.filter(d=>d.superstar===n).length,
    ritardo:(()=>{for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].superstar===n)return allDraws.length-1-i;}return allDraws.length;})(),
    score:calcSSAffinita(n,allDraws,ticketSum,sigmaRef),
  }));
  const maxScore=Math.max(...scores.map(s=>s.score));
  return scores.map(s=>({...s,pct:Math.round(s.score/maxScore*100)})).sort((a,b)=>b.score-a.score);
}

function Ball({num,color=ACCENT,size=38,glow=false,gold=false,star=false}){
  return(
    <div style={{
      width:size,height:size,
      borderRadius:star?"20%":"50%",
      background:gold?`radial-gradient(circle at 35% 32%,#FFD700,#FF6B35)`:`radial-gradient(circle at 35% 32%,${color}cc,${color}33)`,
      border:`2px solid ${gold?"#FFD700":color}`,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size>38?14:size>28?12:10,fontWeight:900,
      color:gold?"#0a0a0a":"#fff",fontFamily:"monospace",
      boxShadow:glow?`0 0 14px ${gold?"#FFD70099":`${color}88`}`:"none",
      flexShrink:0,
    }}>{num}</div>
  );
}

function KpiCard({label,value,sub,color=ACCENT}){
  return(
    <div style={{background:C.card,border:`1px solid ${color}22`,borderTop:`2px solid ${color}`,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
      <div style={{color:C.dim,fontSize:9,marginBottom:2,textTransform:"uppercase",letterSpacing:1}}>{label}</div>
      <div style={{color,fontSize:18,fontWeight:900,fontFamily:"monospace"}}>{value}</div>
      {sub&&<div style={{color:C.dim,fontSize:9,marginTop:2}}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CANVAS
// ═══════════════════════════════════════════════════════════════
const PAD={top:48,right:32,bottom:52,left:50};

function drawCanvas(canvas,series,frame,showMA5,hovered,W,H){
  if(!canvas) return;
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+"px"; canvas.style.height=H+"px";
  ctx.scale(dpr,dpr);
  const CW=W-PAD.left-PAD.right, CH=H-PAD.top-PAD.bottom;
  const total=series.length;
  const visible=Math.min(Math.ceil(frame),total);
  const frac=frame-Math.floor(frame);
  const toX=i=>PAD.left+(i/(Math.max(total-1,1)))*CW;
  const toY=v=>PAD.top+(1-(v-20)/(240-20))*CH;

  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);

  [20,50,80,110,127.5,150,180,210,240].forEach(v=>{
    const y=toY(v),isMu=v===127.5;
    ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+CW,y);
    ctx.setLineDash(isMu?[6,3]:[2,6]);
    ctx.strokeStyle=isMu?`${ACCENT}44`:"rgba(255,255,255,0.05)";
    ctx.lineWidth=isMu?1.5:1; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=isMu?`${ACCENT}88`:"rgba(255,255,255,0.25)";
    ctx.font=`${isMu?"bold ":""}9px monospace`; ctx.textAlign="right";
    ctx.fillText(isMu?"127.5":Math.round(v),PAD.left-5,y+3);
  });

  for(let i=0;i<total;i++){
    const x=toX(i);
    ctx.beginPath(); ctx.moveTo(x,PAD.top); ctx.lineTo(x,PAD.top+CH);
    ctx.setLineDash([1,8]); ctx.strokeStyle="rgba(255,255,255,0.04)"; ctx.lineWidth=1; ctx.stroke(); ctx.setLineDash([]);
    if(i===0||i===total-1||i%Math.ceil(total/5)===0){
      ctx.fillStyle="rgba(255,255,255,0.3)"; ctx.font="9px monospace"; ctx.textAlign="center";
      ctx.fillText(series[i].date,x,PAD.top+CH+14);
    }
  }

  ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(PAD.left,PAD.top); ctx.lineTo(PAD.left,PAD.top+CH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD.left,PAD.top+CH); ctx.lineTo(PAD.left+CW,PAD.top+CH); ctx.stroke();

  if(visible<2) return;

  ctx.beginPath();
  ctx.moveTo(toX(0),toY(series[0].mu));
  for(let i=1;i<visible-1;i++) ctx.lineTo(toX(i),toY(series[i].mu));
  if(visible>=2){
    const px=toX(visible-2),py=toY(series[visible-2].mu);
    const cx2=toX(visible-1),cy=toY(series[visible-1].mu);
    ctx.lineTo(px+(cx2-px)*Math.min(frac,1),py+(cy-py)*Math.min(frac,1));
  }
  ctx.lineTo(toX(Math.min(visible-1,total-1)),PAD.top+CH);
  ctx.lineTo(toX(0),PAD.top+CH); ctx.closePath();
  const grad=ctx.createLinearGradient(0,PAD.top,0,PAD.top+CH);
  grad.addColorStop(0,`${ACCENT}18`); grad.addColorStop(1,`${ACCENT}02`);
  ctx.fillStyle=grad; ctx.fill();

  function line(vals,col,w,dash=[]){
    ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle=col; ctx.lineWidth=w;
    let started=false;
    for(let i=0;i<visible;i++){
      if(vals[i]==null) continue;
      const x=toX(i),y=toY(vals[i]);
      if(!started){ctx.moveTo(x,y);started=true;}
      else if(i===visible-1&&frac<1){
        const prev=vals[i-1];
        if(prev!=null){const px=toX(i-1),py=toY(prev);ctx.lineTo(px+(x-px)*frac,py+(y-py)*frac);}
      }else ctx.lineTo(x,y);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }

  if(showMA5) line(series.map(d=>d.ma5),`${ACCENT}66`,1.5,[4,3]);
  ctx.shadowBlur=12; ctx.shadowColor=`${ACCENT}66`;
  line(series.map(d=>d.mu),ACCENT,2.5);
  ctx.shadowBlur=0;

  for(let i=0;i<visible;i++){
    const x=toX(i),yS=toY(series[i].sum),yM=toY(series[i].mu);
    ctx.beginPath(); ctx.moveTo(x,yS); ctx.lineTo(x,yM);
    ctx.strokeStyle="rgba(255,255,255,0.06)"; ctx.lineWidth=1; ctx.stroke();
    const isHov=hovered===i;
    const dotCol=series[i].sum>MU_TEO?C.orange:C.teal;
    ctx.beginPath(); ctx.arc(x,yS,isHov?6:3.5,0,Math.PI*2);
    ctx.fillStyle=dotCol; ctx.shadowBlur=isHov?14:0; ctx.shadowColor=dotCol;
    ctx.fill(); ctx.shadowBlur=0;
  }

  if(frame<total){
    const li=Math.min(visible-1,total-1),lx=toX(li),ly=toY(series[li].mu);
    const pulse=(Math.sin(Date.now()*0.005)+1)/2;
    ctx.beginPath(); ctx.arc(lx,ly,4+pulse*4,0,Math.PI*2);
    ctx.strokeStyle=ACCENT+Math.round((0.5-pulse*0.4)*255).toString(16).padStart(2,"0");
    ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(lx,ly,4,0,Math.PI*2);
    ctx.fillStyle=ACCENT; ctx.shadowBlur=12; ctx.shadowColor=ACCENT; ctx.fill(); ctx.shadowBlur=0;
  }

  if(hovered!==null&&hovered<visible){
    const d=series[hovered];
    const x=toX(hovered),y=toY(d.sum);
    const bx=Math.min(x+10,W-168),by=Math.max(PAD.top,y-88);
    ctx.fillStyle="rgba(8,8,20,0.95)"; ctx.strokeStyle=`${ACCENT}66`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(bx,by,162,88,8); ctx.fill(); ctx.stroke();
    ctx.fillStyle=ACCENT; ctx.font="bold 11px monospace"; ctx.textAlign="left";
    ctx.fillText(`#${d.n} · ${d.date}`,bx+10,by+18);
    ctx.fillStyle=d.sum>MU_TEO?C.orange:C.teal;
    ctx.fillText(`Σ = ${d.sum}`,bx+10,by+34);
    ctx.fillStyle=ACCENT;
    ctx.fillText(`μ prog. = ${d.mu.toFixed(1)}`,bx+10,by+50);
    ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.font="10px monospace";
    ctx.fillText(`Δ=${d.sum>MU_TEO?"+":""}${d.sum-MU_TEO}  z=${d.zScore.toFixed(2)}`,bx+10,by+66);
    ctx.fillText(`SuperStar: ${d.superstar?.join("-")||"—"}`,bx+10,by+80);
  }

  if(visible>=1){
    const li=Math.min(visible-1,total-1),lx=toX(li),ly=toY(series[li].mu);
    ctx.fillStyle=ACCENT; ctx.font="bold 11px monospace";
    ctx.textAlign=lx>W-120?"right":"left";
    ctx.fillText(`μ=${series[li].mu.toFixed(1)}`,lx+(lx>W-120?-8:8),ly-8);
  }
}

// ═══════════════════════════════════════════════════════════════
// TAB 1 — ANIMAZIONE
// ═══════════════════════════════════════════════════════════════
function TabAnimazione(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const [frame,setFrame]=useState(1);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(0.5);
  const [showMA5,setShowMA5]=useState(true);
  const [hovered,setHovered]=useState(null);
  const frameRef=useRef(1),rafRef=useRef(null),canvasRef=useRef(null),containerRef=useRef(null);
  const [W,setW]=useState(660);
  const total=series.length;

  useEffect(()=>{
    const obs=new ResizeObserver(e=>{setW(Math.max(280,Math.floor(e[0].contentRect.width)-28));});
    if(containerRef.current) obs.observe(containerRef.current);
    return()=>obs.disconnect();
  },[]);

  const animate=useCallback(()=>{
    if(frameRef.current>=total){setPlaying(false);return;}
    frameRef.current=Math.min(frameRef.current+speed*0.1,total);
    setFrame(frameRef.current);
    rafRef.current=requestAnimationFrame(animate);
  },[speed,total]);

  useEffect(()=>{
    if(playing) rafRef.current=requestAnimationFrame(animate);
    else cancelAnimationFrame(rafRef.current);
    return()=>cancelAnimationFrame(rafRef.current);
  },[playing,animate]);

  useEffect(()=>{drawCanvas(canvasRef.current,series,frame,showMA5,hovered,W,260);},[frame,showMA5,hovered,W,series]);
  useEffect(()=>{
    if(!playing){const id=setInterval(()=>drawCanvas(canvasRef.current,series,frame,showMA5,hovered,W,260),50);return()=>clearInterval(id);}
  },[playing,frame,showMA5,hovered,W,series]);

  const onMove=e=>{
    const rect=canvasRef.current.getBoundingClientRect();
    const mx=e.clientX-rect.left;
    const CW=W-PAD.left-PAD.right;
    let best=null,bestD=26;
    const vis=Math.min(Math.ceil(frame),total);
    for(let i=0;i<vis;i++){const x=PAD.left+(i/(Math.max(total-1,1)))*CW,d=Math.abs(mx-x);if(d<bestD){bestD=d;best=i;}}
    setHovered(best);
  };

  const play=()=>{if(frame>=total){frameRef.current=1;setFrame(1);}setPlaying(true);};
  const pause=()=>setPlaying(false);
  const reset=()=>{cancelAnimationFrame(rafRef.current);setPlaying(false);frameRef.current=1;setFrame(1);};
  const end=()=>{cancelAnimationFrame(rafRef.current);setPlaying(false);frameRef.current=total;setFrame(total);};
  const vi=Math.min(Math.ceil(frame)-1,total-1);
  const cur=series[vi];

  return(
    <div ref={containerRef}>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>
        📈 Traiettoria Media Progressiva — {series[0]?.date} → {series[total-1]?.date}
      </h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:12}}>
        <KpiCard label="Concorso" value={`#${cur.n}`} sub={cur.date}/>
        <KpiCard label="Σ Sestina" value={cur.sum} color={cur.sum>MU_TEO?C.orange:C.teal} sub={`Δ=${cur.sum>MU_TEO?"+":""}${cur.sum-MU_TEO}`}/>
        <KpiCard label="μ progressiva" value={cur.mu.toFixed(1)} color={ACCENT} sub={`Δ da 127.5: ${(cur.mu-MU_TEO).toFixed(1)}`}/>
        <KpiCard label="z-score" value={cur.zScore.toFixed(2)} color={Math.abs(cur.zScore)<1?C.green:Math.abs(cur.zScore)<2?C.orange:C.red}/>
        <KpiCard label="SuperStar" value={cur.superstar||"—"} color="#FFD700"/>
      </div>
      <div style={{borderRadius:10,overflow:"hidden",border:"1px solid #1a1a2e",marginBottom:10}}>
        <canvas ref={canvasRef} style={{display:"block",cursor:"crosshair",width:"100%"}} onMouseMove={onMove} onMouseLeave={()=>setHovered(null)}/>
      </div>
      <input type="range" min={1} max={total} step={0.05} value={frame}
        onChange={e=>{cancelAnimationFrame(rafRef.current);setPlaying(false);frameRef.current=+e.target.value;setFrame(+e.target.value);}}
        style={{width:"100%",accentColor:ACCENT,cursor:"pointer",marginBottom:8}}/>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.dim,marginBottom:12}}>
        <span>{series[0]?.date}</span>
        <span style={{color:ACCENT}}>{Math.ceil(frame)}/{total} estrazioni</span>
        <span>{series[total-1]?.date}</span>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
        {[{i:"⟪",a:reset},{i:playing?"⏸":"▶",a:playing?pause:play,gold:true},{i:"⟫",a:end}].map((b,idx)=>(
          <button key={idx} onClick={b.a} style={{
            background:b.gold?`linear-gradient(135deg,${ACCENT},${C.teal})`:"rgba(255,255,255,0.05)",
            color:b.gold?"#fff":"#aaa",border:`1px solid ${b.gold?ACCENT:"rgba(255,255,255,0.1)"}`,
            borderRadius:10,padding:"9px 16px",fontSize:b.gold?18:14,fontWeight:900,minWidth:46,cursor:"pointer",
          }}>{b.i}</button>
        ))}
        <div style={{display:"flex",gap:4}}>
          {[0.2,0.5,1,2].map(s=>(
            <button key={s} onClick={()=>setSpeed(s)} style={{
              background:speed===s?`${C.teal}22`:"transparent",color:speed===s?C.teal:C.dim,
              border:`1px solid ${speed===s?C.teal:"rgba(255,255,255,0.08)"}`,
              borderRadius:6,padding:"5px 9px",fontSize:10,cursor:"pointer",fontFamily:"inherit",
            }}>{s}×</button>
          ))}
        </div>
        <button onClick={()=>setShowMA5(v=>!v)} style={{
          background:showMA5?`${ACCENT}11`:"transparent",color:showMA5?`${ACCENT}88`:C.dim,
          border:`1px solid ${showMA5?`${ACCENT}44`:"rgba(255,255,255,0.08)"}`,
          borderRadius:16,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",
        }}>— MA5</button>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px"}}>
        <div style={{color:C.dim,fontSize:9,marginBottom:5}}>μ progressiva — clicca per saltare</div>
        <div style={{display:"flex",gap:2,alignItems:"flex-end",height:30}}>
          {series.map((d,i)=>{
            const isVis=i<Math.ceil(frame),isCur=i===Math.min(Math.ceil(frame)-1,total-1);
            const h=Math.max(3,((d.mu-80)/(180-80))*28);
            return(
              <div key={i} onClick={()=>{frameRef.current=i+1;setFrame(i+1);setPlaying(false);}}
                title={`#${d.n} μ=${d.mu.toFixed(1)}`}
                style={{flex:1,height:h,borderRadius:"2px 2px 0 0",cursor:"pointer",
                  background:isCur?ACCENT:isVis?`${ACCENT}66`:"rgba(255,255,255,0.06)",
                  boxShadow:isCur?`0 0 8px ${ACCENT}88`:"none"}}/>
            );
          })}
        </div>
      </div>

      {/* ── GRAFICO PARI/DISPARI ── */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginTop:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:4}}>☯️ Andamento Pari / Dispari per estrazione</div>
        <div style={{color:C.dim,fontSize:10,marginBottom:10}}>
          Distribuzione pari (P) e dispari (D) in ciascuna cinquina. Media storica:{" "}
          <strong style={{color:ACCENT}}>
            {(allDraws.map(d=>d.nums.filter(n=>n%2===0).length).reduce((a,b)=>a+b,0)/allDraws.length).toFixed(2)}P
          </strong> su 5.
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={allDraws.map(d=>({
            date:d.date,n:d.n,
            pari:d.nums.filter(n=>n%2===0).length,
            dispari:d.nums.filter(n=>n%2!==0).length,
          }))} margin={{top:4,right:8,bottom:0,left:-20}}>
            <CartesianGrid strokeDasharray="2 4" stroke="#0e0e1c"/>
            <XAxis dataKey="date" tick={{fill:C.dim,fontSize:8}} interval={Math.ceil(allDraws.length/6)}/>
            <YAxis domain={[0,5]} ticks={[0,1,2,3,4,5]} tick={{fill:C.dim,fontSize:8}}/>
            <Tooltip content={({active,payload,label})=>{
              if(!active||!payload?.length) return null;
              return(<div style={{background:"#0e0e20",border:"1px solid #252540",borderRadius:8,padding:"8px 12px",fontSize:11}}>
                <div style={{color:ACCENT,fontWeight:700,marginBottom:4}}>{label}</div>
                <div style={{color:"#4A9E5C"}}>Pari: <strong>{payload[0]?.value}</strong></div>
                <div style={{color:"#F07030"}}>Dispari: <strong>{payload[1]?.value}</strong></div>
              </div>);
            }}/>
            <ReferenceLine y={2.5} stroke={`${ACCENT}55`} strokeDasharray="5 3" strokeWidth={1}/>
            <Bar dataKey="pari" stackId="a" fill="#4A9E5C" name="Pari"/>
            <Bar dataKey="dispari" stackId="a" fill="#F07030" name="Dispari" radius={[3,3,0,0]}/>
            <Legend wrapperStyle={{fontSize:10,color:C.dim}}/>
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:5,marginTop:10,flexWrap:"wrap"}}>
          {[0,1,2,3,4,5].map(k=>{
            const count=allDraws.filter(d=>d.nums.filter(n=>n%2===0).length===k).length;
            const pct=(count/allDraws.length*100).toFixed(0);
            const maxCount=Math.max(...[0,1,2,3,4,5].map(j=>allDraws.filter(d=>d.nums.filter(n=>n%2===0).length===j).length));
            const isMode=count===maxCount;
            return(
              <div key={k} style={{flex:1,background:isMode?`${ACCENT}18`:"#080816",
                border:`1px solid ${isMode?ACCENT:C.border}`,borderRadius:7,padding:"6px 4px",textAlign:"center"}}>
                <div style={{color:"#4A9E5C",fontSize:11,fontWeight:700}}>{k}P</div>
                <div style={{color:"#F07030",fontSize:10}}>{5-k}D</div>
                <div style={{background:"#0a0a18",borderRadius:3,height:4,overflow:"hidden",margin:"3px 0"}}>
                  <div style={{background:isMode?ACCENT:C.teal,height:"100%",width:`${pct}%`}}/>
                </div>
                <div style={{color:isMode?ACCENT:C.dim,fontSize:9,fontWeight:isMode?700:400}}>{pct}%</div>
                <div style={{color:C.dim,fontSize:8}}>{count}x</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── GRAFICO DECINE ── */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginTop:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:4}}>🔢 Distribuzione per Decine (1–90)</div>
        <div style={{color:C.dim,fontSize:10,marginBottom:10}}>
          Quanti numeri per decina vengono estratti mediamente. Aiuta a scremare cinquine con distribuzione anomala.
        </div>
        {(()=>{
          const decine=[
            {label:"1–10",min:1,max:10},
            {label:"11–20",min:11,max:20},
            {label:"21–30",min:21,max:30},
            {label:"31–40",min:31,max:40},
            {label:"41–50",min:41,max:50},
            {label:"51–60",min:51,max:60},
            {label:"61–70",min:61,max:70},
            {label:"71–80",min:71,max:80},
            {label:"81–90",min:81,max:90},
          ];
          const chartData=allDraws.map(d=>{
            const row={date:d.date};
            decine.forEach(dec=>{row[dec.label]=d.nums.filter(n=>n>=dec.min&&n<=dec.max).length;});
            return row;
          });
          const medie=decine.map(dec=>({
            label:dec.label,
            media:allDraws.reduce((s,d)=>s+d.nums.filter(n=>n>=dec.min&&n<=dec.max).length,0)/allDraws.length,
            totale:allDraws.reduce((s,d)=>s+d.nums.filter(n=>n>=dec.min&&n<=dec.max).length,0),
          }));
          const maxMedia=Math.max(...medie.map(m=>m.media));
          const DC=["#E8B84B","#F07030","#C94040","#8A5CC4","#4A8FD4","#2BA89A","#4A9E5C","#F07030","#E8B84B"];
          return(
            <div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{top:4,right:8,bottom:0,left:-20}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#0e0e1c"/>
                  <XAxis dataKey="date" tick={{fill:C.dim,fontSize:8}} interval={Math.ceil(allDraws.length/6)}/>
                  <YAxis domain={[0,6]} ticks={[0,1,2,3,4,5,6]} tick={{fill:C.dim,fontSize:8}}/>
                  <Tooltip content={({active,payload,label})=>{
                    if(!active||!payload?.length) return null;
                    return(<div style={{background:"#0e0e20",border:"1px solid #252540",borderRadius:8,padding:"8px 12px",fontSize:11}}>
                      <div style={{color:ACCENT,fontWeight:700,marginBottom:4}}>{label}</div>
                      {payload.filter(p=>p.value>0).map((p,i)=>(
                        <div key={i} style={{color:p.fill,marginBottom:2}}>{p.dataKey}: <strong>{p.value}</strong></div>
                      ))}
                    </div>);
                  }}/>
                  {decine.map((dec,i)=>(
                    <Bar key={dec.label} dataKey={dec.label} stackId="b" fill={DC[i]} radius={i===8?[3,3,0,0]:0}/>
                  ))}
                  <Legend wrapperStyle={{fontSize:10}}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(72px,1fr))",gap:5,marginTop:10}}>
                {medie.map((m,i)=>{
                  const isHot=m.media===maxMedia;
                  return(
                    <div key={m.label} style={{background:isHot?`${DC[i]}18`:"#080816",
                      border:`1px solid ${isHot?DC[i]:C.border}`,borderRadius:7,padding:"6px 4px",textAlign:"center"}}>
                      <div style={{color:DC[i],fontSize:9,fontWeight:700,marginBottom:3}}>{m.label}</div>
                      <div style={{background:"#0a0a18",borderRadius:3,height:4,overflow:"hidden",marginBottom:3}}>
                        <div style={{background:DC[i],height:"100%",width:`${(m.media/Math.max(maxMedia,0.1)*100)}%`}}/>
                      </div>
                      <div style={{color:isHot?DC[i]:C.text,fontSize:12,fontWeight:isHot?700:400,fontFamily:"monospace"}}>{m.media.toFixed(2)}</div>
                      <div style={{color:C.dim,fontSize:8}}>{m.totale} tot.</div>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:10,padding:"8px 10px",background:"#080816",borderRadius:8,border:`1px solid ${ACCENT}22`}}>
                <div style={{color:ACCENT,fontSize:10,fontWeight:700,marginBottom:5}}>
                  Ultima #{allDraws[allDraws.length-1].n}: decine rappresentate
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {decine.map((dec,i)=>{
                    const last=allDraws[allDraws.length-1];
                    const count=last.nums.filter(n=>n>=dec.min&&n<=dec.max).length;
                    return count>0?(
                      <div key={dec.label} style={{background:`${DC[i]}22`,border:`1px solid ${DC[i]}66`,
                        borderRadius:6,padding:"3px 8px",fontSize:10,color:DC[i],fontWeight:700}}>
                        {dec.label}: {count}
                      </div>
                    ):null;
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2 — SEGNALI & FREQUENZE
// ═══════════════════════════════════════════════════════════════
function TabSegnali(){
  const allDraws=useDraws();
  const [winSize,setWinSize]=useState(Math.min(10,allDraws.length));
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const scored=useMemo(()=>scoreNumbers(allDraws,winSize),[allDraws,winSize]);
  const stats=useMemo(()=>calcStats(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);
  const hotNums=[...scored].sort((a,b)=>b.z-a.z).slice(0,8);
  const coldNums=[...scored].sort((a,b)=>a.z-b.z).slice(0,8);
  const freqSorted=Object.entries(stats.freq).sort((a,b)=>b[1]-a[1]);
  const totalOcc=freqSorted.reduce((s,[,v])=>s+v,0);

  function getRitardo(num){
    for(let i=allDraws.length-1;i>=0;i--){
      if(allDraws[i].nums.includes(num)) return allDraws.length-1-i;
    }
    return allDraws.length;
  }

  const zCol=z=>Math.abs(z)>2?C.red:Math.abs(z)>1?C.orange:C.teal;

  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🔬 Segnali & Frequenze</h2>
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <span style={{color:C.dim,fontSize:11}}>Finestra:</span>
        {[3,5,8,10,allDraws.length].map(w=>(
          <button key={w} onClick={()=>setWinSize(Math.min(w,allDraws.length))} style={{
            background:winSize===Math.min(w,allDraws.length)?`${ACCENT}22`:"transparent",
            color:winSize===Math.min(w,allDraws.length)?ACCENT:C.dim,
            border:`1px solid ${winSize===Math.min(w,allDraws.length)?ACCENT:C.border}`,
            borderRadius:14,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",
          }}>{w===allDraws.length?"Tutte":w}</button>
        ))}
      </div>
      {[
        {l:"SEGNALE SOMME",z:zOf(muReale,MU_TEO,SIGMA_TEO/Math.sqrt(allDraws.length)),d:`μ reale: ${muReale.toFixed(1)} · teo: ${MU_TEO} · σ: ${sigmaReale.toFixed(1)}`},
        {l:"ANOMALIA MAX FREQUENZA",z:Math.max(...scored.map(s=>Math.abs(s.z))),d:`Più caldo: ${hotNums[0]?.num} (z=+${hotNums[0]?.z.toFixed(1)})`},
        {l:"SCOSTAMENTO DA MEDIA TEORICA",z:(muReale-MU_TEO)/sigmaReale,d:`Δ μ reale–teorica: ${(muReale-MU_TEO).toFixed(1)} punti`},
      ].map(item=>{
        const col=zCol(item.z);
        const label=Math.abs(item.z)>2?"⚠️ Anomalia forte":Math.abs(item.z)>1?"⚡ Anomalia lieve":"✓ Nella norma";
        return(
          <div key={item.l} style={{background:C.card,border:`1px solid ${col}33`,borderLeft:`3px solid ${col}`,borderRadius:8,padding:"10px 14px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{color:"#aaa",fontSize:12}}>{item.l}</span>
              <span style={{color:col,fontSize:11,fontWeight:700}}>{label} (z={item.z.toFixed(2)})</span>
            </div>
            <div style={{background:"#0a0a18",borderRadius:4,height:6,overflow:"hidden",marginBottom:4}}>
              <div style={{background:`linear-gradient(90deg,${C.teal},${col})`,width:`${clamp(Math.abs(item.z)/3*100,0,100)}%`,height:"100%"}}/>
            </div>
            <div style={{color:C.dim,fontSize:10}}>{item.d}</div>
          </div>
        );
      })}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:14}}>
        <div style={{background:C.card,border:`1px solid ${C.orange}33`,borderRadius:10,padding:12}}>
          <div style={{color:C.orange,fontWeight:700,fontSize:12,marginBottom:8}}>🔥 Più frequenti (finestra {winSize})</div>
          {hotNums.map(h=>(
            <div key={h.num} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
              <Ball num={h.num} color={C.orange} size={28}/>
              <div style={{flex:1,background:"#0a0a18",borderRadius:3,height:7,overflow:"hidden"}}>
                <div style={{background:C.orange,height:"100%",width:`${Math.min(h.f/Math.max(...hotNums.map(x=>x.f))*100,100)}%`}}/>
              </div>
              <span style={{color:C.orange,fontSize:10,fontFamily:"monospace",minWidth:64}}>{h.f}x · z=+{h.z.toFixed(1)}</span>
            </div>
          ))}
        </div>
        <div style={{background:C.card,border:`1px solid ${C.teal}33`,borderRadius:10,padding:12}}>
          <div style={{color:C.teal,fontWeight:700,fontSize:12,marginBottom:8}}>❄️ Più freddi (finestra {winSize})</div>
          {coldNums.map(h=>(
            <div key={h.num} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
              <Ball num={h.num} color={C.teal} size={28}/>
              <div style={{flex:1,background:"#0a0a18",borderRadius:3,height:7,overflow:"hidden"}}>
                <div style={{background:C.teal,height:"100%",width:`${clamp(Math.abs(h.z)/3*100,0,100)}%`}}/>
              </div>
              <span style={{color:C.teal,fontSize:10,fontFamily:"monospace",minWidth:64}}>{h.f}x · z={h.z.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{marginTop:14,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:12,marginBottom:8}}>🗺️ Mappa frequenze (1–50) · {allDraws.length} estrazioni</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:3,marginBottom:12}}>
          {scored.map(s=>{
            const maxF=Math.max(...scored.map(x=>x.f))||1;
            const intensity=clamp(s.f/maxF,0,1);
            const col=s.isCold?C.teal:s.isHot?C.orange:ACCENT;
            const pct=(s.f/totalOcc*100).toFixed(1);
            const rit=getRitardo(s.num);
            return(
              <div key={s.num} title={`${s.num}: ${s.f}x (${pct}% · rit.${rit})`} style={{
                aspectRatio:"1",
                background:`${col}${Math.round(intensity*180+40).toString(16).padStart(2,"0")}`,
                border:`1px solid ${col}22`,borderRadius:3,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:9,color:"#fff",fontFamily:"monospace",fontWeight:700,
              }}>{s.num}</div>
            );
          })}
        </div>
        <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Top 10 frequenti (% uscite · ritardo):</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
          {freqSorted.slice(0,10).map(([n,f])=>{
            const pct=(f/totalOcc*100).toFixed(1);
            const rit=getRitardo(+n);
            const pctRit=(rit/allDraws.length*100).toFixed(0);
            return(
              <div key={n} style={{background:`${ACCENT}11`,border:`1px solid ${ACCENT}33`,borderRadius:8,padding:"5px 8px",textAlign:"center"}}>
                <Ball num={+n} color={ACCENT} size={26}/>
                <div style={{color:ACCENT,fontSize:10,fontWeight:700}}>{f}x</div>
                <div style={{color:C.teal,fontSize:9}}>{pct}%</div>
                <div style={{color:C.dim,fontSize:9}}>rit.{rit}/{pctRit}%</div>
              </div>
            );
          })}
        </div>
        <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Top 10 ritardatari:</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
          {[...scored].sort((a,b)=>getRitardo(b.num)-getRitardo(a.num)).slice(0,10).map(s=>{
            const rit=getRitardo(s.num);
            const pctRit=(rit/allDraws.length*100).toFixed(0);
            const f=stats.freq[s.num]||0;
            const pctF=(f/totalOcc*100).toFixed(1);
            return(
              <div key={s.num} style={{background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:8,padding:"5px 8px",textAlign:"center"}}>
                <Ball num={s.num} color={C.teal} size={26}/>
                <div style={{color:C.teal,fontSize:10,fontWeight:700}}>{f}x</div>
                <div style={{color:C.teal,fontSize:9}}>{pctF}%</div>
                <div style={{color:C.orange,fontSize:9}}>rit.{rit}/{pctRit}%</div>
              </div>
            );
          })}
        </div>
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
          <div style={{color:"#FFD700",fontWeight:700,fontSize:12,marginBottom:8}}>⭐ Frequenze SuperStar (1–12)</div>
          {(()=>{
            const sf={};
            allDraws.forEach(d=>d.superstar?.forEach(s=>{sf[s]=(sf[s]||0)+1;}));
            const tot=Object.values(sf).reduce((s,v)=>s+v,0);
            return(
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {Array.from({length:12},(_,i)=>i+1).map(n=>{
                  const f=sf[n]||0;
                  const pct=tot?((f/tot)*100).toFixed(1):"0.0";
                  const allRev=[...allDraws].reverse();
                  const lastIdx=allRev.findIndex(d=>d.superstar?.includes(n));
                  const rit=lastIdx===-1?allDraws.length:lastIdx;
                  return(
                    <div key={n} style={{background:"#1a1a20",border:"1px solid #FFD70033",borderRadius:8,padding:"5px 8px",textAlign:"center"}}>
                      <Ball num={n} color="#FFD700" size={26}/>
                      <div style={{color:"#FFD700",fontSize:10,fontWeight:700}}>{f}x</div>
                      <div style={{color:C.teal,fontSize:9}}>{pct}%</div>
                      <div style={{color:C.dim,fontSize:9}}>rit.{rit}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3 — BANDA ADATTIVA
// ═══════════════════════════════════════════════════════════════
function TabBanda(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);
  const [kBand,setKBand]=useState(1.5);
  const [useAdaptive,setAdaptive]=useState(true);
  const muT=useAdaptive?muReale:MU_TEO;
  const sigT=useAdaptive?sigmaReale:SIGMA_TEO;
  const loB=Math.round(muT-kBand*sigT);
  const hiB=Math.round(muT+kBand*sigT);
  const inBand=series.filter(d=>d.sum>=loB&&d.sum<=hiB).length;
  const chartData=series.map(d=>({
    date:d.date,sum:d.sum,mu:d.mu,teorica:MU_TEO,
    loA:Math.round(muReale-kBand*sigmaReale),
    hiA:Math.round(muReale+kBand*sigmaReale),
  }));
  const bands=[0.5,1.0,1.5,2.0,2.5].map(k=>({k,
    loA:Math.round(muReale-k*sigmaReale),hiA:Math.round(muReale+k*sigmaReale),
    loT:Math.round(MU_TEO-k*SIGMA_TEO),hiT:Math.round(MU_TEO+k*SIGMA_TEO),
    inA:sums.filter(s=>s>=muReale-k*sigmaReale&&s<=muReale+k*sigmaReale).length,
    inT:sums.filter(s=>s>=MU_TEO-k*SIGMA_TEO&&s<=MU_TEO+k*SIGMA_TEO).length,
  }));

  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>📐 Banda Adattiva</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:14}}>
        <KpiCard label="μ reale" value={muReale.toFixed(1)} color={C.orange} sub={`Δ: ${(muReale-MU_TEO).toFixed(1)}`}/>
        <KpiCard label="σ reale" value={sigmaReale.toFixed(1)} color={C.teal} sub="Teo: 30"/>
        <KpiCard label="Min" value={Math.min(...sums)} color={C.teal}/>
        <KpiCard label="Max" value={Math.max(...sums)} color={C.red}/>
        <KpiCard label={`In banda ±${kBand}σ`} value={`${inBand}/${series.length}`} color={C.green} sub={`${(inBand/series.length*100).toFixed(0)}%`}/>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        {[0.5,1.0,1.5,2.0,2.5].map(k=>{
          const pct=(sums.filter(s=>s>=Math.round(muT-k*sigT)&&s<=Math.round(muT+k*sigT)).length/series.length*100).toFixed(0);
          return(
            <button key={k} onClick={()=>setKBand(k)} style={{
              background:kBand===k?`${ACCENT}22`:"transparent",color:kBand===k?ACCENT:C.dim,
              border:`1px solid ${kBand===k?ACCENT:C.border}`,borderRadius:8,padding:"5px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit",
            }}>
              <div style={{fontWeight:700}}>±{k}σ</div>
              <div style={{fontSize:9,color:kBand===k?C.teal:C.dim}}>{pct}%</div>
            </button>
          );
        })}
        {[{v:true,l:"Adattivo"},{v:false,l:"Teorico"}].map(x=>(
          <button key={String(x.v)} onClick={()=>setAdaptive(x.v)} style={{
            background:useAdaptive===x.v?`${C.teal}22`:"transparent",color:useAdaptive===x.v?C.teal:C.dim,
            border:`1px solid ${useAdaptive===x.v?C.teal:C.border}`,borderRadius:8,padding:"5px 12px",fontSize:10,cursor:"pointer",fontFamily:"inherit",
          }}>{x.l} μ={x.v?muReale.toFixed(0):MU_TEO}</button>
        ))}
        <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:"auto"}}>
          <span style={{color:C.teal,fontFamily:"monospace",fontWeight:700}}>{loB}</span>
          <span style={{color:C.dim}}>──</span>
          <span style={{color:ACCENT,fontFamily:"monospace",fontWeight:900,fontSize:15}}>μ{Math.round(muT)}</span>
          <span style={{color:C.dim}}>──</span>
          <span style={{color:C.orange,fontFamily:"monospace",fontWeight:700}}>{hiB}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{top:8,right:12,bottom:0,left:0}}>
          <defs>
            <linearGradient id="gBandaEM" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28}/>
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.08}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#0e0e1c"/>
          <XAxis dataKey="date" tick={{fill:C.dim,fontSize:9}} interval={2}/>
          <YAxis domain={[20,220]} tick={{fill:C.dim,fontSize:9}}/>
          <Tooltip content={<TT/>}/>
          <Area type="monotone" dataKey="hiA" stroke={`${ACCENT}cc`} strokeWidth={2} strokeDasharray="5 3" fill="url(#gBandaEM)" name="Banda +" activeDot={false}/>
          <Area type="monotone" dataKey="loA" stroke={`${ACCENT}cc`} strokeWidth={2} strokeDasharray="5 3" fill="#07070F" name="Banda −" activeDot={false}/>
          <ReferenceLine y={MU_TEO} stroke={`${ACCENT}99`} strokeDasharray="6 3" strokeWidth={1.5}
            label={{value:"127.5 teo.",fill:`${ACCENT}cc`,fontSize:9,position:"insideTopRight"}}/>
          <ReferenceLine y={Math.round(muT)} stroke={C.teal} strokeDasharray="4 2" strokeWidth={1.5}
            label={{value:`μ=${Math.round(muT)}`,fill:C.teal,fontSize:9,position:"insideBottomRight"}}/>
          <ReferenceLine y={loB} stroke={`${C.teal}bb`} strokeWidth={1.5} strokeDasharray="3 4"
            label={{value:`${loB}`,fill:C.teal,fontSize:8,position:"insideTopLeft"}}/>
          <ReferenceLine y={hiB} stroke={`${C.orange}bb`} strokeWidth={1.5} strokeDasharray="3 4"
            label={{value:`${hiB}`,fill:C.orange,fontSize:8,position:"insideTopLeft"}}/>
          <Line type="monotone" dataKey="mu" stroke={C.teal} strokeWidth={2} dot={false} name="μ progressiva"/>
          <Line type="monotone" dataKey="sum" stroke={ACCENT} strokeWidth={2.5}
            dot={(props)=>{
              const {cx,cy,payload}=props;
              const inB=payload.sum>=loB&&payload.sum<=hiB;
              return <circle key={cx} cx={cx} cy={cy} r={4} fill={inB?"#4A9E5C":"#C94040"} stroke="none"/>;
            }}
            activeDot={{r:6}} name="Somma"/>
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:8,fontSize:10,flexWrap:"wrap"}}>
        <span style={{color:C.teal}}>▬ Lo ({loB})</span>
        <span style={{color:ACCENT,opacity:0.8}}>▓ Banda ±{kBand}σ</span>
        <span style={{color:C.orange}}>▬ Hi ({hiB})</span>
        <span style={{color:C.teal}}>— μ {Math.round(muT)}</span>
        <span style={{color:"#4A9E5C"}}>● In banda</span>
        <span style={{color:"#C94040"}}>● Fuori banda</span>
      </div>
      <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:5}}>
        {bands.map(b=>(
          <div key={b.k} onClick={()=>setKBand(b.k)} style={{
            cursor:"pointer",display:"flex",gap:10,alignItems:"center",padding:"7px 10px",borderRadius:8,
            background:kBand===b.k?`${ACCENT}0a`:C.card,border:`1px solid ${kBand===b.k?`${ACCENT}44`:C.border}`,
          }}>
            <span style={{color:ACCENT,fontFamily:"monospace",fontSize:12,minWidth:32}}>±{b.k}σ</span>
            <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <div>
                <div style={{background:"#0a0a18",borderRadius:3,height:5,overflow:"hidden"}}>
                  <div style={{background:C.teal,height:"100%",width:`${b.inA/series.length*100}%`}}/>
                </div>
                <span style={{color:C.teal,fontSize:9}}>Adatt.[{b.loA}–{b.hiA}]: {b.inA}/{series.length} ({(b.inA/series.length*100).toFixed(0)}%)</span>
              </div>
              <div>
                <div style={{background:"#0a0a18",borderRadius:3,height:5,overflow:"hidden"}}>
                  <div style={{background:C.orange,height:"100%",width:`${b.inT/series.length*100}%`}}/>
                </div>
                <span style={{color:C.orange,fontSize:9}}>Teor.[{b.loT}–{b.hiT}]: {b.inT}/{series.length} ({(b.inT/series.length*100).toFixed(0)}%)</span>
              </div>
            </div>
            {b.k===1.5&&<span style={{color:ACCENT,fontSize:10}}>SS</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4 — GENERATORE
// ═══════════════════════════════════════════════════════════════
function SSAffinitaPanel({allDraws, ticketSum, sigmaRef, currentSS, selSS, setSelSS}){
  const suggestions = getSSSuggestions(allDraws, ticketSum, sigmaRef);
  const top10 = suggestions.slice(0,10);
  const selected = selSS || currentSS;
  return(
    <div style={{background:"#0a0a10",border:"1px solid #FFD70033",borderRadius:10,padding:12,marginBottom:12}}>
      <div style={{color:"#FFD700",fontWeight:700,fontSize:12,marginBottom:4}}>
        ⭐ Affinità SuperStar — top 10 consigliati
      </div>
      <div style={{color:"#4A4A6A",fontSize:9,marginBottom:8}}>
        Score: frequenza (40%) · co-occorrenza somme simili (35%) · ritardo (25%)
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
        {top10.map((s,idx)=>{
          const isSel=selected===s.num;
          const barCol=idx===0?"#FFD700":idx<3?"#E8B84B":"#aaa";
          return(
            <div key={s.num} onClick={()=>setSelSS(s.num)} style={{
              background:isSel?"#FFD70022":"#0e0e1c",
              border:`2px solid ${isSel?"#FFD700":"#2a2a3a"}`,
              borderRadius:8,padding:"6px 8px",cursor:"pointer",textAlign:"center",
              boxShadow:isSel?"0 0 10px #FFD70044":"none",transition:"all 0.15s",
            }}>
              <Ball num={s.num} color={isSel?"#FFD700":"#888"} size={28} glow={isSel}/>
              <div style={{background:"#0a0a18",borderRadius:3,height:4,overflow:"hidden",margin:"4px 0"}}>
                <div style={{background:isSel?"#FFD700":barCol,height:"100%",width:`${s.pct}%`}}/>
              </div>
              <div style={{color:isSel?"#FFD700":barCol,fontSize:10,fontWeight:700}}>{s.pct}%</div>
              <div style={{color:"#555",fontSize:8}}>{s.freq}x · rit.{s.ritardo}</div>
            </div>
          );
        })}
      </div>
      <div style={{background:"#FFD70008",border:"1px solid #FFD70033",borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{color:"#4A4A6A",fontSize:11}}>SuperStar selezionato:</span>
        <Ball num={selected||"?"} color="#FFD700" size={36} glow/>
        <span style={{color:"#FFD700",fontWeight:700,fontSize:16,fontFamily:"monospace"}}>{selected||"—"}</span>
        {selected&&<span style={{color:"#FFD700",fontSize:11}}>
          Affinità: <strong>{suggestions.find(x=>x.num===selected)?.pct||0}%</strong>
        </span>}
      </div>
    </div>
  );
}

function TabGeneratore(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);
  const stats=useMemo(()=>calcStats(allDraws),[allDraws]);
  const [muCustom,setMuCustom]=useState(Math.round(muReale));
  const [sigmaMode,setSigmaMode]=useState("reale");
  const [kBand,setKBand]=useState(1.5);
  const [strategy,setStrategy]=useState("balanced");
  const [winSize,setWinSize]=useState(Math.min(10,allDraws.length));
  const [mode,setMode]=useState("auto");
  const [ticket,setTicket]=useState(null);
  const [superstar,setSuperstar]=useState(null);
  const [manualInputs,setManualInputs]=useState(Array(PICK).fill(""));
  const [manualBonus,setManualBonus]=useState(Array(1).fill(""));
  const [minSum,setMinSum]=useState(Math.round(muReale-sigmaReale));
  const [maxSum,setMaxSum]=useState(Math.round(muReale+sigmaReale));
  const [ratio,setRatio]=useState("any");
  const [decineAttive,setDecineAttive]=useState(new Map());
  const [freqInput,setFreqInput]=useState("");
  const [delayInput,setDelayInput]=useState("");
  const [selSSBonus,setSelSSBonus]=useState([]);
    const [results,setResults]=useState([]);
  const [scanned,setScanned]=useState(0);
  const [loading,setLoading]=useState(false);

  const sigmaEff=sigmaMode==="reale"?sigmaReale:SIGMA_TEO;
  const loB=Math.round(muCustom-kBand*sigmaEff);
  const hiB=Math.round(muCustom+kBand*sigmaEff);
  const scored=useMemo(()=>scoreNumbers(allDraws,winSize),[allDraws,winSize]);
  const manualNums=useMemo(()=>[...new Set(manualInputs.map(v=>parseInt(v)||0).filter(n=>n>=1&&n<=POOL))],[manualInputs]);
  const totalOcc=Object.values(stats.freq).reduce((s,v)=>s+v,0);
  const freqEntries=Object.entries(stats.freq).sort((a,b)=>b[1]-a[1]);
  const top6freq=freqEntries.slice(0,6).map(([n])=>+n);
  const top6delay=freqEntries.slice(-6).map(([n])=>+n);

  function getRitardo(num){
    for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].nums.includes(num))return allDraws.length-1-i;}
    return allDraws.length;
  }

  const lastDraw=allDraws[allDraws.length-1]||DRAWS[DRAWS.length-1];
  const lastEvens=lastDraw.nums.filter(n=>n%2===0).length;
  const lastOdds=PICK-lastEvens;
  const lastFreqInDraw=top6freq.filter(n=>lastDraw.nums.includes(n));
  const lastDelayInDraw=top6delay.filter(n=>lastDraw.nums.includes(n));

  const genera=()=>{
    const seed=Date.now();
    setTicket(generateTicket(scored,strategy,loB,hiB,muCustom,seed));
    setSuperstar(generateSuperStar(seed));
  };

  const generaTattico=()=>{
    setLoading(true);setResults([]);setScanned(0);
    setTimeout(()=>{
      const rng=mkRng(Date.now());
      const found=[],maxAttempts=150000;let sc=0;
      const freqNums=parseNums(freqInput),delayNums=parseNums(delayInput);
      while(found.length<5&&sc<maxAttempts){
        sc++;
        const pool=Array.from({length:POOL},(_,i)=>i+1);
        const nums=[];
        while(nums.length<PICK){const idx=Math.floor(rng()*pool.length);nums.push(pool.splice(idx,1)[0]);}
        nums.sort((a,b)=>a-b);
        const s=sm(nums);if(s<minSum||s>maxSum)continue;
        const evens=nums.filter(n=>n%2===0).length,odds=PICK-evens;
        if(ratio!=="any"){const[re,ro]=ratio.split("-").map(Number);if(evens!==re||odds!==ro)continue;}
        if(freqNums.length>0&&!nums.some(n=>freqNums.includes(n)))continue;
        if(delayNums.length>0&&nums.filter(n=>delayNums.includes(n)).length>2)continue;
        if(decineAttive.size>0){
          const DEC=[{min:1,max:10},{min:11,max:20},{min:21,max:30},{min:31,max:40},{min:41,max:50},{min:51,max:60},{min:61,max:70},{min:71,max:80},{min:81,max:90}];
          let decOk=true;
          decineAttive.forEach((cnt,idx)=>{
            const inDec=nums.filter(n=>n>=DEC[idx].min&&n<=DEC[idx].max).length;
            if(inDec!==cnt) decOk=false;
          });
          if(!decOk) continue;
        }
        const st=generateSuperStar(sc+Date.now());
        found.push({nums,sum:s,evens,odds,bonus:st,zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2)});
      }
      setResults(found);setScanned(sc);setLoading(false);
    },50);
  };

  const ratioOpts=[
    {v:"any",l:"Qualsiasi"},{v:"3-2",l:"3P–2D"},{v:"2-3",l:"2P–3D"},
    {v:"4-1",l:"4P–1D"},{v:"1-4",l:"1P–4D"},{v:"5-0",l:"5P–0D"},{v:"0-5",l:"0P–5D"},
  ];

  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🎯 Generatore Sestine + SuperStar</h2>

      {/* Suggerimenti */}
      <div style={{background:`${ACCENT}08`,border:`1px solid ${ACCENT}33`,borderRadius:12,padding:12,marginBottom:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:12,marginBottom:8}}>📊 Suggerimenti — {allDraws.length} estrazioni</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:ACCENT,fontSize:10,fontWeight:700,marginBottom:5}}>⚡ Range Somma</div>
            {[{l:"±0.5σ",lo:Math.round(muReale-sigmaReale*0.5),hi:Math.round(muReale+sigmaReale*0.5)},
              {l:"±1σ",lo:Math.round(muReale-sigmaReale),hi:Math.round(muReale+sigmaReale)},
              {l:"±1.5σ",lo:Math.round(muReale-sigmaReale*1.5),hi:Math.round(muReale+sigmaReale*1.5)}].map(b=>(
              <button key={b.l} onClick={()=>{setMinSum(b.lo);setMaxSum(b.hi);}} style={{
                display:"block",width:"100%",background:`${ACCENT}11`,border:`1px solid ${ACCENT}33`,
                borderRadius:5,padding:"4px 6px",cursor:"pointer",fontFamily:"inherit",marginBottom:3,
              }}><span style={{color:ACCENT,fontSize:10,fontWeight:700}}>{b.l}: </span><span style={{color:C.dim,fontSize:10}}>{b.lo}–{b.hi}</span></button>
            ))}
            <div style={{color:C.dim,fontSize:9}}>μ={muReale.toFixed(1)} · σ={sigmaReale.toFixed(1)}</div>
          </div>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:ACCENT,fontSize:10,fontWeight:700,marginBottom:4}}>☯️ Pari/Dispari</div>
            <div style={{background:`${C.purple}15`,border:`1px solid ${C.purple}33`,borderRadius:6,padding:"5px 8px",marginBottom:6}}>
              <div style={{color:C.purple,fontSize:9,fontWeight:700,marginBottom:3}}>Ultima #{lastDraw.n}·{lastDraw.date}:</div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{color:"#fff",fontFamily:"monospace",fontSize:12,fontWeight:700}}>{lastEvens}P–{lastOdds}D</span>
                <button onClick={()=>setRatio(`${lastEvens}-${lastOdds}`)} style={{
                  background:ratio===`${lastEvens}-${lastOdds}`?`${C.purple}33`:`${C.purple}11`,
                  color:C.purple,border:`1px solid ${C.purple}44`,borderRadius:5,
                  padding:"2px 8px",fontSize:9,cursor:"pointer",fontFamily:"inherit",
                }}>{ratio===`${lastEvens}-${lastOdds}`?"✓ Sel.":"Usa"}</button>
              </div>
            </div>
            <div style={{color:C.dim,fontSize:9,marginBottom:4}}>% storiche {allDraws.length} est.:</div>
            {stats.parityDist.filter(p=>+p.pct>3).sort((a,b)=>+b.pct-+a.pct).slice(0,4).map(p=>{
              const isLast=p.k===lastEvens;
              return(
                <button key={p.k} onClick={()=>setRatio(`${p.k}-${PICK-p.k}`)} style={{
                  display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",
                  background:ratio===`${p.k}-${PICK-p.k}`?`${ACCENT}22`:`${C.teal}11`,
                  border:`1px solid ${ratio===`${p.k}-${PICK-p.k}`?ACCENT:isLast?C.purple:C.teal}33`,
                  borderRadius:5,padding:"3px 6px",cursor:"pointer",fontFamily:"inherit",marginBottom:3,
                }}>
                  <span style={{color:ratio===`${p.k}-${PICK-p.k}`?ACCENT:C.teal,fontSize:10,fontWeight:700}}>
                    {p.k}P–{PICK-p.k}D {isLast&&<span style={{color:C.purple,fontSize:8}}>← ult.</span>}
                  </span>
                  <div style={{display:"flex",gap:3,alignItems:"center"}}>
                    <div style={{width:32,background:"#0a0a18",borderRadius:3,height:5,overflow:"hidden"}}>
                      <div style={{background:ratio===`${p.k}-${PICK-p.k}`?ACCENT:C.teal,height:"100%",width:p.pct+"%"}}/>
                    </div>
                    <span style={{color:C.dim,fontSize:10}}>{p.pct}%</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:C.orange,fontSize:10,fontWeight:700,marginBottom:4}}>🔥 Freq. (top 6)</div>
            {lastFreqInDraw.length>0&&(
              <div style={{background:`${C.orange}15`,border:`1px solid ${C.orange}33`,borderRadius:6,padding:"5px 8px",marginBottom:6}}>
                <div style={{color:C.orange,fontSize:9,fontWeight:700,marginBottom:3}}>Nell'ultima #{lastDraw.n}:</div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:4}}>
                  {lastFreqInDraw.map(n=>(
                    <div key={n} style={{textAlign:"center"}}>
                      <Ball num={n} color={C.orange} size={22} glow/>
                      <div style={{color:C.orange,fontSize:7}}>uscito</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{
                    const cur=freqInput?freqInput.split(/[\s,]+/).map(Number).filter(Boolean):[];
                    setFreqInput([...cur,...lastFreqInDraw.filter(n=>!cur.includes(n))].join(","));
                  }} style={{flex:1,background:`${C.orange}22`,border:`1px solid ${C.orange}44`,borderRadius:5,padding:"3px",cursor:"pointer",fontFamily:"inherit",color:C.orange,fontSize:9,fontWeight:700}}>➕ Aggiungi</button>
                  <button onClick={()=>{
                    const cur=freqInput?freqInput.split(/[\s,]+/).map(Number).filter(Boolean):[];
                    setFreqInput(cur.filter(n=>!lastFreqInDraw.includes(n)).join(","));
                  }} style={{flex:1,background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:5,padding:"3px",cursor:"pointer",fontFamily:"inherit",color:C.red,fontSize:9,fontWeight:700}}>➖ Rimuovi</button>
                </div>
              </div>
            )}
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:4}}>
              {top6freq.map(n=>{
                const f=stats.freq[n]||0,pct=(f/totalOcc*100).toFixed(1);
                const inLast=lastDraw.nums.includes(n);
                return(<div key={n} style={{textAlign:"center",position:"relative"}}>
                  <Ball num={n} color={inLast?C.purple:C.orange} size={22}/>
                  {inLast&&<div style={{position:"absolute",top:-3,right:-3,width:7,height:7,borderRadius:"50%",background:C.purple,border:"1px solid #0a0a18"}}/>}
                  <div style={{color:inLast?C.purple:C.orange,fontSize:7}}>{pct}%</div>
                </div>);
              })}
            </div>
            <div style={{color:C.dim,fontSize:8,marginBottom:4}}><span style={{color:C.purple}}>●</span> = ultima est.</div>
            <button onClick={()=>setFreqInput(top6freq.slice(0,4).join(","))} style={{
              width:"100%",background:`${C.orange}11`,border:`1px solid ${C.orange}33`,
              borderRadius:5,padding:"3px",cursor:"pointer",fontFamily:"inherit",color:C.orange,fontSize:10,
            }}>Usa top 4</button>
          </div>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:C.teal,fontSize:10,fontWeight:700,marginBottom:4}}>❄️ Ritard. (top 6)</div>
            {lastDelayInDraw.length>0&&(
              <div style={{background:`${C.teal}15`,border:`1px solid ${C.teal}33`,borderRadius:6,padding:"5px 8px",marginBottom:6}}>
                <div style={{color:C.teal,fontSize:9,fontWeight:700,marginBottom:3}}>Nell'ultima #{lastDraw.n}:</div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:4}}>
                  {lastDelayInDraw.map(n=>(
                    <div key={n} style={{textAlign:"center"}}>
                      <Ball num={n} color={C.teal} size={22} glow/>
                      <div style={{color:C.teal,fontSize:7}}>uscito</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{
                    const cur=delayInput?delayInput.split(/[\s,]+/).map(Number).filter(Boolean):[];
                    setDelayInput([...cur,...lastDelayInDraw.filter(n=>!cur.includes(n))].join(","));
                  }} style={{flex:1,background:`${C.teal}22`,border:`1px solid ${C.teal}44`,borderRadius:5,padding:"3px",cursor:"pointer",fontFamily:"inherit",color:C.teal,fontSize:9,fontWeight:700}}>➕ Aggiungi</button>
                  <button onClick={()=>{
                    const cur=delayInput?delayInput.split(/[\s,]+/).map(Number).filter(Boolean):[];
                    setDelayInput(cur.filter(n=>!lastDelayInDraw.includes(n)).join(","));
                  }} style={{flex:1,background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:5,padding:"3px",cursor:"pointer",fontFamily:"inherit",color:C.red,fontSize:9,fontWeight:700}}>➖ Rimuovi</button>
                </div>
              </div>
            )}
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:4}}>
              {top6delay.map(n=>{
                const rit=getRitardo(n),pct=(rit/allDraws.length*100).toFixed(0);
                const inLast=lastDraw.nums.includes(n);
                return(<div key={n} style={{textAlign:"center",position:"relative"}}>
                  <Ball num={n} color={inLast?C.purple:C.teal} size={22}/>
                  {inLast&&<div style={{position:"absolute",top:-3,right:-3,width:7,height:7,borderRadius:"50%",background:C.purple,border:"1px solid #0a0a18"}}/>}
                  <div style={{color:inLast?C.purple:C.teal,fontSize:7}}>{pct}%</div>
                </div>);
              })}
            </div>
            <div style={{color:C.dim,fontSize:8,marginBottom:4}}><span style={{color:C.purple}}>●</span> = ultima est.</div>
            <button onClick={()=>setDelayInput(top6delay.slice(0,4).join(","))} style={{
              width:"100%",background:`${C.teal}11`,border:`1px solid ${C.teal}33`,
              borderRadius:5,padding:"3px",cursor:"pointer",fontFamily:"inherit",color:C.teal,fontSize:10,
            }}>Usa top 4</button>
          </div>
        </div>
      </div>

      {/* Modalità */}
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {[{id:"auto",l:"🤖 Automatica"},{id:"manual",l:"✍️ Manuale"},{id:"tattico",l:"⚡ Tattico"}].map(m=>(
          <button key={m.id} onClick={()=>setMode(m.id)} style={{
            background:mode===m.id?`${ACCENT}22`:"transparent",color:mode===m.id?ACCENT:C.dim,
            border:`1px solid ${mode===m.id?ACCENT:C.border}`,borderRadius:18,padding:"6px 14px",
            fontSize:11,fontWeight:mode===m.id?700:400,cursor:"pointer",fontFamily:"inherit",
          }}>{m.l}</button>
        ))}
      </div>

      {/* AUTO */}
      {mode==="auto"&&(
        <div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
            {[{id:"cold",l:"❄️",c:C.teal},{id:"unpop",l:"👥",c:C.purple},{id:"balanced",l:"⚖️",c:ACCENT}].map(s=>(
              <button key={s.id} onClick={()=>setStrategy(s.id)} style={{
                background:strategy===s.id?`${s.c}22`:"transparent",color:strategy===s.id?s.c:C.dim,
                border:`1px solid ${strategy===s.id?s.c:C.border}`,borderRadius:14,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",
              }}>{s.l}</button>
            ))}
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <span style={{color:C.dim,fontSize:10}}>μ:</span>
              <input type="range" min={15} max={240} value={muCustom} onChange={e=>setMuCustom(+e.target.value)} style={{width:80,accentColor:ACCENT}}/>
              <input type="number" min={15} max={240} value={muCustom} onChange={e=>setMuCustom(Math.max(15,Math.min(240,+e.target.value)))}
                style={{width:55,background:"#0a0a1c",color:ACCENT,border:`1px solid ${ACCENT}55`,borderRadius:6,padding:"3px 6px",fontSize:12,fontFamily:"monospace",outline:"none"}}/>
            </div>
            {[{id:"reale",l:`σ=${sigmaReale.toFixed(0)}`},{id:"teorica",l:"σ=62"}].map(s=>(
              <button key={s.id} onClick={()=>setSigmaMode(s.id)} style={{
                background:sigmaMode===s.id?`${C.teal}22`:"transparent",color:sigmaMode===s.id?C.teal:C.dim,
                border:`1px solid ${sigmaMode===s.id?C.teal:C.border}`,borderRadius:8,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit",
              }}>{s.l}</button>
            ))}
            {/* SELETTORE SIGMA VISIVO */}
            <div style={{width:"100%",marginTop:6}}>
              <div style={{color:C.dim,fontSize:10,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>
                ⚙️ Banda σ — la cinquina avrà Σ nel range:
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {[0.5,1.0,1.5,2.0,2.5].map(k=>{
                  const se=sigmaMode==="reale"?sigmaReale:30;
                  const lo=Math.round(muCustom-k*se);
                  const hi=Math.round(muCustom+k*se);
                  const inB=series.filter(d=>d.sum>=lo&&d.sum<=hi).length;
                  const pct=(inB/series.length*100).toFixed(0);
                  const isActive=kBand===k;
                  return(
                    <button key={k} onClick={()=>setKBand(k)} style={{
                      flex:1,minWidth:70,
                      background:isActive?`linear-gradient(135deg,${ACCENT}33,${ACCENT}11)`:"#080816",
                      color:isActive?ACCENT:C.dim,
                      border:`2px solid ${isActive?ACCENT:C.border}`,
                      borderRadius:10,padding:"8px 4px",cursor:"pointer",fontFamily:"inherit",
                      textAlign:"center",transition:"all 0.15s",
                      boxShadow:isActive?`0 0 12px ${ACCENT}33`:"none",
                    }}>
                      <div style={{fontSize:13,fontWeight:900,fontFamily:"monospace"}}>±{k}σ</div>
                      <div style={{fontSize:10,fontFamily:"monospace",color:isActive?C.teal:C.dim,marginTop:2}}>
                        {lo}–{hi}
                      </div>
                      <div style={{fontSize:9,color:isActive?C.green:C.dim,marginTop:1}}>
                        {pct}% reali
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{background:"#080816",borderRadius:8,padding:"7px 12px",marginBottom:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",fontSize:11}}>
            <span style={{color:C.dim}}>Banda:</span>
            <span style={{color:C.teal,fontFamily:"monospace",fontWeight:700}}>{loB}</span>
            <span style={{color:C.dim}}>──</span>
            <span style={{color:ACCENT,fontFamily:"monospace",fontWeight:900,fontSize:14}}>μ{muCustom}</span>
            <span style={{color:C.dim}}>──</span>
            <span style={{color:C.orange,fontFamily:"monospace",fontWeight:700}}>{hiB}</span>
            <span style={{color:C.teal}}>{series.filter(d=>d.sum>=loB&&d.sum<=hiB).length}/{series.length} reali</span>
          </div>
          <button onClick={genera} style={{
            width:"100%",padding:"13px",background:`linear-gradient(135deg,${ACCENT},${C.teal})`,
            color:"#fff",border:"none",borderRadius:10,fontSize:16,fontWeight:900,cursor:"pointer",
            fontFamily:"Georgia,serif",marginBottom:12,
          }}>🎲 Genera Sestina + SuperStar</button>
          {ticket&&(
            <div style={{background:"#080816",border:`1px solid ${ACCENT}55`,borderRadius:12,padding:14}}>
              <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
                {ticket.nums.map(n=>{const s=scored.find(x=>x.num===n);const col=s?.isHot?C.orange:s?.isCold?C.teal:ACCENT;
                  return <Ball key={n} num={n} color={col} size={46} glow/>;
                })}
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{color:C.dim,fontSize:14}}>│</span>
                  {superstar?<Ball num={superstar} size={46} gold glow/>:null}
                  <span style={{color:"#FFD700",fontSize:9}}>SS</span>
                </div>
              </div>

              <SSAffinitaPanel allDraws={allDraws} ticketSum={ticket.sum} sigmaRef={sigmaEff} currentSS={superstar} selSS={selSSBonus[0]||null} setSelSS={n=>setSelSSBonus([n])}/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
                {[
                  {l:"Σ",v:ticket.sum,c:ACCENT},
                  {l:"Δ da μ",v:(ticket.sum>muCustom?"+":"")+(ticket.sum-muCustom),c:C.teal},
                  {l:"Δ da 127.5",v:(ticket.sum>MU_TEO?"+":"")+(ticket.sum-MU_TEO).toFixed(1),c:ticket.sum>MU_TEO?C.orange:C.teal},
                  {l:"z",v:zOf(ticket.sum,MU_TEO,SIGMA_TEO).toFixed(2),c:Math.abs(zOf(ticket.sum,MU_TEO,SIGMA_TEO))<1?C.green:C.orange},
                ].map(x=>(
                  <div key={x.l} style={{background:"#0a0a18",borderRadius:6,padding:8,textAlign:"center"}}>
                    <div style={{color:C.dim,fontSize:9}}>{x.l}</div>
                    <div style={{color:x.c,fontSize:15,fontWeight:900,fontFamily:"monospace"}}>{x.v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:8}}>
                {ticket.nums.map(n=>{
                  const s=scored.find(x=>x.num===n);const col=s?.isHot?C.orange:s?.isCold?C.teal:ACCENT;
                  const f=stats.freq[n]||0,pct=(f/totalOcc*100).toFixed(2),rit=getRitardo(n),pctR=(rit/allDraws.length*100).toFixed(0);
                  return(
                    <div key={n} style={{display:"flex",gap:8,alignItems:"center",background:"#060612",borderRadius:5,padding:"4px 8px"}}>
                      <Ball num={n} color={col} size={24}/>
                      <span style={{color:C.orange,fontSize:10}}>🔥{f}x({pct}%)</span>
                      <span style={{color:C.teal,fontSize:10}}>❄️rit.{rit}({pctR}%)</span>
                      <span style={{color:col,fontSize:10}}>z={s?.z.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
              <button onClick={()=>{
                const t={id:Date.now(),nums:ticket.nums,superstar:selSSBonus[0]||superstar,
                  date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),
                  concorso:allDraws[allDraws.length-1]?.n||0,strategy,sum:ticket.sum};
                const prev=JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");
                localStorage.setItem(LS_TICKETS_S,JSON.stringify([...prev,t]));
                alert(`✅ Sestina salvata!\n${ticket.nums.join("-")} | SuperStar:${selSSBonus[0]||superstar||"—"}\nVai al tab 🎫 Biglietti.`);
              }} style={{width:"100%",padding:"10px",
                background:`${C.purple}22`,color:C.purple,
                border:`2px solid ${C.purple}`,borderRadius:10,
                fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              }}>💾 Salva come Giocato → 🎫 Biglietti</button>
            </div>
          )}
        </div>
      )}

      {/* MANUALE */}
      {mode==="manual"&&(
        <div>
          <div style={{color:C.dim,fontSize:11,marginBottom:10}}>Inserisci i {PICK} numeri + {1} SuperStar (1–12).</div>
          <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:10}}>
            {manualInputs.map((v,i)=>{
              const num=parseInt(v)||0,valid=num>=1&&num<=POOL;
              const isDup=valid&&manualInputs.filter(x=>parseInt(x)===num).length>1;
              const s=scored.find(x=>x.num===num);
              const col=isDup?C.red:s?.isHot?C.orange:s?.isCold?C.teal:ACCENT;
              return(
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <Ball num={valid&&!isDup?num:"?"} color={valid&&!isDup?col:"#333"} size={38}/>
                  <input type="number" min={1} max={POOL} value={v}
                    onChange={e=>{const next=[...manualInputs];next[i]=e.target.value;setManualInputs(next);}}
                    style={{width:48,textAlign:"center",background:"#080816",color:col,
                      border:`1.5px solid ${isDup?C.red:valid?`${col}55`:C.border}`,
                      borderRadius:7,padding:"4px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/>
                  {valid&&!isDup&&s&&<div style={{fontSize:8,color:s.isHot?C.orange:s.isCold?C.teal:C.dim}}>z={s.z.toFixed(1)}</div>}
                </div>
              );
            })}
            <div style={{display:"flex",gap:4,alignItems:"center",marginLeft:8}}>
              <span style={{color:C.dim,fontSize:14}}>│</span>
              <div>
                <div style={{color:"#FFD700",fontSize:10,marginBottom:4}}>SuperStar (1–12)</div>
                <div style={{display:"flex",gap:6}}>
                  {manualBonus.map((v,i)=>{
                    const num=parseInt(v)||0,valid=num>=1&&num<=SUPERSTAR_POOL;
                    return(
                      <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <Ball num={valid?num:"?"} size={38} gold={valid} />
                        <input type="number" min={1} max={SUPERSTAR_POOL} value={v}
                          onChange={e=>{const next=[...manualBonus];next[i]=e.target.value;setManualBonus(next);}}
                          style={{width:44,textAlign:"center",background:"#080816",color:"#FFD700",
                            border:"1.5px solid #FFD70055",borderRadius:7,padding:"4px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:10}}>
            <button onClick={()=>{setManualInputs(Array(PICK).fill(""));setManualBonus(Array(1).fill(""));}} style={{
              background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",
            }}>🗑 Reset</button>
            <button onClick={()=>{
              const seed=Date.now();
              const t=generateTicket(scored,strategy,loB,hiB,muCustom,seed);
              setManualInputs(t.nums.map(String));
              setManualBonus(generateSuperStar(seed).map(String));
            }} style={{
              background:`${ACCENT}11`,color:ACCENT,border:`1px solid ${ACCENT}44`,borderRadius:8,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",
            }}>🎲 Suggerisci</button>
          </div>
          {manualNums.length>0&&(
            <div style={{background:"#080816",border:`1px solid ${ACCENT}44`,borderRadius:10,padding:12}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:8}}>
                {[
                  {l:"Σ parziale",v:sm(manualNums),c:ACCENT},
                  {l:"Δ da μ=127.5",v:(sm(manualNums)-MU_TEO>0?"+":"")+(sm(manualNums)-MU_TEO).toFixed(1),c:C.teal},
                  {l:"z",v:zOf(sm(manualNums),MU_TEO,SIGMA_TEO).toFixed(2),c:Math.abs(zOf(sm(manualNums),MU_TEO,SIGMA_TEO))<1?C.green:C.orange},
                ].map(x=>(
                  <div key={x.l} style={{background:"#0a0a18",borderRadius:6,padding:8,textAlign:"center"}}>
                    <div style={{color:C.dim,fontSize:9}}>{x.l}</div>
                    <div style={{color:x.c,fontSize:16,fontWeight:900,fontFamily:"monospace"}}>{x.v}</div>
                  </div>
                ))}
              </div>
              {manualNums.map(n=>{
                const s=scored.find(x=>x.num===n);const col=s?.isHot?C.orange:s?.isCold?C.teal:ACCENT;
                const f=stats.freq[n]||0,pct=(f/totalOcc*100).toFixed(2),rit=getRitardo(n),pctR=(rit/allDraws.length*100).toFixed(0);
                return(
                  <div key={n} style={{display:"flex",gap:8,alignItems:"center",background:"#080814",borderRadius:5,padding:"4px 8px",marginBottom:3}}>
                    <Ball num={n} color={col} size={24}/>
                    <span style={{color:C.orange,fontSize:10}}>🔥{f}x({pct}%)</span>
                    <span style={{color:C.teal,fontSize:10}}>❄️rit.{rit}({pctR}%)</span>
                    <span style={{color:col,fontSize:10}}>z={s?.z.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TATTICO */}
      {mode==="tattico"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:12}}>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
              <div style={{color:ACCENT,fontSize:11,fontWeight:700,marginBottom:6}}>⚡ Somma</div>

              {/* SELETTORE SIGMA */}
              <div style={{marginBottom:8}}>
                <div style={{color:C.dim,fontSize:9,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>
                  Selezione rapida per banda σ:
                </div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  {[0.5,1.0,1.5,2.0,2.5].map(k=>{
                    const lo=Math.round(muReale-k*sigmaReale);
                    const hi=Math.round(muReale+k*sigmaReale);
                    const isActive=minSum===lo&&maxSum===hi;
                    return(
                      <button key={k} onClick={()=>{setMinSum(lo);setMaxSum(hi);}} style={{
                        flex:1,
                        background:isActive?`linear-gradient(135deg,${ACCENT}33,${ACCENT}11)`:"#080816",
                        color:isActive?ACCENT:C.dim,
                        border:`2px solid ${isActive?ACCENT:C.border}`,
                        borderRadius:7,padding:"5px 2px",cursor:"pointer",
                        fontFamily:"inherit",textAlign:"center",transition:"all 0.15s",
                        boxShadow:isActive?`0 0 10px ${ACCENT}33`:"none",
                      }}>
                        <div style={{fontSize:11,fontWeight:900,fontFamily:"monospace"}}>±{k}σ</div>
                        <div style={{fontSize:8,color:isActive?C.teal:C.dim,fontFamily:"monospace"}}>{lo}–{hi}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* INPUT MANUALE */}
              <div style={{display:"flex",gap:6}}>
                {[{l:"Min Σ",v:minSum,set:setMinSum},{l:"Max Σ",v:maxSum,set:setMaxSum}].map(f=>(
                  <div key={f.l} style={{flex:1}}>
                    <div style={{color:C.dim,fontSize:9,marginBottom:2}}>{f.l}</div>
                    <input type="number" value={f.v} onChange={e=>f.set(+e.target.value)}
                      style={{width:"100%",background:"#0a0a1c",color:"#fff",border:"1px solid #2d2d54",borderRadius:5,padding:"5px",fontFamily:"monospace",fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
              <div style={{color:ACCENT,fontSize:11,fontWeight:700,marginBottom:6}}>☯️ Pari/Dispari</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
                {ratioOpts.map(r=>(
                  <button key={r.v} onClick={()=>setRatio(r.v)} style={{
                    background:ratio===r.v?"#2d3748":"#0a0a1c",color:ratio===r.v?"#00f2fe":"#a0aec0",
                    border:`1px solid ${ratio===r.v?"#00f2fe":"#2d2d54"}`,borderRadius:5,padding:"4px 2px",fontSize:10,cursor:"pointer",fontFamily:"inherit",
                  }}>{r.l}</button>
                ))}
              </div>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
              <div style={{color:ACCENT,fontSize:11,fontWeight:700,marginBottom:6}}>📊 Filtri</div>
              <div style={{marginBottom:5}}>
                <div style={{color:C.orange,fontSize:9,marginBottom:2}}>🔥 Frequenti:</div>
                <input type="text" value={freqInput} onChange={e=>setFreqInput(e.target.value)} placeholder="Es. 3,12,38"
                  style={{width:"100%",background:"#0a0a1c",color:"#fff",border:"1px solid #2d2d54",borderRadius:5,padding:"4px",fontSize:10,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{color:C.teal,fontSize:9,marginBottom:2}}>❄️ Ritardatari:</div>
                <input type="text" value={delayInput} onChange={e=>setDelayInput(e.target.value)} placeholder="Es. 7,25"
                  style={{width:"100%",background:"#0a0a1c",color:"#fff",border:"1px solid #2d2d54",borderRadius:5,padding:"4px",fontSize:10,outline:"none",boxSizing:"border-box"}}/>
              </div>
            </div>

            {/* FILTRO DECINE */}
            {(()=>{
              const DECINE_UI=[{label:"1–10",min:1,max:10},{label:"11–20",min:11,max:20},{label:"21–30",min:21,max:30},{label:"31–40",min:31,max:40},{label:"41–50",min:41,max:50},{label:"51–60",min:51,max:60},{label:"61–70",min:61,max:70},{label:"71–80",min:71,max:80},{label:"81–90",min:81,max:90}];
              const DC=["#E8B84B","#F07030","#C94040","#8A5CC4","#4A8FD4","#2BA89A","#4A9E5C","#F07030","#E8B84B"];
              const medieDec=DECINE_UI.map((d,i)=>({
                ...d,idx:i,
                media:allDraws.reduce((s,dr)=>s+dr.nums.filter(n=>n>=d.min&&n<=d.max).length,0)/allDraws.length,
                lastCount:allDraws[allDraws.length-1].nums.filter(n=>n>=d.min&&n<=d.max).length,
              }));
              const maxMedia=Math.max(...medieDec.map(m=>m.media));
              const PICK_N=6;
              const toggleDec=(idx,delta)=>setDecineAttive(prev=>{
                const next=new Map(prev);
                const cur=next.get(idx)||0;
                const newVal=Math.max(0,Math.min(cur+delta,PICK_N));
                if(newVal===0) next.delete(idx); else next.set(idx,newVal);
                return next;
              });
              const totRichiesti=[...decineAttive.values()].reduce((a,b)=>a+b,0);
              return(
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,gridColumn:"1 / -1"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{color:ACCENT,fontSize:11,fontWeight:700}}>🔢 Filtro Decine (1–90)</div>
                    <button onClick={()=>setDecineAttive(new Map())} style={{background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 8px",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>✕ Reset</button>
                  </div>
                  <div style={{color:C.dim,fontSize:9,marginBottom:8}}>
                    {decineAttive.size===0
                      ?"Nessun filtro — premi + per impostare quanti numeri vuoi da ciascuna decina"
                      :`${decineAttive.size} decin${decineAttive.size===1?"a":"e"} attive — ${totRichiesti} numeri richiesti su 6`}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(9,1fr)",gap:5}}>
                    {medieDec.map((d,i)=>{
                      const cnt=decineAttive.get(i)||0;
                      return(
                        <div key={d.label} style={{
                          background:cnt>0?`${DC[i]}18`:"#080816",
                          border:`2px solid ${cnt>0?DC[i]:C.border}`,
                          borderRadius:8,padding:"7px 4px",textAlign:"center",
                          transition:"all 0.15s",
                        }}>
                          <div style={{color:cnt>0?DC[i]:C.dim,fontSize:9,fontWeight:700,marginBottom:1}}>{d.label}</div>
                          <div style={{background:"#0a0a18",borderRadius:3,height:3,overflow:"hidden",margin:"3px 0"}}>
                            <div style={{background:DC[i],height:"100%",width:`${(d.media/Math.max(maxMedia,0.1)*100)}%`}}/>
                          </div>
                          <div style={{color:cnt>0?DC[i]:"#555",fontSize:14,fontWeight:900,fontFamily:"monospace",margin:"3px 0",minHeight:20}}>
                            {cnt>0?cnt:"–"}
                          </div>
                          <div style={{display:"flex",gap:3,justifyContent:"center"}}>
                            <button onClick={(e)=>{e.stopPropagation();toggleDec(i,-1);}} style={{
                              width:22,height:22,borderRadius:4,
                              background:cnt>0?"#1a0606":"#1a1a2e",
                              color:cnt>0?"#C94040":"#333",
                              border:`1px solid ${cnt>0?"#C94040":"#333"}`,
                              fontSize:14,cursor:"pointer",display:"flex",
                              alignItems:"center",justifyContent:"center",
                            }}>−</button>
                            <button onClick={(e)=>{e.stopPropagation();toggleDec(i,1);}} style={{
                              width:22,height:22,borderRadius:4,
                              background:`${DC[i]}22`,color:DC[i],
                              border:`1px solid ${DC[i]}`,fontSize:14,cursor:"pointer",
                              display:"flex",alignItems:"center",justifyContent:"center",
                            }}>+</button>
                          </div>
                          <div style={{color:C.dim,fontSize:7,marginTop:2}}>μ {d.media.toFixed(1)}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{color:C.dim,fontSize:9,marginTop:8,lineHeight:1.5}}>
                    💡 <strong style={{color:ACCENT}}>+</strong> = aggiungi un numero da questa decina. Es. +2 sulla decina 21–30 = esattamente 2 numeri tra 21 e 30 nella sestina generata.
                  </div>
                </div>
              );
              })()}

          </div>
          <button onClick={generaTattico} disabled={loading} style={{
            width:"100%",padding:"12px",background:loading?"#222":"linear-gradient(135deg,#FF6B35,#E63946)",
            color:loading?"#666":"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,
            cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",marginBottom:12,
          }}>{loading?"⏳ Scansione...":"⚡ GENERA COLONNE TATTICHE"}</button>
          {scanned>0&&<div style={{color:C.dim,fontSize:11,marginBottom:8}}>
            Scansionate: <strong style={{color:C.orange}}>{scanned.toLocaleString("it-IT")}</strong> · Trovate: <strong style={{color:C.green}}>{results.length}</strong>
          </div>}
          {results.map((r,i)=>(
            <div key={i} style={{background:C.card,border:`1px solid ${ACCENT}33`,borderLeft:`3px solid ${ACCENT}`,borderRadius:9,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7,flexWrap:"wrap",gap:5}}>
                <span style={{color:C.dim,fontSize:10,fontWeight:700}}>LINEA {i+1}</span>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  <span style={{background:"#12122a",borderRadius:4,padding:"2px 7px",color:ACCENT,fontSize:10}}>Σ {r.sum}</span>
                  <span style={{background:"#12122a",borderRadius:4,padding:"2px 7px",color:C.text,fontSize:10}}>{r.evens}P–{r.odds}D</span>
                  <span style={{background:"#12122a",borderRadius:4,padding:"2px 7px",fontSize:10,color:Math.abs(parseFloat(r.zScore))<1?C.green:C.orange}}>z={r.zScore}</span>
                  <button onClick={()=>{
                    const t={id:Date.now()+i,nums:r.nums,superstar:r.superstar,
                      date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),
                      concorso:allDraws[allDraws.length-1].n,
                      strategy:"tattico",sum:r.sum};
                    const prev=JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");
                    localStorage.setItem(LS_TICKETS_S,JSON.stringify([...prev,t]));
                    alert(`✅ Linea ${i+1} salvata!\n${r.nums.join("-")} | SuperStar:${r.superstar||"—"}`);
                  }} style={{
                    background:`${C.purple}22`,color:C.purple,border:`1px solid ${C.purple}`,
                    borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  }}>💾 Salva</button>
                </div>
              </div>
              <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:5}}>{r.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={34}/>)}</div>
                <span style={{color:C.dim}}>│</span>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  {r.superstar?<Ball num={r.superstar} size={34} gold/>:null}
                  <span style={{color:"#FFD700",fontSize:10}}>SuperStar</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 5 — CONFRONTO
// ═══════════════════════════════════════════════════════════════
function TabConfronto(){
  const allDraws=useDraws();
  const [strategy,setStrategy]=useState("balanced");
  const [winSize,setWinSize]=useState(Math.min(8,DRAWS.length));
  const data=useMemo(()=>{
    return allDraws.map((d,i)=>{
      const history=allDraws.slice(0,i);if(history.length<3)return null;
      const w=history.slice(-winSize);
      const expFreq=winSize*PICK/POOL,sigma=Math.sqrt(expFreq*(1-PICK/POOL));
      const freq=Array(POOL+1).fill(0);w.forEach(x=>x.nums.forEach(n=>freq[n]++));
      const scored=Array.from({length:POOL},(_,j)=>{
        const num=j+1,f=freq[num],z=(f-expFreq)/sigma;
        const unpop=POPULAR.has(num)?0.35:(num>Math.floor(POOL*0.35)?1.3:1.0);
        return {num,f,z,score:Math.abs(z)*unpop};
      });
      const rng=mkRng(i*31+7);
      let pool;
      if(strategy==="cold") pool=[...scored].sort((a,b)=>a.z-b.z);
      else if(strategy==="unpop") pool=[...scored].sort((a,b)=>b.score-a.score);
      else pool=[...scored].sort((a,b)=>b.score-a.score);
      pool=pool.map(c=>({...c,_s:c.score+rng()*0.25})).sort((a,b)=>b._s-a._s);
      const top=pool.slice(0,25);
      let best=null,bestDist=Infinity;
      for(let t=0;t<2000;t++){
        const sh=[...top].sort(()=>rng()-0.5).slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);
        const s=sm(sh),dist=Math.abs(s-MU_TEO);
        if(s>=97&&s<=158&&dist<bestDist){best=sh;bestDist=dist;if(dist<6)break;}
      }
      if(!best) best=top.slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);
      return {n:d.n,date:d.date,realNums:d.nums,sysNums:best,
        realSum:sm(d.nums),sysSum:sm(best),delta:sm(best)-sm(d.nums),
        matches:d.nums.filter(n=>best.includes(n)).length};
    }).filter(Boolean);
  },[strategy,winSize,allDraws]);

  const avgMatch=data.length?avg(data.map(d=>d.matches)):0;
  const matchDist=[0,1,2,3,4,5].map(m=>({m,count:data.filter(d=>d.matches===m).length}));
  const [detail,setDetail]=useState(null);

  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🔁 Confronto Reale vs Sistema</h2>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
        {[{id:"cold",l:"❄️",c:C.teal},{id:"unpop",l:"👥",c:C.purple},{id:"balanced",l:"⚖️",c:ACCENT}].map(s=>(
          <button key={s.id} onClick={()=>setStrategy(s.id)} style={{
            background:strategy===s.id?`${s.c}22`:"transparent",color:strategy===s.id?s.c:C.dim,
            border:`1px solid ${strategy===s.id?s.c:C.border}`,borderRadius:14,padding:"5px 12px",
            fontSize:11,fontWeight:strategy===s.id?700:400,cursor:"pointer",fontFamily:"inherit",
          }}>{s.l}</button>
        ))}
        {[3,5,8].map(w=>(
          <button key={w} onClick={()=>setWinSize(Math.min(w,allDraws.length))} style={{
            background:winSize===Math.min(w,allDraws.length)?`${C.purple}22`:"transparent",
            color:winSize===Math.min(w,allDraws.length)?C.purple:C.dim,
            border:`1px solid ${winSize===Math.min(w,allDraws.length)?C.purple:C.border}`,
            borderRadius:8,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit",
          }}>W{w}</button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:14}}>
        <KpiCard label="Analizzate" value={data.length}/>
        <KpiCard label="Match medi" value={avgMatch.toFixed(3)} color={C.teal} sub="Caso: 0.333"/>
        <KpiCard label="Miglioramento" value={`${((avgMatch-0.333)/0.333*100).toFixed(1)}%`} color={avgMatch>0.333?C.green:C.red}/>
        <KpiCard label="Max match" value={`${Math.max(0,...data.map(d=>d.matches))}/5`} color={ACCENT}/>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={data.map(d=>({date:d.date,realSum:d.realSum,sysSum:d.sysSum}))}>
          <CartesianGrid strokeDasharray="2 4" stroke="#0e0e1c"/>
          <XAxis dataKey="date" tick={{fill:C.dim,fontSize:9}} interval={2}/>
          <YAxis domain={[20,220]} tick={{fill:C.dim,fontSize:9}}/>
          <Tooltip content={<TT/>}/>
          <ReferenceLine y={MU_TEO} stroke={`${ACCENT}66`} strokeDasharray="4 3"/>
          <Line type="monotone" dataKey="realSum" stroke={C.orange} strokeWidth={2} dot={{r:2}} name="Reale"/>
          <Line type="monotone" dataKey="sysSum" stroke={C.teal} strokeWidth={1.5} dot={false} strokeDasharray="5 2" name="Sistema"/>
          <Legend wrapperStyle={{fontSize:10}}/>
        </LineChart>
      </ResponsiveContainer>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:12,marginBottom:12}}>
        {matchDist.map(({m,count})=>{
          const col=m>=3?ACCENT:m>=2?C.teal:m>=1?C.teal:C.dim;
          return(
            <div key={m} style={{flex:1,background:C.card,border:`1px solid ${col}33`,borderTop:`2px solid ${col}`,borderRadius:8,padding:"8px 4px",textAlign:"center"}}>
              <div style={{color:col,fontSize:17,fontWeight:900,fontFamily:"monospace"}}>{count}</div>
              <div style={{color:C.dim,fontSize:9}}>{m}✓</div>
              <div style={{color:`${col}99`,fontSize:9}}>{data.length?(count/data.length*100).toFixed(0):0}%</div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {[...data].reverse().map(d=>{
          const isOpen=detail===d.n;
          const mCol=d.matches>=3?ACCENT:d.matches>=2?C.teal:d.matches>=1?C.teal:C.dim;
          const dCol=Math.abs(d.delta)<20?C.green:Math.abs(d.delta)<40?C.orange:C.red;
          return(
            <div key={d.n}>
              <div onClick={()=>setDetail(isOpen?null:d.n)} style={{
                background:isOpen?`${ACCENT}08`:C.card,
                border:`1px solid ${isOpen?`${ACCENT}44`:C.border}`,
                borderRadius:isOpen?"8px 8px 0 0":8,padding:"8px 12px",cursor:"pointer",
                display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:5,
              }}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{color:C.dim,fontSize:10}}>#{d.n}·{d.date}</span>
                  <div style={{display:"flex",gap:3}}>
                    {d.realNums.map(n=><Ball key={n} num={n} color={d.sysNums?.includes(n)?ACCENT:C.orange} size={20} glow={d.sysNums?.includes(n)}/>)}
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{color:C.orange,fontFamily:"monospace",fontSize:11}}>Σ{d.realSum}</span>
                  <span style={{color:C.teal,fontFamily:"monospace",fontSize:11}}>Σ{d.sysSum}</span>
                  <span style={{color:dCol,fontFamily:"monospace",fontSize:10}}>{d.delta>0?"+":""}{d.delta}</span>
                  <span style={{color:mCol,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{d.matches}✓</span>
                  <span style={{color:C.dim}}>{isOpen?"▲":"▼"}</span>
                </div>
              </div>
              {isOpen&&(
                <div style={{background:`${ACCENT}05`,border:`1px solid ${ACCENT}22`,borderTop:"none",borderRadius:"0 0 8px 8px",padding:"10px 12px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <div style={{color:C.orange,fontSize:10,marginBottom:4}}>🎱 Reale</div>
                      <div style={{display:"flex",gap:4}}>{d.realNums.map(n=><Ball key={n} num={n} color={d.sysNums?.includes(n)?ACCENT:C.orange} size={26} glow={d.sysNums?.includes(n)}/>)}</div>
                    </div>
                    <div>
                      <div style={{color:C.teal,fontSize:10,marginBottom:4}}>🤖 Sistema</div>
                      <div style={{display:"flex",gap:4}}>{d.sysNums?.map(n=><Ball key={n} num={n} color={d.realNums.includes(n)?ACCENT:C.teal} size={26} glow={d.realNums.includes(n)}/>)}</div>
                    </div>
                  </div>
                  <div style={{marginTop:6,color:C.dim,fontSize:10}}>
                    Comuni: <strong style={{color:mCol}}>{d.matches}/5</strong>
                    {d.matches>0&&<> — <span style={{color:ACCENT}}>{d.realNums.filter(n=>d.sysNums?.includes(n)).join(", ")}</span></>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 6 — ESTRAZIONI
// ═══════════════════════════════════════════════════════════════
function TabEstrazioni({ onUpdate }){
  const [concorso,setConcorso]=useState("");
  const [date,setDate]=useState("");
  const [nums,setNums]=useState(Array(PICK).fill(""));
  const [superstar,setSuperstar]=useState(Array(1).fill(""));
  const [saved,setSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_KEY_S)||"[]");}catch{return [];}});
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  const persist=(list)=>{localStorage.setItem(LS_KEY_S,JSON.stringify(list));setSaved(list);onUpdate(list);};

  const add=()=>{
    setError("");setSuccess("");
    const n=parseInt(concorso)||0;
    const pNums=nums.map(v=>parseInt(v)||0);
    const ss=parseInt(superstar)||0;
    if(!date.trim()){setError("Inserisci la data");return;}
    if(pNums.some(x=>x<1||x>POOL)){setError(`I ${PICK} numeri devono essere tra 1 e ${POOL}`);return;}
    if([...new Set(pNums)].length!==PICK){setError("I numeri devono essere tutti diversi");return;}
    if(ss<1||ss>90){setError("Il SuperStar deve essere tra 1 e 90");return;}
    const newDraw={n,date:date.trim(),nums:[...new Set(pNums)].sort((a,b)=>a-b),bonus:pBonus.sort((a,b)=>a-b)};
    const updated=[...saved,newDraw].sort((a,b)=>(a.n||0)-(b.n||0));
    persist(updated);
    setConcorso("");setDate("");setNums(Array(PICK).fill(""));setSuperstar(Array(1).fill(""));
    setSuccess(`✓ Concorso #${n} del ${date} aggiunto!`);
    setTimeout(()=>setSuccess(""),3000);
  };

  const remove=(idx)=>persist(saved.filter((_,i)=>i!==idx));
  const muR=avg(DRAWS.map(d=>sm(d.nums)));
  const sigR=Math.sqrt(DRAWS.map(d=>sm(d.nums)).reduce((s,v,_,a)=>s+(v-avg(a))**2,0)/DRAWS.length);

  return(
    <div>
      <h2 style={{color:C.green,fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>📥 Inserimento Nuove Estrazioni</h2>
      <p style={{color:C.dim,fontSize:11,marginBottom:16,lineHeight:1.7}}>
        Aggiungi le estrazioni più recenti. I dati vengono salvati nel browser e aggiornano automaticamente tutte le analisi.
      </p>
      <div style={{background:"#0a1a0a",border:`2px solid ${C.green}44`,borderRadius:12,padding:16,marginBottom:20}}>
        <div style={{color:C.green,fontWeight:700,fontSize:13,marginBottom:12}}>➕ Aggiungi estrazione</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
          <div>
            <div style={{color:C.dim,fontSize:10,marginBottom:3}}>Concorso #</div>
            <input type="number" value={concorso} onChange={e=>setConcorso(e.target.value)} placeholder="41"
              style={{width:70,textAlign:"center",background:"#050510",color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 4px",fontSize:14,fontFamily:"monospace",fontWeight:700,outline:"none"}}/>
          </div>
          <div>
            <div style={{color:C.dim,fontSize:10,marginBottom:3}}>Data</div>
            <input type="text" value={date} onChange={e=>setDate(e.target.value)} placeholder="20/05"
              style={{width:80,textAlign:"center",background:"#050510",color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 6px",fontSize:13,fontFamily:"monospace",fontWeight:700,outline:"none"}}/>
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{color:C.dim,fontSize:10,marginBottom:6}}>{PICK} Numeri (1–{POOL})</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {nums.map((v,i)=>{
              const num=parseInt(v)||0,valid=num>=1&&num<=POOL;
              const isDup=valid&&nums.filter(x=>parseInt(x)===num).length>1;
              return(
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <Ball num={valid&&!isDup?num:"?"} color={isDup?C.red:ACCENT} size={36} glow={valid&&!isDup}/>
                  <input type="number" min={1} max={POOL} value={v}
                    onChange={e=>{const n=[...nums];n[i]=e.target.value;setNums(n);}} placeholder={`N${i+1}`}
                    style={{width:46,textAlign:"center",background:"#050510",color:isDup?C.red:valid?ACCENT:C.dim,
                      border:`1.5px solid ${isDup?C.red:valid?`${ACCENT}66`:C.border}`,
                      borderRadius:7,padding:"5px 2px",fontSize:13,fontFamily:"monospace",fontWeight:700,outline:"none"}}/>
                </div>
              );
            })}
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:8}}>
              <span style={{color:C.dim,fontSize:16}}>│</span>
              <div>
                <div style={{color:"#FFD700",fontSize:10,marginBottom:4}}>SuperStar (1–90)</div>
                <div style={{display:"flex",gap:6}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    {(()=>{const num=parseInt(superstar)||0;const valid=num>=1&&num<=90;return(<>
                      <Ball num={valid?num:"?"} size={36} gold={valid}/>
                      <input type="number" min={1} max={90} value={superstar}
                        onChange={e=>setSuperstar(e.target.value)}
                        style={{width:44,textAlign:"center",background:"#050510",color:"#FFD700",border:"1.5px solid #FFD70055",borderRadius:7,padding:"5px 2px",fontSize:13,fontFamily:"monospace",fontWeight:700,outline:"none"}}/>
                    </>);})()} 
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {nums.filter(v=>parseInt(v)>=1).length>0&&(()=>{
          const vN=nums.map(v=>parseInt(v)||0).filter(n=>n>=1&&n<=POOL);
          const s=sm(vN);
          return(
            <div style={{background:"#080816",borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",fontSize:11}}>
              <span style={{color:C.dim}}>Somma parziale:</span>
              <span style={{color:ACCENT,fontFamily:"monospace",fontWeight:700,fontSize:15}}>{s}</span>
              <span style={{color:C.dim}}>Δ da 127.5: <strong style={{color:s>MU_TEO?C.orange:C.teal}}>{s>MU_TEO?"+":""}{(s-MU_TEO).toFixed(1)}</strong></span>
              <span style={{color:s>=(muR-1.5*sigR)&&s<=(muR+1.5*sigR)?C.green:C.orange,fontSize:10}}>
                {s>=(muR-1.5*sigR)&&s<=(muR+1.5*sigR)?"✓ In banda":"⚡ Fuori banda"}
              </span>
            </div>
          );
        })()}
        {error&&<div style={{color:C.red,fontSize:12,marginBottom:8,padding:"6px 10px",background:`${C.red}11`,borderRadius:6}}>⚠️ {error}</div>}
        {success&&<div style={{color:C.green,fontSize:12,marginBottom:8,padding:"6px 10px",background:`${C.green}11`,borderRadius:6}}>{success}</div>}
        <button onClick={add} style={{width:"100%",padding:"12px",background:`linear-gradient(135deg,${C.green},${C.teal})`,color:"#050510",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"Georgia,serif"}}>✅ Aggiungi Estrazione</button>
      </div>
      {saved.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14}}>
          <div style={{color:C.green,fontWeight:700,fontSize:13,marginBottom:10}}>📋 Estrazioni aggiuntive salvate ({saved.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {[...saved].reverse().map((d,i)=>{
              const s=sm(d.nums);
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#080816",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",flexWrap:"wrap"}}>
                  <span style={{color:C.dim,fontSize:10,minWidth:70}}>#{d.n}·{d.date}</span>
                  <div style={{display:"flex",gap:4}}>{d.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={26}/>)}</div>
                  <span style={{color:C.dim,fontSize:12}}>│</span>
                  {d.superstar?.map(st=><Ball key={st} num={st} size={26} gold/>)}
                  <span style={{color:"#FFD700",fontSize:9}}>SS</span>
                  <span style={{color:s>MU_TEO?C.orange:C.teal,fontFamily:"monospace",fontWeight:700,fontSize:12,marginLeft:"auto"}}>Σ{s}</span>
                  <button onClick={()=>remove(saved.length-1-i)} style={{background:"transparent",color:C.red,border:`1px solid ${C.red}33`,borderRadius:5,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>✕</button>
                </div>
              );
            })}
          </div>
          <button onClick={()=>persist([])} style={{background:"transparent",color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"6px 14px",fontSize:11,cursor:"pointer",marginTop:10}}>🗑 Cancella tutte</button>
        </div>
      )}
      {saved.length===0&&(
        <div style={{textAlign:"center",color:C.dim,padding:"20px 0",fontSize:12}}>
          Nessuna estrazione aggiuntiva. Le analisi usano i {DRAWS.length} concorsi del database base.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 7 — BIGLIETTI
// ═══════════════════════════════════════════════════════════════
function TabBiglietti(){
  const allDraws=useDraws();
  const [tickets,setTickets]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");}catch{return [];}});
  const [expanded,setExpanded]=useState(null);
  const [confirmDel,setConfirmDel]=useState(null); // id biglietto da eliminare

  useEffect(()=>{
    try{setTickets(JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]"));}catch{}
  },[allDraws]);

  const persist=(list)=>{localStorage.setItem(LS_TICKETS_S,JSON.stringify(list));setTickets(list);};
  const remove=(id)=>{persist(tickets.filter(t=>t.id!==id));setConfirmDel(null);setExpanded(null);};
  const clearAll=()=>{persist([]);setConfirmDel(null);};

  function getResults(ticket){
    const fromN=ticket.concorso||0;
    return allDraws.filter(d=>(d.n||0)>fromN).map(d=>{
      const matches=d.nums.filter(n=>ticket.nums.includes(n));
      return {n:d.n,date:d.date,nums:d.nums,bonus:d.superstar,pts:matches.length,matches};
    });
  }

  return(
    <div>
      <h2 style={{color:C.purple,fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>🎫 Biglietti Giocati</h2>
      <p style={{color:C.dim,fontSize:11,marginBottom:16,lineHeight:1.7}}>
        Confronto automatico con tutte le estrazioni successive. I numeri indovinati sono evidenziati in colore.
      </p>

      {tickets.length===0&&(
        <div style={{textAlign:"center",color:C.dim,padding:"28px 0",fontSize:13,background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>
          Nessun biglietto salvato.<br/>
          <span style={{fontSize:11}}>Genera nel tab 🎯 Generatore e premi "💾 Salva".</span>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[...tickets].reverse().map(ticket=>{
          const results=getResults(ticket);
          const bestPts=results.length?Math.max(...results.map(r=>r.pts)):0;
          const bestCol=PRIZE_COLORS[Math.min(bestPts,5)]||C.dim;
          const isOpen=expanded===ticket.id;
          const pendingDel=confirmDel===ticket.id;

          return(
            <div key={ticket.id} style={{
              background:C.card,
              border:`2px solid ${pendingDel?"#C94040":bestPts>=2?bestCol:C.border}`,
              borderRadius:12,overflow:"hidden",
            }}>
              {/* HEADER */}
              <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",
                cursor:"pointer"}} onClick={()=>{if(!pendingDel)setExpanded(isOpen?null:ticket.id);}}>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                  {ticket.nums.map(n=>{
                    const hitAny=results.some(r=>r.matches.includes(n));
                    return <Ball key={n} num={n} color={hitAny?bestCol:ACCENT} size={30} glow={hitAny&&bestPts>=2}/>;
                  })}
                  {ticket.superstar?.length&&<>
                    <span style={{color:C.dim,fontSize:14,alignSelf:"center"}}>│</span>
                    {ticket.superstar?<Ball num={ticket.superstar} size={28} gold/>:null}
                    <span style={{color:"#FFD700",fontSize:8}}>SS</span>
                  </>}
                </div>
                <div style={{flex:1,minWidth:120}}>
                  <div style={{color:C.dim,fontSize:10,marginBottom:2}}>
                    Giocato {ticket.date} · dopo conc.#{ticket.concorso||"?"} · Σ={sm(ticket.nums)}
                    {ticket.strategy&&<span style={{marginLeft:6,color:C.purple}}>· {ticket.strategy}</span>}
                  </div>
                  {results.length>0?(
                    <div style={{color:bestPts>=2?bestCol:C.dim,fontWeight:700,fontSize:12}}>
                      {bestPts>=2
                        ?`🎯 ${PRIZE_LABELS[Math.min(bestPts,5)]} — max ${bestPts} num. (${results.filter(r=>r.pts===bestPts).map(r=>`#${r.n}`).join(", ")})`
                        :`Nessun punto su ${results.length} estrazion${results.length===1?"e":"i"}`}
                    </div>
                  ):<div style={{color:C.dim,fontSize:11}}>⏳ In attesa estrazioni dopo #{ticket.concorso||"?"}</div>}
                </div>
                {bestPts>=2&&!pendingDel&&(
                  <div style={{background:`${bestCol}22`,border:`2px solid ${bestCol}`,borderRadius:8,padding:"5px 10px",textAlign:"center",flexShrink:0}}>
                    <div style={{color:bestCol,fontSize:20,fontWeight:900,fontFamily:"monospace"}}>{bestPts}</div>
                    <div style={{color:bestCol,fontSize:8}}>punti</div>
                  </div>
                )}
                <span style={{color:C.dim,fontSize:12}}>{isOpen&&!pendingDel?"▲":"▼"}</span>
              </div>

              {/* BANNER CONFERMA ELIMINAZIONE */}
              {pendingDel&&(
                <div style={{background:"#1a0606",borderTop:`1px solid #C94040`,padding:"10px 14px",
                  display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{color:"#C94040",fontSize:12,fontWeight:700,flex:1}}>
                    🗑 Confermi l'eliminazione di questo biglietto?
                  </span>
                  <button onClick={()=>remove(ticket.id)} style={{
                    background:"#C94040",color:"#fff",border:"none",borderRadius:7,
                    padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  }}>Sì, elimina</button>
                  <button onClick={()=>setConfirmDel(null)} style={{
                    background:"transparent",color:C.dim,border:`1px solid ${C.border}`,
                    borderRadius:7,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",
                  }}>Annulla</button>
                </div>
              )}

              {/* DETTAGLIO ESPANSO */}
              {isOpen&&!pendingDel&&(
                <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 14px",background:"#06060e"}}>
                  <div style={{background:"#0a0a18",borderRadius:8,padding:"10px 12px",marginBottom:12,border:`1px solid ${ACCENT}33`}}>
                    <div style={{color:ACCENT,fontSize:11,fontWeight:700,marginBottom:6}}>
                      🎟 Sestina giocata dopo conc.#{ticket.concorso||"?"}
                    </div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                      {ticket.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={30}/>)}
                      {ticket.superstar?.length&&<>
                        <span style={{color:C.dim,fontSize:14}}>│</span>
                        {ticket.superstar?<Ball num={ticket.superstar} size={28} gold/>:null}
                        <span style={{color:"#FFD700",fontSize:9}}>SS</span>
                      </>}
                      <span style={{color:C.dim,fontSize:11,marginLeft:8}}>Σ={sm(ticket.nums)}</span>
                    </div>
                  </div>

                  {results.length===0?(
                    <div style={{color:C.dim,fontSize:12,textAlign:"center",padding:"10px 0"}}>
                      ⏳ Nessuna estrazione dopo #{ticket.concorso||"?"}. Inserisci nel tab 📥.
                    </div>
                  ):(
                    <div>
                      <div style={{color:C.dim,fontSize:11,marginBottom:8}}>
                        Confronto con <strong style={{color:ACCENT}}>{results.length}</strong> estrazion{results.length===1?"e":"i"}:
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {results.map(r=>{
                          const col=PRIZE_COLORS[Math.min(r.pts,5)]||C.dim;
                          const hasPts=r.pts>0;
                          return(
                            <div key={r.n} style={{
                              background:r.pts>=2?`${col}10`:hasPts?`${col}08`:"#07070f",
                              border:`1px solid ${r.pts>=2?col:hasPts?col+"66":C.border}`,
                              borderRadius:8,padding:"8px 12px",
                            }}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6,marginBottom:8}}>
                                <span style={{color:C.dim,fontSize:11}}>
                                  Est. <strong style={{color:ACCENT}}>#{r.n}</strong> · {r.date}
                                </span>
                                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                                  {hasPts&&<span style={{background:`${col}22`,border:`1px solid ${col}`,borderRadius:5,padding:"2px 8px",color:col,fontWeight:700,fontSize:11}}>{r.pts} ✓</span>}
                                  <span style={{color:col,fontWeight:700,fontSize:12}}>{PRIZE_LABELS[Math.min(r.pts,5)]}</span>
                                </div>
                              </div>
                              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:hasPts?6:0}}>
                                {r.nums.map(n=>{
                                  const hit=ticket.nums.includes(n);
                                  return(
                                    <div key={n} style={{position:"relative"}}>
                                      <Ball num={n} color={hit?col:"#2a2a3a"} size={28} glow={hit&&r.pts>=2}/>
                                      {hit&&<div style={{position:"absolute",top:-3,right:-3,width:9,height:9,
                                        borderRadius:"50%",background:col,border:"1px solid #06060e",
                                        display:"flex",alignItems:"center",justifyContent:"center",
                                        fontSize:6,color:"#000",fontWeight:900}}>✓</div>}
                                    </div>
                                  );
                                })}
                              </div>
                              {r.matches.length>0&&(
                                <div style={{background:`${col}15`,borderRadius:5,padding:"4px 10px",
                                  display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                                  <span style={{color:col,fontSize:10,fontWeight:700}}>✓ Indovinati:</span>
                                  <div style={{display:"flex",gap:4}}>
                                    {r.matches.map(n=><span key={n} style={{background:`${col}33`,border:`1px solid ${col}`,
                                      borderRadius:4,padding:"1px 6px",color:col,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{n}</span>)}
                                  </div>
                                  <span style={{color:C.dim,fontSize:10,marginLeft:"auto"}}>{r.pts}/{ticket.nums.length} num.</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button onClick={()=>setConfirmDel(ticket.id)} style={{
                    background:"transparent",color:"#C94040",border:"1px solid #C9404033",
                    borderRadius:8,padding:"6px 14px",fontSize:11,cursor:"pointer",marginTop:12,
                  }}>🗑 Elimina biglietto</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tickets.length>0&&(
        <div style={{marginTop:14,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={clearAll} style={{
            background:"transparent",color:"#C94040",border:"1px solid #C9404033",
            borderRadius:8,padding:"7px 16px",fontSize:11,cursor:"pointer",
          }}>🗑 Cancella tutti i biglietti</button>
          <span style={{color:C.dim,fontSize:10}}>{tickets.length} bigliett{tickets.length===1?"o":"i"} salvat{tickets.length===1?"o":"i"}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════
const TABS=[
  {id:"animazione",icon:"📈",label:"Animazione"},
  {id:"segnali",   icon:"🔬",label:"Segnali & Freq."},
  {id:"banda",     icon:"📐",label:"Banda Adattiva"},
  {id:"generatore",icon:"🎯",label:"Generatore"},
  {id:"confronto", icon:"🔁",label:"Confronto"},
  {id:"estrazioni",icon:"📥",label:"Estrazioni"},
  {id:"biglietti", icon:"🎫",label:"Biglietti"},
];

export default function App(){
  const [tab,setTab]=useState("animazione");
  const [extraDraws,setExtraDraws]=useState(()=>{
    try{return JSON.parse(localStorage.getItem(LS_KEY_S)||"[]");}catch{return [];}
  });
  const allDraws=useMemo(()=>{
    // Extra ha priorità su base: stessa n. -> usa versione extra (es. correzioni)
    const extraNs=new Set(extraDraws.map(d=>d.n));
    const base=DRAWS.filter(d=>!extraNs.has(d.n));
    return [...base,...extraDraws].sort((a,b)=>a.n-b.n);
  },[extraDraws]);
  const handleUpdate=useCallback((list)=>{setExtraDraws(list);},[]);
  const last=allDraws[allDraws.length-1];
  const lastSum=sm(last.nums);

  return(
    <DrawsContext.Provider value={allDraws}>
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Courier New',monospace",color:C.text,paddingBottom:60}}>
      <div style={{maxWidth:780,margin:"0 auto",padding:"0 14px"}}>
        <div style={{background:"linear-gradient(180deg,#0c0c1e 0%,transparent 100%)",padding:"20px 0 0",textAlign:"center",marginBottom:0}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{fontSize:28}}>🇮🇹</span>
            <h1 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:24,margin:0,textShadow:`0 0 30px ${ACCENT}44`}}>SuperEnalotto</h1>
            <span style={{background:`${ACCENT}22`,border:`1px solid ${ACCENT}44`,borderRadius:20,padding:"2px 10px",color:ACCENT,fontSize:10,fontWeight:700}}>DASHBOARD</span>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:14,flexWrap:"wrap",marginBottom:10,fontSize:11}}>
            <span style={{color:C.dim}}>Conc. <strong style={{color:ACCENT}}>n.{last.n}</strong> · {last.date}</span>
            <span style={{color:C.dim}}>Ultima Σ: <strong style={{color:lastSum>MU_TEO?C.orange:C.teal}}>{lastSum}</strong></span>
            <span style={{color:C.dim}}>Tot.: <strong style={{color:ACCENT}}>{allDraws.length}</strong></span>
            <span style={{color:C.dim}}>Jackpot: <strong style={{color:C.purple}}>{JACKPOT}</strong></span>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {last.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={34} glow/>)}
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{color:C.dim,fontSize:14}}>│</span>
              {last.superstar?<Ball num={last.superstar} size={34} gold/>:null}
              <span style={{color:"#FFD700",fontSize:9}}>SS</span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:3,marginBottom:20,overflowX:"auto",paddingBottom:4,borderBottom:`1px solid ${C.border}`}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:tab===t.id?`linear-gradient(135deg,${t.id==="biglietti"?C.purple:ACCENT},${C.teal})`:"transparent",
              color:tab===t.id?"#fff":C.dim,
              border:tab===t.id?"none":`1px solid ${C.border}`,
              borderRadius:20,padding:"7px 14px",fontSize:11,
              fontWeight:tab===t.id?700:400,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0,
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
        {tab==="animazione"&&<TabAnimazione/>}
        {tab==="segnali"   &&<TabSegnali/>}
        {tab==="banda"     &&<TabBanda/>}
        {tab==="generatore"&&<TabGeneratore/>}
        {tab==="confronto" &&<TabConfronto/>}
        {tab==="estrazioni"&&<TabEstrazioni onUpdate={handleUpdate}/>}
        {tab==="biglietti" &&<TabBiglietti/>}
        <div style={{marginTop:24,background:"#070712",border:"1px solid #111122",borderRadius:10,padding:12}}>
          <div style={{color:"#252535",fontSize:10,lineHeight:1.7}}>
            ⚠️ Conc.n.83 del 24/05/2026: 14-29-34-57-59-69 (SS=16). Jackpot {JACKPOT}. Strumento puramente statistico — nessun potere predittivo. Il gioco può causare dipendenza. Vietato ai minori di 18 anni.
          </div>
        </div>
      </div>
    </div>
    </DrawsContext.Provider>
  );
}
