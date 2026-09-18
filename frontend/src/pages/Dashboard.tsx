import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Brain, Globe, PlayCircle, RefreshCw, Server, Shield } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { monitoringApi, paymentApi, revalidationApi } from '../lib/api';
import type { MonitoringStats } from '../types';

type ScenarioStep = { label: string; done: boolean };

const defaultStats: MonitoringStats = {
  total_payments: 0,
  approved_today: 0,
  blocked_today: 0,
  pending_review: 0,
  avg_ai_latency_ms: 0,
  tx_success_rate: 0,
  top_corridors: [],
  ai_engine_status: 'down',
  rpc_status: { base_sepolia: false, polygon_amoy: false },
  neo4j_status: false,
  redis_status: false,
};

const healthDot = (ok: boolean) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
);

const AnimatedNumber: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = display;
    const delta = value - start;
    const timer = setInterval(() => {
      frame += 1;
      const next = start + (delta * Math.min(frame, 20)) / 20;
      setDisplay(next);
      if (frame >= 20) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [value]);
  return <>{Math.round(display).toLocaleString()}{suffix}</>;
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<MonitoringStats>(defaultStats);
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [routeBreakdown, setRouteBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenarioSteps, setScenarioSteps] = useState<ScenarioStep[]>([]);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);

  const loadMonitoring = async () => {
    const [s, ai, routes] = await Promise.all([
      monitoringApi.stats(),
      monitoringApi.aiPerformance(),
      monitoringApi.routeEfficiency(),
    ]);
    setStats(s.data);
    setAiHistory((ai.data?.history || []).slice().reverse());
    setRouteBreakdown(routes.data?.breakdown || []);
  };

  useEffect(() => {
    const run = async () => {
      try {
        await loadMonitoring();
      } finally {
        setLoading(false);
      }
    };
    run();
    const timer = setInterval(run, 30_000);
    return () => clearInterval(timer);
  }, []);

  const cardItems = useMemo(
    () => [
      { label: 'Total Payments', value: stats.total_payments },
      { label: 'Approved Today', value: stats.approved_today },
      { label: 'Blocked Today', value: stats.blocked_today },
      { label: 'Pending Review', value: stats.pending_review },
    ],
    [stats]
  );

  const runScenario = async (
    name: string,
    payload?: Record<string, unknown>,
    extra?: () => Promise<unknown>
  ) => {
    setRunningScenario(name);
    setScenarioSteps([
      { label: 'Creating payment', done: false },
      { label: 'Running compliance pipeline', done: false },
      { label: 'Applying AI + policy veto', done: false },
      { label: 'Updating dashboard', done: false },
    ]);
    try {
      if (payload) {
        await paymentApi.create(payload as any);
      }
      setScenarioSteps((p) => p.map((s, i) => (i === 0 ? { ...s, done: true } : s)));
      await new Promise((r) => setTimeout(r, 1200));
      setScenarioSteps((p) => p.map((s, i) => (i === 1 ? { ...s, done: true } : s)));
      if (extra) await extra();
      await new Promise((r) => setTimeout(r, 1200));
      setScenarioSteps((p) => p.map((s, i) => (i === 2 ? { ...s, done: true } : s)));
      await loadMonitoring();
      setScenarioSteps((p) => p.map((s, i) => (i === 3 ? { ...s, done: true } : s)));
    } finally {
      setTimeout(() => setRunningScenario(null), 800);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-card p-4 border border-indigo-500/30 bg-indigo-500/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-300 font-semibold">Demo Mode</p>
            <p className="text-xs text-slate-300">Judge-ready one-click scenarios</p>
          </div>
          <button className="btn-secondary text-xs" onClick={() => loadMonitoring()}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4">
          <button
            className="btn-primary text-xs justify-center"
            onClick={() =>
              runScenario('clean', {
                senderCompany: 'SG Demo Sender',
                receiverCompany: 'UAE Demo Receiver',
                sourceCountry: 'Singapore',
                destinationCountry: 'UAE',
                sourceChain: 'Base Sepolia',
                destinationChain: 'Base Sepolia',
                amount: 500,
                token: 'USDC',
                purpose: 'Supplier Payment',
                urgency: 'Low',
              })
            }
          >
            <PlayCircle className="w-4 h-4" /> Run Clean Payment (SG→UAE)
          </button>
          <button
            className="btn-secondary text-xs justify-center"
            onClick={() =>
              runScenario('blocked', {
                senderCompany: 'USA Demo Sender',
                receiverCompany: 'Iran Demo Receiver',
                sourceCountry: 'USA',
                destinationCountry: 'Iran',
                sourceChain: 'Base Sepolia',
                destinationChain: 'Base Sepolia',
                amount: 2000,
                token: 'USDC',
                purpose: 'Supplier Payment',
                urgency: 'High',
              })
            }
          >
            <PlayCircle className="w-4 h-4" /> Run Blocked Payment (USA→Iran)
          </button>
          <button
            className="btn-secondary text-xs justify-center"
            onClick={() =>
              runScenario('high-risk', {
                senderCompany: '0xBAD0000000000000000000000000000000000001',
                receiverCompany: 'High Risk Counterparty',
                sourceCountry: 'Singapore',
                destinationCountry: 'USA',
                sourceChain: 'Base Sepolia',
                destinationChain: 'Polygon Amoy',
                amount: 125000,
                token: 'USDT',
                purpose: 'Treasury Transfer',
                urgency: 'Critical',
              })
            }
          >
            <PlayCircle className="w-4 h-4" /> Run High Risk Payment
          </button>
          <button
            className="btn-secondary text-xs justify-center"
            onClick={() => runScenario('revalidation', undefined, async () => revalidationApi.triggerSanctions())}
          >
            <PlayCircle className="w-4 h-4" /> Trigger Revalidation
          </button>
        </div>
        {runningScenario && (
          <div className="mt-4 p-3 bg-slate-900/40 rounded-lg border border-slate-700/40">
            <p className="text-xs text-slate-300 mb-2">Scenario: {runningScenario}</p>
            <div className="grid grid-cols-4 gap-2">
              {scenarioSteps.map((s) => (
                <div key={s.label} className={`text-xs rounded px-2 py-2 border ${s.done ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10' : 'border-slate-700 text-slate-400'}`}>
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Live monitoring and demo telemetry</p>
        </div>
        <button className="btn-secondary text-sm" onClick={() => navigate('/approval-queue')}>
          <Shield className="w-4 h-4" /> Approval Queue
        </button>
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-wrap gap-4 text-xs text-slate-300">
          <span className="flex items-center gap-2">{healthDot(stats.ai_engine_status !== 'down')} AI</span>
          <span className="flex items-center gap-2">{healthDot(stats.rpc_status.base_sepolia)} Base RPC</span>
          <span className="flex items-center gap-2">{healthDot(stats.rpc_status.polygon_amoy)} Polygon RPC</span>
          <span className="flex items-center gap-2">{healthDot(stats.neo4j_status)} Neo4j</span>
          <span className="flex items-center gap-2">{healthDot(stats.redis_status)} Redis</span>
          <span className="ml-auto text-slate-500">Refresh: every 30s</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {cardItems.map((item) => (
          <div key={item.label} className="glass-card p-5">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="text-2xl font-bold text-white mt-1">
              <AnimatedNumber value={item.value} />
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500">Avg AI Latency</p>
          <p className="text-xl font-semibold text-indigo-300"><AnimatedNumber value={stats.avg_ai_latency_ms} suffix=" ms" /></p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500">TX Success Rate</p>
          <p className="text-xl font-semibold text-emerald-300"><AnimatedNumber value={stats.tx_success_rate} suffix="%" /></p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500">Active AI Engine</p>
          <p className="text-xl font-semibold text-slate-200">{stats.ai_engine_status}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-indigo-400" /><h3 className="section-title">AI Latency History</h3></div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={aiHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timestamp" hide />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="latency_ms" stroke="#818cf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3"><Globe className="w-4 h-4 text-cyan-400" /><h3 className="section-title">Top Corridors (Block Rate)</h3></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.top_corridors}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="corridor" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#34d399" />
              <Bar dataKey="block_rate" fill="#fb7185" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3"><Server className="w-4 h-4 text-sky-400" /><h3 className="section-title">Route Efficiency</h3></div>
        <div className="grid grid-cols-2 gap-4">
          {(routeBreakdown || []).map((r: any) => (
            <div key={r.route} className="p-3 rounded border border-slate-700/40 bg-slate-900/30">
              <p className="text-sm text-slate-200">{r.route}</p>
              <p className="text-xs text-slate-500">Count: {r.count} • Share: {r.share_pct}%</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3"><Brain className="w-4 h-4 text-violet-400" /><h3 className="section-title">Corridor Map</h3></div>
        <svg viewBox="0 0 700 220" className="w-full h-44 bg-slate-900/30 rounded">
          <circle cx="80" cy="60" r="20" fill="#22d3ee" /><text x="60" y="95" fill="#cbd5e1" fontSize="12">SG</text>
          <circle cx="300" cy="50" r="20" fill="#818cf8" /><text x="285" y="85" fill="#cbd5e1" fontSize="12">UAE</text>
          <circle cx="520" cy="60" r="20" fill="#34d399" /><text x="505" y="95" fill="#cbd5e1" fontSize="12">USA</text>
          <circle cx="220" cy="160" r="20" fill="#f59e0b" /><text x="205" y="195" fill="#cbd5e1" fontSize="12">IND</text>
          <line x1="100" y1="60" x2="280" y2="50" stroke="#22d3ee" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="320" y1="50" x2="500" y2="60" stroke="#34d399" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="90" y1="70" x2="205" y2="150" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrow)" />
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
              <polygon points="0 0, 8 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>
      </div>
      {loading && <div className="text-xs text-slate-500">Loading monitoring data...</div>}
    </div>
  );
};
