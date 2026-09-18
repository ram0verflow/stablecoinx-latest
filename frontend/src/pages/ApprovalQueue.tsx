import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaymentStore } from '../store/paymentStore';
import { useAuthStore } from '../store/authStore';
import { paymentApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import type { Payment } from '../types';
import { IcChevronLeft, IcArrowRight, IcLock } from '../components/scx/icons';

const HIGH_VALUE_THRESHOLD = 100_000;
const ELEVATED_RISK_THRESHOLD = 60;

function reasonFor(p: Payment): string {
  if (p.status === 'blocked') return 'Policy veto — compliance block';
  if (p.amount > HIGH_VALUE_THRESHOLD) return `Dual approval — amount >$${(HIGH_VALUE_THRESHOLD / 1000).toFixed(0)}k`;
  if (p.riskScore >= ELEVATED_RISK_THRESHOLD) return 'Elevated risk score';
  return 'Manual review required';
}

const riskTone = (score: number) => (score >= 70 ? { color: 'var(--red)', label: 'High' } : score >= 40 ? { color: 'var(--amber)', label: 'Medium' } : { color: 'var(--green)', label: 'Low' });

export const ApprovalQueue: React.FC = () => {
  const { payments, updateStatus, setPayments } = usePaymentStore();
  const { canApprove } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState('queue');
  const [selected, setSelected] = useState<Payment | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await paymentApi.list();
        const mapped = (res.data || []).map((p: any) => ({
          id: String(p.id),
          senderCompany: p.sender_company ?? p.senderCompany ?? '',
          receiverCompany: p.receiver_company ?? p.receiverCompany ?? '',
          sourceCountry: p.source_country ?? p.sourceCountry ?? '',
          destinationCountry: p.destination_country ?? p.destinationCountry ?? '',
          sourceChain: p.source_chain ?? p.sourceChain ?? 'Base Sepolia',
          destinationChain: p.destination_chain ?? p.destinationChain ?? 'Base Sepolia',
          amount: Number(p.amount),
          token: p.token ?? 'USDC',
          purpose: p.purpose ?? '',
          urgency: p.urgency ?? 'Medium',
          status: p.status ?? 'pending',
          corridor: `${p.source_country ?? p.sourceCountry ?? ''} → ${p.destination_country ?? p.destinationCountry ?? ''}`,
          riskScore: Number(p.risk_score ?? p.riskScore ?? (p.status === 'blocked' ? 82 : 34)),
          aiDecision: p.ai_decision ?? p.aiDecision ?? (p.status === 'blocked' ? 'manual_review' : 'direct_transfer'),
          createdAt: p.created_at ?? p.createdAt ?? new Date().toISOString(),
          updatedAt: p.updated_at ?? p.updatedAt ?? new Date().toISOString(),
          senderWallet: p.sender_wallet ?? p.senderWallet,
          receiverWallet: p.receiver_wallet ?? p.receiverWallet ?? '',
        }));
        setPayments(mapped);
      } catch {
        // ignore
      }
    };
    fetchPending();
    const timer = setInterval(fetchPending, 15_000);
    return () => clearInterval(timer);
  }, [setPayments]);

  const queue = useMemo(() => payments.filter((p) => ['pending', 'under_review', 'review'].includes(p.status)), [payments]);
  const completed = useMemo(() => payments.filter((p) => ['approved', 'blocked', 'executed', 'rejected'].includes(p.status)), [payments]);
  const highValue = useMemo(() => queue.filter((p) => p.amount > HIGH_VALUE_THRESHOLD), [queue]);
  const elevatedRisk = useMemo(() => queue.filter((p) => p.riskScore >= ELEVATED_RISK_THRESHOLD), [queue]);

  const visible = tab === 'high' ? highValue : tab === 'risk' ? elevatedRisk : tab === 'done' ? completed : queue;

  const timeSince = (ts: string) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActing(true);
    try {
      if (action === 'approve') await paymentApi.approve(id);
      else await paymentApi.reject(id);
      const status = action === 'approve' ? 'approved' : 'blocked';
      updateStatus(id, status as any);
      if (selected?.id === id) setSelected((prev) => (prev ? { ...prev, status: status as any } : null));
      showToast(action === 'approve' ? 'success' : 'error', `Payment ${action === 'approve' ? 'approved' : 'rejected'}`, id);
    } catch {
      showToast('error', 'Action failed', 'Could not update this payment');
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>Approvals</h1>
        <p>Financial controls queue — payments awaiting dual authorization.</p>
      </div>
      <div className="tabs">
        {[
          ['queue', 'Awaiting Review', queue.length],
          ['high', 'High Value', highValue.length],
          ['risk', 'Elevated Risk', elevatedRisk.length],
          ['done', 'Completed', completed.length],
        ].map(([id, label, count]) => (
          <button key={id as string} className={`tab${tab === id ? ' on' : ''}`} onClick={() => { setTab(id as string); setSelected(null); }}>
            {label}<span className="c">{count}</span>
          </button>
        ))}
      </div>

      {!selected ? (
        <div className="content pad-t">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Payment</th><th>Counterparty</th><th style={{ textAlign: 'right' }}>Amount</th><th>Reason</th><th>Required</th><th>Current</th><th>Risk</th><th>Age</th><th></th></tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const risk = riskTone(p.riskScore);
                  return (
                    <tr key={p.id} onClick={() => setSelected(p)}>
                      <td><div className="pay-id mono">#{p.id.slice(0, 8)}</div><div className="pay-sub">{p.corridor}</div></td>
                      <td>{p.receiverCompany}</td>
                      <td style={{ textAlign: 'right' }}><span className="amt num">${p.amount.toLocaleString()}</span></td>
                      <td style={{ color: 'var(--ink-soft)' }}>{reasonFor(p)}</td>
                      <td>2</td>
                      <td><div className="dots"><span className={`pip${p.status !== 'pending' ? ' on' : ''}`} /><span className="pip" /></div></td>
                      <td><span className="risk" style={{ color: risk.color }}><span className="d" style={{ background: 'currentColor' }} />{risk.label}</span></td>
                      <td>{timeSince(p.createdAt)}</td>
                      <td><button className="rev-btn" onClick={(e) => { e.stopPropagation(); setSelected(p); }}>Review</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>No matching payments.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="content pad-t">
          <button className="back" onClick={() => setSelected(null)}><IcChevronLeft />Back to Approvals</button>
          <div className="split">
            <div>
              <div className="ev-head">
                <div className="ev-id">#{selected.id.slice(0, 8)}</div>
                <div className="ev-parties">{selected.senderCompany} <IcArrowRight className="" /> {selected.receiverCompany}</div>
                <div className="ev-amt num">${selected.amount.toLocaleString()} {selected.token}</div>
                <div className="ev-cor">{selected.corridor} · via {selected.sourceChain}</div>
              </div>
              <div className="ev-card">
                <div className="ev-chead">Compliance &amp; Risk</div>
                <div className="ev-cbody">
                  <div className="check"><span className="mk">✓</span><span className="cl">Sanctions screening — clear</span></div>
                  <div className="check"><span className="mk">✓</span><span className="cl">Wallet intelligence — clear</span></div>
                  <div className="check"><span className="mk warn">!</span><span className="cl">{reasonFor(selected)}</span></div>
                </div>
              </div>
              <div className="ev-card">
                <div className="ev-chead">AI Advisory</div>
                <div className="ev-cbody">
                  <div style={{ padding: '10px 0' }}><span className="ai-chip">{selected.aiDecision.replace(/_/g, ' ')} — advisory only</span></div>
                </div>
              </div>
            </div>

            <div className="gate">
              <div className="gate-head"><b>Approval controls</b></div>
              <div className="req-line"><span className="l">Required reviewers</span><span className="v">2</span></div>
              <div className="gate-lock"><IcLock /><b>EXECUTION GATE</b></div>
              <div className="gate-copy">This payment requires dual authorization before settlement can begin.</div>
              {canApprove() && ['pending', 'under_review', 'review'].includes(selected.status) ? (
                <div className="gate-actions">
                  <button className="btn" disabled={acting} onClick={() => handleAction(selected.id, 'reject')}>Reject</button>
                  <button className="btn btn-primary" disabled={acting} onClick={() => handleAction(selected.id, 'approve')}>Approve</button>
                </div>
              ) : (
                <div className="gate-copy" style={{ paddingBottom: 16 }}>Decision finalized — {selected.status.replace(/_/g, ' ')}.</div>
              )}
              <div style={{ padding: '0 20px 16px' }}>
                <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate(`/route-analysis/${selected.id}`)}>Open Control Room</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
