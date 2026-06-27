// ============================================================
// 🔮 TAB ORACOLO — Sistema di voti unificato
// Integra tutti gli 11 metodi analitici per SE / EJ / EM
// ============================================================
//
// USO: importa <TabOracolo gioco="SE" estrazioni={dati} />
//   - gioco: "SE" | "EJ" | "EM"
//   - estrazioni: array di { data: string, nums: number[], stars?: number[], jolly?: number, superstar?: number }
//     ordinato dal più vecchio al più recente
//
// Il componente calcola TUTTO al volo e produce un responso unico.
// ============================================================

import { useState, useMemo } from "react";

// ---------- CONFIGURAZIONE PER GIOCO ----------
const CONFIG = {
  SE: { pool: 90, pick: 6, mu: 272.5, sigma: 63.7, hasStars: false, hasJolly: true, label: "SuperEnalotto" },
  EJ: { pool: 50, pick: 5, mu: 137.5, sigma: 17.2, hasStars: true, starPool: 12, label: "EuroJackpot" },
  EM: { pool: 50, pick: 5, mu: 140.9, sigma: 13.9, hasStars: true, starPool: 12, label: "EuroMillions" },
};

type Gioco = "SE" | "EJ" | "EM";
type Estrazione = { data: string; nums: number[]; stars?: number[]; jolly?: number; superstar?: number };

// ============================================================
// MOTORE DI CALCOLO — tutti gli 11 metodi
// ============================================================
function calcolaOracolo(gioco: Gioco, rows: Estrazione[], rangeManuale?: { lo: number; hi: number } | null) {
  const cfg = CONFIG[gioco];
  const { pool, pick } = cfg;
  const N = rows.length;
  if (N < 20) return null;

  const last = rows[N - 1].nums;
  const lastSum = last.reduce((a, b) => a + b, 0);
  const lastSet = new Set(last);

  // media/sigma dinamici dai dati
  const sums = rows.map((r) => r.nums.reduce((a, b) => a + b, 0));
  const mu = sums.reduce((a, b) => a + b, 0) / N;
  const sigma = Math.sqrt(sums.reduce((a, s) => a + (s - mu) ** 2, 0) / N);
  const zLast = (lastSum - mu) / sigma;

  // ---- Frequenze base ----
  const freq: Record<number, number> = {};
  const recFreq: Record<number, number> = {};
  for (let n = 1; n <= pool; n++) { freq[n] = 0; recFreq[n] = 0; }
  rows.forEach((r) => r.nums.forEach((n) => freq[n]++));
  rows.slice(-50).forEach((r) => r.nums.forEach((n) => recFreq[n]++));

  // ---- Ultima posizione (per debito) ----
  const lastSeen: Record<number, number> = {};
  rows.forEach((r, i) => r.nums.forEach((n) => (lastSeen[n] = i)));

  // ===== METODO 5: DEBITO RITARDO PONDERATO =====
  const deficit: Record<number, number> = {};
  for (let n = 1; n <= pool; n++) {
    const f = freq[n];
    if (f === 0) { deficit[n] = 3.0; continue; }
    const ra = N / f;
    const rr = N - 1 - (lastSeen[n] ?? -1);
    deficit[n] = (rr - ra) / ra;
  }

  // ---- Profilo per similarità ----
  const decadi = pool === 90 ? 9 : 5;
  const highThr = pool === 90 ? 45 : 25;
  const getProfile = (nums: number[]) => {
    const s = [...nums].sort((a, b) => a - b);
    const q = new Array(decadi).fill(0);
    s.forEach((n) => q[Math.floor((n - 1) / 10)]++);
    return {
      sum: s.reduce((a, b) => a + b, 0), q,
      high: s.filter((n) => n > highThr).length,
      even: s.filter((n) => n % 2 === 0).length,
      span: s[s.length - 1] - s[0],
    };
  };
  const similarity = (p1: any, p2: any) => {
    let score = 0;
    const z1 = (p1.sum - mu) / sigma, z2 = (p2.sum - mu) / sigma;
    if ((z1 > 0.5 && z2 > 0.5) || (z1 < -0.5 && z2 < -0.5) || (Math.abs(z1) <= 0.5 && Math.abs(z2) <= 0.5)) score += 2;
    score += Math.max(0, 3 - (Math.abs(p1.sum - p2.sum) / sigma) * 3);
    let qd = 0; for (let i = 0; i < decadi; i++) qd += Math.abs(p1.q[i] - p2.q[i]);
    score += Math.max(0, 3 - qd * (decadi === 9 ? 0.5 : 0.75));
    score += Math.max(0, 2 - Math.abs(p1.high - p2.high));
    score += Math.max(0, 1 - Math.abs(p1.span - p2.span) / (decadi === 9 ? 30 : 20));
    score += Math.max(0, 1 - Math.abs(p1.even - p2.even) * 0.5);
    return score;
  };

  // ===== METODO 4: VICINI STORICI =====
  const cp = getProfile(last);
  const sims: { sim: number; next: number[] }[] = [];
  for (let i = 0; i < N - 1; i++) sims.push({ sim: similarity(cp, getProfile(rows[i].nums)), next: rows[i + 1].nums });
  sims.sort((a, b) => b.sim - a.sim);
  const neighFreq: Record<number, number> = {};
  sims.slice(0, 15).forEach((s) => s.next.forEach((n) => (neighFreq[n] = (neighFreq[n] || 0) + 1)));

  // ===== METODO 6: LIFT CO-OCCORRENZA =====
  const pairFreq: Record<string, number> = {};
  rows.forEach((r) => {
    const s = [...r.nums].sort((a, b) => a - b);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
      const k = `${s[i]}-${s[j]}`; pairFreq[k] = (pairFreq[k] || 0) + 1;
    }
  });
  const liftScore = (n: number) => {
    const ls: number[] = [];
    for (let m = 1; m <= pool; m++) {
      if (m === n) continue;
      const k = n < m ? `${n}-${m}` : `${m}-${n}`;
      const obs = pairFreq[k] || 0;
      if (obs < (pool === 90 ? 3 : 2)) continue;
      const exp = (freq[n] / N) * (freq[m] / N) * N;
      if (exp > 0) ls.push(obs / exp);
    }
    ls.sort((a, b) => b - a);
    const top = ls.slice(0, 5);
    return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 1.0;
  };

  // ===== METODO 10: PATTERN GIORNALIERO (tutti i giochi) =====
  // SE estrae lun/mar/gio/sab, EJ ed EM mar/ven. Per ogni gioco usiamo il giorno
  // della settimana della prossima estrazione e i numeri storicamente più frequenti in quel giorno.
  const dayBias: Record<number, number> = {};
  {
    const giorni: Record<number, Record<number, number>> = {};
    const giorniCount: Record<number, number> = {};
    rows.forEach((r) => {
      const d = new Date(r.data).getDay();
      if (!giorni[d]) { giorni[d] = {}; giorniCount[d] = 0; }
      giorniCount[d]++;
      r.nums.forEach((n) => (giorni[d][n] = (giorni[d][n] || 0) + 1));
    });
    // giorno della prossima estrazione (stimato: stesso ciclo dell'ultima)
    const nextDay = new Date(rows[N - 1].data).getDay();
    const dn = giorniCount[nextDay] || 1;
    for (let n = 1; n <= pool; n++) {
      const obs = giorni[nextDay]?.[n] || 0;
      const exp = (dn * pick) / pool;
      const std = Math.sqrt(exp * (1 - pick / pool));
      // serve un minimo di estrazioni in quel giorno perché il segnale sia affidabile
      dayBias[n] = dn >= 20 && std > 0 ? (obs - exp) / std : 0;
    }
  }

  // ===== METODO 11: REPULSIONE POST-ESTRAZIONE =====
  const repulsion: Record<number, number> = {};
  for (let n = 1; n <= pool; n++) {
    if (lastSet.has(n)) { repulsion[n] = -99; continue; }
    let rc = 0;
    last.forEach((m) => {
      const k = n < m ? `${n}-${m}` : `${m}-${n}`;
      const obs = pairFreq[k] || 0;
      const exp = (freq[n] / N) * (freq[m] / N) * N;
      if (exp > 0 && obs / exp < 0.5) rc++;
    });
    repulsion[n] = rc;
  }

  // ===== METODO 9: CO-ASSENZA (coppie incompatibili) =====
  const incompatible = new Set<string>();
  const minFreq = pool === 90 ? 30 : 18;
  for (let a = 1; a <= pool; a++) for (let b = a + 1; b <= pool; b++) {
    if (freq[a] >= minFreq && freq[b] >= minFreq && !(pairFreq[`${a}-${b}`])) incompatible.add(`${a}-${b}`);
  }

  // ===== METODO 12: VERTIBILI (solo SE) =====
  const vertCandidates: Record<number, number> = {};
  if (gioco === "SE") {
    const vertibile = (n: number): number | null => {
      if (n <= 9) return n * 10;
      if (n % 10 === 0) return n / 10;
      if (n % 11 === 0) return Math.floor(n / 11) * 10 + 9;
      if (n % 10 === 9) return Math.floor(n / 10) * 11;
      const t = Math.floor(n / 10), u = n % 10, v = u * 10 + t;
      return v >= 1 && v <= 90 ? v : null;
    };
    last.forEach((n) => {
      const v = vertibile(n);
      if (v && !lastSet.has(v)) {
        const k = Math.min(n, v) + "-" + Math.max(n, v);
        const obs = pairFreq[k] || 0;
        const exp = (freq[n] / N) * (freq[v] / N) * N;
        vertCandidates[v] = exp > 0 ? obs / exp : 0;
      }
    });
  }

  // ===== METODO "dopo anomalia alta" (EJ/EM) =====
  const haFreq: Record<number, number> = {};
  for (let i = 0; i < N - 1; i++) {
    if (rows[i].nums.reduce((a, b) => a + b, 0) > mu + sigma * 1.5)
      rows[i + 1].nums.forEach((n) => (haFreq[n] = (haFreq[n] || 0) + 1));
  }

  // ============================================================
  // SISTEMA DI VOTI: ogni metodo vota per ogni numero
  // ============================================================
  const votes: Record<number, number> = {};
  const scores: Record<number, number> = {};
  const detail: Record<number, any> = {};

  for (let n = 1; n <= pool; n++) {
    if (lastSet.has(n)) { votes[n] = -99; scores[n] = -99; continue; }
    let v = 0;
    const ls = liftScore(n);

    if (deficit[n] > 0.5) v++;               // debito moderato
    if (deficit[n] > 1.0) v++;               // debito forte
    if ((neighFreq[n] || 0) >= 2) v++;       // vicini storici
    if ((neighFreq[n] || 0) >= 3) v++;       // vicini storici forti
    if (ls > 1.3) v++;                        // lift
    if (ls > 1.6) v++;                        // lift forte
    if (dayBias[n] > 1.5) v++;               // pattern giornaliero (SE)
    if (vertCandidates[n] !== undefined) v++; // vertibile (SE)
    if ((vertCandidates[n] || 0) > 1.5) v++;  // vertibile forte
    if ((haFreq[n] || 0) >= 2) v++;          // dopo anomalia alta (EJ/EM)
    if (recFreq[n] >= 4) v++;                // frequenza recente
    if (repulsion[n] >= 4) v -= 2;           // repulsione (penalità)
    if (repulsion[n] >= 5) v -= 1;

    votes[n] = v;
    let score =
      Math.max(0, deficit[n]) * 0.18 +
      ((neighFreq[n] || 0) / 15) * 0.30 +
      (ls - 1) * 0.20 +
      Math.max(0, dayBias[n]) / 3 * 0.10 +
      (vertCandidates[n] !== undefined ? 0.08 : 0) +
      (recFreq[n] / 50) * 0.10 +
      ((haFreq[n] || 0) / Math.max(Object.keys(haFreq).length, 1)) * 0.12;
    score -= repulsion[n] * 0.03;
    scores[n] = score;
    detail[n] = {
      votes: v, score, deficit: deficit[n], neigh: neighFreq[n] || 0,
      lift: ls, day: dayBias[n], vert: vertCandidates[n], rec: recFreq[n],
      rep: repulsion[n], ha: haFreq[n] || 0,
    };
  }

  // Classifica numeri
  const ranked = [];
  for (let n = 1; n <= pool; n++) if (!lastSet.has(n)) ranked.push(n);
  ranked.sort((a, b) => votes[b] - votes[a] || scores[b] - scores[a]);

  // ============================================================
  // SEGNALI ATTIVI (diagnostica)
  // ============================================================
  const isHighAnom = lastSum > mu + sigma * 1.5;
  const isLowAnom = lastSum < mu - sigma * 1.5;
  const segnali: { nome: string; stato: string; tipo: "info" | "warn" | "good" }[] = [];
  segnali.push({
    nome: "Zona somma ultima",
    stato: `Σ=${lastSum} (z=${zLast >= 0 ? "+" : ""}${zLast.toFixed(2)})`,
    tipo: Math.abs(zLast) > 1.5 ? "warn" : "info",
  });
  if (isHighAnom) segnali.push({ nome: "Anomalia ALTA", stato: "→ discesa attesa verso media", tipo: "warn" });
  if (isLowAnom) segnali.push({ nome: "Anomalia BASSA", stato: "→ rimbalzo atteso verso media", tipo: "warn" });
  const topDebt = ranked.filter((n) => deficit[n] > 1.0).slice(0, 5);
  if (topDebt.length) segnali.push({ nome: "Debito forte", stato: topDebt.join(", "), tipo: "good" });
  const vertList = Object.keys(vertCandidates).map(Number);
  if (vertList.length) segnali.push({ nome: "Candidati vertibili", stato: vertList.join(", "), tipo: "good" });
  const dayTop = ranked.filter((n) => dayBias[n] > 1.5).slice(0, 4);
  if (dayTop.length) {
    const giornoNomi = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
    const nextDayName = giornoNomi[new Date(rows[N - 1].data).getDay()];
    segnali.push({ nome: `Pattern ${nextDayName}`, stato: dayTop.join(", "), tipo: "good" });
  }
  const repList = [];
  for (let n = 1; n <= pool; n++) if (!lastSet.has(n) && repulsion[n] >= 4) repList.push(n);
  if (repList.length) segnali.push({ nome: "Filtro repulsione (evita)", stato: repList.slice(0, 8).join(", "), tipo: "warn" });

  // ============================================================
  // GENERAZIONE TOP 5 COMBINAZIONI
  // ============================================================
  const isValid = (combo: number[], sumLo: number, sumHi: number) => {
    const s = [...combo].sort((a, b) => a - b);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++)
      if (incompatible.has(`${s[i]}-${s[j]}`)) return false;
    const total = s.reduce((a, b) => a + b, 0);
    const span = s[s.length - 1] - s[0];
    const high = s.filter((n) => n > highThr).length;
    const even = s.filter((n) => n % 2 === 0).length;
    let consec = 0;
    for (let i = 0; i < s.length - 1; i++) if (s[i + 1] - s[i] === 1) consec++;
    const q = new Array(decadi).fill(0);
    s.forEach((n) => q[Math.floor((n - 1) / 10)]++);
    const decineCoperte = q.filter((x) => x > 0).length;
    if (total < sumLo || total > sumHi) return false;
    if (high < pick - (pool === 90 ? 4 : 3) || high > (pool === 90 ? 4 : 3)) return false;
    if (even < 2 || even > (pool === 90 ? 4 : 3)) return false;
    if (consec > (pool === 90 ? 1 : 0)) return false;
    if (Math.max(...q) > (pool === 90 ? 3 : 2)) return false;
    // Profilo strutturale misurato su dati reali (SE: 4221 estrazioni 1997-2026):
    // il 93% delle vincenti copre 4-6 decine; span tipico 40-85 per SE, 30-48 per EJ/EM
    if (pool === 90) {
      if (decineCoperte < 4) return false;
      if (span < 40 || span > 85) return false;
    } else {
      if (decineCoperte < 3) return false;
      if (span < 28 || span > 48) return false;
    }
    return true;
  };

  // range somma: discesa/rimbalzo verso media
  let sumLo: number, sumHi: number;
  if (isHighAnom) { sumLo = Math.round(mu - sigma); sumHi = Math.round(mu + sigma * 0.3); }
  else if (isLowAnom) { sumLo = Math.round(mu - sigma * 0.3); sumHi = Math.round(mu + sigma); }
  else if (zLast > 0.5) { sumLo = Math.round(mu - sigma * 0.6); sumHi = Math.round(mu + sigma * 0.3); }
  else if (zLast < -0.5) { sumLo = Math.round(mu - sigma * 0.3); sumHi = Math.round(mu + sigma * 0.6); }
  else { sumLo = Math.round(mu - sigma * 0.5); sumHi = Math.round(mu + sigma * 0.5); }

  // Override manuale: se l'utente ha scelto un range somma, usa quello
  const rangeAuto = { lo: sumLo, hi: sumHi };
  if (rangeManuale) { sumLo = rangeManuale.lo; sumHi = rangeManuale.hi; }

  const poolNums = ranked.slice(0, pool === 90 ? 40 : 22);
  const combos: number[][] = [];
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let att = 0;
  while (combos.length < 5 && att < 400000) {
    att++;
    const remaining = [...poolNums];
    const remW = remaining.map((n) => Math.max(scores[n], 0.01));
    const chosen: number[] = [];
    for (let k = 0; k < pick; k++) {
      const tw = remW.reduce((a, b) => a + b, 0);
      let r = rand() * tw, cum = 0, idx = 0;
      for (let j = 0; j < remaining.length; j++) { cum += remW[j]; if (r <= cum) { idx = j; break; } }
      chosen.push(remaining[idx]); remaining.splice(idx, 1); remW.splice(idx, 1);
    }
    if (chosen.length !== pick) continue;
    if (!isValid(chosen, sumLo, sumHi)) continue;
    const key = [...chosen].sort((a, b) => a - b).join(",");
    if (combos.some((c) => [...c].sort((a, b) => a - b).join(",") === key)) continue;
    combos.push([...chosen].sort((a, b) => a - b));
  }
  combos.sort((a, b) => b.reduce((s, n) => s + votes[n], 0) - a.reduce((s, n) => s + votes[n], 0));

  // ============================================================
  // STELLE / EXTRA (EJ, EM, SuperStar)
  // ============================================================
  let stelle: number[] = [];
  if (cfg.hasStars) {
    const starPool = cfg.starPool!;
    const sFreq: Record<number, number> = {};
    const sLast: Record<number, number> = {};
    for (let s = 1; s <= starPool; s++) sFreq[s] = 0;
    rows.forEach((r, i) => (r.stars || []).forEach((s) => { sFreq[s]++; sLast[s] = i; }));
    const currStars = new Set(rows[N - 1].stars || []);
    const sScore: Record<number, number> = {};
    for (let s = 1; s <= starPool; s++) {
      const fg = sFreq[s] / N;
      const delay = N - 1 - (sLast[s] ?? -1);
      const expD = sFreq[s] > 0 ? N / sFreq[s] : N;
      const debt = expD > 0 ? Math.max(0, (delay - expD) / expD) : 0;
      const notLast = currStars.has(s) ? 0.5 : 1.0;
      sScore[s] = (fg * 0.5 + debt * 0.5) * notLast;
    }
    stelle = Array.from({ length: starPool }, (_, i) => i + 1).sort((a, b) => sScore[b] - sScore[a]).slice(0, 2);
  }
  let superstar: number | null = null;
  if (gioco === "SE") {
    superstar = ranked.slice().sort((a, b) => recFreq[b] - recFreq[a])[0];
  }

  return { ranked, votes, scores, detail, combos, segnali, stelle, superstar, mu, sigma, lastSum, zLast, sumLo, sumHi, rangeAuto, pool, pick };
}

// ============================================================
// COMPONENTE UI
// ============================================================
// PROPS:
//   - gioco / estrazioni: come prima
//   - onSalvaBiglietto(biglietto): callback chiamato quando l'utente salva
//       una combinazione. Riceve un oggetto pronto per Supabase (vedi tipo Biglietto).
//       Restituisci una Promise: il componente mostra lo stato (salvataggio/fatto/errore).
//   - bigliettiSalvati: array opzionale delle combinazioni già salvate (per evitare doppioni
//       e mostrare il check "già nei biglietti").
// ============================================================
type Biglietto = {
  gioco: Gioco;
  numeri: number[];
  stelle?: number[];
  superstar?: number | null;
  tipo: "giocato" | "sistema";
  fonte: "oracolo";
  somma: number;
  voti: number;
  data_creazione: string;
};

export default function TabOracolo({
  gioco = "SE",
  estrazioni = [],
  onSalvaBiglietto,
  bigliettiSalvati = [],
}: {
  gioco?: Gioco;
  estrazioni?: Estrazione[];
  onSalvaBiglietto?: (b: Biglietto) => Promise<void> | void;
  bigliettiSalvati?: { numeri: number[] }[];
}) {
  const [showAll, setShowAll] = useState(false);
  const cfg = CONFIG[gioco];

  // Stato del selettore range somma: "auto" usa il modello adattivo, "manuale" usa i limiti scelti dall'utente
  const [rangeMode, setRangeMode] = useState<"auto" | "manuale">("auto");
  const [rangeLo, setRangeLo] = useState<number | null>(null);
  const [rangeHi, setRangeHi] = useState<number | null>(null);

  const result = useMemo(() => {
    try {
      const manuale =
        rangeMode === "manuale" && rangeLo != null && rangeHi != null && rangeLo <= rangeHi
          ? { lo: rangeLo, hi: rangeHi }
          : null;
      return calcolaOracolo(gioco, estrazioni, manuale);
    } catch (e) { console.error(e); return null; }
  }, [gioco, estrazioni, rangeMode, rangeLo, rangeHi]);

  if (!result) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#888" }}>
        Servono almeno 20 estrazioni per il calcolo dell'Oracolo.
      </div>
    );
  }

  const { ranked, votes, detail, combos, segnali, stelle, superstar, lastSum, zLast, sumLo, sumHi, rangeAuto, mu, sigma } = result;
  const maxVotes = Math.max(...ranked.map((n) => votes[n]), 1);

  // Limiti fisici della somma per il gioco (min = somma dei pick numeri più bassi, max = dei più alti)
  const sumMin = Array.from({ length: result.pick }, (_, i) => i + 1).reduce((a, b) => a + b, 0);
  const sumMax = Array.from({ length: result.pick }, (_, i) => result.pool - i).reduce((a, b) => a + b, 0);

  // Inizializza i valori manuali sul range automatico la prima volta che si passa a "manuale"
  const attivaManuale = () => {
    if (rangeLo == null) setRangeLo(rangeAuto.lo);
    if (rangeHi == null) setRangeHi(rangeAuto.hi);
    setRangeMode("manuale");
  };

  // Stato salvataggio: per ogni combo (indice) tiene lo stato del salvataggio
  const [salvataggio, setSalvataggio] = useState<Record<number, "idle" | "saving" | "done" | "error">>({});

  // Verifica se una combinazione è già nei biglietti salvati (confronto per insieme di numeri)
  const giaSalvata = (combo: number[]) => {
    const key = [...combo].sort((a, b) => a - b).join(",");
    return bigliettiSalvati.some((b) => [...b.numeri].sort((a, b) => a - b).join(",") === key);
  };

  // Handler di salvataggio: costruisce il biglietto e chiama il callback Supabase del genitore
  const salva = async (combo: number[], idx: number, tipo: "giocato" | "sistema") => {
    if (!onSalvaBiglietto) return;
    const biglietto: Biglietto = {
      gioco,
      numeri: [...combo].sort((a, b) => a - b),
      stelle: cfg.hasStars ? stelle : undefined,
      superstar: gioco === "SE" ? superstar : null,
      tipo,
      fonte: "oracolo",
      somma: combo.reduce((a, b) => a + b, 0),
      voti: combo.reduce((s, n) => s + votes[n], 0),
      data_creazione: new Date().toISOString(),
    };
    setSalvataggio((p) => ({ ...p, [idx]: "saving" }));
    try {
      await onSalvaBiglietto(biglietto);
      setSalvataggio((p) => ({ ...p, [idx]: "done" }));
    } catch (e) {
      console.error("Errore salvataggio biglietto:", e);
      setSalvataggio((p) => ({ ...p, [idx]: "error" }));
    }
  };

  const voteColor = (v: number) => {
    const ratio = v / maxVotes;
    if (ratio >= 0.85) return "#FFD700";
    if (ratio >= 0.65) return "#F07030";
    if (ratio >= 0.45) return "#E8B84B";
    if (ratio > 0) return "#4A8FD4";
    return "#2A2A3E";
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#E8E8F0", maxWidth: 760, margin: "0 auto", padding: 16 }}>
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, background: "linear-gradient(135deg,#D4AF37,#F0C75E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          🔮 Oracolo — {cfg.label}
        </h2>
        <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>
          Responso unificato da 11 metodi · ultima Σ={lastSum} (z={zLast >= 0 ? "+" : ""}{zLast.toFixed(2)}) · range previsto {sumLo}–{sumHi}
        </p>
      </div>

      {/* SELETTORE RANGE SOMMA */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 16, border: "1px solid #22223A" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37" }}>Range somma</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setRangeMode("auto")}
              style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: rangeMode === "auto" ? "1px solid #D4AF37" : "1px solid #333", background: rangeMode === "auto" ? "#D4AF3722" : "transparent", color: rangeMode === "auto" ? "#D4AF37" : "#888" }}
            >
              Automatico
            </button>
            <button
              onClick={attivaManuale}
              style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: rangeMode === "manuale" ? "1px solid #D4AF37" : "1px solid #333", background: rangeMode === "manuale" ? "#D4AF3722" : "transparent", color: rangeMode === "manuale" ? "#D4AF37" : "#888" }}
            >
              Manuale
            </button>
          </div>
        </div>

        {rangeMode === "auto" ? (
          <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>
            Il modello adattivo ha scelto <strong style={{ color: "#D4AF37" }}>{rangeAuto.lo}–{rangeAuto.hi}</strong> in base
            all'ultima estrazione (Σ={lastSum}, z={zLast >= 0 ? "+" : ""}{zLast.toFixed(2)}).
            {zLast > 1.5 ? " Anomalia alta → discesa attesa." : zLast < -1.5 ? " Anomalia bassa → rimbalzo atteso." : " Somma vicina alla media → range centrato su μ."}
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#888" }}>Da</span>
                <input
                  type="number"
                  value={rangeLo ?? ""}
                  min={sumMin}
                  max={sumMax}
                  onChange={(e) => setRangeLo(e.target.value === "" ? null : Math.max(sumMin, Math.min(sumMax, parseInt(e.target.value) || 0)))}
                  style={{ width: 72, padding: "6px 8px", borderRadius: 8, border: "1px solid #333", background: "#0A0A14", color: "#E8E8F0", fontSize: 13, fontWeight: 700, textAlign: "center" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#888" }}>a</span>
                <input
                  type="number"
                  value={rangeHi ?? ""}
                  min={sumMin}
                  max={sumMax}
                  onChange={(e) => setRangeHi(e.target.value === "" ? null : Math.max(sumMin, Math.min(sumMax, parseInt(e.target.value) || 0)))}
                  style={{ width: 72, padding: "6px 8px", borderRadius: 8, border: "1px solid #333", background: "#0A0A14", color: "#E8E8F0", fontSize: 13, fontWeight: 700, textAlign: "center" }}
                />
              </div>
              <span style={{ fontSize: 10, color: "#666" }}>(min {sumMin} · max {sumMax} · media {Math.round(mu)})</span>
            </div>
            {/* scorciatoie rapide */}
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {[
                { label: "Stretto attorno a μ", lo: Math.round(mu - sigma * 0.3), hi: Math.round(mu + sigma * 0.3) },
                { label: "Sotto media", lo: Math.round(mu - sigma), hi: Math.round(mu) },
                { label: "Sopra media", lo: Math.round(mu), hi: Math.round(mu + sigma) },
                { label: "Largo", lo: Math.round(mu - sigma), hi: Math.round(mu + sigma) },
                { label: "Auto suggerito", lo: rangeAuto.lo, hi: rangeAuto.hi },
              ].map((p, i) => (
                <button
                  key={i}
                  onClick={() => { setRangeLo(p.lo); setRangeHi(p.hi); }}
                  style={{ fontSize: 10, padding: "4px 10px", borderRadius: 7, cursor: "pointer", border: "1px solid #2A2A3E", background: rangeLo === p.lo && rangeHi === p.hi ? "#D4AF3722" : "#0E0E1A", color: rangeLo === p.lo && rangeHi === p.hi ? "#D4AF37" : "#999" }}
                >
                  {p.label} ({p.lo}–{p.hi})
                </button>
              ))}
            </div>
            {rangeLo != null && rangeHi != null && rangeLo > rangeHi && (
              <div style={{ fontSize: 11, color: "#E2554B", marginTop: 8 }}>Il minimo non può superare il massimo.</div>
            )}
            <div style={{ fontSize: 11, color: "#888", marginTop: 10, lineHeight: 1.6 }}>
              Tutti gli 11 metodi (debito, vicini, lift, vertibili, pattern giornaliero, filtri…) restano attivi:
              il sistema costruisce le combinazioni con i numeri a più voti, ma <strong style={{ color: "#D4AF37" }}>solo dentro il range somma che hai scelto</strong>.
            </div>
          </div>
        )}
      </div>

      {/* SEGNALI ATTIVI */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 16, border: "1px solid #22223A" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37", marginBottom: 10 }}>Segnali attivi</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {segnali.map((s, i) => {
            const col = s.tipo === "good" ? "#4A9E5C" : s.tipo === "warn" ? "#E8954B" : "#4A8FD4";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                <span style={{ color: "#aaa", minWidth: 160 }}>{s.nome}</span>
                <span style={{ color: col, fontWeight: 600 }}>{s.stato}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* TOP 5 COMBINAZIONI */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, marginBottom: 16, border: "1px solid #22223A" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37", marginBottom: 12 }}>Le 5 combinazioni dell'Oracolo</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {combos.map((combo, i) => {
            const total = combo.reduce((a, b) => a + b, 0);
            const tv = combo.reduce((s, n) => s + votes[n], 0);
            const best = i === 0;
            const stato = salvataggio[i] || "idle";
            const salvata = giaSalvata(combo);
            return (
              <div key={i} style={{ background: best ? "#1A1A2E" : "#0E0E1A", borderRadius: 10, padding: "10px 12px", border: best ? "1px solid #D4AF3766" : "1px solid #1A1A2E" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#888", minWidth: 26 }}>#{i + 1}{best ? "⭐" : ""}</span>
                  {combo.map((n) => (
                    <span key={n} style={{ width: 32, height: 32, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, background: voteColor(votes[n]) + "22", border: `2px solid ${voteColor(votes[n])}`, color: voteColor(votes[n]) }}>
                      {n}
                    </span>
                  ))}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#888" }}>Σ={total} · {tv} voti</span>
                </div>
                {/* AZIONI: gioca / metti a sistema */}
                {onSalvaBiglietto && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {salvata ? (
                      <span style={{ fontSize: 11, color: "#4A9E5C", fontWeight: 600 }}>✓ Già nei biglietti</span>
                    ) : stato === "done" ? (
                      <span style={{ fontSize: 11, color: "#4A9E5C", fontWeight: 600 }}>✓ Salvata nei biglietti</span>
                    ) : stato === "error" ? (
                      <span style={{ fontSize: 11, color: "#E2554B", fontWeight: 600 }}>Errore — riprova</span>
                    ) : (
                      <>
                        <button
                          onClick={() => salva(combo, i, "giocato")}
                          disabled={stato === "saving"}
                          style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "1px solid #4A9E5C66", background: "#4A9E5C18", color: "#5BB870", cursor: stato === "saving" ? "wait" : "pointer" }}
                        >
                          {stato === "saving" ? "Salvo…" : "🎫 Gioca"}
                        </button>
                        <button
                          onClick={() => salva(combo, i, "sistema")}
                          disabled={stato === "saving"}
                          style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "1px solid #D4AF3766", background: "#D4AF3718", color: "#D4AF37", cursor: stato === "saving" ? "wait" : "pointer" }}
                        >
                          {stato === "saving" ? "Salvo…" : "⚙️ Metti a sistema"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* STELLE / EXTRA */}
        {cfg.hasStars && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #22223A", fontSize: 12 }}>
            <span style={{ color: "#888" }}>EuroNumeri consigliati: </span>
            {stelle.map((s) => (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "#D4AF3722", border: "2px solid #D4AF37", color: "#D4AF37", fontWeight: 800, fontSize: 11, marginLeft: 6 }}>
                {s}
              </span>
            ))}
          </div>
        )}
        {gioco === "SE" && superstar && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #22223A", fontSize: 12 }}>
            <span style={{ color: "#888" }}>SuperStar consigliato: </span>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "#D4AF3722", border: "2px solid #D4AF37", color: "#D4AF37", fontWeight: 800, fontSize: 11, marginLeft: 6 }}>
              {superstar}
            </span>
          </div>
        )}
      </div>

      {/* MAPPA VOTI */}
      <div style={{ background: "#12121F", borderRadius: 14, padding: 14, border: "1px solid #22223A" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37" }}>Mappa voti — top {showAll ? cfg.pool : 15}</div>
          <button onClick={() => setShowAll(!showAll)} style={{ background: "#1A1A2E", border: "1px solid #333", borderRadius: 8, color: "#aaa", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
            {showAll ? "Mostra meno" : "Mostra tutti"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ranked.slice(0, showAll ? cfg.pool : 15).map((n) => {
            const d = detail[n];
            const col = voteColor(votes[n]);
            return (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, background: col + "22", border: `2px solid ${col}`, color: col, flexShrink: 0 }}>{n}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: col, fontWeight: 700, fontSize: 12 }}>{votes[n]} voti</span>
                    <div style={{ flex: 1, maxWidth: 120, height: 6, background: "#0A0A14", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(0, votes[n] / maxVotes) * 100}%`, background: col }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#777", marginTop: 2 }}>
                    deb {d.deficit >= 0 ? "+" : ""}{(d.deficit * 100).toFixed(0)}% · vic {d.neigh} · lift {d.lift.toFixed(2)}
                    {gioco === "SE" && d.day > 1 ? ` · giorno z+${d.day.toFixed(1)}` : ""}
                    {d.vert !== undefined ? " · vertibile" : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: 10, color: "#555", marginTop: 14, textAlign: "center", lineHeight: 1.6 }}>
        L'Oracolo aggrega segnali statistici dai dati storici. Nessun metodo può prevedere un'estrazione casuale:
        il valore è nella qualità strutturale delle combinazioni, non in garanzie di vincita. Gioca responsabilmente.
      </p>
    </div>
  );
}
