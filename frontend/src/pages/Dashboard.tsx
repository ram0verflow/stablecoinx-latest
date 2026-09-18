import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Brain, Globe, RefreshCw, Server, Shield, ShieldCheck,
  Plus, AlertTriangle, Users, TrendingUp,
  Wallet, Coins, ArrowUpRight, Pencil,
  Clock, CheckCircle2, BarChart3, Search
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
import { StatCard } from '../components/ui/StatCard';
import { StatusDot } from '../components/StatusBadge';
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

const TREASURY_TOKENS: Token[] = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD'];
const TREASURY_URGENCIES: Urgency[] = ['Low', 'Medium', 'High', 'Critical'];

// Chart color constants — Recharts doesn't read Tailwind classes, so these mirror the light theme tokens.
const CHART_COLORS = {
  grid: '#e2e6ee',
  axis: '#94a3b8',
  primary: '#2563eb',
  danger: '#dc2626',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e6ee',
  tooltipText: '#0f172a',
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
  const [, setRouteBreakdown] = useState<any[]>([]);
  const [, setLoading] = useState(true);
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
  const [, setSelectedReview] = useState<any | null>(null);
  const [, setRevalidationRecords] = useState<RevalidationRecord[]>([]);
  const [, setRevalidationLoading] = useState(false);
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
           <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
           <span className="badge badge-pending">{badge}</span>
        </div>
        <p className="text-ink-600 font-medium">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4 bg-surface-card p-2 rounded-xl border border-surface-border">
         <div className="flex items-center gap-2 px-4 border-r border-surface-border">
            <StatusDot tone="pass" />
            <span className="text-[10px] font-black uppercase tracking-widest text-ink-600">AI Engine Live</span>
         </div>
         <div className="flex items-center gap-2 px-4">
            <StatusDot tone="pass" />
            <span className="text-[10px] font-black uppercase tracking-widest text-ink-600">RPC Connected</span>
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
                    <StatCard label="Total Volume" value={`$${((stats.total_volume || 0) / 1000).toFixed(1)}k`} change="+12%" icon={Activity} tone="processing" />
                    <StatCard label="Approved Today" value={(stats.approved_today || 0).toString()} change="+8" icon={CheckCircle2} tone="pass" />
                    <StatCard label="Pending Review" value={pendingCount.toString()} change={pendingCount > 0 ? `+${pendingCount}` : '0'} icon={Clock} tone="review" />
                </div>

                {/* Create Payment Form */}
                <div className="glass-card p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-ink-900 mb-1">Create New Settlement</h3>
                            <p className="text-ink-600 text-sm">Submit a payment request to the compliance pipeline.</p>
                        </div>
                        <button onClick={() => navigate('/create-payment')} className="btn-secondary py-2 text-xs">Full Form</button>
                    </div>

                    <form onSubmit={handleTreasuryCreate} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-ink-600 uppercase tracking-widest ml-1">Sender Company</label>
                                <input value={treasuryForm.senderCompany} onChange={(e) => setTreasuryField('senderCompany', e.target.value)} className="input-field" placeholder="Acme Global Inc" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-ink-600 uppercase tracking-widest ml-1">Receiver Company</label>
                                <input value={treasuryForm.receiverCompany} onChange={(e) => setTreasuryField('receiverCompany', e.target.value)} className="input-field" placeholder="Tech Logistics LLC" />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-ink-600 uppercase tracking-widest ml-1">Amount</label>
                                <div className="relative">
                                    <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                                    <input type="number" value={treasuryForm.amount} onChange={(e) => setTreasuryField('amount', e.target.value)} className="input-field pl-12" placeholder="5000" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-ink-600 uppercase tracking-widest ml-1">Token</label>
                                <select value={treasuryForm.token} onChange={(e) => setTreasuryField('token', e.target.value)} className="select-field">
                                    {TREASURY_TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-ink-600 uppercase tracking-widest ml-1">Urgency</label>
                                <select value={treasuryForm.urgency} onChange={(e) => setTreasuryField('urgency', e.target.value)} className="select-field">
                                    {TREASURY_URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-ink-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    Sender Wallet Address
                                    <span className="text-[10px] text-status-blocked font-bold px-1.5 py-0.5 rounded bg-status-blocked/10 border border-status-blocked/20 uppercase tracking-tighter">Mandatory</span>
                                </label>
                                <input value={treasuryForm.senderWallet} onChange={(e) => setTreasuryField('senderWallet', e.target.value)} className="input-field font-mono text-sm" placeholder="0x... (Required)" required />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-ink-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    Receiver Wallet Address
                                    <span className="text-[10px] text-status-blocked font-bold px-1.5 py-0.5 rounded bg-status-blocked/10 border border-status-blocked/20 uppercase tracking-tighter">Mandatory</span>
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
                    <div className="px-8 py-5 border-b border-surface-border flex items-center justify-between">
                        <h3 className="font-bold text-ink-900">Recent Settlements</h3>
                        <button onClick={() => navigate('/approval-queue')} className="text-xs font-bold text-brand-primary uppercase tracking-widest hover:text-brand-hover transition-colors">View All Transactions</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-ink-400 border-b border-surface-border">
                                    <th className="px-8 py-4">Transaction ID</th>
                                    <th className="px-8 py-4">Destination</th>
                                    <th className="px-8 py-4">Amount</th>
                                    <th className="px-8 py-4">Compliance Status</th>
                                    <th className="px-8 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rolePayments.slice(0, 6).map(p => (
                                    <tr key={p.id} className="table-row group cursor-pointer" onClick={() => navigate(`/route-analysis/${p.id}`)}>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs text-brand-primary font-bold">#{p.id.slice(0, 8)}</span>
                                                <span className="text-[10px] text-ink-400 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-ink-900">{p.receiverCompany}</span>
                                                <span className="text-[10px] text-ink-400 uppercase tracking-widest mt-0.5">{p.corridor}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="font-bold text-ink-900">${p.amount.toLocaleString()} <span className="text-ink-400 text-xs">{p.token}</span></span>
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
                                                <button onClick={(e) => { e.stopPropagation(); navigate(`/route-analysis/${p.id}`); }} className="p-2 hover:bg-surface-elevated rounded-lg transition-colors">
                                                    <ArrowUpRight className="w-4 h-4 text-ink-400 group-hover:text-ink-900" />
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
                <div className="glass-card p-6">
                    <h3 className="font-bold text-ink-900 mb-6 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-brand-primary" />
                        Connected Wallet
                    </h3>
                    <div className="space-y-4">
                        {isConnected ? (
                            <div className="p-4 rounded-xl border border-surface-border bg-surface-elevated">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-ink-600 uppercase tracking-wider">{networkName}</span>
                                    <StatusDot tone="pass" />
                                </div>
                                <p className="text-xl font-bold text-ink-900 tracking-tight">{balance}</p>
                                <p className="text-[10px] font-mono text-ink-400 mt-2">{address}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl border border-dashed border-surface-border bg-surface-elevated flex flex-col items-center justify-center text-center">
                                    <Wallet className="w-8 h-8 text-ink-400 mb-2" />
                                    <p className="text-xs font-bold text-ink-600">Wallet Not Connected</p>
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
                <div className="glass-card p-6">
                    <h3 className="font-bold text-ink-900 mb-6 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-brand-primary" />
                        Active Corridors
                    </h3>
                    <div className="aspect-square relative rounded-xl overflow-hidden bg-surface-elevated border border-surface-border p-4">
                        <div className="absolute inset-0 opacity-[0.15]" style={{
                            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(37,99,235,0.4) 1px, transparent 0)',
                            backgroundSize: '20px 20px',
                        }} />
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                            <circle cx="20" cy="30" r="2" fill="#2563eb" />
                            <circle cx="80" cy="20" r="2" fill="#2563eb" />
                            <circle cx="50" cy="80" r="2" fill="#2563eb" />
                            <path d="M 20 30 Q 50 10 80 20" fill="none" stroke="#2563eb" strokeWidth="0.5" strokeDasharray="1 2" />
                            <path d="M 80 20 Q 70 50 50 80" fill="none" stroke="#2563eb" strokeWidth="0.5" strokeDasharray="1 2" />
                        </svg>
                        <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-2">
                           <div className="p-2 rounded bg-white border border-surface-border text-[8px] font-bold uppercase tracking-widest text-ink-600">SG → USA: Active</div>
                           <div className="p-2 rounded bg-white border border-surface-border text-[8px] font-bold uppercase tracking-widest text-ink-600">UK → UAE: Active</div>
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
                <StatCard label="Flagged Queue" value={flagged.length.toString()} change="+3" icon={AlertTriangle} tone="blocked" />
                <StatCard label="Sanctions Screening" value="100%" change="0" icon={Shield} tone="pass" />
                <StatCard label="Avg Risk Score" value="34/100" change="-2" icon={BarChart3} tone="processing" />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-card overflow-hidden">
                    <div className="px-8 py-5 border-b border-surface-border flex items-center justify-between">
                        <h3 className="font-bold text-ink-900">Flagged Transactions</h3>
                        <div className="flex items-center gap-2">
                           <StatusDot tone="blocked" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-status-blocked">Action Required</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-ink-400 border-b border-surface-border">
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
                                                <div className="w-12 h-1.5 rounded-full bg-surface-border overflow-hidden">
                                                    <div className="h-full bg-status-blocked" style={{ width: `${p.riskScore}%` }} />
                                                </div>
                                                <span className="text-xs font-bold text-ink-900">{p.riskScore}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-ink-600 font-medium">
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
                            <h3 className="font-bold text-ink-900 mb-6 flex items-center gap-2">
                                <Brain className="w-5 h-5 text-brand-primary" />
                                AI Risk Reasoning
                            </h3>
                            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border text-sm text-ink-600 leading-relaxed mb-6 italic">
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
                                        <span className="text-xs font-bold text-ink-600 uppercase tracking-widest">{r.l}</span>
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${r.ok ? 'text-status-pass border-status-pass/20 bg-status-pass/5' : 'text-status-blocked border-status-blocked/20 bg-status-blocked/5'}`}>{r.v}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => handleAction(selectedFlagged.id, 'approve')} className="flex-1 btn-primary py-3 text-xs bg-status-pass hover:bg-green-700">Override</button>
                                <button onClick={() => handleAction(selectedFlagged.id, 'reject')} className="flex-1 btn-primary py-3 text-xs bg-status-blocked hover:bg-red-700">Confirm Block</button>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card p-12 flex flex-col items-center justify-center text-center border-dashed">
                            <Search className="w-12 h-12 text-ink-400 mb-4" />
                            <p className="text-ink-400 font-bold uppercase text-[10px] tracking-[0.2em]">Select a transaction to begin analysis</p>
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
        <StatCard label="Total Payments" value={stats.total_payments.toString()} icon={Activity} tone="processing" />
        <StatCard label="Block Rate" value={`${blockRate}%`} icon={AlertTriangle} tone="blocked" />
        <StatCard label="AI Latency" value={`${stats.avg_ai_latency_ms}ms`} icon={Brain} tone="unknown" />
        <StatCard label="Active Policies" value={policyRulesCount.toString()} icon={Shield} tone="review" />
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-ink-900 flex items-center gap-2">
                <Server className="w-5 h-5 text-brand-primary" />
                Service Health Telemetry
            </h3>
            <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Auto-refresh every 30s</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
           {[
             { label: 'Ollama Engine', ok: stats.ai_engine_status !== 'down', detail: stats.ai_engine_status },
             { label: 'Base Sepolia', ok: stats.rpc_status.base_sepolia, detail: 'RPC-1 Active' },
             { label: 'Polygon Amoy', ok: stats.rpc_status.polygon_amoy, detail: 'RPC-2 Active' },
             { label: 'Neo4j Graph', ok: stats.neo4j_status, detail: 'Graph Connected' },
             { label: 'Redis Cache', ok: stats.redis_status, detail: 'Sync Active' },
           ].map(s => (
             <div key={s.label} className="p-4 rounded-xl border border-surface-border bg-surface-elevated text-center">
                <StatusDot tone={s.ok ? 'pass' : 'blocked'} className="mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-ink-600 mb-1">{s.label}</p>
                <p className={`text-[10px] font-bold ${s.ok ? 'text-status-pass' : 'text-status-blocked'}`}>{s.detail}</p>
             </div>
           ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
         {/* User Management */}
         <div className="glass-card overflow-hidden">
            <div className="px-8 py-5 border-b border-surface-border flex items-center justify-between">
                <h3 className="font-bold text-ink-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-primary" />
                    Network Governance
                </h3>
                <button onClick={() => navigate('/settings')} className="text-xs font-bold text-brand-primary uppercase tracking-widest">Manage Roles</button>
            </div>
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-ink-400 border-b border-surface-border">
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
                                    <span className="font-bold text-ink-900">{u.name}</span>
                                    <span className="text-[10px] text-ink-400 mt-0.5">{u.email}</span>
                                </div>
                            </td>
                            <td className="px-8 py-5">
                                <span className="badge badge-pending">{u.role}</span>
                            </td>
                            <td className="px-8 py-5">
                                <span className="text-[10px] font-black uppercase text-status-pass">Authorized</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>

         {/* Policy Panel */}
         <div className="glass-card overflow-hidden">
            <div className="px-8 py-5 border-b border-surface-border flex items-center justify-between">
                <h3 className="font-bold text-ink-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-status-review" />
                    Compliance Orchestration
                </h3>
                <button onClick={() => navigate('/revalidation')} className="text-xs font-bold text-status-review uppercase tracking-widest">Policy Engine</button>
            </div>
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-ink-400 border-b border-surface-border">
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
                                    <span className="font-bold text-ink-900">{r.name}</span>
                                    <span className="text-[10px] text-ink-400 mt-0.5">{r.description}</span>
                                </div>
                            </td>
                            <td className="px-8 py-5">
                                <span className={`badge ${r.status === 'active' ? 'badge-pass' : 'badge-fail'}`}>{r.status}</span>
                            </td>
                            <td className="px-8 py-5 text-right">
                                <button className="p-2 hover:bg-surface-elevated rounded-lg">
                                    <Pencil className="w-3.5 h-3.5 text-ink-400 hover:text-ink-900 transition-colors" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      </div>



      <div className="grid lg:grid-cols-2 gap-8">
          <div className="glass-card p-8 h-[400px]">
              <h3 className="font-bold text-ink-900 mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-brand-primary" />
                  AI Decision Latency (ms)
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aiHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis stroke={CHART_COLORS.axis} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, border: `1px solid ${CHART_COLORS.tooltipBorder}`, color: CHART_COLORS.tooltipText }} />
                      <Line type="monotone" dataKey="latency_ms" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                  </LineChart>
              </ResponsiveContainer>
          </div>
          <div className="glass-card p-8 h-[400px]">
              <h3 className="font-bold text-ink-900 mb-6 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-status-blocked" />
                  Corridor Violation Density
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.top_corridors}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                      <XAxis dataKey="corridor" stroke={CHART_COLORS.axis} tick={{ fontSize: 10 }} />
                      <YAxis stroke={CHART_COLORS.axis} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, border: `1px solid ${CHART_COLORS.tooltipBorder}`, color: CHART_COLORS.tooltipText }} />
                      <Bar dataKey="block_rate" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
                  </BarChart>
              </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};
