// ═══════════════════════════════════════════════════════════════
// AUTO-UPDATE COMPONENT — Aggiorna estrazioni da superenalotto.com
// Usa Claude API per parsare la pagina e salvare in Supabase
// ═══════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const C = {
  bg:"#07070F", card:"#0D0D1A", border:"#1A1A2E",
  text:"#E0E0F0", dim:"#6A6A8A",
  green:"#4A9E5C", teal:"#2BA89A", orange:"#F07030",
  red:"#C94040",
};
const ACCENT = "#D4AF37";

interface Draw {
  data: string;
  n1: number; n2: number; n3: number;
  n4: number; n5: number; n6: number;
  jolly?: number;
  superstar?: number;
}

export default function AutoUpdate({ onUpdate }: { onUpdate: () => void }) {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [newDraws, setNewDraws] = useState<Draw[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const checkUpdates = async () => {
    setLoading(true);
    setStatus('🔍 Controllo ultime estrazioni...');
    setNewDraws([]);

    try {
      // 1. Trova l'ultima data nel DB
      const { data: lastRow } = await supabase
        .from('superenalotto')
        .select('data')
        .order('data', { ascending: false })
        .limit(1);

      const lastDate = lastRow?.[0]?.data || '2026-01-01';
      setStatus(`📅 Ultima nel DB: ${lastDate} — cerco nuove estrazioni...`);

      // 2. Usa Claude API per parsare le ultime estrazioni
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{
            role: 'user',
            content: `Vai su https://www.superenalotto.com/archivio e trovami tutte le estrazioni SuperEnalotto con data SUCCESSIVA al ${lastDate}.
Per ogni estrazione trovata, rispondimi SOLO con JSON in questo formato (nessun testo extra):
[{"data":"YYYY-MM-DD","n1":N,"n2":N,"n3":N,"n4":N,"n5":N,"n6":N,"jolly":N,"superstar":N}]
Se non ci sono nuove estrazioni rispondi con: []
I numeri devono essere ordinati dal più piccolo al più grande.`
          }]
        })
      });

      const result = await response.json();
      const text = result.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');

      // 3. Parsa il JSON
      const jsonMatch = text.match(/\[.*\]/s);
      if (!jsonMatch) {
        setStatus('✅ Nessuna nuova estrazione trovata.');
        setLoading(false);
        return;
      }

      const draws: Draw[] = JSON.parse(jsonMatch[0]);
      
      if (draws.length === 0) {
        setStatus('✅ Database già aggiornato!');
        setLastUpdate(new Date().toLocaleString('it-IT'));
        setLoading(false);
        return;
      }

      setStatus(`📥 Trovate ${draws.length} nuove estrazioni — salvataggio...`);
      setNewDraws(draws);

      // 4. Inserisci in Supabase
      const { error } = await supabase.from('superenalotto').insert(draws);
      
      if (error) throw error;

      setStatus(`✅ ${draws.length} nuove estrazioni salvate nel database!`);
      setLastUpdate(new Date().toLocaleString('it-IT'));
      onUpdate();

    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Errore: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${ACCENT}33`,
      borderLeft: `3px solid ${ACCENT}`,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: ACCENT, fontWeight: 700, fontSize: 12, marginBottom: 2 }}>
            🔄 Aggiornamento Automatico
          </div>
          <div style={{ color: C.dim, fontSize: 10 }}>
            {lastUpdate ? `Ultimo aggiornamento: ${lastUpdate}` : 'Controlla nuove estrazioni da superenalotto.com'}
          </div>
        </div>
        <button
          onClick={checkUpdates}
          disabled={loading}
          style={{
            background: loading ? '#1a1a2e' : `linear-gradient(135deg,${ACCENT},${C.teal})`,
            color: loading ? C.dim : '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '⏳ Controllo...' : '🔄 Controlla Aggiornamenti'}
        </button>
      </div>

      {status && (
        <div style={{
          marginTop: 8,
          padding: '6px 10px',
          background: status.startsWith('❌') ? `${C.red}11` : status.startsWith('✅') ? `${C.green}11` : `${ACCENT}08`,
          border: `1px solid ${status.startsWith('❌') ? C.red : status.startsWith('✅') ? C.green : ACCENT}33`,
          borderRadius: 6,
          color: status.startsWith('❌') ? C.red : status.startsWith('✅') ? C.green : ACCENT,
          fontSize: 11,
        }}>
          {status}
        </div>
      )}

      {newDraws.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: C.dim, fontSize: 10, marginBottom: 6 }}>Nuove estrazioni aggiunte:</div>
          {newDraws.map((d, i) => (
            <div key={i} style={{
              display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
              background: '#080816', borderRadius: 6, padding: '4px 8px', marginBottom: 4,
            }}>
              <span style={{ color: C.dim, fontSize: 10, minWidth: 80 }}>{d.data}</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {[d.n1, d.n2, d.n3, d.n4, d.n5, d.n6].map((n, j) => (
                  <div key={j} style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 32%,${ACCENT}cc,${ACCENT}33)`,
                    border: `1px solid ${ACCENT}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 900, color: '#fff', fontFamily: 'monospace',
                  }}>{n}</div>
                ))}
              </div>
              {d.jolly && <span style={{ color: '#aaa', fontSize: 10 }}>J:{d.jolly}</span>}
              {d.superstar && <span style={{ color: '#FFD700', fontSize: 10 }}>SS:{d.superstar}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
