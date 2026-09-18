import React, { useEffect, useState } from 'react';
import { obfuscationApi } from '../lib/api';
import { IcAlertTriangle, IcSearch } from './scx/icons';
import type { ObfuscationAnalyzeResult } from '../types';

const NON_CLAIMS = [
  'Does not unmix funds.',
  'Does not map inputs to outputs.',
  'Does not identify users.',
  'Does not imply illicit activity.',
  'Does not replace commercial blockchain intelligence.',
];

const POLICY_TONE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  ENHANCED_REVIEW: { color: 'var(--amber)', bg: 'var(--amber-soft)', border: 'var(--amber-line)', label: 'Enhanced Review' },
  NO_OBFUSCATION_ACTION: { color: 'var(--green)', bg: 'var(--green-soft)', border: 'var(--green-line)', label: 'No Obfuscation Action' },
  INFORMATIONAL_ONLY: { color: 'var(--ink-muted)', bg: 'var(--gray-soft)', border: 'var(--gray-line)', label: 'Informational Only' },
  BLOCKED_BY_EXTERNAL_ATTRIBUTION: { color: 'var(--red)', bg: 'var(--red-soft)', border: 'var(--red-line)', label: 'Blocked — External Attribution' },
  MANUAL_REVIEW_PROVIDER_UNAVAILABLE: { color: 'var(--amber)', bg: 'var(--amber-soft)', border: 'var(--amber-line)', label: 'Manual Review — Provider Unavailable' },
};

function ResultSummary({ result }: { result: ObfuscationAnalyzeResult }) {
  const tone = POLICY_TONE[result.policy_recommendation] || POLICY_TONE.INFORMATIONAL_ONLY;
  const rows: [string, string][] = [
    ['Classification', result.classification.replace(/_/g, ' ')],
    ['Confidence', `${Math.round(result.confidence * 100)}%`],
    ['Protocol', result.protocol],
    ['Obfuscation confidence', result.obfuscation_confidence],
    ['Illicit attribution', result.illicit_attribution],
    ['Provenance confidence', result.provenance_confidence],
  ];
  return (
    <>
      <div className="prow" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {rows.map(([l, v]) => (
          <div className="pcard" key={l}>
            <div className="pname" style={{ cursor: 'default' }}>{l}</div>
            <div className="psub" style={{ marginTop: 6, fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 14, padding: '14px 18px', borderRadius: 'var(--r-m)',
        background: tone.bg, border: `1px solid ${tone.border}`, display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: tone.color, textTransform: 'uppercase', letterSpacing: '.03em' }}>
          Policy recommendation: {tone.label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{result.policy_message}</div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`src-tag ${result.source === 'live_blockstream_fetch' ? 'src-live' : 'src-cached'}`}>
          {result.source === 'cached_validation_fixture' ? 'Cached validation fixture' : result.source === 'live_blockstream_fetch' ? 'Live fetch' : result.source}
        </span>
        {result.provider_attribution.source !== 'none' && (
          <span className="envtag">
            External attribution: {result.provider_attribution.source} · {result.provider_attribution.status}
          </span>
        )}
      </div>
    </>
  );
}

function EvidenceList({ result }: { result: ObfuscationAnalyzeResult }) {
  return (
    <div className="ev-card" style={{ marginTop: 14 }}>
      <div className="ev-chead" style={{ padding: '12px 18px' }}>Evidence</div>
      <div className="ev-cbody">
        {result.evidence.map((e) => (
          <div className="check" key={e.name}>
            <span className="mk mk-ok">✓</span>
            <span className="cl">{e.detail}</span>
            <span className="cr">+{e.weight}</span>
          </div>
        ))}
        {result.evidence_against.map((reason, i) => (
          <div className="check" key={`against-${i}`}>
            <span className="mk mk-warn">–</span>
            <span className="cl" style={{ color: 'var(--ink-muted)' }}>{reason}</span>
          </div>
        ))}
        {result.classification_hint && (
          <div style={{ padding: '8px 0 2px', fontSize: 11.5, color: 'var(--ink-muted)' }}>
            Structural hint: <b style={{ color: 'var(--ink-soft)' }}>{result.classification_hint.replace(/_/g, ' ')}</b>
          </div>
        )}
      </div>
    </div>
  );
}

function CaveatBanner() {
  return (
    <div className="degraded-banner" style={{ marginTop: 14, marginBottom: 0, background: 'var(--gray-soft)', borderColor: 'var(--edge)' }}>
      <IcAlertTriangle className="" />
      <div>
        <div className="t" style={{ color: 'var(--ink)' }}>This is identification, not attribution</div>
        <div className="s">
          {NON_CLAIMS.join(' ')}
          <br />
          <b style={{ color: 'var(--ink)' }}>Privacy is not guilt. Uncertainty is not clearance.</b>
        </div>
      </div>
    </div>
  );
}

export const ObfuscationPanel: React.FC<{ mode?: 'full' | 'compact'; defaultTxid?: string }> = ({ mode = 'full', defaultTxid = '' }) => {
  const [txid, setTxid] = useState(defaultTxid);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ObfuscationAnalyzeResult | null>(null);
  const [demoTxids, setDemoTxids] = useState<string[]>([]);

  useEffect(() => {
    if (mode === 'full') {
      obfuscationApi.demoTxids().then(({ data }) => setDemoTxids(data.txids)).catch(() => {});
    }
  }, [mode]);

  const analyze = async (id: string) => {
    if (!id || id.length !== 64) {
      setError('Enter a valid 64-character Bitcoin txid.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await obfuscationApi.analyze(id, 'bitcoin');
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Analysis failed.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (defaultTxid) {
      setTxid(defaultTxid);
      analyze(defaultTxid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, defaultTxid]);

  if (mode === 'compact') {
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <div className="chead"><div className="ctitle">Obfuscation Intelligence</div><div className="csub">Bitcoin protocol-structure demo</div></div>
        <div className="cbody">
          <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginBottom: 10 }}>
            Demonstration only — analyzes a configured Bitcoin txid, unrelated to this payment's own wallet checks above.
          </div>
          {loading && <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>Analyzing…</div>}
          {error && <div className="lerror">{error}</div>}
          {result && <ResultSummary result={result} />}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <h1>Obfuscation Intelligence</h1>
        <p>StableCoinX identifies privacy-protocol transaction structure, separates it from illicit attribution, and converts it into a policy recommendation.</p>
      </div>
      <div className="content pad-t">
        <div className="sec-label">Analyze a Bitcoin transaction</div>
        <div className="toolbar" style={{ padding: 0, marginBottom: 10 }}>
          <div className="search" style={{ maxWidth: 480 }}>
            <IcSearch className="" />
            <input
              placeholder="Bitcoin txid (64 hex characters)"
              value={txid}
              onChange={(e) => setTxid(e.target.value.trim())}
              onKeyDown={(e) => e.key === 'Enter' && analyze(txid)}
            />
          </div>
          <button className="btn btn-primary" disabled={loading} onClick={() => analyze(txid)}>
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
        {demoTxids.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginRight: 2 }}>Demo txids:</span>
            {demoTxids.map((t) => (
              <button key={t} className="chip" onClick={() => { setTxid(t); analyze(t); }}>{t.slice(0, 10)}…</button>
            ))}
          </div>
        )}

        <CaveatBanner />

        {error && <div className="lerror" style={{ marginTop: 14 }}>{error}</div>}

        {result && (
          <>
            <div className="sec-label" style={{ marginTop: 22 }}>Result</div>
            <ResultSummary result={result} />
            <EvidenceList result={result} />
          </>
        )}

        <ValidationSnapshot />
      </div>
    </>
  );
};

function ValidationSnapshot() {
  const [snap, setSnap] = useState<import('../types').ObfuscationValidationSnapshot | null>(null);

  useEffect(() => {
    obfuscationApi.validationSnapshot().then(({ data }) => setSnap(data)).catch(() => {});
  }, []);

  if (!snap || !snap.available) return null;

  return (
    <>
      <div className="sec-label" style={{ marginTop: 26 }}>Validation snapshot</div>
      <div className="legend" style={{ maxWidth: 'none', marginTop: 0 }}>
        <div className="legend-title">Seed validation from tools/obfuscation_classifier/benchmark.py</div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>{snap.claim}</div>
        <div className="legend-row"><b>Runnable cases</b>{snap.total_runnable_cases}</div>
        <div className="legend-row"><b>Correct</b>{snap.correct_count} / {snap.total_runnable_cases}</div>
        <div className="legend-row"><b>Precision</b>{snap.precision}</div>
        <div className="legend-row"><b>Recall</b>{snap.recall}</div>
        <div className="legend-row"><b>Generated</b>{snap.generated_at}</div>
        {snap.small_sample_warning && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--amber)' }}>
            SMALL_SAMPLE_WARNING — treat as a seed validation, not a statistically robust benchmark.
          </div>
        )}
      </div>
    </>
  );
}
