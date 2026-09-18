import React, { useEffect, useState } from 'react';
import { mixerSignalsApi } from '../lib/api';
import { ConfidenceGauge } from './ObfuscationCharts';
import type { MixerSignalResult } from '../types';

const TIER_TONE: Record<string, { color: string; bg: string; border: string }> = {
  HIGH: { color: 'var(--green)', bg: 'var(--green-soft)', border: 'var(--green-line)' },
  MEDIUM: { color: 'var(--cobalt)', bg: 'var(--cobalt-soft, var(--gray-soft))', border: 'var(--gray-line)' },
  LOW: { color: 'var(--amber)', bg: 'var(--amber-soft)', border: 'var(--amber-line)' },
  NONE: { color: 'var(--ink-faint)', bg: 'var(--gray-soft)', border: 'var(--gray-line)' },
};

function fmtSun(sun?: number | null): string | null {
  if (sun == null) return null;
  const trx = sun / 1e6;
  return `${trx.toLocaleString(undefined, { maximumFractionDigits: 2 })} TRX`;
}

function fmtWei(wei?: string | null): string | null {
  if (!wei) return null;
  const eth = Number(wei) / 1e18;
  if (!Number.isFinite(eth)) return null;
  return `${eth.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function timeAgo(ts?: number | null): string {
  if (!ts) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export const MixerSignalPanel: React.FC<{ address?: string | null; chain?: string | null; label: string }> = ({ address, chain, label }) => {
  const [result, setResult] = useState<MixerSignalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
    if (!address || !chain) return;
    setLoading(true);
    mixerSignalsApi
      .analyze(address, chain)
      .then(({ data }) => setResult(data))
      .catch((err) => setError(err?.response?.data?.detail || 'Lookup failed'))
      .finally(() => setLoading(false));
  }, [address, chain]);

  if (!address || !chain) {
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <div className="cbody" style={{ color: 'var(--ink-faint)', fontSize: 12.5, padding: '16px 18px' }}>
          {label}: no wallet on file for this leg.
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="chead">
        <div className="ctitle">{label} — {chain}</div>
        <div className="csub mono">{address}</div>
      </div>
      <div className="cbody">
        {loading && <div style={{ color: 'var(--ink-faint)', fontSize: 12.5 }}>Fetching live chain data…</div>}
        {error && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{error}</div>}

        {result && !result.available && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              flex: '0 0 auto', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: 'var(--amber-soft)', color: 'var(--amber)', border: '1px solid var(--amber-line)',
            }}>
              NOT AVAILABLE
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{result.reason}</div>
              <a href={result.explorer_url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--cobalt)', display: 'inline-block', marginTop: 8 }}>
                View address on block explorer ↗
              </a>
            </div>
          </div>
        )}

        {result && result.available && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              {result.soft_signal && (
                <ConfidenceGauge confidence={result.soft_signal.score / 100} tier={result.soft_signal.tier} />
              )}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                  Heuristic pattern signal (self-computed)
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  {result.total_tx_count?.toLocaleString()} total transactions on record · {result.sample_size} most recent analyzed
                </div>
                <a href={result.explorer_url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--cobalt)', display: 'inline-block', marginTop: 6 }}>
                  View on {result.chain === 'Tron' ? 'TronScan' : 'block explorer'} ↗
                </a>
              </div>
            </div>

            {result.hard_signal && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                  Third-party risk signal (hard, never blended with the heuristic score above)
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
                  background: result.hard_signal.flagged ? 'var(--red-soft)' : result.hard_signal.flagged === false ? 'var(--green-soft)' : 'var(--gray-soft)',
                  border: `1px solid ${result.hard_signal.flagged ? 'var(--red-line)' : result.hard_signal.flagged === false ? 'var(--green-line)' : 'var(--gray-line)'}`,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: result.hard_signal.flagged ? 'var(--red)' : result.hard_signal.flagged === false ? 'var(--green)' : 'var(--ink-muted)',
                  }}>
                    {result.hard_signal.flagged ? 'FLAGGED' : result.hard_signal.flagged === false ? 'CLEAN' : 'NOT EVALUATED'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{result.hard_signal.detail}</span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 4 }}>Source: {result.hard_signal.source}</div>
              </div>
            )}

            {result.soft_signal && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                  Every heuristic checked — highest score wins, nothing hidden
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.soft_signal.patterns_checked.map((p) => (
                    <div key={p.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12 }}>
                      <span style={{
                        flex: '0 0 auto', width: 16, height: 16, borderRadius: 4, marginTop: 1,
                        background: p.matched ? 'var(--violet)' : 'var(--sheet-2)',
                        color: p.matched ? '#fff' : 'var(--ink-faint)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                      }}>
                        {p.matched ? '✓' : '–'}
                      </span>
                      <div>
                        <span style={{ fontWeight: p.matched ? 600 : 400, color: p.matched ? 'var(--ink)' : 'var(--ink-muted)' }}>{p.label}</span>
                        <span style={{ color: 'var(--ink-faint)' }}> — {p.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.recent_transactions.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                  Recent on-chain activity (real, live-fetched)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {result.recent_transactions.slice(0, 6).map((tx, i) => {
                    const amountLabel = fmtSun(tx.amount_sun) || fmtWei(tx.amount_wei) || '—';
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--ink-soft)', fontFamily: 'var(--mono, monospace)' }}>
                        <span style={{ color: tx.direction === 'out' ? 'var(--amber)' : 'var(--green)', fontWeight: 700, width: 28 }}>{tx.direction.toUpperCase()}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.counterparty}</span>
                        <span>{amountLabel}</span>
                        <span style={{ color: 'var(--ink-faint)', width: 60, textAlign: 'right' }}>{timeAgo(tx.timestamp)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
