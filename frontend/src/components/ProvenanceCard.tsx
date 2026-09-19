import React, { useEffect, useMemo, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { ProvenanceResult, ProvenanceGraphNode, TerminalState, PathIntegrity } from '../types';

import circleLogo from '../assets/entities/circle.svg';
import tetherLogo from '../assets/entities/tether.svg';
import coinbaseLogo from '../assets/entities/coinbase.svg';
import binanceLogo from '../assets/entities/binance.svg';
import krakenLogo from '../assets/entities/kraken.svg';
import uniswapLogo from '../assets/entities/uniswap.svg';
import acrossLogo from '../assets/entities/across.svg';
import layerzeroLogo from '../assets/entities/layerzero.svg';
import wormholeLogo from '../assets/entities/wormhole.svg';
import ethereumLogo from '../assets/entities/ethereum.svg';
import baseLogo from '../assets/entities/base.svg';
import arbitrumLogo from '../assets/entities/arbitrum.svg';
import privacyGlyph from '../assets/entities/privacy.svg';
import sanctionedGlyph from '../assets/entities/sanctioned.svg';
import unresolvedGlyph from '../assets/entities/unresolved.svg';

try {
  cytoscape.use(dagre);
} catch {
  // already registered (HMR) — safe to ignore
}

// Cytoscape's own styling engine doesn't resolve CSS custom properties —
// it needs literal values, so these duplicate scx.css's actual token
// colors rather than referencing var(--x) the way normal DOM/React styles
// in this file do.
const TERMINAL_COLOR: Record<TerminalState, string> = {
  attributed: '#15754C',
  custodial_opaque: '#8F620D',
  infra_opaque: '#2A5FC4',
  privacy_opaque: '#AD3527',
  sanctioned: '#131417',
  unresolved: '#807F79',
};
const CY_INK = '#131417';
const CY_INK_FAINT = '#B7B6B0';
const CY_VIOLET = '#6552BB';

const TERMINAL_LABEL: Record<TerminalState, string> = {
  attributed: 'Attributed',
  custodial_opaque: 'Custodial (opaque)',
  infra_opaque: 'Infrastructure (opaque)',
  privacy_opaque: 'Privacy (opaque)',
  sanctioned: 'Sanctioned',
  unresolved: 'Unresolved',
};

// Legend meanings — what a viewer would otherwise wrongly assume, spelled
// out. Custodial/Infrastructure matter most: they're the states a viewer
// will assume are bad unless told otherwise.
const LEGEND: { state: TerminalState; meaning: string }[] = [
  { state: 'attributed', meaning: 'origin evidenced' },
  { state: 'custodial_opaque', meaning: 'origin off-chain, reachable via Travel Rule' },
  { state: 'infra_opaque', meaning: 'no link by design' },
  { state: 'privacy_opaque', meaning: 'deliberate severance' },
  { state: 'unresolved', meaning: 'not observed' },
];

const INTEGRITY_STYLE: Record<PathIntegrity, { bg: string; border: string; color: string }> = {
  CLEAN: { bg: 'var(--green-soft)', border: 'var(--green-line)', color: 'var(--green)' },
  DEGRADED: { bg: 'var(--amber-soft)', border: 'var(--amber-line)', color: 'var(--amber)' },
  COMPROMISED: { bg: 'var(--red-soft)', border: 'var(--red-line)', color: 'var(--red)' },
};

// Real, generally-known infrastructure/issuer names — matched by substring
// against the label corpus's entity field, never by address. These are
// original monogram badges (see assets/entities/README), not reproductions
// of official logo artwork — identification only, no endorsement implied.
const BRAND_LOGOS: Record<string, string> = {
  circle: circleLogo, tether: tetherLogo, coinbase: coinbaseLogo, binance: binanceLogo,
  kraken: krakenLogo, uniswap: uniswapLogo, across: acrossLogo, layerzero: layerzeroLogo,
  wormhole: wormholeLogo, ethereum: ethereumLogo, base: baseLogo, arbitrum: arbitrumLogo,
};
const CLASS_GLYPH: Partial<Record<TerminalState, string>> = {
  privacy_opaque: privacyGlyph, sanctioned: sanctionedGlyph, unresolved: unresolvedGlyph,
};

function monogramDataUri(letter: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${bg}"/><text x="20" y="21" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-weight="700" font-size="16" fill="#ffffff">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolveLogo(n: ProvenanceGraphNode): string {
  const entity = n.label?.entity;
  if (entity) {
    const key = Object.keys(BRAND_LOGOS).find((k) => entity.toLowerCase().includes(k));
    if (key) return BRAND_LOGOS[key];
  }
  if (n.terminal_state && CLASS_GLYPH[n.terminal_state]) return CLASS_GLYPH[n.terminal_state]!;
  if (entity) return monogramDataUri(entity.trim()[0]?.toUpperCase() || '?', n.terminal_state ? TERMINAL_COLOR[n.terminal_state] : CY_INK_FAINT);
  return unresolvedGlyph;
}

function primaryLabel(n: ProvenanceGraphNode): string {
  if (n.depth === 0) return 'Counterparty';
  if (n.label?.entity) return n.label.entity;
  if (n.is_gas_funder) return 'Gas funder';
  if (n.is_disposable) return 'Fresh wallet';
  return 'Unlabeled';
}

/** Truncate as 4+4; widen colliding pairs to 6+6 so no two nodes ever share a visible label. */
function buildAddressLabels(addresses: string[]): Record<string, string> {
  const short = (a: string, n: number) => `${a.slice(0, 2 + n)}…${a.slice(-n)}`;
  const counts: Record<string, number> = {};
  addresses.forEach((a) => { const s = short(a, 4); counts[s] = (counts[s] || 0) + 1; });
  const out: Record<string, string> = {};
  addresses.forEach((a) => { out[a] = counts[short(a, 4)] > 1 ? short(a, 6) : short(a, 4); });
  return out;
}

function explorerUrl(chainId: number | null, address: string): string | null {
  if (chainId === 1) return `https://etherscan.io/address/${address}`;
  if (chainId === 84532) return `https://sepolia.basescan.org/address/${address}`;
  return null;
}

const AttributionBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
      <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{Math.round(value * 100)}%</span>
    </div>
    <div style={{ height: 8, borderRadius: 4, background: 'var(--gray-soft)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(2, value * 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
    </div>
  </div>
);

const StackedBreakdown: React.FC<{ breakdown: Record<TerminalState, number> }> = ({ breakdown }) => {
  const order: TerminalState[] = ['attributed', 'custodial_opaque', 'infra_opaque', 'privacy_opaque', 'sanctioned', 'unresolved'];
  const nonZero = order.filter((k) => (breakdown[k] || 0) > 0);
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
        Terminal-state breakdown
      </div>
      <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--edge)' }}>
        {nonZero.map((k) => (
          <div key={k} title={`${TERMINAL_LABEL[k]}: ${Math.round(breakdown[k] * 100)}%`}
               style={{ width: `${breakdown[k] * 100}%`, background: TERMINAL_COLOR[k] }} />
        ))}
      </div>
    </div>
  );
};

export const ProvenanceCard: React.FC<{ provenance: ProvenanceResult | null | undefined }> = ({ provenance }) => {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<ProvenanceGraphNode | null>(null);
  const [showGas, setShowGas] = useState(true);
  const [depthAxis, setDepthAxis] = useState<{ depth: number; x: number }[]>([]);
  const [frontierX, setFrontierX] = useState<number | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const addressLabels = useMemo(() => {
    if (!provenance) return {};
    return buildAddressLabels(provenance.graph.nodes.map((n) => n.address));
  }, [provenance]);

  useEffect(() => {
    if (provenance?.graph.nodes.length) {
      setSelected(provenance.graph.nodes.find((n) => n.depth === 0) || provenance.graph.nodes[0]);
    }
  }, [provenance]);

  const hasGasEdges = !!provenance?.graph.edges.some((e) => e.type === 'gas');

  const elements = useMemo(() => {
    if (!provenance) return [];
    const maxDepth = Math.max(0, ...provenance.graph.nodes.map((n) => n.depth));
    const nodes = provenance.graph.nodes.map((n) => {
      const disposableBadge = n.is_disposable && n.lifecycle
        ? `nonce ${n.lifecycle.terminal_nonce ?? '?'} · ${Math.round((n.lifecycle.dwell_seconds ?? 0) / 60)}m`
        : null;
      const clusterBadge = n.is_gas_funder && (n.fan_out_count || 0) >= 5 ? `×${n.fan_out_count}` : null;
      const lines = [primaryLabel(n), addressLabels[n.address] || n.address];
      if (disposableBadge) lines.push(disposableBadge);
      if (clusterBadge) lines.push(clusterBadge);
      return {
        data: {
          ...n, id: n.address,
          displayLabel: n.depth === 0 ? 'Counterparty' : lines.join('\n'),
          logoUrl: resolveLogo(n),
          ringColor: n.terminal_state ? TERMINAL_COLOR[n.terminal_state] : (n.depth === 0 ? CY_INK : CY_INK_FAINT),
          isTerminalDepth: n.depth === maxDepth,
        },
        classes: [
          n.depth === 0 ? 'target' : '',
          n.is_disposable ? 'disposable' : '',
          n.terminal_state ? `terminal-${n.terminal_state}` : '',
        ].filter(Boolean).join(' '),
      };
    });
    const edges = provenance.graph.edges
      .filter((e) => (showGas && hasGasEdges) || e.type !== 'gas')
      .map((e, i) => ({
        data: {
          id: `e${i}`, source: e.from, target: e.to,
          pctLabel: e.value_share != null && e.value_share > 0.15 ? `${Math.round(e.value_share * 100)}%` : '',
        },
        classes: e.type === 'gas' ? 'gas-edge' : 'flow-edge',
      }));
    return [...nodes, ...edges];
  }, [provenance, showGas, hasGasEdges, addressLabels]);

  const recomputeOverlay = (cy: cytoscape.Core) => {
    const byDepth = new Map<number, number[]>();
    cy.nodes().forEach((n) => {
      const d = n.data('depth') as number;
      const arr = byDepth.get(d) || [];
      arr.push(n.renderedPosition().x);
      byDepth.set(d, arr);
    });
    const entries = [...byDepth.entries()]
      .map(([depth, xs]) => ({ depth, x: xs.reduce((a, b) => a + b, 0) / xs.length }))
      .sort((a, b) => b.x - a.x); // rightmost (depth 0) first
    setDepthAxis(entries);
    if (provenance?.hops_to_severance != null) {
      const idx = entries.findIndex((e) => e.depth === provenance.hops_to_severance);
      if (idx >= 0) {
        const col = entries[idx];
        const next = entries[idx + 1];
        const gap = next ? col.x - next.x : 50;
        setFrontierX(col.x - gap / 2);
      }
    } else {
      setFrontierX(null);
    }
  };

  if (!provenance) {
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <div className="cbody" style={{ color: 'var(--ink-faint)', fontSize: 12.5, padding: '16px 18px' }}>
          Provenance analysis not available for this payment.
        </div>
      </div>
    );
  }

  if (!provenance.available) {
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <div className="cbody" style={{ color: 'var(--ink-faint)', fontSize: 12.5, padding: '16px 18px' }}>
          Provenance backend unreachable for this payment ({provenance.reason_codes.join(', ') || 'no backend configured'}) —
          this never blocks the payment itself, it just means this evidence is unavailable right now.
        </div>
      </div>
    );
  }

  const integrity = INTEGRITY_STYLE[provenance.path_integrity];
  const attributionColor = provenance.clean_path_attribution >= 0.7 ? '#15754C' : provenance.clean_path_attribution >= 0.3 ? '#8F620D' : '#AD3527';
  const gapPct = Math.round((provenance.raw_terminal_attribution - provenance.clean_path_attribution) * 100);
  const hasGap = gapPct >= 2;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="chead">
        <div className="ctitle">Provenance &amp; Path Integrity</div>
        <div className="csub" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: integrity.bg, color: integrity.color, border: `1px solid ${integrity.border}`,
          }}>
            PATH INTEGRITY: {provenance.path_integrity}
          </span>
          <button className="btn" style={{ padding: '5px 10px', fontSize: 11.5 }} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide graph' : 'View graph'}
          </button>
        </div>
      </div>

      <div className="cbody">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <AttributionBar label="Clean-path attribution" value={provenance.clean_path_attribution} color={attributionColor} />
              <AttributionBar label="Raw terminal attribution" value={provenance.raw_terminal_attribution} color="#807F79" />
            </div>
            {hasGap ? (
              <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>⚠</span> {gapPct}% gap — terminal reached, path not evidenced
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-faint)' }}>Terminal and path evidence agree.</div>
            )}
          </div>

          <StackedBreakdown breakdown={provenance.terminal_breakdown} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11, color: 'var(--ink-soft)' }}>
            {LEGEND.map((l) => (
              <div key={l.state} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: TERMINAL_COLOR[l.state], flex: '0 0 auto' }} />
                <b>{TERMINAL_LABEL[l.state]}</b> — {l.meaning}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Hops to severance</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{provenance.hops_to_severance ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Label coverage</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(provenance.label_coverage * 100)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Corpus / heuristic version</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>{provenance.corpus_version} / v{provenance.heuristic_version}</div>
            </div>
          </div>

          {(provenance.reason_codes.length > 0 || provenance.signals_fired.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {provenance.reason_codes.map((rc) => (
                <span key={rc} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid var(--red-line)' }}>{rc}</span>
              ))}
              {provenance.signals_fired.map((s) => (
                <span key={s} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: 'var(--violet-soft)', color: 'var(--violet)', border: '1px solid var(--violet-line)' }}>{s.replace(/_/g, ' ')}</span>
              ))}
            </div>
          )}

          {expanded && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Funding graph — flows right → left (ancestry runs backwards)
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: hasGasEdges ? 'var(--ink-soft)' : 'var(--ink-faint)', cursor: hasGasEdges ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={showGas && hasGasEdges} disabled={!hasGasEdges} onChange={(e) => setShowGas(e.target.checked)} />
                  Gas-funding edges {!hasGasEdges && <span>(none traced)</span>}
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', height: 340, border: '1px solid var(--edge)', borderRadius: '10px 10px 0 0', background: '#FAFAF8', overflow: 'hidden' }}>
                    {frontierX != null && (
                      <>
                        <div style={{ position: 'absolute', left: 0, top: 0, width: Math.max(0, frontierX), height: '100%', background: 'rgba(0,0,0,0.035)', pointerEvents: 'none', zIndex: 1 }} />
                        <div style={{ position: 'absolute', left: frontierX, top: 0, width: 0, height: '100%', borderLeft: '2px dashed var(--ink-faint)', pointerEvents: 'none', zIndex: 1 }} />
                        <div style={{ position: 'absolute', left: Math.max(4, frontierX - 118), top: 6, fontSize: 9.5, color: 'var(--ink-faint)', width: 110, textAlign: 'right', pointerEvents: 'none', zIndex: 1, lineHeight: 1.3 }}>
                          beyond this point: not observable
                        </div>
                      </>
                    )}
                    <CytoscapeComponent
                      elements={CytoscapeComponent.normalizeElements(elements as never)}
                      style={{ width: '100%', height: '100%' }}
                      layout={{ name: 'dagre', rankDir: 'RL', rankSep: 90, nodeSep: 28, animate: false } as never}
                      cy={(cy) => {
                        cyRef.current = cy;
                        cy.off('tap', 'node');
                        cy.on('tap', 'node', (evt) => setSelected(evt.target.data() as ProvenanceGraphNode));
                        cy.off('layoutstop');
                        cy.on('layoutstop', () => recomputeOverlay(cy));
                        setTimeout(() => recomputeOverlay(cy), 60);
                      }}
                      stylesheet={[
                        { selector: 'node', style: {
                          'background-image': 'data(logoUrl)' as never, 'background-fit': 'cover', 'background-clip': 'node',
                          'border-width': 3, 'border-color': 'data(ringColor)' as never, 'border-style': 'solid',
                          label: 'data(displayLabel)', 'text-wrap': 'wrap', 'text-max-width': '90px',
                          'text-valign': 'bottom', 'text-margin-y': 6, 'font-size': 8, color: CY_INK as never,
                          width: 28, height: 28,
                        } as never },
                        { selector: 'node.disposable', style: { 'border-style': 'dashed' } as never },
                        { selector: 'node.target', style: { width: 42, height: 42, 'border-width': 4, 'border-color': CY_INK as never, 'background-color': '#ffffff' as never } as never },
                        { selector: 'edge.flow-edge', style: {
                          width: 2, 'line-color': CY_INK_FAINT as never, 'target-arrow-shape': 'none', 'curve-style': 'bezier',
                          label: 'data(pctLabel)', 'font-size': 8, color: CY_INK as never, 'text-background-color': '#FAFAF8' as never, 'text-background-opacity': 1,
                        } as never },
                        { selector: 'edge.gas-edge', style: { width: 1.5, 'line-color': CY_VIOLET as never, 'line-style': 'dashed', 'curve-style': 'bezier', 'z-index': -1 } as never },
                      ]}
                    />
                  </div>
                  <div style={{ position: 'relative', height: 22, border: '1px solid var(--edge)', borderTop: 'none', borderRadius: '0 0 10px 10px', background: '#fff' }}>
                    {depthAxis.map(({ depth, x }) => (
                      <span key={depth} style={{ position: 'absolute', left: x - 20, top: 3, width: 40, textAlign: 'center', fontSize: 9.5, color: 'var(--ink-faint)' }}>
                        {depth === 0 ? 'Counterparty' : depth === depthAxis[0]?.depth ? depth : depth === Math.max(...depthAxis.map((d) => d.depth)) ? `Terminal (${depth})` : depth}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ width: 220, flex: '0 0 220px', border: '1px solid var(--edge)', borderRadius: 10, padding: 12, fontSize: 12 }}>
                  {selected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selected.label ? (
                        <div>
                          <div style={{ fontWeight: 700 }}>{selected.label.entity}</div>
                          <div style={{ color: 'var(--ink-faint)', fontSize: 10.5 }}>{selected.label.class} · confidence {Math.round(selected.label.confidence * 100)}%</div>
                          <div style={{ color: 'var(--ink-faint)', fontSize: 10, wordBreak: 'break-all', marginTop: 2 }}>source: {selected.label.source}</div>
                        </div>
                      ) : (
                        <div style={{ fontWeight: 700 }}>{primaryLabel(selected)}</div>
                      )}
                      <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 8 }}>
                        <div>Value share: <b>{Math.round(selected.value_share * 100)}%</b></div>
                        <div>Depth: <b>{selected.depth}</b>{selected.depth === 0 ? ' (this payment)' : ''}</div>
                      </div>
                      {(selected.lifecycle || selected.fan_out_count) && (
                        <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 8, color: 'var(--ink-soft)' }}>
                          {selected.lifecycle?.terminal_nonce != null && <div>Nonce: {selected.lifecycle.terminal_nonce}</div>}
                          {selected.lifecycle?.dwell_seconds != null && <div>Dwell: {Math.round(selected.lifecycle.dwell_seconds / 60)} min</div>}
                          {selected.lifecycle?.residual_balance_frac != null && <div>Value retained: {(100 - selected.lifecycle.residual_balance_frac * 100).toFixed(2)}%</div>}
                          {selected.fan_out_count != null && <div>Fans out to: {selected.fan_out_count} wallets</div>}
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 8 }}>
                        <div className="mono" style={{ fontSize: 10.5, wordBreak: 'break-all', color: 'var(--ink-soft)' }}>{selected.address}</div>
                        {explorerUrl(provenance.chain_id, selected.address) && (
                          <a href={explorerUrl(provenance.chain_id, selected.address)!} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--cobalt)' }}>
                            View on explorer ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--ink-faint)', lineHeight: 1.6, borderTop: '1px solid var(--divider)', paddingTop: 12 }}>
            Tier 1 (labeled contracts) is measurable set membership. Tier 2 (behavioral signals — lifecycle, value
            conservation, timing, gas provenance, clustering) has no ground truth and is reported descriptively, never
            as a precision/confidence figure implying statistical validation. Entity marks are simplified identification
            badges, not official logos — no endorsement or partnership implied.
          </div>
        </div>
      </div>
    </div>
  );
};
