import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { ComposedChart, LineChart, BarChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Area, Legend } from "recharts";
import { supabase } from '../lib/supabase';

const MU_TEO=127.5, SIGMA_TEO=30, JACKPOT="~120.000.000 €", ACCENT="#F07030";
const POOL=50, PICK=5, BONUS_POOL=12, BONUS_COUNT=2;
const POPULAR=new Set([1,2,3,4,5,10,20,30,40,50]);
const LS_KEY_EJ="draws_eurojackpot_v1", LS_TICKETS_EJ="tickets_eurojackpot_v1";

const DrawsContext=createContext([]);
const useDraws=()=>useContext(DrawsContext);
const PRIZE_LABELS={0:"–",1:"–",2:"Punto 2",3:"Punto 3",4:"Punto 4",5:"🏆 PUNTI 5!"};
const PRIZE_COLORS={0:"#4A4A6A",1:"#4A4A6A",2:"#4A8FD4",3:"#2BA89A",4:"#E8B84B",5:"#C94040"};

const sm=a=>a.reduce((s,v)=>s+v,0);
const avg=a=>sm(a)/a.length;
const std=a=>{const m=avg(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length);};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const zOf=(v,mu,sigma)=>(v-mu)/sigma;

function mkRng(seed){let s=seed>>>0;return()=>{s=Math.imul(s^s>>>15,s|1);s^=s+Math.imul(s^s>>>7,s|61);return((s^s>>>14)>>>0)/4294967296;};}

function buildSeries(draws){
  return draws.map((d,i)=>{
    const s=sm(d.nums),sl=draws.slice(0,i+1).map(x=>sm(x.nums)),rm=avg(sl);
    const ma5=i>=4?avg(draws.slice(i-4,i+1).map(x=>sm(x.nums))):null;
    return {...d,sum:s,mu:parseFloat(rm.toFixed(2)),delta:parseFloat((s-MU_TEO).toFixed(1)),zScore:parseFloat(zOf(s,MU_TEO,SIGMA_TEO).toFixed(3)),ma5};
  });
}

function scoreNumbers(draws,winSize){
  const w=draws.slice(-winSize),expFreq=w.length*PICK/POOL,sigma=Math.sqrt(expFreq*(1-PICK/POOL));
  const freq=Array(POOL+1).fill(0);w.forEach(d=>d.nums.forEach(n=>freq[n]++));
  return Array.from({length:POOL},(_,i)=>{const num=i+1,f=freq[num],z=(f-expFreq)/sigma;const unpop=POPULAR.has(num)?0.35:(num>Math.floor(POOL*0.35)?1.3:1.0);return {num,f,z,score:Math.abs(z)*unpop,isCold:z<-0.4,isHot:z>0.4};});
}

function generateBonus(seed){
  const rng=mkRng(seed+55555);const pool=Array.from({length:BONUS_POOL},(_,i)=>i+1);const picked=[];
  while(picked.length<BONUS_COUNT){const idx=Math.floor(rng()*pool.length);picked.push(pool.splice(idx,1)[0]);}
  return picked.sort((a,b)=>a-b);
}

function generateTicket(scored,strategy,loB,hiB,muRef,seed){
  const rng=mkRng(seed);
  let pool=strategy==="cold"?[...scored].sort((a,b)=>a.z-b.z):strategy==="unpop"?[...scored].sort((a,b)=>b.score-a.score):[...scored].sort((a,b)=>b.score-a.score);
  pool=pool.map(c=>({...c,_s:c.score+rng()*0.25})).sort((a,b)=>b._s-a._s).slice(0,35);
  let best=null,bestDist=Infinity;
  for(let t=0;t<30000;t++){const sh=[...pool].sort(()=>rng()-0.5).slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);const s=sm(sh),d=Math.abs(s-muRef);if(s>=loB&&s<=hiB&&d<bestDist){best=sh;bestDist=d;if(d<5)break;}}
  if(!best){const fp=[...scored].sort((a,b)=>b.score-a.score);const r2=mkRng(seed+99999);for(let t=0;t<50000&&!best;t++){const sh=[...fp].sort(()=>r2()-0.5).slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);if(sm(sh)>=loB&&sm(sh)<=hiB)best=sh;}if(!best)best=fp.slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);}
  return {nums:best,sum:sm(best),inBand:sm(best)>=loB&&sm(best)<=hiB};
}

function parseNums(str){return str.split(/[\s,;]+/).map(s=>parseInt(s.trim())).filter(n=>!isNaN(n)&&n>=1&&n<=POOL);}

function calcStats(draws){
  const sums=draws.map(d=>sm(d.nums)),parities=draws.map(d=>d.nums.filter(n=>n%2===0).length),freq={};
  draws.forEach(d=>d.nums.forEach(n=>{freq[n]=(freq[n]||0)+1;}));
  return {sumMean:avg(sums),sumStd:std(sums),sumMin:Math.min(...sums),sumMax:Math.max(...sums),
    parityDist:Array.from({length:PICK+1},(_,k)=>({k,count:parities.filter(p=>p===k).length,pct:(parities.filter(p=>p===k).length/draws.length*100).toFixed(1)})),freq};
}

const C={orange:"#F07030",teal:"#2BA89A",red:"#C94040",purple:"#8A5CC4",green:"#4A9E5C",bg:"#07070F",card:"#0D0D1A",border:"#1A1A2E",text:"#E0E0F0",dim:"#6A6A8A"};

const TT=({active,payload,label})=>{if(!active||!payload?.length)return null;return(<div style={{background:"#0e0e20",border:"1px solid #252540",borderRadius:8,padding:"8px 12px",fontSize:12}}><div style={{color:ACCENT,fontWeight:700,marginBottom:4}}>{label}</div>{payload.map((p,i)=>(<div key={i} style={{color:p.color||"#ccc",marginBottom:2}}>{p.name}: <strong style={{fontFamily:"monospace"}}>{typeof p.value==="number"?p.value.toFixed(2):p.value}</strong></div>))}</div>);};

function Ball({num,color=ACCENT,size=38,glow=false,gold=false}){
  return(<div style={{width:size,height:size,borderRadius:"50%",background:gold?`radial-gradient(circle at 35% 32%,#FFD700,#FF6B35)`:`radial-gradient(circle at 35% 32%,${color}cc,${color}33)`,border:`2px solid ${gold?"#FFD700":color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size>38?14:size>28?12:10,fontWeight:900,color:gold?"#0a0a0a":"#fff",fontFamily:"monospace",boxShadow:glow?`0 0 14px ${gold?"#FFD70099":`${color}88`}`:"none",flexShrink:0}}>{num}</div>);
}

function KpiCard({label,value,sub,color=ACCENT}){
  return(<div style={{background:C.card,border:`1px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:10,padding:"10px 12px",textAlign:"center"}}><div style={{color:C.dim,fontSize:9,marginBottom:2,textTransform:"uppercase",letterSpacing:1}}>{label}</div><div style={{color,fontSize:18,fontWeight:900,fontFamily:"monospace"}}>{value}</div>{sub&&<div style={{color:C.dim,fontSize:9,marginTop:2}}>{sub}</div>}</div>);
}

function TabAnimazione(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const [frame,setFrame]=useState(1);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(0.5);
  const [showMA5,setShowMA5]=useState(true);
  const canvasRef=useRef(null),containerRef=useRef(null),frameRef=useRef(1),rafRef=useRef(null);
  const [W,setW]=useState(660);
  const [pxPerPoint,setPxPerPoint]=useState(8);
  const total=series.length;
  const canvasW=useMemo(()=>Math.max(W,total*pxPerPoint),[W,total,pxPerPoint]);
  useEffect(()=>{const obs=new ResizeObserver(e=>{setW(Math.max(280,Math.floor(e[0].contentRect.width)-16));});if(containerRef.current)obs.observe(containerRef.current);return()=>obs.disconnect();},[]);
  const animate=useCallback(()=>{if(frameRef.current>=total){setPlaying(false);return;}frameRef.current=Math.min(frameRef.current+speed*0.1,total);setFrame(frameRef.current);rafRef.current=requestAnimationFrame(animate);},[speed,total]);
  useEffect(()=>{if(playing)rafRef.current=requestAnimationFrame(animate);else cancelAnimationFrame(rafRef.current);return()=>cancelAnimationFrame(rafRef.current);},[playing,animate]);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas||!series.length)return;
    const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,PAD={top:40,right:24,bottom:44,left:48};
    canvas.width=canvasW*dpr;canvas.height=240*dpr;canvas.style.width=canvasW+"px";canvas.style.height="240px";ctx.scale(dpr,dpr);
    const CW=canvasW-PAD.left-PAD.right,CH=240-PAD.top-PAD.bottom,visible=Math.min(Math.ceil(frame),total);
    const toX=i=>PAD.left+(i/(Math.max(total-1,1)))*CW,toY=v=>PAD.top+(1-(v-20)/(220-20))*CH;
    ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvasW,240);
    [20,50,80,110,127.5,150,180,210].forEach(v=>{const y=toY(v),isMu=v===127.5;ctx.beginPath();ctx.moveTo(PAD.left,y);ctx.lineTo(PAD.left+CW,y);ctx.setLineDash(isMu?[6,3]:[2,6]);ctx.strokeStyle=isMu?`${ACCENT}44`:"rgba(255,255,255,0.05)";ctx.lineWidth=isMu?1.5:1;ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=isMu?`${ACCENT}99`:"rgba(255,255,255,0.3)";ctx.font=`${isMu?"bold ":""}9px monospace`;ctx.textAlign="right";ctx.fillText(isMu?"127.5":Math.round(v),PAD.left-4,y+3);});
    for(let i=0;i<total;i++){if(i===0||i===total-1||i%Math.ceil(total/6)===0){const x=toX(i);ctx.fillStyle="rgba(255,255,255,0.35)";ctx.font="9px monospace";ctx.textAlign="center";ctx.fillText(series[i].date?.substring(0,5)||"",x,PAD.top+CH+14);}}
    ctx.strokeStyle="rgba(255,255,255,0.12)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(PAD.left,PAD.top);ctx.lineTo(PAD.left,PAD.top+CH);ctx.stroke();ctx.beginPath();ctx.moveTo(PAD.left,PAD.top+CH);ctx.lineTo(PAD.left+CW,PAD.top+CH);ctx.stroke();
    if(visible<2)return;
    function line(vals,col,w,dash=[]){ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=col;ctx.lineWidth=w;let started=false;for(let i=0;i<visible;i++){if(vals[i]==null)continue;const x=toX(i),y=toY(vals[i]);if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);}ctx.stroke();ctx.setLineDash([]);}
    if(showMA5)line(series.map(d=>d.ma5),`${ACCENT}66`,1.5,[4,3]);
    ctx.shadowBlur=12;ctx.shadowColor=`${ACCENT}66`;line(series.map(d=>d.mu),ACCENT,2.5);ctx.shadowBlur=0;
    for(let i=0;i<visible;i++){const x=toX(i),yS=toY(series[i].sum),yM=toY(series[i].mu);ctx.beginPath();ctx.moveTo(x,yS);ctx.lineTo(x,yM);ctx.strokeStyle="rgba(255,255,255,0.06)";ctx.lineWidth=1;ctx.stroke();const dotCol=series[i].sum>MU_TEO?C.orange:C.teal;ctx.beginPath();ctx.arc(x,yS,3.5,0,Math.PI*2);ctx.fillStyle=dotCol;ctx.fill();}
  },[frame,showMA5,W,series]);
  const vi=Math.min(Math.ceil(frame)-1,total-1);const cur=series[vi]||series[0];
  const sums=series.map(d=>d.sum);const muReale=avg(sums);
  return(
    <div ref={containerRef}>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>📈 Traiettoria Media Progressiva</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:6,marginBottom:12}}>
        <KpiCard label="Estrazioni" value={allDraws.length} sub={`2024 → oggi`}/>
        <KpiCard label="Σ ultima" value={cur.sum} color={cur.sum>MU_TEO?C.orange:C.teal}/>
        <KpiCard label="μ reale" value={muReale.toFixed(1)} color={ACCENT} sub={`Δ ${(muReale-MU_TEO).toFixed(1)}`}/>
        <KpiCard label="z-score" value={cur.zScore?.toFixed(2)} color={Math.abs(cur.zScore)<1?C.green:Math.abs(cur.zScore)<2?C.orange:C.red}/>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}><span style={{color:C.dim,fontSize:10}}>Zoom:</span>{[4,6,8,12,16].map(p=>(<button key={p} onClick={()=>setPxPerPoint(p)} style={{background:pxPerPoint===p?`${ACCENT}22`:"transparent",color:pxPerPoint===p?ACCENT:C.dim,border:`1px solid ${pxPerPoint===p?ACCENT:C.border}`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{p===4?"Min":p===6?"S":p===8?"M":p===12?"L":"Max"}</button>))}<span style={{color:C.dim,fontSize:9,marginLeft:"auto"}}>{total} est.</span></div>
      <div style={{borderRadius:10,overflow:"hidden",border:"1px solid #1a1a2e",marginBottom:10,overflowX:"auto"}}>
        <canvas ref={canvasRef} style={{display:"block",cursor:"crosshair"}} onTouchMove={()=>{}}/>
      </div>
      <input type="range" min={1} max={total} step={0.05} value={frame} onChange={e=>{cancelAnimationFrame(rafRef.current);setPlaying(false);frameRef.current=+e.target.value;setFrame(+e.target.value);}} style={{width:"100%",accentColor:ACCENT,cursor:"pointer",marginBottom:8}}/>
      <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
        {[{i:"⟪",a:()=>{cancelAnimationFrame(rafRef.current);setPlaying(false);frameRef.current=1;setFrame(1);}},{i:playing?"⏸":"▶",a:()=>{if(frame>=total){frameRef.current=1;setFrame(1);}setPlaying(p=>!p);},gold:true},{i:"⟫",a:()=>{cancelAnimationFrame(rafRef.current);setPlaying(false);frameRef.current=total;setFrame(total);}}].map((b,idx)=>(
          <button key={idx} onClick={b.a} style={{background:b.gold?`linear-gradient(135deg,${ACCENT},${C.teal})`:"rgba(255,255,255,0.05)",color:b.gold?"#fff":"#ccc",border:`1px solid ${b.gold?ACCENT:"rgba(255,255,255,0.1)"}`,borderRadius:10,padding:"9px 16px",fontSize:b.gold?18:14,fontWeight:900,minWidth:46,cursor:"pointer"}}>{b.i}</button>
        ))}
        {[0.2,0.5,1,2].map(s=>(<button key={s} onClick={()=>setSpeed(s)} style={{background:speed===s?`${C.teal}22`:"transparent",color:speed===s?C.teal:C.dim,border:`1px solid ${speed===s?C.teal:"rgba(255,255,255,0.08)"}`,borderRadius:6,padding:"5px 9px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{s}×</button>))}
        <button onClick={()=>setShowMA5(v=>!v)} style={{background:showMA5?`${ACCENT}11`:"transparent",color:showMA5?`${ACCENT}99`:C.dim,border:`1px solid ${showMA5?`${ACCENT}44`:"rgba(255,255,255,0.08)"}`,borderRadius:16,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>MA5</button>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginTop:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:8}}>☯️ Andamento Pari / Dispari</div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={allDraws.slice(-100).map(d=>({date:d.date?.substring(0,5)||"",pari:d.nums.filter(n=>n%2===0).length,dispari:d.nums.filter(n=>n%2!==0).length}))} margin={{top:4,right:8,bottom:0,left:-20}}>
            <CartesianGrid strokeDasharray="2 4" stroke="#0e0e1c"/>
            <XAxis dataKey="date" tick={{fill:C.dim,fontSize:8}} interval={Math.ceil(Math.min(allDraws.length,100)/8)}/>
            <YAxis domain={[0,5]} ticks={[0,2,4]} tick={{fill:C.dim,fontSize:8}}/>
            <Tooltip content={<TT/>}/>
            <Bar dataKey="pari" stackId="a" fill="#4A9E5C" name="Pari"/>
            <Bar dataKey="dispari" stackId="a" fill="#F07030" name="Dispari" radius={[3,3,0,0]}/>
            <Legend wrapperStyle={{fontSize:10}}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginTop:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:8}}>🔢 Distribuzione per Decine (1–50)</div>
        {(()=>{
          const decine=[{label:"1–10",min:1,max:10},{label:"11–20",min:11,max:20},{label:"21–30",min:21,max:30},{label:"31–40",min:31,max:40},{label:"41–50",min:41,max:50}];
          const DC=["#E8B84B","#F07030","#8A5CC4","#4A8FD4","#2BA89A"];
          const medie=decine.map((dec,i)=>({...dec,media:allDraws.reduce((s,d)=>s+d.nums.filter(n=>n>=dec.min&&n<=dec.max).length,0)/allDraws.length,col:DC[i]}));
          const maxMedia=Math.max(...medie.map(m=>m.media));
          return(<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
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
  const sums=series.map(d=>d.sum);const muReale=avg(sums),sigmaReale=std(sums);
  const hotNums=[...scored].sort((a,b)=>b.z-a.z).slice(0,8);const coldNums=[...scored].sort((a,b)=>a.z-b.z).slice(0,8);
  const freqSorted=Object.entries(stats.freq).sort((a,b)=>b[1]-a[1]);const totalOcc=freqSorted.reduce((s,[,v])=>s+v,0);
  function getRitardo(num){for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].nums.includes(num))return allDraws.length-1-i;}return allDraws.length;}
  const zCol=z=>Math.abs(z)>2?C.red:Math.abs(z)>1?C.orange:C.teal;
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
        <span style={{color:C.dim,fontSize:11}}>Finestra:</span>
        {[10,20,50,100,allDraws.length].map(w=>(<button key={w} onClick={()=>setWinSize(Math.min(w,allDraws.length))} style={{background:winSize===Math.min(w,allDraws.length)?`${ACCENT}22`:"transparent",color:winSize===Math.min(w,allDraws.length)?ACCENT:C.dim,border:`1px solid ${winSize===Math.min(w,allDraws.length)?ACCENT:C.border}`,borderRadius:14,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{w===allDraws.length?"Tutte":w}</button>))}
      </div>
      {[
        {l:"SEGNALE SOMME",z:zOf(muReale,MU_TEO,SIGMA_TEO/Math.sqrt(allDraws.length)),d:`μ reale: ${muReale.toFixed(1)} · teo: ${MU_TEO} · σ: ${sigmaReale.toFixed(1)}`},
        {l:"ANOMALIA MAX FREQUENZA",z:Math.max(...scored.map(s=>Math.abs(s.z))),d:`Più caldo: ${hotNums[0]?.num} (z=+${hotNums[0]?.z.toFixed(1)})`},
        {l:"SCOSTAMENTO DA MEDIA TEORICA",z:(muReale-MU_TEO)/sigmaReale,d:`Δ: ${(muReale-MU_TEO).toFixed(1)} punti`},
      ].map(item=>{const col=zCol(item.z);const label=Math.abs(item.z)>2?"⚠️ Anomalia forte":Math.abs(item.z)>1?"⚡ Anomalia lieve":"✓ Nella norma";return(<div key={item.l} style={{background:C.card,border:`1px solid ${col}33`,borderLeft:`3px solid ${col}`,borderRadius:8,padding:"10px 14px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5,flexWrap:"wrap",gap:4}}><span style={{color:C.text,fontSize:11}}>{item.l}</span><span style={{color:col,fontSize:11,fontWeight:700}}>{label} (z={item.z.toFixed(2)})</span></div><div style={{background:"#0a0a18",borderRadius:4,height:6,overflow:"hidden",marginBottom:4}}><div style={{background:`linear-gradient(90deg,${C.teal},${col})`,width:`${clamp(Math.abs(item.z)/3*100,0,100)}%`,height:"100%"}}/></div><div style={{color:C.dim,fontSize:10}}>{item.d}</div></div>);})}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:14}}>
        <div style={{background:C.card,border:`1px solid ${C.orange}33`,borderRadius:10,padding:12}}>
          <div style={{color:C.orange,fontWeight:700,fontSize:12,marginBottom:8}}>🔥 Top caldi (win {winSize})</div>
          {hotNums.map(h=>(<div key={h.num} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}><Ball num={h.num} color={C.orange} size={28}/><div style={{flex:1,background:"#0a0a18",borderRadius:3,height:7,overflow:"hidden"}}><div style={{background:C.orange,height:"100%",width:`${Math.min(h.f/Math.max(...hotNums.map(x=>x.f))*100,100)}%`}}/></div><span style={{color:C.orange,fontSize:10,fontFamily:"monospace",minWidth:56}}>{h.f}x z=+{h.z.toFixed(1)}</span></div>))}
        </div>
        <div style={{background:C.card,border:`1px solid ${C.teal}33`,borderRadius:10,padding:12}}>
          <div style={{color:C.teal,fontWeight:700,fontSize:12,marginBottom:8}}>❄️ Top freddi (win {winSize})</div>
          {coldNums.map(h=>(<div key={h.num} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}><Ball num={h.num} color={C.teal} size={28}/><div style={{flex:1,background:"#0a0a18",borderRadius:3,height:7,overflow:"hidden"}}><div style={{background:C.teal,height:"100%",width:`${clamp(Math.abs(h.z)/3*100,0,100)}%`}}/></div><span style={{color:C.teal,fontSize:10,fontFamily:"monospace",minWidth:56}}>{h.f}x z={h.z.toFixed(1)}</span></div>))}
        </div>
      </div>
      <div style={{marginTop:14,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:12,marginBottom:8}}>🗺️ Mappa frequenze 1–50 ({allDraws.length} estrazioni)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:3,marginBottom:12}}>
          {scored.map(s=>{const maxF=Math.max(...scored.map(x=>x.f))||1;const intensity=clamp(s.f/maxF,0,1);const col=s.isCold?C.teal:s.isHot?C.orange:ACCENT;return(<div key={s.num} title={`${s.num}: ${s.f}x rit.${(() => {for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].nums.includes(s.num))return allDraws.length-1-i;}return allDraws.length;})()}`} style={{aspectRatio:"1",background:`${col}${Math.round(intensity*180+40).toString(16).padStart(2,"00")}`,border:`1px solid ${col}22`,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontFamily:"monospace",fontWeight:700}}>{s.num}</div>);})}
        </div>
        <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Top 10 frequenti:</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
          {freqSorted.slice(0,10).map(([n,f])=>{const pct=(f/totalOcc*100).toFixed(1);const rit=getRitardo(+n);return(<div key={n} style={{background:`${ACCENT}11`,border:`1px solid ${ACCENT}33`,borderRadius:8,padding:"5px 8px",textAlign:"center"}}><Ball num={+n} color={ACCENT} size={26}/><div style={{color:ACCENT,fontSize:10,fontWeight:700}}>{f}x</div><div style={{color:C.teal,fontSize:9}}>{pct}%</div><div style={{color:C.dim,fontSize:9}}>rit.{rit}</div></div>);})}
        </div>
        <div style={{color:"#FFD700",fontWeight:700,fontSize:12,marginBottom:8}}>⭐ Euro Numeri (1–12)</div>
        {(()=>{
          const sf={};allDraws.forEach(d=>(d.bonus||[]).forEach(s=>{sf[s]=(sf[s]||0)+1;}));const tot=Object.values(sf).reduce((s,v)=>s+v,0);
          return(<div style={{display:"flex",flexWrap:"wrap",gap:5}}>{Array.from({length:12},(_,i)=>i+1).map(n=>{const f=sf[n]||0;const pct=tot?((f/tot)*100).toFixed(1):"0.0";let rit=allDraws.length;for(let i=allDraws.length-1;i>=0;i--){if((allDraws[i].bonus||[]).includes(n)){rit=allDraws.length-1-i;break;}}return(<div key={n} style={{background:"#1a1a20",border:"1px solid #FFD70033",borderRadius:8,padding:"5px 8px",textAlign:"center"}}><Ball num={n} color="#FFD700" size={26}/><div style={{color:"#FFD700",fontSize:10,fontWeight:700}}>{f}x</div><div style={{color:C.teal,fontSize:9}}>{pct}%</div><div style={{color:C.dim,fontSize:9}}>rit.{rit}</div></div>);})}</div>);
        })()}
      </div>
    </div>
  );
}

function TabBanda(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);const muReale=avg(sums),sigmaReale=std(sums);
  const [kBand,setKBand]=useState(1.5);const [useAdaptive,setAdaptive]=useState(true);
  const [storicoPred,setStoricoPred]=useState([]);
  const predizione=useMemo(()=>{if(allDraws.length<6)return null;const lstm=computeLSTMEJ(allDraws);const reg=computeRegressionEJ(allDraws);const combined=Math.round(lstm.predictedSum*0.40+reg.predicted*0.35+reg.wma*0.25);const zPred=zOf(combined,MU_TEO,SIGMA_TEO);const confidence=Math.round(sigmaReale*0.6);return{combined,lstm:lstm.predictedSum,reg:reg.predicted,wma:Math.round(reg.wma),zPred:parseFloat(zPred.toFixed(2)),lo:combined-confidence,hi:combined+confidence,trend:lstm.currentTrend};},[allDraws,sigmaReale]);
  useEffect(()=>{async function loadStorico(){try{const{data,error}=await supabase.from("predizioni").select("*").eq("lotteria","eurojackpot").order("concorso",{ascending:false}).limit(30);if(error)throw error;setStoricoPred(data||[]);}catch{}}loadStorico();},[allDraws.length]);
  const muT=useAdaptive?muReale:MU_TEO,sigT=useAdaptive?sigmaReale:SIGMA_TEO;
  const loB=Math.round(muT-kBand*sigT),hiB=Math.round(muT+kBand*sigT);
  const inBand=series.filter(d=>d.sum>=loB&&d.sum<=hiB).length;
  const chartData=useMemo(()=>{const base=series.slice(-200).map(d=>({date:d.date?.substring(0,5)||"",sum:d.sum,mu:d.mu,loA:Math.round(muReale-kBand*sigmaReale),hiA:Math.round(muReale+kBand*sigmaReale)}));if(predizione){base.push({date:"pred.",sum:null,mu:null,loA:Math.round(muReale-kBand*sigmaReale),hiA:Math.round(muReale+kBand*sigmaReale),pred:predizione.combined,predLo:predizione.lo,predHi:predizione.hi});}return base;},[series,muReale,kBand,sigmaReale,predizione]);
  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>📐 Banda Adattiva</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:14}}>
        <KpiCard label="μ reale" value={muReale.toFixed(1)} color={C.orange} sub={`${allDraws.length} est.`}/>
        <KpiCard label="σ reale" value={sigmaReale.toFixed(1)} color={C.teal}/>
        <KpiCard label="Min Σ" value={Math.min(...sums)} color={C.teal}/>
        <KpiCard label="Max Σ" value={Math.max(...sums)} color={C.red}/>
        <KpiCard label={`In ±${kBand}σ`} value={`${inBand}/${series.length}`} color={C.green} sub={`${(inBand/series.length*100).toFixed(0)}%`}/>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        {[0.5,1.0,1.5,2.0,2.5].map(k=>{const pct=(sums.filter(s=>s>=Math.round(muT-k*sigT)&&s<=Math.round(muT+k*sigT)).length/series.length*100).toFixed(0);return(<button key={k} onClick={()=>setKBand(k)} style={{background:kBand===k?`${ACCENT}22`:"transparent",color:kBand===k?ACCENT:C.dim,border:`1px solid ${kBand===k?ACCENT:C.border}`,borderRadius:8,padding:"5px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}><div style={{fontWeight:700}}>±{k}σ</div><div style={{fontSize:9,color:kBand===k?C.teal:C.dim}}>{pct}%</div></button>);})}
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
          <defs><linearGradient id="gBandaEJ" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity={0.28}/><stop offset="100%" stopColor={ACCENT} stopOpacity={0.08}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#0e0e1c"/>
          <XAxis dataKey="date" tick={{fill:C.dim,fontSize:9}} interval={Math.ceil(chartData.length/8)}/>
          <YAxis domain={[20,220]} tick={{fill:C.dim,fontSize:9}}/>
          <Tooltip content={<TT/>}/>
          <Area type="monotone" dataKey="hiA" stroke={`${ACCENT}cc`} strokeWidth={2} strokeDasharray="5 3" fill="url(#gBandaEJ)" activeDot={false}/>
          <Area type="monotone" dataKey="loA" stroke={`${ACCENT}cc`} strokeWidth={2} strokeDasharray="5 3" fill="#07070F" activeDot={false}/>
          <ReferenceLine y={MU_TEO} stroke={`${ACCENT}99`} strokeDasharray="6 3" strokeWidth={1.5}/>
          <Line type="monotone" dataKey="mu" stroke={C.teal} strokeWidth={2} dot={false} name="μ"/>
          <Line type="monotone" dataKey="sum" stroke={ACCENT} strokeWidth={2} dot={(props)=>{const{cx,cy,payload}=props;const inB=payload.sum>=loB&&payload.sum<=hiB;return <circle key={cx} cx={cx} cy={cy} r={3} fill={inB?"#4A9E5C":"#C94040"} stroke="none"/>;}} name="Somma"/>
          <Line type="monotone" dataKey="pred" stroke="#e879f9" strokeWidth={3} strokeDasharray="6 3" dot={(props)=>{const{cx,cy,payload}=props;if(!payload.pred)return null;return(<g key={cx}><circle cx={cx} cy={cy} r={8} fill="#e879f933" stroke="#e879f9" strokeWidth={2}/><circle cx={cx} cy={cy} r={4} fill="#e879f9"/></g>);}} name="Predizione"/>
          <Line type="monotone" dataKey="predLo" stroke="#e879f944" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Pred.Lo"/>
          <Line type="monotone" dataKey="predHi" stroke="#e879f944" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Pred.Hi"/>
        </ComposedChart>
      </ResponsiveContainer>
      {predizione&&(<div style={{background:"#1a001a",border:"2px solid #e879f9",borderRadius:12,padding:14,marginTop:14}}>
        <div style={{color:"#e879f9",fontWeight:700,fontSize:13,marginBottom:10}}>🔮 Predizione Prossima Estrazione</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:12}}>
          {[{l:"Somma predetta",v:predizione.combined,c:"#e879f9"},{l:"Range",v:`${predizione.lo}–${predizione.hi}`,c:C.dim},{l:"LSTM",v:predizione.lstm,c:"#a78bfa"},{l:"Regressione",v:predizione.reg,c:C.orange},{l:"WMA",v:predizione.wma,c:C.teal},{l:"z-score",v:predizione.zPred.toFixed(2),c:Math.abs(predizione.zPred)<1?C.green:Math.abs(predizione.zPred)<2?C.orange:C.red},{l:"Trend",v:(predizione.trend>=0?"+":"")+predizione.trend,c:predizione.trend>=0?C.orange:C.teal}].map(x=>(<div key={x.l} style={{background:"#0a0010",borderRadius:8,padding:"8px 10px",textAlign:"center",border:"1px solid #e879f933"}}><div style={{color:C.dim,fontSize:8,marginBottom:2}}>{x.l}</div><div style={{color:x.c,fontFamily:"monospace",fontSize:13,fontWeight:900}}>{x.v}</div></div>))}
        </div>
        <div style={{color:C.dim,fontSize:9,lineHeight:1.7}}>Pesi: LSTM 40% · Regressione 35% · WMA 25% · Confidenza ±{Math.round(sigmaReale*0.6)}</div>
      </div>)}
      {storicoPred.length>0&&(<div style={{background:C.card,border:"1px solid #e879f933",borderRadius:12,padding:14,marginTop:14}}>
        <div style={{color:"#e879f9",fontWeight:700,fontSize:13,marginBottom:10}}>📊 Storico Predizioni</div>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
          <thead><tr>{["Concorso","Predetta","Reale","Scarto","z","Trend"].map(h=>(<th key={h} style={{color:C.dim,padding:"4px 8px",textAlign:"center",borderBottom:`1px solid ${C.border}`,fontWeight:700}}>{h}</th>))}</tr></thead>
          <tbody>{storicoPred.map((p,i)=>{const col=p.scarto===null?"#555":Math.abs(p.scarto)<=20?C.green:Math.abs(p.scarto)<=40?C.orange:C.red;return(<tr key={i} style={{background:i%2===0?"#080816":"#0a0a18"}}>
            <td style={{color:ACCENT,padding:"5px 8px",textAlign:"center",fontFamily:"monospace"}}>#{p.concorso||"—"}</td>
            <td style={{color:"#e879f9",padding:"5px 8px",textAlign:"center",fontFamily:"monospace"}}>{p.somma_predetta}</td>
            <td style={{color:p.somma_reale?C.text:"#555",padding:"5px 8px",textAlign:"center",fontFamily:"monospace"}}>{p.somma_reale||"⏳"}</td>
            <td style={{color:col,padding:"5px 8px",textAlign:"center",fontFamily:"monospace",fontWeight:700}}>{p.scarto!=null?(p.scarto>=0?"+":"")+p.scarto:"—"}</td>
            <td style={{color:C.dim,padding:"5px 8px",textAlign:"center",fontFamily:"monospace"}}>{p.z_predetto?.toFixed(2)||"—"}</td>
            <td style={{color:p.trend>=0?C.orange:C.teal,padding:"5px 8px",textAlign:"center",fontFamily:"monospace"}}>{p.trend!=null?(p.trend>=0?"+":"")+p.trend:"—"}</td>
          </tr>);})}
          </tbody>
        </table></div>
      </div>)}
    </div>
  );
}

function TabGeneratore(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);const muReale=avg(sums),sigmaReale=std(sums);
  const stats=useMemo(()=>calcStats(allDraws),[allDraws]);
  const [muCustom,setMuCustom]=useState(Math.round(muReale));
  const [kBand,setKBand]=useState(1.5);const [strategy,setStrategy]=useState("balanced");
  const [winSize,setWinSize]=useState(Math.min(20,allDraws.length));
  const [mode,setMode]=useState("auto");const [ticket,setTicket]=useState(null);const [bonus,setBonus]=useState(null);
  const [minSum,setMinSum]=useState(Math.round(muReale-sigmaReale));const [maxSum,setMaxSum]=useState(Math.round(muReale+sigmaReale));
  const [ratio,setRatio]=useState("any");const [freqInput,setFreqInput]=useState("");const [delayInput,setDelayInput]=useState("");
  const [results,setResults]=useState([]);const [scanned,setScanned]=useState(0);const [loading,setLoading]=useState(false);
  const [selectedTattico,setSelectedTattico]=useState(new Set());
  const [showSSTattico,setShowSSTattico]=useState(false);
  const [chosenSSTattico,setChosenSSTattico]=useState({});
  const [decineAttive,setDecineAttive]=useState(new Map());
  const loB=Math.round(muCustom-kBand*sigmaReale),hiB=Math.round(muCustom+kBand*sigmaReale);
  const scored=useMemo(()=>scoreNumbers(allDraws,winSize),[allDraws,winSize]);
  const totalOcc=Object.values(stats.freq).reduce((s,v)=>s+v,0);
  const freqEntries=Object.entries(stats.freq).sort((a,b)=>b[1]-a[1]);
  const top6freq=freqEntries.slice(0,6).map(([n])=>+n);const top6delay=freqEntries.slice(-6).map(([n])=>+n);
  function getRitardo(num){for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].nums.includes(num))return allDraws.length-1-i;}return allDraws.length;}
  const lastDraw=allDraws[allDraws.length-1];const lastEvens=lastDraw?.nums.filter(n=>n%2===0).length||2;
  const genera=()=>{const seed=Date.now();setTicket(generateTicket(scored,strategy,loB,hiB,muCustom,seed));setBonus(generateBonus(seed));};
  const generaTattico=()=>{
    setLoading(true);setResults([]);setScanned(0);
    setSelectedTattico(new Set());setShowSSTattico(false);setChosenSSTattico({});
    setTimeout(()=>{
      const rng=mkRng(Date.now());const found=[],maxAttempts=500000;let sc=0;
      const freqNums=parseNums(freqInput),delayNums=parseNums(delayInput);
      const DEC=[{min:1,max:10},{min:11,max:20},{min:21,max:30},{min:31,max:40},{min:41,max:50}];
      while(found.length<50&&sc<maxAttempts){
        sc++;const pool=Array.from({length:POOL},(_,i)=>i+1);const nums=[];
        while(nums.length<PICK){const idx=Math.floor(rng()*pool.length);nums.push(pool.splice(idx,1)[0]);}
        nums.sort((a,b)=>a-b);const s=sm(nums);if(s<minSum||s>maxSum)continue;
        const evens=nums.filter(n=>n%2===0).length,odds=PICK-evens;
        if(ratio!=="any"){const[re,ro]=ratio.split("-").map(Number);if(evens!==re||odds!==ro)continue;}
        if(freqNums.length>0&&!nums.some(n=>freqNums.includes(n)))continue;
        if(delayNums.length>0&&nums.filter(n=>delayNums.includes(n)).length>2)continue;
        if(decineAttive.size>0){let ok=true;decineAttive.forEach((cnt,idx)=>{if(nums.filter(n=>n>=DEC[idx].min&&n<=DEC[idx].max).length!==cnt)ok=false;});if(!ok)continue;}
        const key=nums.join(",");if(found.some(f=>f.nums.join(",")===key))continue;
        found.push({nums,sum:s,evens,odds,zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2)});
      }
      setResults(found);setScanned(sc);setLoading(false);
    },50);
  };
  const ratioOpts=[{v:"any",l:"Qualsiasi"},{v:"3-2",l:"3P–2D"},{v:"2-3",l:"2P–3D"},{v:"4-1",l:"4P–1D"},{v:"1-4",l:"1P–4D"}];
  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🎯 Generatore Cinquine + Euro Numeri</h2>
      <div style={{background:`${ACCENT}08`,border:`1px solid ${ACCENT}33`,borderRadius:12,padding:12,marginBottom:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:12,marginBottom:8}}>📊 Suggerimenti — {allDraws.length} estrazioni storiche</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:ACCENT,fontSize:10,fontWeight:700,marginBottom:5}}>⚡ Range Somma</div>
            {[{l:"±0.5σ",lo:Math.round(muReale-sigmaReale*0.5),hi:Math.round(muReale+sigmaReale*0.5)},{l:"±1σ",lo:Math.round(muReale-sigmaReale),hi:Math.round(muReale+sigmaReale)},{l:"±1.5σ",lo:Math.round(muReale-sigmaReale*1.5),hi:Math.round(muReale+sigmaReale*1.5)}].map(b=>(<button key={b.l} onClick={()=>{setMinSum(b.lo);setMaxSum(b.hi);}} style={{display:"block",width:"100%",background:`${ACCENT}11`,border:`1px solid ${ACCENT}33`,borderRadius:5,padding:"4px 6px",cursor:"pointer",fontFamily:"inherit",marginBottom:3,textAlign:"left"}}><span style={{color:ACCENT,fontSize:10,fontWeight:700}}>{b.l}: </span><span style={{color:C.text,fontSize:10}}>{b.lo}–{b.hi}</span></button>))}
            <div style={{color:C.dim,fontSize:9}}>μ={muReale.toFixed(1)} · σ={sigmaReale.toFixed(1)}</div>
          </div>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:C.orange,fontSize:10,fontWeight:700,marginBottom:4}}>🔥 Freq. storiche</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:4}}>{top6freq.map(n=>{const f=stats.freq[n]||0,pct=(f/totalOcc*100).toFixed(1);return(<div key={n} style={{textAlign:"center"}}><Ball num={n} color={C.orange} size={22}/><div style={{color:C.orange,fontSize:7}}>{pct}%</div></div>);})}</div>
            <button onClick={()=>setFreqInput(top6freq.slice(0,4).join(","))} style={{width:"100%",background:`${C.orange}11`,border:`1px solid ${C.orange}33`,borderRadius:5,padding:"3px",cursor:"pointer",fontFamily:"inherit",color:C.orange,fontSize:10}}>Usa top 4</button>
          </div>
          <div style={{background:"#080816",borderRadius:8,padding:10,border:`1px solid ${ACCENT}22`}}>
            <div style={{color:C.teal,fontSize:10,fontWeight:700,marginBottom:4}}>❄️ Ritard. storici</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:4}}>{top6delay.map(n=>{const rit=getRitardo(n),pct=(rit/allDraws.length*100).toFixed(0);return(<div key={n} style={{textAlign:"center"}}><Ball num={n} color={C.teal} size={22}/><div style={{color:C.teal,fontSize:7}}>{pct}%</div></div>);})}</div>
            <button onClick={()=>setDelayInput(top6delay.slice(0,4).join(","))} style={{width:"100%",background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:5,padding:"3px",cursor:"pointer",fontFamily:"inherit",color:C.teal,fontSize:10}}>Usa top 4</button>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {[{id:"auto",l:"🤖 Automatica"},{id:"manual",l:"✍️ Manuale"},{id:"tattico",l:"⚡ Tattico"}].map(m=>(<button key={m.id} onClick={()=>setMode(m.id)} style={{background:mode===m.id?`${ACCENT}22`:"transparent",color:mode===m.id?ACCENT:C.dim,border:`1px solid ${mode===m.id?ACCENT:C.border}`,borderRadius:18,padding:"6px 14px",fontSize:11,fontWeight:mode===m.id?700:400,cursor:"pointer",fontFamily:"inherit"}}>{m.l}</button>))}
      </div>
      {mode==="manual"&&(<div>
        <div style={{color:C.dim,fontSize:11,marginBottom:10}}>Inserisci {PICK} numeri (1–{POOL}).</div>
        <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap",marginBottom:10}}>
          {Array.from({length:PICK},(_,i)=>i).map(i=>{
            const [v,setV]=useState("");
            const num=parseInt(v)||0,valid=num>=1&&num<=POOL;
            const col=valid?ACCENT:"#333";
            return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><Ball num={valid?num:"?"} color={col} size={38}/><input type="number" min={1} max={POOL} value={v} onChange={e=>setV(e.target.value)} style={{width:48,textAlign:"center",background:"#080816",color:col,border:`1.5px solid ${valid?`${col}55`:C.border}`,borderRadius:7,padding:"4px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>);
          })}
        </div>
      </div>)}
      {mode==="auto"&&(<div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
          {[{id:"cold",l:"❄️",c:C.teal},{id:"unpop",l:"👥",c:C.purple},{id:"balanced",l:"⚖️",c:ACCENT}].map(s=>(<button key={s.id} onClick={()=>setStrategy(s.id)} style={{background:strategy===s.id?`${s.c}22`:"transparent",color:strategy===s.id?s.c:C.dim,border:`1px solid ${strategy===s.id?s.c:C.border}`,borderRadius:14,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{s.l}</button>))}
          <div style={{width:"100%",marginTop:6}}>
            <div style={{color:C.dim,fontSize:10,marginBottom:5}}>⚙️ BANDA σ:</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {[0.5,1.0,1.5,2.0,2.5].map(k=>{const lo=Math.round(muCustom-k*sigmaReale);const hi=Math.round(muCustom+k*sigmaReale);const inB=series.filter(d=>d.sum>=lo&&d.sum<=hi).length;const pct=(inB/series.length*100).toFixed(0);const isActive=kBand===k;return(<button key={k} onClick={()=>setKBand(k)} style={{flex:1,minWidth:70,background:isActive?`linear-gradient(135deg,${ACCENT}33,${ACCENT}11)`:"#080816",color:isActive?ACCENT:C.dim,border:`2px solid ${isActive?ACCENT:C.border}`,borderRadius:10,padding:"8px 4px",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}><div style={{fontSize:13,fontWeight:900,fontFamily:"monospace"}}>±{k}σ</div><div style={{fontSize:10,fontFamily:"monospace",color:isActive?C.teal:C.dim,marginTop:2}}>{lo}–{hi}</div><div style={{fontSize:9,color:isActive?C.green:C.dim,marginTop:1}}>{pct}% storiche</div></button>);})}
            </div>
          </div>
        </div>
        <button onClick={genera} style={{width:"100%",padding:"13px",background:`linear-gradient(135deg,${ACCENT},${C.teal})`,color:"#fff",border:"none",borderRadius:10,fontSize:16,fontWeight:900,cursor:"pointer",fontFamily:"Georgia,serif",marginBottom:12}}>🎲 Genera Cinquina + Euro Numeri</button>
        {ticket&&(<div style={{background:"#080816",border:`1px solid ${ACCENT}55`,borderRadius:12,padding:14}}>
          <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {ticket.nums.map(n=>{const s=scored.find(x=>x.num===n);const col=s?.isHot?C.orange:s?.isCold?C.teal:ACCENT;return <Ball key={n} num={n} color={col} size={46} glow/>;})}<div style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:C.dim,fontSize:14}}>│</span>{bonus?.map(b=><Ball key={b} num={b} size={46} gold glow/>)}<span style={{color:"#FFD700",fontSize:9}}>EN</span></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
            {[{l:"Σ",v:ticket.sum,c:ACCENT},{l:"Δ da μ",v:(ticket.sum>muCustom?"+":"")+(ticket.sum-muCustom),c:C.teal},{l:"Δ da 127.5",v:(ticket.sum>MU_TEO?"+":"")+(ticket.sum-MU_TEO).toFixed(1),c:ticket.sum>MU_TEO?C.orange:C.teal},{l:"z",v:zOf(ticket.sum,MU_TEO,SIGMA_TEO).toFixed(2),c:Math.abs(zOf(ticket.sum,MU_TEO,SIGMA_TEO))<1?C.green:C.orange}].map(x=>(<div key={x.l} style={{background:"#0a0a18",borderRadius:6,padding:8,textAlign:"center"}}><div style={{color:C.dim,fontSize:9}}>{x.l}</div><div style={{color:x.c,fontSize:15,fontWeight:900,fontFamily:"monospace"}}>{x.v}</div></div>))}
          </div>
          <button onClick={async()=>{const t={id:Date.now(),nums:ticket.nums,bonus,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy,sum:ticket.sum};await salvaTicketEJ(t);alert(`✅ Salvata!\n${ticket.nums.join("-")} | EN:${bonus?.join("-")||"—"}`);}} style={{width:"100%",padding:"10px",background:`${C.purple}22`,color:C.purple,border:`2px solid ${C.purple}`,borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💾 Salva → 🎫 Biglietti</button>
        </div>)}
      </div>)}
      {mode==="tattico"&&(<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:12}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
            <div style={{color:ACCENT,fontSize:11,fontWeight:700,marginBottom:6}}>⚡ Range Somma</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>{[0.5,1.0,1.5,2.0].map(k=>{const lo=Math.round(muReale-k*sigmaReale);const hi=Math.round(muReale+k*sigmaReale);const isA=minSum===lo&&maxSum===hi;return(<button key={k} onClick={()=>{setMinSum(lo);setMaxSum(hi);}} style={{flex:1,minWidth:50,background:isA?`${ACCENT}22`:"#080816",color:isA?ACCENT:C.dim,border:`1px solid ${isA?ACCENT:C.border}`,borderRadius:7,padding:"4px 2px",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}><div style={{fontSize:10,fontWeight:900}}>±{k}σ</div><div style={{fontSize:8,color:isA?C.teal:C.dim}}>{lo}–{hi}</div></button>);})}
            </div>
            <div style={{display:"flex",gap:6}}>{[{l:"Min",v:minSum,set:setMinSum},{l:"Max",v:maxSum,set:setMaxSum}].map(f=>(<div key={f.l} style={{flex:1}}><div style={{color:C.dim,fontSize:9,marginBottom:2}}>{f.l}</div><input type="number" value={f.v} onChange={e=>f.set(+e.target.value)} style={{width:"100%",background:"#0a0a1c",color:C.text,border:"1px solid #2d2d54",borderRadius:5,padding:"5px",fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/></div>))}</div>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
            <div style={{color:ACCENT,fontSize:11,fontWeight:700,marginBottom:6}}>☯️ Pari/Dispari</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>{ratioOpts.map(r=>(<button key={r.v} onClick={()=>setRatio(r.v)} style={{background:ratio===r.v?"#2d3748":"#0a0a1c",color:ratio===r.v?"#00f2fe":C.text,border:`1px solid ${ratio===r.v?"#00f2fe":"#2d2d54"}`,borderRadius:5,padding:"4px 2px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{r.l}</button>))}</div>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
            <div style={{color:ACCENT,fontSize:11,fontWeight:700,marginBottom:6}}>📊 Filtri</div>
            <div style={{marginBottom:5}}><div style={{color:C.orange,fontSize:9,marginBottom:2}}>🔥 Frequenti:</div><input type="text" value={freqInput} onChange={e=>setFreqInput(e.target.value)} placeholder="Es. 7,15,28" style={{width:"100%",background:"#0a0a1c",color:C.text,border:"1px solid #2d2d54",borderRadius:5,padding:"4px",fontSize:10,outline:"none",boxSizing:"border-box"}}/></div>
            <div><div style={{color:C.teal,fontSize:9,marginBottom:2}}>❄️ Ritardatari:</div><input type="text" value={delayInput} onChange={e=>setDelayInput(e.target.value)} placeholder="Es. 3,22" style={{width:"100%",background:"#0a0a1c",color:C.text,border:"1px solid #2d2d54",borderRadius:5,padding:"4px",fontSize:10,outline:"none",boxSizing:"border-box"}}/></div>
          </div>
          {(()=>{
            const DECINE_EJ=[{label:"1–10",min:1,max:10},{label:"11–20",min:11,max:20},{label:"21–30",min:21,max:30},{label:"31–40",min:31,max:40},{label:"41–50",min:41,max:50}];
            const DC=["#E8B84B","#F07030","#8A5CC4","#4A8FD4","#2BA89A"];
            const medieDec=DECINE_EJ.map((d,i)=>{const tot=allDraws.reduce((s,dr)=>s+dr.nums.filter(n=>n>=d.min&&n<=d.max).length,0);return{...d,idx:i,media:tot/allDraws.length,pct:tot/(allDraws.length*PICK)*100};});
            const maxMedia=Math.max(...medieDec.map(m=>m.media));
            const toggleDecEJ=(idx,delta)=>setDecineAttive(prev=>{const next=new Map(prev);const nv=Math.max(0,Math.min((next.get(idx)||0)+delta,PICK));if(nv===0)next.delete(idx);else next.set(idx,nv);return next;});
            return(<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,gridColumn:"1 / -1"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{color:ACCENT,fontSize:11,fontWeight:700}}>🔢 Filtro Decine</div>
                <button onClick={()=>setDecineAttive(new Map())} style={{background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 8px",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>✕ Reset</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
                {medieDec.map((d,i)=>{const cnt=decineAttive.get(i)||0;return(<div key={d.label} style={{background:cnt>0?`${DC[i]}18`:"#080816",border:`2px solid ${cnt>0?DC[i]:C.border}`,borderRadius:8,padding:"5px 3px",textAlign:"center"}}>
                  <div style={{color:DC[i],fontSize:8,fontWeight:700}}>{d.label}</div>
                  <div style={{background:"#0a0a18",borderRadius:3,height:3,overflow:"hidden",margin:"2px 0"}}><div style={{background:DC[i],height:"100%",width:`${(d.media/Math.max(maxMedia,0.1)*100)}%`}}/></div>
                  <div style={{color:DC[i],fontSize:9,fontWeight:700}}>{d.pct.toFixed(1)}%</div>
                  <div style={{color:cnt>0?DC[i]:"#555",fontSize:13,fontWeight:900,fontFamily:"monospace",minHeight:16}}>{cnt>0?cnt:"–"}</div>
                  <div style={{display:"flex",gap:2,justifyContent:"center"}}>
                    <button onClick={e=>{e.stopPropagation();toggleDecEJ(i,-1);}} style={{width:20,height:20,borderRadius:4,background:cnt>0?"#1a0606":"#1a1a2e",color:cnt>0?C.red:"#333",border:`1px solid ${cnt>0?C.red:"#333"}`,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                    <button onClick={e=>{e.stopPropagation();toggleDecEJ(i,1);}} style={{width:20,height:20,borderRadius:4,background:`${DC[i]}22`,color:DC[i],border:`1px solid ${DC[i]}`,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
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
            <div style={{color:C.dim,fontSize:11,marginBottom:8}}>Clicca le cinquine che ti piacciono (max 10), poi premi <strong style={{color:"#FFD700"}}>Scegli Euro Numeri</strong></div>
            <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
              {results.map((r,i)=>{
                const k=r.nums.join(",");const isSel=selectedTattico.has(k);
                return(<div key={i} onClick={()=>{setSelectedTattico(prev=>{const next=new Set(prev);if(next.has(k))next.delete(k);else if(next.size<10)next.add(k);return next;});}} style={{background:isSel?`${ACCENT}12`:"#080816",border:`2px solid ${isSel?ACCENT:C.border}`,borderRadius:8,padding:"7px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${isSel?ACCENT:C.dim}`,background:isSel?ACCENT:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#000",fontWeight:900,flexShrink:0}}>{isSel?"✓":""}</div>
                  <div style={{display:"flex",gap:3,flex:1,flexWrap:"wrap"}}>{r.nums.map(n=>{const s=scored.find(x=>x.num===n);const col=s?.isHot?C.orange:s?.isCold?C.teal:ACCENT;return <Ball key={n} num={n} color={col} size={26}/>;})}</div>
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
                ⭐ Scegli Euro Numeri per {selectedTattico.size} cinquine selezionate
              </button>
            )}
          </>
        )}
        {showSSTattico&&(
          <div style={{background:C.card,border:`2px solid ${C.purple}44`,borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{color:C.purple,fontWeight:700,fontSize:14,marginBottom:14}}>⭐ Scegli gli Euro Numeri</div>
            {results.filter(r=>selectedTattico.has(r.nums.join(","))).map((r,idx)=>{
              const k=r.nums.join(",");
              const bonusFreq={};allDraws.forEach(d=>(d.bonus||[]).forEach(b=>{bonusFreq[b]=(bonusFreq[b]||0)+1;}));
              const totB=Object.values(bonusFreq).reduce((s,v)=>s+v,0);
              const topBonus=Array.from({length:BONUS_POOL},(_,i)=>i+1).map(n=>{const f=bonusFreq[n]||0;let rit=allDraws.length;for(let i=allDraws.length-1;i>=0;i--){if((allDraws[i].bonus||[]).includes(n)){rit=allDraws.length-1-i;break;}}return{n,f,rit,pct:totB?Math.round(f/totB*100):0};}).sort((a,b)=>b.f-a.f);
              const maxF=Math.max(...topBonus.map(x=>x.f),1);
              const chosen=chosenSSTattico[k];
              return(
                <div key={idx} style={{background:"#080816",border:`1px solid ${C.purple}33`,borderRadius:10,padding:12,marginBottom:12}}>
                  <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                    <span style={{color:C.dim,fontSize:10}}>#{idx+1}</span>
                    {r.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={28}/>)}
                    <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700,fontFamily:"monospace"}}>Σ{r.sum}</span>
                  </div>
                  <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Scegli 2 Euro Numeri (1–12) per affinità:</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                    {topBonus.map(t=>{const isCho=(chosen||[]).includes(t.n);return(
                      <div key={t.n} onClick={()=>setChosenSSTattico(prev=>{const cur=prev[k]||[];const next=cur.includes(t.n)?cur.filter(x=>x!==t.n):cur.length<BONUS_COUNT?[...cur,t.n]:cur;return{...prev,[k]:next};})
                      } style={{textAlign:"center",cursor:"pointer",padding:"4px 3px",background:isCho?"#FFD70018":"#0e0e1c",border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,borderRadius:7,boxShadow:isCho?"0 0 8px #FFD70044":"none"}}>
                        <Ball num={t.n} size={24} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho}/>
                        <div style={{background:"#0a0a18",borderRadius:2,height:3,overflow:"hidden",margin:"2px 0",width:24}}><div style={{background:isCho?"#FFD700":"#d97706",height:"100%",width:`${Math.round(t.f/maxF*100)}%`}}/></div>
                        <div style={{color:isCho?"#FFD700":"#888",fontSize:8}}>{t.pct}%</div>
                      </div>
                    );})}
                  </div>
                  <div style={{background:chosen?.length?`#FFD70008`:C.card,border:`1px solid ${chosen?.length?"#FFD70033":C.border}`,borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{color:C.dim,fontSize:11}}>Euro Numeri:</span>
                    {chosen?.length?(
                      <>{chosen.sort((a,b)=>a-b).map(n=><Ball key={n} num={n} size={30} gold glow/>)}<span style={{color:"#FFD700",fontWeight:700,fontSize:13,fontFamily:"monospace"}}>{chosen.sort((a,b)=>a-b).join(" – ")}</span></>
                    ):<span style={{color:"#555",fontSize:11}}>Seleziona 2 numeri sopra</span>}
                  </div>
                  {chosen?.length===BONUS_COUNT&&(<button onClick={async()=>{const t={id:Date.now()+idx,nums:r.nums,bonus:chosen,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy:"tattico",sum:r.sum};await salvaTicketEJ(t);alert(`✅ Linea ${idx+1} salvata!\n${r.nums.join("-")} | EN:${chosen.sort((a,b)=>a-b).join("-")}`);}} style={{width:"100%",padding:"8px",marginTop:8,background:`${C.purple}22`,color:C.purple,border:`2px solid ${C.purple}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💾 Salva</button>)}
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
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);
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

  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🔁 Confronto Cinquina</h2>
      <div style={{background:C.card,border:`1px solid ${ACCENT}33`,borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{color:ACCENT,fontWeight:700,fontSize:12,marginBottom:8}}>Inserisci la tua cinquina da confrontare</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
          <input type="text" value={userInput} onChange={e=>setUserInput(e.target.value)} placeholder="Es. 7 15 23 38 45" style={{flex:1,minWidth:180,background:"#080816",color:ACCENT,border:`1px solid ${ACCENT}55`,borderRadius:8,padding:"10px 12px",fontSize:14,fontFamily:"monospace",outline:"none"}}/>
          <button onClick={confronta} style={{padding:"10px 20px",background:`linear-gradient(135deg,${ACCENT},${C.teal})`,color:"#000",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🔍 Confronta</button>
        </div>
        {userNums.length===PICK&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
            {userNums.map(n=><Ball key={n} num={n} color={ACCENT} size={34} glow/>)}
            <div style={{display:"flex",gap:8,marginLeft:8,flexWrap:"wrap"}}>
              <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700}}>Σ={userSum}</span>
              <span style={{background:`${C.teal}22`,color:C.teal,borderRadius:6,padding:"4px 10px",fontSize:12}}>z={zUser?.toFixed(2)}</span>
              <span style={{background:"#12122a",color:C.dim,borderRadius:6,padding:"4px 10px",fontSize:12}}>{userNums.filter(n=>n%2===0).length}P–{userNums.filter(n=>n%2!==0).length}D</span>
            </div>
          </div>
        )}
      </div>
      {compared.length>0&&(
        <div>
          <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:10}}>Ultime 50 estrazioni — ordinato per punti</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {compared.map(r=>{
              const col=PRIZE_COLORS[Math.min(r.pts,5)]||C.dim;
              return(<div key={r.n} style={{background:r.pts>=2?`${col}12`:"#080816",border:`1px solid ${r.pts>=2?col:C.border}`,borderRadius:9,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:4}}>
                  <span style={{color:C.dim,fontSize:10}}>Est. <strong style={{color:ACCENT}}>#{r.n}</strong> · {r.date?.substring(0,5)||""} · Σ={sm(r.nums)}</span>
                  <span style={{color:col,fontWeight:700,fontSize:11}}>{r.pts>0?`${r.pts} punt${r.pts===1?"o":"i"}`:"–"}</span>
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
                  {r.nums.map(n=>{const hit=userNums.includes(n);return(<div key={n} style={{position:"relative"}}><Ball num={n} color={hit?col:"#2a2a3a"} size={28} glow={hit&&r.pts>=2}/>{hit&&<div style={{position:"absolute",top:-3,right:-3,width:9,height:9,borderRadius:"50%",background:col,border:"1px solid #06060e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:6,color:"#000",fontWeight:900}}>✓</div>}</div>);})}
                  <span style={{color:C.dim,fontSize:14,alignSelf:"center"}}>│</span>
                  {(r.bonus||[]).map(b=><Ball key={b} num={b} size={26} gold/>)}
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
  const [concorso,setConcorso]=useState("");const [date,setDate]=useState("");
  const [nums,setNums]=useState(Array(PICK).fill(""));const [bonus,setBonus]=useState(Array(BONUS_COUNT).fill(""));
  const [saved,setSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_KEY_EJ)||"[]");}catch{return [];}});
  const [error,setError]=useState("");const [success,setSuccess]=useState("");const [savingToDb,setSavingToDb]=useState(false);
  const persist=(list)=>{localStorage.setItem(LS_KEY_EJ,JSON.stringify(list));setSaved(list);onUpdate(list);};
  const add=async()=>{
    setError("");setSuccess("");
    const n=parseInt(concorso)||0;const pNums=nums.map(v=>parseInt(v)||0);const pBonus=bonus.map(v=>parseInt(v)||0);
    if(!date.trim()){setError("Inserisci la data");return;}
    if(pNums.some(x=>x<1||x>POOL)){setError(`Numeri 1–${POOL}`);return;}
    if([...new Set(pNums)].length!==PICK){setError("Numeri duplicati");return;}
    if(pBonus.some(x=>x<1||x>BONUS_POOL)){setError("Euro Numeri 1–12");return;}
    const newDraw={n,date:date.trim(),nums:[...new Set(pNums)].sort((a,b)=>a-b),bonus:pBonus.sort((a,b)=>a-b)};
    setSavingToDb(true);
    try{
      const parts=date.trim().split("/");const dateIso=parts.length===2?`2026-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`:date.trim();
      const {error:dbErr}=await supabase.from("eurojackpot").insert({data:dateIso,n1:pNums[0],n2:pNums[1],n3:pNums[2],n4:pNums[3],n5:pNums[4],e1:pBonus[0],e2:pBonus[1]});
      if(dbErr)throw dbErr;
      setSuccess(`✅ Concorso #${n} salvato nel DB!`);
    }catch(err){setSuccess(`✅ Salvato localmente`);}
    setSavingToDb(false);
    persist([...saved,newDraw].sort((a,b)=>(a.n||0)-(b.n||0)));
    try{if(allDraws.length>=6){const lstm=computeLSTMEJ(allDraws);const reg=computeRegressionEJ(allDraws);const combined=Math.round(lstm.predictedSum*0.40+reg.predicted*0.35+reg.wma*0.25);const zPred=zOf(combined,MU_TEO,SIGMA_TEO);await supabase.from("predizioni").insert({lotteria:"eurojackpot",concorso:n,data_predizione:dateIso,somma_predetta:combined,somma_reale:sm(newDraw.nums),lstm:lstm.predictedSum,regressione:reg.predicted,wma:Math.round(reg.wma),trend:lstm.currentTrend,z_predetto:parseFloat(zPred.toFixed(3)),scarto:sm(newDraw.nums)-combined});}}catch(err){console.error("Predizione EJ save error:",err);}
    setConcorso("");setDate("");setNums(Array(PICK).fill(""));setBonus(Array(BONUS_COUNT).fill(""));
    setTimeout(()=>setSuccess(""),4000);
  };
  return(
    <div>
      <h2 style={{color:C.green,fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>📥 Inserimento Nuove Estrazioni</h2>
      <div style={{background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:11}}><span style={{color:C.teal}}>🔗 Database Supabase — </span><span style={{color:C.dim}}>{allDraws.length} estrazioni storiche</span></div>
      <div style={{background:"#0a1a0a",border:`2px solid ${C.green}44`,borderRadius:12,padding:16,marginBottom:20}}>
        <div style={{color:C.green,fontWeight:700,fontSize:13,marginBottom:12}}>➕ Aggiungi estrazione EuroJackpot</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
          <div><div style={{color:C.dim,fontSize:10,marginBottom:3}}>Concorso #</div><input type="number" value={concorso} onChange={e=>setConcorso(e.target.value)} placeholder="43" style={{width:70,textAlign:"center",background:"#050510",color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 4px",fontSize:14,fontFamily:"monospace",outline:"none"}}/></div>
          <div><div style={{color:C.dim,fontSize:10,marginBottom:3}}>Data (gg/mm)</div><input type="text" value={date} onChange={e=>setDate(e.target.value)} placeholder="dd/mm" style={{width:80,textAlign:"center",background:"#050510",color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 6px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{color:C.dim,fontSize:10,marginBottom:6}}>{PICK} Numeri (1–{POOL})</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {nums.map((v,i)=>{const num=parseInt(v)||0,valid=num>=1&&num<=POOL;const isDup=valid&&nums.filter(x=>parseInt(x)===num).length>1;return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><Ball num={valid&&!isDup?num:"?"} color={isDup?C.red:ACCENT} size={36} glow={valid&&!isDup}/><input type="number" min={1} max={POOL} value={v} onChange={e=>{const n=[...nums];n[i]=e.target.value;setNums(n);}} placeholder={`N${i+1}`} style={{width:46,textAlign:"center",background:"#050510",color:isDup?C.red:valid?ACCENT:C.dim,border:`1.5px solid ${isDup?C.red:valid?`${ACCENT}66`:C.border}`,borderRadius:7,padding:"5px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>);})}
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:8}}><span style={{color:C.dim,fontSize:16}}>│</span>
              <div><div style={{color:"#FFD700",fontSize:10,marginBottom:4}}>Euro Numeri (1–12)</div>
                <div style={{display:"flex",gap:6}}>{bonus.map((v,i)=>{const num=parseInt(v)||0,valid=num>=1&&num<=BONUS_POOL;return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><Ball num={valid?num:"?"} size={36} gold={valid}/><input type="number" min={1} max={BONUS_POOL} value={v} onChange={e=>{const n=[...bonus];n[i]=e.target.value;setBonus(n);}} style={{width:44,textAlign:"center",background:"#050510",color:"#FFD700",border:"1.5px solid #FFD70055",borderRadius:7,padding:"5px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>);})}</div>
              </div>
            </div>
          </div>
        </div>
        {error&&<div style={{color:C.red,fontSize:12,marginBottom:8,padding:"6px 10px",background:`${C.red}11`,borderRadius:6}}>⚠️ {error}</div>}
        {success&&<div style={{color:C.green,fontSize:12,marginBottom:8,padding:"6px 10px",background:`${C.green}11`,borderRadius:6}}>{success}</div>}
        <button onClick={add} disabled={savingToDb} style={{width:"100%",padding:"12px",background:savingToDb?"#1a3a1a":`linear-gradient(135deg,${C.green},#2BA89A)`,color:savingToDb?"#4A9E5C":"#050510",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:savingToDb?"not-allowed":"pointer",fontFamily:"Georgia,serif"}}>{savingToDb?"⏳ Salvataggio...":"✅ Aggiungi Estrazione"}</button>
      </div>
    </div>
  );
}

function TabBiglietti(){
  const allDraws=useDraws();
  const [tickets,setTickets]=useState([]);
  const [loadingTickets,setLoadingTickets]=useState(true);
  const [expanded,setExpanded]=useState(null);const [confirmDel,setConfirmDel]=useState(null);
  const [maxSestine,setMaxSestine]=useState(2);
  const loadTickets=async()=>{
    setLoadingTickets(true);
    try{
      const {data,error}=await supabase.from("tickets").select("*").eq("lotteria","eurojackpot").order("created_at",{ascending:false});
      if(error)throw error;
      const dbTickets=data.map(r=>({id:r.id,nums:r.nums,bonus:r.bonus||[],date:r.data_gioco||"",concorso:r.concorso||0,strategy:r.strategy||"",sum:r.somma||0,fromDb:true,giocato:r.giocato||false,inSistema:r.in_sistema||false}));
      const local=JSON.parse(localStorage.getItem(LS_TICKETS_EJ)||"[]");
      const dbIds=new Set(dbTickets.map(t=>String(t.id)));
      const localOnly=local.filter(t=>!dbIds.has(String(t.id)));
      setTickets([...dbTickets,...localOnly]);
    }catch(err){
      try{setTickets(JSON.parse(localStorage.getItem(LS_TICKETS_EJ)||"[]"));}catch{}
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
    const local=JSON.parse(localStorage.getItem(LS_TICKETS_EJ)||"[]");
    localStorage.setItem(LS_TICKETS_EJ,JSON.stringify(local.filter(t=>t.id!==id)));
    setTickets(prev=>prev.filter(t=>t.id!==id));
    setConfirmDel(null);setExpanded(null);
  };
  function getResults(ticket){const fromN=ticket.concorso||0;return allDraws.filter(d=>(d.n||0)>fromN).map(d=>{const matches=d.nums.filter(n=>ticket.nums.includes(n));return{n:d.n,date:d.date,nums:d.nums,bonus:d.bonus,pts:matches.length,matches};});}
  return(
    <div>
      <h2 style={{color:C.purple,fontFamily:"Georgia,serif",fontSize:16,marginBottom:4}}>🎫 Biglietti Giocati</h2>
      {loadingTickets&&<div style={{textAlign:"center",padding:40,color:C.dim}}><div style={{fontSize:24,marginBottom:8}}>⏳</div><div>Caricamento biglietti...</div></div>}
      {!loadingTickets&&<><div style={{background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:8,padding:"6px 12px",marginBottom:12,fontSize:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:C.teal}}>🔗 Supabase — sincronizzati su tutti i dispositivi</span><button onClick={loadTickets} style={{background:"transparent",color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>↻ Aggiorna</button></div>
      <p style={{color:C.dim,fontSize:11,marginBottom:16,lineHeight:1.7}}>{tickets.length} biglietti · confronto automatico con {allDraws.length} estrazioni.</p>
      {tickets.length===0&&(<div style={{textAlign:"center",color:C.dim,padding:"28px 0",fontSize:13,background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>Nessun biglietto.<br/><span style={{fontSize:11}}>Genera nel tab 🎯 e premi 💾 Salva.</span></div>)}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[...tickets].sort((a,b)=>b.id-a.id).map(ticket=>{
          const results=getResults(ticket);const bestPts=results.length?Math.max(...results.map(r=>r.pts)):0;
          const bestCol=PRIZE_COLORS[Math.min(bestPts,5)]||C.dim;const isOpen=expanded===ticket.id;const pendingDel=confirmDel===ticket.id;
          return(<div key={ticket.id} style={{background:C.card,border:`2px solid ${pendingDel?"#C94040":bestPts>=2?bestCol:C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",cursor:"pointer"}} onClick={()=>{if(!pendingDel)setExpanded(isOpen?null:ticket.id);}}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                {ticket.nums.map(n=>{const hitAny=results.some(r=>r.matches.includes(n));return<Ball key={n} num={n} color={hitAny?bestCol:ACCENT} size={30} glow={hitAny&&bestPts>=2}/>;})}
                {ticket.bonus?.length>0&&<><span style={{color:C.dim,fontSize:14,alignSelf:"center"}}>│</span>{ticket.bonus.map(b=><Ball key={b} num={b} size={28} gold/>)}<span style={{color:"#FFD700",fontSize:8}}>EN</span></>}
              </div>
              <div style={{flex:1,minWidth:120}}>
                <div style={{color:C.dim,fontSize:10}}>Giocato {ticket.date} · dopo #{ticket.concorso||"?"} · Σ={sm(ticket.nums)}{ticket.fromDb&&<span style={{marginLeft:4,color:C.teal,fontSize:8}}>☁️</span>}<button onClick={e=>{e.stopPropagation();toggleGiocato(ticket.id,ticket.giocato);}} style={{marginLeft:6,background:ticket.giocato?"#4A9E5C22":"#1a1a2e",color:ticket.giocato?C.green:C.dim,border:`1px solid ${ticket.giocato?C.green:C.border}`,borderRadius:6,padding:"1px 7px",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{ticket.giocato?"✅ Giocato":"📋 Non giocato"}</button>
<button onClick={e=>{e.stopPropagation();toggleInSistema(ticket.id,ticket.inSistema);}} style={{marginLeft:4,background:ticket.inSistema?"#4A8FD422":"#1a1a2e",color:ticket.inSistema?"#4A8FD4":C.dim,border:`1px solid ${ticket.inSistema?"#4A8FD4":C.border}`,borderRadius:6,padding:"1px 7px",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{ticket.inSistema?"🎰 In Sistema":"➕ Sistema"}</button></div>
                {results.length>0?(<div style={{color:bestPts>=2?bestCol:C.dim,fontWeight:700,fontSize:12}}>{bestPts>=2?`🎯 max ${bestPts}✓`:`Nessun punto`}</div>):<div style={{color:C.dim,fontSize:11}}>⏳ In attesa</div>}
              </div>
              {bestPts>=2&&!pendingDel&&(<div style={{background:`${bestCol}22`,border:`2px solid ${bestCol}`,borderRadius:8,padding:"5px 10px",textAlign:"center"}}><div style={{color:bestCol,fontSize:20,fontWeight:900,fontFamily:"monospace"}}>{bestPts}</div><div style={{color:bestCol,fontSize:8}}>punti</div></div>)}
              <span style={{color:C.dim}}>{isOpen&&!pendingDel?"▲":"▼"}</span>
            </div>
            {pendingDel&&(<div style={{background:"#1a0606",borderTop:"1px solid #C94040",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><span style={{color:"#C94040",fontSize:12,fontWeight:700,flex:1}}>🗑 Confermi eliminazione?</span><button onClick={()=>remove(ticket.id)} style={{background:"#C94040",color:"#fff",border:"none",borderRadius:7,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Sì</button><button onClick={()=>setConfirmDel(null)} style={{background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>No</button></div>)}
            {isOpen&&!pendingDel&&(<div style={{borderTop:`1px solid ${C.border}`,padding:"12px 14px",background:"#06060e"}}>
              {results.length===0?<div style={{color:C.dim,fontSize:12,textAlign:"center"}}>⏳ Nessuna estrazione successiva.</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {results.map(r=>{const col=PRIZE_COLORS[Math.min(r.pts,5)]||C.dim;const hasPts=r.pts>0;return(<div key={r.n} style={{background:r.pts>=2?`${col}10`:hasPts?`${col}08`:"#07070f",border:`1px solid ${r.pts>=2?col:hasPts?col+"66":C.border}`,borderRadius:8,padding:"8px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6,marginBottom:6}}><span style={{color:C.dim,fontSize:11}}>Est. <strong style={{color:ACCENT}}>#{r.n}</strong> · {r.date?.substring(0,5)||""}</span><span style={{color:col,fontWeight:700,fontSize:12}}>{PRIZE_LABELS[Math.min(r.pts,5)]}</span></div>
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
      {tickets.filter(t=>t.inSistema).length>=2&&(()=>{
        const candidati=tickets.filter(t=>t.inSistema);
        const advScores=computeAdvancedScoresEJ(allDraws,avg(buildSeries(allDraws).map(d=>d.sum)),std(buildSeries(allDraws).map(d=>d.sum)));
        const scored=candidati.map(t=>{const advMean=t.nums.reduce((acc,n)=>{const a=advScores.find(x=>x.num===n);return acc+(a?a.unified:0);},0)/t.nums.length;return {...t,advScore:advMean};});
        function diversity(a,b){return 1-a.nums.filter(n=>b.nums.includes(n)).length/PICK;}
        function selectOptimal(pool,k){const selected=[];const remaining=[...pool].sort((a,b)=>b.advScore-a.advScore);selected.push(remaining.shift());while(selected.length<k&&remaining.length>0){let bestIdx=0,bestScore=-Infinity;remaining.forEach((c,i)=>{const divScore=selected.reduce((a,s)=>a+diversity(c,s),0)/selected.length;const combined=c.advScore*0.5+divScore*50*0.5;if(combined>bestScore){bestScore=combined;bestIdx=i;}});selected.push(remaining.splice(bestIdx,1)[0]);}return selected;}
        const optimal=selectOptimal(scored,Math.min(maxSestine,candidati.length));
        const totalNums=[...new Set(optimal.flatMap(t=>t.nums))];
        return(<div style={{marginTop:24,background:"#080816",border:"2px solid #4A8FD4",borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{color:"#4A8FD4",fontWeight:700,fontSize:14,marginBottom:4,fontFamily:"Georgia,serif"}}>🎰 Sistema Ottimale</div>
          <div style={{color:C.dim,fontSize:10,marginBottom:12}}>{candidati.length} candidati · {totalNums.length} numeri distinti coperti</div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
            <span style={{color:C.dim,fontSize:11}}>Max cinquine:</span>
            {[1,2,3,4,5,6,8,10].map(n=>(<button key={n} onClick={()=>setMaxSestine(n)} style={{background:maxSestine===n?"#4A8FD422":"transparent",color:maxSestine===n?"#4A8FD4":C.dim,border:`1px solid ${maxSestine===n?"#4A8FD4":C.border}`,borderRadius:8,padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            {optimal.map((t,i)=>{const divMedia=optimal.filter((_,j)=>j!==i).reduce((a,o)=>a+diversity(t,o),0)/Math.max(optimal.length-1,1);return(<div key={t.id} style={{background:"#0a0a18",border:"1px solid #4A8FD444",borderRadius:10,padding:"10px 12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                <span style={{color:"#4A8FD4",fontFamily:"monospace",fontSize:11}}>#{i+1}</span>
                {t.nums.map(n=><Ball key={n} num={n} color="#4A8FD4" size={30} glow/>)}
                {t.bonus?.length>0&&<><span style={{color:C.dim}}>│</span>{t.bonus.map(b=><Ball key={b} num={b} size={28} gold/>)}<span style={{color:"#FFD700",fontSize:8}}>EN</span></>}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <span style={{background:"#4A8FD422",color:"#4A8FD4",borderRadius:4,padding:"2px 8px",fontSize:9,fontFamily:"monospace"}}>Σ {t.sum}</span>
                <span style={{background:C.purple+"22",color:C.purple,borderRadius:4,padding:"2px 8px",fontSize:9}}>{t.strategy}</span>
                <span style={{background:C.teal+"22",color:C.teal,borderRadius:4,padding:"2px 8px",fontSize:9}}>score {t.advScore.toFixed(0)}</span>
                <span style={{background:C.orange+"22",color:C.orange,borderRadius:4,padding:"2px 8px",fontSize:9}}>div {(divMedia*100).toFixed(0)}%</span>
              </div>
            </div>);})}
          </div>
          <div style={{background:"#0a0a18",borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{color:"#4A8FD4",fontSize:10,fontWeight:700,marginBottom:6}}>📊 Numeri coperti ({totalNums.length}/50)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>{totalNums.sort((a,b)=>a-b).map(n=><Ball key={n} num={n} color="#4A8FD4" size={24}/>)}</div>
          </div>
          <button onClick={async()=>{for(const t of optimal){await supabase.from("tickets").update({giocato:true}).eq("id",t.id);}setTickets(prev=>prev.map(t=>optimal.find(o=>o.id===t.id)?{...t,giocato:true}:t));alert(`✅ ${optimal.length} cinquine marcate come Giocato!`);}} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#4A8FD4,#2BA89A)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✅ Segna tutte come Giocato</button>
        </div>);
      })()}
      {tickets.length>0&&(()=>{
        const strategies=["tattico","suggeritore","unificato","auto"];
        const stratColors={"tattico":"#FF6B35","suggeritore":"#a78bfa","unificato":"#f59e0b","auto":ACCENT};
        const stratIcons={"tattico":"⚡","suggeritore":"🔮","unificato":"⭐","auto":"🤖"};
        const ticketsWithPts=tickets.map(ticket=>{const fromN=ticket.concorso||0;const draws=allDraws.filter(d=>(d.n||0)>fromN);const maxPts=draws.length>0?Math.max(...draws.map(d=>d.nums.filter(n=>ticket.nums.includes(n)).length)):0;return {...ticket,maxPts,hasResult:draws.length>0};});
        const calcSt=(group)=>{if(group.length===0)return null;const avgPts=group.reduce((a,t)=>a+t.maxPts,0)/group.length;const best=Math.max(...group.map(t=>t.maxPts));const with2plus=group.filter(t=>t.maxPts>=2).length;const with3plus=group.filter(t=>t.maxPts>=3).length;const score=Math.round((avgPts/5)*40+(with2plus/group.length)*40+(best/5)*20);return{count:group.length,avgPts:avgPts.toFixed(2),best,with2plus,with3plus,score};};
        const stratStats={};
        strategies.forEach(s=>{const all=ticketsWithPts.filter(t=>(t.strategy||"auto")===s&&t.hasResult);const giocati=all.filter(t=>t.giocato);const nonGiocati=all.filter(t=>!t.giocato);if(all.length===0)return;stratStats[s]={...calcSt(all),giocati:calcSt(giocati),nonGiocati:calcSt(nonGiocati)};});
        const sorted=Object.entries(stratStats).sort((a,b)=>b[1].score-a[1].score);
        if(sorted.length===0)return null;
        const maxScore=sorted[0][1].score||1;
        return(<div style={{marginTop:24,background:C.card,border:`1px solid ${ACCENT}33`,borderRadius:12,padding:16}}>
          <div style={{color:ACCENT,fontWeight:700,fontSize:14,marginBottom:4,fontFamily:"Georgia,serif"}}>📊 Performance Strategie</div>
          <div style={{color:C.dim,fontSize:10,marginBottom:16,lineHeight:1.6}}>Score composito basato su punti medi, % biglietti con ≥2 punti e miglior risultato.</div>
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
                    {data?(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                      {[{l:"Biglietti",v:data.count},{l:"Media pt",v:data.avgPts},{l:"Miglior",v:`${data.best}pt`},{l:"Con 2+",v:`${data.with2plus}/${data.count}`}].map(x=>(<div key={x.l} style={{background:"#050510",borderRadius:4,padding:"4px 6px",textAlign:"center"}}><div style={{color:C.dim,fontSize:7}}>{x.l}</div><div style={{color:dc,fontFamily:"monospace",fontSize:11,fontWeight:700}}>{x.v}</div></div>))}
                    </div>):(<div style={{color:C.dim,fontSize:10,textAlign:"center",padding:"8px 0"}}>—</div>)}
                  </div>
                ))}
              </div>
            </div>);})}
          </div>
          <div style={{marginTop:12,color:C.dim,fontSize:9,lineHeight:1.7,borderTop:`1px solid ${C.border}`,paddingTop:10}}>Score = media punti (40%) + % biglietti con ≥2 punti (40%) + miglior risultato (20%).</div>
        </div>);
      })()}
      {tickets.length>0&&(<div style={{marginTop:14,display:"flex",gap:8,alignItems:"center"}}><span style={{color:C.dim,fontSize:10}}>{tickets.length} biglietti totali</span></div>)}
      </>}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// PARTI NUOVE PER AppEuroJackpot.tsx
// Inserire PRIMA della costante TABS
// ═══════════════════════════════════════════════════════════════

// ─── MOTORE AVANZATO EJ (50 numeri, 5 pick) ──────────────────

async function salvaTicketEJ(ticket){
  const prev=JSON.parse(localStorage.getItem(LS_TICKETS_EJ)||"[]");
  const exists=prev.some(t=>t.id===ticket.id);
  if(!exists) localStorage.setItem(LS_TICKETS_EJ,JSON.stringify([...prev,ticket]));
  try{
    const {error}=await supabase.from("tickets").upsert({
      id:ticket.id,lotteria:"eurojackpot",nums:ticket.nums,
      bonus:ticket.bonus||null,data_gioco:ticket.date,
      concorso:ticket.concorso,strategy:ticket.strategy,somma:ticket.sum,
    });
    if(error)throw error;
    return true;
  }catch(err){console.error("Ticket EJ save error:",err);return false;}
}

function getMarkovStateEJ(nums) {
  const s=nums.reduce((a,b)=>a+b,0);
  const e=nums.filter(n=>n%2===0).length;
  const cat=s<105?'L':s>150?'H':'M';
  const par=e>=3?'P':'D';
  return cat+par;
}

function computeMarkovEJ(draws) {
  const states=['LP','LD','MP','MD','HP','HD'];
  const trans={};
  states.forEach(s=>{trans[s]={};states.forEach(t=>trans[s][t]=0);});
  for(let i=1;i<draws.length;i++){
    const from=getMarkovStateEJ(draws[i-1].nums);
    const to=getMarkovStateEJ(draws[i].nums);
    trans[from][to]++;
  }
  const prob={};
  states.forEach(s=>{
    const tot=Object.values(trans[s]).reduce((a,b)=>a+b,0);
    prob[s]={};
    states.forEach(t=>prob[s][t]=tot>0?trans[s][t]/tot:0);
  });
  const lastState=getMarkovStateEJ(draws[draws.length-1].nums);
  const nextProbs=prob[lastState]||{};
  const bestNext=Object.entries(nextProbs).sort((a,b)=>b[1]-a[1])[0];
  return {lastState,nextProbs,bestNext,states};
}

function analyzeCyclesEJ(draws) {
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
    return {num,cycle:parseFloat(avgGap.toFixed(1)),phase:parseFloat(phase.toFixed(2)),score:Math.min(phase,3)/3,currentGap,lastApp};
  });
}

function computeClustersEJ(draws,muReale,sigmaReale) {
  function getFeatures(nums){
    const s=nums.reduce((a,b)=>a+b,0);
    const e=nums.filter(n=>n%2===0).length;
    const decades=[0,0,0,0,0];
    nums.forEach(n=>decades[Math.floor((n-1)/10)]++);
    const maxDec=Math.max(...decades);
    const gaps=[];
    for(let i=1;i<nums.length;i++) gaps.push(nums[i]-nums[i-1]);
    const avgGap=gaps.reduce((a,b)=>a+b,0)/gaps.length;
    return [(s-muReale)/Math.max(sigmaReale,1),(e-2.5)/2.5,maxDec/PICK,(avgGap-10)/10];
  }
  const features=draws.map(d=>getFeatures(d.nums));
  const k=4,iterations=15;
  let centroids=features.slice(0,k).map(d=>[...d]);
  let assignments=new Array(features.length).fill(0);
  for(let iter=0;iter<iterations;iter++){
    features.forEach((point,i)=>{
      let minDist=Infinity,best=0;
      centroids.forEach((c,j)=>{const dist=point.reduce((sum,v,ki)=>sum+(v-c[ki])**2,0);if(dist<minDist){minDist=dist;best=j;}});
      assignments[i]=best;
    });
    centroids=Array.from({length:k},(_,ci)=>{
      const pts=features.filter((_,i)=>assignments[i]===ci);
      if(pts.length===0) return centroids[ci];
      return pts[0].map((_,j)=>pts.reduce((sum,p)=>sum+p[j],0)/pts.length);
    });
  }
  const recent=assignments.slice(-30);
  const counts=[0,0,0,0];
  recent.forEach(c=>counts[c]++);
  const dominant=counts.indexOf(Math.max(...counts));
  const dc=centroids[dominant];
  return {assignments,centroids,dominant,counts,
    domInfo:{sumBias:(dc[0]*sigmaReale+muReale).toFixed(0),evensBias:(dc[1]*2.5+2.5).toFixed(1),gapBias:(dc[3]*10+10).toFixed(1)}};
}

function localEntropyEJ(window) {
  const freq=new Array(POOL+1).fill(0);
  window.forEach(d=>d.nums.forEach(n=>freq[n]++));
  const total=window.length*PICK;
  let H=0;
  for(let i=1;i<=POOL;i++){const p=freq[i]/total;if(p>0)H-=p*Math.log2(p);}
  return H/Math.log2(POOL);
}

function computeEntropyTimelineEJ(draws,windowSize=50) {
  const timeline=[];
  for(let i=windowSize;i<=draws.length;i++){
    timeline.push({idx:i,entropy:localEntropyEJ(draws.slice(i-windowSize,i)),date:draws[i-1]?.date?.substring(0,5)||""});
  }
  const vals=timeline.map(t=>t.entropy);
  const avgE=vals.reduce((a,b)=>a+b,0)/vals.length;
  const current=vals[vals.length-1]||0;
  return {timeline,avgEntropy:avgE,currentEntropy:current,isChaotic:current>avgE};
}

function computeAdvancedScoresEJ(draws,muReale,sigmaReale) {
  const N=draws.length;
  const cycles=analyzeCyclesEJ(draws);
  return Array.from({length:POOL},(_,i)=>{
    const num=i+1;
    const cyc=cycles[i];
    const cycleScore=cyc.score;
    // Bayesiano
    const recent=draws.slice(-150);
    const freqR=recent.filter(d=>d.nums.includes(num)).length;
    const alpha=freqR+1,beta=150-freqR+1;
    const posteriorMean=alpha/(alpha+beta);
    const expectedProb=PICK/POOL;
    const bayesScore=Math.min(Math.max(0,expectedProb-posteriorMean)*20,1);
    // Ritardo
    let rit=N;
    for(let j=N-1;j>=0;j--) if(draws[j].nums.includes(num)){rit=N-1-j;break;}
    const ritScore=Math.min(rit/N,1);
    // Freq deficit
    const freq=draws.filter(d=>d.nums.includes(num)).length;
    const expected=N*PICK/POOL;
    const freqScore=Math.max(0,(expected-freq)/Math.max(expected,1));
    const unified=cycleScore*0.30+bayesScore*0.25+ritScore*0.25+freqScore*0.20;
    return {num,unified:parseFloat((unified*100).toFixed(1)),cycleScore:parseFloat((cycleScore*100).toFixed(1)),bayesScore:parseFloat((bayesScore*100).toFixed(1)),ritScore:parseFloat((ritScore*100).toFixed(1)),freqScore:parseFloat((freqScore*100).toFixed(1)),rit,freq,cycle:cyc.cycle,phase:cyc.phase};
  }).sort((a,b)=>b.unified-a.unified);
}

// ─── QUALITY SCORE ────────────────────────────────────────────
function calcQualityScoreEJ(nums,allDraws,freq,sigmaReale,muReale,advScores) {
  const s=nums.reduce((a,b)=>a+b,0);
  const zS=Math.abs((s-muReale)/Math.max(sigmaReale,1));
  const sumScore=Math.max(0,25-zS*8);
  const advMean=nums.reduce((acc,n)=>{const a=advScores.find(x=>x.num===n);return acc+(a?a.unified:0);},0)/nums.length;
  const advScore=(advMean/100)*50;
  const expected=allDraws.length*PICK/POOL;
  const anomaly=nums.reduce((acc,n)=>acc+Math.abs(freq[n]-expected)/Math.max(expected,1),0)/nums.length;
  const anomScore=Math.max(0,15-anomaly*15);
  const evens=nums.filter(n=>n%2===0).length;
  const pdScore=evens>=2&&evens<=3?10:5;
  return Math.round(sumScore+advScore+anomScore+pdScore);
}

function qualityStarsEJ(score){
  if(score>=80) return "⭐⭐⭐⭐⭐";
  if(score>=65) return "⭐⭐⭐⭐";
  if(score>=50) return "⭐⭐⭐";
  if(score>=35) return "⭐⭐";
  return "⭐";
}

function qualityLabelEJ(score){
  if(score>=80) return {l:"ECCELLENTE",c:"#FFD700"};
  if(score>=65) return {l:"OTTIMA",c:"#4A9E5C"};
  if(score>=50) return {l:"BUONA",c:"#2BA89A"};
  if(score>=35) return {l:"DISCRETA",c:"#F07030"};
  return {l:"BASSA",c:"#C94040"};
}

// ─── TAB SUGGERITORE EJ ──────────────────────────────────────
function TabSuggeritore(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);

  const [winSize,setWinSize]=useState(allDraws.length);
  const [kBand,setKBand]=useState(1.0);
  const [ratioMode,setRatioMode]=useState("auto");
  const [pesoRitardo,setPesoRitardo]=useState(50);
  const [qty,setQty]=useState(5);
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [selBonus,setSelBonus]=useState({});
  const [savedIds,setSavedIds]=useState(new Set());

  const winDraws=useMemo(()=>allDraws.slice(-Math.min(winSize,allDraws.length)),[allDraws,winSize]);

  const freq=useMemo(()=>{
    const f=Array(POOL+1).fill(0);
    winDraws.forEach(d=>d.nums.forEach(n=>f[n]++));
    return f;
  },[winDraws]);

  function getRitardo(num){for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].nums.includes(num))return allDraws.length-1-i;}return allDraws.length;}

  const scored=useMemo(()=>{
    const totalOcc=winDraws.length*PICK;
    const expected=totalOcc/POOL;
    const pw=pesoRitardo/100;
    return Array.from({length:POOL},(_,i)=>{
      const num=i+1,f=freq[num],rit=getRitardo(num);
      const freqScore=(expected-f)/Math.max(expected,1);
      const ritScore=rit/allDraws.length;
      return {num,f,rit,score:freqScore*(1-pw)+ritScore*pw};
    }).sort((a,b)=>b.score-a.score);
  },[freq,winDraws,allDraws,pesoRitardo]);

  const bestRatio=useMemo(()=>{
    const counts={};
    allDraws.forEach(d=>{const e=d.nums.filter(n=>n%2===0).length;const key=`${e}-${PICK-e}`;counts[key]=(counts[key]||0)+1;});
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"3-2";
  },[allDraws]);

  const targetEvens=useMemo(()=>{
    if(ratioMode==="auto") return parseInt(bestRatio.split("-")[0]);
    return parseInt(ratioMode.split("-")[0]);
  },[ratioMode,bestRatio]);

  const loB=Math.round(muReale-kBand*sigmaReale);
  const hiB=Math.round(muReale+kBand*sigmaReale);

  // Bonus affinità
  function getBonusAffinita(){
    const bf={};
    allDraws.forEach(d=>(d.bonus||[]).forEach(b=>{bf[b]=(bf[b]||0)+1;}));
    const tot=Object.values(bf).reduce((s,v)=>s+v,0);
    return Array.from({length:BONUS_POOL},(_,i)=>i+1).map(n=>{
      const f=bf[n]||0;
      let rit=allDraws.length;
      for(let i=allDraws.length-1;i>=0;i--){if((allDraws[i].bonus||[]).includes(n)){rit=allDraws.length-1-i;break;}}
      const score=(f/Math.max(tot,1))*0.6+(rit/allDraws.length)*0.4;
      return {num:n,f,rit,score,pct:tot?Math.round(f/tot*100):0};
    }).sort((a,b)=>b.score-a.score);
  }

  const bonusAffinita=useMemo(()=>getBonusAffinita(),[allDraws]);

  const genera=()=>{
    setLoading(true);setResults([]);setSelBonus({});setSavedIds(new Set());
    setTimeout(()=>{
      const advScores=computeAdvancedScoresEJ(allDraws,muReale,sigmaReale);
      const rng=mkRng(Date.now());
      const found=[];
      const maxAttempts=3000000;
      let sc=0;
      const pool=scored.map(s=>s.num);
      const weights=scored.map(s=>Math.max(0.05,s.score+1));
      const totalW=weights.reduce((a,b)=>a+b,0);
      const cumW=[];let acc=0;
      weights.forEach(w=>{acc+=w;cumW.push(acc/totalW);});
      function pickWeighted(){const r=rng();for(let i=0;i<cumW.length;i++) if(r<=cumW[i]) return pool[i];return pool[pool.length-1];}
      while(found.length<qty&&sc<maxAttempts){
        sc++;
        const nums=new Set();let attempts=0;
        while(nums.size<PICK&&attempts<200){nums.add(pickWeighted());attempts++;}
        if(nums.size<PICK) continue;
        const arr=[...nums].sort((a,b)=>a-b);
        const s=sm(arr);
        if(s<loB||s>hiB) continue;
        const evens=arr.filter(n=>n%2===0).length;
        if(Math.abs(evens-targetEvens)>1) continue;
        const key=arr.join(",");
        if(found.some(f=>f.nums.join(",")===key)) continue;
        const anomaly=arr.reduce((a,n)=>{const exp=winDraws.length*PICK/POOL;return a+Math.abs(freq[n]-exp)/Math.max(exp,1);},0)/PICK;
        const ritMedio=arr.reduce((a,n)=>a+getRitardo(n),0)/PICK;
        const quality=calcQualityScoreEJ(arr,allDraws,freq,sigmaReale,muReale,advScores);
        const topBonus=bonusAffinita.slice(0,2).map(b=>b.num);
        found.push({nums:arr,sum:s,evens,odds:PICK-evens,anomaly,ritMedio,zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2),quality,topBonus});
      }
      found.sort((a,b)=>b.quality-a.quality);
      setResults(found);setLoading(false);
    },50);
  };

  const salvaBiglietto=(r,idx)=>{
    const bonus=selBonus[idx]||r.topBonus;
    const ticket={id:Date.now()+idx,nums:r.nums,bonus,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy:"suggeritore",sum:r.sum};
    const prev=JSON.parse(localStorage.getItem(LS_TICKETS_EJ)||"[]");
    localStorage.setItem(LS_TICKETS_EJ,JSON.stringify([...prev,ticket]));
    setSavedIds(prev=>new Set([...prev,idx]));
    alert(`✅ Salvata in Biglietti!\n${r.nums.join("-")} | EN:${bonus?.join("-")||"—"}`);
  };

  const pariDisp=allDraws.slice(-20).map(d=>d.nums.filter(n=>n%2===0).length);
  const avgPD=(pariDisp.reduce((a,b)=>a+b,0)/pariDisp.length).toFixed(1);
  const ratioOpts=["auto","3-2","2-3","4-1","1-4"];

  return(
    <div>
      <h2 style={{color:"#a78bfa",fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🔮 Suggeritore Scientifico</h2>
      <div style={{background:"#0a081a",border:"1px solid #a78bfa33",borderRadius:12,padding:14,marginBottom:16}}>
        <div style={{color:"#a78bfa",fontWeight:700,fontSize:11,marginBottom:12,letterSpacing:1,textTransform:"uppercase"}}>⚙️ Parametri</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Finestra analisi</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {[50,100,200,allDraws.length].map(w=>{const lbl=w===allDraws.length?"Tutte":w;const act=winSize===Math.min(w,allDraws.length);return(<button key={w} onClick={()=>setWinSize(Math.min(w,allDraws.length))} style={{background:act?"#a78bfa22":"transparent",color:act?"#a78bfa":C.dim,border:`1px solid ${act?"#a78bfa":C.border}`,borderRadius:8,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>);})}
            </div>
          </div>
          <div>
            <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Banda somma [{loB}–{hiB}]</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {[0.5,1.0,1.5,2.0].map(k=>{const act=kBand===k;return(<button key={k} onClick={()=>setKBand(k)} style={{background:act?"#a78bfa22":"transparent",color:act?"#a78bfa":C.dim,border:`1px solid ${act?"#a78bfa":C.border}`,borderRadius:8,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>±{k}σ</button>);})}
            </div>
          </div>
          <div>
            <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Pari/Dispari (storico: {bestRatio})</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {ratioOpts.map(r=>{const act=ratioMode===r;return(<button key={r} onClick={()=>setRatioMode(r)} style={{background:act?"#a78bfa22":"transparent",color:act?"#a78bfa":C.dim,border:`1px solid ${act?"#a78bfa":C.border}`,borderRadius:8,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{r==="auto"?`Auto(${bestRatio})`:r}</button>);})}
            </div>
          </div>
          <div>
            <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Peso: <span style={{color:C.teal}}>Rit.{pesoRitardo}%</span> · <span style={{color:C.orange}}>Freq.{100-pesoRitardo}%</span></div>
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
          <div style={{color:C.dim,fontSize:9}}>score composito</div>
        </div>
        <div style={{background:"#0e0a1c",border:"1px solid #a78bfa33",borderRadius:10,padding:10}}>
          <div style={{color:"#a78bfa",fontSize:9,fontWeight:700,marginBottom:3}}>ESTRAZIONI</div>
          <div style={{color:"#fff",fontFamily:"monospace",fontSize:13,fontWeight:900}}>{allDraws.length}</div>
          <div style={{color:C.dim,fontSize:9}}>Supabase</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <span style={{color:C.dim,fontSize:11}}>Combinazioni:</span>
        {[1,3,5,10,15,20].map(n=>(<button key={n} onClick={()=>setQty(n)} style={{background:qty===n?"#a78bfa22":"transparent",color:qty===n?"#a78bfa":C.dim,border:`1px solid ${qty===n?"#a78bfa":C.border}`,borderRadius:14,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>))}
      </div>
      <button onClick={genera} disabled={loading} style={{width:"100%",padding:"13px",background:loading?"#1a1a2e":"linear-gradient(135deg,#a78bfa,#6366f1)",color:loading?"#555":"#fff",border:"none",borderRadius:10,fontSize:16,fontWeight:900,cursor:loading?"not-allowed":"pointer",fontFamily:"Georgia,serif",marginBottom:16}}>
        {loading?"⏳ Generazione in corso...":"🔮 Genera Suggerimenti"}
      </button>
      {results.length>0&&(
        <>
          <div style={{color:C.dim,fontSize:11,marginBottom:12}}>Ordinate per <strong style={{color:"#FFD700"}}>score qualità</strong> · banda [{loB}–{hiB}] · P/D ±1 da {ratioMode==="auto"?bestRatio:ratioMode}</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {results.map((r,i)=>{
              const ql=qualityLabelEJ(r.quality);
              const stars=qualityStarsEJ(r.quality);
              const top3Bonus=bonusAffinita.slice(0,3);
              const chosenBonus=selBonus[i]||r.topBonus;
              const isSaved=savedIds.has(i);
              const isBest=i===0;
              return(
                <div key={i} style={{background:"#080816",border:`2px solid ${isBest?"#FFD70055":"#a78bfa22"}`,borderLeft:`4px solid ${ql.c}`,borderRadius:12,padding:"14px",position:"relative"}}>
                  {isBest&&<div style={{position:"absolute",top:-10,left:14,background:"#FFD700",color:"#000",fontSize:9,fontWeight:900,padding:"2px 10px",borderRadius:10}}>🏆 MIGLIORE</div>}
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
                    {r.nums.map(n=>{const rank=scored.findIndex(x=>x.num===n);const col=rank<10?C.teal:rank<30?ACCENT:C.orange;return <Ball key={n} num={n} color={col} size={38} glow={rank<8}/>;})}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                    <span style={{background:"#a78bfa22",color:"#a78bfa",borderRadius:5,padding:"2px 8px",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Σ {r.sum}</span>
                    <span style={{background:"#12122a",color:C.dim,borderRadius:5,padding:"2px 8px",fontSize:10}}>{r.evens}P–{r.odds}D</span>
                    <span style={{background:"#12122a",color:Math.abs(parseFloat(r.zScore))<1?C.green:C.orange,borderRadius:5,padding:"2px 8px",fontSize:10}}>z={r.zScore}</span>
                    <span style={{background:`${C.teal}22`,color:C.teal,borderRadius:5,padding:"2px 8px",fontSize:10}}>rit.medio {r.ritMedio.toFixed(0)}</span>
                  </div>
                  <div style={{background:"#0a0810",border:"1px solid #FFD70022",borderRadius:10,padding:10,marginBottom:10}}>
                    <div style={{color:"#FFD700",fontSize:10,fontWeight:700,marginBottom:8}}>⭐ Euro Numeri consigliati — clicca per scegliere (2)</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                      {top3Bonus.map((b,bi)=>{
                        const isCho=(chosenBonus||[]).includes(b.num);
                        return(
                          <div key={b.num} onClick={()=>setSelBonus(prev=>{const cur=prev[i]||[];const next=cur.includes(b.num)?cur.filter(x=>x!==b.num):cur.length<BONUS_COUNT?[...cur,b.num]:cur;return{...prev,[i]:next};})} style={{textAlign:"center",cursor:"pointer",padding:"6px 8px",background:isCho?"#FFD70018":"#0e0e1c",border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,borderRadius:8,boxShadow:isCho?"0 0 10px #FFD70044":"none"}}>
                            <Ball num={b.num} size={30} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho}/>
                            <div style={{color:isCho?"#FFD700":bi===0?"#E8B84B":"#888",fontSize:9,marginTop:3,fontWeight:700}}>{b.pct}%</div>
                            <div style={{color:C.dim,fontSize:8}}>r.{b.rit}</div>
                          </div>
                        );
                      })}
                      <div style={{display:"flex",alignItems:"center",paddingLeft:8,borderLeft:"1px solid #222",gap:4}}>
                        {(chosenBonus||[]).map(n=><Ball key={n} num={n} size={30} gold glow/>)}
                        {(!chosenBonus||chosenBonus.length===0)&&<span style={{color:"#555",fontSize:10}}>—</span>}
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
            Score (0–100): somma vicina alla media (+25) · score avanzato numeri (+50) · bassa anomalia (+15) · P/D bilanciato (+10). Nessun potere predittivo.
          </div>
        </>
      )}
    </div>
  );
}

// ─── TAB ANALISI AVANZATA EJ ─────────────────────────────────
function TabAnalisiAvanzata(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);
  const [computed,setComputed]=useState(null);
  const [loading,setLoading]=useState(false);

  const esegui=()=>{
    setLoading(true);
    setTimeout(()=>{
      const markov=computeMarkovEJ(allDraws);
      const cycles=analyzeCyclesEJ(allDraws);
      const clusters=computeClustersEJ(allDraws,muReale,sigmaReale);
      const entropyData=computeEntropyTimelineEJ(allDraws);
      const advScores=computeAdvancedScoresEJ(allDraws,muReale,sigmaReale);
      setComputed({markov,cycles,clusters,entropyData,advScores});
      setLoading(false);
    },100);
  };

  const stateLabels={LP:"Σ Bassa+Pari",LD:"Σ Bassa+Disp",MP:"Σ Media+Pari",MD:"Σ Media+Disp",HP:"Σ Alta+Pari",HD:"Σ Alta+Disp"};
  const stateColors={LP:C.teal,LD:"#4A8FD4",MP:ACCENT,MD:C.orange,HP:C.red,HD:C.purple};

  return(
    <div>
      <h2 style={{color:"#22d3ee",fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>🧬 Analisi Avanzata</h2>
      <div style={{background:"#001a1a",border:"1px solid #22d3ee33",borderRadius:10,padding:12,marginBottom:14,fontSize:10,color:"#22d3ee99",lineHeight:1.7}}>
        Motore multi-modello su {allDraws.length} estrazioni EuroJackpot: Catene di Markov · Analisi Ciclica · K-Means · Entropia · Score Bayesiano.
      </div>
      <button onClick={esegui} disabled={loading} style={{width:"100%",padding:"13px",background:loading?"#001a1a":"linear-gradient(135deg,#22d3ee,#0891b2)",color:loading?"#555":"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:loading?"not-allowed":"pointer",fontFamily:"Georgia,serif",marginBottom:16}}>
        {loading?"⏳ Elaborazione...":"🧬 Esegui Analisi Completa"}
      </button>
      {computed&&(<>
        <div style={{background:C.card,border:"1px solid #22d3ee33",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:"#22d3ee",fontWeight:700,fontSize:13,marginBottom:10}}>① Catene di Markov</div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
            <div style={{background:"#001a2a",border:"1px solid #22d3ee44",borderRadius:8,padding:"8px 14px",textAlign:"center"}}>
              <div style={{color:C.dim,fontSize:9}}>STATO ATTUALE</div>
              <div style={{color:"#22d3ee",fontFamily:"monospace",fontSize:18,fontWeight:900}}>{computed.markov.lastState}</div>
              <div style={{color:C.dim,fontSize:9}}>{stateLabels[computed.markov.lastState]||""}</div>
            </div>
            <div style={{color:C.dim,fontSize:18}}>→</div>
            <div style={{background:"#001a2a",border:"1px solid #22d3ee44",borderRadius:8,padding:"8px 14px",textAlign:"center"}}>
              <div style={{color:C.dim,fontSize:9}}>PIÙ PROBABILE</div>
              <div style={{color:"#FFD700",fontFamily:"monospace",fontSize:18,fontWeight:900}}>{computed.markov.bestNext?.[0]||"—"}</div>
              <div style={{color:"#FFD700",fontSize:10,fontWeight:700}}>{computed.markov.bestNext?((computed.markov.bestNext[1])*100).toFixed(0):0}%</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {computed.markov.states.map(s=>{const p=computed.markov.nextProbs[s]||0;const col=stateColors[s]||C.dim;const isBest=s===computed.markov.bestNext?.[0];return(<div key={s} style={{background:isBest?"#FFD70011":"#080816",border:`1px solid ${isBest?"#FFD700":col}33`,borderRadius:7,padding:"6px 8px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:col,fontSize:10,fontWeight:700}}>{s}</span><span style={{color:isBest?"#FFD700":C.dim,fontSize:10,fontFamily:"monospace"}}>{(p*100).toFixed(0)}%</span></div><div style={{background:"#0a0a18",borderRadius:3,height:4,overflow:"hidden"}}><div style={{background:isBest?"#FFD700":col,height:"100%",width:`${p*100}%`}}/></div><div style={{color:C.dim,fontSize:8,marginTop:2}}>{stateLabels[s]||""}</div></div>);})}
          </div>
        </div>
        <div style={{background:C.card,border:"1px solid #22d3ee33",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:"#22d3ee",fontWeight:700,fontSize:13,marginBottom:10}}>② Analisi Ciclica — Top 10</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {computed.cycles.slice(0,10).map(c=>{const pct=Math.min(c.phase/3*100,100);const col=c.phase>2?C.red:c.phase>1.5?C.orange:C.teal;return(<div key={c.num} style={{display:"flex",alignItems:"center",gap:8}}><Ball num={c.num} color={col} size={28} glow={c.phase>2}/><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{color:C.dim,fontSize:9}}>ciclo:{c.cycle} · gap:{c.currentGap}</span><span style={{color:col,fontSize:10,fontWeight:700}}>{c.phase}x</span></div><div style={{background:"#0a0a18",borderRadius:3,height:5,overflow:"hidden"}}><div style={{background:col,height:"100%",width:`${pct}%`}}/></div></div></div>);})}
          </div>
        </div>
        <div style={{background:C.card,border:"1px solid #22d3ee33",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:"#22d3ee",fontWeight:700,fontSize:13,marginBottom:10}}>③ Clustering + ④ Entropia</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{background:"#080816",borderRadius:8,padding:10}}>
              <div style={{color:C.dim,fontSize:9,marginBottom:4}}>CLUSTER DOMINANTE (ult.30)</div>
              <div style={{color:ACCENT,fontFamily:"monospace",fontSize:14,fontWeight:900}}>C{computed.clusters.dominant}</div>
              <div style={{color:C.dim,fontSize:9}}>Σ~{computed.clusters.domInfo.sumBias} · {computed.clusters.domInfo.evensBias}P</div>
            </div>
            <div style={{background:computed.entropyData.isChaotic?"#1a0a00":"#001a0a",borderRadius:8,padding:10,border:`1px solid ${computed.entropyData.isChaotic?C.orange:C.green}44`}}>
              <div style={{color:C.dim,fontSize:9,marginBottom:4}}>FASE ENTROPIA</div>
              <div style={{color:computed.entropyData.isChaotic?C.orange:C.green,fontFamily:"monospace",fontSize:13,fontWeight:900}}>{computed.entropyData.isChaotic?"CAOTICA":"ORDINATA"}</div>
              <div style={{color:C.dim,fontSize:9}}>{(computed.entropyData.currentEntropy*100).toFixed(1)}% vs media {(computed.entropyData.avgEntropy*100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
        <div style={{background:C.card,border:"1px solid #22d3ee33",borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:"#22d3ee",fontWeight:700,fontSize:13,marginBottom:6}}>⑤ Score Unificato Avanzato — Top 15</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:6}}>
            {computed.advScores.slice(0,15).map((s,i)=>{const col=i<5?"#FFD700":i<10?C.orange:C.teal;return(<div key={s.num} style={{background:"#080816",border:`1px solid ${col}33`,borderRadius:8,padding:"8px 10px"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><Ball num={s.num} color={col} size={26} glow={i<5}/><div><div style={{color:col,fontFamily:"monospace",fontSize:13,fontWeight:900}}>{s.unified}</div><div style={{color:C.dim,fontSize:8}}>score</div></div></div>
              {[{l:"ciclo",v:s.cycleScore,c:"#22d3ee"},{l:"bayes",v:s.bayesScore,c:C.purple},{l:"rit",v:s.ritScore,c:C.teal},{l:"freq",v:s.freqScore,c:C.orange}].map(row=>(<div key={row.l} style={{display:"flex",gap:4,alignItems:"center",marginBottom:1}}><span style={{color:C.dim,fontSize:7,width:24}}>{row.l}</span><div style={{flex:1,background:"#0a0a18",borderRadius:2,height:3,overflow:"hidden"}}><div style={{background:row.c,height:"100%",width:`${Math.min(row.v,100)}%`}}/></div><span style={{color:row.c,fontSize:7,width:18,textAlign:"right"}}>{row.v.toFixed(0)}</span></div>))}
              <div style={{color:C.dim,fontSize:7,marginTop:3}}>rit:{s.rit}</div>
            </div>);})}
          </div>
        </div>
        <div style={{background:"#001a1a",border:"1px solid #22d3ee22",borderRadius:8,padding:10,fontSize:9,color:"#22d3ee66",lineHeight:1.8}}>
          Il tab 🔮 Suggeritore usa automaticamente questi score. Riesegui dopo ogni nuova estrazione.
        </div>
      </>)}
    </div>
  );
}
function TabPredittivoEJ() {
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);
  const [computed,setComputed]=useState(null);
  const [loading,setLoading]=useState(false);
  const [qty,setQty]=useState(5);
  const [sestine,setSestine]=useState([]);
  const [genLoading,setGenLoading]=useState(false);
  const [selBonus,setSelBonus]=useState({});
  const [savedIds,setSavedIds]=useState(new Set());

  const bonusAffinita=useMemo(()=>{
    const bf={};allDraws.forEach(d=>(d.bonus||[]).forEach(b=>{bf[b]=(bf[b]||0)+1;}));
    const tot=Object.values(bf).reduce((s,v)=>s+v,0);
    return Array.from({length:BONUS_POOL},(_,i)=>i+1).map(n=>{
      const f=bf[n]||0;let rit=allDraws.length;
      for(let i=allDraws.length-1;i>=0;i--){if((allDraws[i].bonus||[]).includes(n)){rit=allDraws.length-1-i;break;}}
      return{num:n,f,rit,score:(f/Math.max(tot,1))*0.6+(rit/allDraws.length)*0.4,pct:tot?Math.round(f/tot*100):0};
    }).sort((a,b)=>b.score-a.score);
  },[allDraws]);

  function computeSpectralEJ(draws){
    const allSums=draws.map(d=>d.nums.reduce((a,b)=>a+b,0));
    const mu=allSums.reduce((a,b)=>a+b,0)/allSums.length;
    const centered=allSums.map(s=>s-mu);
    const N=centered.length;
    const periods=[2,3,5,7,10,13,17,20,25,30];
    const spectral=periods.map(period=>{
      let re=0,im=0;
      centered.forEach((v,i)=>{re+=v*Math.cos(2*Math.PI*i/period);im+=v*Math.sin(2*Math.PI*i/period);});
      const power=Math.sqrt(re*re+im*im)/N;
      const posInCycle=((N-1)%period)/period;
      return{period,power:parseFloat(power.toFixed(2)),posInCycle:parseFloat(posInCycle.toFixed(2))};
    }).sort((a,b)=>b.power-a.power);
    return{spectral,dominant:spectral[0]};
  }

  const esegui=()=>{
    setLoading(true);setSestine([]);
    setTimeout(()=>{
      const pairs=computePairCorrelationsEJ(allDraws);
      const lstm=computeLSTMEJ(allDraws);
      const regression=computeRegressionEJ(allDraws);
      const spectral=computeSpectralEJ(allDraws);
      const ensemble=computeEnsemblePredictiveEJ(allDraws,muReale,sigmaReale);
      setComputed({pairs,lstm,regression,spectral,ensemble});
      setLoading(false);
    },150);
  };

  const genera=()=>{
    if(!computed)return;
    setGenLoading(true);setSestine([]);setSavedIds(new Set());
    setTimeout(()=>{
      const loB=computed.regression.predictedRange.lo;
      const hiB=computed.regression.predictedRange.hi;
      const rng=mkRng(Date.now());
      const pool=computed.ensemble.map(s=>s.num);
      const weights=computed.ensemble.map(s=>Math.max(0.05,(s.ensemble/100)+0.5));
      const totalW=weights.reduce((a,b)=>a+b,0);
      const cumW=[];let acc=0;weights.forEach(w=>{acc+=w;cumW.push(acc/totalW);});
      function pickW(){const r=rng();for(let i=0;i<cumW.length;i++)if(r<=cumW[i])return pool[i];return pool[pool.length-1];}
      const found=[];let sc=0;
      while(found.length<qty&&sc<3000000){
        sc++;const nums=new Set();let att=0;
        while(nums.size<PICK&&att<200){nums.add(pickW());att++;}
        if(nums.size<PICK)continue;
        const arr=[...nums].sort((a,b)=>a-b);
        const s=arr.reduce((a,b)=>a+b,0);
        if(s<loB||s>hiB)continue;
        const key=arr.join(",");
        if(found.some(f=>f.nums.join(",")===key))continue;
        const predScore=arr.reduce((a,n)=>{const e=computed.ensemble.find(x=>x.num===n);return a+(e?e.ensemble:0);},0)/arr.length;
        const pairData=computePairCorrelationsEJ(allDraws);
        let pairBonus=0;
        for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){const p=pairData.topPairs.find(x=>x.nums[0]===arr[i]&&x.nums[1]===arr[j]);if(p)pairBonus+=p.z;}
        const evens=arr.filter(n=>n%2===0).length;
        found.push({nums:arr,sum:s,evens,odds:PICK-evens,predScore:parseFloat(predScore.toFixed(1)),pairBonus:parseFloat(pairBonus.toFixed(2)),zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2)});
      }
      setSestine(found.sort((a,b)=>b.predScore-a.predScore));
      setGenLoading(false);
    },100);
  };

  const salvaBiglietto=async(r,idx)=>{
    const bonus=selBonus[idx]||bonusAffinita.slice(0,2).map(b=>b.num);
    const ticket={id:Date.now()+idx,nums:r.nums,bonus,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy:"predittivo",sum:r.sum};
    await salvaTicketEJ(ticket);
    setSavedIds(prev=>new Set([...prev,idx]));
    alert(`✅ Salvata!\n${r.nums.join("-")} | EN:${bonus?.join("-")||"—"}`);
  };

  const PUR="#e879f9";

  return(
    <div>
      <h2 style={{color:PUR,fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>🔬 Motore Predittivo v2</h2>
      <div style={{background:"#1a001a",border:`1px solid ${PUR}33`,borderRadius:10,padding:12,marginBottom:14,fontSize:10,color:`${PUR}99`,lineHeight:1.7}}>
        Ensemble 5 modelli: <strong style={{color:PUR}}>Correlazioni Coppie</strong> · <strong style={{color:PUR}}>LSTM</strong> · <strong style={{color:PUR}}>Regressione</strong> · <strong style={{color:PUR}}>Spettrale FFT</strong> · <strong style={{color:PUR}}>Bayesiano+Ciclico</strong>.
      </div>
      <button onClick={esegui} disabled={loading} style={{width:"100%",padding:"13px",background:loading?"#1a001a":`linear-gradient(135deg,${PUR},#9333ea)`,color:loading?"#555":"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:loading?"not-allowed":"pointer",fontFamily:"Georgia,serif",marginBottom:16}}>
        {loading?"⏳ Calcolo modelli...":"🔬 Calcola Modelli Predittivi"}
      </button>
      {computed&&(<>
        <div style={{background:C.card,border:`1px solid ${PUR}33`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:PUR,fontWeight:700,fontSize:13,marginBottom:10}}>① Predizione Somma</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:12}}>
            {[{l:"LSTM",v:computed.lstm.predictedSum,c:PUR,s:`[${computed.lstm.predictedRange.lo}–${computed.lstm.predictedRange.hi}]`},{l:"Regressione",v:computed.regression.predicted,c:C.orange,s:`[${computed.regression.predictedRange.lo}–${computed.regression.predictedRange.hi}]`},{l:"WMA",v:computed.regression.wma,c:ACCENT,s:`μ=${computed.regression.muAll}`},{l:"Trend",v:(computed.lstm.currentTrend>=0?"+":"")+computed.lstm.currentTrend,c:computed.lstm.currentTrend>0?C.orange:C.teal,s:"per estrazione"}].map(x=>(<div key={x.l} style={{background:"#0a001a",borderRadius:8,padding:10,textAlign:"center",border:`1px solid ${PUR}33`}}><div style={{color:C.dim,fontSize:9}}>{x.l}</div><div style={{color:x.c,fontFamily:"monospace",fontSize:16,fontWeight:900}}>{x.v}</div><div style={{color:C.dim,fontSize:9}}>{x.s}</div></div>))}
          </div>
        </div>
        <div style={{background:C.card,border:`1px solid ${PUR}33`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:PUR,fontWeight:700,fontSize:13,marginBottom:10}}>② Analisi Spettrale</div>
          <div style={{color:C.dim,fontSize:10,marginBottom:8}}>Ciclo dominante: ogni <strong style={{color:PUR}}>{computed.spectral.dominant.period}</strong> estrazioni · posizione: <strong style={{color:computed.spectral.dominant.posInCycle>0.7?C.orange:C.teal}}>{(computed.spectral.dominant.posInCycle*100).toFixed(0)}%</strong></div>
          {computed.spectral.spectral.slice(0,5).map(s=>{const col=s.period===computed.spectral.dominant.period?PUR:C.dim;return(<div key={s.period} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span style={{color:col,fontFamily:"monospace",fontSize:10,minWidth:65}}>ciclo {s.period}est.</span><div style={{flex:1,background:"#0a0a18",borderRadius:3,height:5,overflow:"hidden"}}><div style={{background:col,height:"100%",width:`${(s.power/computed.spectral.spectral[0].power)*100}%`}}/></div><span style={{color:col,fontSize:9,minWidth:28}}>{s.power}</span></div>);})}
        </div>
        <div style={{background:C.card,border:`1px solid ${PUR}33`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:PUR,fontWeight:700,fontSize:13,marginBottom:6}}>③ Correlazioni Coppie Top 8</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:6}}>
            {computed.pairs.topPairs.slice(0,8).map(p=>{const col=p.z>3?C.red:p.z>2?C.orange:C.teal;return(<div key={p.pair} style={{background:"#080816",border:`1px solid ${col}33`,borderRadius:8,padding:"8px 10px"}}><div style={{display:"flex",gap:4,marginBottom:4}}>{p.nums.map(n=><Ball key={n} num={n} color={col} size={24}/>)}</div><div style={{color:col,fontFamily:"monospace",fontSize:10,fontWeight:700}}>{p.count}x z={p.z.toFixed(1)}</div></div>);})}
          </div>
        </div>
        <div style={{background:C.card,border:`1px solid ${PUR}33`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:PUR,fontWeight:700,fontSize:13,marginBottom:6}}>④ Ensemble Score Top 15</div>
          <div style={{color:C.dim,fontSize:9,marginBottom:8}}>Cicli 25% · Bayesiano 20% · Ritardo 20% · Correlazioni 20% · LSTM 15%</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:6}}>
            {computed.ensemble.slice(0,15).map((s,i)=>{const col=i<5?"#FFD700":i<10?C.orange:PUR;return(<div key={s.num} style={{background:"#080816",border:`1px solid ${col}33`,borderRadius:8,padding:"7px 8px"}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}><Ball num={s.num} color={col} size={24} glow={i<5}/><div><div style={{color:col,fontFamily:"monospace",fontSize:12,fontWeight:900}}>{s.ensemble}</div><div style={{color:C.dim,fontSize:7}}>ensemble</div></div></div>{[{l:"c",v:s.cycleScore,c:"#22d3ee"},{l:"b",v:s.bayesScore,c:C.purple},{l:"r",v:s.ritScore,c:C.teal},{l:"cr",v:s.corrScore,c:C.orange}].map(row=>(<div key={row.l} style={{display:"flex",gap:3,alignItems:"center",marginBottom:1}}><span style={{color:C.dim,fontSize:7,width:10}}>{row.l}</span><div style={{flex:1,background:"#0a0a18",borderRadius:2,height:3,overflow:"hidden"}}><div style={{background:row.c,height:"100%",width:`${Math.min(row.v,100)}%`}}/></div></div>))}<div style={{color:C.dim,fontSize:7,marginTop:2}}>rit:{s.rit}</div></div>);})}
          </div>
        </div>
        <div style={{background:"#0a001a",border:`2px solid ${PUR}44`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:PUR,fontWeight:700,fontSize:13,marginBottom:8}}>⑤ Genera Cinquine Predittive</div>
          <div style={{color:C.dim,fontSize:10,marginBottom:10}}>Range: <strong style={{color:PUR}}>[{computed.regression.predictedRange.lo}–{computed.regression.predictedRange.hi}]</strong> · Trend: <strong style={{color:computed.lstm.currentTrend>0?C.orange:C.teal}}>{computed.lstm.currentTrend>0?"+":""}{computed.lstm.currentTrend}/est.</strong></div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
            <span style={{color:C.dim,fontSize:11}}>Combinazioni:</span>
            {[1,3,5,10].map(n=>(<button key={n} onClick={()=>setQty(n)} style={{background:qty===n?`${PUR}22`:"transparent",color:qty===n?PUR:C.dim,border:`1px solid ${qty===n?PUR:C.border}`,borderRadius:14,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>))}
          </div>
          <button onClick={genera} disabled={genLoading} style={{width:"100%",padding:"12px",background:genLoading?"#1a001a":`linear-gradient(135deg,${PUR},#9333ea)`,color:genLoading?"#555":"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:genLoading?"not-allowed":"pointer",fontFamily:"Georgia,serif",marginBottom:12}}>
            {genLoading?"⏳ Generazione...":"🔬 Genera Cinquine Predittive"}
          </button>
          {sestine.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {sestine.map((r,i)=>{
                const isBest=i===0;
                const top3Bonus=bonusAffinita.slice(0,3);
                const chosenBonus=selBonus[i]||bonusAffinita.slice(0,2).map(b=>b.num);
                const isSaved=savedIds.has(i);
                return(
                  <div key={i} style={{background:"#080816",border:`2px solid ${isBest?`${PUR}88`:`${PUR}22`}`,borderLeft:`4px solid ${PUR}`,borderRadius:12,padding:"14px",position:"relative"}}>
                    {isBest&&<div style={{position:"absolute",top:-10,left:14,background:PUR,color:"#fff",fontSize:9,fontWeight:900,padding:"2px 10px",borderRadius:10}}>🏆 MIGLIORE</div>}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                      <span style={{color:PUR,fontFamily:"monospace",fontSize:11}}>#{i+1}</span>
                      <span style={{background:`${PUR}22`,color:PUR,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>Score {r.predScore}</span>
                      {r.pairBonus>0&&<span style={{background:`${C.orange}22`,color:C.orange,borderRadius:6,padding:"2px 8px",fontSize:10}}>+coppie {r.pairBonus.toFixed(1)}</span>}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
                      {r.nums.map(n=>{const rank=computed.ensemble.findIndex(x=>x.num===n);const col=rank<5?"#FFD700":rank<10?C.orange:PUR;return <Ball key={n} num={n} color={col} size={38} glow={rank<5}/>;})}</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                      <span style={{background:`${PUR}22`,color:PUR,borderRadius:5,padding:"2px 8px",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Σ {r.sum}</span>
                      <span style={{background:"#12122a",color:C.dim,borderRadius:5,padding:"2px 8px",fontSize:10}}>{r.evens}P–{r.odds}D</span>
                      <span style={{background:"#12122a",color:Math.abs(parseFloat(r.zScore))<1?C.green:C.orange,borderRadius:5,padding:"2px 8px",fontSize:10}}>z={r.zScore}</span>
                    </div>
                    <div style={{background:"#0a0810",border:"1px solid #FFD70022",borderRadius:10,padding:10,marginBottom:10}}>
                      <div style={{color:"#FFD700",fontSize:10,fontWeight:700,marginBottom:8}}>⭐ Euro Numeri consigliati (2)</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                        {top3Bonus.map((b,bi)=>{const isCho=(chosenBonus||[]).includes(b.num);return(<div key={b.num} onClick={()=>setSelBonus(prev=>{const cur=prev[i]||[];const next=cur.includes(b.num)?cur.filter(x=>x!==b.num):cur.length<BONUS_COUNT?[...cur,b.num]:cur;return{...prev,[i]:next};})} style={{textAlign:"center",cursor:"pointer",padding:"5px 6px",background:isCho?"#FFD70018":"#0e0e1c",border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,borderRadius:8,boxShadow:isCho?"0 0 10px #FFD70044":"none"}}><Ball num={b.num} size={26} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho}/><div style={{color:isCho?"#FFD700":bi===0?"#E8B84B":"#888",fontSize:9,marginTop:2}}>{b.pct}%</div></div>);})}
                        <div style={{paddingLeft:8,borderLeft:"1px solid #222",display:"flex",gap:4}}>
                          {(chosenBonus||[]).map(n=><Ball key={n} num={n} size={26} gold glow/>)}
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
          Modello predittivo ensemble v2. Nessun potere predittivo garantito. Riesegui dopo ogni nuova estrazione.
        </div>
      </>)}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// AGGIUNTE AppEuroJackpot.tsx
// ═══════════════════════════════════════════════════════════════

// ─── FUNZIONI PREDITTIVE EJ ──────────────────────────────────
// (adattate da SuperEnalotto: POOL=50, PICK=5)

function computePairCorrelationsEJ(draws) {
  const pairCount={};
  draws.forEach(d=>{
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
    pair:k,nums:k.split('-').map(Number),count:v,
    z:(v-expectedFreq)/Math.max(sigmaFreq,0.1),
  })).sort((a,b)=>b.z-a.z);
  const numScore=new Array(POOL+1).fill(0);
  pairs.slice(0,20).forEach(p=>p.nums.forEach(n=>{numScore[n]+=Math.max(0,p.z);}));
  const maxNS=Math.max(...numScore.slice(1),0.001);
  return {topPairs:pairs.slice(0,15),numScore:numScore.map(s=>s/maxNS),expectedFreq:parseFloat(expectedFreq.toFixed(2))};
}

function computeLSTMEJ(draws) {
  const windowSize=12;
  function features(nums){
    const s=nums.reduce((a,b)=>a+b,0);
    const e=nums.filter(n=>n%2===0).length;
    const gaps=[];for(let i=1;i<nums.length;i++)gaps.push(nums[i]-nums[i-1]);
    const avgGap=gaps.reduce((a,b)=>a+b,0)/gaps.length;
    return {sum:s,evens:e,avgGap};
  }
  const patterns=[];
  for(let i=windowSize;i<draws.length;i++){
    const ctx=draws.slice(i-windowSize,i).map(d=>features(d.nums));
    const target=features(draws[i].nums);
    const sumTrend=(ctx[ctx.length-1].sum-ctx[0].sum)/(windowSize-1);
    patterns.push({sumTrend,predictedSum:ctx[ctx.length-1].sum+sumTrend,actualSum:target.sum});
  }
  const recent=draws.slice(-windowSize).map(d=>features(d.nums));
  const lastSums=recent.map(f=>f.sum);
  const currentTrend=(lastSums[lastSums.length-1]-lastSums[0])/(windowSize-1);
  const lastSum=lastSums[lastSums.length-1];
  const correzioneMean=(lastSum-MU_TEO)*0.15;
  const recentEvens=draws.slice(-10).map(d=>d.nums.filter(n=>n%2===0).length);
  const avgEvens=recentEvens.reduce((a,b)=>a+b,0)/recentEvens.length;
  const evensCorrection=(avgEvens-2.5)*2;
  const weightedPrediction=Math.round(
    lastSums[lastSums.length-1]*0.35+lastSums[lastSums.length-2]*0.25+
    lastSums[lastSums.length-3]*0.15+lastSums[lastSums.length-4]*0.10+
    (lastSums[lastSums.length-1]+currentTrend)*0.10-
    correzioneMean*0.05+evensCorrection
  );
  return {currentTrend:parseFloat(currentTrend.toFixed(1)),predictedSum:weightedPrediction,
    predictedRange:{lo:Math.round(weightedPrediction-15),hi:Math.round(weightedPrediction+15)},
    ritornoMedia:parseFloat(correzioneMean.toFixed(1)),
    cicloPariDispari:parseFloat(avgEvens.toFixed(1)),lastSums};
}

function computeRegressionEJ(draws) {
  const allSums=draws.map(d=>d.nums.reduce((a,b)=>a+b,0));
  const muAll=allSums.reduce((a,b)=>a+b,0)/allSums.length;
  const sigmaAll=Math.sqrt(allSums.reduce((a,s)=>a+(s-muAll)**2,0)/allSums.length);
  const recent=allSums.slice(-20);
  const weights=recent.map((_,i)=>i+1);
  const totalW=weights.reduce((a,b)=>a+b,0);
  const wma=recent.reduce((a,s,i)=>a+s*weights[i],0)/totalW;
  const x30=allSums.slice(-30);
  const n=x30.length;
  const sumX=x30.reduce((a,_,i)=>a+i,0),sumY=x30.reduce((a,b)=>a+b,0);
  const sumXY=x30.reduce((a,s,i)=>a+i*s,0),sumX2=x30.reduce((a,_,i)=>a+i*i,0);
  const slope=(n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX);
  const intercept=(sumY-slope*sumX)/n;
  const predictedRaw=Math.round(intercept+slope*n);
  const predicted=Math.round(predictedRaw*0.80+MU_TEO*0.20);
  return {muAll:parseFloat(muAll.toFixed(1)),sigmaAll:parseFloat(sigmaAll.toFixed(1)),
    wma:parseFloat(wma.toFixed(1)),predicted,
    predictedRange:{lo:Math.round(predicted-sigmaAll*0.8),hi:Math.round(predicted+sigmaAll*0.8)},allSums};
}

function computeEnsemblePredictiveEJ(draws,muReale,sigmaReale) {
  const N=draws.length;
  const cycles=analyzeCyclesEJ(draws);
  const pairs=computePairCorrelationsEJ(draws);
  const modelWeights={cicli:0.25,bayesiano:0.20,ritardo:0.20,correlazioni:0.20,lstm:0.15};
  const lstm=computeLSTMEJ(draws);
  return Array.from({length:POOL},(_,i)=>{
    const num=i+1;
    const cyc=cycles[i];
    const cycleScore=cyc.score;
    const recentFreq=draws.slice(-150).filter(d=>d.nums.includes(num)).length;
    const alpha=recentFreq+1,beta=150-recentFreq+1;
    const posteriorMean=alpha/(alpha+beta);
    const expectedProb=PICK/POOL;
    const bayesScore=Math.min(Math.max(0,expectedProb-posteriorMean)*20,1);
    let rit=N;
    for(let j=N-1;j>=0;j--) if(draws[j].nums.includes(num)){rit=N-1-j;break;}
    const ritScore=Math.min(rit/N,1);
    const corrScore=Math.min(pairs.numScore[num]||0,1);
    const lstmScore=lstm.currentTrend>0?0.55:0.45;
    const ensemble=cycleScore*modelWeights.cicli+bayesScore*modelWeights.bayesiano+
      ritScore*modelWeights.ritardo+corrScore*modelWeights.correlazioni+lstmScore*modelWeights.lstm;
    const freq=draws.filter(d=>d.nums.includes(num)).length;
    return {num,ensemble:parseFloat((ensemble*100).toFixed(1)),
      cycleScore:parseFloat((cycleScore*100).toFixed(0)),bayesScore:parseFloat((bayesScore*100).toFixed(0)),
      ritScore:parseFloat((ritScore*100).toFixed(0)),corrScore:parseFloat((corrScore*100).toFixed(0)),
      lstmScore:parseFloat((lstmScore*100).toFixed(0)),rit,freq};
  }).sort((a,b)=>b.ensemble-a.ensemble);
}

// ─── GENERATORE UNIFICATO EJ ─────────────────────────────────
function TabGeneratoreUnificatoEJ() {
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const sums=series.map(d=>d.sum);
  const muReale=avg(sums),sigmaReale=std(sums);

  const [qty,setQty]=useState(5);
  const [numCandidati,setNumCandidati]=useState(200);
  const [rangeMode,setRangeMode]=useState("adattivo");
  const [customLo,setCustomLo]=useState(Math.round(muReale-sigmaReale));
  const [customHi,setCustomHi]=useState(Math.round(muReale+sigmaReale));
  const [wAdv,setWAdv]=useState(40);
  const [wEns,setWEns]=useState(35);
  const [wPair,setWPair]=useState(15);
  const [wDist,setWDist]=useState(10);
  const [loading,setLoading]=useState(false);
  const [results,setResults]=useState([]);
  const [advScoresRef,setAdvScoresRef]=useState([]);
  const [selBonus,setSelBonus]=useState({});
  const [savedIds,setSavedIds]=useState(new Set());
  const [progress,setProgress]=useState("");
  const [seenCombos,setSeenCombos]=useState<Set<string>>(new Set());
  const [cicloRipartito,setCicloRipartito]=useState<false|number>(false);

  const GEN_COLOR="#f59e0b";
  const totalW=wAdv+wEns+wPair+wDist;
  const pAdv=Math.round(wAdv/totalW*100);
  const pEns=Math.round(wEns/totalW*100);
  const pPair=Math.round(wPair/totalW*100);
  const pDist=100-pAdv-pEns-pPair;

  const loAdattivo=Math.round(muReale-sigmaReale*1.5);
  const hiAdattivo=Math.round(muReale+sigmaReale*1.5);

  // Bonus affinità
  const bonusAffinita=useMemo(()=>{
    const bf={};allDraws.forEach(d=>(d.bonus||[]).forEach(b=>{bf[b]=(bf[b]||0)+1;}));
    const tot=Object.values(bf).reduce((s,v)=>s+v,0);
    return Array.from({length:BONUS_POOL},(_,i)=>i+1).map(n=>{
      const f=bf[n]||0;let rit=allDraws.length;
      for(let i=allDraws.length-1;i>=0;i--){if((allDraws[i].bonus||[]).includes(n)){rit=allDraws.length-1-i;break;}}
      return {num:n,f,rit,score:(f/Math.max(tot,1))*0.6+(rit/allDraws.length)*0.4,pct:tot?Math.round(f/tot*100):0};
    }).sort((a,b)=>b.score-a.score);
  },[allDraws]);

  const genera=()=>{
    setLoading(true);setResults([]);setSelBonus({});setSavedIds(new Set());
    setCicloRipartito(false);
    setProgress("⚙️ Calcolo modelli...");
    setTimeout(()=>{
      const advScores=computeAdvancedScoresEJ(allDraws,muReale,sigmaReale);
      const ensembleScores=computeEnsemblePredictiveEJ(allDraws,muReale,sigmaReale);
      const pairData=computePairCorrelationsEJ(allDraws);
      const regression=computeRegressionEJ(allDraws);
      const lstm=computeLSTMEJ(allDraws);
      setAdvScoresRef(advScores);
      const ritardi=Array.from({length:POOL},(_,i)=>{
        const num=i+1;for(let j=allDraws.length-1;j>=0;j--){if(allDraws[j].nums.includes(num))return allDraws.length-1-j;}return allDraws.length;
      });
      let loB,hiB;
      if(rangeMode==="auto"){loB=Math.min(Math.round(muReale-sigmaReale),regression.predictedRange.lo,lstm.predictedRange.lo);hiB=Math.max(Math.round(muReale+sigmaReale),regression.predictedRange.hi,lstm.predictedRange.hi);}
      else if(rangeMode==="adattivo"){loB=loAdattivo;hiB=hiAdattivo;}
      else{loB=customLo;hiB=customHi;}
      setProgress(`🔮 ${numCandidati*3} candidati...`);
      setTimeout(()=>{
        const rng=mkRng(Date.now());
        const CAND=Math.round(numCandidati/3);
        const allCandidates=[];
        const seenKeys=new Set();
        function genCandidates(weights,strategy,count){
          const pool=Array.from({length:POOL},(_,i)=>i+1);
          const tw=weights.reduce((a,b)=>a+b,0);
          const cumW=[];let acc=0;weights.forEach(w=>{acc+=w;cumW.push(acc/tw);});
          function pick(){const r=rng();for(let i=0;i<cumW.length;i++)if(r<=cumW[i])return pool[i];return pool[pool.length-1];}
          let sc=0;
          while(allCandidates.filter(c=>c.strategy===strategy).length<count&&sc<500000){
            sc++;const nums=new Set();let att=0;
            while(nums.size<PICK&&att<100){nums.add(pick());att++;}
            if(nums.size<PICK)continue;
            const arr=[...nums].sort((a,b)=>a-b);
            const s=arr.reduce((a,b)=>a+b,0);
            if(s<loB||s>hiB)continue;
            const key=arr.join(",");if(seenKeys.has(key))continue;
            seenKeys.add(key);allCandidates.push({nums:arr,strategy});
          }
        }
        genCandidates(Array.from({length:POOL},(_,i)=>Math.max(0.05,(advScores.find(x=>x.num===i+1)?.unified||0)/100+0.3)),"adv",CAND);
        genCandidates(Array.from({length:POOL},(_,i)=>Math.max(0.05,(ensembleScores.find(x=>x.num===i+1)?.ensemble||0)/100+0.3)),"ens",CAND);
        genCandidates(Array.from({length:POOL},(_,i)=>{const a=advScores.find(x=>x.num===i+1)?.unified||0;const e=ensembleScores.find(x=>x.num===i+1)?.ensemble||0;return Math.max(0.05,(a+e)/200+0.3);}),"comb",CAND);
        setProgress("📊 Score finale...");
        setTimeout(()=>{
          const scored=allCandidates.map(c=>{
            const s=c.nums.reduce((a,b)=>a+b,0);
            const advMean=c.nums.reduce((acc,n)=>acc+(advScores.find(x=>x.num===n)?.unified||0),0)/c.nums.length;
            const advS=(advMean/100)*pAdv;
            const ensMean=c.nums.reduce((acc,n)=>acc+(ensembleScores.find(x=>x.num===n)?.ensemble||0),0)/c.nums.length;
            const ensS=(ensMean/100)*pEns;
            let pairB=0;
            for(let i=0;i<c.nums.length;i++)for(let j=i+1;j<c.nums.length;j++){
              const p=pairData.topPairs.find(x=>x.nums[0]===c.nums[i]&&x.nums[1]===c.nums[j]);
              if(p)pairB+=Math.max(0,p.z);
            }
            const pairS=Math.min(pairB/10,1)*pPair;
            const distS=Math.max(0,pDist-Math.abs(s-regression.predicted)/Math.max(sigmaReale,1)*5);
            const total=advS+ensS+pairS+distS;
            const evens=c.nums.filter(n=>n%2===0).length;
            const ritMedio=Math.round(c.nums.reduce((acc,n)=>acc+ritardi[n-1],0)/c.nums.length);
            const topBonus=bonusAffinita.slice(0,2).map(b=>b.num);
            return {...c,sum:s,total:parseFloat(total.toFixed(1)),advS:parseFloat(advS.toFixed(1)),ensS:parseFloat(ensS.toFixed(1)),pairS:parseFloat(pairS.toFixed(1)),distS:parseFloat(distS.toFixed(1)),zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2),evens,odds:PICK-evens,ritMedio,pairBonus:parseFloat(pairB.toFixed(2)),topBonus};
          });
          const allSorted=scored.sort((a,b)=>b.total-a.total);
          const nuovi=allSorted.filter(r=>!seenCombos.has(r.nums.join(",")));
          let finalResults=nuovi.slice(0,qty);
          let ripartito=false;
          if(finalResults.length===0){const totale=seenCombos.size;finalResults=allSorted.slice(0,qty);setSeenCombos(new Set(finalResults.map(r=>r.nums.join(","))));ripartito=true;setCicloRipartito(totale);}
          else{setSeenCombos(prev=>new Set([...prev,...finalResults.map(r=>r.nums.join(","))]));}
          if(!ripartito) if(!ripartito) setCicloRipartito(ripartito);
          setResults(finalResults);
          setProgress("");setLoading(false);
        },50);
      },50);
    },100);
  };

  const salvaBiglietto=(r,idx)=>{
    const bonus=selBonus[idx]||r.topBonus;
    const ticket={id:Date.now()+idx,nums:r.nums,bonus,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy:"unificato",sum:r.sum};
    const prev=JSON.parse(localStorage.getItem(LS_TICKETS_EJ)||"[]");
    localStorage.setItem(LS_TICKETS_EJ,JSON.stringify([...prev,ticket]));
    setSavedIds(prev=>new Set([...prev,idx]));
    alert(`✅ Salvata!\n${r.nums.join("-")} | EN:${bonus?.join("-")||"—"}`);
  };

  const strategyIcon=s=>s==="adv"?"🧬":s==="ens"?"🔬":"⭐";
  const strategyLabel=s=>s==="adv"?"Avanzato":s==="ens"?"Predittivo":"Combinato";

  return(
    <div>
      <h2 style={{color:GEN_COLOR,fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>⭐ Generatore Unificato</h2>
      <div style={{background:"#1a0e00",border:`1px solid ${GEN_COLOR}44`,borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{color:GEN_COLOR,fontWeight:700,fontSize:11,marginBottom:8,letterSpacing:1}}>⚙️ PARAMETRI</div>
        <div style={{marginBottom:10}}>
          <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Range somma</div>
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
        <div style={{marginBottom:10}}>
          <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Candidati (×3 strategie)</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[120,200,300,500].map(n=>(<button key={n} onClick={()=>setNumCandidati(n)} style={{background:numCandidati===n?`${GEN_COLOR}22`:"transparent",color:numCandidati===n?GEN_COLOR:C.dim,border:`1px solid ${numCandidati===n?GEN_COLOR:C.border}`,borderRadius:8,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{n*3}</button>))}
          </div>
        </div>
        <div>
          <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Pesi — totale: <strong style={{color:totalW===100?GEN_COLOR:C.red}}>{totalW}/100</strong></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{l:"🧬 Avanzato",v:wAdv,set:setWAdv,c:"#22d3ee"},{l:"🔬 Predittivo",v:wEns,set:setWEns,c:"#e879f9"},{l:"🔗 Coppie",v:wPair,set:setWPair,c:C.orange},{l:"📐 Somma",v:wDist,set:setWDist,c:C.teal}].map(row=>(
              <div key={row.l}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{color:row.c,fontSize:9}}>{row.l}</span><span style={{color:row.c,fontSize:9,fontWeight:700}}>{row.v}pt</span></div>
                <input type="range" min={0} max={60} step={5} value={row.v} onChange={e=>row.set(+e.target.value)} style={{width:"100%",accentColor:row.c,cursor:"pointer"}}/>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <span style={{color:C.dim,fontSize:11}}>Risultati:</span>
        {[3,5,10,15].map(n=>(<button key={n} onClick={()=>setQty(n)} style={{background:qty===n?`${GEN_COLOR}22`:"transparent",color:qty===n?GEN_COLOR:C.dim,border:`1px solid ${qty===n?GEN_COLOR:C.border}`,borderRadius:14,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>))}
      </div>
      <button onClick={genera} disabled={loading} style={{width:"100%",padding:"14px",background:loading?"#1a0e00":`linear-gradient(135deg,${GEN_COLOR},#d97706)`,color:loading?"#555":"#000",border:"none",borderRadius:10,fontSize:16,fontWeight:900,cursor:loading?"not-allowed":"pointer",fontFamily:"Georgia,serif",marginBottom:12}}>
        {loading?progress||"⏳ Elaborazione...":"⭐ Genera Cinquine Ottimali"}
      </button>
      {results.length>0&&(
        <>
          <div style={{color:C.dim,fontSize:11,marginBottom:12}}><strong style={{color:GEN_COLOR}}>{results.length} migliori</strong> su {numCandidati*3} candidate{cicloRipartito!==false&&<span style={{color:C.orange,marginLeft:8}}>🔄 Ciclo ripartito — {cicloRipartito} combinazioni uniche trovate con questi parametri, si ricomincia</span>}</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {results.map((r,i)=>{
              const isBest=i===0;
              const top3Bonus=bonusAffinita.slice(0,3);
              const chosenBonus=selBonus[i]||r.topBonus;
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
                    <div style={{background:"#0a0a18",borderRadius:6,height:8,width:100,overflow:"hidden"}}><div style={{background:`linear-gradient(90deg,${scoreColor},${GEN_COLOR})`,height:"100%",width:`${r.total}%`}}/></div>
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
                    {r.nums.map(n=>{const advRank=advScoresRef.findIndex(x=>x.num===n);const col=advRank>=0&&advRank<8?"#FFD700":advRank<20?C.teal:GEN_COLOR;return <Ball key={n} num={n} color={col} size={38} glow={advRank>=0&&advRank<8}/>;})}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                    <span style={{background:`${GEN_COLOR}22`,color:GEN_COLOR,borderRadius:5,padding:"2px 8px",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Σ {r.sum}</span>
                    <span style={{background:"#12122a",color:C.dim,borderRadius:5,padding:"2px 8px",fontSize:10}}>{r.evens}P–{r.odds}D</span>
                    <span style={{background:"#12122a",color:Math.abs(parseFloat(r.zScore))<1?C.green:C.orange,borderRadius:5,padding:"2px 8px",fontSize:10}}>z={r.zScore}</span>
                    <span style={{background:`${C.teal}22`,color:C.teal,borderRadius:5,padding:"2px 8px",fontSize:10}}>rit.medio {r.ritMedio}</span>
                    {r.pairBonus>0&&<span style={{background:`${C.orange}22`,color:C.orange,borderRadius:5,padding:"2px 8px",fontSize:10}}>coppie +{r.pairBonus.toFixed(1)}</span>}
                  </div>
                  <div style={{background:"#0a0810",border:"1px solid #FFD70022",borderRadius:10,padding:10,marginBottom:10}}>
                    <div style={{color:"#FFD700",fontSize:10,fontWeight:700,marginBottom:8}}>⭐ Euro Numeri consigliati (2)</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                      {top3Bonus.map((b,bi)=>{
                        const isCho=(chosenBonus||[]).includes(b.num);
                        return(<div key={b.num} onClick={()=>setSelBonus(prev=>{const cur=prev[i]||[];const next=cur.includes(b.num)?cur.filter(x=>x!==b.num):cur.length<BONUS_COUNT?[...cur,b.num]:cur;return{...prev,[i]:next};})} style={{textAlign:"center",cursor:"pointer",padding:"6px 8px",background:isCho?"#FFD70018":"#0e0e1c",border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,borderRadius:8,boxShadow:isCho?"0 0 10px #FFD70044":"none"}}>
                          <Ball num={b.num} size={28} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho}/>
                          <div style={{color:isCho?"#FFD700":bi===0?"#E8B84B":"#888",fontSize:9,marginTop:3,fontWeight:700}}>{b.pct}%</div>
                          <div style={{color:C.dim,fontSize:8}}>r.{b.rit}</div>
                        </div>);
                      })}
                      <div style={{paddingLeft:8,borderLeft:"1px solid #222",display:"flex",gap:4}}>
                        {(chosenBonus||[]).map(n=><Ball key={n} num={n} size={28} gold glow/>)}
                        {(!chosenBonus||chosenBonus.length===0)&&<span style={{color:"#555",fontSize:10}}>—</span>}
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
            Score (0–100) normalizzato ai pesi scelti. Nessun potere predittivo.
          </div>
        </>
      )}
    </div>
  );
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
  const [dbDraws,setDbDraws]=useState([]);const [loading,setLoading]=useState(true);
  const [extraDraws,setExtraDraws]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_KEY_EJ)||"[]");}catch{return [];}});
  useEffect(()=>{
    async function loadDraws(){
      try{
        const {data,error}=await supabase.from("eurojackpot").select("*").order("data",{ascending:true});
        if(error)throw error;
        const mapped=data.map(r=>({n:r.id,date:r.data?r.data.substring(5).split("-").reverse().join("/"):"",nums:[r.n1,r.n2,r.n3,r.n4,r.n5].filter(Boolean).sort((a,b)=>a-b),bonus:[r.e1,r.e2].filter(Boolean).sort((a,b)=>a-b)}));
        setDbDraws(mapped);
      }catch(err){console.error("Supabase error:",err);setDbDraws([]);}finally{setLoading(false);}
    }
    loadDraws();
  },[]);
  const allDraws=useMemo(()=>{const base=dbDraws;const extraNs=new Set(extraDraws.map(d=>d.n));return [...base.filter(d=>!extraNs.has(d.n)),...extraDraws].sort((a,b)=>a.n-b.n);},[dbDraws,extraDraws]);
  const handleUpdate=useCallback((list)=>{setExtraDraws(list);},[]);
  const last=allDraws[allDraws.length-1];const lastSum=last?sm(last.nums):0;
  if(loading)return(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{color:ACCENT,fontSize:28}}>⭐</div><div style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:18}}>Caricamento EuroJackpot...</div><div style={{color:C.dim,fontSize:12}}>Connessione a Supabase</div></div>);
  return(
    <DrawsContext.Provider value={allDraws}>
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Courier New',monospace",color:C.text,paddingBottom:60}}>
      <div style={{maxWidth:780,margin:"0 auto",padding:"0 12px"}}><div style={{position:"sticky",top:0,zIndex:100,background:C.bg}}>
        <div style={{background:"linear-gradient(180deg,#0c0c1e 0%,transparent 100%)",padding:"16px 0 0",textAlign:"center",marginBottom:0}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{fontSize:26}}>🌍</span>
            <h1 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:22,margin:0}}>EuroJackpot</h1>
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
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:C.dim,fontSize:14}}>│</span>{(last.bonus||[]).map(b=><Ball key={b} num={b} size={28} gold/>)}<span style={{color:"#FFD700",fontSize:9}}>EN</span></div>
          </div>)}
        </div>
        <div style={{display:"flex",gap:2,marginBottom:16,overflowX:"auto",paddingBottom:4,borderBottom:`1px solid ${C.border}`,paddingTop:8}}>
          {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?`linear-gradient(135deg,${t.id==="biglietti"?C.purple:t.id==="suggeritore"?"#a78bfa":t.id==="unificato"?"#f59e0b":ACCENT},#2BA89A)`:"transparent",color:tab===t.id?"#fff":C.dim,border:tab===t.id?"none":`1px solid ${C.border}`,borderRadius:20,padding:"7px 10px",fontSize:10,fontWeight:tab===t.id?700:400,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{t.icon} {t.label}</button>))}
        </div></div>
        <div style={{display:tab==="animazione"?"block":"none"}}><TabAnimazione/></div>
        <div style={{display:tab==="segnali"?"block":"none"}}><TabSegnali/></div>
        <div style={{display:tab==="banda"?"block":"none"}}><TabBanda/></div>
        <div style={{display:tab==="generatore"?"block":"none"}}><TabGeneratore/></div>
        <div style={{display:tab==="suggeritore"?"block":"none"}}><TabSuggeritore/></div>
        <div style={{display:tab==="analisi"?"block":"none"}}><TabAnalisiAvanzata/></div>
        <div style={{display:tab==="predittivo"?"block":"none"}}><TabPredittivoEJ/></div>
        <div style={{display:tab==="unificato"?"block":"none"}}><TabGeneratoreUnificatoEJ/></div>
        <div style={{display:tab==="confronto"?"block":"none"}}><TabConfronto/></div>
        <div style={{display:tab==="estrazioni"?"block":"none"}}><TabEstrazioni onUpdate={handleUpdate}/></div>
        <div style={{display:tab==="biglietti"?"block":"none"}}><TabBiglietti/></div>
        <div style={{marginTop:24,background:"#070712",border:"1px solid #111122",borderRadius:10,padding:12}}>
          <div style={{color:"#353545",fontSize:10,lineHeight:1.7}}>⚠️ Strumento puramente statistico — nessun potere predittivo. Il gioco può causare dipendenza. Vietato ai minori di 18 anni. Dati storici: {allDraws.length} estrazioni.</div>
        </div>
      </div>
    </div>
    </DrawsContext.Provider>
  );
}
