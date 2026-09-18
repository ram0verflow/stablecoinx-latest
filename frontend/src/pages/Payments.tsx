import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentApi, obfuscationApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { IcSearch, IcArrowRight } from '../components/scx/icons';
import { getObfuscationDemoForPayment } from '../lib/obfuscationDemoPayments';
import type { ObfuscationAnalyzeResult } from '../types';

const OBF_POLICY_TONE: Record<string, string> = {
  ENHANCED_REVIEW: 'st-amber',
  NO_OBFUSCATION_ACTION: 'st-green',
  INFORMATIONAL_ONLY: 'st-gray',
  BLOCKED_BY_EXTERNAL_ATTRIBUTION: 'st-red',
  MANUAL_REVIEW_PROVIDER_UNAVAILABLE: 'st-amber',
};
const OBF_POLICY_LABEL: Record<string, string> = {
  ENHANCED_REVIEW: 'Enhanced Review',
  NO_OBFUSCATION_ACTION: 'No Action',
  INFORMATIONAL_ONLY: 'Informational',
  BLOCKED_BY_EXTERNAL_ATTRIBUTION: 'Blocked — Attribution',
  MANUAL_REVIEW_PROVIDER_UNAVAILABLE: 'Provider Unavailable',
};

function mapPayment(p: any) {
  return {
    id: String(p.id),
    senderCompany: p.sender_company ?? p.senderCompany ?? '',
    receiverCompany: p.receiver_company ?? p.receiverCompany ?? '',
    sourceCountry: p.source_country ?? '',
    destinationCountry: p.destination_country ?? '',
    corridor: `${p.source_country ?? ''} → ${p.destination_country ?? ''}`,
    amount: Number(p.amount ?? 0),
    token: p.token ?? 'USDC',
    status: String(p.status ?? 'pending'),
    createdAt: p.created_at ?? p.createdAt ?? new Date().toISOString(),
  };
}

const decisionLabel: Record<string, string> = {
  pending: 'Pending', under_review: 'Needs Review', review: 'Needs Review',
  approved: 'Approved', executed: 'Approved', failed: 'Approved',
  blocked: 'Blocked', rejected: 'Blocked', revalidation: 'Revalidation Required',
};
const decisionTone: Record<string, string> = {
  pending: 'st-gray', under_review: 'st-amber', review: 'st-amber',
  approved: 'st-green', executed: 'st-green', failed: 'st-green',
  blocked: 'st-red', rejected: 'st-red', revalidation: 'st-amber',
};
const settlementLabel: Record<string, string> = {
  pending: 'Locked', under_review: 'Locked', review: 'Locked',
  approved: 'Settling', executed: 'Executed', failed: 'Failed',
  blocked: 'Prevented', rejected: 'Prevented', revalidation: 'Settled',
};
const settlementTone: Record<string, string> = {
  pending: 'st-gray', under_review: 'st-gray', review: 'st-gray',
  approved: 'st-blue', executed: 'st-green', failed: 'st-red',
  blocked: 'st-red', rejected: 'st-red', revalidation: 'st-green',
};

const timeSince = (ts: string) => {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
};

export const Payments: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const [payments, setPayments] = useState<ReturnType<typeof mapPayment>[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [obfResults, setObfResults] = useState<Record<string, ObfuscationAnalyzeResult>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await paymentApi.list();
        setPayments((data || []).map(mapPayment));
      } catch {
        // best effort
      }
    };
    load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    payments.forEach((p) => {
      const demo = getObfuscationDemoForPayment(p.id);
      if (demo && !obfResults[p.id]) {
        obfuscationApi.analyze(demo.txid, 'bitcoin')
          .then(({ data }) => setObfResults((prev) => ({ ...prev, [p.id]: data })))
          .catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments]);

  const counts = useMemo(() => ({
    all: payments.length,
    needs_action: payments.filter((p) => ['under_review', 'review', 'blocked', 'failed'].includes(p.status)).length,
    awaiting_approval: payments.filter((p) => ['pending', 'under_review', 'review'].includes(p.status)).length,
    blocked: payments.filter((p) => p.status === 'blocked').length,
    settling: payments.filter((p) => p.status === 'approved').length,
    revalidation: payments.filter((p) => p.status === 'revalidation').length,
  }), [payments]);

  const filtered = useMemo(() => {
    let list = payments;
    if (filter === 'needs_action') list = list.filter((p) => ['under_review', 'review', 'blocked', 'failed'].includes(p.status));
    if (filter === 'awaiting_approval') list = list.filter((p) => ['pending', 'under_review', 'review'].includes(p.status));
    if (filter === 'blocked') list = list.filter((p) => p.status === 'blocked');
    if (filter === 'settling') list = list.filter((p) => p.status === 'approved');
    if (filter === 'revalidation') list = list.filter((p) => p.status === 'revalidation');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.id.toLowerCase().includes(q) || p.senderCompany.toLowerCase().includes(q) || p.receiverCompany.toLowerCase().includes(q) || p.corridor.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payments, filter, search]);

  const canCreate = role === 'treasury_officer' || role === 'admin';

  return (
    <>
      <div className="topbar">
        <div className="topbar-row">
          <div>
            <h1>Payments</h1>
            <p>Institutional transaction workspace — cross-border stablecoin settlement.</p>
          </div>
          <div className="topbar-right">
            <span className="pill"><span className="d d-green" />Live</span>
            {canCreate && <button className="btn btn-cobalt" onClick={() => navigate('/create-payment')}>+ Create Payment</button>}
          </div>
        </div>
      </div>

      <div className="tabs">
        {[
          ['all', 'All', counts.all],
          ['needs_action', 'Needs Action', counts.needs_action],
          ['awaiting_approval', 'Awaiting Approval', counts.awaiting_approval],
          ['blocked', 'Blocked', counts.blocked],
          ['settling', 'Settling', counts.settling],
          ['revalidation', 'Revalidation Required', counts.revalidation],
        ].map(([id, label, count]) => (
          <button key={id as string} className={`tab${filter === id ? ' on' : ''}`} onClick={() => setFilter(id as string)}>
            {label}<span className="c">{count}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="search">
          <IcSearch />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payments, counterparties, wallets…" />
        </div>
      </div>

      <div className="content">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Payment</th><th>Counterparty</th><th>Corridor</th><th style={{ textAlign: 'right' }}>Amount</th>
                <th>Decision</th><th>Settlement</th><th>Obfuscation</th><th>Age</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const demo = getObfuscationDemoForPayment(p.id);
                const obf = demo ? obfResults[p.id] : undefined;
                return (
                  <tr key={p.id} onClick={() => navigate(`/route-analysis/${p.id}`)}>
                    <td><div className="pay-id mono">#{p.id.slice(0, 8)}</div></td>
                    <td><div>{p.senderCompany || '—'}</div><div className="pay-sub">{p.receiverCompany || '—'}</div></td>
                    <td><div className="corridor"><IcArrowRight />{p.corridor}</div></td>
                    <td style={{ textAlign: 'right' }}><span className="amt num">${p.amount.toLocaleString()}</span></td>
                    <td><span className={`status ${decisionTone[p.status] || 'st-gray'}`}><span className="d" style={{ background: 'currentColor' }} />{decisionLabel[p.status] || p.status}</span></td>
                    <td><span className={`status ${settlementTone[p.status] || 'st-gray'}`}><span className="d" style={{ background: 'currentColor' }} />{settlementLabel[p.status] || '—'}</span></td>
                    <td>
                      {demo ? (
                        <span
                          className={`status ${obf ? OBF_POLICY_TONE[obf.policy_recommendation] || 'st-gray' : 'st-gray'}`}
                          onClick={(e) => { e.stopPropagation(); navigate(`/obfuscation-intelligence?txid=${demo.txid}`); }}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="d" style={{ background: 'currentColor' }} />
                          {obf ? (OBF_POLICY_LABEL[obf.policy_recommendation] || obf.policy_recommendation) : 'Analyzing…'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>—</span>
                      )}
                    </td>
                    <td className="age">{timeSince(p.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>No payments match this view.</div>
          )}
        </div>
      </div>
    </>
  );
};
