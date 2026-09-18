import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, Brain, Globe, PlayCircle, RefreshCw, Server, Shield, ShieldCheck,
  Plus, FileText, AlertTriangle, Users, Settings2, TrendingUp, 
  Wallet, Coins, ThumbsUp, ThumbsDown, ArrowUpRight, Pencil,
  Clock, CheckCircle2, ChevronRight, BarChart3, Search
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { monitoringApi, paymentApi, revalidationApi } from '../lib/api';
import { usePaymentStore, transformPayment } from '../store/paymentStore';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/ToastProvider';
import { useWallet } from '../hooks/useWallet';
import type { MonitoringStats, RevalidationRecord, Country, Chain, Token, Purpose, Urgency } from '../types';

const defaultStats: MonitoringStats = {
  total_payments: 0,
  total_volume: 0,
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

const TREASURY_COUNTRIES: Country[] = ['Singapore', 'USA', 'UK', 'UAE', 'India', 'Germany', 'Japan', 'Switzerland', 'Canada', 'Australia', 'Hong Kong', 'Egypt', 'South Korea', 'Russia', 'Iran', 'North Korea'];
const TREASURY_CHAINS: Chain[] = ['Base Sepolia', 'Polygon Amoy', 'Ethereum Mainnet', 'Arbitrum', 'Optimism'];
const TREASURY_TOKENS: Token[] = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD'];
const TREASURY_PURPOSES: Purpose[] = ['Payroll', 'Supplier Payment', 'Treasury Transfer', 'Cross-border Settlement', 'Invoice Payment', 'Refund', 'Dividend Payment'];
const TREASURY_URGENCIES: Urgency[] = ['Low', 'Medium', 'High', 'Critical'];

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

const StatCard: React.FC<{ label: string; value: any; change: string; icon: any; color: 'blue' | 'amber' | 'red' | 'emerald' | 'purple' }> = ({ label, value, change, icon: Icon, color }) => {
  const colors = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };
  
  return (
    <div className="glass-card p-6 border-white/5 hover:border-white/10 group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className={`text-xs font-bold ${change.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
          {change}
        </span>
      </div>
      <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">{label}</p>
      <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL;
  if (!apiBaseUrl) {
    throw new Error('Missing VITE_API_BASE_URL (or VITE_BACKEND_URL) environment variable');
  }
  const navigate = useNavigate();
  const { user, token: authToken, role: authStoreRole } = useAuthStore();
  const { addPayment } = usePaymentStore();
  const { showToast } = useToast();
  const { isConnected, balance, networkName, address } = useWallet();
  
  const role = (authStoreRole || user?.role || 'Admin').toLowerCase().replace(/ /g, '_');
  
  const [stats, setStats] = useState<MonitoringStats>(defaultStats);
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [routeBreakdown, setRouteBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenarioSteps, setScenarioSteps] = useState<{ label: string; done: boolean }[]>([]);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [treasurySubmitting, setTreasurySubmitting] = useState(false);
  const [treasuryForm, setTreasuryForm] = useState({
    senderCompany: '',
    receiverCompany: '',
    sourceCountry: 'USA' as Country,
    destinationCountry: 'UAE' as Country,
    sourceChain: 'Base Sepolia' as Chain,
    destinationChain: 'Base Sepolia' as Chain,
    amount: '',
    token: 'USDC' as Token,
    purpose: 'Supplier Payment' as Purpose,
    urgency: 'Medium' as Urgency,
    senderWallet: '',
    receiverWallet: '',
  });
  const [selectedFlagged, setSelectedFlagged] = useState<any | null>(null);
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  const [revalidationRecords, setRevalidationRecords] = useState<RevalidationRecord[]>([]);
  const [revalidationLoading, setRevalidationLoading] = useState(false);
  const [rolePayments, setRolePayments] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [policyRules, setPolicyRules] = useState<any[]>([]);
  const [policyRulesCount, setPolicyRulesCount] = useState(0);

  const loadMonitoring = async () => {
    try {
        const [s, ai, routes] = await Promise.all([
        monitoringApi.stats(),
        monitoringApi.aiPerformance(),
        monitoringApi.routeEfficiency(),
        ]);
        setStats(s.data);
        setAiHistory((ai.data?.history || []).slice().reverse());
        setRouteBreakdown(routes.data?.breakdown || []);
    } catch (err) {
        console.error('Failed to load monitoring data', err);
    }
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

  useEffect(() => {
    const loadRoleData = async () => {
      try {
        const res = await paymentApi.list();
        const mapped = (res.data || []).map((p: any) => ({
          id: String(p.id),
          senderCompany: p.sender_company ?? p.senderCompany ?? '',
          receiverCompany: p.receiver_company ?? p.receiverCompany ?? '',
          sourceCountry: p.source_country ?? p.sourceCountry ?? '',
          destinationCountry: p.destination_country ?? p.destinationCountry ?? '',
          amount: Number(p.amount),
          token: p.token ?? 'USDC',
          status: p.status ?? 'pending',
          corridor: `${p.source_country ?? ''} → ${p.destination_country ?? ''}`,
          riskScore: Number(p.risk_score ?? p.riskScore ?? (p.status === 'blocked' ? 82 : 34)),
          aiDecision: p.ai_decision ?? p.aiDecision ?? (p.status === 'blocked' ? 'manual_review' : 'direct_transfer'),
          createdAt: p.created_at ?? new Date().toISOString(),
          updatedAt: p.updated_at ?? new Date().toISOString(),
        }));
        setRolePayments(mapped);
      } catch (err: any) {
        console.error('Failed to load role payments', err);
      }
    };
    loadRoleData();
  }, []);

  useEffect(() => {
    if (role !== 'admin') return;
    const loadAdminData = async () => {
      try {
        const [usersRes, policyRes] = await Promise.allSettled([
          fetch(`${apiBaseUrl}/api/v1/auth/users`, {
            headers: { Authorization: `Bearer ${authToken || ''}` },
          }).then((r) => r.json()),
          fetch(`${apiBaseUrl}/api/v1/policy/rules`, {
            headers: { Authorization: `Bearer ${authToken || ''}` },
          }).then((r) => r.json()),
        ]);
        if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)) {
          setAdminUsers(usersRes.value.map((u: any) => ({ id: String(u.id), name: u.name || u.email, email: u.email, role: u.role, status: u.is_active !== false ? 'active' : 'inactive' })));
        }
        if (policyRes.status === 'fulfilled') {
          const data = policyRes.value;
          const rules = Array.isArray(data) ? data : (data?.rules || []);
          if (Array.isArray(rules) && rules.length) {
            const mapped = rules.map((r: any, index: number) => ({
              id: String(r.id ?? r.rule_id ?? `POL-${index + 1}`),
              name: r.name ?? r.rule ?? r.title ?? `Policy Rule ${index + 1}`,
              description: r.description ?? r.details ?? r.reason ?? 'Rule metadata pending',
              status: r.status ?? (r.enabled === false ? 'inactive' : 'active'),
            }));
            setPolicyRules(mapped);
            setPolicyRulesCount(mapped.length);
          } else {
            setPolicyRules([]);
            setPolicyRulesCount(0);
          }
        }
      } catch (err) {
          console.error('Failed to load admin data', err);
      }
    };
    loadAdminData();
  }, [role, authToken, apiBaseUrl]);

  useEffect(() => {
    if (role !== 'auditor') return;
    const loadRevalidations = async () => {
      try {
        setRevalidationLoading(true);
        const { data } = await revalidationApi.list();
        const records = Array.isArray(data) ? data : (data?.records || []);
        setRevalidationRecords(records.slice(0, 6));
      } catch {
        setRevalidationRecords([]);
      } finally {
        setRevalidationLoading(false);
      }
    };
    loadRevalidations();
  }, [role]);

  const runScenario = async (name: string, payload?: any, extra?: () => Promise<any>) => {
    setRunningScenario(name);
    setScenarioSteps([
      { label: 'Creating payment', done: false },
      { label: 'Running compliance pipeline', done: false },
      { label: 'Applying AI + policy veto', done: false },
      { label: 'Updating dashboard', done: false },
    ]);
    try {
      if (payload) {
        await paymentApi.create(payload);
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

  const setTreasuryField = (field: string, value: string) =>
    setTreasuryForm((p) => ({ ...p, [field]: value }));

  const handleTreasuryCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Treasury form submission started', treasuryForm);
    
    if (!treasuryForm.senderCompany || !treasuryForm.receiverCompany || !treasuryForm.amount) {
      showToast('warning', 'Missing Fields', 'Please fill sender company, receiver company, and amount.');
      return;
    }
    
    if (!treasuryForm.senderWallet || !treasuryForm.senderWallet.trim()) {
      showToast('error', 'Sender Wallet Required', 'Sender wallet address is mandatory for settlement execution.');
      return;
    }
    
    if (!treasuryForm.receiverWallet || !treasuryForm.receiverWallet.trim()) {
      showToast('error', 'Receiver Wallet Required', 'Receiver wallet address is mandatory for settlement execution.');
      return;
    }
    
    const senderAddr = treasuryForm.senderWallet.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(senderAddr)) {
      showToast('error', 'Invalid Wallet Address', 'Sender wallet must be a valid Ethereum address (0x followed by 40 hex characters).');
      return;
    }

    const walletAddr = treasuryForm.receiverWallet.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddr)) {
      showToast('error', 'Invalid Wallet Address', 'Receiver wallet must be a valid Ethereum address (0x followed by 40 hex characters).');
      return;
    }
    
    setTreasurySubmitting(true);
    const payload = { 
      ...treasuryForm, 
      amount: parseFloat(treasuryForm.amount)
    };
    console.log('Sending payment payload:', payload);
    
    try {
      const { data } = await paymentApi.create(payload as any);
      console.log('Payment created successfully:', data);
      addPayment(transformPayment(data));
      setRolePayments((prev) => [{ ...(data as any), corridor: `${treasuryForm.sourceCountry} → ${treasuryForm.destinationCountry}` }, ...prev]);
      showToast('success', 'Payment Created', `Payment ${data.id} submitted to pipeline`);
      navigate(`/route-analysis/${data.id}`);
    } catch (err: any) {
      console.error('Payment creation failed:', err);
      const detail = err?.response?.data?.detail || 'Failed to create payment';
      showToast('error', 'Submission Failed', detail);
    } finally {
      setTreasurySubmitting(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'escalate') => {
    try {
      if (action === 'approve') await paymentApi.approve(id);
      else if (action === 'reject') await paymentApi.reject(id);
      else await paymentApi.escalate(id);
      
      const statusMap = { approve: 'approved', reject: 'blocked', escalate: 'under_review' };
      setRolePayments(prev => prev.map(p => p.id === id ? { ...p, status: statusMap[action] } : p));
      showToast(action === 'reject' ? 'error' : 'success', `Payment ${statusMap[action]}`, `Payment ${id} updated`);
    } catch (err: any) {
      showToast('error', 'Action Failed', 'Failed to update payment status');
    }
  };

  const blockRate = stats.total_payments > 0 ? Math.round((stats.blocked_today / stats.total_payments) * 100) : 0;

  // ──────────────────────────────────────────────────────────────────────────
  // Shared Header
  const renderHeader = (title: string, subtitle: string, badge: string) => (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
           <h1 className="text-3xl font-extrabold tracking-tight text-white">{title}</h1>
           <span className="badge badge-pending">{badge}</span>
        </div>
        <p className="text-slate-500 font-medium">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4 bg-slate-900/40 p-2 rounded-2xl border border-white/5 backdrop-blur-xl">
         <div className="flex items-center gap-2 px-4 border-r border-slate-800">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Engine Live</span>
         </div>
         <div className="flex items-center gap-2 px-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">RPC Connected</span>
         </div>
      </div>
    </header>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Treasury Dashboard
  if (role === 'treasury_officer') {
    const pendingCount = rolePayments.filter(p => p.status === 'under_review' || p.status === 'pending').length;
    return (
      <div className="space-y-8 animate-fade-in pb-12">
        {renderHeader('Treasury Dashboard', `Welcome back, ${user?.name || 'Officer'}. System is active.`, 'Treasury Officer')}

        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Total Volume" value={`$${((stats.total_volume || 0) / 1000).toFixed(1)}k`} change="+12%" icon={Activity} color="blue" />
                    <StatCard label="Approved Today" value={(stats.approved_today || 0).toString()} change="+8" icon={CheckCircle2} color="emerald" />
                    <StatCard label="Pending Review" value={pendingCount.toString()} change={pendingCount > 0 ? `+${pendingCount}` : '0'} icon={Clock} color="amber" />
                </div>

                {/* Create Payment Form */}
                <div className="glass-card p-8 border-white/5 bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Create New Settlement</h3>
                            <p className="text-slate-500 text-sm">Submit a payment request to the 24-layer compliance pipeline.</p>
                        </div>
                        <button onClick={() => navigate('/create-payment')} className="btn-secondary py-2 text-xs">Full Form</button>
                    </div>
                    
                    <form onSubmit={handleTreasuryCreate} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Sender Company</label>
                                <input value={treasuryForm.senderCompany} onChange={(e) => setTreasuryField('senderCompany', e.target.value)} className="input-field" placeholder="Acme Global Inc" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Receiver Company</label>
                                <input value={treasuryForm.receiverCompany} onChange={(e) => setTreasuryField('receiverCompany', e.target.value)} className="input-field" placeholder="Tech Logistics LLC" />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Amount</label>
                                <div className="relative">
                                    <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input type="number" value={treasuryForm.amount} onChange={(e) => setTreasuryField('amount', e.target.value)} className="input-field pl-12" placeholder="5000" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Token</label>
                                <select value={treasuryForm.token} onChange={(e) => setTreasuryField('token', e.target.value)} className="select-field">
                                    {TREASURY_TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Urgency</label>
                                <select value={treasuryForm.urgency} onChange={(e) => setTreasuryField('urgency', e.target.value)} className="select-field">
                                    {TREASURY_URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    Sender Wallet Address
                                    <span className="text-[10px] text-rose-500 font-bold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 uppercase tracking-tighter">Mandatory</span>
                                </label>
                                <input value={treasuryForm.senderWallet} onChange={(e) => setTreasuryField('senderWallet', e.target.value)} className="input-field font-mono text-sm" placeholder="0x... (Required)" required />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    Receiver Wallet Address
                                    <span className="text-[10px] text-rose-500 font-bold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 uppercase tracking-tighter">Mandatory</span>
                                </label>
                                <input value={treasuryForm.receiverWallet} onChange={(e) => setTreasuryField('receiverWallet', e.target.value)} className="input-field font-mono text-sm" placeholder="0x... (Required)" required />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row justify-end gap-3 pt-4">
                            <button 
                                type="submit" 
                                disabled={treasurySubmitting} 
                                className="btn-primary w-full md:w-auto px-10 flex items-center justify-center gap-2"
                            >
                                {treasurySubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                {treasurySubmitting ? 'Processing Pipeline...' : 'Authorize Settlement'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* History Table */}
                <div className="glass-card overflow-hidden">
                    <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
                        <h3 className="font-bold text-white">Recent Settlements</h3>
                        <button onClick={() => navigate('/approval-queue')} className="text-xs font-bold text-brand-primary uppercase tracking-widest hover:text-brand-secondary transition-colors">View All Transactions</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                                    <th className="px-8 py-4">Transaction ID</th>
                                    <th className="px-8 py-4">Destination</th>
                                    <th className="px-8 py-4">Amount</th>
                                    <th className="px-8 py-4">Compliance Status</th>
                                    <th className="px-8 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rolePayments.slice(0, 6).map(p => (
                                    <tr key={p.id} className="table-row group cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => navigate(`/route-analysis/${p.id}`)}>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs text-brand-primary font-bold">#{p.id.slice(0, 8)}</span>
                                                <span className="text-[10px] text-slate-500 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-200">{p.receiverCompany}</span>
                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{p.corridor}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="font-bold text-white">${p.amount.toLocaleString()} <span className="text-slate-500 text-xs">{p.token}</span></span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`badge ${
                                                p.status === 'executed' || p.status === 'approved' ? 'badge-pass' : 
                                                p.status === 'blocked' ? 'badge-fail' : 
                                                'badge-pending'
                                            }`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); navigate(`/route-analysis/${p.id}`); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {/* Wallets */}
                <div className="glass-card p-6 border-white/5 bg-white/[0.02]">
                    <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-brand-primary" />
                        Connected Wallet
                    </h3>
                    <div className="space-y-4">
                        {isConnected ? (
                            <div className="p-4 rounded-xl border border-white/5 bg-slate-950/50 hover:border-white/10 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{networkName}</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                </div>
                                <p className="text-xl font-bold text-white tracking-tight">{balance}</p>
                                <p className="text-[10px] font-mono text-slate-500 mt-2">{address}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl border border-white/5 bg-slate-950/50 flex flex-col items-center justify-center text-center opacity-60">
                                    <Wallet className="w-8 h-8 text-slate-600 mb-2" />
                                    <p className="text-xs font-bold text-slate-400">Wallet Not Connected</p>
                                </div>
                                <button 
                                    onClick={() => (window as any).ethereum?.request({ method: 'eth_requestAccounts' })}
                                    className="w-full btn-primary py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Connect MetaMask
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Corridor Map (Visual Only) */}
                <div className="glass-card p-6 border-white/5">
                    <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-cyan-400" />
                        Active Corridors
                    </h3>
                    <div className="aspect-square relative rounded-xl overflow-hidden bg-slate-950/50 border border-white/5 p-4">
                        <div className="absolute inset-0 opacity-10" style={{
                            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(59,130,246,0.5) 1px, transparent 0)',
                            backgroundSize: '20px 20px',
                        }} />
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                            <circle cx="20" cy="30" r="2" fill="#3b82f6" />
                            <circle cx="80" cy="20" r="2" fill="#3b82f6" />
                            <circle cx="50" cy="80" r="2" fill="#3b82f6" />
                            <path d="M 20 30 Q 50 10 80 20" fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="1 2" className="animate-dash" />
                            <path d="M 80 20 Q 70 50 50 80" fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="1 2" className="animate-dash" style={{ animationDelay: '1s' }} />
                        </svg>
                        <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-2">
                           <div className="p-2 rounded bg-slate-900/80 backdrop-blur-md border border-white/5 text-[8px] font-bold uppercase tracking-widest text-slate-400">SG → USA: Active</div>
                           <div className="p-2 rounded bg-slate-900/80 backdrop-blur-md border border-white/5 text-[8px] font-bold uppercase tracking-widest text-slate-400">UK → UAE: Active</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Compliance Officer Dashboard
  if (role === 'compliance_officer') {
    const flagged = rolePayments.filter(p => p.status === 'blocked' || p.status === 'under_review');
    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {renderHeader('Compliance Dashboard', 'Review flagged transactions and policy alerts.', 'Compliance Officer')}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Flagged Queue" value={flagged.length.toString()} change="+3" icon={AlertTriangle} color="red" />
                <StatCard label="Sanctions Screening" value="100%" change="0" icon={Shield} color="emerald" />
                <StatCard label="Avg Risk Score" value="34/100" change="-2" icon={BarChart3} color="blue" />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-card overflow-hidden">
                    <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
                        <h3 className="font-bold text-white">Flagged Transactions</h3>
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Action Required</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                                    <th className="px-8 py-4">ID</th>
                                    <th className="px-8 py-4">Risk Level</th>
                                    <th className="px-8 py-4">Reason</th>
                                    <th className="px-8 py-4 text-right">Review</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flagged.map(p => (
                                    <tr key={p.id} className={`table-row cursor-pointer ${selectedFlagged?.id === p.id ? 'bg-brand-primary/5' : ''}`} onClick={() => setSelectedFlagged(p)}>
                                        <td className="px-8 py-5">
                                            <span className="font-mono text-xs text-brand-primary font-bold">#{p.id.slice(0, 8)}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden`}>
                                                    <div className={`h-full bg-rose-500`} style={{ width: `${p.riskScore}%` }} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-200">{p.riskScore}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-slate-300 font-medium">
                                            {p.status === 'blocked' ? 'Sanctions Policy Veto' : 'High Risk Profile Escalation'}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button className="btn-secondary py-1 px-3 text-[10px] uppercase">Analyze</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-6">
                    {selectedFlagged ? (
                        <div className="glass-card p-6 border-brand-primary/30 bg-brand-primary/[0.02] animate-slide-right">
                            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                                <Brain className="w-5 h-5 text-violet-400" />
                                AI Risk Reasoning
                            </h3>
                            <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5 text-sm text-slate-300 leading-relaxed mb-6 italic">
                                "{selectedFlagged.aiDecision}. The counterparty wallet shows multiple hops from a high-risk offshore entity. Corridor Singapore → UAE is flagged for amount threshold exceeding daily treasury limit."
                            </div>
                            <div className="space-y-4 mb-8">
                                {[
                                    { l: 'Sanctions List', v: 'CLEAR', ok: true },
                                    { l: 'Wallet Risk', v: 'HIGH (82)', ok: false },
                                    { l: 'Issuer Risk', v: 'PASS', ok: true },
                                    { l: 'Policy Veto', v: 'VETO', ok: false },
                                ].map(r => (
                                    <div key={r.l} className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{r.l}</span>
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${r.ok ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-400 border-rose-500/20 bg-rose-500/5'}`}>{r.v}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => handleAction(selectedFlagged.id, 'approve')} className="flex-1 btn-primary py-3 text-xs bg-emerald-600 shadow-emerald-500/10">Override</button>
                                <button onClick={() => handleAction(selectedFlagged.id, 'reject')} className="flex-1 btn-primary py-3 text-xs bg-rose-600 shadow-rose-500/10">Confirm Block</button>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card p-12 flex flex-col items-center justify-center text-center opacity-50 border-dashed border-slate-800 bg-transparent">
                            <Search className="w-12 h-12 text-slate-700 mb-4" />
                            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Select a transaction to begin analysis</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Admin Dashboard (Fallback to original admin view but styled)
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {renderHeader('Admin Dashboard', 'Full system telemetry and policy orchestration.', 'Administrator')}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Payments" value={stats.total_payments.toString()} change="" icon={Activity} color="blue" />
        <StatCard label="Block Rate" value={`${blockRate}%`} change="" icon={AlertTriangle} color="red" />
        <StatCard label="AI Latency" value={`${stats.avg_ai_latency_ms}ms`} change="" icon={Brain} color="purple" />
        <StatCard label="Active Policies" value={policyRulesCount.toString()} change="" icon={Shield} color="amber" />
      </div>

      <div className="glass-card p-6 border-white/5">
        <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-sky-400" />
                Service Health Telemetry
            </h3>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Auto-refresh every 30s</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
           {[
             { label: 'Ollama Engine', ok: stats.ai_engine_status !== 'down', detail: stats.ai_engine_status },
             { label: 'Base Sepolia', ok: stats.rpc_status.base_sepolia, detail: 'RPC-1 Active' },
             { label: 'Polygon Amoy', ok: stats.rpc_status.polygon_amoy, detail: 'RPC-2 Active' },
             { label: 'Neo4j Graph', ok: stats.neo4j_status, detail: 'Graph Connected' },
             { label: 'Redis Cache', ok: stats.redis_status, detail: 'Sync Active' },
           ].map(s => (
             <div key={s.label} className="p-4 rounded-2xl border border-white/5 bg-slate-950/40 text-center group hover:border-white/10 transition-colors">
                <div className={`w-3 h-3 rounded-full mx-auto mb-3 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${s.ok ? 'bg-emerald-500 shadow-emerald-500/20 animate-pulse' : 'bg-rose-500 shadow-rose-500/20'}`} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
                <p className={`text-[10px] font-bold ${s.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{s.detail}</p>
             </div>
           ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
         {/* User Management */}
         <div className="glass-card overflow-hidden">
            <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-primary" />
                    Network Governance
                </h3>
                <button onClick={() => navigate('/settings')} className="text-xs font-bold text-brand-primary uppercase tracking-widest">Manage Roles</button>
            </div>
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                        <th className="px-8 py-4">Stakeholder</th>
                        <th className="px-8 py-4">Role</th>
                        <th className="px-8 py-4">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {adminUsers.slice(0, 5).map(u => (
                        <tr key={u.id} className="table-row">
                            <td className="px-8 py-5">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-200">{u.name}</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5">{u.email}</span>
                                </div>
                            </td>
                            <td className="px-8 py-5">
                                <span className="badge badge-pending">{u.role}</span>
                            </td>
                            <td className="px-8 py-5">
                                <span className="text-[10px] font-black uppercase text-emerald-400">Authorized</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>

         {/* Policy Panel */}
         <div className="glass-card overflow-hidden">
            <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-400" />
                    Compliance Orchestration
                </h3>
                <button onClick={() => navigate('/revalidation')} className="text-xs font-bold text-amber-400 uppercase tracking-widest">Policy Engine</button>
            </div>
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                        <th className="px-8 py-4">Rule Logic</th>
                        <th className="px-8 py-4">Status</th>
                        <th className="px-8 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {policyRules.map(r => (
                        <tr key={r.id} className="table-row">
                            <td className="px-8 py-5">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-200">{r.name}</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5">{r.description}</span>
                                </div>
                            </td>
                            <td className="px-8 py-5">
                                <span className={`badge ${r.status === 'active' ? 'badge-pass' : 'badge-fail'}`}>{r.status}</span>
                            </td>
                            <td className="px-8 py-5 text-right">
                                <button className="p-2 hover:bg-white/5 rounded-lg">
                                    <Pencil className="w-3.5 h-3.5 text-slate-500 hover:text-white transition-colors" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      </div>



      <div className="grid lg:grid-cols-2 gap-8">
          <div className="glass-card p-8 border-white/5 h-[400px]">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-brand-primary" />
                  AI Decision Latency (ms)
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aiHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #1e2433' }} />
                      <Line type="monotone" dataKey="latency_ms" stroke="#3b82f6" strokeWidth={3} dot={false} />
                  </LineChart>
              </ResponsiveContainer>
          </div>
          <div className="glass-card p-8 border-white/5 h-[400px]">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-rose-400" />
                  Corridor Violation Density
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.top_corridors}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="corridor" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #1e2433' }} />
                      <Bar dataKey="block_rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
              </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};
