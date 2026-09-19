import React from 'react';
import type { CounterpartyIntelligence, CounterpartyPolicyAction, CounterpartyRiskLevel } from '../types';

const RISK_STYLE: Record<CounterpartyRiskLevel, { bg: string; border: string; color: string; label: string }> = {
  low: { bg: 'var(--green-soft)', border: 'var(--green-line)', color: 'var(--green)', label: 'Low' },
  medium: { bg: 'var(--amber-soft)', border: 'var(--amber-line)', color: 'var(--amber)', label: 'Medium' },
  high: { bg: 'var(--red-soft)', border: 'var(--red-line)', color: 'var(--red)', label: 'High' },
};

const POLICY_STYLE: Record<CounterpartyPolicyAction, { bg: string; border: string; color: string; label: string }> = {
  approved: { bg: 'var(--green-soft)', border: 'var(--green-line)', color: 'var(--green)', label: 'Approved' },
  enhanced_review: { bg: 'var(--amber-soft)', border: 'var(--amber-line)', color: 'var(--amber)', label: 'Enhanced Review' },
  blocked: { bg: 'var(--red-soft)', border: 'var(--red-line)', color: 'var(--red)', label: 'Blocked' },
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600 }}>{children}</div>
  </div>
);

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Status-color ring gauge — same anatomy as the wallet-risk gauge this
// replaces (ObfuscationCharts' ConfidenceGauge): a single value, one status
// color, the number and tier printed inside so color is never the only
// signal. `color` is picked by the caller from the fixed low/medium/high
// status palette already used for risk chips elsewhere in this card.
const RiskGauge: React.FC<{ score: number | null; tierLabel: string; color: string; unavailableLabel?: string }> = ({
  score, tierLabel, color, unavailableLabel,
}) => {
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  if (score == null) {
    return (
      <div style={{ position: 'relative', width: size, height: size, flex: `0 0 ${size}px` }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--edge)" strokeWidth={stroke} strokeDasharray="4 5" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-faint)', lineHeight: 1.3 }}>{unavailableLabel || 'No data'}</div>
        </div>
      </div>
    );
  }
  const pct = Math.max(0.03, Math.min(0.97, score / 100));
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
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{Math.round(score)}</div>
        <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 3 }}>{tierLabel}</div>
      </div>
    </div>
  );
};

const WALLET_TIER_COLOR: Record<string, string> = {
  low: 'var(--green)', medium: 'var(--amber)', high: 'var(--red)', critical: 'var(--red)', unknown: 'var(--ink-faint)',
};
const TRACE_TIER_COLOR: Record<string, string> = {
  full: 'var(--green)', partial: 'var(--amber)', opaque: 'var(--red)',
};

export const CounterpartyIntelligenceCard: React.FC<{ intel: CounterpartyIntelligence | null | undefined }> = ({ intel }) => {
  if (!intel) {
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <div className="cbody" style={{ color: 'var(--ink-faint)', fontSize: 12.5, padding: '16px 18px' }}>
          Counterparty intelligence not yet available for this payment.
        </div>
      </div>
    );
  }

  const risk = RISK_STYLE[intel.counterparty_risk_level] || RISK_STYLE.medium;
  const policy = POLICY_STYLE[intel.policy_action] || POLICY_STYLE.enhanced_review;
  const rt = intel.route_transparency;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="chead">
        <div className="ctitle">Counterparty Intelligence</div>
        <div className="csub" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: risk.bg, color: risk.color, border: `1px solid ${risk.border}`,
          }}>
            {risk.label} risk
          </span>
          <span style={{
            padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: policy.bg, color: policy.color, border: `1px solid ${policy.border}`,
          }}>
            {policy.label}
          </span>
        </div>
      </div>

      <div className="cbody">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {!intel.counterparty_wallet_configured && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, background: 'var(--gray-soft)', border: '1px solid var(--gray-line)',
              fontSize: 12, color: 'var(--ink-soft)',
            }}>
              Counterparty wallet not configured for this payment — showing the receiver wallet on file.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
            <Field label="Counterparty">{intel.counterparty_name}</Field>
            <Field label="Counterparty type">{intel.counterparty_type_label}</Field>
            <Field label="Chain">{intel.chain || '—'}</Field>
            <Field label="Counterparty wallet">
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 500, wordBreak: 'break-all' }}>
                {intel.counterparty_wallet || 'Not on file'}
              </span>
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <RiskGauge
                score={intel.wallet_intelligence.score}
                tierLabel={intel.wallet_intelligence.score != null ? titleCase(intel.wallet_intelligence.behavior_signal) : 'No history'}
                color={WALLET_TIER_COLOR[intel.wallet_intelligence.behavior_signal] || 'var(--ink-faint)'}
                unavailableLabel="Insufficient wallet history"
              />
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                  Wallet intelligence score
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5, maxWidth: 220 }}>
                  {intel.wallet_intelligence.score != null
                    ? `${intel.wallet_intelligence.score}/100 — behavior signal is ${intel.wallet_intelligence.behavior_signal}.`
                    : 'No prior wallet history on record for this counterparty.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <RiskGauge
                score={rt.transparency_score}
                tierLabel={titleCase(rt.trace_completeness)}
                color={TRACE_TIER_COLOR[rt.trace_completeness] || 'var(--ink-faint)'}
              />
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                  Route transparency score
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5, maxWidth: 220 }}>
                  {rt.transparency_score}/100 — trace is {rt.trace_completeness}, provenance confidence {rt.provenance_confidence}.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
            <Field label="KYB / KYC status">{titleCase(intel.kyb.status)} <span style={{ color: 'var(--ink-faint)', fontWeight: 500 }}>via {intel.kyb.provider === 'none' ? 'no provider' : titleCase(intel.kyb.provider)}</span></Field>
            <Field label="Provider / attestation">{intel.kyb.attestation_id || 'None on file'}</Field>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5, padding: '10px 12px', background: 'var(--gray-soft)', borderRadius: 8 }}>
            {intel.reason}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>
              Route Transparency
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, padding: '14px 16px', background: '#FAFAF8', border: '1px solid var(--edge)', borderRadius: 10 }}>
              <Field label="Route type">{titleCase(rt.route_type)}</Field>
              <Field label="Route provider">{rt.route_provider}</Field>
              <Field label="Origin → destination chain">{rt.origin_chain} → {rt.destination_chain}</Field>
              <Field label="Source wallet visibility">{titleCase(rt.source_wallet_visibility)}</Field>
              <Field label="Origin transaction hash">
                {rt.origin_tx_hash ? <span className="mono" style={{ fontSize: 11 }}>{rt.origin_tx_hash.slice(0, 14)}…</span> : 'Not visible'}
              </Field>
              <Field label="Destination transaction hash">
                {rt.destination_tx_hash ? <span className="mono" style={{ fontSize: 11 }}>{rt.destination_tx_hash.slice(0, 14)}…</span> : 'Not visible'}
              </Field>
              <Field label="Quote / order reference">{rt.quote_reference || 'Not available'}</Field>
              <Field label="Intermediate contracts known?">{rt.intermediate_contracts_known ? 'Yes' : 'No'}</Field>
              <Field label="Trace completeness">{titleCase(rt.trace_completeness)}</Field>
              <Field label="Provenance confidence">{titleCase(rt.provenance_confidence)}</Field>
            </div>
            {rt.notes && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 8, lineHeight: 1.5 }}>{rt.notes}</div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
              Evidence summary
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{intel.evidence_summary}</div>
          </div>

          {intel.missing_evidence_warnings.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                Missing evidence
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {intel.missing_evidence_warnings.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--amber)',
                    background: 'var(--amber-soft)', border: '1px solid var(--amber-line)', borderRadius: 8, padding: '7px 10px',
                  }}>
                    <span style={{ fontWeight: 700 }}>!</span>
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--ink-faint)', lineHeight: 1.6, borderTop: '1px solid var(--divider)', paddingTop: 12 }}>
            Privacy-like behavior is not treated as guilt — opaque route provenance lowers confidence, it does not automatically prove illicit activity.
            StableCoinX gates the enterprise's own settlement authorization; it does not claim to control third-party relays or deanonymize a private relay.
          </div>
        </div>
      </div>
    </div>
  );
};
