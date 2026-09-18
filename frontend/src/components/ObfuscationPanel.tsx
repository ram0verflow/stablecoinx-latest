import React, { useEffect, useState } from 'react';
import { obfuscationApi } from '../lib/api';
import { IcAlertTriangle, IcSearch, IcArrowRight } from './scx/icons';
import { ConfidenceGauge, OutputClusterChart, ProtocolScoreBars, fmtSats } from './ObfuscationCharts';
import type { ObfuscationAnalyzeResult } from '../types';

const NON_CLAIMS = [
  'Does not unmix funds.',
  'Does not map inputs to outputs.',
  'Does not identify users.',
  'Does not imply illicit activity.',
  'Does not replace commercial blockchain intelligence.',
];

const PROTOCOL_LABEL: Record<string, string> = {
  WHIRLPOOL_LEGACY: 'Samourai Whirlpool (legacy)',
  WABISABI_LIKE: 'Wasabi 2.0 / WabiSabi',
  GENERIC_EQUAL_OUTPUT_COINJOIN: 'Generic equal-output CoinJoin',
  UNKNOWN: 'No protocol match',
};

const POLICY_TONE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  ENHANCED_REVIEW: { color: 'var(--amber)', bg: 'var(--amber-soft)', border: 'var(--amber-line)', label: 'Enhanced Review' },
  NO_OBFUSCATION_ACTION: { color: 'var(--green)', bg: 'var(--green-soft)', border: 'var(--green-line)', label: 'No Obfuscation Action' },
  INFORMATIONAL_ONLY: { color: 'var(--ink-muted)', bg: 'var(--gray-soft)', border: 'var(--gray-line)', label: 'Informational Only' },
  BLOCKED_BY_EXTERNAL_ATTRIBUTION: { color: 'var(--red)', bg: 'var(--red-soft)', border: 'var(--red-line)', label: 'Blocked — External Attribution' },
  MANUAL_REVIEW_PROVIDER_UNAVAILABLE: { color: 'var(--amber)', bg: 'var(--amber-soft)', border: 'var(--amber-line)', label: 'Manual Review — Provider Unavailable' },
};

/** Plain-English "why this was flagged" built from the actual numbers — not
 * canned copy. Every sentence is traceable to a real field in the result. */
function buildNarrative(result: ObfuscationAnalyzeResult): string | null {
  const cd = result.chart_data;
  if (!cd) return null;
  const isCoinjoinLike = result.protocol !== 'UNKNOWN' || result.classification === 'COINJOIN_LIKE';
  if (!isCoinjoinLike) {
    return `${cd.input_count} input${cd.input_count === 1 ? '' : 's'} and ${cd.output_count} output${cd.output_count === 1 ? '' : 's'}, ${cd.equal_output_group_count === 0 ? 'no repeated output values' : `only ${cd.largest_equal_output_group_size} outputs sharing a value`} — consistent with an ordinary transaction, not a CoinJoin round.`;
  }
  const parts: string[] = [];
  parts.push(`This transaction has ${cd.input_count} inputs and ${cd.output_count} outputs.`);
  if (cd.largest_equal_output_group_size >= 3) {
    parts.push(`${cd.largest_equal_output_group_size} of those outputs share an identical value` + (cd.equal_output_group_count > 1 ? `, and there are ${cd.equal_output_group_count} such equal-value clusters in total` : '') + '.');
  }
  if (result.protocol === 'WHIRLPOOL_LEGACY') {
    parts.push('That matches the legacy Samourai Whirlpool structure: a fixed round size (5-8 equal participants) settling at one of Whirlpool\'s known pool denominations.');
  } else if (result.protocol === 'WABISABI_LIKE') {
    parts.push('That pattern — many outputs split across several simultaneous equal-value denominations — matches Wasabi 2.0\'s WabiSabi coordinator design, not a single-denomination pool like Whirlpool.');
  } else {
    parts.push('That\'s a real equal-output cluster, but it doesn\'t match either specific protocol\'s known parameters, so this is reported as a generic (unattributed) CoinJoin-like pattern, not a confirmed protocol.');
  }
  return parts.join(' ');
}

function ResultHero({ result }: { result: ObfuscationAnalyzeResult }) {
  const tone = POLICY_TONE[result.policy_recommendation] || POLICY_TONE.INFORMATIONAL_ONLY;
  const narrative = buildNarrative(result);

  return (
    <div className="card">
      <div style={{ padding: '20px 22px', display: 'flex', gap: 22, alignItems: 'center', borderBottom: '1px solid var(--divider)', flexWrap: 'wrap' }}>
        <ConfidenceGauge confidence={result.confidence} tier={result.obfuscation_confidence} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {PROTOCOL_LABEL[result.protocol] || result.protocol}
          </div>
          <div style={{ fontSize: 19, fontWeight: 750, color: 'var(--ink)', marginTop: 3 }}>
            {result.classification.replace(/_/g, ' ')}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 6, wordBreak: 'break-all' }}>{result.txid}</div>
        </div>
        <a
          href={result.blockstream_url} target="_blank" rel="noreferrer"
          className="btn"
          style={{ flex: '0 0 auto', textDecoration: 'none' }}
        >
          View on Blockstream <IcArrowRight />
        </a>
      </div>

      {narrative && (
        <div style={{ padding: '16px 22px', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)', borderBottom: '1px solid var(--divider)' }}>
          {narrative}
        </div>
      )}

      <div style={{ padding: '14px 22px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span
          className="pstatus"
          style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}
        >
          <span className="d" style={{ background: 'currentColor' }} />{tone.label}
        </span>
        <span className={`src-tag ${result.source === 'live_blockstream_fetch' ? 'src-live' : 'src-cached'}`}>
          {result.source === 'cached_validation_fixture' ? 'Cached validation fixture' : result.source === 'live_blockstream_fetch' ? 'Live fetch' : result.source}
        </span>
        {result.provider_attribution.source !== 'none' && (
          <span className="envtag">
            External attribution: {result.provider_attribution.source} · {result.provider_attribution.status}
          </span>
        )}
      </div>
      <div style={{ padding: '0 22px 16px', fontSize: 11.5, color: 'var(--ink-muted)' }}>{result.policy_message}</div>
    </div>
  );
}

function StatRow({ result }: { result: ObfuscationAnalyzeResult }) {
  const cd = result.chart_data;
  if (!cd) return null;
  const stats: [string, string][] = [
    ['Inputs', String(cd.input_count)],
    ['Outputs', String(cd.output_count)],
    ['Equal-value clusters', String(cd.equal_output_group_count)],
    ['Largest cluster', String(cd.largest_equal_output_group_size)],
  ];
  if (cd.total_output_sats) stats.push(['Total value', fmtSats(cd.total_output_sats)]);
  if (cd.block_height) stats.push(['Block height', cd.block_height.toLocaleString()]);

  return (
    <div className="prow" style={{ gridTemplateColumns: `repeat(${stats.length},1fr)`, marginTop: 14 }}>
      {stats.map(([l, v]) => (
        <div className="pcard" key={l}>
          <div className="pname" style={{ cursor: 'default', fontSize: 10.5 }}>{l}</div>
          <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function EvidenceList({ result }: { result: ObfuscationAnalyzeResult }) {
  return (
    <div className="ev-card" style={{ marginTop: 14 }}>
      <div className="ev-chead" style={{ padding: '12px 18px' }}>Evidence for this classification</div>
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

/** The five non-claims + the two signals this classifier deliberately never
 * computes — kept compact and clearly labeled "by design", not shown as
 * blank/broken stat cards. */
function ScopeFooter({ result }: { result: ObfuscationAnalyzeResult }) {
  return (
    <div className="degraded-banner" style={{ marginTop: 14, marginBottom: 0, background: 'var(--gray-soft)', borderColor: 'var(--edge)' }}>
      <IcAlertTriangle className="" />
      <div>
        <div className="t" style={{ color: 'var(--ink)' }}>This is identification, not attribution</div>
        <div className="s">
          {NON_CLAIMS.join(' ')} Illicit attribution and provenance confidence are deliberately
          <b> not evaluated</b> by this classifier — those are separate signals, by design, never inferred from structure.
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
          {result && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <ConfidenceGauge confidence={result.confidence} tier={result.obfuscation_confidence} />
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                    {PROTOCOL_LABEL[result.protocol] || result.protocol}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{result.classification.replace(/_/g, ' ')}</div>
                  <a href={result.blockstream_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--cobalt)', marginTop: 4, display: 'inline-block' }}>
                    View on Blockstream ↗
                  </a>
                </div>
              </div>
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 'var(--r-s)', fontSize: 11.5, fontWeight: 650,
                background: (POLICY_TONE[result.policy_recommendation] || POLICY_TONE.INFORMATIONAL_ONLY).bg,
                color: (POLICY_TONE[result.policy_recommendation] || POLICY_TONE.INFORMATIONAL_ONLY).color,
              }}>
                {(POLICY_TONE[result.policy_recommendation] || POLICY_TONE.INFORMATIONAL_ONLY).label}
              </div>
            </>
          )}
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

        {error && <div className="lerror" style={{ marginTop: 4, marginBottom: 14 }}>{error}</div>}
        {loading && <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>Analyzing…</div>}

        {result && (
          <>
            <ResultHero result={result} />
            <StatRow result={result} />
            {result.chart_data && result.chart_data.output_count > 0 && <OutputClusterChart data={result.chart_data} />}
            {result.checked_protocols.length > 0 && <ProtocolScoreBars checked={result.checked_protocols} />}
            <EvidenceList result={result} />
            <ScopeFooter result={result} />
          </>
        )}
      </div>
    </>
  );
};
