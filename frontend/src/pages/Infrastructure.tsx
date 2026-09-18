import React, { useEffect, useState } from 'react';
import { healthApi, monitoringApi } from '../lib/api';
import { IcAlertTriangle } from '../components/scx/icons';
import type { MonitoringStats } from '../types';

const defaultStats: MonitoringStats = {
  total_payments: 0, total_volume: 0, approved_today: 0, blocked_today: 0,
  pending_review: 0, avg_ai_latency_ms: 0, tx_success_rate: 0, top_corridors: [],
  ai_engine_status: 'down', rpc_status: { base_sepolia: false, polygon_amoy: false },
  neo4j_status: false, redis_status: false,
};

export const Infrastructure: React.FC = () => {
  const [stats, setStats] = useState<MonitoringStats>(defaultStats);
  const [health, setHealth] = useState<{ database: boolean; redis: boolean } | null>(null);
  const [checkedAt, setCheckedAt] = useState('');

  useEffect(() => {
    const load = async () => {
      const [s, h] = await Promise.allSettled([monitoringApi.stats(), healthApi.check()]);
      if (s.status === 'fulfilled') setStats(s.value.data);
      if (h.status === 'fulfilled') setHealth(h.value.data.checks);
      setCheckedAt(new Date().toLocaleTimeString());
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  const services = [
    { name: 'API', ok: true, detail: 'now' },
    { name: 'Database', ok: health?.database ?? false, detail: checkedAt },
    { name: 'Cache', ok: stats.redis_status, detail: checkedAt },
    { name: 'AI Advisory', ok: stats.ai_engine_status !== 'down', detail: checkedAt },
    { name: 'Wallet Graph', ok: stats.neo4j_status, detail: checkedAt },
    { name: 'RPC · Base Sepolia', ok: stats.rpc_status.base_sepolia, detail: checkedAt },
    { name: 'RPC · Polygon Amoy', ok: stats.rpc_status.polygon_amoy, detail: checkedAt },
  ];
  const incidents = services.filter((s) => !s.ok);

  return (
    <>
      <div className="topbar">
        <div><h1>Infrastructure</h1><p>Operational health of core platform services.</p></div>
        {incidents.length > 0 ? (
          <div className="pill" style={{ color: 'var(--amber)', background: 'var(--amber-soft)', borderColor: 'var(--amber-line)' }}><span className="d d-amber" />{incidents.length} service{incidents.length > 1 ? 's' : ''} degraded</div>
        ) : (
          <div className="pill" style={{ color: 'var(--green)', background: 'var(--green-soft)', borderColor: 'var(--green-line)' }}><span className="d d-green" />All systems operational</div>
        )}
      </div>
      <div className="content pad-t">
        <div className="sgrid">
          {services.map((s) => (
            <div className={`scard${s.ok ? '' : ' deg'}`} key={s.name}>
              <div className="sname">{s.name}</div>
              <div className={`sstatus ${s.ok ? 'sst-h' : 'sst-d'}`}>{s.ok ? 'Healthy' : 'Degraded'}</div>
              <div className="smeta"><span>Checked <b>{s.detail || '—'}</b></span></div>
            </div>
          ))}
        </div>

        {incidents.length > 0 && (
          <div className="incident">
            <div className="inc-head"><IcAlertTriangle className="" /><b>{incidents.length} service{incidents.length > 1 ? 's' : ''} degraded</b></div>
            <div className="inc-body">
              {incidents.slice(0, 4).map((s) => (
                <div className="inc-col" key={s.name}>
                  <div className="l">{s.name}</div>
                  <div className="v">Unreachable in this environment. Payments that depend on this service are routed to manual review rather than treated as clean.</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
