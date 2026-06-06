import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import {
  ComposedChart, LineChart, BarChart, Line, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
  Area, Legend
} from "recharts";
import { supabase } from '../lib/supabase';

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
// ═══════════════════════════════════════════════════════════════
// MOTORE ANALITICO AVANZATO — da inserire dopo SSAffinitaPanel
// e prima di calcQualityScore
// ═══════════════════════════════════════════════════════════════

// ─── CATENE DI MARKOV ────────────────────────────────────────
function getMarkovState(nums) {
  const s = nums.reduce((a,b)=>a+b,0);
  const e = nums.filter(n=>n%2===0).length;
  const cat = s < 230 ? 'L' : s > 320 ? 'H' : 'M';
  const par = e >= 3 ? 'P' : 'D';
  return cat+par;
}

function computeMarkov(draws) {
  const states = ['LP','LD','MP','MD','HP','HD'];
  const trans = {};
  states.forEach(s=>{trans[s]={};states.forEach(t=>trans[s][t]=0);});
  for(let i=1;i<draws.length;i++){
    const from=getMarkovState(draws[i-1].nums);
    const to=getMarkovState(draws[i].nums);
    trans[from][to]++;
  }
  const prob = {};
  states.forEach(s=>{
    const tot=Object.values(trans[s]).reduce((a,b)=>a+b,0);
    prob[s]={};
    states.forEach(t=>prob[s][t]=tot>0?trans[s][t]/tot:0);
  });
  const lastState=getMarkovState(draws[draws.length-1].nums);
  const nextProbs=prob[lastState]||{};
  const bestNext=Object.entries(nextProbs).sort((a,b)=>(b[1])-(a[1]))[0];
  return {lastState,nextProbs,bestNext,states};
}

// ─── ANALISI CICLICA ─────────────────────────────────────────
function analyzeCycles(draws) {
  const N=draws.length;
  return Array.from({length:POOL},(_,i)=>{
    const num=i+1;
    const appearances=[];
    draws.forEach((d,idx)=>{if(d.nums.includes(num))appearances.push(idx);});
    if(appearances.length<2) return {num,cycle:N,phase:0,score:0,currentGap:N,lastApp:-1};
    const gaps=[];
    for(let j=1;j<appearances.length;j++) gaps.push(appearances[j]-appearances[j-1]);
    const avgGap=gaps.reduce((a,b)=>a+b,0)/gaps.length;
    const lastApp=appearances[appearances.length-1];
    const currentGap=N-1-lastApp;
    const phase=currentGap/avgGap;
    const score=Math.min(phase,3)/3;
    return {num,cycle:parseFloat(avgGap.toFixed(1)),phase:parseFloat(phase.toFixed(2)),score,currentGap,lastApp};
  });
}

// ─── K-MEANS CLUSTERING ──────────────────────────────────────
function getDrawFeatures(nums, muReale, sigmaReale) {
  const s=nums.reduce((a,b)=>a+b,0);
  const e=nums.filter(n=>n%2===0).length;
  const decades=[0,0,0,0,0,0,0,0,0];
  nums.forEach(n=>decades[Math.floor((n-1)/10)]++);
  const maxDec=Math.max(...decades);
  const gaps=[];
  for(let i=1;i<nums.length;i++) gaps.push(nums[i]-nums[i-1]);
  const avgGap=gaps.reduce((a,b)=>a+b,0)/gaps.length;
  return [
    (s-muReale)/Math.max(sigmaReale,1),
    (e-3)/3,
    maxDec/PICK,
    (avgGap-15)/15
  ];
}

function kmeansCluster(features, k=4, iterations=15) {
  let centroids=features.slice(0,k).map(d=>[...d]);
  let assignments=new Array(features.length).fill(0);
  for(let iter=0;iter<iterations;iter++){
    features.forEach((point,i)=>{
      let minDist=Infinity,best=0;
      centroids.forEach((c,j)=>{
        const dist=point.reduce((sum,v,ki)=>sum+(v-c[ki])**2,0);
        if(dist<minDist){minDist=dist;best=j;}
      });
      assignments[i]=best;
    });
    centroids=Array.from({length:k},(_,ci)=>{
      const pts=features.filter((_,i)=>assignments[i]===ci);
      if(pts.length===0) return centroids[ci];
      return pts[0].map((_,j)=>pts.reduce((sum,p)=>sum+p[j],0)/pts.length);
    });
  }
  return {assignments,centroids};
}

function computeClusters(draws, muReale, sigmaReale) {
  const features=draws.map(d=>getDrawFeatures(d.nums,muReale,sigmaReale));
  const {assignments,centroids}=kmeansCluster(features,4);
  const recent=assignments.slice(-30);
  const counts=[0,0,0,0];
  recent.forEach(c=>counts[c]++);
  const dominant=counts.indexOf(Math.max(...counts));
  const dc=centroids[dominant];
  return {
    assignments,centroids,dominant,counts,
    domInfo:{
      sumBias:(dc[0]*sigmaReale+muReale).toFixed(0),
      evensBias:(dc[1]*3+3).toFixed(1),
      gapBias:(dc[3]*15+15).toFixed(1),
    }
  };
}

// ─── ENTROPIA LOCALE ─────────────────────────────────────────
function localEntropy(window) {
  const freq=new Array(POOL+1).fill(0);
  window.forEach(d=>d.nums.forEach((n)=>freq[n]++));
  const total=window.length*PICK;
  let H=0;
  for(let i=1;i<=POOL;i++){
    const p=freq[i]/total;
    if(p>0) H-=p*Math.log2(p);
  }
  return H/Math.log2(POOL);
}

function computeEntropyTimeline(draws, windowSize=50) {
  const timeline=[];
  for(let i=windowSize;i<=draws.length;i++){
    timeline.push({
      idx:i,
      entropy:localEntropy(draws.slice(i-windowSize,i)),
      date:draws[i-1]?.date?.substring(0,5)||""
    });
  }
  const vals=timeline.map(t=>t.entropy);
  const avgE=vals.reduce((a,b)=>a+b,0)/vals.length;
  const current=vals[vals.length-1]||0;
  return {timeline,avgEntropy:avgE,currentEntropy:current,isChaotic:current>avgE};
}

// ─── SCORE BAYESIANO ─────────────────────────────────────────
function bayesianScore(num, draws, windowSize=150) {
  const recent=draws.slice(-windowSize);
  const freq=recent.filter(d=>d.nums.includes(num)).length;
  const alpha=freq+1;
  const beta=windowSize-freq+1;
  const posteriorMean=alpha/(alpha+beta);
  const expectedProb=PICK/POOL;
  return Math.max(0,expectedProb-posteriorMean);
}

// ─── SCORE UNIFICATO AVANZATO ────────────────────────────────
function computeAdvancedScores(draws, muReale, sigmaReale) {
  const N=draws.length;
  const cycles=analyzeCycles(draws);
  const clusterData=computeClusters(draws,muReale,sigmaReale);
  const dominant=clusterData.dominant;

  return Array.from({length:POOL},(_,i)=>{
    const num=i+1;
    const cyc=cycles[i];

    // 1. Score ciclico (30%)
    const cycleScore=cyc.score;

    // 2. Score bayesiano (25%)
    const bayes=bayesianScore(num,draws);
    const bayesScore=Math.min(bayes*20,1);

    // 3. Score ritardo (25%)
    let rit=N;
    for(let j=N-1;j>=0;j--) if(draws[j].nums.includes(num)){rit=N-1-j;break;}
    const ritScore=Math.min(rit/N,1);

    // 4. Score frequenza deficit (20%)
    const freq=draws.filter(d=>d.nums.includes(num)).length;
    const expected=N*PICK/POOL;
    const freqScore=Math.max(0,(expected-freq)/Math.max(expected,1));

    const unified=cycleScore*0.30+bayesScore*0.25+ritScore*0.25+freqScore*0.20;

    return {
      num,
      unified:parseFloat((unified*100).toFixed(1)),
      cycleScore:parseFloat((cycleScore*100).toFixed(1)),
      bayesScore:parseFloat((bayesScore*100).toFixed(1)),
      ritScore:parseFloat((ritScore*100).toFixed(1)),
      freqScore:parseFloat((freqScore*100).toFixed(1)),
      rit,freq,
      cycle:cyc.cycle,
      phase:cyc.phase,
    };
  }).sort((a,b)=>b.unified-a.unified);
}

// ─── AGGIORNA calcQualityScore con score avanzato ─────────────
 function calcQualityScoreAdvanced(nums, allDraws, freq, sigmaReale, muReale, advScores) {
  const s=nums.reduce((a,b)=>a+b,0);
  const zS=Math.abs((s-muReale)/Math.max(sigmaReale,1));

  // 1. Score somma (25pt)
  const sumScore=Math.max(0,25-zS*8);

  // 2. Score avanzato medio dei numeri (50pt)
  const advMean=nums.reduce((acc,n)=>{
    const a=advScores.find(x=>x.num===n);
    return acc+(a?a.unified:0);
  },0)/nums.length;
  const advScore=(advMean/100)*50;

  // 3. Score anomaly bassa (15pt)
  const expected=allDraws.length*PICK/POOL;
  const anomaly=nums.reduce((acc,n)=>acc+Math.abs(freq[n]-expected)/Math.max(expected,1),0)/nums.length;
  const anomScore=Math.max(0,15-anomaly*15);

  // 4. Score pari/dispari (10pt)
  const evens=nums.filter(n=>n%2===0).length;
  const pdScore=evens>=2&&evens<=4?10:5;

  return Math.round(sumScore+advScore+anomScore+pdScore);
}

// ─── TAB ANALISI AVANZATA ────────────────────────────────────
function TabAnalisiAvanzata() {
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);
  const [computed,setComputed]=useState(null);
  const [loading,setLoading]=useState(false);

  const esegui=()=>{
    setLoading(true);
    setTimeout(()=>{
      const markov=computeMarkov(allDraws);
      const cycles=analyzeCycles(allDraws);
      const clusters=computeClusters(allDraws,muReale,sigmaReale);
      const entropyData=computeEntropyTimeline(allDraws);
      const advScores=computeAdvancedScores(allDraws,muReale,sigmaReale);
      setComputed({markov,cycles,clusters,entropyData,advScores});
      setLoading(false);
    },100);
  };

  const stateLabels={
    LP:"Σ Bassa+Pari",LD:"Σ Bassa+Disp",
    MP:"Σ Media+Pari",MD:"Σ Media+Disp",
    HP:"Σ Alta+Pari",HD:"Σ Alta+Disp"
  };
  const stateColors={
    LP:C.teal,LD:C.blue,MP:ACCENT,MD:C.orange,HP:C.red,HD:C.purple
  };

  return (
    <div>
      <h2 style={{color:"#22d3ee",fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>🧬 Analisi Avanzata</h2>
      <div style={{background:"#001a1a",border:"1px solid #22d3ee33",borderRadius:10,padding:12,marginBottom:14,fontSize:10,color:"#22d3ee99",lineHeight:1.7}}>
        Motore multi-modello: Catene di Markov · Analisi Ciclica · K-Means Clustering · Entropia Locale · Score Bayesiano.
        I risultati alimentano automaticamente il tab 🔮 Suggeritore con uno score unificato più potente.
      </div>

      <button onClick={esegui} disabled={loading} style={{width:"100%",padding:"13px",background:loading?"#001a1a":"linear-gradient(135deg,#22d3ee,#0891b2)",color:loading?"#555":"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:loading?"not-allowed":"pointer",fontFamily:"Georgia,serif",marginBottom:16}}>
        {loading?"⏳ Elaborazione in corso...":"🧬 Esegui Analisi Completa"}
      </button>

      {computed&&(<>

        {/* MARKOV */}
        <div style={{background:C.card,border:"1px solid #22d3ee33",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:"#22d3ee",fontWeight:700,fontSize:13,marginBottom:10}}>① Catene di Markov — Stato Sistema</div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
            <div style={{background:"#001a2a",border:"1px solid #22d3ee44",borderRadius:8,padding:"8px 14px",textAlign:"center"}}>
              <div style={{color:C.dim,fontSize:9,marginBottom:2}}>STATO ATTUALE</div>
              <div style={{color:"#22d3ee",fontFamily:"monospace",fontSize:18,fontWeight:900}}>{computed.markov.lastState}</div>
              <div style={{color:C.dim,fontSize:9}}>{stateLabels[computed.markov.lastState]||""}</div>
            </div>
            <div style={{color:C.dim,fontSize:18}}>→</div>
            <div style={{background:"#001a2a",border:"1px solid #22d3ee44",borderRadius:8,padding:"8px 14px",textAlign:"center"}}>
              <div style={{color:C.dim,fontSize:9,marginBottom:2}}>STATO PIÙ PROBABILE</div>
              <div style={{color:"#FFD700",fontFamily:"monospace",fontSize:18,fontWeight:900}}>{computed.markov.bestNext?.[0]||"—"}</div>
              <div style={{color:"#FFD700",fontSize:10,fontWeight:700}}>{computed.markov.bestNext?((computed.markov.bestNext[1])*100).toFixed(0):0}% prob.</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {computed.markov.states.map((s)=>{
              const p=computed.markov.nextProbs[s]||0;
              const col=stateColors[s]||C.dim;
              const isBest=s===computed.markov.bestNext?.[0];
              return(
                <div key={s} style={{background:isBest?"#FFD70011":"#080816",border:`1px solid ${isBest?"#FFD700":col}33`,borderRadius:7,padding:"6px 8px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                    <span style={{color:col,fontSize:10,fontWeight:700}}>{s}</span>
                    <span style={{color:isBest?"#FFD700":C.dim,fontSize:10,fontFamily:"monospace"}}>{((p)*100).toFixed(0)}%</span>
                  </div>
                  <div style={{background:"#0a0a18",borderRadius:3,height:4,overflow:"hidden"}}>
                    <div style={{background:isBest?"#FFD700":col,height:"100%",width:`${(p)*100}%`}}/>
                  </div>
                  <div style={{color:C.dim,fontSize:8,marginTop:2}}>{stateLabels[s]||""}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CICLI */}
        <div style={{background:C.card,border:"1px solid #22d3ee33",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:"#22d3ee",fontWeight:700,fontSize:13,marginBottom:10}}>② Analisi Ciclica — Top 10 numeri "in fase"</div>
          <div style={{color:C.dim,fontSize:10,marginBottom:10}}>Numeri che superano il loro ciclo medio storico (fase {'>'} 1.5x = molto in ritardo rispetto al proprio pattern)</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {computed.cycles.slice(0,10).map((c,i)=>{
              const pct=Math.min(c.phase/3*100,100);
              const col=c.phase>2?C.red:c.phase>1.5?C.orange:C.teal;
              return(
                <div key={c.num} style={{display:"flex",alignItems:"center",gap:8}}>
                  <Ball num={c.num} color={col} size={28} glow={c.phase>2}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <span style={{color:C.dim,fontSize:9}}>ciclo:{c.cycle} · gap attuale:{c.currentGap}</span>
                      <span style={{color:col,fontSize:10,fontWeight:700}}>{c.phase}x ciclo</span>
                    </div>
                    <div style={{background:"#0a0a18",borderRadius:3,height:5,overflow:"hidden"}}>
                      <div style={{background:col,height:"100%",width:`${pct}%`}}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CLUSTERING */}
        <div style={{background:C.card,border:"1px solid #22d3ee33",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:"#22d3ee",fontWeight:700,fontSize:13,marginBottom:10}}>③ K-Means Clustering — Pattern dominante (ultime 30 est.)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
            {computed.clusters.counts.map((cnt,i)=>{
              const isDom=i===computed.clusters.dominant;
              const DC=["#E8B84B","#F07030","#C94040","#8A5CC4"];
              return(
                <div key={i} style={{background:isDom?`${DC[i]}22`:"#080816",border:`2px solid ${isDom?DC[i]:C.border}`,borderRadius:8,padding:"8px",textAlign:"center"}}>
                  <div style={{color:DC[i],fontSize:9,fontWeight:700,marginBottom:2}}>Cluster {i}</div>
                  <div style={{color:isDom?DC[i]:C.dim,fontSize:16,fontWeight:900,fontFamily:"monospace"}}>{cnt}</div>
                  <div style={{color:C.dim,fontSize:8}}>est.recenti</div>
                  {isDom&&<div style={{color:DC[i],fontSize:8,marginTop:3,fontWeight:700}}>▲ DOMINANTE</div>}
                </div>
              );
            })}
          </div>
          <div style={{background:"#080816",border:`1px solid ${ACCENT}33`,borderRadius:8,padding:10}}>
            <div style={{color:ACCENT,fontSize:10,fontWeight:700,marginBottom:6}}>Caratteristiche cluster dominante:</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <span style={{color:C.dim,fontSize:10}}>Σ tendenza: <strong style={{color:ACCENT}}>{computed.clusters.domInfo.sumBias}</strong></span>
              <span style={{color:C.dim,fontSize:10}}>Pari medi: <strong style={{color:ACCENT}}>{computed.clusters.domInfo.evensBias}</strong></span>
              <span style={{color:C.dim,fontSize:10}}>Gap medio: <strong style={{color:ACCENT}}>{computed.clusters.domInfo.gapBias}</strong></span>
            </div>
          </div>
        </div>

        {/* ENTROPIA */}
        <div style={{background:C.card,border:"1px solid #22d3ee33",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:"#22d3ee",fontWeight:700,fontSize:13,marginBottom:10}}>④ Entropia Locale — Fase del sistema</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
            <div style={{background:"#080816",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{color:C.dim,fontSize:9,marginBottom:2}}>ENTROPIA ATTUALE</div>
              <div style={{color:"#22d3ee",fontFamily:"monospace",fontSize:16,fontWeight:900}}>{(computed.entropyData.currentEntropy*100).toFixed(2)}%</div>
            </div>
            <div style={{background:"#080816",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{color:C.dim,fontSize:9,marginBottom:2}}>MEDIA STORICA</div>
              <div style={{color:ACCENT,fontFamily:"monospace",fontSize:16,fontWeight:900}}>{(computed.entropyData.avgEntropy*100).toFixed(2)}%</div>
            </div>
            <div style={{background:computed.entropyData.isChaotic?"#1a0a00":"#001a0a",borderRadius:8,padding:10,textAlign:"center",border:`1px solid ${computed.entropyData.isChaotic?C.orange:C.green}44`}}>
              <div style={{color:C.dim,fontSize:9,marginBottom:2}}>FASE</div>
              <div style={{color:computed.entropyData.isChaotic?C.orange:C.green,fontFamily:"monospace",fontSize:11,fontWeight:900}}>
                {computed.entropyData.isChaotic?"CAOTICA":"ORDINATA"}
              </div>
              <div style={{color:C.dim,fontSize:8}}>{computed.entropyData.isChaotic?"alta variabilità":"pattern stabili"}</div>
            </div>
          </div>
          {/* Mini grafico entropia */}
          <div style={{background:"#080816",borderRadius:6,padding:8}}>
            <div style={{color:C.dim,fontSize:9,marginBottom:4}}>Andamento entropia (ultime 100 finestre):</div>
            <svg width="100%" height="50" viewBox="0 0 400 50" preserveAspectRatio="none">
              {(()=>{
                const data=computed.entropyData.timeline.slice(-100);
                if(data.length<2) return null;
                const vals=data.map((d)=>d.entropy);
                const min=Math.min(...vals)-0.005;
                const max=Math.max(...vals)+0.005;
                const pts=data.map((d,i)=>{
                  const x=(i/(data.length-1))*400;
                  const y=50-((d.entropy-min)/(max-min))*50;
                  return `${x},${y}`;
                }).join(" ");
                const avgY=50-((computed.entropyData.avgEntropy-min)/(max-min))*50;
                return(<>
                  <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="1.5"/>
                  <line x1="0" y1={avgY} x2="400" y2={avgY} stroke={`${ACCENT}88`} strokeDasharray="4,3" strokeWidth="1"/>
                </>);
              })()}
            </svg>
          </div>
        </div>

        {/* SCORE AVANZATO TOP 20 */}
        <div style={{background:C.card,border:"1px solid #22d3ee33",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:"#22d3ee",fontWeight:700,fontSize:13,marginBottom:6}}>⑤ Score Unificato Avanzato — Top 20 numeri</div>
          <div style={{color:C.dim,fontSize:9,marginBottom:10}}>
            Ciclo 30% · Bayesiano 25% · Ritardo 25% · Freq.deficit 20%
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:6}}>
            {computed.advScores.slice(0,20).map((s,i)=>{
              const col=i<5?"#FFD700":i<10?C.orange:C.teal;
              return(
                <div key={s.num} style={{background:"#080816",border:`1px solid ${col}33`,borderRadius:8,padding:"8px 10px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                    <Ball num={s.num} color={col} size={28} glow={i<5}/>
                    <div>
                      <div style={{color:col,fontFamily:"monospace",fontSize:13,fontWeight:900}}>{s.unified}</div>
                      <div style={{color:C.dim,fontSize:8}}>score</div>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:2}}>
                    {[
                      {l:"ciclo",v:s.cycleScore,c:"#22d3ee"},
                      {l:"bayes",v:s.bayesScore,c:C.purple},
                      {l:"ritardo",v:s.ritScore,c:C.teal},
                      {l:"freq",v:s.freqScore,c:C.orange},
                    ].map(row=>(
                      <div key={row.l} style={{display:"flex",gap:4,alignItems:"center"}}>
                        <span style={{color:C.dim,fontSize:7,width:30}}>{row.l}</span>
                        <div style={{flex:1,background:"#0a0a18",borderRadius:2,height:3,overflow:"hidden"}}>
                          <div style={{background:row.c,height:"100%",width:`${Math.min(row.v,100)}%`}}/>
                        </div>
                        <span style={{color:row.c,fontSize:7,fontFamily:"monospace",width:20,textAlign:"right"}}>{row.v.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{color:C.dim,fontSize:7,marginTop:4}}>rit:{s.rit} · freq:{s.freq}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{background:"#001a1a",border:"1px solid #22d3ee22",borderRadius:8,padding:10,fontSize:9,color:"#22d3ee66",lineHeight:1.8}}>
          Il tab 🔮 Suggeritore ora utilizza automaticamente questo score unificato per generare sestine più ottimizzate.
          Riesegui l'analisi dopo ogni nuova estrazione per aggiornare i modelli.
        </div>

      </>)}
    </div>
  );
}
// ─── CALCOLO SCORE QUALITÀ ────────────────────────────────────────────────────
function calcQualityScore(nums, allDraws, freq, sigmaReale, muReale){
  const s = sm(nums);
  const zS = Math.abs(zOf(s, muReale, sigmaReale));
  const sumScore = Math.max(0, 30 - zS * 10);
  const ritMedio = nums.reduce((acc,n)=>{
    let r=allDraws.length;
    for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].nums.includes(n)){r=allDraws.length-1-i;break;}}
    return acc+r;
  },0)/nums.length;
  const ritScore = Math.min(40, (ritMedio/allDraws.length)*80);
  const expected = allDraws.length*PICK/POOL;
  const anomaly = nums.reduce((acc,n)=>acc+Math.abs(freq[n]-expected)/expected,0)/nums.length;
  const anomScore = Math.max(0, 20 - anomaly*20);
  const evens = nums.filter(n=>n%2===0).length;
  const pdScore = evens>=2&&evens<=4 ? 10 : 5;
  return Math.round(sumScore+ritScore+anomScore+pdScore);
}

function qualityStars(score){
  if(score>=80) return "⭐⭐⭐⭐⭐";
  if(score>=65) return "⭐⭐⭐⭐";
  if(score>=50) return "⭐⭐⭐";
  if(score>=35) return "⭐⭐";
  return "⭐";
}

function qualityLabel(score){
  if(score>=80) return {l:"ECCELLENTE",c:"#FFD700"};
  if(score>=65) return {l:"OTTIMA",c:"#4A9E5C"};
  if(score>=50) return {l:"BUONA",c:"#2BA89A"};
  if(score>=35) return {l:"DISCRETA",c:"#F07030"};
  return {l:"BASSA",c:"#C94040"};
}

function TabSuggeritore(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums), sigmaReale=std(sums);

  const [winSize,setWinSize]=useState(allDraws.length);
  const [kBand,setKBand]=useState(1.0);
  const [ratioMode,setRatioMode]=useState("auto");
  const [pesoRitardo,setPesoRitardo]=useState(50);
  const [qty,setQty]=useState(5);
  const [results,setResults]=useState(()=>{try{const s=sessionStorage.getItem("se_sugg_results");return s?JSON.parse(s):[];}catch{return [];}});
  const [loading,setLoading]=useState(false);
  const [selSS,setSelSS]=useState(()=>{try{const s=sessionStorage.getItem("se_sugg_selss");return s?JSON.parse(s):{};}catch{return {};}});
  const [savedIds,setSavedIds]=useState(new Set());

  const winDraws=useMemo(()=>allDraws.slice(-Math.min(winSize,allDraws.length)),[allDraws,winSize]);

  const freq=useMemo(()=>{
    const f=Array(POOL+1).fill(0);
    winDraws.forEach(d=>d.nums.forEach(n=>f[n]++));
    return f;
  },[winDraws]);

  function getRitardo(num){
    for(let i=allDraws.length-1;i>=0;i--){
      if(allDraws[i].nums.includes(num)) return allDraws.length-1-i;
    }
    return allDraws.length;
  }

  const scored=useMemo(()=>{
    const totalOcc=winDraws.length*PICK;
    const expected=totalOcc/POOL;
    const pw=pesoRitardo/100;
    return Array.from({length:POOL},(_,i)=>{
      const num=i+1;
      const f=freq[num];
      const rit=getRitardo(num);
      const freqScore=(expected-f)/Math.max(expected,1);
      const ritScore=rit/allDraws.length;
      return {num,f,rit,score:freqScore*(1-pw)+ritScore*pw};
    }).sort((a,b)=>b.score-a.score);
  },[freq,winDraws,allDraws,pesoRitardo]);

  const bestRatio=useMemo(()=>{
    const counts={};
    allDraws.forEach(d=>{
      const e=d.nums.filter(n=>n%2===0).length;
      const key=`${e}-${PICK-e}`;
      counts[key]=(counts[key]||0)+1;
    });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"3-3";
  },[allDraws]);

  const targetEvens=useMemo(()=>{
    if(ratioMode==="auto") return parseInt(bestRatio.split("-")[0]);
    return parseInt(ratioMode.split("-")[0]);
  },[ratioMode,bestRatio]);

  const loB=Math.round(muReale-kBand*sigmaReale);
  const hiB=Math.round(muReale+kBand*sigmaReale);

  const genera=()=>{
    setLoading(true);setResults([]);setSelSS({});setSavedIds(new Set());
    setTimeout(()=>{
      const rng=mkRng(Date.now());
      const found=[];
      const maxAttempts=3000000;
      let sc=0;
      const pool=scored.map(s=>s.num);
      const weights=scored.map(s=>Math.max(0.05,s.score+1));
      const totalW=weights.reduce((a,b)=>a+b,0);
      const cumW=[];
      let acc=0;
      weights.forEach(w=>{acc+=w;cumW.push(acc/totalW);});
      function pickWeighted(){
        const r=rng();
        for(let i=0;i<cumW.length;i++) if(r<=cumW[i]) return pool[i];
        return pool[pool.length-1];
      }
      while(found.length<qty&&sc<maxAttempts){
        sc++;
        const nums=new Set();
        let attempts=0;
        while(nums.size<PICK&&attempts<200){nums.add(pickWeighted());attempts++;}
        if(nums.size<PICK) continue;
        const arr=[...nums].sort((a,b)=>a-b);
        const s=sm(arr);
        if(s<loB||s>hiB) continue;
        const evens=arr.filter(n=>n%2===0).length;
        if(Math.abs(evens-targetEvens)>1) continue;
        const key=arr.join(",");
        if(found.some(f=>f.nums.join(",")===key)) continue;
        const anomaly=arr.reduce((a,n)=>{
          const exp=winDraws.length*PICK/POOL;
          return a+Math.abs(freq[n]-exp)/Math.max(exp,1);
        },0)/PICK;
        const ritMedio=arr.reduce((a,n)=>a+getRitardo(n),0)/PICK;
        const advScoresLocal=computeAdvancedScores(allDraws,muReale,sigmaReale);
        const quality=calcQualityScoreAdvanced(arr,allDraws,freq,sigmaReale,muReale,advScoresLocal);
        const ssSugg=getSSSuggestions(allDraws,s,sigmaReale);
        const topSS=ssSugg[0]?.num||null;
        found.push({nums:arr,sum:s,evens,odds:PICK-evens,anomaly,ritMedio,zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2),quality,topSS});
      }
      found.sort((a,b)=>b.quality-a.quality);
      try{sessionStorage.setItem("se_sugg_results",JSON.stringify(found));}catch{}
      setResults(found);setLoading(false);
    },50);
  };

  const salvaBiglietto=(r,idx)=>{
    const ss=selSS[idx]||r.topSS;
    const ticket={
      id:Date.now()+idx,nums:r.nums,superstar:ss,
      date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),
      concorso:allDraws[allDraws.length-1]?.n||0,
      strategy:"suggeritore",sum:r.sum,score:r.quality||0,
    };
    const prev=JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");
    localStorage.setItem(LS_TICKETS_S,JSON.stringify([...prev,ticket]));
    setSavedIds(prev=>new Set([...prev,idx]));
    alert(`✅ Salvata in Biglietti!\n${r.nums.join("-")} | SS:${ss||"—"}`);
  };

  const pariDisp=allDraws.slice(-20).map(d=>d.nums.filter(n=>n%2===0).length);
  const avgPD=(pariDisp.reduce((a,b)=>a+b,0)/pariDisp.length).toFixed(1);
  const ratioOpts=["auto","3-3","4-2","2-4","5-1","1-5"];

  return(
    <div>
      <h2 style={{color:"#a78bfa",fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🔮 Suggeritore Scientifico</h2>
      <div style={{background:"#0a081a",border:"1px solid #a78bfa33",borderRadius:12,padding:14,marginBottom:16}}>
        <div style={{color:"#a78bfa",fontWeight:700,fontSize:11,marginBottom:12,letterSpacing:1,textTransform:"uppercase"}}>⚙️ Parametri</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Finestra analisi</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {[50,100,200,allDraws.length].map(w=>{
                const lbl=w===allDraws.length?"Tutte":w;
                const act=winSize===Math.min(w,allDraws.length);
                return(<button key={w} onClick={()=>setWinSize(Math.min(w,allDraws.length))} style={{background:act?"#a78bfa22":"transparent",color:act?"#a78bfa":C.dim,border:`1px solid ${act?"#a78bfa":C.border}`,borderRadius:8,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>);
              })}
            </div>
          </div>
          <div>
            <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Banda somma [{loB}–{hiB}]</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {[0.5,1.0,1.5,2.0].map(k=>{
                const act=kBand===k;
                return(<button key={k} onClick={()=>setKBand(k)} style={{background:act?"#a78bfa22":"transparent",color:act?"#a78bfa":C.dim,border:`1px solid ${act?"#a78bfa":C.border}`,borderRadius:8,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>±{k}σ</button>);
              })}
            </div>
          </div>
          <div>
            <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Pari/Dispari (storico: {bestRatio})</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {ratioOpts.map(r=>{
                const act=ratioMode===r;
                return(<button key={r} onClick={()=>setRatioMode(r)} style={{background:act?"#a78bfa22":"transparent",color:act?"#a78bfa":C.dim,border:`1px solid ${act?"#a78bfa":C.border}`,borderRadius:8,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{r==="auto"?`Auto(${bestRatio})`:r}</button>);
              })}
            </div>
          </div>
          <div>
            <div style={{color:C.dim,fontSize:10,marginBottom:6}}>
              Peso: <span style={{color:C.teal}}>Rit.{pesoRitardo}%</span> · <span style={{color:C.orange}}>Freq.{100-pesoRitardo}%</span>
            </div>
            <input type="range" min={0} max={100} step={10} value={pesoRitardo} onChange={e=>setPesoRitardo(+e.target.value)} style={{width:"100%",accentColor:"#a78bfa",cursor:"pointer"}}/>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:16}}>
        <div style={{background:"#0e0a1c",border:"1px solid #a78bfa33",borderRadius:10,padding:10}}>
          <div style={{color:"#a78bfa",fontSize:9,fontWeight:700,marginBottom:3}}>RANGE SOMMA</div>
          <div style={{color:"#fff",fontFamily:"monospace",fontSize:13,fontWeight:900}}>{loB}–{hiB}</div>
          <div style={{color:C.dim,fontSize:9}}>μ={muReale.toFixed(0)} σ={sigmaReale.toFixed(0)}</div>
        </div>
        <div style={{background:"#0e0a1c",border:"1px solid #a78bfa33",borderRadius:10,padding:10}}>
          <div style={{color:"#a78bfa",fontSize:9,fontWeight:700,marginBottom:3}}>PARI/DISPARI</div>
          <div style={{color:"#fff",fontFamily:"monospace",fontSize:13,fontWeight:900}}>{ratioMode==="auto"?bestRatio:ratioMode}</div>
          <div style={{color:C.dim,fontSize:9}}>ult.20: {avgPD}P</div>
        </div>
        <div style={{background:"#0e0a1c",border:"1px solid #a78bfa33",borderRadius:10,padding:10}}>
          <div style={{color:"#a78bfa",fontSize:9,fontWeight:700,marginBottom:3}}>TOP RITARDATARI</div>
          <div style={{color:C.teal,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{scored.slice(0,3).map(s=>s.num).join(" · ")}</div>
          <div style={{color:C.dim,fontSize:9}}>win:{winSize===allDraws.length?"∞":winSize}</div>
        </div>
        <div style={{background:"#0e0a1c",border:"1px solid #a78bfa33",borderRadius:10,padding:10}}>
          <div style={{color:"#a78bfa",fontSize:9,fontWeight:700,marginBottom:3}}>ESTRAZIONI</div>
          <div style={{color:"#fff",fontFamily:"monospace",fontSize:13,fontWeight:900}}>{allDraws.length}</div>
          <div style={{color:C.dim,fontSize:9}}>Supabase</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <span style={{color:C.dim,fontSize:11}}>Combinazioni:</span>
        {[1,3,5,10,15,20].map(n=>(
          <button key={n} onClick={()=>setQty(n)} style={{background:qty===n?"#a78bfa22":"transparent",color:qty===n?"#a78bfa":C.dim,border:`1px solid ${qty===n?"#a78bfa":C.border}`,borderRadius:14,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>
        ))}
      </div>
      <button onClick={genera} disabled={loading} style={{width:"100%",padding:"13px",background:loading?"#1a1a2e":"linear-gradient(135deg,#a78bfa,#6366f1)",color:loading?"#555":"#fff",border:"none",borderRadius:10,fontSize:16,fontWeight:900,cursor:loading?"not-allowed":"pointer",fontFamily:"Georgia,serif",marginBottom:16}}>
        {loading?"⏳ Generazione in corso...":"🔮 Genera Suggerimenti"}
      </button>
      {results.length>0&&(
        <>
          <div style={{color:C.dim,fontSize:11,marginBottom:12}}>
            Ordinate per <strong style={{color:"#FFD700"}}>score qualità</strong> · banda [{loB}–{hiB}] · P/D ±1 da {ratioMode==="auto"?bestRatio:ratioMode}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {results.map((r,i)=>{
              const ql=qualityLabel(r.quality);
              const stars=qualityStars(r.quality);
              const ssSugg=getSSSuggestions(allDraws,r.sum,sigmaReale);
              const top3SS=ssSugg.slice(0,3);
              const chosenSS=selSS[i]||r.topSS;
              const isSaved=savedIds.has(i);
              const isBest=i===0;
              return(
                <div key={i} style={{background:"#080816",border:`2px solid ${isBest?"#FFD70055":"#a78bfa22"}`,borderLeft:`4px solid ${ql.c}`,borderRadius:12,padding:"14px",position:"relative"}}>
                  {isBest&&<div style={{position:"absolute",top:-10,left:14,background:"#FFD700",color:"#000",fontSize:9,fontWeight:900,padding:"2px 10px",borderRadius:10,letterSpacing:1}}>🏆 MIGLIORE</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:"#a78bfa",fontFamily:"monospace",fontSize:11}}>#{i+1}</span>
                      <span style={{color:ql.c,fontWeight:900,fontSize:13}}>{stars}</span>
                      <span style={{background:`${ql.c}22`,color:ql.c,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{ql.l} {r.quality}/100</span>
                    </div>
                    <div style={{background:"#0a0a18",borderRadius:6,height:6,width:80,overflow:"hidden"}}>
                      <div style={{background:`linear-gradient(90deg,${ql.c},#a78bfa)`,height:"100%",width:`${r.quality}%`}}/>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
                    {r.nums.map(n=>{
                      const rank=scored.findIndex(x=>x.num===n);
                      const col=rank<15?C.teal:rank<40?ACCENT:C.orange;
                      return <Ball key={n} num={n} color={col} size={38} glow={rank<10}/>;
                    })}
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                    <span style={{background:"#a78bfa22",color:"#a78bfa",borderRadius:5,padding:"2px 8px",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Σ {r.sum}</span>
                    <span style={{background:"#12122a",color:C.dim,borderRadius:5,padding:"2px 8px",fontSize:10}}>{r.evens}P–{r.odds}D</span>
                    <span style={{background:"#12122a",color:Math.abs(parseFloat(r.zScore))<1?C.green:C.orange,borderRadius:5,padding:"2px 8px",fontSize:10}}>z={r.zScore}</span>
                    <span style={{background:`${C.teal}22`,color:C.teal,borderRadius:5,padding:"2px 8px",fontSize:10}}>rit.medio {r.ritMedio.toFixed(0)}</span>
                    <span style={{background:"#12122a",color:C.dim,borderRadius:5,padding:"2px 8px",fontSize:10}}>anomaly {r.anomaly.toFixed(2)}</span>
                  </div>
                  <div style={{background:"#0a0810",border:"1px solid #FFD70022",borderRadius:10,padding:10,marginBottom:10}}>
                    <div style={{color:"#FFD700",fontSize:10,fontWeight:700,marginBottom:8}}>⭐ SuperStar consigliato — clicca per scegliere</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                      {top3SS.map((s,si)=>{
                        const isCho=chosenSS===s.num;
                        return(
                          <div key={s.num} onClick={()=>setSelSS(prev=>({...prev,[i]:s.num}))} style={{textAlign:"center",cursor:"pointer",padding:"6px 8px",background:isCho?"#FFD70018":"#0e0e1c",border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,borderRadius:8,boxShadow:isCho?"0 0 10px #FFD70044":"none"}}>
                            <Ball num={s.num} size={30} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho}/>
                            <div style={{color:isCho?"#FFD700":si===0?"#E8B84B":"#888",fontSize:9,marginTop:3,fontWeight:700}}>{s.pct}%</div>
                            <div style={{color:C.dim,fontSize:8}}>r.{s.ritardo}</div>
                          </div>
                        );
                      })}
                      <div style={{display:"flex",alignItems:"center",paddingLeft:8,borderLeft:"1px solid #222",gap:6}}>
                        <Ball num={chosenSS||"?"} size={32} gold={!!chosenSS} color={chosenSS?"#FFD700":"#444"} glow={!!chosenSS}/>
                        <span style={{color:"#FFD700",fontFamily:"monospace",fontWeight:700,fontSize:14}}>{chosenSS||"—"}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={()=>salvaBiglietto(r,i)} disabled={isSaved} style={{width:"100%",padding:"10px",background:isSaved?`${C.green}22`:`linear-gradient(135deg,${C.purple},#a78bfa)`,color:isSaved?C.green:"#fff",border:`2px solid ${isSaved?C.green:C.purple}`,borderRadius:10,fontSize:13,fontWeight:700,cursor:isSaved?"default":"pointer",fontFamily:"inherit"}}>
                    {isSaved?"✅ Salvata in Biglietti":"💾 Salva in Biglietti"}
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:14,fontSize:9,color:"#333",lineHeight:1.8,borderTop:"1px solid #111",paddingTop:10}}>
            Score (0–100): somma vicina alla media (+30) · ritardo medio alto (+40) · bassa anomalia (+20) · P/D bilanciato (+10). Nessun potere predittivo.
          </div>
        </>
      )}
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
  const [selectedTattico,setSelectedTattico]=useState(new Set());
  const [showSSTattico,setShowSSTattico]=useState(false);
  const [chosenSSTattico,setChosenSSTattico]=useState({});
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
    setSelectedTattico(new Set());setShowSSTattico(false);setChosenSSTattico({});
    setTimeout(()=>{
      const rng=mkRng(Date.now());const found=[],maxAttempts=500000;let sc=0;
      const freqNums=parseNums(freqInput),delayNums=parseNums(delayInput);
      while(found.length<50&&sc<maxAttempts){
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
        const key=nums.join(",");
        if(found.some(f=>f.nums.join(",")===key))continue;
        found.push({nums,sum:s,evens,odds,zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2)});
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
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          {[{ id: "cold", l: "❄️", c: C.teal }, { id: "unpop", l: "👥", c: C.purple }, { id: "balanced", l: "⚖️", c: ACCENT }].map(s => (<button key={s.id} onClick={() => setStrategy(s.id)} style={{ background: strategy === s.id ? `${s.c}22` : "transparent", color: strategy === s.id ? s.c : C.dim, border: `1px solid ${strategy === s.id ? s.c : C.border}`, borderRadius: 14, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>{s.l}</button>))}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ color: C.dim, fontSize: 10 }}>μ:</span>
            <input type="range" min={100} max={450} value={muCustom} onChange={e => setMuCustom(+e.target.value)} style={{ width: 70, accentColor: ACCENT }} />
            <input type="number" min={100} max={450} value={muCustom} onChange={e => setMuCustom(Math.max(100, Math.min(450, +e.target.value)))} style={{ width: 60, background: "#0a0a1c", color: ACCENT, border: `1px solid ${ACCENT}55`, borderRadius: 6, padding: "3px 6px", fontSize: 12, fontFamily: "monospace", outline: "none" }} />
          </div>
          <div style={{ width: "100%", marginTop: 6 }}>
            <div style={{ color: C.dim, fontSize: 10, marginBottom: 5 }}>⚙️ BANDA σ:</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {[0.5, 1.0, 1.5, 2.0, 2.5].map(k => {
                const se = sigmaMode === "reale" ? sigmaReale : SIGMA_TEO; const lo = Math.round(muCustom - k * se); const hi = Math.round(muCustom + k * se); const inB = series.filter(d => d.sum >= lo && d.sum <= hi).length; const pct = (inB / series.length * 100).toFixed(0); const isActive = kBand === k; return (
                  <button key={k} onClick={() => setKBand(k)} style={{ flex: 1, minWidth: 70, background: isActive ? `linear-gradient(135deg,${ACCENT}33,${ACCENT}11)` : "#080816", color: isActive ? ACCENT : C.dim, border: `2px solid ${isActive ? ACCENT : C.border}`, borderRadius: 10, padding: "8px 4px", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, fontFamily: "monospace" }}>±{k}σ</div>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: isActive ? C.teal : C.dim, marginTop: 2 }}>{lo}–{hi}</div>
                    <div style={{ fontSize: 9, color: isActive ? C.green : C.dim, marginTop: 1 }}>{pct}% storiche</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <button onClick={genera} style={{ width: "100%", padding: "13px", background: `linear-gradient(135deg,${ACCENT},${C.teal})`, color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 900, cursor: "pointer", fontFamily: "Georgia,serif", marginBottom: 12 }}>🎲 Genera Sestina + SuperStar</button>
        {ticket && (<div style={{ background: "#080816", border: `1px solid ${ACCENT}55`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {ticket.nums.map(n => { const s = scored.find(x => x.num === n); const col = s?.isHot ? C.orange : s?.isCold ? C.teal : ACCENT; return <Ball key={n} num={n} color={col} size={46} glow />; })}<div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: C.dim, fontSize: 14 }}>│</span>{superstar ? <Ball num={superstar} size={46} gold glow /> : null}<span style={{ color: "#FFD700", fontSize: 9 }}>SS</span></div>
          </div>
          <SSAffinitaPanel allDraws={allDraws} ticketSum={ticket.sum} sigmaRef={sigmaEff} currentSS={superstar} selSS={selSSBonus[0] || null} setSelSS={n => setSelSSBonus([n])} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
            {[{ l: "Σ", v: ticket.sum, c: ACCENT }, { l: "Δ da μ", v: (ticket.sum > muCustom ? "+" : "") + (ticket.sum - muCustom), c: C.teal }, { l: "Δ da 277.5", v: (ticket.sum > MU_TEO ? "+" : "") + (ticket.sum - MU_TEO).toFixed(1), c: ticket.sum > MU_TEO ? C.orange : C.teal }, { l: "z", v: zOf(ticket.sum, MU_TEO, SIGMA_TEO).toFixed(2), c: Math.abs(zOf(ticket.sum, MU_TEO, SIGMA_TEO)) < 1 ? C.green : C.orange }].map(x => (<div key={x.l} style={{ background: "#0a0a18", borderRadius: 6, padding: 8, textAlign: "center" }}><div style={{ color: C.dim, fontSize: 9 }}>{x.l}</div><div style={{ color: x.c, fontSize: 15, fontWeight: 900, fontFamily: "monospace" }}>{x.v}</div></div>))}
          </div>
          <button onClick={async () => { const t = { id: Date.now(), nums: ticket.nums, superstar: selSSBonus[0] || superstar, date: new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }), concorso: allDraws[allDraws.length - 1]?.n || 0, strategy, sum: ticket.sum }; await salvaTicketSE(t); alert(`✅ Sestina salvata!\n${ticket.nums.join("-")} | SS:${selSSBonus[0] || superstar || "—"}`); } } style={{ width: "100%", padding: "10px", background: `${C.purple}22`, color: C.purple, border: `2px solid ${C.purple}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>💾 Salva → 🎫 Biglietti</button>
        </div>)}
      {mode==="manual"&&(<div>
        <div style={{color:C.dim,fontSize:11,marginBottom:10}}>Inserisci {PICK} numeri (1–90).</div>
        {manualInputs.map((v, i) => { const num = parseInt(v) || 0, valid = num >= 1 && num <= POOL; const isDup = valid && manualInputs.filter(x => parseInt(x) === num).length > 1; const s = scored.find(x => x.num === num); const col = isDup ? C.red : s?.isHot ? C.orange : s?.isCold ? C.teal : ACCENT; return (<div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><Ball num={valid && !isDup ? num : "?"} color={valid && !isDup ? col : "#333"} size={38} /><input type="number" min={1} max={POOL} value={v} onChange={e => { const next = [...manualInputs]; next[i] = e.target.value; setManualInputs(next); } } style={{ width: 48, textAlign: "center", background: "#080816", color: col, border: `1.5px solid ${isDup ? C.red : valid ? `${col}55` : C.border}`, borderRadius: 7, padding: "4px 2px", fontSize: 13, fontFamily: "monospace", outline: "none" }} /></div>); })}
        <div style={{textAlign:"center", color: C.dim, fontSize: 10, marginBottom: 10 }}>Σ parziale: <strong style={{ color: ACCENT, fontSize: 15 }}>{sm(manualInputs.map(v => parseInt(v) || 0).filter(n => n >= 1 && n <= POOL)) || 0}</strong></div>
      </div>)}
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
            const medieDec=DECINE_UI.map((d,i)=>{const tot=allDraws.reduce((s,dr)=>s+dr.nums.filter(n=>n>=d.min&&n<=d.max).length,0);return{...d,idx:i,media:tot/allDraws.length,pct:tot/(allDraws.length*PICK)*100};});
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
                  <div style={{color:DC[i],fontSize:8,fontWeight:700,marginBottom:1}}>{d.pct.toFixed(1)}%</div>
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
        {results.length>0&&!showSSTattico&&(
          <>
            <div style={{color:C.dim,fontSize:11,marginBottom:8}}>Clicca le sestine che ti piacciono (max 10), poi premi <strong style={{color:"#FFD700"}}>Scegli SuperStar</strong></div>
            <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
              {results.map((r,i)=>{
                const k=r.nums.join(",");const isSel=selectedTattico.has(k);
                const isHot=n=>scored.find(x=>x.num===n)?.isHot;
                const isRit=n=>scored.find(x=>x.num===n)?.isCold;
                return(<div key={i} onClick={()=>{setSelectedTattico(prev=>{const next=new Set(prev);if(next.has(k))next.delete(k);else if(next.size<10)next.add(k);return next;});}} style={{background:isSel?`${ACCENT}12`:"#080816",border:`2px solid ${isSel?ACCENT:C.border}`,borderRadius:8,padding:"7px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${isSel?ACCENT:C.dim}`,background:isSel?ACCENT:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#000",fontWeight:900,flexShrink:0}}>{isSel?"✓":""}</div>
                  <div style={{display:"flex",gap:3,flex:1,flexWrap:"wrap"}}>
                    {r.nums.map(n=>{const col=isHot(n)?C.orange:isRit(n)?C.teal:ACCENT;return <Ball key={n} num={n} color={col} size={26}/>;})}</div>
                  <div style={{display:"flex",gap:4,flexShrink:0,flexWrap:"wrap"}}>
                    <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:4,padding:"2px 7px",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Σ{r.sum}</span>
                    <span style={{background:"#12122a",color:C.dim,borderRadius:4,padding:"2px 7px",fontSize:9}}>{r.evens}P–{r.odds}D</span>
                    <span style={{background:"#12122a",color:Math.abs(parseFloat(r.zScore))<1?C.green:C.orange,borderRadius:4,padding:"2px 7px",fontSize:9}}>z={r.zScore}</span>
                  </div>
                </div>);
              })}
            </div>
            {selectedTattico.size>0&&(
              <button onClick={()=>setShowSSTattico(true)} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#FFD700,#F07030)",color:"#000",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"Georgia,serif",marginBottom:8}}>
                ⭐ Scegli SuperStar per {selectedTattico.size} sestine selezionate
              </button>
            )}
          </>
        )}
        {showSSTattico&&(
          <div style={{background:C.card,border:`2px solid ${C.purple}44`,borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{color:C.purple,fontWeight:700,fontSize:14,marginBottom:14}}>⭐ Scegli il SuperStar</div>
            {results.filter(r=>selectedTattico.has(r.nums.join(","))).map((r,idx)=>{
              const k=r.nums.join(",");
              const top=getSSSuggestions(allDraws,r.sum,sigmaReale).slice(0,10);
              const chosen=chosenSSTattico[k];
              return(
                <div key={idx} style={{background:"#080816",border:`1px solid ${C.purple}33`,borderRadius:10,padding:12,marginBottom:12}}>
                  <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                    <span style={{color:C.dim,fontSize:10}}>#{idx+1}</span>
                    {r.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={28}/>)}
                    <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700,fontFamily:"monospace"}}>Σ{r.sum}</span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                    {top.map(t=>{const isCho=chosen===t.num;const pct=Math.round(t.score/Math.max(...top.map(x=>x.score))*100);return(
                      <div key={t.num} onClick={()=>setChosenSSTattico(prev=>({...prev,[k]:t.num}))} style={{textAlign:"center",cursor:"pointer",padding:"5px 4px",background:isCho?"#FFD70018":"#0e0e1c",border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,borderRadius:8,boxShadow:isCho?"0 0 10px #FFD70044":"none"}}>
                        <Ball num={t.num} size={28} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho}/>
                        <div style={{background:"#0a0a18",borderRadius:2,height:3,overflow:"hidden",margin:"3px 0 1px",width:28}}><div style={{background:isCho?"#FFD700":"#d97706",height:"100%",width:`${pct}%`}}/></div>
                        <div style={{color:isCho?"#FFD700":"#888",fontSize:9,fontWeight:isCho?700:400}}>{pct}%</div>
                        <div style={{color:C.dim,fontSize:8}}>r.{t.ritardo}</div>
                      </div>
                    );})}
                  </div>
                  <div style={{background:chosen?"#FFD70008":C.card,border:`1px solid ${chosen?"#FFD70033":C.border}`,borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                    <span style={{color:C.dim,fontSize:11}}>SuperStar:</span>
                    {chosen?(<><Ball num={chosen} size={34} gold glow/><span style={{color:"#FFD700",fontWeight:700,fontSize:15,fontFamily:"monospace"}}>{chosen}</span></>):(<span style={{color:"#555",fontSize:11}}>Clicca un numero sopra</span>)}
                  </div>
                  {chosen&&(<button onClick={()=>{const t={id:Date.now()+idx,nums:r.nums,superstar:chosen,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy:"tattico",sum:r.sum};const prev=JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");localStorage.setItem(LS_TICKETS_S,JSON.stringify([...prev,t]));alert(`✅ Linea ${idx+1} salvata!\n${r.nums.join("-")} | SS:${chosen}`);}} style={{width:"100%",padding:"8px",marginTop:8,background:`${C.purple}22`,color:C.purple,border:`2px solid ${C.purple}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💾 Salva</button>)}
                </div>
              );
            })}
            <button onClick={()=>setShowSSTattico(false)} style={{background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",fontSize:11,cursor:"pointer"}}>← Torna alla lista</button>
          </div>
        )}
      </div>)}
    </div>
  );
}

function TabConfronto(){
  const allDraws=useDraws();
  const [userInput,setUserInput]=useState("");
  const [userNums,setUserNums]=useState([]);
  const [compared,setCompared]=useState([]);
  const confronta=()=>{
    const nums=userInput.split(/[\s,;]+/).map(s=>parseInt(s.trim())).filter(n=>!isNaN(n)&&n>=1&&n<=POOL);
    if(nums.length!==PICK){alert(`Inserisci esattamente ${PICK} numeri (1–${POOL})`);return;}
    if([...new Set(nums)].length!==PICK){alert("Numeri duplicati");return;}
    const sorted=nums.sort((a,b)=>a-b);setUserNums(sorted);
    const results=allDraws.slice(-50).map(d=>{const matches=d.nums.filter(n=>sorted.includes(n));return{...d,matches,pts:matches.length};}).sort((a,b)=>b.pts-a.pts);
    setCompared(results);
  };
  const userSum=sm(userNums);
  const zUser=userNums.length===PICK?zOf(userSum,MU_TEO,SIGMA_TEO):null;
  const D={gold:"#E8B84B",orange:"#F07030",teal:"#2BA89A",red:"#C94040",purple:"#8A5CC4",green:"#4A9E5C",bg:"#07070F",card:"#0D0D1A",border:"#1A1A2E",text:"#E0E0F0",dim:"#6A6A8A"};
  return(
    <div>
      <h2 style={{color:"#D4AF37",fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🔁 Confronto Sestina</h2>
      <div style={{background:D.card,border:"1px solid #D4AF3733",borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{color:"#D4AF37",fontWeight:700,fontSize:12,marginBottom:8}}>Inserisci la tua sestina da confrontare</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
          <input type="text" value={userInput} onChange={e=>setUserInput(e.target.value)} placeholder="Es. 7 15 23 38 45 67" style={{flex:1,minWidth:180,background:"#080816",color:"#D4AF37",border:"1px solid #D4AF3755",borderRadius:8,padding:"10px 12px",fontSize:14,fontFamily:"monospace",outline:"none"}}/>
          <button onClick={confronta} style={{padding:"10px 20px",background:"linear-gradient(135deg,#D4AF37,#2BA89A)",color:"#000",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🔍 Confronta</button>
        </div>
        {userNums.length===PICK&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
            {userNums.map(n=><Ball key={n} num={n} color="#D4AF37" size={34} glow/>)}
            <div style={{display:"flex",gap:8,marginLeft:8,flexWrap:"wrap"}}>
              <span style={{background:"#D4AF3722",color:"#D4AF37",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700}}>Σ={userSum}</span>
              <span style={{background:"#2BA89A22",color:"#2BA89A",borderRadius:6,padding:"4px 10px",fontSize:12}}>z={zUser?.toFixed(2)}</span>
              <span style={{background:"#12122a",color:D.dim,borderRadius:6,padding:"4px 10px",fontSize:12}}>{userNums.filter(n=>n%2===0).length}P–{userNums.filter(n=>n%2!==0).length}D</span>
            </div>
          </div>
        )}
      </div>
      {compared.length>0&&(
        <div>
          <div style={{color:"#D4AF37",fontWeight:700,fontSize:13,marginBottom:10}}>Ultime 50 estrazioni — ordinato per punti</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {compared.map(r=>{
              const PCOL={0:"#4A4A6A",1:"#4A4A6A",2:"#4A8FD4",3:"#2BA89A",4:"#E8B84B",5:"#F07030",6:"#C94040"};
              const col=PCOL[Math.min(r.pts,6)]||D.dim;
              return(<div key={r.n} style={{background:r.pts>=2?`${col}12`:"#080816",border:`1px solid ${r.pts>=2?col:D.border}`,borderRadius:9,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:4}}>
                  <span style={{color:D.dim,fontSize:10}}>Est. <strong style={{color:"#D4AF37"}}>#{r.n}</strong> · {r.date?.substring(0,5)||""} · Σ={sm(r.nums)}</span>
                  <span style={{color:col,fontWeight:700,fontSize:11}}>{r.pts>0?`${r.pts} punt${r.pts===1?"o":"i"}`:"–"}</span>
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
                  {r.nums.map(n=>{const hit=userNums.includes(n);return(<div key={n} style={{position:"relative"}}><Ball num={n} color={hit?col:"#2a2a3a"} size={28} glow={hit&&r.pts>=2}/>{hit&&<div style={{position:"absolute",top:-3,right:-3,width:9,height:9,borderRadius:"50%",background:col,border:"1px solid #06060e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:6,color:"#000",fontWeight:900}}>✓</div>}</div>);})}
                  {r.jolly&&<><span style={{color:D.dim,fontSize:14,alignSelf:"center"}}>│</span><Ball num={r.jolly} color="#aaa" size={26}/><span style={{color:"#aaa",fontSize:8}}>J</span></>}
                  {r.superstar&&<><Ball num={r.superstar} size={26} gold/><span style={{color:"#FFD700",fontSize:8}}>SS</span></>}
                </div>
                {r.matches.length>0&&(<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <span style={{color:col,fontSize:10,fontWeight:700}}>✓</span>
                  {r.matches.map(n=><span key={n} style={{background:`${col}33`,border:`1px solid ${col}`,borderRadius:4,padding:"1px 6px",color:col,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{n}</span>)}
                </div>)}
              </div>);
            })}
          </div>
        </div>
      )}
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

// ═══════════════════════════════════════════════════════════════
// MOTORE PREDITTIVO v2 — inserire prima della costante TABS
// ═══════════════════════════════════════════════════════════════

// ─── CORRELAZIONI TRA COPPIE ─────────────────────────────────
function computePairCorrelations(draws) {
  const pairCount = {};
  draws.forEach(d => {
    for(let i=0;i<d.nums.length;i++)
      for(let j=i+1;j<d.nums.length;j++){
        const key=`${d.nums[i]}-${d.nums[j]}`;
        pairCount[key]=(pairCount[key]||0)+1;
      }
  });
  const N=draws.length;
  const totalPairs=PICK*(PICK-1)/2;
  const totalPoolPairs=POOL*(POOL-1)/2;
  const expectedFreq=N*totalPairs/totalPoolPairs;
  const sigmaFreq=Math.sqrt(expectedFreq*(1-totalPairs/totalPoolPairs));
  const pairs=Object.entries(pairCount).map(([k,v])=>({
    pair:k,
    nums:k.split('-').map(Number),
    count:v,
    z:(v-expectedFreq)/Math.max(sigmaFreq,0.1),
    excess:v-expectedFreq,
  })).sort((a,b)=>b.z-a.z);
  // Score per numero basato sulle correlazioni
  const numScore=new Array(POOL+1).fill(0);
  pairs.slice(0,20).forEach(p=>{
    p.nums.forEach(n=>{ numScore[n]+=Math.max(0,p.z); });
  });
  const maxNS=Math.max(...numScore.slice(1),0.001);
  return {
    topPairs:pairs.slice(0,15),
    numScore:numScore.map(s=>s/maxNS),
    expectedFreq:parseFloat(expectedFreq.toFixed(2)),
  };
}

// ─── LSTM SEMPLIFICATO ───────────────────────────────────────
function computeLSTM(draws) {
  const windowSize=5;
  function features(nums){
    const s=nums.reduce((a,b)=>a+b,0);
    const e=nums.filter(n=>n%2===0).length;
    const gaps=[];for(let i=1;i<nums.length;i++)gaps.push(nums[i]-nums[i-1]);
    const avgGap=gaps.reduce((a,b)=>a+b,0)/gaps.length;
    const deciles=new Array(9).fill(0);
    nums.forEach(n=>deciles[Math.floor((n-1)/10)]++);
    return {sum:s,evens:e,avgGap,maxDecile:Math.max(...deciles),range:nums[nums.length-1]-nums[0]};
  }
  const patterns=[];
  for(let i=windowSize;i<draws.length;i++){
    const ctx=draws.slice(i-windowSize,i).map(d=>features(d.nums));
    const target=features(draws[i].nums);
    const sumTrend=(ctx[ctx.length-1].sum-ctx[0].sum)/(windowSize-1);
    const evensTrend=ctx.reduce((a,f)=>a+f.evens,0)/windowSize;
    const gapTrend=ctx.reduce((a,f)=>a+f.avgGap,0)/windowSize;
    patterns.push({sumTrend,evensTrend,gapTrend,predictedSum:ctx[ctx.length-1].sum+sumTrend,actualSum:target.sum});
  }
  const recent=draws.slice(-windowSize).map(d=>features(d.nums));
  const lastSums=recent.map(f=>f.sum);
  const currentTrend=(lastSums[lastSums.length-1]-lastSums[0])/(windowSize-1);
  const weightedPrediction=Math.round(
    lastSums[lastSums.length-1]*0.4+
    lastSums[lastSums.length-2]*0.3+
    lastSums[lastSums.length-3]*0.2+
    (lastSums[lastSums.length-1]+currentTrend)*0.1
  );
  const errors=patterns.map(p=>Math.abs(p.predictedSum-p.actualSum));
  const avgError=errors.reduce((a,b)=>a+b,0)/errors.length;
  const evensTrend=recent.reduce((a,f)=>a+f.evens,0)/windowSize;
  return {
    currentTrend:parseFloat(currentTrend.toFixed(1)),
    predictedSum:weightedPrediction,
    predictedRange:{lo:Math.round(weightedPrediction-25),hi:Math.round(weightedPrediction+25)},
    avgError:parseFloat(avgError.toFixed(1)),
    evensTrend:parseFloat(evensTrend.toFixed(1)),
    lastSums,
  };
}

// ─── REGRESSIONE SOMMA ───────────────────────────────────────
function computeRegression(draws) {
  const allSums=draws.map(d=>d.nums.reduce((a,b)=>a+b,0));
  const muAll=allSums.reduce((a,b)=>a+b,0)/allSums.length;
  const sigmaAll=Math.sqrt(allSums.reduce((a,s)=>a+(s-muAll)**2,0)/allSums.length);
  // Media mobile ponderata ultime 20 (pesi lineari crescenti)
  const recent=allSums.slice(-20);
  const weights=recent.map((_,i)=>i+1);
  const totalW=weights.reduce((a,b)=>a+b,0);
  const wma=recent.reduce((a,s,i)=>a+s*weights[i],0)/totalW;
  // Regressione lineare semplice sulle ultime 30 estrazioni
  const x30=allSums.slice(-30);
  const n=x30.length;
  const sumX=x30.reduce((a,_,i)=>a+i,0);
  const sumY=x30.reduce((a,b)=>a+b,0);
  const sumXY=x30.reduce((a,s,i)=>a+i*s,0);
  const sumX2=x30.reduce((a,_,i)=>a+i*i,0);
  const slope=(n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX);
  const intercept=(sumY-slope*sumX)/n;
  const predicted=Math.round(intercept+slope*n);
  return {
    muAll:parseFloat(muAll.toFixed(1)),
    sigmaAll:parseFloat(sigmaAll.toFixed(1)),
    wma:parseFloat(wma.toFixed(1)),
    slope:parseFloat(slope.toFixed(2)),
    predicted,
    predictedRange:{lo:Math.round(predicted-sigmaAll*0.8),hi:Math.round(predicted+sigmaAll*0.8)},
    allSums,
  };
}

// ─── ANALISI SPETTRALE ───────────────────────────────────────
function computeSpectral(draws) {
  const allSums=draws.map(d=>d.nums.reduce((a,b)=>a+b,0));
  const mu=allSums.reduce((a,b)=>a+b,0)/allSums.length;
  const centered=allSums.map(s=>s-mu);
  const N=centered.length;
  const periods=[2,3,5,7,10,13,17,20,25,30,50];
  const spectral=periods.map(period=>{
    let re=0,im=0;
    centered.forEach((v,i)=>{
      re+=v*Math.cos(2*Math.PI*i/period);
      im+=v*Math.sin(2*Math.PI*i/period);
    });
    const power=Math.sqrt(re*re+im*im)/N;
    const phase=Math.atan2(im,re);
    // Predizione basata sulla fase: dove siamo nel ciclo?
    const posInCycle=((N-1)%period)/period;
    const nextPhase=((N)%period)/period;
    return {period,power:parseFloat(power.toFixed(2)),phase:parseFloat(phase.toFixed(3)),posInCycle:parseFloat(posInCycle.toFixed(2)),nextPhase:parseFloat(nextPhase.toFixed(2))};
  }).sort((a,b)=>b.power-a.power);
  return {spectral,dominant:spectral[0]};
}

// ─── ENSEMBLE SCORE PREDITTIVO ───────────────────────────────
function computeEnsemblePredictive(draws,muReale,sigmaReale) {
  const N=draws.length;
  const cycles=analyzeCycles(draws);
  const pairs=computePairCorrelations(draws);
  const modelWeights={cicli:0.25,bayesiano:0.20,ritardo:0.20,correlazioni:0.20,lstm:0.15};

  return Array.from({length:POOL},(_,i)=>{
    const num=i+1;
    const cyc=cycles[i];

    // Score ciclo
    const cycleScore=cyc.score;

    // Score bayesiano
    const recentFreq=draws.slice(-150).filter(d=>d.nums.includes(num)).length;
    const alpha=recentFreq+1,beta=150-recentFreq+1;
    const posteriorMean=alpha/(alpha+beta);
    const expectedProb=PICK/POOL;
    const bayesScore=Math.min(Math.max(0,expectedProb-posteriorMean)*20,1);

    // Score ritardo
    let rit=N;
    for(let j=N-1;j>=0;j--) if(draws[j].nums.includes(num)){rit=N-1-j;break;}
    const ritScore=Math.min(rit/N,1);

    // Score correlazioni
    const corrScore=Math.min(pairs.numScore[num]||0,1);

    // Score LSTM (basato su trend somma)
    const lstm=computeLSTM(draws);
    const lstmScore=lstm.currentTrend>0?0.55:0.45;

    const ensemble=
      cycleScore*modelWeights.cicli+
      bayesScore*modelWeights.bayesiano+
      ritScore*modelWeights.ritardo+
      corrScore*modelWeights.correlazioni+
      lstmScore*modelWeights.lstm;

    const freq=draws.filter(d=>d.nums.includes(num)).length;
    return {
      num,
      ensemble:parseFloat((ensemble*100).toFixed(1)),
      cycleScore:parseFloat((cycleScore*100).toFixed(0)),
      bayesScore:parseFloat((bayesScore*100).toFixed(0)),
      ritScore:parseFloat((ritScore*100).toFixed(0)),
      corrScore:parseFloat((corrScore*100).toFixed(0)),
      lstmScore:parseFloat((lstmScore*100).toFixed(0)),
      rit,freq,
      cycle:cyc.cycle,
      phase:cyc.phase,
    };
  }).sort((a,b)=>b.ensemble-a.ensemble);
}

// ─── GENERA SESTINE CON ENSEMBLE PREDITTIVO ──────────────────
function generatePredictive(ensembleScores,regression,lstm,qty,allDraws,muReale,sigmaReale) {
  const loB=regression.predictedRange.lo;
  const hiB=regression.predictedRange.hi;
  const rng=mkRng(Date.now());
  // Pool pesato per ensemble
  const pool=ensembleScores.map(s=>s.num);
  const weights=ensembleScores.map(s=>Math.max(0.05,(s.ensemble/100)+0.5));
  const totalW=weights.reduce((a,b)=>a+b,0);
  const cumW=[];let acc=0;
  weights.forEach(w=>{acc+=w;cumW.push(acc/totalW);});
  function pickW(){const r=rng();for(let i=0;i<cumW.length;i++)if(r<=cumW[i])return pool[i];return pool[pool.length-1];}
  const found=[];
  let sc=0;
  while(found.length<qty&&sc<3000000){
    sc++;
    const nums=new Set();let att=0;
    while(nums.size<PICK&&att<200){nums.add(pickW());att++;}
    if(nums.size<PICK) continue;
    const arr=[...nums].sort((a,b)=>a-b);
    const s=arr.reduce((a,b)=>a+b,0);
    if(s<loB||s>hiB) continue;
    const key=arr.join(",");
    if(found.some(f=>f.nums.join(",")===key)) continue;
    // Score predittivo = media ensemble dei numeri
    const predScore=arr.reduce((a,n)=>{const e=ensembleScores.find(x=>x.num===n);return a+(e?e.ensemble:0);},0)/PICK;
    // Calcola anche affinità con le coppie top
    const pairData=computePairCorrelations(allDraws);
    let pairBonus=0;
    for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
      const p=pairData.topPairs.find(x=>x.nums[0]===arr[i]&&x.nums[1]===arr[j]);
      if(p) pairBonus+=p.z;
    }
    const evens=arr.filter(n=>n%2===0).length;
    found.push({nums:arr,sum:s,evens,odds:PICK-evens,predScore:parseFloat(predScore.toFixed(1)),pairBonus:parseFloat(pairBonus.toFixed(2)),zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2)});
  }
  return found.sort((a,b)=>b.predScore-a.predScore);
}

// ─── TAB PREDITTIVO ──────────────────────────────────────────
function TabPredittivo() {
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);
  const [computed,setComputed]=useState(null);
  const [loading,setLoading]=useState(false);
  const [qty,setQty]=useState(5);
  const [sestine,setSestine]=useState(()=>{try{const s=sessionStorage.getItem("se_pred_sestine");return s?JSON.parse(s):[];}catch{return [];}});
  const [genLoading,setGenLoading]=useState(false);
  const [selSS,setSelSS]=useState(()=>{try{const s=sessionStorage.getItem("se_pred_selss");return s?JSON.parse(s):{};}catch{return {};}});
  const [savedIds,setSavedIds]=useState(new Set());

  const esegui=()=>{
    setLoading(true);setSestine([]);
    setTimeout(()=>{
      const pairs=computePairCorrelations(allDraws);
      const lstm=computeLSTM(allDraws);
      const regression=computeRegression(allDraws);
      const spectral=computeSpectral(allDraws);
      const ensemble=computeEnsemblePredictive(allDraws,muReale,sigmaReale);
      setComputed({pairs,lstm,regression,spectral,ensemble});
      setLoading(false);
    },150);
  };

  const genera=()=>{
    if(!computed) return;
    setGenLoading(true);setSestine([]);setSavedIds(new Set());
    setTimeout(()=>{
      const result=generatePredictive(computed.ensemble,computed.regression,computed.lstm,qty,allDraws,muReale,sigmaReale);
      try{sessionStorage.setItem("se_pred_sestine",JSON.stringify(result));}catch{}
      setSestine(result);
      setGenLoading(false);
    },100);
  };

  const salvaBiglietto=async(r,idx)=>{
    const ss=selSS[idx]||getSSSuggestions(allDraws,r.sum,sigmaReale)[0]?.num||null;
    const ticket={id:Date.now()+idx,nums:r.nums,superstar:ss,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy:"predittivo",sum:r.sum,score:Math.round(r.predScore)||0};
    await salvaTicketSE(ticket);
    setSavedIds(prev=>new Set([...prev,idx]));
    alert(`✅ Salvata!\n${r.nums.join("-")} | SS:${ss||"—"}`);
  };

  const PUR="#e879f9"; // colore viola-rosa per questo tab

  return(
    <div>
      <h2 style={{color:PUR,fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>🔬 Motore Predittivo v2</h2>
      <div style={{background:"#1a001a",border:`1px solid ${PUR}33`,borderRadius:10,padding:12,marginBottom:14,fontSize:10,color:`${PUR}99`,lineHeight:1.7}}>
        Ensemble di 5 modelli: <strong style={{color:PUR}}>Correlazioni Coppie</strong> · <strong style={{color:PUR}}>LSTM Sequenziale</strong> · <strong style={{color:PUR}}>Regressione Somma</strong> · <strong style={{color:PUR}}>Analisi Spettrale FFT</strong> · <strong style={{color:PUR}}>Score Bayesiano+Ciclico</strong>.
        Genera sestine ottimizzate per la prossima estrazione secondo tutti i modelli combinati.
      </div>

      <button onClick={esegui} disabled={loading} style={{width:"100%",padding:"13px",background:loading?"#1a001a":`linear-gradient(135deg,${PUR},#9333ea)`,color:loading?"#555":"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:loading?"not-allowed":"pointer",fontFamily:"Georgia,serif",marginBottom:16}}>
        {loading?"⏳ Calcolo modelli in corso...":"🔬 Calcola Modelli Predittivi"}
      </button>

      {computed&&(<>

        {/* PREDIZIONE SOMMA */}
        <div style={{background:C.card,border:`1px solid ${PUR}33`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:PUR,fontWeight:700,fontSize:13,marginBottom:10}}>① Predizione Somma Prossima Estrazione</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:12}}>
            <div style={{background:"#0a001a",borderRadius:8,padding:10,textAlign:"center",border:`1px solid ${PUR}33`}}>
              <div style={{color:C.dim,fontSize:9}}>LSTM — predizione</div>
              <div style={{color:PUR,fontFamily:"monospace",fontSize:18,fontWeight:900}}>{computed.lstm.predictedSum}</div>
              <div style={{color:C.dim,fontSize:9}}>range [{computed.lstm.predictedRange.lo}–{computed.lstm.predictedRange.hi}]</div>
            </div>
            <div style={{background:"#0a001a",borderRadius:8,padding:10,textAlign:"center",border:`1px solid ${PUR}33`}}>
              <div style={{color:C.dim,fontSize:9}}>Regressione lineare</div>
              <div style={{color:C.orange,fontFamily:"monospace",fontSize:18,fontWeight:900}}>{computed.regression.predicted}</div>
              <div style={{color:C.dim,fontSize:9}}>range [{computed.regression.predictedRange.lo}–{computed.regression.predictedRange.hi}]</div>
            </div>
            <div style={{background:"#0a001a",borderRadius:8,padding:10,textAlign:"center",border:`1px solid ${PUR}33`}}>
              <div style={{color:C.dim,fontSize:9}}>Media mobile pond. (ult.20)</div>
              <div style={{color:ACCENT,fontFamily:"monospace",fontSize:18,fontWeight:900}}>{computed.regression.wma}</div>
              <div style={{color:C.dim,fontSize:9}}>μ={computed.regression.muAll} σ={computed.regression.sigmaAll}</div>
            </div>
            <div style={{background:"#0a001a",borderRadius:8,padding:10,textAlign:"center",border:`1px solid ${PUR}33`}}>
              <div style={{color:C.dim,fontSize:9}}>Trend corrente</div>
              <div style={{color:computed.lstm.currentTrend>0?C.orange:C.teal,fontFamily:"monospace",fontSize:18,fontWeight:900}}>
                {computed.lstm.currentTrend>0?"+":""}{computed.lstm.currentTrend}
              </div>
              <div style={{color:C.dim,fontSize:9}}>per estrazione</div>
            </div>
          </div>
          {/* Mini grafico ultime somme */}
          <div style={{background:"#080816",borderRadius:6,padding:8}}>
            <div style={{color:C.dim,fontSize:9,marginBottom:4}}>Ultime 30 somme + predizione:</div>
            <svg width="100%" height="60" viewBox="0 0 400 60" preserveAspectRatio="none">
              {(()=>{
                const data=computed.regression.allSums.slice(-30);
                const pred=computed.lstm.predictedSum;
                const allVals=[...data,pred];
                const min=Math.min(...allVals)-20;
                const max=Math.max(...allVals)+20;
                const toY=v=>60-((v-min)/(max-min))*60;
                const pts=data.map((s,i)=>`${(i/(data.length))*380},${toY(s)}`).join(" ");
                const lastX=(data.length-1)/data.length*380;
                const predX=400;
                return(<>
                  <polyline points={pts} fill="none" stroke={PUR} strokeWidth="1.5"/>
                  <line x1="0" y1={toY(computed.regression.muAll)} x2="400" y2={toY(computed.regression.muAll)} stroke={`${ACCENT}66`} strokeDasharray="4,3" strokeWidth="1"/>
                  <line x1={lastX} y1={toY(data[data.length-1])} x2={predX} y2={toY(pred)} stroke={C.orange} strokeDasharray="5,3" strokeWidth="2"/>
                  <circle cx={predX} cy={toY(pred)} r="4" fill={C.orange}/>
                </>);
              })()}
            </svg>
          </div>
        </div>

        {/* ANALISI SPETTRALE */}
        <div style={{background:C.card,border:`1px solid ${PUR}33`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:PUR,fontWeight:700,fontSize:13,marginBottom:10}}>② Analisi Spettrale — Cicli Nascosti</div>
          <div style={{color:C.dim,fontSize:10,marginBottom:10}}>
            Ciclo dominante: ogni <strong style={{color:PUR}}>{computed.spectral.dominant.period}</strong> estrazioni (potenza: {computed.spectral.dominant.power}) · Posizione nel ciclo attuale: <strong style={{color:computed.spectral.dominant.posInCycle>0.7?C.orange:C.teal}}>{(computed.spectral.dominant.posInCycle*100).toFixed(0)}%</strong>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {computed.spectral.spectral.slice(0,6).map(s=>{
              const maxP=computed.spectral.spectral[0].power;
              const pct=(s.power/maxP*100);
              const col=s.period===computed.spectral.dominant.period?PUR:C.dim;
              return(
                <div key={s.period} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:col,fontFamily:"monospace",fontSize:10,minWidth:70}}>ciclo {s.period}est.</span>
                  <div style={{flex:1,background:"#0a0a18",borderRadius:3,height:6,overflow:"hidden"}}>
                    <div style={{background:col,height:"100%",width:`${pct}%`}}/>
                  </div>
                  <span style={{color:col,fontSize:9,fontFamily:"monospace",minWidth:30}}>{s.power}</span>
                  <span style={{color:C.dim,fontSize:9,minWidth:50}}>pos:{(s.posInCycle*100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CORRELAZIONI COPPIE */}
        <div style={{background:C.card,border:`1px solid ${PUR}33`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:PUR,fontWeight:700,fontSize:13,marginBottom:6}}>③ Correlazioni Coppie — Top 10 (z-score)</div>
          <div style={{color:C.dim,fontSize:10,marginBottom:10}}>Frequenza attesa per coppia: {computed.pairs.expectedFreq}x · Coppie con z{'>'} 2 sono statisticamente anomale</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:6}}>
            {computed.pairs.topPairs.slice(0,10).map((p,i)=>{
              const col=p.z>3?C.red:p.z>2?C.orange:C.teal;
              return(
                <div key={p.pair} style={{background:"#080816",border:`1px solid ${col}33`,borderRadius:8,padding:"8px 10px"}}>
                  <div style={{display:"flex",gap:4,marginBottom:6}}>
                    {p.nums.map(n=><Ball key={n} num={n} color={col} size={26}/>)}
                  </div>
                  <div style={{color:col,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{p.count}x</div>
                  <div style={{color:C.dim,fontSize:9}}>z={p.z.toFixed(2)}</div>
                  <div style={{background:"#0a0a18",borderRadius:3,height:4,overflow:"hidden",marginTop:4}}>
                    <div style={{background:col,height:"100%",width:`${Math.min(p.z/5*100,100)}%`}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ENSEMBLE TOP 20 */}
        <div style={{background:C.card,border:`1px solid ${PUR}33`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:PUR,fontWeight:700,fontSize:13,marginBottom:6}}>④ Ensemble Score Predittivo — Top 20</div>
          <div style={{color:C.dim,fontSize:9,marginBottom:10}}>
            Cicli 25% · Bayesiano 20% · Ritardo 20% · Correlazioni 20% · LSTM 15%
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:6}}>
            {computed.ensemble.slice(0,20).map((s,i)=>{
              const col=i<5?"#FFD700":i<10?C.orange:PUR;
              return(
                <div key={s.num} style={{background:"#080816",border:`1px solid ${col}33`,borderRadius:8,padding:"8px 10px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                    <Ball num={s.num} color={col} size={26} glow={i<5}/>
                    <div>
                      <div style={{color:col,fontFamily:"monospace",fontSize:13,fontWeight:900}}>{s.ensemble}</div>
                      <div style={{color:C.dim,fontSize:8}}>ensemble</div>
                    </div>
                  </div>
                  {[
                    {l:"ciclo",v:s.cycleScore,c:"#22d3ee"},
                    {l:"bayes",v:s.bayesScore,c:C.purple},
                    {l:"rit",v:s.ritScore,c:C.teal},
                    {l:"corr",v:s.corrScore,c:C.orange},
                    {l:"lstm",v:s.lstmScore,c:PUR},
                  ].map(row=>(
                    <div key={row.l} style={{display:"flex",gap:4,alignItems:"center",marginBottom:1}}>
                      <span style={{color:C.dim,fontSize:7,width:24}}>{row.l}</span>
                      <div style={{flex:1,background:"#0a0a18",borderRadius:2,height:3,overflow:"hidden"}}>
                        <div style={{background:row.c,height:"100%",width:`${Math.min(row.v,100)}%`}}/>
                      </div>
                      <span style={{color:row.c,fontSize:7,width:18,textAlign:"right"}}>{row.v}</span>
                    </div>
                  ))}
                  <div style={{color:C.dim,fontSize:7,marginTop:3}}>rit:{s.rit} · f:{s.freq}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GENERA SESTINE */}
        <div style={{background:"#0a001a",border:`2px solid ${PUR}44`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:PUR,fontWeight:700,fontSize:13,marginBottom:10}}>⑤ Genera Sestine con Ensemble Predittivo</div>
          <div style={{color:C.dim,fontSize:10,marginBottom:12}}>
            Range somma predetto: <strong style={{color:PUR}}>[{computed.regression.predictedRange.lo}–{computed.regression.predictedRange.hi}]</strong> · 
            Trend: <strong style={{color:computed.lstm.currentTrend>0?C.orange:C.teal}}>{computed.lstm.currentTrend>0?"+":""}{computed.lstm.currentTrend}/est.</strong>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
            <span style={{color:C.dim,fontSize:11}}>Combinazioni:</span>
            {[1,3,5,10].map(n=>(
              <button key={n} onClick={()=>setQty(n)} style={{background:qty===n?`${PUR}22`:"transparent",color:qty===n?PUR:C.dim,border:`1px solid ${qty===n?PUR:C.border}`,borderRadius:14,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>
            ))}
          </div>
          <button onClick={genera} disabled={genLoading} style={{width:"100%",padding:"12px",background:genLoading?"#1a001a":`linear-gradient(135deg,${PUR},#9333ea)`,color:genLoading?"#555":"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:genLoading?"not-allowed":"pointer",fontFamily:"Georgia,serif",marginBottom:12}}>
            {genLoading?"⏳ Generazione...":"🔬 Genera Sestine Predittive"}
          </button>

          {sestine.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {sestine.map((r,i)=>{
                const isBest=i===0;
                const topSS=getSSSuggestions(allDraws,r.sum,sigmaReale)[0]?.num||null;
                const chosenSS=selSS[i]||topSS;
                const top3SS=getSSSuggestions(allDraws,r.sum,sigmaReale).slice(0,3);
                const isSaved=savedIds.has(i);
                return(
                  <div key={i} style={{background:"#080816",border:`2px solid ${isBest?`${PUR}88`:`${PUR}22`}`,borderLeft:`4px solid ${PUR}`,borderRadius:12,padding:"14px",position:"relative"}}>
                    {isBest&&<div style={{position:"absolute",top:-10,left:14,background:PUR,color:"#fff",fontSize:9,fontWeight:900,padding:"2px 10px",borderRadius:10}}>🏆 MIGLIORE</div>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{color:PUR,fontFamily:"monospace",fontSize:11}}>#{i+1}</span>
                        <span style={{background:`${PUR}22`,color:PUR,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>Score {r.predScore}</span>
                        {r.pairBonus>0&&<span style={{background:`${C.orange}22`,color:C.orange,borderRadius:6,padding:"2px 8px",fontSize:10}}>+coppie {r.pairBonus.toFixed(1)}</span>}
                      </div>
                      <div style={{background:"#0a0a18",borderRadius:6,height:6,width:80,overflow:"hidden"}}>
                        <div style={{background:`linear-gradient(90deg,${PUR},#9333ea)`,height:"100%",width:`${Math.min(r.predScore,100)}%`}}/>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
                      {r.nums.map(n=>{
                        const e=computed.ensemble.find(x=>x.num===n);
                        const rank=computed.ensemble.findIndex(x=>x.num===n);
                        const col=rank<5?"#FFD700":rank<10?C.orange:PUR;
                        return <Ball key={n} num={n} color={col} size={38} glow={rank<5}/>;
                      })}
                    </div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                      <span style={{background:`${PUR}22`,color:PUR,borderRadius:5,padding:"2px 8px",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Σ {r.sum}</span>
                      <span style={{background:"#12122a",color:C.dim,borderRadius:5,padding:"2px 8px",fontSize:10}}>{r.evens}P–{r.odds}D</span>
                      <span style={{background:"#12122a",color:Math.abs(parseFloat(r.zScore))<1?C.green:C.orange,borderRadius:5,padding:"2px 8px",fontSize:10}}>z={r.zScore}</span>
                    </div>
                    {/* SuperStar */}
                    <div style={{background:"#0a0810",border:"1px solid #FFD70022",borderRadius:10,padding:10,marginBottom:10}}>
                      <div style={{color:"#FFD700",fontSize:10,fontWeight:700,marginBottom:8}}>⭐ SuperStar consigliato</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                        {top3SS.map((s,si)=>{
                          const isCho=chosenSS===s.num;
                          return(
                            <div key={s.num} onClick={()=>setSelSS(prev=>({...prev,[i]:s.num}))} style={{textAlign:"center",cursor:"pointer",padding:"6px 8px",background:isCho?"#FFD70018":"#0e0e1c",border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,borderRadius:8,boxShadow:isCho?"0 0 10px #FFD70044":"none"}}>
                              <Ball num={s.num} size={28} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho}/>
                              <div style={{color:isCho?"#FFD700":si===0?"#E8B84B":"#888",fontSize:9,marginTop:3}}>{s.pct}%</div>
                              <div style={{color:C.dim,fontSize:8}}>r.{s.ritardo}</div>
                            </div>
                          );
                        })}
                        <div style={{paddingLeft:8,borderLeft:"1px solid #222",display:"flex",alignItems:"center",gap:6}}>
                          <Ball num={chosenSS||"?"} size={30} gold={!!chosenSS} color={chosenSS?"#FFD700":"#444"} glow={!!chosenSS}/>
                          <span style={{color:"#FFD700",fontFamily:"monospace",fontWeight:700,fontSize:13}}>{chosenSS||"—"}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={()=>salvaBiglietto(r,i)} disabled={isSaved} style={{width:"100%",padding:"10px",background:isSaved?`${C.green}22`:`linear-gradient(135deg,${PUR},#9333ea)`,color:isSaved?C.green:"#fff",border:`2px solid ${isSaved?C.green:PUR}`,borderRadius:10,fontSize:13,fontWeight:700,cursor:isSaved?"default":"pointer",fontFamily:"inherit"}}>
                      {isSaved?"✅ Salvata in Biglietti":"💾 Salva in Biglietti"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{background:"#1a001a",border:`1px solid ${PUR}22`,borderRadius:8,padding:10,fontSize:9,color:`${PUR}55`,lineHeight:1.8}}>
          Modello predittivo ensemble v2. Score = media ponderata di 5 modelli indipendenti. Nessun potere predittivo garantito — strumento di ottimizzazione statistica. Riesegui dopo ogni nuova estrazione.
        </div>
      </>)}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// GENERATORE UNIFICATO v4 — con tooltip informativi
// ═══════════════════════════════════════════════════════════════

function InfoModal({title,text,onClose}){
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#0e0e1c",border:"1px solid #f59e0b55",borderRadius:14,padding:20,maxWidth:340,width:"100%"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{color:"#f59e0b",fontWeight:700,fontSize:13}}>{title}</span>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#666",fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <div style={{color:"#ccc",fontSize:12,lineHeight:1.7}}>{text}</div>
        <button onClick={onClose} style={{width:"100%",marginTop:14,padding:"8px",background:"#f59e0b22",color:"#f59e0b",border:"1px solid #f59e0b55",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Ho capito</button>
      </div>
    </div>
  );
}

function HelpBtn({title,text}){
  const [open,setOpen]=useState(false);
  return(
    <>
      <button onClick={()=>setOpen(true)} style={{background:"transparent",border:"1px solid #f59e0b44",borderRadius:"50%",width:18,height:18,color:"#f59e0b88",fontSize:10,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",flexShrink:0}}>?</button>
      {open&&<InfoModal title={title} text={text} onClose={()=>setOpen(false)}/>}
    </>
  );
}

function TabGeneratoreUnificato() {
  const allDraws = useDraws();
  const series = useMemo(() => buildSeries(allDraws), [allDraws]);
  const sums = series.map(d => d.sum);
  const muReale = avg(sums), sigmaReale = std(sums);

  const [qty, setQty] = useState(5);
  const [numCandidati, setNumCandidati] = useState(200);
  const [rangeMode, setRangeMode] = useState("adattivo");
  const [customLo, setCustomLo] = useState(Math.round(muReale - sigmaReale));
  const [customHi, setCustomHi] = useState(Math.round(muReale + sigmaReale));
  const [wAdv, setWAdv] = useState(40);
  const [wEns, setWEns] = useState(35);
  const [wPair, setWPair] = useState(15);
  const [wDist, setWDist] = useState(10);

  const [loading, setLoading] = useState(false);
  const [results,setResults]=useState(()=>{try{const s=sessionStorage.getItem("se_unif_results");return s?JSON.parse(s):[];}catch{return [];}});
  const [advScoresRef,setAdvScoresRef]=useState(()=>{try{const s=sessionStorage.getItem("se_unif_adv");return s?JSON.parse(s):[];}catch{return [];}});
  const [selSS,setSelSS]=useState(()=>{try{const s=sessionStorage.getItem("se_unif_selss");return s?JSON.parse(s):{};}catch{return {};}});
  const [savedIds,setSavedIds]=useState(new Set());
  const [progress, setProgress] = useState("");

  const GEN_COLOR = "#f59e0b";

  const totalW = wAdv + wEns + wPair + wDist;
  const pAdv = Math.round(wAdv / totalW * 100);
  const pEns = Math.round(wEns / totalW * 100);
  const pPair = Math.round(wPair / totalW * 100);
  const pDist = 100 - pAdv - pEns - pPair;

  const loAdattivo = Math.round(muReale - sigmaReale * 1.5);
  const hiAdattivo = Math.round(muReale + sigmaReale * 1.5);

  const HELP = {
    generale: `Il Generatore Unificato è lo strumento principale dell'app.\n\nGenera migliaia di sestine candidate, le valuta con 4 modelli diversi e ti mostra solo le migliori secondo lo score finale.\n\nLo score NON è una probabilità di vincita — la probabilità è sempre 1 su 622 milioni per qualsiasi sestina.`,
    rangeSomma: `La somma dei 6 numeri di una sestina varia tipicamente tra 150 e 400.\n\n"Auto" usa il range suggerito dai modelli predittivi.\n"±1.5σ" è più largo e include più combinazioni possibili.\n"Custom" ti permette di impostare tu stesso il range.\n\nConsigli: parti con ±1.5σ per avere più varietà.`,
    candidati: `Quante sestine vengono generate e valutate prima di scegliere le migliori.\n\nPiù candidati = più scelta = score finale leggermente più alto, ma elaborazione più lenta.\n\n360 → veloce (5-10 secondi)\n1500 → completo (20-30 secondi)`,
    avanzato: `🧬 Avanzato — "Il numero è in ritardo?"\n\nAnalizza la storia di ogni numero: ogni quanto esce in media, quanto tempo è passato dall'ultima volta. Un numero che di solito esce ogni 15 estrazioni e manca da 30 riceve un punteggio alto.\n\nNon significa che "deve" uscire — la lotteria non ha memoria.`,
    predittivo: `🔬 Predittivo — "Il trend recente favorisce questo numero?"\n\nCombina 5 modelli: cicli storici, probabilità bayesiana, ritardo, correlazioni tra coppie, e trend delle ultime estrazioni (LSTM).\n\nDà un'indicazione su quali numeri sono statisticamente "attivi" nelle ultime settimane.`,
    coppie: `🔗 Coppie — "Questi numeri escono spesso insieme?"\n\nAnalizza quali coppie di numeri sono uscite insieme più volte del previsto nella storia della lotteria.\n\nSe 69 e 73 escono insieme 8 volte più del caso, una sestina che li contiene entrambi riceve un bonus.`,
    somma: `📐 Somma — "La somma totale è nel range previsto?"\n\nI modelli di regressione e LSTM stimano in quale range di somme cadrà la prossima estrazione.\n\nUna sestina con somma vicina a quella prevista riceve un punteggio più alto.\n\nPeso basso (10%) perché è il modello meno affidabile.`,
    score: `Lo score finale (0–100) è la media pesata dei 4 modelli.\n\nScore tipici sui dati reali:\n• 28–35: normale\n• 36–45: buono\n• 46–55: molto buono (raro)\n• 56+: eccellente (rarissimo)\n\nScore più alto non significa più probabilità di vincita — significa solo che la sestina soddisfa meglio i criteri statistici scelti.`,
  };

  const genera = () => {
    setLoading(true); setResults([]); setSelSS({}); setSavedIds(new Set());
    setProgress("⚙️ Calcolo modelli...");

    setTimeout(() => {
      const advScores = computeAdvancedScores(allDraws, muReale, sigmaReale);
      const ensembleScores = computeEnsemblePredictive(allDraws, muReale, sigmaReale);
      const pairData = computePairCorrelations(allDraws);
      const regression = computeRegression(allDraws);
      const lstm = computeLSTM(allDraws);

      setAdvScoresRef(advScores);

      let loB, hiB;
      if (rangeMode === "auto") {
        loB = Math.min(Math.round(muReale - sigmaReale), regression.predictedRange.lo, lstm.predictedRange.lo);
        hiB = Math.max(Math.round(muReale + sigmaReale), regression.predictedRange.hi, lstm.predictedRange.hi);
      } else if (rangeMode === "adattivo") {
        loB = loAdattivo; hiB = hiAdattivo;
      } else {
        loB = customLo; hiB = customHi;
      }

      const ritardi = Array.from({length: POOL}, (_, i) => {
        const num = i + 1;
        for (let j = allDraws.length - 1; j >= 0; j--) {
          if (allDraws[j].nums.includes(num)) return allDraws.length - 1 - j;
        }
        return allDraws.length;
      });

      setProgress(`🔮 ${numCandidati * 3} candidati...`);

      setTimeout(() => {
        const rng = mkRng(Date.now());
        const CAND = Math.round(numCandidati / 3);
        const allCandidates = [];
        const seenKeys = new Set();

        function genCandidates(weights, strategy, count) {
          const pool = Array.from({length: POOL}, (_, i) => i + 1);
          const tw = weights.reduce((a, b) => a + b, 0);
          const cumW = []; let acc = 0;
          weights.forEach(w => { acc += w; cumW.push(acc / tw); });
          function pick() { const r = rng(); for (let i = 0; i < cumW.length; i++) if (r <= cumW[i]) return pool[i]; return pool[pool.length-1]; }
          let sc = 0;
          while (allCandidates.filter(c => c.strategy === strategy).length < count && sc < 500000) {
            sc++;
            const nums = new Set(); let att = 0;
            while (nums.size < PICK && att < 100) { nums.add(pick()); att++; }
            if (nums.size < PICK) continue;
            const arr = [...nums].sort((a, b) => a - b);
            const s = arr.reduce((a, b) => a + b, 0);
            if (s < loB || s > hiB) continue;
            const key = arr.join(",");
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            allCandidates.push({ nums: arr, strategy });
          }
        }

        genCandidates(Array.from({length: POOL}, (_, i) => Math.max(0.05, (advScores.find(x=>x.num===i+1)?.unified||0)/100+0.3)), "adv", CAND);
        genCandidates(Array.from({length: POOL}, (_, i) => Math.max(0.05, (ensembleScores.find(x=>x.num===i+1)?.ensemble||0)/100+0.3)), "ens", CAND);
        genCandidates(Array.from({length: POOL}, (_, i) => { const a=advScores.find(x=>x.num===i+1)?.unified||0; const e=ensembleScores.find(x=>x.num===i+1)?.ensemble||0; return Math.max(0.05,(a+e)/200+0.3); }), "comb", CAND);

        setProgress("📊 Score finale...");

        setTimeout(() => {
          const scored = allCandidates.map(c => {
            const s = c.nums.reduce((a, b) => a + b, 0);
            const advMean = c.nums.reduce((acc,n)=>acc+(advScores.find(x=>x.num===n)?.unified||0),0)/c.nums.length;
            const advS = (advMean/100)*pAdv;
            const ensMean = c.nums.reduce((acc,n)=>acc+(ensembleScores.find(x=>x.num===n)?.ensemble||0),0)/c.nums.length;
            const ensS = (ensMean/100)*pEns;
            let pairB = 0;
            for(let i=0;i<c.nums.length;i++) for(let j=i+1;j<c.nums.length;j++){
              const p=pairData.topPairs.find(x=>x.nums[0]===c.nums[i]&&x.nums[1]===c.nums[j]);
              if(p) pairB+=Math.max(0,p.z);
            }
            const pairS = Math.min(pairB/10,1)*pPair;
            const distS = Math.max(0, pDist-Math.abs(s-regression.predicted)/Math.max(sigmaReale,1)*5);
            const total = advS+ensS+pairS+distS;
            const evens = c.nums.filter(n=>n%2===0).length;
            const ritMedio = Math.round(c.nums.reduce((acc,n)=>acc+ritardi[n-1],0)/c.nums.length);
            return {
              ...c, sum:s,
              total:parseFloat(total.toFixed(1)),
              advS:parseFloat(advS.toFixed(1)),
              ensS:parseFloat(ensS.toFixed(1)),
              pairS:parseFloat(pairS.toFixed(1)),
              distS:parseFloat(distS.toFixed(1)),
              zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2),
              evens, odds:PICK-evens, ritMedio,
              pairBonus:parseFloat(pairB.toFixed(2)),
              topSS:getSSSuggestions(allDraws,s,sigmaReale)[0]?.num||null,
            };
          });
          const finalResults=scored.sort((a,b)=>b.total-a.total).slice(0,qty);
          try{sessionStorage.setItem("se_unif_results",JSON.stringify(finalResults));}catch{}
          try{sessionStorage.setItem("se_unif_adv",JSON.stringify(advScores));}catch{}
          setResults(finalResults);
          setProgress(""); setLoading(false);
        }, 50);
      }, 50);
    }, 100);
  };

  const salvaBiglietto=async(r,idx)=>{
    const ss=selSS[idx]||r.topSS;
    const ticket={
      id:Date.now()+idx,nums:r.nums,superstar:ss,
      date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),
      concorso:allDraws[allDraws.length-1]?.n||0,
      strategy:"unificato",sum:r.sum,score:r.total||0,
    };
    await salvaTicketSE(ticket);
    setSavedIds(prev=>new Set([...prev,idx]));
    alert(`✅ Salvata!\n${r.nums.join("-")} | SS:${ss||"—"}`);
  };
  const strategyIcon = s => s==="adv"?"🧬":s==="ens"?"🔬":"⭐";
  const strategyLabel = s => s==="adv"?"Avanzato":s==="ens"?"Predittivo":"Combinato";

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <h2 style={{color:GEN_COLOR,fontFamily:"Georgia,serif",fontSize:16,margin:0}}>⭐ Generatore Unificato</h2>
        <HelpBtn title="⭐ Come funziona il Generatore Unificato" text={HELP.generale}/>
      </div>

      {/* PARAMETRI */}
      <div style={{background:"#1a0e00",border:`1px solid ${GEN_COLOR}44`,borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{color:GEN_COLOR,fontWeight:700,fontSize:11,marginBottom:12,letterSpacing:1}}>⚙️ PARAMETRI</div>

        {/* Range somma */}
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <span style={{color:C.dim,fontSize:10}}>Range somma</span>
            <HelpBtn title="Range somma" text={HELP.rangeSomma}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
            {[{v:"auto",l:"Auto"},{v:"adattivo",l:`±1.5σ [${loAdattivo}–${hiAdattivo}]`},{v:"custom",l:"Custom"}].map(r=>(
              <button key={r.v} onClick={()=>setRangeMode(r.v)} style={{background:rangeMode===r.v?`${GEN_COLOR}22`:"transparent",color:rangeMode===r.v?GEN_COLOR:C.dim,border:`1px solid ${rangeMode===r.v?GEN_COLOR:C.border}`,borderRadius:8,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{r.l}</button>
            ))}
          </div>
          {rangeMode==="custom"&&(<div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div><div style={{color:C.dim,fontSize:9,marginBottom:2}}>Min</div><input type="number" value={customLo} onChange={e=>setCustomLo(+e.target.value)} style={{width:60,background:"#0a0a1c",color:GEN_COLOR,border:`1px solid ${GEN_COLOR}55`,borderRadius:6,padding:"4px 6px",fontSize:12,fontFamily:"monospace",outline:"none"}}/></div>
            <span style={{color:C.dim,marginTop:14}}>–</span>
            <div><div style={{color:C.dim,fontSize:9,marginBottom:2}}>Max</div><input type="number" value={customHi} onChange={e=>setCustomHi(+e.target.value)} style={{width:60,background:"#0a0a1c",color:GEN_COLOR,border:`1px solid ${GEN_COLOR}55`,borderRadius:6,padding:"4px 6px",fontSize:12,fontFamily:"monospace",outline:"none"}}/></div>
          </div>)}
        </div>

        {/* Candidati */}
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <span style={{color:C.dim,fontSize:10}}>Candidati generati (×3 strategie)</span>
            <HelpBtn title="Numero di candidati" text={HELP.candidati}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[120,200,300,500].map(n=>(<button key={n} onClick={()=>setNumCandidati(n)} style={{background:numCandidati===n?`${GEN_COLOR}22`:"transparent",color:numCandidati===n?GEN_COLOR:C.dim,border:`1px solid ${numCandidati===n?GEN_COLOR:C.border}`,borderRadius:8,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{n*3}</button>))}
          </div>
        </div>

        {/* Pesi */}
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <span style={{color:C.dim,fontSize:10}}>Pesi score finale — totale: <strong style={{color:totalW===100?GEN_COLOR:C.red}}>{totalW}/100</strong></span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {l:"🧬 Avanzato",v:wAdv,set:setWAdv,c:"#22d3ee",help:"avanzato"},
              {l:"🔬 Predittivo",v:wEns,set:setWEns,c:"#e879f9",help:"predittivo"},
              {l:"🔗 Coppie",v:wPair,set:setWPair,c:C.orange,help:"coppie"},
              {l:"📐 Somma",v:wDist,set:setWDist,c:C.teal,help:"somma"},
            ].map(row=>(
              <div key={row.l}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{color:row.c,fontSize:9}}>{row.l}</span>
                    <HelpBtn title={row.l} text={HELP[row.help]}/>
                  </div>
                  <span style={{color:row.c,fontSize:9,fontWeight:700}}>{row.v}pt</span>
                </div>
                <input type="range" min={0} max={60} step={5} value={row.v} onChange={e=>row.set(+e.target.value)} style={{width:"100%",accentColor:row.c,cursor:"pointer"}}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risultati qty */}
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <span style={{color:C.dim,fontSize:11}}>Risultati:</span>
        {[3,5,10,15].map(n=>(<button key={n} onClick={()=>setQty(n)} style={{background:qty===n?`${GEN_COLOR}22`:"transparent",color:qty===n?GEN_COLOR:C.dim,border:`1px solid ${qty===n?GEN_COLOR:C.border}`,borderRadius:14,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>))}
      </div>

      <button onClick={genera} disabled={loading} style={{width:"100%",padding:"14px",background:loading?"#1a0e00":`linear-gradient(135deg,${GEN_COLOR},#d97706)`,color:loading?"#555":"#000",border:"none",borderRadius:10,fontSize:16,fontWeight:900,cursor:loading?"not-allowed":"pointer",fontFamily:"Georgia,serif",marginBottom:12}}>
        {loading?progress||"⏳ Elaborazione...":"⭐ Genera Sestine Ottimali"}
      </button>

      {results.length>0&&(
        <>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
            <span style={{color:C.dim,fontSize:11}}><strong style={{color:GEN_COLOR}}>{results.length} migliori</strong> su {numCandidati*3} candidate · pesi: 🧬{pAdv}% 🔬{pEns}% 🔗{pPair}% 📐{pDist}%</span>
            <HelpBtn title="Score finale" text={HELP.score}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {results.map((r,i)=>{
              const isBest=i===0;
              const top3SS=getSSSuggestions(allDraws,r.sum,sigmaReale).slice(0,3);
              const chosenSS=selSS[i]||r.topSS;
              const isSaved=savedIds.has(i);
              const scoreColor=r.total>=70?"#FFD700":r.total>=55?C.green:r.total>=40?C.teal:C.orange;
              return(
                <div key={i} style={{background:"#080810",border:`2px solid ${isBest?`${GEN_COLOR}88`:`${GEN_COLOR}22`}`,borderLeft:`4px solid ${scoreColor}`,borderRadius:12,padding:"14px",position:"relative"}}>
                  {isBest&&<div style={{position:"absolute",top:-10,left:14,background:GEN_COLOR,color:"#000",fontSize:9,fontWeight:900,padding:"2px 10px",borderRadius:10}}>🏆 MIGLIORE</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:GEN_COLOR,fontFamily:"monospace",fontSize:11}}>#{i+1}</span>
                      <span style={{background:`${scoreColor}22`,color:scoreColor,borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:900}}>Score {r.total}/100</span>
                      <span style={{background:"#1a1a2a",color:C.dim,borderRadius:5,padding:"2px 7px",fontSize:9}}>{strategyIcon(r.strategy)} {strategyLabel(r.strategy)}</span>
                    </div>
                    <div style={{background:"#0a0a18",borderRadius:6,height:8,width:100,overflow:"hidden"}}>
                      <div style={{background:`linear-gradient(90deg,${scoreColor},${GEN_COLOR})`,height:"100%",width:`${r.total}%`}}/>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:10}}>
                    {[{l:"🧬",v:r.advS,max:pAdv,c:"#22d3ee"},{l:"🔬",v:r.ensS,max:pEns,c:"#e879f9"},{l:"🔗",v:r.pairS,max:pPair,c:C.orange},{l:"📐",v:r.distS,max:pDist,c:C.teal}].map(row=>(
                      <div key={row.l} style={{background:"#0a0a18",borderRadius:6,padding:"5px 4px",textAlign:"center"}}>
                        <div style={{fontSize:10,marginBottom:1}}>{row.l}</div>
                        <div style={{color:row.c,fontFamily:"monospace",fontSize:12,fontWeight:900}}>{row.v.toFixed(0)}</div>
                        <div style={{background:"#050510",borderRadius:2,height:3,overflow:"hidden",marginTop:2}}><div style={{background:row.c,height:"100%",width:`${row.max>0?(row.v/row.max)*100:0}%`}}/></div>
                        <div style={{color:C.dim,fontSize:7,marginTop:1}}>/{row.max}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
                    {r.nums.map(n=>{
                      const advRank=advScoresRef.findIndex(x=>x.num===n);
                      const col=advRank>=0&&advRank<10?"#FFD700":advRank<25?C.teal:GEN_COLOR;
                      return <Ball key={n} num={n} color={col} size={38} glow={advRank>=0&&advRank<10}/>;
                    })}
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                    <span style={{background:`${GEN_COLOR}22`,color:GEN_COLOR,borderRadius:5,padding:"2px 8px",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Σ {r.sum}</span>
                    <span style={{background:"#12122a",color:C.dim,borderRadius:5,padding:"2px 8px",fontSize:10}}>{r.evens}P–{r.odds}D</span>
                    <span style={{background:"#12122a",color:Math.abs(parseFloat(r.zScore))<1?C.green:C.orange,borderRadius:5,padding:"2px 8px",fontSize:10}}>z={r.zScore}</span>
                    <span style={{background:`${C.teal}22`,color:C.teal,borderRadius:5,padding:"2px 8px",fontSize:10}}>rit.medio {r.ritMedio}</span>
                    {r.pairBonus>0&&<span style={{background:`${C.orange}22`,color:C.orange,borderRadius:5,padding:"2px 8px",fontSize:10}}>coppie +{r.pairBonus.toFixed(1)}</span>}
                  </div>
                  <div style={{background:"#0a0810",border:"1px solid #FFD70022",borderRadius:10,padding:10,marginBottom:10}}>
                    <div style={{color:"#FFD700",fontSize:10,fontWeight:700,marginBottom:8}}>⭐ SuperStar consigliato</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                      {top3SS.map((s,si)=>{
                        const isCho=chosenSS===s.num;
                        return(<div key={s.num} onClick={()=>setSelSS(prev=>({...prev,[i]:s.num}))} style={{textAlign:"center",cursor:"pointer",padding:"6px 8px",background:isCho?"#FFD70018":"#0e0e1c",border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,borderRadius:8,boxShadow:isCho?"0 0 10px #FFD70044":"none"}}>
                          <Ball num={s.num} size={28} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho}/>
                          <div style={{color:isCho?"#FFD700":si===0?"#E8B84B":"#888",fontSize:9,marginTop:3,fontWeight:700}}>{s.pct}%</div>
                          <div style={{color:C.dim,fontSize:8}}>r.{s.ritardo}</div>
                        </div>);
                      })}
                      <div style={{display:"flex",alignItems:"center",paddingLeft:8,borderLeft:"1px solid #222",gap:6}}>
                        <Ball num={chosenSS||"?"} size={32} gold={!!chosenSS} color={chosenSS?"#FFD700":"#444"} glow={!!chosenSS}/>
                        <span style={{color:"#FFD700",fontFamily:"monospace",fontWeight:700,fontSize:14}}>{chosenSS||"—"}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={()=>salvaBiglietto(r,i)} disabled={isSaved} style={{width:"100%",padding:"10px",background:isSaved?`${C.green}22`:`linear-gradient(135deg,${GEN_COLOR},#d97706)`,color:isSaved?C.green:"#000",border:`2px solid ${isSaved?C.green:GEN_COLOR}`,borderRadius:10,fontSize:13,fontWeight:700,cursor:isSaved?"default":"pointer",fontFamily:"inherit"}}>
                    {isSaved?"✅ Salvata in Biglietti":"💾 Salva in Biglietti"}
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:14,fontSize:9,color:"#333",lineHeight:1.8,borderTop:"1px solid #111",paddingTop:10}}>
            Score finale normalizzato ai pesi scelti. Nessun potere predittivo.
          </div>
        </>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// PATCH 1: Sostituisci TabBiglietti con questa versione
// che legge/scrive su Supabase
// ═══════════════════════════════════════════════════════════════

function TabBiglietti(){
  const allDraws=useDraws();
  const [tickets,setTickets]=useState([]);
  const [loadingTickets,setLoadingTickets]=useState(true);
  const [expanded,setExpanded]=useState(null);
  const [confirmDel,setConfirmDel]=useState(null);
  const [maxSestine,setMaxSestine]=useState(5);

  // Carica biglietti da Supabase + localStorage
  const loadTickets=async()=>{
    setLoadingTickets(true);
    try{
      const {data,error}=await supabase.from("tickets").select("*").eq("lotteria","superenalotto").order("created_at",{ascending:false});
      if(error) throw error;
      const dbTickets=data.map(r=>({
        id:r.id,nums:r.nums,superstar:r.bonus?r.bonus[0]||null:null,
        date:r.data_gioco||"",concorso:r.concorso||0,
        strategy:r.strategy||"",sum:r.somma||0,fromDb:true,giocato:r.giocato||false,inSistema:r.in_sistema||false,score:r.score||0,
      }));
      // Merge con localStorage (biglietti locali non ancora su DB)
      const local=JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");
      const dbIds=new Set(dbTickets.map(t=>String(t.id)));
      const localOnly=local.filter(t=>!dbIds.has(String(t.id)));
      setTickets([...dbTickets,...localOnly]);
    }catch(err){
      console.error("Tickets load error:",err);
      // Fallback a localStorage
      try{setTickets(JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]"));}catch{}
    }finally{setLoadingTickets(false);}
  };

  useEffect(()=>{loadTickets();},[]);

  const toggleGiocato=async(id,current)=>{
    try{await supabase.from("tickets").update({giocato:!current}).eq("id",id);}catch{}
    setTickets(prev=>prev.map(t=>t.id===id?{...t,giocato:!current}:t));
  };
  const toggleInSistema=async(id,current)=>{
    try{await supabase.from("tickets").update({in_sistema:!current}).eq("id",id);}catch{}
    setTickets(prev=>prev.map(t=>t.id===id?{...t,inSistema:!current}:t));
  };
  const remove=async(id)=>{
    try{await supabase.from("tickets").delete().eq("id",id);}catch{}
    const local=JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");
    localStorage.setItem(LS_TICKETS_S,JSON.stringify(local.filter(t=>t.id!==id)));
    setTickets(prev=>prev.filter(t=>t.id!==id));
    setConfirmDel(null);setExpanded(null);
  };

  function getResults(ticket){
    const fromN=ticket.concorso||0;
    return allDraws.filter(d=>(d.n||0)>fromN).map(d=>{
      const matches=d.nums.filter(n=>ticket.nums.includes(n));
      return{n:d.n,date:d.date,nums:d.nums,superstar:d.superstar,pts:matches.length,matches};
    });
  }

  if(loadingTickets) return(
    <div style={{textAlign:"center",padding:40,color:C.dim}}>
      <div style={{fontSize:24,marginBottom:8}}>⏳</div>
      <div>Caricamento biglietti...</div>
    </div>
  );

  return(
    <div>
      <h2 style={{color:C.purple,fontFamily:"Georgia,serif",fontSize:16,marginBottom:4}}>🎫 Biglietti Giocati</h2>
      <div style={{background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:8,padding:"6px 12px",marginBottom:12,fontSize:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:C.teal}}>🔗 Supabase — sincronizzati su tutti i dispositivi</span>
        <button onClick={loadTickets} style={{background:"transparent",color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>↻ Aggiorna</button>
      </div>
      <p style={{color:C.dim,fontSize:11,marginBottom:16,lineHeight:1.7}}>
        {tickets.length} biglietti · confronto automatico con {allDraws.length} estrazioni.
      </p>
      {tickets.length===0&&(
        <div style={{textAlign:"center",color:C.dim,padding:"28px 0",fontSize:13,background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>
          Nessun biglietto.<br/><span style={{fontSize:11}}>Genera nel tab 🎯 e premi 💾 Salva.</span>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {tickets.map(ticket=>{
          const results=getResults(ticket);
          const bestPts=results.length?Math.max(...results.map(r=>r.pts)):0;
          const bestCol=PRIZE_COLORS[Math.min(bestPts,6)]||C.dim;
          const isOpen=expanded===ticket.id;
          const pendingDel=confirmDel===ticket.id;
          return(
            <div key={ticket.id} style={{background:C.card,border:`2px solid ${pendingDel?"#C94040":bestPts>=2?bestCol:C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",cursor:"pointer"}} onClick={()=>{if(!pendingDel)setExpanded(isOpen?null:ticket.id);}}>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                  {ticket.nums.map(n=>{const hitAny=results.some(r=>r.matches.includes(n));return<Ball key={n} num={n} color={hitAny?bestCol:ACCENT} size={30} glow={hitAny&&bestPts>=2}/>;})}
                  {typeof ticket.superstar==="number"&&<><span style={{color:C.dim,fontSize:14,alignSelf:"center"}}>│</span><Ball num={ticket.superstar} size={28} gold/><span style={{color:"#FFD700",fontSize:8}}>SS</span></>}
                </div>
                <div style={{flex:1,minWidth:120}}>
                  <div style={{color:C.dim,fontSize:10}}>
                    {ticket.date} · dopo #{ticket.concorso||"?"} · Σ={ticket.sum||sm(ticket.nums)}
                    {(()=>{
                      const s=ticket.sum||sm(ticket.nums);
                      const evens=ticket.nums.filter(n=>n%2===0).length;
                      const z=zOf(s,MU_TEO,SIGMA_TEO);
                      const ritMedio=Math.round(ticket.nums.reduce((acc,n)=>{let r=allDraws.length;for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].nums.includes(n)){r=allDraws.length-1-i;break;}}return acc+r;},0)/ticket.nums.length);
                      return(<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
                        <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:4,padding:"1px 6px",fontSize:8,fontFamily:"monospace"}}>Σ{s}</span>
                        <span style={{background:"#12122a",color:Math.abs(z)<1?C.green:Math.abs(z)<2?C.orange:C.red,borderRadius:4,padding:"1px 6px",fontSize:8}}>z={z.toFixed(2)}</span>
                        <span style={{background:"#12122a",color:C.dim,borderRadius:4,padding:"1px 6px",fontSize:8}}>{evens}P–{ticket.nums.length-evens}D</span>
                        <span style={{background:`${C.teal}22`,color:C.teal,borderRadius:4,padding:"1px 6px",fontSize:8}}>rit.{ritMedio}</span>{ticket.score>0&&<span style={{background:"#FFD70022",color:"#FFD700",borderRadius:4,padding:"1px 6px",fontSize:8,fontWeight:700}}>score {ticket.score}</span>}
                      </div>);
                    })()}
                    {ticket.strategy&&<span style={{marginLeft:6,background:`${C.purple}22`,color:C.purple,borderRadius:4,padding:"1px 5px",fontSize:9}}>{ticket.strategy}</span>}
                    {ticket.fromDb&&<span style={{marginLeft:4,color:C.teal,fontSize:8}}>☁️</span>}
                    <button onClick={e=>{e.stopPropagation();toggleGiocato(ticket.id,ticket.giocato);}} style={{marginLeft:6,background:ticket.giocato?"#4A9E5C22":"#1a1a2e",color:ticket.giocato?C.green:C.dim,border:`1px solid ${ticket.giocato?C.green:C.border}`,borderRadius:6,padding:"1px 7px",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{ticket.giocato?"✅ Giocato":"📋 Non giocato"}</button>
<button onClick={e=>{e.stopPropagation();toggleInSistema(ticket.id,ticket.inSistema);}} style={{marginLeft:4,background:ticket.inSistema?"#4A8FD422":"#1a1a2e",color:ticket.inSistema?"#4A8FD4":C.dim,border:`1px solid ${ticket.inSistema?"#4A8FD4":C.border}`,borderRadius:6,padding:"1px 7px",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{ticket.inSistema?"🎰 In Sistema":"➕ Sistema"}</button>
                  </div>
                  {results.length>0?(
                    <div style={{color:bestPts>=2?bestCol:C.dim,fontWeight:700,fontSize:12}}>
                      {bestPts>=2?`🎯 ${PRIZE_LABELS[Math.min(bestPts,6)]} — max ${bestPts}✓`:`Nessun punto`}
                    </div>
                  ):<div style={{color:C.dim,fontSize:11}}>⏳ In attesa</div>}
                </div>
                {bestPts>=2&&!pendingDel&&(
                  <div style={{background:`${bestCol}22`,border:`2px solid ${bestCol}`,borderRadius:8,padding:"5px 10px",textAlign:"center"}}>
                    <div style={{color:bestCol,fontSize:20,fontWeight:900,fontFamily:"monospace"}}>{bestPts}</div>
                    <div style={{color:bestCol,fontSize:8}}>punti</div>
                  </div>
                )}
                <span style={{color:C.dim}}>{isOpen&&!pendingDel?"▲":"▼"}</span>
              </div>
              {pendingDel&&(
                <div style={{background:"#1a0606",borderTop:"1px solid #C94040",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{color:"#C94040",fontSize:12,fontWeight:700,flex:1}}>🗑 Confermi eliminazione?</span>
                  <button onClick={()=>remove(ticket.id)} style={{background:"#C94040",color:"#fff",border:"none",borderRadius:7,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Sì</button>
                  <button onClick={()=>setConfirmDel(null)} style={{background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>No</button>
                </div>
              )}
              {isOpen&&!pendingDel&&(
                <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 14px",background:"#06060e"}}>
                  {results.length===0?(
                    <div style={{color:C.dim,fontSize:12,textAlign:"center"}}>⏳ Nessuna estrazione successiva.</div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {results.map(r=>{
                        const col=PRIZE_COLORS[Math.min(r.pts,6)]||C.dim;
                        const hasPts=r.pts>0;
                        return(
                          <div key={r.n} style={{background:r.pts>=2?`${col}10`:hasPts?`${col}08`:"#07070f",border:`1px solid ${r.pts>=2?col:hasPts?col+"66":C.border}`,borderRadius:8,padding:"8px 12px"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6,marginBottom:6}}>
                              <span style={{color:C.dim,fontSize:11}}>Est. <strong style={{color:ACCENT}}>#{r.n}</strong> · {r.date?.substring(0,5)||""}</span>
                              <span style={{color:col,fontWeight:700,fontSize:12}}>{PRIZE_LABELS[Math.min(r.pts,6)]}</span>
                            </div>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                              {r.nums.map(n=>{
                                const hit=ticket.nums.includes(n);
                                return(
                                  <div key={n} style={{position:"relative"}}>
                                    <Ball num={n} color={hit?col:"#2a2a3a"} size={28} glow={hit&&r.pts>=2}/>
                                    {hit&&<div style={{position:"absolute",top:-3,right:-3,width:9,height:9,borderRadius:"50%",background:col,border:"1px solid #06060e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:6,color:"#000",fontWeight:900}}>✓</div>}
                                  </div>
                                );
                              })}
                            </div>
                            {r.matches.length>0&&(
                              <div style={{background:`${col}15`,borderRadius:5,padding:"4px 10px",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginTop:6}}>
                                <span style={{color:col,fontSize:10,fontWeight:700}}>✓ Indovinati:</span>
                                <div style={{display:"flex",gap:4}}>
                                  {r.matches.map(n=><span key={n} style={{background:`${col}33`,border:`1px solid ${col}`,borderRadius:4,padding:"1px 6px",color:col,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{n}</span>)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button onClick={()=>setConfirmDel(ticket.id)} style={{background:"transparent",color:"#C94040",border:"1px solid #C9404033",borderRadius:8,padding:"6px 14px",fontSize:11,cursor:"pointer",marginTop:12}}>🗑 Elimina</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {tickets.filter(t=>t.inSistema).length>=2&&(()=>{
        const candidati=tickets.filter(t=>t.inSistema);
        
        const series=buildSeries(allDraws);
        const sums=series.map(d=>d.sum);
        const muReale=avg(sums),sigmaReale=std(sums);
        const advScores=computeAdvancedScores(allDraws,muReale,sigmaReale);
        const scored=candidati.map(t=>{
          const advMean=t.nums.reduce((acc,n)=>{const a=advScores.find(x=>x.num===n);return acc+(a?a.unified:0);},0)/t.nums.length;
          return {...t,advScore:advMean};
        });
        function diversity(a,b){return 1-a.nums.filter(n=>b.nums.includes(n)).length/PICK;}
        function selectOptimal(pool,k){
          const selected=[];const remaining=[...pool].sort((a,b)=>b.advScore-a.advScore);
          selected.push(remaining.shift());
          while(selected.length<k&&remaining.length>0){
            let bestIdx=0,bestScore=-Infinity;
            remaining.forEach((c,i)=>{const divScore=selected.reduce((a,s)=>a+diversity(c,s),0)/selected.length;const combined=c.advScore*0.5+divScore*50*0.5;if(combined>bestScore){bestScore=combined;bestIdx=i;}});
            selected.push(remaining.splice(bestIdx,1)[0]);
          }
          return selected;
        }
        const optimal=selectOptimal(scored,Math.min(maxSestine,candidati.length));
        const totalNums=[...new Set(optimal.flatMap(t=>t.nums))];
        return(<div style={{marginTop:24,background:"#080816",border:"2px solid #4A8FD4",borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{color:"#4A8FD4",fontWeight:700,fontSize:14,marginBottom:4,fontFamily:"Georgia,serif"}}>🎰 Sistema Ottimale</div>
          <div style={{color:C.dim,fontSize:10,marginBottom:12}}>{candidati.length} biglietti candidati · {totalNums.length} numeri distinti coperti</div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
            <span style={{color:C.dim,fontSize:11}}>Max sestine:</span>
            {[2,3,4,5,6,7,8,10].map(n=>(<button key={n} onClick={()=>setMaxSestine(n)} style={{background:maxSestine===n?"#4A8FD422":"transparent",color:maxSestine===n?"#4A8FD4":C.dim,border:`1px solid ${maxSestine===n?"#4A8FD4":C.border}`,borderRadius:8,padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            {optimal.map((t,i)=>{
              const divMedia=optimal.filter((_,j)=>j!==i).reduce((a,o)=>a+diversity(t,o),0)/Math.max(optimal.length-1,1);
              return(<div key={t.id} style={{background:"#0a0a18",border:"1px solid #4A8FD444",borderRadius:10,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{color:"#4A8FD4",fontFamily:"monospace",fontSize:11}}>#{i+1}</span>
                  {t.nums.map(n=><Ball key={n} num={n} color="#4A8FD4" size={32} glow/>)}
                  {typeof t.superstar==="number"&&<><span style={{color:C.dim}}>│</span><Ball num={t.superstar} size={30} gold/><span style={{color:"#FFD700",fontSize:8}}>SS</span></>}
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{background:"#4A8FD422",color:"#4A8FD4",borderRadius:4,padding:"2px 8px",fontSize:9,fontFamily:"monospace"}}>Σ {t.sum}</span>
                  <span style={{background:C.purple+"22",color:C.purple,borderRadius:4,padding:"2px 8px",fontSize:9}}>{t.strategy}</span>
                  <span style={{background:C.teal+"22",color:C.teal,borderRadius:4,padding:"2px 8px",fontSize:9}}>score {t.advScore.toFixed(0)}</span>
                  <span style={{background:C.orange+"22",color:C.orange,borderRadius:4,padding:"2px 8px",fontSize:9}}>div {(divMedia*100).toFixed(0)}%</span>
                </div>
              </div>);
            })}
          </div>
          <div style={{background:"#0a0a18",borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{color:"#4A8FD4",fontSize:10,fontWeight:700,marginBottom:6}}>📊 Numeri coperti ({totalNums.length}/90)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>{totalNums.sort((a,b)=>a-b).map(n=><Ball key={n} num={n} color="#4A8FD4" size={24}/>)}</div>
          </div>
          <button onClick={async()=>{for(const t of optimal){await supabase.from("tickets").update({giocato:true}).eq("id",t.id);}setTickets(prev=>prev.map(t=>optimal.find(o=>o.id===t.id)?{...t,giocato:true}:t));alert(`✅ ${optimal.length} sestine marcate come Giocato!`);}} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#4A8FD4,#2BA89A)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✅ Segna tutte come Giocato</button>
        </div>);
      })()}
      {tickets.length>0&&(()=>{
        const strategies=["tattico","suggeritore","unificato","predittivo","auto"];
        const stratColors={"tattico":"#FF6B35","suggeritore":"#a78bfa","unificato":"#f59e0b","predittivo":"#e879f9","auto":ACCENT};
  const stratIcons={"tattico":"⚡","suggeritore":"🔮","unificato":"⭐","predittivo":"🔬","auto":"🤖"};
  const ticketsWithPts=tickets.map(ticket=>{const fromN=ticket.concorso||0;const draws=allDraws.filter(d=>(d.n||0)>fromN);const maxPts=draws.length>0?Math.max(...draws.map(d=>d.nums.filter(n=>ticket.nums.includes(n)).length)):0;return {...ticket,maxPts,hasResult:draws.length>0};});
  const calcStats=(group)=>{if(group.length===0)return null;const avgPts=group.reduce((a,t)=>a+t.maxPts,0)/group.length;const best=Math.max(...group.map(t=>t.maxPts));const with2plus=group.filter(t=>t.maxPts>=2).length;const with3plus=group.filter(t=>t.maxPts>=3).length;const score=Math.round((avgPts/6)*40+(with2plus/group.length)*40+(best/6)*20);return{count:group.length,avgPts:avgPts.toFixed(2),best,with2plus,with3plus,score};};
  const stratStats={};
  strategies.forEach(s=>{const all=ticketsWithPts.filter(t=>(t.strategy||"auto")===s&&t.hasResult);const giocati=all.filter(t=>t.giocato);const nonGiocati=all.filter(t=>!t.giocato);if(all.length===0)return;stratStats[s]={...calcStats(all),giocati:calcStats(giocati),nonGiocati:calcStats(nonGiocati)};});
  const sorted=Object.entries(stratStats).sort((a,b)=>b[1].score-a[1].score);
  if(sorted.length===0)return null;
  const maxScore=sorted[0][1].score||1;
  return(<div style={{marginTop:24,background:C.card,border:`1px solid ${ACCENT}33`,borderRadius:12,padding:16}}>
    <div style={{color:ACCENT,fontWeight:700,fontSize:14,marginBottom:4,fontFamily:"Georgia,serif"}}>📊 Performance Strategie</div>
    <div style={{color:C.dim,fontSize:10,marginBottom:16,lineHeight:1.6}}>Score composito basato su punti medi, % biglietti con ≥2 punti e miglior risultato. Aggiornato ad ogni estrazione inserita.</div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {sorted.map(([s,st],idx)=>{const col=stratColors[s]||ACCENT;const icon=stratIcons[s]||"🎯";const isFirst=idx===0;const barW=Math.round((st.score/maxScore)*100);return(<div key={s} style={{background:isFirst?`${col}11`:"#080816",border:`2px solid ${isFirst?col:col+"44"}`,borderRadius:10,padding:"12px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}><span style={{fontSize:16}}>{icon}</span><span style={{color:col,fontWeight:700,fontSize:13,textTransform:"capitalize"}}>{s}</span>{isFirst&&<span style={{background:col,color:"#000",fontSize:9,fontWeight:900,padding:"2px 8px",borderRadius:10}}>🏆 MIGLIORE</span>}</div>
          <div style={{background:`${col}22`,border:`2px solid ${col}`,borderRadius:8,padding:"4px 12px",textAlign:"center"}}><div style={{color:col,fontSize:18,fontWeight:900,fontFamily:"monospace"}}>{st.score}</div><div style={{color:col,fontSize:8}}>score</div></div>
        </div>
        <div style={{background:"#0a0a18",borderRadius:4,height:8,overflow:"hidden",marginBottom:10}}><div style={{background:`linear-gradient(90deg,${col},${col}88)`,height:"100%",width:`${barW}%`}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
          {[{label:"✅ Giocati",data:st.giocati,col:C.green},{label:"📋 Non giocati",data:st.nonGiocati,col:C.dim}].map(({label,data,col:dc})=>(
            <div key={label} style={{background:"#0a0a18",borderRadius:8,padding:"8px 10px"}}>
              <div style={{color:dc,fontSize:10,fontWeight:700,marginBottom:6}}>{label}</div>
              {data?(<>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                  {[{l:"Biglietti",v:data.count},{l:"Media pt",v:data.avgPts},{l:"Miglior",v:`${data.best}pt`},{l:"Con 2+",v:`${data.with2plus}/${data.count}`}].map(x=>(<div key={x.l} style={{background:"#050510",borderRadius:4,padding:"4px 6px",textAlign:"center"}}><div style={{color:C.dim,fontSize:7}}>{x.l}</div><div style={{color:dc,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{x.v}</div></div>))}
                </div>
              </>):(<div style={{color:C.dim,fontSize:10,textAlign:"center",padding:"8px 0"}}>—</div>)}
            </div>
          ))}
        </div>
      </div>);})}
    </div>
    <div style={{marginTop:12,color:C.dim,fontSize:9,lineHeight:1.7,borderTop:`1px solid ${C.border}`,paddingTop:10}}>Score = media punti (40%) + % biglietti con ≥2 punti (40%) + miglior risultato (20%). Solo biglietti con almeno un'estrazione successiva.</div>
  </div>);
})()}
      {tickets.length>0&&(
        <div style={{marginTop:14,display:"flex",gap:8,alignItems:"center"}}>
          <span style={{color:C.dim,fontSize:10}}>{tickets.length} biglietti totali</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PATCH 2: Funzione helper per salvare biglietto su Supabase
// Sostituisce il salvataggio localStorage in tutti i tab
// Incolla questa funzione dopo TabBiglietti e prima di TABS
// ═══════════════════════════════════════════════════════════════

async function salvaTicketSE(ticket){
  // Salva su localStorage come backup
  const prev=JSON.parse(localStorage.getItem(LS_TICKETS_S)||"[]");
  const exists=prev.some(t=>t.id===ticket.id);
  if(!exists) localStorage.setItem(LS_TICKETS_S,JSON.stringify([...prev,ticket]));
  // Salva su Supabase
  try{
    const {error}=await supabase.from("tickets").upsert({
      id:ticket.id,
      lotteria:"superenalotto",
      nums:ticket.nums,
      bonus:ticket.superstar?[ticket.superstar]:null,
      data_gioco:ticket.date,
      concorso:ticket.concorso,
      strategy:ticket.strategy,
      somma:ticket.sum,
      score:ticket.score||0,
    });
    if(error) throw error;
    return true;
  }catch(err){
    console.error("Ticket save error:",err);
    return false;
  }
}
const TABS=[
  {id:"animazione",icon:"📈",label:"Animazione"},
  {id:"segnali",icon:"🔬",label:"Segnali & Freq."},
  {id:"banda",icon:"📐",label:"Banda Adattiva"},
  {id:"generatore",icon:"🎯",label:"Generatore"},
  {id:"suggeritore",icon:"🔮",label:"Suggeritore"},
  {id:"analisi",icon:"🧬",label:"Analisi"},
  {id:"predittivo",icon:"🔬",label:"Predittivo"},
  {id:"unificato",icon:"⭐",label:"Unificato"},
  {id:"confronto",icon:"🔁",label:"Confronto"},
  {id:"estrazioni",icon:"📥",label:"Estrazioni"},
  {id:"biglietti",icon:"🎫",label:"Biglietti"},
];

export default function App(){
  const [tab,setTab]=useState("animazione");
  const [dbDraws,setDbDraws]=useState([]);
  const [loading,setLoading]=useState(true);
  const [extraDraws,setExtraDraws]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_KEY_S)||"[]");}catch{return [];}});

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
        <div style={{display:"flex",gap:2,marginBottom:16,overflowX:"auto",paddingBottom:4,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100,background:C.bg,paddingTop:8}}>
          {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?`linear-gradient(135deg,${t.id==="biglietti"?C.purple:t.id==="suggeritore"?"#a78bfa":t.id==="predittivo"?"#e879f9":t.id==="unificato"?"#f59e0b":ACCENT},#2BA89A)`:"transparent",color:tab===t.id?"#fff":C.dim,border:tab===t.id?"none":`1px solid ${C.border}`,borderRadius:20,padding:"7px 10px",fontSize:10,fontWeight:tab===t.id?700:400,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{t.icon} {t.label}</button>))}
        </div>
        <div style={{display:tab==="animazione"?"block":"none"}}><TabAnimazione/></div>
        <div style={{display:tab==="segnali"?"block":"none"}}><TabSegnali/></div>
        <div style={{display:tab==="banda"?"block":"none"}}><TabBanda/></div>
        <div style={{display:tab==="generatore"?"block":"none"}}><TabGeneratore/></div>
        <div style={{display:tab==="suggeritore"?"block":"none"}}><TabSuggeritore/></div>
        <div style={{display:tab==="analisi"?"block":"none"}}><TabAnalisiAvanzata/></div>
        <div style={{display:tab==="predittivo"?"block":"none"}}><TabPredittivo/></div>
        <div style={{display:tab==="unificato"?"block":"none"}}><TabGeneratoreUnificato/></div>
        <div style={{display:tab==="confronto"?"block":"none"}}><TabConfronto/></div>
        <div style={{display:tab==="estrazioni"?"block":"none"}}><TabEstrazioni onUpdate={handleUpdate}/></div>
        <div style={{display:tab==="biglietti"?"block":"none"}}><TabBiglietti/></div>
        <div style={{marginTop:24,background:"#070712",border:"1px solid #111122",borderRadius:10,padding:12}}>
          <div style={{color:"#353545",fontSize:10,lineHeight:1.7}}>⚠️ Strumento puramente statistico — nessun potere predittivo. Il gioco può causare dipendenza. Vietato ai minori di 18 anni. Dati storici: {allDraws.length} estrazioni (2024–2026).</div>
        </div>
      </div>
    </div>
    </DrawsContext.Provider>
  );
}
