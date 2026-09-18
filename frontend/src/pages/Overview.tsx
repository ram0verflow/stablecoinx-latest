import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { monitoringApi, paymentApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { IcArrowRight } from '../components/scx/icons';
import type { MonitoringStats } from '../types';

const defaultStats: MonitoringStats = {
  total_payments: 0, total_volume: 0, approved_today: 0, blocked_today: 0,
  pending_review: 0, avg_ai_latency_ms: 0, tx_success_rate: 0, top_corridors: [],
  ai_engine_status: 'down', rpc_status: { base_sepolia: false, polygon_amoy: false },
  neo4j_status: false, redis_status: false,
};

function mapPayment(p: any) {
  return {
    id: String(p.id),
    receiverCompany: p.receiver_company ?? p.receiverCompany ?? '',
    corridor: `${p.source_country ?? ''} → ${p.destination_country ?? ''}`,
    amount: Number(p.amount ?? 0),
    token: p.token ?? 'USDC',
    status: p.status ?? 'pending',
    createdAt: p.created_at ?? p.createdAt ?? new Date().toISOString(),
  };
}

const decisionTone: Record<string, string> = {
  pending: 'st-gray', under_review: 'st-amber', review: 'st-amber', revalidation: 'st-amber',
  approved: 'st-green', executed: 'st-green', failed: 'st-green', blocked: 'st-red', rejected: 'st-red',
};

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const [stats, setStats] = useState<MonitoringStats>(defaultStats);
  const [payments, setPayments] = useState<ReturnType<typeof mapPayment>[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, p] = await Promise.all([monitoringApi.stats(), paymentApi.list()]);
        setStats(s.data);
        setPayments((p.data || []).map(mapPayment));
      } catch {
        // best effort
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  const { moneyInMotion, awaitingApproval, settled, needsAttention, recent } = useMemo(() => {
    const inMotion = payments.filter((p) => ['pending', 'under_review', 'approved'].includes(p.status));
    const awaiting = payments.filter((p) => ['pending', 'under_review'].includes(p.status));
    const done = payments.filter((p) => p.status === 'executed');
    const attention = payments.filter((p) => ['under_review', 'blocked', 'failed'].includes(p.status)).slice(0, 5);
    const sortedRecent = [...payments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
    return {
      moneyInMotion: inMotion.reduce((s, p) => s + p.amount, 0),
      awaitingApproval: awaiting.reduce((s, p) => s + p.amount, 0),
      settled: done.reduce((s, p) => s + p.amount, 0),
      needsAttention: attention,
      recent: sortedRecent,
    };
  }, [payments]);

  const canCreate = role === 'treasury_officer' || role === 'admin';
  const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <>
      <div className="topbar">
        <div className="topbar-row">
          <div>
            <h1>Overview</h1>
            <p>Welcome back, {user?.name || 'operator'}. Institutional settlement workspace.</p>
          </div>
          {canCreate && (
            <div className="topbar-right">
              <button className="btn btn-cobalt" onClick={() => navigate('/create-payment')}>+ Create Payment</button>
            </div>
          )}
        </div>
      </div>

      <div className="content pad-t">
        <div className="ov-grid">
          <div className="ov-stat"><div className="l">Money in Motion</div><div className="v num">{fmt(moneyInMotion)}</div></div>
          <div className="ov-stat"><div className="l">Awaiting Approval</div><div className="v num">{fmt(awaitingApproval)}</div></div>
          <div className="ov-stat"><div className="l">Settled</div><div className="v num">{fmt(settled)}</div></div>
          <div className="ov-stat"><div className="l">Settlement Failures</div><div className="v">{payments.filter((p) => p.status === 'failed').length}</div></div>
        </div>

        <div className="ov-cols">
          <div className="ov-panel">
            <div className="ov-panel-head"><b>Needs Attention</b><span className="pill"><span className="d d-amber" />{needsAttention.length} open</span></div>
            {needsAttention.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>Nothing needs attention right now.</div>
            ) : needsAttention.map((p) => (
              <div key={p.id} className="ov-row" onClick={() => navigate(`/route-analysis/${p.id}`)}>
                <div>
                  <span className="pay-id mono">#{p.id.slice(0, 8)}</span>
                  <div className="pay-sub">{p.receiverCompany || '—'} · {p.corridor}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="amt num">${p.amount.toLocaleString()}</span>
                  <IcArrowRight className="" />
                </div>
              </div>
            ))}
          </div>

          <div className="ov-panel">
            <div className="ov-panel-head"><b>Service Health</b></div>
            {[
              { label: 'AI Advisory', ok: stats.ai_engine_status !== 'down' },
              { label: 'Base Sepolia RPC', ok: stats.rpc_status.base_sepolia },
              { label: 'Polygon Amoy RPC', ok: stats.rpc_status.polygon_amoy },
              { label: 'Wallet Graph', ok: stats.neo4j_status },
              { label: 'Cache', ok: stats.redis_status },
            ].map((s) => (
              <div key={s.label} className="svc-row">
                <span className="n">{s.label}</span>
                <span className={`status ${s.ok ? 'st-green' : 'st-red'}`}><span className="d" style={{ background: 'currentColor' }} />{s.ok ? 'Live' : 'Down'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Payment</th><th>Counterparty</th><th>Corridor</th><th style={{ textAlign: 'right' }}>Amount</th><th>Decision</th><th>Age</th></tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/route-analysis/${p.id}`)}>
                  <td className="pay-id mono">#{p.id.slice(0, 8)}</td>
                  <td>{p.receiverCompany || '—'}</td>
                  <td><span className="corridor">{p.corridor}</span></td>
                  <td style={{ textAlign: 'right' }}><span className="amt num">${p.amount.toLocaleString()} {p.token}</span></td>
                  <td><span className={`status ${decisionTone[p.status] || 'st-gray'}`}><span className="d" style={{ background: 'currentColor' }} />{p.status.replace(/_/g, ' ')}</span></td>
                  <td className="age">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
