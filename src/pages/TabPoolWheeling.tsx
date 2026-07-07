// ============================================================
// 🎯 TAB POOL + WHEELING — Pool dinamico a fasce + Rotazione + Copertura garantita
// ============================================================
import { useState, useMemo } from "react";

const CONFIG = {
  SE: { pool: 90, pick: 6, hasStars: false, hasSuperstar: true, label: "SuperEnalotto",
        fasce: [[1, 30], [31, 60], [61, 90]] as [number, number][], perFascia: 15, starPool: 90, starName: "SuperStar", starPick: 1 },
  EJ: { pool: 50, pick: 5, hasStars: true, hasSuperstar: false, label: "EuroJackpot",
        fasce: [[1, 17], [18, 34], [35, 50]] as [number, number][], perFascia: 8, starPool: 12, starName: "EuroNumeri", starPick: 2 },
  EM: { pool: 50, pick: 5, hasStars: true, hasSuperstar: false, label: "EuroMillions",
        fasce: [[1, 17], [18, 34], [35, 50]] as [number, number][], perFascia: 8, starPool: 12, starName: "Stelle", starPick: 2 },
};

type Gioco = "SE" | "EJ" | "EM";
type Estrazione = { data: string; nums: number[]; stars?: number[]; jolly?: number; superstar?: number };
type Biglietto = {
  gioco: Gioco; numeri: number[]; stelle?: number[]; superstar?: number | null;
  tipo: "giocato" | "sistema"; fonte: "wheeling"; somma: number; voti: number; data_creazione: string;
};

// ---- Utility combinatorie ----
function combinazioni(arr: number[], k: number): number[][] {
  const res: number[][] = [];
  const rec = (start: number, combo: number[]) => {
    if (combo.length === k) { res.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); rec(i + 1, combo); combo.pop(); }
  };
  rec(0, []);
  return res;
}
function range(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }

// Copertura ESATTA: se escono k dei pool_size numeri, in che % garantiamo almeno "punto"?
function coperturaEsatta(poolSize: number, combos: number[][], k: number, punto: number): number {
  const estratti = combinazioni(range(poolSize), k);
  let tot = 0, ok = 0;
  for (const est of estratti) {
    const setEst = new Set(est);
    let best = 0;
    for (const c of combos) { let hit = 0; for (const x of c) if (setEst.has(x)) hit++; if (hit > best) best = hit; }
    tot++;
    if (best >= punto) ok++;
  }
  return tot ? ok / tot : 0;
}

// RNG deterministico
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Calcolo pool dinamico + wheeling ----
function calcolaPoolWheeling(
  gioco: Gioco, rows: Estrazione[],
  opts: { pesoRec: number; rotazione: boolean; rientro: number; nNumeri: number; nCombos: number; seed: number }
) {
  const cfg = CONFIG[gioco];
  const { pool, pick, fasce, perFascia } = cfg;
  const N = rows.length;
  if (N < 30) return null;

  // Frequenze totali e recenti (ultime 100)
  const totFreq = new Array(pool + 1).fill(0);
  const recFreq = new Array(pool + 1).fill(0);
  rows.forEach((r) => r.nums.forEach((n) => totFreq[n]++));
  rows.slice(-100).forEach((r) => r.nums.forEach((n) => recFreq[n]++));

  // Numeri "in panchina": usciti nelle ultime `rientro` estrazioni
  const bench: Record<number, number> = {}; // num -> estrazioni fa
  if (opts.rotazione) {
    const recent = rows.slice(-opts.rientro);
    recent.forEach((r, i) => {
      const estrFa = recent.length - i;
      r.nums.forEach((n) => { if (!(n in bench) || estrFa < bench[n]) bench[n] = estrFa; });
    });
  }

  // Punteggio per numero
  const score = (n: number) => totFreq[n] + (opts.pesoRec - 1) * recFreq[n];

  // Costruzione pool a fasce, dimensione fissa (Opzione 1)
  const topFascia = (lo: number, hi: number) => {
    const nums: { n: number; s: number; benchAge: number; inBench: boolean }[] = [];
    for (let n = lo; n <= hi; n++) nums.push({ n, s: score(n), benchAge: bench[n] || 0, inBench: n in bench });
    const attivi = nums.filter((x) => !x.inBench).sort((a, b) => b.s - a.s);
    let chosen = attivi.slice(0, perFascia).map((x) => x.n);
    if (chosen.length < perFascia) {
      const panchina = nums.filter((x) => x.inBench).sort((a, b) => (b.benchAge - a.benchAge) || (b.s - a.s));
      const needed = perFascia - chosen.length;
      for (let i = 0; i < needed && i < panchina.length; i++) chosen.push(panchina[i].n);
    }
    return chosen.sort((a, b) => a - b);
  };

  const poolFasce = fasce.map(([lo, hi]) => topFascia(lo, hi));
  const poolCompleto = poolFasce.flat();
  const benchCount = Object.keys(bench).length;

  // Selezione bilanciata di nNumeri dal pool
  const rng = mulberry32(opts.seed);
  const sample = (arr: number[], k: number) => {
    const c = [...arr]; const out: number[] = [];
    for (let i = 0; i < k && c.length; i++) { const idx = Math.floor(rng() * c.length); out.push(c[idx]); c.splice(idx, 1); }
    return out;
  };
  const N3 = opts.nNumeri;
  const per = Math.floor(N3 / 3), extra = N3 % 3;
  const nb = per + (extra > 0 ? 1 : 0), nm = per + (extra > 1 ? 1 : 0), na = per;
  const numeri = [...sample(poolFasce[0], nb), ...sample(poolFasce[1], nm), ...sample(poolFasce[2], na)].sort((a, b) => a - b);

  // Ottimizzazione wheeling: massimizza copertura punto-3
  const psize = numeri.length;
  const c4 = combinazioni(range(psize), Math.min(4, psize));
  let bestCombos: number[][] | null = null, bestScore = -1;
  for (let att = 0; att < 1200; att++) {
    const combos: number[][] = [];
    for (let c = 0; c < opts.nCombos; c++) {
      const p = range(psize); const combo: number[] = [];
      for (let s = 0; s < pick; s++) { const idx = Math.floor(rng() * p.length); combo.push(p[idx]); p.splice(idx, 1); }
      combos.push(combo.sort((a, b) => a - b));
    }
    let samp = c4;
    if (c4.length > 120) { samp = []; for (let s = 0; s < 120; s++) samp.push(c4[Math.floor(rng() * c4.length)]); }
    let sc = 0;
    for (const e of samp) { const setE = new Set(e); let b = 0; for (const cc of combos) { let hit = 0; for (const x of cc) if (setE.has(x)) hit++; if (hit > b) b = hit; } if (b >= 3) sc++; }
    if (sc > bestScore) { bestScore = sc; bestCombos = combos; }
  }
  const idxCombos = bestCombos || [];
  const realCombos = idxCombos.map((c) => c.map((i) => numeri[i]).sort((a, b) => a - b));

  // Tabella garanzie
  const maxK = Math.min(pick, psize);
  const garanzie: { k: number; p2: number; p3: number; p4: number; p5: number }[] = [];
  for (let k = 2; k <= maxK; k++) {
    garanzie.push({
      k,
      p2: Math.round(coperturaEsatta(psize, idxCombos, k, 2) * 100),
      p3: Math.round(coperturaEsatta(psize, idxCombos, k, 3) * 100),
      p4: Math.round(coperturaEsatta(psize, idxCombos, k, 4) * 100),
      p5: pick >= 5 ? Math.round(coperturaEsatta(psize, idxCombos, k, 5) * 100) : 0,
    });
  }

  // Stelle / SuperStar (per frequenza pesata)
  let stelle: number[] = [];
  let superstar: number | null = null;
  if (cfg.hasStars || cfg.hasSuperstar) {
    const sTot = new Array(cfg.starPool + 1).fill(0);
    const sRec = new Array(cfg.starPool + 1).fill(0);
    rows.forEach((r) => { const arr = cfg.hasStars ? (r.stars || []) : (r.superstar ? [r.superstar] : []); arr.forEach((s) => { if (s >= 1 && s <= cfg.starPool) sTot[s]++; }); });
    rows.slice(-100).forEach((r) => { const arr = cfg.hasStars ? (r.stars || []) : (r.superstar ? [r.superstar] : []); arr.forEach((s) => { if (s >= 1 && s <= cfg.starPool) sRec[s]++; }); });
    const sScored = Array.from({ length: cfg.starPool }, (_, i) => i + 1).sort((a, b) => (sTot[b] + (opts.pesoRec - 1) * sRec[b]) - (sTot[a] + (opts.pesoRec - 1) * sRec[a]));
    if (cfg.hasStars) stelle = sScored.slice(0, Math.max(5, cfg.starPick + 3));
    else superstar = sScored[0];
  }

  return { poolFasce, poolCompleto, benchCount, benchRientro: opts.rientro, numeri, realCombos, garanzie, stelle, superstar, psize, pick };
}

// ============================================================
// COMPONENTE UI
// ============================================================
export default function TabPoolWheeling({
  gioco = "SE", estrazioni = [], onSalvaBiglietto, bigliettiSalvati = [],
}: {
  gioco?: Gioco; estrazioni?: Estrazione[];
  onSalvaBiglietto?: (b: Biglietto) => Promise<void> | void;
  bigliettiSalvati?: { numeri: number[] }[];
}) {
  const cfg = CONFIG[gioco];
  const [rotazione, setRotazione] = useState(true);
  const [rientro, setRientro] = useState(15);
  const [pesoRec, setPesoRec] = useState(2);
  const [nNumeri, setNNumeri] = useState(14);
  const [nCombos, setNCombos] = useState(6);
  const [seed, setSeed] = useState(1);
  const [salvataggio, setSalvataggio] = useState<Record<number, string>>({});

  const result = useMemo(() => {
    try {
      return calcolaPoolWheeling(gioco, estrazioni, { pesoRec, rotazione, rientro, nNumeri, nCombos, seed });
    } catch (e) { console.error(e); return null; }
  }, [gioco, estrazioni, pesoRec, rotazione, rientro, nNumeri, nCombos, seed]);

  if (!result) return <div style={{ padding: 24, textAlign: "center", color: "#888" }}>Servono almeno 30 estrazioni.</div>;

  const { poolFasce, benchCount, numeri, realCombos, garanzie, stelle, superstar, psize } = result;

  const giaSalvata = (combo: number[]) => { const key = [...combo].sort((a, b) => a - b).join(",");
    return bigliettiSalvati.some((b2) => [...b2.numeri].sort((a, b) => a - b).join(",") === key); };

  const salva = async (combo: number[], idx: number, tipo: "giocato" | "sistema") => {
    if (!onSalvaBiglietto) return;
    const biglietto: Biglietto = { gioco, numeri: [...combo].sort((a, b) => a - b),
      stelle: cfg.hasStars ? stelle.slice(0, cfg.starPick) : undefined, superstar: cfg.hasSuperstar ? superstar : null,
      tipo, fonte: "wheeling", somma: combo.reduce((a, b) => a + b, 0), voti: 0, data_creazione: new Date().toISOString() };
    setSalvataggio((p) => ({ ...p, [idx]: "saving" }));
    try { await onSalvaBiglietto(biglietto); setSalvataggio((p) => ({ ...p, [idx]: "done" }));
    } catch { setSalvataggio((p) => ({ ...p, [idx]: "error" })); }
  };

  const fasciaColori = ["#4A7C9E", "#5B9E7C", "#9E7C4A"];
  const fasciaNomi = ["BASSI", "MEDI", "ALTI"];
  const cellCol = (v: number) => v === 100 ? "#4A9E5C" : v >= 50 ? "#E8E8F0" : v > 0 ? "#999" : "#444";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#E8E8F0", maxWidth: 760, margin: "0 auto", padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(135deg,#7C5CFF,#A78BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {"🎯 Pool + Wheeling — " + cfg.label}
        </h2>
        <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>
          {estrazioni.length} estrazioni · pool a fasce bilanciato · copertura garantita · le garanzie sono certezze matematiche
        </p>
      </div>

      {/* CONTROLLI */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid #22223A" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", marginBottom: 10 }}>{"⚙️ Impostazioni"}</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#888" }}>Logica pool:</span>
          <button onClick={() => setRotazione(true)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: rotazione ? "1px solid #7C5CFF" : "1px solid #333", background: rotazione ? "#7C5CFF22" : "transparent", color: rotazione ? "#A78BFA" : "#888" }}>Rotazione temporizzata</button>
          <button onClick={() => setRotazione(false)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: !rotazione ? "1px solid #7C5CFF" : "1px solid #333", background: !rotazione ? "#7C5CFF22" : "transparent", color: !rotazione ? "#A78BFA" : "#888" }}>Solo frequenza</button>
        </div>

        {rotazione && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#888", minWidth: 90 }}>Rientro dopo</span>
            <input type="range" min={10} max={20} value={rientro} onChange={(e) => setRientro(parseInt(e.target.value))} style={{ flex: 1, minWidth: 120, accentColor: "#7C5CFF" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", minWidth: 60 }}>{rientro} estr.</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#888", minWidth: 90 }}>Peso recenti</span>
          <input type="range" min={1} max={4} step={0.5} value={pesoRec} onChange={(e) => setPesoRec(parseFloat(e.target.value))} style={{ flex: 1, minWidth: 120, accentColor: "#7C5CFF" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", minWidth: 60 }}>{pesoRec.toFixed(1)}×</span>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#888" }}>Numeri</span>
            <input type="range" min={7} max={20} value={nNumeri} onChange={(e) => setNNumeri(parseInt(e.target.value))} style={{ width: 100, accentColor: "#7C5CFF" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", minWidth: 24 }}>{nNumeri}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#888" }}>Combinazioni</span>
            <input type="range" min={4} max={12} value={nCombos} onChange={(e) => setNCombos(parseInt(e.target.value))} style={{ width: 90, accentColor: "#7C5CFF" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", minWidth: 44 }}>{nCombos} ({nCombos}€)</span>
          </div>
        </div>
      </div>

      {/* POOL */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid #22223A" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", marginBottom: 6 }}>Pool dinamico — {poolFasce.flat().length} numeri</div>
        {rotazione && benchCount > 0 && <div style={{ fontSize: 11, color: "#4A9E5C", marginBottom: 8 }}>{benchCount} numeri usciti nelle ultime {rientro} estrazioni: escono a rotazione. Pool a dimensione fissa completato con i rientrati.</div>}
        {poolFasce.map((fascia, fi) => (
          <div key={fi} style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: "#666", display: "inline-block", width: 46 }}>{fasciaNomi[fi]}</span>
            {fascia.map((n) => <span key={n} style={{ display: "inline-flex", width: 28, height: 28, borderRadius: "50%", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, background: fasciaColori[fi], color: "#fff", margin: 2 }}>{n}</span>)}
          </div>
        ))}
      </div>

      {/* GENERA */}
      <button onClick={() => setSeed((s) => s + 1)} style={{ width: "100%", padding: 10, fontSize: 14, fontWeight: 600, borderRadius: 8, border: "none", background: "#7C5CFF", color: "#fff", cursor: "pointer", marginBottom: 14 }}>🔄 Rigenera combinazioni</button>

      {/* COMBINAZIONI */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid #22223A" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", marginBottom: 4 }}>Le tue {realCombos.length} combinazioni</div>
        <div style={{ fontSize: 11, color: "#666", marginBottom: 10, fontFamily: "monospace" }}>Numeri: {numeri.join(" · ")}</div>
        {realCombos.map((combo, i) => { const total = combo.reduce((a, b) => a + b, 0);
          const stato = salvataggio[i] || "idle"; const salvata = giaSalvata(combo);
          return (
            <div key={i} style={{ background: "#0E0E1A", borderRadius: 10, padding: "10px 12px", marginBottom: 8, border: "1px solid #1A1A2E" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#888", minWidth: 26 }}>#{i + 1}</span>
                {combo.map((n) => (<span key={n} style={{ width: 32, height: 32, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, background: "#7C5CFF22", border: "2px solid #7C5CFF", color: "#A78BFA" }}>{n}</span>))}
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#888" }}>Σ={total}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {salvata ? <span style={{ fontSize: 11, color: "#4A9E5C", fontWeight: 600 }}>{"✓ Già salvata"}</span>
                : stato === "done" ? <span style={{ fontSize: 11, color: "#4A9E5C", fontWeight: 600 }}>{"✓ Salvata"}</span>
                : stato === "error" ? <span style={{ fontSize: 11, color: "#E2554B", fontWeight: 600 }}>Errore</span>
                : (<>
                    <button onClick={() => salva(combo, i, "giocato")} disabled={stato === "saving"} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "1px solid #4A9E5C66", background: "#4A9E5C18", color: "#5BB870", cursor: stato === "saving" ? "wait" : "pointer" }}>{stato === "saving" ? "Salvo..." : "🎫 Gioca"}</button>
                    <button onClick={() => salva(combo, i, "sistema")} disabled={stato === "saving"} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "1px solid #7C5CFF66", background: "#7C5CFF18", color: "#A78BFA", cursor: stato === "saving" ? "wait" : "pointer" }}>{stato === "saving" ? "Salvo..." : "⚙️ Sistema"}</button>
                  </>)}
              </div>
            </div>); })}
        {cfg.hasStars && <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #22223A", fontSize: 12, color: "#888" }}>{cfg.starName}: {stelle.slice(0, cfg.starPick).map((s) => <span key={s} style={{ display: "inline-flex", width: 28, height: 28, borderRadius: "50%", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, background: "#F5C51822", border: "2px solid #F5C518", color: "#F5C518", marginLeft: 6 }}>{s}</span>)}</div>}
        {cfg.hasSuperstar && superstar && <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #22223A", fontSize: 12, color: "#888" }}>SuperStar: <span style={{ display: "inline-flex", width: 28, height: 28, borderRadius: "50%", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, background: "#F5C51822", border: "2px solid #F5C518", color: "#F5C518", marginLeft: 6 }}>{superstar}</span></div>}
      </div>

      {/* GARANZIE */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid #22223A" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", marginBottom: 4 }}>Garanzie di copertura</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>Probabilità di ciascun premio in base a quanti dei tuoi {psize} numeri escono tra i {cfg.pick} estratti. Le celle al 100% (verdi) sono certezze matematiche.</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #22223A" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "#888" }}>Indovini</th>
              <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 600, color: "#888" }}>Punto 2</th>
              <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 600, color: "#888" }}>Punto 3</th>
              <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 600, color: "#888" }}>Punto 4</th>
              {cfg.pick >= 5 && <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 600, color: "#888" }}>Punto 5</th>}
            </tr>
          </thead>
          <tbody>
            {garanzie.map((g) => (
              <tr key={g.k}>
                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{g.k} su {psize}</td>
                <td style={{ textAlign: "center", padding: "6px 4px", color: cellCol(g.p2), fontWeight: g.p2 === 100 ? 700 : 400 }}>{g.p2 > 0 ? g.p2 + "%" : "–"}</td>
                <td style={{ textAlign: "center", padding: "6px 4px", color: cellCol(g.p3), fontWeight: g.p3 === 100 ? 700 : 400 }}>{g.p3 > 0 ? g.p3 + "%" : "–"}</td>
                <td style={{ textAlign: "center", padding: "6px 4px", color: cellCol(g.p4), fontWeight: g.p4 === 100 ? 700 : 400 }}>{g.p4 > 0 ? g.p4 + "%" : "–"}</td>
                {cfg.pick >= 5 && <td style={{ textAlign: "center", padding: "6px 4px", color: cellCol(g.p5), fontWeight: g.p5 === 100 ? 700 : 400 }}>{g.p5 > 0 ? g.p5 + "%" : "–"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 10, color: "#444", textAlign: "center", lineHeight: 1.6 }}>
        Il wheeling non aumenta la probabilità che i numeri escano: garantisce le vincite minori quando ne indovini abbastanza, evitando di sprecarli. Gioca responsabilmente.
      </p>
    </div>
  );
}
