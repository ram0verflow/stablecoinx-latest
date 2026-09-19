import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { paymentApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/ToastProvider';
import { getStatusTone, type Tone } from '../components/StatusBadge';
import { IcArrowRight, IcLock, IcAlertCircle } from '../components/scx/icons';
import { CounterpartyIntelligenceCard } from '../components/CounterpartyIntelligenceCard';
import { ProvenanceCard } from '../components/ProvenanceCard';
import type { CounterpartyIntelligence } from '../types';

interface PipelineStage { label: string; passed: boolean; status: string; detail: string }
interface PaymentDetails {
  id: string; status: string;
  sender_company?: string; receiver_company?: string;
  source_country?: string; destination_country?: string;
  source_chain?: string; destination_chain?: string;
  sender_wallet?: string; receiver_wallet?: string;
  amount?: number; token?: string; created_at?: string;
  pipeline_stages?: Record<string, PipelineStage>;
  compliance_decision?: { final_decision?: string; ai_decision?: string; ai_reasoning?: string } | null;
  counterparty_intelligence?: CounterpartyIntelligence | null;
}

const SECTIONS: { title: string; layers: string[] }[] = [
  { title: 'Identity & Counterparty', layers: ['layer_1_kyc_kyb', 'layer_2_kyc_kyb_verified'] },
  { title: 'Compliance & Risk', layers: ['layer_3_sanctions', 'layer_4_wallet_risk', 'layer_6_issuer_risk'] },
  { title: 'Treasury & Policy', layers: ['layer_5_corridor_policy', 'layer_9_treasury', 'layer_13_policy_veto'] },
  { title: 'Routing & Intelligence', layers: ['layer_7_chain_governance', 'layer_8_liquidity', 'layer_12_ai_decision'] },
  { title: 'Authorization & Settlement', layers: ['layer_10_fhe', 'layer_11_zk_proof', 'layer_14_execution'] },
];

const TERMINAL_STATUSES = ['approved', 'blocked', 'executed', 'under_review', 'failed', 'rejected', 'revalidation'];

const STATE_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  pending: { bg: 'var(--gray-soft)', border: 'var(--gray-line)', color: 'var(--ink-muted)', label: 'Pending' },
  under_review: { bg: 'var(--amber-soft)', border: 'var(--amber-line)', color: 'var(--amber)', label: 'Awaiting second approval' },
  review: { bg: 'var(--amber-soft)', border: 'var(--amber-line)', color: 'var(--amber)', label: 'Needs review' },
  approved: { bg: 'var(--green-soft)', border: 'var(--green-line)', color: 'var(--green)', label: 'Approved — settling' },
  executed: { bg: 'var(--green-soft)', border: 'var(--green-line)', color: 'var(--green)', label: 'Settled' },
  blocked: { bg: 'var(--red-soft)', border: 'var(--red-line)', color: 'var(--red)', label: 'Blocked' },
  rejected: { bg: 'var(--red-soft)', border: 'var(--red-line)', color: 'var(--red)', label: 'Rejected' },
  failed: { bg: 'var(--red-soft)', border: 'var(--red-line)', color: 'var(--red)', label: 'Settlement failed' },
  revalidation: { bg: 'var(--amber-soft)', border: 'var(--amber-line)', color: 'var(--amber)', label: 'Needs revalidation' },
};

const SETTLEMENT_LABEL: Record<string, string> = {
  pending: 'Locked', under_review: 'Locked', review: 'Locked',
  approved: 'Settling', executed: 'Executed', failed: 'Failed',
  blocked: 'Prevented', rejected: 'Prevented', revalidation: 'Settled',
};

export const RouteAnalysis: React.FC = () => {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { canApprove } = useAuthStore();
  const { showToast } = useToast();
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [view, setView] = useState<'trace' | 'flow'>('trace');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!paymentId) return;
    let count = 0;
    const MAX_POLLS = 300;
    let timer: ReturnType<typeof setInterval>;
    const poll = async () => {
      try {
        count += 1;
        const { data } = await paymentApi.getById(paymentId);
        setPayment(data as unknown as PaymentDetails);
        if (TERMINAL_STATUSES.includes(String((data as any).status || '').toLowerCase()) || count >= MAX_POLLS) {
          setIsPolling(false);
          clearInterval(timer);
        }
      } catch {
        if (count >= MAX_POLLS) { setIsPolling(false); clearInterval(timer); }
      }
    };
    setIsPolling(true);
    poll();
    timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [paymentId]);

  const sectionState = (layers: string[]) => {
    const stages = layers.map((k) => payment?.pipeline_stages?.[k]).filter(Boolean) as PipelineStage[];
    if (stages.length === 0) return { clear: 0, total: layers.length, tone: 'unknown' as Tone };
    let worst: Tone = 'pass';
    let clear = 0;
    stages.forEach((s) => {
      const tone = getStatusTone(s.status);
      if (tone === 'pass') clear += 1;
      if (tone === 'blocked') worst = 'blocked';
      else if (tone === 'review' && worst !== 'blocked') worst = 'review';
      else if (tone === 'processing' && worst === 'pass') worst = 'processing';
    });
    return { clear, total: layers.length, tone: worst };
  };

  const finalDecision = String(payment?.status || payment?.compliance_decision?.final_decision || '').toLowerCase();
  const state = STATE_STYLE[finalDecision] || STATE_STYLE.pending;

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!paymentId) return;
    setActing(true);
    try {
      if (action === 'approve') await paymentApi.approve(paymentId);
      else await paymentApi.reject(paymentId);
      showToast(action === 'approve' ? 'success' : 'error', `Payment ${action === 'approve' ? 'approved' : 'rejected'}`, paymentId);
      const { data } = await paymentApi.getById(paymentId);
      setPayment(data as unknown as PaymentDetails);
    } catch {
      showToast('error', 'Action failed', 'Could not update this payment');
    } finally {
      setActing(false);
    }
  };

  const flowChain = useMemo(() => {
    const groups = SECTIONS.map((s) => sectionState(s.layers));
    const humanApproval = ['pending', 'under_review', 'review'].includes(finalDecision) ? 'active' : (['approved', 'executed'].includes(finalDecision) ? 'done' : finalDecision === 'blocked' ? 'blocked' : 'pending');
    const nodes: { label: string; state: 'done' | 'active' | 'pending' | 'blocked'; detail?: string }[] = [
      { label: 'Payment Intent', state: 'done' },
      { label: 'Treasury Check', state: groups[2].tone === 'blocked' ? 'blocked' : groups[2].clear > 0 ? 'done' : 'pending' },
      { label: 'Compliance', state: groups[1].tone === 'blocked' ? 'blocked' : groups[1].clear > 0 ? 'done' : 'pending' },
      { label: 'Policy Decision', state: finalDecision === 'blocked' ? 'blocked' : ['pending', 'under_review', 'review'].includes(finalDecision) ? 'done' : 'done' },
      { label: 'Human Approval', state: humanApproval as any },
      { label: 'Authorization', state: ['approved', 'executed'].includes(finalDecision) ? 'done' : finalDecision === 'blocked' ? 'blocked' : 'pending' },
      { label: 'Settlement', state: finalDecision === 'executed' ? 'done' : finalDecision === 'blocked' ? 'blocked' : 'pending' },
      { label: 'Proof', state: finalDecision === 'executed' ? 'done' : finalDecision === 'blocked' ? 'blocked' : 'pending' },
    ];
    return nodes;
  }, [payment, finalDecision]);

  if (!payment) {
    return (
      <div className="scx-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Loading payment control room…</p>
      </div>
    );
  }

  return (
    <div className="scx-page">
      <div className="crumb">Payments &nbsp;/&nbsp; <b>#{payment.id.slice(0, 8)}</b></div>

      <div className="pd-head">
        <div className="pd-head-l">
          <div className="pd-head-id"><div className="idtag">#{payment.id.slice(0, 8)}</div></div>
          <div className="parties">{payment.sender_company || 'Sender'} <IcArrowRight className="" /> {payment.receiver_company || 'Receiver'}</div>
          <div className="headline">
            <div className="amt num">${Number(payment.amount ?? 0).toLocaleString()}</div>
            <div className="cur">{payment.token || 'USDC'}</div>
            <div className="cor">{payment.source_country} → {payment.destination_country}</div>
          </div>
        </div>
        <div className="pd-head-r">
          <div className="state-primary" style={{ background: state.bg, border: `1px solid ${state.border}`, color: state.color }}><span className="d" />{state.label}</div>
          <div className="state-secondary"><IcLock className="" />Settlement {SETTLEMENT_LABEL[finalDecision] || 'Locked'}</div>
          <div className="head-actions">
            <button className="btn" onClick={() => navigate('/payments')}>All Payments</button>
            {canApprove() && ['pending', 'under_review', 'review'].includes(payment.status) && (
              <button className="btn btn-primary" disabled={acting} onClick={() => handleAction('approve')}>Approve</button>
            )}
          </div>
        </div>
      </div>

      <div className="strip">
        <div className="strip-cell"><div className="l">Decision</div><div className="v" style={{ color: state.color }}><span className="d" style={{ background: state.color }} />{finalDecision.replace(/_/g, ' ')}</div></div>
        <div className="strip-cell"><div className="l">Approval</div><div className="v">{['pending', 'under_review', 'review'].includes(finalDecision) ? 'Required' : finalDecision === 'blocked' ? '—' : 'Cleared'}</div></div>
        <div className="strip-cell"><div className="l">Settlement</div><div className="v">{SETTLEMENT_LABEL[finalDecision] || 'Locked'}</div></div>
        <div className="strip-cell"><div className="l">Network</div><div className="v mono" style={{ fontSize: 12 }}>{payment.destination_chain || '—'}</div></div>
      </div>

      {isPolling && (
        <div style={{ marginTop: 16, padding: '10px 16px', borderRadius: 'var(--r-m)', background: 'var(--cobalt-soft)', color: 'var(--cobalt-ink)', fontSize: 12.5, fontWeight: 600 }}>
          Compliance pipeline is running — this page updates automatically.
        </div>
      )}

      <div className="viewbar">
        <h2>Decision Trace</h2>
        <div className="seg">
          <button className={`seg-btn${view === 'trace' ? ' on' : ''}`} onClick={() => setView('trace')}>Trace</button>
          <button className={`seg-btn${view === 'flow' ? ' on' : ''}`} onClick={() => setView('flow')}>View Decision Flow</button>
        </div>
      </div>

      {view === 'trace' && (
        <div className="domains">
          {SECTIONS.map((section, i) => {
            const { clear, total, tone } = sectionState(section.layers);
            return (
              <div className="domain" key={section.title}>
                <div className="dhead">
                  <div className="dhead-l"><div className="dnum">{i + 1}</div><div className="dname">{section.title}</div></div>
                  <div className="dsum">{clear} of {total} clear</div>
                </div>
                <div className="dbody">
                  {section.layers.map((key) => {
                    const stage = payment.pipeline_stages?.[key];
                    const t = stage ? getStatusTone(stage.status) : 'unknown';
                    const mkClass = t === 'pass' ? 'mk-ok' : t === 'blocked' ? 'mk-warn' : t === 'review' ? 'mk-warn' : 'mk-pend';
                    const mkChar = t === 'pass' ? '✓' : t === 'blocked' ? '!' : t === 'review' ? '!' : '○';
                    return (
                      <div className="check" key={key}>
                        <span className={`mk ${mkClass}`}>{mkChar}</span>
                        <span className="cl">{stage?.label || key.replace(/_/g, ' ')}</span>
                        {stage?.detail && <span className="cr">{stage.detail}</span>}
                      </div>
                    );
                  })}
                  {section.title === 'Routing & Intelligence' && payment.compliance_decision?.ai_reasoning && (
                    <div style={{ padding: '6px 0 8px' }}><span className="ai-chip">AI Advisory: {payment.compliance_decision.ai_reasoning.slice(0, 80)}</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'trace' && payment && (
        <>
          <div className="sec-label" style={{ marginTop: 18 }}>Compliance & Risk — Counterparty Intelligence</div>
          <CounterpartyIntelligenceCard intel={payment.counterparty_intelligence} />
          <ProvenanceCard provenance={payment.counterparty_intelligence?.provenance} />
        </>
      )}

      {view === 'flow' && (
        <div className="flowpanel">
          <div className="chain">
            {flowChain.map((n, i) => (
              <React.Fragment key={n.label}>
                <div className={`cnode ${n.state}`}>
                  <div className="cb">{n.state === 'done' ? '✓' : n.state === 'blocked' ? '✕' : n.state === 'active' ? i + 1 : '○'}</div>
                  <div className="clabel">{n.label}</div>
                  {n.detail && <div className="cdetail">{n.detail}</div>}
                </div>
                {i < flowChain.length - 1 && <div className={`cline ${n.state === 'blocked' ? 'veto' : n.state === 'pending' || n.state === 'active' ? 'pend' : ''}`} />}
              </React.Fragment>
            ))}
          </div>
          {finalDecision === 'blocked' && (
            <div className="veto-banner">
              <IcAlertCircle className="" />
              <div><div className="t">Deterministic policy vetoed this payment</div><div className="s">Policy has final authority — settlement cannot proceed regardless of AI advisory.</div></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
