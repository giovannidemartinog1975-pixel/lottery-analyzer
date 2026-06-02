import { useState, useEffect, useRef } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ubbivjwsgqnwuxswxejm.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const LOTTERIES = {
  superenalotto: { label: "SuperEnalotto", cols: ["n1","n2","n3","n4","n5","n6"], max: 90, size: 6, color: "#f59e0b" },
  eurojackpot:   { label: "EuroJackpot",   cols: ["n1","n2","n3","n4","n5"],       max: 50, size: 5, color: "#3b82f6" },
  euromillions:  { label: "EuroMillions",  cols: ["n1","n2","n3","n4","n5"],       max: 50, size: 5, color: "#10b981" },
};

// ─── SUPABASE FETCH ─────────────────────────────────────────────────────────
async function fetchDraws(table, cols) {
  if (SUPABASE_KEY === "YOUR_ANON_KEY_HERE") return null;
  const select = cols.join(",");
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=1000`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.map(row => cols.map(c => row[c]).filter(Boolean));
}

// ─── SIMULATE DATA ──────────────────────────────────────────────────────────
function simulateDraws(max, size, n = 600) {
  const draws = [];
  for (let i = 0; i < n; i++) {
    const set = new Set();
    while (set.size < size) set.add(Math.floor(Math.random() * max) + 1);
    draws.push([...set].sort((a, b) => a - b));
  }
  return draws;
}

// ─── STAT TESTS ─────────────────────────────────────────────────────────────
function chiSquareTest(draws, max) {
  const freq = new Array(max + 1).fill(0);
  draws.forEach(d => d.forEach(n => freq[n]++));
  const total = draws.length * draws[0].length;
  const expected = total / max;
  let chi2 = 0;
  for (let i = 1; i <= max; i++) chi2 += Math.pow(freq[i] - expected, 2) / expected;
  const df = max - 1;
  // p-value approximation via normal approx of chi2
  const z = Math.sqrt(2 * chi2) - Math.sqrt(2 * df - 1);
  const p = 1 - normalCDF(z);
  return { chi2: chi2.toFixed(2), df, p: p.toFixed(4), freq: freq.slice(1), expected };
}

function runsTest(draws, max) {
  // Flatten all numbers, mark above/below median
  const flat = draws.flat();
  const median = (max + 1) / 2;
  const seq = flat.map(n => n >= median ? 1 : 0);
  let runs = 1;
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) runs++;
  const n1 = seq.filter(x => x === 1).length;
  const n0 = seq.length - n1;
  const muR = (2 * n1 * n0) / (n1 + n0) + 1;
  const s2R = (2 * n1 * n0 * (2 * n1 * n0 - n1 - n0)) / (Math.pow(n1 + n0, 2) * (n1 + n0 - 1));
  const z = (runs - muR) / Math.sqrt(s2R);
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  return { runs, expected: muR.toFixed(1), z: z.toFixed(3), p: p.toFixed(4) };
}

function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return x > 0 ? 1 - p : p;
}

// ─── ENTROPY ────────────────────────────────────────────────────────────────
function shannonEntropy(draws, max) {
  const freq = new Array(max + 1).fill(0);
  let total = 0;
  draws.forEach(d => d.forEach(n => { freq[n]++; total++; }));
  let H = 0;
  for (let i = 1; i <= max; i++) {
    const p = freq[i] / total;
    if (p > 0) H -= p * Math.log2(p);
  }
  const Hmax = Math.log2(max);
  return { H: H.toFixed(4), Hmax: Hmax.toFixed(4), ratio: (H / Hmax * 100).toFixed(2) };
}

function rollingEntropy(draws, max, window = 50) {
  const results = [];
  for (let i = window; i <= draws.length; i++) {
    const slice = draws.slice(i - window, i);
    const { ratio } = shannonEntropy(slice, max);
    results.push({ idx: i, ratio: parseFloat(ratio) });
  }
  return results;
}

// ─── TOPOLOGY (simplified 2D projection via PCA-like) ───────────────────────
function projectTo2D(draws) {
  // Use sum and range as 2D coordinates for visualization
  return draws.map(d => {
    const sum = d.reduce((a, b) => a + b, 0);
    const range = d[d.length - 1] - d[0];
    return { x: sum, y: range };
  });
}

function computeDensityGrid(points, bins = 20) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const grid = Array.from({ length: bins }, () => new Array(bins).fill(0));
  points.forEach(({ x, y }) => {
    const xi = Math.min(bins - 1, Math.floor((x - xmin) / (xmax - xmin + 1) * bins));
    const yi = Math.min(bins - 1, Math.floor((y - ymin) / (ymax - ymin + 1) * bins));
    grid[yi][xi]++;
  });
  return { grid, xmin, xmax, ymin, ymax };
}

// ─── ANOMALY SCORE ──────────────────────────────────────────────────────────
function anomalyScore(draw, allDraws, max) {
  const freq = new Array(max + 1).fill(0);
  allDraws.forEach(d => d.forEach(n => freq[n]++));
  const total = allDraws.length;
  // Score: how much does this draw deviate from expected frequency?
  const expected = total * draw.length / max;
  let score = 0;
  draw.forEach(n => {
    const deviation = Math.abs(freq[n] - expected) / expected;
    score += deviation;
  });
  return (score / draw.length * 100).toFixed(1);
}

function topAnomalous(draws, max, top = 10) {
  return draws
    .map((d, i) => ({ draw: d, score: parseFloat(anomalyScore(d, draws, max)), idx: i }))
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

// ─── MINI BAR CHART ─────────────────────────────────────────────────────────
function FreqBar({ freq, expected, color, max }) {
  const peak = Math.max(...freq);
  return (
    <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 60, marginTop: 8 }}>
      {freq.map((v, i) => (
        <div key={i} style={{
          flex: 1,
          height: `${(v / peak) * 100}%`,
          background: v > expected * 1.3 ? "#ef4444" : v < expected * 0.7 ? "#6366f1" : color,
          opacity: 0.85,
          minWidth: 1,
          transition: "height 0.3s"
        }} title={`N.${i + 1}: ${v}`} />
      ))}
    </div>
  );
}

// ─── DENSITY CANVAS ─────────────────────────────────────────────────────────
function DensityGrid({ data, color }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const { grid } = data;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const bins = grid.length;
    const cw = canvas.width / bins;
    const ch = canvas.height / bins;
    const peak = Math.max(...grid.flat());
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    grid.forEach((row, yi) => row.forEach((val, xi) => {
      const intensity = val / peak;
      ctx.fillStyle = `rgba(${hexToRgb(color)},${intensity.toFixed(2)})`;
      ctx.fillRect(xi * cw, yi * ch, cw, ch);
    }));
  }, [data, color]);
  return <canvas ref={canvasRef} width={180} height={120} style={{ borderRadius: 4, border: "1px solid #333" }} />;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ─── ENTROPY LINE ────────────────────────────────────────────────────────────
function EntropyLine({ data, color }) {
  if (!data || data.length === 0) return null;
  const W = 220, H = 70;
  const vals = data.map(d => d.ratio);
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.ratio - min) / (max - min)) * H;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
      <line x1={0} y1={H * (1 - (95 - min) / (max - min))} x2={W} y2={H * (1 - (95 - min) / (max - min))}
        stroke="#ffffff22" strokeDasharray="4,3" strokeWidth={1} />
    </svg>
  );
}

// ─── CARD ────────────────────────────────────────────────────────────────────
function Card({ title, children, accent }) {
  return (
    <div style={{
      background: "#0f0f0f",
      border: `1px solid ${accent}44`,
      borderRadius: 8,
      padding: "16px",
      boxShadow: `0 0 20px ${accent}11`,
    }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: accent, textTransform: "uppercase", marginBottom: 12, fontFamily: "monospace" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, color: "#666", letterSpacing: 2, textTransform: "uppercase", fontFamily: "monospace" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#fff", fontFamily: "monospace", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>{sub}</div>}
    </div>
  );
}

function PValue({ p }) {
  const pf = parseFloat(p);
  const color = pf < 0.01 ? "#ef4444" : pf < 0.05 ? "#f59e0b" : "#10b981";
  const label = pf < 0.01 ? "ANOMALIA FORTE" : pf < 0.05 ? "ANOMALIA LIEVE" : "DISTRIBUZIONE OK";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 10, color, fontFamily: "monospace", letterSpacing: 1 }}>{label} (p={p})</span>
    </div>
  );
}

// ─── LOTTERY PANEL ──────────────────────────────────────────────────────────
function LotteryPanel({ name, config, draws }) {
  const chi = chiSquareTest(draws, config.max);
  const runs = runsTest(draws, config.max);
  const entropy = shannonEntropy(draws, config.max);
  const rolling = rollingEntropy(draws, config.max, 50);
  const density = computeDensityGrid(projectTo2D(draws));
  const anomalies = topAnomalous(draws, config.max, 5);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
        borderLeft: `3px solid ${config.color}`, paddingLeft: 12
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: config.color, fontFamily: "monospace", letterSpacing: 2 }}>
          {config.label.toUpperCase()}
        </span>
        <span style={{ fontSize: 11, color: "#555", fontFamily: "monospace" }}>{draws.length} estrazioni · {config.max} numeri</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>

        {/* CHI SQUARE */}
        <Card title="① χ² Test · Distribuzione" accent={config.color}>
          <Stat label="χ² calcolato" value={chi.chi2} sub={`df=${chi.df} · atteso≈${chi.df}`} color={config.color} />
          <Stat label="Freq. attesa/numero" value={chi.expected.toFixed(1)} />
          <PValue p={chi.p} />
          <FreqBar freq={chi.freq} expected={chi.expected} color={config.color} max={config.max} />
          <div style={{ fontSize: 9, color: "#444", marginTop: 6, fontFamily: "monospace" }}>
            Rosso=sovra · Blu=sotto rappresentato
          </div>
        </Card>

        {/* RUNS TEST */}
        <Card title="② Runs Test · Autocorrelazione" accent={config.color}>
          <Stat label="Run osservati" value={runs.runs} color={config.color} />
          <Stat label="Run attesi" value={runs.expected} />
          <Stat label="Z-score" value={runs.z} color={Math.abs(parseFloat(runs.z)) > 2 ? "#ef4444" : "#10b981"} />
          <PValue p={runs.p} />
          <div style={{ marginTop: 12, fontSize: 10, color: "#555", fontFamily: "monospace", lineHeight: 1.6 }}>
            Un Z alto indica pattern non casuali nella sequenza temporale dei numeri.
          </div>
        </Card>

        {/* ENTROPY */}
        <Card title="③ Entropia Shannon · Compressibilità" accent={config.color}>
          <Stat label="H osservata" value={entropy.H} color={config.color} />
          <Stat label="H massima" value={entropy.Hmax} />
          <Stat label="Efficienza" value={`${entropy.ratio}%`}
            color={parseFloat(entropy.ratio) > 98 ? "#10b981" : parseFloat(entropy.ratio) > 95 ? "#f59e0b" : "#ef4444"} />
          <div style={{ marginTop: 8, fontSize: 9, color: "#555", fontFamily: "monospace", marginBottom: 4 }}>
            Entropia su finestre scorrevoli (w=50):
          </div>
          <EntropyLine data={rolling} color={config.color} />
          <div style={{ fontSize: 9, color: "#444", marginTop: 4, fontFamily: "monospace" }}>
            Linea tratteggiata = soglia 95%
          </div>
        </Card>

        {/* TOPOLOGY / ANOMALY */}
        <Card title="④ Topologia · Anomaly Detection" accent={config.color}>
          <div style={{ fontSize: 9, color: "#555", fontFamily: "monospace", marginBottom: 6 }}>
            Densità spazio (Σ, range):
          </div>
          <DensityGrid data={density} color={config.color} />
          <div style={{ fontSize: 9, color: "#555", fontFamily: "monospace", margin: "10px 0 4px" }}>
            Top 5 sestine anomale:
          </div>
          {anomalies.map(({ draw, score }, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontFamily: "monospace", color: "#888", marginBottom: 2 }}>
              <span>{draw.join("-")}</span>
              <span style={{ color: score > 20 ? "#ef4444" : "#f59e0b" }}>score:{score}</span>
            </div>
          ))}
        </Card>

      </div>
    </div>
  );
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
function GlobalSummary({ results }) {
  return (
    <div style={{
      background: "#0a0a0a",
      border: "1px solid #222",
      borderRadius: 8,
      padding: 16,
      marginBottom: 32,
      fontFamily: "monospace"
    }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: "#666", textTransform: "uppercase", marginBottom: 12 }}>
        Sintesi Globale · Ipotesi Nulla H₀: sequenze i.i.d. uniformi
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {results.map(({ name, config, chi, runs, entropy }) => (
          <div key={name} style={{ borderLeft: `2px solid ${config.color}`, paddingLeft: 10 }}>
            <div style={{ fontSize: 11, color: config.color, marginBottom: 6 }}>{config.label}</div>
            <div style={{ fontSize: 10, color: "#666", lineHeight: 2 }}>
              χ² p-value: <span style={{ color: parseFloat(chi.p) < 0.05 ? "#ef4444" : "#10b981" }}>{chi.p}</span><br />
              Runs p-value: <span style={{ color: parseFloat(runs.p) < 0.05 ? "#ef4444" : "#10b981" }}>{runs.p}</span><br />
              Entropia: <span style={{ color: parseFloat(entropy.ratio) > 98 ? "#10b981" : "#f59e0b" }}>{entropy.ratio}%</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 9, color: "#444", lineHeight: 1.8 }}>
        Soglie: p &lt; 0.05 → rifiuto H₀ al 95% · p &lt; 0.01 → rifiuto H₀ al 99%
        {" | "}Entropia &lt; 95% → struttura non casuale rilevata
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function LaboratorioScientifico() {
  const [status, setStatus] = useState("idle"); // idle | loading | ready
  const [mode, setMode] = useState("simulated"); // simulated | real
  const [data, setData] = useState(null);

  const loadData = async (useReal) => {
    setStatus("loading");
    const result = {};
    for (const [name, config] of Object.entries(LOTTERIES)) {
      let draws = null;
      if (useReal) {
        const tableMap = { superenalotto: "superenalotto_draws", eurojackpot: "eurojackpot_draws", euromillions: "euromillions_draws" };
        draws = await fetchDraws(tableMap[name], config.cols);
      }
      if (!draws) draws = simulateDraws(config.max, config.size, 600);
      result[name] = draws;
    }
    setData(result);
    setMode(useReal ? "real" : "simulated");
    setStatus("ready");
  };

  const summaryResults = data ? Object.entries(LOTTERIES).map(([name, config]) => ({
    name, config,
    chi: chiSquareTest(data[name], config.max),
    runs: runsTest(data[name], config.max),
    entropy: shannonEntropy(data[name], config.max),
  })) : [];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050505",
      color: "#e0e0e0",
      padding: "24px",
      fontFamily: "monospace",
    }}>
      {/* HEADER */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 9, letterSpacing: 6, color: "#444", textTransform: "uppercase", marginBottom: 4 }}>
          Lottery Analyzer · Modulo Sperimentale
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: -1 }}>
          Laboratorio<br />
          <span style={{ color: "#f59e0b" }}>Scientifico</span>
        </h1>
        <p style={{ fontSize: 11, color: "#555", marginTop: 8, maxWidth: 500, lineHeight: 1.6 }}>
          Test statistici, entropia di Shannon, topologia dello spazio combinatorio e anomaly detection
          applicati a SuperEnalotto, EuroJackpot ed EuroMillions.
        </p>
      </div>

      {/* CONTROLS */}
      {status === "idle" && (
        <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
          <button onClick={() => loadData(false)} style={{
            background: "#1a1a1a", border: "1px solid #333", color: "#fff",
            padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontSize: 12, letterSpacing: 1
          }}>
            ▶ Avvia con dati simulati
          </button>
          <button onClick={() => loadData(true)} style={{
            background: "#1a0a00", border: "1px solid #f59e0b55", color: "#f59e0b",
            padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontSize: 12, letterSpacing: 1
          }}>
            ⚡ Connetti Supabase (dati reali)
          </button>
        </div>
      )}

      {status === "loading" && (
        <div style={{ color: "#f59e0b", fontSize: 13, letterSpacing: 2, marginBottom: 32 }}>
          ELABORAZIONE IN CORSO...
        </div>
      )}

      {status === "ready" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{
              fontSize: 9, letterSpacing: 2, color: mode === "real" ? "#10b981" : "#6366f1",
              border: `1px solid ${mode === "real" ? "#10b98144" : "#6366f144"}`,
              padding: "4px 10px", borderRadius: 4, textTransform: "uppercase"
            }}>
              {mode === "real" ? "● Dati reali Supabase" : "● Dati simulati (600 estrazioni/lotteria)"}
            </div>
            <button onClick={() => setStatus("idle")} style={{
              background: "transparent", border: "1px solid #333", color: "#666",
              padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 9, letterSpacing: 1
            }}>
              Reset
            </button>
          </div>

          <GlobalSummary results={summaryResults} />

          {Object.entries(LOTTERIES).map(([name, config]) => (
            <LotteryPanel key={name} name={name} config={config} draws={data[name]} />
          ))}

          <div style={{ fontSize: 9, color: "#333", marginTop: 24, lineHeight: 2, borderTop: "1px solid #111", paddingTop: 16 }}>
            NOTA METODOLOGICA: I test statistici verificano la conformità alla distribuzione uniforme i.i.d.
            Un p-value basso indica deviazione statistica ma NON implica prevedibilità operativa.
            L'entropia misura la compressibilità informazionale della sequenza storica.
            La densità topologica visualizza la distribuzione nello spazio (Σ, range) delle combinazioni estratte.
            Lo score di anomalia misura la deviazione dalla frequenza attesa dei singoli numeri nella combinazione.
          </div>
        </>
      )}
    </div>
  );
}
