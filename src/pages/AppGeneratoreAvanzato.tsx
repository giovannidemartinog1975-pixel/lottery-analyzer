import React, { useState, useMemo, useCallback, useRef, useEffect, createContext, useContext } from "react";
import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════
// GENERATORE AVANZATO SESTINE — SuperEnalotto
// Flusso: Range Somma → Lista completa → Filtri → Selezione → SuperStar
// ═══════════════════════════════════════════════════════════════

const POOL = 90;
const PICK = 6;
const ACCENT = "#D4AF37";
const C = {
  bg:"#07070F", card:"#0D0D1A", border:"#1A1A2E",
  text:"#E0E0F0", dim:"#6A6A8A",
  orange:"#F07030", teal:"#2BA89A", red:"#C94040",
  purple:"#8A5CC4", green:"#4A9E5C", blue:"#4A8FD4",
};

const sm = (a: number[]) => a.reduce((s,v)=>s+v,0);

const DECINE = [
  {l:"1–9",  a:1,  b:9 },
  {l:"10–19",a:10, b:19},
  {l:"20–29",a:20, b:29},
  {l:"30–39",a:30, b:39},
  {l:"40–49",a:40, b:49},
  {l:"50–59",a:50, b:59},
  {l:"60–69",a:60, b:69},
  {l:"70–79",a:70, b:79},
  {l:"80–90",a:80, b:90},
];
const DC = ["#E8B84B","#F07030","#C94040","#8A5CC4","#4A8FD4","#2BA89A","#4A9E5C","#d97706","#E8B84B"];

interface Draw { nums: number[]; superstar?: number; }
interface Combo { nums: number[]; sum: number; ev: number; od: number; dc: number[]; fq: number; ar: number; }

// ── Componenti base ──────────────────────────────────────────
function Ball({ num, color=ACCENT, size=28, glow=false, gold=false }: { num:number|string, color?:string, size?:number, glow?:boolean, gold?:boolean }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background: gold
        ? "radial-gradient(circle at 35% 32%,#FFD700,#FF6B35)"
        : `radial-gradient(circle at 35% 32%,${color}99,${color}22)`,
      border: `2px solid ${gold?"#FFD700":color}`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize: size>38?14:size>28?11:9, fontWeight:900,
      color: gold?"#0a0a0a":"#fff", fontFamily:"monospace",
      boxShadow: glow ? `0 0 10px ${gold?"#FFD70088":`${color}66`}` : "none",
    }}>{num}</div>
  );
}

function KpiCard({ label, value, color=ACCENT, sub }: { label:string, value:string|number, color?:string, sub?:string }) {
  return (
    <div style={{background:C.card,border:`1px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
      <div style={{color:C.dim,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{label}</div>
      <div style={{color,fontSize:18,fontWeight:900,fontFamily:"monospace"}}>{value}</div>
      {sub && <div style={{color:C.dim,fontSize:9,marginTop:2}}>{sub}</div>}
    </div>
  );
}

// ── Calcolo statistiche sui dati storici ─────────────────────
function buildStats(draws: Draw[]) {
  const freq: Record<number,number> = {};
  const last: Record<number,number> = {};
  draws.forEach((d,i) => d.nums.forEach(n => { freq[n]=(freq[n]||0)+1; last[n]=i; }));
  const total = draws.length;
  const getRit = (n:number) => total - 1 - (last[n]??-1);
  const getFreq = (n:number) => freq[n]||0;
  return { freq, last, total, getRit, getFreq };
}

// ── Generazione combinazioni (Web Worker simulato con chunking) ──
function generateCombinations(
  lo: number, hi: number,
  onProgress: (found:number, pct:number) => void,
  onDone: (combs: number[][]) => void
) {
  const result: number[][] = [];
  let i1 = 1;
  const CHUNK = 2; // numeri di primo elemento per chunk

  function processChunk() {
    const end = Math.min(i1 + CHUNK, POOL - PICK + 2);
    for (; i1 < end; i1++) {
      const a = i1;
      for (let b = a+1; b <= POOL-4; b++) {
        const ab = a+b;
        if (ab + (b+1)+(b+2)+(b+3)+(b+4) > hi) break;
        for (let c = b+1; c <= POOL-3; c++) {
          const abc = ab+c;
          if (abc + (c+1)+(c+2)+(c+3) > hi) break;
          for (let d = c+1; d <= POOL-2; d++) {
            const abcd = abc+d;
            if (abcd + (d+1)+(d+2) > hi) break;
            for (let e = d+1; e <= POOL-1; e++) {
              const abcde = abcd+e;
              if (abcde + (e+1) > hi) break;
              const fMin = Math.max(e+1, lo - abcde);
              const fMax = Math.min(POOL, hi - abcde);
              for (let f = fMin; f <= fMax; f++) {
                result.push([a,b,c,d,e,f]);
              }
            }
          }
        }
      }
    }
    const pct = Math.round((i1-1)/(POOL-PICK+1)*100);
    onProgress(result.length, pct);
    if (i1 <= POOL - PICK + 1) {
      setTimeout(processChunk, 0);
    } else {
      onDone(result);
    }
  }
  setTimeout(processChunk, 0);
}

// ── SuperStar affinità ────────────────────────────────────────
function getSuperstarTop(nums: number[], draws: Draw[], n=12): Array<{ss:number,pct:number,rit:number}> {
  const ts = sm(nums);
  const total = draws.length;
  const scores = Array.from({length:90},(_,i)=>i+1).map(ss => {
    const f = draws.filter(d=>d.superstar===ss).length;
    const sim = draws.filter(d=>Math.abs(sm(d.nums)-ts)<=30);
    const co = sim.length>0 ? sim.filter(d=>d.superstar===ss).length/sim.length : f/total;
    let last=-1; for(let i=total-1;i>=0;i--){if(draws[i].superstar===ss){last=i;break;}}
    const rit = last===-1?total:total-1-last;
    const score = (f/total)*0.4 + co*0.35 + Math.min(rit/total,1)*0.25;
    return {ss, score, rit};
  });
  const maxSc = Math.max(...scores.map(s=>s.score));
  return scores.sort((a,b)=>b.score-a.score).slice(0,n).map(s=>({ss:s.ss,pct:Math.round(s.score/maxSc*100),rit:s.rit}));
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ══════════════════════════════════════════════════════════════
export default function AppGeneratoreAvanzato() {
  // Dati storici da Supabase
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loadingDraws, setLoadingDraws] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from("superenalotto").select("*").order("data",{ascending:true});
        if (data) {
          setDraws(data.map((r:any) => ({
            nums: [r.n1,r.n2,r.n3,r.n4,r.n5,r.n6].filter(Boolean).sort((a:number,b:number)=>a-b),
            superstar: r.superstar||undefined,
          })));
        }
      } catch(e) { console.error(e); }
      setLoadingDraws(false);
    }
    load();
  }, []);

  const stats = useMemo(() => draws.length > 0 ? buildStats(draws) : null, [draws]);

  // Fase 1 — Range somma
  const [minSum, setMinSum] = useState(258);
  const [maxSum, setMaxSum] = useState(262);
  const [phase, setPhase] = useState<1|2|3>(1);

  // Fase 2 — Generazione + filtri
  const [allCombs, setAllCombs] = useState<number[][]>([]);
  const [generating, setGenerating] = useState(false);
  const [genPct, setGenPct] = useState(0);
  const [genFound, setGenFound] = useState(0);
  const [genMs, setGenMs] = useState(0);

  // Filtri
  const [fParity, setFParity] = useState("any");
  const [fDec, setFDec] = useState<Map<number,number>>(new Map());
  const [fMinFreq, setFMinFreq] = useState(0);
  const [fMaxRit, setFMaxRit] = useState(0);
  const [fSort, setFSort] = useState<"sum"|"freq"|"rit">("sum");

  // Fase 3 — Selezione e SuperStar
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chosenSS, setChosenSS] = useState<Record<string,number>>({});

  const genRef = useRef<number>(0);

  const quickRanges = [
    {l:"258–262", lo:258, hi:262},
    {l:"255–265", lo:255, hi:265},
    {l:"250–270", lo:250, hi:270},
    {l:"240–280", lo:240, hi:280},
    {l:"±0.5σ",   lo:216, hi:339},
    {l:"200–300", lo:200, hi:300},
  ];

  const genera = useCallback(() => {
    if (maxSum < minSum) return;
    const t0 = Date.now();
    setGenerating(true);
    setGenPct(0);
    setGenFound(0);
    setAllCombs([]);
    setSelected(new Set());
    setChosenSS({});
    genRef.current++;
    const myGen = genRef.current;

    generateCombinations(
      minSum, maxSum,
      (found, pct) => {
        if (genRef.current !== myGen) return;
        setGenFound(found);
        setGenPct(pct);
      },
      (combs) => {
        if (genRef.current !== myGen) return;
        setAllCombs(combs);
        setGenerating(false);
        setGenMs(Date.now()-t0);
        setPhase(2);
      }
    );
  }, [minSum, maxSum]);

  // Arricchisce combinazioni
  const enriched = useMemo((): Combo[] => {
    if (!stats) return allCombs.map(nums=>({
      nums, sum:sm(nums),
      ev:nums.filter(n=>n%2===0).length,
      od:nums.filter(n=>n%2!==0).length,
      dc:DECINE.map(d=>nums.filter(n=>n>=d.a&&n<=d.b).length),
      fq:0, ar:0,
    }));
    return allCombs.map(nums=>({
      nums, sum:sm(nums),
      ev:nums.filter(n=>n%2===0).length,
      od:nums.filter(n=>n%2!==0).length,
      dc:DECINE.map(d=>nums.filter(n=>n>=d.a&&n<=d.b).length),
      fq:nums.reduce((s,n)=>s+stats.getFreq(n),0),
      ar:nums.reduce((s,n)=>s+stats.getRit(n),0)/PICK,
    }));
  }, [allCombs, stats]);

  // Filtri progressivi
  const filtered = useMemo((): Combo[] => {
    let res = enriched.filter(c => {
      if (fParity !== "any") {
        const [re,ro] = fParity.split("-").map(Number);
        if (c.ev !== re || c.od !== ro) return false;
      }
      if (fDec.size > 0) {
        for (const [idx,cnt] of fDec) {
          if (c.dc[idx] !== cnt) return false;
        }
      }
      if (fMinFreq > 0 && stats) {
        const hot = c.nums.filter(n=>stats.getFreq(n)>=3).length;
        if (hot < fMinFreq) return false;
      }
      if (fMaxRit > 0 && c.ar > fMaxRit) return false;
      return true;
    });
    if (fSort==="sum") res.sort((a,b)=>a.sum-b.sum);
    else if (fSort==="freq") res.sort((a,b)=>b.fq-a.fq);
    else if (fSort==="rit") res.sort((a,b)=>a.ar-b.ar);
    return res;
  }, [enriched, fParity, fDec, fMinFreq, fMaxRit, fSort, stats]);

  const toggleSelect = (key:string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < 10) next.add(key);
      return next;
    });
  };

  const toggleDec = (idx:number, delta:number) => {
    setFDec(prev => {
      const next = new Map(prev);
      const cur = next.get(idx)||0;
      const nv = Math.max(0, Math.min(cur+delta, PICK));
      if (nv===0) next.delete(idx); else next.set(idx,nv);
      return next;
    });
  };

  const selectedCombos = useMemo(() =>
    filtered.filter(c => selected.has(c.nums.join(","))),
  [filtered, selected]);

  const phase3Combos = useMemo(() => {
    // Cerca in filtered, se non trova cerca in enriched
    return [...selected].map(k => {
      const f = filtered.find(c=>c.nums.join(",")===k);
      return f || enriched.find(c=>c.nums.join(",")===k)!;
    }).filter(Boolean);
  }, [selected, filtered, enriched]);

  // ── Rendering ────────────────────────────────────────────────
  if (loadingDraws) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{color:ACCENT,fontSize:28}}>🎯</div>
      <div style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:18}}>Caricamento dati storici...</div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Courier New',monospace",color:C.text,paddingBottom:80}}>
      <div style={{maxWidth:820,margin:"0 auto",padding:"0 12px"}}>

        {/* HEADER */}
        <div style={{textAlign:"center",padding:"20px 0 14px"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{fontSize:26}}>🎯</span>
            <h1 style={{color:ACCENT,fontFamily:"Georgia,serif",fontSize:22,margin:0}}>Generatore Avanzato</h1>
            <span style={{background:`${ACCENT}22`,border:`1px solid ${ACCENT}44`,borderRadius:20,padding:"2px 10px",color:ACCENT,fontSize:10,fontWeight:700}}>SuperEnalotto</span>
          </div>
          <div style={{color:C.dim,fontSize:11,marginBottom:14}}>
            Flusso: Range Somma → Lista Completa → Filtri → Selezione → SuperStar
          </div>
          {/* Breadcrumb */}
          <div style={{display:"flex",justifyContent:"center",gap:6,flexWrap:"wrap"}}>
            {[{n:1,l:"Range Somma"},{n:2,l:"Filtri & Lista"},{n:3,l:"SuperStar"}].map(f=>(
              <React.Fragment key={f.n}>
                <div style={{
                  background: phase===f.n?`linear-gradient(135deg,${ACCENT},${C.teal})`:phase>f.n?`${C.green}33`:`${C.border}`,
                  color: phase===f.n?"#000":phase>f.n?C.green:C.dim,
                  borderRadius:20,padding:"4px 14px",fontSize:10,fontWeight:phase===f.n?700:400,
                  border:`1px solid ${phase===f.n?ACCENT:phase>f.n?C.green:C.border}`,
                }}>
                  {phase>f.n?"✓ ":""}{f.n}. {f.l}
                </div>
                {f.n<3&&<span style={{color:C.dim,alignSelf:"center",fontSize:12}}>→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* KPI dati storici */}
        {stats&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:14}}>
            <KpiCard label="Estrazioni" value={draws.length} sub="da Supabase"/>
            <KpiCard label="μ reale" value={(draws.reduce((s,d)=>s+sm(d.nums),0)/draws.length).toFixed(1)} color={C.orange}/>
            <KpiCard label="Pool" value={`1–${POOL}`} color={C.teal}/>
            <KpiCard label="Pick" value={PICK} color={C.purple}/>
          </div>
        )}

        {/* ═══ FASE 1 — RANGE SOMMA ═══ */}
        <div style={{background:C.card,border:`1px solid ${phase===1?`${ACCENT}66`:C.border}`,borderRadius:12,padding:16,marginBottom:14}}>
          <div style={{color:ACCENT,fontWeight:700,fontSize:14,marginBottom:12}}>📊 Fase 1 — Range di Somma</div>

          {/* Quick ranges */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
            {quickRanges.map(r=>(
              <button key={r.l} onClick={()=>{setMinSum(r.lo);setMaxSum(r.hi);}} style={{
                background:minSum===r.lo&&maxSum===r.hi?`${ACCENT}22`:"#080816",
                color:minSum===r.lo&&maxSum===r.hi?ACCENT:C.dim,
                border:`1px solid ${minSum===r.lo&&maxSum===r.hi?ACCENT:C.border}`,
                borderRadius:8,padding:"6px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit",textAlign:"center",
              }}>
                <div style={{fontWeight:700}}>{r.l}</div>
                <div style={{fontSize:9,color:C.teal}}>Δ={r.hi-r.lo}</div>
              </button>
            ))}
          </div>

          {/* Input somme */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            {[{l:"Somma Minima",v:minSum,set:setMinSum},{l:"Somma Massima",v:maxSum,set:setMaxSum}].map(f=>(
              <div key={f.l}>
                <div style={{color:C.dim,fontSize:11,marginBottom:5}}>{f.l}</div>
                <input type="range" min={21} max={534} value={f.v}
                  onChange={e=>f.set(+e.target.value)}
                  style={{width:"100%",accentColor:ACCENT,marginBottom:4}}/>
                <input type="number" min={21} max={534} value={f.v}
                  onChange={e=>f.set(Math.max(21,Math.min(534,+e.target.value)))}
                  style={{width:"100%",background:"#080816",color:ACCENT,border:`1px solid ${ACCENT}55`,borderRadius:8,padding:"8px",fontSize:18,fontFamily:"monospace",fontWeight:700,outline:"none",textAlign:"center"}}/>
              </div>
            ))}
          </div>

          {/* Info range */}
          <div style={{
            background:"#080816",borderRadius:8,padding:"8px 12px",marginBottom:12,
            display:"flex",gap:10,flexWrap:"wrap",fontSize:11,alignItems:"center",
            border:`1px solid ${maxSum-minSum>60?C.orange:C.border}`,
          }}>
            <span style={{color:C.dim}}>Range:</span>
            <span style={{color:C.teal,fontFamily:"monospace",fontWeight:700,fontSize:14}}>{minSum}</span>
            <span style={{color:C.dim}}>──</span>
            <span style={{color:C.orange,fontFamily:"monospace",fontWeight:700,fontSize:14}}>{maxSum}</span>
            <span style={{color:C.dim}}>|</span>
            <span style={{color:ACCENT}}>Δ = {maxSum-minSum}</span>
            {maxSum-minSum>80&&<span style={{color:C.red,fontSize:10}}>⚠️ Range molto ampio — generazione lenta</span>}
            {maxSum-minSum>40&&maxSum-minSum<=80&&<span style={{color:C.orange,fontSize:10}}>⚡ Range ampio — potrebbero volerci alcuni secondi</span>}
            {maxSum<minSum&&<span style={{color:C.red}}>⚠️ Max deve essere ≥ Min</span>}
          </div>

          {/* Progress bar */}
          {generating&&(
            <div style={{marginBottom:12}}>
              <div style={{background:"#0a0a18",borderRadius:4,height:8,overflow:"hidden",marginBottom:4}}>
                <div style={{background:`linear-gradient(90deg,${ACCENT},${C.teal})`,height:"100%",width:`${genPct}%`,transition:"width 0.1s"}}/>
              </div>
              <div style={{color:C.dim,fontSize:11,textAlign:"center"}}>
                {genPct}% — {genFound.toLocaleString("it-IT")} sestine trovate...
              </div>
            </div>
          )}

          <button onClick={genera} disabled={generating||maxSum<minSum} style={{
            width:"100%",padding:"14px",
            background:generating?"#1a1a2e":`linear-gradient(135deg,${ACCENT},${C.teal})`,
            color:generating?"#555":"#000",border:"none",borderRadius:10,
            fontSize:16,fontWeight:900,cursor:generating?"not-allowed":"pointer",fontFamily:"Georgia,serif",
          }}>
            {generating?`⏳ Generazione... ${genPct}%`:"⚡ GENERA TUTTE LE SESTINE"}
          </button>
        </div>

        {/* ═══ FASE 2 — FILTRI + LISTA ═══ */}
        {phase>=2&&(
          <>
            {/* Stats */}
            <div style={{background:`${ACCENT}08`,border:`1px solid ${ACCENT}33`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{color:ACCENT,fontWeight:700,fontSize:14}}>✅ {allCombs.length.toLocaleString("it-IT")} sestine</span>
              <span style={{color:C.teal,fontSize:11}}>in {genMs}ms</span>
              <span style={{color:C.dim}}>|</span>
              <span style={{color:filtered.length<allCombs.length?C.orange:C.green,fontWeight:700,fontSize:14}}>
                {filtered.length.toLocaleString("it-IT")} dopo filtri
              </span>
              {selected.size>0&&<span style={{color:C.purple,fontWeight:700}}>| {selected.size} selezionate</span>}
            </div>

            {/* Filtri */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:14}}>
              <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:12}}>🔧 Filtri Progressivi</div>

              {/* Pari/Dispari */}
              <div style={{marginBottom:12}}>
                <div style={{color:C.dim,fontSize:11,marginBottom:5}}>☯️ Pari / Dispari</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {["any","3-3","4-2","2-4","5-1","1-5","6-0","0-6"].map(v=>{
                    const l=v==="any"?"Qualsiasi":v.replace("-","P–")+"D";
                    return(
                      <button key={v} onClick={()=>setFParity(v)} style={{
                        background:fParity===v?`${ACCENT}22`:"transparent",color:fParity===v?ACCENT:C.dim,
                        border:`1px solid ${fParity===v?ACCENT:C.border}`,borderRadius:8,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit",
                      }}>{l}</button>
                    );
                  })}
                </div>
              </div>

              {/* Decine */}
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{color:C.dim,fontSize:11}}>🔢 Decine (quanti numeri per decina)</span>
                  <button onClick={()=>setFDec(new Map())} style={{background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:5,padding:"2px 8px",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>Reset</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(70px,1fr))",gap:4}}>
                  {DECINE.map((d,i)=>{
                    const cnt = fDec.get(i)||0;
                    return(
                      <div key={d.l} style={{
                        background:cnt>0?`${DC[i]}18`:"#080816",
                        border:`2px solid ${cnt>0?DC[i]:C.border}`,
                        borderRadius:8,padding:"5px 3px",textAlign:"center",
                      }}>
                        <div style={{color:DC[i],fontSize:8,fontWeight:700}}>{d.l}</div>
                        <div style={{color:cnt>0?DC[i]:"#555",fontSize:14,fontWeight:900,fontFamily:"monospace",minHeight:18}}>{cnt>0?cnt:"–"}</div>
                        <div style={{display:"flex",gap:2,justifyContent:"center"}}>
                          <button onClick={()=>toggleDec(i,-1)} style={{width:20,height:20,borderRadius:3,background:cnt>0?"#1a0606":"#1a1a2e",color:cnt>0?C.red:"#444",border:`1px solid ${cnt>0?C.red:"#444"}`,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                          <button onClick={()=>toggleDec(i,1)} style={{width:20,height:20,borderRadius:3,background:`${DC[i]}22`,color:DC[i],border:`1px solid ${DC[i]}`,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Frequenti + Ritardo + Ordina */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
                {stats&&(
                  <div>
                    <div style={{color:C.dim,fontSize:11,marginBottom:5}}>🔥 Min numeri frequenti (≥3x)</div>
                    <div style={{display:"flex",gap:4}}>
                      {[0,1,2,3,4].map(n=>(
                        <button key={n} onClick={()=>setFMinFreq(n)} style={{
                          flex:1,background:fMinFreq===n?`${C.orange}22`:"transparent",color:fMinFreq===n?C.orange:C.dim,
                          border:`1px solid ${fMinFreq===n?C.orange:C.border}`,borderRadius:6,padding:"5px 2px",fontSize:10,cursor:"pointer",fontFamily:"inherit",
                        }}>{n===0?"—":`${n}+`}</button>
                      ))}
                    </div>
                  </div>
                )}
                {stats&&(
                  <div>
                    <div style={{color:C.dim,fontSize:11,marginBottom:5}}>❄️ Max ritardo medio</div>
                    <div style={{display:"flex",gap:4}}>
                      {[{v:0,l:"—"},{v:20,l:"≤20"},{v:30,l:"≤30"},{v:50,l:"≤50"},{v:70,l:"≤70"}].map(x=>(
                        <button key={x.v} onClick={()=>setFMaxRit(x.v)} style={{
                          flex:1,background:fMaxRit===x.v?`${C.teal}22`:"transparent",color:fMaxRit===x.v?C.teal:C.dim,
                          border:`1px solid ${fMaxRit===x.v?C.teal:C.border}`,borderRadius:6,padding:"5px 2px",fontSize:10,cursor:"pointer",fontFamily:"inherit",
                        }}>{x.l}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{color:C.dim,fontSize:11,marginBottom:5}}>↕️ Ordina per</div>
                  <div style={{display:"flex",gap:4}}>
                    {[{v:"sum",l:"Somma"},{v:"freq",l:"Freq"},{v:"rit",l:"Ritardo"}].map(x=>(
                      <button key={x.v} onClick={()=>setFSort(x.v as any)} style={{
                        flex:1,background:fSort===x.v?`${ACCENT}22`:"transparent",color:fSort===x.v?ACCENT:C.dim,
                        border:`1px solid ${fSort===x.v?ACCENT:C.border}`,borderRadius:6,padding:"5px 2px",fontSize:10,cursor:"pointer",fontFamily:"inherit",
                      }}>{x.l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Lista sestine */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
                <div style={{color:ACCENT,fontWeight:700,fontSize:13}}>
                  {filtered.length.toLocaleString("it-IT")} sestine
                  {filtered.length<allCombs.length&&<span style={{color:C.dim,fontWeight:400,fontSize:11}}> / {allCombs.length.toLocaleString("it-IT")}</span>}
                </div>
                {selected.size>0&&(
                  <button onClick={()=>setPhase(3)} style={{
                    background:`linear-gradient(135deg,${C.purple},${C.teal})`,color:"#fff",
                    border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  }}>⭐ Scegli SuperStar ({selected.size})</button>
                )}
              </div>

              <div style={{color:C.dim,fontSize:10,marginBottom:8}}>
                Clicca per selezionare (max 10) · 🟠 = frequente · 🔵 = ritardatario
              </div>

              {filtered.length===0?(
                <div style={{textAlign:"center",color:C.dim,padding:"30px 0"}}>Nessuna sestina corrisponde ai filtri. Allarga i criteri.</div>
              ):(
                <div style={{maxHeight:480,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                  {filtered.slice(0,500).map((c,i)=>{
                    const k = c.nums.join(",");
                    const isSel = selected.has(k);
                    return(
                      <div key={i} onClick={()=>toggleSelect(k)} style={{
                        background:isSel?`${ACCENT}12`:"#080816",
                        border:`2px solid ${isSel?ACCENT:C.border}`,
                        borderRadius:8,padding:"7px 10px",cursor:"pointer",
                        display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",
                      }}>
                        {/* checkbox */}
                        <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${isSel?ACCENT:C.dim}`,background:isSel?ACCENT:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#000",fontWeight:900,flexShrink:0}}>
                          {isSel?"✓":""}
                        </div>
                        {/* balls */}
                        <div style={{display:"flex",gap:3,flex:1,flexWrap:"wrap"}}>
                          {c.nums.map(n=>{
                            const isHot=stats?stats.getFreq(n)>=3:false;
                            const isRit=stats?stats.getRit(n)>20:false;
                            const col=isHot?C.orange:isRit?C.teal:ACCENT;
                            return <Ball key={n} num={n} color={col} size={26}/>;
                          })}
                        </div>
                        {/* stats */}
                        <div style={{display:"flex",gap:4,flexShrink:0,flexWrap:"wrap"}}>
                          <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:4,padding:"2px 7px",fontSize:10,fontFamily:"monospace",fontWeight:700}}>Σ{c.sum}</span>
                          <span style={{background:"#12122a",color:C.dim,borderRadius:4,padding:"2px 7px",fontSize:9}}>{c.ev}P–{c.od}D</span>
                          {stats&&<span style={{background:"#12122a",color:C.teal,borderRadius:4,padding:"2px 7px",fontSize:9}}>f:{c.fq}</span>}
                          {stats&&<span style={{background:"#12122a",color:C.orange,borderRadius:4,padding:"2px 7px",fontSize:9}}>r:{Math.round(c.ar)}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length>500&&(
                    <div style={{textAlign:"center",color:C.dim,padding:"10px",fontSize:11}}>
                      ... e altre {(filtered.length-500).toLocaleString("it-IT")} sestine. Usa i filtri per ridurre.
                    </div>
                  )}
                </div>
              )}
            </div>

            {selected.size>0&&(
              <button onClick={()=>{setPhase(3);}} style={{
                width:"100%",padding:"14px",
                background:`linear-gradient(135deg,${C.purple},${C.teal})`,
                color:"#fff",border:"none",borderRadius:10,fontSize:16,fontWeight:900,
                cursor:"pointer",fontFamily:"Georgia,serif",marginBottom:14,
              }}>
                ⭐ Procedi alla scelta SuperStar ({selected.size} sestine)
              </button>
            )}
          </>
        )}

        {/* ═══ FASE 3 — SUPERSTAR ═══ */}
        {phase>=3&&phase3Combos.length>0&&(
          <div>
            <div style={{background:C.card,border:`2px solid ${C.purple}44`,borderRadius:12,padding:16,marginBottom:14}}>
              <div style={{color:C.purple,fontWeight:700,fontSize:14,marginBottom:14}}>⭐ Fase 3 — Scegli il SuperStar</div>

              {phase3Combos.map((c,idx)=>{
                if (!c) return null;
                const k = c.nums.join(",");
                const top = draws.length>0 ? getSuperstarTop(c.nums, draws) : [];
                const chosen = chosenSS[k];

                return(
                  <div key={idx} style={{background:"#080816",border:`1px solid ${C.purple}33`,borderRadius:10,padding:12,marginBottom:12}}>
                    {/* Sestina */}
                    <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                      <span style={{color:C.dim,fontSize:10}}>#{idx+1}</span>
                      {c.nums.map(n=>{
                        const isHot=stats?stats.getFreq(n)>=3:false;
                        const isRit=stats?stats.getRit(n)>20:false;
                        const col=isHot?C.orange:isRit?C.teal:ACCENT;
                        return <Ball key={n} num={n} color={col} size={28}/>;
                      })}
                      <span style={{background:`${ACCENT}22`,color:ACCENT,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700,fontFamily:"monospace"}}>Σ{c.sum}</span>
                    </div>

                    {/* Top 12 SuperStar */}
                    {top.length>0?(
                      <>
                        <div style={{color:C.dim,fontSize:10,marginBottom:6}}>Top 12 SuperStar per affinità con questa sestina:</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                          {top.map(t=>{
                            const isCho = chosen===t.ss;
                            return(
                              <div key={t.ss} onClick={()=>setChosenSS(prev=>({...prev,[k]:t.ss}))} style={{
                                textAlign:"center",cursor:"pointer",padding:"5px 4px",
                                background:isCho?"#FFD70018":"#0e0e1c",
                                border:`2px solid ${isCho?"#FFD700":"#2a2a3a"}`,
                                borderRadius:8,
                                boxShadow:isCho?"0 0 10px #FFD70044":"none",
                              }}>
                                <Ball num={t.ss} size={28} gold={isCho} color={isCho?"#FFD700":"#888"} glow={isCho}/>
                                <div style={{background:"#0a0a18",borderRadius:2,height:3,overflow:"hidden",margin:"3px 0 1px",width:28}}>
                                  <div style={{background:isCho?"#FFD700":"#d97706",height:"100%",width:`${t.pct}%`}}/>
                                </div>
                                <div style={{color:isCho?"#FFD700":"#888",fontSize:9,fontWeight:isCho?700:400}}>{t.pct}%</div>
                                <div style={{color:C.dim,fontSize:8}}>r.{t.rit}</div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ):(
                      <div style={{color:C.dim,fontSize:11,marginBottom:10}}>Nessun dato storico per il SuperStar.</div>
                    )}

                    {/* Scelta attuale */}
                    <div style={{
                      background:chosen?"#FFD70008":C.card,
                      border:`1px solid ${chosen?"#FFD70033":C.border}`,
                      borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",
                    }}>
                      <span style={{color:C.dim,fontSize:11}}>SuperStar:</span>
                      {chosen?(
                        <>
                          <Ball num={chosen} size={36} gold glow/>
                          <span style={{color:"#FFD700",fontWeight:700,fontSize:16,fontFamily:"monospace"}}>{chosen}</span>
                          <span style={{color:"#FFD700",fontSize:11}}>Affinità: {top.find(t=>t.ss===chosen)?.pct||0}%</span>
                        </>
                      ):(
                        <span style={{color:"#555",fontSize:11}}>Clicca un numero sopra</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Riepilogo finale */}
            {Object.values(chosenSS).length>0&&(
              <div style={{background:C.card,border:`1px solid ${ACCENT}33`,borderRadius:12,padding:16}}>
                <div style={{color:ACCENT,fontWeight:700,fontSize:13,marginBottom:12}}>🎟 Riepilogo Biglietti</div>
                {phase3Combos.map((c,idx)=>{
                  if (!c) return null;
                  const k = c.nums.join(",");
                  const ss = chosenSS[k];
                  if (!ss) return null;
                  return(
                    <div key={idx} style={{display:"flex",gap:6,alignItems:"center",background:"#080816",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{color:C.dim,fontSize:10,minWidth:20}}>#{idx+1}</span>
                      <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                        {c.nums.map(n=><Ball key={n} num={n} color={ACCENT} size={26}/>)}
                      </div>
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

        {/* Legenda */}
        <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:10,color:C.dim,padding:"14px 0"}}>
          <span><span style={{color:C.orange}}>●</span> Numero frequente (≥3x ultimi {draws.length} conc.)</span>
          <span><span style={{color:C.teal}}>●</span> Numero ritardatario (&gt;20 estr.)</span>
          <span><span style={{color:ACCENT}}>●</span> Nella norma</span>
          <span>f:frequenza totale · r:ritardo medio</span>
        </div>
      </div>
    </div>
  );
}
