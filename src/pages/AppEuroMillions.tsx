import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { ComposedChart, LineChart, BarChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Area, Legend } from "recharts";
import { supabase } from '../lib/supabase';

const MU_TEO=127.5, SIGMA_TEO=30, JACKPOT="76.000.000 CHF", ACCENT="#4A8FD4";
const POOL=50, PICK=5, STELLE_POOL=12, STELLE_COUNT=2;
const POPULAR=new Set([1,2,3,4,5,10,20,30,40,50]);
const LS_KEY_EM="draws_euromillions_v1", LS_TICKETS_EM="tickets_euromillions_v1";

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
  return Array.from({length:POOL},(_,i)=>{const num=i+1,f=freq[num],z=(f-expFreq)/sigma;const unpop=POPULAR.has(num)?0.35:(num>Math.floor(POOL*0.35)?1.3:1.0);return{num,f,z,score:Math.abs(z)*unpop,isCold:z<-0.4,isHot:z>0.4};});
}

function generateStelle(seed){
  const rng=mkRng(seed+55555);const pool=Array.from({length:STELLE_POOL},(_,i)=>i+1);const picked=[];
  while(picked.length<STELLE_COUNT){const idx=Math.floor(rng()*pool.length);picked.push(pool.splice(idx,1)[0]);}
  return picked.sort((a,b)=>a-b);
}

function generateTicket(scored,strategy,loB,hiB,muRef,seed){
  const rng=mkRng(seed);
  let pool=strategy==="cold"?[...scored].sort((a,b)=>a.z-b.z):strategy==="unpop"?[...scored].sort((a,b)=>b.score-a.score):[...scored].sort((a,b)=>b.score-a.score);
  pool=pool.map(c=>({...c,_s:c.score+rng()*0.25})).sort((a,b)=>b._s-a._s).slice(0,35);
  let best=null,bestDist=Infinity;
  for(let t=0;t<30000;t++){const sh=[...pool].sort(()=>rng()-0.5).slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);const s=sm(sh),d=Math.abs(s-muRef);if(s>=loB&&s<=hiB&&d<bestDist){best=sh;bestDist=d;if(d<5)break;}}
  if(!best){const fp=[...scored].sort((a,b)=>b.score-a.score);const r2=mkRng(seed+99999);for(let t=0;t<50000&&!best;t++){const sh=[...fp].sort(()=>r2()-0.5).slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);if(sm(sh)>=loB&&sm(sh)<=hiB)best=sh;}if(!best)best=fp.slice(0,PICK).map(c=>c.num).sort((a,b)=>a-b);}
  return{nums:best,sum:sm(best),inBand:sm(best)>=loB&&sm(best)<=hiB};
}

function parseNums(str){return str.split(/[\s,;]+/).map(s=>parseInt(s.trim())).filter(n=>!isNaN(n)&&n>=1&&n<=POOL);}

function calcStats(draws){
  const sums=draws.map(d=>sm(d.nums)),parities=draws.map(d=>d.nums.filter(n=>n%2===0).length),freq={};
  draws.forEach(d=>d.nums.forEach(n=>{freq[n]=(freq[n]||0)+1;}));
  return{sumMean:avg(sums),sumStd:std(sums),sumMin:Math.min(...sums),sumMax:Math.max(...sums),
    parityDist:Array.from({length:PICK+1},(_,k)=>({k,count:parities.filter(p=>p===k).length,pct:(parities.filter(p=>p===k).length/draws.length*100).toFixed(1)})),freq};
}

const C={orange:"#F07030",teal:"#2BA89A",red:"#C94040",purple:"#8A5CC4",green:"#4A9E5C",bg:"#07070F",card:"#0D0D1A",border:"#1A1A2E",text:"#E0E0F0",dim:"#6A6A8A"};

const TT=({active,payload,label})=>{if(!active||!payload?.length)return null;return(<div style={{background:"#0e0e20",border:"1px solid #252540",borderRadius:8,padding:"8px 12px",fontSize:12}}><div style={{color:ACCENT,fontWeight:700,marginBottom:4}}>{label}</div>{payload.map((p,i)=>(<div key={i} style={{color:p.color||"#ccc",marginBottom:2}}>{p.name}: <strong style={{fontFamily:"monospace"}}>{typeof p.value==="number"?p.value.toFixed(2):p.value}</strong></div>))}</div>);};

function Ball({num,color=ACCENT,size=38,glow=false,gold=false,star=false}){
  return(<div style={{width:size,height:size,borderRadius:star?"20%":"50%",background:gold?`radial-gradient(circle at 35% 32%,#FFD700,#FF6B35)`:`radial-gradient(circle at 35% 32%,${color}cc,${color}33)`,border:`2px solid ${gold?"#FFD700":color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size>38?14:size>28?12:10,fontWeight:900,color:gold?"#0a0a0a":"#fff",fontFamily:"monospace",boxShadow:glow?`0 0 14px ${gold?"#FFD70099":`${color}88`}`:"none",flexShrink:0}}>{num}</div>);
}

function KpiCard({label,value,sub,color=ACCENT}){
  return(<div style={{background:C.card,border:`1px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:10,padding:"10px 12px",textAlign:"center"}}><div style={{color:C.dim,fontSize:9,marginBottom:2,textTransform:"uppercase",letterSpacing:1}}>{label}</div><div style={{color,fontSize:18,fontWeight:900,fontFamily:"monospace"}}>{value}</div>{sub&&<div style={{color:C.dim,fontSize:9,marginTop:2}}>{sub}</div>}</div>);
}

function TabAnimazione(){
  const allDraws=useDraws();
  const series=useMemo(()=>buildSeries(allDraws),[allDraws]);
  const [frame,setFrame]=useState(1);const [playing,setPlaying]=useState(false);const [speed,setSpeed]=useState(0.5);const [showMA5,setShowMA5]=useState(true);
  const canvasRef=useRef(null),containerRef=useRef(null),frameRef=useRef(1),rafRef=useRef(null);
  const [W,setW]=useState(660);const total=series.length;
  useEffect(()=>{const obs=new ResizeObserver(e=>{setW(Math.max(280,Math.floor(e[0].contentRect.width)-16));});if(containerRef.current)obs.observe(containerRef.current);return()=>obs.disconnect();},[]);
  const animate=useCallback(()=>{if(frameRef.current>=total){setPlaying(false);return;}frameRef.current=Math.min(frameRef.current+speed*0.1,total);setFrame(frameRef.current);rafRef.current=requestAnimationFrame(animate);},[speed,total]);
  useEffect(()=>{if(playing)rafRef.current=requestAnimationFrame(animate);else cancelAnimationFrame(rafRef.current);return()=>cancelAnimationFrame(rafRef.current);},[playing,animate]);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas||!series.length)return;
    const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,PAD={top:40,right:24,bottom:44,left:48};
    canvas.width=W*dpr;canvas.height=240*dpr;canvas.style.width=W+"px";canvas.style.height="240px";ctx.scale(dpr,dpr);
    const CW=W-PAD.left-PAD.right,CH=240-PAD.top-PAD.bottom,visible=Math.min(Math.ceil(frame),total);
    const toX=i=>PAD.left+(i/(Math.max(total-1,1)))*CW,toY=v=>PAD.top+(1-(v-20)/(220-20))*CH;
    ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,240);
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
        <KpiCard label="Estrazioni" value={allDraws.length} sub="2024 → oggi"/>
        <KpiCard label="Σ ultima" value={cur.sum} color={cur.sum>MU_TEO?C.orange:C.teal}/>
        <KpiCard label="μ reale" value={muReale.toFixed(1)} color={ACCENT} sub={`Δ ${(muReale-MU_TEO).toFixed(1)}`}/>
        <KpiCard label="z-score" value={cur.zScore?.toFixed(2)} color={Math.abs(cur.zScore)<1?C.green:Math.abs(cur.zScore)<2?C.orange:C.red}/>
      </div>
      <div style={{borderRadius:10,overflow:"hidden",border:"1px solid #1a1a2e",marginBottom:10}}>
        <canvas ref={canvasRef} style={{display:"block",cursor:"crosshair",width:"100%"}}/>
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
        <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:8}}>☯️ Pari / Dispari</div>
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
              <div style={{color:DC[i],fontSize:9,fontWeight:700}}>{(m.media/PICK*100).toFixed(1)}%</div><div style={{color:m.media===maxMedia?DC[i]:C.text,fontSize:11,fontWeight:700,fontFamily:"monospace"}}>{m.media.toFixed(2)}</div>
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
        <KpiCard label="Estrazioni" value={allDraws.length}/><KpiCard label="μ reale" value={muReale.toFixed(1)} color={C.orange} sub={`Δ ${(muReale-MU_TEO).toFixed(1)}`}/><KpiCard label="σ reale" value={sigmaReale.toFixed(1)} color={C.teal}/><KpiCard label="μ teorica" value={MU_TEO} color={ACCENT}/>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <span style={{color:C.dim,fontSize:11}}>Finestra:</span>
        {[10,20,50,100,allDraws.length].map(w=>(<button key={w} onClick={()=>setWinSize(Math.min(w,allDraws.length))} style={{background:winSize===Math.min(w,allDraws.length)?`${ACCENT}22`:"transparent",color:winSize===Math.min(w,allDraws.length)?ACCENT:C.dim,border:`1px solid ${winSize===Math.min(w,allDraws.length)?ACCENT:C.border}`,borderRadius:14,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{w===allDraws.length?"Tutte":w}</button>))}
      </div>
      {[{l:"SEGNALE SOMME",z:zOf(muReale,MU_TEO,SIGMA_TEO/Math.sqrt(allDraws.length)),d:`μ reale: ${muReale.toFixed(1)} · teo: ${MU_TEO}`},{l:"ANOMALIA MAX FREQUENZA",z:Math.max(...scored.map(s=>Math.abs(s.z))),d:`Più caldo: ${hotNums[0]?.num}`},{l:"SCOSTAMENTO DA MEDIA TEORICA",z:(muReale-MU_TEO)/sigmaReale,d:`Δ: ${(muReale-MU_TEO).toFixed(1)} punti`}].map(item=>{const col=zCol(item.z);const label=Math.abs(item.z)>2?"⚠️ Anomalia forte":Math.abs(item.z)>1?"⚡ Anomalia lieve":"✓ Nella norma";return(<div key={item.l} style={{background:C.card,border:`1px solid ${col}33`,borderLeft:`3px solid ${col}`,borderRadius:8,padding:"10px 14px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5,flexWrap:"wrap",gap:4}}><span style={{color:C.text,fontSize:11}}>{item.l}</span><span style={{color:col,fontSize:11,fontWeight:700}}>{label} (z={item.z.toFixed(2)})</span></div><div style={{background:"#0a0a18",borderRadius:4,height:6,overflow:"hidden",marginBottom:4}}><div style={{background:`linear-gradient(90deg,${C.teal},${col})`,width:`${clamp(Math.abs(item.z)/3*100,0,100)}%`,height:"100%"}}/></div><div style={{color:C.dim,fontSize:10}}>{item.d}</div></div>);})}
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
        <div style={{color:ACCENT,fontWeight:700,fontSize:12,marginBottom:8}}>🗺️ Mappa frequenze 1–50</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:3,marginBottom:12}}>
          {scored.map(s=>{const maxF=Math.max(...scored.map(x=>x.f))||1;const intensity=clamp(s.f/maxF,0,1);const col=s.isCold?C.teal:s.isHot?C.orange:ACCENT;const rit=getRitardo(s.num);return(<div key={s.num} title={`${s.num}: ${s.f}x rit.${rit}`} style={{aspectRatio:"1",background:`${col}${Math.round(intensity*180+40).toString(16).padStart(2,"00")}`,border:`1px solid ${col}22`,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontFamily:"monospace",fontWeight:700}}>{s.num}</div>);})}
        </div>
        <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Top 10 frequenti:</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
          {freqSorted.slice(0,10).map(([n,f])=>{const pct=(f/totalOcc*100).toFixed(1);const rit=getRitardo(+n);return(<div key={n} style={{background:`${ACCENT}11`,border:`1px solid ${ACCENT}33`,borderRadius:8,padding:"5px 8px",textAlign:"center"}}><Ball num={+n} color={ACCENT} size={26}/><div style={{color:ACCENT,fontSize:10,fontWeight:700}}>{f}x</div><div style={{color:C.teal,fontSize:9}}>{pct}%</div><div style={{color:C.dim,fontSize:9}}>rit.{rit}</div></div>);})}
        </div>
        <div style={{color:"#FFD700",fontWeight:700,fontSize:12,marginBottom:8}}>⭐ Stelle (1–12)</div>
        {(()=>{
          const sf={};allDraws.forEach(d=>(d.stelle||[]).forEach(s=>{sf[s]=(sf[s]||0)+1;}));const tot=Object.values(sf).reduce((s,v)=>s+v,0);
          return(<div style={{display:"flex",flexWrap:"wrap",gap:5}}>{Array.from({length:12},(_,i)=>i+1).map(n=>{const f=sf[n]||0;const pct=tot?((f/tot)*100).toFixed(1):"0.0";let rit=allDraws.length;for(let i=allDraws.length-1;i>=0;i--){if((allDraws[i].stelle||[]).includes(n)){rit=allDraws.length-1-i;break;}}return(<div key={n} style={{background:"#1a1a20",border:"1px solid #FFD70033",borderRadius:8,padding:"5px 8px",textAlign:"center"}}><Ball num={n} color="#FFD700" size={26} star/><div style={{color:"#FFD700",fontSize:10,fontWeight:700}}>{f}x</div><div style={{color:C.teal,fontSize:9}}>{pct}%</div><div style={{color:C.dim,fontSize:9}}>rit.{rit}</div></div>);})}</div>);
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
  const muT=useAdaptive?muReale:MU_TEO,sigT=useAdaptive?sigmaReale:SIGMA_TEO;
  const loB=Math.round(muT-kBand*sigT),hiB=Math.round(muT+kBand*sigT);
  const inBand=series.filter(d=>d.sum>=loB&&d.sum<=hiB).length;
  const chartData=series.slice(-200).map(d=>({date:d.date?.substring(0,5)||"",sum:d.sum,mu:d.mu,loA:Math.round(muReale-kBand*sigmaReale),hiA:Math.round(muReale+kBand*sigmaReale)}));
  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>📐 Banda Adattiva</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:14}}>
        <KpiCard label="μ reale" value={muReale.toFixed(1)} color={C.orange} sub={`${allDraws.length} est.`}/><KpiCard label="σ reale" value={sigmaReale.toFixed(1)} color={C.teal}/><KpiCard label="Min Σ" value={Math.min(...sums)} color={C.teal}/><KpiCard label="Max Σ" value={Math.max(...sums)} color={C.red}/><KpiCard label={`In ±${kBand}σ`} value={`${inBand}/${series.length}`} color={C.green} sub={`${(inBand/series.length*100).toFixed(0)}%`}/>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        {[0.5,1.0,1.5,2.0,2.5].map(k=>{const pct=(sums.filter(s=>s>=Math.round(muT-k*sigT)&&s<=Math.round(muT+k*sigT)).length/series.length*100).toFixed(0);return(<button key={k} onClick={()=>setKBand(k)} style={{background:kBand===k?`${ACCENT}22`:"transparent",color:kBand===k?ACCENT:C.dim,border:`1px solid ${kBand===k?ACCENT:C.border}`,borderRadius:8,padding:"5px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}><div style={{fontWeight:700}}>±{k}σ</div><div style={{fontSize:9,color:kBand===k?C.teal:C.dim}}>{pct}%</div></button>);})}
        {[{v:true,l:"Adattivo"},{v:false,l:"Teorico"}].map(x=>(<button key={String(x.v)} onClick={()=>setAdaptive(x.v)} style={{background:useAdaptive===x.v?`${C.teal}22`:"transparent",color:useAdaptive===x.v?C.teal:C.dim,border:`1px solid ${useAdaptive===x.v?C.teal:C.border}`,borderRadius:8,padding:"5px 12px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{x.l}</button>))}
        <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:"auto"}}><span style={{color:C.teal,fontFamily:"monospace",fontWeight:700}}>{loB}</span><span style={{color:C.dim}}>──</span><span style={{color:ACCENT,fontFamily:"monospace",fontWeight:900,fontSize:15}}>μ{Math.round(muT)}</span><span style={{color:C.dim}}>──</span><span style={{color:C.orange,fontFamily:"monospace",fontWeight:700}}>{hiB}</span></div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{top:8,right:12,bottom:0,left:0}}>
          <defs><linearGradient id="gBandaEM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity={0.28}/><stop offset="100%" stopColor={ACCENT} stopOpacity={0.08}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#0e0e1c"/>
          <XAxis dataKey="date" tick={{fill:C.dim,fontSize:9}} interval={Math.ceil(chartData.length/8)}/>
          <YAxis domain={[20,220]} tick={{fill:C.dim,fontSize:9}}/>
          <Tooltip content={<TT/>}/>
          <Area type="monotone" dataKey="hiA" stroke={`${ACCENT}cc`} strokeWidth={2} strokeDasharray="5 3" fill="url(#gBandaEM)" activeDot={false}/>
          <Area type="monotone" dataKey="loA" stroke={`${ACCENT}cc`} strokeWidth={2} strokeDasharray="5 3" fill="#07070F" activeDot={false}/>
          <ReferenceLine y={MU_TEO} stroke={`${ACCENT}99`} strokeDasharray="6 3" strokeWidth={1.5}/>
          <Line type="monotone" dataKey="mu" stroke={C.teal} strokeWidth={2} dot={false} name="μ"/>
          <Line type="monotone" dataKey="sum" stroke={ACCENT} strokeWidth={2} dot={(props)=>{const{cx,cy,payload}=props;const inB=payload.sum>=loB&&payload.sum<=hiB;return <circle key={cx} cx={cx} cy={cy} r={3} fill={inB?"#4A9E5C":"#C94040"} stroke="none"/>;}} name="Somma"/>
        </ComposedChart>
      </ResponsiveContainer>
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
  const [mode,setMode]=useState("auto");const [ticket,setTicket]=useState(null);const [stelle,setStelle]=useState(null);
  const [minSum,setMinSum]=useState(Math.round(muReale-sigmaReale));const [maxSum,setMaxSum]=useState(Math.round(muReale+sigmaReale));
  const [ratio,setRatio]=useState("any");const [freqInput,setFreqInput]=useState("");const [delayInput,setDelayInput]=useState("");
  const [results,setResults]=useState([]);const [scanned,setScanned]=useState(0);const [loading,setLoading]=useState(false);const [selectedTattico,setSelectedTattico]=useState(new Set());const [showSSTattico,setShowSSTattico]=useState(false);const [chosenSSTattico,setChosenSSTattico]=useState({});
  const loB=Math.round(muCustom-kBand*sigmaReale),hiB=Math.round(muCustom+kBand*sigmaReale);
  const scored=useMemo(()=>scoreNumbers(allDraws,winSize),[allDraws,winSize]);
  const totalOcc=Object.values(stats.freq).reduce((s,v)=>s+v,0);
  const freqEntries=Object.entries(stats.freq).sort((a,b)=>b[1]-a[1]);
  const top6freq=freqEntries.slice(0,6).map(([n])=>+n);const top6delay=freqEntries.slice(-6).map(([n])=>+n);
  function getRitardo(num){for(let i=allDraws.length-1;i>=0;i--){if(allDraws[i].nums.includes(num))return allDraws.length-1-i;}return allDraws.length;}
  const lastDraw=allDraws[allDraws.length-1];const lastEvens=lastDraw?.nums.filter(n=>n%2===0).length||2;
  const genera=()=>{const seed=Date.now();setTicket(generateTicket(scored,strategy,loB,hiB,muCustom,seed));setStelle(generateStelle(seed));};
  const generaTattico=()=>{
    setLoading(true);setResults([]);setScanned(0);
    setTimeout(()=>{
      const rng=mkRng(Date.now());const found=[],maxAttempts=150000;let sc=0;
      const freqNums=parseNums(freqInput),delayNums=parseNums(delayInput);
      while(found.length<50&&sc<maxAttempts){sc++;const pool=Array.from({length:POOL},(_,i)=>i+1);const nums=[];while(nums.length<PICK){const idx=Math.floor(rng()*pool.length);nums.push(pool.splice(idx,1)[0]);}nums.sort((a,b)=>a-b);const s=sm(nums);if(s<minSum||s>maxSum)continue;const evens=nums.filter(n=>n%2===0).length,odds=PICK-evens;if(ratio!=="any"){const[re,ro]=ratio.split("-").map(Number);if(evens!==re||odds!==ro)continue;}if(freqNums.length>0&&!nums.some(n=>freqNums.includes(n)))continue;if(delayNums.length>0&&nums.filter(n=>delayNums.includes(n)).length>2)continue;const key=nums.join(",");if(found.some(f=>f.nums.join(",")===key))continue;found.push({nums,sum:s,evens,odds,zScore:zOf(s,MU_TEO,SIGMA_TEO).toFixed(2)});}
      setResults(found);setScanned(sc);setLoading(false);
    },50);
  };
  const ratioOpts=[{v:"any",l:"Qualsiasi"},{v:"3-2",l:"3P–2D"},{v:"2-3",l:"2P–3D"},{v:"4-1",l:"4P–1D"},{v:"1-4",l:"1P–4D"}];
  return(
    <div>
      <h2 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:16,marginBottom:12}}>🎯 Generatore Cinquine + Stelle</h2>
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
        {[{id:"auto",l:"🤖 Automatica"},{id:"tattico",l:"⚡ Tattico"}].map(m=>(<button key={m.id} onClick={()=>setMode(m.id)} style={{background:mode===m.id?`${ACCENT}22`:"transparent",color:mode===m.id?ACCENT:C.dim,border:`1px solid ${mode===m.id?ACCENT:C.border}`,borderRadius:18,padding:"6px 14px",fontSize:11,fontWeight:mode===m.id?700:400,cursor:"pointer",fontFamily:"inherit"}}>{m.l}</button>))}
      </div>
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
        <button onClick={genera} style={{width:"100%",padding:"13px",background:`linear-gradient(135deg,${ACCENT},${C.teal})`,color:"#fff",border:"none",borderRadius:10,fontSize:16,fontWeight:900,cursor:"pointer",fontFamily:"Georgia,serif",marginBottom:12}}>🎲 Genera Cinquina + Stelle</button>
        {ticket&&(<div style={{background:"#080816",border:`1px solid ${ACCENT}55`,borderRadius:12,padding:14}}>
          <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {ticket.nums.map(n=>{const s=scored.find(x=>x.num===n);const col=s?.isHot?C.orange:s?.isCold?C.teal:ACCENT;return <Ball key={n} num={n} color={col} size={46} glow/>;})}<div style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:C.dim,fontSize:14}}>│</span>{stelle?.map(s=><Ball key={s} num={s} size={46} gold glow star/>)}<span style={{color:"#FFD700",fontSize:9}}>⭐</span></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
            {[{l:"Σ",v:ticket.sum,c:ACCENT},{l:"Δ da μ",v:(ticket.sum>muCustom?"+":"")+(ticket.sum-muCustom),c:C.teal},{l:"Δ da 127.5",v:(ticket.sum>MU_TEO?"+":"")+(ticket.sum-MU_TEO).toFixed(1),c:ticket.sum>MU_TEO?C.orange:C.teal},{l:"z",v:zOf(ticket.sum,MU_TEO,SIGMA_TEO).toFixed(2),c:Math.abs(zOf(ticket.sum,MU_TEO,SIGMA_TEO))<1?C.green:C.orange}].map(x=>(<div key={x.l} style={{background:"#0a0a18",borderRadius:6,padding:8,textAlign:"center"}}><div style={{color:C.dim,fontSize:9}}>{x.l}</div><div style={{color:x.c,fontSize:15,fontWeight:900,fontFamily:"monospace"}}>{x.v}</div></div>))}
          </div>
          <button onClick={()=>{const t={id:Date.now(),nums:ticket.nums,stelle,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy,sum:ticket.sum};const prev=JSON.parse(localStorage.getItem(LS_TICKETS_EM)||"[]");localStorage.setItem(LS_TICKETS_EM,JSON.stringify([...prev,t]));alert(`✅ Salvata!\n${ticket.nums.join("-")} | Stelle:${stelle?.join("-")||"—"}`);}} style={{width:"100%",padding:"10px",background:`${C.purple}22`,color:C.purple,border:`2px solid ${C.purple}`,borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💾 Salva → 🎫 Biglietti</button>
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
            <div style={{marginBottom:5}}><div style={{color:C.orange,fontSize:9,marginBottom:2}}>🔥 Frequenti:</div><input type="text" value={freqInput} onChange={e=>setFreqInput(e.target.value)} placeholder="Es. 5,22,38" style={{width:"100%",background:"#0a0a1c",color:C.text,border:"1px solid #2d2d54",borderRadius:5,padding:"4px",fontSize:10,outline:"none",boxSizing:"border-box"}}/></div>
            <div><div style={{color:C.teal,fontSize:9,marginBottom:2}}>❄️ Ritardatari:</div><input type="text" value={delayInput} onChange={e=>setDelayInput(e.target.value)} placeholder="Es. 3,17" style={{width:"100%",background:"#0a0a1c",color:C.text,border:"1px solid #2d2d54",borderRadius:5,padding:"4px",fontSize:10,outline:"none",boxSizing:"border-box"}}/></div>
          </div>
        </div>
        <button onClick={generaTattico} disabled={loading} style={{width:"100%",padding:"12px",background:loading?"#222":"linear-gradient(135deg,#FF6B35,#E63946)",color:loading?"#666":"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",marginBottom:12}}>{loading?"⏳ Scansione...":"⚡ GENERA COLONNE TATTICHE"}</button>
        {scanned>0&&<div style={{color:C.dim,fontSize:11,marginBottom:8}}>Scansionate: <strong style={{color:C.orange}}>{scanned.toLocaleString("it-IT")}</strong> · Trovate: <strong style={{color:C.green}}>{results.length}</strong></div>}
        {results.length>0&&!showSSTattico&&(
          <>
            <div style={{color:C.dim,fontSize:11,marginBottom:8}}>Clicca le cinquine che ti piacciono (max 10), poi premi <strong style={{color:"#FFD700"}}>Scegli Stelle</strong></div>
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
                ⭐ Scegli Stelle per {selectedTattico.size} cinquine selezionate
              </button>
            )}
          </>
        )}
        {showSSTattico&&(
          <div style={{background:C.card,border:`2px solid ${C.purple}44`,borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{color:C.purple,fontWeight:700,fontSize:14,marginBottom:14}}>⭐ Scegli le Stelle</div>
            {results.filter(r=>selectedTattico.has(r.nums.join(","))).map((r,idx)=>{
              const k=r.nums.join(",");
              const stelleFreq={};allDraws.forEach(d=>(d.stelle||[]).forEach(s=>{stelleFreq[s]=(stelleFreq[s]||0)+1;}));
              const totS=Object.values(stelleFreq).reduce((s,v)=>s+v,0);
              const topStelle=Array.from({length:STELLE_POOL},(_,i)=>i+1).map(n=>{const f=stelleFreq[n]||0;let rit=allDraws.length;for(let i=allDraws.length-1;i>=0;i--){if((allDraws[i].stelle||[]).includes(n)){rit=allDraws.length-1-i;break;}}return{n,f,rit,pct:totS?Math.round(f/totS*100):0};}).sort((a,b)=>b.f-a.f);
              const maxF=Math.max(...topStelle.map(x=>x.f),1);
              const chosen=chosenSSTattico[k]||[];
              return(
                <div key={idx} style={{background:"#080816",border:`1px solid ${C.purple}33`,borderRadius:10,padding:12,marginBottom:12}}>
                  <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                    <span style={{color:C.dim,fontSize:10}}>#{idx+1}</span>
                    {r.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={28}/>)}
                    <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700,fontFamily:"monospace"}}>Σ{r.sum}</span>
                  </div>
                  <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Scegli 2 Stelle (1–12) per affinità:</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                    {topStelle.map(t=>{const isCho=chosen.includes(t.n);return(
                      <div key={t.n} onClick={()=>setChosenSSTattico(prev=>{const cur=prev[k]||[];const next=cur.includes(t.n)?cur.filter(x=>x!==t.n):cur.length<STELLE_COUNT?[...cur,t.n]:cur;return{...prev,[k]:next};})} style={{textAlign:"center",cursor:"pointer",padding:"4px 3px",background:isCho?"#FFD70018":"#0e0e1c",border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,borderRadius:7,boxShadow:isCho?"0 0 8px #FFD70044":"none"}}>
                        <Ball num={t.n} size={24} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho} star={true}/>
                        <div style={{background:"#0a0a18",borderRadius:2,height:3,overflow:"hidden",margin:"2px 0",width:24}}><div style={{background:isCho?"#FFD700":"#d97706",height:"100%",width:`${Math.round(t.f/maxF*100)}%`}}/></div>
                        <div style={{color:isCho?"#FFD700":"#888",fontSize:8}}>{t.pct}%</div>
                      </div>
                    );})}
                  </div>
                  <div style={{background:chosen.length?`#FFD70008`:C.card,border:`1px solid ${chosen.length?"#FFD70033":C.border}`,borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{color:C.dim,fontSize:11}}>Stelle:</span>
                    {chosen.length?(<>{chosen.sort((a,b)=>a-b).map(n=><Ball key={n} num={n} size={30} gold glow star/>)}<span style={{color:"#FFD700",fontWeight:700,fontSize:13,fontFamily:"monospace"}}>{chosen.sort((a,b)=>a-b).join(" – ")}</span></>):<span style={{color:"#555",fontSize:11}}>Seleziona 2 stelle sopra</span>}
                  </div>
                  {chosen.length===STELLE_COUNT&&(<button onClick={()=>{const t={id:Date.now()+idx,nums:r.nums,stelle:chosen,date:new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),concorso:allDraws[allDraws.length-1]?.n||0,strategy:"tattico",sum:r.sum};const prev=JSON.parse(localStorage.getItem(LS_TICKETS_EM)||"[]");localStorage.setItem(LS_TICKETS_EM,JSON.stringify([...prev,t]));alert(`✅ Linea ${idx+1} salvata!\n${r.nums.join("-")} | Stelle:${chosen.sort((a,b)=>a-b).join("-")}`);}} style={{width:"100%",padding:"8px",marginTop:8,background:`${C.purple}22`,color:C.purple,border:`2px solid ${C.purple}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💾 Salva</button>)}
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

function TabEstrazioni({onUpdate}){
  const allDraws=useDraws();
  const [concorso,setConcorso]=useState("");const [date,setDate]=useState("");
  const [nums,setNums]=useState(Array(PICK).fill(""));const [stelle,setStelle]=useState(Array(STELLE_COUNT).fill(""));
  const [saved,setSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_KEY_EM)||"[]");}catch{return [];}});
  const [error,setError]=useState("");const [success,setSuccess]=useState("");const [savingToDb,setSavingToDb]=useState(false);
  const persist=(list)=>{localStorage.setItem(LS_KEY_EM,JSON.stringify(list));setSaved(list);onUpdate(list);};
  const add=async()=>{
    setError("");setSuccess("");
    const n=parseInt(concorso)||0;const pNums=nums.map(v=>parseInt(v)||0);const pStelle=stelle.map(v=>parseInt(v)||0);
    if(!date.trim()){setError("Inserisci la data");return;}
    if(pNums.some(x=>x<1||x>POOL)){setError(`Numeri 1–${POOL}`);return;}
    if([...new Set(pNums)].length!==PICK){setError("Numeri duplicati");return;}
    if(pStelle.some(x=>x<1||x>STELLE_POOL)){setError("Stelle 1–12");return;}
    const newDraw={n,date:date.trim(),nums:[...new Set(pNums)].sort((a,b)=>a-b),stelle:pStelle.sort((a,b)=>a-b)};
    setSavingToDb(true);
    try{
      const parts=date.trim().split("/");const dateIso=parts.length===2?`2026-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`:date.trim();
      const {error:dbErr}=await supabase.from("euromillions").insert({data:dateIso,n1:pNums[0],n2:pNums[1],n3:pNums[2],n4:pNums[3],n5:pNums[4],s1:pStelle[0],s2:pStelle[1]});
      if(dbErr)throw dbErr;
      setSuccess(`✅ Concorso #${n} salvato nel DB!`);
    }catch(err){setSuccess(`✅ Salvato localmente`);}
    setSavingToDb(false);
    persist([...saved,newDraw].sort((a,b)=>(a.n||0)-(b.n||0)));
    setConcorso("");setDate("");setNums(Array(PICK).fill(""));setStelle(Array(STELLE_COUNT).fill(""));
    setTimeout(()=>setSuccess(""),4000);
  };
  return(
    <div>
      <h2 style={{color:C.green,fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>📥 Inserimento Nuove Estrazioni</h2>
      <div style={{background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:11}}><span style={{color:C.teal}}>🔗 Database Supabase — </span><span style={{color:C.dim}}>{allDraws.length} estrazioni storiche</span></div>
      <div style={{background:"#0a1a0a",border:`2px solid ${C.green}44`,borderRadius:12,padding:16,marginBottom:20}}>
        <div style={{color:C.green,fontWeight:700,fontSize:13,marginBottom:12}}>➕ Aggiungi estrazione EuroMillions</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
          <div><div style={{color:C.dim,fontSize:10,marginBottom:3}}>Concorso #</div><input type="number" value={concorso} onChange={e=>setConcorso(e.target.value)} placeholder="42" style={{width:70,textAlign:"center",background:"#050510",color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 4px",fontSize:14,fontFamily:"monospace",outline:"none"}}/></div>
          <div><div style={{color:C.dim,fontSize:10,marginBottom:3}}>Data (gg/mm)</div><input type="text" value={date} onChange={e=>setDate(e.target.value)} placeholder="dd/mm" style={{width:80,textAlign:"center",background:"#050510",color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 6px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{color:C.dim,fontSize:10,marginBottom:6}}>{PICK} Numeri (1–{POOL})</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {nums.map((v,i)=>{const num=parseInt(v)||0,valid=num>=1&&num<=POOL;const isDup=valid&&nums.filter(x=>parseInt(x)===num).length>1;return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><Ball num={valid&&!isDup?num:"?"} color={isDup?C.red:ACCENT} size={36} glow={valid&&!isDup}/><input type="number" min={1} max={POOL} value={v} onChange={e=>{const n=[...nums];n[i]=e.target.value;setNums(n);}} placeholder={`N${i+1}`} style={{width:46,textAlign:"center",background:"#050510",color:isDup?C.red:valid?ACCENT:C.dim,border:`1.5px solid ${isDup?C.red:valid?`${ACCENT}66`:C.border}`,borderRadius:7,padding:"5px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>);})}
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:8}}><span style={{color:C.dim,fontSize:16}}>│</span>
              <div><div style={{color:"#FFD700",fontSize:10,marginBottom:4}}>Stelle (1–12)</div>
                <div style={{display:"flex",gap:6}}>{stelle.map((v,i)=>{const num=parseInt(v)||0,valid=num>=1&&num<=STELLE_POOL;return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><Ball num={valid?num:"?"} size={36} gold={valid} star={valid}/><input type="number" min={1} max={STELLE_POOL} value={v} onChange={e=>{const n=[...stelle];n[i]=e.target.value;setStelle(n);}} style={{width:44,textAlign:"center",background:"#050510",color:"#FFD700",border:"1.5px solid #FFD70055",borderRadius:7,padding:"5px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/></div>);})}</div>
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
  const [tickets,setTickets]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_TICKETS_EM)||"[]");}catch{return [];}});
  const [expanded,setExpanded]=useState(null);const [confirmDel,setConfirmDel]=useState(null);
  useEffect(()=>{try{setTickets(JSON.parse(localStorage.getItem(LS_TICKETS_EM)||"[]"));}catch{}},[allDraws]);
  const persist=(list)=>{localStorage.setItem(LS_TICKETS_EM,JSON.stringify(list));setTickets(list);};
  const remove=(id)=>{persist(tickets.filter(t=>t.id!==id));setConfirmDel(null);setExpanded(null);};
  function getResults(ticket){const fromN=ticket.concorso||0;return allDraws.filter(d=>(d.n||0)>fromN).map(d=>{const matches=d.nums.filter(n=>ticket.nums.includes(n));return{n:d.n,date:d.date,nums:d.nums,stelle:d.stelle,pts:matches.length,matches};});}
  return(
    <div>
      <h2 style={{color:C.purple,fontFamily:"Georgia,serif",fontSize:16,marginBottom:8}}>🎫 Biglietti Giocati</h2>
      <p style={{color:C.dim,fontSize:11,marginBottom:16}}>Confronto automatico con le estrazioni successive ({allDraws.length} totali).</p>
      {tickets.length===0&&(<div style={{textAlign:"center",color:C.dim,padding:"28px 0",fontSize:13,background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>Nessun biglietto.<br/><span style={{fontSize:11}}>Genera nel tab 🎯 e premi 💾 Salva.</span></div>)}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[...tickets].reverse().map(ticket=>{
          const results=getResults(ticket);const bestPts=results.length?Math.max(...results.map(r=>r.pts)):0;
          const bestCol=PRIZE_COLORS[Math.min(bestPts,5)]||C.dim;const isOpen=expanded===ticket.id;const pendingDel=confirmDel===ticket.id;
          return(<div key={ticket.id} style={{background:C.card,border:`2px solid ${pendingDel?"#C94040":bestPts>=2?bestCol:C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",cursor:"pointer"}} onClick={()=>{if(!pendingDel)setExpanded(isOpen?null:ticket.id);}}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                {ticket.nums.map(n=>{const hitAny=results.some(r=>r.matches.includes(n));return<Ball key={n} num={n} color={hitAny?bestCol:ACCENT} size={30} glow={hitAny&&bestPts>=2}/>;})}
                {ticket.stelle?.length&&<><span style={{color:C.dim,fontSize:14,alignSelf:"center"}}>│</span>{ticket.stelle.map(s=><Ball key={s} num={s} size={28} gold star/>)}<span style={{color:"#FFD700",fontSize:8}}>⭐</span></>}
              </div>
              <div style={{flex:1,minWidth:120}}><div style={{color:C.dim,fontSize:10}}>Giocato {ticket.date} · dopo #{ticket.concorso||"?"} · Σ={sm(ticket.nums)}</div>{results.length>0?(<div style={{color:bestPts>=2?bestCol:C.dim,fontWeight:700,fontSize:12}}>{bestPts>=2?`🎯 max ${bestPts}✓`:`Nessun punto`}</div>):<div style={{color:C.dim,fontSize:11}}>⏳ In attesa</div>}</div>
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
      {tickets.length>0&&(<div style={{marginTop:14,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>persist([])} style={{background:"transparent",color:"#C94040",border:"1px solid #C9404033",borderRadius:8,padding:"7px 16px",fontSize:11,cursor:"pointer"}}>🗑 Cancella tutti</button><span style={{color:C.dim,fontSize:10}}>{tickets.length} bigliett{tickets.length===1?"o":"i"}</span></div>)}
    </div>
  );
}

const TABS=[{id:"animazione",icon:"📈",label:"Animazione"},{id:"segnali",icon:"🔬",label:"Segnali & Freq."},{id:"banda",icon:"📐",label:"Banda Adattiva"},{id:"generatore",icon:"🎯",label:"Generatore"},{id:"estrazioni",icon:"📥",label:"Estrazioni"},{id:"biglietti",icon:"🎫",label:"Biglietti"}];

export default function App(){
  const [tab,setTab]=useState("animazione");
  const [dbDraws,setDbDraws]=useState([]);const [loading,setLoading]=useState(true);
  const [extraDraws,setExtraDraws]=useState(()=>{try{return JSON.parse(localStorage.getItem(LS_KEY_EM)||"[]");}catch{return [];}});
  useEffect(()=>{
    async function loadDraws(){
      try{
        const {data,error}=await supabase.from("euromillions").select("*").order("data",{ascending:true});
        if(error)throw error;
        const mapped=data.map(r=>({n:r.id,date:r.data?r.data.substring(5).split("-").reverse().join("/"):"",nums:[r.n1,r.n2,r.n3,r.n4,r.n5].filter(Boolean).sort((a,b)=>a-b),stelle:[r.s1,r.s2].filter(Boolean).sort((a,b)=>a-b)}));
        setDbDraws(mapped);
      }catch(err){console.error("Supabase error:",err);setDbDraws([]);}finally{setLoading(false);}
    }
    loadDraws();
  },[]);
  const allDraws=useMemo(()=>{const extraNs=new Set(extraDraws.map(d=>d.n));return [...dbDraws.filter(d=>!extraNs.has(d.n)),...extraDraws].sort((a,b)=>a.n-b.n);},[dbDraws,extraDraws]);
  const handleUpdate=useCallback((list)=>{setExtraDraws(list);},[]);
  const last=allDraws[allDraws.length-1];const lastSum=last?sm(last.nums):0;
  if(loading)return(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{color:ACCENT,fontSize:28}}>⭐</div><div style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:18}}>Caricamento EuroMillions...</div><div style={{color:C.dim,fontSize:12}}>Connessione a Supabase</div></div>);
  return(
    <DrawsContext.Provider value={allDraws}>
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Courier New',monospace",color:C.text,paddingBottom:60}}>
      <div style={{maxWidth:780,margin:"0 auto",padding:"0 12px"}}>
        <div style={{background:"linear-gradient(180deg,#0c0c1e 0%,transparent 100%)",padding:"16px 0 0",textAlign:"center",marginBottom:0}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{fontSize:26}}>🌍</span>
            <h1 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:22,margin:0}}>EuroMillions</h1>
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
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:C.dim,fontSize:14}}>│</span>{(last.stelle||[]).map(s=><Ball key={s} num={s} size={28} gold star/>)}<span style={{color:"#FFD700",fontSize:9}}>⭐</span></div>
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
          <div style={{color:"#353545",fontSize:10,lineHeight:1.7}}>⚠️ Strumento puramente statistico — nessun potere predittivo. Il gioco può causare dipendenza. Vietato ai minori di 18 anni. Dati storici: {allDraws.length} estrazioni.</div>
        </div>
      </div>
    </div>
    </DrawsContext.Provider>
  );
}
