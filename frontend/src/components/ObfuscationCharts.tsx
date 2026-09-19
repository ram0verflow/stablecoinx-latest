import React from 'react';
import type { ObfuscationChartData } from '../types';

const PROTOCOL_COLOR: Record<string, string> = {
  WHIRLPOOL_LEGACY: 'var(--cobalt)',
  WABISABI_LIKE: 'var(--violet)',
  GENERIC_EQUAL_OUTPUT_COINJOIN: 'var(--blue)',
  UNKNOWN: 'var(--ink-faint)',
};

// Classification-confidence semantics (Bitcoin CoinJoin classifier):
// HIGH = clearly, confidently identified as a CoinJoin — green is correct
// here, it's not a risk label.
const TIER_COLOR: Record<string, string> = {
  HIGH: 'var(--green)',
  MEDIUM: 'var(--cobalt)',
  LOW: 'var(--amber)',
  NONE: 'var(--ink-faint)',
};

// Risk semantics (Mixer Signals soft_signal.tier): HIGH = most suspicious
// heuristic patterns matched — the opposite meaning of the scale above, so
// it needs its own inverted color mapping, not a reused green-for-HIGH.
const RISK_TIER_COLOR: Record<string, string> = {
  HIGH: 'var(--red)',
  MEDIUM: 'var(--amber)',
  LOW: 'var(--cobalt)',
  NONE: 'var(--green)',
};

function fmtSats(sats: number): string {
  const btc = sats / 1e8;
  if (btc >= 0.001) return `${btc.toFixed(btc >= 1 ? 2 : 4)} BTC`;
  return `${sats.toLocaleString()} sats`;
}

/** Circular SVG progress ring showing the confidence/risk score.
 * scheme="confidence" (default): HIGH is green (classification-confidence).
 * scheme="risk": HIGH is red (this tier means "most suspicious"). */
export function ConfidenceGauge({ confidence, tier, scheme = 'confidence' }: { confidence: number; tier: string; scheme?: 'confidence' | 'risk' }) {
  const size = 116;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, confidence));
  const palette = scheme === 'risk' ? RISK_TIER_COLOR : TIER_COLOR;
  const color = palette[tier] || 'var(--ink-faint)';

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: `0 0 ${size}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--edge)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{Math.round(pct * 100)}%</div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 3 }}>{tier}</div>
      </div>
    </div>
  );
}

/** Bar chart of the distinct output-value clusters — the core CoinJoin evidence, visualized. */
export function OutputClusterChart({ data }: { data: ObfuscationChartData }) {
  const counts = new Map<number, number>();
  for (const v of data.output_values_sats) counts.set(v, (counts.get(v) || 0) + 1);
  const clusters = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const shown = clusters.slice(0, 12);
  const rest = clusters.length - shown.length;
  const maxCount = Math.max(...shown.map((c) => c.count), 1);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="chead">
        <div className="ctitle">Output value distribution</div>
        <div className="csub">{clusters.length} distinct value{clusters.length === 1 ? '' : 's'} across {data.output_count} outputs</div>
      </div>
      <div className="cbody">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map((c) => {
            const isCluster = c.count >= 3;
            const widthPct = Math.max(4, (c.count / maxCount) * 100);
            return (
              <div key={c.value} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 92, flex: '0 0 92px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--mono, monospace)', color: 'var(--ink-soft)' }}>
                  {fmtSats(c.value)}
                </div>
                <div style={{ flex: 1, height: 16, background: 'var(--sheet-2)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${widthPct}%`, height: '100%',
                    background: isCluster ? 'var(--violet)' : 'var(--gray-line)',
                    borderRadius: 4, transition: 'width .5s ease',
                  }} />
                </div>
                <div style={{ width: 28, flex: '0 0 28px', fontSize: 11.5, fontWeight: 700, color: isCluster ? 'var(--violet)' : 'var(--ink-muted)' }}>
                  ×{c.count}
                </div>
              </div>
            );
          })}
        </div>
        {rest > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-faint)' }}>+ {rest} more distinct value{rest === 1 ? '' : 's'} (singletons/change amounts, not shown)</div>
        )}
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-muted)' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--violet)', marginRight: 5 }} />
          Equal-value cluster (≥3 outputs) — the structural signal a CoinJoin round produces
        </div>
      </div>
    </div>
  );
}

/** Horizontal bar comparison of every rule the classifier evaluated. */
export function ProtocolScoreBars({ checked }: { checked: { protocol: string; classification: string; score: number }[] }) {
  const labels: Record<string, string> = {
    WHIRLPOOL_LEGACY: 'Whirlpool (legacy)',
    WABISABI_LIKE: 'WabiSabi (Wasabi 2.0)',
    GENERIC_EQUAL_OUTPUT_COINJOIN: 'Generic equal-output',
    UNKNOWN: 'Generic equal-output',
  };
  // checked_protocols is ordered [whirlpool, wabisabi, generic] by the classifier
  const ruleNames = ['Whirlpool (legacy)', 'WabiSabi (Wasabi 2.0)', 'Generic equal-output'];

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="chead">
        <div className="ctitle">Every rule checked</div>
        <div className="csub">Highest match wins — nothing is hidden</div>
      </div>
      <div className="cbody">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {checked.map((c, i) => {
            const name = ruleNames[i] || labels[c.protocol] || c.protocol;
            const color = i === 0 ? PROTOCOL_COLOR.WHIRLPOOL_LEGACY : i === 1 ? PROTOCOL_COLOR.WABISABI_LIKE : PROTOCOL_COLOR.GENERIC_EQUAL_OUTPUT_COINJOIN;
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{name}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>{c.score}/100</span>
                </div>
                <div style={{ height: 10, background: 'var(--sheet-2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${c.score}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { fmtSats };
