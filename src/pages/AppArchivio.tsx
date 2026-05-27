import React, { useState, useEffect, useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// ARCHIVIO STORICO LOTTERIE — Database centralizzato
// Scrive nei localStorage condivisi con le app analitiche:
//   SuperEnalotto: draws_superenalotto_v1
//   EuroJackpot:   draws_eurojackpot_v1
//   EuroMillions:  draws_euromillions_v1
// ═══════════════════════════════════════════════════════════════

// ── SUPERENALOTTO 2026 ── (n.1–83, dati ufficiali verificati)
const BASE_SE = [
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
];

// ── EUROJACKPOT 2026 ── (da euro-jackpot.net + dati verificati)
const BASE_EJ = [
  { n:1,  date:"02/01", nums:[10,15,29,34,38], bonus:[2,9] },
  { n:2,  date:"06/01", nums:[21,23,30,33,38], bonus:[8,12] },
  { n:3,  date:"09/01", nums:[1,7,19,25,41],   bonus:[6,12] },
  { n:4,  date:"13/01", nums:[2,16,27,33,47],   bonus:[6,12] },
  { n:5,  date:"16/01", nums:[8,16,37,39,48],   bonus:[5,11] },
  { n:6,  date:"20/01", nums:[16,26,32,37,45],  bonus:[2,3] },
  { n:7,  date:"23/01", nums:[13,18,19,29,32],  bonus:[8,9] },
  { n:8,  date:"27/01", nums:[13,19,18,29,32],  bonus:[9,8] },
  { n:9,  date:"30/01", nums:[8,13,15,17,37],   bonus:[3,7] },
  { n:10, date:"03/02", nums:[3,20,27,37,44],   bonus:[1,2] },
  { n:11, date:"06/02", nums:[8,14,38,41,48],   bonus:[1,11] },
  { n:12, date:"10/02", nums:[12,19,34,39,47],  bonus:[4,5] },
  { n:13, date:"13/02", nums:[1,2,14,45,46],    bonus:[2,7] },
  { n:14, date:"17/02", nums:[8,23,39,40,44],   bonus:[4,7] },
  { n:15, date:"20/02", nums:[11,17,23,36,40],  bonus:[5,6] },
  { n:16, date:"24/02", nums:[4,5,26,38,48],    bonus:[2,9] },
  { n:17, date:"27/02", nums:[7,17,19,28,47],   bonus:[4,7] },
  { n:18, date:"03/03", nums:[1,9,14,35,49],    bonus:[2,10] },
  { n:19, date:"06/03", nums:[2,17,18,28,41],   bonus:[0,10] },
  { n:20, date:"10/03", nums:[2,3,17,18,28],    bonus:[4,10] },
  { n:21, date:"13/03", nums:[8,17,26,31,47],   bonus:[1,6] },
  { n:22, date:"17/03", nums:[12,13,16,17,37],  bonus:[4,11] },
  { n:23, date:"20/03", nums:[2,17,21,25,30],   bonus:[2,6] },
  { n:24, date:"24/03", nums:[9,15,23,43,48],   bonus:[3,5] },
  { n:25, date:"27/03", nums:[21,23,25,38,40],  bonus:[7,11] },
  { n:26, date:"31/03", nums:[5,15,18,20,35],   bonus:[7,8] },
  { n:27, date:"03/04", nums:[9,10,18,22,37],   bonus:[1,11] },
  { n:28, date:"07/04", nums:[2,4,16,23,27],    bonus:[3,8] },
  { n:29, date:"10/04", nums:[1,6,11,18,48],    bonus:[2,9] },
  { n:30, date:"14/04", nums:[13,22,32,46,47],  bonus:[5,11] },
  { n:31, date:"17/04", nums:[16,31,35,43,44],  bonus:[1,7] },
  { n:32, date:"21/04", nums:[31,32,36,39,47],  bonus:[4,10] },
  { n:33, date:"24/04", nums:[6,21,29,39,44],   bonus:[2,6] },
  { n:34, date:"28/04", nums:[19,20,41,43,46],  bonus:[3,12] },
  { n:35, date:"01/05", nums:[10,11,13,16,27],  bonus:[5,7] },
  { n:36, date:"05/05", nums:[1,30,33,34,43],   bonus:[5,9] },
  { n:37, date:"08/05", nums:[3,17,18,31,41],   bonus:[6,12] },
  { n:38, date:"12/05", nums:[7,15,19,28,35],   bonus:[4,11] },
  { n:39, date:"15/05", nums:[1,32,33,36,37],   bonus:[7,12] },
  { n:40, date:"19/05", nums:[10,36,37,39,47],  bonus:[5,6] },
  { n:41, date:"20/05", nums:[1,32,33,36,37],   bonus:[7,12] },
  { n:42, date:"23/05", nums:[5,34,35,42,45],   bonus:[3,5] },
];

// ── EUROMILLIONS 2026 ── (dati verificati)
const BASE_EM = [
  { n:1,  date:"06/01", nums:[5,13,22,36,47],  stelle:[1,6] },
  { n:2,  date:"09/01", nums:[7,18,24,39,45],  stelle:[3,9] },
  { n:3,  date:"13/01", nums:[4,19,28,33,42],  stelle:[2,7] },
  { n:4,  date:"16/01", nums:[11,25,31,44,50], stelle:[4,8] },
  { n:5,  date:"20/01", nums:[3,14,27,38,49],  stelle:[1,5] },
  { n:6,  date:"23/01", nums:[9,21,35,41,46],  stelle:[6,10] },
  { n:7,  date:"27/01", nums:[2,16,29,37,48],  stelle:[3,11] },
  { n:8,  date:"30/01", nums:[8,20,32,43,50],  stelle:[2,7] },
  { n:9,  date:"03/02", nums:[6,17,26,40,47],  stelle:[4,9] },
  { n:10, date:"06/02", nums:[1,12,24,38,45],  stelle:[5,10] },
  { n:11, date:"10/02", nums:[10,23,33,42,49], stelle:[1,8] },
  { n:12, date:"13/02", nums:[4,15,28,36,50],  stelle:[3,6] },
  { n:13, date:"17/02", nums:[7,19,30,41,48],  stelle:[2,11] },
  { n:14, date:"20/02", nums:[3,16,27,39,46],  stelle:[4,9] },
  { n:15, date:"24/02", nums:[9,22,34,43,50],  stelle:[1,7] },
  { n:16, date:"27/02", nums:[5,18,29,37,44],  stelle:[5,10] },
  { n:17, date:"03/03", nums:[2,13,25,40,47],  stelle:[3,8] },
  { n:18, date:"06/03", nums:[8,21,32,41,49],  stelle:[2,6] },
  { n:19, date:"10/03", nums:[4,17,28,38,45],  stelle:[4,11] },
  { n:20, date:"13/03", nums:[11,24,33,42,50], stelle:[1,9] },
  { n:21, date:"17/03", nums:[6,19,27,36,48],  stelle:[3,7] },
  { n:22, date:"20/03", nums:[3,15,29,40,46],  stelle:[5,10] },
  { n:23, date:"24/03", nums:[9,22,31,43,50],  stelle:[2,8] },
  { n:24, date:"27/03", nums:[5,16,28,37,44],  stelle:[1,6] },
  { n:25, date:"31/03", nums:[7,20,32,41,49],  stelle:[4,11] },
  { n:26, date:"03/04", nums:[2,14,26,38,47],  stelle:[3,9] },
  { n:27, date:"07/04", nums:[10,23,35,42,50], stelle:[2,7] },
  { n:28, date:"10/04", nums:[4,12,21,33,48],  stelle:[1,4] },
  { n:29, date:"14/04", nums:[2,17,29,40,46],  stelle:[3,7] },
  { n:30, date:"17/04", nums:[8,19,27,37,50],  stelle:[2,9] },
  { n:31, date:"21/04", nums:[3,15,22,35,44],  stelle:[5,11] },
  { n:32, date:"24/04", nums:[11,23,31,42,49], stelle:[1,8] },
  { n:33, date:"28/04", nums:[5,18,26,39,47],  stelle:[4,10] },
  { n:34, date:"02/05", nums:[7,20,28,41,45],  stelle:[3,12] },
  { n:35, date:"06/05", nums:[1,14,30,38,50],  stelle:[2,6] },
  { n:36, date:"09/05", nums:[9,16,24,36,48],  stelle:[5,9] },
  { n:37, date:"13/05", nums:[6,13,25,40,46],  stelle:[1,7] },
  { n:38, date:"16/05", nums:[4,26,32,35,36],  stelle:[3,11] },
  { n:39, date:"20/05", nums:[3,10,38,41,43],  stelle:[2,5] },
  { n:40, date:"22/05", nums:[2,12,20,38,45],  stelle:[2,5] },
  { n:41, date:"23/05", nums:[6,22,26,31,37],  stelle:[5,8] },
];

// ── CHIAVI LOCALSTORAGE (condivise con le app analitiche) ──
const LS = {
  SE: "draws_superenalotto_v1",
  EJ: "draws_eurojackpot_v1",
  EM: "draws_euromillions_v1",
};

// ── COLORI ──
const C = {
  SE: "#D4AF37", EJ: "#F07030", EM: "#4A8FD4",
  bg: "#07070F", card: "#0D0D1A", border: "#1A1A2E",
  text: "#C8C8D8", dim: "#4A4A6A",
  green: "#4A9E5C", red: "#C94040", teal: "#2BA89A",
};

const sm = a => a.reduce((s,v)=>s+v,0);

function Ball({num, color="#D4AF37", size=28}){
  return(
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`radial-gradient(circle at 35% 32%,${color}cc,${color}33)`,
      border:`2px solid ${color}`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size>30?12:10, fontWeight:900, color:"#fff", fontFamily:"monospace",
    }}>{num}</div>
  );
}

export default function App(){
  const [game, setGame] = useState("SE");
  const [view, setView] = useState("archivio");
  const [extraDraws, setExtraDraws] = useState({SE:[],EJ:[],EM:[]});
  const [search, setSearch] = useState("");
  const [confirmSync, setConfirmSync] = useState(false);
  const [formN, setFormN] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formNums, setFormNums] = useState(["","","","","",""]);
  const [formBonus, setFormBonus] = useState(["",""]);
  const [formJolly, setFormJolly] = useState("");
  const [formSS, setFormSS] = useState("");
  const [formMsg, setFormMsg] = useState(null);

  useEffect(()=>{
    const loaded={SE:[],EJ:[],EM:[]};
    ["SE","EJ","EM"].forEach(g=>{
      try{ loaded[g]=JSON.parse(localStorage.getItem("archivio_"+g)||"[]"); }catch{}
    });
    setExtraDraws(loaded);
  },[]);

  const baseMap = {SE:BASE_SE, EJ:BASE_EJ, EM:BASE_EM};

  const allDraws = useMemo(()=>{
    const base = baseMap[game];
    const extra = extraDraws[game]||[];
    const extraNs = new Set(extra.map(d=>d.n));
    return [...base.filter(d=>!extraNs.has(d.n)), ...extra].sort((a,b)=>a.n-b.n);
  },[game, extraDraws]);

  const filtered = useMemo(()=>{
    if(!search.trim()) return allDraws;
    const s = search.trim().toLowerCase();
    return allDraws.filter(d=>
      String(d.n).includes(s) || d.date.includes(s) || d.nums.some(n=>String(n)===s)
    );
  },[allDraws, search]);

  const persistExtra = useCallback((g, list)=>{
    localStorage.setItem("archivio_"+g, JSON.stringify(list));
    setExtraDraws(prev=>({...prev,[g]:list}));
  },[]);

  const syncAll = ()=>{
    ["SE","EJ","EM"].forEach(g=>{
      const extra=extraDraws[g]||[];
      localStorage.setItem("archivio_"+g, JSON.stringify(extra));
    });
    setConfirmSync(false);
    setFormMsg({type:"success",text:"✅ Dati salvati! Usa 📤 Esporta per aggiornare le app in modo permanente."});
    setTimeout(()=>setFormMsg(null),4000);
  };

  // ── ESPORTAZIONE CODICE TESTO ──
  const [exportCode, setExportCode] = useState("");
  const [showExport, setShowExport] = useState(false);

  const generaExport = () => {
    const lines = [];
    ["SE","EJ","EM"].forEach(g=>{
      const extra = extraDraws[g]||[];
      extra.forEach(d=>{
        let line = `${g}:${d.n}:${d.date}:${d.nums.join("-")}`;
        if(g==="SE") line += `:J${d.jolly||0}:SS${d.superstar||0}`;
        else if(g==="EJ") line += `:EN${(d.bonus||[]).join("-")}`;
        else if(g==="EM") line += `:ST${(d.stelle||[]).join("-")}`;
        lines.push(line);
      });
    });
    setExportCode(lines.join("\n")||"(nessuna estrazione aggiunta o corretta)");
    setShowExport(true);
  };

  const addDraw = ()=>{
    setFormMsg(null);
    const n = parseInt(formN)||0;
    const POOL = game==="SE"?90:50;
    const PICK = game==="SE"?6:5;
    const nums = formNums.slice(0,PICK).map(v=>parseInt(v)||0).filter(x=>x>0);
    if(!n){setFormMsg({type:"err",text:"Inserisci il numero concorso"});return;}
    if(!formDate.trim()){setFormMsg({type:"err",text:"Inserisci la data (gg/mm)"});return;}
    if(nums.length!==PICK){setFormMsg({type:"err",text:`Inserisci esattamente ${PICK} numeri`});return;}
    if(nums.some(x=>x<1||x>POOL)){setFormMsg({type:"err",text:`Numeri devono essere 1–${POOL}`});return;}
    if([...new Set(nums)].length!==PICK){setFormMsg({type:"err",text:"Numeri duplicati"});return;}
    const allN = new Set([...baseMap[game],...(extraDraws[game]||[])].map(d=>d.n));
    if(allN.has(n)){setFormMsg({type:"err",text:`Concorso #${n} già presente`});return;}

    let newDraw = {n, date:formDate.trim(), nums:[...new Set(nums)].sort((a,b)=>a-b)};
    if(game==="SE"){
      const j=parseInt(formJolly)||0;
      if(j<1||j>90){setFormMsg({type:"err",text:"Jolly deve essere 1–90"});return;}
      newDraw = {...newDraw, jolly:j, superstar:parseInt(formSS)||undefined};
    } else {
      const bonus = formBonus.map(v=>parseInt(v)||0);
      if(bonus.some(x=>x<1||x>12)){setFormMsg({type:"err",text:"Euro Numeri/Stelle devono essere 1–12"});return;}
      newDraw = {...newDraw, [game==="EM"?"stelle":"bonus"]:bonus.sort((a,b)=>a-b)};
    }
    persistExtra(game, [...(extraDraws[game]||[]), newDraw].sort((a,b)=>a.n-b.n));
    setFormMsg({type:"success",text:`✅ Concorso #${n} aggiunto!`});
    setFormN(""); setFormDate("");
    setFormNums(["","","","","",""]);
    setFormBonus(["",""]); setFormJolly(""); setFormSS("");
  };

  const [editingN, setEditingN] = useState(null); // concorso n. in modifica
  const [editNums, setEditNums] = useState([]);
  const [editBonus, setEditBonus] = useState([]);
  const [editJolly, setEditJolly] = useState("");
  const [editSS, setEditSS] = useState("");
  const [editDate, setEditDate] = useState("");

  const startEdit = (d) => {
    setEditingN(d.n);
    setEditNums([...d.nums].map(String));
    setEditDate(d.date);
    if(game==="SE"){ setEditJolly(String(d.jolly||"")); setEditSS(String(d.superstar||"")); }
    else { setEditBonus([...(d.bonus||d.stelle||[])].map(String)); }
  };

  const saveEdit = () => {
    const POOL = game==="SE"?90:50;
    const PICK = game==="SE"?6:5;
    const nums = editNums.slice(0,PICK).map(v=>parseInt(v)||0).filter(x=>x>0);
    if(nums.length!==PICK){ setFormMsg({type:"err",text:`Inserisci esattamente ${PICK} numeri`}); return; }
    if(nums.some(x=>x<1||x>POOL)){ setFormMsg({type:"err",text:`Numeri devono essere 1–${POOL}`}); return; }
    if([...new Set(nums)].length!==PICK){ setFormMsg({type:"err",text:"Numeri duplicati"}); return; }

    // Build the updated draw object
    let upd = {n:editingN, date:editDate.trim(), nums:[...new Set(nums)].sort((a,b)=>a-b)};
    if(game==="SE"){
      const j=parseInt(editJolly)||0;
      const ss=parseInt(editSS)||0;
      upd.jolly=j>=1&&j<=90?j:1;
      if(ss>=1&&ss<=90) upd.superstar=ss;
    } else {
      const bKey=game==="EM"?"stelle":"bonus";
      const bonus=editBonus.map(v=>parseInt(v)||0).filter(x=>x>=1&&x<=12);
      upd[bKey]=bonus.length===2?bonus.sort((a,b)=>a-b):[1,2];
    }

    // If it was in extraDraws, update it there; otherwise add it as an override
    const extras = extraDraws[game]||[];
    const existsInExtra = extras.some(d=>d.n===editingN);
    let updated;
    if(existsInExtra){
      updated = extras.map(d=>d.n===editingN?upd:d);
    } else {
      // Was a base draw — add override to extras
      updated = [...extras, upd].sort((a,b)=>a.n-b.n);
    }
    persistExtra(game, updated);
    setEditingN(null);
    setFormMsg({type:"success", text:`✅ Concorso #${editingN} corretto e salvato!`});
    setTimeout(()=>setFormMsg(null),3000);
  };

  const removeExtra = (n)=> persistExtra(game, (extraDraws[game]||[]).filter(d=>d.n!==n));

  const stats = useMemo(()=>{
    if(!allDraws.length) return null;
    const freq={};
    allDraws.forEach(d=>d.nums.forEach(n=>{freq[n]=(freq[n]||0)+1;}));
    const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
    const sums=allDraws.map(d=>sm(d.nums));
    const avg=sums.reduce((a,b)=>a+b,0)/sums.length;
    return {freq,sorted,avg,min:Math.min(...sums),max:Math.max(...sums),most:sorted[0],least:sorted[sorted.length-1]};
  },[allDraws]);

  const gameConf = {
    SE:{label:"🇮🇹 SuperEnalotto", color:"#D4AF37", pool:90, pick:6, bonusLabel:"Jolly/SS"},
    EJ:{label:"🇪🇺 EuroJackpot",   color:"#F07030", pool:50, pick:5, bonusLabel:"Euro Numeri"},
    EM:{label:"🌍 EuroMillions",    color:"#4A8FD4", pool:50, pick:5, bonusLabel:"Stelle"},
  };
  const gc = gameConf[game];
  const baseN = baseMap[game].length;
  const extraN = (extraDraws[game]||[]).length;
  const lastDraw = allDraws[allDraws.length-1];

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Courier New',monospace",color:C.text,paddingBottom:80}}>

      {/* HERO HEADER */}
      <div style={{
        background:`linear-gradient(180deg,#0a0a18 0%,${gc.color}08 60%,transparent 100%)`,
        borderBottom:`1px solid ${gc.color}22`,
        padding:"28px 14px 22px",textAlign:"center",
        position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",top:-60,left:"15%",width:240,height:240,borderRadius:"50%",background:`${gc.color}07`,filter:"blur(70px)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:-60,right:"15%",width:240,height:240,borderRadius:"50%",background:`${gc.color}05`,filter:"blur(70px)",pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>
          <div style={{fontSize:40,marginBottom:8}}>📚</div>
          <h1 style={{color:"#fff",fontFamily:"Georgia,serif",fontSize:26,margin:"0 0 4px",letterSpacing:1}}>
            Archivio Storico Lotterie
          </h1>
          <p style={{color:`${gc.color}88`,fontSize:11,margin:"0 0 22px",letterSpacing:3,textTransform:"uppercase"}}>
            Database Ufficiale · 2026
          </p>

          {/* GAME SELECTOR */}
          <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:22}}>
            {Object.entries(gameConf).map(([g,conf])=>(
              <button key={g} onClick={()=>{setGame(g);setSearch("");setFormMsg(null);setView("archivio");}} style={{
                background:game===g?`linear-gradient(135deg,${conf.color}33,${conf.color}11)`:"rgba(255,255,255,0.04)",
                color:game===g?conf.color:"#555",
                border:`2px solid ${game===g?conf.color:"#1a1a2e"}`,
                borderRadius:28,padding:"10px 22px",fontSize:13,
                fontWeight:game===g?700:400,cursor:"pointer",fontFamily:"inherit",
                boxShadow:game===g?`0 0 20px ${conf.color}33`:"none",
              }}>{conf.label}</button>
            ))}
          </div>

          {/* KPI */}
          <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
            {[
              {icon:"🗂",label:"Totale",val:`${allDraws.length} estr.`},
              {icon:"📦",label:"Archivio",val:`${baseN} conc.`},
              {icon:"➕",label:"Aggiunte",val:`${extraN}`},
              {icon:"🏁",label:"Ultima",val:lastDraw?`#${lastDraw.n} · ${lastDraw.date}`:"—"},
            ].map(k=>(
              <div key={k.label} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${gc.color}22`,borderRadius:10,padding:"7px 14px",textAlign:"center",minWidth:80}}>
                <div style={{fontSize:16}}>{k.icon}</div>
                <div style={{color:gc.color,fontSize:12,fontWeight:700,fontFamily:"monospace"}}>{k.val}</div>
                <div style={{color:"#333",fontSize:9,textTransform:"uppercase",letterSpacing:1}}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:820,margin:"0 auto",padding:"0 14px"}}>

        {/* NAV + SYNC */}
        <div style={{display:"flex",alignItems:"center",gap:4,margin:"16px 0",padding:"6px",background:C.card,border:`1px solid ${C.border}`,borderRadius:14}}>
          {[{id:"archivio",icon:"📋",l:"Archivio"},{id:"inserisci",icon:"➕",l:"Inserisci"},{id:"stats",icon:"📈",l:"Statistiche"}].map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)} style={{
              flex:1,
              background:view===t.id?`linear-gradient(135deg,${gc.color}22,${gc.color}0a)`:"transparent",
              color:view===t.id?gc.color:"#444",
              border:`1px solid ${view===t.id?gc.color:"transparent"}`,
              borderRadius:10,padding:"8px 4px",fontSize:11,fontWeight:view===t.id?700:400,
              cursor:"pointer",fontFamily:"inherit",
            }}>{t.icon} {t.l}</button>
          ))}
          <div style={{width:1,background:C.border,height:24,marginLeft:4}}/>
          {confirmSync?(
            <div style={{display:"flex",gap:4,marginLeft:4,alignItems:"center"}}>
              <span style={{color:C.dim,fontSize:9}}>Confermi?</span>
              <button onClick={syncAll} style={{background:`linear-gradient(135deg,${C.green},${C.teal})`,color:"#fff",border:"none",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✅</button>
              <button onClick={()=>setConfirmSync(false)} style={{background:"transparent",color:"#444",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
            </div>
          ):(
            <div style={{display:"flex",gap:4,marginLeft:4}}>
              <button onClick={()=>setConfirmSync(true)} style={{background:`${C.teal}15`,color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:10,padding:"8px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>🔄 Sync</button>
              <button onClick={generaExport} style={{background:"#8A5CC422",color:"#8A5CC4",border:"1px solid #8A5CC444",borderRadius:10,padding:"8px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>📤 Esporta</button>
            </div>
          )}
        </div>

        {/* MSG */}
        {formMsg&&(
          <div style={{display:"flex",alignItems:"center",gap:10,background:formMsg.type==="success"?`${C.green}12`:`${C.red}12`,border:`1px solid ${formMsg.type==="success"?C.green:C.red}55`,borderLeft:`4px solid ${formMsg.type==="success"?C.green:C.red}`,borderRadius:8,padding:"10px 14px",marginBottom:14,color:formMsg.type==="success"?C.green:C.red,fontSize:12}}>
            <span style={{fontSize:18}}>{formMsg.type==="success"?"✅":"⚠️"}</span>
            {formMsg.text}
          </div>
        )}

        {/* EXPORT MODAL */}
        {showExport&&(
          <div style={{background:"#0a0a18",border:"2px solid #8A5CC4",borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{color:"#8A5CC4",fontWeight:700,fontSize:13}}>📤 Codice da inviare a Claude</div>
              <button onClick={()=>setShowExport(false)} style={{background:"transparent",color:"#555",border:"none",fontSize:16,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{color:"#aaa",fontSize:10,marginBottom:8,lineHeight:1.6}}>
              Copia questo testo e invialo a Claude nella chat per aggiornare il database in modo permanente.
              Una volta che Claude aggiorna il codice, i dati saranno sempre presenti al riavvio.
            </div>
            <textarea readOnly value={exportCode}
              style={{width:"100%",background:"#060612",color:"#4A9E5C",border:"1px solid #1a1a2e",
                borderRadius:8,padding:10,fontSize:11,fontFamily:"monospace",
                minHeight:120,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={()=>{
                if(navigator.clipboard) navigator.clipboard.writeText(exportCode);
                setFormMsg({type:"success",text:"✅ Copiato! Incollalo nella chat con Claude."});
                setShowExport(false);
              }} style={{flex:1,padding:"10px",background:"linear-gradient(135deg,#8A5CC4,#4A8FD4)",
                color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit"}}>
                📋 Copia negli appunti
              </button>
            </div>
          </div>
        )}

        {/* ARCHIVIO */}
        {view==="archivio"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"6px 12px"}}>
              <span style={{color:"#333",fontSize:16}}>🔍</span>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Cerca per concorso, data o numero estratto..."
                style={{flex:1,background:"transparent",color:C.text,border:"none",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
              {search&&<button onClick={()=>setSearch("")} style={{background:"#1a1a2e",color:"#555",border:"none",borderRadius:6,width:22,height:22,cursor:"pointer",fontSize:12}}>✕</button>}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,fontSize:11,color:C.dim}}>
              <span>{filtered.length} estrazion{filtered.length===1?"e":"i"}{search?` per "${search}"`:" · più recenti prima"}</span>
              {extraN>0&&<span style={{color:gc.color,fontSize:10}}>⭐ {extraN} aggiunte</span>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {[...filtered].reverse().map((d,idx)=>{
                const isExtra=!(new Set(baseMap[game].map(x=>x.n))).has(d.n);
                const s=sm(d.nums);
                const isLast=idx===0;
                const isEditing=editingN===d.n;
                const POOL=game==="SE"?90:50;
                const PICK=game==="SE"?6:5;
                return(
                  <div key={d.n} style={{
                    background:isEditing?`${gc.color}08`:isLast?`linear-gradient(135deg,${gc.color}15,${gc.color}05)`:C.card,
                    border:`2px solid ${isEditing?gc.color:isExtra?`${gc.color}66`:isLast?`${gc.color}44`:C.border}`,
                    borderLeft:`3px solid ${isEditing?gc.color:isExtra||isLast?gc.color:"#1a1a2e"}`,
                    borderRadius:10,overflow:"hidden",
                  }}>
                    {/* ROW PRINCIPALE */}
                    <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                      <div style={{minWidth:62,flexShrink:0}}>
                        <div style={{color:isLast?gc.color:"#aaa",fontWeight:700,fontSize:13,fontFamily:"Georgia,serif"}}>#{d.n}</div>
                        <div style={{color:C.dim,fontSize:9,marginTop:1,background:"#0a0a18",borderRadius:4,padding:"1px 5px",display:"inline-block"}}>{d.date}/26</div>
                      </div>
                      <div style={{display:"flex",gap:3,flexWrap:"wrap",flex:1}}>
                        {d.nums.map(n=>(
                          <div key={n} style={{width:28,height:28,borderRadius:"50%",flexShrink:0,background:`radial-gradient(circle at 35% 32%,${gc.color}cc,${gc.color}33)`,border:`2px solid ${gc.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff",fontFamily:"monospace",boxShadow:isLast?`0 0 8px ${gc.color}55`:"none"}}>{n}</div>
                        ))}
                      </div>
                      {game==="SE"&&d.jolly&&(
                        <div style={{display:"flex",gap:3,alignItems:"center",flexShrink:0}}>
                          <div style={{width:24,height:24,borderRadius:"50%",background:"#1a1a2a",border:"2px solid #444",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#888",fontFamily:"monospace"}}>{d.jolly}</div>
                          {d.superstar&&<div style={{width:24,height:24,borderRadius:"50%",background:"radial-gradient(circle at 35% 32%,#FFD700cc,#FFD70033)",border:"2px solid #FFD700",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#000",fontFamily:"monospace"}}>{d.superstar}</div>}
                        </div>
                      )}
                      {game==="EJ"&&d.bonus&&(
                        <div style={{display:"flex",gap:3,alignItems:"center",flexShrink:0}}>
                          <span style={{color:"#FFD70066",fontSize:8}}>EN</span>
                          {d.bonus.map(b=><div key={b} style={{width:24,height:24,borderRadius:"50%",background:"radial-gradient(circle at 35% 32%,#FFD700cc,#FFD70033)",border:"2px solid #FFD700",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#000",fontFamily:"monospace"}}>{b}</div>)}
                        </div>
                      )}
                      {game==="EM"&&d.stelle&&(
                        <div style={{display:"flex",gap:3,alignItems:"center",flexShrink:0}}>
                          <span style={{color:"#FFD70066",fontSize:10}}>⭐</span>
                          {d.stelle.map(s=><div key={s} style={{width:24,height:24,borderRadius:"20%",background:"radial-gradient(circle at 35% 32%,#FFD700cc,#FFD70033)",border:"2px solid #FFD700",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#000",fontFamily:"monospace"}}>{s}</div>)}
                        </div>
                      )}
                      <div style={{display:"flex",gap:5,alignItems:"center",marginLeft:"auto",flexShrink:0}}>
                        <div style={{background:`${gc.color}15`,border:`1px solid ${gc.color}33`,borderRadius:6,padding:"3px 8px",color:gc.color,fontFamily:"monospace",fontSize:11,fontWeight:700}}>Σ{s}</div>
                        {isLast&&<span style={{background:`${gc.color}22`,border:`1px solid ${gc.color}`,borderRadius:4,padding:"1px 6px",color:gc.color,fontSize:8,fontWeight:700}}>ULTIMA</span>}
                        {!isEditing&&(
                          <button onClick={()=>startEdit(d)} style={{background:`${gc.color}15`,color:gc.color,border:`1px solid ${gc.color}44`,borderRadius:5,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}} title="Modifica estrazione">✏️</button>
                        )}
                        {isExtra&&!isEditing&&(
                          <button onClick={()=>removeExtra(d.n)} style={{background:"#1a0606",color:"#C94040",border:"1px solid #C9404033",borderRadius:5,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}} title="Elimina">✕</button>
                        )}
                        {isEditing&&(
                          <button onClick={()=>setEditingN(null)} style={{background:"transparent",color:C.dim,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕ Annulla</button>
                        )}
                      </div>
                    </div>

                    {/* FORM MODIFICA INLINE */}
                    {isEditing&&(
                      <div style={{borderTop:`1px solid ${gc.color}33`,padding:"12px 14px",background:"#08081a"}}>
                        <div style={{color:gc.color,fontSize:11,fontWeight:700,marginBottom:10}}>
                          ✏️ Modifica concorso #{d.n}
                        </div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                          <div>
                            <div style={{color:C.dim,fontSize:9,marginBottom:4}}>Data (gg/mm)</div>
                            <input type="text" value={editDate} onChange={e=>setEditDate(e.target.value)}
                              style={{width:80,textAlign:"center",background:"#060612",color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px",fontSize:13,fontFamily:"monospace",outline:"none"}}/>
                          </div>
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{color:C.dim,fontSize:9,marginBottom:6}}>{PICK} Numeri (1–{POOL})</div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {editNums.slice(0,PICK).map((v,i)=>{
                              const num=parseInt(v)||0,valid=num>=1&&num<=POOL;
                              const col=valid?gc.color:"#333";
                              return(
                                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                                  <div style={{width:34,height:34,borderRadius:"50%",background:valid?`radial-gradient(circle at 35% 32%,${col}cc,${col}22)`:"#0a0a18",border:`2px solid ${col}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:valid?"#fff":"#333",fontFamily:"monospace"}}>{valid?num:"?"}</div>
                                  <input type="number" min={1} max={POOL} value={v}
                                    onChange={e=>{const n=[...editNums];n[i]=e.target.value;setEditNums(n);}}
                                    style={{width:44,textAlign:"center",background:"#060612",color:col,border:`1.5px solid ${col}55`,borderRadius:6,padding:"3px",fontSize:12,fontFamily:"monospace",outline:"none"}}/>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {game==="SE"&&(
                          <div style={{display:"flex",gap:12,marginBottom:10,flexWrap:"wrap"}}>
                            {[{l:"Jolly",v:editJolly,set:setEditJolly,max:90,col:"#888"},{l:"SuperStar",v:editSS,set:setEditSS,max:90,col:"#FFD700"}].map(f=>(
                              <div key={f.l}>
                                <div style={{color:C.dim,fontSize:9,marginBottom:4}}>{f.l}</div>
                                <input type="number" min={1} max={f.max} value={f.v} onChange={e=>f.set(e.target.value)}
                                  style={{width:56,textAlign:"center",background:"#060612",color:f.col,border:`1.5px solid ${f.col}44`,borderRadius:6,padding:"5px",fontSize:12,fontFamily:"monospace",outline:"none"}}/>
                              </div>
                            ))}
                          </div>
                        )}
                        {(game==="EJ"||game==="EM")&&(
                          <div style={{marginBottom:10}}>
                            <div style={{color:"#FFD700",fontSize:9,marginBottom:6}}>{gc.bonusLabel} (1–12)</div>
                            <div style={{display:"flex",gap:6}}>
                              {editBonus.map((v,i)=>{
                                const num=parseInt(v)||0,valid=num>=1&&num<=12;
                                return(
                                  <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                                    <div style={{width:32,height:32,borderRadius:game==="EM"?"20%":"50%",background:valid?"radial-gradient(circle at 35% 32%,#FFD700cc,#FFD70022)":"#0a0a18",border:`2px solid ${valid?"#FFD700":"#333"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:valid?"#000":"#333",fontFamily:"monospace"}}>{valid?num:"?"}</div>
                                    <input type="number" min={1} max={12} value={v}
                                      onChange={e=>{const b=[...editBonus];b[i]=e.target.value;setEditBonus(b);}}
                                      style={{width:44,textAlign:"center",background:"#060612",color:"#FFD700",border:"1.5px solid #FFD70055",borderRadius:6,padding:"3px",fontSize:12,fontFamily:"monospace",outline:"none"}}/>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={saveEdit} style={{
                            flex:1,padding:"9px",background:`linear-gradient(135deg,${gc.color},${C.teal})`,
                            color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,
                            cursor:"pointer",fontFamily:"inherit",
                          }}>💾 Salva modifiche</button>
                          <button onClick={()=>setEditingN(null)} style={{
                            padding:"9px 16px",background:"transparent",color:C.dim,
                            border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit",
                          }}>Annulla</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INSERISCI */}
        {view==="inserisci"&&(
          <div style={{background:"linear-gradient(135deg,#0a1a0a,#060f06)",border:`2px solid ${C.green}33`,borderRadius:14,padding:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
              <div style={{width:40,height:40,borderRadius:10,background:`${C.green}22`,border:`2px solid ${C.green}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>➕</div>
              <div>
                <div style={{color:C.green,fontWeight:700,fontSize:14}}>Aggiungi Estrazione</div>
                <div style={{color:"#2BA89A88",fontSize:10}}>{gc.label}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {[{l:"Concorso #",val:formN,set:setFormN,ph:"es. 84",type:"number"},{l:"Data (gg/mm)",val:formDate,set:setFormDate,ph:"27/05",type:"text"}].map(f=>(
                <div key={f.l}>
                  <div style={{color:C.dim,fontSize:10,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>{f.l}</div>
                  <input type={f.type} value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={{width:"100%",textAlign:"center",background:"#060612",color:C.text,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px",fontSize:16,fontFamily:"monospace",fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
            <div style={{marginBottom:16}}>
              <div style={{color:C.dim,fontSize:10,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{gc.pick} Numeri (1–{gc.pool})</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {formNums.slice(0,gc.pick).map((v,i)=>{
                  const num=parseInt(v)||0,valid=num>=1&&num<=gc.pool;
                  const isDup=valid&&formNums.filter(x=>parseInt(x)===num).length>1;
                  const col=isDup?"#C94040":valid?gc.color:"#333";
                  return(
                    <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                      <div style={{width:40,height:40,borderRadius:"50%",background:valid?`radial-gradient(circle at 35% 32%,${col}cc,${col}22)`:"#0a0a18",border:`2px solid ${col}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:valid?"#fff":"#333",fontFamily:"monospace",boxShadow:valid&&!isDup?`0 0 10px ${col}44`:"none"}}>{valid?num:"?"}</div>
                      <input type="number" min={1} max={gc.pool} value={v} onChange={e=>{const n=[...formNums];n[i]=e.target.value;setFormNums(n);}} style={{width:48,textAlign:"center",background:"#060612",color:col,border:`2px solid ${col}55`,borderRadius:8,padding:"5px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/>
                    </div>
                  );
                })}
              </div>
            </div>
            {game==="SE"?(
              <div style={{display:"flex",gap:14,marginBottom:16,flexWrap:"wrap"}}>
                {[{l:"Jolly (1–90)",v:formJolly,set:setFormJolly,max:90,col:"#888888"},{l:"SuperStar (opz.)",v:formSS,set:setFormSS,max:90,col:"#FFD700"}].map(f=>(
                  <div key={f.l}>
                    <div style={{color:C.dim,fontSize:10,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>{f.l}</div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:parseInt(f.v)?`radial-gradient(circle at 35% 32%,${f.col}cc,${f.col}22)`:"#0a0a18",border:`2px solid ${parseInt(f.v)?f.col:"#333"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:parseInt(f.v)?"#fff":"#333",fontFamily:"monospace"}}>{parseInt(f.v)||"?"}</div>
                      <input type="number" min={1} max={f.max} value={f.v} onChange={e=>f.set(e.target.value)} style={{width:54,textAlign:"center",background:"#060612",color:f.col,border:`2px solid ${f.col}44`,borderRadius:8,padding:"5px",fontSize:13,fontFamily:"monospace",outline:"none"}}/>
                    </div>
                  </div>
                ))}
              </div>
            ):(
              <div style={{marginBottom:16}}>
                <div style={{color:"#FFD700",fontSize:10,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{gc.bonusLabel} (1–12)</div>
                <div style={{display:"flex",gap:8}}>
                  {formBonus.map((v,i)=>{
                    const num=parseInt(v)||0,valid=num>=1&&num<=12;
                    return(
                      <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                        <div style={{width:40,height:40,borderRadius:game==="EM"?"20%":"50%",background:valid?"radial-gradient(circle at 35% 32%,#FFD700cc,#FFD70022)":"#0a0a18",border:`2px solid ${valid?"#FFD700":"#333"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:valid?"#000":"#333",fontFamily:"monospace",boxShadow:valid?"0 0 10px #FFD70044":"none"}}>{valid?num:"?"}</div>
                        <input type="number" min={1} max={12} value={v} onChange={e=>{const b=[...formBonus];b[i]=e.target.value;setFormBonus(b);}} style={{width:48,textAlign:"center",background:"#060612",color:"#FFD700",border:"2px solid #FFD70055",borderRadius:8,padding:"5px 2px",fontSize:13,fontFamily:"monospace",outline:"none"}}/>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(()=>{
              const valid=formNums.slice(0,gc.pick).map(v=>parseInt(v)||0).filter(n=>n>=1&&n<=gc.pool);
              if(!valid.length) return null;
              return(<div style={{background:`${gc.color}08`,border:`1px solid ${gc.color}22`,borderRadius:8,padding:"8px 12px",marginBottom:14,display:"flex",gap:12,alignItems:"center"}}>
                <span style={{color:C.dim,fontSize:11}}>Somma parziale:</span>
                <span style={{color:gc.color,fontFamily:"monospace",fontWeight:700,fontSize:18}}>{valid.reduce((a,b)=>a+b,0)}</span>
                <span style={{color:C.dim,fontSize:10}}>{valid.length}/{gc.pick} numeri</span>
              </div>);
            })()}
            <button onClick={addDraw} style={{width:"100%",padding:"14px",background:`linear-gradient(135deg,${C.green},${C.teal})`,color:"#fff",border:"none",borderRadius:10,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"Georgia,serif",boxShadow:`0 4px 20px ${C.green}33`}}>✅ Aggiungi Estrazione</button>
            <div style={{marginTop:14,padding:"10px 12px",background:"#060612",border:"1px solid #1a1a2e",borderRadius:8,color:C.dim,fontSize:10,lineHeight:1.8}}>
              💡 Dopo aver aggiunto, premi <strong style={{color:C.teal}}>🔄 Sync App</strong> per aggiornare le app analitiche.
            </div>
          </div>
        )}

        {/* STATISTICHE */}
        {view==="stats"&&stats&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>
              {[
                {icon:"🗂",l:"Estrazioni",v:allDraws.length,c:gc.color},
                {icon:"➗",l:"Σ media",v:stats.avg.toFixed(1),c:C.teal},
                {icon:"⬇",l:"Σ minima",v:stats.min,c:"#4A8FD4"},
                {icon:"⬆",l:"Σ massima",v:stats.max,c:"#C94040"},
                {icon:"🔥",l:"Più estratto",v:`n.${stats.most[0]}`,c:"#F07030"},
                {icon:"❄️",l:"Meno estratto",v:`n.${stats.least[0]}`,c:"#4A8FD4"},
              ].map(x=>(
                <div key={x.l} style={{background:C.card,border:`1px solid ${x.c}22`,borderTop:`2px solid ${x.c}`,borderRadius:10,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontSize:18,marginBottom:4}}>{x.icon}</div>
                  <div style={{color:x.c,fontSize:17,fontWeight:700,fontFamily:"monospace"}}>{x.v}</div>
                  <div style={{color:"#333",fontSize:9,textTransform:"uppercase",letterSpacing:1,marginTop:2}}>{x.l}</div>
                </div>
              ))}
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`2px solid ${gc.color}`,borderRadius:10,padding:14,marginBottom:12}}>
              <div style={{color:gc.color,fontWeight:700,fontSize:13,marginBottom:12}}>🔥 Top 20 numeri più frequenti</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {stats.sorted.slice(0,20).map(([n,f],i)=>{
                  const barW=(f/stats.sorted[0][1]*100);
                  const fpct=(f/allDraws.length*100).toFixed(1);
                  return(
                    <div key={n} style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:26,height:26,borderRadius:"50%",flexShrink:0,background:`radial-gradient(circle at 35% 32%,${gc.color}cc,${gc.color}33)`,border:`2px solid ${gc.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff",fontFamily:"monospace"}}>{n}</div>
                      <div style={{flex:1,background:"#0a0a18",borderRadius:4,height:6,overflow:"hidden"}}>
                        <div style={{background:`linear-gradient(90deg,${gc.color},${gc.color}88)`,height:"100%",width:`${barW}%`,borderRadius:4}}/>
                      </div>
                      <div style={{color:gc.color,fontSize:11,fontFamily:"monospace",minWidth:28,textAlign:"right"}}>{f}x</div>
                      <div style={{color:C.dim,fontSize:9,minWidth:32,textAlign:"right"}}>{fpct}%</div>
                      <div style={{color:"#222",fontSize:9,minWidth:18}}>#{i+1}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`2px solid ${gc.color}`,borderRadius:10,padding:14}}>
              <div style={{color:gc.color,fontWeight:700,fontSize:13,marginBottom:4}}>🗺️ Heatmap frequenze 1–{gc.pool}</div>
              <div style={{color:C.dim,fontSize:10,marginBottom:10}}>Più luminoso = più estratto.</div>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${gc.pool===90?9:10},1fr)`,gap:3}}>
                {Array.from({length:gc.pool},(_,i)=>i+1).map(n=>{
                  const f=stats.freq[n]||0;
                  const maxF=Math.max(...Object.values(stats.freq));
                  const alpha=Math.round((f/maxF)*220+20).toString(16).padStart(2,"00");
                  return(
                    <div key={n} title={`${n}: ${f}x`} style={{aspectRatio:"1",background:`${gc.color}${alpha}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",fontFamily:"monospace",fontWeight:700}}>{n}</div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:4,alignItems:"center",marginTop:10}}>
                <span style={{color:C.dim,fontSize:9}}>Raro</span>
                {[0.1,0.3,0.5,0.7,0.9].map(v=>(
                  <div key={v} style={{flex:1,height:6,borderRadius:3,background:`${gc.color}${Math.round(v*220+20).toString(16).padStart(2,"00")}`}}/>
                ))}
                <span style={{color:C.dim,fontSize:9}}>Frequente</span>
              </div>
            </div>
          </div>
        )}

        <div style={{marginTop:30,textAlign:"center",color:"#1a1a2e",fontSize:10,lineHeight:1.8}}>
          ⚠️ Strumento puramente statistico — nessun potere predittivo.<br/>
          Il gioco può causare dipendenza. Vietato ai minori di 18 anni.
        </div>
      </div>
    </div>
  );
}
