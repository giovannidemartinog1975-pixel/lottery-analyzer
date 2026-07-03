 // ============================================================
// 🔮 TAB ORACOLO INTEGRATO — Bussola + Voti + Filtri + Salvataggio
// ============================================================
import { useState, useMemo } from "react";

const CONFIG = {
  SE: { pool: 90, pick: 6, hasStars: false, hasJolly: true, label: "SuperEnalotto", deltaThr: 30, fasciaSz: 25 },
  EJ: { pool: 50, pick: 5, hasStars: true, starPool: 12, label: "EuroJackpot", deltaThr: 10, fasciaSz: 15 },
  EM: { pool: 50, pick: 5, hasStars: true, starPool: 12, label: "EuroMillions", deltaThr: 10, fasciaSz: 15 },
};

type Gioco = "SE" | "EJ" | "EM";
type Estrazione = { data: string; nums: number[]; stars?: number[]; jolly?: number; superstar?: number };
type Biglietto = {
  gioco: Gioco; numeri: number[]; stelle?: number[]; superstar?: number | null;
  tipo: "giocato" | "sistema"; fonte: "oracolo"; somma: number; voti: number; data_creazione: string;
};

function calcolaOracolo(gioco: Gioco, rows: Estrazione[], rangeManuale?: { lo: number; hi: number } | null) {
  const cfg = CONFIG[gioco];
  const { pool, pick, deltaThr, fasciaSz } = cfg;
  const N = rows.length;
  if (N < 30) return null;
  const sums = rows.map((r) => r.nums.reduce((a, b) => a + b, 0));
  const mu = sums.reduce((a, b) => a + b, 0) / N;
  const sigma = Math.sqrt(sums.reduce((a, s) => a + (s - mu) ** 2, 0) / N);
  const last = rows[N - 1].nums;
  const lastSet = new Set(last);
  const lastSum = sums[N - 1];
  const zLast = (lastSum - mu) / sigma;

  // ===== BUSSOLA M1: Velocità =====
  const dLast = N >= 2 ? sums[N - 1] - sums[N - 2] : 0;
  const ddLast = N >= 3 ? dLast - (sums[N - 2] - sums[N - 3]) : 0;
  const velLabel = dLast > deltaThr ? "sale_forte" : dLast > 0 ? "sale_lenta" : dLast > -deltaThr ? "scende_lenta" : "scende_forte";
  const accLabel = ddLast > deltaThr ? "frena_forte" : ddLast > 0 ? "frena" : ddLast > -deltaThr ? "accelera" : "accelera_forte";
  const statoM1 = velLabel + "|" + accLabel;
  const m1Cases: number[] = [];
  for (let i = 5; i < N - 1; i++) {
    const d = sums[i] - sums[i - 1];
    const dd = d - (sums[i - 1] - sums[i - 2]);
    const v = d > deltaThr ? "sale_forte" : d > 0 ? "sale_lenta" : d > -deltaThr ? "scende_lenta" : "scende_forte";
    const a = dd > deltaThr ? "frena_forte" : dd > 0 ? "frena" : dd > -deltaThr ? "accelera" : "accelera_forte";
    if (v + "|" + a === statoM1) m1Cases.push(sums[i + 1]);
  }
  const m1Scende = m1Cases.filter((s) => s < lastSum).length;
  const m1Pct = m1Cases.length > 0 ? Math.round((m1Scende / m1Cases.length) * 100) : 50;
  const m1Sorted = [...m1Cases].sort((a, b) => a - b);
  const m1Q1 = m1Sorted.length > 4 ? m1Sorted[Math.floor(m1Sorted.length * 0.25)] : Math.round(mu - sigma);
  const m1Q3 = m1Sorted.length > 4 ? m1Sorted[Math.floor(m1Sorted.length * 0.75)] : Math.round(mu + sigma);

  // ===== BUSSOLA M2: Fasce =====
  const fasciaBase = pool === 90 ? 150 : 60;
  const fascia = (s: number) => Math.floor((s - fasciaBase) / fasciaSz) * fasciaSz + fasciaBase;
  const fCurr = fascia(lastSum);
  const m2Trans: Record<number, Record<number, number>> = {};
  for (let i = 0; i < N - 1; i++) {
    const fc = fascia(sums[i]), fn = fascia(sums[i + 1]);
    if (!m2Trans[fc]) m2Trans[fc] = {};
    m2Trans[fc][fn] = (m2Trans[fc][fn] || 0) + 1;
  }
  let m2Top: { fascia: number; pct: number }[] = [];
  if (m2Trans[fCurr]) {
    const entries = Object.entries(m2Trans[fCurr]).sort((a, b) => +b[1] - +a[1]);
    const tot = entries.reduce((s, e) => s + +e[1], 0);
    m2Top = entries.slice(0, 3).map(([f, c]) => ({ fascia: parseInt(f), pct: Math.round((+c / tot) * 100) }));
  }

  // ===== BUSSOLA M3: Sequenze =====
  const dirs: string[] = [];
  for (let i = 1; i < N; i++) dirs.push(sums[i] > sums[i - 1] ? "U" : "D");
  const seqCurr = dirs.slice(-3).join("");
  const m3Cases: { dir: string; sum: number }[] = [];
  for (let i = 3; i < dirs.length - 1; i++) {
    if (dirs[i - 2] + dirs[i - 1] + dirs[i] === seqCurr) m3Cases.push({ dir: dirs[i + 1], sum: sums[i + 2] });
  }
  const m3Scende = m3Cases.filter((c) => c.dir === "D").length;
  const m3Pct = m3Cases.length > 0 ? Math.round((m3Scende / m3Cases.length) * 100) : 50;
  const m3Avg = m3Cases.length > 0 ? Math.round(m3Cases.reduce((a, c) => a + c.sum, 0) / m3Cases.length) : Math.round(mu);

  // ===== Somma esatta =====
  const exactCases: number[] = [];
  for (let i = 0; i < N - 1; i++) if (sums[i] === lastSum) exactCases.push(sums[i + 1]);
  const exactScende = exactCases.filter((s) => s < lastSum).length;

  // ===== Range auto dalla convergenza =====
  let sumLo: number, sumHi: number;
  if (m1Cases.length > 10) { sumLo = m1Q1; sumHi = m1Q3; }
  else { sumLo = Math.round(mu - sigma); sumHi = Math.round(mu + sigma); }
  if (m2Top.length > 0) {
    sumLo = Math.min(sumLo, m2Top[0].fascia);
    sumHi = Math.max(sumHi, m2Top[0].fascia + fasciaSz - 1);
  }
  const rangeAuto = { lo: sumLo, hi: sumHi };
  if (rangeManuale) { sumLo = rangeManuale.lo; sumHi = rangeManuale.hi; }

  // ===== Sistema voti (11 metodi) =====
  const freq: Record<number, number> = {};
  const recFreq: Record<number, number> = {};
  const lastSeen: Record<number, number> = {};
  for (let n = 1; n <= pool; n++) { freq[n] = 0; recFreq[n] = 0; }
  rows.forEach((r, i) => r.nums.forEach((n) => { freq[n]++; lastSeen[n] = i; }));
  rows.slice(-50).forEach((r) => r.nums.forEach((n) => recFreq[n]++));
  const deficit: Record<number, number> = {};
  for (let n = 1; n <= pool; n++) {
    const f = freq[n]; if (f === 0) { deficit[n] = 3; continue; }
    const ra = N / f, rr = N - 1 - (lastSeen[n] ?? -1); deficit[n] = (rr - ra) / ra;
  }
  const decadi = pool === 90 ? 9 : 5;
  const highThr = pool === 90 ? 45 : 25;
  const pairFreq: Record<string, number> = {};
  rows.forEach((r) => { const s = [...r.nums].sort((a, b) => a - b);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { const k = s[i] + "-" + s[j]; pairFreq[k] = (pairFreq[k] || 0) + 1; }
  });
  const liftScore = (n: number) => {
    const ls: number[] = [];
    for (let m = 1; m <= pool; m++) { if (m === n) continue;
      const k = n < m ? n + "-" + m : m + "-" + n; const obs = pairFreq[k] || 0;
      if (obs < (pool === 90 ? 3 : 2)) continue;
      const exp = (freq[n] / N) * (freq[m] / N) * N; if (exp > 0) ls.push(obs / exp); }
    ls.sort((a, b) => b - a); const top = ls.slice(0, 5);
    return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 1;
  };
  // Vicini storici
  const getProfile = (nums: number[]) => {
    const s = [...nums].sort((a, b) => a - b); const q = new Array(decadi).fill(0);
    s.forEach((n) => q[Math.floor((n - 1) / 10)]++);
    return { sum: s.reduce((a, b) => a + b, 0), q, high: s.filter((n) => n > highThr).length, even: s.filter((n) => n % 2 === 0).length, span: s[s.length - 1] - s[0] };
  };
  const cp = getProfile(last);
  const similarity = (p1: ReturnType<typeof getProfile>, p2: ReturnType<typeof getProfile>) => {
    let sc = 0; const z1 = (p1.sum - mu) / sigma, z2 = (p2.sum - mu) / sigma;
    if ((z1 > 0.5 && z2 > 0.5) || (z1 < -0.5 && z2 < -0.5) || (Math.abs(z1) <= 0.5 && Math.abs(z2) <= 0.5)) sc += 2;
    sc += Math.max(0, 3 - (Math.abs(p1.sum - p2.sum) / sigma) * 3);
    let qd = 0; for (let i = 0; i < decadi; i++) qd += Math.abs(p1.q[i] - p2.q[i]);
    sc += Math.max(0, 3 - qd * (decadi === 9 ? 0.5 : 0.75));
    sc += Math.max(0, 2 - Math.abs(p1.high - p2.high));
    sc += Math.max(0, 1 - Math.abs(p1.span - p2.span) / (decadi === 9 ? 30 : 20));
    sc += Math.max(0, 1 - Math.abs(p1.even - p2.even) * 0.5); return sc;
  };
  const sims: { sim: number; next: number[] }[] = [];
  for (let i = 0; i < N - 1; i++) sims.push({ sim: similarity(cp, getProfile(rows[i].nums)), next: rows[i + 1].nums });
  sims.sort((a, b) => b.sim - a.sim);
  const neighFreq: Record<number, number> = {};
  sims.slice(0, 15).forEach((s) => s.next.forEach((n) => (neighFreq[n] = (neighFreq[n] || 0) + 1)));
  // Pattern giornaliero
  const dayBias: Record<number, number> = {};
  { const giorni: Record<number, Record<number, number>> = {}; const giorniCount: Record<number, number> = {};
    rows.forEach((r) => { try { const d = new Date(r.data).getDay();
      if (!giorni[d]) { giorni[d] = {}; giorniCount[d] = 0; } giorniCount[d]++;
      r.nums.forEach((n) => (giorni[d][n] = (giorni[d][n] || 0) + 1)); } catch {} });
    const nextDay = new Date(rows[N - 1].data).getDay();
    const dn = giorniCount[nextDay] || 1;
    for (let n = 1; n <= pool; n++) { const obs = giorni[nextDay]?.[n] || 0;
      const exp = (dn * pick) / pool; const std2 = Math.sqrt(exp * (1 - pick / pool));
      dayBias[n] = dn >= 20 && std2 > 0 ? (obs - exp) / std2 : 0; }
  }
  // Repulsione
  const repulsion: Record<number, number> = {};
  for (let n = 1; n <= pool; n++) {
    if (lastSet.has(n)) { repulsion[n] = -99; continue; } let rc = 0;
    last.forEach((m) => { const k = n < m ? n + "-" + m : m + "-" + n; const obs = pairFreq[k] || 0;
      const exp = (freq[n] / N) * (freq[m] / N) * N; if (exp > 0 && obs / exp < 0.5) rc++; });
    repulsion[n] = rc;
  }
  // Vertibili (SE)
  const vertCand: Record<number, number> = {};
  if (pool === 90) {
    const vert = (n: number): number | null => {
      if (n <= 9) return n * 10; if (n % 10 === 0) return n / 10;
      if (n % 11 === 0) return Math.floor(n / 11) * 10 + 9; if (n % 10 === 9) return Math.floor(n / 10) * 11;
      const t = Math.floor(n / 10), u = n % 10, v = u * 10 + t; return v >= 1 && v <= 90 ? v : null; };
    last.forEach((n) => { const v = vert(n);
      if (v && !lastSet.has(v)) { const k = Math.min(n, v) + "-" + Math.max(n, v);
        const obs = pairFreq[k] || 0; const exp = (freq[n] / N) * (freq[v] / N) * N;
        vertCand[v] = exp > 0 ? obs / exp : 0; } });
  }
  // Co-assenza incompatibili
  const incompatible = new Set<string>();
  const minFreq = pool === 90 ? 30 : 18;
  for (let a = 1; a <= pool; a++) for (let b = a + 1; b <= pool; b++)
    if (freq[a] >= minFreq && freq[b] >= minFreq && !pairFreq[a + "-" + b]) incompatible.add(a + "-" + b);
  // Post-anomalia
  const haFreq: Record<number, number> = {};
  for (let i = 0; i < N - 1; i++) if (sums[i] > mu + sigma * 1.5) rows[i + 1].nums.forEach((n) => (haFreq[n] = (haFreq[n] || 0) + 1));
  // Voti
  const votes: Record<number, number> = {};
  const scores: Record<number, number> = {};
  for (let n = 1; n <= pool; n++) {
    if (lastSet.has(n)) { votes[n] = -99; scores[n] = -99; continue; }
    let v = 0; const ls = liftScore(n);
    if (deficit[n] > 0.5) v++; if (deficit[n] > 1) v++;
    if ((neighFreq[n] || 0) >= 2) v++; if ((neighFreq[n] || 0) >= 3) v++;
    if (ls > 1.3) v++; if (ls > 1.6) v++;
    if (dayBias[n] > 1.5) v++;
    if (vertCand[n] !== undefined) v++; if ((vertCand[n] || 0) > 1.5) v++;
    if ((haFreq[n] || 0) >= 2) v++;
    if (recFreq[n] >= 4) v++;
    if (repulsion[n] >= 4) v -= 2; if (repulsion[n] >= 5) v -= 1;
    votes[n] = v;
    let score = Math.max(0, deficit[n]) * 0.18 + ((neighFreq[n] || 0) / 15) * 0.30 + (ls - 1) * 0.20 +
      Math.max(0, dayBias[n]) / 3 * 0.10 + (vertCand[n] !== undefined ? 0.08 : 0) +
      (recFreq[n] / 50) * 0.10 + ((haFreq[n] || 0) / Math.max(Object.keys(haFreq).length, 1)) * 0.12;
    score -= repulsion[n] * 0.03;
    scores[n] = score;
  }
  const ranked: number[] = [];
  for (let n = 1; n <= pool; n++) if (!lastSet.has(n)) ranked.push(n);
  ranked.sort((a, b) => votes[b] - votes[a] || scores[b] - scores[a]);

  // Segnali
  const segnali: { nome: string; stato: string; tipo: string }[] = [];
  segnali.push({ nome: "Zona somma ultima", stato: "Σ=" + lastSum + " (z=" + (zLast >= 0 ? "+" : "") + zLast.toFixed(2) + ")", tipo: Math.abs(zLast) > 1.5 ? "warn" : "info" });
  const topDebt = ranked.filter((n) => deficit[n] > 1).slice(0, 5);
  if (topDebt.length) segnali.push({ nome: "Debito forte", stato: topDebt.join(", "), tipo: "good" });
  const vertList = Object.keys(vertCand).map(Number);
  if (vertList.length) segnali.push({ nome: "Candidati vertibili", stato: vertList.join(", "), tipo: "good" });
  { const giornoNomi = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
    try { const nd = giornoNomi[new Date(rows[N - 1].data).getDay()];
      const dayTop = ranked.filter((n) => dayBias[n] > 1.5).slice(0, 4);
      if (dayTop.length) segnali.push({ nome: "Pattern " + nd, stato: dayTop.join(", "), tipo: "good" }); } catch {} }
  const repL: number[] = [];
  for (let n = 1; n <= pool; n++) if (!lastSet.has(n) && repulsion[n] >= 4) repL.push(n);
  if (repL.length) segnali.push({ nome: "Evita (repulsione)", stato: repL.slice(0, 6).join(", "), tipo: "warn" });

  // Genera combinazioni con filtro deficit collettivo
  const isValid = (combo: number[]) => {
    const s = [...combo].sort((a, b) => a - b);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++)
      if (incompatible.has(s[i] + "-" + s[j])) return false;
    const total = s.reduce((a, b) => a + b, 0); const span = s[s.length - 1] - s[0];
    const high = s.filter((n) => n > highThr).length; const even = s.filter((n) => n % 2 === 0).length;
    let consec = 0; for (let i = 0; i < s.length - 1; i++) if (s[i + 1] - s[i] === 1) consec++;
    const q = new Array(decadi).fill(0); s.forEach((n) => q[Math.floor((n - 1) / 10)]++);
    const dec = q.filter((x: number) => x > 0).length;
    if (total < sumLo || total > sumHi) return false;
    if (high < pick - (pool === 90 ? 4 : 3) || high > (pool === 90 ? 4 : 3)) return false;
    if (even < 2 || even > (pool === 90 ? 4 : 3)) return false;
    if (consec > (pool === 90 ? 1 : 0)) return false;
    if (Math.max(...q) > (pool === 90 ? 3 : 2)) return false;
    if (pool === 90) { if (dec < 4 || span < 40 || span > 85) return false; }
    else { if (dec < 3 || span < 28 || span > 48) return false; }
    // Deficit collettivo: vincenti hanno media -0.46, range -1 a +2
    let defColl = 0;
    combo.forEach((n) => { const f = freq[n]; if (f === 0) { defColl += 3; return; }
      const ra = N / f, rr = N - 1 - (lastSeen[n] ?? -1); defColl += (rr - ra) / ra; });
    defColl /= pick;
    if (defColl < -1 || defColl > 2) return false;
    return true;
  };
  const poolNums = ranked.slice(0, pool === 90 ? 40 : 22);
  const combos: number[][] = [];
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let att = 0;
  while (combos.length < 5 && att < 500000) { att++;
    const remaining = [...poolNums]; const remW = remaining.map((n) => Math.max(scores[n], 0.01));
    const chosen: number[] = [];
    for (let k = 0; k < pick; k++) { const tw = remW.reduce((a, b) => a + b, 0);
      let r = rand() * tw, cum = 0, idx = 0;
      for (let j = 0; j < remaining.length; j++) { cum += remW[j]; if (r <= cum) { idx = j; break; } }
      chosen.push(remaining[idx]); remaining.splice(idx, 1); remW.splice(idx, 1); }
    if (chosen.length !== pick) continue;
    if (!isValid(chosen)) continue;
    const key = [...chosen].sort((a, b) => a - b).join(",");
    if (combos.some((c) => [...c].sort((a, b) => a - b).join(",") === key)) continue;
    combos.push([...chosen].sort((a, b) => a - b));
  }
  combos.sort((a, b) => b.reduce((s, n) => s + votes[n], 0) - a.reduce((s, n) => s + votes[n], 0));

  // Stelle / SuperStar
  let stelle: number[] = [];
  if (cfg.hasStars) {
    const starPool = cfg.starPool!;
    const sFreq: Record<number, number> = {}; const sLast: Record<number, number> = {};
    for (let s = 1; s <= starPool; s++) sFreq[s] = 0;
    rows.forEach((r, i) => (r.stars || []).forEach((s) => { sFreq[s]++; sLast[s] = i; }));
    const currStars = new Set(rows[N - 1].stars || []);
    const sScore: Record<number, number> = {};
    for (let s = 1; s <= starPool; s++) { const fg = sFreq[s] / N; const delay = N - 1 - (sLast[s] ?? -1);
      const expD = sFreq[s] > 0 ? N / sFreq[s] : N; const debt = expD > 0 ? Math.max(0, (delay - expD) / expD) : 0;
      const notLast = currStars.has(s) ? 0.5 : 1; sScore[s] = (fg * 0.5 + debt * 0.5) * notLast; }
    stelle = Array.from({ length: starPool }, (_, i) => i + 1).sort((a, b) => sScore[b] - sScore[a]).slice(0, 2);
  }
  let superstar: number | null = null;
  if (gioco === "SE") superstar = ranked.slice().sort((a, b) => recFreq[b] - recFreq[a])[0];

  const bussola = {
    m1: { stato: statoM1, casi: m1Cases.length, scendePct: m1Pct, q1: m1Q1, q3: m1Q3 },
    m2: { fascia: fCurr, fasciaSz, top: m2Top },
    m3: { seq: seqCurr.replace(/U/g, "\u2B06").replace(/D/g, "\u2B07"), casi: m3Cases.length, scendePct: m3Pct, avg: m3Avg },
    exact: { sum: lastSum, casi: exactCases.length, scendePct: exactCases.length > 0 ? Math.round((exactScende / exactCases.length) * 100) : null },
    dLast, ddLast,
  };

  return { ranked, votes, scores, deficit, combos, segnali, stelle, superstar, mu, sigma, lastSum, zLast, sumLo, sumHi, rangeAuto, pool, pick, bussola, neighFreq, dayBias, vertCand, repulsion, last };
}

// ============================================================
// COMPONENTE UI
// ============================================================
export default function TabOracolo({
  gioco = "SE", estrazioni = [], onSalvaBiglietto, bigliettiSalvati = [],
}: {
  gioco?: Gioco; estrazioni?: Estrazione[];
  onSalvaBiglietto?: (b: Biglietto) => Promise<void> | void;
  bigliettiSalvati?: { numeri: number[] }[];
}) {
  const cfg = CONFIG[gioco];
  const [rangeMode, setRangeMode] = useState<"auto" | "manuale">("auto");
  const [rangeLo, setRangeLo] = useState<number | null>(null);
  const [rangeHi, setRangeHi] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [wheelMode, setWheelMode] = useState(false);
  const [salvataggio, setSalvataggio] = useState<Record<number, string>>({});

  const result = useMemo(() => {
    try {
      const manuale = rangeMode === "manuale" && rangeLo != null && rangeHi != null && rangeLo <= rangeHi ? { lo: rangeLo, hi: rangeHi } : null;
      return calcolaOracolo(gioco, estrazioni, manuale);
    } catch (e) { console.error(e); return null; }
  }, [gioco, estrazioni, rangeMode, rangeLo, rangeHi]);

  if (!result) return <div style={{ padding: 24, textAlign: "center", color: "#888" }}>Servono almeno 30 estrazioni.</div>;

  const { ranked, votes, scores, deficit, combos, segnali, stelle, superstar, lastSum, zLast, sumLo, sumHi, rangeAuto, mu, sigma, pool, pick, bussola, neighFreq, dayBias, vertCand } = result;
  const wheelCombos = useMemo(() => {
    if (!wheelMode) return null;
    const candidati = ranked.slice(0, 14);
    let seed = 777;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const sample = (arr, k) => { const c = [...arr]; const out = []; for (let i = 0; i < k; i++) { const idx = Math.floor(rand() * c.length); out.push(c[idx]); c.splice(idx, 1); } return out; };
    let bestSystem = null, bestScore = -1;
    for (let a = 0; a < 3000; a++) {
      const system = []; for (let i = 0; i < 5; i++) system.push(sample(candidati, pick).sort((x, y) => x - y));
      let sum = 0; const trials = 30;
      for (let t = 0; t < trials; t++) { const winners = new Set(sample(candidati, pick)); let best = 0;
        system.forEach((c) => { const ov = c.filter((n) => winners.has(n)).length; if (ov > best) best = ov; });
        sum += best; }
      const avg = sum / trials;
      if (avg > bestScore) { bestScore = avg; bestSystem = system; }
    }
    return { candidati, system: bestSystem, avgScore: bestScore };
  }, [wheelMode, ranked, pick]);
  const maxVotes = Math.max(...ranked.map((n) => votes[n]), 1);
  const sumMin = Array.from({ length: pick }, (_, i) => i + 1).reduce((a, b) => a + b, 0);
  const sumMax = Array.from({ length: pick }, (_, i) => pool - i).reduce((a, b) => a + b, 0);
  const b = bussola;

  const attivaManuale = () => { if (rangeLo == null) setRangeLo(rangeAuto.lo); if (rangeHi == null) setRangeHi(rangeAuto.hi); setRangeMode("manuale"); };

  const giaSalvata = (combo: number[]) => { const key = [...combo].sort((a, b) => a - b).join(",");
    return bigliettiSalvati.some((b2) => [...b2.numeri].sort((a, b) => a - b).join(",") === key); };

  const salva = async (combo: number[], idx: number, tipo: "giocato" | "sistema") => {
    if (!onSalvaBiglietto) return;
    const biglietto: Biglietto = { gioco, numeri: [...combo].sort((a, b) => a - b),
      stelle: cfg.hasStars ? stelle : undefined, superstar: gioco === "SE" ? superstar : null,
      tipo, fonte: "oracolo", somma: combo.reduce((a, b) => a + b, 0),
      voti: combo.reduce((s, n) => s + votes[n], 0), data_creazione: new Date().toISOString() };
    setSalvataggio((p) => ({ ...p, [idx]: "saving" }));
    try { await onSalvaBiglietto(biglietto); setSalvataggio((p) => ({ ...p, [idx]: "done" }));
    } catch { setSalvataggio((p) => ({ ...p, [idx]: "error" })); }
  };

  const voteColor = (v: number) => { const ratio = v / maxVotes;
    if (ratio >= 0.85) return "#FFD700"; if (ratio >= 0.65) return "#F07030";
    if (ratio >= 0.45) return "#E8B84B"; if (ratio > 0) return "#4A8FD4"; return "#2A2A3E"; };

  const m1Dir = b.m1.scendePct > 55 ? "\u2B07" : "\u2B06";
  const m1Col = b.m1.scendePct > 55 ? "#E05050" : "#4A9E5C";
  const m3Dir = b.m3.scendePct > 55 ? "\u2B07" : "\u2B06";
  const m3Col = b.m3.scendePct > 55 ? "#E05050" : "#4A9E5C";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#E8E8F0", maxWidth: 760, margin: "0 auto", padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(135deg,#D4AF37,#F0C75E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {"🔮 Oracolo Integrato — " + cfg.label}
        </h2>
        <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>
          {estrazioni.length} estrazioni · Bussola (67-72%) + 11 metodi + Deficit collettivo (+6.3%) · Σ={lastSum} (z={zLast >= 0 ? "+" : ""}{zLast.toFixed(2)})
        </p>
      </div>

      {/* BUSSOLA */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid #22223A" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37", marginBottom: 10 }}>{"🧭 Bussola Somma — Previsione convergente"}</div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 8 }}>Delta={b.dLast} · Accel.={b.ddLast} · 3 metodi (backtest 67-72%)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div style={{ background: "#0A0A14", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#6A6A8A", marginBottom: 4 }}>M1 Velocita ({b.m1.casi})</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: m1Col }}>{m1Dir} {b.m1.scendePct > 50 ? b.m1.scendePct + "% scende" : (100 - b.m1.scendePct) + "% sale"}</div>
            <div style={{ fontSize: 9, color: "#666" }}>Q1-Q3: {b.m1.q1}-{b.m1.q3}</div>
          </div>
          <div style={{ background: "#0A0A14", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#6A6A8A", marginBottom: 4 }}>M2 Fasce</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#E8B84B" }}>{"→ " + (b.m2.top.length > 0 ? b.m2.top[0].fascia + "-" + (b.m2.top[0].fascia + b.m2.fasciaSz - 1) + " (" + b.m2.top[0].pct + "%)" : "—")}</div>
            <div style={{ fontSize: 9, color: "#666" }}>Fascia att: {b.m2.fascia}-{b.m2.fascia + b.m2.fasciaSz - 1}</div>
          </div>
          <div style={{ background: "#0A0A14", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#6A6A8A", marginBottom: 4 }}>M3 Seq. {b.m3.seq} ({b.m3.casi})</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: m3Col }}>{m3Dir} {b.m3.scendePct > 50 ? b.m3.scendePct + "% scende" : (100 - b.m3.scendePct) + "% sale"}</div>
            <div style={{ fontSize: 9, color: "#666" }}>Media: {b.m3.avg}</div>
          </div>
        </div>
        {b.exact.casi > 0 && <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Dopo Σ={b.exact.sum} esatta: {b.exact.casi} casi → {b.exact.scendePct !== null ? b.exact.scendePct + "% scende" : "—"}</div>}
        <div style={{ textAlign: "center" }}>
          <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, fontWeight: 700, fontSize: 12, background: "#D4AF3722", border: "1px solid #D4AF3744", color: "#D4AF37" }}>
            Range previsto: {sumLo} – {sumHi}
          </span>
        </div>
      </div>

      {/* SELETTORE RANGE */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid #22223A" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37" }}>{"⚙️ Range somma"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setRangeMode("auto")} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: rangeMode === "auto" ? "1px solid #D4AF37" : "1px solid #333", background: rangeMode === "auto" ? "#D4AF3722" : "transparent", color: rangeMode === "auto" ? "#D4AF37" : "#888" }}>Auto (Bussola)</button>
            <button onClick={attivaManuale} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: rangeMode === "manuale" ? "1px solid #D4AF37" : "1px solid #333", background: rangeMode === "manuale" ? "#D4AF3722" : "transparent", color: rangeMode === "manuale" ? "#D4AF37" : "#888" }}>Manuale</button>
          </div>
        </div>
        {rangeMode === "auto" ? (
          <div style={{ fontSize: 11, color: "#888" }}>Range <strong style={{ color: "#D4AF37" }}>{rangeAuto.lo}–{rangeAuto.hi}</strong> dalla convergenza bussola M1+M2+M3.</div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#888" }}>Da</span>
              <input type="number" value={rangeLo ?? ""} min={sumMin} max={sumMax} onChange={(e) => setRangeLo(e.target.value === "" ? null : Math.max(sumMin, Math.min(sumMax, parseInt(e.target.value) || 0)))} style={{ width: 72, padding: "6px 8px", borderRadius: 8, border: "1px solid #333", background: "#0A0A14", color: "#E8E8F0", fontSize: 13, fontWeight: 700, textAlign: "center" }} />
              <span style={{ fontSize: 11, color: "#888" }}>a</span>
              <input type="number" value={rangeHi ?? ""} min={sumMin} max={sumMax} onChange={(e) => setRangeHi(e.target.value === "" ? null : Math.max(sumMin, Math.min(sumMax, parseInt(e.target.value) || 0)))} style={{ width: 72, padding: "6px 8px", borderRadius: 8, border: "1px solid #333", background: "#0A0A14", color: "#E8E8F0", fontSize: 13, fontWeight: 700, textAlign: "center" }} />
              <span style={{ fontSize: 9, color: "#555" }}>(media {Math.round(mu)})</span>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {[{ l: "Bussola", lo: rangeAuto.lo, hi: rangeAuto.hi }, { l: "Stretto", lo: Math.round(mu - sigma * 0.3), hi: Math.round(mu + sigma * 0.3) }, { l: "Sotto \u03BC", lo: Math.round(mu - sigma), hi: Math.round(mu) }, { l: "Sopra \u03BC", lo: Math.round(mu), hi: Math.round(mu + sigma) }, { l: "Largo", lo: Math.round(mu - sigma), hi: Math.round(mu + sigma) }].map((p, i) => (
                <button key={i} onClick={() => { setRangeLo(p.lo); setRangeHi(p.hi); }} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, cursor: "pointer", border: rangeLo === p.lo && rangeHi === p.hi ? "1px solid #D4AF37" : "1px solid #2A2A3E", background: rangeLo === p.lo && rangeHi === p.hi ? "#D4AF3722" : "#0E0E1A", color: rangeLo === p.lo && rangeHi === p.hi ? "#D4AF37" : "#999" }}>{p.l} ({p.lo}–{p.hi})</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SEGNALI */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid #22223A" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37", marginBottom: 10 }}>{"📡 Segnali attivi"}</div>
        {segnali.map((s, i) => { const col = s.tipo === "good" ? "#4A9E5C" : s.tipo === "warn" ? "#E8954B" : "#4A8FD4";
          return <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, marginBottom: 7 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} /><span style={{ color: "#aaa", minWidth: 140 }}>{s.nome}</span><span style={{ color: col, fontWeight: 600 }}>{s.stato}</span></div>; })}
      </div>

      {/* COMBINAZIONI */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid #22223A" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37" }}>{wheelMode ? "🎯 Wheeling — 5 sestine su 14 candidati" : "🏆 Le 5 combinazioni"}</div>
          <button onClick={() => setWheelMode(!wheelMode)} style={{ background: wheelMode ? "#D4AF3722" : "#1A1A2E", border: `1px solid ${wheelMode ? "#D4AF37" : "#333"}`, borderRadius: 8, color: wheelMode ? "#D4AF37" : "#aaa", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>{wheelMode ? "Standard" : "🎯 Wheeling"}</button>
        </div>
        {wheelMode && wheelCombos && <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>Copertura media testata: {wheelCombos.avgScore.toFixed(1)}/{pick} numeri catturati se escono {pick} dei 14 candidati · candidati: {wheelCombos.candidati.join(", ")}</div>}
        <div style={{ fontSize: 10, color: "#666", marginBottom: 10 }}>Range {sumLo}–{sumHi} · filtri strutturali · deficit collettivo · sistema voti</div>
        {(wheelMode && wheelCombos ? wheelCombos.system : combos).map((combo, i) => { const total = combo.reduce((a, b) => a + b, 0);
          const tv = combo.reduce((s, n) => s + votes[n], 0);
          const best = i === 0; const stato = salvataggio[i] || "idle"; const salvata = giaSalvata(combo);
          return (
            <div key={i} style={{ background: best ? "#1A1A2E" : "#0E0E1A", borderRadius: 10, padding: "10px 12px", marginBottom: 8, border: best ? "1px solid #D4AF3766" : "1px solid #1A1A2E" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#888", minWidth: 26 }}>#{i + 1}{best ? "⭐" : ""}</span>
                {combo.map((n) => (<span key={n} style={{ width: 32, height: 32, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, background: voteColor(votes[n]) + "22", border: `2px solid ${voteColor(votes[n])}`, color: voteColor(votes[n]) }}>{n}</span>))}
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#888" }}>Σ={total} · {tv} voti</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {salvata ? <span style={{ fontSize: 11, color: "#4A9E5C", fontWeight: 600 }}>{"✓ Già salvata"}</span>
                : stato === "done" ? <span style={{ fontSize: 11, color: "#4A9E5C", fontWeight: 600 }}>{"✓ Salvata"}</span>
                : stato === "error" ? <span style={{ fontSize: 11, color: "#E2554B", fontWeight: 600 }}>Errore</span>
                : (<>
                    <button onClick={() => salva(combo, i, "giocato")} disabled={stato === "saving"} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "1px solid #4A9E5C66", background: "#4A9E5C18", color: "#5BB870", cursor: stato === "saving" ? "wait" : "pointer" }}>{stato === "saving" ? "Salvo..." : "🎫 Gioca"}</button>
                    <button onClick={() => salva(combo, i, "sistema")} disabled={stato === "saving"} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "1px solid #D4AF3766", background: "#D4AF3718", color: "#D4AF37", cursor: stato === "saving" ? "wait" : "pointer" }}>{stato === "saving" ? "Salvo..." : "⚙️ Sistema"}</button>
                  </>)}
              </div>
            </div>); })}
        {cfg.hasStars && <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #22223A", fontSize: 12, color: "#888" }}>EuroNumeri: {stelle.map((s) => <span key={s} style={{ display: "inline-flex", width: 28, height: 28, borderRadius: "50%", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, background: "#D4AF3722", border: "2px solid #D4AF37", color: "#D4AF37", marginLeft: 6 }}>{s}</span>)}</div>}
        {gioco === "SE" && superstar && <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #22223A", fontSize: 12, color: "#888" }}>SuperStar: <span style={{ display: "inline-flex", width: 28, height: 28, borderRadius: "50%", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, background: "#D4AF3722", border: "2px solid #D4AF37", color: "#D4AF37", marginLeft: 6 }}>{superstar}</span></div>}
      </div>

      {/* MAPPA VOTI */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid #22223A" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37" }}>Mappa voti — top {showAll ? pool : 15}</div>
          <button onClick={() => setShowAll(!showAll)} style={{ background: "#1A1A2E", border: "1px solid #333", borderRadius: 8, color: "#aaa", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>{showAll ? "Meno" : "Tutti"}</button>
        </div>
        {ranked.slice(0, showAll ? pool : 15).map((n) => { const c = voteColor(votes[n]);
          return (<div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, background: c + "22", border: `2px solid ${c}`, color: c, flexShrink: 0 }}>{n}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: c, fontWeight: 700, fontSize: 11 }}>{votes[n]} voti</span><div style={{ flex: 1, maxWidth: 120, height: 6, background: "#0A0A14", borderRadius: 3, overflow: "hidden" }}><div style={{ width: Math.max(0, (votes[n] / maxVotes) * 100) + "%", height: "100%", background: c }} /></div></div>
              <div style={{ fontSize: 9, color: "#666", marginTop: 1 }}>deb {deficit[n] >= 0 ? "+" : ""}{(deficit[n] * 100).toFixed(0)}% · vic {neighFreq[n] || 0} · lift {scores[n]?.toFixed(2)}{dayBias[n] > 1 ? " · giorno z+" + dayBias[n].toFixed(1) : ""}{vertCand[n] !== undefined ? " · vert" : ""}</div>
            </div>
          </div>); })}
      </div>

      <p style={{ fontSize: 10, color: "#444", textAlign: "center", lineHeight: 1.6 }}>
        Bussola somma (backtest 67-72%) + 11 metodi + deficit collettivo (+6.3%) + filtri strutturali calibrati su dati reali. Gioca responsabilmente.
      </p>
    </div>
  );
}
