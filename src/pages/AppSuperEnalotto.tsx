import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import {
  ComposedChart, LineChart, BarChart, Line, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
  Area, Legend
} from "recharts";
import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════
// DATI BASE 2026 (fallback se Supabase non risponde)
// ═══════════════════════════════════════════════════════════════
const DRAWS_BASE = [
  { n:1,  date:"02/01/2026", nums:[29,33,47,56,69,89], jolly:16, superstar:7 },
  { n:2,  date:"03/01/2026", nums:[16,30,32,43,68,76], jolly:36, superstar:58 },
  { n:3,  date:"05/01/2026", nums:[11,13,17,56,80,84], jolly:41, superstar:13 },
  { n:4,  date:"08/01/2026", nums:[35,42,45,53,55,88], jolly:66, superstar:52 },
  { n:5,  date:"09/01/2026", nums:[31,33,61,68,71,72], jolly:87, superstar:18 },
  { n:6,  date:"10/01/2026", nums:[11,19,24,66,82,88], jolly:58, superstar:48 },
  { n:7,  date:"12/01/2026", nums:[1,7,11,14,37,58],   jolly:70, superstar:22 },
  { n:8,  date:"13/01/2026", nums:[20,29,56,68,72,74], jolly:35, superstar:50 },
  { n:9,  date:"15/01/2026", nums:[44,49,60,69,73,85], jolly:36, superstar:1 },
  { n:10, date:"16/01/2026", nums:[14,21,24,52,80,86], jolly:57, superstar:14 },
  { n:84, date:"26/05/2026", nums:[7,10,35,41,45,61],  jolly:2,  superstar:45 },
];

const MU_TEO    = 277.5;
const SIGMA_TEO = 62;
const JACKPOT   = "163.200.000 €";
const ACCENT    = "#D4AF37";
const POOL      = 90;
const PICK      = 6;
const POPULAR   = new Set([1,2,3,4,5,10,20,30,40,50]);
const LS_KEY_S  = "draws_superenalotto_v1";
const LS_TICKETS_S = "tickets_superenalotto_v1";

const DrawsContext = createContext([]);
const useDraws = () => useContext(DrawsContext);

const PRIZE_LABELS = {0:"–",1:"–",2:"Punto 2",3:"Punto 3",4:"Punto 4",5:"Punto 5",6:"🏆 PUNTI 6!"};
const PRIZE_COLORS = {0:"#4A4A6A",1:"#4A4A6A",2:"#4A8FD4",3:"#2BA89A",4:"#E8B84B",5:"#F07030",6:"#C94040"};

const sm    = a => a.reduce((s,v)=>s+v,0);
const avg   = a => sm(a)/a.length;
const std   = a => { const m=avg(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length); };
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const zOf   = (v,mu,sigma) => (v-mu)/sigma;

function mkRng(seed){
  let s=seed>>>0;
  return ()=>{s=Math.imul(s^s>>>15,s|1);s^=s+Math.imul(s^s>>>7,s|61);return((s^s>>>14)>>>0)/4294967296;};
}

function buildSeries(draws){
  return draws.map((d,i)=>{
    const s=sm(d.nums);
    const sl=draws.slice(0,i+1).map(x=>sm(x.nums));
    const rm=avg(sl);
    const ma5=i>=4?avg(draws.slice(i-4,i+1).map(x=>sm(x.nums))):null;
    return {...d,sum:s,mu:parseFloat(rm.toFixed(2)),
      delta:parseFloat((s-MU_TEO).toFixed(1)),
      zScore:parseFloat(zOf(s,MU_TEO,SIGMA_TEO).toFixed(3)),ma5};
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
    num:n,freq:allDraws.filter(d=>d.superstar===n).length,
    ritardo:(()=>{for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].superstar===n)return allDraws.length-1-i;}return allDraws.length;})(),
    score:calcSSAffinita(n,allDraws,ticketSum,sigmaRef),
  }));
  const maxScore=Math.max(...scores.map(s=>s.score));
  return scores.map(s=>({...s,pct:Math.round(s.score/maxScore*100)})).sort((a,b)=>b.score-a.score);
}

const C={
  gold:"#E8B84B",orange:"#F07030",teal:"#2BA89A",blue:"#4A8FD4",
  red:"#C94040",purple:"#8A5CC4",green:"#4A9E5C",
  bg:"#07070F",card:"#0D0D1A",border:"#1A1A2E",text:"#E0E0F0",dim:"#6A6A8A",
};

const TT=({active,payload,label})=>{
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:"#0e0e20",border:"1px solid #252540",borderRadius:8,padding:"8px 12px",fontSize:12}}>
      <div style={{color:ACCENT,fontWeight:700,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||"#ccc",marginBottom:2}}>
          {p.name}: <strong style={{fontFamily:"monospace"}}>{typeof p.value==="number"?p.value.toFixed(2):p.value}</strong>
        </div>
      ))}
    </div>
  );
};

function Ball({num,color=ACCENT,size=38,glow=false,gold=false}){
  return(
    <div style={{
      width:size,height:size,borderRadius:"50%",
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
    <div style={{background:C.card,border:`1px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
      <div style={{color:C.dim,fontSize:9,marginBottom:2,textTransform:"uppercase",letterSpacing:1}}>{label}</div>
      <div style={{color,fontSize:18,fontWeight:900,fontFamily:"monospace"}}>{value}</div>
      {sub&&<div style={{color:C.dim,fontSize:9,marginTop:2}}>{sub}</div>}
    </div>
  );
}

const PAD={top:48,right:32,bottom:52,left:55};

function drawCanvas(canvas,series,frame,showMA5,hovered,W,H){
  if(!canvas||!series.length) return;
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+"px"; canvas.style.height=H+"px";
  ctx.scale(dpr,dpr);
  const CW=W-PAD.left-PAD.right, CH=H-PAD.top-PAD.bottom;
  const total=series.length;
  const visible=Math.min(Math.ceil(frame),total);
  const toX=i=>PAD.left+(i/(Math.max(total-1,1)))*CW;
  const toY=v=>PAD.top+(1-(v-50)/(520-50))*CH;
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  [100,150,200,277.5,300,350,400,450].forEach(v=>{
    const y=toY(v),isMu=v===277.5;
    ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+CW,y);
    ctx.setLineDash(isMu?[6,3]:[2,6]);
    ctx.strokeStyle=isMu?`${ACCENT}44`:"rgba(255,255,255,0.05)";
    ctx.lineWidth=isMu?1.5:1; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=isMu?`${ACCENT}99`:"rgba(255,255,255,0.3)";
    ctx.font=`${isMu?"bold ":""}9px monospace`; ctx.textAlign="right";
    ctx.fillText(isMu?"277.5":Math.round(v),PAD.left-5,y+3);
  });
  for(let i=0;i<total;i++){
    const x=toX(i);
    if(i===0||i===total-1||i%Math.ceil(total/6)===0){
      ctx.fillStyle="rgba(255,255,255,0.35)"; ctx.font="9px monospace"; ctx.textAlign="center";
      ctx.fillText(series[i].date?.substring(0,5)||"",x,PAD.top+CH+14);
    }
  }
  ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(PAD.left,PAD.top); ctx.lineTo(PAD.left,PAD.top+CH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD.left,PAD.top+CH); ctx.lineTo(PAD.left+CW,PAD.top+CH); ctx.stroke();
  if(visible<2) return;
  function line(vals,col,w,dash=[]){
    ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle=col; ctx.lineWidth=w;
    let started=false;
    for(let i=0;i<visible;i++){
      if(vals[i]==null) continue;
      const x=toX(i),y=toY(vals[i]);
      if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
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
  if(hovered!==null&&hovered<visible){
    const d=series[hovered];
    const x=toX(hovered),y=toY(d.sum);
    const bx=Math.min(x+10,W-168),by=Math.max(PAD.top,y-80);
    ctx.fillStyle="rgba(8,8,20,0.95)"; ctx.strokeStyle=`${ACCENT}66`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(bx,by,162,80,8); ctx.fill(); ctx.stroke();
    ctx.fillStyle=ACCENT; ctx.font="bold 11px monospace"; ctx.textAlign="left";
    ctx.fillText(`${d.date?.substring(0,5)||""}`,bx+10,by+18);
    ctx.fillStyle=d.sum>MU_TEO?C.orange:C.teal;
    ctx.fillText(`Σ = ${d.sum}`,bx+10,by+34);
    ctx.fillStyle=ACCENT; ctx.fillText(`μ = ${d.mu.toFixed(1)}`,bx+10,by+50);
    ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="10px monospace";
    ctx.fillText(`z=${d.zScore.toFixed(2)}`,bx+10,by+66);
  }
}

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
    const obs=new ResizeObserver(e=>{setW(Math.max(280,Math.floor(e[0].contentRect.width)-16));});
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
    const mx=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;
    const CW=W-PAD.left-PAD.right;
    let best=null,bestD=30;
    const vis=Math.min(Math.ceil(frame),total);
    for(let i=0;i<vis;i++){const x=PAD.left+(i/(Math.max(total-1,1)))*CW,d=Math.abs(mx-x);if(d<bestD){bestD=d;best=i;}}
    setHovered(best);
  };
  const play=()=>{if(frame>=total){frameRef.current=1;setFrame(1);}setPlaying(true);};
  const pause=()=>setPlaying(false);
  const reset=()=>{cancelAnimationFrame(rafRef.current);setPlaying(false);frameRef.current=1;setFrame(1);};
  const end=()=>{cancelAnimationFrame(rafRef.current);setPlaying(false);frameRef.current=total;setFrame(total);};
  const vi=Math.min(Math.ceil(frame)-1,total-1);
  const cur=series[vi]||series[0];
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums);
  return(
    <div ref={containerRef}>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>📈 Traiettoria Media Progressiva</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:6,marginBottom:12}}>
        <KpiCard label="Estrazioni" value={allDraws.length} sub={`${series[0]?.date?.substring(0,5)||""} → oggi`}/>
        <KpiCard label="Σ ultima" value={cur.sum} color={cur.sum>MU_TEO?C.orange:C.teal}/>
        <KpiCard label="μ progress." value={cur.mu?.toFixed(1)} color={ACCENT}/>
        <KpiCard label="μ reale" value={muReale.toFixed(1)} color={C.teal} sub={`Δ ${(muReale-MU_TEO).toFixed(1)}`}/>
        <KpiCard label="z-score" value={cur.zScore?.toFixed(2)} color={Math.abs(cur.zScore)<1?C.green:Math.abs(cur.zScore)<2?C.orange:C.red}/>
      </div>
      <div style={{borderRadius:10,overflow:"hidden",border:"1px solid #1a1a2e",marginBottom:10}}>
        <canvas ref={canvasRef} style={{display:"block",cursor:"crosshair",width:"100%"}} onMouseMove={onMove} onMouseLeave={()=>setHovered(null)} onTouchMove={onMove} onTouchEnd={()=>setHovered(null)}/>
      </div>
      <input type="range" min={1} max={total} step={0.05} value={frame}
        onChange={e=>{cancelAnimationFrame(rafRef.current);setPlaying(false);frameRef.current=+e.target.value;setFrame(+e.target.value);}}
        style={{width:"100%",accentColor:ACCENT,cursor:"pointer",marginBottom:8}}/>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.dim,marginBottom:12}}>
        <span>{series[0]?.date?.substring(0,5)||""}</span><span style={{color:ACCENT}}>{Math.ceil(frame)}/{total}</span><span>{series[total-1]?.date?.substring(0,5)||""}</span>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
        {[{i:"⟪",a:reset},{i:playing?"⏸":"▶",a:playing?pause:play,gold:true},{i:"⟫",a:end}].map((b,idx)=>(
          <button key={idx} onClick={b.a} style={{background:b.gold?`linear-gradient(135deg,${ACCENT},${C.teal})`:"rgba(255,255,255,0.05)",color:b.gold?"#fff":"#ccc",border:`1px solid ${b.gold?ACCENT:"rgba(255,255,255,0.1)"}`,borderRadius:10,padding:"9px 16px",fontSize:b.gold?18:14,fontWeight:900,minWidth:46,cursor:"pointer"}}>{b.i}</button>
        ))}
        {[0.2,0.5,1,2].map(s=>(<button key={s} onClick={()=>setSpeed(s)} style={{background:speed===s?`${C.teal}22`:"transparent",color:speed===s?C.teal:C.dim,border:`1px solid ${speed===s?C.teal:"rgba(255,255,255,0.08)"}`,borderRadius:6,padding:"5px 9px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{s}×</button>))}
        <button onClick={()=>setShowMA5(v=>!v)} style={{background:showMA5?`${ACCENT}11`:"transparent",color:showMA5?`${ACCENT}99`:C.dim,border:`1px solid ${showMA5?`${ACCENT}44`:"rgba(255,255,255,0.08)"}`,borderRadius:16,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>MA5</button>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginTop:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:8}}>☯️ Andamento Pari / Dispari</div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={allDraws.slice(-100).map(d=>({date:d.date?.substring(0,5)||"",pari:d.nums.filter(n=>n%2===0).length,dispari:d.nums.filter(n=>n%2!==0).length}))} margin={{top:4,right:8,bottom:0,left:-20}}>
            <CartesianGrid strokeDasharray="2 4" stroke="#0e0e1c"/>
            <XAxis dataKey="date" tick={{fill:C.dim,fontSize:8}} interval={Math.ceil(Math.min(allDraws.length,100)/8)}/>
            <YAxis domain={[0,6]} ticks={[0,2,4,6]} tick={{fill:C.dim,fontSize:8}}/>
            <Tooltip content={<TT/>}/>
            <ReferenceLine y={3} stroke={`${ACCENT}55`} strokeDasharray="5 3"/>
            <Bar dataKey="pari" stackId="a" fill="#4A9E5C" name="Pari"/>
            <Bar dataKey="dispari" stackId="a" fill="#F07030" name="Dispari" radius={[3,3,0,0]}/>
            <Legend wrapperStyle={{fontSize:10}}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginTop:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:8}}>🔢 Distribuzione per Decine (1–90)</div>
        {(()=>{
          const decine=[{label:"1–10",min:1,max:10},{label:"11–20",min:11,max:20},{label:"21–30",min:21,max:30},{label:"31–40",min:31,max:40},{label:"41–50",min:41,max:50},{label:"51–60",min:51,max:60},{label:"61–70",min:61,max:70},{label:"71–80",min:71,max:80},{label:"81–90",min:81,max:90}];
          const DC=["#E8B84B","#F07030","#C94040","#8A5CC4","#4A8FD4","#2BA89A","#4A9E5C","#F07030","#E8B84B"];
          const medie=decine.map((dec,i)=>({...dec,media:allDraws.reduce((s,d)=>s+d.nums.filter(n=>n>=dec.min&&n<=dec.max).length,0)/allDraws.length,col:DC[i]}));
          const maxMedia=Math.max(...medie.map(m=>m.media));
          return(<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(60px,1fr))",gap:4}}>
            {medie.map((m,i)=>(<div key={m.label} style={{background:m.media===maxMedia?`${DC[i]}18`:"#080816",border:`1px solid ${m.media===maxMedia?DC[i]:C.border}`,borderRadius:7,padding:"6px 4px",textAlign:"center"}}>
              <div style={{color:DC[i],fontSize:8,fontWeight:700}}>{m.label}</div>
              <div style={{background:"#0a0a18",borderRadius:2,height:3,overflow:"hidden",margin:"2px 0"}}><div style={{background:DC[i],height:"100%",width:`${(m.media/Math.max(maxMedia,0.1)*100)}%`}}/></div>
              <div style={{color:m.media===maxMedia?DC[i]:C.text,fontSize:11,fontWeight:700,fontFamily:"monospace"}}>{m.media.toFixed(2)}</div>
            </div>))}
          </div>);
        })()}
      </div>
    </div>
  );
}

function TabSegnali(){
  const allDraws=useDraws();
  const [winSize,setWinSize]=useState(20);
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const scored=useMemo(()=>scoreNumbers(allDraws,winSize),[allDraws,winSize]);
  const stats=useMemo(()=>calcStats(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);
  const hotNums=[...scored].sort((a,b)=>b.z-a.z).slice(0,8);
  const coldNums=[...scored].sort((a,b)=>a.z-b.z).slice(0,8);
  const freqSorted=Object.entries(stats.freq).sort((a,b)=>b[1]-a[1]);
  const totalOcc=freqSorted.reduce((s,[,v])=>s+v,0);
  function getRitardo(num){for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].nums.includes(num))return allDraws.length-1-i;}return allDraws.length;}
  const zCol=z=>Math.abs(z)>2?C.red:Math.abs(z)>1?C.orange:C.teal;
  const winOpts=[10,20,50,100,allDraws.length];
  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🔬 Segnali & Frequenze</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:14}}>
        <KpiCard label="Estrazioni" value={allDraws.length}/>
        <KpiCard label="μ reale" value={muReale.toFixed(1)} color={C.orange} sub={`Δ ${(muReale-MU_TEO).toFixed(1)}`}/>
        <KpiCard label="σ reale" value={sigmaReale.toFixed(1)} color={C.teal}/>
        <KpiCard label="μ teorica" value={MU_TEO} color={ACCENT}/>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <span style={{color:C.dim,fontSize:11}}>Finestra analisi:</span>
        {winOpts.map(w=>(
          <button key={w} onClick={()=>setWinSize(Math.min(w,allDraws.length))} style={{background:winSize===Math.min(w,allDraws.length)?`${ACCENT}22`:"transparent",color:winSize===Math.min(w,allDraws.length)?ACCENT:C.dim,border:`1px solid ${winSize===Math.min(w,allDraws.length)?ACCENT:C.border}`,borderRadius:14,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
            {w===allDraws.length?"Tutte":w}
          </button>
        ))}
      </div>
      {[
        {l:"SEGNALE SOMME",z:zOf(muReale,MU_TEO,SIGMA_TEO/Math.sqrt(allDraws.length)),d:`μ reale: ${muReale.toFixed(1)} · teo: ${MU_TEO} · σ: ${sigmaReale.toFixed(1)}`},
        {l:"ANOMALIA MAX FREQUENZA",z:Math.max(...scored.map(s=>Math.abs(s.z))),d:`Più caldo: ${hotNums[0]?.num} (z=+${hotNums[0]?.z.toFixed(1)})`},
        {l:"SCOSTAMENTO DA MEDIA TEORICA",z:(muReale-MU_TEO)/sigmaReale,d:`Δ μ reale–teorica: ${(muReale-MU_TEO).toFixed(1)} punti`},
      ].map(item=>{
        const col=zCol(item.z);
        const label=Math.abs(item.z)>2?"⚠️ Anomalia forte":Math.abs(item.z)>1?"⚡ Anomalia lieve":"✓ Nella norma";
        return(<div key={item.l} style={{background:C.card,border:`1px solid ${col}33`,borderLeft:`3px solid ${col}`,borderRadius:8,padding:"10px 14px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,flexWrap:"wrap",gap:4}}>
            <span style={{color:C.text,fontSize:11}}>{item.l}</span>
            <span style={{color:col,fontSize:11,fontWeight:700}}>{label} (z={item.z.toFixed(2)})</span>
          </div>
          <div style={{background:"#0a0a18",borderRadius:4,height:6,overflow:"hidden",marginBottom:4}}>
            <div style={{background:`linear-gradient(90deg,${C.teal},${col})`,width:`${clamp(Math.abs(item.z)/3*100,0,100)}%`,height:"100%"}}/>
          </div>
          <div style={{color:C.dim,fontSize:10}}>{item.d}</div>
        </div>);
      })}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:14}}>
        <div style={{background:C.card,border:`1px solid ${C.orange}33`,borderRadius:10,padding:12}}>
          <div style={{color:C.orange,fontWeight:700,fontSize:12,marginBottom:8}}>🔥 Top caldi (win {winSize})</div>
          {hotNums.map(h=>(<div key={h.num} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
            <Ball num={h.num} color={C.orange} size={28}/>
            <div style={{flex:1,background:"#0a0a18",borderRadius:3,height:7,overflow:"hidden"}}><div style={{background:C.orange,height:"100%",width:`${Math.min(h.f/Math.max(...hotNums.map(x=>x.f))*100,100)}%`}}/></div>
            <span style={{color:C.orange,fontSize:10,fontFamily:"monospace",minWidth:56}}>{h.f}x z=+{h.z.toFixed(1)}</span>
          </div>))}
        </div>
        <div style={{background:C.card,border:`1px solid ${C.teal}33`,borderRadius:10,padding:12}}>
          <div style={{color:C.teal,fontWeight:700,fontSize:12,marginBottom:8}}>❄️ Top freddi (win {winSize})</div>
          {coldNums.map(h=>(<div key={h.num} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
            <Ball num={h.num} color={C.teal} size={28}/>
            <div style={{flex:1,background:"#0a0a18",borderRadius:3,height:7,overflow:"hidden"}}><div style={{background:C.teal,height:"100%",width:`${clamp(Math.abs(h.z)/3*100,0,100)}%`}}/></div>
            <span style={{color:C.teal,fontSize:10,fontFamily:"monospace",minWidth:56}}>{h.f}x z={h.z.toFixed(1)}</span>
          </div>))}
        </div>
      </div>
      <div style={{marginTop:14,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:12,marginBottom:8}}>🗺️ Mappa frequenze 1–90 ({allDraws.length} estrazioni)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:3,marginBottom:12}}>
          {scored.map(s=>{
            const maxF=Math.max(...scored.map(x=>x.f))||1;
            const intensity=clamp(s.f/maxF,0,1);
            const col=s.isCold?C.teal:s.isHot?C.orange:ACCENT;
            const rit=getRitardo(s.num);
            return(<div key={s.num} title={`${s.num}: ${s.f}x rit.${rit}`} style={{aspectRatio:"1",background:`${col}${Math.round(intensity*180+40).toString(16).padStart(2,"00")}`,border:`1px solid ${col}22`,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontFamily:"monospace",fontWeight:700}}>{s.num}</div>);
          })}
        </div>
        <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Top 10 frequenti (su {allDraws.length} estrazioni):</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
          {freqSorted.slice(0,10).map(([n,f])=>{
            const pct=(f/totalOcc*100).toFixed(1);
            const rit=getRitardo(+n);
            return(<div key={n} style={{background:`${ACCENT}11`,border:`1px solid ${ACCENT}33`,borderRadius:8,padding:"5px 8px",textAlign:"center"}}>
              <Ball num={+n} color={ACCENT} size={26}/>
              <div style={{color:ACCENT,fontSize:10,fontWeight:700}}>{f}x</div>
              <div style={{color:C.teal,fontSize:9}}>{pct}%</div>
              <div style={{color:C.dim,fontSize:9}}>rit.{rit}</div>
            </div>);
          })}
        </div>
        <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Top 10 ritardatari:</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {[...scored].sort((a,b)=>getRitardo(b.num)-getRitardo(a.num)).slice(0,10).map(s=>{
            const rit=getRitardo(s.num);
            const f=stats.freq[s.num]||0;
            return(<div key={s.num} style={{background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:8,padding:"5px 8px",textAlign:"center"}}>
              <Ball num={s.num} color={C.teal} size={26}/>
              <div style={{color:C.teal,fontSize:10,fontWeight:700}}>{f}x</div>
              <div style={{color:C.orange,fontSize:9}}>rit.{rit}</div>
            </div>);
          })}
        </div>
      </div>
    </div>
  );
}

function TabBanda(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);
  const [kBand,setKBand]=useState(1.5);
  const [useAdaptive,setAdaptive]=useState(true);
  const muT=useAdaptive?muReale:MU_TEO,sigT=useAdaptive?sigmaReale:SIGMA_TEO;
  const loB=Math.round(muT-kBand*sigT),hiB=Math.round(muT+kBand*sigT);
  const inBand=series.filter(d=>d.sum>=loB&&d.sum<=hiB).length;
  const chartData=series.slice(-200).map(d=>({date:d.date?.substring(0,5)||"",sum:d.sum,mu:d.mu,loA:Math.round(muReale-kBand*sigmaReale),hiA:Math.round(muReale+kBand*sigmaReale)}));
  const bands=[0.5,1.0,1.5,2.0,2.5].map(k=>({k,loA:Math.round(muReale-k*sigmaReale),hiA:Math.round(muReale+k*sigmaReale),inA:sums.filter(s=>s>=muReale-k*sigmaReale&&s<=muReale+k*sigmaReale).length}));
  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>📐 Banda Adattiva</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:14}}>
        <KpiCard label="μ reale" value={muReale.toFixed(1)} color={C.orange} sub={`su ${allDraws.length} est.`}/>
        <KpiCard label="σ reale" value={sigmaReale.toFixed(1)} color={C.teal}/>
        <KpiCard label="Min Σ" value={Math.min(...sums)} color={C.teal}/>
        <KpiCard label="Max Σ" value={Math.max(...sums)} color={C.red}/>
        <KpiCard label={`In ±${kBand}σ`} value={`${inBand}/${series.length}`} color={C.green} sub={`${(inBand/series.length*100).toFixed(0)}%`}/>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        {[0.5,1.0,1.5,2.0,2.5].map(k=>{
          const pct=(sums.filter(s=>s>=Math.round(muT-k*sigT)&&s<=Math.round(muT+k*sigT)).length/series.length*100).toFixed(0);
          return(<button key={k} onClick={()=>setKBand(k)} style={{background:kBand===k?`${ACCENT}22`:"transparent",color:kBand===k?ACCENT:C.dim,border:`1px solid ${kBand===k?ACCENT:C.border}`,borderRadius:8,padding:"5px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>
            <div style={{fontWeight:700}}>±{k}σ</div><div style={{fontSize:9,color:kBand===k?C.teal:C.dim}}>{pct}%</div>
          </button>);
        })}
        {[{v:true,l:"Adattivo"},{v:false,l:"Teorico"}].map(x=>(<button key={String(x.v)} onClick={()=>setAdaptive(x.v)} style={{background:useAdaptive===x.v?`${C.teal}22`:"transparent",color:useAdaptive===x.v?C.teal:C.dim,border:`1px solid ${useAdaptive===x.v?C.teal:C.border}`,borderRadius:8,padding:"5px 12px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{x.l}</button>))}
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
          <defs><linearGradient id="gBandaSE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity={0.28}/><stop offset="100%" stopColor={ACCENT} stopOpacity={0.08}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#0e0e1c"/>
          <XAxis dataKey="date" tick={{fill:C.dim,fontSize:9}} interval={Math.ceil(chartData.length/8)}/>
          <YAxis domain={[50,520]} tick={{fill:C.dim,fontSize:9}}/>
          <Tooltip content={<TT/>}/>
          <Area type="monotone" dataKey="hiA" stroke={`${ACCENT}cc`} strokeWidth={2} strokeDasharray="5 3" fill="url(#gBandaSE)" activeDot={false}/>
          <Area type="monotone" dataKey="loA" stroke={`${ACCENT}cc`} strokeWidth={2} strokeDasharray="5 3" fill="#07070F" activeDot={false}/>
          <ReferenceLine y={MU_TEO} stroke={`${ACCENT}99`} strokeDasharray="6 3" strokeWidth={1.5}/>
          <Line type="monotone" dataKey="mu" stroke={C.teal} strokeWidth={2} dot={false} name="μ"/>
          <Line type="monotone" dataKey="sum" stroke={ACCENT} strokeWidth={2}
            dot={(props)=>{const{cx,cy,payload}=props;const inB=payload.sum>=loB&&payload.sum<=hiB;return <circle key={cx} cx={cx} cy={cy} r={3} fill={inB?"#4A9E5C":"#C94040"} stroke="none"/>;}}
            name="Somma"/>
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:12}}>
        {bands.map(b=>(<div key={b.k} onClick={()=>setKBand(b.k)} style={{cursor:"pointer",display:"flex",gap:10,alignItems:"center",padding:"7px 10px",borderRadius:8,background:kBand===b.k?`${ACCENT}0a`:C.card,border:`1px solid ${kBand===b.k?`${ACCENT}44`:C.border}`}}>
          <span style={{color:ACCENT,fontFamily:"monospace",fontSize:12,minWidth:36}}>±{b.k}σ</span>
          <div style={{flex:1}}><div style={{background:"#0a0a18",borderRadius:3,height:5,overflow:"hidden"}}><div style={{background:C.teal,height:"100%",width:`${b.inA/series.length*100}%`}}/></div><span style={{color:C.teal,fontSize:9}}>[{b.loA}–{b.hiA}]: {b.inA}/{series.length} ({(b.inA/series.length*100).toFixed(0)}%)</span></div>
        </div>))}
      </div>
    </div>
  );
}

function SSAffinitaPanel({allDraws,ticketSum,sigmaRef,currentSS,selSS,setSelSS}){
  const suggestions=getSSSuggestions(allDraws,ticketSum,sigmaRef);
  const top10=suggestions.slice(0,10);
  const selected=selSS||currentSS;
  return(
    <div style={{background:"#0a0a10",border:"1px solid #FFD70033",borderRadius:10,padding:12,marginBottom:12}}>
      <div style={{color:"#FFD700",fontWeight:700,fontSize:12,marginBottom:4}}>⭐ Affinità SuperStar — top 10</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
        {top10.map((s,idx)=>{
          const isSel=selected===s.num;
          const barCol=idx===0?"#FFD700":idx<3?"#E8B84B":"#aaa";
          return(<div key={s.num} onClick={()=>setSelSS(s.num)} style={{background:isSel?"#FFD70022":"#0e0e1c",border:`2px solid ${isSel?"#FFD700":"#2a2a3a"}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",textAlign:"center",boxShadow:isSel?"0 0 10px #FFD70044":"none"}}>
            <Ball num={s.num} color={isSel?"#FFD700":"#888"} size={28} glow={isSel}/>
            <div style={{background:"#0a0a18",borderRadius:3,height:4,overflow:"hidden",margin:"4px 0"}}><div style={{background:isSel?"#FFD700":barCol,height:"100%",width:`${s.pct}%`}}/></div>
            <div style={{color:isSel?"#FFD700":barCol,fontSize:10,fontWeight:700}}>{s.pct}%</div>
          </div>);
        })}
      </div>
      <div style={{background:"#FFD70008",border:"1px solid #FFD70033",borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{color:C.dim,fontSize:11}}>Selezionato:</span>
        <Ball num={selected||"?"} color="#FFD700" size={36} glow/>
        <span style={{color:"#FFD700",fontWeight:700,fontSize:16,fontFamily:"monospace"}}>{selected||"—"}</span>
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
  const [winSize,setWinSize]=useState(Math.min(20,allDraws.length));
  const [mode,setMode]=useState("auto");
  const [ticket,setTicket]=useState(null);
  const [superstar,setSuperstar]=useState(null);
  const [manualInputs,setManualInputs]=useState(Array(PICK).fill(""));
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
  const loB=Math.round(muCustom-kBand*sigmaEff),hiB=Math.round(muCustom+kBand*sigmaEff);
  const scored=useMemo(()=>scoreNumbers(allDraws,winSize),[allDraws,winSize]);
  const totalOcc=Object.values(stats.freq).reduce((s,v)=>s+v,0);
  const freqEntries=Object.entries(stats.freq).sort((a,b)=>b[1]-a[1]);
  const top6freq=freqEntries.slice(0,6).map(([n])=>+n);
  const top6delay=freqEntries.slice(-6).map(([n])=>+n);
  function getRitardo(num){for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].nums.includes(num))return allDraws.length-1-i;}return allDraws.length;}
  const lastDraw=allDraws[allDraws.length-1];
  const lastEvens=lastDraw?.nums.filter(n=>n%2===0).length||3;
  const lastOdds=PICK-lastEvens;
  const genera=()=>{const seed=Date.now();setTicket(generateTicket(scored,strategy,loB,hiB,muCustom,seed));setSuperstar(generateSuperStar(seed));};
  const generaTattico=()=>{
    setLoading(true);setResults([]);setScanned(0);
    setTimeout(()=>{
      const rng=mkRng(Date.now());const found=[],maxAttempts=150000;let sc=0;
      const freqNums=parseNums(freqInput),delayNums=parseNums(delayInput);
      while(found.length<5&&sc<maxAttempts){
        sc++;const pool=Array.from({length:POOL},(_,i)=>i+1);const nums=[];
        while(nums.length<PICK){const idx=Math.floor(rng()*pool.length);nums.push(pool.splice(idx,1)[0]);}
        nums.sort((a,b)=>a-b);const s=sm(nums);if(s<minSum||s>maxSum)continue;
        const evens=nums.filter(n=>n%2===0).length,odds=PICK-evens;
        if(ratio!=="any"){const[re,ro]=ratio.split("-").map(Number);if(evens!==re||odds!==ro)continue;}
        if(freqNums.length>0&&!nums.some(n=>freqNums.includes(n)))continue;
        if(delayNums.length>0&&nums.filter(n=>delayNums.includes(n)).length>2)continue;
        if(decineAttive.size>0){
          const DEC=[{min:1,max:10},{min:11,max:20},{min:21,max:30},{min:31,max:40},{min:41,max:50},{min:51,max:60},{min:61,max:70},{min:71,max:80},{min:81,max:90}];
          let decOk=true;decineAttive.forEach((cnt,idx)=>{const inDec=nums.filter(n=>n>=DEC[idx].min&&n<=DEC[idx].max).length;if(inDec!==cnt)decOk=false;});
          if(!decOk)continue;
        }
        const st=generateSuperStar(sc+Date.now());
        found.push({nums,sum:s,evens,odds,superstar:st,zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2)});
      }
      setResults(found);setScanned(sc);setLoading(false);
    },50);
  };
  const ratioOpts=[{v:"any",l:"Qualsiasi"},{v:"3-3",l:"3P–3D"},{v:"4-2",l:"4P–2D"},{v:"2-4",l:"2P–4D"},{v:"5-1",l:"5P–1D"},{v:"1-5",l:"1P–5D"}];
  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🎯 Generatore Sestine + SuperStar</h2>
      <div style={{background:`${ACCENT}08`,border:`1px solid ${ACCENT}33`,borderRadius:12,padding:12,marginBottom:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:12,marginBottom:8}}>📊 Suggerimenti — {allDraws.length} estrazioni storiche</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:ACCENT,fontSize:10,fontWeight:700,marginBottom:5}}>⚡ Range Somma</div>
            {[{l:"±0.5σ",lo:Math.round(muReale-sigmaReale*0.5),hi:Math.round(muReale+sigmaReale*0.5)},
              {l:"±1σ",lo:Math.round(muReale-sigmaReale),hi:Math.round(muReale+sigmaReale)},
              {l:"±1.5σ",lo:Math.round(muReale-sigmaReale*1.5),hi:Math.round(muReale+sigmaReale*1.5)}].map(b=>(
              <button key={b.l} onClick={()=>{setMinSum(b.lo);setMaxSum(b.hi);}} style={{display:"block",width:"100%",background:`${ACCENT}11`,border:`1px solid ${ACCENT}33`,borderRadius:5,padding:"4px 6px",cursor:"pointer",fontFamily:"inherit",marginBottom:3,textAlign:"left"}}>
                <span style={{color:ACCENT,fontSize:10,fontWeight:700}}>{b.l}: </span><span style={{color:C.text,fontSize:10}}>{b.lo}–{b.hi}</span>
              </button>
            ))}
            <div style={{color:C.dim,fontSize:9}}>μ={muReale.toFixed(1)} · σ={sigmaReale.toFixed(1)}</div>
          </div>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:C.orange,fontSize:10,fontWeight:700,marginBottom:4}}>🔥 Freq. storiche (top 6)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:4}}>
              {top6freq.map(n=>{const f=stats.freq[n]||0,pct=(f/totalOcc*100).toFixed(1);return(<div key={n} style={{textAlign:"center"}}><Ball num={n} color={C.orange} size={22}/><div style={{color:C.orange,fontSize:7}}>{pct}%</div></div>);})}
            </div>
            <button onClick={()=>setFreqInput(top6freq.slice(0,4).join(","))} style={{width:"100%",background:`${C.orange}11`,border:`1px solid ${C.orange}33`,borderRadius:5,padding:"3px",cursor:"pointer",fontFamily:"inherit",color:C.orange,fontSize:10}}>Usa top 4</button>
          </div>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:C.teal,fontSize:10,fontWeight:700,marginBottom:4}}>❄️ Ritard. storici (top 6)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:4}}>
              {top6delay.map(n=>{const rit=getRitardo(n),pct=(rit/allDraws.length*100).toFixed(0);return(<div key={n} style={{textAlign:"center"}}><Ball num={n} color={C.teal} size={22}/><div style={{color:C.teal,fontSize:7}}>{pct}%</div></div>);})}
            </div>
            <button onClick={()=>setDelayInput(top6delay.slice(0,4).join(","))} style={{width:"100%",background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:5,padding:"3px",cursor:"pointer",fontFamily:"inherit",color:C.teal,fontSize:10}}>Usa top 4</button>
          </div>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:ACCENT,fontSize:10,fontWeight:700,marginBottom:4}}>☯️ Pari/Dispari (ultima)</div>
            <div style={{background:`${C.purple}15`,border:`1px solid ${C.purple}33`,borderRadius:6,padding:"5px 8px"}}>
              <div style={{color:C.purple,fontSize:9,fontWeight:700,marginBottom:3}}>Ultima estrazione:</div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{color:"#fff",fontFamily:"monospace",fontSize:12,fontWeight:700}}>{lastEvens}P–{lastOdds}D</span>
                <button onClick={()=>setRatio(`${lastEvens}-${lastOdds}`)} style={{background:ratio===`${lastEvens}-${lastOdds}`?`${C.purple}33`:`${C.purple}11`,color:C.purple,border:`1px solid ${C.purple}44`,borderRadius:5,padding:"2px 8px",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{ratio===`${lastEvens}-${lastOdds}`?"✓ Sel.":"Usa"}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {[{id:"auto",l:"🤖 Automatica"},{id:"manual",l:"✍️ Manuale"},{id:"tattico",l:"⚡ Tattico"}].map(m=>(
          <button key={m.id} onClick={()=>setMode(m.id)} style={{background:mode===m.id?`${ACCENT}22`:"transparent",color:mode===m.id?ACCENT:C.dim,border:`1px solid ${mode===m.id?ACCENT:C.border}`,borderRadius:18,padding:"6px 14px",fontSize:11,fontWeight:mode===m.id?700:400,cursor:"pointer",fontFamily:"inherit"}}>{m.l}</button>
        ))}
      </div>
      {mode==="auto"&&(<div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
          {[{id:"cold",l:"❄️",c:C.teal},{id:"unpop",l:"👥",c:C.purple},{id:"balanced",l:"⚖️",c:ACCENT}].map(s=>(<button key={s.id} onClick={()=>setStrategy(s.id)} style={{background:strategy===s.id?`${s.c}22`:"transparent",color:strategy===s.id?s.c:C.dim,border:`1px solid ${strategy===s.id?s.c:C.border}`,borderRadius:14,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{s.l}</button>))}
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <span style={{color:C.dim,fontSize:10}}>μ:</span>
            <input type="range" min={100} max={450} value={muCustom} onChange={e=>setMuCustom(+e.target.value)} style={{width:70,accentColor:ACCENT}}/>
            <input type="number" min={100} max={450} value={muCustom} onChange={e=>setMuCustom(Math.max(100,Math.min(450,+e.target.value)))} style={{width:60,background:"#0a0a1c",color:ACCENT,border:`1px solid ${ACCENT}55`,borderRadius:6,padding:"3px 6px",fontSize:12,fontFamily:"monospace",outline:"none"}}/>
          </div>
          <div style={{width:"100%",marginTop:6}}>
            <div style={{color:C.dim,fontSize:10,marginBottom:5}}>⚙️ BANDA σ:</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {[0.5,1.0,1.5,2.0,2.5].map(k=>{const se=sigmaMode==="reale"?sigmaReale:SIGMA_TEO;const lo=Math.round(muCustom-k*se);const hi=Math.round(muCustom+k*se);const inB=series.filter(d=>d.sum>=lo&&d.sum<=hi).length;const pct=(inB/series.length*100).toFixed(0);const isActive=kBand===k;return(
                <button key={k} onClick={()=>setKBand(k)} style={{flex:1,minWidth:70,background:isActive?`linear-gradient(135deg,${ACCENT}33,${ACCENT}11)`:"#080816",color:isActive?ACCENT:C.dim,border:`2px solid ${isActive?ACCENT:C.border}`,borderRadius:10,padding:"8px 4px",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                  <div style={{fontSize:13,fontWeight:900,fontFamily:"monospace"}}>±{k}σ</div>
                  <div style={{fontSize:10,fontFamily:"monospace",color:isActive?C.teal:C.dim,marginTop:2}}>{lo}–{hi}</div>
                  <div style={{fontSize:9,color:isActive?C.green:C.dim,marginTop:1}}>{pct}% storiche</div>
                </button>
              );})}
            </div>
          </div>
        </div>
        <button onClick={genera} style={{width:"100%",padding:"13px",background:`linear-gradient(135deg,${ACCENT},${C.teal})`,color:"#fff",border:"none",borderRadius:10,fontSize:16,fontWeight:900,cursor:"pointer",fontFamily:"Georgia,serif",marginBottom:12}}>🎲 Genera Sestina + SuperStar</button>
        {ticket&&(<div style={{background:"#080816",border:`1px solid ${ACCENT}55`,borderRadius:12,padding:14}}>
          <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {ticket.nums.map(n=>{const s=scored.find(x=>x.num===n);const col=s?.isHot?C.orange:s?.isCold?C.teal:ACCENT;return <Ball key={n} num={n} color={col} size={46} glow/>;})}<div style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:C.dim,fontSize:14}}>│</span>{superstar?<Ball num={superstar} size={46} gold glow/>:null}<span style={{color:"#FFD700",fontSize:9}}>SS</span></div>
          </div>
          <SSAffinitaPanel allDraws={allDraws} ticketSum={ticket.sum} sigmaRef={sigmaEff} currentSS={superstar} selSS={selSSBonus[0]||null} setSelSS={n=>setSelSSBonus([n])}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
            {[{l:"Σ",v:ticket.sum,c:ACCENT},{l:"Δ da μ",v:(ticket.sum>muCustom?"+":"")+(ticket.sum-muCustom),c:C.teal},{l:"Δ da 277.5",v:(ticket.sum>MU_TEO?"+":"")+(ticket.sum-MU_TEO).toFixed(1),c:ticket.sum>MU_TEO?C.orange:C.teal},{l:"z",v:zOf(ticket.sum,MU_TEO,SIGMA_TEO).toFixed(2),c:Math.abs(zOf(ticket.sum,MU_TEO,SIGMA_TEO))<1?C.green:C.orange}].map(x=>(<div key={x.l} style={{background:"#0a0a18",borderRadius:6,padding:8,textAlign:"center"}}><div style={{color:C.dim,fontSize:9}}>{x.l}</div><div style={{color:x.c,fontSize:15,fontWeight:900,fontFamily:"monospace"}}>{x.v}</div></div>))}
          </div>
          <button onClick={()=>{const t={id:Date.now(),nums:ticket.nums,superstar:selSSBonus[0]||superstar,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy,sum:ticket.sum};const prev=JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");localStorage.setItem(LS_TICKETS_S,JSON.stringify([...prev,t]));alert(`✅ Sestina salvata!\n${ticket.nums.join("-")} | SS:${selSSBonus[0]||superstar||"—"}`);}} style={{width:"100%",padding:"10px",background:`${C.purple}22`,color:C.purple,border:`2px solid ${C.purple}`,borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💾 Salva → 🎫 Biglietti</button>
        </div>)}
      </div>)}
      {mode==="manual"&&(<div>
        <div style={{color:C.dim,fontSize:11,marginBottom:10}}>Inserisci {PICK} numeri (1–90).</div>
        <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap",marginBottom:10}}>
          {manualInputs.map((v,i)=>{const num=parseInt(v)||0,valid=num>=1&&num<=POOL;const isDup=valid&&manualInputs.filter(x=>parseInt(x)===num).length>1;const s=scored.find(x=>x.num===num);const col=isDup?C.red:s?.isHot?C.orange:s?.isCold?C.teal:ACCENT;return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><Ball num={valid&&!isDup?num:"?"} color={valid&&!isDup?col:"#333"} size={38}/><input type="number" min={1} max={POOL} value={v} onChange={e=>{const next=[...manualInputs];next[i]=e.target.value;setManualInputs(next);}} style={{width:48,textAlign:"center",background:"#080816",color:col,border:`1.5px solid ${isDup?C.red:valid?`${col}55`:C.border}`,borderRadius:7,padding:"4px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>);})}
        </div>
        <div style={{textAlign:"center",color:C.dim,fontSize:10,marginBottom:10}}>Σ parziale: <strong style={{color:ACCENT,fontSize:15}}>{sm(manualInputs.map(v=>parseInt(v)||0).filter(n=>n>=1&&n<=POOL))||0}</strong></div>
      </div>)}
      {mode==="tattico"&&(<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:12}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
            <div style={{color:ACCENT,fontSize:11,fontWeight:700,marginBottom:6}}>⚡ Range Somma</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
              {[0.5,1.0,1.5,2.0].map(k=>{const lo=Math.round(muReale-k*sigmaReale);const hi=Math.round(muReale+k*sigmaReale);const isA=minSum===lo&&maxSum===hi;return(<button key={k} onClick={()=>{setMinSum(lo);setMaxSum(hi);}} style={{flex:1,minWidth:50,background:isA?`${ACCENT}22`:"#080816",color:isA?ACCENT:C.dim,border:`1px solid ${isA?ACCENT:C.border}`,borderRadius:7,padding:"4px 2px",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                <div style={{fontSize:10,fontWeight:900}}>±{k}σ</div><div style={{fontSize:8,color:isA?C.teal:C.dim}}>{lo}–{hi}</div>
              </button>);})}
            </div>
            <div style={{display:"flex",gap:6}}>
              {[{l:"Min Σ",v:minSum,set:setMinSum},{l:"Max Σ",v:maxSum,set:setMaxSum}].map(f=>(<div key={f.l} style={{flex:1}}><div style={{color:C.dim,fontSize:9,marginBottom:2}}>{f.l}</div><input type="number" value={f.v} onChange={e=>f.set(+e.target.value)} style={{width:"100%",background:"#0a0a1c",color:C.text,border:"1px solid #2d2d54",borderRadius:5,padding:"5px",fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/></div>))}
            </div>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
            <div style={{color:ACCENT,fontSize:11,fontWeight:700,marginBottom:6}}>☯️ Pari/Dispari</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>{ratioOpts.map(r=>(<button key={r.v} onClick={()=>setRatio(r.v)} style={{background:ratio===r.v?"#2d3748":"#0a0a1c",color:ratio===r.v?"#00f2fe":C.text,border:`1px solid ${ratio===r.v?"#00f2fe":"#2d2d54"}`,borderRadius:5,padding:"4px 2px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{r.l}</button>))}</div>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
            <div style={{color:ACCENT,fontSize:11,fontWeight:700,marginBottom:6}}>📊 Filtri</div>
            <div style={{marginBottom:5}}><div style={{color:C.orange,fontSize:9,marginBottom:2}}>🔥 Frequenti:</div><input type="text" value={freqInput} onChange={e=>setFreqInput(e.target.value)} placeholder="Es. 39,57,64" style={{width:"100%",background:"#0a0a1c",color:C.text,border:"1px solid #2d2d54",borderRadius:5,padding:"4px",fontSize:10,outline:"none",boxSizing:"border-box"}}/></div>
            <div><div style={{color:C.teal,fontSize:9,marginBottom:2}}>❄️ Ritardatari:</div><input type="text" value={delayInput} onChange={e=>setDelayInput(e.target.value)} placeholder="Es. 4,15,30" style={{width:"100%",background:"#0a0a1c",color:C.text,border:"1px solid #2d2d54",borderRadius:5,padding:"4px",fontSize:10,outline:"none",boxSizing:"border-box"}}/></div>
          </div>
          {(()=>{
            const DECINE_UI=[{label:"1–10",min:1,max:10},{label:"11–20",min:11,max:20},{label:"21–30",min:21,max:30},{label:"31–40",min:31,max:40},{label:"41–50",min:41,max:50},{label:"51–60",min:51,max:60},{label:"61–70",min:61,max:70},{label:"71–80",min:71,max:80},{label:"81–90",min:81,max:90}];
            const DC=["#E8B84B","#F07030","#C94040","#8A5CC4","#4A8FD4","#2BA89A","#4A9E5C","#F07030","#E8B84B"];
            const medieDec=DECINE_UI.map((d,i)=>({...d,idx:i,media:allDraws.reduce((s,dr)=>s+dr.nums.filter(n=>n>=d.min&&n<=d.max).length,0)/allDraws.length}));
            const maxMedia=Math.max(...medieDec.map(m=>m.media));
            const toggleDec=(idx,delta)=>setDecineAttive(prev=>{const next=new Map(prev);const cur=next.get(idx)||0;const nv=Math.max(0,Math.min(cur+delta,PICK));if(nv===0)next.delete(idx);else next.set(idx,nv);return next;});
            const totRichiesti=[...decineAttive.values()].reduce((a,b)=>a+b,0);
            return(<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,gridColumn:"1 / -1"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{color:ACCENT,fontSize:11,fontWeight:700}}>🔢 Filtro Decine</div>
                <button onClick={()=>setDecineAttive(new Map())} style={{background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 8px",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>✕ Reset</button>
              </div>
              <div style={{color:C.dim,fontSize:9,marginBottom:8}}>{decineAttive.size===0?"Nessun filtro":`${decineAttive.size} decine — ${totRichiesti} su 6`}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(60px,1fr))",gap:4}}>
                {medieDec.map((d,i)=>{const cnt=decineAttive.get(i)||0;return(<div key={d.label} style={{background:cnt>0?`${DC[i]}18`:"#080816",border:`2px solid ${cnt>0?DC[i]:C.border}`,borderRadius:8,padding:"5px 3px",textAlign:"center"}}>
                  <div style={{color:cnt>0?DC[i]:C.dim,fontSize:8,fontWeight:700}}>{d.label}</div>
                  <div style={{background:"#0a0a18",borderRadius:3,height:3,overflow:"hidden",margin:"2px 0"}}><div style={{background:DC[i],height:"100%",width:`${(d.media/Math.max(maxMedia,0.1)*100)}%`}}/></div>
                  <div style={{color:cnt>0?DC[i]:"#555",fontSize:13,fontWeight:900,fontFamily:"monospace",margin:"2px 0",minHeight:18}}>{cnt>0?cnt:"–"}</div>
                  <div style={{display:"flex",gap:2,justifyContent:"center"}}>
                    <button onClick={e=>{e.stopPropagation();toggleDec(i,-1);}} style={{width:20,height:20,borderRadius:4,background:cnt>0?"#1a0606":"#1a1a2e",color:cnt>0?"#C94040":"#333",border:`1px solid ${cnt>0?"#C94040":"#333"}`,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                    <button onClick={e=>{e.stopPropagation();toggleDec(i,1);}} style={{width:20,height:20,borderRadius:4,background:`${DC[i]}22`,color:DC[i],border:`1px solid ${DC[i]}`,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                  </div>
                </div>);})}
              </div>
            </div>);
          })()}
        </div>
        <button onClick={generaTattico} disabled={loading} style={{width:"100%",padding:"12px",background:loading?"#222":"linear-gradient(135deg,#FF6B35,#E63946)",color:loading?"#666":"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",marginBottom:12}}>{loading?"⏳ Scansione...":"⚡ GENERA COLONNE TATTICHE"}</button>
        {scanned>0&&<div style={{color:C.dim,fontSize:11,marginBottom:8}}>Scansionate: <strong style={{color:C.orange}}>{scanned.toLocaleString("it-IT")}</strong> · Trovate: <strong style={{color:C.green}}>{results.length}</strong></div>}
        {results.map((r,i)=>(<div key={i} style={{background:C.card,border:`1px solid ${ACCENT}33`,borderLeft:`3px solid ${ACCENT}`,borderRadius:9,padding:"10px 12px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:7,flexWrap:"wrap",gap:5}}>
            <span style={{color:C.dim,fontSize:10,fontWeight:700}}>LINEA {i+1}</span>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <span style={{background:"#12122a",borderRadius:4,padding:"2px 7px",color:ACCENT,fontSize:10}}>Σ {r.sum}</span>
              <span style={{background:"#12122a",borderRadius:4,padding:"2px 7px",color:C.text,fontSize:10}}>{r.evens}P–{r.odds}D</span>
              <span style={{background:"#12122a",borderRadius:4,padding:"2px 7px",fontSize:10,color:Math.abs(parseFloat(r.zScore))<1?C.green:C.orange}}>z={r.zScore}</span>
              <button onClick={()=>{const t={id:Date.now()+i,nums:r.nums,superstar:r.superstar,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy:"tattico",sum:r.sum};const prev=JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");localStorage.setItem(LS_TICKETS_S,JSON.stringify([...prev,t]));alert(`✅ Linea ${i+1} salvata!`);}} style={{background:`${C.purple}22`,color:C.purple,border:`1px solid ${C.purple}`,borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💾 Salva</button>
            </div>
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{r.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={34}/>)}</div>
            <span style={{color:C.dim}}>│</span>{r.superstar?<Ball num={r.superstar} size={34} gold/>:null}<span style={{color:"#FFD700",fontSize:10}}>SS</span>
          </div>
        </div>))}
      </div>)}
    </div>
  );
}

function TabEstrazioni({onUpdate}){
  const allDraws=useDraws();
  const [concorso,setConcorso]=useState("");
  const [date,setDate]=useState("");
  const [nums,setNums]=useState(Array(PICK).fill(""));
  const [jollyInput,setJollyInput]=useState("");
  const [superstarInput,setSuperstarInput]=useState("");
  const [saved,setSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_KEY_S)||"[]");}catch{return [];}});
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [savingToDb,setSavingToDb]=useState(false);
  const persist=(list)=>{localStorage.setItem(LS_KEY_S,JSON.stringify(list));setSaved(list);onUpdate(list);};
  const add=async()=>{
    setError("");setSuccess("");
    const n=parseInt(concorso)||0;
    const pNums=nums.map(v=>parseInt(v)||0);
    const j=parseInt(jollyInput)||0;
    const ss=parseInt(superstarInput)||0;
    if(!date.trim()){setError("Inserisci la data");return;}
    if(pNums.some(x=>x<1||x>POOL)){setError(`I ${PICK} numeri devono essere 1–${POOL}`);return;}
    if([...new Set(pNums)].length!==PICK){setError("Numeri duplicati");return;}
    const newDraw={n,date:date.trim(),nums:[...new Set(pNums)].sort((a,b)=>a-b)};
    if(j>=1&&j<=90)newDraw.jolly=j;
    if(ss>=1&&ss<=90)newDraw.superstar=ss;
    // Salva in Supabase
    setSavingToDb(true);
    try{
      const dateIso=date.trim().split("/").length===2?`2026-${date.trim().split("/")[1].padStart(2,"0")}-${date.trim().split("/")[0].padStart(2,"0")}`:date.trim();
      const {error:dbErr}=await supabase.from("superenalotto").insert({
        data:dateIso,
        n1:newDraw.nums[0],n2:newDraw.nums[1],n3:newDraw.nums[2],
        n4:newDraw.nums[3],n5:newDraw.nums[4],n6:newDraw.nums[5],
        jolly:j||null,superstar:ss||null,
      });
      if(dbErr) throw dbErr;
      setSuccess(`✅ Concorso #${n} salvato nel database!`);
    }catch(err){
      console.error(err);
      setSuccess(`✅ Salvato localmente (DB: ${err.message})`);
    }
    setSavingToDb(false);
    const updated=[...saved,newDraw].sort((a,b)=>(a.n||0)-(b.n||0));
    persist(updated);
    setConcorso("");setDate("");setNums(Array(PICK).fill(""));setJollyInput("");setSuperstarInput("");
    setTimeout(()=>setSuccess(""),4000);
  };
  const remove=(idx)=>persist(saved.filter((_,i)=>i!==idx));
  return(
    <div>
      <h2 style={{color:C.green,fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>📥 Inserimento Nuove Estrazioni</h2>
      <div style={{background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:11}}>
        <span style={{color:C.teal}}>🔗 Database Supabase collegato — </span>
        <span style={{color:C.dim}}>le nuove estrazioni vengono salvate nel DB e sono disponibili a tutti</span>
      </div>
      <div style={{background:"#0a1a0a",border:`2px solid ${C.green}44`,borderRadius:12,padding:16,marginBottom:20}}>
        <div style={{color:C.green,fontWeight:700,fontSize:13,marginBottom:12}}>➕ Aggiungi estrazione</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
          <div><div style={{color:C.dim,fontSize:10,marginBottom:3}}>Concorso #</div><input type="number" value={concorso} onChange={e=>setConcorso(e.target.value)} placeholder="85" style={{width:70,textAlign:"center",background:"#050510",color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 4px",fontSize:14,fontFamily:"monospace",outline:"none"}}/></div>
          <div><div style={{color:C.dim,fontSize:10,marginBottom:3}}>Data (gg/mm)</div><input type="text" value={date} onChange={e=>setDate(e.target.value)} placeholder="dd/mm" style={{width:80,textAlign:"center",background:"#050510",color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 6px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{color:C.dim,fontSize:10,marginBottom:6}}>{PICK} Numeri (1–{POOL})</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {nums.map((v,i)=>{const num=parseInt(v)||0,valid=num>=1&&num<=POOL;const isDup=valid&&nums.filter(x=>parseInt(x)===num).length>1;return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><Ball num={valid&&!isDup?num:"?"} color={isDup?C.red:ACCENT} size={36} glow={valid&&!isDup}/><input type="number" min={1} max={POOL} value={v} onChange={e=>{const n=[...nums];n[i]=e.target.value;setNums(n);}} placeholder={`N${i+1}`} style={{width:46,textAlign:"center",background:"#050510",color:isDup?C.red:valid?ACCENT:C.dim,border:`1.5px solid ${isDup?C.red:valid?`${ACCENT}66`:C.border}`,borderRadius:7,padding:"5px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>);})}
          </div>
        </div>
        <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
          <div><div style={{color:C.dim,fontSize:10,marginBottom:4}}>Jolly (1–90)</div><input type="number" min={1} max={90} value={jollyInput} onChange={e=>setJollyInput(e.target.value)} style={{width:60,textAlign:"center",background:"#050510",color:C.text,border:"1px solid #444",borderRadius:6,padding:"6px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>
          <div><div style={{color:"#FFD700",fontSize:10,marginBottom:4}}>SuperStar (1–90)</div><input type="number" min={1} max={90} value={superstarInput} onChange={e=>setSuperstarInput(e.target.value)} style={{width:60,textAlign:"center",background:"#050510",color:"#FFD700",border:"1px solid #FFD70055",borderRadius:6,padding:"6px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>
        </div>
        {error&&<div style={{color:C.red,fontSize:12,marginBottom:8,padding:"6px 10px",background:`${C.red}11`,borderRadius:6}}>⚠️ {error}</div>}
        {success&&<div style={{color:C.green,fontSize:12,marginBottom:8,padding:"6px 10px",background:`${C.green}11`,borderRadius:6}}>{success}</div>}
        <button onClick={add} disabled={savingToDb} style={{width:"100%",padding:"12px",background:savingToDb?"#1a3a1a":`linear-gradient(135deg,${C.green},#2BA89A)`,color:savingToDb?"#4A9E5C":"#050510",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:savingToDb?"not-allowed":"pointer",fontFamily:"Georgia,serif"}}>
          {savingToDb?"⏳ Salvataggio...":"✅ Aggiungi Estrazione"}
        </button>
      </div>
    </div>
  );
}

function TabBiglietti(){
  const allDraws=useDraws();
  const [tickets,setTickets]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");}catch{return [];}});
  const [expanded,setExpanded]=useState(null);
  const [confirmDel,setConfirmDel]=useState(null);
  useEffect(()=>{try{setTickets(JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]"));}catch{}},[allDraws]);
  const persist=(list)=>{localStorage.setItem(LS_TICKETS_S,JSON.stringify(list));setTickets(list);};
  const remove=(id)=>{persist(tickets.filter(t=>t.id!==id));setConfirmDel(null);setExpanded(null);};
  function getResults(ticket){
    const fromN=ticket.concorso||0;
    return allDraws.filter(d=>(d.n||0)>fromN).map(d=>{
      const matches=d.nums.filter(n=>ticket.nums.includes(n));
      return{n:d.n,date:d.date,nums:d.nums,superstar:d.superstar,pts:matches.length,matches};
    });
  }
  return(
    <div>
      <h2 style={{color:C.purple,fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>🎫 Biglietti Giocati</h2>
      <p style={{color:C.dim,fontSize:11,marginBottom:16,lineHeight:1.7}}>Confronto automatico con le estrazioni successive ({allDraws.length} totali).</p>
      {tickets.length===0&&(<div style={{textAlign:"center",color:C.dim,padding:"28px 0",fontSize:13,background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>Nessun biglietto.<br/><span style={{fontSize:11}}>Genera nel tab 🎯 e premi 💾 Salva.</span></div>)}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[...tickets].reverse().map(ticket=>{
          const results=getResults(ticket);
          const bestPts=results.length?Math.max(...results.map(r=>r.pts)):0;
          const bestCol=PRIZE_COLORS[Math.min(bestPts,6)]||C.dim;
          const isOpen=expanded===ticket.id;
          const pendingDel=confirmDel===ticket.id;
          return(<div key={ticket.id} style={{background:C.card,border:`2px solid ${pendingDel?"#C94040":bestPts>=2?bestCol:C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",cursor:"pointer"}} onClick={()=>{if(!pendingDel)setExpanded(isOpen?null:ticket.id);}}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                {ticket.nums.map(n=>{const hitAny=results.some(r=>r.matches.includes(n));return<Ball key={n} num={n} color={hitAny?bestCol:ACCENT} size={30} glow={hitAny&&bestPts>=2}/>;})}{typeof ticket.superstar==="number"&&<><span style={{color:C.dim,fontSize:14,alignSelf:"center"}}>│</span><Ball num={ticket.superstar} size={28} gold/><span style={{color:"#FFD700",fontSize:8}}>SS</span></>}
              </div>
              <div style={{flex:1,minWidth:120}}>
                <div style={{color:C.dim,fontSize:10}}>Giocato {ticket.date} · dopo #{ticket.concorso||"?"} · Σ={sm(ticket.nums)}</div>
                {results.length>0?(<div style={{color:bestPts>=2?bestCol:C.dim,fontWeight:700,fontSize:12}}>{bestPts>=2?`🎯 ${PRIZE_LABELS[Math.min(bestPts,6)]} — max ${bestPts}✓`:`Nessun punto`}</div>):<div style={{color:C.dim,fontSize:11}}>⏳ In attesa</div>}
              </div>
              {bestPts>=2&&!pendingDel&&(<div style={{background:`${bestCol}22`,border:`2px solid ${bestCol}`,borderRadius:8,padding:"5px 10px",textAlign:"center"}}><div style={{color:bestCol,fontSize:20,fontWeight:900,fontFamily:"monospace"}}>{bestPts}</div><div style={{color:bestCol,fontSize:8}}>punti</div></div>)}
              <span style={{color:C.dim}}>{isOpen&&!pendingDel?"▲":"▼"}</span>
            </div>
            {pendingDel&&(<div style={{background:"#1a0606",borderTop:"1px solid #C94040",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><span style={{color:"#C94040",fontSize:12,fontWeight:700,flex:1}}>🗑 Confermi eliminazione?</span><button onClick={()=>remove(ticket.id)} style={{background:"#C94040",color:"#fff",border:"none",borderRadius:7,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Sì</button><button onClick={()=>setConfirmDel(null)} style={{background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>No</button></div>)}
            {isOpen&&!pendingDel&&(<div style={{borderTop:`1px solid ${C.border}`,padding:"12px 14px",background:"#06060e"}}>
              {results.length===0?<div style={{color:C.dim,fontSize:12,textAlign:"center"}}>⏳ Nessuna estrazione successiva.</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {results.map(r=>{const col=PRIZE_COLORS[Math.min(r.pts,6)]||C.dim;const hasPts=r.pts>0;return(<div key={r.n} style={{background:r.pts>=2?`${col}10`:hasPts?`${col}08`:"#07070f",border:`1px solid ${r.pts>=2?col:hasPts?col+"66":C.border}`,borderRadius:8,padding:"8px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6,marginBottom:6}}><span style={{color:C.dim,fontSize:11}}>Est. <strong style={{color:ACCENT}}>#{r.n}</strong> · {r.date?.substring(0,5)||""}</span><span style={{color:col,fontWeight:700,fontSize:12}}>{PRIZE_LABELS[Math.min(r.pts,6)]}</span></div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{r.nums.map(n=>{const hit=ticket.nums.includes(n);return(<div key={n} style={{position:"relative"}}><Ball num={n} color={hit?col:"#2a2a3a"} size={28} glow={hit&&r.pts>=2}/>{hit&&<div style={{position:"absolute",top:-3,right:-3,width:9,height:9,borderRadius:"50%",background:col,border:"1px solid #06060e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:6,color:"#000",fontWeight:900}}>✓</div>}</div>);})}</div>
                    {r.matches.length>0&&(<div style={{background:`${col}15`,borderRadius:5,padding:"4px 10px",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginTop:6}}><span style={{color:col,fontSize:10,fontWeight:700}}>✓ Indovinati:</span><div style={{display:"flex",gap:4}}>{r.matches.map(n=><span key={n} style={{background:`${col}33`,border:`1px solid ${col}`,borderRadius:4,padding:"1px 6px",color:col,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{n}</span>)}</div></div>)}
                  </div>);})}
                </div>
              )}
              <button onClick={()=>setConfirmDel(ticket.id)} style={{background:"transparent",color:"#C94040",border:"1px solid #C9404033",borderRadius:8,padding:"6px 14px",fontSize:11,cursor:"pointer",marginTop:12}}>🗑 Elimina</button>
            </div>)}
          </div>);
        })}
      </div>
      {tickets.length>0&&(<div style={{marginTop:14,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>persist([])} style={{background:"transparent",color:"#C94040",border:"1px solid #C9404033",borderRadius:8,padding:"7px 16px",fontSize:11,cursor:"pointer"}}>🗑 Cancella tutti</button><span style={{color:C.dim,fontSize:10}}>{tickets.length} bigliett{tickets.length===1?"o":"i"}</span></div>)}
    </div>
  );
}

const TABS=[
  {id:"animazione",icon:"📈",label:"Animazione"},
  {id:"segnali",icon:"🔬",label:"Segnali & Freq."},
  {id:"banda",icon:"📐",label:"Banda Adattiva"},
  {id:"generatore",icon:"🎯",label:"Generatore"},
  {id:"estrazioni",icon:"📥",label:"Estrazioni"},
  {id:"biglietti",icon:"🎫",label:"Biglietti"},
];

export default function App(){
  const [tab,setTab]=useState("animazione");
  const [dbDraws,setDbDraws]=useState([]);
  const [loading,setLoading]=useState(true);
  const [extraDraws,setExtraDraws]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_KEY_S)||"[]");}catch{return [];}});

  // Carica da Supabase
  useEffect(()=>{
    async function loadDraws(){
      try{
        const {data,error}=await supabase
          .from("superenalotto")
          .select("*")
          .order("data",{ascending:true});
        if(error) throw error;
        const mapped=data.map(r=>({
          n:r.id,
          date:r.data?r.data.substring(5).split("-").reverse().join("/"):"",
          nums:[r.n1,r.n2,r.n3,r.n4,r.n5,r.n6].filter(Boolean).sort((a,b)=>a-b),
          jolly:r.jolly||0,
          superstar:r.superstar||0,
        }));
        setDbDraws(mapped);
      }catch(err){
        console.error("Supabase error:",err);
        setDbDraws(DRAWS_BASE);
      }finally{
        setLoading(false);
      }
    }
    loadDraws();
  },[]);

  const allDraws=useMemo(()=>{
    const base=dbDraws.length>0?dbDraws:DRAWS_BASE;
    const extraNs=new Set(extraDraws.map(d=>d.n));
    return [...base.filter(d=>!extraNs.has(d.n)),...extraDraws].sort((a,b)=>a.n-b.n);
  },[dbDraws,extraDraws]);

  const handleUpdate=useCallback((list)=>{setExtraDraws(list);},[]);
  const last=allDraws[allDraws.length-1];
  const lastSum=last?sm(last.nums):0;

  if(loading) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{color:ACCENT,fontSize:28}}>🎱</div>
      <div style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:18}}>Caricamento dati storici...</div>
      <div style={{color:C.dim,fontSize:12}}>Connessione a Supabase</div>
    </div>
  );

  return(
    <DrawsContext.Provider value={allDraws}>
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Courier New',monospace",color:C.text,paddingBottom:60}}>
      <div style={{maxWidth:780,margin:"0 auto",padding:"0 12px"}}>
        <div style={{background:"linear-gradient(180deg,#0c0c1e 0%,transparent 100%)",padding:"16px 0 0",textAlign:"center",marginBottom:0}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{fontSize:26}}>🇮🇹</span>
            <h1 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:22,margin:0,textShadow:`0 0 30px ${ACCENT}44`}}>SuperEnalotto</h1>
            <span style={{background:`${ACCENT}22`,border:`1px solid ${ACCENT}44`,borderRadius:20,padding:"2px 10px",color:ACCENT,fontSize:10,fontWeight:700}}>DASHBOARD</span>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap",marginBottom:10,fontSize:11}}>
            <span style={{color:C.dim}}>Ultima: <strong style={{color:ACCENT}}>{last?.date?.substring(0,5)||""}</strong></span>
            <span style={{color:C.dim}}>Σ: <strong style={{color:lastSum>MU_TEO?C.orange:C.teal}}>{lastSum}</strong></span>
            <span style={{color:C.dim}}>Storico: <strong style={{color:ACCENT}}>{allDraws.length} est.</strong></span>
            <span style={{color:C.dim}}>Jackpot: <strong style={{color:C.purple}}>{JACKPOT}</strong></span>
          </div>
          {last&&(<div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:14,flexWrap:"wrap"}}>
            {last.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={32} glow/>)}
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:C.dim,fontSize:14}}>│</span>{last.jolly?<Ball num={last.jolly} color="#aaa" size={28}/>:null}<span style={{color:"#aaa",fontSize:9}}>J</span>{last.superstar?<Ball num={last.superstar} size={28} gold/>:null}<span style={{color:"#FFD700",fontSize:9}}>SS</span></div>
          </div>)}
        </div>
        <div style={{display:"flex",gap:2,marginBottom:16,overflowX:"auto",paddingBottom:4,borderBottom:`1px solid ${C.border}`}}>
          {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?`linear-gradient(135deg,${t.id==="biglietti"?C.purple:ACCENT},#2BA89A)`:"transparent",color:tab===t.id?"#fff":C.dim,border:tab===t.id?"none":`1px solid ${C.border}`,borderRadius:20,padding:"7px 10px",fontSize:10,fontWeight:tab===t.id?700:400,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{t.icon} {t.label}</button>))}
        </div>
        {tab==="animazione"&&<TabAnimazione/>}
        {tab==="segnali"&&<TabSegnali/>}
        {tab==="banda"&&<TabBanda/>}
        {tab==="generatore"&&<TabGeneratore/>}
        {tab==="estrazioni"&&<TabEstrazioni onUpdate={handleUpdate}/>}
        {tab==="biglietti"&&<TabBiglietti/>}
        <div style={{marginTop:24,background:"#070712",border:"1px solid #111122",borderRadius:10,padding:12}}>
          <div style={{color:"#353545",fontSize:10,lineHeight:1.7}}>⚠️ Strumento puramente statistico — nessun potere predittivo. Il gioco può causare dipendenza. Vietato ai minori di 18 anni. Dati storici: {allDraws.length} estrazioni (2024–2026).</div>
        </div>
      </div>
    </div>
    </DrawsContext.Provider>
  );
}
