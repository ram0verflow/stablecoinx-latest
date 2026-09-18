import React, { useEffect, useState } from 'react';
import { monitoringApi } from '../lib/api';
import { IcShield, IcIntegrations, IcCheck, IcPolicies } from '../components/scx/icons';
import type { MonitoringStats } from '../types';

const defaultStats: MonitoringStats = {
  total_payments: 0, total_volume: 0, approved_today: 0, blocked_today: 0,
  pending_review: 0, avg_ai_latency_ms: 0, tx_success_rate: 0, top_corridors: [],
  ai_engine_status: 'down', rpc_status: { base_sepolia: false, polygon_amoy: false },
  neo4j_status: false, redis_status: false,
};

export const Integrations: React.FC = () => {
  const [stats, setStats] = useState<MonitoringStats>(defaultStats);

  useEffect(() => {
    const load = () => monitoringApi.stats().then(({ data }) => setStats(data)).catch(() => {});
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  const complianceProvider = stats.compliance_provider;
  const complianceIsBeeceptor = complianceProvider?.name === 'beeceptor';
  const complianceStatus = complianceIsBeeceptor ? (complianceProvider?.configured ? 'live' : 'not_connected') : 'not_connected';
  const complianceDetail = complianceIsBeeceptor
    ? (complianceProvider?.configured ? 'Beeceptor mock provider configured — KYC/sanctions screened via POST /compliance/screen' : 'Beeceptor selected but BEECEPTOR_BASE_URL is not set')
    : 'Local deterministic provider · no external compliance API wired yet';

  const rows = [
    { name: 'Compliance Provider', purpose: 'KYC / sanctions / issuer risk', icon: <IcShield />, status: complianceStatus, detail: complianceDetail, env: complianceIsBeeceptor ? 'Beeceptor' : 'Sandbox' },
    {
      name: 'Wallet Intelligence',
      purpose: 'On-chain risk scoring & screening',
      icon: <IcPolicies />,
      status: stats.wallet_intelligence?.status ? 'live' : 'degraded',
      detail: stats.wallet_intelligence?.provider === 'beeceptor'
        ? (stats.wallet_intelligence?.status ? 'Beeceptor mock connected' : 'Beeceptor mock unavailable')
        : (stats.wallet_intelligence?.status ? 'Neo4j connected' : 'Neo4j unavailable'),
      env: stats.wallet_intelligence?.provider === 'beeceptor' ? 'Beeceptor' : 'Production',
    },
    { name: 'AI Advisory', purpose: 'Ollama / Groq decision explanation', icon: <IcCheck />, status: stats.ai_engine_status === 'down' ? 'not_connected' : 'live', detail: stats.ai_engine_status === 'down' ? 'No inference engine reachable' : `Engine: ${stats.ai_engine_status}`, env: 'Production' },
    { name: 'Workflow Automation', purpose: 'Approval and escalation workflows', icon: <IcCheck />, status: 'not_connected', detail: 'n8n not wired in this environment — planned for the integrations phase', env: 'Planned' },
    { name: 'Blockchain RPC', purpose: 'Base & Polygon node access', icon: <IcIntegrations />, status: (stats.rpc_status.base_sepolia || stats.rpc_status.polygon_amoy) ? 'live' : 'not_connected', detail: `Base ${stats.rpc_status.base_sepolia ? 'connected' : 'unreachable'} · Polygon ${stats.rpc_status.polygon_amoy ? 'connected' : 'unreachable'}`, env: 'Production' },
    { name: 'Notifications', purpose: 'Email, Telegram and webhook delivery', icon: <IcCheck />, status: 'unknown', detail: 'No live delivery status reported by this environment', env: 'Sandbox' },
  ];

  const statusCls: Record<string, string> = { live: 'pst-live', degraded: 'pst-degraded', not_connected: '', unknown: '' };
  const statusLabel: Record<string, string> = { live: 'Live', degraded: 'Degraded', not_connected: 'Not Connected', unknown: 'Unknown' };
  const statusStyle: Record<string, React.CSSProperties> = {
    not_connected: { background: 'var(--gray-soft)', color: 'var(--ink-soft)' },
    unknown: { background: 'var(--gray-soft)', color: 'var(--ink-soft)' },
  };

  return (
    <>
      <div className="topbar"><h1>Integrations</h1><p>Operational services this environment depends on.</p></div>
      <div className="content pad-t">
        {rows.map((r) => (
          <div className="irow" key={r.name}>
            <div className="iicon">{r.icon}</div>
            <div><div className="iname">{r.name}</div><div className="ipurpose">{r.purpose}</div></div>
            <div className="imeta">
              <div className="im-col"><div className="im-l">Status</div><div className="im-v"><span className={`pstatus ${statusCls[r.status]}`} style={statusStyle[r.status]}>{statusLabel[r.status]}</span></div></div>
              <div className="im-col" style={{ maxWidth: 220 }}><div className="im-l">Detail</div><div className="im-v" style={{ fontWeight: 500, fontSize: 11.5 }}>{r.detail}</div></div>
              <div className="im-col"><div className="im-l">Environment</div><div className="im-v"><span className="envtag">{r.env}</span></div></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
