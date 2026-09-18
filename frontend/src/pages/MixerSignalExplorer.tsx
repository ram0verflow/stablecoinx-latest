import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MixerSignalPanel } from '../components/MixerSignalPanel';
import { IcSearch } from '../components/scx/icons';

const CHAINS = [
  'Tron',
  'Ethereum', 'Ethereum Sepolia',
  'Base Sepolia', 'Base',
  'Polygon Amoy', 'Polygon',
  'Arbitrum', 'Arbitrum Sepolia',
  'Optimism', 'Optimism Sepolia',
  'BSC', 'Avalanche',
];

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

const EXAMPLES: { label: string; address: string; chain: string }[] = [
  { label: 'Tron — real fan-out disperser', address: 'TVt7oQuLnHZz252eaDFLbh66zHDGgksoSY', chain: 'Tron' },
  { label: 'Tron — real fan-in collector', address: 'TRpXQyT3RLWKmxAGNU1bHGuzxB56Dr86Pu', chain: 'Tron' },
  { label: 'Base Sepolia — real fan-out', address: '0xa6b711d174d92bc75b1619e978b2c24fccec08f4', chain: 'Base Sepolia' },
];

export const MixerSignalExplorer: React.FC = () => {
  const [params] = useSearchParams();
  const [address, setAddress] = useState(params.get('address') || '');
  const [chain, setChain] = useState(params.get('chain') || 'Tron');
  const [submitted, setSubmitted] = useState<{ address: string; chain: string } | null>(
    params.get('address') ? { address: params.get('address')!, chain: params.get('chain') || 'Tron' } : null,
  );
  const [formatError, setFormatError] = useState<string | null>(null);

  const submit = (addr: string, ch: string) => {
    const trimmed = addr.trim();
    const isTron = ch.trim().toLowerCase() === 'tron';
    const pattern = isTron ? TRON_RE : EVM_RE;
    if (!pattern.test(trimmed)) {
      setFormatError(isTron ? 'Enter a valid Tron address (T + 33 base58 characters).' : 'Enter a valid EVM address (0x + 40 hex characters).');
      setSubmitted(null);
      return;
    }
    setFormatError(null);
    setSubmitted({ address: trimmed, chain: ch });
  };

  return (
    <>
      <div className="topbar">
        <h1>Mixer Signal Explorer</h1>
        <p>Paste any real wallet address on any supported chain and get a live, two-signal analysis — a real third-party risk flag where one exists, plus a self-computed heuristic pattern score. Nothing here is simulated or pre-recorded.</p>
      </div>
      <div className="content pad-t">
        <div className="sec-label">Analyze any wallet</div>
        <div className="toolbar" style={{ padding: 0, marginBottom: 10, gap: 10 }}>
          <div className="search" style={{ maxWidth: 480 }}>
            <IcSearch className="" />
            <input
              placeholder="Wallet address (0x… or T…)"
              value={address}
              onChange={(e) => setAddress(e.target.value.trim())}
              onKeyDown={(e) => e.key === 'Enter' && submit(address, chain)}
            />
          </div>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--r-s)', border: '1px solid var(--gray-line)', background: 'var(--sheet)', fontSize: 12.5 }}
          >
            {CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => submit(address, chain)}>Analyze</button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginRight: 2 }}>Try a real example:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.address}
              className="chip"
              onClick={() => { setAddress(ex.address); setChain(ex.chain); setFormatError(null); submit(ex.address, ex.chain); }}
            >
              {ex.label}
            </button>
          ))}
        </div>

        {formatError && <div className="lerror" style={{ marginBottom: 14 }}>{formatError}</div>}

        {submitted && (
          <MixerSignalPanel address={submitted.address} chain={submitted.chain} label="Wallet" />
        )}

        {!submitted && !formatError && (
          <div style={{ color: 'var(--ink-faint)', fontSize: 12.5, marginTop: 8 }}>
            Enter or paste a wallet address above, or pick one of the real examples, to see a live result.
          </div>
        )}
      </div>
    </>
  );
};
