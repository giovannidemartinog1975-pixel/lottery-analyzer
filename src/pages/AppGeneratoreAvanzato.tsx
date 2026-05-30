import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { supabase } from '../lib/supabase';

const POOL=90, PICK=6, ACCENT="#D4AF37";
const C={bg:"#07070F",card:"#0D0D1A",border:"#1A1A2E",text:"#E0E0F0",dim:"#6A6A8A",orange:"#F07030",teal:"#2BA89A",red:"#C94040",purple:"#8A5CC4",green:"#4A9E5C"};
const DECINE=[{l:"1–9",a:1,b:9},{l:"10–19",a:10,b:19},{l:"20–29",a:20,b:29},{l:"30–39",a:30,b:39},{l:"40–49",a:40,b:49},{l:"50–59",a:50,b:59},{l:"60–69",a:60,b:69},{l:"70–79",a:70,b:79},{l:"80–90",a:80,b:90}];
const DC=["#E8B84B","#F07030","#C94040","#8A5CC4","#4A8FD4","#2BA89A","#4A9E5C","#d97706","#E8B84B"];
const sm=(a:number[])=>a.reduce((s,v)=>s+v,0);

interface Draw{nums:number[];superstar?:number;}
interface Combo{nums:number[];sum:number;ev:number;od:number;dc:number[];fq:number;ar:number;}

function buildStats(draws:Draw[]){
  const freq:Record<number,number>={},last:Record<number,number>={};
  draws.forEach((d,i)=>d.nums.forEach(n=>{freq[n]=(freq[n]||0)+1;last[n]=i;}));
  const total=draws.length;
  return{total,freq,last,getRit:(n:number)=>total-1-(last[n]??-1),getFreq:(n:number)=>freq[n]||0};
}

function Ball({num,color=ACCENT,size=28,glow=false,gold=false}:{num:number|string,color?:string,size?:number,glow?:boolean,gold?:boolean}){
  return <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,background:gold?"radial-gradient(circle at 35% 32%,#FFD700,#FF6B35)":`radial-gradient(circle at 35% 32%,${color}99,${color}22)`,border:`2px solid ${gold?"#FFD700":color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size>38?14:size>28?11:9,fontWeight:900,color:gold?"#0a0a0a":"#fff",fontFamily:"monospace",boxShadow:glow?`0 0 10px ${gold?"#FFD70088":`${color}66`}`:"none"}}>{num}</div>;
}

function KpiCard({label,value,color=ACCENT,sub}:{label:string,value:string|number,color?:string,sub?:string}){
  return <div style={{background:C.card,border:`1px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:10,padding:"10px 12px",textAlign:"center"}}><div style={{color:C.dim,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{label}</div><div style={{color,fontSize:18,fontWeight:900,fontFamily:"monospace"}}>{value}</div>{sub&&<div style={{color:C.dim,fontSize:9,marginTop:2}}>{sub}</div>}</div>;
}

function getSuperstarTop(nums:number[],draws:Draw[],n=12){
  const ts=sm(nums),total=draws.length;
  const scores=Array.from({length:90},(_,i)=>i+1).map(ss=>{
    const f=draws.filter(d=>d.superstar===ss).length;
    const sim=draws.filter(d=>Math.abs(sm(d.nums)-ts)<=30);
    const co=sim.length>0?sim.filter(d=>d.superstar===ss).length/sim.length:f/total;
    let last=-1;for(let i=total-1;i>=0;i--){if(draws[i].superstar===ss){last=i;break;}}
    const rit=last===-1?total:total-1-last;
    return{ss,score:(f/total)*0.4+co*0.35+Math.min(rit/total,1)*0.25,rit};
  });
  const maxSc=Math.max(...scores.map(s=>s.score));
  return scores.sort((a,b)=>b.score-a.score).slice(0,n).map(s=>({ss:s.ss,pct:Math.round(s.score/maxSc*100),rit:s.rit}));
}

export default function AppGeneratoreAvanzato(){
  const [draws,setDraws]=useState<Draw[]>([]);
  const [loadingDraws,setLoadingDraws]=useState(true);
  useEffect(()=>{
    async function load(){
      try{const{data}=await supabase.from("superenalotto").select("*").order("data",{ascending:true});
        if(data)setDraws(data.map((r:any)=>({nums:[r.n1,r.n2,r.n3,r.n4,r.n5,r.n6].filter(Boolean).sort((a:number,b:number)=>a-b),superstar:r.superstar||undefined})));}
      catch(e){console.error(e);}
      setLoadingDraws(false);
    }
    load();
  },[]);

  const stats=useMemo(()=>draws.length>0?buildStats(draws):null,[draws]);

  const [minSum,setMinSum]=useState(258);
  const [maxSum,setMaxSum]=useState(262);
  const [fParity,setFParity]=useState("any");
  const [fDec,setFDec]=useState<Map<number,number>>(new Map());
  const [fMinFreq,setFMinFreq]=useState(0);
  const [fMaxRit,setFMaxRit]=useState(0);
  const [fSort,setFSort]=useState<"sum"|"freq"|"rit">("sum");
  const [phase,setPhase]=useState<1|2|3>(1);
  const [results,setResults]=useState<Combo[]>([]);
  const [generating,setGenerating]=useState(false);
  const [genPct,setGenPct]=useState(0);
  const [genFound,setGenFound]=useState(0);
  const [genScanned,setGenScanned]=useState(0);
  const [genMs,setGenMs]=useState(0);
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [chosenSS,setChosenSS]=useState<Record<string,number>>({});
  const workerRef=useRef<Worker|null>(null);

  const decineStats=useMemo(()=>{
    if(!stats||draws.length===0)return DECINE.map(()=>({media:0}));
    return DECINE.map(d=>({media:draws.reduce((s,dr)=>s+dr.nums.filter(n=>n>=d.a&&n<=d.b).length,0)/draws.length}));
  },[draws,stats]);

  const hot3count=useMemo(()=>{
    if(!stats)return 0;
    let c=0;for(let n=1;n<=90;n++)if(stats.getFreq(n)>=3)c++;return c;
  },[stats]);

  const quickRanges=[
    {l:"258–262",lo:258,hi:262},{l:"255–265",lo:255,hi:265},
    {l:"250–270",lo:250,hi:270},{l:"240–280",lo:240,hi:280},
    {l:"270–280",lo:270,hi:280},{l:"300–310",lo:300,hi:310},
  ];

  const genera=useCallback(()=>{
    if(maxSum<minSum||!stats)return;
    // Termina worker precedente
    if(workerRef.current){workerRef.current.terminate();workerRef.current=null;}
    const t0=Date.now();
    setGenerating(true);setGenPct(0);setGenFound(0);setGenScanned(0);
    setResults([]);setSelected(new Set());setChosenSS({});

    // Converti Map in oggetto plain per il worker
    const decObj:Record<number,number>={};
    fDec.forEach((v,k)=>{decObj[k]=v;});

    const worker=new Worker('/generator.worker.js');
    workerRef.current=worker;

    worker.onmessage=(e)=>{
      const{type,found,scanned,pct,result}=e.data;
      if(type==="progress"){
        setGenFound(found);setGenScanned(scanned);setGenPct(pct);
      } else if(type==="done"){
        let sorted=[...result];
        if(fSort==="freq")sorted.sort((a:Combo,b:Combo)=>b.fq-a.fq);
        else if(fSort==="rit")sorted.sort((a:Combo,b:Combo)=>a.ar-b.ar);
        else sorted.sort((a:Combo,b:Combo)=>a.sum-b.sum);
        setResults(sorted);setGenScanned(scanned);setGenMs(Date.now()-t0);
        setGenerating(false);setPhase(2);
        worker.terminate();workerRef.current=null;
      }
    };
    worker.onerror=(e)=>{
      console.error("Worker error:",e);
      setGenerating(false);
      worker.terminate();workerRef.current=null;
    };

    worker.postMessage({
      minSum,maxSum,parity:fParity,dec:decObj,
      minFreq:fMinFreq,maxRit:fMaxRit,
      freq:stats.freq,last:stats.last,total:stats.total,
    });
  },[minSum,maxSum,fParity,fDec,fMinFreq,fMaxRit,fSort,stats]);

  const stopGenera=()=>{
    if(workerRef.current){workerRef.current.terminate();workerRef.current=null;}
    setGenerating(false);
  };

  const toggleDec=(idx:number,delta:number)=>{
    setFDec(prev=>{const next=new Map(prev);const nv=Math.max(0,Math.min((next.get(idx)||0)+delta,PICK));if(nv===0)next.delete(idx);else next.set(idx,nv);return next;});
  };
  const toggleSelect=(key:string)=>{
    setSelected(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else if(next.size<10)next.add(key);return next;});
  };
  const phase3Combos=useMemo(()=>[...selected].map(k=>results.find(c=>c.nums.join(",")===k)).filter(Boolean) as Combo[],[selected,results]);

  if(loadingDraws)return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{color:ACCENT,fontSize:28}}>🎯</div><div style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:18}}>Caricamento...</div></div>;

  return(
  <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Courier New',monospace",color:C.text,paddingBottom:80}}>
  <div style={{maxWidth:820,margin:"0 auto",padding:"0 12px"}}>

    <div style={{textAlign:"center",padding:"20px 0 14px"}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:6}}>
        <span style={{fontSize:26}}>🎯</span>
        <h1 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:22,margin:0}}>Generatore Avanzato</h1>
        <span style={{background:`${ACCENT}22`,border:`1px solid ${ACCENT}44`,borderRadius:20,padding:"2px 10px",color:ACCENT,fontSize:10,fontWeight:700}}>SuperEnalotto</span>
      </div>
      <div style={{color:C.dim,fontSize:11,marginBottom:14}}>Imposta filtri → Genera → Seleziona → SuperStar</div>
      <div style={{display:"flex",justifyContent:"center",gap:6,flexWrap:"wrap"}}>
        {[{n:1,l:"Filtri & Range"},{n:2,l:"Lista"},{n:3,l:"SuperStar"}].map(f=>(
          <React.Fragment key={f.n}>
            <div style={{background:phase===f.n?`linear-gradient(135deg,${ACCENT},${C.teal})`:phase>f.n?`${C.green}33`:C.border,color:phase===f.n?"#000":phase>f.n?C.green:C.dim,borderRadius:20,padding:"4px 14px",fontSize:10,fontWeight:phase===f.n?700:400,border:`1px solid ${phase===f.n?ACCENT:phase>f.n?C.green:C.border}`}}>
              {phase>f.n?"✓ ":""}{f.n}. {f.l}
            </div>
            {f.n<3&&<span style={{color:C.dim,alignSelf:"center",fontSize:12}}>→</span>}
          </React.Fragment>
        ))}
      </div>
    </div>

    {stats&&(
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:14}}>
        <KpiCard label="Estrazioni" value={draws.length} sub="da Supabase"/>
        <KpiCard label="μ reale" value={(draws.reduce((s,d)=>s+sm(d.nums),0)/draws.length).toFixed(1)} color={C.orange}/>
        <KpiCard label="Numeri caldi" value={hot3count} color={C.orange} sub="≥3x storiche"/>
        <KpiCard label="Pool" value={`1–${POOL}`} color={C.teal}/>
      </div>
    )}

    {/* FASE 1 */}
    <div style={{background:C.card,border:`1px solid ${phase===1?`${ACCENT}66`:C.border}`,borderRadius:12,padding:16,marginBottom:14}}>
      <div style={{color:ACCENT,fontWeight:700,fontSize:14,marginBottom:4}}>⚙️ Fase 1 — Imposta Filtri e Genera</div>
      <div style={{color:C.dim,fontSize:11,marginBottom:14}}>Filtri applicati in un <strong style={{color:ACCENT}}>Web Worker</strong> — il browser non si blocca mai.</div>

      {/* Range */}
      <div style={{background:"#080816",borderRadius:8,padding:12,marginBottom:12,border:`1px solid ${C.border}`}}>
        <div style={{color:ACCENT,fontSize:12,fontWeight:700,marginBottom:8}}>📊 Range Somma</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
          {quickRanges.map(r=>(
            <button key={r.l} onClick={()=>{setMinSum(r.lo);setMaxSum(r.hi);}} style={{background:minSum===r.lo&&maxSum===r.hi?`${ACCENT}22`:"#0a0a18",color:minSum===r.lo&&maxSum===r.hi?ACCENT:C.dim,border:`1px solid ${minSum===r.lo&&maxSum===r.hi?ACCENT:C.border}`,borderRadius:8,padding:"5px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
              <div style={{fontWeight:700}}>{r.l}</div>
              <div style={{fontSize:9,color:C.teal}}>Δ={r.hi-r.lo}</div>
            </button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}}>
          {[{l:"Somma Minima",v:minSum,set:setMinSum},{l:"Somma Massima",v:maxSum,set:setMaxSum}].map(f=>(
            <div key={f.l}>
              <div style={{color:C.dim,fontSize:10,marginBottom:4}}>{f.l}</div>
              <input type="range" min={21} max={534} value={f.v} onChange={e=>f.set(+e.target.value)} style={{width:"100%",accentColor:ACCENT,marginBottom:4}}/>
              <input type="number" min={21} max={534} value={f.v} onChange={e=>f.set(Math.max(21,Math.min(534,+e.target.value)))} style={{width:"100%",background:"#0a0a18",color:ACCENT,border:`1px solid ${ACCENT}55`,borderRadius:8,padding:"7px",fontSize:16,fontFamily:"monospace",fontWeight:700,outline:"none",textAlign:"center"}}/>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10,fontSize:11,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{color:C.dim}}>Range:</span>
          <span style={{color:C.teal,fontFamily:"monospace",fontWeight:700}}>{minSum}</span>
          <span style={{color:C.dim}}>──</span>
          <span style={{color:C.orange,fontFamily:"monospace",fontWeight:700}}>{maxSum}</span>
          <span style={{color:C.dim}}>Δ={maxSum-minSum}</span>
          {maxSum<minSum&&<span style={{color:C.red}}>⚠️ Max ≥ Min</span>}
        </div>
      </div>

      {/* Pari/Dispari */}
      <div style={{background:"#080816",borderRadius:8,padding:12,marginBottom:12,border:`1px solid ${C.border}`}}>
        <div style={{color:ACCENT,fontSize:12,fontWeight:700,marginBottom:8}}>☯️ Pari / Dispari</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {["any","3-3","4-2","2-4","5-1","1-5","6-0","0-6"].map(v=>(
            <button key={v} onClick={()=>setFParity(v)} style={{background:fParity===v?`${ACCENT}22`:"transparent",color:fParity===v?ACCENT:C.dim,border:`1px solid ${fParity===v?ACCENT:C.border}`,borderRadius:8,padding:"5px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>
              {v==="any"?"Qualsiasi":v.replace("-","P–")+"D"}
            </button>
          ))}
        </div>
      </div>

      {/* Decine con statistiche */}
      <div style={{background:"#080816",borderRadius:8,padding:12,marginBottom:12,border:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <span style={{color:ACCENT,fontSize:12,fontWeight:700}}>🔢 Decine</span>
          <button onClick={()=>setFDec(new Map())} style={{background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:5,padding:"2px 8px",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>Reset</button>
        </div>
        <div style={{color:C.dim,fontSize:10,marginBottom:8}}>La barra mostra la media storica di numeri estratti per decina su {draws.length} estrazioni</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(75px,1fr))",gap:4}}>
          {DECINE.map((d,i)=>{
            const cnt=fDec.get(i)||0;
            const media=decineStats[i].media;
            const maxMedia=Math.max(...decineStats.map(x=>x.media),0.1);
            return(
              <div key={d.l} style={{background:cnt>0?`${DC[i]}18`:"#0a0a18",border:`2px solid ${cnt>0?DC[i]:C.border}`,borderRadius:8,padding:"5px 3px",textAlign:"center"}}>
                <div style={{color:DC[i],fontSize:8,fontWeight:700}}>{d.l}</div>
                <div style={{background:"#0a0a1a",borderRadius:3,height:4,overflow:"hidden",margin:"3px 2px"}}>
                  <div style={{background:DC[i],height:"100%",width:`${(media/maxMedia)*100}%`}}/>
                </div>
                <div style={{color:C.dim,fontSize:8,marginBottom:2}}>μ={media.toFixed(2)}</div>
                <div style={{color:cnt>0?DC[i]:"#555",fontSize:13,fontWeight:900,fontFamily:"monospace",minHeight:16}}>{cnt>0?cnt:"–"}</div>
                <div style={{display:"flex",gap:2,justifyContent:"center",marginTop:2}}>
                  <button onClick={()=>toggleDec(i,-1)} style={{width:20,height:20,borderRadius:3,background:cnt>0?"#1a0606":"#1a1a2e",color:cnt>0?C.red:"#444",border:`1px solid ${cnt>0?C.red:"#444"}`,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                  <button onClick={()=>toggleDec(i,1)} style={{width:20,height:20,borderRadius:3,background:`${DC[i]}22`,color:DC[i],border:`1px solid ${DC[i]}`,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Frequenti + Ritardo */}
      {stats&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div style={{background:"#080816",borderRadius:8,padding:12,border:`1px solid ${C.border}`}}>
            <div style={{color:C.orange,fontSize:11,fontWeight:700,marginBottom:2}}>🔥 Min numeri frequenti</div>
            <div style={{color:C.dim,fontSize:9,marginBottom:8}}>{hot3count} numeri ≥3x ({Math.round(hot3count/90*100)}% del pool)</div>
            <div style={{display:"flex",gap:4}}>
              {[0,1,2,3,4].map(n=>(
                <button key={n} onClick={()=>setFMinFreq(n)} style={{flex:1,background:fMinFreq===n?`${C.orange}22`:"transparent",color:fMinFreq===n?C.orange:C.dim,border:`1px solid ${fMinFreq===n?C.orange:C.border}`,borderRadius:6,padding:"5px 2px",fontSize:10,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                  <div style={{fontWeight:700}}>{n===0?"—":`${n}+`}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{background:"#080816",borderRadius:8,padding:12,border:`1px solid ${C.border}`}}>
            <div style={{color:C.teal,fontSize:11,fontWeight:700,marginBottom:2}}>❄️ Max ritardo medio</div>
            <div style={{color:C.dim,fontSize:9,marginBottom:8}}>Ritardo medio dei 6 numeri</div>
            <div style={{display:"flex",gap:4}}>
              {[{v:0,l:"—"},{v:20,l:"≤20"},{v:30,l:"≤30"},{v:50,l:"≤50"},{v:70,l:"≤70"}].map(x=>(
                <button key={x.v} onClick={()=>setFMaxRit(x.v)} style={{flex:1,background:fMaxRit===x.v?`${C.teal}22`:"transparent",color:fMaxRit===x.v?C.teal:C.dim,border:`1px solid ${fMaxRit===x.v?C.teal:C.border}`,borderRadius:6,padding:"5px 2px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{x.l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ordinamento */}
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <span style={{color:C.dim,fontSize:11}}>Ordina per:</span>
        {[{v:"sum",l:"Somma"},{v:"freq",l:"Frequenza"},{v:"rit",l:"Ritardo"}].map(x=>(
          <button key={x.v} onClick={()=>setFSort(x.v as any)} style={{background:fSort===x.v?`${ACCENT}22`:"transparent",color:fSort===x.v?ACCENT:C.dim,border:`1px solid ${fSort===x.v?ACCENT:C.border}`,borderRadius:8,padding:"5px 12px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{x.l}</button>
        ))}
      </div>

      {/* Progress */}
      {generating&&(
        <div style={{marginBottom:12}}>
          <div style={{background:"#0a0a18",borderRadius:4,height:8,overflow:"hidden",marginBottom:4}}>
            <div style={{background:`linear-gradient(90deg,${ACCENT},${C.teal})`,height:"100%",width:`${genPct}%`,transition:"width 0.2s"}}/>
          </div>
          <div style={{color:C.dim,fontSize:11,textAlign:"center"}}>{genPct}% — trovate <strong style={{color:ACCENT}}>{genFound.toLocaleString("it-IT")}</strong> su {genScanned.toLocaleString("it-IT")} scansionate</div>
        </div>
      )}

      <div style={{display:"flex",gap:8}}>
        <button onClick={genera} disabled={generating||maxSum<minSum||!stats} style={{flex:1,padding:"14px",background:generating?"#1a1a2e":`linear-gradient(135deg,${ACCENT},${C.teal})`,color:generating?"#555":"#000",border:"none",borderRadius:10,fontSize:16,fontWeight:900,cursor:generating?"not-allowed":"pointer",fontFamily:"Georgia,serif"}}>
          {generating?`⏳ ${genPct}% — ${genFound.toLocaleString("it-IT")} trovate`:"⚡ GENERA CON QUESTI FILTRI"}
        </button>
        {generating&&(
          <button onClick={stopGenera} style={{padding:"14px 20px",background:`${C.red}22`,color:C.red,border:`2px solid ${C.red}`,borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⏹ Stop</button>
        )}
      </div>
    </div>

    {/* FASE 2 */}
    {phase>=2&&(
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
          <div>
            <span style={{color:ACCENT,fontWeight:700,fontSize:14}}>{results.length.toLocaleString("it-IT")} sestine</span>
            <span style={{color:C.dim,fontSize:11}}> su {genScanned.toLocaleString("it-IT")} scansionate in {genMs}ms</span>
          </div>
          {selected.size>0&&(
            <button onClick={()=>setPhase(3)} style={{background:`linear-gradient(135deg,${C.purple},${C.teal})`,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⭐ SuperStar ({selected.size})</button>
          )}
        </div>
        <div style={{color:C.dim,fontSize:10,marginBottom:8}}>Clicca per selezionare (max 10) · <span style={{color:C.orange}}>●</span> frequente · <span style={{color:C.teal}}>●</span> ritardatario</div>
        {results.length===0?(
          <div style={{textAlign:"center",color:C.dim,padding:"30px 0"}}>Nessuna sestina trovata. Allarga i criteri e rigenera.</div>
        ):(
          <div style={{maxHeight:500,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
            {results.map((c,i)=>{
              const k=c.nums.join(",");const isSel=selected.has(k);
              return(
                <div key={i} onClick={()=>toggleSelect(k)} style={{background:isSel?`${ACCENT}12`:"#080816",border:`2px solid ${isSel?ACCENT:C.border}`,borderRadius:8,padding:"7px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${isSel?ACCENT:C.dim}`,background:isSel?ACCENT:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#000",fontWeight:900,flexShrink:0}}>{isSel?"✓":""}</div>
                  <div style={{display:"flex",gap:3,flex:1,flexWrap:"wrap"}}>
                    {c.nums.map(n=>{const isHot=stats?stats.getFreq(n)>=3:false;const isRit=stats?stats.getRit(n)>20:false;const col=isHot?C.orange:isRit?C.teal:ACCENT;return <Ball key={n} num={n} color={col} size={26}/>;})}
                  </div>
                  <div style={{display:"flex",gap:4,flexShrink:0,flexWrap:"wrap"}}>
                    <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:4,padding:"2px 7px",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Σ{c.sum}</span>
                    <span style={{background:"#12122a",color:C.dim,borderRadius:4,padding:"2px 7px",fontSize:9}}>{c.ev}P–{c.od}D</span>
                    {stats&&<span style={{background:"#12122a",color:C.teal,borderRadius:4,padding:"2px 7px",fontSize:9}}>f:{c.fq}</span>}
                    {stats&&<span style={{background:"#12122a",color:C.orange,borderRadius:4,padding:"2px 7px",fontSize:9}}>r:{c.ar}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {selected.size>0&&(
          <button onClick={()=>setPhase(3)} style={{width:"100%",padding:"12px",marginTop:10,background:`linear-gradient(135deg,${C.purple},${C.teal})`,color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"Georgia,serif"}}>
            ⭐ Scegli SuperStar per {selected.size} sestine
          </button>
        )}
      </div>
    )}

    {/* FASE 3 */}
    {phase>=3&&phase3Combos.length>0&&(
      <div>
        <div style={{background:C.card,border:`2px solid ${C.purple}44`,borderRadius:12,padding:16,marginBottom:14}}>
          <div style={{color:C.purple,fontWeight:700,fontSize:14,marginBottom:14}}>⭐ Fase 3 — Scegli il SuperStar</div>
          {phase3Combos.map((c,idx)=>{
            const k=c.nums.join(",");const top=draws.length>0?getSuperstarTop(c.nums,draws):[];const chosen=chosenSS[k];
            return(
              <div key={idx} style={{background:"#080816",border:`1px solid ${C.purple}33`,borderRadius:10,padding:12,marginBottom:12}}>
                <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                  <span style={{color:C.dim,fontSize:10}}>#{idx+1}</span>
                  {c.nums.map(n=>{const isHot=stats?stats.getFreq(n)>=3:false;const isRit=stats?stats.getRit(n)>20:false;const col=isHot?C.orange:isRit?C.teal:ACCENT;return <Ball key={n} num={n} color={col} size={28}/>;})}
                  <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700,fontFamily:"monospace"}}>Σ{c.sum}</span>
                </div>
                {top.length>0&&(
                  <>
                    <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Top 12 SuperStar per affinità:</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                      {top.map(t=>{
                        const isCho=chosen===t.ss;
                        return(
                          <div key={t.ss} onClick={()=>setChosenSS(prev=>({...prev,[k]:t.ss}))} style={{textAlign:"center",cursor:"pointer",padding:"5px 4px",background:isCho?"#FFD70018":"#0e0e1c",border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,borderRadius:8,boxShadow:isCho?"0 0 10px #FFD70044":"none"}}>
                            <Ball num={t.ss} size={28} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho}/>
                            <div style={{background:"#0a0a18",borderRadius:2,height:3,overflow:"hidden",margin:"3px 0 1px",width:28}}><div style={{background:isCho?"#FFD700":"#d97706",height:"100%",width:`${t.pct}%`}}/></div>
                            <div style={{color:isCho?"#FFD700":"#888",fontSize:9,fontWeight:isCho?700:400}}>{t.pct}%</div>
                            <div style={{color:C.dim,fontSize:8}}>r.{t.rit}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                <div style={{background:chosen?"#FFD70008":C.card,border:`1px solid ${chosen?"#FFD70033":C.border}`,borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{color:C.dim,fontSize:11}}>SuperStar:</span>
                  {chosen?(
                    <><Ball num={chosen} size={36} gold glow/><span style={{color:"#FFD700",fontWeight:700,fontSize:16,fontFamily:"monospace"}}>{chosen}</span><span style={{color:"#FFD700",fontSize:11}}>Affinità: {top.find(t=>t.ss===chosen)?.pct||0}%</span></>
                  ):(
                    <span style={{color:"#555",fontSize:11}}>Clicca un numero sopra</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {Object.values(chosenSS).length>0&&(
          <div style={{background:C.card,border:`1px solid ${ACCENT}33`,borderRadius:12,padding:16}}>
            <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:12}}>🎟 Riepilogo Biglietti</div>
            {phase3Combos.map((c,idx)=>{
              const k=c.nums.join(",");const ss=chosenSS[k];if(!ss)return null;
              return(
                <div key={idx} style={{display:"flex",gap:6,alignItems:"center",background:"#080816",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{color:C.dim,fontSize:10,minWidth:20}}>#{idx+1}</span>
                  <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{c.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={26}/>)}</div>
                  <span style={{color:C.dim,fontSize:14}}>│</span>
                  <Ball num={ss} size={28} gold glow/>
                  <span style={{color:"#FFD700",fontSize:9}}>SS</span>
                  <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700,fontFamily:"monospace",marginLeft:"auto"}}>Σ{c.sum}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

    <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:10,color:C.dim,padding:"14px 0"}}>
      <span><span style={{color:C.orange}}>●</span> Frequente (≥3x)</span>
      <span><span style={{color:C.teal}}>●</span> Ritardatario (&gt;20 estr.)</span>
      <span><span style={{color:ACCENT}}>●</span> Nella norma</span>
      <span>f=frequenza · r=ritardo medio</span>
    </div>
  </div>
  </div>
  );
}
