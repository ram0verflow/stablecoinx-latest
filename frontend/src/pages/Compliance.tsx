import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { monitoringApi, paymentApi } from '../lib/api';
import { IcAlertTriangle } from '../components/scx/icons';
import type { MonitoringStats } from '../types';

const defaultStats: MonitoringStats = {
  total_payments: 0, total_volume: 0, approved_today: 0, blocked_today: 0,
  pending_review: 0, avg_ai_latency_ms: 0, tx_success_rate: 0, top_corridors: [],
  ai_engine_status: 'down', rpc_status: { base_sepolia: false, polygon_amoy: false },
  neo4j_status: false, redis_status: false,
};

export const Compliance: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<MonitoringStats>(defaultStats);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, p] = await Promise.all([monitoringApi.stats(), paymentApi.list()]);
        setStats(s.data);
        setPayments(p.data || []);
      } catch {
        // best effort
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  const exceptions = useMemo(() => payments
    .filter((p: any) => p.status === 'blocked' || Number(p.risk_score ?? 0) >= 60)
    .map((p: any) => ({
      id: String(p.id),
      entity: p.receiver_company ?? p.sender_company ?? 'Unknown entity',
      risk: p.status === 'blocked' || Number(p.risk_score ?? 0) >= 80 ? 'Critical' : 'Elevated',
      reason: p.status === 'blocked' ? 'Policy veto — sanctions or corridor block' : 'Wallet / issuer risk score above threshold',
      source: p.status === 'blocked' ? 'Live' : stats.neo4j_status ? 'Live' : 'Cached',
      age: p.created_at,
    }))
    .slice(0, 8), [payments, stats.neo4j_status]);

  const providers = [
    { name: 'AI Advisory', sub: stats.ai_engine_status === 'down' ? 'Unavailable' : stats.ai_engine_status, ok: stats.ai_engine_status !== 'down', cls: stats.ai_engine_status !== 'down' ? 'pst-live' : 'pst-offline', label: stats.ai_engine_status !== 'down' ? 'Live' : 'Offline' },
    { name: 'Wallet Intelligence', sub: 'Neo4j graph', ok: stats.neo4j_status, cls: stats.neo4j_status ? 'pst-live' : 'pst-degraded', label: stats.neo4j_status ? 'Live' : 'Degraded' },
    { name: 'Settlement RPC · Base', sub: 'Base Sepolia', ok: stats.rpc_status.base_sepolia, cls: stats.rpc_status.base_sepolia ? 'pst-live' : 'pst-offline', label: stats.rpc_status.base_sepolia ? 'Live' : 'Offline' },
    { name: 'Settlement RPC · Polygon', sub: 'Polygon Amoy', ok: stats.rpc_status.polygon_amoy, cls: stats.rpc_status.polygon_amoy ? 'pst-live' : 'pst-offline', label: stats.rpc_status.polygon_amoy ? 'Live' : 'Offline' },
  ];

  return (
    <>
      <div className="topbar"><h1>Risk &amp; Compliance</h1><p>Provider provenance and evidence quality behind every decision.</p></div>
      <div className="content pad-t">
        <div className="sec-label">Provider Health</div>
        <div className="prow">
          {providers.map((p) => (
            <div className="pcard" key={p.name}>
              <div className="pcard-top"><div><div className="pname">{p.name}</div><div className="psub">{p.sub}</div></div></div>
              <div className={`pstatus ${p.cls}`}><span className="d" style={{ background: 'currentColor' }} />{p.label}</div>
            </div>
          ))}
        </div>

        {!stats.neo4j_status && (
          <div className="degraded-banner">
            <IcAlertTriangle className="" />
            <div><div className="t">Live wallet analysis is unavailable</div><div className="s">Payments requiring fresh evidence are routed to manual review instead of trusting a default low-risk result while this data source is unavailable.</div></div>
          </div>
        )}

        <div className="sec-label">Risk Exceptions</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Entity</th><th>Risk</th><th>Reason</th><th>Source</th><th>Age</th></tr></thead>
            <tbody>
              {exceptions.map((e) => (
                <tr key={e.id} onClick={() => navigate(`/route-analysis/${e.id}`)}>
                  <td style={{ fontWeight: 600 }}>{e.entity}</td>
                  <td><span className="risk-tag" style={{ color: e.risk === 'Critical' ? 'var(--red)' : 'var(--amber)' }}><span className="d" style={{ background: 'currentColor' }} />{e.risk}</span></td>
                  <td style={{ color: 'var(--ink-soft)' }}>{e.reason}</td>
                  <td><span className={`src-tag ${e.source === 'Live' ? 'src-live' : 'src-cached'}`}>{e.source}</span></td>
                  <td className="fresh">{new Date(e.age).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {exceptions.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>No open risk exceptions.</div>
          )}
        </div>
      </div>
    </>
  );
};
